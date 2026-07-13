import {
  defaultBookcaseConfig,
  layoutPresets,
  normalizeBookcaseConfig
} from "./bookcase-config.js?v=engine-contract-20260713s";

export const STUDIO_ENTRY_VIEWS = Object.freeze({
  welcome: "welcome",
  custom: "custom",
  ideas: "ideas"
});

export const STUDIO_CAPABILITIES = Object.freeze([
  "Add or remove sections",
  "Resize each section",
  "Mix doors and drawers",
  "Open or tall storage",
  "Crown and base profiles",
  "Color and lighting"
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

export const INSPIRATION_FILTERS = Object.freeze([
  { id: "all", label: "All" },
  { id: "library", label: "Library" },
  { id: "storage", label: "Storage" },
  { id: "media", label: "Media" },
  { id: "work", label: "Work" },
  { id: "feature", label: "Feature" }
]);

const inspirationMetadata = Object.freeze({
  "lower-cabinets": Object.freeze({ category: "storage", tags: ["closed storage", "balanced"], fullyEditable: true }),
  "classic-open": Object.freeze({ category: "library", tags: ["open shelving", "minimal"], fullyEditable: true }),
  "media-wall": Object.freeze({ category: "media", tags: ["television", "display"], fullyEditable: false }),
  "library-wall": Object.freeze({ category: "library", tags: ["books", "symmetrical"], fullyEditable: true }),
  "display-wall": Object.freeze({ category: "storage", tags: ["drawers", "display"], fullyEditable: true }),
  "glass-library": Object.freeze({ category: "library", tags: ["glass doors", "display"], fullyEditable: true }),
  "desk-niche": Object.freeze({ category: "work", tags: ["desk", "workspace"], fullyEditable: false }),
  "feature-wall": Object.freeze({ category: "feature", tags: ["fireplace", "surround"], fullyEditable: false }),
  "asymmetric-modern": Object.freeze({ category: "storage", tags: ["asymmetrical", "drawers"], fullyEditable: true }),
  "tall-storage": Object.freeze({ category: "storage", tags: ["tall doors", "open shelving"], fullyEditable: true })
});

export const inspirationIdeas = Object.freeze(layoutPresets.map((preset) => {
  const metadata = inspirationMetadata[preset.id];
  if (!metadata) throw new Error(`Missing inspiration metadata for ${preset.id}.`);
  return Object.freeze({
    id: preset.id,
    name: preset.name,
    description: preset.description,
    category: metadata.category,
    tags: Object.freeze([...metadata.tags]),
    fullyEditable: metadata.fullyEditable,
    config: preset.config
  });
}));

export const STUDIO_PREVIEW_IDEA_IDS = Object.freeze([
  "classic-open",
  "display-wall",
  "tall-storage"
]);

export function resolveStudioEntryState({
  hasValidSharedConfiguration = false,
  hasValidPreset = false,
  hasValidSavedDesign = false
} = {}) {
  if (hasValidSharedConfiguration) return Object.freeze({ presentationOnly: false, source: "share" });
  if (hasValidPreset) return Object.freeze({ presentationOnly: false, source: "preset" });
  if (hasValidSavedDesign) return Object.freeze({ presentationOnly: false, source: "saved" });
  return Object.freeze({ presentationOnly: true, source: "new" });
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

export function filterInspirationIdeas(filterId = "all", ideas = inspirationIdeas) {
  const normalizedFilter = INSPIRATION_FILTERS.some((filter) => filter.id === filterId) ? filterId : "all";
  return normalizedFilter === "all"
    ? [...ideas]
    : ideas.filter((idea) => idea.category === normalizedFilter);
}

export function getInspirationIdea(ideaId) {
  return inspirationIdeas.find((idea) => idea.id === ideaId) || null;
}

export function getStudioPreviewIdeas() {
  return STUDIO_PREVIEW_IDEA_IDS.map((ideaId) => getInspirationIdea(ideaId)).filter(Boolean);
}
