/**
 * Derive billable component quantities from the generated descriptor graph.
 *
 * This module deliberately knows nothing about UI visibility or pricing rates.
 * A selection expresses intent; only a generated descriptor proves that a
 * physical door, drawer front, handle, or compatible light location exists.
 */
export function deriveBillableComponents(layout = {}) {
  const components = Array.isArray(layout?.components) ? layout.components : [];
  const componentById = new Map(components.map((component) => [component.id, component]));
  const summary = summarizeBillableComponents(components, componentById);
  const sections = components
    .filter((component) => component.role === "section")
    .sort((left, right) => Number(left.metadata?.index) - Number(right.metadata?.index));
  const sectionByIdentity = createSectionIdentityMap(sections);
  const sectionGroups = components.filter((component) => component.role === "section_group");
  const ownedBySectionId = new Map(sections.map((section) => [section.id, []]));
  const ownedBySectionGroupId = new Map(sectionGroups.map((group) => [group.id, []]));

  for (const component of components) {
    if (["section", "section_group"].includes(component.role)) continue;
    const section = resolveOwningSection(component, componentById, sectionByIdentity);
    if (section) ownedBySectionId.get(section.id)?.push(component);
    const group = resolveOwningRole(component, componentById, "section_group");
    if (group) ownedBySectionGroupId.get(group.id)?.push(component);
  }

  return {
    ...summary,
    bySectionId: Object.fromEntries(sections.map((section) => {
      const sectionId = getStableSectionId(section);
      return [sectionId, {
        sectionId,
        descriptorId: section.id,
        index: Number(section.metadata?.index),
        type: section.metadata?.type || "open",
        ...summarizeBillableComponents(ownedBySectionId.get(section.id) || [], componentById)
      }];
    })),
    bySectionGroupId: Object.fromEntries(sectionGroups.map((group) => {
      const memberDescriptorIds = Array.isArray(group.metadata?.memberSectionIds)
        ? group.metadata.memberSectionIds.map(String)
        : [];
      return [group.id, {
        sectionGroupId: group.id,
        kind: group.metadata?.kind || "unknown",
        memberSectionIds: memberDescriptorIds.map((id) => {
          const section = sectionByIdentity.get(id);
          return section ? getStableSectionId(section) : id;
        }),
        memberDescriptorIds,
        ...summarizeBillableComponents(ownedBySectionGroupId.get(group.id) || [], componentById)
      }];
    }))
  };
}

function summarizeBillableComponents(components, componentById) {
  const doors = components.filter((component) => component.role === "door");
  const drawerFronts = components.filter((component) => component.role === "drawer_front");
  const handles = components.filter((component) => component.role === "handle");
  const lights = components.filter((component) => component.role === "light");

  const doorOpeningKind = (door) => componentById.get(door.parentId)?.metadata?.kind || "unknown";
  const handleHostRole = (handle) => componentById.get(handle.parentId)?.role || "unknown";

  return {
    generatedDrawerFronts: drawerFronts.length,
    generatedCabinetDoors: doors.filter((door) => doorOpeningKind(door) === "lower_cabinet").length,
    generatedTallDoors: doors.filter((door) => doorOpeningKind(door) === "tall_storage").length,
    generatedGlassDoors: doors.filter((door) => door.metadata?.style === "glass").length,
    hingedDoorLeaves: doors.length,
    drawerHardwareUnits: handles.filter((handle) => handleHostRole(handle) === "drawer_front").length,
    doorHardwareUnits: handles.filter((handle) => handleHostRole(handle) === "door").length,
    hardwareUnits: handles.length,
    compatibleLightingComponents: lights.length,
    puckLightLocations: lights.filter((light) => light.metadata?.lightType === "puck").length,
    shelfLightLocations: lights.filter((light) => light.metadata?.lightType === "shelf_led").length,
    verticalLightChannels: lights.filter((light) => light.metadata?.lightType === "vertical_led").length,
    doorsByStyle: countBy(doors, (door) => door.metadata?.style || "unknown"),
    drawersByStyle: countBy(drawerFronts, (drawer) => drawer.metadata?.style || "unknown"),
    hardwareByType: countBy(handles, (handle) => handle.metadata?.hardware || "unknown"),
    lightsByType: countBy(lights, (light) => light.metadata?.lightType || "unknown")
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

function countBy(components, selector) {
  const counts = new Map();
  for (const component of components) {
    const key = String(selector(component));
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}
