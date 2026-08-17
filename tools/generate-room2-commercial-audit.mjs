import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  createGlbProof,
  parseGlb
} from "./room2-authority-v1/room2-glb-integrity.js";
import {
  PROVEN_MATERIAL_AUTHORITY,
  buildMaterialAuthorityInventory
} from "./room2-authority-v1/material-authority.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const sourcePath = "assets/models/room2/Room2-Fireplace-bookcases-source-v1.glb";
const outputPath = "config/room2-commercial-pbr-v1-semantic-audit.json";
const expected = Object.freeze({
  bytes: 6_712_076,
  sha256: "251af4f7cb669976dec9dcaa46905982f9ae085b7bfb30e27e1bf9900a01a8d5",
  geometryFingerprint: "8762fe4326e22e46a163343e5fde410e231d651b48d1b1c9be8391febec8f6ff",
  rawMaterialDigest: "b31d96b3a248fb8d33af236e6e03f414481c907553cbcfbf482ca58a0109676d",
  embeddedImageAggregate: "6c737d2ff899087b3227f9202dcf95c874474d65dfbc6ec83c778748feced153"
});

const bytes = await readFile(`${root}/${sourcePath}`);
const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const parsed = parseGlb(arrayBuffer);
const [proof, authority] = await Promise.all([
  createGlbProof(arrayBuffer),
  buildMaterialAuthorityInventory({ arrayBuffer, json: parsed.json })
]);

assert(bytes.length === expected.bytes, "authoritative GLB byte length changed");
assert(sha256(bytes) === expected.sha256, "authoritative GLB SHA-256 changed");
assert(proof.sourceSha256 === expected.sha256, "authority proof source hash changed");
assert(proof.geometryFingerprint === expected.geometryFingerprint, "geometry fingerprint changed");
assert(authority.rawMaterialDigest.aggregateSha256 === expected.rawMaterialDigest, "raw material digest changed");
assert(authority.primitiveInstances.length === 185, "primitive instance count changed");
assert(new Set(authority.primitiveInstances.map(({ id }) => id)).size === 185, "duplicate stable primitive ID");

const definitionByKey = new Map(
  authority.primitiveDefinitions.map((record) => [`${record.meshIndex}/${record.primitiveIndex}`, record])
);
const proofAccessorByIndex = new Map(proof.inventory.accessors.map((record) => [record.index, record]));
const proofMeshByIndex = new Map(proof.inventory.meshes.map((record) => [record.index, record]));
const sourceData = { json: parsed.json, binary: parsed.binary };

const records = authority.primitiveInstances
  .filter(({ activeSceneMembership }) => activeSceneMembership)
  .map((instance) => buildRecord(instance))
  .sort(compareStableRecords);

const statusCounts = countBy(records, ({ semantic }) => semantic.status);
const zoneCounts = countBy(records, ({ semantic }) => semantic.zone);
const finishRecords = records.filter(({ finishTarget }) => finishTarget);
const uvRecords = records.filter(({ uvAudit }) => uvAudit.present);
const sharpFinishBoxes = finishRecords.filter(({ edgeReadability }) => edgeReadability.sharpUnbeveledBox).length;

assert(records.length === 185, "active semantic audit must contain 185 records");
assert(statusCounts.PROVEN === 118, "PROVEN semantic count changed");
assert(statusCounts.PROVISIONAL === 67, "PROVISIONAL semantic count changed");
assert((statusCounts.UNMAPPED || 0) === 0, "a primitive is UNMAPPED");
assert(finishRecords.length === 118, "Finish coverage count changed");
assert(finishRecords.every(({ originalMaterialIndex, uvAudit }) => originalMaterialIndex === 3 && uvAudit.present), "Finish coverage escaped material 3 or lacks UV0");
assert(uvRecords.length === 136, "UV0 primitive count changed");
assert(records.every(({ geometry }) => geometry.index && geometry.attributes.POSITION && geometry.attributes.NORMAL), "an indexed primitive lacks POSITION or NORMAL");
assert(records.every(({ geometry }) => !geometry.attributes.TANGENT && !geometry.attributes.TEXCOORD_1), "source tangent or UV1 coverage changed");
assert(sharpFinishBoxes === 76, "sharp-box edge diagnostic count changed");

const embeddedImages = buildEmbeddedImageRecords(parsed);
const embeddedCanonical = JSON.stringify({
  records: embeddedImages.map(({ imageIndex, bufferView, mimeType, byteLength, sha256: digest }) => ({
    imageIndex,
    bufferView,
    mimeType,
    byteLength,
    sha256: digest
  })),
  textureSources: (parsed.json.textures || []).map((texture, textureIndex) => ({
    textureIndex,
    imageIndex: Number.isInteger(texture.source) ? texture.source : null,
    sampler: Number.isInteger(texture.sampler) ? texture.sampler : null
  }))
});
assert(sha256(Buffer.from(canonicalSerialize(JSON.parse(embeddedCanonical)))) === expected.embeddedImageAggregate, "embedded-image aggregate changed");

const millworkUvScaleSamples = finishRecords.flatMap(({ uvAudit }) => uvAudit.edgeMetersPerUvSamples);
const output = {
  schema: "jq-room2-commercial-pbr-v1-semantic-audit-v1",
  profile: "room2-commercial-pbr-v1",
  status: "PROVISIONAL DIGITAL APPEARANCE — OWNER ACCEPTANCE OPEN",
  source: {
    path: sourcePath,
    ...expected,
    units: "meters",
    unitsAuthority: "glTF 2.0 coordinate units; source world transforms convert authored inches by 0.0254",
    counts: proof.inventory.counts,
    worldBounds: proof.inventory.worldBounds,
    immutableFields: [
      "source bytes", "accessors", "positions", "indices", "normals", "topology",
      "transforms", "hierarchy", "bounds", "macro dimensions"
    ]
  },
  authority: {
    provenMaterial: PROVEN_MATERIAL_AUTHORITY,
    sourceModuleProvenance: {
      repositoryCommit: "917ba34147fdcb3681b42cd5f36549a3874e853b",
      module: "tools/room2-authority-v1/material-authority.js",
      moduleSha256: "659f79b763685acae2cf969127c385e49624d03960d28369db1b3f57eb2d7aaf",
      geometryModule: "tools/room2-authority-v1/room2-glb-integrity.js",
      geometryModuleSha256: "a9a5f2cb758872d9913104d3b256f4e31becf1156749cd15c446c45c10537d19"
    },
    stableIdentity: "scene index + numeric node-index path + mesh/primitive ordinals + original material + accessor hashes + transforms/bounds; names are supporting evidence only"
  },
  summary: {
    primitiveRecords: records.length,
    statusCounts,
    zoneCounts,
    finishTargetCount: finishRecords.length,
    uv0Count: uvRecords.length,
    uv1Count: 0,
    tangentCount: 0,
    appendedOrReplacedUvInventory: [],
    appendedTangentInventory: [],
    finishUvPhysicalScaleMetersPerRepeat: round(median(millworkUvScaleSamples), 9),
    finishUvPhysicalScaleP95MetersPerRepeat: round(percentile(millworkUvScaleSamples, 0.95), 9),
    finishUvMaximumAnisotropicStretch: Math.max(...finishRecords.map(({ uvAudit }) => uvAudit.maximumAnisotropicStretch)),
    finishUvDegenerateTriangleCount: finishRecords.reduce((sum, { uvAudit }) => sum + uvAudit.uvDegenerateTriangleCount, 0),
    finishWorldDegenerateTriangleCount: finishRecords.reduce((sum, { uvAudit }) => sum + uvAudit.worldDegenerateTriangleCount, 0),
    sharpUnbeveledFinishBoxes: sharpFinishBoxes,
    semanticConclusion: "118 PROVEN material-3 millwork primitives are the only published Finish targets; all other exact slots are PROVISIONAL and deterministic; zero materially significant primitives are UNMAPPED.",
    fireplaceConclusion: "Material 4 is one combined fireplace appliance/body/frame primitive and material 5 is the fire plane. No distinct surround or hearth slot exists.",
    tangentConclusion: "No source tangents exist. The production candidate uses Three r166 derivative tangent basis; no MikkTSpace call, de-indexing, vertex duplication, index rewrite, or tangent append is permitted or used.",
    edgeConclusion: "Most hero millwork boxes have literal sharp edges. No bevel creation is authorized; final visual review determines whether material/light response is commercially presentable."
  },
  semanticZones: [
    { materialIndex: 0, zone: "wall-room-shell", status: "PROVISIONAL", finishTarget: false },
    { materialIndex: 1, zone: "support-hardware", status: "PROVISIONAL", finishTarget: false },
    { materialIndex: 2, zone: "knob-hardware", status: "PROVISIONAL", finishTarget: false },
    { materialIndex: 3, zone: "millwork", status: "PROVEN", finishTarget: true },
    { materialIndex: 4, zone: "fireplace-appliance-frame", status: "PROVISIONAL", finishTarget: false },
    { materialIndex: 5, zone: "fire-emissive-surface", status: "PROVISIONAL", finishTarget: false },
    { materialIndex: 6, zone: "floor", status: "PROVISIONAL", finishTarget: false },
    { materialIndex: 7, zone: "ceiling-room-shell", status: "PROVISIONAL", finishTarget: false }
  ],
  embeddedImages,
  records
};

const renderedOutput = `${JSON.stringify(output, null, 2)}\n`;
if (process.argv.includes("--check")) {
  const checkedInOutput = await readFile(`${root}/${outputPath}`, "utf8");
  assert(checkedInOutput === renderedOutput, `${outputPath} is stale; regenerate the deterministic semantic audit`);
  console.log(`${outputPath}: verified ${records.length} deterministic records`);
} else {
  await writeFile(`${root}/${outputPath}`, renderedOutput, "utf8");
  console.log(`${outputPath}: ${records.length} records; ${statusCounts.PROVEN} PROVEN; ${statusCounts.PROVISIONAL} PROVISIONAL; ${sharpFinishBoxes} sharp finish boxes`);
}

function buildRecord(instance) {
  const definition = definitionByKey.get(`${instance.meshIndex}/${instance.primitiveIndex}`);
  const proofPrimitive = proofMeshByIndex.get(instance.meshIndex)?.primitives?.[instance.primitiveIndex];
  assert(definition && proofPrimitive, `missing definition for ${instance.id}`);
  const semantic = classifySemantic(instance);
  const attributes = Object.fromEntries(
    Object.entries(definition.attributes).map(([name, accessor]) => [name, accessorRecord(accessor.accessorIndex)])
  );
  const geometry = {
    mode: definition.mode,
    indexed: Boolean(definition.indicesAccessor),
    index: definition.indicesAccessor ? accessorRecord(definition.indicesAccessor.accessorIndex) : null,
    attributes,
    morphTargets: definition.morphTargets,
    geometryFingerprint: expected.geometryFingerprint
  };
  const role = semantic.zone === "millwork" ? classifyMillworkRole(instance.observedNamePath) : semantic.zone;
  const uvAudit = attributes.TEXCOORD_0
    ? auditUvGeometry(instance, proofPrimitive, attributes.TEXCOORD_0)
    : { present: false, reason: "No authored TEXCOORD_0 accessor" };
  const positions = decodeAccessor(sourceData, proofPrimitive.attributes.POSITION);
  const triangles = decodeAccessor(sourceData, proofPrimitive.indices);
  const uniquePositions = new Set(positions.map((value) => value.map((entry) => round(entry, 9)).join(","))).size;
  const triangleCount = triangles.length / 3;
  return {
    stablePrimitiveId: instance.id,
    sceneIndex: instance.sceneIndex,
    nodeIndexPath: instance.nodeIndexPath,
    observedNamePath: instance.observedNamePath,
    nodeIndex: instance.nodeIndex,
    meshIndex: instance.meshIndex,
    primitiveIndex: instance.primitiveIndex,
    originalMaterialIndex: instance.materialIndex,
    originalMaterialName: instance.materialName,
    originalMaterial: parsed.json.materials[instance.materialIndex] || null,
    semantic: {
      ...semantic,
      role,
      evidence: "exact exclusive original material slot plus full stable consumer path; names and objective location are supporting evidence"
    },
    finishTarget: semantic.status === "PROVEN" && instance.materialIndex === 3,
    grain: semantic.zone === "millwork" ? grainRule(role) : null,
    localMatrix: instance.localMatrix,
    worldMatrix: instance.worldMatrix,
    localBounds: instance.localAabb,
    worldBounds: instance.worldAabb,
    geometry,
    uvAudit,
    edgeReadability: {
      triangleCount,
      uniquePositionCount: uniquePositions,
      sharpUnbeveledBox: semantic.zone === "millwork" && triangleCount === 12 && uniquePositions === 8,
      geometryChangeAuthorized: false
    }
  };
}

function classifySemantic(instance) {
  const materialIndex = instance.materialIndex;
  if (materialIndex === 3) return { status: "PROVEN", zone: "millwork" };
  const zones = {
    0: "wall-room-shell",
    1: "support-hardware",
    2: "knob-hardware",
    4: "fireplace-appliance-frame",
    5: "fire-emissive-surface",
    6: "floor",
    7: "ceiling-room-shell"
  };
  return { status: zones[materialIndex] ? "PROVISIONAL" : "UNMAPPED", zone: zones[materialIndex] || "unmapped" };
}

function classifyMillworkRole(namePath) {
  const leaf = namePath.filter(Boolean).at(-1) || "";
  if (/Door_H/i.test(leaf)) return "cabinet-door";
  if (/Adjustable Shelf/i.test(leaf)) return "shelf";
  if (/Stile/i.test(leaf)) return "stile";
  if (/UEnd/i.test(leaf)) return "end-panel";
  if (/UBack/i.test(leaf)) return "back-panel";
  if (/Nose/i.test(leaf)) return "trim";
  if (/Bottom/i.test(leaf)) return "bottom-panel";
  if (/Nailer/i.test(leaf)) return "nailer";
  if (/(?:^|_)Skin$/i.test(leaf)) return "toe-skin";
  if (/(?:^|_)Top$/i.test(leaf)) return "top-panel";
  if (/(?:^|_)(?:LS|RS)$/i.test(leaf)) return "side-member";
  if (/(?:^|_)TR$/i.test(leaf)) return "top-rail";
  return "millwork-other";
}

function grainRule(role) {
  if (role === "cabinet-door") {
    return { axis: "V", orientation: "vertical", physicalRepeatMeters: 0.6096 };
  }
  const orientation = ["stile", "end-panel", "back-panel"].includes(role) ? "vertical" : "long-axis";
  return { axis: "U", orientation, physicalRepeatMeters: 0.6096 };
}

function accessorRecord(index) {
  const accessor = proofAccessorByIndex.get(index);
  assert(accessor, `missing accessor ${index}`);
  return {
    index,
    count: accessor.count,
    type: accessor.type,
    componentType: accessor.componentType,
    normalized: accessor.normalized,
    dataSha256: accessor.dataSha256
  };
}

function auditUvGeometry(instance, primitive, uvAccessor) {
  const positions = decodeAccessor(sourceData, primitive.attributes.POSITION);
  const uvs = decodeAccessor(sourceData, primitive.attributes.TEXCOORD_0);
  const indices = decodeAccessor(sourceData, primitive.indices).flat();
  const edgeMetersPerUvSamples = [];
  const triangleStretch = [];
  const uvTriangleKeys = new Map();
  let uvDegenerateTriangleCount = 0;
  let worldDegenerateTriangleCount = 0;
  let positiveUvOrientationCount = 0;
  let negativeUvOrientationCount = 0;
  for (let offset = 0; offset < indices.length; offset += 3) {
    const ids = indices.slice(offset, offset + 3);
    const p = ids.map((index) => transformPoint(instance.worldMatrix, positions[index]));
    const uv = ids.map((index) => uvs[index]);
    const worldArea = triangleArea3(p[0], p[1], p[2]);
    const uvSignedDoubleArea = cross2(sub2(uv[1], uv[0]), sub2(uv[2], uv[0]));
    const uvArea = Math.abs(uvSignedDoubleArea) / 2;
    if (worldArea <= 1e-12) worldDegenerateTriangleCount += 1;
    if (uvArea <= 1e-12) uvDegenerateTriangleCount += 1;
    else if (uvSignedDoubleArea > 0) positiveUvOrientationCount += 1;
    else negativeUvOrientationCount += 1;
    const scales = [];
    for (const [left, right] of [[0, 1], [1, 2], [2, 0]]) {
      const uvLength = distance2(uv[left], uv[right]);
      const worldLength = distance3(p[left], p[right]);
      if (uvLength > 1e-9 && worldLength > 1e-9) {
        const scale = worldLength / uvLength;
        scales.push(scale);
        edgeMetersPerUvSamples.push(scale);
      }
    }
    if (scales.length >= 2) triangleStretch.push(Math.max(...scales) / Math.min(...scales));
    const triangleKey = uv.map((pair) => pair.map((value) => round(value, 8)).join(",")).sort().join("|");
    uvTriangleKeys.set(triangleKey, (uvTriangleKeys.get(triangleKey) || 0) + 1);
  }
  return {
    present: true,
    accessor: uvAccessor,
    uv1Present: false,
    tangentPresent: false,
    derivativeTangentBasis: true,
    metersPerRepeatMedian: round(median(edgeMetersPerUvSamples), 9),
    metersPerRepeatP95: round(percentile(edgeMetersPerUvSamples, 0.95), 9),
    maximumAnisotropicStretch: round(Math.max(1, ...triangleStretch), 9),
    p95AnisotropicStretch: round(percentile(triangleStretch, 0.95), 9),
    uvDegenerateTriangleCount,
    worldDegenerateTriangleCount,
    duplicateUvTriangleCount: [...uvTriangleKeys.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0),
    signedUvOrientation: { positiveTriangles: positiveUvOrientationCount, negativeTriangles: negativeUvOrientationCount },
    edgeMetersPerUvSamples: edgeMetersPerUvSamples.map((value) => round(value, 9)),
    presentationUvMutation: "none"
  };
}

function decodeAccessor({ json, binary }, accessorIndex) {
  assert(Number.isInteger(accessorIndex), `invalid accessor ${accessorIndex}`);
  const accessor = json.accessors[accessorIndex];
  const view = json.bufferViews[accessor.bufferView];
  const componentCount = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 }[accessor.type];
  const component = {
    5120: [1, "getInt8"], 5121: [1, "getUint8"], 5122: [2, "getInt16"],
    5123: [2, "getUint16"], 5125: [4, "getUint32"], 5126: [4, "getFloat32"]
  }[accessor.componentType];
  assert(componentCount && component, `unsupported accessor ${accessorIndex}`);
  const [componentBytes, getter] = component;
  const packedStride = componentCount * componentBytes;
  const stride = view.byteStride || packedStride;
  const start = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const dataView = new DataView(binary.buffer, binary.byteOffset, binary.byteLength);
  const values = [];
  for (let item = 0; item < accessor.count; item += 1) {
    const row = [];
    for (let componentIndex = 0; componentIndex < componentCount; componentIndex += 1) {
      row.push(dataView[getter](start + item * stride + componentIndex * componentBytes, true));
    }
    values.push(row);
  }
  return values;
}

function buildEmbeddedImageRecords(source) {
  return (source.json.images || []).map((image, imageIndex) => {
    const view = source.json.bufferViews[image.bufferView];
    const payload = source.binary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
    const dimensions = imageDimensions(payload, image.mimeType);
    const textureIndices = (source.json.textures || []).flatMap((texture, textureIndex) => texture.source === imageIndex ? [textureIndex] : []);
    const materialIndices = (source.json.materials || []).flatMap((material, materialIndex) => {
      const textureIndex = material.pbrMetallicRoughness?.baseColorTexture?.index;
      return textureIndices.includes(textureIndex) ? [materialIndex] : [];
    });
    return {
      imageIndex,
      bufferView: image.bufferView,
      mimeType: image.mimeType,
      byteLength: payload.byteLength,
      sha256: sha256(payload),
      dimensions,
      channels: "RGB 8-bit",
      colorSpaceRole: "sRGB base-color/diffuse",
      textureIndices,
      materialIndices,
      externalResource: false
    };
  });
}

function imageDimensions(payload, mimeType) {
  if (mimeType === "image/png") {
    const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (mimeType === "image/jpeg") {
    let offset = 2;
    while (offset + 9 < payload.length) {
      if (payload[offset] !== 0xff) { offset += 1; continue; }
      const marker = payload[offset + 1];
      const length = (payload[offset + 2] << 8) | payload[offset + 3];
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { height: (payload[offset + 5] << 8) | payload[offset + 6], width: (payload[offset + 7] << 8) | payload[offset + 8] };
      }
      offset += 2 + length;
    }
  }
  throw new Error(`unsupported embedded image dimensions for ${mimeType}`);
}

function compareStableRecords(left, right) {
  const leftTuple = [left.sceneIndex, ...left.nodeIndexPath, left.meshIndex, left.primitiveIndex];
  const rightTuple = [right.sceneIndex, ...right.nodeIndexPath, right.meshIndex, right.primitiveIndex];
  const length = Math.max(leftTuple.length, rightTuple.length);
  for (let index = 0; index < length; index += 1) {
    if (leftTuple[index] == null) return -1;
    if (rightTuple[index] == null) return 1;
    if (leftTuple[index] !== rightTuple[index]) return leftTuple[index] - rightTuple[index];
  }
  return 0;
}

function countBy(items, getter) {
  return items.reduce((counts, item) => {
    const key = getter(item);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function canonicalSerialize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalSerialize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalSerialize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function percentile(values, fraction) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))];
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function transformPoint(matrix, point) {
  const [x, y, z] = point;
  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]
  ];
}

function sub2(a, b) {
  return [a[0] - b[0], a[1] - b[1]];
}

function cross2(a, b) {
  return a[0] * b[1] - a[1] * b[0];
}

function distance2(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function distance3(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
function triangleArea3(a, b, c) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  return Math.hypot(
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0]
  ) / 2;
}

function round(value, places) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
