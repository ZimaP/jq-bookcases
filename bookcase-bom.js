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
  return createLayoutFingerprintFromComponents(layout, false);
}

/**
 * Reproduce the descriptor fingerprint emitted before drawer fronts carried
 * profile metadata. This is used only to verify and migrate existing saves.
 */
export function createLegacyLayoutFingerprint(layout) {
  return createLayoutFingerprintFromComponents(layout, true);
}

function createLayoutFingerprintFromComponents(layout, omitDrawerFrontStyle) {
  assertLayoutShape(layout);
  const source = stableStringify({
    fingerprintVersion: LAYOUT_FINGERPRINT_VERSION,
    schemaVersion: layout.schemaVersion,
    coordinateSystem: layout.coordinateSystem,
    components: layout.components.map((component) => ({
      id: component.id,
      role: component.role,
      parentId: component.parentId,
      hostId: component.hostId,
      bounds: component.bounds,
      metadata: omitDrawerFrontStyle && component.role === "drawer_front"
        ? omitProperty(component.metadata || {}, "style")
        : component.metadata || {}
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
  const drawerStyles = countBy(drawers, (component) => component.metadata?.style || "unknown");
  const hardwareTypes = countBy(handles, (component) => component.metadata?.hardware || "unknown");
  const hardwareSchedule = deriveHardwareSchedule(layout, handles);
  const lightTypes = countBy(lights, (component) => component.metadata?.lightType || "unknown");
  const crownStyles = countBy(crowns, (component) => component.metadata?.style || "unknown");
  const trimPurposes = countBy(trims, (component) => component.metadata?.purpose || "unknown");
  const specialOpenings = countBy(
    openings.filter((component) => !["lower_cabinet", "drawers", "tall_storage", "upper_glass"].includes(component.metadata?.kind)),
    (component) => component.metadata?.kind || "unknown"
  );
  const bySectionId = deriveSectionBOM(layout);
  const bySectionGroupId = deriveSectionGroupBOM(layout);

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
      totalFrontAreaSqIn: round(sum(drawers, largestFaceArea)),
      byStyle: drawerStyles
    },
    hardware: {
      handleCount: handles.length,
      byType: hardwareTypes,
      catalogVersion: layout.config?.hardwareSelections?.catalogVersion || hardwareSchedule[0]?.catalogVersion || null,
      schedule: hardwareSchedule,
      warnings: [...new Set(hardwareSchedule.flatMap((entry) => entry.warnings || []))]
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
    bySectionId,
    bySectionGroupId,
    byRole,
    physicalComponentIds: physical.map((component) => component.id)
  };
}

/**
 * Project the descriptor graph into stable section-owned quantities without
 * changing the long-standing aggregate BOM fields above. Section configuration
 * IDs are preferred because ordinal descriptor IDs can change after topology
 * edits; legacy layouts fall back to the descriptor ID.
 */
function deriveSectionBOM(layout) {
  const components = layout.components;
  const componentById = new Map(components.map((component) => [component.id, component]));
  const sections = components
    .filter((component) => component.role === "section")
    .sort((left, right) => Number(left.metadata?.index) - Number(right.metadata?.index));
  const sectionByIdentity = createSectionIdentityMap(sections);
  const ownedBySectionId = new Map(sections.map((section) => [section.id, []]));

  for (const component of components) {
    if (component.role === "section") continue;
    const section = resolveOwningSection(component, componentById, sectionByIdentity);
    if (section) ownedBySectionId.get(section.id)?.push(component);
  }

  return Object.fromEntries(sections.map((section) => {
    const sectionId = getStableSectionId(section);

    return [sectionId, {
      sectionId,
      descriptorId: section.id,
      index: Number(section.metadata?.index),
      type: section.metadata?.type || "open",
      clearWidthIn: round(section.size.x),
      ...summarizeOwnedBOMComponents(ownedBySectionId.get(section.id) || [])
    }];
  }));
}

/**
 * Feature and desk zones intentionally span several sections. Keep their
 * shared descriptors explicit instead of double-counting them against every
 * member section or silently dropping them from the section projection.
 */
function deriveSectionGroupBOM(layout) {
  const components = layout.components;
  const componentById = new Map(components.map((component) => [component.id, component]));
  const sections = components.filter((component) => component.role === "section");
  const sectionByIdentity = createSectionIdentityMap(sections);
  const groups = components.filter((component) => component.role === "section_group");
  const ownedByGroupId = new Map(groups.map((group) => [group.id, []]));

  for (const component of components) {
    if (component.role === "section_group") continue;
    const group = resolveOwningRole(component, componentById, "section_group");
    if (group) ownedByGroupId.get(group.id)?.push(component);
  }

  return Object.fromEntries(groups.map((group) => {
    const memberDescriptorIds = Array.isArray(group.metadata?.memberSectionIds)
      ? group.metadata.memberSectionIds.map(String)
      : [];
    const memberSectionIds = memberDescriptorIds.map((id) => {
      const section = sectionByIdentity.get(id);
      return section ? getStableSectionId(section) : id;
    });
    return [group.id, {
      sectionGroupId: group.id,
      kind: group.metadata?.kind || "unknown",
      memberSectionIds,
      memberDescriptorIds,
      widthIn: round(group.size.x),
      ...summarizeOwnedBOMComponents(ownedByGroupId.get(group.id) || [])
    }];
  }));
}

function summarizeOwnedBOMComponents(owned) {
  const physical = owned.filter((component) => PHYSICAL_ROLES.has(component.role));
  const adjustableShelves = owned.filter((component) => component.role === "shelf");
  const fixedShelves = owned.filter((component) => component.role === "fixed_shelf");
  const doors = owned.filter((component) => component.role === "door");
  const drawers = owned.filter((component) => component.role === "drawer_front");
  const handles = owned.filter((component) => component.role === "handle");
  const lights = owned.filter((component) => component.role === "light");
  const openings = owned.filter((component) => component.role === "opening");
  const lowerOpenings = openings.filter((component) => ["lower_cabinet", "drawers"].includes(component.metadata?.kind));
  const specialOpenings = openings.filter(
    (component) => !["lower_cabinet", "drawers", "tall_storage", "upper_glass"].includes(component.metadata?.kind)
  );

  return {
    physicalComponentCount: physical.length,
    shelves: {
      adjustableCount: adjustableShelves.length,
      fixedCount: fixedShelves.length,
      adjustableLinearIn: round(sum(adjustableShelves, (component) => component.size.x)),
      fixedLinearIn: round(sum(fixedShelves, (component) => component.size.x)),
      byThicknessIn: countBy(adjustableShelves, (component) => String(component.size.y))
    },
    doors: {
      count: doors.length,
      primaryCount: doors.filter((component) => component.metadata?.tier === "primary").length,
      secondaryCount: doors.filter((component) => component.metadata?.tier === "secondary").length,
      byStyle: countBy(doors, (component) => component.metadata?.style || "unknown")
    },
    drawers: {
      frontCount: drawers.length,
      totalFrontAreaSqIn: round(sum(drawers, largestFaceArea)),
      byStyle: countBy(drawers, (component) => component.metadata?.style || "unknown")
    },
    hardware: {
      handleCount: handles.length,
      byType: countBy(handles, (component) => component.metadata?.hardware || "unknown")
    },
    lighting: {
      count: lights.length,
      byType: countBy(lights, (component) => component.metadata?.lightType || "unknown")
    },
    openings: {
      lowerStorageCount: lowerOpenings.length,
      lowerStorageLinearIn: round(sum(lowerOpenings, (component) => component.size.x)),
      tallStorageCount: openings.filter((component) => component.metadata?.kind === "tall_storage").length,
      upperGlassCount: openings.filter((component) => component.metadata?.kind === "upper_glass").length,
      specialByKind: countBy(specialOpenings, (component) => component.metadata?.kind || "unknown")
    },
    byRole: countBy(physical, (component) => component.role),
    physicalComponentIds: physical.map((component) => component.id)
  };
}

function createSectionIdentityMap(sections) {
  const identities = new Map();
  for (const section of sections) {
    identities.set(section.id, section);
    identities.set(getStableSectionId(section), section);
  }
  return identities;
}

function getStableSectionId(section) {
  return String(
    section?.metadata?.configId
    || section?.metadata?.sectionConfigId
    || section?.metadata?.stableId
    || section?.id
  );
}

function resolveOwningSection(component, componentById, sectionByIdentity) {
  const pending = [component];
  const visited = new Set();
  while (pending.length) {
    const current = pending.shift();
    if (!current || visited.has(current.id)) continue;
    visited.add(current.id);
    if (current.role === "section") return current;
    const explicitId = current.metadata?.configId
      || current.metadata?.sectionConfigId
      || current.metadata?.sectionId
      || current.sectionId;
    if (explicitId && sectionByIdentity.has(String(explicitId))) {
      return sectionByIdentity.get(String(explicitId));
    }
    for (const relatedId of [current.parentId, current.hostId]) {
      const related = componentById.get(relatedId);
      if (related && !visited.has(related.id)) pending.push(related);
    }
  }
  return null;
}

function resolveOwningRole(component, componentById, role) {
  const pending = [component];
  const visited = new Set();
  while (pending.length) {
    const current = pending.shift();
    if (!current || visited.has(current.id)) continue;
    visited.add(current.id);
    if (current.role === role) return current;
    for (const relatedId of [current.parentId, current.hostId]) {
      const related = componentById.get(relatedId);
      if (related && !visited.has(related.id)) pending.push(related);
    }
  }
  return null;
}

export function deriveHardwareSchedule(layout, prefilteredHandles = null) {
  assertLayoutShape(layout);
  const handles = Array.isArray(prefilteredHandles)
    ? prefilteredHandles
    : layout.components.filter((component) => component.role === "handle");
  const groups = new Map();
  for (const handle of handles) {
    const metadata = handle.metadata || {};
    const facts = metadata.hardwareFacts || {};
    const placement = metadata.placement || {};
    const variantId = metadata.variantId || facts.variantId || metadata.hardware || "unknown";
    const key = stableStringify({
      variantId,
      placement,
      resolvedFrom: metadata.resolvedFrom || null,
      factualSnapshot: metadata.hardwareSnapshot || null
    });
    let group = groups.get(key);
    if (!group) {
      group = {
        variantId,
        legacyHardware: facts.legacyHardware || metadata.hardware || "unknown",
        brandId: facts.brandId || null,
        brand: facts.brandName || null,
        collectionId: facts.collectionId || null,
        collection: facts.collectionName || null,
        familyId: facts.familyId || null,
        family: facts.familyName || null,
        category: facts.category || null,
        manufacturerProductNumber: facts.manufacturerProductNumber ?? null,
        sku: facts.sku ?? null,
        sizeVariantId: facts.sizeVariantId || null,
        size: facts.sizeLabel || null,
        centerToCenterMm: finiteOrNull(facts.dimensionsMm?.centerToCenter),
        overallLengthMm: finiteOrNull(facts.dimensionsMm?.overallLength),
        projectionMm: finiteOrNull(facts.dimensionsMm?.projection),
        finishVariantId: facts.finishVariantId || null,
        finish: facts.finishName || null,
        finishCode: facts.finishCode || null,
        material: facts.material || null,
        quantity: 0,
        locations: [],
        placement: cloneValue(placement),
        compatibility: metadata.compatibilityLevel || null,
        modelAccuracy: facts.modelAccuracy || metadata.modelAccuracy || null,
        warnings: [],
        links: cloneValue(facts.links || []),
        catalogVersion: metadata.catalogVersion || layout.config?.hardwareSelections?.catalogVersion || null,
        verifiedAt: facts.verifiedAt || null,
        pricing: cloneValue(facts.pricing || metadata.pricing || null),
        factualSnapshot: cloneValue(metadata.hardwareSnapshot || null),
        resolvedFrom: metadata.resolvedFrom || null,
        _locationsByHost: new Map()
      };
      groups.set(key, group);
    }
    group.quantity += 1;
    group.warnings.push(...(metadata.warnings || []));
    const hostId = handle.hostId;
    const existing = group._locationsByHost.get(hostId) || {
      hostId,
      sectionId: metadata.sectionId || null,
      quantity: 0,
      handleIds: []
    };
    existing.quantity += 1;
    existing.handleIds.push(handle.id);
    group._locationsByHost.set(hostId, existing);
  }
  return [...groups.values()]
    .map((group) => {
      const { _locationsByHost, ...publicGroup } = group;
      const locations = [..._locationsByHost.values()].sort((left, right) => left.hostId.localeCompare(right.hostId));
      const handleIds = new Set(locations.flatMap((location) => location.handleIds));
      const validationWarnings = (layout.validation?.warnings || [])
        .filter((warning) => handleIds.has(warning.componentId) || handleIds.has(warning.relatedId))
        .filter((warning) => /HARDWARE/.test(String(warning.code || "")))
        .map((warning) => warning.message || warning.code);
      return {
        ...publicGroup,
        quantity: Number(publicGroup.quantity),
        warnings: [...new Set([...publicGroup.warnings, ...validationWarnings])],
        locations
      };
    })
    .sort((left, right) => `${left.variantId}|${stableStringify(left.placement)}`.localeCompare(`${right.variantId}|${stableStringify(right.placement)}`));
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

function finiteOrNull(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function cloneValue(value) {
  if (value === undefined) return null;
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function omitProperty(value, property) {
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== property));
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
