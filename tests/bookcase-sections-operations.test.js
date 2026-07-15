import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultBookcaseConfig,
  layoutPresets,
  normalizeBookcaseConfig
} from "../bookcase-config.js";
import { CONSTRUCTION_RULES, generateBookcaseLayout } from "../bookcase-layout.js";
import {
  addSection,
  deleteSection,
  duplicateSection,
  sectionWidthsToRatios
} from "../bookcase-sections.js";

const clone = (value) => structuredClone(value);

function customConfig(widths, sectionTypes, sectionDoorLayouts = null, extra = {}) {
  const sections = widths.length;
  const width = widths.reduce((sum, value) => sum + value, 0)
    + CONSTRUCTION_RULES.panelThickness * (sections + 1);
  return normalizeBookcaseConfig({
    ...defaultBookcaseConfig,
    ...extra,
    width,
    sections,
    layoutPreset: "custom",
    layoutType: "custom",
    layoutMetadata: {
      ...(extra.layoutMetadata || {}),
      sectionRatios: sectionWidthsToRatios(widths),
      sectionTypes,
      ...(sectionDoorLayouts ? { sectionDoorLayouts } : {})
    }
  });
}

function exactHostSelection() {
  return {
    variantId: defaultBookcaseConfig.hardwareSelections.defaultVariantId,
    snapshot: clone(defaultBookcaseConfig.hardwareSelections.defaultSnapshot),
    placement: {}
  };
}

function physicalWidth(widths) {
  return widths.reduce((sum, value) => sum + value, 0)
    + CONSTRUCTION_RULES.panelThickness * (widths.length + 1);
}

test("addSection uses the selected bay when eligible or the widest eligible bay and inserts a neutral open section", () => {
  const widths = [20, 48, 25];
  const config = customConfig(
    widths,
    ["drawers", "lower_doors", "tall_doors"],
    [null, { arrangement: "pair" }, { arrangement: "auto" }]
  );
  const layout = generateBookcaseLayout(config);
  const before = clone(config);

  const result = addSection(config, layout, 0);

  assert.equal(result.accepted, true);
  assert.equal(result.operation, "add");
  assert.equal(result.sourceSectionIndex, 1);
  assert.equal(result.insertedSectionIndex, 2);
  assert.equal(result.selectedSectionIndex, 2);
  assert.deepEqual(result.widths, [20, 23.625, 23.625, 25]);
  assert.deepEqual(result.config.layoutMetadata.sectionTypes, [
    "drawers", "lower_doors", "open", "tall_doors"
  ]);
  assert.deepEqual(result.config.layoutMetadata.sectionDoorLayouts, [
    null,
    { arrangement: "pair" },
    null,
    { arrangement: "auto" }
  ]);
  assert.equal(physicalWidth(result.widths), physicalWidth(widths));
  assert.ok(result.widths.every((width) => width >= CONSTRUCTION_RULES.minSectionClearWidth));
  assert.equal(generateBookcaseLayout(result.config).validation.valid, true);
  assert.deepEqual(config, before);
  assert.deepEqual(addSection(config, clone(layout), 0), result);

  const selected = customConfig([40, 34.75], ["open", "drawers"]);
  const selectedResult = addSection(selected, generateBookcaseLayout(selected), 1);
  assert.equal(selectedResult.accepted, true);
  assert.equal(selectedResult.sourceSectionIndex, 1);
  assert.deepEqual(selectedResult.widths, [40, 17, 17]);
});

test("duplicateSection preserves compatible door arrangements and falls back to Auto when a copied arrangement no longer fits", () => {
  const compatible = customConfig(
    [48, 21.75],
    ["lower_doors", "open"],
    [{ arrangement: "pair" }, null]
  );
  const copied = duplicateSection(compatible, generateBookcaseLayout(compatible), 0);
  assert.equal(copied.accepted, true);
  assert.deepEqual(copied.widths, [23.625, 23.625, 21.75]);
  assert.deepEqual(copied.config.layoutMetadata.sectionTypes, ["lower_doors", "lower_doors", "open"]);
  assert.deepEqual(copied.config.layoutMetadata.sectionDoorLayouts, [
    { arrangement: "pair" },
    { arrangement: "pair" },
    null
  ]);

  const incompatible = customConfig(
    [31, 38.75],
    ["lower_doors", "open"],
    [{ arrangement: "pair" }, null]
  );
  const automatic = duplicateSection(incompatible, generateBookcaseLayout(incompatible), 0);
  assert.equal(automatic.accepted, true);
  assert.deepEqual(automatic.widths, [15.125, 15.125, 38.75]);
  assert.deepEqual(automatic.config.layoutMetadata.sectionDoorLayouts, [
    { arrangement: "auto" },
    { arrangement: "auto" },
    null
  ]);
  assert.equal(generateBookcaseLayout(automatic.config).validation.valid, true);
});

test("duplicateSection copies compatible exact hardware hosts and reindexes later section hosts", () => {
  const hardwareSelections = clone(defaultBookcaseConfig.hardwareSelections);
  const sourceHost = "section-01-lower-opening-drawer-01";
  const laterHost = "section-03-lower-opening-drawer-01";
  hardwareSelections.byHostId[sourceHost] = exactHostSelection();
  hardwareSelections.byHostId[laterHost] = exactHostSelection();
  const config = customConfig(
    [48, 20, 25],
    ["drawers", "open", "drawers"],
    null,
    { hardwareSelections, drawerFrontStyle: "flat" }
  );
  const before = clone(config);

  const result = duplicateSection(config, generateBookcaseLayout(config), 0);

  assert.equal(result.accepted, true);
  assert.equal(result.operation, "duplicate");
  assert.deepEqual(result.widths, [23.625, 23.625, 20, 25]);
  assert.deepEqual(Object.keys(result.config.hardwareSelections.byHostId).sort(), [
    "section-01-lower-opening-drawer-01",
    "section-02-lower-opening-drawer-01",
    "section-04-lower-opening-drawer-01"
  ]);
  assert.deepEqual(
    result.config.hardwareSelections.byHostId["section-02-lower-opening-drawer-01"],
    result.config.hardwareSelections.byHostId["section-01-lower-opening-drawer-01"]
  );
  const nextLayout = generateBookcaseLayout(result.config);
  const exactHosts = new Set(nextLayout.components
    .filter((component) => component.role === "handle" && component.metadata.resolvedFrom === "host")
    .map((component) => component.hostId));
  assert.ok(exactHosts.has("section-01-lower-opening-drawer-01"));
  assert.ok(exactHosts.has("section-02-lower-opening-drawer-01"));
  assert.ok(exactHosts.has("section-04-lower-opening-drawer-01"));
  assert.equal(nextLayout.validation.valid, true);
  assert.equal(physicalWidth(result.widths), physicalWidth([48, 20, 25]));
  assert.deepEqual(config, before);
});

test("deleteSection removes selected metadata, chooses the narrower suitable neighbor, and shifts later exact hardware hosts", () => {
  const hardwareSelections = clone(defaultBookcaseConfig.hardwareSelections);
  const deletedHost = "section-02-lower-opening-drawer-01";
  const shiftedHost = "section-04-lower-opening-drawer-01";
  hardwareSelections.byHostId[deletedHost] = exactHostSelection();
  hardwareSelections.byHostId[shiftedHost] = exactHostSelection();
  const widths = [20, 25, 18, 29.25];
  const config = customConfig(
    widths,
    ["open", "drawers", "open", "drawers"],
    null,
    { hardwareSelections, drawerFrontStyle: "flat" }
  );
  const layout = generateBookcaseLayout(config);
  const before = clone(config);

  const result = deleteSection(config, layout, 1);

  assert.equal(result.accepted, true);
  assert.equal(result.operation, "delete");
  assert.equal(result.deletedSectionIndex, 1);
  assert.equal(result.selectedSectionIndex, 1);
  assert.equal(result.mergeDirection, "right");
  assert.deepEqual(result.widths, [20, 43.75, 29.25]);
  assert.deepEqual(result.config.layoutMetadata.sectionTypes, ["open", "open", "drawers"]);
  assert.deepEqual(Object.keys(result.config.hardwareSelections.byHostId), [
    "section-03-lower-opening-drawer-01"
  ]);
  assert.equal(physicalWidth(result.widths), physicalWidth(widths));
  assert.equal(generateBookcaseLayout(result.config).validation.valid, true);
  assert.deepEqual(config, before);

  const left = deleteSection(config, layout, 1, "left");
  assert.equal(left.accepted, true);
  assert.equal(left.mergeDirection, "left");
  assert.deepEqual(left.widths, [45.75, 18, 29.25]);
});

test("organizer operations return stable failures for invalid, bounded, narrow, and locked requests", () => {
  const twoSections = customConfig([20, 49.75], ["open", "open"]);
  const twoLayout = generateBookcaseLayout(twoSections);
  assert.equal(addSection(twoSections, twoLayout, 99).error.code, "INVALID_SECTION");
  assert.equal(duplicateSection(twoSections, twoLayout, null).error.code, "INVALID_SECTION");
  assert.equal(deleteSection(twoSections, twoLayout, "").error.code, "INVALID_SECTION");
  assert.equal(duplicateSection(twoSections, twoLayout, 0).error.code, "SECTION_TOO_NARROW_TO_SPLIT");
  assert.equal(deleteSection(twoSections, twoLayout, 0, "up").error.code, "INVALID_DELETE_DIRECTION");

  const single = customConfig([70.5], ["open"]);
  assert.equal(deleteSection(single, generateBookcaseLayout(single), 0).error.code, "MIN_SECTION_COUNT");

  const six = customConfig(
    [22.875, 22.875, 22.875, 22.875, 22.875, 22.875],
    Array.from({ length: 6 }, () => "open")
  );
  assert.equal(addSection(six, generateBookcaseLayout(six)).error.code, "MAX_SECTION_COUNT");
  assert.equal(duplicateSection(six, generateBookcaseLayout(six), 0).error.code, "MAX_SECTION_COUNT");

  const mediaPreset = layoutPresets.find((preset) => preset.id === "media-wall");
  const mediaLayout = generateBookcaseLayout(mediaPreset.config);
  assert.equal(addSection(mediaPreset.config, mediaLayout, 0).error.code, "LOCKED_SECTION");
  assert.equal(duplicateSection(mediaPreset.config, mediaLayout, 0).error.code, "LOCKED_SECTION");
  assert.equal(deleteSection(mediaPreset.config, mediaLayout, 0).error.code, "LOCKED_SECTION");
  assert.deepEqual(addSection(mediaPreset.config, mediaLayout, 0), addSection(mediaPreset.config, clone(mediaLayout), 0));
});
