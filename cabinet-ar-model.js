import { hashCabinetArConfiguration, inchesToMeters } from "./cabinet-ar.js?v=configurator-refine-20260714a";
import { getHardwareFinish, getHardwareFinishOption } from "./bookcase-config.js?v=configurator-refine-20260714a";

const NON_RENDERED_ROLES = new Set(["assembly", "section", "section_group", "opening", "light"]);
const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
const JSON_CHUNK_TYPE = 0x4e4f534a;
const BIN_CHUNK_TYPE = 0x004e4942;

export async function generateProceduralCabinetModel(configuration, context = {}) {
  throwIfGenerationAborted(context.signal);
  const posterUrl = context.posterUrl || null;
  const arrayBuffer = generateCabinetGlbArrayBuffer(configuration, context.layout);
  const blob = new Blob([arrayBuffer], { type: "model/gltf-binary" });
  const glbUrl = URL.createObjectURL(blob);
  try {
    throwIfGenerationAborted(context.signal);
    return { glbUrl, usdzUrl: null, posterUrl };
  } catch (error) {
    try {
      URL.revokeObjectURL(glbUrl);
    } catch {
      // Preserve the abort reason if object URL cleanup is unavailable.
    }
    throw error;
  }
}

export function generateCabinetGlbArrayBuffer(configuration, layout) {
  if (!layout?.validation?.valid) throw new RangeError("A valid cabinet layout is required to generate a GLB.");
  const materialDefinitions = createMaterialDefinitions(configuration);
  const groups = new Map(materialDefinitions.map((material, index) => [material.name, createGeometryGroup(index)]));
  const cabinetDepth = configuration.depthMeters;

  (layout.components || []).forEach((component) => {
    if (!component?.bounds || NON_RENDERED_ROLES.has(component.role)) return;
    const size = [
      inchesToMeters(component.size.x),
      inchesToMeters(component.size.y),
      inchesToMeters(component.size.z)
    ];
    if (size.some((value) => !Number.isFinite(value) || value <= 0)) return;
    const center = [
      coordinateInchesToMeters(component.position.x),
      coordinateInchesToMeters(component.position.y),
      cabinetDepth / 2 - coordinateInchesToMeters(component.position.z)
    ];
    if (component.role === "door" || component.role === "drawer_front") {
      createArFrontProfileParts(component, center, size).forEach((part) => {
        appendBox(groups.get(part.material) || groups.get("finish"), part.center, part.size);
      });
      return;
    }
    const materialName = materialNameForComponent(component);
    appendBox(groups.get(materialName) || groups.get("finish"), center, size);
  });

  const gltf = {
    asset: { version: "2.0", generator: "JQ Bookcases procedural AR MVP" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: "JQ configured cabinet", mesh: 0 }],
    meshes: [{ name: "Configured cabinet", primitives: [] }],
    materials: materialDefinitions.map((material) => ({
      name: material.name,
      pbrMetallicRoughness: {
        baseColorFactor: material.color,
        metallicFactor: material.metallic,
        roughnessFactor: material.roughness
      },
      ...(material.alpha < 1 ? { alphaMode: "BLEND", doubleSided: true } : {})
    })),
    buffers: [{ byteLength: 0 }],
    bufferViews: [],
    accessors: [],
    extras: {
      configurationHash: hashCabinetArConfiguration(configuration),
      units: "meters",
      nominalDimensions: [configuration.widthMeters, configuration.heightMeters, configuration.depthMeters],
      frontProfiles: {
        door: configuration.doorStyleId,
        drawer: configuration.drawerFrontStyleId
      },
      hardwareVariant: configuration.hardwareId
    }
  };

  const binaryParts = [];
  let binaryByteLength = 0;
  groups.forEach((group) => {
    if (!group.indices.length) return;
    const positionArray = new Float32Array(group.positions);
    const normalArray = new Float32Array(group.normals);
    const IndexArray = group.positions.length / 3 > 65535 ? Uint32Array : Uint16Array;
    const indexArray = new IndexArray(group.indices);
    const positionView = appendBinaryView(gltf, binaryParts, positionArray, 34962, binaryByteLength);
    binaryByteLength = positionView.nextOffset;
    const normalView = appendBinaryView(gltf, binaryParts, normalArray, 34962, binaryByteLength);
    binaryByteLength = normalView.nextOffset;
    const indexView = appendBinaryView(gltf, binaryParts, indexArray, 34963, binaryByteLength);
    binaryByteLength = indexView.nextOffset;

    const positionAccessor = gltf.accessors.push({
      bufferView: positionView.index,
      componentType: 5126,
      count: positionArray.length / 3,
      type: "VEC3",
      min: group.minimum,
      max: group.maximum
    }) - 1;
    const normalAccessor = gltf.accessors.push({
      bufferView: normalView.index,
      componentType: 5126,
      count: normalArray.length / 3,
      type: "VEC3"
    }) - 1;
    const indexAccessor = gltf.accessors.push({
      bufferView: indexView.index,
      componentType: IndexArray === Uint32Array ? 5125 : 5123,
      count: indexArray.length,
      type: "SCALAR",
      min: [0],
      max: [Math.max(...group.indices)]
    }) - 1;
    gltf.meshes[0].primitives.push({
      attributes: { POSITION: positionAccessor, NORMAL: normalAccessor },
      indices: indexAccessor,
      material: group.materialIndex,
      mode: 4
    });
  });

  if (!gltf.meshes[0].primitives.length) throw new Error("The cabinet layout did not contain exportable geometry.");
  const binaryChunk = combineBinaryParts(binaryParts, binaryByteLength);
  gltf.buffers[0].byteLength = binaryChunk.byteLength;
  return createGlb(gltf, binaryChunk);
}

function createMaterialDefinitions(configuration) {
  const finishHex = configuration.finishPreviewHex || ({
    white_dove: "#eee9dc",
    chantilly_lace: "#f7f5ee",
    simply_white: "#f5f0e4",
    cloud_white: "#eee8dc",
    silver_satin: "#d8d7d2"
  }[configuration.finishId] || "#d3c8b8");
  const finish = hexToLinearColor(finishHex);
  const hardwareFinish = getHardwareFinish(configuration.hardwareId);
  const hardwareMetadata = getHardwareFinishOption(hardwareFinish) || getHardwareFinishOption("brass");
  const hardware = hexToLinearColor(numberToHex(hardwareMetadata.materialColor));
  return [
    { name: "finish", color: finish, metallic: 0, roughness: 0.68, alpha: 1 },
    { name: "back", color: darken(finish, 0.9), metallic: 0, roughness: 0.8, alpha: 1 },
    { name: "hardware", color: hardware, metallic: hardwareMetadata.metalness, roughness: hardwareMetadata.roughness, alpha: 1 },
    { name: "shadow", color: [0.021, 0.016, 0.012, 1], metallic: 0, roughness: 0.92, alpha: 1 },
    { name: "glass", color: [0.78, 0.86, 0.9, 0.2], metallic: 0, roughness: 0.12, alpha: 0.2 }
  ];
}

export function createArFrontProfileParts(component, center, size) {
  const [width, height, depth] = size.map(Number);
  if (
    ![width, height, depth].every((value) => Number.isFinite(value) && value > 0)
    || !Array.isArray(center)
    || center.length !== 3
    || center.some((value) => !Number.isFinite(Number(value)))
  ) return [];

  const [x, y, z] = center.map(Number);
  const style = getArFrontStyle(component);
  if (style === "flat") {
    return [{ kind: "slab", material: "finish", center: [x, y, z], size: [width, height, depth] }];
  }

  const minimumSpan = Math.min(width, height);
  const rail = clamp(
    minimumSpan * (style === "slim_shaker" ? 0.065 : 0.095),
    minimumSpan * 0.035,
    Math.min(width * 0.22, height * 0.22)
  );
  const backingDepth = depth * 0.46;
  const faceDepth = depth - backingDepth;
  const backZ = z - depth / 2 + backingDepth / 2;
  const faceZ = z + depth / 2 - faceDepth / 2;
  const centerWidth = Math.max(width - rail * 2, width * 0.5);
  const centerHeight = Math.max(height - rail * 2, height * 0.5);
  const parts = [
    {
      kind: "backing",
      material: style === "glass" ? "glass" : "finish",
      center: [x, y, backZ],
      size: [width, height, backingDepth]
    },
    {
      kind: "top_rail",
      material: "finish",
      center: [x, y + height / 2 - rail / 2, faceZ],
      size: [width, rail, faceDepth]
    },
    {
      kind: "bottom_rail",
      material: "finish",
      center: [x, y - height / 2 + rail / 2, faceZ],
      size: [width, rail, faceDepth]
    },
    {
      kind: "left_stile",
      material: "finish",
      center: [x - width / 2 + rail / 2, y, faceZ],
      size: [rail, centerHeight, faceDepth]
    },
    {
      kind: "right_stile",
      material: "finish",
      center: [x + width / 2 - rail / 2, y, faceZ],
      size: [rail, centerHeight, faceDepth]
    }
  ];

  if (style !== "glass") {
    const panelDepth = Math.min(faceDepth * 0.48, depth * 0.28);
    parts.push({
      kind: "inset_panel",
      material: "finish",
      center: [x, y, z + depth / 2 - faceDepth + panelDepth / 2],
      size: [centerWidth, centerHeight, panelDepth]
    });
  }
  return parts;
}

function getArFrontStyle(component) {
  const requested = component?.metadata?.style;
  if (component?.role === "drawer_front") {
    return ["shaker", "flat", "slim_shaker"].includes(requested) ? requested : "shaker";
  }
  return ["shaker", "flat", "slim_shaker", "glass"].includes(requested) ? requested : "flat";
}

function materialNameForComponent(component) {
  if (component.role === "handle") return "hardware";
  if (component.role === "back_panel") return "back";
  if (component.metadata?.purpose === "recess") return "shadow";
  if (component.metadata?.style === "glass" || component.metadata?.material === "glass") return "glass";
  return "finish";
}

function throwIfGenerationAborted(signal) {
  if (!signal?.aborted) return;
  if (typeof signal.throwIfAborted === "function") signal.throwIfAborted();
  if (signal.reason instanceof Error) throw signal.reason;
  if (typeof DOMException === "function") throw new DOMException("The operation was aborted.", "AbortError");
  const error = new Error("The operation was aborted.");
  error.name = "AbortError";
  throw error;
}

function createGeometryGroup(materialIndex) {
  return {
    materialIndex,
    positions: [],
    normals: [],
    indices: [],
    minimum: [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
    maximum: [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY]
  };
}

function appendBox(group, center, size) {
  const half = size.map((value) => value / 2);
  const [cx, cy, cz] = center;
  const [hx, hy, hz] = half;
  const faces = [
    { normal: [0, 0, 1], vertices: [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]] },
    { normal: [0, 0, -1], vertices: [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]] },
    { normal: [1, 0, 0], vertices: [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]] },
    { normal: [-1, 0, 0], vertices: [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]] },
    { normal: [0, 1, 0], vertices: [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]] },
    { normal: [0, -1, 0], vertices: [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]] }
  ];
  faces.forEach((face) => {
    const baseIndex = group.positions.length / 3;
    face.vertices.forEach(([x, y, z]) => {
      const position = [cx + x, cy + y, cz + z];
      group.positions.push(...position);
      group.normals.push(...face.normal);
      position.forEach((value, axis) => {
        group.minimum[axis] = Math.min(group.minimum[axis], value);
        group.maximum[axis] = Math.max(group.maximum[axis], value);
      });
    });
    group.indices.push(baseIndex, baseIndex + 1, baseIndex + 2, baseIndex, baseIndex + 2, baseIndex + 3);
  });
}

function appendBinaryView(gltf, binaryParts, typedArray, target, currentOffset) {
  const padding = (4 - (currentOffset % 4)) % 4;
  if (padding) binaryParts.push(new Uint8Array(padding));
  const byteOffset = currentOffset + padding;
  const bytes = new Uint8Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
  binaryParts.push(bytes);
  const index = gltf.bufferViews.push({ buffer: 0, byteOffset, byteLength: bytes.byteLength, target }) - 1;
  return { index, nextOffset: byteOffset + bytes.byteLength };
}

function combineBinaryParts(parts, byteLength) {
  const paddedLength = byteLength + ((4 - (byteLength % 4)) % 4);
  const combined = new Uint8Array(paddedLength);
  let offset = 0;
  parts.forEach((part) => {
    combined.set(part, offset);
    offset += part.byteLength;
  });
  return combined;
}

function createGlb(gltf, binaryChunk) {
  const encodedJson = new TextEncoder().encode(JSON.stringify(gltf));
  const jsonLength = encodedJson.byteLength + ((4 - (encodedJson.byteLength % 4)) % 4);
  const totalLength = 12 + 8 + jsonLength + 8 + binaryChunk.byteLength;
  const result = new ArrayBuffer(totalLength);
  const view = new DataView(result);
  const bytes = new Uint8Array(result);
  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, GLB_VERSION, true);
  view.setUint32(8, totalLength, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, JSON_CHUNK_TYPE, true);
  bytes.fill(0x20, 20, 20 + jsonLength);
  bytes.set(encodedJson, 20);
  const binaryHeader = 20 + jsonLength;
  view.setUint32(binaryHeader, binaryChunk.byteLength, true);
  view.setUint32(binaryHeader + 4, BIN_CHUNK_TYPE, true);
  bytes.set(binaryChunk, binaryHeader + 8);
  return result;
}

function hexToLinearColor(value) {
  const match = String(value || "").match(/^#?([0-9a-f]{6})$/i);
  const hex = match ? match[1] : "d3c8b8";
  return [0, 2, 4].map((offset) => srgbToLinear(Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)).concat(1);
}

function numberToHex(value) {
  const numeric = Number(value);
  const safe = Number.isInteger(numeric) && numeric >= 0 && numeric <= 0xffffff ? numeric : 0xb38a4a;
  return `#${safe.toString(16).padStart(6, "0")}`;
}

function srgbToLinear(value) {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function darken(color, amount) {
  return [color[0] * amount, color[1] * amount, color[2] * amount, color[3]];
}

function coordinateInchesToMeters(value) {
  const inches = Number(value);
  if (!Number.isFinite(inches)) throw new RangeError("Cabinet component coordinates must be finite numbers.");
  return inches * 0.0254;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
