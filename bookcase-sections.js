import {
  DOOR_ARRANGEMENTS,
  EDITABLE_SECTION_TYPES,
  LOCKED_SECTION_TYPES,
  layoutPresets,
  normalizeBookcaseConfig,
  normalizeSectionTypeValue
} from "./bookcase-config.js?v=engine-polish-20260716a";
import {
  CONSTRUCTION_RULES,
  generateBookcaseLayout,
  resolveDoorArrangement
} from "./bookcase-layout.js?v=engine-polish-20260716a";

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
      const sectionConfig = getSectionConfigAt(state, index, type);
      return {
        id: descriptor?.id || `section-${String(index + 1).padStart(2, "0")}`,
        stableId: sectionConfig.id,
        index,
        width,
        type,
        doorLayout: cloneDoorLayout(doorLayouts[index]),
        shelfCount: sectionConfig.shelfCount,
        shelfDistribution: sectionConfig.shelfDistribution,
        doorStyle: sectionConfig.doorStyle,
        drawerCount: sectionConfig.drawerCount,
        drawerFrontStyle: sectionConfig.drawerFrontStyle,
        lowerStorageHeight: sectionConfig.lowerStorageHeight,
        configuration: cloneSectionConfig(sectionConfig),
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
  const sectionConfigs = designer.sections.map((item) => cloneSectionConfig(item.configuration));
  const sourceSectionConfig = cloneSectionConfig(section.configuration);
  const insertedSectionConfig = {
    ...cloneSectionConfig(sourceSectionConfig),
    id: allocateSectionConfigId(sectionConfigs),
    doorArrangement: splitDoorLayout?.arrangement || null
  };
  sectionConfigs.splice(
    index,
    1,
    { ...sourceSectionConfig, doorArrangement: splitDoorLayout?.arrangement || null },
    insertedSectionConfig
  );
  const customized = applyCustomization(config, widths, types, doorLayouts, sectionConfigs);
  const indexMap = createStableSectionIndexMap(designer.sections, sectionConfigs);
  return acceptedConfig(
    reconcileSectionHardwareSelections(config, layout, customized, indexMap),
    widths,
    [index, index + 1]
  );
}

/**
 * Add one neutral open section. The selected section is preferred when it can
 * be split; otherwise the widest eligible section is used deterministically.
 */
export function addSection(config, layout, sectionIndex = null, rules = CONSTRUCTION_RULES) {
  const designer = getSectionDesignerState(config, layout);
  const requestedIndex = normalizeOptionalSectionIndex(sectionIndex);
  if (requestedIndex.invalid || (requestedIndex.value !== null && !designer.sections[requestedIndex.value])) {
    return rejectedConfig("INVALID_SECTION", "Choose a valid section to add beside.", config);
  }
  if (designer.sections.some((section) => section.locked)) {
    return rejectedConfig(
      "LOCKED_SECTION",
      "Change to a non-feature layout before adding sections.",
      config
    );
  }
  if (designer.sections.length >= getMaximumCount(rules)) {
    return rejectedConfig(
      "MAX_SECTION_COUNT",
      `A bookcase can contain at most ${getMaximumCount(rules)} sections.`,
      config
    );
  }

  const eligible = designer.sections.filter((section) => canSplitWidth(section.width, rules));
  const preferred = requestedIndex.value === null
    ? null
    : eligible.find((section) => section.index === requestedIndex.value) || null;
  const source = preferred || eligible.reduce(
    (widest, section) => !widest || section.width > widest.width + EPSILON ? section : widest,
    null
  );
  if (!source) {
    return createOrganizerReflowAdd(config, layout, designer, requestedIndex.value, rules);
  }
  return createOrganizerSplit(config, layout, designer, source.index, false, rules);
}

/** Split the selected section and copy its compatible section-owned context. */
export function duplicateSection(config, layout, sectionIndex, rules = CONSTRUCTION_RULES) {
  const designer = getSectionDesignerState(config, layout);
  const requestedIndex = normalizeOptionalSectionIndex(sectionIndex);
  const index = requestedIndex.value;
  const section = !requestedIndex.invalid && index !== null ? designer.sections[index] : null;
  if (!section) return rejectedConfig("INVALID_SECTION", "Choose a section to duplicate.", config);
  if (designer.sections.some((item) => item.locked)) {
    return rejectedConfig(
      "LOCKED_SECTION",
      "Change to a non-feature layout before duplicating sections.",
      config
    );
  }
  if (designer.sections.length >= getMaximumCount(rules)) {
    return rejectedConfig(
      "MAX_SECTION_COUNT",
      `A bookcase can contain at most ${getMaximumCount(rules)} sections.`,
      config
    );
  }
  if (!canSplitWidth(section.width, rules)) {
    return rejectedConfig(
      "SECTION_TOO_NARROW_TO_SPLIT",
      splitWidthFailureMessage(rules),
      config
    );
  }
  return createOrganizerSplit(config, layout, designer, index, true, rules);
}

/**
 * Delete one section by absorbing its clear width and divider into a suitable
 * unlocked neighbor. Auto prefers the same type, then the narrower result,
 * then the left neighbor so repeated calls are deterministic.
 */
export function deleteSection(
  config,
  layout,
  sectionIndex,
  direction = "auto",
  rules = CONSTRUCTION_RULES
) {
  const designer = getSectionDesignerState(config, layout);
  const requestedIndex = normalizeOptionalSectionIndex(sectionIndex);
  const index = requestedIndex.value;
  const section = !requestedIndex.invalid && index !== null ? designer.sections[index] : null;
  if (!section) return rejectedConfig("INVALID_SECTION", "Choose a section to delete.", config);
  if (!["auto", "left", "right"].includes(direction)) {
    return rejectedConfig(
      "INVALID_DELETE_DIRECTION",
      "Choose Auto, Left, or Right for the section receiving the available width.",
      config
    );
  }
  if (designer.sections.some((item) => item.locked)) {
    return rejectedConfig(
      "LOCKED_SECTION",
      "Change to a non-feature layout before deleting sections.",
      config
    );
  }
  if (designer.sections.length <= getMinimumCount(rules)) {
    return rejectedConfig(
      "MIN_SECTION_COUNT",
      `A bookcase must contain at least ${getMinimumCount(rules)} section${getMinimumCount(rules) === 1 ? "" : "s"}.`,
      config
    );
  }

  const requestedNeighbors = direction === "left"
    ? [index - 1]
    : direction === "right"
      ? [index + 1]
      : [index - 1, index + 1];
  const availableNeighbors = requestedNeighbors.filter((neighborIndex) => designer.sections[neighborIndex]);
  if (!availableNeighbors.length) {
    return rejectedConfig(
      "NO_DELETE_NEIGHBOR",
      "Choose a section with an adjacent section to receive its width.",
      config
    );
  }

  const state = normalizeBookcaseConfig(config);
  const candidates = availableNeighbors.flatMap((neighborIndex) => {
    const neighbor = designer.sections[neighborIndex];
    if (neighbor.locked) return [];
    const mergedWidth = round(section.width + neighbor.width + getPanel(rules));
    const resolvedDoorLayout = resolveCompatibleDoorLayout({
      state,
      type: neighbor.type,
      width: mergedWidth,
      doorLayout: neighbor.doorLayout,
      sectionIndex: neighborIndex > index ? index : neighborIndex,
      sectionCount: designer.sections.length - 1,
      rules
    });
    if (!resolvedDoorLayout.valid) return [];
    return [{
      neighborIndex,
      mergedWidth,
      doorLayout: resolvedDoorLayout.layout,
      sameType: neighbor.type === section.type
    }];
  });
  if (!candidates.length) {
    return createOrganizerReflowDelete(config, layout, designer, index, rules);
  }
  candidates.sort((left, right) => (
    Number(right.sameType) - Number(left.sameType)
    || left.mergedWidth - right.mergedWidth
    || left.neighborIndex - right.neighborIndex
  ));
  const chosen = candidates[0];
  const widths = designer.widths.slice();
  widths[chosen.neighborIndex] = chosen.mergedWidth;
  widths.splice(index, 1);
  const types = designer.sections.map((item) => item.type);
  types.splice(index, 1);
  const doorLayouts = designer.sections.map((item) => cloneDoorLayout(item.doorLayout));
  doorLayouts.splice(index, 1);
  const sectionConfigs = designer.sections.map((item) => cloneSectionConfig(item.configuration));
  sectionConfigs.splice(index, 1);
  const survivorIndex = chosen.neighborIndex > index ? chosen.neighborIndex - 1 : chosen.neighborIndex;
  doorLayouts[survivorIndex] = cloneDoorLayout(chosen.doorLayout);
  sectionConfigs[survivorIndex].doorArrangement = chosen.doorLayout?.arrangement || null;
  const indexMap = new Map();
  for (let oldIndex = 0; oldIndex < designer.sections.length; oldIndex += 1) {
    indexMap.set(oldIndex, oldIndex === index ? [] : [oldIndex > index ? oldIndex - 1 : oldIndex]);
  }
  const customized = applyCustomization(state, widths, types, doorLayouts, sectionConfigs);
  const nextConfig = reconcileSectionHardwareSelections(config, layout, customized, indexMap);
  return {
    ...acceptedConfig(nextConfig, widths, [survivorIndex]),
    operation: "delete",
    deletedSectionIndex: index,
    selectedSectionIndex: survivorIndex,
    mergeDirection: chosen.neighborIndex < index ? "left" : "right"
  };
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
  const nextSectionConfigs = designer.sections.map((section, index) => ({
    ...cloneSectionConfig(section.configuration),
    type: nextTypes[index],
    doorArrangement: isDoorSectionType(nextTypes[index])
      ? isDoorSectionType(previousTypes[index])
        ? section.doorLayout?.arrangement || "auto"
        : "auto"
      : null
  }));

  return acceptedConfig(
    normalizeBookcaseConfig({
      ...state,
      lowerCabinets,
      lowerStorage,
      layoutMetadata: {
        ...state.layoutMetadata,
        sectionTypes: nextTypes,
        sectionDoorLayouts: nextSectionConfigs.map((section) => (
          isDoorSectionType(section.type) ? { arrangement: section.doorArrangement || "auto" } : null
        )),
        sectionConfigs: nextSectionConfigs
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
  const sectionConfigs = designer.sections.map((item) => cloneSectionConfig(item.configuration));
  sectionConfigs.splice(first, 2, {
    ...cloneSectionConfig(selected.configuration),
    type: selected.type,
    doorArrangement: isDoorSectionType(selected.type) ? "auto" : null
  });
  const customized = applyCustomization(config, widths, types, doorLayouts, sectionConfigs);
  const indexMap = createStableSectionIndexMap(designer.sections, sectionConfigs);
  return acceptedConfig(
    reconcileSectionHardwareSelections(config, layout, customized, indexMap),
    widths,
    [first]
  );
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
  const sectionConfigs = designer.sections.map((item, itemIndex) => ({
    ...cloneSectionConfig(item.configuration),
    type: types[itemIndex],
    doorArrangement: doorLayouts[itemIndex]?.arrangement || null
  }));
  const customized = applyCustomization(config, designer.widths, types, doorLayouts, sectionConfigs);
  const indexMap = createStableSectionIndexMap(designer.sections, sectionConfigs);
  return acceptedConfig(
    reconcileSectionHardwareSelections(config, layout, customized, indexMap),
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
  const sectionConfigs = designer.sections.map((item, itemIndex) => ({
    ...cloneSectionConfig(item.configuration),
    doorArrangement: doorLayouts[itemIndex]?.arrangement || null
  }));
  const customized = applyCustomization(
    state,
    designer.widths,
    designer.sections.map((item) => item.type),
    doorLayouts,
    sectionConfigs
  );
  const indexMap = createStableSectionIndexMap(designer.sections, sectionConfigs);
  return acceptedConfig(
    reconcileSectionHardwareSelections(config, layout, customized, indexMap),
    designer.widths,
    [index]
  );
}

/**
 * Apply storage details to exactly one stable section record. The layout
 * engine remains authoritative for dimensional clamping and front
 * buildability; this helper only owns the section-local state transition.
 */
export function setSectionStorageConfiguration(config, sectionIndex, patch = {}, layout = null) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    return rejectedConfig("INVALID_SECTION_STORAGE", "Choose valid section storage settings.", config);
  }
  const designer = getSectionDesignerState(config, layout);
  const index = Number(sectionIndex);
  const section = designer.sections[index];
  if (!section) return rejectedConfig("INVALID_SECTION", "Choose a section to configure.", config);
  if (section.locked) return rejectedConfig("LOCKED_SECTION", "Preset feature sections keep their generated storage.", config);

  const allowedFields = new Set([
    "type",
    "shelfCount",
    "shelfDistribution",
    "doorStyle",
    "doorArrangement",
    "drawerCount",
    "drawerFrontStyle",
    "lowerStorageHeight"
  ]);
  const requested = Object.fromEntries(
    Object.entries(patch).filter(([field]) => allowedFields.has(field))
  );
  if (!Object.keys(requested).length) {
    return acceptedConfig(normalizeBookcaseConfig(config), designer.widths, []);
  }
  if (Object.prototype.hasOwnProperty.call(requested, "type")) {
    const normalizedType = normalizeSectionTypeValue(requested.type);
    if (!normalizedType || !EDITABLE_SECTION_TYPES.includes(normalizedType)) {
      return rejectedConfig("UNSUPPORTED_SECTION_TYPE", "Choose a supported storage layout.", config);
    }
    requested.type = normalizedType;
  }
  if (
    Object.prototype.hasOwnProperty.call(requested, "doorArrangement")
    && !DOOR_ARRANGEMENTS.includes(requested.doorArrangement)
  ) {
    return rejectedConfig("UNSUPPORTED_DOOR_ARRANGEMENT", "Choose Auto, a supported single hinge side, or Pair.", config);
  }

  const sectionConfigs = designer.sections.map((item) => cloneSectionConfig(item.configuration));
  const nextSectionConfig = {
    ...sectionConfigs[index],
    ...requested,
    id: sectionConfigs[index].id
  };
  if (!isDoorSectionType(nextSectionConfig.type)) nextSectionConfig.doorArrangement = null;
  else if (!DOOR_ARRANGEMENTS.includes(nextSectionConfig.doorArrangement)) nextSectionConfig.doorArrangement = "auto";
  sectionConfigs[index] = nextSectionConfig;
  const types = sectionConfigs.map((item) => item.type);
  const doorLayouts = sectionConfigs.map((item) => (
    isDoorSectionType(item.type) ? { arrangement: item.doorArrangement || "auto" } : null
  ));
  const customized = applyCustomization(config, designer.widths, types, doorLayouts, sectionConfigs);
  const indexMap = createStableSectionIndexMap(designer.sections, sectionConfigs);
  return acceptedConfig(
    reconcileSectionHardwareSelections(config, layout, customized, indexMap),
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
  const sectionConfigs = types.map((type, index) => cloneSectionConfig(getSectionConfigAt(state, index, type)));
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
    const sourceSectionConfig = sectionConfigs[splitIndex];
    sectionConfigs.splice(
      splitIndex,
      1,
      { ...cloneSectionConfig(sourceSectionConfig), doorArrangement: splitDoorLayout?.arrangement || null },
      {
        ...cloneSectionConfig(sourceSectionConfig),
        id: allocateSectionConfigId(sectionConfigs),
        doorArrangement: splitDoorLayout?.arrangement || null
      }
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
    sectionConfigs.splice(mergeIndex, 2, {
      ...cloneSectionConfig(sectionConfigs[mergeIndex]),
      type: types[mergeIndex],
      doorArrangement: isDoorSectionType(types[mergeIndex]) ? "auto" : null
    });
  }

  // A section-count selection is a global layout transition. It intentionally
  // starts the selected count from equal clear widths; local split/merge and
  // divider operations remain the tools for preserving or creating asymmetry.
  const reconciledWidths = allocateWidths(targetTotal, Array.from({ length: targetCount }, () => 1));

  const customized = applyCustomization(previousConfig, reconciledWidths, types, doorLayouts, sectionConfigs);
  const previousSections = types.length === state.sections
    ? sectionConfigs.map((sectionConfig, index) => ({ index, stableId: sectionConfig.id }))
    : Array.from({ length: state.sections }, (_, index) => ({
        index,
        stableId: state.layoutMetadata.sectionConfigs[index]?.id
      }));
  const indexMap = createStableSectionIndexMap(previousSections, sectionConfigs);
  return acceptedConfig(
    reconcileSectionHardwareSelections(previousConfig, null, customized, indexMap),
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

function createOrganizerSplit(config, layout, designer, index, duplicate, rules) {
  const section = designer.sections[index];
  const panel = getPanel(rules);
  const available = round(section.width - panel);
  const left = round(available / 2);
  const right = round(available - left);
  const state = normalizeBookcaseConfig(config);
  const nextCount = designer.sections.length + 1;
  const leftDoorLayout = resolveCompatibleDoorLayout({
    state,
    type: section.type,
    width: left,
    doorLayout: section.doorLayout,
    sectionIndex: index,
    sectionCount: nextCount,
    rules
  });
  const rightType = duplicate ? section.type : "open";
  const rightDoorLayout = resolveCompatibleDoorLayout({
    state,
    type: rightType,
    width: right,
    doorLayout: duplicate ? section.doorLayout : null,
    sectionIndex: index + 1,
    sectionCount: nextCount,
    rules
  });
  if (!leftDoorLayout.valid || !rightDoorLayout.valid) {
    return rejectedConfig(
      "NO_BUILDABLE_DOOR_ARRANGEMENT",
      "The split would not leave a supported door arrangement for both resulting sections.",
      config
    );
  }

  const widths = designer.widths.slice();
  widths.splice(index, 1, left, right);
  const types = designer.sections.map((item) => item.type);
  types.splice(index, 1, section.type, rightType);
  const doorLayouts = designer.sections.map((item) => cloneDoorLayout(item.doorLayout));
  doorLayouts.splice(index, 1, cloneDoorLayout(leftDoorLayout.layout), cloneDoorLayout(rightDoorLayout.layout));
  const sectionConfigs = designer.sections.map((item) => cloneSectionConfig(item.configuration));
  const leftSectionConfig = {
    ...cloneSectionConfig(section.configuration),
    doorArrangement: leftDoorLayout.layout?.arrangement || null
  };
  const rightSectionConfig = duplicate
    ? {
        ...cloneSectionConfig(section.configuration),
        id: allocateSectionConfigId(sectionConfigs),
        doorArrangement: rightDoorLayout.layout?.arrangement || null
      }
    : {
        ...cloneSectionConfig(section.configuration),
        id: allocateSectionConfigId(sectionConfigs),
        type: "open",
        doorArrangement: null
      };
  sectionConfigs.splice(index, 1, leftSectionConfig, rightSectionConfig);
  const indexMap = new Map();
  for (let oldIndex = 0; oldIndex < designer.sections.length; oldIndex += 1) {
    if (oldIndex < index) indexMap.set(oldIndex, [oldIndex]);
    else if (oldIndex > index) indexMap.set(oldIndex, [oldIndex + 1]);
    else indexMap.set(oldIndex, duplicate ? [oldIndex, oldIndex + 1] : [oldIndex]);
  }
  const customized = applyCustomization(state, widths, types, doorLayouts, sectionConfigs);
  const nextConfig = reconcileSectionHardwareSelections(config, layout, customized, indexMap);
  return {
    ...acceptedConfig(nextConfig, widths, [index, index + 1]),
    operation: duplicate ? "duplicate" : "add",
    sourceSectionIndex: index,
    insertedSectionIndex: index + 1,
    selectedSectionIndex: index + 1
  };
}

/**
 * When no individual bay is wide enough to split, add a neutral section by
 * redistributing the available clear width across the whole bookcase. This is
 * the same physical transition exposed by the globally valid section counts.
 */
function createOrganizerReflowAdd(config, layout, designer, requestedIndex, rules) {
  const state = normalizeBookcaseConfig(config);
  const panel = getPanel(rules);
  const minimum = getMinimum(rules);
  const nextCount = designer.sections.length + 1;
  const nextTotal = round(state.width - panel * (nextCount + 1));
  if (nextTotal / nextCount + EPSILON < minimum) {
    return rejectedConfig(
      "MIN_SECTION_CLEAR_WIDTH",
      `That section count cannot preserve ${formatWidth(minimum)} in clear bays at the selected overall width.`,
      config
    );
  }

  const insertionIndex = requestedIndex === null
    ? designer.sections.length
    : Math.min(designer.sections.length, requestedIndex + 1);
  const widths = allocateWidths(nextTotal, Array.from({ length: nextCount }, () => 1));
  const types = designer.sections.map((section) => section.type);
  types.splice(insertionIndex, 0, "open");
  const requestedDoorLayouts = designer.sections.map((section) => cloneDoorLayout(section.doorLayout));
  requestedDoorLayouts.splice(insertionIndex, 0, null);
  const doorLayouts = resolveReflowDoorLayouts(state, widths, types, requestedDoorLayouts, rules);
  if (!doorLayouts) {
    return rejectedConfig(
      "NO_BUILDABLE_DOOR_ARRANGEMENT",
      "The additional section would leave an unsupported door arrangement.",
      config
    );
  }

  const sectionConfigs = designer.sections.map((section) => cloneSectionConfig(section.configuration));
  const sourceConfig = designer.sections[Math.max(0, Math.min(designer.sections.length - 1, requestedIndex ?? designer.sections.length - 1))]?.configuration
    || designer.sections[0]?.configuration;
  sectionConfigs.splice(insertionIndex, 0, {
    ...cloneSectionConfig(sourceConfig),
    id: allocateSectionConfigId(sectionConfigs),
    type: "open",
    doorArrangement: null
  });
  const indexMap = new Map();
  for (let oldIndex = 0; oldIndex < designer.sections.length; oldIndex += 1) {
    indexMap.set(oldIndex, [oldIndex < insertionIndex ? oldIndex : oldIndex + 1]);
  }
  const customized = applyCustomization(state, widths, types, doorLayouts, sectionConfigs);
  const nextConfig = reconcileSectionHardwareSelections(config, layout, customized, indexMap);
  return {
    ...acceptedConfig(nextConfig, widths, widths.map((_, index) => index)),
    operation: "add",
    sourceSectionIndex: requestedIndex,
    insertedSectionIndex: insertionIndex,
    selectedSectionIndex: insertionIndex,
    reflowed: true
  };
}

/**
 * If merging the deleted width into one neighbor would create an invalid door
 * bay, redistribute the remaining clear width instead of disabling Delete.
 */
function createOrganizerReflowDelete(config, layout, designer, deletedIndex, rules) {
  const state = normalizeBookcaseConfig(config);
  const panel = getPanel(rules);
  const nextCount = designer.sections.length - 1;
  const nextTotal = round(state.width - panel * (nextCount + 1));
  const widths = allocateWidths(nextTotal, Array.from({ length: nextCount }, () => 1));
  const types = designer.sections.map((section) => section.type);
  types.splice(deletedIndex, 1);
  const requestedDoorLayouts = designer.sections.map((section) => cloneDoorLayout(section.doorLayout));
  requestedDoorLayouts.splice(deletedIndex, 1);
  const doorLayouts = resolveReflowDoorLayouts(state, widths, types, requestedDoorLayouts, rules);
  if (!doorLayouts) {
    return rejectedConfig(
      "NO_SUITABLE_DELETE_NEIGHBOR",
      "The remaining sections cannot be redistributed into a buildable layout.",
      config
    );
  }

  const sectionConfigs = designer.sections.map((section) => cloneSectionConfig(section.configuration));
  sectionConfigs.splice(deletedIndex, 1);
  doorLayouts.forEach((doorLayout, index) => {
    sectionConfigs[index].doorArrangement = doorLayout?.arrangement || null;
  });
  const indexMap = new Map();
  for (let oldIndex = 0; oldIndex < designer.sections.length; oldIndex += 1) {
    indexMap.set(oldIndex, oldIndex === deletedIndex ? [] : [oldIndex > deletedIndex ? oldIndex - 1 : oldIndex]);
  }
  const customized = applyCustomization(state, widths, types, doorLayouts, sectionConfigs);
  const nextConfig = reconcileSectionHardwareSelections(config, layout, customized, indexMap);
  const selectedSectionIndex = Math.min(deletedIndex, nextCount - 1);
  return {
    ...acceptedConfig(nextConfig, widths, widths.map((_, index) => index)),
    operation: "delete",
    deletedSectionIndex: deletedIndex,
    selectedSectionIndex,
    mergeDirection: "reflow",
    reflowed: true
  };
}

function resolveReflowDoorLayouts(state, widths, types, requestedDoorLayouts, rules) {
  const sectionCount = types.length;
  const resolved = [];
  for (let index = 0; index < sectionCount; index += 1) {
    const result = resolveCompatibleDoorLayout({
      state,
      type: types[index],
      width: widths[index],
      doorLayout: requestedDoorLayouts[index],
      sectionIndex: index,
      sectionCount,
      rules
    });
    if (!result.valid) return null;
    resolved.push(cloneDoorLayout(result.layout));
  }
  return resolved;
}

function resolveCompatibleDoorLayout({ state, type, width, doorLayout, sectionIndex, sectionCount, rules }) {
  if (!isDoorSectionType(type)) return { valid: true, layout: null };
  const constructionRules = { ...CONSTRUCTION_RULES, ...(rules || {}) };
  const requested = DOOR_ARRANGEMENTS.includes(doorLayout?.arrangement)
    ? doorLayout.arrangement
    : "auto";
  const resolution = resolveDoorArrangement({
    opening: { size: { x: width } },
    requested,
    constructionProfile: state.constructionProfile,
    openingKind: type === "tall_doors" ? "tall_storage" : "lower_cabinet",
    sectionIndex,
    sectionCount,
    rules: constructionRules
  });
  if (resolution.valid) return { valid: true, layout: { arrangement: requested } };
  const automatic = resolveDoorArrangement({
    opening: { size: { x: width } },
    requested: "auto",
    constructionProfile: state.constructionProfile,
    openingKind: type === "tall_doors" ? "tall_storage" : "lower_cabinet",
    sectionIndex,
    sectionCount,
    rules: constructionRules
  });
  return automatic.valid
    ? { valid: true, layout: { arrangement: "auto" } }
    : { valid: false, layout: null };
}

function reconcileSectionHardwareSelections(previousConfig, previousLayout, nextConfig, indexMap) {
  const previous = normalizeBookcaseConfig(previousConfig);
  const sourceSelections = previous.hardwareSelections;
  const sourceEntries = Object.entries(sourceSelections?.byHostId || {});
  if (!sourceEntries.length) return nextConfig;

  const acceptedPreviousLayout = previousLayout?.components
    ? previousLayout
    : generateBookcaseLayout(previous);
  const sourceFrontIds = new Set(
    (acceptedPreviousLayout.components || [])
      .filter((component) => component.role === "door" || component.role === "drawer_front")
      .map((component) => component.id)
  );
  const remapped = {};
  for (const [hostId, selection] of sourceEntries) {
    const parsed = parseSectionHostId(hostId);
    if (!parsed) {
      remapped[hostId] = structuredClone(selection);
      continue;
    }
    if (!sourceFrontIds.has(hostId)) continue;
    for (const nextIndex of indexMap.get(parsed.index) || []) {
      remapped[formatSectionPrefix(nextIndex) + parsed.suffix] = structuredClone(selection);
    }
  }

  const provisional = normalizeBookcaseConfig({
    ...nextConfig,
    hardwareSelections: {
      ...nextConfig.hardwareSelections,
      byHostId: remapped
    }
  });
  const candidateLayout = generateBookcaseLayout(provisional);
  const candidateFrontIds = new Set(
    candidateLayout.components
      .filter((component) => component.role === "door" || component.role === "drawer_front")
      .map((component) => component.id)
  );
  const compatibilityByHost = new Map();
  for (const handle of candidateLayout.components.filter((component) => component.role === "handle")) {
    const compatible = handle.metadata?.compatibilityLevel !== "not_compatible";
    compatibilityByHost.set(handle.hostId, (compatibilityByHost.get(handle.hostId) ?? true) && compatible);
  }
  const componentById = new Map(candidateLayout.components.map((component) => [component.id, component]));
  const invalidHardwareHosts = new Set();
  for (const issue of candidateLayout.validation?.errors || []) {
    const component = componentById.get(issue.componentId);
    if (component?.role === "handle" && component.hostId) invalidHardwareHosts.add(component.hostId);
    if (candidateFrontIds.has(issue.relatedId)) invalidHardwareHosts.add(issue.relatedId);
  }
  const filtered = {};
  for (const [hostId, selection] of Object.entries(remapped)) {
    const parsed = parseSectionHostId(hostId);
    if (!parsed || (
      candidateFrontIds.has(hostId)
      && compatibilityByHost.get(hostId) !== false
      && !invalidHardwareHosts.has(hostId)
    )) {
      filtered[hostId] = structuredClone(selection);
    }
  }
  return normalizeBookcaseConfig({
    ...provisional,
    hardwareSelections: {
      ...provisional.hardwareSelections,
      byHostId: filtered
    }
  });
}

function parseSectionHostId(hostId) {
  const match = /^section-(\d+)(-.+)$/.exec(String(hostId || ""));
  if (!match) return null;
  const ordinal = Number(match[1]);
  return Number.isInteger(ordinal) && ordinal > 0
    ? { index: ordinal - 1, suffix: match[2] }
    : null;
}

function formatSectionPrefix(index) {
  return `section-${String(index + 1).padStart(2, "0")}`;
}

function normalizeOptionalSectionIndex(value) {
  if (value === null || value === undefined || value === "") return { invalid: false, value: null };
  const index = Number(value);
  return Number.isInteger(index) && index >= 0
    ? { invalid: false, value: index }
    : { invalid: true, value: null };
}

function canSplitWidth(width, rules) {
  return Number(width) + EPSILON >= getMinimum(rules) * 2 + getPanel(rules);
}

function splitWidthFailureMessage(rules) {
  return `Splitting requires room for two ${formatWidth(getMinimum(rules))} in clear sections plus the divider.`;
}

function applyCustomization(config, widths, types, doorLayouts = null, sectionConfigs = null) {
  const state = normalizeBookcaseConfig(config);
  const lowerStorageTypes = types.filter((type) => type === "lower_doors" || type === "drawers");
  const alignedDoorLayouts = Array.isArray(doorLayouts) && doorLayouts.length === types.length
    ? doorLayouts.map((layout, index) => isDoorSectionType(types[index]) ? cloneDoorLayout(layout) : null)
    : resolveSectionDoorLayouts(state, types);
  const sourceSectionConfigs = Array.isArray(sectionConfigs) && sectionConfigs.length === types.length
    ? sectionConfigs
    : types.map((type, index) => ({
        ...getSectionConfigAt(state, index, type),
        type
      }));
  const alignedSectionConfigs = sourceSectionConfigs.map((sectionConfig, index) => ({
    ...cloneSectionConfig(sectionConfig),
    type: types[index],
    doorArrangement: isDoorSectionType(types[index])
      ? alignedDoorLayouts[index]?.arrangement || "auto"
      : null
  }));
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
      sectionConfigs: alignedSectionConfigs,
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

function cloneSectionConfig(value) {
  return value && typeof value === "object" ? structuredClone(value) : null;
}

function getSectionConfigAt(config, index, type = "open") {
  const stored = config.layoutMetadata?.sectionConfigs?.[index];
  if (stored && typeof stored === "object") return stored;
  return {
    id: `section-config-${String(index + 1).padStart(2, "0")}`,
    type,
    shelfCount: config.shelves,
    shelfDistribution: "even",
    doorStyle: config.doorStyle,
    doorArrangement: isDoorSectionType(type)
      ? config.layoutMetadata?.sectionDoorLayouts?.[index]?.arrangement || "auto"
      : null,
    drawerCount: config.drawerCount,
    drawerFrontStyle: config.drawerFrontStyle,
    lowerStorageHeight: CONSTRUCTION_RULES.lowerCabinetClearHeight
  };
}

function allocateSectionConfigId(sectionConfigs) {
  const used = new Set(sectionConfigs.map((section) => section?.id).filter(Boolean));
  let ordinal = 1;
  let candidate = "";
  do {
    candidate = `section-config-${String(ordinal).padStart(2, "0")}`;
    ordinal += 1;
  } while (used.has(candidate));
  return candidate;
}

function createStableSectionIndexMap(previousSections, nextSectionConfigs) {
  const nextIndicesById = new Map();
  nextSectionConfigs.forEach((section, index) => {
    if (!section?.id) return;
    const indices = nextIndicesById.get(section.id) || [];
    indices.push(index);
    nextIndicesById.set(section.id, indices);
  });
  const indexMap = new Map();
  previousSections.forEach((section, index) => {
    const stableId = section?.stableId || section?.configuration?.id || section?.id;
    indexMap.set(Number.isInteger(section?.index) ? section.index : index, nextIndicesById.get(stableId) || []);
  });
  return indexMap;
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

function getMaximumCount(rules) {
  const maximum = Number(rules?.maxSections);
  return Number.isInteger(maximum) && maximum > 0 ? maximum : CONSTRUCTION_RULES.maxSections;
}

function getMinimumCount(rules) {
  const minimum = Number(rules?.minSections);
  return Number.isInteger(minimum) && minimum > 0 ? minimum : CONSTRUCTION_RULES.minSections;
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
