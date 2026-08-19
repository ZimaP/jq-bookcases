import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  IMMERSIVE_LAYOUT_ORDER,
  IMMERSIVE_LAYOUT_REGISTRY,
  getImmersiveLayout,
  getSmartDimensionDefaults,
  normalizeSmartDimension
} from "../guided-layout-registry.js";
import {
  GUIDED_PROJECT_SCHEMA_VERSION,
  buildProjectSummary,
  createProject,
  normalizeProject
} from "../guided-configurator-state.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const readJson = async (path) => JSON.parse(await readFile(`${root}/${path}`, "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const EXPECTED = Object.freeze({
  "fireplace-wall": Object.freeze({
    roomId: "room2",
    path: "assets/models/room2/Room2-Fireplace-bookcases-source-v1.glb",
    bytes: 6712076,
    sha256: "251af4f7cb669976dec9dcaa46905982f9ae085b7bfb30e27e1bf9900a01a8d5",
    sourceContract: "8762fe4326e22e46a163343e5fde410e231d651b48d1b1c9be8391febec8f6ff",
    nodes: 455, meshes: 185, primitives: 185, accessors: 556, triangles: 18306,
    degenerates: 115, targetNode: 429, targetMesh: 175,
    min: 0, native: 265.500022, max: 531.000043, finishTargets: 118
  }),
  "door-wall": Object.freeze({
    roomId: "room2",
    path: "assets/models/room2/jq-door-wall-bookcase-room2-authoritative-v01.glb",
    bytes: 6755128,
    sha256: "4969169cb29bcf51a72a2db6c4cd83631cd94c7d78154bc37558ee9adaba98cb",
    sourceContract: "302ad57c1f7360966fb42714b2fd8c519f64856586eba632bf2f89427f2bc4d8",
    nodes: 317, meshes: 127, primitives: 127, accessors: 368, triangles: 15017,
    degenerates: 85, targetNode: 138, targetMesh: 54,
    min: 0, native: 304.800045, max: 609.599993, finishTargets: 0
  }),
  "window-wall": Object.freeze({
    roomId: "room4",
    path: "assets/models/room4/jq-window-wall-bookcases-cabinets-room4-authoritative-v01.glb",
    bytes: 6993036,
    sha256: "631005c025324c5162de6e414267101d6260d58c6198d561e6799568cef1fd24",
    sourceContract: "0f339076140a88e3942b220fcb217bbf3133876717149cba0522bc1e0b539e9c",
    nodes: 442, meshes: 182, primitives: 182, accessors: 544, triangles: 19244,
    degenerates: 146, targetNode: 249, targetMesh: 100,
    min: 0, native: 304.800045, max: 609.599993, finishTargets: 0
  })
});

test("the shared registry exposes exactly the retained Fireplace parent and two authorized additions", () => {
  assert.deepEqual(IMMERSIVE_LAYOUT_ORDER, ["fireplace-wall", "door-wall", "window-wall"]);
  assert.deepEqual(Object.keys(IMMERSIVE_LAYOUT_REGISTRY), IMMERSIVE_LAYOUT_ORDER);
  for (const layoutId of IMMERSIVE_LAYOUT_ORDER) {
    const layout = getImmersiveLayout(layoutId);
    const expected = EXPECTED[layoutId];
    assert.equal(layout.productId, "cabinet-shelves");
    assert.equal(layout.layoutId, layoutId);
    assert.equal(layout.roomId, expected.roomId);
    assert.deepEqual(layout.runtimeAsset, {
      path: expected.path,
      bytes: expected.bytes,
      sha256: expected.sha256
    });
    assert.equal(layout.runtimeDerivative, null);
    assert.equal(layout.authoritativeSource.path, expected.path);
    assert.equal(layout.authoritativeSource.sourceContractFingerprint, expected.sourceContract);
    assert.equal(layout.rendererSupport.webgl2, "supported-forced-and-fallback");
    assert.match(layout.rendererSupport.webgpu, /supported/);
    assert.equal(layout.dimensionSupportMatrix["adjustable-shelf-clearance"], "PROVEN");
    for (const blocked of ["spans", "openings", "height", "depth"]) {
      assert.equal(layout.dimensionSupportMatrix[blocked], "BLOCKED");
    }
  }
  assert.equal(getImmersiveLayout("clear-wall"), null);
});

test("all three committed authoritative sources remain exact regular non-LFS GLBs", async () => {
  for (const layoutId of IMMERSIVE_LAYOUT_ORDER) {
    const expected = EXPECTED[layoutId];
    const [metadata, bytes] = await Promise.all([
      lstat(`${root}/${expected.path}`),
      readFile(`${root}/${expected.path}`)
    ]);
    assert.equal(metadata.isFile(), true, layoutId);
    assert.equal(metadata.isSymbolicLink(), false, layoutId);
    assert.equal(bytes.length, expected.bytes, layoutId);
    assert.equal(sha256(bytes), expected.sha256, layoutId);
    assert.equal(bytes.subarray(0, 4).toString("ascii"), "glTF", layoutId);
    assert.doesNotMatch(bytes.subarray(0, 128).toString("utf8"), /git-lfs|oid sha256/i, layoutId);
  }
});

test("generated model audits exhaustively match registry identities, hierarchy, accessors, and control authority", async () => {
  const audit = await readJson("config/immersive-layout-model-audit-v1.json");
  assert.equal(audit.schema, "jq-immersive-layout-model-audit-v1");
  assert.deepEqual(audit.layouts.map(({ layoutId }) => layoutId), IMMERSIVE_LAYOUT_ORDER);
  for (const record of audit.layouts) {
    const expected = EXPECTED[record.layoutId];
    assert.deepEqual(record.authoritativeSource, {
      path: expected.path, bytes: expected.bytes, sha256: expected.sha256, runtimeDerivative: null
    });
    assert.equal(record.fingerprints.sourceContract.sha256, expected.sourceContract);
    assert.match(record.fingerprints.sourceContract.algorithm, /createGlbProof-v1/);
    assert.match(record.fingerprints.geometryTopologyTransformsNoMaterial.algorithm, /no-material-v1/);
    assert.equal(record.gltf.counts.nodes, expected.nodes);
    assert.equal(record.gltf.counts.meshes, expected.meshes);
    assert.equal(record.gltf.counts.primitives, expected.primitives);
    assert.equal(record.gltf.counts.accessors, expected.accessors);
    assert.equal(record.gltf.counts.triangles, expected.triangles);
    assert.equal(record.gltf.nativeDegenerateTriangles, expected.degenerates);
    assert.equal(record.nodeHierarchy.length, expected.nodes);
    assert.equal(record.accessorProofs.length, expected.accessors);
    assert.deepEqual(record.gltf.externalUris, []);
    assert.deepEqual(record.gltf.extensionsRequired, []);
    assert.ok(record.gltf.extensionsUsed.includes("KHR_materials_pbrSpecularGlossiness"));
    assert.deepEqual(record.blockedControls.map(({ id, status }) => [id, status]), [
      ["spans", "BLOCKED"], ["openings", "BLOCKED"], ["height", "BLOCKED"], ["depth", "BLOCKED"]
    ]);
    const control = record.controls[0];
    assert.equal(record.controls.length, 1);
    assert.equal(control.id, "adjustable-shelf-clearance");
    assert.equal(control.status, "PROVEN");
    assert.equal(control.nonGlobal, true);
    assert.equal(control.operation, "rigid-node-translation");
    assert.equal(control.target.nodeIndex, expected.targetNode);
    assert.equal(control.targetMesh.meshIndex, expected.targetMesh);
    assert.deepEqual(control.rangeMillimeters, {
      min: expected.min, native: expected.native, max: expected.max, step: 6.35, snapOrigin: "native"
    });
    assert.ok(control.invariantLocalNodeIndices.length >= expected.nodes - 2);
    assert.ok(control.geometryInvariants.some((value) => /typed-array bytes remain byte-identical/.test(value)));
    assert.deepEqual(control.automatedRuntimeProof.requiredCases, [
      "min", "native", "max", "50 edit/reset cycles", "A→B→C→A state isolation",
      "pointer", "touch", "keyboard", "panel"
    ]);
  }
});

test("each enabled smart dimension has a finite geometry-derived range and deterministic native-relative snapping", () => {
  for (const layoutId of IMMERSIVE_LAYOUT_ORDER) {
    const expected = EXPECTED[layoutId];
    const control = getImmersiveLayout(layoutId).geometryControlManifest["adjustable-shelf-clearance"];
    assert.equal(control.status, "PROVEN");
    assert.equal(control.operation, "rigid-node-translation");
    assert.equal(control.minMillimeters, expected.min);
    assert.equal(control.nativeMillimeters, expected.native);
    assert.equal(control.maxMillimeters, expected.max);
    assert.ok(Math.abs(
      control.nativeTargetBottomMillimeters - control.lowerAnchorTopMillimeters - control.nativeMillimeters
    ) < 1e-5);
    assert.ok(Math.abs(
      control.upperAnchorBottomMillimeters
        - control.targetThicknessMillimeters
        - control.lowerAnchorTopMillimeters
        - control.maxMillimeters
    ) < 1e-6);
    assert.match(control.formula, /nativeTranslationZ \+ \(clearanceMm - nativeClearanceMm\)/);
    assert.deepEqual(getSmartDimensionDefaults(layoutId), {
      "adjustable-shelf-clearance": expected.native
    });
    for (const value of [expected.min, expected.native, expected.max]) {
      assert.equal(normalizeSmartDimension(layoutId, control.id, value), value);
    }
    let value = expected.native;
    for (let cycle = 0; cycle < 50; cycle += 1) {
      value = normalizeSmartDimension(layoutId, control.id, cycle % 2 ? expected.max : expected.min);
      value = normalizeSmartDimension(layoutId, control.id, expected.native);
    }
    assert.equal(value, expected.native);
    assert.equal(normalizeSmartDimension(layoutId, control.id, Number.NaN), expected.native);
  }
});

test("material-zone audits cover every primitive exactly and permit automatic mapping only on proven records", async () => {
  const audit = await readJson("config/immersive-layout-material-zones-v1.json");
  assert.equal(audit.schema, "jq-immersive-layout-material-zones-v1");
  assert.deepEqual(audit.layouts.map(({ layoutId }) => layoutId), IMMERSIVE_LAYOUT_ORDER);
  for (const layout of audit.layouts) {
    const expected = EXPECTED[layout.layoutId];
    assert.deepEqual(layout.source, {
      path: expected.path,
      bytes: expected.bytes,
      sha256: expected.sha256,
      sourceContractFingerprint: expected.sourceContract
    });
    assert.equal(layout.records.length, expected.primitives);
    assert.equal(layout.summary.primitiveRecords, expected.primitives);
    assert.equal(layout.summary.unmappedCount, 0);
    assert.equal(layout.summary.finishTargetCount, expected.finishTargets);
    assert.equal(new Set(layout.records.map(({ stablePrimitiveId }) => stablePrimitiveId)).size, expected.primitives);
    for (const record of layout.records) {
      assert.ok(["PROVEN", "PROVISIONAL", "BLOCKED"].includes(record.status));
      assert.ok(record.sourceAccessors.indices);
      assert.ok(record.sourceAccessors.attributes.POSITION);
      if (record.finishTarget) {
        assert.equal(record.status, "PROVEN");
        assert.ok(record.permittedRuntimeMapping);
      } else {
        assert.equal(record.permittedRuntimeMapping, null);
      }
    }
    if (layout.layoutId !== "fireplace-wall") {
      assert.equal(layout.automaticFinishMapping, "blocked-unless-explicitly-proven");
      assert.equal(layout.records.some(({ finishTarget }) => finishTarget), false);
    }
  }
});

test("schemas 1 through 4 migrate idempotently and seed isolated state for every live layout", () => {
  for (const schemaVersion of [1, 2, 3, 4]) {
    const legacy = {
      ...createProject({ now: 1000 + schemaVersion, random: 0.25, productSelected: true }),
      schemaVersion,
      currentStep: schemaVersion === 1 ? 3 : 4,
      maxVisitedStep: schemaVersion === 1 ? 4 : 5,
      layout: "fireplace-wall",
      measurements: { wallWidth: 211 + schemaVersion, ceilingHeight: 96, desiredDepth: 14 },
      layoutStates: undefined
    };
    const once = normalizeProject(legacy, { now: 2000 });
    const twice = normalizeProject(once, { now: 2000 });
    assert.equal(once.schemaVersion, GUIDED_PROJECT_SCHEMA_VERSION);
    assert.deepEqual(twice, once, `schema ${schemaVersion} migration must be idempotent`);
    assert.deepEqual(Object.keys(once.layoutStates), IMMERSIVE_LAYOUT_ORDER);
    assert.equal(once.layoutStates["fireplace-wall"].measurements.wallWidth, 211 + schemaVersion);
    for (const layoutId of IMMERSIVE_LAYOUT_ORDER) {
      assert.deepEqual(once.layoutStates[layoutId].smartDimensions, getSmartDimensionDefaults(layoutId));
    }
  }
});

test("A→B→C→A normalization preserves independent measurements and smart dimensions", () => {
  const dimensions = Object.fromEntries(IMMERSIVE_LAYOUT_ORDER.map((layoutId, index) => {
    const control = getImmersiveLayout(layoutId).geometryControlManifest["adjustable-shelf-clearance"];
    return [layoutId, index === 0 ? control.minMillimeters : index === 1 ? control.nativeMillimeters : control.maxMillimeters];
  }));
  const initial = createProject({ now: 3000, random: 0.3, productSelected: true });
  const layoutStates = Object.fromEntries(IMMERSIVE_LAYOUT_ORDER.map((layoutId, index) => [layoutId, {
    measurements: { wallWidth: 180 + index * 10, ceilingHeight: 96, desiredDepth: 14 },
    smartDimensions: { "adjustable-shelf-clearance": dimensions[layoutId] }
  }]));
  let project = normalizeProject({
    ...initial,
    layout: "fireplace-wall",
    measurements: layoutStates["fireplace-wall"].measurements,
    layoutStates
  }, { now: 3001 });
  for (const layoutId of ["door-wall", "window-wall", "fireplace-wall"]) {
    project = normalizeProject({
      ...project,
      layout: layoutId,
      measurements: project.layoutStates[layoutId].measurements
    }, { now: 3001 });
  }
  for (const [index, layoutId] of IMMERSIVE_LAYOUT_ORDER.entries()) {
    assert.equal(project.layoutStates[layoutId].measurements.wallWidth, 180 + index * 10);
    assert.equal(project.layoutStates[layoutId].smartDimensions["adjustable-shelf-clearance"], dimensions[layoutId]);
  }
  const smartRow = buildProjectSummary(project).find(({ key }) => key === "smartDimension:adjustable-shelf-clearance");
  assert.ok(smartRow);
  assert.match(smartRow.value, /proven model preview/);
});

test("the exact WebGPU vendor bundle and real renderer thumbnails are byte locked", async () => {
  const files = [
    ["assets/vendor/three-webgpu-renderer-r166.bundle.js", 381458, "aaff4fd600cd14b710538473b1d3f3ac799fe34f08b74301f18f9e20e66a3b25"],
    ["assets/photos/configurator/layout-model-thumbnails/fireplace-wall-v1.png", 357029, "9d2f88d7c7cc0dce003fb30559fdd4bd0a9418bb93910f614b890a293fd08adc"],
    ["assets/photos/configurator/layout-model-thumbnails/door-wall-v1.png", 90613, "72a2680bcf0b0418c2d9004fd04b3a1252f32293439dfc74c3d8cf94fad0d270"],
    ["assets/photos/configurator/layout-model-thumbnails/window-wall-v1.png", 69497, "0ea83ccd8e73ae3095ebbd7d461d8f0b124383c463e50d124842324994b915b3"]
  ];
  for (const [path, bytes, digest] of files) {
    const payload = await readFile(`${root}/${path}`);
    assert.equal(payload.length, bytes, path);
    assert.equal(sha256(payload), digest, path);
  }
  const packageJson = await readJson("package.json");
  assert.equal(packageJson.devDependencies.three, "0.166.1");
  assert.equal(packageJson.devDependencies.esbuild, "0.28.2");
  assert.match(await readFile(`${root}/assets/vendor/licenses/three-0.166.1-LICENSE.txt`, "utf8"), /MIT License/);
});

test("customer runtime contains no Vivid dependency, request, branding, or copied reference asset", async () => {
  const sources = await Promise.all([
    "configurator.html", "guided-configurator.js", "guided-layout-registry.js",
    "guided-layout-viewer.js", "guided-immersive-configurator.css"
  ].map((path) => readFile(`${root}/${path}`, "utf8")));
  for (const source of sources) assert.doesNotMatch(source, /VividWeb|keittiosuunnittelu|k-rauta/i);
});
