#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { validateGuidedBlenderRenderPackage } from "../../guided-blender-render-contract.js";
import {
  createVerifiedClayRenderPackage,
  DEFAULT_OUTPUT_DIRECTORY,
  readWebpDimensions,
  resolveBlenderExecutable
} from "./run-clay-worker.mjs";
import {
  createGuidedBlenderMaterialPackage,
  deterministicJson,
  validateGuidedBlenderMaterialPackage
} from "./materials-preview-contract.mjs";
import {
  MATERIALS_PACKAGE_FILENAME,
  MATERIALS_PREVIEW_BLEND_FILENAME,
  MATERIALS_PREVIEW_FILENAME,
  MATERIALS_PREVIEW_REPORT_FILENAME,
  MATERIALS_PREVIEW_RESULT_FILENAME,
  probeBlenderRuntime,
  validateMaterialsPreviewOutputs
} from "./run-materials-preview.mjs";
import {
  PHOTOREAL_PRESENTATION_PIPELINE_VERSION,
  createGuidedBlenderPhotorealPresentationPackage,
  hashCanonical,
  validateGuidedBlenderPhotorealPresentationPackage,
  validateGuidedBlenderPhotorealPresentationResult
} from "./photoreal-presentation-contract.mjs";

const MODULE_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(MODULE_DIRECTORY, "../..");

export const PHOTOREAL_PRESENTATION_WORKER_PATH = join(
  MODULE_DIRECTORY,
  "photoreal_presentation_worker.py"
);
export const PHOTOREAL_PRESENTATION_OUTPUT_DIRECTORY = DEFAULT_OUTPUT_DIRECTORY;
export const PRESENTATION_PACKAGE_FILENAME = "presentation-package.json";
export const PHOTOREAL_MASTER_FILENAME = "photoreal-beauty-master.png";
export const PHOTOREAL_BEAUTY_FILENAME = "photoreal-beauty.webp";
export const PHOTOREAL_RESULT_FILENAME = "photoreal-beauty-result.json";
export const PHOTOREAL_REPORT_FILENAME = "photoreal-beauty-report.json";
export const PHOTOREAL_BLEND_FILENAME = "TV01-photoreal-beauty.blend";
export const EXPECTED_PRESENTATION_REPORT_SHA256 = "b3a96efaae215cfa2b70b8f16ad0b7d329dc6c482659579593437bc981b04a04";

const PHASE6_REQUIRED_FILES = Object.freeze([
  "render-package.json",
  "TV01-clay.blend",
  "beauty.webp",
  "result.json",
  "crown-detail.webp",
  "crown-diagnostic.json",
  "crown-qa-capture.json",
  MATERIALS_PACKAGE_FILENAME,
  MATERIALS_PREVIEW_FILENAME,
  MATERIALS_PREVIEW_RESULT_FILENAME,
  MATERIALS_PREVIEW_REPORT_FILENAME,
  MATERIALS_PREVIEW_BLEND_FILENAME
]);
const PRESENTATION_OUTPUT_FILES = new Set([
  PRESENTATION_PACKAGE_FILENAME,
  PHOTOREAL_MASTER_FILENAME,
  PHOTOREAL_BEAUTY_FILENAME,
  PHOTOREAL_RESULT_FILENAME,
  PHOTOREAL_REPORT_FILENAME,
  PHOTOREAL_BLEND_FILENAME
]);
const PHASE6_PINNED_DIGESTS = Object.freeze({
  "beauty.webp": "ae544cc51ed2a06377fd7cc7d433fe27309c0eb97cccffecfc5ad2c7f4af0d5b",
  "crown-detail.webp": "c30b1de091024e330448eced13ab09887e994f7bf41ee7355a95e62748ab3429",
  [MATERIALS_PACKAGE_FILENAME]: "290ce873984977396ae8fabc37572e22b8d51f110ae3db7051b6daa69be66cf5",
  [MATERIALS_PREVIEW_FILENAME]: "61504a822032c55d0f478746c80e5e6e76f13d03fc776db67935a5b63aa935ae",
  [MATERIALS_PREVIEW_RESULT_FILENAME]: "30bf1bf1198f32555a1b1e7649fa07047cacd6e19640a606dde609e0cdab98d5",
  [MATERIALS_PREVIEW_REPORT_FILENAME]: "56d1c2eea24884f61d496442fcdc31588687a0865163255f98bd19dc3c5cc126"
});
const MAX_BLEND_BYTES = 256 * 1024 * 1024;
const MAX_MASTER_BYTES = 256 * 1024 * 1024;
const MAX_BEAUTY_BYTES = 64 * 1024 * 1024;
const SHA256_RE = /^[a-f0-9]{64}$/;

export class PhotorealPresentationRunnerError extends Error {
  constructor(code, message, details = []) {
    super(message);
    this.name = "PhotorealPresentationRunnerError";
    this.code = code;
    this.details = details;
  }
}

export async function runPhotorealPresentation(options = {}) {
  const outputDirectory = absolutePath(
    options.outputDirectory || PHOTOREAL_PRESENTATION_OUTPUT_DIRECTORY,
    process.cwd()
  );
  await mkdir(outputDirectory, { recursive: true });
  const foundationBefore = await snapshotPhase6Foundation(outputDirectory);
  const generated = await createVerifiedClayRenderPackage({ fixturePath: options.fixturePath });
  const geometryValidation = await validateGuidedBlenderRenderPackage(generated.renderPackage);
  assert(
    geometryValidation.valid,
    "GEOMETRY_PACKAGE_VALIDATION_FAILED",
    "Fresh authoritative geometry package validation failed.",
    geometryValidation.errors
  );

  const sourcePaths = createSourcePaths(outputDirectory);
  assert(
    generated.packageJson === await readFile(sourcePaths.geometryPackage, "utf8"),
    "PHASE6_GEOMETRY_PACKAGE_DRIFT",
    "The stored geometry package differs from fresh authoritative regeneration."
  );
  const blenderExecutable = resolveBlenderExecutable(options.environment || process.env);
  const workerPath = absolutePath(
    options.workerPath || PHOTOREAL_PRESENTATION_WORKER_PATH,
    process.cwd()
  );
  await assertLocalInputs(blenderExecutable, workerPath, sourcePaths.materialsBlend);
  const blenderRuntime = options.blenderRuntime || await probeBlenderRuntime(blenderExecutable, {
    environment: options.environment || process.env,
    spawnImplementation: options.spawnImplementation || spawn
  });

  const storedMaterialPackage = JSON.parse(await readFile(sourcePaths.materialPackage, "utf8"));
  const regeneratedMaterialPackage = createGuidedBlenderMaterialPackage(generated.renderPackage, {
    primaryPackageJson: generated.packageJson,
    blenderRuntime
  });
  const materialValidation = validateGuidedBlenderMaterialPackage(
    generated.renderPackage,
    storedMaterialPackage,
    { primaryPackageJson: generated.packageJson }
  );
  assert(
    materialValidation.valid,
    "PHASE6_MATERIAL_PACKAGE_INVALID",
    "The stored Phase 6 material package is invalid.",
    materialValidation.errors
  );
  assert(
    deterministicJson(storedMaterialPackage) === deterministicJson(regeneratedMaterialPackage),
    "PHASE6_MATERIAL_PACKAGE_DRIFT",
    "The stored Phase 6 material package differs from fresh deterministic regeneration."
  );

  const phase6Verified = await validateMaterialsPreviewOutputs(
    generated.renderPackage,
    storedMaterialPackage,
    {
      materialPackage: sourcePaths.materialPackage,
      preview: sourcePaths.materialsPreview,
      result: sourcePaths.materialsResult,
      report: sourcePaths.materialsReport,
      previewBlend: sourcePaths.materialsBlend
    }
  );
  const presentationPackage = createGuidedBlenderPhotorealPresentationPackage(
    generated.renderPackage,
    storedMaterialPackage,
    phase6Verified.report,
    { blenderRuntime }
  );
  const presentationValidation = validateGuidedBlenderPhotorealPresentationPackage(
    generated.renderPackage,
    storedMaterialPackage,
    phase6Verified.report,
    presentationPackage,
    { blenderRuntime }
  );
  assert(
    presentationValidation.valid,
    "PRESENTATION_PACKAGE_INVALID",
    "The generated Phase 7 presentation package is invalid.",
    presentationValidation.errors
  );

  const temporaryDirectory = await mkdtemp(join(tmpdir(), "jq-photoreal-presentation-"));
  try {
    const temporaryPaths = createOutputPaths(temporaryDirectory);
    await writeFile(temporaryPaths.geometryPackage, generated.packageJson, "utf8");
    await writeFile(
      temporaryPaths.materialPackage,
      deterministicJson(storedMaterialPackage),
      "utf8"
    );
    await writeFile(
      temporaryPaths.presentationPackage,
      deterministicJson(presentationPackage),
      "utf8"
    );
    assert(
      (await readdir(temporaryDirectory)).sort().join("|")
        === ["render-package.json", MATERIALS_PACKAGE_FILENAME, PRESENTATION_PACKAGE_FILENAME]
          .sort().join("|"),
      "TEMPORARY_OUTPUT_NOT_FRESH",
      "The isolated presentation directory contained stale output."
    );

    await runProcess(blenderExecutable, [
      "--background",
      "--factory-startup",
      "--python",
      workerPath,
      "--",
      "--geometry-package", temporaryPaths.geometryPackage,
      "--materials-package", temporaryPaths.materialPackage,
      "--presentation-package", temporaryPaths.presentationPackage,
      "--source-blend", sourcePaths.materialsBlend,
      "--output-dir", temporaryDirectory,
      "--blend", temporaryPaths.blend,
      "--master", temporaryPaths.master,
      "--beauty", temporaryPaths.beauty,
      "--result", temporaryPaths.result,
      "--report", temporaryPaths.report,
      "--project-root", PROJECT_ROOT
    ], {
      cwd: PROJECT_ROOT,
      environment: options.environment || process.env,
      spawnImplementation: options.spawnImplementation || spawn,
      inherit: true
    });

    const verified = await validatePhotorealPresentationOutputs(
      generated.renderPackage,
      storedMaterialPackage,
      phase6Verified.report,
      presentationPackage,
      { ...temporaryPaths, sourceBlend: sourcePaths.materialsBlend }
    );
    await assertPhase6FoundationUnchanged(outputDirectory, foundationBefore);

    const finalPaths = createOutputPaths(outputDirectory);
    for (const key of ["presentationPackage", "master", "beauty", "result", "report", "blend"]) {
      await copyFile(temporaryPaths[key], finalPaths[key]);
    }
    const finalVerified = await validatePhotorealPresentationOutputs(
      generated.renderPackage,
      storedMaterialPackage,
      phase6Verified.report,
      presentationPackage,
      { ...finalPaths, sourceBlend: sourcePaths.materialsBlend }
    );
    assert(
      deterministicJson(finalVerified.result) === deterministicJson(verified.result)
        && deterministicJson(finalVerified.report) === deterministicJson(verified.report)
        && finalVerified.master.sha256 === verified.master.sha256
        && finalVerified.beauty.sha256 === verified.beauty.sha256,
      "PUBLISHED_OUTPUT_MISMATCH",
      "Published Phase 7 outputs differ from the verified isolated outputs."
    );
    await assertPhase6FoundationUnchanged(outputDirectory, foundationBefore);

    return Object.freeze({
      blenderExecutable,
      blenderRuntime: Object.freeze({ ...blenderRuntime }),
      outputDirectory,
      presentationPackage,
      presentationPackagePath: finalPaths.presentationPackage,
      masterPath: finalPaths.master,
      beautyPath: finalPaths.beauty,
      resultPath: finalPaths.result,
      reportPath: finalPaths.report,
      blendPath: finalPaths.blend,
      ...finalVerified,
      phase6FoundationPreserved: true,
      freshIsolatedRun: true
    });
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

export async function validatePhotorealPresentationOutputs(
  geometryPackage,
  materialPackage,
  phase6Report,
  expectedPackage,
  paths
) {
  const serializedPackage = JSON.parse(await readFile(paths.presentationPackage, "utf8"));
  const packageValidation = validateGuidedBlenderPhotorealPresentationPackage(
    geometryPackage,
    materialPackage,
    phase6Report,
    serializedPackage,
    { blenderRuntime: serializedPackage.capture?.blenderRuntime }
  );
  assert(packageValidation.valid, "SERIALIZED_PRESENTATION_PACKAGE_INVALID", "Serialized Phase 7 package failed validation.", packageValidation.errors);
  assert(
    deterministicJson(serializedPackage) === deterministicJson(expectedPackage),
    "NON_DETERMINISTIC_PRESENTATION_PACKAGE",
    "Serialized presentation package differs from deterministic generation."
  );
  const result = JSON.parse(await readFile(paths.result, "utf8"));
  const resultValidation = validateGuidedBlenderPhotorealPresentationResult(serializedPackage, result);
  assert(resultValidation.valid, "PRESENTATION_RESULT_INVALID", "Phase 7 result manifest failed validation.", resultValidation.errors);
  const [master, beauty] = await Promise.all([
    verifyPngOutput(paths.master, serializedPackage.capture.outputs[0], result.outputs[0]),
    verifyWebpOutput(paths.beauty, serializedPackage.capture.outputs[1], result.outputs[1])
  ]);
  assert(master.sha256 !== beauty.sha256, "PRESENTATION_OUTPUT_COLLISION", "Master and WebP outputs unexpectedly match.");
  assert(
    beauty.sha256 !== PHASE6_PINNED_DIGESTS[MATERIALS_PREVIEW_FILENAME]
      && beauty.sha256 !== PHASE6_PINNED_DIGESTS["beauty.webp"],
    "STALE_PHASE6_IMAGE_REUSED",
    "Phase 7 reused a Phase 5/6 image instead of rendering."
  );
  const report = JSON.parse(await readFile(paths.report, "utf8"));
  assert(typeof paths.sourceBlend === "string", "PRESENTATION_SOURCE_BLEND_REQUIRED", "Phase 7 output validation requires the exact Phase 6 source blend path.");
  const sourceBlendSha256 = createHash("sha256")
    .update(await readFile(paths.sourceBlend))
    .digest("hex");
  validatePhotorealPresentationReport(
    report,
    serializedPackage,
    result,
    master,
    beauty,
    sourceBlendSha256
  );
  const blendMetadata = await stat(paths.blend);
  assert(
    blendMetadata.isFile() && blendMetadata.size > 0 && blendMetadata.size <= MAX_BLEND_BYTES,
    "PRESENTATION_BLEND_INVALID",
    "The photoreal beauty blend is missing or invalid."
  );
  return Object.freeze({
    result,
    report,
    master,
    beauty,
    blend: Object.freeze({ path: paths.blend, bytes: blendMetadata.size })
  });
}

export function validatePhotorealPresentationReport(
  report,
  presentationPackage,
  result,
  master,
  beauty,
  expectedSourceBlendSha256
) {
  const expectedKeys = [
    "kind", "schemaVersion", "status", "blenderRuntime", "presentationPackageKey",
    "captureKey", "presentationPipelineVersion", "resultKey", "source", "parity",
    "presentation", "counts", "outputs"
  ].sort();
  assert(
    report && typeof report === "object" && !Array.isArray(report)
      && Object.keys(report).sort().join("|") === expectedKeys.join("|"),
    "PRESENTATION_REPORT_SCHEMA_INVALID",
    "Phase 7 worker report has unknown or missing fields."
  );
  assert(report.kind === "jq-local-blender-photoreal-beauty-report" && report.schemaVersion === 1 && report.status === "succeeded", "PRESENTATION_REPORT_IDENTITY_INVALID", "Phase 7 report identity is invalid.");
  assert(SHA256_RE.test(expectedSourceBlendSha256), "PRESENTATION_SOURCE_BLEND_DIGEST_INVALID", "Expected source blend SHA-256 is missing or invalid.");
  assert(deepEqual(report.blenderRuntime, presentationPackage.capture.blenderRuntime), "PRESENTATION_REPORT_RUNTIME_MISMATCH", "Worker Blender runtime differs from the package.");
  assert(report.presentationPackageKey === presentationPackage.presentationPackageKey, "PRESENTATION_REPORT_PACKAGE_KEY_MISMATCH", "Worker package key drifted.");
  assert(report.captureKey === presentationPackage.capture.captureKey, "PRESENTATION_REPORT_CAPTURE_KEY_MISMATCH", "Worker capture key drifted.");
  assert(report.presentationPipelineVersion === PHOTOREAL_PRESENTATION_PIPELINE_VERSION, "PRESENTATION_REPORT_PIPELINE_MISMATCH", "Worker pipeline version drifted.");
  assert(report.resultKey === result.resultKey, "PRESENTATION_REPORT_RESULT_KEY_MISMATCH", "Worker result key drifted.");
  const foundation = presentationPackage.phase6Foundation;
  assert(deepEqual(report.source, {
    blendSha256: expectedSourceBlendSha256,
    geometry: {
      boundsSha256: foundation.digests.boundsSha256,
      geometrySha256: foundation.digests.geometrySha256,
      topologySha256: foundation.digests.topologySha256,
      transformSha256: foundation.digests.transformsSha256
    },
    heroCameraSha256: foundation.digests.cameraSha256,
    materialCaptureKey: foundation.materialCaptureKey,
    materialPackageKey: foundation.materialPackageKey,
    renderSettingsSha256: foundation.digests.renderSettingsSha256,
    shaderParametersSha256: foundation.digests.shaderParametersSha256,
    worldSha256: foundation.digests.worldSha256
  }), "PRESENTATION_REPORT_SOURCE_MISMATCH", "Worker source evidence differs from the exact Phase 6 foundation.");
  assert(deepEqual(report.parity, {
    bounds: true,
    geometry: true,
    phase6Camera: true,
    phase6ShaderParameters: true,
    phase6World: true,
    productMaterials: true,
    sourceBlendFile: true,
    topology: true,
    transforms: true
  }), "PRESENTATION_REPORT_PARITY_FAILED", "A Phase 6 preservation audit is missing or failed.");
  assert(
    hashCanonical(report.presentation) === EXPECTED_PRESENTATION_REPORT_SHA256,
    "PRESENTATION_REPORT_SCENE_MISMATCH",
    "The observed Blender camera, lights, room, world, devices, or render settings drifted."
  );
  assert(deepEqual(report.outputs, result.outputs), "PRESENTATION_REPORT_OUTPUT_MISMATCH", "Worker report and result outputs differ.");
  assert(report.outputs[0].sha256 === master.sha256 && report.outputs[1].sha256 === beauty.sha256, "PRESENTATION_REPORT_OUTPUT_MISMATCH", "Worker report output hashes differ from actual files.");
  assert(deepEqual(report.counts, {
    objects: 93,
    meshObjects: 87,
    meshes: 87,
    cameras: 2,
    lights: 4,
    collections: 6,
    modifiers: 0,
    materials: 72
  }), "PRESENTATION_REPORT_COUNT_MISMATCH", "Beauty scene entity counts drifted.");
  assert(report.presentation.camera.cameraId === presentationPackage.presentation.camera.cameraId, "PRESENTATION_REPORT_CAMERA_MISMATCH", "Beauty camera identity drifted.");
  assert(Array.isArray(report.presentation.lights) && report.presentation.lights.length === 4, "PRESENTATION_REPORT_LIGHT_MISMATCH", "Beauty light rig drifted.");
  assert(Object.keys(report.presentation.roomAssignments).sort().join("|") === "room-floor|room-rear-wall", "PRESENTATION_REPORT_ROOM_MISMATCH", "Room material assignment coverage drifted.");
  assert(report.presentation.render.engine === "CYCLES", "PRESENTATION_REPORT_RENDER_MISMATCH", "Beauty render did not use Cycles.");
  return true;
}

export function readPngDimensions(bytes) {
  assert(Buffer.isBuffer(bytes), "PNG_INPUT_INVALID", "PNG input must be a buffer.");
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert(bytes.length >= 24 && bytes.subarray(0, 8).equals(signature), "PNG_SIGNATURE_INVALID", "Master output is not a PNG.");
  assert(bytes.toString("ascii", 12, 16) === "IHDR", "PNG_IHDR_MISSING", "Master PNG is missing IHDR.");
  return Object.freeze({ width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) });
}

async function verifyPngOutput(path, contract, resultOutput) {
  const bytes = await readFile(path);
  const dimensions = readPngDimensions(bytes);
  return verifyOutputIntegrity(path, bytes, dimensions, contract, resultOutput, MAX_MASTER_BYTES);
}

async function verifyWebpOutput(path, contract, resultOutput) {
  const bytes = await readFile(path);
  const dimensions = readWebpDimensions(bytes);
  return verifyOutputIntegrity(path, bytes, dimensions, contract, resultOutput, MAX_BEAUTY_BYTES);
}

function verifyOutputIntegrity(path, bytes, dimensions, contract, resultOutput, absoluteMaximum) {
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  assert(dimensions.width === contract.width && dimensions.height === contract.height, "PRESENTATION_OUTPUT_DIMENSIONS_MISMATCH", "Actual output dimensions differ from the capture contract.");
  assert(resultOutput.width === dimensions.width && resultOutput.height === dimensions.height, "PRESENTATION_RESULT_DIMENSIONS_MISMATCH", "Result dimensions differ from the actual file.");
  assert(resultOutput.bytes === bytes.length && resultOutput.sha256 === sha256, "PRESENTATION_RESULT_INTEGRITY_MISMATCH", "Result bytes or SHA-256 differ from the actual file.");
  assert(resultOutput.pass === contract.pass && resultOutput.mimeType === contract.mimeType, "PRESENTATION_RESULT_OUTPUT_CONTRACT_MISMATCH", "Result output identity differs from the contract.");
  assert(resultOutput.objectKey === `${contract.captureKey || ""}${contract.captureKey ? "/" : ""}${contract.filename}` || resultOutput.objectKey.endsWith(`/${contract.filename}`), "PRESENTATION_RESULT_OBJECT_KEY_MISMATCH", "Result object key is invalid.");
  assert(bytes.length > 0 && bytes.length <= Math.min(contract.maxBytes, absoluteMaximum), "PRESENTATION_OUTPUT_SIZE_INVALID", "Output byte count is invalid.");
  return Object.freeze({ path, width: dimensions.width, height: dimensions.height, bytes: bytes.length, sha256 });
}

async function snapshotPhase6Foundation(outputDirectory) {
  const entries = await readdir(outputDirectory, { withFileTypes: true });
  const presentFiles = new Set(entries.filter((entry) => entry.isFile()).map((entry) => entry.name));
  for (const filename of PHASE6_REQUIRED_FILES) {
    assert(presentFiles.has(filename), "PHASE6_ARTIFACT_MISSING", `Required Phase 6 artifact is missing: ${filename}.`);
  }
  const snapshot = {};
  for (const entry of entries) {
    if (!entry.isFile() || PRESENTATION_OUTPUT_FILES.has(entry.name)) continue;
    const path = join(outputDirectory, entry.name);
    const bytes = await readFile(path);
    snapshot[entry.name] = Object.freeze({
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex")
    });
  }
  for (const [filename, expectedSha256] of Object.entries(PHASE6_PINNED_DIGESTS)) {
    assert(snapshot[filename]?.sha256 === expectedSha256, "PHASE6_ARTIFACT_DRIFT", `Accepted Phase 6 artifact drifted: ${filename}.`);
  }
  return Object.freeze(snapshot);
}

async function assertPhase6FoundationUnchanged(outputDirectory, expected) {
  const actual = await snapshotPhase6Foundation(outputDirectory);
  assert(deepEqual(actual, expected), "PHASE6_ARTIFACT_MUTATION", "Phase 7 changed a pre-existing Phase 6 artifact.");
}

function createSourcePaths(directory) {
  return Object.freeze({
    geometryPackage: join(directory, "render-package.json"),
    materialPackage: join(directory, MATERIALS_PACKAGE_FILENAME),
    materialsPreview: join(directory, MATERIALS_PREVIEW_FILENAME),
    materialsResult: join(directory, MATERIALS_PREVIEW_RESULT_FILENAME),
    materialsReport: join(directory, MATERIALS_PREVIEW_REPORT_FILENAME),
    materialsBlend: join(directory, MATERIALS_PREVIEW_BLEND_FILENAME)
  });
}

function createOutputPaths(directory) {
  return Object.freeze({
    geometryPackage: join(directory, "render-package.json"),
    materialPackage: join(directory, MATERIALS_PACKAGE_FILENAME),
    presentationPackage: join(directory, PRESENTATION_PACKAGE_FILENAME),
    master: join(directory, PHOTOREAL_MASTER_FILENAME),
    beauty: join(directory, PHOTOREAL_BEAUTY_FILENAME),
    result: join(directory, PHOTOREAL_RESULT_FILENAME),
    report: join(directory, PHOTOREAL_REPORT_FILENAME),
    blend: join(directory, PHOTOREAL_BLEND_FILENAME)
  });
}

async function assertLocalInputs(blenderExecutable, workerPath, sourceBlend) {
  await access(workerPath, fsConstants.R_OK);
  await access(sourceBlend, fsConstants.R_OK);
  if (isAbsolute(blenderExecutable) || blenderExecutable.includes("/")) {
    await access(absolutePath(blenderExecutable, process.cwd()), fsConstants.X_OK);
  }
}

async function runProcess(executable, args, options) {
  return await new Promise((resolveProcess, rejectProcess) => {
    let child;
    try {
      child = options.spawnImplementation(executable, args, {
        cwd: options.cwd,
        env: options.environment,
        stdio: options.inherit ? "inherit" : ["ignore", "pipe", "pipe"]
      });
    } catch (error) {
      rejectProcess(new PhotorealPresentationRunnerError("BLENDER_START_FAILED", `Blender could not be started: ${error.message}`));
      return;
    }
    let stdout = "";
    let stderr = "";
    if (!options.inherit) {
      child.stdout?.on("data", (chunk) => { stdout += chunk; });
      child.stderr?.on("data", (chunk) => { stderr += chunk; });
    }
    child.once("error", (error) => rejectProcess(new PhotorealPresentationRunnerError("BLENDER_START_FAILED", `Blender could not be started: ${error.message}`)));
    child.once("exit", (code, signal) => {
      if (code === 0 && signal === null) {
        resolveProcess({ stdout, stderr });
        return;
      }
      rejectProcess(new PhotorealPresentationRunnerError(
        "BLENDER_PHOTOREAL_WORKER_FAILED",
        signal ? `Blender was terminated by signal ${signal}.` : `Blender exited with status ${code}.`,
        stderr ? [stderr] : []
      ));
    });
  });
}

function absolutePath(path, baseDirectory) {
  return isAbsolute(path) ? path : resolve(baseDirectory, path);
}

function deepEqual(left, right) {
  return deterministicJson(left) === deterministicJson(right);
}

function assert(condition, code, message, details = []) {
  if (!condition) throw new PhotorealPresentationRunnerError(code, message, details);
}

async function main() {
  const result = await runPhotorealPresentation();
  console.log(JSON.stringify({
    status: "succeeded",
    presentationPackageKey: result.presentationPackage.presentationPackageKey,
    captureKey: result.presentationPackage.capture.captureKey,
    master: result.master,
    beauty: result.beauty,
    blendPath: result.blendPath,
    resultPath: result.resultPath,
    reportPath: result.reportPath,
    phase6FoundationPreserved: result.phase6FoundationPreserved,
    freshIsolatedRun: result.freshIsolatedRun
  }, null, 2));
}

const entryPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (entryPath === import.meta.url) {
  main().catch((error) => {
    const code = error?.code ? ` [${error.code}]` : "";
    console.error(`Blender photoreal presentation failed${code}: ${error?.message || error}`);
    if (Array.isArray(error?.details) && error.details.length) {
      console.error(JSON.stringify(error.details, null, 2));
    }
    process.exitCode = 1;
  });
}
