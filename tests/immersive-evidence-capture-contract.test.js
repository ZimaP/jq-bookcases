import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertContainedOutputPath,
  buildScenarioPlan,
  makeUtcRunId,
  parseCli,
  sanitizeUrlPath,
  validateManifest
} from "../scripts/capture-immersive-layout-evidence.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const digest = "a".repeat(64);

test("package and ignore contracts keep evidence local and syntax-checked", async () => {
  const [packageSource, ignoreSource, scriptSource] = await Promise.all([
    readFile(join(root, "package.json"), "utf8"),
    readFile(join(root, ".gitignore"), "utf8"),
    readFile(join(root, "scripts/capture-immersive-layout-evidence.mjs"), "utf8")
  ]);
  const packageJson = JSON.parse(packageSource);
  assert.equal(packageJson.scripts["evidence:immersive"], "node scripts/capture-immersive-layout-evidence.mjs");
  assert.match(packageJson.scripts.build, /node --check scripts\/capture-immersive-layout-evidence\.mjs/);
  assert.match(ignoreSource, /^\.local-proof\/$/m);
  assert.match(scriptSource, /\.local-proof\/immersive-layout-configurator-v1/);
  assert.doesNotMatch(scriptSource, /["']output["']\s*:/);
});

test("evidence output is fixed, timestamped, and collision-oriented", () => {
  const runId = makeUtcRunId(new Date("2026-08-18T03:12:45.678Z"));
  assert.equal(runId, "run-20260818T031245678Z");
  assert.match(runId, /^run-\d{8}T\d{9}Z$/);
  const contained = assertContainedOutputPath(join(root, ".local-proof/immersive-layout-configurator-v1", runId));
  assert.equal(contained, join(root, ".local-proof/immersive-layout-configurator-v1", runId));
  assert.throws(() => assertContainedOutputPath(join(root, "artifacts", runId)), /escaped/);
  assert.throws(() => parseCli(["--output", "/tmp/evidence"]), /Unknown option/);
});

test("scenario matrix covers all layouts, extrema, responsive states, and faults", () => {
  const candidate = buildScenarioPlan("candidate");
  assert.equal(candidate.length, 21);
  assert.deepEqual(candidate.slice(0, 2).map(({ category }) => category), ["step-1", "step-2"]);
  for (const layoutId of ["fireplace-wall", "door-wall", "window-wall"]) {
    assert.deepEqual(
      candidate.filter((entry) => entry.layoutId === layoutId && entry.category === "layout-extreme").map(({ dimensionState }) => dimensionState),
      ["min", "native", "max"]
    );
  }
  assert.deepEqual(
    candidate.filter(({ category }) => category === "mobile").map(({ customizationMode }) => customizationMode),
    ["view", "dimensions", "options"]
  );
  assert.ok(candidate.some(({ category, backend }) => category === "handle-active" && backend === "webgl2"));
  assert.ok(candidate.some(({ category }) => category === "loading"));
  assert.ok(candidate.some(({ category }) => category === "error"));
  assert.deepEqual(
    candidate.filter(({ category }) => category === "zone-proof").map(({ layoutId }) => layoutId),
    ["fireplace-wall", "door-wall", "window-wall"]
  );
  assert.equal(buildScenarioPlan("live").at(-1).category, "live-confirmation");
});

test("URL recording strips query strings and fragments", () => {
  assert.equal(
    sanitizeUrlPath("https://example.test/assets/model.glb?token=secret#fragment"),
    "/assets/model.glb"
  );
});

test("manifest validation rejects unsafe paths and unsupported WebGPU skips", () => {
  const plan = buildScenarioPlan("candidate");
  const manifest = {
    schema: "jq-immersive-layout-evidence-v1",
    schemaVersion: 1,
    run: {
      phase: "candidate",
      expectedRevision: null,
      output: ".local-proof/immersive-layout-configurator-v1/run-test"
    },
    source: {
      sourceKind: "working-tree",
      exactRevision: null,
      untrackedPaths: ["guided-layout-viewer.js"]
    },
    toolchain: {
      captureScript: "scripts/capture-immersive-layout-evidence.mjs"
    },
    revisionVerification: { complete: true },
    backendCoverage: {
      adapterProbe: { available: false, reason: "requestAdapter returned null" },
      actualBackends: ["webgl2"],
      webGpuSkip: { allowed: true, reason: "requestAdapter returned null" }
    },
    captures: plan.map(({ id }) => ({
      id,
      screenshot: { path: id + ".png", bytes: 1, sha256: digest }
    }))
  };
  assert.equal(validateManifest(manifest), true);
  manifest.captures[0].screenshot.path = "/tmp/escaped.png";
  assert.throws(() => validateManifest(manifest), /absolute filesystem path/);
  manifest.captures[0].screenshot.path = "safe.png";
  manifest.source.exactRevision = "1".repeat(40);
  assert.throws(() => validateManifest(manifest), /Dirty candidate evidence/);
  manifest.source.exactRevision = null;
  manifest.backendCoverage.adapterProbe.available = true;
  manifest.backendCoverage.webGpuSkip = null;
  assert.throws(() => validateManifest(manifest), /WebGPU support was proven/);
});

test("live CLI and manifest require one exact revision and complete byte proof", () => {
  assert.throws(() => parseCli(["--phase", "live"]), /expected-revision/);
  const revision = "1".repeat(40);
  const options = parseCli(["--phase", "live", "--expected-revision", revision]);
  assert.equal(options.expectedRevision, revision);
  const plan = buildScenarioPlan("live");
  const manifest = {
    schema: "jq-immersive-layout-evidence-v1",
    schemaVersion: 1,
    run: {
      phase: "live",
      expectedRevision: revision,
      output: ".local-proof/immersive-layout-configurator-v1/run-live"
    },
    source: {
      sourceKind: "commit",
      exactRevision: revision,
      untrackedPaths: []
    },
    toolchain: { captureScript: "scripts/capture-immersive-layout-evidence.mjs" },
    revisionVerification: { complete: false },
    backendCoverage: {
      adapterProbe: { available: false, reason: "requestAdapter returned null" },
      actualBackends: ["webgl2"],
      webGpuSkip: { allowed: true, reason: "requestAdapter returned null" }
    },
    captures: plan.map(({ id }) => ({
      id,
      screenshot: { path: id + ".png", bytes: 1, sha256: digest }
    }))
  };
  assert.throws(() => validateManifest(manifest), /complete byte verification/);
});
