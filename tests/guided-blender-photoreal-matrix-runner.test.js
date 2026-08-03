import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createPhotorealMatrixProvenanceManifest
} from "../tools/blender/photoreal-matrix-contract.mjs";
import {
  materializePhotorealMatrixManifest,
  parsePhotorealMatrixArguments,
  runPhotorealMatrix,
  selectPhotorealMatrixEntries,
  validatePhotorealMatrixProvenanceManifest
} from "../tools/blender/run-photoreal-matrix.mjs";

const SOURCE_COMMIT = "0".repeat(40);
const GENERATED_AT = "2026-08-03T12:00:00.000Z";

test("matrix runner parses only/resume/force/validation modes safely", () => {
  assert.deepEqual(parsePhotorealMatrixArguments(["--only", "tv-unit:clear-wall,cabinet-shelves:right-niche", "--resume"]), {
    only: ["tv-unit:clear-wall", "cabinet-shelves:right-niche"],
    resume: true,
    force: false,
    validateOnly: false,
    manifestOnly: false
  });
  assert.throws(() => parsePhotorealMatrixArguments(["--resume", "--force"]), { code: "CONFLICTING_RUN_MODE" });
  assert.throws(() => selectPhotorealMatrixEntries(["tv-unit:window-wall"]), { code: "UNAVAILABLE_MATRIX_KEY" });
});

test("manifest-only materializes all 70 authoritative statuses without rendering", async () => {
  const directory = await mkdtemp(join(tmpdir(), "jq-matrix-manifest-"));
  const manifestPath = join(directory, "matrix.json");
  const result = await materializePhotorealMatrixManifest({
    manifestPath,
    sourceCommit: SOURCE_COMMIT,
    generatedAt: GENERATED_AT
  });
  const written = JSON.parse(await readFile(manifestPath, "utf8"));
  assert.equal(result.manifest.counts.valid, 50);
  assert.equal(result.manifest.counts.unavailable, 20);
  assert.equal(written.entries.length, 70);
  assert.equal(written.counts.published, 0);
  assert.equal(written.counts.pending, 50);
  assert.equal(written.counts.failed, 0);
  assert.equal((await validatePhotorealMatrixProvenanceManifest(written)).valid, true);
});

test("strict provenance rejects an arbitrary key-only record", async () => {
  const manifest = createPhotorealMatrixProvenanceManifest({
    sourceCommit: SOURCE_COMMIT,
    generatedAt: GENERATED_AT,
    records: [{ key: "cabinet-shelves:clear-wall" }]
  });
  const validation = await validatePhotorealMatrixProvenanceManifest(manifest);
  assert.equal(validation.valid, false);
  assert.equal(validation.errors[0].code, "INVALID_PROVENANCE_RECORD");
});

test("validate-only regenerates all 50 packages without invoking Blender", async () => {
  const directory = await mkdtemp(join(tmpdir(), "jq-matrix-validate-"));
  const result = await runPhotorealMatrix({
    validateOnly: true,
    sourceCommit: SOURCE_COMMIT,
    manifestPath: join(directory, "absent-manifest.json")
  });
  assert.equal(result.mode, "validate-only");
  assert.equal(result.selectedCount, 50);
  assert.equal(result.packageKeys.length, 50);
  assert.equal(new Set(result.packageKeys).size, 50);
});
