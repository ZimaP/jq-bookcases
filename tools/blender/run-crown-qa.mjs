#!/usr/bin/env node

import { spawn } from "node:child_process";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { constants as fsConstants } from "node:fs";
import { access, readFile, unlink } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { validateGuidedBlenderRenderPackage } from "../../guided-blender-render-contract.js";
import {
  createCrownDetailQaCapture,
  validateCrownDetailQaCapture
} from "./crown-qa-contract.mjs";
import {
  createCrownDiagnosticReport,
  validateCrownDiagnosticReport
} from "./crown-diagnostic-report.mjs";
import {
  BLENDER_WORKER_PATH,
  DEFAULT_OUTPUT_DIRECTORY,
  REPOSITORY_ROOT,
  createVerifiedClayRenderPackage,
  resolveBlenderExecutable,
  validateClayWorkerOutputs,
  writeDeterministicJson
} from "./run-clay-worker.mjs";

const execFileAsync = promisify(execFile);
const WORKER_REPORT_KIND = "jq-local-blender-crown-qa-worker-report";
const WORKER_REPORT_SCHEMA_VERSION = 1;
const BOUNDS_TOLERANCE_M = 1e-6;
const COLLECTION_NAMES = Object.freeze([
  "JQ_CASEWORK",
  "JQ_ROOM",
  "JQ_CONSTRAINTS_DEBUG",
  "JQ_CAMERAS"
]);
const ROOM_OBJECT_NAMES = Object.freeze(["room-floor", "room-rear-wall"]);

export const CROWN_QA_CAPTURE_PATHNAME = "crown-qa-capture.json";
export const CROWN_QA_DETAIL_PATHNAME = "crown-detail.webp";
export const CROWN_QA_DIAGNOSTIC_PATHNAME = "crown-diagnostic.json";
export const CROWN_QA_WORKER_REPORT_PATHNAME = "crown-worker-report.json";

export class CrownQaRunnerError extends Error {
  constructor(code, message, details = []) {
    super(message);
    this.name = "CrownQaRunnerError";
    this.code = code;
    this.details = details;
  }
}

/** Construct the only allowed headless Blender invocation for the QA capture. */
export function createCrownQaBlenderArguments(paths) {
  const required = [
    "workerPath",
    "packagePath",
    "outputDirectory",
    "capturePath",
    "detailPath",
    "workerReportPath",
    "primaryBeautyPath",
    "repositoryRoot"
  ];
  assertExactKeys(paths, required, "INVALID_CROWN_QA_PATHS");
  for (const key of required) {
    assert(
      typeof paths[key] === "string" && isAbsolute(paths[key]),
      "RELATIVE_CROWN_QA_PATH",
      `${key} must be an absolute path.`
    );
  }
  assertBasename(paths.packagePath, paths.outputDirectory, "render-package.json");
  assertBasename(paths.capturePath, paths.outputDirectory, CROWN_QA_CAPTURE_PATHNAME);
  assertBasename(paths.detailPath, paths.outputDirectory, CROWN_QA_DETAIL_PATHNAME);
  assertBasename(paths.workerReportPath, paths.outputDirectory, CROWN_QA_WORKER_REPORT_PATHNAME);
  assertBasename(paths.primaryBeautyPath, paths.outputDirectory, "beauty.webp");
  return Object.freeze([
    "--background",
    "--factory-startup",
    "--python",
    paths.workerPath,
    "--",
    "--package",
    paths.packagePath,
    "--output-dir",
    paths.outputDirectory,
    "--crown-qa-capture",
    paths.capturePath,
    "--crown-detail",
    paths.detailPath,
    "--crown-worker-report",
    paths.workerReportPath,
    "--primary-beauty",
    paths.primaryBeautyPath,
    "--project-root",
    paths.repositoryRoot
  ]);
}

/** Validate Blender's measured scene handoff before the final report is built. */
export function validateCrownQaWorkerReport(renderPackage, capture, report, primaryBeauty) {
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
  ], "INVALID_CROWN_WORKER_REPORT_SHAPE");
  assert(report.kind === WORKER_REPORT_KIND, "CROWN_WORKER_REPORT_KIND_MISMATCH", "Unexpected crown worker report kind.");
  assert(report.schemaVersion === WORKER_REPORT_SCHEMA_VERSION, "CROWN_WORKER_REPORT_SCHEMA_MISMATCH", "Unexpected crown worker report schema.");
  assert(report.status === "succeeded", "CROWN_WORKER_FAILED", "Blender did not report a successful crown QA capture.");
  assert(/^5\.2(?:\.|$)/.test(String(report.blenderVersion || "")), "CROWN_WORKER_BLENDER_VERSION_MISMATCH", "Crown QA requires Blender 5.2.");
  assert(report.primaryRenderKey === renderPackage.renderKey, "CROWN_WORKER_RENDER_KEY_MISMATCH", "Worker primary render key drifted.");
  assert(report.pipelineVersion === renderPackage.pipelineVersion, "CROWN_WORKER_PIPELINE_MISMATCH", "Worker pipeline version drifted.");
  assert(report.captureKey === capture.captureKey, "CROWN_WORKER_CAPTURE_KEY_MISMATCH", "Worker capture key drifted.");

  assertExactKeys(report.captureCamera, [
    ...Object.keys(capture.camera),
    "objectName"
  ], "INVALID_CROWN_WORKER_CAMERA_SHAPE");
  const workerCamera = structuredClone(report.captureCamera);
  const objectName = workerCamera.objectName;
  delete workerCamera.objectName;
  assert(objectName === capture.camera.cameraId, "CROWN_WORKER_CAMERA_NAME_MISMATCH", "Blender QA camera name drifted.");
  assertDeepEqual(workerCamera, capture.camera, "CROWN_WORKER_CAMERA_MISMATCH", "Blender QA camera differs from the renderer-neutral capture.");

  const componentsById = new Map(renderPackage.components.map((component) => [component.componentId, component]));
  assert(Array.isArray(report.crownObjects), "INVALID_CROWN_WORKER_OBJECTS", "Worker crown objects must be an array.");
  assert(report.crownObjects.length === capture.target.submeshObjectNames.length, "CROWN_WORKER_OBJECT_COUNT_MISMATCH", "Worker crown object count drifted.");
  const measuredObjectNames = [];
  for (const measured of report.crownObjects) {
    assertExactKeys(measured, [
      "componentId",
      "submeshId",
      "objectName",
      "packageBounds",
      "blenderMeshBounds",
      "maximumAbsoluteBoundsDeltaM",
      "boundsToleranceM",
      "withinTolerance",
      "transform"
    ], "INVALID_CROWN_WORKER_OBJECT_SHAPE");
    const component = componentsById.get(measured.componentId);
    assert(component?.role === "crown", "CROWN_WORKER_COMPONENT_MISMATCH", `Unknown measured crown ${measured.componentId}.`);
    assert(measured.submeshId === "profile-extrusion", "CROWN_WORKER_SUBMESH_MISMATCH", "Measured crown submesh ID drifted.");
    assert(measured.objectName === `${measured.componentId}::${measured.submeshId}`, "CROWN_WORKER_OBJECT_NAME_MISMATCH", "Measured crown object name drifted.");
    const packageBounds = component.submeshes[0].blenderWorldBounds;
    assertDeepEqual(measured.packageBounds, packageBounds, "CROWN_WORKER_PACKAGE_BOUNDS_MISMATCH", "Worker copied different package bounds.");
    assertFiniteBounds(measured.blenderMeshBounds, measured.objectName);
    const calculatedDelta = maximumBoundsDelta(measured.blenderMeshBounds, packageBounds);
    assert(measured.boundsToleranceM === BOUNDS_TOLERANCE_M, "CROWN_WORKER_BOUNDS_TOLERANCE_MISMATCH", "Worker bounds tolerance drifted.");
    assert(measured.maximumAbsoluteBoundsDeltaM === roundMetric(calculatedDelta), "CROWN_WORKER_BOUNDS_DELTA_MISMATCH", "Worker bounds delta is not reproducible.");
    assert(measured.withinTolerance === true && calculatedDelta <= BOUNDS_TOLERANCE_M, "CROWN_WORKER_BOUNDS_PARITY_FAILED", `${measured.objectName} does not match package bounds.`);
    assertExactKeys(measured.transform, ["location", "rotationEuler", "scale"], "INVALID_CROWN_WORKER_TRANSFORM");
    assertDeepEqual(measured.transform.location, [0, 0, 0], "CROWN_WORKER_LOCATION_DRIFT", `${measured.objectName} has unapplied location.`);
    assertDeepEqual(measured.transform.rotationEuler, [0, 0, 0], "CROWN_WORKER_ROTATION_DRIFT", `${measured.objectName} has unapplied rotation.`);
    assertDeepEqual(measured.transform.scale, [1, 1, 1], "CROWN_WORKER_SCALE_DRIFT", `${measured.objectName} has non-unit scale.`);
    measuredObjectNames.push(measured.objectName);
  }
  assertDeepEqual(measuredObjectNames, capture.target.submeshObjectNames, "CROWN_WORKER_OBJECT_ORDER_MISMATCH", "Measured crown object order drifted.");

  validateSceneReport(renderPackage, report.scene);
  validatePrimaryBeautyRecord(report.primaryBeauty, primaryBeauty);
  validateWorkerOutput(capture, report.output);
  assertExactKeys(report.cleanup, [
    "heroCameraRestored",
    "temporaryCameraRemoved",
    "renderFilepathRestored",
    "sceneObjectSetRestored"
  ], "INVALID_CROWN_WORKER_CLEANUP_SHAPE");
  assert(Object.values(report.cleanup).every((value) => value === true), "CROWN_WORKER_CLEANUP_FAILED", "Crown QA did not restore the primary scene.");
  return Object.freeze({ valid: true, schemaVersion: WORKER_REPORT_SCHEMA_VERSION });
}

export async function runCrownQa(options = {}) {
  const outputDirectory = absolutePath(options.outputDirectory || DEFAULT_OUTPUT_DIRECTORY, REPOSITORY_ROOT);
  const packagePath = join(outputDirectory, "render-package.json");
  const primaryBeautyPath = join(outputDirectory, "beauty.webp");
  const primaryResultPath = join(outputDirectory, "result.json");
  const capturePath = join(outputDirectory, CROWN_QA_CAPTURE_PATHNAME);
  const detailPath = join(outputDirectory, CROWN_QA_DETAIL_PATHNAME);
  const diagnosticPath = join(outputDirectory, CROWN_QA_DIAGNOSTIC_PATHNAME);
  const workerReportPath = join(outputDirectory, CROWN_QA_WORKER_REPORT_PATHNAME);
  const workerPath = absolutePath(options.workerPath || BLENDER_WORKER_PATH, REPOSITORY_ROOT);

  const generated = await createVerifiedClayRenderPackage({ fixturePath: options.fixturePath });
  await writeDeterministicJson(packagePath, generated.renderPackage);
  const renderPackage = await readJson(packagePath, "render package");
  const packageValidation = await validateGuidedBlenderRenderPackage(renderPackage);
  assert(packageValidation.valid === true, "CROWN_QA_PACKAGE_INVALID", "Written render package failed validation.", packageValidation.errors);
  const primaryBefore = await validateClayWorkerOutputs(renderPackage, {
    resultPath: primaryResultPath,
    beautyPath: primaryBeautyPath
  });
  const primaryResultSnapshot = stableStringify(primaryBefore.result);
  const primaryBeautySnapshot = stableStringify(primaryBefore.beauty);

  const capture = await createCrownDetailQaCapture(renderPackage);
  const captureValidation = await validateCrownDetailQaCapture(renderPackage, capture);
  assert(captureValidation.valid === true, "CROWN_QA_CAPTURE_INVALID", "Derived crown QA capture failed validation.", captureValidation.errors);
  await writeDeterministicJson(capturePath, capture);
  const serializedCapture = await readJson(capturePath, "crown QA capture");
  const serializedCaptureValidation = await validateCrownDetailQaCapture(renderPackage, serializedCapture);
  assert(serializedCaptureValidation.valid === true, "SERIALIZED_CROWN_QA_CAPTURE_INVALID", "Written crown QA capture failed validation.", serializedCaptureValidation.errors);

  const blenderExecutable = resolveBlenderExecutable(options.environment || process.env);
  await assertExecutable(blenderExecutable, workerPath);
  const blenderArguments = createCrownQaBlenderArguments({
    workerPath,
    packagePath,
    outputDirectory,
    capturePath,
    detailPath,
    workerReportPath,
    primaryBeautyPath,
    repositoryRoot: REPOSITORY_ROOT
  });
  await runProcess(blenderExecutable, blenderArguments, {
    cwd: REPOSITORY_ROOT,
    environment: options.environment || process.env,
    spawnImplementation: options.spawnImplementation || spawn
  });

  const workerReport = await readJson(workerReportPath, "crown Blender worker report");
  validateCrownQaWorkerReport(renderPackage, serializedCapture, workerReport, primaryBefore.beauty);
  const primaryAfter = await validateClayWorkerOutputs(renderPackage, {
    resultPath: primaryResultPath,
    beautyPath: primaryBeautyPath
  });
  assert(stableStringify(primaryAfter.result) === primaryResultSnapshot, "PRIMARY_RESULT_CHANGED", "Crown QA changed result.json.");
  assert(stableStringify(primaryAfter.beauty) === primaryBeautySnapshot, "PRIMARY_BEAUTY_CHANGED", "Crown QA changed beauty.webp.");

  const sourceCommit = options.sourceCommit || await currentCommit();
  assert(/^[a-f0-9]{40}$/.test(sourceCommit), "INVALID_SOURCE_COMMIT", "Crown diagnostic source commit must be a full Git SHA.");
  const detailBytes = await readFile(detailPath);
  const reportInputs = {
    sourceCommit,
    renderPackage,
    capture: serializedCapture,
    workerReport,
    primaryResult: primaryAfter.result,
    detailBytes
  };
  const diagnostic = await createCrownDiagnosticReport(reportInputs);
  const diagnosticValidation = await validateCrownDiagnosticReport(reportInputs, diagnostic);
  assert(diagnosticValidation.valid === true, "CROWN_DIAGNOSTIC_INVALID", "crown-diagnostic.json failed validation.", diagnosticValidation.errors);
  await writeDeterministicJson(diagnosticPath, diagnostic);
  const serializedDiagnostic = await readJson(diagnosticPath, "crown diagnostic");
  const serializedDiagnosticValidation = await validateCrownDiagnosticReport(reportInputs, serializedDiagnostic);
  assert(serializedDiagnosticValidation.valid === true, "SERIALIZED_CROWN_DIAGNOSTIC_INVALID", "Written crown diagnostic failed validation.", serializedDiagnosticValidation.errors);

  await unlink(workerReportPath);
  return Object.freeze({
    blenderExecutable,
    blenderArguments,
    renderPackage,
    capture: serializedCapture,
    diagnostic: serializedDiagnostic,
    packagePath,
    primaryBeautyPath,
    primaryResultPath,
    capturePath,
    detailPath,
    diagnosticPath,
    sourceCommit
  });
}

function validateSceneReport(renderPackage, scene) {
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
  ], "INVALID_CROWN_WORKER_SCENE_SHAPE");
  const componentNames = renderPackage.components.flatMap((component) => component.submeshes.map((submesh) => `${component.componentId}::${submesh.submeshId}`));
  const constraintNames = renderPackage.constraints.map((constraint) => `${constraint.constraintId}::${constraint.kind}`);
  const sceneNames = [...componentNames, ...constraintNames, ...ROOM_OBJECT_NAMES, "JQ_HERO_CAMERA"].sort();
  assert(scene.componentCount === renderPackage.components.length, "CROWN_WORKER_COMPONENT_COUNT_MISMATCH", "Scene component count drifted.");
  assert(scene.submeshObjectCount === componentNames.length, "CROWN_WORKER_SUBMESH_COUNT_MISMATCH", "Scene submesh count drifted.");
  assert(scene.constraintCount === renderPackage.constraints.length, "CROWN_WORKER_CONSTRAINT_COUNT_MISMATCH", "Scene constraint count drifted.");
  assert(scene.collectionCount === COLLECTION_NAMES.length, "CROWN_WORKER_COLLECTION_COUNT_MISMATCH", "Scene collection count drifted.");
  assert(scene.cameraCountDuringCapture === 2, "CROWN_WORKER_CAMERA_COUNT_MISMATCH", "QA capture must use one temporary camera beside the primary camera.");
  assertDeepEqual(scene.componentObjectNames, componentNames, "CROWN_WORKER_COMPONENT_NAMES_MISMATCH", "Scene component names/order drifted.");
  assertDeepEqual(scene.roomObjectNames, ROOM_OBJECT_NAMES, "CROWN_WORKER_ROOM_NAMES_MISMATCH", "Scene room object names drifted.");
  assertDeepEqual(scene.constraintObjectNames, constraintNames, "CROWN_WORKER_CONSTRAINT_NAMES_MISMATCH", "Scene constraint names drifted.");
  assertDeepEqual(scene.sceneObjectNames, sceneNames, "CROWN_WORKER_SCENE_NAMES_MISMATCH", "Scene object names drifted.");
}

function validatePrimaryBeautyRecord(record, primaryBeauty) {
  assertExactKeys(record, ["before", "after", "unchanged"], "INVALID_CROWN_WORKER_PRIMARY_BEAUTY_SHAPE");
  for (const side of ["before", "after"]) {
    assertExactKeys(record[side], ["bytes", "sha256"], "INVALID_CROWN_WORKER_PRIMARY_BEAUTY_RECORD");
    assert(record[side].bytes === primaryBeauty.bytes, "CROWN_WORKER_PRIMARY_BEAUTY_BYTES_MISMATCH", "Primary beauty byte count drifted.");
    assert(record[side].sha256 === primaryBeauty.sha256, "CROWN_WORKER_PRIMARY_BEAUTY_HASH_MISMATCH", "Primary beauty hash drifted.");
  }
  assert(record.unchanged === true, "CROWN_WORKER_PRIMARY_BEAUTY_CHANGED", "Primary beauty was changed during crown QA.");
}

function validateWorkerOutput(capture, output) {
  assertExactKeys(output, ["filename", "logicalObjectKey", "mimeType", "width", "height", "bytes", "sha256"], "INVALID_CROWN_WORKER_OUTPUT_SHAPE");
  assert(output.filename === CROWN_QA_DETAIL_PATHNAME, "CROWN_WORKER_OUTPUT_FILENAME_MISMATCH", "Crown output filename drifted.");
  assert(output.logicalObjectKey === `${capture.captureKey}/${CROWN_QA_DETAIL_PATHNAME}`, "CROWN_WORKER_OUTPUT_KEY_MISMATCH", "Crown output object key drifted.");
  assert(output.mimeType === "image/webp", "CROWN_WORKER_OUTPUT_MIME_MISMATCH", "Crown output MIME type drifted.");
  assert(output.width === capture.camera.resolution.width && output.height === capture.camera.resolution.height, "CROWN_WORKER_OUTPUT_DIMENSIONS_MISMATCH", "Crown output dimensions drifted.");
  assert(Number.isSafeInteger(output.bytes) && output.bytes > 0 && output.bytes <= capture.render.output.maxBytes, "CROWN_WORKER_OUTPUT_BYTES_INVALID", "Crown output byte count is invalid.");
  assert(/^[a-f0-9]{64}$/.test(String(output.sha256 || "")), "CROWN_WORKER_OUTPUT_HASH_INVALID", "Crown output SHA-256 is invalid.");
}

async function assertExecutable(blenderExecutable, workerPath) {
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
      rejectProcess(new CrownQaRunnerError("BLENDER_START_FAILED", `Blender could not be started: ${error.message}`));
      return;
    }
    child.once("error", (error) => rejectProcess(new CrownQaRunnerError("BLENDER_START_FAILED", `Blender could not be started: ${error.message}`)));
    child.once("exit", (code, signal) => {
      if (code === 0 && signal === null) resolveProcess();
      else rejectProcess(new CrownQaRunnerError("BLENDER_WORKER_FAILED", signal ? `Blender was terminated by signal ${signal}.` : `Blender exited with status ${code}.`));
    });
  });
}

async function currentCommit() {
  const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: REPOSITORY_ROOT, encoding: "utf8" });
  return stdout.trim();
}

async function readJson(path, label) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new CrownQaRunnerError("INVALID_JSON_FILE", `Could not read ${label} at ${path}: ${error.message}`);
  }
}

function maximumBoundsDelta(actual, expected) {
  return Math.max(...["min", "max"].flatMap((side) => ["x", "y", "z"].map((axis) => Math.abs(actual[side][axis] - expected[side][axis]))));
}

function assertFiniteBounds(value, label) {
  assert(value?.min && value?.max && ["x", "y", "z"].every((axis) => Number.isFinite(value.min[axis]) && Number.isFinite(value.max[axis]) && value.max[axis] > value.min[axis]), "INVALID_CROWN_WORKER_BOUNDS", `${label} has invalid bounds.`);
}

function roundMetric(value) {
  const rounded = Math.round(value * 1e12) / 1e12;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function assertBasename(path, directory, expectedName) {
  assert(path === join(directory, expectedName), "INVALID_CROWN_QA_OUTPUT_PATH", `Crown QA path must be ${join(directory, expectedName)}.`);
}

function absolutePath(path, baseDirectory) {
  return isAbsolute(path) ? path : resolve(baseDirectory, path);
}

function assertDeepEqual(actual, expected, code, message) {
  assert(stableStringify(actual) === stableStringify(expected), code, message);
}

function assertExactKeys(value, expectedKeys, code) {
  assert(value && typeof value === "object" && !Array.isArray(value), code, "Expected a strict JSON object.");
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  assert(actual.length === expected.length && actual.every((key, index) => key === expected[index]), code, `Expected keys ${expected.join(", ")}; received ${actual.join(", ")}.`);
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function assert(condition, code, message, details = []) {
  if (!condition) throw new CrownQaRunnerError(code, message, details);
}

async function main() {
  const result = await runCrownQa();
  console.log(JSON.stringify({
    status: "succeeded",
    classification: result.diagnostic.classification,
    primaryRenderKey: result.renderPackage.renderKey,
    captureKey: result.capture.captureKey,
    crownDetail: result.diagnostic.outputs.crownDetail,
    diagnosticPath: result.diagnosticPath
  }, null, 2));
}

const entryPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (entryPath === import.meta.url) {
  main().catch((error) => {
    const code = error?.code ? ` [${error.code}]` : "";
    console.error(`Blender crown QA failed${code}: ${error?.message || error}`);
    if (Array.isArray(error?.details) && error.details.length) console.error(JSON.stringify(error.details, null, 2));
    process.exitCode = 1;
  });
}
