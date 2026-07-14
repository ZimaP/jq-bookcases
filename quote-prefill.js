import { buildPricingContext } from "./bookcase-pricing.js?v=configurator-refine-20260714a";
import {
  getHardwareVariant,
  hardwareFinishOptions,
  hardwareTypeOptions,
  optionLabels
} from "./bookcase-config.js?v=configurator-refine-20260714a";

const storedLayoutLabels = Object.freeze({
  "lower-cabinets": "Full Bookcase",
  "classic-open": "Open Shelves",
  "media-wall": "Media Wall",
  "library-wall": "Library Wall",
  "display-wall": "Display Wall",
  "glass-library": "Glass Door Library",
  "desk-niche": "Desk Center",
  "feature-wall": "Fireplace Surround",
  "asymmetric-modern": "Asymmetrical Modern",
  "tall-storage": "Tall Storage + Shelves"
});

const storedLayoutTypes = Object.freeze({
  lower_cabinets: "lower-cabinets",
  classic: "classic-open",
  media_wall: "media-wall",
  library: "library-wall",
  display_wall: "display-wall",
  glass_library: "glass-library",
  desk_niche: "desk-niche",
  feature_wall: "feature-wall",
  asymmetric: "asymmetric-modern",
  tall_storage: "tall-storage"
});

export function resolveStoredLayout(config = {}) {
  const exactPreset = storedLayoutLabels[config.layoutPreset] ? config.layoutPreset : "";
  if (exactPreset) return { value: exactPreset, label: storedLayoutLabels[exactPreset] };
  const structuralPreset = storedLayoutTypes[config.layoutType] || "";
  return {
    value: structuralPreset,
    label: structuralPreset ? `${storedLayoutLabels[structuralPreset]} · Customized` : "Custom layout"
  };
}

export function createQuotePrefill(config = {}) {
  const layout = resolveStoredLayout(config);
  const pricing = buildPricingContext(config);
  if (!pricing.valid) {
    const firstIssue = pricing.errors?.[0]?.message || "A valid generated layout is required.";
    throw new RangeError(`Cannot prepare quote details: ${firstIssue}`);
  }
  const normalizedConfig = pricing.selections;
  const billable = pricing.billableQuantities;
  const hasLowerCabinets = pricing.bom.openings.lowerStorageCount > 0;
  const hardwareVariant = getHardwareVariant(normalizedConfig.hardware);
  const hardwareTypeLabel = hardwareTypeOptions.find((option) => option.value === hardwareVariant?.type)?.label || "";
  const hardwareFinishLabel = hardwareFinishOptions.find((option) => option.value === hardwareVariant?.finish)?.label || "";
  const doorFrontProfile = createDoorFrontProfile(billable.doorsByStyle);
  const drawerFrontProfile = billable.generatedDrawerFronts > 0
    ? { id: normalizedConfig.drawerFrontStyle, label: optionLabels.drawerFrontStyle[normalizedConfig.drawerFrontStyle], count: billable.generatedDrawerFronts }
    : null;
  const hardwareSelection = billable.hardwareUnits > 0 && hardwareVariant
    ? {
        id: hardwareVariant.value,
        label: hardwareVariant.label,
        type: hardwareVariant.type,
        typeLabel: hardwareTypeLabel,
        finish: hardwareVariant.finish,
        finishLabel: hardwareFinishLabel,
        count: billable.hardwareUnits
      }
    : null;
  const customBmColor = [normalizedConfig.customPaintColor, normalizedConfig.customPaintCode].filter(Boolean).join(" ");
  const paintSelection = normalizedConfig.paintSelection;
  const room = config.centerOpening
    ? "Media Wall"
    : config.featureOpening
      ? "Fireplace Wall"
      : config.deskOpening
        ? "Home Office"
        : ["library", "glass_library", "tall_storage"].includes(config.layoutType)
          ? "Library"
          : "Living Room";
  const options = [];
  if (billable.compatibleLightingComponents > 0) options.push("lighting");
  if (config.crownStyle && config.crownStyle !== "none") options.push("crown");
  if (billable.hardwareUnits > 0) options.push("hardware");
  if (pricing.bom.shelves.adjustableCount > 0) options.push("shelves");
  if (config.centerOpening) options.push("tv");
  if (config.featureOpening) options.push("fireplace");

  return {
    layoutLabel: layout.label,
    price: pricing.total,
    constructionProfile: normalizedConfig.constructionProfile,
    layoutMetadata: cloneLayoutMetadata(normalizedConfig.layoutMetadata),
    billableQuantities: billable,
    frontProfiles: { door: doorFrontProfile, drawer: drawerFrontProfile },
    hardwareSelection,
    customPaint: pricing.customPaint.selected,
    paintBrand: paintSelection?.brand || (normalizedConfig.finish === "custom_bm" ? "Benjamin Moore" : ""),
    paintCode: paintSelection?.code || normalizedConfig.customPaintCode || "",
    paintName: paintSelection?.name || normalizedConfig.customPaintColor || "",
    paintCollection: paintSelection?.collections?.join(", ") || "",
    paintPreviewHex: paintSelection?.previewHex || normalizedConfig.customPaintHex || "",
    paintCatalogVersion: paintSelection?.catalogVersion || "",
    fields: {
      room,
      wallWidth: config.width ? `${config.width}"` : "",
      ceilingHeight: config.height ? `${config.height}"` : "",
      bookcaseHeight: config.height ? `${config.height}"` : "",
      depth: config.depth ? `${config.depth}"` : "",
      lowerCabinets: hasLowerCabinets ? "Yes" : "No",
      layout: layout.value,
      ...(doorFrontProfile ? { doorFrontProfile: doorFrontProfile.label } : {}),
      ...(drawerFrontProfile ? { drawerFrontProfile: drawerFrontProfile.label } : {}),
      ...(hardwareSelection ? {
        hardwareType: hardwareSelection.typeLabel,
        hardwareFinish: hardwareSelection.finishLabel,
        hardwareVariant: hardwareSelection.label
      } : {}),
      paintFinish: config.finish || "",
      customBmColor,
      customPaint: pricing.customPaint.selected ? "Yes" : "No",
      paintBrand: paintSelection?.brand || (normalizedConfig.finish === "custom_bm" ? "Benjamin Moore" : ""),
      paintCode: paintSelection?.code || normalizedConfig.customPaintCode || "",
      paintName: paintSelection?.name || normalizedConfig.customPaintColor || "",
      paintCollection: paintSelection?.collections?.join(", ") || "",
      paintPreviewHex: paintSelection?.previewHex || normalizedConfig.customPaintHex || "",
      paintCatalogVersion: paintSelection?.catalogVersion || ""
    },
    options
  };
}

function cloneLayoutMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
    key,
    Array.isArray(entry)
      ? entry.map((item) => item && typeof item === "object" && !Array.isArray(item) ? { ...item } : item)
      : entry
  ]));
}

function createDoorFrontProfile(doorsByStyle = {}) {
  const styles = Object.entries(doorsByStyle)
    .filter(([, count]) => Number.isFinite(count) && count > 0)
    .map(([id, count]) => ({
      id,
      label: optionLabels.doorStyle[id] || formatProfileId(id),
      count
    }));
  if (!styles.length) return null;
  if (styles.length === 1) return styles[0];
  return {
    id: "mixed",
    label: styles.map((style) => `${style.label} (${style.count})`).join(" + "),
    count: styles.reduce((total, style) => total + style.count, 0),
    styles
  };
}

function formatProfileId(value) {
  return String(value || "unknown")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
