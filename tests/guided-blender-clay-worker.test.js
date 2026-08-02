import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  GUIDED_BLENDER_RENDER_PIPELINE_VERSION,
  validateGuidedBlenderRenderPackage,
  validateGuidedBlenderRenderResult
} from "../guided-blender-render-contract.js";
import {
  DEFAULT_BLENDER_EXECUTABLE,
  EXPECTED_DRAWING_4_GEOMETRY_FINGERPRINT,
  EXPECTED_DRAWING_4_RENDER_KEY,
  EXPECTED_DRAWING_4_REQUEST_KEY,
  REPOSITORY_ROOT,
  BlenderClayRunnerError,
  createVerifiedClayRenderPackage,
  readWebpDimensions,
  resolveBlenderExecutable,
  validateClayWorkerOutputs,
  verifyBeautyOutputIntegrity,
  writeDeterministicJson
} from "../tools/blender/run-clay-worker.mjs";

const EXPECTED_COMPONENT_COUNT = 46;
const EXPECTED_CONSTRAINT_COUNT = 7;
const EXPECTED_SUBMESH_OBJECT_COUNT = 78;
const EXPECTED_WIDTH = 960;
const EXPECTED_HEIGHT = 640;
const PYTHON_WORKER_PATH = join(REPOSITORY_ROOT, "tools/blender/clay_worker.py");

let generatedPackagePromise;

function getGeneratedPackage() {
  generatedPackagePromise ||= createVerifiedClayRenderPackage();
  return generatedPackagePromise;
}

test("the TV01 clay runner writes deterministic authoritative package JSON", async () => {
  const first = await getGeneratedPackage();
  const repeated = await createVerifiedClayRenderPackage();

  assert.equal(first.packageJson, repeated.packageJson);
  assert.equal(first.renderPackage.renderKey, repeated.renderPackage.renderKey);
  assert.equal(first.renderPackage.renderKey, EXPECTED_DRAWING_4_RENDER_KEY);
  assert.equal(first.renderPackage.requestKey, EXPECTED_DRAWING_4_REQUEST_KEY);
  assert.equal(
    first.renderPackage.identity.geometryFingerprint,
    EXPECTED_DRAWING_4_GEOMETRY_FINGERPRINT
  );
  assert.deepEqual(JSON.parse(first.packageJson), first.renderPackage);
  assert.equal(first.packageJson.endsWith("\n"), true);

  const directory = await mkdtemp(join(tmpdir(), "jq-clay-package-"));
  try {
    const firstPath = join(directory, "first.json");
    const repeatedPath = join(directory, "repeated.json");
    const firstWrite = await writeDeterministicJson(firstPath, first.renderPackage);
    const repeatedWrite = await writeDeterministicJson(repeatedPath, repeated.renderPackage);

    assert.equal(firstWrite.contents, first.packageJson);
    assert.equal(repeatedWrite.contents, first.packageJson);
    assert.equal(firstWrite.bytes, Buffer.byteLength(first.packageJson));
    assert.deepEqual(await readFile(firstPath), await readFile(repeatedPath));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("the verified package has the exact component, constraint, and object tuple counts", async () => {
  const { renderPackage } = await getGeneratedPackage();
  const objectTuples = renderPackage.components.flatMap((component) => (
    component.submeshes.map((submesh) => `${component.componentId}::${submesh.submeshId}`)
  ));

  assert.equal(renderPackage.components.length, EXPECTED_COMPONENT_COUNT);
  assert.equal(renderPackage.constraints.length, EXPECTED_CONSTRAINT_COUNT);
  assert.equal(objectTuples.length, EXPECTED_SUBMESH_OBJECT_COUNT);
  assert.equal(renderPackage.audit.physicalComponentCount, EXPECTED_COMPONENT_COUNT);
  assert.equal(renderPackage.audit.renderedComponentCount, EXPECTED_COMPONENT_COUNT);
  assert.equal(renderPackage.audit.constraintCount, EXPECTED_CONSTRAINT_COUNT);
  assert.equal(renderPackage.audit.primitiveRecordCount, EXPECTED_COMPONENT_COUNT);
});

test("component IDs and component/submesh object IDs are unique and deterministic", async () => {
  const first = await getGeneratedPackage();
  const repeated = await createVerifiedClayRenderPackage();
  const summarizeIds = (renderPackage) => ({
    components: renderPackage.components.map((component) => component.componentId),
    objects: renderPackage.components.flatMap((component) => (
      component.submeshes.map((submesh) => `${component.componentId}::${submesh.submeshId}`)
    ))
  });
  const firstIds = summarizeIds(first.renderPackage);

  assert.deepEqual(summarizeIds(repeated.renderPackage), firstIds);
  assert.equal(new Set(firstIds.components).size, firstIds.components.length);
  assert.equal(new Set(firstIds.objects).size, firstIds.objects.length);
  for (const component of first.renderPackage.components) {
    const submeshIds = component.submeshes.map((submesh) => submesh.submeshId);
    assert.equal(new Set(submeshIds).size, submeshIds.length);
  }
});

test("all component, submesh, and constraint Blender bounds are finite and ordered", async () => {
  const { renderPackage } = await getGeneratedPackage();
  const boundedEntries = [
    ...renderPackage.components.map((component) => [
      component.componentId,
      component.blenderWorldBounds
    ]),
    ...renderPackage.components.flatMap((component) => component.submeshes.map((submesh) => [
      `${component.componentId}::${submesh.submeshId}`,
      submesh.blenderWorldBounds
    ])),
    ...renderPackage.constraints.map((constraint) => [
      constraint.constraintId,
      constraint.blenderWorldBounds
    ])
  ];

  for (const [id, bounds] of boundedEntries) {
    for (const axis of ["x", "y", "z"]) {
      assert.equal(Number.isFinite(bounds?.min?.[axis]), true, `${id} min.${axis}`);
      assert.equal(Number.isFinite(bounds?.max?.[axis]), true, `${id} max.${axis}`);
      assert.ok(bounds.max[axis] > bounds.min[axis], `${id} ${axis} must be ordered`);
    }
  }
});

test("the runner preserves the package camera exactly across regeneration", async () => {
  const first = await getGeneratedPackage();
  const repeated = await createVerifiedClayRenderPackage();

  assert.deepEqual(repeated.renderPackage.camera, first.renderPackage.camera);
  assert.deepEqual(first.renderPackage.camera, {
    cameraVersion: "hero-front-v1",
    type: "PERSP",
    lensMm: 50,
    sensorWidthMm: 36,
    sensorFit: "HORIZONTAL",
    depthOfField: false,
    fitMargin: 1.14,
    position: { x: 0, y: 6.1722, z: 1.2192 },
    target: { x: 0, y: 0.1905, z: 1.2192 },
    up: [0, 0, 1],
    clipStartM: 0.05,
    clipEndM: 25,
    framingBounds: {
      min: { x: -1.524, y: 0, z: 0 },
      max: { x: 1.524, y: 0.381, z: 2.4383999999999997 }
    }
  });
  assert.equal(first.renderPackage.render.width, EXPECTED_WIDTH);
  assert.equal(first.renderPackage.render.height, EXPECTED_HEIGHT);
});

test("every source material resolves explicitly through an original and clay definition", async () => {
  const { renderPackage } = await getGeneratedPackage();
  const clayMaterials = new Map(renderPackage.clayMaterials.map((material) => [
    material.materialId,
    material
  ]));
  const sourceBindings = new Map(renderPackage.materials.map((binding) => [
    `${binding.sourceMaterialSlot}\u0000${binding.materialId}`,
    binding
  ]));

  assert.equal(sourceBindings.size, renderPackage.materials.length);
  assert.equal(clayMaterials.size, renderPackage.clayMaterials.length);
  for (const binding of renderPackage.materials) {
    assert.equal(typeof binding.sourceMaterialSlot, "string");
    assert.equal(typeof binding.materialId, "string");
    assert.equal(typeof binding.definition, "object");
    assert.ok(clayMaterials.has(binding.clayMaterialId), binding.clayMaterialId);
    assert.equal(typeof clayMaterials.get(binding.clayMaterialId).definition, "object");
  }
  for (const component of renderPackage.components) {
    for (const submesh of component.submeshes) {
      const key = `${submesh.sourceMaterialSlot}\u0000${submesh.materialId}`;
      assert.ok(sourceBindings.has(key), `${component.componentId}::${submesh.submeshId}`);
    }
  }
});

test("package validation rejects unknown geometry", async () => {
  const { renderPackage } = await getGeneratedPackage();
  const candidate = structuredClone(renderPackage);
  candidate.components[0].submeshes[0].geometry = "invented_geometry";

  const validation = await validateGuidedBlenderRenderPackage(candidate);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((error) => error.code === "UNSUPPORTED_RENDER_PRIMITIVE"));
});

test("package validation rejects malformed crown profiles", async () => {
  const { renderPackage } = await getGeneratedPackage();
  const candidate = structuredClone(renderPackage);
  const crown = candidate.components
    .flatMap((component) => component.submeshes)
    .find((submesh) => submesh.geometry === "crown_profile_extrusion");
  assert.ok(crown);
  crown.profileGeometry.outline = [{ height: 0, projection: 0 }];

  const validation = await validateGuidedBlenderRenderPackage(candidate);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((error) => error.code === "MALFORMED_CROWN_PROFILE"));
});

test("package validation rejects duplicate component and submesh IDs", async (t) => {
  const { renderPackage } = await getGeneratedPackage();

  await t.test("duplicate component ID", async () => {
    const candidate = structuredClone(renderPackage);
    candidate.components[1].componentId = candidate.components[0].componentId;
    const validation = await validateGuidedBlenderRenderPackage(candidate);
    assert.equal(validation.valid, false);
    assert.ok(validation.errors.some((error) => (
      error.code === "DUPLICATE_RENDER_COMPONENT_ID"
    )));
  });

  await t.test("duplicate local submesh ID", async () => {
    const candidate = structuredClone(renderPackage);
    candidate.components[0].submeshes.push(structuredClone(candidate.components[0].submeshes[0]));
    const validation = await validateGuidedBlenderRenderPackage(candidate);
    assert.equal(validation.valid, false);
    assert.ok(validation.errors.some((error) => (
      error.code === "DUPLICATE_RENDER_SUBMESH_ID"
    )));
  });
});

test("the pure Python worker boundary rejects malformed packages without Blender", async (t) => {
  const { renderPackage } = await getGeneratedPackage();

  const valid = await runPythonPackageValidation(renderPackage);
  assert.equal(valid.status, 0, valid.stderr);
  assert.match(valid.stdout, /"valid":true/);

  const cases = [
    ["unknown key", "UNKNOWN_PACKAGE_KEY", (candidate) => {
      candidate.components[0].unknownWorkerField = true;
    }],
    ["unknown primitive", "UNKNOWN_PRIMITIVE_KIND", (candidate) => {
      candidate.components[0].submeshes[0].geometry = "invented_geometry";
    }],
    ["malformed crown", "MALFORMED_CROWN_PROFILE", (candidate) => {
      const crown = candidate.components
        .flatMap((component) => component.submeshes)
        .find((submesh) => submesh.geometry === "crown_profile_extrusion");
      crown.profileGeometry.outline = [{ height: 0, projection: 0 }];
    }],
    ["duplicate component", "DUPLICATE_COMPONENT_ID", (candidate) => {
      candidate.components[1].componentId = candidate.components[0].componentId;
    }],
    ["wrong aggregate submesh count", "SUBMESH_COUNT_MISMATCH", (candidate) => {
      const framed = candidate.components.find((component) => component.submeshes.length > 1);
      assert.ok(framed, "Drawing 4 package must contain decomposed Shaker fronts");
      const fieldIndex = framed.submeshes.findIndex((submesh) => submesh.submeshId === "center-field");
      assert.notEqual(fieldIndex, -1, "framed front must contain a center-field submesh");
      framed.submeshes.splice(fieldIndex, 1);
    }]
  ];
  for (const [label, code, mutate] of cases) {
    await t.test(label, async () => {
      const candidate = structuredClone(renderPackage);
      mutate(candidate);
      const result = await runPythonPackageValidation(candidate);
      assert.equal(result.status, 2, result.stderr);
      assert.match(result.stderr, new RegExp(`\\[${code}\\]`));
    });
  }
});

test("the Python worker rejects rehashed hand-authored geometry", async () => {
  const { renderPackage } = await getGeneratedPackage();
  const candidate = structuredClone(renderPackage);
  const tvBody = candidate.components.find((component) => component.componentId.endsWith("/tv-body"));
  assert.ok(tvBody, "Drawing 4 package must contain the TV body");
  assert.equal(tvBody.submeshes.length, 1);

  tvBody.sourceWorldBounds.max.x -= 1;
  tvBody.blenderWorldBounds.max.x -= 0.0254;
  tvBody.submeshes[0].sourceWorldBounds.max.x -= 1;
  tvBody.submeshes[0].blenderWorldBounds.max.x -= 0.0254;
  candidate.renderKey = recomputePublicRenderKey(candidate);

  assert.notEqual(candidate.renderKey, EXPECTED_DRAWING_4_RENDER_KEY);
  const result = await runPythonPackageValidation(candidate);
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /\[UNSUPPORTED_RENDER_KEY\]/);
});

test("the committed result manifest accepts only the exact succeeded beauty record", async () => {
  const { renderPackage } = await getGeneratedPackage();
  const result = createBeautyResult(renderPackage, {
    bytes: 30,
    sha256: "a".repeat(64)
  });
  const valid = await validateGuidedBlenderRenderResult(renderPackage, result);
  assert.equal(valid.valid, true, JSON.stringify(valid.errors));

  const unknownField = structuredClone(result);
  unknownField.workerNote = "not part of the result schema";
  const rejectedShape = await validateGuidedBlenderRenderResult(renderPackage, unknownField);
  assert.equal(rejectedShape.valid, false);
  assert.ok(rejectedShape.errors.some((error) => error.code === "INVALID_RENDER_RESULT_SHAPE"));

  const stale = structuredClone(result);
  stale.renderKey = "jq-blender-package-v1-stale";
  const rejectedKey = await validateGuidedBlenderRenderResult(renderPackage, stale);
  assert.equal(rejectedKey.valid, false);
  assert.ok(rejectedKey.errors.some((error) => error.code === "RENDER_RESULT_KEY_MISMATCH"));
});

test("actual beauty bytes, SHA-256, and WebP dimensions are independently verified", async () => {
  const { renderPackage } = await getGeneratedPackage();
  const directory = await mkdtemp(join(tmpdir(), "jq-clay-output-"));
  const beautyPath = join(directory, "beauty.webp");
  const resultPath = join(directory, "result.json");

  try {
    const beautyBytes = createVp8xWebp(EXPECTED_WIDTH, EXPECTED_HEIGHT);
    const sha256 = createHash("sha256").update(beautyBytes).digest("hex");
    const result = createBeautyResult(renderPackage, {
      bytes: beautyBytes.length,
      sha256
    });
    await writeFile(beautyPath, beautyBytes);
    await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

    assert.deepEqual(readWebpDimensions(beautyBytes), {
      width: EXPECTED_WIDTH,
      height: EXPECTED_HEIGHT
    });
    const verified = await validateClayWorkerOutputs(renderPackage, {
      resultPath,
      beautyPath
    });
    assert.equal(verified.validation.valid, true, JSON.stringify(verified.validation.errors));
    assert.deepEqual(verified.beauty, {
      path: beautyPath,
      width: EXPECTED_WIDTH,
      height: EXPECTED_HEIGHT,
      bytes: beautyBytes.length,
      sha256
    });

    const incorrectHash = structuredClone(result);
    incorrectHash.outputs[0].sha256 = "0".repeat(64);
    await assert.rejects(
      verifyBeautyOutputIntegrity(renderPackage, incorrectHash, beautyPath),
      (error) => error instanceof BlenderClayRunnerError
        && error.code === "BEAUTY_SHA256_MISMATCH"
    );

    const wrongDimensions = createVp8xWebp(EXPECTED_WIDTH - 1, EXPECTED_HEIGHT);
    const wrongDimensionResult = structuredClone(result);
    wrongDimensionResult.outputs[0].bytes = wrongDimensions.length;
    wrongDimensionResult.outputs[0].sha256 = createHash("sha256")
      .update(wrongDimensions)
      .digest("hex");
    await writeFile(beautyPath, wrongDimensions);
    await assert.rejects(
      verifyBeautyOutputIntegrity(renderPackage, wrongDimensionResult, beautyPath),
      (error) => error instanceof BlenderClayRunnerError
        && error.code === "BEAUTY_WIDTH_MISMATCH"
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("Blender executable resolution honors BLENDER_BIN and the macOS default", () => {
  assert.equal(resolveBlenderExecutable({}), DEFAULT_BLENDER_EXECUTABLE);
  assert.equal(
    DEFAULT_BLENDER_EXECUTABLE,
    "/Applications/Blender.app/Contents/MacOS/Blender"
  );
  assert.equal(
    resolveBlenderExecutable({ BLENDER_BIN: "  /opt/blender-custom  " }),
    "/opt/blender-custom"
  );
  assert.throws(
    () => resolveBlenderExecutable({ BLENDER_BIN: "   " }),
    (error) => error instanceof BlenderClayRunnerError && error.code === "INVALID_BLENDER_BIN"
  );
});

function createBeautyResult(renderPackage, { bytes, sha256 }) {
  return {
    kind: "jq-guided-blender-render-result",
    schemaVersion: 1,
    renderKey: renderPackage.renderKey,
    pipelineVersion: GUIDED_BLENDER_RENDER_PIPELINE_VERSION,
    status: "succeeded",
    outputs: [{
      pass: "beauty",
      objectKey: `${renderPackage.renderKey}/beauty.webp`,
      mimeType: "image/webp",
      width: EXPECTED_WIDTH,
      height: EXPECTED_HEIGHT,
      bytes,
      sha256
    }]
  };
}

function recomputePublicRenderKey(renderPackage) {
  const payload = Object.fromEntries(
    Object.entries(renderPackage).filter(([key]) => key !== "renderKey")
  );
  const digest = createHash("sha256").update(stableStringify(payload)).digest("hex");
  return `jq-blender-package-v1-${digest}`;
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => (
    `${JSON.stringify(key)}:${stableStringify(value[key])}`
  )).join(",")}}`;
}

function createVp8xWebp(width, height) {
  assert.ok(Number.isInteger(width) && width > 0 && width <= 0x1000000);
  assert.ok(Number.isInteger(height) && height > 0 && height <= 0x1000000);
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

async function runPythonPackageValidation(renderPackage) {
  const directory = await mkdtemp(join(tmpdir(), "jq-clay-python-validation-"));
  try {
    const packagePath = join(directory, "render-package.json");
    await writeDeterministicJson(packagePath, renderPackage);
    return spawnSync("python3", [
      PYTHON_WORKER_PATH,
      "--validate-only",
      "--package",
      packagePath,
      "--project-root",
      REPOSITORY_ROOT
    ], {
      cwd: REPOSITORY_ROOT,
      encoding: "utf8"
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
