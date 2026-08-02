import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  createGuidedAcceptedSnapshot,
  evaluateGuidedProjectCandidate,
  prepareGuidedProjectPersistence,
  prepareGuidedQuote,
  restoreGuidedAcceptedSnapshot,
  transactGuidedProject
} from "../guided-project-engine.js";
import {
  GUIDED_ROOM_LAYOUT_IDS,
  resolveRoomTopology
} from "../guided-room-topology.js";
import { PRICING_RATES } from "../bookcase-pricing.js";

const goldenCatalog = JSON.parse(readFileSync(
  new URL("../config/golden-projects.json", import.meta.url),
  "utf8"
));
const goldenProjects = goldenCatalog.projects;
const goldenById = new Map(goldenProjects.map((project) => [project.id, project]));
const EPSILON = 0.001;

const topologyCandidates = Object.freeze({
  "niche-layout": {
    wallWidth: 120,
    ceilingHeight: 96,
    desiredDepth: 15,
    nicheWidth: 96,
    nicheHeight: 96,
    nicheDepth: 15,
    leftReturn: 12,
    rightReturn: 12
  },
  "left-niche": {
    wallWidth: 120,
    ceilingHeight: 96,
    desiredDepth: 14,
    nicheWidth: 96,
    nicheHeight: 96,
    nicheDepth: 14,
    leftReturn: 12
  },
  "right-niche": {
    wallWidth: 120,
    ceilingHeight: 96,
    desiredDepth: 14,
    nicheWidth: 96,
    nicheHeight: 96,
    nicheDepth: 14,
    rightReturn: 12
  },
  "clear-wall": {
    wallWidth: 144,
    ceilingHeight: 108,
    desiredDepth: 15
  },
  "fireplace-wall": {
    wallWidth: 180,
    ceilingHeight: 108,
    desiredDepth: 15,
    fireplaceWidth: 42,
    fireplaceHeight: 32,
    fireplaceDepth: 8,
    mantelWidth: 60,
    mantelHeight: 48,
    fireplaceLeftWidth: 48,
    fireplaceRightWidth: 48
  },
  "center-recess": {
    wallWidth: 180,
    ceilingHeight: 108,
    desiredDepth: 15,
    projectionWidth: 42,
    projectionHeight: 48,
    projectionDepth: 8
  },
  "window-wall": {
    wallWidth: 144,
    ceilingHeight: 96,
    desiredDepth: 18,
    windowWidth: 60,
    windowHeight: 48,
    sillHeight: 30,
    windowLeftDistance: 42,
    windowRightDistance: 42,
    radiatorBelowWindow: "no"
  },
  "door-wall": {
    wallWidth: 144,
    ceilingHeight: 96,
    desiredDepth: 14,
    doorWidth: 36,
    doorHeight: 80,
    doorLeftDistance: 54,
    doorTrimWidth: 3.5,
    doorSwing: "right-in"
  },
  "corner-wall": {
    wallWidth: 120,
    ceilingHeight: 96,
    desiredDepth: 13,
    cornerReturn: 60
  },
  "double-opening": {
    wallWidth: 96,
    ceilingHeight: 96,
    desiredDepth: 14,
    openingLeftDistance: 24,
    openingRightDistance: 24
  }
});

test("the golden catalog and the twelve committed fixture files are identical", () => {
  assert.equal(goldenCatalog.schemaVersion, 1);
  assert.equal(goldenProjects.length, 12);
  assert.equal(new Set(goldenProjects.map((project) => project.id)).size, 12);

  for (const project of goldenProjects) {
    const fixture = JSON.parse(readFileSync(
      new URL(`./fixtures/guided-golden/${project.id}.json`, import.meta.url),
      "utf8"
    ));
    assert.deepEqual(fixture, project, `${project.id} drifted from config/golden-projects.json`);
  }
});

test("all ten public room layouts resolve physical planes and exclusion-safe zones", async (t) => {
  assert.deepEqual(Object.keys(topologyCandidates).sort(), [...GUIDED_ROOM_LAYOUT_IDS].sort());

  for (const layoutId of GUIDED_ROOM_LAYOUT_IDS) {
    await t.test(layoutId, () => {
      const topology = resolveRoomTopology({
        layoutId,
        measurements: topologyCandidates[layoutId]
      });
      assert.equal(topology.accepted, true, JSON.stringify(topology.errors));
      assert.equal(topology.layoutId, layoutId);
      assert.equal(topology.units, "inches");
      assert.ok(topology.installationZones.length > 0);
      assert.equal(topology.floorPlaneY, 0);
      assert.ok(Number.isFinite(topology.rearWallPlaneZ));
      assert.ok(Object.isFrozen(topology));

      for (const zone of topology.installationZones) {
        assert.ok(zone.rightPlaneX - zone.leftPlaneX > EPSILON, `${zone.id} has no width`);
        assert.ok(zone.topPlaneY - zone.bottomPlaneY > EPSILON, `${zone.id} has no height`);
        assert.ok(Number.isFinite(zone.backPlaneZ), `${zone.id} has no back plane`);
        assert.deepEqual(zone.orientation.heightAxis, [0, 1, 0]);
      }
      assertZonesDoNotEnterExclusions(topology);
    });
  }
});

test("all twelve golden projects produce one audited accepted specification", async (t) => {
  for (const project of goldenProjects) {
    await t.test(project.id, () => {
      const specification = evaluateGuidedProjectCandidate(project);
      assert.equal(
        specification.accepted,
        true,
        `${project.id}: ${specification.stage || "unknown"} ${JSON.stringify(specification.errors)}`
      );
      assert.equal(specification.productId, project.productId);
      assert.equal(specification.layoutId, project.layoutId);
      assert.equal(specification.audit.valid, true, JSON.stringify(specification.audit.errors));
      assert.equal(specification.errors.length, 0);
      assert.ok(specification.geometryFingerprint.startsWith("jq-guided-geometry-v1-"));
      assert.ok(specification.selectionFingerprint.startsWith("jq-guided-selection-v1-"));
      assert.ok(specification.specificationFingerprint.startsWith("jq-guided-spec-v1-"));
      assert.ok(Object.isFrozen(specification));
      assert.ok(Object.isFrozen(specification.room));
      assert.ok(Object.isFrozen(specification.fit));
      assert.ok(Object.isFrozen(specification.product));
      assert.equal(specification.fit.invariants.noGlobalScaling, true);
      assert.deepEqual(specification.fit.invariants.rootScale, [1, 1, 1]);
      assert.ok(specification.product.descriptorSets.length > 0);

      for (const installation of specification.fit.installations) {
        assertInstallationContract(installation);
      }
      for (const descriptorSet of specification.product.descriptorSets) {
        assert.deepEqual(descriptorSet.rootScale, [1, 1, 1]);
        assert.equal(descriptorSet.validation.valid, true, JSON.stringify(descriptorSet.validation.errors));
        assert.ok(specification.fit.installations.some((entry) => entry.id === descriptorSet.installationId));
        assertDescriptorBounds(descriptorSet);
      }
      assertZonesDoNotEnterExclusions(specification.room);
      assertGoldenExpectation(project, specification);
    });
  }
});

test("G05 and G07 aggregate canonical runs into one stable project price", () => {
  for (const id of ["G05-fireplace", "G07-door-wall"]) {
    const project = goldenById.get(id);
    const first = evaluateGuidedProjectCandidate(project);
    const repeated = evaluateGuidedProjectCandidate(structuredClone(project));
    assert.equal(first.accepted, true, `${id}: ${JSON.stringify(first.errors)}`);
    assert.equal(first.pricingStatus, "canonical", id);
    assert.equal(first.pricing.available, true, id);
    assert.equal(first.pricing.aggregation, "single-project-canonical-line-items", id);
    assert.ok(first.pricing.installations.length > 1, id);

    for (const code of ["BASE_PROJECT", "INSTALLATION", "DELIVERY"]) {
      assert.equal(
        first.pricing.lineItems.filter((item) => item.code === code).length,
        1,
        `${id}: ${code} must occur once`
      );
    }
    const base = first.pricing.lineItems.find((item) => item.code === "BASE_PROJECT");
    const delivery = first.pricing.lineItems.find((item) => item.code === "DELIVERY");
    const installation = first.pricing.lineItems.find((item) => item.code === "INSTALLATION");
    assert.equal(base.amount, PRICING_RATES.baseProject, id);
    assert.equal(delivery.amount, PRICING_RATES.delivery.standard, id);
    assert.equal(
      installation.amount,
      Math.max(
        PRICING_RATES.professionalInstallationMinimum,
        first.pricing.acceptedCaseworkWidthIn * PRICING_RATES.professionalInstallationPerWidthIn
      ),
      id
    );

    for (const code of ["ENVELOPE_AREA", "SECTIONS", "LOWER_STORAGE", "HARDWARE_BRASS_PULL", "LIGHTING_PUCK"]) {
      const combined = first.pricing.lineItems.find((item) => item.code === code);
      const installationLines = first.pricing.installations
        .flatMap((item) => item.breakdown.lineItems)
        .filter((item) => item.code === code);
      if (!installationLines.length) continue;
      assert.equal(
        combined.quantity,
        installationLines.reduce((sum, item) => sum + item.quantity, 0),
        `${id}: ${code} quantity`
      );
      assert.equal(
        combined.amount,
        installationLines.reduce((sum, item) => sum + item.amount, 0),
        `${id}: ${code} amount`
      );
    }

    const duplicatedInstallationTotals = first.pricing.installations.reduce((sum, item) => sum + item.total, 0);
    assert.ok(first.pricing.total < duplicatedInstallationTotals, id);
    assert.deepEqual(repeated.pricing, first.pricing, `${id}: repeated evaluation changed price`);
  }
});

test("a rejected edit is atomic and preserves the exact last accepted specification", () => {
  const validProject = goldenById.get("G02-center-niche-cabinets");
  const accepted = evaluateGuidedProjectCandidate(validProject);
  assert.equal(accepted.accepted, true);

  const invalidProject = structuredClone(validProject);
  invalidProject.measurements.wallWidth = -1;
  const transaction = transactGuidedProject(invalidProject, accepted);

  assert.equal(transaction.accepted, false);
  assert.equal(transaction.changed, false);
  assert.equal(transaction.geometryChanged, false);
  assert.equal(transaction.materialChanged, false);
  assert.equal(transaction.specification, accepted);
  assert.equal(transaction.rejectedCandidate.stage, "room-topology");
  assert.ok(transaction.errors.some((error) => error.code === "MISSING_BASE_ROOM_DIMENSIONS"));
});

test("accepted persistence rejects an invalid edit and keeps save, reload, and quote identity atomic", () => {
  const acceptedProject = structuredClone(goldenById.get("G02-center-niche-cabinets"));
  acceptedProject.projectId = "accepted-save-transaction";
  const acceptedPreparation = prepareGuidedProjectPersistence(acceptedProject);

  assert.equal(acceptedPreparation.accepted, true, JSON.stringify(acceptedPreparation.errors));
  assert.equal(acceptedPreparation.persistable, true);
  assert.equal(acceptedPreparation.code, "GUIDED_SAVE_READY");
  assert.equal(
    acceptedPreparation.project.acceptedSnapshot.specificationFingerprint,
    acceptedPreparation.specification.specificationFingerprint
  );

  const persisted = JSON.parse(JSON.stringify(acceptedPreparation.project));
  const reloaded = restoreGuidedAcceptedSnapshot(persisted, persisted.acceptedSnapshot);
  assert.equal(reloaded.accepted, true, JSON.stringify(reloaded.errors));
  assert.equal(reloaded.layoutId, acceptedPreparation.specification.layoutId);
  assert.equal(reloaded.geometryFingerprint, acceptedPreparation.specification.geometryFingerprint);
  assert.equal(reloaded.specificationFingerprint, acceptedPreparation.specification.specificationFingerprint);

  const invalidEdit = structuredClone(acceptedPreparation.project);
  invalidEdit.measurements.wallWidth = -1;
  const rejectedPreparation = prepareGuidedProjectPersistence(
    invalidEdit,
    acceptedPreparation.specification
  );
  assert.equal(rejectedPreparation.accepted, false);
  assert.equal(rejectedPreparation.persistable, false);
  assert.equal(rejectedPreparation.code, "GUIDED_SAVE_REJECTED_CANDIDATE");
  assert.equal(rejectedPreparation.project, null);
  assert.equal(rejectedPreparation.snapshot, null);
  assert.equal(rejectedPreparation.specification, acceptedPreparation.specification);
  assert.ok(rejectedPreparation.errors.some(({ code }) => code === "MISSING_BASE_ROOM_DIMENSIONS"));

  const quote = prepareGuidedQuote(invalidEdit, acceptedPreparation.snapshot);
  assert.equal(quote.accepted, false);
  assert.equal(quote.stage, "quote-integrity");
  assert.ok(quote.errors.some(({ code }) => code === "GUIDED_QUOTE_INTEGRITY_FAILED"));

  const stillReloaded = restoreGuidedAcceptedSnapshot(persisted, persisted.acceptedSnapshot);
  assert.equal(stillReloaded.accepted, true);
  assert.equal(stillReloaded.geometryFingerprint, reloaded.geometryFingerprint);
  assert.equal(stillReloaded.specificationFingerprint, reloaded.specificationFingerprint);
});

test("a finish-only edit changes material identity without changing physical geometry", () => {
  const project = structuredClone(goldenById.get("G03-clear-drawers-wide"));
  project.hardware = "brass-pull";
  const original = evaluateGuidedProjectCandidate(project);
  assert.equal(original.accepted, true);

  const finishOnly = structuredClone(project);
  finishOnly.finish = "dark-walnut";
  const finishTransaction = transactGuidedProject(finishOnly, original);
  assert.equal(finishTransaction.accepted, true);
  assert.equal(finishTransaction.changed, true);
  assert.equal(finishTransaction.geometryChanged, false);
  assert.equal(finishTransaction.materialChanged, true);
  assert.equal(finishTransaction.specification.geometryFingerprint, original.geometryFingerprint);
  assert.notEqual(finishTransaction.specification.selectionFingerprint, original.selectionFingerprint);
  assert.notEqual(finishTransaction.specification.specificationFingerprint, original.specificationFingerprint);
  assert.notDeepEqual(finishTransaction.specification.materialState, original.materialState);

  const hardwareOnly = structuredClone(finishOnly);
  hardwareOnly.hardware = "matte-black-pull";
  const hardwareTransaction = transactGuidedProject(hardwareOnly, finishTransaction.specification);
  assert.equal(hardwareTransaction.accepted, true);
  assert.equal(hardwareTransaction.geometryChanged, false);
  assert.equal(hardwareTransaction.materialChanged, true);
  assert.equal(
    hardwareTransaction.specification.geometryFingerprint,
    finishTransaction.specification.geometryFingerprint
  );
  assert.notEqual(
    hardwareTransaction.specification.selectionFingerprint,
    finishTransaction.specification.selectionFingerprint
  );

  const noLighting = structuredClone(hardwareOnly);
  noLighting.lighting = "no-lighting";
  const noLightingTransaction = transactGuidedProject(
    noLighting,
    hardwareTransaction.specification
  );
  assert.equal(noLightingTransaction.accepted, true);
  assert.equal(noLightingTransaction.geometryChanged, false);
  assert.equal(noLightingTransaction.materialChanged, true);
  assert.equal(
    noLightingTransaction.specification.geometryFingerprint,
    hardwareTransaction.specification.geometryFingerprint
  );
  assert.ok(
    noLightingTransaction.specification.pricing.total
      < hardwareTransaction.specification.pricing.total
  );
  assert.equal(
    noLightingTransaction.specification.pricing.installations[0].breakdown.lineItems
      .filter(({ code }) => code.startsWith("LIGHTING_"))
      .reduce((sum, item) => sum + item.amount, 0),
    0
  );

  const integratedLighting = structuredClone(noLighting);
  integratedLighting.lighting = "integrated-led";
  const integratedLightingTransaction = transactGuidedProject(
    integratedLighting,
    noLightingTransaction.specification
  );
  assert.equal(integratedLightingTransaction.accepted, true);
  assert.equal(integratedLightingTransaction.geometryChanged, false);
  assert.equal(integratedLightingTransaction.materialChanged, true);
  assert.equal(
    integratedLightingTransaction.specification.geometryFingerprint,
    original.geometryFingerprint
  );
  assert.ok(
    integratedLightingTransaction.specification.pricing.total
      > noLightingTransaction.specification.pricing.total
  );
});

test("Clear Wall fitted and freestanding choices produce distinct accepted physical specifications", () => {
  const fittedProject = {
    projectId: "clear-wall-fit-contract",
    productId: "cabinet-shelves",
    layoutId: "clear-wall",
    measurements: {
      wallWidth: 120,
      ceilingHeight: 96,
      desiredDepth: 14
    },
    finish: "natural-oak",
    accentFinish: "natural-oak",
    doorStyle: "shaker",
    hardware: "brass-pull",
    lighting: "warm-led",
    baseStyle: "flush-base",
    topTreatment: "small-crown"
  };
  const fitted = evaluateGuidedProjectCandidate(fittedProject);
  assert.equal(fitted.accepted, true, JSON.stringify(fitted.errors));
  assert.equal(fitted.fit.mode, "fitted");
  assert.equal(fitted.fit.casework.overallHeight, 96);
  assert.equal(fitted.fit.casework.depth, 14);

  const freestandingProject = { ...fittedProject, baseStyle: "furniture-base" };
  const transaction = transactGuidedProject(freestandingProject, fitted);
  assert.equal(transaction.accepted, true, JSON.stringify(transaction.errors));
  assert.equal(transaction.changed, true);
  assert.equal(transaction.geometryChanged, true);
  const freestanding = transaction.specification;
  assert.equal(freestanding.fit.mode, "freestanding");
  assert.equal(freestanding.fit.casework.overallHeight, 95.5);
  assert.equal(freestanding.fit.casework.depth, 14);
  assert.equal(freestanding.fit.casework.topPlaneY, 95.5);
  assert.equal(freestanding.fit.zoneBounds.top - freestanding.fit.casework.topPlaneY, 0.5);
  assert.equal(freestanding.fit.treatments.left.kind, "clearance");
  assert.equal(freestanding.fit.treatments.right.kind, "clearance");
  assert.equal(freestanding.fit.treatments.left.width, freestanding.fit.treatments.right.width);
  assert.equal(freestanding.fit.treatments.base.kind, "furniture-base");
  assert.equal(freestanding.fit.treatments.base.height, 4.5);
  assert.equal(freestanding.product.canonicalConfig.height, 95.5);
  assert.equal(freestanding.product.canonicalEvaluations[0].evaluation.layout.config.height, 95.5);
  assert.deepEqual(freestanding.fit.invariants.rootScale, [1, 1, 1]);
  assert.notEqual(freestanding.geometryFingerprint, fitted.geometryFingerprint);
  assert.notEqual(freestanding.specificationFingerprint, fitted.specificationFingerprint);

  const prepared = prepareGuidedProjectPersistence(freestandingProject, freestanding);
  assert.equal(prepared.accepted, true, JSON.stringify(prepared.errors));
  const restored = restoreGuidedAcceptedSnapshot(
    JSON.parse(JSON.stringify(prepared.project)),
    JSON.parse(JSON.stringify(prepared.snapshot))
  );
  assert.equal(restored.accepted, true, JSON.stringify(restored.errors));
  assert.equal(restored.fit.casework.overallHeight, 95.5);
  assert.equal(restored.geometryFingerprint, freestanding.geometryFingerprint);
  assert.equal(restored.specificationFingerprint, freestanding.specificationFingerprint);
});

test("G01 TV compact payload regenerates topology, fit, descriptors, materials, fingerprints, and camera defaults", () => {
  const project = structuredClone(goldenById.get("G01-right-niche-tv"));
  project.projectId = "golden-tv-payload";
  const specification = evaluateGuidedProjectCandidate(project);
  assert.equal(specification.accepted, true, JSON.stringify(specification.errors));

  const snapshot = createGuidedAcceptedSnapshot(specification, project);
  const serialized = JSON.stringify(snapshot);
  assert.equal(snapshot.schemaVersion, 2);
  assert.equal(Object.hasOwn(snapshot, "acceptedSpecification"), false);
  assert.ok(Buffer.byteLength(serialized, "utf8") < 2_048, "G01 compact snapshot stays below 2 KiB");
  assert.deepEqual(snapshot.summary.tv, {
    accepted: true,
    body: { width: 56, height: 33 },
    opening: { width: 60, height: 37 }
  });

  const restored = restoreGuidedAcceptedSnapshot(project, JSON.parse(serialized));
  assert.equal(restored.accepted, true, JSON.stringify(restored.errors));
  assert.deepEqual(restored.room, specification.room, "room topology regenerates exactly");
  assert.deepEqual(restored.fit, specification.fit, "installation fit regenerates exactly");
  assert.deepEqual(
    restored.product.descriptorSets,
    specification.product.descriptorSets,
    "physical descriptor graph regenerates exactly"
  );
  assert.deepEqual(restored.product.tv, specification.product.tv, "TV body and opening regenerate exactly");
  assert.deepEqual(restored.materialState, specification.materialState, "accepted material IDs regenerate exactly");
  assert.deepEqual(
    restored.product.materialState,
    specification.product.materialState,
    "descriptor material assignments regenerate exactly"
  );
  assert.equal(restored.geometryFingerprint, specification.geometryFingerprint);
  assert.equal(restored.selectionFingerprint, specification.selectionFingerprint);
  assert.equal(restored.specificationFingerprint, specification.specificationFingerprint);
  assert.equal(restored.room.cameraIntent, specification.room.cameraIntent);
  assert.deepEqual(
    restored.product.topologyRef.cameraIntent,
    specification.product.topologyRef.cameraIntent,
    "accepted camera default regenerates exactly"
  );

  const tampered = JSON.parse(serialized);
  tampered.regeneration.descriptorFingerprint = "jq-guided-snapshot-descriptors-v1-tampered";
  const rejected = restoreGuidedAcceptedSnapshot(project, tampered);
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.errors[0].code, "GUIDED_SNAPSHOT_FINGERPRINT_MISMATCH");
  assert.deepEqual(rejected.errors[0].mismatches, ["regeneration.descriptorFingerprint"]);
});

test("all golden accepted snapshots remain bounded far below localStorage-scale payloads", () => {
  const sizes = goldenProjects.map((project) => {
    const specification = evaluateGuidedProjectCandidate(project);
    assert.equal(specification.accepted, true, `${project.id}: ${JSON.stringify(specification.errors)}`);
    const snapshot = createGuidedAcceptedSnapshot(specification, project);
    const serialized = JSON.stringify(snapshot);
    assert.equal(Object.hasOwn(snapshot, "acceptedSpecification"), false, `${project.id} embeds no descriptor graph`);
    assert.ok(
      Buffer.byteLength(serialized, "utf8") < 4_096,
      `${project.id} compact snapshot exceeds the 4 KiB contract`
    );
    return { id: project.id, bytes: Buffer.byteLength(serialized, "utf8") };
  });
  assert.ok(Math.max(...sizes.map(({ bytes }) => bytes)) < 2_048, JSON.stringify(sizes));
});

test("static and connected quote transports share one verified compact quote contract", () => {
  const project = structuredClone(goldenById.get("G01-right-niche-tv"));
  project.projectId = "golden-tv-quote";
  const specification = evaluateGuidedProjectCandidate(project);
  assert.equal(specification.accepted, true, JSON.stringify(specification.errors));
  const snapshot = createGuidedAcceptedSnapshot(specification, project);

  const prepared = prepareGuidedQuote(project, snapshot);
  assert.equal(prepared.accepted, true, JSON.stringify(prepared.errors));
  assert.equal(prepared.specification.specificationFingerprint, specification.specificationFingerprint);
  assert.equal(prepared.snapshot.schemaVersion, 2);
  assert.equal(prepared.quote.integrity.verified, true);
  assert.equal(prepared.quote.integrity.sourceSnapshotSchemaVersion, 2);
  assert.equal(prepared.quote.identity.geometryFingerprint, specification.geometryFingerprint);
  assert.equal(prepared.quote.identity.specificationFingerprint, specification.specificationFingerprint);
  assert.equal(prepared.quote.pricing.total, specification.pricing.total);
  assert.equal(prepared.quote.pricing.available, true);
  assert.deepEqual(
    prepared.quote.pricing.installations[0].lineItems,
    specification.pricing.installations[0].breakdown.lineItems
  );
  assert.deepEqual(prepared.quote.warnings.items, specification.warnings);

  const canonicalBom = specification.pricing.installations[0].breakdown.bom;
  assert.equal(
    prepared.quote.bom.billableComponentCount,
    canonicalBom.acceptedDescriptorGraph.componentCount
  );
  assert.deepEqual(prepared.quote.bom.byRole, {
    ...canonicalBom.acceptedDescriptorGraph.byRole,
    screen: 1
  });
  assert.equal(
    prepared.quote.bom.installations[0].canonical.layoutFingerprint,
    canonicalBom.layoutFingerprint
  );
  assert.deepEqual(
    prepared.quote.bom.installations[0].canonical.countertops,
    canonicalBom.countertops
  );
  assert.deepEqual(
    prepared.quote.pricing.installations[0].lineItems
      .filter((item) => item.code.startsWith("SHELF_THICKNESS"))
      .map((item) => item.thicknessIn),
    [1, 1.25]
  );
  assert.equal(prepared.quote.bom.customerEquipmentCount, 1);
  assert.match(prepared.quote.bom.fingerprint, /^jq-guided-quote-bom-v1-/);
  assert.match(prepared.quote.integrity.quoteFingerprint, /^jq-guided-quote-contract-v1-/);

  const connectedProjectPayload = {
    ...project,
    acceptedSnapshot: prepared.snapshot,
    acceptedQuote: prepared.quote
  };
  const serializedConnectedPayload = JSON.stringify(connectedProjectPayload);
  assert.equal(serializedConnectedPayload.includes("descriptorSets"), false);
  assert.equal(serializedConnectedPayload.includes("acceptedSpecification"), false);
  assert.equal(serializedConnectedPayload.includes("componentIds"), false);
  assert.ok(Buffer.byteLength(JSON.stringify(prepared.snapshot), "utf8") < 2_048);

  const repeated = prepareGuidedQuote(project, prepared.snapshot);
  assert.equal(repeated.accepted, true);
  assert.deepEqual(repeated.quote, prepared.quote, "both transports regenerate the same quote evidence");
});

test("legacy v1 quote snapshots verify then upgrade without carrying their descriptor graph", () => {
  const project = structuredClone(goldenById.get("G10-floating"));
  project.projectId = "golden-legacy-quote";
  const specification = evaluateGuidedProjectCandidate(project);
  assert.equal(specification.accepted, true, JSON.stringify(specification.errors));
  const legacySnapshot = {
    schemaVersion: 1,
    geometryFingerprint: specification.geometryFingerprint,
    selectionFingerprint: specification.selectionFingerprint,
    specificationFingerprint: specification.specificationFingerprint,
    productId: specification.productId,
    layoutId: specification.layoutId,
    acceptedSpecification: specification
  };

  const prepared = prepareGuidedQuote(project, legacySnapshot);
  assert.equal(prepared.accepted, true, JSON.stringify(prepared.errors));
  assert.equal(prepared.quote.integrity.sourceSnapshotSchemaVersion, 1);
  assert.equal(prepared.snapshot.schemaVersion, 2);
  assert.equal(Object.hasOwn(prepared.snapshot, "acceptedSpecification"), false);
  assert.equal(prepared.quote.pricing.available, false);
  assert.equal(prepared.quote.pricing.total, null);
  assert.deepEqual(prepared.quote.warnings.items, specification.warnings);
  assert.ok(prepared.quote.bom.componentCount > 0);
  assert.match(prepared.quote.bom.fingerprint, /^jq-guided-quote-bom-v1-/);
  assert.ok(Buffer.byteLength(JSON.stringify(prepared.snapshot), "utf8") < 2_048);

  const serializedQuote = JSON.stringify(prepared.quote);
  assert.equal(serializedQuote.includes("descriptorSets"), false);
  assert.equal(serializedQuote.includes("acceptedSpecification"), false);
  assert.equal(serializedQuote.includes("componentIds"), false);
});

test("quote preparation rejects stale or tampered compact snapshots", () => {
  const project = structuredClone(goldenById.get("G12-round-trip"));
  const specification = evaluateGuidedProjectCandidate(project);
  const snapshot = createGuidedAcceptedSnapshot(specification, project);
  const tampered = structuredClone(snapshot);
  tampered.regeneration.descriptorFingerprint = "jq-guided-snapshot-descriptors-v1-tampered";

  const prepared = prepareGuidedQuote(project, tampered);
  assert.equal(prepared.accepted, false);
  assert.equal(prepared.stage, "quote-integrity");
  assert.equal(prepared.specification, null);
  assert.equal(prepared.snapshot, null);
  assert.equal(prepared.quote, null);
  assert.equal(prepared.errors[0].code, "GUIDED_QUOTE_INTEGRITY_FAILED");
  assert.ok(prepared.errors.some((error) => error.code === "GUIDED_SNAPSHOT_FINGERPRINT_MISMATCH"));

  const identityTampered = structuredClone(snapshot);
  identityTampered.engineVersion = "2025.01-unknown-engine";
  identityTampered.projectId = "another-project";
  const identityRejected = prepareGuidedQuote(project, identityTampered);
  assert.equal(identityRejected.accepted, false);
  assert.equal(identityRejected.errors[0].code, "GUIDED_QUOTE_SNAPSHOT_IDENTITY_MISMATCH");
  assert.deepEqual(identityRejected.errors[0].mismatches, ["engineVersion", "projectId"]);
});

test("accepted save data round-trips through JSON and regenerates every fingerprint", () => {
  const project = structuredClone(goldenById.get("G12-round-trip"));
  project.projectId = "golden-round-trip";
  const specification = evaluateGuidedProjectCandidate(project);
  assert.equal(specification.accepted, true);

  const snapshot = createGuidedAcceptedSnapshot(specification, project);
  const persisted = JSON.parse(JSON.stringify(snapshot));
  const restored = restoreGuidedAcceptedSnapshot(structuredClone(project), persisted);
  assert.equal(restored.accepted, true, JSON.stringify(restored.errors));
  assert.equal(restored.geometryFingerprint, snapshot.geometryFingerprint);
  assert.equal(restored.selectionFingerprint, snapshot.selectionFingerprint);
  assert.equal(restored.specificationFingerprint, snapshot.specificationFingerprint);
  assert.deepEqual(restored.room, specification.room);
  assert.deepEqual(restored.product.descriptorSets, specification.product.descriptorSets);
  assert.deepEqual(restored.fit, specification.fit);
  assert.deepEqual(restored.materialState, specification.materialState);

  const changed = structuredClone(project);
  changed.finish = "natural-oak";
  const mismatch = restoreGuidedAcceptedSnapshot(changed, persisted);
  assert.equal(mismatch.accepted, false);
  assert.equal(mismatch.stage, "restore");
  assert.equal(mismatch.errors[0].code, "GUIDED_SNAPSHOT_FINGERPRINT_MISMATCH");
});

test("500 seeded candidates remain deterministic, unit-scaled, balanced, and auditable", () => {
  const firstInputs = createFuzzCandidates(0x7a11ce01, 500);
  const secondInputs = createFuzzCandidates(0x7a11ce01, 500);
  assert.deepEqual(secondInputs, firstInputs);

  const firstFingerprints = [];
  for (const [index, candidate] of firstInputs.entries()) {
    const specification = evaluateGuidedProjectCandidate(candidate);
    assert.equal(
      specification.accepted,
      true,
      `fuzz ${index}: ${specification.stage || "unknown"} ${JSON.stringify(specification.errors)}`
    );
    assert.equal(specification.audit.valid, true, `fuzz ${index}: ${JSON.stringify(specification.audit.errors)}`);
    assert.deepEqual(specification.fit.invariants.rootScale, [1, 1, 1]);
    assert.equal(specification.fit.invariants.noGlobalScaling, true);
    for (const installation of specification.fit.installations) assertInstallationContract(installation);
    for (const descriptorSet of specification.product.descriptorSets) {
      assert.deepEqual(descriptorSet.rootScale, [1, 1, 1]);
      assertDescriptorBounds(descriptorSet);
    }
    firstFingerprints.push([
      specification.geometryFingerprint,
      specification.selectionFingerprint,
      specification.specificationFingerprint
    ]);
  }

  const repeatedFingerprints = secondInputs.map((candidate) => {
    const repeated = evaluateGuidedProjectCandidate(candidate);
    assert.equal(repeated.accepted, true, JSON.stringify(repeated.errors));
    return [
      repeated.geometryFingerprint,
      repeated.selectionFingerprint,
      repeated.specificationFingerprint
    ];
  });
  assert.deepEqual(repeatedFingerprints, firstFingerprints);
  assert.ok(new Set(firstFingerprints.map(([geometry]) => geometry)).size > 300);
});

function assertGoldenExpectation(project, specification) {
  const { fit, product, room } = specification;
  const components = product.descriptorSets.flatMap((set) => set.components);
  const installations = fit.installations;

  switch (project.id) {
    case "G01-right-niche-tv": {
      assert.deepEqual(installations.map(({ zoneId, role }) => [zoneId, role]), [["main", "primary"]]);
      assert.equal(room.features.niche.returnSide, "right");
      assert.equal(room.features.niche.offset, 12);
      assert.equal(installations[0].treatments.base.height, 4);
      assert.equal(installations[0].anchors.bottomY, room.floorPlaneY);
      const tvBody = findComponent(components, "tv-body");
      const tvOpening = findComponent(components, "tv-service-opening");
      assert.deepEqual(componentSize(tvBody), { width: 56, height: 33 });
      assert.deepEqual(componentSize(tvOpening), { width: 60, height: 37 });
      assert.deepEqual(product.tv.body, {
        width: 56,
        height: 33,
        derivation: {
          width: "diagonal-and-explicit-height",
          height: null
        }
      });
      assert.deepEqual(product.tv.opening, { width: 60, height: 37 });
      assert.equal(product.tv.soundbar.required, true);
      assert.equal(product.tv.requiredAssemblyHeight, 42.5);
      assert.equal(tvOpening.metadata.noDecorativeFrame, true);
      assert.equal(components.some((item) => /tv.*frame|frame.*tv/i.test(item.id)), false);
      assert.equal(product.pricing.basis, "final-accepted-descriptor-graph");
      assert.equal(
        product.pricing.installations[0].breakdown.bom.layoutFingerprint,
        product.canonicalEvaluations[0].evaluation.layoutFingerprint
      );
      const snapshot = createGuidedAcceptedSnapshot(specification, project);
      const restored = restoreGuidedAcceptedSnapshot(project, JSON.parse(JSON.stringify(snapshot)));
      assert.equal(restored.accepted, true, JSON.stringify(restored.errors));
      assert.deepEqual(restored.product.tv, product.tv);
      assert.deepEqual(
        restored.product.pricing.installations[0].breakdown.acceptedDescriptorGraph,
        product.pricing.installations[0].breakdown.acceptedDescriptorGraph
      );
      break;
    }
    case "G02-center-niche-cabinets": {
      assert.equal(installations[0].treatments.left.width, installations[0].treatments.right.width);
      assert.equal(installations[0].treatments.left.width, 1.5);
      assert.equal(installations[0].anchors.bottomY, room.floorPlaneY);
      assert.equal(installations[0].casework.topPlaneY, room.installationZones[0].topPlaneY);
      const treatmentParts = product.descriptorSets[0].components.filter((item) => (
        item.metadata?.installationTreatment?.primary === true
      ));
      const fillers = treatmentParts.filter((item) => item.role === "filler");
      assert.deepEqual(
        fillers.map((item) => [
          item.metadata.installationTreatment.position,
          componentSize(item).width
        ]),
        [["left", 1.5], ["right", 1.5]]
      );
      assert.ok(fillers.every((item) => item.metadata.installationTreatment.source === "accepted-installation-fit"));
      assert.ok(fillers.every((item) => product.renderManifest.entries.some((entry) => entry.componentId === item.id)));

      const baseTreatment = treatmentParts.find((item) => item.metadata.installationTreatment.position === "base");
      const topTreatment = treatmentParts.find((item) => item.metadata.installationTreatment.position === "top");
      assert.ok(baseTreatment.id.endsWith("/base"), "the canonical plinth is reused for the solved base");
      assert.equal(baseTreatment.metadata.reusesCanonicalComponent, true);
      assert.ok(topTreatment.id.includes("/crown-"), "the canonical crown is reused for the solved top");
      assert.equal(topTreatment.metadata.reusesCanonicalComponent, true);
      assert.equal(
        treatmentParts.some((item) => /installation-treatment-(base|top)/.test(item.id)),
        false,
        "canonical base and crown treatments are not duplicated"
      );
      break;
    }
    case "G03-clear-drawers-wide":
      assert.equal(installations[0].treatments.left.width, installations[0].treatments.right.width);
      assert.deepEqual(product.descriptorSets[0].rootScale, project.expected.rootScale);
      break;
    case "G04-clear-open":
      assert.equal(components.some((item) => ["door", "drawer_front", "handle"].includes(item.role)), false);
      break;
    case "G05-fireplace":
      assert.ok(room.exclusionVolumes.some((volume) => volume.featureId === "fireplace"));
      assertZonesDoNotEnterExclusions(room);
      break;
    case "G06-window-storage": {
      const storageTop = findComponent(components, "window-seat-top");
      assert.ok(storageTop.bounds.max.y <= room.features.window.bounds.min.y + EPSILON);
      assert.deepEqual(installations.map(({ zoneId, role }) => [zoneId, role]), [["below-window", "below-window"]]);
      break;
    }
    case "G07-door-wall":
      assertZonesDoNotEnterExclusions(room);
      assert.ok(installations.every((installation) => installation.zoneId !== "optional-over-door"));
      break;
    case "G08-between-openings":
      assert.equal(installations.length, 1);
      assert.equal(installations[0].zoneId, "between-openings");
      assert.ok(Math.abs(installations[0].anchors.centerX) <= EPSILON);
      assertZonesDoNotEnterExclusions(room);
      {
        const descriptorSet = product.descriptorSets[0];
        const finishedEnds = descriptorSet.components.filter((item) => (
          item.role === "end_panel"
          && item.metadata?.installationTreatment?.kind === "finished-end"
        ));
        assert.deepEqual(
          finishedEnds.map((item) => item.metadata.installationTreatment.position),
          ["left", "right"]
        );
        assert.ok(finishedEnds.every((item) => Math.abs(componentSize(item).width - 0.75) <= EPSILON));
        assert.ok(finishedEnds.every((item) => Math.abs(item.metadata.designClearance - 0.75) <= EPSILON));
        assert.ok(Math.abs(finishedEnds[0].bounds.max.x + installations[0].casework.width / 2) <= EPSILON);
        assert.ok(Math.abs(finishedEnds[1].bounds.min.x - installations[0].casework.width / 2) <= EPSILON);
        assert.ok(finishedEnds.every((item) => product.renderManifest.entries.some((entry) => entry.componentId === item.id)));
      }
      break;
    case "G09-corner":
      assert.deepEqual(new Set(installations.map((item) => item.zoneId)), new Set([
        "primary-run",
        "return-run",
        "corner"
      ]));
      assert.equal(room.cameraIntent, "corner-oblique");
      assert.ok(installations.some((installation) => (
        installation.orientation.widthAxis[0] === 0
        && Math.abs(installation.orientation.widthAxis[2]) === 1
      )));
      break;
    case "G10-floating":
      assert.equal(fit.mode, "floating");
      assert.equal(installations[0].anchors.bottomY, 18);
      assert.ok(installations[0].anchors.bottomY > room.floorPlaneY);
      assert.equal(installations[0].treatments.base.kind, "none");
      assert.equal(installations[0].treatments.base.height, 0);
      assert.equal(components.some((item) => item.role === "base"), false);
      break;
    case "G11-radiator": {
      assert.deepEqual(
        installations.map(({ zoneId, role }) => [zoneId, role]),
        [["below-window", "below-window"]]
      );
      const service = findComponent(components, "radiator-service-envelope");
      assert.equal(service.metadata.clearance, 2);
      assert.ok(components.some((item) => item.role === "slat"));
      assert.equal(components.some((item) => item.role === "back_panel"), false);
      const baseTreatment = findComponent(components, "installation-treatment-base-plinth");
      const topTreatment = findComponent(components, "installation-treatment-top-crown");
      assert.equal(baseTreatment.role, "plinth");
      assert.equal(baseTreatment.metadata.installationTreatment.position, "base");
      assert.equal(baseTreatment.metadata.installationTreatment.solvedDimension.value, 4);
      assert.equal(topTreatment.role, "crown");
      assert.equal(topTreatment.metadata.installationTreatment.position, "top");
      assert.equal(topTreatment.metadata.installationTreatment.solvedDimension.value, 0.75);
      assert.ok(product.renderManifest.entries.some((entry) => entry.componentId === baseTreatment.id));
      assert.ok(product.renderManifest.entries.some((entry) => entry.componentId === topTreatment.id));
      break;
    }
    case "G12-round-trip": {
      const snapshot = createGuidedAcceptedSnapshot(specification, project);
      const restored = restoreGuidedAcceptedSnapshot(project, JSON.parse(JSON.stringify(snapshot)));
      assert.equal(restored.accepted, true);
      assert.equal(restored.specificationFingerprint, specification.specificationFingerprint);
      break;
    }
    default:
      assert.fail(`Unhandled golden expectation for ${project.id}`);
  }
}

function assertInstallationContract(installation) {
  assert.deepEqual(installation.invariants.rootScale, [1, 1, 1]);
  assert.equal(installation.invariants.widthBalanced, true);
  assert.equal(installation.invariants.heightBalanced, true);
  assert.equal(installation.invariants.backAnchored, true);
  assert.equal(installation.invariants.frontPlaneDerivedFromDepth, true);

  const { casework, treatments, zoneBounds } = installation;
  const zoneWidth = zoneBounds.right - zoneBounds.left;
  const reconciledWidth = treatments.left.width + casework.width + treatments.right.width;
  assert.ok(Math.abs(zoneWidth - reconciledWidth) <= EPSILON, `${installation.id} width drifted`);
  const reconciledHeight = treatments.base.height + casework.bodyHeight + treatments.top.height;
  assert.ok(Math.abs(casework.overallHeight - reconciledHeight) <= EPSILON, `${installation.id} height drifted`);
  assert.ok(casework.leftPlaneX >= zoneBounds.left - EPSILON);
  assert.ok(casework.rightPlaneX <= zoneBounds.right + EPSILON);
  assert.ok(casework.topPlaneY <= zoneBounds.top + EPSILON);
  assert.ok(casework.bottomPlaneY >= zoneBounds.bottom - EPSILON);
  assert.ok(Math.abs(casework.backPlaneZ - zoneBounds.back) <= EPSILON);
  assert.ok(Math.abs(casework.backPlaneZ - casework.frontPlaneZ - casework.depth) <= EPSILON);

  const partitions = [
    treatments.left.bounds,
    treatments.right.bounds,
    treatments.base.bounds,
    treatments.top.bounds,
    casework.bounds
  ].filter(hasPositiveVolume);
  for (let leftIndex = 0; leftIndex < partitions.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < partitions.length; rightIndex += 1) {
      assert.equal(
        positiveIntersectionVolume(partitions[leftIndex], partitions[rightIndex]) > EPSILON,
        false,
        `${installation.id} fit partitions overlap`
      );
    }
  }
}

function assertDescriptorBounds(descriptorSet) {
  const componentIds = new Set();
  for (const component of descriptorSet.components) {
    assert.ok(component.id && !componentIds.has(component.id), `${descriptorSet.id} duplicate component id`);
    componentIds.add(component.id);
    assertBoundsContain(descriptorSet.bounds, component.bounds, `${descriptorSet.id}/${component.id}`);
  }
}

function assertBoundsContain(container, child, label) {
  for (const axis of ["x", "y", "z"]) {
    assert.ok(child.min[axis] >= container.min[axis] - EPSILON, `${label} underflows ${axis}`);
    assert.ok(child.max[axis] <= container.max[axis] + EPSILON, `${label} overflows ${axis}`);
  }
}

function assertZonesDoNotEnterExclusions(topology) {
  const exclusions = new Map(topology.exclusionVolumes.map((volume) => [volume.id, volume]));
  for (const zone of topology.installationZones) {
    const zoneBounds = {
      min: {
        x: zone.leftPlaneX,
        y: zone.bottomPlaneY,
        z: zone.backPlaneZ - topology.desiredDepth
      },
      max: {
        x: zone.rightPlaneX,
        y: zone.topPlaneY,
        z: zone.backPlaneZ
      }
    };
    for (const exclusionId of zone.exclusionVolumeIds) {
      const exclusion = exclusions.get(exclusionId);
      assert.ok(exclusion, `${zone.id} references missing ${exclusionId}`);
      // A radiator cover intentionally encloses the radiator service volume;
      // every opening, swing, trim, mantel, and projection remains exclusionary.
      if (exclusion.featureId === "radiator") continue;
      assert.equal(
        positiveIntersectionVolume(zoneBounds, exclusion.bounds) > EPSILON,
        false,
        `${zone.id} enters ${exclusionId}`
      );
    }
  }
}

function positiveIntersectionVolume(left, right) {
  return ["x", "y", "z"].reduce((volume, axis) => (
    volume * Math.max(0, Math.min(left.max[axis], right.max[axis]) - Math.max(left.min[axis], right.min[axis]))
  ), 1);
}

function hasPositiveVolume(bounds) {
  return ["x", "y", "z"].every((axis) => bounds.max[axis] - bounds.min[axis] > EPSILON);
}

function findComponent(components, suffix) {
  const component = components.find((item) => item.id.endsWith(`/${suffix}`));
  assert.ok(component, `Missing component ${suffix}`);
  return component;
}

function componentSize(component) {
  return {
    width: rounded(component.bounds.max.x - component.bounds.min.x),
    height: rounded(component.bounds.max.y - component.bounds.min.y)
  };
}

function rounded(value) {
  return Number(Number(value).toFixed(6));
}

function createFuzzCandidates(seed, count) {
  const random = seededRandom(seed);
  const productIds = ["cabinet-shelves", "drawer-shelves", "open-shelving"];
  const finishes = ["natural-oak", "warm-white", "dark-walnut", "medium-walnut"];
  const hardware = ["brass-pull", "matte-black-pull"];
  return Array.from({ length: count }, (_, index) => ({
    id: `fuzz-${String(index + 1).padStart(3, "0")}`,
    productId: productIds[index % productIds.length],
    layoutId: "clear-wall",
    measurements: {
      // Wall width is capped at 147 so the two 1.5-inch fillers leave a
      // canonical casework width at or below the existing engine's 144-inch max.
      wallWidth: 72 + Math.floor(random() * 76),
      ceilingHeight: 84 + Math.floor(random() * 25),
      desiredDepth: 12 + Math.floor(random() * 7)
    },
    finish: finishes[index % finishes.length],
    hardware: hardware[index % hardware.length]
  }));
}

function seededRandom(initialSeed) {
  let state = initialSeed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
