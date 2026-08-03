import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import {
  DEFAULT_BLENDER_EXECUTABLE,
  REPOSITORY_ROOT,
  resolveBlenderExecutable
} from "../tools/blender/run-clay-worker.mjs";
import {
  CROWN_QA_CAPTURE_PATHNAME,
  CROWN_QA_DETAIL_PATHNAME,
  CROWN_QA_WORKER_REPORT_PATHNAME,
  CrownQaRunnerError,
  createCrownQaBlenderArguments
} from "../tools/blender/run-crown-qa.mjs";

const OUTPUT_DIRECTORY = join(REPOSITORY_ROOT, "artifacts/blender-clay-worker/TV01");
const PATHS = Object.freeze({
  workerPath: join(REPOSITORY_ROOT, "tools/blender/clay_worker.py"),
  packagePath: join(OUTPUT_DIRECTORY, "render-package.json"),
  outputDirectory: OUTPUT_DIRECTORY,
  capturePath: join(OUTPUT_DIRECTORY, CROWN_QA_CAPTURE_PATHNAME),
  detailPath: join(OUTPUT_DIRECTORY, CROWN_QA_DETAIL_PATHNAME),
  workerReportPath: join(OUTPUT_DIRECTORY, CROWN_QA_WORKER_REPORT_PATHNAME),
  primaryBeautyPath: join(OUTPUT_DIRECTORY, "beauty.webp"),
  repositoryRoot: REPOSITORY_ROOT
});

test("crown QA uses the standard Blender path unless an explicit BLENDER_BIN is supplied", () => {
  assert.equal(resolveBlenderExecutable({}), DEFAULT_BLENDER_EXECUTABLE);
  assert.equal(
    resolveBlenderExecutable({ BLENDER_BIN: "/opt/blender-5.2/blender" }),
    "/opt/blender-5.2/blender"
  );
  assert.throws(
    () => resolveBlenderExecutable({ BLENDER_BIN: "" }),
    (error) => error.code === "INVALID_BLENDER_BIN"
  );
});

test("crown QA command is factory-clean, headless, package-driven, and output-separated", () => {
  const args = createCrownQaBlenderArguments(PATHS);
  assert.deepEqual(args, [
    "--background",
    "--factory-startup",
    "--python",
    PATHS.workerPath,
    "--",
    "--package",
    PATHS.packagePath,
    "--output-dir",
    PATHS.outputDirectory,
    "--crown-qa-capture",
    PATHS.capturePath,
    "--crown-detail",
    PATHS.detailPath,
    "--crown-worker-report",
    PATHS.workerReportPath,
    "--primary-beauty",
    PATHS.primaryBeautyPath,
    "--project-root",
    PATHS.repositoryRoot
  ]);
  assert.equal(args.includes("--blend"), false);
  assert.equal(args.includes("--beauty"), false);
  assert.equal(args.includes("--result"), false);
  assert.equal(Object.isFrozen(args), true);
});

test("crown QA rejects unknown, relative, and misnamed command paths", () => {
  assert.throws(
    () => createCrownQaBlenderArguments({ ...PATHS, unexpected: true }),
    (error) => error instanceof CrownQaRunnerError && error.code === "INVALID_CROWN_QA_PATHS"
  );
  assert.throws(
    () => createCrownQaBlenderArguments({ ...PATHS, detailPath: "crown-detail.webp" }),
    (error) => error instanceof CrownQaRunnerError && error.code === "RELATIVE_CROWN_QA_PATH"
  );
  assert.throws(
    () => createCrownQaBlenderArguments({
      ...PATHS,
      detailPath: join(OUTPUT_DIRECTORY, "beauty.webp")
    }),
    (error) => error instanceof CrownQaRunnerError && error.code === "INVALID_CROWN_QA_OUTPUT_PATH"
  );
});
