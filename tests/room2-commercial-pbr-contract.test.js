import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { FINISH_OPTIONS } from "../guided-configurator-data.js";
import { ROOM2_APPEARANCE_PROFILE } from "../guided-room2-appearance.js";
import { classifyRoom2MillworkRole, resolveRoom2MillworkRole } from "../guided-room2-materials.js";
import { readWebpDimensions } from "../tools/blender/run-clay-worker.mjs";
import { createGlbProof } from "../tools/room2-authority-v1/room2-glb-integrity.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const readJson = async (relativePath) => JSON.parse(await readFile(join(root, relativePath), "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("the deterministic semantic audit exhaustively binds all 185 immutable source primitives", async () => {
  const [audit, bytes] = await Promise.all([
    readJson("config/room2-commercial-pbr-v1-semantic-audit.json"),
    readFile(join(root, ROOM2_APPEARANCE_PROFILE.asset.url))
  ]);
  const proof = await createGlbProof(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const accessorByIndex = new Map(proof.inventory.accessors.map((record) => [record.index, record]));

  assert.equal(audit.schema, "jq-room2-commercial-pbr-v1-semantic-audit-v1");
  assert.equal(audit.profile, ROOM2_APPEARANCE_PROFILE.schema);
  assert.equal(audit.source.sha256, ROOM2_APPEARANCE_PROFILE.asset.sha256);
  assert.equal(audit.source.geometryFingerprint, proof.geometryFingerprint);
  assert.equal(audit.summary.primitiveRecords, 185);
  assert.deepEqual(audit.summary.statusCounts, { PROVISIONAL: 67, PROVEN: 118 });
  assert.equal(audit.summary.finishTargetCount, 118);
  assert.equal(audit.summary.uv0Count, 136);
  assert.equal(audit.summary.uv1Count, 0);
  assert.equal(audit.summary.tangentCount, 0);
  assert.deepEqual(audit.summary.appendedOrReplacedUvInventory, []);
  assert.deepEqual(audit.summary.appendedTangentInventory, []);
  assert.equal(audit.summary.sharpUnbeveledFinishBoxes, 76);
  assert.equal(audit.summary.finishUvDegenerateTriangleCount, audit.summary.finishWorldDegenerateTriangleCount);
  assert.ok(Math.abs(audit.summary.finishUvPhysicalScaleMetersPerRepeat - 0.6096) < 1e-6);
  assert.ok(audit.summary.finishUvMaximumAnisotropicStretch < 1.00001);

  assert.equal(new Set(audit.records.map(({ stablePrimitiveId }) => stablePrimitiveId)).size, 185);
  assert.equal(audit.records.filter(({ finishTarget }) => finishTarget).length, 118);
  assert.ok(audit.records.filter(({ finishTarget }) => finishTarget).every((record) => (
    record.originalMaterialIndex === 3
    && record.semantic.status === "PROVEN"
    && record.semantic.zone === "millwork"
    && record.uvAudit.present
    && record.uvAudit.presentationUvMutation === "none"
  )));
  assert.ok(audit.records.filter(({ finishTarget }) => !finishTarget).every(({ semantic }) => semantic.status === "PROVISIONAL"));

  for (const record of audit.records) {
    assert.match(record.stablePrimitiveId, /^scene:0\/nodes:\d+(?:\/\d+)*\/mesh:\d+\/primitive:0$/);
    assert.equal(record.geometry.indexed, true);
    assert.equal(record.geometry.mode, 4);
    assert.ok(record.geometry.index);
    assert.ok(record.geometry.attributes.POSITION);
    assert.ok(record.geometry.attributes.NORMAL);
    assert.equal(record.geometry.attributes.TANGENT, undefined);
    assert.equal(record.geometry.attributes.TEXCOORD_1, undefined);
    for (const accessor of [record.geometry.index, ...Object.values(record.geometry.attributes)]) {
      const source = accessorByIndex.get(accessor.index);
      assert.ok(source, `missing accessor ${accessor.index}`);
      assert.equal(accessor.count, source.count);
      assert.equal(accessor.type, source.type);
      assert.equal(accessor.componentType, source.componentType);
      assert.equal(accessor.normalized, source.normalized);
      assert.equal(accessor.dataSha256, source.dataSha256);
    }
  }
});

test("every commercial appearance asset has exact local provenance, role, dimensions, and bytes", async () => {
  const manifest = await readJson("config/room2-commercial-pbr-v1-assets.json");
  assert.equal(manifest.schema, "jq-room2-commercial-pbr-v1-asset-provenance-v1");
  assert.equal(manifest.policy.remoteRuntimeDependencies, 0);
  assert.match(manifest.policy.ktx2Decision, /pinned KTX2\/Basis encoder was not present/);
  assert.match(manifest.policy.sourceRightsBasis, /repository-owned/);
  assert.match(manifest.policy.finishAccuracy, /provisional digital color targets only/);
  assert.match(manifest.policy.grainMirroringPolicy, /No production wood derivative uses pixel flips or reflections/);
  assert.doesNotMatch(JSON.stringify(manifest), /\/Users\/|vladimir|token|cookie|secret/i);

  const licenseBytes = await readFile(join(root, manifest.policy.licenseNoticePath));
  assert.equal(licenseBytes.byteLength, manifest.policy.licenseNoticeBytes);
  assert.equal(sha256(licenseBytes), manifest.policy.licenseNoticeSha256);

  for (const source of manifest.sources) {
    assert.ok(source.author);
    assert.ok(source.license);
    for (const record of source.files || []) {
      const bytes = await readFile(join(root, record.path));
      assert.equal(bytes.byteLength, record.bytes, record.path);
      assert.equal(sha256(bytes), record.sha256, record.path);
    }
    for (const record of source.externalFiles || []) {
      assert.match(record.url, /^https:\/\//);
      assert.ok(record.bytes > 0);
      assert.match(record.sha256, /^[a-f0-9]{64}$/);
      assert.ok(record.dimensions.every((value) => Number.isInteger(value) && value > 0));
    }
  }

  for (const record of manifest.derivedAssets) {
    const bytes = await readFile(join(root, record.path));
    const metadata = await stat(join(root, record.path));
    assert.equal(metadata.isFile(), true);
    assert.equal(metadata.isSymbolicLink(), false);
    assert.equal(bytes.byteLength, record.bytes, record.path);
    assert.equal(sha256(bytes), record.sha256, record.path);
    assert.deepEqual(readWebpDimensions(bytes), { width: 512, height: 512 });
    assert.ok(Math.max(...record.dimensions) <= manifest.policy.maximumTextureDimension);
    assert.ok(["sRGB", "NoColorSpace"].includes(record.colorSpace));
    assert.ok(record.command);
    if (/\/(?:oak|walnut)\//.test(record.path)) assert.doesNotMatch(record.command, /hflip|vflip/);
  }
});

test("finish families preserve names/order, isolate paint from wood, and use the right color roles", () => {
  const profile = ROOM2_APPEARANCE_PROFILE;
  assert.deepEqual(FINISH_OPTIONS.wood.map(({ id, label }) => [id, label]), [
    ["white-oak", "White Oak"],
    ["natural-oak", "Natural Oak"],
    ["light-walnut", "Light Walnut"],
    ["medium-walnut", "Medium Walnut"],
    ["dark-walnut", "Dark Walnut"]
  ]);
  assert.deepEqual(["shop-primed", "warm-white", "soft-ivory", "sage-gray", "charcoal"].map((id) => profile.materials.finishes[id].label), [
    "Shop-Primed", "Warm White", "Soft Ivory", "Sage Gray", "Charcoal"
  ]);
  assert.deepEqual(Object.keys(profile.materials.families.oak.maps), ["map", "normalMap", "roughnessMap"]);
  assert.deepEqual(Object.keys(profile.materials.families.walnut.maps), ["map", "roughnessMap"]);
  assert.deepEqual(profile.materials.families.walnut.normalScale, [0, 0]);
  assert.deepEqual(Object.keys(profile.materials.families.paint.maps), ["normalMap", "roughnessMap"]);
  assert.equal("map" in profile.materials.families.paint.maps, false);
  assert.equal(profile.materials.texturePipeline.colorRoles.baseColor, "sRGB");
  assert.equal(profile.materials.texturePipeline.colorRoles.normal, "NoColorSpace");
  assert.equal(profile.materials.texturePipeline.colorRoles.roughness, "NoColorSpace");
  assert.equal(profile.materials.texturePipeline.ktx2, false);
  assert.equal(profile.materials.texturePipeline.format, "local WebP fallback");
  assert.equal(profile.materials.grain.authoredMetersPerRepeat, 0.6096);
  assert.equal(profile.materials.grain.sourceUvMutation, "none");
  assert.equal(profile.materials.grain.tangentAppend, "none");
  assert.match(profile.materials.grain.tangentBasis, /derivative/);
  assert.equal(profile.materials.grain.stablePhaseBuckets, 997);
  assert.match(profile.materials.grain.stableCutVariation, /FNV-1a/);
  assert.equal(profile.materials.surfaceRecipes["support-hardware"].metalness, 1);
  assert.equal(profile.materials.surfaceRecipes["knob-hardware"].metalness, 1);
  for (const [zone, recipe] of Object.entries(profile.materials.surfaceRecipes)) {
    if (!zone.includes("hardware")) assert.equal(recipe.metalness, 0, zone);
  }
});

test("millwork grain roles are leaf-specific and exhaust the proven source inventory", async () => {
  const audit = await readJson("config/room2-commercial-pbr-v1-semantic-audit.json");
  const mappedMeshIndices = Object.values(ROOM2_APPEARANCE_PROFILE.semanticMapping.millworkRoleMeshIndices).flat();
  assert.equal(mappedMeshIndices.length, 118);
  assert.equal(new Set(mappedMeshIndices).size, 118);
  const roleCounts = Object.fromEntries(Object.entries(
    audit.records.filter(({ finishTarget }) => finishTarget).reduce((counts, record) => {
      const role = classifyRoom2MillworkRole(record.observedNamePath);
      assert.equal(record.semantic.role, role);
      assert.equal(resolveRoom2MillworkRole(record.meshIndex, []), role);
      counts[role] = (counts[role] || 0) + 1;
      return counts;
    }, {})
  ).sort(([left], [right]) => left.localeCompare(right)));
  assert.deepEqual(roleCounts, {
    "back-panel": 12,
    "bottom-panel": 6,
    "cabinet-door": 8,
    "end-panel": 24,
    nailer: 4,
    shelf: 20,
    "side-member": 8,
    stile: 10,
    "toe-skin": 2,
    "top-panel": 14,
    "top-rail": 4,
    trim: 6
  });
  assert.equal(roleCounts["millwork-other"], undefined);
});

test("runtime source enforces atomic lazy Finish loading without geometry or topology mutation", async () => {
  const [materials, viewer] = await Promise.all([
    readFile(join(root, "guided-room2-materials.js"), "utf8"),
    readFile(join(root, "guided-layout-viewer.js"), "utf8")
  ]);
  assert.match(materials, /prepareInitialFinish/);
  assert.match(materials, /notifyState\("finish-loading"/);
  assert.match(materials, /sequence !== this\.finishSelectionSequence/);
  assert.match(materials, /this\.applyLoadedFinish\(finish\)/);
  assert.match(materials, /state === "ready"/);
  assert.match(materials, /explicitRetry/);
  assert.match(materials, /textureRequestCounts\.set\(url, \(this\.textureRequestCounts\.get\(url\) \|\| 0\) \+ 1\)/);
  assert.match(materials, /ROOM2_FINISH_COVERAGE_MISMATCH/);
  assert.match(materials, /ROOM2_RUNTIME_GEOMETRY_MUTATION/);
  assert.match(materials, /ROOM2_RUNTIME_ATTRIBUTE_MUTATION/);
  assert.match(viewer, /reconcileRequestedFinishForLoad/);
  assert.match(viewer, /this\.requestedFinishId !== finishRequestId/);
  assert.match(viewer, /this\.finishSequence !== expectedFinishSequence/);
  assert.match(viewer, /last verified appearance remains visible/);
  assert.doesNotMatch(materials + viewer, /computeMikkTSpaceTangents|toNonIndexed|mergeVertices|\.geometry\.(?:setIndex|deleteAttribute|setAttribute)\(/);
  assert.doesNotMatch(materials + viewer, /position\.array\s*\[|normal\.array\s*\[|index\.array\s*\[/);
  assert.equal((viewer.match(/setAnimationLoop/g) || []).length, 1);
  assert.match(viewer, /renderer\.setAnimationLoop\?\.\(null\)/);
  assert.match(viewer, /new URL\(layoutRecord\.runtimeAsset\.path, document\.baseURI\)/);
  assert.match(viewer, /new URL\(definition\.url, document\.baseURI\)/);
  assert.equal((viewer.match(/fetch\(requestedUrl\.href/g) || []).length, 2);
});

test("the selected studio rig, camera fit, output conversion, and cold payload stay within gates", async () => {
  const profile = ROOM2_APPEARANCE_PROFILE;
  assert.equal(profile.lighting.semanticRoleCount, 2);
  assert.equal(profile.lighting.directLightObjectCount, 3);
  assert.equal(profile.lighting.maximumShadowCasters, 1);
  assert.equal(profile.renderer.colorManagement.outputTransformCount, 1);
  assert.equal(profile.renderer.postProcessing.enabled, false);
  assert.equal(profile.renderer.gtao.enabled, false);
  assert.equal(profile.renderer.renderMode, "on-demand");
  assert.equal(profile.camera.filmGauge, 35);
  assert.ok(Math.abs(profile.camera.expectedFocalLengthMillimeters - 49.418475) < 1e-6);
  assert.equal(profile.camera.minimumRadius, 5.2);
  assert.equal(profile.camera.closestDetailRadius, profile.camera.minimumRadius);
  assert.deepEqual(profile.camera.occupancyTiers.map(({ id, acceptedWidth }) => [id, acceptedWidth]), [
    ["phone", [0.88, 0.96]],
    ["tablet", [0.82, 0.92]],
    ["desktop", [0.78, 0.88]]
  ]);

  const initialPaths = [
    profile.environment.url,
    ...Object.values(profile.materials.families.oak.maps),
    "guided-room2-appearance.js",
    "guided-room2-materials.js",
    "guided-layout-registry.js",
    "guided-layout-material-zones.generated.js",
    "guided-layout-viewer.js",
    "assets/vendor/three.module.js",
    "assets/vendor/three-webgpu-renderer-r166.bundle.js",
    "assets/vendor/three-addons/loaders/RGBELoader.js",
    "assets/vendor/three-addons/loaders/GLTFLoader.js",
    "assets/vendor/three-addons/utils/BufferGeometryUtils.js",
    "assets/vendor/three-addons/lights/RectAreaLightUniformsLib.js"
  ];
  const initialBytes = (await Promise.all(initialPaths.map((path) => stat(join(root, path))))).reduce((sum, item) => sum + item.size, 0);
  const deferredBytes = profile.materials.families.walnut.bytes.total + profile.materials.families.paint.bytes.total;
  assert.ok(initialBytes <= 8 * 1024 * 1024, `cold appearance payload ${initialBytes} exceeds 8 MiB`);
  assert.equal(deferredBytes, 330368);
});
