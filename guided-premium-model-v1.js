import * as THREE from "three";
import {
  ROOM2_APPEARANCE_PROFILE,
  resolveRoom2Finish
} from "./guided-room2-appearance.js?v=room2-commercial-pbr-v1-20260817g";
import { PREMIUM_MODEL_V1_CONTRACT } from "./guided-premium-model-v1-contract.js?v=premium-model-v1-20260823a";

const ROLE_MANIFEST_URL = "config/premium-model-v1-roles.json";
const MATERIAL_ROLES = Object.freeze(Object.keys(PREMIUM_MODEL_V1_CONTRACT.roleSurface));
const MATERIAL_ROLE_SET = new Set(MATERIAL_ROLES);
const BEVEL_ROLE_SET = new Set(PREMIUM_MODEL_V1_CONTRACT.bevel.roles);
const SHADOW_CAST_ROLE_SET = new Set(PREMIUM_MODEL_V1_CONTRACT.shadow.castRoles);
const SHADOW_RECEIVE_ROLE_SET = new Set(PREMIUM_MODEL_V1_CONTRACT.shadow.receiveRoles);
const SHADOW_PROTECTED_RECEIVERS = new Set(PREMIUM_MODEL_V1_CONTRACT.shadow.protectedReceivers);
const _roundedNormal = new THREE.Vector3();
const _triangleA = new THREE.Vector3();
const _triangleB = new THREE.Vector3();
const _triangleC = new THREE.Vector3();
const _triangleEdgeAB = new THREE.Vector3();
const _triangleEdgeAC = new THREE.Vector3();
const _triangleCross = new THREE.Vector3();
const _triangleNormal = new THREE.Vector3();

let roleManifestPromise = null;

function loadRoleManifest() {
  if (!roleManifestPromise) {
    roleManifestPromise = fetch(ROLE_MANIFEST_URL, {
      cache: "no-store",
      credentials: "same-origin",
      redirect: "error"
    }).then((response) => {
      if (!response.ok) throw new Error(`Premium model role manifest returned HTTP ${response.status}.`);
      return response.json();
    });
  }
  return roleManifestPromise;
}

function familyContract(familyId) {
  return PREMIUM_MODEL_V1_CONTRACT.textures[familyId]
    || PREMIUM_MODEL_V1_CONTRACT.textures.paint;
}

function finishColor(finish) {
  if (finish.family === "paint") return finish.calibratedMultiplier || finish.swatch;
  const overrides = {
    "white-oak": "#f1ebe2",
    "natural-oak": "#ffffff",
    "light-walnut": "#d1a27c",
    "medium-walnut": "#aa7358",
    "dark-walnut": "#765145"
  };
  return overrides[finish.id] || finish.swatch;
}

function familyRepeat(familyId) {
  if (familyId === "paint") return [8, 8];
  if (familyId === "oak") return [0.5, 0.5];
  return [0.25, 0.25];
}

function maximumAnisotropy(controller) {
  const capability = Number(
    controller.renderer?.capabilities?.getMaxAnisotropy?.()
    ?? controller.renderer?.backend?.getMaxAnisotropy?.()
    ?? controller.renderer?.getMaxAnisotropy?.()
  ) || 1;
  const width = controller.runtime?.getBoundingClientRect?.().width || globalThis.innerWidth || 1280;
  return Math.max(1, Math.min(width < 600 ? 4 : 8, capability));
}

async function loadTexture(controller, path, slot, repeat) {
  if (!path) return null;
  const key = `premium-model-v1:${path}`;
  if (controller.finishTextureCache.has(key)) return controller.finishTextureCache.get(key);
  const texture = await new THREE.TextureLoader().loadAsync(path);
  texture.name = key;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = slot === "map" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.repeat.set(...repeat);
  texture.anisotropy = maximumAnisotropy(controller);
  texture.needsUpdate = true;
  controller.finishTextureCache.set(key, texture);
  controller.ownedTextures.add(texture);
  return texture;
}

async function loadTextureSet(controller, familyId) {
  const family = familyContract(familyId);
  const repeat = familyRepeat(familyId);
  const [map, normalMap, roughnessMap] = await Promise.all([
    loadTexture(controller, family.map, "map", repeat),
    loadTexture(controller, family.normalMap, "normalMap", repeat),
    loadTexture(controller, family.roughnessMap, "roughnessMap", repeat)
  ]);
  return { familyId, family, map, normalMap, roughnessMap };
}

function createCabinetMaterial(role, finish, textures) {
  const surface = PREMIUM_MODEL_V1_CONTRACT.roleSurface[role];
  const material = new THREE.MeshPhysicalMaterial({
    color: finishColor(finish),
    map: textures.map,
    normalMap: textures.normalMap,
    roughnessMap: textures.roughnessMap,
    normalScale: new THREE.Vector2(textures.family.normalScale, textures.family.normalScale),
    roughness: surface.roughness,
    metalness: PREMIUM_MODEL_V1_CONTRACT.material.metalness,
    clearcoat: surface.clearcoat,
    clearcoatRoughness: surface.clearcoatRoughness,
    ior: PREMIUM_MODEL_V1_CONTRACT.material.ior,
    specularIntensity: PREMIUM_MODEL_V1_CONTRACT.material.specularIntensity,
    envMapIntensity: surface.envMapIntensity,
    transparent: false,
    depthWrite: true,
    depthTest: true,
    toneMapped: true
  });
  material.name = `jq-premium-model-v1:${finish.id}:${role}`;
  material.userData = {
    jqPremiumModelV1: true,
    role,
    finishId: finish.id,
    textureFamily: textures.familyId
  };
  return material;
}

function createInteriorMaterial(textures) {
  const material = new THREE.MeshPhysicalMaterial({
    color: "#e0d2bb",
    map: textures.map,
    normalMap: textures.normalMap,
    roughnessMap: textures.roughnessMap,
    normalScale: new THREE.Vector2(0.08, 0.08),
    roughness: 0.92,
    metalness: 0,
    clearcoat: 0.06,
    clearcoatRoughness: 0.55,
    ior: 1.47,
    specularIntensity: 0.36,
    envMapIntensity: 0.8,
    transparent: false,
    depthWrite: true,
    depthTest: true,
    toneMapped: true
  });
  material.name = "jq-premium-model-v1:clear-wood-interior-preview";
  material.userData = { jqPremiumModelV1: true, role: "interior", finishId: null, textureFamily: "oak" };
  return material;
}

function createHardwareMaterial() {
  const recipe = PREMIUM_MODEL_V1_CONTRACT.hardware;
  const material = new THREE.MeshStandardMaterial({
    color: recipe.color,
    metalness: recipe.metalness,
    roughness: recipe.roughness,
    envMapIntensity: recipe.envMapIntensity,
    transparent: false,
    depthWrite: true,
    depthTest: true,
    toneMapped: true
  });
  material.name = "jq-premium-model-v1:hardware";
  material.userData = { jqPremiumModelV1: true, role: "hardware", finishId: null };
  return material;
}

function getRoundedUv(faceDirVector, normal, uvAxis, projectionAxis, radius, sideLength) {
  const totalArcLength = Math.PI * radius / 2;
  const centerLength = Math.max(sideLength - 2 * radius, 0);
  const halfArc = Math.PI / 4;
  _roundedNormal.copy(normal);
  _roundedNormal[projectionAxis] = 0;
  _roundedNormal.normalize();
  const arcUvRatio = 0.5 * totalArcLength / (totalArcLength + centerLength);
  const arcAngleRatio = 1 - _roundedNormal.angleTo(faceDirVector) / halfArc;
  if (Math.sign(_roundedNormal[uvAxis]) === 1) return arcAngleRatio * arcUvRatio;
  const lengthUv = centerLength / (totalArcLength + centerLength);
  return lengthUv + arcUvRatio + arcUvRatio * (1 - arcAngleRatio);
}

class PremiumRoundedBoxGeometry extends THREE.BoxGeometry {
  constructor(width, height, depth, curveSegments, radius) {
    const segments = curveSegments * 2 + 1;
    const safeRadius = Math.min(width / 2, height / 2, depth / 2, radius);
    super(1, 1, 1, segments, segments, segments);
    const nonIndexed = this.toNonIndexed();
    this.index = null;
    this.setAttribute("position", nonIndexed.getAttribute("position"));
    this.setAttribute("normal", nonIndexed.getAttribute("normal"));
    this.setAttribute("uv", nonIndexed.getAttribute("uv"));
    const position = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const faceDirection = new THREE.Vector3();
    const inner = new THREE.Vector3(width, height, depth).divideScalar(2).subScalar(safeRadius);
    const positions = this.getAttribute("position").array;
    const normals = this.getAttribute("normal").array;
    const uvs = this.getAttribute("uv").array;
    const faceTriangles = positions.length / 6;
    const halfSegmentSize = 0.5 / segments;
    for (let index = 0, uvIndex = 0; index < positions.length; index += 3, uvIndex += 2) {
      position.fromArray(positions, index);
      normal.copy(position);
      normal.x -= Math.sign(normal.x) * halfSegmentSize;
      normal.y -= Math.sign(normal.y) * halfSegmentSize;
      normal.z -= Math.sign(normal.z) * halfSegmentSize;
      normal.normalize();
      positions[index] = inner.x * Math.sign(position.x) + normal.x * safeRadius;
      positions[index + 1] = inner.y * Math.sign(position.y) + normal.y * safeRadius;
      positions[index + 2] = inner.z * Math.sign(position.z) + normal.z * safeRadius;
      normals[index] = normal.x;
      normals[index + 1] = normal.y;
      normals[index + 2] = normal.z;
      const side = Math.floor(index / faceTriangles);
      if (side === 0) {
        faceDirection.set(1, 0, 0);
        uvs[uvIndex] = getRoundedUv(faceDirection, normal, "z", "y", safeRadius, depth);
        uvs[uvIndex + 1] = 1 - getRoundedUv(faceDirection, normal, "y", "z", safeRadius, height);
      } else if (side === 1) {
        faceDirection.set(-1, 0, 0);
        uvs[uvIndex] = 1 - getRoundedUv(faceDirection, normal, "z", "y", safeRadius, depth);
        uvs[uvIndex + 1] = 1 - getRoundedUv(faceDirection, normal, "y", "z", safeRadius, height);
      } else if (side === 2) {
        faceDirection.set(0, 1, 0);
        uvs[uvIndex] = 1 - getRoundedUv(faceDirection, normal, "x", "z", safeRadius, width);
        uvs[uvIndex + 1] = getRoundedUv(faceDirection, normal, "z", "x", safeRadius, depth);
      } else if (side === 3) {
        faceDirection.set(0, -1, 0);
        uvs[uvIndex] = 1 - getRoundedUv(faceDirection, normal, "x", "z", safeRadius, width);
        uvs[uvIndex + 1] = 1 - getRoundedUv(faceDirection, normal, "z", "x", safeRadius, depth);
      } else if (side === 4) {
        faceDirection.set(0, 0, 1);
        uvs[uvIndex] = 1 - getRoundedUv(faceDirection, normal, "x", "y", safeRadius, width);
        uvs[uvIndex + 1] = 1 - getRoundedUv(faceDirection, normal, "y", "x", safeRadius, height);
      } else {
        faceDirection.set(0, 0, -1);
        uvs[uvIndex] = getRoundedUv(faceDirection, normal, "x", "y", safeRadius, width);
        uvs[uvIndex + 1] = 1 - getRoundedUv(faceDirection, normal, "y", "x", safeRadius, height);
      }
    }
    this.computeBoundingBox();
    this.computeBoundingSphere();
  }
}

function triangleCount(geometry) {
  const elementCount = geometry.index?.count || geometry.getAttribute("position")?.count || 0;
  return Math.floor(elementCount / 3);
}

function inspectDerivedGeometry(geometry) {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  let degenerateTriangles = 0;
  let wrongWindingTriangles = 0;
  let maximumNormalLengthError = 0;
  for (let vertex = 0; vertex < position.count; vertex += 3) {
    _triangleA.fromBufferAttribute(position, vertex);
    _triangleB.fromBufferAttribute(position, vertex + 1);
    _triangleC.fromBufferAttribute(position, vertex + 2);
    _triangleEdgeAB.subVectors(_triangleB, _triangleA);
    _triangleEdgeAC.subVectors(_triangleC, _triangleA);
    _triangleCross.crossVectors(_triangleEdgeAB, _triangleEdgeAC);
    if (_triangleCross.lengthSq() <= 1e-20) {
      degenerateTriangles += 1;
    } else {
      _triangleNormal.set(0, 0, 0);
      for (let offset = 0; offset < 3; offset += 1) {
        _roundedNormal.fromBufferAttribute(normal, vertex + offset);
        maximumNormalLengthError = Math.max(maximumNormalLengthError, Math.abs(_roundedNormal.length() - 1));
        _triangleNormal.add(_roundedNormal);
      }
      if (_triangleCross.dot(_triangleNormal) <= 0) wrongWindingTriangles += 1;
    }
  }
  return { degenerateTriangles, wrongWindingTriangles, maximumNormalLengthError };
}

function axisAlignedBoxBounds(geometry) {
  if (!geometry || Object.keys(geometry.morphAttributes || {}).length || triangleCount(geometry) !== 12) return null;
  const position = geometry.getAttribute("position");
  if (!position || position.itemSize !== 3 || position.count < 8) return null;
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  const size = bounds.getSize(new THREE.Vector3());
  const maximumDimension = Math.max(size.x, size.y, size.z);
  const tolerance = Math.max(maximumDimension * 1e-5, 1e-6);
  const corners = new Set();
  for (let index = 0; index < position.count; index += 1) {
    const values = [position.getX(index), position.getY(index), position.getZ(index)];
    let key = "";
    for (let axis = 0; axis < 3; axis += 1) {
      const minimum = bounds.min.getComponent(axis);
      const maximum = bounds.max.getComponent(axis);
      const atMinimum = Math.abs(values[axis] - minimum) <= tolerance;
      const atMaximum = Math.abs(values[axis] - maximum) <= tolerance;
      if (!atMinimum && !atMaximum) return null;
      key += atMinimum ? "0" : "1";
    }
    corners.add(key);
  }
  if (corners.size !== 8 || Math.min(size.x, size.y, size.z) <= tolerance * 2) return null;
  return { bounds: bounds.clone(), size, center: bounds.getCenter(new THREE.Vector3()) };
}

function maximumBoxDeltaMillimeters(left, right) {
  return Math.max(
    Math.abs(left.min.x - right.min.x), Math.abs(left.min.y - right.min.y), Math.abs(left.min.z - right.min.z),
    Math.abs(left.max.x - right.max.x), Math.abs(left.max.y - right.max.y), Math.abs(left.max.z - right.max.z)
  ) * 1000;
}

function applyPremiumGeometry(controller, roleById) {
  const changed = [];
  const skipped = { role: 0, topology: 0, scale: 0, bounds: 0 };
  for (const runtimeRecord of controller.meshRecords) {
    const manifestRecord = roleById.get(runtimeRecord.zoneRecord?.stablePrimitiveId);
    if (!manifestRecord || !BEVEL_ROLE_SET.has(manifestRecord.role)) {
      skipped.role += 1;
      continue;
    }
    if (runtimeRecord.object.userData.jqPremiumModelV1Geometry) {
      changed.push(runtimeRecord.object.userData.jqPremiumModelV1Geometry);
      continue;
    }
    const box = axisAlignedBoxBounds(runtimeRecord.object.geometry);
    if (!box) {
      skipped.topology += 1;
      continue;
    }
    runtimeRecord.object.updateWorldMatrix(true, false);
    const worldScale = new THREE.Vector3();
    runtimeRecord.object.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), worldScale);
    worldScale.set(Math.abs(worldScale.x), Math.abs(worldScale.y), Math.abs(worldScale.z));
    const minimumScale = Math.min(worldScale.x, worldScale.y, worldScale.z);
    const maximumScale = Math.max(worldScale.x, worldScale.y, worldScale.z);
    if (!(minimumScale > 0) || maximumScale / minimumScale > PREMIUM_MODEL_V1_CONTRACT.bevel.maximumWorldScaleRatio) {
      skipped.scale += 1;
      continue;
    }
    const sourceWorldBounds = new THREE.Box3().setFromObject(runtimeRecord.object);
    const radius = Math.min(
      PREMIUM_MODEL_V1_CONTRACT.bevel.widthMeters / minimumScale,
      Math.min(box.size.x, box.size.y, box.size.z) * 0.18
    );
    const replacement = new PremiumRoundedBoxGeometry(
      box.size.x,
      box.size.y,
      box.size.z,
      PREMIUM_MODEL_V1_CONTRACT.bevel.curveSegments,
      radius
    );
    replacement.translate(box.center.x, box.center.y, box.center.z);
    replacement.name = `jq-premium-model-v1:${manifestRecord.stablePrimitiveId}`;
    const derivedInspection = inspectDerivedGeometry(replacement);
    if (derivedInspection.degenerateTriangles || derivedInspection.wrongWindingTriangles) {
      replacement.dispose();
      throw new Error(`Premium bevel validation failed for ${manifestRecord.stablePrimitiveId}.`);
    }
    const sourceGeometry = runtimeRecord.object.geometry;
    runtimeRecord.object.geometry = replacement;
    const derivedWorldBounds = new THREE.Box3().setFromObject(runtimeRecord.object);
    const boundsDeltaMillimeters = maximumBoxDeltaMillimeters(sourceWorldBounds, derivedWorldBounds);
    if (boundsDeltaMillimeters > 0.05) {
      runtimeRecord.object.geometry = sourceGeometry;
      replacement.dispose();
      skipped.bounds += 1;
      continue;
    }
    controller.premiumOwnedGeometries.add(replacement);
    const record = Object.freeze({
      stablePrimitiveId: manifestRecord.stablePrimitiveId,
      role: manifestRecord.role,
      sourceTriangles: triangleCount(sourceGeometry),
      derivedTriangles: triangleCount(replacement),
      bevelWidthMillimeters: PREMIUM_MODEL_V1_CONTRACT.bevel.widthMeters * 1000,
      worldBoundsDeltaMillimeters: boundsDeltaMillimeters,
      derivedDegenerateTriangles: derivedInspection.degenerateTriangles,
      wrongWindingTriangles: derivedInspection.wrongWindingTriangles,
      maximumNormalLengthError: derivedInspection.maximumNormalLengthError
    });
    runtimeRecord.object.userData.jqPremiumModelV1Geometry = record;
    changed.push(record);
  }
  return { changed, skipped };
}

function applyPremiumShadows(controller, roleById) {
  const visiblePrimitiveCount = controller.meshRecords.filter(({ object }) => object.visible).length;
  const maximumCasters = Math.max(
    0,
    PREMIUM_MODEL_V1_CONTRACT.shadow.maximumDrawCalls
      - PREMIUM_MODEL_V1_CONTRACT.shadow.reservedHeadroom
      - visiblePrimitiveCount
  );
  const priority = new Map(PREMIUM_MODEL_V1_CONTRACT.shadow.priority.map((role, index) => [role, index]));
  const candidates = [];
  for (const runtimeRecord of controller.meshRecords) {
    const manifestRecord = roleById.get(runtimeRecord.zoneRecord?.stablePrimitiveId);
    if (!manifestRecord) continue;
    runtimeRecord.object.castShadow = false;
    runtimeRecord.object.receiveShadow = SHADOW_RECEIVE_ROLE_SET.has(manifestRecord.role)
      || SHADOW_PROTECTED_RECEIVERS.has(manifestRecord.originalZone);
    if (controller.shadowRenderingEnabled && SHADOW_CAST_ROLE_SET.has(manifestRecord.role) && runtimeRecord.object.visible) {
      const size = manifestRecord.worldBounds.size;
      const surfaceArea = 2 * (size[0] * size[1] + size[0] * size[2] + size[1] * size[2]);
      candidates.push({ runtimeRecord, manifestRecord, surfaceArea });
    }
  }
  candidates.sort((left, right) => (
    (priority.get(left.manifestRecord.role) ?? 99) - (priority.get(right.manifestRecord.role) ?? 99)
    || right.surfaceArea - left.surfaceArea
    || left.manifestRecord.stablePrimitiveId.localeCompare(right.manifestRecord.stablePrimitiveId)
  ));
  const selected = candidates.slice(0, maximumCasters);
  for (const { runtimeRecord } of selected) runtimeRecord.object.castShadow = true;
  controller.shadowPrimitiveBudget = Object.freeze({
    drawCallLimit: PREMIUM_MODEL_V1_CONTRACT.shadow.maximumDrawCalls,
    reservedHeadroom: PREMIUM_MODEL_V1_CONTRACT.shadow.reservedHeadroom,
    visiblePrimitiveCount,
    eligiblePremiumPrimitiveCount: candidates.length,
    selectedShadowPrimitiveCount: selected.length,
    projectedMaximumDrawCalls: visiblePrimitiveCount + selected.length,
    selection: "premium role priority, audited world-bound surface area, stable primitive ID",
    exactRoleManifest: true
  });
  controller.requestShadowRefresh();
  return controller.shadowPrimitiveBudget;
}

export async function applyPremiumModelV1(controller) {
  if (!controller?.modelRoot || !controller.layoutId || !controller.meshRecords.length) {
    throw new Error("Premium model V1 requires a verified loaded layout.");
  }
  const manifest = await loadRoleManifest();
  const layout = manifest.layouts.find(({ layoutId }) => layoutId === controller.layoutId);
  if (!layout || layout.records.length !== controller.meshRecords.length) {
    throw new Error(`Premium model role coverage differs from ${controller.layoutId}.`);
  }
  const roleById = new Map(layout.records.map((record) => [record.stablePrimitiveId, record]));
  for (const runtimeRecord of controller.meshRecords) {
    const stablePrimitiveId = runtimeRecord.zoneRecord?.stablePrimitiveId;
    const record = roleById.get(stablePrimitiveId);
    if (!record
      || record.nodeIndex !== runtimeRecord.nodeIndex
      || record.meshIndex !== runtimeRecord.meshIndex
      || record.primitiveIndex !== runtimeRecord.primitiveIndex) {
      throw new Error(`Premium model stable primitive binding failed for ${stablePrimitiveId || "unknown"}.`);
    }
  }

  const finish = resolveRoom2Finish(controller.requestedFinishId);
  const exteriorTextures = await loadTextureSet(controller, finish.family);
  const interiorTextures = finish.family === "oak" ? exteriorTextures : await loadTextureSet(controller, "oak");
  const geometry = applyPremiumGeometry(controller, roleById);

  controller.disposeActiveFinishMaterials();
  const materials = new Map();
  for (const role of MATERIAL_ROLES) {
    const material = createCabinetMaterial(role, finish, exteriorTextures);
    materials.set(role, material);
    controller.ownedMaterials.add(material);
  }
  const interiorMaterial = createInteriorMaterial(interiorTextures);
  const hardwareMaterial = createHardwareMaterial();
  controller.ownedMaterials.add(interiorMaterial);
  controller.ownedMaterials.add(hardwareMaterial);

  let appliedPrimitiveCount = 0;
  for (const runtimeRecord of controller.meshRecords) {
    const manifestRecord = roleById.get(runtimeRecord.zoneRecord.stablePrimitiveId);
    if (MATERIAL_ROLE_SET.has(manifestRecord.role)) {
      runtimeRecord.object.material = materials.get(manifestRecord.role);
      appliedPrimitiveCount += 1;
    } else if (manifestRecord.role === "interior") {
      runtimeRecord.object.material = interiorMaterial;
      appliedPrimitiveCount += 1;
    } else if (manifestRecord.role === "hardware") {
      runtimeRecord.object.material = hardwareMaterial;
      appliedPrimitiveCount += 1;
    }
    runtimeRecord.object.userData.jqPremiumModelV1Role = manifestRecord.role;
  }
  const shadowBudget = applyPremiumShadows(controller, roleById);
  controller.appliedFinishId = finish.id;
  controller.scheduleRender();
  return Object.freeze({
    schema: PREMIUM_MODEL_V1_CONTRACT.schema,
    status: PREMIUM_MODEL_V1_CONTRACT.status,
    layoutId: controller.layoutId,
    finishId: finish.id,
    finishFamily: finish.family,
    exactPrimitiveCoverage: roleById.size,
    sourcePrimitiveCount: controller.meshRecords.length,
    premiumMaterialPrimitiveCount: appliedPrimitiveCount,
    sharedMaterialCount: materials.size + 2,
    materialType: PREMIUM_MODEL_V1_CONTRACT.material.type,
    texturePaths: [
      exteriorTextures.family.map,
      exteriorTextures.family.normalMap,
      exteriorTextures.family.roughnessMap
    ].filter(Boolean),
    geometry: Object.freeze({
      sourceAssetsModified: false,
      runtimeBevelWidthMillimeters: PREMIUM_MODEL_V1_CONTRACT.bevel.widthMeters * 1000,
      runtimeBeveledPrimitiveCount: geometry.changed.length,
      runtimeBeveledStablePrimitiveIds: geometry.changed.map(({ stablePrimitiveId }) => stablePrimitiveId),
      triangleDelta: geometry.changed.reduce((sum, record) => sum + record.derivedTriangles - record.sourceTriangles, 0),
      derivedDegenerateTriangles: geometry.changed.reduce((sum, record) => sum + record.derivedDegenerateTriangles, 0),
      wrongWindingTriangles: geometry.changed.reduce((sum, record) => sum + record.wrongWindingTriangles, 0),
      maximumNormalLengthError: Math.max(0, ...geometry.changed.map(({ maximumNormalLengthError }) => maximumNormalLengthError)),
      maximumWorldBoundsDeltaMillimeters: Math.max(0, ...geometry.changed.map(({ worldBoundsDeltaMillimeters }) => worldBoundsDeltaMillimeters)),
      skipped: geometry.skipped
    }),
    shadowBudget,
    protectedRoles: Object.freeze([
      "room-shell", "floor", "fireplace", "architectural-opening",
      "architectural-opening-detail", "architectural-hardware",
      "architectural-glazing", "support-hardware", "protected-unclassified"
    ]),
    sharedLightingProfileUnchanged: true,
    interfaceModified: false
  });
}
