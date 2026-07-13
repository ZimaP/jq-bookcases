export const defaultBookcaseConfig = {
  layoutPreset: "lower-cabinets",
  layoutType: "lower_cabinets",
  width: 96,
  height: 96,
  depth: 15,
  sections: 4,
  shelves: 4,
  shelfThickness: 1.25,
  lowerCabinets: true,
  lowerStorage: "doors",
  drawerCount: 3,
  centerOpening: false,
  deskOpening: false,
  featureOpening: false,
  tallDoors: false,
  doorStyle: "shaker",
  doorCount: 8,
  hardware: "brass_knob",
  lighting: "warm_pucks",
  lightingWarmth: 2700,
  finish: "white_dove",
  customPaintColor: "",
  customPaintCode: "",
  customPaintHex: "",
  paintSelection: null,
  crownStyle: "classic_crown",
  baseStyle: "furniture_base",
  layoutMetadata: { sectionRatios: [1, 1, 1, 1] },
  installation: "professional",
  delivery: "standard"
};

export const EDITABLE_SECTION_TYPES = Object.freeze([
  "open",
  "lower_doors",
  "drawers",
  "tall_doors"
]);

export const LOCKED_SECTION_TYPES = Object.freeze(["media", "desk", "feature"]);
export const SECTION_TYPE_VALUES = Object.freeze([...EDITABLE_SECTION_TYPES, ...LOCKED_SECTION_TYPES]);

const SECTION_TYPE_ALIASES = Object.freeze({
  shelves: "open",
  open_shelves: "open",
  lower_cabinets: "lower_doors",
  lower_door: "lower_doors",
  doors: "lower_doors",
  lower_drawers: "drawers",
  tall_door: "tall_doors",
  tall_storage: "tall_doors"
});

export function normalizeSectionTypeValue(value) {
  const token = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const normalized = SECTION_TYPE_ALIASES[token] || token;
  return SECTION_TYPE_VALUES.includes(normalized) ? normalized : null;
}

export const recommendedFinishOptions = [
  { value: "white_dove", label: "White Dove OC-17", swatch: "#eee9dc" },
  { value: "chantilly_lace", label: "Chantilly Lace OC-65", swatch: "#f7f5ee" },
  { value: "simply_white", label: "Simply White OC-117", swatch: "#f5f0e4" },
  { value: "cloud_white", label: "Cloud White OC-130", swatch: "#eee8dc" },
  { value: "silver_satin", label: "Silver Satin OC-26", swatch: "#d8d7d2" }
];

export const customFinishOption = {
  value: "custom_bm",
  label: "Custom Benjamin Moore Color",
  swatch: "#d3c8b8",
  custom: true,
  search: true,
  library: "Benjamin Moore"
};

// Keep the established finishOptions API while exposing the five recommended
// swatches and the library-search choice as distinct metadata exports.
export const finishOptions = [...recommendedFinishOptions, customFinishOption];

export const hardwareOptions = [
  { value: "brass_knob", label: "Brushed Brass Knob" },
  { value: "brass_pull", label: "Brass Pull" },
  { value: "matte_black_knob", label: "Matte Black Knob" },
  { value: "matte_black_pull", label: "Matte Black Pull" },
  { value: "polished_nickel_pull", label: "Polished Nickel Pull" }
];

export const lightingOptions = [
  { value: "no_lighting", label: "No Lights" },
  { value: "warm_pucks", label: "Top Puck Lights" },
  { value: "shelf_accent", label: "Shelf LED Strips" },
  { value: "vertical_led", label: "Side Vertical Lights" },
  { value: "full_package", label: "Full Lighting Package" }
];

export const lightingWarmthOptions = [
  { value: 2700, label: "2700K", description: "Warm White" },
  { value: 3000, label: "3000K", description: "Soft White" },
  { value: 3500, label: "3500K", description: "Neutral White" }
];

export const shelfThicknessOptions = [
  { value: 0.75, label: '3/4"' },
  { value: 1, label: '1"' },
  { value: 1.25, label: '1 1/4"' },
  { value: 1.5, label: '1 1/2"' },
  { value: 1.75, label: '1 3/4"' },
  { value: 2, label: '2"' }
];

export const doorStyleOptions = [
  { value: "shaker", label: "Shaker" },
  { value: "flat", label: "Flat Panel" },
  { value: "slim_shaker", label: "Slim Shaker" },
  { value: "glass", label: "Glass Frame" }
];

export const crownStyleOptions = [
  { value: "none", label: "Flat Top" },
  { value: "slim_cap", label: "Modern Step Crown" },
  { value: "classic_crown", label: "Classic Crown" },
  { value: "modern_soffit", label: "Tall Built-Up Crown" }
];

export const baseStyleOptions = [
  { value: "toe_kick", label: "Recessed Toe Kick" },
  { value: "plinth", label: "Flush Plinth Base" },
  { value: "furniture_base", label: "Projected Furniture Base" }
];

export const deliveryOptions = [
  { value: "pickup", label: "Pickup / Shop Coordination" },
  { value: "standard", label: "Standard Delivery" },
  { value: "priority", label: "Priority Delivery Review" }
];

export const installationOptions = [
  { value: "no_installation", label: "No Installation" },
  { value: "professional", label: "Professional Installation" }
];

const layoutPresetDefinitions = [
  {
    id: "lower-cabinets",
    name: "Full Bookcase",
    description: "Open shelving above full-width closed storage.",
    config: {
      layoutType: "lower_cabinets",
      width: 96,
      height: 96,
      depth: 15,
      sections: 4,
      shelves: 4,
      lowerCabinets: true,
      lowerStorage: "doors",
      centerOpening: false,
      deskOpening: false,
      featureOpening: false,
      tallDoors: false,
      doorStyle: "shaker",
      doorCount: 8,
      crownStyle: "classic_crown",
      baseStyle: "furniture_base",
      layoutMetadata: { sectionRatios: [1, 1, 1, 1] }
    }
  },
  {
    id: "classic-open",
    name: "Open Shelves",
    description: "A clean full-height shelving wall without doors.",
    config: {
      layoutType: "classic",
      width: 96,
      height: 96,
      depth: 15,
      sections: 4,
      shelves: 5,
      lowerCabinets: false,
      centerOpening: false,
      deskOpening: false,
      featureOpening: false,
      tallDoors: false,
      crownStyle: "slim_cap",
      baseStyle: "plinth",
      layoutMetadata: { sectionRatios: [1, 1, 1, 1] }
    }
  },
  {
    id: "media-wall",
    name: "Media Wall",
    description: "A broad centered television opening with side shelving.",
    config: {
      layoutType: "media_wall",
      width: 132,
      height: 96,
      depth: 15,
      sections: 5,
      shelves: 4,
      lowerCabinets: true,
      lowerStorage: "doors",
      centerOpening: true,
      deskOpening: false,
      featureOpening: false,
      tallDoors: false,
      doorStyle: "flat",
      doorCount: 10,
      crownStyle: "modern_soffit",
      baseStyle: "plinth",
      layoutMetadata: { specialSpan: 3, sectionRatios: [0.82, 1, 1, 1, 0.82] }
    }
  },
  {
    id: "library-wall",
    name: "Library Wall",
    description: "Dense symmetrical shelving with lower closed storage.",
    config: {
      layoutType: "library",
      width: 120,
      height: 108,
      depth: 15,
      sections: 5,
      shelves: 6,
      lowerCabinets: true,
      lowerStorage: "doors",
      centerOpening: false,
      deskOpening: false,
      featureOpening: false,
      tallDoors: false,
      doorStyle: "shaker",
      doorCount: 10,
      crownStyle: "classic_crown",
      baseStyle: "plinth",
      layoutMetadata: { sectionRatios: [1, 1, 1, 1, 1] }
    }
  },
  {
    id: "display-wall",
    name: "Display Wall",
    description: "Wider display niches, fewer shelves, and mixed lower storage.",
    config: {
      layoutType: "display_wall",
      width: 102,
      height: 96,
      depth: 15,
      sections: 3,
      shelves: 3,
      lowerCabinets: true,
      lowerStorage: "doors",
      centerOpening: false,
      deskOpening: false,
      featureOpening: false,
      tallDoors: false,
      doorStyle: "slim_shaker",
      doorCount: 6,
      drawerCount: 3,
      crownStyle: "slim_cap",
      baseStyle: "furniture_base",
      layoutMetadata: { drawerSections: [1], sectionRatios: [1, 1.1, 1] }
    }
  },
  {
    id: "glass-library",
    name: "Glass Door Library",
    description: "Glass-front upper display cabinets over closed storage.",
    config: {
      layoutType: "glass_library",
      width: 108,
      height: 96,
      depth: 15,
      sections: 4,
      shelves: 4,
      lowerCabinets: true,
      lowerStorage: "doors",
      centerOpening: false,
      deskOpening: false,
      featureOpening: false,
      tallDoors: false,
      doorStyle: "shaker",
      doorCount: 8,
      crownStyle: "classic_crown",
      baseStyle: "plinth",
      layoutMetadata: { sectionRatios: [1, 1, 1, 1] }
    }
  },
  {
    id: "desk-niche",
    name: "Desk Center",
    description: "An integrated central worktop with shelving and side storage.",
    config: {
      layoutType: "desk_niche",
      width: 120,
      height: 96,
      depth: 18,
      sections: 5,
      shelves: 4,
      lowerCabinets: true,
      lowerStorage: "doors",
      centerOpening: false,
      deskOpening: true,
      featureOpening: false,
      tallDoors: false,
      doorStyle: "shaker",
      doorCount: 4,
      crownStyle: "slim_cap",
      baseStyle: "plinth",
      layoutMetadata: { specialSpan: 3, sectionRatios: [0.86, 1, 1, 1, 0.86] }
    }
  },
  {
    id: "feature-wall",
    name: "Fireplace Surround",
    description: "A centered fireplace opening framed by side bookcases.",
    config: {
      layoutType: "feature_wall",
      width: 132,
      height: 96,
      depth: 15,
      sections: 5,
      shelves: 4,
      lowerCabinets: true,
      lowerStorage: "doors",
      centerOpening: false,
      deskOpening: false,
      featureOpening: true,
      tallDoors: false,
      doorStyle: "shaker",
      doorCount: 4,
      crownStyle: "classic_crown",
      baseStyle: "plinth",
      layoutMetadata: { specialSpan: 3, sectionRatios: [0.82, 1, 1, 1, 0.82] }
    }
  },
  {
    id: "asymmetric-modern",
    name: "Asymmetrical Modern",
    description: "Varied bay widths and shelf heights with mixed lower storage.",
    config: {
      layoutType: "asymmetric",
      width: 114,
      height: 96,
      depth: 15,
      sections: 4,
      shelves: 4,
      lowerCabinets: true,
      lowerStorage: "doors",
      centerOpening: false,
      deskOpening: false,
      featureOpening: false,
      tallDoors: false,
      doorStyle: "flat",
      doorCount: 8,
      drawerCount: 3,
      crownStyle: "none",
      baseStyle: "toe_kick",
      layoutMetadata: { drawerSections: [1, 3], sectionRatios: [0.72, 1.28, 0.9, 1.1] }
    }
  },
  {
    id: "tall-storage",
    name: "Tall Storage + Shelves",
    description: "Tall closed end towers with central open shelving.",
    config: {
      layoutType: "tall_storage",
      width: 132,
      height: 96,
      depth: 16,
      sections: 4,
      shelves: 4,
      lowerCabinets: true,
      lowerStorage: "doors",
      centerOpening: false,
      deskOpening: false,
      featureOpening: false,
      tallDoors: true,
      doorStyle: "shaker",
      doorCount: 6,
      crownStyle: "classic_crown",
      baseStyle: "plinth",
      layoutMetadata: { sectionRatios: [0.9, 1.1, 1.1, 0.9] }
    }
  }
];

export const layoutPresets = layoutPresetDefinitions.map((preset) => ({
  ...preset,
  config: normalizeBookcaseConfig({
    ...defaultBookcaseConfig,
    ...preset.config,
    layoutPreset: preset.id
  })
}));

export const optionLabels = {
  finish: mapLabels(finishOptions),
  hardware: mapLabels(hardwareOptions),
  lighting: mapLabels(lightingOptions),
  lightingWarmth: mapLabels(lightingWarmthOptions),
  shelfThickness: mapLabels(shelfThicknessOptions),
  doorStyle: mapLabels(doorStyleOptions),
  crownStyle: mapLabels(crownStyleOptions),
  baseStyle: mapLabels(baseStyleOptions),
  delivery: mapLabels(deliveryOptions),
  installation: mapLabels(installationOptions)
};

export function inchesToUnits(value) {
  return Number(value) / 12;
}

export function normalizeBookcaseConfig(config = {}) {
  const merged = { ...defaultBookcaseConfig, ...normalizeLegacyConfigValues(config) };
  const sections = clampInt(merged.sections, 1, 6);
  const width = clampInt(merged.width, 24, 144);
  // Door leaves are generated from the actual openings in the layout engine.
  // Keep the persisted value permissive here so the generated layout can
  // canonicalize it to the real physical count, including a single tall door.
  const doorCount = clampInt(merged.doorCount ?? merged.doors, 0, 12);
  const finish = normalizeOption(merged.finish, finishOptions, defaultBookcaseConfig.finish);
  const paintSelection = normalizePaintSelection(merged, finish);

  return {
    layoutPreset: typeof merged.layoutPreset === "string" ? merged.layoutPreset : defaultBookcaseConfig.layoutPreset,
    layoutType: typeof merged.layoutType === "string" ? merged.layoutType : defaultBookcaseConfig.layoutType,
    width,
    height: clampInt(merged.height, 72, 120),
    depth: clampInt(merged.depth, 10, 24),
    sections,
    shelves: clampInt(merged.shelves, 2, 8),
    shelfThickness: normalizeNumericOption(
      merged.shelfThickness ?? merged.shelf_thickness,
      shelfThicknessOptions,
      defaultBookcaseConfig.shelfThickness
    ),
    lowerCabinets: merged.lowerCabinets !== false && merged.lowerCabinets !== "false",
    lowerStorage: merged.lowerStorage === "drawers" ? "drawers" : "doors",
    drawerCount: clampInt(merged.drawerCount, 2, 5),
    centerOpening: merged.centerOpening === true || merged.centerOpening === "true",
    deskOpening: merged.deskOpening === true || merged.deskOpening === "true",
    featureOpening: merged.featureOpening === true || merged.featureOpening === "true",
    tallDoors: merged.tallDoors === true || merged.tallDoors === "true",
    doorStyle: normalizeOption(merged.doorStyle, doorStyleOptions, defaultBookcaseConfig.doorStyle),
    doorCount,
    hardware: normalizeOption(merged.hardware, hardwareOptions, defaultBookcaseConfig.hardware),
    lighting: normalizeOption(merged.lighting, lightingOptions, defaultBookcaseConfig.lighting),
    lightingWarmth: normalizeNumericOption(
      merged.lightingWarmth ?? merged.warmth,
      lightingWarmthOptions,
      defaultBookcaseConfig.lightingWarmth
    ),
    finish,
    customPaintColor: finish === "custom_bm" ? paintSelection?.name || cleanText(merged.customPaintColor, 80) : "",
    customPaintCode: finish === "custom_bm" ? paintSelection?.code || cleanText(merged.customPaintCode, 20) : "",
    customPaintHex: finish === "custom_bm" ? paintSelection?.previewHex || normalizeHexColor(merged.customPaintHex) : "",
    paintSelection: finish === "custom_bm" ? paintSelection : null,
    crownStyle: normalizeOption(merged.crownStyle, crownStyleOptions, defaultBookcaseConfig.crownStyle),
    baseStyle: normalizeOption(merged.baseStyle, baseStyleOptions, defaultBookcaseConfig.baseStyle),
    layoutMetadata: normalizeLayoutMetadata(merged.layoutMetadata, sections),
    installation: normalizeOption(merged.installation, installationOptions, defaultBookcaseConfig.installation),
    delivery: normalizeOption(merged.delivery, deliveryOptions, defaultBookcaseConfig.delivery)
  };
}

export function normalizePaintSelection(config, finish = config?.finish) {
  if (finish !== "custom_bm") return null;
  const saved = config?.paintSelection && typeof config.paintSelection === "object" && !Array.isArray(config.paintSelection)
    ? config.paintSelection
    : null;
  const name = cleanText(saved?.name ?? config?.customPaintColor, 80);
  const code = cleanText(saved?.code ?? config?.customPaintCode, 20).toUpperCase();
  const previewHex = normalizeHexColor(saved?.previewHex ?? saved?.hex ?? config?.customPaintHex);
  if (!name && !code && !previewHex) return null;
  const collections = Array.isArray(saved?.collections)
    ? [...new Set(saved.collections.map((value) => cleanText(value, 100)).filter(Boolean))].slice(0, 12)
    : cleanText(saved?.collection, 100) ? [cleanText(saved.collection, 100)] : [];
  const previewRgb = normalizePreviewRgb(saved?.previewRgb) || hexToRgb(previewHex);
  const normalizedCode = code.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return {
    source: saved?.source === "benjamin-moore" ? "benjamin-moore" : "benjamin-moore",
    brand: cleanText(saved?.brand, 40) || "Benjamin Moore",
    catalogId: cleanText(saved?.catalogId, 100) || (normalizedCode ? `benjamin-moore:${normalizedCode}` : ""),
    code,
    name,
    collections,
    previewHex,
    previewRgb,
    catalogVersion: cleanText(saved?.catalogVersion, 80),
    sourceType: cleanText(saved?.sourceType, 40) || "saved-preview"
  };
}

function normalizeLegacyConfigValues(config) {
  const next = { ...config };
  if (next.shelfThickness == null && next.shelf_thickness != null) next.shelfThickness = next.shelf_thickness;
  if (next.lightingWarmth == null && next.warmth != null) next.lightingWarmth = next.warmth;
  if (next.hardware === "polished_nickel_knob") next.hardware = "polished_nickel_pull";
  if (next.hardware === "push_latch") next.hardware = "matte_black_pull";
  if (next.lighting === "shelf_wash") next.lighting = "shelf_accent";
  if (next.lighting === "top_puck_lights") next.lighting = "warm_pucks";
  if (next.lighting === "shelf_led_strips") next.lighting = "shelf_accent";
  if (next.lighting === "side_vertical_lights") next.lighting = "vertical_led";
  if (next.lighting === "full_lighting_package") next.lighting = "full_package";
  if (next.finish === "alabaster") next.finish = "white_dove";
  if (next.finish === "warm_white" || next.finish === "warm-white" || next.finish === "swiss_coffee") next.finish = "cloud_white";
  if (next.finish === "revere_pewter" || next.finish === "soft_black" || next.finish === "black" || next.finish === "natural_oak" || next.finish === "natural-oak" || next.finish === "walnut") {
    next.finish = "silver_satin";
  }
  if (next.baseStyle === "projected" || next.baseStyle === "projected_base" || next.baseStyle === "projected_furniture_base") next.baseStyle = "furniture_base";
  return next;
}

function cleanText(value, maximumLength) {
  return typeof value === "string" ? value.trim().slice(0, maximumLength) : "";
}

function normalizePreviewRgb(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const rgb = { r: Number(value.r), g: Number(value.g), b: Number(value.b) };
  return Object.values(rgb).every((channel) => Number.isInteger(channel) && channel >= 0 && channel <= 255) ? rgb : null;
}

function hexToRgb(value) {
  const hex = normalizeHexColor(value);
  if (!hex) return null;
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16)
  };
}

export function createDesignId(config, price) {
  const { layoutPreset: _layoutPreset, ...canonicalConfig } = normalizeBookcaseConfig(config);
  const source = JSON.stringify(canonicalConfig) + price;
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) - hash + source.charCodeAt(index)) | 0;
  }
  return `JQ-${Math.abs(hash).toString(36).toUpperCase().slice(0, 6).padStart(6, "0")}`;
}

function mapLabels(options) {
  return options.reduce((labels, option) => {
    labels[option.value] = option.label;
    return labels;
  }, {});
}

function normalizeOption(value, options, fallback) {
  return options.some((option) => option.value === value) ? value : fallback;
}

function normalizeNumericOption(value, options, fallback) {
  const numericValue = parseNumericOption(value);
  const match = options.find((option) => Math.abs(option.value - numericValue) < Number.EPSILON * 10);
  return match ? match.value : fallback;
}

function normalizeLayoutMetadata(value, sections) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const metadata = {};
  if (Number.isInteger(Number(value.specialSpan))) {
    metadata.specialSpan = Math.min(sections, Math.max(1, Number(value.specialSpan)));
  }
  if (Array.isArray(value.sectionRatios)) {
    if (value.sectionRatios.length === sections && value.sectionRatios.every(
      (ratio) => typeof ratio === "number" && Number.isFinite(ratio) && ratio > 0
    )) {
      metadata.sectionRatios = value.sectionRatios.slice();
    }
  }
  if (Array.isArray(value.drawerSections)) {
    metadata.drawerSections = [...new Set(value.drawerSections.map(Number))]
      .filter((index) => Number.isInteger(index) && index >= 0 && index < sections);
  }
  if (Array.isArray(value.sectionTypes)) {
    const normalizedTypes = value.sectionTypes.map(normalizeSectionTypeValue);
    if (value.sectionTypes.length === sections && normalizedTypes.every(Boolean)) {
      metadata.sectionTypes = normalizedTypes;
    }
  }
  return metadata;
}

function normalizeHexColor(value) {
  const match = String(value || "").trim().match(/^#?([0-9a-f]{6})$/i);
  return match ? `#${match[1].toLowerCase()}` : "";
}

function parseNumericOption(value) {
  if (typeof value === "number") return value;
  const normalized = String(value ?? "").trim().replace(/["k]/gi, "");
  const mixedFraction = normalized.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedFraction) {
    const [, whole, numerator, denominator] = mixedFraction;
    return Number(whole) + Number(numerator) / Number(denominator);
  }
  const fraction = normalized.match(/^(\d+)\/(\d+)$/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  return Number(normalized);
}

function clampInt(value, min, max) {
  return Math.min(max, Math.max(min, Math.round(Number(value) || min)));
}
