import { normalizeBookcaseConfig } from "./bookcase-config.js?v=parametric-20260709g";

export function calculateBookcasePrice(config) {
  const state = normalizeBookcaseConfig(config);
  const squareFootFactor = (state.width / 12) * (state.height / 12) * 85;
  const depthMultiplier = state.depth > 15 ? 1.08 : 1;
  const sectionsCost = state.sections * 250;
  const shelfCost = state.sections * state.shelves * 55;
  const shelfThicknessPremium = Math.max(0, state.shelfThickness - 0.75) * state.sections * state.shelves * 112.5;
  const lowerCabinetCost = state.lowerCabinets ? state.width * 18 : 0;
  const finishMultiplier = {
    white_dove: 1,
    simply_white: 1,
    chantilly_lace: 1,
    cloud_white: 1,
    silver_satin: 1,
    custom_bm: 1
  }[state.finish] || 1;
  const doorStyleAdd = state.lowerCabinets ? {
    shaker: 0,
    flat: 0,
    slim_shaker: 250,
    glass: 700
  }[state.doorStyle] : 0;
  const hardwareAdd = state.lowerCabinets ? {
    brass_knob: 150,
    brass_pull: 225,
    matte_black_knob: 125,
    matte_black_pull: 175,
    polished_nickel_pull: 225
  }[state.hardware] : 0;
  const lightingAdd = {
    no_lighting: 0,
    warm_pucks: 450,
    shelf_accent: 850,
    vertical_led: 650,
    full_package: 1550
  }[state.lighting] || 0;
  const crownAdd = {
    none: 0,
    slim_cap: 250,
    classic_crown: 550,
    modern_soffit: 700
  }[state.crownStyle];
  const baseAdd = {
    toe_kick: 0,
    plinth: 250,
    furniture_base: 450
  }[state.baseStyle];
  const installationAdd = state.installation === "professional" ? Math.max(950, state.width * 12) : 0;
  const deliveryAdd = {
    pickup: 0,
    standard: 250,
    priority: 650
  }[state.delivery];

  const subtotal = (
    1900 +
    squareFootFactor +
    sectionsCost +
    shelfCost +
    shelfThicknessPremium +
    lowerCabinetCost +
    doorStyleAdd +
    hardwareAdd +
    lightingAdd +
    crownAdd +
    baseAdd +
    installationAdd +
    deliveryAdd
  ) * depthMultiplier * finishMultiplier;

  return Math.round(Math.max(4500, subtotal) / 50) * 50;
}

export function formatPrice(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}
