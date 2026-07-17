/**
 * Pure geometry helpers for profile-detail camera framing.
 *
 * Bounds use the renderer coordinate system: X runs left to right, Y runs
 * bottom to top, and the visible front of the bookcase is at maximum Z.
 */

export const PROFILE_CAMERA_DURATION = 760;

export const CAMERA_INTENT_STATES = Object.freeze({
  overview: "overview",
  sectionContext: "section-context",
  detailFocus: "detail-focus",
  userControlled: "user-controlled",
  transitioning: "transitioning"
});

const CAMERA_INTENT_STAGE_VALUES = new Set([
  "space",
  "layout",
  "storage",
  "base_top",
  "finish",
  "hardware",
  "lighting",
  "preview"
]);

const CAMERA_INTENT_PROFILE_BY_SELECTION_KIND = Object.freeze({
  base: "base",
  crown: "crown",
  front: "doors",
  hardware: "hardware",
  shelf: "shelves",
  lighting: "lighting",
  back: "backPanel",
  section: "section",
  divider: "section"
});

const CAMERA_INTENT_PROFILE_BY_ROLE = Object.freeze({
  base: "base",
  trim: "base",
  crown: "crown",
  top_panel: "crown",
  door: "doors",
  drawer_front: "doors",
  handle: "hardware",
  shelf: "shelves",
  fixed_shelf: "shelves",
  light: "lighting",
  back_panel: "backPanel",
  side_panel: "sidePanels",
  section: "section",
  divider: "section"
});

/**
 * Create the serializable camera-policy state owned by the configurator. The
 * reducer below is deliberately unaware of DOM and Three.js objects so stage,
 * selection, render-generation, and manual-control transitions can be tested
 * without a renderer.
 */
export function createCameraIntentState(options = {}) {
  const sourceStage = normalizeCameraStage(options.sourceStage || options.stage);
  const sourceSectionIndex = normalizeSectionIndex(options.sourceSectionIndex ?? options.sectionIndex);
  const modelGeneration = normalizeGeneration(options.modelGeneration);
  return freezeCameraIntentState({
    cameraState: CAMERA_INTENT_STATES.overview,
    settledState: CAMERA_INTENT_STATES.overview,
    profile: "overview",
    targetKind: "model",
    targetComponentId: null,
    sourceStage,
    sourceSelectionKey: null,
    sourceSectionIndex,
    transient: false,
    manual: false,
    intentGeneration: normalizeGeneration(options.intentGeneration),
    modelGeneration
  });
}

/**
 * Pure policy reducer. It returns the next observable state plus an optional
 * serializable command for the persistent viewer. Commands carry both intent
 * and model generations; the renderer must ignore a command or transition
 * whose generations are no longer current.
 */
export function resolveCameraIntent(currentState, event = {}) {
  const current = normalizeCameraIntentState(currentState);
  const type = String(event.type || "");

  if (type === "transition-complete") {
    if (!cameraEventMatchesCurrentIntent(current, event)) return freezeCameraResolution(current, null);
    return freezeCameraResolution(freezeCameraIntentState({
      ...current,
      cameraState: current.settledState
    }), null);
  }

  if (type === "manual-interaction") {
    const next = freezeCameraIntentState({
      ...current,
      cameraState: CAMERA_INTENT_STATES.userControlled,
      settledState: CAMERA_INTENT_STATES.userControlled,
      targetKind: "user",
      transient: false,
      manual: true,
      intentGeneration: current.intentGeneration + 1,
      modelGeneration: normalizeGeneration(event.modelGeneration ?? current.modelGeneration)
    });
    return freezeCameraResolution(next, null);
  }

  if (type === "stage-change") {
    const stage = normalizeCameraStage(event.stage || event.sourceStage);
    const sectionIndex = normalizeSectionIndex(event.sectionIndex ?? event.sourceSectionIndex);
    return createCameraResolution(current, stageCameraTarget(stage, sectionIndex), event);
  }

  if (type === "section-change") {
    const sectionIndex = normalizeSectionIndex(event.sectionIndex ?? event.sourceSectionIndex);
    if (sectionIndex === null) {
      return createCameraResolution(
        current,
        stageCameraTarget(normalizeCameraStage(event.stage || current.sourceStage), null),
        event
      );
    }
    return createCameraResolution(current, {
      settledState: CAMERA_INTENT_STATES.sectionContext,
      profile: "section",
      targetKind: "section",
      targetComponentId: null,
      sourceStage: normalizeCameraStage(event.stage || current.sourceStage),
      sourceSelectionKey: null,
      sourceSectionIndex: sectionIndex,
      transient: false,
      manual: false
    }, event);
  }

  if (type === "selection-change") {
    const selection = event.selection && typeof event.selection === "object" ? event.selection : null;
    const stage = normalizeCameraStage(event.stage || selection?.stageId || current.sourceStage);
    if (!selection) return createCameraResolution(current, stageCameraTarget(stage, current.sourceSectionIndex), event);
    const profile = resolveCameraSelectionProfile(selection);
    const sectionIndex = normalizeSectionIndex(selection.sectionIndex ?? event.sectionIndex);
    if (profile === "section") {
      return createCameraResolution(current, {
        settledState: CAMERA_INTENT_STATES.sectionContext,
        profile,
        targetKind: "section",
        targetComponentId: null,
        sourceStage: stage,
        sourceSelectionKey: normalizeSelectionKey(selection.selectionKey || selection.componentId),
        sourceSectionIndex: sectionIndex,
        transient: false,
        manual: false
      }, event);
    }
    if (!profile || profile === "overview") {
      return createCameraResolution(current, stageCameraTarget(stage, sectionIndex), event);
    }
    return createCameraResolution(current, {
      settledState: CAMERA_INTENT_STATES.detailFocus,
      profile,
      targetKind: "detail",
      targetComponentId: normalizeSelectionKey(selection.componentId),
      sourceStage: stage,
      sourceSelectionKey: normalizeSelectionKey(selection.selectionKey || selection.componentId || `${selection.kind || selection.role || profile}`),
      sourceSectionIndex: sectionIndex,
      transient: true,
      manual: false
    }, event);
  }

  if (type === "field-focus") {
    const stage = normalizeCameraStage(event.stage || current.sourceStage);
    const profile = typeof event.profile === "string" && event.profile ? event.profile : "overview";
    const selectionKey = normalizeSelectionKey(event.selectionKey || (event.field ? `${event.field}:${event.value ?? ""}` : profile));
    if (profile === "overview") return createCameraResolution(current, stageCameraTarget(stage, current.sourceSectionIndex), event);
    if (profile === "finish") {
      return createCameraResolution(current, {
        ...stageCameraTarget("finish", current.sourceSectionIndex),
        sourceStage: stage,
        sourceSelectionKey: selectionKey
      }, event);
    }
    return createCameraResolution(current, {
      settledState: CAMERA_INTENT_STATES.detailFocus,
      profile,
      targetKind: "detail",
      targetComponentId: null,
      sourceStage: stage,
      sourceSelectionKey: selectionKey,
      sourceSectionIndex: normalizeSectionIndex(event.sectionIndex ?? current.sourceSectionIndex),
      transient: event.transient !== false,
      manual: false
    }, event);
  }

  if (type === "model-change") {
    const modelGeneration = normalizeGeneration(event.modelGeneration);
    const stage = normalizeCameraStage(event.stage || current.sourceStage);
    if (event.targetValid === false) {
      return createCameraResolution(current, stageCameraTarget(stage, normalizeSectionIndex(event.sectionIndex)), {
        ...event,
        modelGeneration
      });
    }
    if (
      event.preserveUserPose === true
      && (current.cameraState === CAMERA_INTENT_STATES.userControlled
        || current.settledState === CAMERA_INTENT_STATES.userControlled)
    ) {
      return freezeCameraResolution(freezeCameraIntentState({
        ...current,
        cameraState: CAMERA_INTENT_STATES.userControlled,
        settledState: CAMERA_INTENT_STATES.userControlled,
        targetKind: "user",
        modelGeneration,
        intentGeneration: current.intentGeneration + 1
      }), null);
    }
    if (current.cameraState === CAMERA_INTENT_STATES.userControlled || current.settledState === CAMERA_INTENT_STATES.userControlled) {
      return createCameraResolution(current, {
        ...current,
        cameraState: CAMERA_INTENT_STATES.userControlled,
        settledState: CAMERA_INTENT_STATES.userControlled,
        targetKind: "user",
        modelGeneration
      }, { ...event, duration: 0, modelGeneration });
    }
    return createCameraResolution(current, { ...current, modelGeneration }, { ...event, modelGeneration });
  }

  if (type === "viewport-change" || type === "layout-change") {
    const target = current.cameraState === CAMERA_INTENT_STATES.userControlled
      || current.settledState === CAMERA_INTENT_STATES.userControlled
      ? { ...current, cameraState: CAMERA_INTENT_STATES.userControlled, settledState: CAMERA_INTENT_STATES.userControlled, targetKind: "user" }
      : current;
    return createCameraResolution(current, target, { ...event, duration: event.duration ?? 0 });
  }

  return freezeCameraResolution(current, null);
}

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

/**
 * Calculate an orbit pose that contains an entire axis-aligned bounds inside
 * the unobstructed viewport. Unlike the profile-detail helper, this keeps the
 * complete model in view and accepts caller-selected orbit angles.
 *
 * The fit is solved against all eight corners. The safe rectangle can be
 * asymmetric: the target is shifted so the bounds center projects to the safe
 * rectangle's center, then each corner is constrained against its left,
 * right, top, and bottom edges at that corner's own perspective depth.
 */
export function calculateBoundsCameraPose({
  bounds,
  theta,
  phi,
  verticalFovDegrees = DEFAULT_VERTICAL_FOV_DEGREES,
  aspect,
  viewport,
  fitMargin = FIT_MARGIN
} = {}) {
  const normalizedBounds = normalizeRequiredBounds(bounds, "bounds");
  const normalizedTheta = normalizeAngle(theta, "theta");
  const normalizedPhi = normalizeAngle(phi, "phi");
  const normalizedViewport = normalizeViewport(viewport, aspect);
  const resolvedAspect = normalizeAspect(aspect, normalizedViewport.width / normalizedViewport.height);
  const resolvedVerticalFov = normalizeVerticalFov(verticalFovDegrees);
  const resolvedFitMargin = normalizeFitMargin(fitMargin);
  const verticalFovRadians = degreesToRadians(resolvedVerticalFov);
  const tanVertical = Math.tan(verticalFovRadians / 2);
  const tanHorizontal = tanVertical * resolvedAspect;
  const axes = cameraAxes(normalizedTheta, normalizedPhi);
  const focusCenter = centerOf(normalizedBounds);
  const corners = cornersOf(normalizedBounds);

  // A fit margin greater than one shrinks the usable half-extents around the
  // safe center. This creates even breathing room without moving the center.
  const horizontalHalfExtent = normalizedViewport.safeFraction.x / resolvedFitMargin;
  const verticalHalfExtent = normalizedViewport.safeFraction.y / resolvedFitMargin;
  const safeCenter = normalizedViewport.safeCenterNdc;
  const left = safeCenter.x - horizontalHalfExtent;
  const right = safeCenter.x + horizontalHalfExtent;
  const bottom = safeCenter.y - verticalHalfExtent;
  const top = safeCenter.y + verticalHalfExtent;

  let fitRadius = 0;
  let farthestProjection = Number.NEGATIVE_INFINITY;
  for (const corner of corners) {
    const relative = subtract(corner, focusCenter);
    const outwardProjection = dot(relative, axes.direction);
    const horizontalProjection = dot(relative, axes.right);
    const verticalProjection = dot(relative, axes.up);
    farthestProjection = Math.max(farthestProjection, outwardProjection);

    fitRadius = Math.max(
      fitRadius,
      radiusForUpperEdge(horizontalProjection, outwardProjection, right, safeCenter.x, tanHorizontal),
      radiusForLowerEdge(horizontalProjection, outwardProjection, left, safeCenter.x, tanHorizontal),
      radiusForUpperEdge(verticalProjection, outwardProjection, top, safeCenter.y, tanVertical),
      radiusForLowerEdge(verticalProjection, outwardProjection, bottom, safeCenter.y, tanVertical)
    );
  }

  const boundsSize = sizeOf(normalizedBounds);
  const diagonal = Math.hypot(boundsSize.x, boundsSize.y, boundsSize.z);
  const coordinateScale = Math.max(
    1,
    Math.abs(focusCenter.x),
    Math.abs(focusCenter.y),
    Math.abs(focusCenter.z)
  );
  const minimumSpan = Math.max(diagonal, coordinateScale * 1e-6);
  const depthPadding = minimumSpan * 1e-6;
  const radius = Math.max(
    fitRadius,
    farthestProjection + depthPadding,
    minimumSpan * 0.3
  );

  const target = calculateViewportAwareTarget({
    focusCenter,
    radius,
    theta: normalizedTheta,
    phi: normalizedPhi,
    verticalFovDegrees: resolvedVerticalFov,
    aspect: resolvedAspect,
    viewport: normalizedViewport
  });

  return {
    theta: normalizedTheta,
    phi: normalizedPhi,
    radius,
    target,
    bounds: normalizedBounds,
    focusCenter,
    viewport: normalizedViewport,
    fitMargin: resolvedFitMargin
  };
}

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

function stageCameraTarget(stage, sectionIndex) {
  if (stage === "finish") {
    return {
      settledState: CAMERA_INTENT_STATES.overview,
      profile: "finish",
      targetKind: "model",
      targetComponentId: null,
      sourceStage: stage,
      sourceSelectionKey: null,
      sourceSectionIndex: null,
      transient: false,
      manual: false
    };
  }
  if (stage === "preview") {
    return {
      settledState: CAMERA_INTENT_STATES.overview,
      profile: "preview",
      targetKind: "model",
      targetComponentId: null,
      sourceStage: stage,
      sourceSelectionKey: null,
      sourceSectionIndex: null,
      transient: false,
      manual: false
    };
  }
  if (stage === "lighting") {
    return {
      settledState: CAMERA_INTENT_STATES.overview,
      profile: "lighting",
      targetKind: "model",
      targetComponentId: null,
      sourceStage: stage,
      sourceSelectionKey: null,
      sourceSectionIndex: null,
      transient: false,
      manual: false
    };
  }
  return {
    settledState: CAMERA_INTENT_STATES.overview,
    profile: "overview",
    targetKind: "model",
    targetComponentId: null,
    sourceStage: stage,
    sourceSelectionKey: null,
    sourceSectionIndex: null,
    transient: false,
    manual: false
  };
}

function resolveCameraSelectionProfile(selection) {
  if (typeof selection.profile === "string" && selection.profile) return selection.profile;
  return CAMERA_INTENT_PROFILE_BY_ROLE[selection.role]
    || CAMERA_INTENT_PROFILE_BY_SELECTION_KIND[selection.kind]
    || null;
}

function createCameraResolution(current, target, event) {
  const intentGeneration = current.intentGeneration + 1;
  const modelGeneration = event.modelGeneration === undefined
    ? normalizeGeneration(target.modelGeneration ?? current.modelGeneration)
    : normalizeGeneration(event.modelGeneration);
  const targetKind = normalizeTargetKind(target.targetKind);
  const settledState = normalizeSettledCameraState(target.settledState || target.cameraState);
  const duration = resolveIntentDuration(event.duration, settledState, targetKind);
  const cameraState = targetKind === "user"
    ? CAMERA_INTENT_STATES.userControlled
    : duration > 0
      ? CAMERA_INTENT_STATES.transitioning
      : settledState;
  const state = freezeCameraIntentState({
    cameraState,
    settledState,
    profile: normalizeProfile(target.profile),
    targetKind,
    targetComponentId: normalizeSelectionKey(target.targetComponentId),
    sourceStage: normalizeCameraStage(target.sourceStage || current.sourceStage),
    sourceSelectionKey: normalizeSelectionKey(target.sourceSelectionKey),
    sourceSectionIndex: normalizeSectionIndex(target.sourceSectionIndex),
    transient: Boolean(target.transient),
    manual: targetKind === "user" || Boolean(target.manual),
    intentGeneration,
    modelGeneration
  });
  const command = Object.freeze({
    intentGeneration,
    modelGeneration,
    cameraState: settledState,
    profile: state.profile,
    targetKind,
    targetComponentId: state.targetComponentId,
    sourceStage: state.sourceStage,
    sourceSelectionKey: state.sourceSelectionKey,
    sourceSectionIndex: state.sourceSectionIndex,
    transient: state.transient,
    preserveAngles: targetKind === "user",
    duration
  });
  return freezeCameraResolution(state, command);
}

function normalizeCameraIntentState(value) {
  if (!value || typeof value !== "object") return createCameraIntentState();
  return freezeCameraIntentState({
    cameraState: normalizeCameraState(value.cameraState),
    settledState: normalizeSettledCameraState(value.settledState || value.cameraState),
    profile: normalizeProfile(value.profile),
    targetKind: normalizeTargetKind(value.targetKind),
    targetComponentId: normalizeSelectionKey(value.targetComponentId),
    sourceStage: normalizeCameraStage(value.sourceStage),
    sourceSelectionKey: normalizeSelectionKey(value.sourceSelectionKey),
    sourceSectionIndex: normalizeSectionIndex(value.sourceSectionIndex),
    transient: Boolean(value.transient),
    manual: Boolean(value.manual),
    intentGeneration: normalizeGeneration(value.intentGeneration),
    modelGeneration: normalizeGeneration(value.modelGeneration)
  });
}

function freezeCameraIntentState(value) {
  return Object.freeze({ ...value });
}

function freezeCameraResolution(state, command) {
  return Object.freeze({ state, command });
}

function cameraEventMatchesCurrentIntent(current, event) {
  const intentGeneration = Number(event.intentGeneration);
  const modelGeneration = Number(event.modelGeneration);
  if (!Number.isInteger(intentGeneration) || intentGeneration !== current.intentGeneration) return false;
  if (Number.isInteger(modelGeneration) && modelGeneration !== current.modelGeneration) return false;
  return true;
}

function normalizeCameraStage(value) {
  return CAMERA_INTENT_STAGE_VALUES.has(value) ? value : "layout";
}

function normalizeCameraState(value) {
  return Object.values(CAMERA_INTENT_STATES).includes(value) ? value : CAMERA_INTENT_STATES.overview;
}

function normalizeSettledCameraState(value) {
  if (value === CAMERA_INTENT_STATES.sectionContext) return value;
  if (value === CAMERA_INTENT_STATES.detailFocus) return value;
  if (value === CAMERA_INTENT_STATES.userControlled) return value;
  return CAMERA_INTENT_STATES.overview;
}

function normalizeTargetKind(value) {
  return ["model", "section", "detail", "user"].includes(value) ? value : "model";
}

function normalizeProfile(value) {
  return typeof value === "string" && value ? value : "overview";
}

function normalizeSelectionKey(value) {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

function normalizeSectionIndex(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : null;
}

function normalizeGeneration(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : 0;
}

function resolveIntentDuration(value, settledState, targetKind) {
  if (value !== undefined) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
  }
  if (targetKind === "user") return 0;
  return settledState === CAMERA_INTENT_STATES.detailFocus ? PROFILE_CAMERA_DURATION : 480;
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

function centerOf(bounds) {
  return {
    x: (bounds.min.x + bounds.max.x) / 2,
    y: (bounds.min.y + bounds.max.y) / 2,
    z: (bounds.min.z + bounds.max.z) / 2
  };
}

function radiusForUpperEdge(projection, depthProjection, edge, center, tangent) {
  return (projection + edge * tangent * depthProjection) / ((edge - center) * tangent);
}

function radiusForLowerEdge(projection, depthProjection, edge, center, tangent) {
  return (-projection - edge * tangent * depthProjection) / ((center - edge) * tangent);
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

function normalizeFitMargin(value) {
  const numeric = Number(value);
  return clamp(Number.isFinite(numeric) && numeric > 0 ? numeric : FIT_MARGIN, 1, 4);
}

function degreesToRadians(value) {
  return value * Math.PI / 180;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
