export const PREMIUM_MODEL_V1_QUERY_VALUE = "premium-v1";

export const PREMIUM_MODEL_V1_CONTRACT = Object.freeze({
  schema: "jq-premium-model-v1",
  status: "ISOLATED VISUAL PREVIEW — OWNER ACCEPTANCE OPEN",
  scope: "3D geometry, materials, textures, shared lighting response, and shadows only",
  bevel: Object.freeze({
    widthMeters: 0.0008,
    curveSegments: 1,
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
      normalScale: 0.045
    })
  }),
  roleSurface: Object.freeze({
    "door-detail": Object.freeze({ roughness: 0.84, clearcoat: 0.14, clearcoatRoughness: 0.42, envMapIntensity: 0.92 }),
    shelf: Object.freeze({ roughness: 0.9, clearcoat: 0.1, clearcoatRoughness: 0.48, envMapIntensity: 0.88 }),
    back: Object.freeze({ roughness: 0.96, clearcoat: 0.04, clearcoatRoughness: 0.58, envMapIntensity: 0.78 }),
    "frame-stile": Object.freeze({ roughness: 0.87, clearcoat: 0.12, clearcoatRoughness: 0.46, envMapIntensity: 0.9 }),
    "filler-end": Object.freeze({ roughness: 0.9, clearcoat: 0.09, clearcoatRoughness: 0.5, envMapIntensity: 0.86 }),
    countertop: Object.freeze({ roughness: 0.78, clearcoat: 0.2, clearcoatRoughness: 0.36, envMapIntensity: 0.98 }),
    "top-rail": Object.freeze({ roughness: 0.88, clearcoat: 0.1, clearcoatRoughness: 0.48, envMapIntensity: 0.88 }),
    "toe-base": Object.freeze({ roughness: 0.96, clearcoat: 0.03, clearcoatRoughness: 0.62, envMapIntensity: 0.72 })
  }),
  material: Object.freeze({
    type: "MeshPhysicalMaterial",
    metalness: 0,
    ior: 1.47,
    specularIntensity: 0.42,
    sharedByRole: true
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
