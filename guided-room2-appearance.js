/**
 * Public Room 2 appearance foundation.
 *
 * This profile is intentionally provisional. It owns presentation around the
 * immutable GLB only; embedded model materials and transforms remain the
 * authority and are never changed here.
 */
export const ROOM2_APPEARANCE_PROFILE = freezeProfileTree({
  schema: "room2-studio-neutral-v1",
  status: "PROVISIONAL — OWNER ACCEPTANCE OPEN",
  asset: {
    url: "assets/models/room2/Room2-Fireplace-bookcases-source-v1.glb",
    bytes: 6712076,
    sha256: "251af4f7cb669976dec9dcaa46905982f9ae085b7bfb30e27e1bf9900a01a8d5",
    geometryFingerprint: "8762fe4326e22e46a163343e5fde410e231d651b48d1b1c9be8391febec8f6ff",
    rawMaterialDigest: "b31d96b3a248fb8d33af236e6e03f414481c907553cbcfbf482ca58a0109676d"
  },
  bounds: {
    min: [-2.389632017629623, -0.0007620000210389378, -1.2329160083543655],
    max: [3.2491679142243868, 2.4383999705868176, 1.0530839641283574],
    center: [0.42976794829738196, 1.2188189852828892, -0.08991602211300409]
  },
  renderer: {
    clearColor: 0xeee9e2,
    colorManagement: {
      enabled: true,
      workingColorSpace: "linear-srgb",
      outputTransformCount: 1
    },
    outputColorSpace: "srgb",
    toneMapping: "aces-filmic",
    exposure: 0.82,
    antialias: true,
    maximumDevicePixelRatio: 2,
    shadows: {
      enabled: true,
      type: "pcf-soft"
    }
  },
  camera: {
    derivation: "Phase 4 public camera authority, fit view; narrow viewports expand distance without changing model transforms",
    target: [0.429768, 1.218819, -0.089916],
    fov: 34,
    near: 0.12,
    far: 80,
    theta: 0,
    phi: 0.17453292519943295,
    minimumFitRadius: 7.100815706850942,
    fitPadding: 1.14,
    minimumRadius: 4.75,
    maximumRadius: 24,
    minimumTheta: -1.05,
    maximumTheta: 1.05,
    minimumPhi: -0.08,
    maximumPhi: 0.74
  },
  lighting: {
    coordinateBasis: "model bounds center plus model-bounds-diagonal units; scene-space and camera-independent",
    contributionMeasurement: {
      schema: "jq-room2-direct-light-contribution-v1",
      target: "QA-only neutral 0.5-sRGB Lambertian plane",
      targetNormal: [0.32303637575875166, 0.9461706154707165, 0.02021549792649756],
      roiNormalized: [0.25, 0.25, 0.5, 0.5],
      outputContract: "no tone mapping; exposure 1; sRGB output decoded to Linear-sRGB Rec.709 luminance"
    },
    environment: {
      type: "three-r166-room-environment-pmrem",
      intensity: 0.55,
      rotationRadians: 0,
      blurSigma: 0.04,
      near: 0.1,
      far: 100,
      maximumGenerationsPerViewer: 1,
      remoteRequests: 0
    },
    key: {
      type: "DirectionalLight",
      sourceSrgb: "#fffaf2",
      runtimeLinearSrgb: [1, 0.955973353, 0.887923118],
      intensity: 1.55,
      nativeIntensityRatio: 1,
      measuredContributionRatio: 1,
      positionBoundsDiagonal: [-0.08, 1.05, 0.9],
      target: "model-bounds-center",
      size: null,
      castShadow: true
    },
    fill: {
      type: "DirectionalLight",
      sourceSrgb: "#f5f8ff",
      runtimeLinearSrgb: [0.913098652, 0.938685728, 1],
      intensity: 0.775,
      nativeIntensityRatio: 0.5,
      measuredContributionRatio: 0.483947428,
      positionBoundsDiagonal: [0.72, 0.72, 0.82],
      target: "model-bounds-center",
      size: null,
      castShadow: false
    },
    rim: {
      type: "DirectionalLight",
      sourceSrgb: "#fff9f3",
      runtimeLinearSrgb: [1, 0.947306537, 0.896269353],
      intensity: 0.341,
      nativeIntensityRatio: 0.22,
      measuredContributionRatio: 0.220904345,
      positionBoundsDiagonal: [0.25, 0.92, -0.9],
      target: "model-bounds-center",
      size: null,
      castShadow: false
    },
    shadows: {
      casterRole: "key",
      maximumCasters: 1,
      fitPaddingBoundsDiagonal: 0.075,
      depthPaddingBoundsDiagonal: 0.12,
      bias: -0.00008,
      normalBias: 0.015,
      updateMode: "static-on-demand",
      tiers: [
        { id: "constrained-phone", maximumCssWidth: 479, mapSize: 1024 },
        { id: "desktop-tablet", maximumCssWidth: null, mapSize: 2048 }
      ]
    }
  },
  ground: {
    enabled: true,
    color: 0xd7cfc4,
    roughness: 1,
    metalness: 0,
    size: 17,
    y: -0.008
  }
});

function freezeProfileTree(candidate) {
  if (candidate === null || typeof candidate !== "object" || Object.isFrozen(candidate)) return candidate;
  Reflect.ownKeys(candidate).forEach((key) => freezeProfileTree(candidate[key]));
  return Object.freeze(candidate);
}
