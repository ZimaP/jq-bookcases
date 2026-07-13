import test from "node:test";
import assert from "node:assert/strict";

import { defaultBookcaseConfig, layoutPresets } from "../bookcase-config.js";
import { deriveBookcaseBOM, createLayoutFingerprint } from "../bookcase-bom.js";
import { generateBookcaseLayout } from "../bookcase-layout.js";
import {
  PRICING_VERSION,
  calculateBookcasePrice,
  calculateBookcasePriceBreakdown
} from "../bookcase-pricing.js";

const clone = (value) => JSON.parse(JSON.stringify(value));
const line = (breakdown, code) => breakdown.lineItems.find((item) => item.code === code);

test("default BOM quantities are derived from generated descriptors", () => {
  const layout = generateBookcaseLayout(defaultBookcaseConfig);
  const bom = deriveBookcaseBOM(layout);

  assert.equal(bom.schemaVersion, 1);
  assert.equal(bom.sections.count, layout.components.filter((component) => component.role === "section").length);
  assert.equal(bom.shelves.adjustableCount, layout.components.filter((component) => component.role === "shelf").length);
  assert.equal(bom.shelves.fixedCount, layout.components.filter((component) => component.role === "fixed_shelf").length);
  assert.equal(bom.doors.count, layout.components.filter((component) => component.role === "door").length);
  assert.equal(bom.drawers.frontCount, layout.components.filter((component) => component.role === "drawer_front").length);
  assert.equal(bom.hardware.handleCount, layout.components.filter((component) => component.role === "handle").length);
  assert.equal(bom.lighting.count, layout.components.filter((component) => component.role === "light").length);
  assert.deepEqual(
    bom.physicalComponentIds,
    layout.components
      .filter((component) => !["assembly", "section", "section_group", "opening"].includes(component.role))
      .map((component) => component.id)
  );
});

test("layout fingerprints are deterministic, serializable, and geometry-sensitive", () => {
  const first = generateBookcaseLayout(defaultBookcaseConfig);
  const second = generateBookcaseLayout(defaultBookcaseConfig);
  const restored = clone(first);
  const wider = generateBookcaseLayout({ ...defaultBookcaseConfig, width: defaultBookcaseConfig.width + 1 });

  assert.equal(createLayoutFingerprint(first), createLayoutFingerprint(second));
  assert.equal(createLayoutFingerprint(first), createLayoutFingerprint(restored));
  assert.equal(deriveBookcaseBOM(first).layoutFingerprint, createLayoutFingerprint(first));
  assert.notEqual(createLayoutFingerprint(first), createLayoutFingerprint(wider));
  assert.match(createLayoutFingerprint(first), /^jq-layout-v1-[0-9a-f]{16}$/);
});

test("invalid layouts cannot produce an accepted BOM or price", () => {
  const invalidLayout = generateBookcaseLayout({
    width: 96,
    sections: 4,
    lowerCabinets: false,
    lighting: "no_lighting",
    layoutMetadata: { sectionRatios: [0.1, 1, 1, 1] }
  });

  assert.equal(invalidLayout.validation.valid, false);
  assert.throws(() => deriveBookcaseBOM(invalidLayout), /invalid layout/i);

  const breakdown = calculateBookcasePriceBreakdown(invalidLayout.config, invalidLayout);
  assert.equal(breakdown.valid, false);
  assert.equal(breakdown.total, null);
  assert.ok(breakdown.errors.length > 0);
});

test("pricing uses applied generated section and shelf quantities", () => {
  const correctedLayout = generateBookcaseLayout({
    width: 24,
    sections: 6,
    shelves: 8,
    lowerCabinets: false,
    lighting: "no_lighting"
  });
  const breakdown = calculateBookcasePriceBreakdown(correctedLayout.config, correctedLayout);

  assert.equal(breakdown.valid, true);
  assert.equal(breakdown.pricingVersion, PRICING_VERSION);
  assert.equal(breakdown.state.sections, correctedLayout.config.sections);
  assert.equal(line(breakdown, "SECTIONS").quantity, breakdown.bom.sections.count);
  assert.equal(line(breakdown, "ADJUSTABLE_SHELVES").quantity, breakdown.bom.shelves.adjustableCount);
  assert.notEqual(line(breakdown, "SECTIONS").quantity, 6);
  assert.equal(calculateBookcasePrice(correctedLayout.config, correctedLayout), breakdown.total);
});

test("special openings and mixed storage are priced from actual generated parts", () => {
  for (const presetId of ["media-wall", "display-wall", "glass-library", "desk-niche", "feature-wall", "tall-storage"]) {
    const preset = layoutPresets.find((item) => item.id === presetId);
    const layout = generateBookcaseLayout(preset.config);
    const breakdown = calculateBookcasePriceBreakdown(preset.config, layout);

    assert.equal(breakdown.valid, true, `${presetId}: ${JSON.stringify(breakdown.errors)}`);
    assert.equal(line(breakdown, "SECTIONS").quantity, breakdown.bom.sections.count, presetId);
    assert.equal(line(breakdown, "ADJUSTABLE_SHELVES").quantity, breakdown.bom.shelves.adjustableCount, presetId);
    assert.equal(line(breakdown, "LOWER_STORAGE").quantity, breakdown.bom.openings.lowerStorageLinearIn, presetId);

    const pricedDoorCount = breakdown.lineItems
      .filter((item) => item.code.startsWith("DOOR_STYLE_"))
      .reduce((total, item) => total + item.quantity, 0);
    const pricedHandleCount = breakdown.lineItems
      .filter((item) => item.code.startsWith("HARDWARE_"))
      .reduce((total, item) => total + item.quantity, 0);
    const pricedLightCount = breakdown.lineItems
      .filter((item) => item.code.startsWith("LIGHTING_"))
      .reduce((total, item) => total + item.quantity, 0);

    assert.equal(pricedDoorCount, breakdown.bom.doors.count, presetId);
    assert.equal(pricedHandleCount, breakdown.bom.hardware.handleCount, presetId);
    assert.equal(pricedLightCount, breakdown.bom.lighting.count, presetId);
    assert.equal(breakdown.total % breakdown.roundingIncrement, 0, presetId);
  }
});

test("all preset BOMs and price breakdowns are deterministic", () => {
  const fingerprints = new Set();

  for (const preset of layoutPresets) {
    const firstLayout = generateBookcaseLayout(preset.config);
    const secondLayout = generateBookcaseLayout(preset.config);
    const first = calculateBookcasePriceBreakdown(preset.config, firstLayout);
    const second = calculateBookcasePriceBreakdown(preset.config, secondLayout);

    assert.equal(first.valid, true, preset.id);
    assert.deepEqual(first, second, preset.id);
    assert.equal(first.total, calculateBookcasePrice(preset.config, firstLayout), preset.id);
    fingerprints.add(first.bom.layoutFingerprint);
  }

  assert.equal(fingerprints.size, layoutPresets.length);
});
