import test from "node:test";
import assert from "node:assert/strict";

import {
  createAcceptedDesignSnapshot,
  evaluateBookcaseCandidate,
  restoreAcceptedDesignSnapshot
} from "../bookcase-engine.js";

const LEGACY_ENGINE_VERSION = "2026.07-direct-hardware-v2";
const LEGACY_PRICING_VERSION = "2026.07-section-storage-v1";
const SAVED_AT = "2026-07-31T12:00:00.000Z";

const FROZEN_NON_TV = Object.freeze({
  layoutFingerprint: "jq-layout-v1-db194075926e7264",
  selectionFingerprint: "jq-selection-v2-186U5IH",
  legacyId: "JQ-1A7NACO",
  currentId: "JQ-1J397LG",
  total: 12650
});

const NON_TV_CONFIG = Object.freeze({
  layoutPreset: "lower-cabinets",
  width: 96,
  height: 96,
  depth: 14,
  sections: 3,
  shelves: 4,
  lowerCabinets: true,
  lowerStorage: "doors",
  doorStyle: "shaker",
  hardware: "matte_black_pull",
  lighting: "no_lighting",
  crownStyle: "none",
  baseStyle: "toe_kick",
  finish: "silver_satin",
  installation: "professional",
  delivery: "standard"
});

const FROZEN_PHASE_TWO_TV = Object.freeze({
  layoutFingerprint: "jq-layout-v1-d5a87776dabcd3dd",
  selectionFingerprint: "jq-selection-v2-186U5IH",
  legacyId: "JQ-02D0T47",
  total: 13600
});

const PHASE_TWO_TV_CONFIG = Object.freeze({
  layoutPreset: "media-wall",
  layoutType: "media_wall",
  width: 117,
  height: 96,
  depth: 14,
  sections: 3,
  shelves: 4,
  shelfThickness: 1.25,
  lowerCabinets: true,
  lowerStorage: "doors",
  centerOpening: true,
  doorStyle: "flat",
  drawerFrontStyle: "shaker",
  hardware: "matte_black_pull",
  lighting: "warm_pucks",
  finish: "silver_satin",
  crownStyle: "slim_cap",
  baseStyle: "plinth",
  layoutMetadata: {
    specialSpan: 1,
    sectionRatios: [27, 60, 27],
    sectionTypes: ["lower_doors", "media", "lower_doors"],
    sectionDoorLayouts: [{ arrangement: "auto" }, null, { arrangement: "auto" }]
  },
  installation: "professional",
  delivery: "standard"
});

test("verified pre-Phase-3 schema-5 non-TV saves regenerate current BOM and pricing", () => {
  const legacy = createLegacySnapshot(NON_TV_CONFIG, FROZEN_NON_TV);
  assert.equal(legacy.hardwareSchedule.reduce((sum, item) => sum + item.quantity, 0), 6);

  const restored = restoreAcceptedDesignSnapshot(legacy);
  assert.equal(restored.accepted, true, JSON.stringify(restored.errors));
  assert.equal(restored.compatible, true);
  assert.equal(restored.layoutFingerprint, FROZEN_NON_TV.layoutFingerprint);
  assert.equal(restored.selectionFingerprint, FROZEN_NON_TV.selectionFingerprint);
  assert.equal(restored.bom.schemaVersion, 2);
  assert.deepEqual(restored.bom.countertops, emptyCountertops());
  assert.notEqual(restored.pricing.pricingVersion, LEGACY_PRICING_VERSION);
  assert.equal(restored.pricing.total, FROZEN_NON_TV.total);
  assert.equal(restored.migration.priorBomSchemaVersion, 1);
  assert.equal(restored.migration.bomSchemaVersion, 2);
  assert.equal(restored.migration.priorPricingVersion, LEGACY_PRICING_VERSION);
  assert.equal(restored.migration.regeneratedFromVerifiedSchemaFive, true);
  assert.deepEqual(restored.bom.hardware.schedule, legacy.hardwareSchedule);

  const regenerated = createAcceptedDesignSnapshot(restored, { savedAt: SAVED_AT });
  assert.equal(regenerated.id, FROZEN_NON_TV.currentId);
  assert.equal(regenerated.bom.schemaVersion, 2);
});

test("the narrow schema-5 migration rejects Phase-2 TV saves and geometry drift", () => {
  const oldTv = createLegacySnapshot(PHASE_TWO_TV_CONFIG, FROZEN_PHASE_TWO_TV);
  const rejectedTv = restoreAcceptedDesignSnapshot(oldTv);
  assert.equal(rejectedTv.accepted, false);
  assert.equal(rejectedTv.compatible, false);

  const drifted = structuredClone(createLegacySnapshot(NON_TV_CONFIG, FROZEN_NON_TV));
  drifted.layoutFingerprint = "jq-layout-v1-0000000000000000";
  drifted.bom.layoutFingerprint = drifted.layoutFingerprint;
  const rejectedDrift = restoreAcceptedDesignSnapshot(drifted);
  assert.equal(rejectedDrift.accepted, false);
  assert.equal(rejectedDrift.compatible, false);
});

function createLegacySnapshot(config, frozen) {
  const evaluation = evaluateBookcaseCandidate(config);
  assert.equal(evaluation.accepted, true, JSON.stringify(evaluation.errors));
  const current = createAcceptedDesignSnapshot(evaluation, { savedAt: SAVED_AT });
  assert.equal(current.layoutFingerprint, frozen.layoutFingerprint);
  assert.equal(current.selectionFingerprint, frozen.selectionFingerprint);
  assert.equal(current.total, frozen.total);

  const legacy = structuredClone(current);
  legacy.engineVersion = LEGACY_ENGINE_VERSION;
  legacy.pricingVersion = LEGACY_PRICING_VERSION;
  legacy.id = frozen.legacyId;
  legacy.bom.schemaVersion = 1;
  removeCountertopSummaries(legacy.bom);
  legacy.priceBreakdown.pricingVersion = LEGACY_PRICING_VERSION;
  return legacy;
}

function removeCountertopSummaries(bom) {
  delete bom.countertops;
  for (const section of Object.values(bom.bySectionId || {})) delete section.countertops;
  for (const group of Object.values(bom.bySectionGroupId || {})) delete group.countertops;
}

function emptyCountertops() {
  return { count: 0, linearIn: 0, faceAreaSqIn: 0, byThicknessIn: {}, items: [] };
}
