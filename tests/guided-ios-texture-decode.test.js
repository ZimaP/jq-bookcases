import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { IMMERSIVE_LAYOUT_ORDER, IMMERSIVE_LAYOUT_REGISTRY } from "../guided-layout-registry.js";
import { inspectRoom2Glb } from "../guided-room2-integrity.js";
import {
  createIosTextureDecodeGltfJson,
  isIosTextureDecodeRuntime
} from "../guided-layout-viewer.js";

const root = new URL("../", import.meta.url);

test("iPhone and touch-capable iPad runtimes receive the bounded texture-decode path", () => {
  assert.equal(isIosTextureDecodeRuntime({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 CriOS/138.0 Mobile/15E148 Safari/604.1", platform: "iPhone", maxTouchPoints: 5 }), true);
  assert.equal(isIosTextureDecodeRuntime({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.6 Safari/605.1.15", platform: "MacIntel", maxTouchPoints: 5 }), true);
  assert.equal(isIosTextureDecodeRuntime({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.6 Safari/605.1.15", platform: "MacIntel", maxTouchPoints: 0 }), false);
  assert.equal(isIosTextureDecodeRuntime({ userAgent: "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/138.0 Mobile Safari/537.36", platform: "Linux armv8l", maxTouchPoints: 5 }), false);
});

test("the iOS parse document externalizes only the verified floor image and preserves geometry", async () => {
  const floorAsset = await readFile(new URL("assets/premium-model-v1/textures/floor/source-maple-floor-ios-v1.jpg", root));
  assert.equal(floorAsset.byteLength, 266509);
  assert.equal(createHash("sha256").update(floorAsset).digest("hex"), "b00f0d09491740919a22fd86b9e1cb3b77c5bc5d3110f25f880707007b5b18cd");

  for (const layoutId of IMMERSIVE_LAYOUT_ORDER) {
    const layout = IMMERSIVE_LAYOUT_REGISTRY[layoutId];
    const bytes = await readFile(new URL(layout.runtimeAsset.path, root));
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const inspection = inspectRoom2Glb(arrayBuffer);
    const definition = layout.iosTextureDecode;
    const sourceJson = JSON.stringify(inspection.json);
    const transformed = createIosTextureDecodeGltfJson(inspection.json, definition, "blob:verified-binary", "blob:verified-floor");

    assert.equal(JSON.stringify(inspection.json), sourceJson, `${layoutId} source JSON remains immutable`);
    assert.equal(transformed.buffers[0].uri, "blob:verified-binary");
    assert.equal(transformed.images[definition.floorImageIndex].uri, "blob:verified-floor");
    assert.equal("bufferView" in transformed.images[definition.floorImageIndex], false);
    assert.equal(JSON.stringify(transformed.nodes), JSON.stringify(inspection.json.nodes));
    assert.equal(JSON.stringify(transformed.meshes), JSON.stringify(inspection.json.meshes));
    assert.equal(JSON.stringify(transformed.accessors), JSON.stringify(inspection.json.accessors));
    assert.equal(JSON.stringify(transformed.bufferViews), JSON.stringify(inspection.json.bufferViews));
    assert.equal(JSON.stringify(transformed.materials), JSON.stringify(inspection.json.materials));
    for (let imageIndex = 0; imageIndex < transformed.images.length; imageIndex += 1) {
      if (imageIndex === definition.floorImageIndex) continue;
      assert.deepEqual(transformed.images[imageIndex], inspection.json.images[imageIndex]);
    }
  }
});
