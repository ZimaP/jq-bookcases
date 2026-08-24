import * as THREE from "three";
import {
  ROOM2_APPEARANCE_PROFILE,
  resolveRoom2Finish
} from "./guided-room2-appearance.js?v=room2-commercial-pbr-v1-20260817g";
import { PREMIUM_MODEL_V1_CONTRACT } from "./guided-premium-model-v1-contract.js?v=finish-premium-production-v1-20260824a";

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
  if (finish.family === "paint") {
    return PREMIUM_MODEL_V1_CONTRACT.textures.paint.finishMultipliers?.[finish.id]
      || finish.calibratedMultiplier
      || finish.swatch;
  }
  const overrides = {
    "white-oak": "#fbfaf6",
    "natural-oak": "#fff2e2",
    ...PREMIUM_MODEL_V1_CONTRACT.textures[finish.family]?.finishMultipliers
  };
  return overrides[finish.id] || finish.swatch;
}

function familyRepeat(familyId) {
  const configured = familyContract(familyId).repeat;
  if (Array.isArray(configured) && configured.length === 2) return configured;
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

async function loadTexture(controller, path, slot, repeat, revision = "") {
  if (!path) return null;
  const requestPath = revision ? `${path}?v=${encodeURIComponent(revision)}` : path;
  const key = `premium-model-v1:${requestPath}`;
  if (controller.finishTextureCache.has(key)) return controller.finishTextureCache.get(key);
  const texture = await new THREE.TextureLoader().loadAsync(requestPath);
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
    loadTexture(controller, family.map, "map", repeat, family.revision),
    loadTexture(controller, family.normalMap, "normalMap", repeat, family.revision),
    loadTexture(controller, family.roughnessMap, "roughnessMap", repeat, family.revision)
  ]);
  return { familyId, family, map, normalMap, roughnessMap };
}

function createCabinetMaterial(role, finish, textures) {
  const surface = PREMIUM_MODEL_V1_CONTRACT.roleSurface[role];
  const familySurface = PREMIUM_MODEL_V1_CONTRACT.familySurface[textures.familyId]
    || PREMIUM_MODEL_V1_CONTRACT.familySurface.paint;
  const clearcoatNormalScale = Number(textures.family.clearcoatNormalScale) || 0;
  const material = new THREE.MeshPhysicalMaterial({
    color: finishColor(finish),
    map: textures.map,
    normalMap: textures.normalMap,
    roughnessMap: textures.roughnessMap,
    normalScale: new THREE.Vector2(textures.family.normalScale, textures.family.normalScale),
    roughness: surface.roughness * familySurface.roughnessScale,
    metalness: PREMIUM_MODEL_V1_CONTRACT.material.metalness,
    clearcoat: surface.clearcoat * familySurface.clearcoatScale,
    clearcoatRoughness: Math.max(surface.clearcoatRoughness, familySurface.clearcoatRoughnessFloor),
    clearcoatRoughnessMap: clearcoatNormalScale > 0 ? textures.roughnessMap : null,
    clearcoatNormalMap: clearcoatNormalScale > 0 ? textures.normalMap : null,
    clearcoatNormalScale: new THREE.Vector2(clearcoatNormalScale, clearcoatNormalScale),
    ior: PREMIUM_MODEL_V1_CONTRACT.material.ior,
    specularIntensity: familySurface.specularIntensity,
    envMapIntensity: surface.envMapIntensity * familySurface.envMapIntensityScale,
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

function stableHash(value, salt) {
  let hash = 2166136261 ^ salt;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stableUnitInterval(value, salt) {
  return stableHash(value, salt) / 4294967296;
}

function uvAttributeFingerprint(attribute) {
  let hash = 2166136261;
  for (let index = 0; index < attribute.array.length; index += 1) {
    hash ^= Math.round(attribute.array[index] * 1e6);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function dominantAxis(vector) {
  const values = [Math.abs(vector.x), Math.abs(vector.y), Math.abs(vector.z)];
  return values.indexOf(Math.max(...values));
}

function physicalGrainAxis(object, geometry, role) {
  geometry.computeBoundingBox();
  const localSize = geometry.boundingBox.getSize(new THREE.Vector3());
  object.updateWorldMatrix(true, false);
  const worldScale = new THREE.Vector3();
  object.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), worldScale);
  worldScale.set(Math.abs(worldScale.x), Math.abs(worldScale.y), Math.abs(worldScale.z));
  const sizes = [localSize.x * worldScale.x, localSize.y * worldScale.y, localSize.z * worldScale.z];
  const directions = [
    new THREE.Vector3().setFromMatrixColumn(object.matrixWorld, 0).normalize(),
    new THREE.Vector3().setFromMatrixColumn(object.matrixWorld, 1).normalize(),
    new THREE.Vector3().setFromMatrixColumn(object.matrixWorld, 2).normalize()
  ];
  const verticalAxis = directions
    .map((direction, axis) => ({ axis, alignment: Math.abs(direction.y) }))
    .sort((left, right) => right.alignment - left.alignment)[0].axis;
  const verticalRoles = new Set(["door-detail", "back", "frame-stile", "filler-end", "interior"]);
  if (verticalRoles.has(role)) return { axis: verticalAxis, sizes, worldScale };
  const horizontalAxes = [0, 1, 2].filter((axis) => axis !== verticalAxis);
  horizontalAxes.sort((left, right) => sizes[right] - sizes[left]);
  return { axis: horizontalAxes[0], sizes, worldScale };
}

function applyPremiumUvMapping(controller, roleById, finishFamily) {
  let projectedPrimitiveCount = 0;
  let restoredPrimitiveCount = 0;
  const mappedStablePrimitiveIds = [];
  const mappedFingerprints = [];
  for (const runtimeRecord of controller.meshRecords) {
    const manifestRecord = roleById.get(runtimeRecord.zoneRecord?.stablePrimitiveId);
    if (!manifestRecord || (!MATERIAL_ROLE_SET.has(manifestRecord.role) && manifestRecord.role !== "interior")) continue;
    const projectedFamilyId = manifestRecord.role === "interior"
      ? "oak"
      : (["oak", "walnut"].includes(finishFamily) ? finishFamily : null);
    const object = runtimeRecord.object;
    let geometry = object.geometry;
    const existingUv = geometry?.getAttribute?.("uv");
    const position = geometry?.getAttribute?.("position");
    const normal = geometry?.getAttribute?.("normal");
    if (!existingUv || !position || !normal || existingUv.count !== position.count) continue;

    if (!object.userData.jqPremiumModelV1UvSource) {
      if (!object.userData.jqPremiumModelV1Geometry) {
        const sourceGeometry = geometry;
        geometry = sourceGeometry.clone();
        object.geometry = geometry;
        controller.premiumOwnedGeometries.add(sourceGeometry);
        controller.premiumOwnedGeometries.add(geometry);
      }
      object.userData.jqPremiumModelV1UvSource = new Float32Array(geometry.getAttribute("uv").array);
    }
    const uv = geometry.getAttribute("uv");
    uv.array.set(object.userData.jqPremiumModelV1UvSource);
    restoredPrimitiveCount += 1;
    if (!projectedFamilyId) {
      uv.needsUpdate = true;
      continue;
    }

    const family = PREMIUM_MODEL_V1_CONTRACT.textures[projectedFamilyId];
    const projectionPeriod = family.projectionPeriodMeters || [
      family.sourceTileMeters?.[0] || 1,
      family.sourceTileMeters?.[1] || 1
    ];
    const grain = physicalGrainAxis(object, geometry, manifestRecord.role);
    const offsetU = stableUnitInterval(manifestRecord.stablePrimitiveId, 0x9e3779b9);
    const offsetV = stableUnitInterval(manifestRecord.stablePrimitiveId, 0x85ebca6b);
    const localPosition = new THREE.Vector3();
    const localNormal = new THREE.Vector3();
    for (let vertex = 0; vertex < position.count; vertex += 1) {
      localPosition.fromBufferAttribute(position, vertex);
      localNormal.fromBufferAttribute(normal, vertex);
      const normalAxis = dominantAxis(localNormal);
      let grainAxis = grain.axis;
      if (grainAxis === normalAxis) {
        grainAxis = [0, 1, 2]
          .filter((axis) => axis !== normalAxis)
          .sort((left, right) => grain.sizes[right] - grain.sizes[left])[0];
      }
      const crossAxis = [0, 1, 2].find((axis) => axis !== normalAxis && axis !== grainAxis);
      const crossMeters = localPosition.getComponent(crossAxis) * grain.worldScale.getComponent(crossAxis);
      const grainMeters = localPosition.getComponent(grainAxis) * grain.worldScale.getComponent(grainAxis);
      const crossUv = crossMeters / projectionPeriod[0];
      const grainUv = grainMeters / projectionPeriod[1];
      if (family.grainTextureAxis === "u") {
        uv.setXY(vertex, grainUv + offsetU, crossUv + offsetV);
      } else {
        uv.setXY(vertex, crossUv + offsetU, grainUv + offsetV);
      }
    }
    uv.needsUpdate = true;
    object.userData.jqPremiumModelV1UvProjection = Object.freeze({
      family: projectedFamilyId,
      method: family.uvProjection,
      stableOffset: Object.freeze([offsetU, offsetV])
    });
    projectedPrimitiveCount += 1;
    mappedStablePrimitiveIds.push(manifestRecord.stablePrimitiveId);
    mappedFingerprints.push(`${manifestRecord.stablePrimitiveId}:${uvAttributeFingerprint(uv)}`);
  }
  return Object.freeze({
    family: finishFamily,
    method: PREMIUM_MODEL_V1_CONTRACT.textures[finishFamily]?.uvProjection
      || PREMIUM_MODEL_V1_CONTRACT.textures.oak.uvProjection,
    projectedPrimitiveCount,
    restoredPrimitiveCount,
    mappedStablePrimitiveIds: Object.freeze(mappedStablePrimitiveIds),
    mappingFingerprintFNV1a32: mappedFingerprints.length
      ? stableHash(mappedFingerprints.join("|"), 0xc2b2ae35).toString(16).padStart(8, "0")
      : null
  });
}

function applyPremiumLighting(controller) {
  const recipe = PREMIUM_MODEL_V1_CONTRACT.lighting;
  const profile = ROOM2_APPEARANCE_PROFILE.lighting;
  controller.renderer.toneMapping = THREE.NeutralToneMapping;
  controller.renderer.toneMappingExposure = recipe.exposure;
  controller.scene.environmentIntensity = recipe.environmentIntensity;
  controller.scene.environmentRotation.set(0, recipe.environmentRotationRadians, 0);

  const keyArea = controller.directLights.get("key-area");
  const fillArea = controller.directLights.get("fill-area");
  const separationArea = controller.directLights.get("separation-area");
  const shadowProxy = controller.directLights.get("key-shadow-proxy");
  const target = new THREE.Vector3(...controller.layout.orbitTarget);
  const profileTarget = new THREE.Vector3(...ROOM2_APPEARANCE_PROFILE.bounds.hero.center);
  const layoutOffset = target.clone().sub(profileTarget);
  const configureArea = (light, definition, intensity) => {
    if (!light) return;
    light.intensity = intensity;
    light.width = definition.width;
    light.height = definition.height;
    light.position.fromArray(definition.position).add(layoutOffset);
    light.lookAt(target);
  };
  configureArea(keyArea, recipe.keyArea, profile.key.area.intensity * recipe.keyAreaScale);
  configureArea(fillArea, recipe.fillArea, profile.fill.area.intensity * recipe.fillAreaScale);
  configureArea(separationArea, recipe.separationArea, profile.separation.area.intensity * recipe.separationAreaScale);
  if (shadowProxy) {
    shadowProxy.intensity = profile.key.shadowProxy.intensity * recipe.shadowProxyScale;
    shadowProxy.position.fromArray(recipe.shadowProxy.position).add(layoutOffset);
    shadowProxy.target.position.copy(target);
    shadowProxy.shadow.bias = recipe.shadowBias;
    shadowProxy.shadow.normalBias = recipe.shadowNormalBias;
  }
  controller.requestShadowRefresh();
  return Object.freeze({
    sharedAcrossLayouts: true,
    toneMapping: recipe.toneMapping,
    exposure: recipe.exposure,
    environmentIntensity: recipe.environmentIntensity,
    environmentRotationRadians: recipe.environmentRotationRadians,
    keyAreaIntensity: keyArea?.intensity ?? null,
    fillAreaIntensity: fillArea?.intensity ?? null,
    separationAreaIntensity: separationArea?.intensity ?? null,
    shadowProxyIntensity: shadowProxy?.intensity ?? null,
    shadowBias: shadowProxy?.shadow.bias ?? null,
    shadowNormalBias: shadowProxy?.shadow.normalBias ?? null
  });
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
  const uvMapping = applyPremiumUvMapping(controller, roleById, finish.family);
  const lighting = applyPremiumLighting(controller);

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
  const roleResponses = Object.freeze(Object.fromEntries([...materials].map(([role, material]) => [role, Object.freeze({
    roughness: material.roughness,
    clearcoat: material.clearcoat,
    clearcoatRoughness: material.clearcoatRoughness,
    envMapIntensity: material.envMapIntensity,
    specularIntensity: material.specularIntensity
  })])));
  const materialResponse = Object.freeze({
    policy: "bounded satin highlights retain edge and panel-line visibility through orbit",
    family: finish.family,
    finishId: finish.id,
    maximumClearcoat: Math.max(...Object.values(roleResponses).map(({ clearcoat }) => clearcoat)),
    minimumClearcoatRoughness: Math.min(...Object.values(roleResponses).map(({ clearcoatRoughness }) => clearcoatRoughness)),
    maximumEnvMapIntensity: Math.max(...Object.values(roleResponses).map(({ envMapIntensity }) => envMapIntensity)),
    maximumSpecularIntensity: Math.max(...Object.values(roleResponses).map(({ specularIntensity }) => specularIntensity)),
    roleResponses
  });

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
    materialResponse,
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
    uvMapping,
    shadowBudget,
    lighting,
    protectedRoles: Object.freeze([
      "room-shell", "floor", "fireplace", "architectural-opening",
      "architectural-opening-detail", "architectural-hardware",
      "architectural-glazing", "support-hardware", "protected-unclassified"
    ]),
    sharedLightingProfileUnchanged: false,
    sharedLightingOverrideApplied: true,
    interfaceModified: false
  });
}
