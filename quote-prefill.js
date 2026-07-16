import { buildPricingContext } from "./bookcase-pricing.js?v=engine-polish-20260716a";
import {
  getHardwareVariant,
  hardwareFinishOptions,
  hardwareTypeOptions,
  optionLabels
} from "./bookcase-config.js?v=engine-polish-20260716a";

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
  const hardwareSchedule = pricing.bom.hardware?.schedule || [];
  const hardwareVariant = getHardwareVariant(normalizedConfig.hardware);
  const hardwareTypeLabel = hardwareTypeOptions.find((option) => option.value === hardwareVariant?.type)?.label || "";
  const hardwareFinishLabel = hardwareFinishOptions.find((option) => option.value === hardwareVariant?.finish)?.label || "";
  const doorFrontProfile = createFrontProfile(billable.doorsByStyle, optionLabels.doorStyle);
  const drawerFrontProfile = createFrontProfile(billable.drawersByStyle, optionLabels.drawerFrontStyle);
  const legacyHardwareSelection = billable.hardwareUnits > 0 && hardwareVariant
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
  // The exact production schedule is authoritative once direct selections are
  // present. This also keeps legacy-migrated designs honest: their projected
  // token may say “brass knob” while the retained catalog facts identify an
  // exact manufacturer finish such as Aged Brass.
  const hardwareSelection = summarizeHardwareSchedule(hardwareSchedule, legacyHardwareSelection);
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
    hardwareSelections: normalizedConfig.hardwareSelections,
    hardwareSchedule,
    hardwareCatalogVersion: pricing.bom.hardware?.catalogVersion || normalizedConfig.hardwareSelections?.catalogVersion || null,
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
      ...(hardwareSchedule.length ? {
        hardwareSchedule: formatHardwareSchedule(hardwareSchedule),
        hardwareCatalogVersion: pricing.bom.hardware?.catalogVersion || normalizedConfig.hardwareSelections?.catalogVersion || "",
        hardwareSourceLinks: formatHardwareSourceLinks(hardwareSchedule)
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

function formatHardwareSchedule(schedule) {
  // This hidden handoff is deliberately machine-readable and complete. The
  // visible quote summary formats the same schedule for people without
  // discarding exact IDs, placement, verification, or warning metadata.
  return JSON.stringify(schedule);
}

const HARDWARE_CATEGORY_LABELS = Object.freeze({
  round_knob: "Round Knob",
  t_bar_knob: "T-Bar Knob",
  d_handle_pull: "D-Handle Pull",
  bar_pull: "Bar Pull",
  cup_pull: "Cup Pull",
  edge_pull: "Edge Pull",
  appliance_pull: "Appliance Pull",
  cabinet_latch: "Cabinet Latch"
});

function summarizeHardwareSchedule(schedule, fallback) {
  const entries = Array.isArray(schedule)
    ? schedule.filter((entry) => Number.isFinite(entry?.quantity) && entry.quantity > 0)
    : [];
  if (!entries.length) return fallback;

  const variants = new Map();
  for (const entry of entries) {
    const id = entry.variantId || "unknown";
    const existing = variants.get(id);
    if (existing) {
      existing.count += entry.quantity;
    } else {
      variants.set(id, { entry, count: entry.quantity });
    }
  }

  const grouped = [...variants.values()];
  const categories = unique(grouped.map(({ entry }) => entry.category).filter(Boolean));
  const finishes = unique(grouped.map(({ entry }) => entry.finish).filter(Boolean));
  const finishIds = unique(grouped.map(({ entry }) => entry.finishVariantId).filter(Boolean));
  const total = grouped.reduce((sum, item) => sum + item.count, 0);
  const typeLabel = categories.length === 1
    ? HARDWARE_CATEGORY_LABELS[categories[0]] || formatProfileId(categories[0])
    : "Mixed";
  const finishLabel = finishes.length === 1 ? finishes[0] : "Mixed";

  if (grouped.length === 1) {
    const { entry } = grouped[0];
    return {
      id: entry.variantId,
      label: formatExactHardwareIdentity(entry),
      type: entry.category || fallback?.type || "hardware",
      typeLabel,
      finish: entry.finishVariantId || fallback?.finish || "",
      finishLabel,
      count: total,
      exact: true
    };
  }

  return {
    id: "mixed",
    label: `Mixed exact hardware (${grouped.length} variants)`,
    type: categories.length === 1 ? categories[0] : "mixed",
    typeLabel,
    finish: finishIds.length === 1 ? finishIds[0] : "mixed",
    finishLabel,
    count: total,
    exact: true,
    variantCount: grouped.length
  };
}

function formatExactHardwareIdentity(entry) {
  return [
    entry.brand,
    entry.family,
    entry.size,
    entry.finish,
    entry.manufacturerProductNumber ? `MPN ${entry.manufacturerProductNumber}` : ""
  ].filter(Boolean).join(" · ");
}

function unique(values) {
  return [...new Set(values)];
}

function formatHardwareSourceLinks(schedule) {
  return [...new Set(schedule.flatMap((entry) => (
    entry.links || []
  )).map((link) => link?.url).filter((url) => {
    try {
      return ["https:", "http:"].includes(new URL(String(url)).protocol);
    } catch (error) {
      return false;
    }
  }))].join(" | ");
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

function createFrontProfile(frontsByStyle = {}, labels = {}) {
  const styles = Object.entries(frontsByStyle)
    .filter(([, count]) => Number.isFinite(count) && count > 0)
    .map(([id, count]) => ({
      id,
      label: labels[id] || formatProfileId(id),
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
