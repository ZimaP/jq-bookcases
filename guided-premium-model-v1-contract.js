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
  architecturalSurface: Object.freeze({
    wall: Object.freeze({ color: "#f6f5f2", roughness: 0.96, clearcoat: 0, clearcoatRoughness: 1, envMapIntensity: 0.4, specularIntensity: 0.16, usePaintMicroSurface: false }),
    ceiling: Object.freeze({ color: "#fbfaf7", roughness: 0.98, clearcoat: 0, clearcoatRoughness: 1, envMapIntensity: 0.36, specularIntensity: 0.14, usePaintMicroSurface: false }),
    door: Object.freeze({ color: "#c5c7c5", roughness: 0.9, clearcoat: 0.03, clearcoatRoughness: 0.9, envMapIntensity: 0.38, specularIntensity: 0.18, usePaintMicroSurface: true, normalScale: 0.07 }),
    doorDetail: Object.freeze({ color: "#aeb1af", roughness: 0.86, clearcoat: 0.04, clearcoatRoughness: 0.88, envMapIntensity: 0.4, specularIntensity: 0.2, usePaintMicroSurface: true, normalScale: 0.08 })
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
    exposure: 1.04,
    environmentIntensity: 0.32,
    environmentRotationRadians: 0.92,
    keyAreaScale: 0.92,
    fillAreaScale: 0.88,
    separationAreaScale: 1.08,
    shadowProxyScale: 0.9,
    shadowFilter: "pcf-radius",
    shadowStrength: 0.48,
    shadowRadius: 4,
    keyArea: Object.freeze({ position: Object.freeze([-4.8, 5.4, 4.2]), width: 4.8, height: 3.8 }),
    fillArea: Object.freeze({ position: Object.freeze([4.8, 3.4, 4]), width: 4, height: 4 }),
    separationArea: Object.freeze({ position: Object.freeze([0.6, 4.8, -1.2]), width: 5.5, height: 2.5 }),
    shadowProxy: Object.freeze({ position: Object.freeze([-1.6, 6.4, 5.8]) }),
    shadowBias: -0.00006,
    shadowNormalBias: 0.012
  }),
  exteriorGround: Object.freeze({
    spacingMeters: 0.3048,
    marginMeters: 36,
    floorClearanceMeters: 0.02,
    planeDropMeters: 0.006,
    gridLiftMeters: 0.001,
    planeColor: 0xfaf9f7,
    gridColor: 0xcac8c3,
    gridOpacity: 0.1,
    shadowColor: 0x716d66,
    shadowOpacity: 0.08,
    fogNearMeters: 24,
    fogFarMeters: 58
  }),
  floorSurface: Object.freeze({
    roughness: 0.78,
    envMapIntensity: 0.34,
    bumpScale: 0.004
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
      "countertop", "top-rail", "toe-base",
      "architectural-opening", "architectural-opening-detail"
    ]),
    receiveRoles: Object.freeze([
      "door-detail", "shelf", "back", "frame-stile", "filler-end",
      "countertop", "top-rail", "toe-base", "interior",
      "architectural-opening", "architectural-opening-detail"
    ]),
    protectedReceivers: Object.freeze(["floor", "floor-room-shell"]),
    priority: Object.freeze([
      "architectural-opening-detail", "toe-base", "countertop", "filler-end", "door-detail",
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
