import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const FLOOR_PATH = "assets/premium-model-v1/textures/floor/source-maple-floor-ios-v1.jpg";
const FLOOR_SHA256 = "b00f0d09491740919a22fd86b9e1cb3b77c5bc5d3110f25f880707007b5b18cd";
const SOURCE_FLOOR_SHA256 = "2b44ffa512f19f55d6f48ee153173affd1234ce1911ecd52256635ec6daf39f9";
const MODELS = Object.freeze([
  ["assets/models/room2/Room2-Fireplace-bookcases-source-v1.glb", 4],
  ["assets/models/room2/jq-door-wall-bookcase-room2-authoritative-v01.glb", 5],
  ["assets/models/room4/jq-window-wall-bookcases-cabinets-room4-authoritative-v01.glb", 6]
]);

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const align4 = (value) => (value + 3) & ~3;
const outputPath = (sourcePath) => sourcePath.replace(/\.glb$/u, "-ios-v1.glb");

function parseGlb(bytes) {
  if (bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) {
    throw new Error("Expected a complete glTF 2.0 binary source.");
  }
  const jsonLength = bytes.readUInt32LE(12);
  const jsonType = bytes.readUInt32LE(16);
  const binaryHeader = 20 + jsonLength;
  if (jsonType !== 0x4e4f534a || bytes.readUInt32LE(binaryHeader + 4) !== 0x004e4942) {
    throw new Error("Expected one JSON chunk followed by one BIN chunk.");
  }
  const binaryLength = bytes.readUInt32LE(binaryHeader);
  const binaryStart = binaryHeader + 8;
  return {
    json: JSON.parse(bytes.subarray(20, 20 + jsonLength).toString("utf8").trim()),
    binary: bytes.subarray(binaryStart, binaryStart + binaryLength)
  };
}

function encodeGlb(json, binary) {
  const jsonBytes = Buffer.from(JSON.stringify(json));
  const paddedJson = Buffer.alloc(align4(jsonBytes.length), 0x20);
  jsonBytes.copy(paddedJson);
  const total = 12 + 8 + paddedJson.length + 8 + binary.length;
  const output = Buffer.alloc(total);
  output.writeUInt32LE(0x46546c67, 0);
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(total, 8);
  output.writeUInt32LE(paddedJson.length, 12);
  output.writeUInt32LE(0x4e4f534a, 16);
  paddedJson.copy(output, 20);
  const binaryHeader = 20 + paddedJson.length;
  output.writeUInt32LE(binary.length, binaryHeader);
  output.writeUInt32LE(0x004e4942, binaryHeader + 4);
  binary.copy(output, binaryHeader + 8);
  return output;
}

export function deriveIosGlb(source, floorJpeg, floorImageIndex) {
  const { json, binary } = parseGlb(source);
  const image = json.images?.[floorImageIndex];
  const floorView = image && json.bufferViews?.[image.bufferView];
  if (!image || !floorView || floorView.byteLength !== 5_990_740 || floorView.byteOffset == null) {
    throw new Error("The authoritative floor image binding changed.");
  }
  const start = floorView.byteOffset;
  const end = start + floorView.byteLength;
  if (hash(binary.subarray(start, end)) !== SOURCE_FLOOR_SHA256) throw new Error("The authoritative floor image changed.");
  const replacementLength = align4(floorJpeg.length);
  const delta = replacementLength - floorView.byteLength;
  const nextBinary = Buffer.alloc(binary.length + delta);
  binary.copy(nextBinary, 0, 0, start);
  floorJpeg.copy(nextBinary, start);
  binary.copy(nextBinary, start + replacementLength, end);
  for (const view of json.bufferViews) {
    if (view === floorView) continue;
    const viewStart = view.byteOffset || 0;
    const viewEnd = viewStart + view.byteLength;
    if (viewStart < end && viewEnd > start) throw new Error("The floor image overlaps another buffer view.");
    if (viewStart >= end) view.byteOffset = viewStart + delta;
  }
  floorView.byteLength = floorJpeg.length;
  image.mimeType = "image/jpeg";
  for (const material of json.materials || []) {
    delete material.normalTexture;
    delete material.occlusionTexture;
    delete material.emissiveTexture;
    delete material.pbrMetallicRoughness?.baseColorTexture;
    delete material.pbrMetallicRoughness?.metallicRoughnessTexture;
    delete material.extensions?.KHR_materials_pbrSpecularGlossiness?.diffuseTexture;
    delete material.extensions?.KHR_materials_pbrSpecularGlossiness?.specularGlossinessTexture;
  }
  json.buffers[0].byteLength = nextBinary.length;
  json.asset.extras = {
    ...(json.asset.extras || {}),
    jqIosFloorDerivative: "ios-v1",
    jqIosMaterialDecodeProfile: "external-pbr-v1"
  };
  return encodeGlb(json, nextBinary);
}

async function main() {
  const check = process.argv.includes("--check");
  const floor = await readFile(resolve(ROOT, FLOOR_PATH));
  if (hash(floor) !== FLOOR_SHA256) throw new Error("The optimized floor texture changed.");
  for (const [sourcePath, floorImageIndex] of MODELS) {
    const source = await readFile(resolve(ROOT, sourcePath));
    const derived = deriveIosGlb(source, floor, floorImageIndex);
    const destination = resolve(ROOT, outputPath(sourcePath));
    if (check) {
      const committed = await readFile(destination);
      if (!committed.equals(derived)) throw new Error(`${outputPath(sourcePath)} is not deterministic.`);
    } else {
      await writeFile(destination, derived);
    }
    process.stdout.write(`${outputPath(sourcePath)} ${derived.length} ${hash(derived)}\n`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
