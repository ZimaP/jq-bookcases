import {
  CONSTRUCTION_PROFILE_IDS,
  migrateLegacyConstructionConfig,
  normalizeBookcaseConfig
} from "./bookcase-config.js?v=configurator-refine-20260714a";
import { generateBookcaseLayout } from "./bookcase-layout.js?v=configurator-refine-20260714a";
import {
  createLayoutFingerprint,
  createLegacyLayoutFingerprint
} from "./bookcase-bom.js?v=configurator-refine-20260714a";
import {
  PRICING_VERSION,
  calculateBookcasePriceBreakdown
} from "./bookcase-pricing.js?v=configurator-refine-20260714a";

export const ENGINE_VERSION = "2026.07-jq-construction-v1";
export const DESIGN_SCHEMA_VERSION = 4;
export const DESIGN_SELECTION_FINGERPRINT_VERSION = 1;

/**
 * Evaluate a customer change without mutating the currently accepted design.
 * Callers commit the returned artifacts only when accepted is true.
 */
export function evaluateBookcaseCandidate(input = {}, options = {}) {
  const requestedState = normalizeBookcaseConfig(input);
  // Generate the first candidate from the raw request so layout-owned
  // normalization can report structured corrections for section metadata.
  const requestedLayout = generateBookcaseLayout(input, options.layoutOptions || {});
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
 * Fingerprint accepted selections that are intentionally outside the physical
 * descriptor graph. Physical geometry/hardware/lighting is already covered by
 * layoutFingerprint; this key covers finish and fulfillment selections.
 */
export function createDesignSelectionFingerprint(config = {}) {
  const state = normalizeBookcaseConfig(config);
  const finish = state.finish === "custom_bm"
    ? {
        finish: state.finish,
        customPaintColor: state.customPaintColor,
        customPaintCode: state.customPaintCode,
        customPaintHex: state.customPaintHex
      }
    : { finish: state.finish };
  const source = stableStringify({
    fingerprintVersion: DESIGN_SELECTION_FINGERPRINT_VERSION,
    finish,
    installation: state.installation,
    delivery: state.delivery
  });
  return `jq-selection-v${DESIGN_SELECTION_FINGERPRINT_VERSION}-${hashString(source)
    .toString(36)
    .toUpperCase()
    .padStart(7, "0")
    .slice(-7)}`;
}

/**
 * Build the only payload that should be persisted or forwarded to quoting.
 */
export function createAcceptedDesignSnapshot(evaluation, options = {}) {
  if (!evaluation?.accepted || !evaluation.layout?.validation?.valid || !evaluation.pricing?.valid) {
    throw new Error("Only an accepted evaluated design can be saved.");
  }

  const savedAt = options.savedAt || new Date().toISOString();
  const selectionFingerprint = createDesignSelectionFingerprint(evaluation.state);
  const id = options.id || createAcceptedDesignId(
    evaluation.layoutFingerprint,
    evaluation.pricing.total,
    evaluation.pricing.pricingVersion,
    selectionFingerprint
  );

  return {
    schemaVersion: DESIGN_SCHEMA_VERSION,
    engineVersion: evaluation.engineVersion,
    pricingVersion: evaluation.pricing.pricingVersion,
    id,
    canonicalConfig: evaluation.state,
    layoutFingerprint: evaluation.layoutFingerprint,
    selectionFingerprint,
    bom: evaluation.bom,
    priceBreakdown: serializePriceBreakdown(evaluation.pricing),
    total: evaluation.pricing.total,
    savedAt
  };
}

export function createAcceptedDesignId(
  layoutFingerprint,
  total,
  pricingVersion = PRICING_VERSION,
  selectionFingerprint = ""
) {
  const source = [
    layoutFingerprint,
    pricingVersion,
    Number(total) || 0,
    selectionFingerprint
  ].join("|");
  return `JQ-${hashString(source).toString(36).toUpperCase().padStart(7, "0").slice(-7)}`;
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

  const savedConfigMigration = {
    migrated: !Object.prototype.hasOwnProperty.call(sourceConfig, "constructionProfile"),
    config: migrateLegacyConstructionConfig(sourceConfig)
  };
  const evaluation = evaluateBookcaseCandidate(savedConfigMigration.config);
  if (!evaluation.accepted) {
    return { ...evaluation, compatible: false };
  }

  const expectedFingerprint = typeof payload.layoutFingerprint === "string"
    ? payload.layoutFingerprint
    : null;
  const savedArtifactIssue = getSchemaFourSavedArtifactIssue(payload, evaluation, expectedFingerprint);
  if (savedArtifactIssue) {
    return {
      ...evaluation,
      accepted: false,
      compatible: false,
      errors: [savedArtifactIssue]
    };
  }
  const isLegacyDrawerProfileSave = !Object.prototype.hasOwnProperty.call(sourceConfig, "drawerFrontStyle");
  const legacyLayoutFingerprint = isLegacyDrawerProfileSave
    ? createLegacyLayoutFingerprint(evaluation.layout)
    : null;
  const selectionFingerprint = createDesignSelectionFingerprint(evaluation.state);
  const expectedSelectionFingerprint = typeof payload.selectionFingerprint === "string"
    ? payload.selectionFingerprint
    : null;
  if (expectedSelectionFingerprint && expectedSelectionFingerprint !== selectionFingerprint) {
    return {
      ...evaluation,
      accepted: false,
      compatible: false,
      selectionFingerprint,
      errors: [{
        code: "SELECTION_FINGERPRINT_MISMATCH",
        severity: "error",
        message: "The saved finish or fulfillment selections no longer match the regenerated design."
      }]
    };
  }

  let matchedLayoutFingerprint = expectedFingerprint === evaluation.layoutFingerprint
    ? evaluation.layoutFingerprint
    : expectedFingerprint && expectedFingerprint === legacyLayoutFingerprint
      ? legacyLayoutFingerprint
      : null;
  const verifiedLegacyConstructionSnapshot = !matchedLayoutFingerprint
    && savedConfigMigration.migrated
    && verifyLegacySchemaFourSnapshot({
      payload,
      evaluation,
      expectedFingerprint,
      expectedSelectionFingerprint,
      selectionFingerprint
    });
  if (verifiedLegacyConstructionSnapshot) matchedLayoutFingerprint = expectedFingerprint;
  if (expectedFingerprint && !matchedLayoutFingerprint) {
    return {
      ...evaluation,
      accepted: false,
      compatible: false,
      errors: [{
        code: "LAYOUT_FINGERPRINT_MISMATCH",
        severity: "error",
        message: "The saved design was created by an incompatible geometry result and must be reviewed."
      }]
    };
  }

  const regeneratedId = createAcceptedDesignId(
    matchedLayoutFingerprint || evaluation.layoutFingerprint,
    evaluation.pricing.total,
    evaluation.pricing.pricingVersion,
    selectionFingerprint
  );
  if (
    expectedSelectionFingerprint &&
    typeof payload.id === "string" &&
    payload.id !== regeneratedId
  ) {
    return {
      ...evaluation,
      accepted: false,
      compatible: false,
      selectionFingerprint,
      errors: [{
        code: "DESIGN_ID_MISMATCH",
        severity: "error",
        message: "The saved design ID does not match its regenerated accepted artifacts."
      }]
    };
  }

  return {
    ...evaluation,
    compatible: true,
    selectionFingerprint,
    ...(savedConfigMigration.migrated ? {
      migration: {
        constructionProfile: CONSTRUCTION_PROFILE_IDS.legacyOverlay,
        preservedLegacyDoorArrangements: true,
        verifiedPriorLayoutFingerprint: verifiedLegacyConstructionSnapshot
      }
    } : {}),
    errors: []
  };
}

/**
 * Construction V1 intentionally changes descriptor metadata and corrected
 * base geometry, so a pre-profile schema-4 fingerprint cannot always be
 * reproduced from the new graph. Compatibility remains bounded to a complete
 * accepted schema-4 snapshot whose saved ID, selection fingerprint, BOM
 * quantities, pricing version, and full serialized price breakdown all verify.
 */
function verifyLegacySchemaFourSnapshot({
  payload,
  evaluation,
  expectedFingerprint,
  expectedSelectionFingerprint,
  selectionFingerprint
}) {
  if (Number(payload?.schemaVersion) !== 4) return false;
  if (!/^jq-layout-v1-[0-9a-f]{16}$/.test(expectedFingerprint || "")) return false;
  if (!expectedSelectionFingerprint || expectedSelectionFingerprint !== selectionFingerprint) return false;
  if (payload?.bom?.layoutFingerprint !== expectedFingerprint) return false;
  if (payload?.pricingVersion !== evaluation.pricing.pricingVersion) return false;
  if (payload?.priceBreakdown?.pricingVersion !== payload.pricingVersion) return false;
  if (Number(payload?.total) !== evaluation.pricing.total) return false;
  if (Number(payload?.priceBreakdown?.total) !== Number(payload?.total)) return false;
  if (stableStringify(payload.priceBreakdown) !== stableStringify(serializePriceBreakdown(evaluation.pricing))) return false;
  if (stableStringify(getLegacyBomCompatibilitySignature(payload.bom))
    !== stableStringify(getLegacyBomCompatibilitySignature(evaluation.bom))) return false;
  if (typeof payload?.id !== "string") return false;
  return payload.id === createAcceptedDesignId(
    expectedFingerprint,
    payload.total,
    payload.pricingVersion,
    expectedSelectionFingerprint
  );
}

function getSchemaFourSavedArtifactIssue(payload, evaluation, expectedFingerprint) {
  if (Number(payload?.schemaVersion) !== 4) return null;
  if (!expectedFingerprint || payload?.bom?.layoutFingerprint !== expectedFingerprint) {
    return {
      code: "LAYOUT_FINGERPRINT_MISMATCH",
      severity: "error",
      message: "The saved layout fingerprint and serialized BOM do not identify the same accepted geometry."
    };
  }
  const pricingMatches = payload?.pricingVersion === evaluation.pricing.pricingVersion
    && Number(payload?.total) === evaluation.pricing.total
    && payload?.priceBreakdown?.pricingVersion === payload.pricingVersion
    && Number(payload?.priceBreakdown?.total) === Number(payload.total)
    && stableStringify(payload.priceBreakdown) === stableStringify(serializePriceBreakdown(evaluation.pricing));
  if (!pricingMatches) {
    return {
      code: "SAVED_PRICING_MISMATCH",
      severity: "error",
      message: "The saved price artifacts do not match the regenerated accepted design."
    };
  }
  return null;
}

function getLegacyBomCompatibilitySignature(bom = {}) {
  return {
    schemaVersion: bom.schemaVersion,
    overall: {
      widthIn: bom.overall?.widthIn,
      heightIn: bom.overall?.heightIn,
      depthIn: bom.overall?.depthIn
    },
    sections: {
      count: bom.sections?.count,
      clearWidthsIn: bom.sections?.clearWidthsIn
    },
    shelves: {
      adjustableCount: bom.shelves?.adjustableCount,
      fixedCount: bom.shelves?.fixedCount,
      byThicknessIn: bom.shelves?.byThicknessIn
    },
    doors: bom.doors,
    drawers: bom.drawers,
    hardware: bom.hardware,
    lighting: bom.lighting,
    openings: bom.openings
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

function stableStringify(value) {
  return JSON.stringify(sortValue(value));
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map((item) => sortValue(item));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortValue(value[key])])
  );
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// Exported for tests and migration diagnostics.
export function fingerprintAcceptedState(config) {
  const evaluation = evaluateBookcaseCandidate(config);
  return evaluation.accepted ? createLayoutFingerprint(evaluation.layout) : null;
}
