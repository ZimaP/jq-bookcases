import { normalizeBookcaseConfig } from "./bookcase-config.js?v=configurator-refine-20260714a";
import { generateBookcaseLayout } from "./bookcase-layout.js?v=configurator-refine-20260714a";
import { deriveBookcaseBOM } from "./bookcase-bom.js?v=configurator-refine-20260714a";
import { deriveBillableComponents } from "./bookcase-billable.js?v=configurator-refine-20260714a";

export const PRICING_VERSION = "2026.07-bom-v1";

export const PRICING_RATES = Object.freeze({
  baseProject: 1900,
  envelopeAreaPerSqFt: 85,
  section: 250,
  adjustableShelf: 55,
  shelfThicknessPremiumPerInchPerShelf: 112.5,
  lowerStoragePerLinearIn: 18,
  doorStylePerDoor: Object.freeze({
    shaker: 0,
    flat: 0,
    slim_shaker: 31.25,
    glass: 87.5,
    unknown: 0
  }),
  hardwarePerHandle: Object.freeze({
    brass_knob: 18.75,
    brass_pull: 28.125,
    matte_black_knob: 15.625,
    matte_black_pull: 21.875,
    polished_nickel_pull: 28.125,
    unknown: 0
  }),
  hardwarePerUnit: Object.freeze({
    brass_knob: 18.75,
    brass_pull: 28.125,
    matte_black_knob: 15.625,
    matte_black_pull: 21.875,
    polished_nickel_pull: 28.125,
    unknown: 0
  }),
  lightingPerFixture: Object.freeze({
    puck: 112.5,
    shelf_led: 53.125,
    vertical_led: 81.25,
    unknown: 0
  }),
  lightingPerComponent: Object.freeze({
    puck: 112.5,
    shelf_led: 53.125,
    vertical_led: 81.25,
    unknown: 0
  }),
  fullPackageLightingMultiplier: 1550 / 1950,
  crownStyle: Object.freeze({
    none: 0,
    slim_cap: 250,
    classic_crown: 550,
    modern_soffit: 700
  }),
  baseStyle: Object.freeze({
    toe_kick: 0,
    plinth: 250,
    furniture_base: 450
  }),
  delivery: Object.freeze({
    pickup: 0,
    standard: 250,
    priority: 650
  }),
  professionalInstallationMinimum: 950,
  professionalInstallationPerWidthIn: 12,
  deepCabinetThresholdIn: 15,
  deepCabinetMultiplier: 1.08,
  minimumProjectTotal: 4500,
  roundingIncrement: 50
});

/**
 * Calculate a transparent estimate from the accepted generated layout.
 * Invalid layouts return a structured rejection instead of a misleading price.
 */
export function calculateBookcasePriceBreakdown(config, precomputedLayout = null) {
  const requestedState = normalizeBookcaseConfig(config);
  const layout = precomputedLayout || generateBookcaseLayout(requestedState);

  if (!layout?.validation?.valid) {
    return {
      valid: false,
      pricingVersion: PRICING_VERSION,
      state: requestedState,
      layout,
      bom: null,
      lineItems: [],
      subtotal: null,
      total: null,
      errors: layout?.validation?.errors || [{
        code: "INVALID_LAYOUT",
        severity: "error",
        message: "A valid generated layout is required before pricing."
      }]
    };
  }

  const state = normalizeBookcaseConfig({ ...requestedState, ...layout.config });
  const bom = deriveBookcaseBOM(layout);
  const lineItems = [];

  addLine(lineItems, "BASE_PROJECT", "Base project allowance", 1, "project", PRICING_RATES.baseProject);
  addLine(
    lineItems,
    "ENVELOPE_AREA",
    "Nominal wall-unit area",
    bom.overall.envelopeAreaSqFt,
    "sq ft",
    PRICING_RATES.envelopeAreaPerSqFt
  );
  addLine(lineItems, "SECTIONS", "Generated sections", bom.sections.count, "section", PRICING_RATES.section);
  addLine(
    lineItems,
    "ADJUSTABLE_SHELVES",
    "Generated adjustable shelves",
    bom.shelves.adjustableCount,
    "shelf",
    PRICING_RATES.adjustableShelf
  );

  const shelfThicknessPremiumPerShelf = Math.max(0, state.shelfThickness - 0.75) *
    PRICING_RATES.shelfThicknessPremiumPerInchPerShelf;
  addLine(
    lineItems,
    "SHELF_THICKNESS",
    "Shelf thickness premium",
    bom.shelves.adjustableCount,
    "shelf",
    shelfThicknessPremiumPerShelf
  );

  addLine(
    lineItems,
    "LOWER_STORAGE",
    "Generated lower-storage frontage",
    bom.openings.lowerStorageLinearIn,
    "linear in",
    PRICING_RATES.lowerStoragePerLinearIn
  );

  for (const [style, count] of Object.entries(bom.doors.byStyle)) {
    addLine(
      lineItems,
      `DOOR_STYLE_${style.toUpperCase()}`,
      `${formatToken(style)} door premium`,
      count,
      "door",
      PRICING_RATES.doorStylePerDoor[style] ?? PRICING_RATES.doorStylePerDoor.unknown
    );
  }

  for (const [hardware, count] of Object.entries(bom.hardware.byType)) {
    addLine(
      lineItems,
      `HARDWARE_${hardware.toUpperCase()}`,
      `${formatToken(hardware)} hardware`,
      count,
      "handle",
      PRICING_RATES.hardwarePerHandle[hardware] ?? PRICING_RATES.hardwarePerHandle.unknown
    );
  }

  const lightingLines = [];
  for (const [lightType, count] of Object.entries(bom.lighting.byType)) {
    addLine(
      lightingLines,
      `LIGHTING_${lightType.toUpperCase()}`,
      `${formatToken(lightType)} lighting`,
      count,
      "fixture",
      PRICING_RATES.lightingPerFixture[lightType] ?? PRICING_RATES.lightingPerFixture.unknown
    );
  }
  if (state.lighting === "full_package" && lightingLines.length) {
    for (const item of lightingLines) {
      item.amount = roundCurrency(item.amount * PRICING_RATES.fullPackageLightingMultiplier);
      item.multiplier = PRICING_RATES.fullPackageLightingMultiplier;
    }
  }
  lineItems.push(...lightingLines);

  addLine(
    lineItems,
    "CROWN_STYLE",
    `${formatToken(state.crownStyle)} crown/top style`,
    1,
    "selection",
    PRICING_RATES.crownStyle[state.crownStyle] ?? 0
  );
  addLine(
    lineItems,
    "BASE_STYLE",
    `${formatToken(state.baseStyle)} base style`,
    1,
    "selection",
    PRICING_RATES.baseStyle[state.baseStyle] ?? 0
  );

  const installationRate = state.installation === "professional"
    ? Math.max(
      PRICING_RATES.professionalInstallationMinimum,
      state.width * PRICING_RATES.professionalInstallationPerWidthIn
    )
    : 0;
  addLine(lineItems, "INSTALLATION", "Installation", 1, "selection", installationRate);
  addLine(
    lineItems,
    "DELIVERY",
    `${formatToken(state.delivery)} delivery`,
    1,
    "selection",
    PRICING_RATES.delivery[state.delivery] ?? 0
  );

  const subtotalBeforeMultipliers = roundCurrency(
    lineItems.reduce((total, item) => total + item.amount, 0)
  );
  const depthMultiplier = state.depth > PRICING_RATES.deepCabinetThresholdIn
    ? PRICING_RATES.deepCabinetMultiplier
    : 1;
  const finishMultiplier = 1;
  const subtotal = roundCurrency(subtotalBeforeMultipliers * depthMultiplier * finishMultiplier);
  const total = roundToIncrement(
    Math.max(PRICING_RATES.minimumProjectTotal, subtotal),
    PRICING_RATES.roundingIncrement
  );

  return {
    valid: true,
    pricingVersion: PRICING_VERSION,
    state,
    layout,
    bom,
    lineItems,
    subtotalBeforeMultipliers,
    multipliers: {
      depth: depthMultiplier,
      finish: finishMultiplier
    },
    subtotal,
    minimumApplied: subtotal < PRICING_RATES.minimumProjectTotal,
    roundingIncrement: PRICING_RATES.roundingIncrement,
    total,
    errors: []
  };
}

/**
 * Backward-compatible total API used by the current UI.
 * A rejected candidate returns the minimum estimate only as a defensive UI
 * fallback; callers that need acceptance semantics must use the breakdown API.
 */
export function calculateBookcasePrice(config, precomputedLayout = null) {
  const breakdown = calculateBookcasePriceBreakdown(config, precomputedLayout);
  return breakdown.valid ? breakdown.total : PRICING_RATES.minimumProjectTotal;
}

/**
 * Compatibility view for existing UI and quote consumers. The total and every
 * component charge are projections of the BOM-backed breakdown above; this is
 * not a second pricing calculation.
 */
export function buildPricingContext(config, precomputedLayout = null) {
  const breakdown = calculateBookcasePriceBreakdown(config, precomputedLayout);
  if (!breakdown.valid) return breakdown;
  const billableQuantities = deriveBillableComponents(breakdown.layout);
  const componentCharges = {
    doorStyle: summarizeLines(breakdown.lineItems, "DOOR_STYLE_"),
    hardware: summarizeLines(breakdown.lineItems, "HARDWARE_"),
    lighting: summarizeLines(breakdown.lineItems, "LIGHTING_")
  };
  return {
    ...breakdown,
    selections: breakdown.state,
    billableQuantities,
    rates: PRICING_RATES,
    componentCharges,
    customPaint: {
      selected: breakdown.state.finish === "custom_bm",
      premiumApplied: false,
      premiumAmount: 0
    }
  };
}

export function formatPrice(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function addLine(target, code, label, quantity, unit, unitRate) {
  const normalizedQuantity = Number(quantity) || 0;
  const normalizedRate = Number(unitRate) || 0;
  target.push({
    code,
    label,
    quantity: roundQuantity(normalizedQuantity),
    unit,
    unitRate: roundCurrency(normalizedRate),
    amount: roundCurrency(normalizedQuantity * normalizedRate)
  });
}

function summarizeLines(lineItems, prefix) {
  const items = lineItems.filter((item) => item.code.startsWith(prefix));
  return {
    quantity: roundQuantity(items.reduce((total, item) => total + item.quantity, 0)),
    amount: roundCurrency(items.reduce((total, item) => total + item.amount, 0)),
    items
  };
}

function formatToken(value) {
  return String(value || "")
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function roundToIncrement(value, increment) {
  return Math.round(value / increment) * increment;
}

function roundCurrency(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
function roundQuantity(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1e6) / 1e6;
}
