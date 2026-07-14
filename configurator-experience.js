import {
  createDesignId,
  defaultBookcaseConfig,
  getHardwareFinish,
  getHardwareFinishOption,
  getHardwareType,
  hardwareTypeOptions,
  layoutPresets,
  normalizeBookcaseConfig,
  optionLabels
} from "./bookcase-config.js?v=configurator-construction-20260714b";
import { deriveBillableComponents } from "./bookcase-billable.js?v=configurator-construction-20260714b";
import { getSectionDesignerState } from "./bookcase-sections.js?v=configurator-construction-20260714b";

export const CONFIGURATOR_MODES = Object.freeze({
  guided: "guided",
  all: "all"
});

export const CONFIGURATOR_PREFERENCE_KEYS = Object.freeze({
  mode: "jqConfiguratorMode",
  guidedStep: "jqConfiguratorGuidedStep",
  allCategory: "jqConfiguratorAllCategory"
});

export const GUIDED_STEPS = Object.freeze([
  { id: "dimensions", label: "Space", shortLabel: "Space", title: "Confirm your space", description: "Set the wall width, available height, and preferred bookcase depth." },
  { id: "layout", label: "Structure", shortLabel: "Structure", title: "Shape the structure", description: "Choose the section count, then resize or split individual sections." },
  { id: "storage", label: "Storage", shortLabel: "Storage", title: "Plan the storage", description: "Mix open shelving, doors, drawers, and tall storage by section." },
  { id: "construction", label: "Build", shortLabel: "Build", title: "Choose construction details", description: "Set shelf thickness, base, and crown or top profiles." },
  { id: "appearance", label: "Style", shortLabel: "Style", title: "Choose finishes and details", description: "Coordinate finish, hardware, and lighting." },
  { id: "review", label: "Review", shortLabel: "Review", title: "Review your design", description: "Confirm the physical design and service choices before requesting a quote." }
]);

export const ALL_CONTROL_CATEGORIES = Object.freeze([
  { id: "dimensions", label: "Space & Dimensions", step: "dimensions" },
  { id: "layout", label: "Foundation Idea", step: "layout" },
  { id: "section_designer", label: "Structure & Sections", step: "layout" },
  { id: "storage", label: "Shelves & Cabinets", step: "storage" },
  { id: "construction", label: "Construction", step: "construction" },
  { id: "doors", label: "Fronts", step: "storage" },
  { id: "finish", label: "Finish", step: "appearance" },
  { id: "hardware", label: "Hardware", step: "appearance" },
  { id: "lighting", label: "Lighting", step: "appearance" },
  { id: "service", label: "Project Service", step: "review" }
]);

export const PHYSICAL_CONFIG_FIELDS = Object.freeze([
  "layoutPreset", "layoutType", "width", "height", "depth", "sections", "shelves",
  "shelfThickness", "lowerCabinets", "lowerStorage", "drawerCount", "centerOpening",
  "deskOpening", "featureOpening", "tallDoors", "constructionProfile", "doorStyle", "drawerFrontStyle", "doorCount", "hardware",
  "lighting", "lightingWarmth", "finish", "customPaintColor", "customPaintCode",
  "customPaintHex", "paintSelection", "crownStyle", "baseStyle", "layoutMetadata", "installation", "delivery"
]);

export const CONTROL_REGISTRY = Object.freeze([
  { field: "layoutPreset", step: "layout", category: "layout", access: "direct" },
  { field: "layoutType", step: "layout", category: "layout", access: "preset-derived" },
  { field: "centerOpening", step: "layout", category: "layout", access: "preset-derived" },
  { field: "deskOpening", step: "layout", category: "layout", access: "preset-derived" },
  { field: "featureOpening", step: "layout", category: "layout", access: "preset-derived" },
  { field: "tallDoors", step: "layout", category: "layout", access: "preset-derived" },
  { field: "layoutMetadata", step: "layout", category: "layout", access: "preset-derived" },
  { field: "width", step: "dimensions", category: "dimensions", access: "direct" },
  { field: "height", step: "dimensions", category: "dimensions", access: "direct" },
  { field: "depth", step: "dimensions", category: "dimensions", access: "direct" },
  { field: "sections", step: "layout", category: "section_designer", access: "direct" },
  { field: "shelves", step: "storage", category: "storage", access: "direct" },
  { field: "lowerCabinets", step: "storage", category: "storage", access: "direct" },
  { field: "lowerStorage", step: "storage", category: "storage", access: "direct" },
  { field: "drawerCount", step: "storage", category: "storage", access: "direct" },
  { field: "shelfThickness", step: "construction", category: "construction", access: "direct" },
  { field: "baseStyle", step: "construction", category: "construction", access: "direct" },
  { field: "crownStyle", step: "construction", category: "construction", access: "direct" },
  { field: "constructionProfile", step: "construction", category: "construction", access: "derived" },
  { field: "doorStyle", step: "storage", category: "doors", access: "direct" },
  { field: "drawerFrontStyle", step: "storage", category: "doors", access: "direct" },
  { field: "doorCount", step: "storage", category: "doors", access: "derived" },
  { field: "finish", step: "appearance", category: "finish", access: "direct" },
  { field: "customPaintColor", step: "appearance", category: "finish", access: "direct" },
  { field: "customPaintCode", step: "appearance", category: "finish", access: "direct" },
  { field: "customPaintHex", step: "appearance", category: "finish", access: "direct" },
  { field: "paintSelection", step: "appearance", category: "finish", access: "derived" },
  { field: "hardware", step: "appearance", category: "hardware", access: "direct" },
  { field: "lighting", step: "appearance", category: "lighting", access: "direct" },
  { field: "lightingWarmth", step: "appearance", category: "lighting", access: "direct" },
  { field: "installation", step: "review", category: "service", access: "direct" },
  { field: "delivery", step: "review", category: "service", access: "direct" }
]);

export const DIMENSION_LIMITS = Object.freeze({
  width: { min: 24, max: 144, label: "Width", unit: " inches" },
  height: { min: 72, max: 120, label: "Height", unit: " inches" },
  depth: { min: 10, max: 24, label: "Depth", unit: " inches" },
  shelves: { min: 2, max: 8, label: "Shelves per section", unit: "" },
  shelfThickness: { min: 0.75, max: 2, label: "Shelf thickness", unit: " inches" }
});

export const EDITABLE_NUMBER_LIMITS = Object.freeze({
  ...DIMENSION_LIMITS,
  sections: { min: 1, max: 6, label: "Sections", unit: "" },
  drawerCount: { min: 2, max: 5, label: "Drawers per section", unit: "" }
});

const stepIds = new Set(GUIDED_STEPS.map((step) => step.id));
const categoryIds = new Set(ALL_CONTROL_CATEGORIES.map((category) => category.id));
const modeIds = new Set(Object.values(CONFIGURATOR_MODES));

export function normalizeConfiguratorMode(value) {
  return modeIds.has(value) ? value : CONFIGURATOR_MODES.guided;
}

export function normalizeGuidedStep(value) {
  return stepIds.has(value) ? value : GUIDED_STEPS[0].id;
}

export function normalizeAllCategory(value) {
  return categoryIds.has(value) ? value : ALL_CONTROL_CATEGORIES[0].id;
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'\"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    "\"": "&quot;"
  })[character]);
}

export function getGuidedStepIndex(stepId) {
  const index = GUIDED_STEPS.findIndex((step) => step.id === normalizeGuidedStep(stepId));
  return Math.max(0, index);
}

export function categoryForGuidedStep(stepId, appearanceCategory = "finish") {
  const normalized = normalizeGuidedStep(stepId);
  if (normalized === "layout") return "section_designer";
  if (normalized === "appearance") {
    return ["finish", "hardware", "lighting"].includes(appearanceCategory) ? appearanceCategory : "finish";
  }
  if (normalized === "review") return "service";
  return normalized;
}

export function guidedStepForCategory(categoryId) {
  return ALL_CONTROL_CATEGORIES.find((category) => category.id === normalizeAllCategory(categoryId))?.step || "layout";
}

export function guidedStepForField(field) {
  return CONTROL_REGISTRY.find((entry) => entry.field === field)?.step || "layout";
}

export function categoryForField(field) {
  return CONTROL_REGISTRY.find((entry) => entry.field === field)?.category || "layout";
}

export function getApplicability(config, layout) {
  const state = normalizeBookcaseConfig(config);
  const billableQuantities = deriveBillableComponents(layout);
  const generatedDoorCount = billableQuantities.hingedDoorLeaves;
  const generatedDrawerCount = billableQuantities.generatedDrawerFronts;
  const generatedLightCount = billableQuantities.compatibleLightingComponents;
  const hasDoors = generatedDoorCount > 0;
  const hasDrawers = generatedDrawerCount > 0;
  const hasFronts = hasDoors || hasDrawers;
  const hasBillableLighting = generatedLightCount > 0;
  return {
    hasLowerCabinets: Boolean(state.lowerCabinets),
    hasDoors,
    hasDrawers,
    hasFronts,
    showCabinetControls: Boolean(state.lowerCabinets) && (hasDoors || hasDrawers),
    showDoorControls: hasDoors,
    showDrawerCount: hasDrawers,
    showHardware: billableQuantities.hardwareUnits > 0,
    showLightingWarmth: state.lighting !== "no_lighting" && hasBillableLighting,
    hasBillableLighting,
    openingKind: state.centerOpening ? "media" : state.deskOpening ? "desk" : state.featureOpening ? "fireplace" : "none",
    generatedDoorCount,
    generatedDrawerCount,
    generatedLightCount,
    billableQuantities
  };
}

export function getInvalidDraftIssues(drafts = {}) {
  return Object.entries(EDITABLE_NUMBER_LIMITS).flatMap(([field, limits]) => {
    if (!Object.prototype.hasOwnProperty.call(drafts, field)) return [];
    const raw = String(drafts[field] ?? "").trim();
    const numeric = Number(raw);
    if (!raw) return [{ field, message: `${limits.label} is required.` }];
    if (!Number.isFinite(numeric)) return [{ field, message: `Enter a numeric ${limits.label.toLowerCase()}.` }];
    if (numeric < limits.min || numeric > limits.max) {
      return [{ field, message: `${limits.label} must be between ${limits.min} and ${limits.max}${limits.unit}.` }];
    }
    return [];
  });
}

export function validateGuidedStep(stepId, config, layout, drafts = {}) {
  const step = normalizeGuidedStep(stepId);
  const state = normalizeBookcaseConfig(config);
  const issues = [];
  if (["dimensions", "layout", "storage", "construction", "review"].includes(step)) {
    const relevantFields = step === "dimensions"
      ? new Set(["width", "height", "depth"])
      : step === "layout"
        ? new Set(["sections"])
      : step === "storage"
        ? new Set(["shelves", "drawerCount"])
        : step === "construction"
          ? new Set(["shelfThickness"])
        : null;
    issues.push(...getInvalidDraftIssues(drafts).filter((issue) => !relevantFields || relevantFields.has(issue.field)));
  }
  if (["appearance", "review"].includes(step) && state.finish === "custom_bm" && !state.customPaintColor && !state.customPaintCode) {
    issues.push({ field: "customPaintColor", message: "Choose a Benjamin Moore color or select a standard finish." });
  }
  if (["storage", "construction", "review"].includes(step) && layout?.validation?.valid === false) {
    const error = layout.validation.errors?.[0];
    issues.push({ field: error?.field || "configuration", message: error?.message || "This combination needs attention before you continue." });
  }
  return { valid: issues.length === 0, issues };
}

export function hasBlockingConfigurationIssue(config, layout, drafts = {}) {
  return !validateGuidedStep("review", config, layout, drafts).valid;
}

export function getCategorySummary(categoryId, config, layout, basePresetId = "") {
  const state = normalizeBookcaseConfig(config);
  const applicability = getApplicability(state, layout);
  const category = normalizeAllCategory(categoryId);
  if (category === "layout") return getLayoutLabel(state, basePresetId);
  if (category === "dimensions") return `${state.width} in W × ${state.height} in H × ${state.depth} in D · ${state.shelves} shelves · ${optionLabels.shelfThickness[state.shelfThickness]}`;
  if (category === "section_designer") {
    const designer = getSectionDesignerState(state, layout);
    const counts = designer.sections.reduce((result, section) => {
      result[section.type] = (result[section.type] || 0) + 1;
      return result;
    }, {});
    const parts = [
      counts.lower_doors ? `${counts.lower_doors} doors` : "",
      counts.drawers ? `${counts.drawers} drawers` : "",
      counts.open ? `${counts.open} open` : "",
      counts.tall_doors ? `${counts.tall_doors} tall` : ""
    ].filter(Boolean);
    return `${designer.sections.length} sections${parts.length ? ` · ${parts.join(" · ")}` : ""}`;
  }
  if (category === "storage") return `${state.sections} sections${state.lowerCabinets ? `, ${state.lowerStorage}` : ", open base"}`;
  if (category === "construction") return `${optionLabels.baseStyle[state.baseStyle]}, ${optionLabels.crownStyle[state.crownStyle]}`;
  if (category === "doors") {
    if (!applicability.hasFronts) return "Not applicable to this layout";
    const parts = [];
    if (applicability.hasDoors) parts.push(formatGeneratedDoorStyles(applicability.billableQuantities.doorsByStyle));
    if (applicability.hasDrawers) parts.push(formatGeneratedDrawerStyles(applicability.billableQuantities.drawersByStyle));
    return parts.join(", ") || "Storage fronts";
  }
  if (category === "finish") return getFinishLabel(state);
  if (category === "hardware") return applicability.showHardware ? optionLabels.hardware[state.hardware] : "Not applicable";
  if (category === "lighting") {
    if (state.lighting === "no_lighting") return optionLabels.lighting[state.lighting];
    if (!applicability.hasBillableLighting) return `${optionLabels.lighting[state.lighting]} selected · No compatible locations`;
    return `${optionLabels.lighting[state.lighting]}, ${optionLabels.lightingWarmth[state.lightingWarmth]} · ${applicability.generatedLightCount} generated`;
  }
  if (category === "service") return `${optionLabels.delivery[state.delivery]}, ${optionLabels.installation[state.installation]}`;
  return "";
}

export function createReviewGroups(config, layout, basePresetId = "") {
  const state = normalizeBookcaseConfig(config);
  const applicability = getApplicability(state, layout);
  const designer = getSectionDesignerState(state, layout);
  const hardwareType = hardwareTypeOptions.find((option) => option.value === getHardwareType(state.hardware));
  const hardwareFinish = getHardwareFinishOption(getHardwareFinish(state.hardware));
  const openingLabel = {
    media: "Media opening",
    desk: "Desk opening",
    fireplace: "Fireplace opening"
  }[applicability.openingKind];
  const groups = [
    {
      id: "layout",
      title: "Layout",
      step: "layout",
      items: [
        { label: "Design", value: getLayoutLabel(state, basePresetId) },
        ...(openingLabel ? [{ label: "Feature", value: openingLabel }] : [])
      ]
    },
    {
      id: "dimensions",
      title: "Dimensions",
      step: "dimensions",
      items: [
        { label: "Overall size", value: `${state.width} in W × ${state.height} in H × ${state.depth} in D` },
        { label: "Shelves per section", value: String(state.shelves) },
        { label: "Shelf thickness", value: optionLabels.shelfThickness[state.shelfThickness] }
      ]
    },
    {
      id: "storage",
      title: "Shelves & Cabinets",
      step: "storage",
      items: [
        { label: "Sections", value: String(state.sections) },
        { label: "Lower storage", value: state.lowerCabinets ? (state.lowerStorage === "drawers" ? "Drawers" : "Doors") : "None" },
        ...(applicability.hasDoors ? [{ label: "Door front profile", value: optionLabels.doorStyle[state.doorStyle] }] : []),
        ...(applicability.hasDrawers ? [{ label: "Drawer front profile", value: optionLabels.drawerFrontStyle[state.drawerFrontStyle] }] : []),
        ...(applicability.hasDoors ? [{ label: "Doors", value: `${applicability.generatedDoorCount} generated · ${formatGeneratedDoorStyles(applicability.billableQuantities.doorsByStyle)}` }] : []),
        ...(applicability.hasDrawers ? [{ label: "Drawers", value: `${applicability.generatedDrawerCount} generated` }] : []),
        ...designer.sections.map((section) => ({
          label: `Section ${section.index + 1}`,
          value: `${formatSectionWidth(section.width)} in clear · ${formatSectionType(section.type, state.drawerCount)}`
        }))
      ]
    },
    {
      id: "construction",
      title: "Construction",
      step: "construction",
      items: [
        { label: "Base", value: optionLabels.baseStyle[state.baseStyle] },
        { label: "Top", value: optionLabels.crownStyle[state.crownStyle] }
      ]
    },
    {
      id: "appearance",
      title: "Appearance",
      step: "appearance",
      items: [
        ...(state.finish === "custom_bm" && state.paintSelection ? [
          { label: "Finish", value: state.paintSelection.brand || "Benjamin Moore" },
          { label: "Color", value: [state.paintSelection.name, state.paintSelection.code].filter(Boolean).join(" ") },
          ...(state.paintSelection.collections.length ? [{ label: "Collection", value: state.paintSelection.collections.join(", ") }] : []),
          { label: "Preview", value: "Digital preview only · Confirm with an official paint sample" }
        ] : [{ label: "Finish", value: getFinishLabel(state) }]),
        ...(applicability.showHardware ? [
          { label: "Hardware type", value: hardwareType?.label || optionLabels.hardware[state.hardware] },
          { label: "Hardware finish", value: `${hardwareFinish?.label || optionLabels.hardware[state.hardware]} · ${applicability.billableQuantities.hardwareUnits} generated` }
        ] : []),
        {
          label: "Lighting",
          value: applicability.hasBillableLighting
            ? `${optionLabels.lighting[state.lighting]} · ${applicability.generatedLightCount} generated`
            : state.lighting === "no_lighting"
              ? optionLabels.lighting[state.lighting]
              : `${optionLabels.lighting[state.lighting]} selected · No compatible locations`
        },
        ...(applicability.showLightingWarmth ? [{ label: "Light temperature", value: `${optionLabels.lightingWarmth[state.lightingWarmth]} · ${getWarmthDescription(state.lightingWarmth)}` }] : [])
      ]
    },
    {
      id: "service",
      title: "Project Service",
      step: "review",
      items: [
        { label: "Delivery", value: optionLabels.delivery[state.delivery] },
        { label: "Installation", value: optionLabels.installation[state.installation] }
      ]
    }
  ];
  return groups;
}

function formatSectionWidth(value) {
  return Number(Number(value).toFixed(3)).toString();
}

function formatSectionType(type, drawerCount) {
  return {
    open: "Open Shelves",
    lower_doors: "Lower Doors",
    drawers: `${drawerCount} Lower Drawers`,
    tall_doors: "Tall Door",
    media: "Media Feature · Locked",
    desk: "Desk Feature · Locked",
    feature: "Fireplace Feature · Locked"
  }[type] || "Generated Section";
}

export function getFinishLabel(config) {
  const state = normalizeBookcaseConfig(config);
  if (state.finish !== "custom_bm") return optionLabels.finish[state.finish] || "Paint finish";
  return [state.paintSelection?.brand || "Benjamin Moore", state.customPaintColor, state.customPaintCode].filter(Boolean).join(" · ") || optionLabels.finish.custom_bm;
}

export function getLayoutLabel(config, basePresetId = "") {
  const state = normalizeBookcaseConfig(config);
  const exact = layoutPresets.find((item) => item.id === state.layoutPreset);
  if (exact) return exact.name;
  const base = layoutPresets.find((item) => item.id === basePresetId);
  return base ? `${base.name} · Customized` : "Custom layout";
}

export function inferBasePresetId(config, fallbackId = defaultBookcaseConfig.layoutPreset) {
  const state = normalizeBookcaseConfig(config);
  const exact = layoutPresets.find((item) => item.id === state.layoutPreset);
  if (exact) return exact.id;
  const structural = layoutPresets.find((item) => item.config.layoutType === state.layoutType);
  return structural?.id || fallbackId;
}

export function getChangedConfigFields(previousConfig, nextConfig) {
  const previous = normalizeBookcaseConfig(previousConfig || defaultBookcaseConfig);
  const next = normalizeBookcaseConfig(nextConfig || defaultBookcaseConfig);
  return PHYSICAL_CONFIG_FIELDS.filter((field) => JSON.stringify(previous[field]) !== JSON.stringify(next[field]));
}

export function configsAreEqual(left, right) {
  return getChangedConfigFields(left, right).length === 0;
}

export function createPresetTransition(config, currentBasePresetId, nextPresetId) {
  const state = normalizeBookcaseConfig(config);
  const preset = layoutPresets.find((item) => item.id === nextPresetId);
  if (!preset) {
    return { config: state, preset: null, dimensionsPreserved: false, constructionPreserved: false };
  }
  const previousPreset = layoutPresets.find((item) => item.id === currentBasePresetId);
  const dimensionsPreserved = previousPreset
    ? ["width", "height", "depth"].some((field) => state[field] !== previousPreset.config[field])
    : true;
  const constructionPreserved = previousPreset
    ? ["shelfThickness", "baseStyle", "crownStyle"].some((field) => state[field] !== previousPreset.config[field])
    : true;
  const retained = {
    constructionProfile: state.constructionProfile,
    finish: state.finish,
    customPaintColor: state.customPaintColor,
    customPaintCode: state.customPaintCode,
    customPaintHex: state.customPaintHex,
    paintSelection: state.paintSelection,
    hardware: state.hardware,
    lighting: state.lighting,
    lightingWarmth: state.lightingWarmth,
    delivery: state.delivery,
    installation: state.installation,
    ...(dimensionsPreserved ? { width: state.width, height: state.height, depth: state.depth } : {}),
    ...(constructionPreserved ? {
      shelfThickness: state.shelfThickness,
      baseStyle: state.baseStyle,
      crownStyle: state.crownStyle
    } : {})
  };
  return {
    config: normalizeBookcaseConfig({
      ...state,
      ...preset.config,
      ...retained,
      layoutPreset: preset.id
    }),
    preset,
    dimensionsPreserved,
    constructionPreserved
  };
}

export function createSavedDesignRecord(config, price, options = {}) {
  const state = normalizeBookcaseConfig(config);
  const id = options.id || createDesignId(state, price);
  const savedAt = options.savedAt || new Date().toISOString();
  return { schemaVersion: 3, id, price, config: state, savedAt };
}

export function createQuoteUrl(designId) {
  return `request-quote.html?design=${encodeURIComponent(designId)}`;
}

export function shouldRunAction(lastStartedAt, now = Date.now(), lockWindow = 700) {
  return !Number.isFinite(lastStartedAt) || now - lastStartedAt >= lockWindow;
}

function getWarmthDescription(value) {
  const numeric = Number(value);
  if (numeric === 2700) return "Warm and cozy";
  if (numeric === 3000) return "Warm white";
  return "Clean neutral white";
}

function formatGeneratedDoorStyles(styles) {
  return Object.entries(styles).map(([style, count]) => {
    const label = optionLabels.doorStyle[style] || String(style).replaceAll("_", " ");
    return `${count} ${label}`;
  }).join(" + ");
}

function formatGeneratedDrawerStyles(styles) {
  return Object.entries(styles).map(([style, count]) => {
    const label = optionLabels.drawerFrontStyle[style] || String(style).replaceAll("_", " ");
    return `${count} ${label}`;
  }).join(" + ");
}
