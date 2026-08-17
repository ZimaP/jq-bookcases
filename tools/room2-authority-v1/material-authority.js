export const PHASE5_ACCEPTANCE_STATUS = "PASS — MATERIAL AUTHORITY AND SEMANTIC COVERAGE ONLY";
export const PHASE5_SCOPE = "observational structural inventory only; no material-parity or final-finish claim";
export const SEMANTIC_STATUSES = Object.freeze(["PROVEN", "INFERRED", "UNRESOLVED"]);
export const PROVEN_MATERIAL_AUTHORITY = Object.freeze({
  name: "Accepted Phase 3 material ownership authority",
  source: ".local-proof/appearance-v2/generated/material-ownership.json",
  materialIndex: 3,
  materialName: "1#1513#-1",
  consumerRanges: Object.freeze([[21, 28], [43, 57], [72, 86], [101, 178], [181, 182]]),
  label: "cabinetry"
});

const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const IDENTITY_MATRIX = Object.freeze([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const TYPE_COMPONENTS = Object.freeze({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 });
const COMPONENT_BYTES = Object.freeze({ 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 });
const TEXTURE_SLOTS = Object.freeze([
  "alphaMap", "aoMap", "bumpMap", "clearcoatMap", "clearcoatNormalMap",
  "clearcoatRoughnessMap", "displacementMap", "emissiveMap", "envMap",
  "gradientMap", "iridescenceMap", "iridescenceThicknessMap", "lightMap",
  "map", "matcap", "metalnessMap", "normalMap", "roughnessMap",
  "sheenColorMap", "sheenRoughnessMap", "specularColorMap",
  "specularIntensityMap", "specularMap", "thicknessMap", "transmissionMap"
]);
const DECLARATION_KINDS = Object.freeze([
  "scenes", "nodes", "meshes", "materials", "accessors", "bufferViews",
  "buffers", "textures", "images", "samplers", "skins", "cameras", "animations"
]);

export function canonicalSerialize(value) {
  return JSON.stringify(canonicalNormalize(value));
}

export function canonicalNormalize(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return canonicalFinite(value);
  if (Array.isArray(value)) return value.map(canonicalNormalize);
  if (typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalNormalize(value[key])]));
  }
  throw new TypeError("Unsupported canonical value type: " + typeof value);
}

export async function sha256Text(value) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("Web Crypto SHA-256 is unavailable");
  const result = await subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(result)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function normalizeRawMaterial(material, materialIndex) {
  assertPlainIndex(materialIndex, "material index");
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

export async function createRawMaterialDigest(json) {
  const records = (json.materials || []).map((material, materialIndex) => normalizeRawMaterial(material, materialIndex));
  const materials = [];
  for (const record of records) {
    const canonical = canonicalSerialize(record);
    materials.push({ materialIndex: record.materialIndex, canonical, sha256: await sha256Text(canonical) });
  }
  const aggregateCanonical = canonicalSerialize(records);
  return deepFreeze({
    schema: "jq-room2-phase5-raw-material-digest-v1",
    materialCount: records.length,
    canonicalNumberPolicy: "ECMAScript JSON round-trip finite numbers; negative zero normalized to zero; NaN and infinities rejected",
    aggregateSha256: await sha256Text(aggregateCanonical),
    materials,
    records
  });
}

export async function createRuntimeMaterialDigest(gltf, json) {
  assert(gltf?.parser?.associations instanceof Map, "GLTF parser associations are required");
  const runtimeByIndex = collectRuntimeMaterials(gltf);
  const records = (json.materials || []).map((_, materialIndex) => {
    const material = runtimeByIndex.get(materialIndex);
    assert(material, "runtime material " + materialIndex + " is unavailable");
    return runtimeMaterialRecord(material, materialIndex, gltf.parser);
  });
  const materials = [];
  for (const record of records) {
    const canonical = canonicalSerialize(record);
    materials.push({ materialIndex: record.materialIndex, canonical, sha256: await sha256Text(canonical) });
  }
  const aggregateCanonical = canonicalSerialize(records);
  return deepFreeze({
    schema: "jq-room2-phase5-runtime-material-digest-v1",
    materialCount: records.length,
    whitelistVersion: 1,
    excludedUnstableFields: ["uuid", "version", "needsUpdate", "renderer caches", "compiled program state", "upload state", "object identity"],
    aggregateSha256: await sha256Text(aggregateCanonical),
    materials,
    records
  });
}

export async function snapshotAuthoritativeState(gltf, json) {
  assert(Array.isArray(gltf?.scenes), "parsed GLTF scenes are required");
  const objects = [];
  for (let sceneIndex = 0; sceneIndex < gltf.scenes.length; sceneIndex += 1) {
    const scene = gltf.scenes[sceneIndex];
    walkRuntimeObject(scene, [0], (object, runtimePath) => {
      const association = gltf.parser.associations.get(object) || {};
      const materials = object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : [];
      objects.push({
        stableRuntimeLocator: runtimeObjectLocator(sceneIndex, runtimePath, association),
        sceneIndex,
        runtimePath,
        association: normalizeAssociation(association),
        type: object.type ?? null,
        name: object.name ?? "",
        position: runtimeVector(object.position),
        quaternion: runtimeVector(object.quaternion),
        scale: runtimeVector(object.scale),
        matrix: runtimeMatrix(object.matrix),
        matrixWorld: runtimeMatrix(object.matrixWorld),
        matrixAutoUpdate: Boolean(object.matrixAutoUpdate),
        matrixWorldAutoUpdate: "matrixWorldAutoUpdate" in object ? Boolean(object.matrixWorldAutoUpdate) : null,
        visible: Boolean(object.visible),
        frustumCulled: "frustumCulled" in object ? Boolean(object.frustumCulled) : null,
        renderOrder: finiteField(object, "renderOrder"),
        castShadow: "castShadow" in object ? Boolean(object.castShadow) : null,
        receiveShadow: "receiveShadow" in object ? Boolean(object.receiveShadow) : null,
        geometry: runtimeGeometryRecord(object.geometry, gltf.parser),
        materialAssociations: materials.map((material) => normalizeAssociation(gltf.parser.associations.get(material) || {}))
      });
    });
  }
  objects.sort((left, right) => left.stableRuntimeLocator.localeCompare(right.stableRuntimeLocator, "en", { numeric: true }));
  const sceneCanonical = canonicalSerialize(objects);
  const runtimeMaterials = await createRuntimeMaterialDigest(gltf, json);
  return deepFreeze({
    schema: "jq-room2-phase5-authoritative-state-snapshot-v1",
    sceneObjects: objects,
    sceneObjectCount: objects.length,
    sceneSha256: await sha256Text(sceneCanonical),
    runtimeMaterials,
    combinedSha256: await sha256Text(canonicalSerialize({ sceneSha256: await sha256Text(sceneCanonical), runtimeMaterialSha256: runtimeMaterials.aggregateSha256 }))
  });
}

export async function buildMaterialAuthorityInventory({ arrayBuffer, json, gltf = null }) {
  assert(arrayBuffer instanceof ArrayBuffer, "the authoritative ArrayBuffer is required");
  assert(json && typeof json === "object", "parsed authoritative GLB JSON is required");
  const binary = locateGlbBinaryChunk(arrayBuffer);
  const referenceEdges = [];
  const extensionOccurrences = [];
  const defaultSceneIndex = json.scene ?? 0;
  assertPlainIndex(defaultSceneIndex, "default scene index");
  assert(json.scenes?.[defaultSceneIndex], "default scene declaration is missing");
  scanExtensionOccurrences(json, "", extensionOccurrences);

  const sceneGraph = collectSceneInstances(json, binary, referenceEdges);
  const nodeInstances = sceneGraph.nodeInstances;
  const sceneInstances = sceneGraph.primitiveInstances;
  const activeNodeInstances = nodeInstances.filter((instance) => instance.activeSceneMembership);
  const activeInstances = sceneInstances.filter((instance) => instance.activeSceneMembership);
  const instanceByNode = groupBy(nodeInstances, (entry) => entry.nodeIndex);
  const instanceByMesh = groupBy(sceneInstances, (entry) => entry.meshIndex);
  const instanceByPrimitive = groupBy(sceneInstances, (entry) => entry.meshIndex + "/" + entry.primitiveIndex);
  const provenConsumers = new Set(expandRanges(PROVEN_MATERIAL_AUTHORITY.consumerRanges).map((meshIndex) => meshIndex + "/0"));

  for (const instance of sceneInstances) {
    instance.semantic = classifyInstanceSemantic(instance, provenConsumers);
  }
  const primitivesByNodeInstance = groupBy(sceneInstances, (entry) => entry.nodeInstanceId);
  for (const instance of nodeInstances) {
    const primitives = primitivesByNodeInstance.get(instance.id) || [];
    instance.semantic = primitives.length
      ? aggregateSemantics(primitives.map(({ semantic }) => semantic), { fallbackReason: "Node instance primitives do not provide one compatible semantic label." })
      : inferFromObservedNames(instance.observedNamePath, instance.nodeIndexPath.map((nodeIndex) => "/nodes/" + nodeIndex + "/name"));
  }

  const primitiveDefinitions = [];
  for (let meshIndex = 0; meshIndex < (json.meshes || []).length; meshIndex += 1) {
    const mesh = json.meshes[meshIndex];
    for (let primitiveIndex = 0; primitiveIndex < (mesh.primitives || []).length; primitiveIndex += 1) {
      const primitive = mesh.primitives[primitiveIndex];
      const definitionId = primitiveId(meshIndex, primitiveIndex);
      const uses = instanceByPrimitive.get(meshIndex + "/" + primitiveIndex) || [];
      const positionAccessorIndex = primitive.attributes?.POSITION;
      assertPlainIndex(positionAccessorIndex, definitionId + " POSITION accessor");
      const positionAccessor = accessorReference(json, positionAccessorIndex);
      const indicesAccessor = primitive.indices == null ? null : accessorReference(json, primitive.indices);
      const localAabb = computeAccessorAabb(json, binary, positionAccessorIndex);
      const definitionSemantic = aggregateSemantics(uses.map(({ semantic }) => semantic), {
        fallbackReason: "No active or declared-scene instance provides semantic evidence for this primitive."
      });
      primitiveDefinitions.push({
        id: definitionId,
        meshIndex,
        primitiveIndex,
        meshName: mesh.name ?? null,
        mode: primitive.mode ?? 4,
        materialIndex: primitive.material ?? null,
        materialName: primitive.material == null ? null : json.materials?.[primitive.material]?.name ?? null,
        positionAccessor,
        indicesAccessor,
        attributes: Object.fromEntries(Object.entries(primitive.attributes || {}).sort(([a], [b]) => a.localeCompare(b)).map(([semantic, accessorIndex]) => [semantic, accessorReference(json, accessorIndex)])),
        morphTargets: (primitive.targets || []).map((target, targetIndex) => ({
          targetIndex,
          attributes: Object.fromEntries(Object.entries(target).sort(([a], [b]) => a.localeCompare(b)).map(([semantic, accessorIndex]) => [semantic, accessorReference(json, accessorIndex)]))
        })),
        extensions: primitive.extensions ?? {},
        extras: primitive.extras ?? null,
        localAabb,
        localBoundsBasis: "decoded base POSITION accessor values in mesh-local coordinates",
        instanceIds: uses.map(({ id }) => id),
        declaredSceneIndices: uniqueSorted(uses.map(({ sceneIndex }) => sceneIndex)),
        activeSceneMembership: uses.some(({ activeSceneMembership }) => activeSceneMembership),
        semantic: definitionSemantic
      });
      addEdge(referenceEdges, "mesh-primitive", meshId(meshIndex), definitionId, "/meshes/" + meshIndex + "/primitives/" + primitiveIndex);
      if (primitive.material != null) addEdge(referenceEdges, "primitive-material", definitionId, materialId(primitive.material), "/meshes/" + meshIndex + "/primitives/" + primitiveIndex + "/material");
      if (primitive.indices != null) addEdge(referenceEdges, "primitive-indices", definitionId, accessorId(primitive.indices), "/meshes/" + meshIndex + "/primitives/" + primitiveIndex + "/indices");
      for (const [semantic, accessorIndex] of Object.entries(primitive.attributes || {})) {
        addEdge(referenceEdges, "primitive-attribute", definitionId, accessorId(accessorIndex), "/meshes/" + meshIndex + "/primitives/" + primitiveIndex + "/attributes/" + escapePointer(semantic), { semantic });
      }
      for (let targetIndex = 0; targetIndex < (primitive.targets || []).length; targetIndex += 1) {
        for (const [semantic, accessorIndex] of Object.entries(primitive.targets[targetIndex])) {
          addEdge(referenceEdges, "primitive-morph-target", definitionId, accessorId(accessorIndex), "/meshes/" + meshIndex + "/primitives/" + primitiveIndex + "/targets/" + targetIndex + "/" + escapePointer(semantic), { targetIndex, semantic });
        }
      }
    }
  }

  const declarations = buildDeclarations({ json, binary, nodeInstances, sceneInstances, activeNodeInstances, activeInstances, instanceByNode, instanceByMesh, primitiveDefinitions, referenceEdges });
  const materialUsage = buildMaterialUsage(json, primitiveDefinitions, sceneInstances);
  applyMaterialSemantics(declarations.materials, materialUsage);
  applyMeshSemantics(declarations.meshes, primitiveDefinitions);
  applyNodeSemantics(declarations.nodes, instanceByNode);
  applySceneSemantics(declarations.scenes, sceneInstances);

  const orphans = buildOrphanReport(declarations, referenceEdges, nodeInstances);
  const sharedMeshes = declarations.meshes.filter(({ instanceIds }) => instanceIds.length > 1).map(({ id, index, instanceIds }) => ({ id, meshIndex: index, instanceIds }));
  const sharedMaterials = materialUsage.filter(({ primitiveDefinitionCount, activeInstanceCount }) => primitiveDefinitionCount > 1 || activeInstanceCount > 1);
  const semanticItems = [
    ...Object.values(declarations).flat(),
    ...primitiveDefinitions,
    ...nodeInstances,
    ...sceneInstances
  ];
  const semanticSummary = summarizeSemantics(semanticItems);
  const rawMaterialDigest = await createRawMaterialDigest(json);
  const runtimeMaterialDigest = gltf ? await createRuntimeMaterialDigest(gltf, json) : null;
  const coverage = coverageReport(json, declarations, primitiveDefinitions, nodeInstances, sceneInstances, activeNodeInstances, activeInstances);

  const inventory = {
    schema: "jq-room2-phase5-material-authority-inventory-v1",
    scope: PHASE5_SCOPE,
    authority: {
      immutableSource: "authoritative GLB structure",
      semanticAuthority: PROVEN_MATERIAL_AUTHORITY,
      importedAppearanceIsFinalFinishAuthority: false
    },
    canonicalization: {
      serialization: "recursive lexicographic object-key ordering with array order preserved",
      numbers: "ECMAScript JSON round-trip finite numbers; negative zero normalized to zero",
      nonFinitePolicy: "reject NaN and infinities"
    },
    defaultScene: { index: defaultSceneIndex, explicit: json.scene !== undefined, id: sceneId(defaultSceneIndex) },
    counts: coverage.counts,
    coverage,
    declarations,
    primitiveDefinitions,
    nodeInstances,
    primitiveInstances: sceneInstances,
    activeInstances: activeInstances.map(({ id }) => id),
    referenceEdges: referenceEdges.sort(compareEdge),
    extensions: {
      used: [...(json.extensionsUsed || [])],
      required: [...(json.extensionsRequired || [])],
      occurrences: extensionOccurrences.sort((left, right) => (left.locator + left.name).localeCompare(right.locator + right.name)),
      gpuInstancingOccurrences: extensionOccurrences.filter(({ name }) => name === "EXT_mesh_gpu_instancing")
    },
    orphans,
    sharedUsage: { meshes: sharedMeshes, materials: sharedMaterials },
    semanticSummary,
    rawMaterialDigest,
    runtimeMaterialDigest,
    preservationBoundaries: {
      geometryMutation: false,
      hierarchyMutation: false,
      transformMutation: false,
      materialMutation: false,
      textureMutation: false,
      inventoryAttachedToAuthoritativeObjects: false
    }
  };
  const detachedInventory = canonicalNormalize(inventory);
  detachedInventory.inventorySha256 = await sha256Text(canonicalSerialize(detachedInventory));
  return deepFreeze(detachedInventory);
}

function collectSceneInstances(json, binary, referenceEdges) {
  const nodeInstances = [];
  const primitiveInstances = [];
  for (let sceneIndex = 0; sceneIndex < (json.scenes || []).length; sceneIndex += 1) {
    const scene = json.scenes[sceneIndex];
    for (let rootOrdinal = 0; rootOrdinal < (scene.nodes || []).length; rootOrdinal += 1) {
      const rootNodeIndex = scene.nodes[rootOrdinal];
      addEdge(referenceEdges, "scene-root-node", sceneId(sceneIndex), nodeId(rootNodeIndex), "/scenes/" + sceneIndex + "/nodes/" + rootOrdinal);
      walkNode(rootNodeIndex, [], IDENTITY_MATRIX, new Set());
    }

    function walkNode(nodeIndex, ancestry, parentWorldMatrix, active) {
      assertPlainIndex(nodeIndex, "scene " + sceneIndex + " node");
      const node = json.nodes?.[nodeIndex];
      assert(node, "scene " + sceneIndex + " references missing node " + nodeIndex);
      assert(!active.has(nodeIndex), "node graph cycle at node " + nodeIndex + " in scene " + sceneIndex);
      const nodeIndexPath = [...ancestry, nodeIndex];
      const localMatrix = nodeLocalMatrix(node);
      const worldMatrix = multiplyMatrices(parentWorldMatrix, localMatrix);
      const baseNodeInstanceId = nodeInstanceId(sceneIndex, nodeIndexPath);
      const namePath = nodeIndexPath.map((index) => json.nodes[index]?.name ?? null);
      const activeSceneMembership = sceneIndex === (json.scene ?? 0);
      const meshIndex = Number.isInteger(node.mesh) ? node.mesh : null;
      nodeInstances.push({
        id: baseNodeInstanceId,
        declaredSceneIndex: sceneIndex,
        sceneIndex,
        activeSceneMembership,
        nodeIndex,
        nodeIndexPath,
        hierarchyPath: nodeIndexPath.map((index) => "node:" + index),
        observedNamePath: namePath,
        meshIndex,
        skinIndex: node.skin ?? null,
        cameraIndex: node.camera ?? null,
        localMatrix,
        worldMatrix,
        semantic: unresolvedSemantic("Semantic classification has not yet been evaluated.")
      });
      if (meshIndex !== null) {
        addEdge(referenceEdges, "node-mesh", nodeId(nodeIndex), meshId(meshIndex), "/nodes/" + nodeIndex + "/mesh", { sceneIndex, nodeIndexPath });
        const mesh = json.meshes?.[meshIndex];
        assert(mesh, "node " + nodeIndex + " references missing mesh " + meshIndex);
        const gpuInstances = decodeGpuInstances(node, json, binary);
        for (const [semantic, accessorIndex] of Object.entries(node.extensions?.EXT_mesh_gpu_instancing?.attributes || {})) {
          addEdge(referenceEdges, "gpu-instancing-attribute", nodeId(nodeIndex), accessorId(accessorIndex), "/nodes/" + nodeIndex + "/extensions/EXT_mesh_gpu_instancing/attributes/" + escapePointer(semantic), { semantic, sceneIndex, nodeIndexPath });
        }
        for (const gpuInstance of gpuInstances) {
          const instanceWorldMatrix = multiplyMatrices(worldMatrix, gpuInstance.matrix);
          for (let primitiveIndex = 0; primitiveIndex < (mesh.primitives || []).length; primitiveIndex += 1) {
            const primitive = mesh.primitives[primitiveIndex];
            const positionAccessorIndex = primitive.attributes?.POSITION;
            assertPlainIndex(positionAccessorIndex, "primitive POSITION accessor");
            const stableId = primitiveInstanceId(sceneIndex, nodeIndexPath, meshIndex, primitiveIndex, gpuInstance.index);
            primitiveInstances.push({
              id: stableId,
              declaredSceneIndex: sceneIndex,
              sceneIndex,
              activeSceneMembership,
              nodeIndex,
              nodeIndexPath,
              hierarchyPath: nodeIndexPath.map((index) => "node:" + index),
              observedNamePath: namePath,
              nodeInstanceId: gpuInstance.index === null ? baseNodeInstanceId : baseNodeInstanceId + "/gpu-instance:" + gpuInstance.index,
              meshIndex,
              primitiveIndex,
              primitiveMode: primitive.mode ?? 4,
              materialIndex: primitive.material ?? null,
              materialName: primitive.material == null ? null : json.materials?.[primitive.material]?.name ?? null,
              skinIndex: node.skin ?? null,
              gpuInstanceIndex: gpuInstance.index,
              gpuInstancingAttributes: gpuInstance.attributes,
              localMatrix,
              worldMatrix: instanceWorldMatrix,
              localAabb: computeAccessorAabb(json, binary, positionAccessorIndex),
              worldAabb: computeWorldAccessorAabb(json, binary, positionAccessorIndex, instanceWorldMatrix),
              boundsBasis: {
                local: "decoded base POSITION accessor values",
                world: "every decoded base POSITION transformed by the immutable GLB node-index hierarchy matrix",
                morphTargetsApplied: false,
                skinningApplied: false
              },
              deformationAmbiguity: {
                morphTargetsPresent: (primitive.targets || []).length > 0,
                skinPresent: node.skin != null,
                unresolved: (primitive.targets || []).length > 0 || node.skin != null
              },
              semantic: unresolvedSemantic("Semantic classification has not yet been evaluated.")
            });
          }
        }
      }
      if (node.camera != null) addEdge(referenceEdges, "node-camera", nodeId(nodeIndex), cameraId(node.camera), "/nodes/" + nodeIndex + "/camera", { sceneIndex, nodeIndexPath });
      if (node.skin != null) addEdge(referenceEdges, "node-skin", nodeId(nodeIndex), skinId(node.skin), "/nodes/" + nodeIndex + "/skin", { sceneIndex, nodeIndexPath });
      const nextActive = new Set(active);
      nextActive.add(nodeIndex);
      for (let childOrdinal = 0; childOrdinal < (node.children || []).length; childOrdinal += 1) {
        const childIndex = node.children[childOrdinal];
        addEdge(referenceEdges, "node-child", nodeId(nodeIndex), nodeId(childIndex), "/nodes/" + nodeIndex + "/children/" + childOrdinal, { sceneIndex, parentPath: nodeIndexPath });
        walkNode(childIndex, nodeIndexPath, worldMatrix, nextActive);
      }
    }
  }
  nodeInstances.sort((left, right) => left.id.localeCompare(right.id, "en", { numeric: true }));
  primitiveInstances.sort((left, right) => left.id.localeCompare(right.id, "en", { numeric: true }));
  return { nodeInstances, primitiveInstances };
}

function buildDeclarations({ json, binary, nodeInstances, sceneInstances, activeNodeInstances, activeInstances, instanceByNode, instanceByMesh, primitiveDefinitions, referenceEdges }) {
  const declarations = Object.fromEntries(DECLARATION_KINDS.map((kind) => [kind, []]));
  for (let index = 0; index < (json.scenes || []).length; index += 1) {
    const primitiveInstances = sceneInstances.filter(({ sceneIndex }) => sceneIndex === index);
    const sceneNodeInstances = nodeInstances.filter(({ sceneIndex }) => sceneIndex === index);
    declarations.scenes.push({
      id: sceneId(index), index, name: json.scenes[index].name ?? null,
      rootNodeIndices: [...(json.scenes[index].nodes || [])],
      active: index === (json.scene ?? 0),
      nodeInstanceIds: sceneNodeInstances.map(({ id }) => id),
      primitiveInstanceIds: primitiveInstances.map(({ id }) => id),
      semantic: unresolvedSemantic("Scene semantic is evaluated after instance coverage is assembled.")
    });
  }
  for (let index = 0; index < (json.nodes || []).length; index += 1) {
    const node = json.nodes[index];
    const instances = instanceByNode.get(index) || [];
    declarations.nodes.push({
      id: nodeId(index), index, name: node.name ?? null,
      children: [...(node.children || [])], meshIndex: node.mesh ?? null,
      cameraIndex: node.camera ?? null, skinIndex: node.skin ?? null,
      weights: node.weights ?? null, localMatrix: nodeLocalMatrix(node),
      transformSource: node.matrix ? "matrix" : "TRS defaults resolved",
      sceneMemberships: uniqueSorted(instances.map(({ sceneIndex }) => sceneIndex)),
      activeSceneMembership: instances.some(({ activeSceneMembership }) => activeSceneMembership),
      hierarchyPaths: uniqueRecords(instances.map(({ sceneIndex, nodeIndexPath }) => ({ sceneIndex, nodeIndexPath }))),
      nodeInstanceIds: instances.map(({ id }) => id),
      primitiveInstanceIds: sceneInstances.filter(({ nodeIndex }) => nodeIndex === index).map(({ id }) => id),
      extensions: node.extensions ?? {}, extras: node.extras ?? null,
      semantic: unresolvedSemantic("Node semantic is evaluated after instance coverage is assembled.")
    });
  }
  for (let index = 0; index < (json.meshes || []).length; index += 1) {
    const mesh = json.meshes[index];
    const instances = instanceByMesh.get(index) || [];
    declarations.meshes.push({
      id: meshId(index), index, name: mesh.name ?? null,
      primitiveIds: (mesh.primitives || []).map((_, primitiveIndex) => primitiveId(index, primitiveIndex)),
      primitiveCount: (mesh.primitives || []).length,
      weights: mesh.weights ?? null,
      referencedNodeIndices: uniqueSorted(instances.map(({ nodeIndex }) => nodeIndex)),
      instanceIds: instances.map(({ id }) => id),
      shared: instances.length > 1,
      activeSceneMembership: instances.some(({ activeSceneMembership }) => activeSceneMembership),
      extensions: mesh.extensions ?? {}, extras: mesh.extras ?? null,
      semantic: unresolvedSemantic("Mesh semantic is evaluated after primitive coverage is assembled.")
    });
  }
  for (let index = 0; index < (json.materials || []).length; index += 1) {
    const material = json.materials[index];
    const raw = normalizeRawMaterial(material, index);
    declarations.materials.push({
      id: materialId(index), index, name: material.name ?? null,
      raw,
      alphaMode: material.alphaMode ?? "OPAQUE",
      alphaCutoff: material.alphaCutoff ?? 0.5,
      doubleSided: material.doubleSided ?? false,
      extensions: material.extensions ?? {}, extras: material.extras ?? null,
      textureSlots: collectRawTextureSlots(material),
      primitiveDefinitionIds: [],
      primitiveInstanceIds: [],
      shared: false,
      ambiguity: false,
      conflict: false,
      semantic: unresolvedSemantic("Material semantic is evaluated from its complete usage set.")
    });
    addMaterialTextureEdges(referenceEdges, material, index);
  }
  for (let index = 0; index < (json.accessors || []).length; index += 1) {
    const accessor = json.accessors[index];
    declarations.accessors.push({
      id: accessorId(index), index, name: accessor.name ?? null,
      bufferViewIndex: accessor.bufferView ?? null,
      byteOffset: accessor.byteOffset ?? 0,
      componentType: accessor.componentType,
      normalized: accessor.normalized ?? false,
      count: accessor.count,
      type: accessor.type,
      min: accessor.min ?? null,
      max: accessor.max ?? null,
      sparse: accessor.sparse ?? null,
      extensions: accessor.extensions ?? {}, extras: accessor.extras ?? null,
      semantic: unresolvedSemantic("Accessor has no direct authoritative semantic classification.")
    });
    if (accessor.bufferView != null) addEdge(referenceEdges, "accessor-bufferView", accessorId(index), bufferViewId(accessor.bufferView), "/accessors/" + index + "/bufferView");
    if (accessor.sparse?.indices?.bufferView != null) addEdge(referenceEdges, "accessor-sparse-indices-bufferView", accessorId(index), bufferViewId(accessor.sparse.indices.bufferView), "/accessors/" + index + "/sparse/indices/bufferView");
    if (accessor.sparse?.values?.bufferView != null) addEdge(referenceEdges, "accessor-sparse-values-bufferView", accessorId(index), bufferViewId(accessor.sparse.values.bufferView), "/accessors/" + index + "/sparse/values/bufferView");
  }
  for (let index = 0; index < (json.bufferViews || []).length; index += 1) {
    const view = json.bufferViews[index];
    declarations.bufferViews.push({
      id: bufferViewId(index), index, name: view.name ?? null,
      bufferIndex: view.buffer, byteOffset: view.byteOffset ?? 0,
      byteLength: view.byteLength, byteStride: view.byteStride ?? null,
      target: view.target ?? null, extensions: view.extensions ?? {}, extras: view.extras ?? null,
      semantic: unresolvedSemantic("Buffer view has no direct authoritative semantic classification.")
    });
    addEdge(referenceEdges, "bufferView-buffer", bufferViewId(index), bufferId(view.buffer), "/bufferViews/" + index + "/buffer");
    if (view.extensions?.EXT_meshopt_compression?.buffer != null) addEdge(referenceEdges, "meshopt-buffer", bufferViewId(index), bufferId(view.extensions.EXT_meshopt_compression.buffer), "/bufferViews/" + index + "/extensions/EXT_meshopt_compression/buffer");
  }
  for (let index = 0; index < (json.buffers || []).length; index += 1) {
    const buffer = json.buffers[index];
    declarations.buffers.push({
      id: bufferId(index), index, name: buffer.name ?? null,
      byteLength: buffer.byteLength, uri: buffer.uri ?? null,
      embeddedGlbBinaryChunk: index === 0 && buffer.uri == null,
      extensions: buffer.extensions ?? {}, extras: buffer.extras ?? null,
      semantic: unresolvedSemantic("Binary buffer has no direct authoritative semantic classification.")
    });
  }
  for (let index = 0; index < (json.textures || []).length; index += 1) {
    const texture = json.textures[index];
    declarations.textures.push({
      id: textureId(index), index, name: texture.name ?? null,
      samplerIndex: texture.sampler ?? null, sourceImageIndex: texture.source ?? null,
      extensions: texture.extensions ?? {}, extras: texture.extras ?? null,
      semantic: unresolvedSemantic("Texture declaration is imported appearance data, not final-finish authority.")
    });
    if (texture.sampler != null) addEdge(referenceEdges, "texture-sampler", textureId(index), samplerId(texture.sampler), "/textures/" + index + "/sampler");
    if (texture.source != null) addEdge(referenceEdges, "texture-image", textureId(index), imageId(texture.source), "/textures/" + index + "/source");
  }
  for (let index = 0; index < (json.images || []).length; index += 1) {
    const image = json.images[index];
    declarations.images.push({
      id: imageId(index), index, name: image.name ?? null,
      uri: image.uri ?? null, mimeType: image.mimeType ?? null,
      bufferViewIndex: image.bufferView ?? null,
      extensions: image.extensions ?? {}, extras: image.extras ?? null,
      semantic: unresolvedSemantic("Image declaration is imported appearance data, not final-finish authority.")
    });
    if (image.bufferView != null) addEdge(referenceEdges, "image-bufferView", imageId(index), bufferViewId(image.bufferView), "/images/" + index + "/bufferView");
  }
  for (let index = 0; index < (json.samplers || []).length; index += 1) {
    const sampler = json.samplers[index];
    declarations.samplers.push({
      id: samplerId(index), index, name: sampler.name ?? null,
      magFilter: sampler.magFilter ?? null, minFilter: sampler.minFilter ?? null,
      wrapS: sampler.wrapS ?? 10497, wrapT: sampler.wrapT ?? 10497,
      extensions: sampler.extensions ?? {}, extras: sampler.extras ?? null,
      semantic: unresolvedSemantic("Sampler declaration has no direct authoritative semantic classification.")
    });
  }
  buildSkinDeclarations(json, declarations, referenceEdges);
  buildCameraDeclarations(json, declarations);
  buildAnimationDeclarations(json, declarations, referenceEdges);
  assert(binary.byteLength > 0 || (json.bufferViews || []).length === 0, "GLB binary chunk is unavailable");
  assert(primitiveDefinitions.length === (json.meshes || []).reduce((sum, mesh) => sum + (mesh.primitives || []).length, 0), "primitive declaration coverage differs");
  assert(activeNodeInstances.every(({ activeSceneMembership }) => activeSceneMembership), "active node instance filter differs");
  assert(activeInstances.every(({ activeSceneMembership }) => activeSceneMembership), "active instance filter differs");
  return declarations;
}

function buildMaterialUsage(json, primitiveDefinitions, sceneInstances) {
  return (json.materials || []).map((material, materialIndex) => {
    const definitions = primitiveDefinitions.filter((primitive) => primitive.materialIndex === materialIndex);
    const instances = sceneInstances.filter((instance) => instance.materialIndex === materialIndex);
    const semantics = instances.map(({ semantic }) => semantic);
    const labels = uniqueSorted(semantics.map(({ label }) => label).filter((label) => label !== "unknown"));
    const unresolvedCount = semantics.filter(({ status }) => status === "UNRESOLVED").length;
    const conflict = labels.length > 1 || semantics.some((semantic) => semantic.conflict);
    return {
      materialIndex,
      materialName: material.name ?? null,
      primitiveDefinitionCount: definitions.length,
      primitiveDefinitionIds: definitions.map(({ id }) => id),
      declaredInstanceCount: instances.length,
      activeInstanceCount: instances.filter(({ activeSceneMembership }) => activeSceneMembership).length,
      primitiveInstanceIds: instances.map(({ id }) => id),
      semanticLabels: labels,
      semanticStatusCounts: countStatuses(semantics),
      ambiguity: conflict || unresolvedCount > 0,
      conflict,
      reason: conflict
        ? "This shared material spans multiple observed semantic labels: " + labels.join(", ") + "."
        : unresolvedCount > 0
          ? "At least one material consumer remains semantically unresolved."
          : "All observed material consumers have one compatible semantic label."
    };
  });
}

function applyMaterialSemantics(materials, usage) {
  for (const material of materials) {
    const record = usage[material.index];
    material.primitiveDefinitionIds = record.primitiveDefinitionIds;
    material.primitiveInstanceIds = record.primitiveInstanceIds;
    material.shared = record.primitiveDefinitionCount > 1 || record.activeInstanceCount > 1;
    material.ambiguity = record.ambiguity;
    material.conflict = record.conflict;
    if (material.index === PROVEN_MATERIAL_AUTHORITY.materialIndex && material.name === PROVEN_MATERIAL_AUTHORITY.materialName) {
      material.semantic = provenSemantic(
        PROVEN_MATERIAL_AUTHORITY.label,
        PROVEN_MATERIAL_AUTHORITY.source + "#target.materialIndex",
        "Accepted Phase 3 authority directly maps material index 3 and its exact consumer set to cabinet/bookcase groups."
      );
      material.ambiguity = false;
      material.conflict = false;
    } else if (record.semanticLabels.length === 1 && !record.conflict) {
      material.semantic = inferredSemantic(
        record.semanticLabels[0],
        record.primitiveInstanceIds.map((id) => "inventory://" + id),
        "The label is inferred from consumer hierarchy names; imported material names and values are not final-finish authority.",
        record.ambiguity
      );
    } else {
      material.semantic = unresolvedSemantic(record.reason, record.primitiveInstanceIds.map((id) => "inventory://" + id), record.ambiguity, record.conflict);
    }
  }
}

function applyMeshSemantics(meshes, primitiveDefinitions) {
  for (const mesh of meshes) {
    const primitives = primitiveDefinitions.filter(({ meshIndex }) => meshIndex === mesh.index);
    mesh.semantic = aggregateSemantics(primitives.map(({ semantic }) => semantic), {
      fallbackReason: "Mesh semantics cannot be resolved from its primitive definitions."
    });
  }
}

function applyNodeSemantics(nodes, instanceByNode) {
  for (const node of nodes) {
    const instances = instanceByNode.get(node.index) || [];
    if (instances.length) {
      node.semantic = aggregateSemantics(instances.map(({ semantic }) => semantic), {
        fallbackReason: "Node primitive instances do not provide one compatible semantic label."
      });
      continue;
    }
    node.semantic = inferFromObservedNames([node.name], ["/nodes/" + node.index + "/name"]);
  }
}

function applySceneSemantics(scenes, sceneInstances) {
  for (const scene of scenes) {
    const instances = sceneInstances.filter(({ sceneIndex }) => scene.index);
    const aggregate = aggregateSemantics(instances.map(({ semantic }) => semantic), {
      fallbackReason: "The scene contains multiple semantic categories and has no single authoritative classification."
    });
    scene.semantic = aggregate.status === "PROVEN"
      ? unresolvedSemantic("A whole-room scene is broader than its proven component classifications.", aggregate.evidenceLocators, true, false)
      : aggregate;
  }
}

function classifyInstanceSemantic(instance, provenConsumers) {
  const consumerKey = instance.meshIndex + "/" + instance.primitiveIndex;
  if (instance.materialIndex === PROVEN_MATERIAL_AUTHORITY.materialIndex && provenConsumers.has(consumerKey)) {
    return provenSemantic(
      PROVEN_MATERIAL_AUTHORITY.label,
      PROVEN_MATERIAL_AUTHORITY.source + "#target.consumers[" + consumerKey + "]",
      "Accepted Phase 3 authority directly identifies this mesh/primitive and node-index path as a cabinet/bookcase-group consumer."
    );
  }
  const locators = instance.nodeIndexPath.map((nodeIndex) => "/nodes/" + nodeIndex + "/name");
  return inferFromObservedNames(instance.observedNamePath, locators);
}

function inferFromObservedNames(names, locators) {
  const observed = names.map((name) => String(name || "").trim()).filter(Boolean);
  const joined = observed.join(" / ").toLowerCase();
  const candidates = [];
  const add = (label, pattern) => { if (pattern.test(joined)) candidates.push(label); };
  add("hardware", /\b(knob|handle|pull|hinge|hafele|axilo)\b/);
  add("glass", /\bglass\b/);
  add("fireplace/surround", /\b(fireplace|mantel|hearth|surround)\b/);
  add("countertop", /\b(countertop|counter top)\b/);
  add("trim", /\b(crown|trim|moulding|molding|baseboard)\b/);
  add("architecture", /\b(wall|floor|ceiling|window|room)\b/);
  add("cabinetry", /\b(cabinet|bookcase|door|shelf|hutch|toe|filler|wood top|uback|uend|bottom)\b/);
  const labels = uniqueSorted(candidates);
  const evidenceLocators = locators.filter((_, index) => Boolean(names[index]));
  if (labels.length === 1) {
    return inferredSemantic(
      labels[0],
      evidenceLocators,
      "Classification is inferred only from observed GLB node names; names do not establish authoritative final semantics.",
      false
    );
  }
  if (labels.length > 1) {
    return unresolvedSemantic(
      "Observed GLB names support conflicting candidate labels: " + labels.join(", ") + ".",
      evidenceLocators,
      true,
      true
    );
  }
  return unresolvedSemantic(
    observed.length ? "Observed GLB names do not support a controlled candidate label." : "No observed GLB name supports semantic classification.",
    evidenceLocators,
    false,
    false
  );
}

function aggregateSemantics(semantics, { fallbackReason }) {
  if (!semantics.length) return unresolvedSemantic(fallbackReason);
  const labels = uniqueSorted(semantics.map(({ label }) => label).filter((label) => label !== "unknown"));
  const evidenceLocators = uniqueSorted(semantics.flatMap(({ evidenceLocators }) => evidenceLocators));
  const hasUnresolved = semantics.some(({ status }) => status === "UNRESOLVED");
  const ambiguity = semantics.some(({ ambiguity }) => ambiguity) || labels.length > 1 || hasUnresolved;
  const conflict = semantics.some(({ conflict }) => conflict) || labels.length > 1;
  if (labels.length !== 1 || conflict) return unresolvedSemantic(fallbackReason, evidenceLocators, ambiguity, conflict);
  const allProven = semantics.every(({ status, label }) => status === "PROVEN" && label === labels[0]);
  if (allProven) return provenSemantic(labels[0], evidenceLocators, "Every covered item has the same direct authoritative mapping.");
  return inferredSemantic(labels[0], evidenceLocators, "The aggregate label is observational and includes inferred or unresolved descendants.", ambiguity);
}

function provenSemantic(label, evidenceLocators, reason) {
  const locators = Array.isArray(evidenceLocators) ? evidenceLocators : [evidenceLocators];
  assert(locators.length > 0 && locators.every(Boolean), "PROVEN semantics require exact evidence locators");
  return { status: "PROVEN", label, authoritySource: PROVEN_MATERIAL_AUTHORITY.name, evidenceLocators: uniqueSorted(locators), reason, ambiguity: false, conflict: false };
}

function inferredSemantic(label, evidenceLocators, reason, ambiguity = false) {
  return { status: "INFERRED", label, authoritySource: "Observed authoritative GLB baseline data only", evidenceLocators: uniqueSorted(evidenceLocators), reason, ambiguity: Boolean(ambiguity), conflict: false };
}

function unresolvedSemantic(reason, evidenceLocators = [], ambiguity = false, conflict = false) {
  return { status: "UNRESOLVED", label: "unknown", authoritySource: null, evidenceLocators: uniqueSorted(evidenceLocators), reason, ambiguity: Boolean(ambiguity), conflict: Boolean(conflict) };
}

function summarizeSemantics(items) {
  const counts = countStatuses(items.map(({ semantic }) => semantic));
  const ambiguous = items.filter(({ semantic }) => semantic.ambiguity).map(({ id }) => id);
  const conflicts = items.filter(({ semantic }) => semantic.conflict).map(({ id }) => id);
  return {
    total: items.length,
    proven: counts.PROVEN,
    inferred: counts.INFERRED,
    unresolved: counts.UNRESOLVED,
    ambiguousCount: ambiguous.length,
    conflictCount: conflicts.length,
    ambiguousItemIds: ambiguous,
    conflictItemIds: conflicts,
    provenWithoutExactLocator: items.filter(({ semantic }) => semantic.status === "PROVEN" && (!semantic.authoritySource || semantic.evidenceLocators.length === 0)).map(({ id }) => id)
  };
}

function buildOrphanReport(declarations, referenceEdges, sceneInstances) {
  const targets = new Set(referenceEdges.map(({ to }) => to));
  const nodeMembership = new Set(sceneInstances.map(({ nodeIndex }) => nodeIndex));
  const orphanByKind = {
    scenes: [],
    nodes: declarations.nodes.filter(({ index }) => !nodeMembership.has(index)).map(({ id }) => id),
    meshes: declarations.meshes.filter(({ instanceIds }) => instanceIds.length === 0).map(({ id }) => id),
    primitives: [],
    materials: declarations.materials.filter(({ primitiveDefinitionIds }) => primitiveDefinitionIds.length === 0).map(({ id }) => id),
    accessors: declarations.accessors.filter(({ id }) => !targets.has(id)).map(({ id }) => id),
    bufferViews: declarations.bufferViews.filter(({ id }) => !targets.has(id)).map(({ id }) => id),
    buffers: declarations.buffers.filter(({ id }) => !targets.has(id)).map(({ id }) => id),
    textures: declarations.textures.filter(({ id }) => !targets.has(id)).map(({ id }) => id),
    images: declarations.images.filter(({ id }) => !targets.has(id)).map(({ id }) => id),
    samplers: declarations.samplers.filter(({ id }) => !targets.has(id)).map(({ id }) => id),
    skins: declarations.skins.filter(({ id }) => !targets.has(id)).map(({ id }) => id),
    cameras: declarations.cameras.filter(({ id }) => !targets.has(id)).map(({ id }) => id),
    animations: []
  };
  return {
    byKind: orphanByKind,
    total: Object.values(orphanByKind).reduce((sum, records) => sum + records.length, 0),
    explicit: true
  };
}

function coverageReport(json, declarations, primitiveDefinitions, nodeInstances, primitiveInstances, activeNodeInstances, activePrimitiveInstances) {
  const declaredPrimitiveCount = (json.meshes || []).reduce((sum, mesh) => sum + (mesh.primitives || []).length, 0);
  const expected = {
    scenes: (json.scenes || []).length,
    nodes: (json.nodes || []).length,
    meshes: (json.meshes || []).length,
    primitives: declaredPrimitiveCount,
    materials: (json.materials || []).length,
    activeNodeInstances: activeNodeInstances.length,
    activePrimitiveInstances: activePrimitiveInstances.length
  };
  const actual = {
    scenes: declarations.scenes.length,
    nodes: declarations.nodes.length,
    meshes: declarations.meshes.length,
    primitives: primitiveDefinitions.length,
    materials: declarations.materials.length,
    activeNodeInstances: declarations.nodes.filter(({ activeSceneMembership }) => activeSceneMembership).length,
    activePrimitiveInstances: primitiveDefinitions.reduce((sum, primitive) => sum + primitive.instanceIds.filter((id) => activePrimitiveInstances.some((instance) => instance.id === id)).length, 0)
  };
  const stableIds = [
    ...Object.values(declarations).flat().map(({ id }) => id),
    ...primitiveDefinitions.map(({ id }) => id),
    ...nodeInstances.map(({ id }) => id),
    ...primitiveInstances.map(({ id }) => id)
  ];
  const duplicateIds = stableIds.filter((id, index) => stableIds.indexOf(id) !== index);
  return {
    counts: {
      declaredScenes: actual.scenes,
      declaredNodes: actual.nodes,
      declaredMeshes: actual.meshes,
      declaredPrimitives: actual.primitives,
      declaredMaterials: actual.materials,
      declaredSceneNodePathInstances: nodeInstances.length,
      declaredScenePrimitiveInstances: primitiveInstances.length,
      activeNodeInstances: actual.activeNodeInstances,
      activePrimitiveInstances: actual.activePrimitiveInstances
    },
    expected,
    actual,
    exactDeclaredCoverage: canonicalSerialize(actual) === canonicalSerialize(expected),
    duplicateStableIds: uniqueSorted(duplicateIds),
    noDuplicates: duplicateIds.length === 0,
    complete: canonicalSerialize(actual) === canonicalSerialize(expected) && duplicateIds.length === 0
  };
}

function buildSkinDeclarations(json, declarations, referenceEdges) {
  for (let index = 0; index < (json.skins || []).length; index += 1) {
    const skin = json.skins[index];
    declarations.skins.push({
      id: skinId(index), index, name: skin.name ?? null,
      inverseBindMatricesAccessorIndex: skin.inverseBindMatrices ?? null,
      skeletonNodeIndex: skin.skeleton ?? null,
      jointNodeIndices: [...(skin.joints || [])],
      extensions: skin.extensions ?? {}, extras: skin.extras ?? null,
      semantic: unresolvedSemantic("Skin declaration has no direct authoritative semantic classification.")
    });
    if (skin.inverseBindMatrices != null) addEdge(referenceEdges, "skin-inverseBindMatrices", skinId(index), accessorId(skin.inverseBindMatrices), "/skins/" + index + "/inverseBindMatrices");
    if (skin.skeleton != null) addEdge(referenceEdges, "skin-skeleton", skinId(index), nodeId(skin.skeleton), "/skins/" + index + "/skeleton");
    for (let jointIndex = 0; jointIndex < (skin.joints || []).length; jointIndex += 1) {
      addEdge(referenceEdges, "skin-joint", skinId(index), nodeId(skin.joints[jointIndex]), "/skins/" + index + "/joints/" + jointIndex);
    }
  }
}

function buildCameraDeclarations(json, declarations) {
  for (let index = 0; index < (json.cameras || []).length; index += 1) {
    const camera = json.cameras[index];
    declarations.cameras.push({
      id: cameraId(index), index, name: camera.name ?? null,
      type: camera.type, perspective: camera.perspective ?? null,
      orthographic: camera.orthographic ?? null,
      extensions: camera.extensions ?? {}, extras: camera.extras ?? null,
      semantic: unresolvedSemantic("Camera declaration has no direct authoritative semantic classification.")
    });
  }
}

function buildAnimationDeclarations(json, declarations, referenceEdges) {
  for (let index = 0; index < (json.animations || []).length; index += 1) {
    const animation = json.animations[index];
    const id = animationId(index);
    declarations.animations.push({
      id, index, name: animation.name ?? null,
      samplers: (animation.samplers || []).map((sampler, samplerIndex) => ({ samplerIndex, inputAccessorIndex: sampler.input, outputAccessorIndex: sampler.output, interpolation: sampler.interpolation ?? "LINEAR" })),
      channels: (animation.channels || []).map((channel, channelIndex) => ({ channelIndex, samplerIndex: channel.sampler, targetNodeIndex: channel.target?.node ?? null, targetPath: channel.target?.path ?? null })),
      extensions: animation.extensions ?? {}, extras: animation.extras ?? null,
      semantic: unresolvedSemantic("Animation declaration has no direct authoritative semantic classification.")
    });
    for (let samplerIndex = 0; samplerIndex < (animation.samplers || []).length; samplerIndex += 1) {
      const sampler = animation.samplers[samplerIndex];
      addEdge(referenceEdges, "animation-input-accessor", id, accessorId(sampler.input), "/animations/" + index + "/samplers/" + samplerIndex + "/input", { samplerIndex });
      addEdge(referenceEdges, "animation-output-accessor", id, accessorId(sampler.output), "/animations/" + index + "/samplers/" + samplerIndex + "/output", { samplerIndex });
    }
    for (let channelIndex = 0; channelIndex < (animation.channels || []).length; channelIndex += 1) {
      const channel = animation.channels[channelIndex];
      if (channel.target?.node != null) addEdge(referenceEdges, "animation-target-node", id, nodeId(channel.target.node), "/animations/" + index + "/channels/" + channelIndex + "/target/node", { channelIndex, path: channel.target.path });
    }
  }
}

function collectRawTextureSlots(material) {
  const slots = [];
  walk(material, [], (value, pathParts) => {
    const key = pathParts.at(-1) || "";
    if (!key.endsWith("Texture") || !value || typeof value !== "object" || !Number.isInteger(value.index)) return;
    slots.push({
      slot: pathParts.join("."),
      textureIndex: value.index,
      texCoord: value.texCoord ?? 0,
      extensions: value.extensions ?? {},
      extras: value.extras ?? null
    });
  });
  return slots.sort((left, right) => left.slot.localeCompare(right.slot));
}

function addMaterialTextureEdges(referenceEdges, material, materialIndex) {
  walk(material, [], (value, pathParts) => {
    const key = pathParts.at(-1) || "";
    if (!key.endsWith("Texture") || !value || typeof value !== "object" || !Number.isInteger(value.index)) return;
    addEdge(
      referenceEdges,
      "material-texture",
      materialId(materialIndex),
      textureId(value.index),
      "/materials/" + materialIndex + "/" + pathParts.map(escapePointer).join("/"),
      { slot: pathParts.join("."), texCoord: value.texCoord ?? 0 }
    );
  });
}

function scanExtensionOccurrences(value, pointer, results) {
  if (!value || typeof value !== "object") return;
  if (!Array.isArray(value) && value.extensions && typeof value.extensions === "object") {
    for (const name of Object.keys(value.extensions)) {
      results.push({ name, locator: (pointer || "") + "/extensions/" + escapePointer(name), required: false });
    }
  }
  if (Array.isArray(value)) {
    value.forEach((child, index) => scanExtensionOccurrences(child, pointer + "/" + index, results));
  } else {
    for (const [key, child] of Object.entries(value)) {
      if (key !== "extensions") scanExtensionOccurrences(child, pointer + "/" + escapePointer(key), results);
    }
  }
}

function decodeGpuInstances(node, json, binary) {
  const attributes = node.extensions?.EXT_mesh_gpu_instancing?.attributes;
  if (!attributes) return [{ index: null, matrix: IDENTITY_MATRIX, attributes: null }];
  const entries = Object.entries(attributes);
  assert(entries.length > 0, "EXT_mesh_gpu_instancing attributes are empty");
  const decoded = Object.fromEntries(entries.map(([semantic, accessorIndex]) => [semantic, decodeAccessor(json, binary, accessorIndex)]));
  const counts = uniqueSorted(Object.values(decoded).map(({ values }) => values.length));
  assert(counts.length === 1, "EXT_mesh_gpu_instancing accessor counts differ");
  const result = [];
  for (let index = 0; index < counts[0]; index += 1) {
    const translation = decoded.TRANSLATION?.values[index] ?? [0, 0, 0];
    const rotation = decoded.ROTATION?.values[index] ?? [0, 0, 0, 1];
    const scale = decoded.SCALE?.values[index] ?? [1, 1, 1];
    result.push({
      index,
      matrix: composeMatrix(translation, rotation, scale),
      attributes: Object.fromEntries(entries.map(([semantic, accessorIndex]) => [semantic, { accessorIndex, value: decoded[semantic].values[index] }]))
    });
  }
  return result;
}

function accessorReference(json, accessorIndex) {
  assertPlainIndex(accessorIndex, "accessor index");
  const accessor = json.accessors?.[accessorIndex];
  assert(accessor, "missing accessor " + accessorIndex);
  return {
    accessorIndex,
    type: accessor.type,
    componentType: accessor.componentType,
    count: accessor.count,
    normalized: accessor.normalized ?? false
  };
}

function computeAccessorAabb(json, binary, accessorIndex) {
  const decoded = decodeAccessor(json, binary, accessorIndex);
  assert(decoded.components >= 3, "POSITION accessor " + accessorIndex + " must contain at least three components");
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const value of decoded.values) {
    for (let axis = 0; axis < 3; axis += 1) {
      const component = canonicalFinite(value[axis]);
      min[axis] = Math.min(min[axis], component);
      max[axis] = Math.max(max[axis], component);
    }
  }
  assert(decoded.values.length > 0, "POSITION accessor " + accessorIndex + " is empty");
  return { min: min.map(canonicalFinite), max: max.map(canonicalFinite), accessorIndex, decodedCount: decoded.values.length };
}

function computeWorldAccessorAabb(json, binary, accessorIndex, matrix) {
  const decoded = decodeAccessor(json, binary, accessorIndex);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const value of decoded.values) {
    const world = transformPoint(matrix, value);
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], world[axis]);
      max[axis] = Math.max(max[axis], world[axis]);
    }
  }
  assert(decoded.values.length > 0, "POSITION accessor " + accessorIndex + " is empty");
  return { min: min.map(canonicalFinite), max: max.map(canonicalFinite), accessorIndex, decodedCount: decoded.values.length };
}

function decodeAccessor(json, binary, accessorIndex) {
  assertPlainIndex(accessorIndex, "accessor index");
  const accessor = json.accessors?.[accessorIndex];
  assert(accessor, "missing accessor " + accessorIndex);
  const components = TYPE_COMPONENTS[accessor.type];
  const componentBytes = COMPONENT_BYTES[accessor.componentType];
  assert(components && componentBytes, "unsupported accessor encoding at " + accessorIndex);
  assertPlainIndex(accessor.count, "accessor count");
  const values = Array.from({ length: accessor.count }, () => Array(components).fill(0));
  if (accessor.bufferView != null) {
    const view = json.bufferViews?.[accessor.bufferView];
    assert(view, "missing accessor bufferView " + accessor.bufferView);
    const stride = view.byteStride ?? components * componentBytes;
    assert(stride >= components * componentBytes, "accessor byteStride is too small");
    const base = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    for (let index = 0; index < accessor.count; index += 1) {
      for (let component = 0; component < components; component += 1) {
        values[index][component] = readComponent(binary.view, binary.byteOffset + base + index * stride + component * componentBytes, accessor.componentType, accessor.normalized === true);
      }
    }
  }
  if (accessor.sparse) {
    const sparse = accessor.sparse;
    const indexView = json.bufferViews?.[sparse.indices.bufferView];
    const valueView = json.bufferViews?.[sparse.values.bufferView];
    assert(indexView && valueView, "sparse accessor bufferView is missing");
    const sparseIndexBytes = COMPONENT_BYTES[sparse.indices.componentType];
    assert([5121, 5123, 5125].includes(sparse.indices.componentType), "sparse index component type is unsupported");
    const indexBase = binary.byteOffset + (indexView.byteOffset ?? 0) + (sparse.indices.byteOffset ?? 0);
    const valueBase = binary.byteOffset + (valueView.byteOffset ?? 0) + (sparse.values.byteOffset ?? 0);
    for (let sparseIndex = 0; sparseIndex < sparse.count; sparseIndex += 1) {
      const target = readComponent(binary.view, indexBase + sparseIndex * sparseIndexBytes, sparse.indices.componentType, false);
      assertPlainIndex(target, "sparse target index");
      assert(target < accessor.count, "sparse target index exceeds accessor count");
      for (let component = 0; component < components; component += 1) {
        values[target][component] = readComponent(binary.view, valueBase + (sparseIndex * components + component) * componentBytes, accessor.componentType, accessor.normalized === true);
      }
    }
  }
  return { accessorIndex, components, values };
}

function readComponent(view, byteOffset, componentType, normalized) {
  let value;
  if (componentType === 5120) value = view.getInt8(byteOffset);
  else if (componentType === 5121) value = view.getUint8(byteOffset);
  else if (componentType === 5122) value = view.getInt16(byteOffset, true);
  else if (componentType === 5123) value = view.getUint16(byteOffset, true);
  else if (componentType === 5125) value = view.getUint32(byteOffset, true);
  else if (componentType === 5126) value = view.getFloat32(byteOffset, true);
  else throw new Error("Unsupported component type " + componentType);
  if (!normalized) return canonicalFinite(value);
  if (componentType === 5120) return Math.max(value / 127, -1);
  if (componentType === 5121) return value / 255;
  if (componentType === 5122) return Math.max(value / 32767, -1);
  if (componentType === 5123) return value / 65535;
  return canonicalFinite(value);
}

function locateGlbBinaryChunk(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  assert(view.byteLength >= 20, "GLB is too short");
  assert(view.getUint32(0, true) === GLB_MAGIC, "GLB magic differs");
  assert(view.getUint32(4, true) === GLB_VERSION, "GLB version differs");
  assert(view.getUint32(8, true) === view.byteLength, "GLB declared length differs");
  let offset = 12;
  let sawJson = false;
  while (offset < view.byteLength) {
    assert(offset + 8 <= view.byteLength, "GLB chunk header is truncated");
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const dataOffset = offset + 8;
    assert(dataOffset + length <= view.byteLength, "GLB chunk is truncated");
    if (type === JSON_CHUNK) sawJson = true;
    if (type === BIN_CHUNK) {
      assert(sawJson, "GLB BIN chunk precedes JSON");
      return { view, byteOffset: dataOffset, byteLength: length };
    }
    offset = dataOffset + length;
  }
  return { view, byteOffset: view.byteLength, byteLength: 0 };
}

function nodeLocalMatrix(node) {
  if (node.matrix) {
    assert(node.matrix.length === 16, "node matrix must have 16 components");
    return node.matrix.map(canonicalFinite);
  }
  return composeMatrix(node.translation ?? [0, 0, 0], node.rotation ?? [0, 0, 0, 1], node.scale ?? [1, 1, 1]);
}

function composeMatrix(translation, quaternion, scale) {
  assert(translation.length === 3 && quaternion.length === 4 && scale.length === 3, "TRS component lengths differ");
  const [x, y, z, w] = quaternion.map(canonicalFinite);
  const [sx, sy, sz] = scale.map(canonicalFinite);
  const [tx, ty, tz] = translation.map(canonicalFinite);
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
  ].map(canonicalFinite);
}

function multiplyMatrices(left, right) {
  const result = Array(16).fill(0);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      let value = 0;
      for (let index = 0; index < 4; index += 1) value += left[index * 4 + row] * right[column * 4 + index];
      result[column * 4 + row] = canonicalFinite(value);
    }
  }
  return result;
}

function transformPoint(matrix, value) {
  const x = canonicalFinite(value[0]);
  const y = canonicalFinite(value[1]);
  const z = canonicalFinite(value[2]);
  const w = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
  assert(Number.isFinite(w) && w !== 0, "world transform produced an invalid homogeneous coordinate");
  return [
    (matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]) / w,
    (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]) / w,
    (matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]) / w
  ].map(canonicalFinite);
}

function collectRuntimeMaterials(gltf) {
  const runtimeByIndex = new Map();
  for (const scene of gltf.scenes) {
    scene.traverse((object) => {
      if (!object.material) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        const association = gltf.parser.associations.get(material);
        if (Number.isInteger(association?.materials) && !runtimeByIndex.has(association.materials)) runtimeByIndex.set(association.materials, material);
      }
    });
  }
  return runtimeByIndex;
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
    matrix: texture.matrix?.elements ? texture.matrix.elements.map(canonicalFinite) : null
  };
}

function runtimeGeometryRecord(geometry, parser) {
  if (!geometry) return null;
  const association = parser.associations.get(geometry) || {};
  return {
    association: normalizeAssociation(association),
    attributes: Object.fromEntries(Object.entries(geometry.attributes || {}).sort(([a], [b]) => a.localeCompare(b)).map(([name, attribute]) => [name, {
      itemSize: attribute.itemSize,
      count: attribute.count,
      normalized: Boolean(attribute.normalized),
      gpuType: attribute.gpuType ?? null
    }])),
    index: geometry.index ? { itemSize: geometry.index.itemSize, count: geometry.index.count, normalized: Boolean(geometry.index.normalized), gpuType: geometry.index.gpuType ?? null } : null,
    groups: (geometry.groups || []).map(({ start, count, materialIndex }) => ({ start, count, materialIndex })),
    drawRange: geometry.drawRange ? { start: geometry.drawRange.start, count: finiteOrSentinel(geometry.drawRange.count) } : null,
    morphAttributeNames: Object.keys(geometry.morphAttributes || {}).sort(),
    morphTargetsRelative: Boolean(geometry.morphTargetsRelative)
  };
}

function walkRuntimeObject(object, runtimePath, callback) {
  callback(object, runtimePath);
  for (let index = 0; index < object.children.length; index += 1) walkRuntimeObject(object.children[index], [...runtimePath, index], callback);
}

function runtimeObjectLocator(sceneIndex, runtimePath, association) {
  if (Number.isInteger(association.nodes)) return "scene:" + sceneIndex + "/node:" + association.nodes + "/runtime-path:" + runtimePath.join(".");
  if (Number.isInteger(association.meshes) && Number.isInteger(association.primitives)) return "scene:" + sceneIndex + "/mesh:" + association.meshes + "/primitive:" + association.primitives + "/runtime-path:" + runtimePath.join(".");
  return "scene:" + sceneIndex + "/runtime-path:" + runtimePath.join(".");
}

function normalizeAssociation(association) {
  return Object.fromEntries(Object.entries(association).filter(([, value]) => Number.isInteger(value)).sort(([a], [b]) => a.localeCompare(b)));
}

function runtimeColor(value) {
  return value?.isColor ? [canonicalFinite(value.r), canonicalFinite(value.g), canonicalFinite(value.b)] : null;
}

function runtimeVector(value) {
  return value?.toArray ? value.toArray().map(canonicalFinite) : null;
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

function finiteOrSentinel(value) {
  if (Number.isFinite(value)) return canonicalFinite(value);
  if (value === Infinity) return { rejectedNonFinite: "Infinity" };
  if (value === -Infinity) return { rejectedNonFinite: "-Infinity" };
  throw new TypeError("NaN is not allowed in an authoritative snapshot");
}

function normalizeTextureInfo(info, defaults = {}) {
  if (!info) return null;
  return { ...defaults, index: info.index, texCoord: info.texCoord ?? 0, extensions: info.extensions ?? {}, extras: info.extras ?? null, ...info };
}

function canonicalFinite(value) {
  if (!Number.isFinite(value)) throw new TypeError("NaN and infinities are forbidden in canonical material authority data");
  return Object.is(value, -0) ? 0 : value;
}

function addEdge(edges, kind, from, to, locator, details = null) {
  assert(typeof from === "string" && typeof to === "string", "reference edge endpoints must use stable IDs");
  edges.push({ id: "edge:" + kind + ":" + from + "->" + to + "@" + locator, kind, from, to, locator, details });
}

function compareEdge(left, right) {
  return left.id.localeCompare(right.id, "en", { numeric: true });
}

function groupBy(values, keyFunction) {
  const map = new Map();
  for (const value of values) {
    const key = keyFunction(value);
    const records = map.get(key) || [];
    records.push(value);
    map.set(key, records);
  }
  return map;
}

function countStatuses(semantics) {
  const counts = { PROVEN: 0, INFERRED: 0, UNRESOLVED: 0 };
  for (const semantic of semantics) {
    assert(semantic && SEMANTIC_STATUSES.includes(semantic.status), "every inventoried item requires a semantic status");
    counts[semantic.status] += 1;
  }
  return counts;
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((left, right) => String(left).localeCompare(String(right), "en", { numeric: true }));
}

function uniqueRecords(values) {
  const byCanonical = new Map();
  for (const value of values) byCanonical.set(canonicalSerialize(value), value);
  return [...byCanonical.values()].sort((left, right) => canonicalSerialize(left).localeCompare(canonicalSerialize(right)));
}

function countUnique(values) {
  return new Set(values).size;
}

function expandRanges(ranges) {
  const values = [];
  for (const [start, end] of ranges) for (let value = start; value <= end; value += 1) values.push(value);
  return values;
}

function walk(value, pathParts, callback) {
  if (!value || typeof value !== "object") return;
  callback(value, pathParts);
  if (Array.isArray(value)) {
    value.forEach((child, index) => walk(child, [...pathParts, String(index)], callback));
  } else {
    for (const [key, child] of Object.entries(value)) walk(child, [...pathParts, key], callback);
  }
}

function escapePointer(value) {
  return String(value).replace(/~/g, "~0").replace(/\//g, "~1");
}

function sceneId(index) { return "scene:" + index; }
function nodeId(index) { return "node:" + index; }
function meshId(index) { return "mesh:" + index; }
function primitiveId(meshIndex, primitiveIndex) { return "mesh:" + meshIndex + "/primitive:" + primitiveIndex; }
function materialId(index) { return "material:" + index; }
function accessorId(index) { return "accessor:" + index; }
function bufferViewId(index) { return "bufferView:" + index; }
function bufferId(index) { return "buffer:" + index; }
function textureId(index) { return "texture:" + index; }
function imageId(index) { return "image:" + index; }
function samplerId(index) { return "sampler:" + index; }
function skinId(index) { return "skin:" + index; }
function cameraId(index) { return "camera:" + index; }
function animationId(index) { return "animation:" + index; }
function nodeInstanceId(sceneIndex, nodeIndexPath) { return "scene:" + sceneIndex + "/nodes:" + nodeIndexPath.join("/"); }
function primitiveInstanceId(sceneIndex, nodeIndexPath, meshIndex, primitiveIndex, gpuInstanceIndex) {
  return nodeInstanceId(sceneIndex, nodeIndexPath)
    + (gpuInstanceIndex === null ? "" : "/gpu-instance:" + gpuInstanceIndex)
    + "/mesh:" + meshIndex + "/primitive:" + primitiveIndex;
}

function assertPlainIndex(value, label) {
  assert(Number.isInteger(value) && value >= 0, label + " must be a non-negative integer");
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function assert(condition, message) {
  if (!condition) throw new Error("Phase 5 material authority: " + message);
}
