import { normalizeBookcaseConfig } from "./bookcase-config.js?v=benjamin-moore-20260712a";
import { generateBookcaseLayout } from "./bookcase-layout.js?v=configurator-20260711e";
import { deriveBillableComponents } from "./bookcase-billable.js?v=pricing-20260712a";

export const PRICING_VERSION = "2026.07-physical-components-v2";

// These unit rates normalize the established package premiums to the default
// generated quantities. The default 8-door/8-handle and 4-puck/16-shelf-light/
// 8-vertical-light totals remain $250/$700, $125-$225, and $450/$850/$650.
export const PRICING_RATES = Object.freeze({
  doorStylePerDoor: Object.freeze({
    shaker: 0,
    flat: 0,
    slim_shaker: 250 / 8,
    glass: 700 / 8,
    unknown: 0
  }),
  hardwarePerUnit: Object.freeze({
    brass_knob: 150 / 8,
    brass_pull: 225 / 8,
    matte_black_knob: 125 / 8,
    matte_black_pull: 175 / 8,
    polished_nickel_pull: 225 / 8,
    unknown: 0
  }),
  lightingPerComponent: Object.freeze({
    puck: 450 / 4,
    shelf_led: 850 / 16,
    vertical_led: 650 / 8,
    unknown: 0
  }),
  fullPackageLightingMultiplier: 1550 / (450 + 850 + 650)
});

/**
 * Build one deterministic pricing context from selections and the same pure
 * generated descriptor graph used by the renderer.
 */
export function buildPricingContext(config, precomputedLayout = null) {
  const requestedState = normalizeBookcaseConfig(config);
  const layout = precomputedLayout || generateBookcaseLayout(requestedState);
  const state = normalizeBookcaseConfig({ ...requestedState, ...layout.config });
  const billableQuantities = deriveBillableComponents(layout);

  const doorItems = createComponentItems(
    "DOOR_STYLE",
    "door",
    billableQuantities.doorsByStyle,
    PRICING_RATES.doorStylePerDoor
  );
  const hardwareItems = createComponentItems(
    "HARDWARE",
    "hardware unit",
    billableQuantities.hardwareByType,
    PRICING_RATES.hardwarePerUnit
  );
  const lightingItems = createComponentItems(
    "LIGHTING",
    "lighting component",
    billableQuantities.lightsByType,
    PRICING_RATES.lightingPerComponent
  );

  if (state.lighting === "full_package") {
    for (const item of lightingItems) {
      item.multiplier = PRICING_RATES.fullPackageLightingMultiplier;
      item.amount = roundCurrency(item.amount * item.multiplier);
    }
  }

  const componentCharges = {
    doorStyle: createCharge(doorItems),
    hardware: createCharge(hardwareItems),
    lighting: createCharge(lightingItems)
  };

  // Preserve every non-target pricing formula and its order of operations.
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
  const isCustomPaint = state.finish === "custom_bm";
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

  const subtotalBeforeMultipliers = roundCurrency(
    1900 +
    squareFootFactor +
    sectionsCost +
    shelfCost +
    shelfThicknessPremium +
    lowerCabinetCost +
    componentCharges.doorStyle.amount +
    componentCharges.hardware.amount +
    componentCharges.lighting.amount +
    crownAdd +
    baseAdd +
    installationAdd +
    deliveryAdd
  );
  const subtotal = roundCurrency(subtotalBeforeMultipliers * depthMultiplier * finishMultiplier);
  const customPaintPremium = roundCurrency(subtotalBeforeMultipliers * depthMultiplier * Math.max(0, finishMultiplier - 1));
  const total = Math.round(Math.max(4500, subtotal) / 50) * 50;

  return {
    pricingVersion: PRICING_VERSION,
    selections: state,
    layout,
    billableQuantities,
    rates: PRICING_RATES,
    componentCharges,
    subtotalBeforeMultipliers,
    multipliers: { depth: depthMultiplier, finish: finishMultiplier },
    customPaint: { selected: isCustomPaint, premiumApplied: customPaintPremium > 0, premiumAmount: customPaintPremium },
    subtotal,
    total
  };
}

export function calculateBookcasePrice(config, precomputedLayout = null) {
  return buildPricingContext(config, precomputedLayout).total;
}

export function formatPrice(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function createComponentItems(prefix, unit, quantities, rates) {
  return Object.entries(quantities).map(([type, quantity]) => {
    const unitRate = Number(rates[type] ?? rates.unknown) || 0;
    return {
      code: `${prefix}_${type.toUpperCase()}`,
      type,
      quantity,
      unit,
      unitRate,
      amount: roundCurrency(quantity * unitRate)
    };
  });
}

function createCharge(items) {
  return {
    quantity: items.reduce((total, item) => total + item.quantity, 0),
    amount: roundCurrency(items.reduce((total, item) => total + item.amount, 0)),
    items
  };
}

function roundCurrency(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
