import test from "node:test";
import assert from "node:assert/strict";

import { defaultBookcaseConfig, layoutPresets } from "../bookcase-config.js";
import { deriveBillableComponents } from "../bookcase-billable.js";
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

test("drawer profile counts flow from descriptors into BOM and billable summaries", () => {
  const layout = generateBookcaseLayout({
    ...defaultBookcaseConfig,
    lowerStorage: "drawers",
    drawerFrontStyle: "slim_shaker"
  });
  const bom = deriveBookcaseBOM(layout);
  const billable = deriveBillableComponents(layout);

  assert.deepEqual(bom.drawers.byStyle, { slim_shaker: 12 });
  assert.deepEqual(billable.drawersByStyle, { slim_shaker: 12 });
  assert.equal(bom.doors.count, 0);
});

test("BOM and billable summaries retain stable descriptor-driven section ownership", () => {
  const layout = generateBookcaseLayout({
    ...defaultBookcaseConfig,
    width: 96,
    sections: 3,
    lighting: "no_lighting",
    layoutMetadata: {
      sectionRatios: [1, 1, 1],
      sectionConfigs: [
        { type: "open", shelfCount: 2 },
        { type: "lower_doors", shelfCount: 4, doorStyle: "flat" },
        { type: "drawers", shelfCount: 6, drawerCount: 5, drawerFrontStyle: "slim_shaker" }
      ]
    }
  });
  const bom = deriveBookcaseBOM(layout);
  const billable = deriveBillableComponents(layout);
  const sectionIds = layout.config.layoutMetadata.sectionConfigs.map((section) => section.id);
  const [openId, doorId, drawerId] = sectionIds;

  assert.deepEqual(Object.keys(bom.bySectionId), sectionIds);
  assert.deepEqual(Object.keys(billable.bySectionId), sectionIds);
  assert.deepEqual(sectionIds.map((id) => bom.bySectionId[id].shelves.adjustableCount), [2, 4, 6]);
  assert.deepEqual(bom.bySectionId[openId].doors.byStyle, {});
  assert.deepEqual(bom.bySectionId[doorId].doors.byStyle, { flat: 2 });
  assert.deepEqual(bom.bySectionId[drawerId].drawers.byStyle, { slim_shaker: 5 });
  assert.deepEqual(billable.bySectionId[doorId].doorsByStyle, { flat: 2 });
  assert.deepEqual(billable.bySectionId[drawerId].drawersByStyle, { slim_shaker: 5 });
  assert.equal(
    Object.values(bom.bySectionId).reduce((total, section) => total + section.shelves.adjustableCount, 0),
    bom.shelves.adjustableCount
  );
  assert.equal(
    Object.values(billable.bySectionId).reduce((total, section) => total + section.generatedDrawerFronts, 0),
    billable.generatedDrawerFronts
  );
  assert.equal(
    Object.values(billable.bySectionId).reduce((total, section) => total + section.hardwareUnits, 0),
    billable.hardwareUnits
  );
});

test("multi-section feature components remain explicit shared group quantities", () => {
  const preset = layoutPresets.find((item) => item.id === "desk-niche");
  const layout = generateBookcaseLayout(preset.config);
  const bom = deriveBookcaseBOM(layout);
  const billable = deriveBillableComponents(layout);
  const group = bom.bySectionGroupId["feature-zone"];
  const billableGroup = billable.bySectionGroupId["feature-zone"];

  assert.equal(group.kind, "desk");
  assert.deepEqual(group.memberDescriptorIds, ["section-02", "section-03", "section-04"]);
  assert.deepEqual(
    group.memberSectionIds,
    layout.config.layoutMetadata.sectionConfigs.slice(1, 4).map((section) => section.id)
  );
  assert.equal(group.shelves.fixedCount, 1);
  assert.deepEqual(group.openings.specialByKind, { desk: 1 });
  assert.equal(
    Object.values(bom.bySectionId).reduce((total, section) => total + section.shelves.fixedCount, 0)
      + Object.values(bom.bySectionGroupId).reduce((total, sectionGroup) => total + sectionGroup.shelves.fixedCount, 0),
    bom.shelves.fixedCount
  );
  assert.equal(billableGroup.generatedDrawerFronts, 0);
  assert.equal(billableGroup.hingedDoorLeaves, 0);
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
    const pricedDrawerFrontCount = breakdown.lineItems
      .filter((item) => item.code === "DRAWER_FRONTS")
      .reduce((total, item) => total + item.quantity, 0);
    const pricedLightCount = breakdown.lineItems
      .filter((item) => item.code.startsWith("LIGHTING_"))
      .reduce((total, item) => total + item.quantity, 0);

    assert.equal(pricedDoorCount, breakdown.bom.doors.count, presetId);
    assert.equal(pricedDrawerFrontCount, breakdown.bom.drawers.frontCount, presetId);
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
