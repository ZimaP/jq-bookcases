import assert from "node:assert/strict";
import test from "node:test";
import { defaultBookcaseConfig, layoutPresets } from "../bookcase-config.js";
import { createQuotePrefill, resolveStoredLayout } from "../quote-prefill.js";

const preset = (id) => layoutPresets.find((item) => item.id === id);

test("exact and customized layouts resolve to customer-facing quote choices", () => {
  assert.deepEqual(resolveStoredLayout({ layoutPreset: "media-wall", layoutType: "media_wall" }), {
    value: "media-wall",
    label: "Media Wall"
  });
  assert.deepEqual(resolveStoredLayout({ layoutPreset: "custom", layoutType: "media_wall" }), {
    value: "media-wall",
    label: "Media Wall · Customized"
  });
  assert.deepEqual(resolveStoredLayout({ layoutPreset: "custom", layoutType: "unknown" }), {
    value: "",
    label: "Custom layout"
  });
});

test("open-shelf custom paint designs prefill the complete visible quote brief", () => {
  const prefill = createQuotePrefill({
    layoutPreset: "custom",
    layoutType: "classic",
    width: 116,
    height: 96,
    depth: 15,
    lowerCabinets: false,
    shelves: 5,
    finish: "custom_bm",
    customPaintColor: "Hale Navy",
    customPaintCode: "HC-154",
    crownStyle: "slim_cap",
    lighting: "full_package",
    hardware: "matte_black_pull"
  });
  assert.deepEqual(prefill.fields, {
    room: "Living Room",
    wallWidth: '116"',
    ceilingHeight: '96"',
    bookcaseHeight: '96"',
    depth: '15"',
    lowerCabinets: "No",
    layout: "classic-open",
    paintFinish: "custom_bm",
    customBmColor: "Hale Navy HC-154",
    customPaint: "Yes",
    paintBrand: "Benjamin Moore",
    paintCode: "HC-154",
    paintName: "Hale Navy",
    paintCollection: "",
    paintPreviewHex: "",
    paintCatalogVersion: ""
  });
  assert.deepEqual(prefill.options, ["lighting", "crown", "shelves"]);
  assert.equal(prefill.customPaint, true);
  assert.equal(prefill.paintBrand, "Benjamin Moore");
  assert.equal(prefill.paintName, "Hale Navy");
  assert.equal(prefill.paintCode, "HC-154");
});

test("structured paint metadata reaches quote production fields without relying on preview hex", () => {
  const prefill = createQuotePrefill({
    ...defaultBookcaseConfig,
    finish: "custom_bm",
    paintSelection: {
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
    }
  });
  assert.deepEqual({
    brand: prefill.paintBrand,
    code: prefill.paintCode,
    name: prefill.paintName,
    collection: prefill.paintCollection,
    previewHex: prefill.paintPreviewHex,
    version: prefill.paintCatalogVersion
  }, {
    brand: "Benjamin Moore",
    code: "OC-17",
    name: "White Dove",
    collection: "Off White Collection",
    previewHex: "#f0efe6",
    version: "bm-ase-test"
  });
});

test("feature metadata preselects room and applicable project options", () => {
  const media = createQuotePrefill({
    layoutPreset: "media-wall",
    layoutType: "media_wall",
    lowerCabinets: true,
    shelves: 4,
    centerOpening: true,
    lighting: "warm_pucks",
    crownStyle: "none"
  });
  assert.equal(media.fields.room, "Media Wall");
  assert.equal(media.fields.lowerCabinets, "Yes");
  assert.deepEqual(media.options, ["lighting", "hardware", "shelves", "tv"]);

  const fireplace = createQuotePrefill({
    layoutType: "feature_wall",
    lowerCabinets: false,
    shelves: 4,
    featureOpening: true,
    lighting: "no_lighting",
    crownStyle: "classic_crown"
  });
  assert.equal(fireplace.fields.room, "Fireplace Wall");
  assert.deepEqual(fireplace.options, ["crown", "shelves", "fireplace"]);

  const library = createQuotePrefill({ layoutType: "glass_library" });
  assert.equal(library.fields.room, "Library");
});

test("quote prefill omits stale lighting when the generated design has no compatible locations", () => {
  const config = {
    ...preset("tall-storage").config,
    sections: 2,
    lowerCabinets: false,
    lighting: "full_package",
    layoutMetadata: { sectionRatios: [1, 1] }
  };
  const selected = createQuotePrefill(config);
  const disabled = createQuotePrefill({ ...config, lighting: "no_lighting" });

  assert.equal(selected.billableQuantities.compatibleLightingComponents, 0);
  assert.equal(selected.billableQuantities.generatedTallDoors, 2);
  assert.equal(selected.billableQuantities.doorHardwareUnits, 2);
  assert.equal(selected.options.includes("lighting"), false);
  assert.equal(selected.options.includes("hardware"), true);
  assert.equal(selected.price, disabled.price);
});

test("quote prefill price and options use the same valid generated pricing context", () => {
  const prefill = createQuotePrefill(defaultBookcaseConfig);

  assert.equal(prefill.price, 14800);
  assert.equal(prefill.billableQuantities.puckLightLocations, 4);
  assert.deepEqual(prefill.options, ["lighting", "crown", "hardware", "shelves"]);
});
