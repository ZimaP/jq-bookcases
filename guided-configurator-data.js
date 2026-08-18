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
  projection: Object.freeze([
    measurement("projectionWidth", "Projection width", "D", { min: 12, max: 120, defaultValue: 48, position: "feature-left" }),
    measurement("projectionHeight", "Projection height", "E", { min: 12, max: 120, defaultValue: 72, position: "feature-right" }),
    measurement("projectionDepth", "Projection depth", "F", { min: 1, max: 30, defaultValue: 8, position: "feature-bottom" })
  ]),
  window: Object.freeze([
    measurement("windowWidth", "Window width", "D", { min: 12, max: 144, defaultValue: 48, position: "feature-left" }),
    measurement("windowHeight", "Window height", "E", { min: 12, max: 96, defaultValue: 42, position: "feature-right" }),
    measurement("sillHeight", "Sill height", "F", { min: 12, max: 72, defaultValue: 30, position: "feature-bottom" }),
    measurement("windowLeftDistance", "Distance from left wall", "G", { min: 0, max: 144, defaultValue: null, position: "lower-left" }),
    measurement("windowRightDistance", "Distance from right wall", "H", { min: 0, max: 144, defaultValue: null, position: "lower-right" }),
    selectMeasurement("radiatorBelowWindow", "Radiator below window", "I", yesNo, { defaultValue: "no", position: "feature-right" })
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
    measurement("fireplaceLeftWidth", "Available width on left", "I", { min: 12, max: 96, defaultValue: null, position: "lower-left" }),
    measurement("fireplaceRightWidth", "Available width on right", "J", { min: 12, max: 96, defaultValue: null, position: "lower-right" }),
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
  floating: Object.freeze([
    measurement("mountingHeight", "Height above finished floor", "D", {
      required: true,
      min: 6,
      max: 60,
      defaultValue: 18,
      position: "feature-left",
      group: "Room & built-in"
    })
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

export const SHARED_ROOM_LAYOUTS = Object.freeze([
  layout("niche-layout", "Niche Layout", "niche", "recess", ["niche"], {
    previewAsset: "assets/photos/configurator/room-layouts/room-niche-layout-v1.png"
  }),
  layout("left-niche", "Left Niche", "left-niche", "recess", ["niche"], {
    previewAsset: "assets/photos/configurator/room-layouts/room-left-niche-v1.png"
  }),
  layout("right-niche", "Right Niche", "right-niche", "recess", ["niche"], {
    previewAsset: "assets/photos/configurator/room-layouts/room-right-niche-v1.png"
  }),
  layout("clear-wall", "Clear Wall", "clear-wall", "none", [], {
    previewAsset: "assets/photos/configurator/room-layouts/room-clear-wall-v1.png"
  }),
  layout("fireplace-wall", "Fireplace Wall", "clear-wall", "fireplace", ["fireplace"], {
    previewAsset: "assets/photos/configurator/room-layouts/room-fireplace-wall-v1.png"
  }),
  layout("center-recess", "Center Projection", "clear-wall", "recess", ["projection"], {
    previewAsset: "assets/photos/configurator/room-layouts/room-center-projection-v1.png"
  }),
  layout("window-wall", "Window Wall", "clear-wall", "window", ["window"], {
    previewAsset: "assets/photos/configurator/room-layouts/room-window-wall-v1.png"
  }),
  layout("door-wall", "Door Wall", "clear-wall", "door", ["door"], {
    previewAsset: "assets/photos/configurator/room-layouts/room-door-wall-v1.png"
  }),
  layout("corner-wall", "Corner Wall", "corner", "none", ["corner"], {
    previewAsset: "assets/photos/configurator/room-layouts/room-corner-v1.png"
  }),
  layout("double-opening", "Between Openings", "clear-wall", "opening", ["opening"], {
    previewAsset: "assets/photos/configurator/room-layouts/room-double-opening-v1.png"
  })
]);

const MEASUREMENT_DIAGRAM_AUTHORING_SIZE = Object.freeze({
  width: 1000,
  height: 640
});

const ROOM_MEASUREMENT_DIAGRAM_VIEWBOXES = Object.freeze({
  "niche-layout": Object.freeze({ width: 627, height: 627, drawingTop: 160, drawingHeight: 307 }),
  "left-niche": Object.freeze({ width: 627, height: 627, drawingTop: 160, drawingHeight: 307 }),
  "right-niche": Object.freeze({ width: 627, height: 627, drawingTop: 160, drawingHeight: 307 }),
  "clear-wall": Object.freeze({ width: 1536, height: 1024, drawingTop: 145, drawingHeight: 734 }),
  "fireplace-wall": Object.freeze({ width: 627, height: 627, drawingTop: 160, drawingHeight: 307 }),
  "center-recess": Object.freeze({ width: 1536, height: 1024, drawingTop: 145, drawingHeight: 734 }),
  "window-wall": Object.freeze({ width: 1536, height: 1024, drawingTop: 145, drawingHeight: 734 }),
  "door-wall": Object.freeze({ width: 1536, height: 1024, drawingTop: 145, drawingHeight: 734 }),
  "corner-wall": Object.freeze({ width: 1536, height: 1024, drawingTop: 145, drawingHeight: 734 }),
  "double-opening": Object.freeze({ width: 1536, height: 1024, drawingTop: 145, drawingHeight: 734 })
});

const dimensionSpan = (fieldId, axis, line, extensions, label, options = {}) => Object.freeze({
  fieldId,
  axis,
  line: Object.freeze(line),
  extensions: Object.freeze(extensions.map((extension) => Object.freeze(extension))),
  label: Object.freeze(label),
  priority: "primary",
  labelOverride: "",
  endStyle: axis === "depth" ? "tick" : "arrow",
  extensionRole: axis === "depth" ? "tick" : "witness",
  sourceWidth: MEASUREMENT_DIAGRAM_AUTHORING_SIZE.width,
  sourceHeight: MEASUREMENT_DIAGRAM_AUTHORING_SIZE.height,
  ...options
});

const BASE_MEASUREMENT_DIAGRAM_SPANS = Object.freeze([
  dimensionSpan(
    "wallWidth",
    "horizontal",
    [145, 86, 870, 86],
    [[145, 56, 145, 112], [870, 56, 870, 112]],
    { x: 508, y: 86 },
    { priority: "perimeter" }
  ),
  dimensionSpan(
    "ceilingHeight",
    "vertical",
    [94, 68, 94, 532],
    [[64, 68, 119, 68], [64, 532, 119, 532]],
    // The label stays within the cover-safe band when 3:2 room art is sliced
    // into the narrower iPad-landscape measurement workspace.
    { x: 180, y: 300 },
    { priority: "perimeter" }
  ),
  dimensionSpan(
    "desiredDepth",
    "depth",
    [824, 518, 964, 608],
    [[810, 528, 835, 507], [953, 619, 977, 598]],
    // Mirror the ceiling label's cover-safe inset at the opposite edge.
    { x: 825, y: 558 },
    { priority: "perimeter" }
  )
]);

const DOOR_BASE_MEASUREMENT_DIAGRAM_SPANS = Object.freeze([
  dimensionSpan(
    "wallWidth",
    "horizontal",
    [240, 178, 1295, 178],
    [[240, 157, 240, 204], [1295, 157, 1295, 204]],
    { x: 767.5, y: 178 },
    {
      priority: "perimeter",
      sourceWidth: 1536,
      sourceHeight: 1024
    }
  ),
  dimensionSpan(
    "ceilingHeight",
    "vertical",
    [270, 157, 270, 758],
    [[240, 157, 292, 157], [240, 758, 292, 758]],
    { x: 382, y: 457.5 },
    {
      priority: "perimeter",
      sourceWidth: 1536,
      sourceHeight: 1024
    }
  ),
  dimensionSpan(
    "desiredDepth",
    "depth",
    [1295, 758, 1452, 840],
    [[1287, 773, 1303, 743], [1444, 855, 1460, 825]],
    { x: 1352, y: 690 },
    {
      priority: "perimeter",
      sourceWidth: 1536,
      sourceHeight: 1024
    }
  )
]);

const NICHE_MEASUREMENT_DIAGRAM_SPANS = Object.freeze([
  dimensionSpan(
    "nicheWidth",
    "horizontal",
    [238, 200, 762, 200],
    [[238, 172, 238, 226], [762, 172, 762, 226]],
    { x: 500, y: 200 }
  ),
  dimensionSpan(
    "nicheHeight",
    "vertical",
    [794, 202, 794, 518],
    [[772, 202, 816, 202], [772, 518, 816, 518]],
    { x: 794, y: 360 }
  ),
  dimensionSpan(
    "nicheDepth",
    "depth",
    [224, 432, 151, 524],
    [[212, 422, 236, 442], [139, 514, 163, 534]],
    { x: 220, y: 470 },
    { priority: "auxiliary" }
  )
]);

const LEFT_NICHE_MEASUREMENT_DIAGRAM_SPANS = Object.freeze([
  dimensionSpan(
    "nicheWidth",
    "horizontal",
    [198, 200, 785, 200],
    [[198, 172, 198, 226], [785, 172, 785, 226]],
    { x: 492, y: 200 }
  ),
  dimensionSpan(
    "nicheHeight",
    "vertical",
    [818, 202, 818, 518],
    [[796, 202, 840, 202], [796, 518, 840, 518]],
    { x: 818, y: 360 }
  ),
  dimensionSpan(
    "nicheDepth",
    "depth",
    [195, 426, 126, 520],
    [[183, 416, 207, 436], [114, 510, 138, 530]],
    { x: 194, y: 468 },
    { priority: "auxiliary" }
  )
]);

const RIGHT_NICHE_MEASUREMENT_DIAGRAM_SPANS = Object.freeze([
  dimensionSpan(
    "nicheWidth",
    "horizontal",
    [215, 200, 802, 200],
    [[215, 172, 215, 226], [802, 172, 802, 226]],
    { x: 508, y: 200 }
  ),
  dimensionSpan(
    "nicheHeight",
    "vertical",
    [842, 202, 842, 518],
    [[820, 202, 864, 202], [820, 518, 864, 518]],
    { x: 842, y: 360 }
  ),
  dimensionSpan(
    "nicheDepth",
    "depth",
    [805, 426, 875, 520],
    [[793, 436, 817, 416], [863, 530, 887, 510]],
    { x: 806, y: 468 },
    { priority: "auxiliary" }
  )
]);

const CENTER_PROJECTION_MEASUREMENT_DIAGRAM_SPANS = Object.freeze([
  dimensionSpan(
    "projectionWidth",
    "horizontal",
    [386, 192, 614, 192],
    [[386, 164, 386, 220], [614, 164, 614, 220]],
    { x: 500, y: 192 },
    { labelOverride: "Projection width" }
  ),
  dimensionSpan(
    "projectionHeight",
    "vertical",
    [654, 194, 654, 520],
    [[632, 194, 676, 194], [632, 520, 676, 520]],
    { x: 654, y: 357 },
    { labelOverride: "Projection height" }
  ),
  dimensionSpan(
    "projectionDepth",
    "depth",
    [615, 436, 692, 520],
    [[603, 446, 627, 426], [680, 530, 704, 510]],
    { x: 682, y: 458 },
    { priority: "auxiliary", labelOverride: "Projection depth" }
  )
]);

const FIREPLACE_MEASUREMENT_DIAGRAM_SPANS = Object.freeze([
  dimensionSpan(
    "fireplaceWidth",
    "horizontal",
    [438, 374, 562, 374],
    [[438, 348, 438, 400], [562, 348, 562, 400]],
    { x: 500, y: 374 }
  ),
  dimensionSpan(
    "fireplaceHeight",
    "vertical",
    [596, 378, 596, 518],
    [[574, 378, 618, 378], [574, 518, 618, 518]],
    { x: 596, y: 448 }
  ),
  dimensionSpan(
    "mantelWidth",
    "horizontal",
    [408, 318, 592, 318],
    [[408, 294, 408, 340], [592, 294, 592, 340]],
    { x: 500, y: 318 },
    { priority: "auxiliary" }
  )
]);

const WINDOW_MEASUREMENT_DIAGRAM_SPANS = Object.freeze([
  dimensionSpan(
    "windowWidth",
    "horizontal",
    [420, 238, 580, 238],
    [[420, 212, 420, 266], [580, 212, 580, 266]],
    { x: 500, y: 238 }
  ),
  dimensionSpan(
    "windowHeight",
    "vertical",
    [620, 246, 620, 432],
    [[598, 246, 642, 246], [598, 432, 642, 432]],
    { x: 620, y: 339 }
  ),
  dimensionSpan(
    "sillHeight",
    "vertical",
    [672, 432, 672, 522],
    [[650, 432, 694, 432], [650, 522, 694, 522]],
    { x: 672, y: 477 },
    { priority: "auxiliary" }
  )
]);

const DOOR_MEASUREMENT_DIAGRAM_SPANS = Object.freeze([
  dimensionSpan(
    "doorWidth",
    "horizontal",
    [659, 232, 880, 232],
    [[659, 208, 659, 279], [880, 208, 880, 279]],
    { x: 769.5, y: 232 },
    { sourceWidth: 1536, sourceHeight: 1024 }
  ),
  dimensionSpan(
    "doorHeight",
    "vertical",
    [940, 279, 940, 758],
    [[880, 279, 960, 279], [880, 758, 960, 758]],
    { x: 1048, y: 518.5 },
    { sourceWidth: 1536, sourceHeight: 1024 }
  ),
  dimensionSpan(
    "doorLeftDistance",
    "horizontal",
    [240, 638, 639, 638],
    [[240, 610, 240, 666], [639, 610, 639, 666]],
    { x: 439.5, y: 638 },
    {
      priority: "auxiliary",
      sourceWidth: 1536,
      sourceHeight: 1024
    }
  )
]);

const CORNER_MEASUREMENT_DIAGRAM_SPANS = Object.freeze([
  dimensionSpan(
    "cornerReturn",
    "horizontal",
    [548, 252, 850, 252],
    [[548, 226, 548, 280], [850, 226, 850, 280]],
    { x: 699, y: 252 },
    { labelOverride: "Corner wall return" }
  )
]);

const DOUBLE_OPENING_MEASUREMENT_DIAGRAM_SPANS = Object.freeze([
  dimensionSpan(
    "openingLeftDistance",
    "horizontal",
    [118, 478, 302, 478],
    [[118, 452, 118, 506], [302, 452, 302, 506]],
    { x: 210, y: 478 }
  ),
  dimensionSpan(
    "openingRightDistance",
    "horizontal",
    [698, 478, 882, 478],
    [[698, 452, 698, 506], [882, 452, 882, 506]],
    { x: 790, y: 478 }
  )
]);

const TV_MEASUREMENT_DIAGRAM_SPANS = Object.freeze([
  dimensionSpan(
    "tvScreenSize",
    "diagonal",
    [414, 276, 586, 382],
    [[402, 286, 426, 266], [574, 392, 598, 372]],
    { x: 438, y: 294 },
    { labelOverride: "TV diagonal" }
  ),
  dimensionSpan(
    "tvHeight",
    "vertical",
    [626, 268, 626, 390],
    [[604, 268, 648, 268], [604, 390, 648, 390]],
    { x: 626, y: 329 },
    { labelOverride: "TV height" }
  )
]);

const FLOATING_MEASUREMENT_DIAGRAM_SPANS = Object.freeze([
  dimensionSpan(
    "mountingHeight",
    "vertical",
    [348, 420, 348, 506],
    [[326, 420, 370, 420], [326, 506, 370, 506]],
    { x: 348, y: 463 },
    { labelOverride: "Height above floor" }
  )
]);

const RADIATOR_MEASUREMENT_DIAGRAM_SPANS = Object.freeze([
  dimensionSpan(
    "radiatorWidth",
    "horizontal",
    [368, 400, 632, 400],
    [[368, 374, 368, 428], [632, 374, 632, 428]],
    { x: 500, y: 400 }
  ),
  dimensionSpan(
    "radiatorHeight",
    "vertical",
    [674, 404, 674, 506],
    [[652, 404, 696, 404], [652, 506, 696, 506]],
    { x: 674, y: 455 }
  ),
  dimensionSpan(
    "radiatorDepth",
    "depth",
    [635, 474, 700, 524],
    [[625, 484, 645, 464], [690, 534, 710, 514]],
    { x: 704, y: 488 },
    { priority: "auxiliary" }
  )
]);

const ROOM_MEASUREMENT_DIAGRAM_SPANS = Object.freeze({
  "niche-layout": NICHE_MEASUREMENT_DIAGRAM_SPANS,
  "left-niche": LEFT_NICHE_MEASUREMENT_DIAGRAM_SPANS,
  "right-niche": RIGHT_NICHE_MEASUREMENT_DIAGRAM_SPANS,
  "clear-wall": Object.freeze([]),
  "fireplace-wall": FIREPLACE_MEASUREMENT_DIAGRAM_SPANS,
  "center-recess": CENTER_PROJECTION_MEASUREMENT_DIAGRAM_SPANS,
  "window-wall": WINDOW_MEASUREMENT_DIAGRAM_SPANS,
  "door-wall": DOOR_MEASUREMENT_DIAGRAM_SPANS,
  "corner-wall": CORNER_MEASUREMENT_DIAGRAM_SPANS,
  "double-opening": DOUBLE_OPENING_MEASUREMENT_DIAGRAM_SPANS
});

const CLEAR_WALL_PRODUCT_MEASUREMENT_DIAGRAM_SPANS = Object.freeze({
  "tv-unit": TV_MEASUREMENT_DIAGRAM_SPANS,
  "floating-storage": FLOATING_MEASUREMENT_DIAGRAM_SPANS,
  "window-storage": WINDOW_MEASUREMENT_DIAGRAM_SPANS,
  "radiator-cover": RADIATOR_MEASUREMENT_DIAGRAM_SPANS
});

export const PUBLIC_BOOKCASE_STYLE_IDS = Object.freeze([
  "cabinet-base-shelves",
  "drawer-base-shelves",
  "full-open-shelving"
]);

/*
 * Clear Wall keeps the exact selected room photograph as an immutable base.
 * These full-canvas PNGs contain cabinetry pixels only; transparent pixels
 * reveal the same room used by the measurement step. The normalized envelope
 * documents the authored furniture bounds for rendering and visual QA. The v3
 * layers are empty-shelf, uniform-scale rebuilds from the approved front-on concept sources:
 * their crowns meet the rear-wall ceiling plane, their proportions stay natural,
 * and their bases retain only a shallow built-in floor projection.
 */
export const CLEAR_WALL_BOOKCASE_FURNITURE_PRESENTATIONS = Object.freeze({
  "cabinet-base-shelves": Object.freeze({
    furnitureAsset: "assets/photos/configurator/furniture/bookcase/cabinet-base-shelves/clear-wall-furniture-v3.png",
    finishMaskAsset: "assets/photos/configurator/furniture/bookcase/cabinet-base-shelves/clear-wall-finish-mask-v4.png",
    installationEnvelope: Object.freeze({ x: 0.259765625, y: 0.10546875, width: 0.48046875, height: 0.58984375 })
  }),
  "drawer-base-shelves": Object.freeze({
    furnitureAsset: "assets/photos/configurator/furniture/bookcase/drawer-base-shelves/clear-wall-furniture-v3.png",
    finishMaskAsset: "assets/photos/configurator/furniture/bookcase/drawer-base-shelves/clear-wall-finish-mask-v4.png",
    installationEnvelope: Object.freeze({ x: 0.2682291666666667, y: 0.10546875, width: 0.462890625, height: 0.58984375 })
  }),
  "full-open-shelving": Object.freeze({
    furnitureAsset: "assets/photos/configurator/furniture/bookcase/full-open-shelving/clear-wall-furniture-v3.png",
    finishMaskAsset: "assets/photos/configurator/furniture/bookcase/full-open-shelving/clear-wall-finish-mask-v4.png",
    installationEnvelope: Object.freeze({ x: 0.23177083333333334, y: 0.10546875, width: 0.537109375, height: 0.58984375 })
  })
});

/**
 * Customer-facing Bookcase previews are a strict construction × room matrix.
 *
 * Once a room is selected, a style-only photograph is not an acceptable
 * fallback: the selected room topology must be part of the rendered scene.
 * Every style exposed by the new-project Bookcase UI therefore has an exact
 * asset for every shared room condition. Clear Wall is the deliberate layered
 * exception: this matrix stores its transparent furniture asset, while
 * resolvePreviewPresentation() supplies the selected room as the base layer.
 */
export const BOOKCASE_INTEGRATED_PREVIEW_ASSETS = Object.freeze({
  "niche-layout": Object.freeze({
    "cabinet-base-shelves": "assets/photos/configurator/integrated/bookcase/cabinet-base-shelves/niche-layout-v2.png",
    "drawer-base-shelves": "assets/photos/configurator/integrated/bookcase/drawer-base-shelves/niche-layout-v3.png",
    "full-open-shelving": "assets/photos/configurator/integrated/bookcase/full-open-shelving/niche-layout-v2.png"
  }),
  "left-niche": Object.freeze({
    "cabinet-base-shelves": "assets/photos/configurator/integrated/bookcase/cabinet-base-shelves/left-niche-v2.png",
    "drawer-base-shelves": "assets/photos/configurator/integrated/bookcase/drawer-base-shelves/left-niche-v3.png",
    "full-open-shelving": "assets/photos/configurator/integrated/bookcase/full-open-shelving/left-niche-v2.png"
  }),
  "right-niche": Object.freeze({
    "cabinet-base-shelves": "assets/photos/configurator/integrated/bookcase/cabinet-base-shelves/right-niche-v2.png",
    "drawer-base-shelves": "assets/photos/configurator/integrated/bookcase/drawer-base-shelves/right-niche-v3.png",
    "full-open-shelving": "assets/photos/configurator/integrated/bookcase/full-open-shelving/right-niche-v2.png"
  }),
  "clear-wall": Object.freeze({
    "cabinet-base-shelves": CLEAR_WALL_BOOKCASE_FURNITURE_PRESENTATIONS["cabinet-base-shelves"].furnitureAsset,
    "drawer-base-shelves": CLEAR_WALL_BOOKCASE_FURNITURE_PRESENTATIONS["drawer-base-shelves"].furnitureAsset,
    "full-open-shelving": CLEAR_WALL_BOOKCASE_FURNITURE_PRESENTATIONS["full-open-shelving"].furnitureAsset
  }),
  "fireplace-wall": Object.freeze({
    "cabinet-base-shelves": "assets/photos/configurator/integrated/bookcase/cabinet-base-shelves/fireplace-wall-v2.png",
    "drawer-base-shelves": "assets/photos/configurator/integrated/bookcase/drawer-base-shelves/fireplace-wall-v2.png",
    "full-open-shelving": "assets/photos/configurator/integrated/bookcase/full-open-shelving/fireplace-wall-v2.png"
  }),
  "center-recess": Object.freeze({
    "cabinet-base-shelves": "assets/photos/configurator/integrated/bookcase/cabinet-base-shelves/center-recess-v2.png",
    "drawer-base-shelves": "assets/photos/configurator/integrated/bookcase/drawer-base-shelves/center-recess-v2.png",
    "full-open-shelving": "assets/photos/configurator/integrated/bookcase/full-open-shelving/center-recess-v2.png"
  }),
  "window-wall": Object.freeze({
    "cabinet-base-shelves": "assets/photos/configurator/concept-window-cabinets-v2.png",
    "drawer-base-shelves": "assets/photos/configurator/integrated/bookcase/drawer-base-shelves/window-wall-v2.png",
    "full-open-shelving": "assets/photos/configurator/integrated/bookcase/full-open-shelving/window-wall-v2.png"
  }),
  "door-wall": Object.freeze({
    "cabinet-base-shelves": "assets/photos/configurator/integrated/bookcase/cabinet-base-shelves/door-wall-v2.png",
    "drawer-base-shelves": "assets/photos/configurator/integrated/bookcase/drawer-base-shelves/door-wall-v2.png",
    "full-open-shelving": "assets/photos/configurator/integrated/bookcase/full-open-shelving/door-wall-v2.png"
  }),
  "corner-wall": Object.freeze({
    "cabinet-base-shelves": "assets/photos/configurator/integrated/bookcase/cabinet-base-shelves/corner-wall-v2.png",
    "drawer-base-shelves": "assets/photos/configurator/integrated/bookcase/drawer-base-shelves/corner-wall-v2.png",
    "full-open-shelving": "assets/photos/configurator/integrated/bookcase/full-open-shelving/corner-wall-v2.png"
  }),
  "double-opening": Object.freeze({
    "cabinet-base-shelves": "assets/photos/configurator/concept-cabinets-shelves-between-openings-v2.png",
    "drawer-base-shelves": "assets/photos/configurator/concept-drawers-shelves-between-openings-v2.png",
    "full-open-shelving": "assets/photos/configurator/concept-full-shelving-between-openings-v2.png"
  })
});

export const CATEGORY_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "bookcase",
    label: "Bookcase",
    icon: "bookcase",
    description: "Built-in shelving and storage designed around your room.",
    productPreviewAsset: "assets/photos/configurator/concept-cabinets-shelves-v2.png",
    productPreviewPosition: "50% 45%",
    layouts: SHARED_ROOM_LAYOUTS,
    styles: Object.freeze([
      style("cabinet-base-shelves", "Cabinets + Shelves", {
        description: "Open display above concealed cabinet storage.",
        drawingRef: "Drawing 7",
        previewAsset: "assets/photos/configurator/concept-cabinets-shelves-v2.png"
      }),
      style("drawer-base-shelves", "Drawers + Shelves", {
        description: "Six-drawer base with open display shelving.",
        drawingRef: "Drawings 5–6",
        supportsDoors: false,
        previewAsset: "assets/photos/configurator/concept-drawers-shelves-v2.png"
      }),
      style("tv-wall-cabinets", "TV Wall + Cabinets", {
        description: "Centered media zone with shelving and closed storage.",
        drawingRef: "Drawing 4",
        previewAsset: "assets/photos/configurator/concept-tv-wall-v2.png"
      }),
      style("full-open-shelving", "Full Open Shelving", {
        description: "Full-height display shelving without lower storage.",
        drawingRef: "Drawings 1–2",
        supportsDoors: false,
        supportsHardware: false,
        previewAsset: "assets/photos/configurator/concept-full-shelving-v2.png"
      })
    ])
  }),
  Object.freeze({
    id: "tv-unit",
    label: "TV Unit",
    icon: "tv",
    description: "A balanced media wall with concealed equipment and curated display space.",
    productPreviewAsset: "assets/photos/configurator/concept-tv-wall-v2.png",
    productPreviewPosition: "50% 45%",
    layouts: SHARED_ROOM_LAYOUTS,
    styles: Object.freeze([
      style("open-media", "Open Media Shelving", { previewAsset: "assets/photos/configurator/concept-tv-wall-v2.png" }),
      style("low-media-console", "Low Media Console", { previewAsset: "assets/photos/configurator/concept-tv-wall-v2.png" }),
      style("framed-tv-wall", "Framed TV Wall", {
        description: "Centered television, open display shelves, and concealed lower storage.",
        drawingRef: "Drawing 4",
        previewAsset: "assets/photos/configurator/concept-tv-wall-v2.png"
      }),
      style("library-media", "Library + Media", { previewAsset: "assets/photos/configurator/concept-tv-wall-v2.png" }),
      style("closed-media-storage", "Closed Media Storage", { previewAsset: "assets/photos/configurator/concept-tv-wall-v2.png" })
    ])
  }),
  Object.freeze({
    id: "floating-storage",
    label: "Floating Storage",
    icon: "floating",
    description: "Lightweight wall-mounted storage tailored to your room condition.",
    productPreviewAsset: "assets/photos/configurator/product-floating-storage-v2.png",
    productPreviewPosition: "50% 52%",
    layouts: SHARED_ROOM_LAYOUTS,
    styles: Object.freeze([
      style("slim-floating-console", "Slim Floating Console", { supportsLighting: false, supportsBase: false, supportsTop: false, previewAsset: "assets/photos/configurator/product-floating-storage-v2.png" }),
      style("floating-drawer-bank", "Floating Drawer Bank", { supportsBase: false, supportsTop: false, previewAsset: "assets/photos/configurator/product-floating-storage-v2.png" }),
      style("floating-cabinets", "Floating Cabinets", { supportsBase: false, supportsTop: false, previewAsset: "assets/photos/configurator/product-floating-storage-v2.png" }),
      style("display-ledge-storage", "Display Ledge + Storage", { supportsBase: false, supportsTop: false, previewAsset: "assets/photos/configurator/product-floating-storage-v2.png" }),
      style("asymmetric-floating", "Asymmetric Floating Unit", { supportsBase: false, supportsTop: false, previewAsset: "assets/photos/configurator/product-floating-storage-v2.png" })
    ])
  }),
  Object.freeze({
    id: "window-storage",
    label: "Window Storage",
    icon: "window",
    description: "Window seating and storage that keeps light at the center of the design.",
    productPreviewAsset: "assets/photos/configurator/concept-window-cabinets-v2.png",
    productPreviewPosition: "50% 45%",
    layouts: SHARED_ROOM_LAYOUTS,
    styles: Object.freeze([
      style("window-seat-storage", "Window Seat + Storage", { previewAsset: "assets/photos/configurator/concept-window-cabinets-v2.png" }),
      style("side-bookcases", "Side Bookcases", { previewAsset: "assets/photos/configurator/concept-window-cabinets-v2.png" }),
      style("low-window-cabinets", "Low Window Cabinets", { previewAsset: "assets/photos/configurator/concept-window-cabinets-v2.png" }),
      style("display-window-wall", "Display Window Wall", { previewAsset: "assets/photos/configurator/concept-window-cabinets-v2.png" }),
      style("library-window", "Library Window", { previewAsset: "assets/photos/configurator/concept-window-cabinets-v2.png" })
    ])
  }),
  Object.freeze({
    id: "radiator-cover",
    label: "Radiator Cover",
    icon: "radiator",
    description: "A ventilated cover with optional storage and display elements.",
    productPreviewAsset: "assets/photos/configurator/product-radiator-cover-v2.png",
    productPreviewPosition: "50% 55%",
    layouts: SHARED_ROOM_LAYOUTS,
    styles: Object.freeze([
      style("clean-slat-cover", "Clean Slat Cover", { supportsDoors: false, supportsHardware: false, supportsLighting: false, supportsTop: false, previewAsset: "assets/photos/configurator/product-radiator-cover-v2.png" }),
      style("shaker-radiator-cover", "Shaker Radiator Cover", { supportsHardware: false, supportsLighting: false, previewAsset: "assets/photos/configurator/product-radiator-cover-v2.png" }),
      style("cover-side-cabinets", "Cover + Side Cabinets", { previewAsset: "assets/photos/configurator/product-radiator-cover-v2.png" }),
      style("cover-display-shelves", "Cover + Display Shelves", { supportsDoors: false, supportsHardware: false, previewAsset: "assets/photos/configurator/product-radiator-cover-v2.png" }),
      style("library-radiator-wall", "Library Radiator Wall", { previewAsset: "assets/photos/configurator/product-radiator-cover-v2.png" })
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
    description: "Open shelving with concealed lower cabinets.",
    previewPosition: "50% 25%"
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

/**
 * Public progress-release availability is intentionally narrower than the
 * internal product catalog. The catalog remains intact for saved-project
 * fidelity and deterministic engine contracts, while this identifier is the
 * only product that a customer can start or resume as an active configuration
 * in the four-step preview.
 */
export const PUBLIC_CONFIGURATOR_PRODUCT_ID = "cabinet-shelves";
export const PUBLIC_CONFIGURATOR_LAYOUT_ID = "fireplace-wall";

export const PUBLIC_CONFIGURATOR_PRODUCT_CHOICES = Object.freeze(
  PRODUCT_CHOICES.filter((choice) => choice.id === PUBLIC_CONFIGURATOR_PRODUCT_ID)
);

export const PUBLIC_CONFIGURATOR_COMING_SOON_CHOICES = Object.freeze(
  PRODUCT_CHOICES.filter((choice) => choice.id !== PUBLIC_CONFIGURATOR_PRODUCT_ID)
);

export const PUBLIC_CONFIGURATOR_LAYOUT_CHOICES = Object.freeze(
  SHARED_ROOM_LAYOUTS.filter((choice) => choice.id === PUBLIC_CONFIGURATOR_LAYOUT_ID)
);

export const PUBLIC_CONFIGURATOR_COMING_SOON_LAYOUTS = Object.freeze(
  SHARED_ROOM_LAYOUTS.filter((choice) => choice.id !== PUBLIC_CONFIGURATOR_LAYOUT_ID)
);

const NATIVE_PRODUCT_SCENES = Object.freeze({
  "tv-unit": Object.freeze({
    "clear-wall": "assets/photos/configurator/concept-tv-wall-v2.png"
  }),
  "floating-storage": Object.freeze({
    "clear-wall": "assets/photos/configurator/product-floating-storage-v2.png"
  }),
  "window-storage": Object.freeze({
    "window-wall": "assets/photos/configurator/concept-window-cabinets-v2.png"
  }),
  "radiator-cover": Object.freeze({
    "window-wall": "assets/photos/configurator/product-radiator-cover-v2.png"
  })
});

const PRODUCT_SCENE_ASSET_OVERRIDES = Object.freeze({
  "window-storage:window-seat-storage:clear-wall":
    "assets/photos/configurator/integrated/window-storage/window-seat-storage/clear-wall-v3.png",
  "tv-unit:framed-tv-wall:double-opening": "assets/photos/configurator/integrated/tv-unit/framed-tv-wall/double-opening-v3.png",
  "floating-storage:floating-drawer-bank:double-opening": "assets/photos/configurator/integrated/floating-storage/floating-drawer-bank/double-opening-v4.png",
  "window-storage:window-seat-storage:double-opening": "assets/photos/configurator/integrated/window-storage/window-seat-storage/double-opening-v3.png",
  "radiator-cover:clean-slat-cover:double-opening": "assets/photos/configurator/integrated/radiator-cover/clean-slat-cover/double-opening-v3.png"
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
        const integratedAsset = `assets/photos/configurator/integrated/${choice.categoryId}/${choice.styleId}/${roomLayout.id}-v2.png`;
        return [
          roomLayout.id,
          PRODUCT_SCENE_ASSET_OVERRIDES[previewKey] || bookcaseAsset || nativeAsset || integratedAsset
        ];
      })
    ))
  ])
));

/*
 * Concept media is rendered from one opaque, room-correct composite. The
 * descriptor below is the shared contract used by the photograph and its
 * finish mask. Integrated assets are authored at 1536 × 1024; only the three
 * approved product-card concepts below use a different native canvas.
 */
const PREVIEW_MEDIA_OVERRIDES = Object.freeze({
  "assets/photos/configurator/concept-cabinets-shelves-v2.png": Object.freeze({
    width: 1254,
    height: 1254
  }),
  "assets/photos/configurator/concept-drawers-shelves-v2.png": Object.freeze({
    width: 1448,
    height: 1086
  }),
  "assets/photos/configurator/concept-window-cabinets-v2.png": Object.freeze({
    width: 1448,
    height: 1086
  })
});

/*
 * Finish color is allowed to touch only pixels approved by an authored
 * material matte. Keeping the complete source-to-mask relationship explicit
 * makes the renderer fail closed: a new preview cannot silently inherit a
 * filename-derived rectangle that recolors the room, props, or hardware.
 */
export const PREVIEW_FINISH_MASK_ASSETS = Object.freeze({
  "assets/photos/configurator/concept-cabinets-shelves-between-openings-v2.png":
    "assets/photos/configurator/concept-cabinets-shelves-between-openings-finish-mask-v4.png",
  "assets/photos/configurator/concept-drawers-shelves-between-openings-v2.png":
    "assets/photos/configurator/concept-drawers-shelves-between-openings-finish-mask-v4.png",
  "assets/photos/configurator/concept-full-shelving-between-openings-v2.png":
    "assets/photos/configurator/concept-full-shelving-between-openings-finish-mask-v4.png",
  "assets/photos/configurator/concept-tv-wall-v2.png":
    "assets/photos/configurator/concept-tv-wall-finish-mask-v4.png",
  "assets/photos/configurator/concept-window-cabinets-v2.png":
    "assets/photos/configurator/concept-window-cabinets-finish-mask-v4.png",
  "assets/photos/configurator/furniture/bookcase/cabinet-base-shelves/clear-wall-furniture-v3.png":
    "assets/photos/configurator/furniture/bookcase/cabinet-base-shelves/clear-wall-finish-mask-v4.png",
  "assets/photos/configurator/furniture/bookcase/drawer-base-shelves/clear-wall-furniture-v3.png":
    "assets/photos/configurator/furniture/bookcase/drawer-base-shelves/clear-wall-finish-mask-v4.png",
  "assets/photos/configurator/furniture/bookcase/full-open-shelving/clear-wall-furniture-v3.png":
    "assets/photos/configurator/furniture/bookcase/full-open-shelving/clear-wall-finish-mask-v4.png",
  "assets/photos/configurator/integrated/bookcase/cabinet-base-shelves/center-recess-v2.png":
    "assets/photos/configurator/integrated/bookcase/cabinet-base-shelves/center-recess-finish-mask-v4.png",
  "assets/photos/configurator/integrated/bookcase/cabinet-base-shelves/corner-wall-v2.png":
    "assets/photos/configurator/integrated/bookcase/cabinet-base-shelves/corner-wall-finish-mask-v4.png",
  "assets/photos/configurator/integrated/bookcase/cabinet-base-shelves/door-wall-v2.png":
    "assets/photos/configurator/integrated/bookcase/cabinet-base-shelves/door-wall-finish-mask-v4.png",
  "assets/photos/configurator/integrated/bookcase/cabinet-base-shelves/fireplace-wall-v2.png":
    "assets/photos/configurator/integrated/bookcase/cabinet-base-shelves/fireplace-wall-finish-mask-v4.png",
  "assets/photos/configurator/integrated/bookcase/cabinet-base-shelves/left-niche-v2.png":
    "assets/photos/configurator/integrated/bookcase/cabinet-base-shelves/left-niche-finish-mask-v4.png",
  "assets/photos/configurator/integrated/bookcase/cabinet-base-shelves/niche-layout-v2.png":
    "assets/photos/configurator/integrated/bookcase/cabinet-base-shelves/niche-layout-finish-mask-v4.png",
  "assets/photos/configurator/integrated/bookcase/cabinet-base-shelves/right-niche-v2.png":
    "assets/photos/configurator/integrated/bookcase/cabinet-base-shelves/right-niche-finish-mask-v4.png",
  "assets/photos/configurator/integrated/bookcase/drawer-base-shelves/center-recess-v2.png":
    "assets/photos/configurator/integrated/bookcase/drawer-base-shelves/center-recess-finish-mask-v4.png",
  "assets/photos/configurator/integrated/bookcase/drawer-base-shelves/corner-wall-v2.png":
    "assets/photos/configurator/integrated/bookcase/drawer-base-shelves/corner-wall-finish-mask-v4.png",
  "assets/photos/configurator/integrated/bookcase/drawer-base-shelves/door-wall-v2.png":
    "assets/photos/configurator/integrated/bookcase/drawer-base-shelves/door-wall-finish-mask-v4.png",
  "assets/photos/configurator/integrated/bookcase/drawer-base-shelves/fireplace-wall-v2.png":
    "assets/photos/configurator/integrated/bookcase/drawer-base-shelves/fireplace-wall-finish-mask-v4.png",
  "assets/photos/configurator/integrated/bookcase/drawer-base-shelves/left-niche-v3.png":
    "assets/photos/configurator/integrated/bookcase/drawer-base-shelves/left-niche-finish-mask-v4.png",
  "assets/photos/configurator/integrated/bookcase/drawer-base-shelves/niche-layout-v3.png":
    "assets/photos/configurator/integrated/bookcase/drawer-base-shelves/niche-layout-finish-mask-v4.png",
  "assets/photos/configurator/integrated/bookcase/drawer-base-shelves/right-niche-v3.png":
    "assets/photos/configurator/integrated/bookcase/drawer-base-shelves/right-niche-finish-mask-v4.png",
  "assets/photos/configurator/integrated/bookcase/drawer-base-shelves/window-wall-v2.png":
    "assets/photos/configurator/integrated/bookcase/drawer-base-shelves/window-wall-finish-mask-v4.png",
  "assets/photos/configurator/integrated/bookcase/full-open-shelving/center-recess-v2.png":
    "assets/photos/configurator/integrated/bookcase/full-open-shelving/center-recess-finish-mask-v4.png",
  "assets/photos/configurator/integrated/bookcase/full-open-shelving/corner-wall-v2.png":
    "assets/photos/configurator/integrated/bookcase/full-open-shelving/corner-wall-finish-mask-v4.png",
  "assets/photos/configurator/integrated/bookcase/full-open-shelving/door-wall-v2.png":
    "assets/photos/configurator/integrated/bookcase/full-open-shelving/door-wall-finish-mask-v4.png",
  "assets/photos/configurator/integrated/bookcase/full-open-shelving/fireplace-wall-v2.png":
    "assets/photos/configurator/integrated/bookcase/full-open-shelving/fireplace-wall-finish-mask-v4.png",
  "assets/photos/configurator/integrated/bookcase/full-open-shelving/left-niche-v2.png":
    "assets/photos/configurator/integrated/bookcase/full-open-shelving/left-niche-finish-mask-v4.png",
  "assets/photos/configurator/integrated/bookcase/full-open-shelving/niche-layout-v2.png":
    "assets/photos/configurator/integrated/bookcase/full-open-shelving/niche-layout-finish-mask-v4.png",
  "assets/photos/configurator/integrated/bookcase/full-open-shelving/right-niche-v2.png":
    "assets/photos/configurator/integrated/bookcase/full-open-shelving/right-niche-finish-mask-v4.png",
  "assets/photos/configurator/integrated/bookcase/full-open-shelving/window-wall-v2.png":
    "assets/photos/configurator/integrated/bookcase/full-open-shelving/window-wall-finish-mask-v4.png",
  "assets/photos/configurator/integrated/floating-storage/floating-drawer-bank/center-recess-v2.png":
    "assets/photos/configurator/integrated/floating-storage/floating-drawer-bank/center-recess-finish-mask-v4.png",
  "assets/photos/configurator/integrated/floating-storage/floating-drawer-bank/corner-wall-v2.png":
    "assets/photos/configurator/integrated/floating-storage/floating-drawer-bank/corner-wall-finish-mask-v4.png",
  "assets/photos/configurator/integrated/floating-storage/floating-drawer-bank/door-wall-v2.png":
    "assets/photos/configurator/integrated/floating-storage/floating-drawer-bank/door-wall-finish-mask-v4.png",
  "assets/photos/configurator/integrated/floating-storage/floating-drawer-bank/double-opening-v4.png":
    "assets/photos/configurator/integrated/floating-storage/floating-drawer-bank/double-opening-finish-mask-v4.png",
  "assets/photos/configurator/integrated/floating-storage/floating-drawer-bank/fireplace-wall-v2.png":
    "assets/photos/configurator/integrated/floating-storage/floating-drawer-bank/fireplace-wall-finish-mask-v4.png",
  "assets/photos/configurator/integrated/floating-storage/floating-drawer-bank/left-niche-v2.png":
    "assets/photos/configurator/integrated/floating-storage/floating-drawer-bank/left-niche-finish-mask-v4.png",
  "assets/photos/configurator/integrated/floating-storage/floating-drawer-bank/niche-layout-v2.png":
    "assets/photos/configurator/integrated/floating-storage/floating-drawer-bank/niche-layout-finish-mask-v4.png",
  "assets/photos/configurator/integrated/floating-storage/floating-drawer-bank/right-niche-v2.png":
    "assets/photos/configurator/integrated/floating-storage/floating-drawer-bank/right-niche-finish-mask-v4.png",
  "assets/photos/configurator/integrated/floating-storage/floating-drawer-bank/window-wall-v2.png":
    "assets/photos/configurator/integrated/floating-storage/floating-drawer-bank/window-wall-finish-mask-v4.png",
  "assets/photos/configurator/integrated/radiator-cover/clean-slat-cover/center-recess-v2.png":
    "assets/photos/configurator/integrated/radiator-cover/clean-slat-cover/center-recess-finish-mask-v4.png",
  "assets/photos/configurator/integrated/radiator-cover/clean-slat-cover/clear-wall-v2.png":
    "assets/photos/configurator/integrated/radiator-cover/clean-slat-cover/clear-wall-finish-mask-v4.png",
  "assets/photos/configurator/integrated/radiator-cover/clean-slat-cover/corner-wall-v2.png":
    "assets/photos/configurator/integrated/radiator-cover/clean-slat-cover/corner-wall-finish-mask-v4.png",
  "assets/photos/configurator/integrated/radiator-cover/clean-slat-cover/door-wall-v2.png":
    "assets/photos/configurator/integrated/radiator-cover/clean-slat-cover/door-wall-finish-mask-v4.png",
  "assets/photos/configurator/integrated/radiator-cover/clean-slat-cover/double-opening-v3.png":
    "assets/photos/configurator/integrated/radiator-cover/clean-slat-cover/double-opening-finish-mask-v4.png",
  "assets/photos/configurator/integrated/radiator-cover/clean-slat-cover/fireplace-wall-v2.png":
    "assets/photos/configurator/integrated/radiator-cover/clean-slat-cover/fireplace-wall-finish-mask-v4.png",
  "assets/photos/configurator/integrated/radiator-cover/clean-slat-cover/left-niche-v2.png":
    "assets/photos/configurator/integrated/radiator-cover/clean-slat-cover/left-niche-finish-mask-v4.png",
  "assets/photos/configurator/integrated/radiator-cover/clean-slat-cover/niche-layout-v2.png":
    "assets/photos/configurator/integrated/radiator-cover/clean-slat-cover/niche-layout-finish-mask-v4.png",
  "assets/photos/configurator/integrated/radiator-cover/clean-slat-cover/right-niche-v2.png":
    "assets/photos/configurator/integrated/radiator-cover/clean-slat-cover/right-niche-finish-mask-v4.png",
  "assets/photos/configurator/integrated/tv-unit/framed-tv-wall/center-recess-v2.png":
    "assets/photos/configurator/integrated/tv-unit/framed-tv-wall/center-recess-finish-mask-v4.png",
  "assets/photos/configurator/integrated/tv-unit/framed-tv-wall/corner-wall-v2.png":
    "assets/photos/configurator/integrated/tv-unit/framed-tv-wall/corner-wall-finish-mask-v4.png",
  "assets/photos/configurator/integrated/tv-unit/framed-tv-wall/door-wall-v2.png":
    "assets/photos/configurator/integrated/tv-unit/framed-tv-wall/door-wall-finish-mask-v4.png",
  "assets/photos/configurator/integrated/tv-unit/framed-tv-wall/double-opening-v3.png":
    "assets/photos/configurator/integrated/tv-unit/framed-tv-wall/double-opening-finish-mask-v4.png",
  "assets/photos/configurator/integrated/tv-unit/framed-tv-wall/fireplace-wall-v2.png":
    "assets/photos/configurator/integrated/tv-unit/framed-tv-wall/fireplace-wall-finish-mask-v4.png",
  "assets/photos/configurator/integrated/tv-unit/framed-tv-wall/left-niche-v2.png":
    "assets/photos/configurator/integrated/tv-unit/framed-tv-wall/left-niche-finish-mask-v4.png",
  "assets/photos/configurator/integrated/tv-unit/framed-tv-wall/niche-layout-v2.png":
    "assets/photos/configurator/integrated/tv-unit/framed-tv-wall/niche-layout-finish-mask-v4.png",
  "assets/photos/configurator/integrated/tv-unit/framed-tv-wall/right-niche-v2.png":
    "assets/photos/configurator/integrated/tv-unit/framed-tv-wall/right-niche-finish-mask-v4.png",
  "assets/photos/configurator/integrated/tv-unit/framed-tv-wall/window-wall-v2.png":
    "assets/photos/configurator/integrated/tv-unit/framed-tv-wall/window-wall-finish-mask-v4.png",
  "assets/photos/configurator/integrated/window-storage/window-seat-storage/center-recess-v2.png":
    "assets/photos/configurator/integrated/window-storage/window-seat-storage/center-recess-finish-mask-v4.png",
  "assets/photos/configurator/integrated/window-storage/window-seat-storage/clear-wall-v3.png":
    "assets/photos/configurator/integrated/window-storage/window-seat-storage/clear-wall-finish-mask-v4.png",
  "assets/photos/configurator/integrated/window-storage/window-seat-storage/corner-wall-v2.png":
    "assets/photos/configurator/integrated/window-storage/window-seat-storage/corner-wall-finish-mask-v4.png",
  "assets/photos/configurator/integrated/window-storage/window-seat-storage/door-wall-v2.png":
    "assets/photos/configurator/integrated/window-storage/window-seat-storage/door-wall-finish-mask-v4.png",
  "assets/photos/configurator/integrated/window-storage/window-seat-storage/double-opening-v3.png":
    "assets/photos/configurator/integrated/window-storage/window-seat-storage/double-opening-finish-mask-v4.png",
  "assets/photos/configurator/integrated/window-storage/window-seat-storage/fireplace-wall-v2.png":
    "assets/photos/configurator/integrated/window-storage/window-seat-storage/fireplace-wall-finish-mask-v4.png",
  "assets/photos/configurator/integrated/window-storage/window-seat-storage/left-niche-v2.png":
    "assets/photos/configurator/integrated/window-storage/window-seat-storage/left-niche-finish-mask-v4.png",
  "assets/photos/configurator/integrated/window-storage/window-seat-storage/niche-layout-v2.png":
    "assets/photos/configurator/integrated/window-storage/window-seat-storage/niche-layout-finish-mask-v4.png",
  "assets/photos/configurator/integrated/window-storage/window-seat-storage/right-niche-v2.png":
    "assets/photos/configurator/integrated/window-storage/window-seat-storage/right-niche-finish-mask-v4.png",
  "assets/photos/configurator/product-floating-storage-v2.png":
    "assets/photos/configurator/product-floating-storage-finish-mask-v4.png",
  "assets/photos/configurator/product-radiator-cover-v2.png":
    "assets/photos/configurator/product-radiator-cover-finish-mask-v4.png"
});

/*
 * Generic concept filenames do not encode the room topology they were
 * authored for. Keep that truth explicit so the resolver cannot relabel an
 * unrelated photograph as the selected room.
 */
const GENERIC_PREVIEW_AUTHORED_LAYOUTS = Object.freeze({
  "assets/photos/configurator/concept-drawers-shelves-v2.png": "niche-layout",
  "assets/photos/configurator/concept-tv-wall-v2.png": "clear-wall",
  "assets/photos/configurator/product-floating-storage-v2.png": "clear-wall",
  "assets/photos/configurator/concept-window-cabinets-v2.png": "window-wall",
  "assets/photos/configurator/product-radiator-cover-v2.png": "window-wall",
  "assets/photos/configurator/concept-cabinets-shelves-between-openings-v2.png": "double-opening",
  "assets/photos/configurator/concept-drawers-shelves-between-openings-v2.png": "double-opening",
  "assets/photos/configurator/concept-full-shelving-between-openings-v2.png": "double-opening"
});

function resolveAuthoredLayoutId(previewAsset) {
  const explicitLayoutId = GENERIC_PREVIEW_AUTHORED_LAYOUTS[previewAsset];
  if (explicitLayoutId) return explicitLayoutId;

  return SHARED_ROOM_LAYOUTS.find((roomLayout) => (
    new RegExp(`/${roomLayout.id}-v\\d+\\.png$`).test(previewAsset)
  ))?.id || null;
}

export function resolveFinishMaskAsset(previewAsset) {
  return PREVIEW_FINISH_MASK_ASSETS[previewAsset] || null;
}

function resolvePreviewMediaContract(previewAsset) {
  const mediaSize = PREVIEW_MEDIA_OVERRIDES[previewAsset] || Object.freeze({
    width: 1536,
    height: 1024
  });
  const finishMaskAsset = resolveFinishMaskAsset(previewAsset);
  return Object.freeze({
    mediaFit: "cover",
    mediaWidth: mediaSize.width,
    mediaHeight: mediaSize.height,
    mediaAspectRatio: `${mediaSize.width} / ${mediaSize.height}`,
    mediaObjectPosition: "50% 50%",
    mediaSvgPreserveAspectRatio: "xMidYMid slice",
    finishMaskMode: finishMaskAsset ? "asset" : "none",
    finishMaskAsset,
    finishMaskWidth: mediaSize.width,
    finishMaskHeight: mediaSize.height,
    finishMaskViewBox: `0 0 ${mediaSize.width} ${mediaSize.height}`
  });
}

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

export function isPublicConfiguratorProduct(categoryId, styleId) {
  return getProductChoiceForSelection(categoryId, styleId)?.id === PUBLIC_CONFIGURATOR_PRODUCT_ID;
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

const LEGACY_LAYOUT_ALIASES = Object.freeze({
  "clear-tv-wall": "clear-wall",
  "tv-niche": "niche-layout",
  "fireplace-tv": "fireplace-wall",
  "window-side-tv": "window-wall",
  "corner-tv-wall": "corner-wall",
  "floating-clear-wall": "clear-wall",
  "floating-under-window": "window-wall",
  "between-openings": "double-opening",
  "wall-to-wall-floating": "niche-layout",
  "floating-corner": "corner-wall",
  "single-window": "window-wall",
  "wide-window": "window-wall",
  "bay-window": "window-wall",
  "window-side-bookcases": "window-wall",
  "window-radiator": "window-wall",
  "standalone-radiator": "clear-wall",
  "radiator-below-window": "window-wall",
  "wall-to-wall-cover": "niche-layout",
  "radiator-side-storage": "niche-layout",
  "radiator-upper-shelving": "clear-wall"
});

const CATEGORY_MEASUREMENT_TAGS = Object.freeze({
  "tv-unit": Object.freeze(["tv"]),
  "floating-storage": Object.freeze(["floating"]),
  "window-storage": Object.freeze(["window"]),
  "radiator-cover": Object.freeze(["radiator"])
});

export function getCategory(categoryId) {
  return CATEGORY_DEFINITIONS.find((category) => category.id === categoryId) || CATEGORY_DEFINITIONS[0];
}

export function getLayout(categoryId, layoutId) {
  const normalizedLayoutId = LEGACY_LAYOUT_ALIASES[layoutId] || layoutId;
  return SHARED_ROOM_LAYOUTS.find((candidate) => candidate.id === normalizedLayoutId) || null;
}

export function isPublicConfiguratorLayout(categoryId, styleId, layoutId) {
  return isPublicConfiguratorProduct(categoryId, styleId)
    && getLayout(categoryId, layoutId)?.id === PUBLIC_CONFIGURATOR_LAYOUT_ID;
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

  const irrelevantByTopology = {
    "left-niche": new Set(["rightReturn"]),
    "right-niche": new Set(["leftReturn"])
  };
  const irrelevant = irrelevantByTopology[selectedLayout?.id];
  return irrelevant ? fields.filter((field) => !irrelevant.has(field.id)) : fields;
}

function resolveMeasurementDiagramSpan(span, viewBox) {
  const sourceWidth = span.sourceWidth || MEASUREMENT_DIAGRAM_AUTHORING_SIZE.width;
  const sourceHeight = span.sourceHeight || MEASUREMENT_DIAGRAM_AUTHORING_SIZE.height;
  const drawingTop = sourceWidth === MEASUREMENT_DIAGRAM_AUTHORING_SIZE.width
    ? viewBox.drawingTop || 0
    : 0;
  const drawingHeight = sourceWidth === MEASUREMENT_DIAGRAM_AUTHORING_SIZE.width
    ? viewBox.drawingHeight || viewBox.height
    : viewBox.height;
  const scaleCoordinates = (coordinates) => Object.freeze(coordinates.map((coordinate, index) => (
    index % 2 === 0
      ? (coordinate / sourceWidth) * viewBox.width
      : drawingTop + (coordinate / sourceHeight) * drawingHeight
  )));
  return Object.freeze({
    ...span,
    line: scaleCoordinates(span.line),
    extensions: Object.freeze(span.extensions.map((extension) => (
      scaleCoordinates(extension)
    ))),
    label: Object.freeze({
      x: (span.label.x / sourceWidth) * viewBox.width,
      y: drawingTop + (span.label.y / sourceHeight) * drawingHeight
    })
  });
}

export function getMeasurementDiagramSpec(categoryId, layoutId) {
  const selectedLayout = getLayout(categoryId, layoutId);
  const selectedCategory = getCategory(categoryId);
  const viewBox = ROOM_MEASUREMENT_DIAGRAM_VIEWBOXES[selectedLayout?.id]
    || ROOM_MEASUREMENT_DIAGRAM_VIEWBOXES["clear-wall"];
  const availableFields = new Map(
    getMeasurementFields(selectedCategory.id, selectedLayout?.id)
      .filter((field) => field.type === "inches")
      .map((field) => [field.id, field])
  );
  const baseSpans = selectedLayout?.id === "door-wall"
    ? DOOR_BASE_MEASUREMENT_DIAGRAM_SPANS
    : BASE_MEASUREMENT_DIAGRAM_SPANS;
  const layoutSpans = ROOM_MEASUREMENT_DIAGRAM_SPANS[selectedLayout?.id] || Object.freeze([]);
  const productSpans = selectedLayout?.id === "clear-wall"
    ? CLEAR_WALL_PRODUCT_MEASUREMENT_DIAGRAM_SPANS[selectedCategory.id] || Object.freeze([])
    : Object.freeze([]);
  const spans = [...baseSpans, ...layoutSpans, ...productSpans]
    .filter((span) => availableFields.has(span.fieldId))
    .map((span) => {
      if (selectedLayout?.id !== "double-opening" || span.fieldId !== "wallWidth") return span;
      return Object.freeze({
        ...span,
        line: Object.freeze([250, 86, 750, 86]),
        extensions: Object.freeze([
          Object.freeze([250, 56, 250, 112]),
          Object.freeze([750, 56, 750, 112])
        ]),
        labelOverride: "Available wall width"
      });
    })
    .map((span) => resolveMeasurementDiagramSpan(span, viewBox));

  const productFeature = selectedLayout?.id === "clear-wall"
    ? Object.freeze({
        "tv-unit": "tv",
        "window-storage": "window",
        "radiator-cover": "radiator"
      })[selectedCategory.id] || "none"
    : "none";

  return Object.freeze({
    width: viewBox.width,
    height: viewBox.height,
    layoutId: selectedLayout?.id || "clear-wall",
    feature: selectedLayout?.feature && selectedLayout.feature !== "none"
      ? selectedLayout.feature
      : productFeature,
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
  const clearWallFurniture = categoryId === "bookcase" && selectedLayout?.id === "clear-wall"
    ? CLEAR_WALL_BOOKCASE_FURNITURE_PRESENTATIONS[selectedStyle.id] || null
    : null;
  const authoredLayoutId = exactLayoutAsset
    ? resolveAuthoredLayoutId(exactLayoutAsset)
    : null;

  if (clearWallFurniture && selectedLayout) {
    const roomMedia = ROOM_MEASUREMENT_DIAGRAM_VIEWBOXES[selectedLayout.id]
      || ROOM_MEASUREMENT_DIAGRAM_VIEWBOXES["clear-wall"];
    return Object.freeze({
      previewKey,
      conceptAsset: selectedLayout.previewAsset,
      roomAsset: selectedLayout.previewAsset,
      furnitureAsset: clearWallFurniture.furnitureAsset,
      categoryId,
      styleId: selectedStyle.id,
      layoutId: selectedLayout.id,
      authoredLayoutId: selectedLayout.id,
      integratedLayoutId: selectedLayout.id,
      layoutLabel: selectedLayout.label,
      layoutContextAsset: selectedLayout.previewAsset,
      layoutPreviewMode: selectedLayout.previewMode,
      layoutPreviewPosition: selectedLayout.previewPosition,
      installationEnvelope: clearWallFurniture.installationEnvelope,
      renderMode: "room-plus-furniture",
      mediaFit: "cover",
      mediaWidth: roomMedia.width,
      mediaHeight: roomMedia.height,
      mediaAspectRatio: `${roomMedia.width} / ${roomMedia.height}`,
      mediaObjectPosition: selectedLayout.previewPosition,
      mediaSvgPreserveAspectRatio: "xMidYMid slice",
      finishMaskMode: "asset",
      finishMaskAsset: clearWallFurniture.finishMaskAsset,
      finishMaskWidth: roomMedia.width,
      finishMaskHeight: roomMedia.height,
      finishMaskViewBox: `0 0 ${roomMedia.width} ${roomMedia.height}`
    });
  }

  if (exactLayoutAsset && selectedLayout && authoredLayoutId === selectedLayout.id) {
    return Object.freeze({
      previewKey,
      conceptAsset: exactLayoutAsset,
      categoryId,
      styleId: selectedStyle.id,
      layoutId: selectedLayout.id,
      authoredLayoutId,
      integratedLayoutId: authoredLayoutId,
      layoutLabel: selectedLayout.label,
      layoutContextAsset: selectedLayout.previewAsset,
      layoutPreviewMode: selectedLayout.previewMode,
      layoutPreviewPosition: selectedLayout.previewPosition,
      renderMode: "integrated",
      ...resolvePreviewMediaContract(exactLayoutAsset)
    });
  }

  if ((selectedProduct || categoryId === "bookcase") && selectedLayout) {
    const roomMedia = ROOM_MEASUREMENT_DIAGRAM_VIEWBOXES[selectedLayout.id]
      || ROOM_MEASUREMENT_DIAGRAM_VIEWBOXES["clear-wall"];
    return Object.freeze({
      previewKey,
      conceptAsset: selectedLayout.previewAsset,
      categoryId,
      styleId: selectedStyle.id,
      layoutId: selectedLayout.id,
      authoredLayoutId: selectedLayout.id,
      integratedLayoutId: null,
      layoutLabel: selectedLayout.label,
      layoutContextAsset: selectedLayout.previewAsset,
      layoutPreviewMode: selectedLayout.previewMode,
      layoutPreviewPosition: selectedLayout.previewPosition,
      renderMode: "missing-integrated-scene",
      mediaFit: "cover",
      mediaWidth: roomMedia.width,
      mediaHeight: roomMedia.height,
      mediaAspectRatio: `${roomMedia.width} / ${roomMedia.height}`,
      mediaObjectPosition: selectedLayout.previewPosition,
      mediaSvgPreserveAspectRatio: "xMidYMid slice"
    });
  }

  const conceptAsset = categoryId === "window-storage"
    ? "assets/photos/configurator/concept-window-cabinets-v2.png"
    : selectedStyle.previewAsset;
  const conceptMedia = resolvePreviewMediaContract(conceptAsset);
  return Object.freeze({
    previewKey,
    conceptAsset,
    categoryId,
    styleId: selectedStyle.id,
    layoutId: selectedLayout?.id || null,
    authoredLayoutId: resolveAuthoredLayoutId(conceptAsset),
    integratedLayoutId: null,
    layoutLabel: selectedLayout?.label || null,
    layoutContextAsset: selectedLayout?.previewAsset || null,
    layoutPreviewMode: selectedLayout?.previewMode || "image",
    layoutPreviewPosition: selectedLayout?.previewPosition || "50% 50%",
    renderMode: selectedLayout ? "concept-with-room-context" : "concept-only",
    ...conceptMedia
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
