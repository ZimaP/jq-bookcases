import assert from "node:assert/strict";
import test from "node:test";

import {
  BLENDER_MATERIAL_TRANSLATION_POLICY_VERSION,
  EXPECTED_BINDING_COUNTS,
  EXPECTED_MATERIAL_BINDING_COUNT,
  EXPECTED_MATERIAL_FRAME_COUNT,
  EXPECTED_PRODUCT_BINDING_COUNT,
  EXPECTED_ROOM_BINDING_COUNT,
  MATERIAL_IDS,
  MATERIAL_PACKAGE_SCHEMA,
  MATERIAL_PIPELINE_VERSION,
  PBR_MATERIAL_LIBRARY_VERSION,
  PROCEDURAL_OAK_ALGORITHM_VERSION,
  createGuidedBlenderMaterialPackage,
  createMaterialPackageKey,
  createMaterialsPreviewCaptureKey,
  createMaterialsPreviewResult,
  deterministicJson,
  validateGuidedBlenderMaterialPackage,
  validateGuidedBlenderMaterialsPreviewResult
} from "../tools/blender/materials-preview-contract.mjs";
import { createVerifiedClayRenderPackage } from "../tools/blender/run-clay-worker.mjs";

const EXPECTED_GEOMETRY_FINGERPRINT = "jq-guided-geometry-v1-028YPJG43EJF6";
const EXPECTED_PRIMARY_PACKAGE_KEY = "jq-blender-package-v1-f80f6b84cb804623613e3ecb55aa61461e71e7a4dc70816e37bae38bd5e5be15";
const BLENDER_RUNTIME = Object.freeze({
  version: "5.2.0 LTS",
  buildHash: "fbe6228777e7",
  backend: "METAL",
  vendor: "Apple",
  renderer: "Metal API",
  deviceVersion: "Metal 3.2"
});
const VALID_OUTPUT_SHA256 = "6e5295070f3fc0778e4ffdda48736f9b985789b55162929cc9d98ec799407a86";

let generatedPromise;
let materialPackagePromise;

function getGenerated() {
  generatedPromise ||= createVerifiedClayRenderPackage();
  return generatedPromise;
}

async function getMaterialPackage() {
  materialPackagePromise ||= getGenerated().then((generated) => ({
    generated,
    materialPackage: createGuidedBlenderMaterialPackage(generated.renderPackage, {
      primaryPackageJson: generated.packageJson,
      blenderRuntime: BLENDER_RUNTIME
    })
  }));
  return materialPackagePromise;
}

function clone(value) {
  return structuredClone(value);
}

async function assertInvalid(candidate, expectedCode, options = {}) {
  const { generated } = await getMaterialPackage();
  const validation = validateGuidedBlenderMaterialPackage(
    options.renderPackage || generated.renderPackage,
    candidate,
    { primaryPackageJson: options.primaryPackageJson || generated.packageJson }
  );
  assert.equal(validation.valid, false, `expected ${expectedCode} to fail closed`);
  assert.ok(
    validation.errors.some((error) => error.code === expectedCode),
    `${expectedCode}: ${JSON.stringify(validation.errors)}`
  );
}

function findMaterial(materialPackage, materialId) {
  const material = materialPackage.materialLibrary.find((entry) => entry.materialId === materialId);
  assert.ok(material, materialId);
  return material;
}

function findFrameForBinding(materialPackage, binding) {
  const frame = materialPackage.materialFrames.find((entry) => entry.frameId === binding.materialFrameId);
  assert.ok(frame, binding.bindingId);
  return frame;
}

function reverseObjectKeys(value) {
  if (Array.isArray(value)) return value.map(reverseObjectKeys);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).reverse().map(([key, child]) => [key, reverseObjectKeys(child)])
  );
}

test("material sidecar generation is canonical and deterministic", async () => {
  const { generated, materialPackage: first } = await getMaterialPackage();
  const repeated = createGuidedBlenderMaterialPackage(generated.renderPackage, {
    primaryPackageJson: generated.packageJson,
    blenderRuntime: BLENDER_RUNTIME
  });

  assert.deepEqual(repeated, first);
  assert.equal(deterministicJson(repeated), deterministicJson(first));
  assert.match(first.materialPackageKey, /^jq-render-material-package-v1-[a-f0-9]{64}$/);
  assert.match(first.capture.captureKey, /^jq-materials-preview-v1-[a-f0-9]{64}$/);
  assert.equal(first.kind, "jq-render-material-package");
  assert.equal(first.schema, MATERIAL_PACKAGE_SCHEMA);
  assert.equal(first.versions.materialLibraryVersion, PBR_MATERIAL_LIBRARY_VERSION);
  assert.equal(first.versions.proceduralOakAlgorithmVersion, PROCEDURAL_OAK_ALGORITHM_VERSION);
  assert.equal(first.versions.blenderTranslationPolicyVersion, BLENDER_MATERIAL_TRANSLATION_POLICY_VERSION);
  assert.equal(first.versions.materialPipelineVersion, MATERIAL_PIPELINE_VERSION);
  assert.equal(first.translatorPolicy.policyId, BLENDER_MATERIAL_TRANSLATION_POLICY_VERSION);
  assert.equal(validateGuidedBlenderMaterialPackage(generated.renderPackage, first, {
    primaryPackageJson: generated.packageJson
  }).valid, true);
});

test("the sidecar preserves the complete accepted Phase 5 geometry, camera, room, world, and render identity", async () => {
  const { generated, materialPackage } = await getMaterialPackage();
  const renderPackage = generated.renderPackage;

  assert.equal(materialPackage.baseGeometry.geometryFingerprint, EXPECTED_GEOMETRY_FINGERPRINT);
  assert.equal(materialPackage.baseGeometry.primaryPackageKey, EXPECTED_PRIMARY_PACKAGE_KEY);
  assert.equal(materialPackage.baseGeometry.componentCount, 44);
  assert.equal(materialPackage.baseGeometry.submeshObjectCount, 78);
  assert.equal(materialPackage.baseGeometry.constraintCount, 7);
  assert.equal(materialPackage.baseGeometry.cameraFingerprint, renderPackage.identity.cameraFingerprint);
  assert.deepEqual(materialPackage.capture.camera, renderPackage.camera);
  assert.deepEqual(materialPackage.capture.inheritedRender, renderPackage.render);
  assert.deepEqual(materialPackage.capture.sceneIdentity.environment, renderPackage.scene.environment);
  assert.deepEqual(materialPackage.capture.sceneIdentity.shell, renderPackage.scene.shell);
  assert.deepEqual(materialPackage.capture.sceneIdentity.room, renderPackage.room);
  assert.deepEqual(materialPackage.capture.sceneIdentity.lightManifest, []);
  assert.equal(materialPackage.capture.output.width, 960);
  assert.equal(materialPackage.capture.output.height, 640);
  assert.equal(materialPackage.capture.output.filename, "materials-preview.webp");
  assert.notEqual(materialPackage.capture.output.filename, "beauty.webp");
});

test("all 78 product and two room surfaces resolve exactly once with the exact material counts", async () => {
  const { materialPackage } = await getMaterialPackage();
  const product = materialPackage.bindings.filter((binding) => binding.targetKind === "PRODUCT_SUBMESH");
  const room = materialPackage.bindings.filter((binding) => binding.targetKind === "ROOM_SURFACE");
  const counts = Object.fromEntries(Object.values(MATERIAL_IDS).map((id) => [id, 0]));
  materialPackage.bindings.forEach((binding) => { counts[binding.materialId] += 1; });

  assert.equal(product.length, EXPECTED_PRODUCT_BINDING_COUNT);
  assert.equal(room.length, EXPECTED_ROOM_BINDING_COUNT);
  assert.equal(materialPackage.bindings.length, EXPECTED_MATERIAL_BINDING_COUNT);
  assert.equal(new Set(materialPackage.bindings.map((binding) => binding.objectId)).size, 80);
  assert.equal(materialPackage.materialFrames.length, EXPECTED_MATERIAL_FRAME_COUNT);
  assert.deepEqual(counts, EXPECTED_BINDING_COUNTS);
  assert.equal(materialPackage.bindings.every((binding) => binding.materialSlotIndex === 0), true);
});

test("room wall and floor retain explicit inherited clay recipes rather than receiving oak", async () => {
  const { generated, materialPackage } = await getMaterialPackage();
  const roomBindings = materialPackage.bindings.filter((binding) => binding.targetKind === "ROOM_SURFACE");
  assert.deepEqual(roomBindings.map((binding) => binding.objectId).sort(), ["room-floor", "room-rear-wall"]);
  assert.deepEqual(roomBindings.map((binding) => binding.materialId).sort(), [
    MATERIAL_IDS.roomFloor,
    MATERIAL_IDS.roomWall
  ].sort());

  const wall = findMaterial(materialPackage, MATERIAL_IDS.roomWall);
  const floor = findMaterial(materialPackage, MATERIAL_IDS.roomFloor);
  assert.deepEqual(wall.parameters.baseColor, generated.renderPackage.scene.shell.wallSurface.baseColor);
  assert.equal(wall.parameters.metallic, generated.renderPackage.scene.shell.wallSurface.metallic);
  assert.equal(wall.parameters.roughness, generated.renderPackage.scene.shell.wallSurface.roughness);
  assert.deepEqual(floor.parameters.baseColor, generated.renderPackage.scene.shell.floorSurface.baseColor);
  assert.equal(floor.parameters.metallic, generated.renderPackage.scene.shell.floorSurface.metallic);
  assert.equal(floor.parameters.roughness, generated.renderPackage.scene.shell.floorSurface.roughness);
});

test("pulls, puck parts, and the TV screen bind only through stable semantic identities", async () => {
  const { materialPackage } = await getMaterialPackage();
  const hardware = materialPackage.bindings.filter((binding) => binding.materialId === MATERIAL_IDS.hardware);
  const pulls = hardware.filter((binding) => binding.componentId.endsWith("-handle"));
  const housings = hardware.filter((binding) => binding.submeshId === "housing-rim");
  const lenses = materialPackage.bindings.filter((binding) => binding.materialId === MATERIAL_IDS.lens);
  const screens = materialPackage.bindings.filter((binding) => binding.materialId === MATERIAL_IDS.screen);

  assert.equal(pulls.length, 8);
  assert.equal(pulls.every((binding) => binding.sourceMaterialSlot === "hardware" && binding.sourceMaterialId === "black-pull"), true);
  assert.equal(housings.length, 2);
  assert.equal(housings.every((binding) => binding.sourceMaterialSlot === "hardware" && binding.sourceMaterialId === "black-pull"), true);
  assert.equal(lenses.length, 2);
  assert.equal(lenses.every((binding) => binding.submeshId === "emissive-lens" && binding.sourceMaterialId === "warm-led"), true);
  assert.equal(screens.length, 1);
  assert.equal(screens[0].componentId, "guided-installation-main/tv-body");
  assert.equal(screens[0].sourceMaterialSlot, "screen");
  assert.equal(screens[0].sourceMaterialId, "tv-screen-neutral");
});

test("the puck-lens emission is derived exactly from the authoritative warm-led package recipe and component warmth", async () => {
  const { generated, materialPackage } = await getMaterialPackage();
  const warmLed = generated.renderPackage.materials.find((material) => material.materialId === "warm-led");
  const lens = findMaterial(materialPackage, MATERIAL_IDS.lens);
  const puckComponents = generated.renderPackage.components.filter((component) => (
    component.role === "light"
    && component.submeshes.some((submesh) => submesh.materialId === "warm-led")
  ));

  assert.deepEqual(warmLed.definition, {
    family: "emissive",
    baseColor: "#fff3df",
    strength: 6,
    colorTemperatureSource: "component.metadata.warmth"
  });
  assert.equal(puckComponents.length, 2);
  assert.equal(puckComponents.every((component) => component.metadata.warmth === 2700), true);
  assert.deepEqual(lens.parameters.emissionColor, [1, 0.896269353374, 0.737910408773, 1]);
  assert.equal(lens.parameters.emissionStrength, 6);
  assert.equal(lens.parameters.colorTemperatureK, 2700);
  assert.equal(
    materialPackage.authority.sourceRuleIds.includes("guided-blender-render-contract.js#warm-led"),
    true
  );
});

test("warm-led recipe and puck metadata drift fail closed before sidecar generation", async (t) => {
  const { generated } = await getMaterialPackage();
  const cases = [
    ["base color", "WARM_LED_DEFINITION_MISMATCH", (value) => {
      value.materials.find((material) => material.materialId === "warm-led").definition.baseColor = "#fff4df";
    }],
    ["emission strength", "WARM_LED_DEFINITION_MISMATCH", (value) => {
      value.materials.find((material) => material.materialId === "warm-led").definition.strength = 5;
    }],
    ["temperature source", "WARM_LED_DEFINITION_MISMATCH", (value) => {
      value.materials.find((material) => material.materialId === "warm-led").definition.colorTemperatureSource = "component.metadata.temperature";
    }],
    ["missing definition key", "UNKNOWN_OR_MISSING_PROPERTY", (value) => {
      delete value.materials.find((material) => material.materialId === "warm-led").definition.strength;
    }],
    ["duplicate definition", "WARM_LED_MATERIAL_CARDINALITY", (value) => {
      value.materials.push(clone(value.materials.find((material) => material.materialId === "warm-led")));
    }],
    ["first puck warmth", "WARM_LED_COLOR_TEMPERATURE_MISMATCH", (value) => {
      value.components.find((component) => component.role === "light").metadata.warmth = 3000;
    }],
    ["second puck missing warmth", "WARM_LED_COLOR_TEMPERATURE_MISMATCH", (value) => {
      const pucks = value.components.filter((component) => component.role === "light");
      delete pucks[1].metadata.warmth;
    }]
  ];

  for (const [name, code, mutate] of cases) {
    await t.test(name, () => {
      const renderPackage = clone(generated.renderPackage);
      mutate(renderPackage);
      assert.throws(
        () => createGuidedBlenderMaterialPackage(renderPackage, { blenderRuntime: BLENDER_RUNTIME }),
        (error) => error?.code === code,
        code
      );
    });
  }
});

test("authority remains preview-only and both customer approval flags remain false", async () => {
  const { materialPackage } = await getMaterialPackage();
  assert.equal(materialPackage.authority.classification, "PREVIEW_ONLY_AUTHORIZED");
  assert.equal(materialPackage.authority.materialColorReferenceStatus, "UNVERIFIED");
  assert.equal(materialPackage.authority.customerMaterialApproved, false);
  assert.equal(materialPackage.authority.customerBeautyRenderApproved, false);
});

test("wood material frames follow semantic construction grain roles", async () => {
  const { generated, materialPackage } = await getMaterialPackage();
  const submeshes = new Map(generated.renderPackage.components.flatMap((component) => (
    component.submeshes.map((submesh) => [
      `${component.componentId}::${submesh.submeshId}`,
      submesh
    ])
  )));
  const expectedFrameByRole = {
    back_panel: [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
    backing_panel: [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
    base: [[1, 0, 0], [0, 0, 1], [0, -1, 0]],
    bottom_panel: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    crown: [[1, 0, 0], [0, 0, 1], [0, -1, 0]],
    divider: [[0, 0, 1], [0, 1, 0], [-1, 0, 0]],
    filler: [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
    fixed_shelf: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    front_field: [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
    front_rail: [[1, 0, 0], [0, 0, 1], [0, -1, 0]],
    front_stile: [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
    shelf: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    side_panel: [[0, 0, 1], [0, 1, 0], [-1, 0, 0]],
    top_panel: [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
  };
  const seenRoles = new Set();

  for (const binding of materialPackage.bindings.filter((entry) => entry.materialFrameId !== null)) {
    const submesh = submeshes.get(binding.objectId);
    const frame = findFrameForBinding(materialPackage, binding);
    assert.ok(submesh, binding.objectId);
    const expectedFrame = expectedFrameByRole[submesh.grainRole];
    assert.deepEqual(
      [frame.grainAxis, frame.crossGrainAxis, frame.normalAxis],
      expectedFrame,
      binding.objectId
    );
    seenRoles.add(submesh.grainRole);
  }
  assert.deepEqual([...seenRoles].sort(), Object.keys(expectedFrameByRole).sort());
});

test("each wood piece has an independent deterministic seed, phase, and right-handed mapping", async () => {
  const { materialPackage } = await getMaterialPackage();
  const frames = materialPackage.materialFrames;
  assert.equal(new Set(frames.map((frame) => frame.frameId)).size, frames.length);
  assert.equal(new Set(frames.map((frame) => frame.mappingId)).size, frames.length);
  assert.equal(new Set(frames.map((frame) => frame.seedHex)).size, frames.length);
  assert.equal(new Set(frames.map((frame) => JSON.stringify(frame.phaseOffset))).size, frames.length);
  assert.equal(new Set(frames.map((frame) => frame.mappingDigest)).size, frames.length);

  for (const frame of frames) {
    const cross = [
      frame.grainAxis[1] * frame.crossGrainAxis[2] - frame.grainAxis[2] * frame.crossGrainAxis[1],
      frame.grainAxis[2] * frame.crossGrainAxis[0] - frame.grainAxis[0] * frame.crossGrainAxis[2],
      frame.grainAxis[0] * frame.crossGrainAxis[1] - frame.grainAxis[1] * frame.crossGrainAxis[0]
    ];
    assert.deepEqual(cross, frame.normalAxis, frame.frameId);
    assert.equal(frame.coordinateSpace, "PACKAGE_WORLD_METERS");
    assert.equal(frame.seedHex.length, 64);
    assert.equal(frame.phaseOffset.every((value) => value >= 0 && value <= 1), true);
  }
});

test("component and submesh reordering cannot change per-piece seeds or mappings", async () => {
  const { generated, materialPackage } = await getMaterialPackage();
  const reorderedGeometry = clone(generated.renderPackage);
  reorderedGeometry.components.reverse();
  reorderedGeometry.components.forEach((component) => component.submeshes.reverse());
  const reordered = createGuidedBlenderMaterialPackage(reorderedGeometry, {
    primaryPackageJson: deterministicJson(reorderedGeometry),
    blenderRuntime: BLENDER_RUNTIME
  });
  const summarize = (value) => value.materialFrames.map((frame) => ({
    frameId: frame.frameId,
    mappingId: frame.mappingId,
    seedHex: frame.seedHex,
    phaseOffset: frame.phaseOffset,
    mappingDigest: frame.mappingDigest
  }));

  assert.deepEqual(summarize(reordered), summarize(materialPackage));
  assert.deepEqual(reordered.bindings.map((binding) => binding.bindingId), materialPackage.bindings.map((binding) => binding.bindingId));
});

test("the material recipes prohibit external, randomized, camera-driven, and geometry-displacing inputs", async () => {
  const { materialPackage } = await getMaterialPackage();
  const json = deterministicJson(materialPackage);
  for (const material of materialPackage.materialLibrary) {
    assert.deepEqual(material.externalResources, []);
    assert.equal(material.trueDisplacement, false);
    assert.notEqual(material.coordinatePolicy, "camera-coordinates");
    if (material.parameters.procedural) {
      assert.equal(material.parameters.procedural.coordinateSpace, "PACKAGE_WORLD_METERS");
      assert.equal(material.parameters.procedural.coarseNoise.dimensions, "4D");
      assert.equal(material.parameters.procedural.fiberNoise.dimensions, "4D");
    }
  }
  assert.equal(/Object Info Random|image texture|https?:|camera coordinates/i.test(json), false);
  assert.equal(/"dimensions"\s*:\s*"(?:RANDOM|TIME|FRAME)"/i.test(json), false);
  assert.equal(json.includes("pythonHash"), false);
  assert.equal(json.includes("trueDisplacement\": true"), false);
});

test("preview-only documentation and JSON key ordering do not change material identity", async () => {
  const { generated, materialPackage } = await getMaterialPackage();
  const reordered = reverseObjectKeys(materialPackage);
  const documented = clone(materialPackage);
  documented.authority.limitations.push("Documentation-only test note.");
  const reformattedGeometryJson = JSON.stringify(reverseObjectKeys(generated.renderPackage), null, 7);
  const regeneratedFromReformattedGeometry = createGuidedBlenderMaterialPackage(
    generated.renderPackage,
    { primaryPackageJson: reformattedGeometryJson, blenderRuntime: BLENDER_RUNTIME }
  );

  assert.equal(createMaterialPackageKey(reordered), materialPackage.materialPackageKey);
  assert.equal(createMaterialPackageKey(documented), materialPackage.materialPackageKey);
  assert.equal(
    regeneratedFromReformattedGeometry.baseGeometry.primaryPackageSha256,
    materialPackage.baseGeometry.primaryPackageSha256
  );
  assert.equal(regeneratedFromReformattedGeometry.materialPackageKey, materialPackage.materialPackageKey);
  assert.equal(regeneratedFromReformattedGeometry.capture.captureKey, materialPackage.capture.captureKey);
});

test("every pixel-affecting material change changes both material-package and capture identities", async () => {
  const { materialPackage } = await getMaterialPackage();
  const changed = clone(materialPackage);
  findMaterial(changed, MATERIAL_IDS.oak).parameters.roughness += 0.001;
  const changedPackageKey = createMaterialPackageKey(changed);
  const { captureKey: ignored, ...captureWithoutKey } = materialPackage.capture;
  const changedCaptureKey = createMaterialsPreviewCaptureKey(changedPackageKey, captureWithoutKey);

  assert.notEqual(changedPackageKey, materialPackage.materialPackageKey);
  assert.notEqual(changedCaptureKey, materialPackage.capture.captureKey);
});

test("the versioned translator policy pins every worker-owned pixel-affecting Blender constant", async () => {
  const { materialPackage } = await getMaterialPackage();
  assert.deepEqual(materialPackage.translatorPolicy, {
    policyId: "jq-blender-material-translation-policy-v1",
    materialDatablock: {
      useNodes: true,
      surfaceRenderMethod: "DITHERED",
      useTransparencyOverlap: true
    },
    principled: {
      distribution: "MULTI_GGX",
      weight: 1,
      normalInput: [0, 0, 0],
      subsurfaceWeight: 0,
      subsurfaceRadius: [1, 0.2, 0.1],
      subsurfaceScale: 0.05,
      subsurfaceIor: 1.4,
      anisotropy: 0,
      specularTint: [1, 1, 1, 1],
      tangentInput: [0, 0, 0],
      coatTint: [1, 1, 1, 1],
      coatNormalInput: [0, 0, 0],
      sheenWeight: 0,
      sheenRoughness: 0.5,
      sheenTint: [1, 1, 1, 1],
      thinFilmThickness: 0,
      thinFilmIor: 1.33
    },
    textureCoordinates: { output: "Object", object: null, fromInstancer: false },
    vectorMath: {
      subtractOriginOperation: "SUBTRACT",
      axisProjectionOperation: "DOT_PRODUCT",
      physicalScaleOperation: "DIVIDE",
      phaseOperation: "ADD"
    },
    noise: { offset: 0, gain: 1 },
    mix: { useAlpha: false },
    mapRange: { dataType: "FLOAT" },
    bump: { filterWidth: 0.1, normalInput: [0, 0, 0] },
    output: { surfaceOnly: true }
  });
});

test("translator-policy changes affect package and capture identity and hostile policy drift fails closed", async (t) => {
  const { materialPackage } = await getMaterialPackage();
  const changed = clone(materialPackage);
  changed.translatorPolicy.bump.filterWidth = 0.2;
  const changedPackageKey = createMaterialPackageKey(changed);
  const { captureKey: ignored, ...captureWithoutKey } = materialPackage.capture;
  assert.notEqual(changedPackageKey, materialPackage.materialPackageKey);
  assert.notEqual(
    createMaterialsPreviewCaptureKey(changedPackageKey, captureWithoutKey),
    materialPackage.capture.captureKey
  );

  const cases = [
    ["unknown policy field", "UNKNOWN_OR_MISSING_PROPERTY", (value) => { value.translatorPolicy.cameraDriven = true; }],
    ["missing policy field", "UNKNOWN_OR_MISSING_PROPERTY", (value) => { delete value.translatorPolicy.output; }],
    ["wrong policy ID", "TRANSLATOR_POLICY_ID_INVALID", (value) => { value.translatorPolicy.policyId = "jq-blender-material-translation-policy-v2"; }],
    ["wrong boolean type", "TRANSLATOR_POLICY_TYPE_INVALID", (value) => { value.translatorPolicy.materialDatablock.useNodes = 1; }],
    ["out-of-range weight", "NUMBER_OUT_OF_RANGE", (value) => { value.translatorPolicy.principled.weight = 1.1; }],
    ["non-positive subsurface scale", "NON_POSITIVE_NUMBER", (value) => { value.translatorPolicy.principled.subsurfaceScale = 0; }],
    ["invalid color", "NUMBER_OUT_OF_RANGE", (value) => { value.translatorPolicy.principled.specularTint[0] = 1.1; }],
    ["non-positive bump filter", "NON_POSITIVE_NUMBER", (value) => { value.translatorPolicy.bump.filterWidth = 0; }],
    ["wrong operation", "TRANSLATOR_POLICY_INVALID", (value) => { value.translatorPolicy.vectorMath.phaseOperation = "MULTIPLY"; }],
    ["camera coordinate output", "TRANSLATOR_POLICY_INVALID", (value) => { value.translatorPolicy.textureCoordinates.output = "Camera"; }],
    ["material datablock drift", "TRANSLATOR_POLICY_INVALID", (value) => { value.translatorPolicy.materialDatablock.surfaceRenderMethod = "BLENDED"; }],
    ["surface output disabled", "TRANSLATOR_POLICY_INVALID", (value) => { value.translatorPolicy.output.surfaceOnly = false; }],
    ["missing version", "UNKNOWN_OR_MISSING_PROPERTY", (value) => { delete value.versions.blenderTranslationPolicyVersion; }],
    ["wrong version", "MATERIAL_VERSION_MISMATCH", (value) => { value.versions.blenderTranslationPolicyVersion = "jq-blender-material-translation-policy-v2"; }]
  ];
  for (const [name, code, mutate] of cases) {
    await t.test(name, async () => {
      const candidate = clone(materialPackage);
      mutate(candidate);
      await assertInvalid(candidate, code);
    });
  }
});

test("shader values fail closed for non-finite, mistyped, out-of-range, missing, and unknown data", async (t) => {
  const { materialPackage } = await getMaterialPackage();
  const cases = [
    ["NaN", "NON_FINITE_NUMBER", (value) => { findMaterial(value, MATERIAL_IDS.oak).parameters.roughness = Number.NaN; }],
    ["infinity", "NON_FINITE_NUMBER", (value) => { findMaterial(value, MATERIAL_IDS.oak).parameters.roughness = Number.POSITIVE_INFINITY; }],
    ["wrong numeric type", "NON_FINITE_NUMBER", (value) => { findMaterial(value, MATERIAL_IDS.oak).parameters.roughness = "0.5"; }],
    ["negative roughness", "NUMBER_OUT_OF_RANGE", (value) => { findMaterial(value, MATERIAL_IDS.oak).parameters.roughness = -0.1; }],
    ["metallic over one", "NUMBER_OUT_OF_RANGE", (value) => { findMaterial(value, MATERIAL_IDS.hardware).parameters.metallic = 1.1; }],
    ["transmission over one", "NUMBER_OUT_OF_RANGE", (value) => { findMaterial(value, MATERIAL_IDS.screen).parameters.transmissionWeight = 1.1; }],
    ["coat over one", "NUMBER_OUT_OF_RANGE", (value) => { findMaterial(value, MATERIAL_IDS.oak).parameters.coatWeight = 1.1; }],
    ["alpha over one", "NUMBER_OUT_OF_RANGE", (value) => { findMaterial(value, MATERIAL_IDS.screen).parameters.alpha = 1.1; }],
    ["non-positive IOR", "NON_POSITIVE_NUMBER", (value) => { findMaterial(value, MATERIAL_IDS.screen).parameters.ior = 0; }],
    ["invalid color", "NUMBER_OUT_OF_RANGE", (value) => { findMaterial(value, MATERIAL_IDS.screen).parameters.baseColor[0] = 1.1; }],
    ["missing shader property", "UNKNOWN_OR_MISSING_PROPERTY", (value) => { delete findMaterial(value, MATERIAL_IDS.screen).parameters.roughness; }],
    ["unknown shader property", "UNKNOWN_OR_MISSING_PROPERTY", (value) => { findMaterial(value, MATERIAL_IDS.screen).parameters.imageTexture = "oak.png"; }]
  ];
  for (const [name, code, mutate] of cases) {
    await t.test(name, async () => {
      const candidate = clone(materialPackage);
      mutate(candidate);
      await assertInvalid(candidate, code);
    });
  }
});

test("procedural recipes reject malformed ramps, unsupported nodes, resources, drivers, and true displacement", async (t) => {
  const { materialPackage } = await getMaterialPackage();
  const cases = [
    ["missing ramp stops", "MISSING_COLOR_RAMP_STOPS", (value) => { findMaterial(value, MATERIAL_IDS.oak).parameters.baseColorRamp.stops = []; }],
    ["unordered ramp", "COLOR_RAMP_ORDER_INVALID", (value) => { findMaterial(value, MATERIAL_IDS.oak).parameters.baseColorRamp.stops[1].position = 0; }],
    ["external path", "EXTERNAL_MATERIAL_RESOURCE_FORBIDDEN", (value) => { findMaterial(value, MATERIAL_IDS.oak).externalResources = ["/tmp/oak.exr"]; }],
    ["network resource", "EXTERNAL_MATERIAL_RESOURCE_FORBIDDEN", (value) => { findMaterial(value, MATERIAL_IDS.oak).externalResources = ["https://example.invalid/oak.exr"]; }],
    ["image topology", "UNSUPPORTED_SHADER_TOPOLOGY", (value) => { findMaterial(value, MATERIAL_IDS.oak).shaderTopologyId = "image-texture-v1"; }],
    ["camera coordinates", "UNSUPPORTED_COORDINATE_POLICY", (value) => { findMaterial(value, MATERIAL_IDS.oak).coordinatePolicy = "camera-coordinates"; }],
    ["random node", "UNSUPPORTED_NOISE_NODE", (value) => { findMaterial(value, MATERIAL_IDS.oak).parameters.procedural.coarseNoise.dimensions = "RANDOM"; }],
    ["time node", "UNSUPPORTED_NOISE_NODE", (value) => { findMaterial(value, MATERIAL_IDS.oak).parameters.procedural.coarseNoise.dimensions = "TIME"; }],
    ["frame node", "UNSUPPORTED_NOISE_NODE", (value) => { findMaterial(value, MATERIAL_IDS.oak).parameters.procedural.coarseNoise.dimensions = "FRAME"; }],
    ["true displacement", "TRUE_DISPLACEMENT_FORBIDDEN", (value) => { findMaterial(value, MATERIAL_IDS.oak).trueDisplacement = true; }],
    ["unsupported bump source", "INVALID_BUMP_SOURCE", (value) => { findMaterial(value, MATERIAL_IDS.oak).parameters.bump.source = "geometry-displacement"; }],
    ["non-positive texture scale", "NON_POSITIVE_NUMBER", (value) => { findMaterial(value, MATERIAL_IDS.oak).parameters.procedural.physicalTextureScaleM.grain = 0; }]
  ];
  for (const [name, code, mutate] of cases) {
    await t.test(name, async () => {
      const candidate = clone(materialPackage);
      mutate(candidate);
      await assertInvalid(candidate, code);
    });
  }
});

test("duplicate, missing, unresolved, and conflicting material declarations fail closed", async (t) => {
  const { materialPackage } = await getMaterialPackage();
  const cases = [
    ["duplicate material", "DUPLICATE_MATERIAL_ID", (value) => { value.materialLibrary[1] = clone(value.materialLibrary[0]); }],
    ["duplicate binding", "DUPLICATE_BINDING_ID", (value) => { value.bindings[1] = clone(value.bindings[0]); }],
    ["missing binding", "MATERIAL_BINDING_CARDINALITY", (value) => { value.bindings.pop(); }],
    ["missing slot", "UNKNOWN_OR_MISSING_PROPERTY", (value) => { delete value.bindings[0].materialSlotIndex; }],
    ["unresolved object", "UNRESOLVED_MATERIAL_BINDING", (value) => { value.bindings[0].objectId = "invented-object"; }],
    ["unknown material", "UNKNOWN_BINDING_MATERIAL", (value) => { value.bindings[0].materialId = "invented-material"; }],
    ["conflicting binding", "CONFLICTING_MATERIAL_BINDING", (value) => { value.bindings[1].objectId = value.bindings[0].objectId; }],
    ["unresolved room clay", "UNKNOWN_BINDING_MATERIAL", (value) => {
      value.bindings.find((binding) => binding.objectId === "room-floor").materialId = "missing-room-clay";
    }]
  ];
  for (const [name, code, mutate] of cases) {
    await t.test(name, async () => {
      const candidate = clone(materialPackage);
      mutate(candidate);
      await assertInvalid(candidate, code);
    });
  }
});

test("malformed, duplicate, non-orthogonal, left-handed, and non-positive frames fail closed", async (t) => {
  const { materialPackage } = await getMaterialPackage();
  const cases = [
    ["duplicate frame ID", "DUPLICATE_MATERIAL_FRAME", (value) => { value.materialFrames[1].frameId = value.materialFrames[0].frameId; }],
    ["duplicate mapping ID", "DUPLICATE_MATERIAL_MAPPING", (value) => { value.materialFrames[1].mappingId = value.materialFrames[0].mappingId; }],
    ["zero axis", "NON_NORMALIZED_MATERIAL_FRAME", (value) => { value.materialFrames[0].grainAxis = [0, 0, 0]; }],
    ["non-orthogonal axes", "NON_ORTHOGONAL_MATERIAL_FRAME", (value) => { value.materialFrames[0].crossGrainAxis = value.materialFrames[0].grainAxis; }],
    ["left-handed basis", "LEFT_HANDED_MATERIAL_FRAME", (value) => { value.materialFrames[0].normalAxis = value.materialFrames[0].normalAxis.map((entry) => -entry); }],
    ["unsupported coordinate space", "UNSUPPORTED_COORDINATE_SPACE", (value) => { value.materialFrames[0].coordinateSpace = "CAMERA"; }],
    ["non-positive scale", "NON_POSITIVE_NUMBER", (value) => { value.materialFrames[0].physicalTextureScaleM.crossGrain = 0; }],
    ["stale digest", "MAPPING_DIGEST_MISMATCH", (value) => { value.materialFrames[0].mappingDigest = "0".repeat(64); }]
  ];
  for (const [name, code, mutate] of cases) {
    await t.test(name, async () => {
      const candidate = clone(materialPackage);
      mutate(candidate);
      await assertInvalid(candidate, code);
    });
  }
});

test("base geometry, package hashes, camera, world, render settings, and primary output targets cannot drift", async (t) => {
  const { generated, materialPackage } = await getMaterialPackage();
  const cases = [
    ["base geometry fingerprint", "BASE_GEOMETRY_IDENTITY_MISMATCH", (value) => { value.baseGeometry.geometryFingerprint = "jq-guided-geometry-v1-drift"; }],
    ["primary package key", "BASE_GEOMETRY_IDENTITY_MISMATCH", (value) => { value.baseGeometry.primaryPackageKey = "jq-blender-package-v1-drift"; }],
    ["primary package hash", "BASE_GEOMETRY_IDENTITY_MISMATCH", (value) => { value.baseGeometry.primaryPackageSha256 = "0".repeat(64); }],
    ["object manifest hash", "BASE_GEOMETRY_IDENTITY_MISMATCH", (value) => { value.baseGeometry.objectManifestSha256 = "0".repeat(64); }],
    ["camera", "CUSTOMER_CAMERA_MUTATION", (value) => { value.capture.camera.lensMm += 1; }],
    ["world", "SCENE_IDENTITY_MUTATION", (value) => { value.capture.sceneIdentity.environment.strength += 0.01; }],
    ["room", "SCENE_IDENTITY_MUTATION", (value) => { value.capture.sceneIdentity.shell.wallWidthIn += 1; }],
    ["render", "RENDER_SETTINGS_MUTATION", (value) => { value.capture.inheritedRender.samples += 1; }],
    ["sampling seed value", "MATERIAL_RENDER_POLICY_INVALID", (value) => { value.capture.renderPolicy.samplingSeed.value = 1; }],
    ["animated seed value", "MATERIAL_RENDER_POLICY_INVALID", (value) => { value.capture.renderPolicy.animatedSeed.value = false; }],
    ["adaptive sampling value", "MATERIAL_RENDER_POLICY_INVALID", (value) => { value.capture.renderPolicy.adaptiveSampling.value = true; }],
    ["denoiser value", "MATERIAL_RENDER_POLICY_INVALID", (value) => { value.capture.renderPolicy.denoiser.value = true; }],
    ["primary beauty output", "MATERIAL_OUTPUT_CONTRACT_INVALID", (value) => { value.capture.output.filename = "beauty.webp"; }],
    ["primary blend output", "MATERIAL_OUTPUT_CONTRACT_INVALID", (value) => { value.capture.output.filename = "TV01-clay.blend"; }],
    ["stale package key", "STALE_MATERIAL_PACKAGE_KEY", (value) => { value.materialPackageKey = `jq-render-material-package-v1-${"0".repeat(64)}`; }],
    ["stale capture key", "STALE_CAPTURE_KEY", (value) => { value.capture.captureKey = `jq-materials-preview-v1-${"0".repeat(64)}`; }]
  ];
  for (const [name, code, mutate] of cases) {
    await t.test(name, async () => {
      const candidate = clone(materialPackage);
      mutate(candidate);
      await assertInvalid(candidate, code);
    });
  }

  await t.test("base mesh mutation", async () => {
    const mutatedGeometry = clone(generated.renderPackage);
    mutatedGeometry.components[0].submeshes[0].blenderWorldBounds.min.x += 0.001;
    await assertInvalid(clone(materialPackage), "BASE_GEOMETRY_IDENTITY_MISMATCH", {
      renderPackage: mutatedGeometry,
      primaryPackageJson: deterministicJson(mutatedGeometry)
    });
  });
});

test("material preview result manifests validate exact package, capture, structure, bytes, dimensions, and hashes", async (t) => {
  const { materialPackage } = await getMaterialPackage();
  const output = {
    pass: "materials-preview",
    objectKey: `${materialPackage.capture.captureKey}/materials-preview.webp`,
    mimeType: "image/webp",
    width: 960,
    height: 640,
    bytes: 12345,
    sha256: VALID_OUTPUT_SHA256
  };
  const result = createMaterialsPreviewResult(materialPackage, output);
  assert.equal(validateGuidedBlenderMaterialsPreviewResult(materialPackage, result).valid, true);
  assert.match(result.resultKey, /^jq-materials-preview-result-v1-[a-f0-9]{64}$/);

  const cases = [
    ["stale result key", "RESULT_KEY_MISMATCH", (value) => { value.resultKey = `jq-materials-preview-result-v1-${"0".repeat(64)}`; }],
    ["stale output hash", "RESULT_KEY_MISMATCH", (value) => { value.outputs[0].sha256 = "1".repeat(64); }],
    ["malformed output hash", "INVALID_RESULT_SHA256", (value) => { value.outputs[0].sha256 = "not-a-sha"; }],
    ["wrong package", "RESULT_PACKAGE_KEY_MISMATCH", (value) => { value.materialPackageKey = "wrong"; }],
    ["wrong capture", "RESULT_CAPTURE_KEY_MISMATCH", (value) => { value.captureKey = "wrong"; }],
    ["wrong dimensions", "RESULT_DIMENSIONS_MISMATCH", (value) => { value.outputs[0].width = 1; }],
    ["wrong MIME", "INVALID_RESULT_MIME", (value) => { value.outputs[0].mimeType = "image/png"; }],
    ["wrong object key", "RESULT_OBJECT_KEY_MISMATCH", (value) => { value.outputs[0].objectKey = "materials-preview.webp"; }],
    ["unknown result property", "UNKNOWN_OR_MISSING_PROPERTY", (value) => { value.timestamp = "forbidden"; }]
  ];
  for (const [name, code, mutate] of cases) {
    await t.test(name, () => {
      const candidate = clone(result);
      mutate(candidate);
      const validation = validateGuidedBlenderMaterialsPreviewResult(materialPackage, candidate);
      assert.equal(validation.valid, false);
      assert.ok(validation.errors.some((error) => error.code === code), JSON.stringify(validation.errors));
    });
  }
});
