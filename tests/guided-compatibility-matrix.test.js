import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  PRODUCT_CHOICES,
  SHARED_ROOM_LAYOUTS,
  getMeasurementFields
} from "../guided-configurator-data.js";
import {
  createProject,
  normalizeProject,
  prepareMeasurementsForLayout
} from "../guided-configurator-state.js";
import {
  GUIDED_PRODUCT_LAYOUT_COMPATIBILITY
} from "../guided-product-adapter.js";
import { evaluateGuidedProjectCandidate } from "../guided-project-engine.js";
import { resolveRoomTopology } from "../guided-room-topology.js";

const configuredMatrix = JSON.parse(readFileSync(
  new URL("../config/product-layout-compatibility.json", import.meta.url),
  "utf8"
)).matrix;

function candidate(choice, layoutId, overrides = {}) {
  const initial = createProject({ category: choice.categoryId, now: 1 });
  const measurements = prepareMeasurementsForLayout(initial, layoutId);
  Object.assign(measurements, overrides);
  return normalizeProject({
    ...initial,
    productSelected: true,
    style: choice.styleId,
    layout: layoutId,
    measurements
  }, { now: 1 });
}

const reachableConditionalOverrides = Object.freeze({
  "tv-unit:fireplace-wall": Object.freeze({
    ceilingHeight: 120,
    fireplaceHeight: 30,
    mantelHeight: 30,
    tvAboveFireplace: "yes",
    tvScreenSize: 55,
    tvHeight: 28,
    soundbarRequired: "no"
  }),
  "tv-unit:door-wall": Object.freeze({
    wallWidth: 144,
    doorLeftDistance: 4,
    tvScreenSize: 55,
    tvHeight: 28,
    soundbarRequired: "no"
  })
});

test("the shipped and executable 7 by 10 compatibility matrices are identical", () => {
  assert.equal(PRODUCT_CHOICES.length, 7);
  assert.equal(SHARED_ROOM_LAYOUTS.length, 10);
  assert.deepEqual(GUIDED_PRODUCT_LAYOUT_COMPATIBILITY, configuredMatrix);
});

test("supported defaults accept, conditionals are UI-reachable, and impossible pairs fail closed", () => {
  for (const choice of PRODUCT_CHOICES) {
    for (const layout of SHARED_ROOM_LAYOUTS) {
      const status = GUIDED_PRODUCT_LAYOUT_COMPATIBILITY[choice.id][layout.id];
      const key = `${choice.id}:${layout.id}`;
      const project = candidate(choice, layout.id, reachableConditionalOverrides[key]);
      const result = evaluateGuidedProjectCandidate(project);

      if (status === "unavailable") {
        assert.equal(result.accepted, false, key);
        assert.equal(result.errors[0]?.code, "UNSUPPORTED_PRODUCT_LAYOUT", key);
        continue;
      }

      assert.equal(result.accepted, true, `${key}: ${JSON.stringify(result.errors || [])}`);
      if (status === "review-only" || key === "tv-unit:fireplace-wall") {
        assert.ok(
          result.warnings.some((warning) => warning.code === "PRODUCT_LAYOUT_REVIEW_REQUIRED"),
          `${key} must carry its manual-design warning`
        );
      }
    }
  }
});

test("the measurement schema exposes only dimensions consumed by each topology", () => {
  const ids = (layoutId) => getMeasurementFields("bookcase", layoutId).map((field) => field.id);
  assert.ok(ids("left-niche").includes("leftReturn"));
  assert.ok(!ids("left-niche").includes("rightReturn"));
  assert.ok(ids("right-niche").includes("rightReturn"));
  assert.ok(!ids("right-niche").includes("leftReturn"));
  assert.ok(!ids("window-wall").includes("leftReturn"));
  assert.ok(!ids("window-wall").includes("rightReturn"));
  assert.ok(ids("center-recess").includes("projectionWidth"));
  assert.ok(ids("center-recess").includes("projectionHeight"));
  assert.ok(ids("center-recess").includes("projectionDepth"));
  assert.ok(!ids("center-recess").includes("nicheWidth"));
});

test("every exposed room dimension changes topology or produces a named validation result", () => {
  const choice = PRODUCT_CHOICES.find((item) => item.id === "cabinet-shelves");
  for (const layout of SHARED_ROOM_LAYOUTS) {
    const baseProject = candidate(choice, layout.id);
    const baseTopology = resolveRoomTopology(baseProject);
    assert.equal(baseTopology.accepted, true, layout.id);

    for (const field of getMeasurementFields(choice.categoryId, layout.id)) {
      if (field.type !== "inches") continue;
      const current = baseProject.measurements[field.id];
      const nextValue = current === null
        ? field.min
        : Math.min(field.max, Number(current) + 1);
      if (nextValue === current) continue;
      const changedProject = normalizeProject({
        ...baseProject,
        measurements: { ...baseProject.measurements, [field.id]: nextValue }
      }, { now: 2 });
      const changedTopology = resolveRoomTopology(changedProject);
      if (!changedTopology.accepted) {
        assert.match(changedTopology.errors?.[0]?.code || "", /^[A-Z][A-Z0-9_]+$/, `${layout.id}:${field.id}`);
        continue;
      }
      assert.notDeepEqual(changedTopology, baseTopology, `${layout.id}:${field.id} was silently ignored`);
    }
  }
});
