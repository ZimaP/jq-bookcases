import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { defaultBookcaseConfig } from "../bookcase-config.js";
import { deriveBillableComponents } from "../bookcase-billable.js";
import { BOM_SCHEMA_VERSION, deriveBookcaseBOM } from "../bookcase-bom.js";
import { generateBookcaseLayout } from "../bookcase-layout.js";
import {
  PRICING_RATES,
  PRICING_VERSION,
  calculateBookcasePriceBreakdown
} from "../bookcase-pricing.js";
import { evaluateGuidedProjectCandidate } from "../guided-project-engine.js";

const fixture = JSON.parse(readFileSync(
  new URL("./fixtures/blender-prototype/TV01-clear-wall-foundation.json", import.meta.url),
  "utf8"
));

const findLine = (pricing, code) => pricing.lineItems.find((item) => item.code === code);

function evaluateDrawing4() {
  const specification = evaluateGuidedProjectCandidate(structuredClone(fixture.project));
  assert.equal(specification.accepted, true, JSON.stringify(specification.errors));
  const evaluation = specification.product.canonicalEvaluations[0].evaluation;
  return {
    specification,
    evaluation,
    layout: evaluation.layout,
    bom: evaluation.bom,
    pricing: evaluation.pricing,
    billable: deriveBillableComponents(evaluation.layout)
  };
}

test("TV Drawing 4 BOM and billable quantities come only from the accepted descriptor graph", () => {
  const { layout, bom, billable } = evaluateDrawing4();
  const components = layout.components;
  const countertop = components.find((component) => (
    component.role === "fixed_shelf"
    && component.metadata?.purpose === "continuous_countertop"
  ));
  const doors = components.filter((component) => component.role === "door");
  const handles = components.filter((component) => component.role === "handle");
  const lights = components.filter((component) => component.role === "light");
  const lowerOpenings = components.filter((component) => (
    component.role === "opening"
    && component.metadata?.kind === "lower_cabinet"
  ));

  assert.equal(BOM_SCHEMA_VERSION, 2);
  assert.equal(bom.schemaVersion, BOM_SCHEMA_VERSION);
  assert.ok(countertop);
  assert.deepEqual(bom.countertops, {
    count: 1,
    linearIn: 117,
    faceAreaSqIn: 1638,
    byThicknessIn: { "1.25": 1 },
    items: [{
      componentId: countertop.id,
      purpose: "continuous_countertop",
      quantity: 1,
      dimensionsIn: {
        width: 117,
        thickness: 1.25,
        depth: 14
      }
    }]
  });
  assert.equal(billable.continuousCountertopUnits, 1);
  assert.equal(billable.continuousCountertopLinearIn, 117);

  assert.equal(lowerOpenings.length, 4);
  assert.equal(bom.openings.lowerStorageCount, 4);
  assert.equal(bom.openings.lowerStorageLinearIn, 113.25);
  assert.equal(doors.length, 8);
  assert.equal(handles.length, 8);
  assert.deepEqual(bom.doors.byStyle, { shaker: 8 });
  assert.deepEqual(bom.hardware.byType, { matte_black_pull: 8 });
  assert.deepEqual(billable.doorsByStyle, { shaker: 8 });
  assert.deepEqual(billable.hardwareByType, { matte_black_pull: 8 });
  assert.equal(billable.generatedCabinetDoors, 8);
  assert.equal(billable.hingedDoorLeaves, 8);
  assert.equal(billable.doorHardwareUnits, 8);
  assert.equal(billable.hardwareUnits, 8);

  assert.equal(lights.length, 2);
  assert.deepEqual(bom.lighting, {
    count: 2,
    byType: { puck: 2 }
  });
  assert.equal(billable.compatibleLightingComponents, 2);
  assert.equal(billable.puckLightLocations, 2);
  assert.deepEqual(billable.lightsByType, { puck: 2 });

  assert.equal(
    bom.hardware.schedule.reduce((total, entry) => total + entry.quantity, 0),
    handles.length
  );
  assert.deepEqual(
    bom.hardware.schedule.flatMap((entry) => entry.locations.flatMap((location) => location.handleIds)).sort(),
    handles.map((handle) => handle.id).sort()
  );
  assert.deepEqual(
    [...new Set(bom.hardware.schedule.flatMap((entry) => entry.locations.map((location) => location.hostId)))].sort(),
    doors.map((door) => door.id).sort()
  );
});

test("TV Drawing 4 prices its countertop and mixed shelf thicknesses explicitly", () => {
  const first = evaluateDrawing4();
  const repeated = evaluateDrawing4();

  assert.equal(first.pricing.pricingVersion, PRICING_VERSION);
  assert.deepEqual(first.bom.shelves.byThicknessIn, { "1": 8, "1.25": 2 });

  const countertop = findLine(first.pricing, "CONTINUOUS_COUNTERTOP");
  assert.deepEqual(countertop, {
    code: "CONTINUOUS_COUNTERTOP",
    label: "Generated continuous countertop",
    quantity: 1,
    unit: "countertop",
    unitRate: PRICING_RATES.adjustableShelf,
    amount: PRICING_RATES.adjustableShelf
  });

  const thicknessLines = first.pricing.lineItems.filter((item) => item.code.startsWith("SHELF_THICKNESS"));
  assert.deepEqual(thicknessLines, [
    {
      code: "SHELF_THICKNESS_1_IN",
      label: "1 in shelf thickness premium",
      quantity: 8,
      unit: "shelf",
      unitRate: 28.13,
      amount: 225,
      thicknessIn: 1
    },
    {
      code: "SHELF_THICKNESS_1_25_IN",
      label: "1.25 in shelf thickness premium",
      quantity: 2,
      unit: "shelf",
      unitRate: 56.25,
      amount: 112.5,
      thicknessIn: 1.25
    }
  ]);
  assert.equal(findLine(first.pricing, "LOWER_STORAGE").quantity, first.bom.openings.lowerStorageLinearIn);
  assert.equal(findLine(first.pricing, "DOOR_STYLE_SHAKER").quantity, 8);
  assert.equal(findLine(first.pricing, "HARDWARE_MATTE_BLACK_PULL").quantity, 8);
  assert.equal(findLine(first.pricing, "LIGHTING_PUCK").quantity, 2);

  assert.deepEqual(first.bom.countertops, repeated.bom.countertops);
  assert.deepEqual(first.bom.shelves.byThicknessIn, repeated.bom.shelves.byThicknessIn);
  assert.deepEqual(first.pricing.lineItems, repeated.pricing.lineItems);
  assert.equal(first.pricing.total, repeated.pricing.total);
});

test("generic layouts retain the legacy uniform shelf-pricing line and no countertop charge", () => {
  const layout = generateBookcaseLayout(defaultBookcaseConfig);
  const bom = deriveBookcaseBOM(layout);
  const billable = deriveBillableComponents(layout);
  const pricing = calculateBookcasePriceBreakdown(defaultBookcaseConfig, layout);
  const thicknessLines = pricing.lineItems.filter((item) => item.code.startsWith("SHELF_THICKNESS"));

  assert.deepEqual(bom.countertops, {
    count: 0,
    linearIn: 0,
    faceAreaSqIn: 0,
    byThicknessIn: {},
    items: []
  });
  assert.equal(billable.continuousCountertopUnits, 0);
  assert.equal(billable.continuousCountertopLinearIn, 0);
  assert.equal(pricing.lineItems.some((item) => item.code === "CONTINUOUS_COUNTERTOP"), false);
  assert.equal(thicknessLines.length, 1);
  assert.equal(thicknessLines[0].code, "SHELF_THICKNESS");
  assert.equal(thicknessLines[0].quantity, bom.shelves.adjustableCount);
});
