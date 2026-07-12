/**
 * JQ Bookcases custom icon system.
 *
 * Registries contain SVG child markup only. Rendering stays deterministic and
 * DOM-free; the two mounting helpers are the only functions that touch a DOM
 * object supplied by the caller.
 */

export const iconRegistry = Object.freeze({
  "layouts": `<path d="M4 20.5h16M4.5 18.5v-14h15v14"/><path d="M4.5 14.2h15M9.5 4.5v9.7M14.5 4.5v9.7M12 14.2v4.3"/><path d="M6.5 7.2h3M14.5 7.2h3M6.5 10.5h3M14.5 10.5h3M8.2 16.2v.4M15.8 16.2v.4"/>`,
  "configurator-3d": `<path d="m12 2.8 8 4.7v9L12 21.2l-8-4.7v-9l8-4.7Z"/><path d="m4 7.5 8 4.7 8-4.7M12 12.2v9M12 2.8v9.4"/>`,
  "dimensions": `<path d="M3.2 11.1a5.6 5.6 0 1 1 10.9 1.8v3.4H8.8a5.6 5.6 0 0 1-5.6-5.2Z"/><circle cx="8.7" cy="10.8" r="2.35"/><path d="M14.1 12.7h6.7v4.1H10.5M16.2 12.7v1.8M18.6 12.7v1.2M13.1 7.5h2.2v3.2"/>`,
  "materials": `<path d="m12 3 8.5 3.8-8.5 3.8-8.5-3.8L12 3Z"/><path d="M4 10v2.2l8 3.6 8-3.6V10l-8 3.6L4 10ZM4 15.3v2.2l8 3.6 8-3.6v-2.2L12 19l-8-3.7Z"/>`,
  "paint-finish": `<ellipse cx="7.8" cy="6.1" rx="4.3" ry="1.6"/><path d="M3.5 6.1v10.2c0 .9 1.9 1.7 4.3 1.7s4.3-.8 4.3-1.7V6.1M3.5 11.2c1.3.8 2.7 1.1 4.3 1.1s3-.3 4.3-1.1"/><path d="M16.8 4.1c.8 0 1.4.6 1.4 1.4v5.4h-2.8V5.5c0-.8.6-1.4 1.4-1.4ZM14.5 10.9h4.6v3h-4.6zM15.4 13.9v6.2h2.8v-6.2"/>`,
  "hardware": `<ellipse cx="7.1" cy="11.7" rx="3.1" ry="4.9"/><ellipse cx="8.8" cy="11.7" rx="3.1" ry="4.9"/><path d="M11.9 11.7h1.5"/><ellipse cx="16.7" cy="11.7" rx="3.6" ry="5.5"/><ellipse cx="17.7" cy="11.7" rx="2.6" ry="4.4"/>`,
  "lighting": `<path d="M5 6.3h14v4.2H5zM9.6 6.3V4.8c0-1 .8-1.8 1.8-1.8h1.2c1 0 1.8.8 1.8 1.8v1.5"/><path d="m8.2 14.3-1.5 2.4M12 14.3v3.2M15.8 14.3l1.5 2.4M6.3 20.5h.1M12 20.5h.1M17.6 20.5h.1"/>`,
  "transparent-pricing": `<path d="M6 3.5h8l4 4v13H6zM14 3.5v4h4M8.7 18.2h6.6"/><path d="M13.8 10.3c-.5-.5-1.2-.8-2-.8-1.2 0-2 .6-2 1.5 0 2.4 4.4 1.2 4.4 3.7 0 1-.9 1.7-2.2 1.7-.9 0-1.8-.4-2.4-1M12 8.4v9"/>`,
  "quote-review": `<path d="M8.2 5.2V4.1c0-.9.7-1.6 1.6-1.6h4.4c.9 0 1.6.7 1.6 1.6v1.1M8.2 4.4H5.5v17h13v-17h-2.7"/><path d="m8 10.1 1.3 1.3 2.2-2.4M13.6 10.4h2.2M8 15.1l1.3 1.3 2.2-2.4M13.6 15.4h2.2"/>`,
  "field-measurement": `<path d="m4 10.7 7-6 7 6M5.8 9.4v10.1h10.4V9.4M9.2 19.5v-5.7h3.6v5.7"/><path d="M20.5 5.2v14.3M19 6.7l1.5-1.5L22 6.7M19 18l1.5 1.5L22 18M3.2 3.5h8.5M4.7 2 3.2 3.5 4.7 5"/>`,
  "shop-build": `<path d="M3.2 14.2h15.7l1.9 2.2-2.2 2.2H4.3l-1.1-4.4Z"/><circle cx="6.8" cy="11.4" r="1.7"/><path d="M9.3 14.2 11.6 8h2.5l1 2.2M12.2 13.9c.1-3.3 1.4-5.7 3.7-6.8l2 1.4-2.6 5.7M18.6 18.6c2 .1 3.1-.4 3.3-1.6"/>`,
  "installation": `<path d="m3.3 13.8 16.2-6.2 1.4 4.4-16.2 6.2-1.4-4.4Z"/><circle cx="8.8" cy="14.1" r="1.45"/><path d="m13.7 10.6 3.3-1.3.9 2.4-3.3 1.3-.9-2.4ZM5.1 14l.9 2.4M18.1 9l.9 2.4"/>`,
  "inspiration-gallery": `<path d="M4 5h16v14H4zM6.5 7.5h11v9h-11z"/><circle cx="14.9" cy="10" r="1.2"/><path d="m7 15 3.2-3.2 2.2 2.1 1.4-1.3 3.7 3.4"/>`,
  "made-in-usa": `<circle cx="12" cy="12" r="9"/><path d="M6.3 8.2c3.8-1.3 7.6 1.3 11.4 0v7.6c-3.8 1.3-7.6-1.3-11.4 0V8.2ZM6.3 10.8h11.4M6.3 13.3h11.4M11.2 8.2v5.1"/><path d="M8.1 9.6h.1M9.5 11.8h.1"/>`,
  "local-service": `<path d="M12 21s6.5-6.1 6.5-11.6a6.5 6.5 0 1 0-13 0C5.5 14.9 12 21 12 21Z"/><circle cx="12" cy="9.4" r="2.3"/>`,
  "support-faq": `<path d="M4 5.2h16v11.2H9.2L5.3 19v-2.6H4V5.2Z"/><path d="M9.5 9.1c.2-1.2 1.2-2 2.6-2 1.5 0 2.6.9 2.6 2.1 0 1.7-1.5 2-2.3 2.8-.4.4-.5.8-.5 1.3M11.9 15.1h.1"/>`,
  "cabinet-door": `<rect x="5" y="3.5" width="14" height="17" rx=".8"/><path d="M7.4 6h9.2v12H7.4zM15.1 12h.1"/>`,
  "adjustable-shelves": `<path d="M4.5 3.5v17M19.5 3.5v17M4.5 5h15M4.5 10h15M4.5 15h15M4.5 20h15"/><path d="M7 7.4h.1M17 7.4h.1M7 12.4h.1M17 12.4h.1M7 17.4h.1M17 17.4h.1"/>`,
  "craftsmanship": `<path d="M4 3.5v17h16v-4H8v-13H4Z"/><path d="m10.1 15.3 7.5-7.5 2.1 2.1-7.5 7.5-3 .9.9-3ZM16.3 9.1l2.1 2.1"/>`,
  "low-voc": `<path d="M19.4 4.6C12.8 5.3 7.9 8.8 6.8 15.4c4.9 1.2 9.4-1 11.9-6.3 1-2.1 1.2-3.6.7-4.5Z"/><path d="M5.2 19.6c2.6-5.8 6.6-9.2 12.8-11.7"/>`,
  "client-centered": `<circle cx="12" cy="8.1" r="2.5"/><path d="M7.5 19.7c.5-3.4 2-5.2 4.5-5.2s4 1.8 4.5 5.2M5.2 10.3a7.2 7.2 0 0 1 2.1-5.1M18.8 10.3a7.2 7.2 0 0 0-2.1-5.1M4.5 13.4v2.8h2.8M19.5 13.4v2.8h-2.8"/>`,
  "delivery": `<path d="M3.5 7.3h9.7v8.1H3.5zM13.2 10h3.5l3.3 3.1v2.3h-6.8z"/><circle cx="6.5" cy="17.3" r="1.8"/><circle cx="17.2" cy="17.3" r="1.8"/><path d="M3.5 15.4h1.2M8.3 15.4h7.1"/>`,
  "warranty": `<path d="M12 3.3 18.8 6v5.2c0 4.6-2.8 7.8-6.8 9.5-4-1.7-6.8-4.9-6.8-9.5V6L12 3.3Z"/><path d="m8.6 12 2.2 2.2 4.7-4.9"/>`,
  "project-photos": `<path d="M6.5 4.5h13v12h-13z"/><path d="M4.5 7.5H3v12h13v-1.5M8.5 14l2.8-2.8 2 1.9 1.3-1.2 2.9 2.8"/><circle cx="15.8" cy="8.1" r="1.1"/>`,
  "design-plan": `<path d="M5 3.5h12.5v16H5zM8 7.2h6.5M8 10.5h3.2M8 13.8h2.2"/><path d="m12 17 5.4-5.4 2 2-5.4 5.4-2.7.7.7-2.7ZM16.1 12.9l2 2"/>`,
  "ruler": `<path d="m4.2 16.8 12.6-12.6 3 3L7.2 19.8l-3-3Z"/><path d="m8 15 2 2M10.6 12.4l2 2M13.2 9.8l2 2M15.8 7.2l2 2"/>`,
  "finish-options": `<circle cx="8.2" cy="10" r="4.6"/><circle cx="15.8" cy="10" r="4.6"/><circle cx="12" cy="15.4" r="4.6"/>`,
  "price-tag": `<path d="m3.5 11.5 8-8h7.3v7.3l-8 8-7.3-7.3Z"/><circle cx="15.7" cy="6.7" r="1.1"/><path d="M12.5 11.1c-.4-.5-1-.7-1.6-.7-.9 0-1.5.5-1.5 1.1 0 1.8 3.3.9 3.3 2.7 0 .8-.7 1.3-1.7 1.3-.7 0-1.3-.3-1.8-.8M11 9.6v6.7"/>`,
  "schedule-install": `<rect x="4" y="5.2" width="16" height="15" rx="1.2"/><path d="M8 3.2v4M16 3.2v4M4 9.2h16M8.1 14.2l2.1 2.1 5-5.2"/>`,
  "medal": `<circle cx="12" cy="9" r="5.2"/><path d="m9.2 13.4-2 7.4 4.8-2.5 4.8 2.5-2-7.4"/><path d="m12 5.8.9 1.8 2 .3-1.4 1.4.3 2-1.8-.9-1.8.9.3-2-1.4-1.4 2-.3.9-1.8Z"/>`,
  "hard-hat": `<path d="M4 16.2h16M6.2 15.8v-2.3a5.8 5.8 0 0 1 11.6 0v2.3M12 7.7V4.2M9.6 5.2h4.8M3.2 19.2h17.6"/>`,
  "hammer": `<path d="m4.4 6.3 3-3 5 5-3 3-5-5ZM10.8 9.7l8.8 8.8-2.2 2.2-8.8-8.8"/><path d="m12.4 7.6 2.2-2.2 2.1 2.1-2.2 2.2"/>`,
  "home-install": `<path d="m3.5 11.2 8.5-7.3 8.5 7.3M5.8 9.8v10.3h12.4V9.8M10 20.1v-6h4v6"/>`,
  "headset": `<path d="M4 13v-1a8 8 0 0 1 16 0v1M4 13h3.8v5.8H4zM16.2 13H20v5.8h-3.8zM16.2 18.8c0 1.4-1.3 2.1-4.2 2.1"/>`,
  "flag": `<path d="M5.5 21V3.5M5.5 5c3.6-1.8 6.6 1.8 11 0v8c-4.4 1.8-7.4-1.8-11 0"/>`,
  "wrench": `<path d="m4.4 19.6 6.8-6.8M9 10.6l4.1-4.1a3.8 3.8 0 0 1 5.2-.3l-3.2 3.2 2.3 2.3 3.2-3.2a3.8 3.8 0 0 1-.3 5.2l-4.1 4.1"/><path d="m4.8 4.6 5.6 5.6M3.8 6.8l3-3"/>`,
  "monitor-pricing": `<rect x="3.5" y="4.5" width="17" height="11.5" rx="1.2"/><path d="M9 20h6M12 16v4M13.9 8.3c-.4-.4-1-.6-1.6-.6-.9 0-1.5.4-1.5 1.1 0 1.7 3.3.8 3.3 2.6 0 .7-.7 1.2-1.7 1.2-.7 0-1.3-.3-1.8-.7M12.4 6.8v6.5"/>`,
  "drill": `<path d="M3.8 7.5h9.5v5.3H3.8zM13.3 8.8h4.4l2.3 1.4-2.3 1.4h-4.4M6.8 12.8v6h4.2v-6M6 18.8h5.8M8.7 7.5V5.4h4.5"/>`,
  "tools": `<path d="m5 19 9.2-9.2M11.7 7.3l2-2a3.5 3.5 0 0 1 4.7-.3l-2.8 2.8 1.9 1.9 2.8-2.8a3.5 3.5 0 0 1-.3 4.7l-2 2"/><path d="m4.4 4.6 15 15M3.5 6.7l3.2-3.2M16.9 19.8l2.9-2.9"/>`,
  "instagram": `<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.1"/>`,
  "pinterest": `<circle cx="12" cy="12" r="9"/><path d="M9.2 19.2c1.2-3.6 1.8-6.1 2.3-9 .3-1.7 1.2-2.8 2.6-2.8 1.8 0 2.8 1.4 2.5 3.4-.4 2.7-2 4.7-4 4.7-2.1 0-3.5-1.6-3.5-3.8 0-3.5 2.7-6.1 6.6-6.1"/>`,
  "houzz": `<path d="M5 3.5v17l7-4v-6l7-4v17M12 10.5v-7l7 4"/>`,
  "heart": `<path d="M20.4 5.7a5.1 5.1 0 0 0-7.2 0L12 6.9l-1.2-1.2a5.1 5.1 0 0 0-7.2 7.2L12 21l8.4-8.1a5.1 5.1 0 0 0 0-7.2Z"/>`,
  "star": `<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>`,
  "check": `<path d="m4.2 12.3 4.8 4.8L19.8 6.8"/>`,
  "plus": `<path d="M12 4.5v15M4.5 12h15"/>`,
  "minus": `<path d="M4.5 12h15"/>`,
  "arrow-right": `<path d="M4 12h15M13.5 6.5 19 12l-5.5 5.5"/>`,
  "chevron-left": `<path d="m14.8 5.3-6.7 6.7 6.7 6.7"/>`,
  "chevron-right": `<path d="m9.2 5.3 6.7 6.7-6.7 6.7"/>`,
  "menu": `<path d="M4 6.5h16M4 12h16M4 17.5h16"/>`,
  "close": `<path d="m5.5 5.5 13 13M18.5 5.5l-13 13"/>`,
  "bookmark": `<path d="M6.5 3.8h11v16.4L12 16.8l-5.5 3.4V3.8Z"/><path d="M9.2 7.3h5.6"/>`,
  "search": `<circle cx="10.5" cy="10.5" r="5.8"/><path d="m14.9 14.9 4.7 4.7"/>`,
  "reset": `<path d="M4.5 9.1a7.8 7.8 0 1 1 2 8.1M4.5 9.1V4.6M4.5 9.1H9"/>`,
  "view-3d": `<path d="m12 3.2 7.6 4.4v8.8L12 20.8l-7.6-4.4V7.6L12 3.2Z"/><path d="m4.4 7.6 7.6 4.4 7.6-4.4M12 12v8.8"/>`,
  "view-front": `<rect x="5.2" y="3.8" width="13.6" height="16.4" rx=".8"/><path d="M8.2 7.2h7.6M8.2 11.2h7.6M8.2 15.2h7.6"/>`,
  "view-three-quarter": `<path d="M6.2 5.2h10.4l2.7 2.7v10.9H6.2V5.2Z"/><path d="M16.6 5.2v13.6M6.2 8.2h13.1M9.2 12h4.5M9.2 15.6h4.5"/>`,
  "view-side": `<path d="M6.5 4.7h9.7l1.5 1.5v13.1H8l-1.5-1.5V4.7Z"/><path d="M8 6.2h9.7M8 6.2v13.1M10.5 10h4.7M10.5 14.3h4.7"/>`,
  "lighting-none": `<path d="M5 6.5h14v3.6H5zM8.5 13.2l7 7M15.5 13.2l-7 7"/>`,
  "lighting-pucks": `<path d="M4.5 5.5h15M8.2 7.7h7.6M9.2 7.7c.4 2.3 1.4 3.5 2.8 3.5s2.4-1.2 2.8-3.5M8.7 14.2l-1.8 3M12 14.5v4M15.3 14.2l1.8 3"/>`,
  "lighting-shelf": `<path d="M4 6.5h16M6 9h12M7.5 12l-2.2 5M12 12v5.7M16.5 12l2.2 5"/>`,
  "lighting-vertical": `<path d="M6.5 4v16M17.5 4v16M9.5 6.5h5M9.5 12h5M9.5 17.5h5"/>`,
  "lighting-package": `<path d="M5 5.2h14M7 7.5v10M17 7.5v10M9.5 9.2h5M9.5 14.7h5M9.2 20h5.6"/><path d="m12 3-1-1M12 3l1-1"/>`
});

export const diagramRegistry = Object.freeze({
  "base-toe-kick": `<path d="M11 5h42v21H17v6h30v-6M11 26h6M47 26h6M17 29h30"/>`,
  "base-plinth": `<path d="M11 5h42v27H11zM11 26h42M14 29h36"/>`,
  "base-furniture": `<path d="M14 5h36v21H8v4h5v3M51 33v-3h5v-4H50M14 26h36M8 30h48"/>`,
  "crown-none": `<path d="M11 7h42v25H11zM11 7h42M14 10h36"/>`,
  "crown-slim": `<path d="M14 11h36v21H14zM9 7h46v4H9zM12 11h40"/>`,
  "crown-classic": `<path d="M14 15h36v17H14zM7 5h50v4H7zM9 9h46M9 9c1 4 3 6 5 6h36c2 0 4-2 5-6M17 12h30"/>`,
  "crown-soffit": `<path d="M14 15h36v17H14zM7 3h50v4H7zM9 7h46v4H9zM12 11h40v4H12z"/>`,
  "door-shaker": `<path d="M22 2h20v32H22zM26 7h12v22H26zM22 7h20M22 29h20"/>`,
  "door-flat": `<path d="M22 2h20v32H22zM25 5h14v26H25zM38 18h.1"/>`,
  "door-slim-shaker": `<path d="M22 2h20v32H22zM24.5 5h15v26h-15zM22 5h20M22 31h20"/>`,
  "door-glass": `<path d="M22 2h20v32H22zM26 6h12v24H26zM28 9l8 18M36 9l-8 18"/>`,
  "hardware-brass-knob": `<circle cx="32" cy="15" r="7"/><path d="M32 22v7M27 30h10"/>`,
  "hardware-black-knob": `<circle cx="32" cy="15" r="7"/><path d="M32 22v7M27 30h10"/>`,
  "hardware-brass-pull": `<path d="M14 18h36M18 18v8M46 18v8M15 15h34"/>`,
  "hardware-black-pull": `<path d="M14 18h36M18 18v8M46 18v8M15 15h34"/>`,
  "hardware-nickel-pull": `<path d="M14 18h36M18 18v8M46 18v8M15 15h34"/>`
});

// Uppercase aliases make the immutable registries easy to discover while the
// lower-camel exports remain concise at call sites.
export const ICON_REGISTRY = iconRegistry;
export const DIAGRAM_REGISTRY = diagramRegistry;

const own = (registry, name) => Object.prototype.hasOwnProperty.call(registry, name);
const safeClassToken = /^-?[_a-zA-Z]+[_a-zA-Z0-9-]*$/;
const safeLength = /^(?:0|[1-9]\d*)(?:\.\d+)?(?:px|em|rem|%|vw|vh)?$/;

function warn(message) {
  if (typeof console !== "undefined" && typeof console.warn === "function") {
    console.warn(`[JQ Bookcases icons] ${message}`);
  }
}

function registryMarkup(registry, name, type) {
  if (typeof name !== "string" || !own(registry, name)) {
    warn(`Unknown ${type} name: ${String(name)}`);
    return "";
  }
  return registry[name];
}

function classes(baseClass, requested) {
  const tokens = String(requested || "")
    .trim()
    .split(/\s+/)
    .filter((token) => token && safeClassToken.test(token));
  return [baseClass, ...new Set(tokens)].join(" ");
}

function length(value, fallback) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return String(value);
  }
  const candidate = String(value ?? "").trim();
  return safeLength.test(candidate) ? candidate : String(fallback);
}

/** Render a named 24x24 icon as safe inline SVG markup. */
export function iconSvg(name, options = {}) {
  const content = registryMarkup(iconRegistry, name, "icon");
  if (!content) return "";

  const settings = options && typeof options === "object" ? options : {};
  const size = settings.size;
  const width = length(settings.width ?? size, 24);
  const height = length(settings.height ?? size, 24);
  const className = classes("jq-icon", settings.className ?? settings.class);

  return `<svg xmlns="http://www.w3.org/2000/svg" class="${className}" data-icon-name="${name}" viewBox="0 0 24 24" width="${width}" height="${height}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${content}</svg>`;
}

/** Render a named 64x36 product option diagram as inline SVG markup. */
export function diagramSvg(name, options = {}) {
  const content = registryMarkup(diagramRegistry, name, "diagram");
  if (!content) return "";

  const settings = options && typeof options === "object" ? options : {};
  const width = length(settings.width, 64);
  const height = length(settings.height, 36);
  const className = classes("jq-diagram", settings.className ?? settings.class);

  return `<svg xmlns="http://www.w3.org/2000/svg" class="${className}" data-diagram-name="${name}" viewBox="0 0 64 36" width="${width}" height="${height}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${content}</svg>`;
}

/** Replace an element's contents with one named icon. */
export function setIcon(element, name) {
  if (
    !element ||
    (typeof element !== "object" && typeof element !== "function") ||
    !("innerHTML" in element)
  ) {
    warn("setIcon requires an element with an innerHTML property");
    return false;
  }

  const markup = iconSvg(name);
  element.innerHTML = markup;
  if (markup) {
    if (typeof element.setAttribute === "function") {
      element.setAttribute("data-icon", name);
    } else if (element.dataset && typeof element.dataset === "object") {
      element.dataset.icon = name;
    }
  }
  return markup !== "";
}

/** Mount every [data-icon] host beneath root. Returns the mounted count. */
export function mountIcons(
  root = typeof document === "undefined" ? undefined : document,
) {
  if (!root || typeof root.querySelectorAll !== "function") {
    warn("mountIcons requires a Document, Element, or queryable root");
    return 0;
  }

  const hosts = new Set();
  if (typeof root.matches === "function" && root.matches("[data-icon]")) {
    hosts.add(root);
  }
  for (const element of root.querySelectorAll("[data-icon]")) hosts.add(element);

  let mounted = 0;
  for (const element of hosts) {
    const name = typeof element.getAttribute === "function"
      ? element.getAttribute("data-icon")
      : element.dataset?.icon;
    if (setIcon(element, name)) mounted += 1;
  }
  return mounted;
}
