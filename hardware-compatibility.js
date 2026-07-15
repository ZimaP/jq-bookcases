/**
 * Pure compatibility, placement, scope, and immutable application helpers for
 * decorative cabinet hardware. Catalog dimensions are millimeters; generated
 * layout descriptors remain canonical inches.
 */

export const HARDWARE_COMPATIBILITY_LEVELS = Object.freeze({
  recommended: "recommended",
  compatible: "compatible",
  possibleWithWarning: "possible_with_warning",
  notCompatible: "not_compatible"
});

export const HARDWARE_APPLICATION_SCOPES = Object.freeze({
  component: "this_component",
  section: "this_section",
  matchingDoors: "all_matching_doors",
  matchingDrawers: "all_matching_drawers"
});

const MM_PER_INCH = 25.4;
const FRONT_ROLES = new Set(["door", "drawer_front"]);
const SCOPE_ALIASES = Object.freeze({
  this_item: HARDWARE_APPLICATION_SCOPES.component,
  item: HARDWARE_APPLICATION_SCOPES.component,
  section: HARDWARE_APPLICATION_SCOPES.section,
  all_doors: HARDWARE_APPLICATION_SCOPES.matchingDoors,
  all_drawers: HARDWARE_APPLICATION_SCOPES.matchingDrawers
});

export function millimetersToInches(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric / MM_PER_INCH : null;
}

export function createRecommendedHardwarePlacement(host, proxySpec = {}) {
  const isDrawer = host?.role === "drawer_front";
  const framedDrawer = isDrawer && host?.metadata?.profileGeometry?.kind !== "slab";
  const widthIn = positiveNumber(host?.size?.x);
  const latchRight = host?.metadata?.latchSide !== "latch_left";
  const category = String(proxySpec?.category || "");
  const knobLike = isKnobLike(proxySpec);
  const edgeLike = ["edge_pull", "tab_pull"].includes(category);
  const suggestedQuantity = isDrawer && widthIn > 30 ? 2 : 1;
  return {
    orientation: knobLike ? (isDrawer ? "horizontal" : "vertical") : isDrawer ? "horizontal" : "vertical",
    horizontalAnchor: isDrawer ? "center" : latchRight ? "right" : "left",
    verticalAnchor: isDrawer ? (edgeLike || framedDrawer ? "top" : "middle") : edgeLike ? "top" : host?.metadata?.openingKind === "upper_glass" ? "bottom" : "top",
    edgeOffsetMm: isDrawer ? undefined : 50.8,
    crossAxisOffsetMm: undefined,
    mirrored: host?.metadata?.hingeSide === "hinge_right",
    quantityPerFront: suggestedQuantity
  };
}

export function evaluateHardwareCompatibility({
  host,
  proxySpec = {},
  placement,
  layout = null,
  candidateBounds = null
} = {}) {
  const reasonCodes = [];
  const messages = [];
  if (!host || !FRONT_ROLES.has(host.role) || !host.bounds || !host.size) {
    return compatibilityResult(
      HARDWARE_COMPATIBILITY_LEVELS.notCompatible,
      ["UNSUPPORTED_HOST"],
      ["Decorative hardware requires a generated door or drawer-front host."],
      placement
    );
  }

  const resolvedPlacement = normalizePlacement(placement, createRecommendedHardwarePlacement(host, proxySpec));
  const dimensions = proxySpec?.dimensionsMm || proxySpec?.dimensions || {};
  const mounting = proxySpec?.mounting || {};
  const category = String(proxySpec?.category || "");
  const compatiblePlacements = Array.isArray(proxySpec?.compatiblePlacements)
    ? proxySpec.compatiblePlacements
    : [];
  const isDrawer = host.role === "drawer_front";

  if (compatiblePlacements.length && !placementAllowsHost(compatiblePlacements, host, resolvedPlacement)) {
    reasonCodes.push("PLACEMENT_NOT_ALLOWED");
    messages.push(`This hardware family is not documented for ${isDrawer ? "drawer fronts" : "doors"}.`);
    return compatibilityResult(HARDWARE_COMPATIBILITY_LEVELS.notCompatible, reasonCodes, messages, resolvedPlacement, dimensions);
  }
  if (Array.isArray(proxySpec?.compatibilityRestrictions)) {
    const drawerRestriction = proxySpec.compatibilityRestrictions.some((item) => /not for drawer/i.test(String(item)));
    if (drawerRestriction && isDrawer) {
      return compatibilityResult(
        HARDWARE_COMPATIBILITY_LEVELS.notCompatible,
        ["PLACEMENT_NOT_ALLOWED"],
        ["The documented product restriction excludes drawer fronts."],
        resolvedPlacement,
        dimensions
      );
    }
  }

  const overallLengthIn = millimetersToInches(
    dimensions.overallLength ?? dimensions.diameter ?? dimensions.width
  );
  const crossSizeIn = millimetersToInches(
    dimensions.diameter ?? dimensions.width ?? dimensions.height
  );
  const projectionIn = millimetersToInches(dimensions.projection);
  const centerToCenter = Number(dimensions.centerToCenter);
  const holeCount = Number(mounting.holeCount);
  const pullLike = !isKnobLike(proxySpec) && category !== "cabinet_latch";

  if (!Number.isFinite(projectionIn) || projectionIn <= 0) {
    reasonCodes.push("MISSING_PROJECTION");
    messages.push("Projection is not verified; collision clearance requires review.");
  }
  if (pullLike && (!Number.isFinite(centerToCenter) || centerToCenter <= 0)) {
    reasonCodes.push("MISSING_CENTER_TO_CENTER");
    messages.push("Center-to-center mounting spacing is not verified.");
  }
  if (!Number.isFinite(holeCount) || holeCount <= 0) {
    reasonCodes.push("MISSING_MOUNTING_SPEC");
    messages.push("The mounting-hole specification is incomplete.");
  }

  const longAxis = resolvedPlacement.orientation === "horizontal" ? "x" : "y";
  const crossAxis = longAxis === "x" ? "y" : "x";
  if (Number.isFinite(overallLengthIn) && overallLengthIn > host.size[longAxis] - 0.25) {
    return compatibilityResult(
      HARDWARE_COMPATIBILITY_LEVELS.notCompatible,
      [...reasonCodes, "ENVELOPE_EXCEEDS_HOST"],
      [...messages, "The hardware envelope is longer than the usable front dimension."],
      resolvedPlacement,
      dimensions
    );
  }
  if (Number.isFinite(crossSizeIn) && crossSizeIn > host.size[crossAxis] - 0.25) {
    return compatibilityResult(
      HARDWARE_COMPATIBILITY_LEVELS.notCompatible,
      [...reasonCodes, "ENVELOPE_EXCEEDS_HOST"],
      [...messages, "The hardware envelope is wider than the usable front dimension."],
      resolvedPlacement,
      dimensions
    );
  }

  const maxDoorThicknessIn = millimetersToInches(mounting.maxDoorThickness);
  if (Number.isFinite(maxDoorThicknessIn) && host.size.z > maxDoorThicknessIn + 1e-6) {
    reasonCodes.push("FRONT_THICKNESS_REVIEW");
    messages.push("The generated front is thicker than the documented supplied-fixing limit.");
  }
  const profile = host.metadata?.profileGeometry;
  if (profile?.kind !== "slab" && Number.isFinite(overallLengthIn)) {
    const supportWidth = getRecommendedSupportWidth(host, resolvedPlacement);
    if (Number.isFinite(supportWidth) && overallLengthIn > supportWidth + 1e-6) {
      reasonCodes.push("MOUNTING_ZONE_REVIEW");
      messages.push("The hardware envelope extends beyond the preferred framed mounting zone.");
    }
  }
  if (resolvedPlacement.quantityPerFront === 2 && host.size.x < 18) {
    reasonCodes.push("TWO_PULL_SPACING_TIGHT");
    messages.push("Two pieces on a front under approximately 18 inches require spacing review.");
  }
  if (resolvedPlacement.quantityPerFront === 1 && isDrawer && host.size.x > 30) {
    reasonCodes.push("WIDE_DRAWER_SINGLE_PULL");
    messages.push("A wide drawer may be better served by two pieces or one elongated pull.");
  }

  if (candidateBounds && collidesWithAdjacentFront(candidateBounds, host, layout)) {
    return compatibilityResult(
      HARDWARE_COMPATIBILITY_LEVELS.notCompatible,
      [...reasonCodes, "ADJACENT_FRONT_COLLISION"],
      [...messages, "The projected hardware envelope conflicts with an adjacent front or trim component."],
      resolvedPlacement,
      dimensions
    );
  }

  const recommended = createRecommendedHardwarePlacement(host, proxySpec);
  const matchesRecommendation = placementsEquivalent(resolvedPlacement, recommended);
  const level = reasonCodes.length
    ? HARDWARE_COMPATIBILITY_LEVELS.possibleWithWarning
    : matchesRecommendation
      ? HARDWARE_COMPATIBILITY_LEVELS.recommended
      : HARDWARE_COMPATIBILITY_LEVELS.compatible;
  if (!messages.length) {
    messages.push(matchesRecommendation
      ? "This hardware and placement follow the current JQ recommendation."
      : "This placement fits the generated host.");
  }
  return compatibilityResult(level, reasonCodes, messages, resolvedPlacement, dimensions);
}

export function resolveHardwareApplicationScope(layout, selectedHostId, scope = HARDWARE_APPLICATION_SCOPES.component) {
  const components = Array.isArray(layout?.components) ? layout.components : [];
  const selected = components.find((component) => component.id === selectedHostId);
  if (!selected || !FRONT_ROLES.has(selected.role)) return [];
  const normalizedScope = normalizeScope(scope);
  const fronts = components.filter((component) => FRONT_ROLES.has(component.role));
  const selectedSectionId = getSectionId(components, selected);
  if (normalizedScope === HARDWARE_APPLICATION_SCOPES.section) {
    return fronts.filter((component) => getSectionId(components, component) === selectedSectionId);
  }
  if (normalizedScope === HARDWARE_APPLICATION_SCOPES.matchingDoors) {
    if (selected.role !== "door") return [];
    return fronts.filter((component) => component.role === "door" && frontMatches(selected, component));
  }
  if (normalizedScope === HARDWARE_APPLICATION_SCOPES.matchingDrawers) {
    if (selected.role !== "drawer_front") return [];
    return fronts.filter((component) => component.role === "drawer_front" && frontMatches(selected, component));
  }
  return [selected];
}

export function createHardwareApplicationProspect({
  layout,
  hardwareSelections,
  selectedHostId,
  variantId,
  snapshot = null,
  placement,
  scope = HARDWARE_APPLICATION_SCOPES.component,
  proxySpec = {},
  compatibility = evaluateHardwareCompatibility
} = {}) {
  const hosts = resolveHardwareApplicationScope(layout, selectedHostId, scope);
  const selectedHost = (layout?.components || []).find((component) => component.id === selectedHostId) || null;
  const accepted = [];
  const excluded = [];
  for (const host of hosts) {
    const hostPlacement = adaptScopedPlacement(placement, selectedHost, host, proxySpec);
    const result = compatibility({ host, proxySpec, placement: hostPlacement, layout });
    const record = { hostId: host.id, sectionId: getSectionId(layout?.components || [], host), placement: hostPlacement, compatibility: result };
    if (result.level === HARDWARE_COMPATIBILITY_LEVELS.notCompatible) excluded.push(record);
    else accepted.push(record);
  }
  const byHostId = cloneSelectionMap(hardwareSelections?.byHostId);
  for (const item of accepted) {
    byHostId[item.hostId] = {
      variantId: String(variantId || ""),
      snapshot: cloneValue(snapshot),
      placement: clonePlacement(item.placement)
    };
  }
  const nextHardwareSelections = {
    ...(hardwareSelections && typeof hardwareSelections === "object" ? hardwareSelections : {}),
    schemaVersion: 1,
    defaultVariantId: String(hardwareSelections?.defaultVariantId || variantId || ""),
    byHostId
  };
  return {
    scope: normalizeScope(scope),
    selectedHostId,
    variantId: String(variantId || ""),
    candidateCount: hosts.length,
    affectedCount: accepted.length,
    excludedCount: excluded.length,
    affectedHostIds: accepted.map((item) => item.hostId),
    accepted,
    excluded,
    nextHardwareSelections
  };
}

function adaptScopedPlacement(value, selectedHost, host, proxySpec) {
  const recommended = createRecommendedHardwarePlacement(host, proxySpec);
  const normalized = normalizePlacement(value, recommended);
  if (!selectedHost || selectedHost.id === host.id) return normalized;
  if (selectedHost.role !== host.role) return recommended;
  if (host.role === "door" && ["left", "right"].includes(normalized.horizontalAnchor)) {
    return {
      ...normalized,
      horizontalAnchor: recommended.horizontalAnchor,
      mirrored: recommended.mirrored
    };
  }
  return normalized;
}

export function applyHardwareSelectionScope(options = {}) {
  return createHardwareApplicationProspect(options).nextHardwareSelections;
}

function compatibilityResult(level, reasonCodes, messages, suggestedPlacement, dimensions = {}) {
  const width = positiveNumber(dimensions.width ?? dimensions.diameter ?? dimensions.overallLength);
  const height = positiveNumber(dimensions.height ?? dimensions.diameter ?? dimensions.width);
  const projection = positiveNumber(dimensions.projection);
  return {
    level,
    reasonCodes: [...new Set(reasonCodes)],
    messages: [...new Set(messages)],
    suggestedPlacement: clonePlacement(suggestedPlacement),
    collisionEnvelopeMm: width && height && projection ? { width, height, projection } : undefined
  };
}

function normalizePlacement(value, fallback) {
  const source = value && typeof value === "object" ? value : {};
  const normalized = {
    orientation: ["horizontal", "vertical"].includes(source.orientation) ? source.orientation : fallback.orientation,
    horizontalAnchor: ["left", "center", "right", "custom"].includes(source.horizontalAnchor) ? source.horizontalAnchor : fallback.horizontalAnchor,
    verticalAnchor: ["top", "middle", "bottom", "custom"].includes(source.verticalAnchor) ? source.verticalAnchor : fallback.verticalAnchor,
    edgeOffsetMm: finiteOptional(source.edgeOffsetMm, fallback.edgeOffsetMm),
    crossAxisOffsetMm: finiteOptional(source.crossAxisOffsetMm, fallback.crossAxisOffsetMm),
    mirrored: typeof source.mirrored === "boolean" ? source.mirrored : fallback.mirrored,
    quantityPerFront: source.quantityPerFront === 2 ? 2 : 1
  };
  return Object.fromEntries(Object.entries(normalized).filter(([, item]) => item !== undefined));
}

function normalizeScope(value) {
  const scope = SCOPE_ALIASES[value] || value;
  return Object.values(HARDWARE_APPLICATION_SCOPES).includes(scope)
    ? scope
    : HARDWARE_APPLICATION_SCOPES.component;
}

function placementAllowsHost(placements, host, placement) {
  const values = new Set(placements.map(String));
  if (host.role === "drawer_front") {
    if (placement.verticalAnchor === "top" && values.has("drawer_top_edge")) return true;
    return values.has("drawer_front");
  }
  if (host.metadata?.leafCount === 2 && values.has("paired_door")) return true;
  if (placement.orientation === "horizontal" && values.has("door_horizontal")) return true;
  if (placement.verticalAnchor === "top" && (values.has("door_top_edge") || values.has("door_edge"))) return true;
  if (["left", "right"].includes(placement.horizontalAnchor) && values.has("door_side_edge")) return true;
  return values.has("door");
}

function isKnobLike(proxySpec) {
  const category = String(proxySpec?.category || "");
  const holeCount = Number(proxySpec?.mounting?.holeCount);
  return ["round_knob", "t_bar_knob"].includes(category) || holeCount === 1;
}

function getRecommendedSupportWidth(host, placement) {
  const regions = host?.metadata?.profileGeometry?.solidRegions;
  if (!Array.isArray(regions)) return null;
  const desired = host.role === "drawer_front"
    ? placement.verticalAnchor === "bottom" ? "bottom_rail" : "top_rail"
    : placement.horizontalAnchor === "left" ? "left_stile" : "right_stile";
  const region = regions.find((item) => item.id === desired);
  if (!region?.bounds) return null;
  return placement.orientation === "horizontal"
    ? region.bounds.max.x - region.bounds.min.x
    : region.bounds.max.y - region.bounds.min.y;
}

function collidesWithAdjacentFront(candidateBounds, host, layout) {
  const components = Array.isArray(layout?.components) ? layout.components : [];
  return components.some((component) => {
    if (!component?.bounds || component.id === host.id || component.parentId === host.id) return false;
    if (!FRONT_ROLES.has(component.role) && !["trim", "crown", "handle"].includes(component.role)) return false;
    return overlaps(candidateBounds, component.bounds, ["x", "y"]);
  });
}

function overlaps(left, right, axes) {
  return axes.every((axis) => Math.min(left.max[axis], right.max[axis]) - Math.max(left.min[axis], right.min[axis]) > 1e-6);
}

function frontMatches(selected, candidate) {
  return selected.metadata?.style === candidate.metadata?.style
    && selected.metadata?.mounting === candidate.metadata?.mounting
    && selected.metadata?.openingKind === candidate.metadata?.openingKind;
}

function getSectionId(components, component) {
  if (component?.metadata?.sectionId) return component.metadata.sectionId;
  const byId = new Map(components.map((item) => [item.id, item]));
  let current = component;
  const visited = new Set();
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    if (current.role === "section") return current.id;
    current = byId.get(current.parentId) || byId.get(current.hostId) || null;
  }
  return null;
}

function placementsEquivalent(left, right) {
  return ["orientation", "horizontalAnchor", "verticalAnchor", "quantityPerFront"]
    .every((key) => left?.[key] === right?.[key]);
}

function cloneSelectionMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([key, selection]) => [
    key,
    {
      variantId: String(selection?.variantId || ""),
      ...(selection?.catalogVersion ? { catalogVersion: String(selection.catalogVersion) } : {}),
      snapshot: cloneValue(selection?.snapshot),
      placement: clonePlacement(selection?.placement)
    }
  ]));
}

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (!value || typeof value !== "object") return value ?? null;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneValue(item)]));
}

function clonePlacement(value) {
  if (!value || typeof value !== "object") return undefined;
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function finiteOptional(value, fallback) {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  const fallbackNumeric = Number(fallback);
  return Number.isFinite(fallbackNumeric) ? fallbackNumeric : undefined;
}

function positiveNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}
