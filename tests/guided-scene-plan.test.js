import test from "node:test";
import assert from "node:assert/strict";

import {
  PRODUCT_CHOICES,
  SHARED_ROOM_LAYOUTS
} from "../guided-configurator-data.js";
import { createGuidedScenePlan } from "../guided-scene-plan.js";

const baseMeasurements = Object.freeze({
  wallWidth: 120,
  ceilingHeight: 96,
  desiredDepth: 14,
  nicheWidth: 96,
  nicheHeight: 90,
  nicheDepth: 14,
  leftReturn: 12,
  rightReturn: 12,
  windowWidth: 48,
  windowHeight: 42,
  sillHeight: 30,
  doorWidth: 36,
  doorHeight: 80,
  doorLeftDistance: 24,
  fireplaceWidth: 42,
  fireplaceHeight: 32,
  fireplaceDepth: 8,
  mantelWidth: 60,
  mantelHeight: 48,
  cornerReturn: 48,
  openingLeftDistance: 24,
  openingRightDistance: 24,
  tvScreenSize: 65,
  tvHeight: 33,
  radiatorWidth: 48,
  radiatorHeight: 26,
  radiatorDepth: 9
});

function projectFor(product, layout, overrides = {}) {
  return {
    category: product.categoryId,
    style: product.styleId,
    layout: layout.id,
    measurements: { ...baseMeasurements, ...overrides },
    finish: "natural-oak",
    accentFinish: "warm-linen",
    doorStyle: "shaker",
    hardware: "brass-pull",
    lighting: "warm-led",
    baseStyle: "flush-base",
    topTreatment: "small-crown"
  };
}

function assertFinite(value, path = "plan") {
  if (typeof value === "number") {
    assert.equal(Number.isFinite(value), true, `${path} must be finite`);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assertFinite(child, `${path}.${key}`);
  }
}

function assertPositiveBounds(bounds, label) {
  assert.ok(bounds.max.x > bounds.min.x, `${label} width`);
  assert.ok(bounds.max.y > bounds.min.y, `${label} height`);
  assert.ok(bounds.max.z > bounds.min.z, `${label} depth`);
}

test("all 70 public product and room combinations create finite spatial plans", () => {
  for (const product of PRODUCT_CHOICES) {
    for (const layout of SHARED_ROOM_LAYOUTS) {
      const plan = createGuidedScenePlan(projectFor(product, layout));
      assert.equal(plan.version, 1);
      assert.equal(plan.units, "inches");
      assert.equal(plan.purpose, "guided-concept-only");
      assert.equal(plan.room.layoutId, layout.id);
      assert.equal(plan.selection.categoryId, product.categoryId);
      assert.equal(plan.selection.styleId, product.styleId);
      assert.ok(plan.room.surfaces.length >= 4);
      assert.ok(plan.targetZones.length >= 1);
      assert.ok(plan.dimensionCallouts.length >= 3);
      if (product.categoryId === "tv-unit") {
        assert.equal(plan.room.features.some((feature) => feature.kind === "tv-screen"), true);
      }
      if (product.categoryId === "window-storage") {
        assert.equal(plan.room.features.some((feature) => feature.kind === "window"), true);
      }
      if (product.categoryId === "radiator-cover") {
        assert.equal(plan.room.features.some((feature) => feature.kind === "radiator"), true);
      }
      plan.dimensionCallouts.forEach((callout) => {
        const spatialLength = Math.hypot(
          callout.end.x - callout.start.x,
          callout.end.y - callout.start.y,
          callout.end.z - callout.start.z
        );
        assert.ok(
          Math.abs(callout.value - spatialLength) < 0.001,
          `${product.id}/${layout.id}/${callout.fieldId} callout value matches its geometry`
        );
      });
      assertFinite(plan);
      assertPositiveBounds(plan.room.bounds, `${product.id}/${layout.id} room`);
      plan.targetZones.forEach((zone) => {
        assertPositiveBounds(zone.bounds, `${product.id}/${layout.id}/${zone.id}`);
      });
    }
  }
});

test("room measurements reshape geometry and world-space dimension anchors", () => {
  const product = PRODUCT_CHOICES.find((candidate) => candidate.id === "cabinet-shelves");
  const layout = SHARED_ROOM_LAYOUTS.find((candidate) => candidate.id === "left-niche");
  const first = createGuidedScenePlan(projectFor(product, layout));
  const second = createGuidedScenePlan(projectFor(product, layout, {
    wallWidth: 132,
    nicheWidth: 84,
    nicheDepth: 18
  }));

  assert.equal(first.room.bounds.size.width, 120);
  assert.equal(second.room.bounds.size.width, 132);
  assert.equal(first.room.features[0].bounds.size.width, 96);
  assert.equal(second.room.features[0].bounds.size.width, 84);
  assert.equal(second.room.features[0].bounds.size.depth, 18);
  assert.notDeepEqual(first.targetZones[0].bounds, second.targetZones[0].bounds);
  assert.notDeepEqual(
    first.dimensionCallouts.find((callout) => callout.fieldId === "nicheWidth"),
    second.dimensionCallouts.find((callout) => callout.fieldId === "nicheWidth")
  );
});

test("niche product geometry shares the recess coordinate space", () => {
  const product = PRODUCT_CHOICES.find((candidate) => candidate.id === "drawer-shelves");
  const layout = SHARED_ROOM_LAYOUTS.find((candidate) => candidate.id === "niche-layout");
  const plan = createGuidedScenePlan(projectFor(product, layout));
  const recess = plan.room.features.find((candidate) => candidate.kind === "recess");
  const zone = plan.targetZones[0];

  assert.ok(recess);
  assert.ok(zone.bounds.min.x >= recess.bounds.min.x);
  assert.ok(zone.bounds.max.x <= recess.bounds.max.x);
  assert.equal(zone.bounds.max.z, recess.bounds.max.z);
  assert.equal(zone.frame.depthAxis.z, 1);
  assert.equal(plan.room.surfaces.some((surface) => surface.kind === "recess-back"), true);
});

test("the planner is deterministic, immutable, and contains no photographic assets", () => {
  const project = projectFor(PRODUCT_CHOICES[0], SHARED_ROOM_LAYOUTS[0]);
  const first = createGuidedScenePlan(project);
  const second = createGuidedScenePlan(project);

  assert.deepEqual(first, second);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.room.surfaces), true);
  assert.doesNotMatch(JSON.stringify(first), /\.(?:png|avif|jpe?g|webp)/i);
  assert.equal(project.measurements.wallWidth, 120);
});

test("clamped geometry reports both the shown and entered dimension without a false label", () => {
  const product = PRODUCT_CHOICES.find((candidate) => candidate.id === "cabinet-shelves");
  const layout = SHARED_ROOM_LAYOUTS.find((candidate) => candidate.id === "niche-layout");
  const plan = createGuidedScenePlan(projectFor(product, layout, {
    wallWidth: 120,
    ceilingHeight: 96,
    nicheWidth: 180,
    nicheHeight: 120
  }));
  const width = plan.dimensionCallouts.find((callout) => callout.fieldId === "nicheWidth");
  const height = plan.dimensionCallouts.find((callout) => callout.fieldId === "nicheHeight");

  assert.equal(width.value, 120);
  assert.equal(width.enteredValue, 180);
  assert.equal(width.adjusted, true);
  assert.equal(height.value, 96);
  assert.equal(height.enteredValue, 120);
  assert.equal(height.adjusted, true);
});

test("zero-valued edge measurements remain zero instead of reverting to defaults", () => {
  const product = PRODUCT_CHOICES.find((candidate) => candidate.id === "cabinet-shelves");
  const layout = (id) => SHARED_ROOM_LAYOUTS.find((candidate) => candidate.id === id);
  const callout = (plan, fieldId) => (
    plan.dimensionCallouts.find((candidate) => candidate.fieldId === fieldId)
  );

  const leftNiche = createGuidedScenePlan(projectFor(product, layout("left-niche"), {
    nicheWidth: 96,
    leftReturn: 0,
    rightReturn: 24
  }));
  const niche = leftNiche.room.features.find((feature) => feature.kind === "recess");
  assert.equal(leftNiche.measurements.leftReturn, 0);
  assert.equal(niche.bounds.max.x, leftNiche.room.bounds.max.x);

  const doorWall = createGuidedScenePlan(projectFor(product, layout("door-wall"), {
    doorLeftDistance: 0
  }));
  const door = doorWall.room.features.find((feature) => feature.kind === "door");
  assert.equal(door.bounds.max.x, doorWall.room.bounds.max.x);
  assert.equal(callout(doorWall, "doorLeftDistance").value, 0);
  assert.equal(callout(doorWall, "doorLeftDistance").adjusted, false);

  const doubleOpening = createGuidedScenePlan(projectFor(product, layout("double-opening"), {
    openingLeftDistance: 0,
    openingRightDistance: 0
  }));
  assert.equal(doubleOpening.room.features.some((feature) => feature.kind === "opening"), false);
  assert.equal(callout(doubleOpening, "openingLeftDistance").value, 0);
  assert.equal(callout(doubleOpening, "openingRightDistance").value, 0);
  assert.equal(callout(doubleOpening, "openingLeftDistance").adjusted, false);
  assert.equal(callout(doubleOpening, "openingRightDistance").adjusted, false);

  const fireplaceWall = createGuidedScenePlan(projectFor(product, layout("fireplace-wall"), {
    fireplaceDepth: 0
  }));
  const fireplace = fireplaceWall.room.features.find((feature) => feature.kind === "fireplace");
  assert.equal(fireplaceWall.measurements.fireplaceDepth, 0);
  assert.equal(fireplace.bounds.size.depth, 0);
});

test("category features avoid incompatible architectural openings and every zone overlap is explicit", () => {
  const architecturalKinds = new Set(["door", "window", "opening", "fireplace", "projection"]);

  for (const product of PRODUCT_CHOICES) {
    for (const layout of SHARED_ROOM_LAYOUTS) {
      const plan = createGuidedScenePlan(projectFor(product, layout));
      const inherentFeature = plan.room.features.find((feature) => ({
        "tv-unit": feature.kind === "tv-screen",
        "window-storage": feature.kind === "window",
        "radiator-cover": feature.kind === "radiator"
      })[product.categoryId]);
      const architecturalFeatures = plan.room.features.filter((feature) => (
        architecturalKinds.has(feature.kind)
        && feature !== inherentFeature
        && !(product.categoryId === "tv-unit" && feature.kind === "projection")
      ));

      if (inherentFeature) {
        architecturalFeatures.forEach((feature) => {
          assert.equal(
            boundsOverlap(inherentFeature.bounds, feature.bounds),
            false,
            `${product.id}/${layout.id} ${inherentFeature.kind} avoids ${feature.kind}`
          );
        });
      }

      plan.targetZones.forEach((zone) => {
        architecturalFeatures.forEach((feature) => {
          if (!boundsOverlap(zone.bounds, feature.bounds)) return;
          assert.equal(
            zone.excludes.includes(feature.id),
            true,
            `${product.id}/${layout.id}/${zone.id} declares ${feature.id} as an exclusion`
          );
        });
      });
    }
  }

  function boundsOverlap(first, second) {
    return (
      Math.min(first.max.x, second.max.x) - Math.max(first.min.x, second.min.x) > 0.001
      && Math.min(first.max.y, second.max.y) - Math.max(first.min.y, second.min.y) > 0.001
      && Math.min(first.max.z, second.max.z) - Math.max(first.min.z, second.min.z) > 0.001
    );
  }
});
