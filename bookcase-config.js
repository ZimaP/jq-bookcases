export const defaultBookcaseConfig = {
  width: 96,
  height: 96,
  depth: 15,
  sections: 3,
  shelves: 4,
  lowerCabinets: true,
  doorStyle: "shaker",
  doorCount: 4,
  hardware: "brass_knob",
  finish: "alabaster",
  crownStyle: "classic_crown",
  baseStyle: "plinth",
  installation: "professional",
  delivery: "standard"
};

export const finishOptions = [
  { value: "alabaster", label: "Alabaster", swatch: "#eee6dc" },
  { value: "warm_white", label: "Warm White", swatch: "#f7efe4" },
  { value: "soft_black", label: "Soft Black", swatch: "#25231f" },
  { value: "natural_oak", label: "Natural Oak", swatch: "#c59a61" },
  { value: "walnut", label: "Walnut", swatch: "#6e4b35" }
];

export const hardwareOptions = [
  { value: "brass_knob", label: "Brushed Brass Knob" },
  { value: "matte_black_pull", label: "Matte Black Pull" },
  { value: "polished_nickel_knob", label: "Polished Nickel Knob" },
  { value: "push_latch", label: "No Hardware / Push Latch" }
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

export const optionLabels = {
  finish: mapLabels(finishOptions),
  hardware: mapLabels(hardwareOptions),
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
  const merged = { ...defaultBookcaseConfig, ...config };
  const sections = clampInt(merged.sections, 1, 6);
  const width = clampInt(merged.width, 48, 180);
  const doorOptions = getDoorCountOptions(width, sections);
  const requestedDoorCount = clampInt(merged.doorCount ?? merged.doors, 2, 6);
  const doorCount = doorOptions.includes(requestedDoorCount) ? requestedDoorCount : doorOptions[doorOptions.length - 1];

  return {
    width,
    height: clampInt(merged.height, 72, 120),
    depth: clampInt(merged.depth, 10, 24),
    sections,
    shelves: clampInt(merged.shelves, 2, 8),
    lowerCabinets: merged.lowerCabinets !== false && merged.lowerCabinets !== "false",
    doorStyle: normalizeOption(merged.doorStyle, doorStyleOptions, defaultBookcaseConfig.doorStyle),
    doorCount,
    hardware: normalizeOption(merged.hardware, hardwareOptions, defaultBookcaseConfig.hardware),
    finish: normalizeOption(merged.finish, finishOptions, defaultBookcaseConfig.finish),
    crownStyle: normalizeOption(merged.crownStyle, crownStyleOptions, defaultBookcaseConfig.crownStyle),
    baseStyle: normalizeOption(merged.baseStyle, baseStyleOptions, defaultBookcaseConfig.baseStyle),
    installation: normalizeOption(merged.installation, installationOptions, defaultBookcaseConfig.installation),
    delivery: normalizeOption(merged.delivery, deliveryOptions, defaultBookcaseConfig.delivery)
  };
}

export function getDoorCountOptions(width, sections) {
  const numericWidth = Number(width) || defaultBookcaseConfig.width;
  const numericSections = Number(sections) || defaultBookcaseConfig.sections;

  if (numericWidth < 72 || numericSections <= 1) return [2];
  if (numericWidth < 108 || numericSections <= 2) return [2, 4];
  return [2, 4, 6];
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
