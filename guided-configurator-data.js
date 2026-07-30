/**
 * Configuration catalog for the lightweight JQ guided project configurator.
 *
 * The public flow intentionally owns a small customer-facing schema rather than
 * importing the legacy manufacturing/Three.js state graph. Universal bookcase
 * envelope ranges are inherited from the trusted legacy rules:
 * width 24–144 in, height 72–120 in, and depth 10–24 in. Values outside those
 * ranges are review warnings, not automatic blockers.
 */

const measurement = (id, label, code, options = {}) => Object.freeze({
  id,
  label,
  code,
  type: "inches",
  required: false,
  min: 1,
  max: 240,
  defaultValue: null,
  position: "feature-right",
  group: "Openings & obstacles",
  ...options
});

const selectMeasurement = (id, label, code, values, options = {}) => Object.freeze({
  id,
  label,
  code,
  type: "select",
  required: false,
  defaultValue: values[0]?.value ?? "",
  values: Object.freeze(values),
  position: "feature-right",
  group: "Openings & obstacles",
  ...options
});

const yesNo = Object.freeze([
  Object.freeze({ value: "no", label: "No" }),
  Object.freeze({ value: "yes", label: "Yes" })
]);

const BASE_MEASUREMENTS = Object.freeze([
  measurement("wallWidth", "Wall width", "A", {
    required: true,
    min: 24,
    max: 144,
    defaultValue: 120,
    position: "top",
    group: "Room & built-in"
  }),
  measurement("ceilingHeight", "Ceiling height", "B", {
    required: true,
    min: 72,
    max: 120,
    defaultValue: 96,
    position: "left",
    group: "Room & built-in"
  }),
  measurement("desiredDepth", "Desired built-in depth", "C", {
    required: true,
    min: 10,
    max: 24,
    defaultValue: 14,
    position: "bottom",
    group: "Room & built-in"
  })
]);

const CONDITION_MEASUREMENTS = Object.freeze({
  niche: Object.freeze([
    measurement("nicheWidth", "Niche width", "D", { min: 24, max: 180, defaultValue: 96, position: "feature-left" }),
    measurement("nicheHeight", "Niche height", "E", { min: 48, max: 144, defaultValue: 96, position: "feature-right" }),
    measurement("nicheDepth", "Niche depth", "F", { min: 4, max: 36, defaultValue: 14, position: "feature-bottom" }),
    measurement("leftReturn", "Left return", "G", { min: 0, max: 48, defaultValue: 12, position: "lower-left" }),
    measurement("rightReturn", "Right return", "H", { min: 0, max: 48, defaultValue: 12, position: "lower-right" })
  ]),
  window: Object.freeze([
    measurement("windowWidth", "Window width", "D", { min: 12, max: 144, defaultValue: 48, position: "feature-left" }),
    measurement("windowHeight", "Window height", "E", { min: 12, max: 96, defaultValue: 42, position: "feature-right" }),
    measurement("sillHeight", "Sill height", "F", { min: 12, max: 72, defaultValue: 30, position: "feature-bottom" }),
    measurement("windowLeftDistance", "Window distance from left wall", "G", { min: 0, max: 144, defaultValue: null, position: "lower-left" }),
    measurement("windowRightDistance", "Window distance from right wall", "H", { min: 0, max: 144, defaultValue: null, position: "lower-right" }),
    measurement("leftReturn", "Left built-in return width", "I", { min: 0, max: 48, defaultValue: 12, position: "lower-left" }),
    measurement("rightReturn", "Right built-in return width", "J", { min: 0, max: 48, defaultValue: 12, position: "lower-right" }),
    selectMeasurement("radiatorBelowWindow", "Radiator below window", "K", yesNo, { defaultValue: "no", position: "feature-right" })
  ]),
  door: Object.freeze([
    measurement("doorWidth", "Door width", "D", { min: 24, max: 72, defaultValue: 36, position: "feature-left" }),
    measurement("doorHeight", "Door height", "E", { min: 72, max: 108, defaultValue: 80, position: "feature-right" }),
    measurement("doorLeftDistance", "Distance from left wall", "F", { min: 0, max: 144, defaultValue: 24, position: "lower-left" }),
    measurement("doorTrimWidth", "Trim width", "G", { min: 1, max: 12, defaultValue: 3.5, position: "feature-bottom" }),
    selectMeasurement("doorSwing", "Door swing direction", "H", Object.freeze([
      Object.freeze({ value: "left-in", label: "Left hinge / in" }),
      Object.freeze({ value: "right-in", label: "Right hinge / in" }),
      Object.freeze({ value: "left-out", label: "Left hinge / out" }),
      Object.freeze({ value: "right-out", label: "Right hinge / out" })
    ]), { position: "lower-right" })
  ]),
  fireplace: Object.freeze([
    measurement("fireplaceWidth", "Fireplace opening width", "D", { min: 18, max: 96, defaultValue: 42, position: "feature-left" }),
    measurement("fireplaceHeight", "Fireplace opening height", "E", { min: 18, max: 72, defaultValue: 32, position: "feature-right" }),
    measurement("mantelWidth", "Mantel width", "F", { min: 24, max: 120, defaultValue: 60, position: "feature-left" }),
    measurement("mantelHeight", "Mantel height", "G", { min: 30, max: 72, defaultValue: 48, position: "feature-right" }),
    measurement("fireplaceDepth", "Fireplace projection", "H", { min: 0, max: 30, defaultValue: 8, position: "feature-bottom" }),
    measurement("fireplaceLeftWidth", "Available width on left", "I", { min: 12, max: 96, defaultValue: 36, position: "lower-left" }),
    measurement("fireplaceRightWidth", "Available width on right", "J", { min: 12, max: 96, defaultValue: 36, position: "lower-right" }),
    selectMeasurement("tvAboveFireplace", "TV above fireplace", "K", yesNo, { defaultValue: "no", position: "feature-right" })
  ]),
  tv: Object.freeze([
    measurement("tvScreenSize", "TV screen size (diagonal)", "D", { min: 24, max: 100, defaultValue: 65, position: "feature-left" }),
    measurement("tvHeight", "TV overall height", "E", { min: 16, max: 60, defaultValue: 33, position: "feature-right" }),
    selectMeasurement("tvMounting", "Mounting preference", "F", Object.freeze([
      Object.freeze({ value: "wall-mounted", label: "Wall mounted" }),
      Object.freeze({ value: "recessed", label: "Recessed" }),
      Object.freeze({ value: "on-console", label: "On the cabinet" }),
      Object.freeze({ value: "not-sure", label: "Not sure yet" })
    ]), { position: "feature-bottom" }),
    selectMeasurement("outletLocation", "Existing outlet location", "G", Object.freeze([
      Object.freeze({ value: "behind-tv", label: "Behind the TV" }),
      Object.freeze({ value: "near-floor", label: "Near the floor" }),
      Object.freeze({ value: "side-wall", label: "On a side wall" }),
      Object.freeze({ value: "unknown", label: "Not sure" })
    ]), { position: "lower-left" }),
    selectMeasurement("soundbarRequired", "Equipment or soundbar space", "H", yesNo, { defaultValue: "yes", position: "lower-right" })
  ]),
  radiator: Object.freeze([
    measurement("radiatorWidth", "Radiator width", "D", { min: 12, max: 120, defaultValue: 48, position: "feature-left" }),
    measurement("radiatorHeight", "Radiator height", "E", { min: 12, max: 48, defaultValue: 26, position: "feature-right" }),
    measurement("radiatorDepth", "Radiator depth", "F", { min: 3, max: 24, defaultValue: 9, position: "feature-bottom" }),
    selectMeasurement("valveLocation", "Valve location", "G", Object.freeze([
      Object.freeze({ value: "left", label: "Left side" }),
      Object.freeze({ value: "right", label: "Right side" }),
      Object.freeze({ value: "both", label: "Both sides" }),
      Object.freeze({ value: "unknown", label: "Not sure" })
    ]), { position: "lower-left" })
  ]),
  corner: Object.freeze([
    measurement("cornerReturn", "Corner wall return", "D", { min: 12, max: 120, defaultValue: 48, position: "feature-right" })
  ]),
  opening: Object.freeze([
    measurement("openingLeftDistance", "Left opening clearance", "D", { min: 0, max: 120, defaultValue: 24, position: "lower-left" }),
    measurement("openingRightDistance", "Right opening clearance", "E", { min: 0, max: 120, defaultValue: 24, position: "lower-right" })
  ])
});

const layout = (id, label, condition, feature, tags = [], options = {}) => Object.freeze({
  id,
  label,
  condition,
  feature,
  tags: Object.freeze(tags),
  previewAsset: "",
  previewMode: "image",
  previewPosition: "50% 50%",
  ...options
});

const sceneAsset = (src, width, height, options = {}) => Object.freeze({
  src,
  optimizedSrc: src.replace(/\.png$/i, ".avif"),
  width,
  height,
  aspectRatio: width / height,
  opaque: true,
  fit: "contain",
  focalPoint: Object.freeze({ x: 0.5, y: 0.5 }),
  ...options
});

const sceneCamera = (options = {}) => Object.freeze({
  mode: "canonical-fixed",
  projection: "perspective",
  frameWidth: 3,
  frameHeight: 2,
  aspectRatio: 3 / 2,
  fit: "contain",
  fieldOfViewDegrees: 32,
  yawDegrees: -4.6,
  pitchDegrees: 6.6,
  breathingRoom: 0.1,
  normalizedTarget: Object.freeze({ x: 0.5, y: 0.45 }),
  ...options
});

const measurementSemantic = (
  fieldId,
  axis,
  startAnchor,
  endAnchor,
  line
) => Object.freeze({
  fieldId,
  axis,
  startAnchor,
  endAnchor,
  line: Object.freeze({ ...line })
});

const BASE_ROOM_MEASUREMENT_SEMANTICS = Object.freeze([
  measurementSemantic(
    "wallWidth",
    "width",
    "wall-left-boundary",
    "wall-right-boundary",
    { strategy: "room-width-overhead", offset: 7 }
  ),
  measurementSemantic(
    "ceilingHeight",
    "height",
    "finished-floor",
    "ceiling-plane",
    { strategy: "room-height-visual-right", offset: 8 }
  ),
  measurementSemantic(
    "desiredDepth",
    "depth",
    "product-front-plane",
    "wall-face",
    { strategy: "room-depth-visual-left", offset: 8, elevation: 4 }
  )
]);

const roomScene = (id, label, condition, feature, tags, options) => Object.freeze({
  id,
  label,
  aliases: Object.freeze(options.aliases || []),
  condition,
  feature,
  tags: Object.freeze(tags),
  asset: options.asset,
  camera: options.camera || sceneCamera(),
  measurementSemantics: Object.freeze([
    ...BASE_ROOM_MEASUREMENT_SEMANTICS,
    ...(options.measurementSemantics || [])
  ]),
  geometry: Object.freeze(options.geometry)
});

/**
 * Canonical room-scene definitions shared by room selection, measurements,
 * concept visualization, and persistence. Public layout records below are
 * projections of these definitions rather than a second source of truth.
 */
export const CANONICAL_ROOM_SCENES = Object.freeze([
  roomScene("niche-layout", "Niche Layout", "niche", "recess", ["niche"], {
    aliases: ["tv-niche", "wall-to-wall-floating", "wall-to-wall-cover", "radiator-side-storage"],
    asset: sceneAsset(
      "assets/photos/configurator/room-layouts/room-niche-layout-v1.png",
      627,
      627
    ),
    measurementSemantics: [
      measurementSemantic("nicheWidth", "width", "niche-left-jamb", "niche-right-jamb", {
        strategy: "recess-width-overhead", feature: "niche", offset: 5, ceilingOffset: 3, depthOffset: 2
      }),
      measurementSemantic("nicheHeight", "height", "niche-floor", "niche-head", {
        strategy: "recess-height-visual-left", feature: "niche", offset: 5, depthOffset: 2
      }),
      measurementSemantic("nicheDepth", "depth", "front-wall-plane", "niche-back-wall", {
        strategy: "feature-depth", feature: "niche", side: "geometric-left", offset: 6, elevation: 5
      }),
      measurementSemantic("leftReturn", "width", "niche-visual-left-edge", "visual-left-wall-boundary", {
        strategy: "low-width", feature: "niche", elevation: 7, frontOffset: 2
      }),
      measurementSemantic("rightReturn", "width", "visual-right-wall-boundary", "niche-visual-right-edge", {
        strategy: "low-width", feature: "niche", elevation: 7, frontOffset: 2
      })
    ],
    geometry: {
      strategy: "recess",
      alignment: "center",
      productPlacement: "inside-recess"
    }
  }),
  roomScene("left-niche", "Left Niche", "left-niche", "recess", ["niche"], {
    aliases: ["niche-left"],
    asset: sceneAsset(
      "assets/photos/configurator/room-layouts/room-left-niche-v1.png",
      627,
      627
    ),
    measurementSemantics: [
      measurementSemantic("nicheWidth", "width", "niche-left-jamb", "niche-right-jamb", {
        strategy: "recess-width-overhead", feature: "niche", offset: 5, ceilingOffset: 3, depthOffset: 2
      }),
      measurementSemantic("nicheHeight", "height", "niche-floor", "niche-head", {
        strategy: "recess-height-visual-left", feature: "niche", offset: 5, depthOffset: 2
      }),
      measurementSemantic("nicheDepth", "depth", "front-wall-plane", "niche-back-wall", {
        strategy: "feature-depth", feature: "niche", side: "geometric-left", offset: 6, elevation: 5
      }),
      measurementSemantic("leftReturn", "width", "niche-visual-left-edge", "visual-left-wall-boundary", {
        strategy: "low-width", feature: "niche", elevation: 7, frontOffset: 2
      }),
      measurementSemantic("rightReturn", "width", "visual-right-wall-boundary", "niche-visual-right-edge", {
        strategy: "low-width", feature: "niche", elevation: 7, frontOffset: 2
      })
    ],
    geometry: {
      strategy: "recess",
      alignment: "visual-left",
      productPlacement: "inside-recess"
    }
  }),
  roomScene("right-niche", "Right Niche", "right-niche", "recess", ["niche"], {
    aliases: ["niche-right"],
    asset: sceneAsset(
      "assets/photos/configurator/room-layouts/room-right-niche-v1.png",
      627,
      627
    ),
    measurementSemantics: [
      measurementSemantic("nicheWidth", "width", "niche-left-jamb", "niche-right-jamb", {
        strategy: "recess-width-overhead", feature: "niche", offset: 5, ceilingOffset: 3, depthOffset: 2
      }),
      measurementSemantic("nicheHeight", "height", "niche-floor", "niche-head", {
        strategy: "recess-height-visual-left", feature: "niche", offset: 5, depthOffset: 2
      }),
      measurementSemantic("nicheDepth", "depth", "front-wall-plane", "niche-back-wall", {
        strategy: "feature-depth", feature: "niche", side: "geometric-left", offset: 6, elevation: 5
      }),
      measurementSemantic("leftReturn", "width", "niche-visual-left-edge", "visual-left-wall-boundary", {
        strategy: "low-width", feature: "niche", elevation: 7, frontOffset: 2
      }),
      measurementSemantic("rightReturn", "width", "visual-right-wall-boundary", "niche-visual-right-edge", {
        strategy: "low-width", feature: "niche", elevation: 7, frontOffset: 2
      })
    ],
    geometry: {
      strategy: "recess",
      alignment: "visual-right",
      productPlacement: "inside-recess"
    }
  }),
  roomScene("clear-wall", "Clear Wall", "clear-wall", "none", [], {
    aliases: ["clear-tv-wall", "floating-clear-wall", "standalone-radiator", "radiator-upper-shelving"],
    asset: sceneAsset(
      "assets/photos/configurator/room-layouts/room-clear-wall-v1.png",
      1536,
      1024
    ),
    geometry: {
      strategy: "flat-wall",
      alignment: "center",
      productPlacement: "main-wall"
    }
  }),
  roomScene("fireplace-wall", "Fireplace Wall", "clear-wall", "fireplace", ["fireplace"], {
    aliases: ["fireplace-tv"],
    asset: sceneAsset(
      "assets/photos/configurator/room-layouts/room-fireplace-wall-v1.png",
      627,
      627
    ),
    measurementSemantics: [
      measurementSemantic("fireplaceWidth", "width", "fireplace-left-jamb", "fireplace-right-jamb", {
        strategy: "feature-width-overhead", feature: "fireplace", offset: 4
      }),
      measurementSemantic("fireplaceHeight", "height", "fireplace-hearth", "fireplace-head", {
        strategy: "feature-height-visual-left", feature: "fireplace", offset: 5
      }),
      measurementSemantic("mantelWidth", "width", "mantel-left-edge", "mantel-right-edge", {
        strategy: "mantel-width", feature: "fireplace"
      }),
      measurementSemantic("mantelHeight", "height", "finished-floor", "mantel-top", {
        strategy: "mantel-height", feature: "fireplace", offset: 10
      }),
      measurementSemantic("fireplaceDepth", "depth", "fireplace-front-face", "wall-face", {
        strategy: "feature-depth", feature: "fireplace", side: "visual-left", offset: 8, elevation: 5
      }),
      measurementSemantic("fireplaceLeftWidth", "width", "fireplace-visual-left-edge", "visual-left-wall-boundary", {
        strategy: "low-width", feature: "fireplace", elevation: 10, frontOffset: 0
      }),
      measurementSemantic("fireplaceRightWidth", "width", "visual-right-wall-boundary", "fireplace-visual-right-edge", {
        strategy: "low-width", feature: "fireplace", elevation: 10, frontOffset: 0
      })
    ],
    geometry: {
      strategy: "fireplace-wall",
      alignment: "center",
      productPlacement: "main-wall-around-feature"
    }
  }),
  roomScene("center-recess", "Center Projection", "clear-wall", "recess", ["niche"], {
    aliases: ["center-projection"],
    asset: sceneAsset(
      "assets/photos/configurator/room-layouts/room-center-projection-v1.png",
      1536,
      1024
    ),
    measurementSemantics: [
      measurementSemantic("nicheWidth", "width", "projection-left-edge", "projection-right-edge", {
        strategy: "recess-width-overhead", feature: "niche", offset: 5, ceilingOffset: 3, depthOffset: 2
      }),
      measurementSemantic("nicheHeight", "height", "finished-floor", "projection-head", {
        strategy: "recess-height-visual-left", feature: "niche", offset: 5, depthOffset: 2
      }),
      measurementSemantic("nicheDepth", "depth", "projection-front-face", "back-wall-plane", {
        strategy: "feature-depth", feature: "niche", side: "geometric-left", offset: 6, elevation: 5
      }),
      measurementSemantic("leftReturn", "width", "projection-visual-left-edge", "visual-left-wall-boundary", {
        strategy: "low-width", feature: "niche", elevation: 7, frontOffset: 2
      }),
      measurementSemantic("rightReturn", "width", "visual-right-wall-boundary", "projection-visual-right-edge", {
        strategy: "low-width", feature: "niche", elevation: 7, frontOffset: 2
      })
    ],
    geometry: {
      strategy: "center-projection",
      alignment: "center",
      productPlacement: "main-wall-around-feature"
    }
  }),
  roomScene("window-wall", "Window Wall", "clear-wall", "window", ["window"], {
    aliases: [
      "window-side-tv",
      "floating-under-window",
      "single-window",
      "wide-window",
      "bay-window",
      "window-side-bookcases",
      "window-radiator",
      "radiator-below-window"
    ],
    asset: sceneAsset(
      "assets/photos/configurator/room-layouts/room-window-wall-v1.png",
      1536,
      1024
    ),
    measurementSemantics: [
      measurementSemantic("windowWidth", "width", "window-left-jamb", "window-right-jamb", {
        strategy: "feature-width-overhead", feature: "window", offset: 4
      }),
      measurementSemantic("windowHeight", "height", "window-sill", "window-head", {
        strategy: "feature-height-visual-left", feature: "window", offset: 5
      }),
      measurementSemantic("sillHeight", "height", "finished-floor", "window-sill", {
        strategy: "feature-height-visual-right", feature: "window", offset: 5
      }),
      measurementSemantic("windowLeftDistance", "width", "window-visual-left-edge", "visual-left-wall-boundary", {
        strategy: "low-width", feature: "window", elevation: 7, frontOffset: 0
      }),
      measurementSemantic("windowRightDistance", "width", "visual-right-wall-boundary", "window-visual-right-edge", {
        strategy: "low-width", feature: "window", elevation: 7, frontOffset: 0
      })
    ],
    geometry: {
      strategy: "window-wall",
      alignment: "measured-or-center",
      productPlacement: "main-wall-around-feature"
    }
  }),
  roomScene("door-wall", "Door Wall", "clear-wall", "door", ["door"], {
    aliases: [],
    asset: sceneAsset(
      "assets/photos/configurator/room-layouts/room-door-wall-v1.png",
      1536,
      1024
    ),
    measurementSemantics: [
      measurementSemantic("doorWidth", "width", "door-left-jamb", "door-right-jamb", {
        strategy: "feature-width-overhead", feature: "door", offset: 4
      }),
      measurementSemantic("doorHeight", "height", "door-threshold", "door-head", {
        strategy: "feature-height-visual-left", feature: "door", offset: 5
      }),
      measurementSemantic("doorLeftDistance", "width", "door-visual-left-edge", "visual-left-wall-boundary", {
        strategy: "low-width", feature: "door", elevation: 7, frontOffset: 0
      }),
      measurementSemantic("doorTrimWidth", "width", "door-jamb", "door-trim-outer-edge", {
        strategy: "feature-width-overhead", feature: "door", offset: 9
      })
    ],
    geometry: {
      strategy: "door-wall",
      alignment: "measured-from-visual-left",
      productPlacement: "main-wall-around-feature"
    }
  }),
  roomScene("corner-wall", "Corner Wall", "corner", "none", ["corner"], {
    aliases: ["corner-tv-wall", "floating-corner"],
    asset: sceneAsset(
      "assets/photos/configurator/room-layouts/room-corner-v1.png",
      1536,
      1024
    ),
    camera: sceneCamera({
      yawDegrees: -19.5,
      normalizedTarget: Object.freeze({ x: 0.58, y: 0.45 })
    }),
    measurementSemantics: [
      measurementSemantic("cornerReturn", "depth", "corner-return-front-edge", "back-wall-plane", {
        strategy: "corner-depth", offset: 5, elevation: 5
      })
    ],
    geometry: {
      strategy: "corner-wall",
      alignment: "visual-right-return",
      productPlacement: "corner-wrap"
    }
  }),
  roomScene("double-opening", "Between Openings", "clear-wall", "opening", ["opening"], {
    aliases: ["between-openings"],
    asset: sceneAsset(
      "assets/photos/configurator/room-layouts/room-double-opening-v1.png",
      1536,
      1024
    ),
    measurementSemantics: [
      measurementSemantic("openingLeftDistance", "width", "left-opening-inner-jamb", "visual-left-wall-boundary", {
        strategy: "opening-width", feature: "opening-left", elevation: 8
      }),
      measurementSemantic("openingRightDistance", "width", "visual-right-wall-boundary", "right-opening-inner-jamb", {
        strategy: "opening-width", feature: "opening-right", elevation: 8
      })
    ],
    geometry: {
      strategy: "between-openings",
      alignment: "center",
      productPlacement: "between-openings"
    }
  })
]);

const CANONICAL_ROOM_SCENE_BY_ID = new Map(
  CANONICAL_ROOM_SCENES.map((scene) => [scene.id, scene])
);
const CANONICAL_ROOM_SCENE_ID_BY_ALIAS = new Map();

for (const scene of CANONICAL_ROOM_SCENES) {
  for (const alias of [scene.id, ...scene.aliases]) {
    if (CANONICAL_ROOM_SCENE_ID_BY_ALIAS.has(alias)) {
      throw new TypeError(`Duplicate canonical room-scene alias: ${alias}`);
    }
    CANONICAL_ROOM_SCENE_ID_BY_ALIAS.set(alias, scene.id);
  }
}

export function canonicalizeRoomLayoutId(layoutId) {
  if (typeof layoutId !== "string") return null;
  const normalized = layoutId.trim().toLowerCase();
  if (!normalized) return null;
  return CANONICAL_ROOM_SCENE_ID_BY_ALIAS.get(normalized) || null;
}

export function getCanonicalRoomScene(layoutId) {
  const canonicalId = canonicalizeRoomLayoutId(layoutId);
  return canonicalId ? CANONICAL_ROOM_SCENE_BY_ID.get(canonicalId) || null : null;
}

const style = (id, label, options = {}) => Object.freeze({
  id,
  label,
  description: "",
  drawingRef: "",
  supportsDoors: true,
  supportsHardware: true,
  supportsLighting: true,
  supportsBase: true,
  supportsTop: true,
  previewAsset: "assets/photos/inspiration-living.jpg",
  ...options
});

export const SHARED_ROOM_LAYOUTS = Object.freeze(CANONICAL_ROOM_SCENES.map((scene) => (
  layout(scene.id, scene.label, scene.condition, scene.feature, scene.tags, {
    previewAsset: scene.asset.src,
    previewMode: "image",
    previewFit: scene.asset.fit,
    previewPosition: `${scene.asset.focalPoint.x * 100}% ${scene.asset.focalPoint.y * 100}%`
  })
)));

export const PUBLIC_BOOKCASE_STYLE_IDS = Object.freeze([
  "cabinet-base-shelves",
  "drawer-base-shelves",
  "full-open-shelving"
]);

/**
 * Customer-facing Bookcase previews are a strict construction × room matrix.
 *
 * Once a room is selected, a style-only photograph is not an acceptable
 * fallback: the selected room topology must be part of the rendered scene.
 * Every style exposed by the new-project Bookcase UI therefore has an exact
 * asset for every shared room condition.
 */
export const BOOKCASE_INTEGRATED_PREVIEW_ASSETS = Object.freeze({
  "niche-layout": Object.freeze({
    "cabinet-base-shelves": "assets/photos/configurator/integrated/bookcase/cabinet-base-shelves/niche-layout-v1.png",
    "drawer-base-shelves": "assets/photos/configurator/integrated/bookcase/drawer-base-shelves/niche-layout-v1.png",
    "full-open-shelving": "assets/photos/configurator/integrated/bookcase/full-open-shelving/niche-layout-v1.png"
  }),
  "left-niche": Object.freeze({
    "cabinet-base-shelves": "assets/photos/configurator/integrated/bookcase/cabinet-base-shelves/left-niche-v1.png",
    "drawer-base-shelves": "assets/photos/configurator/integrated/bookcase/drawer-base-shelves/left-niche-v1.png",
    "full-open-shelving": "assets/photos/configurator/integrated/bookcase/full-open-shelving/left-niche-v1.png"
  }),
  "right-niche": Object.freeze({
    "cabinet-base-shelves": "assets/photos/configurator/integrated/bookcase/cabinet-base-shelves/right-niche-v1.png",
    "drawer-base-shelves": "assets/photos/configurator/integrated/bookcase/drawer-base-shelves/right-niche-v1.png",
    "full-open-shelving": "assets/photos/configurator/integrated/bookcase/full-open-shelving/right-niche-v1.png"
  }),
  "clear-wall": Object.freeze({
    "cabinet-base-shelves": "assets/photos/configurator/concept-cabinets-shelves-v1.png",
    "drawer-base-shelves": "assets/photos/configurator/concept-drawers-shelves-v1.png",
    "full-open-shelving": "assets/photos/configurator/concept-full-shelving-v1.png"
  }),
  "fireplace-wall": Object.freeze({
    "cabinet-base-shelves": "assets/photos/configurator/integrated/bookcase/cabinet-base-shelves/fireplace-wall-v1.png",
    "drawer-base-shelves": "assets/photos/configurator/integrated/bookcase/drawer-base-shelves/fireplace-wall-v1.png",
    "full-open-shelving": "assets/photos/configurator/integrated/bookcase/full-open-shelving/fireplace-wall-v1.png"
  }),
  "center-recess": Object.freeze({
    "cabinet-base-shelves": "assets/photos/configurator/integrated/bookcase/cabinet-base-shelves/center-recess-v1.png",
    "drawer-base-shelves": "assets/photos/configurator/integrated/bookcase/drawer-base-shelves/center-recess-v1.png",
    "full-open-shelving": "assets/photos/configurator/integrated/bookcase/full-open-shelving/center-recess-v1.png"
  }),
  "window-wall": Object.freeze({
    "cabinet-base-shelves": "assets/photos/configurator/concept-window-cabinets-v1.png",
    "drawer-base-shelves": "assets/photos/configurator/integrated/bookcase/drawer-base-shelves/window-wall-v1.png",
    "full-open-shelving": "assets/photos/configurator/integrated/bookcase/full-open-shelving/window-wall-v1.png"
  }),
  "door-wall": Object.freeze({
    "cabinet-base-shelves": "assets/photos/configurator/integrated/bookcase/cabinet-base-shelves/door-wall-v1.png",
    "drawer-base-shelves": "assets/photos/configurator/integrated/bookcase/drawer-base-shelves/door-wall-v1.png",
    "full-open-shelving": "assets/photos/configurator/integrated/bookcase/full-open-shelving/door-wall-v1.png"
  }),
  "corner-wall": Object.freeze({
    "cabinet-base-shelves": "assets/photos/configurator/integrated/bookcase/cabinet-base-shelves/corner-wall-v1.png",
    "drawer-base-shelves": "assets/photos/configurator/integrated/bookcase/drawer-base-shelves/corner-wall-v1.png",
    "full-open-shelving": "assets/photos/configurator/integrated/bookcase/full-open-shelving/corner-wall-v1.png"
  }),
  "double-opening": Object.freeze({
    "cabinet-base-shelves": "assets/photos/configurator/concept-cabinets-shelves-between-openings-v1.png",
    "drawer-base-shelves": "assets/photos/configurator/concept-drawers-shelves-between-openings-v1.png",
    "full-open-shelving": "assets/photos/configurator/concept-full-shelving-between-openings-v1.png"
  })
});

export const CATEGORY_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "bookcase",
    label: "Bookcase",
    icon: "bookcase",
    description: "Built-in shelving and storage designed around your room.",
    productPreviewAsset: "assets/photos/configurator/concept-cabinets-shelves-v1.png",
    productPreviewPosition: "50% 45%",
    layouts: SHARED_ROOM_LAYOUTS,
    styles: Object.freeze([
      style("cabinet-base-shelves", "Cabinets + Shelves", {
        description: "Open display above concealed cabinet storage.",
        drawingRef: "Drawing 7",
        previewAsset: "assets/photos/configurator/concept-cabinets-shelves-v1.png"
      }),
      style("drawer-base-shelves", "Drawers + Shelves", {
        description: "Six-drawer base with open display shelving.",
        drawingRef: "Drawings 5–6",
        supportsDoors: false,
        previewAsset: "assets/photos/configurator/concept-drawers-shelves-v1.png"
      }),
      style("tv-wall-cabinets", "TV Wall + Cabinets", {
        description: "Centered media zone with shelving and closed storage.",
        drawingRef: "Drawing 4",
        previewAsset: "assets/photos/configurator/concept-tv-wall-v1.png"
      }),
      style("full-open-shelving", "Full Open Shelving", {
        description: "Full-height display shelving without lower storage.",
        drawingRef: "Drawings 1–2",
        supportsDoors: false,
        supportsHardware: false,
        previewAsset: "assets/photos/configurator/concept-full-shelving-v1.png"
      })
    ])
  }),
  Object.freeze({
    id: "tv-unit",
    label: "TV Unit",
    icon: "tv",
    description: "A balanced media wall with concealed equipment and curated display space.",
    productPreviewAsset: "assets/photos/configurator/concept-tv-wall-v1.png",
    productPreviewPosition: "50% 45%",
    layouts: SHARED_ROOM_LAYOUTS,
    styles: Object.freeze([
      style("open-media", "Open Media Shelving", { previewAsset: "assets/photos/configurator/concept-tv-wall-v1.png" }),
      style("low-media-console", "Low Media Console", { previewAsset: "assets/photos/configurator/concept-tv-wall-v1.png" }),
      style("framed-tv-wall", "Framed TV Wall", {
        description: "Centered television, open display shelves, and concealed lower storage.",
        drawingRef: "Drawing 4",
        previewAsset: "assets/photos/configurator/concept-tv-wall-v1.png"
      }),
      style("library-media", "Library + Media", { previewAsset: "assets/photos/configurator/concept-tv-wall-v1.png" }),
      style("closed-media-storage", "Closed Media Storage", { previewAsset: "assets/photos/configurator/concept-tv-wall-v1.png" })
    ])
  }),
  Object.freeze({
    id: "floating-storage",
    label: "Floating Storage",
    icon: "floating",
    description: "Lightweight wall-mounted storage tailored to your room condition.",
    productPreviewAsset: "assets/photos/configurator/product-floating-storage-v1.png",
    productPreviewPosition: "50% 52%",
    layouts: SHARED_ROOM_LAYOUTS,
    styles: Object.freeze([
      style("slim-floating-console", "Slim Floating Console", { supportsLighting: false, supportsBase: false, supportsTop: false, previewAsset: "assets/photos/configurator/product-floating-storage-v1.png" }),
      style("floating-drawer-bank", "Floating Drawer Bank", { supportsBase: false, supportsTop: false, previewAsset: "assets/photos/configurator/product-floating-storage-v1.png" }),
      style("floating-cabinets", "Floating Cabinets", { supportsBase: false, supportsTop: false, previewAsset: "assets/photos/configurator/product-floating-storage-v1.png" }),
      style("display-ledge-storage", "Display Ledge + Storage", { supportsBase: false, supportsTop: false, previewAsset: "assets/photos/configurator/product-floating-storage-v1.png" }),
      style("asymmetric-floating", "Asymmetric Floating Unit", { supportsBase: false, supportsTop: false, previewAsset: "assets/photos/configurator/product-floating-storage-v1.png" })
    ])
  }),
  Object.freeze({
    id: "window-storage",
    label: "Window Storage",
    icon: "window",
    description: "Window seating and storage that keeps light at the center of the design.",
    productPreviewAsset: "assets/photos/configurator/concept-window-cabinets-v1.png",
    productPreviewPosition: "50% 45%",
    layouts: SHARED_ROOM_LAYOUTS,
    styles: Object.freeze([
      style("window-seat-storage", "Window Seat + Storage", { previewAsset: "assets/photos/configurator/concept-window-cabinets-v1.png" }),
      style("side-bookcases", "Side Bookcases", { previewAsset: "assets/photos/configurator/concept-window-cabinets-v1.png" }),
      style("low-window-cabinets", "Low Window Cabinets", { previewAsset: "assets/photos/configurator/concept-window-cabinets-v1.png" }),
      style("display-window-wall", "Display Window Wall", { previewAsset: "assets/photos/configurator/concept-window-cabinets-v1.png" }),
      style("library-window", "Library Window", { previewAsset: "assets/photos/configurator/concept-window-cabinets-v1.png" })
    ])
  }),
  Object.freeze({
    id: "radiator-cover",
    label: "Radiator Cover",
    icon: "radiator",
    description: "A ventilated cover with optional storage and display elements.",
    productPreviewAsset: "assets/photos/configurator/product-radiator-cover-v1.png",
    productPreviewPosition: "50% 55%",
    layouts: SHARED_ROOM_LAYOUTS,
    styles: Object.freeze([
      style("clean-slat-cover", "Clean Slat Cover", { supportsDoors: false, supportsHardware: false, supportsLighting: false, supportsTop: false, previewAsset: "assets/photos/configurator/product-radiator-cover-v1.png" }),
      style("shaker-radiator-cover", "Shaker Radiator Cover", { supportsHardware: false, supportsLighting: false, previewAsset: "assets/photos/configurator/product-radiator-cover-v1.png" }),
      style("cover-side-cabinets", "Cover + Side Cabinets", { previewAsset: "assets/photos/configurator/product-radiator-cover-v1.png" }),
      style("cover-display-shelves", "Cover + Display Shelves", { supportsDoors: false, supportsHardware: false, previewAsset: "assets/photos/configurator/product-radiator-cover-v1.png" }),
      style("library-radiator-wall", "Library Radiator Wall", { previewAsset: "assets/photos/configurator/product-radiator-cover-v1.png" })
    ])
  })
]);

const productChoice = (id, categoryId, styleId, label, options = {}) => Object.freeze({
  id,
  categoryId,
  styleId,
  label,
  shortLabel: label,
  drawingRef: "",
  description: "",
  ...options
});

/**
 * The seven products shown on the first step.
 *
 * These are deliberately individual choices rather than category tabs. A
 * choice owns both the product family and its construction style so the same
 * identity can be carried through the room, measurement, customization, and
 * review steps without a later style substitution.
 */
export const PRODUCT_CHOICES = Object.freeze([
  productChoice("cabinet-shelves", "bookcase", "cabinet-base-shelves", "Cabinets + Shelves", {
    drawingRef: "Drawing 7",
    description: "Open shelving with concealed lower cabinets."
  }),
  productChoice("drawer-shelves", "bookcase", "drawer-base-shelves", "Drawers + Shelves", {
    drawingRef: "Drawings 5–6",
    description: "Open shelving with a six-drawer base."
  }),
  productChoice("open-shelving", "bookcase", "full-open-shelving", "Full Open Shelving", {
    drawingRef: "Drawings 1–2",
    description: "Full-height display shelving without lower storage."
  }),
  productChoice("tv-unit", "tv-unit", "framed-tv-wall", "TV Unit", {
    drawingRef: "Drawing 4",
    description: "A fitted media wall with display and concealed storage."
  }),
  productChoice("floating-storage", "floating-storage", "floating-drawer-bank", "Floating Storage", {
    description: "Wall-mounted storage with a clean open floor line."
  }),
  productChoice("window-storage", "window-storage", "window-seat-storage", "Window Storage", {
    description: "Storage and seating designed around natural light."
  }),
  productChoice("radiator-cover", "radiator-cover", "clean-slat-cover", "Radiator Cover", {
    description: "A fitted ventilated cover with a finished display ledge."
  })
]);

const NATIVE_PRODUCT_SCENES = Object.freeze({
  "tv-unit": Object.freeze({
    "clear-wall": "assets/photos/configurator/concept-tv-wall-v1.png"
  }),
  "floating-storage": Object.freeze({
    "clear-wall": "assets/photos/configurator/product-floating-storage-v1.png"
  }),
  "window-storage": Object.freeze({
    "window-wall": "assets/photos/configurator/concept-window-cabinets-v1.png"
  }),
  "radiator-cover": Object.freeze({
    "window-wall": "assets/photos/configurator/product-radiator-cover-v1.png"
  })
});

const PRODUCT_SCENE_ASSET_OVERRIDES = Object.freeze({
  "tv-unit:framed-tv-wall:double-opening": "assets/photos/configurator/integrated/tv-unit/framed-tv-wall/double-opening-v2.png",
  "floating-storage:floating-drawer-bank:double-opening": "assets/photos/configurator/integrated/floating-storage/floating-drawer-bank/double-opening-v3.png",
  "window-storage:window-seat-storage:double-opening": "assets/photos/configurator/integrated/window-storage/window-seat-storage/double-opening-v2.png",
  "radiator-cover:clean-slat-cover:double-opening": "assets/photos/configurator/integrated/radiator-cover/clean-slat-cover/double-opening-v2.png"
});

export const PRODUCT_INTEGRATED_PREVIEW_ASSETS = Object.freeze(Object.fromEntries(
  PRODUCT_CHOICES.map((choice) => [
    choice.id,
    Object.freeze(Object.fromEntries(
      SHARED_ROOM_LAYOUTS.map((roomLayout) => {
        const previewKey = `${choice.categoryId}:${choice.styleId}:${roomLayout.id}`;
        const bookcaseAsset = choice.categoryId === "bookcase"
          ? BOOKCASE_INTEGRATED_PREVIEW_ASSETS[roomLayout.id]?.[choice.styleId]
          : null;
        const nativeAsset = NATIVE_PRODUCT_SCENES[choice.categoryId]?.[roomLayout.id];
        const integratedAsset = `assets/photos/configurator/integrated/${choice.categoryId}/${choice.styleId}/${roomLayout.id}-v1.png`;
        return [
          roomLayout.id,
          PRODUCT_SCENE_ASSET_OVERRIDES[previewKey] || bookcaseAsset || nativeAsset || integratedAsset
        ];
      })
    ))
  ])
));

export function getProductChoice(productId) {
  return PRODUCT_CHOICES.find((choice) => choice.id === productId) || null;
}

export function getProductChoiceForSelection(categoryId, styleId) {
  const category = getCategory(categoryId);
  const selectedStyle = getStyle(category.id, styleId);
  return PRODUCT_CHOICES.find((choice) => (
    choice.categoryId === category.id && choice.styleId === selectedStyle.id
  )) || null;
}

const finishOption = (id, label, family, color, preview) => Object.freeze({
  id,
  label,
  family,
  color,
  preview: Object.freeze(preview)
});

export const FINISH_OPTIONS = Object.freeze({
  wood: Object.freeze([
    finishOption("white-oak", "White Oak", "wood", "#d9c0a0", {
      tintOpacity: 0.58,
      toneColor: "#eadcc9",
      toneBlend: "screen",
      toneOpacity: 0.2
    }),
    finishOption("natural-oak", "Natural Oak", "wood", "#b88e5e", {
      tintOpacity: 0.12,
      toneColor: "#b88e5e",
      toneBlend: "soft-light",
      toneOpacity: 0.08
    }),
    finishOption("light-walnut", "Light Walnut", "wood", "#9a7048", {
      tintOpacity: 0.56,
      toneColor: "#89603d",
      toneBlend: "multiply",
      toneOpacity: 0.15
    }),
    finishOption("medium-walnut", "Medium Walnut", "wood", "#775238", {
      tintOpacity: 0.64,
      toneColor: "#63402c",
      toneBlend: "multiply",
      toneOpacity: 0.2
    }),
    finishOption("dark-walnut", "Dark Walnut", "wood", "#4b372c", {
      tintOpacity: 0.72,
      toneColor: "#35231c",
      toneBlend: "multiply",
      toneOpacity: 0.28
    })
  ]),
  paint: Object.freeze([
    finishOption("warm-white", "Warm White", "paint", "#f3f0e9", {
      tintOpacity: 0.82,
      toneColor: "#ffffff",
      toneBlend: "screen",
      toneOpacity: 0.58
    }),
    finishOption("soft-ivory", "Soft Ivory", "paint", "#e8dfd0", {
      tintOpacity: 0.8,
      toneColor: "#f7ecdc",
      toneBlend: "screen",
      toneOpacity: 0.48
    }),
    finishOption("light-greige", "Light Greige", "paint", "#b9b6ad", {
      tintOpacity: 0.8,
      toneColor: "#d4d0c7",
      toneBlend: "screen",
      toneOpacity: 0.24
    }),
    finishOption("sage-gray", "Sage Gray", "paint", "#89918a", {
      tintOpacity: 0.75,
      toneColor: "#747d75",
      toneBlend: "multiply",
      toneOpacity: 0.1
    }),
    finishOption("charcoal", "Charcoal", "paint", "#343638", {
      tintOpacity: 0.72,
      toneColor: "#242729",
      toneBlend: "multiply",
      toneOpacity: 0.22
    })
  ]),
  accent: Object.freeze([
    finishOption("no-accent", "Match exterior", "accent", "currentColor", {
      tintOpacity: 0,
      toneColor: "transparent",
      toneBlend: "normal",
      toneOpacity: 0
    }),
    finishOption("warm-linen", "Warm Linen", "accent", "#d8cec0", {
      tintOpacity: 0.75,
      toneColor: "#efe5d8",
      toneBlend: "screen",
      toneOpacity: 0.35
    }),
    finishOption("deep-olive", "Deep Olive", "accent", "#5d6250", {
      tintOpacity: 0.8,
      toneColor: "#454a3d",
      toneBlend: "multiply",
      toneOpacity: 0.24
    }),
    finishOption("ink-blue", "Ink Blue", "accent", "#384b59", {
      tintOpacity: 0.82,
      toneColor: "#273945",
      toneBlend: "multiply",
      toneOpacity: 0.3
    })
  ])
});

export const DETAIL_OPTIONS = Object.freeze({
  doorStyle: Object.freeze([
    Object.freeze({ id: "flat-panel", label: "Flat Panel" }),
    Object.freeze({ id: "shaker", label: "Shaker" }),
    Object.freeze({ id: "glass", label: "Glass Display" })
  ]),
  hardware: Object.freeze([
    Object.freeze({ id: "knob", label: "Knob", color: "#393633" }),
    Object.freeze({ id: "brass-pull", label: "Brass Pull", color: "#b48a42" }),
    Object.freeze({ id: "black-pull", label: "Black Pull", color: "#222426" }),
    Object.freeze({ id: "none", label: "No Visible Hardware", color: "transparent" })
  ]),
  lighting: Object.freeze([
    Object.freeze({ id: "no-lighting", label: "No Lighting" }),
    Object.freeze({ id: "warm-led", label: "Warm LED" }),
    Object.freeze({ id: "integrated-led", label: "Integrated LED" })
  ]),
  baseStyle: Object.freeze([
    Object.freeze({
      id: "flush-base",
      label: "Built-in · Flush room base",
      shortLabel: "Flush built-in",
      description: "Fitted wall fillers with the room base carried across the front."
    }),
    Object.freeze({
      id: "recessed-toe-kick",
      label: "Built-in · Recessed toe kick",
      shortLabel: "Recessed built-in",
      description: "Fitted wall fillers with a shadowed working toe space."
    }),
    Object.freeze({
      id: "furniture-base",
      label: "Freestanding · No fillers",
      shortLabel: "Freestanding",
      description: "Finished exterior sides with deliberate clearance from the walls."
    })
  ]),
  topTreatment: Object.freeze([
    Object.freeze({ id: "simple-finished-top", label: "Simple Finished Top", shortLabel: "Finished top" }),
    Object.freeze({ id: "small-crown", label: "Architectural Top Rail", shortLabel: "Top rail" }),
    Object.freeze({ id: "traditional-crown", label: "Built-Up Crown", shortLabel: "Built-up crown" })
  ])
});

const BOOKCASE_STYLE_ALIASES = Object.freeze({
  "open-shelving": "cabinet-base-shelves",
  "lower-cabinets-shelves": "cabinet-base-shelves",
  "full-height-closed": "cabinet-base-shelves",
  "display-shelving": "tv-wall-cabinets",
  "library-style": "full-open-shelving",
  "floating-lower-storage": "drawer-base-shelves"
});

const CATEGORY_MEASUREMENT_TAGS = Object.freeze({
  "tv-unit": Object.freeze(["tv"]),
  "window-storage": Object.freeze(["window"]),
  "radiator-cover": Object.freeze(["radiator"])
});

const CLEAR_WALL_CATEGORY_MEASUREMENT_SEMANTICS = Object.freeze({
  "tv-unit": Object.freeze([
    measurementSemantic("tvScreenSize", "diagonal", "screen-bottom-left", "screen-top-right", {
      strategy: "screen-diagonal", feature: "screen"
    }),
    measurementSemantic("tvHeight", "height", "screen-bottom-edge", "screen-top-edge", {
      strategy: "feature-height-visual-left", feature: "screen", offset: 5
    })
  ]),
  "window-storage": Object.freeze([
    measurementSemantic("windowWidth", "width", "window-left-jamb", "window-right-jamb", {
      strategy: "feature-width-overhead", feature: "window", offset: 4
    }),
    measurementSemantic("windowHeight", "height", "window-sill", "window-head", {
      strategy: "feature-height-visual-left", feature: "window", offset: 5
    }),
    measurementSemantic("sillHeight", "height", "finished-floor", "window-sill", {
      strategy: "feature-height-visual-right", feature: "window", offset: 5
    })
  ]),
  "radiator-cover": Object.freeze([
    measurementSemantic("radiatorWidth", "width", "radiator-left-edge", "radiator-right-edge", {
      strategy: "feature-width-overhead", feature: "radiator", offset: 4
    }),
    measurementSemantic("radiatorHeight", "height", "finished-floor", "radiator-top-edge", {
      strategy: "feature-height-visual-left", feature: "radiator", offset: 5
    }),
    measurementSemantic("radiatorDepth", "depth", "radiator-front-face", "wall-face", {
      strategy: "feature-depth", feature: "radiator", side: "visual-left", offset: 7, elevation: 4
    })
  ])
});

export function getCategory(categoryId) {
  return CATEGORY_DEFINITIONS.find((category) => category.id === categoryId) || CATEGORY_DEFINITIONS[0];
}

export function getLayout(categoryId, layoutId) {
  const canonicalId = canonicalizeRoomLayoutId(layoutId);
  return canonicalId
    ? SHARED_ROOM_LAYOUTS.find((candidate) => candidate.id === canonicalId) || null
    : null;
}

export function getStyle(categoryId, styleId) {
  const category = getCategory(categoryId);
  const normalizedStyleId = category.id === "bookcase"
    ? BOOKCASE_STYLE_ALIASES[styleId] || styleId
    : styleId;
  return category.styles.find((candidate) => candidate.id === normalizedStyleId) || category.styles[0];
}

export function getFinish(finishId) {
  return Object.values(FINISH_OPTIONS).flat().find((finish) => finish.id === finishId) || FINISH_OPTIONS.wood[1];
}

export function getMeasurementFields(categoryId, layoutId) {
  const selectedLayout = getLayout(categoryId, layoutId);
  const fields = [...BASE_MEASUREMENTS];
  const seen = new Set(fields.map((field) => field.id));
  const tags = [
    ...(CATEGORY_MEASUREMENT_TAGS[getCategory(categoryId).id] || []),
    ...(selectedLayout?.tags || [])
  ];

  for (const tag of tags) {
    for (const field of CONDITION_MEASUREMENTS[tag] || []) {
      if (seen.has(field.id)) continue;
      fields.push(field);
      seen.add(field.id);
    }
  }

  return fields;
}

export function getCanonicalRoomMeasurementSemantics(categoryId, layoutId) {
  const scene = getCanonicalRoomScene(layoutId);
  if (!scene) return Object.freeze([]);
  const categorySemantics = scene.id === "clear-wall"
    ? CLEAR_WALL_CATEGORY_MEASUREMENT_SEMANTICS[getCategory(categoryId).id] || []
    : [];
  return Object.freeze([...scene.measurementSemantics, ...categorySemantics]);
}

export function getCanonicalRoomMeasurementFieldIds(categoryId, layoutId) {
  return Object.freeze(
    getCanonicalRoomMeasurementSemantics(categoryId, layoutId)
      .map((semantic) => semantic.fieldId)
  );
}

export function getMeasurementDiagramSpec(categoryId, layoutId) {
  const scene = getCanonicalRoomScene(layoutId);
  if (!scene) return null;
  const fieldsById = new Map(
    getMeasurementFields(categoryId, scene.id).map((field) => [field.id, field])
  );
  const spans = getCanonicalRoomMeasurementSemantics(categoryId, scene.id).map((semantic) => {
    const field = fieldsById.get(semantic.fieldId);
    return Object.freeze({
      ...semantic,
      code: field?.code || "",
      label: field?.label || semantic.fieldId
    });
  });

  return Object.freeze({
    width: scene.camera.frameWidth,
    height: scene.camera.frameHeight,
    layoutId: scene.id,
    feature: scene.feature,
    camera: scene.camera,
    spans: Object.freeze(spans)
  });
}

export function getCompatibleDetails(categoryId, styleId) {
  const selectedStyle = getStyle(categoryId, styleId);
  return Object.freeze({
    doorStyle: selectedStyle.supportsDoors ? DETAIL_OPTIONS.doorStyle : Object.freeze([]),
    hardware: selectedStyle.supportsHardware ? DETAIL_OPTIONS.hardware : Object.freeze([]),
    lighting: selectedStyle.supportsLighting ? DETAIL_OPTIONS.lighting : Object.freeze([]),
    baseStyle: selectedStyle.supportsBase ? DETAIL_OPTIONS.baseStyle : Object.freeze([]),
    topTreatment: selectedStyle.supportsTop ? DETAIL_OPTIONS.topTreatment : Object.freeze([])
  });
}

export function resolvePreviewPresentation(categoryId, styleId, layoutId = null) {
  const selectedLayout = getLayout(categoryId, layoutId);
  const selectedStyle = getStyle(categoryId, styleId);
  const selectedProduct = getProductChoiceForSelection(categoryId, selectedStyle.id);
  const previewKey = selectedLayout
    ? `${categoryId}:${selectedStyle.id}:${selectedLayout.id}`
    : `${categoryId}:${selectedStyle.id}`;
  const exactLayoutAsset = selectedProduct && selectedLayout
    ? PRODUCT_INTEGRATED_PREVIEW_ASSETS[selectedProduct.id]?.[selectedLayout.id] || null
    : null;

  if (exactLayoutAsset && selectedLayout) {
    return Object.freeze({
      previewKey,
      conceptAsset: exactLayoutAsset,
      roomAsset: null,
      productAsset: null,
      categoryId,
      styleId: selectedStyle.id,
      layoutId: selectedLayout.id,
      integratedLayoutId: selectedLayout.id,
      layoutLabel: selectedLayout.label,
      layoutContextAsset: selectedLayout.previewAsset,
      layoutPreviewMode: selectedLayout.previewMode,
      layoutPreviewFit: selectedLayout.previewFit,
      layoutPreviewPosition: selectedLayout.previewPosition,
      installationEnvelopeId: null,
      installationEnvelope: null,
      renderMode: "integrated"
    });
  }

  if ((selectedProduct || categoryId === "bookcase") && selectedLayout) {
    return Object.freeze({
      previewKey,
      conceptAsset: selectedLayout.previewAsset,
      roomAsset: selectedLayout.previewAsset,
      productAsset: null,
      categoryId,
      styleId: selectedStyle.id,
      layoutId: selectedLayout.id,
      integratedLayoutId: null,
      layoutLabel: selectedLayout.label,
      layoutContextAsset: selectedLayout.previewAsset,
      layoutPreviewMode: selectedLayout.previewMode,
      layoutPreviewFit: selectedLayout.previewFit,
      layoutPreviewPosition: selectedLayout.previewPosition,
      installationEnvelopeId: null,
      installationEnvelope: null,
      renderMode: "missing-integrated-scene"
    });
  }

  const conceptAsset = categoryId === "window-storage"
    ? "assets/photos/configurator/concept-window-cabinets-v1.png"
    : selectedStyle.previewAsset;
  return Object.freeze({
    previewKey,
    conceptAsset,
    roomAsset: selectedLayout?.previewAsset || null,
    productAsset: conceptAsset,
    categoryId,
    styleId: selectedStyle.id,
    layoutId: selectedLayout?.id || null,
    integratedLayoutId: null,
    layoutLabel: selectedLayout?.label || null,
    layoutContextAsset: selectedLayout?.previewAsset || null,
    layoutPreviewMode: selectedLayout?.previewMode || "image",
    layoutPreviewFit: selectedLayout?.previewFit || "contain",
    layoutPreviewPosition: selectedLayout?.previewPosition || "50% 50%",
    installationEnvelopeId: null,
    installationEnvelope: null,
    renderMode: selectedLayout ? "concept-with-room-context" : "concept-only"
  });
}

export function resolvePreviewAsset(categoryId, styleId, layoutId = null) {
  return resolvePreviewPresentation(categoryId, styleId, layoutId).conceptAsset;
}

export const GUIDED_MEASUREMENT_PROVENANCE = Object.freeze({
  legacyUniversalEnvelope: Object.freeze({
    wallWidth: Object.freeze({ min: 24, max: 144 }),
    ceilingHeight: Object.freeze({ min: 72, max: 120 }),
    desiredDepth: Object.freeze({ min: 10, max: 24 })
  }),
  source: "bookcase-config.js and bookcase-layout.js legacy production rules",
  policy: "Warnings only in the preliminary customer flow; final field dimensions are confirmed before production."
});
