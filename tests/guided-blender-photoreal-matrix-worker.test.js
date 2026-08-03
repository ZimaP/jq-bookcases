import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  createPhotorealMatrixRenderPackage,
  deterministicJson
} from "../tools/blender/photoreal-matrix-contract.mjs";

const WORKER = resolve("tools/blender/photoreal_matrix_worker.py");

test("matrix worker compiles and validates a canonical package before importing bpy", async () => {
  const compile = spawnSync("python3", ["-m", "py_compile", WORKER], { encoding: "utf8" });
  assert.equal(compile.status, 0, compile.stderr);

  const directory = await mkdtemp(join(tmpdir(), "jq-matrix-worker-"));
  const packagePath = join(directory, "render-package.json");
  const renderPackage = createPhotorealMatrixRenderPackage("cabinet-shelves", "clear-wall", {
    sourceCommit: "0".repeat(40)
  });
  await writeFile(packagePath, deterministicJson(renderPackage), "utf8");
  const validation = spawnSync("python3", [
    WORKER,
    "--package", packagePath,
    "--validate-only"
  ], { encoding: "utf8" });
  assert.equal(validation.status, 0, validation.stderr);
  const result = JSON.parse(validation.stdout.trim());
  assert.equal(result.valid, true);
  assert.equal(result.key, "cabinet-shelves:clear-wall");
  assert.ok(result.components > 0);
  assert.ok(result.submeshes >= result.components);
});

test("matrix worker honors Blender's double-dash argument boundary", async () => {
  const directory = await mkdtemp(join(tmpdir(), "jq-matrix-worker-argv-"));
  const packagePath = join(directory, "render-package.json");
  await writeFile(
    packagePath,
    deterministicJson(createPhotorealMatrixRenderPackage("open-shelving", "right-niche", {
      sourceCommit: "0".repeat(40)
    })),
    "utf8"
  );
  const script = [
    "import importlib.util,sys;",
    `p=${JSON.stringify(WORKER)};`,
    "s=importlib.util.spec_from_file_location('matrix_worker',p);",
    "m=importlib.util.module_from_spec(s);s.loader.exec_module(m);",
    "raise SystemExit(m.main(['blender','--background','--','--package',sys.argv[1],'--validate-only']))"
  ].join("");
  const validation = spawnSync("python3", ["-c", script, packagePath], { encoding: "utf8" });
  assert.equal(validation.status, 0, validation.stderr);
  assert.equal(JSON.parse(validation.stdout.trim()).key, "open-shelving:right-niche");
});
