import {
  transformGuidedBoundsToWorld
} from "./guided-render-contract.js?v=luxury-configurator-engine-v1";

export const GUIDED_RENDER_PRIMITIVE_CONTRACT_VERSION = 1;

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
    profileGeometry: options.profileGeometry || null
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
