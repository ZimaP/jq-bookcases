const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const TEXTURE_SLOTS = Object.freeze([
  "alphaMap", "aoMap", "bumpMap", "clearcoatMap", "clearcoatNormalMap",
  "clearcoatRoughnessMap", "displacementMap", "emissiveMap", "envMap",
  "gradientMap", "iridescenceMap", "iridescenceThicknessMap", "lightMap",
  "map", "matcap", "metalnessMap", "normalMap", "roughnessMap",
  "sheenColorMap", "sheenRoughnessMap", "specularColorMap",
  "specularIntensityMap", "specularMap", "thicknessMap", "transmissionMap"
]);

export function inspectRoom2Glb(arrayBuffer) {
  if (!(arrayBuffer instanceof ArrayBuffer)) throw new TypeError("Room 2 GLB bytes must be one ArrayBuffer.");
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);
  if (bytes.byteLength < 20 || view.getUint32(0, true) !== GLB_MAGIC) {
    throw new Error("The Room 2 asset is not a valid GLB container.");
  }
  if (view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== bytes.byteLength) {
    throw new Error("The Room 2 GLB version or declared byte length differs.");
  }

  let json = null;
  let binary = null;
  let offset = 12;
  while (offset < bytes.byteLength) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const start = offset + 8;
    const end = start + length;
    if (end > bytes.byteLength) throw new Error("A Room 2 GLB chunk is truncated.");
    if (type === JSON_CHUNK) {
      json = JSON.parse(new TextDecoder().decode(bytes.subarray(start, end)).replace(/[\u0000\u0020]+$/u, ""));
    } else if (type === BIN_CHUNK) {
      binary = bytes.subarray(start, end);
    }
    offset = end;
  }
  if (!json) throw new Error("The Room 2 GLB has no JSON chunk.");
  if (!binary) throw new Error("The Room 2 GLB has no embedded binary chunk.");

  const externalUris = [
    ...(json.buffers || []).map((buffer) => buffer.uri),
    ...(json.images || []).map((image) => image.uri)
  ].filter(Boolean);
  if (externalUris.length) throw new Error("The Room 2 GLB references an external resource.");
  if ((json.buffers || []).length !== 1 || json.buffers[0].uri != null) {
    throw new Error("The Room 2 GLB must contain one embedded buffer.");
  }
  if (!(json.images || []).every((image) => Number.isInteger(image.bufferView) && image.uri == null)) {
    throw new Error("Every Room 2 GLB image must be embedded.");
  }

  const metrics = countGeometry(json);
  return Object.freeze({
    json,
    binary,
    externalUris: Object.freeze(externalUris),
    counts: Object.freeze({
      scenes: (json.scenes || []).length,
      nodes: (json.nodes || []).length,
      meshes: (json.meshes || []).length,
      primitives: (json.meshes || []).reduce((sum, mesh) => sum + (mesh.primitives || []).length, 0),
      materials: (json.materials || []).length,
      textures: (json.textures || []).length,
      images: (json.images || []).length,
      accessors: (json.accessors || []).length,
      vertices: metrics.vertices,
      triangles: metrics.triangles,
      animations: (json.animations || []).length,
      cameras: (json.cameras || []).length,
      skins: (json.skins || []).length,
      lights: json.extensions?.KHR_lights_punctual?.lights?.length || 0
    })
  });
}

export async function sha256Bytes(bytes) {
  const source = bytes instanceof ArrayBuffer
    ? bytes
    : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", source);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function createRawMaterialDigest(json) {
  const records = (json.materials || []).map((material, materialIndex) => normalizeRawMaterial(material, materialIndex));
  return sha256Text(canonicalSerialize(records));
}

export async function createEmbeddedImagePayloadSnapshot(inspection) {
  if (!inspection?.json || !(inspection.binary instanceof Uint8Array)) {
    throw new TypeError("A parsed Room 2 GLB inspection is required for embedded image proof.");
  }
  const records = [];
  for (let imageIndex = 0; imageIndex < (inspection.json.images || []).length; imageIndex += 1) {
    const image = inspection.json.images[imageIndex];
    const view = inspection.json.bufferViews?.[image.bufferView];
    if (!view || view.buffer !== 0) throw new Error(`Room 2 image ${imageIndex} does not use the embedded buffer.`);
    const start = view.byteOffset || 0;
    const end = start + view.byteLength;
    if (end > inspection.binary.byteLength) throw new Error(`Room 2 image ${imageIndex} exceeds the embedded buffer.`);
    const payload = inspection.binary.subarray(start, end);
    records.push({
      imageIndex,
      bufferView: image.bufferView,
      mimeType: image.mimeType || null,
      byteLength: payload.byteLength,
      sha256: await sha256Bytes(payload)
    });
  }
  const textureSources = (inspection.json.textures || []).map((texture, textureIndex) => ({
    textureIndex,
    imageIndex: Number.isInteger(texture.source) ? texture.source : null,
    sampler: Number.isInteger(texture.sampler) ? texture.sampler : null
  }));
  const canonical = canonicalSerialize({ records, textureSources });
  return Object.freeze({
    schema: "jq-room2-embedded-image-payload-snapshot-v1",
    imageCount: records.length,
    textureCount: textureSources.length,
    canonical,
    aggregateSha256: await sha256Text(canonical),
    records: deepFreeze(records),
    textureSources: deepFreeze(textureSources)
  });
}

export async function createRuntimeMaterialSnapshot(gltf, json) {
  const canonical = createRuntimeMaterialCanonical(gltf, json);
  const records = JSON.parse(canonical);
  return Object.freeze({
    schema: "jq-room2-public-runtime-material-snapshot-v1",
    threeRevision: String(globalThis.__JQ_THREE_REVISION__ || "166"),
    materialCount: records.length,
    canonical,
    aggregateSha256: await sha256Text(canonical),
    records: deepFreeze(records)
  });
}

export async function createRuntimeMaterialAppearanceSnapshot(gltf, json) {
  const canonical = createRuntimeMaterialAppearanceCanonical(gltf, json);
  const records = JSON.parse(canonical);
  return Object.freeze({
    schema: "jq-room2-public-runtime-material-appearance-snapshot-v2",
    threeRevision: String(globalThis.__JQ_THREE_REVISION__ || "166"),
    materialCount: records.length,
    canonical,
    aggregateSha256: await sha256Text(canonical),
    records: deepFreeze(records)
  });
}

export function createRuntimeMaterialCanonical(gltf, json) {
  return canonicalSerialize(createRuntimeMaterialRecords(gltf, json, runtimeMaterialRecord));
}

export function createRuntimeMaterialAppearanceCanonical(gltf, json) {
  return canonicalSerialize(createRuntimeMaterialRecords(gltf, json, runtimeMaterialAppearanceRecord));
}

function createRuntimeMaterialRecords(gltf, json, recordFactory) {
  if (!(gltf?.parser?.associations instanceof Map)) throw new Error("GLTF parser associations are unavailable.");
  const runtimeByIndex = new Map();
  for (const scene of gltf.scenes || []) {
    scene.traverse((object) => {
      const materials = object.material
        ? Array.isArray(object.material) ? object.material : [object.material]
        : [];
      for (const material of materials) {
        const index = gltf.parser.associations.get(material)?.materials;
        if (Number.isInteger(index) && !runtimeByIndex.has(index)) runtimeByIndex.set(index, material);
      }
    });
  }
  const records = (json.materials || []).map((_, materialIndex) => {
    const material = runtimeByIndex.get(materialIndex);
    if (!material) throw new Error(`Room 2 runtime material ${materialIndex} is unavailable.`);
    return recordFactory(material, materialIndex, gltf.parser);
  });
  return records;
}

export function createDeferredModelSnapshot(gltf) {
  gltf.scene.updateMatrixWorld(true);
  const objects = [];
  let meshCount = 0;
  gltf.scene.traverse((object) => {
    const association = normalizeAssociation(gltf.parser.associations.get(object) || {});
    const materials = object.material
      ? Array.isArray(object.material) ? object.material : [object.material]
      : [];
    if (object.isMesh) meshCount += 1;
    objects.push({
      locator: stableObjectLocator(association, objects.length),
      type: object.type || null,
      name: object.name || "",
      association,
      position: runtimeVector(object.position),
      quaternion: runtimeVector(object.quaternion),
      scale: runtimeVector(object.scale),
      matrix: runtimeMatrix(object.matrix),
      matrixWorld: runtimeMatrix(object.matrixWorld),
      geometry: runtimeGeometryRecord(object.geometry, gltf.parser),
      materialSlots: materials.map((material) => normalizeAssociation(gltf.parser.associations.get(material) || {}))
    });
  });
  const canonical = canonicalSerialize(objects);
  return Object.freeze({
    schema: "jq-room2-public-deferred-model-snapshot-v1",
    nodeCount: objects.length,
    meshCount,
    canonical,
    fingerprint: stableStringHash("room2-runtime-model-v1", canonical)
  });
}

export function canonicalSerialize(value) {
  return JSON.stringify(canonicalNormalize(value));
}

function canonicalNormalize(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return canonicalFinite(value);
  if (Array.isArray(value)) return value.map(canonicalNormalize);
  if (typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalNormalize(value[key])]));
  }
  throw new TypeError(`Unsupported canonical value type: ${typeof value}`);
}

function normalizeRawMaterial(material, materialIndex) {
  const declared = canonicalNormalize(material || {});
  const pbr = declared.pbrMetallicRoughness || {};
  return {
    materialIndex,
    declared,
    resolvedDefaults: {
      name: declared.name ?? "",
      pbrMetallicRoughness: {
        baseColorFactor: pbr.baseColorFactor ?? [1, 1, 1, 1],
        baseColorTexture: normalizeTextureInfo(pbr.baseColorTexture),
        metallicFactor: pbr.metallicFactor ?? 1,
        roughnessFactor: pbr.roughnessFactor ?? 1,
        metallicRoughnessTexture: normalizeTextureInfo(pbr.metallicRoughnessTexture)
      },
      normalTexture: normalizeTextureInfo(declared.normalTexture, { scale: 1 }),
      occlusionTexture: normalizeTextureInfo(declared.occlusionTexture, { strength: 1 }),
      emissiveTexture: normalizeTextureInfo(declared.emissiveTexture),
      emissiveFactor: declared.emissiveFactor ?? [0, 0, 0],
      alphaMode: declared.alphaMode ?? "OPAQUE",
      alphaCutoff: declared.alphaCutoff ?? 0.5,
      doubleSided: declared.doubleSided ?? false,
      extensions: declared.extensions ?? {},
      extras: declared.extras ?? null
    }
  };
}

function countGeometry(json) {
  let vertices = 0;
  let triangles = 0;
  for (const mesh of json.meshes || []) {
    for (const primitive of mesh.primitives || []) {
      const positions = json.accessors?.[primitive.attributes?.POSITION];
      const elementCount = primitive.indices == null
        ? positions?.count || 0
        : json.accessors?.[primitive.indices]?.count || 0;
      const mode = primitive.mode ?? 4;
      vertices += positions?.count || 0;
      if (mode === 4) triangles += Math.floor(elementCount / 3);
      else if (mode === 5 || mode === 6) triangles += Math.max(0, elementCount - 2);
    }
  }
  return { vertices, triangles };
}

function runtimeMaterialRecord(material, materialIndex, parser) {
  const textures = {};
  for (const slot of TEXTURE_SLOTS) textures[slot] = runtimeTextureRecord(material[slot], parser);
  return {
    materialIndex,
    type: material.type ?? null,
    name: material.name ?? "",
    color: runtimeColor(material.color),
    emissive: runtimeColor(material.emissive),
    specular: runtimeColor(material.specular),
    specularColor: runtimeColor(material.specularColor),
    attenuationColor: runtimeColor(material.attenuationColor),
    sheenColor: runtimeColor(material.sheenColor),
    metalness: finiteField(material, "metalness"),
    roughness: finiteField(material, "roughness"),
    opacity: finiteField(material, "opacity"),
    transparent: booleanField(material, "transparent"),
    alphaTest: finiteField(material, "alphaTest"),
    alphaHash: booleanField(material, "alphaHash"),
    side: finiteField(material, "side"),
    shadowSide: finiteField(material, "shadowSide"),
    depthTest: booleanField(material, "depthTest"),
    depthWrite: booleanField(material, "depthWrite"),
    colorWrite: booleanField(material, "colorWrite"),
    blending: finiteField(material, "blending"),
    blendSrc: finiteField(material, "blendSrc"),
    blendDst: finiteField(material, "blendDst"),
    blendEquation: finiteField(material, "blendEquation"),
    blendSrcAlpha: finiteField(material, "blendSrcAlpha"),
    blendDstAlpha: finiteField(material, "blendDstAlpha"),
    blendEquationAlpha: finiteField(material, "blendEquationAlpha"),
    premultipliedAlpha: booleanField(material, "premultipliedAlpha"),
    dithering: booleanField(material, "dithering"),
    toneMapped: booleanField(material, "toneMapped"),
    fog: booleanField(material, "fog"),
    wireframe: booleanField(material, "wireframe"),
    flatShading: booleanField(material, "flatShading"),
    vertexColors: booleanField(material, "vertexColors"),
    transmission: finiteField(material, "transmission"),
    thickness: finiteField(material, "thickness"),
    ior: finiteField(material, "ior"),
    clearcoat: finiteField(material, "clearcoat"),
    clearcoatRoughness: finiteField(material, "clearcoatRoughness"),
    specularIntensity: finiteField(material, "specularIntensity"),
    sheen: finiteField(material, "sheen"),
    sheenRoughness: finiteField(material, "sheenRoughness"),
    iridescence: finiteField(material, "iridescence"),
    iridescenceIOR: finiteField(material, "iridescenceIOR"),
    attenuationDistance: finiteField(material, "attenuationDistance"),
    normalScale: runtimeVector(material.normalScale),
    clearcoatNormalScale: runtimeVector(material.clearcoatNormalScale),
    textures
  };
}

function runtimeMaterialAppearanceRecord(material, materialIndex, parser) {
  return {
    ...runtimeMaterialRecord(material, materialIndex, parser),
    precision: material.precision ?? null,
    blendColor: runtimeColor(material.blendColor),
    blendAlpha: finiteField(material, "blendAlpha"),
    alphaToCoverage: booleanField(material, "alphaToCoverage"),
    depthFunc: finiteField(material, "depthFunc"),
    clippingPlanes: Array.isArray(material.clippingPlanes)
      ? material.clippingPlanes.map((plane) => ({ normal: runtimeVector(plane.normal), constant: canonicalFinite(plane.constant) }))
      : null,
    clipIntersection: booleanField(material, "clipIntersection"),
    clipShadows: booleanField(material, "clipShadows"),
    polygonOffset: booleanField(material, "polygonOffset"),
    polygonOffsetFactor: finiteField(material, "polygonOffsetFactor"),
    polygonOffsetUnits: finiteField(material, "polygonOffsetUnits"),
    stencilWrite: booleanField(material, "stencilWrite"),
    stencilWriteMask: finiteField(material, "stencilWriteMask"),
    stencilFunc: finiteField(material, "stencilFunc"),
    stencilRef: finiteField(material, "stencilRef"),
    stencilFuncMask: finiteField(material, "stencilFuncMask"),
    stencilFail: finiteField(material, "stencilFail"),
    stencilZFail: finiteField(material, "stencilZFail"),
    stencilZPass: finiteField(material, "stencilZPass"),
    visible: booleanField(material, "visible"),
    forceSinglePass: booleanField(material, "forceSinglePass"),
    lightMapIntensity: finiteField(material, "lightMapIntensity"),
    aoMapIntensity: finiteField(material, "aoMapIntensity"),
    emissiveIntensity: finiteField(material, "emissiveIntensity"),
    bumpScale: finiteField(material, "bumpScale"),
    normalMapType: finiteField(material, "normalMapType"),
    displacementScale: finiteField(material, "displacementScale"),
    displacementBias: finiteField(material, "displacementBias"),
    envMapIntensity: finiteField(material, "envMapIntensity"),
    envMapRotation: runtimeEuler(material.envMapRotation),
    wireframeLinewidth: finiteField(material, "wireframeLinewidth"),
    wireframeLinecap: material.wireframeLinecap ?? null,
    wireframeLinejoin: material.wireframeLinejoin ?? null,
    defines: runtimeJsonRecord(material.defines)
  };
}

function runtimeTextureRecord(texture, parser) {
  if (!texture) return null;
  const association = parser.associations.get(texture) || {};
  return {
    gltfTextureIndex: Number.isInteger(association.textures) ? association.textures : null,
    gltfImageIndex: Number.isInteger(association.images) ? association.images : null,
    name: texture.name ?? "",
    mapping: finiteField(texture, "mapping"),
    channel: finiteField(texture, "channel"),
    offset: runtimeVector(texture.offset),
    repeat: runtimeVector(texture.repeat),
    center: runtimeVector(texture.center),
    rotation: finiteField(texture, "rotation"),
    wrapS: finiteField(texture, "wrapS"),
    wrapT: finiteField(texture, "wrapT"),
    magFilter: finiteField(texture, "magFilter"),
    minFilter: finiteField(texture, "minFilter"),
    anisotropy: finiteField(texture, "anisotropy"),
    flipY: booleanField(texture, "flipY"),
    colorSpace: texture.colorSpace ?? null,
    matrixAutoUpdate: booleanField(texture, "matrixAutoUpdate"),
    matrix: runtimeMatrix(texture.matrix)
  };
}

function runtimeGeometryRecord(geometry, parser) {
  if (!geometry) return null;
  return {
    association: normalizeAssociation(parser.associations.get(geometry) || {}),
    attributes: Object.fromEntries(Object.entries(geometry.attributes || {}).sort(([a], [b]) => a.localeCompare(b)).map(([name, attribute]) => [name, {
      itemSize: attribute.itemSize,
      count: attribute.count,
      normalized: Boolean(attribute.normalized),
      gpuType: attribute.gpuType ?? null
    }])),
    index: geometry.index ? {
      itemSize: geometry.index.itemSize,
      count: geometry.index.count,
      normalized: Boolean(geometry.index.normalized),
      gpuType: geometry.index.gpuType ?? null
    } : null,
    groups: (geometry.groups || []).map(({ start, count, materialIndex }) => ({ start, count, materialIndex })),
    morphAttributeNames: Object.keys(geometry.morphAttributes || {}).sort(),
    morphTargetsRelative: Boolean(geometry.morphTargetsRelative)
  };
}

function stableObjectLocator(association, fallbackIndex) {
  if (Number.isInteger(association.nodes)) return `node:${association.nodes}`;
  if (Number.isInteger(association.meshes) && Number.isInteger(association.primitives)) {
    return `mesh:${association.meshes}/primitive:${association.primitives}/runtime:${fallbackIndex}`;
  }
  return `runtime:${fallbackIndex}`;
}

function normalizeAssociation(association) {
  return Object.fromEntries(Object.entries(association)
    .filter(([, value]) => Number.isInteger(value))
    .sort(([left], [right]) => left.localeCompare(right)));
}

function normalizeTextureInfo(info, defaults = {}) {
  if (!info) return null;
  return { ...defaults, index: info.index, texCoord: info.texCoord ?? 0, extensions: info.extensions ?? {}, extras: info.extras ?? null, ...info };
}

function runtimeColor(value) {
  return value?.isColor ? [value.r, value.g, value.b].map(canonicalFinite) : null;
}

function runtimeVector(value) {
  return value?.toArray ? value.toArray().map(canonicalFinite) : null;
}

function runtimeEuler(value) {
  return value?.isEuler ? [value.x, value.y, value.z].map(canonicalFinite).concat(value.order) : null;
}

function runtimeJsonRecord(value) {
  if (value == null) return null;
  return canonicalNormalize(JSON.parse(JSON.stringify(value)));
}

function runtimeMatrix(value) {
  return value?.elements ? value.elements.map(canonicalFinite) : null;
}

function finiteField(object, key) {
  return key in object && object[key] != null ? canonicalFinite(object[key]) : null;
}

function booleanField(object, key) {
  return key in object ? Boolean(object[key]) : null;
}

function canonicalFinite(value) {
  if (!Number.isFinite(value)) throw new TypeError("Non-finite Room 2 snapshot value.");
  return Object.is(value, -0) ? 0 : value;
}

async function sha256Text(value) {
  return sha256Bytes(new TextEncoder().encode(value));
}

function stableStringHash(prefix, value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${prefix}-${(hash >>> 0).toString(36)}`;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
