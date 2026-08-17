/**
 * Public Room 2 appearance foundation.
 *
 * This profile is intentionally provisional. It owns presentation around the
 * immutable GLB only; embedded model materials and transforms remain the
 * authority and are never changed here.
 */
export const ROOM2_APPEARANCE_PROFILE = freezeProfileTree({
  schema: "jq-room2-public-appearance-v1",
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
    outputColorSpace: "srgb",
    toneMapping: "aces-filmic",
    exposure: 1.02,
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
    hemisphere: { sky: 0xfffbf4, ground: 0x887b6e, intensity: 1.18 },
    key: {
      color: 0xfff0dc,
      intensity: 2.15,
      position: [-4.6, 8.5, 6.4],
      shadowMapSize: 1536,
      shadowBias: -0.0002,
      shadowNormalBias: 0.024,
      shadowRadius: 4
    },
    fill: { color: 0xe6efff, intensity: 0.8, position: [6.5, 4.7, 4.2] },
    rim: { color: 0xfff6e9, intensity: 0.65, position: [1.2, 6.8, -5.5] }
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
