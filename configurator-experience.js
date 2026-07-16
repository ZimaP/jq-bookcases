import {
  createDesignId,
  defaultBookcaseConfig,
  getHardwareFinish,
  getHardwareFinishOption,
  getHardwareType,
  hardwareTypeOptions,
  layoutPresets,
  normalizeBookcaseConfig,
  optionLabels
} from "./bookcase-config.js?v=engine-polish-20260716a";
import { deriveBillableComponents } from "./bookcase-billable.js?v=engine-polish-20260716a";
import { deriveBookcaseBOM } from "./bookcase-bom.js?v=engine-polish-20260716a";
import { getSectionDesignerState } from "./bookcase-sections.js?v=engine-polish-20260716a";

/**
 * Non-linear customer workspace navigation. These are organizational stages,
 * not a guided workflow: every stage is always directly reachable.
 */
export const WORKSPACE_STAGES = Object.freeze([
  Object.freeze({ id: "space", label: "Space", subtitle: "Set your room dimensions", icon: "space" }),
  Object.freeze({ id: "layout", label: "Layout", subtitle: "Set section count & widths", icon: "layout" }),
  Object.freeze({ id: "storage", label: "Storage", subtitle: "Configure shelves, doors & drawers", icon: "storage" }),
  Object.freeze({ id: "base_top", label: "Base & Top", subtitle: "Choose base & crown details", icon: "structure" }),
  Object.freeze({ id: "finish", label: "Finish", subtitle: "Choose materials & colors", icon: "finish" }),
  Object.freeze({ id: "hardware", label: "Hardware", subtitle: "Select handles & knobs", icon: "hardware" }),
  Object.freeze({ id: "lighting", label: "Lighting", subtitle: "Add lighting options", icon: "lighting" }),
  Object.freeze({ id: "preview", label: "Preview", subtitle: "Review & export your design", icon: "preview" })
]);

/** Physical control groups projected into each directly reachable stage. */
export const STAGE_CONTROL_GROUPS = Object.freeze({
  space: Object.freeze(["overall_size"]),
  layout: Object.freeze(["sections_layout"]),
  storage: Object.freeze(["shelves", "storage_fronts"]),
  base_top: Object.freeze(["base_crown"]),
  finish: Object.freeze(["finish"]),
  hardware: Object.freeze(["hardware"]),
  lighting: Object.freeze(["lighting"]),
  preview: Object.freeze(["project_service"])
});

const FRONT_SECTION_TYPES = Object.freeze(["lower_doors", "tall_doors"]);
const DRAWER_SECTION_TYPES = Object.freeze(["drawers"]);
const SHELF_SECTION_TYPES = Object.freeze(["open", "lower_doors", "drawers", "tall_doors"]);

/** Tabs shown for a selected section. Back is descriptor information only. */
export const INSPECTOR_TAB_DEFINITIONS = Object.freeze({
  general: Object.freeze({
    id: "general",
    label: "General",
    icon: "layout",
    groups: Object.freeze(["sections_layout"]),
    sectionTypes: null,
    always: true,
    readOnly: false
  }),
  shelves: Object.freeze({
    id: "shelves",
    label: "Shelves",
    icon: "shelves",
    groups: Object.freeze(["shelves"]),
    sectionTypes: SHELF_SECTION_TYPES,
    always: false,
    readOnly: false
  }),
  doors: Object.freeze({
    id: "doors",
    label: "Doors",
    icon: "doors",
    groups: Object.freeze(["storage_fronts"]),
    sectionTypes: FRONT_SECTION_TYPES,
    always: false,
    readOnly: false
  }),
  drawers: Object.freeze({
    id: "drawers",
    label: "Drawers",
    icon: "drawers",
    groups: Object.freeze(["storage_fronts"]),
    sectionTypes: DRAWER_SECTION_TYPES,
    always: false,
    readOnly: false
  }),
  back: Object.freeze({
    id: "back",
    label: "Back",
    icon: "backPanel",
    groups: Object.freeze([]),
    sectionTypes: null,
    always: false,
    readOnly: true
  }),
  lighting: Object.freeze({
    id: "lighting",
    label: "Lighting",
    icon: "lighting",
    groups: Object.freeze(["lighting"]),
    sectionTypes: null,
    always: false,
    readOnly: false
  })
});

/**
 * Deprecated compatibility projection for the current controller and
 * validation APIs. New presentation code must iterate WORKSPACE_STAGES.
 */
export const UNIFIED_CONTROL_GROUPS = Object.freeze([
  { id: "overall_size", label: "Overall Size" },
  { id: "sections_layout", label: "Sections & Layout" },
  { id: "shelves", label: "Shelves" },
  { id: "storage_fronts", label: "Storage & Fronts" },
  { id: "base_crown", label: "Base & Crown" },
  { id: "finish", label: "Finish" },
  { id: "hardware", label: "Hardware" },
  { id: "lighting", label: "Lighting" },
  { id: "project_service", label: "Project Service" }
].map((group) => Object.freeze(group)));

export const PHYSICAL_CONFIG_FIELDS = Object.freeze([
  "layoutPreset", "layoutType", "width", "height", "depth", "sections", "shelves",
  "shelfThickness", "lowerCabinets", "lowerStorage", "drawerCount", "centerOpening",
  "deskOpening", "featureOpening", "tallDoors", "constructionProfile", "doorStyle", "drawerFrontStyle", "doorCount", "hardware", "hardwareSelections",
  "lighting", "lightingWarmth", "finish", "customPaintColor", "customPaintCode",
  "customPaintHex", "paintSelection", "crownStyle", "baseStyle", "layoutMetadata", "installation", "delivery"
]);

export const CONTROL_REGISTRY = Object.freeze([
  { field: "layoutPreset", group: "sections_layout", access: "direct" },
  { field: "layoutType", group: "sections_layout", access: "preset-derived" },
  { field: "centerOpening", group: "sections_layout", access: "preset-derived" },
  { field: "deskOpening", group: "sections_layout", access: "preset-derived" },
  { field: "featureOpening", group: "sections_layout", access: "preset-derived" },
  { field: "tallDoors", group: "sections_layout", access: "preset-derived" },
  { field: "layoutMetadata", group: "sections_layout", access: "direct" },
  { field: "width", group: "overall_size", access: "direct" },
  { field: "height", group: "overall_size", access: "direct" },
  { field: "depth", group: "overall_size", access: "direct" },
  { field: "sections", group: "sections_layout", access: "direct" },
  { field: "shelves", group: "shelves", access: "direct" },
  { field: "shelfThickness", group: "shelves", access: "direct" },
  { field: "lowerCabinets", group: "storage_fronts", access: "direct" },
  { field: "lowerStorage", group: "storage_fronts", access: "direct" },
  { field: "drawerCount", group: "storage_fronts", access: "direct" },
  { field: "doorStyle", group: "storage_fronts", access: "direct" },
  { field: "drawerFrontStyle", group: "storage_fronts", access: "direct" },
  { field: "doorCount", group: "storage_fronts", access: "derived" },
  { field: "baseStyle", group: "base_crown", access: "direct" },
  { field: "crownStyle", group: "base_crown", access: "direct" },
  { field: "constructionProfile", group: "base_crown", access: "derived" },
  { field: "finish", group: "finish", access: "direct" },
  { field: "customPaintColor", group: "finish", access: "direct" },
  { field: "customPaintCode", group: "finish", access: "direct" },
  { field: "customPaintHex", group: "finish", access: "direct" },
  { field: "paintSelection", group: "finish", access: "derived" },
  { field: "hardware", group: "hardware", access: "direct" },
  { field: "hardwareSelections", group: "hardware", access: "direct" },
  { field: "lighting", group: "lighting", access: "direct" },
  { field: "lightingWarmth", group: "lighting", access: "direct" },
  { field: "installation", group: "project_service", access: "direct" },
  { field: "delivery", group: "project_service", access: "direct" }
]);

export const DIMENSION_LIMITS = Object.freeze({
  width: { min: 24, max: 144, label: "Width", unit: " inches" },
  height: { min: 72, max: 120, label: "Height", unit: " inches" },
  depth: { min: 10, max: 24, label: "Depth", unit: " inches" },
  shelves: { min: 2, max: 8, label: "Shelves per section", unit: "" },
  shelfThickness: { min: 0.75, max: 2, label: "Shelf thickness", unit: " inches" }
});

export const EDITABLE_NUMBER_LIMITS = Object.freeze({
  ...DIMENSION_LIMITS,
  sections: { min: 1, max: 6, label: "Sections", unit: "" },
  drawerCount: { min: 2, max: 5, label: "Drawers per section", unit: "" }
});

const inspectorGroupIds = new Set(UNIFIED_CONTROL_GROUPS.map((group) => group.id));
const workspaceStageIds = new Set(WORKSPACE_STAGES.map((stage) => stage.id));
const inspectorTabIds = new Set(Object.keys(INSPECTOR_TAB_DEFINITIONS));

export const CONTEXT_EDITOR_DEFINITIONS = Object.freeze({
  section: Object.freeze({
    id: "section",
    kind: "section",
    scope: "section",
    inspectorGroupId: "sections_layout",
    controlIds: Object.freeze(["section_width", "section_type", "door_arrangement", "section_actions"])
  }),
  shelves: Object.freeze({
    id: "shelves",
    kind: "shelf",
    scope: "global",
    inspectorGroupId: "shelves",
    controlIds: Object.freeze(["shelves", "shelfThickness"])
  }),
  door: Object.freeze({
    id: "door",
    kind: "front",
    scope: "section",
    inspectorGroupId: "storage_fronts",
    controlIds: Object.freeze(["section_type", "doorStyle", "door_arrangement", "section_width", "hardware_shortcut"])
  }),
  drawer: Object.freeze({
    id: "drawer",
    kind: "front",
    scope: "section",
    inspectorGroupId: "storage_fronts",
    controlIds: Object.freeze(["section_type", "drawerCount", "drawerFrontStyle", "hardware_shortcut"])
  }),
  hardware: Object.freeze({
    id: "hardware",
    kind: "hardware",
    scope: "host",
    inspectorGroupId: "hardware",
    controlIds: Object.freeze(["hardware", "hardwareSelections"])
  }),
  base: Object.freeze({
    id: "base",
    kind: "base",
    scope: "global",
    inspectorGroupId: "base_crown",
    controlIds: Object.freeze(["baseStyle"])
  }),
  crown: Object.freeze({
    id: "crown",
    kind: "crown",
    scope: "global",
    inspectorGroupId: "base_crown",
    controlIds: Object.freeze(["crownStyle"])
  }),
  lighting: Object.freeze({
    id: "lighting",
    kind: "lighting",
    scope: "global",
    inspectorGroupId: "lighting",
    controlIds: Object.freeze(["lighting", "lightingWarmth"])
  }),
  back: Object.freeze({
    id: "back",
    kind: "back",
    scope: "global",
    inspectorGroupId: "sections_layout",
    controlIds: Object.freeze([])
  }),
  body: Object.freeze({
    id: "body",
    kind: "body",
    scope: "global",
    inspectorGroupId: "overall_size",
    controlIds: Object.freeze(["width", "height", "depth", "finish"])
  }),
  divider: Object.freeze({
    id: "divider",
    kind: "divider",
    scope: "adjacent-pair",
    inspectorGroupId: "sections_layout",
    controlIds: Object.freeze(["divider_position", "section_width"])
  })
});

export const COMPONENT_ROLE_TO_EDITOR = Object.freeze({
  section: "section",
  section_group: "section",
  opening: "section",
  shelf: "shelves",
  fixed_shelf: "shelves",
  door: "door",
  drawer_front: "drawer",
  handle: "hardware",
  base: "base",
  trim: "base",
  crown: "crown",
  top_panel: "crown",
  light: "lighting",
  assembly: "body",
  side_panel: "body",
  back_panel: "back",
  bottom_panel: "body",
  divider: "divider"
});

export const COMPONENT_ROLE_TO_STAGE = Object.freeze({
  section: "layout",
  section_group: "layout",
  opening: "layout",
  divider: "layout",
  shelf: "storage",
  fixed_shelf: "storage",
  door: "storage",
  drawer_front: "storage",
  handle: "hardware",
  base: "base_top",
  trim: "base_top",
  crown: "base_top",
  top_panel: "base_top",
  light: "lighting",
  assembly: "space",
  side_panel: "space",
  back_panel: "layout",
  bottom_panel: "space"
});

export const COMPONENT_ROLE_TO_INSPECTOR = Object.freeze({
  section: "general",
  section_group: "general",
  opening: "general",
  divider: "general",
  shelf: "shelves",
  fixed_shelf: "shelves",
  door: "doors",
  drawer_front: "drawers",
  handle: "general",
  base: "general",
  trim: "general",
  crown: "general",
  top_panel: "general",
  light: "lighting",
  assembly: "general",
  side_panel: "general",
  back_panel: "back",
  bottom_panel: "general"
});

/** Compatibility name for callers that make the tab nature explicit. */
export const COMPONENT_ROLE_TO_INSPECTOR_TAB = COMPONENT_ROLE_TO_INSPECTOR;

export function normalizeWorkspaceStage(value) {
  return workspaceStageIds.has(value) ? value : WORKSPACE_STAGES[0].id;
}

export function normalizeInspectorTab(value) {
  return inspectorTabIds.has(value) ? value : INSPECTOR_TAB_DEFINITIONS.general.id;
}

export function workspaceStageForControlGroup(groupId) {
  return WORKSPACE_STAGES.find((stage) => STAGE_CONTROL_GROUPS[stage.id].includes(groupId))?.id
    || WORKSPACE_STAGES[0].id;
}

export function workspaceStageForField(field) {
  return workspaceStageForControlGroup(inspectorGroupForField(field));
}

export function inspectorTabForField(field, config = null) {
  if (["shelves", "shelfThickness"].includes(field)) return "shelves";
  if (["drawerCount", "drawerFrontStyle"].includes(field)) return "drawers";
  if (field === "doorStyle") return "doors";
  if (["lighting", "lightingWarmth"].includes(field)) return "lighting";
  if (["lowerCabinets", "lowerStorage"].includes(field)) {
    return config && normalizeBookcaseConfig(config).lowerStorage === "drawers" ? "drawers" : "doors";
  }
  return "general";
}

export function getApplicableInspectorTabs(sectionOrType) {
  const sectionType = typeof sectionOrType === "string" ? sectionOrType : sectionOrType?.type;
  return Object.values(INSPECTOR_TAB_DEFINITIONS).filter((tab) => (
    tab.always || tab.sectionTypes === null || tab.sectionTypes.includes(sectionType)
  ));
}

export function normalizeInspectorGroup(value) {
  return inspectorGroupIds.has(value) ? value : UNIFIED_CONTROL_GROUPS[0].id;
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'\"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    "\"": "&quot;"
  })[character]);
}

export function inspectorGroupForField(field) {
  return CONTROL_REGISTRY.find((entry) => entry.field === field)?.group || UNIFIED_CONTROL_GROUPS[0].id;
}

function getSelectionComponentId(hit) {
  if (typeof hit === "string") return hit;
  return hit?.componentId || hit?.id || hit?.descriptor?.id || hit?.component?.id || null;
}

function getOwningSection(component, componentById) {
  if (!component) return null;
  const explicitSectionId = component.metadata?.sectionId || component.sectionId;
  if (explicitSectionId && componentById.get(explicitSectionId)?.role === "section") {
    return componentById.get(explicitSectionId);
  }
  const memberSectionId = component.role === "section_group"
    ? component.metadata?.memberSectionIds?.[0]
    : null;
  if (memberSectionId && componentById.get(memberSectionId)?.role === "section") {
    return componentById.get(memberSectionId);
  }

  const pending = [component];
  const visited = new Set();
  while (pending.length) {
    const current = pending.shift();
    if (!current?.id || visited.has(current.id)) continue;
    visited.add(current.id);
    if (current.role === "section") return current;
    const currentExplicitId = current.metadata?.sectionId || current.sectionId;
    if (currentExplicitId && componentById.get(currentExplicitId)?.role === "section") {
      return componentById.get(currentExplicitId);
    }
    const currentMemberId = current.role === "section_group"
      ? current.metadata?.memberSectionIds?.[0]
      : null;
    if (currentMemberId && componentById.get(currentMemberId)?.role === "section") {
      return componentById.get(currentMemberId);
    }
    for (const relatedId of [current.parentId, current.hostId]) {
      const related = relatedId ? componentById.get(relatedId) : null;
      if (related && !visited.has(related.id)) pending.push(related);
    }
  }
  return null;
}

function getSelectionTitle(editorId, component, sectionIndex) {
  const sectionSuffix = Number.isInteger(sectionIndex) ? ` · Section ${sectionIndex + 1}` : "";
  if (editorId === "section") return Number.isInteger(sectionIndex) ? `Section ${sectionIndex + 1}` : "Section";
  if (editorId === "shelves") return `Shelf${sectionSuffix}`;
  if (editorId === "door") return `Door${sectionSuffix}`;
  if (editorId === "drawer") return `Drawer Front${sectionSuffix}`;
  if (editorId === "hardware") {
    const label = component.metadata?.hardwareFacts?.familyName
      || component.metadata?.hardwareFacts?.categoryLabel
      || "Hardware";
    return `${label}${sectionSuffix}`;
  }
  if (editorId === "base") return "Base";
  if (editorId === "crown") return "Crown & Top";
  if (editorId === "lighting") return `Lighting${sectionSuffix}`;
  if (editorId === "back") return "Fitted Back";
  if (editorId === "divider") {
    const boundaryIndex = Number(component.metadata?.boundaryIndex);
    return Number.isInteger(boundaryIndex) ? `Divider ${boundaryIndex}` : "Divider";
  }
  return "Overall Bookcase";
}

/**
 * Project one semantic model selection into non-linear workspace navigation.
 * A handle keeps its Hardware stage while its owning front selects Doors or
 * Drawers in the section inspector.
 */
export function resolveWorkspaceSelection(selection, stateOrLayout = null) {
  if (!selection) return null;
  const candidate = typeof selection === "string" ? { role: selection } : selection;
  const layout = stateOrLayout?.layout || (Array.isArray(stateOrLayout?.components) ? stateOrLayout : null);
  const components = Array.isArray(layout?.components) ? layout.components : [];
  const componentById = new Map(components.map((component) => [component.id, component]));
  const role = candidate.role || componentById.get(candidate.componentId)?.role || null;
  const component = componentById.get(candidate.componentId) || null;
  const host = component?.hostId ? componentById.get(component.hostId) : null;
  const front = candidate.frontId ? componentById.get(candidate.frontId) : null;

  let stageId = COMPONENT_ROLE_TO_STAGE[role]
    || (candidate.inspectorGroupId ? workspaceStageForControlGroup(candidate.inspectorGroupId) : null)
    || WORKSPACE_STAGES[0].id;
  let inspectorTabId = COMPONENT_ROLE_TO_INSPECTOR[role] || "general";

  if (role === "handle") {
    const hostRole = host?.role || front?.role;
    if (hostRole === "drawer_front") inspectorTabId = "drawers";
    else if (hostRole === "door") inspectorTabId = "doors";
  }

  const section = candidate.sectionId
    ? componentById.get(candidate.sectionId)
    : Number.isInteger(candidate.sectionIndex)
      ? components.find((item) => item.role === "section" && Number(item.metadata?.index) === candidate.sectionIndex)
      : getOwningSection(component, componentById);
  const sectionType = section?.metadata?.type || candidate.sectionType || null;
  const applicableTabs = getApplicableInspectorTabs(sectionType);
  if (!applicableTabs.some((tab) => tab.id === inspectorTabId)) inspectorTabId = "general";

  stageId = normalizeWorkspaceStage(stageId);
  inspectorTabId = normalizeInspectorTab(inspectorTabId);
  return Object.freeze({
    stageId,
    inspectorTabId,
    stageControlGroupIds: STAGE_CONTROL_GROUPS[stageId],
    inspectorTabGroupIds: INSPECTOR_TAB_DEFINITIONS[inspectorTabId].groups
  });
}

/**
 * Resolve an accepted layout descriptor to one semantic editing context.
 * The hit may be a component id or a viewer payload containing componentId.
 * Arbitrary hit metadata is never trusted in place of the accepted descriptor.
 */
export function resolveSelectionContext(layout, hit, source = "canvas") {
  const components = Array.isArray(layout?.components) ? layout.components : [];
  const componentById = new Map(components.map((component) => [component.id, component]));
  const component = componentById.get(getSelectionComponentId(hit));
  if (!component) return null;

  const editorId = COMPONENT_ROLE_TO_EDITOR[component.role];
  const editor = editorId ? CONTEXT_EDITOR_DEFINITIONS[editorId] : null;
  if (!editor) return null;

  const section = getOwningSection(component, componentById);
  const rawSectionIndex = Number(section?.metadata?.index);
  const sectionIndex = Number.isInteger(rawSectionIndex) ? rawSectionIndex : null;
  const host = component.hostId ? componentById.get(component.hostId) : null;
  const front = component.role === "handle" && ["door", "drawer_front"].includes(host?.role)
    ? host
    : ["door", "drawer_front"].includes(component.role)
      ? component
      : null;
  const boundaryIndex = component.role === "divider" && Number.isInteger(Number(component.metadata?.boundaryIndex))
    ? Number(component.metadata.boundaryIndex)
    : null;
  const adjacentSections = boundaryIndex === null
    ? []
    : components
      .filter((item) => item.role === "section" && [boundaryIndex - 1, boundaryIndex].includes(Number(item.metadata?.index)))
      .sort((left, right) => Number(left.metadata?.index) - Number(right.metadata?.index));
  const resolvedSectionIndex = sectionIndex ?? (boundaryIndex === null ? null : Math.max(0, boundaryIndex - 1));
  const highlightComponentId = editorId === "section" && section ? section.id : component.id;
  const hitSource = typeof hit === "object" && hit?.source ? hit.source : source;
  const controlGroupIds = editorId === "body"
    ? ["overall_size", "finish"]
    : ["door", "drawer"].includes(editorId)
      ? ["storage_fronts", "sections_layout"]
      : [editor.inspectorGroupId];
  const anchorClientX = hit?.anchorClientX !== null && hit?.anchorClientX !== undefined && Number.isFinite(Number(hit.anchorClientX))
    ? Number(hit.anchorClientX)
    : null;
  const anchorClientY = hit?.anchorClientY !== null && hit?.anchorClientY !== undefined && Number.isFinite(Number(hit.anchorClientY))
    ? Number(hit.anchorClientY)
    : null;

  const context = {
    kind: editor.kind,
    editorId,
    componentId: component.id,
    role: component.role,
    hostId: component.hostId || null,
    frontId: front?.id || null,
    sectionId: section?.id || null,
    sectionIndex: resolvedSectionIndex,
    adjacentSectionIds: Object.freeze(adjacentSections.map((item) => item.id)),
    title: getSelectionTitle(editorId, component, resolvedSectionIndex),
    inspectorGroupId: editor.inspectorGroupId,
    controlGroupIds: Object.freeze(controlGroupIds),
    controlIds: editor.controlIds,
    scope: editor.scope,
    highlightTarget: Object.freeze({
      strategy: editorId === "section" ? "section-bounds" : "component-bounds",
      componentId: highlightComponentId
    }),
    anchorComponentId: component.id,
    anchorClientX,
    anchorClientY,
    source: hitSource || null
  };
  return Object.freeze({ ...context, ...resolveWorkspaceSelection(context, layout) });
}

/** Re-resolve presentation-only selection after an accepted layout rebuild. */
export function reconcileSelectionContext(previousSelection, nextLayout) {
  if (!previousSelection) return null;
  const exact = resolveSelectionContext(nextLayout, {
    componentId: previousSelection.componentId,
    source: previousSelection.source,
    anchorClientX: previousSelection.anchorClientX,
    anchorClientY: previousSelection.anchorClientY
  }, previousSelection.source);
  if (exact) return exact;

  const components = Array.isArray(nextLayout?.components) ? nextLayout.components : [];
  let fallback = null;
  if (previousSelection.kind === "section" && Number.isInteger(previousSelection.sectionIndex)) {
    fallback = components.find((component) => (
      component.role === "section" && component.metadata?.index === previousSelection.sectionIndex
    ));
  } else if (["base", "crown", "body"].includes(previousSelection.editorId)) {
    fallback = components.find((component) => COMPONENT_ROLE_TO_EDITOR[component.role] === previousSelection.editorId);
  }
  return fallback
    ? resolveSelectionContext(nextLayout, { componentId: fallback.id, source: previousSelection.source }, previousSelection.source)
    : null;
}

export function getApplicability(config, layout) {
  const state = normalizeBookcaseConfig(config);
  const billableQuantities = deriveBillableComponents(layout);
  const generatedDoorCount = billableQuantities.hingedDoorLeaves;
  const generatedDrawerCount = billableQuantities.generatedDrawerFronts;
  const generatedLightCount = billableQuantities.compatibleLightingComponents;
  const hasDoors = generatedDoorCount > 0;
  const hasDrawers = generatedDrawerCount > 0;
  const hasFronts = hasDoors || hasDrawers;
  const hasBillableLighting = generatedLightCount > 0;
  return {
    hasLowerCabinets: Boolean(state.lowerCabinets),
    hasDoors,
    hasDrawers,
    hasFronts,
    showCabinetControls: Boolean(state.lowerCabinets) && (hasDoors || hasDrawers),
    showDoorControls: hasDoors,
    showDrawerCount: hasDrawers,
    showHardware: billableQuantities.hardwareUnits > 0,
    showLightingWarmth: state.lighting !== "no_lighting" && hasBillableLighting,
    hasBillableLighting,
    openingKind: state.centerOpening ? "media" : state.deskOpening ? "desk" : state.featureOpening ? "fireplace" : "none",
    generatedDoorCount,
    generatedDrawerCount,
    generatedLightCount,
    billableQuantities
  };
}

export function getInvalidDraftIssues(drafts = {}) {
  return Object.entries(EDITABLE_NUMBER_LIMITS).flatMap(([field, limits]) => {
    if (!Object.prototype.hasOwnProperty.call(drafts, field)) return [];
    const raw = String(drafts[field] ?? "").trim();
    const numeric = Number(raw);
    if (!raw) return [{ field, message: `${limits.label} is required.` }];
    if (!Number.isFinite(numeric)) return [{ field, message: `Enter a numeric ${limits.label.toLowerCase()}.` }];
    if (numeric < limits.min || numeric > limits.max) {
      return [{ field, message: `${limits.label} must be between ${limits.min} and ${limits.max}${limits.unit}.` }];
    }
    return [];
  });
}

export function validateUnifiedConfiguration(config, layout, drafts = {}, options = {}) {
  const state = normalizeBookcaseConfig(config);
  const issues = [];
  issues.push(...getInvalidDraftIssues(drafts).map((issue) => ({
    ...issue,
    inspectorGroupId: inspectorGroupForField(issue.field)
  })));
  if (state.finish === "custom_bm" && !state.customPaintColor && !state.customPaintCode) {
    issues.push({
      field: "customPaintColor",
      inspectorGroupId: "finish",
      message: "Choose a Benjamin Moore color or select a standard finish."
    });
  }
  if (layout?.validation?.valid === false) {
    const error = layout.validation.errors?.[0];
    const field = error?.field || "configuration";
    issues.push({
      field,
      inspectorGroupId: CONTROL_REGISTRY.some((entry) => entry.field === field)
        ? inspectorGroupForField(field)
        : "sections_layout",
      message: error?.message || "This combination needs attention before you continue."
    });
  }
  const requestedGroup = typeof options === "string" ? options : options?.groupId;
  const filteredIssues = requestedGroup
    ? issues.filter((issue) => issue.inspectorGroupId === normalizeInspectorGroup(requestedGroup))
    : issues;
  return { valid: filteredIssues.length === 0, issues: filteredIssues };
}

export function hasBlockingConfigurationIssue(config, layout, drafts = {}) {
  return !validateUnifiedConfiguration(config, layout, drafts).valid;
}

export function getInspectorGroupSummary(groupId, config, layout, basePresetId = "") {
  const state = normalizeBookcaseConfig(config);
  const applicability = getApplicability(state, layout);
  const group = normalizeInspectorGroup(groupId);
  if (group === "overall_size") return `${state.width} in W × ${state.height} in H × ${state.depth} in D`;
  if (group === "sections_layout") {
    const designer = getSectionDesignerState(state, layout);
    const counts = designer.sections.reduce((result, section) => {
      result[section.type] = (result[section.type] || 0) + 1;
      return result;
    }, {});
    const parts = [
      counts.lower_doors ? `${counts.lower_doors} doors` : "",
      counts.drawers ? `${counts.drawers} drawers` : "",
      counts.open ? `${counts.open} open` : "",
      counts.tall_doors ? `${counts.tall_doors} tall` : ""
    ].filter(Boolean);
    return `${getLayoutLabel(state, basePresetId)} · ${designer.sections.length} sections${parts.length ? ` · ${parts.join(" · ")}` : ""}`;
  }
  if (group === "shelves") {
    return `${formatSectionShelfPlan(getSectionDesignerState(state, layout))} · ${optionLabels.shelfThickness[state.shelfThickness]} thick`;
  }
  if (group === "storage_fronts") {
    if (!applicability.hasFronts) return state.lowerCabinets ? `${state.sections} sections · Storage fronts not generated` : "Open storage · No fronts";
    const parts = [];
    if (applicability.hasDoors) parts.push(formatGeneratedDoorStyles(applicability.billableQuantities.doorsByStyle));
    if (applicability.hasDrawers) parts.push(formatGeneratedDrawerStyles(applicability.billableQuantities.drawersByStyle));
    return `${state.sections} sections · ${parts.join(", ") || "Storage fronts"}`;
  }
  if (group === "base_crown") return `${optionLabels.baseStyle[state.baseStyle]}, ${optionLabels.crownStyle[state.crownStyle]}`;
  if (group === "finish") return getFinishLabel(state);
  if (group === "hardware") return applicability.showHardware ? optionLabels.hardware[state.hardware] : "Not applicable";
  if (group === "lighting") {
    if (state.lighting === "no_lighting") return optionLabels.lighting[state.lighting];
    if (!applicability.hasBillableLighting) return `${optionLabels.lighting[state.lighting]} selected · No compatible locations`;
    return `${optionLabels.lighting[state.lighting]}, ${optionLabels.lightingWarmth[state.lightingWarmth]} · ${applicability.generatedLightCount} generated`;
  }
  if (group === "project_service") return `${optionLabels.delivery[state.delivery]}, ${optionLabels.installation[state.installation]}`;
  return "";
}

export function createReviewGroups(config, layout, basePresetId = "") {
  const state = normalizeBookcaseConfig(config);
  const applicability = getApplicability(state, layout);
  const designer = getSectionDesignerState(state, layout);
  const doorSectionCount = designer.sections.filter((section) => ["lower_doors", "tall_doors"].includes(section.type)).length;
  const drawerSectionCount = designer.sections.filter((section) => section.type === "drawers").length;
  const hardwareType = hardwareTypeOptions.find((option) => option.value === getHardwareType(state.hardware));
  const hardwareFinish = getHardwareFinishOption(getHardwareFinish(state.hardware));
  const hardwareSchedule = layout?.validation?.valid ? deriveBookcaseBOM(layout).hardware.schedule || [] : [];
  const openingLabel = {
    media: "Media opening",
    desk: "Desk opening",
    fireplace: "Fireplace opening"
  }[applicability.openingKind];
  const groups = [
    {
      id: "layout",
      title: "Layout",
      inspectorGroupId: "sections_layout",
      items: [
        { label: "Design", value: getLayoutLabel(state, basePresetId) },
        ...(openingLabel ? [{ label: "Feature", value: openingLabel }] : [])
      ]
    },
    {
      id: "dimensions",
      title: "Dimensions",
      inspectorGroupId: "overall_size",
      items: [
        { label: "Overall size", value: `${state.width} in W × ${state.height} in H × ${state.depth} in D` },
        { label: "Shelf plan", value: formatSectionShelfPlan(designer), inspectorGroupId: "shelves" },
        { label: "Shelf thickness", value: optionLabels.shelfThickness[state.shelfThickness], inspectorGroupId: "shelves" }
      ]
    },
    {
      id: "storage",
      title: "Shelves & Cabinets",
      inspectorGroupId: "storage_fronts",
      inspectorField: doorSectionCount ? "doorStyle" : drawerSectionCount ? "drawerFrontStyle" : "doorStyle",
      items: [
        { label: "Sections", value: String(state.sections) },
        ...(doorSectionCount ? [{ label: "Door sections", value: String(doorSectionCount) }] : []),
        ...(drawerSectionCount ? [{ label: "Drawer sections", value: String(drawerSectionCount) }] : []),
        ...(!doorSectionCount && !drawerSectionCount ? [{ label: "Closed storage", value: "None" }] : []),
        ...(applicability.hasDoors ? [{ label: "Door front profile", value: formatGeneratedStyleNames(applicability.billableQuantities.doorsByStyle, optionLabels.doorStyle) }] : []),
        ...(applicability.hasDrawers ? [{ label: "Drawer front profile", value: formatGeneratedStyleNames(applicability.billableQuantities.drawersByStyle, optionLabels.drawerFrontStyle) }] : []),
        ...(applicability.hasDoors ? [{ label: "Doors", value: `${applicability.generatedDoorCount} generated · ${formatGeneratedDoorStyles(applicability.billableQuantities.doorsByStyle)}` }] : []),
        ...(applicability.hasDrawers ? [{ label: "Drawers", value: `${applicability.generatedDrawerCount} generated` }] : []),
        ...designer.sections.map((section) => ({
          label: `Section ${section.index + 1}`,
          value: `${formatSectionWidth(section.width)} in clear · ${formatSectionType(section.type, section.drawerCount)} · ${section.shelfCount} ${section.shelfCount === 1 ? "shelf" : "shelves"}`
        }))
      ]
    },
    {
      id: "construction",
      title: "Construction",
      inspectorGroupId: "base_crown",
      items: [
        { label: "Base", value: optionLabels.baseStyle[state.baseStyle] },
        { label: "Top", value: optionLabels.crownStyle[state.crownStyle] }
      ]
    },
    {
      id: "appearance",
      title: "Appearance",
      inspectorGroupId: "finish",
      items: [
        ...(state.finish === "custom_bm" && state.paintSelection ? [
          { label: "Finish", value: state.paintSelection.brand || "Benjamin Moore" },
          { label: "Color", value: [state.paintSelection.name, state.paintSelection.code].filter(Boolean).join(" ") },
          ...(state.paintSelection.collections.length ? [{ label: "Collection", value: state.paintSelection.collections.join(", ") }] : []),
          { label: "Preview", value: "Digital preview only · Confirm with an official paint sample" }
        ] : [{ label: "Finish", value: getFinishLabel(state) }]),
        ...(applicability.showHardware ? [
          { label: "Hardware type", value: hardwareType?.label || optionLabels.hardware[state.hardware], inspectorGroupId: "hardware" },
          { label: "Hardware finish", value: `${hardwareFinish?.label || optionLabels.hardware[state.hardware]} · ${applicability.billableQuantities.hardwareUnits} generated`, inspectorGroupId: "hardware" },
          ...hardwareSchedule.map((entry, index) => ({
            label: hardwareSchedule.length === 1 ? "Hardware schedule" : `Hardware schedule ${index + 1}`,
            value: formatHardwareScheduleEntry(entry),
            hardwareSchedule: entry,
            inspectorGroupId: "hardware"
          }))
        ] : []),
        {
          label: "Lighting",
          inspectorGroupId: "lighting",
          value: applicability.hasBillableLighting
            ? `${optionLabels.lighting[state.lighting]} · ${applicability.generatedLightCount} generated`
            : state.lighting === "no_lighting"
              ? optionLabels.lighting[state.lighting]
              : `${optionLabels.lighting[state.lighting]} selected · No compatible locations`
        },
        ...(applicability.showLightingWarmth ? [{ label: "Light temperature", value: `${optionLabels.lightingWarmth[state.lightingWarmth]} · ${getWarmthDescription(state.lightingWarmth)}`, inspectorGroupId: "lighting" }] : [])
      ]
    },
    {
      id: "service",
      title: "Project Service",
      inspectorGroupId: "project_service",
      items: [
        { label: "Delivery", value: optionLabels.delivery[state.delivery] },
        { label: "Installation", value: optionLabels.installation[state.installation] }
      ]
    }
  ];
  return groups;
}

function countOwnedSectionComponents(section, components, componentById) {
  const counts = {
    adjustableShelves: 0,
    fixedShelves: 0,
    doors: 0,
    drawerFronts: 0,
    handles: 0,
    lights: 0
  };
  for (const component of components) {
    if (component.id === section.id) continue;
    if (getOwningSection(component, componentById)?.id !== section.id) continue;
    if (component.role === "shelf") counts.adjustableShelves += 1;
    else if (component.role === "fixed_shelf") counts.fixedShelves += 1;
    else if (component.role === "door") counts.doors += 1;
    else if (component.role === "drawer_front") counts.drawerFronts += 1;
    else if (component.role === "handle") counts.handles += 1;
    else if (component.role === "light") counts.lights += 1;
  }
  return counts;
}

function normalizeGeneratedCount(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : 0;
}

/** Render-agnostic semantic data for an accessible section thumbnail. */
export function createSectionOrganizerThumbnail(section, generated = {}) {
  const sectionType = section?.type || "open";
  const adjustableShelves = normalizeGeneratedCount(generated.adjustableShelves);
  const fixedShelves = normalizeGeneratedCount(generated.fixedShelves);
  const doors = normalizeGeneratedCount(generated.doors);
  const drawerFronts = normalizeGeneratedCount(generated.drawerFronts);
  const handles = normalizeGeneratedCount(generated.handles);
  const lights = normalizeGeneratedCount(generated.lights);
  const frontKind = drawerFronts > 0 || sectionType === "drawers"
    ? "drawers"
    : doors > 0 || FRONT_SECTION_TYPES.includes(sectionType)
      ? "doors"
      : "open";
  const featureKind = ["media", "desk", "feature"].includes(sectionType) ? sectionType : null;
  return Object.freeze({
    sectionType,
    frontKind,
    featureKind,
    shelfCount: adjustableShelves,
    fixedShelfCount: fixedShelves,
    doorLeafCount: doors,
    drawerFrontCount: drawerFronts,
    handleCount: handles,
    lightCount: lights,
    segments: Object.freeze([
      ...Array.from({ length: adjustableShelves }, () => "shelf"),
      ...Array.from({ length: fixedShelves }, () => "fixed_shelf"),
      ...Array.from({ length: doors }, () => "door"),
      ...Array.from({ length: drawerFronts }, () => "drawer_front")
    ])
  });
}

function getOrganizerWarnings(section, layout, componentById) {
  const warnings = [];
  for (const warning of layout?.validation?.warnings || []) {
    const component = warning.componentId ? componentById.get(warning.componentId) : null;
    if (component?.id === section.id || getOwningSection(component, componentById)?.id === section.id) warnings.push(warning);
  }
  for (const warning of section.warnings || []) {
    if (!warnings.includes(warning)) warnings.push(warning);
  }
  return warnings;
}

function formatSectionTypeCount(type, count) {
  const labels = {
    open: ["open section", "open sections"],
    lower_doors: ["lower-door section", "lower-door sections"],
    drawers: ["drawer section", "drawer sections"],
    tall_doors: ["tall-door section", "tall-door sections"],
    media: ["Media Feature", "Media Features"],
    desk: ["Desk Feature", "Desk Features"],
    feature: ["Fireplace Feature", "Fireplace Features"]
  };
  const [singular, plural] = labels[type] || ["generated section", "generated sections"];
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * Build the accepted section organizer model from descriptors. Counts follow
 * parent/host ownership rather than component-id naming conventions.
 */
export function createSectionOrganizerSummary(config, layout) {
  const state = normalizeBookcaseConfig(config);
  const designer = getSectionDesignerState(state, layout);
  const components = Array.isArray(layout?.components) ? layout.components : [];
  const componentById = new Map(components.map((component) => [component.id, component]));
  const typeCounts = designer.sections.reduce((counts, section) => ({
    ...counts,
    [section.type]: (counts[section.type] || 0) + 1
  }), {});
  const typeSummary = Object.entries(typeCounts).map(([type, count]) => formatSectionTypeCount(type, count));
  const items = designer.sections.map((section) => {
    const generated = countOwnedSectionComponents(section, components, componentById);
    const warnings = getOrganizerWarnings(section, layout, componentById);
    return Object.freeze({
      id: section.id,
      index: section.index,
      title: `Section ${section.index + 1}`,
      width: section.width,
      widthLabel: `${formatSectionWidth(section.width)} in clear`,
      type: section.type,
      typeLabel: formatSectionType(section.type, section.drawerCount),
      locked: section.locked,
      lockReason: section.locked ? "Preset feature sections keep their required opening geometry." : null,
      editable: section.editable,
      doorArrangement: section.doorLayout?.arrangement || null,
      generated: Object.freeze(generated),
      warnings: Object.freeze([...warnings]),
      thumbnail: createSectionOrganizerThumbnail(section, generated),
      shelvesApplyToAllOpenSections: false
    });
  });
  return Object.freeze({
    summary: `${designer.sections.length} ${designer.sections.length === 1 ? "section" : "sections"}${typeSummary.length ? ` · ${typeSummary.join(" · ")}` : ""}`,
    sectionCount: designer.sections.length,
    totalClearWidth: designer.totalClearWidth,
    totalClearWidthLabel: `${formatSectionWidth(designer.totalClearWidth)} in total clear width`,
    minimumClearWidth: designer.minimumClearWidth,
    typeCounts: Object.freeze(typeCounts),
    items: Object.freeze(items)
  });
}

export function getSectionOrganizerModel(config, layout) {
  return createSectionOrganizerSummary(config, layout);
}

export function getSectionOrganizerSummary(config, layout) {
  return createSectionOrganizerSummary(config, layout).summary;
}

function formatSectionWidth(value) {
  return Number(Number(value).toFixed(2)).toString();
}

function formatSectionShelfPlan(designer) {
  const sections = (designer?.sections || []).filter((section) => !section.locked);
  if (!sections.length) return "No adjustable shelves";
  const counts = sections.map((section) => Number(section.shelfCount) || 0);
  if (counts.every((count) => count === counts[0])) {
    return `${counts[0]} ${counts[0] === 1 ? "shelf" : "shelves"} in each editable section`;
  }
  return sections.map((section, index) => `S${Number(section.index ?? index) + 1}: ${counts[index]}`).join(" · ");
}

function formatHardwareScheduleEntry(entry) {
  const identity = [entry.brand, entry.family, entry.size, entry.finish && `${entry.finish}${entry.finishCode ? ` ${entry.finishCode}` : ""}`]
    .filter(Boolean)
    .join(" · ");
  const posture = entry.pricing?.mode === "reference_unit" && Number.isFinite(Number(entry.pricing?.amount))
    ? `$${Number(entry.pricing.amount).toFixed(2)} reference each`
    : entry.pricing?.mode === "band"
      ? entry.pricing.priceBand
      : "Price confirmed with quote";
  return `${entry.quantity} × ${identity || entry.variantId} · ${posture}`;
}

function formatSectionType(type, drawerCount) {
  return {
    open: "Open Shelves",
    lower_doors: "Lower Doors",
    drawers: `${drawerCount} Lower Drawers`,
    tall_doors: "Tall Door",
    media: "Media Feature · Locked",
    desk: "Desk Feature · Locked",
    feature: "Fireplace Feature · Locked"
  }[type] || "Generated Section";
}

export function getFinishLabel(config) {
  const state = normalizeBookcaseConfig(config);
  if (state.finish !== "custom_bm") return optionLabels.finish[state.finish] || "Paint finish";
  return [state.paintSelection?.brand || "Benjamin Moore", state.customPaintColor, state.customPaintCode].filter(Boolean).join(" · ") || optionLabels.finish.custom_bm;
}

export function getLayoutLabel(config, basePresetId = "") {
  const state = normalizeBookcaseConfig(config);
  const exact = layoutPresets.find((item) => item.id === state.layoutPreset);
  if (exact) return exact.name;
  const base = layoutPresets.find((item) => item.id === basePresetId);
  return base ? `${base.name} · Customized` : "Custom layout";
}

export function inferBasePresetId(config, fallbackId = defaultBookcaseConfig.layoutPreset) {
  const state = normalizeBookcaseConfig(config);
  const exact = layoutPresets.find((item) => item.id === state.layoutPreset);
  if (exact) return exact.id;
  const structural = layoutPresets.find((item) => item.config.layoutType === state.layoutType);
  return structural?.id || fallbackId;
}

export function getChangedConfigFields(previousConfig, nextConfig) {
  const previous = normalizeBookcaseConfig(previousConfig || defaultBookcaseConfig);
  const next = normalizeBookcaseConfig(nextConfig || defaultBookcaseConfig);
  return PHYSICAL_CONFIG_FIELDS.filter((field) => JSON.stringify(previous[field]) !== JSON.stringify(next[field]));
}

export function configsAreEqual(left, right) {
  return getChangedConfigFields(left, right).length === 0;
}

export const ACCEPTED_DESIGN_HISTORY_LIMIT = 50;

function normalizeAcceptedDesignHistoryLimit(value) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1) return ACCEPTED_DESIGN_HISTORY_LIMIT;
  return Math.min(numeric, ACCEPTED_DESIGN_HISTORY_LIMIT);
}

function cloneAcceptedDesignSnapshot(value) {
  if (value === null || value === undefined) return null;
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function acceptedDesignSnapshotsEqual(left, right) {
  if (left === right) return true;
  if (left === null || right === null || left === undefined || right === undefined) return false;
  const leftConfig = left?.state || left?.config;
  const rightConfig = right?.state || right?.config;
  if (leftConfig && rightConfig) return configsAreEqual(leftConfig, rightConfig);
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch (error) {
    return false;
  }
}

function freezeAcceptedDesignHistory({ limit, past, present, future }) {
  return Object.freeze({
    limit: normalizeAcceptedDesignHistoryLimit(limit),
    past: Object.freeze(past),
    present,
    future: Object.freeze(future)
  });
}

/** Create bounded, presentation-only history for successful accepted designs. */
export function createAcceptedDesignHistory(initialAcceptedDesign = null, options = {}) {
  const limit = normalizeAcceptedDesignHistoryLimit(options.limit);
  return freezeAcceptedDesignHistory({
    limit,
    past: [],
    present: cloneAcceptedDesignSnapshot(initialAcceptedDesign),
    future: []
  });
}

/** Record one successful accepted transaction. Identical or rejected inputs are no-ops. */
export function commitAcceptedDesignHistory(history, nextAcceptedDesign) {
  const current = history || createAcceptedDesignHistory();
  if (nextAcceptedDesign === null || nextAcceptedDesign === undefined || nextAcceptedDesign?.accepted === false) return current;
  if (acceptedDesignSnapshotsEqual(current.present, nextAcceptedDesign)) return current;
  if (current.present === null || current.present === undefined) {
    return freezeAcceptedDesignHistory({
      limit: current.limit,
      past: [],
      present: cloneAcceptedDesignSnapshot(nextAcceptedDesign),
      future: []
    });
  }
  return freezeAcceptedDesignHistory({
    limit: current.limit,
    past: [...current.past, cloneAcceptedDesignSnapshot(current.present)].slice(-current.limit),
    present: cloneAcceptedDesignSnapshot(nextAcceptedDesign),
    future: []
  });
}

export function canUndoAcceptedDesignHistory(history) {
  return Boolean(history?.past?.length);
}

export function canRedoAcceptedDesignHistory(history) {
  return Boolean(history?.future?.length);
}

export function undoAcceptedDesignHistory(history) {
  if (!canUndoAcceptedDesignHistory(history)) return history;
  const previous = history.past[history.past.length - 1];
  return freezeAcceptedDesignHistory({
    limit: history.limit,
    past: history.past.slice(0, -1),
    present: cloneAcceptedDesignSnapshot(previous),
    future: [cloneAcceptedDesignSnapshot(history.present), ...history.future].slice(0, history.limit)
  });
}

export function redoAcceptedDesignHistory(history) {
  if (!canRedoAcceptedDesignHistory(history)) return history;
  const [next, ...remaining] = history.future;
  return freezeAcceptedDesignHistory({
    limit: history.limit,
    past: [...history.past, cloneAcceptedDesignSnapshot(history.present)].slice(-history.limit),
    present: cloneAcceptedDesignSnapshot(next),
    future: remaining
  });
}

export function createPresetTransition(config, currentBasePresetId, nextPresetId) {
  const state = normalizeBookcaseConfig(config);
  const preset = layoutPresets.find((item) => item.id === nextPresetId);
  if (!preset) {
    return { config: state, preset: null, dimensionsPreserved: false, constructionPreserved: false };
  }
  const previousPreset = layoutPresets.find((item) => item.id === currentBasePresetId);
  const dimensionsPreserved = previousPreset
    ? ["width", "height", "depth"].some((field) => state[field] !== previousPreset.config[field])
    : true;
  const constructionPreserved = previousPreset
    ? ["shelfThickness", "baseStyle", "crownStyle"].some((field) => state[field] !== previousPreset.config[field])
    : true;
  const retained = {
    constructionProfile: state.constructionProfile,
    finish: state.finish,
    customPaintColor: state.customPaintColor,
    customPaintCode: state.customPaintCode,
    customPaintHex: state.customPaintHex,
    paintSelection: state.paintSelection,
    hardware: state.hardware,
    hardwareSelections: state.hardwareSelections,
    lighting: state.lighting,
    lightingWarmth: state.lightingWarmth,
    delivery: state.delivery,
    installation: state.installation,
    ...(dimensionsPreserved ? { width: state.width, height: state.height, depth: state.depth } : {}),
    ...(constructionPreserved ? {
      shelfThickness: state.shelfThickness,
      baseStyle: state.baseStyle,
      crownStyle: state.crownStyle
    } : {})
  };
  return {
    config: normalizeBookcaseConfig({
      ...state,
      ...preset.config,
      ...retained,
      layoutPreset: preset.id
    }),
    preset,
    dimensionsPreserved,
    constructionPreserved
  };
}

export function createSavedDesignRecord(config, price, options = {}) {
  const state = normalizeBookcaseConfig(config);
  const id = options.id || createDesignId(state, price);
  const savedAt = options.savedAt || new Date().toISOString();
  return { schemaVersion: 3, id, price, config: state, savedAt };
}

export function createQuoteUrl(designId) {
  return `request-quote.html?design=${encodeURIComponent(designId)}`;
}

export function shouldRunAction(lastStartedAt, now = Date.now(), lockWindow = 700) {
  return !Number.isFinite(lastStartedAt) || now - lastStartedAt >= lockWindow;
}

function getWarmthDescription(value) {
  const numeric = Number(value);
  if (numeric === 2700) return "Warm and cozy";
  if (numeric === 3000) return "Warm white";
  return "Clean neutral white";
}

function formatGeneratedDoorStyles(styles) {
  return Object.entries(styles).map(([style, count]) => {
    const label = optionLabels.doorStyle[style] || String(style).replaceAll("_", " ");
    return `${count} ${label}`;
  }).join(" + ");
}

function formatGeneratedDrawerStyles(styles) {
  return Object.entries(styles).map(([style, count]) => {
    const label = optionLabels.drawerFrontStyle[style] || String(style).replaceAll("_", " ");
    return `${count} ${label}`;
  }).join(" + ");
}

function formatGeneratedStyleNames(styles, labels) {
  return Object.keys(styles || {}).map((style) => (
    labels[style] || String(style).replaceAll("_", " ")
  )).join(" + ");
}
