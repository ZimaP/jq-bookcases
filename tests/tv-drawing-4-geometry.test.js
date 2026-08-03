import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { deriveBillableComponents } from "../bookcase-billable.js";
import { boundsIntersect } from "../bookcase-layout.js";
import {
  GUIDED_PRODUCT_FAILURES,
  solveDrawing4TvModulePlan
} from "../guided-product-adapter.js";
import {
  createGuidedAcceptedSnapshot,
  evaluateGuidedProjectCandidate,
  restoreGuidedAcceptedSnapshot,
  transactGuidedProject
} from "../guided-project-engine.js";
import { createGuidedSceneDescriptors } from "../guided-render-contract.js";
import { createGuidedAcceptedComponentRenderPlan } from "../guided-render-primitives.js";

const fixture = JSON.parse(readFileSync(
  new URL("./fixtures/blender-prototype/TV01-clear-wall-foundation.json", import.meta.url),
  "utf8"
));
const frozenNonTvFixture = JSON.parse(readFileSync(
  new URL("./fixtures/guided-golden/G12-round-trip.json", import.meta.url),
  "utf8"
));
const project = fixture.project;
const expectations = fixture.currentContractExpectations;

function evaluate(input = project) {
  const specification = evaluateGuidedProjectCandidate(structuredClone(input));
  assert.equal(specification.accepted, true, JSON.stringify(specification.errors));
  const evaluation = specification.product.canonicalEvaluations[0].evaluation;
  return {
    specification,
    evaluation,
    layout: evaluation.layout,
    components: evaluation.layout.components
  };
}

function byRole(components, role) {
  return components.filter((component) => component.role === role);
}

function kind(component) {
  return component.metadata?.kind;
}

function mirroredBounds(left, right, axes = ["x", "y", "z"]) {
  for (const axis of axes) {
    if (axis === "x") {
      assert.equal(left.bounds.min.x, -right.bounds.max.x);
      assert.equal(left.bounds.max.x, -right.bounds.min.x);
    } else {
      assert.deepEqual(left.bounds["min"][axis], right.bounds["min"][axis]);
      assert.deepEqual(left.bounds["max"][axis], right.bounds["max"][axis]);
    }
  }
}

test("Drawing 4 module solver derives the service span first and fails closed outside its buildable range", () => {
  const plan = solveDrawing4TvModulePlan(117, 60);
  assert.equal(plan.accepted, true);
  assert.equal(plan.templateId, "tv-drawing-4-v1");
  assert.equal(plan.panelThickness, 0.75);
  assert.deepEqual(plan.clearWidths, expectations.moduleClearWidths);
  assert.equal(plan.sideClearWidth, 27);
  assert.equal(plan.centerClearWidth, 29.625);
  assert.equal(plan.centerClearWidth * 2 + plan.panelThickness, 60);
  assert.equal(plan.clearWidths.reduce((total, width) => total + width, 0) + 3.75, 117);
  assert.equal(plan.minimumCaseworkWidth, 101.75);
  assert.equal(plan.maximumCaseworkWidth, 135);
  assert.equal(plan.pairedDoorLeafWidths.every((width) => width >= 9.5), true);

  assert.equal(solveDrawing4TvModulePlan(101.75, 60).accepted, true);
  assert.equal(solveDrawing4TvModulePlan(135, 60).accepted, true);
  for (const [width, reason] of [
    [101.5, "SIDE_MODULE_PAIRED_DOORS_UNBUILDABLE"],
    [135.25, "SIDE_MODULE_SHELF_SPAN_EXCEEDED"]
  ]) {
    const rejected = solveDrawing4TvModulePlan(width, 60);
    assert.equal(rejected.accepted, false);
    assert.equal(rejected.errors[0]?.code, GUIDED_PRODUCT_FAILURES.tvDrawing4TemplateFit);
    assert.equal(rejected.errors[0]?.reason, reason);
  }
});

test("TV01 accepted geometry is the exact symmetric four-module Drawing 4 elevation", () => {
  const { specification, layout, components } = evaluate();
  const sections = byRole(components, "section").sort((left, right) => left.bounds.min.x - right.bounds.min.x);
  const featureZone = byRole(components, "section_group")[0];
  const lowerOpenings = byRole(components, "opening").filter((component) => kind(component) === "lower_cabinet");
  const constraints = byRole(components, "opening");
  const service = constraints.find((component) => kind(component) === "tv_service_opening");
  const tvBody = byRole(components, "screen")[0];
  const countertop = byRole(components, "fixed_shelf").filter((component) => (
    component.metadata?.purpose === "continuous_countertop"
  ));

  assert.deepEqual(sections.map((section) => section.size.x), expectations.moduleClearWidths);
  assert.deepEqual(layout.metrics.sectionClearWidths, expectations.moduleClearWidths);
  assert.equal(layout.metrics.overallWidth, expectations.caseworkWidth);
  assert.equal(specification.fit.treatments.left.width, expectations.leftFiller);
  assert.equal(specification.fit.treatments.right.width, expectations.rightFiller);
  assert.deepEqual(featureZone.metadata.memberSectionIds, sections.slice(1, 3).map((section) => section.id));
  assert.equal(featureZone.size.x, expectations.tvOpeningWidth);

  assert.equal(service.size.x, expectations.tvOpeningWidth);
  assert.equal(service.size.y, expectations.tvOpeningHeight);
  assert.equal(tvBody.size.x, expectations.tvBodyWidth);
  assert.equal(tvBody.size.y, expectations.tvBodyHeight);
  assert.equal(tvBody.position.x, service.position.x);
  assert.equal(tvBody.bounds.min.y - service.bounds.min.y, 2);
  assert.equal(service.bounds.max.y - tvBody.bounds.max.y, 2);

  assert.equal(countertop.length, 1);
  assert.deepEqual(countertop[0].size, {
    x: expectations.countertopWidth,
    y: expectations.countertopThickness,
    z: expectations.countertopDepth
  });
  assert.deepEqual(countertop[0].bounds.min, { x: -58.5, y: 34.75, z: 0 });
  assert.deepEqual(countertop[0].bounds.max, { x: 58.5, y: 36, z: 14 });
  assert.equal(components.some((component) => component.metadata?.purpose === "lower_separator"), false);

  assert.equal(lowerOpenings.length, 4);
  assert.deepEqual(lowerOpenings.map((opening) => opening.size.x), expectations.moduleClearWidths);
  assert.equal(constraints.length, expectations.nonRenderableBlenderConstraints);
  assert.deepEqual(constraints.map(kind).sort(), [
    "equipment_ventilation",
    "lower_cabinet",
    "lower_cabinet",
    "lower_cabinet",
    "lower_cabinet",
    "soundbar_equipment_zone",
    "tv_service_opening"
  ]);
  assert.ok(constraints.every((constraint) => (
    [constraint.bounds.min.x, constraint.bounds.min.y, constraint.bounds.min.z,
      constraint.bounds.max.x, constraint.bounds.max.y, constraint.bounds.max.z]
      .every(Number.isFinite)
    && ["x", "y", "z"].every((axis) => constraint.bounds.max[axis] > constraint.bounds.min[axis])
  )));
});

test("TV01 produces eight canonical Shaker fronts, eight hosted Black Pulls, and no slab fallback", () => {
  const { components } = evaluate();
  const doors = byRole(components, "door");
  const handles = byRole(components, "handle");
  assert.equal(doors.length, expectations.doorCount);
  assert.equal(handles.length, expectations.hardwareCount);
  assert.ok(doors.every((door) => (
    door.metadata.style === "shaker"
    && door.metadata.mounting === "inset"
    && door.metadata.arrangement === "pair"
    && door.metadata.leafCount === 2
    && door.metadata.profileGeometry?.kind === "framed_panel"
    && door.metadata.profileGeometry?.valid === true
  )));
  assert.ok(handles.every((handle) => (
    handle.metadata.hardware === "matte_black_pull"
    && doors.some((door) => door.id === handle.hostId && door.id === handle.parentId)
  )));
  assert.deepEqual(new Set(handles.map((handle) => handle.hostId)), new Set(doors.map((door) => door.id)));

  for (const door of doors) {
    const descriptor = createGuidedSceneDescriptors(evaluate().specification)
      .find((item) => item.componentId === door.id);
    const plan = createGuidedAcceptedComponentRenderPlan(descriptor);
    assert.equal(plan.geometryVariant, "framed_panel");
    assert.deepEqual(plan.submeshes.map((submesh) => submesh.submeshId), [
      "left_stile",
      "right_stile",
      "bottom_rail",
      "top_rail",
      "center-field"
    ]);
    assert.ok(plan.submeshes.every((submesh) => submesh.geometry === "box"));
  }
});

test("outer and center shelf elevations are mirrored and use their per-span authored thickness", () => {
  const { components } = evaluate();
  const sections = byRole(components, "section").sort((left, right) => left.bounds.min.x - right.bounds.min.x);
  const shelves = byRole(components, "shelf");
  const perSection = sections.map((section) => shelves
    .filter((shelf) => shelf.parentId === section.id)
    .sort((left, right) => left.bounds.min.y - right.bounds.min.y));

  assert.deepEqual(perSection.map((items) => items.length), [4, 1, 1, 4]);
  assert.ok([...perSection[0], ...perSection[3]].every((shelf) => (
    shelf.metadata.clearSpan === 27
    && shelf.size.y === expectations.outerShelfThickness
    && shelf.metadata.constructionThickness === expectations.outerShelfThickness
    && shelf.metadata.shelfSpanRuleId === "john-mdf-1in-27in-v1"
    && shelf.metadata.maximumApprovedClearSpan === 27
  )));
  assert.ok([...perSection[1], ...perSection[2]].every((shelf) => (
    shelf.metadata.clearSpan === 29.625
    && shelf.size.y === expectations.centerShelfThickness
    && shelf.metadata.constructionThickness === expectations.centerShelfThickness
    && shelf.metadata.shelfSpanRuleId === "john-mdf-1_25in-31in-v1"
    && shelf.metadata.maximumApprovedClearSpan === 31
    && shelf.metadata.appliedThickness === undefined
    && shelf.metadata.shelfRuleId === undefined
    && shelf.metadata.maximumApprovedSpan === undefined
    && shelf.metadata.displayRows === 2
  )));
  perSection[0].forEach((shelf, index) => mirroredBounds(shelf, perSection[3][index]));
  mirroredBounds(perSection[1][0], perSection[2][0]);
});

test("Drawing 4 preserves its two hosted mirrored puck-light descriptor envelopes", () => {
  const { components } = evaluate();
  const lights = byRole(components, "light")
    .sort((left, right) => left.bounds.min.x - right.bounds.min.x);

  assert.deepEqual(lights.map((light) => light.id), [
    "guided-installation-main/section-01-light-puck",
    "guided-installation-main/section-04-light-puck"
  ]);
  assert.deepEqual(lights.map((light) => light.hostId), [
    "guided-installation-main/top-panel",
    "guided-installation-main/top-panel"
  ]);
  assert.deepEqual(lights.map((light) => light.size), [
    { x: 2.25, y: 0.375, z: 2.25 },
    { x: 2.25, y: 0.375, z: 2.25 }
  ]);
  assert.deepEqual(lights.map((light) => light.metadata.attachment), [
    { axis: "y", hostFace: "min", componentFace: "max" },
    { axis: "y", hostFace: "min", componentFace: "max" }
  ]);
  assert.deepEqual(lights.map((light) => light.bounds), [
    {
      min: { x: -45.375, y: 94.875, z: 1.625 },
      max: { x: -43.125, y: 95.25, z: 3.875 }
    },
    {
      min: { x: 43.125, y: 94.875, z: 1.625 },
      max: { x: 45.375, y: 95.25, z: 3.875 }
    }
  ]);
  mirroredBounds(lights[0], lights[1]);
});

test("Drawing 4 metadata namespacing leaves the frozen non-TV geometry identity unchanged", () => {
  const specification = evaluateGuidedProjectCandidate(structuredClone(frozenNonTvFixture));
  assert.equal(specification.accepted, true, JSON.stringify(specification.errors));
  assert.equal(specification.geometryFingerprint, "jq-guided-geometry-v1-13L9494LSLIKU");
});

test("the split center divider and every decorative component stay outside all media clearance volumes", () => {
  const { components } = evaluate();
  const countertop = components.find((component) => component.metadata?.purpose === "continuous_countertop");
  const lower = components.find((component) => component.metadata?.purpose === "lower_media_support");
  const upper = components.find((component) => component.metadata?.purpose === "upper_media_support");
  const mediaConstraints = byRole(components, "opening").filter((component) => [
    "tv_service_opening",
    "soundbar_equipment_zone",
    "equipment_ventilation"
  ].includes(kind(component)));

  assert.ok(lower && upper && countertop);
  assert.equal(lower.bounds.max.y, countertop.bounds.min.y);
  assert.equal(upper.bounds.min.y, mediaConstraints.find((item) => kind(item) === "tv_service_opening").bounds.max.y);
  assert.equal(boundsIntersect(lower.bounds, upper.bounds), false);
  const forbidden = components.filter((component) => [
    "divider", "shelf", "door", "drawer_front", "handle", "crown", "trim", "filler", "fascia"
  ].includes(component.role));
  for (const component of forbidden) {
    for (const constraint of mediaConstraints) {
      assert.equal(
        boundsIntersect(component.bounds, constraint.bounds),
        false,
        `${component.id} enters ${constraint.id}`
      );
    }
  }
});

test("Drawing 4 identities, final layout metadata, render manifest, and submesh plan are deterministic", () => {
  const first = evaluate();
  const second = evaluate();
  const components = first.components;
  const componentIds = components.map((component) => component.id);
  const rendered = createGuidedSceneDescriptors(first.specification);
  const submeshIds = rendered.flatMap((descriptor) => (
    createGuidedAcceptedComponentRenderPlan(descriptor).submeshes.map((submesh) => (
      `${descriptor.componentId}::${submesh.submeshId}`
    ))
  ));

  assert.equal(new Set(componentIds).size, componentIds.length);
  assert.ok(components.every((component) => (
    (!component.parentId || componentIds.includes(component.parentId))
    && (!component.hostId || componentIds.includes(component.hostId))
  )));
  assert.deepEqual(first.layout.componentOrder, componentIds);
  assert.deepEqual(first.layout.sectionIds, byRole(components, "section").map((component) => component.id));
  assert.equal(first.layout.metrics.generatedDoorCount, 8);
  assert.equal(first.layout.metrics.primaryDoorCount, 8);
  assert.equal(first.layout.config.doorCount, 8);
  assert.equal(first.layout.validation.valid, true);
  assert.equal(rendered.length, expectations.renderableComponents);
  assert.equal(submeshIds.length, expectations.renderableSubmeshes);
  assert.equal(new Set(submeshIds).size, submeshIds.length);
  assert.equal(first.specification.geometryFingerprint, second.specification.geometryFingerprint);
  assert.deepEqual(first.specification.product.descriptorSets, second.specification.product.descriptorSets);
  assert.deepEqual(first.evaluation.bom, second.evaluation.bom);
  assert.deepEqual(first.evaluation.pricing, second.evaluation.pricing);
});

test("snapshot regeneration stays exact while finish, door style, and hardware affect only their owned identities", () => {
  const base = evaluate();
  const snapshot = createGuidedAcceptedSnapshot(base.specification, project);
  const repeatedSnapshot = createGuidedAcceptedSnapshot(evaluate().specification, project);
  assert.deepEqual(snapshot, repeatedSnapshot);
  const restored = restoreGuidedAcceptedSnapshot(structuredClone(project), snapshot);
  assert.equal(restored.accepted, true, JSON.stringify(restored.errors));
  assert.equal(restored.geometryFingerprint, base.specification.geometryFingerprint);

  const finish = evaluate({ ...structuredClone(project), finish: "medium-walnut" });
  assert.equal(finish.specification.geometryFingerprint, base.specification.geometryFingerprint);
  assert.notEqual(finish.specification.selectionFingerprint, base.specification.selectionFingerprint);
  assert.deepEqual(finish.specification.fit.casework, base.specification.fit.casework);

  const doorStyle = evaluate({ ...structuredClone(project), doorStyle: "flat-panel" });
  assert.notEqual(doorStyle.specification.geometryFingerprint, base.specification.geometryFingerprint);
  assert.deepEqual(doorStyle.specification.fit.casework, base.specification.fit.casework);
  assert.equal(byRole(doorStyle.components, "door").every((door) => door.metadata.profileGeometry.kind === "slab"), true);

  const hardware = evaluate({ ...structuredClone(project), hardware: "brass-pull" });
  const hardwareSnapshot = createGuidedAcceptedSnapshot(hardware.specification, {
    ...project,
    hardware: "brass-pull"
  });
  assert.equal(hardware.specification.geometryFingerprint, base.specification.geometryFingerprint);
  assert.notEqual(hardware.specification.selectionFingerprint, base.specification.selectionFingerprint);
  assert.notEqual(hardwareSnapshot.regeneration.descriptorFingerprint, snapshot.regeneration.descriptorFingerprint);
  assert.deepEqual(hardware.specification.fit.casework, base.specification.fit.casework);
});

test("unsupported narrow TV edits reject atomically with the named Drawing 4 diagnostic", () => {
  const accepted = evaluate().specification;
  const narrowProject = structuredClone(project);
  narrowProject.measurements.wallWidth = 96;
  const rejected = evaluateGuidedProjectCandidate(narrowProject);
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.stage, "product-geometry");
  assert.equal(rejected.errors[0]?.code, GUIDED_PRODUCT_FAILURES.tvDrawing4TemplateFit);
  assert.equal(rejected.errors[0]?.reason, "SIDE_MODULE_PAIRED_DOORS_UNBUILDABLE");

  const transaction = transactGuidedProject(narrowProject, accepted);
  assert.equal(transaction.accepted, false);
  assert.equal(transaction.changed, false);
  assert.equal(transaction.geometryChanged, false);
  assert.equal(transaction.specification, accepted);
});

test("geometry, BOM, billable, pricing, and render quantities remain in parity", () => {
  const { specification, evaluation, layout, components } = evaluate();
  const billable = deriveBillableComponents(layout);
  const renderManifest = specification.product.renderManifest;
  const physical = components.filter((component) => ![
    "assembly", "section", "section_group", "opening"
  ].includes(component.role));

  assert.equal(evaluation.bom.physicalComponentIds.length, 40);
  assert.equal(renderManifest.expectedCount, expectations.renderableComponents);
  assert.equal(evaluation.bom.doors.count, byRole(components, "door").length);
  assert.equal(evaluation.bom.hardware.handleCount, byRole(components, "handle").length);
  assert.equal(evaluation.bom.shelves.adjustableCount, byRole(components, "shelf").length);
  assert.equal(evaluation.bom.countertops.count, 1);
  assert.equal(billable.generatedCabinetDoors, evaluation.bom.doors.count);
  assert.equal(billable.hardwareUnits, evaluation.bom.hardware.handleCount);
  assert.equal(billable.continuousCountertopUnits, evaluation.bom.countertops.count);
  assert.equal(evaluation.pricing.acceptedDescriptorGraph.componentCount, 43);
  assert.equal(evaluation.pricing.acceptedDescriptorGraph.customerEquipmentIds.length, 1);
  assert.equal(
    evaluation.pricing.acceptedDescriptorGraph.componentCount
      + evaluation.pricing.acceptedDescriptorGraph.customerEquipmentIds.length,
    physical.length
  );
  assert.equal(evaluation.pricing.acceptedDescriptorGraph.byRole.fixed_shelf, 1);
  assert.equal(evaluation.pricing.lineItems.find((item) => item.code === "CONTINUOUS_COUNTERTOP")?.quantity, 1);
});
