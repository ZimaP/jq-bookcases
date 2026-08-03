import {
  TV_DRAWING_4_TEMPLATE_ID,
  layoutPresets
} from "./bookcase-config.js?v=tv-drawing-4-geometry-v1-20260802a";
import {
  CONSTRUCTION_RULES,
  getSectionCountLimits,
  resolveDoorArrangement
} from "./bookcase-layout.js?v=tv-drawing-4-geometry-v1-20260802a";
import { DEFAULT_INSTALLATION_FIT_POLICY } from "./guided-installation-solver.js?v=luxury-configurator-engine-v1";

/**
 * Pure guided-product adaptation contract.
 *
 * This module translates customer intent plus an already accepted topology/fit
 * transaction into canonical product-engine input. It owns no DOM, renderer,
 * mesh, pricing, or room-fit behavior.
 */

export const GUIDED_PRODUCT_ADAPTER_VERSION = 2;

export const GUIDED_PRODUCT_FAILURES = deepFreeze({
  unknownProduct: "UNKNOWN_PRODUCT_ARCHETYPE",
  unknownLayout: "UNKNOWN_ROOM_LAYOUT",
  topologyNotAccepted: "ROOM_TOPOLOGY_NOT_ACCEPTED",
  fitNotAccepted: "INSTALLATION_FIT_NOT_ACCEPTED",
  topologyMismatch: "TOPOLOGY_LAYOUT_MISMATCH",
  unsupportedLayout: "UNSUPPORTED_PRODUCT_LAYOUT",
  missingRequirements: "MISSING_PRODUCT_LAYOUT_REQUIREMENTS",
  noInstallation: "NO_COMPATIBLE_INSTALLATION_ZONE",
  invalidInstallation: "INVALID_INSTALLATION_FIT",
  globalScale: "GLOBAL_SCALE_NOT_ALLOWED",
  tvMeasurements: "TV_MEASUREMENTS_REQUIRED",
  tvDimensions: "INVALID_TV_DIMENSIONS",
  tvDrawing4TemplateFit: "TV_DRAWING_4_TEMPLATE_FIT_REJECTED",
  tvZone: "TV_REQUIRES_SINGLE_MEDIA_ZONE",
  windowZone: "WINDOW_STORAGE_REQUIRES_BELOW_WINDOW_ZONE",
  radiatorZone: "RADIATOR_COVER_REQUIRES_FEATURE_ZONE"
});

export const GUIDED_PRODUCT_POLICY = deepFreeze({
  units: "inches",
  panelThickness: CONSTRUCTION_RULES.panelThickness,
  minimumSectionClearWidth: CONSTRUCTION_RULES.minSectionClearWidth,
  minimumCanonicalZoneWidth: CONSTRUCTION_RULES.minWidth
    + DEFAULT_INSTALLATION_FIT_POLICY.fillers.preferredEach * 2,
  floating: {
    defaultBankHeight: 24,
    minimumBankHeight: 12,
    maximumBankHeight: 36,
    sourceStatus: "provisional-design-default"
  },
  windowStorage: {
    openingClearance: 1,
    minimumUsableHeight: 12,
    sourceStatus: "fit-policy-window-trim"
  },
  radiator: {
    serviceClearance: 2,
    topThickness: 0.75,
    slatWidth: 0.5,
    slatPitch: 1.5,
    sourceStatus: "fit-policy-radiator-service"
  },
  tv: {
    defaultAspectRatio: [16, 9],
    sideServiceClearance: 2,
    topServiceClearance: 2,
    bottomServiceClearance: 2,
    soundbarZoneHeight: 4.5,
    equipmentVentClearance: 1,
    dimensionalConflictTolerance: 1,
    sourceStatus: "fit-policy-provisional-shop-confirmation"
  }
});

export const GUIDED_PRODUCT_ARCHETYPES = deepFreeze([
  {
    id: "cabinet-shelves",
    categoryId: "bookcase",
    styleId: "cabinet-base-shelves",
    archetype: "lower-door-bookcase",
    engine: "existing-bookcase",
    baseMode: "floor",
    topMode: "fitted"
  },
  {
    id: "drawer-shelves",
    categoryId: "bookcase",
    styleId: "drawer-base-shelves",
    archetype: "lower-drawer-bookcase",
    engine: "existing-bookcase",
    baseMode: "floor",
    topMode: "fitted"
  },
  {
    id: "open-shelving",
    categoryId: "bookcase",
    styleId: "full-open-shelving",
    archetype: "full-open-bookcase",
    engine: "existing-bookcase",
    baseMode: "floor",
    topMode: "fitted"
  },
  {
    id: "tv-unit",
    categoryId: "tv-unit",
    styleId: "framed-tv-wall",
    archetype: "media-wall",
    engine: "existing-bookcase-media-adapter",
    baseMode: "floor",
    topMode: "fitted"
  },
  {
    id: "floating-storage",
    categoryId: "floating-storage",
    styleId: "floating-drawer-bank",
    archetype: "floating-bank",
    engine: "new-deterministic-builder",
    baseMode: "floating",
    topMode: "none"
  },
  {
    id: "window-storage",
    categoryId: "window-storage",
    styleId: "window-seat-storage",
    archetype: "window-storage",
    engine: "new-deterministic-builder",
    baseMode: "floor",
    topMode: "feature-fit"
  },
  {
    id: "radiator-cover",
    categoryId: "radiator-cover",
    styleId: "clean-slat-cover",
    archetype: "ventilated-radiator-cover",
    engine: "new-deterministic-builder",
    baseMode: "floor",
    topMode: "feature-fit"
  }
]);

export const GUIDED_PRODUCT_LAYOUT_COMPATIBILITY = deepFreeze({
  "cabinet-shelves": {
    "niche-layout": "supported",
    "left-niche": "supported",
    "right-niche": "supported",
    "clear-wall": "supported",
    "fireplace-wall": "conditional",
    "center-recess": "conditional",
    "window-wall": "conditional",
    "door-wall": "conditional",
    "corner-wall": "conditional",
    "double-opening": "supported"
  },
  "drawer-shelves": {
    "niche-layout": "supported",
    "left-niche": "supported",
    "right-niche": "supported",
    "clear-wall": "supported",
    "fireplace-wall": "conditional",
    "center-recess": "conditional",
    "window-wall": "conditional",
    "door-wall": "conditional",
    "corner-wall": "conditional",
    "double-opening": "supported"
  },
  "open-shelving": {
    "niche-layout": "supported",
    "left-niche": "supported",
    "right-niche": "supported",
    "clear-wall": "supported",
    "fireplace-wall": "conditional",
    "center-recess": "conditional",
    "window-wall": "conditional",
    "door-wall": "conditional",
    "corner-wall": "conditional",
    "double-opening": "supported"
  },
  "tv-unit": {
    "niche-layout": "supported",
    "left-niche": "supported",
    "right-niche": "supported",
    "clear-wall": "supported",
    "fireplace-wall": "conditional",
    "center-recess": "unavailable",
    "window-wall": "unavailable",
    "door-wall": "conditional",
    "corner-wall": "conditional",
    "double-opening": "supported"
  },
  "floating-storage": {
    "niche-layout": "supported",
    "left-niche": "supported",
    "right-niche": "supported",
    "clear-wall": "supported",
    "fireplace-wall": "conditional",
    "center-recess": "conditional",
    "window-wall": "supported",
    "door-wall": "conditional",
    "corner-wall": "supported",
    "double-opening": "supported"
  },
  "window-storage": {
    "niche-layout": "unavailable",
    "left-niche": "unavailable",
    "right-niche": "unavailable",
    "clear-wall": "unavailable",
    "fireplace-wall": "unavailable",
    "center-recess": "unavailable",
    "window-wall": "supported",
    "door-wall": "unavailable",
    "corner-wall": "unavailable",
    "double-opening": "unavailable"
  },
  "radiator-cover": {
    "niche-layout": "unavailable",
    "left-niche": "unavailable",
    "right-niche": "unavailable",
    "clear-wall": "unavailable",
    "fireplace-wall": "unavailable",
    "center-recess": "unavailable",
    "window-wall": "supported",
    "door-wall": "unavailable",
    "corner-wall": "unavailable",
    "double-opening": "unavailable"
  }
});

const PRODUCT_BY_ID = new Map(GUIDED_PRODUCT_ARCHETYPES.map((item) => [item.id, item]));
const PRODUCT_BY_SELECTION = new Map(
  GUIDED_PRODUCT_ARCHETYPES.map((item) => [`${item.categoryId}:${item.styleId}`, item])
);

const CONDITIONAL_LAYOUT_FIELDS = deepFreeze({
  "fireplace-wall": ["fireplaceWidth", "fireplaceHeight", "fireplaceDepth"],
  "center-recess": ["projectionWidth", "projectionHeight", "projectionDepth"],
  "window-wall": ["windowWidth", "windowHeight", "sillHeight"],
  "door-wall": ["doorWidth", "doorHeight", "doorLeftDistance", "doorTrimWidth"],
  "corner-wall": ["cornerReturn"],
  "double-opening": ["openingLeftDistance", "openingRightDistance"]
});

const PRODUCT_REQUIRED_FIELDS = deepFreeze({
  "floating-storage": ["mountingHeight"],
  "window-storage": ["windowWidth", "windowHeight", "sillHeight"],
  "radiator-cover": ["radiatorWidth", "radiatorHeight", "radiatorDepth"]
});

const PRESET_BY_ID = new Map(layoutPresets.map((preset) => [preset.id, preset.config]));

export function resolveGuidedProductId(project = {}) {
  const direct = String(project?.productId || project?.productChoiceId || "").trim();
  if (PRODUCT_BY_ID.has(direct)) return direct;
  return PRODUCT_BY_SELECTION.get(`${project?.category || ""}:${project?.style || ""}`)?.id || null;
}

export function getGuidedProductArchetype(productOrProject = {}) {
  const id = typeof productOrProject === "string"
    ? productOrProject
    : resolveGuidedProductId(productOrProject);
  return PRODUCT_BY_ID.get(id) || null;
}

/**
 * Pre-fit product intent for solveInstallation(). This is intentionally a
 * smaller contract than the accepted post-fit candidate below.
 */
export function createGuidedProductIntent(project = {}, topology = null) {
  const productId = resolveGuidedProductId(project);
  const archetype = PRODUCT_BY_ID.get(productId);
  if (!archetype) return reject(GUIDED_PRODUCT_FAILURES.unknownProduct);
  const measurements = clone(project.measurements || {});
  const installationMode = productId === "floating-storage"
    ? "floating"
    : project.baseStyle === "furniture-base" ? "freestanding" : "fitted";
  const preferredZoneIds = resolvePreferredZoneIds(productId, topology, project);
  const zoneRoles = productId === "window-storage"
    ? ["below-window"]
    : productId === "radiator-cover"
      ? ["below-window", "radiator", "feature"]
      : productId === "tv-unit"
        ? ["main", "center", "between-openings", "optional-over-mantel", "primary-run", "surround"]
        : [];
  return deepFreeze({
    accepted: true,
    id: productId,
    productId,
    archetype: archetype.archetype,
    engine: archetype.engine,
    caseworkWidthStep: archetype.engine.startsWith("existing-bookcase") ? 1 : null,
    installationMode,
    baseStyle: project.baseStyle || null,
    topTreatment: project.topTreatment || null,
    mountingHeight: positive(measurements.mountingHeight ?? project.mountingHeight),
    installationZoneIds: preferredZoneIds,
    preferredZoneIds,
    zoneRoles,
    allowedZoneRoles: zoneRoles,
    measurements
  });
}

export function resolveProductLayoutCompatibility({ project = {}, topology = {}, fit = null } = {}) {
  const productId = resolveGuidedProductId(project);
  const layoutId = topology?.layoutId || project?.layoutId || project?.layout || null;
  const configuredStatus = productId && layoutId
    ? GUIDED_PRODUCT_LAYOUT_COMPATIBILITY[productId]?.[layoutId] || "unavailable"
    : "unavailable";
  const tvAboveFireplace = project?.measurements?.tvAboveFireplace;
  const isFireplaceMedia = productId === "tv-unit"
    && ["fireplace-wall", "center-recess"].includes(layoutId);
  const status = isFireplaceMedia && tvAboveFireplace !== undefined && tvAboveFireplace !== null
    ? yes(tvAboveFireplace) ? "review-only" : "unavailable"
    : configuredStatus;
  const requiredFields = unique([
    ...(PRODUCT_REQUIRED_FIELDS[productId] || []),
    ...(status === "conditional" ? CONDITIONAL_LAYOUT_FIELDS[layoutId] || [] : [])
  ]);
  const missingFields = requiredFields.filter(
    (field) => !hasRequiredValue(field, project, topology, fit)
  );
  const tvRequirementSatisfied = productId !== "tv-unit" || hasTvMeasurementSet(project?.measurements);
  const requirementGroups = productId === "tv-unit"
    ? [{ anyOf: ["tvScreenSize", "tvBodyWidth+tvBodyHeight"], satisfied: tvRequirementSatisfied }]
    : [];
  const unavailable = status === "unavailable";
  const ready = !unavailable && missingFields.length === 0 && tvRequirementSatisfied;

  return deepFreeze({
    productId,
    layoutId,
    status,
    ready,
    requiredFields,
    missingFields,
    requirementGroups,
    code: unavailable
      ? GUIDED_PRODUCT_FAILURES.unsupportedLayout
      : ready ? null : GUIDED_PRODUCT_FAILURES.missingRequirements
  });
}

/**
 * Resolve a real TV body and its service opening. Explicit body dimensions win;
 * diagonal-only values use the centralized aspect ratio. A supplied diagonal
 * plus one explicit body dimension uses Pythagoras rather than silently
 * pretending the explicit measurement still has the default aspect ratio.
 */
export function deriveCanonicalTvGeometry(measurements = {}, options = {}) {
  const policy = mergePolicy(GUIDED_PRODUCT_POLICY.tv, options.policy?.tv || options.policy);
  const diagonal = positive(measurements.tvScreenSize ?? measurements.tvDiagonal);
  const explicitWidth = positive(measurements.tvBodyWidth ?? measurements.tvWidth);
  const explicitHeight = positive(measurements.tvBodyHeight ?? measurements.tvHeight);
  let bodyWidth = explicitWidth;
  let bodyHeight = explicitHeight;
  const [aspectWidth, aspectHeight] = policy.defaultAspectRatio;
  const denominator = Math.hypot(aspectWidth, aspectHeight);
  const warnings = [];
  const inference = { width: null, height: null };

  if (!diagonal && !(bodyWidth && bodyHeight)) {
    return reject(GUIDED_PRODUCT_FAILURES.tvMeasurements, {
      message: "Enter a TV diagonal or explicit TV body width and height."
    });
  }

  if (diagonal && !explicitWidth && !explicitHeight) {
    bodyWidth = diagonal * aspectWidth / denominator;
    bodyHeight = diagonal * aspectHeight / denominator;
    inference.width = "default-aspect-ratio";
    inference.height = "default-aspect-ratio";
  }

  if (
    diagonal
    && ((explicitHeight && !explicitWidth && diagonal <= explicitHeight)
      || (explicitWidth && !explicitHeight && diagonal <= explicitWidth))
  ) {
    return reject(GUIDED_PRODUCT_FAILURES.tvDimensions, {
      message: "The entered TV diagonal must be larger than either explicit body dimension.",
      enteredDiagonal: round(diagonal),
      explicitWidth: explicitWidth ? round(explicitWidth) : null,
      explicitHeight: explicitHeight ? round(explicitHeight) : null
    });
  }

  if (!bodyWidth) {
    if (diagonal && bodyHeight && diagonal > bodyHeight) {
      bodyWidth = Math.sqrt(diagonal ** 2 - bodyHeight ** 2);
      inference.width = "diagonal-and-explicit-height";
    } else if (diagonal) {
      bodyWidth = diagonal * aspectWidth / denominator;
      inference.width = "default-aspect-ratio";
    } else if (bodyHeight) {
      bodyWidth = bodyHeight * aspectWidth / aspectHeight;
      inference.width = "default-aspect-ratio";
    }
  }

  if (!bodyHeight) {
    if (diagonal && bodyWidth && diagonal > bodyWidth) {
      bodyHeight = Math.sqrt(diagonal ** 2 - bodyWidth ** 2);
      inference.height = "diagonal-and-explicit-width";
    } else if (diagonal) {
      bodyHeight = diagonal * aspectHeight / denominator;
      inference.height = "default-aspect-ratio";
    } else if (bodyWidth) {
      bodyHeight = bodyWidth * aspectHeight / aspectWidth;
      inference.height = "default-aspect-ratio";
    }
  }

  if (!positive(bodyWidth) || !positive(bodyHeight)) {
    return reject(GUIDED_PRODUCT_FAILURES.tvDimensions, {
      message: "The TV measurements do not resolve to positive body dimensions."
    });
  }

  if (diagonal && explicitWidth && explicitHeight) {
    const explicitDiagonal = Math.hypot(bodyWidth, bodyHeight);
    if (Math.abs(explicitDiagonal - diagonal) > policy.dimensionalConflictTolerance) {
      warnings.push({
        code: "TV_DIMENSIONS_CONFLICT",
        severity: "warning",
        message: "Explicit TV body dimensions differ from the entered diagonal; explicit body dimensions were preserved.",
        enteredDiagonal: round(diagonal),
        bodyDiagonal: round(explicitDiagonal)
      });
    }
  }

  const soundbarRequired = yes(measurements.soundbarRequired ?? measurements.equipmentRequired);
  const openingWidth = bodyWidth + policy.sideServiceClearance * 2;
  const openingHeight = bodyHeight + policy.topServiceClearance + policy.bottomServiceClearance;

  return deepFreeze({
    accepted: true,
    units: "inches",
    diagonal: round(diagonal || Math.hypot(bodyWidth, bodyHeight)),
    body: {
      width: round(bodyWidth),
      height: round(bodyHeight),
      derivation: inference
    },
    serviceClearance: {
      left: policy.sideServiceClearance,
      right: policy.sideServiceClearance,
      top: policy.topServiceClearance,
      bottom: policy.bottomServiceClearance
    },
    opening: {
      width: round(openingWidth),
      height: round(openingHeight)
    },
    soundbar: {
      required: soundbarRequired,
      zoneHeight: soundbarRequired ? policy.soundbarZoneHeight : 0,
      ventilationClearance: soundbarRequired ? policy.equipmentVentClearance : 0
    },
    requiredAssemblyHeight: round(
      openingHeight + (soundbarRequired ? policy.soundbarZoneHeight + policy.equipmentVentClearance : 0)
    ),
    mountingMode: measurements.tvMounting || "not-sure",
    outletLocation: measurements.outletLocation || "unknown",
    warnings
  });
}

/**
 * Create the renderer-independent product plan consumed by
 * evaluateGuidedProductCandidate().
 */
export function createGuidedProductCandidate({ project = {}, topology = {}, fit = {}, policy = null } = {}) {
  const productId = resolveGuidedProductId(project);
  const archetype = PRODUCT_BY_ID.get(productId);
  if (!archetype) return reject(GUIDED_PRODUCT_FAILURES.unknownProduct);
  if (topology?.accepted !== true) return reject(GUIDED_PRODUCT_FAILURES.topologyNotAccepted);
  if (fit?.accepted !== true) return reject(GUIDED_PRODUCT_FAILURES.fitNotAccepted);

  const layoutId = topology.layoutId || project.layoutId || project.layout;
  const requestedLayoutId = project.layoutId || project.layout || layoutId;
  if (!layoutId) return reject(GUIDED_PRODUCT_FAILURES.unknownLayout);
  if (requestedLayoutId && requestedLayoutId !== layoutId) {
    return reject(GUIDED_PRODUCT_FAILURES.topologyMismatch, {
      requestedLayoutId,
      topologyLayoutId: layoutId
    });
  }

  const compatibility = resolveProductLayoutCompatibility({ project, topology, fit });
  if (compatibility.status === "unavailable") {
    return reject(GUIDED_PRODUCT_FAILURES.unsupportedLayout, { productId, layoutId, compatibility });
  }
  if (!compatibility.ready) {
    return reject(GUIDED_PRODUCT_FAILURES.missingRequirements, {
      productId,
      layoutId,
      compatibility,
      missingFields: compatibility.missingFields
    });
  }

  const normalizedInstallations = normalizeInstallations(fit);
  const invalidInstallation = normalizedInstallations.find((installation) => !validInstallation(installation));
  if (!normalizedInstallations.length) return reject(GUIDED_PRODUCT_FAILURES.noInstallation);
  if (invalidInstallation) {
    return reject(GUIDED_PRODUCT_FAILURES.invalidInstallation, { installationId: invalidInstallation.id });
  }
  if (normalizedInstallations.some((installation) => !hasUnitRootScale(installation))) {
    return reject(GUIDED_PRODUCT_FAILURES.globalScale);
  }

  const selection = selectProductInstallations(productId, normalizedInstallations);
  if (!selection.accepted) return selection;

  const resolvedPolicy = mergePolicy(GUIDED_PRODUCT_POLICY, policy);
  const tv = productId === "tv-unit"
    ? deriveCanonicalTvGeometry(project.measurements, { policy: resolvedPolicy })
    : null;
  if (tv && !tv.accepted) return tv;

  const warnings = [
    ...(compatibility.status === "review-only" ? [{
      code: "PRODUCT_LAYOUT_REVIEW_REQUIRED",
      severity: "warning",
      message: "This product and room combination requires design review."
    }] : []),
    ...(tv?.warnings || [])
  ];
  const canonicalConfigs = [];
  if (archetype.engine.startsWith("existing-bookcase")) {
    for (const installation of selection.installations) {
      if (installation.role === "corner-join") continue;
      const built = buildCanonicalBookcaseConfig({ productId, project, installation, tv });
      if (built.accepted === false) return built;
      warnings.push(...built.warnings);
      canonicalConfigs.push({
        installationId: installation.id,
        zoneId: installation.zoneId,
        config: built.config
      });
    }
  }

  return deepFreeze({
    accepted: true,
    adapterVersion: GUIDED_PRODUCT_ADAPTER_VERSION,
    productId,
    layoutId,
    archetype,
    compatibility,
    project,
    topology,
    fit,
    installations: selection.installations,
    canonicalConfigs,
    tv,
    policy: resolvedPolicy,
    warnings,
    errors: []
  });
}

// Explicit alias for integration code that uses the architecture document's name.
export const createCanonicalCandidate = createGuidedProductCandidate;

export function buildCanonicalBookcaseConfig({ productId, project = {}, installation, tv = null }) {
  const dimensions = installation.casework;
  const basePresetId = productId === "open-shelving"
    ? "classic-open"
    : productId === "tv-unit" ? "media-wall" : "lower-cabinets";
  const preset = clone(PRESET_BY_ID.get(basePresetId) || {});
  const warnings = [];
  const baseStyle = mapBaseStyle(project.baseStyle);
  const crownStyle = mapTopTreatment(project.topTreatment);
  const hardware = mapHardware(project.hardware, productId);
  const lighting = mapLighting(project.lighting);
  const doorStyle = mapDoorStyle(project.doorStyle);
  const width = round(dimensions.width);
  const height = round(dimensions.overallHeight);
  const depth = round(dimensions.depth);
  let sections;
  let layoutMetadata;

  if (productId === "tv-unit") {
    const media = solveDrawing4TvModulePlan(width, tv?.opening?.width);
    if (!media.accepted) return media;
    sections = media.sections;
    layoutMetadata = {
      constructionTemplateId: TV_DRAWING_4_TEMPLATE_ID,
      specialSpan: media.specialSpan,
      sectionRatios: media.clearWidths,
      sectionTypes: Array.from({ length: sections }, () => "lower_doors"),
      sectionDoorLayouts: Array.from({ length: sections }, () => ({ arrangement: "pair" }))
    };
  } else {
    sections = chooseCanonicalSectionCount(width);
    const sectionType = productId === "drawer-shelves"
      ? "drawers"
      : productId === "open-shelving" ? "open" : "lower_doors";
    layoutMetadata = {
      sectionRatios: Array.from({ length: sections }, () => 1),
      sectionTypes: Array.from({ length: sections }, () => sectionType),
      sectionDoorLayouts: Array.from({ length: sections }, () => ({ arrangement: "auto" }))
    };
  }

  const lowerCabinets = productId !== "open-shelving";
  const lowerStorage = productId === "drawer-shelves" ? "drawers" : "doors";
  const config = {
    ...preset,
    layoutPreset: basePresetId,
    layoutType: productId === "tv-unit"
      ? "media_wall"
      : productId === "open-shelving" ? "classic" : productId === "drawer-shelves" ? "lower_drawers" : "lower_cabinets",
    width,
    height,
    depth,
    sections,
    shelves: finiteInteger(project.shelves, preset.shelves || 4),
    lowerCabinets,
    lowerStorage,
    drawerCount: finiteInteger(project.drawerCount, 3),
    centerOpening: productId === "tv-unit",
    deskOpening: false,
    featureOpening: false,
    tallDoors: false,
    doorStyle,
    drawerFrontStyle: doorStyle === "glass" ? "flat" : doorStyle,
    hardware: productId === "open-shelving" ? "push_latch" : hardware,
    lighting,
    lightingWarmth: finiteInteger(project.lightingWarmth, 2700),
    finish: project.finish,
    customPaintColor: project.customPaintColor || "",
    customPaintCode: project.customPaintCode || "",
    customPaintHex: project.customPaintHex || "",
    crownStyle,
    baseStyle,
    layoutMetadata,
    installation: project.installation || "professional",
    delivery: project.delivery || "standard"
  };

  return { accepted: true, config, warnings };
}

/**
 * Resolve the Drawing 4 horizontal module contract without generating any
 * geometry. The central service opening is authoritative: it includes the
 * reserved center structural-panel width, while each returned value is a
 * clear module width. Unsupported candidates fail closed instead of falling
 * back to a different media-wall arrangement.
 */
export function solveDrawing4TvModulePlan(caseworkWidth, serviceOpeningWidth) {
  const width = Number(caseworkWidth);
  const opening = Number(serviceOpeningWidth);
  const rules = CONSTRUCTION_RULES;
  const panel = rules.panelThickness;
  const minimumPairOpening = round(
    rules.minDoorLeafWidth * 2 + rules.doorReveal * 2 + rules.doubleDoorCenterGap
  );
  const minimumSideWidth = Math.max(rules.minSectionClearWidth, minimumPairOpening);
  const maximumShelfSpan = 36;
  const minimumCaseworkWidth = round(opening + panel * 4 + minimumSideWidth * 2);
  const maximumCaseworkWidth = round(opening + panel * 4 + maximumShelfSpan * 2);
  const failure = (reason, detail = {}) => reject(
    GUIDED_PRODUCT_FAILURES.tvDrawing4TemplateFit,
    {
      reason,
      message: "The fitted TV run cannot preserve the Drawing 4 module, paired-door, and shelf-span contract.",
      caseworkWidth: Number.isFinite(width) ? round(width) : null,
      serviceOpeningWidth: Number.isFinite(opening) ? round(opening) : null,
      minimumCaseworkWidth: Number.isFinite(minimumCaseworkWidth) ? minimumCaseworkWidth : null,
      maximumCaseworkWidth: Number.isFinite(maximumCaseworkWidth) ? maximumCaseworkWidth : null,
      ...detail
    }
  );

  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(opening) || opening <= panel) {
    return failure("INVALID_TEMPLATE_DIMENSIONS");
  }

  const centerClear = round((opening - panel) / 2);
  const sideClear = round((width - opening - panel * 4) / 2);
  const clearWidths = [sideClear, centerClear, centerClear, sideClear];
  const closure = round(clearWidths.reduce((sum, value) => sum + value, 0) + panel * 5);
  // Each persisted symmetric clear width is rounded to six places. Two pairs
  // can therefore accumulate up to four half-steps without representing a
  // physical closure failure.
  if (Math.abs(closure - width) > 0.0000021) {
    return failure("MODULE_WIDTH_CLOSURE_MISMATCH", { closure });
  }
  if (sideClear + 1e-6 < minimumSideWidth) {
    return failure("SIDE_MODULE_PAIRED_DOORS_UNBUILDABLE", {
      sideClearWidth: sideClear,
      minimumSideWidth
    });
  }
  if (sideClear > maximumShelfSpan + 1e-6) {
    return failure("SIDE_MODULE_SHELF_SPAN_EXCEEDED", {
      sideClearWidth: sideClear,
      maximumShelfSpan
    });
  }
  if (centerClear + 1e-6 < rules.minSectionClearWidth) {
    return failure("CENTER_MODULE_BELOW_MINIMUM_WIDTH", {
      centerClearWidth: centerClear,
      minimumSectionClearWidth: rules.minSectionClearWidth
    });
  }
  if (centerClear > maximumShelfSpan + 1e-6) {
    return failure("CENTER_MODULE_SHELF_SPAN_EXCEEDED", {
      centerClearWidth: centerClear,
      maximumShelfSpan
    });
  }

  const arrangements = clearWidths.map((clearWidth, index) => resolveDoorArrangement({
    opening: { size: { x: clearWidth } },
    requested: "pair",
    openingKind: "lower_cabinet",
    sectionIndex: index,
    sectionCount: 4
  }));
  const invalidArrangement = arrangements.findIndex((arrangement) => !arrangement.valid);
  if (invalidArrangement >= 0) {
    return failure("MODULE_PAIRED_DOORS_UNBUILDABLE", {
      moduleIndex: invalidArrangement,
      clearWidth: clearWidths[invalidArrangement],
      arrangementReason: arrangements[invalidArrangement].reason
    });
  }

  return deepFreeze({
    accepted: true,
    templateId: TV_DRAWING_4_TEMPLATE_ID,
    units: "inches",
    sections: 4,
    specialSpan: 2,
    specialIndices: [1, 2],
    serviceOpeningWidth: round(opening),
    panelThickness: panel,
    clearWidths,
    sideClearWidth: sideClear,
    centerClearWidth: centerClear,
    minimumCaseworkWidth,
    maximumCaseworkWidth,
    pairedDoorLeafWidths: arrangements.map((arrangement) => arrangement.leafWidth),
    warnings: [],
    errors: []
  });
}

function resolvePreferredZoneIds(productId, topology, project = {}) {
  const zones = Array.isArray(topology?.installationZones) ? topology.installationZones : [];
  if (!zones.length) return [];
  const canonicalBookcase = ["cabinet-shelves", "drawer-shelves", "open-shelving"].includes(productId);
  if (
    canonicalBookcase
    && ["fireplace-wall", "center-recess", "door-wall"].includes(topology?.layoutId)
  ) {
    const defaultZones = zones.filter((zone) => zone.installByDefault !== false);
    const eligible = defaultZones.filter((zone) => (
      zoneWidth(zone) + 1e-6 >= GUIDED_PRODUCT_POLICY.minimumCanonicalZoneWidth
    ));
    const selected = eligible.length
      ? eligible
      : defaultZones.slice().sort((left, right) => zoneWidth(right) - zoneWidth(left)).slice(0, 1);
    return selected.map((zone) => zone.id);
  }
  if (
    canonicalBookcase
    && topology?.layoutId === "window-wall"
  ) {
    return zones
      .filter((zone) => !zoneToken(zone).includes("below-window"))
      .filter((zone) => ["left", "right"].some((token) => zoneToken(zone).includes(token)))
      .map((zone) => zone.id);
  }
  if (productId === "floating-storage" && topology?.layoutId === "window-wall") {
    const sideZones = zones
      .filter((zone) => ["left", "right"].some((token) => zoneToken(zone).includes(token)))
      .sort((left, right) => {
        const widthDifference = zoneWidth(right) - zoneWidth(left);
        return Math.abs(widthDifference) > 1e-6
          ? widthDifference
          : String(left.id).localeCompare(String(right.id));
      });
    return sideZones[0]?.id ? [sideZones[0].id] : [];
  }
  if (productId === "window-storage") {
    return zones.filter((zone) => zoneToken(zone).includes("below-window")).map((zone) => zone.id);
  }
  if (productId === "radiator-cover") {
    const belowWindow = zones.filter((zone) => zoneToken(zone).includes("below-window"));
    if (belowWindow.length) return belowWindow.map((zone) => zone.id);
    return zones.filter((zone) => {
      const id = String(zone?.id || "").toLowerCase();
      const role = String(zone?.role || "").toLowerCase();
      return id.includes("radiator") || role === "radiator" || role === "feature";
    }).map((zone) => zone.id);
  }
  if (productId !== "tv-unit") return [];
  const isFireplaceMedia = ["fireplace-wall", "center-recess"].includes(topology?.layoutId);
  if (isFireplaceMedia && !yes(project?.measurements?.tvAboveFireplace)) return [];
  const preferredTokens = isFireplaceMedia
    ? ["optional-over-mantel"]
    : ["surround", "main", "center", "between-openings", "primary-run"];
  let candidates = [];
  for (const token of preferredTokens) {
    const matches = zones.filter((zone) => zoneToken(zone).includes(token));
    if (matches.length) {
      candidates = matches;
      break;
    }
  }
  if (!candidates.length) candidates = zones.filter((zone) => zone.installByDefault !== false);
  if (!candidates.length) return [];
  const selected = candidates.slice().sort((left, right) => {
    const widthDifference = zoneWidth(right) - zoneWidth(left);
    return Math.abs(widthDifference) > 1e-6 ? widthDifference : String(left.id).localeCompare(String(right.id));
  })[0];
  return selected?.id ? [selected.id] : [];
}

function zoneToken(zone) {
  return `${zone?.id || ""} ${zone?.role || ""}`.toLowerCase();
}

function zoneWidth(zone) {
  const left = Number(zone?.leftPlaneX);
  const right = Number(zone?.rightPlaneX);
  return Number.isFinite(left) && Number.isFinite(right) ? Math.max(0, right - left) : 0;
}

function chooseCanonicalSectionCount(width) {
  const limits = getSectionCountLimits({ width });
  const target = Math.max(1, Math.min(6, Math.round(width / 24)));
  return limits.allowed.reduce((best, candidate) => {
    const distance = Math.abs(candidate - target);
    const bestDistance = Math.abs(best - target);
    return distance < bestDistance || (distance === bestDistance && candidate > best) ? candidate : best;
  }, limits.allowed[0]);
}

function selectProductInstallations(productId, installations) {
  if (productId === "tv-unit") {
    const media = installations.filter((installation) => tokenIncludes(installation, ["media", "surround", "over-mantel"]));
    const selected = media.length === 1 ? media : installations;
    if (selected.length !== 1) return reject(GUIDED_PRODUCT_FAILURES.tvZone, { installationCount: installations.length });
    return { accepted: true, installations: selected };
  }
  if (productId === "window-storage") {
    const below = installations.filter((installation) => tokenIncludes(installation, ["below-window", "below_window", "window-seat"]));
    if (!below.length) return reject(GUIDED_PRODUCT_FAILURES.windowZone);
    return { accepted: true, installations: below };
  }
  if (productId === "radiator-cover") {
    const feature = installations.filter((installation) => tokenIncludes(installation, ["below-window", "radiator", "feature"]));
    if (!feature.length && installations.length !== 1) return reject(GUIDED_PRODUCT_FAILURES.radiatorZone);
    return { accepted: true, installations: feature.length ? feature : installations };
  }
  return { accepted: true, installations };
}

function tokenIncludes(installation, candidates) {
  const token = `${installation.id || ""} ${installation.zoneId || ""} ${installation.role || ""}`.toLowerCase();
  return candidates.some((candidate) => token.includes(candidate));
}

function normalizeInstallations(fit) {
  const source = Array.isArray(fit?.installations) && fit.installations.length
    ? fit.installations
    : fit?.casework ? [{
        id: "installation-01",
        zoneId: fit.zoneId || "main",
        role: "main",
        casework: fit.casework,
        treatments: fit.treatments,
        anchors: fit.anchors,
        orientation: fit.orientation,
        invariants: fit.invariants
      }] : [];
  return source.map((installation, index) => ({
    ...installation,
    id: installation.id || `installation-${String(index + 1).padStart(2, "0")}`,
    zoneId: installation.zoneId || fit.zoneIds?.[index] || `zone-${String(index + 1).padStart(2, "0")}`,
    casework: { ...(installation.casework || {}) },
    treatments: { ...(installation.treatments || {}) },
    anchors: { ...(installation.anchors || {}) },
    orientation: installation.orientation || null,
    invariants: installation.invariants || fit.invariants || { rootScale: [1, 1, 1] }
  }));
}

function validInstallation(installation) {
  return Boolean(
    installation?.id && installation?.zoneId &&
    positive(installation.casework?.width) &&
    positive(installation.casework?.overallHeight) &&
    positive(installation.casework?.depth)
  );
}

function hasUnitRootScale(installation) {
  const scale = installation?.invariants?.rootScale || [1, 1, 1];
  return Array.isArray(scale) && scale.length === 3 && scale.every((value) => Number(value) === 1);
}

function hasTvMeasurementSet(measurements = {}) {
  return Boolean(
    positive(measurements?.tvScreenSize ?? measurements?.tvDiagonal) ||
    (
      positive(measurements?.tvBodyWidth ?? measurements?.tvWidth) &&
      positive(measurements?.tvBodyHeight ?? measurements?.tvHeight)
    )
  );
}

function hasRequiredValue(field, project, topology, fit) {
  if (field === "mountingHeight") {
    return Boolean(
      positive(project?.measurements?.mountingHeight) ||
      positive(project?.mountingHeight) ||
      (fit?.installations || []).some((item) => positive(item?.anchors?.mountingHeight ?? item?.anchors?.bottomY)) ||
      positive(fit?.anchors?.mountingHeight ?? fit?.anchors?.bottomY)
    );
  }
  if (hasMeasurementValue(field, project?.measurements?.[field])) return true;
  return topologyHasMeasurement(topology, field);
}

function hasMeasurementValue(field, value) {
  if (value === null || value === undefined || value === "") return false;
  const number = Number(value);
  if (!Number.isFinite(number)) return false;
  return /(?:Distance|Return)$/.test(field) || field === "fireplaceDepth"
    ? number >= 0
    : number > 0;
}

function topologyHasMeasurement(topology, field) {
  const featureKind = field.startsWith("window") || field === "sillHeight"
    ? "window"
    : field.startsWith("radiator") ? "radiator"
      : field.startsWith("door") ? "door"
        : field.startsWith("fireplace") ? "fireplace"
          : field.startsWith("niche") ? "projection"
            : null;
  if (!featureKind) return false;
  const feature = findFeature(topology?.features, featureKind);
  if (!feature) return false;
  if (positive(feature[field])) return true;
  const bounds = feature.bounds || feature.openingBounds || feature.volume?.bounds;
  if (!bounds?.min || !bounds?.max) return false;
  if (field.endsWith("Width")) return positive(bounds.max.x - bounds.min.x) !== null;
  if (field.endsWith("Height")) return positive(bounds.max.y - bounds.min.y) !== null;
  if (field.endsWith("Depth")) return positive(bounds.max.z - bounds.min.z) !== null;
  if (field === "sillHeight") return Number.isFinite(Number(bounds.min.y));
  return false;
}

function findFeature(features, kind) {
  if (!features) return null;
  if (Array.isArray(features)) {
    return features.find((feature) => `${feature?.kind || ""} ${feature?.role || ""} ${feature?.id || ""}`.toLowerCase().includes(kind)) || null;
  }
  if (features[kind]) return features[kind];
  return Object.values(features).find((feature) => `${feature?.kind || ""} ${feature?.role || ""} ${feature?.id || ""}`.toLowerCase().includes(kind)) || null;
}

function mapDoorStyle(value) {
  return ({ "flat-panel": "flat", flat: "flat", shaker: "shaker", glass: "glass" })[value] || "shaker";
}

function mapHardware(value, productId) {
  if (productId === "open-shelving") return "push_latch";
  return ({
    knob: "matte_black_knob",
    "brass-pull": "brass_pull",
    "black-pull": "matte_black_pull",
    none: "push_latch"
  })[value] || "brass_pull";
}

function mapLighting(value) {
  return ({
    "no-lighting": "no_lighting",
    "warm-led": "warm_pucks",
    "integrated-led": "full_package"
  })[value] || "warm_pucks";
}

function mapBaseStyle(value) {
  return ({
    "flush-base": "plinth",
    "recessed-toe-kick": "toe_kick",
    "furniture-base": "furniture_base"
  })[value] || "plinth";
}

function mapTopTreatment(value) {
  return ({
    "simple-finished-top": "none",
    "small-crown": "slim_cap",
    "traditional-crown": "classic_crown"
  })[value] || "slim_cap";
}

function finiteInteger(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : fallback;
}

function yes(value) {
  return value === true || value === "yes" || value === "true" || value === 1;
}

function positive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function unique(values) {
  return [...new Set(values)];
}

function reject(code, detail = {}) {
  return deepFreeze({
    accepted: false,
    errors: [{ code, severity: "error", ...detail }],
    warnings: []
  });
}

function mergePolicy(base, override) {
  if (!override || typeof override !== "object") return clone(base);
  return Object.fromEntries(Object.entries(base).map(([key, value]) => [
    key,
    value && typeof value === "object" && !Array.isArray(value)
      ? mergePolicy(value, override[key])
      : override[key] ?? value
  ]));
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
}

function round(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1e6) / 1e6;
}

function deepFreeze(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(deepFreeze));
  if (!value || typeof value !== "object") return value;
  return Object.freeze(Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, deepFreeze(item)])
  ));
}
