import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  PREMIUM_MODEL_V1_CONTRACT,
  isPremiumModelV1Route
} from "../guided-premium-model-v1-contract.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const readJson = async (relativePath) => JSON.parse(await readFile(`${root}/${relativePath}`, "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const SOURCE_ASSETS = Object.freeze({
  "fireplace-wall": Object.freeze({
    path: "assets/models/room2/Room2-Fireplace-bookcases-source-v1.glb",
    bytes: 6712076,
    sha256: "251af4f7cb669976dec9dcaa46905982f9ae085b7bfb30e27e1bf9900a01a8d5"
  }),
  "door-wall": Object.freeze({
    path: "assets/models/room2/jq-door-wall-bookcase-room2-authoritative-v01.glb",
    bytes: 6755128,
    sha256: "4969169cb29bcf51a72a2db6c4cd83631cd94c7d78154bc37558ee9adaba98cb"
  }),
  "window-wall": Object.freeze({
    path: "assets/models/room4/jq-window-wall-bookcases-cabinets-room4-authoritative-v01.glb",
    bytes: 6993036,
    sha256: "631005c025324c5162de6e414267101d6260d58c6198d561e6799568cef1fd24"
  })
});

const TEXTURE_ASSETS = Object.freeze({
  "assets/premium-model-v1/textures/oak/base-color.webp": Object.freeze({
    bytes: 48642,
    sha256: "adf67ddf10cd4bebb528c56c2582614c3d97d79d41af537b3e174e0231969ce8"
  }),
  "assets/premium-model-v1/textures/oak/normal.webp": Object.freeze({
    bytes: 144136,
    sha256: "1cb0807a01f96f324f7561556ad8eeca7470c7e0ce06a072c4985b02baed5bd6"
  }),
  "assets/premium-model-v1/textures/oak/roughness.webp": Object.freeze({
    bytes: 102454,
    sha256: "b3acfc91be21b85f60226e4533056c0930fbc94ac64526d85ea6d2fa01da6dd2"
  })
});

test("premium model V1 is an exact opt-in 3D-only preview contract", () => {
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.schema, "jq-premium-model-v1");
  assert.match(PREMIUM_MODEL_V1_CONTRACT.status, /OWNER ACCEPTANCE OPEN/);
  assert.equal(isPremiumModelV1Route({ search: "?modelQuality=premium-v1" }), true);
  assert.equal(isPremiumModelV1Route({ search: "?modelQuality=premium" }), false);
  assert.equal(isPremiumModelV1Route({ search: "" }), false);
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.bevel.widthMeters, 0.003);
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.bevel.curveSegments, 2);
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.bevel.maximumRenderedTriangles, 45000);
  assert.deepEqual(PREMIUM_MODEL_V1_CONTRACT.textures.paint.repeat, [18, 18]);
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.textures.paint.normalScale, 0.12);
  assert.deepEqual(PREMIUM_MODEL_V1_CONTRACT.textures.oak.repeat, [1, 1]);
  assert.deepEqual(PREMIUM_MODEL_V1_CONTRACT.textures.oak.sourceTileMeters, [0.5, 0.5]);
  assert.deepEqual(PREMIUM_MODEL_V1_CONTRACT.textures.oak.projectionPeriodMeters, [0.52, 1.6]);
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.textures.oak.normalScale, 0.09);
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.textures.oak.uvProjection, "stable cabinet-scale straight-grain projection");
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.lighting.exposure, 0.94);
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.lighting.environmentIntensity, 0.62);
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.lighting.shadowProxyScale, 0.64);
  assert.ok(PREMIUM_MODEL_V1_CONTRACT.familySurface.oak.clearcoatScale <= 0.32);
  assert.ok(PREMIUM_MODEL_V1_CONTRACT.familySurface.oak.specularIntensity <= 0.32);
  assert.ok(PREMIUM_MODEL_V1_CONTRACT.familySurface.paint.clearcoatScale <= 0.55);
  assert.ok(PREMIUM_MODEL_V1_CONTRACT.familySurface.paint.specularIntensity <= 0.42);
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.shadow.maximumDrawCalls, 250);
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.material.type, "MeshPhysicalMaterial");
});

test("all three authoritative GLBs remain exact regular immutable source files", async () => {
  for (const [layoutId, expected] of Object.entries(SOURCE_ASSETS)) {
    const [metadata, bytes] = await Promise.all([
      lstat(`${root}/${expected.path}`),
      readFile(`${root}/${expected.path}`)
    ]);
    assert.equal(metadata.isFile(), true, layoutId);
    assert.equal(metadata.isSymbolicLink(), false, layoutId);
    assert.equal(bytes.length, expected.bytes, layoutId);
    assert.equal(sha256(bytes), expected.sha256, layoutId);
    assert.equal(bytes.subarray(0, 4).toString("ascii"), "glTF", layoutId);
  }
});

test("the role manifest exhaustively binds 494 unique audited primitives and protects architecture", async () => {
  const manifest = await readJson("config/premium-model-v1-roles.json");
  assert.equal(manifest.schema, "jq-premium-model-v1-role-manifest-v1");
  assert.equal(manifest.sourceAssetsModified, false);
  assert.deepEqual(manifest.layouts.map(({ layoutId }) => layoutId), Object.keys(SOURCE_ASSETS));
  assert.deepEqual(manifest.layouts.map(({ primitiveCount }) => primitiveCount), [185, 127, 182]);
  const records = manifest.layouts.flatMap(({ layoutId, records: layoutRecords }) => (
    layoutRecords.map((record) => ({ ...record, layoutId }))
  ));
  assert.equal(records.length, 494);
  assert.equal(new Set(records.map(({ layoutId, stablePrimitiveId }) => `${layoutId}:${stablePrimitiveId}`)).size, 494);
  for (const record of records) {
    assert.match(record.stablePrimitiveId, /^scene:0\/nodes:/);
    assert.match(record.positionAccessorSha256, /^[a-f0-9]{64}$/);
    assert.equal(record.worldBounds.min.length, 3);
    assert.equal(record.worldBounds.max.length, 3);
  }
  const protectedRoles = new Set([
    "room-shell", "floor", "fireplace", "architectural-opening",
    "architectural-opening-detail", "architectural-hardware",
    "architectural-glazing", "support-hardware", "protected-unclassified"
  ]);
  const materialRoles = new Set(Object.keys(PREMIUM_MODEL_V1_CONTRACT.roleSurface));
  const bevelRoles = new Set(PREMIUM_MODEL_V1_CONTRACT.bevel.roles);
  for (const role of protectedRoles) {
    assert.equal(materialRoles.has(role), false, role);
    assert.equal(bevelRoles.has(role), false, role);
  }
});

test("the CC0 oak PBR maps are exact local WebP assets with recorded license provenance", async () => {
  for (const [relativePath, expected] of Object.entries(TEXTURE_ASSETS)) {
    const [metadata, bytes] = await Promise.all([
      lstat(`${root}/${relativePath}`),
      readFile(`${root}/${relativePath}`)
    ]);
    assert.equal(metadata.isFile(), true, relativePath);
    assert.equal(metadata.isSymbolicLink(), false, relativePath);
    assert.equal(bytes.length, expected.bytes, relativePath);
    assert.equal(sha256(bytes), expected.sha256, relativePath);
    assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF", relativePath);
    assert.equal(bytes.subarray(8, 12).toString("ascii"), "WEBP", relativePath);
  }
  const license = await readFile(`${root}/assets/premium-model-v1/ASSET-LICENSES.md`, "utf8");
  assert.match(license, /Poly Haven/);
  assert.match(license, /White Oak Veneer/);
  assert.match(license, /CC0/);
  assert.match(license, /https:\/\/polyhaven\.com\/a\/white_oak_veneer/);
});

test("deterministic provenance binds the accepted base, exact sources, and 3D-only scope", async () => {
  const provenance = await readJson("config/premium-model-v1-provenance.json");
  assert.equal(provenance.schema, "jq-premium-model-v1-provenance-v1");
  assert.deepEqual(provenance.acceptedBase, {
    commit: "d42dc10b929b3abf0715fe066ec7bad89760ed3b",
    tree: "b1c68e6cbbbc95176ee655274242b92adf890c37"
  });
  assert.equal(provenance.activation.query, "modelQuality=premium-v1");
  assert.equal(provenance.geometry.sourceAssetsModified, false);
  assert.equal(provenance.geometry.bevelWidthMillimeters, 3);
  assert.equal(provenance.roleCoverage.totalPrimitives, 494);
  assert.deepEqual(provenance.roleCoverage.layouts.map(({ primitiveCount }) => primitiveCount), [185, 127, 182]);
  assert.ok(provenance.scope.excluded.includes("interface"));
  assert.ok(provenance.scope.excluded.includes("customer state"));
  assert.ok(provenance.scope.excluded.includes("production default without flag"));
  for (const record of provenance.files) {
    const bytes = await readFile(`${root}/${record.path}`);
    assert.equal(bytes.length, record.bytes, record.path);
    assert.equal(sha256(bytes), record.sha256, record.path);
  }
});
