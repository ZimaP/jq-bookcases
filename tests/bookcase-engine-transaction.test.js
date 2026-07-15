import test from "node:test";
import assert from "node:assert/strict";

import {
  CONSTRUCTION_PROFILE_IDS,
  defaultBookcaseConfig,
  layoutPresets
} from "../bookcase-config.js";
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

function createPreProfileSavedConfig(overrides = {}) {
  const config = clone({ ...defaultBookcaseConfig, ...overrides });
  delete config.constructionProfile;
  if (config.layoutMetadata) delete config.layoutMetadata.sectionDoorLayouts;
  return config;
}

function createEarlySchemaFourId(layoutFingerprint, total, pricingVersion) {
  const source = `${layoutFingerprint}|${pricingVersion}|${Number(total) || 0}`;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `JQ-${(hash >>> 0).toString(36).toUpperCase().padStart(7, "0").slice(-7)}`;
}

// Compatibility-critical fields copied from real schema-4 snapshots generated
// by origin/main at c2537e52. Keep these frozen; current-engine regeneration
// would hide historical migration regressions.
const ORIGIN_MAIN_CROWN_SNAPSHOT_FIXTURES = [
  {
    presetId: "glass-library",
    id: "JQ-1P0AJ75",
    layoutFingerprint: "jq-layout-v1-b8e709b830d9ab6b",
    total: 16050,
    priceBreakdown: {
      pricingVersion: "2026.07-bom-v1",
      lineItems: [
        { code: "BASE_PROJECT", label: "Base project allowance", quantity: 1, unit: "project", unitRate: 1900, amount: 1900 },
        { code: "ENVELOPE_AREA", label: "Nominal wall-unit area", quantity: 72, unit: "sq ft", unitRate: 85, amount: 6120 },
        { code: "SECTIONS", label: "Generated sections", quantity: 4, unit: "section", unitRate: 250, amount: 1000 },
        { code: "ADJUSTABLE_SHELVES", label: "Generated adjustable shelves", quantity: 16, unit: "shelf", unitRate: 55, amount: 880 },
        { code: "SHELF_THICKNESS", label: "Shelf thickness premium", quantity: 16, unit: "shelf", unitRate: 56.25, amount: 900 },
        { code: "LOWER_STORAGE", label: "Generated lower-storage frontage", quantity: 104.25, unit: "linear in", unitRate: 18, amount: 1876.5 },
        { code: "DOOR_STYLE_GLASS", label: "Glass door premium", quantity: 4, unit: "door", unitRate: 87.5, amount: 350 },
        { code: "DOOR_STYLE_SHAKER", label: "Shaker door premium", quantity: 8, unit: "door", unitRate: 0, amount: 0 },
        { code: "HARDWARE_BRASS_KNOB", label: "Brass Knob hardware", quantity: 12, unit: "handle", unitRate: 18.75, amount: 225 },
        { code: "LIGHTING_PUCK", label: "Puck lighting", quantity: 4, unit: "fixture", unitRate: 112.5, amount: 450 },
        { code: "CROWN_STYLE", label: "Classic Crown crown/top style", quantity: 1, unit: "selection", unitRate: 550, amount: 550 },
        { code: "BASE_STYLE", label: "Plinth base style", quantity: 1, unit: "selection", unitRate: 250, amount: 250 },
        { code: "INSTALLATION", label: "Installation", quantity: 1, unit: "selection", unitRate: 1296, amount: 1296 },
        { code: "DELIVERY", label: "Standard delivery", quantity: 1, unit: "selection", unitRate: 250, amount: 250 }
      ],
      subtotalBeforeMultipliers: 16047.5,
      multipliers: { depth: 1, finish: 1 },
      subtotal: 16047.5,
      minimumApplied: false,
      roundingIncrement: 50,
      total: 16050
    },
    canonicalConfig: {
      layoutPreset: "glass-library",
      layoutType: "glass_library",
      width: 108,
      height: 96,
      depth: 15,
      sections: 4,
      shelves: 4,
      shelfThickness: 1.25,
      lowerCabinets: true,
      lowerStorage: "doors",
      drawerCount: 3,
      centerOpening: false,
      deskOpening: false,
      featureOpening: false,
      tallDoors: false,
      doorStyle: "shaker",
      drawerFrontStyle: "shaker",
      doorCount: 8,
      hardware: "brass_knob",
      lighting: "warm_pucks",
      lightingWarmth: 2700,
      finish: "white_dove",
      customPaintColor: "",
      customPaintCode: "",
      customPaintHex: "",
      paintSelection: null,
      crownStyle: "classic_crown",
      baseStyle: "plinth",
      layoutMetadata: { sectionRatios: [1, 1, 1, 1] },
      installation: "professional",
      delivery: "standard"
    },
    bom: {
      schemaVersion: 1,
      overall: { widthIn: 108, heightIn: 96, depthIn: 15 },
      sections: { count: 4, clearWidthsIn: [26.0625, 26.0625, 26.0625, 26.0625] },
      shelves: { adjustableCount: 16, fixedCount: 4, byThicknessIn: { "1.25": 16 } },
      doors: {
        count: 12,
        primaryCount: 8,
        secondaryCount: 4,
        byStyle: { glass: 4, shaker: 8 }
      },
      drawers: { frontCount: 0, totalFrontAreaSqIn: 0, byStyle: {} },
      hardware: { handleCount: 12, byType: { brass_knob: 12 } },
      lighting: { count: 4, byType: { puck: 4 } },
      openings: {
        lowerStorageCount: 4,
        lowerStorageLinearIn: 104.25,
        tallStorageCount: 0,
        upperGlassCount: 4,
        specialByKind: {}
      }
    }
  },
  {
    presetId: "tall-storage",
    id: "JQ-1PRCFVJ",
    layoutFingerprint: "jq-layout-v1-c74f6dbbae3ee4c5",
    total: 16750,
    priceBreakdown: {
      pricingVersion: "2026.07-bom-v1",
      lineItems: [
        { code: "BASE_PROJECT", label: "Base project allowance", quantity: 1, unit: "project", unitRate: 1900, amount: 1900 },
        { code: "ENVELOPE_AREA", label: "Nominal wall-unit area", quantity: 88, unit: "sq ft", unitRate: 85, amount: 7480 },
        { code: "SECTIONS", label: "Generated sections", quantity: 4, unit: "section", unitRate: 250, amount: 1000 },
        { code: "ADJUSTABLE_SHELVES", label: "Generated adjustable shelves", quantity: 8, unit: "shelf", unitRate: 55, amount: 440 },
        { code: "SHELF_THICKNESS", label: "Shelf thickness premium", quantity: 8, unit: "shelf", unitRate: 56.25, amount: 450 },
        { code: "LOWER_STORAGE", label: "Generated lower-storage frontage", quantity: 70.5375, unit: "linear in", unitRate: 18, amount: 1269.68 },
        { code: "DOOR_STYLE_SHAKER", label: "Shaker door premium", quantity: 6, unit: "door", unitRate: 0, amount: 0 },
        { code: "HARDWARE_BRASS_KNOB", label: "Brass Knob hardware", quantity: 6, unit: "handle", unitRate: 18.75, amount: 112.5 },
        { code: "LIGHTING_PUCK", label: "Puck lighting", quantity: 2, unit: "fixture", unitRate: 112.5, amount: 225 },
        { code: "CROWN_STYLE", label: "Classic Crown crown/top style", quantity: 1, unit: "selection", unitRate: 550, amount: 550 },
        { code: "BASE_STYLE", label: "Plinth base style", quantity: 1, unit: "selection", unitRate: 250, amount: 250 },
        { code: "INSTALLATION", label: "Installation", quantity: 1, unit: "selection", unitRate: 1584, amount: 1584 },
        { code: "DELIVERY", label: "Standard delivery", quantity: 1, unit: "selection", unitRate: 250, amount: 250 }
      ],
      subtotalBeforeMultipliers: 15511.18,
      multipliers: { depth: 1.08, finish: 1 },
      subtotal: 16752.07,
      minimumApplied: false,
      roundingIncrement: 50,
      total: 16750
    },
    canonicalConfig: {
      layoutPreset: "tall-storage",
      layoutType: "tall_storage",
      width: 132,
      height: 96,
      depth: 16,
      sections: 4,
      shelves: 4,
      shelfThickness: 1.25,
      lowerCabinets: true,
      lowerStorage: "doors",
      drawerCount: 3,
      centerOpening: false,
      deskOpening: false,
      featureOpening: false,
      tallDoors: true,
      doorStyle: "shaker",
      drawerFrontStyle: "shaker",
      doorCount: 6,
      hardware: "brass_knob",
      lighting: "warm_pucks",
      lightingWarmth: 2700,
      finish: "white_dove",
      customPaintColor: "",
      customPaintCode: "",
      customPaintHex: "",
      paintSelection: null,
      crownStyle: "classic_crown",
      baseStyle: "plinth",
      layoutMetadata: { sectionRatios: [0.9, 1.1, 1.1, 0.9] },
      installation: "professional",
      delivery: "standard"
    },
    bom: {
      schemaVersion: 1,
      overall: { widthIn: 132, heightIn: 96, depthIn: 16 },
      sections: { count: 4, clearWidthsIn: [28.85625, 35.26875, 35.26875, 28.85625] },
      shelves: { adjustableCount: 8, fixedCount: 2, byThicknessIn: { "1.25": 8 } },
      doors: {
        count: 6,
        primaryCount: 6,
        secondaryCount: 0,
        byStyle: { shaker: 6 }
      },
      drawers: { frontCount: 0, totalFrontAreaSqIn: 0, byStyle: {} },
      hardware: { handleCount: 6, byType: { brass_knob: 6 } },
      lighting: { count: 2, byType: { puck: 2 } },
      openings: {
        lowerStorageCount: 2,
        lowerStorageLinearIn: 70.5375,
        tallStorageCount: 2,
        upperGlassCount: 0,
        specialByKind: {}
      }
    }
  }
];

function originMainCrownSnapshot(fixture) {
  return {
    schemaVersion: 4,
    engineVersion: "2026.07-hardening-v2",
    pricingVersion: "2026.07-bom-v1",
    id: fixture.id,
    canonicalConfig: clone(fixture.canonicalConfig),
    layoutFingerprint: fixture.layoutFingerprint,
    selectionFingerprint: "jq-selection-v1-0V8ZPKI",
    bom: {
      ...clone(fixture.bom),
      layoutFingerprint: fixture.layoutFingerprint
    },
    priceBreakdown: clone(fixture.priceBreakdown),
    total: fixture.total,
    savedAt: "2026-07-14T00:00:00.000Z"
  };
}

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
  assert.equal(snapshot.canonicalConfig.constructionProfile, CONSTRUCTION_PROFILE_IDS.inset);
  assert.deepEqual(
    snapshot.canonicalConfig.layoutMetadata.sectionDoorLayouts,
    evaluation.state.layoutMetadata.sectionDoorLayouts
  );
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

  const repriced = { ...snapshot, total: snapshot.total + 50 };
  const rejectedPrice = restoreAcceptedDesignSnapshot(repriced);
  assert.equal(rejectedPrice.accepted, false);
  assert.equal(rejectedPrice.compatible, false);
  assert.ok(rejectedPrice.errors.some((error) => error.code === "SAVED_PRICING_MISMATCH"));

  const tamperedBom = clone(snapshot);
  tamperedBom.bom.doors.count += 999;
  const rejectedBom = restoreAcceptedDesignSnapshot(tamperedBom);
  assert.equal(rejectedBom.accepted, false);
  assert.ok(rejectedBom.errors.some((error) => error.code === "SAVED_BOM_MISMATCH"));

  const missingSelectionFingerprint = clone(snapshot);
  delete missingSelectionFingerprint.selectionFingerprint;
  const rejectedMissingSelection = restoreAcceptedDesignSnapshot(missingSelectionFingerprint);
  assert.equal(rejectedMissingSelection.accepted, false);
  assert.ok(rejectedMissingSelection.errors.some(
    (error) => error.code === "SAVED_SELECTION_FINGERPRINT_MISSING"
  ));

  const missingId = clone(snapshot);
  delete missingId.id;
  const rejectedMissingId = restoreAcceptedDesignSnapshot(missingId);
  assert.equal(rejectedMissingId.accepted, false);
  assert.ok(rejectedMissingId.errors.some((error) => error.code === "SAVED_DESIGN_ID_MISSING"));
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
  const legacySelectionFingerprint = restoreAcceptedDesignSnapshot({
    schemaVersion: 3,
    config: canonicalConfig
  }).selectionFingerprint;
  const legacyId = createAcceptedDesignId(
    legacyFingerprint,
    snapshot.total,
    snapshot.pricingVersion,
    legacySelectionFingerprint
  );

  const restored = restoreAcceptedDesignSnapshot({
    ...snapshot,
    schemaVersion: 4,
    canonicalConfig,
    layoutFingerprint: legacyFingerprint,
    selectionFingerprint: legacySelectionFingerprint,
    bom: { ...snapshot.bom, layoutFingerprint: legacyFingerprint },
    id: legacyId
  });
  assert.equal(restored.accepted, true);
  assert.equal(restored.compatible, true);
  assert.equal(restored.state.drawerFrontStyle, "flat");
  assert.notEqual(restored.layoutFingerprint, legacyFingerprint);
});

test("schema-2 and schema-3 configs without a profile restore overlay fronts and historical door counts", () => {
  const sourceConfig = createPreProfileSavedConfig();
  for (const payload of [
    { schemaVersion: 2, state: sourceConfig },
    { schemaVersion: 3, config: sourceConfig }
  ]) {
    const restoredLegacy = restoreAcceptedDesignSnapshot(payload);
    assert.equal(restoredLegacy.accepted, true);
    assert.equal(restoredLegacy.compatible, true);
    assert.equal(restoredLegacy.state.constructionProfile, CONSTRUCTION_PROFILE_IDS.legacyOverlay);
    assert.equal(restoredLegacy.migration.preservedLegacyDoorArrangements, true);
    assert.ok(restoredLegacy.state.layoutMetadata.sectionDoorLayouts
      .filter(Boolean)
      .every((entry) => entry.arrangement === "pair"));
    assert.equal(restoredLegacy.layout.components.filter((component) => component.role === "door").length, 8);
    assert.ok(restoredLegacy.layout.components
      .filter((component) => component.role === "door")
      .every((component) => component.metadata?.mounting === "overlay"));
  }

  const missing = restoreAcceptedDesignSnapshot({ schemaVersion: 3 });
  assert.equal(missing.accepted, false);
  assert.equal(missing.compatible, false);
  assert.equal(missing.errors[0].code, "MISSING_SAVED_CONFIG");
});

test("schema-2 and schema-3 crown-bearing glass and tall presets restore without front collisions", () => {
  for (const presetId of ["glass-library", "tall-storage"]) {
    const preset = layoutPresets.find((candidate) => candidate.id === presetId);
    const sourceConfig = createPreProfileSavedConfig(preset.config);
    for (const payload of [
      { schemaVersion: 2, state: sourceConfig },
      { schemaVersion: 3, config: sourceConfig }
    ]) {
      const restored = restoreAcceptedDesignSnapshot(payload);
      assert.equal(restored.accepted, true, `${presetId}: ${JSON.stringify(restored.errors)}`);
      assert.equal(restored.compatible, true);
      assert.equal(restored.layout.validation.valid, true);
      assert.equal(restored.state.constructionProfile, CONSTRUCTION_PROFILE_IDS.legacyOverlay);
      assert.ok(restored.layout.components
        .filter((component) => component.role === "door")
        .every((component) => component.metadata.mounting === "overlay"));
      assert.equal(restored.layout.validation.errors.some(
        (error) => error.code === "COMPONENT_COLLISION"
      ), false);
    }
  }
});

test("frozen origin/main schema-4 crown presets restore only through verified compatibility", () => {
  for (const fixture of ORIGIN_MAIN_CROWN_SNAPSHOT_FIXTURES) {
    const snapshot = originMainCrownSnapshot(fixture);
    const restored = restoreAcceptedDesignSnapshot(snapshot);

    assert.equal(restored.accepted, true, `${fixture.presetId}: ${JSON.stringify(restored.errors)}`);
    assert.equal(restored.compatible, true);
    assert.equal(restored.migration.verifiedPriorLayoutFingerprint, true);
    assert.notEqual(restored.layoutFingerprint, fixture.layoutFingerprint);
    assert.equal(restored.pricing.total, fixture.total);
    assert.equal(restored.layout.validation.valid, true);

    const mutations = [
      (payload) => { payload.bom.doors.count += 1; },
      (payload) => { payload.bom.doors.byStyle.shaker += 1; },
      (payload) => { payload.bom.hardware.handleCount += 1; }
    ];
    for (const mutate of mutations) {
      const tampered = originMainCrownSnapshot(fixture);
      mutate(tampered);
      const rejected = restoreAcceptedDesignSnapshot(tampered);
      assert.equal(rejected.accepted, false);
      assert.ok(rejected.errors.some((error) => error.code === "SAVED_BOM_MISMATCH"));
    }
  }
});

test("pre-profile schema-4 snapshots pass only with a complete verified legacy integrity chain", () => {
  const sourceConfig = createPreProfileSavedConfig();
  const restoredSource = restoreAcceptedDesignSnapshot({ schemaVersion: 3, config: sourceConfig });
  assert.equal(restoredSource.accepted, true);
  const evaluation = evaluateBookcaseCandidate(restoredSource.state);
  const snapshot = createAcceptedDesignSnapshot(evaluation);
  const priorFingerprint = "jq-layout-v1-0123456789abcdef";
  const legacySnapshot = {
    ...snapshot,
    schemaVersion: 4,
    selectionFingerprint: restoredSource.selectionFingerprint,
    canonicalConfig: sourceConfig,
    layoutFingerprint: priorFingerprint,
    bom: {
      ...snapshot.bom,
      layoutFingerprint: priorFingerprint,
      openings: { ...snapshot.bom.openings, specialByKind: {} }
    },
    id: createAcceptedDesignId(
      priorFingerprint,
      snapshot.total,
      snapshot.pricingVersion,
      restoredSource.selectionFingerprint
    )
  };

  const restored = restoreAcceptedDesignSnapshot(legacySnapshot);
  assert.equal(restored.accepted, true);
  assert.equal(restored.compatible, true);
  assert.equal(restored.migration.verifiedPriorLayoutFingerprint, true);
  assert.equal(restored.state.constructionProfile, CONSTRUCTION_PROFILE_IDS.legacyOverlay);
  assert.equal(restored.pricing.total, snapshot.total);
  assert.notEqual(restored.layoutFingerprint, priorFingerprint);

  const tamperedBom = clone(legacySnapshot);
  tamperedBom.bom.doors.count += 1;
  const rejectedBom = restoreAcceptedDesignSnapshot(tamperedBom);
  assert.equal(rejectedBom.accepted, false);
  assert.ok(rejectedBom.errors.some((error) => error.code === "SAVED_BOM_MISMATCH"));

  const tamperedOpening = clone(legacySnapshot);
  tamperedOpening.bom.openings.lowerStorageCount += 1;
  const rejectedOpening = restoreAcceptedDesignSnapshot(tamperedOpening);
  assert.equal(rejectedOpening.accepted, false);
  assert.ok(rejectedOpening.errors.some((error) => error.code === "SAVED_BOM_MISMATCH"));

  const tamperedTotal = { ...legacySnapshot, total: legacySnapshot.total + 50 };
  const rejectedTotal = restoreAcceptedDesignSnapshot(tamperedTotal);
  assert.equal(rejectedTotal.accepted, false);
  assert.ok(rejectedTotal.errors.some((error) => error.code === "SAVED_PRICING_MISMATCH"));

  const earlySchemaFour = clone(legacySnapshot);
  earlySchemaFour.engineVersion = "2026.07-hardening-v1";
  delete earlySchemaFour.selectionFingerprint;
  delete earlySchemaFour.bom.drawers.byStyle;
  earlySchemaFour.id = createEarlySchemaFourId(
    earlySchemaFour.layoutFingerprint,
    earlySchemaFour.total,
    earlySchemaFour.pricingVersion
  );
  const restoredEarlySchemaFour = restoreAcceptedDesignSnapshot(earlySchemaFour);
  assert.equal(restoredEarlySchemaFour.accepted, true);
  assert.equal(restoredEarlySchemaFour.compatible, true);
  assert.equal(restoredEarlySchemaFour.migration.verifiedPriorLayoutFingerprint, true);
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
