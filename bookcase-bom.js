const PHYSICAL_ROLES = new Set([
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

export const BOM_SCHEMA_VERSION = 1;
export const LAYOUT_FINGERPRINT_VERSION = 1;

/**
 * Create a deterministic fingerprint from the accepted descriptor graph.
 * The fingerprint is an integrity key, not a cryptographic signature.
 */
export function createLayoutFingerprint(layout) {
  assertLayoutShape(layout);
  const source = stableStringify({
    fingerprintVersion: LAYOUT_FINGERPRINT_VERSION,
    schemaVersion: layout.schemaVersion,
    coordinateSystem: layout.coordinateSystem,
    config: layout.config,
    components: layout.components.map((component) => ({
      id: component.id,
      role: component.role,
      parentId: component.parentId,
      hostId: component.hostId,
      bounds: component.bounds,
      metadata: component.metadata || {}
    }))
  });
  return `jq-layout-v${LAYOUT_FINGERPRINT_VERSION}-${fnv1a64(source)}`;
}

/**
 * Derive customer-visible and pricing quantities from a validated layout.
 * No requested quantity is trusted when generated descriptors are available.
 */
export function deriveBookcaseBOM(layout) {
  assertLayoutShape(layout);
  if (!layout.validation?.valid) {
    const firstError = layout.validation?.errors?.[0]?.message || "Layout validation failed.";
    throw new Error(`Cannot derive a BOM from an invalid layout: ${firstError}`);
  }

  const components = layout.components;
  const physical = components.filter((component) => PHYSICAL_ROLES.has(component.role));
  const sections = components.filter((component) => component.role === "section");
  const adjustableShelves = components.filter((component) => component.role === "shelf");
  const fixedShelves = components.filter((component) => component.role === "fixed_shelf");
  const doors = components.filter((component) => component.role === "door");
  const drawers = components.filter((component) => component.role === "drawer_front");
  const handles = components.filter((component) => component.role === "handle");
  const lights = components.filter((component) => component.role === "light");
  const crowns = components.filter((component) => component.role === "crown");
  const trims = components.filter((component) => component.role === "trim");
  const openings = components.filter((component) => component.role === "opening");
  const lowerOpenings = openings.filter((component) => ["lower_cabinet", "drawers"].includes(component.metadata?.kind));

  const byRole = Object.fromEntries(
    [...new Set(physical.map((component) => component.role))]
      .sort()
      .map((role) => {
        const matches = physical.filter((component) => component.role === role);
        return [role, {
          count: matches.length,
          totalVolumeCubicIn: round(sum(matches, componentVolume)),
          totalLargestFaceAreaSqIn: round(sum(matches, largestFaceArea)),
          totalLongestSpanIn: round(sum(matches, longestSpan))
        }];
      })
  );

  const shelfThicknesses = countBy(adjustableShelves, (component) => String(component.size.y));
  const doorStyles = countBy(doors, (component) => component.metadata?.style || "unknown");
  const hardwareTypes = countBy(handles, (component) => component.metadata?.hardware || "unknown");
  const lightTypes = countBy(lights, (component) => component.metadata?.lightType || "unknown");
  const crownStyles = countBy(crowns, (component) => component.metadata?.style || "unknown");
  const trimPurposes = countBy(trims, (component) => component.metadata?.purpose || "unknown");
  const specialOpenings = countBy(
    openings.filter((component) => !["lower_cabinet", "drawers", "tall_storage", "upper_glass"].includes(component.metadata?.kind)),
    (component) => component.metadata?.kind || "unknown"
  );

  return {
    schemaVersion: BOM_SCHEMA_VERSION,
    layoutSchemaVersion: layout.schemaVersion,
    layoutFingerprint: createLayoutFingerprint(layout),
    overall: {
      widthIn: layout.config.width,
      heightIn: layout.config.height,
      depthIn: layout.config.depth,
      envelopeAreaSqFt: round((layout.config.width / 12) * (layout.config.height / 12)),
      physicalComponentCount: physical.length
    },
    sections: {
      count: sections.length,
      clearWidthsIn: sections.map((component) => component.size.x),
      totalClearWidthIn: round(sum(sections, (component) => component.size.x))
    },
    shelves: {
      adjustableCount: adjustableShelves.length,
      fixedCount: fixedShelves.length,
      adjustableLinearIn: round(sum(adjustableShelves, (component) => component.size.x)),
      fixedLinearIn: round(sum(fixedShelves, (component) => component.size.x)),
      adjustableFaceAreaSqIn: round(sum(adjustableShelves, largestFaceArea)),
      byThicknessIn: shelfThicknesses
    },
    doors: {
      count: doors.length,
      primaryCount: doors.filter((component) => component.metadata?.tier === "primary").length,
      secondaryCount: doors.filter((component) => component.metadata?.tier === "secondary").length,
      byStyle: doorStyles
    },
    drawers: {
      frontCount: drawers.length,
      totalFrontAreaSqIn: round(sum(drawers, largestFaceArea))
    },
    hardware: {
      handleCount: handles.length,
      byType: hardwareTypes
    },
    lighting: {
      count: lights.length,
      byType: lightTypes
    },
    trim: {
      crownCount: crowns.length,
      baseTrimCount: trims.length,
      crownByStyle: crownStyles,
      trimByPurpose: trimPurposes
    },
    openings: {
      lowerStorageCount: lowerOpenings.length,
      lowerStorageLinearIn: round(sum(lowerOpenings, (component) => component.size.x)),
      tallStorageCount: openings.filter((component) => component.metadata?.kind === "tall_storage").length,
      upperGlassCount: openings.filter((component) => component.metadata?.kind === "upper_glass").length,
      specialByKind: specialOpenings
    },
    byRole,
    physicalComponentIds: physical.map((component) => component.id)
  };
}

function assertLayoutShape(layout) {
  if (!layout || typeof layout !== "object" || !Array.isArray(layout.components) || !layout.config) {
    throw new TypeError("A generated bookcase layout is required.");
  }
}

function countBy(items, selector) {
  const counts = new Map();
  for (const item of items) {
    const key = String(selector(item));
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function sum(items, selector) {
  return items.reduce((total, item) => total + selector(item), 0);
}

function componentVolume(component) {
  return component.size.x * component.size.y * component.size.z;
}

function largestFaceArea(component) {
  const dimensions = [component.size.x, component.size.y, component.size.z].sort((left, right) => right - left);
  return dimensions[0] * dimensions[1];
}

function longestSpan(component) {
  return Math.max(component.size.x, component.size.y, component.size.z);
}

function stableStringify(value) {
  return JSON.stringify(sortValue(value));
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map((item) => sortValue(item));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortValue(value[key])])
  );
}

function fnv1a64(value) {
  let hash = 14695981039346656037n;
  const prime = 1099511628211n;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * prime);
  }
  return hash.toString(16).padStart(16, "0");
}

function round(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1e6) / 1e6;
}
