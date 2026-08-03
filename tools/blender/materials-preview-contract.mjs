import { createHash } from "node:crypto";

export const MATERIAL_PACKAGE_KIND = "jq-render-material-package";
export const MATERIAL_PACKAGE_SCHEMA = "jq-render-material-package-v1";
export const MATERIAL_PACKAGE_SCHEMA_VERSION = 1;
export const MATERIAL_PREVIEW_CAPTURE_ID = "materials-preview-v1";
export const MATERIAL_PREVIEW_RESULT_KIND = "jq-render-material-preview-result";
export const MATERIAL_PREVIEW_RESULT_SCHEMA_VERSION = 1;
export const MATERIAL_DESCRIPTOR_SCHEMA_VERSION = 1;
export const PBR_MATERIAL_LIBRARY_VERSION = "jq-pbr-material-library-v1";
export const PROCEDURAL_OAK_ALGORITHM_VERSION = "jq-procedural-natural-oak-v1";
export const MATERIAL_FRAME_VERSION = "jq-material-frame-v1";
export const MATERIAL_SEED_RULE_VERSION = "jq-material-piece-seed-sha256-v1";
export const BLENDER_MATERIAL_TRANSLATOR_VERSION = "jq-blender-material-translator-v1";
export const BLENDER_MATERIAL_TRANSLATION_POLICY_VERSION = "jq-blender-material-translation-policy-v1";
export const MATERIAL_PIPELINE_VERSION = "2026.08-deterministic-pbr-materials-v1";
export const SHADER_TOPOLOGY_VERSION = "jq-blender-pbr-node-topology-v1";

export const MATERIAL_IDS = Object.freeze({
  oak: "natural-oak-visualization-v1",
  countertop: "natural-oak-countertop-visualization-v1",
  hardware: "matte-black-hardware-v1",
  screen: "tv-black-glass-v1",
  lens: "warm-opal-puck-lens-v1",
  roomWall: "inherited-room-wall-clay-v1",
  roomFloor: "inherited-room-floor-clay-v1"
});

export const EXPECTED_BINDING_COUNTS = Object.freeze({
  [MATERIAL_IDS.oak]: 64,
  [MATERIAL_IDS.countertop]: 1,
  [MATERIAL_IDS.hardware]: 10,
  [MATERIAL_IDS.screen]: 1,
  [MATERIAL_IDS.lens]: 2,
  [MATERIAL_IDS.roomWall]: 1,
  [MATERIAL_IDS.roomFloor]: 1
});

export const EXPECTED_PRODUCT_BINDING_COUNT = 78;
export const EXPECTED_ROOM_BINDING_COUNT = 2;
export const EXPECTED_MATERIAL_FRAME_COUNT = 65;
export const EXPECTED_MATERIAL_BINDING_COUNT = 80;

const EXPECTED_GEOMETRY_FINGERPRINT = "jq-guided-geometry-v1-028YPJG43EJF6";
const EXPECTED_PRIMARY_PACKAGE_KEY = "jq-blender-package-v1-f80f6b84cb804623613e3ecb55aa61461e71e7a4dc70816e37bae38bd5e5be15";
const EXPECTED_COMPONENT_COUNT = 44;
const EXPECTED_SUBMESH_COUNT = 78;
const EXPECTED_CONSTRAINT_COUNT = 7;
const SUPPORTED_BLENDER_VERSION = "5.2.0 LTS";
const SUPPORTED_BLENDER_BUILD = "fbe6228777e7";
const COUNTERTOP_COMPONENT_ID = "guided-installation-main/continuous-countertop";
const TV_COMPONENT_ID = "guided-installation-main/tv-body";
const WARM_LED_SOURCE_RULE_ID = "guided-blender-render-contract.js#warm-led";
const WARM_LED_DEFINITION = Object.freeze({
  family: "emissive",
  baseColor: "#fff3df",
  strength: 6,
  colorTemperatureSource: "component.metadata.warmth"
});

const MATERIAL_PACKAGE_KEY_RE = /^jq-render-material-package-v1-[a-f0-9]{64}$/;
const CAPTURE_KEY_RE = /^jq-materials-preview-v1-[a-f0-9]{64}$/;
const RESULT_KEY_RE = /^jq-materials-preview-result-v1-[a-f0-9]{64}$/;
const SHA256_RE = /^[a-f0-9]{64}$/;
const SAFE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._/+:\-]{0,511}$/;

const WOOD_SOURCE_SLOTS = new Set([
  "back", "cabinet_finish", "cabinet_interior", "case", "front", "side", "toe"
]);
const WOOD_FRAME_BY_ROLE = Object.freeze({
  back_panel: "FRONT_Z",
  backing_panel: "FRONT_Z",
  base: "FRONT_X",
  bottom_panel: "HORIZONTAL_X",
  crown: "FRONT_X",
  divider: "SIDE_Z",
  filler: "FRONT_Z",
  fixed_shelf: "HORIZONTAL_X",
  front_field: "FRONT_Z",
  front_rail: "FRONT_X",
  front_stile: "FRONT_Z",
  shelf: "HORIZONTAL_X",
  side_panel: "SIDE_Z",
  top_panel: "HORIZONTAL_X"
});
const SEMANTIC_FRAMES = Object.freeze({
  HORIZONTAL_X: Object.freeze({
    grainAxis: Object.freeze([1, 0, 0]),
    crossGrainAxis: Object.freeze([0, 1, 0]),
    normalAxis: Object.freeze([0, 0, 1])
  }),
  FRONT_X: Object.freeze({
    grainAxis: Object.freeze([1, 0, 0]),
    crossGrainAxis: Object.freeze([0, 0, 1]),
    normalAxis: Object.freeze([0, -1, 0])
  }),
  FRONT_Z: Object.freeze({
    grainAxis: Object.freeze([0, 0, 1]),
    crossGrainAxis: Object.freeze([1, 0, 0]),
    normalAxis: Object.freeze([0, 1, 0])
  }),
  SIDE_Z: Object.freeze({
    grainAxis: Object.freeze([0, 0, 1]),
    crossGrainAxis: Object.freeze([0, 1, 0]),
    normalAxis: Object.freeze([-1, 0, 0])
  })
});

const TOP_LEVEL_KEYS = new Set([
  "kind", "schema", "schemaVersion", "authority", "versions", "baseGeometry",
  "materialLibrary", "materialFrames", "bindings", "translatorPolicy",
  "materialPackageKey", "capture"
]);
const AUTHORITY_KEYS = new Set([
  "classification", "visualizationProfileId", "materialColorReferenceStatus",
  "customerMaterialApproved", "customerBeautyRenderApproved", "sourceRuleIds", "limitations"
]);
const VERSION_KEYS = new Set([
  "descriptorSchemaVersion", "materialLibraryVersion", "proceduralOakAlgorithmVersion",
  "materialFrameVersion", "seedRuleVersion", "shaderTopologyVersion",
  "blenderMaterialTranslatorVersion", "blenderTranslationPolicyVersion",
  "materialPipelineVersion"
]);
const BASE_GEOMETRY_KEYS = new Set([
  "geometryFingerprint", "primaryPackageKey", "primaryPackageSha256",
  "packageSchemaVersion", "primitiveContractVersion", "componentCount", "submeshObjectCount",
  "constraintCount", "objectManifestSha256", "cameraFingerprint"
]);
const MATERIAL_KEYS = new Set([
  "materialId", "recipeVersion", "family", "declaredColorSpace", "supportedBlenderVersion",
  "shaderTopologyId", "coordinatePolicy", "externalResources", "trueDisplacement",
  "parameters"
]);
const PRINCIPLED_KEYS = new Set([
  "baseColor", "baseColorRamp", "metallic", "roughness", "ior", "alpha",
  "diffuseRoughness", "specularIorLevel", "anisotropic", "anisotropicRotation",
  "coatWeight", "coatRoughness", "coatIor", "transmissionWeight", "thinWall",
  "emissionColor", "emissionStrength", "colorTemperatureK", "bump", "procedural"
]);
const BUMP_KEYS = new Set(["enabled", "strength", "distanceM", "invert", "source"]);
const RAMP_KEYS = new Set(["interpolation", "colorMode", "hueInterpolation", "clamp", "stops"]);
const RAMP_STOP_KEYS = new Set(["position", "color"]);
const PROCEDURAL_KEYS = new Set([
  "algorithmVersion", "coordinateSpace", "basisOrder", "physicalTextureScaleM",
  "coarseNoise", "grainBands", "fiberNoise", "mix", "toneMap", "clampFactors", "clampColors"
]);
const TEXTURE_SCALE_KEYS = new Set(["crossGrain", "grain", "normal"]);
const NOISE_KEYS = new Set([
  "dimensions", "normalize", "scale", "detail", "roughness", "lacunarity", "distortion"
]);
const WAVE_KEYS = new Set([
  "waveType", "bandsDirection", "profile", "scale", "distortion", "detail",
  "detailScale", "detailRoughness"
]);
const MIX_KEYS = new Set(["blendType", "factor", "useClamp"]);
const TONE_MAP_KEYS = new Set([
  "interpolationType", "clamp", "fromMin", "fromMax", "toMin", "toMax", "steps"
]);
const FRAME_KEYS = new Set([
  "frameId", "mappingId", "componentId", "primitiveId", "submeshId", "surfaceGroupId",
  "coordinateSpace", "origin", "grainAxis", "crossGrainAxis", "normalAxis",
  "physicalTextureScaleM", "seedRuleVersion", "seedHex", "seedUint32",
  "phaseOffset", "colorVariation", "mappingDigest"
]);
const BINDING_KEYS = new Set([
  "bindingId", "targetKind", "componentId", "primitiveId", "submeshId", "surfaceGroupId",
  "objectId", "materialSlotIndex", "sourceMaterialSlot", "sourceMaterialId",
  "materialId", "materialFrameId"
]);
const CAPTURE_KEYS = new Set([
  "captureId", "captureKey", "materialMode", "camera", "sceneIdentity", "inheritedRender",
  "renderPolicy", "blenderRuntime", "output"
]);
const SCENE_IDENTITY_KEYS = new Set([
  "sceneVersion", "environment", "shell", "room", "lightManifest", "worldIdentitySha256",
  "lightManifestSha256"
]);
const RENDER_POLICY_KEYS = new Set([
  "engine", "blenderEngine", "renderDevice", "samples", "samplingSeed",
  "animatedSeed", "adaptiveSampling", "denoiser", "materialPipelineVersion"
]);
const POLICY_VALUE_KEYS = new Set(["value", "policy"]);
const BLENDER_RUNTIME_KEYS = new Set([
  "version", "buildHash", "backend", "vendor", "renderer", "deviceVersion"
]);
const OUTPUT_KEYS = new Set([
  "pass", "filename", "mimeType", "width", "height", "maxBytes", "webpColorMode",
  "webpColorDepth", "webpQuality", "colorManagement"
]);
const RESULT_KEYS = new Set([
  "kind", "schemaVersion", "materialPackageKey", "captureKey", "materialPipelineVersion",
  "status", "outputs", "resultKey"
]);
const RESULT_OUTPUT_KEYS = new Set([
  "pass", "objectKey", "mimeType", "width", "height", "bytes", "sha256"
]);
const TRANSLATOR_POLICY_KEYS = new Set([
  "policyId", "materialDatablock", "principled", "textureCoordinates",
  "vectorMath", "noise", "mix", "mapRange", "bump", "output"
]);
const TRANSLATOR_MATERIAL_DATABLOCK_KEYS = new Set([
  "useNodes", "surfaceRenderMethod", "useTransparencyOverlap"
]);
const TRANSLATOR_PRINCIPLED_KEYS = new Set([
  "distribution", "weight", "normalInput", "subsurfaceWeight", "subsurfaceRadius",
  "subsurfaceScale", "subsurfaceIor", "anisotropy", "specularTint", "tangentInput",
  "coatTint", "coatNormalInput", "sheenWeight", "sheenRoughness", "sheenTint",
  "thinFilmThickness", "thinFilmIor"
]);
const TRANSLATOR_TEXTURE_COORDINATE_KEYS = new Set(["output", "object", "fromInstancer"]);
const TRANSLATOR_VECTOR_MATH_KEYS = new Set([
  "subtractOriginOperation", "axisProjectionOperation", "physicalScaleOperation",
  "phaseOperation"
]);
const TRANSLATOR_NOISE_KEYS = new Set(["offset", "gain"]);
const TRANSLATOR_MIX_KEYS = new Set(["useAlpha"]);
const TRANSLATOR_MAP_RANGE_KEYS = new Set(["dataType"]);
const TRANSLATOR_BUMP_KEYS = new Set(["filterWidth", "normalInput"]);
const TRANSLATOR_OUTPUT_KEYS = new Set(["surfaceOnly"]);

export class MaterialsPreviewContractError extends Error {
  constructor(code, message, details = []) {
    super(message);
    this.name = "MaterialsPreviewContractError";
    this.code = code;
    this.details = details;
  }
}

export function createGuidedBlenderMaterialPackage(renderPackage, options = {}) {
  assertBaseRenderPackage(renderPackage);
  const blenderRuntime = normalizeBlenderRuntime(options.blenderRuntime);
  assertPrimaryPackageJsonMatches(renderPackage, options.primaryPackageJson);
  const primaryPackageSha256 = hashCanonical(renderPackage);
  const objectManifest = createObjectManifest(renderPackage);
  const materialFrames = [];
  const bindings = [];

  for (const entry of objectManifest) {
    const binding = createProductBinding(entry, materialFrames);
    bindings.push(binding);
  }
  bindings.push(...createRoomBindings(renderPackage));
  materialFrames.sort(compareBy("frameId"));
  bindings.sort(compareBy("bindingId"));

  const materialLibrary = createMaterialLibrary(renderPackage).sort(compareBy("materialId"));
  const versions = {
    descriptorSchemaVersion: MATERIAL_DESCRIPTOR_SCHEMA_VERSION,
    materialLibraryVersion: PBR_MATERIAL_LIBRARY_VERSION,
    proceduralOakAlgorithmVersion: PROCEDURAL_OAK_ALGORITHM_VERSION,
    materialFrameVersion: MATERIAL_FRAME_VERSION,
    seedRuleVersion: MATERIAL_SEED_RULE_VERSION,
    shaderTopologyVersion: SHADER_TOPOLOGY_VERSION,
    blenderMaterialTranslatorVersion: BLENDER_MATERIAL_TRANSLATOR_VERSION,
    blenderTranslationPolicyVersion: BLENDER_MATERIAL_TRANSLATION_POLICY_VERSION,
    materialPipelineVersion: MATERIAL_PIPELINE_VERSION
  };
  const baseGeometry = {
    geometryFingerprint: renderPackage.identity.geometryFingerprint,
    primaryPackageKey: renderPackage.renderKey,
    primaryPackageSha256,
    packageSchemaVersion: renderPackage.schemaVersion,
    primitiveContractVersion: renderPackage.primitiveContractVersion,
    componentCount: renderPackage.components.length,
    submeshObjectCount: objectManifest.length,
    constraintCount: renderPackage.constraints.length,
    objectManifestSha256: hashCanonical(objectManifest),
    cameraFingerprint: renderPackage.identity.cameraFingerprint
  };
  const translatorPolicy = createTranslatorPolicy();
  const materialPackageKey = createMaterialPackageKey({
    versions,
    baseGeometry,
    materialLibrary,
    materialFrames,
    bindings,
    translatorPolicy
  });
  const captureWithoutKey = createCapture(
    renderPackage,
    materialPackageKey,
    blenderRuntime
  );
  const capture = {
    ...captureWithoutKey,
    captureKey: createMaterialsPreviewCaptureKey(materialPackageKey, captureWithoutKey)
  };
  const materialPackage = {
    kind: MATERIAL_PACKAGE_KIND,
    schema: MATERIAL_PACKAGE_SCHEMA,
    schemaVersion: MATERIAL_PACKAGE_SCHEMA_VERSION,
    authority: {
      classification: "PREVIEW_ONLY_AUTHORIZED",
      visualizationProfileId: MATERIAL_IDS.oak,
      materialColorReferenceStatus: "UNVERIFIED",
      customerMaterialApproved: false,
      customerBeautyRenderApproved: false,
      sourceRuleIds: [
        "config/provisional-decisions.json#FINISH-AVAIL-001",
        "config/materials.json#natural-oak",
        "guided-materials.js#GUIDED_MATERIAL_MANIFEST.woods.natural-oak",
        WARM_LED_SOURCE_RULE_ID,
        "tests/fixtures/blender-prototype/TV01-clear-wall-foundation.json#project.finish"
      ],
      limitations: [
        "Natural Oak is a deterministic visualization profile, not a manufacturer color match.",
        "Physical sample calibration and Clear UV Maple surface separation remain unresolved."
      ]
    },
    versions,
    baseGeometry,
    materialLibrary,
    materialFrames,
    bindings,
    translatorPolicy,
    materialPackageKey,
    capture
  };
  const validation = validateGuidedBlenderMaterialPackage(renderPackage, materialPackage, {
    primaryPackageJson: options.primaryPackageJson
  });
  assert(validation.valid, "MATERIAL_PACKAGE_GENERATION_FAILED", validation.errors[0]?.message || "Generated material package is invalid.", validation.errors);
  return deepFreeze(materialPackage);
}

export function validateGuidedBlenderMaterialPackage(renderPackage, materialPackage, options = {}) {
  try {
    validateMaterialPackageOrThrow(renderPackage, materialPackage, options);
    return Object.freeze({
      valid: true,
      schemaVersion: MATERIAL_PACKAGE_SCHEMA_VERSION,
      materialPackageKey: materialPackage.materialPackageKey,
      captureKey: materialPackage.capture.captureKey,
      errors: Object.freeze([])
    });
  } catch (error) {
    const normalized = normalizeContractError(error);
    return Object.freeze({
      valid: false,
      schemaVersion: MATERIAL_PACKAGE_SCHEMA_VERSION,
      materialPackageKey: materialPackage?.materialPackageKey || null,
      captureKey: materialPackage?.capture?.captureKey || null,
      errors: Object.freeze([normalized])
    });
  }
}

export function createMaterialsPreviewResult(materialPackage, output) {
  validateOutputRecord(output);
  const resultWithoutKey = {
    kind: MATERIAL_PREVIEW_RESULT_KIND,
    schemaVersion: MATERIAL_PREVIEW_RESULT_SCHEMA_VERSION,
    materialPackageKey: materialPackage.materialPackageKey,
    captureKey: materialPackage.capture.captureKey,
    materialPipelineVersion: MATERIAL_PIPELINE_VERSION,
    status: "succeeded",
    outputs: [{ ...output }]
  };
  return deepFreeze({
    ...resultWithoutKey,
    resultKey: `jq-materials-preview-result-v1-${hashCanonical(resultWithoutKey)}`
  });
}

export function validateGuidedBlenderMaterialsPreviewResult(materialPackage, result) {
  try {
    exactKeys(result, RESULT_KEYS, "result");
    assert(result.kind === MATERIAL_PREVIEW_RESULT_KIND, "INVALID_RESULT_KIND", "Material preview result kind is unsupported.");
    assert(result.schemaVersion === MATERIAL_PREVIEW_RESULT_SCHEMA_VERSION, "INVALID_RESULT_SCHEMA", "Material preview result schema is unsupported.");
    assert(result.materialPackageKey === materialPackage?.materialPackageKey, "RESULT_PACKAGE_KEY_MISMATCH", "Result material-package key does not match.");
    assert(result.captureKey === materialPackage?.capture?.captureKey, "RESULT_CAPTURE_KEY_MISMATCH", "Result capture key does not match.");
    assert(result.materialPipelineVersion === MATERIAL_PIPELINE_VERSION, "RESULT_PIPELINE_MISMATCH", "Result pipeline version drifted.");
    assert(result.status === "succeeded", "RESULT_STATUS_INVALID", "Material preview result did not succeed.");
    assert(Array.isArray(result.outputs) && result.outputs.length === 1, "RESULT_OUTPUT_CARDINALITY", "Material preview result requires exactly one output.");
    validateOutputRecord(result.outputs[0]);
    const output = result.outputs[0];
    const captureOutput = materialPackage.capture.output;
    assert(output.pass === captureOutput.pass, "RESULT_PASS_MISMATCH", "Result pass does not match the capture.");
    assert(output.objectKey === `${materialPackage.capture.captureKey}/${captureOutput.filename}`, "RESULT_OBJECT_KEY_MISMATCH", "Result object key is invalid.");
    assert(output.mimeType === captureOutput.mimeType, "RESULT_MIME_MISMATCH", "Result MIME type is invalid.");
    assert(output.width === captureOutput.width && output.height === captureOutput.height, "RESULT_DIMENSIONS_MISMATCH", "Result dimensions do not match the capture.");
    assert(output.bytes <= captureOutput.maxBytes, "RESULT_SIZE_LIMIT_EXCEEDED", "Result exceeds the capture byte limit.");
    const expectedKey = `jq-materials-preview-result-v1-${hashCanonical({
      kind: result.kind,
      schemaVersion: result.schemaVersion,
      materialPackageKey: result.materialPackageKey,
      captureKey: result.captureKey,
      materialPipelineVersion: result.materialPipelineVersion,
      status: result.status,
      outputs: result.outputs
    })}`;
    assert(RESULT_KEY_RE.test(result.resultKey) && result.resultKey === expectedKey, "RESULT_KEY_MISMATCH", "Material preview result key is stale or malformed.");
    return Object.freeze({ valid: true, schemaVersion: MATERIAL_PREVIEW_RESULT_SCHEMA_VERSION, errors: Object.freeze([]) });
  } catch (error) {
    return Object.freeze({
      valid: false,
      schemaVersion: MATERIAL_PREVIEW_RESULT_SCHEMA_VERSION,
      errors: Object.freeze([normalizeContractError(error)])
    });
  }
}

export function createMaterialPackageKey(value) {
  const payload = {
    keyVersion: MATERIAL_PACKAGE_SCHEMA,
    versions: value.versions,
    baseGeometry: value.baseGeometry,
    materialLibrary: [...value.materialLibrary].sort(compareBy("materialId")),
    materialFrames: [...value.materialFrames].sort(compareBy("frameId")),
    bindings: [...value.bindings].sort(compareBy("bindingId")),
    translatorPolicy: value.translatorPolicy
  };
  return `jq-render-material-package-v1-${hashCanonical(payload)}`;
}

export function createMaterialsPreviewCaptureKey(materialPackageKey, captureWithoutKey) {
  const payload = {
    keyVersion: MATERIAL_PREVIEW_CAPTURE_ID,
    materialPackageKey,
    capture: canonicalize(captureWithoutKey)
  };
  return `jq-materials-preview-v1-${hashCanonical(payload)}`;
}

export function deterministicJson(value) {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

export function canonicalize(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    assert(Number.isFinite(value), "NON_FINITE_JSON_NUMBER", "Canonical JSON cannot contain NaN or infinity.");
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  assert(value && typeof value === "object", "UNSUPPORTED_JSON_VALUE", "Canonical JSON contains an unsupported value.");
  return Object.fromEntries(Object.keys(value).sort(compareCodePoints).map((key) => {
    assert(value[key] !== undefined, "UNDEFINED_JSON_VALUE", `Canonical JSON cannot contain undefined at ${key}.`);
    return [key, canonicalize(value[key])];
  }));
}

export function hashCanonical(value) {
  return sha256Text(JSON.stringify(canonicalize(value)));
}

function createObjectManifest(renderPackage) {
  const entries = renderPackage.components.flatMap((component) => component.submeshes.map((submesh) => ({
    componentId: component.componentId,
    componentRole: component.role,
    primitiveId: `${component.componentId}/primitive/${submesh.submeshId}`,
    submeshId: submesh.submeshId,
    surfaceGroupId: `${component.componentId}::${submesh.submeshId}`,
    objectId: `${component.componentId}::${submesh.submeshId}`,
    geometry: submesh.geometry,
    grainRole: submesh.grainRole,
    sourceMaterialSlot: submesh.sourceMaterialSlot,
    sourceMaterialId: submesh.materialId,
    blenderWorldBounds: clone(submesh.blenderWorldBounds),
    primitiveGeometry: clone(submesh.primitiveGeometry)
  })));
  entries.sort(compareBy("objectId"));
  assert(entries.length === EXPECTED_SUBMESH_COUNT, "SUBMESH_COUNT_MISMATCH", "The accepted Drawing 4 package must contain 78 submeshes.");
  const ids = new Set();
  for (const entry of entries) {
    safeId(entry.objectId, "objectId");
    assert(!ids.has(entry.objectId), "DUPLICATE_OBJECT_ID", `Duplicate object identity ${entry.objectId}.`);
    ids.add(entry.objectId);
    finiteBounds(entry.blenderWorldBounds, entry.objectId);
  }
  return entries;
}

function createProductBinding(entry, frames) {
  let materialId;
  let materialFrameId = null;
  if (WOOD_SOURCE_SLOTS.has(entry.sourceMaterialSlot) && entry.sourceMaterialId === "natural-oak") {
    materialId = entry.componentId === COUNTERTOP_COMPONENT_ID
      ? MATERIAL_IDS.countertop
      : MATERIAL_IDS.oak;
    const frame = createMaterialFrame(entry);
    frames.push(frame);
    materialFrameId = frame.frameId;
  } else if (
    entry.sourceMaterialSlot === "hardware"
    && entry.sourceMaterialId === "black-pull"
    && (
      entry.componentRole === "handle"
      || entry.componentRole === "light" && entry.primitiveGeometry?.surfaceRole === "housing"
    )
  ) {
    materialId = MATERIAL_IDS.hardware;
  } else if (
    entry.sourceMaterialSlot === "led"
    && entry.sourceMaterialId === "warm-led"
    && entry.componentRole === "light"
    && entry.primitiveGeometry?.surfaceRole === "emissive_lens"
  ) {
    materialId = MATERIAL_IDS.lens;
  } else if (
    entry.componentId === TV_COMPONENT_ID
    && entry.componentRole === "screen"
    && entry.sourceMaterialSlot === "screen"
    && entry.sourceMaterialId === "tv-screen-neutral"
  ) {
    materialId = MATERIAL_IDS.screen;
  } else {
    throw new MaterialsPreviewContractError(
      "UNRESOLVED_PRODUCT_SURFACE",
      `${entry.objectId} does not resolve to one authorized Phase 6 material.`
    );
  }
  return {
    bindingId: `product/${entry.objectId}`,
    targetKind: "PRODUCT_SUBMESH",
    componentId: entry.componentId,
    primitiveId: entry.primitiveId,
    submeshId: entry.submeshId,
    surfaceGroupId: entry.surfaceGroupId,
    objectId: entry.objectId,
    materialSlotIndex: 0,
    sourceMaterialSlot: entry.sourceMaterialSlot,
    sourceMaterialId: entry.sourceMaterialId,
    materialId,
    materialFrameId
  };
}

function createRoomBindings(renderPackage) {
  const wall = renderPackage.scene?.shell?.wallSurface;
  const floor = renderPackage.scene?.shell?.floorSurface;
  assert(wall && floor, "ROOM_MATERIAL_MISSING", "The accepted package is missing explicit room surfaces.");
  return [
    {
      bindingId: "room/room-floor",
      targetKind: "ROOM_SURFACE",
      componentId: "JQ_ROOM",
      primitiveId: "room-floor-plane",
      submeshId: "surface",
      surfaceGroupId: "room-floor",
      objectId: "room-floor",
      materialSlotIndex: 0,
      sourceMaterialSlot: "room-floor",
      sourceMaterialId: "room-floor-clay",
      materialId: MATERIAL_IDS.roomFloor,
      materialFrameId: null
    },
    {
      bindingId: "room/room-rear-wall",
      targetKind: "ROOM_SURFACE",
      componentId: "JQ_ROOM",
      primitiveId: "room-rear-wall-plane",
      submeshId: "surface",
      surfaceGroupId: "room-rear-wall",
      objectId: "room-rear-wall",
      materialSlotIndex: 0,
      sourceMaterialSlot: "room-wall",
      sourceMaterialId: "room-wall-clay",
      materialId: MATERIAL_IDS.roomWall,
      materialFrameId: null
    }
  ];
}

function createMaterialFrame(entry) {
  const frameKind = WOOD_FRAME_BY_ROLE[entry.grainRole];
  assert(frameKind, "UNSUPPORTED_GRAIN_ROLE", `${entry.objectId} uses unsupported grain role ${entry.grainRole}.`);
  const axes = SEMANTIC_FRAMES[frameKind];
  const seedSource = [
    PBR_MATERIAL_LIBRARY_VERSION,
    entry.componentId,
    entry.primitiveId,
    entry.submeshId,
    entry.surfaceGroupId
  ].join("\u0000");
  const seedHex = sha256Text(seedSource);
  const seedUint32 = Number.parseInt(seedHex.slice(0, 8), 16);
  const phaseOffset = [
    unitFromHex(seedHex.slice(8, 16)),
    unitFromHex(seedHex.slice(16, 24)),
    unitFromHex(seedHex.slice(24, 32))
  ];
  const frameCore = {
    frameId: `${MATERIAL_FRAME_VERSION}/${entry.objectId}`,
    mappingId: `jq-material-mapping-v1-${seedHex}`,
    componentId: entry.componentId,
    primitiveId: entry.primitiveId,
    submeshId: entry.submeshId,
    surfaceGroupId: entry.surfaceGroupId,
    coordinateSpace: "PACKAGE_WORLD_METERS",
    origin: clone(entry.blenderWorldBounds.min),
    grainAxis: [...axes.grainAxis],
    crossGrainAxis: [...axes.crossGrainAxis],
    normalAxis: [...axes.normalAxis],
    physicalTextureScaleM: { crossGrain: 0.6096, grain: 1.2192, normal: 0.0254 },
    seedRuleVersion: MATERIAL_SEED_RULE_VERSION,
    seedHex,
    seedUint32,
    phaseOffset,
    colorVariation: roundColorVariation((unitFromHex(seedHex.slice(32, 40)) - 0.5) * 0.024)
  };
  return { ...frameCore, mappingDigest: hashCanonical(frameCore) };
}

function createMaterialLibrary(renderPackage) {
  const wall = renderPackage.scene.shell.wallSurface;
  const floor = renderPackage.scene.shell.floorSurface;
  const warmLed = resolveAuthoritativeWarmLed(renderPackage);
  return [
    createOakMaterial(MATERIAL_IDS.oak, "natural-oak-visualization-v1", {
      roughness: 0.58,
      coatWeight: 0.08,
      coatRoughness: 0.34,
      grainScale: 10,
      grainMix: 0.666666666667,
      toneMin: 0.49,
      toneMax: 0.65,
      bumpStrength: 0.12,
      bumpDistanceM: 0.00018
    }),
    createOakMaterial(MATERIAL_IDS.countertop, "natural-oak-countertop-visualization-v1", {
      roughness: 0.54,
      coatWeight: 0.12,
      coatRoughness: 0.3,
      grainScale: 9,
      grainMix: 0.65,
      toneMin: 0.51,
      toneMax: 0.65,
      bumpStrength: 0.1,
      bumpDistanceM: 0.00016
    }),
    createFlatMaterial(MATERIAL_IDS.hardware, "matte-black-coated-dielectric-v1", "coated-hardware", {
      baseColor: [0.014, 0.016, 0.018, 1], metallic: 0, roughness: 0.47,
      ior: 1.5, coatWeight: 0.16, coatRoughness: 0.4, coatIor: 1.5,
      transmissionWeight: 0, alpha: 1, thinWall: false,
      emissionColor: [0, 0, 0, 1], emissionStrength: 0
    }),
    createFlatMaterial(MATERIAL_IDS.screen, "tv-black-glass-v1", "dark-glass", {
      baseColor: [0.0035, 0.0045, 0.006, 1], metallic: 0, roughness: 0.16,
      ior: 1.52, coatWeight: 0.34, coatRoughness: 0.12, coatIor: 1.52,
      transmissionWeight: 0.06, alpha: 1, thinWall: true,
      emissionColor: [0, 0, 0, 1], emissionStrength: 0
    }),
    createFlatMaterial(MATERIAL_IDS.lens, "warm-opal-puck-lens-v1", "opal-emissive", {
      baseColor: [0.78, 0.56, 0.3, 1], metallic: 0, roughness: 0.34,
      ior: 1.46, coatWeight: 0.04, coatRoughness: 0.3, coatIor: 1.46,
      transmissionWeight: 0.22, alpha: 1, thinWall: false,
      emissionColor: warmLed.emissionColor,
      emissionStrength: warmLed.emissionStrength,
      colorTemperatureK: warmLed.colorTemperatureK
    }),
    createFlatMaterial(MATERIAL_IDS.roomWall, "inherited-room-clay-v1", "inherited-room-clay", {
      baseColor: clone(wall.baseColor), metallic: wall.metallic, roughness: wall.roughness,
      ior: 1.5, coatWeight: 0, coatRoughness: 0, coatIor: 1.5,
      transmissionWeight: 0, alpha: 1, thinWall: false,
      emissionColor: [0, 0, 0, 1], emissionStrength: 0
    }),
    createFlatMaterial(MATERIAL_IDS.roomFloor, "inherited-room-clay-v1", "inherited-room-clay", {
      baseColor: clone(floor.baseColor), metallic: floor.metallic, roughness: floor.roughness,
      ior: 1.5, coatWeight: 0, coatRoughness: 0, coatIor: 1.5,
      transmissionWeight: 0, alpha: 1, thinWall: false,
      emissionColor: [0, 0, 0, 1], emissionStrength: 0
    })
  ];
}

function createOakMaterial(materialId, recipeVersion, tuning) {
  return {
    materialId,
    recipeVersion,
    family: "procedural-wood",
    declaredColorSpace: "Linear Rec.709",
    supportedBlenderVersion: "5.2",
    shaderTopologyId: `${SHADER_TOPOLOGY_VERSION}/procedural-oak`,
    coordinatePolicy: "package-world-material-frame-v1",
    externalResources: [],
    trueDisplacement: false,
    parameters: {
      baseColor: null,
      baseColorRamp: {
        interpolation: "LINEAR",
        colorMode: "RGB",
        hueInterpolation: "NEAR",
        clamp: true,
        stops: [
          { position: 0, color: [0.4, 0.29, 0.18, 1] },
          { position: 0.34, color: [0.47, 0.36, 0.235, 1] },
          { position: 0.68, color: [0.55, 0.45, 0.31, 1] },
          { position: 1, color: [0.64, 0.55, 0.41, 1] }
        ]
      },
      metallic: 0,
      roughness: tuning.roughness,
      ior: 1.5,
      alpha: 1,
      diffuseRoughness: 0.2,
      specularIorLevel: 0.5,
      anisotropic: 0.05,
      anisotropicRotation: 0,
      coatWeight: tuning.coatWeight,
      coatRoughness: tuning.coatRoughness,
      coatIor: 1.5,
      transmissionWeight: 0,
      thinWall: false,
      emissionColor: [0, 0, 0, 1],
      emissionStrength: 0,
      colorTemperatureK: null,
      bump: {
        enabled: true,
        strength: tuning.bumpStrength,
        distanceM: tuning.bumpDistanceM,
        invert: false,
        source: "fiber-noise-factor"
      },
      procedural: {
        algorithmVersion: PROCEDURAL_OAK_ALGORITHM_VERSION,
        coordinateSpace: "PACKAGE_WORLD_METERS",
        basisOrder: "CROSS_GRAIN_NORMAL",
        physicalTextureScaleM: { crossGrain: 0.6096, grain: 1.2192, normal: 0.0254 },
        coarseNoise: {
          dimensions: "4D", normalize: false, scale: 2.2, detail: 2,
          roughness: 0.42, lacunarity: 2, distortion: 0.05
        },
        grainBands: {
          waveType: "BANDS", bandsDirection: "X", profile: "SIN",
          scale: tuning.grainScale, distortion: 2.2, detail: 3,
          detailScale: 1.5, detailRoughness: 0.42
        },
        fiberNoise: {
          dimensions: "4D", normalize: false, scale: 72, detail: 2,
          roughness: 0.48, lacunarity: 2, distortion: 0
        },
        mix: { blendType: "MIX", factor: tuning.grainMix, useClamp: true },
        toneMap: {
          interpolationType: "LINEAR", clamp: true,
          fromMin: 0, fromMax: 1,
          toMin: tuning.toneMin, toMax: tuning.toneMax,
          steps: 4
        },
        clampFactors: true,
        clampColors: true
      }
    }
  };
}

function createFlatMaterial(materialId, recipeVersion, family, values) {
  return {
    materialId,
    recipeVersion,
    family,
    declaredColorSpace: "Linear Rec.709",
    supportedBlenderVersion: "5.2",
    shaderTopologyId: `${SHADER_TOPOLOGY_VERSION}/principled-flat`,
    coordinatePolicy: "none",
    externalResources: [],
    trueDisplacement: false,
    parameters: {
      baseColor: values.baseColor,
      baseColorRamp: null,
      metallic: values.metallic,
      roughness: values.roughness,
      ior: values.ior,
      alpha: values.alpha,
      diffuseRoughness: 0,
      specularIorLevel: 0.5,
      anisotropic: 0,
      anisotropicRotation: 0,
      coatWeight: values.coatWeight,
      coatRoughness: values.coatRoughness,
      coatIor: values.coatIor,
      transmissionWeight: values.transmissionWeight,
      thinWall: values.thinWall,
      emissionColor: values.emissionColor,
      emissionStrength: values.emissionStrength,
      colorTemperatureK: values.colorTemperatureK ?? null,
      bump: { enabled: false, strength: 0, distanceM: 0, invert: false, source: "none" },
      procedural: null
    }
  };
}

function resolveAuthoritativeWarmLed(renderPackage) {
  assert(Array.isArray(renderPackage.materials), "WARM_LED_MATERIAL_MISSING", "The verified geometry package must contain its portable warm-led definition.");
  const warmLedMaterials = renderPackage.materials.filter((material) => material?.materialId === "warm-led");
  assert(warmLedMaterials.length === 1, "WARM_LED_MATERIAL_CARDINALITY", "The verified geometry package must contain exactly one warm-led material definition.");
  const warmLed = warmLedMaterials[0];
  assert(warmLed.sourceMaterialSlot === "led", "WARM_LED_SOURCE_SLOT_INVALID", "The warm-led definition must resolve the led source slot.");
  exactKeys(warmLed.definition, new Set(Object.keys(WARM_LED_DEFINITION)), "warm-led.definition");
  assert(
    deepEqual(warmLed.definition, WARM_LED_DEFINITION),
    "WARM_LED_DEFINITION_MISMATCH",
    "The warm-led portable recipe differs from guided-blender-render-contract.js#warm-led."
  );

  const puckComponents = renderPackage.components.filter((component) => (
    component?.role === "light"
    && component.submeshes?.some((submesh) => (
      submesh.sourceMaterialSlot === "led"
      && submesh.materialId === "warm-led"
      && submesh.primitiveGeometry?.surfaceRole === "emissive_lens"
    ))
  ));
  assert(puckComponents.length === 2, "WARM_LED_COMPONENT_CARDINALITY", "The accepted Drawing 4 package must contain exactly two warm-led puck components.");
  for (const component of puckComponents) {
    assert(
      component.metadata?.warmth === 2700,
      "WARM_LED_COLOR_TEMPERATURE_MISMATCH",
      `${component.componentId} must author component.metadata.warmth as exactly 2700K.`
    );
  }

  return {
    emissionColor: srgbHexToLinearRec709(warmLed.definition.baseColor),
    emissionStrength: warmLed.definition.strength,
    colorTemperatureK: puckComponents[0].metadata.warmth
  };
}

function srgbHexToLinearRec709(value) {
  assert(/^#[a-fA-F0-9]{6}$/.test(value), "WARM_LED_BASE_COLOR_INVALID", "The warm-led base color must be a six-digit sRGB hex value.");
  const linearChannels = [1, 3, 5].map((offset) => {
    const srgb = Number.parseInt(value.slice(offset, offset + 2), 16) / 255;
    const linear = srgb <= 0.04045
      ? srgb / 12.92
      : ((srgb + 0.055) / 1.055) ** 2.4;
    return roundMetric(linear);
  });
  return [...linearChannels, 1];
}

function createTranslatorPolicy() {
  return {
    policyId: BLENDER_MATERIAL_TRANSLATION_POLICY_VERSION,
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
    textureCoordinates: {
      output: "Object",
      object: null,
      fromInstancer: false
    },
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
  };
}

function createCapture(renderPackage, materialPackageKey, blenderRuntime) {
  const sceneIdentity = {
    sceneVersion: renderPackage.scene.sceneVersion,
    environment: clone(renderPackage.scene.environment),
    shell: clone(renderPackage.scene.shell),
    room: clone(renderPackage.room),
    lightManifest: [],
    worldIdentitySha256: hashCanonical(renderPackage.scene.environment),
    lightManifestSha256: hashCanonical([])
  };
  const capture = {
    captureId: MATERIAL_PREVIEW_CAPTURE_ID,
    materialMode: MATERIAL_PIPELINE_VERSION,
    camera: clone(renderPackage.camera),
    sceneIdentity,
    inheritedRender: clone(renderPackage.render),
    renderPolicy: {
      engine: "BLENDER_EEVEE_NEXT",
      blenderEngine: "BLENDER_EEVEE",
      renderDevice: "BLENDER_EEVEE_INTERNAL",
      samples: 128,
      samplingSeed: { value: null, policy: "not-applicable-eevee-5.2" },
      animatedSeed: { value: null, policy: "not-applicable-eevee-5.2" },
      adaptiveSampling: { value: null, policy: "not-applicable-eevee-5.2" },
      denoiser: { value: false, policy: "not-applicable-eevee-5.2-compositor-disabled" },
      materialPipelineVersion: MATERIAL_PIPELINE_VERSION
    },
    blenderRuntime,
    output: {
      pass: "materials-preview",
      filename: "materials-preview.webp",
      mimeType: "image/webp",
      width: renderPackage.render.width,
      height: renderPackage.render.height,
      maxBytes: 32 * 1024 * 1024,
      webpColorMode: renderPackage.render.imageSettings.colorMode,
      webpColorDepth: renderPackage.render.imageSettings.colorDepth,
      webpQuality: renderPackage.render.imageSettings.quality,
      colorManagement: renderPackage.render.imageSettings.colorManagement
    }
  };
  assert(materialPackageKey, "MISSING_MATERIAL_PACKAGE_KEY", "Capture requires its material package key.");
  return capture;
}

function validateMaterialPackageOrThrow(renderPackage, materialPackage, options) {
  assertBaseRenderPackage(renderPackage);
  exactKeys(materialPackage, TOP_LEVEL_KEYS, "materialPackage");
  assert(materialPackage.kind === MATERIAL_PACKAGE_KIND, "INVALID_MATERIAL_PACKAGE_KIND", "Material package kind is unsupported.");
  assert(materialPackage.schema === MATERIAL_PACKAGE_SCHEMA, "INVALID_MATERIAL_PACKAGE_SCHEMA", "Material package schema is unsupported.");
  assert(materialPackage.schemaVersion === MATERIAL_PACKAGE_SCHEMA_VERSION, "INVALID_MATERIAL_PACKAGE_SCHEMA", "Material package schema version is unsupported.");
  rejectNonFinite(materialPackage, "materialPackage");
  validateAuthority(materialPackage.authority);
  validateVersions(materialPackage.versions);
  validateBaseGeometry(renderPackage, materialPackage.baseGeometry, options);
  const materialIds = validateMaterialLibrary(materialPackage.materialLibrary);
  const frameIds = validateFrames(materialPackage.materialFrames);
  validateBindings(renderPackage, materialPackage.bindings, materialIds, frameIds);
  validateTranslatorPolicy(materialPackage.translatorPolicy);
  const expectedLibrary = createMaterialLibrary(renderPackage).sort(compareBy("materialId"));
  assert(
    deepEqual(materialPackage.materialLibrary, expectedLibrary),
    "MATERIAL_RECIPE_DRIFT",
    "Versioned Phase 6 material recipes differ from their exact authorized definitions."
  );
  const expectedFrames = [];
  const expectedBindings = createObjectManifest(renderPackage)
    .map((entry) => createProductBinding(entry, expectedFrames));
  expectedBindings.push(...createRoomBindings(renderPackage));
  expectedFrames.sort(compareBy("frameId"));
  expectedBindings.sort(compareBy("bindingId"));
  assert(
    deepEqual(materialPackage.materialFrames, expectedFrames),
    "MATERIAL_FRAME_DERIVATION_MISMATCH",
    "Material frames, seeds, phases, or mappings do not match stable semantic identities."
  );
  assert(
    deepEqual(materialPackage.bindings, expectedBindings),
    "SEMANTIC_BINDING_MISMATCH",
    "Material bindings do not exactly match the accepted semantic surfaces."
  );
  const expectedMaterialKey = createMaterialPackageKey(materialPackage);
  assert(MATERIAL_PACKAGE_KEY_RE.test(materialPackage.materialPackageKey), "INVALID_MATERIAL_PACKAGE_KEY", "Material package key is malformed.");
  assert(materialPackage.materialPackageKey === expectedMaterialKey, "STALE_MATERIAL_PACKAGE_KEY", "Material package key does not match canonical content.");
  validateCapture(renderPackage, materialPackage.capture, materialPackage.materialPackageKey);
}

function validateAuthority(value) {
  exactKeys(value, AUTHORITY_KEYS, "authority");
  assert(value.classification === "PREVIEW_ONLY_AUTHORIZED", "INVALID_MATERIAL_AUTHORITY", "Phase 6 must remain preview-only.");
  assert(value.visualizationProfileId === MATERIAL_IDS.oak, "INVALID_VISUALIZATION_PROFILE", "Natural Oak visualization profile drifted.");
  assert(value.materialColorReferenceStatus === "UNVERIFIED", "MATERIAL_COLOR_STATUS_INVALID", "Natural Oak color reference must remain unverified.");
  assert(value.customerMaterialApproved === false, "CUSTOMER_MATERIAL_APPROVAL_FORBIDDEN", "Customer material approval must remain false.");
  assert(value.customerBeautyRenderApproved === false, "CUSTOMER_BEAUTY_APPROVAL_FORBIDDEN", "Customer beauty approval must remain false.");
  assert(Array.isArray(value.sourceRuleIds) && value.sourceRuleIds.length >= 1 && value.sourceRuleIds.every((item) => typeof item === "string" && item.length > 0), "MATERIAL_SOURCE_RULES_MISSING", "Material authority requires named repository rules.");
  assert(value.sourceRuleIds.includes(WARM_LED_SOURCE_RULE_ID), "WARM_LED_SOURCE_RULE_MISSING", "Material authority must cite the canonical warm-led portable recipe.");
  assert(Array.isArray(value.limitations) && value.limitations.every((item) => typeof item === "string"), "INVALID_MATERIAL_LIMITATIONS", "Material limitations must be text records.");
}

function validateVersions(value) {
  exactKeys(value, VERSION_KEYS, "versions");
  const expected = {
    descriptorSchemaVersion: MATERIAL_DESCRIPTOR_SCHEMA_VERSION,
    materialLibraryVersion: PBR_MATERIAL_LIBRARY_VERSION,
    proceduralOakAlgorithmVersion: PROCEDURAL_OAK_ALGORITHM_VERSION,
    materialFrameVersion: MATERIAL_FRAME_VERSION,
    seedRuleVersion: MATERIAL_SEED_RULE_VERSION,
    shaderTopologyVersion: SHADER_TOPOLOGY_VERSION,
    blenderMaterialTranslatorVersion: BLENDER_MATERIAL_TRANSLATOR_VERSION,
    blenderTranslationPolicyVersion: BLENDER_MATERIAL_TRANSLATION_POLICY_VERSION,
    materialPipelineVersion: MATERIAL_PIPELINE_VERSION
  };
  assert(deepEqual(value, expected), "MATERIAL_VERSION_MISMATCH", "Material package versions drifted.");
}

function validateTranslatorPolicy(value) {
  exactKeys(value, TRANSLATOR_POLICY_KEYS, "translatorPolicy");
  assert(value.policyId === BLENDER_MATERIAL_TRANSLATION_POLICY_VERSION, "TRANSLATOR_POLICY_ID_INVALID", "Blender material translation policy ID drifted.");

  exactKeys(value.materialDatablock, TRANSLATOR_MATERIAL_DATABLOCK_KEYS, "translatorPolicy.materialDatablock");
  assert(typeof value.materialDatablock.useNodes === "boolean", "TRANSLATOR_POLICY_TYPE_INVALID", "translatorPolicy.materialDatablock.useNodes must be boolean.");
  assert(typeof value.materialDatablock.useTransparencyOverlap === "boolean", "TRANSLATOR_POLICY_TYPE_INVALID", "translatorPolicy.materialDatablock.useTransparencyOverlap must be boolean.");
  assert(typeof value.materialDatablock.surfaceRenderMethod === "string", "TRANSLATOR_POLICY_TYPE_INVALID", "translatorPolicy.materialDatablock.surfaceRenderMethod must be text.");

  exactKeys(value.principled, TRANSLATOR_PRINCIPLED_KEYS, "translatorPolicy.principled");
  assert(typeof value.principled.distribution === "string", "TRANSLATOR_POLICY_TYPE_INVALID", "translatorPolicy.principled.distribution must be text.");
  for (const key of ["weight", "subsurfaceWeight", "anisotropy", "sheenWeight", "sheenRoughness"]) {
    unitInterval(value.principled[key], `translatorPolicy.principled.${key}`);
  }
  vector3(value.principled.normalInput, "translatorPolicy.principled.normalInput");
  vector3(value.principled.subsurfaceRadius, "translatorPolicy.principled.subsurfaceRadius", positive);
  positive(value.principled.subsurfaceScale, "translatorPolicy.principled.subsurfaceScale");
  positive(value.principled.subsurfaceIor, "translatorPolicy.principled.subsurfaceIor");
  color(value.principled.specularTint, "translatorPolicy.principled.specularTint");
  vector3(value.principled.tangentInput, "translatorPolicy.principled.tangentInput");
  color(value.principled.coatTint, "translatorPolicy.principled.coatTint");
  vector3(value.principled.coatNormalInput, "translatorPolicy.principled.coatNormalInput");
  color(value.principled.sheenTint, "translatorPolicy.principled.sheenTint");
  nonNegative(value.principled.thinFilmThickness, "translatorPolicy.principled.thinFilmThickness");
  positive(value.principled.thinFilmIor, "translatorPolicy.principled.thinFilmIor");

  exactKeys(value.textureCoordinates, TRANSLATOR_TEXTURE_COORDINATE_KEYS, "translatorPolicy.textureCoordinates");
  assert(typeof value.textureCoordinates.output === "string", "TRANSLATOR_POLICY_TYPE_INVALID", "translatorPolicy.textureCoordinates.output must be text.");
  assert(value.textureCoordinates.object === null, "TRANSLATOR_POLICY_TYPE_INVALID", "translatorPolicy.textureCoordinates.object must be explicit null.");
  assert(typeof value.textureCoordinates.fromInstancer === "boolean", "TRANSLATOR_POLICY_TYPE_INVALID", "translatorPolicy.textureCoordinates.fromInstancer must be boolean.");

  exactKeys(value.vectorMath, TRANSLATOR_VECTOR_MATH_KEYS, "translatorPolicy.vectorMath");
  for (const key of TRANSLATOR_VECTOR_MATH_KEYS) {
    assert(typeof value.vectorMath[key] === "string", "TRANSLATOR_POLICY_TYPE_INVALID", `translatorPolicy.vectorMath.${key} must be text.`);
  }

  exactKeys(value.noise, TRANSLATOR_NOISE_KEYS, "translatorPolicy.noise");
  finite(value.noise.offset, "translatorPolicy.noise.offset");
  finite(value.noise.gain, "translatorPolicy.noise.gain");
  exactKeys(value.mix, TRANSLATOR_MIX_KEYS, "translatorPolicy.mix");
  assert(typeof value.mix.useAlpha === "boolean", "TRANSLATOR_POLICY_TYPE_INVALID", "translatorPolicy.mix.useAlpha must be boolean.");
  exactKeys(value.mapRange, TRANSLATOR_MAP_RANGE_KEYS, "translatorPolicy.mapRange");
  assert(typeof value.mapRange.dataType === "string", "TRANSLATOR_POLICY_TYPE_INVALID", "translatorPolicy.mapRange.dataType must be text.");
  exactKeys(value.bump, TRANSLATOR_BUMP_KEYS, "translatorPolicy.bump");
  positive(value.bump.filterWidth, "translatorPolicy.bump.filterWidth");
  vector3(value.bump.normalInput, "translatorPolicy.bump.normalInput");
  exactKeys(value.output, TRANSLATOR_OUTPUT_KEYS, "translatorPolicy.output");
  assert(typeof value.output.surfaceOnly === "boolean", "TRANSLATOR_POLICY_TYPE_INVALID", "translatorPolicy.output.surfaceOnly must be boolean.");

  assert(
    deepEqual(value, createTranslatorPolicy()),
    "TRANSLATOR_POLICY_INVALID",
    "Blender worker-owned pixel-affecting translation constants drifted."
  );
}

function validateBaseGeometry(renderPackage, value, options) {
  exactKeys(value, BASE_GEOMETRY_KEYS, "baseGeometry");
  assertPrimaryPackageJsonMatches(renderPackage, options?.primaryPackageJson);
  const expectedManifest = createObjectManifest(renderPackage);
  const expected = {
    geometryFingerprint: EXPECTED_GEOMETRY_FINGERPRINT,
    primaryPackageKey: EXPECTED_PRIMARY_PACKAGE_KEY,
    primaryPackageSha256: hashCanonical(renderPackage),
    packageSchemaVersion: renderPackage.schemaVersion,
    primitiveContractVersion: renderPackage.primitiveContractVersion,
    componentCount: EXPECTED_COMPONENT_COUNT,
    submeshObjectCount: EXPECTED_SUBMESH_COUNT,
    constraintCount: EXPECTED_CONSTRAINT_COUNT,
    objectManifestSha256: hashCanonical(expectedManifest),
    cameraFingerprint: renderPackage.identity.cameraFingerprint
  };
  assert(deepEqual(value, expected), "BASE_GEOMETRY_IDENTITY_MISMATCH", "Material sidecar does not target the accepted Phase 5 geometry package.");
}

function assertPrimaryPackageJsonMatches(renderPackage, primaryPackageJson) {
  if (primaryPackageJson === undefined) return;
  assert(typeof primaryPackageJson === "string", "PRIMARY_PACKAGE_JSON_INVALID", "Primary package JSON must be text when supplied.");
  let parsed;
  try {
    parsed = JSON.parse(primaryPackageJson);
  } catch (error) {
    throw new MaterialsPreviewContractError(
      "PRIMARY_PACKAGE_JSON_INVALID",
      `Primary package JSON is malformed: ${error.message}`
    );
  }
  assert(
    deepEqual(parsed, renderPackage),
    "PRIMARY_PACKAGE_JSON_MISMATCH",
    "Primary package JSON does not describe the supplied geometry package."
  );
}

function validateMaterialLibrary(value) {
  assert(Array.isArray(value) && value.length === Object.keys(MATERIAL_IDS).length, "MATERIAL_LIBRARY_CARDINALITY", "Material library must contain seven exact definitions.");
  const ids = new Set();
  let previous = "";
  for (const [index, material] of value.entries()) {
    exactKeys(material, MATERIAL_KEYS, `materialLibrary[${index}]`);
    safeId(material.materialId, `materialLibrary[${index}].materialId`);
    assert(!ids.has(material.materialId), "DUPLICATE_MATERIAL_ID", `Duplicate material ${material.materialId}.`);
    assert(compareCodePoints(previous, material.materialId) <= 0, "MATERIAL_ORDER_INVALID", "Material definitions must be sorted by materialId.");
    previous = material.materialId;
    ids.add(material.materialId);
    assert(material.supportedBlenderVersion === "5.2", "UNSUPPORTED_MATERIAL_BLENDER_VERSION", `${material.materialId} has an unsupported Blender version.`);
    assert(material.declaredColorSpace === "Linear Rec.709", "INVALID_MATERIAL_COLOR_SPACE", `${material.materialId} has an unsupported color space.`);
    const procedural = [MATERIAL_IDS.oak, MATERIAL_IDS.countertop].includes(material.materialId);
    assert(
      material.shaderTopologyId === `${SHADER_TOPOLOGY_VERSION}/${procedural ? "procedural-oak" : "principled-flat"}`,
      "UNSUPPORTED_SHADER_TOPOLOGY",
      `${material.materialId} uses an unsupported shader topology.`
    );
    assert(
      material.coordinatePolicy === (procedural ? "package-world-material-frame-v1" : "none"),
      "UNSUPPORTED_COORDINATE_POLICY",
      `${material.materialId} uses an unsupported coordinate policy.`
    );
    assert(Array.isArray(material.externalResources) && material.externalResources.length === 0, "EXTERNAL_MATERIAL_RESOURCE_FORBIDDEN", `${material.materialId} must not use external assets.`);
    assert(material.trueDisplacement === false, "TRUE_DISPLACEMENT_FORBIDDEN", `${material.materialId} cannot use true displacement.`);
    validatePrincipled(material.parameters, material);
  }
  assert(deepEqual([...ids].sort(), Object.values(MATERIAL_IDS).sort()), "MATERIAL_LIBRARY_INCOMPLETE", "Material library IDs drifted.");
  return ids;
}

function validatePrincipled(parameters, material) {
  exactKeys(parameters, PRINCIPLED_KEYS, `${material.materialId}.parameters`);
  const flat = parameters.procedural === null;
  if (flat) {
    color(parameters.baseColor, `${material.materialId}.baseColor`);
    assert(parameters.baseColorRamp === null, "UNEXPECTED_COLOR_RAMP", `${material.materialId} cannot contain a color ramp.`);
  } else {
    assert(parameters.baseColor === null, "PROCEDURAL_BASE_COLOR_INVALID", `${material.materialId} procedural color must come from its ramp.`);
    validateColorRamp(parameters.baseColorRamp, material.materialId);
    validateProcedural(parameters.procedural, material.materialId);
  }
  for (const key of [
    "metallic", "roughness", "alpha", "diffuseRoughness", "specularIorLevel",
    "anisotropic", "anisotropicRotation", "coatWeight", "coatRoughness", "transmissionWeight"
  ]) unitInterval(parameters[key], `${material.materialId}.${key}`);
  positive(parameters.ior, `${material.materialId}.ior`);
  positive(parameters.coatIor, `${material.materialId}.coatIor`);
  assert(typeof parameters.thinWall === "boolean", "INVALID_SHADER_BOOLEAN", `${material.materialId}.thinWall must be boolean.`);
  color(parameters.emissionColor, `${material.materialId}.emissionColor`);
  nonNegative(parameters.emissionStrength, `${material.materialId}.emissionStrength`);
  assert(
    parameters.colorTemperatureK === null
      || typeof parameters.colorTemperatureK === "number"
        && Number.isFinite(parameters.colorTemperatureK)
        && parameters.colorTemperatureK > 0,
    "INVALID_COLOR_TEMPERATURE",
    `${material.materialId}.colorTemperatureK must be null or a positive finite number.`
  );
  assert(
    material.materialId === MATERIAL_IDS.lens
      ? parameters.colorTemperatureK === 2700
      : parameters.colorTemperatureK === null,
    "COLOR_TEMPERATURE_BINDING_INVALID",
    `${material.materialId} has an invalid color-temperature assignment.`
  );
  exactKeys(parameters.bump, BUMP_KEYS, `${material.materialId}.bump`);
  assert(typeof parameters.bump.enabled === "boolean" && typeof parameters.bump.invert === "boolean", "INVALID_BUMP_BOOLEAN", `${material.materialId} bump flags must be boolean.`);
  unitInterval(parameters.bump.strength, `${material.materialId}.bump.strength`);
  nonNegative(parameters.bump.distanceM, `${material.materialId}.bump.distanceM`);
  assert(typeof parameters.bump.source === "string" && ["none", "fiber-noise-factor"].includes(parameters.bump.source), "INVALID_BUMP_SOURCE", `${material.materialId} bump source is unsupported.`);
  if (parameters.bump.enabled) {
    assert(!flat && parameters.bump.distanceM > 0 && parameters.bump.source === "fiber-noise-factor", "INVALID_PROCEDURAL_BUMP", `${material.materialId} has an invalid shader-only bump.`);
  } else {
    assert(parameters.bump.strength === 0 && parameters.bump.distanceM === 0 && parameters.bump.source === "none", "DISABLED_BUMP_NOT_ZERO", `${material.materialId} disabled bump values must be explicit zeroes.`);
  }
  if (material.materialId === MATERIAL_IDS.screen) {
    assert(parameters.emissionStrength === 0 && parameters.alpha === 1 && parameters.transmissionWeight < 1 && parameters.baseColor.slice(0, 3).every((channel) => channel <= 0.02), "TV_SCREEN_RECIPE_INVALID", "TV screen must remain dark, non-emissive, and not fully transparent.");
  }
  if (material.materialId === MATERIAL_IDS.hardware) {
    assert(parameters.metallic === 0, "HARDWARE_COATING_MUST_BE_DIELECTRIC", "Matte-black coated hardware must remain dielectric.");
  }
}

function validateColorRamp(value, label) {
  exactKeys(value, RAMP_KEYS, `${label}.baseColorRamp`);
  assert(value.interpolation === "LINEAR" && value.colorMode === "RGB" && value.hueInterpolation === "NEAR" && value.clamp === true, "INVALID_COLOR_RAMP_POLICY", `${label} color ramp policy drifted.`);
  assert(Array.isArray(value.stops) && value.stops.length >= 2, "MISSING_COLOR_RAMP_STOPS", `${label} requires at least two color stops.`);
  let previous = -1;
  for (const [index, stop] of value.stops.entries()) {
    exactKeys(stop, RAMP_STOP_KEYS, `${label}.baseColorRamp.stops[${index}]`);
    unitInterval(stop.position, `${label}.stop.position`);
    assert(stop.position > previous, "COLOR_RAMP_ORDER_INVALID", `${label} color stops must be strictly ordered.`);
    previous = stop.position;
    color(stop.color, `${label}.stop.color`);
  }
  assert(value.stops[0].position === 0 && value.stops.at(-1).position === 1, "COLOR_RAMP_ENDPOINTS_INVALID", `${label} ramp must pin positions zero and one.`);
}

function validateProcedural(value, label) {
  exactKeys(value, PROCEDURAL_KEYS, `${label}.procedural`);
  assert(value.algorithmVersion === PROCEDURAL_OAK_ALGORITHM_VERSION, "PROCEDURAL_ALGORITHM_MISMATCH", `${label} uses an unsupported oak algorithm.`);
  assert(value.coordinateSpace === "PACKAGE_WORLD_METERS" && value.basisOrder === "CROSS_GRAIN_NORMAL", "UNSUPPORTED_COORDINATE_SPACE", `${label} has an unsupported material coordinate basis.`);
  validateTextureScale(value.physicalTextureScaleM, `${label}.physicalTextureScaleM`);
  validateNoise(value.coarseNoise, `${label}.coarseNoise`);
  validateNoise(value.fiberNoise, `${label}.fiberNoise`);
  exactKeys(value.grainBands, WAVE_KEYS, `${label}.grainBands`);
  assert(value.grainBands.waveType === "BANDS" && value.grainBands.bandsDirection === "X" && value.grainBands.profile === "SIN", "UNSUPPORTED_GRAIN_NODE", `${label} grain wave settings are unsupported.`);
  for (const key of ["scale", "detailScale"]) positive(value.grainBands[key], `${label}.grainBands.${key}`);
  for (const key of ["distortion", "detail"]) nonNegative(value.grainBands[key], `${label}.grainBands.${key}`);
  unitInterval(value.grainBands.detailRoughness, `${label}.grainBands.detailRoughness`);
  exactKeys(value.mix, MIX_KEYS, `${label}.mix`);
  assert(value.mix.blendType === "MIX" && value.mix.useClamp === true, "UNSUPPORTED_MATERIAL_MIX", `${label} mix policy is unsupported.`);
  unitInterval(value.mix.factor, `${label}.mix.factor`);
  exactKeys(value.toneMap, TONE_MAP_KEYS, `${label}.toneMap`);
  assert(value.toneMap.interpolationType === "LINEAR" && value.toneMap.clamp === true, "UNSUPPORTED_TONE_MAP", `${label} tone map policy is unsupported.`);
  assert(value.toneMap.fromMin === 0 && value.toneMap.fromMax === 1 && value.toneMap.steps === 4, "UNSUPPORTED_TONE_MAP", `${label} tone map input range drifted.`);
  unitInterval(value.toneMap.toMin, `${label}.toneMap.toMin`);
  unitInterval(value.toneMap.toMax, `${label}.toneMap.toMax`);
  assert(value.toneMap.toMax > value.toneMap.toMin, "UNSUPPORTED_TONE_MAP", `${label} tone map output range is unordered.`);
  assert(value.clampFactors === true && value.clampColors === true, "MATERIAL_CLAMP_POLICY_INVALID", `${label} must clamp factors and colors.`);
}

function validateNoise(value, label) {
  exactKeys(value, NOISE_KEYS, label);
  assert(value.dimensions === "4D" && value.normalize === false, "UNSUPPORTED_NOISE_NODE", `${label} must use deterministic 4D noise without normalization.`);
  positive(value.scale, `${label}.scale`);
  nonNegative(value.detail, `${label}.detail`);
  unitInterval(value.roughness, `${label}.roughness`);
  positive(value.lacunarity, `${label}.lacunarity`);
  nonNegative(value.distortion, `${label}.distortion`);
}

function validateFrames(value) {
  assert(Array.isArray(value) && value.length === EXPECTED_MATERIAL_FRAME_COUNT, "MATERIAL_FRAME_CARDINALITY", "The Drawing 4 sidecar requires 65 material frames.");
  const frameIds = new Set();
  const mappingIds = new Set();
  let previous = "";
  for (const [index, frame] of value.entries()) {
    exactKeys(frame, FRAME_KEYS, `materialFrames[${index}]`);
    for (const key of ["frameId", "mappingId", "componentId", "primitiveId", "submeshId", "surfaceGroupId"]) safeId(frame[key], `materialFrames[${index}].${key}`);
    assert(!frameIds.has(frame.frameId), "DUPLICATE_MATERIAL_FRAME", `Duplicate frame ${frame.frameId}.`);
    assert(!mappingIds.has(frame.mappingId), "DUPLICATE_MATERIAL_MAPPING", `Duplicate mapping ${frame.mappingId}.`);
    assert(compareCodePoints(previous, frame.frameId) <= 0, "MATERIAL_FRAME_ORDER_INVALID", "Material frames must be sorted by frameId.");
    previous = frame.frameId;
    frameIds.add(frame.frameId);
    mappingIds.add(frame.mappingId);
    assert(frame.coordinateSpace === "PACKAGE_WORLD_METERS", "UNSUPPORTED_COORDINATE_SPACE", `${frame.frameId} coordinate space is unsupported.`);
    point(frame.origin, `${frame.frameId}.origin`);
    vector3(frame.grainAxis, `${frame.frameId}.grainAxis`);
    vector3(frame.crossGrainAxis, `${frame.frameId}.crossGrainAxis`);
    vector3(frame.normalAxis, `${frame.frameId}.normalAxis`);
    validateRightHandedFrame(frame);
    validateTextureScale(frame.physicalTextureScaleM, `${frame.frameId}.physicalTextureScaleM`);
    assert(frame.seedRuleVersion === MATERIAL_SEED_RULE_VERSION, "SEED_RULE_MISMATCH", `${frame.frameId} seed rule drifted.`);
    assert(SHA256_RE.test(frame.seedHex), "INVALID_MATERIAL_SEED", `${frame.frameId} seed must be SHA-256.`);
    assert(Number.isInteger(frame.seedUint32) && frame.seedUint32 >= 0 && frame.seedUint32 <= 0xffffffff, "INVALID_MATERIAL_SEED", `${frame.frameId} uint32 seed is invalid.`);
    vector3(frame.phaseOffset, `${frame.frameId}.phaseOffset`, unitInterval);
    assert(typeof frame.colorVariation === "number" && Number.isFinite(frame.colorVariation) && Math.abs(frame.colorVariation) <= 0.012, "INVALID_COLOR_VARIATION", `${frame.frameId} color variation is invalid.`);
    const { mappingDigest, ...core } = frame;
    assert(SHA256_RE.test(mappingDigest) && mappingDigest === hashCanonical(core), "MAPPING_DIGEST_MISMATCH", `${frame.frameId} mapping digest is stale.`);
  }
  return frameIds;
}

function validateBindings(renderPackage, value, materialIds, frameIds) {
  assert(Array.isArray(value) && value.length === EXPECTED_MATERIAL_BINDING_COUNT, "MATERIAL_BINDING_CARDINALITY", "The Drawing 4 sidecar requires exactly 80 bindings.");
  const expectedObjects = new Set(createObjectManifest(renderPackage).map((entry) => entry.objectId));
  expectedObjects.add("room-floor");
  expectedObjects.add("room-rear-wall");
  const bindingIds = new Set();
  const boundObjects = new Set();
  const usedFrames = new Set();
  const counts = Object.fromEntries(Object.values(MATERIAL_IDS).map((id) => [id, 0]));
  let previous = "";
  for (const [index, binding] of value.entries()) {
    exactKeys(binding, BINDING_KEYS, `bindings[${index}]`);
    for (const key of ["bindingId", "componentId", "primitiveId", "submeshId", "surfaceGroupId", "objectId", "sourceMaterialSlot", "sourceMaterialId", "materialId"]) safeId(binding[key], `bindings[${index}].${key}`);
    assert(["PRODUCT_SUBMESH", "ROOM_SURFACE"].includes(binding.targetKind), "UNKNOWN_BINDING_TARGET", `${binding.bindingId} target kind is unsupported.`);
    assert(binding.materialSlotIndex === 0, "INVALID_MATERIAL_SLOT_INDEX", `${binding.bindingId} must target exact slot zero.`);
    assert(!bindingIds.has(binding.bindingId), "DUPLICATE_BINDING_ID", `Duplicate binding ${binding.bindingId}.`);
    assert(!boundObjects.has(binding.objectId), "CONFLICTING_MATERIAL_BINDING", `${binding.objectId} has more than one material binding.`);
    assert(compareCodePoints(previous, binding.bindingId) <= 0, "MATERIAL_BINDING_ORDER_INVALID", "Bindings must be sorted by bindingId.");
    previous = binding.bindingId;
    bindingIds.add(binding.bindingId);
    boundObjects.add(binding.objectId);
    assert(expectedObjects.has(binding.objectId), "UNRESOLVED_MATERIAL_BINDING", `${binding.objectId} is not an accepted surface.`);
    assert(materialIds.has(binding.materialId), "UNKNOWN_BINDING_MATERIAL", `${binding.bindingId} references an unknown material.`);
    counts[binding.materialId] += 1;
    if ([MATERIAL_IDS.oak, MATERIAL_IDS.countertop].includes(binding.materialId)) {
      assert(typeof binding.materialFrameId === "string" && frameIds.has(binding.materialFrameId), "MISSING_MATERIAL_FRAME", `${binding.bindingId} requires an exact material frame.`);
      assert(!usedFrames.has(binding.materialFrameId), "DUPLICATE_FRAME_BINDING", `${binding.materialFrameId} is assigned more than once.`);
      usedFrames.add(binding.materialFrameId);
    } else {
      assert(binding.materialFrameId === null, "UNEXPECTED_MATERIAL_FRAME", `${binding.bindingId} cannot have a wood frame.`);
    }
  }
  assert(deepEqual([...boundObjects].sort(), [...expectedObjects].sort()), "UNBOUND_REQUIRED_SURFACE", "Every product and room surface must resolve exactly once.");
  assert(usedFrames.size === frameIds.size, "UNUSED_MATERIAL_FRAME", "Every material frame must be used exactly once.");
  assert(deepEqual(counts, EXPECTED_BINDING_COUNTS), "MATERIAL_BINDING_COUNTS_MISMATCH", "Per-material binding counts drifted.");
}

function validateCapture(renderPackage, value, materialPackageKey) {
  exactKeys(value, CAPTURE_KEYS, "capture");
  assert(value.captureId === MATERIAL_PREVIEW_CAPTURE_ID, "INVALID_CAPTURE_ID", "Material preview capture ID drifted.");
  assert(value.materialMode === MATERIAL_PIPELINE_VERSION, "INVALID_CAPTURE_MATERIAL_MODE", "Material preview mode drifted.");
  assert(deepEqual(value.camera, renderPackage.camera), "CUSTOMER_CAMERA_MUTATION", "Material preview camera must deep-equal the accepted customer camera.");
  exactKeys(value.sceneIdentity, SCENE_IDENTITY_KEYS, "capture.sceneIdentity");
  const expectedScene = {
    sceneVersion: renderPackage.scene.sceneVersion,
    environment: renderPackage.scene.environment,
    shell: renderPackage.scene.shell,
    room: renderPackage.room,
    lightManifest: [],
    worldIdentitySha256: hashCanonical(renderPackage.scene.environment),
    lightManifestSha256: hashCanonical([])
  };
  assert(deepEqual(value.sceneIdentity, expectedScene), "SCENE_IDENTITY_MUTATION", "Material preview room, world, or light identity drifted.");
  assert(deepEqual(value.inheritedRender, renderPackage.render), "RENDER_SETTINGS_MUTATION", "Material preview must inherit the accepted primary render settings exactly.");
  exactKeys(value.renderPolicy, RENDER_POLICY_KEYS, "capture.renderPolicy");
  for (const key of ["samplingSeed", "animatedSeed", "adaptiveSampling", "denoiser"]) {
    exactKeys(value.renderPolicy[key], POLICY_VALUE_KEYS, `capture.renderPolicy.${key}`);
  }
  const expectedRenderPolicy = {
    engine: "BLENDER_EEVEE_NEXT",
    blenderEngine: "BLENDER_EEVEE",
    renderDevice: "BLENDER_EEVEE_INTERNAL",
    samples: 128,
    samplingSeed: { value: null, policy: "not-applicable-eevee-5.2" },
    animatedSeed: { value: null, policy: "not-applicable-eevee-5.2" },
    adaptiveSampling: { value: null, policy: "not-applicable-eevee-5.2" },
    denoiser: { value: false, policy: "not-applicable-eevee-5.2-compositor-disabled" },
    materialPipelineVersion: MATERIAL_PIPELINE_VERSION
  };
  assert(
    deepEqual(value.renderPolicy, expectedRenderPolicy),
    "MATERIAL_RENDER_POLICY_INVALID",
    "Material preview render policy drifted."
  );
  const runtime = normalizeBlenderRuntime(value.blenderRuntime);
  assert(deepEqual(runtime, value.blenderRuntime), "BLENDER_RUNTIME_INVALID", "Blender runtime identity is not canonical.");
  exactKeys(value.output, OUTPUT_KEYS, "capture.output");
  const expectedOutput = {
    pass: "materials-preview", filename: "materials-preview.webp", mimeType: "image/webp",
    width: 960, height: 640, maxBytes: 32 * 1024 * 1024,
    webpColorMode: "RGB", webpColorDepth: "8", webpQuality: 90,
    colorManagement: "FOLLOW_SCENE"
  };
  assert(deepEqual(value.output, expectedOutput), "MATERIAL_OUTPUT_CONTRACT_INVALID", "Material preview output contract drifted.");
  assert(value.output.filename !== "beauty.webp" && !value.output.filename.endsWith(".blend"), "PRIMARY_OUTPUT_TARGET_FORBIDDEN", "Material preview cannot target a primary clay output.");
  const { captureKey, ...withoutKey } = value;
  const expectedKey = createMaterialsPreviewCaptureKey(materialPackageKey, withoutKey);
  assert(CAPTURE_KEY_RE.test(captureKey) && captureKey === expectedKey, "STALE_CAPTURE_KEY", "Material preview capture key is stale or malformed.");
}

function validateOutputRecord(output) {
  exactKeys(output, RESULT_OUTPUT_KEYS, "result.output");
  assert(output.pass === "materials-preview", "INVALID_RESULT_PASS", "Result pass is unsupported.");
  assert(typeof output.objectKey === "string" && !output.objectKey.startsWith("/") && !output.objectKey.includes(".."), "INVALID_RESULT_OBJECT_KEY", "Result object key must be logical and relative.");
  assert(output.mimeType === "image/webp", "INVALID_RESULT_MIME", "Result must be WebP.");
  assert(Number.isInteger(output.width) && output.width > 0 && Number.isInteger(output.height) && output.height > 0, "INVALID_RESULT_DIMENSIONS", "Result dimensions are invalid.");
  assert(Number.isInteger(output.bytes) && output.bytes > 0, "INVALID_RESULT_BYTES", "Result byte count is invalid.");
  assert(SHA256_RE.test(output.sha256), "INVALID_RESULT_SHA256", "Result SHA-256 is invalid.");
}

function assertBaseRenderPackage(renderPackage) {
  assert(renderPackage && typeof renderPackage === "object" && !Array.isArray(renderPackage), "MISSING_BASE_PACKAGE", "A verified Blender geometry package is required.");
  assert(renderPackage.identity?.geometryFingerprint === EXPECTED_GEOMETRY_FINGERPRINT, "BASE_GEOMETRY_FINGERPRINT_MISMATCH", "Phase 5 geometry fingerprint drifted.");
  assert(renderPackage.renderKey === EXPECTED_PRIMARY_PACKAGE_KEY, "BASE_RENDER_KEY_MISMATCH", "Phase 5 primary render key drifted.");
  assert(renderPackage.components?.length === EXPECTED_COMPONENT_COUNT, "BASE_COMPONENT_COUNT_MISMATCH", "Phase 5 component count drifted.");
  assert(renderPackage.constraints?.length === EXPECTED_CONSTRAINT_COUNT, "BASE_CONSTRAINT_COUNT_MISMATCH", "Phase 5 constraint count drifted.");
  assert(renderPackage.readiness?.customerBeautyRenderApproved === false, "BASE_CUSTOMER_APPROVAL_DRIFT", "Customer beauty approval must remain false.");
}

function normalizeBlenderRuntime(value) {
  exactKeys(value, BLENDER_RUNTIME_KEYS, "blenderRuntime");
  for (const key of BLENDER_RUNTIME_KEYS) {
    assert(typeof value[key] === "string" && value[key].length > 0 && !/[\r\n]/.test(value[key]), "INVALID_BLENDER_RUNTIME", `blenderRuntime.${key} is invalid.`);
  }
  assert(value.version === SUPPORTED_BLENDER_VERSION, "UNSUPPORTED_BLENDER_VERSION", `Blender ${SUPPORTED_BLENDER_VERSION} is required.`);
  assert(value.buildHash === SUPPORTED_BLENDER_BUILD, "UNSUPPORTED_BLENDER_BUILD", `Blender build ${SUPPORTED_BLENDER_BUILD} is required.`);
  assert(value.backend === "METAL" && value.renderer === "Metal API", "UNSUPPORTED_RENDER_DEVICE", "The accepted material preview requires the verified Metal Eevee runtime.");
  return {
    version: value.version,
    buildHash: value.buildHash,
    backend: value.backend,
    vendor: value.vendor,
    renderer: value.renderer,
    deviceVersion: value.deviceVersion
  };
}

function validateRightHandedFrame(frame) {
  const [grain, crossGrain, normal] = [frame.grainAxis, frame.crossGrainAxis, frame.normalAxis];
  for (const [label, axis] of [["grain", grain], ["cross-grain", crossGrain], ["normal", normal]]) {
    assert(Math.abs(length(axis) - 1) <= 1e-9, "NON_NORMALIZED_MATERIAL_FRAME", `${frame.frameId} ${label} axis is not normalized.`);
  }
  assert(Math.abs(dot(grain, crossGrain)) <= 1e-9 && Math.abs(dot(grain, normal)) <= 1e-9 && Math.abs(dot(crossGrain, normal)) <= 1e-9, "NON_ORTHOGONAL_MATERIAL_FRAME", `${frame.frameId} axes are not orthogonal.`);
  assert(dot(cross(grain, crossGrain), normal) >= 1 - 1e-9, "LEFT_HANDED_MATERIAL_FRAME", `${frame.frameId} material frame is not right-handed.`);
}

function validateTextureScale(value, label) {
  exactKeys(value, TEXTURE_SCALE_KEYS, label);
  for (const key of TEXTURE_SCALE_KEYS) positive(value[key], `${label}.${key}`);
}

function finiteBounds(value, label) {
  assert(value?.min && value?.max, "INVALID_BOUNDS", `${label} bounds are missing.`);
  for (const axis of ["x", "y", "z"]) {
    finite(value.min[axis], `${label}.min.${axis}`);
    finite(value.max[axis], `${label}.max.${axis}`);
    assert(value.max[axis] > value.min[axis], "UNORDERED_BOUNDS", `${label} ${axis} bounds are not ordered.`);
  }
}

function rejectNonFinite(value, path) {
  if (Array.isArray(value)) {
    value.forEach((child, index) => rejectNonFinite(child, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, child]) => rejectNonFinite(child, `${path}.${key}`));
    return;
  }
  if (typeof value === "number") finite(value, path);
}

function color(value, label) {
  assert(Array.isArray(value) && value.length === 4, "INVALID_COLOR", `${label} must be RGBA.`);
  value.forEach((channel, index) => unitInterval(channel, `${label}[${index}]`));
}

function point(value, label) {
  exactKeys(value, new Set(["x", "y", "z"]), label);
  for (const axis of ["x", "y", "z"]) finite(value[axis], `${label}.${axis}`);
}

function vector3(value, label, validator = finite) {
  assert(Array.isArray(value) && value.length === 3, "INVALID_VECTOR", `${label} must contain three numbers.`);
  value.forEach((entry, index) => validator(entry, `${label}[${index}]`));
}

function finite(value, label) {
  assert(typeof value === "number" && Number.isFinite(value), "NON_FINITE_NUMBER", `${label} must be a finite JSON number.`);
  return value;
}

function positive(value, label) {
  finite(value, label);
  assert(value > 0, "NON_POSITIVE_NUMBER", `${label} must be positive.`);
  return value;
}

function nonNegative(value, label) {
  finite(value, label);
  assert(value >= 0, "NEGATIVE_NUMBER", `${label} must not be negative.`);
  return value;
}

function unitInterval(value, label) {
  finite(value, label);
  assert(value >= 0 && value <= 1, "NUMBER_OUT_OF_RANGE", `${label} must be in [0,1].`);
  return value;
}

function exactKeys(value, expected, label) {
  assert(value && typeof value === "object" && !Array.isArray(value), "INVALID_OBJECT", `${label} must be an object.`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  assert(deepEqual(actual, wanted), "UNKNOWN_OR_MISSING_PROPERTY", `${label} keys are invalid: ${actual.join(", ")}.`);
}

function safeId(value, label) {
  assert(typeof value === "string" && SAFE_ID_RE.test(value), "INVALID_IDENTIFIER", `${label} is not a safe deterministic identifier.`);
}

function unitFromHex(value) {
  return roundMetric(Number.parseInt(value, 16) / 0xffffffff);
}

function roundMetric(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1e12) / 1e12;
}

function roundColorVariation(value) {
  const rounded = Math.round((Number(value) + Number.EPSILON) * 1e4) / 1e4;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function sha256Text(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

function compareBy(key) {
  return (left, right) => compareCodePoints(left[key], right[key]);
}

function compareCodePoints(left, right) {
  const leftPoints = Array.from(String(left), (character) => character.codePointAt(0));
  const rightPoints = Array.from(String(right), (character) => character.codePointAt(0));
  const sharedLength = Math.min(leftPoints.length, rightPoints.length);
  for (let index = 0; index < sharedLength; index += 1) {
    if (leftPoints[index] !== rightPoints[index]) return leftPoints[index] - rightPoints[index];
  }
  return leftPoints.length - rightPoints.length;
}

function dot(left, right) {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function cross(left, right) {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0]
  ];
}

function length(value) {
  return Math.hypot(...value);
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function deepEqual(left, right) {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function deepFreeze(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(deepFreeze));
  if (!value || typeof value !== "object") return value;
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, child]) => [key, deepFreeze(child)])));
}

function normalizeContractError(error) {
  if (error instanceof MaterialsPreviewContractError) {
    return Object.freeze({ code: error.code, message: error.message, details: Object.freeze([...error.details]) });
  }
  return Object.freeze({ code: "UNEXPECTED_CONTRACT_ERROR", message: error?.message || String(error), details: Object.freeze([]) });
}

function assert(condition, code, message, details = []) {
  if (!condition) throw new MaterialsPreviewContractError(code, message, details);
}
