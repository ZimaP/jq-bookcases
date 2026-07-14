import test from "node:test";
import assert from "node:assert/strict";

import { deriveBillableComponents } from "../bookcase-billable.js";
import { defaultBookcaseConfig, layoutPresets } from "../bookcase-config.js";
import { createSavedDesignRecord } from "../configurator-experience.js";
import { generateBookcaseLayout } from "../bookcase-layout.js";
import {
  PRICING_RATES,
  buildPricingContext,
  calculateBookcasePrice
} from "../bookcase-pricing.js";
import { createQuotePrefill } from "../quote-prefill.js";

const preset = (id) => layoutPresets.find((item) => item.id === id);
const contextFor = (config) => {
  const layout = generateBookcaseLayout(config);
  return buildPricingContext(config, layout);
};

test("drawer-only pricing ignores stale door style and prices generated drawer hardware", () => {
  const base = {
    ...defaultBookcaseConfig,
    layoutType: "lower_drawers",
    lowerStorage: "drawers"
  };
  const shaker = contextFor({ ...base, doorStyle: "shaker" });
  const glass = contextFor({ ...base, doorStyle: "glass" });

  assert.equal(shaker.billableQuantities.generatedDrawerFronts, 12);
  assert.equal(shaker.billableQuantities.hingedDoorLeaves, 0);
  assert.equal(shaker.billableQuantities.drawerHardwareUnits, 12);
  assert.equal(shaker.billableQuantities.doorHardwareUnits, 0);
  assert.equal(shaker.componentCharges.doorStyle.amount, 0);
  assert.equal(glass.componentCharges.doorStyle.amount, 0);
  assert.equal(shaker.componentCharges.hardware.quantity, 12);
  assert.equal(shaker.componentCharges.hardware.amount, 225);
  assert.equal(shaker.componentCharges.lighting.amount, 450);
  assert.equal(shaker.total, 14850);
  assert.equal(glass.total, shaker.total);
});

test("drawer front profiles are carried physically without inventing a price difference", () => {
  const base = {
    ...defaultBookcaseConfig,
    layoutType: "lower_drawers",
    lowerStorage: "drawers"
  };
  const totals = ["shaker", "flat", "slim_shaker"].map((drawerFrontStyle) => {
    const pricing = contextFor({ ...base, drawerFrontStyle });
    assert.deepEqual(pricing.bom.drawers.byStyle, { [drawerFrontStyle]: 12 });
    return pricing.total;
  });
  assert.deepEqual(totals, [totals[0], totals[0], totals[0]]);
});

test("push latch persists canonically while pricing only generated visible hardware", () => {
  const config = { ...defaultBookcaseConfig, hardware: "push_latch" };
  const pricing = contextFor(config);
  const saved = createSavedDesignRecord(config, pricing.total, {
    id: "JQ-PUSH01",
    savedAt: "2026-07-14T00:00:00.000Z"
  });

  assert.equal(pricing.valid, true);
  assert.equal(pricing.selections.hardware, "push_latch");
  assert.equal(pricing.billableQuantities.hardwareUnits, 0);
  assert.deepEqual(pricing.billableQuantities.hardwareByType, {});
  assert.equal(pricing.componentCharges.hardware.quantity, 0);
  assert.equal(pricing.componentCharges.hardware.amount, 0);
  assert.equal(pricing.lineItems.some((item) => item.code.startsWith("HARDWARE_")), false);
  assert.equal(saved.config.hardware, "push_latch");
});

test("generated tall doors and their hardware are priced while zero compatible lights are not", () => {
  const config = {
    ...preset("tall-storage").config,
    width: 96,
    sections: 2,
    lowerCabinets: false,
    doorStyle: "slim_shaker",
    hardware: "polished_nickel_pull",
    lighting: "full_package",
    layoutMetadata: { sectionRatios: [1, 1] }
  };
  const overWide = generateBookcaseLayout({ ...config, width: 132 });
  assert.equal(overWide.validation.valid, false);
  assert.ok(overWide.validation.errors.some((error) => error.code === "DOOR_LEAF_TOO_WIDE"));
  const selected = contextFor(config);
  const disabled = contextFor({ ...config, lighting: "no_lighting" });

  assert.equal(selected.billableQuantities.generatedTallDoors, 4);
  assert.equal(selected.billableQuantities.hingedDoorLeaves, 4);
  assert.equal(selected.billableQuantities.doorHardwareUnits, 4);
  assert.equal(selected.billableQuantities.compatibleLightingComponents, 0);
  assert.equal(selected.componentCharges.doorStyle.amount, 125);
  assert.equal(selected.componentCharges.hardware.amount, 112.5);
  assert.equal(selected.componentCharges.lighting.amount, 0);
  assert.equal(selected.total, 11100);
  assert.equal(disabled.total, selected.total);
});

test("valid lighting uses generated component quantities and preserved rates", () => {
  const pucks = contextFor(defaultBookcaseConfig);
  const disabled = contextFor({ ...defaultBookcaseConfig, lighting: "no_lighting" });
  const fullOpen = contextFor({
    ...defaultBookcaseConfig,
    layoutType: "classic",
    lowerCabinets: false,
    tallDoors: false,
    lighting: "full_package"
  });
  const fullWithTallEnds = contextFor({
    ...defaultBookcaseConfig,
    layoutType: "tall_storage",
    lowerCabinets: false,
    tallDoors: true,
    lighting: "full_package"
  });

  assert.equal(pucks.billableQuantities.puckLightLocations, 4);
  assert.equal(pucks.componentCharges.lighting.amount, 450);
  assert.equal(pucks.billableQuantities.hingedDoorLeaves, 4);
  assert.equal(pucks.total, 14700);
  assert.equal(disabled.total, 14250);

  assert.deepEqual(
    [fullOpen.billableQuantities.compatibleLightingComponents, fullOpen.componentCharges.lighting.amount, fullOpen.total],
    [28, 1550, 14050]
  );
  assert.deepEqual(
    [fullWithTallEnds.billableQuantities.compatibleLightingComponents, fullWithTallEnds.componentCharges.lighting.amount, fullWithTallEnds.total],
    [14, 775, 12450]
  );
  assert.notEqual(fullOpen.total, fullWithTallEnds.total);
});

test("layout reconciliation removes obsolete door, hardware, and lighting charges", () => {
  const billable = contextFor({
    ...defaultBookcaseConfig,
    sections: 3,
    layoutType: "lower_cabinets",
    lowerCabinets: true,
    lowerStorage: "doors",
    tallDoors: false,
    featureOpening: false,
    doorStyle: "glass",
    hardware: "brass_pull",
    lighting: "full_package",
    layoutMetadata: { sectionRatios: [1, 1, 1] }
  });
  const reconciled = contextFor({
    ...billable.selections,
    layoutType: "feature_wall",
    lowerCabinets: false,
    featureOpening: true,
    layoutMetadata: { specialSpan: 3, sectionRatios: [1, 1, 1] }
  });

  assert.deepEqual(
    [billable.billableQuantities.hingedDoorLeaves, billable.billableQuantities.hardwareUnits, billable.billableQuantities.compatibleLightingComponents],
    [6, 6, 21]
  );
  assert.deepEqual(
    [billable.componentCharges.doorStyle.amount, billable.componentCharges.hardware.amount, billable.componentCharges.lighting.amount, billable.total],
    [525, 168.75, 1162.5, 15350]
  );
  assert.equal(reconciled.selections.doorStyle, "glass");
  assert.equal(reconciled.selections.lighting, "full_package");
  assert.deepEqual(
    [reconciled.billableQuantities.hingedDoorLeaves, reconciled.billableQuantities.hardwareUnits, reconciled.billableQuantities.compatibleLightingComponents],
    [0, 0, 0]
  );
  assert.deepEqual(
    [reconciled.componentCharges.doorStyle.amount, reconciled.componentCharges.hardware.amount, reconciled.componentCharges.lighting.amount, reconciled.total],
    [0, 0, 0, 10500]
  );
});

test("forced upper glass doors are distinguished from selected lower-door style", () => {
  const pricing = contextFor(preset("glass-library").config);

  assert.equal(pricing.billableQuantities.generatedCabinetDoors, 8);
  assert.equal(pricing.billableQuantities.generatedGlassDoors, 8);
  assert.deepEqual(pricing.billableQuantities.doorsByStyle, { glass: 8, shaker: 8 });
  assert.equal(pricing.componentCharges.doorStyle.quantity, 16);
  assert.equal(pricing.componentCharges.doorStyle.amount, 700);
  assert.equal(pricing.componentCharges.hardware.quantity, 16);
  assert.equal(pricing.componentCharges.hardware.amount, 300);
  assert.equal(pricing.total, 16450);
});

test("mixed doors and drawers price only their generated styles and attached hardware", () => {
  const pricing = contextFor(preset("display-wall").config);

  assert.equal(pricing.billableQuantities.generatedDrawerFronts, 3);
  assert.equal(pricing.billableQuantities.generatedCabinetDoors, 4);
  assert.equal(pricing.billableQuantities.drawerHardwareUnits, 3);
  assert.equal(pricing.billableQuantities.doorHardwareUnits, 4);
  assert.equal(pricing.componentCharges.doorStyle.quantity, 4);
  assert.equal(pricing.componentCharges.doorStyle.amount, 125);
  assert.equal(pricing.componentCharges.hardware.quantity, 7);
  assert.equal(pricing.componentCharges.hardware.amount, 131.25);
  assert.equal(pricing.componentCharges.lighting.amount, 337.5);
  assert.equal(pricing.total, 13850);
});

test("normalized component rates preserve every established reference premium", () => {
  assert.equal(PRICING_RATES.doorStylePerDoor.slim_shaker * 8, 250);
  assert.equal(PRICING_RATES.doorStylePerDoor.glass * 8, 700);
  assert.deepEqual(
    Object.fromEntries(Object.entries(PRICING_RATES.hardwarePerUnit)
      .filter(([type]) => type !== "unknown")
      .map(([type, rate]) => [type, rate * 8])),
    {
      brass_knob: 150,
      brass_pull: 225,
      matte_black_knob: 125,
      matte_black_pull: 175,
      polished_nickel_pull: 225
    }
  );
  assert.equal(PRICING_RATES.lightingPerComponent.puck * 4, 450);
  assert.equal(PRICING_RATES.lightingPerComponent.shelf_led * 16, 850);
  assert.equal(PRICING_RATES.lightingPerComponent.vertical_led * 8, 650);
  assert.equal((450 + 850 + 650) * PRICING_RATES.fullPackageLightingMultiplier, 1550);
});

test("every preset prices exactly the generated door, handle, and light descriptors", () => {
  for (const item of layoutPresets) {
    const layout = generateBookcaseLayout(item.config);
    const derived = deriveBillableComponents(layout);
    const pricing = buildPricingContext(item.config, layout);
    const roleCount = (role) => layout.components.filter((component) => component.role === role).length;

    assert.equal(pricing.billableQuantities.hingedDoorLeaves, roleCount("door"), item.id);
    assert.equal(pricing.billableQuantities.generatedDrawerFronts, roleCount("drawer_front"), item.id);
    assert.equal(pricing.billableQuantities.hardwareUnits, roleCount("handle"), item.id);
    assert.equal(pricing.billableQuantities.compatibleLightingComponents, roleCount("light"), item.id);
    assert.deepEqual(pricing.billableQuantities, derived, item.id);
    assert.equal(pricing.componentCharges.doorStyle.quantity, roleCount("door"), item.id);
    assert.equal(pricing.componentCharges.hardware.quantity, roleCount("handle"), item.id);
    assert.equal(pricing.componentCharges.lighting.quantity, roleCount("light"), item.id);
    assert.equal(calculateBookcasePrice(item.config, layout), pricing.total, item.id);
  }
});

test("representative displayed, saved, and quote-prefill totals share one corrected result", () => {
  const tallBase = preset("tall-storage").config;
  const fixtures = {
    drawerOnly: {
      ...defaultBookcaseConfig,
      layoutType: "lower_drawers",
      lowerStorage: "drawers",
      doorStyle: "glass"
    },
    tallDoors: {
      ...tallBase,
      lowerCabinets: false,
      doorStyle: "slim_shaker",
      hardware: "polished_nickel_pull"
    },
    noCompatibleLighting: {
      ...tallBase,
      width: 96,
      sections: 2,
      lowerCabinets: false,
      doorStyle: "slim_shaker",
      hardware: "polished_nickel_pull",
      lighting: "full_package",
      layoutMetadata: { sectionRatios: [1, 1] }
    },
    validLighting: {
      ...defaultBookcaseConfig,
      layoutType: "classic",
      lowerCabinets: false,
      lighting: "full_package"
    }
  };

  for (const [name, config] of Object.entries(fixtures)) {
    const pricing = contextFor(config);
    const saved = createSavedDesignRecord(config, pricing.total, {
      id: `JQ-${name}`,
      savedAt: "2026-07-12T00:00:00.000Z"
    });
    const quote = createQuotePrefill(config);

    assert.equal(calculateBookcasePrice(config, pricing.layout), pricing.total, `${name}: displayed`);
    assert.equal(saved.price, pricing.total, `${name}: saved`);
    assert.equal(quote.price, pricing.total, `${name}: quote`);
  }
});

test("Benjamin Moore uses the one established custom-paint classification without duplicate charges", () => {
  const whiteDove = contextFor({
    ...defaultBookcaseConfig,
    finish: "custom_bm",
    customPaintColor: "White Dove",
    customPaintCode: "OC-17",
    customPaintHex: "#F0EFE6"
  });
  const haleNavy = contextFor({
    ...defaultBookcaseConfig,
    finish: "custom_bm",
    customPaintColor: "Hale Navy",
    customPaintCode: "HC-154",
    customPaintHex: "#434B56"
  });
  assert.equal(whiteDove.customPaint.selected, true);
  assert.equal(whiteDove.customPaint.premiumAmount, 0);
  assert.equal(whiteDove.multipliers.finish, 1);
  assert.equal(haleNavy.total, whiteDove.total);
  assert.equal(haleNavy.customPaint.premiumAmount, whiteDove.customPaint.premiumAmount);
});
