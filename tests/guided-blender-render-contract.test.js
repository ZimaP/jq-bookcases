import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  GUIDED_BLENDER_ASSET_MANIFEST_SHA256,
  GUIDED_BLENDER_CLAY_LIBRARY_VERSION,
  GUIDED_BLENDER_MATERIAL_SOURCE_SHA256,
  GUIDED_BLENDER_RENDER_PIPELINE_VERSION,
  convertGuidedBoundsToBlender,
  convertGuidedPointToBlender,
  createGuidedBlenderRenderJob,
  regenerateGuidedBlenderRenderPackage,
  validateGuidedBlenderRenderPackage,
  validateGuidedBlenderRenderResult
} from "../guided-blender-render-contract.js";
import {
  createGuidedAcceptedComponentRenderPlan as createBrowserRenderPlan
} from "../guided-configurator-3d.js";
import {
  createGuidedAcceptedComponentRenderPlan as createSharedRenderPlan
} from "../guided-render-primitives.js";
import {
  evaluateGuidedProjectCandidate
} from "../guided-project-engine.js";
import {
  createGuidedSceneDescriptors
} from "../guided-render-contract.js";

const fixture = JSON.parse(readFileSync(
  new URL("./fixtures/blender-prototype/TV01-clear-wall-foundation.json", import.meta.url),
  "utf8"
));
const project = fixture.project;
const expectations = fixture.currentContractExpectations;

test("TV01 creates a compact accepted Blender job without quote or catalog payloads", async () => {
  const projectWithCustomerContext = {
    ...structuredClone(project),
    projectName: "Customer family room",
    customerEmail: "private@example.com",
    notes: "Private customer notes",
    roomPhotoUrl: "https://example.com/private-room.jpg",
    category: 123,
    style: false
  };
  const specification = evaluateGuidedProjectCandidate(projectWithCustomerContext);
  assert.equal(specification.accepted, true, JSON.stringify(specification.errors));
  const job = await createGuidedBlenderRenderJob(projectWithCustomerContext, specification);

  assert.equal(job.kind, "jq-guided-blender-render-job");
  assert.equal(job.identity.productId, "tv-unit");
  assert.equal(job.identity.layoutId, "clear-wall");
  assert.equal(job.identity.installationMode, "fitted");
  assert.equal(job.render.engine, "BLENDER_EEVEE_NEXT");
  assert.match(job.renderKey, /^jq-blender-v1-[a-f0-9]{64}$/);
  assert.deepEqual(Object.keys(job.design).sort(), [
    "accentFinish",
    "acceptedSnapshot",
    "baseStyle",
    "doorStyle",
    "finish",
    "hardware",
    "layoutId",
    "lighting",
    "measurements",
    "productId",
    "topTreatment"
  ]);
  assert.equal(job.design.acceptedSnapshot.projectId, null);
  assert.equal(job.design.measurements.tvMounting, "wall-mounted");
  const serialized = JSON.stringify(job);
  assert.doesNotMatch(serialized, /https?:\/\//i);
  assert.doesNotMatch(serialized, /Customer family room|private@example\.com|Private customer notes/i);
  assert.equal(Object.hasOwn(job.design, "category"), false);
  assert.equal(Object.hasOwn(job.design, "style"), false);
  assert.doesNotMatch(serialized, /"pricing"|hardwareSnapshot|variantSnapshot|acceptedSpecification/i);
  assert.ok(serialized.length < 10_000, `compact job grew to ${serialized.length} bytes`);

  const finalJob = await createGuidedBlenderRenderJob(
    projectWithCustomerContext,
    specification,
    { profileId: "final" }
  );
  assert.equal(finalJob.render.engine, "CYCLES");
  assert.equal(finalJob.render.width, 1800);
  assert.notEqual(finalJob.renderKey, job.renderKey);
});

test("TV01 preserves accepted component parity plus every non-renderable opening", async () => {
  const specification = evaluateGuidedProjectCandidate(project);
  const job = await createGuidedBlenderRenderJob(project, specification);
  const renderPackage = await regenerateGuidedBlenderRenderPackage(job);
  const repeatedPackage = await regenerateGuidedBlenderRenderPackage(job);

  assert.equal(specification.fit.casework.width, expectations.caseworkWidth);
  assert.equal(specification.fit.casework.overallHeight, expectations.caseworkHeight);
  assert.equal(specification.fit.casework.depth, expectations.caseworkDepth);
  assert.equal(specification.fit.treatments.left.width, expectations.leftFiller);
  assert.equal(specification.fit.treatments.right.width, expectations.rightFiller);
  assert.equal(specification.product.tv.body.width, expectations.tvBodyWidth);
  assert.equal(specification.product.tv.body.height, expectations.tvBodyHeight);
  assert.equal(specification.product.tv.opening.width, expectations.tvOpeningWidth);
  assert.equal(specification.product.tv.opening.height, expectations.tvOpeningHeight);

  assert.equal(renderPackage.components.length, expectations.renderableComponents);
  assert.equal(renderPackage.constraints.length, expectations.nonRenderableBlenderConstraints);
  assert.equal(renderPackage.audit.physicalComponentCount, expectations.renderableComponents);
  assert.equal(renderPackage.audit.renderedComponentCount, expectations.renderableComponents);
  assert.equal(renderPackage.requestKey, job.renderKey);
  assert.match(renderPackage.renderKey, /^jq-blender-package-v1-[a-f0-9]{64}$/);
  assert.equal(repeatedPackage.renderKey, renderPackage.renderKey);
  assert.ok(Number.isFinite(renderPackage.camera.position.y));
  assert.ok(renderPackage.camera.position.y > renderPackage.camera.target.y);
  assert.equal(renderPackage.scene.environment.sha256.length, 64);
  assert.equal(renderPackage.render.engine, "BLENDER_EEVEE_NEXT");
  assert.equal(renderPackage.render.blenderEngine, "BLENDER_EEVEE");
  assert.equal(renderPackage.render.materialMode, "neutral-clay-v1");
  assert.equal(renderPackage.render.resolutionPercentage, 100);
  assert.equal(renderPackage.render.samples, 128);
  assert.deepEqual(renderPackage.render.colorManagement, {
    displayDevice: "sRGB",
    viewTransform: "AgX",
    look: "AgX - Medium High Contrast",
    exposure: 0,
    gamma: 1,
    useCurveMapping: false
  });
  assert.deepEqual(renderPackage.render.film, { transparent: false });
  assert.deepEqual(renderPackage.render.imageSettings, {
    fileFormat: "WEBP",
    colorMode: "RGB",
    colorDepth: "8",
    colorManagement: "FOLLOW_SCENE",
    quality: 90
  });
  assert.deepEqual(renderPackage.render.renderOptions, {
    useFileExtension: true,
    useCompositing: false,
    useSequencer: false,
    useStamp: false,
    useBorder: false,
    useCropToBorder: false,
    pixelAspectX: 1,
    pixelAspectY: 1,
    ditherIntensity: 1
  });
  assert.equal(renderPackage.scene.shell.floorDepthIn, 300);
  assert.equal(renderPackage.scene.environment.projection, "EQUIRECTANGULAR");
  assert.equal(renderPackage.scene.environment.interpolation, "Linear");
  assert.equal(renderPackage.scene.environment.colorSpace, "Linear Rec.709");
  assert.deepEqual(renderPackage.scene.environment.rotationEuler, [0, 0, 0]);
  assert.deepEqual(
    renderPackage.components.map((component) => component.componentId),
    [...renderPackage.components.map((component) => component.componentId)].sort()
  );
  assert.equal(
    new Set(renderPackage.components.map((component) => component.componentId)).size,
    expectations.renderableComponents
  );
  assert.deepEqual(new Set(renderPackage.constraints.map((constraint) => constraint.kind)), new Set([
    "lower_cabinet",
    "tv_service_opening",
    "soundbar_equipment_zone",
    "equipment_ventilation"
  ]));
  assert.ok(renderPackage.components.every((component) => component.submeshes.length > 0));
  assert.ok(renderPackage.components.flatMap((component) => component.submeshes).every((submesh) => (
    ["box", "crown_profile_extrusion"].includes(submesh.geometry)
  )));
});

test("the browser and Blender consume the same renderer-neutral primitive plan", () => {
  const specification = evaluateGuidedProjectCandidate(project);
  const crown = createGuidedSceneDescriptors(specification)
    .find((descriptor) => descriptor.role === "crown");
  assert.ok(crown);
  assert.deepEqual(createBrowserRenderPlan(crown), createSharedRenderPlan(crown));
  assert.equal(createSharedRenderPlan(crown).geometryVariant, "crown_profile_extrusion");

  const malformed = structuredClone(crown);
  malformed.metadata.profileGeometry.outline = [{ height: 0, projection: 0 }];
  assert.throws(
    () => createSharedRenderPlan(malformed),
    /malformed authored crown profile/
  );

  const unknownCrown = structuredClone(crown);
  unknownCrown.metadata.profileGeometry.kind = "crown_profile_extrusoin";
  assert.throws(
    () => createSharedRenderPlan(unknownCrown),
    /unknown authored crown profile kind/
  );

  const front = createGuidedSceneDescriptors(specification)
    .find((descriptor) => descriptor.role === "door");
  assert.ok(front);
  const unknownFront = structuredClone(front);
  unknownFront.metadata.profileGeometry.kind = "framed-panle";
  assert.throws(
    () => createSharedRenderPlan(unknownFront),
    /unknown authored front profile kind/
  );
});

test("JQ inch-space maps to Blender meter-space without a mirror or axis ambiguity", () => {
  assert.deepEqual(convertGuidedPointToBlender({ x: 10, y: 20, z: -30 }), {
    x: 0.254,
    y: 0.762,
    z: 0.508
  });
  assert.deepEqual(convertGuidedBoundsToBlender({
    min: { x: -10, y: 0, z: -14 },
    max: { x: 10, y: 96, z: 0 }
  }), {
    min: { x: -0.254, y: 0, z: 0 },
    max: { x: 0.254, y: 0.35559999999999997, z: 2.4383999999999997 }
  });
});

test("finish-only edits preserve geometry while changing Blender cache identity", async () => {
  const firstSpecification = evaluateGuidedProjectCandidate(project);
  const repeatedJob = await createGuidedBlenderRenderJob(
    structuredClone(project),
    evaluateGuidedProjectCandidate(structuredClone(project))
  );
  const firstJob = await createGuidedBlenderRenderJob(project, firstSpecification);
  assert.equal(repeatedJob.renderKey, firstJob.renderKey);

  const changedProject = { ...structuredClone(project), finish: "medium-walnut" };
  const changedSpecification = evaluateGuidedProjectCandidate(changedProject);
  const changedJob = await createGuidedBlenderRenderJob(changedProject, changedSpecification);
  assert.equal(changedSpecification.geometryFingerprint, firstSpecification.geometryFingerprint);
  assert.notEqual(changedSpecification.selectionFingerprint, firstSpecification.selectionFingerprint);
  assert.notEqual(changedJob.renderKey, firstJob.renderKey);
});

test("the compact job preserves every supported field required for exact regeneration", async () => {
  const customized = {
    ...structuredClone(project),
    shelves: 3,
    lightingWarmth: 3000,
    installation: "no_installation",
    delivery: "pickup"
  };
  const specification = evaluateGuidedProjectCandidate(customized);
  assert.equal(specification.accepted, true, JSON.stringify(specification.errors));
  const job = await createGuidedBlenderRenderJob(customized, specification);
  const renderPackage = await regenerateGuidedBlenderRenderPackage(job);
  const baseSpecification = evaluateGuidedProjectCandidate(project);
  const baseJob = await createGuidedBlenderRenderJob(project, baseSpecification);

  assert.equal(job.design.shelves, 3);
  assert.equal(job.design.lightingWarmth, 3000);
  assert.equal(job.design.installation, "no_installation");
  assert.equal(job.design.delivery, "pickup");
  assert.notEqual(job.identity.geometryFingerprint, baseJob.identity.geometryFingerprint);
  assert.notEqual(job.renderKey, baseJob.renderKey);
  assert.equal(
    renderPackage.components.length,
    specification.product.renderManifest.expectedCount
  );
  assert.ok(renderPackage.components.some((component) => (
    component.role === "light" && component.metadata.warmth === 3000
  )));

  const warmthOnly = { ...structuredClone(project), lightingWarmth: 3000 };
  const warmthOnlySpecification = evaluateGuidedProjectCandidate(warmthOnly);
  const warmthOnlyJob = await createGuidedBlenderRenderJob(
    warmthOnly,
    warmthOnlySpecification
  );
  assert.equal(warmthOnlyJob.identity.geometryFingerprint, baseJob.identity.geometryFingerprint);
  assert.equal(warmthOnlyJob.identity.selectionFingerprint, baseJob.identity.selectionFingerprint);
  assert.notEqual(warmthOnlyJob.identity.descriptorFingerprint, baseJob.identity.descriptorFingerprint);
  assert.notEqual(warmthOnlyJob.renderKey, baseJob.renderKey);

  const priceOnly = {
    ...structuredClone(project),
    installation: "no_installation",
    delivery: "pickup"
  };
  const priceOnlySpecification = evaluateGuidedProjectCandidate(priceOnly);
  const priceOnlyJob = await createGuidedBlenderRenderJob(priceOnly, priceOnlySpecification);
  assert.notEqual(
    priceOnlySpecification.specificationFingerprint,
    baseSpecification.specificationFingerprint
  );
  assert.equal(priceOnlyJob.renderKey, baseJob.renderKey);
});

test("the server boundary fails closed on request or accepted-project tampering", async () => {
  const specification = evaluateGuidedProjectCandidate(project);
  const job = await createGuidedBlenderRenderJob(project, specification);

  const changedIdentity = structuredClone(job);
  changedIdentity.identity.geometryFingerprint = "jq-guided-geometry-v1-tampered";
  await assert.rejects(
    regenerateGuidedBlenderRenderPackage(changedIdentity),
    (error) => error?.code === "BLENDER_RENDER_KEY_MISMATCH"
  );

  const malformedFingerprint = structuredClone(job);
  malformedFingerprint.design.acceptedSnapshot.geometryFingerprint = "tampered";
  await assert.rejects(
    regenerateGuidedBlenderRenderPackage(malformedFingerprint),
    (error) => error?.code === "INVALID_BLENDER_SNAPSHOT_FINGERPRINT"
  );

  const oversizedJob = structuredClone(job);
  oversizedJob.design.acceptedSnapshot.geometryFingerprint = (
    `jq-guided-geometry-v1-${"a".repeat(20_000)}`
  );
  await assert.rejects(
    regenerateGuidedBlenderRenderPackage(oversizedJob),
    (error) => error?.code === "BLENDER_RENDER_JOB_TOO_LARGE"
  );

  const changedMeasurements = structuredClone(job);
  changedMeasurements.design.measurements.wallWidth = 144;
  await assert.rejects(
    regenerateGuidedBlenderRenderPackage(changedMeasurements),
    (error) => error?.code === "BLENDER_REGENERATION_FAILED"
  );

  for (const mutate of [
    (candidate) => { candidate.attackerPayload = { pricing: 1, url: "https://attacker.test" }; },
    (candidate) => { candidate.design.notes = "private"; },
    (candidate) => { candidate.design.measurements.customerNotes = "private"; },
    (candidate) => { candidate.design.acceptedSnapshot.secret = "private"; }
  ]) {
    const unknownPayload = structuredClone(job);
    mutate(unknownPayload);
    await assert.rejects(
      regenerateGuidedBlenderRenderPackage(unknownPayload),
      (error) => [
        "INVALID_BLENDER_RENDER_JOB_SHAPE",
        "INVALID_BLENDER_RENDER_DESIGN_SHAPE"
      ].includes(error?.code)
    );
  }

  const changedRenderSettings = structuredClone(job);
  changedRenderSettings.render.samples = 100_000;
  await assert.rejects(
    regenerateGuidedBlenderRenderPackage(changedRenderSettings),
    (error) => error?.code === "BLENDER_RENDER_SETTINGS_MISMATCH"
  );
});

test("foundation v1 rejects every accepted product or mode outside fitted TV Unit + Clear Wall", async () => {
  for (const unsupported of [
    { ...structuredClone(project), productId: "cabinet-shelves" },
    { ...structuredClone(project), layoutId: "right-niche" },
    { ...structuredClone(project), baseStyle: "furniture-base" }
  ]) {
    const specification = evaluateGuidedProjectCandidate(unsupported);
    assert.equal(specification.accepted, true, JSON.stringify(specification.errors));
    await assert.rejects(
      createGuidedBlenderRenderJob(unsupported, specification),
      (error) => error?.code === "UNSUPPORTED_BLENDER_RENDER_SLICE"
    );
  }
});

test("foundation v1 rejects syntactically safe customization IDs outside the live UI", async () => {
  for (const [key, value] of [
    ["finish", "made-up-finish"],
    ["accentFinish", "natural-oak"],
    ["hardware", "made-up-hardware"],
    ["lighting", "made-up-light"],
    ["doorStyle", "flat"],
    ["topTreatment", "made-up-top"],
    ["lightingWarmth", 4000]
  ]) {
    const unsupported = { ...structuredClone(project), [key]: value };
    const specification = evaluateGuidedProjectCandidate(unsupported);
    assert.equal(specification.accepted, true, `${key}: ${JSON.stringify(specification.errors)}`);
    await assert.rejects(
      createGuidedBlenderRenderJob(unsupported, specification),
      (error) => error?.code === "UNSUPPORTED_BLENDER_SELECTION",
      key
    );
  }
});

test("foundation v1 rejects hostile scalar types instead of silently defaulting selections", async () => {
  for (const [key, value] of [
    ["finish", 123],
    ["accentFinish", false],
    ["hardware", false],
    ["doorStyle", null],
    ["lighting", 0],
    ["baseStyle", true],
    ["topTreatment", 42],
    ["installation", 0],
    ["delivery", false],
    ["lightingWarmth", "3000"],
    ["shelves", "3"],
    ["shelves", true],
    ["shelves", 3.5],
    ["shelves", 999]
  ]) {
    const unsupported = { ...structuredClone(project), [key]: value };
    const specification = evaluateGuidedProjectCandidate(unsupported);
    assert.equal(specification.accepted, true, `${key}: ${JSON.stringify(specification.errors)}`);
    await assert.rejects(
      createGuidedBlenderRenderJob(unsupported, specification),
      (error) => error?.code === "UNSUPPORTED_BLENDER_SELECTION",
      key
    );
  }

  for (const key of [
    "finish",
    "accentFinish",
    "doorStyle",
    "hardware",
    "lighting",
    "baseStyle",
    "topTreatment"
  ]) {
    const missing = structuredClone(project);
    delete missing[key];
    const specification = evaluateGuidedProjectCandidate(missing);
    assert.equal(specification.accepted, true, `${key}: ${JSON.stringify(specification.errors)}`);
    await assert.rejects(
      createGuidedBlenderRenderJob(missing, specification),
      (error) => error?.code === "MISSING_BLENDER_SELECTION",
      key
    );
  }

  const unsupportedDrawerCount = { ...structuredClone(project), drawerCount: 5 };
  const drawerSpecification = evaluateGuidedProjectCandidate(unsupportedDrawerCount);
  assert.equal(drawerSpecification.accepted, true, JSON.stringify(drawerSpecification.errors));
  await assert.rejects(
    createGuidedBlenderRenderJob(unsupportedDrawerCount, drawerSpecification),
    (error) => error?.code === "BLENDER_JOB_SANITIZATION_LOST_INPUT"
  );
});

test("foundation v1 requires exact typed Clear Wall and TV measurements", async () => {
  for (const [key, value] of [
    ["wallWidth", "120"],
    ["ceilingHeight", "96"],
    ["desiredDepth", "14"],
    ["tvScreenSize", "65"],
    ["tvHeight", "wat"],
    ["tvMounting", false],
    ["outletLocation", 42],
    ["soundbarRequired", 0]
  ]) {
    const unsupported = structuredClone(project);
    unsupported.measurements[key] = value;
    const specification = evaluateGuidedProjectCandidate(unsupported);
    assert.equal(specification.accepted, true, `${key}: ${JSON.stringify(specification.errors)}`);
    await assert.rejects(
      createGuidedBlenderRenderJob(unsupported, specification),
      (error) => error?.code === "UNSUPPORTED_BLENDER_MEASUREMENT",
      key
    );
  }

  const missing = structuredClone(project);
  delete missing.measurements.tvMounting;
  const missingSpecification = evaluateGuidedProjectCandidate(missing);
  assert.equal(missingSpecification.accepted, true, JSON.stringify(missingSpecification.errors));
  await assert.rejects(
    createGuidedBlenderRenderJob(missing, missingSpecification),
    (error) => error?.code === "UNSUPPORTED_BLENDER_MEASUREMENT"
  );
});

test("Drawing 4 remains an internal prototype while material and customer gates stay explicit", async () => {
  const specification = evaluateGuidedProjectCandidate(project);
  const job = await createGuidedBlenderRenderJob(project, specification);
  const renderPackage = await regenerateGuidedBlenderRenderPackage(job);
  const bindings = new Map(renderPackage.materials.map((entry) => [entry.sourceMaterialSlot, entry]));
  const clayMaterials = new Map(renderPackage.clayMaterials.map((entry) => [entry.materialId, entry]));

  assert.equal(bindings.get("cabinet_interior")?.materialId, "natural-oak");
  assert.equal(renderPackage.readiness.prototypeRenderAllowed, true);
  assert.equal(renderPackage.readiness.customerBeautyRenderApproved, false);
  assert.equal(renderPackage.readiness.geometryApproval, "internal-drawing-4-prototype");
  assert.ok(renderPackage.materials.every((binding) => (
    binding.status === "procedural-starter"
    && binding.resolver.startsWith("embedded-")
    && binding.definition
  )));
  assert.equal(bindings.get("hardware")?.materialId, "black-pull");
  assert.equal(bindings.get("hardware")?.definition.family, "metal");
  assert.equal(bindings.get("led")?.definition.family, "emissive");
  assert.equal(bindings.get("screen")?.definition.family, "screen");
  assert.equal(bindings.get("case")?.clayMaterialId, "clay-casework");
  assert.equal(bindings.get("hardware")?.clayMaterialId, "clay-hardware");
  assert.equal(bindings.get("led")?.clayMaterialId, "clay-led");
  assert.equal(bindings.get("screen")?.clayMaterialId, "clay-screen");
  assert.equal(clayMaterials.get("clay-glass")?.libraryVersion, GUIDED_BLENDER_CLAY_LIBRARY_VERSION);
  assert.equal(clayMaterials.size, 5);
  assert.ok(renderPackage.readiness.requiredAssets.some((asset) => (
    asset.materialId === "clear-uv-maple"
  )));
  assert.ok(renderPackage.readiness.blockers.some((blocker) => (
    blocker.code === "CLEAR_UV_MAPLE_PBR_REQUIRED"
  )));
  assert.equal(renderPackage.readiness.blockers.some((blocker) => (
    blocker.code === "TV_TEMPLATE_APPROVAL_REQUIRED"
  )), false);

  const serialized = JSON.stringify(renderPackage);
  assert.doesNotMatch(serialized, /https?:\/\/|hardwareSnapshot|variantSnapshot|"pricing"/i);
});

test("worker results must match the render key, pipeline, and requested passes", async () => {
  const specification = evaluateGuidedProjectCandidate(project);
  const job = await createGuidedBlenderRenderJob(project, specification);
  const renderPackage = await regenerateGuidedBlenderRenderPackage(job);
  const valid = await validateGuidedBlenderRenderResult(renderPackage, {
    kind: "jq-guided-blender-render-result",
    schemaVersion: 1,
    renderKey: renderPackage.renderKey,
    pipelineVersion: GUIDED_BLENDER_RENDER_PIPELINE_VERSION,
    status: "succeeded",
    outputs: [{
      pass: "beauty",
      objectKey: `${renderPackage.renderKey}/beauty.webp`,
      mimeType: "image/webp",
      width: 960,
      height: 640,
      bytes: 125_000,
      sha256: "a".repeat(64)
    }]
  });
  assert.equal(valid.valid, true, JSON.stringify(valid.errors));

  const stale = await validateGuidedBlenderRenderResult(renderPackage, {
    kind: "jq-guided-blender-render-result",
    schemaVersion: 1,
    renderKey: "stale",
    pipelineVersion: GUIDED_BLENDER_RENDER_PIPELINE_VERSION,
    status: "succeeded",
    outputs: []
  });
  assert.equal(stale.valid, false);
  assert.deepEqual(stale.errors.map((error) => error.code), [
    "RENDER_RESULT_KEY_MISMATCH",
    "MISSING_RENDER_PASS"
  ]);

  const unsafeDuplicate = await validateGuidedBlenderRenderResult(renderPackage, {
    kind: "jq-guided-blender-render-result",
    schemaVersion: 1,
    renderKey: renderPackage.renderKey,
    pipelineVersion: GUIDED_BLENDER_RENDER_PIPELINE_VERSION,
    status: "succeeded",
    outputs: [0, 1].map(() => ({
      pass: "beauty",
      objectKey: "https://attacker.test/../../beauty.webp",
      mimeType: "image/webp",
      width: "960",
      height: 640,
      bytes: 1,
      sha256: "invalid"
    }))
  });
  assert.equal(unsafeDuplicate.valid, false);
  assert.ok(unsafeDuplicate.errors.some((error) => error.code === "DUPLICATE_RENDER_PASS"));
  assert.ok(unsafeDuplicate.errors.some((error) => error.code === "INVALID_RENDER_OUTPUT"));

  const oversizedOutput = await validateGuidedBlenderRenderResult(renderPackage, {
    kind: "jq-guided-blender-render-result",
    schemaVersion: 1,
    renderKey: renderPackage.renderKey,
    pipelineVersion: GUIDED_BLENDER_RENDER_PIPELINE_VERSION,
    status: "succeeded",
    outputs: [{
      pass: "beauty",
      objectKey: `${renderPackage.renderKey}/beauty.webp`,
      mimeType: "image/webp",
      width: 960,
      height: 640,
      bytes: Number.MAX_SAFE_INTEGER,
      sha256: "c".repeat(64)
    }]
  });
  assert.equal(oversizedOutput.valid, false);
  assert.ok(oversizedOutput.errors.some((error) => error.code === "INVALID_RENDER_OUTPUT"));

  const tamperedPackage = structuredClone(renderPackage);
  tamperedPackage.components[0].blenderWorldBounds.max.x += 0.01;
  const packageValidation = await validateGuidedBlenderRenderPackage(tamperedPackage);
  assert.equal(packageValidation.valid, false);
  assert.ok(packageValidation.errors.some((error) => error.code === "RENDER_PACKAGE_KEY_MISMATCH"));

  for (const mutate of [
    (candidate) => { candidate.readiness.customerBeautyRenderApproved = true; },
    (candidate) => { candidate.readiness.blockers = []; },
    (candidate) => { candidate.audit.valid = false; },
    (candidate) => { candidate.requestKey = "attacker-controlled-request"; }
  ]) {
    const candidate = structuredClone(renderPackage);
    mutate(candidate);
    const validation = await validateGuidedBlenderRenderPackage(candidate);
    assert.equal(validation.valid, false);
    assert.ok(validation.errors.some((error) => error.code === "RENDER_PACKAGE_KEY_MISMATCH"));
  }

  const fabricated = await validateGuidedBlenderRenderResult({
    kind: "jq-guided-blender-render-package",
    renderKey: "fabricated",
    pipelineVersion: "fabricated",
    render: { passes: [], width: 0, height: 0 }
  }, {
    kind: "jq-guided-blender-render-result",
    schemaVersion: 1,
    renderKey: "fabricated",
    pipelineVersion: "fabricated",
    status: "succeeded",
    outputs: []
  });
  assert.equal(fabricated.valid, false);
  assert.ok(fabricated.errors.some((error) => error.code === "INVALID_RENDER_PACKAGE"));
});

test("final output passes have exact lossless/beauty filenames and MIME contracts", async () => {
  const specification = evaluateGuidedProjectCandidate(project);
  const job = await createGuidedBlenderRenderJob(project, specification, { profileId: "final" });
  const renderPackage = await regenerateGuidedBlenderRenderPackage(job);
  const outputs = renderPackage.render.outputContracts.map((contract) => ({
    pass: contract.pass,
    objectKey: `${renderPackage.renderKey}/${contract.filename}`,
    mimeType: contract.mimeType,
    width: renderPackage.render.width,
    height: renderPackage.render.height,
    bytes: 250_000,
    sha256: "b".repeat(64)
  }));
  const valid = await validateGuidedBlenderRenderResult(renderPackage, {
    kind: "jq-guided-blender-render-result",
    schemaVersion: 1,
    renderKey: renderPackage.renderKey,
    pipelineVersion: renderPackage.pipelineVersion,
    status: "succeeded",
    outputs
  });
  assert.equal(valid.valid, true, JSON.stringify(valid.errors));

  const lossyDepth = structuredClone(outputs);
  const depth = lossyDepth.find((output) => output.pass === "depth");
  depth.objectKey = `${renderPackage.renderKey}/depth.webp`;
  depth.mimeType = "image/webp";
  const rejected = await validateGuidedBlenderRenderResult(renderPackage, {
    kind: "jq-guided-blender-render-result",
    schemaVersion: 1,
    renderKey: renderPackage.renderKey,
    pipelineVersion: renderPackage.pipelineVersion,
    status: "succeeded",
    outputs: lossyDepth
  });
  assert.equal(rejected.valid, false);
  assert.ok(rejected.errors.some((error) => error.code === "INVALID_RENDER_OUTPUT"));
});

test("render identity pins the committed asset and material source bytes", () => {
  const digest = (relativePath) => createHash("sha256")
    .update(readFileSync(new URL(relativePath, import.meta.url)))
    .digest("hex");
  assert.equal(digest("../config/asset-manifest.json"), GUIDED_BLENDER_ASSET_MANIFEST_SHA256);
  assert.equal(digest("../guided-materials.js"), GUIDED_BLENDER_MATERIAL_SOURCE_SHA256);
});
