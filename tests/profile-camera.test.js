import test from "node:test";
import assert from "node:assert/strict";

import {
  PROFILE_CAMERA_DURATION,
  PROFILE_CAMERA_KEYS,
  calculateProfileCameraPose,
  createProfileFocusRegion,
  isProfileCameraKey,
  resolveCameraTransitionDuration
} from "../profile-camera.js";

const DEFAULT_MODEL = bounds(-48, 0, 0, 48, 96, 15);
const BASE_FEATURE = bounds(-50, -1, -1, 50, 5, 18);
const CROWN_FEATURE = bounds(-51, 92, -1, 51, 101, 19);
const DEFAULT_VIEWPORT = {
  width: 1200,
  height: 800,
  insets: { top: 24, right: 96, bottom: 72, left: 0 }
};

test("profile camera exports an immutable read-only key collection", () => {
  assert.equal(PROFILE_CAMERA_DURATION, 760);
  assert.equal(Object.isFrozen(PROFILE_CAMERA_KEYS), true);
  assert.deepEqual([...PROFILE_CAMERA_KEYS], ["base", "crown"]);
  assert.equal(PROFILE_CAMERA_KEYS.size, 2);
  assert.equal(PROFILE_CAMERA_KEYS.has("base"), true);
  assert.equal(PROFILE_CAMERA_KEYS.has("crown"), true);
  assert.equal("add" in PROFILE_CAMERA_KEYS, false);
  assert.equal(isProfileCameraKey("base"), true);
  assert.equal(isProfileCameraKey("crown"), true);
  assert.equal(isProfileCameraKey("doors"), false);
  assert.equal(isProfileCameraKey(null), false);
});

test("camera duration honors reduced motion and clamps normal transitions", () => {
  assert.equal(resolveCameraTransitionDuration(PROFILE_CAMERA_DURATION, false), 760);
  assert.equal(resolveCameraTransitionDuration(PROFILE_CAMERA_DURATION, true), 0);
  assert.equal(resolveCameraTransitionDuration(100, false), 320);
  assert.equal(resolveCameraTransitionDuration(1200, false), 900);
  assert.equal(resolveCameraTransitionDuration(0, false), 0);
});

test("focus regions anchor to the left-front corner and retain the complete return depth", () => {
  const base = createProfileFocusRegion({
    kind: "base",
    modelBounds: DEFAULT_MODEL,
    featureBounds: BASE_FEATURE
  });
  const crown = createProfileFocusRegion({
    kind: "crown",
    modelBounds: DEFAULT_MODEL,
    featureBounds: CROWN_FEATURE
  });

  for (const region of [base, crown]) {
    assert.ok(region.min.x <= DEFAULT_MODEL.min.x);
    assert.ok(region.max.x < 0, "the crop should stay on the left side of a wide model");
    assert.equal(region.min.z, -1);
    assert.ok(region.max.z >= 18);
  }
  assert.equal(base.min.x, BASE_FEATURE.min.x);
  assert.equal(crown.min.x, CROWN_FEATURE.min.x);
  assert.equal(base.max.z, BASE_FEATURE.max.z);
  assert.equal(crown.max.z, CROWN_FEATURE.max.z);
});

test("base context extends upward and crown context extends downward from the selected feature", () => {
  const base = createProfileFocusRegion({
    kind: "base",
    modelBounds: DEFAULT_MODEL,
    featureBounds: BASE_FEATURE
  });
  const crown = createProfileFocusRegion({
    kind: "crown",
    modelBounds: DEFAULT_MODEL,
    featureBounds: CROWN_FEATURE
  });

  assert.equal(base.min.y, BASE_FEATURE.min.y);
  assert.ok(base.max.y > BASE_FEATURE.max.y);
  assert.equal(crown.max.y, CROWN_FEATURE.max.y);
  assert.ok(crown.min.y < CROWN_FEATURE.min.y);
  assert.ok(base.max.y < DEFAULT_MODEL.max.y / 2);
  assert.ok(crown.min.y > DEFAULT_MODEL.max.y / 2);
});

test("camera poses use the requested three-quarter base and crown elevations", () => {
  const base = pose("base", DEFAULT_MODEL, BASE_FEATURE);
  const crown = pose("crown", DEFAULT_MODEL, CROWN_FEATURE);

  assert.equal(base.theta, -0.62);
  assert.equal(crown.theta, -0.62);
  assert.equal(base.phi, 0.11);
  assert.equal(crown.phi, -0.08);
  assert.ok(base.focusCenter.x < 0 && crown.focusCenter.x < 0);
  assert.ok(base.focusCenter.z > 0 && crown.focusCenter.z > 0);
  assert.ok(base.focusCenter.y < DEFAULT_MODEL.max.y / 2);
  assert.ok(crown.focusCenter.y > DEFAULT_MODEL.max.y / 2);
});

test("profile framing scales linearly with generated geometry instead of fixed world coordinates", () => {
  for (const kind of ["base", "crown"]) {
    const feature = kind === "base" ? BASE_FEATURE : CROWN_FEATURE;
    const original = pose(kind, DEFAULT_MODEL, feature);
    const doubled = pose(kind, scaleBounds(DEFAULT_MODEL, 2), scaleBounds(feature, 2));

    approximately(doubled.radius, original.radius * 2);
    for (const key of ["target", "focusCenter"]) {
      for (const axis of ["x", "y", "z"]) approximately(doubled[key][axis], original[key][axis] * 2);
    }
    for (const endpoint of ["min", "max"]) {
      for (const axis of ["x", "y", "z"]) approximately(doubled.region[endpoint][axis], original.region[endpoint][axis] * 2);
    }
  }
});

test("minimum, maximum, tall, narrow, and deep geometry all produce finite poses", () => {
  const scenarios = [
    { model: bounds(-12, 0, 0, 12, 72, 10), baseHeight: 3, crownHeight: 3 },
    { model: bounds(-72, 0, 0, 72, 120, 24), baseHeight: 8, crownHeight: 12 },
    { model: bounds(-18, 0, 0, 18, 120, 10), baseHeight: 4, crownHeight: 8 },
    { model: bounds(-12, 0, 0, 12, 72, 24), baseHeight: 7, crownHeight: 9 },
    { model: bounds(-72, 0, 0, 72, 72, 10), baseHeight: 3, crownHeight: 4 }
  ];

  for (const scenario of scenarios) {
    const { model, baseHeight, crownHeight } = scenario;
    const projection = Math.max(1, (model.max.z - model.min.z) * 0.12);
    const baseFeature = bounds(
      model.min.x - projection,
      model.min.y,
      model.min.z,
      model.max.x + projection,
      model.min.y + baseHeight,
      model.max.z + projection
    );
    const crownFeature = bounds(
      model.min.x - projection,
      model.max.y - crownHeight,
      model.min.z,
      model.max.x + projection,
      model.max.y + crownHeight * 0.2,
      model.max.z + projection
    );

    for (const [kind, feature] of [["base", baseFeature], ["crown", crownFeature]]) {
      const result = pose(kind, model, feature);
      assert.ok(result.radius > 0);
      for (const value of [
        result.theta,
        result.phi,
        result.radius,
        ...Object.values(result.target),
        ...Object.values(result.focusCenter),
        ...Object.values(result.region.min),
        ...Object.values(result.region.max)
      ]) assert.equal(Number.isFinite(value), true);
      assert.ok(result.region.max.x > result.region.min.x);
      assert.ok(result.region.max.y > result.region.min.y);
      assert.ok(result.region.max.z > result.region.min.z);
    }
  }
});

test("portrait and occluded viewports increase distance to keep the profile visible", () => {
  const desktop = calculateProfileCameraPose({
    kind: "base",
    modelBounds: DEFAULT_MODEL,
    featureBounds: BASE_FEATURE,
    verticalFovDegrees: 34,
    aspect: 1.5,
    viewport: { width: 1200, height: 800, insets: {} }
  });
  const portrait = calculateProfileCameraPose({
    kind: "base",
    modelBounds: DEFAULT_MODEL,
    featureBounds: BASE_FEATURE,
    verticalFovDegrees: 34,
    aspect: 390 / 800,
    viewport: { width: 390, height: 800, insets: {} }
  });
  const occluded = calculateProfileCameraPose({
    kind: "base",
    modelBounds: DEFAULT_MODEL,
    featureBounds: BASE_FEATURE,
    verticalFovDegrees: 34,
    aspect: 1.5,
    viewport: {
      width: 1200,
      height: 800,
      insets: { top: 110, right: 210, bottom: 150, left: 280 }
    }
  });

  assert.ok(portrait.radius > desktop.radius);
  assert.ok(occluded.radius > desktop.radius);
  assert.ok(occluded.viewport.safeFraction.x < desktop.viewport.safeFraction.x);
  assert.ok(occluded.viewport.safeFraction.y < desktop.viewport.safeFraction.y);
});

test("all eight profile-region corners fit inside the unobstructed safe rectangle", () => {
  for (const [kind, feature] of [["base", BASE_FEATURE], ["crown", CROWN_FEATURE]]) {
    const result = pose(kind, DEFAULT_MODEL, feature);
    for (const corner of cornersOf(result.region)) {
      const pixel = projectToViewport(corner, result, 34, 1.5);
      assert.ok(pixel.x >= result.viewport.safeRect.left - 1e-6, `${kind} corner is left-clipped`);
      assert.ok(pixel.x <= result.viewport.safeRect.right + 1e-6, `${kind} corner is right-clipped`);
      assert.ok(pixel.y >= result.viewport.safeRect.top - 1e-6, `${kind} corner is top-clipped`);
      assert.ok(pixel.y <= result.viewport.safeRect.bottom + 1e-6, `${kind} corner is bottom-clipped`);
    }
  }
});

test("the viewport-aware target projects the profile focus to the safe-rect center", () => {
  const result = calculateProfileCameraPose({
    kind: "crown",
    modelBounds: DEFAULT_MODEL,
    featureBounds: CROWN_FEATURE,
    verticalFovDegrees: 34,
    aspect: 10 / 7,
    viewport: {
      width: 1000,
      height: 700,
      insets: { top: 60, right: 80, bottom: 140, left: 260 }
    }
  });
  const projectedFocus = projectToViewport(result.focusCenter, result, 34, 10 / 7);

  approximately(projectedFocus.x, result.viewport.safeRect.centerX, 1e-9);
  approximately(projectedFocus.y, result.viewport.safeRect.centerY, 1e-9);
  assert.notDeepEqual(result.target, result.focusCenter);
  assert.notEqual(result.viewport.safeCenterNdc.x, 0);
  assert.notEqual(result.viewport.safeCenterNdc.y, 0);
});

function pose(kind, modelBounds, featureBounds) {
  return calculateProfileCameraPose({
    kind,
    modelBounds,
    featureBounds,
    verticalFovDegrees: 34,
    aspect: 1.5,
    viewport: DEFAULT_VIEWPORT
  });
}

function bounds(minX, minY, minZ, maxX, maxY, maxZ) {
  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ }
  };
}

function scaleBounds(value, scale) {
  return {
    min: Object.fromEntries(Object.entries(value.min).map(([axis, coordinate]) => [axis, coordinate * scale])),
    max: Object.fromEntries(Object.entries(value.max).map(([axis, coordinate]) => [axis, coordinate * scale]))
  };
}

function cornersOf(value) {
  const corners = [];
  for (const x of [value.min.x, value.max.x]) {
    for (const y of [value.min.y, value.max.y]) {
      for (const z of [value.min.z, value.max.z]) corners.push({ x, y, z });
    }
  }
  return corners;
}

function projectToViewport(point, poseValue, verticalFovDegrees, aspect) {
  const { direction, right, up } = cameraAxes(poseValue.theta, poseValue.phi);
  const relative = subtract(point, poseValue.target);
  const depth = poseValue.radius - dot(relative, direction);
  assert.ok(depth > 0, "projected point must remain in front of the camera");
  const tanVertical = Math.tan(verticalFovDegrees * Math.PI / 360);
  const tanHorizontal = tanVertical * aspect;
  const ndcX = dot(relative, right) / (depth * tanHorizontal);
  const ndcY = dot(relative, up) / (depth * tanVertical);
  return {
    x: (ndcX + 1) * poseValue.viewport.width / 2,
    y: (1 - ndcY) * poseValue.viewport.height / 2
  };
}

function cameraAxes(theta, phi) {
  const sinTheta = Math.sin(theta);
  const cosTheta = Math.cos(theta);
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  return {
    direction: { x: sinTheta * cosPhi, y: sinPhi, z: cosTheta * cosPhi },
    right: { x: cosTheta, y: 0, z: -sinTheta },
    up: { x: -sinTheta * sinPhi, y: cosPhi, z: -cosTheta * sinPhi }
  };
}

function subtract(left, right) {
  return { x: left.x - right.x, y: left.y - right.y, z: left.z - right.z };
}

function dot(left, right) {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function approximately(actual, expected, epsilon = 1e-8) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `${actual} is not approximately ${expected}`
  );
}
