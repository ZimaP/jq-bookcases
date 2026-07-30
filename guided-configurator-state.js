import {
  CATEGORY_DEFINITIONS,
  DETAIL_OPTIONS,
  FINISH_OPTIONS,
  getCategory,
  getCompatibleDetails,
  getFinish,
  getLayout,
  getMeasurementFields,
  getProductChoiceForSelection,
  getStyle,
  resolvePreviewAsset
} from "./guided-configurator-data.js?v=unified-guided-scene-20260729c";

export const GUIDED_PROJECT_SCHEMA_VERSION = 2;
export const GUIDED_DRAFT_STORAGE_KEY = "jqGuidedConfiguratorDraftV1";
export const GUIDED_PROJECTS_STORAGE_KEY = "jqGuidedConfiguratorProjectsV1";

const unicodeFractions = Object.freeze({
  "¼": 0.25,
  "½": 0.5,
  "¾": 0.75,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875
});

const deepClone = (value) => JSON.parse(JSON.stringify(value));

const createId = (now = Date.now(), random = Math.random()) => {
  const timeToken = Math.max(0, Number(now) || 0).toString(36).toUpperCase().slice(-7).padStart(5, "0");
  const randomToken = Math.floor(Math.max(0, Math.min(0.999999, Number(random) || 0)) * 36 ** 4)
    .toString(36)
    .toUpperCase()
    .padStart(4, "0");
  return `JQ-${timeToken}-${randomToken}`;
};

const defaultMeasurements = (categoryId, layoutId) => Object.fromEntries(
  getMeasurementFields(categoryId, layoutId)
    .filter((field) => field.defaultValue !== null && field.defaultValue !== undefined)
    .map((field) => [field.id, field.defaultValue])
);

const defaultDetails = Object.freeze({
  doorStyle: DETAIL_OPTIONS.doorStyle[1].id,
  hardware: DETAIL_OPTIONS.hardware[1].id,
  lighting: DETAIL_OPTIONS.lighting[1].id,
  baseStyle: DETAIL_OPTIONS.baseStyle[0].id,
  topTreatment: DETAIL_OPTIONS.topTreatment[1].id
});

export function createProject(options = {}) {
  const now = Number(options.now) || Date.now();
  const category = getCategory(options.category || "bookcase");
  const selectedStyle = category.styles[0];
  const finish = FINISH_OPTIONS.wood[1];

  return {
    schemaVersion: GUIDED_PROJECT_SCHEMA_VERSION,
    projectId: options.projectId || createId(now, options.random),
    projectName: options.projectName || "Untitled Project",
    currentStep: 1,
    maxVisitedStep: 1,
    category: category.id,
    productSelected: options.productSelected === true,
    layout: null,
    measurements: defaultMeasurements(category.id, null),
    style: selectedStyle.id,
    finish: finish.id,
    accentFinish: FINISH_OPTIONS.accent[0].id,
    doorStyle: defaultDetails.doorStyle,
    hardware: defaultDetails.hardware,
    lighting: defaultDetails.lighting,
    baseStyle: defaultDetails.baseStyle,
    topTreatment: defaultDetails.topTreatment,
    notes: "",
    uploadedFiles: [],
    customerDetails: {},
    previewAsset: resolvePreviewAsset(category.id, selectedStyle.id, null),
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    status: "draft"
  };
}

export function parseInches(rawValue) {
  if (typeof rawValue === "number") return Number.isFinite(rawValue) && rawValue >= 0 ? rawValue : null;
  if (typeof rawValue !== "string") return null;

  let value = rawValue.trim().toLowerCase().replace(/(?:inches|inch|in\.?|")$/i, "").trim();
  if (!value) return null;

  let unicodeAmount = 0;
  for (const [symbol, decimal] of Object.entries(unicodeFractions)) {
    if (!value.includes(symbol)) continue;
    unicodeAmount += decimal;
    value = value.replaceAll(symbol, "").trim();
  }

  value = value.replace(/(\d)\s*-\s*(\d+\s*\/\s*\d+)/, "$1 $2");
  const mixedMatch = value.match(/^(\d+(?:\.\d+)?)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixedMatch) {
    const whole = Number(mixedMatch[1]);
    const numerator = Number(mixedMatch[2]);
    const denominator = Number(mixedMatch[3]);
    if (!denominator || numerator < 0) return null;
    return whole + numerator / denominator + unicodeAmount;
  }

  const fractionMatch = value.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fractionMatch) {
    const numerator = Number(fractionMatch[1]);
    const denominator = Number(fractionMatch[2]);
    if (!denominator) return null;
    return numerator / denominator + unicodeAmount;
  }

  if (!value && unicodeAmount) return unicodeAmount;
  if (!/^\d+(?:\.\d+)?$/.test(value)) return null;
  const decimal = Number(value) + unicodeAmount;
  return Number.isFinite(decimal) && decimal >= 0 ? decimal : null;
}

export function prepareMeasurementsForLayout(project = {}, layoutId) {
  const category = getCategory(project.category);
  const layout = getLayout(category.id, layoutId);
  const current = project.measurements && typeof project.measurements === "object"
    ? project.measurements
    : {};
  const fields = getMeasurementFields(category.id, layout?.id);
  const next = Object.fromEntries(fields.map((field) => [
    field.id,
    Object.hasOwn(current, field.id) ? current[field.id] : field.defaultValue
  ]));

  if (!["niche-layout", "left-niche", "right-niche"].includes(layout?.id)) return next;

  const wallField = fields.find((field) => field.id === "wallWidth");
  const nicheField = fields.find((field) => field.id === "nicheWidth");
  const wallWidth = parseInches(next.wallWidth) ?? wallField?.defaultValue ?? 0;
  const nicheWidth = parseInches(next.nicheWidth) ?? nicheField?.defaultValue ?? 0;
  const availableReturn = Number(Math.max(0, wallWidth - nicheWidth).toFixed(4));

  if (layout.id === "left-niche") {
    next.leftReturn = 0;
    next.rightReturn = availableReturn;
  } else if (layout.id === "right-niche") {
    next.leftReturn = availableReturn;
    next.rightReturn = 0;
  } else {
    const centeredReturn = Number((availableReturn / 2).toFixed(4));
    next.leftReturn = centeredReturn;
    next.rightReturn = Number((availableReturn - centeredReturn).toFixed(4));
  }

  return next;
}

export function formatInches(rawValue, options = {}) {
  const value = parseInches(rawValue);
  if (value === null) return options.empty || "—";
  if (options.decimal) return `${Number(value.toFixed(options.precision ?? 2))}`;

  const sixteenths = Math.round(value * 16);
  const whole = Math.floor(sixteenths / 16);
  const remainder = sixteenths % 16;
  if (!remainder) return `${whole}`;

  const divisor = remainder % 8 === 0 ? 8 : remainder % 4 === 0 ? 4 : remainder % 2 === 0 ? 2 : 1;
  const numerator = remainder / divisor;
  const denominator = 16 / divisor;
  return whole ? `${whole} ${numerator}/${denominator}` : `${numerator}/${denominator}`;
}

const SPATIAL_COMPARISON_EPSILON = 1e-6;

export function validateSpatialRelationships(measurements = {}) {
  const source = measurements && typeof measurements === "object" ? measurements : {};
  const valueFor = (fieldId) => parseInches(source[fieldId]);
  const allKnown = (...values) => values.every((value) => value !== null);
  const exceeds = (extent, envelope) => extent - envelope > SPATIAL_COMPARISON_EPSILON;
  const differs = (first, second) => Math.abs(first - second) > SPATIAL_COMPARISON_EPSILON;
  const warnings = [];
  const continueMessage = "You can continue and our team will confirm these approximate measurements.";
  const addWarning = (field, message) => {
    warnings.push({ field, message: `${message} ${continueMessage}` });
  };

  const wallWidth = valueFor("wallWidth");
  const ceilingHeight = valueFor("ceilingHeight");

  const nicheHeight = valueFor("nicheHeight");
  if (allKnown(nicheHeight, ceilingHeight) && exceeds(nicheHeight, ceilingHeight)) {
    addWarning(
      "nicheHeight",
      `Niche height (${formatInches(nicheHeight)} in) exceeds the ceiling height (${formatInches(ceilingHeight)} in).`
    );
  }

  const nicheWidth = valueFor("nicheWidth");
  const leftReturn = valueFor("leftReturn");
  const rightReturn = valueFor("rightReturn");
  if (allKnown(nicheWidth, leftReturn, rightReturn, wallWidth)) {
    const nicheEnvelope = nicheWidth + leftReturn + rightReturn;
    if (differs(nicheEnvelope, wallWidth)) {
      addWarning(
        "nicheWidth",
        `Niche width plus the left and right returns total ${formatInches(nicheEnvelope)} in, which does not match the ${formatInches(wallWidth)} in wall width.`
      );
    }
  }

  const doorWidth = valueFor("doorWidth");
  const doorLeftDistance = valueFor("doorLeftDistance");
  if (allKnown(doorWidth, wallWidth)) {
    const doorExtent = doorWidth + (doorLeftDistance ?? 0);
    if (exceeds(doorExtent, wallWidth)) {
      const extentDescription = doorLeftDistance === null
        ? `Door width (${formatInches(doorWidth)} in)`
        : `The door's extent from the left wall (${formatInches(doorExtent)} in)`;
      addWarning(
        "doorWidth",
        `${extentDescription} exceeds the ${formatInches(wallWidth)} in wall width.`
      );
    }
  }

  const doorHeight = valueFor("doorHeight");
  if (allKnown(doorHeight, ceilingHeight) && exceeds(doorHeight, ceilingHeight)) {
    addWarning(
      "doorHeight",
      `Door height (${formatInches(doorHeight)} in) exceeds the ceiling height (${formatInches(ceilingHeight)} in).`
    );
  }

  const windowWidth = valueFor("windowWidth");
  const windowLeftDistance = valueFor("windowLeftDistance");
  const windowRightDistance = valueFor("windowRightDistance");
  if (allKnown(windowWidth, wallWidth)) {
    const knownWindowDistances = [windowLeftDistance, windowRightDistance]
      .filter((value) => value !== null);
    const windowExtent = knownWindowDistances.reduce((total, value) => total + value, windowWidth);
    if (exceeds(windowExtent, wallWidth)) {
      const extentDescription = knownWindowDistances.length
        ? `Window width plus the known wall distance${knownWindowDistances.length === 1 ? "" : "s"} total ${formatInches(windowExtent)} in`
        : `Window width (${formatInches(windowWidth)} in)`;
      addWarning(
        "windowWidth",
        `${extentDescription}, exceeding the ${formatInches(wallWidth)} in wall width.`
      );
    }
  }

  const windowHeight = valueFor("windowHeight");
  const sillHeight = valueFor("sillHeight");
  if (allKnown(windowHeight, sillHeight, ceilingHeight)) {
    const windowTop = sillHeight + windowHeight;
    if (exceeds(windowTop, ceilingHeight)) {
      addWarning(
        "windowHeight",
        `Sill height plus window height reaches ${formatInches(windowTop)} in, exceeding the ${formatInches(ceilingHeight)} in ceiling height.`
      );
    }
  }

  const fireplaceWidth = valueFor("fireplaceWidth");
  if (allKnown(fireplaceWidth, wallWidth) && exceeds(fireplaceWidth, wallWidth)) {
    addWarning(
      "fireplaceWidth",
      `Fireplace opening width (${formatInches(fireplaceWidth)} in) exceeds the ${formatInches(wallWidth)} in wall width.`
    );
  }

  const fireplaceHeight = valueFor("fireplaceHeight");
  if (allKnown(fireplaceHeight, ceilingHeight) && exceeds(fireplaceHeight, ceilingHeight)) {
    addWarning(
      "fireplaceHeight",
      `Fireplace opening height (${formatInches(fireplaceHeight)} in) exceeds the ${formatInches(ceilingHeight)} in ceiling height.`
    );
  }

  const mantelWidth = valueFor("mantelWidth");
  if (allKnown(mantelWidth, wallWidth) && exceeds(mantelWidth, wallWidth)) {
    addWarning(
      "mantelWidth",
      `Mantel width (${formatInches(mantelWidth)} in) exceeds the ${formatInches(wallWidth)} in wall width.`
    );
  }

  const mantelHeight = valueFor("mantelHeight");
  if (allKnown(mantelHeight, ceilingHeight) && exceeds(mantelHeight, ceilingHeight)) {
    addWarning(
      "mantelHeight",
      `Mantel height (${formatInches(mantelHeight)} in) exceeds the ${formatInches(ceilingHeight)} in ceiling height.`
    );
  }

  const fireplaceLeftWidth = valueFor("fireplaceLeftWidth");
  const fireplaceRightWidth = valueFor("fireplaceRightWidth");
  if (
    allKnown(fireplaceLeftWidth, fireplaceWidth, fireplaceRightWidth, wallWidth)
    && !exceeds(fireplaceWidth, wallWidth)
  ) {
    const fireplaceEnvelope = fireplaceLeftWidth + fireplaceWidth + fireplaceRightWidth;
    if (exceeds(fireplaceEnvelope, wallWidth)) {
      addWarning(
        "fireplaceWidth",
        `Available widths on both sides plus the fireplace opening total ${formatInches(fireplaceEnvelope)} in, exceeding the ${formatInches(wallWidth)} in wall width.`
      );
    }
  }

  return warnings;
}

export function normalizeProject(candidate, options = {}) {
  const now = Number(options.now) || Date.now();
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const sourceSchemaVersion = Math.max(1, Number(source.schemaVersion) || 1);
  let category = getCategory(source.category);
  const layout = getLayout(category.id, source.layout);
  let selectedStyle = getStyle(category.id, source.style);
  const sourceProductSelected = typeof source.productSelected === "boolean"
    ? source.productSelected
    : sourceSchemaVersion < GUIDED_PROJECT_SCHEMA_VERSION && Boolean(source.category);
  if (sourceProductSelected && !getProductChoiceForSelection(category.id, selectedStyle.id)) {
    const preferredSelection = category.id === "bookcase" && selectedStyle.id === "tv-wall-cabinets"
      ? { categoryId: "tv-unit", styleId: "framed-tv-wall" }
      : {
          categoryId: category.id,
          styleId: {
            "bookcase": "cabinet-base-shelves",
            "tv-unit": "framed-tv-wall",
            "floating-storage": "floating-drawer-bank",
            "window-storage": "window-seat-storage",
            "radiator-cover": "clean-slat-cover"
          }[category.id]
        };
    category = getCategory(preferredSelection.categoryId);
    selectedStyle = getStyle(category.id, preferredSelection.styleId);
  }
  const compatible = getCompatibleDetails(category.id, selectedStyle.id);
  const fallback = createProject({
    now,
    category: category.id,
    projectId: typeof source.projectId === "string" ? source.projectId : undefined,
    projectName: typeof source.projectName === "string" ? source.projectName : undefined
  });
  const fields = getMeasurementFields(category.id, layout?.id);
  const inputMeasurements = source.measurements && typeof source.measurements === "object" ? source.measurements : {};
  const measurements = {};

  for (const field of fields) {
    const raw = Object.hasOwn(inputMeasurements, field.id) ? inputMeasurements[field.id] : field.defaultValue;
    if (field.type === "select") {
      const allowed = field.values.map((option) => option.value);
      measurements[field.id] = allowed.includes(String(raw)) ? String(raw) : field.defaultValue;
      continue;
    }
    const parsed = parseInches(raw);
    measurements[field.id] = parsed === null ? null : Number(parsed.toFixed(4));
  }

  const preserveIfCompatible = (key, list, defaultId) => {
    const selected = list.find((option) => option.id === source[key]);
    return selected?.id || defaultId;
  };
  const migrateStep = (rawStep) => {
    const step = Math.max(1, Number(rawStep) || 1);
    if (sourceSchemaVersion >= GUIDED_PROJECT_SCHEMA_VERSION) return Math.min(5, step);
    if (step === 1) return layout ? 2 : 1;
    return Math.min(5, step + 1);
  };
  const migratedCurrentStep = migrateStep(source.currentStep);
  const migratedMaxVisitedStep = Math.max(
    migratedCurrentStep,
    migrateStep(source.maxVisitedStep || source.currentStep)
  );
  const productSelected = sourceProductSelected;

  const normalized = {
    ...fallback,
    schemaVersion: GUIDED_PROJECT_SCHEMA_VERSION,
    projectId: typeof source.projectId === "string" && /^JQ-[A-Z0-9-]+$/i.test(source.projectId)
      ? source.projectId
      : fallback.projectId,
    projectName: typeof source.projectName === "string" && source.projectName.trim()
      ? source.projectName.trim().slice(0, 80)
      : fallback.projectName,
    currentStep: migratedCurrentStep,
    maxVisitedStep: Math.min(5, migratedMaxVisitedStep),
    category: category.id,
    productSelected,
    layout: layout?.id || null,
    measurements,
    style: selectedStyle.id,
    finish: getFinish(source.finish).id,
    accentFinish: FINISH_OPTIONS.accent.some((option) => option.id === source.accentFinish)
      ? source.accentFinish
      : FINISH_OPTIONS.accent[0].id,
    doorStyle: compatible.doorStyle.length
      ? preserveIfCompatible("doorStyle", compatible.doorStyle, defaultDetails.doorStyle)
      : null,
    hardware: compatible.hardware.length
      ? preserveIfCompatible("hardware", compatible.hardware, defaultDetails.hardware)
      : null,
    lighting: compatible.lighting.length
      ? preserveIfCompatible("lighting", compatible.lighting, defaultDetails.lighting)
      : null,
    baseStyle: compatible.baseStyle.length
      ? preserveIfCompatible("baseStyle", compatible.baseStyle, defaultDetails.baseStyle)
      : null,
    topTreatment: compatible.topTreatment.length
      ? preserveIfCompatible("topTreatment", compatible.topTreatment, defaultDetails.topTreatment)
      : null,
    notes: typeof source.notes === "string" ? source.notes.slice(0, 2000) : "",
    uploadedFiles: Array.isArray(source.uploadedFiles)
      ? source.uploadedFiles.filter((file) => file && typeof file.name === "string").map((file) => ({
        name: file.name.slice(0, 180),
        size: Math.max(0, Number(file.size) || 0),
        type: typeof file.type === "string" ? file.type.slice(0, 100) : ""
      }))
      : [],
    customerDetails: source.customerDetails && typeof source.customerDetails === "object"
      ? deepClone(source.customerDetails)
      : {},
    previewAsset: resolvePreviewAsset(category.id, selectedStyle.id, layout?.id),
    createdAt: typeof source.createdAt === "string" && !Number.isNaN(Date.parse(source.createdAt))
      ? source.createdAt
      : fallback.createdAt,
    updatedAt: new Date(now).toISOString(),
    status: ["draft", "saved", "quote-requested"].includes(source.status) ? source.status : "draft"
  };

  return normalized;
}

export function validateMeasurements(project) {
  const normalized = normalizeProject(project, { now: Date.parse(project?.updatedAt) || Date.now() });
  const fields = getMeasurementFields(normalized.category, normalized.layout);
  const errors = [];
  const warnings = [];
  const values = {};

  if (!normalized.layout) {
    errors.push({ field: "layout", message: "Please choose the room or wall layout that best matches your space." });
  }

  for (const field of fields) {
    const rawValue = normalized.measurements[field.id];
    if (field.type === "select") {
      values[field.id] = rawValue;
      continue;
    }

    const value = parseInches(rawValue);
    values[field.id] = value;
    if (field.required && value === null) {
      errors.push({
        field: field.id,
        message: `Please enter an approximate ${field.label.toLowerCase()} before continuing.`
      });
      continue;
    }
    if (value !== null && (value < field.min || value > field.max)) {
      warnings.push({
        field: field.id,
        message: `${field.label} is outside our usual ${formatInches(field.min)}–${formatInches(field.max)} in range. You can continue and our team will review it.`
      });
    }
  }

  warnings.push(...validateSpatialRelationships(values));

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    values
  };
}

const labelFor = (list, id) => list.find((item) => item.id === id)?.label || "—";

export function buildProjectSummary(project) {
  const normalized = normalizeProject(project, { now: Date.parse(project?.updatedAt) || Date.now() });
  const category = getCategory(normalized.category);
  const layout = getLayout(normalized.category, normalized.layout);
  const selectedStyle = getStyle(normalized.category, normalized.style);
  const selectedProduct = getProductChoiceForSelection(normalized.category, normalized.style);
  const fields = getMeasurementFields(normalized.category, normalized.layout);
  const rows = [
    { key: "product", label: "Product", value: selectedProduct?.label || selectedStyle.label, step: 1 },
    { key: "category", label: "Family", value: category.label, step: 1 },
    { key: "layout", label: "Layout", value: layout?.label || "Not selected", step: 2 }
  ];

  for (const field of fields) {
    const raw = normalized.measurements[field.id];
    if (raw === null || raw === undefined || raw === "") continue;
    const value = field.type === "select"
      ? field.values.find((option) => option.value === raw)?.label || String(raw)
      : `${formatInches(raw)} in`;
    rows.push({ key: field.id, label: field.label, value, step: 3 });
  }

  rows.push(
    { key: "finish", label: "Finish", value: getFinish(normalized.finish).label, step: 4 },
    { key: "accentFinish", label: "Accent / interior", value: getFinish(normalized.accentFinish).label, step: 4 }
  );

  if (normalized.doorStyle) rows.push({ key: "doorStyle", label: "Door style", value: labelFor(DETAIL_OPTIONS.doorStyle, normalized.doorStyle), step: 4 });
  if (normalized.hardware) rows.push({ key: "hardware", label: "Hardware", value: labelFor(DETAIL_OPTIONS.hardware, normalized.hardware), step: 4 });
  if (normalized.lighting) rows.push({ key: "lighting", label: "Lighting", value: labelFor(DETAIL_OPTIONS.lighting, normalized.lighting), step: 4 });
  if (normalized.baseStyle) rows.push({ key: "baseStyle", label: "Installation", value: labelFor(DETAIL_OPTIONS.baseStyle, normalized.baseStyle), step: 4 });
  if (normalized.topTreatment) rows.push({ key: "topTreatment", label: "Top treatment", value: labelFor(DETAIL_OPTIONS.topTreatment, normalized.topTreatment), step: 4 });
  rows.push({ key: "notes", label: "Notes", value: normalized.notes || "—", step: 5 });

  return rows;
}

const parseStoredJson = (storage, key, fallback) => {
  try {
    const raw = storage?.getItem?.(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const writeStoredJson = (storage, key, value) => {
  try {
    storage?.setItem?.(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

export function createProjectStore(storage = globalThis.localStorage) {
  const loadProjects = () => {
    const candidates = parseStoredJson(storage, GUIDED_PROJECTS_STORAGE_KEY, []);
    if (!Array.isArray(candidates)) return [];
    return candidates
      .map((candidate) => normalizeProject(candidate, { now: Date.parse(candidate?.updatedAt) || Date.now() }))
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  };

  const writeProjects = (projects) => writeStoredJson(storage, GUIDED_PROJECTS_STORAGE_KEY, projects);

  return Object.freeze({
    loadDraft() {
      const draft = parseStoredJson(storage, GUIDED_DRAFT_STORAGE_KEY, null);
      return draft ? normalizeProject(draft, { now: Date.parse(draft.updatedAt) || Date.now() }) : null;
    },
    saveDraft(project) {
      return writeStoredJson(storage, GUIDED_DRAFT_STORAGE_KEY, normalizeProject(project));
    },
    clearDraft() {
      try {
        storage?.removeItem?.(GUIDED_DRAFT_STORAGE_KEY);
        return true;
      } catch {
        return false;
      }
    },
    listProjects() {
      return loadProjects().map(deepClone);
    },
    getProject(projectId) {
      const match = loadProjects().find((project) => project.projectId === projectId);
      return match ? deepClone(match) : null;
    },
    saveProject(project, projectName) {
      const normalized = normalizeProject({
        ...project,
        projectName: projectName || project.projectName,
        status: "saved"
      });
      const projects = loadProjects();
      const existingIndex = projects.findIndex((saved) => saved.projectId === normalized.projectId);
      if (existingIndex >= 0) projects.splice(existingIndex, 1, normalized);
      else projects.unshift(normalized);
      return writeProjects(projects) ? deepClone(normalized) : null;
    },
    renameProject(projectId, name) {
      const projects = loadProjects();
      const index = projects.findIndex((project) => project.projectId === projectId);
      if (index < 0 || typeof name !== "string" || !name.trim()) return null;
      projects[index] = normalizeProject({ ...projects[index], projectName: name.trim() });
      return writeProjects(projects) ? deepClone(projects[index]) : null;
    },
    duplicateProject(projectId, options = {}) {
      const source = loadProjects().find((project) => project.projectId === projectId);
      if (!source) return null;
      const now = Number(options.now) || Date.now();
      const copy = normalizeProject({
        ...source,
        projectId: createId(now, options.random),
        projectName: `${source.projectName} Copy`,
        createdAt: new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString(),
        status: "saved"
      }, { now });
      const projects = loadProjects();
      projects.unshift(copy);
      return writeProjects(projects) ? deepClone(copy) : null;
    },
    deleteProject(projectId) {
      const projects = loadProjects();
      const next = projects.filter((project) => project.projectId !== projectId);
      if (next.length === projects.length) return false;
      return writeProjects(next);
    }
  });
}

export { getMeasurementFields };
