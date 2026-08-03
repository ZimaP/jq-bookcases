import { createHash } from "node:crypto";

import {
  validateGuidedBlenderRenderPackage,
  validateGuidedBlenderRenderResult
} from "../../guided-blender-render-contract.js";
import {
  CROWN_DETAIL_QA_CAPTURE_ID,
  CROWN_DETAIL_QA_RULE_IDS,
  classifyCrownGeometry,
  readWebpDimensions,
  validateCrownDetailQaCapture
} from "./crown-qa-contract.mjs";

export const CROWN_DIAGNOSTIC_SCHEMA_VERSION = 1;
export const CROWN_DIAGNOSTIC_VERSION = "small-crown-geometry-audit-v1";
export const CROWN_DIAGNOSTIC_KIND = "jq-local-small-crown-geometry-diagnostic";

const AXES = Object.freeze(["x", "y", "z"]);
const BLENDER_BOUNDS_TOLERANCE_M = 1e-6;
const EXPECTED_CROWN_IDS = Object.freeze([
  "guided-installation-main/crown-slim-cap",
  "guided-installation-main/crown-slim-cap-left-return",
  "guided-installation-main/crown-slim-cap-right-return"
]);
const EXPECTED_FILLER_IDS = Object.freeze([
  "guided-installation-main/installation-treatment-left-filler",
  "guided-installation-main/installation-treatment-right-filler"
]);
const AUTHORITATIVE_SOURCES = deepFreeze([
  {
    sourceId: "tests/fixtures/blender-prototype/TV01-clear-wall-foundation.json#project.topTreatment",
    kind: "accepted-project-selection",
    expected: "small-crown"
  },
  {
    sourceId: "guided-product-adapter.js#TOP_TREATMENT_PROFILE_BY_SELECTION.small-crown",
    kind: "selection-to-canonical-profile-map",
    expected: "slim_cap"
  },
  {
    sourceId: CROWN_DETAIL_QA_RULE_IDS.crownProfile,
    kind: "canonical-dimensional-rule",
    expected: "slim_cap"
  },
  {
    sourceId: CROWN_DETAIL_QA_RULE_IDS.crownProfileCatalog,
    kind: "canonical-profile-geometry",
    expected: "slim_beveled_cap"
  },
  {
    sourceId: CROWN_DETAIL_QA_RULE_IDS.exposedEndReturns,
    kind: "canonical-return-construction-rule",
    expected: "returns-only-at-exposed-ends"
  },
  {
    sourceId: CROWN_DETAIL_QA_RULE_IDS.unexpectedSolidIntersection,
    kind: "canonical-collision-invariant",
    expected: "no-positive-volume-component-overlap"
  },
  {
    sourceId: CROWN_DETAIL_QA_RULE_IDS.fittedFillerVolume,
    kind: "fitted-treatment-source",
    expected: "accepted-primary-fillers-are-solid-components"
  }
]);

const INPUT_KEYS = Object.freeze([
  "sourceCommit",
  "renderPackage",
  "capture",
  "workerReport",
  "primaryResult",
  "detailBytes"
]);

export class CrownDiagnosticReportError extends Error {
  constructor(code, message, details = []) {
    super(message);
    this.name = "CrownDiagnosticReportError";
    this.code = code;
    this.details = clone(details);
  }
}

/** The decision gate is deliberately closed for every non-defect outcome. */
export function isCrownGeometryModificationAuthorized(classification) {
  const supported = new Set([
    "PASS",
    "CAMERA_READABILITY_ONLY",
    "GEOMETRY_DEFECT",
    "INDETERMINATE"
  ]);
  if (!supported.has(classification)) {
    fail(
      "UNSUPPORTED_CROWN_DIAGNOSTIC_CLASSIFICATION",
      `Unsupported crown diagnostic classification ${String(classification)}.`
    );
  }
  return classification === "GEOMETRY_DEFECT";
}

/**
 * Build the complete deterministic Small Crown audit from verified package,
 * capture, Blender measurements, primary result, and actual detail pixels.
 */
export async function createCrownDiagnosticReport(inputs) {
  assertExactKeys(inputs, INPUT_KEYS, "INVALID_CROWN_DIAGNOSTIC_INPUT", "Diagnostic inputs");
  const {
    sourceCommit,
    renderPackage,
    capture,
    workerReport,
    primaryResult,
    detailBytes
  } = inputs;

  if (!/^[a-f0-9]{40}$/.test(String(sourceCommit || ""))) {
    fail("INVALID_CROWN_DIAGNOSTIC_SOURCE_COMMIT", "sourceCommit must be an exact lowercase Git commit SHA.");
  }

  const packageValidation = await validateGuidedBlenderRenderPackage(renderPackage);
  if (!packageValidation.valid) {
    fail(
      "INVALID_CROWN_DIAGNOSTIC_PACKAGE",
      "The crown diagnostic requires a verified Blender package.",
      packageValidation.errors
    );
  }
  assertSupportedPackage(renderPackage);

  const captureValidation = await validateCrownDetailQaCapture(renderPackage, capture);
  if (!captureValidation.valid) {
    fail(
      "INVALID_CROWN_DIAGNOSTIC_CAPTURE",
      "The crown diagnostic requires the exact package-derived QA capture.",
      captureValidation.errors
    );
  }

  const primaryValidation = await validateGuidedBlenderRenderResult(renderPackage, primaryResult);
  if (!primaryValidation.valid) {
    fail(
      "INVALID_CROWN_DIAGNOSTIC_PRIMARY_RESULT",
      "The primary worker result does not validate against the package.",
      primaryValidation.errors
    );
  }

  const primaryBeauty = resolvePrimaryBeauty(renderPackage, primaryResult);
  const detailOutput = verifyWorkerReport(
    renderPackage,
    capture,
    workerReport,
    primaryBeauty,
    detailBytes
  );
  const components = resolveAuditComponents(renderPackage);
  const classificationSource = await classifyCrownGeometry(renderPackage);
  const classification = normalizeClassification(classificationSource, renderPackage.camera);
  const crown = createCrownRecord(renderPackage, components);
  const checks = createChecks(
    renderPackage,
    capture,
    workerReport,
    components,
    classificationSource,
    crown
  );
  const authorized = isCrownGeometryModificationAuthorized(classification.value);

  return deepFreeze({
    kind: CROWN_DIAGNOSTIC_KIND,
    schemaVersion: CROWN_DIAGNOSTIC_SCHEMA_VERSION,
    diagnosticVersion: CROWN_DIAGNOSTIC_VERSION,
    status: "completed",
    sourceCommit,
    source: {
      packageKind: renderPackage.kind,
      packageSchemaVersion: renderPackage.schemaVersion,
      packageContractVersion: renderPackage.contractVersion,
      primitiveContractVersion: renderPackage.primitiveContractVersion,
      productId: renderPackage.identity.productId,
      layoutId: renderPackage.identity.layoutId,
      installationMode: renderPackage.identity.installationMode,
      sourceUnits: renderPackage.sourceUnits,
      targetUnits: renderPackage.targetUnits
    },
    primary: {
      requestKey: renderPackage.requestKey,
      renderKey: renderPackage.renderKey,
      pipelineVersion: renderPackage.pipelineVersion,
      geometryFingerprint: renderPackage.identity.geometryFingerprint,
      camera: clone(renderPackage.camera),
      renderSettings: clone(renderPackage.render),
      beauty: primaryBeauty,
      preservation: {
        packageCameraUnchanged: true,
        packageRenderKeyUnchanged: capture.primaryRenderKey === renderPackage.renderKey,
        primaryBeautyUnchanged: workerReport.primaryBeauty.unchanged,
        diagnosticCaptureOutsideProductGraph: true
      }
    },
    crown,
    checks,
    classification: {
      value: classification.value,
      decisionGate: classification.decisionGate,
      evidence: classification.evidence,
      expectedVsActual: clone(classificationSource.findings),
      authoritativeRuleIds: clone(classificationSource.authoritativeRuleIds),
      geometryModificationAuthorized: authorized
    },
    qaCapture: {
      captureId: capture.captureId,
      captureKey: capture.captureKey,
      captureSha256: capture.captureKey.slice(capture.captureKey.lastIndexOf("-") + 1),
      camera: clone(capture.camera),
      target: clone(capture.target),
      inheritedRenderSettings: clone(capture.render.sourceRenderSettings),
      output: detailOutput
    },
    outputs: {
      primaryBeauty,
      crownDetail: detailOutput
    },
    sceneCounts: {
      componentCount: workerReport.scene.componentCount,
      submeshObjectCount: workerReport.scene.submeshObjectCount,
      crownObjectCount: workerReport.crownObjects.length,
      constraintCount: workerReport.scene.constraintCount,
      collectionCount: workerReport.scene.collectionCount,
      primaryCameraCount: 1,
      cameraCountDuringCapture: workerReport.scene.cameraCountDuringCapture
    },
    geometryModificationAuthorized: authorized
  });
}

/** Strictly validate a diagnostic by rebuilding it from its immutable inputs. */
export async function validateCrownDiagnosticReport(inputs, report) {
  const errors = [];
  try {
    const expected = await createCrownDiagnosticReport(inputs);
    if (stableStringify(report) !== stableStringify(expected)) {
      errors.push(issue(
        "CROWN_DIAGNOSTIC_REPORT_MISMATCH",
        "crown-diagnostic.json does not match its verified package, capture, Blender measurements, and pixels."
      ));
    }
  } catch (error) {
    errors.push(issue(
      error?.code || "INVALID_CROWN_DIAGNOSTIC_REPORT",
      error?.message || "The crown diagnostic report is invalid."
    ));
  }
  return deepFreeze({
    valid: errors.length === 0,
    schemaVersion: CROWN_DIAGNOSTIC_SCHEMA_VERSION,
    errors
  });
}

function assertSupportedPackage(renderPackage) {
  if (
    renderPackage.identity.productId !== "tv-unit"
    || renderPackage.identity.layoutId !== "clear-wall"
    || renderPackage.identity.installationMode !== "fitted"
    || renderPackage.installation?.treatments?.top?.selection !== "small-crown"
    || renderPackage.room?.ceilingHeightIn !== 96
    || renderPackage.room?.floorPlaneYIn !== 0
  ) {
    fail(
      "UNSUPPORTED_CROWN_DIAGNOSTIC_SLICE",
      "This diagnostic supports only the accepted fitted TV Unit + Clear Wall + Small Crown slice."
    );
  }
}

function resolvePrimaryBeauty(renderPackage, primaryResult) {
  assertExactKeys(
    primaryResult,
    ["kind", "schemaVersion", "renderKey", "pipelineVersion", "status", "outputs"],
    "INVALID_CROWN_DIAGNOSTIC_PRIMARY_RESULT",
    "Primary result"
  );
  const outputs = primaryResult.outputs.filter((output) => output?.pass === "beauty");
  if (outputs.length !== 1) {
    fail("INVALID_CROWN_DIAGNOSTIC_PRIMARY_BEAUTY", "The primary result must contain exactly one beauty output.");
  }
  const beauty = outputs[0];
  assertExactKeys(
    beauty,
    ["pass", "objectKey", "mimeType", "width", "height", "bytes", "sha256"],
    "INVALID_CROWN_DIAGNOSTIC_PRIMARY_BEAUTY",
    "Primary beauty"
  );
  if (
    beauty.pass !== "beauty"
    || beauty.objectKey !== `${renderPackage.renderKey}/beauty.webp`
    || beauty.mimeType !== "image/webp"
    || beauty.width !== renderPackage.render.width
    || beauty.height !== renderPackage.render.height
    || !Number.isSafeInteger(beauty.bytes)
    || beauty.bytes <= 0
    || !isSha256(beauty.sha256)
  ) {
    fail("INVALID_CROWN_DIAGNOSTIC_PRIMARY_BEAUTY", "The primary beauty record violates its package contract.");
  }
  return clone(beauty);
}

function verifyWorkerReport(renderPackage, capture, report, primaryBeauty, detailBytes) {
  assertExactKeys(report, [
    "kind",
    "schemaVersion",
    "status",
    "blenderVersion",
    "primaryRenderKey",
    "pipelineVersion",
    "captureKey",
    "captureCamera",
    "crownObjects",
    "scene",
    "primaryBeauty",
    "output",
    "cleanup"
  ], "INVALID_CROWN_DIAGNOSTIC_WORKER_REPORT", "Blender crown worker report");
  if (
    report.kind !== "jq-local-blender-crown-qa-worker-report"
    || report.schemaVersion !== 1
    || report.status !== "succeeded"
    || !/^5\.2(?:\.|$)/.test(String(report.blenderVersion || ""))
    || report.primaryRenderKey !== renderPackage.renderKey
    || report.pipelineVersion !== renderPackage.pipelineVersion
    || report.captureKey !== capture.captureKey
  ) {
    fail("CROWN_DIAGNOSTIC_WORKER_IDENTITY_MISMATCH", "The Blender crown worker identity does not match the package and capture.");
  }

  const expectedCamera = { ...clone(capture.camera), objectName: capture.camera.cameraId };
  if (stableStringify(report.captureCamera) !== stableStringify(expectedCamera)) {
    fail("CROWN_DIAGNOSTIC_CAMERA_PARITY_MISMATCH", "The Blender QA camera differs from the renderer-neutral capture.");
  }

  verifyWorkerScene(renderPackage, report.scene);
  verifyWorkerCrownObjects(renderPackage, capture, report.crownObjects);
  assertExactKeys(
    report.primaryBeauty,
    ["before", "after", "unchanged"],
    "INVALID_CROWN_DIAGNOSTIC_PRIMARY_PRESERVATION",
    "Worker primary-beauty preservation"
  );
  const expectedPrimaryDigest = { bytes: primaryBeauty.bytes, sha256: primaryBeauty.sha256 };
  if (
    report.primaryBeauty.unchanged !== true
    || stableStringify(report.primaryBeauty.before) !== stableStringify(expectedPrimaryDigest)
    || stableStringify(report.primaryBeauty.after) !== stableStringify(expectedPrimaryDigest)
  ) {
    fail("CROWN_DIAGNOSTIC_PRIMARY_BEAUTY_CHANGED", "The diagnostic run did not preserve beauty.webp byte-for-byte.");
  }

  assertExactKeys(
    report.cleanup,
    ["heroCameraRestored", "temporaryCameraRemoved", "renderFilepathRestored", "sceneObjectSetRestored"],
    "INVALID_CROWN_DIAGNOSTIC_CLEANUP",
    "Worker cleanup"
  );
  if (Object.values(report.cleanup).some((value) => value !== true)) {
    fail("CROWN_DIAGNOSTIC_CLEANUP_FAILED", "The diagnostic camera or render state was not fully removed after capture.");
  }

  assertExactKeys(
    report.output,
    ["filename", "logicalObjectKey", "mimeType", "width", "height", "bytes", "sha256"],
    "INVALID_CROWN_DIAGNOSTIC_DETAIL_OUTPUT",
    "Worker crown-detail output"
  );
  const bytes = normalizeBytes(detailBytes);
  const dimensions = readWebpDimensions(bytes);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (
    report.output.filename !== "crown-detail.webp"
    || report.output.logicalObjectKey !== `${capture.captureKey}/crown-detail.webp`
    || report.output.mimeType !== "image/webp"
    || report.output.width !== capture.camera.resolution.width
    || report.output.height !== capture.camera.resolution.height
    || report.output.width !== dimensions.width
    || report.output.height !== dimensions.height
    || report.output.bytes !== bytes.length
    || report.output.sha256 !== sha256
  ) {
    fail("CROWN_DIAGNOSTIC_DETAIL_INTEGRITY_MISMATCH", "crown-detail.webp does not match the Blender worker report and capture.");
  }
  return deepFreeze({
    objectKey: report.output.logicalObjectKey,
    filename: report.output.filename,
    mimeType: report.output.mimeType,
    width: report.output.width,
    height: report.output.height,
    bytes: report.output.bytes,
    sha256: report.output.sha256
  });
}

function verifyWorkerScene(renderPackage, scene) {
  assertExactKeys(scene, [
    "componentCount",
    "submeshObjectCount",
    "constraintCount",
    "collectionCount",
    "cameraCountDuringCapture",
    "componentObjectNames",
    "roomObjectNames",
    "constraintObjectNames",
    "sceneObjectNames"
  ], "INVALID_CROWN_DIAGNOSTIC_SCENE", "Worker scene record");
  const componentNames = renderPackage.components.flatMap((component) => (
    component.submeshes.map((submesh) => `${component.componentId}::${submesh.submeshId}`)
  ));
  const constraintNames = renderPackage.constraints.map((constraint) => (
    `${constraint.constraintId}::${constraint.kind}`
  ));
  const roomNames = ["room-floor", "room-rear-wall"];
  const sceneNames = ["JQ_HERO_CAMERA", ...componentNames, ...constraintNames, ...roomNames].sort();
  if (
    scene.componentCount !== renderPackage.components.length
    || scene.submeshObjectCount !== componentNames.length
    || scene.constraintCount !== renderPackage.constraints.length
    || scene.collectionCount !== 4
    || scene.cameraCountDuringCapture !== 2
    || stableStringify(scene.componentObjectNames) !== stableStringify(componentNames)
    || stableStringify(scene.roomObjectNames) !== stableStringify(roomNames)
    || stableStringify(scene.constraintObjectNames) !== stableStringify(constraintNames)
    || stableStringify(scene.sceneObjectNames) !== stableStringify(sceneNames)
  ) {
    fail("CROWN_DIAGNOSTIC_SCENE_PARITY_MISMATCH", "The Blender scene object set differs from the verified package.");
  }
}

function verifyWorkerCrownObjects(renderPackage, capture, crownObjects) {
  if (!Array.isArray(crownObjects) || crownObjects.length !== capture.target.submeshObjectNames.length) {
    fail("INVALID_CROWN_DIAGNOSTIC_CROWN_OBJECTS", "The Blender report must measure every capture crown object exactly once.");
  }
  const componentById = new Map(renderPackage.components.map((component) => [component.componentId, component]));
  const seen = new Set();
  for (let index = 0; index < crownObjects.length; index += 1) {
    const measurement = crownObjects[index];
    assertExactKeys(measurement, [
      "componentId",
      "submeshId",
      "objectName",
      "packageBounds",
      "blenderMeshBounds",
      "maximumAbsoluteBoundsDeltaM",
      "boundsToleranceM",
      "withinTolerance",
      "transform"
    ], "INVALID_CROWN_DIAGNOSTIC_CROWN_OBJECT", `Blender crown object ${index}`);
    if (seen.has(measurement.objectName)) {
      fail("DUPLICATE_CROWN_DIAGNOSTIC_OBJECT", `Blender repeated ${measurement.objectName}.`);
    }
    seen.add(measurement.objectName);
    const expectedName = capture.target.submeshObjectNames[index];
    const component = componentById.get(measurement.componentId);
    const expectedBounds = normalizeBounds(component?.submeshes?.[0]?.blenderWorldBounds, "package crown bounds");
    const reportedPackageBounds = normalizeBounds(measurement.packageBounds, "reported package crown bounds");
    const blenderBounds = normalizeBounds(measurement.blenderMeshBounds, "Blender crown bounds");
    const actualDelta = maximumBoundsDelta(expectedBounds, blenderBounds);
    if (
      measurement.objectName !== expectedName
      || measurement.objectName !== `${measurement.componentId}::profile-extrusion`
      || measurement.submeshId !== "profile-extrusion"
      || !EXPECTED_CROWN_IDS.includes(measurement.componentId)
      || stableStringify(reportedPackageBounds) !== stableStringify(expectedBounds)
      || measurement.maximumAbsoluteBoundsDeltaM !== actualDelta
      || measurement.boundsToleranceM !== BLENDER_BOUNDS_TOLERANCE_M
      || measurement.withinTolerance !== true
      || actualDelta > BLENDER_BOUNDS_TOLERANCE_M
    ) {
      fail("CROWN_DIAGNOSTIC_BLENDER_BOUNDS_MISMATCH", `${measurement.objectName} does not match its verified package bounds.`);
    }
    assertExactKeys(
      measurement.transform,
      ["location", "rotationEuler", "scale"],
      "INVALID_CROWN_DIAGNOSTIC_TRANSFORM",
      `${measurement.objectName} transform`
    );
    assertFiniteVector(measurement.transform.location, `${measurement.objectName} location`);
    assertFiniteVector(measurement.transform.rotationEuler, `${measurement.objectName} rotation`);
    assertFiniteVector(measurement.transform.scale, `${measurement.objectName} scale`);
    if (
      stableStringify(measurement.transform.location) !== stableStringify([0, 0, 0])
      || stableStringify(measurement.transform.rotationEuler) !== stableStringify([0, 0, 0])
      || stableStringify(measurement.transform.scale) !== stableStringify([1, 1, 1])
    ) {
      fail("CROWN_DIAGNOSTIC_UNAPPLIED_TRANSFORM", `${measurement.objectName} must have an identity transform.`);
    }
  }
  if (stableStringify([...seen]) !== stableStringify(capture.target.submeshObjectNames)) {
    fail("CROWN_DIAGNOSTIC_BLENDER_OBJECT_SET_MISMATCH", "The Blender crown object names or order drifted.");
  }
}

function resolveAuditComponents(renderPackage) {
  const byId = new Map(renderPackage.components.map((component) => [component.componentId, component]));
  if (byId.size !== renderPackage.components.length) {
    fail("DUPLICATE_CROWN_DIAGNOSTIC_COMPONENT_ID", "The package contains duplicate component IDs.");
  }
  const values = {
    front: byId.get(EXPECTED_CROWN_IDS[0]),
    leftReturn: byId.get(EXPECTED_CROWN_IDS[1]),
    rightReturn: byId.get(EXPECTED_CROWN_IDS[2]),
    leftFiller: byId.get(EXPECTED_FILLER_IDS[0]),
    rightFiller: byId.get(EXPECTED_FILLER_IDS[1])
  };
  if (Object.values(values).some((component) => !component)) {
    fail("MISSING_CROWN_DIAGNOSTIC_COMPONENT", "The diagnostic package is missing a required crown or filler component.");
  }
  return values;
}

function createCrownRecord(renderPackage, components) {
  const crowns = [components.front, components.leftReturn, components.rightReturn];
  const profile = normalizeSharedProfile(crowns);
  const frontBounds = normalizeBounds(components.front.sourceWorldBounds, "front crown source bounds");
  const leftBounds = normalizeBounds(components.leftReturn.sourceWorldBounds, "left return source bounds");
  const rightBounds = normalizeBounds(components.rightReturn.sourceWorldBounds, "right return source bounds");
  const assemblyBounds = unionBounds([frontBounds, leftBounds, rightBounds]);
  const frontDimensions = boundsExtents(frontBounds);
  const leftDimensions = boundsExtents(leftBounds);
  const rightDimensions = boundsExtents(rightBounds);

  return {
    selection: {
      projectOptionId: renderPackage.installation.treatments.top.selection,
      canonicalProfileKey: "slim_cap",
      profileId: profile.profileId,
      topTreatmentId: renderPackage.installation.treatments.top.id
    },
    authoritativeSources: clone(AUTHORITATIVE_SOURCES),
    identities: crowns.map((component) => createCrownIdentity(component)),
    profile,
    measurements: {
      crownHeightIn: frontDimensions.y,
      forwardProjectionIn: frontDimensions.z,
      physicalDepthIn: boundsExtents(assemblyBounds).z,
      frontRun: {
        widthIn: frontDimensions.x,
        heightIn: frontDimensions.y,
        projectionIn: frontDimensions.z,
        sourceWorldBounds: frontBounds,
        blenderWorldBounds: normalizeBounds(components.front.blenderWorldBounds, "front crown Blender bounds")
      },
      leftReturn: {
        widthIn: leftDimensions.x,
        heightIn: leftDimensions.y,
        runDepthIn: leftDimensions.z,
        sourceWorldBounds: leftBounds,
        blenderWorldBounds: normalizeBounds(components.leftReturn.blenderWorldBounds, "left return Blender bounds")
      },
      rightReturn: {
        widthIn: rightDimensions.x,
        heightIn: rightDimensions.y,
        runDepthIn: rightDimensions.z,
        sourceWorldBounds: rightBounds,
        blenderWorldBounds: normalizeBounds(components.rightReturn.blenderWorldBounds, "right return Blender bounds")
      },
      assemblySourceWorldBounds: assemblyBounds,
      assemblyBlenderWorldBounds: unionBounds(crowns.map((component) => (
        normalizeBounds(component.blenderWorldBounds, `${component.componentId} Blender bounds`)
      )))
    },
    coordinates: {
      sourceUnits: renderPackage.sourceUnits,
      targetUnits: renderPackage.targetUnits,
      coordinateSystem: clone(renderPackage.coordinateSystem)
    },
    joinConstruction: {
      authored: false,
      kind: null,
      evidence: "The verified descriptors author separate front and return extrusions but no miter or corner-join primitive."
    }
  };
}

function createCrownIdentity(component) {
  const submesh = component.submeshes[0];
  return {
    descriptorId: component.componentId,
    descriptorSetId: component.descriptorSetId,
    componentId: component.componentId,
    hostId: component.hostId,
    parentId: component.parentId,
    installationId: component.installationId,
    primitiveKind: submesh.geometry,
    submeshId: submesh.submeshId,
    objectName: `${component.componentId}::${submesh.submeshId}`,
    sourceTransform: clone(component.sourceTransform),
    sourceWorldBounds: normalizeBounds(component.sourceWorldBounds, `${component.componentId} source bounds`),
    blenderWorldBounds: normalizeBounds(component.blenderWorldBounds, `${component.componentId} Blender bounds`)
  };
}

function normalizeSharedProfile(crowns) {
  const profiles = crowns.map((component) => component.submeshes?.[0]?.profileGeometry);
  if (profiles.some((profile) => !profile)) {
    fail("MISSING_CROWN_DIAGNOSTIC_PROFILE", "Every crown component must carry its authored profileGeometry.");
  }
  const shape = ({ extrusion, crossSection, ...profile }) => profile;
  const shared = shape(profiles[0]);
  for (const profile of profiles.slice(1)) {
    if (stableStringify(shape(profile)) !== stableStringify(shared)) {
      fail("CROWN_DIAGNOSTIC_PROFILE_DRIFT", "The front and returns do not share the same authored profile shape.");
    }
  }
  if (
    shared.kind !== "crown_profile_extrusion"
    || shared.profileId !== "slim_beveled_cap"
    || shared.contour !== "beveled_cap"
    || shared.outlineUnits !== "normalized"
  ) {
    fail("UNSUPPORTED_CROWN_DIAGNOSTIC_PROFILE", "The package crown profile is not the canonical slim beveled cap.");
  }
  const normalizedArea = polygonArea(shared.outline);
  return {
    schemaVersion: shared.schemaVersion,
    kind: shared.kind,
    profileId: shared.profileId,
    contour: shared.contour,
    outlineUnits: shared.outlineUnits,
    outline: clone(shared.outline),
    normalizedCrossSectionArea: normalizedArea,
    componentMappings: crowns.map((component, index) => ({
      componentId: component.componentId,
      crossSection: clone(profiles[index].crossSection),
      extrusion: clone(profiles[index].extrusion)
    }))
  };
}

function createChecks(renderPackage, capture, workerReport, components, classification, crown) {
  const symmetry = createSymmetryCheck(components);
  const envelope = createFittedEnvelopeCheck(renderPackage, crown.measurements);
  const contacts = createContactChecks(renderPackage, components);
  const parityObjects = workerReport.crownObjects.map((measurement) => ({
    componentId: measurement.componentId,
    submeshId: measurement.submeshId,
    objectName: measurement.objectName,
    packageBounds: clone(measurement.packageBounds),
    blenderMeshBounds: clone(measurement.blenderMeshBounds),
    maximumAbsoluteBoundsDeltaM: measurement.maximumAbsoluteBoundsDeltaM,
    boundsToleranceM: measurement.boundsToleranceM,
    withinTolerance: measurement.withinTolerance,
    transform: clone(measurement.transform)
  }));
  const view = normalizeVector(subtract(renderPackage.camera.target, renderPackage.camera.position));
  const projectionAxis = { x: 0, y: 1, z: 0 };
  const alignment = roundMetric(Math.abs(dot(view, projectionAxis)));

  return {
    frontAndReturns: {
      valid: true,
      componentIds: [...EXPECTED_CROWN_IDS],
      stablePrimitiveIds: crown.identities.map((identity) => ({
        componentId: identity.componentId,
        submeshId: identity.submeshId,
        objectName: identity.objectName
      }))
    },
    symmetry,
    fittedEnvelope: envelope,
    caseworkContact: contacts.casework,
    ceilingContact: contacts.ceiling,
    collisions: {
      valid: classification.findings.length === 0,
      violationCount: classification.findings.length,
      findings: clone(classification.findings)
    },
    packageToBlenderParity: {
      valid: parityObjects.every((object) => object.withinTolerance),
      toleranceM: BLENDER_BOUNDS_TOLERANCE_M,
      allObjectScalesApplied: parityObjects.every((object) => stableStringify(object.transform.scale) === "[1,1,1]"),
      allObjectTransformsIdentity: parityObjects.every((object) => (
        stableStringify(object.transform.location) === "[0,0,0]"
        && stableStringify(object.transform.rotationEuler) === "[0,0,0]"
        && stableStringify(object.transform.scale) === "[1,1,1]"
      )),
      objects: parityObjects
    },
    cameraReadability: {
      primaryCameraId: renderPackage.camera.cameraVersion,
      primaryViewDirection: roundPoint(view),
      crownProjectionAxisInBlender: "y",
      absoluteProjectionAxisAlignmentWithView: alignment,
      projectionVisuallyCompressedByPrimaryCamera: alignment >= 0.999999,
      qaCameraId: capture.camera.cameraId,
      primaryCameraReplaced: false
    }
  };
}

function createSymmetryCheck(components) {
  const left = normalizeBounds(components.leftReturn.sourceWorldBounds, "left symmetry bounds");
  const right = normalizeBounds(components.rightReturn.sourceWorldBounds, "right symmetry bounds");
  const leftProfile = components.leftReturn.submeshes[0].profileGeometry;
  const rightProfile = components.rightReturn.submeshes[0].profileGeometry;
  const mirroredBounds = (
    close(left.min.x, -right.max.x)
    && close(left.max.x, -right.min.x)
    && close(left.min.y, right.min.y)
    && close(left.max.y, right.max.y)
    && close(left.min.z, right.min.z)
    && close(left.max.z, right.max.z)
  );
  const mirroredProfile = (
    leftProfile.crossSection.projectionDirection === -rightProfile.crossSection.projectionDirection
    && close(leftProfile.crossSection.mountingPlane, -rightProfile.crossSection.mountingPlane)
    && stableStringify(leftProfile.outline) === stableStringify(rightProfile.outline)
    && stableStringify(leftProfile.extrusion) === stableStringify(rightProfile.extrusion)
  );
  return {
    valid: mirroredBounds && mirroredProfile,
    centerPlaneXIn: renderPackageCenterX(components),
    leftBounds: left,
    rightBounds: right,
    mirroredBounds,
    mirroredProfile
  };
}

function createFittedEnvelopeCheck(renderPackage, measurements) {
  const projection = measurements.forwardProjectionIn;
  const envelope = normalizeBounds({
    min: {
      x: renderPackage.room.planes.leftWall.value,
      y: renderPackage.room.planes.floor.value,
      z: renderPackage.installation.anchors.frontZ - projection
    },
    max: {
      x: renderPackage.room.planes.rightWall.value,
      y: renderPackage.room.planes.ceiling.value,
      z: renderPackage.room.planes.rearWall.value
    }
  }, "fitted crown envelope");
  return {
    valid: containsBounds(envelope, measurements.assemblySourceWorldBounds),
    envelopeSourceWorldBounds: envelope,
    crownSourceWorldBounds: clone(measurements.assemblySourceWorldBounds),
    forwardProjectionAllowanceIn: projection
  };
}

function createContactChecks(renderPackage, components) {
  const byId = new Map(renderPackage.components.map((component) => [component.componentId, component]));
  const crownComponents = [components.front, components.leftReturn, components.rightReturn];
  const casework = crownComponents.map((component) => {
    const attachment = component.metadata?.attachment;
    const host = byId.get(component.hostId);
    if (!attachment || !host || !AXES.includes(attachment.axis)) {
      fail("INVALID_CROWN_DIAGNOSTIC_ATTACHMENT", `${component.componentId} lacks a resolvable authored attachment.`);
    }
    const componentFace = faceValue(component.sourceWorldBounds, attachment.axis, attachment.componentFace);
    const hostFace = faceValue(host.sourceWorldBounds, attachment.axis, attachment.hostFace);
    const gapIn = roundMetric(Math.abs(componentFace - hostFace));
    return {
      componentId: component.componentId,
      hostId: component.hostId,
      attachment: clone(attachment),
      componentFacePositionIn: roundMetric(componentFace),
      hostFacePositionIn: roundMetric(hostFace),
      gapIn,
      contact: gapIn === 0
    };
  });
  const crownTopY = Math.max(...crownComponents.map((component) => component.sourceWorldBounds.max.y));
  const ceilingY = renderPackage.room.planes.ceiling.value;
  const ceilingGapIn = roundMetric(ceilingY - crownTopY);
  return {
    casework: {
      valid: casework.every((entry) => entry.contact),
      attachments: casework
    },
    ceiling: {
      valid: ceilingGapIn === 0,
      ceilingPlaneId: renderPackage.room.planes.ceiling.id,
      ceilingYIn: ceilingY,
      crownTopYIn: roundMetric(crownTopY),
      gapIn: ceilingGapIn,
      contact: ceilingGapIn === 0
    }
  };
}

function normalizeClassification(source, primaryCamera) {
  const supported = new Set(["GEOMETRY_DEFECT", "NO_GEOMETRY_DEFECT"]);
  if (!supported.has(source.classification)) {
    fail("UNSUPPORTED_CROWN_DIAGNOSTIC_CLASSIFICATION", `Unsupported source classification ${source.classification}.`);
  }
  if (source.classification === "GEOMETRY_DEFECT") {
    if (
      source.findings.length === 0
      || source.findings.some((finding) => (
        !finding.ruleId
        || finding.classification !== "GEOMETRY_DEFECT"
        || finding.expected?.overlapVolumeM3 !== 0
        || !(finding.actual?.overlapVolumeM3 > 0)
      ))
    ) {
      fail(
        "UNSUPPORTED_GEOMETRY_DEFECT_EVIDENCE",
        "GEOMETRY_DEFECT requires a named rule and an exact positive expected-versus-actual mismatch."
      );
    }
    return {
      value: "GEOMETRY_DEFECT",
      decisionGate: "A canonical no-positive-volume-overlap rule is violated by exact measured solid intersections.",
      evidence: source.findings.map((finding) => (
        `${finding.crownComponentId} overlaps ${finding.fillerComponentId} by ${finding.actual.overlapVolumeM3} m^3 under ${finding.ruleId}.`
      ))
    };
  }
  const direction = normalizeVector(subtract(primaryCamera.target, primaryCamera.position));
  const compressed = Math.abs(direction.y) >= 0.999999;
  return {
    value: compressed ? "CAMERA_READABILITY_ONLY" : "PASS",
    decisionGate: compressed
      ? "The verified physical geometry has no defect and the primary view looks directly along its projection axis."
      : "The verified physical geometry has no defect and is not projection-compressed by the primary camera.",
    evidence: [compressed
      ? "The customer-camera view direction is collinear with the Blender crown projection axis."
      : "The package, renderer-neutral primitives, and Blender measurements agree within tolerance."]
  };
}

function faceValue(bounds, axis, face) {
  if (face === "min" || face === "max") return bounds[face][axis];
  fail("INVALID_CROWN_DIAGNOSTIC_FACE", `Unsupported attachment face ${face}.`);
}

function renderPackageCenterX(components) {
  return roundMetric((components.leftReturn.sourceWorldBounds.min.x + components.rightReturn.sourceWorldBounds.max.x) / 2);
}

function unionBounds(boundsList) {
  return normalizeBounds({
    min: Object.fromEntries(AXES.map((axis) => [axis, Math.min(...boundsList.map((bounds) => bounds.min[axis]))])),
    max: Object.fromEntries(AXES.map((axis) => [axis, Math.max(...boundsList.map((bounds) => bounds.max[axis]))]))
  }, "crown union bounds");
}

function boundsExtents(bounds) {
  return Object.fromEntries(AXES.map((axis) => [axis, roundMetric(bounds.max[axis] - bounds.min[axis])]));
}

function containsBounds(outer, inner) {
  return AXES.every((axis) => outer.min[axis] <= inner.min[axis] && outer.max[axis] >= inner.max[axis]);
}

function maximumBoundsDelta(left, right) {
  return roundMetric(Math.max(...["min", "max"].flatMap((side) => (
    AXES.map((axis) => Math.abs(left[side][axis] - right[side][axis]))
  ))));
}

function normalizeBounds(value, label) {
  assertExactKeys(value, ["min", "max"], "INVALID_CROWN_DIAGNOSTIC_BOUNDS", label);
  assertPoint(value.min, `${label}.min`);
  assertPoint(value.max, `${label}.max`);
  if (AXES.some((axis) => value.max[axis] <= value.min[axis])) {
    fail("INVALID_CROWN_DIAGNOSTIC_BOUNDS", `${label} must be strictly ordered.`);
  }
  return {
    min: roundPoint(value.min),
    max: roundPoint(value.max)
  };
}

function polygonArea(outline) {
  if (!Array.isArray(outline) || outline.length < 3) {
    fail("INVALID_CROWN_DIAGNOSTIC_PROFILE", "The crown outline requires at least three points.");
  }
  const doubled = outline.reduce((total, point, index) => {
    const next = outline[(index + 1) % outline.length];
    if (
      !point
      || !next
      || !Number.isFinite(point.projection)
      || !Number.isFinite(point.height)
      || !Number.isFinite(next.projection)
      || !Number.isFinite(next.height)
    ) {
      fail("INVALID_CROWN_DIAGNOSTIC_PROFILE", "Crown outline coordinates must be finite.");
    }
    return total + point.projection * next.height - next.projection * point.height;
  }, 0);
  const area = roundMetric(Math.abs(doubled) / 2);
  if (!(area > 0 && area <= 1)) {
    fail("INVALID_CROWN_DIAGNOSTIC_PROFILE", "The normalized crown outline must have positive bounded area.");
  }
  return area;
}

function normalizeBytes(value) {
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) {
    fail("INVALID_CROWN_DIAGNOSTIC_DETAIL_BYTES", "detailBytes must be a Buffer or Uint8Array.");
  }
  const bytes = Buffer.from(value);
  if (bytes.length === 0) {
    fail("INVALID_CROWN_DIAGNOSTIC_DETAIL_BYTES", "detailBytes must not be empty.");
  }
  return bytes;
}

function assertPoint(value, label) {
  assertExactKeys(value, AXES, "INVALID_CROWN_DIAGNOSTIC_POINT", label);
  if (AXES.some((axis) => !Number.isFinite(value[axis]))) {
    fail("INVALID_CROWN_DIAGNOSTIC_POINT", `${label} must contain finite values.`);
  }
}

function assertFiniteVector(value, label) {
  if (!Array.isArray(value) || value.length !== 3 || value.some((entry) => !Number.isFinite(entry))) {
    fail("INVALID_CROWN_DIAGNOSTIC_VECTOR", `${label} must contain exactly three finite numbers.`);
  }
}

function assertExactKeys(value, keys, code, label) {
  if (!hasExactKeys(value, keys)) {
    fail(code, `${label} has unknown or missing fields.`);
  }
}

function hasExactKeys(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function subtract(left, right) {
  return { x: left.x - right.x, y: left.y - right.y, z: left.z - right.z };
}

function normalizeVector(vector) {
  const magnitude = Math.hypot(vector.x, vector.y, vector.z);
  if (!Number.isFinite(magnitude) || magnitude <= 1e-12) {
    fail("INVALID_CROWN_DIAGNOSTIC_VECTOR", "A diagnostic direction is degenerate.");
  }
  return { x: vector.x / magnitude, y: vector.y / magnitude, z: vector.z / magnitude };
}

function dot(left, right) {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function close(left, right, tolerance = 1e-9) {
  return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= tolerance;
}

function roundPoint(value) {
  return Object.fromEntries(AXES.map((axis) => [axis, roundMetric(value[axis])]));
}

function roundMetric(value) {
  if (!Number.isFinite(value)) {
    fail("INVALID_CROWN_DIAGNOSTIC_NUMBER", "Diagnostic measurements must be finite.");
  }
  const rounded = Math.round(value * 1e12) / 1e12;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function isSha256(value) {
  return /^[a-f0-9]{64}$/.test(String(value || ""));
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    fail("INVALID_CROWN_DIAGNOSTIC_JSON", "Diagnostic JSON numbers must be finite.");
  }
  const serialized = JSON.stringify(value);
  if (serialized === undefined) fail("INVALID_CROWN_DIAGNOSTIC_JSON", "Diagnostic values must be JSON serializable.");
  return serialized;
}

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function issue(code, message) {
  return Object.freeze({ code, severity: "error", message });
}

function fail(code, message, details = []) {
  throw new CrownDiagnosticReportError(code, message, details);
}
