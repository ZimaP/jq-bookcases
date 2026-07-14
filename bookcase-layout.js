import {
  getHardwareType,
  normalizeDrawerFrontStyleValue,
  normalizeSectionTypeValue
} from "./bookcase-config.js?v=configurator-refine-20260714a";

/**
 * Pure parametric layout engine for JQ Bookcases.
 *
 * All dimensions are inches. X is width (left to right), Y is height
 * (bottom to top), and Z is depth (front to back). The origin is the
 * bottom-center of the cabinet front plane. The carcass occupies Z >= 0;
 * doors and hardware intentionally project into Z < 0.
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
  minSectionClearWidth: 15,
  minShelfClearance: 4,
  maxUnsupportedShelfSpan: 36,
  lowerCabinetClearHeight: 30,
  minUpperClearHeight: 24,
  handleEdgeInset: 2,
  handleProjection: 1,
  lightThickness: 0.125,
  slimCapProfileDrop: 1.2,
  classicCrownProfileDrop: 2.3125,
  modernSoffitHeight: 3,
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
  baseStyle: "plinth"
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
  "door",
  "drawer_front"
]);
const VOLUME_ROLES = new Set(["assembly", "section", "section_group", "opening"]);
const FACE_CHILD_ROLES = new Set(["door", "drawer_front"]);
const ATTACHED_ROLES = new Set(["handle", "light"]);

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
      origin: rules.origin
    }
  });

  frame.base = add({
    id: "base",
    role: "base",
    parentId: root.id,
    hostId: root.id,
    bounds: bounds(
      -config.width / 2,
      config.width / 2,
      0,
      baseHeight,
      config.baseStyle === "toe_kick" ? 3 : 0,
      config.depth
    ),
    metadata: { style: config.baseStyle }
  });
  addBaseStyleDescriptors(add, config, root, frame.base, baseHeight);
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
  addCrownDescriptors(add, config, root, frame.top);

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
      shelves
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
    schemaVersion: 1,
    coordinateSystem: {
      units: rules.units,
      axes: rules.axes,
      origin: rules.origin,
      frontPlaneZ: 0,
      carcassDepthDirection: "positive-z"
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
      generatedDrawerCount
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
    shelves
  } = context;
  const index = section.metadata.index;
  const isSpecial = special.indices.includes(index);
  const sectionType = section.metadata.type;
  const isTall = sectionType === "tall_doors";
  const isDesk = sectionType === "desk";
  const usesLowerStorage = (sectionType === "lower_doors" || sectionType === "drawers") &&
    !isTall && !isDesk && !(isSpecial && special.kind === "feature");
  let shelfRegionBottom = section.bounds.min.y;

  if (isTall) {
    const opening = add({
      id: section.id + "-tall-opening",
      role: "opening",
      parentId: section.id,
      hostId: section.id,
      bounds: cloneBounds(section.bounds),
      metadata: { kind: "tall_storage" }
    });
    addSingleDoor(add, config, opening, {
      id: section.id + "-tall-door",
      openingSide: index < config.sections / 2 ? "right" : "left",
      tier: "primary",
      style: config.doorStyle
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
      metadata: { kind: sectionType === "drawers" ? "drawers" : "lower_cabinet" }
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
        0,
        clearDepth
      ),
      metadata: { fixed: true, purpose: "lower_separator" }
    });
    shelfRegionBottom = separator.bounds.max.y;

    if (sectionType === "drawers") {
      addDrawerStack(add, config, opening);
    } else {
      addDoubleDoors(add, config, opening, "primary");
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
    asymmetric: config.layoutType === "asymmetric"
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
        clearTop,
        0,
        clearDepth
      ),
      metadata: { kind: "upper_glass" }
    });
    addSingleDoor(add, config, opening, {
      id: section.id + "-upper-glass-door",
      openingSide: index % 2 === 0 ? "right" : "left",
      tier: "secondary",
      style: "glass"
    });
  }
}

function addDoubleDoors(add, config, opening, tier) {
  const reveal = CONSTRUCTION_RULES.doorReveal;
  const gap = CONSTRUCTION_RULES.doubleDoorCenterGap;
  const center = (opening.bounds.min.x + opening.bounds.max.x) / 2;
  const minY = opening.bounds.min.y + reveal;
  const maxY = opening.bounds.max.y - reveal;
  const left = add({
    id: opening.id + "-door-left",
    role: "door",
    parentId: opening.id,
    hostId: opening.id,
    bounds: bounds(
      opening.bounds.min.x + reveal,
      center - gap / 2,
      minY,
      maxY,
      -CONSTRUCTION_RULES.doorThickness,
      0
    ),
    metadata: {
      style: config.doorStyle,
      openingSide: "right",
      reveal,
      centerGap: gap,
      tier
    }
  });
  const right = add({
    id: opening.id + "-door-right",
    role: "door",
    parentId: opening.id,
    hostId: opening.id,
    bounds: bounds(
      center + gap / 2,
      opening.bounds.max.x - reveal,
      minY,
      maxY,
      -CONSTRUCTION_RULES.doorThickness,
      0
    ),
    metadata: {
      style: config.doorStyle,
      openingSide: "left",
      reveal,
      centerGap: gap,
      tier
    }
  });
  addHandle(add, config, left, "upper_corner");
  addHandle(add, config, right, "upper_corner");
}

function addSingleDoor(add, config, opening, options) {
  const reveal = CONSTRUCTION_RULES.doorReveal;
  const door = add({
    id: options.id,
    role: "door",
    parentId: opening.id,
    hostId: opening.id,
    bounds: bounds(
      opening.bounds.min.x + reveal,
      opening.bounds.max.x - reveal,
      opening.bounds.min.y + reveal,
      opening.bounds.max.y - reveal,
      -CONSTRUCTION_RULES.doorThickness,
      0
    ),
    metadata: {
      style: options.style,
      openingSide: options.openingSide,
      reveal,
      centerGap: null,
      tier: options.tier
    }
  });
  addHandle(add, config, door, options.tier === "secondary" ? "mid_edge" : "tall_edge");
}

function addDrawerStack(add, config, opening) {
  const reveal = CONSTRUCTION_RULES.doorReveal;
  const gap = CONSTRUCTION_RULES.drawerGap;
  const count = config.drawerCount;
  const available = opening.size.y - reveal * 2 - gap * (count - 1);
  const drawerHeight = available / count;
  for (let index = 0; index < count; index += 1) {
    const minY = opening.bounds.min.y + reveal + index * (drawerHeight + gap);
    const drawer = add({
      id: opening.id + "-drawer-" + pad(index + 1),
      role: "drawer_front",
      parentId: opening.id,
      hostId: opening.id,
      bounds: bounds(
        opening.bounds.min.x + reveal,
        opening.bounds.max.x - reveal,
        minY,
        minY + drawerHeight,
        -CONSTRUCTION_RULES.doorThickness,
        0
      ),
      metadata: {
        style: config.drawerFrontStyle,
        ordinal: index + 1,
        reveal,
        gap,
        tier: "primary"
      }
    });
    addHandle(add, config, drawer, "drawer_center");
  }
}

function addHandle(add, config, face, placement) {
  if (config.hardware === "push_latch") return null;
  const isPull = getHardwareType(config.hardware) === "pull";
  const faceWidth = face.size.x;
  const faceHeight = face.size.y;
  const openingSide = face.metadata.openingSide;
  let x = face.position.x;
  let y = face.position.y;
  let sizeX = isPull ? 0.5 : 0.875;
  let sizeY = isPull ? Math.min(5, Math.max(3, faceHeight * 0.22)) : 0.875;
  let orientation = "vertical";

  if (placement === "drawer_center") {
    sizeX = isPull ? Math.min(5, Math.max(3, faceWidth * 0.35)) : 0.875;
    sizeY = isPull ? 0.5 : 0.875;
    orientation = "horizontal";
  } else {
    const inset = Math.min(
      CONSTRUCTION_RULES.handleEdgeInset,
      Math.max(sizeX / 2 + 0.25, faceWidth * 0.22)
    );
    x = openingSide === "right"
      ? face.bounds.max.x - inset
      : face.bounds.min.x + inset;
    if (placement === "upper_corner") y = face.bounds.max.y - Math.max(3, sizeY / 2 + 1);
    if (placement === "tall_edge") y = clamp(42, face.bounds.min.y + sizeY / 2 + 1, face.bounds.max.y - sizeY / 2 - 1);
  }

  const halfX = sizeX / 2;
  const halfY = sizeY / 2;
  return add({
    id: face.id + "-handle",
    role: "handle",
    parentId: face.id,
    hostId: face.id,
    bounds: bounds(
      x - halfX,
      x + halfX,
      y - halfY,
      y + halfY,
      face.bounds.min.z - CONSTRUCTION_RULES.handleProjection,
      face.bounds.min.z
    ),
    metadata: {
      hardware: config.hardware,
      placement,
      orientation,
      attachment: {
        axis: "z",
        hostFace: "min",
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
      // Install top pucks in the front third of the cabinet. A centered puck
      // disappears behind deeper crown returns in three-quarter views, while
      // this position remains fully hosted by the top panel and visible below
      // every supported crown profile.
      const frontInset = Math.max(lightDepth / 2 + 0.25, Math.min(clearDepth * 0.2, 2.75));
      const lightCenterZ = section.bounds.min.z + frontInset;
      const crownLightMounts = {
        slim_cap: {
          hostId: "crown-slim-cap",
          topY: config.height - CONSTRUCTION_RULES.slimCapProfileDrop
        },
        classic_crown: {
          hostId: "crown-classic-cap",
          topY: config.height - CONSTRUCTION_RULES.classicCrownProfileDrop
        },
        modern_soffit: {
          hostId: "crown-modern-band",
          topY: config.height - CONSTRUCTION_RULES.modernSoffitHeight
        }
      };
      const crownMount = crownLightMounts[config.crownStyle];
      const lightHostId = crownMount?.hostId || frame.top.id;
      const lightTopY = crownMount
        ? Math.min(section.bounds.max.y, crownMount.topY)
        : section.bounds.max.y;
      add({
        id: section.id + "-light-puck",
        role: "light",
        parentId: section.id,
        hostId: lightHostId,
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
          maxX: section.bounds.min.x + 0.25,
          hostFace: "max",
          componentFace: "min"
        },
        {
          side: "right",
          hostId: section.metadata.rightBoundaryId,
          minX: section.bounds.max.x - 0.25,
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
    asymmetric
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
      rules.shelfFrontSetback,
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
          component.role === "door" ? "DOOR_OUTSIDE_OPENING" : "DRAWER_OUTSIDE_OPENING",
          "error",
          component.id,
          host.id,
          "Face must remain inside its opening in X and Y."
        ));
      }
      if (!nearlyEqual(component.bounds.max.z, host.bounds.min.z)) {
        issues.push(issue(
          "FACE_ATTACHMENT_MISMATCH",
          "error",
          component.id,
          host.id,
          "Door or drawer rear face must attach to the opening front plane."
        ));
      }
      if (!nearlyEqual(component.metadata?.reveal, CONSTRUCTION_RULES.doorReveal)) {
        issues.push(issue(
          "INCONSISTENT_REVEAL",
          "error",
          component.id,
          host.id,
          "Door and drawer reveals must use the centralized reveal rule."
        ));
      }
    }

    if (component.role === "handle" && host) {
      if (!containsOnAxes(host.bounds, component.bounds, ["x", "y"])) {
        issues.push(issue(
          "HANDLE_OUTSIDE_FACE",
          "error",
          component.id,
          host.id,
          "Handle must remain within its door or drawer face."
        ));
      }
      validateAttachment(component, host, issues);
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
  if (style === "toe_kick") return 3.5;
  if (style === "furniture_base") return 4.5;
  return 4;
}

function addBaseStyleDescriptors(add, config, root, base, baseHeight) {
  if (config.baseStyle === "toe_kick") {
    add({
      id: "base-toe-shadow",
      role: "trim",
      parentId: root.id,
      hostId: base.id,
      bounds: bounds(
        -config.width / 2 + 2,
        config.width / 2 - 2,
        0,
        baseHeight,
        0,
        3
      ),
      metadata: { style: "toe_kick", purpose: "recess", allowOverhang: false }
    });
    return;
  }

  if (config.baseStyle === "furniture_base") {
    const footWidth = Math.min(3, config.width * 0.08);
    const footHeight = Math.min(2, baseHeight * 0.45);
    ["left", "right"].forEach((side) => {
      const centerX = side === "left"
        ? -config.width / 2 + 3
        : config.width / 2 - 3;
      add({
        id: "base-foot-" + side,
        role: "trim",
        parentId: root.id,
        hostId: base.id,
        bounds: bounds(
          centerX - footWidth / 2,
          centerX + footWidth / 2,
          0,
          footHeight,
          0,
          config.depth
        ),
        metadata: { style: "furniture_base", purpose: "foot", side, allowOverhang: false }
      });
    });
    add({
      id: "base-furniture-rail",
      role: "trim",
      parentId: root.id,
      hostId: base.id,
      bounds: bounds(
        -config.width / 2 + 1,
        config.width / 2 - 1,
        footHeight,
        baseHeight,
        0,
        config.depth
      ),
      metadata: { style: "furniture_base", purpose: "rail", allowOverhang: false }
    });
    return;
  }

  add({
    id: "base-plinth-cap",
    role: "trim",
    parentId: root.id,
    hostId: base.id,
    bounds: bounds(
      -config.width / 2 - 0.25,
      config.width / 2 + 0.25,
      baseHeight - 0.75,
      baseHeight,
      -0.25,
      config.depth + 0.125
    ),
    metadata: { style: "plinth", purpose: "cap", allowOverhang: true }
  });
}

function addCrownDescriptors(add, config, root, topPanel) {
  if (config.crownStyle === "none") return;
  const definitions = [];
  if (config.crownStyle === "slim_cap") {
    definitions.push({
      id: "crown-slim-cap",
      minX: -config.width / 2 - 0.25,
      maxX: config.width / 2 + 0.25,
      minY: config.height - CONSTRUCTION_RULES.slimCapProfileDrop,
      maxY: config.height,
      minZ: -0.375,
      maxZ: config.depth + 0.125,
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
      maxZ: config.depth + 0.125,
      purpose: "modern_soffit"
    });
  } else {
    definitions.push(
      {
        id: "crown-classic-rail",
        minX: -config.width / 2 - 0.125,
        maxX: config.width / 2 + 0.125,
        minY: config.height - 0.75,
        maxY: config.height - 0.375,
        minZ: -0.25,
        maxZ: config.depth + 0.125,
        purpose: "classic_rail"
      },
      {
        id: "crown-classic-cap",
        minX: -config.width / 2 - 0.5,
        maxX: config.width / 2 + 0.5,
        minY: config.height - CONSTRUCTION_RULES.classicCrownProfileDrop,
        maxY: config.height,
        minZ: -0.625,
        maxZ: config.depth + 0.25,
        purpose: "classic_cap"
      }
    );
  }

  definitions.forEach((definition) => {
    add({
      id: definition.id,
      role: "crown",
      parentId: root.id,
      hostId: topPanel.id,
      bounds: bounds(
        definition.minX,
        definition.maxX,
        definition.minY,
        definition.maxY,
        definition.minZ,
        definition.maxZ
      ),
      metadata: {
        style: config.crownStyle,
        purpose: definition.purpose,
        allowOverhang: true
      }
    });
  });
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
