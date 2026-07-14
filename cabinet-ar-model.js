import { hashCabinetArConfiguration, inchesToMeters } from "./cabinet-ar.js?v=configurator-construction-20260714b";
import {
  getHardwareFinish,
  getHardwareFinishOption,
  getHardwareType
} from "./bookcase-config.js?v=configurator-construction-20260714b";

const NON_RENDERED_ROLES = new Set(["assembly", "section", "section_group", "opening"]);
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
    const envelope = getArDescriptorEnvelope(component, cabinetDepth);
    if (!envelope) return;
    const { center, size } = envelope;
    if (component.role === "door" || component.role === "drawer_front") {
      const parts = createArFrontProfileParts(component, center, size);
      assertPartsWithinDescriptorEnvelope(component, center, size, parts);
      parts.forEach((part) => {
        appendGeometryPart(groups.get(part.material) || groups.get("finish"), part);
      });
      return;
    }
    if (component.role === "handle") {
      const parts = createArHandleGeometryParts(component, center, size);
      assertPartsWithinDescriptorEnvelope(component, center, size, parts);
      parts.forEach((part) => {
        appendGeometryPart(groups.get("hardware"), part);
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
      ...(material.emissive ? { emissiveFactor: material.emissive } : {}),
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
      hardwareVariant: configuration.hardwareId,
      constructionProfile: configuration.constructionProfileId,
      doorLeafCount: configuration.doorLeafCount ?? configuration.doorCount,
      geometryContract: {
        fronts: "descriptor-profile-geometry",
        hardware: "descriptor-hardware-geometry",
        lights: "descriptor-light-geometry"
      }
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
  const light = lightColorForWarmth(configuration.lightingWarmthKelvin);
  return [
    { name: "finish", color: finish, metallic: 0, roughness: 0.68, alpha: 1 },
    { name: "back", color: darken(finish, 0.9), metallic: 0, roughness: 0.8, alpha: 1 },
    { name: "hardware", color: hardware, metallic: hardwareMetadata.metalness, roughness: hardwareMetadata.roughness, alpha: 1 },
    { name: "shadow", color: [0.021, 0.016, 0.012, 1], metallic: 0, roughness: 0.92, alpha: 1 },
    { name: "glass", color: [0.78, 0.86, 0.9, 0.2], metallic: 0, roughness: 0.12, alpha: 0.2 },
    { name: "light", color: light, emissive: light.slice(0, 3), metallic: 0, roughness: 0.32, alpha: 1 }
  ];
}

/**
 * Convert the authoritative descriptor bounds into the procedural AR scene.
 *
 * Layout descriptors round each bound once, then expose convenience `size`
 * and `position` fields that are rounded independently. Reconstructing an AR
 * envelope from those convenience fields can move a profile region a few
 * millionths of an inch outside its bounds. The GLB therefore consumes only
 * the layout-owned bounds for both dimensions and center coordinates.
 */
export function getArDescriptorEnvelope(component, cabinetDepthMeters) {
  const minimum = component?.bounds?.min;
  const maximum = component?.bounds?.max;
  const bounds = [
    Number(minimum?.x), Number(maximum?.x),
    Number(minimum?.y), Number(maximum?.y),
    Number(minimum?.z), Number(maximum?.z)
  ];
  const depth = Number(cabinetDepthMeters);
  if (!bounds.every(Number.isFinite) || !Number.isFinite(depth) || depth <= 0) return null;
  if (maximum.x <= minimum.x || maximum.y <= minimum.y || maximum.z <= minimum.z) return null;

  const size = [
    coordinateInchesToMeters(maximum.x - minimum.x),
    coordinateInchesToMeters(maximum.y - minimum.y),
    coordinateInchesToMeters(maximum.z - minimum.z)
  ];
  const center = [
    coordinateInchesToMeters((minimum.x + maximum.x) / 2),
    coordinateInchesToMeters((minimum.y + maximum.y) / 2),
    depth / 2 - coordinateInchesToMeters((minimum.z + maximum.z) / 2)
  ];
  return { center, size };
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
  const profile = component?.metadata?.profileGeometry;
  const slab = [{
    kind: "slab",
    shape: "box",
    material: "finish",
    center: [x, y, z],
    size: [width, height, depth]
  }];
  if (style === "flat" || profile?.kind === "slab") return slab;
  if (!profile?.valid || !Number.isFinite(Number(profile.frameWidth)) || Number(profile.frameWidth) <= 0) {
    return [];
  }

  const frameWidth = positiveInchesToMeters(profile.frameWidth);
  const frameDepth = clamp(positiveInchesToMeters(profile.frameDepth), 0.0001, depth);
  const panelRecess = clamp(nonNegativeInchesToMeters(profile.panelRecess), 0, Math.max(0, depth - 0.0001));
  const panelDepth = clamp(
    positiveInchesToMeters(profile.panelDepth),
    0.0001,
    Math.max(0.0001, depth - panelRecess)
  );
  if (![frameWidth, frameDepth, panelRecess, panelDepth].every(Number.isFinite)) return [];

  const outward = getArOutwardDirection(component);
  const visibleFrontZ = z + outward * depth / 2;
  const frameZ = visibleFrontZ - outward * frameDepth / 2;
  const panelZ = visibleFrontZ - outward * (panelRecess + panelDepth / 2);
  const descriptorCenter = getDescriptorCenterInches(component);
  const solidRegions = Array.isArray(profile.solidRegions) && profile.solidRegions.length
    ? profile.solidRegions
    : [];
  if (solidRegions.length !== 4) return [];
  const parts = solidRegions.flatMap((region) => {
    const rectangle = arRectangleForProfileRegion(region, component, descriptorCenter, [x, y]);
    if (!rectangle) return [];
    return [{
      kind: region.id || "frame",
      shape: "box",
      material: "finish",
      center: [rectangle.center[0], rectangle.center[1], frameZ],
      size: [rectangle.size[0], rectangle.size[1], frameDepth]
    }];
  });

  const field = profile.fieldRegion;
  const fieldRectangle = arRectangleForProfileRegion(field, component, descriptorCenter, [x, y]);
  if (!fieldRectangle || !parts.length) return [];
  const renderGlassField = field.kind === "glass" && component?.role !== "drawer_front";
  parts.push({
    kind: renderGlassField ? "glass_field" : "inset_panel",
    shape: "box",
    material: renderGlassField ? "glass" : "finish",
    center: [fieldRectangle.center[0], fieldRectangle.center[1], panelZ],
    size: [fieldRectangle.size[0], fieldRectangle.size[1], panelDepth]
  });
  return parts.every(isPositiveGeometryPart) ? parts : [];
}

/**
 * Build explicit knob/pull geometry from the layout-owned hardware catalog
 * metadata. Returned cylinders/ellipsoids remain inside the descriptor box;
 * the GLB writer never stretches an arbitrary handle bounding box into a part.
 */
export function createArHandleGeometryParts(component, center, size) {
  if (
    component?.role !== "handle"
    || !Array.isArray(center)
    || center.length !== 3
    || !Array.isArray(size)
    || size.length !== 3
  ) return [];
  const envelope = size.map(Number);
  if (!envelope.every((value) => Number.isFinite(value) && value > 0)) return [];
  const origin = center.map(Number);
  if (!origin.every(Number.isFinite)) return [];

  const metadata = component.metadata || {};
  const declared = metadata.visualDimensions;
  if (!declared || ![declared.x, declared.y, declared.z].every((value) => Number.isFinite(Number(value)) && Number(value) > 0)) {
    return [];
  }
  const declaredMeters = [declared.x, declared.y, declared.z].map(positiveInchesToMeters);
  const visual = declaredMeters.map((value, axis) => Math.min(value, envelope[axis]));
  const declaredProjection = positiveInchesToMeters(metadata.projection);
  if (!Number.isFinite(declaredProjection)) return [];
  visual[2] = Math.min(visual[2], declaredProjection, envelope[2]);
  const hardwareType = metadata.hardwareType || getHardwareType(metadata.hardware);
  const outward = metadata.attachment?.componentFace === "min" ? -1 : 1;
  const mountingZ = origin[2] - outward * envelope[2] / 2;
  const outerZ = origin[2] + outward * envelope[2] / 2;

  if (hardwareType === "pull") {
    const horizontal = metadata.orientation === "horizontal";
    if (!horizontal && metadata.orientation !== "vertical") return [];
    const longAxis = horizontal ? 0 : 1;
    const crossAxis = horizontal ? 1 : 0;
    const nominalLength = Number(metadata.nominalLength) > 0
      ? positiveInchesToMeters(metadata.nominalLength)
      : visual[longAxis];
    const length = Math.min(nominalLength, visual[longAxis], envelope[longAxis]);
    const diameter = Math.min(visual[crossAxis], visual[2], envelope[crossAxis], envelope[2]);
    if (![length, diameter].every((value) => Number.isFinite(value) && value > 0)) return [];
    const radius = diameter / 2;
    const barZ = outerZ - outward * radius;
    const barSize = horizontal
      ? [length, diameter, diameter]
      : [diameter, length, diameter];
    const parts = [{
      kind: "pull_bar",
      shape: "cylinder",
      axis: horizontal ? "x" : "y",
      material: "hardware",
      center: [origin[0], origin[1], barZ],
      size: barSize
    }];
    const standoffDepth = Math.abs(barZ - mountingZ);
    const standoffDiameter = Math.min(diameter * 0.46, envelope[0], envelope[1]);
    const along = Math.max(0, length / 2 - radius * 1.5);
    if (standoffDepth > 0 && standoffDiameter > 0) {
      for (const direction of [-1, 1]) {
        parts.push({
          kind: "pull_standoff",
          shape: "cylinder",
          axis: "z",
          material: "hardware",
          center: [
            origin[0] + (horizontal ? along * direction : 0),
            origin[1] + (horizontal ? 0 : along * direction),
            mountingZ + outward * standoffDepth / 2
          ],
          size: [standoffDiameter, standoffDiameter, standoffDepth]
        });
      }
    }
    return parts.every(isPositiveGeometryPart) ? parts : [];
  }

  if (hardwareType !== "knob") return [];
  const diameter = Math.min(visual[0], visual[1], envelope[0], envelope[1]);
  const projection = Math.min(visual[2], envelope[2]);
  if (![diameter, projection].every((value) => Number.isFinite(value) && value > 0)) return [];
  const capDepth = Math.min(diameter, projection * 0.65);
  const capZ = outerZ - outward * capDepth / 2;
  const stemDepth = Math.max(0, projection - capDepth);
  const parts = [{
    kind: "knob_cap",
    shape: "ellipsoid",
    material: "hardware",
    center: [origin[0], origin[1], capZ],
    size: [diameter, diameter, capDepth]
  }];
  if (stemDepth > 0) {
    const stemDiameter = Math.min(diameter * 0.32, envelope[0], envelope[1]);
    parts.push({
      kind: "knob_stem",
      shape: "cylinder",
      axis: "z",
      material: "hardware",
      center: [origin[0], origin[1], mountingZ + outward * stemDepth / 2],
      size: [stemDiameter, stemDiameter, stemDepth]
    });
  }
  return parts.every(isPositiveGeometryPart) ? parts : [];
}

function getArOutwardDirection(component) {
  const frontPlane = Number(component?.metadata?.frontPlaneZ);
  const backPlane = Number(component?.metadata?.backPlaneZ);
  if (Number.isFinite(frontPlane) && Number.isFinite(backPlane) && Math.abs(frontPlane - backPlane) > 1e-9) {
    // Layout +Z points inward, while procedural scene +Z points outward.
    return frontPlane < backPlane ? 1 : -1;
  }
  return 1;
}

function getDescriptorCenterInches(component) {
  const bounds = component?.bounds;
  if (bounds) {
    const center = [
      (Number(bounds.min?.x) + Number(bounds.max?.x)) / 2,
      (Number(bounds.min?.y) + Number(bounds.max?.y)) / 2
    ];
    if (center.every(Number.isFinite)) return center;
  }
  if (component?.position && [component.position.x, component.position.y].every(Number.isFinite)) {
    return [component.position.x, component.position.y];
  }
  return [0, 0];
}

function arRectangleForProfileRegion(region, component, descriptorCenter, renderedCenter) {
  const minX = Number(region?.bounds?.min?.x);
  const maxX = Number(region?.bounds?.max?.x);
  const minY = Number(region?.bounds?.min?.y);
  const maxY = Number(region?.bounds?.max?.y);
  if (![minX, maxX, minY, maxY].every(Number.isFinite) || maxX <= minX || maxY <= minY) return null;
  const width = coordinateInchesToMeters(maxX - minX);
  const height = coordinateInchesToMeters(maxY - minY);
  return {
    center: [
      renderedCenter[0] + coordinateInchesToMeters((minX + maxX) / 2 - descriptorCenter[0]),
      renderedCenter[1] + coordinateInchesToMeters((minY + maxY) / 2 - descriptorCenter[1])
    ],
    size: [width, height]
  };
}

function positiveInchesToMeters(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric * 0.0254 : Number.NaN;
}

function nonNegativeInchesToMeters(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric * 0.0254 : Number.NaN;
}

function isPositiveGeometryPart(part) {
  return Array.isArray(part?.center)
    && part.center.length === 3
    && part.center.every(Number.isFinite)
    && Array.isArray(part?.size)
    && part.size.length === 3
    && part.size.every((value) => Number.isFinite(value) && value > 0);
}

function assertPartsWithinDescriptorEnvelope(component, center, size, parts) {
  if (!Array.isArray(parts) || !parts.length) {
    throw new RangeError(`AR component ${component?.id || "unknown"} did not produce semantic geometry.`);
  }
  const tolerance = 1e-9;
  for (const part of parts) {
    if (!isPositiveGeometryPart(part)) {
      throw new RangeError(`AR component ${component?.id || "unknown"} produced invalid geometry.`);
    }
    for (let axis = 0; axis < 3; axis += 1) {
      const descriptorMinimum = center[axis] - size[axis] / 2;
      const descriptorMaximum = center[axis] + size[axis] / 2;
      const partMinimum = part.center[axis] - part.size[axis] / 2;
      const partMaximum = part.center[axis] + part.size[axis] / 2;
      if (partMinimum < descriptorMinimum - tolerance || partMaximum > descriptorMaximum + tolerance) {
        throw new RangeError(`AR component ${component?.id || "unknown"} escaped its descriptor envelope.`);
      }
    }
  }
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
  if (component.role === "light") return "light";
  if (component.role === "back_panel") return "back";
  if (component.metadata?.purpose === "recess") return "shadow";
  if (component.metadata?.style === "glass" || component.metadata?.material === "glass") return "glass";
  return "finish";
}

function lightColorForWarmth(value) {
  const kelvin = Number(value);
  if (Number.isFinite(kelvin) && kelvin <= 2800) return hexToLinearColor("#ffd6a3");
  if (Number.isFinite(kelvin) && kelvin <= 3500) return hexToLinearColor("#ffe5bd");
  return hexToLinearColor("#fff1db");
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

function appendGeometryPart(group, part) {
  if (part.shape === "cylinder") {
    appendCylinder(group, part.center, part.size, part.axis || "z");
    return;
  }
  if (part.shape === "ellipsoid") {
    appendEllipsoid(group, part.center, part.size);
    return;
  }
  appendBox(group, part.center, part.size);
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

function appendCylinder(group, center, size, axis = "z", segments = 16) {
  const [cx, cy, cz] = center;
  const half = size.map((value) => value / 2);
  const axisIndex = { x: 0, y: 1, z: 2 }[axis] ?? 2;
  const radialAxes = [0, 1, 2].filter((index) => index !== axisIndex);
  const axisHalf = half[axisIndex];
  const radiusA = half[radialAxes[0]];
  const radiusB = half[radialAxes[1]];
  const origin = [cx, cy, cz];

  for (let index = 0; index < segments; index += 1) {
    const next = (index + 1) % segments;
    const angle = index / segments * Math.PI * 2;
    const nextAngle = next / segments * Math.PI * 2;
    const radial = [Math.cos(angle) * radiusA, Math.sin(angle) * radiusB];
    const radialNext = [Math.cos(nextAngle) * radiusA, Math.sin(nextAngle) * radiusB];
    const normal = ellipticalNormal(angle, radiusA, radiusB);
    const normalNext = ellipticalNormal(nextAngle, radiusA, radiusB);
    const sideBase = group.positions.length / 3;
    pushCylinderVertex(group, origin, axisIndex, radialAxes, -axisHalf, radial, normal);
    pushCylinderVertex(group, origin, axisIndex, radialAxes, axisHalf, radial, normal);
    pushCylinderVertex(group, origin, axisIndex, radialAxes, axisHalf, radialNext, normalNext);
    pushCylinderVertex(group, origin, axisIndex, radialAxes, -axisHalf, radialNext, normalNext);
    group.indices.push(sideBase, sideBase + 1, sideBase + 2, sideBase, sideBase + 2, sideBase + 3);

    for (const direction of [-1, 1]) {
      const capNormal = [0, 0, 0];
      capNormal[axisIndex] = direction;
      const capBase = group.positions.length / 3;
      const capCenter = origin.slice();
      capCenter[axisIndex] += axisHalf * direction;
      pushGeometryVertex(group, capCenter, capNormal);
      const first = capCenter.slice();
      first[radialAxes[0]] += (direction > 0 ? radial : radialNext)[0];
      first[radialAxes[1]] += (direction > 0 ? radial : radialNext)[1];
      const second = capCenter.slice();
      second[radialAxes[0]] += (direction > 0 ? radialNext : radial)[0];
      second[radialAxes[1]] += (direction > 0 ? radialNext : radial)[1];
      pushGeometryVertex(group, first, capNormal);
      pushGeometryVertex(group, second, capNormal);
      group.indices.push(capBase, capBase + 1, capBase + 2);
    }
  }
}

function appendEllipsoid(group, center, size, longitudeSegments = 18, latitudeSegments = 10) {
  const radii = size.map((value) => value / 2);
  const baseIndex = group.positions.length / 3;
  for (let latitude = 0; latitude <= latitudeSegments; latitude += 1) {
    const phi = latitude / latitudeSegments * Math.PI;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);
    for (let longitude = 0; longitude <= longitudeSegments; longitude += 1) {
      const theta = longitude / longitudeSegments * Math.PI * 2;
      const unit = [sinPhi * Math.cos(theta), cosPhi, sinPhi * Math.sin(theta)];
      const position = unit.map((value, axis) => center[axis] + value * radii[axis]);
      const normal = normalizeVector(unit.map((value, axis) => value / Math.max(radii[axis], 1e-12)));
      pushGeometryVertex(group, position, normal);
    }
  }
  const row = longitudeSegments + 1;
  for (let latitude = 0; latitude < latitudeSegments; latitude += 1) {
    for (let longitude = 0; longitude < longitudeSegments; longitude += 1) {
      const first = baseIndex + latitude * row + longitude;
      const second = first + row;
      group.indices.push(first, second, first + 1, second, second + 1, first + 1);
    }
  }
}

function pushCylinderVertex(group, origin, axisIndex, radialAxes, axialOffset, radialOffset, radialNormal) {
  const position = origin.slice();
  position[axisIndex] += axialOffset;
  position[radialAxes[0]] += radialOffset[0];
  position[radialAxes[1]] += radialOffset[1];
  const normal = [0, 0, 0];
  normal[radialAxes[0]] = radialNormal[0];
  normal[radialAxes[1]] = radialNormal[1];
  pushGeometryVertex(group, position, normal);
}

function pushGeometryVertex(group, position, normal) {
  group.positions.push(...position);
  group.normals.push(...normal);
  position.forEach((value, axis) => {
    group.minimum[axis] = Math.min(group.minimum[axis], value);
    group.maximum[axis] = Math.max(group.maximum[axis], value);
  });
}

function ellipticalNormal(angle, radiusA, radiusB) {
  return normalizeVector([
    Math.cos(angle) / Math.max(radiusA, 1e-12),
    Math.sin(angle) / Math.max(radiusB, 1e-12)
  ]);
}

function normalizeVector(vector) {
  const length = Math.hypot(...vector) || 1;
  return vector.map((value) => value / length);
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
