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
    measurement("leftReturn", "Left Return", "G", { min: 0, max: 48, defaultValue: 12, position: "lower-left", group: "Room & built-in" }),
    measurement("rightReturn", "Right Return", "H", { min: 0, max: 48, defaultValue: 12, position: "lower-right", group: "Room & built-in" }),
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
      Object.freeze({ value: "left-in", label: "Left hinge · swings in" }),
      Object.freeze({ value: "right-in", label: "Right hinge · swings in" }),
      Object.freeze({ value: "left-out", label: "Left hinge · swings out" }),
      Object.freeze({ value: "right-out", label: "Right hinge · swings out" })
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

const ROOM_LAYOUT_REFERENCE = "assets/photos/configurator/room-layouts/room-layout-reference-v1.png";

export const SHARED_ROOM_LAYOUTS = Object.freeze([
  layout("niche-layout", "Niche Layout", "niche", "recess", ["niche"], {
    previewAsset: ROOM_LAYOUT_REFERENCE,
    previewMode: "sprite",
    previewPosition: "0% 0%"
  }),
  layout("left-niche", "Left Niche", "left-niche", "recess", ["niche"], {
    previewAsset: ROOM_LAYOUT_REFERENCE,
    previewMode: "sprite",
    previewPosition: "100% 0%"
  }),
  layout("right-niche", "Right Niche", "right-niche", "recess", ["niche"], {
    previewAsset: ROOM_LAYOUT_REFERENCE,
    previewMode: "sprite",
    previewPosition: "0% 100%"
  }),
  layout("clear-wall", "Clear Wall", "clear-wall", "none", [], {
    previewAsset: "assets/photos/configurator/room-layouts/room-clear-wall-v1.png"
  }),
  layout("fireplace-wall", "Fireplace Wall", "clear-wall", "fireplace", ["fireplace"], {
    previewAsset: ROOM_LAYOUT_REFERENCE,
    previewMode: "sprite",
    previewPosition: "100% 100%"
  }),
  layout("center-recess", "Center Projection", "clear-wall", "recess", ["niche"], {
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

const BOOKCASE_LAYOUT_CONCEPT_ASSETS = Object.freeze({
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
  const exactLayoutAsset = categoryId === "bookcase"
    ? BOOKCASE_LAYOUT_CONCEPT_ASSETS[selectedLayout?.id]?.[selectedStyle.id] || null
    : null;
  if (exactLayoutAsset) {
    return Object.freeze({
      conceptAsset: exactLayoutAsset,
      layoutId: selectedLayout.id,
      layoutLabel: selectedLayout.label,
      layoutContextAsset: selectedLayout.previewAsset,
      layoutPreviewMode: selectedLayout.previewMode,
      layoutPreviewPosition: selectedLayout.previewPosition,
      renderMode: "integrated"
    });
  }
  if (
    categoryId === "bookcase"
    && selectedStyle.id === "cabinet-base-shelves"
    && selectedLayout?.feature === "window"
  ) {
    return Object.freeze({
      conceptAsset: "assets/photos/configurator/concept-window-cabinets-v1.png",
      layoutId: selectedLayout.id,
      layoutLabel: selectedLayout.label,
      layoutContextAsset: selectedLayout.previewAsset,
      layoutPreviewMode: selectedLayout.previewMode,
      layoutPreviewPosition: selectedLayout.previewPosition,
      renderMode: "integrated"
    });
  }
  const conceptAsset = categoryId === "window-storage"
    ? "assets/photos/configurator/concept-window-cabinets-v1.png"
    : selectedStyle.previewAsset;
  return Object.freeze({
    conceptAsset,
    layoutId: selectedLayout?.id || null,
    layoutLabel: selectedLayout?.label || null,
    layoutContextAsset: selectedLayout?.previewAsset || null,
    layoutPreviewMode: selectedLayout?.previewMode || "image",
    layoutPreviewPosition: selectedLayout?.previewPosition || "50% 50%",
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
