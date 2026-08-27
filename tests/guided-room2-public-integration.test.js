import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { ROOM2_APPEARANCE_PROFILE } from "../guided-room2-appearance.js";
import {
  createEmbeddedImagePayloadSnapshot,
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
const expectedEmbeddedImages = Object.freeze([
  ["image/png", 3904, "a57a4bfe74b2a4b40357c09520215d178f5dbb26030c3535a1504e3f5553be06"],
  ["image/jpeg", 12480, "1dea57988ae8f6535489f78126b0b934848ab817fff6bc18bdfd4407fbf8f240"],
  ["image/jpeg", 4724, "6b7bf9a895a72e289ecd7b07ffb50fbb30c472bbb10bddec3ff281585301580a"],
  ["image/png", 143828, "82ffc2c21edf2f4937f93576968dd533362a71058d22848403d59a27fe145331"],
  ["image/png", 5990740, "2b44ffa512f19f55d6f48ee153173affd1234ce1911ecd52256635ec6daf39f9"],
  ["image/png", 3904, "a57a4bfe74b2a4b40357c09520215d178f5dbb26030c3535a1504e3f5553be06"]
]);

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
    accessors: 556,
    vertices: 33934,
    triangles: 18306,
    materials: 8,
    textures: 6,
    images: 6,
    animations: 0,
    cameras: 0,
    skins: 0,
    lights: 0
  });
  assert.deepEqual(inspection.externalUris, []);
  assert.equal(await createRawMaterialDigest(inspection.json), expected.rawMaterialDigest);
  const imageSnapshot = await createEmbeddedImagePayloadSnapshot(inspection);
  assert.equal(imageSnapshot.aggregateSha256, "6c737d2ff899087b3227f9202dcf95c874474d65dfbc6ec83c778748feced153");
  assert.deepEqual(imageSnapshot.records.map(({ mimeType, byteLength, sha256 }) => [mimeType, byteLength, sha256]), expectedEmbeddedImages);
  assert.deepEqual(imageSnapshot.textureSources.map(({ textureIndex, imageIndex }) => [textureIndex, imageIndex]), [
    [0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [5, 5]
  ]);
  assert.equal(ROOM2_APPEARANCE_PROFILE.asset.geometryFingerprint, expected.geometryFingerprint);
});

test("the versioned commercial PBR profile is finite, bounded, neutral, and data driven", () => {
  assert.equal(ROOM2_APPEARANCE_PROFILE.schema, "room2-commercial-pbr-v1");
  assert.match(ROOM2_APPEARANCE_PROFILE.status, /PROVISIONAL.*OWNER ACCEPTANCE OPEN/);
  assert.deepEqual(ROOM2_APPEARANCE_PROFILE.asset, {
    url: assetRelativePath,
    ...expected,
    embeddedImageAggregate: "6c737d2ff899087b3227f9202dcf95c874474d65dfbc6ec83c778748feced153"
  });
  assert.deepEqual(
    Object.keys(ROOM2_APPEARANCE_PROFILE).sort(),
    ["asset", "bounds", "camera", "environment", "lighting", "materials", "presentation", "renderer", "schema", "semanticMapping", "session", "status"]
  );
  assert.equal("modelTransform" in ROOM2_APPEARANCE_PROFILE, false);
  assert.deepEqual(ROOM2_APPEARANCE_PROFILE.bounds.hero.center, [0.4297320008796035, 1.2191999852944295, -0.77257108840968]);
  assert.deepEqual(ROOM2_APPEARANCE_PROFILE.renderer.colorManagement, {
    enabled: true,
    workingColorSpace: "linear-srgb",
    outputTransformCount: 1
  });
  assert.equal(ROOM2_APPEARANCE_PROFILE.renderer.outputColorSpace, "srgb");
  assert.equal(ROOM2_APPEARANCE_PROFILE.renderer.postProcessing.enabled, false);
  assert.equal(ROOM2_APPEARANCE_PROFILE.renderer.gtao.enabled, false);
  assert.equal(ROOM2_APPEARANCE_PROFILE.environment.remoteRequests, 0);
  assert.equal(ROOM2_APPEARANCE_PROFILE.environment.maximumGenerationsPerViewer, 1);
  assert.equal(ROOM2_APPEARANCE_PROFILE.lighting.semanticRoleCount, 3);
  assert.equal(ROOM2_APPEARANCE_PROFILE.lighting.directLightObjectCount, 4);
  assert.equal(ROOM2_APPEARANCE_PROFILE.lighting.maximumShadowCasters, 1);
  assert.equal(ROOM2_APPEARANCE_PROFILE.lighting.key.area.castShadow, false);
  assert.equal(ROOM2_APPEARANCE_PROFILE.lighting.key.shadowProxy.castShadow, true);
  assert.equal(ROOM2_APPEARANCE_PROFILE.lighting.fill.area.castShadow, false);
  assert.equal(ROOM2_APPEARANCE_PROFILE.lighting.separation.area.castShadow, false);
  assert.deepEqual(ROOM2_APPEARANCE_PROFILE.lighting.shadows.tiers.map(({ mapSize }) => mapSize), [1024, 2048]);
  assert.equal(ROOM2_APPEARANCE_PROFILE.materials.implementation, "MeshStandardMaterial");
  assert.equal(ROOM2_APPEARANCE_PROFILE.materials.physicalMaterialUses, 0);
  assert.equal(ROOM2_APPEARANCE_PROFILE.semanticMapping.publishedFinishMaterialIndex, 3);
  assert.equal(ROOM2_APPEARANCE_PROFILE.semanticMapping.publishedFinishPrimitiveCount, 118);
  assert.equal(ROOM2_APPEARANCE_PROFILE.semanticMapping.unresolvedHeroPrimitiveCount, 0);
  assert.deepEqual(Object.keys(ROOM2_APPEARANCE_PROFILE.presentation.sweeps), ["aces-soft", "neutral-balanced", "neutral-reflective"]);
  const visit = (value) => {
    if (typeof value === "number") assert.equal(Number.isFinite(value), true);
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") Object.values(value).forEach(visit);
  };
  visit(ROOM2_APPEARANCE_PROFILE);
});

test("the shipped immersive viewer uses local verified backends, exact layout authority, and no generated fallback", async () => {
  const [viewer, materials, html, webgpuBundle] = await Promise.all([
    readText("guided-layout-viewer.js"),
    readText("guided-room2-materials.js"),
    readText("configurator.html"),
    readText("assets/vendor/three-webgpu-renderer-r166.bundle.js")
  ]);
  assert.match(html, /"three": "\.\/assets\/vendor\/three\.module\.js"/);
  assert.match(viewer, /import \* as THREE from "three"/);
  assert.match(viewer, /GLTFLoader.*three-addons\/loaders\/GLTFLoader\.js/);
  assert.match(viewer, /RGBELoader.*three-addons\/loaders\/RGBELoader\.js/);
  assert.match(viewer, /RectAreaLightUniformsLib.*three-addons\/lights\/RectAreaLightUniformsLib\.js/);
  assert.match(viewer, /createRoom2MaterialSystem/);
  assert.match(viewer, /guided-layout-registry\.js/);
  assert.match(viewer, /guided-layout-material-zones\.generated\.js/);
  assert.match(viewer, /three-webgpu-renderer-r166\.bundle\.js/);
  assert.match(viewer, /renderer\.backend\?\.isWebGPUBackend !== true/);
  assert.match(viewer, /new THREE\.WebGLRenderer/);
  assert.match(viewer, /const explicitlyRequestedWebGpu = preference === "webgpu"/);
  assert.match(viewer, /Stable WebGL2 production runtime selected/);
  assert.match(viewer, /safeDisposeResource\(this\.materialSystem\)/);
  assert.match(viewer, /credentials: "same-origin"/);
  assert.match(viewer, /MODEL_SHA256_MISMATCH/);
  assert.match(viewer, /MODEL_BYTE_LENGTH_MISMATCH/);
  assert.match(viewer, /\["model\/gltf-binary", "application\/octet-stream", "binary\/octet-stream"\]/);
  assert.match(viewer, /MODEL_SOURCE_COUNT_MISMATCH/);
  assert.match(viewer, /MATERIAL_ZONE_COVERAGE_MISMATCH/);
  assert.match(viewer, /SMART_DIMENSION_ACCESSOR_NOT_UNIQUE/);
  assert.match(viewer, /No substitute image or geometry was loaded/);
  assert.match(viewer, /minimumRadius: 1\.25/);
  assert.match(viewer, /authority\.className = "sr-only"/);
  assert.match(viewer, /authority\.hidden = true/);
  assert.doesNotMatch(viewer, /authority\.className = "immersive-viewer-authority"/);
  assert.doesNotMatch(viewer, /guided-configurator-3d|createGuidedScenePlan|concept-photo/);
  assert.doesNotMatch(viewer + materials, /(?:modelRoot|gltf\.scene)\.scale\.(?:set|multiply)|(?:modelRoot|gltf\.scene)\.scale\s*=/);
  assert.doesNotMatch(materials, /computeMikkTSpaceTangents|toNonIndexed|setIndex\(|deleteAttribute\(|setAttribute\(/);
  assert.equal((viewer.match(/new THREE\.PMREMGenerator/g) || []).length, 0);
  assert.equal((viewer.match(/new THREE\.DirectionalLight/g) || []).length, 1);
  assert.equal((viewer.match(/new THREE\.RectAreaLight/g) || []).length, 3);
  assert.doesNotMatch(viewer, /new THREE\.(?:PointLight|HemisphereLight|SpotLight)/);
  assert.match(viewer, /renderer\.shadowMap\.autoUpdate = false/);
  assert.match(viewer, /WEBGPU_DIRECTIONAL_SHADOWS_DISABLED/);
  assert.match(viewer, /selectedBackend !== "webgpu"/);
  assert.match(viewer, /configureRendererAppearance\(renderer, this\.presentation, \{ shadowsEnabled: false \}\)/);
  assert.match(viewer, /webgpu-equirectangular-environment-node/);
  assert.match(viewer, /webgl-automatic-pmrem/);
  assert.match(viewer, /this\.scene\.environment = texture/);
  assert.equal((viewer.match(/setAnimationLoop/g) || []).length, 1);
  assert.match(viewer, /renderer\.setAnimationLoop\?\.\(null\)/);
  assert.doesNotMatch(viewer, /EffectComposer|OutputPass/);
  assert.match(materials, /new this\.THREE\.TextureLoader\(\)/);
  assert.match(materials, /texture\.colorSpace = slot === "map" \? this\.THREE\.SRGBColorSpace : this\.THREE\.NoColorSpace/);
  assert.match(materials, /ROOM2_FINISH_COVERAGE_MISMATCH/);
  const bundleImports = [...webgpuBundle.matchAll(/from\s*["']([^"']+)["']/g)].map((match) => match[1]);
  assert.deepEqual([...new Set(bundleImports)], ["three"]);
});

test("the vendored r166 loader cohort is byte locked", async () => {
  const records = [
    ["assets/vendor/three.module.js", "7d8a8113afd346464aa1854c1f47aaa0aca4c9a07f0a709f8b417f16d0b6b5fd"],
    ["assets/vendor/three-addons/environments/RoomEnvironment.js", "e1b92c4dd2d89752293546790bfda9828a630a79700c66f5b736fad7a88cb7e4"],
    ["assets/vendor/three-addons/loaders/GLTFLoader.js", "11ea6cf692882d7a2770f2cbb485724def0aa4e623abcfe45fbf74aa0ea5bc55"],
    ["assets/vendor/three-addons/loaders/RGBELoader.js", "f0e87d0008d9484d31358b32befd1bf80e4301f77573cc9a7cf7d871cc3f64b4"],
    ["assets/vendor/three-addons/lights/RectAreaLightUniformsLib.js", "08085bc942253cd54948bf936fecb66b54514a135872656e475a1cab09b55214"],
    ["assets/vendor/licenses/three-0.166.1-LICENSE.txt", "4c40a1ef62450b857c3b2aaf294936304cd552d965fbcd9d32d4c5bcf4ba4454"],
    ["assets/vendor/three-addons/utils/BufferGeometryUtils.js", "c25b7930e570e9ec56173cd3b866ec8d2e10016630db3937efb439daf1cedbf6"]
  ];
  for (const [path, digest] of records) assert.equal(sha256(await readFile(`${root}/${path}`)), digest, path);
  assert.match(await readText("assets/vendor/three.module.js"), /REVISION = '166'/);
});

test("the direct customization panel keeps shelf setup out and restores canonical live finish choices", async () => {
  const source = await readText("guided-configurator.js");
  const directFlow = source.slice(
    source.indexOf("function renderCustomizationStep()"),
    source.indexOf("function renderConceptPreview(")
  );
  assert.match(directFlow, /data-customization-direct-panel/);
  assert.match(directFlow, /Make it yours, not complicated\./);
  assert.match(directFlow, /Measurements in one place\./);
  assert.match(directFlow, /Adjustable shelf positions — no setup needed here/);
  assert.match(directFlow, /data-direct-choice-group/);
  assert.match(directFlow, /data-direct-choice-group="finish"/);
  assert.match(directFlow, /FINISH_OPTIONS\[family\.id\]/);
  assert.match(directFlow, /data-project-field="finish"/);
  assert.match(source, /showDimensions: false/);
  assert.doesNotMatch(directFlow, /data-smart-dimension|renderFinishChoices|renderDetailChoices/);
  assert.doesNotMatch(directFlow, /data-customization-mode-control|data-customization-mode-panel/);
  assert.match(source, /Digital preview only\. Final dimensions and finishes require design confirmation\./);
  assert.doesNotMatch(source, /LIVE ACCEPTED DESIGN|see your changes live/i);
});

test("the release artifact explicitly copies and byte-checks every immersive runtime asset", async () => {
  const workflow = await readText(".github/workflows/deploy-pages-production.yml");
  assert.match(workflow, /assets\/models\/room2\/Room2-Fireplace-bookcases-source-v1\.glb/);
  assert.match(workflow, /test ! -L _site\/assets\/models\/room2\/Room2-Fireplace-bookcases-source-v1\.glb/);
  assert.match(workflow, new RegExp(String(expected.bytes)));
  assert.match(workflow, new RegExp(expected.sha256));
  assert.match(workflow, /6755128/);
  assert.match(workflow, /4969169cb29bcf51a72a2db6c4cd83631cd94c7d78154bc37558ee9adaba98cb/);
  assert.match(workflow, /6993036/);
  assert.match(workflow, /631005c025324c5162de6e414267101d6260d58c6198d561e6799568cef1fd24/);
  assert.match(workflow, /Room2-Fireplace-bookcases-source-v1-ios-v1\.glb/);
  assert.match(workflow, /980656/);
  assert.match(workflow, /d36dc25e23c794912ced16f6ffa3322847c1c7d93c03222f82240f198421f7ab/);
  assert.match(workflow, /jq-door-wall-bookcase-room2-authoritative-v01-ios-v1\.glb/);
  assert.match(workflow, /1025864/);
  assert.match(workflow, /2f65aa4be1189d33c02248dc31cdb13f375b1a55dfef639759c89fa55aeaa4b1/);
  assert.match(workflow, /jq-window-wall-bookcases-cabinets-room4-authoritative-v01-ios-v1\.glb/);
  assert.match(workflow, /1261800/);
  assert.match(workflow, /4bbdc30ff4619aa06f989f012117912b8836547b0fdd645774fb7b9407c575cd/);
  assert.match(workflow, /guided-layout-registry\.js/);
  assert.match(workflow, /guided-layout-material-zones\.generated\.js/);
  assert.match(workflow, /guided-layout-viewer\.js/);
  assert.match(workflow, /three-webgpu-renderer-r166\.bundle\.js/);
  assert.match(workflow, /immersive-layout-model-audit-v1\.json/);
  assert.match(workflow, /immersive-layout-material-zones-v1\.json/);
  assert.match(workflow, /test ! -e _site\/guided-configurator-3d\.js/);
  assert.match(workflow, /cp assets\/vendor\/three-addons\/loaders\/RGBELoader\.js/);
  assert.match(workflow, /cp assets\/vendor\/three-addons\/lights\/RectAreaLightUniformsLib\.js/);
  assert.match(workflow, /cp -R assets\/room2-commercial-pbr-v1 _site\/assets\//);
  assert.match(workflow, /9d868390072a01f89eddc0f9aeeee73135feefdd1496ca2cccef8efe828fe496/);
  assert.match(workflow, /caf5e2eddf95b3699766bae7c2f96d7384b4d28c0cd9ddea41fc7d17ce738092/);
  assert.match(workflow, /0126bb4a12727c128af5f5e94edeb5857d14035b2c99346312bc59e02c88864a/);
  assert.match(workflow, /16a1ba6570137d7d53170a72882439cc2d39e5cf30db3f54097f5c73a00aa787/);
});
