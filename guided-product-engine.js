import { evaluateBookcaseCandidate } from "./bookcase-engine.js?v=tv-drawing-4-geometry-v1-20260802a";
import {
  PRICING_RATES,
  calculateBookcasePriceBreakdown
} from "./bookcase-pricing.js?v=tv-drawing-4-geometry-v1-20260802a";
import {
  boundsIntersect,
  resolveMdfShelfThickness,
  validateBookcaseLayout
} from "./bookcase-layout.js?v=tv-drawing-4-geometry-v1-20260802a";
import {
  createExpectedRenderManifest,
  descriptorToSceneBounds,
  sceneBoundsCenter,
  sceneBoundsSize
} from "./bookcase-render-contract.js?v=engine-polish-20260716a";
import {
  GUIDED_PRODUCT_FAILURES,
  createGuidedProductCandidate
} from "./guided-product-adapter.js?v=tv-drawing-4-geometry-v1-20260802a";

export const GUIDED_PRODUCT_ENGINE_VERSION = "2026.08-tv-drawing-4-v1";
export const GUIDED_PRODUCT_DESCRIPTOR_SCHEMA_VERSION = 1;
export const GUIDED_GEOMETRY_FINGERPRINT_VERSION = 1;
export const GUIDED_RENDER_MANIFEST_VERSION = 1;

export const GUIDED_PRODUCT_ENGINE_FAILURES = deepFreeze({
  canonicalRejected: "CANONICAL_PRODUCT_ENGINE_REJECTED",
  canonicalDimensionDrift: "CANONICAL_ENGINE_CHANGED_FIT_DIMENSIONS",
  descriptorInvalid: "INVALID_PRODUCT_DESCRIPTOR_GRAPH",
  tvOpeningFit: "TV_OPENING_DOES_NOT_FIT",
  tvPricing: "TV_FINAL_DESCRIPTOR_PRICING_REJECTED",
  floatingZone: "FLOATING_STORAGE_EXCEEDS_ZONE",
  cornerJoin: "CORNER_JOIN_ENVELOPE_INVALID",
  windowFeature: "WINDOW_FEATURE_REQUIRED",
  windowHeight: "WINDOW_STORAGE_ZONE_TOO_SHORT",
  windowRadiator: "WINDOW_STORAGE_RADIATOR_ENVELOPE_UNSUPPORTED",
  radiatorFeature: "RADIATOR_FEATURE_REQUIRED",
  radiatorFit: "RADIATOR_SERVICE_ENVELOPE_DOES_NOT_FIT"
});

const RENDERABLE_ROLES = new Set([
  "base",
  "trim",
  "crown",
  "side_panel",
  "end_panel",
  "bottom_panel",
  "top_panel",
  "back_panel",
  "divider",
  "fixed_shelf",
  "shelf",
  "door",
  "drawer_front",
  "handle",
  "light",
  "filler",
  "fascia",
  "plinth",
  "screen",
  "soundbar",
  "equipment",
  "vent",
  "slat",
  "mounting_rail",
  "backing_panel"
]);

// Hardware and lighting remain accepted, priced render descriptors, but they
// are appearance fixtures rather than casework geometry. Their descriptors may
// change when a customer selects a knob, pull, lighting package, or no visible
// fixture at all. Excluding those roles from the physical fingerprint keeps the
// room-fit/casework identity stable while selection and pricing fingerprints
// continue to record the customer choice.
const APPEARANCE_FIXTURE_ROLES = new Set(["handle", "light"]);

/**
 * Evaluate one guided-product transaction without mutating the last accepted
 * model. The caller commits this result only when accepted is true.
 */
export function evaluateGuidedProductCandidate(input = {}) {
  const plan = createGuidedProductCandidate(input);
  if (!plan.accepted) return rejectionFrom(plan);

  const descriptorSets = [];
  const canonicalEvaluations = [];
  const warnings = clone(plan.warnings || []);
  const corrections = [];

  for (let index = 0; index < plan.installations.length; index += 1) {
    const installation = plan.installations[index];
    let built;
    if (installation.role === "corner-join") {
      built = buildCornerJoinDescriptorSet(plan, installation, index);
    } else if (plan.archetype.engine.startsWith("existing-bookcase")) {
      const canonical = plan.canonicalConfigs.find((item) => item.installationId === installation.id);
      built = buildCanonicalDescriptorSet(plan, installation, canonical?.config, index);
      if (built.accepted) {
        canonicalEvaluations.push({
          installationId: installation.id,
          zoneId: installation.zoneId,
          acceptedCaseworkWidthIn: installation.casework?.width,
          acceptedCaseworkDepthIn: installation.casework?.depth,
          evaluation: built.evaluation
        });
        warnings.push(...built.warnings);
        corrections.push(...built.corrections);
      }
    } else if (plan.productId === "floating-storage") {
      built = buildFloatingStorageDescriptorSet(plan, installation, index);
    } else if (plan.productId === "window-storage") {
      built = buildWindowStorageDescriptorSet(plan, installation, index);
    } else {
      built = buildRadiatorCoverDescriptorSet(plan, installation, index);
    }

    if (!built.accepted) {
      return rejectionFrom(built, {
        productId: plan.productId,
        layoutId: plan.layoutId,
        compatibility: plan.compatibility,
        warnings
      });
    }
    descriptorSets.push(built.descriptorSet);
    warnings.push(...(built.warnings || []));
  }

  const validationIssues = descriptorSets.flatMap((set) => set.validation.errors || []);
  if (validationIssues.length) {
    return reject(GUIDED_PRODUCT_ENGINE_FAILURES.descriptorInvalid, {
      message: "The generated product descriptor graph failed validation.",
      issues: validationIssues
    }, {
      productId: plan.productId,
      layoutId: plan.layoutId,
      compatibility: plan.compatibility,
      warnings
    });
  }

  const materialState = createMaterialState(plan.project, descriptorSets);
  const topologyRef = createTopologyRef(plan.topology);
  const fitRef = createFitRef(plan.fit, plan.installations);
  const fingerprintContext = {
    productId: plan.productId,
    layoutId: plan.layoutId,
    topologyRef,
    fitRef
  };
  const geometryFingerprint = createGuidedGeometryFingerprint(descriptorSets, fingerprintContext);
  const renderManifest = createGuidedRenderManifest(descriptorSets);
  const pricingResult = createPricingResult(canonicalEvaluations, descriptorSets);
  const canonicalConfigs = plan.canonicalConfigs.map((entry) => ({
    installationId: entry.installationId,
    zoneId: entry.zoneId,
    config: entry.config
  }));

  return deepFreeze({
    accepted: true,
    schemaVersion: GUIDED_PRODUCT_DESCRIPTOR_SCHEMA_VERSION,
    engineVersion: GUIDED_PRODUCT_ENGINE_VERSION,
    productId: plan.productId,
    layoutId: plan.layoutId,
    archetype: plan.archetype,
    engine: plan.archetype.engine,
    compatibility: plan.compatibility,
    topologyRef,
    fitRef,
    canonicalConfig: canonicalConfigs.length === 1 ? canonicalConfigs[0].config : null,
    canonicalConfigs,
    canonicalEvaluations,
    tv: plan.tv ? clone(plan.tv) : null,
    descriptorSets,
    geometryFingerprint,
    renderManifest,
    materialState,
    pricing: pricingResult.pricing,
    pricingStatus: pricingResult.status,
    warnings: uniqueIssues(warnings),
    corrections: uniqueIssues(corrections),
    errors: []
  });
}

// Transaction-oriented alias used by the guided accepted-specification layer.
export const createAcceptedGuidedProduct = evaluateGuidedProductCandidate;

export function createGuidedGeometryFingerprint(descriptorSets, context = {}) {
  const source = stableStringify({
    fingerprintVersion: GUIDED_GEOMETRY_FINGERPRINT_VERSION,
    schemaVersion: GUIDED_PRODUCT_DESCRIPTOR_SCHEMA_VERSION,
    productId: context.productId || null,
    layoutId: context.layoutId || null,
    topologyRef: geometryOnly(context.topologyRef || null),
    fitRef: geometryOnly(context.fitRef || null),
    descriptorSets: (Array.isArray(descriptorSets) ? descriptorSets : []).map((set) => {
      const physicalComponents = set.components
        .filter((component) => !APPEARANCE_FIXTURE_ROLES.has(component.role));
      return {
        id: set.id,
        installationId: set.installationId,
        zoneId: set.zoneId,
        units: set.units,
        localOrigin: set.localOrigin,
        rootScale: set.rootScale,
        transform: set.transform,
        bounds: set.physicalBounds || (physicalComponents.length
          ? unionBounds(physicalComponents.map((component) => component.bounds))
          : set.bounds),
        installationContract: geometryOnly(set.installationContract),
        components: physicalComponents.map((component) => ({
          id: component.id,
          role: component.role,
          parentId: component.parentId,
          hostId: component.hostId,
          bounds: component.bounds,
          metadata: geometryOnly(component.metadata || {})
        }))
      };
    })
  });
  return `jq-guided-geometry-v${GUIDED_GEOMETRY_FINGERPRINT_VERSION}-${fnv1a64(source)}`;
}

export function createGuidedRenderManifest(descriptorSets) {
  const entries = [];
  for (const set of Array.isArray(descriptorSets) ? descriptorSets : []) {
    for (const component of set.components || []) {
      if (!isRenderable(component)) continue;
      const sceneBounds = descriptorToSceneBounds(component, set.nominalDepth);
      entries.push({
        componentId: component.id,
        descriptorSetId: set.id,
        installationId: set.installationId,
        zoneId: set.zoneId,
        role: component.role,
        parentId: component.parentId,
        hostId: component.hostId,
        materialSlot: materialSlotFor(component),
        bounds: clone(component.bounds),
        sceneBounds,
        sceneSize: sceneBoundsSize(sceneBounds),
        sceneCenter: sceneBoundsCenter(sceneBounds),
        transform: clone(set.transform)
      });
    }
  }
  return deepFreeze({
    version: GUIDED_RENDER_MANIFEST_VERSION,
    units: "inches",
    rootScale: [1, 1, 1],
    expectedCount: entries.length,
    entries
  });
}

function buildCanonicalDescriptorSet(plan, installation, config, index) {
  if (!config) return reject(GUIDED_PRODUCT_ENGINE_FAILURES.canonicalRejected, {
    message: "The guided adapter did not provide canonical engine input."
  });
  const evaluation = evaluateBookcaseCandidate(config);
  if (!evaluation.accepted) {
    return reject(GUIDED_PRODUCT_ENGINE_FAILURES.canonicalRejected, {
      message: "The canonical bookcase engine rejected the fitted product candidate.",
      canonicalErrors: clone(evaluation.errors || [])
    });
  }

  const dimensions = installation.casework;
  const actual = evaluation.layout.config;
  if (
    !nearlyEqual(actual.width, dimensions.width) ||
    !nearlyEqual(actual.height, dimensions.overallHeight) ||
    !nearlyEqual(actual.depth, dimensions.depth)
  ) {
    return reject(GUIDED_PRODUCT_ENGINE_FAILURES.canonicalDimensionDrift, {
      message: "The canonical cabinet system cannot preserve this solved fit without changing its physical dimensions.",
      requested: {
        width: dimensions.width,
        height: dimensions.overallHeight,
        depth: dimensions.depth
      },
      canonical: { width: actual.width, height: actual.height, depth: actual.depth }
    });
  }

  let components = clone(evaluation.layout.components);
  let acceptedEvaluation = evaluation;
  if (plan.productId === "tv-unit") {
    const augmented = addTvContractDescriptors(components, evaluation.layout, plan.tv);
    if (!augmented.accepted) return augmented;
    // TV pricing records the final accepted descriptor graph. Promote the
    // solved installation treatments before that graph is counted so fillers,
    // finished ends, and any non-canonical fit trim are not omitted from its
    // auditable quantities.
    components = promoteInstallationTreatments(augmented.components, installation);
    const repriced = repriceFinalTvDescriptorGraph({
      evaluation,
      installation,
      index,
      components
    });
    if (!repriced.accepted) return repriced;
    acceptedEvaluation = repriced.evaluation;
  }

  const canonicalManifest = createExpectedRenderManifest(acceptedEvaluation.layout);
  const descriptorSet = createDescriptorSet({
    productId: plan.productId,
    installation,
    index,
    components,
    nominalDepth: evaluation.layout.config.depth,
    canonicalLayoutFingerprint: acceptedEvaluation.layoutFingerprint,
    canonicalRenderContract: {
      version: 2,
      expectedCount: canonicalManifest.length,
      componentIds: canonicalManifest.map((entry) => entry.componentId)
    }
  });

  return {
    accepted: true,
    descriptorSet,
    evaluation: acceptedEvaluation,
    warnings: clone(acceptedEvaluation.warnings || []),
    corrections: clone(acceptedEvaluation.corrections || [])
  };
}

function repriceFinalTvDescriptorGraph({ evaluation, installation, index, components }) {
  const descriptorSetId = createDescriptorSetId(installation, index);
  const generatedDoorCount = components.filter((item) => item.role === "door").length;
  const primaryDoorCount = components.filter((item) => (
    item.role === "door" && item.metadata?.tier === "primary"
  )).length;
  const generatedDrawerCount = components.filter((item) => item.role === "drawer_front").length;
  const constructionComponents = components.filter((item) => !(
    item.metadata?.installationTreatment && item.metadata?.reusesCanonicalComponent !== true
  ));
  const canonicalFinalLayout = {
    ...clone(evaluation.layout),
    config: {
      ...clone(evaluation.layout.config),
      doorCount: primaryDoorCount
    },
    metrics: {
      ...clone(evaluation.layout.metrics),
      generatedDoorCount,
      primaryDoorCount,
      generatedDrawerCount
    },
    components: clone(components),
    componentOrder: components.map((item) => item.id),
    sectionIds: components.filter((item) => item.role === "section").map((item) => item.id)
  };
  const canonicalValidationLayout = {
    ...canonicalFinalLayout,
    components: clone(constructionComponents),
    componentOrder: constructionComponents.map((item) => item.id),
    sectionIds: constructionComponents.filter((item) => item.role === "section").map((item) => item.id)
  };
  canonicalFinalLayout.validation = validateBookcaseLayout(canonicalValidationLayout);
  if (!canonicalFinalLayout.validation.valid) {
    return reject(GUIDED_PRODUCT_ENGINE_FAILURES.tvPricing, {
      installationId: installation.id,
      message: "The complete Drawing 4 descriptor graph failed canonical construction validation.",
      validationErrors: clone(canonicalFinalLayout.validation.errors || [])
    });
  }

  const finalComponents = namespaceComponents(
    canonicalFinalLayout.components,
    descriptorSetId,
    { namespaceMetadataIds: true }
  );
  const finalLayout = {
    ...canonicalFinalLayout,
    components: finalComponents,
    componentOrder: finalComponents.map((item) => item.id),
    sectionIds: finalComponents.filter((item) => item.role === "section").map((item) => item.id)
  };
  const pricing = calculateBookcasePriceBreakdown(evaluation.state, finalLayout);
  if (!pricing.valid) {
    return reject(GUIDED_PRODUCT_ENGINE_FAILURES.tvPricing, {
      installationId: installation.id,
      message: "The final accepted TV descriptor graph could not be priced by the canonical preliminary formula.",
      pricingErrors: clone(pricing.errors || [])
    });
  }

  const acceptedDescriptorGraph = createAcceptedDescriptorPricingQuantities(finalComponents);
  const finalBom = {
    ...clone(pricing.bom),
    acceptedDescriptorGraph
  };
  const finalPricing = {
    ...clone(pricing),
    basis: "final-accepted-descriptor-graph",
    acceptedDescriptorGraph,
    bom: finalBom
  };
  return {
    accepted: true,
    evaluation: {
      ...clone(evaluation),
      state: clone(finalPricing.state),
      layout: finalLayout,
      layoutFingerprint: finalBom.layoutFingerprint,
      bom: finalBom,
      pricing: finalPricing
    }
  };
}

function createAcceptedDescriptorPricingQuantities(components) {
  const customerEquipment = components.filter((item) => (
    item.role === "screen" || item.metadata?.customerOwned === true
  ));
  const customerEquipmentIds = new Set(customerEquipment.map((item) => item.id));
  const billable = components.filter((item) => (
    isRenderable(item) && !customerEquipmentIds.has(item.id)
  ));
  const roles = [...new Set(billable.map((item) => item.role))].sort();
  return {
    schemaVersion: 1,
    source: "final-accepted-descriptor-graph",
    componentCount: billable.length,
    byRole: Object.fromEntries(roles.map((role) => [
      role,
      billable.filter((item) => item.role === role).length
    ])),
    componentIds: billable.map((item) => item.id),
    customerEquipmentIds: customerEquipment.map((item) => item.id)
  };
}

/**
 * A corner join is a physical transition between two full bookcase runs, not
 * another normal-width bookcase. Its accepted fit is intentionally only one
 * casework-depth wide, which is below the canonical engine's 24 inch minimum.
 * Build the transition directly from that accepted envelope so the canonical
 * engine never widens it and the two adjoining installations remain anchored.
 */
function buildCornerJoinDescriptorSet(plan, installation, index) {
  const width = Number(installation.casework?.width);
  const height = Number(installation.casework?.overallHeight);
  const depth = Number(installation.casework?.depth);
  const baseHeight = Math.max(0, Number(installation.treatments?.base?.height) || 0);
  const topHeight = Math.max(0, Number(installation.treatments?.top?.height) || 0);
  const bodyHeight = Number(installation.casework?.bodyHeight);
  const panel = Number(plan.policy?.panelThickness) || 0.75;
  const bodyBottom = baseHeight;
  const bodyTop = bodyBottom + bodyHeight;

  if (
    !positive(width)
    || !positive(height)
    || !positive(depth)
    || !positive(bodyHeight)
    || panel * 2 >= width
    || panel * 2 >= depth
    || bodyTop > height + 1e-6
    || Math.abs(bodyTop + topHeight - height) > 1e-6
  ) {
    return reject(GUIDED_PRODUCT_ENGINE_FAILURES.cornerJoin, {
      installationId: installation.id,
      requested: { width, height, depth, bodyHeight, baseHeight, topHeight },
      message: "The accepted corner-join envelope cannot produce a unit-scale physical transition."
    });
  }

  const left = -width / 2;
  const right = width / 2;
  const innerLeft = left + panel;
  const innerBack = depth - panel;
  const rootId = "corner-join";
  const components = [component({
    id: rootId,
    role: "assembly",
    bounds: box(left, right, 0, height, 0, depth),
    metadata: {
      renderable: false,
      physical: false,
      kind: "deterministic_corner_join",
      installationRole: "corner-join",
      joinsInstallationIds: adjoiningInstallationIds(plan.installations, index)
    }
  })];

  if (baseHeight > 0) {
    components.push(part(
      "corner-join-base",
      "base",
      rootId,
      box(left, right, 0, baseHeight, 0, depth),
      "toe",
      { purpose: "continuous_corner_base" }
    ));
  }

  components.push(
    part(
      "corner-join-primary-spine",
      "side_panel",
      rootId,
      box(left, innerLeft, bodyBottom, bodyTop, 0, depth),
      "side",
      { joinFace: "primary-run", grainDirection: "vertical" }
    ),
    part(
      "corner-join-return-spine",
      "back_panel",
      rootId,
      box(innerLeft, right, bodyBottom, bodyTop, innerBack, depth),
      "back",
      { joinFace: "return-run", grainDirection: "vertical" }
    ),
    part(
      "corner-join-bottom",
      "bottom_panel",
      rootId,
      box(innerLeft, right, bodyBottom, bodyBottom + panel, 0, innerBack),
      "case",
      { purpose: "corner_transition_bottom" }
    ),
    part(
      "corner-join-top",
      "top_panel",
      rootId,
      box(innerLeft, right, bodyTop - panel, bodyTop, 0, innerBack),
      "case",
      { purpose: "corner_transition_top" }
    )
  );

  const shelfCount = clamp(Math.round(Number(plan.project?.shelves) || 4), 2, 8);
  const shelfRangeBottom = bodyBottom + panel;
  const shelfRangeTop = bodyTop - panel;
  for (let shelfIndex = 0; shelfIndex < shelfCount; shelfIndex += 1) {
    const ratio = (shelfIndex + 1) / (shelfCount + 1);
    const centerY = shelfRangeBottom + (shelfRangeTop - shelfRangeBottom) * ratio;
    components.push(part(
      `corner-join-shelf-${pad(shelfIndex + 1)}`,
      "shelf",
      rootId,
      box(innerLeft, right, centerY - panel / 2, centerY + panel / 2, 0, innerBack),
      "case",
      { fixed: true, purpose: "corner_transition_shelf", grainDirection: "long-axis" }
    ));
  }

  if (topHeight > 0) {
    components.push(part(
      "corner-join-crown",
      "crown",
      rootId,
      box(left, right, bodyTop, height, 0, depth),
      "case",
      { purpose: "continuous_corner_top_treatment" }
    ));
  }

  return {
    accepted: true,
    descriptorSet: createDescriptorSet({
      productId: plan.productId,
      installation,
      index,
      components,
      nominalDepth: depth
    }),
    warnings: []
  };
}

function adjoiningInstallationIds(installations, cornerIndex) {
  return installations
    .filter((installation, index) => index !== cornerIndex && installation.role !== "corner-join")
    .map((installation) => installation.id)
    .sort();
}

function addTvContractDescriptors(sourceComponents, layout, tv) {
  const components = clone(sourceComponents);
  const featureOpening = components.find((component) => component.id === "feature-opening");
  const featureZone = components.find((component) => component.id === "feature-zone");
  const countertop = components.find((component) => (
    component.role === "fixed_shelf" && component.metadata?.purpose === "continuous_countertop"
  ));
  if (!featureOpening || !featureZone || !countertop) {
    return reject(GUIDED_PRODUCT_ENGINE_FAILURES.tvOpeningFit, {
      message: "The Drawing 4 canonical layout did not expose its media zone and continuous countertop.",
      resolutions: ["choose-media-layout", "design-review"]
    });
  }

  const centerSectionIds = Array.isArray(featureZone.metadata?.memberSectionIds)
    ? featureZone.metadata.memberSectionIds
    : [];
  const centerSections = centerSectionIds
    .map((id) => components.find((component) => component.id === id))
    .filter(Boolean)
    .sort((left, right) => left.bounds.min.x - right.bounds.min.x);
  if (centerSections.length !== 2) {
    return reject(GUIDED_PRODUCT_ENGINE_FAILURES.tvOpeningFit, {
      message: "Drawing 4 requires exactly two canonical center display bays.",
      centerSectionIds
    });
  }

  const availableWidth = dimension(featureZone.bounds, "x");
  const availableHeight = featureZone.bounds.max.y - countertop.bounds.max.y;
  if (tv.opening.width > availableWidth + 1e-6 || tv.requiredAssemblyHeight > availableHeight + 1e-6) {
    return reject(GUIDED_PRODUCT_ENGINE_FAILURES.tvOpeningFit, {
      message: "The measured TV, service clearances, and equipment zone do not fit the accepted media span.",
      required: { width: tv.opening.width, height: tv.requiredAssemblyHeight },
      available: { width: availableWidth, height: availableHeight },
      resolutions: ["smaller-tv", "wider-wall", "fewer-side-sections", "design-review"]
    });
  }

  const centerX = midpoint(featureZone.bounds.min.x, featureZone.bounds.max.x);
  // Drawing 4 fixes the complete equipment stack directly above the one
  // continuous lower-cabinet countertop. This preserves two usable display
  // rows above the exact TV service opening instead of aesthetically centering
  // the media stack inside the remaining height.
  const assemblyBottom = countertop.bounds.max.y;
  const soundbarHeight = tv.soundbar.required ? tv.soundbar.zoneHeight : 0;
  const ventHeight = tv.soundbar.required ? tv.soundbar.ventilationClearance : 0;
  const openingBottom = assemblyBottom + soundbarHeight + ventHeight;
  const openingTop = openingBottom + tv.opening.height;
  const openingLeft = centerX - tv.opening.width / 2;
  const openingRight = centerX + tv.opening.width / 2;
  const bodyLeft = centerX - tv.body.width / 2;
  const bodyRight = centerX + tv.body.width / 2;
  const bodyBottom = openingBottom + tv.serviceClearance.bottom;
  const bodyTop = bodyBottom + tv.body.height;
  const clearDepth = featureOpening.bounds.max.z;

  const shelfRules = centerSections.map((section) => resolveMdfShelfThickness(dimension(section.bounds, "x")));
  const rejectedShelfRule = shelfRules.find((rule) => !rule?.accepted);
  if (rejectedShelfRule) {
    return reject(GUIDED_PRODUCT_ENGINE_FAILURES.tvOpeningFit, {
      message: "A Drawing 4 center display bay exceeds the authored MDF shelf-span rules.",
      shelfRule: rejectedShelfRule
    });
  }
  const upperDisplayHeight = featureZone.bounds.max.y - openingTop;
  const minimumShelfClearance = Number(layout.rules?.minShelfClearance) || 4;
  const centerShelfThickness = shelfRules[0].thickness;
  if (
    shelfRules.some((rule) => !nearlyEqual(rule.thickness, centerShelfThickness)) ||
    upperDisplayHeight + 1e-6 < centerShelfThickness + minimumShelfClearance * 2
  ) {
    return reject(GUIDED_PRODUCT_ENGINE_FAILURES.tvOpeningFit, {
      message: "The Drawing 4 media stack does not leave two usable center display rows.",
      upperDisplayHeight,
      centerShelfThickness,
      minimumShelfClearance
    });
  }

  const serviceOpening = component({
    id: "tv-service-opening",
    role: "opening",
    parentId: featureZone.id,
    hostId: featureZone.id,
    bounds: box(openingLeft, openingRight, openingBottom, openingTop, 0, clearDepth),
    metadata: {
      kind: "tv_service_opening",
      renderable: false,
      physical: false,
      serviceClearance: tv.serviceClearance,
      noDecorativeFrame: true
    }
  });
  components.push(serviceOpening);
  components.push(component({
    id: "tv-mount-backing",
    role: "backing_panel",
    parentId: serviceOpening.id,
    hostId: serviceOpening.id,
    bounds: box(bodyLeft, bodyRight, bodyBottom, bodyTop, Math.max(0, clearDepth - 0.75), clearDepth),
    metadata: {
      physical: true,
      purpose: "structural_tv_mount_backing",
      materialSlot: "cabinet_interior",
      noDecorativeFrame: true
    }
  }));
  components.push(component({
    id: "tv-body",
    role: "screen",
    parentId: serviceOpening.id,
    hostId: serviceOpening.id,
    bounds: box(bodyLeft, bodyRight, bodyBottom, bodyTop, 0, 0.75),
    metadata: {
      physical: true,
      materialSlot: "screen",
      diagonal: tv.diagonal,
      derivation: tv.body.derivation,
      mountingMode: tv.mountingMode,
      outletLocation: tv.outletLocation,
      finishIndependent: true
    }
  }));

  if (tv.soundbar.required) {
    components.push(component({
      id: "soundbar-equipment-zone",
      role: "opening",
      parentId: featureZone.id,
      hostId: featureZone.id,
      bounds: box(
        openingLeft,
        openingRight,
        assemblyBottom,
        assemblyBottom + soundbarHeight,
        0,
        clearDepth
      ),
      metadata: {
        kind: "soundbar_equipment_zone",
        renderable: false,
        physical: false,
        ventilationClearance: ventHeight
      }
    }));
    components.push(component({
      id: "equipment-ventilation-zone",
      role: "opening",
      parentId: featureZone.id,
      hostId: featureZone.id,
      bounds: box(
        openingLeft,
        openingRight,
        assemblyBottom + soundbarHeight,
        openingBottom,
        0,
        clearDepth
      ),
      metadata: { kind: "equipment_ventilation", renderable: false, physical: false }
    }));
  }

  const centerBoundaryMinX = centerSections[0].bounds.max.x;
  const centerBoundaryMaxX = centerSections[1].bounds.min.x;
  components.push(component({
    id: "divider-02-upper-support",
    role: "divider",
    parentId: "bookcase",
    hostId: "bookcase",
    bounds: box(
      centerBoundaryMinX,
      centerBoundaryMaxX,
      openingTop,
      featureZone.bounds.max.y,
      0,
      clearDepth
    ),
    metadata: {
      physical: true,
      boundaryIndex: 2,
      partial: true,
      purpose: "upper_media_support",
      specialKind: "media"
    }
  }));

  const shelfSideClearance = Number(layout.rules?.shelfSideClearance) || 0.125;
  const shelfFrontSetback = Number(layout.rules?.openShelfFrontSetback) || 0.125;
  const displayGap = (upperDisplayHeight - centerShelfThickness) / 2;
  centerSections.forEach((section, index) => {
    const shelfRule = shelfRules[index];
    components.push(component({
      id: `${section.id}-upper-shelf-01`,
      role: "shelf",
      parentId: section.id,
      hostId: section.id,
      bounds: box(
        section.bounds.min.x + shelfSideClearance,
        section.bounds.max.x - shelfSideClearance,
        openingTop + displayGap,
        openingTop + displayGap + shelfRule.thickness,
        shelfFrontSetback,
        clearDepth
      ),
      metadata: {
        physical: true,
        adjustable: true,
        ordinal: 1,
        displayRows: 2,
        clearSpan: dimension(section.bounds, "x"),
        constructionThickness: shelfRule.thickness,
        maximumApprovedClearSpan: shelfRule.maximumSpan,
        shelfSpanRuleId: shelfRule.ruleId,
        unsupportedSpan: false,
        purpose: "center_upper_display"
      }
    }));
  });

  const finalComponents = components.filter((item) => item.id !== featureOpening.id);
  const constraints = finalComponents.filter((item) => item.role === "opening");
  const clearanceConstraints = constraints.filter((item) => [
    "tv_service_opening",
    "soundbar_equipment_zone",
    "equipment_ventilation"
  ].includes(item.metadata?.kind));
  const forbiddenRoles = new Set([
    "divider",
    "shelf",
    "door",
    "drawer_front",
    "handle",
    "crown",
    "trim",
    "filler",
    "fascia"
  ]);
  const clearanceConflict = finalComponents.find((item) => (
    forbiddenRoles.has(item.role) &&
    clearanceConstraints.some((constraint) => boundsIntersect(item.bounds, constraint.bounds))
  ));
  if (clearanceConflict) {
    return reject(GUIDED_PRODUCT_ENGINE_FAILURES.tvOpeningFit, {
      message: "A physical Drawing 4 component enters a reserved TV equipment volume.",
      componentId: clearanceConflict.id
    });
  }
  const expectedConstraintCount = tv.soundbar.required ? 7 : 5;
  if (constraints.length !== expectedConstraintCount) {
    return reject(GUIDED_PRODUCT_ENGINE_FAILURES.descriptorInvalid, {
      message: tv.soundbar.required
        ? "Drawing 4 requires exactly four lower openings and three media clearances for a soundbar installation."
        : "Drawing 4 requires exactly four lower openings and one TV service clearance when no soundbar is installed.",
      constraintIds: constraints.map((item) => item.id)
    });
  }
  return { accepted: true, components: finalComponents };
}

function buildFloatingStorageDescriptorSet(plan, installation, index) {
  const rules = plan.policy.floating;
  const width = Number(installation.casework.width);
  const depth = Number(installation.casework.depth);
  const availableHeight = Number(installation.casework.bodyHeight || installation.casework.overallHeight);
  const explicitHeight = positive(
    plan.project?.measurements?.floatingHeight ??
    plan.project?.measurements?.storageHeight ??
    plan.project?.unitHeight
  );
  const requestedHeight = explicitHeight || rules.defaultBankHeight;
  if (
    requestedHeight < rules.minimumBankHeight ||
    requestedHeight > rules.maximumBankHeight ||
    requestedHeight > availableHeight + 1e-6
  ) {
    return reject(GUIDED_PRODUCT_ENGINE_FAILURES.floatingZone, {
      requestedHeight,
      availableHeight,
      allowed: { minimum: rules.minimumBankHeight, maximum: rules.maximumBankHeight }
    });
  }

  const panel = plan.policy.panelThickness;
  const height = requestedHeight;
  const compartmentCount = clamp(Math.round(width / 30), 1, 6);
  const interiorLeft = -width / 2 + panel;
  const interiorRight = width / 2 - panel;
  const interiorWidth = interiorRight - interiorLeft;
  const clearWidth = (interiorWidth - panel * (compartmentCount - 1)) / compartmentCount;
  if (clearWidth <= 0) return reject(GUIDED_PRODUCT_ENGINE_FAILURES.floatingZone);

  const rootId = "floating-storage";
  const components = [component({
    id: rootId,
    role: "assembly",
    bounds: box(-width / 2, width / 2, 0, height, 0, depth),
    metadata: {
      renderable: false,
      physical: false,
      installationMode: "floating",
      mountingHeight: resolveMountingHeight(plan, installation),
      heightSource: explicitHeight ? "customer" : rules.sourceStatus
    }
  })];
  components.push(
    part("floating-left-end", "end_panel", rootId, box(-width / 2, -width / 2 + panel, 0, height, 0, depth), "side"),
    part("floating-right-end", "end_panel", rootId, box(width / 2 - panel, width / 2, 0, height, 0, depth), "side"),
    part("floating-bottom", "bottom_panel", rootId, box(interiorLeft, interiorRight, 0, panel, 0, depth), "case"),
    part("floating-top", "top_panel", rootId, box(interiorLeft, interiorRight, height - panel, height, 0, depth), "case"),
    part("floating-back", "back_panel", rootId, box(interiorLeft, interiorRight, panel, height - panel, depth - panel, depth), "back"),
    part(
      "floating-mounting-rail",
      "mounting_rail",
      rootId,
      box(interiorLeft, interiorRight, Math.max(panel, height - 4), Math.max(panel + 1, height - 2), Math.max(0, depth - panel - 0.5), depth - panel),
      "mounting",
      { structural: true, wallAnchorPlane: true }
    )
  );

  for (let dividerIndex = 1; dividerIndex < compartmentCount; dividerIndex += 1) {
    const x = interiorLeft + dividerIndex * clearWidth + (dividerIndex - 1) * panel;
    components.push(part(
      `floating-divider-${pad(dividerIndex)}`,
      "divider",
      rootId,
      box(x, x + panel, panel, height - panel, 0, depth - panel),
      "side"
    ));
  }

  const reveal = 0.125;
  let cursor = interiorLeft;
  for (let compartmentIndex = 0; compartmentIndex < compartmentCount; compartmentIndex += 1) {
    const openingId = `floating-drawer-opening-${pad(compartmentIndex + 1)}`;
    const openingBounds = box(cursor, cursor + clearWidth, panel, height - panel, 0, depth - panel);
    components.push(component({
      id: openingId,
      role: "opening",
      parentId: rootId,
      hostId: rootId,
      bounds: openingBounds,
      metadata: { kind: "floating_drawer", renderable: false, physical: false }
    }));
    components.push(part(
      `floating-drawer-front-${pad(compartmentIndex + 1)}`,
      "drawer_front",
      openingId,
      box(
        openingBounds.min.x + reveal,
        openingBounds.max.x - reveal,
        openingBounds.min.y + reveal,
        openingBounds.max.y - reveal,
        0,
        panel
      ),
      "front",
      { style: mapDedicatedFrontStyle(plan.project.doorStyle), mounting: "inset" },
      openingId
    ));
    addDedicatedHandle(components, {
      id: `floating-drawer-handle-${pad(compartmentIndex + 1)}`,
      parentId: `floating-drawer-front-${pad(compartmentIndex + 1)}`,
      bounds: openingBounds,
      hardware: plan.project.hardware,
      y: midpoint(openingBounds.min.y, openingBounds.max.y)
    });
    cursor += clearWidth + panel;
  }

  const descriptorSet = createDescriptorSet({
    productId: plan.productId,
    installation,
    index,
    components,
    nominalDepth: depth,
    translationY: resolveMountingHeight(plan, installation)
  });
  const warnings = explicitHeight ? [] : [{
    code: "FLOATING_HEIGHT_DEFAULTED",
    severity: "warning",
    message: `Floating bank height uses the centralized ${rules.defaultBankHeight} inch provisional design default.`,
    sourceStatus: rules.sourceStatus
  }, {
    code: "FLOATING_ATTACHMENT_ENGINEERING_REVIEW",
    severity: "warning",
    message: "Wall attachment and load engineering require design review."
  }];
  return { accepted: true, descriptorSet, warnings };
}

function buildWindowStorageDescriptorSet(plan, installation, index) {
  const windowFeature = findTopologyFeature(plan.topology, "window");
  if (!windowFeature) {
    return reject(GUIDED_PRODUCT_ENGINE_FAILURES.windowFeature, {
      message: "Window Storage requires a resolved window opening in the room topology."
    });
  }
  if (
    yes(plan.project?.measurements?.radiatorBelowWindow) ||
    findTopologyFeature(plan.topology, "radiator")
  ) {
    return reject(GUIDED_PRODUCT_ENGINE_FAILURES.windowRadiator, {
      message: "The current Window Storage builder will not cover a radiator; choose Radiator Cover or design review.",
      resolutions: ["radiator-cover", "design-review"]
    });
  }

  const rules = plan.policy.windowStorage;
  const bottomY = finite(
    installation.anchors?.bottomY ?? installation.casework?.bottomPlaneY,
    0
  );
  const sillHeight = positive(plan.project?.measurements?.sillHeight)
    || featureCoordinate(windowFeature, "min", "y")
    || positive(installation.casework?.topPlaneY);
  const sillDerivedHeight = sillHeight - rules.openingClearance - bottomY;
  const fitHeight = Number(installation.casework.overallHeight);
  const height = Math.min(sillDerivedHeight, fitHeight);
  if (!positive(height) || height < rules.minimumUsableHeight) {
    return reject(GUIDED_PRODUCT_ENGINE_FAILURES.windowHeight, {
      sillHeight,
      openingClearance: rules.openingClearance,
      availableHeight: height
    });
  }

  const width = Number(installation.casework.width);
  const depth = Number(installation.casework.depth);
  const panel = plan.policy.panelThickness;
  const baseHeight = Math.max(0, Number(installation.treatments?.base?.height) || 4);
  const rootId = "window-storage";
  const components = [component({
    id: rootId,
    role: "assembly",
    bounds: box(-width / 2, width / 2, 0, height, 0, depth),
    metadata: {
      renderable: false,
      physical: false,
      featureFit: "window_sill",
      sillHeight,
      openingClearance: rules.openingClearance
    }
  })];
  const interiorLeft = -width / 2 + panel;
  const interiorRight = width / 2 - panel;
  components.push(
    part("window-base", "base", rootId, box(-width / 2, width / 2, 0, Math.min(baseHeight, height - panel), 0, depth), "toe"),
    part("window-left-end", "end_panel", rootId, box(-width / 2, -width / 2 + panel, baseHeight, height, 0, depth), "side"),
    part("window-right-end", "end_panel", rootId, box(width / 2 - panel, width / 2, baseHeight, height, 0, depth), "side"),
    part("window-bottom", "bottom_panel", rootId, box(interiorLeft, interiorRight, baseHeight, baseHeight + panel, 0, depth), "case"),
    part("window-seat-top", "top_panel", rootId, box(-width / 2, width / 2, height - panel, height, 0, depth), "case", { purpose: "window_seat_or_display_ledge" }),
    part("window-back", "back_panel", rootId, box(interiorLeft, interiorRight, baseHeight + panel, height - panel, depth - panel, depth), "back")
  );
  components.push(component({
    id: "window-opening-clearance",
    role: "clearance_zone",
    parentId: rootId,
    hostId: rootId,
    bounds: box(-width / 2, width / 2, height, height + rules.openingClearance, 0, depth),
    metadata: { renderable: false, physical: false, featureId: windowFeature.id || "window" }
  }));

  addLowCabinetFronts(components, {
    rootId,
    prefix: "window",
    width,
    minY: baseHeight + panel,
    maxY: height - panel,
    depth,
    panel,
    project: plan.project
  });
  const descriptorSet = createDescriptorSet({
    productId: plan.productId,
    installation,
    index,
    components,
    nominalDepth: depth
  });
  const warnings = [];
  if (!nearlyEqual(height, sillDerivedHeight)) {
    warnings.push({
      code: "WINDOW_STORAGE_HEIGHT_LIMITED_BY_FIT",
      severity: "warning",
      message: "The accepted installation zone is lower than the sill-derived maximum; the smaller fitted height was preserved."
    });
  }
  return { accepted: true, descriptorSet, warnings };
}

function buildRadiatorCoverDescriptorSet(plan, installation, index) {
  const radiatorFeature = findTopologyFeature(plan.topology, "radiator");
  if (!radiatorFeature) {
    return reject(GUIDED_PRODUCT_ENGINE_FAILURES.radiatorFeature, {
      message: "Radiator Cover requires a resolved radiator obstruction in the room topology."
    });
  }

  const rules = plan.policy.radiator;
  const radiatorWidth = positive(plan.project?.measurements?.radiatorWidth)
    || featureDimension(radiatorFeature, "x");
  const radiatorHeight = positive(plan.project?.measurements?.radiatorHeight)
    || featureDimension(radiatorFeature, "y");
  const radiatorDepth = positive(plan.project?.measurements?.radiatorDepth)
    || featureDimension(radiatorFeature, "z");
  const service = rules.serviceClearance;
  const panel = plan.policy.panelThickness;
  const requiredWidth = radiatorWidth + service * 2;
  const requiredHeight = radiatorHeight + service + rules.topThickness;
  const requiredDepth = radiatorDepth + service;
  const requiredCoverDepth = requiredDepth + panel;
  const available = installation.casework;
  if (
    requiredWidth > Number(available.width) + 1e-6 ||
    requiredHeight > Number(available.overallHeight) + 1e-6 ||
    requiredCoverDepth > Number(available.depth) + 1e-6
  ) {
    return reject(GUIDED_PRODUCT_ENGINE_FAILURES.radiatorFit, {
      message: "The radiator service and ventilation envelope does not fit inside the measured cover zone.",
      required: {
        width: round(requiredWidth),
        height: round(requiredHeight),
        depth: round(requiredCoverDepth),
        serviceDepth: round(requiredDepth),
        removableFaceThickness: round(panel)
      },
      available: {
        width: Number(available.width),
        height: Number(available.overallHeight),
        depth: Number(available.depth)
      },
      resolutions: ["increase-cover-zone", "reduce-depth", "design-review"]
    });
  }

  // The fit solver owns the accepted outer casework envelope. The dedicated
  // radiator builder must fill that envelope at unit scale; the radiator and
  // its minimum service volume remain centered inside it. Previously this
  // builder rendered only the minimum 52 x 28.75 x 11 service requirement for
  // G11 even though the accepted fit reported 57.5 x 31 x 14 casework.
  const width = Number(available.width);
  const height = Number(available.overallHeight);
  const depth = Number(available.depth);
  const baseHeight = Math.max(0, Number(installation.treatments?.base?.height) || 0);
  const rootId = "radiator-cover";
  const components = [component({
    id: rootId,
    role: "assembly",
    bounds: box(-width / 2, width / 2, 0, height, 0, depth),
    metadata: {
      renderable: false,
      physical: false,
      ventilationRequired: true,
      noSolidBack: true,
      serviceClearance: service,
      sourceStatus: rules.sourceStatus,
      fitEnvelopeContract: "accepted-fit-exact",
      requiredServiceEnvelope: {
        width: round(requiredWidth),
        height: round(requiredHeight),
        depth: round(requiredDepth)
      }
    }
  })];
  components.push(
    part("radiator-left-end", "end_panel", rootId, box(-width / 2, -width / 2 + panel, 0, height, 0, depth), "side"),
    part("radiator-right-end", "end_panel", rootId, box(width / 2 - panel, width / 2, 0, height, 0, depth), "side"),
    part("radiator-display-ledge", "top_panel", rootId, box(-width / 2, width / 2, height - rules.topThickness, height, 0, depth), "case", { purpose: "display_ledge" }),
    part(
      "installation-treatment-base-plinth",
      "plinth",
      rootId,
      box(-width / 2, width / 2, 0, baseHeight, 0, panel),
      "toe",
      {
        purpose: "radiator_removable_face_bottom_rail",
        ventilationBoundary: true,
        removableServiceFace: true
      }
    ),
    part("radiator-front-top-rail", "fascia", rootId, box(-width / 2 + panel, width / 2 - panel, height - rules.topThickness - 2, height - rules.topThickness, 0, panel), "front", { ventilationBoundary: true })
  );
  components.push(component({
    id: "radiator-body",
    role: "obstruction",
    parentId: rootId,
    hostId: rootId,
    bounds: box(
      -radiatorWidth / 2,
      radiatorWidth / 2,
      0,
      radiatorHeight,
      depth - radiatorDepth,
      depth
    ),
    metadata: { renderable: false, physical: false, fixedFeature: true }
  }));
  components.push(component({
    id: "radiator-service-envelope",
    role: "service_zone",
    parentId: rootId,
    hostId: rootId,
    bounds: box(
      -requiredWidth / 2,
      requiredWidth / 2,
      0,
      radiatorHeight + service,
      depth - requiredDepth,
      depth
    ),
    metadata: {
      renderable: false,
      physical: false,
      clearance: service,
      valveLocation: plan.project?.measurements?.valveLocation || "unknown"
    }
  }));

  const slatMinX = -width / 2 + panel + rules.slatPitch / 2;
  const slatMaxX = width / 2 - panel - rules.slatPitch / 2;
  const slatCount = Math.max(1, Math.floor((slatMaxX - slatMinX) / rules.slatPitch) + 1);
  const slatMinY = baseHeight;
  const slatMaxY = height - rules.topThickness - 2;
  for (let slatIndex = 0; slatIndex < slatCount; slatIndex += 1) {
    const ratio = slatCount === 1 ? 0.5 : slatIndex / (slatCount - 1);
    const centerX = slatMinX + (slatMaxX - slatMinX) * ratio;
    components.push(part(
      `radiator-vent-slat-${pad(slatIndex + 1)}`,
      "slat",
      rootId,
      box(centerX - rules.slatWidth / 2, centerX + rules.slatWidth / 2, slatMinY, slatMaxY, 0, panel),
      "front",
      { ventilation: true, removableServiceFace: true }
    ));
  }

  const descriptorSet = createDescriptorSet({
    productId: plan.productId,
    installation,
    index,
    components,
    nominalDepth: depth
  });
  return {
    accepted: true,
    descriptorSet,
    warnings: [{
      code: "RADIATOR_VENTILATION_ENGINEERING_REVIEW",
      severity: "warning",
      message: "Final free-area, heat, valve, and removable-service details require design review.",
      sourceStatus: rules.sourceStatus
    }]
  };
}

function addLowCabinetFronts(components, options) {
  const { rootId, prefix, width, minY, maxY, depth, panel, project } = options;
  const count = clamp(Math.round(width / 30), 1, 5);
  const interiorLeft = -width / 2 + panel;
  const interiorRight = width / 2 - panel;
  const clearTotal = interiorRight - interiorLeft - panel * (count - 1);
  const clearWidth = clearTotal / count;
  let cursor = interiorLeft;
  const reveal = 0.125;
  for (let index = 0; index < count; index += 1) {
    const openingId = `${prefix}-cabinet-opening-${pad(index + 1)}`;
    const openingBounds = box(cursor, cursor + clearWidth, minY, maxY, 0, depth - panel);
    components.push(component({
      id: openingId,
      role: "opening",
      parentId: rootId,
      hostId: rootId,
      bounds: openingBounds,
      metadata: { kind: "low_cabinet", renderable: false, physical: false }
    }));
    components.push(part(
      `${prefix}-door-${pad(index + 1)}`,
      "door",
      openingId,
      box(
        openingBounds.min.x + reveal,
        openingBounds.max.x - reveal,
        openingBounds.min.y + reveal,
        openingBounds.max.y - reveal,
        0,
        panel
      ),
      "front",
      { style: mapDedicatedFrontStyle(project.doorStyle), mounting: "inset" },
      openingId
    ));
    addDedicatedHandle(components, {
      id: `${prefix}-door-handle-${pad(index + 1)}`,
      parentId: `${prefix}-door-${pad(index + 1)}`,
      bounds: openingBounds,
      hardware: project.hardware,
      y: midpoint(openingBounds.min.y, openingBounds.max.y)
    });
    if (index < count - 1) {
      components.push(part(
        `${prefix}-divider-${pad(index + 1)}`,
        "divider",
        rootId,
        box(openingBounds.max.x, openingBounds.max.x + panel, minY, maxY, 0, depth - panel),
        "side"
      ));
    }
    cursor += clearWidth + panel;
  }
}

function addDedicatedHandle(components, options) {
  const hardware = options.hardware;
  if (hardware === "none") return;
  const pull = hardware === "brass-pull" || hardware === "black-pull";
  const centerX = midpoint(options.bounds.min.x, options.bounds.max.x);
  const width = pull ? Math.min(5, Math.max(3, dimension(options.bounds, "x") * 0.25)) : 1;
  const height = pull ? 0.5 : 1;
  components.push(component({
    id: options.id,
    role: "handle",
    parentId: options.parentId,
    hostId: options.parentId,
    bounds: box(centerX - width / 2, centerX + width / 2, options.y - height / 2, options.y + height / 2, -1, 0),
    metadata: {
      physical: true,
      hardware: hardware || "brass-pull",
      hardwareType: pull ? "pull" : "knob",
      orientation: pull ? "horizontal" : "neutral",
      materialSlot: "hardware"
    }
  }));
}

function createDescriptorSet({
  productId,
  installation,
  index,
  components,
  nominalDepth,
  translationY = null,
  canonicalLayoutFingerprint = null,
  canonicalRenderContract = null
}) {
  const setId = createDescriptorSetId(installation, index);
  const promotedComponents = promoteInstallationTreatments(components, installation);
  const namespaced = namespaceComponents(promotedComponents, setId, {
    namespaceMetadataIds: productId === "tv-unit"
  });
  const transform = createInstallationTransform(installation, translationY, nominalDepth);
  const setBounds = unionBounds(namespaced.map((item) => item.bounds));
  const physicalComponents = namespaced
    .filter((item) => !APPEARANCE_FIXTURE_ROLES.has(item.role));
  const physicalBounds = physicalComponents.length
    ? unionBounds(physicalComponents.map((item) => item.bounds))
    : setBounds;
  const descriptorSet = {
    id: setId,
    installationId: installation.id,
    zoneId: installation.zoneId,
    productId,
    schemaVersion: GUIDED_PRODUCT_DESCRIPTOR_SCHEMA_VERSION,
    units: "inches",
    localOrigin: "bottom-center-front",
    rootScale: [1, 1, 1],
    transform,
    bounds: setBounds,
    physicalBounds,
    nominalDepth: round(nominalDepth),
    installationContract: {
      mode: installation.mode || null,
      role: installation.role || null,
      zoneBounds: clone(installation.zoneBounds || null),
      casework: clone(installation.casework),
      treatments: clone(installation.treatments),
      anchors: clone(installation.anchors),
      invariants: clone(installation.invariants)
    },
    canonicalLayoutFingerprint,
    canonicalRenderContract,
    components: namespaced
  };
  descriptorSet.validation = validateDescriptorSet(descriptorSet);
  return deepFreeze(descriptorSet);
}

/**
 * Promote the installation solver's physical treatments into the accepted
 * component graph. Side treatments are generated from their exact solved
 * widths. A finished end occupies only its declared panel thickness and leaves
 * the balance of the treatment width as open design clearance.
 *
 * Canonical layouts already generate their selected base/plinth and crown
 * profiles. Those parts are tagged as the fit treatment's primary physical
 * realization instead of adding a coincident box. Dedicated builders that do
 * not provide a corresponding part receive one deterministic fallback part.
 */
function promoteInstallationTreatments(sourceComponents, installation) {
  const components = clone(Array.isArray(sourceComponents) ? sourceComponents : []);
  const treatments = installation?.treatments || {};
  const casework = installation?.casework || {};
  const width = Number(casework.width);
  const height = Number(casework.overallHeight);
  const depth = Number(casework.depth);
  if (![width, height, depth].every((value) => Number.isFinite(value) && value > 0)) {
    return components;
  }

  const root = components.find((item) => item?.role === "assembly" && !item.parentId);
  const rootId = root?.id || components.find((item) => item?.parentId)?.parentId || null;
  const halfWidth = width / 2;

  promoteSideTreatment("left", treatments.left, {
    components,
    rootId,
    width,
    height,
    depth,
    halfWidth
  });
  promoteSideTreatment("right", treatments.right, {
    components,
    rootId,
    width,
    height,
    depth,
    halfWidth
  });
  promoteBaseTreatment(treatments.base, {
    components,
    rootId,
    installation,
    width,
    height,
    depth,
    halfWidth
  });
  promoteTopTreatment(treatments.top, {
    components,
    rootId,
    installation,
    width,
    height,
    depth,
    halfWidth
  });
  return components;
}

function promoteSideTreatment(position, treatment, context) {
  const width = Number(treatment?.width);
  if (!Number.isFinite(width) || width <= 1e-6) return;
  const existing = findPromotedTreatment(context.components, treatment, position);
  if (existing) return;

  const isFiller = treatment.kind === "filler";
  const isCornerJoin = treatment.kind === "corner-join";
  const endPanelThickness = Number(treatment.endPanelThickness);
  const isFinishedEnd = (
    treatment.kind === "finished-end"
    || treatment.kind === "clearance" && treatment.finishedExteriorSide === true
  ) && Number.isFinite(endPanelThickness) && endPanelThickness > 1e-6;
  if (!isFiller && !isFinishedEnd && !isCornerJoin) return;

  // A corner treatment is the physical transition into the adjoining run, not
  // open design clearance. Realize its complete solved width so the accepted
  // fit partition and the descriptor graph remain identical after any width
  // granularity adjustment.
  const physicalWidth = isFiller || isCornerJoin
    ? width
    : Math.min(width, endPanelThickness);
  const innerEdge = position === "left" ? -context.halfWidth : context.halfWidth;
  const minX = position === "left" ? innerEdge - physicalWidth : innerEdge;
  const maxX = position === "left" ? innerEdge : innerEdge + physicalWidth;
  const role = isFiller ? "filler" : "end_panel";
  const treatmentSuffix = isFiller
    ? "filler"
    : isCornerJoin ? "corner-join" : "finished-end";
  const localBounds = box(minX, maxX, 0, context.height, 0, context.depth);
  context.components.push(part(
    `installation-treatment-${position}-${treatmentSuffix}`,
    role,
    context.rootId,
    localBounds,
    "side",
    {
      purpose: isFiller
        ? "scribed_installation_filler"
        : isCornerJoin ? "physical_corner_transition" : "finished_exterior_end_panel",
      installationTreatment: createTreatmentDescriptorMetadata(
        treatment,
        position,
        isFiller || isCornerJoin ? width : endPanelThickness,
        "x",
        localBounds,
        true
      ),
      boundaryKind: treatment.boundaryKind || null,
      scribed: treatment.scribed === true,
      designClearance: isFinishedEnd
        ? round(Math.max(0, width - physicalWidth))
        : 0,
      solvedTreatmentWidth: round(width),
      panelThickness: isFinishedEnd || isCornerJoin ? round(physicalWidth) : null,
      joinsAdjacentRun: isCornerJoin
    }
  ));
}

function promoteBaseTreatment(treatment, context) {
  const height = Number(treatment?.height);
  if (!Number.isFinite(height) || height <= 1e-6 || treatment.kind === "none") return;
  if (findPromotedTreatment(context.components, treatment, "base")) return;
  const localBounds = box(-context.halfWidth, context.halfWidth, 0, height, 0, context.depth);
  const reusable = selectReusableTreatmentComponent(
    context.components,
    ["base", "plinth"],
    (item) => (
      item.bounds.min.y <= 1e-6
      && item.bounds.max.y >= height - 1e-6
      && item.bounds.min.x <= -context.halfWidth + 1e-6
      && item.bounds.max.x >= context.halfWidth - 1e-6
    )
  );
  if (reusable) {
    tagReusableTreatment(reusable, treatment, "base", height, "y", localBounds);
    return;
  }
  context.components.push(part(
    "installation-treatment-base-plinth",
    treatment.kind === "built-in-base" ? "plinth" : "base",
    context.rootId,
    localBounds,
    "toe",
    {
      purpose: treatment.kind === "built-in-base" ? "built_in_floor_plinth" : "installation_base",
      floorContact: true,
      installationTreatment: createTreatmentDescriptorMetadata(
        treatment,
        "base",
        height,
        "y",
        localBounds,
        true
      )
    }
  ));
}

function promoteTopTreatment(treatment, context) {
  const height = Number(treatment?.height);
  if (!Number.isFinite(height) || height <= 1e-6 || treatment.kind === "none") return;
  if (findPromotedTreatment(context.components, treatment, "top")) return;
  const localBounds = box(
    -context.halfWidth,
    context.halfWidth,
    context.height - height,
    context.height,
    0,
    context.depth
  );
  const reusable = selectReusableTreatmentComponent(
    context.components,
    ["crown", "trim"],
    (item) => (
      item.bounds.max.y >= context.height - 1e-6
      && dimension(item.bounds, "y") >= height - 1e-6
      && item.bounds.min.x <= -context.halfWidth + 1e-6
      && item.bounds.max.x >= context.halfWidth - 1e-6
    )
  );
  if (reusable) {
    tagReusableTreatment(reusable, treatment, "top", height, "y", localBounds);
    return;
  }
  const role = /crown/i.test(`${treatment.kind || ""} ${treatment.selection || ""}`)
    ? "crown"
    : "trim";
  context.components.push(part(
    `installation-treatment-top-${role}`,
    role,
    context.rootId,
    localBounds,
    "case",
    {
      purpose: role === "crown" ? "fitted_top_crown" : "fitted_top_scribe",
      ceilingContact: true,
      installationTreatment: createTreatmentDescriptorMetadata(
        treatment,
        "top",
        height,
        "y",
        localBounds,
        true
      )
    }
  ));
}

function findPromotedTreatment(components, treatment, position) {
  const treatmentId = treatmentIdentifier(treatment, position);
  return components.find((item) => (
    item?.metadata?.installationTreatment?.id === treatmentId
    && item.metadata.installationTreatment.position === position
  ));
}

function selectReusableTreatmentComponent(components, roles, predicate) {
  return components
    .filter((item) => roles.includes(item?.role) && validBounds(item.bounds) && predicate(item))
    .sort((left, right) => {
      const widthDifference = dimension(right.bounds, "x") - dimension(left.bounds, "x");
      return Math.abs(widthDifference) > 1e-6
        ? widthDifference
        : String(left.id).localeCompare(String(right.id));
    })[0] || null;
}

function tagReusableTreatment(componentValue, treatment, position, solvedDimension, axis, localBounds) {
  componentValue.metadata = {
    ...(componentValue.metadata || {}),
    installationTreatment: createTreatmentDescriptorMetadata(
      treatment,
      position,
      solvedDimension,
      axis,
      localBounds,
      true
    ),
    reusesCanonicalComponent: true
  };
}

function createTreatmentDescriptorMetadata(treatment, position, solvedDimension, axis, localBounds, primary) {
  return {
    schemaVersion: 1,
    source: "accepted-installation-fit",
    id: treatmentIdentifier(treatment, position),
    position,
    kind: treatment?.kind || "none",
    selection: treatment?.selection || null,
    boundaryKind: treatment?.boundaryKind || null,
    primary: primary === true,
    solvedDimension: { axis, value: round(solvedDimension) },
    solvedLocalBounds: clone(localBounds),
    solvedWorldBounds: normalizeTreatmentBounds(treatment?.bounds)
  };
}

function treatmentIdentifier(treatment, position) {
  return String(treatment?.id || `installation-${position}-treatment`);
}

function normalizeTreatmentBounds(value) {
  const min = value?.min || {
    x: value?.minX,
    y: value?.minY,
    z: value?.minZ
  };
  const max = value?.max || {
    x: value?.maxX,
    y: value?.maxY,
    z: value?.maxZ
  };
  if (![min?.x, min?.y, min?.z, max?.x, max?.y, max?.z].every((entry) => Number.isFinite(Number(entry)))) {
    return null;
  }
  return box(min.x, max.x, min.y, max.y, min.z, max.z);
}

function createDescriptorSetId(installation, index) {
  return `guided-${slug(installation.id || `installation-${index + 1}`)}`;
}

function validateDescriptorSet(set) {
  const errors = [];
  const ids = new Set();
  const components = Array.isArray(set?.components) ? set.components : [];
  if (!components.length) errors.push(validationIssue("MISSING_COMPONENTS", null));
  if (!Array.isArray(set?.rootScale) || set.rootScale.some((value) => Number(value) !== 1)) {
    errors.push(validationIssue("ROOT_SCALE_MUTATION", null));
  }
  if (!validBounds(set?.bounds)) errors.push(validationIssue("INVALID_DESCRIPTOR_SET_BOUNDS", null));

  for (const item of components) {
    if (!item?.id || ids.has(item.id)) {
      errors.push(validationIssue(item?.id ? "DUPLICATE_COMPONENT_ID" : "MISSING_COMPONENT_ID", item?.id || null));
      continue;
    }
    ids.add(item.id);
    if (!validBounds(item.bounds)) errors.push(validationIssue("INVALID_COMPONENT_BOUNDS", item.id));
  }
  for (const item of components) {
    if (item.parentId && !ids.has(item.parentId)) errors.push(validationIssue("MISSING_COMPONENT_PARENT", item.id));
    if (item.hostId && !ids.has(item.hostId)) errors.push(validationIssue("MISSING_COMPONENT_HOST", item.id));
    if (validBounds(item.bounds) && validBounds(set.bounds) && !containsBounds(set.bounds, item.bounds)) {
      errors.push(validationIssue("COMPONENT_OUTSIDE_DESCRIPTOR_SET", item.id));
    }
    if (isRenderable(item) && !materialSlotFor(item)) {
      errors.push(validationIssue("MISSING_MATERIAL_SLOT", item.id));
    }
  }
  return {
    valid: errors.length === 0,
    errors,
    warnings: []
  };
}

function namespaceComponents(components, namespace, { namespaceMetadataIds = false } = {}) {
  const idMap = new Map(components.map((item) => [item.id, `${namespace}/${item.id}`]));
  return components.map((item) => {
    const namespaced = {
      ...clone(item),
      id: idMap.get(item.id),
      parentId: item.parentId ? idMap.get(item.parentId) || `${namespace}/${item.parentId}` : null,
      hostId: item.hostId ? idMap.get(item.hostId) || `${namespace}/${item.hostId}` : null
    };
    if (namespaceMetadataIds) {
      namespaced.metadata = namespaceComponentMetadata(item.metadata, idMap);
    }
    return namespaced;
  });
}

function namespaceComponentMetadata(metadata, idMap) {
  const value = clone(metadata || {});
  for (const key of [
    "sectionId",
    "leftBoundaryId",
    "rightBoundaryId",
    "topBoundaryId",
    "bottomBoundaryId"
  ]) {
    if (typeof value[key] === "string" && idMap.has(value[key])) {
      value[key] = idMap.get(value[key]);
    }
  }
  if (Array.isArray(value.memberSectionIds)) {
    value.memberSectionIds = value.memberSectionIds.map((id) => idMap.get(id) || id);
  }
  return value;
}

function createInstallationTransform(installation, translationY, descriptorDepth) {
  const anchors = installation.anchors || {};
  const casework = installation.casework || {};
  const zone = installation.zoneBounds || {};
  const orientation = installation.orientation || {};
  const origin = orientation.origin || {};
  const widthAxis = normalizeAxis(orientation.widthAxis, [1, 0, 0]);
  const heightAxis = normalizeAxis(orientation.heightAxis, [0, 1, 0]);
  // Room topology defines depth from the installation back plane toward the
  // customer. Canonical product descriptors define local Z from the product
  // front toward its back. The render basis therefore uses the inverse axis.
  const backToFrontAxis = normalizeAxis(orientation.depthAxis, [0, 0, -1]);
  const frontToBackAxis = backToFrontAxis.map((value) => -value);
  const caseworkCenter = (
    finite(casework.leftPlaneX, NaN) + finite(casework.rightPlaneX, NaN)
  ) / 2;
  const widthCoordinateAtOrigin = finite(
    orientation.widthCoordinateAtOrigin,
    Math.abs(widthAxis[0]) > 1 - 1e-6 ? Number(zone.left) : 0
  );
  const widthOffset = Number.isFinite(caseworkCenter) && Number.isFinite(Number(zone.left))
    ? caseworkCenter - widthCoordinateAtOrigin
    : null;
  const depth = finite(descriptorDepth, finite(casework.depth, 0));
  const hasOrientedOrigin = [origin.x, origin.y, origin.z].every((value) => (
    Number.isFinite(Number(value))
  )) && Number.isFinite(widthOffset);
  const orientedFront = hasOrientedOrigin
    ? {
        x: Number(origin.x) + widthAxis[0] * widthOffset + backToFrontAxis[0] * depth,
        y: Number(origin.y) + widthAxis[1] * widthOffset + backToFrontAxis[1] * depth,
        z: Number(origin.z) + widthAxis[2] * widthOffset + backToFrontAxis[2] * depth
      }
    : null;
  return {
    translation: {
      x: round(orientedFront?.x ?? finite(anchors.centerX ?? origin.x, 0)),
      y: finite(translationY ?? anchors.bottomY ?? casework.bodyBottomPlaneY ?? origin.y, 0),
      z: round(orientedFront?.z ?? finite(
        anchors.frontZ ?? casework.frontPlaneZ ?? origin.z,
        -Number(casework.depth || 0)
      ))
    },
    basis: {
      x: vector(widthAxis),
      y: vector(heightAxis),
      z: vector(frontToBackAxis)
    }
  };
}

function createMaterialState(project, descriptorSets) {
  const slots = unique(
    descriptorSets.flatMap((set) => set.components.filter(isRenderable).map(materialSlotFor))
  );
  const finish = project?.finish || null;
  const accent = project?.accentFinish || finish;
  const assignments = Object.fromEntries(slots.map((slot) => [slot, ({
    cabinet_finish: finish,
    cabinet_interior: accent,
    case: finish,
    front: finish,
    side: finish,
    back: accent,
    toe: finish,
    mounting: "structural-neutral",
    hardware: project?.hardware || "brass-pull",
    led: project?.lighting || "warm-led",
    screen: "tv-screen-neutral"
  })[slot] || finish]));
  return {
    finish,
    accentFinish: accent,
    hardware: project?.hardware || null,
    lighting: project?.lighting || null,
    assignments
  };
}

function createPricingResult(canonicalEvaluations, descriptorSets = []) {
  if (!canonicalEvaluations.length) return { status: "unavailable", pricing: null };
  const installations = canonicalEvaluations.map((entry) => ({
    installationId: entry.installationId,
    zoneId: entry.zoneId,
    acceptedCaseworkWidthIn: round(entry.acceptedCaseworkWidthIn ?? entry.evaluation.state.width),
    acceptedCaseworkDepthIn: round(entry.acceptedCaseworkDepthIn ?? entry.evaluation.state.depth),
    pricingVersion: entry.evaluation.pricing.pricingVersion,
    basis: entry.evaluation.pricing.basis || "canonical-generated-layout",
    total: entry.evaluation.pricing.total,
    breakdown: entry.evaluation.pricing
  }));
  const pricingBases = unique(installations.map((item) => item.basis));
  const acceptedCasework = descriptorSets.map((set) => ({
    width: Number(set.installationContract?.casework?.width),
    depth: Number(set.installationContract?.casework?.depth)
  }));
  const combined = combineCanonicalInstallationPricing(installations, {
    acceptedCaseworkWidthIn: acceptedCasework.every((item) => Number.isFinite(item.width))
      ? acceptedCasework.reduce((sum, item) => sum + item.width, 0)
      : null,
    acceptedCaseworkDepthsIn: acceptedCasework
      .map((item) => item.depth)
      .filter(Number.isFinite)
  });
  const canonicalInstallationIds = new Set(installations.map((item) => item.installationId));
  const unpricedDescriptorSets = descriptorSets
    .filter((set) => !canonicalInstallationIds.has(set.installationId))
    .map(createUnpricedDescriptorSetSummary)
    .filter((set) => set.billableComponentCount > 0);

  if (unpricedDescriptorSets.length) {
    return {
      status: "design-review",
      pricing: {
        available: false,
        status: "design-review",
        source: "bookcase-pricing",
        basis: "accepted-descriptor-graph-requires-design-review",
        aggregation: "single-project-canonical-line-items",
        pricingVersion: combined.pricingVersion,
        total: null,
        provisionalCanonicalTotal: combined.total,
        lineItems: combined.lineItems,
        subtotalBeforeMultipliers: combined.subtotalBeforeMultipliers,
        multipliers: combined.multipliers,
        subtotal: combined.subtotal,
        minimumApplied: combined.minimumApplied,
        roundingIncrement: combined.roundingIncrement,
        acceptedCaseworkWidthIn: combined.acceptedCaseworkWidthIn,
        installations,
        unpricedDescriptorSets,
        reviewReason: "Accepted noncanonical billable descriptors do not have a validated pricing formula."
      }
    };
  }

  return {
    status: "canonical",
    pricing: {
      available: true,
      source: "bookcase-pricing",
      basis: pricingBases.length === 1 ? pricingBases[0] : "mixed-accepted-descriptor-graphs",
      aggregation: "single-project-canonical-line-items",
      pricingVersion: combined.pricingVersion,
      lineItems: combined.lineItems,
      subtotalBeforeMultipliers: combined.subtotalBeforeMultipliers,
      multipliers: combined.multipliers,
      subtotal: combined.subtotal,
      minimumApplied: combined.minimumApplied,
      roundingIncrement: combined.roundingIncrement,
      acceptedCaseworkWidthIn: combined.acceptedCaseworkWidthIn,
      total: combined.total,
      installations
    }
  };
}

/**
 * Recompose the canonical installation breakdowns as one accepted project.
 * Each installation keeps its original breakdown above for audit, but project
 * allowances, delivery, the professional-install minimum, depth treatment,
 * project minimum, and rounding are deliberately applied exactly once here.
 */
function combineCanonicalInstallationPricing(installations, acceptedProject = {}) {
  const breakdowns = installations.map((item) => item.breakdown);
  const states = breakdowns.map((breakdown) => breakdown.state || {});
  const canonicalCaseworkWidthIn = installations.reduce((sum, item) => (
    sum + Number(item.acceptedCaseworkWidthIn || 0)
  ), 0);
  const acceptedCaseworkWidthIn = round(
    Number.isFinite(Number(acceptedProject.acceptedCaseworkWidthIn))
      ? Number(acceptedProject.acceptedCaseworkWidthIn)
      : canonicalCaseworkWidthIn
  );
  const lineItems = [createCombinedPricingLine(
    "BASE_PROJECT",
    "Base project allowance",
    1,
    "project",
    PRICING_RATES.baseProject,
    installations.map((item) => item.installationId)
  )];

  const grouped = new Map();
  for (const installation of installations) {
    for (const sourceLine of installation.breakdown.lineItems || []) {
      if (["BASE_PROJECT", "INSTALLATION", "DELIVERY"].includes(sourceLine.code)) continue;
      const lineIdentity = clone(sourceLine);
      delete lineIdentity.quantity;
      delete lineIdentity.amount;
      const key = stableStringify(lineIdentity);
      let combinedLine = grouped.get(key);
      if (!combinedLine) {
        combinedLine = {
          ...lineIdentity,
          quantity: 0,
          amount: 0,
          sourceInstallationIds: []
        };
        grouped.set(key, combinedLine);
      }
      combinedLine.quantity = round(combinedLine.quantity + Number(sourceLine.quantity || 0));
      combinedLine.amount = roundCurrency(combinedLine.amount + Number(sourceLine.amount || 0));
      combinedLine.sourceInstallationIds.push(installation.installationId);
    }
  }
  lineItems.push(...grouped.values());

  const installationSelection = states[0]?.installation || "no_installation";
  const installationRate = installationSelection === "professional"
    ? Math.max(
      PRICING_RATES.professionalInstallationMinimum,
      acceptedCaseworkWidthIn * PRICING_RATES.professionalInstallationPerWidthIn
    )
    : 0;
  lineItems.push(createCombinedPricingLine(
    "INSTALLATION",
    "Installation",
    1,
    "selection",
    installationRate,
    installations.map((item) => item.installationId)
  ));

  const deliverySelection = states[0]?.delivery || "standard";
  const sourceDelivery = breakdowns[0]?.lineItems?.find((item) => item.code === "DELIVERY");
  lineItems.push(createCombinedPricingLine(
    "DELIVERY",
    sourceDelivery?.label || `${formatPricingToken(deliverySelection)} delivery`,
    1,
    "selection",
    PRICING_RATES.delivery[deliverySelection] ?? 0,
    installations.map((item) => item.installationId)
  ));

  const subtotalBeforeMultipliers = roundCurrency(lineItems.reduce((sum, item) => (
    sum + Number(item.amount || 0)
  ), 0));
  const acceptedDepths = acceptedProject.acceptedCaseworkDepthsIn?.length
    ? acceptedProject.acceptedCaseworkDepthsIn
    : installations.map((item) => Number(item.acceptedCaseworkDepthIn || 0));
  const depthMultiplier = acceptedDepths.some((depth) => (
    Number(depth) > PRICING_RATES.deepCabinetThresholdIn
  )) ? PRICING_RATES.deepCabinetMultiplier : 1;
  const finishMultiplier = 1;
  const subtotal = roundCurrency(subtotalBeforeMultipliers * depthMultiplier * finishMultiplier);
  const total = roundToPricingIncrement(
    Math.max(PRICING_RATES.minimumProjectTotal, subtotal),
    PRICING_RATES.roundingIncrement
  );

  return {
    pricingVersion: unique(installations.map((item) => item.pricingVersion)).join("+") || null,
    acceptedCaseworkWidthIn,
    lineItems,
    subtotalBeforeMultipliers,
    multipliers: {
      depth: depthMultiplier,
      finish: finishMultiplier
    },
    subtotal,
    minimumApplied: subtotal < PRICING_RATES.minimumProjectTotal,
    roundingIncrement: PRICING_RATES.roundingIncrement,
    total
  };
}

function createCombinedPricingLine(code, label, quantity, unit, unitRate, sourceInstallationIds) {
  const normalizedQuantity = Number(quantity) || 0;
  const normalizedRate = Number(unitRate) || 0;
  return {
    code,
    label,
    quantity: round(normalizedQuantity),
    unit,
    unitRate: roundCurrency(normalizedRate),
    amount: roundCurrency(normalizedQuantity * normalizedRate),
    sourceInstallationIds: [...sourceInstallationIds]
  };
}

function createUnpricedDescriptorSetSummary(set) {
  const customerEquipmentIds = new Set((set.components || [])
    .filter((item) => item.role === "screen" || item.metadata?.customerOwned === true)
    .map((item) => item.id));
  const billable = (set.components || []).filter((item) => (
    isRenderable(item) && !customerEquipmentIds.has(item.id)
  ));
  return {
    descriptorSetId: set.id,
    installationId: set.installationId,
    zoneId: set.zoneId,
    installationRole: set.installationContract?.role || null,
    billableComponentCount: billable.length,
    billableComponentIds: billable.map((item) => item.id),
    byRole: Object.fromEntries(unique(billable.map((item) => item.role)).sort().map((role) => [
      role,
      billable.filter((item) => item.role === role).length
    ]))
  };
}

function roundCurrency(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function roundToPricingIncrement(value, increment) {
  return Math.round(Number(value) / Number(increment)) * Number(increment);
}

function formatPricingToken(value) {
  return String(value || "")
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function createTopologyRef(topology) {
  const physical = {
    units: topology?.units || "inches",
    layoutId: topology?.layoutId || null,
    layoutKind: topology?.layoutKind || null,
    wallWidth: topology?.wallWidth ?? null,
    ceilingHeight: topology?.ceilingHeight ?? null,
    desiredDepth: topology?.desiredDepth ?? null,
    planes: clone(topology?.planes || null),
    features: clone(topology?.features || null),
    exclusionVolumes: clone(topology?.exclusionVolumes || []),
    installationZones: clone(topology?.installationZones || [])
  };
  return {
    schemaVersion: topology?.schemaVersion || null,
    units: topology?.units || "inches",
    layoutId: topology?.layoutId || null,
    layoutKind: topology?.layoutKind || null,
    fingerprint: topology?.geometryFingerprint || topology?.fingerprint ||
      `jq-room-reference-v1-${fnv1a64(stableStringify(geometryOnly(physical)))}`,
    cameraIntent: clone(topology?.cameraIntent || null)
  };
}

function createFitRef(fit, installations) {
  return {
    schemaVersion: fit?.schemaVersion || null,
    units: fit?.units || "inches",
    mode: fit?.mode || null,
    rootScale: clone(fit?.invariants?.rootScale || [1, 1, 1]),
    installations: installations.map((item) => ({
      id: item.id,
      zoneId: item.zoneId,
      role: item.role || null,
      casework: clone(item.casework),
      treatments: clone(item.treatments),
      anchors: clone(item.anchors),
      orientation: clone(item.orientation),
      rootScale: clone(item.invariants?.rootScale || [1, 1, 1])
    }))
  };
}

function materialSlotFor(item) {
  if (item.metadata?.materialSlot) return item.metadata.materialSlot;
  if (item.role === "handle") return "hardware";
  if (item.role === "light") return "led";
  if (item.role === "screen") return "screen";
  if (["door", "drawer_front", "slat", "fascia"].includes(item.role)) return "front";
  if (["side_panel", "end_panel", "filler", "divider"].includes(item.role)) return "side";
  if (["base", "plinth"].includes(item.role)) return "toe";
  if (["back_panel", "backing_panel", "vent"].includes(item.role)) return "back";
  if (item.role === "mounting_rail") return "mounting";
  return "case";
}

function isRenderable(item) {
  return Boolean(
    item?.bounds && item.metadata?.renderable !== false &&
    (RENDERABLE_ROLES.has(item.role) || item.metadata?.physical === true)
  );
}

function component(definition) {
  const value = {
    id: definition.id,
    role: definition.role,
    parentId: definition.parentId || null,
    hostId: definition.hostId || null,
    bounds: clone(definition.bounds),
    size: {
      x: dimension(definition.bounds, "x"),
      y: dimension(definition.bounds, "y"),
      z: dimension(definition.bounds, "z")
    },
    position: {
      x: midpoint(definition.bounds.min.x, definition.bounds.max.x),
      y: midpoint(definition.bounds.min.y, definition.bounds.max.y),
      z: midpoint(definition.bounds.min.z, definition.bounds.max.z)
    },
    metadata: clone(definition.metadata || {})
  };
  return value;
}

function part(id, role, parentId, bounds, materialSlot, metadata = {}, hostId = parentId) {
  return component({
    id,
    role,
    parentId,
    hostId,
    bounds,
    metadata: { physical: true, materialSlot, ...metadata }
  });
}

function box(minX, maxX, minY, maxY, minZ, maxZ) {
  return {
    min: { x: round(minX), y: round(minY), z: round(minZ) },
    max: { x: round(maxX), y: round(maxY), z: round(maxZ) }
  };
}

function unionBounds(boundsList) {
  const valid = boundsList.filter(validBounds);
  if (!valid.length) return box(0, 0, 0, 0, 0, 0);
  return box(
    Math.min(...valid.map((value) => value.min.x)),
    Math.max(...valid.map((value) => value.max.x)),
    Math.min(...valid.map((value) => value.min.y)),
    Math.max(...valid.map((value) => value.max.y)),
    Math.min(...valid.map((value) => value.min.z)),
    Math.max(...valid.map((value) => value.max.z))
  );
}

function findTopologyFeature(topology, token) {
  const features = topology?.features;
  if (!features) return null;
  if (Array.isArray(features)) {
    return features.find((feature) => featureToken(feature).includes(token)) || null;
  }
  if (features[token]) return features[token];
  return Object.values(features).find((feature) => featureToken(feature).includes(token)) || null;
}

function featureToken(feature) {
  return `${feature?.id || ""} ${feature?.kind || ""} ${feature?.role || ""}`.toLowerCase();
}

function featureDimension(feature, axis) {
  const bounds = feature?.bounds || feature?.openingBounds || feature?.volume?.bounds;
  return validBounds(bounds) ? dimension(bounds, axis) : null;
}

function featureCoordinate(feature, side, axis) {
  const bounds = feature?.bounds || feature?.openingBounds || feature?.volume?.bounds;
  const value = Number(bounds?.[side]?.[axis]);
  return Number.isFinite(value) ? value : null;
}

function resolveMountingHeight(plan, installation) {
  return positive(
    plan.project?.measurements?.mountingHeight ??
    plan.project?.mountingHeight ??
    installation.anchors?.mountingHeight ??
    installation.anchors?.bottomY
  ) || 0;
}

function mapDedicatedFrontStyle(value) {
  return ({ "flat-panel": "flat", flat: "flat", shaker: "shaker", glass: "glass" })[value] || "shaker";
}

function validBounds(bounds) {
  return Boolean(bounds?.min && bounds?.max && ["x", "y", "z"].every((axis) => (
    Number.isFinite(Number(bounds.min[axis])) &&
    Number.isFinite(Number(bounds.max[axis])) &&
    Number(bounds.max[axis]) >= Number(bounds.min[axis])
  )));
}

function containsBounds(container, child, epsilon = 1e-6) {
  return ["x", "y", "z"].every((axis) => (
    child.min[axis] >= container.min[axis] - epsilon &&
    child.max[axis] <= container.max[axis] + epsilon
  ));
}

function dimension(bounds, axis) {
  return round(Number(bounds.max[axis]) - Number(bounds.min[axis]));
}

function midpoint(first, second) {
  return round((Number(first) + Number(second)) / 2);
}

function normalizeAxis(value, fallback) {
  const candidate = Array.isArray(value)
    ? value.map(Number)
    : value && typeof value === "object" ? [Number(value.x), Number(value.y), Number(value.z)] : fallback;
  if (candidate.length !== 3 || candidate.some((entry) => !Number.isFinite(entry))) return fallback;
  const length = Math.hypot(...candidate);
  return length > 0 ? candidate.map((entry) => entry / length) : fallback;
}

function vector(value) {
  return { x: round(value[0]), y: round(value[1]), z: round(value[2]) };
}

function validationIssue(code, componentId) {
  return { code, severity: "error", componentId };
}

function rejectionFrom(source, extra = {}) {
  return deepFreeze({
    accepted: false,
    schemaVersion: GUIDED_PRODUCT_DESCRIPTOR_SCHEMA_VERSION,
    engineVersion: GUIDED_PRODUCT_ENGINE_VERSION,
    ...clone(extra),
    errors: clone(source?.errors || [{ code: "GUIDED_PRODUCT_REJECTED", severity: "error" }]),
    warnings: clone(source?.warnings || extra.warnings || []),
    corrections: []
  });
}

function reject(code, detail = {}, extra = {}) {
  return rejectionFrom({
    errors: [{ code, severity: "error", ...detail }],
    warnings: extra.warnings || []
  }, extra);
}

function geometryOnly(value) {
  if (Array.isArray(value)) return value.map(geometryOnly);
  if (!value || typeof value !== "object") return value;
  const omitted = /^(finish|finishId|accentFinish|material|materialId|materialSlot|hardware|hardwareId|lighting|lightingWarmth|color|swatch|texture|price|pricing|total|preview|renderable|camera|cameraIntent|presentation)$/i;
  return Object.fromEntries(
    Object.keys(value)
      .filter((key) => !omitted.test(key))
      .sort()
      .map((key) => [key, geometryOnly(value[key])])
  );
}

function stableStringify(value) {
  return JSON.stringify(sortValue(value));
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key]) ]));
}

function fnv1a64(value) {
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(36).toUpperCase().padStart(13, "0").slice(-13);
}

function uniqueIssues(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = stableStringify(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function unique(items) {
  return [...new Set(items)];
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
}

function deepFreeze(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(deepFreeze));
  if (!value || typeof value !== "object") return value;
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, deepFreeze(item)])));
}

function positive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function yes(value) {
  return value === true || value === "yes" || value === "true" || value === 1;
}

function nearlyEqual(first, second, epsilon = 0.001) {
  return Math.abs(Number(first) - Number(second)) <= epsilon;
}

function round(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1e6) / 1e6;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function slug(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "installation";
}
