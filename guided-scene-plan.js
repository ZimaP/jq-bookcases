import {
  FINISH_OPTIONS,
  SHARED_ROOM_LAYOUTS,
  getCategory,
  getFinish,
  getLayout,
  getMeasurementDiagramSpec,
  getMeasurementFields,
  getProductChoiceForSelection,
  getStyle
} from "./guided-configurator-data.js?v=customization-ux-v1-20260824a";

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
  const layout = getLayout(category.id, project.layout)
    || SHARED_ROOM_LAYOUTS.find((candidate) => candidate.id === "clear-wall");
  const fields = getMeasurementFields(category.id, layout.id);
  const diagramFieldIds = new Set(
    getMeasurementDiagramSpec(category.id, layout.id).spans.map((span) => span.fieldId)
  );
  const measurements = resolveMeasurements(project.measurements, fields);
  const context = createRoomContext(category.id, layout, measurements);
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
      buildDepth: context.desiredDepth,
      bounds: topology.roomBounds,
      surfaces: topology.surfaces,
      features: topology.features
    },
    targetZones: buildTargetZones(context, topology),
    dimensionCallouts: buildDimensionCallouts(
      context,
      topology,
      fields.filter((field) => diagramFieldIds.has(field.id))
    )
  };

  assertFinitePlan(plan);
  return deepFreeze(plan);
}

function createRoomContext(categoryId, layout, measurements) {
  const wallWidth = positive(measurements.wallWidth, DEFAULTS.wallWidth);
  const ceilingHeight = positive(measurements.ceilingHeight, DEFAULTS.ceilingHeight);
  const desiredDepth = positive(measurements.desiredDepth, DEFAULTS.desiredDepth);
  const wallLeft = -wallWidth / 2;
  const wallRight = wallWidth / 2;
  const floorDepth = Math.max(84, wallWidth * 0.72, desiredDepth * 4.5);

  return {
    categoryId,
    layout,
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
    layout,
    wallLeft,
    wallRight,
    wallWidth,
    ceilingHeight,
    desiredDepth,
    floorDepth
  } = context;
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

  if (["niche-layout", "left-niche", "right-niche"].includes(layout.id)) {
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

  if (layout.id === "center-recess") {
    const projection = resolveProjectionBounds(context);
    landmarks.projection = projection;
    addProjectionSurfaces(surfaces, projection);
    features.push(feature("center-projection", "projection", projection));
  }

  if (layout.id === "window-wall") {
    const windowBounds = resolveWindowBounds(context);
    landmarks.window = windowBounds;
    features.push(feature("room-window", "window", windowBounds));
  }

  if (layout.id === "door-wall") {
    const doorBounds = resolveDoorBounds(context);
    landmarks.door = doorBounds;
    features.push(feature("room-door", "door", doorBounds, {
      measurements: {
        doorSwing: context.measurements.doorSwing,
        doorTrimWidth: measurementsNumber(context, "doorTrimWidth")
      }
    }));
  }

  if (layout.id === "fireplace-wall") {
    const fireplaceBounds = resolveFireplaceBounds(context);
    landmarks.fireplace = fireplaceBounds;
    features.push(feature("room-fireplace", "fireplace", fireplaceBounds, {
      measurements: {
        mantelWidth: measurementsNumber(context, "mantelWidth"),
        mantelHeight: measurementsNumber(context, "mantelHeight")
      }
    }));
  }

  if (layout.id === "corner-wall") {
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

  if (layout.id === "double-opening") {
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
    layout,
    categoryId,
    wallLeft,
    wallRight,
    ceilingHeight,
    desiredDepth
  } = context;
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

  if (layout.id === "corner-wall") {
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

  if (layout.id === "double-opening") {
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

function buildDimensionCallouts(context, topology, fields) {
  const fieldById = new Map(fields.map((field) => [field.id, field]));
  const callouts = [];
  for (const field of fields) {
    if (field.type !== "inches") continue;
    const value = Number(context.measurements[field.id]);
    if (!Number.isFinite(value)) continue;
    const endpoints = resolveCalloutEndpoints(field.id, context, topology);
    if (!endpoints) continue;
    callouts.push(buildDimensionCallout(field, value, endpoints));
  }

  for (const requiredId of ["wallWidth", "ceilingHeight", "desiredDepth"]) {
    if (callouts.some((candidate) => candidate.fieldId === requiredId)) continue;
    const field = fieldById.get(requiredId);
    const endpoints = resolveCalloutEndpoints(requiredId, context, topology);
    callouts.push(buildDimensionCallout(
      field || { id: requiredId, code: "", label: requiredId },
      context.measurements[requiredId],
      endpoints
    ));
  }
  return callouts;
}

function buildDimensionCallout(field, enteredValue, endpoints) {
  const shownValue = distanceBetween(endpoints.start, endpoints.end);
  const adjusted = (
    Number.isFinite(Number(enteredValue))
    && Math.abs(shownValue - Number(enteredValue)) > SPATIAL_VALUE_EPSILON
  );
  return {
    fieldId: field.id,
    code: field.code,
    label: field.label,
    value: Number(shownValue.toFixed(4)),
    enteredValue: Number.isFinite(Number(enteredValue)) ? Number(enteredValue) : null,
    adjusted,
    axis: endpoints.axis,
    start: endpoints.start,
    end: endpoints.end
  };
}

const SPATIAL_VALUE_EPSILON = 0.01;

function distanceBetween(start, end) {
  return Math.hypot(
    Number(end.x) - Number(start.x),
    Number(end.y) - Number(start.y),
    Number(end.z) - Number(start.z)
  );
}

function resolveCalloutEndpoints(fieldId, context, topology) {
  const {
    wallLeft,
    wallRight,
    wallWidth,
    ceilingHeight,
    desiredDepth,
    measurements
  } = context;
  const frontZ = -Math.max(desiredDepth, 10) - 5;
  const niche = topology.landmarks.niche || topology.landmarks.projection;
  const windowBounds = topology.landmarks.window;
  const door = topology.landmarks.door;
  const fireplace = topology.landmarks.fireplace;
  const tv = topology.landmarks.tv;
  const radiator = topology.landmarks.radiator;
  const horizontal = (minX, maxX, y, z = frontZ) => ({
    axis: "width",
    start: point(minX, y, z),
    end: point(maxX, y, z)
  });
  const vertical = (x, minY, maxY, z = frontZ) => ({
    axis: "height",
    start: point(x, minY, z),
    end: point(x, maxY, z)
  });
  const depth = (x, y, minZ, maxZ) => ({
    axis: "depth",
    start: point(x, y, minZ),
    end: point(x, y, maxZ)
  });

  switch (fieldId) {
    case "wallWidth":
      return horizontal(wallLeft, wallRight, ceilingHeight + 7);
    case "ceilingHeight":
      return vertical(wallLeft - 8, 0, ceilingHeight);
    case "desiredDepth":
      return depth(wallRight + 8, 4, -desiredDepth, 0);
    case "nicheWidth":
      return niche && horizontal(niche.min.x, niche.max.x, Math.min(ceilingHeight + 3, niche.max.y + 5), niche.min.z - 2);
    case "nicheHeight":
      return niche && vertical(niche.max.x + 5, niche.min.y, niche.max.y, niche.min.z - 2);
    case "nicheDepth":
      return niche && depth(niche.min.x + 6, 5, niche.min.z, niche.max.z);
    case "leftReturn":
      return niche && horizontal(niche.max.x, wallRight, 7, frontZ + 2);
    case "rightReturn":
      return niche && horizontal(wallLeft, niche.min.x, 7, frontZ + 2);
    case "windowWidth":
      return windowBounds && horizontal(windowBounds.min.x, windowBounds.max.x, windowBounds.max.y + 4);
    case "windowHeight":
      return windowBounds && vertical(windowBounds.max.x + 5, windowBounds.min.y, windowBounds.max.y);
    case "sillHeight":
      return windowBounds && vertical(windowBounds.min.x - 5, 0, windowBounds.min.y);
    case "windowLeftDistance":
      return windowBounds && horizontal(windowBounds.max.x, wallRight, 7);
    case "windowRightDistance":
      return windowBounds && horizontal(wallLeft, windowBounds.min.x, 7);
    case "doorWidth":
      return door && horizontal(door.min.x, door.max.x, door.max.y + 4);
    case "doorHeight":
      return door && vertical(door.max.x + 5, door.min.y, door.max.y);
    case "doorLeftDistance":
      return door && horizontal(door.max.x, wallRight, 7);
    case "doorTrimWidth":
      return door && horizontal(door.min.x, Math.min(door.max.x, door.min.x + positive(measurements.doorTrimWidth, 3.5)), door.max.y + 9);
    case "fireplaceWidth":
      return fireplace && horizontal(fireplace.min.x, fireplace.max.x, fireplace.max.y + 4);
    case "fireplaceHeight":
      return fireplace && vertical(fireplace.max.x + 5, fireplace.min.y, fireplace.max.y);
    case "mantelWidth": {
      if (!fireplace) return null;
      const width = clamp(positive(measurements.mantelWidth, 60), 1, wallWidth);
      return horizontal(-width / 2, width / 2, clamp(positive(measurements.mantelHeight, 48), 0, ceilingHeight));
    }
    case "mantelHeight":
      return vertical((fireplace?.max.x || 0) + 10, 0, clamp(positive(measurements.mantelHeight, 48), 0, ceilingHeight));
    case "fireplaceDepth":
      return fireplace && depth(fireplace.max.x + 8, 5, fireplace.min.z, fireplace.max.z);
    case "fireplaceLeftWidth":
      return fireplace && horizontal(fireplace.max.x, wallRight, 10);
    case "fireplaceRightWidth":
      return fireplace && horizontal(wallLeft, fireplace.min.x, 10);
    case "tvScreenSize":
      return tv && {
        axis: "diagonal",
        start: point(tv.min.x, tv.min.y, frontZ),
        end: point(tv.max.x, tv.max.y, frontZ)
      };
    case "tvHeight":
      return tv && vertical(tv.max.x + 5, tv.min.y, tv.max.y);
    case "radiatorWidth":
      return radiator && horizontal(radiator.min.x, radiator.max.x, radiator.max.y + 4);
    case "radiatorHeight":
      return radiator && vertical(radiator.max.x + 5, radiator.min.y, radiator.max.y);
    case "radiatorDepth":
      return radiator && depth(radiator.max.x + 7, 4, radiator.min.z, radiator.max.z);
    case "cornerReturn":
      return depth(wallRight + 5, 5, -(topology.landmarks.cornerReturn || measurements.cornerReturn), 0);
    case "openingLeftDistance":
      return topology.landmarks.openingLeft && horizontal(
        topology.landmarks.openingLeft.min.x,
        topology.landmarks.openingLeft.max.x,
        8
      );
    case "openingRightDistance":
      return topology.landmarks.openingRight && horizontal(
        topology.landmarks.openingRight.min.x,
        topology.landmarks.openingRight.max.x,
        8
      );
    default:
      return null;
  }
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
  const requestedStart = context.layout.id === "left-niche"
    ? fromVisualLeft
    : context.layout.id === "right-niche"
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
