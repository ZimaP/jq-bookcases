import assert from "node:assert/strict";
import test from "node:test";
import {
  CONSTRUCTION_PROFILE_IDS,
  defaultBookcaseConfig,
  layoutPresets,
  normalizeBookcaseConfig
} from "../bookcase-config.js";
import { createQuotePrefill, resolveStoredLayout } from "../quote-prefill.js";
import {
  LEGACY_HARDWARE_VARIANT_IDS,
  LEGACY_VARIANT_SNAPSHOTS,
  createLegacyHardwareSelections
} from "../hardware-catalog.js";

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
  assert.deepEqual(prefill.frontProfiles, { door: null, drawer: null });
  assert.equal(prefill.hardwareSelection, null);
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
    width: 96,
    sections: 2,
    lowerCabinets: false,
    lighting: "full_package",
    layoutMetadata: { sectionRatios: [1, 1] }
  };
  const selected = createQuotePrefill(config);
  const disabled = createQuotePrefill({ ...config, lighting: "no_lighting" });

  assert.equal(selected.billableQuantities.compatibleLightingComponents, 0);
  assert.equal(selected.billableQuantities.generatedTallDoors, 4);
  assert.equal(selected.billableQuantities.doorHardwareUnits, 4);
  assert.equal(selected.options.includes("lighting"), false);
  assert.equal(selected.options.includes("hardware"), true);
  assert.equal(selected.options.includes("shelves"), false);
  assert.equal(selected.price, disabled.price);
});

test("quote lower-cabinet answer follows generated openings rather than a stale legacy flag", () => {
  const generatedStorage = createQuotePrefill({
    ...defaultBookcaseConfig,
    sections: 2,
    lowerCabinets: false,
    layoutMetadata: { sectionRatios: [1, 1], sectionTypes: ["lower_doors", "open"] }
  });
  const generatedOpen = createQuotePrefill({
    ...defaultBookcaseConfig,
    sections: 2,
    lowerCabinets: true,
    layoutMetadata: { sectionRatios: [1, 1], sectionTypes: ["open", "open"] }
  });

  assert.equal(generatedStorage.billableQuantities.generatedCabinetDoors, 2);
  assert.equal(generatedStorage.fields.lowerCabinets, "Yes");
  assert.equal(generatedOpen.billableQuantities.generatedCabinetDoors, 0);
  assert.equal(generatedOpen.fields.lowerCabinets, "No");
});

test("quote prefill separates physical front profiles and canonical hardware metadata", () => {
  const prefill = createQuotePrefill({
    ...defaultBookcaseConfig,
    sections: 2,
    doorStyle: "glass",
    drawerFrontStyle: "slim_shaker",
    hardware: "polished_nickel_pull",
    layoutMetadata: { sectionRatios: [1, 1], sectionTypes: ["lower_doors", "drawers"] }
  });

  assert.deepEqual(prefill.frontProfiles, {
    door: { id: "glass", label: "Glass Frame", count: 2 },
    drawer: { id: "slim_shaker", label: "Slim Shaker", count: 3 }
  });
  assert.deepEqual(prefill.hardwareSelection, {
    id: LEGACY_HARDWARE_VARIANT_IDS.polished_nickel_pull,
    label: "Atlas Homewares · Oskar Pull · 6 5/16 in c.c. · Polished Nickel · MPN A104-PN",
    type: "d_handle_pull",
    typeLabel: "D-Handle Pull",
    finish: "atlas-pn",
    finishLabel: "Polished Nickel",
    count: 5,
    exact: true
  });
  assert.equal(prefill.fields.doorFrontProfile, "Glass Frame");
  assert.equal(prefill.fields.drawerFrontProfile, "Slim Shaker");
  assert.equal(prefill.fields.hardwareType, "D-Handle Pull");
  assert.equal(prefill.fields.hardwareFinish, "Polished Nickel");
});

test("quote summary and hidden fields derive mixed identity from the exact schedule", () => {
  const hardwareSelections = createLegacyHardwareSelections("brass_knob");
  hardwareSelections.byHostId["section-01-lower-opening-door"] = {
    variantId: LEGACY_HARDWARE_VARIANT_IDS.matte_black_pull,
    snapshot: structuredClone(LEGACY_VARIANT_SNAPSHOTS.matte_black_pull),
    placement: {
      orientation: "vertical",
      horizontalAnchor: "right",
      verticalAnchor: "middle",
      quantityPerFront: 1
    }
  };
  const prefill = createQuotePrefill({ ...defaultBookcaseConfig, hardwareSelections });

  assert.equal(prefill.hardwareSelection.label, "Mixed exact hardware (2 variants)");
  assert.equal(prefill.hardwareSelection.count, 4);
  assert.equal(prefill.fields.hardwareType, "Mixed");
  assert.equal(prefill.fields.hardwareFinish, "Mixed");
  assert.equal(prefill.fields.hardwareVariant, "Mixed exact hardware (2 variants)");
  assert.deepEqual(
    new Set(JSON.parse(prefill.fields.hardwareSchedule).map((entry) => entry.variantId)),
    new Set([
      LEGACY_HARDWARE_VARIANT_IDS.brass_knob,
      LEGACY_HARDWARE_VARIANT_IDS.matte_black_pull
    ])
  );
});

test("quote prefill reports every generated style in a mixed door assembly", () => {
  const prefill = createQuotePrefill(preset("glass-library").config);

  assert.deepEqual(prefill.billableQuantities.doorsByStyle, { glass: 8, shaker: 8 });
  assert.deepEqual(prefill.frontProfiles.door, {
    id: "mixed",
    label: "Glass Frame (8) + Shaker (8)",
    count: 16,
    styles: [
      { id: "glass", label: "Glass Frame", count: 8 },
      { id: "shaker", label: "Shaker", count: 8 }
    ]
  });
  assert.equal(prefill.fields.doorFrontProfile, "Glass Frame (8) + Shaker (8)");
});

test("push-latch quotes contain no visible-hardware selection or form fields", () => {
  const prefill = createQuotePrefill({
    ...defaultBookcaseConfig,
    hardware: "push_latch"
  });

  assert.equal(prefill.billableQuantities.hingedDoorLeaves, 4);
  assert.equal(prefill.billableQuantities.hardwareUnits, 0);
  assert.equal(prefill.hardwareSelection, null);
  assert.equal(prefill.options.includes("hardware"), false);
  assert.equal("hardwareType" in prefill.fields, false);
  assert.equal("hardwareFinish" in prefill.fields, false);
  assert.equal("hardwareVariant" in prefill.fields, false);
});

test("quote production metadata preserves construction profile and per-section door layouts", () => {
  const config = normalizeBookcaseConfig({
    ...defaultBookcaseConfig,
    width: 48,
    sections: 2,
    constructionProfile: CONSTRUCTION_PROFILE_IDS.legacyOverlay,
    layoutMetadata: {
      sectionRatios: [1, 1],
      sectionTypes: ["lower_doors", "drawers"],
      sectionDoorLayouts: [{ arrangement: "single_hinge_right" }, null]
    }
  });
  const prefill = createQuotePrefill(config);

  assert.equal(prefill.constructionProfile, CONSTRUCTION_PROFILE_IDS.legacyOverlay);
  assert.deepEqual(prefill.layoutMetadata, config.layoutMetadata);
  assert.equal("constructionProfile" in prefill.fields, false);
  assert.equal("sectionDoorLayouts" in prefill.fields, false);
});

test("quote prefill price and options use the same valid generated pricing context", () => {
  const prefill = createQuotePrefill(defaultBookcaseConfig);

  assert.equal(prefill.billableQuantities.hingedDoorLeaves, 4);
  assert.equal(prefill.price, 14700);
  assert.equal(prefill.billableQuantities.puckLightLocations, 4);
  assert.deepEqual(prefill.options, ["lighting", "crown", "hardware", "shelves"]);
});

test("quote handoff preserves the exact hardware schedule, catalog version, and official sources", () => {
  const prefill = createQuotePrefill(defaultBookcaseConfig);

  assert.equal(prefill.hardwareCatalogVersion, "2026.07.14-mvp.1");
  assert.ok(prefill.hardwareSchedule.length > 0);
  assert.equal(prefill.hardwareSchedule.reduce((sum, entry) => sum + entry.quantity, 0), prefill.billableQuantities.hardwareUnits);
  const handedOffSchedule = JSON.parse(prefill.fields.hardwareSchedule);
  assert.equal(handedOffSchedule[0].brand, "Armac Martin");
  assert.equal(handedOffSchedule[0].family, "Queslett Cabinet Knob");
  assert.ok(handedOffSchedule[0].variantId);
  assert.ok(handedOffSchedule[0].placement);
  assert.ok(handedOffSchedule[0].modelAccuracy);
  assert.ok(handedOffSchedule[0].verifiedAt);
  assert.equal(prefill.fields.hardwareCatalogVersion, prefill.hardwareCatalogVersion);
  assert.match(prefill.fields.hardwareSourceLinks, /^https:\/\//);
  assert.ok(prefill.hardwareSchedule.every((entry) => entry.links.some((link) => /^https:\/\//.test(link.url))));
});
