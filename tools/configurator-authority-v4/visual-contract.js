export const V4_VISUAL_CONTRACT = Object.freeze({
  schema: "jq-configurator-authority-v4-visual-v1",
  scope: "loopback proof only; diagnostic materials are not customer finishes and never enter project state",
  renderer: Object.freeze({
    backend: "webgl2",
    outputColorSpace: "srgb",
    toneMapping: "neutral",
    exposure: 1.07,
    postProcessing: false,
    ao: false,
    shadows: "pcf-soft-static-on-demand",
    maximumDrawCalls: 245,
    maximumDevicePixelRatio: 2
  }),
  environment: Object.freeze({
    path: "assets/environments/jq-neutral-studio.hdr",
    bytes: 1341884,
    sha256: "0ff81b73774abc781428340a56a0c0170447c7919be9b451c05cf15b4c90a931",
    intensity: 0.98,
    rotationRadians: 0.52
  }),
  lighting: Object.freeze({
    policy: "same accepted neutral studio rig translated only by each registered orbit target",
    areaKeyScale: 1.02,
    areaFillScale: 1.05,
    areaSeparationScale: 1,
    shadowProxyScale: 1,
    perLayoutExposureOverrides: 0
  }),
  diagnostics: Object.freeze({
    "proof-light": Object.freeze({
      id: "proof-light", label: "Proof light diagnostic", base: "#d7d2c8",
      roles: Object.freeze({
        "door-detail": Object.freeze({ color: "#d8d3c9", roughness: 0.68, metalness: 0 }),
        shelf: Object.freeze({ color: "#c8c1b5", roughness: 0.72, metalness: 0 }),
        back: Object.freeze({ color: "#b8b1a6", roughness: 0.78, metalness: 0 }),
        "frame-stile": Object.freeze({ color: "#d0cbc1", roughness: 0.7, metalness: 0 }),
        "filler-end": Object.freeze({ color: "#c2bcb1", roughness: 0.73, metalness: 0 }),
        countertop: Object.freeze({ color: "#aaa398", roughness: 0.62, metalness: 0 }),
        "top-rail": Object.freeze({ color: "#bdb6aa", roughness: 0.72, metalness: 0 }),
        "toe-base": Object.freeze({ color: "#77736c", roughness: 0.76, metalness: 0 }),
        interior: Object.freeze({ color: "#cbbda6", roughness: 0.76, metalness: 0 }),
        "architectural-opening": Object.freeze({ color: "#e1e2de", unlitContext: true }),
        "architectural-opening-detail": Object.freeze({ color: "#c6c9c5", unlitContext: true }),
        hardware: Object.freeze({ color: "#7b6044", roughness: 0.36, metalness: 1 })
      })
    }),
    "proof-mid": Object.freeze({
      id: "proof-mid", label: "Proof mid diagnostic", base: "#8c877f",
      roles: Object.freeze({
        "door-detail": Object.freeze({ color: "#928d85", roughness: 0.68, metalness: 0 }),
        shelf: Object.freeze({ color: "#7e7972", roughness: 0.72, metalness: 0 }),
        back: Object.freeze({ color: "#69655f", roughness: 0.78, metalness: 0 }),
        "frame-stile": Object.freeze({ color: "#89847c", roughness: 0.7, metalness: 0 }),
        "filler-end": Object.freeze({ color: "#74706a", roughness: 0.73, metalness: 0 }),
        countertop: Object.freeze({ color: "#5e5a55", roughness: 0.62, metalness: 0 }),
        "top-rail": Object.freeze({ color: "#716d66", roughness: 0.72, metalness: 0 }),
        "toe-base": Object.freeze({ color: "#373532", roughness: 0.76, metalness: 0 }),
        interior: Object.freeze({ color: "#a2927a", roughness: 0.76, metalness: 0 }),
        "architectural-opening": Object.freeze({ color: "#e1e2de", unlitContext: true }),
        "architectural-opening-detail": Object.freeze({ color: "#c6c9c5", unlitContext: true }),
        hardware: Object.freeze({ color: "#9c7650", roughness: 0.34, metalness: 1 })
      })
    }),
    "proof-dark": Object.freeze({
      id: "proof-dark", label: "Proof dark diagnostic", base: "#343638",
      roles: Object.freeze({
        "door-detail": Object.freeze({ color: "#3d4042", roughness: 0.64, metalness: 0 }),
        shelf: Object.freeze({ color: "#4a4c4d", roughness: 0.69, metalness: 0 }),
        back: Object.freeze({ color: "#252729", roughness: 0.78, metalness: 0 }),
        "frame-stile": Object.freeze({ color: "#37393b", roughness: 0.68, metalness: 0 }),
        "filler-end": Object.freeze({ color: "#444648", roughness: 0.72, metalness: 0 }),
        countertop: Object.freeze({ color: "#555658", roughness: 0.58, metalness: 0 }),
        "top-rail": Object.freeze({ color: "#454749", roughness: 0.7, metalness: 0 }),
        "toe-base": Object.freeze({ color: "#1d1f20", roughness: 0.78, metalness: 0 }),
        interior: Object.freeze({ color: "#675d4d", roughness: 0.76, metalness: 0 }),
        "architectural-opening": Object.freeze({ color: "#e1e2de", unlitContext: true }),
        "architectural-opening-detail": Object.freeze({ color: "#c6c9c5", unlitContext: true }),
        hardware: Object.freeze({ color: "#a17a51", roughness: 0.32, metalness: 1 })
      })
    })
  }),
  protectedRoles: Object.freeze([
    "room-shell", "floor", "fireplace", "architectural-hardware", "architectural-glazing", "support-hardware"
  ]),
  shadow: Object.freeze({
    castRoles: Object.freeze(["door-detail", "shelf", "frame-stile", "filler-end", "countertop", "top-rail", "toe-base"]),
    receiveRoles: Object.freeze(["door-detail", "shelf", "back", "frame-stile", "filler-end", "countertop", "top-rail", "toe-base", "interior"]),
    protectedReceivers: Object.freeze(["floor", "floor-room-shell"]),
    selection: "role priority, descending audited world-bound surface area, then stable primitive ID",
    rolePriority: Object.freeze(["toe-base", "countertop", "door-detail", "shelf", "filler-end", "frame-stile", "top-rail"])
  })
});

export function resolveV4Diagnostic(locationLike = globalThis.location) {
  const requested = new URLSearchParams(String(locationLike?.search || "")).get("diagnostic");
  return V4_VISUAL_CONTRACT.diagnostics[requested] || V4_VISUAL_CONTRACT.diagnostics["proof-light"];
}
