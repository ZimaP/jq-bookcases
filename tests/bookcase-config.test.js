import test from "node:test";
import assert from "node:assert/strict";

import {
  createDesignId,
  defaultBookcaseConfig,
  layoutPresets,
  normalizeBookcaseConfig
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
});

test("design identity is based on physical selections rather than preset provenance", () => {
  const price = 14850;
  const first = { ...defaultBookcaseConfig, layoutPreset: "lower-cabinets" };
  const second = { ...defaultBookcaseConfig, layoutPreset: "custom" };
  assert.equal(createDesignId(first, price), createDesignId(second, price));
});
