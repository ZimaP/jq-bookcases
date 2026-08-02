#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access, mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  createGuidedBlenderRenderJob,
  regenerateGuidedBlenderRenderPackage,
  validateGuidedBlenderRenderPackage,
  validateGuidedBlenderRenderResult
} from "../../guided-blender-render-contract.js";
import { evaluateGuidedProjectCandidate } from "../../guided-project-engine.js";

const MODULE_DIRECTORY = dirname(fileURLToPath(import.meta.url));

export const REPOSITORY_ROOT = resolve(MODULE_DIRECTORY, "../..");
export const FOUNDATION_FIXTURE_PATH = join(
  REPOSITORY_ROOT,
  "tests/fixtures/blender-prototype/TV01-clear-wall-foundation.json"
);
export const DEFAULT_OUTPUT_DIRECTORY = join(
  REPOSITORY_ROOT,
  "artifacts/blender-clay-worker/TV01"
);
export const DEFAULT_BLENDER_EXECUTABLE = "/Applications/Blender.app/Contents/MacOS/Blender";
export const BLENDER_WORKER_PATH = join(MODULE_DIRECTORY, "clay_worker.py");

const FOUNDATION_FIXTURE_ID = "TV01-clear-wall-foundation";
export const EXPECTED_DRAWING_4_REQUEST_KEY = "jq-blender-v1-c4815b0d7c54f5cd54188571e5bba799611c032572b0da6842a8362b67ab6293";
export const EXPECTED_DRAWING_4_RENDER_KEY = "jq-blender-package-v1-132f36bbb41c69511fe893001a49d1406790e2d7fa5c954416f9cfbd9e63c29f";
export const EXPECTED_DRAWING_4_GEOMETRY_FINGERPRINT = "jq-guided-geometry-v1-2J95JPTIW69O4";
const EXPECTED_COMPONENT_COUNT = 46;
const EXPECTED_SUBMESH_OBJECT_COUNT = 78;
const EXPECTED_CONSTRAINT_COUNT = 7;
const EXPECTED_COLLECTION_COUNT = 4;
const EXPECTED_FOUNDATION_MEASUREMENTS = Object.freeze({
  caseworkWidth: 117,
  caseworkHeight: 96,
  caseworkDepth: 14,
  leftFiller: 1.5,
  rightFiller: 1.5,
  tvBodyWidth: 56,
  tvBodyHeight: 33,
  tvOpeningWidth: 60,
  tvOpeningHeight: 37
});
const EXPECTED_PREVIEW_RENDER = Object.freeze({
  profileId: "preview",
  width: 960,
  height: 640
});

export class BlenderClayRunnerError extends Error {
  constructor(code, message, details = []) {
    super(message);
    this.name = "BlenderClayRunnerError";
    this.code = code;
    this.details = details;
  }
}

/**
 * Regenerate the only foundation-v1 render package from the accepted JQ engine.
 * No geometry is accepted from command-line input or from a prior generated file.
 */
export async function createVerifiedClayRenderPackage(options = {}) {
  const fixturePath = absolutePath(
    options.fixturePath || FOUNDATION_FIXTURE_PATH,
    REPOSITORY_ROOT
  );
  const fixture = await readJsonFile(fixturePath, "foundation fixture");
  assertFoundationFixture(fixture);

  const project = structuredClone(fixture.project);
  const specification = evaluateGuidedProjectCandidate(project);
  assertCondition(
    specification?.accepted === true,
    "FOUNDATION_PROJECT_REJECTED",
    "TV01 was not accepted by the JQ project engine.",
    specification?.errors || []
  );
  assertCondition(
    specification?.audit?.valid === true,
    "FOUNDATION_PROJECT_AUDIT_FAILED",
    "TV01 did not pass the accepted JQ render audit.",
    specification?.audit?.errors || []
  );
  assertFoundationMeasurements(specification, fixture.currentContractExpectations);

  const job = await createGuidedBlenderRenderJob(project, specification, {
    profileId: "preview"
  });
  assertPreviewRenderSettings(job.render);
  assertCondition(
    /^jq-blender-v1-[a-f0-9]{64}$/.test(String(job.renderKey || "")),
    "INVALID_FOUNDATION_JOB_KEY",
    "The compact TV01 render job did not produce a current SHA-256 render key."
  );

  const renderPackage = await regenerateGuidedBlenderRenderPackage(job);
  const validation = await validateGuidedBlenderRenderPackage(renderPackage);
  assertCondition(
    validation.valid === true,
    "FOUNDATION_PACKAGE_VALIDATION_FAILED",
    "The regenerated TV01 Blender package failed its committed validation contract.",
    validation.errors
  );
  assertFoundationPackage(renderPackage, job, fixture.currentContractExpectations);

  return Object.freeze({
    fixturePath,
    fixture,
    specification,
    job,
    renderPackage,
    packageJson: deterministicJson(renderPackage)
  });
}

/** Write a canonical, key-sorted JSON document with a single trailing newline. */
export async function writeDeterministicJson(path, value) {
  const outputPath = absolutePath(path, REPOSITORY_ROOT);
  await mkdir(dirname(outputPath), { recursive: true });
  const contents = deterministicJson(value);
  await writeFile(outputPath, contents, "utf8");
  return Object.freeze({ path: outputPath, contents, bytes: Buffer.byteLength(contents) });
}

/**
 * BLENDER_BIN is authoritative when present. An empty override is an error,
 * rather than a request to silently fall back to another Blender installation.
 */
export function resolveBlenderExecutable(environment = process.env) {
  if (Object.hasOwn(environment || {}, "BLENDER_BIN")) {
    const configured = environment.BLENDER_BIN;
    if (typeof configured !== "string" || configured.trim() === "") {
      throw new BlenderClayRunnerError(
        "INVALID_BLENDER_BIN",
        "BLENDER_BIN must be a non-empty executable path when supplied."
      );
    }
    return configured.trim();
  }
  return DEFAULT_BLENDER_EXECUTABLE;
}

/** Read dimensions from the first standards-compliant VP8X, VP8L, or VP8 chunk. */
export function readWebpDimensions(bytes) {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || []);
  if (
    buffer.length < 20
    || buffer.toString("ascii", 0, 4) !== "RIFF"
    || buffer.toString("ascii", 8, 12) !== "WEBP"
  ) {
    throw new BlenderClayRunnerError("INVALID_WEBP", "beauty.webp is not a RIFF WebP file.");
  }
  const declaredLength = buffer.readUInt32LE(4) + 8;
  if (declaredLength !== buffer.length) {
    throw new BlenderClayRunnerError(
      "INVALID_WEBP_LENGTH",
      `beauty.webp declares ${declaredLength} bytes but contains ${buffer.length}.`
    );
  }

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkKind = buffer.toString("ascii", offset, offset + 4);
    const chunkLength = buffer.readUInt32LE(offset + 4);
    const payloadOffset = offset + 8;
    const payloadEnd = payloadOffset + chunkLength;
    if (payloadEnd > buffer.length) {
      throw new BlenderClayRunnerError(
        "INVALID_WEBP_CHUNK",
        `beauty.webp contains a truncated ${chunkKind} chunk.`
      );
    }

    if (chunkKind === "VP8X") {
      if (chunkLength < 10) invalidWebpDimensions("VP8X");
      return freezeDimensions(
        1 + buffer.readUIntLE(payloadOffset + 4, 3),
        1 + buffer.readUIntLE(payloadOffset + 7, 3)
      );
    }
    if (chunkKind === "VP8L") {
      if (chunkLength < 5 || buffer[payloadOffset] !== 0x2f) {
        invalidWebpDimensions("VP8L");
      }
      const byte1 = buffer[payloadOffset + 1];
      const byte2 = buffer[payloadOffset + 2];
      const byte3 = buffer[payloadOffset + 3];
      const byte4 = buffer[payloadOffset + 4];
      return freezeDimensions(
        1 + byte1 + ((byte2 & 0x3f) << 8),
        1 + (byte2 >> 6) + (byte3 << 2) + ((byte4 & 0x0f) << 10)
      );
    }
    if (chunkKind === "VP8 ") {
      if (
        chunkLength < 10
        || buffer[payloadOffset + 3] !== 0x9d
        || buffer[payloadOffset + 4] !== 0x01
        || buffer[payloadOffset + 5] !== 0x2a
      ) {
        invalidWebpDimensions("VP8");
      }
      return freezeDimensions(
        buffer.readUInt16LE(payloadOffset + 6) & 0x3fff,
        buffer.readUInt16LE(payloadOffset + 8) & 0x3fff
      );
    }

    offset = payloadEnd + (chunkLength % 2);
  }
  throw new BlenderClayRunnerError(
    "WEBP_DIMENSIONS_UNAVAILABLE",
    "beauty.webp does not contain a supported VP8 image chunk."
  );
}

/** Verify the actual local beauty file against both the package and result record. */
export async function verifyBeautyOutputIntegrity(renderPackage, result, beautyPath) {
  const beautyOutputs = Array.isArray(result?.outputs)
    ? result.outputs.filter((output) => output?.pass === "beauty")
    : [];
  assertCondition(
    beautyOutputs.length === 1,
    "BEAUTY_OUTPUT_CARDINALITY",
    "The worker result must contain exactly one beauty output."
  );
  const output = beautyOutputs[0];
  const absoluteBeautyPath = absolutePath(beautyPath, REPOSITORY_ROOT);
  const bytes = await readFile(absoluteBeautyPath);
  const dimensions = readWebpDimensions(bytes);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const expectedObjectKey = `${renderPackage.renderKey}/beauty.webp`;

  assertEqual(output.objectKey, expectedObjectKey, "BEAUTY_OBJECT_KEY_MISMATCH");
  assertEqual(output.mimeType, "image/webp", "BEAUTY_MIME_TYPE_MISMATCH");
  assertEqual(output.bytes, bytes.length, "BEAUTY_BYTE_COUNT_MISMATCH");
  assertEqual(output.sha256, sha256, "BEAUTY_SHA256_MISMATCH");
  assertEqual(output.width, dimensions.width, "BEAUTY_WIDTH_MISMATCH");
  assertEqual(output.height, dimensions.height, "BEAUTY_HEIGHT_MISMATCH");
  assertEqual(dimensions.width, renderPackage.render.width, "PACKAGE_BEAUTY_WIDTH_MISMATCH");
  assertEqual(dimensions.height, renderPackage.render.height, "PACKAGE_BEAUTY_HEIGHT_MISMATCH");

  return Object.freeze({
    path: absoluteBeautyPath,
    width: dimensions.width,
    height: dimensions.height,
    bytes: bytes.length,
    sha256
  });
}

export async function validateClayWorkerOutputs(renderPackage, paths) {
  const resultPath = absolutePath(paths.resultPath, REPOSITORY_ROOT);
  const result = await readJsonFile(resultPath, "Blender result");
  const validation = await validateGuidedBlenderRenderResult(renderPackage, result);
  assertCondition(
    validation.valid === true,
    "BLENDER_RESULT_VALIDATION_FAILED",
    "result.json failed the committed Blender worker-result contract.",
    validation.errors
  );
  const beauty = await verifyBeautyOutputIntegrity(renderPackage, result, paths.beautyPath);
  return Object.freeze({ resultPath, result, validation, beauty });
}

export async function runClayWorker(options = {}) {
  const outputDirectory = absolutePath(
    options.outputDirectory || DEFAULT_OUTPUT_DIRECTORY,
    REPOSITORY_ROOT
  );
  const packagePath = join(outputDirectory, "render-package.json");
  const blendPath = join(outputDirectory, "TV01-clay.blend");
  const beautyPath = join(outputDirectory, "beauty.webp");
  const resultPath = join(outputDirectory, "result.json");
  const reportPath = join(outputDirectory, "run-report.json");
  const workerReportPath = join(outputDirectory, "worker-report.json");
  const generated = await createVerifiedClayRenderPackage({
    fixturePath: options.fixturePath
  });
  await writeDeterministicJson(packagePath, generated.renderPackage);

  // Re-read the serialized boundary and validate it before Blender receives it.
  const serializedPackage = await readJsonFile(packagePath, "serialized render package");
  const serializedValidation = await validateGuidedBlenderRenderPackage(serializedPackage);
  assertCondition(
    serializedValidation.valid === true,
    "SERIALIZED_PACKAGE_VALIDATION_FAILED",
    "The written render-package.json did not survive deterministic serialization.",
    serializedValidation.errors
  );
  assertEqual(
    deterministicJson(serializedPackage),
    generated.packageJson,
    "NON_DETERMINISTIC_PACKAGE_JSON"
  );

  const blenderExecutable = resolveBlenderExecutable(options.environment || process.env);
  const workerPath = absolutePath(options.workerPath || BLENDER_WORKER_PATH, REPOSITORY_ROOT);
  await assertLocalWorkerInputs(blenderExecutable, workerPath);
  const blenderArguments = [
    "--background",
    "--factory-startup",
    "--python",
    workerPath,
    "--",
    "--package",
    packagePath,
    "--output-dir",
    outputDirectory,
    "--blend",
    blendPath,
    "--beauty",
    beautyPath,
    "--result",
    resultPath,
    "--project-root",
    REPOSITORY_ROOT
  ];
  await runProcess(blenderExecutable, blenderArguments, {
    cwd: REPOSITORY_ROOT,
    environment: options.environment || process.env,
    spawnImplementation: options.spawnImplementation || spawn
  });

  const verified = await validateClayWorkerOutputs(serializedPackage, {
    resultPath,
    beautyPath
  });
  const blendFile = await verifyBlendFile(blendPath);
  const workerReport = await readJsonFile(workerReportPath, "Blender worker report");
  assertRunReport(workerReport, serializedPackage);
  const report = {
    ...workerReport,
    nodeValidation: {
      package: {
        valid: serializedValidation.valid,
        schemaVersion: serializedValidation.schemaVersion
      },
      result: {
        valid: verified.validation.valid,
        schemaVersion: verified.validation.schemaVersion
      },
      beauty: {
        width: verified.beauty.width,
        height: verified.beauty.height,
        bytes: verified.beauty.bytes,
        sha256: verified.beauty.sha256
      },
      blend: {
        bytes: blendFile.bytes
      }
    }
  };
  await writeDeterministicJson(reportPath, report);
  // This worker-owned handoff file is the only intermediate removed by the runner.
  await unlink(workerReportPath);

  return Object.freeze({
    blenderExecutable,
    packagePath,
    blendPath,
    beautyPath,
    resultPath,
    reportPath,
    renderPackage: serializedPackage,
    result: verified.result,
    resultValidation: verified.validation,
    beauty: verified.beauty,
    blendFile,
    report: Object.freeze(report)
  });
}

function assertFoundationFixture(fixture) {
  assertCondition(
    fixture?.id === FOUNDATION_FIXTURE_ID,
    "UNEXPECTED_FOUNDATION_FIXTURE",
    `The clay runner only accepts ${FOUNDATION_FIXTURE_ID}.`
  );
  assertCondition(
    fixture?.approvalStatus === "internal-drawing-4-prototype",
    "FOUNDATION_APPROVAL_STATE_DRIFT",
    "The TV01 fixture approval state changed; clay generation must be reviewed."
  );
  assertCondition(
    fixture?.project && typeof fixture.project === "object" && !Array.isArray(fixture.project),
    "INVALID_FOUNDATION_PROJECT",
    "The TV01 fixture does not contain a project object."
  );
  const expectations = fixture?.currentContractExpectations;
  assertCondition(
    expectations && typeof expectations === "object" && !Array.isArray(expectations),
    "MISSING_FOUNDATION_EXPECTATIONS",
    "The TV01 fixture does not contain current contract expectations."
  );
  assertEqual(
    expectations.renderableComponents,
    EXPECTED_COMPONENT_COUNT,
    "FOUNDATION_COMPONENT_EXPECTATION_DRIFT"
  );
  assertEqual(
    expectations.renderableSubmeshes,
    EXPECTED_SUBMESH_OBJECT_COUNT,
    "FOUNDATION_SUBMESH_EXPECTATION_DRIFT"
  );
  assertEqual(
    expectations.nonRenderableBlenderConstraints,
    EXPECTED_CONSTRAINT_COUNT,
    "FOUNDATION_CONSTRAINT_EXPECTATION_DRIFT"
  );
  for (const [key, expected] of Object.entries(EXPECTED_FOUNDATION_MEASUREMENTS)) {
    assertEqual(
      expectations[key],
      expected,
      "FOUNDATION_MEASUREMENT_EXPECTATION_DRIFT",
      key
    );
  }
}

function assertFoundationMeasurements(specification, expectations) {
  const checks = [
    [specification?.fit?.casework?.width, expectations.caseworkWidth, "casework width"],
    [specification?.fit?.casework?.overallHeight, expectations.caseworkHeight, "casework height"],
    [specification?.fit?.casework?.depth, expectations.caseworkDepth, "casework depth"],
    [specification?.fit?.treatments?.left?.width, expectations.leftFiller, "left filler"],
    [specification?.fit?.treatments?.right?.width, expectations.rightFiller, "right filler"],
    [specification?.product?.tv?.body?.width, expectations.tvBodyWidth, "TV body width"],
    [specification?.product?.tv?.body?.height, expectations.tvBodyHeight, "TV body height"],
    [specification?.product?.tv?.opening?.width, expectations.tvOpeningWidth, "TV opening width"],
    [specification?.product?.tv?.opening?.height, expectations.tvOpeningHeight, "TV opening height"]
  ];
  for (const [actual, expected, label] of checks) {
    assertEqual(actual, expected, "FOUNDATION_MEASUREMENT_DRIFT", label);
  }
}

function assertPreviewRenderSettings(render) {
  for (const [key, expected] of Object.entries(EXPECTED_PREVIEW_RENDER)) {
    assertEqual(render?.[key], expected, "PREVIEW_RENDER_SETTINGS_DRIFT", key);
  }
  assertCondition(
    Array.isArray(render?.passes)
      && render.passes.length === 1
      && render.passes[0] === "beauty",
    "PREVIEW_RENDER_PASSES_DRIFT",
    "The clay preview must request exactly the beauty pass."
  );
}

function assertFoundationPackage(renderPackage, job, expectations) {
  assertEqual(renderPackage.identity?.productId, "tv-unit", "PACKAGE_PRODUCT_ID_MISMATCH");
  assertEqual(renderPackage.identity?.layoutId, "clear-wall", "PACKAGE_LAYOUT_ID_MISMATCH");
  assertEqual(
    renderPackage.identity?.installationMode,
    "fitted",
    "PACKAGE_INSTALLATION_MODE_MISMATCH"
  );
  assertEqual(renderPackage.sourceUnits, "inches", "PACKAGE_SOURCE_UNITS_MISMATCH");
  assertEqual(renderPackage.targetUnits, "meters", "PACKAGE_TARGET_UNITS_MISMATCH");
  assertEqual(renderPackage.requestKey, job.renderKey, "PACKAGE_REQUEST_KEY_MISMATCH");
  assertEqual(
    renderPackage.requestKey,
    EXPECTED_DRAWING_4_REQUEST_KEY,
    "UNSUPPORTED_DRAWING_4_REQUEST_KEY"
  );
  assertEqual(
    renderPackage.identity?.geometryFingerprint,
    EXPECTED_DRAWING_4_GEOMETRY_FINGERPRINT,
    "UNSUPPORTED_DRAWING_4_GEOMETRY_FINGERPRINT"
  );
  assertEqual(
    deterministicJson(renderPackage.identity),
    deterministicJson(job.identity),
    "PACKAGE_IDENTITY_MISMATCH"
  );
  assertEqual(
    renderPackage.renderKey,
    EXPECTED_DRAWING_4_RENDER_KEY,
    "UNSUPPORTED_DRAWING_4_RENDER_KEY"
  );
  assertCondition(
    renderPackage?.readiness?.prototypeRenderAllowed === true,
    "FOUNDATION_PROTOTYPE_RENDER_BLOCKED",
    "The committed readiness envelope does not allow a prototype clay render."
  );
  assertCondition(
    renderPackage?.readiness?.customerBeautyRenderApproved === false,
    "CUSTOMER_BEAUTY_UNEXPECTEDLY_APPROVED",
    "The local clay runner refuses a package that changes the customer approval gate."
  );
  assertCondition(
    renderPackage?.audit?.valid === true,
    "FOUNDATION_PACKAGE_AUDIT_FAILED",
    "The authoritative TV01 package audit is not valid."
  );
  assertEqual(
    renderPackage.components?.length,
    expectations.renderableComponents,
    "PACKAGE_COMPONENT_COUNT_MISMATCH"
  );
  assertEqual(
    renderPackage.constraints?.length,
    expectations.nonRenderableBlenderConstraints,
    "PACKAGE_CONSTRAINT_COUNT_MISMATCH"
  );
  assertEqual(
    renderPackage.audit.physicalComponentCount,
    expectations.renderableComponents,
    "PACKAGE_PHYSICAL_COUNT_MISMATCH"
  );
  assertEqual(
    renderPackage.audit.renderedComponentCount,
    expectations.renderableComponents,
    "PACKAGE_RENDERED_COUNT_MISMATCH"
  );
  assertEqual(
    renderPackage.audit.constraintCount,
    expectations.nonRenderableBlenderConstraints,
    "PACKAGE_AUDIT_CONSTRAINT_COUNT_MISMATCH"
  );
  assertEqual(
    renderPackage.audit.primitiveRecordCount,
    EXPECTED_COMPONENT_COUNT,
    "PACKAGE_PRIMITIVE_RECORD_COUNT_MISMATCH"
  );
  assertEqual(
    countPackageSubmeshes(renderPackage),
    EXPECTED_SUBMESH_OBJECT_COUNT,
    "PACKAGE_SUBMESH_OBJECT_COUNT_MISMATCH"
  );
  assertPreviewRenderSettings(renderPackage.render);
  assertUniquePackageIds(renderPackage);
  assertPackageBoundsAndMaterials(renderPackage);
}

function assertUniquePackageIds(renderPackage) {
  const componentIds = new Set();
  const objectIds = new Set();
  for (const component of renderPackage.components || []) {
    assertUniqueIdentifier(componentIds, component.componentId, "component");
    const localSubmeshIds = new Set();
    for (const submesh of component.submeshes || []) {
      assertUniqueIdentifier(localSubmeshIds, submesh.submeshId, "submesh");
      assertUniqueIdentifier(
        objectIds,
        `${component.componentId}::${submesh.submeshId}`,
        "component/submesh object"
      );
    }
  }
  const constraintIds = new Set();
  for (const constraint of renderPackage.constraints || []) {
    assertUniqueIdentifier(constraintIds, constraint.constraintId, "constraint");
  }
}

function countPackageSubmeshes(renderPackage) {
  return (renderPackage.components || []).reduce((total, component) => (
    total + (Array.isArray(component.submeshes) ? component.submeshes.length : 0)
  ), 0);
}

function assertUniqueIdentifier(seen, value, label) {
  assertCondition(
    typeof value === "string" && value.length > 0,
    "INVALID_PACKAGE_ID",
    `Every ${label} ID must be a non-empty string.`
  );
  assertCondition(
    !seen.has(value),
    "DUPLICATE_PACKAGE_ID",
    `Duplicate ${label} ID: ${value}.`
  );
  seen.add(value);
}

function assertPackageBoundsAndMaterials(renderPackage) {
  const clayMaterialIds = new Set();
  for (const material of renderPackage.clayMaterials || []) {
    assertUniqueIdentifier(clayMaterialIds, material.materialId, "clay material");
  }
  const materialBindings = new Map();
  for (const binding of renderPackage.materials || []) {
    const key = `${binding.sourceMaterialSlot}\u0000${binding.materialId}`;
    assertCondition(
      !materialBindings.has(key),
      "DUPLICATE_PACKAGE_MATERIAL_BINDING",
      `Duplicate package material binding: ${binding.sourceMaterialSlot}/${binding.materialId}.`
    );
    assertCondition(
      clayMaterialIds.has(binding.clayMaterialId),
      "UNRESOLVED_CLAY_MATERIAL",
      `${binding.sourceMaterialSlot}/${binding.materialId} does not resolve to a clay material.`
    );
    materialBindings.set(key, binding);
  }
  for (const component of renderPackage.components || []) {
    assertFiniteOrderedBounds(component.blenderWorldBounds, component.componentId);
    for (const submesh of component.submeshes || []) {
      const objectId = `${component.componentId}::${submesh.submeshId}`;
      assertFiniteOrderedBounds(submesh.blenderWorldBounds, objectId);
      assertCondition(
        ["box", "crown_profile_extrusion"].includes(submesh.geometry),
        "UNSUPPORTED_PACKAGE_PRIMITIVE",
        `${objectId} uses unsupported primitive ${submesh.geometry}.`
      );
      assertCondition(
        materialBindings.has(`${submesh.sourceMaterialSlot}\u0000${submesh.materialId}`),
        "UNRESOLVED_PACKAGE_MATERIAL",
        `${objectId} does not resolve to an explicit package material binding.`
      );
    }
  }
  for (const constraint of renderPackage.constraints || []) {
    assertFiniteOrderedBounds(constraint.blenderWorldBounds, constraint.constraintId);
  }
}

function assertFiniteOrderedBounds(bounds, label) {
  assertCondition(
    Boolean(bounds?.min && bounds?.max && ["x", "y", "z"].every((axis) => (
      typeof bounds.min[axis] === "number"
      && Number.isFinite(bounds.min[axis])
      && typeof bounds.max[axis] === "number"
      && Number.isFinite(bounds.max[axis])
      && bounds.max[axis] > bounds.min[axis]
    ))),
    "INVALID_PACKAGE_BOUNDS",
    `${label} does not have finite ordered Blender bounds.`
  );
}

async function assertLocalWorkerInputs(blenderExecutable, workerPath) {
  await access(workerPath, fsConstants.R_OK);
  if (isAbsolute(blenderExecutable) || blenderExecutable.includes("/")) {
    await access(absolutePath(blenderExecutable, process.cwd()), fsConstants.X_OK);
  }
}

async function runProcess(executable, args, options) {
  await new Promise((resolveProcess, rejectProcess) => {
    let child;
    try {
      child = options.spawnImplementation(executable, args, {
        cwd: options.cwd,
        env: options.environment,
        stdio: "inherit"
      });
    } catch (error) {
      rejectProcess(new BlenderClayRunnerError(
        "BLENDER_START_FAILED",
        `Blender could not be started: ${error.message}`
      ));
      return;
    }
    child.once("error", (error) => {
      rejectProcess(new BlenderClayRunnerError(
        "BLENDER_START_FAILED",
        `Blender could not be started: ${error.message}`
      ));
    });
    child.once("exit", (code, signal) => {
      if (code === 0 && signal === null) {
        resolveProcess();
        return;
      }
      rejectProcess(new BlenderClayRunnerError(
        "BLENDER_WORKER_FAILED",
        signal
          ? `Blender was terminated by signal ${signal}.`
          : `Blender exited with status ${code}.`
      ));
    });
  });
}

function assertRunReport(report, renderPackage) {
  const submeshCount = renderPackage.components.reduce(
    (total, component) => total + component.submeshes.length,
    0
  );
  const expectedCollections = [
    "JQ_CASEWORK",
    "JQ_ROOM",
    "JQ_CONSTRAINTS_DEBUG",
    "JQ_CAMERAS"
  ];
  const expectedComponentNames = renderPackage.components.flatMap((component) => (
    component.submeshes.map((submesh) => `${component.componentId}::${submesh.submeshId}`)
  ));
  const expectedConstraintNames = renderPackage.constraints.map((constraint) => (
    `${constraint.constraintId}::${constraint.kind}`
  ));
  const expectedRoomNames = ["room-floor", "room-rear-wall"];
  const expectedSceneNames = [
    ...expectedComponentNames,
    ...expectedConstraintNames,
    ...expectedRoomNames,
    "JQ_HERO_CAMERA"
  ].sort();
  assertEqual(report?.kind, "jq-local-blender-clay-worker-report", "RUN_REPORT_KIND_MISMATCH");
  assertEqual(report?.schemaVersion, 1, "RUN_REPORT_SCHEMA_MISMATCH");
  assertEqual(report?.renderKey, renderPackage.renderKey, "RUN_REPORT_KEY_MISMATCH");
  assertEqual(
    report?.pipelineVersion,
    renderPackage.pipelineVersion,
    "RUN_REPORT_PIPELINE_MISMATCH"
  );
  assertEqual(
    report?.componentCount,
    renderPackage.components.length,
    "RUN_REPORT_COMPONENT_COUNT_MISMATCH"
  );
  assertEqual(report?.submeshObjectCount, submeshCount, "RUN_REPORT_SUBMESH_COUNT_MISMATCH");
  assertEqual(
    report?.constraintCount,
    renderPackage.constraints.length,
    "RUN_REPORT_CONSTRAINT_COUNT_MISMATCH"
  );
  assertEqual(report?.collectionCount, EXPECTED_COLLECTION_COUNT, "RUN_REPORT_COLLECTION_COUNT_MISMATCH");
  assertEqual(
    JSON.stringify(report?.collectionNames),
    JSON.stringify(expectedCollections),
    "RUN_REPORT_COLLECTION_NAMES_MISMATCH"
  );
  assertEqual(
    JSON.stringify(report?.componentObjectNames),
    JSON.stringify(expectedComponentNames),
    "RUN_REPORT_COMPONENT_NAMES_MISMATCH"
  );
  assertEqual(
    JSON.stringify(report?.constraintObjectNames),
    JSON.stringify(expectedConstraintNames),
    "RUN_REPORT_CONSTRAINT_NAMES_MISMATCH"
  );
  assertEqual(
    JSON.stringify(report?.roomObjectNames),
    JSON.stringify(expectedRoomNames),
    "RUN_REPORT_ROOM_NAMES_MISMATCH"
  );
  assertEqual(
    JSON.stringify(report?.sceneObjectNames),
    JSON.stringify(expectedSceneNames),
    "RUN_REPORT_SCENE_NAMES_MISMATCH"
  );
  assertCondition(
    typeof report?.blenderVersion === "string" && /^5\.2(?:\.|$)/.test(report.blenderVersion),
    "RUN_REPORT_BLENDER_VERSION_MISMATCH",
    "The Blender run report must identify Blender 5.2."
  );
}

async function verifyBlendFile(blendPath) {
  let metadata;
  try {
    metadata = await stat(blendPath);
  } catch (error) {
    throw new BlenderClayRunnerError(
      "BLEND_FILE_MISSING",
      `The worker did not produce TV01-clay.blend: ${error.message}`
    );
  }
  assertCondition(
    metadata.isFile() && metadata.size > 0,
    "INVALID_BLEND_FILE",
    "TV01-clay.blend must be a non-empty regular file."
  );
  return Object.freeze({ path: blendPath, bytes: metadata.size });
}

async function readJsonFile(path, label) {
  let source;
  try {
    source = await readFile(path, "utf8");
  } catch (error) {
    throw new BlenderClayRunnerError(
      "JSON_FILE_READ_FAILED",
      `Could not read ${label} at ${path}: ${error.message}`
    );
  }
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new BlenderClayRunnerError(
      "INVALID_JSON_FILE",
      `${label} at ${path} is not valid JSON: ${error.message}`
    );
  }
}

function deterministicJson(value) {
  return `${JSON.stringify(canonicalizeJson(value), null, 2)}\n`;
}

function canonicalizeJson(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new BlenderClayRunnerError(
        "NON_FINITE_JSON_NUMBER",
        "Deterministic JSON cannot contain a non-finite number."
      );
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map(canonicalizeJson);
  if (!value || typeof value !== "object") {
    throw new BlenderClayRunnerError(
      "UNSUPPORTED_JSON_VALUE",
      "Deterministic JSON contains an unsupported value."
    );
  }
  return Object.fromEntries(Object.keys(value).sort().map((key) => {
    if (value[key] === undefined) {
      throw new BlenderClayRunnerError(
        "UNDEFINED_JSON_VALUE",
        `Deterministic JSON cannot contain undefined at ${key}.`
      );
    }
    return [key, canonicalizeJson(value[key])];
  }));
}

function absolutePath(path, baseDirectory) {
  return isAbsolute(path) ? path : resolve(baseDirectory, path);
}

function freezeDimensions(width, height) {
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    invalidWebpDimensions("image");
  }
  return Object.freeze({ width, height });
}

function invalidWebpDimensions(chunkKind) {
  throw new BlenderClayRunnerError(
    "INVALID_WEBP_DIMENSIONS",
    `beauty.webp contains a malformed ${chunkKind} dimensions header.`
  );
}

function assertEqual(actual, expected, code, label = "value") {
  assertCondition(
    Object.is(actual, expected),
    code,
    `${label} must be ${String(expected)}; received ${String(actual)}.`
  );
}

function assertCondition(condition, code, message, details = []) {
  if (!condition) throw new BlenderClayRunnerError(code, message, details);
}

async function main() {
  const result = await runClayWorker();
  console.log(JSON.stringify({
    status: "succeeded",
    renderKey: result.renderPackage.renderKey,
    componentCount: result.renderPackage.components.length,
    submeshObjectCount: result.report.submeshObjectCount,
    constraintCount: result.renderPackage.constraints.length,
    beauty: result.beauty,
    blendPath: result.blendPath,
    resultPath: result.resultPath
  }, null, 2));
}

const entryPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (entryPath === import.meta.url) {
  main().catch((error) => {
    const code = error?.code ? ` [${error.code}]` : "";
    console.error(`Blender clay worker failed${code}: ${error?.message || error}`);
    if (Array.isArray(error?.details) && error.details.length) {
      console.error(JSON.stringify(error.details, null, 2));
    }
    process.exitCode = 1;
  });
}
