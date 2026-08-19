/**
 * Public Room 2 commercial PBR review profile.
 *
 * This owns runtime presentation only. The authoritative GLB bytes, geometry,
 * indices, non-UV attributes, transforms, hierarchy, bounds, and dimensions
 * remain immutable. Finish names/swatches are provisional digital targets,
 * never calibrated or approved physical samples.
 */

const ASSET_ROOT = "assets/room2-commercial-pbr-v1/textures";

export const ROOM2_APPEARANCE_PROFILE = freezeProfileTree({
  schema: "room2-commercial-pbr-v1",
  status: "PROVISIONAL DIGITAL APPEARANCE — OWNER ACCEPTANCE OPEN",
  session: {
    definition: "one GuidedRoom2ViewerController lifetime from construction through dispose; a reload or fresh browser context starts a new session",
    successfulModelRequests: 1,
    successfulModelParses: 1,
    failedLoadRetry: "no automatic retry; a failed lazy-family selection can be explicitly reselected in the same ready session to retry only failed texture entries while retaining successful entries; an initial preload, model, or HDR failure stays fail-closed and reload starts a fresh session",
    permanentAnimationLoop: false
  },
  asset: {
    url: "assets/models/room2/Room2-Fireplace-bookcases-source-v1.glb",
    bytes: 6712076,
    sha256: "251af4f7cb669976dec9dcaa46905982f9ae085b7bfb30e27e1bf9900a01a8d5",
    geometryFingerprint: "8762fe4326e22e46a163343e5fde410e231d651b48d1b1c9be8391febec8f6ff",
    rawMaterialDigest: "b31d96b3a248fb8d33af236e6e03f414481c907553cbcfbf482ca58a0109676d",
    embeddedImageAggregate: "6c737d2ff899087b3227f9202dcf95c874474d65dfbc6ec83c778748feced153"
  },
  bounds: {
    full: {
      min: [-2.389632017629623, -0.0007620000210389378, -1.2329160083543655],
      max: [3.2491679142243868, 2.4383999705868176, 1.0530839641283574],
      center: [0.42976794829738196, 1.2188189852828892, -0.08991602211300409]
    },
    hero: {
      basis: "exact union of source materials 1–5; room shell/floor/ceiling excluded",
      min: [-2.2373039143069633, 2.0857664330222823e-11, -1.0805709754306185],
      max: [3.0967679160661703, 2.4383999705680015, -0.4645712013887416],
      size: [5.334071830373134, 2.438399970547144, 0.615999774041877],
      center: [0.4297320008796035, 1.2191999852944295, -0.77257108840968]
    }
  },
  semanticMapping: {
    stableIdentity: "scene index + numeric node-index path + mesh/primitive ordinal + original material index + source accessors + transform/bounds",
    audit: "config/room2-commercial-pbr-v1-semantic-audit.json",
    zones: [
      { originalMaterialIndex: 0, zone: "wall-room-shell", status: "PROVISIONAL", meshRanges: [[0, 6]], finishTarget: false },
      { originalMaterialIndex: 1, zone: "support-hardware", status: "PROVISIONAL", meshRanges: [[7, 9], [12, 20], [30, 41], [60, 71], [87, 95], [97, 99]], finishTarget: false },
      { originalMaterialIndex: 2, zone: "knob-hardware", status: "PROVISIONAL", meshIndices: [10, 11, 29, 42, 58, 59, 96, 100], finishTarget: false },
      { originalMaterialIndex: 3, zone: "millwork", status: "PROVEN", meshRanges: [[21, 28], [43, 57], [72, 86], [101, 178], [181, 182]], finishTarget: true },
      { originalMaterialIndex: 4, zone: "fireplace-appliance-frame", status: "PROVISIONAL", meshIndices: [179], finishTarget: false },
      { originalMaterialIndex: 5, zone: "fire-emissive-surface", status: "PROVISIONAL", meshIndices: [180], finishTarget: false },
      { originalMaterialIndex: 6, zone: "floor", status: "PROVISIONAL", meshIndices: [183], finishTarget: false },
      { originalMaterialIndex: 7, zone: "ceiling-room-shell", status: "PROVISIONAL", meshIndices: [184], finishTarget: false }
    ],
    publishedFinishMaterialIndex: 3,
    publishedFinishPrimitiveCount: 118,
    unresolvedHeroPrimitiveCount: 0,
    millworkRoleMeshIndices: {
      "cabinet-door": [21, 28, 44, 47, 73, 78, 101, 105],
      "back-panel": [22, 46, 79, 107, 115, 118, 138, 140, 145, 147, 168, 173],
      "end-panel": [23, 24, 49, 50, 72, 75, 103, 106, 113, 114, 116, 117, 125, 126, 127, 130, 144, 146, 148, 149, 169, 170, 172, 176],
      "top-panel": [25, 48, 56, 76, 84, 102, 123, 124, 128, 129, 157, 159, 171, 174],
      "bottom-panel": [26, 43, 57, 74, 82, 108],
      shelf: [27, 45, 77, 104, 109, 110, 111, 112, 131, 132, 133, 134, 150, 152, 153, 156, 161, 163, 167, 175],
      stile: [51, 52, 80, 81, 141, 142, 143, 160, 177, 178],
      trim: [53, 54, 55, 83, 85, 86],
      "side-member": [119, 120, 136, 137, 151, 154, 162, 165],
      "top-rail": [121, 139, 155, 166],
      nailer: [122, 135, 158, 164],
      "toe-skin": [181, 182]
    },
    millworkRoleBasis: "exact audited mesh index within the PROVEN material-3 authority; hierarchy names remain supporting evidence only",
    fireplaceLimitation: "No distinct surround/hearth material slot exists; material 4 remains one combined fireplace appliance/frame surface."
  },
  materials: {
    implementation: "MeshStandardMaterial",
    physicalMaterialUses: 0,
    preserveSourceProperties: [
      "alpha mode", "transparency", "opacity", "alpha test/hash", "sidedness",
      "depth flags", "blending", "visibility", "original primitive/material-slot cardinality"
    ],
    texturePipeline: {
      format: "local WebP fallback",
      ktx2: false,
      ktx2Reason: "No pinned repository KTX2 encoder and no available toktx/basisu tool; no system install performed.",
      dimensions: [512, 512],
      mipmaps: "runtime complete mip chain",
      minFilter: "LinearMipmapLinearFilter",
      magFilter: "LinearFilter",
      wrapping: "RepeatWrapping",
      colorRoles: { baseColor: "sRGB", normal: "NoColorSpace", roughness: "NoColorSpace" },
      anisotropy: { desktopTabletMaximum: 8, phoneMaximum: 4, capabilityClamped: true },
      cache: "one request and one source texture per shared family map per successful viewer session"
    },
    families: {
      oak: {
        ids: ["white-oak", "natural-oak"],
        loadPolicy: "selected family before reveal; lazy once otherwise; retained for viewer session",
        maps: {
          map: `${ASSET_ROOT}/oak/base-color.webp`,
          normalMap: `${ASSET_ROOT}/oak/normal.webp`,
          roughnessMap: `${ASSET_ROOT}/oak/roughness.webp`
        },
        bytes: { map: 20074, normalMap: 233944, roughnessMap: 156034, total: 410052 },
        sourceDimensions: [512, 512],
        repeatMeters: [2.4384, 2.4384],
        authoredUvRepeat: [0.25, 0.25],
        normalScale: [0.16, 0.16]
      },
      walnut: {
        ids: ["light-walnut", "medium-walnut", "dark-walnut"],
        loadPolicy: "selected family before reveal; lazy once otherwise; retained for viewer session",
        maps: {
          map: `${ASSET_ROOT}/walnut/base-color.webp`,
          roughnessMap: `${ASSET_ROOT}/walnut/roughness.webp`
        },
        bytes: { map: 66382, roughnessMap: 65572, total: 131954 },
        sourceDimensions: [512, 512],
        repeatMeters: [2.4384, 2.4384],
        authoredUvRepeat: [0.25, 0.25],
        normalScale: [0, 0]
      },
      paint: {
        ids: ["shop-primed", "warm-white", "soft-ivory", "sage-gray", "charcoal", "light-greige"],
        loadPolicy: "selected family before reveal; lazy once otherwise; retained for viewer session",
        maps: {
          normalMap: `${ASSET_ROOT}/paint/normal.webp`,
          roughnessMap: `${ASSET_ROOT}/paint/roughness.webp`
        },
        bytes: { normalMap: 134340, roughnessMap: 64074, total: 198414 },
        sourceDimensions: [512, 512],
        repeatMeters: [0.0762, 0.0762],
        authoredUvRepeat: [8, 8],
        normalScale: [0.055, 0.055]
      }
    },
    finishes: {
      "white-oak": { id: "white-oak", label: "White Oak", family: "oak", swatch: "#d9c0a0", calibratedMultiplier: "#ede4d7", roughnessFactor: 0.78 },
      "natural-oak": { id: "natural-oak", label: "Natural Oak", family: "oak", swatch: "#b88e5e", calibratedMultiplier: "#cbb995", roughnessFactor: 0.74 },
      "light-walnut": { id: "light-walnut", label: "Light Walnut", family: "walnut", swatch: "#9a7048", calibratedMultiplier: "#d1a27c", roughnessFactor: 0.94 },
      "medium-walnut": { id: "medium-walnut", label: "Medium Walnut", family: "walnut", swatch: "#775238", calibratedMultiplier: "#aa7358", roughnessFactor: 0.9 },
      "dark-walnut": { id: "dark-walnut", label: "Dark Walnut", family: "walnut", swatch: "#4b372c", calibratedMultiplier: "#765145", roughnessFactor: 0.88 },
      "shop-primed": { id: "shop-primed", label: "Shop-Primed", family: "paint", swatch: "#e7e3dc", calibratedMultiplier: "#d7d3cb", roughnessFactor: 1 },
      "warm-white": { id: "warm-white", label: "Warm White", family: "paint", swatch: "#f3f0e9", calibratedMultiplier: "#d9d5cc", roughnessFactor: 1 },
      "soft-ivory": { id: "soft-ivory", label: "Soft Ivory", family: "paint", swatch: "#e8dfd0", calibratedMultiplier: "#d1c7b8", roughnessFactor: 1 },
      "sage-gray": { id: "sage-gray", label: "Sage Gray", family: "paint", swatch: "#89918a", calibratedMultiplier: "#89918a", roughnessFactor: 1 },
      "charcoal": { id: "charcoal", label: "Charcoal", family: "paint", swatch: "#343638", calibratedMultiplier: "#343638", roughnessFactor: 0.96 },
      "light-greige": { id: "light-greige", label: "Light Greige", family: "paint", swatch: "#b9b6ad", calibratedMultiplier: "#b9b6ad", roughnessFactor: 1, legacy: true }
    },
    grain: {
      authoredMetersPerRepeat: 0.6096,
      textureTransformPolicy: "Texture clones share one Source; sampler state is identical; stable orientation/phase changes never duplicate network payloads.",
      roles: {
        "cabinet-door": { axis: "V", orientation: "vertical", rotationRadians: 0 },
        shelf: { axis: "U", orientation: "long-axis", rotationRadians: 1.5707963267948966 },
        stile: { axis: "U", orientation: "vertical", rotationRadians: 1.5707963267948966 },
        "end-panel": { axis: "U", orientation: "vertical", rotationRadians: 1.5707963267948966 },
        "back-panel": { axis: "U", orientation: "vertical", rotationRadians: 1.5707963267948966 },
        "top-panel": { axis: "U", orientation: "long-axis", rotationRadians: 1.5707963267948966 },
        "bottom-panel": { axis: "U", orientation: "long-axis", rotationRadians: 1.5707963267948966 },
        nailer: { axis: "U", orientation: "long-axis", rotationRadians: 1.5707963267948966 },
        "toe-skin": { axis: "U", orientation: "long-axis", rotationRadians: 1.5707963267948966 },
        trim: { axis: "U", orientation: "long-axis", rotationRadians: 1.5707963267948966 },
        "side-member": { axis: "U", orientation: "vertical", rotationRadians: 1.5707963267948966 },
        "top-rail": { axis: "U", orientation: "long-axis", rotationRadians: 1.5707963267948966 },
        default: { axis: "U", orientation: "long-axis", rotationRadians: 1.5707963267948966 }
      },
      stablePhaseBuckets: 997,
      phaseStep: [0.61803398875, 0.41421356237],
      stableCutVariation: "FNV-1a stable-primitive hash selects 997 phase buckets plus an axis-preserving 180-degree cut turn; no runtime UV mirroring or random runtime state",
      sourceUvMutation: "none",
      tangentAppend: "none",
      tangentBasis: "Three r166 derivative tangent basis"
    },
    surfaceRecipes: {
      "wall-room-shell": { color: "#e7e1d8", metalness: 0, roughness: 0.94, preserveSourceMap: true, castShadow: false, receiveShadow: true },
      "support-hardware": { color: "#3d4142", metalness: 1, roughness: 0.38, preserveSourceMap: false, castShadow: true, receiveShadow: true },
      "knob-hardware": { color: "#9b7a52", metalness: 1, roughness: 0.3, preserveSourceMap: true, castShadow: true, receiveShadow: true },
      "fireplace-appliance-frame": { color: "#17191a", metalness: 0, roughness: 0.34, preserveSourceMap: false, castShadow: true, receiveShadow: true },
      "fire-emissive-surface": { color: "#ffffff", metalness: 0, roughness: 0.68, preserveSourceMap: true, emissive: "#b64118", emissiveIntensity: 0.62, emissiveUsesBaseMap: true, castShadow: false, receiveShadow: false },
      floor: { color: "#fffaf4", metalness: 0, roughness: 0.72, preserveSourceMap: true, castShadow: false, receiveShadow: true },
      "ceiling-room-shell": { color: "#f0ece5", metalness: 0, roughness: 0.96, preserveSourceMap: true, castShadow: false, receiveShadow: true }
    }
  },
  renderer: {
    clearColor: 0xf0ece6,
    colorManagement: { enabled: true, workingColorSpace: "linear-srgb", outputTransformCount: 1 },
    outputColorSpace: "srgb",
    antialias: true,
    maximumDevicePixelRatio: 2,
    renderMode: "on-demand",
    postProcessing: { enabled: false, chain: ["WebGLRenderer beauty pass"], outputPassCount: 0 },
    gtao: { enabled: false, reason: "Direct shadow/contact depth retained stronger neutral color and lower frame cost in the final material-aware comparison." },
    shadows: { enabled: true, type: "pcf-soft" }
  },
  camera: {
    derivation: "semantic heroBounds projection fit; fixed geometry and transforms",
    target: [0.4297320008796035, 1.2191999852944295, -0.77257108840968],
    fov: 39,
    filmGauge: 35,
    expectedFocalLengthMillimeters: 49.418475,
    near: 0.12,
    far: 80,
    theta: 0,
    phi: 0.115,
    minimumFitRadius: 4.1,
    minimumRadius: 5.2,
    maximumRadius: 22,
    minimumTheta: -1.05,
    maximumTheta: 1.05,
    minimumPhi: -0.08,
    maximumPhi: 0.72,
    occupancyTiers: [
      { id: "phone", maximumViewportWidth: 599, targetWidth: 0.92, acceptedWidth: [0.88, 0.96] },
      { id: "tablet", maximumViewportWidth: 1199, targetWidth: 0.87, acceptedWidth: [0.82, 0.92] },
      { id: "desktop", maximumViewportWidth: null, targetWidth: 0.83, acceptedWidth: [0.78, 0.88] }
    ],
    closestDetailRadius: 5.2,
    resetDeterministic: true
  },
  environment: {
    type: "local-rgbe-equirectangular-pmrem",
    url: "assets/environments/jq-neutral-studio.hdr",
    bytes: 1341884,
    sha256: "0ff81b73774abc781428340a56a0c0170447c7919be9b451c05cf15b4c90a931",
    dimensions: [1536, 768],
    colorSpace: "LinearSRGBColorSpace",
    visibleBackground: false,
    maximumGenerationsPerViewer: 1,
    remoteRequests: 0
  },
  lighting: {
    coordinateBasis: "scene-space meters around semantic heroBounds; camera-independent",
    rectAreaUniformsInitialization: "same-revision RectAreaLightUniformsLib.init() exactly once before material compilation",
    semanticRoleCount: 2,
    directLightObjectCount: 3,
    maximumShadowCasters: 1,
    key: {
      semanticRole: "broad key plus compensated shadow proxy",
      area: { type: "RectAreaLight", color: "#fff8ef", intensity: 5.2, width: 4.8, height: 3.4, position: [-2.4, 4.8, 3.6], target: "heroBounds-center", castShadow: false },
      shadowProxy: { type: "DirectionalLight", color: "#fff8ef", intensity: 0.42, position: [-3.8, 5.6, 4.2], target: "heroBounds-center", castShadow: true, compensation: "area-key intensity was tuned with this 0.42 direct contribution present" }
    },
    fill: {
      semanticRole: "broad restrained fill",
      area: { type: "RectAreaLight", color: "#eef4ff", intensity: 2.15, width: 3.8, height: 3, position: [4.1, 1.55, 2.4], target: "heroBounds-center", castShadow: false }
    },
    shadows: {
      casterRole: "key.shadowProxy",
      updateMode: "static-on-demand",
      fitPaddingMeters: 0.42,
      depthPaddingMeters: 1.2,
      bias: -0.00008,
      normalBias: 0.012,
      tiers: [
        { id: "constrained-phone", maximumCssWidth: 479, mapSize: 1024 },
        { id: "desktop-tablet", maximumCssWidth: null, mapSize: 2048 }
      ]
    }
  },
  presentation: {
    selected: "neutral-balanced",
    evidenceOnlyHostnames: ["127.0.0.1", "localhost"],
    sweeps: {
      "aces-soft": { id: "aces-soft", toneMapping: "aces-filmic", exposure: 0.9, environmentIntensity: 0.82, environmentRotationRadians: 0.28, areaKeyScale: 0.94, areaFillScale: 0.92, shadowProxyScale: 0.94 },
      "neutral-balanced": { id: "neutral-balanced", toneMapping: "neutral", exposure: 1.02, environmentIntensity: 0.92, environmentRotationRadians: 0.52, areaKeyScale: 1, areaFillScale: 1, shadowProxyScale: 1 },
      "neutral-reflective": { id: "neutral-reflective", toneMapping: "neutral", exposure: 0.96, environmentIntensity: 1.08, environmentRotationRadians: 0.92, areaKeyScale: 0.88, areaFillScale: 0.82, shadowProxyScale: 0.9 }
    }
  }
});

export function resolveRoom2Finish(finishId) {
  return ROOM2_APPEARANCE_PROFILE.materials.finishes[finishId]
    || ROOM2_APPEARANCE_PROFILE.materials.finishes["natural-oak"];
}

export function resolveRoom2Presentation(locationLike = globalThis.location) {
  const selected = ROOM2_APPEARANCE_PROFILE.presentation.selected;
  const hostname = String(locationLike?.hostname || "");
  const query = new URLSearchParams(String(locationLike?.search || ""));
  const evidenceOverrideAllowed = ROOM2_APPEARANCE_PROFILE.presentation.evidenceOnlyHostnames.includes(hostname)
    && query.get("room2Evidence") === "1";
  const requested = evidenceOverrideAllowed ? query.get("room2Presentation") : null;
  return ROOM2_APPEARANCE_PROFILE.presentation.sweeps[requested]
    || ROOM2_APPEARANCE_PROFILE.presentation.sweeps[selected];
}

export function resolveRoom2SemanticZone(originalMaterialIndex) {
  return ROOM2_APPEARANCE_PROFILE.semanticMapping.zones.find(
    (zone) => zone.originalMaterialIndex === originalMaterialIndex
  ) || null;
}

function freezeProfileTree(candidate) {
  if (candidate === null || typeof candidate !== "object" || Object.isFrozen(candidate)) return candidate;
  Reflect.ownKeys(candidate).forEach((key) => freezeProfileTree(candidate[key]));
  return Object.freeze(candidate);
}
