import {
  canonicalize,
  deterministicJson,
  hashCanonical,
  validateGuidedBlenderMaterialPackage
} from "./materials-preview-contract.mjs";

export { canonicalize, deterministicJson, hashCanonical };

export const PHOTOREAL_PRESENTATION_PACKAGE_KIND = "jq-photoreal-presentation-package";
export const PHOTOREAL_PRESENTATION_PACKAGE_SCHEMA = "jq-photoreal-presentation-package-v1";
export const PHOTOREAL_PRESENTATION_PACKAGE_SCHEMA_VERSION = 1;
export const PHOTOREAL_PRESENTATION_PACKAGE_VERSION = "jq-photoreal-presentation-package-v1";
export const PHOTOREAL_PRESENTATION_CAMERA_VERSION = "jq-photoreal-presentation-camera-v1";
export const PHOTOREAL_PRESENTATION_LIGHTING_VERSION = "jq-photoreal-presentation-lighting-v1";
export const PHOTOREAL_PRESENTATION_ROOM_MATERIAL_VERSION = "jq-photoreal-room-materials-v1";
export const PHOTOREAL_PRESENTATION_WORLD_VERSION = "jq-photoreal-presentation-world-v1";
export const PHOTOREAL_PRESENTATION_RENDER_VERSION = "jq-photoreal-cycles-render-v1";
export const PHOTOREAL_PRESENTATION_PIPELINE_VERSION = "2026.08-photoreal-presentation-baseline-v1";
export const PHOTOREAL_PRESENTATION_CAPTURE_ID = "photoreal-beauty-v1";
export const PHOTOREAL_PRESENTATION_RESULT_KIND = "jq-photoreal-presentation-result";
export const PHOTOREAL_PRESENTATION_RESULT_SCHEMA_VERSION = 1;

// Short aliases make the contract pleasant to consume without weakening the
// descriptive exported names above.
export const PRESENTATION_PACKAGE_KIND = PHOTOREAL_PRESENTATION_PACKAGE_KIND;
export const PRESENTATION_PACKAGE_SCHEMA = PHOTOREAL_PRESENTATION_PACKAGE_SCHEMA;
export const PRESENTATION_PACKAGE_SCHEMA_VERSION = PHOTOREAL_PRESENTATION_PACKAGE_SCHEMA_VERSION;
export const PRESENTATION_PACKAGE_VERSION = PHOTOREAL_PRESENTATION_PACKAGE_VERSION;
export const PRESENTATION_CAMERA_VERSION = PHOTOREAL_PRESENTATION_CAMERA_VERSION;
export const PRESENTATION_LIGHTING_VERSION = PHOTOREAL_PRESENTATION_LIGHTING_VERSION;
export const PRESENTATION_ROOM_MATERIAL_VERSION = PHOTOREAL_PRESENTATION_ROOM_MATERIAL_VERSION;
export const PRESENTATION_WORLD_VERSION = PHOTOREAL_PRESENTATION_WORLD_VERSION;
export const PRESENTATION_RENDER_VERSION = PHOTOREAL_PRESENTATION_RENDER_VERSION;
export const PRESENTATION_PIPELINE_VERSION = PHOTOREAL_PRESENTATION_PIPELINE_VERSION;
export const PRESENTATION_CAPTURE_ID = PHOTOREAL_PRESENTATION_CAPTURE_ID;
export const PRESENTATION_RESULT_KIND = PHOTOREAL_PRESENTATION_RESULT_KIND;
export const PRESENTATION_RESULT_SCHEMA_VERSION = PHOTOREAL_PRESENTATION_RESULT_SCHEMA_VERSION;

export const EXPECTED_GEOMETRY_FINGERPRINT = "jq-guided-geometry-v1-028YPJG43EJF6";
export const EXPECTED_PRIMARY_PACKAGE_KEY = "jq-blender-package-v1-f80f6b84cb804623613e3ecb55aa61461e71e7a4dc70816e37bae38bd5e5be15";
export const EXPECTED_PRIMARY_PACKAGE_SHA256 = "f16e1e1ebc190090a3303ed13df6a6be6353760447fd692f30f1e04d25022a9b";
export const EXPECTED_OBJECT_MANIFEST_SHA256 = "4a1f11e676b7203a40a03b8058653b630289a4d6e3c4f56b7747ef34f80bd22f";
export const EXPECTED_CAMERA_FINGERPRINT = "jq-guided-snapshot-camera-v1-1kj9fv5";
export const EXPECTED_MATERIAL_PACKAGE_KEY = "jq-render-material-package-v1-6d180ecff47487de4692620d5387b7bde3b827a5a0a5f6b4ad438cb6335d2794";
export const EXPECTED_MATERIAL_PACKAGE_FILE_SHA256 = "290ce873984977396ae8fabc37572e22b8d51f110ae3db7051b6daa69be66cf5";
export const EXPECTED_MATERIAL_CAPTURE_KEY = "jq-materials-preview-v1-ea08c048092d14f80da06924ec82126c8edae36a388b785313bac02e763b91ea";
export const EXPECTED_MATERIAL_RESULT_KEY = "jq-materials-preview-result-v1-367133ae6a20e4a562159a67d38b993396a3d94ec7ac8a3710fac395e857314e";

export const EXPECTED_PHASE6_REPORT_COUNTS = Object.freeze({
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

export const EXPECTED_PHASE6_REPORT_PARITY = Object.freeze({
  bounds: true,
  camera: true,
  geometry: true,
  lights: true,
  objects: true,
  renderSettings: true,
  shaderParameters: true,
  topology: true,
  transforms: true,
  world: true
});

export const EXPECTED_PHASE6_REPORT_DIGESTS = Object.freeze({
  boundsAfterSha256: "3b621a2266378944888bde6efde033bf92eb7d208160fa1987dbb78766ec2d6c",
  boundsBeforeSha256: "3b621a2266378944888bde6efde033bf92eb7d208160fa1987dbb78766ec2d6c",
  cameraAfterSha256: "1f27768d5c672576eb7bfa093b5be44125135c35c9b6494cd06eb54f20574de0",
  cameraBeforeSha256: "1f27768d5c672576eb7bfa093b5be44125135c35c9b6494cd06eb54f20574de0",
  geometryAfterSha256: "0e34d05fac3b3ac025dbbce3104d24c97b704ae168884d97713c3e7978159c72",
  geometryBeforeSha256: "0e34d05fac3b3ac025dbbce3104d24c97b704ae168884d97713c3e7978159c72",
  linksSha256: "1b83b7addb95360954e05f4ca1c0b19925430f6c37184e5b7059437a940b721f",
  materialsSha256: "520be8b532c79c17c50d2a73e31d4f4094df81a4d71192877bcbc316d6bbf7f6",
  nodesSha256: "95f4c09daa27ec6b7bb25bea15d814359e362c4360fe63e33c8295a2d8ba867a",
  renderSettingsAfterSha256: "04c600a9d0dc859e9f42c2b8891d807ec6ee0cfaf8b01fe3c891bbc455318d53",
  renderSettingsBeforeSha256: "04c600a9d0dc859e9f42c2b8891d807ec6ee0cfaf8b01fe3c891bbc455318d53",
  shaderParametersAfterSha256: "54ba4a5444fe595a05118146e33987fdffe0136ba8316a131ea821592d0ea36a",
  shaderParametersBeforeSha256: "54ba4a5444fe595a05118146e33987fdffe0136ba8316a131ea821592d0ea36a",
  slotAssignmentsSha256: "1ebac1ccbc11474416ae1c6510e819916cb689ee1e4943e2d25e0b3f2d5f0540",
  topologyAfterSha256: "1bf523568c6fbd240543b5f0a25bed34881a66f5ba5e3dad43ff8878c1cebb63",
  topologyBeforeSha256: "1bf523568c6fbd240543b5f0a25bed34881a66f5ba5e3dad43ff8878c1cebb63",
  transformsAfterSha256: "81254f454170b20f074e7da09a62590796bc58aac3fd81d74033a8c028f5c0cf",
  transformsBeforeSha256: "81254f454170b20f074e7da09a62590796bc58aac3fd81d74033a8c028f5c0cf",
  worldAfterSha256: "5ea7c02b7db8d70edcf86c4138691cc3c0f01f562153a299995ea8619f6953b1",
  worldBeforeSha256: "5ea7c02b7db8d70edcf86c4138691cc3c0f01f562153a299995ea8619f6953b1"
});

export const PHOTOREAL_OUTPUT_FILENAMES = Object.freeze({
  blend: "TV01-photoreal-beauty.blend",
  master: "photoreal-beauty-master.png",
  beauty: "photoreal-beauty.webp",
  result: "photoreal-beauty-result.json",
  report: "photoreal-beauty-report.json"
});

const PACKAGE_KEY_RE = /^jq-photoreal-presentation-package-v1-[a-f0-9]{64}$/;
const CAPTURE_KEY_RE = /^jq-photoreal-beauty-v1-[a-f0-9]{64}$/;
const RESULT_KEY_RE = /^jq-photoreal-beauty-result-v1-[a-f0-9]{64}$/;
const SHA256_RE = /^[a-f0-9]{64}$/;
const SAFE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._/+:\-]{0,511}$/;

const TOP_LEVEL_KEYS = keys("kind schema schemaVersion authority versions phase6Foundation presentation capture presentationPackageKey");
const AUTHORITY_KEYS = keys("scope productGeometryAuthority materialBindingAuthority materialAuthorityClassification materialColorReferenceStatus customerMaterialApproved customerBeautyRenderApproved");
const VERSION_KEYS = keys("presentationPackageVersion cameraVersion lightingVersion roomMaterialVersion worldVersion renderVersion presentationPipelineVersion");
const FOUNDATION_KEYS = keys("geometryFingerprint primaryPackageKey primaryPackageSha256 materialPackageKey materialPackageFileSha256 materialCaptureKey materialResultKey cameraFingerprint objectManifestSha256 reportKind reportSchemaVersion counts digests");
const FOUNDATION_COUNT_KEYS = keys("bindings cameras collections constraintObjects lights links materialFrames materials modifiers nodes productMeshObjects roomMeshObjects");
const FOUNDATION_DIGEST_KEYS = keys("geometrySha256 topologySha256 boundsSha256 transformsSha256 cameraSha256 worldSha256 renderSettingsSha256 materialsSha256 shaderParametersSha256 slotAssignmentsSha256 nodesSha256 linksSha256");
const PRESENTATION_KEYS = keys("collectionPolicy camera lights roomMaterials world edgeSoftening");
const COLLECTION_KEYS = keys("cameraCollection lightCollection");
const CAMERA_KEYS = keys("cameraId cameraVersion blenderObjectName type position target up lensMm sensorWidthMm sensorFit clipStartM clipEndM depthOfField");
const DOF_KEYS = keys("enabled");
const LIGHT_KEYS = keys("lightId lightingVersion blenderObjectName role blenderType position target color energyW useShadow normalize diffuseFactor specularFactor volumeFactor shape sizeM sizeYM spreadRadians spotSizeRadians spotBlend shadowSoftSizeM anchor");
const ANCHOR_KEYS = keys("componentId primitiveId submeshId objectId materialId surfaceRole center");
const ROOM_MATERIAL_KEYS = keys("materialId recipeVersion blenderMaterialName targetObjectId declaredColorSpace externalResources trueDisplacement parameters");
const ROOM_PARAMETER_KEYS = keys("baseColor metallic roughness ior alpha coatWeight coatRoughness transmissionWeight emissionColor emissionStrength noise bump");
const NOISE_KEYS = keys("dimensions scale detail roughness w colorVariation");
const BUMP_KEYS = keys("enabled strength distanceM source");
const WORLD_KEYS = keys("worldVersion blenderWorldName environmentAssetPath environmentSha256 projection interpolation colorSpace strength rotationEuler");
const EDGE_KEYS = keys("enabled method modifierCount");
const CAPTURE_KEYS = keys("captureId captureKey blenderRuntime renderPolicy film renderOptions colorManagement outputs");
const RUNTIME_KEYS = keys("version buildHash backend vendor renderer deviceVersion");
const RENDER_KEYS = keys("renderVersion engine blenderEngine computeDeviceType deviceType deviceName sceneDevice width height resolutionPercentage pixelAspectX pixelAspectY samples adaptiveSampling adaptiveThreshold adaptiveMinSamples samplingSeed animatedSeed useLightTree useGuiding maxBounces diffuseBounces glossyBounces transmissionBounces transparentBounces volumeBounces reflectiveCaustics refractiveCaustics directClamp indirectClamp filterWidth denoising");
const DENOISING_KEYS = keys("enabled denoiser inputPasses prefilter quality useGpu");
const FILM_KEYS = keys("transparent transparentGlass transparentRoughnessThreshold");
const RENDER_OPTIONS_KEYS = keys("useCompositing useSequencer useFileExtension useStamp useBorder useCropToBorder ditherIntensity");
const COLOR_MANAGEMENT_KEYS = keys("displayDevice viewTransform look exposure gamma useCurveMapping");
const OUTPUT_KEYS = keys("pass filename mimeType width height maxBytes colorMode colorDepth colorManagement compression quality");
const RESULT_KEYS = keys("kind schemaVersion presentationPackageKey captureKey presentationPipelineVersion status outputs resultKey");
const RESULT_OUTPUT_KEYS = keys("pass objectKey mimeType width height bytes sha256");

export class PhotorealPresentationContractError extends Error {
  constructor(code, message, details = []) {
    super(message);
    this.name = "PhotorealPresentationContractError";
    this.code = code;
    this.details = details;
  }
}

export function createGuidedBlenderPhotorealPresentationPackage(
  renderPackage,
  materialPackage,
  phase6Report,
  options = {}
) {
  validateSourceInputs(renderPackage, materialPackage, phase6Report, options.blenderRuntime);
  const base = createPackageBase(renderPackage, materialPackage, phase6Report, options.blenderRuntime);
  const presentationPackageKey = `jq-photoreal-presentation-package-v1-${hashCanonical({
    keyVersion: PHOTOREAL_PRESENTATION_PACKAGE_SCHEMA,
    ...base
  })}`;
  const captureWithoutKey = createCapture(options.blenderRuntime);
  const captureKey = `jq-photoreal-beauty-v1-${hashCanonical({
    keyVersion: PHOTOREAL_PRESENTATION_CAPTURE_ID,
    presentationPackageKey,
    capture: captureWithoutKey
  })}`;
  return deepFreeze({
    ...base,
    capture: { ...captureWithoutKey, captureKey },
    presentationPackageKey
  });
}

export function validateGuidedBlenderPhotorealPresentationPackage(
  renderPackage,
  materialPackage,
  phase6Report,
  presentationPackage,
  options = {}
) {
  try {
    rejectNonFinite(presentationPackage, "presentationPackage");
    exactKeys(presentationPackage, TOP_LEVEL_KEYS, "presentationPackage");
    const expected = createGuidedBlenderPhotorealPresentationPackage(
      renderPackage,
      materialPackage,
      phase6Report,
      { blenderRuntime: options.blenderRuntime || presentationPackage.capture?.blenderRuntime }
    );
    assert(deepEqual(presentationPackage, expected), "PRESENTATION_PACKAGE_DRIFT", "Presentation package differs from its exact renderer-neutral contract.");
    assert(PACKAGE_KEY_RE.test(presentationPackage.presentationPackageKey), "INVALID_PRESENTATION_PACKAGE_KEY", "Presentation package key is malformed.");
    assert(CAPTURE_KEY_RE.test(presentationPackage.capture.captureKey), "INVALID_PRESENTATION_CAPTURE_KEY", "Presentation capture key is malformed.");
    validatePackageShape(presentationPackage, renderPackage);
    return Object.freeze({ valid: true, errors: Object.freeze([]) });
  } catch (error) {
    return Object.freeze({ valid: false, errors: Object.freeze([normalizeError(error)]) });
  }
}

export function createGuidedBlenderPhotorealPresentationResult(presentationPackage, outputs) {
  assert(Array.isArray(outputs) && outputs.length === 2, "INVALID_PRESENTATION_OUTPUTS", "Presentation result requires master and WebP outputs.");
  const base = {
    kind: PHOTOREAL_PRESENTATION_RESULT_KIND,
    schemaVersion: PHOTOREAL_PRESENTATION_RESULT_SCHEMA_VERSION,
    presentationPackageKey: presentationPackage.presentationPackageKey,
    captureKey: presentationPackage.capture.captureKey,
    presentationPipelineVersion: PHOTOREAL_PRESENTATION_PIPELINE_VERSION,
    status: "succeeded",
    outputs: clone(outputs)
  };
  return deepFreeze({
    ...base,
    resultKey: `jq-photoreal-beauty-result-v1-${hashCanonical(base)}`
  });
}

export function validateGuidedBlenderPhotorealPresentationResult(presentationPackage, result) {
  try {
    exactKeys(result, RESULT_KEYS, "result");
    rejectNonFinite(result, "result");
    assert(result.kind === PHOTOREAL_PRESENTATION_RESULT_KIND, "INVALID_PRESENTATION_RESULT_KIND", "Presentation result kind is invalid.");
    assert(result.schemaVersion === PHOTOREAL_PRESENTATION_RESULT_SCHEMA_VERSION, "INVALID_PRESENTATION_RESULT_SCHEMA", "Presentation result schema is invalid.");
    assert(result.presentationPackageKey === presentationPackage.presentationPackageKey, "PRESENTATION_RESULT_PACKAGE_MISMATCH", "Presentation result targets another package.");
    assert(result.captureKey === presentationPackage.capture.captureKey, "PRESENTATION_RESULT_CAPTURE_MISMATCH", "Presentation result targets another capture.");
    assert(result.presentationPipelineVersion === PHOTOREAL_PRESENTATION_PIPELINE_VERSION && result.status === "succeeded", "PRESENTATION_RESULT_STATUS_INVALID", "Presentation result pipeline or status is invalid.");
    assert(Array.isArray(result.outputs) && result.outputs.length === 2, "INVALID_PRESENTATION_OUTPUTS", "Presentation result requires exactly two outputs.");
    result.outputs.forEach((output, index) => {
      exactKeys(output, RESULT_OUTPUT_KEYS, `result.outputs[${index}]`);
      const contract = presentationPackage.capture.outputs[index];
      assert(output.pass === contract.pass && output.mimeType === contract.mimeType, "PRESENTATION_RESULT_OUTPUT_MISMATCH", "Presentation result output identity drifted.");
      assert(output.objectKey === `${presentationPackage.capture.captureKey}/${contract.filename}`, "PRESENTATION_RESULT_OBJECT_KEY_INVALID", "Presentation result object key is invalid.");
      assert(output.width === contract.width && output.height === contract.height, "PRESENTATION_RESULT_DIMENSIONS_INVALID", "Presentation result dimensions drifted.");
      assert(Number.isInteger(output.bytes) && output.bytes > 0 && output.bytes <= contract.maxBytes, "PRESENTATION_RESULT_BYTES_INVALID", "Presentation result byte count is invalid.");
      assert(typeof output.sha256 === "string" && SHA256_RE.test(output.sha256), "PRESENTATION_RESULT_SHA256_INVALID", "Presentation output SHA-256 is invalid.");
    });
    const expectedKey = `jq-photoreal-beauty-result-v1-${hashCanonical(Object.fromEntries(
      Object.entries(result).filter(([key]) => key !== "resultKey")
    ))}`;
    assert(RESULT_KEY_RE.test(result.resultKey) && result.resultKey === expectedKey, "STALE_PRESENTATION_RESULT_KEY", "Presentation result key is stale.");
    return Object.freeze({ valid: true, errors: Object.freeze([]) });
  } catch (error) {
    return Object.freeze({ valid: false, errors: Object.freeze([normalizeError(error)]) });
  }
}

function createPackageBase(renderPackage, materialPackage, phase6Report, blenderRuntime) {
  return {
    kind: PHOTOREAL_PRESENTATION_PACKAGE_KIND,
    schema: PHOTOREAL_PRESENTATION_PACKAGE_SCHEMA,
    schemaVersion: PHOTOREAL_PRESENTATION_PACKAGE_SCHEMA_VERSION,
    authority: {
      scope: "local-photoreal-presentation-only",
      productGeometryAuthority: "jq-javascript-engine-only",
      materialBindingAuthority: materialPackage.versions.materialPipelineVersion,
      materialAuthorityClassification: materialPackage.authority.classification,
      materialColorReferenceStatus: materialPackage.authority.materialColorReferenceStatus,
      customerMaterialApproved: false,
      customerBeautyRenderApproved: false
    },
    versions: {
      presentationPackageVersion: PHOTOREAL_PRESENTATION_PACKAGE_VERSION,
      cameraVersion: PHOTOREAL_PRESENTATION_CAMERA_VERSION,
      lightingVersion: PHOTOREAL_PRESENTATION_LIGHTING_VERSION,
      roomMaterialVersion: PHOTOREAL_PRESENTATION_ROOM_MATERIAL_VERSION,
      worldVersion: PHOTOREAL_PRESENTATION_WORLD_VERSION,
      renderVersion: PHOTOREAL_PRESENTATION_RENDER_VERSION,
      presentationPipelineVersion: PHOTOREAL_PRESENTATION_PIPELINE_VERSION
    },
    phase6Foundation: createFoundation(renderPackage, materialPackage, phase6Report),
    presentation: createPresentation(renderPackage)
  };
}

function createFoundation(renderPackage, materialPackage, report) {
  return {
    geometryFingerprint: EXPECTED_GEOMETRY_FINGERPRINT,
    primaryPackageKey: EXPECTED_PRIMARY_PACKAGE_KEY,
    primaryPackageSha256: EXPECTED_PRIMARY_PACKAGE_SHA256,
    materialPackageKey: EXPECTED_MATERIAL_PACKAGE_KEY,
    materialPackageFileSha256: EXPECTED_MATERIAL_PACKAGE_FILE_SHA256,
    materialCaptureKey: EXPECTED_MATERIAL_CAPTURE_KEY,
    materialResultKey: EXPECTED_MATERIAL_RESULT_KEY,
    cameraFingerprint: EXPECTED_CAMERA_FINGERPRINT,
    objectManifestSha256: EXPECTED_OBJECT_MANIFEST_SHA256,
    reportKind: report.kind,
    reportSchemaVersion: report.schemaVersion,
    counts: clone(report.counts),
    digests: {
      geometrySha256: report.digests.geometryAfterSha256,
      topologySha256: report.digests.topologyAfterSha256,
      boundsSha256: report.digests.boundsAfterSha256,
      transformsSha256: report.digests.transformsAfterSha256,
      cameraSha256: report.digests.cameraAfterSha256,
      worldSha256: report.digests.worldAfterSha256,
      renderSettingsSha256: report.digests.renderSettingsAfterSha256,
      materialsSha256: report.digests.materialsSha256,
      shaderParametersSha256: report.digests.shaderParametersAfterSha256,
      slotAssignmentsSha256: report.digests.slotAssignmentsSha256,
      nodesSha256: report.digests.nodesSha256,
      linksSha256: report.digests.linksSha256
    }
  };
}

function createPresentation(renderPackage) {
  const leftAnchor = puckAnchor(renderPackage, "guided-installation-main/section-01-light-puck", -1.12395);
  const rightAnchor = puckAnchor(renderPackage, "guided-installation-main/section-04-light-puck", 1.12395);
  return {
    collectionPolicy: {
      cameraCollection: "JQ_PRESENTATION_CAMERAS",
      lightCollection: "JQ_PRESENTATION_LIGHTS"
    },
    camera: {
      cameraId: "beauty-camera-v1",
      cameraVersion: PHOTOREAL_PRESENTATION_CAMERA_VERSION,
      blenderObjectName: "JQ_PHOTOREAL_BEAUTY_CAMERA",
      type: "PERSP",
      position: { x: -0.85, y: 5.75, z: 1.56 },
      target: { x: 0.05, y: 0.19, z: 1.22 },
      up: [0, 0, 1],
      lensMm: 52,
      sensorWidthMm: 36,
      sensorFit: "HORIZONTAL",
      clipStartM: 0.05,
      clipEndM: 25,
      depthOfField: { enabled: false }
    },
    lights: [
      areaLight("presentation-key-daylight-v1", "JQ_PRESENTATION_KEY_DAYLIGHT", "soft-daylight-key", { x: -2.3, y: 3, z: 2.45 }, { x: -0.25, y: 0.2, z: 1.2 }, [1, 0.93, 0.84], 420, 2.2, 1.6),
      areaLight("presentation-fill-daylight-v1", "JQ_PRESENTATION_FILL_DAYLIGHT", "cool-neutral-fill", { x: 2.2, y: 2.4, z: 1.75 }, { x: 0.35, y: 0.18, z: 1.1 }, [0.84, 0.91, 1], 110, 2.5, 1.8),
      spotLight("presentation-puck-left-v1", "JQ_PRESENTATION_PUCK_LEFT", "warm-puck-left", -1.12395, leftAnchor),
      spotLight("presentation-puck-right-v1", "JQ_PRESENTATION_PUCK_RIGHT", "warm-puck-right", 1.12395, rightAnchor)
    ],
    roomMaterials: [
      roomMaterial("warm-natural-floor-v1", "JQ_PRESENTATION_ROOM_FLOOR", "room-floor", [0.28, 0.22, 0.16], 0.55, 1.5, 0.04, 0.35, { dimensions: "4D", scale: 3.5, detail: 2, roughness: 0.45, w: 0.61, colorVariation: 0.035 }, { enabled: true, strength: 0.12, distanceM: 0.0004, source: "noise-factor" }),
      roomMaterial("warm-off-white-wall-v1", "JQ_PRESENTATION_ROOM_WALL", "room-rear-wall", [0.78, 0.72, 0.64], 0.78, 1.45, 0, 0, { dimensions: "4D", scale: 70, detail: 2, roughness: 0.45, w: 0.37, colorVariation: 0 }, { enabled: true, strength: 0.08, distanceM: 0.0001, source: "noise-factor" })
    ],
    world: {
      worldVersion: PHOTOREAL_PRESENTATION_WORLD_VERSION,
      blenderWorldName: "JQ_BEAUTY_WORLD",
      environmentAssetPath: renderPackage.scene.environment.path,
      environmentSha256: renderPackage.scene.environment.sha256,
      projection: renderPackage.scene.environment.projection,
      interpolation: renderPackage.scene.environment.interpolation,
      colorSpace: renderPackage.scene.environment.colorSpace,
      strength: 0.32,
      rotationEuler: [0, 0, 0.35]
    },
    edgeSoftening: { enabled: false, method: "none-v1", modifierCount: 0 }
  };
}

function createCapture(runtime) {
  return {
    captureId: PHOTOREAL_PRESENTATION_CAPTURE_ID,
    blenderRuntime: clone(runtime),
    renderPolicy: {
      renderVersion: PHOTOREAL_PRESENTATION_RENDER_VERSION,
      engine: "CYCLES",
      blenderEngine: "CYCLES",
      computeDeviceType: "METAL",
      deviceType: "METAL",
      deviceName: "Apple M4 (GPU - 10 cores)",
      sceneDevice: "GPU",
      width: 1920,
      height: 1280,
      resolutionPercentage: 100,
      pixelAspectX: 1,
      pixelAspectY: 1,
      samples: 256,
      adaptiveSampling: true,
      adaptiveThreshold: 0.01,
      adaptiveMinSamples: 32,
      samplingSeed: 170219,
      animatedSeed: false,
      useLightTree: true,
      useGuiding: false,
      maxBounces: 8,
      diffuseBounces: 4,
      glossyBounces: 4,
      transmissionBounces: 6,
      transparentBounces: 4,
      volumeBounces: 0,
      reflectiveCaustics: false,
      refractiveCaustics: false,
      directClamp: 0,
      indirectClamp: 5,
      filterWidth: 1.5,
      denoising: {
        enabled: true,
        denoiser: "OPENIMAGEDENOISE",
        inputPasses: "RGB_ALBEDO_NORMAL",
        prefilter: "ACCURATE",
        quality: "HIGH",
        useGpu: false
      }
    },
    film: { transparent: false, transparentGlass: false, transparentRoughnessThreshold: 0 },
    renderOptions: {
      useCompositing: false,
      useSequencer: false,
      useFileExtension: true,
      useStamp: false,
      useBorder: false,
      useCropToBorder: false,
      ditherIntensity: 1
    },
    colorManagement: {
      displayDevice: "sRGB",
      viewTransform: "AgX",
      look: "AgX - Medium High Contrast",
      exposure: 0,
      gamma: 1,
      useCurveMapping: false
    },
    outputs: [
      { pass: "photoreal-master", filename: PHOTOREAL_OUTPUT_FILENAMES.master, mimeType: "image/png", width: 1920, height: 1280, maxBytes: 268435456, colorMode: "RGB", colorDepth: "16", colorManagement: "FOLLOW_SCENE", compression: 15, quality: null },
      { pass: "photoreal-beauty", filename: PHOTOREAL_OUTPUT_FILENAMES.beauty, mimeType: "image/webp", width: 1920, height: 1280, maxBytes: 67108864, colorMode: "RGB", colorDepth: "8", colorManagement: "FOLLOW_SCENE", compression: null, quality: 92 }
    ]
  };
}

function validateSourceInputs(renderPackage, materialPackage, report, runtime) {
  assert(renderPackage?.identity?.geometryFingerprint === EXPECTED_GEOMETRY_FINGERPRINT, "PHASE6_GEOMETRY_FINGERPRINT_MISMATCH", "Geometry fingerprint drifted.");
  assert(renderPackage?.renderKey === EXPECTED_PRIMARY_PACKAGE_KEY || renderPackage?.packageKey === EXPECTED_PRIMARY_PACKAGE_KEY || renderPackage?.identity?.renderKey === EXPECTED_PRIMARY_PACKAGE_KEY, "PHASE6_PRIMARY_PACKAGE_KEY_MISMATCH", "Primary package key drifted.");
  assert(materialPackage?.materialPackageKey === EXPECTED_MATERIAL_PACKAGE_KEY, "PHASE6_MATERIAL_PACKAGE_KEY_MISMATCH", "Material package key drifted.");
  assert(materialPackage?.capture?.captureKey === EXPECTED_MATERIAL_CAPTURE_KEY, "PHASE6_MATERIAL_CAPTURE_KEY_MISMATCH", "Material capture key drifted.");
  assert(materialPackage?.authority?.customerMaterialApproved === false && materialPackage?.authority?.customerBeautyRenderApproved === false, "CUSTOMER_APPROVAL_FORBIDDEN", "Customer approval flags must remain false.");
  assert(report?.kind === "jq-local-blender-materials-preview-report" && report?.schemaVersion === 1 && report?.status === "succeeded", "PHASE6_REPORT_INVALID", "Phase 6 report is invalid.");
  assert(report?.resultKey === EXPECTED_MATERIAL_RESULT_KEY, "PHASE6_RESULT_KEY_MISMATCH", "Phase 6 result key drifted.");
  assert(report?.materialPackageKey === EXPECTED_MATERIAL_PACKAGE_KEY && report?.captureKey === EXPECTED_MATERIAL_CAPTURE_KEY, "PHASE6_REPORT_IDENTITY_MISMATCH", "Phase 6 report targets another package.");
  assert(deepEqual(report?.counts, EXPECTED_PHASE6_REPORT_COUNTS), "PHASE6_COUNT_MISMATCH", "Phase 6 scene counts drifted.");
  assert(deepEqual(report?.digests, EXPECTED_PHASE6_REPORT_DIGESTS), "PHASE6_DIGEST_MISMATCH", "Phase 6 audit digests drifted.");
  assert(deepEqual(report?.parity, EXPECTED_PHASE6_REPORT_PARITY), "PHASE6_PARITY_FAILED", "Phase 6 parity report is incomplete or not entirely true.");
  validateRuntime(runtime);
}

function validateRuntime(runtime) {
  exactKeys(runtime, RUNTIME_KEYS, "blenderRuntime");
  assert(runtime.version === "5.2.0 LTS" && runtime.buildHash === "fbe6228777e7" && runtime.backend === "METAL" && runtime.vendor === "Apple M4" && runtime.renderer === "Metal API" && runtime.deviceVersion === "1.2", "UNSUPPORTED_BLENDER_RUNTIME", "Phase 7 requires the pinned Blender 5.2 Apple Metal runtime.");
}

function validatePackageShape(value, renderPackage) {
  exactKeys(value.authority, AUTHORITY_KEYS, "authority");
  exactKeys(value.versions, VERSION_KEYS, "versions");
  exactKeys(value.phase6Foundation, FOUNDATION_KEYS, "phase6Foundation");
  exactKeys(value.phase6Foundation.counts, FOUNDATION_COUNT_KEYS, "phase6Foundation.counts");
  exactKeys(value.phase6Foundation.digests, FOUNDATION_DIGEST_KEYS, "phase6Foundation.digests");
  exactKeys(value.presentation, PRESENTATION_KEYS, "presentation");
  exactKeys(value.presentation.collectionPolicy, COLLECTION_KEYS, "presentation.collectionPolicy");
  exactKeys(value.presentation.camera, CAMERA_KEYS, "presentation.camera");
  exactKeys(value.presentation.camera.depthOfField, DOF_KEYS, "presentation.camera.depthOfField");
  validateCamera(value.presentation.camera, renderPackage);
  assert(Array.isArray(value.presentation.lights) && value.presentation.lights.length === 4, "LIGHT_MANIFEST_INVALID", "Exactly four presentation lights are required.");
  const lightIds = new Set();
  for (const [index, light] of value.presentation.lights.entries()) {
    exactKeys(light, LIGHT_KEYS, `presentation.lights[${index}]`);
    safeId(light.lightId, `presentation.lights[${index}].lightId`);
    assert(!lightIds.has(light.lightId), "DUPLICATE_LIGHT_ID", "Presentation light IDs must be unique.");
    lightIds.add(light.lightId);
    point(light.position, `${light.lightId}.position`);
    point(light.target, `${light.lightId}.target`);
    color3(light.color, `${light.lightId}.color`);
    positive(light.energyW, `${light.lightId}.energyW`);
    if (light.anchor !== null) exactKeys(light.anchor, ANCHOR_KEYS, `${light.lightId}.anchor`);
  }
  assert(Array.isArray(value.presentation.roomMaterials) && value.presentation.roomMaterials.length === 2, "ROOM_MATERIALS_INVALID", "Exactly two room materials are required.");
  for (const [index, material] of value.presentation.roomMaterials.entries()) {
    exactKeys(material, ROOM_MATERIAL_KEYS, `presentation.roomMaterials[${index}]`);
    exactKeys(material.parameters, ROOM_PARAMETER_KEYS, `${material.materialId}.parameters`);
    exactKeys(material.parameters.noise, NOISE_KEYS, `${material.materialId}.noise`);
    exactKeys(material.parameters.bump, BUMP_KEYS, `${material.materialId}.bump`);
  }
  exactKeys(value.presentation.world, WORLD_KEYS, "presentation.world");
  exactKeys(value.presentation.edgeSoftening, EDGE_KEYS, "presentation.edgeSoftening");
  exactKeys(value.capture, CAPTURE_KEYS, "capture");
  validateRuntime(value.capture.blenderRuntime);
  exactKeys(value.capture.renderPolicy, RENDER_KEYS, "capture.renderPolicy");
  exactKeys(value.capture.renderPolicy.denoising, DENOISING_KEYS, "capture.renderPolicy.denoising");
  exactKeys(value.capture.film, FILM_KEYS, "capture.film");
  exactKeys(value.capture.renderOptions, RENDER_OPTIONS_KEYS, "capture.renderOptions");
  exactKeys(value.capture.colorManagement, COLOR_MANAGEMENT_KEYS, "capture.colorManagement");
  assert(Array.isArray(value.capture.outputs) && value.capture.outputs.length === 2, "OUTPUT_CONTRACT_INVALID", "Master and WebP contracts are required.");
  value.capture.outputs.forEach((output, index) => exactKeys(output, OUTPUT_KEYS, `capture.outputs[${index}]`));
}

function validateCamera(camera, renderPackage) {
  assert(camera.type === "PERSP" && camera.blenderObjectName !== "JQ_HERO_CAMERA", "PRESENTATION_CAMERA_INVALID", "Beauty camera must be a distinct perspective camera.");
  const position = point(camera.position, "camera.position");
  const target = point(camera.target, "camera.target");
  const up = vector3(camera.up, "camera.up");
  const forward = normalize([target.x - position.x, target.y - position.y, target.z - position.z], "camera.forward");
  const normalizedUp = normalize(up, "camera.up");
  assert(Math.abs(dot(forward, normalizedUp)) < 0.999999, "DEGENERATE_CAMERA", "Camera up is collinear with its viewing direction.");
  assert(camera.position.x !== renderPackage.camera.position.x, "TECHNICAL_CAMERA_REUSED", "Beauty camera must remain independent from the straight-on QA camera.");
  positive(camera.lensMm, "camera.lensMm");
  positive(camera.sensorWidthMm, "camera.sensorWidthMm");
  positive(camera.clipStartM, "camera.clipStartM");
  assert(camera.clipEndM > camera.clipStartM, "INVALID_CAMERA_CLIP", "Camera clip interval is invalid.");
}

function areaLight(lightId, blenderObjectName, role, position, target, color, energyW, sizeM, sizeYM) {
  return {
    lightId, lightingVersion: PHOTOREAL_PRESENTATION_LIGHTING_VERSION, blenderObjectName,
    role, blenderType: "AREA", position, target, color, energyW,
    useShadow: true, normalize: true, diffuseFactor: 1, specularFactor: 1, volumeFactor: 1,
    shape: "RECTANGLE", sizeM, sizeYM, spreadRadians: Math.PI,
    spotSizeRadians: null, spotBlend: null, shadowSoftSizeM: null, anchor: null
  };
}

function spotLight(lightId, blenderObjectName, role, x, anchor) {
  return {
    lightId, lightingVersion: PHOTOREAL_PRESENTATION_LIGHTING_VERSION, blenderObjectName,
    role, blenderType: "SPOT", position: { x, y: 0.28575, z: 2.405 }, target: { x, y: 0.28575, z: 1.4 },
    color: [1, 0.896269353374, 0.737910408773], energyW: 18,
    useShadow: true, normalize: true, diffuseFactor: 1, specularFactor: 1, volumeFactor: 1,
    shape: null, sizeM: null, sizeYM: null, spreadRadians: null,
    spotSizeRadians: 1.2217304764, spotBlend: 0.65, shadowSoftSizeM: 0.025, anchor
  };
}

function puckAnchor(renderPackage, componentId, expectedX) {
  const component = renderPackage.components.find((item) => item.componentId === componentId);
  assert(component, "PUCK_ANCHOR_MISSING", `Missing authoritative puck ${componentId}.`);
  const submesh = component.submeshes.find((item) => item.submeshId === "emissive-lens");
  assert(submesh, "PUCK_LENS_ANCHOR_MISSING", `Missing emissive lens for ${componentId}.`);
  const bounds = submesh.blenderWorldBounds || submesh.bounds;
  assert(bounds?.min && bounds?.max, "PUCK_LENS_BOUNDS_MISSING", `Missing emissive lens bounds for ${componentId}.`);
  const center = Object.fromEntries(["x", "y", "z"].map((axis) => [axis, roundMetric((bounds.min[axis] + bounds.max[axis]) / 2)]));
  assert(Math.abs(center.x - expectedX) <= 1e-12 && Math.abs(center.y - 0.28575) <= 1e-12, "PUCK_ANCHOR_DRIFT", `Puck lens center drifted for ${componentId}.`);
  return {
    componentId,
    primitiveId: `${componentId}/primitive/emissive-lens`,
    submeshId: "emissive-lens",
    objectId: `${componentId}::emissive-lens`,
    materialId: "warm-opal-puck-lens-v1",
    surfaceRole: "emissive-lens",
    center
  };
}

function roomMaterial(materialId, blenderMaterialName, targetObjectId, baseColor, roughness, ior, coatWeight, coatRoughness, noise, bump) {
  return {
    materialId,
    recipeVersion: `${materialId}-recipe-v1`,
    blenderMaterialName,
    targetObjectId,
    declaredColorSpace: "Linear Rec.709",
    externalResources: [],
    trueDisplacement: false,
    parameters: {
      baseColor, metallic: 0, roughness, ior, alpha: 1,
      coatWeight, coatRoughness, transmissionWeight: 0,
      emissionColor: [0, 0, 0], emissionStrength: 0,
      noise, bump
    }
  };
}

function rejectNonFinite(value, path) {
  if (typeof value === "number") assert(Number.isFinite(value), "NON_FINITE_NUMBER", `${path} contains a non-finite number.`);
  if (Array.isArray(value)) value.forEach((item, index) => rejectNonFinite(item, `${path}[${index}]`));
  else if (value && typeof value === "object") Object.entries(value).forEach(([key, item]) => rejectNonFinite(item, `${path}.${key}`));
}

function exactKeys(value, expected, label) {
  assert(value && typeof value === "object" && !Array.isArray(value), "INVALID_OBJECT", `${label} must be an object.`);
  assert(JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort()), "UNKNOWN_OR_MISSING_PROPERTY", `${label} has unknown or missing properties.`);
}

function point(value, label) {
  exactKeys(value, new Set(["x", "y", "z"]), label);
  Object.values(value).forEach((entry) => finite(entry, label));
  return value;
}

function vector3(value, label) {
  assert(Array.isArray(value) && value.length === 3, "INVALID_VECTOR", `${label} must have three values.`);
  value.forEach((entry) => finite(entry, label));
  return value;
}

function color3(value, label) {
  vector3(value, label);
  value.forEach((entry) => assert(entry >= 0 && entry <= 1, "INVALID_COLOR", `${label} channels must be in [0,1].`));
}

function finite(value, label) {
  assert(typeof value === "number" && Number.isFinite(value), "NON_FINITE_NUMBER", `${label} must be finite.`);
  return value;
}

function positive(value, label) {
  finite(value, label);
  assert(value > 0, "NON_POSITIVE_NUMBER", `${label} must be positive.`);
  return value;
}

function safeId(value, label) {
  assert(typeof value === "string" && SAFE_ID_RE.test(value), "INVALID_IDENTIFIER", `${label} is invalid.`);
}

function normalize(value, label) {
  const magnitude = Math.hypot(...value);
  assert(magnitude > 1e-12, "DEGENERATE_VECTOR", `${label} is degenerate.`);
  return value.map((entry) => entry / magnitude);
}

function dot(left, right) {
  return left.reduce((sum, entry, index) => sum + entry * right[index], 0);
}

function roundMetric(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1e12) / 1e12;
}

function keys(value) {
  return new Set(value.split(" "));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepEqual(left, right) {
  return deterministicJson(left) === deterministicJson(right);
}

function deepFreeze(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(deepFreeze));
  if (!value || typeof value !== "object") return value;
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, child]) => [key, deepFreeze(child)])));
}

function normalizeError(error) {
  if (error instanceof PhotorealPresentationContractError) {
    return Object.freeze({ code: error.code, message: error.message, details: Object.freeze([...error.details]) });
  }
  return Object.freeze({ code: "UNEXPECTED_CONTRACT_ERROR", message: error?.message || String(error), details: Object.freeze([]) });
}

function assert(condition, code, message, details = []) {
  if (!condition) throw new PhotorealPresentationContractError(code, message, details);
}
