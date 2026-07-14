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

function countBy(components, selector) {
  const counts = new Map();
  for (const component of components) {
    const key = String(selector(component));
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}
