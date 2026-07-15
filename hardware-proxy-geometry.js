/**
 * Pure geometry recipes for the small number of asymmetric neutral hardware
 * proxies. Three.js consumes these values at the renderer boundary.
 */
export function createCabinetLatchProxyParts(size, position, mirrored = false) {
  const dimensions = finiteVector(size, "size");
  const origin = finiteVector(position, "position");
  const direction = mirrored ? -1 : 1;
  return Object.freeze({
    body: freezePart(
      [dimensions[0] * 0.58, dimensions[1] * 0.88, dimensions[2] * 0.76],
      [origin[0] - dimensions[0] * 0.18 * direction, origin[1], origin[2]]
    ),
    catch: freezePart(
      [dimensions[0] * 0.24, dimensions[1] * 0.56, dimensions[2] * 0.54],
      [origin[0] + dimensions[0] * 0.34 * direction, origin[1], origin[2] - dimensions[2] * 0.06]
    )
  });
}

/**
 * Convert absolute descriptor drill centers into the renderer's scene axes.
 * Layout +Z points inward while scene +Z points outward.
 */
export function descriptorMountCentersToScene(
  mountingCenters,
  descriptorPosition,
  scenePosition,
  unitsPerInch = 1 / 12
) {
  const descriptor = finiteObjectVector(descriptorPosition, "descriptorPosition");
  const scene = finiteVector(scenePosition, "scenePosition");
  const scale = Number(unitsPerInch);
  if (!Number.isFinite(scale) || scale <= 0) throw new TypeError("unitsPerInch must be a positive finite number.");
  if (!Array.isArray(mountingCenters)) return Object.freeze([]);
  return Object.freeze(mountingCenters.map((point, index) => {
    const center = finiteObjectVector(point, `mountingCenters[${index}]`);
    return Object.freeze([
      scene[0] + (center.x - descriptor.x) * scale,
      scene[1] + (center.y - descriptor.y) * scale,
      scene[2] - (center.z - descriptor.z) * scale
    ]);
  }));
}

/** Pure recipe for bars and their front-attached standoffs. */
export function createLinearPullProxyParts(size, position, orientation = "vertical", sceneMountCenters = []) {
  const dimensions = finiteVector(size, "size");
  const origin = finiteVector(position, "position");
  const horizontal = orientation === "horizontal";
  const length = horizontal ? dimensions[0] : dimensions[1];
  const crossAxis = horizontal ? dimensions[1] : dimensions[0];
  const radius = Math.max(0.003, crossAxis / 2);
  const mountZ = origin[2] - dimensions[2] / 2;
  const barZ = origin[2] + dimensions[2] / 2 - radius;
  const standoffLength = Math.max(0.003, barZ - mountZ);
  const standoffRadius = Math.max(0.002, radius * 0.46);
  const supplied = normalizeSceneMountCenters(sceneMountCenters);
  const along = Math.max(0, length / 2 - radius * 1.5);
  const centers = supplied.length >= 2
    ? supplied.slice(0, 2)
    : [-1, 1].map((direction) => Object.freeze([
      origin[0] + (horizontal ? along * direction : 0),
      origin[1] + (horizontal ? 0 : along * direction),
      mountZ
    ]));
  return Object.freeze({
    horizontal,
    bar: Object.freeze({
      radius,
      length,
      position: Object.freeze([origin[0], origin[1], barZ])
    }),
    standoffs: Object.freeze(centers.map((center) => Object.freeze({
      radius: standoffRadius,
      length: standoffLength,
      position: Object.freeze([center[0], center[1], mountZ + standoffLength / 2])
    })))
  });
}

/** Target envelope and exact drill locations for the neutral cup proxy. */
export function createCupPullProxyParts(size, position, orientation = "horizontal", sceneMountCenters = []) {
  const dimensions = finiteVector(size, "size");
  const origin = finiteVector(position, "position");
  const horizontal = orientation !== "vertical";
  const targetSize = Object.freeze([
    dimensions[0],
    dimensions[1],
    dimensions[2] * 0.36
  ]);
  const mountZ = origin[2] - dimensions[2] / 2;
  const mountLength = Math.max(0.003, dimensions[2] * 0.48);
  const mountRadius = Math.max(0.002, Math.min(dimensions[0], dimensions[1]) * 0.075);
  const supplied = normalizeSceneMountCenters(sceneMountCenters);
  return Object.freeze({
    horizontal,
    targetSize,
    shellPosition: Object.freeze([origin[0], origin[1], origin[2] + dimensions[2] * 0.12]),
    mounts: Object.freeze(supplied.slice(0, 2).map((center) => Object.freeze({
      radius: mountRadius,
      length: mountLength,
      position: Object.freeze([center[0], center[1], mountZ + mountLength / 2])
    })))
  });
}

function finiteVector(value, label) {
  if (!Array.isArray(value) || value.length !== 3 || value.some((item) => !Number.isFinite(Number(item)))) {
    throw new TypeError(`${label} must contain three finite numbers.`);
  }
  return value.map(Number);
}

function finiteObjectVector(value, label) {
  if (!value || typeof value !== "object" || [value.x, value.y, value.z].some((item) => !Number.isFinite(Number(item)))) {
    throw new TypeError(`${label} must contain finite x, y, and z numbers.`);
  }
  return { x: Number(value.x), y: Number(value.y), z: Number(value.z) };
}

function normalizeSceneMountCenters(value) {
  if (!Array.isArray(value)) return [];
  return value.map((center, index) => Object.freeze(finiteVector(center, `sceneMountCenters[${index}]`)));
}

function freezePart(size, position) {
  return Object.freeze({
    size: Object.freeze(size),
    position: Object.freeze(position)
  });
}
