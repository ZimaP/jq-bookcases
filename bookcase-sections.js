import {
  DOOR_ARRANGEMENTS,
  EDITABLE_SECTION_TYPES,
  LOCKED_SECTION_TYPES,
  layoutPresets,
  normalizeBookcaseConfig,
  normalizeSectionTypeValue
} from "./bookcase-config.js?v=configurator-refine-20260714a";
import {
  CONSTRUCTION_RULES,
  resolveDoorArrangement
} from "./bookcase-layout.js?v=configurator-refine-20260714a";

const PRECISION = 1e6;
const RATIO_PRECISION = 1e12;
const EPSILON = 1e-6;
const SECTION_HISTORY_FIELDS = Object.freeze([
  "layoutPreset",
  "layoutType",
  "sections",
  "lowerCabinets",
  "lowerStorage",
  "centerOpening",
  "deskOpening",
  "featureOpening",
  "tallDoors",
  "layoutMetadata"
]);

export function getSectionDesignerState(config, layout) {
  const state = normalizeBookcaseConfig(config);
  const widths = getAcceptedWidths(state, layout);
  const sectionDescriptors = (layout?.components || [])
    .filter((component) => component.role === "section")
    .sort((left, right) => Number(left.metadata?.index) - Number(right.metadata?.index));
  const types = resolveSectionTypes(state, sectionDescriptors);
  const doorLayouts = resolveSectionDoorLayouts(state, types);
  const warningsBySection = new Map();
  for (const warning of layout?.validation?.warnings || []) {
    if (!warning.componentId) continue;
    const component = (layout.components || []).find((item) => item.id === warning.componentId);
    const sectionId = component?.role === "section" ? component.id : component?.parentId;
    if (!sectionId) continue;
    const existing = warningsBySection.get(sectionId) || [];
    existing.push(warning);
    warningsBySection.set(sectionId, existing);
  }

  return {
    widths,
    ratios: sectionWidthsToRatios(widths),
    totalClearWidth: round(widths.reduce((total, width) => total + width, 0)),
    panelThickness: Number(layout?.rules?.panelThickness) || CONSTRUCTION_RULES.panelThickness,
    minimumClearWidth: Number(layout?.rules?.minSectionClearWidth) || CONSTRUCTION_RULES.minSectionClearWidth,
    sections: widths.map((width, index) => {
      const descriptor = sectionDescriptors[index];
      const type = types[index];
      return {
        id: descriptor?.id || `section-${String(index + 1).padStart(2, "0")}`,
        index,
        width,
        type,
        doorLayout: cloneDoorLayout(doorLayouts[index]),
        locked: LOCKED_SECTION_TYPES.includes(type),
        editable: EDITABLE_SECTION_TYPES.includes(type),
        bounds: descriptor?.bounds ? structuredClone(descriptor.bounds) : null,
        warnings: warningsBySection.get(descriptor?.id) || []
      };
    })
  };
}

export function sectionWidthsToRatios(widths) {
  const normalized = normalizeWidths(widths);
  const total = normalized.reduce((sum, width) => sum + width, 0);
  let allocated = 0;
  return normalized.map((width, index) => {
    if (index === normalized.length - 1) return roundRatio(1 - allocated);
    const ratio = roundRatio(width / total);
    allocated = roundRatio(allocated + ratio);
    return ratio;
  });
}

export function resizeAdjacentSections(widths, dividerIndex, delta, rules = CONSTRUCTION_RULES) {
  const next = normalizeWidths(widths);
  const index = Number(dividerIndex);
  const change = Number(delta);
  if (!Number.isInteger(index) || index < 0 || index >= next.length - 1 || !Number.isFinite(change)) {
    return rejected("INVALID_DIVIDER", "Choose a divider between two sections.", widths);
  }
  const minimum = getMinimum(rules);
  const pairTotal = round(next[index] + next[index + 1]);
  const minimumDelta = round(minimum - next[index]);
  const maximumDelta = round(next[index + 1] - minimum);
  if (minimumDelta > maximumDelta + EPSILON) {
    return rejected(
      "MIN_SECTION_CLEAR_WIDTH",
      `The adjacent pair cannot provide two ${formatWidth(minimum)} in clear sections.`,
      widths
    );
  }
  const appliedDelta = round(Math.min(maximumDelta, Math.max(minimumDelta, change)));
  const left = round(next[index] + appliedDelta);
  const right = round(pairTotal - left);
  next[index] = left;
  next[index + 1] = right;
  return {
    ...acceptedWidths(next, [index, index + 1]),
    requestedDelta: round(change),
    appliedDelta,
    clamped: Math.abs(appliedDelta - change) > EPSILON
  };
}

export function setSectionClearWidth(widths, sectionIndex, targetWidth, rules = CONSTRUCTION_RULES) {
  const next = normalizeWidths(widths);
  const index = Number(sectionIndex);
  const target = round(Number(targetWidth));
  if (!Number.isInteger(index) || index < 0 || index >= next.length || !Number.isFinite(target)) {
    return rejected("INVALID_SECTION_WIDTH", "Enter a valid clear section width.", widths);
  }
  if (next.length === 1) {
    return rejected("NO_ADJACENT_SECTION", "A single section cannot change width without changing the overall width.", widths);
  }
  const dividerIndex = index === next.length - 1 ? index - 1 : index;
  const selectedDelta = round(target - next[index]);
  const dividerDelta = index === next.length - 1 ? -selectedDelta : selectedDelta;
  return resizeAdjacentSections(next, dividerIndex, dividerDelta, rules);
}

export function splitSection(config, layout, sectionIndex, rules = CONSTRUCTION_RULES) {
  const designer = getSectionDesignerState(config, layout);
  const index = Number(sectionIndex);
  const section = designer.sections[index];
  if (!section) return rejectedConfig("INVALID_SECTION", "Choose a section to split.", config);
  if (section.locked) return rejectedConfig("LOCKED_SECTION", "Preset feature sections cannot be split.", config);
  if (designer.sections.length >= Number(rules?.maxSections || CONSTRUCTION_RULES.maxSections)) {
    return rejectedConfig(
      "MAX_SECTION_COUNT",
      `A bookcase can contain at most ${Number(rules?.maxSections || CONSTRUCTION_RULES.maxSections)} sections.`,
      config
    );
  }
  const panel = getPanel(rules);
  const minimum = getMinimum(rules);
  const available = round(section.width - panel);
  const left = round(available / 2);
  const right = round(available - left);
  if (left + EPSILON < minimum || right + EPSILON < minimum) {
    return rejectedConfig(
      "SECTION_TOO_NARROW_TO_SPLIT",
      `Splitting requires room for two ${formatWidth(minimum)} in clear sections plus the divider.`,
      config
    );
  }
  const widths = designer.widths.slice();
  widths.splice(index, 1, left, right);
  const types = designer.sections.map((item) => item.type);
  types.splice(index, 1, section.type, section.type);
  const doorLayouts = designer.sections.map((item) => cloneDoorLayout(item.doorLayout));
  const splitDoorLayout = isDoorSectionType(section.type) ? { arrangement: "auto" } : null;
  doorLayouts.splice(index, 1, cloneDoorLayout(splitDoorLayout), cloneDoorLayout(splitDoorLayout));
  return acceptedConfig(
    applyCustomization(config, widths, types, doorLayouts),
    widths,
    [index, index + 1]
  );
}

/**
 * Apply the global lower-storage controls to an explicit per-section design.
 *
 * Once Section Designer has written layoutMetadata.sectionTypes those types are
 * the physical source of truth. Global Storage controls therefore need to
 * update the matching explicit types instead of writing legacy summary fields
 * that layout normalization would immediately overwrite.
 */
export function applyGlobalStorageSelection(config, layout, selection = {}) {
  const state = normalizeBookcaseConfig(config);
  const designer = getSectionDesignerState(state, layout);
  const hasCabinetSelection = Object.prototype.hasOwnProperty.call(selection, "lowerCabinets");
  const hasStorageSelection = Object.prototype.hasOwnProperty.call(selection, "lowerStorage");
  const lowerCabinets = hasCabinetSelection
    ? selection.lowerCabinets !== false && selection.lowerCabinets !== "false"
    : state.lowerCabinets;
  const lowerStorage = hasStorageSelection
    ? selection.lowerStorage === "drawers" ? "drawers" : "doors"
    : state.lowerStorage;
  const targetType = lowerStorage === "drawers" ? "drawers" : "lower_doors";
  const hadCompleteExplicitTypes = Array.isArray(state.layoutMetadata?.sectionTypes)
    && state.layoutMetadata.sectionTypes.length === state.sections;

  if (!hadCompleteExplicitTypes) {
    return acceptedConfig(
      normalizeBookcaseConfig({ ...state, lowerCabinets, lowerStorage }),
      designer.widths,
      []
    );
  }

  const previousTypes = designer.sections.map((section) => section.type);
  const nextTypes = previousTypes.map((type) => {
    if (!lowerCabinets) {
      return type === "lower_doors" || type === "drawers" ? "open" : type;
    }
    if (hasCabinetSelection && !state.lowerCabinets && type === "open") return targetType;
    if (hasStorageSelection && (type === "lower_doors" || type === "drawers")) return targetType;
    return type;
  });
  const affectedSections = nextTypes.flatMap((type, index) => type === previousTypes[index] ? [] : [index]);

  return acceptedConfig(
    normalizeBookcaseConfig({
      ...state,
      lowerCabinets,
      lowerStorage,
      layoutMetadata: {
        ...state.layoutMetadata,
        sectionTypes: nextTypes
      }
    }),
    designer.widths,
    affectedSections
  );
}

export function mergeSection(config, layout, sectionIndex, direction = "right", rules = CONSTRUCTION_RULES) {
  const designer = getSectionDesignerState(config, layout);
  const index = Number(sectionIndex);
  const neighbor = direction === "left" ? index - 1 : index + 1;
  const selected = designer.sections[index];
  const adjacent = designer.sections[neighbor];
  if (!selected || !adjacent) {
    return rejectedConfig("NO_MERGE_NEIGHBOR", "Choose a section with an adjacent section to merge.", config);
  }
  if (selected.locked || adjacent.locked) {
    return rejectedConfig("LOCKED_SECTION", "Preset feature sections cannot be merged.", config);
  }
  const first = Math.min(index, neighbor);
  const second = Math.max(index, neighbor);
  const widths = designer.widths.slice();
  const merged = round(widths[first] + widths[second] + getPanel(rules));
  widths.splice(first, 2, merged);
  const types = designer.sections.map((item) => item.type);
  types.splice(first, 2, selected.type);
  const doorLayouts = designer.sections.map((item) => cloneDoorLayout(item.doorLayout));
  doorLayouts.splice(first, 2, isDoorSectionType(selected.type) ? { arrangement: "auto" } : null);
  return acceptedConfig(applyCustomization(config, widths, types, doorLayouts), widths, [first]);
}

export function equalizeSectionWidths(config, layout, rules = CONSTRUCTION_RULES) {
  const designer = getSectionDesignerState(config, layout);
  const count = designer.sections.length;
  if (!count) return rejectedConfig("NO_SECTIONS", "No sections are available to equalize.", config);
  const equal = round(designer.totalClearWidth / count);
  if (equal + EPSILON < getMinimum(rules)) {
    return rejectedConfig("MIN_SECTION_CLEAR_WIDTH", "Equal widths would make the sections too narrow.", config);
  }
  let allocated = 0;
  const widths = Array.from({ length: count }, (_, index) => {
    if (index === count - 1) return round(designer.totalClearWidth - allocated);
    allocated = round(allocated + equal);
    return equal;
  });
  return acceptedConfig(
    applyCustomization(
      config,
      widths,
      designer.sections.map((section) => section.type),
      designer.sections.map((section) => cloneDoorLayout(section.doorLayout))
    ),
    widths,
    designer.sections.map((section) => section.index)
  );
}

export function setSectionType(config, sectionIndex, type, layout = null) {
  const normalizedType = normalizeSectionTypeValue(type);
  if (!normalizedType || !EDITABLE_SECTION_TYPES.includes(normalizedType)) {
    return rejectedConfig("UNSUPPORTED_SECTION_TYPE", "Choose Open Shelves, Lower Doors, Lower Drawers, or Tall Door.", config);
  }
  const designer = getSectionDesignerState(config, layout);
  const index = Number(sectionIndex);
  const section = designer.sections[index];
  if (!section) return rejectedConfig("INVALID_SECTION", "Choose a section to change.", config);
  if (section.locked) return rejectedConfig("LOCKED_SECTION", "Preset feature sections keep their generated type.", config);
  const types = designer.sections.map((item) => item.type);
  const doorLayouts = designer.sections.map((item) => cloneDoorLayout(item.doorLayout));
  types[index] = normalizedType;
  doorLayouts[index] = isDoorSectionType(normalizedType)
    ? isDoorSectionType(section.type) && doorLayouts[index]
      ? doorLayouts[index]
      : { arrangement: "auto" }
    : null;
  return acceptedConfig(
    applyCustomization(config, designer.widths, types, doorLayouts),
    designer.widths,
    [index]
  );
}

export function setSectionDoorArrangement(config, sectionIndex, arrangement, layout = null) {
  if (!DOOR_ARRANGEMENTS.includes(arrangement)) {
    return rejectedConfig("UNSUPPORTED_DOOR_ARRANGEMENT", "Choose Auto, a supported single hinge side, or Pair.", config);
  }
  const designer = getSectionDesignerState(config, layout);
  const index = Number(sectionIndex);
  const section = designer.sections[index];
  if (!section) return rejectedConfig("INVALID_SECTION", "Choose a section to change.", config);
  if (!isDoorSectionType(section.type)) {
    return rejectedConfig("SECTION_HAS_NO_HINGED_DOOR", "This section type does not use hinged doors.", config);
  }
  if (section.locked) return rejectedConfig("LOCKED_SECTION", "Preset feature sections keep their generated fronts.", config);
  const state = normalizeBookcaseConfig(config);
  const resolution = resolveDoorArrangement({
    opening: { size: { x: section.width } },
    requested: arrangement,
    constructionProfile: state.constructionProfile,
    openingKind: section.type === "tall_doors" ? "tall_storage" : "lower_cabinet",
    sectionIndex: index,
    sectionCount: designer.sections.length
  });
  if (!resolution.valid) {
    return rejectedConfig(
      resolution.leafWidth > CONSTRUCTION_RULES.maxSingleDoorLeafWidth
        ? "DOOR_LEAF_TOO_WIDE"
        : "DOOR_LEAF_TOO_NARROW",
      resolution.reason || "That arrangement is not buildable for this opening.",
      config
    );
  }
  const doorLayouts = designer.sections.map((item) => cloneDoorLayout(item.doorLayout));
  doorLayouts[index] = { arrangement };
  return acceptedConfig(
    applyCustomization(
      state,
      designer.widths,
      designer.sections.map((item) => item.type),
      doorLayouts
    ),
    designer.widths,
    [index]
  );
}

export function applySectionWidths(config, layout, widths) {
  const designer = getSectionDesignerState(config, layout);
  let normalizedWidths;
  try {
    normalizedWidths = normalizeWidths(widths);
  } catch (error) {
    return rejectedConfig("INVALID_SECTION_WIDTHS", error.message, config);
  }
  if (normalizedWidths.length !== designer.sections.length) {
    return rejectedConfig("SECTION_WIDTH_COUNT_MISMATCH", "Every section requires one clear width.", config);
  }
  const minimum = designer.minimumClearWidth;
  if (normalizedWidths.some((width) => width + EPSILON < minimum)) {
    return rejectedConfig("MIN_SECTION_CLEAR_WIDTH", `Every section must remain at least ${formatWidth(minimum)} in clear.`, config);
  }
  const currentTotal = round(designer.widths.reduce((sum, width) => sum + width, 0));
  const nextTotal = round(normalizedWidths.reduce((sum, width) => sum + width, 0));
  if (Math.abs(currentTotal - nextTotal) > EPSILON) {
    return rejectedConfig("SECTION_WIDTH_SUM_MISMATCH", "Section clear widths must preserve the accepted total clear width.", config);
  }
  return acceptedConfig(
    applyCustomization(
      config,
      normalizedWidths,
      designer.sections.map((section) => section.type),
      designer.sections.map((section) => cloneDoorLayout(section.doorLayout))
    ),
    normalizedWidths,
    normalizedWidths.map((_, index) => index)
  );
}

export function reconcileSectionCustomization(previousConfig, nextSectionCount, rules = CONSTRUCTION_RULES) {
  const state = normalizeBookcaseConfig(previousConfig);
  const targetCount = Math.max(1, Math.min(6, Math.round(Number(nextSectionCount))));
  if (!Number.isFinite(targetCount)) return rejectedConfig("INVALID_SECTION_COUNT", "Choose a valid section count.", previousConfig);
  const widths = getAcceptedWidths(state, null);
  const types = resolveSectionTypes(state, []);
  const doorLayouts = resolveSectionDoorLayouts(state, types);
  const panel = getPanel(rules);
  const minimum = getMinimum(rules);
  const hasGeneratedFeatureZone = state.centerOpening || state.deskOpening || state.featureOpening;
  if ((hasGeneratedFeatureZone || types.some((type) => LOCKED_SECTION_TYPES.includes(type))) && targetCount !== widths.length) {
    return rejectedConfig("LOCKED_SECTION", "Change to a non-feature layout before changing its generated section count.", previousConfig);
  }
  const targetTotal = round(state.width - panel * 2 - panel * (targetCount - 1));
  if (targetTotal / targetCount + EPSILON < minimum) {
    return rejectedConfig("MIN_SECTION_CLEAR_WIDTH", "That section count cannot fit at the selected overall width.", previousConfig);
  }

  while (widths.length < targetCount) {
    const splitIndex = widths.reduce((best, width, index) => width > widths[best] ? index : best, 0);
    const left = round(widths[splitIndex] / 2);
    const right = round(widths[splitIndex] - left);
    widths.splice(splitIndex, 1, left, right);
    types.splice(splitIndex, 1, types[splitIndex], types[splitIndex]);
    const splitDoorLayout = isDoorSectionType(types[splitIndex]) ? { arrangement: "auto" } : null;
    doorLayouts.splice(
      splitIndex,
      1,
      cloneDoorLayout(splitDoorLayout),
      cloneDoorLayout(splitDoorLayout)
    );
  }

  while (widths.length > targetCount) {
    let mergeIndex = -1;
    for (let index = widths.length - 2; index >= 0; index -= 1) {
      if (!LOCKED_SECTION_TYPES.includes(types[index]) && !LOCKED_SECTION_TYPES.includes(types[index + 1])) {
        mergeIndex = index;
        break;
      }
    }
    if (mergeIndex < 0) {
      return rejectedConfig("LOCKED_SECTION", "The preset feature zone prevents that section count.", previousConfig);
    }
    widths.splice(mergeIndex, 2, round(widths[mergeIndex] + widths[mergeIndex + 1]));
    types.splice(mergeIndex, 2, types[mergeIndex]);
    doorLayouts.splice(
      mergeIndex,
      2,
      isDoorSectionType(types[mergeIndex]) ? { arrangement: "auto" } : null
    );
  }

  // A section-count selection is a global layout transition. It intentionally
  // starts the selected count from equal clear widths; local split/merge and
  // divider operations remain the tools for preserving or creating asymmetry.
  const reconciledWidths = allocateWidths(targetTotal, Array.from({ length: targetCount }, () => 1));

  return acceptedConfig(
    applyCustomization(previousConfig, reconciledWidths, types, doorLayouts),
    reconciledWidths,
    reconciledWidths.map((_, index) => index)
  );
}

export function resetSectionCustomization(config, presetId) {
  const preset = layoutPresets.find((item) => item.id === presetId);
  if (!preset) return rejectedConfig("UNKNOWN_PRESET", "The original preset could not be found.", config);
  const current = normalizeBookcaseConfig(config);
  const reset = normalizeBookcaseConfig({
    ...current,
    sections: preset.config.sections,
    lowerCabinets: preset.config.lowerCabinets,
    lowerStorage: preset.config.lowerStorage,
    tallDoors: preset.config.tallDoors,
    centerOpening: preset.config.centerOpening,
    deskOpening: preset.config.deskOpening,
    featureOpening: preset.config.featureOpening,
    layoutType: preset.config.layoutType,
    layoutPreset: preset.id,
    layoutMetadata: structuredClone(preset.config.layoutMetadata)
  });
  return { accepted: true, config: reset, widths: [], affectedSections: [] };
}

/**
 * Capture only state owned by Section Designer operations. Keeping dimensions,
 * finish, lighting, and fulfillment choices outside this snapshot prevents a
 * later section undo from rolling back unrelated customer decisions.
 */
export function createSectionHistorySnapshot(config) {
  const state = normalizeBookcaseConfig(config);
  return SECTION_HISTORY_FIELDS.reduce((snapshot, field) => {
    snapshot[field] = cloneHistoryValue(state[field]);
    return snapshot;
  }, {});
}

/** Merge a Section Designer snapshot into the customer's current selections. */
export function applySectionHistorySnapshot(config, snapshot) {
  const current = normalizeBookcaseConfig(config);
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return current;
  const next = { ...current };
  for (const field of SECTION_HISTORY_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(snapshot, field)) {
      next[field] = cloneHistoryValue(snapshot[field]);
    }
  }
  return normalizeBookcaseConfig(next);
}

function getAcceptedWidths(config, layout) {
  const metrics = layout?.metrics?.sectionClearWidths;
  if (Array.isArray(metrics) && metrics.length === config.sections && metrics.every(isPositiveFinite)) {
    return metrics.map(round);
  }
  const total = round(
    config.width - CONSTRUCTION_RULES.panelThickness * 2 -
    CONSTRUCTION_RULES.panelThickness * (config.sections - 1)
  );
  const ratios = Array.isArray(config.layoutMetadata?.sectionRatios) &&
    config.layoutMetadata.sectionRatios.length === config.sections
    ? config.layoutMetadata.sectionRatios
    : Array.from({ length: config.sections }, () => 1);
  return allocateWidths(total, ratios);
}

function resolveSectionTypes(config, descriptors) {
  if (descriptors.length === config.sections) {
    return descriptors.map((descriptor) => normalizeSectionTypeValue(descriptor.metadata?.type) || "open");
  }
  const explicit = config.layoutMetadata?.sectionTypes;
  if (Array.isArray(explicit) && explicit.length === config.sections) {
    return explicit.map((type) => normalizeSectionTypeValue(type) || "open");
  }
  const drawers = new Set(config.layoutMetadata?.drawerSections || []);
  return Array.from({ length: config.sections }, (_, index) => {
    if (drawers.has(index)) return "drawers";
    if (config.tallDoors && (index === 0 || index === config.sections - 1)) return "tall_doors";
    if (!config.lowerCabinets) return "open";
    return config.lowerStorage === "drawers" ? "drawers" : "lower_doors";
  });
}

function resolveSectionDoorLayouts(config, types) {
  const requested = Array.isArray(config.layoutMetadata?.sectionDoorLayouts)
    ? config.layoutMetadata.sectionDoorLayouts
    : [];
  return types.map((type, index) => {
    if (!isDoorSectionType(type)) return null;
    const arrangement = requested[index]?.arrangement;
    return {
      arrangement: DOOR_ARRANGEMENTS.includes(arrangement)
        ? arrangement
        : "auto"
    };
  });
}

function applyCustomization(config, widths, types, doorLayouts = null) {
  const state = normalizeBookcaseConfig(config);
  const lowerStorageTypes = types.filter((type) => type === "lower_doors" || type === "drawers");
  const alignedDoorLayouts = Array.isArray(doorLayouts) && doorLayouts.length === types.length
    ? doorLayouts.map((layout, index) => isDoorSectionType(types[index]) ? cloneDoorLayout(layout) : null)
    : resolveSectionDoorLayouts(state, types);
  return normalizeBookcaseConfig({
    ...state,
    layoutPreset: "custom",
    sections: widths.length,
    lowerCabinets: lowerStorageTypes.length > 0,
    lowerStorage: lowerStorageTypes.length > 0 && lowerStorageTypes.every((type) => type === "drawers")
      ? "drawers"
      : "doors",
    tallDoors: types.some((type) => type === "tall_doors"),
    layoutMetadata: {
      ...state.layoutMetadata,
      sectionRatios: sectionWidthsToRatios(widths),
      sectionTypes: types.slice(),
      sectionDoorLayouts: alignedDoorLayouts,
      drawerSections: undefined
    }
  });
}

function isDoorSectionType(type) {
  return type === "lower_doors" || type === "tall_doors";
}

function cloneDoorLayout(value) {
  return value && typeof value === "object" ? { arrangement: value.arrangement } : null;
}

function cloneHistoryValue(value) {
  return value && typeof value === "object" ? structuredClone(value) : value;
}

function allocateWidths(totalWidth, ratios) {
  const ratioTotal = ratios.reduce((sum, ratio) => sum + Number(ratio), 0);
  let allocated = 0;
  return ratios.map((ratio, index) => {
    if (index === ratios.length - 1) return round(totalWidth - allocated);
    const width = round(totalWidth * Number(ratio) / ratioTotal);
    allocated = round(allocated + width);
    return width;
  });
}

function acceptedWidths(widths, affectedSections) {
  return {
    accepted: true,
    widths,
    ratios: sectionWidthsToRatios(widths),
    affectedSections: [...new Set(affectedSections)].sort((a, b) => a - b),
    error: null
  };
}

function acceptedConfig(config, widths, affectedSections) {
  return { ...acceptedWidths(widths, affectedSections), config };
}

function rejected(code, message, widths) {
  return {
    accepted: false,
    widths: Array.isArray(widths) ? widths.slice() : [],
    ratios: [],
    affectedSections: [],
    error: { code, severity: "error", message }
  };
}

function rejectedConfig(code, message, config) {
  return { ...rejected(code, message, []), config: normalizeBookcaseConfig(config) };
}

function normalizeWidths(widths) {
  if (!Array.isArray(widths) || !widths.length || !widths.every(isPositiveFinite)) {
    throw new TypeError("Section widths must be a non-empty array of positive finite numbers.");
  }
  return widths.map(round);
}

function isPositiveFinite(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function getMinimum(rules) {
  return Number(rules?.minSectionClearWidth) || CONSTRUCTION_RULES.minSectionClearWidth;
}

function getPanel(rules) {
  return Number(rules?.panelThickness) || CONSTRUCTION_RULES.panelThickness;
}

function round(value) {
  return Math.round((Number(value) + Number.EPSILON) * PRECISION) / PRECISION;
}

function roundRatio(value) {
  return Math.round((Number(value) + Number.EPSILON) * RATIO_PRECISION) / RATIO_PRECISION;
}

function formatWidth(value) {
  return Number(value.toFixed(3)).toString();
}
