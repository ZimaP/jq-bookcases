import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultBookcaseConfig,
  layoutPresets,
  normalizeBookcaseConfig
} from "../bookcase-config.js";
import { generateBookcaseLayout } from "../bookcase-layout.js";
import { buildPricingContext, calculateBookcasePrice } from "../bookcase-pricing.js";
import {
  ALL_CONTROL_CATEGORIES,
  CONFIGURATOR_MODES,
  CONTROL_REGISTRY,
  GUIDED_STEPS,
  PHYSICAL_CONFIG_FIELDS,
  categoryForField,
  categoryForGuidedStep,
  configsAreEqual,
  createPresetTransition,
  createQuoteUrl,
  createReviewGroups,
  createSavedDesignRecord,
  escapeHtml,
  getApplicability,
  getCategorySummary,
  getChangedConfigFields,
  guidedStepForCategory,
  guidedStepForField,
  hasBlockingConfigurationIssue,
  inferBasePresetId,
  normalizeAllCategory,
  normalizeConfiguratorMode,
  normalizeGuidedStep,
  shouldRunAction,
  validateGuidedStep
} from "../configurator-experience.js";

const preset = (id) => layoutPresets.find((item) => item.id === id);
const layoutFor = (config) => generateBookcaseLayout(normalizeBookcaseConfig(config));

test("Guided Setup exposes the six required steps in customer order", () => {
  assert.deepEqual(GUIDED_STEPS.map((step) => step.id), [
    "dimensions", "layout", "storage", "construction", "appearance", "review"
  ]);
  assert.deepEqual(GUIDED_STEPS.map((step) => step.label), [
    "Space", "Structure", "Storage", "Construction", "Appearance", "Review"
  ]);
  assert.equal(GUIDED_STEPS.length, 6);
});

test("All Controls exposes every organized category exactly once", () => {
  assert.deepEqual(ALL_CONTROL_CATEGORIES.map((category) => category.id), [
    "dimensions", "layout", "section_designer", "storage", "construction", "doors", "finish", "hardware", "lighting", "service"
  ]);
  assert.equal(new Set(ALL_CONTROL_CATEGORIES.map((category) => category.id)).size, ALL_CONTROL_CATEGORIES.length);
});

test("missing and invalid preferences safely fall back to Guided, Space, and Dimensions", () => {
  for (const invalid of [null, "", "professional", "GUIDED", "review-mode"]) {
    assert.equal(normalizeConfiguratorMode(invalid), CONFIGURATOR_MODES.guided);
    assert.equal(normalizeGuidedStep(invalid), "dimensions");
    assert.equal(normalizeAllCategory(invalid), "dimensions");
  }
  assert.equal(normalizeConfiguratorMode("all"), "all");
  assert.equal(normalizeGuidedStep("appearance"), "appearance");
  assert.equal(normalizeAllCategory("lighting"), "lighting");
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

test("mode categories map to the correct Guided steps and fields", () => {
  const expected = {
    layout: "layout",
    dimensions: "dimensions",
    section_designer: "layout",
    storage: "storage",
    construction: "construction",
    doors: "storage",
    finish: "appearance",
    hardware: "appearance",
    lighting: "appearance",
    service: "review"
  };
  for (const [category, step] of Object.entries(expected)) assert.equal(guidedStepForCategory(category), step);
  assert.equal(categoryForGuidedStep("layout"), "section_designer");
  assert.equal(categoryForGuidedStep("appearance", "hardware"), "hardware");
  assert.equal(categoryForGuidedStep("review"), "service");
  assert.equal(guidedStepForField("customPaintColor"), "appearance");
  assert.equal(categoryForField("customPaintColor"), "finish");
  assert.equal(guidedStepForField("drawerCount"), "storage");
  assert.equal(categoryForField("drawerCount"), "storage");
  assert.equal(guidedStepForField("sections"), "layout");
  assert.equal(categoryForField("sections"), "section_designer");
  assert.equal(guidedStepForField("shelves"), "storage");
  assert.equal(guidedStepForField("shelfThickness"), "construction");
  assert.equal(guidedStepForField("doorStyle"), "storage");
});

test("the control registry maps every physical field once without UI-mode state", () => {
  const registryFields = CONTROL_REGISTRY.map((entry) => entry.field);
  assert.equal(new Set(registryFields).size, registryFields.length);
  assert.deepEqual([...registryFields].sort(), [...PHYSICAL_CONFIG_FIELDS].sort());
  assert.deepEqual([...registryFields].sort(), Object.keys(defaultBookcaseConfig).sort());
  for (const forbidden of ["mode", "guidedStep", "expandedCategory", "appearanceTab", "drafts"]) {
    assert.equal(PHYSICAL_CONFIG_FIELDS.includes(forbidden), false);
  }
});

test("dimension drafts block Dimensions and Review but not unrelated steps", () => {
  const state = normalizeBookcaseConfig(defaultBookcaseConfig);
  const layout = layoutFor(state);
  const drafts = { width: "", height: "121" };
  assert.equal(validateGuidedStep("dimensions", state, layout, drafts).valid, false);
  assert.equal(validateGuidedStep("storage", state, layout, drafts).valid, true);
  assert.equal(validateGuidedStep("review", state, layout, drafts).valid, false);
});

test("structure, storage, and construction drafts block their visible step and Review", () => {
  const state = normalizeBookcaseConfig(defaultBookcaseConfig);
  const layout = layoutFor(state);
  const cases = [
    ["layout", { sections: "" }],
    ["storage", { drawerCount: "one" }],
    ["storage", { shelves: "99" }],
    ["construction", { shelfThickness: "3" }]
  ];
  for (const [step, drafts] of cases) {
    assert.equal(validateGuidedStep(step, state, layout, drafts).valid, false);
    assert.equal(validateGuidedStep("dimensions", state, layout, drafts).valid, true);
    assert.equal(validateGuidedStep("review", state, layout, drafts).valid, false);
  }
});

test("unresolved custom paint blocks Appearance, Review, Save, and Quote actionability", () => {
  const state = normalizeBookcaseConfig({
    ...defaultBookcaseConfig,
    finish: "custom_bm",
    customPaintColor: "",
    customPaintCode: "",
    customPaintHex: ""
  });
  const layout = layoutFor(state);
  assert.equal(validateGuidedStep("appearance", state, layout).valid, false);
  assert.equal(validateGuidedStep("review", state, layout).valid, false);
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

test("review and category summaries distinguish selected lighting from generated lighting", () => {
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
  assert.match(getCategorySummary("lighting", incompatible, incompatibleLayout), /No compatible locations/);
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

test("collapsed category summaries use the same normalized configuration", () => {
  const state = normalizeBookcaseConfig({ ...defaultBookcaseConfig, width: 108, lighting: "no_lighting" });
  const layout = layoutFor(state);
  assert.match(getCategorySummary("dimensions", state, layout), /108 in W/);
  assert.match(getCategorySummary("storage", state, layout), /sections/);
  assert.equal(getCategorySummary("lighting", state, layout), "No Lights");
  assert.match(getCategorySummary("service", state, layout), /Delivery/);
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
  assert.match(getCategorySummary("layout", state, layout, "lower-cabinets"), /Customized/);
  const design = createReviewGroups(state, layout, "lower-cabinets")[0].items[0].value;
  assert.match(design, /Customized/);
});

test("review groups contain applicable physical selections and omit irrelevant ones", () => {
  const open = preset("classic-open").config;
  const openGroups = createReviewGroups(open, layoutFor(open), "classic-open");
  const openAppearance = openGroups.find((group) => group.id === "appearance");
  assert.equal(openAppearance.items.some((item) => item.label === "Hardware"), false);
  const cabinet = defaultBookcaseConfig;
  const cabinetGroups = createReviewGroups(cabinet, layoutFor(cabinet), "lower-cabinets");
  assert.equal(cabinetGroups.find((group) => group.id === "appearance").items.some((item) => item.label === "Hardware"), true);
  assert.deepEqual(cabinetGroups.map((group) => group.step), ["layout", "dimensions", "storage", "construction", "appearance", "review"]);

  const glass = preset("glass-library").config;
  const glassDoors = createReviewGroups(glass, layoutFor(glass), "glass-library")
    .find((group) => group.id === "storage")
    .items.find((item) => item.label === "Doors").value;
  assert.match(glassDoors, /8 Shaker/);
  assert.match(glassDoors, /4 Glass Frame/);
});

test("saved design records are mode-independent schema 3 physical payloads", () => {
  const state = normalizeBookcaseConfig({ ...defaultBookcaseConfig, width: 108 });
  const layout = layoutFor(state);
  const pricing = buildPricingContext(state, layout);
  const price = pricing.total;
  const options = { id: "JQ-FIXED", savedAt: "2026-07-11T20:00:00.000Z" };
  const guided = createSavedDesignRecord(state, price, options);
  const all = createSavedDesignRecord(state, price, options);
  assert.deepEqual(guided, all);
  assert.deepEqual(Object.keys(guided), ["schemaVersion", "id", "price", "config", "savedAt"]);
  assert.equal(guided.schemaVersion, 3);
  assert.equal(guided.price, calculateBookcasePrice(state, layout));
  assert.equal("mode" in guided.config, false);
  assert.equal("guidedStep" in guided.config, false);
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
});

test("identical physical configuration always has identical pricing", () => {
  const state = normalizeBookcaseConfig({ ...defaultBookcaseConfig, width: 108, finish: "silver_satin" });
  assert.equal(calculateBookcasePrice(state), calculateBookcasePrice({ ...state }));
});
