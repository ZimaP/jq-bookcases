import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  canonicalStringify,
  createGlbProof,
  parseGlb
} from "./room2-authority-v1/room2-glb-integrity.js";
import {
  IMMERSIVE_LAYOUT_ORDER,
  IMMERSIVE_LAYOUT_REGISTRY
} from "../guided-layout-registry.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const modelOutputPath = "config/immersive-layout-model-audit-v1.json";
const zoneOutputPath = "config/immersive-layout-material-zones-v1.json";
const zoneModuleOutputPath = "guided-layout-material-zones.generated.js";
const COMPONENT_BYTES = Object.freeze({
  5120: 1,
  5121: 1,
  5122: 2,
  5123: 2,
  5125: 4,
  5126: 4
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
const existingFireplaceAudit = JSON.parse(await readFile(
  `${root}/config/room2-commercial-pbr-v1-semantic-audit.json`,
  "utf8"
));

const policies = Object.freeze({
  "door-wall": Object.freeze({
    0: blocked("wall-room-shell", "Exclusive wall/cap source material and exact consumer paths."),
    1: provisional("painted-millwork", "Exclusive cabinetry faces, trim, casework, shelves, fillers, and toe-kick source material; no accepted finish-mapping authority exists for this GLB."),
    2: blocked("adjustable-support-hardware", "All exact consumers are Hafele Axilo support components."),
    3: blocked("knob-hardware", "All exact consumers are named cabinet knobs."),
    4: provisional("cabinet-interior-millwork", "Exclusive cabinet bottoms, ends, tops, shelves, backs, and one toe skin; source appearance is retained."),
    5: blocked("architectural-door-hardware", "Exact consumers belong to the room's independent interior-door hardware."),
    6: blocked("architectural-interior-door", "Exact consumers belong to the room's independent interior door."),
    7: provisional("toe-skin-millwork", "Exclusive toe-skin consumers, but the distinct untextured source slot has no accepted finish authority."),
    8: blocked("floor-room-shell", "Exclusive floor source material and consumer."),
    9: blocked("ceiling-room-shell", "Exclusive ceiling source material and consumer.")
  }),
  "window-wall": Object.freeze({
    0: blocked("wall-room-shell", "Exclusive wall/cap source material and exact consumer paths."),
    1: blocked("pull-hardware", "All exact consumers are cabinet pulls."),
    2: blocked("adjustable-support-hardware", "All exact consumers are Hafele Axilo support components."),
    3: provisional("painted-millwork", "Exclusive cabinetry faces, trim, casework, shelves, fillers, and toe-kick source material; no accepted finish-mapping authority exists for this GLB."),
    4: provisional("drawer-box-millwork", "Exclusive drawer-box sides, fronts, bottoms, and backs; source appearance is retained."),
    5: provisional("cabinet-interior-millwork", "Exclusive cabinet tops, bottoms, ends, shelves, backs, and toe skins; source appearance is retained."),
    6: blocked("architectural-window-frame", "Exact consumers belong to the room's independent picture-window assembly."),
    7: blocked("architectural-glazing", "Exclusive transparent glass source material and consumer."),
    8: blocked("floor-room-shell", "Exclusive floor source material and consumer."),
    9: blocked("ceiling-room-shell", "Exclusive ceiling source material and consumer.")
  })
});

const modelLayouts = [];
const zoneLayouts = [];

for (const layoutId of IMMERSIVE_LAYOUT_ORDER) {
  const layout = IMMERSIVE_LAYOUT_REGISTRY[layoutId];
  assert(layout, `missing registry record for ${layoutId}`);
  const sourceBytes = await readFile(`${root}/${layout.authoritativeSource.path}`);
  const arrayBuffer = sourceBytes.buffer.slice(sourceBytes.byteOffset, sourceBytes.byteOffset + sourceBytes.byteLength);
  const parsed = parseGlb(arrayBuffer);
  const proof = await createGlbProof(arrayBuffer);
  const sourceSha256 = sha256(sourceBytes);
  assert(sourceBytes.byteLength === layout.authoritativeSource.bytes, `${layoutId} byte length changed`);
  assert(sourceSha256 === layout.authoritativeSource.sha256, `${layoutId} SHA-256 changed`);
  assert(proof.sourceSha256 === layout.authoritativeSource.sha256, `${layoutId} proof source hash changed`);
  assert(proof.geometryFingerprint === layout.authoritativeSource.sourceContractFingerprint, `${layoutId} source-contract fingerprint changed`);
  const geometryTopologyTransformFingerprintNoMaterial = createGeometryTopologyTransformFingerprintNoMaterial(parsed);
  assert(
    geometryTopologyTransformFingerprintNoMaterial === layout.authoritativeSource.geometryTopologyTransformFingerprintNoMaterial,
    `${layoutId} material-independent geometry/topology/transform fingerprint changed`
  );
  assert(canonicalStringify(proof.inventory.counts) === canonicalStringify({
    scenes: proof.inventory.counts.scenes,
    nodes: layout.sourceMetadata.nodes,
    meshes: layout.sourceMetadata.meshes,
    primitives: layout.sourceMetadata.primitives,
    accessors: layout.sourceMetadata.accessors,
    vertices: layout.sourceMetadata.vertices,
    triangles: layout.sourceMetadata.triangles,
    materials: layout.sourceMetadata.materials,
    textures: layout.sourceMetadata.textures,
    images: layout.sourceMetadata.images,
    samplers: proof.inventory.counts.samplers,
    animations: proof.inventory.counts.animations,
    cameras: proof.inventory.counts.cameras,
    skins: proof.inventory.counts.skins,
    lights: proof.inventory.counts.lights
  }), `${layoutId} source counts changed`);
  assert(proof.inventory.externalUris.length === 0, `${layoutId} gained external resources`);
  assert(proof.inventory.extensionsRequired.length === 0, `${layoutId} gained a required extension`);

  const hierarchy = buildHierarchy(parsed.json, proof.inventory);
  const zoneRecords = buildZoneRecords(layoutId, layout, parsed.json, proof.inventory, hierarchy);
  assert(zoneRecords.length === layout.sourceMetadata.primitives, `${layoutId} zone matrix is not exhaustive`);
  assert(new Set(zoneRecords.map(({ stablePrimitiveId }) => stablePrimitiveId)).size === zoneRecords.length, `${layoutId} has duplicate stable primitive IDs`);
  assert(zoneRecords.every(({ status }) => ["PROVEN", "PROVISIONAL", "BLOCKED"].includes(status)), `${layoutId} has an invalid zone status`);
  const targetDescendants = descendantIndices(parsed.json, layout.semanticManifest.targetNodeIndex);
  const allNodeIndices = proof.inventory.nodes.map(({ index }) => index);
  const control = layout.geometryControlManifest["adjustable-shelf-clearance"];
  const derivedControl = deriveShelfClearanceControl(layoutId, layout, proof.inventory, hierarchy);
  validateRegistryControl(layoutId, layout, control, derivedControl);
  const controlAudit = {
    id: control.id,
    status: control.status,
    nonGlobal: true,
    operation: control.operation,
    axis: control.axis,
    canonicalUnit: control.internalUnit,
    displayUnit: control.displayUnit,
    formula: control.formula,
    toleranceMillimeters: control.toleranceMillimeters,
    rangeMillimeters: {
      min: round(derivedControl.minMillimeters, 6),
      native: round(derivedControl.nativeMillimeters, 6),
      max: round(derivedControl.maxMillimeters, 6),
      step: control.stepMillimeters,
      snapOrigin: "native"
    },
    rangeDerivation: {
      nativeTargetBottomMillimeters: round(derivedControl.nativeTargetBottomMillimeters, 6),
      lowerAnchorTopMillimeters: round(derivedControl.lowerAnchorTopMillimeters, 6),
      upperAnchorBottomMillimeters: round(derivedControl.upperAnchorBottomMillimeters, 6),
      targetThicknessMillimeters: round(derivedControl.targetThicknessMillimeters, 9),
      identity: "max = upperAnchorBottom - lowerAnchorTop - targetThickness; min = lower-anchor contact",
      limitingBoundary: control.limitingBoundary,
      collisionProof: control.collisionProof
    },
    translationAxisProof: {
      parentNodeIndex: derivedControl.motionParentNodeIndex,
      parentAxisWorld: derivedControl.parentAxisWorld.map((value) => round(value, 15)),
      scaleMetersPerLocalUnit: derivedControl.parentAxisScaleMetersPerLocalUnit,
      signedWorldYPerLocalZ: derivedControl.signedWorldYPerLocalZ,
      maximumOffAxisDriftMillimeters: round(derivedControl.maximumOffAxisDriftMillimeters, 9)
    },
    target: nodeBinding(layout.semanticManifest.targetNodeIndex, hierarchy, proof.inventory),
    targetMesh: {
      nodeIndex: layout.semanticManifest.targetMeshNodeIndex,
      meshIndex: layout.semanticManifest.targetMeshIndex,
      primitiveIndex: layout.semanticManifest.targetPrimitiveIndex,
      sourceMaterialIndex: layout.semanticManifest.targetMaterialIndex,
      sourceAccessors: accessorBindings(layout.semanticManifest.targetAccessors, proof.inventory),
      nativeWorldBounds: roundBounds(derivedControl.nativeTargetWorldBounds, 9),
      nativeTranslationZ: round(derivedControl.nativeTranslationZ, 10),
      thicknessMillimeters: round(derivedControl.targetThicknessMillimeters, 9)
    },
    anchors: {
      lower: {
        ...nodeBinding(layout.semanticManifest.lowerAnchorNodeIndex, hierarchy, proof.inventory),
        mesh: nodeBinding(layout.semanticManifest.lowerAnchorMeshNodeIndex, hierarchy, proof.inventory),
        topMillimeters: round(derivedControl.lowerAnchorTopMillimeters, 6)
      },
      upper: {
        ...nodeBinding(layout.semanticManifest.upperAnchorNodeIndex, hierarchy, proof.inventory),
        mesh: nodeBinding(layout.semanticManifest.upperAnchorMeshNodeIndex, hierarchy, proof.inventory),
        bottomMillimeters: round(derivedControl.upperAnchorBottomMillimeters, 6)
      }
    },
    participatingNodeIndices: [...targetDescendants].sort(numericSort),
    invariantLocalNodeIndices: allNodeIndices.filter((index) => index !== layout.semanticManifest.targetNodeIndex),
    invariantWorldNodeIndices: allNodeIndices.filter((index) => !targetDescendants.has(index)),
    geometryInvariants: [
      "all index and attribute typed-array bytes remain byte-identical",
      "target local X/Y, quaternion, and scale remain native",
      "target thickness and X/Z world bounds remain native",
      "every non-participating local/world transform remains native",
      "native degenerate-triangle count does not increase",
      "lower and upper anchor contact planes are the finite range boundaries"
    ],
    automatedRuntimeProof: {
      suite: "e2e/immersive-layout-configurator.spec.js",
      requiredCases: ["min", "native", "max", "50 edit/reset cycles", "A→B→C→A state isolation", "pointer", "touch", "keyboard", "panel"]
    }
  };

  modelLayouts.push({
    layoutId,
    label: layout.label,
    roomId: layout.roomId,
    productId: layout.productId,
    authorityStatus: layout.currentAuthorityStatus,
    authoritativeSource: {
      path: layout.authoritativeSource.path,
      bytes: sourceBytes.byteLength,
      sha256: sourceSha256,
      runtimeDerivative: null
    },
    fingerprints: {
      sourceContract: {
        algorithm: "room2-glb-integrity/createGlbProof-v1 (includes primitive material bindings)",
        sha256: proof.geometryFingerprint
      },
      geometryTopologyTransformsNoMaterial: {
        algorithm: "jq-glb-geometry-topology-transform-no-material-v1",
        sha256: geometryTopologyTransformFingerprintNoMaterial
      }
    },
    gltf: {
      asset: proof.inventory.asset,
      defaultScene: proof.inventory.defaultScene,
      scenes: proof.inventory.scenes,
      extensionsUsed: proof.inventory.extensionsUsed,
      extensionsRequired: proof.inventory.extensionsRequired,
      externalUris: proof.inventory.externalUris,
      compression: proof.inventory.compression,
      counts: proof.inventory.counts,
      worldBounds: proof.inventory.worldBounds,
      nativeDegenerateTriangles: layout.sourceMetadata.nativeDegenerateTriangles
    },
    nodeHierarchy: hierarchy.map((record) => ({
      nodeIndex: record.nodeIndex,
      parentIndex: record.parentIndex,
      childIndices: record.childIndices,
      nodeIndexPath: record.nodeIndexPath,
      observedNamePath: record.observedNamePath,
      name: record.name,
      meshIndex: record.meshIndex,
      authoredTransform: record.authoredTransform,
      localMatrix: record.localMatrix,
      worldMatrix: record.worldMatrix,
      worldBounds: record.worldBounds,
      reachableFromScene: record.reachableFromScene
    })),
    accessorProofs: proof.inventory.accessors,
    controls: [controlAudit],
    blockedControls: Object.entries(layout.dimensionSupportMatrix)
      .filter(([, status]) => status === "BLOCKED")
      .map(([id]) => ({ id, status: "BLOCKED", reason: "No authoritative anchor/stretch/repetition contract exists in the supplied source model." })),
    uncertainties: [
      "This is an interactive preview, not manufacturing authority.",
      "Only the named shelf-clearance control is authorized to move geometry.",
      "Final dimensions and finishes require design confirmation."
    ]
  });

  zoneLayouts.push({
    layoutId,
    label: layout.label,
    source: {
      path: layout.authoritativeSource.path,
      bytes: sourceBytes.byteLength,
      sha256: sourceSha256,
      sourceContractFingerprint: proof.geometryFingerprint
    },
    automaticFinishMapping: layout.appearanceManifest.automaticFinishMapping,
    records: zoneRecords,
    summary: summarizeZones(zoneRecords),
    unresolvedAreas: layoutId === "fireplace-wall"
      ? ["Non-target embedded source materials remain provisional digital appearance unless separately identified in the accepted Room 2 audit."]
      : ["No automatic finish mapping is authorized; all cabinetry retains embedded source materials pending an owner-accepted per-surface finish authority."]
  });
}

const modelOutput = {
  schema: "jq-immersive-layout-model-audit-v1",
  generatedFrom: "SHA-locked authoritative GLBs; deterministic repository generator",
  coordinateSystem: "glTF 2.0 right-handed, +Y up; world distances are meters",
  layouts: modelLayouts
};
const zoneOutput = {
  schema: "jq-immersive-layout-material-zones-v1",
  stableIdentity: "scene index + full numeric node path + mesh/primitive ordinals + original material/accessor identity; names are supporting evidence only",
  proofColors: { PROVEN: "#2fa36b", PROVISIONAL: "#e3a93c", BLOCKED: "#c74c4c" },
  layouts: zoneLayouts
};
const runtimeRecords = Object.fromEntries(zoneLayouts.map(({ layoutId, records }) => [
  layoutId,
  records.map((record) => ({
    stablePrimitiveId: record.stablePrimitiveId,
    nodeIndex: record.nodeIndex,
    meshIndex: record.meshIndex,
    primitiveIndex: record.primitiveIndex,
    sourceMaterialIndex: record.sourceMaterialIndex,
    zone: record.zone,
    status: record.status,
    finishTarget: record.finishTarget
  }))
]));
const zoneModuleOutput = `// Generated by tools/generate-immersive-layout-audits.mjs. Do not edit by hand.\n`
  + `export const IMMERSIVE_LAYOUT_MATERIAL_ZONES = Object.freeze(${JSON.stringify(runtimeRecords, null, 2)});\n\n`
  + `const INDEX = new Map(Object.entries(IMMERSIVE_LAYOUT_MATERIAL_ZONES).map(([layoutId, records]) => [layoutId, new Map(records.map((record) => [\`${"${record.nodeIndex}/${record.meshIndex}/${record.primitiveIndex}"}\`, record]))]));\n\n`
  + `export function getImmersiveMaterialZone(layoutId, nodeIndex, meshIndex, primitiveIndex) {\n`
  + `  return INDEX.get(layoutId)?.get(\`${"${nodeIndex}/${meshIndex}/${primitiveIndex}"}\`) || null;\n`
  + `}\n`;

await emit(modelOutputPath, `${JSON.stringify(modelOutput, null, 2)}\n`);
await emit(zoneOutputPath, `${JSON.stringify(zoneOutput, null, 2)}\n`);
await emit(zoneModuleOutputPath, zoneModuleOutput);

console.log(`${modelOutputPath}: verified ${modelLayouts.reduce((sum, layout) => sum + layout.nodeHierarchy.length, 0)} nodes`);
console.log(`${zoneOutputPath}: verified ${zoneLayouts.reduce((sum, layout) => sum + layout.records.length, 0)} primitive records`);
console.log(`${zoneModuleOutputPath}: verified deterministic runtime index`);

function buildHierarchy(json, inventory) {
  const parents = new Map();
  (json.nodes || []).forEach((node, nodeIndex) => {
    for (const childIndex of node.children || []) {
      assert(!parents.has(childIndex), `node ${childIndex} has multiple parents`);
      parents.set(childIndex, nodeIndex);
    }
  });
  const inventoryByIndex = new Map(inventory.nodes.map((record) => [record.index, record]));
  return (json.nodes || []).map((node, nodeIndex) => {
    const nodeIndexPath = [];
    let cursor = nodeIndex;
    const visited = new Set();
    while (Number.isInteger(cursor)) {
      assert(!visited.has(cursor), `node cycle at ${cursor}`);
      visited.add(cursor);
      nodeIndexPath.unshift(cursor);
      cursor = parents.get(cursor);
    }
    const source = inventoryByIndex.get(nodeIndex);
    return {
      nodeIndex,
      parentIndex: parents.get(nodeIndex) ?? null,
      childIndices: node.children || [],
      nodeIndexPath,
      observedNamePath: nodeIndexPath.map((index) => json.nodes[index]?.name || null),
      name: node.name || null,
      meshIndex: node.mesh ?? null,
      authoredTransform: source.authoredTransform,
      localMatrix: source.localMatrix,
      worldMatrix: source.worldMatrix,
      worldBounds: source.worldBounds,
      reachableFromScene: source.reachableFromScene
    };
  });
}

function buildZoneRecords(layoutId, layout, json, inventory, hierarchy) {
  const hierarchyByIndex = new Map(hierarchy.map((record) => [record.nodeIndex, record]));
  const meshByIndex = new Map(inventory.meshes.map((record) => [record.index, record]));
  const accessorByIndex = new Map(inventory.accessors.map((record) => [record.index, record]));
  const fireplaceByBinding = new Map(existingFireplaceAudit.records.map((record) => [
    `${record.nodeIndex}/${record.meshIndex}/${record.primitiveIndex}`,
    record
  ]));
  const records = [];
  for (const node of inventory.nodes) {
    if (!node.reachableFromScene || !Number.isInteger(node.mesh)) continue;
    const hierarchyRecord = hierarchyByIndex.get(node.index);
    const mesh = meshByIndex.get(node.mesh);
    for (const primitive of mesh.primitives) {
      const binding = `${node.index}/${node.mesh}/${primitive.index}`;
      const fireplace = layoutId === "fireplace-wall" ? fireplaceByBinding.get(binding) : null;
      const policy = fireplace
        ? {
            status: fireplace.semantic.status,
            zone: fireplace.semantic.zone,
            evidence: fireplace.semantic.evidence,
            finishTarget: fireplace.finishTarget
          }
        : policies[layoutId]?.[primitive.material];
      assert(policy, `${layoutId} missing explicit zone policy for ${binding} material ${primitive.material}`);
      const accessors = {
        indices: Number.isInteger(primitive.indices) ? accessorProof(primitive.indices, accessorByIndex) : null,
        attributes: Object.fromEntries(Object.entries(primitive.attributes).map(([name, index]) => [name, accessorProof(index, accessorByIndex)]))
      };
      records.push({
        stablePrimitiveId: `scene:${inventory.defaultScene}/nodes:${hierarchyRecord.nodeIndexPath.join("/")}/mesh:${node.mesh}/primitive:${primitive.index}`,
        sceneIndex: inventory.defaultScene,
        nodeIndexPath: hierarchyRecord.nodeIndexPath,
        observedNamePath: hierarchyRecord.observedNamePath,
        nodeIndex: node.index,
        meshIndex: node.mesh,
        primitiveIndex: primitive.index,
        sourceMaterialIndex: primitive.material,
        sourceMaterialName: json.materials?.[primitive.material]?.name || null,
        sourceAccessors: accessors,
        worldBounds: node.worldBounds,
        zone: policy.zone,
        status: policy.status,
        finishTarget: policy.finishTarget === true,
        evidence: policy.evidence,
        permittedRuntimeMapping: policy.finishTarget === true ? "room2-commercial-pbr-v1 exact audited allowlist" : null,
        unresolved: policy.status === "PROVISIONAL"
          ? "Semantic surface type is plausible, but automatic finish authority is not accepted for this exact source slot."
          : null
      });
    }
  }
  const targetMatches = records.filter((record) => record.nodeIndex === layout.semanticManifest.targetMeshNodeIndex
    && record.meshIndex === layout.semanticManifest.targetMeshIndex
    && record.primitiveIndex === layout.semanticManifest.targetPrimitiveIndex);
  assert(targetMatches.length === 1, `${layoutId} smart-dimension target is not uniquely represented in zone matrix`);
  return records.sort((left, right) => left.stablePrimitiveId.localeCompare(right.stablePrimitiveId, "en", { numeric: true }));
}

function accessorProof(index, accessorByIndex) {
  const record = accessorByIndex.get(index);
  assert(record, `missing accessor proof ${index}`);
  return {
    accessorIndex: index,
    componentType: record.componentType,
    count: record.count,
    type: record.type,
    dataSha256: record.dataSha256
  };
}

function accessorBindings(bindings, inventory) {
  const byIndex = new Map(inventory.accessors.map((record) => [record.index, record]));
  return Object.fromEntries(Object.entries(bindings).map(([name, index]) => [name, accessorProof(index, byIndex)]));
}

function deriveShelfClearanceControl(layoutId, layout, inventory, hierarchy) {
  const semantic = layout.semanticManifest;
  const nodes = inventory.nodes;
  const meshes = inventory.meshes;
  const bindShelf = (role, nodeIndex, meshNodeIndex, meshIndex) => {
    const wrapper = nodes[nodeIndex];
    const meshNode = nodes[meshNodeIndex];
    assert(wrapper?.index === nodeIndex, `${layoutId} missing ${role} wrapper node`);
    assert(meshNode?.index === meshNodeIndex, `${layoutId} missing ${role} mesh node`);
    assert(hierarchy[meshNodeIndex]?.parentIndex === nodeIndex, `${layoutId} ${role} mesh is not a direct child of its wrapper`);
    assert(meshNode.mesh === meshIndex, `${layoutId} ${role} mesh binding changed`);
    assert(wrapper.reachableFromScene && meshNode.reachableFromScene, `${layoutId} ${role} is not scene-reachable`);
    assertFiniteBounds(meshNode.worldBounds, `${layoutId} ${role} world bounds`);
    assert(meshes[meshIndex]?.primitives?.length === 1, `${layoutId} ${role} must remain one whole-mesh primitive`);
    return { wrapper, meshNode, mesh: meshes[meshIndex], worldBounds: meshNode.worldBounds };
  };
  const lower = bindShelf("lower anchor", semantic.lowerAnchorNodeIndex, semantic.lowerAnchorMeshNodeIndex, semantic.lowerAnchorMeshIndex);
  const target = bindShelf("target", semantic.targetNodeIndex, semantic.targetMeshNodeIndex, semantic.targetMeshIndex);
  const upper = bindShelf("upper anchor", semantic.upperAnchorNodeIndex, semantic.upperAnchorMeshNodeIndex, semantic.upperAnchorMeshIndex);
  const motionParentNodeIndex = hierarchy[semantic.targetNodeIndex]?.parentIndex;
  assert(Number.isInteger(motionParentNodeIndex), `${layoutId} target has no parent`);
  assert(hierarchy[semantic.lowerAnchorNodeIndex]?.parentIndex === motionParentNodeIndex
    && hierarchy[semantic.upperAnchorNodeIndex]?.parentIndex === motionParentNodeIndex,
  `${layoutId} shelf wrappers do not share one parent coordinate frame`);
  const primitive = target.mesh.primitives[semantic.targetPrimitiveIndex];
  assert(primitive?.material === semantic.targetMaterialIndex, `${layoutId} target material changed`);
  assert(primitive.indices === semantic.targetAccessors.indices, `${layoutId} target index accessor changed`);
  for (const [attribute, accessorIndex] of Object.entries(semantic.targetAccessors)) {
    if (attribute !== "indices") assert(primitive.attributes[attribute] === accessorIndex, `${layoutId} target ${attribute} accessor changed`);
  }
  const nativeTranslationZ = target.wrapper.authoredTransform?.translation?.[2];
  assert(Number.isFinite(nativeTranslationZ), `${layoutId} target native translation.z is invalid`);
  const parentWorld = nodes[motionParentNodeIndex].worldMatrix;
  const parentAxisWorld = [parentWorld[8], parentWorld[9], parentWorld[10]];
  const parentAxisScaleMetersPerLocalUnit = Math.hypot(...parentAxisWorld);
  const signedWorldYPerLocalZ = parentAxisWorld[1];
  assert(parentAxisScaleMetersPerLocalUnit > 0 && signedWorldYPerLocalZ > 1e-12,
    `${layoutId} parent local-Z is incompatible with the positive world-Y control formula`);
  const lowerTop = lower.worldBounds.max[1];
  const targetBottom = target.worldBounds.min[1];
  const targetTop = target.worldBounds.max[1];
  const upperBottom = upper.worldBounds.min[1];
  const thickness = targetTop - targetBottom;
  const nativeClearance = targetBottom - lowerTop;
  const nativeUpperClearance = upperBottom - targetTop;
  const maximumClearance = upperBottom - lowerTop - thickness;
  const sourceEpsilonMeters = 1e-9;
  assert(thickness > sourceEpsilonMeters, `${layoutId} target thickness is not positive`);
  assert(nativeClearance >= -sourceEpsilonMeters && nativeUpperClearance >= -sourceEpsilonMeters,
    `${layoutId} target penetrates a fixed anchor natively`);
  assert(Math.abs(maximumClearance - nativeClearance - nativeUpperClearance) <= sourceEpsilonMeters,
    `${layoutId} finite range identity failed`);
  const maximumLocalTravel = Math.max(nativeClearance, nativeUpperClearance) / signedWorldYPerLocalZ;
  const maximumOffAxisDriftMillimeters = maximumLocalTravel * Math.hypot(parentAxisWorld[0], parentAxisWorld[2]) * 1000;
  assert(maximumOffAxisDriftMillimeters <= 0.25, `${layoutId} parent axis would violate fixed X/Z bounds`);
  return {
    nativeTargetWorldBounds: target.worldBounds,
    nativeTranslationZ,
    motionParentNodeIndex,
    parentAxisWorld,
    parentAxisScaleMetersPerLocalUnit,
    signedWorldYPerLocalZ,
    maximumOffAxisDriftMillimeters,
    nativeTargetBottomMillimeters: targetBottom * 1000,
    targetThicknessMillimeters: thickness * 1000,
    minMillimeters: 0,
    nativeMillimeters: nativeClearance * 1000,
    maxMillimeters: maximumClearance * 1000,
    lowerAnchorTopMillimeters: lowerTop * 1000,
    upperAnchorBottomMillimeters: upperBottom * 1000
  };
}

function validateRegistryControl(layoutId, layout, control, derived) {
  const near = (actual, expected, epsilon, label) => assert(Number.isFinite(actual)
    && Number.isFinite(expected) && Math.abs(actual - expected) <= epsilon,
  `${layoutId} ${label} changed: registry=${actual}, derived=${expected}`);
  for (const key of ["nativeTargetBottomMillimeters", "targetThicknessMillimeters", "minMillimeters", "nativeMillimeters", "maxMillimeters", "lowerAnchorTopMillimeters", "upperAnchorBottomMillimeters"]) {
    near(control[key], derived[key], 1e-6, key);
  }
  near(control.nativeTranslationZ, derived.nativeTranslationZ, 1e-9, "nativeTranslationZ");
  near(control.sourceScaleMetersPerLocalUnit, derived.parentAxisScaleMetersPerLocalUnit, 1e-12, "control source scale");
  near(layout.units.sourceScaleMetersPerLocalUnit, derived.parentAxisScaleMetersPerLocalUnit, 1e-12, "layout source scale");
  for (const key of ["min", "max"]) {
    for (let axis = 0; axis < 3; axis += 1) {
      near(layout.semanticManifest.nativeTargetWorldBounds[key][axis], derived.nativeTargetWorldBounds[key][axis], 1e-9, `nativeTargetWorldBounds.${key}[${axis}]`);
    }
  }
}

function assertFiniteBounds(bounds, label) {
  assert(bounds?.min?.length === 3 && bounds?.max?.length === 3
    && [...bounds.min, ...bounds.max].every(Number.isFinite)
    && bounds.min.every((value, axis) => value <= bounds.max[axis]), `${label} are invalid`);
}

function roundBounds(bounds, digits) {
  return { min: bounds.min.map((value) => round(value, digits)), max: bounds.max.map((value) => round(value, digits)) };
}

function round(value, digits) {
  return Number(Number(value).toFixed(digits));
}

function nodeBinding(nodeIndex, hierarchy, inventory) {
  const hierarchyRecord = hierarchy[nodeIndex];
  const inventoryRecord = inventory.nodes[nodeIndex];
  assert(hierarchyRecord?.nodeIndex === nodeIndex && inventoryRecord?.index === nodeIndex, `missing node binding ${nodeIndex}`);
  return {
    nodeIndex,
    nodeIndexPath: hierarchyRecord.nodeIndexPath,
    observedNamePath: hierarchyRecord.observedNamePath,
    authoredTransform: inventoryRecord.authoredTransform,
    worldBounds: inventoryRecord.worldBounds
  };
}

function descendantIndices(json, rootIndex) {
  const output = new Set();
  const visit = (nodeIndex) => {
    if (output.has(nodeIndex)) return;
    output.add(nodeIndex);
    for (const childIndex of json.nodes?.[nodeIndex]?.children || []) visit(childIndex);
  };
  visit(rootIndex);
  return output;
}

function summarizeZones(records) {
  return {
    primitiveRecords: records.length,
    statusCounts: countBy(records, ({ status }) => status),
    zoneCounts: countBy(records, ({ zone }) => zone),
    finishTargetCount: records.filter(({ finishTarget }) => finishTarget).length,
    unmappedCount: records.filter(({ status }) => !["PROVEN", "PROVISIONAL", "BLOCKED"].includes(status)).length
  };
}

function createGeometryTopologyTransformFingerprintNoMaterial(parsed) {
  const { json, binary } = parsed;
  const hash = createHash("sha256");
  const hierarchy = (json.nodes || []).map((node) => ({
    name: node.name ?? null,
    children: node.children ?? [],
    mesh: node.mesh ?? null,
    matrix: node.matrix ?? null,
    translation: node.translation ?? null,
    rotation: node.rotation ?? null,
    scale: node.scale ?? null
  }));
  const topology = (json.meshes || []).map((mesh) => ({
    primitives: (mesh.primitives || []).map((primitive) => ({
      mode: primitive.mode ?? 4,
      indices: primitive.indices ?? null,
      attributes: primitive.attributes,
      targets: primitive.targets ?? null
    }))
  }));
  hash.update(canonicalStringify({ hierarchy, topology }), "utf8");
  for (let accessorIndex = 0; accessorIndex < (json.accessors || []).length; accessorIndex += 1) {
    const accessor = json.accessors[accessorIndex];
    const view = json.bufferViews?.[accessor.bufferView];
    assert(view && !accessor.sparse, `material-independent fingerprint requires a non-sparse bufferView for accessor ${accessorIndex}`);
    const componentBytes = COMPONENT_BYTES[accessor.componentType];
    const componentCount = TYPE_COMPONENTS[accessor.type];
    assert(componentBytes && componentCount, `unsupported accessor ${accessorIndex} in material-independent fingerprint`);
    const logicalElementBytes = componentBytes * componentCount;
    const stride = view.byteStride || logicalElementBytes;
    const start = (view.byteOffset || 0) + (accessor.byteOffset || 0);
    hash.update(canonicalStringify({
      i: accessorIndex,
      componentType: accessor.componentType,
      type: accessor.type,
      count: accessor.count,
      normalized: accessor.normalized ?? false,
      min: accessor.min ?? null,
      max: accessor.max ?? null
    }), "utf8");
    for (let element = 0; element < accessor.count; element += 1) {
      const elementStart = start + element * stride;
      hash.update(binary.subarray(elementStart, elementStart + logicalElementBytes));
    }
  }
  return hash.digest("hex");
}

function countBy(values, selector) {
  return Object.fromEntries([...values.reduce((map, value) => {
    const key = selector(value);
    map.set(key, (map.get(key) || 0) + 1);
    return map;
  }, new Map()).entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function blocked(zone, evidence) {
  return Object.freeze({ status: "BLOCKED", zone, evidence, finishTarget: false });
}

function provisional(zone, evidence) {
  return Object.freeze({ status: "PROVISIONAL", zone, evidence, finishTarget: false });
}

function numericSort(left, right) {
  return left - right;
}

async function emit(relativePath, contents) {
  if (process.argv.includes("--check")) {
    const existing = await readFile(`${root}/${relativePath}`, "utf8");
    assert(existing === contents, `${relativePath} is stale; regenerate the deterministic immersive audit`);
    return;
  }
  await writeFile(`${root}/${relativePath}`, contents, "utf8");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
