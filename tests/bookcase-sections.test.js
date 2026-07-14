import assert from "node:assert/strict";
import test from "node:test";

import {
  EDITABLE_SECTION_TYPES,
  defaultBookcaseConfig,
  layoutPresets,
  normalizeBookcaseConfig,
  normalizeSectionTypeValue
} from "../bookcase-config.js";
import { createAcceptedDesignSnapshot, evaluateBookcaseCandidate, restoreAcceptedDesignSnapshot } from "../bookcase-engine.js";
import { deriveBookcaseBOM } from "../bookcase-bom.js";
import { CONSTRUCTION_RULES, generateBookcaseLayout } from "../bookcase-layout.js";
import {
  applySectionHistorySnapshot,
  applySectionWidths,
  applyGlobalStorageSelection,
  createSectionHistorySnapshot,
  equalizeSectionWidths,
  getSectionDesignerState,
  mergeSection,
  reconcileSectionCustomization,
  resizeAdjacentSections,
  sectionWidthsToRatios,
  setSectionClearWidth,
  setSectionType,
  splitSection
} from "../bookcase-sections.js";

const clone = (value) => structuredClone(value);
const components = (layout, role) => layout.components.filter((component) => component.role === role);

function scenarioA() {
  const widths = [18, 30, 20, 24.25];
  const config = normalizeBookcaseConfig({
    ...defaultBookcaseConfig,
    width: 96,
    height: 96,
    depth: 15,
    sections: 4,
    drawerCount: 3,
    layoutPreset: "custom",
    layoutMetadata: {
      sectionRatios: sectionWidthsToRatios(widths),
      sectionTypes: ["open", "drawers", "lower_doors", "tall_doors"]
    }
  });
  return { config, widths, layout: generateBookcaseLayout(config) };
}

test("section type whitelist normalizes supported legacy aliases and rejects unknown tokens", () => {
  assert.deepEqual(EDITABLE_SECTION_TYPES, ["open", "lower_doors", "drawers", "tall_doors"]);
  assert.equal(normalizeSectionTypeValue("Open Shelves"), "open");
  assert.equal(normalizeSectionTypeValue("lower-cabinets"), "lower_doors");
  assert.equal(normalizeSectionTypeValue("lower drawers"), "drawers");
  assert.equal(normalizeSectionTypeValue("tall door"), "tall_doors");
  assert.equal(normalizeSectionTypeValue("secret_bar"), null);

  const layout = generateBookcaseLayout({
    ...defaultBookcaseConfig,
    layoutMetadata: {
      sectionRatios: [1, 1, 1, 1],
      sectionTypes: ["open_shelves", "secret_bar", "doors", "tall_door"]
    }
  });
  assert.equal(layout.validation.valid, true);
  assert.ok(layout.corrections.some((correction) => correction.code === "UNSUPPORTED_SECTION_TYPE"));
  assert.deepEqual(layout.config.layoutMetadata.sectionTypes, ["open", "lower_doors", "lower_doors", "tall_doors"]);
});

test("explicit open sections stay full-height open when global lower cabinets are enabled", () => {
  const layout = generateBookcaseLayout({
    ...defaultBookcaseConfig,
    sections: 2,
    layoutMetadata: { sectionRatios: [1, 1], sectionTypes: ["open", "lower_doors"] }
  });
  const openChildren = layout.components.filter((component) => component.id.startsWith("section-01-"));
  assert.equal(openChildren.some((component) => component.role === "opening"), false);
  assert.equal(openChildren.some((component) => component.role === "fixed_shelf"), false);
  assert.equal(openChildren.some((component) => ["door", "drawer_front"].includes(component.role)), false);
  assert.equal(openChildren.filter((component) => component.role === "shelf").length, layout.config.shelves);
});

test("canonical mixed four-bay geometry has exact widths and fitted generated fronts", () => {
  const { layout, widths } = scenarioA();
  assert.equal(layout.validation.valid, true, JSON.stringify(layout.validation.errors));
  assert.deepEqual(layout.metrics.sectionClearWidths, widths);
  assert.deepEqual(components(layout, "section").map((section) => section.metadata.type), [
    "open", "drawers", "lower_doors", "tall_doors"
  ]);
  assert.equal(components(layout, "drawer_front").length, 3);
  assert.equal(components(layout, "door").length, 3);
  assert.equal(components(layout, "fixed_shelf").filter((item) => item.metadata.purpose === "lower_separator").length, 2);
  const tallDoor = layout.components.find((component) => component.id === "section-04-tall-door");
  assert.equal(tallDoor.metadata.openingSide, "left");
});

test("width ratios reproduce exact clear-width sums and divider accumulation", () => {
  const widths = [17, 35, 17];
  const layout = generateBookcaseLayout({
    ...defaultBookcaseConfig,
    width: 72,
    sections: 3,
    layoutMetadata: { sectionRatios: sectionWidthsToRatios(widths), sectionTypes: ["lower_doors", "open", "lower_doors"] }
  });
  assert.deepEqual(layout.metrics.sectionClearWidths, widths);
  assert.equal(widths.reduce((sum, width) => sum + width, 0), 69);
  assert.equal(
    widths.reduce((sum, width) => sum + width, 0) + CONSTRUCTION_RULES.panelThickness * 2 + CONSTRUCTION_RULES.panelThickness * 2,
    72
  );
  assert.equal(layout.validation.valid, true);
  assert.equal(layout.validation.errors.length, 0);
});

test("adjacent divider resize preserves the pair and clamps boundary overshoot without mutation", () => {
  const widths = [18, 30, 20, 24.25];
  const before = clone(widths);
  const accepted = resizeAdjacentSections(widths, 1, 2.5);
  assert.deepEqual(accepted.widths, [18, 32.5, 17.5, 24.25]);
  assert.equal(accepted.widths[1] + accepted.widths[2], widths[1] + widths[2]);
  const clamped = resizeAdjacentSections(widths, 1, 8);
  assert.equal(clamped.accepted, true);
  assert.deepEqual(clamped.widths, [18, 35, 15, 24.25]);
  assert.equal(clamped.requestedDelta, 8);
  assert.equal(clamped.appliedDelta, 5);
  assert.equal(clamped.clamped, true);
  assert.deepEqual(widths, before);
});

test("numeric width editing uses the same adjacent-pair clamping as divider dragging", () => {
  const widths = [18, 30, 20, 24.25];
  const accepted = setSectionClearWidth(widths, 0, 30);
  assert.deepEqual(accepted.widths, [30, 18, 20, 24.25]);
  assert.deepEqual(accepted.affectedSections, [0, 1]);
  assert.equal(accepted.widths.reduce((sum, width) => sum + width, 0), 92.25);
  const clamped = setSectionClearWidth(widths, 0, 50);
  assert.equal(clamped.accepted, true);
  assert.equal(clamped.clamped, true);
  assert.deepEqual(clamped.widths, [33, 15, 20, 24.25]);

  const last = setSectionClearWidth(widths, 3, 30);
  assert.deepEqual(last.widths, [18, 30, 15, 29.25]);
  assert.deepEqual(last.affectedSections, [2, 3]);
});

test("split and merge account for divider thickness and restore identity", () => {
  const config = normalizeBookcaseConfig({
    ...defaultBookcaseConfig,
    width: 72,
    sections: 2,
    lowerCabinets: false,
    layoutMetadata: { sectionRatios: [1, 1], sectionTypes: ["open", "open"] }
  });
  const layout = generateBookcaseLayout(config);
  const originalWidth = layout.metrics.sectionClearWidths[0];
  const split = splitSection(config, layout, 0);
  assert.equal(split.accepted, true);
  assert.equal(split.widths[0] + split.widths[1], originalWidth - CONSTRUCTION_RULES.panelThickness);
  assert.equal(split.config.layoutMetadata.sectionTypes[0], "open");
  assert.equal(split.config.layoutMetadata.sectionTypes[1], "open");
  const splitLayout = generateBookcaseLayout(split.config);
  const merged = mergeSection(split.config, splitLayout, 0, "right");
  assert.equal(merged.accepted, true);
  assert.equal(merged.widths[0], originalWidth);
  assert.deepEqual(generateBookcaseLayout(merged.config).metrics.sectionClearWidths, layout.metrics.sectionClearWidths);
});

test("split rejects the seventh section before config normalization can discard custom widths", () => {
  const widths = [60, 15.75, 15.75, 15.75, 15.75, 15.75];
  const config = normalizeBookcaseConfig({
    ...defaultBookcaseConfig,
    width: 144,
    sections: 6,
    lowerCabinets: false,
    layoutMetadata: {
      sectionRatios: sectionWidthsToRatios(widths),
      sectionTypes: Array.from({ length: 6 }, () => "open")
    }
  });
  const layout = generateBookcaseLayout(config);
  assert.deepEqual(layout.metrics.sectionClearWidths, widths);

  const result = splitSection(config, layout, 0);

  assert.equal(result.accepted, false);
  assert.equal(result.error.code, "MAX_SECTION_COUNT");
  assert.deepEqual(result.config, config);
  assert.deepEqual(generateBookcaseLayout(result.config).metrics.sectionClearWidths, widths);
});

test("section type edits keep legacy storage flags synchronized with explicit geometry", () => {
  const openConfig = normalizeBookcaseConfig({
    ...defaultBookcaseConfig,
    sections: 2,
    lowerCabinets: false,
    tallDoors: false,
    layoutMetadata: { sectionRatios: [1, 1], sectionTypes: ["open", "open"] }
  });
  const lowerDoor = setSectionType(openConfig, 0, "lower_doors", generateBookcaseLayout(openConfig));
  assert.equal(lowerDoor.accepted, true);
  assert.equal(lowerDoor.config.lowerCabinets, true);
  assert.equal(lowerDoor.config.lowerStorage, "doors");
  assert.equal(deriveBookcaseBOM(generateBookcaseLayout(lowerDoor.config)).openings.lowerStorageCount, 1);

  const mixed = setSectionType(lowerDoor.config, 1, "drawers", generateBookcaseLayout(lowerDoor.config));
  assert.equal(mixed.config.lowerCabinets, true);
  assert.equal(mixed.config.lowerStorage, "doors");

  const allDrawers = setSectionType(mixed.config, 0, "drawers", generateBookcaseLayout(mixed.config));
  assert.equal(allDrawers.config.lowerCabinets, true);
  assert.equal(allDrawers.config.lowerStorage, "drawers");

  const tallDoor = setSectionType(openConfig, 0, "tall_doors", generateBookcaseLayout(openConfig));
  assert.equal(tallDoor.config.lowerCabinets, false);
  assert.equal(tallDoor.config.tallDoors, true);
  const restoredOpen = setSectionType(tallDoor.config, 0, "open", generateBookcaseLayout(tallDoor.config));
  assert.equal(restoredOpen.config.lowerCabinets, false);
  assert.equal(restoredOpen.config.tallDoors, false);
});

test("global storage controls rewrite explicit per-section types without erasing protected zones", () => {
  const mixedConfig = normalizeBookcaseConfig({
    ...defaultBookcaseConfig,
    sections: 4,
    lowerCabinets: true,
    lowerStorage: "doors",
    layoutMetadata: {
      sectionRatios: [1, 1, 1, 1],
      sectionTypes: ["lower_doors", "drawers", "open", "tall_doors"]
    }
  });
  const mixedLayout = generateBookcaseLayout(mixedConfig);

  const drawers = applyGlobalStorageSelection(mixedConfig, mixedLayout, { lowerStorage: "drawers" });
  assert.equal(drawers.accepted, true);
  assert.deepEqual(drawers.config.layoutMetadata.sectionTypes, ["drawers", "drawers", "open", "tall_doors"]);
  assert.equal(drawers.config.lowerCabinets, true);
  assert.equal(drawers.config.lowerStorage, "drawers");

  const off = applyGlobalStorageSelection(drawers.config, generateBookcaseLayout(drawers.config), { lowerCabinets: false });
  assert.deepEqual(off.config.layoutMetadata.sectionTypes, ["open", "open", "open", "tall_doors"]);
  assert.equal(off.config.lowerCabinets, false);
  assert.equal(generateBookcaseLayout(off.config).components.filter((component) => component.role === "drawer_front").length, 0);

  const on = applyGlobalStorageSelection(off.config, generateBookcaseLayout(off.config), { lowerCabinets: true });
  assert.deepEqual(on.config.layoutMetadata.sectionTypes, ["drawers", "drawers", "drawers", "tall_doors"]);
  assert.equal(on.config.lowerCabinets, true);
  assert.equal(on.config.lowerStorage, "drawers");
});

test("equalize and section-count reconciliation remain deterministic and buildable", () => {
  const { config, layout } = scenarioA();
  const equalized = equalizeSectionWidths(config, layout);
  assert.equal(equalized.accepted, true);
  assert.deepEqual(equalized.widths, [23.0625, 23.0625, 23.0625, 23.0625]);
  const five = reconcileSectionCustomization(defaultBookcaseConfig, 5);
  assert.equal(five.accepted, true);
  assert.deepEqual(five.widths, [18.3, 18.3, 18.3, 18.3, 18.3]);
  assert.equal(generateBookcaseLayout(five.config).validation.valid, true);
  assert.deepEqual(reconcileSectionCustomization(defaultBookcaseConfig, 5), five);
});

test("explicit section-count transitions always start equal and adjacent edits stay local", () => {
  const two = normalizeBookcaseConfig({
    ...defaultBookcaseConfig,
    width: 96,
    sections: 2,
    layoutMetadata: { sectionRatios: [1, 1], sectionTypes: ["open", "open"] }
  });
  const three = reconcileSectionCustomization(two, 3);
  assert.equal(three.accepted, true);
  assert.deepEqual(three.widths, [31, 31, 31]);
  assert.equal(three.widths.reduce((sum, width) => sum + width, 0), 93);

  const stale = normalizeBookcaseConfig({
    ...defaultBookcaseConfig,
    width: 96,
    sections: 3,
    layoutMetadata: { sectionRatios: [1, 1, 2], sectionTypes: ["open", "open", "open"] }
  });
  assert.deepEqual(generateBookcaseLayout(stale).metrics.sectionClearWidths, [23.25, 23.25, 46.5]);
  assert.deepEqual(reconcileSectionCustomization(stale, 3).widths, [31, 31, 31]);

  const edited = resizeAdjacentSections(three.widths, 0, 2);
  assert.deepEqual(edited.widths, [33, 29, 31]);
  const minimum = resizeAdjacentSections(edited.widths, 0, -100);
  assert.deepEqual(minimum.widths, [15, 47, 31]);
  assert.equal(minimum.appliedDelta, -18);
  assert.equal(minimum.clamped, true);

  let cycled = three.widths;
  for (let index = 0; index < 250; index += 1) {
    cycled = resizeAdjacentSections(cycled, 0, 0.125).widths;
    cycled = resizeAdjacentSections(cycled, 0, -0.125).widths;
  }
  assert.deepEqual(cycled, [31, 31, 31]);
  assert.equal(sectionWidthsToRatios(cycled).reduce((sum, ratio) => sum + ratio, 0), 1);
});

test("special zones are visibly locked and cannot change type, split, or merge", () => {
  const preset = layoutPresets.find((item) => item.id === "media-wall");
  const layout = generateBookcaseLayout(preset.config);
  const designer = getSectionDesignerState(preset.config, layout);
  const locked = designer.sections.find((section) => section.locked);
  assert.ok(locked);
  assert.equal(locked.type, "media");
  assert.equal(setSectionType(preset.config, locked.index, "open", layout).error.code, "LOCKED_SECTION");
  assert.equal(splitSection(preset.config, layout, locked.index).error.code, "LOCKED_SECTION");
  assert.equal(mergeSection(preset.config, layout, locked.index, "right").error.code, "LOCKED_SECTION");
});

test("section helpers are deterministic, non-mutating, and JSON-stable", () => {
  const { config, layout } = scenarioA();
  const before = clone(config);
  const first = setSectionType(config, 0, "lower_doors", layout);
  const second = setSectionType(config, 0, "lower_doors", clone(layout));
  assert.deepEqual(first, second);
  assert.deepEqual(config, before);
  assert.deepEqual(JSON.parse(JSON.stringify(first.config)), first.config);
});

test("section history restores structure without reverting later dimensions, finish, or services", () => {
  const original = normalizeBookcaseConfig({
    ...defaultBookcaseConfig,
    width: 72,
    sections: 2,
    lowerCabinets: false,
    layoutMetadata: { sectionRatios: [1, 1], sectionTypes: ["open", "open"] }
  });
  const snapshot = createSectionHistorySnapshot(original);
  const changed = setSectionType(original, 0, "lower_doors", generateBookcaseLayout(original));
  const current = normalizeBookcaseConfig({
    ...changed.config,
    width: 120,
    height: 108,
    depth: 18,
    shelves: 7,
    finish: "silver_satin",
    lighting: "no_lighting",
    installation: "no_installation",
    delivery: "priority"
  });

  const restored = applySectionHistorySnapshot(current, snapshot);

  assert.equal(restored.width, 120);
  assert.equal(restored.height, 108);
  assert.equal(restored.depth, 18);
  assert.equal(restored.shelves, 7);
  assert.equal(restored.finish, "silver_satin");
  assert.equal(restored.lighting, "no_lighting");
  assert.equal(restored.installation, "no_installation");
  assert.equal(restored.delivery, "priority");
  assert.equal(restored.layoutPreset, original.layoutPreset);
  assert.equal(restored.sections, original.sections);
  assert.equal(restored.lowerCabinets, false);
  assert.deepEqual(restored.layoutMetadata, original.layoutMetadata);
});

test("mixed accepted state keeps BOM, pricing, fingerprint, save, and restore in parity", () => {
  const { config } = scenarioA();
  const evaluation = evaluateBookcaseCandidate(config);
  assert.equal(evaluation.accepted, true);
  const bom = deriveBookcaseBOM(evaluation.layout);
  assert.equal(bom.doors.count, 3);
  assert.equal(bom.drawers.frontCount, 3);
  assert.equal(bom.hardware.handleCount, 6);
  assert.equal(evaluation.pricing.bom.layoutFingerprint, evaluation.layoutFingerprint);
  const snapshot = createAcceptedDesignSnapshot(evaluation, { savedAt: "2026-07-13T00:00:00.000Z" });
  const restored = restoreAcceptedDesignSnapshot(JSON.parse(JSON.stringify(snapshot)));
  assert.equal(restored.accepted, true);
  assert.equal(restored.layoutFingerprint, evaluation.layoutFingerprint);
  assert.deepEqual(restored.state.layoutMetadata, evaluation.state.layoutMetadata);
});

test("accepted explicit section types keep global state and generated BOM synchronized", () => {
  const evaluation = evaluateBookcaseCandidate({
    ...defaultBookcaseConfig,
    sections: 3,
    lowerCabinets: false,
    lowerStorage: "drawers",
    tallDoors: false,
    layoutMetadata: {
      sectionRatios: [1, 1, 1],
      sectionTypes: ["lower_doors", "drawers", "tall_doors"]
    }
  });

  assert.equal(evaluation.accepted, true);
  assert.equal(evaluation.state.lowerCabinets, true);
  assert.equal(evaluation.state.lowerStorage, "doors");
  assert.equal(evaluation.state.tallDoors, true);
  assert.equal(evaluation.layout.config.lowerCabinets, true);
  assert.equal(evaluation.layout.config.lowerStorage, "doors");
  assert.equal(evaluation.layout.config.tallDoors, true);
  assert.equal(evaluation.bom.openings.lowerStorageCount, 2);
  assert.equal(evaluation.bom.openings.tallStorageCount, 1);
});

test("invalid custom widths reject the candidate and preserve the last accepted artifacts", () => {
  const { config } = scenarioA();
  const accepted = evaluateBookcaseCandidate(config);
  const invalidConfig = normalizeBookcaseConfig({
    ...config,
    layoutMetadata: {
      ...config.layoutMetadata,
      sectionRatios: sectionWidthsToRatios([10, 38, 20, 24.25])
    }
  });
  const rejected = evaluateBookcaseCandidate(invalidConfig);
  assert.equal(rejected.accepted, false);
  assert.ok(rejected.errors.some((error) => error.code === "MIN_SECTION_CLEAR_WIDTH"));
  assert.equal(rejected.layout, null);
  assert.equal(rejected.bom, null);
  assert.equal(rejected.pricing, null);
  assert.equal(accepted.accepted, true);
  assert.equal(createAcceptedDesignSnapshot(accepted).layoutFingerprint, accepted.layoutFingerprint);
});

test("applying edited widths preserves accepted total clear width", () => {
  const { config, layout } = scenarioA();
  const result = setSectionClearWidth(layout.metrics.sectionClearWidths, 3, 26);
  const applied = applySectionWidths(config, layout, result.widths);
  assert.equal(applied.accepted, true);
  const nextLayout = generateBookcaseLayout(applied.config);
  assert.deepEqual(nextLayout.metrics.sectionClearWidths, result.widths);
  assert.equal(nextLayout.validation.valid, true);
});
