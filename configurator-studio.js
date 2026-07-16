import {
  defaultBookcaseConfig,
  layoutPresets,
  normalizeBookcaseConfig
} from "./bookcase-config.js?v=engine-polish-20260716a";

export const STUDIO_ENTRY_VIEWS = Object.freeze({
  welcome: "welcome"
});

export const STUDIO_DESIGN_INTENTS = Object.freeze({
  newDesign: "new",
  resume: "resume"
});

export const STUDIO_CAPABILITIES = Object.freeze([
  "Add or remove sections",
  "Crown and base profiles",
  "Resize each section",
  "Color and finishes",
  "Mix doors and drawers",
  "Lighting options",
  "Open or tall storage",
  "Built to fit your space"
]);

export const STUDIO_DIMENSION_LIMITS = Object.freeze({
  width: Object.freeze({ min: 24, max: 144, label: "Wall width" }),
  height: Object.freeze({ min: 72, max: 120, label: "Available height" }),
  depth: Object.freeze({ min: 10, max: 24, label: "Preferred depth" })
});

export const STUDIO_PROVISIONAL_DIMENSIONS = Object.freeze({
  width: 96,
  height: 96,
  depth: 15
});

export const STUDIO_PREVIEW_IDEA_IDS = Object.freeze([
  "classic-open",
  "display-wall",
  "tall-storage"
]);

export const STUDIO_PREVIEW_CALLOUTS = Object.freeze({
  "classic-open": Object.freeze([
    Object.freeze({ id: "add-shelves", label: "Add shelves", icon: "shelves", side: "left", y: "38%" }),
    Object.freeze({ id: "resize-sections", label: "Resize sections", icon: "dimensions", side: "right", y: "62%" })
  ]),
  "display-wall": Object.freeze([
    Object.freeze({ id: "add-drawers", label: "Add drawers", icon: "drawers", side: "left", y: "66%" }),
    Object.freeze({ id: "add-doors", label: "Add doors", icon: "doors", side: "right", y: "66%" })
  ]),
  "tall-storage": Object.freeze([
    Object.freeze({ id: "add-tall-doors", label: "Add tall doors", icon: "doors", side: "left", y: "68%" }),
    Object.freeze({ id: "mix-storage", label: "Mix storage", icon: "storage", side: "right", y: "34%" })
  ])
});

export function getStudioPreviewIdeas() {
  return STUDIO_PREVIEW_IDEA_IDS
    .map((ideaId) => layoutPresets.find((preset) => preset.id === ideaId))
    .filter(Boolean)
    .map((preset) => Object.freeze({
      ...preset,
      callouts: STUDIO_PREVIEW_CALLOUTS[preset.id] || Object.freeze([])
    }));
}

export function resolveStudioEntryState({
  hasValidSharedConfiguration = false,
  hasValidPreset = false,
  forceWelcome = false,
  hasValidSavedDesign = false
} = {}) {
  if (hasValidSharedConfiguration) return Object.freeze({ presentationOnly: false, source: "share" });
  if (hasValidPreset) return Object.freeze({ presentationOnly: false, source: "preset" });
  if (forceWelcome) return Object.freeze({ presentationOnly: true, source: "new" });
  if (hasValidSavedDesign) return Object.freeze({ presentationOnly: false, source: "saved" });
  return Object.freeze({ presentationOnly: true, source: "new" });
}

export function isStudioWelcomeRequest(search = "") {
  const params = new URLSearchParams(String(search).replace(/^\?/, ""));
  return params.get("start") === "welcome";
}

export function isStudioResumeRequest(search = "") {
  const params = new URLSearchParams(String(search).replace(/^\?/, ""));
  return params.get("start") === "resume";
}

export function normalizeStudioDesignIntent(value) {
  return value === STUDIO_DESIGN_INTENTS.resume
    ? STUDIO_DESIGN_INTENTS.resume
    : STUDIO_DESIGN_INTENTS.newDesign;
}

export function normalizeStudioEntryView(value) {
  return Object.values(STUDIO_ENTRY_VIEWS).includes(value) ? value : STUDIO_ENTRY_VIEWS.welcome;
}

export function validateStudioDimensions(input = {}) {
  const dimensions = {};
  const issues = [];
  for (const [field, limits] of Object.entries(STUDIO_DIMENSION_LIMITS)) {
    const raw = String(input[field] ?? "").trim();
    const value = Number(raw);
    if (!raw || !Number.isFinite(value)) {
      issues.push({ field, message: `Enter a numeric ${limits.label.toLowerCase()}.` });
      continue;
    }
    if (value < limits.min || value > limits.max) {
      issues.push({ field, message: `${limits.label} must be between ${limits.min} and ${limits.max} inches.` });
      continue;
    }
    dimensions[field] = value;
  }
  return Object.freeze({
    valid: issues.length === 0,
    dimensions: Object.freeze(dimensions),
    issues: Object.freeze(issues.map((issue) => Object.freeze(issue)))
  });
}

export function suggestStudioSectionCount(width) {
  const numericWidth = Number(width);
  if (!Number.isFinite(numericWidth)) return 4;
  return Math.max(1, Math.min(6, Math.round(numericWidth / 24)));
}

export function createNeutralCustomConfig(input = {}) {
  const validation = validateStudioDimensions(input);
  if (!validation.valid) return Object.freeze({ accepted: false, issues: validation.issues });
  const sections = Math.max(1, Math.min(6, Math.round(Number(input.sections) || suggestStudioSectionCount(validation.dimensions.width))));
  const sectionRatios = Array.from({ length: sections }, () => 1);
  const config = normalizeBookcaseConfig({
    ...defaultBookcaseConfig,
    ...validation.dimensions,
    layoutPreset: "custom",
    layoutType: "classic",
    sections,
    shelves: 2,
    shelfThickness: 1,
    lowerCabinets: false,
    lowerStorage: "doors",
    drawerCount: 3,
    centerOpening: false,
    deskOpening: false,
    featureOpening: false,
    tallDoors: false,
    doorStyle: "slim_shaker",
    doorCount: 0,
    lighting: "no_lighting",
    crownStyle: "slim_cap",
    baseStyle: "toe_kick",
    finish: "white_dove",
    customPaintColor: "",
    customPaintCode: "",
    customPaintHex: "",
    paintSelection: null,
    layoutMetadata: { sectionRatios }
  });
  return Object.freeze({ accepted: true, config });
}
