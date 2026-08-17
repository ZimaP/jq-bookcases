import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { ROOM2_APPEARANCE_PROFILE } from "../guided-room2-appearance.js";
import {
  createRawMaterialDigest,
  inspectRoom2Glb
} from "../guided-room2-integrity.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const assetRelativePath = "assets/models/room2/Room2-Fireplace-bookcases-source-v1.glb";
const assetPath = `${root}/${assetRelativePath}`;
const expected = Object.freeze({
  bytes: 6712076,
  sha256: "251af4f7cb669976dec9dcaa46905982f9ae085b7bfb30e27e1bf9900a01a8d5",
  geometryFingerprint: "8762fe4326e22e46a163343e5fde410e231d651b48d1b1c9be8391febec8f6ff",
  rawMaterialDigest: "b31d96b3a248fb8d33af236e6e03f414481c907553cbcfbf482ca58a0109676d"
});

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const readText = (path) => readFile(`${root}/${path}`, "utf8");

test("the committed Room 2 asset is the exact regular non-LFS GLB authority", async () => {
  const [metadata, bytes] = await Promise.all([lstat(assetPath), readFile(assetPath)]);
  assert.equal(metadata.isFile(), true);
  assert.equal(metadata.isSymbolicLink(), false);
  assert.equal(bytes.length, expected.bytes);
  assert.equal(sha256(bytes), expected.sha256);
  assert.equal(bytes.subarray(0, 4).toString("ascii"), "glTF");
  assert.doesNotMatch(bytes.subarray(0, 128).toString("utf8"), /git-lfs|oid sha256/i);
});

test("the self-contained GLB inventory and raw materials match the published authority", async () => {
  const bytes = await readFile(assetPath);
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const inspection = inspectRoom2Glb(arrayBuffer);
  assert.deepEqual(inspection.counts, {
    scenes: 1,
    nodes: 455,
    meshes: 185,
    primitives: 185,
    materials: 8,
    textures: 6,
    images: 6
  });
  assert.deepEqual(inspection.externalUris, []);
  assert.equal(await createRawMaterialDigest(inspection.json), expected.rawMaterialDigest);
  assert.equal(ROOM2_APPEARANCE_PROFILE.asset.geometryFingerprint, expected.geometryFingerprint);
});

test("the provisional appearance profile cannot own embedded materials or model transforms", () => {
  assert.equal(ROOM2_APPEARANCE_PROFILE.schema, "jq-room2-public-appearance-v1");
  assert.match(ROOM2_APPEARANCE_PROFILE.status, /PROVISIONAL.*OWNER ACCEPTANCE OPEN/);
  assert.deepEqual(ROOM2_APPEARANCE_PROFILE.asset, {
    url: assetRelativePath,
    ...expected
  });
  assert.deepEqual(
    Object.keys(ROOM2_APPEARANCE_PROFILE).sort(),
    ["asset", "bounds", "camera", "ground", "lighting", "renderer", "schema", "status"]
  );
  assert.equal("materials" in ROOM2_APPEARANCE_PROFILE, false);
  assert.equal("modelTransform" in ROOM2_APPEARANCE_PROFILE, false);
  assert.equal(ROOM2_APPEARANCE_PROFILE.ground.enabled, true);
  assert.equal("texture" in ROOM2_APPEARANCE_PROFILE.ground, false);
});

test("the Room 2 viewer uses one local Three runtime, one GLTF request, and no generated fallback", async () => {
  const [viewer, html] = await Promise.all([
    readText("guided-room2-viewer.js"),
    readText("configurator.html")
  ]);
  assert.match(html, /"three": "\.\/assets\/vendor\/three\.module\.js"/);
  assert.match(viewer, /import \* as THREE from "\.\/assets\/vendor\/three\.module\.js"/);
  assert.match(viewer, /GLTFLoader.*three-addons\/loaders\/GLTFLoader\.js/);
  assert.equal((viewer.match(/fetch\(ROOM2_APPEARANCE_PROFILE\.asset\.url/g) || []).length, 1);
  assert.match(viewer, /credentials: "same-origin"/);
  assert.match(viewer, /ROOM2_ASSET_HASH_MISMATCH/);
  assert.match(viewer, /ROOM2_RAW_MATERIAL_DIGEST_MISMATCH/);
  assert.match(viewer, /runtimeMaterialSnapshot: this\.runtimeMaterialSnapshot/);
  assert.match(viewer, /deferredModelSnapshot: this\.deferredModelSnapshot/);
  assert.match(viewer, /No substitute model or image was loaded/);
  assert.doesNotMatch(viewer, /guided-configurator-3d|createGuidedScenePlan|concept-photo/);
  assert.doesNotMatch(viewer, /(?:modelRoot|gltf\.scene)\.scale\.(?:set|multiply)|(?:modelRoot|gltf\.scene)\.scale\s*=|material\.(?:color|roughness|metalness|map)\s*=/);
});

test("the vendored r166 loader cohort is byte locked", async () => {
  const records = [
    ["assets/vendor/three.module.js", "7d8a8113afd346464aa1854c1f47aaa0aca4c9a07f0a709f8b417f16d0b6b5fd"],
    ["assets/vendor/three-addons/loaders/GLTFLoader.js", "11ea6cf692882d7a2770f2cbb485724def0aa4e623abcfe45fbf74aa0ea5bc55"],
    ["assets/vendor/three-addons/utils/BufferGeometryUtils.js", "c25b7930e570e9ec56173cd3b866ec8d2e10016630db3937efb439daf1cedbf6"]
  ];
  for (const [path, digest] of records) assert.equal(sha256(await readFile(`${root}/${path}`)), digest, path);
  assert.match(await readText("assets/vendor/three.module.js"), /REVISION = '166'/);
});

test("every deferred customer group discloses that saved values do not change the fixed model", async () => {
  const source = await readText("guided-configurator.js");
  assert.match(source, /data-deferred-model-disclosure=/);
  assert.match(source, /Your \$\{escapeHtml\(groupLabel\.toLowerCase\(\)\)\} selections are saved with this project/);
  assert.match(source, /not yet shown on the fixed Room 2 reference model/);
  for (const label of ["Dimensions", "Finish", "Details, hardware, and lighting"]) {
    assert.match(source, new RegExp(`renderDeferredModelDisclosure\\(\\"${label}\\"\\)`));
  }
  assert.doesNotMatch(source, /LIVE ACCEPTED DESIGN|see your changes live/i);
});

test("the release artifact explicitly copies and byte-checks the Room 2 GLB", async () => {
  const workflow = await readText(".github/workflows/deploy-pages-production.yml");
  assert.match(workflow, /cp assets\/models\/room2\/Room2-Fireplace-bookcases-source-v1\.glb _site\/assets\/models\/room2\//);
  assert.match(workflow, /test ! -L _site\/assets\/models\/room2\/Room2-Fireplace-bookcases-source-v1\.glb/);
  assert.match(workflow, new RegExp(String(expected.bytes)));
  assert.match(workflow, new RegExp(expected.sha256));
  assert.match(workflow, /test ! -e _site\/guided-configurator-3d\.js/);
});
