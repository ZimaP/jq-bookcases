const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

const COMPONENTS = Object.freeze({
  5120: { bytes: 1, getter: "getInt8" },
  5121: { bytes: 1, getter: "getUint8" },
  5122: { bytes: 2, getter: "getInt16" },
  5123: { bytes: 2, getter: "getUint16" },
  5125: { bytes: 4, getter: "getUint32" },
  5126: { bytes: 4, getter: "getFloat32" }
});

const TYPE_COMPONENTS = Object.freeze({
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16
});

export function parseGlb(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);
  if (bytes.byteLength < 20) throw new Error("The GLB container is too short.");
  if (view.getUint32(0, true) !== GLB_MAGIC) throw new Error("The asset is not a GLB container.");
  const version = view.getUint32(4, true);
  const declaredLength = view.getUint32(8, true);
  if (version !== 2) throw new Error(`Unsupported GLB version ${version}.`);
  if (declaredLength !== bytes.byteLength) {
    throw new Error(`GLB length mismatch: header ${declaredLength}, response ${bytes.byteLength}.`);
  }

  const chunks = [];
  let json;
  let binary;
  let offset = 12;
  while (offset < bytes.byteLength) {
    if (offset + 8 > bytes.byteLength) throw new Error("The GLB chunk header is truncated.");
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const start = offset + 8;
    const end = start + length;
    if (end > bytes.byteLength) throw new Error("A GLB chunk extends beyond the container.");
    chunks.push({ type: chunkTypeName(type), length, byteOffset: start });
    if (type === JSON_CHUNK) {
      const text = new TextDecoder().decode(bytes.subarray(start, end)).replace(/[\u0000\u0020]+$/u, "");
      json = JSON.parse(text);
    } else if (type === BIN_CHUNK) {
      binary = bytes.subarray(start, end);
    }
    offset = end;
  }

  if (!json) throw new Error("The GLB has no JSON chunk.");
  if (!binary && (json.buffers || []).some((buffer) => !buffer.uri)) {
    throw new Error("The GLB has no binary chunk for its embedded buffer.");
  }

  return { bytes, json, binary, version, declaredLength, chunks };
}

export async function createGlbProof(arrayBuffer) {
  const parsed = parseGlb(arrayBuffer);
  const inventory = await createInventory(parsed);
  const geometryContract = createGeometryContract(inventory);
  const fingerprint = await sha256Hex(new TextEncoder().encode(canonicalStringify(geometryContract)));
  return {
    sourceSha256: await sha256Hex(parsed.bytes),
    geometryFingerprint: fingerprint,
    inventory,
    geometryContract
  };
}

export async function createInventory(parsed) {
  const { json, bytes, binary, chunks, version, declaredLength } = parsed;
  const nodes = json.nodes || [];
  const meshes = json.meshes || [];
  const accessors = json.accessors || [];
  const worldMatrices = calculateWorldMatrices(json);
  const reachable = reachableNodeSet(json);
  const accessorInventory = [];

  for (let index = 0; index < accessors.length; index += 1) {
    const accessor = accessors[index];
    const data = accessorDataBytes(json, binary, index);
    accessorInventory.push({
      index,
      name: accessor.name || null,
      bufferView: accessor.bufferView ?? null,
      byteOffset: accessor.byteOffset || 0,
      componentType: accessor.componentType,
      normalized: Boolean(accessor.normalized),
      count: accessor.count,
      type: accessor.type,
      min: accessor.min || null,
      max: accessor.max || null,
      sparse: accessor.sparse || null,
      dataSha256: await sha256Hex(data)
    });
  }

  let vertexCount = 0;
  let triangleCount = 0;
  let primitiveCount = 0;
  const meshInventory = meshes.map((mesh, meshIndex) => ({
    index: meshIndex,
    name: mesh.name || null,
    primitives: (mesh.primitives || []).map((primitive, primitiveIndex) => {
      primitiveCount += 1;
      const positionAccessor = primitive.attributes?.POSITION;
      const vertexAccessor = accessors[positionAccessor];
      const elementCount = primitive.indices == null
        ? vertexAccessor?.count || 0
        : accessors[primitive.indices]?.count || 0;
      const mode = primitive.mode ?? 4;
      vertexCount += vertexAccessor?.count || 0;
      triangleCount += triangleCountForMode(mode, elementCount);
      return {
        index: primitiveIndex,
        mode,
        material: primitive.material ?? null,
        indices: primitive.indices ?? null,
        attributes: sortObject(primitive.attributes || {}),
        targets: primitive.targets || null,
        extensions: primitive.extensions || null,
        extras: primitive.extras || null
      };
    }),
    weights: mesh.weights || null,
    extras: mesh.extras || null
  }));

  const nodeInventory = nodes.map((node, index) => {
    const localMatrix = nodeLocalMatrix(node);
    const worldMatrix = worldMatrices[index] || localMatrix;
    const bounds = node.mesh == null ? null : calculateMeshWorldBounds(json, binary, node.mesh, worldMatrix);
    return {
      index,
      name: node.name || null,
      mesh: node.mesh ?? null,
      camera: node.camera ?? null,
      skin: node.skin ?? null,
      children: node.children || [],
      authoredTransform: node.matrix
        ? { matrix: node.matrix }
        : {
            translation: node.translation || [0, 0, 0],
            rotation: node.rotation || [0, 0, 0, 1],
            scale: node.scale || [1, 1, 1]
          },
      localMatrix,
      worldMatrix,
      visible: node.extras?.visible ?? true,
      reachableFromScene: reachable.has(index),
      worldBounds: bounds,
      extensions: node.extensions || null,
      extras: node.extras || null
    };
  });

  const worldBounds = mergeBounds(
    nodeInventory
      .filter((node) => node.reachableFromScene && node.visible && node.worldBounds)
      .map((node) => node.worldBounds)
  );
  const externalUris = [
    ...(json.buffers || []).map((buffer) => buffer.uri),
    ...(json.images || []).map((image) => image.uri)
  ].filter(Boolean);

  return {
    container: {
      magic: "glTF",
      version,
      declaredLength,
      byteLength: bytes.byteLength,
      chunks
    },
    asset: json.asset || {},
    defaultScene: json.scene ?? 0,
    scenes: (json.scenes || []).map((scene, index) => ({
      index,
      name: scene.name || null,
      nodes: scene.nodes || [],
      extensions: scene.extensions || null,
      extras: scene.extras || null
    })),
    counts: {
      scenes: (json.scenes || []).length,
      nodes: nodes.length,
      meshes: meshes.length,
      primitives: primitiveCount,
      accessors: accessors.length,
      vertices: vertexCount,
      triangles: triangleCount,
      materials: (json.materials || []).length,
      textures: (json.textures || []).length,
      images: (json.images || []).length,
      samplers: (json.samplers || []).length,
      animations: (json.animations || []).length,
      cameras: (json.cameras || []).length,
      skins: (json.skins || []).length,
      lights: json.extensions?.KHR_lights_punctual?.lights?.length || 0
    },
    worldBounds,
    extensionsUsed: json.extensionsUsed || [],
    extensionsRequired: json.extensionsRequired || [],
    externalUris,
    missingResources: [],
    compression: {
      draco: Boolean((json.extensionsUsed || []).includes("KHR_draco_mesh_compression")),
      meshopt: Boolean((json.extensionsUsed || []).includes("EXT_meshopt_compression"))
    },
    nodes: nodeInventory,
    meshes: meshInventory,
    accessors: accessorInventory,
    materials: (json.materials || []).map((material, index) => ({ index, ...material })),
    textures: (json.textures || []).map((texture, index) => ({ index, ...texture })),
    images: (json.images || []).map((image, index) => ({ index, ...image })),
    samplers: (json.samplers || []).map((sampler, index) => ({ index, ...sampler })),
    animations: (json.animations || []).map((animation, index) => ({ index, ...animation })),
    cameras: (json.cameras || []).map((camera, index) => ({ index, ...camera })),
    skins: (json.skins || []).map((skin, index) => ({ index, ...skin }))
  };
}

export function canonicalStringify(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function sha256Hex(bytes) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function createGeometryContract(inventory) {
  return {
    scenes: inventory.scenes,
    nodes: inventory.nodes.map((node) => ({
      index: node.index,
      name: node.name,
      mesh: node.mesh,
      camera: node.camera,
      skin: node.skin,
      children: node.children,
      authoredTransform: node.authoredTransform,
      localMatrix: node.localMatrix,
      worldMatrix: node.worldMatrix,
      visible: node.visible,
      reachableFromScene: node.reachableFromScene,
      worldBounds: node.worldBounds
    })),
    meshes: inventory.meshes,
    accessors: inventory.accessors.map((accessor) => ({
      index: accessor.index,
      bufferView: accessor.bufferView,
      byteOffset: accessor.byteOffset,
      componentType: accessor.componentType,
      normalized: accessor.normalized,
      count: accessor.count,
      type: accessor.type,
      min: accessor.min,
      max: accessor.max,
      sparse: accessor.sparse,
      dataSha256: accessor.dataSha256
    })),
    worldBounds: inventory.worldBounds,
    materials: inventory.meshes.flatMap((mesh) => mesh.primitives.map((primitive) => ({
      mesh: mesh.index,
      primitive: primitive.index,
      material: primitive.material
    })))
  };
}

function accessorDataBytes(json, binary, accessorIndex) {
  const accessor = json.accessors?.[accessorIndex];
  if (!accessor) throw new Error(`Missing accessor ${accessorIndex}.`);
  if (accessor.sparse) throw new Error(`Sparse accessor ${accessorIndex} is not supported by this proof parser.`);
  if (accessor.bufferView == null) {
    const component = COMPONENTS[accessor.componentType];
    const components = TYPE_COMPONENTS[accessor.type];
    if (!component || !components) throw new Error(`Unsupported accessor ${accessorIndex}.`);
    return new Uint8Array(accessor.count * component.bytes * components);
  }
  const bufferView = json.bufferViews?.[accessor.bufferView];
  if (!bufferView) throw new Error(`Missing bufferView ${accessor.bufferView}.`);
  if (bufferView.buffer !== 0) throw new Error(`Accessor ${accessorIndex} references a non-GLB buffer.`);
  const component = COMPONENTS[accessor.componentType];
  const components = TYPE_COMPONENTS[accessor.type];
  if (!component || !components) throw new Error(`Unsupported accessor ${accessorIndex}.`);
  const elementBytes = component.bytes * components;
  const stride = bufferView.byteStride || elementBytes;
  const start = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
  const packed = new Uint8Array(accessor.count * elementBytes);
  for (let index = 0; index < accessor.count; index += 1) {
    const sourceStart = start + index * stride;
    const sourceEnd = sourceStart + elementBytes;
    if (sourceEnd > binary.byteLength) throw new Error(`Accessor ${accessorIndex} exceeds the binary chunk.`);
    packed.set(binary.subarray(sourceStart, sourceEnd), index * elementBytes);
  }
  return packed;
}

function readAccessorValues(json, binary, accessorIndex) {
  const accessor = json.accessors?.[accessorIndex];
  const component = COMPONENTS[accessor?.componentType];
  const components = TYPE_COMPONENTS[accessor?.type];
  if (!accessor || !component || !components) throw new Error(`Unsupported accessor ${accessorIndex}.`);
  const data = accessorDataBytes(json, binary, accessorIndex);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const values = [];
  for (let item = 0; item < accessor.count; item += 1) {
    const row = [];
    for (let part = 0; part < components; part += 1) {
      const byteOffset = (item * components + part) * component.bytes;
      row.push(view[component.getter](byteOffset, true));
    }
    values.push(row);
  }
  return values;
}

function calculateMeshWorldBounds(json, binary, meshIndex, worldMatrix) {
  const bounds = [];
  for (const primitive of json.meshes?.[meshIndex]?.primitives || []) {
    const accessorIndex = primitive.attributes?.POSITION;
    if (accessorIndex == null) continue;
    const points = readAccessorValues(json, binary, accessorIndex);
    const transformed = points.map((point) => transformPoint(worldMatrix, point));
    bounds.push(boundsFromPoints(transformed));
  }
  return mergeBounds(bounds);
}

function calculateWorldMatrices(json) {
  const nodes = json.nodes || [];
  const matrices = Array(nodes.length).fill(null);
  const walk = (index, parentMatrix) => {
    const local = nodeLocalMatrix(nodes[index] || {});
    const world = parentMatrix ? multiplyMatrices(parentMatrix, local) : local;
    matrices[index] = world;
    for (const child of nodes[index]?.children || []) walk(child, world);
  };
  for (const scene of json.scenes || []) {
    for (const root of scene.nodes || []) walk(root, null);
  }
  nodes.forEach((node, index) => {
    if (!matrices[index]) walk(index, null);
  });
  return matrices;
}

function reachableNodeSet(json) {
  const reached = new Set();
  const walk = (index) => {
    if (reached.has(index)) return;
    reached.add(index);
    for (const child of json.nodes?.[index]?.children || []) walk(child);
  };
  for (const scene of json.scenes || []) for (const root of scene.nodes || []) walk(root);
  return reached;
}

function nodeLocalMatrix(node) {
  if (node.matrix) return [...node.matrix];
  const [x, y, z, w] = node.rotation || [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale || [1, 1, 1];
  const [tx, ty, tz] = node.translation || [0, 0, 0];
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    tx, ty, tz, 1
  ];
}

function multiplyMatrices(left, right) {
  const result = Array(16).fill(0);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      for (let index = 0; index < 4; index += 1) {
        result[column * 4 + row] += left[index * 4 + row] * right[column * 4 + index];
      }
    }
  }
  return result;
}

function transformPoint(matrix, point) {
  const [x, y, z] = point;
  const denominator = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
  const w = denominator || 1;
  return [
    (matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]) / w,
    (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]) / w,
    (matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]) / w
  ];
}

function boundsFromPoints(points) {
  if (!points.length) return null;
  const min = [...points[0]];
  const max = [...points[0]];
  for (const point of points.slice(1)) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], point[axis]);
      max[axis] = Math.max(max[axis], point[axis]);
    }
  }
  return boundsRecord(min, max);
}

function mergeBounds(boundsList) {
  const valid = boundsList.filter(Boolean);
  if (!valid.length) return null;
  const min = [...valid[0].min];
  const max = [...valid[0].max];
  for (const bounds of valid.slice(1)) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], bounds.min[axis]);
      max[axis] = Math.max(max[axis], bounds.max[axis]);
    }
  }
  return boundsRecord(min, max);
}

function boundsRecord(min, max) {
  const size = max.map((value, axis) => value - min[axis]);
  const center = max.map((value, axis) => (value + min[axis]) / 2);
  return {
    min,
    max,
    size,
    center,
    diagonal: Math.hypot(...size)
  };
}

function triangleCountForMode(mode, elementCount) {
  if (mode === 4) return Math.floor(elementCount / 3);
  if (mode === 5 || mode === 6) return Math.max(0, elementCount - 2);
  return 0;
}

function sortObject(value) {
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
}

function chunkTypeName(type) {
  if (type === JSON_CHUNK) return "JSON";
  if (type === BIN_CHUNK) return "BIN";
  return `0x${type.toString(16).padStart(8, "0")}`;
}
