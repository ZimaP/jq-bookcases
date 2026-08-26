import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  IMMERSIVE_LAYOUT_ORDER,
  IMMERSIVE_LAYOUT_REGISTRY,
  getImmersiveLayout
} from "../guided-layout-registry.js";
import { inspectRoom2Glb } from "../guided-room2-integrity.js";
import { deriveIosGlb } from "../tools/generate-ios-mobile-models.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const floorPath = "assets/premium-model-v1/textures/floor/source-maple-floor-ios-v1.jpg";
const floorSha256 = "b00f0d09491740919a22fd86b9e1cb3b77c5bc5d3110f25f880707007b5b18cd";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const asArrayBuffer = (bytes) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

const EXPECTED = Object.freeze({
  "fireplace-wall": Object.freeze({
    floorImageIndex: 4,
    path: "assets/models/room2/Room2-Fireplace-bookcases-source-v1-ios-v1.glb",
    bytes: 980628,
    sha256: "9c1f2733e3ff23dc73dbf1ec0a769a498281c70b408a25bf65b14dcc96b6ebda"
  }),
  "door-wall": Object.freeze({
    floorImageIndex: 5,
    path: "assets/models/room2/jq-door-wall-bookcase-room2-authoritative-v01-ios-v1.glb",
    bytes: 1025836,
    sha256: "85232d0ade82cd4ba01141c724575b0d1266dea518735478900dcc5162f9072d"
  }),
  "window-wall": Object.freeze({
    floorImageIndex: 6,
    path: "assets/models/room4/jq-window-wall-bookcases-cabinets-room4-authoritative-v01-ios-v1.glb",
    bytes: 1261768,
    sha256: "c647eae766541e344f5e4428125557c88af12ce8c42940cde44f060335fcb2b5"
  })
});

test("every browser selects the exact bounded decode-safe model assets", () => {
  for (const layoutId of IMMERSIVE_LAYOUT_ORDER) {
    for (const navigatorLike of [
      { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", platform: "Win32", maxTouchPoints: 0 },
      { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)", platform: "MacIntel", maxTouchPoints: 0 },
      { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X)", platform: "iPhone", maxTouchPoints: 5 },
      { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)", platform: "MacIntel", maxTouchPoints: 5 }
    ]) {
      const runtime = getImmersiveLayout(layoutId, navigatorLike);
      assert.notEqual(runtime, IMMERSIVE_LAYOUT_REGISTRY[layoutId]);
      assert.deepEqual(runtime.runtimeAsset, {
        path: EXPECTED[layoutId].path,
        bytes: EXPECTED[layoutId].bytes,
        sha256: EXPECTED[layoutId].sha256
      });
      assert.deepEqual(runtime.authoritativeSource, IMMERSIVE_LAYOUT_REGISTRY[layoutId].authoritativeSource);
    }
  }
  assert.equal(getImmersiveLayout("missing", { userAgent: "iPhone" }), null);
});

test("the committed iOS GLBs are deterministic floor-image-only derivatives of the authoritative geometry", async () => {
  const floor = await readFile(`${root}/${floorPath}`);
  assert.equal(floor.length, 266509);
  assert.equal(sha256(floor), floorSha256);

  for (const layoutId of IMMERSIVE_LAYOUT_ORDER) {
    const sourceRecord = IMMERSIVE_LAYOUT_REGISTRY[layoutId];
    const expected = EXPECTED[layoutId];
    const [source, committed] = await Promise.all([
      readFile(`${root}/${sourceRecord.runtimeAsset.path}`),
      readFile(`${root}/${expected.path}`)
    ]);
    assert.equal(source.length, sourceRecord.runtimeAsset.bytes, `${layoutId} authoritative bytes`);
    assert.equal(sha256(source), sourceRecord.runtimeAsset.sha256, `${layoutId} authoritative sha256`);
    assert.equal(committed.length, expected.bytes, `${layoutId} iOS bytes`);
    assert.equal(sha256(committed), expected.sha256, `${layoutId} iOS sha256`);
    assert.ok(committed.equals(deriveIosGlb(source, floor, expected.floorImageIndex)), `${layoutId} deterministic derivation`);

    const sourceInspection = inspectRoom2Glb(asArrayBuffer(source));
    const mobileInspection = inspectRoom2Glb(asArrayBuffer(committed));
    assert.deepEqual(mobileInspection.counts, sourceInspection.counts, `${layoutId} geometry counts`);
    for (const key of ["scenes", "scene", "nodes", "meshes", "accessors", "textures", "samplers", "animations", "skins", "cameras"]) {
      assert.equal(JSON.stringify(mobileInspection.json[key]), JSON.stringify(sourceInspection.json[key]), `${layoutId} ${key}`);
    }
    assert.equal(mobileInspection.json.asset.extras.jqIosFloorDerivative, "ios-v1");
    assert.equal(mobileInspection.json.asset.extras.jqIosMaterialDecodeProfile, "external-pbr-v1");
    for (const material of mobileInspection.json.materials || []) {
      assert.equal(material.normalTexture, undefined);
      assert.equal(material.occlusionTexture, undefined);
      assert.equal(material.emissiveTexture, undefined);
      assert.equal(material.pbrMetallicRoughness?.baseColorTexture, undefined);
      assert.equal(material.pbrMetallicRoughness?.metallicRoughnessTexture, undefined);
      assert.equal(material.extensions?.KHR_materials_pbrSpecularGlossiness?.diffuseTexture, undefined);
      assert.equal(material.extensions?.KHR_materials_pbrSpecularGlossiness?.specularGlossinessTexture, undefined);
    }
    assert.equal(sourceInspection.json.images[expected.floorImageIndex].mimeType, "image/png");
    assert.equal(mobileInspection.json.images[expected.floorImageIndex].mimeType, "image/jpeg");
    assert.equal(mobileInspection.json.images[expected.floorImageIndex].bufferView, sourceInspection.json.images[expected.floorImageIndex].bufferView);

    const floorViewIndex = sourceInspection.json.images[expected.floorImageIndex].bufferView;
    for (let index = 0; index < sourceInspection.json.bufferViews.length; index += 1) {
      if (index === floorViewIndex) continue;
      const sourceView = sourceInspection.json.bufferViews[index];
      const mobileView = mobileInspection.json.bufferViews[index];
      assert.equal(mobileView.byteLength, sourceView.byteLength, `${layoutId} bufferView ${index} length`);
      const sourcePayload = sourceInspection.binary.subarray(sourceView.byteOffset || 0, (sourceView.byteOffset || 0) + sourceView.byteLength);
      const mobilePayload = mobileInspection.binary.subarray(mobileView.byteOffset || 0, (mobileView.byteOffset || 0) + mobileView.byteLength);
      assert.deepEqual(mobilePayload, sourcePayload, `${layoutId} bufferView ${index} payload`);
    }
  }
});
