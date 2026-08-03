import assert from "node:assert/strict";
import test from "node:test";

import {
  EXPECTED_CAMERA_FINGERPRINT,
  EXPECTED_GEOMETRY_FINGERPRINT,
  EXPECTED_MATERIAL_CAPTURE_KEY,
  EXPECTED_MATERIAL_PACKAGE_FILE_SHA256,
  EXPECTED_MATERIAL_PACKAGE_KEY,
  EXPECTED_MATERIAL_RESULT_KEY,
  EXPECTED_OBJECT_MANIFEST_SHA256,
  EXPECTED_PHASE6_REPORT_COUNTS,
  EXPECTED_PHASE6_REPORT_DIGESTS,
  EXPECTED_PHASE6_REPORT_PARITY,
  EXPECTED_PRIMARY_PACKAGE_KEY,
  EXPECTED_PRIMARY_PACKAGE_SHA256,
  PHOTOREAL_OUTPUT_FILENAMES,
  PHOTOREAL_PRESENTATION_CAPTURE_ID,
  PHOTOREAL_PRESENTATION_PIPELINE_VERSION,
  createGuidedBlenderPhotorealPresentationPackage,
  createGuidedBlenderPhotorealPresentationResult,
  deterministicJson,
  hashCanonical,
  validateGuidedBlenderPhotorealPresentationPackage,
  validateGuidedBlenderPhotorealPresentationResult
} from "../tools/blender/photoreal-presentation-contract.mjs";
import { createGuidedBlenderMaterialPackage } from "../tools/blender/materials-preview-contract.mjs";
import { createVerifiedClayRenderPackage } from "../tools/blender/run-clay-worker.mjs";

const BLENDER_RUNTIME = Object.freeze({
  backend: "METAL",
  buildHash: "fbe6228777e7",
  deviceVersion: "1.2",
  renderer: "Metal API",
  vendor: "Apple M4",
  version: "5.2.0 LTS"
});

const PHASE6_COUNTS = Object.freeze({
  bindings: 80,
  cameras: 1,
  collections: 4,
  constraintObjects: 7,
  lights: 0,
  links: 1305,
  materialFrames: 65,
  materials: 70,
  modifiers: 0,
  nodes: 1115,
  productMeshObjects: 78,
  roomMeshObjects: 2
});

const PHASE6_DIGESTS = Object.freeze({
  geometrySha256: "0e34d05fac3b3ac025dbbce3104d24c97b704ae168884d97713c3e7978159c72",
  topologySha256: "1bf523568c6fbd240543b5f0a25bed34881a66f5ba5e3dad43ff8878c1cebb63",
  boundsSha256: "3b621a2266378944888bde6efde033bf92eb7d208160fa1987dbb78766ec2d6c",
  transformsSha256: "81254f454170b20f074e7da09a62590796bc58aac3fd81d74033a8c028f5c0cf",
  cameraSha256: "1f27768d5c672576eb7bfa093b5be44125135c35c9b6494cd06eb54f20574de0",
  worldSha256: "5ea7c02b7db8d70edcf86c4138691cc3c0f01f562153a299995ea8619f6953b1",
  renderSettingsSha256: "04c600a9d0dc859e9f42c2b8891d807ec6ee0cfaf8b01fe3c891bbc455318d53",
  materialsSha256: "520be8b532c79c17c50d2a73e31d4f4094df81a4d71192877bcbc316d6bbf7f6",
  shaderParametersSha256: "54ba4a5444fe595a05118146e33987fdffe0136ba8316a131ea821592d0ea36a",
  slotAssignmentsSha256: "1ebac1ccbc11474416ae1c6510e819916cb689ee1e4943e2d25e0b3f2d5f0540",
  nodesSha256: "95f4c09daa27ec6b7bb25bea15d814359e362c4360fe63e33c8295a2d8ba867a",
  linksSha256: "1b83b7addb95360954e05f4ca1c0b19925430f6c37184e5b7059437a940b721f"
});

let foundationPromise;

function phase6Report() {
  return {
    kind: "jq-local-blender-materials-preview-report",
    schemaVersion: 1,
    status: "succeeded",
    materialPackageKey: EXPECTED_MATERIAL_PACKAGE_KEY,
    captureKey: EXPECTED_MATERIAL_CAPTURE_KEY,
    resultKey: EXPECTED_MATERIAL_RESULT_KEY,
    counts: structuredClone(EXPECTED_PHASE6_REPORT_COUNTS),
    digests: structuredClone(EXPECTED_PHASE6_REPORT_DIGESTS),
    parity: structuredClone(EXPECTED_PHASE6_REPORT_PARITY)
  };
}

async function getFoundation() {
  foundationPromise ||= createVerifiedClayRenderPackage().then((generated) => {
    const materialPackage = createGuidedBlenderMaterialPackage(generated.renderPackage, {
      primaryPackageJson: generated.packageJson,
      blenderRuntime: BLENDER_RUNTIME
    });
    const report = phase6Report();
    const presentationPackage = createGuidedBlenderPhotorealPresentationPackage(
      generated.renderPackage,
      materialPackage,
      report,
      { blenderRuntime: BLENDER_RUNTIME }
    );
    return { ...generated, materialPackage, report, presentationPackage };
  });
  return foundationPromise;
}

function clone(value) {
  return structuredClone(value);
}

function withoutKey(value, key) {
  return Object.fromEntries(Object.entries(value).filter(([name]) => name !== key));
}

function normalize(vector) {
  const magnitude = Math.hypot(...vector);
  assert.ok(magnitude > 1e-12);
  return vector.map((value) => value / magnitude);
}

function dot(left, right) {
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function cross(left, right) {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0]
  ];
}

function productBounds(renderPackage) {
  const bounds = renderPackage.components.flatMap((component) => (
    component.submeshes.map((submesh) => submesh.blenderWorldBounds)
  ));
  return {
    min: Object.fromEntries(["x", "y", "z"].map((axis) => [
      axis,
      Math.min(...bounds.map((entry) => entry.min[axis]))
    ])),
    max: Object.fromEntries(["x", "y", "z"].map((axis) => [
      axis,
      Math.max(...bounds.map((entry) => entry.max[axis]))
    ]))
  };
}

function reverseObjectKeys(value) {
  if (Array.isArray(value)) return value.map(reverseObjectKeys);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).reverse().map(([key, child]) => [key, reverseObjectKeys(child)])
  );
}

test("photoreal presentation generation and both content keys are canonical and deterministic", async () => {
  const { renderPackage, materialPackage, report, presentationPackage: first } = await getFoundation();
  const repeated = createGuidedBlenderPhotorealPresentationPackage(
    renderPackage,
    materialPackage,
    report,
    { blenderRuntime: BLENDER_RUNTIME }
  );

  assert.deepEqual(repeated, first);
  assert.equal(deterministicJson(repeated), deterministicJson(first));
  assert.match(first.presentationPackageKey, /^jq-photoreal-presentation-package-v1-[a-f0-9]{64}$/);
  assert.match(first.capture.captureKey, /^jq-photoreal-beauty-v1-[a-f0-9]{64}$/);

  const packageBase = withoutKey(withoutKey(first, "capture"), "presentationPackageKey");
  assert.equal(
    first.presentationPackageKey,
    `jq-photoreal-presentation-package-v1-${hashCanonical({
      keyVersion: first.schema,
      ...packageBase
    })}`
  );
  assert.equal(
    first.capture.captureKey,
    `jq-photoreal-beauty-v1-${hashCanonical({
      keyVersion: PHOTOREAL_PRESENTATION_CAPTURE_ID,
      presentationPackageKey: first.presentationPackageKey,
      capture: withoutKey(first.capture, "captureKey")
    })}`
  );
  assert.equal(validateGuidedBlenderPhotorealPresentationPackage(
    renderPackage,
    materialPackage,
    report,
    first
  ).valid, true);

  const reordered = reverseObjectKeys(first);
  assert.equal(validateGuidedBlenderPhotorealPresentationPackage(
    renderPackage,
    materialPackage,
    report,
    reordered
  ).valid, true, "JSON insertion order must not change package identity");
});

test("the photoreal sidecar pins the exact accepted Phase 6 identities, counts, and audit digests", async () => {
  const { presentationPackage } = await getFoundation();
  assert.deepEqual(presentationPackage.phase6Foundation, {
    geometryFingerprint: EXPECTED_GEOMETRY_FINGERPRINT,
    primaryPackageKey: EXPECTED_PRIMARY_PACKAGE_KEY,
    primaryPackageSha256: EXPECTED_PRIMARY_PACKAGE_SHA256,
    materialPackageKey: EXPECTED_MATERIAL_PACKAGE_KEY,
    materialPackageFileSha256: EXPECTED_MATERIAL_PACKAGE_FILE_SHA256,
    materialCaptureKey: EXPECTED_MATERIAL_CAPTURE_KEY,
    materialResultKey: EXPECTED_MATERIAL_RESULT_KEY,
    cameraFingerprint: EXPECTED_CAMERA_FINGERPRINT,
    objectManifestSha256: EXPECTED_OBJECT_MANIFEST_SHA256,
    reportKind: "jq-local-blender-materials-preview-report",
    reportSchemaVersion: 1,
    counts: PHASE6_COUNTS,
    digests: PHASE6_DIGESTS
  });
  assert.deepEqual(presentationPackage.authority, {
    scope: "local-photoreal-presentation-only",
    productGeometryAuthority: "jq-javascript-engine-only",
    materialBindingAuthority: "2026.08-deterministic-pbr-materials-v1",
    materialAuthorityClassification: "PREVIEW_ONLY_AUTHORIZED",
    materialColorReferenceStatus: "UNVERIFIED",
    customerMaterialApproved: false,
    customerBeautyRenderApproved: false
  });
});

test("the customer beauty camera is a distinct nondegenerate architectural perspective framing the TV01 bounds", async () => {
  const { renderPackage, presentationPackage } = await getFoundation();
  const camera = presentationPackage.presentation.camera;
  const bounds = productBounds(renderPackage);
  const forward = normalize([
    camera.target.x - camera.position.x,
    camera.target.y - camera.position.y,
    camera.target.z - camera.position.z
  ]);
  const up = normalize(camera.up);
  const right = normalize(cross(forward, up));
  const correctedUp = normalize(cross(right, forward));

  assert.equal(camera.type, "PERSP");
  assert.equal(camera.cameraId, "beauty-camera-v1");
  assert.equal(camera.blenderObjectName, "JQ_PHOTOREAL_BEAUTY_CAMERA");
  assert.notEqual(camera.cameraId, renderPackage.camera.cameraId);
  assert.notDeepEqual(camera.position, renderPackage.camera.position);
  assert.ok(Math.abs(camera.position.x - camera.target.x) > 0.5, "beauty view must reveal cabinet depth");
  assert.ok(Math.abs(dot(forward, up)) < 0.1, "camera up must be independent from view direction");
  assert.ok(Math.abs(dot(right, correctedUp)) < 1e-12);
  assert.equal(camera.lensMm, 52);
  assert.equal(camera.sensorWidthMm, 36);
  assert.equal(camera.clipStartM, 0.05);
  assert.equal(camera.clipEndM, 25);
  assert.equal(camera.depthOfField.enabled, false);

  for (const axis of ["x", "y", "z"]) {
    assert.ok(camera.target[axis] >= bounds.min[axis] && camera.target[axis] <= bounds.max[axis]);
  }
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        const offset = [x - camera.position.x, y - camera.position.y, z - camera.position.z];
        const depth = dot(offset, forward);
        assert.ok(depth > camera.clipStartM && depth < camera.clipEndM, "every product corner must be in front of the camera");
      }
    }
  }
});

test("the presentation manifest has exact daylight and package-anchored warm puck lights", async () => {
  const { presentationPackage } = await getFoundation();
  const lights = presentationPackage.presentation.lights;

  assert.deepEqual(lights.map(({ lightId, blenderType, role, energyW }) => ({ lightId, blenderType, role, energyW })), [
    { lightId: "presentation-key-daylight-v1", blenderType: "AREA", role: "soft-daylight-key", energyW: 420 },
    { lightId: "presentation-fill-daylight-v1", blenderType: "AREA", role: "cool-neutral-fill", energyW: 110 },
    { lightId: "presentation-puck-left-v1", blenderType: "SPOT", role: "warm-puck-left", energyW: 18 },
    { lightId: "presentation-puck-right-v1", blenderType: "SPOT", role: "warm-puck-right", energyW: 18 }
  ]);
  assert.deepEqual(lights.slice(0, 2).map((light) => ({
    shape: light.shape,
    useShadow: light.useShadow,
    normalize: light.normalize,
    spreadRadians: light.spreadRadians
  })), [
    { shape: "RECTANGLE", useShadow: true, normalize: true, spreadRadians: Math.PI },
    { shape: "RECTANGLE", useShadow: true, normalize: true, spreadRadians: Math.PI }
  ]);

  const pucks = lights.slice(2);
  assert.deepEqual(pucks.map((light) => light.anchor.componentId), [
    "guided-installation-main/section-01-light-puck",
    "guided-installation-main/section-04-light-puck"
  ]);
  assert.deepEqual(pucks.map((light) => light.anchor.center), [
    { x: -1.12395, y: 0.28575, z: 2.41379375 },
    { x: 1.12395, y: 0.28575, z: 2.41379375 }
  ]);
  assert.equal(pucks.every((light) => (
    light.position.x === light.anchor.center.x
    && light.position.y === light.anchor.center.y
    && light.target.z < light.position.z
    && light.anchor.submeshId === "emissive-lens"
    && light.anchor.materialId === "warm-opal-puck-lens-v1"
  )), true);
  assert.deepEqual(pucks[0].color, [1, 0.896269353374, 0.737910408773]);
  assert.equal(pucks[0].spotSizeRadians, 1.2217304764);
  assert.equal(pucks[0].spotBlend, 0.65);
});

test("room materials, environment, Cycles Metal policy, and separate master/WebP outputs are fully pinned", async () => {
  const { renderPackage, presentationPackage } = await getFoundation();
  const { presentation, capture } = presentationPackage;

  assert.deepEqual(presentation.roomMaterials.map((material) => ({
    materialId: material.materialId,
    targetObjectId: material.targetObjectId,
    baseColor: material.parameters.baseColor,
    metallic: material.parameters.metallic,
    roughness: material.parameters.roughness,
    trueDisplacement: material.trueDisplacement
  })), [
    {
      materialId: "warm-natural-floor-v1",
      targetObjectId: "room-floor",
      baseColor: [0.28, 0.22, 0.16],
      metallic: 0,
      roughness: 0.55,
      trueDisplacement: false
    },
    {
      materialId: "warm-off-white-wall-v1",
      targetObjectId: "room-rear-wall",
      baseColor: [0.78, 0.72, 0.64],
      metallic: 0,
      roughness: 0.78,
      trueDisplacement: false
    }
  ]);
  assert.deepEqual({
    path: presentation.world.environmentAssetPath,
    sha256: presentation.world.environmentSha256,
    projection: presentation.world.projection,
    interpolation: presentation.world.interpolation,
    colorSpace: presentation.world.colorSpace
  }, {
    path: renderPackage.scene.environment.path,
    sha256: renderPackage.scene.environment.sha256,
    projection: renderPackage.scene.environment.projection,
    interpolation: renderPackage.scene.environment.interpolation,
    colorSpace: renderPackage.scene.environment.colorSpace
  });
  assert.equal(presentation.world.strength, 0.32);
  assert.deepEqual(presentation.world.rotationEuler, [0, 0, 0.35]);
  assert.deepEqual(presentation.edgeSoftening, { enabled: false, method: "none-v1", modifierCount: 0 });

  assert.deepEqual(capture.blenderRuntime, BLENDER_RUNTIME);
  assert.equal(capture.renderPolicy.engine, "CYCLES");
  assert.equal(capture.renderPolicy.computeDeviceType, "METAL");
  assert.equal(capture.renderPolicy.sceneDevice, "GPU");
  assert.equal(capture.renderPolicy.width, 1920);
  assert.equal(capture.renderPolicy.height, 1280);
  assert.equal(capture.renderPolicy.samples, 256);
  assert.equal(capture.renderPolicy.samplingSeed, 170219);
  assert.equal(capture.renderPolicy.animatedSeed, false);
  assert.equal(capture.renderPolicy.useLightTree, true);
  assert.equal(capture.renderPolicy.adaptiveSampling, true);
  assert.deepEqual(capture.renderPolicy.denoising, {
    enabled: true,
    denoiser: "OPENIMAGEDENOISE",
    inputPasses: "RGB_ALBEDO_NORMAL",
    prefilter: "ACCURATE",
    quality: "HIGH",
    useGpu: false
  });
  assert.deepEqual(capture.colorManagement, {
    displayDevice: "sRGB",
    viewTransform: "AgX",
    look: "AgX - Medium High Contrast",
    exposure: 0,
    gamma: 1,
    useCurveMapping: false
  });
  assert.deepEqual(capture.outputs, [
    {
      pass: "photoreal-master",
      filename: PHOTOREAL_OUTPUT_FILENAMES.master,
      mimeType: "image/png",
      width: 1920,
      height: 1280,
      maxBytes: 268435456,
      colorMode: "RGB",
      colorDepth: "16",
      colorManagement: "FOLLOW_SCENE",
      compression: 15,
      quality: null
    },
    {
      pass: "photoreal-beauty",
      filename: PHOTOREAL_OUTPUT_FILENAMES.beauty,
      mimeType: "image/webp",
      width: 1920,
      height: 1280,
      maxBytes: 67108864,
      colorMode: "RGB",
      colorDepth: "8",
      colorManagement: "FOLLOW_SCENE",
      compression: null,
      quality: 92
    }
  ]);
  assert.notEqual(PHOTOREAL_OUTPUT_FILENAMES.beauty, "materials-preview.webp");
  assert.notEqual(PHOTOREAL_OUTPUT_FILENAMES.blend, "TV01-materials-preview.blend");
});

test("unknown properties, non-finite values, stale keys, and presentation mutations all fail closed", async (t) => {
  const { renderPackage, materialPackage, report, presentationPackage } = await getFoundation();
  const cases = [
    ["unknown top-level key", (value) => { value.uncontracted = true; }],
    ["unknown nested key", (value) => { value.presentation.camera.roll = 0; }],
    ["non-finite camera position", (value) => { value.presentation.camera.position.x = Number.NaN; }],
    ["stale package key", (value) => { value.presentationPackageKey = `jq-photoreal-presentation-package-v1-${"0".repeat(64)}`; }],
    ["stale capture key", (value) => { value.capture.captureKey = `jq-photoreal-beauty-v1-${"0".repeat(64)}`; }],
    ["camera mutation", (value) => { value.presentation.camera.lensMm = 24; }],
    ["light mutation", (value) => { value.presentation.lights[0].energyW = 421; }],
    ["room mutation", (value) => { value.presentation.roomMaterials[1].parameters.roughness = 0.5; }],
    ["world mutation", (value) => { value.presentation.world.strength = 1; }],
    ["Cycles mutation", (value) => { value.capture.renderPolicy.samples = 32; }],
    ["output mutation", (value) => { value.capture.outputs[1].filename = "materials-preview.webp"; }],
    ["approval mutation", (value) => { value.authority.customerBeautyRenderApproved = true; }]
  ];

  for (const [name, mutate] of cases) {
    await t.test(name, () => {
      const invalid = clone(presentationPackage);
      mutate(invalid);
      const validation = validateGuidedBlenderPhotorealPresentationPackage(
        renderPackage,
        materialPackage,
        report,
        invalid
      );
      assert.equal(validation.valid, false, `${name} rendered despite contract drift`);
      assert.ok(validation.errors.length > 0);
    });
  }

  const staleSources = [
    ["stale geometry fingerprint", () => {
      const invalid = clone(renderPackage);
      invalid.identity.geometryFingerprint = "jq-guided-geometry-v1-stale";
      return [invalid, materialPackage, report];
    }, "PHASE6_GEOMETRY_FINGERPRINT_MISMATCH"],
    ["stale material package", () => {
      const invalid = clone(materialPackage);
      invalid.materialPackageKey = `jq-render-material-package-v1-${"0".repeat(64)}`;
      return [renderPackage, invalid, report];
    }, "PHASE6_MATERIAL_PACKAGE_KEY_MISMATCH"],
    ["stale Phase 6 result", () => {
      const invalid = clone(report);
      invalid.resultKey = `jq-materials-preview-result-v1-${"0".repeat(64)}`;
      return [renderPackage, materialPackage, invalid];
    }, "PHASE6_RESULT_KEY_MISMATCH"],
    ["stale Phase 6 count", () => {
      const invalid = clone(report);
      invalid.counts.productMeshObjects = 77;
      return [renderPackage, materialPackage, invalid];
    }, "PHASE6_COUNT_MISMATCH"],
    ["stale Phase 6 digest", () => {
      const invalid = clone(report);
      invalid.digests.geometryAfterSha256 = "0".repeat(64);
      return [renderPackage, materialPackage, invalid];
    }, "PHASE6_DIGEST_MISMATCH"],
    ["empty Phase 6 parity", () => {
      const invalid = clone(report);
      invalid.parity = {};
      return [renderPackage, materialPackage, invalid];
    }, "PHASE6_PARITY_FAILED"]
  ];
  for (const [name, inputs, code] of staleSources) {
    await t.test(name, () => {
      assert.throws(
        () => createGuidedBlenderPhotorealPresentationPackage(
          ...inputs(),
          { blenderRuntime: BLENDER_RUNTIME }
        ),
        (error) => error?.code === code,
        name
      );
    });
  }
});

test("photoreal result manifests require both exact outputs and a current result key", async (t) => {
  const { presentationPackage } = await getFoundation();
  const outputs = presentationPackage.capture.outputs.map((contract, index) => ({
    pass: contract.pass,
    objectKey: `${presentationPackage.capture.captureKey}/${contract.filename}`,
    mimeType: contract.mimeType,
    width: contract.width,
    height: contract.height,
    bytes: 1000 + index,
    sha256: String(index + 1).repeat(64)
  }));
  const result = createGuidedBlenderPhotorealPresentationResult(presentationPackage, outputs);

  assert.equal(result.presentationPackageKey, presentationPackage.presentationPackageKey);
  assert.equal(result.captureKey, presentationPackage.capture.captureKey);
  assert.equal(result.presentationPipelineVersion, PHOTOREAL_PRESENTATION_PIPELINE_VERSION);
  assert.equal(result.status, "succeeded");
  assert.equal(
    result.resultKey,
    `jq-photoreal-beauty-result-v1-${hashCanonical(withoutKey(result, "resultKey"))}`
  );
  assert.equal(validateGuidedBlenderPhotorealPresentationResult(presentationPackage, result).valid, true);

  const cases = [
    ["unknown result property", (value) => { value.timestamp = "2026-08-03T00:00:00Z"; }],
    ["stale result key", (value) => { value.resultKey = `jq-photoreal-beauty-result-v1-${"0".repeat(64)}`; }],
    ["wrong package", (value) => { value.presentationPackageKey = `jq-photoreal-presentation-package-v1-${"0".repeat(64)}`; }],
    ["wrong capture", (value) => { value.captureKey = `jq-photoreal-beauty-v1-${"0".repeat(64)}`; }],
    ["wrong output filename", (value) => { value.outputs[1].objectKey = `${value.captureKey}/materials-preview.webp`; }],
    ["wrong dimensions", (value) => { value.outputs[0].width = 960; }],
    ["invalid byte count", (value) => { value.outputs[0].bytes = 0; }],
    ["invalid digest", (value) => { value.outputs[1].sha256 = "not-a-sha"; }]
  ];
  for (const [name, mutate] of cases) {
    await t.test(name, () => {
      const invalid = clone(result);
      mutate(invalid);
      const validation = validateGuidedBlenderPhotorealPresentationResult(presentationPackage, invalid);
      assert.equal(validation.valid, false, `${name} passed result validation`);
      assert.ok(validation.errors.length > 0);
    });
  }
});
