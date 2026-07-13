/**
 * Pure geometry helpers for profile-detail camera framing.
 *
 * Bounds use the renderer coordinate system: X runs left to right, Y runs
 * bottom to top, and the visible front of the bookcase is at maximum Z.
 */

export const PROFILE_CAMERA_DURATION = 760;

const PROFILE_CAMERA_KEY_VALUES = Object.freeze(["base", "crown"]);
const PROFILE_CAMERA_KEY_LOOKUP = new Set(PROFILE_CAMERA_KEY_VALUES);

/**
 * Read-only Set-like collection. A frozen native Set can still be mutated via
 * Set.prototype.add(), so this facade deliberately exposes only read methods.
 */
export const PROFILE_CAMERA_KEYS = Object.freeze({
  size: PROFILE_CAMERA_KEY_VALUES.length,
  has: (key) => PROFILE_CAMERA_KEY_LOOKUP.has(key),
  values: () => PROFILE_CAMERA_KEY_VALUES.values(),
  keys: () => PROFILE_CAMERA_KEY_VALUES.values(),
  entries: () => PROFILE_CAMERA_KEY_VALUES.map((key) => [key, key]).values(),
  forEach(callback, thisArg) {
    for (const key of PROFILE_CAMERA_KEY_VALUES) callback.call(thisArg, key, key, PROFILE_CAMERA_KEYS);
  },
  [Symbol.iterator]: () => PROFILE_CAMERA_KEY_VALUES.values()
});

const PROFILE_CAMERA_ANGLES = Object.freeze({
  base: Object.freeze({ theta: -0.62, phi: 0.11 }),
  crown: Object.freeze({ theta: -0.62, phi: -0.08 })
});

const DEFAULT_VERTICAL_FOV_DEGREES = 34;
const FIT_MARGIN = 1.14;
const MIN_SAFE_VIEWPORT_FRACTION = 0.08;

export function isProfileCameraKey(key) {
  return typeof key === "string" && PROFILE_CAMERA_KEY_LOOKUP.has(key);
}

export function resolveCameraTransitionDuration(duration = PROFILE_CAMERA_DURATION, reducedMotion = false) {
  const numeric = Number(duration);
  if (reducedMotion || !Number.isFinite(numeric) || numeric <= 0) return 0;
  return clamp(numeric, 320, 900);
}

function assertProfileCameraKey(key) {
  if (!isProfileCameraKey(key)) throw new TypeError('kind must be "base" or "crown"');
}

/**
 * Build a detail region around the left-front profile corner. The horizontal
 * crop and vertical body context are ratios of the current model/profile, so
 * the result scales with narrow, wide, short, tall, shallow, and deep cases.
 */
export function createProfileFocusRegion({ kind, modelBounds, featureBounds } = {}) {
  assertProfileCameraKey(kind);
  const model = normalizeRequiredBounds(modelBounds, "modelBounds");
  const modelSize = sizeOf(model);
  if (modelSize.x <= 0 || modelSize.y <= 0 || modelSize.z <= 0) {
    throw new RangeError("modelBounds must have positive width, height, and depth");
  }

  const feature = featureBounds == null
    ? createFallbackFeatureBounds(kind, model)
    : normalizeRequiredBounds(featureBounds, "featureBounds");
  const featureSize = sizeOf(feature);

  const left = Math.min(model.min.x, feature.min.x);
  const right = Math.max(model.max.x, feature.max.x);
  const availableWidth = right - left;
  const fullDepth = Math.max(model.max.z, feature.max.z) - Math.min(model.min.z, feature.min.z);

  const preferredContextWidth = Math.max(
    availableWidth * 0.19,
    fullDepth * 1.25,
    featureSize.y * 3.2
  );
  const contextWidth = clamp(
    preferredContextWidth,
    availableWidth * 0.16,
    availableWidth * 0.46
  );

  const preferredContextHeight = Math.max(
    modelSize.y * 0.2,
    fullDepth * 0.9,
    featureSize.y * 3.25
  );
  const contextHeight = clamp(
    preferredContextHeight,
    modelSize.y * 0.16,
    modelSize.y * 0.42
  );

  const region = {
    min: {
      x: left,
      y: kind === "base"
        ? Math.min(model.min.y, feature.min.y)
        : Math.min(feature.min.y, Math.max(model.min.y, model.max.y - contextHeight)),
      z: Math.min(model.min.z, feature.min.z)
    },
    max: {
      x: Math.min(right, left + contextWidth),
      y: kind === "base"
        ? Math.max(feature.max.y, Math.min(model.max.y, model.min.y + contextHeight))
        : Math.max(model.max.y, feature.max.y),
      z: Math.max(model.max.z, feature.max.z)
    }
  };

  return normalizeRequiredBounds(region, "profile focus region");
}

/**
 * Calculate an orbit pose that fits every corner of the profile region inside
 * the unobstructed viewport. The target is offset so the focal point projects
 * to the safe rectangle's center rather than the full canvas center.
 */
export function calculateProfileCameraPose({
  kind,
  modelBounds,
  featureBounds,
  verticalFovDegrees = DEFAULT_VERTICAL_FOV_DEGREES,
  aspect,
  viewport
} = {}) {
  assertProfileCameraKey(kind);
  const model = normalizeRequiredBounds(modelBounds, "modelBounds");
  const feature = featureBounds == null
    ? createFallbackFeatureBounds(kind, model)
    : normalizeRequiredBounds(featureBounds, "featureBounds");
  const region = createProfileFocusRegion({ kind, modelBounds: model, featureBounds: feature });
  const normalizedViewport = normalizeViewport(viewport, aspect);
  const resolvedAspect = normalizeAspect(aspect, normalizedViewport.width / normalizedViewport.height);
  const resolvedVerticalFov = normalizeVerticalFov(verticalFovDegrees);
  const verticalFovRadians = degreesToRadians(resolvedVerticalFov);
  const tanVertical = Math.tan(verticalFovRadians / 2);
  const tanHorizontal = tanVertical * resolvedAspect;
  const { theta, phi } = PROFILE_CAMERA_ANGLES[kind];
  const axes = cameraAxes(theta, phi);
  const focusCenter = createFocusCenter(region, feature);
  const corners = cornersOf(region);
  const safeHorizontalFraction = normalizedViewport.safeFraction.x;
  const safeVerticalFraction = normalizedViewport.safeFraction.y;

  let fitRadius = 0;
  let nearestProjection = Number.POSITIVE_INFINITY;
  let farthestProjection = Number.NEGATIVE_INFINITY;
  for (const corner of corners) {
    const relative = subtract(corner, focusCenter);
    const outwardProjection = dot(relative, axes.direction);
    const horizontalProjection = Math.abs(dot(relative, axes.right));
    const verticalProjection = Math.abs(dot(relative, axes.up));
    nearestProjection = Math.min(nearestProjection, outwardProjection);
    farthestProjection = Math.max(farthestProjection, outwardProjection);
    fitRadius = Math.max(
      fitRadius,
      outwardProjection + FIT_MARGIN * horizontalProjection / (tanHorizontal * safeHorizontalFraction),
      outwardProjection + FIT_MARGIN * verticalProjection / (tanVertical * safeVerticalFraction)
    );
  }

  const regionSize = sizeOf(region);
  const diagonal = Math.hypot(regionSize.x, regionSize.y, regionSize.z);
  const projectedDepth = Math.max(0, farthestProjection - nearestProjection);
  const radius = Math.max(
    fitRadius,
    farthestProjection + diagonal * 0.08,
    diagonal * 0.3
  ) + projectedDepth * 0.06 + diagonal * 0.025;

  const target = calculateViewportAwareTarget({
    focusCenter,
    radius,
    theta,
    phi,
    verticalFovDegrees: resolvedVerticalFov,
    aspect: resolvedAspect,
    viewport: normalizedViewport
  });

  return {
    theta,
    phi,
    radius,
    target,
    region,
    focusCenter,
    viewport: normalizedViewport
  };
}

/**
 * Offset an OrbitControls target so focusCenter lands at the center of the
 * viewport's unobstructed rectangle. The returned point remains in world
 * coordinates and does not alter the orbit direction or radius.
 */
export function calculateViewportAwareTarget({
  focusCenter,
  radius,
  theta,
  phi,
  verticalFovDegrees = DEFAULT_VERTICAL_FOV_DEGREES,
  aspect,
  viewport
} = {}) {
  const focus = normalizePoint(focusCenter, "focusCenter");
  const normalizedRadius = Number(radius);
  if (!Number.isFinite(normalizedRadius) || normalizedRadius <= 0) {
    throw new RangeError("radius must be a positive finite number");
  }
  const normalizedTheta = normalizeAngle(theta, "theta");
  const normalizedPhi = normalizeAngle(phi, "phi");
  const normalizedViewport = normalizeViewport(viewport, aspect);
  const resolvedAspect = normalizeAspect(aspect, normalizedViewport.width / normalizedViewport.height);
  const verticalFovRadians = degreesToRadians(normalizeVerticalFov(verticalFovDegrees));
  const tanVertical = Math.tan(verticalFovRadians / 2);
  const tanHorizontal = tanVertical * resolvedAspect;
  const axes = cameraAxes(normalizedTheta, normalizedPhi);
  const horizontalShift = normalizedViewport.safeCenterNdc.x * normalizedRadius * tanHorizontal;
  const verticalShift = normalizedViewport.safeCenterNdc.y * normalizedRadius * tanVertical;

  return {
    x: focus.x - axes.right.x * horizontalShift - axes.up.x * verticalShift,
    y: focus.y - axes.right.y * horizontalShift - axes.up.y * verticalShift,
    z: focus.z - axes.right.z * horizontalShift - axes.up.z * verticalShift
  };
}

function createFallbackFeatureBounds(kind, model) {
  const height = model.max.y - model.min.y;
  const sliceHeight = height * 0.08;
  return {
    min: {
      x: model.min.x,
      y: kind === "base" ? model.min.y : model.max.y - sliceHeight,
      z: model.min.z
    },
    max: {
      x: model.max.x,
      y: kind === "base" ? model.min.y + sliceHeight : model.max.y,
      z: model.max.z
    }
  };
}

function createFocusCenter(region, feature) {
  const regionSize = sizeOf(region);
  return {
    x: region.min.x + regionSize.x * 0.22,
    y: clamp((feature.min.y + feature.max.y) / 2, region.min.y, region.max.y),
    z: region.max.z - regionSize.z * 0.22
  };
}

function normalizeViewport(viewport, aspect) {
  const source = viewport && typeof viewport === "object" ? viewport : {};
  const fallbackAspect = normalizeAspect(aspect, 1);
  const height = positiveFinite(source.height, 1);
  const width = positiveFinite(source.width, height * fallbackAspect);
  const sourceInsets = source.insets && typeof source.insets === "object" ? source.insets : {};
  let top = nonnegativeFinite(sourceInsets.top);
  let right = nonnegativeFinite(sourceInsets.right);
  let bottom = nonnegativeFinite(sourceInsets.bottom);
  let left = nonnegativeFinite(sourceInsets.left);

  const maximumHorizontalInsets = width * (1 - MIN_SAFE_VIEWPORT_FRACTION);
  const horizontalInsets = left + right;
  if (horizontalInsets > maximumHorizontalInsets) {
    const scale = maximumHorizontalInsets / horizontalInsets;
    left *= scale;
    right *= scale;
  }

  const maximumVerticalInsets = height * (1 - MIN_SAFE_VIEWPORT_FRACTION);
  const verticalInsets = top + bottom;
  if (verticalInsets > maximumVerticalInsets) {
    const scale = maximumVerticalInsets / verticalInsets;
    top *= scale;
    bottom *= scale;
  }

  const safeWidth = width - left - right;
  const safeHeight = height - top - bottom;
  const safeLeft = left;
  const safeTop = top;
  const centerX = safeLeft + safeWidth / 2;
  const centerY = safeTop + safeHeight / 2;

  return {
    width,
    height,
    aspect: width / height,
    insets: { top, right, bottom, left },
    safeRect: {
      left: safeLeft,
      top: safeTop,
      right: safeLeft + safeWidth,
      bottom: safeTop + safeHeight,
      width: safeWidth,
      height: safeHeight,
      centerX,
      centerY
    },
    safeFraction: {
      x: safeWidth / width,
      y: safeHeight / height
    },
    safeCenterNdc: {
      x: centerX / width * 2 - 1,
      y: 1 - centerY / height * 2
    }
  };
}

function normalizeRequiredBounds(bounds, name) {
  if (!bounds || typeof bounds !== "object") throw new TypeError(`${name} must be a bounds object`);
  const first = normalizePoint(bounds.min, `${name}.min`);
  const second = normalizePoint(bounds.max, `${name}.max`);
  return {
    min: {
      x: Math.min(first.x, second.x),
      y: Math.min(first.y, second.y),
      z: Math.min(first.z, second.z)
    },
    max: {
      x: Math.max(first.x, second.x),
      y: Math.max(first.y, second.y),
      z: Math.max(first.z, second.z)
    }
  };
}

function normalizePoint(point, name) {
  if (!point || typeof point !== "object") throw new TypeError(`${name} must be a point object`);
  const normalized = {};
  for (const axis of ["x", "y", "z"]) {
    const value = Number(point[axis]);
    if (!Number.isFinite(value)) throw new TypeError(`${name}.${axis} must be finite`);
    normalized[axis] = value;
  }
  return normalized;
}

function normalizeAspect(value, fallback) {
  const numeric = Number(value);
  return clamp(Number.isFinite(numeric) && numeric > 0 ? numeric : fallback, 0.1, 10);
}

function normalizeVerticalFov(value) {
  const numeric = Number(value);
  return clamp(Number.isFinite(numeric) ? numeric : DEFAULT_VERTICAL_FOV_DEGREES, 10, 120);
}

function normalizeAngle(value, name) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) throw new TypeError(`${name} must be finite`);
  return numeric;
}

function cameraAxes(theta, phi) {
  const sinTheta = Math.sin(theta);
  const cosTheta = Math.cos(theta);
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  return {
    direction: {
      x: sinTheta * cosPhi,
      y: sinPhi,
      z: cosTheta * cosPhi
    },
    right: {
      x: cosTheta,
      y: 0,
      z: -sinTheta
    },
    up: {
      x: -sinTheta * sinPhi,
      y: cosPhi,
      z: -cosTheta * sinPhi
    }
  };
}

function cornersOf(bounds) {
  const corners = [];
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) corners.push({ x, y, z });
    }
  }
  return corners;
}

function sizeOf(bounds) {
  return {
    x: bounds.max.x - bounds.min.x,
    y: bounds.max.y - bounds.min.y,
    z: bounds.max.z - bounds.min.z
  };
}

function subtract(left, right) {
  return { x: left.x - right.x, y: left.y - right.y, z: left.z - right.z };
}

function dot(left, right) {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function positiveFinite(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function nonnegativeFinite(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function degreesToRadians(value) {
  return value * Math.PI / 180;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
