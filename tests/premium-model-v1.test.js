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
  }),
  "assets/premium-model-v1/textures/oak/base-color-worksite-reference-v1.webp": Object.freeze({
    bytes: 98880,
    sha256: "08bbd34b355d71466d9dd0281f67ba33286b79a901b68a7d6c2a259119d21c2f"
  }),
  "assets/premium-model-v1/textures/oak/normal-worksite-reference-v1.webp": Object.freeze({
    bytes: 198420,
    sha256: "6231d6f61d23c46c9291a894d1fd4f8347cf7a629c77dd19d07cc0a2e465352f"
  }),
  "assets/premium-model-v1/textures/oak/roughness-worksite-reference-v1.webp": Object.freeze({
    bytes: 30356,
    sha256: "fe5b0cbebb5a0118ede577ca74088cda6d9a5c34d583fe9476e027c352c672d4"
  }),
  "assets/premium-model-v1/textures/oak/base-color-white-oak-reference-v2.webp": Object.freeze({
    bytes: 65664,
    sha256: "d552f25a4a3bebfe0b2cdc2adbdd2f46345810d28b0747978db673fecdbf200e"
  }),
  "assets/premium-model-v1/textures/oak/normal-white-oak-reference-v2.webp": Object.freeze({
    bytes: 239512,
    sha256: "8155e28d160377c394dc2a09017106971bf6c186bb4e8faa0af146a6326bcbce"
  }),
  "assets/premium-model-v1/textures/oak/roughness-white-oak-reference-v2.webp": Object.freeze({
    bytes: 3990,
    sha256: "5675b9cb586745ee04cdd657ca3df1ca858a4f5853f05f5d366d60692ecadc73"
  }),
  "assets/premium-model-v1/textures/walnut/base-color.webp": Object.freeze({
    bytes: 39606,
    sha256: "6d0abfc08f6c848fc010851cfed7cde05f9ae29bab9ae94ef21cd4d0c0d5ab1c"
  }),
  "assets/premium-model-v1/textures/walnut/normal.webp": Object.freeze({
    bytes: 26444,
    sha256: "2427549eee10eff5c7d9d31f29a39b482d826e211dfa20b9dffb01a85d8c5cce"
  }),
  "assets/premium-model-v1/textures/walnut/roughness.webp": Object.freeze({
    bytes: 89024,
    sha256: "c487a1236defeb8c5f12422a1a571449b1de535b8d23629fcd330a18bdda6d7b"
  }),
  "assets/premium-model-v1/textures/walnut/base-color-light-reference-v2.webp": Object.freeze({
    bytes: 109242,
    sha256: "1b533c548dab9ebed8d7880a2ca69b869d1d6a84431b65e555c6b121e12b30a0"
  }),
  "assets/premium-model-v1/textures/walnut/base-color-medium-reference-v2.webp": Object.freeze({
    bytes: 118652,
    sha256: "66d53d1e964da1c8837e5ad02320aec3a226db6d8dd79746a4ac1d1816a98ca0"
  }),
  "assets/premium-model-v1/textures/walnut/base-color-dark-reference-v2.webp": Object.freeze({
    bytes: 122620,
    sha256: "84a1ca0300978e8f19375f2edf184d06fc8dfe786f6072dbafefeba17326f5ef"
  }),
  "assets/premium-model-v1/textures/walnut/normal-reference-v2.webp": Object.freeze({
    bytes: 339310,
    sha256: "75b16b128a5cbd626ac65a7c99b7b3f8ebc52e1ac99fd86ecf8846c1dd6abf24"
  }),
  "assets/premium-model-v1/textures/walnut/roughness-reference-v2.webp": Object.freeze({
    bytes: 8404,
    sha256: "86fd29b735f5489409defbaa9fbec834acef76bb4430ee6a769b4687418c9cef"
  })
});

test("premium model V1 is the public production renderer with an explicit standard-mode opt-out", () => {
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.schema, "jq-premium-model-v1");
  assert.match(PREMIUM_MODEL_V1_CONTRACT.status, /OWNER ACCEPTANCE OPEN/);
  assert.equal(isPremiumModelV1Route({ hostname: "jq-bookcases.onrender.com", search: "?modelQuality=premium-v1" }), true);
  assert.equal(isPremiumModelV1Route({ hostname: "jq-bookcases.onrender.com", search: "" }), true);
  assert.equal(isPremiumModelV1Route({ hostname: "jq-bookcases.onrender.com", search: "?modelQuality=standard" }), false);
  assert.equal(isPremiumModelV1Route({ hostname: "127.0.0.1", search: "" }), false);
  assert.equal(isPremiumModelV1Route({ hostname: "127.0.0.1", search: "?modelQuality=premium-v1" }), true);
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.bevel.widthMeters, 0.005);
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.bevel.curveSegments, 2);
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.bevel.defaultRadiusFraction, 0.18);
  assert.deepEqual(PREMIUM_MODEL_V1_CONTRACT.bevel.roleRadiusFraction, { "door-detail": 0.28 });
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.bevel.maximumRenderedTriangles, 45000);
  assert.deepEqual(PREMIUM_MODEL_V1_CONTRACT.textures.paint.repeat, [18, 18]);
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.textures.paint.normalScale, 0.135);
  assert.deepEqual(PREMIUM_MODEL_V1_CONTRACT.textures.paint.finishMultipliers, {
    charcoal: "#484b4e"
  });
  assert.deepEqual(PREMIUM_MODEL_V1_CONTRACT.textures.oak.repeat, [1, 1]);
  assert.deepEqual(PREMIUM_MODEL_V1_CONTRACT.textures.oak.sourceTileMeters, [0.5, 0.5]);
  assert.deepEqual(PREMIUM_MODEL_V1_CONTRACT.textures.oak.projectionPeriodMeters, [0.52, 1.6]);
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.textures.oak.normalScale, 0.135);
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.textures.oak.grainTextureAxis, "v");
  assert.deepEqual(PREMIUM_MODEL_V1_CONTRACT.textures.oak.finishVariants["white-oak"], {
    source: "Poly Haven White Oak Veneer CC0 appearance reference with generated seamless synthesis",
    sourceUrl: "https://polyhaven.com/a/white_oak_veneer",
    revision: "catalog-materials-reference-v2-20260825a",
    map: "assets/premium-model-v1/textures/oak/base-color-white-oak-reference-v2.webp",
    normalMap: "assets/premium-model-v1/textures/oak/normal-white-oak-reference-v2.webp",
    roughnessMap: "assets/premium-model-v1/textures/oak/roughness-white-oak-reference-v2.webp",
    normalScale: 0.07,
    colorMultiplier: "#ffffff",
    calibrationStatus: "appearance reference only — not manufacturer calibrated"
  });
  assert.deepEqual(PREMIUM_MODEL_V1_CONTRACT.textures.oak.finishVariants["natural-oak"], {
    source: "User-supplied workplace oak appearance references with generated seamless synthesis",
    revision: "worksite-reference-oak-20260825a",
    map: "assets/premium-model-v1/textures/oak/base-color-worksite-reference-v1.webp",
    normalMap: "assets/premium-model-v1/textures/oak/normal-worksite-reference-v1.webp",
    roughnessMap: "assets/premium-model-v1/textures/oak/roughness-worksite-reference-v1.webp",
    normalScale: 0.085,
    calibrationStatus: "appearance reference only — not manufacturer calibrated"
  });
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.textures.oak.uvProjection, "stable cabinet-scale straight-grain projection");
  assert.deepEqual(PREMIUM_MODEL_V1_CONTRACT.textures.walnut.repeat, [1, 1]);
  assert.deepEqual(PREMIUM_MODEL_V1_CONTRACT.textures.walnut.sourceTileMeters, [1, 1]);
  assert.deepEqual(PREMIUM_MODEL_V1_CONTRACT.textures.walnut.projectionPeriodMeters, [0.72, 2.25]);
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.textures.walnut.normalScale, 0.07);
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.textures.walnut.grainTextureAxis, "v");
  assert.deepEqual(PREMIUM_MODEL_V1_CONTRACT.textures.walnut.finishMultipliers, {
    "light-walnut": "#f2dcc9",
    "medium-walnut": "#c49a7a",
    "dark-walnut": "#ad8d7c"
  });
  assert.deepEqual(Object.keys(PREMIUM_MODEL_V1_CONTRACT.textures.walnut.finishVariants), [
    "light-walnut", "medium-walnut", "dark-walnut"
  ]);
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.textures.walnut.finishVariants["light-walnut"].map,
    "assets/premium-model-v1/textures/walnut/base-color-light-reference-v2.webp");
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.textures.walnut.finishVariants["medium-walnut"].map,
    "assets/premium-model-v1/textures/walnut/base-color-medium-reference-v2.webp");
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.textures.walnut.finishVariants["dark-walnut"].map,
    "assets/premium-model-v1/textures/walnut/base-color-dark-reference-v2.webp");
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.textures.walnut.finishVariants["dark-walnut"].materialResponse.envMapIntensityScale, 0.74);
  assert.deepEqual(Object.keys(PREMIUM_MODEL_V1_CONTRACT.textures.paint.finishVariants), [
    "shop-primed", "warm-white", "soft-ivory", "light-greige", "sage-gray", "charcoal"
  ]);
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.textures.paint.finishVariants.charcoal.normalScale, 0.065);
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.textures.paint.finishVariants.charcoal.materialResponse.envMapIntensityScale, 0.75);
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.textures.walnut.uvProjection, "stable cabinet-scale straight-grain projection");
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.lighting.exposure, 1.03);
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.lighting.environmentIntensity, 0.3);
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.lighting.environmentRotationRadians, 0.92);
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.lighting.keyAreaScale, 0.94);
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.lighting.fillAreaScale, 0.78);
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.lighting.separationAreaScale, 0.9);
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.lighting.shadowProxyScale, 0.9);
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.lighting.shadowFilter, "pcf-radius");
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.lighting.shadowStrength, 0.48);
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.lighting.shadowRadius, 4);
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.lighting.shadowBias, -0.00006);
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.lighting.shadowNormalBias, 0.012);
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.exteriorGround.spacingMeters, 0.3048);
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.exteriorGround.marginMeters, 36);
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.exteriorGround.fogNearMeters, 24);
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.exteriorGround.fogFarMeters, 58);
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.floorSurface.bumpScale, 0.004);
  assert.deepEqual(PREMIUM_MODEL_V1_CONTRACT.lighting.separationArea, {
    position: [0, 5.2, -0.8], width: 5.5, height: 2.5
  });
  assert.deepEqual(PREMIUM_MODEL_V1_CONTRACT.lighting.shadowProxy.position, [-1.6, 6.4, 5.8]);
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.architecturalSurface.door.color, "#c5c7c5");
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.architecturalSurface.doorDetail.color, "#aeb1af");
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.familySurface.oak.clearcoatScale, 0.24);
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.familySurface.oak.specularIntensity, 0.27);
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.familySurface.walnut.clearcoatScale, 0.21);
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.familySurface.walnut.specularIntensity, 0.26);
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.familySurface.paint.clearcoatScale, 0.26);
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.familySurface.paint.specularIntensity, 0.27);
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.roleSurface["door-detail"].colorScale, 0.94);
  assert.equal(PREMIUM_MODEL_V1_CONTRACT.roleSurface["frame-stile"].colorScale, 0.985);
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

test("the oak and walnut PBR maps are exact local WebP assets with recorded provenance", async () => {
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
  assert.match(license, /Natural Walnut Veneer/);
  assert.match(license, /CC0/);
  assert.match(license, /Natural Oak workplace-reference synthesis/);
  assert.match(license, /Cabinet paint micro-surface/);
  assert.match(license, /not identified as a manufacturer product/);
  assert.match(license, /https:\/\/polyhaven\.com\/a\/white_oak_veneer/);
  assert.match(license, /https:\/\/polyhaven\.com\/a\/natural_walnut_veneer/);
});

test("deterministic provenance binds the accepted base, exact sources, and 3D-only scope", async () => {
  const provenance = await readJson("config/premium-model-v1-provenance.json");
  assert.equal(provenance.schema, "jq-premium-model-v1-provenance-v1");
  assert.deepEqual(provenance.acceptedBase, {
    commit: "d42dc10b929b3abf0715fe066ec7bad89760ed3b",
    tree: "b1c68e6cbbbc95176ee655274242b92adf890c37"
  });
  assert.equal(provenance.activation.query, "modelQuality=premium-v1");
  assert.equal(provenance.activation.optOutQuery, "modelQuality=standard");
  assert.match(provenance.activation.absentFlagBehavior, /public production hosts use premium-v1/);
  assert.equal(provenance.geometry.sourceAssetsModified, false);
  assert.equal(provenance.geometry.bevelWidthMillimeters, 5);
  assert.equal(provenance.roleCoverage.totalPrimitives, 494);
  assert.deepEqual(provenance.roleCoverage.layouts.map(({ primitiveCount }) => primitiveCount), [185, 127, 182]);
  assert.ok(provenance.scope.excluded.includes("interface"));
  assert.ok(provenance.scope.excluded.includes("customer state"));
  assert.ok(provenance.scope.permitted.includes("production-default activation on public hosts"));
  for (const record of provenance.files) {
    const bytes = await readFile(`${root}/${record.path}`);
    assert.equal(bytes.length, record.bytes, record.path);
    assert.equal(sha256(bytes), record.sha256, record.path);
  }
});
