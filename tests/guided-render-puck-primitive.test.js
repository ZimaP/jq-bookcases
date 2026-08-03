import test from "node:test";
import assert from "node:assert/strict";

import { generateBookcaseLayout } from "../bookcase-layout.js";
import {
  GUIDED_RENDER_PRIMITIVE_CONTRACT_VERSION,
  createGuidedAcceptedComponentRenderPlan
} from "../guided-render-primitives.js";

const identityTransform = Object.freeze({
  translation: [0, 0, 0],
  basis: [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
});

function descriptor(component, overrides = {}) {
  return {
    componentId: component.id,
    descriptorSetId: "accepted-main",
    installationId: "installation-main",
    zoneId: "main",
    role: component.role,
    materialSlot: component.metadata?.materialSlot || "led",
    bounds: structuredClone(component.bounds),
    transform: identityTransform,
    metadata: structuredClone(component.metadata || {}),
    ...overrides
  };
}

function canonicalPuck() {
  const layout = generateBookcaseLayout({
    width: 48,
    sections: 1,
    crownStyle: "none",
    lighting: "warm_pucks"
  });
  assert.equal(layout.validation.valid, true, JSON.stringify(layout.validation.errors));
  const puck = layout.components.find((component) => component.role === "light");
  assert.ok(puck);
  return { layout, puck };
}

function dimension(bounds, axis) {
  return bounds.max[axis] - bounds.min[axis];
}

test("accepted puck lights resolve to exact deterministic housing and recessed-lens cylinders", () => {
  const { puck } = canonicalPuck();
  const accepted = descriptor(puck);
  const plan = createGuidedAcceptedComponentRenderPlan(accepted);
  const [housing, lens] = plan.submeshes;

  assert.equal(GUIDED_RENDER_PRIMITIVE_CONTRACT_VERSION, 2);
  assert.equal(plan.contractVersion, 2);
  assert.equal(plan.geometryVariant, "recessed_puck_light");
  assert.deepEqual(plan.materialSlots, ["hardware", "led"]);
  assert.deepEqual(plan.submeshes.map((submesh) => submesh.submeshId), [
    "housing-rim",
    "emissive-lens"
  ]);
  assert.ok(plan.submeshes.every((submesh) => submesh.geometry === "cylinder"));

  assert.deepEqual(housing.bounds, accepted.bounds);
  assert.deepEqual(plan.worldBounds, accepted.bounds);
  assert.ok(["x", "y", "z"].every((axis) => (
    lens.bounds.min[axis] > housing.bounds.min[axis]
    && lens.bounds.max[axis] < housing.bounds.max[axis]
  )));

  const geometryKeys = [
    "schemaVersion",
    "kind",
    "axis",
    "center",
    "radius",
    "innerRadius",
    "depth",
    "segments",
    "capStyle",
    "surfaceRole"
  ];
  assert.deepEqual(Object.keys(housing.primitiveGeometry), geometryKeys);
  assert.deepEqual(Object.keys(lens.primitiveGeometry), geometryKeys);
  assert.deepEqual(Object.keys(housing.primitiveGeometry.center), ["x", "y", "z"]);
  assert.ok(Object.isFrozen(housing.primitiveGeometry));
  assert.ok(Object.isFrozen(housing.primitiveGeometry.center));
  assert.ok(Object.isFrozen(lens.primitiveGeometry));
  assert.ok(Object.isFrozen(lens.primitiveGeometry.center));

  assert.deepEqual(housing.primitiveGeometry, {
    schemaVersion: 1,
    kind: "cylinder",
    axis: "y",
    center: puck.position,
    radius: dimension(puck.bounds, "x") / 2,
    innerRadius: dimension(puck.bounds, "x") / 2 * 0.8,
    depth: dimension(puck.bounds, "y"),
    segments: 32,
    capStyle: "annular",
    surfaceRole: "housing"
  });
  assert.equal(lens.primitiveGeometry.schemaVersion, 1);
  assert.equal(lens.primitiveGeometry.kind, "cylinder");
  assert.equal(lens.primitiveGeometry.axis, "y");
  assert.equal(lens.primitiveGeometry.radius, housing.primitiveGeometry.radius * 0.72);
  assert.equal(lens.primitiveGeometry.innerRadius, 0);
  assert.equal(lens.primitiveGeometry.depth, housing.primitiveGeometry.depth * 0.5);
  assert.equal(lens.primitiveGeometry.segments, 32);
  assert.equal(lens.primitiveGeometry.capStyle, "closed");
  assert.equal(lens.primitiveGeometry.surfaceRole, "emissive_lens");
  assert.equal(
    lens.bounds.min.y - housing.bounds.min.y,
    housing.primitiveGeometry.depth / 6
  );
  assert.ok(lens.primitiveGeometry.radius < housing.primitiveGeometry.innerRadius);
});

test("puck recognition fails closed on role, attachment, or circular-bound contradictions", () => {
  const { puck } = canonicalPuck();
  const accepted = descriptor(puck);
  const cases = [
    ["non-light role", { ...accepted, role: "shelf" }],
    ["missing attachment", {
      ...accepted,
      metadata: { ...accepted.metadata, attachment: undefined }
    }],
    ["wrong axis", {
      ...accepted,
      metadata: { ...accepted.metadata, attachment: { axis: "z", hostFace: "min", componentFace: "max" } }
    }],
    ["wrong component face", {
      ...accepted,
      metadata: { ...accepted.metadata, attachment: { axis: "y", hostFace: "min", componentFace: "min" } }
    }],
    ["wrong host face", {
      ...accepted,
      metadata: { ...accepted.metadata, attachment: { axis: "y", hostFace: "max", componentFace: "max" } }
    }],
    ["non-circular bounds", {
      ...accepted,
      bounds: {
        min: accepted.bounds.min,
        max: { ...accepted.bounds.max, z: accepted.bounds.max.z + 0.125 }
      }
    }]
  ];

  for (const [label, candidate] of cases) {
    assert.throws(
      () => createGuidedAcceptedComponentRenderPlan(candidate),
      TypeError,
      label
    );
  }
});

test("non-puck boxes, framed fronts, and crown extrusions carry explicit null primitive geometry", () => {
  const layout = generateBookcaseLayout({
    width: 48,
    sections: 1,
    doorStyle: "shaker",
    crownStyle: "classic_crown",
    lighting: "shelf_accent",
    layoutMetadata: {
      sectionRatios: [1],
      sectionTypes: ["tall_doors"]
    }
  });
  assert.equal(layout.validation.valid, true, JSON.stringify(layout.validation.errors));
  const representatives = [
    layout.components.find((component) => component.role === "top_panel"),
    layout.components.find((component) => component.role === "door"),
    layout.components.find((component) => (
      component.role === "crown" && component.metadata?.hostSurface !== "side_panel"
    )),
    layout.components.find((component) => component.metadata?.lightType === "shelf_led")
  ];
  assert.ok(representatives.every(Boolean));
  for (const component of representatives) {
    const plan = createGuidedAcceptedComponentRenderPlan(descriptor(component));
    assert.ok(plan.submeshes.every((submesh) => submesh.primitiveGeometry === null));
  }
});
