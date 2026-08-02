import {
  DEFAULT_ROOM_TOPOLOGY_POLICY,
  resolveRoomTopology
} from "./guided-room-topology.js?v=luxury-configurator-engine-v1";
import {
  DEFAULT_INSTALLATION_FIT_POLICY,
  solveInstallation
} from "./guided-installation-solver.js?v=luxury-configurator-engine-v1";
import {
  createGuidedProductIntent,
  resolveGuidedProductId,
  resolveProductLayoutCompatibility
} from "./guided-product-adapter.js?v=tv-drawing-4-geometry-v1-20260802a";
import {
  evaluateGuidedProductCandidate
} from "./guided-product-engine.js?v=tv-drawing-4-geometry-v1-20260802a";
import {
  auditGuidedAcceptedSpecification
} from "./guided-render-contract.js?v=luxury-configurator-engine-v1";

export const GUIDED_PROJECT_ENGINE_VERSION = "2026.08-tv-drawing-4-v1";
export const GUIDED_ACCEPTED_SPECIFICATION_SCHEMA_VERSION = 1;
export const GUIDED_ACCEPTED_SNAPSHOT_SCHEMA_VERSION = 2;
export const GUIDED_QUOTE_CONTRACT_SCHEMA_VERSION = 1;
export const GUIDED_PERSISTENCE_CONTRACT_SCHEMA_VERSION = 1;

export function evaluateGuidedProjectCandidate(project = {}, options = {}) {
  const room = resolveRoomTopology(project, {
    policy: options.roomPolicy || DEFAULT_ROOM_TOPOLOGY_POLICY
  });
  if (!room.accepted) return rejectStage("room-topology", room.errors, { room });

  const productId = resolveGuidedProductId(project);
  const productIntent = createGuidedProductIntent(project, room);
  if (!productIntent.accepted) {
    return rejectStage("product-intent", productIntent.errors || [{
      code: "UNKNOWN_PRODUCT_ARCHETYPE",
      severity: "error",
      message: "The selected product does not resolve to a public physical archetype."
    }], { room, productIntent });
  }

  const compatibility = resolveProductLayoutCompatibility({ project, topology: room });
  if (compatibility.status === "unavailable") {
    return rejectStage("product-compatibility", [{
      code: "UNSUPPORTED_PRODUCT_LAYOUT",
      severity: "error",
      message: "The selected product is unavailable for this room topology.",
      productId,
      layoutId: room.layoutId
    }], { room, compatibility });
  }

  const fit = solveInstallation({
    room,
    product: productIntent,
    policy: options.fitPolicy || DEFAULT_INSTALLATION_FIT_POLICY,
    mode: productIntent.installationMode,
    zoneIds: productIntent.preferredZoneIds,
    mountingHeight: project.measurements?.mountingHeight
  });
  if (!fit.accepted) return rejectStage("installation-fit", fit.errors, { room, fit, compatibility });

  const product = evaluateGuidedProductCandidate({
    project,
    topology: room,
    fit,
    policy: options.productPolicy
  });
  if (!product.accepted) {
    return rejectStage("product-geometry", product.errors, { room, fit, product, compatibility });
  }

  const selectionFingerprint = createGuidedSelectionFingerprint(project);
  const geometryFingerprint = product.geometryFingerprint;
  const specificationFingerprint = createHash("jq-guided-spec-v1", {
    geometryFingerprint,
    selectionFingerprint,
    pricing: product.pricing || product.pricingStatus || "unavailable"
  });
  const specification = {
    accepted: true,
    schemaVersion: GUIDED_ACCEPTED_SPECIFICATION_SCHEMA_VERSION,
    engineVersion: GUIDED_PROJECT_ENGINE_VERSION,
    units: "inches",
    projectId: project.projectId || null,
    productId,
    layoutId: room.layoutId,
    room,
    fit,
    product,
    geometryFingerprint,
    selectionFingerprint,
    specificationFingerprint,
    materialState: product.materialState || createMaterialState(project),
    pricing: product.pricing,
    pricingStatus: product.pricingStatus,
    warnings: dedupeDiagnostics([
      ...(room.warnings || []),
      ...(fit.warnings || []),
      ...(product.warnings || [])
    ]),
    corrections: product.corrections || [],
    errors: []
  };
  const audit = auditGuidedAcceptedSpecification(specification);
  if (!audit.valid) {
    return rejectStage("render-contract", audit.errors, {
      room,
      fit,
      product,
      compatibility,
      audit
    });
  }
  specification.audit = audit;
  return deepFreeze(specification);
}

/**
 * Atomically evaluate a customer edit. Rejections expose named diagnostics but
 * keep the prior accepted specification available to the caller and renderer.
 */
export function transactGuidedProject(project, previousAccepted = null, options = {}) {
  const candidate = evaluateGuidedProjectCandidate(project, options);
  if (candidate.accepted) {
    return deepFreeze({
      accepted: true,
      changed: candidate.specificationFingerprint !== previousAccepted?.specificationFingerprint,
      geometryChanged: candidate.geometryFingerprint !== previousAccepted?.geometryFingerprint,
      materialChanged: candidate.selectionFingerprint !== previousAccepted?.selectionFingerprint,
      specification: candidate,
      rejectedCandidate: null,
      errors: [],
      warnings: candidate.warnings
    });
  }
  return deepFreeze({
    accepted: false,
    changed: false,
    geometryChanged: false,
    materialChanged: false,
    specification: previousAccepted?.accepted ? previousAccepted : null,
    rejectedCandidate: candidate,
    errors: candidate.errors || [],
    warnings: candidate.warnings || []
  });
}

export function createGuidedAcceptedSnapshot(specification, project = {}) {
  if (!specification?.accepted || !specification?.audit?.valid) {
    throw new Error("Only an audited accepted guided specification can be saved.");
  }
  return deepFreeze({
    schemaVersion: GUIDED_ACCEPTED_SNAPSHOT_SCHEMA_VERSION,
    engineVersion: GUIDED_PROJECT_ENGINE_VERSION,
    specificationSchemaVersion: specification.schemaVersion,
    projectId: project.projectId || specification.projectId || null,
    productId: specification.productId,
    layoutId: specification.layoutId,
    geometryFingerprint: specification.geometryFingerprint,
    selectionFingerprint: specification.selectionFingerprint,
    specificationFingerprint: specification.specificationFingerprint,
    regeneration: createRegenerationContract(specification),
    summary: createAcceptedSummary(specification)
  });
}

/**
 * Create the only project payload that the guided UI may explicitly persist.
 * A rejected candidate can continue to live in the editor, but it must never
 * be serialized next to the last accepted fingerprint: that combination
 * cannot regenerate after reload and could make quote identity drift.
 */
export function prepareGuidedProjectPersistence(project, previousAccepted = null, options = {}) {
  const transaction = transactGuidedProject(project, previousAccepted, options);
  if (!transaction.accepted) {
    const hasPriorAccepted = transaction.specification?.accepted === true;
    const candidateDiagnostic = transaction.errors?.[0] || {
      code: "CONFIGURATION_NOT_ACCEPTED",
      severity: "error",
      message: "The current edit does not resolve to an accepted fitted design."
    };
    return deepFreeze({
      accepted: false,
      persistable: false,
      kind: "guided-accepted-project",
      schemaVersion: GUIDED_PERSISTENCE_CONTRACT_SCHEMA_VERSION,
      code: "GUIDED_SAVE_REJECTED_CANDIDATE",
      message: hasPriorAccepted
        ? "This edit was not saved. The last accepted design remains unchanged; correct the highlighted measurements and try again."
        : "This project was not saved because it does not yet contain an accepted fitted design; complete or correct the highlighted measurements and try again.",
      project: null,
      snapshot: null,
      specification: transaction.specification,
      transaction,
      errors: [{
        code: "GUIDED_SAVE_REJECTED_CANDIDATE",
        severity: "error",
        message: "A rejected guided candidate cannot replace the last accepted saved project.",
        cause: candidateDiagnostic.code
      }, ...transaction.errors],
      warnings: transaction.warnings
    });
  }

  const snapshot = createGuidedAcceptedSnapshot(transaction.specification, project);
  const regenerated = restoreGuidedAcceptedSnapshot(project, snapshot, options);
  if (!regenerated.accepted) {
    return deepFreeze({
      accepted: false,
      persistable: false,
      kind: "guided-accepted-project",
      schemaVersion: GUIDED_PERSISTENCE_CONTRACT_SCHEMA_VERSION,
      code: "GUIDED_SAVE_INTEGRITY_FAILED",
      message: "This project was not saved because its accepted design could not be regenerated exactly.",
      project: null,
      snapshot: null,
      specification: transaction.specification,
      transaction,
      errors: [{
        code: "GUIDED_SAVE_INTEGRITY_FAILED",
        severity: "error",
        message: "The accepted guided candidate failed its save-time regeneration check."
      }, ...(regenerated.errors || [])],
      warnings: regenerated.warnings || transaction.warnings
    });
  }

  return deepFreeze({
    accepted: true,
    persistable: true,
    kind: "guided-accepted-project",
    schemaVersion: GUIDED_PERSISTENCE_CONTRACT_SCHEMA_VERSION,
    code: "GUIDED_SAVE_READY",
    message: "The accepted guided project regenerated exactly and is ready to save.",
    project: clone({ ...project, acceptedSnapshot: snapshot }),
    snapshot,
    specification: regenerated,
    transaction,
    errors: [],
    warnings: regenerated.warnings || []
  });
}

export function restoreGuidedAcceptedSnapshot(project, snapshot, options = {}) {
  const snapshotVersion = Number(snapshot?.schemaVersion);
  if (
    !snapshot
    || !Number.isInteger(snapshotVersion)
    || snapshotVersion < 1
    || snapshotVersion > GUIDED_ACCEPTED_SNAPSHOT_SCHEMA_VERSION
  ) {
    return rejectStage("restore", [{
      code: "UNSUPPORTED_GUIDED_SNAPSHOT",
      severity: "error",
      message: "The saved guided specification is missing or newer than this configurator."
    }]);
  }
  const regenerated = evaluateGuidedProjectCandidate(project, options);
  if (!regenerated.accepted) return regenerated;
  const mismatches = [
    ["productId", regenerated.productId],
    ["layoutId", regenerated.layoutId],
    ["geometryFingerprint", regenerated.geometryFingerprint],
    ["selectionFingerprint", regenerated.selectionFingerprint],
    ["specificationFingerprint", regenerated.specificationFingerprint]
  ].filter(([key, value]) => snapshot[key] !== value);
  if (snapshotVersion >= 2) {
    const expectedRegeneration = createRegenerationContract(regenerated);
    for (const [key, value] of Object.entries(expectedRegeneration)) {
      if (snapshot.regeneration?.[key] !== value) mismatches.push([`regeneration.${key}`, value]);
    }
  }
  if (mismatches.length) {
    return rejectStage("restore", [{
      code: "GUIDED_SNAPSHOT_FINGERPRINT_MISMATCH",
      severity: "error",
      message: "The saved project no longer regenerates the same accepted specification.",
      mismatches: mismatches.map(([key]) => key)
    }], { regenerated });
  }
  return regenerated;
}

/**
 * Regenerate and verify the exact accepted specification before it leaves the
 * browser through either quote transport. The full descriptor graph exists
 * only in memory; callers persist the returned compact v2 snapshot and send
 * the quote contract, which carries audited identities and compact BOM facts.
 */
export function prepareGuidedQuote(project, snapshot = project?.acceptedSnapshot, options = {}) {
  const sourceSnapshotSchemaVersion = Number(snapshot?.schemaVersion) || null;
  const specification = restoreGuidedAcceptedSnapshot(project, snapshot, options);
  if (!specification.accepted) {
    return deepFreeze({
      accepted: false,
      stage: "quote-integrity",
      specification: null,
      snapshot: null,
      quote: null,
      errors: [{
        code: "GUIDED_QUOTE_INTEGRITY_FAILED",
        severity: "error",
        message: "The quote was not prepared because the saved design did not regenerate as the same accepted specification."
      }, ...(specification.errors || []).map((error) => ({ ...error }))],
      warnings: specification.warnings || []
    });
  }
  if (sourceSnapshotSchemaVersion >= 2) {
    const identityMismatches = [
      ["engineVersion", specification.engineVersion],
      ["specificationSchemaVersion", specification.schemaVersion],
      ["projectId", specification.projectId]
    ].filter(([key, value]) => snapshot?.[key] !== value);
    if (identityMismatches.length) {
      return deepFreeze({
        accepted: false,
        stage: "quote-integrity",
        specification: null,
        snapshot: null,
        quote: null,
        errors: [{
          code: "GUIDED_QUOTE_SNAPSHOT_IDENTITY_MISMATCH",
          severity: "error",
          message: "The quote was not prepared because the compact snapshot identity did not match the regenerated accepted specification.",
          mismatches: identityMismatches.map(([key]) => key)
        }],
        warnings: specification.warnings || []
      });
    }
  }

  const compactSnapshot = createGuidedAcceptedSnapshot(specification, project);
  const quote = createGuidedQuoteContract(
    specification,
    compactSnapshot,
    sourceSnapshotSchemaVersion
  );
  return deepFreeze({
    accepted: true,
    stage: "quote-ready",
    specification,
    snapshot: compactSnapshot,
    quote,
    errors: [],
    warnings: specification.warnings || []
  });
}

function createGuidedQuoteContract(specification, compactSnapshot, sourceSnapshotSchemaVersion) {
  const pricing = compactQuotePricing(specification);
  const warnings = compactQuoteWarnings(specification.warnings);
  const bom = compactQuoteBom(specification);
  const pricingFingerprint = createHash(
    "jq-guided-quote-pricing-v1",
    specification.pricing || specification.pricingStatus || "unavailable"
  );
  const warningsFingerprint = createHash("jq-guided-quote-warnings-v1", specification.warnings || []);
  const bomFingerprint = createHash("jq-guided-quote-bom-v1", {
    descriptorSets: specification.product?.descriptorSets || [],
    canonicalBoms: (specification.pricing?.installations || []).map((installation) => (
      installation.breakdown?.bom || null
    ))
  });
  const identity = {
    specificationSchemaVersion: specification.schemaVersion,
    engineVersion: specification.engineVersion,
    projectId: specification.projectId,
    productId: specification.productId,
    layoutId: specification.layoutId,
    geometryFingerprint: specification.geometryFingerprint,
    selectionFingerprint: specification.selectionFingerprint,
    specificationFingerprint: specification.specificationFingerprint
  };
  const integrity = {
    verified: true,
    sourceSnapshotSchemaVersion,
    compactSnapshotSchemaVersion: compactSnapshot.schemaVersion,
    regeneration: clone(compactSnapshot.regeneration),
    pricingFingerprint,
    warningsFingerprint,
    bomFingerprint
  };
  integrity.quoteFingerprint = createHash("jq-guided-quote-contract-v1", {
    identity,
    pricing,
    warnings,
    bom,
    integrity
  });
  return {
    schemaVersion: GUIDED_QUOTE_CONTRACT_SCHEMA_VERSION,
    identity,
    pricing: { ...pricing, fingerprint: pricingFingerprint },
    warnings: { ...warnings, fingerprint: warningsFingerprint },
    bom: { ...bom, fingerprint: bomFingerprint },
    integrity
  };
}

function compactQuotePricing(specification) {
  const pricing = specification.pricing;
  if (pricing?.available !== true) {
    return {
      available: false,
      status: specification.pricingStatus || "unavailable",
      currency: "USD",
      total: null,
      source: pricing?.source || null,
      basis: pricing?.basis || null,
      aggregation: pricing?.aggregation || null,
      installations: []
    };
  }
  return {
    available: true,
    status: specification.pricingStatus || "canonical",
    currency: "USD",
    total: finiteOrNull(pricing.total),
    source: pricing.source || null,
    basis: pricing.basis || null,
    aggregation: pricing.aggregation || null,
    installations: (pricing.installations || []).map((installation) => {
      const breakdown = installation.breakdown || {};
      return {
        installationId: installation.installationId || null,
        zoneId: installation.zoneId || null,
        pricingVersion: installation.pricingVersion || breakdown.pricingVersion || null,
        basis: installation.basis || breakdown.basis || null,
        total: finiteOrNull(installation.total),
        lineItems: (breakdown.lineItems || []).map((item) => {
          const compactItem = {
            code: item.code || null,
            label: item.label || null,
            quantity: finiteOrNull(item.quantity),
            unit: item.unit || null,
            unitRate: finiteOrNull(item.unitRate),
            amount: finiteOrNull(item.amount)
          };
          if (Number.isFinite(item.thicknessIn)) {
            compactItem.thicknessIn = item.thicknessIn;
          }
          return compactItem;
        }),
        subtotalBeforeMultipliers: finiteOrNull(breakdown.subtotalBeforeMultipliers),
        multipliers: clone(breakdown.multipliers || {}),
        subtotal: finiteOrNull(breakdown.subtotal),
        minimumApplied: breakdown.minimumApplied === true,
        roundingIncrement: finiteOrNull(breakdown.roundingIncrement)
      };
    })
  };
}

function compactQuoteWarnings(warnings) {
  const items = (Array.isArray(warnings) ? warnings : []).map((warning) => clone(warning));
  return { count: items.length, items };
}

function compactQuoteBom(specification) {
  const descriptorSets = Array.isArray(specification.product?.descriptorSets)
    ? specification.product.descriptorSets
    : [];
  const renderEntries = Array.isArray(specification.product?.renderManifest?.entries)
    ? specification.product.renderManifest.entries
    : [];
  const pricingByInstallation = new Map(
    (specification.pricing?.installations || []).map((installation) => [
      installation.installationId,
      installation.breakdown?.bom || null
    ])
  );
  const installations = descriptorSets.map((set) => {
    const components = renderEntries.filter((entry) => entry.descriptorSetId === set.id);
    const customerEquipment = components.filter(isCustomerEquipment);
    const canonicalBom = pricingByInstallation.get(set.installationId);
    return {
      descriptorSetId: set.id || null,
      installationId: set.installationId || null,
      zoneId: set.zoneId || null,
      descriptorFingerprint: createHash("jq-guided-quote-bom-installation-v1", components),
      componentCount: components.length,
      billableComponentCount: Math.max(0, components.length - customerEquipment.length),
      customerEquipmentCount: customerEquipment.length,
      byRole: countComponentsByRole(components),
      canonical: compactCanonicalBom(canonicalBom)
    };
  });
  const components = renderEntries;
  const customerEquipmentCount = components.filter(isCustomerEquipment).length;
  return {
    source: "regenerated-accepted-render-descriptor-graph",
    componentCount: components.length,
    billableComponentCount: Math.max(0, components.length - customerEquipmentCount),
    customerEquipmentCount,
    byRole: countComponentsByRole(components),
    installations
  };
}

function compactCanonicalBom(bom) {
  if (!bom || typeof bom !== "object") return null;
  const acceptedDescriptorGraph = bom.acceptedDescriptorGraph;
  return {
    schemaVersion: bom.schemaVersion || null,
    layoutFingerprint: bom.layoutFingerprint || null,
    overall: clone(bom.overall || null),
    sections: clone(bom.sections || null),
    shelves: clone(bom.shelves || null),
    countertops: clone(bom.countertops || null),
    doors: clone(bom.doors || null),
    drawers: clone(bom.drawers || null),
    hardware: {
      handleCount: finiteOrNull(bom.hardware?.handleCount),
      byType: clone(bom.hardware?.byType || {})
    },
    lighting: clone(bom.lighting || null),
    trim: clone(bom.trim || null),
    openings: clone(bom.openings || null),
    acceptedDescriptorGraph: acceptedDescriptorGraph ? {
      schemaVersion: acceptedDescriptorGraph.schemaVersion || null,
      source: acceptedDescriptorGraph.source || null,
      componentCount: finiteOrNull(acceptedDescriptorGraph.componentCount),
      byRole: clone(acceptedDescriptorGraph.byRole || {}),
      customerEquipmentCount: Array.isArray(acceptedDescriptorGraph.customerEquipmentIds)
        ? acceptedDescriptorGraph.customerEquipmentIds.length
        : 0
    } : null
  };
}

function countComponentsByRole(components) {
  const counts = new Map();
  for (const component of components) {
    const role = typeof component?.role === "string" && component.role ? component.role : "unknown";
    counts.set(role, (counts.get(role) || 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function isCustomerEquipment(component) {
  return component?.role === "screen" || component?.metadata?.customerOwned === true;
}

function createRegenerationContract(specification) {
  return {
    topologyFingerprint: createHash("jq-guided-snapshot-room-v1", specification.room),
    fitFingerprint: createHash("jq-guided-snapshot-fit-v1", specification.fit),
    descriptorFingerprint: createHash(
      "jq-guided-snapshot-descriptors-v1",
      specification.product?.descriptorSets || []
    ),
    materialFingerprint: createHash("jq-guided-snapshot-materials-v1", {
      specification: specification.materialState || null,
      product: specification.product?.materialState || null
    }),
    cameraFingerprint: createHash("jq-guided-snapshot-camera-v1", {
      room: specification.room?.cameraIntent || null,
      product: specification.product?.topologyRef?.cameraIntent || null
    })
  };
}

function createAcceptedSummary(specification) {
  const installations = Array.isArray(specification.fit?.installations)
    ? specification.fit.installations
    : specification.fit?.accepted ? [specification.fit] : [];
  const tv = specification.product?.tv;
  return {
    installations: installations.map((installation) => ({
      zoneId: installation.zoneId || null,
      role: installation.role || null,
      casework: {
        width: finiteOrNull(installation.casework?.width),
        overallHeight: finiteOrNull(installation.casework?.overallHeight),
        depth: finiteOrNull(installation.casework?.depth)
      },
      treatments: {
        left: compactTreatment(installation.treatments?.left, "width"),
        right: compactTreatment(installation.treatments?.right, "width"),
        base: compactTreatment(installation.treatments?.base, "height"),
        top: compactTreatment(installation.treatments?.top, "height")
      }
    })),
    tv: tv?.accepted ? {
      accepted: true,
      body: {
        width: finiteOrNull(tv.body?.width),
        height: finiteOrNull(tv.body?.height)
      },
      opening: {
        width: finiteOrNull(tv.opening?.width),
        height: finiteOrNull(tv.opening?.height)
      }
    } : null
  };
}

function compactTreatment(treatment, dimension) {
  if (!treatment) return null;
  return {
    kind: typeof treatment.kind === "string" ? treatment.kind : "none",
    [dimension]: finiteOrNull(treatment[dimension])
  };
}

function finiteOrNull(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function createGuidedSelectionFingerprint(project = {}) {
  return createHash("jq-guided-selection-v1", createMaterialState(project));
}

function createMaterialState(project) {
  return {
    finish: project.finish || "natural-oak",
    accentFinish: project.accentFinish || "no-accent",
    doorStyle: project.doorStyle || null,
    hardware: project.hardware || null,
    lighting: project.lighting || null,
    baseStyle: project.baseStyle || null,
    topTreatment: project.topTreatment || null
  };
}

function rejectStage(stage, errors = [], artifacts = {}) {
  return deepFreeze({
    accepted: false,
    schemaVersion: GUIDED_ACCEPTED_SPECIFICATION_SCHEMA_VERSION,
    engineVersion: GUIDED_PROJECT_ENGINE_VERSION,
    stage,
    errors: dedupeDiagnostics(errors),
    warnings: dedupeDiagnostics([
      ...(artifacts.room?.warnings || []),
      ...(artifacts.fit?.warnings || []),
      ...(artifacts.product?.warnings || [])
    ]),
    ...artifacts
  });
}

function dedupeDiagnostics(items) {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).filter((item) => {
    const key = `${item?.code || "UNKNOWN"}|${item?.message || ""}|${item?.componentId || ""}|${item?.zoneId || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((item) => ({ ...item }));
}

function createHash(prefix, value) {
  const source = stableStringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${prefix}-${(hash >>> 0).toString(36).padStart(7, "0")}`;
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => (
    `${JSON.stringify(key)}:${stableStringify(value[key])}`
  )).join(",")}}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
