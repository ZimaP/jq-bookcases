import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  createGuidedBlenderMaterialPackage,
  deterministicJson
} from "../tools/blender/materials-preview-contract.mjs";
import {
  EXPECTED_PHASE6_REPORT_COUNTS,
  EXPECTED_PHASE6_REPORT_DIGESTS,
  EXPECTED_PHASE6_REPORT_PARITY,
  PHOTOREAL_OUTPUT_FILENAMES,
  PHOTOREAL_PRESENTATION_PIPELINE_VERSION,
  createGuidedBlenderPhotorealPresentationPackage,
  createGuidedBlenderPhotorealPresentationResult,
  hashCanonical
} from "../tools/blender/photoreal-presentation-contract.mjs";
import {
  EXPECTED_PRESENTATION_REPORT_SHA256,
  validatePhotorealPresentationReport
} from "../tools/blender/run-photoreal-presentation.mjs";
import {
  REPOSITORY_ROOT,
  createVerifiedClayRenderPackage
} from "../tools/blender/run-clay-worker.mjs";

const PYTHON_WORKER_PATH = join(
  REPOSITORY_ROOT,
  "tools/blender/photoreal_presentation_worker.py"
);
const BLENDER_RUNTIME = Object.freeze({
  version: "5.2.0 LTS",
  buildHash: "fbe6228777e7",
  backend: "METAL",
  vendor: "Apple M4",
  renderer: "Metal API",
  deviceVersion: "1.2"
});

let packagesPromise;

function phase6Report() {
  return {
    kind: "jq-local-blender-materials-preview-report",
    schemaVersion: 1,
    status: "succeeded",
    resultKey: "jq-materials-preview-result-v1-367133ae6a20e4a562159a67d38b993396a3d94ec7ac8a3710fac395e857314e",
    materialPackageKey: "jq-render-material-package-v1-6d180ecff47487de4692620d5387b7bde3b827a5a0a5f6b4ad438cb6335d2794",
    captureKey: "jq-materials-preview-v1-ea08c048092d14f80da06924ec82126c8edae36a388b785313bac02e763b91ea",
    parity: structuredClone(EXPECTED_PHASE6_REPORT_PARITY),
    counts: structuredClone(EXPECTED_PHASE6_REPORT_COUNTS),
    digests: structuredClone(EXPECTED_PHASE6_REPORT_DIGESTS)
  };
}

function getPackages() {
  packagesPromise ||= createVerifiedClayRenderPackage().then((generated) => {
    const materialPackage = createGuidedBlenderMaterialPackage(generated.renderPackage, {
      primaryPackageJson: generated.packageJson,
      blenderRuntime: BLENDER_RUNTIME
    });
    const presentationPackage = createGuidedBlenderPhotorealPresentationPackage(
      generated.renderPackage,
      materialPackage,
      phase6Report(),
      { blenderRuntime: BLENDER_RUNTIME }
    );
    return { generated, materialPackage, presentationPackage };
  });
  return packagesPromise;
}

function runWorker(arguments_) {
  return spawnSync("python3", [PYTHON_WORKER_PATH, ...arguments_], {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8"
  });
}

test("the photoreal worker validates the exact additive presentation contract without importing Blender", async () => {
  const { generated, materialPackage, presentationPackage } = await getPackages();
  const directory = await mkdtemp(join(tmpdir(), "jq-photoreal-worker-validation-"));
  const geometryPath = join(directory, "render-package.json");
  const materialPath = join(directory, "materials-package.json");
  const presentationPath = join(directory, "presentation-package.json");

  try {
    await writeFile(geometryPath, generated.packageJson, "utf8");
    await writeFile(materialPath, deterministicJson(materialPackage), "utf8");
    await writeFile(presentationPath, deterministicJson(presentationPackage), "utf8");
    const result = runWorker([
      "--geometry-package", geometryPath,
      "--materials-package", materialPath,
      "--presentation-package", presentationPath,
      "--project-root", REPOSITORY_ROOT,
      "--validate-only"
    ]);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    assert.deepEqual(JSON.parse(result.stdout), {
      valid: true,
      presentationPackageKey: presentationPackage.presentationPackageKey,
      captureKey: presentationPackage.capture.captureKey,
      lightCount: 4
    });

    const render = presentationPackage.capture.renderPolicy;
    assert.deepEqual({
      engine: render.engine,
      blenderEngine: render.blenderEngine,
      computeDeviceType: render.computeDeviceType,
      deviceType: render.deviceType,
      deviceName: render.deviceName,
      sceneDevice: render.sceneDevice,
      denoising: render.denoising
    }, {
      engine: "CYCLES",
      blenderEngine: "CYCLES",
      computeDeviceType: "METAL",
      deviceType: "METAL",
      deviceName: "Apple M4 (GPU - 10 cores)",
      sceneDevice: "GPU",
      denoising: {
        enabled: true,
        denoiser: "OPENIMAGEDENOISE",
        inputPasses: "RGB_ALBEDO_NORMAL",
        prefilter: "ACCURATE",
        quality: "HIGH",
        useGpu: false
      }
    });
    assert.deepEqual(
      presentationPackage.capture.outputs.map(({ filename, mimeType }) => ({
        filename,
        mimeType
      })),
      [
        { filename: PHOTOREAL_OUTPUT_FILENAMES.master, mimeType: "image/png" },
        { filename: PHOTOREAL_OUTPUT_FILENAMES.beauty, mimeType: "image/webp" }
      ]
    );
    assert.equal(presentationPackage.presentation.edgeSoftening.enabled, false);
    assert.equal(presentationPackage.presentation.edgeSoftening.modifierCount, 0);
    assert.equal(presentationPackage.presentation.roomMaterials.length, 2);
    assert.deepEqual(
      presentationPackage.presentation.roomMaterials.map((entry) => entry.targetObjectId).sort(),
      ["room-floor", "room-rear-wall"]
    );
    assert.equal(presentationPackage.presentation.lights.length, 4);
    const puckLights = presentationPackage.presentation.lights.filter(({ anchor }) => anchor);
    assert.equal(puckLights.length, 2);
    assert.deepEqual(
      puckLights.map(({ blenderType, anchor }) => ({
        blenderType,
        surfaceRole: anchor.surfaceRole,
        materialId: anchor.materialId,
        center: anchor.center
      })),
      [
        {
          blenderType: "SPOT",
          surfaceRole: "emissive-lens",
          materialId: "warm-opal-puck-lens-v1",
          center: { x: -1.12395, y: 0.28575, z: 2.41379375 }
        },
        {
          blenderType: "SPOT",
          surfaceRole: "emissive-lens",
          materialId: "warm-opal-puck-lens-v1",
          center: { x: 1.12395, y: 0.28575, z: 2.41379375 }
        }
      ]
    );
    assert.equal(presentationPackage.phase6Foundation.counts.cameras, 1);
    assert.equal(presentationPackage.phase6Foundation.counts.lights, 0);
    assert.equal(presentationPackage.phase6Foundation.counts.modifiers, 0);
    assert.notEqual(
      presentationPackage.presentation.camera.blenderObjectName,
      "JQ_HERO_CAMERA"
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("the photoreal worker fails closed on stale identity, output collisions, and stale render files before bpy", async (t) => {
  const { generated, materialPackage, presentationPackage } = await getPackages();
  const directory = await mkdtemp(join(tmpdir(), "jq-photoreal-worker-hostile-"));
  const geometryPath = join(directory, "render-package.json");
  const materialPath = join(directory, "materials-package.json");
  const presentationPath = join(directory, "presentation-package.json");

  try {
    await writeFile(geometryPath, generated.packageJson, "utf8");
    await writeFile(materialPath, deterministicJson(materialPackage), "utf8");

    await t.test("a stale presentation-package key is rejected", async () => {
      const candidate = structuredClone(presentationPackage);
      candidate.presentationPackageKey = `${candidate.presentationPackageKey.slice(0, -1)}${
        candidate.presentationPackageKey.endsWith("0") ? "1" : "0"
      }`;
      await writeFile(presentationPath, deterministicJson(candidate), "utf8");
      const result = runWorker([
        "--geometry-package", geometryPath,
        "--materials-package", materialPath,
        "--presentation-package", presentationPath,
        "--project-root", REPOSITORY_ROOT,
        "--validate-only"
      ]);
      assert.equal(result.status, 2, result.stderr);
      assert.match(result.stderr, /\[STALE_PRESENTATION_PACKAGE_KEY\]/);
      assert.equal(result.stdout, "");
    });

    await t.test("cross-wiring master and beauty destinations is rejected", async () => {
      const sourceBlend = join(directory, "TV01-materials-preview.blend");
      const outputDirectory = join(directory, "outputs");
      await writeFile(sourceBlend, "not opened: path validation fails first", "utf8");
      const master = join(outputDirectory, PHOTOREAL_OUTPUT_FILENAMES.master);
      const result = runWorker([
        "--geometry-package", geometryPath,
        "--materials-package", materialPath,
        "--presentation-package", presentationPath,
        "--project-root", REPOSITORY_ROOT,
        "--source-blend", sourceBlend,
        "--output-dir", outputDirectory,
        "--blend", join(outputDirectory, PHOTOREAL_OUTPUT_FILENAMES.blend),
        "--master", master,
        "--beauty", master,
        "--result", join(outputDirectory, PHOTOREAL_OUTPUT_FILENAMES.result),
        "--report", join(outputDirectory, PHOTOREAL_OUTPUT_FILENAMES.report)
      ]);
      assert.equal(result.status, 2, result.stderr);
      assert.match(result.stderr, /\[INVALID_OUTPUT_PATH\]/);
      assert.equal(result.stdout, "");
    });

    await t.test("a pre-existing presentation output is rejected as stale", async () => {
      const sourceBlend = join(directory, "TV01-materials-preview.blend");
      const outputDirectory = join(directory, "freshness");
      const paths = Object.fromEntries(Object.entries(PHOTOREAL_OUTPUT_FILENAMES).map(
        ([key, filename]) => [key, join(outputDirectory, filename)]
      ));
      await mkdir(outputDirectory);
      await writeFile(sourceBlend, "not opened: freshness validation fails first", "utf8");
      await writeFile(paths.master, "stale", "utf8");
      const result = runWorker([
        "--geometry-package", geometryPath,
        "--materials-package", materialPath,
        "--presentation-package", presentationPath,
        "--project-root", REPOSITORY_ROOT,
        "--source-blend", sourceBlend,
        "--output-dir", outputDirectory,
        "--blend", paths.blend,
        "--master", paths.master,
        "--beauty", paths.beauty,
        "--result", paths.result,
        "--report", paths.report
      ]);
      assert.equal(result.status, 2, result.stderr);
      assert.match(result.stderr, /\[STALE_OUTPUT_FORBIDDEN\]/);
      assert.equal(result.stdout, "");
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("the Blender mutation surface is presentation-only and preserves the Phase 6 source scene", async () => {
  const workerSource = await readFile(PYTHON_WORKER_PATH, "utf8");

  assert.doesNotMatch(workerSource, /^import bpy$/m);
  assert.match(workerSource, /def render_presentation\([\s\S]*?\n\s+import bpy\n/);
  assert.match(workerSource, /source_blend_sha = clay\.file_sha256\(paths\["sourceBlend"\]\)/);
  assert.match(workerSource, /bpy\.ops\.wm\.open_mainfile\(filepath=str\(paths\["sourceBlend"\]\)\)/);
  assert.match(workerSource, /if clay\.file_sha256\(paths\["sourceBlend"\]\) != source_blend_sha:/);
  assert.match(workerSource, /fail\("SOURCE_BLEND_MUTATION"/);

  assert.equal((workerSource.match(/bpy\.data\.objects\.new\(/g) || []).length, 2);
  assert.doesNotMatch(workerSource, /bpy\.data\.meshes\.new\(/);
  assert.doesNotMatch(workerSource, /bpy\.ops\.mesh\./);
  assert.doesNotMatch(workerSource, /\.modifiers\.new\(/);
  assert.match(
    workerSource,
    /expected_object_names = source_object_names \+ \[camera_name\] \+ light_names/
  );
  assert.match(
    workerSource,
    /if sum\(len\(obj\.modifiers\) for obj in scene\.objects\) != 0:[\s\S]*?PRESENTATION_MODIFIER_FORBIDDEN/
  );
  assert.match(workerSource, /PRESENTATION_OBJECT_DRIFT/);
  assert.match(workerSource, /PRESENTATION_GEOMETRY_MUTATION/);
  assert.match(workerSource, /PHASE6_PRODUCT_MATERIAL_MUTATION/);
  assert.match(workerSource, /PHASE6_SHADER_MUTATION/);

  assert.match(
    workerSource,
    /source_hero_camera = materials\.camera_snapshot\(bpy\.data\.objects\[materials\.HERO_CAMERA_NAME\]\)/
  );
  assert.match(workerSource, /fail\("SOURCE_CAMERA_MUTATION"/);
  assert.match(workerSource, /source_world_snapshot = materials\.world_snapshot\(source_world\)/);
  assert.match(workerSource, /fail\("SOURCE_WORLD_MUTATION"/);
  assert.match(workerSource, /source_world\.use_fake_user = True/);

  assert.match(workerSource, /scene\.render\.engine = policy\["blenderEngine"\]/);
  assert.match(workerSource, /preferences\.compute_device_type = policy\["computeDeviceType"\]/);
  assert.match(workerSource, /cycles\.denoiser = policy\["denoising"\]\["denoiser"\]/);
  assert.match(workerSource, /cycles\.denoising_input_passes = policy\["denoising"\]\["inputPasses"\]/);
  assert.match(workerSource, /cycles\.denoising_prefilter = policy\["denoising"\]\["prefilter"\]/);
  assert.match(workerSource, /cycles\.denoising_quality = policy\["denoising"\]\["quality"\]/);

  assert.equal((workerSource.match(/bpy\.ops\.render\.render\(/g) || []).length, 1);
  assert.equal((workerSource.match(/render_result\.save_render\(/g) || []).length, 1);
  assert.match(
    workerSource,
    /bpy\.ops\.render\.render\(write_still=True\)[\s\S]*?render_result = bpy\.data\.images\.get\("Render Result"\)[\s\S]*?configure_webp_image_settings[\s\S]*?render_result\.save_render/
  );
  assert.match(workerSource, /settings\.file_format = "PNG"/);
  assert.match(workerSource, /settings\.file_format = "WEBP"/);
  assert.match(workerSource, /OUTPUT_ENCODING_COLLISION/);
});

test("the npm beauty command delegates to the isolated factory-startup runner", async () => {
  const packageJson = JSON.parse(await readFile(join(REPOSITORY_ROOT, "package.json"), "utf8"));
  const runnerSource = await readFile(
    join(REPOSITORY_ROOT, "tools/blender/run-photoreal-presentation.mjs"),
    "utf8"
  );

  assert.equal(
    packageJson.scripts["blender:photoreal"],
    "node tools/blender/run-photoreal-presentation.mjs"
  );
  assert.match(runnerSource, /resolveBlenderExecutable\(options\.environment \|\| process\.env\)/);
  assert.match(runnerSource, /mkdtemp\(join\(tmpdir\(\), "jq-photoreal-presentation-"\)\)/);
  assert.match(runnerSource, /"--background",\s*"--factory-startup"/);
  assert.match(runnerSource, /MATERIALS_PREVIEW_BLEND_FILENAME/);
  assert.match(runnerSource, /snapshotPhase6Foundation\(outputDirectory\)/);
  assert.match(runnerSource, /assertPhase6FoundationUnchanged\(outputDirectory, foundationBefore\)/);
  assert.match(runnerSource, /PHOTOREAL_MASTER_FILENAME = "photoreal-beauty-master\.png"/);
  assert.match(runnerSource, /PHOTOREAL_BEAUTY_FILENAME = "photoreal-beauty\.webp"/);
  assert.doesNotMatch(runnerSource, /git\s+(?:push|merge)|deploy-pages|gh\s+pr/i);
});

test("the runner rejects any drift in observed Blender presentation evidence", async (t) => {
  const { presentationPackage } = await getPackages();
  const presentation = JSON.parse(await readFile(join(
    REPOSITORY_ROOT,
    "tests/fixtures/blender-prototype/TV01-photoreal-presentation-snapshot.json"
  ), "utf8"));
  assert.equal(hashCanonical(presentation), EXPECTED_PRESENTATION_REPORT_SHA256);

  const sourceBlendSha256 = "a".repeat(64);
  const outputs = presentationPackage.capture.outputs.map((contract, index) => ({
    pass: contract.pass,
    objectKey: `${presentationPackage.capture.captureKey}/${contract.filename}`,
    mimeType: contract.mimeType,
    width: contract.width,
    height: contract.height,
    bytes: 1000 + index,
    sha256: String(index + 1).repeat(64)
  }));
  const result = createGuidedBlenderPhotorealPresentationResult(
    presentationPackage,
    outputs
  );
  const foundation = presentationPackage.phase6Foundation;
  const report = {
    blenderRuntime: structuredClone(presentationPackage.capture.blenderRuntime),
    captureKey: presentationPackage.capture.captureKey,
    counts: {
      objects: 93,
      meshObjects: 87,
      meshes: 87,
      cameras: 2,
      lights: 4,
      collections: 6,
      modifiers: 0,
      materials: 72
    },
    kind: "jq-local-blender-photoreal-beauty-report",
    outputs: structuredClone(result.outputs),
    parity: {
      bounds: true,
      geometry: true,
      phase6Camera: true,
      phase6ShaderParameters: true,
      phase6World: true,
      productMaterials: true,
      sourceBlendFile: true,
      topology: true,
      transforms: true
    },
    presentation,
    presentationPackageKey: presentationPackage.presentationPackageKey,
    presentationPipelineVersion: PHOTOREAL_PRESENTATION_PIPELINE_VERSION,
    resultKey: result.resultKey,
    schemaVersion: 1,
    source: {
      blendSha256: sourceBlendSha256,
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
    },
    status: "succeeded"
  };
  const master = { sha256: outputs[0].sha256 };
  const beauty = { sha256: outputs[1].sha256 };
  assert.equal(validatePhotorealPresentationReport(
    report,
    presentationPackage,
    result,
    master,
    beauty,
    sourceBlendSha256
  ), true);

  const cases = [
    ["camera lens", "PRESENTATION_REPORT_SCENE_MISMATCH", (value) => { value.presentation.camera.lensMm = 1; }],
    ["key-light energy", "PRESENTATION_REPORT_SCENE_MISMATCH", (value) => { value.presentation.lights[0].energyW = 999999; }],
    ["Cycles samples", "PRESENTATION_REPORT_SCENE_MISMATCH", (value) => { value.presentation.render.cycles.samples = 1; }],
    ["world identity", "PRESENTATION_REPORT_SCENE_MISMATCH", (value) => { value.presentation.world.name = "mutated"; }],
    ["unknown presentation evidence", "PRESENTATION_REPORT_SCENE_MISMATCH", (value) => { value.presentation.uncontracted = true; }],
    ["source blend digest", "PRESENTATION_REPORT_SOURCE_MISMATCH", (value) => { value.source.blendSha256 = "b".repeat(64); }],
    ["unknown source evidence", "PRESENTATION_REPORT_SOURCE_MISMATCH", (value) => { value.source.uncontracted = true; }],
    ["empty parity evidence", "PRESENTATION_REPORT_PARITY_FAILED", (value) => { value.parity = {}; }]
  ];
  for (const [name, code, mutate] of cases) {
    await t.test(name, () => {
      const invalid = structuredClone(report);
      mutate(invalid);
      assert.throws(
        () => validatePhotorealPresentationReport(
          invalid,
          presentationPackage,
          result,
          master,
          beauty,
          sourceBlendSha256
        ),
        (error) => error?.code === code,
        name
      );
    });
  }
});
