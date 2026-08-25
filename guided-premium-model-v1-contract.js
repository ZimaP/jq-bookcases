export const PREMIUM_MODEL_V1_QUERY_VALUE = "premium-v1";

export const PREMIUM_MODEL_V1_CONTRACT = Object.freeze({
  schema: "jq-premium-model-v1",
  status: "ISOLATED VISUAL PREVIEW — OWNER ACCEPTANCE OPEN",
  scope: "3D geometry, materials, textures, shared lighting response, and shadows only",
  bevel: Object.freeze({
    widthMeters: 0.005,
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
      normalScale: 0.135,
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
      normalScale: 0.1,
      grainTextureAxis: "u",
      finishMultipliers: Object.freeze({
        "light-walnut": "#f2dcc9",
        "medium-walnut": "#c49a7a",
        "dark-walnut": "#ad8d7c"
      }),
      uvProjection: "stable cabinet-scale straight-grain projection"
    }),
    paint: Object.freeze({
      source: "existing repository paint micro-surface PBR family",
      map: null,
      normalMap: "assets/room2-commercial-pbr-v1/textures/paint/normal.webp",
      roughnessMap: "assets/room2-commercial-pbr-v1/textures/paint/roughness.webp",
      repeat: Object.freeze([18, 18]),
      normalScale: 0.135,
      clearcoatNormalScale: 0.04,
      finishMultipliers: Object.freeze({
        charcoal: "#484b4e"
      })
    })
  }),
  roleSurface: Object.freeze({
    "door-detail": Object.freeze({ roughness: 0.8, clearcoat: 0.22, clearcoatRoughness: 0.72, envMapIntensity: 0.86 }),
    shelf: Object.freeze({ roughness: 0.85, clearcoat: 0.15, clearcoatRoughness: 0.74, envMapIntensity: 0.82 }),
    back: Object.freeze({ roughness: 0.96, clearcoat: 0.02, clearcoatRoughness: 0.9, envMapIntensity: 0.56 }),
    "frame-stile": Object.freeze({ roughness: 0.83, clearcoat: 0.18, clearcoatRoughness: 0.72, envMapIntensity: 0.82 }),
    "filler-end": Object.freeze({ roughness: 0.92, clearcoat: 0.06, clearcoatRoughness: 0.84, envMapIntensity: 0.6 }),
    countertop: Object.freeze({ roughness: 0.78, clearcoat: 0.24, clearcoatRoughness: 0.68, envMapIntensity: 0.86 }),
    "top-rail": Object.freeze({ roughness: 0.84, clearcoat: 0.14, clearcoatRoughness: 0.75, envMapIntensity: 0.78 }),
    "toe-base": Object.freeze({ roughness: 0.94, clearcoat: 0.02, clearcoatRoughness: 0.9, envMapIntensity: 0.52 })
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
      roughnessScale: 1.12,
      clearcoatScale: 0.24,
      clearcoatRoughnessFloor: 0.8,
      envMapIntensityScale: 0.65,
      specularIntensity: 0.27
    }),
    walnut: Object.freeze({
      roughnessScale: 1.12,
      clearcoatScale: 0.21,
      clearcoatRoughnessFloor: 0.82,
      envMapIntensityScale: 0.65,
      specularIntensity: 0.26
    }),
    paint: Object.freeze({
      roughnessScale: 1.13,
      clearcoatScale: 0.26,
      clearcoatRoughnessFloor: 0.82,
      envMapIntensityScale: 0.62,
      specularIntensity: 0.27
    })
  }),
  lighting: Object.freeze({
    toneMapping: "neutral",
    exposure: 0.9,
    environmentIntensity: 0.32,
    environmentRotationRadians: 1.12,
    keyAreaScale: 0.82,
    fillAreaScale: 0.5,
    separationAreaScale: 1.08,
    shadowProxyScale: 1.08,
    keyArea: Object.freeze({ position: Object.freeze([-4.8, 4.1, 2.15]), width: 3.8, height: 3 }),
    fillArea: Object.freeze({ position: Object.freeze([5.1, 3.1, 1.15]), width: 2.6, height: 3.4 }),
    separationArea: Object.freeze({ position: Object.freeze([0.43, 4.2, -2.25]), width: 5.4, height: 2 }),
    shadowProxy: Object.freeze({ position: Object.freeze([-3.6, 5.4, 4.3]) }),
    shadowBias: -0.00012,
    shadowNormalBias: 0.0035
  }),
  floorGrid: Object.freeze({ spacingMeters: 0.3048, color: 0xc8bdae, opacity: 0.12, liftMeters: 0.0015 }),
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
      "toe-base", "countertop", "filler-end", "door-detail",
      "shelf", "frame-stile", "top-rail"
    ])
  })
});

export function isPremiumModelV1Route(locationLike = globalThis.location) {
  const query = new URLSearchParams(String(locationLike?.search || ""));
  const host = String(locationLike?.hostname || "");
  const localPreviewHost = ["localhost", "127.0.0.1", "::1"].includes(host);
  return query.get("modelQuality") === PREMIUM_MODEL_V1_QUERY_VALUE
    || (!localPreviewHost && query.get("modelQuality") !== "standard");
}
