import test from "node:test";
import assert from "node:assert/strict";

import {
  CONSTRUCTION_PROFILE_IDS,
  DEFAULT_CONSTRUCTION_PROFILE,
  DOOR_ARRANGEMENTS,
  PUSH_LATCH_HARDWARE,
  createDesignId,
  defaultBookcaseConfig,
  doorFrontStyleOptions,
  drawerFrontStyleOptions,
  getHardwareFinishOption,
  hardwareFinishOptions,
  hardwareOptions,
  hardwareTypeOptions,
  hardwareVariants,
  layoutPresets,
  migrateLegacyConstructionConfig,
  normalizeBookcaseConfig,
  normalizeConstructionProfileValue,
  normalizeDoorArrangementValue,
  parseHardwareVariant,
  resolveHardwareVariant
} from "../bookcase-config.js";
import { generateBookcaseLayout } from "../bookcase-layout.js";

test("the product selector exposes the ten required commercial layout families", () => {
  assert.deepEqual(layoutPresets.map((preset) => preset.name), [
    "Full Bookcase",
    "Open Shelves",
    "Media Wall",
    "Library Wall",
    "Display Wall",
    "Glass Door Library",
    "Desk Center",
    "Fireplace Surround",
    "Asymmetrical Modern",
    "Tall Storage + Shelves"
  ]);
  assert.equal(new Set(layoutPresets.map((preset) => preset.id)).size, 10);
});

test("construction profiles use the current inset standard while preserving explicit legacy saves", () => {
  assert.equal(defaultBookcaseConfig.constructionProfile, CONSTRUCTION_PROFILE_IDS.inset);
  assert.equal(DEFAULT_CONSTRUCTION_PROFILE, "jq_inset_v1");
  assert.equal(normalizeConstructionProfileValue(undefined), "jq_inset_v1");
  assert.equal(normalizeConstructionProfileValue("unknown"), "jq_inset_v1");
  assert.equal(
    normalizeBookcaseConfig({
      ...defaultBookcaseConfig,
      constructionProfile: CONSTRUCTION_PROFILE_IDS.legacyOverlay
    }).constructionProfile,
    "legacy_overlay_v1"
  );
});

test("per-section door arrangements normalize to an aligned door-only schema", () => {
  assert.deepEqual(DOOR_ARRANGEMENTS, [
    "auto",
    "single_hinge_left",
    "single_hinge_right",
    "pair"
  ]);
  assert.equal(normalizeDoorArrangementValue("Single Hinge Left"), "single_hinge_left");
  assert.equal(normalizeDoorArrangementValue({ arrangement: "single-hinge-right" }), "single_hinge_right");
  assert.equal(normalizeDoorArrangementValue("unsupported"), null);

  const normalized = normalizeBookcaseConfig({
    ...defaultBookcaseConfig,
    sections: 4,
    layoutMetadata: {
      sectionRatios: [1, 1, 1, 1],
      sectionTypes: ["lower_doors", "drawers", "tall_doors", "open"],
      sectionDoorLayouts: [
        { arrangement: "single_hinge_left" },
        { arrangement: "pair" },
        "single-hinge-right",
        { arrangement: "pair" }
      ]
    }
  });

  assert.deepEqual(normalized.layoutMetadata.sectionDoorLayouts, [
    { arrangement: "single_hinge_left" },
    null,
    { arrangement: "single_hinge_right" },
    null
  ]);
});

test("legacy construction migration restores overlay and historical door arrangements", () => {
  const { constructionProfile: _profile, ...legacyDefault } = defaultBookcaseConfig;
  const migrated = migrateLegacyConstructionConfig({
    ...legacyDefault,
    sections: 3,
    tallDoors: true,
    layoutMetadata: {
      sectionRatios: [1, 1, 1],
      sectionTypes: ["tall_doors", "lower_doors", "tall_doors"]
    }
  });
  const normalized = normalizeBookcaseConfig(migrated);

  assert.equal(normalized.constructionProfile, "legacy_overlay_v1");
  assert.deepEqual(normalized.layoutMetadata.sectionDoorLayouts, [
    { arrangement: "single_hinge_left" },
    { arrangement: "pair" },
    { arrangement: "single_hinge_right" }
  ]);

  const explicitCurrent = migrateLegacyConstructionConfig(defaultBookcaseConfig);
  assert.equal(explicitCurrent.constructionProfile, "jq_inset_v1");
});

test("stale door-layout metadata reconciles deterministically when section count changes", () => {
  const normalized = normalizeBookcaseConfig({
    ...defaultBookcaseConfig,
    sections: 3,
    layoutMetadata: {
      sectionRatios: [1, 1, 1],
      sectionTypes: ["lower_doors", "lower_doors", "tall_doors"],
      sectionDoorLayouts: [{ arrangement: "unsupported" }, { arrangement: "pair" }]
    }
  });

  assert.deepEqual(normalized.layoutMetadata.sectionDoorLayouts, [
    { arrangement: "auto" },
    { arrangement: "pair" },
    { arrangement: "auto" }
  ]);
  assert.deepEqual(
    layoutPresets.find((preset) => preset.id === "media-wall").config.layoutMetadata.sectionDoorLayouts,
    [{ arrangement: "auto" }, null, null, null, { arrangement: "auto" }]
  );
});

test("door and drawer front profiles normalize independently with legacy inference", () => {
  const { drawerFrontStyle: _newField, ...legacyDefault } = defaultBookcaseConfig;

  assert.deepEqual(doorFrontStyleOptions.map((option) => option.value), ["shaker", "flat", "slim_shaker", "glass"]);
  assert.deepEqual(drawerFrontStyleOptions.map((option) => option.value), ["shaker", "flat", "slim_shaker"]);
  assert.equal(normalizeBookcaseConfig({ ...legacyDefault, doorStyle: "flat" }).drawerFrontStyle, "flat");
  assert.equal(normalizeBookcaseConfig({ ...legacyDefault, doorStyle: "slim_shaker" }).drawerFrontStyle, "slim_shaker");
  assert.equal(normalizeBookcaseConfig({ ...legacyDefault, doorStyle: "glass" }).drawerFrontStyle, "shaker");
  assert.equal(normalizeBookcaseConfig({ ...legacyDefault, drawerFrontStyle: "glass" }).drawerFrontStyle, "shaker");
  assert.equal(normalizeBookcaseConfig({ ...legacyDefault, drawerFrontStyle: "unknown" }).drawerFrontStyle, "shaker");
  assert.equal(normalizeBookcaseConfig({ ...legacyDefault, doorStyle: "glass", drawerFrontStyle: "flat" }).drawerFrontStyle, "flat");

  assert.equal(layoutPresets.find((preset) => preset.id === "display-wall").config.drawerFrontStyle, "slim_shaker");
  assert.equal(layoutPresets.find((preset) => preset.id === "asymmetric-modern").config.drawerFrontStyle, "flat");
});

test("canonical hardware variants round-trip through type and finish metadata", () => {
  assert.deepEqual(hardwareTypeOptions.map((option) => option.value), ["knob", "pull"]);
  assert.deepEqual(hardwareFinishOptions.map((option) => option.label), ["Brushed Brass", "Matte Black", "Polished Nickel"]);
  assert.deepEqual(hardwareVariants.map((variant) => variant.value), [
    "brass_knob",
    "brass_pull",
    "matte_black_knob",
    "matte_black_pull",
    "polished_nickel_pull"
  ]);
  for (const variant of hardwareVariants) {
    assert.equal(parseHardwareVariant(variant.value), variant);
    assert.equal(resolveHardwareVariant({ type: variant.type, finish: variant.finish }), variant);
  }
  assert.equal(resolveHardwareVariant({ type: "knob", finish: "polished_nickel" }).value, "brass_knob");
  assert.equal(resolveHardwareVariant({ type: "pull", finish: "not-a-finish" }).value, "brass_pull");
  assert.equal(resolveHardwareVariant({ type: "invalid", finish: "matte_black" }, "matte_black_pull").value, "matte_black_pull");
  assert.equal(getHardwareFinishOption("brass").label, "Brushed Brass");
  assert.equal(parseHardwareVariant("polished_nickel_knob"), null);
});

test("push latch remains a canonical internal selection without entering the customer hardware catalog", () => {
  const normalized = normalizeBookcaseConfig({
    ...defaultBookcaseConfig,
    hardware: PUSH_LATCH_HARDWARE
  });

  assert.equal(normalized.hardware, "push_latch");
  assert.deepEqual(normalized.hardwareSelections.migrationWarnings, []);
  assert.equal(parseHardwareVariant(normalized.hardware), null);
  assert.equal(hardwareOptions.some((option) => option.value === "push_latch"), false);
  assert.equal(hardwareVariants.some((variant) => variant.value === "push_latch"), false);
});

test("every preset has a unique canonical geometry signature", () => {
  const signatures = layoutPresets.map((preset) => {
    const layout = generateBookcaseLayout(preset.config);
    assert.equal(layout.validation.valid, true, `${preset.id}: ${JSON.stringify(layout.validation.errors)}`);
    return JSON.stringify(layout.components.map((component) => [
      component.role,
      component.parentId,
      component.bounds,
      component.metadata?.kind || null,
      component.metadata?.style || null,
      component.metadata?.purpose || null
    ]));
  });
  assert.equal(new Set(signatures).size, layoutPresets.length);
});

test("asymmetrical and feature presets preserve structural metadata through UI normalization", () => {
  const asymmetric = layoutPresets.find((preset) => preset.id === "asymmetric-modern").config;
  const media = layoutPresets.find((preset) => preset.id === "media-wall").config;
  assert.deepEqual(asymmetric.layoutMetadata.sectionRatios, [0.72, 1.28, 0.9, 1.1]);
  assert.deepEqual(asymmetric.layoutMetadata.drawerSections, [1, 3]);
  assert.equal(media.layoutMetadata.specialSpan, 3);
  assert.equal(generateBookcaseLayout(media).metrics.sectionClearWidths.length, media.sections);
});

test("fireplace surround keeps its central span clear of lower cabinet doors", () => {
  const feature = layoutPresets.find((preset) => preset.id === "feature-wall").config;
  const layout = generateBookcaseLayout(feature);
  const centralIds = new Set(layout.components.find((component) => component.id === "feature-zone").metadata.memberSectionIds);
  const centralDoors = layout.components.filter(
    (component) => component.role === "door" && centralIds.has(component.parentId?.split("-lower-opening")[0])
  );
  const lowerOpenings = layout.components.filter((component) => component.metadata?.kind === "lower_cabinet");
  assert.equal(centralDoors.length, 0);
  assert.equal(lowerOpenings.length, 2);
  assert.equal(layout.validation.valid, true);
});

test("saved custom paint state keeps the selected catalog identity and approximate preview hex", () => {
  const normalized = normalizeBookcaseConfig({
    ...defaultBookcaseConfig,
    finish: "custom_bm",
    customPaintColor: " Hale Navy ",
    customPaintCode: " HC-154 ",
    customPaintHex: "#434B56"
  });
  assert.equal(normalized.customPaintColor, "Hale Navy");
  assert.equal(normalized.customPaintCode, "HC-154");
  assert.equal(normalized.customPaintHex, "#434b56");
  assert.deepEqual(normalized.paintSelection, {
    source: "benjamin-moore",
    brand: "Benjamin Moore",
    catalogId: "benjamin-moore:hc-154",
    code: "HC-154",
    name: "Hale Navy",
    collections: [],
    previewHex: "#434b56",
    previewRgb: { r: 67, g: 75, b: 86 },
    catalogVersion: "",
    sourceType: "saved-preview"
  });
});

test("structured official paint state survives normalization and standard finishes clear it", () => {
  const paintSelection = {
    source: "benjamin-moore",
    brand: "Benjamin Moore",
    catalogId: "benjamin-moore:oc-17",
    code: "OC-17",
    name: "White Dove",
    collections: ["Off White Collection"],
    previewHex: "#F0EFE6",
    previewRgb: { r: 240, g: 239, b: 230 },
    catalogVersion: "bm-ase-test",
    sourceType: "official-palette"
  };
  const custom = normalizeBookcaseConfig({ ...defaultBookcaseConfig, finish: "custom_bm", paintSelection });
  assert.deepEqual(custom.paintSelection, { ...paintSelection, previewHex: "#f0efe6" });
  assert.deepEqual([custom.customPaintColor, custom.customPaintCode, custom.customPaintHex], ["White Dove", "OC-17", "#f0efe6"]);
  const standard = normalizeBookcaseConfig({ ...custom, finish: "white_dove" });
  assert.equal(standard.paintSelection, null);
  assert.deepEqual([standard.customPaintColor, standard.customPaintCode, standard.customPaintHex], ["", "", ""]);
});

test("design identity is based on physical selections rather than preset provenance", () => {
  const price = 14850;
  const first = { ...defaultBookcaseConfig, layoutPreset: "lower-cabinets" };
  const second = { ...defaultBookcaseConfig, layoutPreset: "custom" };
  assert.equal(createDesignId(first, price), createDesignId(second, price));
});
