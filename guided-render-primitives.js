import {
  transformGuidedBoundsToWorld
} from "./guided-render-contract.js?v=luxury-configurator-engine-v1";

export const GUIDED_RENDER_PRIMITIVE_CONTRACT_VERSION = 2;

const PUCK_CYLINDER_SCHEMA_VERSION = 1;
const PUCK_CYLINDER_SEGMENTS = 32;
const PUCK_HOUSING_INNER_RADIUS_RATIO = 0.8;
const PUCK_LENS_RADIUS_RATIO = 0.72;
const PUCK_LENS_RECESS_DEPTH_RATIO = 1 / 6;
const PUCK_LENS_DEPTH_RATIO = 0.5;

/**
 * Resolve one accepted physical descriptor into renderer-neutral submeshes.
 *
 * This is the shared interpretation boundary for the browser renderer and
 * external render workers. It deliberately contains no DOM, Three.js, Blender,
 * camera, lighting, or transport code. Rails, stiles, fields, slabs, boxes and
 * authored crown profiles therefore have one auditable physical meaning.
 */
export function createGuidedAcceptedComponentRenderPlan(descriptor) {
  if (!descriptor?.componentId || !isGuidedAcceptedRenderBounds(descriptor.bounds)) {
    throw new TypeError("A guided accepted component descriptor with finite bounds is required.");
  }
  const slot = normalizeGuidedMaterialSlot(descriptor.materialSlot, descriptor.role);
  const profile = descriptor.metadata?.profileGeometry;
  const hasAuthoredProfileKind = Boolean(
    profile
    && typeof profile === "object"
    && Object.hasOwn(profile, "kind")
  );
  if (
    ["door", "drawer_front"].includes(descriptor.role)
    && hasAuthoredProfileKind
    && !["slab", "framed_panel", "glass_frame"].includes(profile.kind)
  ) {
    throw new TypeError(`${descriptor.componentId} has an unknown authored front profile kind.`);
  }
  if (
    descriptor.role === "crown"
    && hasAuthoredProfileKind
    && profile.kind !== "crown_profile_extrusion"
  ) {
    throw new TypeError(`${descriptor.componentId} has an unknown authored crown profile kind.`);
  }
  const claimsFramedFront = ["framed_panel", "glass_frame"].includes(profile?.kind);
  const claimsCrownProfile = profile?.kind === "crown_profile_extrusion";
  const claimsPuckLight = descriptor.metadata?.lightType === "puck";
  if (claimsPuckLight && descriptor.role !== "light") {
    throw new TypeError(`${descriptor.componentId} claims puck geometry without the light role.`);
  }
  if (claimsPuckLight && !isGuidedAcceptedPuckAttachment(descriptor.metadata?.attachment)) {
    throw new TypeError(`${descriptor.componentId} has an unsupported puck attachment.`);
  }
  if (
    ["door", "drawer_front"].includes(descriptor.role)
    && claimsFramedFront
    && !isGuidedAcceptedFramedFrontProfile(profile)
  ) {
    throw new TypeError(`${descriptor.componentId} has a malformed authored front profile.`);
  }
  if (
    descriptor.role === "crown"
    && claimsCrownProfile
    && !isGuidedAcceptedCrownProfile(profile)
  ) {
    throw new TypeError(`${descriptor.componentId} has a malformed authored crown profile.`);
  }
  let geometryVariant = "box";
  let submeshes;

  if (
    ["door", "drawer_front"].includes(descriptor.role)
    && isGuidedAcceptedFramedFrontProfile(profile)
  ) {
    geometryVariant = profile.kind;
    submeshes = createAcceptedFrontSubmeshes(descriptor, slot, profile);
  } else if (claimsPuckLight) {
    geometryVariant = "recessed_puck_light";
    submeshes = createAcceptedPuckSubmeshes(descriptor);
  } else if (
    descriptor.role === "crown"
    && isGuidedAcceptedCrownProfile(profile)
  ) {
    geometryVariant = "crown_profile_extrusion";
    submeshes = [createAcceptedSubmesh(descriptor, {
      submeshId: "profile-extrusion",
      geometry: "crown_profile_extrusion",
      materialSlot: slot,
      bounds: descriptor.bounds,
      edgeVisible: true,
      grainRole: "crown",
      profileGeometry: profile
    })];
  } else {
    geometryVariant = profile?.kind === "slab" ? "slab" : "box";
    submeshes = [createAcceptedSubmesh(descriptor, {
      submeshId: geometryVariant === "slab" ? "slab" : "body",
      geometry: "box",
      materialSlot: slot,
      bounds: descriptor.bounds,
      edgeVisible: true,
      grainRole: descriptor.role
    })];
  }

  const materialSlots = Object.freeze([...new Set(submeshes.map((entry) => entry.materialSlot))]);
  return Object.freeze({
    contractVersion: GUIDED_RENDER_PRIMITIVE_CONTRACT_VERSION,
    componentId: descriptor.componentId,
    descriptorSetId: descriptor.descriptorSetId,
    role: descriptor.role,
    geometryVariant,
    materialSlots,
    worldBounds: freezeAcceptedBounds(unionAcceptedRenderBounds(submeshes.map((entry) => entry.worldBounds))),
    submeshes: Object.freeze(submeshes)
  });
}

function createAcceptedPuckSubmeshes(descriptor) {
  const bounds = descriptor.bounds;
  const width = Number(bounds.max.x) - Number(bounds.min.x);
  const height = Number(bounds.max.y) - Number(bounds.min.y);
  const depth = Number(bounds.max.z) - Number(bounds.min.z);
  if (width !== depth) {
    throw new TypeError(`${descriptor.componentId} requires equal puck X/Z bounds.`);
  }

  const centerX = midpointAcceptedNumber(bounds.min.x, bounds.max.x);
  const centerY = midpointAcceptedNumber(bounds.min.y, bounds.max.y);
  const centerZ = midpointAcceptedNumber(bounds.min.z, bounds.max.z);
  const housingRadius = width / 2;
  const housingInnerRadius = housingRadius * PUCK_HOUSING_INNER_RADIUS_RATIO;
  const lensRadius = housingRadius * PUCK_LENS_RADIUS_RATIO;
  const lensMinY = Number(bounds.min.y) + height * PUCK_LENS_RECESS_DEPTH_RATIO;
  const lensDepth = height * PUCK_LENS_DEPTH_RATIO;
  const lensMaxY = lensMinY + lensDepth;
  if (
    !positiveAcceptedNumber(housingRadius)
    || !positiveAcceptedNumber(housingInnerRadius)
    || housingInnerRadius >= housingRadius
    || !positiveAcceptedNumber(lensRadius)
    || lensRadius >= housingInnerRadius
    || !positiveAcceptedNumber(lensDepth)
    || lensMinY <= Number(bounds.min.y)
    || lensMaxY >= Number(bounds.max.y)
  ) {
    throw new TypeError(`${descriptor.componentId} cannot realize deterministic recessed puck proportions.`);
  }

  const lensBounds = {
    min: {
      x: centerX - lensRadius,
      y: lensMinY,
      z: centerZ - lensRadius
    },
    max: {
      x: centerX + lensRadius,
      y: lensMaxY,
      z: centerZ + lensRadius
    }
  };
  return [
    createAcceptedSubmesh(descriptor, {
      submeshId: "housing-rim",
      geometry: "cylinder",
      materialSlot: "hardware",
      bounds,
      edgeVisible: false,
      grainRole: "puck_housing",
      primitiveGeometry: createAcceptedCylinderGeometry({
        center: { x: centerX, y: centerY, z: centerZ },
        radius: housingRadius,
        innerRadius: housingInnerRadius,
        depth: height,
        capStyle: "annular",
        surfaceRole: "housing"
      })
    }),
    createAcceptedSubmesh(descriptor, {
      submeshId: "emissive-lens",
      geometry: "cylinder",
      materialSlot: "led",
      bounds: lensBounds,
      edgeVisible: false,
      grainRole: "puck_lens",
      primitiveGeometry: createAcceptedCylinderGeometry({
        center: {
          x: centerX,
          y: midpointAcceptedNumber(lensMinY, lensMaxY),
          z: centerZ
        },
        radius: lensRadius,
        innerRadius: 0,
        depth: lensDepth,
        capStyle: "closed",
        surfaceRole: "emissive_lens"
      })
    })
  ];
}

function createAcceptedCylinderGeometry({
  center,
  radius,
  innerRadius,
  depth,
  capStyle,
  surfaceRole
}) {
  return Object.freeze({
    schemaVersion: PUCK_CYLINDER_SCHEMA_VERSION,
    kind: "cylinder",
    axis: "y",
    center: Object.freeze({
      x: Number(center.x),
      y: Number(center.y),
      z: Number(center.z)
    }),
    radius: Number(radius),
    innerRadius: Number(innerRadius),
    depth: Number(depth),
    segments: PUCK_CYLINDER_SEGMENTS,
    capStyle,
    surfaceRole
  });
}

function isGuidedAcceptedPuckAttachment(attachment) {
  return attachment?.axis === "y"
    && attachment?.componentFace === "max"
    && attachment?.hostFace === "min";
}

function createAcceptedFrontSubmeshes(descriptor, frameSlot, profile) {
  const depth = createAcceptedFrontDepths(descriptor, profile);
  const regions = normalizeAcceptedFrontRegions(profile);
  if (!depth || !regions) {
    throw new TypeError(`${descriptor.componentId} cannot realize its authored front profile.`);
  }
  const frameBoundsFor = (region) => ({
    min: { x: region.min.x, y: region.min.y, z: depth.frame.min },
    max: { x: region.max.x, y: region.max.y, z: depth.frame.max }
  });
  const fieldBounds = {
    min: {
      x: regions.field.min.x,
      y: regions.field.min.y,
      z: depth.field.min
    },
    max: {
      x: regions.field.max.x,
      y: regions.field.max.y,
      z: depth.field.max
    }
  };
  const frameSubmeshes = regions.frame.map((region) => createAcceptedSubmesh(descriptor, {
    submeshId: region.id,
    geometry: "box",
    materialSlot: frameSlot,
    bounds: frameBoundsFor(region),
    edgeVisible: true,
    grainRole: region.id.endsWith("rail") ? "front_rail" : "front_stile"
  }));
  frameSubmeshes.push(createAcceptedSubmesh(descriptor, {
    submeshId: "center-field",
    geometry: "box",
    materialSlot: profile.kind === "glass_frame" || profile.fieldRegion?.kind === "glass"
      ? "glass"
      : frameSlot,
    bounds: fieldBounds,
    edgeVisible: false,
    grainRole: "front_field"
  }));
  return frameSubmeshes;
}

function createAcceptedFrontDepths(descriptor, profile) {
  const bounds = descriptor.bounds;
  const frontPlane = finiteGuidedAcceptedNumber(
    descriptor.metadata?.frontPlaneZ,
    bounds.min.z
  );
  const backPlane = finiteGuidedAcceptedNumber(
    descriptor.metadata?.backPlaneZ,
    bounds.max.z
  );
  const inwardDirection = backPlane >= frontPlane ? 1 : -1;
  const frameDepth = positiveAcceptedNumber(profile.frameDepth);
  const panelDepth = positiveAcceptedNumber(profile.panelDepth);
  const panelRecess = nonNegativeAcceptedNumber(profile.panelRecess);
  if (!frameDepth || !panelDepth || panelRecess === null) return null;

  const frameEnd = frontPlane + inwardDirection * frameDepth;
  const fieldStart = frontPlane + inwardDirection * panelRecess;
  const fieldEnd = fieldStart + inwardDirection * panelDepth;
  const normalizeDepth = (first, second) => ({
    min: clamp(Math.min(first, second), bounds.min.z, bounds.max.z),
    max: clamp(Math.max(first, second), bounds.min.z, bounds.max.z)
  });
  const frame = normalizeDepth(frontPlane, frameEnd);
  const field = normalizeDepth(fieldStart, fieldEnd);
  if (frame.max <= frame.min || field.max <= field.min) return null;
  return { frame, field };
}

function normalizeAcceptedFrontRegions(profile) {
  const frame = Array.isArray(profile.solidRegions)
    ? profile.solidRegions.map((region) => normalizeAccepted2dRegion(region)).filter(Boolean)
    : [];
  const field = normalizeAccepted2dRegion(profile.fieldRegion);
  if (frame.length !== 4 || !field) return null;
  return { frame, field };
}

function normalizeAccepted2dRegion(region) {
  const minX = Number(region?.bounds?.min?.x);
  const maxX = Number(region?.bounds?.max?.x);
  const minY = Number(region?.bounds?.min?.y);
  const maxY = Number(region?.bounds?.max?.y);
  if (
    ![minX, maxX, minY, maxY].every(Number.isFinite)
    || maxX <= minX
    || maxY <= minY
  ) return null;
  return Object.freeze({
    id: String(region.id || "frame-member"),
    min: Object.freeze({ x: minX, y: minY }),
    max: Object.freeze({ x: maxX, y: maxY })
  });
}

function createAcceptedSubmesh(descriptor, options) {
  const bounds = freezeAcceptedBounds(options.bounds);
  return Object.freeze({
    submeshId: String(options.submeshId),
    geometry: options.geometry,
    materialSlot: options.materialSlot,
    bounds,
    worldBounds: transformGuidedBoundsToWorld(bounds, descriptor.transform),
    edgeVisible: options.edgeVisible === true,
    grainRole: options.grainRole || descriptor.role,
    profileGeometry: options.profileGeometry || null,
    primitiveGeometry: options.primitiveGeometry || null
  });
}

export function isGuidedAcceptedFramedFrontProfile(profile) {
  return ["framed_panel", "glass_frame"].includes(profile?.kind)
    && Number(profile?.frameWidth) > 0
    && profile?.valid !== false;
}

export function isGuidedAcceptedCrownProfile(profile) {
  const outline = Array.isArray(profile?.outline) ? profile.outline : [];
  return profile?.kind === "crown_profile_extrusion"
    && profile?.crossSection?.heightAxis === "y"
    && ["x", "z"].includes(profile?.crossSection?.projectionAxis)
    && ["x", "z"].includes(profile?.extrusion?.axis)
    && profile.crossSection.projectionAxis !== profile.extrusion.axis
    && outline.length >= 3
    && outline.every((point) => (
      Number.isFinite(Number(point?.height))
      && Number.isFinite(Number(point?.projection))
      && Number(point.height) >= 0
      && Number(point.height) <= 1
      && Number(point.projection) >= 0
      && Number(point.projection) <= 1
    ));
}

function unionAcceptedRenderBounds(boundsList) {
  return boundsList.reduce((combined, bounds) => ({
    min: {
      x: Math.min(combined.min.x, bounds.min.x),
      y: Math.min(combined.min.y, bounds.min.y),
      z: Math.min(combined.min.z, bounds.min.z)
    },
    max: {
      x: Math.max(combined.max.x, bounds.max.x),
      y: Math.max(combined.max.y, bounds.max.y),
      z: Math.max(combined.max.z, bounds.max.z)
    }
  }), {
    min: { x: Infinity, y: Infinity, z: Infinity },
    max: { x: -Infinity, y: -Infinity, z: -Infinity }
  });
}

function freezeAcceptedBounds(bounds) {
  if (!isGuidedAcceptedRenderBounds(bounds)) {
    throw new TypeError("Accepted renderer submeshes require finite ordered bounds.");
  }
  return Object.freeze({
    min: Object.freeze({
      x: Number(bounds.min.x),
      y: Number(bounds.min.y),
      z: Number(bounds.min.z)
    }),
    max: Object.freeze({
      x: Number(bounds.max.x),
      y: Number(bounds.max.y),
      z: Number(bounds.max.z)
    })
  });
}

export function isGuidedAcceptedRenderBounds(bounds) {
  return Boolean(bounds?.min && bounds?.max && ["x", "y", "z"].every((axis) => (
    Number.isFinite(Number(bounds.min[axis]))
    && Number.isFinite(Number(bounds.max[axis]))
    && Number(bounds.max[axis]) > Number(bounds.min[axis])
  )));
}

export function finiteGuidedAcceptedNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function positiveAcceptedNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function nonNegativeAcceptedNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

function midpointAcceptedNumber(minimum, maximum) {
  return (Number(minimum) + Number(maximum)) / 2;
}

function normalizeGuidedMaterialSlot(slot, role) {
  if (slot === "cabinet_interior") return "accent";
  if (slot === "hardware") return "hardware";
  if (slot === "led") return "led";
  if (slot === "screen") return "screen";
  if (slot === "mounting" || slot === "structural-neutral") return "reveal";
  if (slot === "toe") return "toe";
  if (slot === "back") return "back";
  if (slot === "side") return "side";
  if (slot === "front") return "front";
  if (slot === "cabinet_finish") {
    if (["door", "drawer_front", "slat", "fascia"].includes(role)) return "front";
    if (["side_panel", "end_panel", "filler", "divider"].includes(role)) return "side";
  }
  return "case";
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
