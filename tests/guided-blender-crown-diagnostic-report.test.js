import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  CROWN_DIAGNOSTIC_KIND,
  CROWN_DIAGNOSTIC_SCHEMA_VERSION,
  CROWN_DIAGNOSTIC_VERSION,
  CrownDiagnosticReportError,
  createCrownDiagnosticReport,
  validateCrownDiagnosticReport,
  isCrownGeometryModificationAuthorized
} from "../tools/blender/crown-diagnostic-report.mjs";
import {
  CROWN_DETAIL_QA_RULE_IDS,
  createCrownDetailQaCapture
} from "../tools/blender/crown-qa-contract.mjs";
import { createVerifiedClayRenderPackage } from "../tools/blender/run-clay-worker.mjs";

const SOURCE_COMMIT = "4449724f6fc5780b53922b5f176fab7d53e6ed7a";
const PRIMARY_BEAUTY = Object.freeze({
  pass: "beauty",
  objectKey: "jq-blender-package-v1-5af4ea52a32b54f80541e61d305e1ce1e4ce671c845cfce33a4980e080e6ad99/beauty.webp",
  mimeType: "image/webp",
  width: 960,
  height: 640,
  bytes: 7400,
  sha256: "ae544cc51ed2a06377fd7cc7d433fe27309c0eb97cccffecfc5ad2c7f4af0d5b"
});

let inputsPromise;

async function getInputs() {
  inputsPromise ||= createInputs();
  return structuredClone(await inputsPromise);
}

test("only a proven GEOMETRY_DEFECT classification authorizes crown mutation", () => {
  assert.equal(isCrownGeometryModificationAuthorized("GEOMETRY_DEFECT"), true);
  assert.equal(isCrownGeometryModificationAuthorized("PASS"), false);
  assert.equal(isCrownGeometryModificationAuthorized("CAMERA_READABILITY_ONLY"), false);
  assert.equal(isCrownGeometryModificationAuthorized("INDETERMINATE"), false);
  assert.throws(
    () => isCrownGeometryModificationAuthorized("LOOKS_SHALLOW"),
    (error) => (
      error instanceof CrownDiagnosticReportError
      && error.code === "UNSUPPORTED_CROWN_DIAGNOSTIC_CLASSIFICATION"
    )
  );
});

test("the full crown diagnostic is deterministic, strict, and authorizes only the proven defect", async () => {
  const firstInputs = await getInputs();
  const repeatedInputs = await getInputs();
  const first = await createCrownDiagnosticReport(firstInputs);
  const repeated = await createCrownDiagnosticReport(repeatedInputs);

  assert.deepEqual(repeated, first);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(first.kind, CROWN_DIAGNOSTIC_KIND);
  assert.equal(first.schemaVersion, CROWN_DIAGNOSTIC_SCHEMA_VERSION);
  assert.equal(first.diagnosticVersion, CROWN_DIAGNOSTIC_VERSION);
  assert.equal(first.sourceCommit, SOURCE_COMMIT);
  assert.equal(first.classification.value, "GEOMETRY_DEFECT");
  assert.equal(first.classification.geometryModificationAuthorized, true);
  assert.equal(first.geometryModificationAuthorized, true);
  assert.equal(first.classification.expectedVsActual.length, 2);
  assert.ok(first.classification.authoritativeRuleIds.includes(
    CROWN_DETAIL_QA_RULE_IDS.unexpectedSolidIntersection
  ));
  assert.ok(first.classification.evidence.every((entry) => entry.includes("0.00004363363 m^3")));
  assert.equal((await validateCrownDiagnosticReport(firstInputs, first)).valid, true);
});

test("the report records the exact canonical Small Crown selection, profile, identities, and dimensions", async () => {
  const report = await createCrownDiagnosticReport(await getInputs());

  assert.deepEqual(report.crown.selection, {
    projectOptionId: "small-crown",
    canonicalProfileKey: "slim_cap",
    profileId: "slim_beveled_cap",
    topTreatmentId: "installation-main-top-treatment"
  });
  assert.deepEqual(report.crown.authoritativeSources.map((source) => source.sourceId), [
    "tests/fixtures/blender-prototype/TV01-clear-wall-foundation.json#project.topTreatment",
    "guided-product-adapter.js#TOP_TREATMENT_PROFILE_BY_SELECTION.small-crown",
    CROWN_DETAIL_QA_RULE_IDS.crownProfile,
    CROWN_DETAIL_QA_RULE_IDS.crownProfileCatalog,
    CROWN_DETAIL_QA_RULE_IDS.exposedEndReturns,
    CROWN_DETAIL_QA_RULE_IDS.unexpectedSolidIntersection,
    CROWN_DETAIL_QA_RULE_IDS.fittedFillerVolume
  ]);
  assert.equal(report.crown.profile.kind, "crown_profile_extrusion");
  assert.equal(report.crown.profile.contour, "beveled_cap");
  assert.equal(report.crown.profile.normalizedCrossSectionArea, 0.6455);
  assert.deepEqual(report.crown.profile.outline, [
    { height: 0, projection: 0 },
    { height: 1, projection: 0 },
    { height: 1, projection: 1 },
    { height: 0.82, projection: 0.9 },
    { height: 0.4, projection: 0.55 },
    { height: 0, projection: 0.3 }
  ]);
  assert.deepEqual(report.crown.identities.map((identity) => identity.componentId), [
    "guided-installation-main/crown-slim-cap",
    "guided-installation-main/crown-slim-cap-left-return",
    "guided-installation-main/crown-slim-cap-right-return"
  ]);
  assert.deepEqual(report.crown.identities.map((identity) => identity.hostId), [
    "guided-installation-main/top-panel",
    "guided-installation-main/left-side-panel",
    "guided-installation-main/right-side-panel"
  ]);
  assert.ok(report.crown.identities.every((identity) => (
    identity.primitiveKind === "crown_profile_extrusion"
    && identity.submeshId === "profile-extrusion"
    && identity.objectName === `${identity.componentId}::profile-extrusion`
  )));
  assert.equal(report.crown.measurements.crownHeightIn, 1.2);
  assert.equal(report.crown.measurements.forwardProjectionIn, 0.375);
  assert.equal(report.crown.measurements.physicalDepthIn, 14.125);
  assert.deepEqual(report.crown.measurements.frontRun, {
    widthIn: 117.5,
    heightIn: 1.2,
    projectionIn: 0.375,
    sourceWorldBounds: {
      min: { x: -58.75, y: 94.8, z: -14.375 },
      max: { x: 58.75, y: 96, z: -14 }
    },
    blenderWorldBounds: {
      min: { x: -1.49225, y: 0.3556, z: 2.40792 },
      max: { x: 1.49225, y: 0.365125, z: 2.4384 }
    }
  });
  assert.deepEqual(
    {
      widthIn: report.crown.measurements.leftReturn.widthIn,
      heightIn: report.crown.measurements.leftReturn.heightIn,
      runDepthIn: report.crown.measurements.leftReturn.runDepthIn
    },
    { widthIn: 0.25, heightIn: 1.2, runDepthIn: 13.75 }
  );
  assert.deepEqual(
    {
      widthIn: report.crown.measurements.rightReturn.widthIn,
      heightIn: report.crown.measurements.rightReturn.heightIn,
      runDepthIn: report.crown.measurements.rightReturn.runDepthIn
    },
    { widthIn: 0.25, heightIn: 1.2, runDepthIn: 13.75 }
  );
  assert.deepEqual(report.crown.joinConstruction, {
    authored: false,
    kind: null,
    evidence: "The verified descriptors author separate front and return extrusions but no miter or corner-join primitive."
  });
});

test("the report proves symmetry, contacts, envelope containment, collisions, and package-to-Blender parity", async () => {
  const report = await createCrownDiagnosticReport(await getInputs());

  assert.deepEqual(report.checks.symmetry, {
    valid: true,
    centerPlaneXIn: 0,
    leftBounds: {
      min: { x: -58.75, y: 94.8, z: -14 },
      max: { x: -58.5, y: 96, z: -0.25 }
    },
    rightBounds: {
      min: { x: 58.5, y: 94.8, z: -14 },
      max: { x: 58.75, y: 96, z: -0.25 }
    },
    mirroredBounds: true,
    mirroredProfile: true
  });
  assert.equal(report.checks.fittedEnvelope.valid, true);
  assert.deepEqual(report.checks.fittedEnvelope.envelopeSourceWorldBounds, {
    min: { x: -60, y: 0, z: -14.375 },
    max: { x: 60, y: 96, z: 0 }
  });
  assert.equal(report.checks.caseworkContact.valid, true);
  assert.deepEqual(report.checks.caseworkContact.attachments.map((entry) => entry.gapIn), [0, 0, 0]);
  assert.equal(report.checks.ceilingContact.valid, true);
  assert.equal(report.checks.ceilingContact.gapIn, 0);
  assert.equal(report.checks.collisions.valid, false);
  assert.equal(report.checks.collisions.violationCount, 2);
  assert.deepEqual(
    report.checks.collisions.findings.map((finding) => finding.actual.overlapVolumeM3),
    [0.00004363363, 0.00004363363]
  );
  assert.equal(report.checks.packageToBlenderParity.valid, true);
  assert.equal(report.checks.packageToBlenderParity.allObjectScalesApplied, true);
  assert.equal(report.checks.packageToBlenderParity.allObjectTransformsIdentity, true);
  assert.deepEqual(
    report.checks.packageToBlenderParity.objects.map((object) => object.maximumAbsoluteBoundsDeltaM),
    [0, 0, 0]
  );
});

test("the diagnostic preserves the primary camera, package key, and beauty while recording an independent QA capture", async () => {
  const inputs = await getInputs();
  const report = await createCrownDiagnosticReport(inputs);

  assert.equal(report.primary.renderKey, inputs.renderPackage.renderKey);
  assert.equal(report.primary.geometryFingerprint, inputs.renderPackage.identity.geometryFingerprint);
  assert.deepEqual(report.primary.camera, inputs.renderPackage.camera);
  assert.deepEqual(report.primary.beauty, PRIMARY_BEAUTY);
  assert.deepEqual(report.primary.preservation, {
    packageCameraUnchanged: true,
    packageRenderKeyUnchanged: true,
    primaryBeautyUnchanged: true,
    diagnosticCaptureOutsideProductGraph: true
  });
  assert.equal(report.qaCapture.captureId, "crown-detail-qa-v1");
  assert.equal(report.qaCapture.captureKey, inputs.capture.captureKey);
  assert.match(report.qaCapture.captureSha256, /^[a-f0-9]{64}$/);
  assert.notEqual(report.qaCapture.captureKey, report.primary.renderKey);
  assert.deepEqual(report.qaCapture.camera, inputs.capture.camera);
  assert.equal(report.checks.cameraReadability.absoluteProjectionAxisAlignmentWithView, 1);
  assert.equal(report.checks.cameraReadability.projectionVisuallyCompressedByPrimaryCamera, true);
  assert.equal(report.checks.cameraReadability.primaryCameraReplaced, false);
  assert.deepEqual(report.outputs.primaryBeauty, PRIMARY_BEAUTY);
  assert.deepEqual(report.outputs.crownDetail, report.qaCapture.output);
  assert.deepEqual(report.sceneCounts, {
    componentCount: 46,
    submeshObjectCount: 80,
    crownObjectCount: 3,
    constraintCount: 7,
    collectionCount: 4,
    primaryCameraCount: 1,
    cameraCountDuringCapture: 2
  });
});

test("the builder and validator fail closed on unknown, inconsistent, or mutated evidence", async (t) => {
  await t.test("unknown input key", async () => {
    const inputs = await getInputs();
    inputs.preference = "looks shallow";
    await assert.rejects(
      createCrownDiagnosticReport(inputs),
      (error) => error instanceof CrownDiagnosticReportError
        && error.code === "INVALID_CROWN_DIAGNOSTIC_INPUT"
    );
  });

  await t.test("primary beauty mutation", async () => {
    const inputs = await getInputs();
    inputs.workerReport.primaryBeauty.after.sha256 = "0".repeat(64);
    await assert.rejects(
      createCrownDiagnosticReport(inputs),
      (error) => error instanceof CrownDiagnosticReportError
        && error.code === "CROWN_DIAGNOSTIC_PRIMARY_BEAUTY_CHANGED"
    );
  });

  await t.test("unknown worker field", async () => {
    const inputs = await getInputs();
    inputs.workerReport.subjectiveApproval = true;
    await assert.rejects(
      createCrownDiagnosticReport(inputs),
      (error) => error instanceof CrownDiagnosticReportError
        && error.code === "INVALID_CROWN_DIAGNOSTIC_WORKER_REPORT"
    );
  });

  await t.test("Blender bounds mismatch", async () => {
    const inputs = await getInputs();
    inputs.workerReport.crownObjects[0].blenderMeshBounds.min.y += 0.01;
    inputs.workerReport.crownObjects[0].maximumAbsoluteBoundsDeltaM = 0.01;
    await assert.rejects(
      createCrownDiagnosticReport(inputs),
      (error) => error instanceof CrownDiagnosticReportError
        && error.code === "CROWN_DIAGNOSTIC_BLENDER_BOUNDS_MISMATCH"
    );
  });

  await t.test("unapplied Blender scale", async () => {
    const inputs = await getInputs();
    inputs.workerReport.crownObjects[0].transform.scale = [1, 1, 0.5];
    await assert.rejects(
      createCrownDiagnosticReport(inputs),
      (error) => error instanceof CrownDiagnosticReportError
        && error.code === "CROWN_DIAGNOSTIC_UNAPPLIED_TRANSFORM"
    );
  });

  await t.test("detail pixel mismatch", async () => {
    const inputs = await getInputs();
    inputs.detailBytes[20] = 1;
    await assert.rejects(
      createCrownDiagnosticReport(inputs),
      (error) => error instanceof CrownDiagnosticReportError
        && error.code === "CROWN_DIAGNOSTIC_DETAIL_INTEGRITY_MISMATCH"
    );
  });

  await t.test("report cannot revoke authorization for a proven defect", async () => {
    const inputs = await getInputs();
    const report = await createCrownDiagnosticReport(inputs);
    const candidate = structuredClone(report);
    candidate.geometryModificationAuthorized = false;
    const validation = await validateCrownDiagnosticReport(inputs, candidate);
    assert.equal(validation.valid, false);
    assert.ok(validation.errors.some((error) => error.code === "CROWN_DIAGNOSTIC_REPORT_MISMATCH"));
  });

  await t.test("unknown report field", async () => {
    const inputs = await getInputs();
    const report = await createCrownDiagnosticReport(inputs);
    const candidate = structuredClone(report);
    candidate.visualPreference = "larger";
    const validation = await validateCrownDiagnosticReport(inputs, candidate);
    assert.equal(validation.valid, false);
    assert.ok(validation.errors.some((error) => error.code === "CROWN_DIAGNOSTIC_REPORT_MISMATCH"));
  });
});

async function createInputs() {
  const { renderPackage } = await createVerifiedClayRenderPackage();
  const capture = await createCrownDetailQaCapture(renderPackage);
  const detailBytes = createVp8xWebp(960, 640);
  const primaryResult = {
    kind: "jq-guided-blender-render-result",
    schemaVersion: 1,
    renderKey: renderPackage.renderKey,
    pipelineVersion: renderPackage.pipelineVersion,
    status: "succeeded",
    outputs: [structuredClone(PRIMARY_BEAUTY)]
  };
  const output = {
    filename: "crown-detail.webp",
    logicalObjectKey: `${capture.captureKey}/crown-detail.webp`,
    mimeType: "image/webp",
    width: 960,
    height: 640,
    bytes: detailBytes.length,
    sha256: createHash("sha256").update(detailBytes).digest("hex")
  };
  const componentObjectNames = renderPackage.components.flatMap((component) => (
    component.submeshes.map((submesh) => `${component.componentId}::${submesh.submeshId}`)
  ));
  const constraintObjectNames = renderPackage.constraints.map((constraint) => (
    `${constraint.constraintId}::${constraint.kind}`
  ));
  const roomObjectNames = ["room-floor", "room-rear-wall"];
  const primaryDigest = { bytes: PRIMARY_BEAUTY.bytes, sha256: PRIMARY_BEAUTY.sha256 };
  const componentById = new Map(renderPackage.components.map((component) => [component.componentId, component]));
  const crownObjects = capture.target.submeshObjectNames.map((objectName) => {
    const [componentId, submeshId] = objectName.split("::");
    const component = componentById.get(componentId);
    const bounds = normalizeBounds(component.submeshes[0].blenderWorldBounds);
    return {
      componentId,
      submeshId,
      objectName,
      packageBounds: bounds,
      blenderMeshBounds: structuredClone(bounds),
      maximumAbsoluteBoundsDeltaM: 0,
      boundsToleranceM: 0.000001,
      withinTolerance: true,
      transform: {
        location: [0, 0, 0],
        rotationEuler: [0, 0, 0],
        scale: [1, 1, 1]
      }
    };
  });
  const sceneObjectNames = [
    "JQ_HERO_CAMERA",
    ...componentObjectNames,
    ...constraintObjectNames,
    ...roomObjectNames
  ].sort();
  const workerReport = {
    kind: "jq-local-blender-crown-qa-worker-report",
    schemaVersion: 1,
    status: "succeeded",
    blenderVersion: "5.2.0 LTS",
    primaryRenderKey: renderPackage.renderKey,
    pipelineVersion: renderPackage.pipelineVersion,
    captureKey: capture.captureKey,
    captureCamera: {
      ...structuredClone(capture.camera),
      objectName: capture.camera.cameraId
    },
    crownObjects,
    scene: {
      componentCount: renderPackage.components.length,
      submeshObjectCount: componentObjectNames.length,
      constraintCount: renderPackage.constraints.length,
      collectionCount: 4,
      cameraCountDuringCapture: 2,
      componentObjectNames,
      roomObjectNames,
      constraintObjectNames,
      sceneObjectNames
    },
    primaryBeauty: {
      before: structuredClone(primaryDigest),
      after: structuredClone(primaryDigest),
      unchanged: true
    },
    output,
    cleanup: {
      heroCameraRestored: true,
      temporaryCameraRemoved: true,
      renderFilepathRestored: true,
      sceneObjectSetRestored: true
    }
  };
  return {
    sourceCommit: SOURCE_COMMIT,
    renderPackage,
    capture,
    workerReport,
    primaryResult,
    detailBytes
  };
}

function normalizeBounds(bounds) {
  return {
    min: Object.fromEntries(Object.entries(bounds.min).map(([axis, value]) => [axis, round(value)])),
    max: Object.fromEntries(Object.entries(bounds.max).map(([axis, value]) => [axis, round(value)]))
  };
}

function round(value) {
  const result = Math.round(value * 1e12) / 1e12;
  return Object.is(result, -0) ? 0 : result;
}

function createVp8xWebp(width, height) {
  const bytes = Buffer.alloc(30);
  bytes.write("RIFF", 0, "ascii");
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write("WEBP", 8, "ascii");
  bytes.write("VP8X", 12, "ascii");
  bytes.writeUInt32LE(10, 16);
  bytes.writeUIntLE(width - 1, 24, 3);
  bytes.writeUIntLE(height - 1, 27, 3);
  return bytes;
}
