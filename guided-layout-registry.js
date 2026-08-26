const PRODUCT_ID = "cabinet-shelves";
const INCH_METERS = 0.02539999969303608;
const MM_PER_INCH = 25.4;

const control = (definition) => ({
  id: "adjustable-shelf-clearance",
  label: "Adjustable shelf clearance",
  shortLabel: "Shelf clearance",
  operation: "rigid-node-translation",
  axis: "local-z",
  internalUnit: "millimeter",
  displayUnit: "inch",
  status: "PROVEN",
  previewOnly: true,
  stepMillimeters: 6.35,
  toleranceMillimeters: 0.25,
  sourceScaleMetersPerLocalUnit: INCH_METERS,
  formula: "target.translation.z = nativeTranslationZ + (clearanceMm - nativeClearanceMm) / (1000 * 0.02539999969303608)",
  limitingBoundary: "The fixed upper adjustable shelf lower face; the lower adjustable shelf upper face defines zero clearance.",
  collisionProof: "The closed endpoints touch adjacent shelf faces without volumetric penetration; no design clearance is inferred.",
  invariant: "Only the target node local translation.z may change. Rotation, scale, mesh/accessors, thickness, X/Z world bounds, hardware, and every other node transform remain native.",
  disclaimer: "Preview only — final dimensions require design confirmation.",
  ...definition
});

const layout = (definition) => ({
  productId: PRODUCT_ID,
  runtimeDerivative: null,
  rendererSupport: {
    webgpu: "supported-when-navigator-gpu-is-available",
    webgl2: "supported-forced-and-fallback"
  },
  currentAuthorityStatus: "INTERACTIVE PREVIEW ONLY — NOT MANUFACTURING AUTHORITY",
  coordinateSystem: "glTF 2.0 right-handed, +Y up, meters after native SimLab inch scale",
  units: {
    gltf: "meter",
    sourceAuthoringEvidence: "inch",
    sourceScaleMetersPerLocalUnit: INCH_METERS
  },
  appearanceManifest: {
    initializeFromEmbeddedSource: true,
    status: "PROVISIONAL DIGITAL APPEARANCE — OWNER ACCEPTANCE OPEN",
    automaticFinishMapping: "blocked-unless-explicitly-proven",
    provenMeshIndices: [],
    materialZoneAudit: "config/immersive-layout-material-zones-v1.json",
    materialZoneAuditSchema: "jq-immersive-layout-material-zones-v1",
    disclaimer: "Digital preview only. Final dimensions and finishes require design confirmation."
  },
  ...definition
});

export const IMMERSIVE_LAYOUT_ORDER = Object.freeze([
  "fireplace-wall",
  "door-wall",
  "window-wall"
]);

export const IMMERSIVE_LAYOUT_REGISTRY = deepFreeze({
  "fireplace-wall": layout({
    layoutId: "fireplace-wall",
    label: "Fireplace Wall",
    roomId: "room2",
    authoritativeSource: {
      path: "assets/models/room2/Room2-Fireplace-bookcases-source-v1.glb",
      bytes: 6712076,
      sha256: "251af4f7cb669976dec9dcaa46905982f9ae085b7bfb30e27e1bf9900a01a8d5",
      sourceContractFingerprint: "8762fe4326e22e46a163343e5fde410e231d651b48d1b1c9be8391febec8f6ff",
      geometryTopologyTransformFingerprintNoMaterial: "63f9753290f89c234758a14ae5a67165c1a4708a3a9f34e7519435d2511e4022"
    },
    runtimeAsset: {
      path: "assets/models/room2/Room2-Fireplace-bookcases-source-v1.glb",
      bytes: 6712076,
      sha256: "251af4f7cb669976dec9dcaa46905982f9ae085b7bfb30e27e1bf9900a01a8d5"
    },
    iosTextureDecode: {
      floorImageIndex: 4,
      sourceBytes: 5990740,
      sourceSha256: "2b44ffa512f19f55d6f48ee153173affd1234ce1911ecd52256635ec6daf39f9",
      sourcePixels: [2000, 2000],
      path: "assets/premium-model-v1/textures/floor/source-maple-floor-ios-v1.jpg",
      bytes: 266509,
      sha256: "b00f0d09491740919a22fd86b9e1cb3b77c5bc5d3110f25f880707007b5b18cd",
      pixels: [1024, 1024]
    },
    sourceMetadata: {
      generator: "SimLab GLTF",
      gltfVersion: "2.0",
      nodes: 455,
      meshes: 185,
      primitives: 185,
      materials: 8,
      images: 6,
      textures: 6,
      accessors: 556,
      vertices: 33934,
      triangles: 18306,
      nativeDegenerateTriangles: 115,
      legacyExtensionsUsed: ["KHR_materials_pbrSpecularGlossiness"]
    },
    nativeBounds: {
      min: [-2.389632018, -0.000762, -1.232916008],
      max: [3.249167914, 2.438399971, 1.053083964]
    },
    heroBounds: {
      min: [-2.237304, 0, -1.080571],
      max: [3.096768, 2.4384, -0.464571]
    },
    orbitTarget: [0.429732, 1.2192, -0.772571],
    initialCamera: { theta: 0, phi: 0.115, fovDegrees: 39 },
    thumbnail: "assets/photos/configurator/layout-model-thumbnails/fireplace-wall-premium-v1.webp",
    appearanceManifest: {
      initializeFromEmbeddedSource: true,
      status: "PROVISIONAL DIGITAL APPEARANCE — OWNER ACCEPTANCE OPEN",
      automaticFinishMapping: "exact audited Fireplace mesh-index allowlist",
      provenMeshIndices: [
        21,22,23,24,25,26,27,28,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,
        72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,101,102,103,104,105,106,
        107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,
        125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,
        143,144,145,146,147,148,149,150,151,152,153,154,155,156,157,158,159,160,
        161,162,163,164,165,166,167,168,169,170,171,172,173,174,175,176,177,178,
        181,182
      ],
      materialZoneAudit: "config/immersive-layout-material-zones-v1.json",
      materialZoneAuditSchema: "jq-immersive-layout-material-zones-v1",
      disclaimer: "Digital preview only. Final dimensions and finishes require design confirmation."
    },
    semanticManifest: {
      stableIdentity: "source SHA + index-qualified node path",
      lowerAnchorPath: "/0:<unnamed>/1:Assembly-265/400:Wall Hutch/401:Adjustable Shelf",
      targetPath: "/0:<unnamed>/1:Assembly-265/400:Wall Hutch/429:Adjustable Shelf",
      upperAnchorPath: "/0:<unnamed>/1:Assembly-265/400:Wall Hutch/405:Adjustable Shelf",
      lowerAnchorNodeIndex: 401,
      targetNodeIndex: 429,
      targetMeshNodeIndex: 430,
      targetMeshIndex: 175,
      upperAnchorNodeIndex: 405,
      lowerAnchorMeshNodeIndex: 402,
      lowerAnchorMeshIndex: 161,
      upperAnchorMeshNodeIndex: 406,
      upperAnchorMeshIndex: 163,
      targetPrimitiveIndex: 0,
      targetMaterialIndex: 3,
      targetAccessors: { indices: 517, POSITION: 518, NORMAL: 519, TEXCOORD_0: 520 },
      nativeTargetWorldBounds: { min: [-2.185043345, 1.508500007, -1.042548003], max: [-1.299091329, 1.533900007, -0.797946004] }
    },
    geometryControlManifest: {
      "adjustable-shelf-clearance": control({
        nativeTranslationZ: 26.8897647858,
        nativeTargetBottomMillimeters: 1508.500007,
        targetThicknessMillimeters: 25.399999704,
        minMillimeters: 0,
        nativeMillimeters: 265.500022,
        maxMillimeters: 531.000043,
        lowerAnchorTopMillimeters: 1242.999986,
        upperAnchorBottomMillimeters: 1799.400029
      })
    },
    dimensionSupportMatrix: { "adjustable-shelf-clearance": "PROVEN", spans: "BLOCKED", openings: "BLOCKED", height: "BLOCKED", depth: "BLOCKED" }
  }),
  "door-wall": layout({
    layoutId: "door-wall",
    label: "Door Wall",
    roomId: "room2",
    authoritativeSource: {
      path: "assets/models/room2/jq-door-wall-bookcase-room2-authoritative-v01.glb",
      bytes: 6755128,
      sha256: "4969169cb29bcf51a72a2db6c4cd83631cd94c7d78154bc37558ee9adaba98cb",
      sourceContractFingerprint: "302ad57c1f7360966fb42714b2fd8c519f64856586eba632bf2f89427f2bc4d8",
      geometryTopologyTransformFingerprintNoMaterial: "a110cfc8ec18e8b3cc9ee8b1bf872fdf56062b69f90abd65df17656d58bf57e2"
    },
    runtimeAsset: {
      path: "assets/models/room2/jq-door-wall-bookcase-room2-authoritative-v01.glb",
      bytes: 6755128,
      sha256: "4969169cb29bcf51a72a2db6c4cd83631cd94c7d78154bc37558ee9adaba98cb"
    },
    iosTextureDecode: {
      floorImageIndex: 5,
      sourceBytes: 5990740,
      sourceSha256: "2b44ffa512f19f55d6f48ee153173affd1234ce1911ecd52256635ec6daf39f9",
      sourcePixels: [2000, 2000],
      path: "assets/premium-model-v1/textures/floor/source-maple-floor-ios-v1.jpg",
      bytes: 266509,
      sha256: "b00f0d09491740919a22fd86b9e1cb3b77c5bc5d3110f25f880707007b5b18cd",
      pixels: [1024, 1024]
    },
    sourceMetadata: {
      generator: "SimLab GLTF", gltfVersion: "2.0", nodes: 317, meshes: 127,
      primitives: 127, materials: 10, images: 7, textures: 7, accessors: 368, vertices: 29281,
      triangles: 15017, nativeDegenerateTriangles: 85, legacyExtensionsUsed: ["KHR_materials_pbrSpecularGlossiness"]
    },
    nativeBounds: { min: [-1.844293993, -0.000762, -1.092872911], max: [2.01650596, 2.438399971, 0.608330012] },
    heroBounds: { min: [-1.691894, -0.000127, -1.092873], max: [1.86417, 2.4384, -0.368031] },
    orbitTarget: [0.086138, 1.219136, -0.730452],
    initialCamera: { theta: 0, phi: 0.115, fovDegrees: 39 },
    thumbnail: "assets/photos/configurator/layout-model-thumbnails/door-wall-premium-v1.webp",
    semanticManifest: {
      stableIdentity: "source SHA + index-qualified node path",
      lowerAnchorPath: "/0:<unnamed>/1:Assembly-185/121:Wall Hutch/130:Adjustable Shelf",
      targetPath: "/0:<unnamed>/1:Assembly-185/121:Wall Hutch/138:Adjustable Shelf",
      upperAnchorPath: "/0:<unnamed>/1:Assembly-185/121:Wall Hutch/140:Adjustable Shelf",
      lowerAnchorNodeIndex: 130, targetNodeIndex: 138, targetMeshNodeIndex: 139,
      targetMeshIndex: 54, upperAnchorNodeIndex: 140,
      lowerAnchorMeshNodeIndex: 131, lowerAnchorMeshIndex: 50,
      upperAnchorMeshNodeIndex: 141, upperAnchorMeshIndex: 55,
      targetPrimitiveIndex: 0, targetMaterialIndex: 1,
      targetAccessors: { indices: 153, POSITION: 154, NORMAL: 155, TEXCOORD_0: 156 },
      nativeTargetWorldBounds: { min: [-1.63931581, 1.446200032, -0.877695277], max: [-0.664717849, 1.471600031, -0.633093277] }
    },
    geometryControlManifest: {
      "adjustable-shelf-clearance": control({
        nativeTranslationZ: 25.9370098114,
        nativeTargetBottomMillimeters: 1446.200032,
        targetThicknessMillimeters: 25.399999704,
        minMillimeters: 0,
        nativeMillimeters: 304.800045,
        maxMillimeters: 609.599993,
        lowerAnchorTopMillimeters: 1141.399987,
        upperAnchorBottomMillimeters: 1776.399979
      })
    },
    dimensionSupportMatrix: { "adjustable-shelf-clearance": "PROVEN", spans: "BLOCKED", openings: "BLOCKED", height: "BLOCKED", depth: "BLOCKED" }
  }),
  "window-wall": layout({
    layoutId: "window-wall",
    label: "Window Wall",
    roomId: "room4",
    authoritativeSource: {
      path: "assets/models/room4/jq-window-wall-bookcases-cabinets-room4-authoritative-v01.glb",
      bytes: 6993036,
      sha256: "631005c025324c5162de6e414267101d6260d58c6198d561e6799568cef1fd24",
      sourceContractFingerprint: "0f339076140a88e3942b220fcb217bbf3133876717149cba0522bc1e0b539e9c",
      geometryTopologyTransformFingerprintNoMaterial: "9110cea6105192e04f4159fa3cc7e16271a339a014d5e260c0241a0f5eb0df3b"
    },
    runtimeAsset: {
      path: "assets/models/room4/jq-window-wall-bookcases-cabinets-room4-authoritative-v01.glb",
      bytes: 6993036,
      sha256: "631005c025324c5162de6e414267101d6260d58c6198d561e6799568cef1fd24"
    },
    iosTextureDecode: {
      floorImageIndex: 6,
      sourceBytes: 5990740,
      sourceSha256: "2b44ffa512f19f55d6f48ee153173affd1234ce1911ecd52256635ec6daf39f9",
      sourcePixels: [2000, 2000],
      path: "assets/premium-model-v1/textures/floor/source-maple-floor-ios-v1.jpg",
      bytes: 266509,
      sha256: "b00f0d09491740919a22fd86b9e1cb3b77c5bc5d3110f25f880707007b5b18cd",
      pixels: [1024, 1024]
    },
    sourceMetadata: {
      generator: "SimLab GLTF", gltfVersion: "2.0", nodes: 442, meshes: 182,
      primitives: 182, materials: 10, images: 8, textures: 8, accessors: 544, vertices: 36916,
      triangles: 19244, nativeDegenerateTriangles: 146, legacyExtensionsUsed: ["KHR_materials_pbrSpecularGlossiness"]
    },
    nativeBounds: { min: [-2.620517922, -0.000762, -1.194332608], max: [0.732281989, 2.438399971, 0.506983971] },
    heroBounds: { min: [-2.467993, 0, -1.194333], max: [0.580136, 2.4384, -0.46949] },
    orbitTarget: [-0.943928, 1.2192, -0.831912],
    initialCamera: { theta: 0, phi: 0.115, fovDegrees: 39 },
    thumbnail: "assets/photos/configurator/layout-model-thumbnails/window-wall-premium-v1.webp",
    semanticManifest: {
      stableIdentity: "source SHA + index-qualified node path",
      lowerAnchorPath: "/0:<unnamed>/1:Assembly-254/238:Wall Hutch/247:Adjustable Shelf",
      targetPath: "/0:<unnamed>/1:Assembly-254/238:Wall Hutch/249:Adjustable Shelf",
      upperAnchorPath: "/0:<unnamed>/1:Assembly-254/238:Wall Hutch/251:Adjustable Shelf",
      lowerAnchorNodeIndex: 247, targetNodeIndex: 249, targetMeshNodeIndex: 250,
      targetMeshIndex: 100, upperAnchorNodeIndex: 251,
      lowerAnchorMeshNodeIndex: 248, lowerAnchorMeshIndex: 99,
      upperAnchorMeshNodeIndex: 252, upperAnchorMeshIndex: 101,
      targetPrimitiveIndex: 0, targetMaterialIndex: 3,
      targetAccessors: { indices: 265, POSITION: 266, NORMAL: 267, TEXCOORD_0: 268 },
      nativeTargetWorldBounds: { min: [-2.415478405, 1.446200032, -0.979155023], max: [-1.536130443, 1.471600031, -0.734553023] }
    },
    geometryControlManifest: {
      "adjustable-shelf-clearance": control({
        nativeTranslationZ: 25.9370098114,
        nativeTargetBottomMillimeters: 1446.200032,
        targetThicknessMillimeters: 25.399999704,
        minMillimeters: 0,
        nativeMillimeters: 304.800045,
        maxMillimeters: 609.599993,
        lowerAnchorTopMillimeters: 1141.399987,
        upperAnchorBottomMillimeters: 1776.399979
      })
    },
    dimensionSupportMatrix: { "adjustable-shelf-clearance": "PROVEN", spans: "BLOCKED", openings: "BLOCKED", height: "BLOCKED", depth: "BLOCKED" }
  })
});

export function getImmersiveLayout(layoutId) {
  return IMMERSIVE_LAYOUT_REGISTRY[layoutId] || null;
}

export function getSmartDimensionDefaults(layoutId) {
  const record = getImmersiveLayout(layoutId);
  return Object.fromEntries(Object.values(record?.geometryControlManifest || {}).map((entry) => [entry.id, entry.nativeMillimeters]));
}

export function normalizeSmartDimension(layoutId, controlId, value) {
  const definition = getImmersiveLayout(layoutId)?.geometryControlManifest?.[controlId];
  if (!definition) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return definition.nativeMillimeters;
  const clamped = Math.min(definition.maxMillimeters, Math.max(definition.minMillimeters, numeric));
  if (Math.abs(clamped - definition.minMillimeters) < definition.stepMillimeters / 2) return definition.minMillimeters;
  if (Math.abs(clamped - definition.maxMillimeters) < definition.stepMillimeters / 2) return definition.maxMillimeters;
  if (Math.abs(clamped - definition.nativeMillimeters) < definition.stepMillimeters / 2) return definition.nativeMillimeters;
  const snapped = definition.nativeMillimeters
    + Math.round((clamped - definition.nativeMillimeters) / definition.stepMillimeters) * definition.stepMillimeters;
  return Number(Math.min(definition.maxMillimeters, Math.max(definition.minMillimeters, snapped)).toFixed(6));
}

export function millimetersToInches(value) {
  return Number(value) / MM_PER_INCH;
}

export function inchesToMillimeters(value) {
  return Number(value) * MM_PER_INCH;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
