import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  MATERIAL_IDS,
  createGuidedBlenderMaterialPackage,
  createMaterialPackageKey,
  createMaterialsPreviewCaptureKey,
  deterministicJson,
  hashCanonical
} from "../tools/blender/materials-preview-contract.mjs";
import {
  REPOSITORY_ROOT,
  createVerifiedClayRenderPackage
} from "../tools/blender/run-clay-worker.mjs";

const PYTHON_WORKER_PATH = join(
  REPOSITORY_ROOT,
  "tools/blender/materials_preview_worker.py"
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

function getPackages() {
  packagesPromise ||= createVerifiedClayRenderPackage().then((generated) => ({
    generated,
    materialPackage: createGuidedBlenderMaterialPackage(generated.renderPackage, {
      primaryPackageJson: generated.packageJson,
      blenderRuntime: BLENDER_RUNTIME
    })
  }));
  return packagesPromise;
}

function rederiveMaterialAndCaptureKeys(materialPackage) {
  materialPackage.materialPackageKey = createMaterialPackageKey(materialPackage);
  const { captureKey: _staleCaptureKey, ...captureWithoutKey } = materialPackage.capture;
  materialPackage.capture.captureKey = createMaterialsPreviewCaptureKey(
    materialPackage.materialPackageKey,
    captureWithoutKey
  );
}

test("the pure Python material worker validates exact packages and rejects hostile sidecars without Blender", async (t) => {
  const { generated, materialPackage } = await getPackages();
  const directory = await mkdtemp(join(tmpdir(), "jq-material-worker-validation-"));
  const geometryPath = join(directory, "render-package.json");
  const materialPath = join(directory, "materials-package.json");

  async function validate(candidate) {
    await writeFile(materialPath, deterministicJson(candidate), "utf8");
    return spawnSync("python3", [
      PYTHON_WORKER_PATH,
      "--geometry-package",
      geometryPath,
      "--materials-package",
      materialPath,
      "--project-root",
      REPOSITORY_ROOT,
      "--validate-only"
    ], {
      cwd: REPOSITORY_ROOT,
      encoding: "utf8"
    });
  }

  try {
    await writeFile(geometryPath, generated.packageJson, "utf8");

    await t.test("the exact authoritative geometry and material JSON succeeds", async () => {
      const result = await validate(materialPackage);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stderr, "");
      assert.deepEqual(JSON.parse(result.stdout), {
        valid: true,
        materialPackageKey: materialPackage.materialPackageKey,
        captureKey: materialPackage.capture.captureKey,
        bindingCount: 80,
        materialFrameCount: 65
      });
      assert.equal(
        materialPackage.translatorPolicy.policyId,
        "jq-blender-material-translation-policy-v1"
      );
      const lens = materialPackage.materialLibrary.find((entry) => (
        entry.materialId === MATERIAL_IDS.lens
      ));
      assert.deepEqual(lens.parameters.emissionColor, [
        1, 0.896269353374, 0.737910408773, 1
      ]);
      assert.equal(lens.parameters.emissionStrength, 6);
      assert.equal(lens.parameters.colorTemperatureK, 2700);
    });

    const hostileCases = [
      {
        label: "a policy value change fails closed after canonical re-keying",
        code: "BLENDER_TRANSLATION_POLICY_INVALID",
        mutate(candidate) {
          candidate.translatorPolicy.principled.sheenRoughness = 0.6;
          rederiveMaterialAndCaptureKeys(candidate);
        }
      },
      {
        label: "an unknown nested policy property fails closed after re-keying",
        code: "UNKNOWN_OR_MISSING_PROPERTY",
        mutate(candidate) {
          candidate.translatorPolicy.noise.unversionedBias = 0;
          rederiveMaterialAndCaptureKeys(candidate);
        }
      },
      {
        label: "a translation-policy version mismatch fails closed after re-keying",
        code: "MATERIAL_VERSION_MISMATCH",
        mutate(candidate) {
          candidate.versions.blenderTranslationPolicyVersion =
            "jq-blender-material-translation-policy-v999";
          rederiveMaterialAndCaptureKeys(candidate);
        }
      },
      {
        label: "a wrong policy numeric type fails closed after re-keying",
        code: "BLENDER_TRANSLATION_POLICY_INVALID",
        mutate(candidate) {
          candidate.translatorPolicy.bump.filterWidth = "0.1";
          rederiveMaterialAndCaptureKeys(candidate);
        }
      },
      {
        label: "warm-opal emission cannot drift from verified package authority",
        code: "MATERIAL_RECIPE_DRIFT",
        mutate(candidate) {
          const lens = candidate.materialLibrary.find((entry) => (
            entry.materialId === MATERIAL_IDS.lens
          ));
          lens.parameters.emissionStrength = 3.2;
          rederiveMaterialAndCaptureKeys(candidate);
        }
      },
      {
        label: "unknown shader topology remains rejected after canonical re-keying",
        code: "MATERIAL_RECIPE_DRIFT",
        mutate(candidate) {
          const oak = candidate.materialLibrary.find((entry) => (
            entry.materialId === MATERIAL_IDS.oak
          ));
          assert.ok(oak);
          oak.shaderTopologyId = "jq-blender-pbr-node-topology-v999/procedural-oak";
          rederiveMaterialAndCaptureKeys(candidate);
        }
      },
      {
        label: "a changed exact recipe remains rejected after canonical re-keying",
        code: "MATERIAL_RECIPE_DRIFT",
        mutate(candidate) {
          const oak = candidate.materialLibrary.find((entry) => (
            entry.materialId === MATERIAL_IDS.oak
          ));
          assert.ok(oak);
          oak.parameters.roughness += 0.01;
          rederiveMaterialAndCaptureKeys(candidate);
        },
        after(candidate) {
          assert.notEqual(candidate.materialPackageKey, materialPackage.materialPackageKey);
          assert.notEqual(candidate.capture.captureKey, materialPackage.capture.captureKey);
        }
      },
      {
        label: "a zero-length material-frame axis fails closed",
        code: "NON_NORMALIZED_MATERIAL_FRAME",
        mutate(candidate) {
          candidate.materialFrames[0].grainAxis = [0, 0, 0];
        }
      },
      {
        label: "a valid but semantically rederived frame remains rejected after re-keying",
        code: "MATERIAL_FRAME_DERIVATION_MISMATCH",
        mutate(candidate) {
          const frame = candidate.materialFrames[0];
          frame.grainAxis = [0, 1, 0];
          frame.crossGrainAxis = [0, 0, 1];
          frame.normalAxis = [1, 0, 0];
          const { mappingDigest: _staleDigest, ...frameCore } = frame;
          frame.mappingDigest = hashCanonical(frameCore);
          rederiveMaterialAndCaptureKeys(candidate);
        }
      },
      {
        label: "duplicate material IDs fail closed",
        code: "DUPLICATE_MATERIAL_ID",
        mutate(candidate) {
          candidate.materialLibrary[1].materialId = candidate.materialLibrary[0].materialId;
        }
      },
      {
        label: "duplicate material-frame IDs fail closed",
        code: "DUPLICATE_MATERIAL_FRAME",
        mutate(candidate) {
          candidate.materialFrames[1].frameId = candidate.materialFrames[0].frameId;
        }
      },
      {
        label: "duplicate binding IDs fail closed",
        code: "CONFLICTING_MATERIAL_BINDING",
        mutate(candidate) {
          candidate.bindings[1].bindingId = candidate.bindings[0].bindingId;
        }
      },
      {
        label: "an unknown top-level property fails closed",
        code: "UNKNOWN_OR_MISSING_PROPERTY",
        mutate(candidate) {
          candidate.unversionedWorkerHint = true;
        }
      },
      {
        label: "true displacement policy fails closed",
        code: "EXTERNAL_OR_DISPLACEMENT_FORBIDDEN",
        mutate(candidate) {
          candidate.materialLibrary[0].trueDisplacement = true;
        }
      },
      {
        label: "camera mutation fails closed",
        code: "CAPTURE_IDENTITY_MUTATION",
        mutate(candidate) {
          candidate.capture.camera.position.x += 0.01;
        }
      },
      {
        label: "render-policy mutation fails closed",
        code: "MATERIAL_RENDER_POLICY_INVALID",
        mutate(candidate) {
          candidate.capture.renderPolicy.samples = 64;
        }
      },
      {
        label: "output redirection to the clay beauty fails closed",
        code: "MATERIAL_OUTPUT_CONTRACT_INVALID",
        mutate(candidate) {
          candidate.capture.output.filename = "beauty.webp";
        }
      }
    ];

    for (const hostileCase of hostileCases) {
      await t.test(hostileCase.label, async () => {
        const candidate = structuredClone(materialPackage);
        hostileCase.mutate(candidate);
        hostileCase.after?.(candidate);
        const result = await validate(candidate);
        assert.equal(result.status, 2, result.stderr);
        assert.match(result.stderr, new RegExp(`\\[${hostileCase.code}\\]`));
        assert.equal(result.stdout, "");
      });
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("the materials-preview CLI is isolated, fresh, and CI validation does not import Blender", async () => {
  const packageJson = JSON.parse(await readFile(
    new URL("../package.json", import.meta.url),
    "utf8"
  ));
  const runnerSource = await readFile(
    new URL("../tools/blender/run-materials-preview.mjs", import.meta.url),
    "utf8"
  );
  const workerSource = await readFile(
    new URL("../tools/blender/materials_preview_worker.py", import.meta.url),
    "utf8"
  );

  assert.equal(
    packageJson.scripts["blender:materials-preview"],
    "node tools/blender/run-materials-preview.mjs"
  );
  assert.match(runnerSource, /mkdtemp\(join\(tmpdir\(\), "jq-materials-preview-"\)\)/);
  assert.match(runnerSource, /"--background",\s*"--factory-startup"/);
  assert.match(workerSource, /parser\.add_argument\("--validate-only", action="store_true"\)/);
  assert.match(workerSource, /if arguments\.validate_only:[\s\S]*?return 0/);
  assert.doesNotMatch(workerSource, /^import bpy$/m);
  assert.match(workerSource, /def render_material_preview\([\s\S]*?\n\s+import bpy\n/);
  assert.match(workerSource, /"materials-preview\.webp"/);
  assert.match(workerSource, /"TV01-materials-preview\.blend"/);
  assert.match(workerSource, /"OUTPUT_DIRECTORY_NOT_FRESH"/);
  assert.match(workerSource, /"STALE_OUTPUT_FORBIDDEN"/);
  assert.match(workerSource, /def validate_translator_policy\(/);
  assert.match(workerSource, /def shader_parameter_audit\(/);
  assert.match(workerSource, /shaderParametersBeforeSha256/);
  assert.match(workerSource, /shaderParametersAfterSha256/);
  assert.match(workerSource, /translator_policy\["principled"\]/);
  assert.match(workerSource, /translator_policy\["vectorMath"\]/);
  assert.doesNotMatch(workerSource, /shader\.distribution\s*=\s*"MULTI_GGX"/);
  assert.doesNotMatch(
    workerSource,
    /expected\s*=\s*\{[\s\S]*?beauty\.webp[\s\S]*?\}/
  );
});
