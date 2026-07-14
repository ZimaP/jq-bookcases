import {
  CONSTRUCTION_PROFILE_IDS as CONFIG_CONSTRUCTION_PROFILE_IDS,
  DOOR_ARRANGEMENTS as CONFIG_DOOR_ARRANGEMENTS,
  getHardwareType,
  normalizeDrawerFrontStyleValue,
  normalizeSectionTypeValue
} from "./bookcase-config.js?v=configurator-construction-20260714b";

/**
 * Pure parametric layout engine for JQ Bookcases.
 *
 * All dimensions are inches. X is width (left to right), Y is height
 * (bottom to top), and Z is depth (front to back). The origin is the
 * bottom-center of the nominal carcass front plane. The carcass occupies
 * Z >= 0. New inset fronts extend inward (+Z) from the finished front plane;
 * handles project outward (-Z). Legacy overlay fronts retain their historical
 * negative-Z body through an explicit construction profile.
 */

export const SHELF_THICKNESS_OPTIONS = Object.freeze([0.75, 1, 1.25, 1.5, 1.75, 2]);
export const LIGHTING_WARMTH_OPTIONS = Object.freeze([2700, 3000, 3500]);
export const LIGHTING_OPTIONS = Object.freeze([
  "no_lighting",
  "warm_pucks",
  "vertical_led",
  "shelf_accent",
  "full_package"
]);

export const CONSTRUCTION_RULES = Object.freeze({
  units: "inches",
  axes: Object.freeze({ x: "width", y: "height", z: "depth" }),
  origin: "bottom-center-front",
  panelThickness: 0.75,
  backPanelThickness: 0.25,
  shelfThickness: 1.25,
  doorThickness: 0.75,
  doorReveal: 0.125,
  doubleDoorCenterGap: 0.125,
  drawerGap: 0.125,
  shelfSideClearance: 0.125,
  shelfFrontSetback: 0.75,
  openShelfFrontSetback: 0.125,
  minSectionClearWidth: 15,
  minShelfClearance: 4,
  maxUnsupportedShelfSpan: 36,
  lowerCabinetClearHeight: 30,
  minUpperClearHeight: 24,
  recessedToeKickHeight: 4,
  recessedToeKickDepth: 3,
  toeKickPlateThickness: 0.75,
  toeKickReturnThickness: 0.75,
  flushPlinthHeight: 4,
  furnitureBaseHeight: 4.5,
  furnitureFootWidth: 3,
  furnitureFootDepth: 3,
  furnitureFootOutsideInset: 3,
  furnitureApronDepth: 0.75,
  furnitureApronHeight: 2,
  furnitureRearSupportDepth: 0.75,
  furnitureRearSupportSideInset: 0.75,
  maxSingleDoorLeafWidth: 24,
  minDoorLeafWidth: 9.5,
  maxStandardDoorHeight: 84,
  doorAspectReviewRatio: 4.5,
  handleEdgeInset: 2,
  handleEdgeClearance: 0.125,
  handleProjection: 1,
  tallDoorHandleCenterY: 40,
  knobDiameter: 1,
  knobProjection: 1,
  pullCrossSection: 0.5,
  pullProjection: 1,
  supportedPullLengths: Object.freeze([3, 4, 5, 6, 8, 10, 12]),
  shakerFrameWidth: 2.25,
  slimShakerFrameWidth: 1.25,
  glassFrameWidth: 2.25,
  frontPanelRecess: 0.125,
  minProfileCenterField: 1.5,
  minDrawerProfileFrameWidth: 0.75,
  lightThickness: 0.125,
  verticalLightChannelWidth: 0.125,
  slimCapProfileDrop: 1.2,
  classicCrownProfileDrop: 2.3125,
  modernSoffitHeight: 3,
  maxCrownSideOverhang: 0.5,
  maxCrownFrontOverhang: 0.625,
  maxCrownRearOverhang: 0,
  crownProfiles: Object.freeze({
    none: Object.freeze({ sideOverhang: 0, frontOverhang: 0, rearOverhang: 0 }),
    slim_cap: Object.freeze({ sideOverhang: 0.25, frontOverhang: 0.375, rearOverhang: 0 }),
    classic_crown: Object.freeze({ sideOverhang: 0.5, frontOverhang: 0.625, rearOverhang: 0 }),
    modern_soffit: Object.freeze({ sideOverhang: 0.125, frontOverhang: 0.5, rearOverhang: 0 })
  }),
  minWidth: 24,
  maxWidth: 144,
  minHeight: 72,
  maxHeight: 120,
  minDepth: 10,
  maxDepth: 24,
  minSections: 1,
  maxSections: 6,
  minShelves: 2,
  maxShelves: 8
});

export const CONSTRUCTION_PROFILE_IDS = CONFIG_CONSTRUCTION_PROFILE_IDS;
export const DOOR_ARRANGEMENTS = CONFIG_DOOR_ARRANGEMENTS;

export const FRONT_PROFILE_CATALOG = Object.freeze({
  flat: Object.freeze({
    id: "flat",
    kind: "slab",
    nominalFrameWidth: 0,
    panelRecess: 0,
    minimumCenterField: 0
  }),
  shaker: Object.freeze({
    id: "shaker",
    kind: "framed_panel",
    nominalFrameWidth: CONSTRUCTION_RULES.shakerFrameWidth,
    panelRecess: CONSTRUCTION_RULES.frontPanelRecess,
    minimumCenterField: CONSTRUCTION_RULES.minProfileCenterField
  }),
  slim_shaker: Object.freeze({
    id: "slim_shaker",
    kind: "framed_panel",
    nominalFrameWidth: CONSTRUCTION_RULES.slimShakerFrameWidth,
    panelRecess: CONSTRUCTION_RULES.frontPanelRecess,
    minimumCenterField: CONSTRUCTION_RULES.minProfileCenterField
  }),
  glass: Object.freeze({
    id: "glass",
    kind: "glass_frame",
    nominalFrameWidth: CONSTRUCTION_RULES.glassFrameWidth,
    panelRecess: CONSTRUCTION_RULES.frontPanelRecess,
    minimumCenterField: CONSTRUCTION_RULES.minProfileCenterField
  })
});

export const HARDWARE_GEOMETRY_CATALOG = Object.freeze({
  knob: Object.freeze({
    type: "knob",
    nominalDiameter: CONSTRUCTION_RULES.knobDiameter,
    projection: CONSTRUCTION_RULES.knobProjection,
    crossSection: CONSTRUCTION_RULES.knobDiameter,
    orientations: Object.freeze(["neutral"])
  }),
  pull: Object.freeze({
    type: "pull",
    supportedLengths: CONSTRUCTION_RULES.supportedPullLengths,
    projection: CONSTRUCTION_RULES.pullProjection,
    crossSection: CONSTRUCTION_RULES.pullCrossSection,
    orientations: Object.freeze(["horizontal", "vertical"])
  })
});

export const LAYOUT_DEFAULTS = Object.freeze({
  layoutPreset: "lower-cabinets",
  layoutType: "lower_cabinets",
  width: 96,
  height: 96,
  depth: 15,
  sections: 4,
  shelves: 4,
  shelfThickness: CONSTRUCTION_RULES.shelfThickness,
  lowerCabinets: true,
  lowerStorage: "doors",
  drawerCount: 3,
  centerOpening: false,
  deskOpening: false,
  featureOpening: false,
  tallDoors: false,
  doorCount: 8,
  doorStyle: "shaker",
  drawerFrontStyle: "shaker",
  hardware: "brass_knob",
  lighting: "warm_pucks",
  lightingWarmth: 2700,
  crownStyle: "classic_crown",
  baseStyle: "plinth",
  constructionProfile: CONSTRUCTION_PROFILE_IDS.inset
});

const EPSILON = 1e-6;
const SOLID_ROLES = new Set([
  "base",
  "side_panel",
  "top_panel",
  "bottom_panel",
  "back_panel",
  "divider",
  "shelf",
  "fixed_shelf",
  "trim",
  "crown",
  "door",
  "drawer_front",
  "handle",
  "light"
]);
const BASE_PHYSICAL_ROLES = new Set(["base", "trim"]);
const VOLUME_ROLES = new Set(["assembly", "section", "section_group", "opening"]);
const FACE_CHILD_ROLES = new Set(["door", "drawer_front"]);
const ATTACHED_ROLES = new Set(["handle", "light"]);

/**
 * Return the construction planes used by every physical builder. Values are
 * always layout inches; Z increases from the nominal front toward the back.
 */
export function getConstructionReferencePlanes(config, rules = CONSTRUCTION_RULES) {
  const width = Number(config?.width);
  const height = Number(config?.height);
  const depth = Number(config?.depth);
  if (![width, height, depth].every(Number.isFinite)) {
    throw new TypeError("Finite width, height, and depth are required to resolve construction planes.");
  }
  const profile = config?.constructionProfile === CONSTRUCTION_PROFILE_IDS.legacyOverlay
    ? CONSTRUCTION_PROFILE_IDS.legacyOverlay
    : CONSTRUCTION_PROFILE_IDS.inset;
  const baseStyle = config?.baseStyle;
  const toeKickPlatePlaneZ = rules.recessedToeKickDepth;
  return Object.freeze({
    floorPlaneY: 0,
    outerLeftPlaneX: round(-width / 2),
    outerRightPlaneX: round(width / 2),
    outerTopPlaneY: round(height),
    carcassFrontPlaneZ: 0,
    finishedFrontPlaneZ: profile === CONSTRUCTION_PROFILE_IDS.legacyOverlay
      ? round(-rules.doorThickness)
      : 0,
    shelfFrontPlaneZ: profile === CONSTRUCTION_PROFILE_IDS.legacyOverlay
      ? rules.openShelfFrontSetback
      : Math.max(rules.shelfFrontSetback, rules.doorThickness),
    backInteriorPlaneZ: round(depth - rules.backPanelThickness),
    outerBackPlaneZ: round(depth),
    baseFrontPlaneZ: baseStyle === "toe_kick" ? toeKickPlatePlaneZ : 0,
    toeKickPlatePlaneZ,
    frontOutwardDirectionZ: -1,
    carcassInwardDirectionZ: 1,
    constructionProfile: profile
  });
}

/** Resolve a fitted front AABB from one host opening and an explicit mount. */
export function getFrontBounds({
  opening,
  mounting = "inset",
  reveal = CONSTRUCTION_RULES.doorReveal,
  meetingGap = 0,
  leafIndex = 0,
  leafCount = 1,
  thickness = CONSTRUCTION_RULES.doorThickness,
  frontPlaneZ
} = {}) {
  const openingBounds = opening?.bounds || opening;
  if (!openingBounds?.min || !openingBounds?.max) {
    throw new TypeError("An opening with finite bounds is required to resolve a front.");
  }
  if (![1, 2].includes(leafCount) || leafIndex < 0 || leafIndex >= leafCount) {
    throw new RangeError("Front leaf index/count must describe one supported single or paired arrangement.");
  }
  const fittedMinX = openingBounds.min.x + reveal;
  const fittedMaxX = openingBounds.max.x - reveal;
  let minX = fittedMinX;
  let maxX = fittedMaxX;
  if (leafCount === 2) {
    const centerX = (fittedMinX + fittedMaxX) / 2;
    if (leafIndex === 0) maxX = centerX - meetingGap / 2;
    else minX = centerX + meetingGap / 2;
  }
  if (!["inset", "overlay"].includes(mounting)) {
    throw new RangeError("Front mounting must be inset or overlay.");
  }
  const resolvedFrontPlane = Number.isFinite(Number(frontPlaneZ))
    ? Number(frontPlaneZ)
    : mounting === "overlay"
      ? openingBounds.min.z - thickness
      : openingBounds.min.z;
  // Both profiles use +Z as the physical inward direction. Inset starts at
  // the opening plane; overlay derives its visible face one thickness outward
  // and leaves its rear face attached to the opening plane.
  const minZ = resolvedFrontPlane;
  const maxZ = resolvedFrontPlane + thickness;
  return bounds(
    minX,
    maxX,
    openingBounds.min.y + reveal,
    openingBounds.max.y - reveal,
    minZ,
    maxZ
  );
}

function defaultSingleArrangement(sectionIndex = 0, sectionCount = 1) {
  if (sectionIndex < (sectionCount - 1) / 2) return "single_hinge_left";
  if (sectionIndex > (sectionCount - 1) / 2) return "single_hinge_right";
  return sectionIndex % 2 === 0 ? "single_hinge_left" : "single_hinge_right";
}

/**
 * Resolve Auto or a requested leaf arrangement from finished leaf widths.
 * The return value carries availability/reasons so the UI can display engine
 * decisions without independently repeating dimensional rules.
 */
export function resolveDoorArrangement({
  opening,
  requested = "auto",
  constructionProfile = CONSTRUCTION_PROFILE_IDS.inset,
  openingKind = "lower_cabinet",
  sectionIndex = 0,
  sectionCount = 1,
  reveal = CONSTRUCTION_RULES.doorReveal,
  meetingGap = CONSTRUCTION_RULES.doubleDoorCenterGap,
  rules = CONSTRUCTION_RULES
} = {}) {
  const openingWidth = Number(opening?.size?.x ?? (
    Number(opening?.bounds?.max?.x) - Number(opening?.bounds?.min?.x)
  ));
  if (!Number.isFinite(openingWidth) || openingWidth <= 0) {
    throw new TypeError("A positive opening width is required to resolve a door arrangement.");
  }
  const singleLeafWidth = round(openingWidth - reveal * 2);
  const pairLeafWidth = round((openingWidth - reveal * 2 - meetingGap) / 2);
  const singleValid = singleLeafWidth >= rules.minDoorLeafWidth - EPSILON &&
    singleLeafWidth <= rules.maxSingleDoorLeafWidth + EPSILON;
  const pairValid = pairLeafWidth >= rules.minDoorLeafWidth - EPSILON &&
    pairLeafWidth <= rules.maxSingleDoorLeafWidth + EPSILON;
  const availability = {
    auto: { enabled: singleValid || pairValid, reason: singleValid || pairValid ? null : "This opening cannot produce supported door-leaf widths." },
    single_hinge_left: {
      enabled: singleValid,
      reason: singleLeafWidth > rules.maxSingleDoorLeafWidth
        ? "This opening is too wide for one supported door."
        : singleLeafWidth < rules.minDoorLeafWidth
          ? "This opening is too narrow for one supported door."
          : null
    },
    single_hinge_right: {
      enabled: singleValid,
      reason: singleLeafWidth > rules.maxSingleDoorLeafWidth
        ? "This opening is too wide for one supported door."
        : singleLeafWidth < rules.minDoorLeafWidth
          ? "This opening is too narrow for one supported door."
          : null
    },
    pair: {
      enabled: pairValid,
      reason: pairLeafWidth < rules.minDoorLeafWidth
        ? "A pair would create leaves below the supported minimum width."
        : pairLeafWidth > rules.maxSingleDoorLeafWidth
          ? "This opening is too wide for one supported pair."
          : null
    }
  };

  const normalizedRequested = DOOR_ARRANGEMENTS.includes(requested) ? requested : "auto";
  let arrangement = normalizedRequested;
  if (normalizedRequested === "auto") {
    if (constructionProfile === CONSTRUCTION_PROFILE_IDS.legacyOverlay) {
      arrangement = openingKind === "lower_cabinet" ? "pair" : defaultSingleArrangement(sectionIndex, sectionCount);
    } else if (singleValid) {
      arrangement = defaultSingleArrangement(sectionIndex, sectionCount);
    } else {
      arrangement = "pair";
    }
  }
  const leafCount = arrangement === "pair" ? 2 : 1;
  const leafWidth = leafCount === 2 ? pairLeafWidth : singleLeafWidth;
  const valid = constructionProfile === CONSTRUCTION_PROFILE_IDS.legacyOverlay
    ? leafWidth > 0
    : availability[arrangement]?.enabled === true;
  return Object.freeze({
    requested: normalizedRequested,
    arrangement,
    leafCount,
    leafWidth,
    singleLeafWidth,
    pairLeafWidth,
    meetingGap: leafCount === 2 ? meetingGap : null,
    valid,
    reason: valid ? null : availability[arrangement]?.reason || "The requested door arrangement is not buildable.",
    availability
  });
}

export function getFrontProfileDefinition(style) {
  return FRONT_PROFILE_CATALOG[style] || FRONT_PROFILE_CATALOG.shaker;
}

/** Resolve fixed-inch frame geometry and solid/glass regions for one front. */
export function resolveFrontProfileGeometry(face, definition = getFrontProfileDefinition(face?.metadata?.style)) {
  const box = face?.bounds;
  const size = face?.size || (box ? sizeFromBounds(box) : null);
  if (!box || !size) throw new TypeError("A front descriptor is required to resolve its profile geometry.");
  const isDrawer = face.role === "drawer_front";
  const requestedFrameWidth = definition.nominalFrameWidth;
  const maximumFrameWidth = definition.kind === "slab"
    ? 0
    : Math.max(0, Math.min(
      (size.x - definition.minimumCenterField) / 2,
      (size.y - definition.minimumCenterField) / 2
    ));
  const frameWidth = definition.kind === "slab"
    ? 0
    : round(Math.min(
      requestedFrameWidth,
      isDrawer ? Math.max(CONSTRUCTION_RULES.minDrawerProfileFrameWidth, maximumFrameWidth) : maximumFrameWidth
    ));
  const centerMinX = round(box.min.x + frameWidth);
  const centerMaxX = round(box.max.x - frameWidth);
  const centerMinY = round(box.min.y + frameWidth);
  const centerMaxY = round(box.max.y - frameWidth);
  const centerFieldPositive = definition.kind === "slab" || (
    frameWidth > 0 && centerMaxX - centerMinX > EPSILON && centerMaxY - centerMinY > EPSILON
  );
  const region = (id, kind, minX, maxX, minY, maxY) => ({
    id,
    kind,
    bounds: { min: { x: round(minX), y: round(minY) }, max: { x: round(maxX), y: round(maxY) } }
  });
  const solidRegions = definition.kind === "slab"
    ? [region("slab", "solid", box.min.x, box.max.x, box.min.y, box.max.y)]
    : [
      region("left_stile", "solid", box.min.x, centerMinX, centerMinY, centerMaxY),
      region("right_stile", "solid", centerMaxX, box.max.x, centerMinY, centerMaxY),
      region("bottom_rail", "solid", box.min.x, box.max.x, box.min.y, centerMinY),
      region("top_rail", "solid", box.min.x, box.max.x, centerMaxY, box.max.y)
    ];
  const fieldKind = definition.kind === "glass_frame" ? "glass" : "recessed_panel";
  return Object.freeze({
    style: definition.id,
    kind: definition.kind,
    nominalFrameWidth: requestedFrameWidth,
    frameWidth,
    // Rails and stiles occupy the full front thickness. Only the center field
    // is stepped inward by the resolved visible recess.
    frameDepth: round(size.z),
    panelRecess: definition.panelRecess,
    panelDepth: round(Math.max(0.125, size.z - definition.panelRecess)),
    minimumCenterField: definition.minimumCenterField,
    centerFieldBounds: definition.kind === "slab" ? null : {
      min: { x: centerMinX, y: centerMinY },
      max: { x: centerMaxX, y: centerMaxY }
    },
    solidRegions,
    fieldRegion: definition.kind === "slab"
      ? null
      : region("center_field", fieldKind, centerMinX, centerMaxX, centerMinY, centerMaxY),
    valid: centerFieldPositive && (definition.kind === "slab" || frameWidth + EPSILON >= CONSTRUCTION_RULES.minDrawerProfileFrameWidth),
    correction: frameWidth + EPSILON < requestedFrameWidth ? "PROFILE_FRAME_WIDTH_REDUCED" : null
  });
}

function nearestSupportedPullLength(target, maximum, supported = CONSTRUCTION_RULES.supportedPullLengths) {
  const eligible = supported.filter((value) => value <= maximum + EPSILON);
  if (!eligible.length) return Math.max(1, round(maximum));
  return eligible.reduce((best, value) => (
    Math.abs(value - target) < Math.abs(best - target) ? value : best
  ), eligible[0]);
}

/** Resolve drill-center semantics and explicit visual geometry for hardware. */
export function resolveHardwarePlacement({
  face,
  profile = face?.metadata?.profileGeometry,
  hardwareVariant,
  hingeSide = face?.metadata?.hingeSide,
  latchSide = face?.metadata?.latchSide,
  placementContext = "lower",
  referencePlanes,
  rules = CONSTRUCTION_RULES
} = {}) {
  if (!face?.bounds || !profile) throw new TypeError("A front and resolved profile are required for hardware placement.");
  const hardwareType = getHardwareType(hardwareVariant) === "pull" ? "pull" : "knob";
  const catalog = HARDWARE_GEOMETRY_CATALOG[hardwareType];
  const isDrawer = placementContext === "drawer" || face.role === "drawer_front";
  const orientation = hardwareType === "knob" ? "neutral" : isDrawer ? "horizontal" : "vertical";
  const preferredPullLength = isDrawer
    ? face.size.x / 3
    : placementContext === "tall" ? 8 : 5;
  const visualLength = hardwareType === "pull"
    ? nearestSupportedPullLength(
      preferredPullLength,
      face.size[orientation === "horizontal" ? "x" : "y"] - rules.handleEdgeClearance * 2,
      catalog.supportedLengths
    )
    : catalog.nominalDiameter;
  const sizeX = hardwareType === "pull" && orientation === "horizontal" ? visualLength : catalog.crossSection;
  const sizeY = hardwareType === "pull" && orientation === "vertical" ? visualLength : catalog.crossSection;
  let x = face.position.x;
  let y = face.position.y;
  let placementRuleId = "drawer_center";
  let supportingRegion = profile.solidRegions[0] || null;

  const isFramed = profile.kind !== "slab";
  if (isDrawer) {
    if (isFramed) {
      supportingRegion = profile.solidRegions.find((item) => item.id === "top_rail") || supportingRegion;
      const railCenter = (supportingRegion.bounds.min.y + supportingRegion.bounds.max.y) / 2;
      y = clamp(
        railCenter,
        face.bounds.min.y + sizeY / 2 + rules.handleEdgeClearance,
        face.bounds.max.y - sizeY / 2 - rules.handleEdgeClearance
      );
      placementRuleId = "drawer_frame_nearest_safe_rail_centerline";
    }
  } else {
    const effectiveLatch = latchSide || (hingeSide === "hinge_left" ? "latch_right" : "latch_left");
    const latchRight = effectiveLatch === "latch_right";
    x = latchRight ? face.bounds.max.x - rules.handleEdgeInset : face.bounds.min.x + rules.handleEdgeInset;
    if (isFramed) {
      supportingRegion = profile.solidRegions.find((item) => item.id === (latchRight ? "right_stile" : "left_stile")) || supportingRegion;
      const edgeOffset = Math.max(
        (supportingRegion.bounds.max.x - supportingRegion.bounds.min.x) / 2,
        sizeX / 2 + rules.handleEdgeClearance
      );
      x = latchRight ? face.bounds.max.x - edgeOffset : face.bounds.min.x + edgeOffset;
    }
    if (placementContext === "upper") {
      y = face.bounds.min.y + Math.max(rules.handleEdgeInset, sizeY / 2 + rules.handleEdgeClearance);
      placementRuleId = isFramed ? "upper_latch_frame" : "upper_latch_corner_2x2";
    } else if (placementContext === "tall") {
      y = clamp(
        rules.tallDoorHandleCenterY,
        face.bounds.min.y + sizeY / 2 + rules.handleEdgeClearance,
        face.bounds.max.y - sizeY / 2 - rules.handleEdgeClearance
      );
      placementRuleId = "tall_latch_stile_aff_40";
    } else {
      y = face.bounds.max.y - Math.max(rules.handleEdgeInset, sizeY / 2 + rules.handleEdgeClearance);
      placementRuleId = isFramed ? "lower_latch_frame" : "lower_latch_corner_2x2";
    }
  }

  const frontPlaneZ = Number(face.metadata?.frontPlaneZ ?? referencePlanes?.finishedFrontPlaneZ ?? face.bounds.min.z);
  const projection = catalog.projection;
  const correctionWarning = profile.correction || null;
  const actualSupportingRegion = profile.solidRegions.find((region) => pointWithinRegion(x, y, region)) || supportingRegion;
  return Object.freeze({
    mountingCenters: Object.freeze([{ x: round(x), y: round(y), z: round(frontPlaneZ) }]),
    orientation,
    visualDimensions: Object.freeze({ x: round(sizeX), y: round(sizeY), z: round(projection) }),
    projection,
    latchSide: latchSide || null,
    placementRuleId,
    supportingFrontRegion: actualSupportingRegion?.id || null,
    supportingRegionKind: actualSupportingRegion?.kind || null,
    correctionWarning,
    hardwareType,
    nominalLength: visualLength
  });
}

function pointWithinRegion(x, y, region, epsilon = EPSILON) {
  return x >= region.bounds.min.x - epsilon && x <= region.bounds.max.x + epsilon &&
    y >= region.bounds.min.y - epsilon && y <= region.bounds.max.y + epsilon;
}

/**
 * Return every section count that preserves the minimum usable bay width.
 * Wide single bays remain available and are flagged for engineered shelf
 * support review instead of making the visual configurator lie to the user.
 */
export function getSectionCountLimits(input = {}) {
  const numericWidth = Number(input.width);
  const width = clamp(
    Number.isFinite(numericWidth) ? numericWidth : LAYOUT_DEFAULTS.width,
    CONSTRUCTION_RULES.minWidth,
    CONSTRUCTION_RULES.maxWidth
  );
  const allowed = [];
  for (let sections = CONSTRUCTION_RULES.minSections; sections <= CONSTRUCTION_RULES.maxSections; sections += 1) {
    let widths = getCandidateSectionWidths(input, width, sections);
    const ratiosAreUnbuildable = widths.some(
      (sectionWidth) => sectionWidth + EPSILON < CONSTRUCTION_RULES.minSectionClearWidth
    );
    if (ratiosAreUnbuildable) {
      const equalInput = { ...input, layoutMetadata: { ...(input.layoutMetadata || {}), sectionRatios: [] } };
      widths = getCandidateSectionWidths(equalInput, width, sections);
    }
    if (widths.some((sectionWidth) => sectionWidth + EPSILON < CONSTRUCTION_RULES.minSectionClearWidth)) continue;
    allowed.push(sections);
  }
  const fallback = [CONSTRUCTION_RULES.minSections];
  const allowedSectionCounts = allowed.length ? allowed : fallback;
  return {
    min: allowedSectionCounts[0],
    max: allowedSectionCounts[allowedSectionCounts.length - 1],
    allowed: allowedSectionCounts
  };
}

function getCandidateSectionWidths(input, width, sections) {
  const panel = CONSTRUCTION_RULES.panelThickness;
  const totalSectionClearWidth = width - panel * 2 - panel * (sections - 1);
  const ratios = normalizeSectionRatios(input?.layoutMetadata?.sectionRatios, sections);
  return allocateSectionWidths(totalSectionClearWidth, ratios);
}

function findNearestAllowedSectionCount(requested, allowed) {
  return allowed.reduce((best, candidate) => {
    const distance = Math.abs(candidate - requested);
    const bestDistance = Math.abs(best - requested);
    return distance < bestDistance || (distance === bestDistance && candidate > best) ? candidate : best;
  }, allowed[0]);
}

/**
 * Normalize customer-facing configuration without mutating the input.
 * Returns the normalized config and explicit auto-corrections.
 */
export function normalizeLayoutConfig(input = {}, options = {}) {
  const source = input && typeof input === "object" ? input : {};
  const corrections = [];
  const rules = CONSTRUCTION_RULES;
  const autoCorrectSections = options.autoCorrectSections !== false;

  const width = normalizeNumber(source.width, LAYOUT_DEFAULTS.width, rules.minWidth, rules.maxWidth, "width", corrections);
  const height = normalizeNumber(source.height, LAYOUT_DEFAULTS.height, rules.minHeight, rules.maxHeight, "height", corrections);
  const depth = normalizeNumber(source.depth, LAYOUT_DEFAULTS.depth, rules.minDepth, rules.maxDepth, "depth", corrections);
  const panelThickness = rules.panelThickness;

  const requestedSections = normalizeInteger(
    source.sections,
    LAYOUT_DEFAULTS.sections,
    rules.minSections,
    rules.maxSections,
    "sections",
    corrections
  );
  const sectionLimits = getSectionCountLimits({ ...source, width });
  const minSectionsForWidth = sectionLimits.min;
  const maxSectionsForWidth = sectionLimits.max;
  const allowedSectionCounts = sectionLimits.allowed;
  let sections = requestedSections;
  if (autoCorrectSections && !allowedSectionCounts.includes(requestedSections)) {
    sections = findNearestAllowedSectionCount(requestedSections, allowedSectionCounts);
    corrections.push(createCorrection(
      "SECTION_COUNT_REDUCED",
      "sections",
      requestedSections,
      sections,
      "Section count was reduced so every section keeps at least " + rules.minSectionClearWidth + " inches of clear width."
    ));
  }

  const requestedShelfThickness = Number(source.shelfThickness ?? LAYOUT_DEFAULTS.shelfThickness);
  const shelfThickness = SHELF_THICKNESS_OPTIONS.includes(requestedShelfThickness)
    ? requestedShelfThickness
    : LAYOUT_DEFAULTS.shelfThickness;
  if (requestedShelfThickness !== shelfThickness) {
    corrections.push(createCorrection(
      "SHELF_THICKNESS_DEFAULTED",
      "shelfThickness",
      source.shelfThickness,
      shelfThickness,
      "Shelf thickness must be one of the supported construction sizes."
    ));
  }

  const lowerCabinets = normalizeBoolean(source.lowerCabinets, LAYOUT_DEFAULTS.lowerCabinets);
  const rawSectionTypes = source.layoutMetadata?.sectionTypes;
  const hasCompleteExplicitSectionTypes = Array.isArray(rawSectionTypes) && rawSectionTypes.length === sections;
  const hasExplicitLowerStorage = hasCompleteExplicitSectionTypes && rawSectionTypes.some((type, index) => {
    const normalizedType = normalizeSectionTypeValue(type) || getImplicitSectionType(source, index, sections);
    return normalizedType === "lower_doors" || normalizedType === "drawers";
  });
  const hasLegacyDrawerSections = Array.isArray(source.layoutMetadata?.drawerSections) &&
    source.layoutMetadata.drawerSections.length > 0;
  const hasAnyLowerStorage = hasCompleteExplicitSectionTypes
    ? hasExplicitLowerStorage
    : lowerCabinets || hasLegacyDrawerSections;
  const baseStyle = normalizeString(source.baseStyle, LAYOUT_DEFAULTS.baseStyle);
  const constructionProfile = source.constructionProfile === CONSTRUCTION_PROFILE_IDS.legacyOverlay
    ? CONSTRUCTION_PROFILE_IDS.legacyOverlay
    : CONSTRUCTION_PROFILE_IDS.inset;
  const baseHeight = getBaseHeight(baseStyle);
  const clearBottom = baseHeight + panelThickness;
  const clearTop = height - panelThickness;
  const nominalLowerTop = Math.min(
    clearBottom + rules.lowerCabinetClearHeight,
    clearTop - rules.minUpperClearHeight - shelfThickness
  );
  const shelfRegionBottom = hasAnyLowerStorage ? nominalLowerTop + shelfThickness : clearBottom;
  const shelfRegionHeight = Math.max(0, clearTop - shelfRegionBottom);
  const maxShelvesForHeight = Math.max(
    1,
    Math.floor(
      (shelfRegionHeight - rules.minShelfClearance + EPSILON) /
      (shelfThickness + rules.minShelfClearance)
    )
  );
  const requestedShelves = normalizeInteger(
    source.shelves,
    LAYOUT_DEFAULTS.shelves,
    rules.minShelves,
    rules.maxShelves,
    "shelves",
    corrections
  );
  const shelves = Math.max(1, Math.min(requestedShelves, maxShelvesForHeight));
  if (shelves !== requestedShelves) {
    corrections.push(createCorrection(
      "SHELF_COUNT_REDUCED",
      "shelves",
      requestedShelves,
      shelves,
      "Shelf count was reduced to preserve at least " + rules.minShelfClearance + " inches of clear vertical spacing."
    ));
  }

  const requestedWarmth = Number(source.lightingWarmth ?? LAYOUT_DEFAULTS.lightingWarmth);
  const lightingWarmth = LIGHTING_WARMTH_OPTIONS.includes(requestedWarmth)
    ? requestedWarmth
    : LAYOUT_DEFAULTS.lightingWarmth;
  if (requestedWarmth !== lightingWarmth) {
    corrections.push(createCorrection(
      "LIGHTING_WARMTH_DEFAULTED",
      "lightingWarmth",
      source.lightingWarmth,
      lightingWarmth,
      "Lighting warmth must be 2700K, 3000K, or 3500K."
    ));
  }

  const lightingAliases = {
    shelf_wash: "shelf_accent",
    full_lighting: "full_package",
    full_lighting_package: "full_package"
  };
  const rawLighting = normalizeString(source.lighting, LAYOUT_DEFAULTS.lighting);
  const aliasedLighting = lightingAliases[rawLighting] || rawLighting;
  const lighting = LIGHTING_OPTIONS.includes(aliasedLighting) ? aliasedLighting : LAYOUT_DEFAULTS.lighting;
  if (lighting !== rawLighting && !lightingAliases[rawLighting]) {
    corrections.push(createCorrection(
      "LIGHTING_MODE_DEFAULTED",
      "lighting",
      rawLighting,
      lighting,
      "Unknown lighting mode was replaced with the default lighting mode."
    ));
  }

  const metadata = reconcileLayoutMetadata(
    source.layoutMetadata ?? source.presetMetadata,
    sections,
    width,
    corrections,
    source
  );
  const layoutType = normalizeString(source.layoutType, LAYOUT_DEFAULTS.layoutType);
  const normalizedLowerStorage = normalizeLowerStorage(source.lowerStorage, layoutType, metadata);
  const normalizedTallDoors = normalizeBoolean(source.tallDoors, LAYOUT_DEFAULTS.tallDoors);
  const explicitSectionTypes = Array.isArray(metadata.sectionTypes) && metadata.sectionTypes.length === sections
    ? metadata.sectionTypes
    : null;
  const explicitLowerStorageTypes = explicitSectionTypes?.filter(
    (type) => type === "lower_doors" || type === "drawers"
  ) || [];
  // Explicit per-section types are the physical source of truth. Keep the
  // legacy/global fields synchronized because controls, summaries, saving, and
  // quote preparation still consume them alongside the descriptor graph.
  const canonicalLowerCabinets = explicitSectionTypes
    ? explicitLowerStorageTypes.length > 0
    : lowerCabinets;
  const canonicalLowerStorage = explicitSectionTypes
    ? explicitLowerStorageTypes.length > 0 && explicitLowerStorageTypes.every((type) => type === "drawers")
      ? "drawers"
      : "doors"
    : normalizedLowerStorage;
  const canonicalTallDoors = explicitSectionTypes
    ? explicitSectionTypes.includes("tall_doors")
    : normalizedTallDoors;

  const doorStyle = normalizeString(source.doorStyle, LAYOUT_DEFAULTS.doorStyle);
  const hasDrawerFrontStyle = Object.prototype.hasOwnProperty.call(source, "drawerFrontStyle");
  const requestedDrawerFrontStyle = hasDrawerFrontStyle ? source.drawerFrontStyle : doorStyle;
  const drawerFrontStyle = normalizeDrawerFrontStyleValue(requestedDrawerFrontStyle, LAYOUT_DEFAULTS.drawerFrontStyle);
  if (hasDrawerFrontStyle && drawerFrontStyle !== requestedDrawerFrontStyle) {
    corrections.push(createCorrection(
      "DRAWER_FRONT_STYLE_DEFAULTED",
      "drawerFrontStyle",
      requestedDrawerFrontStyle,
      drawerFrontStyle,
      "Drawer fronts support Shaker, Flat Panel, or Slim Shaker profiles."
    ));
  }

  const config = {
    layoutPreset: normalizeString(source.layoutPreset, LAYOUT_DEFAULTS.layoutPreset),
    layoutType,
    width,
    height,
    depth,
    sections,
    requestedSections,
    minSectionsForWidth,
    maxSectionsForWidth,
    allowedSectionCounts,
    shelves,
    requestedShelves,
    shelfThickness,
    lowerCabinets: canonicalLowerCabinets,
    lowerStorage: canonicalLowerStorage,
    drawerCount: normalizeInteger(source.drawerCount, LAYOUT_DEFAULTS.drawerCount, 2, 5, "drawerCount", corrections),
    centerOpening: normalizeBoolean(source.centerOpening, LAYOUT_DEFAULTS.centerOpening),
    deskOpening: normalizeBoolean(source.deskOpening, LAYOUT_DEFAULTS.deskOpening),
    featureOpening: normalizeBoolean(source.featureOpening, LAYOUT_DEFAULTS.featureOpening),
    tallDoors: canonicalTallDoors,
    doorCount: normalizeInteger(source.doorCount, LAYOUT_DEFAULTS.doorCount, 0, 12, "doorCount", corrections),
    doorStyle,
    drawerFrontStyle,
    hardware: normalizeString(source.hardware, LAYOUT_DEFAULTS.hardware),
    lighting,
    lightingWarmth,
    crownStyle: normalizeString(source.crownStyle, LAYOUT_DEFAULTS.crownStyle),
    baseStyle,
    constructionProfile,
    layoutMetadata: metadata
  };

  return { config, corrections };
}

/**
 * Generate a deterministic descriptor graph. No DOM, WebGL, or Three.js
 * objects are created here.
 */
export function generateBookcaseLayout(input = {}, options = {}) {
  const normalized = normalizeLayoutConfig(input, options);
  const config = normalized.config;
  const corrections = normalized.corrections.slice();
  const rules = CONSTRUCTION_RULES;
  const components = [];
  const componentIndex = new Map();
  const sections = [];
  const shelves = [];
  const frame = {};

  const add = (definition) => {
    const component = createComponent(definition);
    components.push(component);
    componentIndex.set(component.id, component);
    return component;
  };

  const panel = rules.panelThickness;
  const back = rules.backPanelThickness;
  const baseHeight = getBaseHeight(config.baseStyle);
  const referencePlanes = getConstructionReferencePlanes(config, rules);
  const clearDepth = config.depth - back;
  const clearBottom = baseHeight + panel;
  const clearTop = config.height - panel;
  const clearHeight = clearTop - clearBottom;
  const interiorWidth = config.width - panel * 2;
  const totalSectionClearWidth = interiorWidth - panel * (config.sections - 1);
  const sectionRatios = normalizeSectionRatios(config.layoutMetadata.sectionRatios, config.sections);
  const sectionClearWidths = allocateSectionWidths(totalSectionClearWidth, sectionRatios);
  const sectionClearWidth = totalSectionClearWidth / config.sections;
  const sectionStartX = -config.width / 2 + panel;
  const sectionRanges = [];
  let sectionCursorX = sectionStartX;
  for (let index = 0; index < config.sections; index += 1) {
    const minX = round(sectionCursorX);
    const maxX = round(minX + sectionClearWidths[index]);
    sectionRanges.push({ minX, maxX });
    sectionCursorX = round(maxX + panel);
  }
  const lowerOpeningTop = Math.min(
    clearBottom + rules.lowerCabinetClearHeight,
    clearTop - rules.minUpperClearHeight - config.shelfThickness
  );

  const root = add({
    id: "bookcase",
    role: "assembly",
    parentId: null,
    hostId: null,
    bounds: bounds(-config.width / 2, config.width / 2, 0, config.height, 0, config.depth),
    metadata: {
      units: rules.units,
      axes: rules.axes,
      origin: rules.origin,
      constructionProfile: config.constructionProfile,
      referencePlanes
    }
  });

  frame.base = buildBaseAssembly({ add, config, root, baseHeight, referencePlanes, rules });
  frame.leftSide = add({
    id: "left-side-panel",
    role: "side_panel",
    parentId: root.id,
    hostId: root.id,
    bounds: bounds(-config.width / 2, -config.width / 2 + panel, baseHeight, config.height, 0, clearDepth),
    metadata: { side: "left" }
  });
  frame.rightSide = add({
    id: "right-side-panel",
    role: "side_panel",
    parentId: root.id,
    hostId: root.id,
    bounds: bounds(config.width / 2 - panel, config.width / 2, baseHeight, config.height, 0, clearDepth),
    metadata: { side: "right" }
  });
  frame.bottom = add({
    id: "bottom-panel",
    role: "bottom_panel",
    parentId: root.id,
    hostId: root.id,
    bounds: bounds(-config.width / 2 + panel, config.width / 2 - panel, baseHeight, clearBottom, 0, clearDepth)
  });
  frame.top = add({
    id: "top-panel",
    role: "top_panel",
    parentId: root.id,
    hostId: root.id,
    bounds: bounds(-config.width / 2 + panel, config.width / 2 - panel, clearTop, config.height, 0, clearDepth)
  });
  frame.back = add({
    id: "back-panel",
    role: "back_panel",
    parentId: root.id,
    hostId: root.id,
    bounds: bounds(-config.width / 2 + panel, config.width / 2 - panel, clearBottom, clearTop, clearDepth, config.depth)
  });
  addCrownDescriptors(add, config, root, frame.top, frame.leftSide, frame.rightSide);

  const special = getSpecialZone(config);
  const skippedDividers = new Set();
  for (let index = 1; index < config.sections; index += 1) {
    if (special.indices.includes(index - 1) && special.indices.includes(index)) {
      skippedDividers.add(index);
    }
  }

  const dividerByBoundary = new Map();
  for (let index = 1; index < config.sections; index += 1) {
    const x = sectionRanges[index - 1].maxX;
    if (skippedDividers.has(index)) {
      if (special.kind === "media" && special.indices.length > 1 && config.lowerCabinets) {
        const divider = add({
          id: "divider-" + pad(index) + "-lower-support",
          role: "divider",
          parentId: root.id,
          hostId: root.id,
          bounds: bounds(
            x,
            x + panel,
            clearBottom,
            lowerOpeningTop + config.shelfThickness,
            0,
            clearDepth
          ),
          metadata: {
            boundaryIndex: index,
            partial: true,
            purpose: "lower_media_support",
            specialKind: special.kind
          }
        });
        dividerByBoundary.set(index, divider);
      }
      continue;
    }
    const divider = add({
      id: "divider-" + pad(index),
      role: "divider",
      parentId: root.id,
      hostId: root.id,
      bounds: bounds(x, x + panel, clearBottom, clearTop, 0, clearDepth),
      metadata: { boundaryIndex: index }
    });
    dividerByBoundary.set(index, divider);
  }

  for (let index = 0; index < config.sections; index += 1) {
    const { minX, maxX } = sectionRanges[index];
    const id = "section-" + pad(index + 1);
    const type = resolveSectionType(config, index, special);
    const leftBoundaryId = index === 0
      ? frame.leftSide.id
      : dividerByBoundary.get(index)?.id || null;
    const rightBoundaryId = index === config.sections - 1
      ? frame.rightSide.id
      : dividerByBoundary.get(index + 1)?.id || null;
    const section = add({
      id,
      role: "section",
      parentId: root.id,
      hostId: root.id,
      bounds: bounds(minX, maxX, clearBottom, clearTop, 0, clearDepth),
      metadata: {
        index,
        type,
        leftBoundaryId,
        rightBoundaryId,
        topBoundaryId: frame.top.id,
        bottomBoundaryId: frame.bottom.id
      }
    });
    sections.push(section);
  }

  let featureZone = null;
  if (special.indices.length) {
    const first = sections[special.indices[0]];
    const last = sections[special.indices[special.indices.length - 1]];
    featureZone = add({
      id: "feature-zone",
      role: "section_group",
      parentId: root.id,
      hostId: root.id,
      bounds: bounds(
        first.bounds.min.x,
        last.bounds.max.x,
        clearBottom,
        clearTop,
        0,
        clearDepth
      ),
      metadata: {
        kind: special.kind,
        memberSectionIds: special.indices.map((index) => sections[index].id)
      }
    });
    const openingMinY = special.kind === "desk" || special.kind === "feature"
      ? clearBottom
      : lowerOpeningTop + config.shelfThickness;
    add({
      id: "feature-opening",
      role: "opening",
      parentId: featureZone.id,
      hostId: featureZone.id,
      bounds: bounds(
        featureZone.bounds.min.x,
        featureZone.bounds.max.x,
        openingMinY,
        clearTop,
        0,
        clearDepth
      ),
      metadata: { kind: special.kind }
    });
    if (special.kind === "desk") {
      const desktopY = Math.min(clearBottom + 29, clearTop - rules.minUpperClearHeight);
      add({
        id: "desk-worktop",
        role: "fixed_shelf",
        parentId: featureZone.id,
        hostId: featureZone.id,
        bounds: bounds(
          featureZone.bounds.min.x + rules.shelfSideClearance,
          featureZone.bounds.max.x - rules.shelfSideClearance,
          desktopY,
          desktopY + config.shelfThickness,
          0,
          clearDepth
        ),
        metadata: { fixed: true, purpose: "desktop" }
      });
    }
  }

  for (const section of sections) {
    buildSectionContents({
      add,
      config,
      rules,
      section,
      sections,
      special,
      clearDepth,
      clearTop,
      lowerOpeningTop,
      shelves,
      referencePlanes
    });
  }

  addLighting({
    add,
    config,
    rules,
    sections,
    shelves,
    frame,
    componentIndex,
    special,
    lowerOpeningTop,
    clearDepth
  });

  const primaryDoorCount = components.filter(
    (component) => component.role === "door" && component.metadata.tier === "primary"
  ).length;
  const generatedDrawerCount = components.filter((component) => component.role === "drawer_front").length;
  // Door count is a physical output of the generated opening graph, not an
  // independent customer setting. Canonicalize it before pricing, saving, and
  // interface synchronization so all consumers agree on the same quantity.
  config.doorCount = primaryDoorCount;

  const layout = {
    schemaVersion: 2,
    coordinateSystem: {
      units: rules.units,
      axes: rules.axes,
      origin: rules.origin,
      frontPlaneZ: 0,
      carcassDepthDirection: "positive-z",
      frontOutwardDirectionZ: -1,
      referencePlanes
    },
    config,
    rules: { ...rules },
    metrics: {
      overallWidth: config.width,
      overallHeight: config.height,
      overallDepth: config.depth,
      baseHeight,
      interiorWidth,
      interiorClearHeight: clearHeight,
      interiorClearDepth: clearDepth,
      sectionClearWidth,
      sectionClearWidths: sectionClearWidths.slice(),
      generatedDoorCount: components.filter((component) => component.role === "door").length,
      primaryDoorCount,
      generatedDrawerCount,
      referencePlanes,
      nominalBounds: cloneBounds(root.bounds),
      decorativeBounds: getDecorativeBounds(components, root.bounds),
      finishedFrontPlaneZ: referencePlanes.finishedFrontPlaneZ,
      maximumFrontProjection: getMaximumFrontProjection(components, referencePlanes.finishedFrontPlaneZ),
      maximumSideOverhang: getMaximumSideOverhang(components, root.bounds),
      maximumTopOverhang: getMaximumTopOverhang(components, root.bounds)
    },
    corrections,
    components,
    componentOrder: components.map((component) => component.id),
    sectionIds: sections.map((section) => section.id)
  };
  layout.validation = validateBookcaseLayout(layout);
  return layout;
}

function buildSectionContents(context) {
  const {
    add,
    config,
    rules,
    section,
    special,
    clearDepth,
    clearTop,
    lowerOpeningTop,
    shelves,
    referencePlanes
  } = context;
  const index = section.metadata.index;
  const isSpecial = special.indices.includes(index);
  const sectionType = section.metadata.type;
  const isTall = sectionType === "tall_doors";
  const isDesk = sectionType === "desk";
  const frontOpeningTop = getFrontOpeningTop(config, clearTop);
  const usesLowerStorage = (sectionType === "lower_doors" || sectionType === "drawers") &&
    !isTall && !isDesk && !(isSpecial && special.kind === "feature");
  let shelfRegionBottom = section.bounds.min.y;

  if (isTall) {
    const opening = add({
      id: section.id + "-tall-opening",
      role: "opening",
      parentId: section.id,
      hostId: section.id,
      bounds: bounds(
        section.bounds.min.x,
        section.bounds.max.x,
        section.bounds.min.y,
        frontOpeningTop,
        section.bounds.min.z,
        section.bounds.max.z
      ),
      metadata: { kind: "tall_storage", frontPlaneZ: referencePlanes.carcassFrontPlaneZ }
    });
    addDoorAssembly(add, config, opening, {
      baseId: section.id + "-tall",
      openingKind: "tall_storage",
      requested: getSectionDoorArrangement(config, index),
      sectionIndex: index,
      sectionCount: config.sections,
      tier: "primary",
      style: config.doorStyle,
      placementContext: "tall",
      referencePlanes
    });
    return;
  }

  if (usesLowerStorage) {
    const opening = add({
      id: section.id + "-lower-opening",
      role: "opening",
      parentId: section.id,
      hostId: section.id,
      bounds: bounds(
        section.bounds.min.x,
        section.bounds.max.x,
        section.bounds.min.y,
        lowerOpeningTop,
        0,
        clearDepth
      ),
      metadata: {
        kind: sectionType === "drawers" ? "drawers" : "lower_cabinet",
        frontPlaneZ: referencePlanes.carcassFrontPlaneZ
      }
    });
    const separator = add({
      id: section.id + "-lower-separator",
      role: "fixed_shelf",
      parentId: section.id,
      hostId: section.id,
      bounds: bounds(
        section.bounds.min.x + rules.shelfSideClearance,
        section.bounds.max.x - rules.shelfSideClearance,
        lowerOpeningTop,
        lowerOpeningTop + config.shelfThickness,
        referencePlanes.shelfFrontPlaneZ,
        clearDepth
      ),
      metadata: { fixed: true, purpose: "lower_separator" }
    });
    shelfRegionBottom = separator.bounds.max.y;

    if (sectionType === "drawers") {
      addDrawerStack(add, config, opening, referencePlanes);
    } else {
      addDoorAssembly(add, config, opening, {
        baseId: opening.id,
        openingKind: "lower_cabinet",
        requested: getSectionDoorArrangement(config, index),
        sectionIndex: index,
        sectionCount: config.sections,
        tier: "primary",
        style: config.doorStyle,
        placementContext: "lower",
        referencePlanes
      });
    }
  }

  if (isDesk || isSpecial) return;

  const shelfBounds = distributeShelves({
    section,
    count: config.shelves,
    thickness: config.shelfThickness,
    minY: shelfRegionBottom,
    maxY: clearTop,
    clearDepth,
    rules,
    asymmetric: config.layoutType === "asymmetric",
    frontSetback: config.layoutType === "glass_library"
      ? referencePlanes.shelfFrontPlaneZ
      : rules.openShelfFrontSetback
  });
  shelfBounds.forEach((shelfBox, shelfIndex) => {
    if (
      config.layoutType === "display_wall" &&
      index === Math.floor(config.sections / 2) &&
      shelfIndex === Math.floor(shelfBounds.length / 2)
    ) {
      return;
    }
    const shelf = add({
      id: section.id + "-shelf-" + pad(shelfIndex + 1),
      role: "shelf",
      parentId: section.id,
      hostId: section.id,
      bounds: shelfBox,
      metadata: {
        adjustable: true,
        ordinal: shelfIndex + 1,
        unsupportedSpan: sizeFromBounds(shelfBox).x > rules.maxUnsupportedShelfSpan
      }
    });
    shelves.push(shelf);
  });

  if (config.layoutType === "glass_library") {
    const opening = add({
      id: section.id + "-upper-opening",
      role: "opening",
      parentId: section.id,
      hostId: section.id,
      bounds: bounds(
        section.bounds.min.x,
        section.bounds.max.x,
        shelfRegionBottom,
        frontOpeningTop,
        0,
        clearDepth
      ),
      metadata: { kind: "upper_glass", frontPlaneZ: referencePlanes.carcassFrontPlaneZ }
    });
    addDoorAssembly(add, config, opening, {
      baseId: section.id + "-upper-glass",
      openingKind: "upper_glass",
      requested: "auto",
      sectionIndex: index,
      sectionCount: config.sections,
      tier: "secondary",
      style: "glass",
      placementContext: "upper",
      referencePlanes
    });
  }
}

function getFrontOpeningTop(config, clearTop) {
  if (config.constructionProfile !== CONSTRUCTION_PROFILE_IDS.legacyOverlay) return clearTop;
  const crownDrop = {
    slim_cap: CONSTRUCTION_RULES.slimCapProfileDrop,
    classic_crown: CONSTRUCTION_RULES.classicCrownProfileDrop,
    modern_soffit: CONSTRUCTION_RULES.modernSoffitHeight
  }[config.crownStyle];
  return crownDrop ? Math.min(clearTop, config.height - crownDrop) : clearTop;
}

function getSectionDoorArrangement(config, index) {
  return config.layoutMetadata?.sectionDoorLayouts?.[index]?.arrangement || "auto";
}

function addDoorAssembly(add, config, opening, options) {
  const reveal = CONSTRUCTION_RULES.doorReveal;
  const meetingGap = CONSTRUCTION_RULES.doubleDoorCenterGap;
  const legacyOverlay = config.constructionProfile === CONSTRUCTION_PROFILE_IDS.legacyOverlay;
  const mounting = legacyOverlay ? "overlay" : "inset";
  const arrangement = resolveDoorArrangement({
    opening,
    requested: options.requested,
    constructionProfile: config.constructionProfile,
    openingKind: options.openingKind,
    sectionIndex: options.sectionIndex,
    sectionCount: options.sectionCount,
    reveal,
    meetingGap
  });
  const frontPlaneZ = legacyOverlay
    ? -CONSTRUCTION_RULES.doorThickness
    : options.referencePlanes.finishedFrontPlaneZ;
  const leafSemantics = arrangement.leafCount === 2
    ? [
      { suffix: "door-left", hingeSide: "hinge_left", latchSide: "latch_right" },
      { suffix: "door-right", hingeSide: "hinge_right", latchSide: "latch_left" }
    ]
    : [{
      suffix: "door",
      hingeSide: arrangement.arrangement === "single_hinge_right" ? "hinge_right" : "hinge_left",
      latchSide: arrangement.arrangement === "single_hinge_right" ? "latch_left" : "latch_right"
    }];

  return leafSemantics.map((semantics, leafIndex) => {
    const frontBounds = getFrontBounds({
      opening,
      mounting,
      reveal,
      meetingGap: arrangement.leafCount === 2 ? meetingGap : 0,
      leafIndex,
      leafCount: arrangement.leafCount,
      thickness: CONSTRUCTION_RULES.doorThickness,
      frontPlaneZ
    });
    const door = add({
      id: options.baseId + "-" + semantics.suffix,
      role: "door",
      parentId: opening.id,
      hostId: opening.id,
      bounds: frontBounds,
      metadata: {
        style: options.style,
        mounting,
        frontPlaneZ,
        backPlaneZ: frontBounds.max.z,
        reveal,
        meetingGap: arrangement.leafCount === 2 ? meetingGap : null,
        leafCount: arrangement.leafCount,
        leafIndex,
        leafWidth: sizeFromBounds(frontBounds).x,
        requestedArrangement: arrangement.requested,
        arrangement: arrangement.arrangement,
        arrangementBuildable: arrangement.valid,
        arrangementReason: arrangement.reason,
        arrangementAvailability: arrangement.availability,
        hingeSide: semantics.hingeSide,
        latchSide: semantics.latchSide,
        openingKind: options.openingKind,
        tier: options.tier,
        constructionProfile: config.constructionProfile,
        attachment: {
          axis: "z",
          hostPlane: "carcass_front",
          hostFace: "min",
          componentFace: mounting === "inset" ? "min" : "max"
        }
      }
    });
    door.metadata.profileGeometry = resolveFrontProfileGeometry(
      door,
      getFrontProfileDefinition(options.style)
    );
    addHandle(add, config, door, options.placementContext, options.referencePlanes);
    return door;
  });
}

function addDrawerStack(add, config, opening, referencePlanes) {
  const reveal = CONSTRUCTION_RULES.doorReveal;
  const gap = CONSTRUCTION_RULES.drawerGap;
  const count = config.drawerCount;
  const available = opening.size.y - reveal * 2 - gap * (count - 1);
  const drawerHeight = available / count;
  const legacyOverlay = config.constructionProfile === CONSTRUCTION_PROFILE_IDS.legacyOverlay;
  const mounting = legacyOverlay ? "overlay" : "inset";
  const frontPlaneZ = legacyOverlay ? -CONSTRUCTION_RULES.doorThickness : referencePlanes.finishedFrontPlaneZ;
  for (let index = 0; index < count; index += 1) {
    const minY = opening.bounds.min.y + reveal + index * (drawerHeight + gap);
    const drawerSlot = {
      bounds: bounds(
        opening.bounds.min.x,
        opening.bounds.max.x,
        minY - reveal,
        minY + drawerHeight + reveal,
        opening.bounds.min.z,
        opening.bounds.max.z
      )
    };
    const frontBounds = getFrontBounds({
      opening: drawerSlot,
      mounting,
      reveal,
      thickness: CONSTRUCTION_RULES.doorThickness,
      frontPlaneZ
    });
    const drawer = add({
      id: opening.id + "-drawer-" + pad(index + 1),
      role: "drawer_front",
      parentId: opening.id,
      hostId: opening.id,
      bounds: frontBounds,
      metadata: {
        style: config.drawerFrontStyle,
        ordinal: index + 1,
        mounting,
        frontPlaneZ,
        backPlaneZ: frontBounds.max.z,
        reveal,
        gap,
        tier: "primary",
        constructionProfile: config.constructionProfile,
        attachment: {
          axis: "z",
          hostPlane: "carcass_front",
          hostFace: "min",
          componentFace: mounting === "inset" ? "min" : "max"
        }
      }
    });
    drawer.metadata.profileGeometry = resolveFrontProfileGeometry(
      drawer,
      getFrontProfileDefinition(config.drawerFrontStyle)
    );
    addHandle(add, config, drawer, "drawer", referencePlanes);
  }
}

function addHandle(add, config, face, placementContext, referencePlanes) {
  if (config.hardware === "push_latch") return null;
  const resolved = resolveHardwarePlacement({
    face,
    profile: face.metadata.profileGeometry,
    hardwareVariant: config.hardware,
    hingeSide: face.metadata.hingeSide,
    latchSide: face.metadata.latchSide,
    placementContext,
    referencePlanes
  });
  const center = resolved.mountingCenters[0];
  const halfX = resolved.visualDimensions.x / 2;
  const halfY = resolved.visualDimensions.y / 2;
  return add({
    id: face.id + "-handle",
    role: "handle",
    parentId: face.id,
    hostId: face.id,
    bounds: bounds(
      center.x - halfX,
      center.x + halfX,
      center.y - halfY,
      center.y + halfY,
      center.z - resolved.projection,
      center.z
    ),
    metadata: {
      hardware: config.hardware,
      hardwareType: resolved.hardwareType,
      mountingCenters: resolved.mountingCenters,
      mountingCenter: center,
      orientation: resolved.orientation,
      visualDimensions: resolved.visualDimensions,
      projection: resolved.projection,
      latchSide: resolved.latchSide,
      placementRuleId: resolved.placementRuleId,
      supportingFrontRegion: resolved.supportingFrontRegion,
      supportingRegionKind: resolved.supportingRegionKind,
      correctionWarning: resolved.correctionWarning,
      nominalLength: resolved.nominalLength,
      attachment: {
        axis: "z",
        hostPlane: "finished_front",
        hostCoordinate: center.z,
        componentFace: "max"
      }
    }
  });
}

function addLighting(context) {
  const {
    add,
    config,
    rules,
    sections,
    shelves,
    frame,
    componentIndex,
    special,
    lowerOpeningTop,
    clearDepth
  } = context;
  if (config.lighting === "no_lighting") return;

  const modes = config.lighting === "full_package"
    ? ["warm_pucks", "vertical_led", "shelf_accent"]
    : [config.lighting];
  const eligibleSections = sections.filter((section) => {
    const type = section.metadata.type;
    return type !== "tall_doors" && type !== "desk" && !special.indices.includes(section.metadata.index);
  });

  if (modes.includes("warm_pucks")) {
    for (const section of eligibleSections) {
      const lightWidth = Math.min(2.25, section.size.x * 0.18);
      const lightDepth = lightWidth;
      // Install top pucks in the front third of the cabinet, attached to the
      // actual underside of the top panel. Crown fronts and side returns stay
      // outside this hosted footprint and therefore cannot bury the light.
      const frontInset = Math.max(lightDepth / 2 + 0.25, Math.min(clearDepth * 0.2, 2.75));
      const lightCenterZ = section.bounds.min.z + frontInset;
      const lightTopY = Math.min(section.bounds.max.y, frame.top.bounds.min.y);
      add({
        id: section.id + "-light-puck",
        role: "light",
        parentId: section.id,
        hostId: frame.top.id,
        bounds: bounds(
          section.position.x - lightWidth / 2,
          section.position.x + lightWidth / 2,
          lightTopY - 0.375,
          lightTopY,
          lightCenterZ - lightDepth / 2,
          lightCenterZ + lightDepth / 2
        ),
        metadata: {
          lightType: "puck",
          warmth: config.lightingWarmth,
          attachment: { axis: "y", hostFace: "min", componentFace: "max" }
        }
      });
    }
  }

  if (modes.includes("vertical_led")) {
    for (const section of eligibleSections) {
      const hasLowerStorage = section.metadata.type === "lower_doors" || section.metadata.type === "drawers";
      const yMin = hasLowerStorage ? lowerOpeningTop + config.shelfThickness + 2 : section.bounds.min.y + 2;
      const yMax = section.bounds.max.y - 2;
      const sides = [
        {
          side: "left",
          hostId: section.metadata.leftBoundaryId,
          minX: section.bounds.min.x,
          maxX: section.bounds.min.x + rules.verticalLightChannelWidth,
          hostFace: "max",
          componentFace: "min"
        },
        {
          side: "right",
          hostId: section.metadata.rightBoundaryId,
          minX: section.bounds.max.x - rules.verticalLightChannelWidth,
          maxX: section.bounds.max.x,
          hostFace: "min",
          componentFace: "max"
        }
      ];
      for (const side of sides) {
        if (!side.hostId || !componentIndex.has(side.hostId) || yMax <= yMin) continue;
        add({
          id: section.id + "-light-vertical-" + side.side,
          role: "light",
          parentId: section.id,
          hostId: side.hostId,
          bounds: bounds(side.minX, side.maxX, yMin, yMax, 1, 1.5),
          metadata: {
            lightType: "vertical_led",
            side: side.side,
            warmth: config.lightingWarmth,
            attachment: {
              axis: "x",
              hostFace: side.hostFace,
              componentFace: side.componentFace
            }
          }
        });
      }
    }
  }

  if (modes.includes("shelf_accent")) {
    for (const shelf of shelves) {
      const lightWidth = shelf.size.x * 0.7;
      const zMin = Math.min(shelf.bounds.max.z - 0.5, shelf.bounds.min.z + 0.75);
      add({
        id: shelf.id + "-light",
        role: "light",
        parentId: shelf.parentId,
        hostId: shelf.id,
        bounds: bounds(
          shelf.position.x - lightWidth / 2,
          shelf.position.x + lightWidth / 2,
          shelf.bounds.min.y - rules.lightThickness,
          shelf.bounds.min.y,
          zMin,
          zMin + 0.5
        ),
        metadata: {
          lightType: "shelf_led",
          warmth: config.lightingWarmth,
          attachment: { axis: "y", hostFace: "min", componentFace: "max" }
        }
      });
    }
  }
}

function distributeShelves(options) {
  const {
    section,
    count,
    thickness,
    minY,
    maxY,
    clearDepth,
    rules,
    asymmetric,
    frontSetback = rules.shelfFrontSetback
  } = options;
  const available = maxY - minY;
  const clearGap = (available - count * thickness) / (count + 1);
  const shiftPattern = [0.75, -0.5, 1, -0.75, 0.5, -0.25];
  const rawShift = asymmetric ? shiftPattern[section.metadata.index % shiftPattern.length] : 0;
  const maxShift = Math.max(0, (clearGap - rules.minShelfClearance) / 2);
  const shift = clamp(rawShift, -maxShift, maxShift);
  const result = [];
  for (let index = 0; index < count; index += 1) {
    const shelfMinY = minY + clearGap + index * (thickness + clearGap) + shift;
    result.push(bounds(
      section.bounds.min.x + rules.shelfSideClearance,
      section.bounds.max.x - rules.shelfSideClearance,
      shelfMinY,
      shelfMinY + thickness,
      frontSetback,
      clearDepth
    ));
  }
  return result;
}

function normalizeSectionRatios(value, sectionCount) {
  const equalRatios = Array.from({ length: sectionCount }, () => 1);
  if (!Array.isArray(value) || value.length !== sectionCount) return equalRatios;
  if (!value.every((ratio) => typeof ratio === "number" && Number.isFinite(ratio) && ratio > 0)) {
    return equalRatios;
  }
  return value.slice();
}

function allocateSectionWidths(totalWidth, ratios) {
  const ratioTotal = ratios.reduce((total, ratio) => total + ratio, 0);
  let allocatedWidth = 0;
  return ratios.map((ratio, index) => {
    if (index === ratios.length - 1) return round(totalWidth - allocatedWidth);
    const width = round(totalWidth * ratio / ratioTotal);
    allocatedWidth = round(allocatedWidth + width);
    return width;
  });
}

function getSpecialZone(config) {
  let kind = null;
  if (config.deskOpening || config.layoutType === "desk_niche") kind = "desk";
  else if (config.centerOpening || config.layoutType === "media_wall") kind = "media";
  else if (config.featureOpening || config.layoutType === "feature_wall") kind = "feature";
  if (!kind) return { kind: null, indices: [] };

  const configuredSpan = Number(config.layoutMetadata.specialSpan);
  const defaultSpan = config.sections >= 4 && config.sections % 2 === 0 ? 2 : 1;
  const span = clamp(
    Number.isInteger(configuredSpan) ? configuredSpan : defaultSpan,
    1,
    config.sections
  );
  const start = Math.floor((config.sections - span) / 2);
  return {
    kind,
    indices: Array.from({ length: span }, (_, index) => start + index)
  };
}

function resolveSectionType(config, index, special) {
  if (special.indices.includes(index)) return special.kind;
  const explicitTypes = config.layoutMetadata.sectionTypes;
  if (Array.isArray(explicitTypes) && typeof explicitTypes[index] === "string") {
    return explicitTypes[index];
  }
  const drawerSections = config.layoutMetadata.drawerSections;
  if (Array.isArray(drawerSections) && drawerSections.includes(index)) return "drawers";
  if (config.tallDoors && (index === 0 || index === config.sections - 1)) return "tall_doors";
  if (config.lowerCabinets && config.lowerStorage === "drawers") return "drawers";
  return config.lowerCabinets ? "lower_doors" : "open";
}

/**
 * Validate descriptors without rendering them. The validator is reusable for
 * generated layouts and for serialized/restored layouts.
 */
export function validateBookcaseLayout(layout) {
  const issues = [];
  const components = Array.isArray(layout?.components) ? layout.components : [];
  const map = new Map();
  const referencePlanes = layout?.metrics?.referencePlanes || layout?.coordinateSystem?.referencePlanes || {
    floorPlaneY: 0,
    carcassFrontPlaneZ: 0,
    finishedFrontPlaneZ: 0,
    outerLeftPlaneX: -Number(layout?.config?.width || 0) / 2,
    outerRightPlaneX: Number(layout?.config?.width || 0) / 2,
    toeKickPlatePlaneZ: CONSTRUCTION_RULES.recessedToeKickDepth
  };

  for (const correction of layout?.corrections || []) {
    issues.push(issue(
      correction.code,
      "warning",
      null,
      null,
      correction.message
    ));
  }

  for (const component of components) {
    if (!component || typeof component.id !== "string") {
      issues.push(issue("INVALID_COMPONENT_SCHEMA", "error", null, null, "Every component requires a string id."));
      continue;
    }
    if (map.has(component.id)) {
      issues.push(issue(
        "DUPLICATE_COMPONENT_ID",
        "error",
        component.id,
        component.id,
        "Component ids must be unique."
      ));
    } else {
      map.set(component.id, component);
    }
    validateDescriptorShape(component, issues);
  }

  const root = map.get("bookcase");
  if (!root) {
    issues.push(issue("MISSING_ROOT", "error", "bookcase", null, "The descriptor graph requires a bookcase root."));
  }

  for (const component of components) {
    if (!component || typeof component.id !== "string") continue;
    if (component.id !== "bookcase" && (!component.parentId || !map.has(component.parentId))) {
      issues.push(issue(
        "MISSING_PARENT",
        "error",
        component.id,
        component.parentId || null,
        "Component parentId does not resolve to an existing component."
      ));
    }
    if (component.hostId && !map.has(component.hostId)) {
      issues.push(issue(
        "MISSING_HOST",
        "error",
        component.id,
        component.hostId,
        "Component hostId does not resolve to an existing component."
      ));
    }
    if (hasParentCycle(component, map)) {
      issues.push(issue("PARENT_CYCLE", "error", component.id, component.parentId, "Component hierarchy contains a cycle."));
    }
  }

  if (root) {
    for (const component of components) {
      if (!component?.bounds || component.id === root.id) continue;
      if (
        FACE_CHILD_ROLES.has(component.role) ||
        ATTACHED_ROLES.has(component.role) ||
        component.metadata?.allowOverhang
      ) {
        continue;
      }
      if (!containsBounds(root.bounds, component.bounds)) {
        issues.push(issue(
          "OUTSIDE_BOOKCASE_BOUNDS",
          "error",
          component.id,
          root.id,
          "Structural component lies outside the nominal bookcase bounds."
        ));
      }
    }
  }

  for (const component of components) {
    const parent = map.get(component?.parentId);
    const host = map.get(component?.hostId);
    if (!component?.bounds) continue;

    if (component.role === "section") {
      if (component.size.x + EPSILON < CONSTRUCTION_RULES.minSectionClearWidth) {
        issues.push(issue(
          "MIN_SECTION_CLEAR_WIDTH",
          "error",
          component.id,
          component.parentId,
          "Section clear width is below the supported minimum."
        ));
      }
    }

    if (
      parent &&
      ["section", "section_group", "opening", "shelf", "fixed_shelf"].includes(component.role) &&
      !containsBounds(parent.bounds, component.bounds)
    ) {
      issues.push(issue(
        "OUTSIDE_PARENT_BOUNDS",
        "error",
        component.id,
        parent.id,
        "Component is outside its parent bounds."
      ));
    }

    if (FACE_CHILD_ROLES.has(component.role) && host) {
      if (!containsOnAxes(host.bounds, component.bounds, ["x", "y"])) {
        issues.push(issue(
          "FRONT_OUTSIDE_OPENING_XY",
          "error",
          component.id,
          host.id,
          "Door and drawer fronts must remain inside their host opening in X and Y."
        ));
      }
      const mounting = component.metadata?.mounting;
      if (!["inset", "overlay"].includes(mounting)) {
        issues.push(issue(
          "FRONT_MOUNTING_INVALID",
          "error",
          component.id,
          host.id,
          "Every front requires an explicit inset or overlay mounting relationship."
        ));
      }
      const declaredFrontPlane = Number(component.metadata?.frontPlaneZ);
      if (!Number.isFinite(declaredFrontPlane) || !nearlyEqual(component.bounds.min.z, declaredFrontPlane)) {
        issues.push(issue(
          "FRONT_PLANE_MISMATCH",
          "error",
          component.id,
          host.id,
          "The descriptor visible front face must align with its declared finished front plane."
        ));
      }
      const expectedFinishedPlane = layout?.config?.constructionProfile === CONSTRUCTION_PROFILE_IDS.legacyOverlay
        ? -CONSTRUCTION_RULES.doorThickness
        : referencePlanes.finishedFrontPlaneZ;
      if (Number.isFinite(declaredFrontPlane) && !nearlyEqual(declaredFrontPlane, expectedFinishedPlane)) {
        issues.push(issue(
          "FRONT_PLANE_MISMATCH",
          "error",
          component.id,
          host.id,
          "The front face is not aligned to the construction profile's finished front plane."
        ));
      }
      if (component.bounds.max.z <= component.bounds.min.z + EPSILON) {
        issues.push(issue(
          "FRONT_DEPTH_DIRECTION_INVALID",
          "error",
          component.id,
          host.id,
          "Front thickness must extend inward in the positive-Z direction."
        ));
      }
      const attachmentMatches = mounting === "inset"
        ? nearlyEqual(component.bounds.min.z, host.bounds.min.z)
        : nearlyEqual(component.bounds.max.z, host.bounds.min.z);
      if (["inset", "overlay"].includes(mounting) && !attachmentMatches) {
        issues.push(issue(
          "FRONT_MOUNTING_INVALID",
          "error",
          component.id,
          host.id,
          mounting === "inset"
            ? "An inset front's finished face must align to the opening front plane."
            : "A legacy overlay front's back face must attach to the opening front plane."
        ));
      }
      validateFrontReveal(component, host, components, issues);
      validateDoorSemantics(component, host, layout, issues);
      validateFrontProfile(component, issues);
    }

    if (component.role === "handle" && host) {
      if (!containsOnAxes(host.bounds, component.bounds, ["x", "y"])) {
        issues.push(issue(
          "HARDWARE_OUTSIDE_FRONT",
          "error",
          component.id,
          host.id,
          "The complete hardware envelope must remain inside its host front."
        ));
      }
      validateHardware(component, host, components, issues);
    }

    if (component.role === "light") {
      if (parent && !containsBounds(parent.bounds, component.bounds)) {
        issues.push(issue(
          "LIGHT_OUTSIDE_SECTION",
          "error",
          component.id,
          parent.id,
          "Light must remain inside its owning section."
        ));
      }
      if (host) validateAttachment(component, host, issues);
    }

    if (component.role === "crown") {
      if (host) validateAttachment(component, host, issues);
      if (root) validateCrownComponent(component, root, layout, issues);
    }

    if (component.role === "shelf" && component.size.x > CONSTRUCTION_RULES.maxUnsupportedShelfSpan + EPSILON) {
      issues.push(issue(
        "SHELF_SUPPORT_REVIEW",
        "warning",
        component.id,
        component.parentId,
        "Shelf span exceeds the standard unsupported limit and requires engineered support review."
      ));
    }
  }

  validateShelfSpacing(components, issues);
  validateBaseAssembly(layout, components, map, referencePlanes, issues);
  validateHardwareCompleteness(layout, components, issues);
  validatePairedFronts(components, issues);
  validateCollisions(components, issues);

  const errors = issues.filter((item) => item.severity === "error");
  const warnings = issues.filter((item) => item.severity === "warning");
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    issues
  };
}

function validateDescriptorShape(component, issues) {
  const required = ["id", "role", "parentId", "hostId", "bounds", "size", "position"];
  for (const key of required) {
    if (!(key in component)) {
      issues.push(issue(
        "INVALID_COMPONENT_SCHEMA",
        "error",
        component.id || null,
        null,
        "Component is missing required property " + key + "."
      ));
    }
  }
  if (!component.bounds || !component.size || !component.position) return;
  const values = [
    component.bounds.min?.x,
    component.bounds.min?.y,
    component.bounds.min?.z,
    component.bounds.max?.x,
    component.bounds.max?.y,
    component.bounds.max?.z,
    component.size.x,
    component.size.y,
    component.size.z,
    component.position.x,
    component.position.y,
    component.position.z
  ];
  if (!values.every(Number.isFinite)) {
    issues.push(issue("NON_FINITE_GEOMETRY", "error", component.id, null, "All descriptor dimensions must be finite."));
    return;
  }
  if (component.size.x <= 0 || component.size.y <= 0 || component.size.z <= 0) {
    issues.push(issue("NON_POSITIVE_SIZE", "error", component.id, null, "Visible and logical descriptor sizes must be positive."));
  }
  const expectedSize = sizeFromBounds(component.bounds);
  const expectedPosition = positionFromBounds(component.bounds);
  if (!vectorNearlyEqual(component.size, expectedSize) || !vectorNearlyEqual(component.position, expectedPosition)) {
    issues.push(issue(
      "BOUNDS_MISMATCH",
      "error",
      component.id,
      null,
      "Bounds, size, and center position must describe the same box."
    ));
  }
}

function validateFrontReveal(component, host, components, issues) {
  const reveal = Number(component.metadata?.reveal);
  if (!nearlyEqual(reveal, CONSTRUCTION_RULES.doorReveal)) {
    issues.push(issue(
      "FRONT_REVEAL_INCONSISTENT",
      "error",
      component.id,
      host.id,
      "Front perimeter reveals must use the centralized JQ reveal rule."
    ));
    return;
  }
  const yValid = nearlyEqual(component.bounds.min.y - host.bounds.min.y, reveal) &&
    nearlyEqual(host.bounds.max.y - component.bounds.max.y, reveal);
  let perimeterYValid = yValid;
  if (component.role === "drawer_front") {
    const siblings = components
      .filter((item) => item.role === "drawer_front" && item.hostId === component.hostId)
      .sort((left, right) => left.bounds.min.y - right.bounds.min.y);
    const index = siblings.findIndex((item) => item.id === component.id);
    const bottomValid = index > 0 || nearlyEqual(component.bounds.min.y - host.bounds.min.y, reveal);
    const topValid = index < siblings.length - 1 || nearlyEqual(host.bounds.max.y - component.bounds.max.y, reveal);
    perimeterYValid = bottomValid && topValid;
  }
  const leafCount = Number(component.metadata?.leafCount || 1);
  const leafIndex = Number(component.metadata?.leafIndex || 0);
  const leftValid = leafCount === 2 && leafIndex === 1
    ? true
    : nearlyEqual(component.bounds.min.x - host.bounds.min.x, reveal);
  const rightValid = leafCount === 2 && leafIndex === 0
    ? true
    : nearlyEqual(host.bounds.max.x - component.bounds.max.x, reveal);
  if (!xOrDrawerGapValid(component, components) || !perimeterYValid || !leftValid || !rightValid) {
    issues.push(issue(
      "FRONT_REVEAL_INCONSISTENT",
      "error",
      component.id,
      host.id,
      "Measured front reveals or drawer gaps do not match declared construction values."
    ));
  }
}

function xOrDrawerGapValid(component, components) {
  if (component.role !== "drawer_front") return true;
  const siblings = components
    .filter((item) => item.role === "drawer_front" && item.hostId === component.hostId)
    .sort((left, right) => left.bounds.min.y - right.bounds.min.y);
  const index = siblings.findIndex((item) => item.id === component.id);
  if (index <= 0) return true;
  return nearlyEqual(
    component.bounds.min.y - siblings[index - 1].bounds.max.y,
    CONSTRUCTION_RULES.drawerGap
  );
}

function validateDoorSemantics(component, host, layout, issues) {
  if (component.role !== "door") return;
  const hingeSide = component.metadata?.hingeSide;
  const latchSide = component.metadata?.latchSide;
  if (!["hinge_left", "hinge_right"].includes(hingeSide)) {
    issues.push(issue("INVALID_HINGE_SIDE", "error", component.id, host.id, "Door hinge side must be hinge_left or hinge_right."));
  }
  if (!["latch_left", "latch_right"].includes(latchSide)) {
    issues.push(issue("INVALID_LATCH_SIDE", "error", component.id, host.id, "Door latch side must be latch_left or latch_right."));
  }
  if (
    (hingeSide === "hinge_left" && latchSide !== "latch_right") ||
    (hingeSide === "hinge_right" && latchSide !== "latch_left")
  ) {
    issues.push(issue("HINGE_LATCH_CONFLICT", "error", component.id, host.id, "Hinge and latch sides must oppose one another."));
  }
  const legacy = layout?.config?.constructionProfile === CONSTRUCTION_PROFILE_IDS.legacyOverlay;
  const severity = legacy ? "warning" : "error";
  if (component.size.x > CONSTRUCTION_RULES.maxSingleDoorLeafWidth + EPSILON) {
    issues.push(issue(
      "DOOR_LEAF_TOO_WIDE",
      severity,
      component.id,
      host.id,
      legacy
        ? "Legacy door leaf exceeds the current JQ width limit and requires shop review."
        : "Door leaf exceeds the supported maximum finished width."
    ));
  }
  if (component.size.x + EPSILON < CONSTRUCTION_RULES.minDoorLeafWidth) {
    issues.push(issue(
      "DOOR_LEAF_TOO_NARROW",
      severity,
      component.id,
      host.id,
      legacy
        ? "Legacy door leaf is below the current JQ minimum and requires shop review."
        : "Door leaf is below the supported minimum finished width."
    ));
  }
  const aspect = component.size.y / component.size.x;
  if (component.size.y > CONSTRUCTION_RULES.maxStandardDoorHeight + EPSILON || aspect > CONSTRUCTION_RULES.doorAspectReviewRatio) {
    issues.push(issue(
      "DOOR_ASPECT_REVIEW",
      "warning",
      component.id,
      host.id,
      "Tall door dimensions require hinge-count, weight, and aspect-ratio shop review."
    ));
  }
  if (component.metadata?.arrangementBuildable === false) {
    const code = component.size.x > CONSTRUCTION_RULES.maxSingleDoorLeafWidth
      ? "DOOR_LEAF_TOO_WIDE"
      : "DOOR_LEAF_TOO_NARROW";
    if (!issues.some((item) => item.code === code && item.componentId === component.id)) {
      issues.push(issue(code, "error", component.id, host.id, component.metadata.arrangementReason || "Requested door arrangement is not buildable."));
    }
  }
}

function validateFrontProfile(component, issues) {
  const profile = component.metadata?.profileGeometry;
  if (component.role === "drawer_front" && component.metadata?.style === "glass") {
    issues.push(issue("DRAWER_GLASS_UNSUPPORTED", "error", component.id, component.hostId, "Glass is not supported for drawer fronts."));
  }
  if (!profile || typeof profile !== "object") {
    issues.push(issue("PROFILE_CENTER_FIELD_NON_POSITIVE", "error", component.id, component.hostId, "Front profile geometry must be resolved by the layout engine."));
    return;
  }
  if (!profile.valid) {
    issues.push(issue("PROFILE_CENTER_FIELD_NON_POSITIVE", "error", component.id, component.hostId, "Front profile does not retain a positive supported center field."));
  }
  if (profile.kind !== "slab" && profile.frameWidth * 2 >= Math.min(component.size.x, component.size.y) - EPSILON) {
    issues.push(issue("PROFILE_FRAME_TOO_LARGE", "error", component.id, component.hostId, "Resolved rail or stile width consumes the front's center field."));
  }
  const regions = [...(profile.solidRegions || []), ...(profile.fieldRegion ? [profile.fieldRegion] : [])];
  for (const region of regions) {
    if (
      region.bounds.min.x < component.bounds.min.x - EPSILON ||
      region.bounds.max.x > component.bounds.max.x + EPSILON ||
      region.bounds.min.y < component.bounds.min.y - EPSILON ||
      region.bounds.max.y > component.bounds.max.y + EPSILON
    ) {
      issues.push(issue("PROFILE_SUBGEOMETRY_OUTSIDE_FRONT", "error", component.id, component.hostId, "Resolved profile subgeometry leaves its physical front envelope."));
      break;
    }
  }
}

function validateHardware(component, host, components, issues) {
  const center = component.metadata?.mountingCenter || component.metadata?.mountingCenters?.[0];
  if (!center || ![center.x, center.y, center.z].every(Number.isFinite)) {
    issues.push(issue("HARDWARE_ATTACHMENT_MISMATCH", "error", component.id, host.id, "Hardware requires a finite drill or mounting center."));
    return;
  }
  if (
    center.x < host.bounds.min.x - EPSILON || center.x > host.bounds.max.x + EPSILON ||
    center.y < host.bounds.min.y - EPSILON || center.y > host.bounds.max.y + EPSILON
  ) {
    issues.push(issue("HARDWARE_OUTSIDE_FRONT", "error", component.id, host.id, "Hardware drill center lies outside its host front."));
  }
  const frontPlaneZ = Number(host.metadata?.frontPlaneZ);
  if (!nearlyEqual(center.z, frontPlaneZ) || !nearlyEqual(component.bounds.max.z, frontPlaneZ)) {
    issues.push(issue("HARDWARE_ATTACHMENT_MISMATCH", "error", component.id, host.id, "Hardware rear mounting plane must attach to the finished front face."));
  }
  const profile = host.metadata?.profileGeometry;
  const solidRegion = profile?.solidRegions?.find((region) => pointWithinRegion(center.x, center.y, region));
  const fieldRegion = profile?.fieldRegion;
  if (!solidRegion) {
    issues.push(issue("HARDWARE_NOT_ON_SOLID_REGION", "error", component.id, host.id, "Hardware drill center must land on a resolved solid front region."));
  }
  if (fieldRegion?.kind === "glass" && pointWithinRegion(center.x, center.y, fieldRegion)) {
    issues.push(issue("HARDWARE_ON_GLASS", "error", component.id, host.id, "Hardware cannot be drilled through the supported glass field."));
  }
  if (fieldRegion && boundsIntersectOnAxes(component.bounds, fieldRegion.bounds, ["x", "y"])) {
    issues.push(issue(
      fieldRegion.kind === "glass" ? "HARDWARE_ON_GLASS" : "HARDWARE_NOT_ON_SOLID_REGION",
      "error",
      component.id,
      host.id,
      fieldRegion.kind === "glass"
        ? "The complete hardware envelope must remain outside the glass field."
        : "The complete hardware envelope must remain on solid frame material and outside the recessed field."
    ));
  }
  if (host.role === "door" && ["latch_left", "latch_right"].includes(host.metadata?.latchSide)) {
    const onDeclaredLatchSide = host.metadata.latchSide === "latch_right"
      ? center.x > host.position.x + EPSILON
      : center.x < host.position.x - EPSILON;
    if (!onDeclaredLatchSide) {
      issues.push(issue("HARDWARE_LATCH_SIDE_MISMATCH", "error", component.id, host.id, "Door hardware must be mounted on the declared latch side opposite the hinges."));
    }
  }
  const edgeClearance = Math.min(
    component.bounds.min.x - host.bounds.min.x,
    host.bounds.max.x - component.bounds.max.x,
    component.bounds.min.y - host.bounds.min.y,
    host.bounds.max.y - component.bounds.max.y
  );
  if (edgeClearance + EPSILON < CONSTRUCTION_RULES.handleEdgeClearance) {
    issues.push(issue("HARDWARE_TOO_CLOSE_TO_EDGE", "error", component.id, host.id, "Hardware envelope is too close to a front edge."));
  }
  if (host.metadata?.leafCount === 2) {
    const latchClearance = host.metadata.latchSide === "latch_right"
      ? host.bounds.max.x - component.bounds.max.x
      : component.bounds.min.x - host.bounds.min.x;
    if (latchClearance + EPSILON < CONSTRUCTION_RULES.handleEdgeClearance) {
      issues.push(issue("HARDWARE_TOO_CLOSE_TO_MEETING_GAP", "error", component.id, host.id, "Paired hardware must clear the meeting gap."));
    }
  }
  const expectedOrientation = component.metadata?.hardwareType === "pull"
    ? host.role === "drawer_front" ? "horizontal" : "vertical"
    : "neutral";
  if (component.metadata?.orientation !== expectedOrientation) {
    issues.push(issue("HARDWARE_ORIENTATION_INVALID", "error", component.id, host.id, "Hardware orientation is incompatible with its front context."));
  }
  const declaredRegion = component.metadata?.supportingFrontRegion;
  if (declaredRegion && solidRegion && declaredRegion !== solidRegion.id) {
    // Rail/stile intersections are both solid; allow either declared region
    // when the mounting center is physically contained by that declaration.
    const declared = profile.solidRegions.find((region) => region.id === declaredRegion);
    if (!declared || !pointWithinRegion(center.x, center.y, declared)) {
      issues.push(issue("HARDWARE_NOT_ON_SOLID_REGION", "error", component.id, host.id, "Declared hardware support region does not contain its drill center."));
    }
  }
}

function validateHardwareCompleteness(layout, components, issues) {
  const pushLatch = layout?.config?.hardware === "push_latch";
  const handlesByHost = new Map();
  for (const handle of components.filter((component) => component.role === "handle")) {
    const hosted = handlesByHost.get(handle.hostId) || [];
    hosted.push(handle);
    handlesByHost.set(handle.hostId, hosted);
  }
  for (const front of components.filter((component) => FACE_CHILD_ROLES.has(component.role))) {
    const count = handlesByHost.get(front.id)?.length || 0;
    const expected = pushLatch ? 0 : 1;
    if (count !== expected) {
      issues.push(issue(
        "HARDWARE_COUNT_MISMATCH",
        "error",
        front.id,
        front.hostId,
        pushLatch
          ? "Push-latch fronts must not generate visible hardware descriptors."
          : "Every ordinary door leaf and drawer front must generate exactly one hosted hardware descriptor."
      ));
    }
  }
}

function validatePairedFronts(components, issues) {
  const pairs = new Map();
  for (const door of components.filter((item) => item.role === "door" && item.metadata?.leafCount === 2)) {
    const siblings = pairs.get(door.hostId) || [];
    siblings.push(door);
    pairs.set(door.hostId, siblings);
  }
  for (const [hostId, leaves] of pairs) {
    if (leaves.length !== 2) {
      issues.push(issue("PAIR_LEAF_WIDTH_MISMATCH", "error", leaves[0]?.id || null, hostId, "A paired arrangement must generate exactly two leaves."));
      continue;
    }
    leaves.sort((left, right) => left.bounds.min.x - right.bounds.min.x);
    if (!nearlyEqual(leaves[0].size.x, leaves[1].size.x, EPSILON * 2)) {
      issues.push(issue("PAIR_LEAF_WIDTH_MISMATCH", "error", leaves[0].id, leaves[1].id, "Paired door leaves must have equal finished widths."));
    }
    const measuredGap = leaves[1].bounds.min.x - leaves[0].bounds.max.x;
    if (!nearlyEqual(measuredGap, CONSTRUCTION_RULES.doubleDoorCenterGap)) {
      issues.push(issue("PAIR_MEETING_GAP_MISMATCH", "error", leaves[0].id, leaves[1].id, "Paired door meeting gap does not match the centralized rule."));
    }
    const handles = components
      .filter((item) => item.role === "handle" && leaves.some((leaf) => leaf.id === item.hostId))
      .sort((left, right) => left.position.x - right.position.x);
    if (handles.length === 2) {
      const meetingCenter = (leaves[0].bounds.max.x + leaves[1].bounds.min.x) / 2;
      const mirrored = nearlyEqual(meetingCenter - handles[0].position.x, handles[1].position.x - meetingCenter) &&
        nearlyEqual(handles[0].position.y, handles[1].position.y);
      if (!mirrored) {
        issues.push(issue("PAIRED_HARDWARE_NOT_MIRRORED", "error", handles[0].id, handles[1].id, "Paired door hardware must mirror around the meeting line."));
      }
    }
  }
}

function validateBaseAssembly(layout, components, map, referencePlanes, issues) {
  const style = layout?.config?.baseStyle;
  const baseComponents = components.filter((component) => BASE_PHYSICAL_ROLES.has(component.role) && component.metadata?.style === style);
  for (const component of baseComponents) {
    if (component.metadata?.floorContact && !nearlyEqual(component.bounds.min.y, referencePlanes.floorPlaneY)) {
      issues.push(issue("BASE_NOT_ON_FLOOR", "error", component.id, "bookcase", "Base component marked for floor contact does not reach the floor plane."));
    }
  }
  const bottom = map.get("bottom-panel");
  const baseHeight = Number(layout?.metrics?.baseHeight);
  if (bottom && (!nearlyEqual(bottom.bounds.min.y, baseHeight) || !baseComponents.some((component) => nearlyEqual(component.bounds.max.y, baseHeight)))) {
    issues.push(issue("BASE_CARCASS_GAP", "error", "bottom-panel", "base", "Base and carcass must terminate at one intentional elevation."));
  }

  if (style === "toe_kick") {
    const toeVoid = map.get("base-toe-kick-void");
    const plate = map.get("base-toe-kick-plate");
    if (!toeVoid || !nearlyEqual(toeVoid.size.z, CONSTRUCTION_RULES.recessedToeKickDepth)) {
      issues.push(issue("TOE_KICK_RECESS_MISMATCH", "error", toeVoid?.id || null, "base", "Toe-kick clear recess must match the centralized depth rule."));
    }
    if (!plate || !nearlyEqual(plate.bounds.min.z, referencePlanes.toeKickPlatePlaneZ)) {
      issues.push(issue("TOE_KICK_PLATE_POSITION_INVALID", "error", plate?.id || null, "base", "Kick plate front face must sit at the back of the toe recess."));
    }
    if (toeVoid) {
      const occupant = components.find((component) => (
        component.id !== toeVoid.id &&
        SOLID_ROLES.has(component.role) &&
        boundsIntersect(component.bounds, toeVoid.bounds)
      ));
      if (occupant) {
        issues.push(issue("TOE_KICK_VOID_OCCUPIED", "error", occupant.id, toeVoid.id, "A physical base part occupies the usable toe-kick void."));
      }
    }
  }

  if (style === "plinth") {
    const plinth = map.get("base");
    if (!plinth ||
      !nearlyEqual(plinth.bounds.min.x, referencePlanes.outerLeftPlaneX) ||
      !nearlyEqual(plinth.bounds.max.x, referencePlanes.outerRightPlaneX) ||
      !nearlyEqual(plinth.bounds.min.z, referencePlanes.baseFrontPlaneZ) ||
      plinth.metadata?.allowDecorativeOverhang) {
      issues.push(issue("PLINTH_NOT_FLUSH", "error", plinth?.id || null, "bookcase", "Flush plinth must align to both carcass sides and the finished front plane without overhang."));
    }
  }

  if (style === "furniture_base") {
    const support = map.get("base");
    const left = map.get("base-foot-left");
    const right = map.get("base-foot-right");
    for (const foot of [left, right].filter(Boolean)) {
      if (foot.bounds.min.x < referencePlanes.outerLeftPlaneX - EPSILON || foot.bounds.max.x > referencePlanes.outerRightPlaneX + EPSILON) {
        issues.push(issue("FURNITURE_FOOT_OUTSIDE_WIDTH", "error", foot.id, "bookcase", "Furniture foot lies outside the carcass width."));
      }
      if (foot.size.z >= Number(layout.config.depth) - EPSILON) {
        issues.push(issue("FURNITURE_FOOT_FULL_DEPTH", "error", foot.id, "bookcase", "A visible front furniture foot cannot extend through the cabinet depth."));
      }
    }
    if (!left || !right ||
      !nearlyEqual(left.size.x, right.size.x) ||
      !nearlyEqual(left.bounds.min.x, -right.bounds.max.x) ||
      !nearlyEqual(left.bounds.max.x, -right.bounds.min.x)) {
      issues.push(issue("FURNITURE_FEET_NOT_MIRRORED", "error", left?.id || null, right?.id || null, "Furniture feet must mirror about the cabinet centerline."));
    }
    if (!support ||
      support.metadata?.purpose !== "hidden_rear_support" ||
      support.bounds.min.x <= referencePlanes.outerLeftPlaneX + EPSILON ||
      support.bounds.max.x >= referencePlanes.outerRightPlaneX - EPSILON ||
      !nearlyEqual(support.bounds.max.z, referencePlanes.outerBackPlaneZ) ||
      support.size.z > CONSTRUCTION_RULES.furnitureRearSupportDepth + EPSILON) {
      issues.push(issue("FURNITURE_SUPPORT_NOT_HIDDEN", "error", support?.id || null, "bookcase", "Furniture-base structural support must be a side-inset rear rail rather than a full-depth or full-width side-view slab."));
    }
  }

  for (let leftIndex = 0; leftIndex < baseComponents.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < baseComponents.length; rightIndex += 1) {
      if (boundsIntersect(baseComponents[leftIndex].bounds, baseComponents[rightIndex].bounds)) {
        issues.push(issue("BASE_COMPONENT_COLLISION", "error", baseComponents[leftIndex].id, baseComponents[rightIndex].id, "Base components overlap instead of meeting at an intentional joint."));
      }
    }
  }
}

function validateCrownComponent(component, root, layout, issues) {
  const rule = CONSTRUCTION_RULES.crownProfiles[component.metadata?.style];
  if (!rule) {
    issues.push(issue("CROWN_OVERHANG_EXCEEDED", "error", component.id, root.id, "Crown style requires a centralized overhang rule."));
    return;
  }
  const sideOverhang = Math.max(
    0,
    root.bounds.min.x - component.bounds.min.x,
    component.bounds.max.x - root.bounds.max.x
  );
  const frontOverhang = Math.max(0, root.bounds.min.z - component.bounds.min.z);
  const rearOverhang = Math.max(0, component.bounds.max.z - root.bounds.max.z);
  const topOverhang = Math.max(0, component.bounds.max.y - root.bounds.max.y);
  const metadataMatches = nearlyEqual(Number(component.metadata?.maximumSideOverhang), rule.sideOverhang) &&
    nearlyEqual(Number(component.metadata?.maximumFrontOverhang), rule.frontOverhang) &&
    nearlyEqual(Number(component.metadata?.maximumRearOverhang), rule.rearOverhang);
  if (
    sideOverhang > rule.sideOverhang + EPSILON ||
    frontOverhang > rule.frontOverhang + EPSILON ||
    rearOverhang > rule.rearOverhang + EPSILON ||
    topOverhang > EPSILON ||
    !metadataMatches
  ) {
    issues.push(issue(
      "CROWN_OVERHANG_EXCEEDED",
      "error",
      component.id,
      root.id,
      "Crown geometry or metadata exceeds the selected style's centralized decorative envelope."
    ));
  }
  if (component.metadata?.hostSurface === "side_panel") {
    const expectedBack = Number(layout?.config?.depth) - CONSTRUCTION_RULES.backPanelThickness;
    if (!nearlyEqual(component.bounds.min.z, 0) || !nearlyEqual(component.bounds.max.z, expectedBack)) {
      issues.push(issue("CROWN_SIDE_RETURN_INVALID", "error", component.id, component.hostId, "Crown side returns must run continuously from the front plane to the back-interior plane."));
    }
  }
}

function validateAttachment(component, host, issues) {
  const attachment = component.metadata?.attachment;
  if (!attachment || !["x", "y", "z"].includes(attachment.axis)) {
    issues.push(issue(
      "MISSING_ATTACHMENT_RULE",
      "error",
      component.id,
      host.id,
      "Attached component requires an explicit attachment surface."
    ));
    return;
  }
  const hostCoordinate = host.bounds[attachment.hostFace]?.[attachment.axis];
  const componentCoordinate = component.bounds[attachment.componentFace]?.[attachment.axis];
  if (!Number.isFinite(hostCoordinate) || !Number.isFinite(componentCoordinate) || !nearlyEqual(hostCoordinate, componentCoordinate)) {
    issues.push(issue(
      "ATTACHMENT_MISMATCH",
      "error",
      component.id,
      host.id,
      "Attached component does not touch the declared host surface."
    ));
  }
  const surfaceAxes = ["x", "y", "z"].filter((axis) => axis !== attachment.axis);
  if (!boundsIntersectOnAxes(component.bounds, host.bounds, surfaceAxes)) {
    issues.push(issue(
      "ATTACHMENT_SURFACE_DISCONNECTED",
      "error",
      component.id,
      host.id,
      "Attached component touches the declared coordinate but has no overlapping footprint on the host surface."
    ));
  }
}

function validateShelfSpacing(components, issues) {
  const bySection = new Map();
  for (const component of components) {
    if (component?.role !== "shelf") continue;
    const siblings = bySection.get(component.parentId) || [];
    siblings.push(component);
    bySection.set(component.parentId, siblings);
  }
  for (const siblings of bySection.values()) {
    siblings.sort((a, b) => a.bounds.min.y - b.bounds.min.y);
    for (let index = 1; index < siblings.length; index += 1) {
      const gap = siblings[index].bounds.min.y - siblings[index - 1].bounds.max.y;
      if (gap + EPSILON < CONSTRUCTION_RULES.minShelfClearance) {
        issues.push(issue(
          "SHELF_CLEARANCE",
          "error",
          siblings[index].id,
          siblings[index - 1].id,
          "Adjacent shelves do not maintain minimum vertical clearance."
        ));
      }
    }
  }
}

function validateCollisions(components, issues) {
  const solids = components.filter((component) => component?.bounds && SOLID_ROLES.has(component.role));
  for (let leftIndex = 0; leftIndex < solids.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < solids.length; rightIndex += 1) {
      const left = solids[leftIndex];
      const right = solids[rightIndex];
      if (!boundsIntersect(left.bounds, right.bounds)) continue;
      issues.push(issue(
        "COMPONENT_COLLISION",
        "error",
        left.id,
        right.id,
        "Solid component bounding boxes overlap."
      ));
    }
  }
}

export function findComponent(layout, id) {
  return (layout?.components || []).find((component) => component.id === id) || null;
}

export function containsBounds(container, child, epsilon = EPSILON) {
  return containsOnAxes(container, child, ["x", "y", "z"], epsilon);
}

export function containsOnAxes(container, child, axes, epsilon = EPSILON) {
  return axes.every(
    (axis) =>
      child.min[axis] + epsilon >= container.min[axis] &&
      child.max[axis] - epsilon <= container.max[axis]
  );
}

function boundsIntersectOnAxes(left, right, axes, epsilon = EPSILON) {
  return axes.every((axis) => (
    Math.min(left.max[axis], right.max[axis]) - Math.max(left.min[axis], right.min[axis]) > epsilon
  ));
}

export function boundsIntersect(left, right, epsilon = EPSILON) {
  return (
    Math.min(left.max.x, right.max.x) - Math.max(left.min.x, right.min.x) > epsilon &&
    Math.min(left.max.y, right.max.y) - Math.max(left.min.y, right.min.y) > epsilon &&
    Math.min(left.max.z, right.max.z) - Math.max(left.min.z, right.min.z) > epsilon
  );
}

function createComponent(definition) {
  const componentBounds = cloneBounds(definition.bounds);
  return {
    id: definition.id,
    role: definition.role,
    parentId: definition.parentId ?? null,
    hostId: definition.hostId ?? null,
    bounds: componentBounds,
    size: sizeFromBounds(componentBounds),
    position: positionFromBounds(componentBounds),
    metadata: cloneMetadata(definition.metadata)
  };
}

function bounds(minX, maxX, minY, maxY, minZ, maxZ) {
  return {
    min: { x: round(minX), y: round(minY), z: round(minZ) },
    max: { x: round(maxX), y: round(maxY), z: round(maxZ) }
  };
}

function cloneBounds(value) {
  return bounds(
    value.min.x,
    value.max.x,
    value.min.y,
    value.max.y,
    value.min.z,
    value.max.z
  );
}

function sizeFromBounds(value) {
  return {
    x: round(value.max.x - value.min.x),
    y: round(value.max.y - value.min.y),
    z: round(value.max.z - value.min.z)
  };
}

function positionFromBounds(value) {
  return {
    x: round((value.min.x + value.max.x) / 2),
    y: round((value.min.y + value.max.y) / 2),
    z: round((value.min.z + value.max.z) / 2)
  };
}

function getBaseHeight(style) {
  if (style === "toe_kick") return CONSTRUCTION_RULES.recessedToeKickHeight;
  if (style === "furniture_base") return CONSTRUCTION_RULES.furnitureBaseHeight;
  return CONSTRUCTION_RULES.flushPlinthHeight;
}

export function buildBaseAssembly(context) {
  if (context.config.baseStyle === "toe_kick") return buildRecessedToeKickBase(context);
  if (context.config.baseStyle === "furniture_base") return buildFurnitureBase(context);
  return buildFlushPlinthBase(context);
}

function baseMetadata(style, purpose, extra = {}) {
  return {
    style,
    purpose,
    visible: true,
    structural: false,
    frontPlane: 0,
    floorContact: true,
    recessDepth: 0,
    side: null,
    allowDecorativeOverhang: false,
    allowOverhang: false,
    ...extra
  };
}

function buildRecessedToeKickBase({ add, config, root, baseHeight, referencePlanes, rules }) {
  const plateFront = referencePlanes.toeKickPlatePlaneZ;
  const plateBack = plateFront + rules.toeKickPlateThickness;
  const returnThickness = rules.toeKickReturnThickness;
  const structural = add({
    id: "base",
    role: "base",
    parentId: root.id,
    hostId: root.id,
    bounds: bounds(-config.width / 2, config.width / 2, 0, baseHeight, plateBack, config.depth),
    metadata: baseMetadata("toe_kick", "structural_platform", {
      visible: false,
      structural: true,
      frontPlane: plateBack,
      recessDepth: rules.recessedToeKickDepth
    })
  });
  add({
    id: "base-toe-kick-plate",
    role: "trim",
    parentId: root.id,
    hostId: structural.id,
    bounds: bounds(-config.width / 2, config.width / 2, 0, baseHeight, plateFront, plateBack),
    metadata: baseMetadata("toe_kick", "kick_plate", {
      structural: true,
      frontPlane: plateFront,
      recessDepth: rules.recessedToeKickDepth
    })
  });
  for (const side of ["left", "right"]) {
    const minX = side === "left" ? -config.width / 2 : config.width / 2 - returnThickness;
    add({
      id: `base-toe-return-${side}`,
      role: "trim",
      parentId: root.id,
      hostId: structural.id,
      bounds: bounds(minX, minX + returnThickness, 0, baseHeight, 0, plateFront),
      metadata: baseMetadata("toe_kick", "end_return", {
        structural: true,
        frontPlane: 0,
        recessDepth: rules.recessedToeKickDepth,
        side
      })
    });
  }
  add({
    id: "base-toe-kick-void",
    role: "opening",
    parentId: root.id,
    hostId: structural.id,
    bounds: bounds(
      -config.width / 2 + returnThickness,
      config.width / 2 - returnThickness,
      0,
      baseHeight,
      0,
      plateFront
    ),
    metadata: {
      kind: "toe_kick_void",
      style: "toe_kick",
      purpose: "usable_toe_space",
      visible: false,
      structural: false,
      frontPlane: 0,
      floorContact: true,
      recessDepth: rules.recessedToeKickDepth,
      allowDecorativeOverhang: false
    }
  });
  return structural;
}

function buildFlushPlinthBase({ add, config, root, baseHeight, referencePlanes }) {
  return add({
    id: "base",
    role: "base",
    parentId: root.id,
    hostId: root.id,
    bounds: bounds(-config.width / 2, config.width / 2, 0, baseHeight, referencePlanes.baseFrontPlaneZ, config.depth),
    metadata: baseMetadata("plinth", "flush_plinth", {
      structural: true,
      frontPlane: referencePlanes.baseFrontPlaneZ
    })
  });
}

function buildFurnitureBase({ add, config, root, baseHeight, referencePlanes, rules }) {
  const supportSideInset = rules.furnitureRearSupportSideInset;
  const supportDepth = rules.furnitureRearSupportDepth;
  const structural = add({
    id: "base",
    role: "base",
    parentId: root.id,
    hostId: root.id,
    bounds: bounds(
      referencePlanes.outerLeftPlaneX + supportSideInset,
      referencePlanes.outerRightPlaneX - supportSideInset,
      0,
      baseHeight,
      referencePlanes.outerBackPlaneZ - supportDepth,
      referencePlanes.outerBackPlaneZ
    ),
    metadata: baseMetadata("furniture_base", "hidden_rear_support", {
      visible: false,
      structural: true,
      frontPlane: referencePlanes.outerBackPlaneZ - supportDepth,
      sideInset: supportSideInset,
      supportDepth
    })
  });
  const leftOuterX = referencePlanes.outerLeftPlaneX + rules.furnitureFootOutsideInset;
  const rightOuterX = referencePlanes.outerRightPlaneX - rules.furnitureFootOutsideInset;
  const footBounds = {
    left: { minX: leftOuterX, maxX: leftOuterX + rules.furnitureFootWidth },
    right: { minX: rightOuterX - rules.furnitureFootWidth, maxX: rightOuterX }
  };
  for (const side of ["left", "right"]) {
    add({
      id: `base-foot-${side}`,
      role: "trim",
      parentId: root.id,
      hostId: structural.id,
      bounds: bounds(
        footBounds[side].minX,
        footBounds[side].maxX,
        0,
        baseHeight,
        referencePlanes.baseFrontPlaneZ,
        rules.furnitureFootDepth
      ),
      metadata: baseMetadata("furniture_base", "front_foot", {
        structural: true,
        frontPlane: referencePlanes.finishedFrontPlaneZ,
        side,
        outsideInset: rules.furnitureFootOutsideInset,
        footDepth: rules.furnitureFootDepth
      })
    });
  }
  add({
    id: "base-furniture-apron",
    role: "trim",
    parentId: root.id,
    hostId: structural.id,
    bounds: bounds(
      footBounds.left.maxX,
      footBounds.right.minX,
      baseHeight - rules.furnitureApronHeight,
      baseHeight,
      referencePlanes.baseFrontPlaneZ,
      referencePlanes.baseFrontPlaneZ + rules.furnitureApronDepth
    ),
    metadata: baseMetadata("furniture_base", "front_apron", {
      floorContact: false,
      structural: true,
      frontPlane: referencePlanes.baseFrontPlaneZ
    })
  });
  return structural;
}

function addCrownDescriptors(add, config, root, topPanel, leftSidePanel, rightSidePanel) {
  if (config.crownStyle === "none") return;
  const profileRule = CONSTRUCTION_RULES.crownProfiles[config.crownStyle]
    || CONSTRUCTION_RULES.crownProfiles.classic_crown;
  const definitions = [];
  if (config.crownStyle === "slim_cap") {
    definitions.push({
      id: "crown-slim-cap",
      minX: -config.width / 2 - 0.25,
      maxX: config.width / 2 + 0.25,
      minY: config.height - CONSTRUCTION_RULES.slimCapProfileDrop,
      maxY: config.height,
      minZ: -0.375,
      maxZ: 0,
      purpose: "slim_cap"
    });
  } else if (config.crownStyle === "modern_soffit") {
    definitions.push({
      id: "crown-modern-band",
      minX: -config.width / 2 - 0.125,
      maxX: config.width / 2 + 0.125,
      minY: config.height - CONSTRUCTION_RULES.modernSoffitHeight,
      maxY: config.height,
      minZ: -0.5,
      maxZ: 0,
      purpose: "modern_soffit"
    });
  } else {
    definitions.push(
      {
        id: "crown-classic-rail",
        minX: -config.width / 2 - 0.125,
        maxX: config.width / 2 + 0.125,
        minY: config.height - 0.75,
        maxY: config.height,
        minZ: -0.25,
        maxZ: 0,
        purpose: "classic_rail"
      },
      {
        id: "crown-classic-cap",
        minX: -config.width / 2 - 0.5,
        maxX: config.width / 2 + 0.5,
        minY: config.height - CONSTRUCTION_RULES.classicCrownProfileDrop,
        maxY: config.height - 0.75,
        minZ: -0.625,
        maxZ: 0,
        purpose: "classic_cap",
        hostId: "crown-classic-rail",
        hostSurface: "crown_profile",
        attachment: { axis: "y", hostFace: "min", componentFace: "max" }
      }
    );
  }

  const metadata = (purpose, hostSurface, side = null) => ({
    style: config.crownStyle,
    purpose,
    visible: true,
    structural: false,
    side,
    allowOverhang: true,
    allowDecorativeOverhang: true,
    maximumSideOverhang: profileRule.sideOverhang,
    maximumFrontOverhang: profileRule.frontOverhang,
    maximumRearOverhang: profileRule.rearOverhang,
    hostSurface
  });

  definitions.forEach((definition) => {
    add({
      id: definition.id,
      role: "crown",
      parentId: root.id,
      hostId: definition.hostId || topPanel.id,
      bounds: bounds(
        definition.minX,
        definition.maxX,
        definition.minY,
        definition.maxY,
        definition.minZ,
        definition.maxZ
      ),
      metadata: {
        ...metadata(definition.purpose, definition.hostSurface || "top_panel"),
        attachment: definition.attachment || { axis: "z", hostFace: "min", componentFace: "max" }
      }
    });

    for (const side of ["left", "right"]) {
      const sidePanel = side === "left" ? leftSidePanel : rightSidePanel;
      const minX = side === "left" ? definition.minX : config.width / 2;
      const maxX = side === "left" ? -config.width / 2 : definition.maxX;
      add({
        id: `${definition.id}-${side}-return`,
        role: "crown",
        parentId: root.id,
        hostId: sidePanel.id,
        bounds: bounds(
          minX,
          maxX,
          definition.minY,
          definition.maxY,
          0,
          config.depth - CONSTRUCTION_RULES.backPanelThickness
        ),
        metadata: {
          ...metadata(`${definition.purpose}_${side}_return`, "side_panel", side),
          attachment: side === "left"
            ? { axis: "x", hostFace: "min", componentFace: "max" }
            : { axis: "x", hostFace: "max", componentFace: "min" }
        }
      });
    }
  });
}

function getDecorativeBounds(components, nominalBounds) {
  const rendered = components.filter((component) => (
    component?.bounds && !VOLUME_ROLES.has(component.role) && component.metadata?.visible !== false
  ));
  return rendered.reduce((combined, component) => ({
    min: {
      x: Math.min(combined.min.x, component.bounds.min.x),
      y: Math.min(combined.min.y, component.bounds.min.y),
      z: Math.min(combined.min.z, component.bounds.min.z)
    },
    max: {
      x: Math.max(combined.max.x, component.bounds.max.x),
      y: Math.max(combined.max.y, component.bounds.max.y),
      z: Math.max(combined.max.z, component.bounds.max.z)
    }
  }), cloneBounds(nominalBounds));
}

function getMaximumFrontProjection(components, finishedFrontPlaneZ) {
  const minimumZ = components
    .filter((component) => component?.bounds && component.metadata?.visible !== false)
    .reduce((value, component) => Math.min(value, component.bounds.min.z), finishedFrontPlaneZ);
  return round(Math.max(0, finishedFrontPlaneZ - minimumZ));
}

function getMaximumSideOverhang(components, nominalBounds) {
  return round(components.reduce((maximum, component) => {
    if (!component?.bounds || !component.metadata?.allowDecorativeOverhang) return maximum;
    return Math.max(
      maximum,
      nominalBounds.min.x - component.bounds.min.x,
      component.bounds.max.x - nominalBounds.max.x
    );
  }, 0));
}

function getMaximumTopOverhang(components, nominalBounds) {
  return round(components.reduce((maximum, component) => {
    if (!component?.bounds || !component.metadata?.allowDecorativeOverhang) return maximum;
    return Math.max(maximum, component.bounds.max.y - nominalBounds.max.y);
  }, 0));
}

function normalizeLowerStorage(value, layoutType, metadata) {
  if (value === "drawers" || value === "doors") return value;
  if (metadata?.lowerStorage === "drawers") return "drawers";
  return layoutType.includes("drawer") ? "drawers" : LAYOUT_DEFAULTS.lowerStorage;
}

function reconcileLayoutMetadata(value, sections, width, corrections, source = {}) {
  const metadata = cloneMetadata(value);
  const panel = CONSTRUCTION_RULES.panelThickness;
  const totalSectionClearWidth = width - panel * 2 - panel * (sections - 1);

  if (Array.isArray(metadata.sectionRatios)) {
    const validShape = metadata.sectionRatios.length === sections && metadata.sectionRatios.every(
      (ratio) => typeof ratio === "number" && Number.isFinite(ratio) && ratio > 0
    );
    const ratios = validShape ? metadata.sectionRatios.slice() : [];
    if (!validShape) {
      delete metadata.sectionRatios;
      corrections.push(createCorrection(
        "SECTION_RATIOS_INVALID",
        "layoutMetadata",
        value?.sectionRatios,
        {},
        "Section width ratios were ignored because they were not a complete positive ratio set for this section count."
      ));
    } else {
      metadata.sectionRatios = ratios;
    }
  }

  if (Array.isArray(metadata.sectionTypes)) {
    if (metadata.sectionTypes.length !== sections) {
      delete metadata.sectionTypes;
      corrections.push(createCorrection(
        "SECTION_TYPES_LENGTH_MISMATCH",
        "layoutMetadata.sectionTypes",
        value?.sectionTypes,
        null,
        "Section types were reconciled because their count did not match the generated sections."
      ));
    } else {
      metadata.sectionTypes = metadata.sectionTypes.map((type, index) => {
        const normalizedType = normalizeSectionTypeValue(type);
        if (normalizedType) {
          if (normalizedType !== type) {
            corrections.push(createCorrection(
              "SECTION_TYPE_NORMALIZED",
              `layoutMetadata.sectionTypes.${index}`,
              type,
              normalizedType,
              `Section ${index + 1} type was normalized to ${normalizedType}.`
            ));
          }
          return normalizedType;
        }
        const fallback = getImplicitSectionType(source, index, sections);
        corrections.push(createCorrection(
          "UNSUPPORTED_SECTION_TYPE",
          `layoutMetadata.sectionTypes.${index}`,
          type,
          fallback,
          `Section ${index + 1} used an unsupported type and was restored to ${fallback}.`
        ));
        return fallback;
      });
    }
  }
  if (Array.isArray(metadata.drawerSections)) {
    metadata.drawerSections = [...new Set(metadata.drawerSections.map(Number))]
      .filter((index) => Number.isInteger(index) && index >= 0 && index < sections);
  }
  if (Number.isFinite(Number(metadata.specialSpan))) {
    metadata.specialSpan = clamp(Math.round(Number(metadata.specialSpan)), 1, sections);
  }
  const effectiveTypes = Array.isArray(metadata.sectionTypes) && metadata.sectionTypes.length === sections
    ? metadata.sectionTypes
    : Array.from({ length: sections }, (_, index) => getImplicitSectionType(source, index, sections));
  const sourceDoorLayouts = Array.isArray(metadata.sectionDoorLayouts) ? metadata.sectionDoorLayouts : [];
  metadata.sectionDoorLayouts = effectiveTypes.map((type, index) => {
    if (!['lower_doors', 'tall_doors'].includes(type)) return null;
    const requested = sourceDoorLayouts[index]?.arrangement;
    const arrangement = DOOR_ARRANGEMENTS.includes(requested) ? requested : "auto";
    if (requested !== undefined && requested !== null && arrangement !== requested) {
      corrections.push(createCorrection(
        "UNSUPPORTED_DOOR_ARRANGEMENT",
        `layoutMetadata.sectionDoorLayouts.${index}.arrangement`,
        requested,
        arrangement,
        `Section ${index + 1} used an unsupported door arrangement and was restored to Auto.`
      ));
    }
    return { arrangement };
  });
  return metadata;
}

function getImplicitSectionType(source, index, sections) {
  const drawerSections = source?.layoutMetadata?.drawerSections;
  if (Array.isArray(drawerSections) && drawerSections.map(Number).includes(index)) return "drawers";
  if ((source?.tallDoors === true || source?.tallDoors === "true") && (index === 0 || index === sections - 1)) {
    return "tall_doors";
  }
  if (source?.lowerCabinets === false || source?.lowerCabinets === "false") return "open";
  return source?.lowerStorage === "drawers" ? "drawers" : "lower_doors";
}

function normalizeNumber(value, fallback, min, max, field, corrections) {
  const numeric = Number(value ?? fallback);
  const finite = Number.isFinite(numeric) ? numeric : fallback;
  const applied = clamp(finite, min, max);
  if (applied !== numeric) {
    corrections.push(createCorrection(
      "DIMENSION_CLAMPED",
      field,
      value,
      applied,
      field + " was clamped to the supported range " + min + "-" + max + " inches."
    ));
  }
  return round(applied);
}

function normalizeInteger(value, fallback, min, max, field, corrections) {
  const numeric = Number(value ?? fallback);
  const finite = Number.isFinite(numeric) ? numeric : fallback;
  const rounded = Math.round(finite);
  const applied = clamp(rounded, min, max);
  if (applied !== numeric) {
    corrections.push(createCorrection(
      "INTEGER_CLAMPED",
      field,
      value,
      applied,
      field + " was rounded or clamped to its supported range."
    ));
  }
  return applied;
}

function normalizeBoolean(value, fallback) {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return fallback;
}

function normalizeString(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function cloneMetadata(value) {
  if (!value || typeof value !== "object") return {};
  if (Array.isArray(value)) return value.map((item) => cloneMetadataValue(item));
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, cloneMetadataValue(item)])
  );
}

function cloneMetadataValue(value) {
  if (Array.isArray(value)) return value.map((item) => cloneMetadataValue(item));
  if (value && typeof value === "object") return cloneMetadata(value);
  return value;
}

function createCorrection(code, field, requested, applied, message) {
  return { code, field, requested: requested ?? null, applied, message };
}

function issue(code, severity, componentId, relatedId, message) {
  return { code, severity, componentId, relatedId, message };
}

function hasParentCycle(component, map) {
  const seen = new Set([component.id]);
  let current = component;
  while (current?.parentId) {
    if (seen.has(current.parentId)) return true;
    seen.add(current.parentId);
    current = map.get(current.parentId);
  }
  return false;
}

function vectorNearlyEqual(left, right) {
  return ["x", "y", "z"].every((axis) => nearlyEqual(left[axis], right[axis]));
}

function nearlyEqual(left, right, epsilon = EPSILON) {
  return Math.abs(left - right) <= epsilon;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1e6) / 1e6;
}

function pad(value) {
  return String(value).padStart(2, "0");
}
