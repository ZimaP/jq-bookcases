export const defaultBookcaseConfig = {
  layoutPreset: "lower-cabinets",
  layoutType: "lower_cabinets",
  width: 96,
  height: 96,
  depth: 15,
  sections: 4,
  shelves: 4,
  lowerCabinets: true,
  centerOpening: false,
  deskOpening: false,
  tallDoors: false,
  doorStyle: "shaker",
  doorCount: 8,
  hardware: "brass_knob",
  lighting: "warm_pucks",
  finish: "alabaster",
  crownStyle: "classic_crown",
  baseStyle: "plinth",
  installation: "professional",
  delivery: "standard"
};

export const finishOptions = [
  { value: "alabaster", label: "Painted Alabaster", swatch: "#eee6dc" },
  { value: "warm_white", label: "Warm White / Greige", swatch: "#f7efe4" },
  { value: "soft_black", label: "Charcoal / Soft Black", swatch: "#25231f" },
  { value: "natural_oak", label: "Natural Oak", swatch: "#c59a61" },
  { value: "walnut", label: "Walnut", swatch: "#6e4b35" }
];

export const hardwareOptions = [
  { value: "brass_knob", label: "Brushed Brass Knob" },
  { value: "brass_pull", label: "Slim Brass Pull" },
  { value: "matte_black_knob", label: "Matte Black Knob" },
  { value: "matte_black_pull", label: "Matte Black Pull" },
  { value: "polished_nickel_pull", label: "Polished Nickel Pull" },
  { value: "push_latch", label: "Push Latch / No Hardware" }
];

export const lightingOptions = [
  { value: "no_lighting", label: "No Lighting" },
  { value: "warm_pucks", label: "Warm Puck Lights" },
  { value: "vertical_led", label: "Vertical LED Strips" },
  { value: "shelf_accent", label: "Shelf Accent Lighting" }
];

export const doorStyleOptions = [
  { value: "shaker", label: "Shaker" },
  { value: "flat", label: "Flat Panel" },
  { value: "slim_shaker", label: "Slim Shaker" },
  { value: "glass", label: "Glass Frame" }
];

export const crownStyleOptions = [
  { value: "none", label: "None / Square Top" },
  { value: "slim_cap", label: "Slim Cap" },
  { value: "classic_crown", label: "Classic Crown" },
  { value: "modern_soffit", label: "Modern Soffit Look" }
];

export const baseStyleOptions = [
  { value: "toe_kick", label: "Recessed Toe Kick" },
  { value: "plinth", label: "Plinth Base" },
  { value: "furniture_base", label: "Furniture Base" }
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

export const layoutPresets = [
  {
    id: "classic-open",
    name: "Classic Open Shelves",
    description: "Open shelving with clean vertical bays.",
    config: {
      layoutType: "classic",
      width: 96,
      height: 96,
      depth: 15,
      sections: 4,
      shelves: 4,
      lowerCabinets: false,
      centerOpening: false,
      deskOpening: false,
      tallDoors: false,
      finish: "alabaster",
      crownStyle: "slim_cap",
      baseStyle: "plinth"
    }
  },
  {
    id: "lower-cabinets",
    name: "Lower Cabinets",
    description: "Open shelves above closed storage.",
    config: {
      layoutType: "lower_cabinets",
      width: 96,
      height: 96,
      depth: 15,
      sections: 4,
      shelves: 4,
      lowerCabinets: true,
      centerOpening: false,
      deskOpening: false,
      tallDoors: false,
      doorStyle: "shaker",
      doorCount: 8,
      hardware: "brass_knob",
      lighting: "warm_pucks",
      finish: "alabaster",
      crownStyle: "classic_crown",
      baseStyle: "plinth"
    }
  },
  {
    id: "library-wall",
    name: "Full Library Wall",
    description: "Tall wall-to-wall shelving.",
    config: {
      layoutType: "library",
      width: 144,
      height: 108,
      depth: 15,
      sections: 5,
      shelves: 6,
      lowerCabinets: false,
      centerOpening: false,
      deskOpening: false,
      tallDoors: false,
      finish: "warm_white",
      crownStyle: "classic_crown",
      baseStyle: "plinth"
    }
  },
  {
    id: "media-wall",
    name: "Media Wall with TV Opening",
    description: "Center opening for TV with shelves around.",
    config: {
      layoutType: "media_wall",
      width: 132,
      height: 96,
      depth: 15,
      sections: 4,
      shelves: 4,
      lowerCabinets: true,
      centerOpening: true,
      deskOpening: false,
      tallDoors: false,
      doorStyle: "flat",
      doorCount: 8,
      hardware: "matte_black_pull",
      lighting: "shelf_accent",
      finish: "warm_white",
      crownStyle: "modern_soffit",
      baseStyle: "plinth"
    }
  },
  {
    id: "desk-niche",
    name: "Home Office / Desk Niche",
    description: "Built-in desk opening with storage.",
    config: {
      layoutType: "desk_niche",
      width: 120,
      height: 96,
      depth: 18,
      sections: 4,
      shelves: 4,
      lowerCabinets: true,
      centerOpening: false,
      deskOpening: true,
      tallDoors: false,
      doorStyle: "shaker",
      doorCount: 8,
      hardware: "brass_knob",
      lighting: "warm_pucks",
      finish: "alabaster",
      crownStyle: "slim_cap",
      baseStyle: "plinth"
    }
  },
  {
    id: "display-wall",
    name: "Display Wall",
    description: "Balanced shelves for decor and books.",
    config: {
      layoutType: "display_wall",
      width: 108,
      height: 96,
      depth: 15,
      sections: 3,
      shelves: 3,
      lowerCabinets: true,
      centerOpening: false,
      deskOpening: false,
      tallDoors: false,
      doorStyle: "slim_shaker",
      doorCount: 6,
      hardware: "brass_knob",
      lighting: "warm_pucks",
      finish: "warm_white",
      crownStyle: "slim_cap",
      baseStyle: "furniture_base"
    }
  },
  {
    id: "glass-library",
    name: "Glass Door Library",
    description: "Library style with framed glass doors.",
    config: {
      layoutType: "glass_library",
      width: 108,
      height: 96,
      depth: 15,
      sections: 4,
      shelves: 5,
      lowerCabinets: true,
      centerOpening: false,
      deskOpening: false,
      tallDoors: false,
      doorStyle: "glass",
      doorCount: 8,
      hardware: "polished_nickel_pull",
      lighting: "shelf_accent",
      finish: "alabaster",
      crownStyle: "classic_crown",
      baseStyle: "plinth"
    }
  },
  {
    id: "asymmetric-modern",
    name: "Modern Asymmetrical Shelves",
    description: "Modern display layout with varied openings.",
    config: {
      layoutType: "asymmetric",
      width: 120,
      height: 96,
      depth: 15,
      sections: 4,
      shelves: 4,
      lowerCabinets: true,
      centerOpening: false,
      deskOpening: false,
      tallDoors: false,
      doorStyle: "flat",
      doorCount: 8,
      hardware: "push_latch",
      lighting: "no_lighting",
      finish: "walnut",
      crownStyle: "none",
      baseStyle: "toe_kick"
    }
  },
  {
    id: "tall-storage",
    name: "Tall Storage + Open Shelves",
    description: "Tall closed storage mixed with open shelves.",
    config: {
      layoutType: "tall_storage",
      width: 132,
      height: 96,
      depth: 16,
      sections: 4,
      shelves: 4,
      lowerCabinets: true,
      centerOpening: false,
      deskOpening: false,
      tallDoors: true,
      doorStyle: "shaker",
      doorCount: 6,
      hardware: "brass_pull",
      lighting: "vertical_led",
      finish: "warm_white",
      crownStyle: "classic_crown",
      baseStyle: "plinth"
    }
  },
  {
    id: "walnut-modern",
    name: "Walnut Modern Wall",
    description: "Warm walnut built-in with clean details.",
    config: {
      layoutType: "walnut_modern",
      width: 120,
      height: 96,
      depth: 15,
      sections: 4,
      shelves: 4,
      lowerCabinets: true,
      centerOpening: false,
      deskOpening: false,
      tallDoors: false,
      doorStyle: "flat",
      doorCount: 8,
      hardware: "matte_black_pull",
      lighting: "shelf_accent",
      finish: "walnut",
      crownStyle: "none",
      baseStyle: "toe_kick"
    }
  }
];

export const optionLabels = {
  finish: mapLabels(finishOptions),
  hardware: mapLabels(hardwareOptions),
  lighting: mapLabels(lightingOptions),
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
  const merged = normalizeLegacyConfigValues({ ...defaultBookcaseConfig, ...config });
  const sections = clampInt(merged.sections, 1, 6);
  const width = clampInt(merged.width, 24, 144);
  const doorOptions = getDoorCountOptions(width, sections);
  const requestedDoorCount = clampInt(merged.doorCount ?? merged.doors, 2, 8);
  const doorCount = doorOptions.includes(requestedDoorCount) ? requestedDoorCount : doorOptions[doorOptions.length - 1];

  return {
    layoutPreset: typeof merged.layoutPreset === "string" ? merged.layoutPreset : defaultBookcaseConfig.layoutPreset,
    layoutType: typeof merged.layoutType === "string" ? merged.layoutType : defaultBookcaseConfig.layoutType,
    width,
    height: clampInt(merged.height, 72, 120),
    depth: clampInt(merged.depth, 10, 24),
    sections,
    shelves: clampInt(merged.shelves, 2, 8),
    lowerCabinets: merged.lowerCabinets !== false && merged.lowerCabinets !== "false",
    centerOpening: merged.centerOpening === true || merged.centerOpening === "true",
    deskOpening: merged.deskOpening === true || merged.deskOpening === "true",
    tallDoors: merged.tallDoors === true || merged.tallDoors === "true",
    doorStyle: normalizeOption(merged.doorStyle, doorStyleOptions, defaultBookcaseConfig.doorStyle),
    doorCount,
    hardware: normalizeOption(merged.hardware, hardwareOptions, defaultBookcaseConfig.hardware),
    lighting: normalizeOption(merged.lighting, lightingOptions, defaultBookcaseConfig.lighting),
    finish: normalizeOption(merged.finish, finishOptions, defaultBookcaseConfig.finish),
    crownStyle: normalizeOption(merged.crownStyle, crownStyleOptions, defaultBookcaseConfig.crownStyle),
    baseStyle: normalizeOption(merged.baseStyle, baseStyleOptions, defaultBookcaseConfig.baseStyle),
    installation: normalizeOption(merged.installation, installationOptions, defaultBookcaseConfig.installation),
    delivery: normalizeOption(merged.delivery, deliveryOptions, defaultBookcaseConfig.delivery)
  };
}

function normalizeLegacyConfigValues(config) {
  const next = { ...config };
  if (next.hardware === "polished_nickel_knob") next.hardware = "polished_nickel_pull";
  if (next.lighting === "shelf_wash") next.lighting = "shelf_accent";
  return next;
}

export function getDoorCountOptions(width, sections) {
  const numericWidth = Number(width) || defaultBookcaseConfig.width;
  const numericSections = Number(sections) || defaultBookcaseConfig.sections;

  if (numericWidth < 72 || numericSections <= 1) return [2];
  if (numericSections <= 2) return [2, 4];
  if (numericSections === 3) return [2, 4, 6];
  return [2, 4, 6, 8];
}

export function createDesignId(config, price) {
  const source = JSON.stringify(normalizeBookcaseConfig(config)) + price;
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

function clampInt(value, min, max) {
  return Math.min(max, Math.max(min, Math.round(Number(value) || min)));
}
