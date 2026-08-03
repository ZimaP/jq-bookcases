import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  boundsIntersect,
  generateBookcaseLayout
} from "../bookcase-layout.js";
import {
  GUIDED_PRODUCT_ENGINE_FAILURES,
  evaluateGuidedProductCandidate
} from "../guided-product-engine.js";
import { evaluateGuidedProjectCandidate } from "../guided-project-engine.js";
import {
  EXPECTED_DRAWING_4_GEOMETRY_FINGERPRINT,
  EXPECTED_DRAWING_4_RENDER_KEY,
  EXPECTED_DRAWING_4_REQUEST_KEY,
  createVerifiedClayRenderPackage
} from "../tools/blender/run-clay-worker.mjs";

const fixture = JSON.parse(readFileSync(
  new URL("./fixtures/blender-prototype/TV01-clear-wall-foundation.json", import.meta.url),
  "utf8"
));
const EXPECTED_GEOMETRY_FINGERPRINT = "jq-guided-geometry-v1-028YPJG43EJF6";
const SET_PREFIX = "guided-installation-main/";
const EXPECTED_CUSTOMER_CAMERA = {
  cameraVersion: "hero-front-v1",
  type: "PERSP",
  lensMm: 50,
  sensorWidthMm: 36,
  sensorFit: "HORIZONTAL",
  depthOfField: false,
  fitMargin: 1.14,
  position: { x: 0, y: 6.1722, z: 1.2192 },
  target: { x: 0, y: 0.1905, z: 1.2192 },
  up: [0, 0, 1],
  clipStartM: 0.05,
  clipEndM: 25,
  framingBounds: {
    min: { x: -1.524, y: 0, z: 0 },
    max: { x: 1.524, y: 0.381, z: 2.4383999999999997 }
  }
};
const EXPECTED_PRICING_RATES = [
  ["BASE_PROJECT", 1900],
  ["ENVELOPE_AREA", 85],
  ["SECTIONS", 250],
  ["ADJUSTABLE_SHELVES", 55],
  ["CONTINUOUS_COUNTERTOP", 55],
  ["SHELF_THICKNESS_1_IN", 28.13],
  ["SHELF_THICKNESS_1_25_IN", 56.25],
  ["LOWER_STORAGE", 18],
  ["DOOR_STYLE_SHAKER", 0],
  ["HARDWARE_MATTE_BLACK_PULL", 21.88],
  ["LIGHTING_PUCK", 112.5],
  ["CROWN_STYLE", 250],
  ["BASE_STYLE", 250],
  ["INSTALLATION", 1404],
  ["DELIVERY", 250]
];

function evaluateFixture() {
  const result = evaluateGuidedProjectCandidate(structuredClone(fixture.project));
  assert.equal(result.accepted, true, JSON.stringify(result.errors));
  return result;
}

function evaluateWithTreatmentChanges(specification, changes) {
  const fit = structuredClone(specification.fit);
  Object.assign(fit.installations[0].treatments, structuredClone(changes));
  fit.treatments = structuredClone(fit.installations[0].treatments);
  return evaluateGuidedProductCandidate({
    project: structuredClone(fixture.project),
    topology: structuredClone(specification.room),
    fit
  });
}

function componentBySuffix(components, suffix) {
  return components.find((component) => component.id.endsWith(`/${suffix}`));
}

function crownComponents(result) {
  return result.descriptorSets[0].components.filter((component) => component.role === "crown");
}

function fillerComponents(result) {
  return result.descriptorSets[0].components.filter((component) => component.role === "filler");
}

test("standalone Small Crown retains its authored front run and both exposed-end returns", () => {
  const specification = evaluateFixture();
  const standalone = generateBookcaseLayout(specification.product.canonicalConfig);
  const crowns = standalone.components.filter((component) => component.role === "crown");

  assert.equal(standalone.validation.valid, true, JSON.stringify(standalone.validation.errors));
  assert.deepEqual(crowns.map((component) => component.id), [
    "crown-slim-cap",
    "crown-slim-cap-left-return",
    "crown-slim-cap-right-return"
  ]);
  assert.deepEqual(crowns.map((component) => component.metadata.side), [null, "left", "right"]);
});

test("accepted full fitted fillers omit only their fully contained Small Crown returns", async () => {
  const firstGenerated = await createVerifiedClayRenderPackage();
  const repeatedGenerated = await createVerifiedClayRenderPackage();
  const first = firstGenerated.specification;
  const repeated = repeatedGenerated.specification;
  const renderPackage = firstGenerated.renderPackage;
  const components = first.product.descriptorSets[0].components;
  const canonicalEvaluation = first.product.canonicalEvaluations[0].evaluation;
  const standalone = generateBookcaseLayout(first.product.canonicalConfig);
  const sourceFront = standalone.components.find((component) => component.id === "crown-slim-cap");
  const fittedFront = componentBySuffix(components, "crown-slim-cap");
  const doors = components.filter((component) => component.role === "door");
  const pulls = components.filter((component) => (
    component.role === "handle" && component.metadata?.hardware === "matte_black_pull"
  ));
  const pucks = components.filter((component) => (
    component.role === "light" && component.metadata?.lightType === "puck"
  ));
  const countertop = components.find((component) => (
    component.role === "fixed_shelf"
    && component.metadata?.purpose === "continuous_countertop"
  ));
  const cylinderSubmeshes = renderPackage.components
    .flatMap((component) => component.submeshes)
    .filter((submesh) => submesh.geometry === "cylinder");

  assert.deepEqual(crownComponents(first.product).map((component) => component.id), [
    `${SET_PREFIX}crown-slim-cap`
  ]);
  assert.equal(componentBySuffix(components, "crown-slim-cap-left-return"), undefined);
  assert.equal(componentBySuffix(components, "crown-slim-cap-right-return"), undefined);
  assert.deepEqual(fittedFront.bounds, sourceFront.bounds);
  assert.equal(fittedFront.parentId, `${SET_PREFIX}${sourceFront.parentId}`);
  assert.equal(fittedFront.hostId, `${SET_PREFIX}${sourceFront.hostId}`);
  assert.deepEqual(fittedFront.metadata.profileGeometry, sourceFront.metadata.profileGeometry);
  assert.equal(components.length, 57);
  assert.equal(first.product.renderManifest.expectedCount, 44);
  assert.equal(first.product.renderManifest.entries.length, 44);
  assert.equal(renderPackage.components.length, 44);
  assert.equal(
    renderPackage.components.flatMap((component) => component.submeshes).length,
    78
  );
  assert.equal(canonicalEvaluation.bom.physicalComponentIds.length, 40);
  assert.equal(canonicalEvaluation.bom.acceptedDescriptorGraph.componentCount, 43);
  assert.equal(doors.length, 8);
  assert.ok(doors.every((door) => door.metadata?.style === "shaker"));
  assert.equal(pulls.length, 8);
  assert.equal(pucks.length, 2);
  assert.deepEqual(pucks.map((puck) => puck.size), [
    { x: 2.25, y: 0.375, z: 2.25 },
    { x: 2.25, y: 0.375, z: 2.25 }
  ]);
  assert.equal(cylinderSubmeshes.length, 4);
  assert.ok(countertop);
  assert.deepEqual(countertop.size, { x: 117, y: 1.25, z: 14 });
  assert.equal(renderPackage.constraints.length, 7);
  assert.deepEqual(renderPackage.camera, EXPECTED_CUSTOMER_CAMERA);
  assert.equal(first.pricing.total, 15050);
  assert.deepEqual(
    first.pricing.lineItems.map(({ code, unitRate }) => [code, unitRate]),
    EXPECTED_PRICING_RATES
  );
  assert.equal(first.geometryFingerprint, EXPECTED_GEOMETRY_FINGERPRINT);
  assert.equal(first.geometryFingerprint, EXPECTED_DRAWING_4_GEOMETRY_FINGERPRINT);
  assert.equal(repeated.geometryFingerprint, EXPECTED_GEOMETRY_FINGERPRINT);
  assert.equal(renderPackage.requestKey, EXPECTED_DRAWING_4_REQUEST_KEY);
  assert.equal(renderPackage.renderKey, EXPECTED_DRAWING_4_RENDER_KEY);
  assert.equal(repeatedGenerated.renderPackage.requestKey, renderPackage.requestKey);
  assert.equal(repeatedGenerated.renderPackage.renderKey, renderPackage.renderKey);
  assert.deepEqual(repeatedGenerated.renderPackage.identity, renderPackage.identity);
  assert.equal(repeatedGenerated.packageJson, firstGenerated.packageJson);
  assert.deepEqual(first.product.descriptorSets, repeated.product.descriptorSets);
  assert.deepEqual(first.pricing, repeated.pricing);

  for (const crown of crownComponents(first.product)) {
    for (const filler of fillerComponents(first.product)) {
      assert.equal(boundsIntersect(crown.bounds, filler.bounds), false);
    }
  }
});

test("one-sided full filler omits only its matching return without resizing or rehosting the exposed return", () => {
  const specification = evaluateFixture();
  const standalone = generateBookcaseLayout(specification.product.canonicalConfig);
  const sourceRight = standalone.components.find((component) => (
    component.id === "crown-slim-cap-right-return"
  ));
  const rightTreatment = specification.fit.installations[0].treatments.right;
  const oneSided = evaluateWithTreatmentChanges(specification, {
    right: { ...rightTreatment, kind: "none", width: 0 }
  });

  assert.equal(oneSided.accepted, true, JSON.stringify(oneSided.errors));
  const crowns = crownComponents(oneSided);
  assert.deepEqual(crowns.map((component) => component.id), [
    `${SET_PREFIX}crown-slim-cap`,
    `${SET_PREFIX}crown-slim-cap-right-return`
  ]);
  const rightReturn = componentBySuffix(oneSided.descriptorSets[0].components, "crown-slim-cap-right-return");
  assert.deepEqual(rightReturn.bounds, sourceRight.bounds);
  assert.equal(rightReturn.parentId, `${SET_PREFIX}${sourceRight.parentId}`);
  assert.equal(rightReturn.hostId, `${SET_PREFIX}${sourceRight.hostId}`);
  assert.deepEqual(rightReturn.metadata.profileGeometry, sourceRight.metadata.profileGeometry);
});

test("partial filler intersection rejects deterministically instead of clipping the authored return", () => {
  const specification = evaluateFixture();
  const leftTreatment = specification.fit.installations[0].treatments.left;
  const rightTreatment = specification.fit.installations[0].treatments.right;
  const changes = {
    left: { ...leftTreatment, width: 0.125 },
    right: { ...rightTreatment, kind: "none", width: 0 }
  };
  const first = evaluateWithTreatmentChanges(specification, changes);
  const repeated = evaluateWithTreatmentChanges(specification, changes);

  for (const result of [first, repeated]) {
    assert.equal(result.accepted, false);
    assert.equal(result.errors[0]?.code, GUIDED_PRODUCT_ENGINE_FAILURES.descriptorInvalid);
    assert.deepEqual(result.errors[0]?.issues, [{
      code: "CROWN_RETURN_FILLER_COLLISION",
      severity: "error",
      componentId: `${SET_PREFIX}crown-slim-cap-left-return`
    }]);
  }
  assert.deepEqual(first.errors, repeated.errors);
});
