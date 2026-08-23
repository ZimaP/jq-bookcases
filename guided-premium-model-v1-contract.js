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
      source: "Poly Haven White Oak Veneer, CC0",
      sourceUrl: "https://polyhaven.com/a/white_oak_veneer",
      revision: "cabinet-satin-oak-20260823d",
      sourceTileMeters: Object.freeze([0.5, 0.5]),
      projectionPeriodMeters: Object.freeze([0.52, 1.6]),
      map: "assets/premium-model-v1/textures/oak/base-color.webp",
      normalMap: "assets/premium-model-v1/textures/oak/normal.webp",
      roughnessMap: "assets/premium-model-v1/textures/oak/roughness.webp",
      repeat: Object.freeze([1, 1]),
      normalScale: 0.09,
      grainTextureAxis: "v",
      uvProjection: "stable cabinet-scale straight-grain projection"
    }),
    walnut: Object.freeze({
      source: "Poly Haven European Walnut Veneer 05, CC0",
      sourceUrl: "https://polyhaven.com/a/european_walnut_veneer_05",
      revision: "cabinet-satin-walnut-20260823b",
      sourceTileMeters: Object.freeze([1, 1]),
      projectionPeriodMeters: Object.freeze([1, 2.25]),
      map: "assets/premium-model-v1/textures/walnut/base-color.webp",
      normalMap: "assets/premium-model-v1/textures/walnut/normal.webp",
      roughnessMap: "assets/premium-model-v1/textures/walnut/roughness.webp",
      repeat: Object.freeze([1, 1]),
      normalScale: 0.065,
      grainTextureAxis: "u",
      finishMultipliers: Object.freeze({
        "light-walnut": "#f2dcc9",
        "medium-walnut": "#c49a7a",
        "dark-walnut": "#92766a"
      }),
      uvProjection: "stable cabinet-scale straight-grain projection"
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
    "door-detail": Object.freeze({ roughness: 0.78, clearcoat: 0.26, clearcoatRoughness: 0.66, envMapIntensity: 0.92 }),
    shelf: Object.freeze({ roughness: 0.83, clearcoat: 0.18, clearcoatRoughness: 0.7, envMapIntensity: 0.88 }),
    back: Object.freeze({ roughness: 0.94, clearcoat: 0.04, clearcoatRoughness: 0.86, envMapIntensity: 0.68 }),
    "frame-stile": Object.freeze({ roughness: 0.8, clearcoat: 0.22, clearcoatRoughness: 0.68, envMapIntensity: 0.9 }),
    "filler-end": Object.freeze({ roughness: 0.89, clearcoat: 0.1, clearcoatRoughness: 0.8, envMapIntensity: 0.72 }),
    countertop: Object.freeze({ roughness: 0.74, clearcoat: 0.32, clearcoatRoughness: 0.62, envMapIntensity: 0.94 }),
    "top-rail": Object.freeze({ roughness: 0.81, clearcoat: 0.18, clearcoatRoughness: 0.7, envMapIntensity: 0.86 }),
    "toe-base": Object.freeze({ roughness: 0.92, clearcoat: 0.04, clearcoatRoughness: 0.88, envMapIntensity: 0.64 })
  }),
  material: Object.freeze({
    type: "MeshPhysicalMaterial",
    metalness: 0,
    ior: 1.5,
    specularIntensity: 0.58,
    sharedByRole: true
  }),
  familySurface: Object.freeze({
    oak: Object.freeze({
      roughnessScale: 1.08,
      clearcoatScale: 0.32,
      clearcoatRoughnessFloor: 0.74,
      envMapIntensityScale: 0.78,
      specularIntensity: 0.32
    }),
    walnut: Object.freeze({
      roughnessScale: 1.08,
      clearcoatScale: 0.28,
      clearcoatRoughnessFloor: 0.76,
      envMapIntensityScale: 0.74,
      specularIntensity: 0.3
    }),
    paint: Object.freeze({
      roughnessScale: 1.04,
      clearcoatScale: 0.55,
      clearcoatRoughnessFloor: 0.68,
      envMapIntensityScale: 0.84,
      specularIntensity: 0.42
    })
  }),
  lighting: Object.freeze({
    toneMapping: "neutral",
    exposure: 0.94,
    environmentIntensity: 0.62,
    environmentRotationRadians: 0.82,
    keyAreaScale: 1.05,
    fillAreaScale: 0.68,
    separationAreaScale: 1.48,
    shadowProxyScale: 0.7,
    keyArea: Object.freeze({ position: Object.freeze([-2.2, 4.8, 3.6]), width: 4.4, height: 3.2 }),
    fillArea: Object.freeze({ position: Object.freeze([3.6, 2, 2.8]), width: 4.8, height: 3.6 }),
    separationArea: Object.freeze({ position: Object.freeze([2.8, 4.5, 0.8]), width: 3, height: 1.6 }),
    shadowProxy: Object.freeze({ position: Object.freeze([-2.6, 4.8, 5.2]) }),
    shadowBias: -0.00012,
    shadowNormalBias: 0.0085
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
