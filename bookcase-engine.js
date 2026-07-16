import {
  CONSTRUCTION_PROFILE_IDS,
  migrateLegacyConstructionConfig,
  normalizeBookcaseConfig
} from "./bookcase-config.js?v=engine-polish-20260716a";
import { generateBookcaseLayout } from "./bookcase-layout.js?v=engine-polish-20260716a";
import {
  createLayoutFingerprint,
  createLegacyLayoutFingerprint
} from "./bookcase-bom.js?v=engine-polish-20260716a";
import {
  PRICING_VERSION,
  PRICING_RATES,
  calculateBookcasePriceBreakdown
} from "./bookcase-pricing.js?v=engine-polish-20260716a";
import { HARDWARE_CATALOG_VERSION } from "./hardware-catalog.js?v=engine-polish-20260716a";

export const ENGINE_VERSION = "2026.07-direct-hardware-v2";
export const DESIGN_SCHEMA_VERSION = 5;
export const DESIGN_SELECTION_FINGERPRINT_VERSION = 2;
const SCHEMA_FOUR_PRICING_VERSIONS = new Set([
  "2026.07-bom-v1",
  "2026.07-physical-components-v2",
  "2026.07-hardware-catalog-v2",
  PRICING_VERSION
]);

/**
 * Evaluate a customer change without mutating the currently accepted design.
 * Callers commit the returned artifacts only when accepted is true.
 */
export function evaluateBookcaseCandidate(input = {}, options = {}) {
  const requestedState = normalizeBookcaseConfig(input);
  // Generate the first candidate from the raw request so layout-owned
  // normalization can report structured corrections for section metadata.
  const requestedLayout = generateBookcaseLayout(input, options.layoutOptions || {});
  const candidateState = normalizeBookcaseConfig({
    ...requestedState,
    ...(requestedLayout.config || {})
  });

  if (!requestedLayout.validation?.valid) {
    return rejection({
      requestedState,
      candidateState,
      requestedLayout,
      corrections: requestedLayout.corrections || [],
      errors: requestedLayout.validation?.errors || []
    });
  }

  // Rebuild from the applied canonical state so controls, geometry, pricing,
  // save data, and future reloads all start from the exact same state.
  const layout = generateBookcaseLayout(candidateState, options.layoutOptions || {});
  if (!layout.validation?.valid) {
    return rejection({
      requestedState,
      candidateState,
      requestedLayout,
      corrections: requestedLayout.corrections || [],
      errors: layout.validation?.errors || []
    });
  }

  const pricing = calculateBookcasePriceBreakdown(candidateState, layout);
  if (!pricing.valid) {
    return rejection({
      requestedState,
      candidateState,
      requestedLayout,
      corrections: requestedLayout.corrections || [],
      errors: pricing.errors || []
    });
  }

  return {
    accepted: true,
    engineVersion: ENGINE_VERSION,
    requestedState,
    state: pricing.state,
    requestedLayout,
    layout,
    layoutFingerprint: pricing.bom.layoutFingerprint,
    bom: pricing.bom,
    pricing,
    corrections: requestedLayout.corrections || [],
    errors: [],
    warnings: [
      ...(layout.validation?.warnings || []),
      ...normalizeMigrationWarnings(pricing.state.hardwareSelections?.migrationWarnings)
    ]
  };
}

/**
 * Fingerprint accepted selections that are intentionally outside the physical
 * descriptor graph. Physical geometry/hardware/lighting is already covered by
 * layoutFingerprint; this key covers finish and fulfillment selections.
 */
export function createDesignSelectionFingerprint(config = {}) {
  const state = normalizeBookcaseConfig(config);
  const finish = state.finish === "custom_bm"
    ? {
        finish: state.finish,
        customPaintColor: state.customPaintColor,
        customPaintCode: state.customPaintCode,
        customPaintHex: state.customPaintHex
      }
    : { finish: state.finish };
  const source = stableStringify({
    fingerprintVersion: DESIGN_SELECTION_FINGERPRINT_VERSION,
    finish,
    hardwareSelections: state.hardwareSelections,
    installation: state.installation,
    delivery: state.delivery
  });
  return `jq-selection-v${DESIGN_SELECTION_FINGERPRINT_VERSION}-${hashString(source)
    .toString(36)
    .toUpperCase()
    .padStart(7, "0")
    .slice(-7)}`;
}

/**
 * Build the only payload that should be persisted or forwarded to quoting.
 */
export function createAcceptedDesignSnapshot(evaluation, options = {}) {
  if (!evaluation?.accepted || !evaluation.layout?.validation?.valid || !evaluation.pricing?.valid) {
    throw new Error("Only an accepted evaluated design can be saved.");
  }

  const savedAt = options.savedAt || new Date().toISOString();
  const selectionFingerprint = createDesignSelectionFingerprint(evaluation.state);
  const id = options.id || createAcceptedDesignId(
    evaluation.layoutFingerprint,
    evaluation.pricing.total,
    evaluation.pricing.pricingVersion,
    selectionFingerprint
  );
  const hardwareSchedule = cloneArtifact(evaluation.bom.hardware?.schedule || []);

  return {
    schemaVersion: DESIGN_SCHEMA_VERSION,
    engineVersion: evaluation.engineVersion,
    pricingVersion: evaluation.pricing.pricingVersion,
    catalogVersion: evaluation.state.hardwareSelections?.catalogVersion || HARDWARE_CATALOG_VERSION,
    id,
    canonicalConfig: evaluation.state,
    layoutFingerprint: evaluation.layoutFingerprint,
    selectionFingerprint,
    bom: evaluation.bom,
    hardwareSchedule,
    hardwareSnapshots: hardwareSchedule.map((entry) => ({
      variantId: entry.variantId,
      factualSnapshot: cloneArtifact(entry.factualSnapshot)
    })),
    reviewWarnings: evaluation.warnings || [],
    priceBreakdown: serializePriceBreakdown(evaluation.pricing),
    total: evaluation.pricing.total,
    savedAt
  };
}

function cloneArtifact(value) {
  if (Array.isArray(value)) return value.map(cloneArtifact);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneArtifact(item)]));
}

export function createAcceptedDesignId(
  layoutFingerprint,
  total,
  pricingVersion = PRICING_VERSION,
  selectionFingerprint = ""
) {
  const source = [
    layoutFingerprint,
    pricingVersion,
    Number(total) || 0,
    selectionFingerprint
  ].join("|");
  return `JQ-${hashString(source).toString(36).toUpperCase().padStart(7, "0").slice(-7)}`;
}

/**
 * Regenerate and verify a saved design instead of trusting serialized geometry.
 */
export function restoreAcceptedDesignSnapshot(payload) {
  const sourceConfig = payload?.canonicalConfig || payload?.config || payload?.state;
  if (!sourceConfig || typeof sourceConfig !== "object") {
    return {
      accepted: false,
      compatible: false,
      errors: [{
        code: "MISSING_SAVED_CONFIG",
        severity: "error",
        message: "The saved design does not contain a restorable configuration."
      }]
    };
  }

  const payloadSchemaVersion = Number(payload?.schemaVersion) || 0;
  if (payloadSchemaVersion > DESIGN_SCHEMA_VERSION) {
    return {
      accepted: false,
      compatible: false,
      errors: [{
        code: "UNSUPPORTED_SAVED_SCHEMA",
        severity: "error",
        message: `Saved design schema ${payloadSchemaVersion} is newer than supported schema ${DESIGN_SCHEMA_VERSION}.`
      }]
    };
  }
  const savedConfigMigration = {
    migrated: !Object.prototype.hasOwnProperty.call(sourceConfig, "constructionProfile"),
    hardwareMigrated: !Object.prototype.hasOwnProperty.call(sourceConfig, "hardwareSelections"),
    sectionStorageMigrated: payloadSchemaVersion === 5
      && !Array.isArray(sourceConfig?.layoutMetadata?.sectionConfigs),
    config: migrateLegacyConstructionConfig(sourceConfig)
  };
  const evaluation = evaluateBookcaseCandidate(savedConfigMigration.config);
  if (!evaluation.accepted) {
    return { ...evaluation, compatible: false };
  }

  const expectedFingerprint = typeof payload.layoutFingerprint === "string"
    ? payload.layoutFingerprint
    : null;
  const selectionFingerprint = payloadSchemaVersion >= DESIGN_SCHEMA_VERSION
    ? createDesignSelectionFingerprint(evaluation.state)
    : createLegacyDesignSelectionFingerprint(evaluation.state);
  const expectedSelectionFingerprint = typeof payload.selectionFingerprint === "string"
    ? payload.selectionFingerprint
    : null;
  const savedArtifactIssue = payloadSchemaVersion >= DESIGN_SCHEMA_VERSION
    ? getSchemaFiveSavedArtifactIssue(payload, evaluation, expectedFingerprint, {
      selectionFingerprint,
      expectedSelectionFingerprint
    })
    : getSchemaFourSavedArtifactIssue(payload, evaluation, expectedFingerprint, {
    migrated: savedConfigMigration.migrated || savedConfigMigration.hardwareMigrated,
    selectionFingerprint,
    expectedSelectionFingerprint
  });
  const verifiedLegacySectionStorageSnapshot = savedConfigMigration.sectionStorageMigrated
    && verifyLegacySchemaFiveSectionStorageSnapshot({
      payload,
      evaluation,
      expectedFingerprint,
      expectedSelectionFingerprint,
      selectionFingerprint
    });
  const verifiedLegacyPricingMigration = payloadSchemaVersion === 4
    && isSchemaFourLegacyPricingMigration(payload, evaluation);
  if (savedArtifactIssue && !verifiedLegacySectionStorageSnapshot) {
    return {
      ...evaluation,
      accepted: false,
      compatible: false,
      errors: [savedArtifactIssue]
    };
  }
  const isLegacyDrawerProfileSave = !Object.prototype.hasOwnProperty.call(sourceConfig, "drawerFrontStyle");
  const legacyLayoutFingerprint = isLegacyDrawerProfileSave
    ? createLegacyLayoutFingerprint(evaluation.layout)
    : null;
  if (expectedSelectionFingerprint && expectedSelectionFingerprint !== selectionFingerprint) {
    return {
      ...evaluation,
      accepted: false,
      compatible: false,
      selectionFingerprint,
      errors: [{
        code: "SELECTION_FINGERPRINT_MISMATCH",
        severity: "error",
        message: "The saved finish or fulfillment selections no longer match the regenerated design."
      }]
    };
  }

  let matchedLayoutFingerprint = expectedFingerprint === evaluation.layoutFingerprint
    ? evaluation.layoutFingerprint
    : expectedFingerprint && expectedFingerprint === legacyLayoutFingerprint
      ? legacyLayoutFingerprint
      : null;
  if (!matchedLayoutFingerprint && verifiedLegacySectionStorageSnapshot) {
    matchedLayoutFingerprint = expectedFingerprint;
  }
  const verifiedLegacyConstructionSnapshot = !matchedLayoutFingerprint
    && (savedConfigMigration.migrated || savedConfigMigration.hardwareMigrated)
    && verifyLegacySchemaFourSnapshot({
      payload,
      evaluation,
      expectedFingerprint,
      expectedSelectionFingerprint,
      selectionFingerprint
    });
  if (verifiedLegacyConstructionSnapshot) matchedLayoutFingerprint = expectedFingerprint;
  if (expectedFingerprint && !matchedLayoutFingerprint) {
    return {
      ...evaluation,
      accepted: false,
      compatible: false,
      errors: [{
        code: "LAYOUT_FINGERPRINT_MISMATCH",
        severity: "error",
        message: "The saved design was created by an incompatible geometry result and must be reviewed."
      }]
    };
  }

  const regeneratedId = createAcceptedDesignId(
    matchedLayoutFingerprint || evaluation.layoutFingerprint,
    verifiedLegacyPricingMigration ? payload.total : evaluation.pricing.total,
    payloadSchemaVersion >= DESIGN_SCHEMA_VERSION
      ? evaluation.pricing.pricingVersion
      : payload.pricingVersion || evaluation.pricing.pricingVersion,
    selectionFingerprint
  );
  if (
    expectedSelectionFingerprint &&
    typeof payload.id === "string" &&
    payload.id !== regeneratedId &&
    !verifiedLegacySectionStorageSnapshot
  ) {
    return {
      ...evaluation,
      accepted: false,
      compatible: false,
      selectionFingerprint,
      errors: [{
        code: "DESIGN_ID_MISMATCH",
        severity: "error",
        message: "The saved design ID does not match its regenerated accepted artifacts."
      }]
    };
  }

  return {
    ...evaluation,
    compatible: true,
    selectionFingerprint,
    ...(savedConfigMigration.migrated || savedConfigMigration.hardwareMigrated || verifiedLegacySectionStorageSnapshot || verifiedLegacyPricingMigration ? {
      migration: {
        ...(savedConfigMigration.migrated ? {
          constructionProfile: CONSTRUCTION_PROFILE_IDS.legacyOverlay,
          preservedLegacyDoorArrangements: true
        } : {}),
        ...(savedConfigMigration.hardwareMigrated ? {
          hardwareSelectionsSchemaVersion: 1,
          preservedLegacyHardwareProjection: true,
          hardwareWarnings: evaluation.state.hardwareSelections?.migrationWarnings || []
        } : {}),
        ...(verifiedLegacySectionStorageSnapshot ? {
          sectionStorageSchemaVersion: 1,
          preservedLegacySectionIntent: true,
          repricedFromVerifiedSchemaFive: Number(payload.total) !== evaluation.pricing.total
        } : {}),
        ...(verifiedLegacyPricingMigration ? {
          priorPricingVersion: payload.pricingVersion,
          pricingVersion: evaluation.pricing.pricingVersion,
          repricedFromVerifiedSchemaFour: Number(payload.total) !== evaluation.pricing.total
        } : {}),
        verifiedPriorLayoutFingerprint: verifiedLegacyConstructionSnapshot || verifiedLegacySectionStorageSnapshot
      }
    } : {}),
    errors: []
  };
}

/**
 * Schema-5 records created before sectionConfigs are accepted only after their
 * complete stored identity chain and all unaffected generated quantities are
 * verified. The accepted state is then regenerated with section-local
 * defaults, corrected fixed-panel geometry, and current pricing.
 */
function verifyLegacySchemaFiveSectionStorageSnapshot({
  payload,
  evaluation,
  expectedFingerprint,
  expectedSelectionFingerprint,
  selectionFingerprint
}) {
  if (Number(payload?.schemaVersion) !== 5) return false;
  const sourceConfig = payload?.canonicalConfig || payload?.config || payload?.state;
  if (Array.isArray(sourceConfig?.layoutMetadata?.sectionConfigs)) return false;
  if (!/^jq-layout-v1-[0-9a-f]{16}$/.test(expectedFingerprint || "")) return false;
  if (payload?.bom?.layoutFingerprint !== expectedFingerprint) return false;
  if (!expectedSelectionFingerprint || expectedSelectionFingerprint !== selectionFingerprint) return false;
  if (payload?.catalogVersion !== (evaluation.state.hardwareSelections?.catalogVersion || HARDWARE_CATALOG_VERSION)) return false;
  if (payload?.priceBreakdown?.pricingVersion !== payload?.pricingVersion) return false;
  if (Number(payload?.priceBreakdown?.total) !== Number(payload?.total)) return false;
  if (typeof payload?.id !== "string") return false;
  const expectedId = createAcceptedDesignId(
    expectedFingerprint,
    payload.total,
    payload.pricingVersion,
    expectedSelectionFingerprint
  );
  if (payload.id !== expectedId) return false;
  const schedule = evaluation.bom.hardware?.schedule || [];
  if (!Array.isArray(payload?.hardwareSchedule)
    || stableStringify(payload.hardwareSchedule) !== stableStringify(schedule)) return false;
  const snapshots = schedule.map((entry) => ({
    variantId: entry.variantId,
    factualSnapshot: entry.factualSnapshot
  }));
  if (!Array.isArray(payload?.hardwareSnapshots)
    || stableStringify(payload.hardwareSnapshots) !== stableStringify(snapshots)) return false;
  return stableStringify(getSectionStorageMigrationBomSignature(payload.bom))
    === stableStringify(getSectionStorageMigrationBomSignature(evaluation.bom));
}

function getSectionStorageMigrationBomSignature(bom = {}) {
  return {
    overall: {
      widthIn: bom.overall?.widthIn,
      heightIn: bom.overall?.heightIn,
      depthIn: bom.overall?.depthIn
    },
    sections: {
      count: bom.sections?.count,
      clearWidthsIn: bom.sections?.clearWidthsIn
    },
    doors: bom.doors,
    drawers: {
      frontCount: bom.drawers?.frontCount,
      totalFrontAreaSqIn: bom.drawers?.totalFrontAreaSqIn,
      byStyle: bom.drawers?.byStyle || {}
    },
    hardware: {
      handleCount: bom.hardware?.handleCount,
      byType: bom.hardware?.byType || {}
    },
    trim: bom.trim,
    openings: bom.openings
  };
}

/**
 * Schema 5 snapshots are verified against every regenerated canonical
 * artifact. Serialized geometry is never trusted; factual hardware snapshots
 * are retained only as an auditable/restorable schedule.
 */
function getSchemaFiveSavedArtifactIssue(
  payload,
  evaluation,
  expectedFingerprint,
  { selectionFingerprint, expectedSelectionFingerprint }
) {
  if (Number(payload?.schemaVersion) < DESIGN_SCHEMA_VERSION) return null;
  if (!expectedFingerprint || payload?.bom?.layoutFingerprint !== expectedFingerprint) {
    return {
      code: "LAYOUT_FINGERPRINT_MISMATCH",
      severity: "error",
      message: "The saved layout fingerprint and serialized BOM do not identify the same accepted geometry."
    };
  }
  if (!expectedSelectionFingerprint) {
    return {
      code: "SAVED_SELECTION_FINGERPRINT_MISSING",
      severity: "error",
      message: "The saved design is missing its required selection fingerprint."
    };
  }
  if (expectedSelectionFingerprint !== selectionFingerprint) {
    return {
      code: "SELECTION_FINGERPRINT_MISMATCH",
      severity: "error",
      message: "The saved finish, fulfillment, or per-host hardware selections no longer match the regenerated design."
    };
  }
  const catalogVersion = evaluation.state.hardwareSelections?.catalogVersion || HARDWARE_CATALOG_VERSION;
  if (payload?.catalogVersion !== catalogVersion) {
    return {
      code: "HARDWARE_CATALOG_VERSION_MISMATCH",
      severity: "error",
      message: "The saved hardware catalog version does not match its canonical selection snapshots."
    };
  }
  if (
    payload?.pricingVersion !== evaluation.pricing.pricingVersion
    || Number(payload?.total) !== evaluation.pricing.total
    || stableStringify(payload?.priceBreakdown) !== stableStringify(serializePriceBreakdown(evaluation.pricing))
  ) {
    return {
      code: "SAVED_PRICING_MISMATCH",
      severity: "error",
      message: "The saved price artifacts do not match the regenerated accepted design."
    };
  }
  if (stableStringify(payload?.bom) !== stableStringify(evaluation.bom)) {
    return {
      code: "SAVED_BOM_MISMATCH",
      severity: "error",
      message: "The saved BOM and exact hardware schedule do not match the regenerated accepted design."
    };
  }
  const schedule = evaluation.bom.hardware?.schedule || [];
  if (!Array.isArray(payload?.hardwareSchedule)
    || stableStringify(payload.hardwareSchedule) !== stableStringify(schedule)) {
    return {
      code: "SAVED_HARDWARE_SCHEDULE_MISMATCH",
      severity: "error",
      message: "The saved denormalized hardware schedule does not match the regenerated design."
    };
  }
  const expectedSnapshots = schedule.map((entry) => ({
    variantId: entry.variantId,
    factualSnapshot: entry.factualSnapshot
  }));
  if (!Array.isArray(payload?.hardwareSnapshots)
    || stableStringify(payload.hardwareSnapshots) !== stableStringify(expectedSnapshots)) {
    return {
      code: "SAVED_HARDWARE_SNAPSHOT_MISMATCH",
      severity: "error",
      message: "The saved hardware factual snapshots do not match the accepted schedule."
    };
  }
  if (!Array.isArray(payload?.reviewWarnings)
    || stableStringify(payload.reviewWarnings) !== stableStringify(evaluation.warnings || [])) {
    return {
      code: "SAVED_REVIEW_WARNINGS_MISMATCH",
      severity: "error",
      message: "The saved review warnings do not match the regenerated accepted design."
    };
  }
  if (typeof payload?.id !== "string") {
    return {
      code: "SAVED_DESIGN_ID_MISSING",
      severity: "error",
      message: "The saved design is missing its required deterministic ID."
    };
  }
  const expectedId = createAcceptedDesignId(
    expectedFingerprint,
    evaluation.pricing.total,
    evaluation.pricing.pricingVersion,
    expectedSelectionFingerprint
  );
  if (payload.id !== expectedId) {
    return {
      code: "DESIGN_ID_MISMATCH",
      severity: "error",
      message: "The saved design ID does not match its serialized accepted artifacts."
    };
  }
  return null;
}

/**
 * Construction V1 intentionally changes descriptor metadata and corrected
 * base geometry, so a pre-profile schema-4 fingerprint cannot always be
 * reproduced from the new graph. Compatibility remains bounded to a complete
 * accepted schema-4 snapshot whose saved ID, selection fingerprint, BOM
 * quantities, pricing version, and full serialized price breakdown all verify.
 */
function verifyLegacySchemaFourSnapshot({
  payload,
  evaluation,
  expectedFingerprint,
  expectedSelectionFingerprint,
  selectionFingerprint
}) {
  if (Number(payload?.schemaVersion) !== 4) return false;
  if (!/^jq-layout-v1-[0-9a-f]{16}$/.test(expectedFingerprint || "")) return false;
  const earlySchemaFour = isEarlySchemaFourSnapshot(payload, expectedSelectionFingerprint);
  if (!earlySchemaFour && (!expectedSelectionFingerprint || expectedSelectionFingerprint !== selectionFingerprint)) {
    return false;
  }
  if (payload?.bom?.layoutFingerprint !== expectedFingerprint) return false;
  if (!schemaFourPricingArtifactsMatch(payload, evaluation)) return false;
  if (stableStringify(getLegacyBomCompatibilitySignature(payload.bom))
    !== stableStringify(getLegacyBomCompatibilitySignature(evaluation.bom))) return false;
  if (typeof payload?.id !== "string") return false;
  const expectedId = earlySchemaFour
    ? createEarlySchemaFourDesignId(expectedFingerprint, payload.total, payload.pricingVersion)
    : createAcceptedDesignId(
      expectedFingerprint,
      payload.total,
      payload.pricingVersion,
      expectedSelectionFingerprint
    );
  return payload.id === expectedId;
}

function getSchemaFourSavedArtifactIssue(
  payload,
  evaluation,
  expectedFingerprint,
  { migrated, selectionFingerprint, expectedSelectionFingerprint }
) {
  if (Number(payload?.schemaVersion) !== 4) return null;
  if (!expectedFingerprint || payload?.bom?.layoutFingerprint !== expectedFingerprint) {
    return {
      code: "LAYOUT_FINGERPRINT_MISMATCH",
      severity: "error",
      message: "The saved layout fingerprint and serialized BOM do not identify the same accepted geometry."
    };
  }
  const pricingMatches = schemaFourPricingArtifactsMatch(payload, evaluation);
  if (!pricingMatches) {
    return {
      code: "SAVED_PRICING_MISMATCH",
      severity: "error",
      message: "The saved price artifacts do not match the regenerated accepted design."
    };
  }
  const earlySchemaFour = isEarlySchemaFourSnapshot(payload, expectedSelectionFingerprint);
  if (!earlySchemaFour && !expectedSelectionFingerprint) {
    return {
      code: "SAVED_SELECTION_FINGERPRINT_MISSING",
      severity: "error",
      message: "The saved design is missing its required selection fingerprint."
    };
  }
  if (expectedSelectionFingerprint && expectedSelectionFingerprint !== selectionFingerprint) {
    return {
      code: "SELECTION_FINGERPRINT_MISMATCH",
      severity: "error",
      message: "The saved finish or fulfillment selections no longer match the regenerated design."
    };
  }
  if (typeof payload?.id !== "string") {
    return {
      code: "SAVED_DESIGN_ID_MISSING",
      severity: "error",
      message: "The saved design is missing its required deterministic ID."
    };
  }
  const expectedId = earlySchemaFour
    ? createEarlySchemaFourDesignId(expectedFingerprint, payload.total, payload.pricingVersion)
    : createAcceptedDesignId(
      expectedFingerprint,
      payload.total,
      payload.pricingVersion,
      expectedSelectionFingerprint
    );
  if (payload.id !== expectedId) {
    return {
      code: "DESIGN_ID_MISMATCH",
      severity: "error",
      message: "The saved design ID does not match its serialized accepted artifacts."
    };
  }
  const regeneratedBom = { ...evaluation.bom, layoutFingerprint: expectedFingerprint };
  const bomMatches = migrated
    ? stableStringify(getLegacyBomCompatibilitySignature(payload.bom))
      === stableStringify(getLegacyBomCompatibilitySignature(evaluation.bom))
    : stableStringify(payload.bom) === stableStringify(regeneratedBom);
  if (!bomMatches) {
    return {
      code: "SAVED_BOM_MISMATCH",
      severity: "error",
      message: "The saved BOM does not match the regenerated accepted design."
    };
  }
  return null;
}

function getLegacyBomCompatibilitySignature(bom = {}) {
  const specialByKind = Object.fromEntries(
    Object.entries(bom.openings?.specialByKind || {})
      .filter(([kind]) => kind !== "toe_kick_void")
  );
  return {
    schemaVersion: bom.schemaVersion,
    overall: {
      widthIn: bom.overall?.widthIn,
      heightIn: bom.overall?.heightIn,
      depthIn: bom.overall?.depthIn
    },
    sections: {
      count: bom.sections?.count,
      clearWidthsIn: bom.sections?.clearWidthsIn
    },
    shelves: {
      adjustableCount: bom.shelves?.adjustableCount,
      fixedCount: bom.shelves?.fixedCount,
      byThicknessIn: bom.shelves?.byThicknessIn
    },
    doors: bom.doors,
    drawers: {
      frontCount: bom.drawers?.frontCount,
      totalFrontAreaSqIn: bom.drawers?.totalFrontAreaSqIn,
      byStyle: bom.drawers?.byStyle || {}
    },
    hardware: {
      handleCount: bom.hardware?.handleCount,
      byType: bom.hardware?.byType || {}
    },
    lighting: bom.lighting,
    openings: {
      ...bom.openings,
      specialByKind
    }
  };
}

function isEarlySchemaFourSnapshot(payload, expectedSelectionFingerprint) {
  return payload?.engineVersion === "2026.07-hardening-v1" && !expectedSelectionFingerprint;
}

function createEarlySchemaFourDesignId(layoutFingerprint, total, pricingVersion = PRICING_VERSION) {
  const source = `${layoutFingerprint}|${pricingVersion}|${Number(total) || 0}`;
  return `JQ-${hashString(source).toString(36).toUpperCase().padStart(7, "0").slice(-7)}`;
}

function createLegacyDesignSelectionFingerprint(config = {}) {
  const state = normalizeBookcaseConfig(config);
  const finish = state.finish === "custom_bm"
    ? {
        finish: state.finish,
        customPaintColor: state.customPaintColor,
        customPaintCode: state.customPaintCode,
        customPaintHex: state.customPaintHex
      }
    : { finish: state.finish };
  const source = stableStringify({
    fingerprintVersion: 1,
    finish,
    installation: state.installation,
    delivery: state.delivery
  });
  return `jq-selection-v1-${hashString(source)
    .toString(36)
    .toUpperCase()
    .padStart(7, "0")
    .slice(-7)}`;
}

function legacyPriceBreakdownsMatch(saved, regenerated) {
  if (!saved || !regenerated) return false;
  const normalize = (value) => {
    const result = { ...value };
    delete result.pricingVersion;
    delete result.hardwarePricing;
    return result;
  };
  return stableStringify(normalize(saved)) === stableStringify(normalize(regenerated));
}

function schemaFourPricingArtifactsMatch(payload, evaluation) {
  if (!SCHEMA_FOUR_PRICING_VERSIONS.has(payload?.pricingVersion)) return false;
  if (payload?.priceBreakdown?.pricingVersion !== payload.pricingVersion) return false;
  if (Number(payload?.priceBreakdown?.total) !== Number(payload?.total)) return false;
  const current = serializePriceBreakdown(evaluation.pricing);
  if (
    Number(payload.total) === Number(current.total)
    && legacyPriceBreakdownsMatch(payload.priceBreakdown, current)
  ) return true;
  const prior = createDrawerFreeLegacyPriceBreakdown(evaluation.pricing, payload.pricingVersion);
  return Number(payload.total) === Number(prior.total)
    && legacyPriceBreakdownsMatch(payload.priceBreakdown, prior);
}

function isSchemaFourLegacyPricingMigration(payload, evaluation) {
  return payload?.pricingVersion !== evaluation.pricing.pricingVersion
    && schemaFourPricingArtifactsMatch(payload, evaluation);
}

function createDrawerFreeLegacyPriceBreakdown(pricing, pricingVersion) {
  const lineItems = (pricing.lineItems || []).filter((item) => item.code !== "DRAWER_FRONTS");
  const subtotalBeforeMultipliers = roundSavedCurrency(
    lineItems.reduce((total, item) => total + (Number(item.amount) || 0), 0)
  );
  const depthMultiplier = Number(pricing.multipliers?.depth) || 1;
  const finishMultiplier = Number(pricing.multipliers?.finish) || 1;
  const subtotal = roundSavedCurrency(subtotalBeforeMultipliers * depthMultiplier * finishMultiplier);
  const roundingIncrement = Number(pricing.roundingIncrement) || PRICING_RATES.roundingIncrement;
  const total = Math.round(
    Math.max(PRICING_RATES.minimumProjectTotal, subtotal) / roundingIncrement
  ) * roundingIncrement;
  return {
    pricingVersion,
    lineItems,
    subtotalBeforeMultipliers,
    multipliers: { depth: depthMultiplier, finish: finishMultiplier },
    subtotal,
    minimumApplied: subtotal < PRICING_RATES.minimumProjectTotal,
    roundingIncrement,
    hardwarePricing: pricing.hardwarePricing,
    total
  };
}

function roundSavedCurrency(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function normalizeMigrationWarnings(value) {
  if (!Array.isArray(value)) return [];
  return value.map((warning) => ({
    code: typeof warning === "object" && warning?.code ? warning.code : "LEGACY_HARDWARE_REVIEW",
    severity: "warning",
    componentId: null,
    relatedId: null,
    message: typeof warning === "object" && warning?.message
      ? warning.message
      : String(warning)
  }));
}

function rejection({ requestedState, candidateState, requestedLayout, corrections, errors }) {
  return {
    accepted: false,
    engineVersion: ENGINE_VERSION,
    requestedState,
    state: null,
    candidateState,
    requestedLayout,
    layout: null,
    layoutFingerprint: null,
    bom: null,
    pricing: null,
    corrections,
    errors,
    warnings: requestedLayout.validation?.warnings || []
  };
}

function serializePriceBreakdown(pricing) {
  return {
    pricingVersion: pricing.pricingVersion,
    lineItems: pricing.lineItems,
    subtotalBeforeMultipliers: pricing.subtotalBeforeMultipliers,
    multipliers: pricing.multipliers,
    subtotal: pricing.subtotal,
    minimumApplied: pricing.minimumApplied,
    roundingIncrement: pricing.roundingIncrement,
    hardwarePricing: pricing.hardwarePricing,
    total: pricing.total
  };
}

function stableStringify(value) {
  return JSON.stringify(sortValue(value));
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map((item) => sortValue(item));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortValue(value[key])])
  );
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// Exported for tests and migration diagnostics.
export function fingerprintAcceptedState(config) {
  const evaluation = evaluateBookcaseCandidate(config);
  return evaluation.accepted ? createLayoutFingerprint(evaluation.layout) : null;
}
