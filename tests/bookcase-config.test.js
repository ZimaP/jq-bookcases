import test from "node:test";
import assert from "node:assert/strict";

import {
  createDesignId,
  defaultBookcaseConfig,
  doorFrontStyleOptions,
  drawerFrontStyleOptions,
  getHardwareFinishOption,
  hardwareFinishOptions,
  hardwareTypeOptions,
  hardwareVariants,
  layoutPresets,
  normalizeBookcaseConfig,
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
