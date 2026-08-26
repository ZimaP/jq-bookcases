import {
  CATEGORY_DEFINITIONS,
  DETAIL_OPTIONS,
  FINISH_OPTIONS,
  PUBLIC_CONFIGURATOR_LAYOUT_CHOICES,
  getCategory,
  getCompatibleDetails,
  getFinish,
  getLayout,
  getMeasurementFields,
  getProductChoiceForSelection,
  getStyle,
  isPublicConfiguratorLayout,
  isPublicConfiguratorProduct,
  resolvePreviewAsset
} from "./guided-configurator-data.js?v=customization-ux-v1-20260824a";
import {
  getImmersiveLayout,
  getSmartDimensionDefaults,
  millimetersToInches,
  normalizeSmartDimension
} from "./guided-layout-registry.js?v=ios2";

export const GUIDED_PROJECT_SCHEMA_VERSION = 5;
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
  lighting: DETAIL_OPTIONS.lighting[0].id,
  baseStyle: DETAIL_OPTIONS.baseStyle[0].id,
  topTreatment: DETAIL_OPTIONS.topTreatment[0].id
});

const COMPACT_ACCEPTED_SNAPSHOT_SCHEMA_VERSION = 2;
const REGENERATION_FINGERPRINT_KEYS = Object.freeze([
  "topologyFingerprint",
  "fitFingerprint",
  "descriptorFingerprint",
  "materialFingerprint",
  "cameraFingerprint"
]);
const GUIDED_ACCEPTED_PERSISTENCE_KIND = "guided-accepted-project";
const GUIDED_ACCEPTED_PERSISTENCE_SCHEMA_VERSION = 1;

const LEGACY_MEASUREMENT_ALIASES_BY_LAYOUT = Object.freeze({
  "center-recess": Object.freeze({
    projectionWidth: "nicheWidth",
    projectionHeight: "nicheHeight",
    projectionDepth: "nicheDepth"
  })
});

function normalizeMeasurementsForLayout(categoryId, layoutId, candidate = {}) {
  const input = candidate && typeof candidate === "object" ? candidate : {};
  const legacyAliases = LEGACY_MEASUREMENT_ALIASES_BY_LAYOUT[layoutId] || {};
  const result = {};
  for (const field of getMeasurementFields(categoryId, layoutId)) {
    const legacyField = legacyAliases[field.id];
    const raw = Object.hasOwn(input, field.id)
      ? input[field.id]
      : legacyField && Object.hasOwn(input, legacyField)
        ? input[legacyField]
        : field.defaultValue;
    if (field.type === "select") {
      const allowed = field.values.map((option) => option.value);
      result[field.id] = allowed.includes(String(raw)) ? String(raw) : field.defaultValue;
    } else {
      const parsed = parseInches(raw);
      result[field.id] = parsed === null ? null : Number(parsed.toFixed(4));
    }
  }
  return result;
}

function createDefaultLayoutStates(categoryId) {
  return Object.fromEntries(PUBLIC_CONFIGURATOR_LAYOUT_CHOICES.map((layout) => {
    const measurements = normalizeMeasurementsForLayout(categoryId, layout.id);
    if (categoryId === "radiator-cover" && layout.id === "window-wall") {
      measurements.radiatorBelowWindow = "yes";
      measurements.windowWidth = 60;
      measurements.sillHeight = 32;
    }
    return [layout.id, {
      measurements,
      smartDimensions: getSmartDimensionDefaults(layout.id)
    }];
  }));
}

function normalizeLayoutStates(categoryId, selectedLayoutId, activeMeasurements, candidate = {}) {
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const result = deepClone(source);
  for (const layout of PUBLIC_CONFIGURATOR_LAYOUT_CHOICES) {
    const previous = source[layout.id] && typeof source[layout.id] === "object" ? source[layout.id] : {};
    const previousMeasurements = previous.measurements && typeof previous.measurements === "object"
      ? previous.measurements
      : {};
    const measurementSource = layout.id === selectedLayoutId
      ? { ...previousMeasurements, ...(activeMeasurements && typeof activeMeasurements === "object" ? activeMeasurements : {}) }
      : previousMeasurements;
    const dimensionSource = previous.smartDimensions && typeof previous.smartDimensions === "object"
      ? previous.smartDimensions
      : {};
    const defaults = getSmartDimensionDefaults(layout.id);
    const smartDimensions = Object.fromEntries(Object.entries(defaults).map(([controlId, nativeValue]) => [
      controlId,
      normalizeSmartDimension(layout.id, controlId, dimensionSource[controlId] ?? nativeValue)
    ]));
    result[layout.id] = {
      ...previous,
      measurements: normalizeMeasurementsForLayout(categoryId, layout.id, measurementSource),
      smartDimensions
    };
  }
  return result;
}

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
    productAvailability: options.productSelected === true
      ? isPublicConfiguratorProduct(category.id, selectedStyle.id) ? "available" : "unavailable"
      : "unselected",
    layout: null,
    layoutAvailability: "unselected",
    measurements: defaultMeasurements(category.id, null),
    layoutStates: createDefaultLayoutStates(category.id),
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
    acceptedSnapshot: null,
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
  const stored = project.layoutStates?.[layoutId]?.measurements;
  const current = stored && typeof stored === "object"
    ? stored
    : project.layout === layoutId && project.measurements && typeof project.measurements === "object"
      ? project.measurements
      : {};
  const fields = getMeasurementFields(category.id, layout?.id);
  const next = Object.fromEntries(fields.map((field) => [
    field.id,
    Object.hasOwn(current, field.id) ? current[field.id] : field.defaultValue
  ]));

  if (category.id === "radiator-cover" && layout?.id === "window-wall") {
    next.radiatorBelowWindow = "yes";
    if (!Object.hasOwn(current, "windowWidth")) next.windowWidth = 60;
    if (!Object.hasOwn(current, "sillHeight")) next.sillHeight = 32;
  }

  if (!["niche-layout", "left-niche", "right-niche"].includes(layout?.id)) return next;

  const wallField = fields.find((field) => field.id === "wallWidth");
  const nicheField = fields.find((field) => field.id === "nicheWidth");
  const wallWidth = parseInches(next.wallWidth) ?? wallField?.defaultValue ?? 0;
  const nicheWidth = parseInches(next.nicheWidth) ?? nicheField?.defaultValue ?? 0;
  const availableReturn = Number(Math.max(0, wallWidth - nicheWidth).toFixed(4));

  if (layout.id === "left-niche") {
    next.leftReturn = availableReturn;
    next.rightReturn = 0;
  } else if (layout.id === "right-niche") {
    next.leftReturn = 0;
    next.rightReturn = availableReturn;
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
  const inputMeasurements = source.measurements && typeof source.measurements === "object" ? source.measurements : {};
  const layoutStates = normalizeLayoutStates(category.id, layout?.id, inputMeasurements, source.layoutStates);
  const measurements = layout?.id && layoutStates[layout.id]
    ? deepClone(layoutStates[layout.id].measurements)
    : normalizeMeasurementsForLayout(category.id, layout?.id, inputMeasurements);
  const fields = getMeasurementFields(category.id, layout?.id);

  const preserveIfCompatible = (key, list, defaultId) => {
    const selected = list.find((option) => option.id === source[key]);
    return selected?.id || defaultId;
  };
  const mapFiveStepPosition = (rawStep) => {
    const step = Math.max(1, Number(rawStep) || 1);
    if (step <= 2) return step;
    if (step <= 4) return 3;
    return 4;
  };
  const migrateStep = (rawStep) => {
    const step = Math.max(1, Number(rawStep) || 1);
    if (sourceSchemaVersion >= 4) return Math.min(4, step);
    if (sourceSchemaVersion >= 2) return mapFiveStepPosition(step);

    const productFirstStep = step === 1
      ? layout ? 2 : 1
      : Math.min(5, step + 1);
    return mapFiveStepPosition(productFirstStep);
  };
  const migratedCurrentStep = migrateStep(source.currentStep);
  const migratedMaxVisitedStep = Math.max(
    migratedCurrentStep,
    migrateStep(source.maxVisitedStep || source.currentStep)
  );
  const productSelected = sourceProductSelected;
  const productAvailability = !productSelected
    ? "unselected"
    : isPublicConfiguratorProduct(category.id, selectedStyle.id) ? "available" : "unavailable";
  const layoutAvailability = !layout
    ? "unselected"
    : isPublicConfiguratorLayout(category.id, selectedStyle.id, layout.id) ? "available" : "unavailable";
  const requiredMeasurementsPresent = Boolean(layout) && getMeasurementFields(category.id, layout.id)
    .every((field) => field.type === "select" || !field.required || parseInches(measurements[field.id]) !== null);
  const workflowPositionLimit = !productSelected || productAvailability === "unavailable"
    ? 1
    : !layout || layoutAvailability === "unavailable" ? 2 : requiredMeasurementsPresent ? 4 : 3;
  const safeCurrentStep = Math.min(workflowPositionLimit, migratedCurrentStep);
  const safeMaxVisitedStep = Math.max(
    safeCurrentStep,
    Math.min(workflowPositionLimit, migratedMaxVisitedStep)
  );

  const normalized = {
    ...fallback,
    schemaVersion: GUIDED_PROJECT_SCHEMA_VERSION,
    projectId: typeof source.projectId === "string" && /^JQ-[A-Z0-9-]+$/i.test(source.projectId)
      ? source.projectId
      : fallback.projectId,
    projectName: typeof source.projectName === "string" && source.projectName.trim()
      ? source.projectName.trim().slice(0, 80)
      : fallback.projectName,
    currentStep: safeCurrentStep,
    maxVisitedStep: safeMaxVisitedStep,
    category: category.id,
    productSelected,
    productAvailability,
    layoutAvailability,
    workflowMigrationSource: ["five-step", "legacy-category-flow"].includes(source.workflowMigrationSource)
      ? source.workflowMigrationSource
      : sourceSchemaVersion < 4
        ? sourceSchemaVersion >= 2 ? "five-step" : "legacy-category-flow"
        : null,
    layout: layout?.id || null,
    measurements,
    layoutStates,
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
    acceptedSnapshot: normalizeAcceptedSnapshot(source.acceptedSnapshot),
    previewAsset: resolvePreviewAsset(category.id, selectedStyle.id, layout?.id),
    createdAt: typeof source.createdAt === "string" && !Number.isNaN(Date.parse(source.createdAt))
      ? source.createdAt
      : fallback.createdAt,
    updatedAt: new Date(now).toISOString(),
    status: ["draft", "saved", "quote-requested"].includes(source.status) ? source.status : "draft"
  };

  return normalized;
}

function normalizeAcceptedSnapshot(candidate) {
  if (!candidate || typeof candidate !== "object") return null;
  const schemaVersion = Number(candidate.schemaVersion);
  if (![1, COMPACT_ACCEPTED_SNAPSHOT_SCHEMA_VERSION].includes(schemaVersion)) return null;
  if (
    typeof candidate.geometryFingerprint !== "string"
    || typeof candidate.selectionFingerprint !== "string"
    || typeof candidate.specificationFingerprint !== "string"
  ) return null;
  if (schemaVersion === 1) {
    return candidate.acceptedSpecification?.accepted === true ? deepClone(candidate) : null;
  }
  if (
    typeof candidate.engineVersion !== "string"
    || typeof candidate.productId !== "string"
    || typeof candidate.layoutId !== "string"
    || !candidate.regeneration
    || REGENERATION_FINGERPRINT_KEYS.some((key) => typeof candidate.regeneration[key] !== "string")
  ) return null;
  return {
    schemaVersion: COMPACT_ACCEPTED_SNAPSHOT_SCHEMA_VERSION,
    engineVersion: candidate.engineVersion,
    specificationSchemaVersion: Number(candidate.specificationSchemaVersion) || 1,
    projectId: typeof candidate.projectId === "string" ? candidate.projectId : null,
    productId: candidate.productId,
    layoutId: candidate.layoutId,
    geometryFingerprint: candidate.geometryFingerprint,
    selectionFingerprint: candidate.selectionFingerprint,
    specificationFingerprint: candidate.specificationFingerprint,
    regeneration: Object.fromEntries(
      REGENERATION_FINGERPRINT_KEYS.map((key) => [key, candidate.regeneration[key]])
    ),
    summary: normalizeAcceptedSummary(candidate.summary)
  };
}

function normalizeAcceptedSummary(candidate) {
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const installations = Array.isArray(source.installations)
    ? source.installations.slice(0, 10).map((installation) => ({
        zoneId: compactString(installation?.zoneId),
        role: compactString(installation?.role),
        casework: {
          width: finiteSummaryNumber(installation?.casework?.width),
          overallHeight: finiteSummaryNumber(installation?.casework?.overallHeight),
          depth: finiteSummaryNumber(installation?.casework?.depth)
        },
        treatments: {
          left: normalizeSummaryTreatment(installation?.treatments?.left, "width"),
          right: normalizeSummaryTreatment(installation?.treatments?.right, "width"),
          base: normalizeSummaryTreatment(installation?.treatments?.base, "height"),
          top: normalizeSummaryTreatment(installation?.treatments?.top, "height")
        }
      }))
    : [];
  const tv = source.tv?.accepted === true ? {
    accepted: true,
    body: {
      width: finiteSummaryNumber(source.tv.body?.width),
      height: finiteSummaryNumber(source.tv.body?.height)
    },
    opening: {
      width: finiteSummaryNumber(source.tv.opening?.width),
      height: finiteSummaryNumber(source.tv.opening?.height)
    }
  } : null;
  return { installations, tv };
}

function normalizeSummaryTreatment(candidate, dimension) {
  if (!candidate || typeof candidate !== "object") return null;
  return {
    kind: compactString(candidate.kind) || "none",
    [dimension]: finiteSummaryNumber(candidate[dimension])
  };
}

function finiteSummaryNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function compactString(value) {
  return typeof value === "string" ? value.slice(0, 80) : null;
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

export function buildProjectSummary(project, options = {}) {
  const normalized = normalizeProject(project, { now: Date.parse(project?.updatedAt) || Date.now() });
  const category = getCategory(normalized.category);
  const layout = getLayout(normalized.category, normalized.layout);
  const selectedStyle = getStyle(normalized.category, normalized.style);
  const selectedProduct = getProductChoiceForSelection(normalized.category, normalized.style);
  const fields = getMeasurementFields(normalized.category, normalized.layout);
  const rows = [
    { key: "projectName", label: "Project name", value: normalized.projectName, step: 4 },
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

  const immersiveLayout = getImmersiveLayout(normalized.layout);
  for (const control of Object.values(immersiveLayout?.geometryControlManifest || {})) {
    const raw = normalized.layoutStates?.[normalized.layout]?.smartDimensions?.[control.id];
    const millimeters = normalizeSmartDimension(normalized.layout, control.id, raw ?? control.nativeMillimeters);
    rows.push({
      key: `smartDimension:${control.id}`,
      label: control.label,
      value: `${formatInches(millimetersToInches(millimeters))} in · proven model preview`,
      step: 3
    });
  }

  const accepted = options.acceptedSpecification || normalized.acceptedSnapshot?.acceptedSpecification || null;
  const compactAccepted = normalized.acceptedSnapshot?.summary || null;
  const acceptedQuote = options.acceptedQuote?.integrity?.verified === true
    ? options.acceptedQuote
    : null;
  if (accepted?.accepted || compactAccepted || acceptedQuote) {
    const installations = accepted?.accepted
      ? Array.isArray(accepted.fit?.installations)
        ? accepted.fit.installations
        : accepted.fit?.accepted ? [accepted.fit] : []
      : compactAccepted?.installations || [];
    if (installations.length) {
      const fittedSizes = installations.map((installation) => {
        const label = installations.length > 1 ? `${installation.role || installation.zoneId}: ` : "";
        return `${label}${formatInches(installation.casework?.width)} × ${formatInches(installation.casework?.overallHeight)} × ${formatInches(installation.casework?.depth)} in`;
      });
      rows.push({ key: "fittedSize", label: "Accepted fitted size", value: fittedSizes.join(" · "), step: 3 });
      const treatments = installations.map((installation) => {
        const left = installation.treatments?.left;
        const right = installation.treatments?.right;
        const base = installation.treatments?.base;
        const top = installation.treatments?.top;
        const label = installations.length > 1 ? `${installation.role || installation.zoneId}: ` : "";
        return `${label}left ${formatTreatment(left)}, right ${formatTreatment(right)}, base ${formatTreatment(base)}, top ${formatTreatment(top)}`;
      });
      rows.push({ key: "fitTreatments", label: "Installation treatments", value: treatments.join(" · "), step: 3 });
    }
    const tv = accepted?.accepted ? accepted.product?.tv : compactAccepted?.tv;
    if (tv?.accepted) {
      rows.push({
        key: "tvBody",
        label: "Accepted TV body",
        value: `${formatInches(tv.body?.width)} × ${formatInches(tv.body?.height)} in`,
        step: 3
      });
      rows.push({
        key: "tvOpening",
        label: "Generated TV opening",
        value: `${formatInches(tv.opening?.width)} × ${formatInches(tv.opening?.height)} in`,
        step: 3
      });
    }
    rows.push({
      key: "geometryFingerprint",
      label: "Geometry reference",
      value: acceptedQuote?.identity?.geometryFingerprint
        || accepted?.geometryFingerprint
        || normalized.acceptedSnapshot?.geometryFingerprint,
      step: 4
    });
    const acceptedPricing = acceptedQuote?.pricing || accepted?.pricing;
    const preliminaryTotal = Number(acceptedPricing?.total);
    rows.push({
      key: "pricing",
      label: "Preliminary price",
      value: acceptedPricing?.available === true && Number.isFinite(preliminaryTotal)
        ? new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0
          }).format(preliminaryTotal)
        : "Design review required",
      step: 4
    });
    if (acceptedQuote?.pricing?.fingerprint) {
      rows.push({
        key: "pricingFingerprint",
        label: "Pricing reference",
        value: acceptedQuote.pricing.fingerprint,
        step: 4
      });
    }
    const acceptedWarnings = acceptedQuote?.warnings?.items || accepted?.warnings;
    if (Array.isArray(acceptedWarnings) && acceptedWarnings.length) {
      rows.push({
        key: "warnings",
        label: "Accepted warnings",
        value: acceptedWarnings
          .map((warning) => `${warning.message || "Design review note"} (${warning.code || "REVIEW"})`)
          .join(" · "),
        step: 4
      });
    } else if (acceptedQuote) {
      rows.push({ key: "warnings", label: "Accepted warnings", value: "None", step: 4 });
    }
    if (acceptedQuote?.warnings?.fingerprint) {
      rows.push({
        key: "warningsFingerprint",
        label: "Warnings reference",
        value: acceptedQuote.warnings.fingerprint,
        step: 4
      });
    }
    if (acceptedQuote?.bom) {
      rows.push({
        key: "bom",
        label: "Accepted BOM",
        value: formatQuoteBom(acceptedQuote.bom),
        step: 4
      });
      rows.push({
        key: "bomFingerprint",
        label: "BOM reference",
        value: acceptedQuote.bom.fingerprint,
        step: 4
      });
      rows.push({
        key: "quoteFingerprint",
        label: "Verified quote reference",
        value: acceptedQuote.integrity.quoteFingerprint,
        step: 4
      });
    }
  }

  rows.push(
    { key: "finish", label: "Finish", value: getFinish(normalized.finish).label, step: 3 },
    { key: "accentFinish", label: "Accent / interior", value: getFinish(normalized.accentFinish).label, step: 3 }
  );

  if (normalized.doorStyle) rows.push({ key: "doorStyle", label: "Door style", value: labelFor(DETAIL_OPTIONS.doorStyle, normalized.doorStyle), step: 3 });
  if (normalized.hardware) rows.push({ key: "hardware", label: "Hardware", value: labelFor(DETAIL_OPTIONS.hardware, normalized.hardware), step: 3 });
  if (normalized.lighting) rows.push({ key: "lighting", label: "Lighting", value: labelFor(DETAIL_OPTIONS.lighting, normalized.lighting), step: 3 });
  if (normalized.baseStyle) rows.push({ key: "baseStyle", label: "Installation", value: labelFor(DETAIL_OPTIONS.baseStyle, normalized.baseStyle), step: 3 });
  if (normalized.topTreatment) rows.push({ key: "topTreatment", label: "Top treatment", value: labelFor(DETAIL_OPTIONS.topTreatment, normalized.topTreatment), step: 3 });
  rows.push({ key: "notes", label: "Notes", value: normalized.notes || "—", step: 4 });
  const customerLabels = {
    fullName: "Customer name",
    email: "Email",
    phone: "Phone",
    zip: "ZIP code",
    address: "Installation address",
    timeline: "Preferred timeline",
    contactMethod: "Preferred contact"
  };
  for (const [key, label] of Object.entries(customerLabels)) {
    const value = normalized.customerDetails?.[key];
    if (typeof value === "string" && value.trim()) {
      rows.push({ key: `customer:${key}`, label, value: value.trim(), step: 4 });
    }
  }

  return rows;
}

function formatTreatment(treatment) {
  if (!treatment) return "none";
  const amount = Number(treatment.width ?? treatment.height);
  return Number.isFinite(amount) && amount > 0
    ? `${String(treatment.kind || "treatment").replaceAll("-", " ")} ${formatInches(amount)} in`
    : String(treatment.kind || "none").replaceAll("-", " ");
}

function formatQuoteBom(bom) {
  const roles = Object.entries(bom.byRole || {})
    .filter(([, count]) => Number(count) > 0)
    .map(([role, count]) => `${role.replaceAll("_", " ")} ${count}`)
    .join(", ");
  const billable = Number(bom.billableComponentCount) || 0;
  const physical = Number(bom.componentCount) || 0;
  const customerEquipment = Number(bom.customerEquipmentCount) || 0;
  const ownership = customerEquipment
    ? ` (${physical} physical; ${customerEquipment} customer equipment)`
    : "";
  return `${billable} billable components${ownership}${roles ? ` · ${roles}` : ""}`;
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

  const normalizeAcceptedPersistence = (preparation, overrides = {}) => {
    if (
      preparation?.accepted !== true
      || preparation?.persistable !== true
      || preparation?.kind !== GUIDED_ACCEPTED_PERSISTENCE_KIND
      || preparation?.schemaVersion !== GUIDED_ACCEPTED_PERSISTENCE_SCHEMA_VERSION
      || !preparation.project
      || !preparation.snapshot
    ) return null;
    const snapshot = preparation.snapshot;
    const source = preparation.project;
    if (
      source.projectId !== snapshot.projectId
      || source.acceptedSnapshot?.specificationFingerprint !== snapshot.specificationFingerprint
      || source.acceptedSnapshot?.geometryFingerprint !== snapshot.geometryFingerprint
      || source.acceptedSnapshot?.selectionFingerprint !== snapshot.selectionFingerprint
    ) return null;
    const normalized = normalizeProject({ ...source, ...overrides, acceptedSnapshot: snapshot });
    return normalized.acceptedSnapshot?.specificationFingerprint === snapshot.specificationFingerprint
      ? normalized
      : null;
  };

  return Object.freeze({
    loadDraft() {
      const draft = parseStoredJson(storage, GUIDED_DRAFT_STORAGE_KEY, null);
      return draft ? normalizeProject(draft, { now: Date.parse(draft.updatedAt) || Date.now() }) : null;
    },
    saveDraft(project) {
      return writeStoredJson(storage, GUIDED_DRAFT_STORAGE_KEY, normalizeProject(project));
    },
    saveAcceptedDraft(preparation) {
      const normalized = normalizeAcceptedPersistence(preparation);
      return normalized ? writeStoredJson(storage, GUIDED_DRAFT_STORAGE_KEY, normalized) : false;
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
    saveAcceptedProject(preparation, projectName) {
      const normalized = normalizeAcceptedPersistence(preparation, {
        projectName: projectName || preparation?.project?.projectName,
        status: "saved"
      });
      if (!normalized) return null;
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
