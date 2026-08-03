import assert from "node:assert/strict";
import test from "node:test";

import { deriveBillableComponents } from "../bookcase-billable.js";
import { createGuidedBlenderMaterialPackage } from "../tools/blender/materials-preview-contract.mjs";
import { createVerifiedClayRenderPackage } from "../tools/blender/run-clay-worker.mjs";

const EXPECTED_BLENDER_RUNTIME = Object.freeze({
  version: "5.2.0 LTS",
  buildHash: "fbe6228777e7",
  backend: "METAL",
  vendor: "Apple",
  renderer: "Metal API",
  deviceVersion: "Metal 3.2"
});

const EXPECTED_PRICING_LINES = Object.freeze([
  ["BASE_PROJECT", 1, "project", 1900, 1900],
  ["ENVELOPE_AREA", 78, "sq ft", 85, 6630],
  ["SECTIONS", 4, "section", 250, 1000],
  ["ADJUSTABLE_SHELVES", 10, "shelf", 55, 550],
  ["CONTINUOUS_COUNTERTOP", 1, "countertop", 55, 55],
  ["SHELF_THICKNESS_1_IN", 8, "shelf", 28.13, 225],
  ["SHELF_THICKNESS_1_25_IN", 2, "shelf", 56.25, 112.5],
  ["LOWER_STORAGE", 113.25, "linear in", 18, 2038.5],
  ["DOOR_STYLE_SHAKER", 8, "door", 0, 0],
  ["HARDWARE_MATTE_BLACK_PULL", 8, "handle", 21.88, 175],
  ["LIGHTING_PUCK", 2, "fixture", 112.5, 225],
  ["CROWN_STYLE", 1, "selection", 250, 250],
  ["BASE_STYLE", 1, "selection", 250, 250],
  ["INSTALLATION", 1, "selection", 1404, 1404],
  ["DELIVERY", 1, "selection", 250, 250]
]);

let generatedPromise;

function getGenerated() {
  generatedPromise ||= createVerifiedClayRenderPackage();
  return generatedPromise;
}

function componentsByRole(components, role) {
  return components.filter((component) => component.role === role);
}

test("Phase 6 leaves the complete accepted Drawing 4 product geometry unchanged", async () => {
  const { specification, renderPackage } = await getGenerated();
  const evaluation = specification.product.canonicalEvaluations[0].evaluation;
  const components = specification.product.descriptorSets[0].components;
  const sections = componentsByRole(components, "section")
    .sort((left, right) => left.bounds.min.x - right.bounds.min.x);
  const fillers = componentsByRole(components, "filler")
    .sort((left, right) => left.bounds.min.x - right.bounds.min.x);
  const tv = componentsByRole(components, "screen");
  const serviceOpenings = components.filter((component) => (
    component.role === "opening" && component.metadata?.kind === "tv_service_opening"
  ));
  const doors = componentsByRole(components, "door");
  const pulls = components.filter((component) => (
    component.role === "handle" && component.metadata?.hardware === "matte_black_pull"
  ));
  const countertops = components.filter((component) => (
    component.role === "fixed_shelf"
    && component.metadata?.purpose === "continuous_countertop"
  ));
  const crowns = componentsByRole(components, "crown");
  const pucks = components.filter((component) => (
    component.role === "light" && component.metadata?.lightType === "puck"
  )).sort((left, right) => left.bounds.min.x - right.bounds.min.x);
  const puckRenderComponents = renderPackage.components
    .filter((component) => component.role === "light")
    .sort((left, right) => left.blenderWorldBounds.min.x - right.blenderWorldBounds.min.x);

  assert.deepEqual(sections.map((section) => section.size.x), [27, 29.625, 29.625, 27]);
  assert.deepEqual(evaluation.layout.metrics.sectionClearWidths, [27, 29.625, 29.625, 27]);
  assert.equal(specification.fit.casework.width, 117);
  assert.deepEqual(specification.fit.treatments.left.width, 1.5);
  assert.deepEqual(specification.fit.treatments.right.width, 1.5);
  assert.equal(fillers.length, 2);
  assert.deepEqual(fillers.map((filler) => filler.size.x), [1.5, 1.5]);

  assert.equal(tv.length, 1);
  assert.deepEqual({ width: tv[0].size.x, height: tv[0].size.y }, { width: 56, height: 33 });
  assert.equal(serviceOpenings.length, 1);
  assert.deepEqual(
    { width: serviceOpenings[0].size.x, height: serviceOpenings[0].size.y },
    { width: 60, height: 37 }
  );

  assert.equal(doors.length, 8);
  assert.equal(doors.every((door) => door.metadata?.style === "shaker"), true);
  assert.equal(pulls.length, 8);
  assert.equal(new Set(pulls.map((pull) => pull.hostId)).size, 8);
  assert.equal(pulls.every((pull) => doors.some((door) => door.id === pull.hostId)), true);

  assert.equal(countertops.length, 1);
  assert.deepEqual(countertops[0].size, { x: 117, y: 1.25, z: 14 });
  assert.deepEqual(crowns.map((crown) => crown.id), ["guided-installation-main/crown-slim-cap"]);
  assert.deepEqual(crowns[0].size, { x: 117.5, y: 1.2, z: 0.375 });
  assert.equal(components.some((component) => component.id.endsWith("crown-slim-cap-left-return")), false);
  assert.equal(components.some((component) => component.id.endsWith("crown-slim-cap-right-return")), false);

  assert.equal(pucks.length, 2);
  assert.deepEqual(pucks.map((puck) => puck.size), [
    { x: 2.25, y: 0.375, z: 2.25 },
    { x: 2.25, y: 0.375, z: 2.25 }
  ]);
  assert.equal(pucks[0].position.x, -pucks[1].position.x);
  assert.equal(pucks[0].position.y, pucks[1].position.y);
  assert.equal(pucks[0].position.z, pucks[1].position.z);
  assert.equal(pucks[0].bounds.min.x, -pucks[1].bounds.max.x);
  assert.equal(pucks[0].bounds.max.x, -pucks[1].bounds.min.x);
  assert.equal(puckRenderComponents.length, 2);
  assert.deepEqual(puckRenderComponents.map((component) => component.submeshes.length), [2, 2]);
  assert.equal(puckRenderComponents.flatMap((component) => component.submeshes).every((submesh) => (
    submesh.geometry === "cylinder"
    && submesh.primitiveGeometry?.kind === "cylinder"
    && submesh.primitiveGeometry?.segments === 32
  )), true);
  assert.equal(renderPackage.constraints.length, 7);
});

test("Phase 6 preserves every accepted billable quantity, pricing rate, and commercial total", async () => {
  const { specification } = await getGenerated();
  const evaluation = specification.product.canonicalEvaluations[0].evaluation;
  const billable = deriveBillableComponents(evaluation.layout);

  assert.equal(evaluation.bom.physicalComponentIds.length, 40);
  assert.equal(evaluation.bom.overall.physicalComponentCount, 40);
  assert.equal(evaluation.pricing.acceptedDescriptorGraph.componentCount, 43);
  assert.deepEqual({
    generatedDrawerFronts: billable.generatedDrawerFronts,
    generatedCabinetDoors: billable.generatedCabinetDoors,
    generatedTallDoors: billable.generatedTallDoors,
    generatedGlassDoors: billable.generatedGlassDoors,
    hingedDoorLeaves: billable.hingedDoorLeaves,
    continuousCountertopUnits: billable.continuousCountertopUnits,
    continuousCountertopLinearIn: billable.continuousCountertopLinearIn,
    drawerHardwareUnits: billable.drawerHardwareUnits,
    doorHardwareUnits: billable.doorHardwareUnits,
    hardwareUnits: billable.hardwareUnits,
    compatibleLightingComponents: billable.compatibleLightingComponents,
    puckLightLocations: billable.puckLightLocations,
    shelfLightLocations: billable.shelfLightLocations,
    verticalLightChannels: billable.verticalLightChannels,
    doorsByStyle: billable.doorsByStyle,
    drawersByStyle: billable.drawersByStyle,
    hardwareByType: billable.hardwareByType,
    lightsByType: billable.lightsByType
  }, {
    generatedDrawerFronts: 0,
    generatedCabinetDoors: 8,
    generatedTallDoors: 0,
    generatedGlassDoors: 0,
    hingedDoorLeaves: 8,
    continuousCountertopUnits: 1,
    continuousCountertopLinearIn: 117,
    drawerHardwareUnits: 0,
    doorHardwareUnits: 8,
    hardwareUnits: 8,
    compatibleLightingComponents: 2,
    puckLightLocations: 2,
    shelfLightLocations: 0,
    verticalLightChannels: 0,
    doorsByStyle: { shaker: 8 },
    drawersByStyle: {},
    hardwareByType: { matte_black_pull: 8 },
    lightsByType: { puck: 2 }
  });
  assert.deepEqual(
    evaluation.pricing.lineItems.map(({ code, quantity, unit, unitRate, amount }) => (
      [code, quantity, unit, unitRate, amount]
    )),
    EXPECTED_PRICING_LINES
  );
  assert.deepEqual(evaluation.pricing.multipliers, { depth: 1, finish: 1 });
  assert.equal(evaluation.pricing.subtotalBeforeMultipliers, 15065);
  assert.equal(evaluation.pricing.subtotal, 15065);
  assert.equal(evaluation.pricing.roundingIncrement, 50);
  assert.equal(evaluation.pricing.total, 15050);
});

test("Phase 6 leaves both customer approval gates explicitly false", async () => {
  const { renderPackage, packageJson } = await getGenerated();
  const materialPackage = createGuidedBlenderMaterialPackage(renderPackage, {
    primaryPackageJson: packageJson,
    blenderRuntime: EXPECTED_BLENDER_RUNTIME
  });

  assert.equal(renderPackage.readiness.customerBeautyRenderApproved, false);
  assert.equal(materialPackage.authority.customerMaterialApproved, false);
  assert.equal(materialPackage.authority.customerBeautyRenderApproved, false);
});
