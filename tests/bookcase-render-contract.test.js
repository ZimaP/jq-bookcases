import test from "node:test";
import assert from "node:assert/strict";

import { defaultBookcaseConfig, layoutPresets } from "../bookcase-config.js";
import { generateBookcaseLayout } from "../bookcase-layout.js";
import {
  SCENE_UNITS_PER_INCH,
  createExpectedRenderManifest,
  descriptorToSceneBounds,
  sceneBoundsCenter,
  sceneBoundsContain,
  sceneBoundsSize,
  validateRenderedManifest
} from "../bookcase-render-contract.js";

const clone = (value) => JSON.parse(JSON.stringify(value));
const approximately = (actual, expected, epsilon = 1e-9) => {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `${actual} is not approximately ${expected}`
  );
};

test("descriptor conversion preserves dimensions and inverts layout Z", () => {
  const layout = generateBookcaseLayout(defaultBookcaseConfig);
  const door = layout.components.find((component) => component.role === "door");
  const bounds = descriptorToSceneBounds(door, layout.config.depth);
  const size = sceneBoundsSize(bounds);
  const center = sceneBoundsCenter(bounds);

  approximately(size.x, door.size.x * SCENE_UNITS_PER_INCH);
  approximately(size.y, door.size.y * SCENE_UNITS_PER_INCH);
  approximately(size.z, door.size.z * SCENE_UNITS_PER_INCH);
  approximately(center.x, door.position.x * SCENE_UNITS_PER_INCH);
  approximately(center.y, door.position.y * SCENE_UNITS_PER_INCH);
  approximately(
    center.z,
    layout.config.depth * SCENE_UNITS_PER_INCH / 2 - door.position.z * SCENE_UNITS_PER_INCH
  );
  assert.ok(bounds.min.z < bounds.max.z);
});

test("every preset produces a complete deterministic physical render manifest", () => {
  for (const preset of layoutPresets) {
    const layout = generateBookcaseLayout(preset.config);
    const first = createExpectedRenderManifest(layout);
    const second = createExpectedRenderManifest(generateBookcaseLayout(preset.config));

    assert.deepEqual(first, second, preset.id);
    assert.ok(first.length > 0, preset.id);
    assert.equal(new Set(first.map((entry) => entry.componentId)).size, first.length, preset.id);
    assert.ok(first.every((entry) => entry.size.x > 0 && entry.size.y > 0 && entry.size.z > 0), preset.id);
  }
});

test("an exact descriptor-backed scene passes the renderer contract", () => {
  const layout = generateBookcaseLayout(defaultBookcaseConfig);
  const manifest = createExpectedRenderManifest(layout);
  const records = manifest.map((entry) => ({
    componentId: entry.componentId,
    meshCount: 1,
    bounds: clone(entry.bounds)
  }));
  const audit = validateRenderedManifest(layout, records);

  assert.equal(audit.valid, true, JSON.stringify(audit.issues));
  assert.equal(audit.expectedCount, manifest.length);
  assert.equal(audit.renderedCount, manifest.length);
});

test("visual details may stay inside a descriptor envelope", () => {
  const layout = generateBookcaseLayout(defaultBookcaseConfig);
  const manifest = createExpectedRenderManifest(layout);
  const records = manifest.map((entry) => {
    const inset = 0.0001;
    return {
      componentId: entry.componentId,
      meshCount: 2,
      bounds: {
        min: {
          x: entry.bounds.min.x + inset,
          y: entry.bounds.min.y + inset,
          z: entry.bounds.min.z + inset
        },
        max: {
          x: entry.bounds.max.x - inset,
          y: entry.bounds.max.y - inset,
          z: entry.bounds.max.z - inset
        }
      }
    };
  });

  assert.equal(validateRenderedManifest(layout, records).valid, true);
});

test("missing, duplicate, empty, unexpected, and oversized render output is rejected", () => {
  const layout = generateBookcaseLayout(defaultBookcaseConfig);
  const manifest = createExpectedRenderManifest(layout);
  const records = manifest.slice(1).map((entry) => ({
    componentId: entry.componentId,
    meshCount: 1,
    bounds: clone(entry.bounds)
  }));

  const oversized = records[0];
  oversized.bounds.max.x += 1;
  records[1].meshCount = 0;
  records.push(clone(records[2]));
  records.push({
    componentId: "invented-decoration",
    meshCount: 1,
    bounds: clone(manifest[0].bounds)
  });

  const audit = validateRenderedManifest(layout, records);
  const codes = audit.issues.map((item) => item.code);

  assert.equal(audit.valid, false);
  assert.ok(codes.includes("MISSING_RENDER_COMPONENT"));
  assert.ok(codes.includes("DUPLICATE_RENDER_COMPONENT"));
  assert.ok(codes.includes("EMPTY_RENDER_COMPONENT"));
  assert.ok(codes.includes("UNEXPECTED_RENDER_COMPONENT"));
  assert.ok(codes.includes("RENDER_OUTSIDE_DESCRIPTOR"));
});

test("scene containment honors tolerance but not real overhang", () => {
  const container = {
    min: { x: 0, y: 0, z: 0 },
    max: { x: 1, y: 1, z: 1 }
  };
  const roundingNoise = {
    min: { x: -1e-6, y: 0, z: 0 },
    max: { x: 1, y: 1 + 1e-6, z: 1 }
  };
  const overhang = {
    min: { x: -0.01, y: 0, z: 0 },
    max: { x: 1, y: 1, z: 1 }
  };

  assert.equal(sceneBoundsContain(container, roundingNoise, 1e-5), true);
  assert.equal(sceneBoundsContain(container, overhang, 1e-5), false);
});
