import { PHYSICAL_RENDER_ROLES } from "./bookcase-render-contract.js?v=engine-polish-20260716a";

export const GUIDED_RENDER_CONTRACT_VERSION = 1;
const PHYSICAL_ROLES = new Set([
  ...PHYSICAL_RENDER_ROLES,
  "end_panel",
  "filler",
  "fascia",
  "plinth",
  "screen",
  "soundbar",
  "equipment",
  "vent",
  "slat"
]);

export function createGuidedSceneDescriptors(acceptedSpecification) {
  const sets = acceptedSpecification?.product?.descriptorSets
    || acceptedSpecification?.descriptorSets
    || [];
  const descriptors = [];
  for (const set of sets) {
    if (!set || !Array.isArray(set.components)) continue;
    const transform = normalizeTransform(set.transform);
    for (const component of set.components) {
      if (!isRenderableComponent(component)) continue;
      descriptors.push(Object.freeze({
        componentId: String(component.id),
        descriptorSetId: String(set.id),
        installationId: set.installationId || null,
        zoneId: set.zoneId || null,
        role: component.role,
        materialSlot: resolveGuidedMaterialSlot(component),
        bounds: cloneBounds(component.bounds),
        transform,
        metadata: component.metadata && typeof component.metadata === "object"
          ? structuredCloneSafe(component.metadata)
          : {}
      }));
    }
  }
  return Object.freeze(descriptors);
}

/**
 * Apply one accepted descriptor-set rigid transform in inch space.
 *
 * Descriptor coordinates are local: X spans the casework, Y rises from its
 * bottom, and Z runs from the cabinet front toward the rear wall. The accepted
 * transform maps those axes into the resolved room without changing scale.
 */
export function transformGuidedPointToWorld(point, transform) {
  if (!validPoint(point)) {
    throw new TypeError("A finite local descriptor point is required.");
  }
  const normalized = normalizeTransform(transform);
  return Object.freeze({
    x: normalized.translation.x
      + normalized.basis.x.x * Number(point.x)
      + normalized.basis.y.x * Number(point.y)
      + normalized.basis.z.x * Number(point.z),
    y: normalized.translation.y
      + normalized.basis.x.y * Number(point.x)
      + normalized.basis.y.y * Number(point.y)
      + normalized.basis.z.y * Number(point.z),
    z: normalized.translation.z
      + normalized.basis.x.z * Number(point.x)
      + normalized.basis.y.z * Number(point.y)
      + normalized.basis.z.z * Number(point.z)
  });
}

/** Return the world AABB enclosing all eight transformed local AABB corners. */
export function transformGuidedBoundsToWorld(bounds, transform) {
  if (!validBounds(bounds)) {
    throw new TypeError("Finite ordered local descriptor bounds are required.");
  }
  const corners = [];
  for (const x of [Number(bounds.min.x), Number(bounds.max.x)]) {
    for (const y of [Number(bounds.min.y), Number(bounds.max.y)]) {
      for (const z of [Number(bounds.min.z), Number(bounds.max.z)]) {
        corners.push(transformGuidedPointToWorld({ x, y, z }, transform));
      }
    }
  }
  return cloneBounds({
    min: {
      x: Math.min(...corners.map((point) => point.x)),
      y: Math.min(...corners.map((point) => point.y)),
      z: Math.min(...corners.map((point) => point.z))
    },
    max: {
      x: Math.max(...corners.map((point) => point.x)),
      y: Math.max(...corners.map((point) => point.y)),
      z: Math.max(...corners.map((point) => point.z))
    }
  });
}

export function auditGuidedAcceptedSpecification(acceptedSpecification, options = {}) {
  const tolerance = positiveOrZero(options.tolerance, 0.001);
  const errors = [];
  const warnings = [];
  const product = acceptedSpecification?.product || acceptedSpecification;
  const descriptorSets = Array.isArray(product?.descriptorSets) ? product.descriptorSets : [];
  const fit = acceptedSpecification?.fit;
  const installations = Array.isArray(fit?.installations)
    ? fit.installations
    : fit?.accepted
      ? [fit]
      : [];
  const installationsById = new Map(installations.map((entry) => [
    String(entry.id || entry.installationId || entry.zoneId || ""),
    entry
  ]));
  const componentIds = new Set();
  const sceneDescriptors = createGuidedSceneDescriptors(acceptedSpecification);

  if (acceptedSpecification?.accepted !== true) {
    errors.push(issue("SPECIFICATION_NOT_ACCEPTED", "The render contract requires an accepted specification."));
  }
  if (!descriptorSets.length) {
    errors.push(issue("MISSING_DESCRIPTOR_SETS", "The accepted product contains no descriptor sets."));
  }

  for (const set of descriptorSets) {
    const setId = String(set?.id || "");
    if (!setId) errors.push(issue("MISSING_DESCRIPTOR_SET_ID", "Every descriptor set requires an id."));
    if (!sameRootScale(set?.rootScale)) {
      errors.push(issue("ROOT_SCALE_MUTATION", `${setId || "Descriptor set"} must retain root scale 1 / 1 / 1.`, { descriptorSetId: setId }));
    }
    if (!validTransform(set?.transform)) {
      errors.push(issue("INVALID_DESCRIPTOR_TRANSFORM", `${setId || "Descriptor set"} has a non-finite installation transform.`, { descriptorSetId: setId }));
    }
    if (!validBounds(set?.bounds)) {
      errors.push(issue("INVALID_DESCRIPTOR_SET_BOUNDS", `${setId || "Descriptor set"} has invalid bounds.`, { descriptorSetId: setId }));
    }
    if (set?.physicalBounds !== undefined && !validBounds(set.physicalBounds)) {
      errors.push(issue("INVALID_PHYSICAL_DESCRIPTOR_BOUNDS", `${setId || "Descriptor set"} has invalid physical bounds.`, { descriptorSetId: setId }));
    }
    const installationKey = String(set?.installationId || set?.zoneId || "");
    const installation = installationsById.get(installationKey)
      || installations.find((entry) => entry.zoneId === set?.zoneId);
    if (!installation) {
      errors.push(issue("MISSING_INSTALLATION_REFERENCE", `${setId || "Descriptor set"} does not resolve to an accepted installation.`, { descriptorSetId: setId }));
    } else {
      auditInstallation(set, installation, tolerance, errors);
    }

    for (const component of Array.isArray(set?.components) ? set.components : []) {
      if (!component?.id || componentIds.has(component.id)) {
        errors.push(issue(
          component?.id ? "DUPLICATE_COMPONENT_ID" : "MISSING_COMPONENT_ID",
          component?.id
            ? `Physical component id ${component.id} occurs more than once.`
            : `${setId || "Descriptor set"} contains a component without an id.`,
          { descriptorSetId: setId, componentId: component?.id || null }
        ));
        continue;
      }
      componentIds.add(component.id);
      if (isRenderableComponent(component) && !validBounds(component.bounds)) {
        errors.push(issue("INVALID_COMPONENT_BOUNDS", `${component.id} has invalid physical bounds.`, {
          descriptorSetId: setId,
          componentId: component.id
        }));
      }
      if (
        isRenderableComponent(component)
        && validBounds(set?.bounds)
        && validBounds(component.bounds)
        && !containsBounds(set.bounds, component.bounds, tolerance)
      ) {
        errors.push(issue("COMPONENT_OUTSIDE_DESCRIPTOR_SET", `${component.id} exceeds its descriptor-set envelope.`, {
          descriptorSetId: setId,
          componentId: component.id
        }));
      }
    }
  }

  auditTopologyBoundaries(
    acceptedSpecification,
    sceneDescriptors,
    installationsById,
    tolerance,
    errors
  );

  if (product?.pricingStatus === "unavailable") {
    warnings.push(issue("PRICING_REQUIRES_DESIGN_REVIEW", "This product has no validated automated price formula.", { severity: "warning" }));
  }

  return Object.freeze({
    valid: errors.length === 0,
    contractVersion: GUIDED_RENDER_CONTRACT_VERSION,
    descriptorSetCount: descriptorSets.length,
    physicalComponentCount: sceneDescriptors.length,
    errors: Object.freeze(errors),
    warnings: Object.freeze(warnings)
  });
}

export function validateGuidedRenderedManifest(acceptedSpecification, records) {
  const expected = createGuidedSceneDescriptors(acceptedSpecification);
  const expectedById = new Map(expected.map((entry) => [entry.componentId, entry]));
  const seen = new Set();
  const issues = [];
  const validatedRecords = [];
  for (const record of Array.isArray(records) ? records : []) {
    const id = record?.componentId;
    if (typeof id !== "string" || !expectedById.has(id)) {
      issues.push(issue("UNEXPECTED_RENDER_COMPONENT", `Rendered component ${id || "(missing id)"} has no accepted descriptor.`, { componentId: id || null }));
      continue;
    }
    if (seen.has(id)) {
      issues.push(issue("DUPLICATE_RENDER_COMPONENT", `${id} was rendered more than once.`, { componentId: id }));
      continue;
    }
    seen.add(id);
    if (!Number.isInteger(record.meshCount) || record.meshCount < 1) {
      issues.push(issue("EMPTY_RENDER_COMPONENT", `${id} produced no mesh.`, { componentId: id }));
    }
    const descriptor = expectedById.get(id);
    const expectedWorldBounds = transformGuidedBoundsToWorld(descriptor.bounds, descriptor.transform);
    const submeshes = Array.isArray(record.submeshes) ? record.submeshes : null;
    if (submeshes) {
      validateRenderedSubmeshes(descriptor, record, submeshes, expectedWorldBounds, issues);
    } else if (record.worldBounds !== undefined && (
      !validBounds(record.worldBounds)
      || !sameBounds(record.worldBounds, expectedWorldBounds, 0.001)
    )) {
      issues.push(issue("RENDER_COMPONENT_WORLD_BOUNDS_MISMATCH", `${id} does not occupy its accepted world-space envelope.`, { componentId: id }));
    }
    validatedRecords.push(freezeRenderedRecord(record));
  }
  for (const descriptor of expected) {
    if (!seen.has(descriptor.componentId)) {
      issues.push(issue("MISSING_RENDER_COMPONENT", `${descriptor.componentId} is absent from the scene.`, { componentId: descriptor.componentId }));
    }
  }
  return Object.freeze({
    valid: issues.length === 0,
    contractVersion: GUIDED_RENDER_CONTRACT_VERSION,
    expectedCount: expected.length,
    renderedCount: seen.size,
    issues: Object.freeze(issues),
    records: Object.freeze(validatedRecords)
  });
}

function validateRenderedSubmeshes(descriptor, record, submeshes, expectedWorldBounds, issues) {
  const componentId = descriptor.componentId;
  if (submeshes.length !== record.meshCount) {
    issues.push(issue("RENDER_SUBMESH_COUNT_MISMATCH", `${componentId} mesh count does not match its submesh material records.`, { componentId }));
  }
  const submeshIds = new Set();
  const actualSlots = [];
  const worldBounds = [];
  for (const submesh of submeshes) {
    const submeshId = String(submesh?.submeshId || "");
    if (!submeshId || submeshIds.has(submeshId)) {
      issues.push(issue("INVALID_RENDER_SUBMESH_ID", `${componentId} has a missing or duplicated rendered submesh id.`, { componentId, submeshId: submeshId || null }));
    }
    submeshIds.add(submeshId);
    const materialSlot = String(submesh?.materialSlot || "");
    if (!materialSlot) {
      issues.push(issue("MISSING_RENDER_SUBMESH_MATERIAL", `${componentId}/${submeshId || "submesh"} has no material slot.`, { componentId, submeshId: submeshId || null }));
    } else {
      actualSlots.push(materialSlot);
    }
    if (!validBounds(submesh?.worldBounds)) {
      issues.push(issue("INVALID_RENDER_SUBMESH_WORLD_BOUNDS", `${componentId}/${submeshId || "submesh"} has invalid world bounds.`, { componentId, submeshId: submeshId || null }));
    } else {
      worldBounds.push(submesh.worldBounds);
      if (!containsBounds(expectedWorldBounds, submesh.worldBounds, 0.001)) {
        issues.push(issue("RENDER_SUBMESH_OUTSIDE_DESCRIPTOR", `${componentId}/${submeshId || "submesh"} exceeds its accepted world-space envelope.`, { componentId, submeshId: submeshId || null }));
      }
    }
  }

  const declaredSlots = [...new Set(Array.isArray(record.materialSlots) ? record.materialSlots.map(String) : [])].sort();
  const renderedSlots = [...new Set(actualSlots)].sort();
  if (declaredSlots.length === 0 || declaredSlots.join("|") !== renderedSlots.join("|")) {
    issues.push(issue("RENDER_MATERIAL_SLOT_MANIFEST_MISMATCH", `${componentId} material slots do not match its rendered submeshes.`, { componentId }));
  }
  const combinedBounds = worldBounds.length ? unionRenderBounds(worldBounds) : null;
  if (
    !combinedBounds
    || !validBounds(record.worldBounds)
    || !sameBounds(combinedBounds, record.worldBounds, 0.001)
    || !sameBounds(record.worldBounds, expectedWorldBounds, 0.001)
  ) {
    issues.push(issue("RENDER_COMPONENT_WORLD_BOUNDS_MISMATCH", `${componentId} does not occupy its accepted world-space envelope.`, { componentId }));
  }

  const profile = descriptor.metadata?.profileGeometry;
  if (["framed_panel", "glass_frame"].includes(profile?.kind)) {
    if (submeshes.length !== 5) {
      issues.push(issue("FRONT_PROFILE_SUBMESH_MISMATCH", `${componentId} must render four frame members and one recessed field.`, { componentId }));
    }
    const requiredFieldSlot = profile.kind === "glass_frame" || profile.fieldRegion?.kind === "glass"
      ? "glass"
      : descriptor.materialSlot;
    if (!submeshes.some((submesh) => submesh.submeshId === "center-field" && submesh.materialSlot === requiredFieldSlot)) {
      issues.push(issue(
        requiredFieldSlot === "glass" ? "GLASS_FIELD_MATERIAL_MISMATCH" : "RECESSED_FIELD_MATERIAL_MISMATCH",
        `${componentId} center field does not use its required ${requiredFieldSlot} material.`,
        { componentId }
      ));
    }
  }
  if (profile?.kind === "crown_profile_extrusion" && !submeshes.some((submesh) => submesh.geometry === "crown_profile_extrusion")) {
    issues.push(issue("CROWN_PROFILE_GEOMETRY_MISSING", `${componentId} did not render its authored crown extrusion.`, { componentId }));
  }
}

function freezeRenderedRecord(record) {
  const frozen = {
    componentId: String(record?.componentId || ""),
    meshCount: Number(record?.meshCount || 0)
  };
  if (Array.isArray(record?.materialSlots)) {
    frozen.materialSlots = Object.freeze(record.materialSlots.map(String));
  }
  if (validBounds(record?.worldBounds)) frozen.worldBounds = cloneBounds(record.worldBounds);
  if (Array.isArray(record?.submeshes)) {
    frozen.submeshes = Object.freeze(record.submeshes.map((submesh) => Object.freeze({
      submeshId: String(submesh?.submeshId || ""),
      geometry: String(submesh?.geometry || "box"),
      materialSlot: String(submesh?.materialSlot || ""),
      worldBounds: validBounds(submesh?.worldBounds) ? cloneBounds(submesh.worldBounds) : null
    })));
  }
  return Object.freeze(frozen);
}

function unionRenderBounds(boundsList) {
  return boundsList.reduce((combined, bounds) => ({
    min: {
      x: Math.min(combined.min.x, Number(bounds.min.x)),
      y: Math.min(combined.min.y, Number(bounds.min.y)),
      z: Math.min(combined.min.z, Number(bounds.min.z))
    },
    max: {
      x: Math.max(combined.max.x, Number(bounds.max.x)),
      y: Math.max(combined.max.y, Number(bounds.max.y)),
      z: Math.max(combined.max.z, Number(bounds.max.z))
    }
  }), {
    min: { x: Infinity, y: Infinity, z: Infinity },
    max: { x: -Infinity, y: -Infinity, z: -Infinity }
  });
}

export function resolveGuidedMaterialSlot(component) {
  const role = String(component?.role || "").replaceAll("-", "_");
  const explicit = component?.metadata?.materialSlot;
  if (explicit === "cabinet_interior") return "accent";
  if (["hardware", "led", "screen", "back", "side", "front", "toe"].includes(explicit)) return explicit;
  if (["mounting", "structural-neutral"].includes(explicit)) return "reveal";
  if (role === "handle") return "hardware";
  if (role === "light") return "led";
  if (role === "screen") return "screen";
  if (role === "glass") return "glass";
  if (["back_panel", "backing_panel", "vent"].includes(role)) return "back";
  if (["door", "drawer_front", "slat"].includes(role)) return "front";
  if (["side_panel", "end_panel", "filler", "divider"].includes(role)) return "side";
  if (role === "mounting_rail") return "reveal";
  if (["toe", "toe_kick", "plinth"].includes(role)) return "toe";
  return "case";
}

/**
 * A specification is accepted only when every renderable physical descriptor
 * remains inside its resolved topology zone and outside every architectural
 * opening, obstruction, swing, trim, and service exclusion. This mirrors the
 * renderer's world transform rather than trusting local descriptor bounds.
 */
function auditTopologyBoundaries(
  acceptedSpecification,
  descriptors,
  installationsById,
  tolerance,
  errors
) {
  const room = acceptedSpecification?.room;
  const zones = Array.isArray(room?.installationZones) ? room.installationZones : [];
  const exclusions = Array.isArray(room?.exclusionVolumes) ? room.exclusionVolumes : [];
  if (!zones.length && !exclusions.length) return;

  const zonesById = new Map(zones.map((zone) => [String(zone?.id || ""), zone]));
  for (const descriptor of descriptors) {
    const installation = installationsById.get(String(descriptor.installationId || ""));
    const zoneId = String(descriptor.zoneId || installation?.zoneId || "");
    const zone = zonesById.get(zoneId);
    const detail = {
      descriptorSetId: descriptor.descriptorSetId,
      componentId: descriptor.componentId,
      installationId: descriptor.installationId,
      zoneId: zoneId || null
    };

    if (!zone) {
      errors.push(issue(
        "MISSING_TOPOLOGY_ZONE_REFERENCE",
        `${descriptor.componentId} does not resolve to a room installation zone.`,
        detail
      ));
      continue;
    }

    const worldPoints = transformedBoundsCorners(descriptor.bounds, descriptor.transform);
    if (
      !worldPoints.length
      || worldPoints.some((point) => !pointInsideTopologyZone(point, zone, tolerance))
    ) {
      errors.push(issue(
        "DESCRIPTOR_OUTSIDE_INSTALLATION_ZONE",
        `${descriptor.componentId} exits the accepted ${zoneId} topology zone.`,
        detail
      ));
    }

    const worldBounds = transformGuidedBoundsToWorld(descriptor.bounds, descriptor.transform);
    for (const exclusion of exclusions) {
      const exclusionBounds = normalizeFitBounds(exclusion?.bounds);
      if (!exclusionBounds || !boundsOverlapWithPositiveVolume(worldBounds, exclusionBounds, tolerance)) continue;
      errors.push(issue(
        "DESCRIPTOR_INTERSECTS_EXCLUSION_VOLUME",
        `${descriptor.componentId} intersects the accepted ${exclusion.id || "room"} exclusion volume.`,
        {
          ...detail,
          exclusionVolumeId: exclusion.id || null,
          featureId: exclusion.featureId || null,
          exclusionKind: exclusion.kind || null
        }
      ));
    }
  }
}

function transformedBoundsCorners(bounds, transform) {
  if (!validBounds(bounds) || !validTransform(transform)) return [];
  const points = [];
  for (const x of [Number(bounds.min.x), Number(bounds.max.x)]) {
    for (const y of [Number(bounds.min.y), Number(bounds.max.y)]) {
      for (const z of [Number(bounds.min.z), Number(bounds.max.z)]) {
        points.push(transformGuidedPointToWorld({ x, y, z }, transform));
      }
    }
  }
  return points;
}

function pointInsideTopologyZone(point, zone, tolerance) {
  const origin = pointFrom(zone?.orientation?.origin) || {
    x: Number(zone?.leftPlaneX),
    y: Number(zone?.bottomPlaneY),
    z: Number(zone?.backPlaneZ)
  };
  const widthAxis = axisFrom(zone?.orientation?.widthAxis || [1, 0, 0]);
  const heightAxis = axisFrom(zone?.orientation?.heightAxis || [0, 1, 0]);
  const depthAxis = axisFrom(zone?.orientation?.depthAxis || [0, 0, -1]);
  if (!validPoint(origin) || !widthAxis || !heightAxis || !depthAxis) return false;

  const relative = subtract(point, origin);
  const widthCoordinateAtOrigin = finiteCoordinate(
    zone?.orientation?.widthCoordinateAtOrigin,
    Number(zone?.leftPlaneX)
  );
  const widthCoordinate = widthCoordinateAtOrigin + dot(relative, widthAxis);
  const heightCoordinate = origin.y + dot(relative, heightAxis);
  const depthCoordinate = dot(relative, depthAxis);
  return widthCoordinate >= Number(zone.leftPlaneX) - tolerance
    && widthCoordinate <= Number(zone.rightPlaneX) + tolerance
    && heightCoordinate >= Number(zone.bottomPlaneY) - tolerance
    && heightCoordinate <= Number(zone.topPlaneY) + tolerance
    && depthCoordinate >= -tolerance;
}

function boundsOverlapWithPositiveVolume(first, second, tolerance) {
  return validBounds(first) && validBounds(second) && ["x", "y", "z"].every((axis) => (
    Math.min(Number(first.max[axis]), Number(second.max[axis]))
      - Math.max(Number(first.min[axis]), Number(second.min[axis])) > tolerance
  ));
}

function auditInstallation(set, installation, tolerance, errors) {
  const anchors = installation.anchors || {};
  const casework = installation.casework || {};
  const treatments = installation.treatments || {};
  const physicalBounds = set.physicalBounds || set.bounds;
  const worldBounds = validBounds(physicalBounds) && validTransform(set.transform)
    ? transformGuidedBoundsToWorld(physicalBounds, set.transform)
    : null;
  const worldBottom = Number(worldBounds?.min?.y);
  if (!sameRootScale(installation.invariants?.rootScale)) {
    errors.push(issue("INSTALLATION_ROOT_SCALE_MUTATION", `${set.id} installation root scale is not 1 / 1 / 1.`, { descriptorSetId: set.id }));
  }
  if (installation.mode !== "floating") {
    const floorY = Number(anchors.floorY);
    const anchoredBottomY = Number(anchors.bottomY);
    const zoneBottomY = Number(installation.zoneBounds?.bottom);
    const acceptedBottomY = Number.isFinite(anchoredBottomY)
      ? anchoredBottomY
      : Number.isFinite(zoneBottomY)
        ? zoneBottomY
        : floorY;
    const featureSupported = Number.isFinite(floorY)
      && Number.isFinite(acceptedBottomY)
      && acceptedBottomY > floorY + tolerance;
    const requiredBottomY = featureSupported ? acceptedBottomY : floorY;
    if (Number.isFinite(requiredBottomY) && Number.isFinite(worldBottom) && Math.abs(worldBottom - requiredBottomY) > tolerance) {
      errors.push(issue(
        featureSupported ? "BASE_NOT_ON_ACCEPTED_SUPPORT" : "BASE_NOT_ON_FLOOR",
        featureSupported
          ? `${set.id} is not anchored to the accepted feature-support plane.`
          : `${set.id} is not anchored to the installation floor plane.`,
        { descriptorSetId: set.id }
      ));
    }
  }
  if (installation.mode === "floating" && Number.isFinite(anchors.floorY)) {
    if (Number.isFinite(worldBottom) && worldBottom <= anchors.floorY + tolerance) {
      errors.push(issue("FLOATING_INSTALLATION_TOUCHES_FLOOR", `${set.id} must preserve its open floor line.`, { descriptorSetId: set.id }));
    }
  }
  auditInstallationOrientation(set, installation, tolerance, errors);
  const zone = installation.zoneBounds || {};
  const treatmentWidth = Number(treatments.left?.width || 0) + Number(treatments.right?.width || 0);
  const solvedWidth = Number(casework.width || 0) + treatmentWidth;
  if (
    Number.isFinite(zone.left)
    && Number.isFinite(zone.right)
    && Math.abs((zone.right - zone.left) - solvedWidth) > tolerance
  ) {
    errors.push(issue("INSTALLATION_WIDTH_RECONCILIATION_FAILED", `${set.id} does not reconcile casework and treatments to its zone.`, { descriptorSetId: set.id }));
  }
  auditInstallationTreatments(set, installation, tolerance, errors);
  auditExactFitEnvelope(set, installation, tolerance, errors);
}

function auditExactFitEnvelope(set, installation, tolerance, errors) {
  const components = Array.isArray(set?.components) ? set.components : [];
  const contract = components.find((component) => (
    component?.metadata?.fitEnvelopeContract === "accepted-fit-exact"
  ));
  if (!contract) return;

  const casework = installation.casework || {};
  const treatments = installation.treatments || {};
  const width = Number(casework.width);
  const height = Number(casework.overallHeight);
  const depth = Number(casework.depth);
  if (![width, height, depth].every((value) => Number.isFinite(value) && value > 0)) return;

  // A filler physically occupies its entire solved width. A finished-end
  // treatment deliberately reserves part of that width as open design
  // clearance, so only the declared end-panel thickness belongs in the
  // visible/physical descriptor envelope.
  const leftTreatmentWidth = physicalSideTreatmentWidth(treatments.left);
  const rightTreatmentWidth = physicalSideTreatmentWidth(treatments.right);
  const expectedBounds = makeBounds(
    -width / 2 - leftTreatmentWidth,
    width / 2 + rightTreatmentWidth,
    0,
    height,
    0,
    depth
  );
  const visibleBounds = unionBounds(components
    .filter(isRenderableComponent)
    .map((component) => component.bounds));

  if (!sameBounds(set.physicalBounds, expectedBounds, tolerance)) {
    errors.push(issue(
      "PHYSICAL_DESCRIPTOR_FIT_DIMENSION_MISMATCH",
      `${set.id} physical bounds do not match the accepted fit dimensions.`,
      { descriptorSetId: set.id }
    ));
  }
  if (!sameBounds(visibleBounds, expectedBounds, tolerance)) {
    errors.push(issue(
      "VISIBLE_DESCRIPTOR_FIT_DIMENSION_MISMATCH",
      `${set.id} visible bounds do not match the accepted fit dimensions.`,
      { descriptorSetId: set.id }
    ));
  }

  for (const component of components) {
    if (validBounds(component?.bounds) && !containsBounds(expectedBounds, component.bounds, tolerance)) {
      errors.push(issue(
        "DESCRIPTOR_COMPONENT_OUTSIDE_FIT_ENVELOPE",
        `${component.id} exceeds the accepted physical fit envelope.`,
        { descriptorSetId: set.id, componentId: component.id }
      ));
    }
  }
}

function physicalSideTreatmentWidth(treatment) {
  const width = Math.max(0, Number(treatment?.width) || 0);
  if (treatment?.kind === "filler") return width;
  if (
    treatment?.kind === "finished-end"
    || treatment?.kind === "clearance" && treatment?.finishedExteriorSide === true
  ) {
    return Math.min(width, Math.max(0, Number(treatment?.endPanelThickness) || 0));
  }
  return 0;
}

function auditInstallationTreatments(set, installation, tolerance, errors) {
  const treatments = installation.treatments || {};
  const casework = installation.casework || {};
  const width = Number(casework.width);
  const height = Number(casework.overallHeight);
  const depth = Number(casework.depth ?? set.nominalDepth);
  if (![width, height, depth].every((value) => Number.isFinite(value) && value > 0)) return;
  const halfWidth = width / 2;

  for (const position of ["left", "right"]) {
    const treatment = treatments[position];
    const treatmentWidth = Number(treatment?.width);
    if (!Number.isFinite(treatmentWidth) || treatmentWidth <= tolerance) continue;
    const isFiller = treatment.kind === "filler";
    const endPanelThickness = Number(treatment.endPanelThickness);
    const isFinishedEnd = (
      treatment.kind === "finished-end"
      || treatment.kind === "clearance" && treatment.finishedExteriorSide === true
    ) && Number.isFinite(endPanelThickness) && endPanelThickness > tolerance;
    if (!isFiller && !isFinishedEnd) continue;

    const physicalWidth = isFiller ? treatmentWidth : Math.min(treatmentWidth, endPanelThickness);
    const innerEdge = position === "left" ? -halfWidth : halfWidth;
    const expectedBounds = makeBounds(
      position === "left" ? innerEdge - physicalWidth : innerEdge,
      position === "left" ? innerEdge : innerEdge + physicalWidth,
      0,
      height,
      0,
      depth
    );
    auditTreatmentComponent({
      set,
      installation,
      treatment,
      position,
      expectedRole: isFiller ? "filler" : "end_panel",
      expectedDimension: isFiller ? treatmentWidth : endPanelThickness,
      dimensionAxis: "x",
      expectedBounds,
      exactPhysicalBounds: true,
      tolerance,
      errors
    });
  }

  const baseHeight = Number(treatments.base?.height);
  if (Number.isFinite(baseHeight) && baseHeight > tolerance && treatments.base?.kind !== "none") {
    auditTreatmentComponent({
      set,
      installation,
      treatment: treatments.base,
      position: "base",
      expectedRoles: ["base", "plinth"],
      expectedDimension: baseHeight,
      dimensionAxis: "y",
      expectedBounds: makeBounds(-halfWidth, halfWidth, 0, baseHeight, 0, depth),
      exactPhysicalBounds: false,
      tolerance,
      errors
    });
  }

  const topHeight = Number(treatments.top?.height);
  if (Number.isFinite(topHeight) && topHeight > tolerance && treatments.top?.kind !== "none") {
    auditTreatmentComponent({
      set,
      installation,
      treatment: treatments.top,
      position: "top",
      expectedRoles: ["crown", "trim"],
      expectedDimension: topHeight,
      dimensionAxis: "y",
      expectedBounds: makeBounds(-halfWidth, halfWidth, height - topHeight, height, 0, depth),
      exactPhysicalBounds: false,
      tolerance,
      errors
    });
  }
}

function auditTreatmentComponent(options) {
  const {
    set,
    installation,
    treatment,
    position,
    expectedRole,
    expectedRoles = [expectedRole],
    expectedDimension,
    dimensionAxis,
    expectedBounds,
    exactPhysicalBounds,
    tolerance,
    errors
  } = options;
  const expectedId = String(treatment?.id || `installation-${position}-treatment`);
  const candidates = (set.components || []).filter((component) => {
    const metadata = component?.metadata?.installationTreatment;
    return metadata?.id === expectedId && metadata?.position === position && metadata?.primary === true;
  });
  const detail = {
    descriptorSetId: set.id,
    installationId: installation.id || null,
    treatmentId: expectedId,
    treatmentPosition: position
  };
  if (candidates.length !== 1) {
    errors.push(issue(
      candidates.length ? "DUPLICATE_INSTALLATION_TREATMENT_DESCRIPTOR" : "MISSING_INSTALLATION_TREATMENT_DESCRIPTOR",
      `${set.id} must expose exactly one primary physical descriptor for its ${position} installation treatment.`,
      detail
    ));
    return;
  }

  const component = candidates[0];
  const metadata = component.metadata.installationTreatment;
  if (!expectedRoles.includes(component.role)) {
    errors.push(issue(
      "INSTALLATION_TREATMENT_ROLE_MISMATCH",
      `${component.id} does not use the required physical role for its ${position} treatment.`,
      { ...detail, componentId: component.id, expectedRoles, actualRole: component.role }
    ));
  }
  if (
    metadata.source !== "accepted-installation-fit"
    || metadata.solvedDimension?.axis !== dimensionAxis
    || Math.abs(Number(metadata.solvedDimension?.value) - expectedDimension) > tolerance
    || !sameBounds(metadata.solvedLocalBounds, expectedBounds, tolerance)
  ) {
    errors.push(issue(
      "INSTALLATION_TREATMENT_DIMENSION_MISMATCH",
      `${component.id} does not preserve the solved ${position} treatment dimension and local anchors.`,
      { ...detail, componentId: component.id }
    ));
  }
  const solvedWorldBounds = normalizeFitBounds(treatment?.bounds);
  if (solvedWorldBounds && !sameBounds(metadata.solvedWorldBounds, solvedWorldBounds, tolerance)) {
    errors.push(issue(
      "INSTALLATION_TREATMENT_ANCHOR_MISMATCH",
      `${component.id} does not preserve the solver's world-space ${position} treatment anchors.`,
      { ...detail, componentId: component.id }
    ));
  }
  if (exactPhysicalBounds && !sameBounds(component.bounds, expectedBounds, tolerance)) {
    errors.push(issue(
      "INSTALLATION_TREATMENT_PHYSICAL_BOUNDS_MISMATCH",
      `${component.id} does not occupy its solved ${position} treatment envelope.`,
      { ...detail, componentId: component.id }
    ));
  }
  if (!exactPhysicalBounds && !coversTreatmentAnchors(component.bounds, expectedBounds, position, tolerance)) {
    errors.push(issue(
      "INSTALLATION_TREATMENT_PHYSICAL_BOUNDS_MISMATCH",
      `${component.id} does not reach the required ${position} fit anchors.`,
      { ...detail, componentId: component.id }
    ));
  }
}

function coversTreatmentAnchors(actual, expected, position, tolerance) {
  if (!validBounds(actual) || !validBounds(expected)) return false;
  if (position === "base") {
    return Number(actual.min.y) <= Number(expected.min.y) + tolerance
      && Number(actual.max.y) >= Number(expected.max.y) - tolerance
      && Number(actual.min.x) <= Number(expected.min.x) + tolerance
      && Number(actual.max.x) >= Number(expected.max.x) - tolerance;
  }
  return Number(actual.max.y) >= Number(expected.max.y) - tolerance
    && Number(actual.max.y) <= Number(expected.max.y) + tolerance
    && Number(actual.max.y) - Number(actual.min.y) >= Number(expected.max.y) - Number(expected.min.y) - tolerance
    && Number(actual.min.x) <= Number(expected.min.x) + tolerance
    && Number(actual.max.x) >= Number(expected.max.x) - tolerance;
}

function normalizeFitBounds(value) {
  const min = value?.min || { x: value?.minX, y: value?.minY, z: value?.minZ };
  const max = value?.max || { x: value?.maxX, y: value?.maxY, z: value?.maxZ };
  if (![min?.x, min?.y, min?.z, max?.x, max?.y, max?.z].every((entry) => Number.isFinite(Number(entry)))) {
    return null;
  }
  return makeBounds(min.x, max.x, min.y, max.y, min.z, max.z);
}

function makeBounds(minX, maxX, minY, maxY, minZ, maxZ) {
  return {
    min: { x: Number(minX), y: Number(minY), z: Number(minZ) },
    max: { x: Number(maxX), y: Number(maxY), z: Number(maxZ) }
  };
}

function sameBounds(first, second, tolerance) {
  return validBounds(first) && validBounds(second) && ["x", "y", "z"].every((axis) => (
    Math.abs(Number(first.min[axis]) - Number(second.min[axis])) <= tolerance
    && Math.abs(Number(first.max[axis]) - Number(second.max[axis])) <= tolerance
  ));
}

function unionBounds(boundsList) {
  const valid = boundsList.filter(validBounds);
  if (!valid.length) return null;
  return {
    min: Object.fromEntries(["x", "y", "z"].map((axis) => [
      axis,
      Math.min(...valid.map((bounds) => Number(bounds.min[axis])))
    ])),
    max: Object.fromEntries(["x", "y", "z"].map((axis) => [
      axis,
      Math.max(...valid.map((bounds) => Number(bounds.max[axis])))
    ]))
  };
}

function auditInstallationOrientation(set, installation, tolerance, errors) {
  const orientation = installation.orientation;
  const depth = Number(set.nominalDepth ?? installation.casework?.depth);
  if (!orientation || !Number.isFinite(depth) || depth <= 0 || !validTransform(set.transform)) return;

  const origin = pointFrom(orientation.origin);
  const widthAxis = axisFrom(orientation.widthAxis);
  const heightAxis = axisFrom(orientation.heightAxis);
  const outwardAxis = axisFrom(orientation.depthAxis);
  if (!origin || !widthAxis || !heightAxis || !outwardAxis) return;

  const transform = normalizeTransform(set.transform);
  const axisTolerance = Math.max(tolerance, 1e-6);
  if (
    dot(transform.basis.x, widthAxis) < 1 - axisTolerance
    || dot(transform.basis.y, heightAxis) < 1 - axisTolerance
    || dot(transform.basis.z, outwardAxis) > -1 + axisTolerance
  ) {
    errors.push(issue(
      "DESCRIPTOR_ORIENTATION_MISMATCH",
      `${set.id} local axes do not match the accepted installation orientation.`,
      { descriptorSetId: set.id }
    ));
  }

  // orientation.depthAxis points from the rear wall toward the room. Local
  // descriptor Z points from the cabinet front back to that wall, so these
  // directions must be opposites. Translation is local front-center-bottom.
  const localFront = { x: 0, y: 0, z: 0 };
  const localRear = { x: 0, y: 0, z: depth };
  const worldFront = transformGuidedPointToWorld(localFront, transform);
  const worldRear = transformGuidedPointToWorld(localRear, transform);
  const frontDistance = dot(subtract(worldFront, origin), outwardAxis);
  const rearDistance = dot(subtract(worldRear, origin), outwardAxis);

  if (Math.abs(frontDistance - depth) > tolerance) {
    errors.push(issue(
      "FRONT_PLANE_ANCHOR_MISMATCH",
      `${set.id} local front plane is not the accepted casework depth from the rear wall.`,
      { descriptorSetId: set.id }
    ));
  }
  if (Math.abs(rearDistance) > tolerance) {
    errors.push(issue(
      "BACK_NOT_ON_WALL",
      `${set.id} local rear plane does not land on the accepted installation wall.`,
      { descriptorSetId: set.id }
    ));
  }
}

function isRenderableComponent(component) {
  return Boolean(component?.bounds && (
    PHYSICAL_ROLES.has(component.role)
    || component.metadata?.physical === true
  ));
}

function normalizeTransform(transform) {
  const translation = transform?.translation || {};
  const basis = transform?.basis || {};
  return Object.freeze({
    translation: Object.freeze({
      x: finiteCoordinate(translation.x ?? translation[0], 0),
      y: finiteCoordinate(translation.y ?? translation[1], 0),
      z: finiteCoordinate(translation.z ?? translation[2], 0)
    }),
    basis: Object.freeze({
      x: normalizeAxis(basis.x || basis[0], [1, 0, 0]),
      y: normalizeAxis(basis.y || basis[1], [0, 1, 0]),
      z: normalizeAxis(basis.z || basis[2], [0, 0, 1])
    })
  });
}

function validTransform(transform) {
  const translation = pointFrom(transform?.translation);
  const x = axisFrom(transform?.basis?.x ?? transform?.basis?.[0], false);
  const y = axisFrom(transform?.basis?.y ?? transform?.basis?.[1], false);
  const z = axisFrom(transform?.basis?.z ?? transform?.basis?.[2], false);
  if (!translation || !x || !y || !z) return false;
  const epsilon = 1e-6;
  return Math.abs(length(x) - 1) <= epsilon
    && Math.abs(length(y) - 1) <= epsilon
    && Math.abs(length(z) - 1) <= epsilon
    && Math.abs(dot(x, y)) <= epsilon
    && Math.abs(dot(x, z)) <= epsilon
    && Math.abs(dot(y, z)) <= epsilon
    && dot(cross(x, y), z) >= 1 - epsilon;
}

function normalizeAxis(candidate, fallback) {
  const source = Array.isArray(candidate)
    ? { x: candidate[0], y: candidate[1], z: candidate[2] }
    : candidate || {};
  const vector = [
    finiteCoordinate(source.x, fallback[0]),
    finiteCoordinate(source.y, fallback[1]),
    finiteCoordinate(source.z, fallback[2])
  ];
  const length = Math.hypot(...vector) || 1;
  return Object.freeze({ x: vector[0] / length, y: vector[1] / length, z: vector[2] / length });
}

function sameRootScale(value) {
  const source = Array.isArray(value) ? value : [value?.x, value?.y, value?.z];
  return source.length === 3 && source.every((entry) => Math.abs(Number(entry) - 1) < 1e-9);
}

function validBounds(bounds) {
  return Boolean(bounds?.min && bounds?.max && ["x", "y", "z"].every((axis) => (
    Number.isFinite(Number(bounds.min[axis]))
    && Number.isFinite(Number(bounds.max[axis]))
    && Number(bounds.max[axis]) >= Number(bounds.min[axis])
  )));
}

function containsBounds(container, child, tolerance) {
  return ["x", "y", "z"].every((axis) => (
    Number(child.min[axis]) >= Number(container.min[axis]) - tolerance
    && Number(child.max[axis]) <= Number(container.max[axis]) + tolerance
  ));
}

function cloneBounds(bounds) {
  return Object.freeze({
    min: Object.freeze({ x: Number(bounds.min.x), y: Number(bounds.min.y), z: Number(bounds.min.z) }),
    max: Object.freeze({ x: Number(bounds.max.x), y: Number(bounds.max.y), z: Number(bounds.max.z) })
  });
}

function validPoint(point) {
  return Boolean(point && ["x", "y", "z"].every((axis) => Number.isFinite(Number(point[axis]))));
}

function pointFrom(value) {
  const point = Array.isArray(value)
    ? { x: value[0], y: value[1], z: value[2] }
    : value;
  if (!validPoint(point)) return null;
  return { x: Number(point.x), y: Number(point.y), z: Number(point.z) };
}

function axisFrom(value, normalize = true) {
  const point = pointFrom(value);
  if (!point) return null;
  const magnitude = length(point);
  if (magnitude <= 1e-12) return null;
  if (!normalize) return point;
  return {
    x: point.x / magnitude,
    y: point.y / magnitude,
    z: point.z / magnitude
  };
}

function subtract(first, second) {
  return {
    x: first.x - second.x,
    y: first.y - second.y,
    z: first.z - second.z
  };
}

function dot(first, second) {
  return first.x * second.x + first.y * second.y + first.z * second.z;
}

function cross(first, second) {
  return {
    x: first.y * second.z - first.z * second.y,
    y: first.z * second.x - first.x * second.z,
    z: first.x * second.y - first.y * second.x
  };
}

function length(vector) {
  return Math.hypot(vector.x, vector.y, vector.z);
}

function issue(code, message, details = {}) {
  return Object.freeze({ code, severity: details.severity || "error", message, ...details });
}

function finiteCoordinate(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function positiveOrZero(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}

function structuredCloneSafe(value) {
  return JSON.parse(JSON.stringify(value));
}
