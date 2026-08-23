export const PREMIUM_MODEL_V1_QUERY_VALUE = "premium-v1";

export const PREMIUM_MODEL_V1_CONTRACT = Object.freeze({
  schema: "jq-premium-model-v1",
  status: "ISOLATED VISUAL PREVIEW — OWNER ACCEPTANCE OPEN",
  scope: "3D geometry, materials, textures, shared lighting response, and shadows only",
  bevel: Object.freeze({
    widthMeters: 0.003,
    curveSegments: 2,
    maximumRenderedTriangles: 45000,
    maximumWorldScaleRatio: 1.001,
    roles: Object.freeze([
      "door-detail", "shelf", "frame-stile", "filler-end",
      "countertop", "top-rail", "toe-base"
    ])
  }),
  textures: Object.freeze({
    oak: Object.freeze({
      source: "Poly Haven Oak Veneer 01, CC0",
      sourceUrl: "https://polyhaven.com/a/oak_veneer_01",
      realWorldWidthMeters: 1.8,
      map: "assets/premium-model-v1/textures/oak/base-color.webp",
      normalMap: "assets/premium-model-v1/textures/oak/normal.webp",
      roughnessMap: "assets/premium-model-v1/textures/oak/roughness.webp",
      normalScale: 0.12
    }),
    walnut: Object.freeze({
      source: "existing repository provisional walnut PBR family",
      map: "assets/room2-commercial-pbr-v1/textures/walnut/base-color.webp",
      normalMap: null,
      roughnessMap: "assets/room2-commercial-pbr-v1/textures/walnut/roughness.webp",
      normalScale: 0
    }),
    paint: Object.freeze({
      source: "existing repository paint micro-surface PBR family",
      map: null,
      normalMap: "assets/room2-commercial-pbr-v1/textures/paint/normal.webp",
      roughnessMap: "assets/room2-commercial-pbr-v1/textures/paint/roughness.webp",
      repeat: Object.freeze([18, 18]),
      normalScale: 0.12,
      clearcoatNormalScale: 0.035
    })
  }),
  roleSurface: Object.freeze({
    "door-detail": Object.freeze({ roughness: 0.72, clearcoat: 0.32, clearcoatRoughness: 0.56, envMapIntensity: 1 }),
    shelf: Object.freeze({ roughness: 0.78, clearcoat: 0.24, clearcoatRoughness: 0.62, envMapIntensity: 0.95 }),
    back: Object.freeze({ roughness: 0.9, clearcoat: 0.08, clearcoatRoughness: 0.78, envMapIntensity: 0.76 }),
    "frame-stile": Object.freeze({ roughness: 0.74, clearcoat: 0.28, clearcoatRoughness: 0.58, envMapIntensity: 1 }),
    "filler-end": Object.freeze({ roughness: 0.8, clearcoat: 0.2, clearcoatRoughness: 0.66, envMapIntensity: 0.9 }),
    countertop: Object.freeze({ roughness: 0.68, clearcoat: 0.38, clearcoatRoughness: 0.48, envMapIntensity: 1.06 }),
    "top-rail": Object.freeze({ roughness: 0.75, clearcoat: 0.24, clearcoatRoughness: 0.6, envMapIntensity: 0.96 }),
    "toe-base": Object.freeze({ roughness: 0.88, clearcoat: 0.08, clearcoatRoughness: 0.82, envMapIntensity: 0.72 })
  }),
  material: Object.freeze({
    type: "MeshPhysicalMaterial",
    metalness: 0,
    ior: 1.5,
    specularIntensity: 0.58,
    sharedByRole: true
  }),
  lighting: Object.freeze({
    toneMapping: "neutral",
    exposure: 0.94,
    environmentIntensity: 0.68,
    environmentRotationRadians: 0.82,
    keyAreaScale: 1.15,
    fillAreaScale: 0.52,
    separationAreaScale: 1.8,
    shadowProxyScale: 1.1,
    keyArea: Object.freeze({ position: Object.freeze([-3, 4.2, 2.7]), width: 3.2, height: 2.4 }),
    fillArea: Object.freeze({ position: Object.freeze([4.2, 1.7, 2]), width: 4, height: 3 }),
    separationArea: Object.freeze({ position: Object.freeze([3.4, 4.1, 0.3]), width: 2.2, height: 1.2 }),
    shadowBias: -0.00012,
    shadowNormalBias: 0.003
  }),
  hardware: Object.freeze({
    color: "#80644a",
    metalness: 1,
    roughness: 0.3,
    envMapIntensity: 1.08
  }),
  shadow: Object.freeze({
    maximumDrawCalls: 250,
    reservedHeadroom: 5,
    castRoles: Object.freeze([
      "door-detail", "shelf", "frame-stile", "filler-end",
      "countertop", "top-rail", "toe-base"
    ]),
    receiveRoles: Object.freeze([
      "door-detail", "shelf", "back", "frame-stile", "filler-end",
      "countertop", "top-rail", "toe-base", "interior"
    ]),
    protectedReceivers: Object.freeze(["floor", "floor-room-shell"]),
    priority: Object.freeze([
      "toe-base", "countertop", "door-detail", "shelf",
      "filler-end", "frame-stile", "top-rail"
    ])
  })
});

export function isPremiumModelV1Route(locationLike = globalThis.location) {
  const query = new URLSearchParams(String(locationLike?.search || ""));
  return query.get("modelQuality") === PREMIUM_MODEL_V1_QUERY_VALUE;
}
