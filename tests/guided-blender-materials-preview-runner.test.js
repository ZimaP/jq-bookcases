import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import test from "node:test";

import {
  createGuidedBlenderMaterialPackage,
  createMaterialsPreviewResult,
  hashCanonical
} from "../tools/blender/materials-preview-contract.mjs";
import { createVerifiedClayRenderPackage } from "../tools/blender/run-clay-worker.mjs";
import {
  DEFAULT_BLENDER_EXECUTABLE,
  MATERIALS_PACKAGE_FILENAME,
  MATERIALS_PREVIEW_BLEND_FILENAME,
  MATERIALS_PREVIEW_FILENAME,
  MATERIALS_PREVIEW_REPORT_FILENAME,
  MATERIALS_PREVIEW_RESULT_FILENAME,
  MaterialsPreviewRunnerError,
  probeBlenderRuntime,
  resolveBlenderExecutable,
  validateMaterialsPreviewReport,
  verifyMaterialsPreviewIntegrity
} from "../tools/blender/run-materials-preview.mjs";

const RUNTIME = Object.freeze({
  backend: "METAL",
  buildHash: "fbe6228777e7",
  deviceVersion: "1.2",
  renderer: "Metal API",
  vendor: "Apple M4",
  version: "5.2.0 LTS"
});

let generatedPromise;
function getGenerated() {
  generatedPromise ||= createVerifiedClayRenderPackage();
  return generatedPromise;
}

test("the material runner preserves BLENDER_BIN behavior and uses distinct output names", () => {
  assert.equal(DEFAULT_BLENDER_EXECUTABLE, "/Applications/Blender.app/Contents/MacOS/Blender");
  assert.equal(resolveBlenderExecutable({}), DEFAULT_BLENDER_EXECUTABLE);
  assert.equal(resolveBlenderExecutable({ BLENDER_BIN: " /opt/blender " }), "/opt/blender");
  assert.deepEqual([
    MATERIALS_PACKAGE_FILENAME,
    MATERIALS_PREVIEW_FILENAME,
    MATERIALS_PREVIEW_RESULT_FILENAME,
    MATERIALS_PREVIEW_REPORT_FILENAME,
    MATERIALS_PREVIEW_BLEND_FILENAME
  ], [
    "materials-package.json",
    "materials-preview.webp",
    "materials-preview-result.json",
    "materials-preview-report.json",
    "TV01-materials-preview.blend"
  ]);
  assert.equal(MATERIALS_PREVIEW_FILENAME === "beauty.webp", false);
  assert.equal(MATERIALS_PREVIEW_BLEND_FILENAME === "TV01-clay.blend", false);
});

test("the runtime probe pins background factory startup and parses build/device identity", async () => {
  const calls = [];
  const spawnImplementation = (executable, args, options) => {
    calls.push({ executable, args, options });
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    queueMicrotask(() => {
      child.stdout.end(`JQ_BLENDER_RUNTIME ${JSON.stringify(RUNTIME)}\n`);
      child.stderr.end();
      child.emit("exit", 0, null);
    });
    return child;
  };
  const runtime = await probeBlenderRuntime("/mock/Blender", {
    environment: { PATH: "/usr/bin" },
    spawnImplementation
  });
  assert.deepEqual(runtime, RUNTIME);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].executable, "/mock/Blender");
  assert.deepEqual(calls[0].args.slice(0, 2), ["--background", "--factory-startup"]);
  assert.ok(calls[0].args.includes("--python-expr"));
  assert.equal(calls[0].options.stdio[0], "ignore");
});

test("actual material-preview WebP bytes, dimensions, and SHA-256 are independently verified", async () => {
  const generated = await getGenerated();
  const materialPackage = createGuidedBlenderMaterialPackage(generated.renderPackage, {
    primaryPackageJson: generated.packageJson,
    blenderRuntime: RUNTIME
  });
  const directory = await mkdtemp(join(tmpdir(), "jq-material-preview-integrity-"));
  const previewPath = join(directory, "materials-preview.webp");
  try {
    const bytes = createVp8xWebp(960, 640);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const output = {
      pass: "materials-preview",
      objectKey: `${materialPackage.capture.captureKey}/materials-preview.webp`,
      mimeType: "image/webp",
      width: 960,
      height: 640,
      bytes: bytes.length,
      sha256
    };
    const result = createMaterialsPreviewResult(materialPackage, output);
    await writeFile(previewPath, bytes);
    const verified = await verifyMaterialsPreviewIntegrity(materialPackage, result, previewPath);
    assert.deepEqual(verified, {
      path: previewPath,
      width: 960,
      height: 640,
      bytes: bytes.length,
      sha256
    });

    const stale = structuredClone(result);
    stale.outputs[0].sha256 = "0".repeat(64);
    await assert.rejects(
      verifyMaterialsPreviewIntegrity(materialPackage, stale, previewPath),
      (error) => error instanceof MaterialsPreviewRunnerError
        && error.code === "MATERIAL_RESULT_SHA256_MISMATCH"
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("the deterministic worker report requires exact path-free schema, identities, assignments, and shader evidence", async () => {
  const generated = await getGenerated();
  const materialPackage = createGuidedBlenderMaterialPackage(generated.renderPackage, {
    primaryPackageJson: generated.packageJson,
    blenderRuntime: RUNTIME
  });
  const preview = { width: 960, height: 640, bytes: 1234, sha256: "a".repeat(64) };
  const output = {
    pass: "materials-preview",
    objectKey: `${materialPackage.capture.captureKey}/materials-preview.webp`,
    mimeType: "image/webp",
    ...preview
  };
  const result = createMaterialsPreviewResult(materialPackage, output);
  const report = createReport(generated.renderPackage, materialPackage, result, preview);
  assert.equal(
    validateMaterialsPreviewReport(
      report,
      generated.renderPackage,
      materialPackage,
      result,
      preview
    ),
    true
  );

  const cases = [
    ["top-level timestamps", (value) => { value.timestamp = "2026-08-03T00:00:00Z"; }, "MATERIAL_REPORT_SCHEMA_INVALID"],
    ["nested output paths", (value) => { value.output.path = "/tmp/preview.webp"; }, "MATERIAL_REPORT_SCHEMA_INVALID"],
    ["runtime drift", (value) => { value.blenderRuntime.vendor = "another host"; }, "MATERIAL_REPORT_RUNTIME_MISMATCH"],
    ["result identity drift", (value) => { value.resultKey = `jq-materials-preview-result-v1-${"0".repeat(64)}`; }, "MATERIAL_REPORT_RESULT_KEY_MISMATCH"],
    ["shader node count drift", (value) => { value.counts.nodes = 1114; }, "MATERIAL_REPORT_COUNT_MISMATCH"],
    ["parity flags without evidence", (value) => { value.parity.camera = false; }, "MATERIAL_REPORT_PARITY_FLAG_MISMATCH"],
    ["false shader-parameter parity", (value) => { value.parity.shaderParameters = false; }, "MATERIAL_REPORT_PARITY_FLAG_MISMATCH"],
    ["malformed parity SHA", (value) => { value.digests.cameraAfterSha256 = "nope"; }, "MATERIAL_REPORT_DIGEST_INVALID"],
    ["malformed shader-parameter audit SHA", (value) => { value.digests.shaderParametersBeforeSha256 = "stale"; }, "MATERIAL_REPORT_DIGEST_INVALID"],
    ["before-after geometry drift", (value) => { value.digests.geometryAfterSha256 = "f".repeat(64); }, "MATERIAL_REPORT_PARITY_DIGEST_MISMATCH"],
    ["before-after shader-parameter drift", (value) => { value.digests.shaderParametersAfterSha256 = "f".repeat(64); }, "MATERIAL_REPORT_PARITY_DIGEST_MISMATCH"],
    ["duplicate object identity", (value) => { value.objectNames[1] = value.objectNames[0]; }, "MATERIAL_REPORT_OBJECT_NAMES_INVALID"],
    ["unresolved material identity", (value) => { value.materialNames[0] = "JQ_PBR::unknown"; }, "MATERIAL_REPORT_MATERIAL_SET_MISMATCH"],
    ["node topology drift", (value) => { value.nodeNames[0] = "JQ_PBR::unknown::00_OUTPUT"; }, "MATERIAL_REPORT_NODE_TOPOLOGY_MISMATCH"],
    ["link topology drift", (value) => { value.linkNames[0] = "JQ_PBR::unknown::bad"; }, "MATERIAL_REPORT_LINK_TOPOLOGY_MISMATCH"],
    ["per-material binding drift", (value) => { value.materials.bindingCountsByMaterial["natural-oak-visualization-v1"] = 63; }, "MATERIAL_REPORT_BINDING_COUNTS_MISMATCH"],
    ["source material mutation", (value) => { value.materials.sourceMaterialDatablockCount = 5; }, "MATERIAL_REPORT_DATABLOCK_COUNT_MISMATCH"],
    ["stale shader link digest", (value) => { value.materials.linkSha256 = "e".repeat(64); value.digests.linksSha256 = "e".repeat(64); }, "MATERIAL_REPORT_LINK_DIGEST_STALE"],
    ["slot assignment drift", (value) => { value.materials.slotAssignments[0].materialName = "JQ_PBR::wrong"; }, "MATERIAL_REPORT_SLOT_ASSIGNMENTS_MISMATCH"],
    ["stale slot assignment digest", (value) => { value.materials.slotAssignmentSha256 = "e".repeat(64); value.digests.slotAssignmentsSha256 = "e".repeat(64); }, "MATERIAL_REPORT_ASSIGNMENT_DIGEST_STALE"],
    ["output filename drift", (value) => { value.output.filename = "beauty.webp"; }, "MATERIAL_REPORT_OUTPUT_MISMATCH"]
  ];
  for (const [label, mutate, code] of cases) {
    const invalid = structuredClone(report);
    mutate(invalid);
    assert.throws(
      () => validateMaterialsPreviewReport(
        invalid,
        generated.renderPackage,
        materialPackage,
        result,
        preview
      ),
      (error) => error instanceof MaterialsPreviewRunnerError && error.code === code,
      label
    );
  }
});

test("the npm command and runner source require isolated temporary output and factory startup", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const runner = await readFile(
    new URL("../tools/blender/run-materials-preview.mjs", import.meta.url),
    "utf8"
  );
  assert.equal(
    packageJson.scripts["blender:materials-preview"],
    "node tools/blender/run-materials-preview.mjs"
  );
  assert.match(runner, /mkdtemp\(join\(tmpdir\(\), "jq-materials-preview-"\)\)/);
  assert.match(runner, /"--background",\s*"--factory-startup"/);
  assert.match(runner, /snapshotAndValidatePrimaryArtifacts/);
});

const WOOD_NODES = [
  "00_OUTPUT", "10_PRINCIPLED", "20_PACKAGE_WORLD_COORDINATES",
  "30_SUBTRACT_FRAME_ORIGIN", "40_DOT_CROSS_GRAIN", "41_DOT_GRAIN",
  "42_DOT_NORMAL", "50_COMBINE_CROSS_GRAIN_NORMAL", "60_PHYSICAL_SCALE_METERS",
  "70_DETERMINISTIC_PHASE", "80_COARSE_OAK_NOISE", "81_GRAIN_BANDS",
  "82_FINE_FIBER_NOISE", "90_MIX_COARSE_AND_GRAIN", "91_WEIGHTED_TONE_RANGE",
  "92_NATURAL_OAK_COLOR_RAMP", "93_SHADER_ONLY_FIBER_BUMP"
];
const WOOD_LINKS = [
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
];

function createReport(geometryPackage, materialPackage, result, preview) {
  const frames = new Map(materialPackage.materialFrames.map((frame) => [frame.frameId, frame]));
  const assignments = materialPackage.bindings.map((binding) => ({
    bindingId: binding.bindingId,
    objectId: binding.objectId,
    materialId: binding.materialId,
    materialFrameId: binding.materialFrameId,
    materialName: binding.materialFrameId
      ? `JQ_PBR_WOOD_${frames.get(binding.materialFrameId).mappingDigest.slice(0, 32)}`
      : binding.targetKind === "ROOM_SURFACE"
        ? { "room-floor": "JQ_ROOM_FLOOR", "room-rear-wall": "JQ_ROOM_WALL" }[binding.objectId]
        : `JQ_PBR::${binding.materialId}`,
    materialSlotIndex: 0
  }));
  const materialNames = [...new Set(assignments.map(({ materialName }) => materialName))].sort();
  const nodeNames = materialNames.flatMap((name) => {
    const suffixes = name.startsWith("JQ_PBR_WOOD_")
      ? WOOD_NODES
      : name.startsWith("JQ_PBR::")
        ? ["00_OUTPUT", "10_PRINCIPLED"]
        : ["Principled BSDF", "Material Output"];
    return suffixes.map((suffix) => `${name}::${suffix}`);
  });
  const linkNames = materialNames.flatMap((name) => {
    const suffixes = name.startsWith("JQ_PBR_WOOD_")
      ? WOOD_LINKS
      : name.startsWith("JQ_PBR::")
        ? ["10_PRINCIPLED:BSDF->00_OUTPUT:Surface"]
        : ["Principled BSDF:BSDF->Material Output:Surface"];
    return suffixes.map((suffix) => `${name}::${suffix}`);
  });
  const objectNames = [
    ...geometryPackage.components.flatMap((component) => (
      component.submeshes.map((submesh) => `${component.componentId}::${submesh.submeshId}`)
    )),
    "room-floor",
    "room-rear-wall",
    ...geometryPackage.constraints.map(({ constraintId, kind }) => `${constraintId}::${kind}`),
    "JQ_HERO_CAMERA"
  ];
  const digest = (label) => createHash("sha256").update(label).digest("hex");
  const assignmentSha256 = hashCanonical(assignments);
  const linkSha256 = hashCanonical(linkNames);
  const materialSha256 = digest("materials");
  const nodeSha256 = digest("nodes");
  return {
    kind: "jq-local-blender-materials-preview-report",
    schemaVersion: 1,
    status: "succeeded",
    blenderRuntime: { ...materialPackage.capture.blenderRuntime },
    materialPackageKey: materialPackage.materialPackageKey,
    captureKey: materialPackage.capture.captureKey,
    materialPipelineVersion: materialPackage.versions.materialPipelineVersion,
    resultKey: result.resultKey,
    freshIsolatedOutput: true,
    counts: {
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
    },
    parity: {
      geometry: true,
      topology: true,
      bounds: true,
      transforms: true,
      objects: true,
      camera: true,
      world: true,
      lights: true,
      renderSettings: true,
      shaderParameters: true
    },
    objectNames,
    materialNames,
    nodeNames,
    linkNames,
    digests: {
      geometryBeforeSha256: digest("geometry"), geometryAfterSha256: digest("geometry"),
      topologyBeforeSha256: digest("topology"), topologyAfterSha256: digest("topology"),
      boundsBeforeSha256: digest("bounds"), boundsAfterSha256: digest("bounds"),
      transformsBeforeSha256: digest("transforms"), transformsAfterSha256: digest("transforms"),
      cameraBeforeSha256: digest("camera"), cameraAfterSha256: digest("camera"),
      worldBeforeSha256: digest("world"), worldAfterSha256: digest("world"),
      renderSettingsBeforeSha256: digest("render"), renderSettingsAfterSha256: digest("render"),
      shaderParametersBeforeSha256: digest("shader-parameters"),
      shaderParametersAfterSha256: digest("shader-parameters"),
      materialsSha256: materialSha256,
      nodesSha256: nodeSha256,
      linksSha256: linkSha256,
      slotAssignmentsSha256: assignmentSha256
    },
    materials: {
      bindingCount: 80,
      materialFrameCount: 65,
      bindingCountsByMaterial: {
        "inherited-room-floor-clay-v1": 1,
        "inherited-room-wall-clay-v1": 1,
        "matte-black-hardware-v1": 10,
        "natural-oak-countertop-visualization-v1": 1,
        "natural-oak-visualization-v1": 64,
        "tv-black-glass-v1": 1,
        "warm-opal-puck-lens-v1": 2
      },
      sourceMaterialDatablockCount: 6,
      createdMaterialDatablockCount: 68,
      totalMaterialDatablockCount: 74,
      usedMaterialNames: [...materialNames],
      nodeCount: 1115,
      linkCount: 1305,
      materialSha256,
      nodeSha256,
      linkSha256,
      slotAssignmentSha256: assignmentSha256,
      slotAssignments: assignments
    },
    output: {
      filename: "materials-preview.webp",
      logicalObjectKey: result.outputs[0].objectKey,
      mimeType: "image/webp",
      ...preview
    }
  };
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
