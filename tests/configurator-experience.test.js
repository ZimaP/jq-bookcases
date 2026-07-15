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
  COMPONENT_ROLE_TO_EDITOR,
  CONTEXT_EDITOR_DEFINITIONS,
  CONTROL_REGISTRY,
  PHYSICAL_CONFIG_FIELDS,
  UNIFIED_CONTROL_GROUPS,
  configsAreEqual,
  createPresetTransition,
  createQuoteUrl,
  createReviewGroups,
  createSavedDesignRecord,
  escapeHtml,
  getApplicability,
  getChangedConfigFields,
  getInspectorGroupSummary,
  hasBlockingConfigurationIssue,
  inferBasePresetId,
  inspectorGroupForField,
  normalizeInspectorGroup,
  reconcileSelectionContext,
  resolveSelectionContext,
  shouldRunAction,
  validateUnifiedConfiguration
} from "../configurator-experience.js";

const preset = (id) => layoutPresets.find((item) => item.id === id);
const layoutFor = (config) => generateBookcaseLayout(normalizeBookcaseConfig(config));
const componentByRole = (layout, role, predicate = () => true) => (
  layout.components.find((component) => component.role === role && predicate(component))
);

test("the unified inspector exposes exactly the nine target groups in customer order", () => {
  assert.deepEqual(UNIFIED_CONTROL_GROUPS.map((group) => group.id), [
    "overall_size",
    "sections_layout",
    "shelves",
    "storage_fronts",
    "base_crown",
    "finish",
    "hardware",
    "lighting",
    "project_service"
  ]);
  assert.deepEqual(UNIFIED_CONTROL_GROUPS.map((group) => group.label), [
    "Overall Size",
    "Sections & Layout",
    "Shelves",
    "Storage & Fronts",
    "Base & Crown",
    "Finish",
    "Hardware",
    "Lighting",
    "Project Service"
  ]);
  assert.equal(new Set(UNIFIED_CONTROL_GROUPS.map((group) => group.id)).size, 9);
});

test("missing and invalid inspector groups safely fall back to Overall Size", () => {
  for (const invalid of [null, "", "guided", "all", "review-mode"]) {
    assert.equal(normalizeInspectorGroup(invalid), "overall_size");
  }
  assert.equal(normalizeInspectorGroup("lighting"), "lighting");
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

  const sectionContext = resolveSelectionContext(layout, { componentId: section.id, source: "canvas", anchorClientX: 120, anchorClientY: 240 });
  assert.deepEqual(
    [sectionContext.kind, sectionContext.sectionIndex, sectionContext.inspectorGroupId, sectionContext.highlightTarget.componentId],
    ["section", 0, "sections_layout", section.id]
  );
  assert.deepEqual([sectionContext.anchorClientX, sectionContext.anchorClientY, sectionContext.source], [120, 240, "canvas"]);

  const shelfContext = resolveSelectionContext(layout, shelf.id);
  assert.deepEqual([shelfContext.kind, shelfContext.sectionId, shelfContext.scope], ["shelf", section.id, "global"]);
  assert.match(shelfContext.title, /Shelf · Section 1/);

  const doorContext = resolveSelectionContext(layout, door.id);
  assert.deepEqual([doorContext.editorId, doorContext.frontId, doorContext.sectionId], ["door", door.id, section.id]);

  const hardwareContext = resolveSelectionContext(layout, handle.id);
  assert.deepEqual([hardwareContext.editorId, hardwareContext.frontId, hardwareContext.sectionId], ["hardware", door.id, section.id]);

  assert.equal(resolveSelectionContext(layout, trim.id).editorId, "base");
  assert.equal(resolveSelectionContext(layout, crown.id).editorId, "crown");
  assert.deepEqual(
    [resolveSelectionContext(layout, light.id).editorId, resolveSelectionContext(layout, light.id).sectionId],
    ["lighting", section.id]
  );
  assert.deepEqual(
    [resolveSelectionContext(layout, side.id).editorId, resolveSelectionContext(layout, side.id).inspectorGroupId],
    ["body", "overall_size"]
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
  assert.equal(drawerContext.controlIds.includes("drawerFrontStyle"), true);
  assert.equal(drawerContext.controlIds.includes("doorStyle"), false);

  const featureLayout = layoutFor(preset("media-wall").config);
  const featureGroup = componentByRole(featureLayout, "section_group");
  const featureContext = resolveSelectionContext(featureLayout, featureGroup.id);
  assert.equal(featureContext.editorId, "section");
  assert.equal(featureContext.sectionId, featureGroup.metadata.memberSectionIds[0]);
  const featureOpeningContext = resolveSelectionContext(featureLayout, "feature-opening");
  assert.equal(featureOpeningContext.sectionId, featureGroup.metadata.memberSectionIds[0]);

  const flatTopLayout = layoutFor({ ...defaultBookcaseConfig, crownStyle: "none" });
  assert.equal(resolveSelectionContext(flatTopLayout, "top-panel").editorId, "crown");

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
  const incompatible = normalizeBookcaseConfig({
    ...preset("tall-storage").config,
    sections: 2,
    lowerCabinets: false,
    lighting: "full_package",
    layoutMetadata: { sectionRatios: [1, 1] }
  });
  assert.equal(getApplicability(off, layoutFor(off)).showLightingWarmth, false);
  assert.equal(getApplicability(on, layoutFor(on)).showLightingWarmth, true);
  assert.equal(getApplicability(incompatible, layoutFor(incompatible)).showLightingWarmth, false);
});

test("review and inspector summaries distinguish selected lighting from generated lighting", () => {
  const incompatible = normalizeBookcaseConfig({
    ...preset("tall-storage").config,
    sections: 2,
    lowerCabinets: false,
    lighting: "full_package",
    layoutMetadata: { sectionRatios: [1, 1] }
  });
  const incompatibleLayout = layoutFor(incompatible);
  const appearance = createReviewGroups(incompatible, incompatibleLayout, "tall-storage")
    .find((group) => group.id === "appearance");
  assert.match(getInspectorGroupSummary("lighting", incompatible, incompatibleLayout), /No compatible locations/);
  assert.match(appearance.items.find((item) => item.label === "Lighting").value, /No compatible locations/);
  assert.equal(appearance.items.some((item) => item.label === "Light temperature"), false);

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
  assert.match(getInspectorGroupSummary("shelves", state, layout), /Applies to all open sections/);
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
  assert.equal(storage.items.find((item) => item.label === "Door front profile")?.value, "Glass Frame");
  assert.equal(storage.items.find((item) => item.label === "Drawer front profile")?.value, "Flat Panel");
  assert.match(getInspectorGroupSummary("storage_fronts", state, layout), /Glass Frame/);
  assert.match(getInspectorGroupSummary("storage_fronts", state, layout), /Flat Panel/);
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
