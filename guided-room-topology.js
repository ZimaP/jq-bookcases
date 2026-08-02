/**
 * Pure room-topology resolution for the guided configurator.
 *
 * Coordinates use inches. X runs left-to-right across a front elevation, Y
 * runs up from the finished floor, and negative Z projects into the room. A
 * recessed niche therefore has a positive back-plane Z while a fireplace or
 * other positive obstruction extends into negative Z.
 *
 * This module deliberately has no DOM, rendering, or Three.js dependencies.
 */

export const GUIDED_ROOM_LAYOUT_IDS = Object.freeze([
  "niche-layout",
  "left-niche",
  "right-niche",
  "clear-wall",
  "fireplace-wall",
  "center-recess",
  "window-wall",
  "door-wall",
  "corner-wall",
  "double-opening"
]);

export const GUIDED_BOUNDARY_KINDS = Object.freeze([
  "wall",
  "return",
  "trim",
  "opening",
  "projection",
  "open-edge",
  "corner",
  "ceiling",
  "soffit",
  "floor"
]);

const LAYOUT_KINDS = Object.freeze({
  "niche-layout": "center-alcove",
  "left-niche": "unilateral-left-return",
  "right-niche": "unilateral-right-return",
  "clear-wall": "straight-wall",
  "fireplace-wall": "split-around-fireplace",
  "center-recess": "split-around-projection",
  "window-wall": "window-feature-wall",
  "door-wall": "door-feature-wall",
  "corner-wall": "l-shaped-corner",
  "double-opening": "wall-between-openings"
});

export const DEFAULT_ROOM_TOPOLOGY_POLICY = deepFreeze({
  tolerance: {
    geometry: 0.001,
    visualContact: 0.125,
    reconciliation: 0.125
  },
  featureClearance: {
    doorTrim: 1,
    windowTrim: 1,
    fireplaceTrim: 2,
    radiatorService: 2
  }
});

const BOUNDARY_KIND_SET = new Set(GUIDED_BOUNDARY_KINDS);
const LAYOUT_ID_SET = new Set(GUIDED_ROOM_LAYOUT_IDS);

/**
 * Resolve guided state into immutable physical room planes, features,
 * exclusion volumes, and installation zones.
 *
 * @param {object} project guided state or a room-shaped candidate
 * @param {object} options optional `{ policy, boundaries }` overrides
 * @returns {object} accepted RoomTopologySpec or named rejection
 */
export function resolveRoomTopology(project = {}, options = {}) {
  const source = objectOrEmpty(project);
  const measurements = objectOrEmpty(
    source.measurements ?? source.room?.measurements ?? options.measurements
  );
  const layoutId = normalizeLayoutId(
    source.layoutId ?? source.layout?.id ?? source.layout ?? source.room?.layoutId
  );
  const policy = mergePolicy(DEFAULT_ROOM_TOPOLOGY_POLICY, options.policy);
  const warnings = [];

  if (!layoutId || !LAYOUT_ID_SET.has(layoutId)) {
    return rejectTopology(layoutId, [diagnostic("UNKNOWN_ROOM_LAYOUT", {
      layout: layoutId || null
    })], warnings);
  }

  const wallWidth = positiveInches(measurements.wallWidth ?? source.wallWidth);
  const ceilingHeight = positiveInches(measurements.ceilingHeight ?? source.ceilingHeight);
  const desiredDepth = positiveInches(measurements.desiredDepth ?? source.desiredDepth);
  const missingBaseFields = [
    ["wallWidth", wallWidth],
    ["ceilingHeight", ceilingHeight],
    ["desiredDepth", desiredDepth]
  ].filter(([, value]) => value === null).map(([field]) => field);

  if (missingBaseFields.length) {
    return rejectTopology(layoutId, [diagnostic("MISSING_BASE_ROOM_DIMENSIONS", {
      fields: missingBaseFields
    })], warnings);
  }

  const wallLeft = -wallWidth / 2;
  const wallRight = wallWidth / 2;
  const boundaries = {
    ...objectOrEmpty(source.boundaries),
    ...objectOrEmpty(source.roomBoundaries),
    ...objectOrEmpty(options.boundaries)
  };
  const topology = {
    accepted: true,
    schemaVersion: 1,
    units: "inches",
    layoutId,
    layoutKind: LAYOUT_KINDS[layoutId],
    wallWidth,
    ceilingHeight,
    desiredDepth,
    floorPlaneY: 0,
    rearWallPlaneZ: 0,
    planes: {
      floor: plane("room-floor", "y", 0, "floor"),
      ceiling: plane("room-ceiling", "y", ceilingHeight, "ceiling"),
      rearWall: plane("room-rear-wall", "z", 0, "wall"),
      leftWall: plane("room-left-wall", "x", wallLeft, "wall"),
      rightWall: plane("room-right-wall", "x", wallRight, "wall")
    },
    features: {},
    exclusionVolumes: [],
    installationZones: [],
    cameraIntent: layoutId === "corner-wall" ? "corner-oblique" : "front",
    warnings
  };
  const context = {
    topology,
    measurements,
    policy,
    boundaries,
    wallLeft,
    wallRight,
    wallWidth,
    ceilingHeight,
    desiredDepth,
    errors: []
  };

  switch (layoutId) {
    case "niche-layout":
      resolveCenterNiche(context);
      break;
    case "left-niche":
      resolveOneSidedNiche(context, "left");
      break;
    case "right-niche":
      resolveOneSidedNiche(context, "right");
      break;
    case "clear-wall":
      resolveClearWall(context);
      break;
    case "fireplace-wall":
      resolveFireplaceWall(context);
      break;
    case "center-recess":
      resolveCenterProjection(context);
      break;
    case "window-wall":
      resolveWindowWall(context);
      break;
    case "door-wall":
      resolveDoorWall(context);
      break;
    case "corner-wall":
      resolveCornerWall(context);
      break;
    case "double-opening":
      resolveBetweenOpenings(context);
      break;
    default:
      context.errors.push(diagnostic("TOPOLOGY_RESOLVER_NOT_IMPLEMENTED", { layoutId }));
  }

  validateResolvedTopology(context);
  if (context.errors.length) return rejectTopology(layoutId, context.errors, warnings);
  return deepFreeze(topology);
}

function resolveCenterNiche(context) {
  const { measurements: m, topology, wallWidth, wallLeft, wallRight, ceilingHeight, desiredDepth, policy } = context;
  const width = positiveInches(m.nicheWidth);
  if (width === null) {
    context.errors.push(diagnostic("MISSING_NICHE_WIDTH"));
    return;
  }
  if (width - wallWidth > policy.tolerance.geometry) {
    context.errors.push(diagnostic("NICHE_WIDTH_EXCEEDS_WALL", { nicheWidth: width, wallWidth }));
    return;
  }

  const height = positiveInches(m.nicheHeight) ?? ceilingHeight;
  const depth = nonNegativeInches(m.nicheDepth) ?? desiredDepth;
  if (height - ceilingHeight > policy.tolerance.geometry) {
    context.errors.push(diagnostic("FEATURE_INTERSECTION", {
      featureId: "niche",
      field: "nicheHeight",
      featureValue: height,
      roomValue: ceilingHeight
    }));
    return;
  }

  const remaining = Math.max(0, wallWidth - width);
  const requestedLeft = optionalNonNegativeInches(m.leftReturn);
  const requestedRight = optionalNonNegativeInches(m.rightReturn);
  const leftReturn = requestedLeft ?? (requestedRight === null ? remaining / 2 : remaining - requestedRight);
  const rightReturn = requestedRight ?? remaining - leftReturn;
  if (
    leftReturn < -policy.tolerance.geometry
    || rightReturn < -policy.tolerance.geometry
    || Math.abs(leftReturn + width + rightReturn - wallWidth) > policy.tolerance.reconciliation
  ) {
    context.errors.push(diagnostic("ROOM_WIDTH_RECONCILIATION_FAILED", {
      wallWidth,
      nicheWidth: width,
      leftReturn,
      rightReturn
    }));
    return;
  }

  const left = wallLeft + Math.max(0, leftReturn);
  const right = left + width;
  const topKind = height < ceilingHeight - policy.tolerance.visualContact ? "soffit" : "ceiling";
  topology.features.niche = feature("niche", "recess", bounds(left, 0, 0, right, height, depth), {
    width,
    height,
    depth,
    leftReturn: Math.max(0, leftReturn),
    rightReturn: Math.max(0, rightReturn)
  });
  topology.installationZones.push(rectZone({
    id: "center",
    role: "primary",
    left,
    right,
    bottom: 0,
    top: height,
    back: depth,
    leftKind: "return",
    rightKind: "return",
    topKind
  }));
  addDepthProjectionWarning(context, "niche", depth);

  // Preserve the physical room-envelope planes separately from the recessed
  // installation back plane.
  topology.planes.nicheBack = plane("niche-back", "z", depth, "wall");
  topology.planes.nicheLeftReturn = plane("niche-left-return", "x", left, "return");
  topology.planes.nicheRightReturn = plane("niche-right-return", "x", right, "return");
  if (right > wallRight + policy.tolerance.geometry) {
    context.errors.push(diagnostic("FEATURE_INTERSECTION", { featureId: "niche" }));
  }
}

function resolveOneSidedNiche(context, side) {
  const { measurements: m, topology, wallWidth, wallLeft, wallRight, ceilingHeight, desiredDepth, policy } = context;
  const width = positiveInches(m.nicheWidth) ?? wallWidth;
  const height = positiveInches(m.nicheHeight) ?? ceilingHeight;
  const depth = nonNegativeInches(m.nicheDepth) ?? desiredDepth;
  if (width - wallWidth > policy.tolerance.geometry) {
    context.errors.push(diagnostic("NICHE_WIDTH_EXCEEDS_WALL", { nicheWidth: width, wallWidth }));
    return;
  }
  if (height - ceilingHeight > policy.tolerance.geometry) {
    context.errors.push(diagnostic("FEATURE_INTERSECTION", {
      featureId: "niche",
      field: "nicheHeight",
      featureValue: height,
      roomValue: ceilingHeight
    }));
    return;
  }

  const offset = side === "left"
    ? (optionalNonNegativeInches(m.leftReturn) ?? 0)
    : (optionalNonNegativeInches(m.rightReturn) ?? 0);
  const left = side === "left" ? wallLeft + offset : wallRight - offset - width;
  const right = left + width;
  if (left < wallLeft - policy.tolerance.geometry || right > wallRight + policy.tolerance.geometry) {
    context.errors.push(diagnostic("ROOM_WIDTH_RECONCILIATION_FAILED", {
      wallWidth,
      nicheWidth: width,
      side,
      offset
    }));
    return;
  }

  const openSide = side === "left" ? "right" : "left";
  const resolvedOpenKind = resolveBoundaryKind(
    context,
    openSide,
    m[`${openSide}BoundaryKind`] ?? "open-edge",
    ["wall", "trim", "open-edge"]
  );
  const leftKind = side === "left" ? "return" : resolvedOpenKind;
  const rightKind = side === "right" ? "return" : resolvedOpenKind;
  const topKind = height < ceilingHeight - policy.tolerance.visualContact ? "soffit" : "ceiling";

  topology.features.niche = feature("niche", "recess", bounds(left, 0, 0, right, height, depth), {
    side,
    width,
    height,
    depth,
    returnSide: side,
    openSide,
    offset
  });
  topology.installationZones.push(rectZone({
    id: "main",
    role: "primary",
    left,
    right,
    bottom: 0,
    top: height,
    back: depth,
    leftKind,
    rightKind,
    topKind
  }));
  topology.planes.nicheBack = plane("niche-back", "z", depth, "wall");
  topology.planes[`${side}NicheReturn`] = plane(
    `${side}-niche-return`,
    "x",
    side === "left" ? left : right,
    "return"
  );
  addDepthProjectionWarning(context, "niche", depth);
}

function resolveClearWall(context) {
  const { topology, wallLeft, wallRight, ceilingHeight, measurements: m } = context;
  topology.installationZones.push(rectZone({
    id: "main",
    role: "primary",
    left: wallLeft,
    right: wallRight,
    bottom: 0,
    top: ceilingHeight,
    back: 0,
    leftKind: resolveBoundaryKind(context, "left", m.leftBoundaryKind ?? "wall", ["wall", "open-edge"]),
    rightKind: resolveBoundaryKind(context, "right", m.rightBoundaryKind ?? "wall", ["wall", "open-edge"]),
    topKind: resolveTopBoundaryKind(context, m.topBoundaryKind)
  }));
}

function resolveFireplaceWall(context) {
  const { measurements: m, topology, wallLeft, wallRight, wallWidth, ceilingHeight, desiredDepth, policy } = context;
  const required = requiredPositiveMeasurements(m, ["fireplaceWidth", "fireplaceHeight", "mantelWidth", "mantelHeight"]);
  if (required.missing.length) {
    context.errors.push(diagnostic("MISSING_FEATURE_MEASUREMENTS", {
      featureId: "fireplace",
      fields: required.missing
    }));
    return;
  }
  const fireplaceWidth = required.values.fireplaceWidth;
  const fireplaceHeight = required.values.fireplaceHeight;
  const mantelWidth = required.values.mantelWidth;
  const mantelHeight = required.values.mantelHeight;
  const projectionDepth = nonNegativeInches(m.fireplaceDepth) ?? 0;
  if (
    fireplaceWidth > wallWidth + policy.tolerance.geometry
    || mantelWidth > wallWidth + policy.tolerance.geometry
    || fireplaceHeight > ceilingHeight + policy.tolerance.geometry
    || mantelHeight > ceilingHeight + policy.tolerance.geometry
  ) {
    context.errors.push(diagnostic("FEATURE_INTERSECTION", {
      featureId: "fireplace",
      wallWidth,
      ceilingHeight
    }));
    return;
  }

  const clearance = policy.featureClearance.fireplaceTrim;
  const openingBounds = bounds(
    -fireplaceWidth / 2,
    0,
    -Math.max(projectionDepth, desiredDepth),
    fireplaceWidth / 2,
    fireplaceHeight,
    0
  );
  const mantelBounds = bounds(
    -mantelWidth / 2,
    Math.max(0, mantelHeight - 2),
    -projectionDepth,
    mantelWidth / 2,
    Math.min(ceilingHeight, mantelHeight + 2),
    0
  );
  const blockedHalfWidth = Math.max(fireplaceWidth, mantelWidth) / 2 + clearance;
  const blockedTop = Math.min(ceilingHeight, Math.max(fireplaceHeight, mantelHeight + 2) + clearance);
  const serviceBounds = bounds(
    -blockedHalfWidth,
    0,
    -Math.max(projectionDepth, desiredDepth),
    blockedHalfWidth,
    blockedTop,
    0
  );

  topology.features.fireplace = feature("fireplace", "fireplace", openingBounds, {
    openingWidth: fireplaceWidth,
    openingHeight: fireplaceHeight,
    projectionDepth,
    mantelWidth,
    mantelHeight,
    mantelBounds
  });
  topology.exclusionVolumes.push(
    exclusion("fireplace-opening-exclusion", "fireplace", "opening", openingBounds),
    exclusion("fireplace-service-exclusion", "fireplace", "service", serviceBounds, { clearance })
  );

  const maximumSideWidth = wallWidth / 2 - blockedHalfWidth;
  const requestedLeftWidth = optionalPositiveInches(m.fireplaceLeftWidth);
  const requestedRightWidth = optionalPositiveInches(m.fireplaceRightWidth);
  const leftWidth = requestedLeftWidth ?? maximumSideWidth;
  const rightWidth = requestedRightWidth ?? maximumSideWidth;
  if (
    maximumSideWidth <= policy.tolerance.geometry
    || leftWidth > maximumSideWidth + policy.tolerance.geometry
    || rightWidth > maximumSideWidth + policy.tolerance.geometry
  ) {
    context.errors.push(diagnostic("OPENING_CLEARANCE_FAILED", {
      featureId: "fireplace",
      availableEach: Math.max(0, maximumSideWidth),
      requestedLeftWidth: leftWidth,
      requestedRightWidth: rightWidth
    }));
    return;
  }

  topology.installationZones.push(
    rectZone({
      id: "left",
      role: "left",
      left: wallLeft,
      right: wallLeft + leftWidth,
      bottom: 0,
      top: ceilingHeight,
      back: 0,
      leftKind: "wall",
      rightKind: "projection",
      topKind: "ceiling",
      featureClearances: [featureClearance("fireplace", clearance, "right")],
      exclusionVolumeIds: ["fireplace-opening-exclusion", "fireplace-service-exclusion"]
    }),
    rectZone({
      id: "right",
      role: "right",
      left: wallRight - rightWidth,
      right: wallRight,
      bottom: 0,
      top: ceilingHeight,
      back: 0,
      leftKind: "projection",
      rightKind: "wall",
      topKind: "ceiling",
      featureClearances: [featureClearance("fireplace", clearance, "left")],
      exclusionVolumeIds: ["fireplace-opening-exclusion", "fireplace-service-exclusion"]
    })
  );
  if (ceilingHeight - blockedTop > policy.tolerance.geometry) {
    topology.installationZones.push(rectZone({
      id: "optional-over-mantel",
      role: "over-feature",
      left: -blockedHalfWidth,
      right: blockedHalfWidth,
      bottom: blockedTop,
      top: ceilingHeight,
      back: 0,
      leftKind: "opening",
      rightKind: "opening",
      topKind: "ceiling",
      featureClearances: [featureClearance("fireplace", clearance, "below")],
      exclusionVolumeIds: ["fireplace-opening-exclusion", "fireplace-service-exclusion"],
      installByDefault: false
    }));
  }
}

function resolveCenterProjection(context) {
  const { measurements: m, topology, wallLeft, wallRight, wallWidth, ceilingHeight, desiredDepth, policy } = context;
  const width = positiveInches(m.projectionWidth ?? m.nicheWidth);
  const height = positiveInches(m.projectionHeight ?? m.nicheHeight);
  const depth = positiveInches(m.projectionDepth ?? m.nicheDepth);
  const missing = [
    ["projectionWidth", width],
    ["projectionHeight", height],
    ["projectionDepth", depth]
  ].filter(([, value]) => value === null).map(([field]) => field);
  if (missing.length) {
    context.errors.push(diagnostic("MISSING_FEATURE_MEASUREMENTS", {
      featureId: "center-projection",
      fields: missing
    }));
    return;
  }
  if (width >= wallWidth - policy.tolerance.geometry || height > ceilingHeight + policy.tolerance.geometry) {
    context.errors.push(diagnostic("FEATURE_INTERSECTION", {
      featureId: "center-projection",
      wallWidth,
      ceilingHeight
    }));
    return;
  }

  const projectionBounds = bounds(-width / 2, 0, -depth, width / 2, height, 0);
  topology.features.projection = feature("center-projection", "projection", projectionBounds, {
    width,
    height,
    depth
  });
  topology.exclusionVolumes.push(exclusion(
    "center-projection-exclusion",
    "center-projection",
    "projection",
    projectionBounds
  ));
  topology.installationZones.push(
    rectZone({
      id: "left",
      role: "left",
      left: wallLeft,
      right: -width / 2,
      bottom: 0,
      top: ceilingHeight,
      back: 0,
      leftKind: "wall",
      rightKind: "projection",
      topKind: "ceiling",
      exclusionVolumeIds: ["center-projection-exclusion"]
    }),
    rectZone({
      id: "right",
      role: "right",
      left: width / 2,
      right: wallRight,
      bottom: 0,
      top: ceilingHeight,
      back: 0,
      leftKind: "projection",
      rightKind: "wall",
      topKind: "ceiling",
      exclusionVolumeIds: ["center-projection-exclusion"]
    })
  );
  if (ceilingHeight - height > policy.tolerance.geometry) {
    topology.installationZones.push(rectZone({
      id: "optional-surround",
      role: "over-feature",
      left: -width / 2,
      right: width / 2,
      bottom: height,
      top: ceilingHeight,
      back: -depth,
      leftKind: "projection",
      rightKind: "projection",
      topKind: "ceiling",
      exclusionVolumeIds: ["center-projection-exclusion"],
      installByDefault: false
    }));
  }
  if (desiredDepth > depth + policy.tolerance.visualContact) {
    topology.warnings.push(diagnostic("DEPTH_EXCEEDS_ALLOWED_PROJECTION", {
      featureId: "center-projection",
      desiredDepth,
      projectionDepth: depth,
      projectionBeyondFeature: desiredDepth - depth
    }));
  }
}

function resolveWindowWall(context) {
  const { measurements: m, topology, wallLeft, wallRight, wallWidth, ceilingHeight, desiredDepth, policy } = context;
  const required = requiredPositiveMeasurements(m, ["windowWidth", "windowHeight", "sillHeight"]);
  if (required.missing.length) {
    context.errors.push(diagnostic("MISSING_FEATURE_MEASUREMENTS", {
      featureId: "window",
      fields: required.missing
    }));
    return;
  }
  const windowWidth = required.values.windowWidth;
  const windowHeight = required.values.windowHeight;
  const sillHeight = required.values.sillHeight;
  if (
    windowWidth > wallWidth + policy.tolerance.geometry
    || sillHeight + windowHeight > ceilingHeight + policy.tolerance.geometry
  ) {
    context.errors.push(diagnostic("FEATURE_INTERSECTION", {
      featureId: "window",
      wallWidth,
      ceilingHeight
    }));
    return;
  }

  const leftDistance = optionalNonNegativeInches(m.windowLeftDistance);
  const rightDistance = optionalNonNegativeInches(m.windowRightDistance);
  if (
    leftDistance !== null
    && rightDistance !== null
    && Math.abs(leftDistance + windowWidth + rightDistance - wallWidth) > policy.tolerance.reconciliation
  ) {
    context.errors.push(diagnostic("ROOM_WIDTH_RECONCILIATION_FAILED", {
      featureId: "window",
      wallWidth,
      windowWidth,
      leftDistance,
      rightDistance
    }));
    return;
  }
  const minX = leftDistance !== null
    ? wallLeft + leftDistance
    : rightDistance !== null
      ? wallRight - rightDistance - windowWidth
      : -windowWidth / 2;
  const maxX = minX + windowWidth;
  if (minX < wallLeft - policy.tolerance.geometry || maxX > wallRight + policy.tolerance.geometry) {
    context.errors.push(diagnostic("OPENING_CLEARANCE_FAILED", { featureId: "window" }));
    return;
  }

  const trimClearance = policy.featureClearance.windowTrim;
  const windowBounds = bounds(minX, sillHeight, -desiredDepth, maxX, sillHeight + windowHeight, 0);
  const windowExclusionBounds = bounds(
    Math.max(wallLeft, minX - trimClearance),
    Math.max(0, sillHeight - trimClearance),
    -desiredDepth,
    Math.min(wallRight, maxX + trimClearance),
    Math.min(ceilingHeight, sillHeight + windowHeight + trimClearance),
    0
  );
  topology.features.window = feature("window", "window", windowBounds, {
    width: windowWidth,
    height: windowHeight,
    sillHeight,
    leftDistance: minX - wallLeft,
    rightDistance: wallRight - maxX
  });
  topology.exclusionVolumes.push(exclusion(
    "window-opening-exclusion",
    "window",
    "opening",
    windowExclusionBounds,
    { clearance: trimClearance }
  ));

  const hasRadiator = normalizeYesNo(m.radiatorBelowWindow) === "yes";
  const radiatorExclusionIds = [];
  if (hasRadiator) {
    const radiatorRequired = requiredPositiveMeasurements(m, ["radiatorWidth", "radiatorHeight", "radiatorDepth"]);
    if (radiatorRequired.missing.length) {
      context.errors.push(diagnostic("MISSING_FEATURE_MEASUREMENTS", {
        featureId: "radiator",
        fields: radiatorRequired.missing
      }));
      return;
    }
    const radiatorWidth = radiatorRequired.values.radiatorWidth;
    const radiatorHeight = radiatorRequired.values.radiatorHeight;
    const radiatorDepth = radiatorRequired.values.radiatorDepth;
    if (radiatorWidth > wallWidth + policy.tolerance.geometry || radiatorHeight > sillHeight + policy.tolerance.geometry) {
      context.errors.push(diagnostic("FEATURE_INTERSECTION", { featureId: "radiator" }));
      return;
    }
    const radiatorCenter = (minX + maxX) / 2;
    const radiatorBounds = bounds(
      radiatorCenter - radiatorWidth / 2,
      0,
      -radiatorDepth,
      radiatorCenter + radiatorWidth / 2,
      radiatorHeight,
      0
    );
    const service = policy.featureClearance.radiatorService;
    const radiatorServiceBounds = bounds(
      Math.max(wallLeft, radiatorBounds.minX - service),
      0,
      // The service exclusion is the measured obstruction plus its required
      // access/ventilation clearance. Extending it to the selected cabinet
      // depth incorrectly classified the removable front face as an
      // obstruction, even when the cover provided the required clear depth.
      -(radiatorDepth + service),
      Math.min(wallRight, radiatorBounds.maxX + service),
      Math.min(ceilingHeight, radiatorHeight + service),
      0
    );
    topology.features.radiator = feature("radiator", "radiator", radiatorBounds, {
      width: radiatorWidth,
      height: radiatorHeight,
      depth: radiatorDepth,
      valveLocation: String(m.valveLocation ?? "unknown")
    });
    topology.exclusionVolumes.push(exclusion(
      "radiator-service-exclusion",
      "radiator",
      "service",
      radiatorServiceBounds,
      { clearance: service, ventilationRequired: true }
    ));
    radiatorExclusionIds.push("radiator-service-exclusion");
  }

  addHorizontalFeatureZones(context, {
    featureId: "window",
    minX,
    maxX,
    featureBottom: sillHeight,
    featureTop: sillHeight + windowHeight,
    clearance: trimClearance,
    exclusionVolumeIds: ["window-opening-exclusion", ...radiatorExclusionIds],
    belowInstallByDefault: !hasRadiator
  });
}

function resolveDoorWall(context) {
  const { measurements: m, topology, wallLeft, wallRight, wallWidth, ceilingHeight, desiredDepth, policy } = context;
  const required = requiredPositiveMeasurements(m, ["doorWidth", "doorHeight"]);
  if (required.missing.length) {
    context.errors.push(diagnostic("MISSING_FEATURE_MEASUREMENTS", {
      featureId: "door",
      fields: required.missing
    }));
    return;
  }
  const doorWidth = required.values.doorWidth;
  const doorHeight = required.values.doorHeight;
  const leftDistance = optionalNonNegativeInches(m.doorLeftDistance) ?? (wallWidth - doorWidth) / 2;
  const trimWidth = nonNegativeInches(m.doorTrimWidth) ?? 0;
  const minX = wallLeft + leftDistance;
  const maxX = minX + doorWidth;
  if (
    minX < wallLeft - policy.tolerance.geometry
    || maxX > wallRight + policy.tolerance.geometry
    || doorHeight > ceilingHeight + policy.tolerance.geometry
  ) {
    context.errors.push(diagnostic("OPENING_CLEARANCE_FAILED", { featureId: "door" }));
    return;
  }

  const serviceClearance = trimWidth + policy.featureClearance.doorTrim;
  const swing = String(m.doorSwing ?? "left-in");
  const doorBounds = bounds(minX, 0, -desiredDepth, maxX, doorHeight, 0);
  const trimBounds = bounds(
    Math.max(wallLeft, minX - serviceClearance),
    0,
    -desiredDepth,
    Math.min(wallRight, maxX + serviceClearance),
    Math.min(ceilingHeight, doorHeight + serviceClearance),
    0
  );
  const swingBounds = bounds(
    Math.max(wallLeft, minX - serviceClearance),
    0,
    -Math.max(desiredDepth, doorWidth),
    Math.min(wallRight, maxX + serviceClearance),
    doorHeight,
    0
  );
  topology.features.door = feature("door", "door", doorBounds, {
    width: doorWidth,
    height: doorHeight,
    leftDistance,
    trimWidth,
    swing,
    trimBounds
  });
  topology.exclusionVolumes.push(
    exclusion("door-opening-exclusion", "door", "opening", trimBounds, { clearance: serviceClearance }),
    exclusion("door-swing-exclusion", "door", "service", swingBounds, { swing })
  );

  const safeLeft = Math.max(wallLeft, minX - serviceClearance);
  const safeRight = Math.min(wallRight, maxX + serviceClearance);
  const exclusionIds = ["door-opening-exclusion", "door-swing-exclusion"];
  if (safeLeft - wallLeft > policy.tolerance.geometry) {
    topology.installationZones.push(rectZone({
      id: "left",
      role: "left",
      left: wallLeft,
      right: safeLeft,
      bottom: 0,
      top: ceilingHeight,
      back: 0,
      leftKind: "wall",
      rightKind: "trim",
      topKind: "ceiling",
      featureClearances: [featureClearance("door", serviceClearance, "right")],
      exclusionVolumeIds: exclusionIds
    }));
  }
  if (wallRight - safeRight > policy.tolerance.geometry) {
    topology.installationZones.push(rectZone({
      id: "right",
      role: "right",
      left: safeRight,
      right: wallRight,
      bottom: 0,
      top: ceilingHeight,
      back: 0,
      leftKind: "trim",
      rightKind: "wall",
      topKind: "ceiling",
      featureClearances: [featureClearance("door", serviceClearance, "left")],
      exclusionVolumeIds: exclusionIds
    }));
  }
  const overDoorBottom = Math.min(ceilingHeight, doorHeight + serviceClearance);
  if (ceilingHeight - overDoorBottom > policy.tolerance.geometry) {
    topology.installationZones.push(rectZone({
      id: "optional-over-door",
      role: "over-feature",
      left: safeLeft,
      right: safeRight,
      bottom: overDoorBottom,
      top: ceilingHeight,
      back: 0,
      leftKind: "trim",
      rightKind: "trim",
      topKind: "ceiling",
      featureClearances: [featureClearance("door", serviceClearance, "below")],
      exclusionVolumeIds: exclusionIds,
      installByDefault: false
    }));
  }
}

function resolveCornerWall(context) {
  const { measurements: m, topology, wallLeft, wallRight, ceilingHeight, desiredDepth, policy } = context;
  const returnLength = positiveInches(m.cornerReturn);
  if (returnLength === null) {
    context.errors.push(diagnostic("MISSING_CORNER_RETURN"));
    return;
  }
  if (returnLength <= desiredDepth + policy.tolerance.geometry) {
    context.errors.push(diagnostic("INSTALLATION_ZONE_TOO_NARROW", {
      zoneId: "return-run",
      cornerReturn: returnLength,
      requiredCornerDepth: desiredDepth
    }));
    return;
  }

  const primaryRight = wallRight - desiredDepth;
  topology.features.corner = feature("corner", "corner", bounds(
    wallRight - desiredDepth,
    0,
    -desiredDepth,
    wallRight,
    ceilingHeight,
    0
  ), {
    orientation: String(m.cornerOrientation ?? "right"),
    primaryRun: context.wallWidth,
    returnRun: returnLength,
    joinDepth: desiredDepth
  });
  topology.planes.cornerReturnWall = plane("corner-return-wall", "x", wallRight, "wall");
  topology.installationZones.push(
    rectZone({
      id: "primary-run",
      role: "primary-run",
      left: wallLeft,
      right: primaryRight,
      bottom: 0,
      top: ceilingHeight,
      back: 0,
      leftKind: "wall",
      rightKind: "corner",
      topKind: "ceiling"
    }),
    rectZone({
      id: "return-run",
      role: "return-run",
      left: desiredDepth,
      right: returnLength,
      bottom: 0,
      top: ceilingHeight,
      back: 0,
      leftKind: "corner",
      rightKind: "open-edge",
      topKind: "ceiling",
      orientation: orientation(
        { x: wallRight, y: 0, z: 0 },
        [0, 0, -1],
        [0, 1, 0],
        [-1, 0, 0]
      )
    }),
    rectZone({
      id: "corner",
      role: "corner-join",
      left: 0,
      right: desiredDepth,
      bottom: 0,
      top: ceilingHeight,
      back: 0,
      leftKind: "corner",
      rightKind: "corner",
      topKind: "ceiling",
      orientation: orientation(
        { x: wallRight - desiredDepth, y: 0, z: 0 },
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, -1]
      )
    })
  );
}

function resolveBetweenOpenings(context) {
  const { measurements: m, topology, wallLeft, wallRight, wallWidth, ceilingHeight, desiredDepth, policy } = context;
  const leftOpeningWidth = optionalNonNegativeInches(m.openingLeftDistance) ?? 0;
  const rightOpeningWidth = optionalNonNegativeInches(m.openingRightDistance) ?? 0;
  if (leftOpeningWidth + rightOpeningWidth >= wallWidth - policy.tolerance.geometry) {
    context.errors.push(diagnostic("OPENING_CLEARANCE_FAILED", {
      wallWidth,
      openingLeftDistance: leftOpeningWidth,
      openingRightDistance: rightOpeningWidth
    }));
    return;
  }
  const clearance = policy.featureClearance.doorTrim;
  const exclusions = [];
  if (leftOpeningWidth > policy.tolerance.geometry) {
    const leftBounds = bounds(wallLeft, 0, -desiredDepth, wallLeft + leftOpeningWidth, ceilingHeight, 0);
    topology.features.leftOpening = feature("left-opening", "opening", leftBounds, { width: leftOpeningWidth });
    topology.exclusionVolumes.push(exclusion("left-opening-exclusion", "left-opening", "opening", leftBounds, { clearance }));
    exclusions.push("left-opening-exclusion");
  }
  if (rightOpeningWidth > policy.tolerance.geometry) {
    const rightBounds = bounds(wallRight - rightOpeningWidth, 0, -desiredDepth, wallRight, ceilingHeight, 0);
    topology.features.rightOpening = feature("right-opening", "opening", rightBounds, { width: rightOpeningWidth });
    topology.exclusionVolumes.push(exclusion("right-opening-exclusion", "right-opening", "opening", rightBounds, { clearance }));
    exclusions.push("right-opening-exclusion");
  }

  const left = wallLeft + leftOpeningWidth + (leftOpeningWidth > 0 ? clearance : 0);
  const right = wallRight - rightOpeningWidth - (rightOpeningWidth > 0 ? clearance : 0);
  if (right - left <= policy.tolerance.geometry) {
    context.errors.push(diagnostic("OPENING_CLEARANCE_FAILED", { zoneId: "between-openings" }));
    return;
  }
  topology.installationZones.push(rectZone({
    id: "between-openings",
    role: "primary",
    left,
    right,
    bottom: 0,
    top: ceilingHeight,
    back: 0,
    leftKind: leftOpeningWidth > 0 ? "trim" : "wall",
    rightKind: rightOpeningWidth > 0 ? "trim" : "wall",
    topKind: "ceiling",
    featureClearances: [
      ...(leftOpeningWidth > 0 ? [featureClearance("left-opening", clearance, "left")] : []),
      ...(rightOpeningWidth > 0 ? [featureClearance("right-opening", clearance, "right")] : [])
    ],
    exclusionVolumeIds: exclusions
  }));
}

function addHorizontalFeatureZones(context, options) {
  const { topology, wallLeft, wallRight, ceilingHeight, policy } = context;
  const {
    featureId,
    minX,
    maxX,
    featureBottom,
    featureTop,
    clearance,
    exclusionVolumeIds,
    belowInstallByDefault
  } = options;
  const safeLeft = Math.max(wallLeft, minX - clearance);
  const safeRight = Math.min(wallRight, maxX + clearance);
  if (safeLeft - wallLeft > policy.tolerance.geometry) {
    topology.installationZones.push(rectZone({
      id: "left",
      role: "left",
      left: wallLeft,
      right: safeLeft,
      bottom: 0,
      top: ceilingHeight,
      back: 0,
      leftKind: "wall",
      rightKind: "trim",
      topKind: "ceiling",
      featureClearances: [featureClearance(featureId, clearance, "right")],
      exclusionVolumeIds
    }));
  }
  if (wallRight - safeRight > policy.tolerance.geometry) {
    topology.installationZones.push(rectZone({
      id: "right",
      role: "right",
      left: safeRight,
      right: wallRight,
      bottom: 0,
      top: ceilingHeight,
      back: 0,
      leftKind: "trim",
      rightKind: "wall",
      topKind: "ceiling",
      featureClearances: [featureClearance(featureId, clearance, "left")],
      exclusionVolumeIds
    }));
  }
  const belowTop = Math.max(0, featureBottom - clearance);
  if (belowTop > policy.tolerance.geometry) {
    topology.installationZones.push(rectZone({
      id: "below-window",
      role: "below-window",
      left: minX,
      right: maxX,
      bottom: 0,
      top: belowTop,
      back: 0,
      leftKind: "trim",
      rightKind: "trim",
      topKind: "soffit",
      featureClearances: [featureClearance(featureId, clearance, "above")],
      exclusionVolumeIds,
      installByDefault: belowInstallByDefault
    }));
  }
  const aboveBottom = Math.min(ceilingHeight, featureTop + clearance);
  if (ceilingHeight - aboveBottom > policy.tolerance.geometry) {
    topology.installationZones.push(rectZone({
      id: "optional-above-window",
      role: "over-feature",
      left: minX,
      right: maxX,
      bottom: aboveBottom,
      top: ceilingHeight,
      back: 0,
      leftKind: "trim",
      rightKind: "trim",
      topKind: "ceiling",
      featureClearances: [featureClearance(featureId, clearance, "below")],
      exclusionVolumeIds,
      installByDefault: false
    }));
  }
}

function validateResolvedTopology(context) {
  const { topology, errors, policy } = context;
  const seenZoneIds = new Set();
  for (const zone of topology.installationZones) {
    if (seenZoneIds.has(zone.id)) {
      errors.push(diagnostic("DUPLICATE_INSTALLATION_ZONE", { zoneId: zone.id }));
    }
    seenZoneIds.add(zone.id);
    if (
      !Number.isFinite(zone.leftPlaneX)
      || !Number.isFinite(zone.rightPlaneX)
      || zone.rightPlaneX - zone.leftPlaneX <= policy.tolerance.geometry
    ) {
      errors.push(diagnostic("INSTALLATION_ZONE_TOO_NARROW", { zoneId: zone.id }));
    }
    if (
      !Number.isFinite(zone.bottomPlaneY)
      || !Number.isFinite(zone.topPlaneY)
      || zone.topPlaneY - zone.bottomPlaneY <= policy.tolerance.geometry
    ) {
      errors.push(diagnostic("INSTALLATION_ZONE_TOO_SHORT", { zoneId: zone.id }));
    }
    for (const kind of [zone.leftBoundaryKind, zone.rightBoundaryKind, zone.topBoundaryKind, zone.bottomBoundaryKind]) {
      if (!BOUNDARY_KIND_SET.has(kind)) {
        errors.push(diagnostic("UNKNOWN_BOUNDARY_KIND", { zoneId: zone.id, kind }));
      }
    }
  }
  if (!topology.installationZones.length) {
    errors.push(diagnostic("NO_COMPATIBLE_INSTALLATION_ZONE"));
  }
  const exclusionIds = new Set(topology.exclusionVolumes.map((volume) => volume.id));
  for (const zone of topology.installationZones) {
    for (const exclusionId of zone.exclusionVolumeIds) {
      if (!exclusionIds.has(exclusionId)) {
        errors.push(diagnostic("UNKNOWN_EXCLUSION_VOLUME", { zoneId: zone.id, exclusionId }));
      }
    }
  }
}

function addDepthProjectionWarning(context, featureId, returnDepth) {
  if (context.desiredDepth <= returnDepth + context.policy.tolerance.visualContact) return;
  context.topology.warnings.push(diagnostic("DEPTH_EXCEEDS_ALLOWED_PROJECTION", {
    featureId,
    desiredDepth: context.desiredDepth,
    returnDepth,
    projectionBeyondReturn: context.desiredDepth - returnDepth
  }));
}

function resolveBoundaryKind(context, side, fallback, allowed) {
  const requested = context.boundaries[side] ?? fallback;
  const kind = String(requested || "").trim();
  if (!allowed.includes(kind)) {
    context.errors.push(diagnostic("UNKNOWN_BOUNDARY_KIND", { side, kind: kind || null }));
    return fallback;
  }
  return kind;
}

function resolveTopBoundaryKind(context, fallback) {
  return resolveBoundaryKind(
    context,
    "top",
    fallback ?? "ceiling",
    ["ceiling", "soffit", "open-edge"]
  );
}

function rectZone(options) {
  const zoneOrientation = options.orientation ?? orientation(
    { x: options.left, y: options.bottom, z: options.back },
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, -1],
    options.left
  );
  return {
    id: options.id,
    role: options.role,
    leftPlaneX: normalizedNumber(options.left),
    rightPlaneX: normalizedNumber(options.right),
    bottomPlaneY: normalizedNumber(options.bottom),
    topPlaneY: normalizedNumber(options.top),
    backPlaneZ: normalizedNumber(options.back),
    leftBoundaryKind: options.leftKind,
    rightBoundaryKind: options.rightKind,
    topBoundaryKind: options.topKind,
    bottomBoundaryKind: "floor",
    backBoundaryKind: "wall",
    featureClearances: [...(options.featureClearances ?? [])],
    exclusionVolumeIds: [...(options.exclusionVolumeIds ?? [])],
    orientation: zoneOrientation,
    installByDefault: options.installByDefault !== false
  };
}

function orientation(origin, widthAxis, heightAxis, depthAxis, widthCoordinateAtOrigin = 0) {
  return { origin, widthAxis, heightAxis, depthAxis, widthCoordinateAtOrigin };
}

function plane(id, axis, value, kind) {
  return { id, axis, value: normalizedNumber(value), kind };
}

function feature(id, kind, featureBounds, detail = {}) {
  return { id, kind, bounds: featureBounds, ...detail };
}

function exclusion(id, featureId, kind, volumeBounds, detail = {}) {
  return { id, featureId, kind, bounds: volumeBounds, ...detail };
}

function featureClearance(featureId, clearance, side) {
  return { featureId, clearance, side };
}

function bounds(minX, minY, minZ, maxX, maxY, maxZ) {
  const normalized = {
    minX: normalizedNumber(minX),
    minY: normalizedNumber(minY),
    minZ: normalizedNumber(minZ),
    maxX: normalizedNumber(maxX),
    maxY: normalizedNumber(maxY),
    maxZ: normalizedNumber(maxZ)
  };
  return {
    ...normalized,
    min: { x: normalized.minX, y: normalized.minY, z: normalized.minZ },
    max: { x: normalized.maxX, y: normalized.maxY, z: normalized.maxZ },
    size: {
      width: normalizedNumber(normalized.maxX - normalized.minX),
      height: normalizedNumber(normalized.maxY - normalized.minY),
      depth: normalizedNumber(normalized.maxZ - normalized.minZ)
    }
  };
}

function requiredPositiveMeasurements(source, fields) {
  const values = {};
  const missing = [];
  for (const field of fields) {
    const value = positiveInches(source[field]);
    if (value === null) missing.push(field);
    else values[field] = value;
  }
  return { values, missing };
}

function normalizeLayoutId(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeYesNo(value) {
  if (value === true) return "yes";
  if (value === false) return "no";
  return String(value ?? "no").trim().toLowerCase() === "yes" ? "yes" : "no";
}

function positiveInches(value) {
  const number = parseInches(value);
  return number !== null && number > 0 ? number : null;
}

function optionalPositiveInches(value) {
  if (value === null || value === undefined || value === "") return null;
  return positiveInches(value);
}

function nonNegativeInches(value) {
  const number = parseInches(value);
  return number !== null && number >= 0 ? number : null;
}

function optionalNonNegativeInches(value) {
  if (value === null || value === undefined || value === "") return null;
  return nonNegativeInches(value);
}

// Mirrors the guided state's accepted decimal, fraction, mixed-number,
// hyphenated, unicode-fraction, and optional inch-suffix forms without
// importing UI state into the pure topology phase.
function parseInches(rawValue) {
  if (typeof rawValue === "number") return Number.isFinite(rawValue) && rawValue >= 0 ? rawValue : null;
  if (typeof rawValue !== "string") return null;
  let value = rawValue.trim().toLowerCase().replace(/(?:inches|inch|in\.?|\")$/i, "").trim();
  if (!value) return null;
  const fractions = {
    "¼": 0.25,
    "½": 0.5,
    "¾": 0.75,
    "⅛": 0.125,
    "⅜": 0.375,
    "⅝": 0.625,
    "⅞": 0.875
  };
  let unicodeAmount = 0;
  for (const [symbol, amount] of Object.entries(fractions)) {
    if (!value.includes(symbol)) continue;
    unicodeAmount += amount;
    value = value.replaceAll(symbol, "").trim();
  }
  value = value.replace(/(\d)\s*-\s*(\d+\s*\/\s*\d+)/, "$1 $2");
  const mixed = value.match(/^(\d+(?:\.\d+)?)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    const denominator = Number(mixed[3]);
    return denominator ? Number(mixed[1]) + Number(mixed[2]) / denominator + unicodeAmount : null;
  }
  const fraction = value.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fraction) {
    const denominator = Number(fraction[2]);
    return denominator ? Number(fraction[1]) / denominator + unicodeAmount : null;
  }
  if (!value && unicodeAmount) return unicodeAmount;
  if (!/^\d+(?:\.\d+)?$/.test(value)) return null;
  const number = Number(value) + unicodeAmount;
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function mergePolicy(base, override) {
  const candidate = objectOrEmpty(override);
  return {
    tolerance: { ...base.tolerance, ...objectOrEmpty(candidate.tolerance) },
    featureClearance: { ...base.featureClearance, ...objectOrEmpty(candidate.featureClearance) }
  };
}

function diagnostic(code, detail = {}) {
  return { code, ...detail };
}

function rejectTopology(layoutId, errors, warnings = []) {
  return deepFreeze({
    accepted: false,
    schemaVersion: 1,
    units: "inches",
    layoutId: layoutId || null,
    errors,
    warnings
  });
}

function normalizedNumber(value) {
  if (!Number.isFinite(value)) return value;
  const normalized = Number(value.toFixed(6));
  return Object.is(normalized, -0) ? 0 : normalized;
}

function objectOrEmpty(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function deepFreeze(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(deepFreeze));
  if (!value || typeof value !== "object") return value;
  return Object.freeze(Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, deepFreeze(item)])
  ));
}
