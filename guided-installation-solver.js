/**
 * Pure installation-fit phase for the guided configurator.
 *
 * The solver consumes accepted room zones and returns physical dimensions and
 * descriptor-ready treatments. It never scales a model and has no DOM or
 * rendering dependencies.
 */

export const INSTALLATION_MODES = Object.freeze([
  "fitted",
  "freestanding",
  "floating"
]);

export const DEFAULT_INSTALLATION_FIT_POLICY = deepFreeze({
  tolerance: {
    geometry: 0.001,
    visualContact: 0.125,
    symmetry: 0.125
  },
  base: {
    builtInNominalHeight: 4,
    existingFurnitureBaseHeight: 4.5
  },
  fillers: {
    preferredEach: 1.5,
    minimumEach: 0.75,
    maximumEach: 4,
    symmetryTolerance: 0.125
  },
  topScribe: {
    preferred: 0.75,
    minimum: 0.25,
    maximum: 2
  },
  openEdge: {
    finishedEndPanelThickness: 0.75,
    designClearance: 0.5
  },
  floating: {
    defaultOverallHeight: 24,
    minimumCeilingClearance: 0.5
  },
  featureClearance: {
    doorTrim: 1,
    windowTrim: 1,
    fireplaceTrim: 2,
    radiatorService: 2
  }
});

const MODE_SET = new Set(INSTALLATION_MODES);
const SYMMETRIC_BOUNDARIES = new Set(["wall", "return", "trim"]);

/**
 * Solve one or more explicit room zones as one atomic fit candidate.
 *
 * @param {object} input
 * @param {object} input.room accepted RoomTopologySpec
 * @param {object} input.product normalized product intent
 * @param {object} input.policy optional centralized policy override
 * @param {string} input.mode explicit installation mode
 * @param {string[]} input.zoneIds explicit zone selection
 * @param {number|string} input.mountingHeight explicit floating floor clearance
 * @returns {object} immutable accepted InstallationFitSpec or named rejection
 */
export function solveInstallation(input = {}) {
  const request = objectOrEmpty(input);
  const room = request.room;
  const product = objectOrEmpty(request.product);
  const policy = mergePolicy(DEFAULT_INSTALLATION_FIT_POLICY, request.policy);
  const warnings = [];

  if (!room?.accepted) {
    return rejectFit([diagnostic("ROOM_NOT_ACCEPTED", {
      roomErrors: Array.isArray(room?.errors) ? room.errors : []
    })], warnings);
  }

  const mode = resolveMode(request.mode, product);
  if (!MODE_SET.has(mode)) {
    return rejectFit([diagnostic("UNKNOWN_INSTALLATION_MODE", { mode })], warnings);
  }

  const selected = selectZones(room, product, request.zoneIds);
  if (selected.error) return rejectFit([selected.error], warnings);
  if (!selected.zones.length) {
    return rejectFit([diagnostic("NO_COMPATIBLE_INSTALLATION_ZONE")], warnings);
  }

  const mountingHeight = mode === "floating"
    ? nonNegativeInches(
      request.mountingHeight
      ?? product.mountingHeight
      ?? product.measurements?.mountingHeight
    )
    : null;
  if (mode === "floating" && mountingHeight === null) {
    return rejectFit([diagnostic("MISSING_MOUNTING_HEIGHT")], warnings);
  }

  if (mode === "floating") {
    warnings.push(diagnostic("FLOATING_ATTACHMENT_ENGINEERING_REQUIRED", {
      mountingHeight
    }));
  }

  const installations = [];
  const errors = [];
  for (const zone of selected.zones) {
    const result = solveZone({ room, zone, product, policy, mode, mountingHeight });
    if (!result.accepted) errors.push(...result.errors);
    else installations.push(result.installation);
  }
  if (errors.length) return rejectFit(errors, warnings);

  const primary = installations[0];
  const invariants = {
    rootScale: [1, 1, 1],
    multiZone: installations.length > 1,
    allWidthsBalanced: installations.every((item) => item.invariants.widthBalanced),
    allHeightsBalanced: installations.every((item) => item.invariants.heightBalanced),
    allBackAnchored: installations.every((item) => item.invariants.backAnchored),
    noGlobalScaling: true
  };
  return deepFreeze({
    accepted: true,
    schemaVersion: 1,
    units: "inches",
    mode,
    zoneIds: installations.map((item) => item.zoneId),
    installations,
    // Singular aliases preserve the supplied template's integration surface
    // while the canonical result remains explicitly multi-zone.
    zoneId: primary.zoneId,
    zoneBounds: primary.zoneBounds,
    casework: primary.casework,
    treatments: primary.treatments,
    anchors: primary.anchors,
    invariants,
    warnings
  });
}

function solveZone({ room, zone, product, policy, mode, mountingHeight }) {
  const tolerance = policy.tolerance.geometry;
  const zoneWidth = Number(zone.rightPlaneX) - Number(zone.leftPlaneX);
  const zoneHeight = Number(zone.topPlaneY) - Number(zone.bottomPlaneY);
  if (!Number.isFinite(zoneWidth) || zoneWidth <= tolerance) {
    return rejectZone("INSTALLATION_ZONE_TOO_NARROW", zone.id, { zoneWidth });
  }
  if (!Number.isFinite(zoneHeight) || zoneHeight <= tolerance) {
    return rejectZone("INSTALLATION_ZONE_TOO_SHORT", zone.id, { zoneHeight });
  }

  const sideFit = solveHorizontalTreatments({ zone, zoneWidth, product, policy, mode });
  if (!sideFit.accepted) return sideFit;
  const granularSideFit = applyCaseworkWidthGranularity({
    zone,
    zoneWidth,
    sideFit,
    product,
    policy
  });
  if (!granularSideFit.accepted) return granularSideFit;

  const depth = positiveInches(product.targetDepth ?? product.depth) ?? positiveInches(room.desiredDepth);
  if (depth === null) return rejectZone("MISSING_BASE_ROOM_DIMENSIONS", zone.id, { fields: ["desiredDepth"] });

  const verticalFit = solveVerticalTreatments({ room, zone, zoneHeight, product, policy, mode, mountingHeight });
  if (!verticalFit.accepted) return verticalFit;

  const installationId = `installation-${zone.id}`;
  const leftPlaneX = normalizedNumber(Number(zone.leftPlaneX) + granularSideFit.left.width);
  const rightPlaneX = normalizedNumber(Number(zone.rightPlaneX) - granularSideFit.right.width);
  const bottomPlaneY = normalizedNumber(verticalFit.bottomPlaneY);
  const bodyBottomPlaneY = normalizedNumber(bottomPlaneY + verticalFit.base.height);
  const topPlaneY = normalizedNumber(bottomPlaneY + verticalFit.overallHeight);
  const backPlaneZ = normalizedNumber(Number(zone.backPlaneZ));
  const frontPlaneZ = normalizedNumber(backPlaneZ - depth);
  const bodyHeight = normalizedNumber(
    verticalFit.overallHeight - verticalFit.base.height - verticalFit.top.height
  );
  const caseworkWidth = normalizedNumber(rightPlaneX - leftPlaneX);
  if (caseworkWidth <= tolerance) {
    return rejectZone("INSTALLATION_ZONE_TOO_NARROW", zone.id, {
      zoneWidth,
      leftTreatment: granularSideFit.left.width,
      rightTreatment: granularSideFit.right.width
    });
  }
  if (bodyHeight <= tolerance) {
    return rejectZone("INSTALLATION_ZONE_TOO_SHORT", zone.id, {
      zoneHeight,
      baseHeight: verticalFit.base.height,
      topHeight: verticalFit.top.height
    });
  }

  const widthError = Math.abs(
    granularSideFit.left.width + caseworkWidth + granularSideFit.right.width - zoneWidth
  );
  const heightError = Math.abs(
    verticalFit.base.height + bodyHeight + verticalFit.top.height - verticalFit.overallHeight
  );
  if (widthError > tolerance) {
    return rejectZone("INSTALLATION_WIDTH_BALANCE_FAILED", zone.id, { widthError });
  }
  if (heightError > tolerance) {
    return rejectZone("INSTALLATION_HEIGHT_BALANCE_FAILED", zone.id, { heightError });
  }

  const symmetricTreatments = equivalentBoundaries(
    zone.leftBoundaryKind,
    zone.rightBoundaryKind
  );
  if (
    symmetricTreatments
    && Math.abs(granularSideFit.left.width - granularSideFit.right.width) > policy.fillers.symmetryTolerance
  ) {
    return rejectZone("FILLER_SYMMETRY_FAILED", zone.id, {
      leftWidth: granularSideFit.left.width,
      rightWidth: granularSideFit.right.width
    });
  }

  const isFloorZone = Math.abs(Number(zone.bottomPlaneY) - Number(room.floorPlaneY ?? 0)) <= policy.tolerance.visualContact;
  const floorAnchored = mode === "floating"
    ? bottomPlaneY > Number(room.floorPlaneY ?? 0) + policy.tolerance.visualContact
    : !isFloorZone || Math.abs(bottomPlaneY - Number(room.floorPlaneY ?? 0)) <= policy.tolerance.visualContact;
  if (!floorAnchored) return rejectZone("BASE_NOT_ON_FLOOR", zone.id);

  const topFitted = mode !== "fitted"
    || Math.abs(topPlaneY - Number(zone.topPlaneY)) <= policy.tolerance.visualContact;
  if (!topFitted) return rejectZone("TOP_TREATMENT_MISSES_CEILING", zone.id);

  const componentDepthBounds = { minZ: frontPlaneZ, maxZ: backPlaneZ };
  const installationOrientation = zone.orientation ?? defaultOrientation(zone);
  const treatments = {
    left: buildSideTreatment(
      `${installationId}-left-treatment`,
      granularSideFit.left,
      orientZoneBounds(bounds(
        Number(zone.leftPlaneX),
        bottomPlaneY,
        frontPlaneZ,
        leftPlaneX,
        topPlaneY,
        backPlaneZ
      ), installationOrientation, zone)
    ),
    right: buildSideTreatment(
      `${installationId}-right-treatment`,
      granularSideFit.right,
      orientZoneBounds(bounds(
        rightPlaneX,
        bottomPlaneY,
        frontPlaneZ,
        Number(zone.rightPlaneX),
        topPlaneY,
        backPlaneZ
      ), installationOrientation, zone)
    ),
    base: {
      id: `${installationId}-base-treatment`,
      kind: verticalFit.base.kind,
      height: verticalFit.base.height,
      selection: verticalFit.base.selection,
      bounds: orientZoneBounds(bounds(
        leftPlaneX,
        bottomPlaneY,
        frontPlaneZ,
        rightPlaneX,
        bodyBottomPlaneY,
        backPlaneZ
      ), installationOrientation, zone)
    },
    top: {
      id: `${installationId}-top-treatment`,
      ...verticalFit.top,
      bounds: orientZoneBounds(bounds(
        leftPlaneX,
        topPlaneY - verticalFit.top.height,
        frontPlaneZ,
        rightPlaneX,
        topPlaneY,
        backPlaneZ
      ), installationOrientation, zone)
    }
  };
  const casework = {
    width: caseworkWidth,
    widthStep: granularSideFit.widthStep,
    widthQuantized: granularSideFit.widthStep !== null,
    bodyHeight,
    overallHeight: normalizedNumber(verticalFit.overallHeight),
    depth,
    leftPlaneX,
    rightPlaneX,
    bottomPlaneY,
    bodyBottomPlaneY,
    topPlaneY,
    backPlaneZ,
    frontPlaneZ,
    bounds: orientZoneBounds(bounds(
      leftPlaneX,
      bodyBottomPlaneY,
      frontPlaneZ,
      rightPlaneX,
      topPlaneY - verticalFit.top.height,
      backPlaneZ
    ), installationOrientation, zone)
  };
  const anchors = {
    floorY: normalizedNumber(Number(room.floorPlaneY ?? 0)),
    bottomY: bottomPlaneY,
    backZ: backPlaneZ,
    frontZ: frontPlaneZ,
    centerX: normalizedNumber((leftPlaneX + rightPlaneX) / 2),
    mountingHeight: mode === "floating" ? mountingHeight : 0
  };
  const zoneBounds = {
    left: normalizedNumber(Number(zone.leftPlaneX)),
    right: normalizedNumber(Number(zone.rightPlaneX)),
    bottom: normalizedNumber(Number(zone.bottomPlaneY)),
    top: normalizedNumber(Number(zone.topPlaneY)),
    back: backPlaneZ,
    front: frontPlaneZ
  };

  return {
    accepted: true,
    installation: {
      id: installationId,
      mode,
      zoneId: zone.id,
      role: zone.role ?? "primary",
      zoneBounds,
      casework,
      treatments,
      anchors,
      orientation: installationOrientation,
      exclusionVolumeIds: [...(zone.exclusionVolumeIds ?? [])],
      featureClearances: [...(zone.featureClearances ?? [])],
      invariants: {
        widthBalanced: widthError <= tolerance,
        heightBalanced: heightError <= tolerance,
        symmetricTreatments,
        floorAnchored,
        backAnchored: true,
        topFitted,
        frontPlaneDerivedFromDepth: Math.abs(backPlaneZ - frontPlaneZ - depth) <= tolerance,
        caseworkWidthGranularity: granularSideFit.widthStep === null
          || isMultipleWithinTolerance(caseworkWidth, granularSideFit.widthStep, tolerance),
        rootScale: [1, 1, 1]
      },
      componentDepthBounds
    }
  };
}

function solveHorizontalTreatments({ zone, zoneWidth, product, policy, mode }) {
  const targetWidth = optionalPositiveInches(product.targetWidth ?? product.width);
  const isCornerJoin = zone.role === "corner-join";
  if (isCornerJoin) {
    return {
      accepted: true,
      left: sideTreatment("corner-join", 0, zone.leftBoundaryKind),
      right: sideTreatment("corner-join", 0, zone.rightBoundaryKind)
    };
  }

  if (mode === "freestanding") {
    const minimumClearance = policy.openEdge.designClearance;
    const clearance = centeredClearance(zoneWidth, targetWidth, minimumClearance);
    if (clearance === null) {
      return rejectZone("INSTALLATION_ZONE_TOO_NARROW", zone.id, {
        zoneWidth,
        targetWidth,
        minimumClearance
      });
    }
    return {
      accepted: true,
      left: sideTreatment("clearance", clearance, zone.leftBoundaryKind, {
        finishedExteriorSide: true,
        endPanelThickness: policy.openEdge.finishedEndPanelThickness
      }),
      right: sideTreatment("clearance", clearance, zone.rightBoundaryKind, {
        finishedExteriorSide: true,
        endPanelThickness: policy.openEdge.finishedEndPanelThickness
      })
    };
  }

  if (mode === "floating") {
    const required = policy.openEdge.designClearance + policy.openEdge.finishedEndPanelThickness;
    const clearance = centeredClearance(zoneWidth, targetWidth, required);
    if (clearance === null) {
      return rejectZone("INSTALLATION_ZONE_TOO_NARROW", zone.id, {
        zoneWidth,
        targetWidth,
        minimumFinishedEnd: required
      });
    }
    return {
      accepted: true,
      left: sideTreatment("finished-end", clearance, zone.leftBoundaryKind, {
        designClearance: Math.max(0, clearance - policy.openEdge.finishedEndPanelThickness),
        endPanelThickness: policy.openEdge.finishedEndPanelThickness
      }),
      right: sideTreatment("finished-end", clearance, zone.rightBoundaryKind, {
        designClearance: Math.max(0, clearance - policy.openEdge.finishedEndPanelThickness),
        endPanelThickness: policy.openEdge.finishedEndPanelThickness
      })
    };
  }

  let left = treatmentForBoundary(zone.leftBoundaryKind, policy);
  let right = treatmentForBoundary(zone.rightBoundaryKind, policy);
  if (equivalentBoundaries(zone.leftBoundaryKind, zone.rightBoundaryKind)) {
    const equal = normalizedNumber(Math.max(
      left.width,
      right.width,
      zone.leftBoundaryKind === "wall" || zone.leftBoundaryKind === "return"
        ? policy.fillers.preferredEach
        : 0
    ));
    left = { ...left, width: equal };
    right = { ...right, width: equal };
  }
  return { accepted: true, left, right };
}

function applyCaseworkWidthGranularity({ zone, zoneWidth, sideFit, product, policy }) {
  const suppliedStep = product.caseworkWidthStep ?? product.dimensionPolicy?.caseworkWidthStep;
  if (suppliedStep === null || suppliedStep === undefined || suppliedStep === "") {
    return { ...sideFit, widthStep: null };
  }
  const widthStep = positiveInches(suppliedStep);
  if (widthStep === null) {
    return rejectZone("INVALID_CASEWORK_WIDTH_STEP", zone.id, {
      caseworkWidthStep: suppliedStep
    });
  }

  const rawWidth = normalizedNumber(zoneWidth - sideFit.left.width - sideFit.right.width);
  const quantizedWidth = normalizedNumber(
    Math.floor((rawWidth + policy.tolerance.geometry) / widthStep) * widthStep
  );
  if (quantizedWidth <= policy.tolerance.geometry) {
    return rejectZone("INSTALLATION_ZONE_TOO_NARROW", zone.id, {
      zoneWidth,
      caseworkWidthStep: widthStep,
      rawCaseworkWidth: rawWidth
    });
  }
  const remainder = normalizedNumber(rawWidth - quantizedWidth);
  if (Math.abs(remainder) <= policy.tolerance.geometry) {
    return { ...sideFit, widthStep };
  }

  const symmetric = equivalentBoundaries(zone.leftBoundaryKind, zone.rightBoundaryKind);
  let leftAdjustment = remainder / 2;
  let rightAdjustment = remainder - leftAdjustment;
  const leftCapacity = treatmentGrowthCapacity(sideFit.left, policy);
  const rightCapacity = treatmentGrowthCapacity(sideFit.right, policy);

  if (symmetric) {
    if (
      leftAdjustment > leftCapacity + policy.tolerance.geometry
      || rightAdjustment > rightCapacity + policy.tolerance.geometry
    ) {
      return rejectZone("CASEWORK_WIDTH_GRANULARITY_FAILED", zone.id, {
        caseworkWidthStep: widthStep,
        rawCaseworkWidth: rawWidth,
        quantizedWidth,
        remainder
      });
    }
  } else {
    if (leftAdjustment > leftCapacity) {
      rightAdjustment += leftAdjustment - leftCapacity;
      leftAdjustment = leftCapacity;
    }
    if (rightAdjustment > rightCapacity) {
      leftAdjustment += rightAdjustment - rightCapacity;
      rightAdjustment = rightCapacity;
    }
    if (
      leftAdjustment > leftCapacity + policy.tolerance.geometry
      || rightAdjustment > rightCapacity + policy.tolerance.geometry
    ) {
      return rejectZone("CASEWORK_WIDTH_GRANULARITY_FAILED", zone.id, {
        caseworkWidthStep: widthStep,
        rawCaseworkWidth: rawWidth,
        quantizedWidth,
        remainder
      });
    }
  }

  return {
    accepted: true,
    widthStep,
    left: {
      ...sideFit.left,
      width: normalizedNumber(sideFit.left.width + leftAdjustment),
      granularityAdjustment: normalizedNumber(leftAdjustment)
    },
    right: {
      ...sideFit.right,
      width: normalizedNumber(sideFit.right.width + rightAdjustment),
      granularityAdjustment: normalizedNumber(rightAdjustment)
    }
  };
}

function treatmentGrowthCapacity(treatment, policy) {
  if (treatment.kind === "filler") {
    return Math.max(0, policy.fillers.maximumEach - treatment.width);
  }
  return Number.POSITIVE_INFINITY;
}

function solveVerticalTreatments({ room, zone, zoneHeight, product, policy, mode, mountingHeight }) {
  const isFloorZone = Math.abs(Number(zone.bottomPlaneY) - Number(room.floorPlaneY ?? 0)) <= policy.tolerance.visualContact;
  const selectedBase = String(product.baseStyle ?? "flush-base");
  const selectedTop = String(product.topTreatment ?? "small-crown");

  if (mode === "floating") {
    const bottomPlaneY = Number(room.floorPlaneY ?? 0) + mountingHeight;
    const availableHeight = Number(zone.topPlaneY) - bottomPlaneY - policy.floating.minimumCeilingClearance;
    const requestedHeight = optionalPositiveInches(product.targetHeight ?? product.height);
    const overallHeight = requestedHeight ?? Math.min(policy.floating.defaultOverallHeight, availableHeight);
    if (availableHeight <= policy.tolerance.geometry || overallHeight > availableHeight + policy.tolerance.geometry) {
      return rejectZone("INSTALLATION_ZONE_TOO_SHORT", zone.id, {
        mountingHeight,
        requestedHeight: overallHeight,
        availableHeight
      });
    }
    return {
      accepted: true,
      bottomPlaneY,
      overallHeight,
      base: { kind: "none", height: 0, selection: "none" },
      top: {
        kind: "integrated-finished-top",
        height: 0,
        nominalThickness: Math.min(policy.topScribe.preferred, overallHeight / 4),
        includedInCasework: true,
        selection: selectedTop
      }
    };
  }

  if (mode === "freestanding") {
    const baseHeight = policy.base.existingFurnitureBaseHeight;
    const topHeight = policy.topScribe.preferred;
    const maximumHeight = zoneHeight - policy.openEdge.designClearance;
    const requestedHeight = optionalPositiveInches(product.targetHeight ?? product.height);
    const overallHeight = requestedHeight ?? maximumHeight;
    if (
      overallHeight > maximumHeight + policy.tolerance.geometry
      || overallHeight <= baseHeight + topHeight + policy.tolerance.geometry
    ) {
      return rejectZone("INSTALLATION_ZONE_TOO_SHORT", zone.id, {
        requestedHeight: overallHeight,
        maximumHeight
      });
    }
    return {
      accepted: true,
      bottomPlaneY: Number(zone.bottomPlaneY),
      overallHeight,
      base: { kind: "furniture-base", height: baseHeight, selection: selectedBase },
      top: { kind: "finished-top", height: topHeight, selection: selectedTop }
    };
  }

  const baseHeight = isFloorZone
    ? (selectedBase === "furniture-base"
      ? policy.base.existingFurnitureBaseHeight
      : policy.base.builtInNominalHeight)
    : 0;
  const topHeight = clamp(
    policy.topScribe.preferred,
    policy.topScribe.minimum,
    policy.topScribe.maximum
  );
  if (zoneHeight <= baseHeight + topHeight + policy.tolerance.geometry) {
    return rejectZone("INSTALLATION_ZONE_TOO_SHORT", zone.id, {
      zoneHeight,
      baseHeight,
      topHeight
    });
  }
  return {
    accepted: true,
    bottomPlaneY: Number(zone.bottomPlaneY),
    overallHeight: zoneHeight,
    base: {
      kind: isFloorZone
        ? (selectedBase === "furniture-base" ? "furniture-base" : "built-in-base")
        : "feature-support",
      height: baseHeight,
      selection: selectedBase
    },
    top: { kind: "scribe-or-crown", height: topHeight, selection: selectedTop }
  };
}

function selectZones(room, product, explicitZoneIds) {
  const zones = Array.isArray(room.installationZones) ? room.installationZones : [];
  const explicit = normalizeStringArray(explicitZoneIds);
  const installed = normalizeStringArray(product.installationZoneIds);
  const preferred = normalizeStringArray(product.preferredZoneIds);
  const roles = new Set(normalizeStringArray(product.zoneRoles ?? product.allowedZoneRoles));
  const requestedIds = explicit.length ? explicit : installed.length ? installed : preferred;

  if (requestedIds.length) {
    const requestedSet = new Set(requestedIds);
    const selected = zones.filter((zone) => requestedSet.has(zone.id));
    const missing = requestedIds.filter((id) => !zones.some((zone) => zone.id === id));
    if (missing.length) {
      return {
        zones: [],
        error: diagnostic("UNKNOWN_INSTALLATION_ZONE", { zoneIds: missing })
      };
    }
    return { zones: selected };
  }
  if (roles.size) {
    return { zones: zones.filter((zone) => roles.has(zone.role)) };
  }
  return { zones: zones.filter((zone) => zone.installByDefault !== false) };
}

function treatmentForBoundary(kind, policy) {
  if (kind === "wall" || kind === "return") {
    return sideTreatment(
      "filler",
      clamp(
        policy.fillers.preferredEach,
        policy.fillers.minimumEach,
        policy.fillers.maximumEach
      ),
      kind,
      { scribed: true }
    );
  }
  if (kind === "corner") {
    return sideTreatment("corner-join", policy.openEdge.finishedEndPanelThickness, kind, {
      endPanelThickness: policy.openEdge.finishedEndPanelThickness
    });
  }
  if (["open-edge", "trim", "opening", "projection"].includes(kind)) {
    return sideTreatment(
      "finished-end",
      policy.openEdge.finishedEndPanelThickness + policy.openEdge.designClearance,
      kind,
      {
        endPanelThickness: policy.openEdge.finishedEndPanelThickness,
        designClearance: policy.openEdge.designClearance
      }
    );
  }
  return sideTreatment("finished-end", policy.openEdge.finishedEndPanelThickness, kind, {
    endPanelThickness: policy.openEdge.finishedEndPanelThickness,
    requiresDesignReview: true
  });
}

function sideTreatment(kind, width, boundaryKind, detail = {}) {
  return { kind, width: normalizedNumber(width), boundaryKind, ...detail };
}

function buildSideTreatment(id, treatment, treatmentBounds) {
  return { id, ...treatment, bounds: treatmentBounds };
}

function centeredClearance(zoneWidth, targetWidth, minimumEach) {
  if (targetWidth === null) return normalizedNumber(minimumEach);
  const clearance = (zoneWidth - targetWidth) / 2;
  return clearance >= minimumEach ? normalizedNumber(clearance) : null;
}

function equivalentBoundaries(left, right) {
  return left === right && SYMMETRIC_BOUNDARIES.has(left);
}

function resolveMode(explicitMode, product) {
  const candidate = explicitMode ?? product.installationMode;
  if (candidate !== null && candidate !== undefined && String(candidate).trim()) {
    return String(candidate).trim();
  }
  const productId = String(product.id ?? product.productId ?? "");
  if (productId === "floating-storage") return "floating";
  if (product.baseStyle === "furniture-base") return "freestanding";
  return "fitted";
}

function defaultOrientation(zone) {
  return {
    origin: { x: Number(zone.leftPlaneX), y: Number(zone.bottomPlaneY), z: Number(zone.backPlaneZ) },
    widthAxis: [1, 0, 0],
    heightAxis: [0, 1, 0],
    depthAxis: [0, 0, -1],
    widthCoordinateAtOrigin: Number(zone.leftPlaneX)
  };
}

/**
 * Installation plane coordinates use X for distance along a run and negative
 * Z for distance out from its rear wall. Convert their eight corners through
 * the topology orientation so every published fit bound is a true room-space
 * AABB, including the rotated return of a Corner Wall.
 */
function orientZoneBounds(source, zoneOrientation, zone) {
  const origin = pointVector(zoneOrientation?.origin, {
    x: Number(zone.leftPlaneX),
    y: Number(zone.bottomPlaneY),
    z: Number(zone.backPlaneZ)
  });
  const widthAxis = unitVector(zoneOrientation?.widthAxis, [1, 0, 0]);
  const heightAxis = unitVector(zoneOrientation?.heightAxis, [0, 1, 0]);
  const depthAxis = unitVector(zoneOrientation?.depthAxis, [0, 0, -1]);
  const widthCoordinateAtOrigin = finiteNumber(
    zoneOrientation?.widthCoordinateAtOrigin,
    Number(zone.leftPlaneX)
  );
  const backCoordinate = Number(zone.backPlaneZ);
  const points = [];
  for (const x of [source.min.x, source.max.x]) {
    for (const y of [source.min.y, source.max.y]) {
      for (const z of [source.min.z, source.max.z]) {
        const alongWidth = Number(x) - widthCoordinateAtOrigin;
        const alongHeight = Number(y) - origin.y;
        const outFromBack = backCoordinate - Number(z);
        points.push({
          x: origin.x + widthAxis[0] * alongWidth + heightAxis[0] * alongHeight + depthAxis[0] * outFromBack,
          y: origin.y + widthAxis[1] * alongWidth + heightAxis[1] * alongHeight + depthAxis[1] * outFromBack,
          z: origin.z + widthAxis[2] * alongWidth + heightAxis[2] * alongHeight + depthAxis[2] * outFromBack
        });
      }
    }
  }
  return bounds(
    Math.min(...points.map((point) => point.x)),
    Math.min(...points.map((point) => point.y)),
    Math.min(...points.map((point) => point.z)),
    Math.max(...points.map((point) => point.x)),
    Math.max(...points.map((point) => point.y)),
    Math.max(...points.map((point) => point.z))
  );
}

function pointVector(value, fallback) {
  const source = Array.isArray(value)
    ? { x: value[0], y: value[1], z: value[2] }
    : value || fallback;
  return {
    x: finiteNumber(source.x, fallback.x),
    y: finiteNumber(source.y, fallback.y),
    z: finiteNumber(source.z, fallback.z)
  };
}

function unitVector(value, fallback) {
  const source = Array.isArray(value)
    ? value.map(Number)
    : value && typeof value === "object"
      ? [Number(value.x), Number(value.y), Number(value.z)]
      : fallback;
  if (source.length !== 3 || source.some((entry) => !Number.isFinite(entry))) return fallback;
  const magnitude = Math.hypot(...source);
  return magnitude > 0 ? source.map((entry) => entry / magnitude) : fallback;
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
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

function positiveInches(value) {
  const number = numericInches(value);
  return number !== null && number > 0 ? number : null;
}

function optionalPositiveInches(value) {
  if (value === null || value === undefined || value === "") return null;
  return positiveInches(value);
}

function nonNegativeInches(value) {
  const number = numericInches(value);
  return number !== null && number >= 0 ? number : null;
}

function numericInches(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  let normalized = value.trim().toLowerCase().replace(/(?:inches|inch|in\.?|\")$/i, "").trim();
  if (!normalized) return null;
  const unicodeFractions = {
    "¼": 0.25,
    "½": 0.5,
    "¾": 0.75,
    "⅛": 0.125,
    "⅜": 0.375,
    "⅝": 0.625,
    "⅞": 0.875
  };
  let unicodeAmount = 0;
  for (const [symbol, amount] of Object.entries(unicodeFractions)) {
    if (!normalized.includes(symbol)) continue;
    unicodeAmount += amount;
    normalized = normalized.replaceAll(symbol, "").trim();
  }
  normalized = normalized.replace(/(\d)\s*-\s*(\d+\s*\/\s*\d+)/, "$1 $2");
  const mixed = normalized.match(/^(\d+(?:\.\d+)?)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    const denominator = Number(mixed[3]);
    return denominator ? Number(mixed[1]) + Number(mixed[2]) / denominator + unicodeAmount : null;
  }
  const fraction = normalized.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fraction) {
    const denominator = Number(fraction[2]);
    return denominator ? Number(fraction[1]) / denominator + unicodeAmount : null;
  }
  if (!normalized && unicodeAmount) return unicodeAmount;
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const number = Number(normalized) + unicodeAmount;
  return Number.isFinite(number) ? number : null;
}

function normalizeStringArray(value) {
  if (value === null || value === undefined) return [];
  const source = Array.isArray(value) ? value : [value];
  return source.map((item) => String(item).trim()).filter(Boolean);
}

function mergePolicy(base, override) {
  const candidate = objectOrEmpty(override);
  return {
    tolerance: { ...base.tolerance, ...objectOrEmpty(candidate.tolerance) },
    base: { ...base.base, ...objectOrEmpty(candidate.base) },
    fillers: { ...base.fillers, ...objectOrEmpty(candidate.fillers) },
    topScribe: { ...base.topScribe, ...objectOrEmpty(candidate.topScribe) },
    openEdge: { ...base.openEdge, ...objectOrEmpty(candidate.openEdge) },
    floating: { ...base.floating, ...objectOrEmpty(candidate.floating) },
    featureClearance: { ...base.featureClearance, ...objectOrEmpty(candidate.featureClearance) }
  };
}

function rejectZone(code, zoneId, detail = {}) {
  return { accepted: false, errors: [diagnostic(code, { zoneId, ...detail })] };
}

function rejectFit(errors, warnings = []) {
  return deepFreeze({
    accepted: false,
    schemaVersion: 1,
    units: "inches",
    errors,
    warnings
  });
}

function diagnostic(code, detail = {}) {
  return { code, ...detail };
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value)));
}

function normalizedNumber(value) {
  if (!Number.isFinite(value)) return value;
  const normalized = Number(value.toFixed(6));
  return Object.is(normalized, -0) ? 0 : normalized;
}

function isMultipleWithinTolerance(value, step, tolerance) {
  if (!Number.isFinite(value) || !Number.isFinite(step) || step <= 0) return false;
  const quotient = value / step;
  return Math.abs(quotient - Math.round(quotient)) <= tolerance;
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
