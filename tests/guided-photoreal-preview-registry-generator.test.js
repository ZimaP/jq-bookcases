import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  PHOTOREAL_REGISTRY_MANIFEST_PATH,
  PHOTOREAL_REGISTRY_OUTPUT_PATH,
  createPublishedPreviewRegistrySource,
  syncPublishedPreviewRegistry,
  validateAndExtractPublishedRecords
} from "../scripts/generate-photoreal-preview-registry.mjs";
import { hashCanonical } from "../tools/blender/photoreal-matrix-contract.mjs";

async function readManifest() {
  return JSON.parse(await readFile(PHOTOREAL_REGISTRY_MANIFEST_PATH, "utf8"));
}

test("the generated browser registry is exactly reproducible from final provenance", async () => {
  const manifest = await readManifest();
  const expected = createPublishedPreviewRegistrySource(manifest);
  const current = await readFile(PHOTOREAL_REGISTRY_OUTPUT_PATH, "utf8");
  const records = validateAndExtractPublishedRecords(manifest);

  assert.equal(current, expected);
  assert.equal(records.length, 50);
  assert.equal(new Set(records.map(({ key }) => key)).size, 50);
  assert.equal(new Set(records.map(({ asset }) => asset)).size, 50);
  assert.doesNotMatch(current, /\/Users\/|\/home\/|file:\/\/|[A-Za-z]:\\/);
  assert.deepEqual(await syncPublishedPreviewRegistry({ check: true }), {
    mode: "check",
    outputPath: PHOTOREAL_REGISTRY_OUTPUT_PATH,
    count: 50
  });
});

test("registry generation fails closed for incomplete or tampered provenance", async () => {
  const manifest = await readManifest();
  const incomplete = {
    ...manifest,
    counts: { ...manifest.counts, published: 49, pending: 1 }
  };
  const { manifestSha256: ignoredIncompleteHash, ...incompletePayload } = incomplete;
  incomplete.manifestSha256 = hashCanonical(incompletePayload);
  assert.throws(
    () => createPublishedPreviewRegistrySource(incomplete),
    /complete 50-published/
  );
  assert.throws(
    () => createPublishedPreviewRegistrySource({ ...manifest, manifestSha256: "0".repeat(64) }),
    /canonical SHA-256/
  );

  const semanticallyTampered = structuredClone(manifest);
  semanticallyTampered.entries[0].productLabel = "Another product";
  const { manifestSha256: ignoredTamperedHash, ...tamperedPayload } = semanticallyTampered;
  semanticallyTampered.manifestSha256 = hashCanonical(tamperedPayload);
  assert.throws(
    () => createPublishedPreviewRegistrySource(semanticallyTampered),
    /authoritative guided matrix/
  );
});
