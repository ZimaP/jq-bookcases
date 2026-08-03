import test from "node:test";
import assert from "node:assert/strict";

import {
  PHOTOREAL_MATRIX_WARM_HDR_SHA256,
  createCanonicalMatrixFixture,
  createPhotorealMatrixRenderPackage,
  discoverPhotorealMatrix,
  validatePhotorealMatrixRenderPackage
} from "../tools/blender/photoreal-matrix-contract.mjs";

test("photoreal discovery derives the exact authoritative 7x10 matrix", () => {
  const matrix = discoverPhotorealMatrix();
  assert.equal(matrix.products.length, 7);
  assert.equal(matrix.layouts.length, 10);
  assert.equal(matrix.totalCount, 70);
  assert.equal(matrix.validCount, 50);
  assert.equal(matrix.invalidCount, 20);
  assert.equal(new Set(matrix.combinations.map((entry) => entry.key)).size, 70);
  assert.equal(matrix.invalid.every((entry) => entry.compatibilityStatus === "unavailable"), true);
  assert.deepEqual(
    matrix.invalid.filter((entry) => entry.productId === "tv-unit").map((entry) => entry.layoutId),
    ["center-recess", "window-wall"]
  );
  assert.equal(matrix.invalid.filter((entry) => entry.productId === "window-storage").length, 9);
  assert.equal(matrix.invalid.filter((entry) => entry.productId === "radiator-cover").length, 9);
});

test("all 50 canonical fixtures accept and serialize authoritative descriptors/plans", () => {
  for (const entry of discoverPhotorealMatrix().valid) {
    const fixture = createCanonicalMatrixFixture(entry.productId, entry.layoutId);
    assert.equal(fixture.specification.accepted, true, entry.key);
    assert.equal(fixture.specification.audit.valid, true, entry.key);
    assert.equal(fixture.project.finish, "natural-oak", entry.key);
    if (entry.layoutId === "center-recess") {
      assert.equal(fixture.project.measurements.projectionDepth, 14, entry.key);
    }

    const renderPackage = createPhotorealMatrixRenderPackage(entry.productId, entry.layoutId);
    const validation = validatePhotorealMatrixRenderPackage(renderPackage);
    assert.equal(validation.valid, true, `${entry.key}: ${JSON.stringify(validation.errors)}`);
    assert.equal(renderPackage.geometry.descriptors.length, renderPackage.geometry.renderPlans.length, entry.key);
    assert.equal(renderPackage.capture.engine, "CYCLES", entry.key);
    assert.equal(renderPackage.capture.samples, 256, entry.key);
    assert.equal(renderPackage.output.publicWebp.width, 1920, entry.key);
    assert.equal(renderPackage.output.publicWebp.height, 1280, entry.key);
    assert.equal(renderPackage.output.publicWebp.quality, 92, entry.key);
    assert.equal(renderPackage.output.masterPng.colorDepth, 16, entry.key);
    assert.equal(renderPackage.authority.customerMaterialApproved, false, entry.key);
    assert.equal(renderPackage.authority.customerBeautyRenderApproved, false, entry.key);
    assert.equal(renderPackage.presentation.world.environmentSha256, PHOTOREAL_MATRIX_WARM_HDR_SHA256, entry.key);
  }
});

test("in-range Drawing 4 overrides keep constrained TV layouts accepted", () => {
  const expected = {
    "fireplace-wall": { wallWidth: 144, fireplaceWidth: 42, fireplaceHeight: 24, mantelWidth: 96 },
    "door-wall": { wallWidth: 144, doorLeftDistance: 104 },
    "double-opening": { wallWidth: 144, openingLeftDistance: 30, openingRightDistance: 12 }
  };
  for (const [layoutId, measurements] of Object.entries(expected)) {
    const fixture = createCanonicalMatrixFixture("tv-unit", layoutId);
    assert.equal(fixture.specification.accepted, true, layoutId);
    for (const [key, value] of Object.entries(measurements)) {
      assert.equal(fixture.project.measurements[key], value, `${layoutId}:${key}`);
    }
    assert.equal(fixture.project.measurements.tvScreenSize, 55);
    assert.equal(fixture.project.measurements.tvHeight, 28);
    assert.equal(fixture.project.measurements.soundbarRequired, "no");
  }
});

test("architectural feature bounds participate in beauty-camera framing", () => {
  const renderPackage = createPhotorealMatrixRenderPackage("tv-unit", "fireplace-wall");
  const productBounds = renderPackage.geometry.productBounds;
  const framingBounds = renderPackage.presentation.camera.framingBounds;
  assert.equal(productBounds.min.z, 1.016);
  assert.equal(framingBounds.min.z, 0);
  assert.equal(framingBounds.max.z, productBounds.max.z);
  assert.ok(renderPackage.presentation.camera.target.z < 1.6);
  assert.equal(validatePhotorealMatrixRenderPackage(renderPackage).valid, true);
});

test("matrix packages fail closed on approval or geometry-plan drift", () => {
  const approved = structuredClone(createPhotorealMatrixRenderPackage("cabinet-shelves", "clear-wall"));
  approved.authority.customerBeautyRenderApproved = true;
  assert.equal(validatePhotorealMatrixRenderPackage(approved, { regenerate: false }).errors[0].code, "CUSTOMER_BEAUTY_APPROVAL_FORBIDDEN");

  const drifted = structuredClone(createPhotorealMatrixRenderPackage("cabinet-shelves", "clear-wall"));
  drifted.geometry.renderPlans[0].worldBounds.max.x += 0.25;
  assert.equal(validatePhotorealMatrixRenderPackage(drifted, { regenerate: false }).errors[0].code, "DESCRIPTOR_PLAN_BOUNDS_MISMATCH");
});
