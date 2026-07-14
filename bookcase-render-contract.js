export const SCENE_UNITS_PER_INCH = 1 / 12;
export const RENDER_CONTRACT_VERSION = 2;

export const PHYSICAL_RENDER_ROLES = Object.freeze([
  "base",
  "trim",
  "crown",
  "side_panel",
  "bottom_panel",
  "top_panel",
  "back_panel",
  "divider",
  "fixed_shelf",
  "shelf",
  "door",
  "drawer_front",
  "handle",
  "light"
]);

const PHYSICAL_ROLE_SET = new Set(PHYSICAL_RENDER_ROLES);

/**
 * Convert one descriptor AABB from layout inches into the Three.js scene
 * convention. X and Y preserve direction. Layout Z (front to back) is inverted
 * around the nominal bookcase depth center for the current camera convention.
 */
export function descriptorToSceneBounds(component, overallDepthIn, unitsPerInch = SCENE_UNITS_PER_INCH) {
  if (!component?.bounds || !Number.isFinite(Number(overallDepthIn))) {
    throw new TypeError("A component with bounds and a finite overall depth is required.");
  }
  const depthCenter = Number(overallDepthIn) * unitsPerInch / 2;
  return {
    min: {
      x: component.bounds.min.x * unitsPerInch,
      y: component.bounds.min.y * unitsPerInch,
      z: depthCenter - component.bounds.max.z * unitsPerInch
    },
    max: {
      x: component.bounds.max.x * unitsPerInch,
      y: component.bounds.max.y * unitsPerInch,
      z: depthCenter - component.bounds.min.z * unitsPerInch
    }
  };
}

export function sceneBoundsSize(bounds) {
  return {
    x: round(bounds.max.x - bounds.min.x),
    y: round(bounds.max.y - bounds.min.y),
    z: round(bounds.max.z - bounds.min.z)
  };
}

export function sceneBoundsCenter(bounds) {
  return {
    x: round((bounds.min.x + bounds.max.x) / 2),
    y: round((bounds.min.y + bounds.max.y) / 2),
    z: round((bounds.min.z + bounds.max.z) / 2)
  };
}

export function sceneBoundsContain(container, child, tolerance = 1e-5) {
  return ["x", "y", "z"].every(
    (axis) => child.min[axis] >= container.min[axis] - tolerance &&
      child.max[axis] <= container.max[axis] + tolerance
  );
}

export function createExpectedRenderManifest(layout) {
  if (!layout?.validation?.valid || !Array.isArray(layout.components)) {
    throw new Error("A valid generated layout is required for the render contract.");
  }

  return layout.components
    .filter((component) => PHYSICAL_ROLE_SET.has(component.role))
    .map((component) => {
      const bounds = descriptorToSceneBounds(component, layout.config.depth);
      return {
        componentId: component.id,
        role: component.role,
        parentId: component.parentId,
        hostId: component.hostId,
        bounds,
        size: sceneBoundsSize(bounds),
        center: sceneBoundsCenter(bounds)
      };
    });
}

/**
 * Validate browser-collected render records against the descriptor manifest.
 * A record is { componentId, meshCount, bounds }. Visual geometry may be
 * smaller than its descriptor envelope, but never larger or detached.
 */
export function validateRenderedManifest(layout, records, options = {}) {
  const tolerance = Number.isFinite(options.tolerance) ? options.tolerance : 1e-4;
  const expected = createExpectedRenderManifest(layout);
  const expectedById = new Map(expected.map((entry) => [entry.componentId, entry]));
  const issues = [];
  const seen = new Set();

  for (const record of Array.isArray(records) ? records : []) {
    if (!record || typeof record.componentId !== "string") {
      issues.push(issue("INVALID_RENDER_RECORD", null, "A render record requires a componentId."));
      continue;
    }
    if (seen.has(record.componentId)) {
      issues.push(issue("DUPLICATE_RENDER_COMPONENT", record.componentId, "A physical component was rendered more than once."));
      continue;
    }
    seen.add(record.componentId);

    const descriptor = expectedById.get(record.componentId);
    if (!descriptor) {
      issues.push(issue("UNEXPECTED_RENDER_COMPONENT", record.componentId, "The scene contains geometry without a physical descriptor."));
      continue;
    }
    if (!Number.isInteger(record.meshCount) || record.meshCount < 1) {
      issues.push(issue("EMPTY_RENDER_COMPONENT", record.componentId, "The physical descriptor did not produce a mesh."));
    }
    if (!validBounds(record.bounds)) {
      issues.push(issue("INVALID_RENDER_BOUNDS", record.componentId, "Rendered bounds must be finite and ordered."));
      continue;
    }
    if (!sceneBoundsContain(descriptor.bounds, record.bounds, tolerance)) {
      issues.push(issue("RENDER_OUTSIDE_DESCRIPTOR", record.componentId, "Rendered geometry exceeds its descriptor envelope."));
    }
  }

  for (const descriptor of expected) {
    if (!seen.has(descriptor.componentId)) {
      issues.push(issue("MISSING_RENDER_COMPONENT", descriptor.componentId, "A physical descriptor is missing from the scene."));
    }
  }

  return {
    valid: issues.length === 0,
    contractVersion: RENDER_CONTRACT_VERSION,
    expectedCount: expected.length,
    renderedCount: seen.size,
    issues
  };
}

function validBounds(bounds) {
  if (!bounds?.min || !bounds?.max) return false;
  return ["x", "y", "z"].every((axis) =>
    Number.isFinite(bounds.min[axis]) &&
    Number.isFinite(bounds.max[axis]) &&
    bounds.max[axis] >= bounds.min[axis]
  );
}

function issue(code, componentId, message) {
  return { code, severity: "error", componentId, message };
}

function round(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1e9) / 1e9;
}
