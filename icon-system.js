/**
 * JQ Bookcases production icon system.
 *
 * The reference artwork informs the family character only. Every geometry
 * below is original, editable SVG markup drawn on the same 24 × 24 grid.
 */

export const ICON_STROKE_WIDTH = 1.75;

const defineIcon = (category, label, meaning, geometry) => Object.freeze({
  category,
  label,
  meaning,
  geometry
});

export const iconManifest = Object.freeze({
  // Design and configuration ---------------------------------------------
  "layout": defineIcon("Design & configuration", "Layout", "Bookcase layout and configuration", `<path d="M5 3h14v17H5zM5 8.5h14M5 14h14M9.7 3v17M14.3 3v17M8 20v1M16 20v1"/>`),
  "dimensions": defineIcon("Design & configuration", "Dimensions", "Overall measured dimensions", `<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 9 8-4.5M12 12 4 7.5M12 12v9"/>`),
  "width": defineIcon("Design & configuration", "Width", "Horizontal measurement", `<path d="M3 7v10M21 7v10M5 12h14M8 9l-3 3 3 3M16 9l3 3-3 3"/>`),
  "space-frame": defineIcon("Design & configuration", "Space", "Measured room boundary", `<path d="M6 4h12v16H6zM3 7V3h4M17 3h4v4M21 17v4h-4M7 21H3v-4"/>`),
  "height": defineIcon("Design & configuration", "Height", "Vertical measurement", `<path d="M7 3h10M7 21h10M12 5v14M9 8l3-3 3 3M9 16l3 3 3-3"/>`),
  "depth": defineIcon("Design & configuration", "Depth", "Front-to-back measurement", `<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 9 8-4.5M12 12 4 7.5M12 12v9"/><path d="m13.8 10.9 3.7-2.1M15.3 8.6l2.2.2-.8 2"/>`),
  "sections": defineIcon("Design & configuration", "Sections", "Vertical bookcase bays", `<path d="M5 3h14v18H5zM5 9h14M5 15h14M9.7 3v18M14.3 3v18"/>`),
  "doors": defineIcon("Design & configuration", "Doors", "Pair of operational cabinet doors", `<path d="M4 3h16v18H4zM12 3v18M6.5 5.5h4v13h-4zM13.5 5.5h4v13h-4zM9.4 10.5v3M14.6 10.5v3"/>`),
  "shelves": defineIcon("Design & configuration", "Shelves", "Adjustable horizontal shelving", `<rect x="5" y="4" width="14" height="3" rx="1.5"/><rect x="5" y="10.5" width="14" height="3" rx="1.5"/><rect x="5" y="17" width="14" height="3" rx="1.5"/>`),
  "drawers": defineIcon("Design & configuration", "Drawers", "Stack of cabinet drawers", `<path d="M5 3h14v18H5zM5 9h14M5 15h14M10 6h4M10 12h4M10 18h4"/>`),
  "cabinets": defineIcon("Design & configuration", "Cabinets", "Built-in cabinet casework", `<path d="M4 3h16v18H4zM4 8h16M12 8v13M6.5 10.5h4v8h-4zM13.5 10.5h4v8h-4zM9.5 13v3M14.5 13v3"/>`),
  "back-panel": defineIcon("Design & configuration", "Back panel", "Rear cabinet panel", `<path d="M6 3h12v18H6zM9 6h6M9 18h6M9 9v6M15 9v6"/>`),
  "side-panel": defineIcon("Design & configuration", "Side panel", "Cabinet side panel", `<path d="m8 5 9-2v16l-9 2V5Zm3 1.2v12M14 5.5v12"/>`),
  "storage": defineIcon("Design & configuration", "Storage", "Mixed open and closed storage", `<path d="M4 3h16v18H4zM4 8.5h16M4 13.5h16M12 13.5V21M8 3v10.5M16 3v10.5M9.5 16.5v2M14.5 16.5v2"/>`),
  "base-cabinets": defineIcon("Design & configuration", "Base cabinets", "Lower cabinet storage", `<path d="M3 9h18v11H3zM3 15h18M9 9v11M15 9v11M6.5 11.5v2M12 11.5v2M17.5 11.5v2M5 20v1M19 20v1"/>`),

  // Styles and finishes --------------------------------------------------
  "door-style": defineIcon("Styles & finishes", "Door style", "Single framed cabinet door profile", `<path d="M6 2.5h12v19H6zM8.5 5h7v14h-7zM14 10.5v3"/>`),
  "crown-molding": defineIcon("Styles & finishes", "Crown molding", "Upper architectural molding profile", `<path d="M3 5h18v3H3zM5 8l2.5 4h9L19 8M7.5 12v7M16.5 12v7M5.5 19h13"/>`),
  "base-molding": defineIcon("Styles & finishes", "Base molding", "Lower plinth molding profile", `<path d="M6 4v11h12V4M4 15h16l-1.5 4h-13L4 15ZM3 20h18"/>`),
  "trim-molding": defineIcon("Styles & finishes", "Trim molding", "Separate transition trim profile", `<path d="M5 4v9h14V4M4 13h16v3H4M6 16v4M18 16v4M5 20h14"/>`),
  "hardware-knob": defineIcon("Styles & finishes", "Hardware knob", "Round cabinet knob with stem", `<circle cx="12" cy="7.5" r="4.25"/><path d="M12 11.75v4.75M9.5 16.5h5l1 3h-7l1-3ZM8.5 19.5h7"/>`),
  "handle-pull": defineIcon("Styles & finishes", "Handle pull", "Cabinet bar pull", `<path d="M4 9.5h16v3H4zM7 12.5v5M17 12.5v5M5.5 17.5h3M15.5 17.5h3"/>`),
  "hardware": defineIcon("Styles & finishes", "Hardware", "Cabinet knob and pull hardware", `<path d="M4 4h7v16H4zM13 4h7v16h-7zM8.5 10.5v3M15 9h3v6h-3"/>`),
  "glass-door": defineIcon("Styles & finishes", "Glass door", "Framed glass cabinet door", `<path d="M6 2.5h12v19H6zM8.5 5h7v14h-7zM10 8l4 6M11 15l3-4M14 10.5v3"/>`),
  "paint-finish": defineIcon("Styles & finishes", "Paint finish", "Applied painted finish", `<path d="m14 3 7 7-3 3-7-7 3-3ZM11 6l-7 7v5l2 2 5-2 7-7M4 15l5 5"/>`),
  "wood-finish": defineIcon("Styles & finishes", "Wood finish", "Natural wood grain finish", `<path d="m9 3 11 6-5 12-11-6L9 3Zm0 4 8 4M7 11l8 4M6 15l8 4"/>`),
  "material-layers": defineIcon("Styles & finishes", "Material layers", "Layered cabinet construction material", `<path d="m12 3 8 4-8 4-8-4 8-4ZM4 12l8 4 8-4M4 17l8 4 8-4"/>`),
  "panel-style": defineIcon("Styles & finishes", "Panel style", "Decorative panel configuration", `<path d="M5 3h14v18H5zM8 6h8v12H8zM10.7 6v12M13.3 6v12"/>`),
  "accent-detail": defineIcon("Styles & finishes", "Accent detail", "Architectural edge or corner detail", `<path d="M4 5h12a4 4 0 0 1 4 4v10h-4V9H4V5ZM7 9v10M11 9v10"/>`),

  // Lighting -------------------------------------------------------------
  "lighting": defineIcon("Lighting", "Lighting", "Integrated cabinet lighting", `<path d="M5 3.5h14v17H5zM8 6.5h8M8 11.5h8M8 16.5h8M8 6.5v11M16 6.5v11M10.5 8.5l-1 1.5M13.5 8.5l1 1.5"/>`),
  "light-bulb": defineIcon("Lighting", "Light bulb", "Lighting options", `<path d="M8.4 15.2a6 6 0 1 1 7.2 0c-1 .7-1.6 1.8-1.6 2.8h-4c0-1-.6-2.1-1.6-2.8ZM9.5 21h5M10 18h4"/>`),
  "lighting-off": defineIcon("Lighting", "Lighting off", "No integrated lighting", `<path d="M5 4h14v4H5zM8 11l-2 4M16 11l2 4M4 4l16 16"/>`),
  "led-strip": defineIcon("Lighting", "LED strip", "Linear LED light strip", `<path d="M4 5h16v4H4zM8 5v4M12 5v4M16 5v4M7 13l-1.5 3M12 13v4M17 13l1.5 3"/>`),
  "puck-light": defineIcon("Lighting", "Puck light", "Round recessed puck light", `<ellipse cx="12" cy="7" rx="6" ry="2.75"/><path d="M6 7v2.75c0 1.55 2.7 2.75 6 2.75s6-1.2 6-2.75V7M8.5 16l-2 3M12 15.5V20M15.5 16l2 3"/>`),
  "adjustable-light": defineIcon("Lighting", "Adjustable light", "Directional adjustable cabinet light", `<path d="m8 5 6-2 2 6-6 2-2-6ZM11 11l1 3M8 15l8-2M8 18l-3 2M13 17v4M17 15l3 2"/>`),
  "dimmable": defineIcon("Lighting", "Dimmable", "Adjustable light intensity", `<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16V4ZM12 8h3M12 12h5M12 16h3"/>`),
  "light-scenes": defineIcon("Lighting", "Light scenes", "Complete cabinet lighting package", `<path d="M4.5 3h15v18h-15zM7.5 6v12M16.5 6v12M7.5 11h9M9.5 6h5M10 14l-1.5 2.5M14 14l1.5 2.5"/>`),
  "under-shelf-light": defineIcon("Lighting", "Under-shelf light", "Light mounted below a shelf", `<path d="M3 5h18M6 7h12v3H6zM8 13l-2 4M12 13v5M16 13l2 4"/>`),
  "toe-kick-light": defineIcon("Lighting", "Toe-kick light", "Lighting at the recessed cabinet base", `<path d="M5 3v13h14V3M5 16h4v3h6v-3h4M8 21h8M10 18l-1 3M14 18l1 3"/>`),
  "interior-light": defineIcon("Lighting", "Interior light", "Vertical lighting inside a cabinet", `<path d="M5 3h14v18H5zM8 6v12M16 6v12M10.5 8h3M10.5 13h3M10.5 18h3"/>`),

  // Delivery and installation ------------------------------------------
  "pickup": defineIcon("Delivery & installation", "Pickup", "Customer transports a packaged order", `<path d="M7 6h10v11H7zM7 10h10M12 6v11M4 14h3M4 14l2-2M4 14l2 2M9 20h9"/>`),
  "shop-pickup": defineIcon("Delivery & installation", "Shop pickup", "Pickup at the JQ shop or workshop", `<path d="M4 9h16v12H4zM3 6h18l-1 3H4L3 6ZM7 9v12M17 9v12M9 14h6v5H9z"/>`),
  "project-coordination": defineIcon("Delivery & installation", "Project coordination", "Organized communication and handoff", `<circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="7" r="2.5"/><path d="M3.5 17c.4-3.2 1.6-5 3.5-5s3.1 1.8 3.5 5M13.5 17c.4-3.2 1.6-5 3.5-5s3.1 1.8 3.5 5M9.5 19h5M12 16.5V21"/>`),
  "standard-delivery": defineIcon("Delivery & installation", "Standard delivery", "Scheduled delivery truck", `<path d="M3 6h11v10H3zM14 9h3l4 4v3h-7zM6 16v-3M17 9v4h4"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>`),
  "priority-delivery": defineIcon("Delivery & installation", "Priority delivery", "Expedited delivery with priority cues", `<path d="M6 6h9v10H6zM15 9h3l3 4v3h-6zM18 9v4h3M9 16v-3"/><circle cx="9" cy="18" r="2"/><circle cx="18" cy="18" r="2"/><path d="M3 8h3M2 12h4"/>`),
  "white-glove-delivery": defineIcon("Delivery & installation", "White-glove delivery", "Protected package handled with care", `<path d="M8 4h8v8H8zM8 8h8M12 4v8M4 13v3l4 4h4M20 13v3l-4 4h-4M4 13l4-2 4 3M20 13l-4-2-4 3"/>`),
  "no-installation": defineIcon("Delivery & installation", "No installation", "Installation service excluded", `<circle cx="12" cy="12" r="9"/><path d="m8 17 7-7M13 6l5 5M6 18l3-1 1-3M5 5l14 14"/>`),
  "diy-installation": defineIcon("Delivery & installation", "DIY installation", "Homeowner tool installation", `<path d="m4 20 7-7M9 11l3-3a4 4 0 0 1 5-1l-3 3 2 2 3-3a4 4 0 0 1-1 5l-3 3M5 5l14 14M4 7l3-3"/>`),
  "professional-installation": defineIcon("Delivery & installation", "Professional installation", "Professional installer and completed work", `<path d="M5 18v-5a7 7 0 0 1 14 0v5M3 18h18M8 12V8M16 12V8M9 15l2 2 4-4"/>`),
  "measurement-visit": defineIcon("Delivery & installation", "Measurement visit", "Field measurement at the project site", `<path d="m5 16 11-11 4 4-11 11-4-4ZM8 13l3 3M11 10l3 3M14 7l3 3M4 7l5-4 4 4M4 7v5"/>`),
  "schedule": defineIcon("Delivery & installation", "Schedule", "Calendar scheduling", `<rect x="3.5" y="5" width="17" height="16" rx="1.5"/><path d="M8 3v4M16 3v4M3.5 9h17M7 13h3M14 13h3M7 17h3M14 17h3"/>`),
  "installation-complete": defineIcon("Delivery & installation", "Installation complete", "Completed installed built-in", `<path d="m3 11 9-7.5 9 7.5M5.5 9v11h13V9M9 20v-6h6v6M9 10l2 2 4-4"/>`),

  // Trust and support ----------------------------------------------------
  "warranty": defineIcon("Trust & support", "Warranty", "Documented product coverage", `<path d="M12 3 19 6v5c0 4.5-2.7 7.7-7 10-4.3-2.3-7-5.5-7-10V6l7-3ZM8.5 12l2.2 2.2 4.8-5"/>`),
  "quality": defineIcon("Trust & support", "Quality", "Inspected quality standard", `<circle cx="12" cy="10" r="6"/><path d="m12 6 1.2 2.5 2.8.4-2 2 .5 2.8-2.5-1.3-2.5 1.3.5-2.8-2-2 2.8-.4L12 6ZM8.5 15.5 7 21l5-2.5 5 2.5-1.5-5.5"/>`),
  "made-in-usa": defineIcon("Trust & support", "Made in USA", "Made in the United States", `<path d="M5 21V4M5 5c4-2 7 2 14 0v9c-7 2-10-2-14 0M8 7h3M8 10h3M14 7h3M14 10h3M8 12.5h9"/>`),
  "craftsmanship": defineIcon("Trust & support", "Craftsmanship", "Precision cabinetmaking craft", `<path d="M3 15h16l2 3H5l-2-3ZM8 15l3-7h4l2 7M10 11h6M6 18v2M18 18v2"/>`),
  "sustainability": defineIcon("Trust & support", "Sustainability", "Lower-impact materials and finishes", `<path d="M20 4C13 4.8 8 8.5 7 15.5c5.2 1 9.7-1.2 12.3-6.8C20.2 6.8 20.4 5.3 20 4ZM4 20c3-6 7.5-10 14-13"/>`),
  "local-service": defineIcon("Trust & support", "Local service", "Local JQ service area", `<path d="M12 21s6.5-6 6.5-11.5a6.5 6.5 0 1 0-13 0C5.5 15 12 21 12 21ZM9 10l3-2.5 3 2.5v3.5H9V10Z"/>`),
  "support": defineIcon("Trust & support", "Support", "Customer support", `<path d="M4 13v-1a8 8 0 0 1 16 0v1M4 13h4v6H4zM16 13h4v6h-4zM16 19c0 1.3-1.3 2-4 2M10 21h2"/>`),
  "help-center": defineIcon("Trust & support", "Help center", "Questions and help resources", `<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2.5-3 5M12 18v.5"/>`),
  "quote": defineIcon("Trust & support", "Quote", "Project estimate document", `<path d="M5 3h9l5 5v13H5zM14 3v5h5M8 17h8M14 11.5c-.5-.6-1.2-.9-2-.9-1.2 0-2 .6-2 1.4 0 2.2 4 1.1 4 3.2 0 1-.8 1.6-2 1.6-.9 0-1.7-.3-2.2-.9M12 9v9"/>`),
  "pricing": defineIcon("Trust & support", "Pricing", "Price and cost calculation", `<path d="m3.5 11.5 8-8h7v7l-8 8-7-7Z"/><circle cx="15.5" cy="6.5" r="1"/><path d="M14 12c-.5-.5-1.1-.8-1.8-.8-1.1 0-1.8.6-1.8 1.4 0 2 3.8 1 3.8 3.1 0 .9-.8 1.5-2 1.5-.8 0-1.5-.3-2-.8M12.2 10v8.5"/>`),
  "secure": defineIcon("Trust & support", "Secure", "Secure information and transaction", `<rect x="5" y="10" width="14" height="11" rx="1.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>`),
  "reviews": defineIcon("Trust & support", "Reviews", "Customer ratings and reviews", `<path d="m12 3 2.7 5.4 6 .9-4.3 4.2 1 6-5.4-2.8-5.4 2.8 1-6-4.3-4.2 6-.9L12 3Z"/>`),
  "guarantee": defineIcon("Trust & support", "Guarantee", "JQ service promise", `<path d="M12 3l2.8 2 3.5.5.5 3.5 2.2 3-2.2 3-.5 3.5-3.5.5-2.8 2-2.8-2-3.5-.5-.5-3.5-2.2-3 2.2-3 .5-3.5 3.5-.5L12 3ZM8.5 12l2.2 2.2 4.8-5"/>`),

  // Spaces and inspiration ---------------------------------------------
  "living-room": defineIcon("Spaces & inspiration", "Living room", "Living room built-in", `<path d="M5 13h14v6H5zM7 9h10v4H7zM4 11v8M20 11v8M7 19v2M17 19v2M4 6h4M6 3v8"/>`),
  "library": defineIcon("Spaces & inspiration", "Library", "Home library shelving", `<path d="M4 3h16v18H4zM4 9h16M4 15h16M8 3v6M11 3v6M16 9v6M9 15v6M13 15v6"/>`),
  "home-office": defineIcon("Spaces & inspiration", "Home office", "Home office workspace", `<path d="M4 4h16v11H4zM8 20h8M12 15v5M7 7h7v5H7zM16 7v5"/>`),
  "media-wall": defineIcon("Spaces & inspiration", "Media wall", "Built-in media wall", `<path d="M3 4h18v16H3zM3 15h18M7 4v11M17 4v11M9 7h6v5H9zM5 17.5h2M11 17.5h2M17 17.5h2"/>`),
  "bedroom": defineIcon("Spaces & inspiration", "Bedroom", "Bedroom built-in", `<path d="M4 13h16v6H4zM6 9h12v4H6zM4 11v8M20 11v8M7 19v2M17 19v2M8 9V6h4v3M12 9V6h4v3"/>`),
  "dining-room": defineIcon("Spaces & inspiration", "Dining room", "Dining room cabinetry", `<path d="M5 10h14v4H5zM7 14v7M17 14v7M9 10V7M15 10V7M8 5h8M9 3h6M3 12v7M21 12v7"/>`),
  "entryway": defineIcon("Spaces & inspiration", "Entryway", "Entryway built-in", `<path d="M5 3h14v18H5zM8 6h8v15H8zM14 11v3M3 21h18"/>`),
  "kitchen": defineIcon("Spaces & inspiration", "Kitchen", "Kitchen cabinetry", `<path d="M3 4h18v16H3zM3 12h18M9 4v8M15 4v8M7 12v8M17 12v8M6 7v2M12 7v2M18 7v2M5 15v2M12 15v2M19 15v2"/>`),
  "closet": defineIcon("Spaces & inspiration", "Closet", "Closet storage", `<path d="M4 3h16v18H4zM12 3v18M8 7h8M8 7l4 4 4-4M8.5 15h7M8.5 18h7"/>`),
  "bathroom": defineIcon("Spaces & inspiration", "Bathroom", "Bathroom vanity", `<path d="M3 11h18v3H3M5 14h14v2a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5v-2M8 8h8M10 8V5h4v3M12 5V3"/>`),
  "fireplace-wall": defineIcon("Spaces & inspiration", "Fireplace wall", "Bookcases around a fireplace", `<path d="M3 3h18v18H3zM3 9h5M16 9h5M3 15h5M16 15h5M8 9h8v12H8zM12 18c-1.7-1.4-2.2-3-.7-4.7.2 1.1.8 1.5 1.5 2.1.7.6.8 1.5-.8 2.6Z"/>`),
  "inspiration": defineIcon("Spaces & inspiration", "Inspiration", "Project inspiration and imagery", `<path d="M8 15a7 7 0 1 1 8 0c-1 .7-1.5 1.7-1.5 3h-5c0-1.3-.5-2.3-1.5-3ZM9.5 21h5M10 18h4M12 2v2M4 5l2 2M20 5l-2 2M3 12h2M19 12h2"/>`),

  // Interface and configurator ------------------------------------------
  "search": defineIcon("Interface", "Search", "Search control", `<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 4.5 4.5"/>`),
  "menu": defineIcon("Interface", "Menu", "Open navigation menu", `<path d="M5 7h14M5 12h14M5 17h14"/>`),
  "close": defineIcon("Interface", "Close", "Close the current panel or dialog", `<path d="m6 6 12 12M18 6 6 18"/>`),
  "chevron-down": defineIcon("Interface", "Chevron down", "Expand or move downward", `<path d="m7 9.5 5 5 5-5"/>`),
  "chevron-left": defineIcon("Interface", "Chevron left", "Move to the previous item", `<path d="m14.5 7-5 5 5 5"/>`),
  "chevron-right": defineIcon("Interface", "Chevron right", "Move to the next item", `<path d="m9.5 7 5 5-5 5"/>`),
  "arrow-right": defineIcon("Interface", "Arrow right", "Continue to the next destination", `<path d="M4 12h16M15 7l5 5-5 5"/>`),
  "check": defineIcon("Interface", "Check", "Selected or complete state", `<path d="m5 12.5 4.5 4.5L19 7"/>`),
  "plus": defineIcon("Interface", "Plus", "Add, increase, or expand", `<path d="M12 6v12M6 12h12"/>`),
  "minus": defineIcon("Interface", "Minus", "Remove, decrease, or collapse", `<path d="M6 12h12"/>`),
  "information": defineIcon("Interface", "Information", "Additional information", `<circle cx="12" cy="12" r="9"/><path d="M12 10v7M12 7h.1"/>`),
  "save": defineIcon("Interface", "Save", "Save the current design", `<path d="M5 3h12l2 2v16H5zM8 3v6h8V3M8 21v-7h8v7M10 6h4"/>`),
  "favorite": defineIcon("Interface", "Favorite", "Mark a design as a favorite", `<path d="M20.5 5.5a5 5 0 0 0-7.1 0L12 7l-1.4-1.5a5 5 0 0 0-7.1 7.1L12 21l8.5-8.4a5 5 0 0 0 0-7.1Z"/>`),
  "reset": defineIcon("Interface", "Reset", "Return the view or design to its default", `<path d="M4.5 9A8 8 0 1 1 6 17.5M4.5 9V4.5M4.5 9H9"/>`),
  "undo": defineIcon("Interface", "Undo", "Undo the previous action", `<path d="M9 7 4 12l5 5M4 12h9a6 6 0 0 1 6 6"/>`),
  "redo": defineIcon("Interface", "Redo", "Redo the next action", `<path d="m15 7 5 5-5 5M20 12h-9a6 6 0 0 0-6 6"/>`),
  "copy": defineIcon("Interface", "Copy", "Duplicate the current item", `<rect x="8" y="8" width="11" height="11" rx="1.5"/><path d="M16 8V5H5v11h3"/>`),
  "trash": defineIcon("Interface", "Delete", "Delete the current item", `<path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13M10 10v7M14 10v7"/>`),
  "pan": defineIcon("Interface", "Pan", "Move the model within the viewer", `<path d="M8.5 11V5.5a1.5 1.5 0 0 1 3 0V10M11.5 9V4.5a1.5 1.5 0 0 1 3 0V10M14.5 9V6a1.5 1.5 0 0 1 3 0v6M8.5 10V8a1.5 1.5 0 0 0-3 0v6.5c0 4 2.7 6.5 6.5 6.5h1.5c4 0 6-2.8 6-6.5V10a1.5 1.5 0 0 0-3 0v2"/>`),
  "select": defineIcon("Interface", "Select", "Select a model component", `<path d="m6 3 12 8-6 1.5L9.5 19 6 3ZM12 13l4.5 6"/>`),
  "fullscreen": defineIcon("Interface", "Fullscreen", "Expand the model workspace", `<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>`),
  "preview-eye": defineIcon("Interface", "Preview", "Review the current design", `<path d="M3 12s3.2-5.5 9-5.5 9 5.5 9 5.5-3.2 5.5-9 5.5S3 12 3 12Z"/><circle cx="12" cy="12" r="2.5"/>`),
  "more-horizontal": defineIcon("Interface", "More actions", "Open additional actions", `<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>`),
  "zoom-in": defineIcon("Interface", "Zoom in", "Increase preview magnification", `<circle cx="10.5" cy="10.5" r="6"/><path d="M10.5 7.5v6M7.5 10.5h6M15 15l5 5"/>`),
  "zoom-out": defineIcon("Interface", "Zoom out", "Decrease preview magnification", `<circle cx="10.5" cy="10.5" r="6"/><path d="M7.5 10.5h6M15 15l5 5"/>`),
  "camera-front": defineIcon("Interface", "Front camera", "Straight-on product view", `<path d="M5 4h14v16H5zM8 7h8v10H8zM10 11h4M10 14h4"/>`),
  "camera-side": defineIcon("Interface", "Side camera", "Side product view", `<path d="m8 5 9-2v16l-9 2V5ZM11 7v12M14 6v12"/>`),
  "camera-three-quarter": defineIcon("Interface", "Three-quarter camera", "Three-quarter product view", `<path d="M5 5h11l3 3v11H5V5ZM16 5v14M5 8h14M8 12h5M8 16h5"/>`),
  "camera-orbit": defineIcon("Interface", "Orbit camera", "Interactive three-dimensional product view", `<path d="m12 4 6 3.5v7L12 18l-6-3.5v-7L12 4Zm-6 3.5 6 3.5 6-3.5M12 11v7M4 18a10 10 0 0 0 15.5 1M20 19v-4M20 19h-4"/>`),
  "augmented-reality": defineIcon("Interface", "Augmented reality", "View the configured bookcase in the room", `<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm-8 4.5 8 4.5 8-4.5M12 12v9M8 10v4l4 2.3 4-2.3v-4"/>`),
  "share": defineIcon("Interface", "Share", "Share the current design", `<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5"/>`),

  // Platform marks used by the production footer -----------------------
  "instagram": defineIcon("Platform", "Instagram", "Instagram profile", `<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="12" cy="12" r="4"/><circle cx="17" cy="7" r="1"/>`),
  "pinterest": defineIcon("Platform", "Pinterest", "Pinterest profile", `<circle cx="12" cy="12" r="9"/><path d="M9 19c1.2-3.5 1.8-6 2.3-8.8.3-1.8 1.2-2.8 2.7-2.8 1.8 0 2.8 1.4 2.5 3.4-.4 2.7-2 4.7-4 4.7-2.1 0-3.5-1.6-3.5-3.8 0-3.5 2.7-6.1 6.6-6.1"/>`),
  "houzz": defineIcon("Platform", "Houzz", "Houzz profile", `<path d="M5 3.5v17l7-4v-6l7-4v14M12 10.5v-7l7 4"/>`)
});

export const iconRegistry = Object.freeze(Object.fromEntries(
  Object.entries(iconManifest).map(([name, definition]) => [name, definition.geometry])
));

const defineDiagram = (category, label, meaning, geometry) => Object.freeze({
  category,
  label,
  meaning,
  geometry
});

export const diagramManifest = Object.freeze({
  "base-toe-kick": defineDiagram("Base profiles", "Recessed toe kick", "Recessed toe-kick base profile", `<path d="M11 5h42v21H17v6h30v-6M11 26h6M47 26h6M17 29h30"/>`),
  "base-plinth": defineDiagram("Base profiles", "Flush plinth", "Flush plinth base profile", `<path d="M11 5h42v27H11zM11 26h42M14 29h36"/>`),
  "base-furniture": defineDiagram("Base profiles", "Furniture base", "Projected furniture base profile", `<path d="M14 5h36v21H8v4h5v3M51 33v-3h5v-4H50M14 26h36M8 30h48"/>`),
  "crown-flat-top": defineDiagram("Crown profiles", "Flat top", "Unmolded flat top profile", `<path d="M11 7h42v25H11zM11 7h42M14 10h36"/>`),
  "crown-step": defineDiagram("Crown profiles", "Modern step crown", "Slim stepped crown profile", `<path d="M14 11h36v21H14zM9 7h46v4H9zM12 11h40"/>`),
  "crown-classic": defineDiagram("Crown profiles", "Classic crown", "Traditional projected crown profile", `<path d="M14 15h36v17H14zM7 5h50v4H7zM9 9h46M9 9c1 4 3 6 5 6h36c2 0 4-2 5-6M17 12h30"/>`),
  "crown-built-up": defineDiagram("Crown profiles", "Built-up crown", "Tall built-up crown profile", `<path d="M14 15h36v17H14zM7 3h50v4H7zM9 7h46v4H9zM12 11h40v4H12z"/>`),
  "door-shaker": defineDiagram("Door profiles", "Shaker", "Shaker cabinet door profile", `<path d="M22 2h20v32H22zM26 7h12v22H26zM22 7h20M22 29h20"/>`),
  "door-flat": defineDiagram("Door profiles", "Flat panel", "Flat cabinet door profile", `<path d="M22 2h20v32H22zM25 5h14v26H25zM38 18h.1"/>`),
  "door-slim-shaker": defineDiagram("Door profiles", "Slim Shaker", "Slim-rail Shaker door profile", `<path d="M22 2h20v32H22zM24.5 5h15v26h-15zM22 5h20M22 31h20"/>`),
  "door-glass": defineDiagram("Door profiles", "Glass frame", "Framed glass cabinet door profile", `<path d="M22 2h20v32H22zM26 6h12v24H26zM28 9l8 18M36 9l-8 18"/>`),
  "hardware-knob": defineDiagram("Hardware profiles", "Knob", "Round cabinet knob profile", `<circle cx="32" cy="15" r="7"/><path d="M32 22v7M27 30h10"/>`),
  "handle-pull": defineDiagram("Hardware profiles", "Pull", "Cabinet bar pull profile", `<path d="M14 18h36M18 18v8M46 18v8M15 15h34"/>`)
});

export const diagramRegistry = Object.freeze(Object.fromEntries(
  Object.entries(diagramManifest).map(([name, definition]) => [name, definition.geometry])
));

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
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return String(value);
  const candidate = String(value ?? "").trim();
  return safeLength.test(candidate) ? candidate : String(fallback);
}

function attribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/** Render a named 24 × 24 icon as safe inline SVG markup. */
export function iconSvg(name, options = {}) {
  const content = registryMarkup(iconRegistry, name, "icon");
  if (!content) return "";

  const settings = options && typeof options === "object" ? options : {};
  const size = settings.size;
  const width = length(settings.width ?? size, 24);
  const height = length(settings.height ?? size, 24);
  const className = classes("jq-icon", settings.className ?? settings.class);
  const label = typeof settings.label === "string" && settings.label.trim()
    ? settings.label.trim()
    : "";
  const accessibility = label
    ? `role="img" aria-label="${attribute(label)}"`
    : `aria-hidden="true"`;

  return `<svg xmlns="http://www.w3.org/2000/svg" class="${className}" data-icon-name="${name}" viewBox="0 0 24 24" width="${width}" height="${height}" fill="none" stroke="currentColor" stroke-width="${ICON_STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round" ${accessibility} focusable="false">${content}</svg>`;
}

/** Render a named 64 × 36 product profile drawing as inline SVG markup. */
export function diagramSvg(name, options = {}) {
  const content = registryMarkup(diagramRegistry, name, "diagram");
  if (!content) return "";

  const settings = options && typeof options === "object" ? options : {};
  const width = length(settings.width, 64);
  const height = length(settings.height, 36);
  const className = classes("jq-diagram", settings.className ?? settings.class);

  return `<svg xmlns="http://www.w3.org/2000/svg" class="${className}" data-diagram-name="${name}" viewBox="0 0 64 36" width="${width}" height="${height}" fill="none" stroke="currentColor" stroke-width="${ICON_STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${content}</svg>`;
}

/** Replace an element's contents with one named icon. */
export function setIcon(element, name) {
  if (!element || (typeof element !== "object" && typeof element !== "function") || !("innerHTML" in element)) {
    warn("setIcon requires an element with an innerHTML property");
    return false;
  }

  const markup = iconSvg(name);
  element.innerHTML = markup;
  if (markup) {
    if (typeof element.setAttribute === "function") element.setAttribute("data-icon", name);
    else if (element.dataset && typeof element.dataset === "object") element.dataset.icon = name;
  }
  return markup !== "";
}

/** Mount every [data-icon] host beneath root. Returns the mounted count. */
export function mountIcons(root = typeof document === "undefined" ? undefined : document) {
  if (!root || typeof root.querySelectorAll !== "function") {
    warn("mountIcons requires a Document, Element, or queryable root");
    return 0;
  }

  const hosts = new Set();
  if (typeof root.matches === "function" && root.matches("[data-icon]")) hosts.add(root);
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
