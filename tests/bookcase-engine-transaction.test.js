import test from "node:test";
import assert from "node:assert/strict";

import { defaultBookcaseConfig, layoutPresets } from "../bookcase-config.js";
import { createLegacyLayoutFingerprint } from "../bookcase-bom.js";
import {
  DESIGN_SCHEMA_VERSION,
  ENGINE_VERSION,
  createAcceptedDesignId,
  createAcceptedDesignSnapshot,
  evaluateBookcaseCandidate,
  restoreAcceptedDesignSnapshot
} from "../bookcase-engine.js";

const clone = (value) => structuredClone(value);

test("accepted evaluation commits one synchronized state, layout, BOM, and price", () => {
  const input = {
    ...defaultBookcaseConfig,
    width: 108,
    sections: 4,
    shelves: 5,
    lighting: "full_package"
  };
  const before = clone(input);
  const evaluation = evaluateBookcaseCandidate(input);

  assert.deepEqual(input, before);
  assert.equal(evaluation.accepted, true);
  assert.equal(evaluation.engineVersion, ENGINE_VERSION);
  assert.equal(evaluation.layout.validation.valid, true);
  assert.equal(evaluation.pricing.valid, true);
  assert.deepEqual(evaluation.state, evaluation.pricing.state);
  assert.equal(evaluation.layoutFingerprint, evaluation.bom.layoutFingerprint);
  assert.equal(evaluation.pricing.bom.layoutFingerprint, evaluation.layoutFingerprint);
  assert.equal(evaluation.bom.sections.count, evaluation.state.sections);
  assert.equal(evaluation.pricing.total % evaluation.pricing.roundingIncrement, 0);
});

test("automatic construction corrections become the accepted canonical state", () => {
  const evaluation = evaluateBookcaseCandidate({
    ...defaultBookcaseConfig,
    width: 24,
    sections: 6,
    shelves: 8,
    lowerCabinets: false,
    lighting: "no_lighting"
  });

  assert.equal(evaluation.accepted, true);
  assert.equal(evaluation.requestedState.sections, 6);
  assert.equal(evaluation.state.sections, 1);
  assert.equal(evaluation.layout.config.sections, 1);
  assert.equal(evaluation.bom.sections.count, 1);
  assert.ok(evaluation.corrections.some((correction) => correction.code === "SECTION_COUNT_REDUCED"));
});

test("invalid candidates expose errors but no committable artifacts", () => {
  const evaluation = evaluateBookcaseCandidate({
    ...defaultBookcaseConfig,
    width: 96,
    sections: 4,
    lowerCabinets: false,
    lighting: "no_lighting",
    layoutMetadata: { sectionRatios: [0.1, 1, 1, 1] }
  });

  assert.equal(evaluation.accepted, false);
  assert.equal(evaluation.state, null);
  assert.equal(evaluation.layout, null);
  assert.equal(evaluation.bom, null);
  assert.equal(evaluation.pricing, null);
  assert.equal(evaluation.layoutFingerprint, null);
  assert.ok(evaluation.errors.some((error) => error.code === "MIN_SECTION_CLEAR_WIDTH"));
  assert.throws(() => createAcceptedDesignSnapshot(evaluation), /accepted evaluated design/i);
});

test("accepted snapshot stores versioned canonical artifacts without trusting serialized geometry", () => {
  const evaluation = evaluateBookcaseCandidate(defaultBookcaseConfig);
  const savedAt = "2026-07-11T15:00:00.000Z";
  const snapshot = createAcceptedDesignSnapshot(evaluation, { savedAt });

  assert.equal(snapshot.schemaVersion, DESIGN_SCHEMA_VERSION);
  assert.equal(snapshot.engineVersion, ENGINE_VERSION);
  assert.equal(snapshot.pricingVersion, evaluation.pricing.pricingVersion);
  assert.deepEqual(snapshot.canonicalConfig, evaluation.state);
  assert.equal(snapshot.layoutFingerprint, evaluation.layoutFingerprint);
  assert.deepEqual(snapshot.bom, evaluation.bom);
  assert.equal(snapshot.priceBreakdown.total, evaluation.pricing.total);
  assert.equal(snapshot.total, evaluation.pricing.total);
  assert.equal(snapshot.savedAt, savedAt);
  assert.equal("layout" in snapshot, false);
  assert.equal("components" in snapshot, false);
});

test("snapshot restoration regenerates and verifies the layout fingerprint", () => {
  const evaluation = evaluateBookcaseCandidate({ ...defaultBookcaseConfig, width: 110 });
  const snapshot = createAcceptedDesignSnapshot(evaluation);
  const restored = restoreAcceptedDesignSnapshot(snapshot);

  assert.equal(restored.accepted, true);
  assert.equal(restored.compatible, true);
  assert.equal(restored.layoutFingerprint, snapshot.layoutFingerprint);
  assert.deepEqual(restored.state, snapshot.canonicalConfig);

  const tampered = { ...snapshot, layoutFingerprint: "jq-layout-v1-0000000000000000" };
  const rejected = restoreAcceptedDesignSnapshot(tampered);
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.compatible, false);
  assert.ok(rejected.errors.some((error) => error.code === "LAYOUT_FINGERPRINT_MISMATCH"));
});

test("schema-4 saves without drawer profile metadata verify through the legacy fingerprint", () => {
  const evaluation = evaluateBookcaseCandidate({
    ...defaultBookcaseConfig,
    lowerStorage: "drawers",
    doorStyle: "flat",
    drawerFrontStyle: "flat"
  });
  const snapshot = createAcceptedDesignSnapshot(evaluation);
  const canonicalConfig = clone(snapshot.canonicalConfig);
  delete canonicalConfig.drawerFrontStyle;
  const legacyFingerprint = createLegacyLayoutFingerprint(evaluation.layout);
  const legacyId = createAcceptedDesignId(
    legacyFingerprint,
    snapshot.total,
    snapshot.pricingVersion,
    snapshot.selectionFingerprint
  );

  const restored = restoreAcceptedDesignSnapshot({
    ...snapshot,
    canonicalConfig,
    layoutFingerprint: legacyFingerprint,
    id: legacyId
  });
  assert.equal(restored.accepted, true);
  assert.equal(restored.compatible, true);
  assert.equal(restored.state.drawerFrontStyle, "flat");
  assert.notEqual(restored.layoutFingerprint, legacyFingerprint);
});

test("legacy saved config can be regenerated while missing config is rejected", () => {
  const restoredLegacy = restoreAcceptedDesignSnapshot({
    schemaVersion: 3,
    config: defaultBookcaseConfig
  });
  assert.equal(restoredLegacy.accepted, true);
  assert.equal(restoredLegacy.compatible, true);

  const missing = restoreAcceptedDesignSnapshot({ schemaVersion: 3 });
  assert.equal(missing.accepted, false);
  assert.equal(missing.compatible, false);
  assert.equal(missing.errors[0].code, "MISSING_SAVED_CONFIG");
});

test("accepted design identity is deterministic and changes with geometry or total", () => {
  const first = evaluateBookcaseCandidate(defaultBookcaseConfig);
  const second = evaluateBookcaseCandidate(defaultBookcaseConfig);
  const wider = evaluateBookcaseCandidate({ ...defaultBookcaseConfig, width: 97 });

  const firstId = createAcceptedDesignId(first.layoutFingerprint, first.pricing.total, first.pricing.pricingVersion);
  const secondId = createAcceptedDesignId(second.layoutFingerprint, second.pricing.total, second.pricing.pricingVersion);
  const widerId = createAcceptedDesignId(wider.layoutFingerprint, wider.pricing.total, wider.pricing.pricingVersion);
  const repricedId = createAcceptedDesignId(first.layoutFingerprint, first.pricing.total + 50, first.pricing.pricingVersion);

  assert.equal(firstId, secondId);
  assert.notEqual(firstId, widerId);
  assert.notEqual(firstId, repricedId);
  assert.match(firstId, /^JQ-[0-9A-Z]{7}$/);
});

test("every commercial preset evaluates as one accepted transaction", () => {
  for (const preset of layoutPresets) {
    const evaluation = evaluateBookcaseCandidate(preset.config);
    assert.equal(evaluation.accepted, true, `${preset.id}: ${JSON.stringify(evaluation.errors)}`);
    assert.equal(evaluation.state.sections, evaluation.layout.config.sections, preset.id);
    assert.equal(evaluation.bom.sections.count, evaluation.state.sections, preset.id);
    assert.equal(evaluation.pricing.total > 0, true, preset.id);
  }
});
