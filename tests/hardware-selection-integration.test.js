import test from "node:test";
import assert from "node:assert/strict";

import {
  defaultBookcaseConfig,
  layoutPresets,
  normalizeBookcaseConfig
} from "../bookcase-config.js";
import { deriveBookcaseBOM } from "../bookcase-bom.js";
import {
  createAcceptedDesignSnapshot,
  createDesignSelectionFingerprint,
  evaluateBookcaseCandidate,
  restoreAcceptedDesignSnapshot
} from "../bookcase-engine.js";
import { generateBookcaseLayout } from "../bookcase-layout.js";
import { calculateBookcasePriceBreakdown } from "../bookcase-pricing.js";
import { createReviewGroups, getChangedConfigFields } from "../configurator-experience.js";
import {
  HARDWARE_CATALOG_VERSION,
  LEGACY_HARDWARE_VARIANT_IDS,
  LEGACY_VARIANT_SNAPSHOTS,
  createLegacyHardwareSelections,
  getHardwareProxySpec
} from "../hardware-catalog.js";
import {
  HARDWARE_APPLICATION_SCOPES,
  createRecommendedHardwarePlacement,
  createHardwareApplicationProspect,
  evaluateHardwareCompatibility,
  resolveHardwareApplicationScope
} from "../hardware-compatibility.js";
import { createQuotePrefill } from "../quote-prefill.js";

const HOST_ID = "section-01-lower-opening-door";
const PULL_VARIANT_ID = LEGACY_HARDWARE_VARIANT_IDS.brass_pull;
const PULL_SNAPSHOT = LEGACY_VARIANT_SNAPSHOTS.brass_pull;

function createPerHostPullSelections(quantityPerFront = 2) {
  const selections = createLegacyHardwareSelections("brass_knob");
  selections.byHostId[HOST_ID] = {
    variantId: PULL_VARIANT_ID,
    snapshot: structuredClone(PULL_SNAPSHOT),
    placement: {
      orientation: "vertical",
      horizontalAnchor: "right",
      verticalAnchor: "middle",
      quantityPerFront
    }
  };
  return selections;
}

test("legacy global hardware migrates to schema-1 selections without overriding an explicit default", () => {
  const migrated = normalizeBookcaseConfig({ hardware: "matte_black_pull" });
  assert.equal(migrated.hardwareSelections.schemaVersion, 1);
  assert.equal(migrated.hardwareSelections.catalogVersion, HARDWARE_CATALOG_VERSION);
  assert.equal(migrated.hardwareSelections.defaultVariantId, LEGACY_HARDWARE_VARIANT_IDS.matte_black_pull);
  assert.equal(migrated.hardwareSelections.defaultSnapshot.variantId, LEGACY_HARDWARE_VARIANT_IDS.matte_black_pull);
  assert.equal(migrated.hardware, "matte_black_pull");

  const explicitDefault = normalizeBookcaseConfig({
    hardwareSelections: createLegacyHardwareSelections("brass_pull")
  });
  assert.equal(explicitDefault.hardwareSelections.defaultVariantId, PULL_VARIANT_ID);
  assert.equal(explicitDefault.hardware, "brass_pull");

  const withOverride = createPerHostPullSelections(1);
  const changedGlobal = normalizeBookcaseConfig({
    ...defaultBookcaseConfig,
    hardware: "matte_black_knob",
    hardwareSelections: withOverride
  });
  assert.equal(changedGlobal.hardwareSelections.defaultVariantId, LEGACY_HARDWARE_VARIANT_IDS.matte_black_knob);
  assert.equal(changedGlobal.hardwareSelections.byHostId[HOST_ID].variantId, PULL_VARIANT_ID);
});

test("an explicit host selection produces exact catalog geometry, stable quantity-two ids, and a linked BOM schedule", () => {
  const config = {
    ...defaultBookcaseConfig,
    hardwareSelections: createPerHostPullSelections(2)
  };
  const layout = generateBookcaseLayout(config);
  assert.equal(layout.validation.valid, true, JSON.stringify(layout.validation.errors));

  const handles = layout.components.filter((component) => component.role === "handle" && component.hostId === HOST_ID);
  assert.deepEqual(handles.map((handle) => handle.id), [
    `${HOST_ID}-handle`,
    `${HOST_ID}-handle-02`
  ]);
  assert.ok(handles.every((handle) => handle.metadata.variantId === PULL_VARIANT_ID));
  assert.ok(handles.every((handle) => handle.metadata.sectionId === "section-01"));
  assert.ok(handles.every((handle) => handle.metadata.proxyMode === "catalog_exact"));
  assert.ok(handles.every((handle) => handle.metadata.hardwareSnapshot.manufacturerProductNumber === "A104-WB"));
  assert.ok(handles.every((handle) => handle.metadata.modelAccuracy === "dimensionally_accurate_parametric_proxy"));
  assert.ok(handles.every((handle) => handle.metadata.finishSwatch === "#B88742"));
  assert.deepEqual(handles[0].metadata.visualDimensions, { x: 0.375, y: 7.125, z: 1.25 });
  assert.equal(
    Number((handles[0].metadata.mountingCenters[1].y - handles[0].metadata.mountingCenters[0].y).toFixed(6)),
    Number((160.337 / 25.4).toFixed(6))
  );

  const repeated = generateBookcaseLayout(config);
  assert.deepEqual(
    repeated.components.filter((component) => component.role === "handle" && component.hostId === HOST_ID).map((handle) => handle.id),
    handles.map((handle) => handle.id)
  );

  const bom = deriveBookcaseBOM(layout);
  const scheduleEntry = bom.hardware.schedule.find((entry) => entry.variantId === PULL_VARIANT_ID);
  assert.equal(scheduleEntry.quantity, 2);
  assert.equal(scheduleEntry.resolvedFrom, "host");
  assert.equal(scheduleEntry.manufacturerProductNumber, "A104-WB");
  assert.equal(scheduleEntry.pricing.amount, 19.8);
  assert.ok(scheduleEntry.links.some((link) => link.url === "https://www.atlashomewares.com/oskar-pull.html"));
  assert.deepEqual(scheduleEntry.locations, [{
    hostId: HOST_ID,
    sectionId: "section-01",
    quantity: 2,
    handleIds: [`${HOST_ID}-handle`, `${HOST_ID}-handle-02`]
  }]);
  assert.deepEqual(bom.hardware.warnings, []);
});

test("exact hardware flows through price delta, review, quote, fingerprints, and strict schema-5 restore", () => {
  const config = {
    ...defaultBookcaseConfig,
    hardwareSelections: createPerHostPullSelections(2)
  };
  const evaluation = evaluateBookcaseCandidate(config);
  assert.equal(evaluation.accepted, true, JSON.stringify(evaluation.errors));

  const pricing = calculateBookcasePriceBreakdown(evaluation.state, evaluation.layout);
  const deltaLine = pricing.lineItems.find((line) => line.catalogVariantId === PULL_VARIANT_ID);
  assert.equal(deltaLine.quantity, 2);
  assert.equal(deltaLine.referenceUnit, 19.8);
  assert.equal(deltaLine.legacyAllowanceUnit, 28.125);
  assert.equal(pricing.hardwarePricing.referenceUnitCount, 2);
  assert.equal(pricing.hardwarePricing.estimatedDelta, deltaLine.amount);

  const review = createReviewGroups(evaluation.state, evaluation.layout);
  const appearance = review.find((group) => group.id === "appearance");
  const reviewSchedule = appearance.items.find((item) => item.hardwareSchedule?.variantId === PULL_VARIANT_ID);
  assert.match(reviewSchedule.value, /Atlas Homewares/);
  assert.match(reviewSchedule.value, /\$19\.80 reference each/);

  const quote = createQuotePrefill(evaluation.state);
  assert.equal(quote.hardwareCatalogVersion, HARDWARE_CATALOG_VERSION);
  assert.ok(quote.hardwareSchedule.some((entry) => entry.variantId === PULL_VARIANT_ID));
  assert.ok(JSON.parse(quote.fields.hardwareSchedule).some((entry) => entry.brand === "Atlas Homewares"));
  assert.match(quote.fields.hardwareSourceLinks, /atlashomewares\.com\/oskar-pull\.html/);

  assert.notEqual(
    createDesignSelectionFingerprint(defaultBookcaseConfig),
    createDesignSelectionFingerprint(evaluation.state)
  );
  assert.ok(getChangedConfigFields(defaultBookcaseConfig, evaluation.state).includes("hardwareSelections"));

  const saved = createAcceptedDesignSnapshot(evaluation, { savedAt: "2026-07-14T00:00:00.000Z" });
  assert.equal(saved.schemaVersion, 5);
  assert.equal(saved.catalogVersion, HARDWARE_CATALOG_VERSION);
  assert.ok(saved.hardwareSchedule.some((entry) => entry.variantId === PULL_VARIANT_ID));
  assert.ok(saved.hardwareSnapshots.some((entry) => entry.variantId === PULL_VARIANT_ID));

  const restored = restoreAcceptedDesignSnapshot(saved);
  assert.equal(restored.accepted, true, JSON.stringify(restored.errors));
  assert.equal(restored.state.hardwareSelections.byHostId[HOST_ID].snapshot.manufacturerProductNumber, "A104-WB");

  const tampered = structuredClone(saved);
  tampered.hardwareSnapshots.find((entry) => entry.variantId === PULL_VARIANT_ID).factualSnapshot.finishCode = "BAD";
  const rejected = restoreAcceptedDesignSnapshot(tampered);
  assert.equal(rejected.accepted, false);
  assert.ok(rejected.errors.some((error) => error.code === "SAVED_HARDWARE_SNAPSHOT_MISMATCH"));

  const missingSchedule = structuredClone(saved);
  delete missingSchedule.hardwareSchedule;
  assert.ok(restoreAcceptedDesignSnapshot(missingSchedule).errors.some(
    (error) => error.code === "SAVED_HARDWARE_SCHEDULE_MISMATCH"
  ));

  const futureSchema = restoreAcceptedDesignSnapshot({ ...saved, schemaVersion: 6 });
  assert.equal(futureSchema.accepted, false);
  assert.equal(futureSchema.errors[0].code, "UNSUPPORTED_SAVED_SCHEMA");
});

test("scope prospecting applies immutable exact snapshots to matching fronts", () => {
  const layout = generateBookcaseLayout(defaultBookcaseConfig);
  assert.deepEqual(resolveHardwareApplicationScope(
    layout,
    HOST_ID,
    HARDWARE_APPLICATION_SCOPES.component
  ).map((host) => host.id), [HOST_ID]);
  assert.equal(resolveHardwareApplicationScope(
    layout,
    HOST_ID,
    HARDWARE_APPLICATION_SCOPES.matchingDoors
  ).length, 4);

  const original = createLegacyHardwareSelections("brass_knob");
  const before = structuredClone(original);
  const prospect = createHardwareApplicationProspect({
    layout,
    hardwareSelections: original,
    selectedHostId: HOST_ID,
    variantId: PULL_VARIANT_ID,
    snapshot: PULL_SNAPSHOT,
    placement: {
      orientation: "vertical",
      horizontalAnchor: "right",
      verticalAnchor: "middle",
      quantityPerFront: 1
    },
    scope: HARDWARE_APPLICATION_SCOPES.matchingDoors,
    proxySpec: getHardwareProxySpec(PULL_SNAPSHOT)
  });
  assert.deepEqual(original, before);
  assert.equal(prospect.candidateCount, 4);
  assert.equal(prospect.affectedCount, 4);
  assert.equal(prospect.excludedCount, 0);
  assert.ok(prospect.affectedHostIds.includes(HOST_ID));
  assert.ok(Object.values(prospect.nextHardwareSelections.byHostId).every(
    (entry) => entry.variantId === PULL_VARIANT_ID && entry.snapshot.manufacturerProductNumber === "A104-WB"
  ));

  const applied = generateBookcaseLayout({
    ...defaultBookcaseConfig,
    hardwareSelections: prospect.nextHardwareSelections
  });
  assert.equal(applied.validation.valid, true, JSON.stringify(applied.validation.errors));
  assert.equal(applied.components.filter(
    (component) => component.role === "handle" && component.metadata.resolvedFrom === "host"
  ).length, 4);
});

test("recommended edge-pull placement uses a drawer top edge accepted by catalog constraints", () => {
  const host = {
    id: "test-drawer-front",
    role: "drawer_front",
    size: { x: 24, y: 8, z: 0.75 },
    bounds: {
      min: { x: 0, y: 0, z: -0.75 },
      max: { x: 24, y: 8, z: 0 }
    },
    metadata: { profileGeometry: { kind: "slab" } }
  };
  const proxySpec = {
    category: "edge_pull",
    compatiblePlacements: ["drawer_top_edge"],
    dimensionsMm: {
      centerToCenter: 80,
      overallLength: 100,
      width: 18.256,
      projection: null
    },
    mounting: { holeCount: 2 }
  };

  const placement = createRecommendedHardwarePlacement(host, proxySpec);
  assert.equal(placement.orientation, "horizontal");
  assert.equal(placement.verticalAnchor, "top");

  const result = evaluateHardwareCompatibility({ host, proxySpec, placement });
  assert.notEqual(result.level, "not_compatible");
  assert.ok(!result.reasonCodes.includes("PLACEMENT_NOT_ALLOWED"));

  const framedHost = {
    ...host,
    id: "test-framed-drawer-front",
    metadata: { profileGeometry: { kind: "framed_panel" } }
  };
  const standardPull = {
    ...proxySpec,
    category: "d_handle_pull",
    compatiblePlacements: ["drawer_front"],
    dimensionsMm: { ...proxySpec.dimensionsMm, projection: 25 }
  };
  const framedPlacement = createRecommendedHardwarePlacement(framedHost, standardPull);
  assert.equal(framedPlacement.verticalAnchor, "top");
  assert.notEqual(evaluateHardwareCompatibility({
    host: framedHost,
    proxySpec: standardPull,
    placement: framedPlacement
  }).level, "not_compatible");
});

test("a component-scope hardware change on one paired leaf remains buildable with a review warning", () => {
  const preset = layoutPresets.find((entry) => entry.id === "asymmetric-modern");
  const initialLayout = generateBookcaseLayout(preset.config);
  const selectedLeaf = initialLayout.components.find((component) => component.role === "door" && component.metadata?.leafCount === 2);
  assert.ok(selectedLeaf);

  const selections = createLegacyHardwareSelections(preset.config.hardware);
  selections.byHostId[selectedLeaf.id] = {
    variantId: PULL_VARIANT_ID,
    snapshot: structuredClone(PULL_SNAPSHOT),
    placement: createRecommendedHardwarePlacement(selectedLeaf, getHardwareProxySpec(PULL_SNAPSHOT))
  };
  const evaluation = evaluateBookcaseCandidate({ ...preset.config, hardwareSelections: selections });
  assert.equal(evaluation.accepted, true, JSON.stringify(evaluation.errors));
  assert.ok(evaluation.warnings.some((warning) => warning.code === "PAIRED_HARDWARE_NOT_MIRRORED"));
  assert.equal(evaluation.state.hardwareSelections.byHostId[selectedLeaf.id].variantId, PULL_VARIANT_ID);
  const scheduleEntry = evaluation.bom.hardware.schedule.find((entry) => entry.variantId === PULL_VARIANT_ID);
  assert.ok(scheduleEntry.warnings.some((warning) => /intentional mixed placement/i.test(warning)));
  assert.ok(JSON.parse(createQuotePrefill(evaluation.state).fields.hardwareSchedule)
    .some((entry) => entry.warnings.some((warning) => /intentional mixed placement/i.test(warning))));
});

test("custom anchors resolve independent signed long-axis and cross-axis offsets", () => {
  const preset = layoutPresets.find((entry) => entry.id === "asymmetric-modern");
  const initialLayout = generateBookcaseLayout(preset.config);
  const host = initialLayout.components.find((component) => component.role === "door" && component.metadata?.profileGeometry?.kind === "slab");
  assert.ok(host);
  const selections = createLegacyHardwareSelections(preset.config.hardware);
  const crossAxisOffsetMm = host.metadata?.latchSide === "latch_left" ? -12.7 : 12.7;
  selections.byHostId[host.id] = {
    variantId: PULL_VARIANT_ID,
    snapshot: structuredClone(PULL_SNAPSHOT),
    placement: {
      orientation: "vertical",
      horizontalAnchor: "custom",
      verticalAnchor: "custom",
      edgeOffsetMm: 25.4,
      crossAxisOffsetMm,
      quantityPerFront: 1
    }
  };
  const evaluation = evaluateBookcaseCandidate({ ...preset.config, hardwareSelections: selections });
  assert.equal(evaluation.accepted, true, JSON.stringify(evaluation.errors));
  const handle = evaluation.layout.components.find((component) => component.role === "handle" && component.hostId === host.id);
  assert.equal(handle.position.x, host.position.x + crossAxisOffsetMm / 25.4);
  assert.equal(handle.position.y, host.position.y + 1);
});
