import { normalizeBookcaseConfig } from "./bookcase-config.js?v=engine-hardening-20260711a";
import { generateBookcaseLayout } from "./bookcase-layout.js?v=engine-hardening-20260711a";
import { createLayoutFingerprint } from "./bookcase-bom.js?v=engine-hardening-20260711a";
import {
  PRICING_VERSION,
  calculateBookcasePriceBreakdown
} from "./bookcase-pricing.js?v=engine-hardening-20260711a";

export const ENGINE_VERSION = "2026.07-hardening-v1";
export const DESIGN_SCHEMA_VERSION = 4;

/**
 * Evaluate a customer change without mutating the currently accepted design.
 * Callers commit the returned artifacts only when accepted is true.
 */
export function evaluateBookcaseCandidate(input = {}, options = {}) {
  const requestedState = normalizeBookcaseConfig(input);
  const requestedLayout = generateBookcaseLayout(requestedState, options.layoutOptions || {});
  const candidateState = normalizeBookcaseConfig({
    ...requestedState,
    ...(requestedLayout.config || {})
  });

  if (!requestedLayout.validation?.valid) {
    return rejection({
      requestedState,
      candidateState,
      requestedLayout,
      corrections: requestedLayout.corrections || [],
      errors: requestedLayout.validation?.errors || []
    });
  }

  // Rebuild from the applied canonical state so controls, geometry, pricing,
  // save data, and future reloads all start from the exact same state.
  const layout = generateBookcaseLayout(candidateState, options.layoutOptions || {});
  if (!layout.validation?.valid) {
    return rejection({
      requestedState,
      candidateState,
      requestedLayout,
      corrections: requestedLayout.corrections || [],
      errors: layout.validation?.errors || []
    });
  }

  const pricing = calculateBookcasePriceBreakdown(candidateState, layout);
  if (!pricing.valid) {
    return rejection({
      requestedState,
      candidateState,
      requestedLayout,
      corrections: requestedLayout.corrections || [],
      errors: pricing.errors || []
    });
  }

  return {
    accepted: true,
    engineVersion: ENGINE_VERSION,
    requestedState,
    state: pricing.state,
    requestedLayout,
    layout,
    layoutFingerprint: pricing.bom.layoutFingerprint,
    bom: pricing.bom,
    pricing,
    corrections: requestedLayout.corrections || [],
    errors: [],
    warnings: layout.validation?.warnings || []
  };
}

/**
 * Build the only payload that should be persisted or forwarded to quoting.
 */
export function createAcceptedDesignSnapshot(evaluation, options = {}) {
  if (!evaluation?.accepted || !evaluation.layout?.validation?.valid || !evaluation.pricing?.valid) {
    throw new Error("Only an accepted evaluated design can be saved.");
  }

  const savedAt = options.savedAt || new Date().toISOString();
  const id = options.id || createAcceptedDesignId(
    evaluation.layoutFingerprint,
    evaluation.pricing.total,
    evaluation.pricing.pricingVersion
  );

  return {
    schemaVersion: DESIGN_SCHEMA_VERSION,
    engineVersion: evaluation.engineVersion,
    pricingVersion: evaluation.pricing.pricingVersion,
    id,
    canonicalConfig: evaluation.state,
    layoutFingerprint: evaluation.layoutFingerprint,
    bom: evaluation.bom,
    priceBreakdown: serializePriceBreakdown(evaluation.pricing),
    total: evaluation.pricing.total,
    savedAt
  };
}

export function createAcceptedDesignId(layoutFingerprint, total, pricingVersion = PRICING_VERSION) {
  const source = `${layoutFingerprint}|${pricingVersion}|${Number(total) || 0}`;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `JQ-${(hash >>> 0).toString(36).toUpperCase().padStart(7, "0").slice(-7)}`;
}

/**
 * Regenerate and verify a saved design instead of trusting serialized geometry.
 */
export function restoreAcceptedDesignSnapshot(payload) {
  const sourceConfig = payload?.canonicalConfig || payload?.config || payload?.state;
  if (!sourceConfig || typeof sourceConfig !== "object") {
    return {
      accepted: false,
      compatible: false,
      errors: [{
        code: "MISSING_SAVED_CONFIG",
        severity: "error",
        message: "The saved design does not contain a restorable configuration."
      }]
    };
  }

  const evaluation = evaluateBookcaseCandidate(sourceConfig);
  if (!evaluation.accepted) {
    return { ...evaluation, compatible: false };
  }

  const expectedFingerprint = typeof payload.layoutFingerprint === "string"
    ? payload.layoutFingerprint
    : null;
  const compatible = !expectedFingerprint || expectedFingerprint === evaluation.layoutFingerprint;
  const errors = compatible ? [] : [{
    code: "LAYOUT_FINGERPRINT_MISMATCH",
    severity: "error",
    message: "The saved design was created by an incompatible geometry result and must be reviewed."
  }];

  return {
    ...evaluation,
    accepted: evaluation.accepted && compatible,
    compatible,
    errors
  };
}

function rejection({ requestedState, candidateState, requestedLayout, corrections, errors }) {
  return {
    accepted: false,
    engineVersion: ENGINE_VERSION,
    requestedState,
    state: null,
    candidateState,
    requestedLayout,
    layout: null,
    layoutFingerprint: null,
    bom: null,
    pricing: null,
    corrections,
    errors,
    warnings: requestedLayout.validation?.warnings || []
  };
}

function serializePriceBreakdown(pricing) {
  return {
    pricingVersion: pricing.pricingVersion,
    lineItems: pricing.lineItems,
    subtotalBeforeMultipliers: pricing.subtotalBeforeMultipliers,
    multipliers: pricing.multipliers,
    subtotal: pricing.subtotal,
    minimumApplied: pricing.minimumApplied,
    roundingIncrement: pricing.roundingIncrement,
    total: pricing.total
  };
}

// Exported for tests and migration diagnostics.
export function fingerprintAcceptedState(config) {
  const evaluation = evaluateBookcaseCandidate(config);
  return evaluation.accepted ? createLayoutFingerprint(evaluation.layout) : null;
}
