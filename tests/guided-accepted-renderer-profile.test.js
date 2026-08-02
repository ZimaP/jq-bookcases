import test from "node:test";
import assert from "node:assert/strict";

import { generateBookcaseLayout } from "../bookcase-layout.js";
import {
  createGuidedAcceptedComponentRenderPlan,
  createGuidedAcceptedProfileExtrusionGeometry
} from "../guided-configurator-3d.js";
import { computePhysicalUvScales } from "../guided-materials.js";
import {
  createGuidedSceneDescriptors,
  validateGuidedRenderedManifest
} from "../guided-render-contract.js";

const identityTransform = Object.freeze({
  translation: [0, 0, 0],
  basis: [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
});

function canonicalFront(style) {
  const layout = generateBookcaseLayout({
    width: 48,
    sections: 1,
    doorStyle: style,
    layoutMetadata: {
      sectionRatios: [1],
      sectionTypes: ["tall_doors"]
    }
  });
  assert.equal(layout.validation.valid, true, JSON.stringify(layout.validation.errors));
  return layout.components.find((component) => component.role === "door");
}

function acceptedDescriptor(component, descriptorSetId = "accepted-main") {
  return {
    componentId: component.id,
    descriptorSetId,
    installationId: "installation-main",
    zoneId: "main",
    role: component.role,
    materialSlot: component.metadata?.materialSlot || "front",
    bounds: component.bounds,
    transform: identityTransform,
    metadata: component.metadata
  };
}

function recordFromPlan(plan) {
  return {
    componentId: plan.componentId,
    meshCount: plan.submeshes.length,
    materialSlots: plan.materialSlots,
    worldBounds: plan.worldBounds,
    submeshes: plan.submeshes.map((submesh) => ({
      submeshId: submesh.submeshId,
      geometry: submesh.geometry,
      materialSlot: submesh.materialSlot,
      worldBounds: submesh.worldBounds
    }))
  };
}

test("accepted front plans preserve slab, Shaker, slim Shaker, and glass structure", () => {
  const plans = Object.fromEntries(["flat", "shaker", "slim_shaker", "glass"].map((style) => {
    const front = canonicalFront(style);
    return [style, createGuidedAcceptedComponentRenderPlan(acceptedDescriptor(front))];
  }));

  assert.equal(plans.flat.geometryVariant, "slab");
  assert.deepEqual(plans.flat.submeshes.map((submesh) => submesh.submeshId), ["slab"]);
  assert.equal(plans.shaker.geometryVariant, "framed_panel");
  assert.equal(plans.slim_shaker.geometryVariant, "framed_panel");
  assert.equal(plans.glass.geometryVariant, "glass_frame");
  for (const style of ["shaker", "slim_shaker", "glass"]) {
    assert.deepEqual(
      plans[style].submeshes.map((submesh) => submesh.submeshId),
      ["left_stile", "right_stile", "bottom_rail", "top_rail", "center-field"]
    );
    assert.equal(plans[style].submeshes.length, 5);
  }

  const shakerStile = plans.shaker.submeshes.find((submesh) => submesh.submeshId === "left_stile");
  const slimStile = plans.slim_shaker.submeshes.find((submesh) => submesh.submeshId === "left_stile");
  assert.ok(
    shakerStile.bounds.max.x - shakerStile.bounds.min.x
      > slimStile.bounds.max.x - slimStile.bounds.min.x,
    "fixed-inch Shaker and slim Shaker frames remain geometrically distinct"
  );
  assert.equal(
    plans.shaker.submeshes.find((submesh) => submesh.submeshId === "center-field").materialSlot,
    "front"
  );
  assert.deepEqual(plans.shaker.materialSlots, ["front"]);
  assert.equal(
    plans.glass.submeshes.find((submesh) => submesh.submeshId === "center-field").materialSlot,
    "glass"
  );
  assert.deepEqual(plans.glass.materialSlots, ["front", "glass"]);

  const topRail = plans.shaker.submeshes.find((submesh) => submesh.submeshId === "top_rail");
  const leftStile = plans.shaker.submeshes.find((submesh) => submesh.submeshId === "left_stile");
  const field = plans.shaker.submeshes.find((submesh) => submesh.submeshId === "center-field");
  assert.equal(topRail.grainRole, "front_rail");
  assert.equal(leftStile.grainRole, "front_stile");
  assert.equal(field.grainRole, "front_field");
  assert.equal(
    computePhysicalUvScales([
      topRail.bounds.max.x - topRail.bounds.min.x,
      topRail.bounds.max.y - topRail.bounds.min.y,
      topRail.bounds.max.z - topRail.bounds.min.z
    ], [24, 48], topRail.grainRole).orientation,
    "long-axis"
  );
  assert.equal(
    computePhysicalUvScales([
      leftStile.bounds.max.x - leftStile.bounds.min.x,
      leftStile.bounds.max.y - leftStile.bounds.min.y,
      leftStile.bounds.max.z - leftStile.bounds.min.z
    ], [24, 48], leftStile.grainRole).orientation,
    "vertical"
  );
});

test("accepted crown plans consume the authored normalized profile extrusion", () => {
  const layout = generateBookcaseLayout({
    width: 48,
    sections: 1,
    crownStyle: "classic_crown"
  });
  const crown = layout.components.find((component) => (
    component.role === "crown" && component.metadata?.hostSurface !== "side_panel"
  ));
  const plan = createGuidedAcceptedComponentRenderPlan(acceptedDescriptor(crown));

  assert.equal(plan.geometryVariant, "crown_profile_extrusion");
  assert.equal(plan.submeshes.length, 1);
  assert.equal(plan.submeshes[0].geometry, "crown_profile_extrusion");
  assert.equal(plan.submeshes[0].profileGeometry.kind, "crown_profile_extrusion");
  assert.ok(plan.submeshes[0].profileGeometry.outline.length >= 6);

  const geometry = createGuidedAcceptedProfileExtrusionGeometry(plan.submeshes[0], [24, 48]);
  const extrusionAxis = plan.submeshes[0].profileGeometry.extrusion.axis.toUpperCase();
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const coordinates = Array.from({ length: position.count }, (_, index) => (
    position[`get${extrusionAxis}`](index)
  ));
  const grainCoordinates = Array.from({ length: uv.count }, (_, index) => uv.getY(index));
  const physicalLength = plan.submeshes[0].profileGeometry.extrusion.max
    - plan.submeshes[0].profileGeometry.extrusion.min;
  assert.ok(Math.abs((Math.max(...grainCoordinates) - Math.min(...grainCoordinates)) - physicalLength / 48) < 1e-6);
  assert.ok(Math.max(...coordinates) > Math.min(...coordinates));
  assert.equal(geometry.attributes.uv2.count, geometry.attributes.uv.count);
  assert.equal(geometry.userData.guidedPhysicalUvs.orientation, "extrusion-axis");
  assert.equal(geometry.userData.guidedPhysicalUvs.units, "inches");
  geometry.dispose();
});

test("render-manifest audit exposes submesh material slots and world bounds", () => {
  const glass = canonicalFront("glass");
  const accepted = {
    product: {
      descriptorSets: [{
        id: "accepted-main",
        installationId: "installation-main",
        zoneId: "main",
        transform: identityTransform,
        components: [glass]
      }]
    }
  };
  const descriptor = createGuidedSceneDescriptors(accepted)[0];
  const plan = createGuidedAcceptedComponentRenderPlan(descriptor);
  const audit = validateGuidedRenderedManifest(accepted, [recordFromPlan(plan)]);

  assert.equal(audit.valid, true, JSON.stringify(audit.issues));
  assert.deepEqual(audit.records[0].materialSlots, ["front", "glass"]);
  assert.equal(audit.records[0].submeshes.length, 5);
  assert.ok(audit.records[0].submeshes.every((submesh) => submesh.worldBounds));

  const wrongGlass = recordFromPlan(plan);
  wrongGlass.materialSlots = ["front", "inset"];
  wrongGlass.submeshes = wrongGlass.submeshes.map((submesh) => (
    submesh.submeshId === "center-field"
      ? { ...submesh, materialSlot: "inset" }
      : submesh
  ));
  const rejected = validateGuidedRenderedManifest(accepted, [wrongGlass]);
  assert.equal(rejected.valid, false);
  assert.ok(rejected.issues.some((issue) => issue.code === "GLASS_FIELD_MATERIAL_MISMATCH"));
});
