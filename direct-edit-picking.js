/**
 * Resolve sorted ray intersections to one semantic direct-edit descriptor.
 * Section volumes are deliberately treated as fallbacks so they make empty
 * section space selectable without masking a visible recessed component.
 */
export function resolveDirectEditIntersection(intersections, options = {}) {
  const root = options.root || null;
  const getComponent = typeof options.getComponent === "function"
    ? options.getComponent
    : () => null;
  const isEditable = typeof options.isEditable === "function"
    ? options.isEditable
    : () => false;
  const isFallback = typeof options.isFallback === "function"
    ? options.isFallback
    : (component) => component?.role === "section";

  let fallback = null;
  for (const intersection of Array.isArray(intersections) ? intersections : []) {
    let object = intersection?.object || null;
    while (object && object !== root) {
      const componentId = object.userData?.componentId;
      const component = componentId ? getComponent(componentId) : null;
      if (component && isEditable(component)) {
        if (!isFallback(component)) return component;
        fallback ||= component;
        break;
      }
      object = object.parent || null;
    }
  }
  return fallback;
}
