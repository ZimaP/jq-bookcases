import { normalizeBookcaseConfig } from "./bookcase-config.js";

export function calculateBookcasePrice(config) {
  const state = normalizeBookcaseConfig(config);
  const squareFootFactor = (state.width / 12) * (state.height / 12) * 85;
  const depthMultiplier = state.depth > 15 ? 1.08 : 1;
  const sectionsCost = state.sections * 250;
  const shelfCost = state.sections * state.shelves * 55;
  const lowerCabinetCost = state.lowerCabinets ? state.width * 18 : 0;
  const finishMultiplier = {
    alabaster: 1,
    warm_white: 1,
    soft_black: 1.08,
    natural_oak: 1.18,
    walnut: 1.28
  }[state.finish];
  const doorStyleAdd = state.lowerCabinets ? {
    shaker: 0,
    flat: 0,
    slim_shaker: 250,
    glass: 700
  }[state.doorStyle] : 0;
  const hardwareAdd = state.lowerCabinets ? {
    brass_knob: 150,
    matte_black_pull: 175,
    polished_nickel_knob: 175,
    push_latch: 250
  }[state.hardware] : 0;
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
    2800 +
    squareFootFactor +
    sectionsCost +
    shelfCost +
    lowerCabinetCost +
    doorStyleAdd +
    hardwareAdd +
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
