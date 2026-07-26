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
    measurement("windowLeftDistance", "Distance from left wall", "G", { min: 0, max: 144, defaultValue: 30, position: "lower-left" }),
    measurement("windowRightDistance", "Distance from right wall", "H", { min: 0, max: 144, defaultValue: 30, position: "lower-right" }),
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

const layout = (id, label, condition, feature, tags = []) => Object.freeze({
  id,
  label,
  condition,
  feature,
  tags: Object.freeze(tags)
});

const style = (id, label, options = {}) => Object.freeze({
  id,
  label,
  supportsDoors: true,
  supportsHardware: true,
  supportsLighting: true,
  supportsBase: true,
  supportsTop: true,
  previewAsset: "assets/photos/inspiration-living.jpg",
  ...options
});

export const CATEGORY_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "bookcase",
    label: "Bookcase",
    icon: "bookcase",
    description: "Built-in shelving and storage designed around your room.",
    layouts: Object.freeze([
      layout("niche-layout", "Niche Layout", "niche", "recess", ["niche"]),
      layout("left-niche", "Left Niche", "left-niche", "recess", ["niche"]),
      layout("right-niche", "Right Niche", "right-niche", "recess", ["niche"]),
      layout("fireplace-wall", "Fireplace Wall", "niche", "fireplace", ["fireplace"]),
      layout("clear-wall", "Clear Wall", "clear-wall", "none"),
      layout("center-recess", "Center Recess", "niche", "recess", ["niche"]),
      layout("window-wall", "Window Wall", "niche", "window", ["window"]),
      layout("door-wall", "Door Wall", "niche", "door", ["door"])
    ]),
    styles: Object.freeze([
      style("open-shelving", "Open Shelving", { supportsDoors: false, supportsHardware: false, previewAsset: "assets/photos/inspiration-library.jpg" }),
      style("lower-cabinets-shelves", "Lower Cabinets + Shelves", { previewAsset: "assets/photos/inspiration-lower-cabinets.jpg" }),
      style("full-height-closed", "Full-Height Closed Storage", { previewAsset: "assets/photos/inspiration-walnut.jpg" }),
      style("display-shelving", "Display Shelving", { supportsDoors: false, supportsHardware: false, previewAsset: "assets/photos/hero-product.jpg" }),
      style("library-style", "Library Style", { previewAsset: "assets/photos/inspiration-library.jpg" }),
      style("floating-lower-storage", "Floating Lower Storage", { previewAsset: "assets/photos/inspiration-office.jpg" })
    ])
  }),
  Object.freeze({
    id: "tv-unit",
    label: "TV Unit",
    icon: "tv",
    description: "A balanced media wall with concealed equipment and curated display space.",
    layouts: Object.freeze([
      layout("clear-tv-wall", "Clear TV Wall", "clear-wall", "tv", ["tv"]),
      layout("tv-niche", "TV Niche", "niche", "tv", ["tv", "niche"]),
      layout("fireplace-tv", "Fireplace + TV", "niche", "fireplace", ["tv", "fireplace"]),
      layout("window-side-tv", "Window-Side TV Wall", "niche", "window", ["tv", "window"]),
      layout("corner-tv-wall", "Corner TV Wall", "corner", "tv", ["tv", "corner"])
    ]),
    styles: Object.freeze([
      style("open-media", "Open Media Shelving", { previewAsset: "assets/photos/inspiration-media.jpg" }),
      style("low-media-console", "Low Media Console", { previewAsset: "assets/photos/inspiration-media.jpg" }),
      style("framed-tv-wall", "Framed TV Wall", { previewAsset: "assets/photos/inspiration-white-classic.jpg" }),
      style("library-media", "Library + Media", { previewAsset: "assets/photos/inspiration-library.jpg" }),
      style("closed-media-storage", "Closed Media Storage", { previewAsset: "assets/photos/inspiration-walnut.jpg" })
    ])
  }),
  Object.freeze({
    id: "floating-storage",
    label: "Floating Storage",
    icon: "floating",
    description: "Lightweight wall-mounted storage tailored to your room condition.",
    layouts: Object.freeze([
      layout("floating-clear-wall", "Clear Wall", "clear-wall", "none"),
      layout("floating-under-window", "Under Window", "clear-wall", "window", ["window"]),
      layout("between-openings", "Between Openings", "clear-wall", "door", ["opening"]),
      layout("wall-to-wall-floating", "Wall-to-Wall Floating Unit", "niche", "none", ["niche"]),
      layout("floating-corner", "Corner Condition", "corner", "none", ["corner"])
    ]),
    styles: Object.freeze([
      style("slim-floating-console", "Slim Floating Console", { supportsLighting: false, supportsBase: false, supportsTop: false, previewAsset: "assets/photos/inspiration-office.jpg" }),
      style("floating-drawer-bank", "Floating Drawer Bank", { supportsBase: false, supportsTop: false, previewAsset: "assets/photos/inspiration-lower-cabinets.jpg" }),
      style("floating-cabinets", "Floating Cabinets", { supportsBase: false, supportsTop: false, previewAsset: "assets/photos/inspiration-living.jpg" }),
      style("display-ledge-storage", "Display Ledge + Storage", { supportsBase: false, supportsTop: false, previewAsset: "assets/photos/hero-product.jpg" }),
      style("asymmetric-floating", "Asymmetric Floating Unit", { supportsBase: false, supportsTop: false, previewAsset: "assets/photos/inspiration-office.jpg" })
    ])
  }),
  Object.freeze({
    id: "window-storage",
    label: "Window Storage",
    icon: "window",
    description: "Window seating and storage that keeps light at the center of the design.",
    layouts: Object.freeze([
      layout("single-window", "Single Window", "niche", "window", ["window"]),
      layout("wide-window", "Wide Window", "niche", "window", ["window"]),
      layout("bay-window", "Bay-Style Condition", "niche", "window", ["window"]),
      layout("window-side-bookcases", "Window with Side Bookcases", "niche", "window", ["window"]),
      layout("window-radiator", "Window with Radiator", "niche", "window", ["window", "radiator"])
    ]),
    styles: Object.freeze([
      style("window-seat-storage", "Window Seat + Storage", { previewAsset: "assets/photos/inspiration-living.jpg" }),
      style("side-bookcases", "Side Bookcases", { previewAsset: "assets/photos/inspiration-library.jpg" }),
      style("low-window-cabinets", "Low Window Cabinets", { previewAsset: "assets/photos/inspiration-lower-cabinets.jpg" }),
      style("display-window-wall", "Display Window Wall", { previewAsset: "assets/photos/hero-product.jpg" }),
      style("library-window", "Library Window", { previewAsset: "assets/photos/inspiration-walnut.jpg" })
    ])
  }),
  Object.freeze({
    id: "radiator-cover",
    label: "Radiator Cover",
    icon: "radiator",
    description: "A ventilated cover with optional storage and display elements.",
    layouts: Object.freeze([
      layout("standalone-radiator", "Standalone Radiator", "clear-wall", "radiator", ["radiator"]),
      layout("radiator-below-window", "Radiator Below Window", "clear-wall", "window", ["radiator", "window"]),
      layout("wall-to-wall-cover", "Wall-to-Wall Cover", "niche", "radiator", ["radiator", "niche"]),
      layout("radiator-side-storage", "Radiator with Side Storage", "niche", "radiator", ["radiator"]),
      layout("radiator-upper-shelving", "Radiator with Upper Shelving", "niche", "radiator", ["radiator"])
    ]),
    styles: Object.freeze([
      style("clean-slat-cover", "Clean Slat Cover", { supportsDoors: false, supportsHardware: false, supportsLighting: false, supportsTop: false, previewAsset: "assets/photos/material-paint.jpg" }),
      style("shaker-radiator-cover", "Shaker Radiator Cover", { supportsHardware: false, supportsLighting: false, previewAsset: "assets/photos/inspiration-white-classic.jpg" }),
      style("cover-side-cabinets", "Cover + Side Cabinets", { previewAsset: "assets/photos/inspiration-lower-cabinets.jpg" }),
      style("cover-display-shelves", "Cover + Display Shelves", { supportsDoors: false, supportsHardware: false, previewAsset: "assets/photos/hero-product.jpg" }),
      style("library-radiator-wall", "Library Radiator Wall", { previewAsset: "assets/photos/inspiration-library.jpg" })
    ])
  })
]);

export const FINISH_OPTIONS = Object.freeze({
  wood: Object.freeze([
    Object.freeze({ id: "white-oak", label: "White Oak", family: "wood", color: "#d9c0a0" }),
    Object.freeze({ id: "natural-oak", label: "Natural Oak", family: "wood", color: "#b88e5e" }),
    Object.freeze({ id: "light-walnut", label: "Light Walnut", family: "wood", color: "#9a7048" }),
    Object.freeze({ id: "medium-walnut", label: "Medium Walnut", family: "wood", color: "#775238" }),
    Object.freeze({ id: "dark-walnut", label: "Dark Walnut", family: "wood", color: "#4b372c" })
  ]),
  paint: Object.freeze([
    Object.freeze({ id: "warm-white", label: "Warm White", family: "paint", color: "#f3f0e9" }),
    Object.freeze({ id: "soft-ivory", label: "Soft Ivory", family: "paint", color: "#e8dfd0" }),
    Object.freeze({ id: "light-greige", label: "Light Greige", family: "paint", color: "#b9b6ad" }),
    Object.freeze({ id: "sage-gray", label: "Sage Gray", family: "paint", color: "#89918a" }),
    Object.freeze({ id: "charcoal", label: "Charcoal", family: "paint", color: "#343638" })
  ]),
  accent: Object.freeze([
    Object.freeze({ id: "no-accent", label: "Match exterior", family: "accent", color: "currentColor" }),
    Object.freeze({ id: "warm-linen", label: "Warm Linen", family: "accent", color: "#d8cec0" }),
    Object.freeze({ id: "deep-olive", label: "Deep Olive", family: "accent", color: "#5d6250" }),
    Object.freeze({ id: "ink-blue", label: "Ink Blue", family: "accent", color: "#384b59" })
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
    Object.freeze({ id: "furniture-base", label: "Furniture Base" }),
    Object.freeze({ id: "flush-base", label: "Flush Base" }),
    Object.freeze({ id: "recessed-toe-kick", label: "Recessed Toe Kick" })
  ]),
  topTreatment: Object.freeze([
    Object.freeze({ id: "simple-finished-top", label: "Simple Finished Top" }),
    Object.freeze({ id: "small-crown", label: "Small Crown" }),
    Object.freeze({ id: "traditional-crown", label: "Traditional Crown" })
  ])
});

export function getCategory(categoryId) {
  return CATEGORY_DEFINITIONS.find((category) => category.id === categoryId) || CATEGORY_DEFINITIONS[0];
}

export function getLayout(categoryId, layoutId) {
  return getCategory(categoryId).layouts.find((candidate) => candidate.id === layoutId) || null;
}

export function getStyle(categoryId, styleId) {
  const category = getCategory(categoryId);
  return category.styles.find((candidate) => candidate.id === styleId) || category.styles[0];
}

export function getFinish(finishId) {
  return Object.values(FINISH_OPTIONS).flat().find((finish) => finish.id === finishId) || FINISH_OPTIONS.wood[1];
}

export function getMeasurementFields(categoryId, layoutId) {
  const selectedLayout = getLayout(categoryId, layoutId);
  const fields = [...BASE_MEASUREMENTS];
  const seen = new Set(fields.map((field) => field.id));
  const tags = selectedLayout?.tags || [];

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

export function resolvePreviewAsset(categoryId, styleId) {
  return getStyle(categoryId, styleId).previewAsset;
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
