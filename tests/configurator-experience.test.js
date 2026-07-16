import test from "node:test";
import assert from "node:assert/strict";
import {
  CONSTRUCTION_PROFILE_IDS,
  defaultBookcaseConfig,
  layoutPresets,
  normalizeBookcaseConfig
} from "../bookcase-config.js";
import { generateBookcaseLayout } from "../bookcase-layout.js";
import { buildPricingContext, calculateBookcasePrice } from "../bookcase-pricing.js";
import {
  ACCEPTED_DESIGN_HISTORY_LIMIT,
  COMPONENT_ROLE_TO_INSPECTOR,
  COMPONENT_ROLE_TO_EDITOR,
  COMPONENT_ROLE_TO_STAGE,
  CONTEXT_EDITOR_DEFINITIONS,
  CONTROL_REGISTRY,
  INSPECTOR_TAB_DEFINITIONS,
  PHYSICAL_CONFIG_FIELDS,
  STAGE_CONTROL_GROUPS,
  UNIFIED_CONTROL_GROUPS,
  WORKSPACE_STAGES,
  canRedoAcceptedDesignHistory,
  canUndoAcceptedDesignHistory,
  commitAcceptedDesignHistory,
  configsAreEqual,
  createAcceptedDesignHistory,
  createPresetTransition,
  createQuoteUrl,
  createReviewGroups,
  createSavedDesignRecord,
  createSectionOrganizerSummary,
  createSectionOrganizerThumbnail,
  escapeHtml,
  getApplicability,
  getApplicableInspectorTabs,
  getChangedConfigFields,
  getInspectorGroupSummary,
  hasBlockingConfigurationIssue,
  inferBasePresetId,
  inspectorTabForField,
  inspectorGroupForField,
  normalizeInspectorTab,
  normalizeInspectorGroup,
  normalizeWorkspaceStage,
  redoAcceptedDesignHistory,
  reconcileSelectionContext,
  resolveSelectionContext,
  resolveWorkspaceSelection,
  shouldRunAction,
  undoAcceptedDesignHistory,
  validateUnifiedConfiguration,
  workspaceStageForControlGroup,
  workspaceStageForField
} from "../configurator-experience.js";

const preset = (id) => layoutPresets.find((item) => item.id === id);
const layoutFor = (config) => generateBookcaseLayout(normalizeBookcaseConfig(config));
const componentByRole = (layout, role, predicate = () => true) => (
  layout.components.find((component) => component.role === role && predicate(component))
);

test("the customer workspace exposes exactly eight non-linear stages in reference order", () => {
  assert.deepEqual(WORKSPACE_STAGES.map((stage) => stage.id), [
    "space",
    "layout",
    "storage",
    "base_top",
    "finish",
    "hardware",
    "lighting",
    "preview"
  ]);
  assert.deepEqual(WORKSPACE_STAGES.map((stage) => stage.label), [
    "Space",
    "Layout",
    "Storage",
    "Base & Top",
    "Finish",
    "Hardware",
    "Lighting",
    "Preview"
  ]);
  assert.equal(new Set(WORKSPACE_STAGES.map((stage) => stage.id)).size, 8);
  assert.equal(WORKSPACE_STAGES.every((stage) => stage.subtitle && stage.icon), true);
});

test("workspace stages project every legacy physical group exactly once", () => {
  assert.deepEqual(STAGE_CONTROL_GROUPS, {
    space: ["overall_size"],
    layout: ["sections_layout"],
    storage: ["shelves", "storage_fronts"],
    base_top: ["base_crown"],
    finish: ["finish"],
    hardware: ["hardware"],
    lighting: ["lighting"],
    preview: ["project_service"]
  });
  const projected = Object.values(STAGE_CONTROL_GROUPS).flat();
  assert.deepEqual(projected.sort(), UNIFIED_CONTROL_GROUPS.map((group) => group.id).sort());
  assert.equal(new Set(projected).size, 9);
});

test("missing and invalid inspector groups safely fall back to Overall Size", () => {
  for (const invalid of [null, "", "guided", "all", "review-mode"]) {
    assert.equal(normalizeInspectorGroup(invalid), "overall_size");
  }
  assert.equal(normalizeInspectorGroup("lighting"), "lighting");
});

test("workspace and selected-section navigation normalize without progression state", () => {
  for (const invalid of [null, "", "guided", "all", "overall_size"]) {
    assert.equal(normalizeWorkspaceStage(invalid), "space");
  }
  assert.equal(normalizeWorkspaceStage("preview"), "preview");
  assert.equal(normalizeInspectorTab("drawers"), "drawers");
  assert.equal(normalizeInspectorTab("not-a-tab"), "general");
});

test("selected-section tabs express front applicability and read-only back data", () => {
  assert.deepEqual(Object.keys(INSPECTOR_TAB_DEFINITIONS), [
    "general", "shelves", "doors", "drawers", "back", "lighting"
  ]);
  assert.equal(INSPECTOR_TAB_DEFINITIONS.general.always, true);
  assert.equal(INSPECTOR_TAB_DEFINITIONS.back.readOnly, true);
  assert.deepEqual(INSPECTOR_TAB_DEFINITIONS.back.groups, []);

  const openTabs = getApplicableInspectorTabs("open").map((tab) => tab.id);
  assert.equal(openTabs.includes("general"), true);
  assert.equal(openTabs.includes("doors"), false);
  assert.equal(openTabs.includes("drawers"), false);
  assert.equal(getApplicableInspectorTabs("lower_doors").some((tab) => tab.id === "doors"), true);
  assert.equal(getApplicableInspectorTabs("tall_doors").some((tab) => tab.id === "doors"), true);
  assert.equal(getApplicableInspectorTabs("drawers").some((tab) => tab.id === "drawers"), true);
  assert.equal(getApplicableInspectorTabs("drawers").some((tab) => tab.id === "doors"), false);
});

test("fields route through physical groups into workspace stages and section tabs", () => {
  assert.equal(workspaceStageForControlGroup("overall_size"), "space");
  assert.equal(workspaceStageForControlGroup("sections_layout"), "layout");
  assert.equal(workspaceStageForControlGroup("base_crown"), "base_top");
  assert.equal(workspaceStageForField("shelfThickness"), "storage");
  assert.equal(workspaceStageForField("baseStyle"), "base_top");
  assert.equal(workspaceStageForField("crownStyle"), "base_top");
  assert.equal(workspaceStageForField("hardwareSelections"), "hardware");
  assert.equal(workspaceStageForField("delivery"), "preview");
  assert.equal(inspectorTabForField("shelfThickness"), "shelves");
  assert.equal(inspectorTabForField("doorStyle"), "doors");
  assert.equal(inspectorTabForField("drawerFrontStyle"), "drawers");
  assert.equal(inspectorTabForField("lightingWarmth"), "lighting");
  assert.equal(inspectorTabForField("width"), "general");
  assert.equal(normalizeWorkspaceStage("storage"), "storage");
});

test("customer-provided text is escaped before HTML template rendering", () => {
  const payload = '<img src=x onerror="window.hacked=true"> & \'Walnut\'';
  const escaped = escapeHtml(payload);
  assert.equal(escaped, "&lt;img src=x onerror=&quot;window.hacked=true&quot;&gt; &amp; &#39;Walnut&#39;");
  assert.equal(escaped.includes("<img"), false);
});

test("customized saved designs recover their structural preset ancestry", () => {
  for (const item of layoutPresets) {
    const customized = normalizeBookcaseConfig({
      ...item.config,
      layoutPreset: "custom",
      width: item.config.width + 2
    });
    assert.equal(inferBasePresetId(customized), item.id);
  }
  assert.equal(inferBasePresetId({ layoutPreset: "custom", layoutType: "unknown" }), defaultBookcaseConfig.layoutPreset);
});

test("every physical field maps directly to one unified inspector group", () => {
  const expected = {
    width: "overall_size",
    height: "overall_size",
    depth: "overall_size",
    sections: "sections_layout",
    layoutMetadata: "sections_layout",
    shelves: "shelves",
    shelfThickness: "shelves",
    lowerStorage: "storage_fronts",
    drawerCount: "storage_fronts",
    doorStyle: "storage_fronts",
    drawerFrontStyle: "storage_fronts",
    baseStyle: "base_crown",
    crownStyle: "base_crown",
    customPaintColor: "finish",
    hardwareSelections: "hardware",
    lightingWarmth: "lighting",
    installation: "project_service"
  };
  for (const [field, group] of Object.entries(expected)) assert.equal(inspectorGroupForField(field), group);
  assert.equal(inspectorGroupForField("unknownPhysicalField"), "overall_size");
});

test("the control registry maps every physical field once without workflow navigation state", () => {
  const registryFields = CONTROL_REGISTRY.map((entry) => entry.field);
  const groupIds = new Set(UNIFIED_CONTROL_GROUPS.map((group) => group.id));
  assert.equal(new Set(registryFields).size, registryFields.length);
  assert.deepEqual([...registryFields].sort(), [...PHYSICAL_CONFIG_FIELDS].sort());
  assert.deepEqual([...registryFields].sort(), Object.keys(defaultBookcaseConfig).sort());
  for (const entry of CONTROL_REGISTRY) {
    assert.equal(groupIds.has(entry.group), true, `${entry.field} has a known inspector group`);
    assert.equal("step" in entry, false);
    assert.equal("category" in entry, false);
  }
  for (const forbidden of ["mode", "guidedStep", "expandedCategory", "selection", "contextEditorOpen", "drafts"]) {
    assert.equal(PHYSICAL_CONFIG_FIELDS.includes(forbidden), false);
  }
});

test("context editor definitions distinguish fronts, hardware, construction, lighting, and body roles", () => {
  assert.equal(COMPONENT_ROLE_TO_EDITOR.door, "door");
  assert.equal(COMPONENT_ROLE_TO_EDITOR.drawer_front, "drawer");
  assert.equal(COMPONENT_ROLE_TO_EDITOR.handle, "hardware");
  assert.equal(COMPONENT_ROLE_TO_EDITOR.light, "lighting");
  assert.equal(COMPONENT_ROLE_TO_EDITOR.side_panel, "body");
  assert.equal(COMPONENT_ROLE_TO_EDITOR.divider, "divider");
  assert.equal(CONTEXT_EDITOR_DEFINITIONS.shelves.scope, "global");
  assert.equal(CONTEXT_EDITOR_DEFINITIONS.divider.scope, "adjacent-pair");
  assert.equal(CONTEXT_EDITOR_DEFINITIONS.door.inspectorGroupId, "storage_fronts");
  assert.deepEqual(CONTEXT_EDITOR_DEFINITIONS.back, {
    id: "back",
    kind: "back",
    scope: "global",
    inspectorGroupId: "sections_layout",
    controlIds: []
  });
  assert.equal(COMPONENT_ROLE_TO_STAGE.section, "layout");
  assert.equal(COMPONENT_ROLE_TO_STAGE.shelf, "storage");
  assert.equal(COMPONENT_ROLE_TO_STAGE.base, "base_top");
  assert.equal(COMPONENT_ROLE_TO_STAGE.trim, "base_top");
  assert.equal(COMPONENT_ROLE_TO_STAGE.crown, "base_top");
  assert.equal(COMPONENT_ROLE_TO_STAGE.top_panel, "base_top");
  assert.equal(COMPONENT_ROLE_TO_STAGE.handle, "hardware");
  assert.equal(COMPONENT_ROLE_TO_STAGE.light, "lighting");
  assert.equal(COMPONENT_ROLE_TO_INSPECTOR.door, "doors");
  assert.equal(COMPONENT_ROLE_TO_INSPECTOR.drawer_front, "drawers");
  assert.equal(COMPONENT_ROLE_TO_INSPECTOR.back_panel, "back");
});

test("descriptor selection resolves semantic editors and owning sections from accepted layout data", () => {
  const layout = layoutFor(defaultBookcaseConfig);
  const section = componentByRole(layout, "section", (component) => component.metadata.index === 0);
  const shelf = componentByRole(layout, "shelf", (component) => component.parentId === section.id);
  const door = componentByRole(layout, "door", (component) => component.metadata.sectionId === section.id);
  const handle = componentByRole(layout, "handle", (component) => component.hostId === door.id);
  const trim = componentByRole(layout, "trim");
  const crown = componentByRole(layout, "crown");
  const light = componentByRole(layout, "light", (component) => component.parentId === section.id);
  const side = componentByRole(layout, "side_panel");
  const back = componentByRole(layout, "back_panel");

  const sectionContext = resolveSelectionContext(layout, { componentId: section.id, source: "canvas", anchorClientX: 120, anchorClientY: 240 });
  assert.deepEqual(
    [sectionContext.kind, sectionContext.sectionIndex, sectionContext.inspectorGroupId, sectionContext.highlightTarget.componentId],
    ["section", 0, "sections_layout", section.id]
  );
  assert.deepEqual([sectionContext.stageId, sectionContext.inspectorTabId], ["layout", "general"]);
  assert.deepEqual([sectionContext.anchorClientX, sectionContext.anchorClientY, sectionContext.source], [120, 240, "canvas"]);

  const shelfContext = resolveSelectionContext(layout, shelf.id);
  assert.deepEqual([shelfContext.kind, shelfContext.sectionId, shelfContext.scope], ["shelf", section.id, "global"]);
  assert.deepEqual([shelfContext.stageId, shelfContext.inspectorTabId], ["storage", "shelves"]);
  assert.match(shelfContext.title, /Shelf · Section 1/);

  const doorContext = resolveSelectionContext(layout, door.id);
  assert.deepEqual([doorContext.editorId, doorContext.frontId, doorContext.sectionId], ["door", door.id, section.id]);
  assert.deepEqual([doorContext.stageId, doorContext.inspectorTabId], ["storage", "doors"]);

  const hardwareContext = resolveSelectionContext(layout, handle.id);
  assert.deepEqual([hardwareContext.editorId, hardwareContext.frontId, hardwareContext.sectionId], ["hardware", door.id, section.id]);
  assert.deepEqual([hardwareContext.stageId, hardwareContext.inspectorTabId], ["hardware", "doors"]);

  const baseContext = resolveSelectionContext(layout, trim.id);
  assert.deepEqual(
    [baseContext.editorId, baseContext.inspectorGroupId, baseContext.stageId, baseContext.inspectorTabId],
    ["base", "base_crown", "base_top", "general"]
  );
  const crownContext = resolveSelectionContext(layout, crown.id);
  assert.deepEqual(
    [crownContext.editorId, crownContext.inspectorGroupId, crownContext.stageId, crownContext.inspectorTabId],
    ["crown", "base_crown", "base_top", "general"]
  );
  assert.deepEqual(
    [resolveSelectionContext(layout, light.id).editorId, resolveSelectionContext(layout, light.id).sectionId],
    ["lighting", section.id]
  );
  assert.deepEqual(
    [resolveSelectionContext(layout, light.id).stageId, resolveSelectionContext(layout, light.id).inspectorTabId],
    ["lighting", "lighting"]
  );
  assert.deepEqual(
    [resolveSelectionContext(layout, side.id).editorId, resolveSelectionContext(layout, side.id).inspectorGroupId],
    ["body", "overall_size"]
  );
  const backContext = resolveSelectionContext(layout, back.id);
  assert.deepEqual(
    [backContext.editorId, backContext.kind, backContext.title, backContext.stageId, backContext.inspectorTabId],
    ["back", "back", "Fitted Back", "layout", "back"]
  );
  assert.deepEqual(
    [backContext.inspectorGroupId, backContext.scope, backContext.controlIds],
    ["sections_layout", "global", []]
  );
  assert.equal(resolveSelectionContext(layout, "not-an-accepted-component"), null);
});

test("drawer, feature group, top-panel, and divider hits expose exact contextual ownership", () => {
  const drawerState = normalizeBookcaseConfig({
    ...defaultBookcaseConfig,
    lowerStorage: "drawers",
    layoutMetadata: {
      ...defaultBookcaseConfig.layoutMetadata,
      sectionTypes: ["drawers", "drawers", "drawers", "drawers"]
    }
  });
  const drawerLayout = layoutFor(drawerState);
  const drawer = componentByRole(drawerLayout, "drawer_front");
  const drawerContext = resolveSelectionContext(drawerLayout, drawer.id);
  assert.equal(drawerContext.editorId, "drawer");
  assert.equal(drawerContext.frontId, drawer.id);
  assert.deepEqual([drawerContext.stageId, drawerContext.inspectorTabId], ["storage", "drawers"]);
  assert.equal(drawerContext.controlIds.includes("drawerFrontStyle"), true);
  assert.equal(drawerContext.controlIds.includes("doorStyle"), false);
  const drawerHandle = componentByRole(drawerLayout, "handle", (component) => component.hostId === drawer.id);
  assert.deepEqual(
    resolveWorkspaceSelection(resolveSelectionContext(drawerLayout, drawerHandle.id), drawerLayout),
    {
      stageId: "hardware",
      inspectorTabId: "drawers",
      stageControlGroupIds: ["hardware"],
      inspectorTabGroupIds: ["storage_fronts"]
    }
  );

  const featureLayout = layoutFor(preset("media-wall").config);
  const featureGroup = componentByRole(featureLayout, "section_group");
  const featureContext = resolveSelectionContext(featureLayout, featureGroup.id);
  assert.equal(featureContext.editorId, "section");
  assert.equal(featureContext.sectionId, featureGroup.metadata.memberSectionIds[0]);
  const featureOpeningContext = resolveSelectionContext(featureLayout, "feature-opening");
  assert.equal(featureOpeningContext.sectionId, featureGroup.metadata.memberSectionIds[0]);

  const flatTopLayout = layoutFor({ ...defaultBookcaseConfig, crownStyle: "none" });
  const topPanelContext = resolveSelectionContext(flatTopLayout, "top-panel");
  assert.deepEqual(
    [topPanelContext.editorId, topPanelContext.inspectorGroupId, topPanelContext.stageId],
    ["crown", "base_crown", "base_top"]
  );

  const divider = componentByRole(drawerLayout, "divider", (component) => component.metadata.boundaryIndex === 1);
  const dividerContext = resolveSelectionContext(drawerLayout, divider.id);
  assert.deepEqual(dividerContext.adjacentSectionIds, ["section-01", "section-02"]);
  assert.deepEqual([dividerContext.kind, dividerContext.scope, dividerContext.sectionIndex], ["divider", "adjacent-pair", 0]);
});

test("selection reconciliation preserves stable targets and clears deleted topology", () => {
  const layout = layoutFor(defaultBookcaseConfig);
  const shelf = componentByRole(layout, "shelf");
  const shelfSelection = resolveSelectionContext(layout, shelf.id, "canvas");
  const reconciledShelf = reconcileSelectionContext(shelfSelection, layout);
  assert.equal(reconciledShelf?.componentId, shelf.id);
  assert.deepEqual([reconciledShelf.anchorClientX, reconciledShelf.anchorClientY], [null, null]);

  const lastSection = componentByRole(layout, "section", (component) => component.metadata.index === 3);
  const lastSectionSelection = resolveSelectionContext(layout, lastSection.id);
  const threeSectionLayout = layoutFor({
    ...defaultBookcaseConfig,
    sections: 3,
    layoutMetadata: { sectionRatios: [1, 1, 1], sectionDoorLayouts: [{ arrangement: "auto" }, { arrangement: "auto" }, { arrangement: "auto" }] }
  });
  assert.equal(reconcileSelectionContext(lastSectionSelection, threeSectionLayout), null);

  const trim = componentByRole(layout, "trim");
  const baseSelection = resolveSelectionContext(layout, trim.id);
  const plinthLayout = layoutFor({ ...defaultBookcaseConfig, baseStyle: "plinth" });
  assert.equal(reconcileSelectionContext(baseSelection, plinthLayout)?.editorId, "base");
});

test("dimension drafts block the unified design and Overall Size but not unrelated groups", () => {
  const state = normalizeBookcaseConfig(defaultBookcaseConfig);
  const layout = layoutFor(state);
  const drafts = { width: "", height: "121" };
  assert.equal(validateUnifiedConfiguration(state, layout, drafts).valid, false);
  assert.equal(validateUnifiedConfiguration(state, layout, drafts, { groupId: "overall_size" }).valid, false);
  assert.equal(validateUnifiedConfiguration(state, layout, drafts, { groupId: "shelves" }).valid, true);
});

test("numeric drafts are attributed to their visible inspector group and block global actions", () => {
  const state = normalizeBookcaseConfig(defaultBookcaseConfig);
  const layout = layoutFor(state);
  const cases = [
    ["sections_layout", { sections: "" }],
    ["storage_fronts", { drawerCount: "one" }],
    ["shelves", { shelves: "99" }],
    ["shelves", { shelfThickness: "3" }]
  ];
  for (const [groupId, drafts] of cases) {
    const groupResult = validateUnifiedConfiguration(state, layout, drafts, { groupId });
    assert.equal(groupResult.valid, false);
    assert.equal(groupResult.issues.every((issue) => issue.inspectorGroupId === groupId), true);
    assert.equal(validateUnifiedConfiguration(state, layout, drafts, { groupId: "overall_size" }).valid, true);
    assert.equal(validateUnifiedConfiguration(state, layout, drafts).valid, false);
  }
});

test("layout validation remains authoritative and is routed to Sections & Layout", () => {
  const state = normalizeBookcaseConfig(defaultBookcaseConfig);
  const layout = layoutFor(state);
  const rejectedLayout = {
    ...layout,
    validation: {
      valid: false,
      errors: [{ field: "configuration", message: "Adjacent sections are not buildable." }]
    }
  };
  const result = validateUnifiedConfiguration(state, rejectedLayout);
  assert.equal(result.valid, false);
  assert.deepEqual(result.issues[0], {
    field: "configuration",
    inspectorGroupId: "sections_layout",
    message: "Adjacent sections are not buildable."
  });
  assert.equal(validateUnifiedConfiguration(state, rejectedLayout, {}, "sections_layout").valid, false);
  assert.equal(validateUnifiedConfiguration(state, rejectedLayout, {}, { groupId: "overall_size" }).valid, true);
});

test("unresolved custom paint blocks Finish, Save, and Quote actionability", () => {
  const state = normalizeBookcaseConfig({
    ...defaultBookcaseConfig,
    finish: "custom_bm",
    customPaintColor: "",
    customPaintCode: "",
    customPaintHex: ""
  });
  const layout = layoutFor(state);
  assert.equal(validateUnifiedConfiguration(state, layout, {}, { groupId: "finish" }).valid, false);
  assert.equal(validateUnifiedConfiguration(state, layout).valid, false);
  assert.equal(validateUnifiedConfiguration(state, layout, {}, { groupId: "hardware" }).valid, true);
  assert.equal(hasBlockingConfigurationIssue(state, layout), true);
  const resolved = normalizeBookcaseConfig({ ...state, customPaintColor: "Hale Navy", customPaintCode: "HC-154", customPaintHex: "#45484d" });
  assert.equal(hasBlockingConfigurationIssue(resolved, layoutFor(resolved)), false);
});

test("open shelving hides cabinet, door, drawer, and hardware controls", () => {
  const state = preset("classic-open").config;
  const applicability = getApplicability(state, layoutFor(state));
  assert.deepEqual({
    cabinets: applicability.showCabinetControls,
    doors: applicability.showDoorControls,
    drawers: applicability.showDrawerCount,
    hardware: applicability.showHardware
  }, { cabinets: false, doors: false, drawers: false, hardware: false });
});

test("drawer layouts show drawer count and hardware while hiding door controls", () => {
  const state = normalizeBookcaseConfig({ ...defaultBookcaseConfig, lowerCabinets: true, lowerStorage: "drawers" });
  const applicability = getApplicability(state, layoutFor(state));
  assert.equal(applicability.hasDrawers, true);
  assert.equal(applicability.showDrawerCount, true);
  assert.equal(applicability.showHardware, true);
  assert.equal(applicability.showDoorControls, false);
});

test("lighting warmth is contextual to an enabled lighting package", () => {
  const off = normalizeBookcaseConfig({ ...defaultBookcaseConfig, lighting: "no_lighting" });
  const on = normalizeBookcaseConfig({ ...defaultBookcaseConfig, lighting: "shelf_accent" });
  const tallStorage = normalizeBookcaseConfig({
    ...preset("tall-storage").config,
    sections: 2,
    lowerCabinets: false,
    lighting: "full_package",
    layoutMetadata: { sectionRatios: [1, 1] }
  });
  assert.equal(getApplicability(off, layoutFor(off)).showLightingWarmth, false);
  assert.equal(getApplicability(on, layoutFor(on)).showLightingWarmth, true);
  assert.equal(getApplicability(tallStorage, layoutFor(tallStorage)).showLightingWarmth, true);
});

test("review and inspector summaries include generated tall-storage lighting", () => {
  const tallStorage = normalizeBookcaseConfig({
    ...preset("tall-storage").config,
    sections: 2,
    lowerCabinets: false,
    lighting: "full_package",
    layoutMetadata: { sectionRatios: [1, 1] }
  });
  const tallLayout = layoutFor(tallStorage);
  const appearance = createReviewGroups(tallStorage, tallLayout, "tall-storage")
    .find((group) => group.id === "appearance");
  assert.match(getInspectorGroupSummary("lighting", tallStorage, tallLayout), /8 generated/);
  assert.match(appearance.items.find((item) => item.label === "Lighting").value, /8 generated/);
  assert.equal(appearance.items.some((item) => item.label === "Light temperature"), true);

  const valid = normalizeBookcaseConfig(defaultBookcaseConfig);
  const validAppearance = createReviewGroups(valid, layoutFor(valid), "lower-cabinets")
    .find((group) => group.id === "appearance");
  assert.match(validAppearance.items.find((item) => item.label === "Lighting").value, /4 generated/);
  assert.equal(validAppearance.items.some((item) => item.label === "Light temperature"), true);
});

test("preset transitions load real defaults for untouched designs", () => {
  const base = preset("lower-cabinets");
  const next = preset("media-wall");
  const transition = createPresetTransition(base.config, base.id, next.id);
  assert.equal(transition.dimensionsPreserved, false);
  assert.equal(transition.config.width, next.config.width);
  assert.equal(transition.config.height, next.config.height);
  assert.equal(transition.config.layoutType, next.config.layoutType);
});

test("preset transitions preserve compatible measured dimensions, construction, appearance, and service", () => {
  const base = preset("lower-cabinets");
  const state = normalizeBookcaseConfig({
    ...base.config,
    width: 110,
    height: 101,
    depth: 17,
    shelfThickness: 1.5,
    baseStyle: "furniture_base",
    crownStyle: "classic_crown",
    finish: "silver_satin",
    lighting: "vertical_led",
    delivery: "priority"
  });
  const transition = createPresetTransition(state, base.id, "library-wall");
  assert.equal(transition.dimensionsPreserved, true);
  assert.equal(transition.constructionPreserved, true);
  assert.deepEqual(
    [transition.config.width, transition.config.height, transition.config.depth],
    [110, 101, 17]
  );
  assert.deepEqual(
    [transition.config.shelfThickness, transition.config.baseStyle, transition.config.crownStyle],
    [1.5, "furniture_base", "classic_crown"]
  );
  assert.equal(transition.config.finish, "silver_satin");
  assert.equal(transition.config.lighting, "vertical_led");
  assert.equal(transition.config.delivery, "priority");
});

test("collapsed inspector summaries use the same normalized configuration", () => {
  const state = normalizeBookcaseConfig({ ...defaultBookcaseConfig, width: 108, lighting: "no_lighting" });
  const layout = layoutFor(state);
  assert.match(getInspectorGroupSummary("overall_size", state, layout), /108 in W/);
  assert.match(getInspectorGroupSummary("sections_layout", state, layout), /sections/);
  assert.match(getInspectorGroupSummary("shelves", state, layout), /4 shelves in each editable section/);
  assert.equal(getInspectorGroupSummary("lighting", state, layout), "No Lights");
  assert.match(getInspectorGroupSummary("project_service", state, layout), /Delivery/);
});

test("review summary identifies media, desk, and fireplace openings", () => {
  const expectations = {
    "media-wall": "Media opening",
    "desk-niche": "Desk opening",
    "feature-wall": "Fireplace opening"
  };
  for (const [id, expected] of Object.entries(expectations)) {
    const state = preset(id).config;
    const layoutGroup = createReviewGroups(state, layoutFor(state), id).find((group) => group.id === "layout");
    assert.equal(layoutGroup.items.find((item) => item.label === "Feature")?.value, expected);
  }
});

test("modified presets are described as customized rather than untouched", () => {
  const state = normalizeBookcaseConfig({ ...preset("lower-cabinets").config, width: 110, layoutPreset: "custom" });
  const layout = layoutFor(state);
  assert.match(getInspectorGroupSummary("sections_layout", state, layout, "lower-cabinets"), /Customized/);
  const design = createReviewGroups(state, layout, "lower-cabinets")[0].items[0].value;
  assert.match(design, /Customized/);
});

test("review groups contain applicable physical selections and omit irrelevant ones", () => {
  const open = preset("classic-open").config;
  const openGroups = createReviewGroups(open, layoutFor(open), "classic-open");
  const openAppearance = openGroups.find((group) => group.id === "appearance");
  assert.equal(openAppearance.items.some((item) => item.label === "Hardware type"), false);
  const cabinet = defaultBookcaseConfig;
  const cabinetGroups = createReviewGroups(cabinet, layoutFor(cabinet), "lower-cabinets");
  const cabinetAppearance = cabinetGroups.find((group) => group.id === "appearance");
  assert.equal(cabinetAppearance.items.find((item) => item.label === "Hardware type")?.value, "Knob");
  assert.match(cabinetAppearance.items.find((item) => item.label === "Hardware finish")?.value, /^Brushed Brass · \d+ generated$/);
  assert.deepEqual(cabinetGroups.map((group) => group.inspectorGroupId), [
    "sections_layout", "overall_size", "storage_fronts", "base_crown", "finish", "project_service"
  ]);
  assert.equal(cabinetAppearance.items.find((item) => item.label === "Hardware type")?.inspectorGroupId, "hardware");
  assert.equal(cabinetAppearance.items.find((item) => item.label === "Lighting")?.inspectorGroupId, "lighting");
  assert.equal(cabinetGroups.some((group) => "step" in group), false);

  const glass = preset("glass-library").config;
  const glassDoors = createReviewGroups(glass, layoutFor(glass), "glass-library")
    .find((group) => group.id === "storage")
    .items.find((item) => item.label === "Doors").value;
  assert.match(glassDoors, /8 Shaker/);
  assert.match(glassDoors, /8 Glass Frame/);
});

test("mixed storage reviews keep door and drawer front profiles independent", () => {
  const state = normalizeBookcaseConfig({
    ...defaultBookcaseConfig,
    doorStyle: "glass",
    drawerFrontStyle: "flat",
    layoutMetadata: {
      sectionRatios: [1, 1, 1, 1],
      sectionTypes: ["lower_doors", "drawers", "open", "lower_doors"]
    }
  });
  const layout = layoutFor(state);
  const storage = createReviewGroups(state, layout, "lower-cabinets").find((group) => group.id === "storage");
  assert.equal(storage.inspectorField, "doorStyle");
  assert.equal(storage.items.find((item) => item.label === "Door sections")?.value, "2");
  assert.equal(storage.items.find((item) => item.label === "Drawer sections")?.value, "1");
  assert.equal(storage.items.some((item) => item.label === "Lower storage"), false);
  assert.equal(storage.items.find((item) => item.label === "Door front profile")?.value, "Glass Frame");
  assert.equal(storage.items.find((item) => item.label === "Drawer front profile")?.value, "Flat Panel");
  assert.match(getInspectorGroupSummary("storage_fronts", state, layout), /Glass Frame/);
  assert.match(getInspectorGroupSummary("storage_fronts", state, layout), /Flat Panel/);

  const drawerOnly = normalizeBookcaseConfig({
    ...defaultBookcaseConfig,
    layoutMetadata: {
      sectionRatios: [1, 1, 1, 1],
      sectionTypes: ["drawers", "open", "open", "open"]
    }
  });
  const drawerOnlyStorage = createReviewGroups(drawerOnly, layoutFor(drawerOnly), "lower-cabinets")
    .find((group) => group.id === "storage");
  assert.equal(drawerOnlyStorage.inspectorField, "drawerFrontStyle");
});

test("review summaries expose independent shelves, door styles, and drawer counts by section", () => {
  const state = normalizeBookcaseConfig({
    ...defaultBookcaseConfig,
    layoutMetadata: {
      sectionRatios: [1, 1, 1, 1],
      sectionTypes: ["lower_doors", "drawers", "open", "lower_doors"],
      sectionConfigs: [
        { id: "section-config-a", type: "lower_doors", shelfCount: 2, doorStyle: "glass", doorArrangement: "auto" },
        { id: "section-config-b", type: "drawers", shelfCount: 4, drawerCount: 5, drawerFrontStyle: "flat" },
        { id: "section-config-c", type: "open", shelfCount: 6 },
        { id: "section-config-d", type: "lower_doors", shelfCount: 3, doorStyle: "shaker", doorArrangement: "auto" }
      ]
    }
  });
  const layout = layoutFor(state);
  const groups = createReviewGroups(state, layout, "lower-cabinets");
  const dimensions = groups.find((group) => group.id === "dimensions");
  const storage = groups.find((group) => group.id === "storage");

  assert.match(dimensions.items.find((item) => item.label === "Shelf plan").value, /S1: 2/);
  assert.match(dimensions.items.find((item) => item.label === "Shelf plan").value, /S3: 6/);
  assert.match(storage.items.find((item) => item.label === "Door front profile").value, /Glass Frame/);
  assert.match(storage.items.find((item) => item.label === "Door front profile").value, /Shaker/);
  assert.match(storage.items.find((item) => item.label === "Drawer front profile").value, /Flat Panel/);
  assert.match(storage.items.find((item) => item.label === "Section 2").value, /5 Lower Drawers · 4 shelves/);
});

test("saved design records are presentation-independent schema 3 physical payloads", () => {
  const state = normalizeBookcaseConfig({ ...defaultBookcaseConfig, width: 108 });
  const layout = layoutFor(state);
  const pricing = buildPricingContext(state, layout);
  const price = pricing.total;
  const options = { id: "JQ-FIXED", savedAt: "2026-07-11T20:00:00.000Z" };
  const saved = createSavedDesignRecord(state, price, options);
  assert.deepEqual(Object.keys(saved), ["schemaVersion", "id", "price", "config", "savedAt"]);
  assert.equal(saved.schemaVersion, 3);
  assert.equal(saved.price, calculateBookcasePrice(state, layout));
  assert.equal(saved.config.constructionProfile, CONSTRUCTION_PROFILE_IDS.inset);
  assert.deepEqual(saved.config.layoutMetadata.sectionDoorLayouts, state.layoutMetadata.sectionDoorLayouts);
  for (const presentationKey of ["mode", "guidedStep", "allCategory", "activeInspectorGroup", "selection", "drafts"]) {
    assert.equal(presentationKey in saved.config, false);
  }
});

test("accepted-design history is bounded to fifty physical transactions", () => {
  assert.equal(ACCEPTED_DESIGN_HISTORY_LIMIT, 50);
  let history = createAcceptedDesignHistory({ revision: 0 });
  for (let revision = 1; revision <= 60; revision += 1) {
    history = commitAcceptedDesignHistory(history, { revision });
  }
  assert.equal(history.limit, 50);
  assert.equal(history.past.length, 50);
  assert.equal(history.present.revision, 60);
  assert.equal(history.past[0].revision, 10);
  assert.equal(canUndoAcceptedDesignHistory(history), true);
  assert.equal(canRedoAcceptedDesignHistory(history), false);
});

test("accepted-design undo and redo are pure, no-op safely, and clear redo on a new commit", () => {
  const initial = createAcceptedDesignHistory({ revision: 1 });
  const second = commitAcceptedDesignHistory(initial, { revision: 2 });
  const duplicate = commitAcceptedDesignHistory(second, { revision: 2 });
  const rejected = commitAcceptedDesignHistory(second, { accepted: false, revision: 3 });
  assert.equal(duplicate, second);
  assert.equal(rejected, second);
  assert.equal(undoAcceptedDesignHistory(initial), initial);
  assert.equal(redoAcceptedDesignHistory(initial), initial);

  const undone = undoAcceptedDesignHistory(second);
  assert.equal(undone.present.revision, 1);
  assert.deepEqual(undone.future.map((entry) => entry.revision), [2]);
  assert.equal(canRedoAcceptedDesignHistory(undone), true);
  const redone = redoAcceptedDesignHistory(undone);
  assert.equal(redone.present.revision, 2);
  assert.deepEqual(redone.future, []);

  const branched = commitAcceptedDesignHistory(undone, { revision: 3 });
  assert.equal(branched.present.revision, 3);
  assert.deepEqual(branched.future, []);
  assert.deepEqual(second.present, { revision: 2 }, "history inputs remain unchanged");
});

test("accepted-design history ignores presentation-only differences in the same physical state", () => {
  const state = normalizeBookcaseConfig(defaultBookcaseConfig);
  const history = createAcceptedDesignHistory({ state, selection: null });
  const unchanged = commitAcceptedDesignHistory(history, {
    state: { ...state },
    selection: { componentId: "section-01" }
  });
  assert.equal(unchanged, history);
});

test("section organizer summaries and thumbnails derive exact accepted descriptor ownership", () => {
  const state = normalizeBookcaseConfig(defaultBookcaseConfig);
  const layout = layoutFor(state);
  const organizer = createSectionOrganizerSummary(state, layout);
  assert.equal(organizer.sectionCount, state.sections);
  assert.equal(organizer.items.length, state.sections);
  assert.match(organizer.summary, /4 sections/);
  assert.deepEqual(organizer.items.map((item) => item.widthLabel), Array(4).fill("23.06 in clear"));
  assert.equal(organizer.totalClearWidthLabel, "92.25 in total clear width");
  assert.equal(organizer.items.every((item) => item.generated.adjustableShelves === state.shelves), true);
  assert.equal(organizer.items.every((item) => item.generated.doors > 0), true);
  assert.equal(organizer.items.every((item) => item.generated.handles > 0), true);
  assert.equal(organizer.items.every((item) => item.thumbnail.frontKind === "doors"), true);
  assert.equal(organizer.items.every((item) => item.shelvesApplyToAllOpenSections === false), true);
});

test("section thumbnail data is semantic and locked feature zones remain visible in summaries", () => {
  const thumbnail = createSectionOrganizerThumbnail(
    { type: "drawers" },
    { adjustableShelves: 3, fixedShelves: 1, drawerFronts: 4, handles: 4, lights: 2 }
  );
  assert.deepEqual(thumbnail, {
    sectionType: "drawers",
    frontKind: "drawers",
    featureKind: null,
    shelfCount: 3,
    fixedShelfCount: 1,
    doorLeafCount: 0,
    drawerFrontCount: 4,
    handleCount: 4,
    lightCount: 2,
    segments: ["shelf", "shelf", "shelf", "fixed_shelf", "drawer_front", "drawer_front", "drawer_front", "drawer_front"]
  });

  const featureState = preset("media-wall").config;
  const organizer = createSectionOrganizerSummary(featureState, layoutFor(featureState));
  const feature = organizer.items.find((item) => item.type === "media");
  assert.equal(feature.locked, true);
  assert.equal(feature.thumbnail.featureKind, "media");
  assert.match(organizer.summary, /Media Feature/);
});

test("quote URLs preserve the existing encoded design-id contract", () => {
  assert.equal(createQuoteUrl("JQ 42/A"), "request-quote.html?design=JQ%2042%2FA");
});

test("action locks reject duplicate Save and Quote attempts inside the lock window", () => {
  assert.equal(shouldRunAction(undefined, 1000), true);
  assert.equal(shouldRunAction(1000, 1000), false);
  assert.equal(shouldRunAction(1000, 1699), false);
  assert.equal(shouldRunAction(1000, 1700), true);
});

test("no-op presentation changes do not masquerade as physical configuration changes", () => {
  const state = normalizeBookcaseConfig(defaultBookcaseConfig);
  assert.equal(configsAreEqual(state, { ...state }), true);
  assert.deepEqual(getChangedConfigFields(state, { ...state }), []);
  assert.deepEqual(getChangedConfigFields(state, { ...state, width: state.width + 1 }), ["width"]);
  assert.deepEqual(
    getChangedConfigFields(state, { ...state, constructionProfile: CONSTRUCTION_PROFILE_IDS.legacyOverlay }),
    ["constructionProfile"]
  );
});

test("identical physical configuration always has identical pricing", () => {
  const state = normalizeBookcaseConfig({ ...defaultBookcaseConfig, width: 108, finish: "silver_satin" });
  assert.equal(calculateBookcasePrice(state), calculateBookcasePrice({ ...state }));
});
