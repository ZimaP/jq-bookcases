import {
  FINISH_OPTIONS,
  getCategory,
  getCanonicalRoomScene,
  getCanonicalRoomMeasurementSemantics,
  getFinish,
  getLayout,
  getMeasurementFields,
  getProductChoiceForSelection,
  getStyle
} from "./guided-configurator-data.js?v=canonical-room-scenes-20260729a";

const DEFAULTS = Object.freeze({
  wallWidth: 120,
  ceilingHeight: 96,
  desiredDepth: 14,
  nicheWidth: 96,
  nicheHeight: 96,
  nicheDepth: 14,
  leftReturn: 12,
  rightReturn: 12,
  windowWidth: 48,
  windowHeight: 42,
  sillHeight: 30,
  doorWidth: 36,
  doorHeight: 80,
  doorLeftDistance: 24,
  doorTrimWidth: 3.5,
  fireplaceWidth: 42,
  fireplaceHeight: 32,
  mantelWidth: 60,
  mantelHeight: 48,
  fireplaceDepth: 8,
  fireplaceLeftWidth: 36,
  fireplaceRightWidth: 36,
  tvScreenSize: 65,
  tvHeight: 33,
  radiatorWidth: 48,
  radiatorHeight: 26,
  radiatorDepth: 9,
  cornerReturn: 48,
  openingLeftDistance: 24,
  openingRightDistance: 24
});

const EPSILON = 0.001;
const X_AXIS = Object.freeze({ x: 1, y: 0, z: 0 });
const Y_AXIS = Object.freeze({ x: 0, y: 1, z: 0 });
const Z_AXIS = Object.freeze({ x: 0, y: 0, z: 1 });

/**
 * Translate an approximate guided-project draft into a renderer-neutral scene.
 *
 * This plan is for customer concept visualization only. It intentionally does
 * not import or imitate the accepted physical layout, BOM, or pricing engines.
 */
export function createGuidedScenePlan(project = {}) {
  const category = getCategory(project.category);
  const style = getStyle(category.id, project.style);
  const sceneDefinition = getCanonicalRoomScene(project.layout);
  if (!sceneDefinition) {
    throw new RangeError(`Unknown guided room layout: ${String(project.layout ?? "") || "(missing)"}.`);
  }
  const layout = getLayout(category.id, sceneDefinition.id);
  if (!layout) {
    throw new RangeError(`Canonical guided room layout is unavailable: ${sceneDefinition.id}.`);
  }
  const fields = getMeasurementFields(category.id, layout.id);
  const measurementSemantics = getCanonicalRoomMeasurementSemantics(category.id, layout.id);
  const measurements = resolveMeasurements(project.measurements, fields);
  const context = createRoomContext(category.id, layout, sceneDefinition, measurements);
  const topology = buildRoomTopology(context);
  addCategoryFeatures(context, topology);

  const plan = {
    version: 1,
    units: "inches",
    purpose: "guided-concept-only",
    measurements,
    selection: buildSelection(project, category, style),
    room: {
      layoutId: layout.id,
      label: layout.label,
      condition: layout.condition,
      camera: sceneDefinition.camera,
      measurementSemantics,
      geometryPlacement: sceneDefinition.geometry,
      buildDepth: context.desiredDepth,
      bounds: topology.roomBounds,
      surfaces: topology.surfaces,
      features: topology.features
    },
    targetZones: buildTargetZones(context, topology),
    dimensionCallouts: buildDimensionCallouts(measurements, fields, measurementSemantics)
  };
  plan.dimensionCallouts = resolveGuidedDimensionCallouts(plan);

  assertFinitePlan(plan);
  return deepFreeze(plan);
}

function createRoomContext(categoryId, layout, sceneDefinition, measurements) {
  const wallWidth = positive(measurements.wallWidth, DEFAULTS.wallWidth);
  const ceilingHeight = positive(measurements.ceilingHeight, DEFAULTS.ceilingHeight);
  const desiredDepth = positive(measurements.desiredDepth, DEFAULTS.desiredDepth);
  const wallLeft = -wallWidth / 2;
  const wallRight = wallWidth / 2;
  const floorDepth = Math.max(84, wallWidth * 0.72, desiredDepth * 4.5);

  return {
    categoryId,
    layout,
    sceneDefinition,
    measurements,
    wallWidth,
    ceilingHeight,
    desiredDepth,
    wallLeft,
    wallRight,
    floorDepth
  };
}

function buildRoomTopology(context) {
  const {
    sceneDefinition,
    wallLeft,
    wallRight,
    wallWidth,
    ceilingHeight,
    desiredDepth,
    floorDepth
  } = context;
  const geometryStrategy = sceneDefinition.geometry.strategy;
  const surfaces = [
    surface("room-floor", "floor", box(
      wallLeft - 24,
      -1.1,
      -floorDepth,
      wallRight + 24,
      0,
      18
    )),
    surface("room-left-wall", "side-wall", box(
      wallLeft - 1.2,
      0,
      -floorDepth,
      wallLeft,
      ceilingHeight,
      1
    )),
    surface("room-right-wall", "side-wall", box(
      wallRight,
      0,
      -floorDepth,
      wallRight + 1.2,
      ceilingHeight,
      1
    ))
  ];
  const features = [];
  const landmarks = {};
  let roomMaxZ = 1.2;

  if (geometryStrategy === "recess") {
    const niche = resolveNicheBounds(context);
    landmarks.niche = niche;
    roomMaxZ = Math.max(roomMaxZ, niche.max.z + 1);
    addRecessSurfaces(surfaces, context, niche);
    features.push(feature("room-niche", "recess", niche, {
      measurements: {
        nicheWidth: measurementsNumber(context, "nicheWidth"),
        nicheHeight: measurementsNumber(context, "nicheHeight"),
        nicheDepth: measurementsNumber(context, "nicheDepth")
      }
    }));
  } else {
    surfaces.push(surface("room-back-wall", "back-wall", box(
      wallLeft,
      0,
      0,
      wallRight,
      ceilingHeight,
      1.2
    )));
  }

  if (geometryStrategy === "center-projection") {
    const projection = resolveProjectionBounds(context);
    landmarks.projection = projection;
    addProjectionSurfaces(surfaces, projection);
    features.push(feature("center-projection", "projection", projection));
  }

  if (geometryStrategy === "window-wall") {
    const windowBounds = resolveWindowBounds(context);
    landmarks.window = windowBounds;
    features.push(feature("room-window", "window", windowBounds));
  }

  if (geometryStrategy === "door-wall") {
    const doorBounds = resolveDoorBounds(context);
    landmarks.door = doorBounds;
    features.push(feature("room-door", "door", doorBounds, {
      measurements: {
        doorSwing: context.measurements.doorSwing,
        doorTrimWidth: measurementsNumber(context, "doorTrimWidth")
      }
    }));
  }

  if (geometryStrategy === "fireplace-wall") {
    const fireplaceBounds = resolveFireplaceBounds(context);
    landmarks.fireplace = fireplaceBounds;
    features.push(feature("room-fireplace", "fireplace", fireplaceBounds, {
      measurements: {
        mantelWidth: measurementsNumber(context, "mantelWidth"),
        mantelHeight: measurementsNumber(context, "mantelHeight")
      }
    }));
  }

  if (geometryStrategy === "corner-wall") {
    const returnDepth = clamp(
      measurementsNumber(context, "cornerReturn"),
      12,
      Math.max(12, floorDepth - 8)
    );
    landmarks.cornerReturn = returnDepth;
    surfaces.push(surface("room-corner-return", "return-wall", box(
      wallRight,
      0,
      -returnDepth,
      wallRight + 1.2,
      ceilingHeight,
      0
    )));
  }

  if (geometryStrategy === "between-openings") {
    const openings = resolveOpeningBounds(context);
    landmarks.openingLeft = openings.left;
    landmarks.openingRight = openings.right;
    if (getWidth(openings.left) > EPSILON) {
      features.push(feature("room-opening-left", "opening", openings.left));
    }
    if (getWidth(openings.right) > EPSILON) {
      features.push(feature("room-opening-right", "opening", openings.right));
    }
  }

  surfaces.push(...buildBaseboardSurfaces(context, landmarks));

  return {
    surfaces,
    features,
    landmarks,
    roomBounds: box(
      wallLeft,
      0,
      -floorDepth,
      wallRight,
      ceilingHeight,
      roomMaxZ
    )
  };
}

function addRecessSurfaces(surfaces, context, niche) {
  const { wallLeft, wallRight, ceilingHeight } = context;
  const reveal = Math.min(1.2, Math.max(0.55, context.wallWidth * 0.008));

  if (niche.min.x - wallLeft > EPSILON) {
    surfaces.push(surface("wall-left-of-recess", "back-wall", box(
      wallLeft, 0, 0, niche.min.x, ceilingHeight, 1.2
    )));
  }
  if (wallRight - niche.max.x > EPSILON) {
    surfaces.push(surface("wall-right-of-recess", "back-wall", box(
      niche.max.x, 0, 0, wallRight, ceilingHeight, 1.2
    )));
  }
  if (ceilingHeight - niche.max.y > EPSILON) {
    surfaces.push(surface("wall-above-recess", "back-wall", box(
      niche.min.x, niche.max.y, 0, niche.max.x, ceilingHeight, 1.2
    )));
  }

  surfaces.push(
    surface("recess-back", "recess-back", box(
      niche.min.x,
      niche.min.y,
      niche.max.z,
      niche.max.x,
      niche.max.y,
      niche.max.z + 1
    )),
    surface("recess-left-return", "recess-return", box(
      niche.min.x,
      niche.min.y,
      niche.min.z,
      niche.min.x + reveal,
      niche.max.y,
      niche.max.z
    )),
    surface("recess-right-return", "recess-return", box(
      niche.max.x - reveal,
      niche.min.y,
      niche.min.z,
      niche.max.x,
      niche.max.y,
      niche.max.z
    )),
    surface("recess-ceiling-return", "recess-return", box(
      niche.min.x,
      niche.max.y - reveal,
      niche.min.z,
      niche.max.x,
      niche.max.y,
      niche.max.z
    ))
  );
}

function addProjectionSurfaces(surfaces, projection) {
  const reveal = 1;
  surfaces.push(
    surface("projection-face", "projection-face", box(
      projection.min.x,
      projection.min.y,
      projection.min.z,
      projection.max.x,
      projection.max.y,
      projection.min.z + reveal
    )),
    surface("projection-left-side", "projection-side", box(
      projection.min.x,
      projection.min.y,
      projection.min.z,
      projection.min.x + reveal,
      projection.max.y,
      projection.max.z
    )),
    surface("projection-right-side", "projection-side", box(
      projection.max.x - reveal,
      projection.min.y,
      projection.min.z,
      projection.max.x,
      projection.max.y,
      projection.max.z
    ))
  );
  if (projection.max.y > projection.min.y + EPSILON) {
    surfaces.push(surface("projection-top", "projection-side", box(
      projection.min.x,
      projection.max.y - reveal,
      projection.min.z,
      projection.max.x,
      projection.max.y,
      projection.max.z
    )));
  }
}

function buildBaseboardSurfaces(context, landmarks) {
  const height = clamp(context.ceilingHeight * 0.045, 3.5, 5.5);
  const segments = [];

  if (landmarks.niche) {
    if (landmarks.niche.min.x - context.wallLeft > EPSILON) {
      segments.push([context.wallLeft, landmarks.niche.min.x]);
    }
    if (context.wallRight - landmarks.niche.max.x > EPSILON) {
      segments.push([landmarks.niche.max.x, context.wallRight]);
    }
  } else {
    segments.push([context.wallLeft, context.wallRight]);
  }

  return segments.map(([start, end], index) => surface(
    `room-baseboard-${index + 1}`,
    "room-baseboard",
    box(start, 0, -0.7, end, height, 0.7)
  ));
}

function addCategoryFeatures(context, topology) {
  const hasFeature = (matcher) => topology.features.some((candidate) => (
    matcher.test(`${candidate.kind} ${candidate.id}`)
  ));

  if (context.categoryId === "window-storage" && !hasFeature(/window/)) {
    const windowBounds = resolveCategoryWindowBounds(context, topology.features);
    topology.landmarks.window = windowBounds;
    topology.features.push(feature("concept-window", "window", windowBounds));
  }

  if (context.categoryId === "tv-unit" || context.measurements.tvAboveFireplace === "yes") {
    const screen = fitHorizontalFeature(
      context,
      resolveScreenBounds(context, topology.landmarks.fireplace),
      topology.features,
      {
        blockerPattern: /door|opening|window|radiator/,
        minimumWidth: 18
      }
    );
    topology.landmarks.tv = screen;
    topology.features.push(feature("concept-tv-screen", "tv-screen", screen));
  }

  const needsRadiator = context.categoryId === "radiator-cover"
    || context.measurements.radiatorBelowWindow === "yes";
  if (needsRadiator && !hasFeature(/radiator/)) {
    const radiator = fitHorizontalFeature(
      context,
      resolveRadiatorBounds(context, topology.landmarks.window),
      topology.features,
      {
        blockerPattern: /door|opening|fireplace|projection/,
        minimumWidth: 10
      }
    );
    topology.landmarks.radiator = radiator;
    topology.features.push(feature("room-radiator", "radiator", radiator));
  }
}

function buildTargetZones(context, topology) {
  const {
    sceneDefinition,
    categoryId,
    wallLeft,
    wallRight,
    ceilingHeight,
    desiredDepth
  } = context;
  const productPlacement = sceneDefinition.geometry.productPlacement;
  const productHeight = Math.max(24, ceilingHeight - 3);
  const exclusions = topology.features.map((candidate) => candidate.id);

  if (categoryId === "window-storage" && topology.landmarks.window) {
    const windowBounds = topology.landmarks.window;
    const zones = [];
    const belowHeight = Math.max(16, Math.min(windowBounds.min.y - 1.5, ceilingHeight * 0.36));
    zones.push(backWallZone(
      "product-below-window",
      "below",
      windowBounds.min.x,
      0,
      windowBounds.max.x,
      belowHeight,
      desiredDepth,
      exclusions
    ));
    if (windowBounds.min.x - wallLeft > 14) {
      zones.push(backWallZone(
        "product-window-right",
        "right",
        wallLeft + 1,
        0,
        windowBounds.min.x - 1.5,
        productHeight,
        desiredDepth,
        exclusions
      ));
    }
    if (wallRight - windowBounds.max.x > 14) {
      zones.push(backWallZone(
        "product-window-left",
        "left",
        windowBounds.max.x + 1.5,
        0,
        wallRight - 1,
        productHeight,
        desiredDepth,
        exclusions
      ));
    }
    return zones;
  }

  if (categoryId === "radiator-cover" && topology.landmarks.radiator) {
    const radiator = topology.landmarks.radiator;
    const padding = 4;
    const roomObstacleIds = exclusions.filter((id) => id !== "room-radiator");
    return [backWallZone(
      "product-radiator-cover",
      "below",
      clamp(radiator.min.x - padding, wallLeft, wallRight - 12),
      0,
      clamp(radiator.max.x + padding, wallLeft + 12, wallRight),
      Math.min(ceilingHeight * 0.46, radiator.max.y + padding),
      Math.max(desiredDepth, getDepth(radiator) + 2),
      roomObstacleIds
    )];
  }

  if (topology.landmarks.niche) {
    const niche = topology.landmarks.niche;
    const depth = Math.min(
      Math.max(desiredDepth, 1),
      Math.max(desiredDepth, getDepth(niche))
    );
    const backZ = niche.max.z;
    return [zone(
      "product-niche",
      "primary",
      box(
        niche.min.x + 0.8,
        0,
        backZ - depth,
        niche.max.x - 0.8,
        Math.min(niche.max.y - 1.5, productHeight),
        backZ
      ),
      {
        origin: point(niche.min.x + 0.8, 0, backZ - depth),
        widthAxis: X_AXIS,
        heightAxis: Y_AXIS,
        depthAxis: Z_AXIS
      },
      []
    )];
  }

  if (productPlacement === "corner-wrap") {
    const returnWidth = topology.landmarks.cornerReturn || 48;
    const backZone = backWallZone(
      "product-corner-back",
      "primary",
      wallLeft + 1,
      0,
      wallRight - desiredDepth - 1.5,
      productHeight,
      desiredDepth,
      exclusions
    );
    const returnDepth = Math.min(desiredDepth, Math.max(8, context.wallWidth * 0.14));
    const returnBounds = box(
      wallRight - returnDepth,
      0,
      -returnWidth,
      wallRight,
      productHeight,
      -1.5
    );
    const returnZone = zone(
      "product-corner-return",
      "return",
      returnBounds,
      {
        origin: point(wallRight - returnDepth, 0, -1.5),
        widthAxis: point(0, 0, -1),
        heightAxis: Y_AXIS,
        depthAxis: X_AXIS
      },
      []
    );
    return [backZone, returnZone];
  }

  if (productPlacement === "between-openings") {
    const left = topology.landmarks.openingLeft;
    const right = topology.landmarks.openingRight;
    const start = right ? right.max.x + 1 : wallLeft + 1;
    const end = left ? left.min.x - 1 : wallRight - 1;
    if (end - start >= 18) {
      return [backWallZone(
        "product-between-openings",
        "primary",
        start,
        0,
        end,
        productHeight,
        desiredDepth,
        []
      )];
    }
  }

  return [backWallZone(
    "product-main-wall",
    "primary",
    wallLeft + 1,
    0,
    wallRight - 1,
    productHeight,
    desiredDepth,
    exclusions
  )];
}

function buildDimensionCallouts(measurements, fields, semantics) {
  const fieldById = new Map(fields.map((field) => [field.id, field]));
  return semantics.flatMap((semantic) => {
    const field = fieldById.get(semantic.fieldId);
    const enteredValue = Number(measurements[semantic.fieldId]);
    if (!field || field.type !== "inches" || !Number.isFinite(enteredValue)) return [];
    return [{
      fieldId: field.id,
      code: field.code,
      label: field.label,
      enteredValue,
      semantic
    }];
  });
}

const SPATIAL_VALUE_EPSILON = 0.01;

function distanceBetween(start, end) {
  return Math.hypot(
    Number(end.x) - Number(start.x),
    Number(end.y) - Number(start.y),
    Number(end.z) - Number(start.z)
  );
}

/**
 * Resolve every Step 3 callout from the canonical semantic descriptors carried
 * by the plan. The renderer calls this same function after its safety-fit pass,
 * so there is no second field-ID-to-anchor implementation.
 */
export function resolveGuidedDimensionCallouts(plan) {
  const semanticsByField = new Map(
    (plan.room?.measurementSemantics || []).map((semantic) => [semantic.fieldId, semantic])
  );
  return (plan.dimensionCallouts || []).flatMap((callout) => {
    const semantic = callout.semantic || semanticsByField.get(callout.fieldId);
    if (!semantic) return [];
    const resolved = resolveCanonicalDimensionGeometry(plan, semantic);
    if (!resolved) {
      return isFinitePoint(callout.start) && isFinitePoint(callout.end)
        ? [{ ...callout, semantic }]
        : [];
    }
    const shownValue = distanceBetween(resolved.start, resolved.end);
    const enteredValue = Number(callout.enteredValue);
    return [{
      ...callout,
      semantic,
      axis: semantic.axis,
      start: resolved.start,
      end: resolved.end,
      witnesses: resolved.witnesses,
      value: Number(shownValue.toFixed(4)),
      enteredValue: Number.isFinite(enteredValue) ? enteredValue : null,
      adjusted: (
        Number.isFinite(enteredValue)
        && Math.abs(shownValue - enteredValue) > SPATIAL_VALUE_EPSILON
      )
    }];
  });
}

function resolveCanonicalDimensionGeometry(plan, semantic) {
  const line = semantic.line;
  if (!line?.strategy) {
    throw new TypeError(`Canonical measurement ${semantic.fieldId} is missing a line strategy.`);
  }
  const featureBounds = resolveSemanticFeatureBounds(plan, semantic);
  if (line.feature && !featureBounds) return null;
  const context = {
    plan,
    semantic,
    line,
    featureBounds,
    roomBounds: plan.room.bounds,
    wallZ: resolvePlanBackWallZ(plan.room)
  };
  const startWitness = resolveCanonicalAnchorPoint(semantic.startAnchor, context);
  const endWitness = resolveCanonicalAnchorPoint(semantic.endAnchor, context);
  const endpoints = resolveCanonicalDimensionLine(context, startWitness, endWitness);
  return {
    ...endpoints,
    witnesses: {
      start: { anchor: semantic.startAnchor, point: startWitness },
      end: { anchor: semantic.endAnchor, point: endWitness }
    }
  };
}

function resolveSemanticFeatureBounds(plan, semantic) {
  const featureKey = semantic.line?.feature;
  if (!featureKey) return null;
  const features = (plan.room?.features || []).filter((candidate) => (
    !candidate.renderHidden && candidate.bounds
  ));
  const matchers = {
    niche: (feature) => /recess|projection/.test(`${feature.kind} ${feature.id}`),
    window: (feature) => /window/.test(`${feature.kind} ${feature.id}`),
    door: (feature) => /door/.test(`${feature.kind} ${feature.id}`),
    fireplace: (feature) => /fireplace/.test(`${feature.kind} ${feature.id}`),
    screen: (feature) => /screen|television|tv-/.test(`${feature.kind} ${feature.id}`),
    radiator: (feature) => /radiator/.test(`${feature.kind} ${feature.id}`),
    "opening-left": (feature) => feature.id === "room-opening-left",
    "opening-right": (feature) => feature.id === "room-opening-right"
  };
  const feature = features.find(matchers[featureKey] || (() => false));
  if (feature?.bounds) return feature.bounds;
  if (featureKey === "opening-left" || featureKey === "opening-right") {
    return resolveVirtualOpeningBounds(plan, semantic, featureKey);
  }
  return null;
}

function resolveVirtualOpeningBounds(plan, semantic, featureKey) {
  const room = plan.room.bounds;
  const roomWidth = room.max.x - room.min.x;
  const width = clamp(
    Number(plan.measurements?.[semantic.fieldId]) || 0,
    0,
    roomWidth * 0.42
  );
  const height = (room.max.y - room.min.y) * 0.88;
  if (featureKey === "opening-left") {
    return box(room.max.x - width, room.min.y, -8, room.max.x, room.min.y + height, 0);
  }
  return box(room.min.x, room.min.y, -8, room.min.x + width, room.min.y + height, 0);
}

function resolveCanonicalAnchorPoint(anchor, context) {
  const { plan, semantic, line, featureBounds: bounds, roomBounds: room, wallZ } = context;
  const frontZ = bounds?.min.z ?? wallZ;
  const elevation = Number(line.elevation) || 0;
  const featureDepthX = resolveFeatureDepthLineX(bounds, line);
  const featureVisualLeftX = bounds?.max.x;
  const featureVisualRightX = bounds?.min.x;
  const featureHeightX = line.strategy === "feature-height-visual-right"
    ? featureVisualRightX
    : featureVisualLeftX;
  const mantelWidth = clamp(
    positive(plan.measurements?.mantelWidth, DEFAULTS.mantelWidth),
    1,
    room.max.x - room.min.x
  );
  const mantelHeight = clamp(
    positive(plan.measurements?.mantelHeight, DEFAULTS.mantelHeight),
    room.min.y,
    room.max.y
  );
  const trimWidth = positive(plan.measurements?.doorTrimWidth, DEFAULTS.doorTrimWidth);
  const at = (x, y, z) => point(x, y, z);

  switch (anchor) {
    case "wall-left-boundary":
      return at(room.min.x, room.max.y, wallZ);
    case "wall-right-boundary":
      return at(room.max.x, room.max.y, wallZ);
    case "visual-left-wall-boundary":
      return line.strategy === "opening-width"
        ? at(room.max.x, elevation, frontZ)
        : at(room.max.x, room.min.y, wallZ);
    case "visual-right-wall-boundary":
      return line.strategy === "opening-width"
        ? at(room.min.x, elevation, frontZ)
        : at(room.min.x, room.min.y, wallZ);
    case "finished-floor":
      return at(
        Number.isFinite(featureHeightX) ? featureHeightX : room.min.x,
        room.min.y,
        bounds ? frontZ : wallZ
      );
    case "ceiling-plane":
      return at(room.min.x, room.max.y, wallZ);
    case "wall-face":
      return bounds
        ? at(featureDepthX, elevation, bounds.max.z)
        : at(room.max.x, room.min.y, 0);
    case "product-front-plane":
      return at(room.max.x, room.min.y, -plan.room.buildDepth);
    case "niche-left-jamb":
    case "projection-left-edge":
    case "window-left-jamb":
    case "door-left-jamb":
    case "fireplace-left-jamb":
    case "radiator-left-edge":
      return at(bounds.min.x, bounds.max.y, frontZ);
    case "niche-right-jamb":
    case "projection-right-edge":
    case "window-right-jamb":
    case "door-right-jamb":
    case "fireplace-right-jamb":
    case "radiator-right-edge":
      return at(bounds.max.x, bounds.max.y, frontZ);
    case "niche-floor":
    case "door-threshold":
    case "fireplace-hearth":
    case "screen-bottom-edge":
      return at(featureHeightX, bounds.min.y, frontZ);
    case "niche-head":
    case "projection-head":
    case "window-head":
    case "door-head":
    case "fireplace-head":
    case "screen-top-edge":
    case "radiator-top-edge":
      return at(featureHeightX, bounds.max.y, frontZ);
    case "window-sill":
      return at(featureHeightX, bounds.min.y, frontZ);
    case "front-wall-plane":
      return at(featureDepthX, elevation, bounds.min.z);
    case "niche-back-wall":
      return at(featureDepthX, elevation, bounds.max.z);
    case "back-wall-plane":
      return bounds
        ? at(featureDepthX, elevation, bounds.max.z)
        : at(room.max.x, room.min.y, 0);
    case "projection-front-face":
    case "fireplace-front-face":
    case "radiator-front-face":
      return at(featureDepthX, elevation, bounds.min.z);
    case "niche-visual-left-edge":
    case "projection-visual-left-edge":
    case "window-visual-left-edge":
    case "door-visual-left-edge":
    case "fireplace-visual-left-edge":
      return at(featureVisualLeftX, room.min.y, wallZ);
    case "niche-visual-right-edge":
    case "projection-visual-right-edge":
    case "window-visual-right-edge":
    case "fireplace-visual-right-edge":
      return at(featureVisualRightX, room.min.y, wallZ);
    case "door-jamb":
      return at(bounds.min.x, bounds.max.y, frontZ);
    case "door-trim-outer-edge":
      return at(Math.min(bounds.max.x, bounds.min.x + trimWidth), bounds.max.y, frontZ);
    case "mantel-left-edge":
      return at(-mantelWidth / 2, mantelHeight, frontZ);
    case "mantel-right-edge":
      return at(mantelWidth / 2, mantelHeight, frontZ);
    case "mantel-top":
      return at(bounds.max.x, mantelHeight, frontZ);
    case "screen-bottom-left":
      return at(bounds.min.x, bounds.min.y, frontZ);
    case "screen-top-right":
      return at(bounds.max.x, bounds.max.y, frontZ);
    case "corner-return-front-edge":
      return at(room.max.x, room.min.y, -Math.max(0, Number(plan.measurements?.cornerReturn) || 0));
    case "left-opening-inner-jamb":
      return at(bounds.min.x, elevation, frontZ);
    case "right-opening-inner-jamb":
      return at(bounds.max.x, elevation, frontZ);
    default:
      throw new RangeError(
        `Unknown canonical measurement anchor ${anchor} for ${semantic.fieldId}.`
      );
  }
}

function resolveCanonicalDimensionLine(context, startWitness, endWitness) {
  const { plan, line, featureBounds: bounds, roomBounds: room } = context;
  const frontZ = -Math.max(plan.room.buildDepth, 10) - 5;
  const offset = Number(line.offset) || 0;
  const elevation = Number(line.elevation) || 0;
  const horizontal = (y, z) => ({
    start: point(startWitness.x, y, z),
    end: point(endWitness.x, y, z)
  });
  const vertical = (x, z) => ({
    start: point(x, startWitness.y, z),
    end: point(x, endWitness.y, z)
  });
  const depth = (x, y) => ({
    start: point(x, y, startWitness.z),
    end: point(x, y, endWitness.z)
  });

  switch (line.strategy) {
    case "room-width-overhead":
      return horizontal(room.max.y + offset, frontZ);
    case "room-height-visual-right":
      return vertical(room.min.x - offset, frontZ);
    case "room-depth-visual-left":
      return depth(room.max.x + offset, elevation);
    case "recess-width-overhead":
      return horizontal(
        Math.min(room.max.y + Number(line.ceilingOffset || 0), bounds.max.y + offset),
        bounds.min.z - Number(line.depthOffset || 0)
      );
    case "recess-height-visual-left":
      return vertical(
        bounds.max.x + offset,
        bounds.min.z - Number(line.depthOffset || 0)
      );
    case "feature-width-overhead":
      return horizontal(bounds.max.y + offset, frontZ);
    case "feature-height-visual-left":
      return vertical(bounds.max.x + offset, frontZ);
    case "feature-height-visual-right":
      return vertical(bounds.min.x - offset, frontZ);
    case "feature-depth":
      return depth(resolveFeatureDepthLineX(bounds, line), elevation);
    case "low-width":
      return horizontal(elevation, frontZ + Number(line.frontOffset || 0));
    case "mantel-width":
      return horizontal(startWitness.y, frontZ);
    case "mantel-height":
      return vertical(bounds.max.x + offset, frontZ);
    case "screen-diagonal":
      return {
        start: point(startWitness.x, startWitness.y, frontZ),
        end: point(endWitness.x, endWitness.y, frontZ)
      };
    case "corner-depth":
      return depth(room.max.x + offset, elevation);
    case "opening-width":
      return horizontal(elevation, frontZ);
    default:
      throw new RangeError(
        `Unknown canonical line strategy ${line.strategy} for ${context.semantic.fieldId}.`
      );
  }
}

function resolveFeatureDepthLineX(bounds, line) {
  if (!bounds) return 0;
  return line.side === "geometric-left"
    ? bounds.min.x + Number(line.offset || 0)
    : bounds.max.x + Number(line.offset || 0);
}

function resolvePlanBackWallZ(room) {
  const surface = (room.surfaces || []).find((candidate) => (
    /back-wall|recess-back|projection-face/.test(`${candidate.kind} ${candidate.id}`)
  ));
  return surface?.bounds
    ? (surface.bounds.min.z + surface.bounds.max.z) / 2
    : room.bounds.max.z;
}

function isFinitePoint(value) {
  return Boolean(
    value
    && ["x", "y", "z"].every((axis) => Number.isFinite(Number(value[axis])))
  );
}

function resolveNicheBounds(context) {
  const width = clamp(measurementsNumber(context, "nicheWidth"), 12, context.wallWidth);
  const height = clamp(measurementsNumber(context, "nicheHeight"), 24, context.ceilingHeight);
  const depth = clamp(measurementsNumber(context, "nicheDepth"), 2, Math.max(48, context.floorDepth * 0.5));
  const leftReturn = clamp(measurementsNumber(context, "leftReturn"), 0, Math.max(0, context.wallWidth - width));
  const rightReturn = clamp(measurementsNumber(context, "rightReturn"), 0, Math.max(0, context.wallWidth - width));
  const centered = -width / 2;
  // The room is viewed from negative Z, so positive world X is the customer's
  // visual left. Keep semantic left/right aligned with what they see.
  const fromVisualLeft = context.wallRight - leftReturn - width;
  const fromVisualRight = context.wallLeft + rightReturn;
  const alignment = context.sceneDefinition.geometry.alignment;
  const requestedStart = alignment === "visual-left"
    ? fromVisualLeft
    : alignment === "visual-right"
      ? fromVisualRight
      : centered;
  const minX = clamp(requestedStart, context.wallLeft, context.wallRight - width);
  return box(minX, 0, 0, minX + width, height, depth);
}

function resolveProjectionBounds(context) {
  const width = clamp(measurementsNumber(context, "nicheWidth"), 24, context.wallWidth * 0.7);
  const height = clamp(measurementsNumber(context, "nicheHeight"), 36, context.ceilingHeight);
  const depth = clamp(measurementsNumber(context, "nicheDepth"), 3, Math.max(3, context.desiredDepth));
  return box(-width / 2, 0, -depth, width / 2, height, 0);
}

function resolveWindowBounds(context) {
  const width = clamp(measurementsNumber(context, "windowWidth"), 8, context.wallWidth);
  const sill = clamp(measurementsNumber(context, "sillHeight"), 0, context.ceilingHeight - 8);
  const height = clamp(
    measurementsNumber(context, "windowHeight"),
    8,
    Math.max(8, context.ceilingHeight - sill)
  );
  const leftDistance = optionalNumber(context.measurements.windowLeftDistance);
  const rightDistance = optionalNumber(context.measurements.windowRightDistance);
  let minX = -width / 2;
  if (leftDistance !== null) minX = context.wallRight - leftDistance - width;
  else if (rightDistance !== null) minX = context.wallLeft + rightDistance;
  minX = clamp(minX, context.wallLeft, context.wallRight - width);
  return box(minX, sill, -0.9, minX + width, sill + height, 0);
}

function resolveCategoryWindowBounds(context, roomFeatures) {
  const windowBounds = resolveWindowBounds(context);
  if (
    optionalNumber(context.measurements.windowLeftDistance) !== null
    || optionalNumber(context.measurements.windowRightDistance) !== null
  ) {
    return windowBounds;
  }

  return fitHorizontalFeature(context, windowBounds, roomFeatures, {
    blockerPattern: /door|opening|fireplace|projection/,
    minimumWidth: 8
  });
}

function fitHorizontalFeature(context, desiredBounds, roomFeatures, options = {}) {
  const desiredWidth = getWidth(desiredBounds);
  const desiredCenter = (desiredBounds.min.x + desiredBounds.max.x) / 2;
  const blockerPattern = options.blockerPattern || /door|opening|fireplace/;
  const margin = Number.isFinite(options.margin) ? Math.max(0, options.margin) : 3;
  const minimumWidth = Math.min(
    desiredWidth,
    Math.max(1, Number(options.minimumWidth) || 1)
  );
  const blockers = roomFeatures
    .filter((candidate) => blockerPattern.test(`${candidate.kind} ${candidate.id}`))
    .map((candidate) => candidate.bounds)
    .filter((bounds) => (
      bounds
      && Math.min(desiredBounds.max.y, bounds.max.y) - Math.max(desiredBounds.min.y, bounds.min.y) > EPSILON
    ))
    .sort((first, second) => first.min.x - second.min.x);
  let intervals = [[context.wallLeft, context.wallRight]];
  for (const blocker of blockers) {
    const start = clamp(blocker.min.x - margin, context.wallLeft, context.wallRight);
    const end = clamp(blocker.max.x + margin, context.wallLeft, context.wallRight);
    intervals = subtractHorizontalInterval(intervals, start, end);
  }

  const candidates = intervals
    .filter(([start, end]) => end - start >= minimumWidth)
    .map(([start, end]) => {
      const width = Math.min(desiredWidth, end - start);
      const preferredMin = clamp(
        desiredCenter - width / 2,
        start,
        end - width
      );
      return {
        minX: preferredMin,
        width,
        clearance: end - start,
        centerDistance: Math.abs(preferredMin + width / 2 - desiredCenter)
      };
    })
    .sort((first, second) => (
      first.centerDistance - second.centerDistance
      || second.clearance - first.clearance
      || first.minX - second.minX
    ));
  if (!candidates.length) return desiredBounds;

  const minX = candidates[0].minX;
  return box(
    minX,
    desiredBounds.min.y,
    desiredBounds.min.z,
    minX + candidates[0].width,
    desiredBounds.max.y,
    desiredBounds.max.z
  );
}

function subtractHorizontalInterval(intervals, exclusionStart, exclusionEnd) {
  return intervals.flatMap(([start, end]) => {
    if (exclusionEnd <= start || exclusionStart >= end) return [[start, end]];
    const result = [];
    if (exclusionStart > start) result.push([start, exclusionStart]);
    if (exclusionEnd < end) result.push([exclusionEnd, end]);
    return result;
  });
}

function resolveDoorBounds(context) {
  const width = clamp(measurementsNumber(context, "doorWidth"), 12, context.wallWidth);
  const height = clamp(measurementsNumber(context, "doorHeight"), 24, context.ceilingHeight);
  const leftDistance = clamp(
    measurementsNumber(context, "doorLeftDistance"),
    0,
    Math.max(0, context.wallWidth - width)
  );
  const minX = context.wallRight - leftDistance - width;
  return box(minX, 0, -1.3, minX + width, height, 0);
}

function resolveFireplaceBounds(context) {
  const width = clamp(measurementsNumber(context, "fireplaceWidth"), 12, context.wallWidth);
  const height = clamp(measurementsNumber(context, "fireplaceHeight"), 12, context.ceilingHeight * 0.72);
  const depth = clamp(measurementsNumber(context, "fireplaceDepth"), 0, Math.max(1, context.floorDepth * 0.4));
  return box(-width / 2, 0, -depth, width / 2, height, 0);
}

function resolveScreenBounds(context, fireplace) {
  const diagonal = positive(context.measurements.tvScreenSize, DEFAULTS.tvScreenSize);
  const height = clamp(
    positive(context.measurements.tvHeight, diagonal * 0.49),
    10,
    context.ceilingHeight * 0.52
  );
  const diagonalWidth = Math.sqrt(Math.max(18 ** 2, diagonal ** 2 - height ** 2));
  const width = clamp(diagonalWidth, 18, context.wallWidth * 0.66);
  const centerY = fireplace
    ? clamp(
        Math.max(
          positive(context.measurements.mantelHeight, DEFAULTS.mantelHeight) + height / 2 + 5,
          context.ceilingHeight * 0.62
        ),
        height / 2 + 4,
        context.ceilingHeight - height / 2 - 4
      )
    : clamp(context.ceilingHeight * 0.58, height / 2 + 12, context.ceilingHeight - height / 2 - 6);
  return box(-width / 2, centerY - height / 2, -1.6, width / 2, centerY + height / 2, 0);
}

function resolveRadiatorBounds(context, windowBounds) {
  const width = clamp(measurementsNumber(context, "radiatorWidth"), 10, context.wallWidth * 0.9);
  const height = clamp(measurementsNumber(context, "radiatorHeight"), 8, context.ceilingHeight * 0.48);
  const depth = clamp(measurementsNumber(context, "radiatorDepth"), 2, Math.max(2, context.desiredDepth));
  const centerX = windowBounds
    ? (windowBounds.min.x + windowBounds.max.x) / 2
    : 0;
  return box(centerX - width / 2, 0, -depth, centerX + width / 2, height, 0);
}

function resolveOpeningBounds(context) {
  const leftWidth = clamp(
    measurementsNumber(context, "openingLeftDistance"),
    0,
    context.wallWidth * 0.42
  );
  const rightWidth = clamp(
    measurementsNumber(context, "openingRightDistance"),
    0,
    context.wallWidth * 0.42
  );
  const height = context.ceilingHeight * 0.88;
  return {
    left: box(context.wallRight - leftWidth, 0, -8, context.wallRight, height, 0),
    right: box(context.wallLeft, 0, -8, context.wallLeft + rightWidth, height, 0)
  };
}

function backWallZone(id, role, minX, minY, maxX, maxY, depth, excludes) {
  const safeDepth = Math.max(1, depth);
  const safeMinX = Math.min(minX, maxX - 1);
  const safeMaxX = Math.max(maxX, safeMinX + 1);
  const safeMinY = Math.min(minY, maxY - 1);
  const safeMaxY = Math.max(maxY, safeMinY + 1);
  return zone(
    id,
    role,
    box(safeMinX, safeMinY, -safeDepth, safeMaxX, safeMaxY, 0),
    {
      origin: point(safeMinX, safeMinY, -safeDepth),
      widthAxis: X_AXIS,
      heightAxis: Y_AXIS,
      depthAxis: Z_AXIS
    },
    excludes
  );
}

function zone(id, role, bounds, frame, excludes) {
  return {
    id,
    kind: "concept-product-zone",
    role,
    source: "guided-scene-plan",
    bounds,
    size: {
      width: getWidth(bounds),
      height: getHeight(bounds),
      depth: getDepth(bounds)
    },
    frame,
    excludes: [...excludes]
  };
}

function buildSelection(project, category, style) {
  const choice = getProductChoiceForSelection(category.id, style.id);
  return {
    productId: choice?.id || `${category.id}:${style.id}`,
    productLabel: choice?.label || style.label,
    categoryId: category.id,
    categoryLabel: category.label,
    styleId: style.id,
    styleLabel: style.label,
    finish: getFinish(project.finish),
    accentFinish: getFinish(project.accentFinish)
      || FINISH_OPTIONS.accent[0],
    details: {
      doorStyle: project.doorStyle || "shaker",
      hardware: project.hardware || "brass-pull",
      lighting: project.lighting || "warm-led",
      baseStyle: project.baseStyle || "flush-base",
      topTreatment: project.topTreatment || "small-crown"
    }
  };
}

function resolveMeasurements(source, fields) {
  const input = source && typeof source === "object" ? source : {};
  return Object.fromEntries(fields.map((field) => {
    const raw = input[field.id] ?? field.defaultValue ?? DEFAULTS[field.id] ?? null;
    if (field.type === "select") return [field.id, String(raw ?? "")];
    const value = optionalNumber(raw);
    const fallback = optionalNumber(field.defaultValue ?? DEFAULTS[field.id]);
    return [field.id, value ?? fallback];
  }));
}

function measurementsNumber(context, fieldId) {
  const value = optionalNumber(context.measurements[fieldId]);
  return value ?? DEFAULTS[fieldId] ?? 1;
}

function optionalNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  const mixed = normalized.match(/^(\d+(?:\.\d+)?)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    const denominator = Number(mixed[3]);
    return denominator ? Number(mixed[1]) + Number(mixed[2]) / denominator : null;
  }
  const fraction = normalized.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fraction) {
    const denominator = Number(fraction[2]);
    return denominator ? Number(fraction[1]) / denominator : null;
  }
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function positive(value, fallback) {
  const number = optionalNumber(value);
  return number !== null && number > EPSILON ? number : fallback;
}

function surface(id, kind, bounds) {
  return { id, kind, source: "guided-scene-plan", bounds };
}

function feature(id, kind, bounds, options = {}) {
  return {
    id,
    kind,
    source: "guided-scene-plan",
    bounds,
    ...options
  };
}

function box(minX, minY, minZ, maxX, maxY, maxZ) {
  const min = point(
    Math.min(minX, maxX),
    Math.min(minY, maxY),
    Math.min(minZ, maxZ)
  );
  const max = point(
    Math.max(minX, maxX),
    Math.max(minY, maxY),
    Math.max(minZ, maxZ)
  );
  return {
    min,
    max,
    size: {
      width: max.x - min.x,
      height: max.y - min.y,
      depth: max.z - min.z
    }
  };
}

function point(x, y, z) {
  return { x: Number(x), y: Number(y), z: Number(z) };
}

function getWidth(bounds) {
  return bounds.max.x - bounds.min.x;
}

function getHeight(bounds) {
  return bounds.max.y - bounds.min.y;
}

function getDepth(bounds) {
  return bounds.max.z - bounds.min.z;
}

function clamp(value, min, max) {
  const safeMin = Math.min(min, max);
  const safeMax = Math.max(min, max);
  return Math.min(safeMax, Math.max(safeMin, Number(value)));
}

function assertFinitePlan(plan) {
  const visit = (value, path) => {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new TypeError(`Non-finite guided scene value at ${path}.`);
    }
    if (!value || typeof value !== "object") return;
    Object.entries(value).forEach(([key, child]) => visit(child, `${path}.${key}`));
  };
  visit(plan, "plan");

  if (!plan.room.surfaces.length) {
    throw new TypeError("The guided scene plan requires room surfaces.");
  }
  if (!plan.targetZones.length || plan.targetZones.some((candidate) => (
    getWidth(candidate.bounds) <= 0
    || getHeight(candidate.bounds) <= 0
    || getDepth(candidate.bounds) <= 0
  ))) {
    throw new TypeError("The guided scene plan requires positive product target zones.");
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
