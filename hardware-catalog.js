export const HARDWARE_CATALOG_VERSION = "2026.07.14-mvp.1";
export const HARDWARE_CATALOG_URL = `./data/hardware/jq-hardware-catalog.seed.json?v=${HARDWARE_CATALOG_VERSION}`;
export const HARDWARE_SELECTION_SCHEMA_VERSION = 1;

const DEFAULT_LEGACY_HARDWARE_TOKEN = "brass_knob";
const LEGACY_HARDWARE_TOKENS = Object.freeze([
  "brass_knob",
  "brass_pull",
  "matte_black_knob",
  "matte_black_pull",
  "polished_nickel_pull",
  "polished_nickel_knob",
  "unlacquered_brass_knob",
  "satin_nickel_pull"
]);

export const LEGACY_HARDWARE_VARIANT_IDS = deepFreeze({
  brass_knob: "armac-queslett-knob__armac-qk34__armac-bel",
  matte_black_knob: "armac-queslett-knob__armac-qk34__armac-mbl",
  brass_pull: "atlas-oskar-pull__atlas-oskar-6-3125__atlas-wb",
  matte_black_pull: "atlas-oskar-pull__atlas-oskar-6-3125__atlas-bl",
  polished_nickel_pull: "atlas-oskar-pull__atlas-oskar-6-3125__atlas-pn",
  polished_nickel_knob: "armac-queslett-knob__armac-qk34__armac-pnp",
  unlacquered_brass_knob: "armac-queslett-knob__armac-qk34__armac-pbul",
  satin_nickel_pull: "atlas-oskar-pull__atlas-oskar-6-3125__atlas-brn"
});

const LEGACY_ARMAC_SOURCE = Object.freeze({
  id: "src-armac-queslett-knob-page",
  publisher: "Armac Martin",
  title: "Queslett Cabinet Knob",
  type: "official_product_page",
  url: "https://www.armacmartin.com/products/queslett-cabinet-knob",
  accessedAt: "2026-07-14"
});

const LEGACY_ATLAS_SOURCES = Object.freeze([
  Object.freeze({
    id: "src-atlas-oskar-page",
    publisher: "Atlas Homewares",
    title: "Oskar Pull",
    type: "official_product_page",
    url: "https://www.atlashomewares.com/oskar-pull.html",
    accessedAt: "2026-07-14"
  }),
  Object.freeze({
    id: "src-atlas-2026-price-list",
    publisher: "Atlas Homewares",
    title: "Atlas 2026 Price List",
    type: "official_price_list_pdf",
    url: "https://www.atlashomewares.com/media/documents/2026_Atlas_Price_List.pdf",
    accessedAt: "2026-07-14",
    effectiveDate: "2026-06-01"
  })
]);

const LEGACY_ARMAC_FAMILY = deepFreeze({
  id: "armac-queslett-knob",
  brandId: "armac-martin",
  collectionId: "armac-queslett",
  name: "Queslett Cabinet Knob",
  category: "round_knob",
  styles: ["traditional", "transitional", "luxury"],
  material: "solid brass",
  description: "A matching luxury knob family that enables coordinated knob-and-cup schedules.",
  compatiblePlacements: ["door", "drawer_front"],
  recommendedApplications: ["paired doors", "small drawers", "mixed knob-and-pull schedules"],
  compatibilityRestrictions: [],
  priceTier: "luxury",
  regions: ["US", "CA"],
  status: "active",
  lastVerifiedAt: "2026-07-14",
  verificationCaveat: null,
  imageUsage: {
    status: "permission_required",
    productionRule: "Do not hotlink or copy manufacturer photography. Use a locally generated neutral render unless written permission is recorded."
  },
  asset: {
    strategy: "C",
    accuracy: "dimensionally_accurate_parametric_proxy",
    exactGeometryLicensed: false,
    cadAvailability: "not_verified",
    productionRule: "Use verified dimensions; if a required dimension is absent, downgrade to a neutral placeholder and exclude from the accurate-3D filter."
  },
  sourceIds: [LEGACY_ARMAC_SOURCE.id]
});

const LEGACY_ATLAS_FAMILY = deepFreeze({
  id: "atlas-oskar-pull",
  brandId: "atlas-homewares",
  collectionId: "atlas-oskar",
  name: "Oskar Pull",
  category: "d_handle_pull",
  styles: ["transitional", "contemporary"],
  material: "zinc alloy",
  description: "A clean curved pull in a broad graduated size family and six manufacturer finishes.",
  compatiblePlacements: ["door", "drawer_front"],
  recommendedApplications: ["shaker fronts", "slim shaker", "transitional built-ins", "home offices"],
  compatibilityRestrictions: [],
  priceTier: "practical_to_mid-premium",
  regions: ["US", "CA"],
  status: "active",
  lastVerifiedAt: "2026-07-14",
  verificationCaveat: null,
  imageUsage: {
    status: "permission_required",
    productionRule: "The official 2026 price-list policy requests prior approval for Atlas trademark and image use. Use custom neutral renders unless permission is documented."
  },
  asset: {
    strategy: "C",
    accuracy: "dimensionally_accurate_parametric_proxy",
    exactGeometryLicensed: false,
    cadAvailability: "not_verified",
    productionRule: "Use verified dimensions; if a required dimension is absent, downgrade to a neutral placeholder and exclude from the accurate-3D filter."
  },
  sourceIds: LEGACY_ATLAS_SOURCES.map((source) => source.id)
});

const LEGACY_ARMAC_SIZE = deepFreeze({
  id: "armac-qk34",
  label: "34 mm",
  manufacturerSizeCode: "34",
  dimensionsMm: { diameter: 34, projection: 32, baseDiameter: 12, centerToCenter: 0 },
  mounting: { holeCount: 1 }
});

const LEGACY_ATLAS_SIZE = deepFreeze({
  id: "atlas-oskar-6-3125",
  label: "6 5/16 in c.c.",
  manufacturerSizeCode: "A104",
  dimensionsMm: {
    centerToCenter: 160.337,
    overallLength: 180.975,
    width: 9.525,
    projection: 31.75,
    baseDiameter: 22.225
  },
  mounting: { holeCount: 2, screw: "M4" }
});

const REFERENCE_PRICE_NOTE = "Reference/list price only; final hardware price is confirmed in the JQ quote.";
const ACTIVE_AVAILABILITY = Object.freeze({
  status: "active_or_orderable",
  checkedAt: "2026-07-14",
  leadTimeNote: null
});

function embeddedLegacySnapshot({
  variantId,
  family,
  brand,
  collection,
  size,
  finish,
  canonicalFinish,
  manufacturerProductNumber,
  price,
  priceSourceId,
  sources
}) {
  return buildSnapshotRecord({
    catalogVersion: HARDWARE_CATALOG_VERSION,
    brand,
    collection,
    family,
    size,
    finish,
    canonicalFinish,
    exactVariant: {
      id: variantId,
      familyId: family.id,
      sizeVariantId: size.id,
      finishVariantId: finish.id,
      manufacturerProductNumber,
      sku: manufacturerProductNumber,
      pricing: {
        mode: "reference_unit",
        currency: "USD",
        amount: price,
        priceBand: null,
        checkedAt: "2026-07-14",
        sourceId: priceSourceId,
        note: REFERENCE_PRICE_NOTE
      },
      availability: ACTIVE_AVAILABILITY,
      productStatus: "active",
      lastVerifiedAt: "2026-07-14",
      sourceIds: sources.map((source) => source.id),
      note: null
    },
    sources
  });
}

const LEGACY_ARMAC_BRAND = Object.freeze({
  id: "armac-martin",
  name: "Armac Martin",
  marketPosition: "luxury",
  regions: ["US", "CA"],
  officialUrl: "https://www.armacmartin.com/",
  logoUsage: "not_included_permission_required"
});
const LEGACY_ARMAC_COLLECTION = Object.freeze({
  id: "armac-queslett",
  brandId: "armac-martin",
  name: "Queslett",
  styles: ["traditional", "transitional", "luxury"]
});
const LEGACY_ATLAS_BRAND = Object.freeze({
  id: "atlas-homewares",
  name: "Atlas Homewares",
  marketPosition: "professional / mid-premium",
  regions: ["US", "CA"],
  officialUrl: "https://www.atlashomewares.com/",
  logoUsage: "not_included_permission_required"
});
const LEGACY_ATLAS_COLLECTION = Object.freeze({
  id: "atlas-oskar",
  brandId: "atlas-homewares",
  name: "Oskar",
  styles: ["transitional", "contemporary"]
});

export const LEGACY_VARIANT_SNAPSHOTS = deepFreeze({
  brass_knob: embeddedLegacySnapshot({
    variantId: LEGACY_HARDWARE_VARIANT_IDS.brass_knob,
    family: LEGACY_ARMAC_FAMILY,
    brand: LEGACY_ARMAC_BRAND,
    collection: LEGACY_ARMAC_COLLECTION,
    size: LEGACY_ARMAC_SIZE,
    finish: {
      id: "armac-bel",
      manufacturerName: "Aged Brass",
      manufacturerCode: "BEL",
      canonicalFinishId: "aged-brass",
      isLivingFinish: true,
      digitalSwatchIsApproximate: true
    },
    canonicalFinish: { id: "aged-brass", label: "Aged Brass", group: "brass_gold", swatch: "#9B7846" },
    manufacturerProductNumber: "QK/KNOBONLY/34/BEL",
    price: 72.3,
    priceSourceId: LEGACY_ARMAC_SOURCE.id,
    sources: [LEGACY_ARMAC_SOURCE]
  }),
  matte_black_knob: embeddedLegacySnapshot({
    variantId: LEGACY_HARDWARE_VARIANT_IDS.matte_black_knob,
    family: LEGACY_ARMAC_FAMILY,
    brand: LEGACY_ARMAC_BRAND,
    collection: LEGACY_ARMAC_COLLECTION,
    size: LEGACY_ARMAC_SIZE,
    finish: {
      id: "armac-mbl",
      manufacturerName: "Matt Black Lacquered",
      manufacturerCode: "MBL",
      canonicalFinishId: "matte-black",
      isLivingFinish: false,
      digitalSwatchIsApproximate: true
    },
    canonicalFinish: { id: "matte-black", label: "Matte Black", group: "black", swatch: "#211F1C" },
    manufacturerProductNumber: "QK/KNOBONLY/34/MBL",
    price: 90.6,
    priceSourceId: LEGACY_ARMAC_SOURCE.id,
    sources: [LEGACY_ARMAC_SOURCE]
  }),
  polished_nickel_knob: embeddedLegacySnapshot({
    variantId: LEGACY_HARDWARE_VARIANT_IDS.polished_nickel_knob,
    family: LEGACY_ARMAC_FAMILY,
    brand: LEGACY_ARMAC_BRAND,
    collection: LEGACY_ARMAC_COLLECTION,
    size: LEGACY_ARMAC_SIZE,
    finish: {
      id: "armac-pnp",
      manufacturerName: "Polished Nickel Plate",
      manufacturerCode: "PNP",
      canonicalFinishId: "polished-nickel",
      isLivingFinish: false,
      digitalSwatchIsApproximate: true
    },
    canonicalFinish: { id: "polished-nickel", label: "Polished Nickel", group: "nickel_chrome", swatch: "#D4D2CA" },
    manufacturerProductNumber: "QK/KNOBONLY/34/PNP",
    price: 79.6,
    priceSourceId: LEGACY_ARMAC_SOURCE.id,
    sources: [LEGACY_ARMAC_SOURCE]
  }),
  unlacquered_brass_knob: embeddedLegacySnapshot({
    variantId: LEGACY_HARDWARE_VARIANT_IDS.unlacquered_brass_knob,
    family: LEGACY_ARMAC_FAMILY,
    brand: LEGACY_ARMAC_BRAND,
    collection: LEGACY_ARMAC_COLLECTION,
    size: LEGACY_ARMAC_SIZE,
    finish: {
      id: "armac-pbul",
      manufacturerName: "Polished Brass Unlacquered",
      manufacturerCode: "PBUL",
      canonicalFinishId: "unlacquered-brass",
      isLivingFinish: true,
      digitalSwatchIsApproximate: true
    },
    canonicalFinish: { id: "unlacquered-brass", label: "Unlacquered Brass", group: "brass_gold", swatch: "#B68D47" },
    manufacturerProductNumber: "QK/KNOBONLY/34/PBUL",
    price: 72.3,
    priceSourceId: LEGACY_ARMAC_SOURCE.id,
    sources: [LEGACY_ARMAC_SOURCE]
  }),
  brass_pull: embeddedLegacySnapshot({
    variantId: LEGACY_HARDWARE_VARIANT_IDS.brass_pull,
    family: LEGACY_ATLAS_FAMILY,
    brand: LEGACY_ATLAS_BRAND,
    collection: LEGACY_ATLAS_COLLECTION,
    size: LEGACY_ATLAS_SIZE,
    finish: {
      id: "atlas-wb",
      manufacturerName: "Warm Brass",
      manufacturerCode: "WB",
      canonicalFinishId: "warm-brass",
      isLivingFinish: false,
      digitalSwatchIsApproximate: true
    },
    canonicalFinish: { id: "warm-brass", label: "Warm Brass", group: "brass_gold", swatch: "#B88742" },
    manufacturerProductNumber: "A104-WB",
    price: 19.8,
    priceSourceId: "src-atlas-2026-price-list",
    sources: LEGACY_ATLAS_SOURCES
  }),
  matte_black_pull: embeddedLegacySnapshot({
    variantId: LEGACY_HARDWARE_VARIANT_IDS.matte_black_pull,
    family: LEGACY_ATLAS_FAMILY,
    brand: LEGACY_ATLAS_BRAND,
    collection: LEGACY_ATLAS_COLLECTION,
    size: LEGACY_ATLAS_SIZE,
    finish: {
      id: "atlas-bl",
      manufacturerName: "Matte Black",
      manufacturerCode: "BL",
      canonicalFinishId: "matte-black",
      isLivingFinish: false,
      digitalSwatchIsApproximate: true
    },
    canonicalFinish: { id: "matte-black", label: "Matte Black", group: "black", swatch: "#211F1C" },
    manufacturerProductNumber: "A104-BL",
    price: 19.8,
    priceSourceId: "src-atlas-2026-price-list",
    sources: LEGACY_ATLAS_SOURCES
  }),
  polished_nickel_pull: embeddedLegacySnapshot({
    variantId: LEGACY_HARDWARE_VARIANT_IDS.polished_nickel_pull,
    family: LEGACY_ATLAS_FAMILY,
    brand: LEGACY_ATLAS_BRAND,
    collection: LEGACY_ATLAS_COLLECTION,
    size: LEGACY_ATLAS_SIZE,
    finish: {
      id: "atlas-pn",
      manufacturerName: "Polished Nickel",
      manufacturerCode: "PN",
      canonicalFinishId: "polished-nickel",
      isLivingFinish: false,
      digitalSwatchIsApproximate: true
    },
    canonicalFinish: { id: "polished-nickel", label: "Polished Nickel", group: "nickel_chrome", swatch: "#D4D2CA" },
    manufacturerProductNumber: "A104-PN",
    price: 19.8,
    priceSourceId: "src-atlas-2026-price-list",
    sources: LEGACY_ATLAS_SOURCES
  }),
  satin_nickel_pull: embeddedLegacySnapshot({
    variantId: LEGACY_HARDWARE_VARIANT_IDS.satin_nickel_pull,
    family: LEGACY_ATLAS_FAMILY,
    brand: LEGACY_ATLAS_BRAND,
    collection: LEGACY_ATLAS_COLLECTION,
    size: LEGACY_ATLAS_SIZE,
    finish: {
      id: "atlas-brn",
      manufacturerName: "Brushed Nickel",
      manufacturerCode: "BRN",
      canonicalFinishId: "satin-nickel",
      isLivingFinish: false,
      digitalSwatchIsApproximate: true
    },
    canonicalFinish: { id: "satin-nickel", label: "Satin Nickel", group: "nickel_chrome", swatch: "#B7B7B0" },
    manufacturerProductNumber: "A104-BRN",
    price: 19.8,
    priceSourceId: "src-atlas-2026-price-list",
    sources: LEGACY_ATLAS_SOURCES
  })
});

const LEGACY_TOKEN_BY_VARIANT_ID = new Map(
  Object.entries(LEGACY_HARDWARE_VARIANT_IDS).map(([token, variantId]) => [variantId, token])
);
const LEGACY_SNAPSHOT_BY_VARIANT_ID = new Map(
  Object.values(LEGACY_VARIANT_SNAPSHOTS).map((snapshot) => [snapshot.variantId, snapshot])
);

const HARDWARE_CATEGORIES = new Set([
  "round_knob", "t_bar_knob", "bar_pull", "d_handle_pull", "sculptural_pull",
  "cup_pull", "edge_pull", "tab_pull", "knurled_bar_pull", "textured_bar_pull",
  "cabinet_latch"
]);
const PRODUCT_STATUSES = new Set(["active", "paused", "discontinued", "unverified"]);
const AVAILABILITY_STATUSES = new Set([
  "active_or_orderable", "in_stock", "made_to_order", "limited", "discontinued", "unknown"
]);
const PRICE_MODES = new Set(["reference_unit", "band", "quote_only"]);
const CURRENCIES = new Set(["USD", "CAD"]);
const ASSET_STRATEGIES = new Set(["A", "B", "C", "D"]);
const CANONICAL_FINISH_GROUPS = new Set(["brass_gold", "bronze_copper", "nickel_chrome", "black", "gray", "color"]);
const DIMENSION_KEYS = new Set([
  "centerToCenter", "overallLength", "projection", "width", "height", "diameter",
  "baseDiameter", "stemDiameter"
]);
const SOURCE_TYPES = new Set([
  "official_product_page", "official_specification_pdf", "official_catalog_pdf",
  "official_price_list_pdf", "official_installation_document", "official_cad_library"
]);
const ACCURATE_PROXY_VALUES = new Set([
  "licensed_exact",
  "dimensionally_accurate_custom_model",
  "dimensionally_accurate_neutral_custom_model",
  "dimensionally_accurate_parametric_proxy",
  "dimensionally_accurate_simplified_proxy"
]);

export function validateHardwareCatalog(catalog) {
  const errors = [];
  const warnings = [];
  const statistics = {
    canonicalFinishCount: 0,
    brandCount: 0,
    collectionCount: 0,
    familyCount: 0,
    sizeVariantCount: 0,
    finishVariantCount: 0,
    exactVariantCount: 0,
    sourceCount: 0,
    expectedCartesianVariantCount: 0,
    missingCartesianVariantCount: 0,
    duplicateCartesianVariantCount: 0,
    knownDimensionValueCount: 0,
    unknownDimensionValueCount: 0,
    zeroDimensionValueCount: 0,
    releaseGateWarningCount: 0,
    pricingModeCounts: { reference_unit: 0, band: 0, quote_only: 0 },
    assetStrategyCounts: { A: 0, B: 0, C: 0, D: 0 }
  };

  const addError = (code, path, message) => errors.push({ code, path, message });
  const addWarning = (code, path, message) => warnings.push({ code, path, message });

  if (!isPlainObject(catalog)) {
    addError("INVALID_CATALOG_ROOT", "$", "The hardware catalog must be a plain object.");
    return { valid: false, errors, warnings, statistics };
  }

  if (!/^\d+\.\d+\.\d+$/.test(String(catalog.schemaVersion || ""))) {
    addError("INVALID_CATALOG_SCHEMA_VERSION", "schemaVersion", "Catalog schemaVersion must be semantic version text.");
  }
  if (catalog.catalogVersion !== HARDWARE_CATALOG_VERSION) {
    addError(
      "CATALOG_VERSION_MISMATCH",
      "catalogVersion",
      `Expected catalog version ${HARDWARE_CATALOG_VERSION}.`
    );
  }
  if (!isIsoDate(catalog.researchDate)) {
    addError("INVALID_RESEARCH_DATE", "researchDate", "researchDate must be a valid YYYY-MM-DD date.");
  }
  if (!isIsoDateTime(catalog.generatedAt)) {
    addError("INVALID_GENERATED_AT", "generatedAt", "generatedAt must be a valid ISO date-time.");
  }
  if (catalog.runtimePolicy?.networkAccess !== "none_required") {
    addError("INVALID_RUNTIME_NETWORK_POLICY", "runtimePolicy.networkAccess", "The MVP catalog must require no runtime manufacturer network access.");
  }

  const canonicalFinishes = requiredArray(catalog, "canonicalFinishes", addError);
  const brands = requiredArray(catalog, "brands", addError);
  const collections = requiredArray(catalog, "collections", addError);
  const families = requiredArray(catalog, "families", addError);
  const exactVariants = requiredArray(catalog, "exactVariants", addError);
  const sources = requiredArray(catalog, "sources", addError);
  Object.assign(statistics, {
    canonicalFinishCount: canonicalFinishes.length,
    brandCount: brands.length,
    collectionCount: collections.length,
    familyCount: families.length,
    exactVariantCount: exactVariants.length,
    sourceCount: sources.length
  });

  const canonicalFinishById = uniqueIndex(canonicalFinishes, "canonicalFinishes", addError);
  const brandById = uniqueIndex(brands, "brands", addError);
  const collectionById = uniqueIndex(collections, "collections", addError);
  const familyById = uniqueIndex(families, "families", addError);
  const exactVariantById = uniqueIndex(exactVariants, "exactVariants", addError);
  const sourceById = uniqueIndex(sources, "sources", addError);
  void exactVariantById;

  canonicalFinishes.forEach((finish, index) => {
    const path = `canonicalFinishes[${index}]`;
    validateStableId(finish?.id, `${path}.id`, addError);
    if (!CANONICAL_FINISH_GROUPS.has(finish?.group)) {
      addError("INVALID_CANONICAL_FINISH_GROUP", `${path}.group`, "Canonical finish group is not supported.");
    }
    if (!/^#[0-9A-F]{6}$/i.test(String(finish?.swatch || ""))) {
      addError("INVALID_CANONICAL_FINISH_SWATCH", `${path}.swatch`, "Canonical finish swatch must be a six-digit hex color.");
    }
  });

  brands.forEach((brand, index) => {
    const path = `brands[${index}]`;
    validateStableId(brand?.id, `${path}.id`, addError);
    validateHttpsUrl(brand?.officialUrl, `${path}.officialUrl`, addError);
    validateRegions(brand?.regions, `${path}.regions`, addError);
  });

  collections.forEach((collection, index) => {
    const path = `collections[${index}]`;
    validateStableId(collection?.id, `${path}.id`, addError);
    if (!brandById.has(collection?.brandId)) {
      addError("UNKNOWN_COLLECTION_BRAND", `${path}.brandId`, "Collection brandId does not resolve.");
    }
  });

  sources.forEach((source, index) => {
    const path = `sources[${index}]`;
    validateStableId(source?.id, `${path}.id`, addError);
    if (!SOURCE_TYPES.has(source?.type)) {
      addError("INVALID_SOURCE_TYPE", `${path}.type`, "Source type is not supported.");
    }
    validateHttpsUrl(source?.url, `${path}.url`, addError);
    if (!isIsoDate(source?.accessedAt)) {
      addError("INVALID_SOURCE_ACCESSED_DATE", `${path}.accessedAt`, "Source accessedAt must be a valid YYYY-MM-DD date.");
    }
    if (source?.effectiveDate != null && !isIsoDate(source.effectiveDate)) {
      addError("INVALID_SOURCE_EFFECTIVE_DATE", `${path}.effectiveDate`, "Source effectiveDate must be null or a valid YYYY-MM-DD date.");
    }
  });

  const familyScopes = new Map();
  families.forEach((family, familyIndex) => {
    const path = `families[${familyIndex}]`;
    validateStableId(family?.id, `${path}.id`, addError);
    const brand = brandById.get(family?.brandId);
    const collection = collectionById.get(family?.collectionId);
    if (!brand) addError("UNKNOWN_FAMILY_BRAND", `${path}.brandId`, "Family brandId does not resolve.");
    if (!collection) addError("UNKNOWN_FAMILY_COLLECTION", `${path}.collectionId`, "Family collectionId does not resolve.");
    if (collection && collection.brandId !== family.brandId) {
      addError("FAMILY_COLLECTION_BRAND_MISMATCH", `${path}.collectionId`, "Family collection belongs to a different brand.");
    }
    if (!HARDWARE_CATEGORIES.has(family?.category)) {
      addError("INVALID_HARDWARE_CATEGORY", `${path}.category`, "Hardware family category is not supported.");
    }
    if (!PRODUCT_STATUSES.has(family?.status)) {
      addError("INVALID_FAMILY_STATUS", `${path}.status`, "Family product status is not supported.");
    }
    if (!isIsoDate(family?.lastVerifiedAt)) {
      addError("INVALID_FAMILY_VERIFIED_DATE", `${path}.lastVerifiedAt`, "Family lastVerifiedAt must be a valid YYYY-MM-DD date.");
    }
    validateRegions(family?.regions, `${path}.regions`, addError);
    validateSourceIds(family?.sourceIds, `${path}.sourceIds`, sourceById, addError);
    validateAssetAndLicense(family, path, addError);
    if (ASSET_STRATEGIES.has(family?.asset?.strategy)) {
      statistics.assetStrategyCounts[family.asset.strategy] += 1;
    }

    if (typeof family?.verificationCaveat === "string" && family.verificationCaveat.trim()) {
      statistics.releaseGateWarningCount += 1;
      addWarning(
        "RELEASE_GATE_VERIFICATION_CAVEAT",
        `${path}.verificationCaveat`,
        `${family.name || family.id} remains release-gated: ${family.verificationCaveat}`
      );
    }

    const sizeVariants = Array.isArray(family?.sizeVariants) ? family.sizeVariants : [];
    const finishVariants = Array.isArray(family?.finishVariants) ? family.finishVariants : [];
    if (!Array.isArray(family?.sizeVariants)) {
      addError("MISSING_SIZE_VARIANTS", `${path}.sizeVariants`, "Family sizeVariants must be an array.");
    }
    if (!Array.isArray(family?.finishVariants)) {
      addError("MISSING_FINISH_VARIANTS", `${path}.finishVariants`, "Family finishVariants must be an array.");
    }
    statistics.sizeVariantCount += sizeVariants.length;
    statistics.finishVariantCount += finishVariants.length;
    statistics.expectedCartesianVariantCount += sizeVariants.length * finishVariants.length;

    const sizeById = uniqueIndex(sizeVariants, `${path}.sizeVariants`, addError);
    const finishById = uniqueIndex(finishVariants, `${path}.finishVariants`, addError);
    familyScopes.set(family?.id, { sizeById, finishById, sizeVariants, finishVariants, familyIndex });

    sizeVariants.forEach((size, sizeIndex) => {
      const sizePath = `${path}.sizeVariants[${sizeIndex}]`;
      validateStableId(size?.id, `${sizePath}.id`, addError);
      if (!isPlainObject(size?.dimensionsMm)) {
        addError("INVALID_DIMENSIONS", `${sizePath}.dimensionsMm`, "dimensionsMm must be a plain object.");
      } else {
        for (const [key, value] of Object.entries(size.dimensionsMm)) {
          const dimensionPath = `${sizePath}.dimensionsMm.${key}`;
          if (!DIMENSION_KEYS.has(key)) {
            addError("UNKNOWN_DIMENSION", dimensionPath, "Dimension name is not part of the catalog contract.");
            continue;
          }
          if (value === null) {
            statistics.unknownDimensionValueCount += 1;
            continue;
          }
          if (!Number.isFinite(value)) {
            addError("INVALID_DIMENSION_VALUE", dimensionPath, "A known dimension must be a finite number; use null for unknown.");
            continue;
          }
          statistics.knownDimensionValueCount += 1;
          if (value === 0) statistics.zeroDimensionValueCount += 1;
          if (value < 0 || (value === 0 && key !== "centerToCenter")) {
            addError("INVALID_DIMENSION_RANGE", dimensionPath, "Dimensions must be positive; centerToCenter may be zero for single-hole hardware.");
          }
        }
      }
      const holeCount = size?.mounting?.holeCount;
      if (holeCount !== null && (!Number.isInteger(holeCount) || holeCount < 0)) {
        addError("INVALID_HOLE_COUNT", `${sizePath}.mounting.holeCount`, "holeCount must be a non-negative integer or null.");
      }
      const centerToCenter = size?.dimensionsMm?.centerToCenter;
      if (centerToCenter === 0 && holeCount !== 1) {
        addError("ZERO_CENTER_TO_CENTER_REQUIRES_SINGLE_HOLE", `${sizePath}.dimensionsMm.centerToCenter`, "A zero center-to-center value is reserved for single-hole hardware.");
      }
      if (Number.isFinite(centerToCenter) && centerToCenter > 0 && Number.isInteger(holeCount) && holeCount < 2) {
        addError("POSITIVE_CENTER_TO_CENTER_REQUIRES_MULTIPLE_HOLES", `${sizePath}.mounting.holeCount`, "A positive center-to-center value requires at least two mounting holes.");
      }
    });

    finishVariants.forEach((finish, finishIndex) => {
      const finishPath = `${path}.finishVariants[${finishIndex}]`;
      validateStableId(finish?.id, `${finishPath}.id`, addError);
      if (!canonicalFinishById.has(finish?.canonicalFinishId)) {
        addError("UNKNOWN_CANONICAL_FINISH", `${finishPath}.canonicalFinishId`, "Finish canonicalFinishId does not resolve.");
      }
      if (finish?.digitalSwatchIsApproximate !== true) {
        addError("INVALID_DIGITAL_SWATCH_DISCLOSURE", `${finishPath}.digitalSwatchIsApproximate`, "Manufacturer finish swatches must be marked approximate.");
      }
    });
  });

  const combinationCounts = new Map();
  exactVariants.forEach((variant, variantIndex) => {
    const path = `exactVariants[${variantIndex}]`;
    validateStableId(variant?.id, `${path}.id`, addError);
    const family = familyById.get(variant?.familyId);
    const scope = familyScopes.get(variant?.familyId);
    if (!family || !scope) {
      addError("UNKNOWN_EXACT_VARIANT_FAMILY", `${path}.familyId`, "Exact variant familyId does not resolve.");
    } else {
      if (!scope.sizeById.has(variant?.sizeVariantId)) {
        addError("UNKNOWN_FAMILY_SIZE_VARIANT", `${path}.sizeVariantId`, "sizeVariantId does not belong to this family.");
      }
      if (!scope.finishById.has(variant?.finishVariantId)) {
        addError("UNKNOWN_FAMILY_FINISH_VARIANT", `${path}.finishVariantId`, "finishVariantId does not belong to this family; finish IDs are family-scoped.");
      }
      const expectedId = `${variant.familyId}__${variant.sizeVariantId}__${variant.finishVariantId}`;
      if (variant.id !== expectedId) {
        addError("EXACT_VARIANT_ID_MISMATCH", `${path}.id`, `Exact variant ID must be ${expectedId}.`);
      }
    }

    const combinationKey = `${variant?.familyId}\u0000${variant?.sizeVariantId}\u0000${variant?.finishVariantId}`;
    const nextCombinationCount = (combinationCounts.get(combinationKey) || 0) + 1;
    combinationCounts.set(combinationKey, nextCombinationCount);
    if (nextCombinationCount > 1) {
      statistics.duplicateCartesianVariantCount += 1;
      addError("DUPLICATE_EXACT_VARIANT_COMBINATION", path, "An exact family/size/finish combination appears more than once.");
    }

    if (variant?.manufacturerProductNumber == null && variant?.sku == null) {
      addError("MISSING_MANUFACTURER_IDENTIFIER", path, "An exact variant requires a manufacturer product number or SKU.");
    }
    if (!PRODUCT_STATUSES.has(variant?.productStatus)) {
      addError("INVALID_EXACT_VARIANT_STATUS", `${path}.productStatus`, "Exact variant product status is not supported.");
    }
    if (!isIsoDate(variant?.lastVerifiedAt)) {
      addError("INVALID_EXACT_VARIANT_VERIFIED_DATE", `${path}.lastVerifiedAt`, "Exact variant lastVerifiedAt must be a valid YYYY-MM-DD date.");
    }
    validatePricing(variant?.pricing, `${path}.pricing`, sourceById, statistics, addError);
    validateAvailability(variant?.availability, `${path}.availability`, addError);
    validateSourceIds(variant?.sourceIds, `${path}.sourceIds`, sourceById, addError);
  });

  for (const family of families) {
    const scope = familyScopes.get(family?.id);
    if (!scope) continue;
    const missing = [];
    for (const size of scope.sizeVariants) {
      for (const finish of scope.finishVariants) {
        const combinationKey = `${family.id}\u0000${size.id}\u0000${finish.id}`;
        if (!combinationCounts.has(combinationKey)) missing.push(`${size.id} + ${finish.id}`);
      }
    }
    if (!missing.length) continue;
    statistics.missingCartesianVariantCount += missing.length;
    addWarning(
      "MISSING_CARTESIAN_VARIANT_COMBINATIONS",
      `families[${scope.familyIndex}]`,
      `${family.name || family.id} intentionally or accidentally omits ${missing.length} size/finish combination(s): ${missing.join(", ")}.`
    );
  }

  return { valid: errors.length === 0, errors, warnings, statistics };
}

export function createHardwareCatalogIndex(catalog) {
  const validation = validateHardwareCatalog(catalog);
  if (!validation.valid) {
    const error = new TypeError(`Invalid hardware catalog: ${validation.errors.map((issue) => issue.code).join(", ")}`);
    error.validation = validation;
    throw error;
  }

  const index = {
    kind: "jq-hardware-catalog-index",
    catalog,
    catalogVersion: catalog.catalogVersion,
    validation,
    canonicalFinishesById: new Map(catalog.canonicalFinishes.map((entry) => [entry.id, entry])),
    brandsById: new Map(catalog.brands.map((entry) => [entry.id, entry])),
    collectionsById: new Map(catalog.collections.map((entry) => [entry.id, entry])),
    familiesById: new Map(catalog.families.map((entry) => [entry.id, entry])),
    exactVariantsById: new Map(catalog.exactVariants.map((entry) => [entry.id, entry])),
    sourcesById: new Map(catalog.sources.map((entry) => [entry.id, entry])),
    sizeVariantsByFamilyId: new Map(),
    finishVariantsByFamilyId: new Map(),
    finishVariantsById: new Map(),
    exactVariantsByFamilyId: new Map(),
    exactVariantsByCombination: new Map(),
    variantSnapshotsById: new Map(),
    searchRecords: []
  };

  // Singular aliases keep consumers terse while the plural names make the
  // collection semantics explicit.
  index.canonicalFinishById = index.canonicalFinishesById;
  index.brandById = index.brandsById;
  index.collectionById = index.collectionsById;
  index.familyById = index.familiesById;
  index.exactVariantById = index.exactVariantsById;
  index.variantById = index.exactVariantsById;
  index.sourceById = index.sourcesById;

  for (const family of catalog.families) {
    index.sizeVariantsByFamilyId.set(family.id, new Map(family.sizeVariants.map((entry) => [entry.id, entry])));
    index.finishVariantsByFamilyId.set(family.id, new Map(family.finishVariants.map((entry) => [entry.id, entry])));
    for (const finish of family.finishVariants) {
      const scoped = index.finishVariantsById.get(finish.id) || [];
      scoped.push({ familyId: family.id, finish });
      index.finishVariantsById.set(finish.id, scoped);
    }
  }

  catalog.exactVariants.forEach((variant, order) => {
    const familyVariants = index.exactVariantsByFamilyId.get(variant.familyId) || [];
    familyVariants.push(variant);
    index.exactVariantsByFamilyId.set(variant.familyId, familyVariants);
    index.exactVariantsByCombination.set(
      `${variant.familyId}\u0000${variant.sizeVariantId}\u0000${variant.finishVariantId}`,
      variant
    );
    const snapshot = deepFreeze(buildSnapshotFromIndex(index, variant));
    index.variantSnapshotsById.set(variant.id, snapshot);
    index.searchRecords.push({
      order,
      snapshot,
      text: buildSearchText(snapshot),
      proxy: getHardwareProxySpec(snapshot)
    });
  });

  index.variants = index.searchRecords.map((record) => record.snapshot);
  return index;
}

export async function loadHardwareCatalog(fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== "function") throw new TypeError("A fetch implementation is required to load the hardware catalog.");
  const response = await fetchImpl(HARDWARE_CATALOG_URL, {
    credentials: "same-origin",
    cache: "force-cache",
    headers: { Accept: "application/json" }
  });
  if (!response?.ok) {
    throw new Error(`Hardware catalog request failed with status ${response?.status ?? "unknown"}.`);
  }
  const contentType = response.headers?.get?.("content-type") || "";
  if (contentType && !contentType.toLowerCase().includes("application/json")) {
    throw new Error("Hardware catalog response must use an application/json content type.");
  }
  const catalog = await response.json();
  const validation = validateHardwareCatalog(catalog);
  if (!validation.valid) {
    const error = new Error(`Hardware catalog validation failed: ${validation.errors.map((issue) => issue.code).join(", ")}`);
    error.validation = validation;
    throw error;
  }
  return catalog;
}

export function createHardwareVariantSnapshot(indexOrCatalog, id) {
  const requestedId = LEGACY_HARDWARE_VARIANT_IDS[id] || String(id || "");
  if (!requestedId) return null;
  if (indexOrCatalog == null) {
    return cloneValue(LEGACY_SNAPSHOT_BY_VARIANT_ID.get(requestedId) || null);
  }
  const index = asCatalogIndex(indexOrCatalog);
  const snapshot = index.variantSnapshotsById.get(requestedId);
  return snapshot ? cloneValue(snapshot) : null;
}

export function createLegacyHardwareSelections(token) {
  const legacyToken = String(token || "").trim();
  const mappedToken = LEGACY_HARDWARE_TOKENS.includes(legacyToken)
    ? legacyToken
    : DEFAULT_LEGACY_HARDWARE_TOKEN;
  const snapshot = LEGACY_VARIANT_SNAPSHOTS[mappedToken];
  const migrationWarnings = legacyToken && legacyToken !== mappedToken
    ? [{
        code: "UNKNOWN_LEGACY_HARDWARE",
        legacyToken,
        fallbackLegacyToken: mappedToken,
        message: `Legacy hardware value ${legacyToken} has no curated exact mapping and requires review; ${mappedToken} is used as the safe preview fallback.`
      }]
    : [];
  return {
    schemaVersion: HARDWARE_SELECTION_SCHEMA_VERSION,
    catalogVersion: HARDWARE_CATALOG_VERSION,
    defaultVariantId: snapshot.variantId,
    defaultSnapshot: cloneValue(snapshot),
    byHostId: {},
    migrationWarnings
  };
}

export function normalizeHardwareSelections(value, legacyToken) {
  const container = isPlainObject(value) && isPlainObject(value.hardwareSelections)
    ? value.hardwareSelections
    : value;
  const inferredLegacyToken = legacyToken
    ?? (typeof value === "string" ? value : undefined)
    ?? (isPlainObject(value) ? value.hardware : undefined);
  const fallback = createLegacyHardwareSelections(inferredLegacyToken || DEFAULT_LEGACY_HARDWARE_TOKEN);
  if (!isPlainObject(container)) return fallback;

  const warnings = normalizeMigrationWarnings(container.migrationWarnings);
  if (Number(container.schemaVersion) !== HARDWARE_SELECTION_SCHEMA_VERSION) {
    warnings.push({
      code: "HARDWARE_SELECTION_SCHEMA_REVIEW_REQUIRED",
      schemaVersion: container.schemaVersion ?? null,
      message: `Hardware selection schema ${String(container.schemaVersion ?? "missing")} was normalized to schema ${HARDWARE_SELECTION_SCHEMA_VERSION}.`
    });
  }

  const catalogVersion = typeof container.catalogVersion === "string" && container.catalogVersion.trim()
    ? container.catalogVersion.trim()
    : HARDWARE_CATALOG_VERSION;
  if (catalogVersion !== HARDWARE_CATALOG_VERSION) {
    warnings.push({
      code: "HARDWARE_CATALOG_VERSION_REVIEW_REQUIRED",
      catalogVersion,
      currentCatalogVersion: HARDWARE_CATALOG_VERSION,
      message: `Saved hardware catalog ${catalogVersion} differs from the current ${HARDWARE_CATALOG_VERSION}; saved snapshots remain authoritative until reviewed.`
    });
  }

  const requestedDefaultId = cleanId(container.defaultVariantId) || fallback.defaultVariantId;
  const defaultSnapshot = normalizeSelectionSnapshot(
    container.defaultSnapshot,
    requestedDefaultId,
    fallback.defaultSnapshot,
    warnings,
    "defaultSnapshot"
  );
  const byHostId = {};
  if (isPlainObject(container.byHostId)) {
    for (const [hostId, rawSelection] of Object.entries(container.byHostId)) {
      if (!hostId.trim() || !isPlainObject(rawSelection)) {
        warnings.push({
          code: "INVALID_HARDWARE_HOST_SELECTION",
          hostId,
          message: "An invalid per-host hardware selection was ignored."
        });
        continue;
      }
      const variantId = cleanId(rawSelection.variantId) || requestedDefaultId;
      const snapshot = normalizeSelectionSnapshot(
        rawSelection.snapshot,
        variantId,
        variantId === requestedDefaultId ? defaultSnapshot : null,
        warnings,
        `byHostId.${hostId}.snapshot`
      );
      byHostId[hostId] = {
        variantId,
        snapshot,
        placement: normalizeHardwarePlacement(rawSelection.placement)
      };
    }
  } else if (container.byHostId != null) {
    warnings.push({
      code: "INVALID_HARDWARE_HOST_MAP",
      message: "hardwareSelections.byHostId must be an object; invalid host overrides were ignored."
    });
  }

  return {
    schemaVersion: HARDWARE_SELECTION_SCHEMA_VERSION,
    catalogVersion,
    defaultVariantId: requestedDefaultId,
    defaultSnapshot,
    byHostId,
    migrationWarnings: dedupeWarnings([...fallback.migrationWarnings, ...warnings])
  };
}

export function resolveHardwareSelectionForHost(configOrSelections, hostId) {
  const config = isPlainObject(configOrSelections) ? configOrSelections : {};
  const selections = normalizeHardwareSelections(
    isPlainObject(config.hardwareSelections) ? config.hardwareSelections : config,
    config.hardware
  );
  const key = String(hostId || "");
  const hostSelection = key ? selections.byHostId[key] : null;
  if (hostSelection) {
    return {
      catalogVersion: selections.catalogVersion,
      variantId: hostSelection.variantId,
      snapshot: cloneValue(hostSelection.snapshot),
      placement: cloneValue(hostSelection.placement),
      resolvedFrom: "host"
    };
  }
  if (!selections.defaultVariantId) return null;
  return {
    catalogVersion: selections.catalogVersion,
    variantId: selections.defaultVariantId,
    snapshot: cloneValue(selections.defaultSnapshot),
    placement: {},
    resolvedFrom: "default"
  };
}

export function projectVariantToLegacyHardware(id, fallback = DEFAULT_LEGACY_HARDWARE_TOKEN) {
  const requestedId = isPlainObject(id) ? id.variantId || id.id : id;
  const token = String(requestedId || "");
  if (LEGACY_HARDWARE_TOKENS.includes(token)) return token;
  const projected = LEGACY_TOKEN_BY_VARIANT_ID.get(token);
  if (projected) return projected;
  return LEGACY_HARDWARE_TOKENS.includes(fallback) ? fallback : DEFAULT_LEGACY_HARDWARE_TOKEN;
}

export function getHardwareProxySpec(selectionOrSnapshot) {
  const snapshot = resolveSnapshotInput(selectionOrSnapshot);
  if (!snapshot) return null;
  const dimensions = cloneValue(snapshot.dimensionsMm || snapshot.size?.dimensionsMm || {});
  const category = snapshot.category || snapshot.family?.category || "unknown";
  const proxyKind = proxyKindForCategory(category);
  const asset = cloneValue(snapshot.asset || snapshot.family?.asset || {});
  const accuracy = asset.accuracy || "neutral_placeholder_until_full_projection_and_mounting_geometry_are_verified";
  const criticalDimensionsKnown = hasCriticalProxyDimensions(category, dimensions);
  const isAccurate3d = ACCURATE_PROXY_VALUES.has(accuracy) && criticalDimensionsKnown;
  const exactAssetUsable = asset.strategy === "A"
    && asset.exactGeometryLicensed === true
    && typeof asset.licenseRecordId === "string"
    && Boolean(asset.licenseRecordId)
    && typeof asset.localGlbPath === "string"
    && Boolean(asset.localGlbPath);

  return {
    variantId: snapshot.variantId || snapshot.id,
    geometryKey: `${snapshot.familyId || snapshot.family?.id || "unknown"}:${snapshot.sizeVariantId || snapshot.size?.id || "unknown"}:${accuracy}`,
    category,
    proxyKind,
    units: "millimeters",
    coordinateSystem: {
      origin: "mounting_plane_center",
      xAxis: "center_to_center",
      yAxis: "up",
      zAxis: "outward"
    },
    dimensionsMm: dimensions,
    compatiblePlacements: cloneValue(snapshot.compatiblePlacements || snapshot.family?.compatiblePlacements || []),
    recommendedApplications: cloneValue(snapshot.recommendedApplications || snapshot.family?.recommendedApplications || []),
    compatibilityRestrictions: cloneValue(snapshot.compatibilityRestrictions || snapshot.family?.compatibilityRestrictions || []),
    centerToCenterMm: ownDimension(dimensions, "centerToCenter"),
    overallLengthMm: ownDimension(dimensions, "overallLength"),
    projectionMm: ownDimension(dimensions, "projection"),
    widthMm: ownDimension(dimensions, "width"),
    heightMm: ownDimension(dimensions, "height"),
    diameterMm: ownDimension(dimensions, "diameter"),
    baseDiameterMm: ownDimension(dimensions, "baseDiameter"),
    stemDiameterMm: ownDimension(dimensions, "stemDiameter"),
    mounting: cloneValue(snapshot.mounting || snapshot.size?.mounting || {}),
    finish: {
      variantId: snapshot.finishVariantId || snapshot.finish?.id || null,
      name: snapshot.finishName || snapshot.finish?.manufacturerName || "",
      code: snapshot.finishCode || snapshot.finish?.manufacturerCode || "",
      canonicalFinishId: snapshot.canonicalFinishId || snapshot.finish?.canonicalFinishId || null,
      group: snapshot.canonicalFinishGroup || snapshot.finish?.canonical?.group || null,
      swatch: snapshot.canonicalFinishSwatch || snapshot.finish?.canonical?.swatch || null,
      isLivingFinish: Boolean(snapshot.finish?.isLivingFinish)
    },
    asset,
    modelAccuracy: accuracy,
    isAccurate3d,
    exactAssetUsable,
    requiresFallback: !isAccurate3d && !exactAssetUsable,
    requiresReleaseReview: Boolean(snapshot.releaseGate || snapshot.family?.verificationCaveat),
    localGlbPath: exactAssetUsable ? asset.localGlbPath : null
  };
}

export function searchHardwareCatalog(indexOrCatalog, query = "", filters = {}, sort = "recommended") {
  const index = asCatalogIndex(indexOrCatalog);
  const normalizedQuery = normalizeSearchText(query);
  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  const normalizedFilters = isPlainObject(filters) ? filters : {};
  const matches = index.searchRecords
    .filter((record) => queryTokens.every((token) => record.text.includes(token)))
    .filter((record) => snapshotMatchesFilters(record.snapshot, record.proxy, normalizedFilters))
    .map((record) => ({ ...record, score: scoreSearchRecord(record, normalizedQuery, queryTokens) }));

  const sortConfig = normalizeSearchSort(sort);
  matches.sort((left, right) => {
    if (normalizedQuery && sortConfig.by === "recommended" && left.score !== right.score) {
      return left.score - right.score;
    }
    const direction = sortConfig.direction === "desc" ? -1 : 1;
    let result = 0;
    let directionApplied = false;
    if (sortConfig.by === "price") {
      result = compareNullableNumber(priceForSort(left.snapshot), priceForSort(right.snapshot), direction);
      directionApplied = true;
    } else if (sortConfig.by === "size") {
      result = compareNullableNumber(sizeForSort(left.snapshot), sizeForSort(right.snapshot), direction);
      directionApplied = true;
    }
    else if (sortConfig.by === "name") result = displayName(left.snapshot).localeCompare(displayName(right.snapshot));
    else if (sortConfig.by === "curated_popularity") result = left.order - right.order;
    else result = compareRecommended(left, right);
    if (result) return directionApplied ? result : result * direction;
    return left.order - right.order;
  });

  return matches.map((record) => cloneValue(record.snapshot));
}

function buildSnapshotFromIndex(index, exactVariant) {
  const family = index.familiesById.get(exactVariant.familyId);
  const brand = index.brandsById.get(family.brandId);
  const collection = index.collectionsById.get(family.collectionId);
  const size = index.sizeVariantsByFamilyId.get(family.id)?.get(exactVariant.sizeVariantId);
  const finish = index.finishVariantsByFamilyId.get(family.id)?.get(exactVariant.finishVariantId);
  const canonicalFinish = index.canonicalFinishesById.get(finish.canonicalFinishId);
  const sourceIds = new Set([
    ...(family.sourceIds || []),
    ...(exactVariant.sourceIds || []),
    ...(exactVariant.pricing?.sourceId ? [exactVariant.pricing.sourceId] : [])
  ]);
  const sources = [...sourceIds].map((id) => index.sourcesById.get(id)).filter(Boolean);
  return buildSnapshotRecord({
    catalogVersion: index.catalogVersion,
    brand,
    collection,
    family,
    size,
    finish,
    canonicalFinish,
    exactVariant,
    sources
  });
}

function buildSnapshotRecord({ catalogVersion, brand, collection, family, size, finish, canonicalFinish, exactVariant, sources }) {
  const verificationCaveat = family.verificationCaveat || null;
  const selectable = family.status === "active"
    && exactVariant.productStatus === "active"
    && exactVariant.availability?.status !== "discontinued"
    && !verificationCaveat;
  const releaseWarnings = verificationCaveat
    ? [{ code: "RELEASE_GATE_VERIFICATION_CAVEAT", message: verificationCaveat }]
    : [];
  return {
    schemaVersion: HARDWARE_SELECTION_SCHEMA_VERSION,
    catalogVersion,
    id: exactVariant.id,
    variantId: exactVariant.id,
    brandId: brand.id,
    brandName: brand.name,
    collectionId: collection.id,
    collectionName: collection.name,
    familyId: family.id,
    familyName: family.name,
    category: family.category,
    sizeVariantId: size.id,
    sizeLabel: size.label,
    manufacturerSizeCode: size.manufacturerSizeCode,
    finishVariantId: finish.id,
    finishName: finish.manufacturerName,
    finishCode: finish.manufacturerCode,
    canonicalFinishId: finish.canonicalFinishId,
    canonicalFinishGroup: canonicalFinish.group,
    canonicalFinishSwatch: canonicalFinish.swatch,
    manufacturerProductNumber: exactVariant.manufacturerProductNumber,
    sku: exactVariant.sku,
    dimensionsMm: cloneValue(size.dimensionsMm),
    mounting: cloneValue(size.mounting),
    pricing: cloneValue(exactVariant.pricing),
    availability: cloneValue(exactVariant.availability),
    productStatus: exactVariant.productStatus,
    lastVerifiedAt: exactVariant.lastVerifiedAt,
    asset: cloneValue(family.asset),
    modelAccuracy: family.asset.accuracy,
    selectable,
    releaseGate: Boolean(verificationCaveat),
    warnings: releaseWarnings,
    brand: cloneValue(brand),
    collection: cloneValue(collection),
    family: {
      id: family.id,
      name: family.name,
      category: family.category,
      styles: cloneValue(family.styles || []),
      material: family.material,
      description: family.description,
      compatiblePlacements: cloneValue(family.compatiblePlacements || []),
      recommendedApplications: cloneValue(family.recommendedApplications || []),
      compatibilityRestrictions: cloneValue(family.compatibilityRestrictions || []),
      priceTier: family.priceTier,
      regions: cloneValue(family.regions || []),
      status: family.status,
      lastVerifiedAt: family.lastVerifiedAt,
      verificationCaveat,
      imageUsage: cloneValue(family.imageUsage),
      asset: cloneValue(family.asset)
    },
    size: cloneValue(size),
    finish: {
      ...cloneValue(finish),
      canonical: cloneValue(canonicalFinish)
    },
    exact: {
      manufacturerProductNumber: exactVariant.manufacturerProductNumber,
      sku: exactVariant.sku,
      pricing: cloneValue(exactVariant.pricing),
      availability: cloneValue(exactVariant.availability),
      productStatus: exactVariant.productStatus,
      lastVerifiedAt: exactVariant.lastVerifiedAt,
      sourceIds: cloneValue(exactVariant.sourceIds || []),
      note: exactVariant.note ?? null
    },
    sources: cloneValue(sources)
  };
}

function validatePricing(pricing, path, sourceById, statistics, addError) {
  if (!isPlainObject(pricing)) {
    addError("INVALID_PRICING_RECORD", path, "pricing must be a plain object.");
    return;
  }
  if (!PRICE_MODES.has(pricing.mode)) {
    addError("INVALID_PRICING_MODE", `${path}.mode`, "Pricing mode must be reference_unit, band, or quote_only.");
    return;
  }
  statistics.pricingModeCounts[pricing.mode] += 1;
  if (!CURRENCIES.has(pricing.currency)) {
    addError("INVALID_PRICE_CURRENCY", `${path}.currency`, "Price currency must be USD or CAD.");
  }
  if (typeof pricing.note !== "string" || !pricing.note.trim()) {
    addError("MISSING_PRICE_NOTE", `${path}.note`, "Every price record requires a disclosure note.");
  }

  if (pricing.mode === "reference_unit") {
    if (!Number.isFinite(pricing.amount) || pricing.amount <= 0) {
      addError("INVALID_REFERENCE_UNIT_AMOUNT", `${path}.amount`, "reference_unit requires a positive numeric amount.");
    }
    if (pricing.priceBand !== null) {
      addError("REFERENCE_UNIT_PRICE_BAND_MUST_BE_NULL", `${path}.priceBand`, "reference_unit priceBand must be null.");
    }
    if (!isIsoDate(pricing.checkedAt)) {
      addError("REFERENCE_UNIT_DATE_REQUIRED", `${path}.checkedAt`, "reference_unit requires a valid checkedAt date.");
    }
    if (typeof pricing.sourceId !== "string" || !sourceById.has(pricing.sourceId)) {
      addError("REFERENCE_UNIT_SOURCE_REQUIRED", `${path}.sourceId`, "reference_unit requires a resolvable sourceId.");
    }
    return;
  }

  if (pricing.amount !== null) {
    addError("NON_UNIT_AMOUNT_MUST_BE_NULL", `${path}.amount`, `${pricing.mode} amount must be explicitly null.`);
  }
  if (pricing.checkedAt !== null || pricing.sourceId !== null) {
    addError("NON_UNIT_SOURCE_FIELDS_MUST_BE_NULL", path, `${pricing.mode} checkedAt and sourceId must be explicitly null in the audited MVP seed.`);
  }
  if (pricing.mode === "band") {
    if (typeof pricing.priceBand !== "string" || !pricing.priceBand.trim()) {
      addError("PRICE_BAND_REQUIRED", `${path}.priceBand`, "band pricing requires non-empty priceBand text.");
    }
  } else if (pricing.priceBand !== null) {
    addError("QUOTE_ONLY_BAND_MUST_BE_NULL", `${path}.priceBand`, "quote_only priceBand must be explicitly null.");
  }
}

function validateAvailability(availability, path, addError) {
  if (!isPlainObject(availability)) {
    addError("INVALID_AVAILABILITY", path, "availability must be a plain object.");
    return;
  }
  if (!AVAILABILITY_STATUSES.has(availability.status)) {
    addError("INVALID_AVAILABILITY_STATUS", `${path}.status`, "Availability status is not supported.");
  }
  if (!isIsoDate(availability.checkedAt)) {
    addError("INVALID_AVAILABILITY_DATE", `${path}.checkedAt`, "Availability requires a valid checkedAt date.");
  }
  if (availability.leadTimeNote !== null && typeof availability.leadTimeNote !== "string") {
    addError("INVALID_LEAD_TIME_NOTE", `${path}.leadTimeNote`, "leadTimeNote must be text or null.");
  }
}

function validateAssetAndLicense(family, path, addError) {
  const asset = family?.asset;
  if (!isPlainObject(asset)) {
    addError("INVALID_ASSET_RECORD", `${path}.asset`, "Family asset must be a plain object.");
    return;
  }
  if (!ASSET_STRATEGIES.has(asset.strategy)) {
    addError("INVALID_ASSET_STRATEGY", `${path}.asset.strategy`, "Asset strategy must be A, B, C, or D.");
    return;
  }
  if (typeof asset.accuracy !== "string" || !asset.accuracy.trim()) {
    addError("MISSING_ASSET_ACCURACY", `${path}.asset.accuracy`, "Asset accuracy must be explicit.");
  }
  if (typeof asset.exactGeometryLicensed !== "boolean") {
    addError("INVALID_EXACT_GEOMETRY_LICENSE_FLAG", `${path}.asset.exactGeometryLicensed`, "exactGeometryLicensed must be boolean.");
  }
  const hasLicenseRecord = typeof asset.licenseRecordId === "string" && Boolean(asset.licenseRecordId.trim());
  if (asset.strategy === "A") {
    if (asset.exactGeometryLicensed !== true || !hasLicenseRecord || asset.accuracy !== "licensed_exact") {
      addError("EXACT_ASSET_LICENSE_REQUIRED", `${path}.asset`, "Strategy A requires licensed_exact accuracy, exactGeometryLicensed true, and a licenseRecordId.");
    }
  } else if (asset.exactGeometryLicensed === true || asset.accuracy === "licensed_exact") {
    addError("NON_EXACT_ASSET_LICENSE_MISMATCH", `${path}.asset`, "Only strategy A may claim licensed exact geometry.");
  }
  if (asset.strategy === "B" && !["dimensionally_accurate_custom_model", "dimensionally_accurate_neutral_custom_model"].includes(asset.accuracy)) {
    addError("CUSTOM_ASSET_ACCURACY_MISMATCH", `${path}.asset.accuracy`, "Strategy B requires a dimensionally accurate custom-model accuracy value.");
  }
  if (asset.strategy === "C" && !String(asset.accuracy).includes("proxy")) {
    addError("PROXY_ASSET_ACCURACY_MISMATCH", `${path}.asset.accuracy`, "Strategy C requires an explicit proxy accuracy value.");
  }
  if (asset.strategy === "D" && !String(asset.accuracy).includes("placeholder")) {
    addError("PLACEHOLDER_ASSET_ACCURACY_MISMATCH", `${path}.asset.accuracy`, "Strategy D requires an explicit placeholder accuracy value.");
  }
  if (asset.localGlbPath != null && (!isSafeLocalPath(asset.localGlbPath) || asset.strategy === "A" && !hasLicenseRecord)) {
    addError("UNSAFE_OR_UNLICENSED_LOCAL_ASSET", `${path}.asset.localGlbPath`, "A local GLB path must be same-origin and exact manufacturer geometry must carry a license record.");
  }
  if (asset.sourceUrl != null) validateHttpsUrl(asset.sourceUrl, `${path}.asset.sourceUrl`, addError);
  if (family?.imageUsage?.status === "licensed" && !hasLicenseRecord) {
    addError("LICENSED_IMAGE_RECORD_REQUIRED", `${path}.imageUsage.status`, "Licensed imagery requires a recorded license identifier.");
  }
}

function snapshotMatchesFilters(snapshot, proxy, filters) {
  if (!matchesOne(snapshot.brandId, filters.brandId ?? filters.brand)) return false;
  if (!matchesOne(snapshot.collectionId, filters.collectionId ?? filters.collection)) return false;
  if (!matchesOne(snapshot.familyId, filters.familyId ?? filters.family)) return false;
  if (!matchesOne(snapshot.category, filters.category ?? filters.type)) return false;
  if (!matchesAny(snapshot.family?.styles || [], filters.style ?? filters.styles)) return false;
  if (!matchesOne(snapshot.canonicalFinishId, filters.canonicalFinishId ?? filters.canonicalFinish)) return false;
  if (!matchesOne(snapshot.canonicalFinishGroup, filters.canonicalFinishGroup ?? filters.finishGroup)) return false;
  if (!matchesOne(snapshot.finishVariantId, filters.finishVariantId ?? filters.exactFinishId ?? filters.finish)) return false;
  if (!matchesOne(snapshot.sizeVariantId, filters.sizeVariantId ?? filters.size)) return false;
  if (!matchesOne(snapshot.family?.priceTier, filters.priceTier)) return false;
  if (!matchesOne(snapshot.pricing?.mode, filters.priceMode)) return false;
  if (!matchesOne(snapshot.availability?.status, filters.availability ?? filters.availabilityStatus)) return false;
  if (!matchesOne(snapshot.productStatus, filters.productStatus)) return false;
  if (!matchesOne(snapshot.asset?.strategy, filters.assetStrategy)) return false;
  if (!matchesOne(snapshot.modelAccuracy, filters.modelAccuracy)) return false;
  if (!matchesAny(snapshot.family?.regions || [], filters.region ?? filters.regions)) return false;
  if (filters.selectableOnly === true && !snapshot.selectable) return false;
  if (typeof filters.accurate3D === "boolean" && Boolean(proxy?.isAccurate3d || proxy?.exactAssetUsable) !== filters.accurate3D) return false;
  if (typeof filters.accurate3d === "boolean" && Boolean(proxy?.isAccurate3d || proxy?.exactAssetUsable) !== filters.accurate3d) return false;
  if (!matchesNumber(snapshot.dimensionsMm?.centerToCenter, filters.centerToCenterMm ?? filters.centerToCenter)) return false;
  if (!matchesNumber(snapshot.dimensionsMm?.overallLength, filters.overallLengthMm ?? filters.overallLength)) return false;
  if (!matchesNumber(snapshot.pricing?.amount, numericRange(filters.minPrice, filters.maxPrice))) return false;
  return true;
}

function scoreSearchRecord(record, normalizedQuery, tokens) {
  if (!normalizedQuery) return 0;
  const snapshot = record.snapshot;
  const exactValues = [
    snapshot.variantId,
    snapshot.manufacturerProductNumber,
    snapshot.sku,
    snapshot.finishCode,
    snapshot.manufacturerSizeCode
  ].map(normalizeSearchText);
  if (exactValues.includes(normalizedQuery)) return 0;
  if (normalizeSearchText(snapshot.familyName) === normalizedQuery) return 1;
  if (exactValues.some((value) => value.startsWith(normalizedQuery))) return 2;
  if (normalizeSearchText(snapshot.familyName).startsWith(normalizedQuery)) return 3;
  return Math.max(4, 10 - tokens.length);
}

function compareRecommended(left, right) {
  const leftSnapshot = left.snapshot;
  const rightSnapshot = right.snapshot;
  const checks = [
    Number(rightSnapshot.selectable) - Number(leftSnapshot.selectable),
    Number(leftSnapshot.releaseGate) - Number(rightSnapshot.releaseGate),
    Number(Boolean(right.proxy?.isAccurate3d || right.proxy?.exactAssetUsable)) - Number(Boolean(left.proxy?.isAccurate3d || left.proxy?.exactAssetUsable)),
    left.order - right.order
  ];
  return checks.find((value) => value !== 0) || 0;
}

function normalizeSearchSort(sort) {
  const source = isPlainObject(sort) ? sort : { by: sort };
  const raw = String(source.by || source.sort || "recommended").toLowerCase().replace(/[\s-]+/g, "_");
  const aliases = {
    popularity: "curated_popularity",
    curated: "curated_popularity",
    price_asc: "price",
    price_low_to_high: "price",
    price_desc: "price",
    price_high_to_low: "price",
    size_asc: "size",
    size_small_to_large: "size",
    size_desc: "size",
    size_large_to_small: "size",
    alphabetical: "name"
  };
  const by = aliases[raw] || raw;
  const impliedDescending = ["price_desc", "price_high_to_low", "size_desc", "size_large_to_small"].includes(raw);
  return {
    by: ["recommended", "curated_popularity", "price", "size", "name"].includes(by) ? by : "recommended",
    direction: source.direction === "desc" || impliedDescending ? "desc" : "asc"
  };
}

function buildSearchText(snapshot) {
  const synonyms = categorySearchTerms(snapshot.category);
  return normalizeSearchText([
    snapshot.variantId,
    snapshot.brandName,
    snapshot.collectionName,
    snapshot.familyName,
    snapshot.category,
    ...synonyms,
    ...(snapshot.family?.styles || []),
    snapshot.family?.material,
    ...(snapshot.family?.recommendedApplications || []),
    snapshot.sizeLabel,
    snapshot.manufacturerSizeCode,
    snapshot.finishName,
    snapshot.finishCode,
    snapshot.canonicalFinishId,
    snapshot.canonicalFinishGroup,
    snapshot.manufacturerProductNumber,
    snapshot.sku
  ].filter(Boolean).join(" "));
}

function categorySearchTerms(category) {
  if (category === "round_knob" || category === "t_bar_knob") return ["knob", "single hole"];
  if (category === "cabinet_latch") return ["latch", "catch"];
  if (category === "edge_pull" || category === "tab_pull") return ["pull", "edge tab finger"];
  return ["pull", "handle"];
}

function normalizeHardwarePlacement(value) {
  if (!isPlainObject(value)) return {};
  const placement = {};
  if (["horizontal", "vertical"].includes(value.orientation)) placement.orientation = value.orientation;
  if (["left", "center", "right", "custom"].includes(value.horizontalAnchor)) placement.horizontalAnchor = value.horizontalAnchor;
  if (["top", "middle", "bottom", "custom"].includes(value.verticalAnchor)) placement.verticalAnchor = value.verticalAnchor;
  if (Number.isFinite(value.edgeOffsetMm)) placement.edgeOffsetMm = value.edgeOffsetMm;
  if (Number.isFinite(value.crossAxisOffsetMm)) placement.crossAxisOffsetMm = value.crossAxisOffsetMm;
  if (typeof value.mirrored === "boolean") placement.mirrored = value.mirrored;
  if ([1, 2].includes(value.quantityPerFront)) placement.quantityPerFront = value.quantityPerFront;
  return placement;
}

function normalizeSelectionSnapshot(value, variantId, fallback, warnings, path) {
  if (isPlainObject(value) && cleanId(value.variantId || value.id) === variantId) return cloneValue(value);
  const embedded = LEGACY_SNAPSHOT_BY_VARIANT_ID.get(variantId);
  if (embedded) return cloneValue(embedded);
  if (isPlainObject(fallback) && cleanId(fallback.variantId || fallback.id) === variantId) return cloneValue(fallback);
  warnings.push({
    code: "MISSING_HARDWARE_VARIANT_SNAPSHOT",
    variantId,
    path,
    message: `Hardware variant ${variantId} is missing its saved factual snapshot and requires catalog review.`
  });
  return null;
}

function resolveSnapshotInput(value) {
  if (typeof value === "string") {
    const variantId = LEGACY_HARDWARE_VARIANT_IDS[value] || value;
    return LEGACY_SNAPSHOT_BY_VARIANT_ID.get(variantId) || null;
  }
  if (!isPlainObject(value)) return null;
  if (isPlainObject(value.snapshot)) return value.snapshot;
  if (isPlainObject(value.defaultSnapshot)) return value.defaultSnapshot;
  if (value.variantId && (value.dimensionsMm || value.size?.dimensionsMm)) return value;
  return null;
}

function proxyKindForCategory(category) {
  const kinds = {
    round_knob: "round_knob",
    t_bar_knob: "t_bar_knob",
    bar_pull: "bar_pull",
    d_handle_pull: "d_handle_pull",
    sculptural_pull: "sculptural_pull",
    cup_pull: "cup_pull",
    edge_pull: "edge_pull",
    tab_pull: "tab_pull",
    knurled_bar_pull: "knurled_bar_pull",
    textured_bar_pull: "textured_bar_pull",
    cabinet_latch: "cabinet_latch"
  };
  return kinds[category] || "neutral_placeholder";
}

function hasCriticalProxyDimensions(category, dimensions) {
  const knownPositive = (key) => Number.isFinite(dimensions?.[key]) && dimensions[key] > 0;
  if (["round_knob", "t_bar_knob"].includes(category)) {
    return knownPositive("projection") && (knownPositive("diameter") || knownPositive("overallLength") || knownPositive("width"));
  }
  if (["edge_pull", "tab_pull", "cabinet_latch"].includes(category)) {
    return knownPositive("overallLength") && knownPositive("projection") && (knownPositive("width") || knownPositive("height"));
  }
  return knownPositive("centerToCenter") && knownPositive("overallLength") && knownPositive("projection") && knownPositive("width");
}

function requiredArray(object, key, addError) {
  if (Array.isArray(object[key])) return object[key];
  addError("MISSING_CATALOG_ARRAY", key, `${key} must be an array.`);
  return [];
}

function uniqueIndex(records, path, addError) {
  const index = new Map();
  records.forEach((record, recordIndex) => {
    const id = record?.id;
    if (typeof id !== "string" || !id) return;
    if (index.has(id)) {
      addError("DUPLICATE_ID", `${path}[${recordIndex}].id`, `Duplicate ID ${id}.`);
      return;
    }
    index.set(id, record);
  });
  return index;
}

function validateStableId(value, path, addError) {
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(String(value || ""))) {
    addError("INVALID_STABLE_ID", path, "IDs must use lowercase letters, digits, hyphens, or underscores.");
  }
}

function validateSourceIds(values, path, sourceById, addError) {
  if (!Array.isArray(values) || !values.length) {
    addError("MISSING_SOURCE_IDS", path, "At least one source ID is required.");
    return;
  }
  for (const [index, id] of values.entries()) {
    if (!sourceById.has(id)) addError("UNKNOWN_SOURCE_ID", `${path}[${index}]`, `Source ID ${String(id)} does not resolve.`);
  }
}

function validateRegions(values, path, addError) {
  if (!Array.isArray(values) || !values.length || values.some((value) => !["US", "CA"].includes(value))) {
    addError("INVALID_REGIONS", path, "Regions must be a non-empty array containing only US and/or CA.");
  }
}

function validateHttpsUrl(value, path, addError) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") throw new Error("HTTPS required");
  } catch (error) {
    addError("INVALID_HTTPS_URL", path, "URL must be an absolute HTTPS URL.");
  }
}

function isSafeLocalPath(value) {
  const path = String(value || "");
  return Boolean(path) && !path.startsWith("/") && !path.includes("..") && !/^[a-z][a-z0-9+.-]*:/i.test(path);
}

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function isIsoDateTime(value) {
  if (typeof value !== "string" || !value.includes("T")) return false;
  return !Number.isNaN(new Date(value).valueOf());
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asCatalogIndex(indexOrCatalog) {
  return indexOrCatalog?.kind === "jq-hardware-catalog-index"
    ? indexOrCatalog
    : createHardwareCatalogIndex(indexOrCatalog);
}

function normalizeMigrationWarnings(values) {
  if (!Array.isArray(values)) return [];
  return values.map((value) => {
    if (isPlainObject(value)) return cloneValue(value);
    return { code: "SAVED_HARDWARE_MIGRATION_WARNING", message: String(value) };
  });
}

function dedupeWarnings(values) {
  const seen = new Set();
  return values.filter((warning) => {
    const key = JSON.stringify(warning);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function matchesOne(actual, requested) {
  if (requested == null || requested === "") return true;
  const values = Array.isArray(requested) ? requested : [requested];
  return values.map(String).includes(String(actual));
}

function matchesAny(actualValues, requested) {
  if (requested == null || requested === "") return true;
  const requestedValues = (Array.isArray(requested) ? requested : [requested]).map(String);
  return actualValues.map(String).some((value) => requestedValues.includes(value));
}

function matchesNumber(actual, requested) {
  if (requested == null) return true;
  if (!Number.isFinite(actual)) return false;
  if (Number.isFinite(requested)) return Math.abs(actual - requested) < 1e-6;
  if (Array.isArray(requested)) {
    const [min, max] = requested;
    return (!Number.isFinite(min) || actual >= min) && (!Number.isFinite(max) || actual <= max);
  }
  if (isPlainObject(requested)) {
    return (!Number.isFinite(requested.min) || actual >= requested.min)
      && (!Number.isFinite(requested.max) || actual <= requested.max);
  }
  return true;
}

function numericRange(min, max) {
  return Number.isFinite(min) || Number.isFinite(max) ? { min, max } : null;
}

function compareNullableNumber(left, right, direction = 1) {
  const leftKnown = Number.isFinite(left);
  const rightKnown = Number.isFinite(right);
  if (leftKnown && rightKnown) return (left - right) * direction;
  if (leftKnown) return -1;
  if (rightKnown) return 1;
  return 0;
}

function priceForSort(snapshot) {
  return snapshot.pricing?.mode === "reference_unit" ? snapshot.pricing.amount : null;
}

function sizeForSort(snapshot) {
  const dimensions = snapshot.dimensionsMm || {};
  return Number.isFinite(dimensions.overallLength)
    ? dimensions.overallLength
    : Number.isFinite(dimensions.diameter)
      ? dimensions.diameter
      : Number.isFinite(dimensions.width)
        ? dimensions.width
        : null;
}

function displayName(snapshot) {
  return `${snapshot.brandName || ""} ${snapshot.familyName || ""} ${snapshot.sizeLabel || ""} ${snapshot.finishName || ""}`;
}

function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function cleanId(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function ownDimension(dimensions, key) {
  return Object.prototype.hasOwnProperty.call(dimensions || {}, key) ? dimensions[key] : null;
}

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (isPlainObject(value)) return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneValue(entry)]));
  return value;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}
