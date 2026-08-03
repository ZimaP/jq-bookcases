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

import {
  createVerifiedClayRenderPackage,
  DEFAULT_BLENDER_EXECUTABLE,
  DEFAULT_OUTPUT_DIRECTORY,
  readWebpDimensions,
  resolveBlenderExecutable,
  writeDeterministicJson
} from "./run-clay-worker.mjs";
import {
  MATERIAL_PIPELINE_VERSION,
  createGuidedBlenderMaterialPackage,
  deterministicJson,
  hashCanonical,
  validateGuidedBlenderMaterialPackage,
  validateGuidedBlenderMaterialsPreviewResult
} from "./materials-preview-contract.mjs";

const MODULE_DIRECTORY = dirname(fileURLToPath(import.meta.url));

export const MATERIALS_PREVIEW_WORKER_PATH = join(MODULE_DIRECTORY, "materials_preview_worker.py");
export const MATERIALS_PREVIEW_OUTPUT_DIRECTORY = DEFAULT_OUTPUT_DIRECTORY;
export const MATERIALS_PACKAGE_FILENAME = "materials-package.json";
export const MATERIALS_PREVIEW_FILENAME = "materials-preview.webp";
export const MATERIALS_PREVIEW_RESULT_FILENAME = "materials-preview-result.json";
export const MATERIALS_PREVIEW_REPORT_FILENAME = "materials-preview-report.json";
export const MATERIALS_PREVIEW_BLEND_FILENAME = "TV01-materials-preview.blend";

const PRIMARY_ARTIFACTS = Object.freeze({
  geometryPackage: "render-package.json",
  beauty: "beauty.webp",
  result: "result.json",
  clayBlend: "TV01-clay.blend",
  crownDetail: "crown-detail.webp"
});
const EXPECTED_BEAUTY = Object.freeze({
  width: 960,
  height: 640,
  bytes: 7400,
  sha256: "ae544cc51ed2a06377fd7cc7d433fe27309c0eb97cccffecfc5ad2c7f4af0d5b"
});
const EXPECTED_CROWN_DETAIL = Object.freeze({
  width: 960,
  height: 640,
  bytes: 9032,
  sha256: "c30b1de091024e330448eced13ab09887e994f7bf41ee7355a95e62748ab3429"
});
const RUNTIME_MARKER = "JQ_BLENDER_RUNTIME ";
const MAX_BLEND_BYTES = 256 * 1024 * 1024;
const SHA256_RE = /^[a-f0-9]{64}$/;
const RESULT_KEY_RE = /^jq-materials-preview-result-v1-[a-f0-9]{64}$/;

const REPORT_KEYS = new Set([
  "kind", "schemaVersion", "status", "blenderRuntime", "materialPackageKey",
  "captureKey", "materialPipelineVersion", "resultKey", "freshIsolatedOutput",
  "counts", "parity", "objectNames", "materialNames", "nodeNames", "linkNames",
  "digests", "materials", "output"
]);
const REPORT_RUNTIME_KEYS = new Set([
  "version", "buildHash", "backend", "vendor", "renderer", "deviceVersion"
]);
const REPORT_COUNT_KEYS = new Set([
  "productMeshObjects", "roomMeshObjects", "constraintObjects", "cameras", "lights",
  "collections", "modifiers", "materials", "nodes", "links", "bindings", "materialFrames"
]);
const REPORT_PARITY_KEYS = new Set([
  "geometry", "topology", "bounds", "transforms", "objects", "camera", "world",
  "lights", "renderSettings", "shaderParameters"
]);
const REPORT_DIGEST_KEYS = new Set([
  "geometryBeforeSha256", "geometryAfterSha256",
  "topologyBeforeSha256", "topologyAfterSha256",
  "boundsBeforeSha256", "boundsAfterSha256",
  "transformsBeforeSha256", "transformsAfterSha256",
  "cameraBeforeSha256", "cameraAfterSha256",
  "worldBeforeSha256", "worldAfterSha256",
  "renderSettingsBeforeSha256", "renderSettingsAfterSha256",
  "shaderParametersBeforeSha256", "shaderParametersAfterSha256",
  "materialsSha256", "nodesSha256", "linksSha256", "slotAssignmentsSha256"
]);
const REPORT_MATERIAL_KEYS = new Set([
  "bindingCount", "materialFrameCount", "bindingCountsByMaterial",
  "sourceMaterialDatablockCount", "createdMaterialDatablockCount",
  "totalMaterialDatablockCount", "usedMaterialNames", "nodeCount", "linkCount",
  "materialSha256", "nodeSha256", "linkSha256", "slotAssignmentSha256",
  "slotAssignments"
]);
const REPORT_ASSIGNMENT_KEYS = new Set([
  "bindingId", "objectId", "materialId", "materialFrameId", "materialName",
  "materialSlotIndex"
]);
const REPORT_OUTPUT_KEYS = new Set([
  "filename", "logicalObjectKey", "mimeType", "width", "height", "bytes", "sha256"
]);
const EXPECTED_BINDING_COUNTS = Object.freeze({
  "inherited-room-floor-clay-v1": 1,
  "inherited-room-wall-clay-v1": 1,
  "matte-black-hardware-v1": 10,
  "natural-oak-countertop-visualization-v1": 1,
  "natural-oak-visualization-v1": 64,
  "tv-black-glass-v1": 1,
  "warm-opal-puck-lens-v1": 2
});
const WOOD_MATERIAL_IDS = new Set([
  "natural-oak-countertop-visualization-v1",
  "natural-oak-visualization-v1"
]);
const ROOM_MATERIAL_NAMES = Object.freeze({
  "room-floor": "JQ_ROOM_FLOOR",
  "room-rear-wall": "JQ_ROOM_WALL"
});
const FLAT_NODE_SUFFIXES = Object.freeze(["00_OUTPUT", "10_PRINCIPLED"]);
const ROOM_NODE_SUFFIXES = Object.freeze(["Principled BSDF", "Material Output"]);
const WOOD_NODE_SUFFIXES = Object.freeze([
  "00_OUTPUT", "10_PRINCIPLED", "20_PACKAGE_WORLD_COORDINATES",
  "30_SUBTRACT_FRAME_ORIGIN", "40_DOT_CROSS_GRAIN", "41_DOT_GRAIN",
  "42_DOT_NORMAL", "50_COMBINE_CROSS_GRAIN_NORMAL", "60_PHYSICAL_SCALE_METERS",
  "70_DETERMINISTIC_PHASE", "80_COARSE_OAK_NOISE", "81_GRAIN_BANDS",
  "82_FINE_FIBER_NOISE", "90_MIX_COARSE_AND_GRAIN", "91_WEIGHTED_TONE_RANGE",
  "92_NATURAL_OAK_COLOR_RAMP", "93_SHADER_ONLY_FIBER_BUMP"
]);
const FLAT_LINK_SUFFIXES = Object.freeze([
  "10_PRINCIPLED:BSDF->00_OUTPUT:Surface"
]);
const ROOM_LINK_SUFFIXES = Object.freeze([
  "Principled BSDF:BSDF->Material Output:Surface"
]);
const WOOD_LINK_SUFFIXES = Object.freeze([
  "10_PRINCIPLED:BSDF->00_OUTPUT:Surface",
  "20_PACKAGE_WORLD_COORDINATES:Object->30_SUBTRACT_FRAME_ORIGIN:Vector",
  "30_SUBTRACT_FRAME_ORIGIN:Vector->40_DOT_CROSS_GRAIN:Vector",
  "30_SUBTRACT_FRAME_ORIGIN:Vector->41_DOT_GRAIN:Vector",
  "30_SUBTRACT_FRAME_ORIGIN:Vector->42_DOT_NORMAL:Vector",
  "40_DOT_CROSS_GRAIN:Value->50_COMBINE_CROSS_GRAIN_NORMAL:X",
  "41_DOT_GRAIN:Value->50_COMBINE_CROSS_GRAIN_NORMAL:Y",
  "42_DOT_NORMAL:Value->50_COMBINE_CROSS_GRAIN_NORMAL:Z",
  "50_COMBINE_CROSS_GRAIN_NORMAL:Vector->60_PHYSICAL_SCALE_METERS:Vector",
  "60_PHYSICAL_SCALE_METERS:Vector->70_DETERMINISTIC_PHASE:Vector",
  "70_DETERMINISTIC_PHASE:Vector->80_COARSE_OAK_NOISE:Vector",
  "70_DETERMINISTIC_PHASE:Vector->81_GRAIN_BANDS:Vector",
  "70_DETERMINISTIC_PHASE:Vector->82_FINE_FIBER_NOISE:Vector",
  "80_COARSE_OAK_NOISE:Factor->90_MIX_COARSE_AND_GRAIN:Color1",
  "81_GRAIN_BANDS:Color->90_MIX_COARSE_AND_GRAIN:Color2",
  "82_FINE_FIBER_NOISE:Factor->93_SHADER_ONLY_FIBER_BUMP:Height",
  "90_MIX_COARSE_AND_GRAIN:Color->91_WEIGHTED_TONE_RANGE:Value",
  "91_WEIGHTED_TONE_RANGE:Result->92_NATURAL_OAK_COLOR_RAMP:Factor",
  "92_NATURAL_OAK_COLOR_RAMP:Color->10_PRINCIPLED:Base Color",
  "93_SHADER_ONLY_FIBER_BUMP:Normal->10_PRINCIPLED:Normal"
]);

export class MaterialsPreviewRunnerError extends Error {
  constructor(code, message, details = []) {
    super(message);
    this.name = "MaterialsPreviewRunnerError";
    this.code = code;
    this.details = details;
  }
}

export async function runMaterialsPreview(options = {}) {
  const outputDirectory = absolutePath(
    options.outputDirectory || MATERIALS_PREVIEW_OUTPUT_DIRECTORY,
    process.cwd()
  );
  await mkdir(outputDirectory, { recursive: true });
  const primaryPaths = Object.fromEntries(Object.entries(PRIMARY_ARTIFACTS).map(([key, name]) => [
    key,
    join(outputDirectory, name)
  ]));
  const primaryBefore = await snapshotAndValidatePrimaryArtifacts(primaryPaths);

  const generated = await createVerifiedClayRenderPackage({ fixturePath: options.fixturePath });
  const geometryPackageValidation = await import("../../guided-blender-render-contract.js")
    .then(({ validateGuidedBlenderRenderPackage }) => validateGuidedBlenderRenderPackage(generated.renderPackage));
  assert(
    geometryPackageValidation.valid === true,
    "GEOMETRY_PACKAGE_VALIDATION_FAILED",
    "The regenerated Phase 5 geometry package is invalid.",
    geometryPackageValidation.errors
  );
  assert(
    generated.packageJson === await readFile(primaryPaths.geometryPackage, "utf8"),
    "PRIMARY_GEOMETRY_PACKAGE_DRIFT",
    "The local clay geometry package does not match fresh authoritative regeneration."
  );

  const blenderExecutable = resolveBlenderExecutable(options.environment || process.env);
  const workerPath = absolutePath(
    options.workerPath || MATERIALS_PREVIEW_WORKER_PATH,
    process.cwd()
  );
  await assertLocalInputs(blenderExecutable, workerPath, primaryPaths.clayBlend);
  const blenderRuntime = options.blenderRuntime || await probeBlenderRuntime(blenderExecutable, {
    environment: options.environment || process.env,
    spawnImplementation: options.spawnImplementation || spawn
  });
  const materialPackage = createGuidedBlenderMaterialPackage(generated.renderPackage, {
    primaryPackageJson: generated.packageJson,
    blenderRuntime
  });
  const materialValidation = validateGuidedBlenderMaterialPackage(
    generated.renderPackage,
    materialPackage,
    { primaryPackageJson: generated.packageJson }
  );
  assert(
    materialValidation.valid === true,
    "MATERIAL_PACKAGE_VALIDATION_FAILED",
    "The generated renderer-neutral material package is invalid.",
    materialValidation.errors
  );

  const temporaryDirectory = await mkdtemp(join(tmpdir(), "jq-materials-preview-"));
  try {
    const temporaryPaths = createOutputPaths(temporaryDirectory);
    await writeFile(temporaryPaths.geometryPackage, generated.packageJson, "utf8");
    await writeFile(temporaryPaths.materialPackage, deterministicJson(materialPackage), "utf8");
    assert(
      (await readdir(temporaryDirectory)).sort().join("|")
        === ["materials-package.json", "render-package.json"].sort().join("|"),
      "TEMPORARY_OUTPUT_NOT_FRESH",
      "The isolated material-preview directory contained stale worker output."
    );

    const workerArguments = [
      "--background",
      "--factory-startup",
      "--python",
      workerPath,
      "--",
      "--geometry-package",
      temporaryPaths.geometryPackage,
      "--materials-package",
      temporaryPaths.materialPackage,
      "--source-blend",
      primaryPaths.clayBlend,
      "--output-dir",
      temporaryDirectory,
      "--blend",
      temporaryPaths.previewBlend,
      "--preview",
      temporaryPaths.preview,
      "--result",
      temporaryPaths.result,
      "--report",
      temporaryPaths.report,
      "--project-root",
      resolve(MODULE_DIRECTORY, "../..")
    ];
    await runProcess(blenderExecutable, workerArguments, {
      cwd: resolve(MODULE_DIRECTORY, "../.."),
      environment: options.environment || process.env,
      spawnImplementation: options.spawnImplementation || spawn,
      inherit: true
    });

    const verified = await validateMaterialsPreviewOutputs(
      generated.renderPackage,
      materialPackage,
      temporaryPaths,
      primaryBefore
    );
    const primaryAfterWorker = await snapshotAndValidatePrimaryArtifacts(primaryPaths);
    assert(
      deepEqual(primaryAfterWorker, primaryBefore),
      "PRIMARY_ARTIFACT_MUTATION",
      "The material worker changed a Phase 5 clay or crown artifact."
    );

    const finalPaths = createOutputPaths(outputDirectory);
    for (const [temporaryPath, finalPath] of [
      [temporaryPaths.materialPackage, finalPaths.materialPackage],
      [temporaryPaths.preview, finalPaths.preview],
      [temporaryPaths.result, finalPaths.result],
      [temporaryPaths.report, finalPaths.report],
      [temporaryPaths.previewBlend, finalPaths.previewBlend]
    ]) {
      await copyFile(temporaryPath, finalPath);
    }
    const finalVerified = await validateMaterialsPreviewOutputs(
      generated.renderPackage,
      materialPackage,
      finalPaths,
      primaryBefore
    );
    assert(
      deterministicJson(finalVerified.result) === deterministicJson(verified.result)
        && deterministicJson(finalVerified.report) === deterministicJson(verified.report)
        && finalVerified.preview.sha256 === verified.preview.sha256,
      "PUBLISHED_OUTPUT_MISMATCH",
      "Published material outputs differ from the isolated verified outputs."
    );
    const primaryAfterPublish = await snapshotAndValidatePrimaryArtifacts(primaryPaths);
    assert(
      deepEqual(primaryAfterPublish, primaryBefore),
      "PRIMARY_ARTIFACT_MUTATION",
      "Publishing the material preview changed a Phase 5 artifact."
    );

    return Object.freeze({
      blenderExecutable,
      blenderRuntime: Object.freeze({ ...blenderRuntime }),
      outputDirectory,
      materialPackagePath: finalPaths.materialPackage,
      previewPath: finalPaths.preview,
      resultPath: finalPaths.result,
      reportPath: finalPaths.report,
      blendPath: finalPaths.previewBlend,
      materialPackage,
      result: finalVerified.result,
      report: finalVerified.report,
      preview: finalVerified.preview,
      blend: finalVerified.blend,
      primaryArtifacts: primaryAfterPublish,
      freshIsolatedRun: true
    });
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

export async function probeBlenderRuntime(blenderExecutable, options = {}) {
  const pythonExpression = [
    "import bpy,gpu,json",
    "gpu.init()",
    `print(${JSON.stringify(RUNTIME_MARKER)}+json.dumps({"version":bpy.app.version_string,"buildHash":bpy.app.build_hash.decode("utf-8"),"backend":gpu.platform.backend_type_get(),"vendor":gpu.platform.vendor_get(),"renderer":gpu.platform.renderer_get(),"deviceVersion":gpu.platform.version_get()},sort_keys=True))`
  ].join(";");
  const result = await runProcess(blenderExecutable, [
    "--background",
    "--factory-startup",
    "--python-expr",
    pythonExpression
  ], {
    cwd: resolve(MODULE_DIRECTORY, "../.."),
    environment: options.environment || process.env,
    spawnImplementation: options.spawnImplementation || spawn,
    inherit: false
  });
  const line = result.stdout.split(/\r?\n/).find((entry) => entry.startsWith(RUNTIME_MARKER));
  assert(line, "BLENDER_RUNTIME_PROBE_FAILED", "Blender did not report its deterministic runtime identity.");
  let runtime;
  try {
    runtime = JSON.parse(line.slice(RUNTIME_MARKER.length));
  } catch (error) {
    throw new MaterialsPreviewRunnerError(
      "BLENDER_RUNTIME_PROBE_FAILED",
      `Blender runtime identity was not valid JSON: ${error.message}`
    );
  }
  return Object.freeze(runtime);
}

export async function validateMaterialsPreviewOutputs(
  geometryPackage,
  materialPackage,
  paths,
  primarySnapshot = null
) {
  const serializedMaterialPackage = JSON.parse(await readFile(paths.materialPackage, "utf8"));
  const materialValidation = validateGuidedBlenderMaterialPackage(
    geometryPackage,
    serializedMaterialPackage,
    { primaryPackageJson: deterministicJson(geometryPackage) }
  );
  assert(materialValidation.valid, "SERIALIZED_MATERIAL_PACKAGE_INVALID", "Serialized material package failed validation.", materialValidation.errors);
  assert(
    deterministicJson(serializedMaterialPackage) === deterministicJson(materialPackage),
    "NON_DETERMINISTIC_MATERIAL_PACKAGE",
    "Serialized material package differs from the generated canonical package."
  );

  const result = JSON.parse(await readFile(paths.result, "utf8"));
  const resultValidation = validateGuidedBlenderMaterialsPreviewResult(materialPackage, result);
  assert(resultValidation.valid, "MATERIAL_RESULT_VALIDATION_FAILED", "Material preview result failed validation.", resultValidation.errors);
  const preview = await verifyMaterialsPreviewIntegrity(materialPackage, result, paths.preview);
  if (primarySnapshot) {
    assert(
      preview.sha256 !== primarySnapshot.beauty.sha256,
      "STALE_CLAY_IMAGE_REUSED",
      "materials-preview.webp is byte-identical to the clay beauty."
    );
  }
  const blend = await verifyBlend(paths.previewBlend);
  const report = JSON.parse(await readFile(paths.report, "utf8"));
  validateMaterialsPreviewReport(
    report,
    geometryPackage,
    serializedMaterialPackage,
    result,
    preview
  );
  return Object.freeze({ result, resultValidation, preview, blend, report });
}

export async function verifyMaterialsPreviewIntegrity(materialPackage, result, previewPath) {
  const bytes = await readFile(previewPath);
  const dimensions = readWebpDimensions(bytes);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const output = result.outputs[0];
  const contract = materialPackage.capture.output;
  assert(dimensions.width === contract.width && dimensions.height === contract.height, "MATERIAL_PREVIEW_DIMENSIONS_MISMATCH", "Material preview dimensions drifted.");
  assert(output.width === dimensions.width && output.height === dimensions.height, "MATERIAL_RESULT_DIMENSIONS_MISMATCH", "Result dimensions do not match the actual WebP.");
  assert(output.bytes === bytes.length, "MATERIAL_RESULT_BYTES_MISMATCH", "Result byte count does not match the actual WebP.");
  assert(output.sha256 === sha256, "MATERIAL_RESULT_SHA256_MISMATCH", "Result SHA-256 does not match the actual WebP.");
  assert(bytes.length > 0 && bytes.length <= contract.maxBytes, "MATERIAL_PREVIEW_SIZE_INVALID", "Material preview byte count is invalid.");
  return Object.freeze({ path: previewPath, width: dimensions.width, height: dimensions.height, bytes: bytes.length, sha256 });
}

export function validateMaterialsPreviewReport(
  report,
  geometryPackage,
  materialPackage,
  result,
  preview
) {
  exactReportKeys(report, REPORT_KEYS, "report");
  assert(report.kind === "jq-local-blender-materials-preview-report", "MATERIAL_REPORT_KIND_MISMATCH", "Material preview report kind is invalid.");
  assert(report.schemaVersion === 1, "MATERIAL_REPORT_SCHEMA_MISMATCH", "Material preview report schema is invalid.");
  assert(report.status === "succeeded", "MATERIAL_REPORT_STATUS_MISMATCH", "Material preview report status is invalid.");
  exactReportKeys(report.blenderRuntime, REPORT_RUNTIME_KEYS, "report.blenderRuntime");
  assert(deepEqual(report.blenderRuntime, materialPackage.capture.blenderRuntime), "MATERIAL_REPORT_RUNTIME_MISMATCH", "Material report Blender runtime drifted from the capture contract.");
  assert(report.materialPackageKey === materialPackage.materialPackageKey, "MATERIAL_REPORT_PACKAGE_KEY_MISMATCH", "Material report package key drifted.");
  assert(report.captureKey === materialPackage.capture.captureKey, "MATERIAL_REPORT_CAPTURE_KEY_MISMATCH", "Material report capture key drifted.");
  assert(report.materialPipelineVersion === MATERIAL_PIPELINE_VERSION, "MATERIAL_REPORT_PIPELINE_MISMATCH", "Material report pipeline version drifted.");
  assert(RESULT_KEY_RE.test(report.resultKey) && report.resultKey === result.resultKey, "MATERIAL_REPORT_RESULT_KEY_MISMATCH", "Material report result identity drifted.");
  assert(report.freshIsolatedOutput === true, "MATERIAL_REPORT_NOT_FRESH", "Worker did not prove fresh isolated output.");

  exactReportKeys(report.counts, REPORT_COUNT_KEYS, "report.counts");
  const expectedCounts = {
    productMeshObjects: 78,
    roomMeshObjects: 2,
    constraintObjects: 7,
    cameras: 1,
    lights: 0,
    collections: 4,
    modifiers: 0,
    materials: 70,
    nodes: 1115,
    links: 1305,
    bindings: 80,
    materialFrames: 65
  };
  assert(deepEqual(report.counts, expectedCounts), "MATERIAL_REPORT_COUNT_MISMATCH", "Material report scene, material, node, link, binding, or frame counts drifted.");

  exactReportKeys(report.parity, REPORT_PARITY_KEYS, "report.parity");
  assert(Object.values(report.parity).every((value) => value === true), "MATERIAL_REPORT_PARITY_FLAG_MISMATCH", "Material report parity flags must all be true.");

  exactReportKeys(report.digests, REPORT_DIGEST_KEYS, "report.digests");
  for (const [key, value] of Object.entries(report.digests)) {
    assert(SHA256_RE.test(value), "MATERIAL_REPORT_DIGEST_INVALID", `Material report digest ${key} is malformed.`);
  }
  for (const prefix of [
    "geometry", "topology", "bounds", "transforms", "camera", "world", "renderSettings",
    "shaderParameters"
  ]) {
    assert(
      report.digests[`${prefix}BeforeSha256`] === report.digests[`${prefix}AfterSha256`],
      "MATERIAL_REPORT_PARITY_DIGEST_MISMATCH",
      `Material report ${prefix} before/after evidence differs.`
    );
  }

  const expectedObjectNames = expectedReportObjectNames(geometryPackage);
  assertUniqueStrings(report.objectNames, expectedObjectNames.length, "MATERIAL_REPORT_OBJECT_NAMES_INVALID", "report.objectNames");
  assert(sameStringSet(report.objectNames, expectedObjectNames), "MATERIAL_REPORT_OBJECT_SET_MISMATCH", "Material report object identities differ from the verified geometry package.");

  const expectedAssignments = expectedReportAssignments(materialPackage);
  const expectedMaterialNames = [...new Set(expectedAssignments.map(({ materialName }) => materialName))].sort();
  assert(expectedMaterialNames.length === 70, "MATERIAL_REPORT_EXPECTED_MATERIAL_SET_INVALID", "The verified material package did not resolve to 70 used material datablocks.");
  assertUniqueStrings(report.materialNames, 70, "MATERIAL_REPORT_MATERIAL_NAMES_INVALID", "report.materialNames");
  assert(deepEqual(report.materialNames, expectedMaterialNames), "MATERIAL_REPORT_MATERIAL_SET_MISMATCH", "Material report material identities differ from the verified sidecar package.");

  const expectedNodeNames = expectedReportNodeNames(expectedMaterialNames);
  const expectedLinkNames = expectedReportLinkNames(expectedMaterialNames);
  assertUniqueStrings(report.nodeNames, 1115, "MATERIAL_REPORT_NODE_NAMES_INVALID", "report.nodeNames");
  assertUniqueStrings(report.linkNames, 1305, "MATERIAL_REPORT_LINK_NAMES_INVALID", "report.linkNames");
  assert(deepEqual(report.nodeNames, expectedNodeNames), "MATERIAL_REPORT_NODE_TOPOLOGY_MISMATCH", "Material report node names/order differ from the versioned translator topology.");
  assert(deepEqual(report.linkNames, expectedLinkNames), "MATERIAL_REPORT_LINK_TOPOLOGY_MISMATCH", "Material report link names/order differ from the versioned translator topology.");

  exactReportKeys(report.materials, REPORT_MATERIAL_KEYS, "report.materials");
  assert(report.materials.bindingCount === 80 && report.materials.materialFrameCount === 65, "MATERIAL_REPORT_BINDING_COUNT_MISMATCH", "Material report binding or frame totals drifted.");
  exactReportKeys(report.materials.bindingCountsByMaterial, new Set(Object.keys(EXPECTED_BINDING_COUNTS)), "report.materials.bindingCountsByMaterial");
  assert(deepEqual(report.materials.bindingCountsByMaterial, EXPECTED_BINDING_COUNTS), "MATERIAL_REPORT_BINDING_COUNTS_MISMATCH", "Material report per-material binding counts drifted.");
  assert(
    report.materials.sourceMaterialDatablockCount === 6
      && report.materials.createdMaterialDatablockCount === 68
      && report.materials.totalMaterialDatablockCount === 74,
    "MATERIAL_REPORT_DATABLOCK_COUNT_MISMATCH",
    "Material report must preserve six source materials, create 68, and total 74 datablocks."
  );
  assertUniqueStrings(report.materials.usedMaterialNames, 70, "MATERIAL_REPORT_USED_MATERIAL_NAMES_INVALID", "report.materials.usedMaterialNames");
  assert(deepEqual(report.materials.usedMaterialNames, expectedMaterialNames), "MATERIAL_REPORT_USED_MATERIAL_SET_MISMATCH", "Material report used-material identities drifted.");
  assert(report.materials.nodeCount === 1115 && report.materials.linkCount === 1305, "MATERIAL_REPORT_SHADER_COUNT_MISMATCH", "Material report shader node or link totals drifted.");
  for (const key of ["materialSha256", "nodeSha256", "linkSha256", "slotAssignmentSha256"]) {
    assert(SHA256_RE.test(report.materials[key]), "MATERIAL_REPORT_MATERIAL_DIGEST_INVALID", `Material report ${key} is malformed.`);
  }
  assert(report.materials.materialSha256 === report.digests.materialsSha256, "MATERIAL_REPORT_MATERIAL_DIGEST_MISMATCH", "Material-record digests disagree.");
  assert(report.materials.nodeSha256 === report.digests.nodesSha256, "MATERIAL_REPORT_NODE_DIGEST_MISMATCH", "Shader-node digests disagree.");
  assert(report.materials.linkSha256 === report.digests.linksSha256, "MATERIAL_REPORT_LINK_DIGEST_MISMATCH", "Shader-link digests disagree.");
  assert(report.materials.slotAssignmentSha256 === report.digests.slotAssignmentsSha256, "MATERIAL_REPORT_ASSIGNMENT_DIGEST_MISMATCH", "Slot-assignment digests disagree.");
  assert(hashCanonical(report.linkNames) === report.materials.linkSha256, "MATERIAL_REPORT_LINK_DIGEST_STALE", "Shader-link digest does not match the canonical link-name sequence.");

  assert(Array.isArray(report.materials.slotAssignments) && report.materials.slotAssignments.length === 80, "MATERIAL_REPORT_SLOT_ASSIGNMENTS_INVALID", "Material report must contain 80 slot assignments.");
  report.materials.slotAssignments.forEach((assignment, index) => {
    exactReportKeys(assignment, REPORT_ASSIGNMENT_KEYS, `report.materials.slotAssignments[${index}]`);
  });
  assert(deepEqual(report.materials.slotAssignments, expectedAssignments), "MATERIAL_REPORT_SLOT_ASSIGNMENTS_MISMATCH", "Material slot assignments differ from the verified bindings and material frames.");
  const assignmentDigest = hashCanonical(expectedAssignments);
  assert(report.materials.slotAssignmentSha256 === assignmentDigest, "MATERIAL_REPORT_ASSIGNMENT_DIGEST_STALE", "Slot-assignment digest does not match the canonical assignments.");

  exactReportKeys(report.output, REPORT_OUTPUT_KEYS, "report.output");
  const resultOutput = result.outputs[0];
  const expectedOutput = {
    filename: materialPackage.capture.output.filename,
    logicalObjectKey: resultOutput.objectKey,
    mimeType: resultOutput.mimeType,
    width: preview.width,
    height: preview.height,
    bytes: preview.bytes,
    sha256: preview.sha256
  };
  assert(deepEqual(report.output, expectedOutput), "MATERIAL_REPORT_OUTPUT_MISMATCH", "Material report output evidence differs from the result manifest and actual WebP.");
  return true;
}

function exactReportKeys(value, expectedKeys, label) {
  assert(
    value !== null && typeof value === "object" && !Array.isArray(value),
    "MATERIAL_REPORT_SCHEMA_INVALID",
    `${label} must be an object.`
  );
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  assert(
    deepEqual(actual, expected),
    "MATERIAL_REPORT_SCHEMA_INVALID",
    `${label} keys are invalid; expected ${expected.join(", ")}.`
  );
}

function assertUniqueStrings(value, expectedLength, code, label) {
  assert(
    Array.isArray(value)
      && value.length === expectedLength
      && value.every((entry) => typeof entry === "string" && entry.length > 0)
      && new Set(value).size === value.length,
    code,
    `${label} must contain ${expectedLength} unique non-empty strings.`
  );
}

function sameStringSet(left, right) {
  return left.length === right.length
    && deepEqual([...left].sort(), [...right].sort());
}

function expectedReportObjectNames(geometryPackage) {
  assert(
    geometryPackage && Array.isArray(geometryPackage.components)
      && Array.isArray(geometryPackage.constraints),
    "MATERIAL_REPORT_GEOMETRY_EVIDENCE_INVALID",
    "A verified geometry package is required to validate report objects."
  );
  const productNames = geometryPackage.components.flatMap((component) => (
    component.submeshes.map((submesh) => `${component.componentId}::${submesh.submeshId}`)
  ));
  const constraintNames = geometryPackage.constraints.map((constraint) => (
    `${constraint.constraintId}::${constraint.kind}`
  ));
  const result = [
    ...productNames,
    "room-floor",
    "room-rear-wall",
    ...constraintNames,
    "JQ_HERO_CAMERA"
  ];
  assert(
    result.length === 88 && new Set(result).size === 88,
    "MATERIAL_REPORT_GEOMETRY_EVIDENCE_INVALID",
    "Verified geometry identities did not resolve to 88 unique scene objects."
  );
  return result;
}

function materialNameForBinding(binding, frameById) {
  if (binding.materialFrameId !== null) {
    const frame = frameById.get(binding.materialFrameId);
    assert(frame, "MATERIAL_REPORT_FRAME_EVIDENCE_INVALID", `Binding ${binding.bindingId} references a missing material frame.`);
    assert(WOOD_MATERIAL_IDS.has(binding.materialId), "MATERIAL_REPORT_FRAME_EVIDENCE_INVALID", `Binding ${binding.bindingId} uses a frame with a non-wood material.`);
    return `JQ_PBR_WOOD_${frame.mappingDigest.slice(0, 32)}`;
  }
  if (binding.targetKind === "ROOM_SURFACE") {
    const roomName = ROOM_MATERIAL_NAMES[binding.objectId];
    assert(roomName, "MATERIAL_REPORT_ROOM_BINDING_INVALID", `Binding ${binding.bindingId} targets an unknown room surface.`);
    return roomName;
  }
  return `JQ_PBR::${binding.materialId}`;
}

function expectedReportAssignments(materialPackage) {
  assert(
    materialPackage && Array.isArray(materialPackage.bindings)
      && Array.isArray(materialPackage.materialFrames),
    "MATERIAL_REPORT_MATERIAL_EVIDENCE_INVALID",
    "A verified material package is required to validate assignments."
  );
  const frameById = new Map(materialPackage.materialFrames.map((frame) => [frame.frameId, frame]));
  const assignments = materialPackage.bindings.map((binding) => ({
    bindingId: binding.bindingId,
    objectId: binding.objectId,
    materialId: binding.materialId,
    materialFrameId: binding.materialFrameId,
    materialName: materialNameForBinding(binding, frameById),
    materialSlotIndex: 0
  }));
  assert(
    assignments.length === 80
      && new Set(assignments.map(({ bindingId }) => bindingId)).size === 80
      && new Set(assignments.map(({ objectId }) => objectId)).size === 80,
    "MATERIAL_REPORT_MATERIAL_EVIDENCE_INVALID",
    "Verified bindings did not resolve to 80 unique assignments."
  );
  return assignments;
}

function expectedReportNodeNames(materialNames) {
  return materialNames.flatMap((materialName) => {
    const suffixes = materialName.startsWith("JQ_PBR_WOOD_")
      ? WOOD_NODE_SUFFIXES
      : materialName.startsWith("JQ_PBR::")
        ? FLAT_NODE_SUFFIXES
        : ROOM_NODE_SUFFIXES;
    return suffixes.map((suffix) => `${materialName}::${suffix}`);
  });
}

function expectedReportLinkNames(materialNames) {
  return materialNames.flatMap((materialName) => {
    const suffixes = materialName.startsWith("JQ_PBR_WOOD_")
      ? WOOD_LINK_SUFFIXES
      : materialName.startsWith("JQ_PBR::")
        ? FLAT_LINK_SUFFIXES
        : ROOM_LINK_SUFFIXES;
    return suffixes.map((suffix) => `${materialName}::${suffix}`);
  });
}

async function snapshotAndValidatePrimaryArtifacts(paths) {
  const snapshot = {};
  for (const [key, path] of Object.entries(paths)) {
    const bytes = await readFile(path);
    snapshot[key] = Object.freeze({
      filename: PRIMARY_ARTIFACTS[key],
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex")
    });
  }
  const beautyBytes = await readFile(paths.beauty);
  const beautyDimensions = readWebpDimensions(beautyBytes);
  snapshot.beauty = Object.freeze({ ...snapshot.beauty, ...beautyDimensions });
  const crownBytes = await readFile(paths.crownDetail);
  const crownDimensions = readWebpDimensions(crownBytes);
  snapshot.crownDetail = Object.freeze({ ...snapshot.crownDetail, ...crownDimensions });
  assert(deepEqual(
    { width: snapshot.beauty.width, height: snapshot.beauty.height, bytes: snapshot.beauty.bytes, sha256: snapshot.beauty.sha256 },
    EXPECTED_BEAUTY
  ), "PRIMARY_BEAUTY_BASELINE_MISMATCH", "The accepted Phase 5 beauty artifact drifted.");
  assert(deepEqual(
    { width: snapshot.crownDetail.width, height: snapshot.crownDetail.height, bytes: snapshot.crownDetail.bytes, sha256: snapshot.crownDetail.sha256 },
    EXPECTED_CROWN_DETAIL
  ), "CROWN_DETAIL_BASELINE_MISMATCH", "The accepted Phase 5 crown-detail artifact drifted.");
  return Object.freeze(snapshot);
}

function createOutputPaths(directory) {
  return Object.freeze({
    geometryPackage: join(directory, "render-package.json"),
    materialPackage: join(directory, MATERIALS_PACKAGE_FILENAME),
    preview: join(directory, MATERIALS_PREVIEW_FILENAME),
    result: join(directory, MATERIALS_PREVIEW_RESULT_FILENAME),
    report: join(directory, MATERIALS_PREVIEW_REPORT_FILENAME),
    previewBlend: join(directory, MATERIALS_PREVIEW_BLEND_FILENAME)
  });
}

async function assertLocalInputs(blenderExecutable, workerPath, sourceBlend) {
  await access(workerPath, fsConstants.R_OK);
  await access(sourceBlend, fsConstants.R_OK);
  if (isAbsolute(blenderExecutable) || blenderExecutable.includes("/")) {
    await access(absolutePath(blenderExecutable, process.cwd()), fsConstants.X_OK);
  }
}

async function verifyBlend(path) {
  const metadata = await stat(path);
  assert(metadata.isFile() && metadata.size > 0 && metadata.size <= MAX_BLEND_BYTES, "MATERIAL_BLEND_INVALID", "TV01-materials-preview.blend must be a bounded non-empty file.");
  return Object.freeze({ path, bytes: metadata.size });
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
      rejectProcess(new MaterialsPreviewRunnerError("BLENDER_START_FAILED", `Blender could not be started: ${error.message}`));
      return;
    }
    let stdout = "";
    let stderr = "";
    if (!options.inherit) {
      child.stdout?.on("data", (chunk) => { stdout += chunk; });
      child.stderr?.on("data", (chunk) => { stderr += chunk; });
    }
    child.once("error", (error) => rejectProcess(new MaterialsPreviewRunnerError("BLENDER_START_FAILED", `Blender could not be started: ${error.message}`)));
    child.once("exit", (code, signal) => {
      if (code === 0 && signal === null) {
        resolveProcess({ stdout, stderr });
        return;
      }
      rejectProcess(new MaterialsPreviewRunnerError(
        "BLENDER_MATERIAL_WORKER_FAILED",
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
  if (!condition) throw new MaterialsPreviewRunnerError(code, message, details);
}

async function main() {
  const result = await runMaterialsPreview();
  console.log(JSON.stringify({
    status: "succeeded",
    materialPackageKey: result.materialPackage.materialPackageKey,
    captureKey: result.materialPackage.capture.captureKey,
    bindingCount: result.materialPackage.bindings.length,
    materialFrameCount: result.materialPackage.materialFrames.length,
    preview: result.preview,
    blendPath: result.blendPath,
    resultPath: result.resultPath,
    reportPath: result.reportPath,
    freshIsolatedRun: result.freshIsolatedRun
  }, null, 2));
}

const entryPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (entryPath === import.meta.url) {
  main().catch((error) => {
    const code = error?.code ? ` [${error.code}]` : "";
    console.error(`Blender materials preview failed${code}: ${error?.message || error}`);
    if (Array.isArray(error?.details) && error.details.length) {
      console.error(JSON.stringify(error.details, null, 2));
    }
    process.exitCode = 1;
  });
}

export { DEFAULT_BLENDER_EXECUTABLE, resolveBlenderExecutable };
