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
} from "./bookcase-config.js?v=direct-hardware-20260714a";
import { deriveBillableComponents } from "./bookcase-billable.js?v=direct-hardware-20260714a";
import { deriveBookcaseBOM } from "./bookcase-bom.js?v=direct-hardware-20260714a";
import { getSectionDesignerState } from "./bookcase-sections.js?v=direct-hardware-20260714a";

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
]);

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
  back_panel: "body",
  bottom_panel: "body",
  divider: "divider"
});

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
  if (editorId === "divider") {
    const boundaryIndex = Number(component.metadata?.boundaryIndex);
    return Number.isInteger(boundaryIndex) ? `Divider ${boundaryIndex}` : "Divider";
  }
  return "Overall Bookcase";
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

  return Object.freeze({
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
  });
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
    return `${state.shelves} per open section · ${optionLabels.shelfThickness[state.shelfThickness]} thick · Applies to all open sections`;
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
        { label: "Shelves per section", value: String(state.shelves), inspectorGroupId: "shelves" },
        { label: "Shelf thickness", value: optionLabels.shelfThickness[state.shelfThickness], inspectorGroupId: "shelves" }
      ]
    },
    {
      id: "storage",
      title: "Shelves & Cabinets",
      inspectorGroupId: "storage_fronts",
      items: [
        { label: "Sections", value: String(state.sections) },
        { label: "Lower storage", value: state.lowerCabinets ? (state.lowerStorage === "drawers" ? "Drawers" : "Doors") : "None" },
        ...(applicability.hasDoors ? [{ label: "Door front profile", value: optionLabels.doorStyle[state.doorStyle] }] : []),
        ...(applicability.hasDrawers ? [{ label: "Drawer front profile", value: optionLabels.drawerFrontStyle[state.drawerFrontStyle] }] : []),
        ...(applicability.hasDoors ? [{ label: "Doors", value: `${applicability.generatedDoorCount} generated · ${formatGeneratedDoorStyles(applicability.billableQuantities.doorsByStyle)}` }] : []),
        ...(applicability.hasDrawers ? [{ label: "Drawers", value: `${applicability.generatedDrawerCount} generated` }] : []),
        ...designer.sections.map((section) => ({
          label: `Section ${section.index + 1}`,
          value: `${formatSectionWidth(section.width)} in clear · ${formatSectionType(section.type, state.drawerCount)}`
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

function formatSectionWidth(value) {
  return Number(Number(value).toFixed(3)).toString();
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
