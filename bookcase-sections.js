import {
  EDITABLE_SECTION_TYPES,
  LOCKED_SECTION_TYPES,
  layoutPresets,
  normalizeBookcaseConfig,
  normalizeSectionTypeValue
} from "./bookcase-config.js?v=full-system-20260714a";
import { CONSTRUCTION_RULES } from "./bookcase-layout.js?v=full-system-20260714a";

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
  const left = round(next[index] + change);
  const right = round(next[index + 1] - change);
  if (left + EPSILON < minimum || right + EPSILON < minimum) {
    return rejected(
      "MIN_SECTION_CLEAR_WIDTH",
      `Both adjacent sections must remain at least ${formatWidth(minimum)} in clear.`,
      widths
    );
  }
  next[index] = left;
  next[index + 1] = right;
  return acceptedWidths(next, [index, index + 1]);
}

export function setSectionClearWidth(widths, sectionIndex, targetWidth, rules = CONSTRUCTION_RULES) {
  const next = normalizeWidths(widths);
  const index = Number(sectionIndex);
  const target = round(Number(targetWidth));
  const minimum = getMinimum(rules);
  if (!Number.isInteger(index) || index < 0 || index >= next.length || !Number.isFinite(target)) {
    return rejected("INVALID_SECTION_WIDTH", "Enter a valid clear section width.", widths);
  }
  if (target + EPSILON < minimum) {
    return rejected(
      "MIN_SECTION_CLEAR_WIDTH",
      `Section ${index + 1} must remain at least ${formatWidth(minimum)} in clear.`,
      widths
    );
  }

  const delta = round(target - next[index]);
  if (Math.abs(delta) <= EPSILON) return acceptedWidths(next, [index]);
  const direction = index === next.length - 1 ? -1 : 1;
  const neighbors = [];
  for (let cursor = index + direction; cursor >= 0 && cursor < next.length; cursor += direction) {
    neighbors.push(cursor);
  }
  if (!neighbors.length) {
    return rejected("NO_ADJACENT_SECTION", "A single section cannot change width without changing the overall width.", widths);
  }

  if (delta < 0) {
    next[index] = target;
    next[neighbors[0]] = round(next[neighbors[0]] - delta);
    return acceptedWidths(next, [index, neighbors[0]]);
  }

  const available = round(neighbors.reduce((sum, neighbor) => sum + Math.max(0, next[neighbor] - minimum), 0));
  if (available + EPSILON < delta) {
    return rejected(
      "INSUFFICIENT_NEIGHBOR_SLACK",
      `The neighboring sections can provide only ${formatWidth(available)} in while staying buildable.`,
      widths
    );
  }

  let remaining = delta;
  const affected = [index];
  next[index] = target;
  for (const neighbor of neighbors) {
    if (remaining <= EPSILON) break;
    const contribution = Math.min(remaining, Math.max(0, next[neighbor] - minimum));
    if (contribution <= 0) continue;
    next[neighbor] = round(next[neighbor] - contribution);
    remaining = round(remaining - contribution);
    affected.push(neighbor);
  }
  return acceptedWidths(next, affected);
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
  return acceptedConfig(applyCustomization(config, widths, types), widths, [index, index + 1]);
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
  return acceptedConfig(applyCustomization(config, widths, types), widths, [first]);
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
    applyCustomization(config, widths, designer.sections.map((section) => section.type)),
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
  types[index] = normalizedType;
  return acceptedConfig(applyCustomization(config, designer.widths, types), designer.widths, [index]);
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
    applyCustomization(config, normalizedWidths, designer.sections.map((section) => section.type)),
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
  }

  let reconciledWidths = allocateWidths(targetTotal, widths);
  if (reconciledWidths.some((width) => width + EPSILON < minimum)) {
    reconciledWidths = allocateWidths(targetTotal, Array.from({ length: targetCount }, () => 1));
  }

  return acceptedConfig(
    applyCustomization(previousConfig, reconciledWidths, types),
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

function applyCustomization(config, widths, types) {
  const state = normalizeBookcaseConfig(config);
  const lowerStorageTypes = types.filter((type) => type === "lower_doors" || type === "drawers");
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
      drawerSections: undefined
    }
  });
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
