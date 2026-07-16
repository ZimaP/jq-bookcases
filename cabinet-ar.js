import {
  createDesignId,
  migrateLegacyConstructionConfig,
  normalizeBookcaseConfig
} from "./bookcase-config.js?v=engine-polish-20260716a";
import { createHardwareVariantSnapshot } from "./hardware-catalog.js?v=engine-polish-20260716a";

export const CABINET_AR_SCHEMA_VERSION = 1;
export const CABINET_AR_FEATURE_ATTRIBUTE = "data-enable-cabinet-ar";
export const CABINET_AR_SHARE_PARAMETER = "arConfig";
export const CABINET_AR_MODEL_VIEWER_URL = "https://ajax.googleapis.com/ajax/libs/model-viewer/4.3.1/model-viewer.min.js";
export const CABINET_AR_QR_MODULE_URL = "https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm";
export const CABINET_AR_MODEL_CACHE_LIMIT = 8;
export const CABINET_AR_REMOTE_TIMEOUT_MS = 10000;

// Schema-v1 tokens are positional. Keep the original order immutable and append
// new optional fields so links created before drawer profiles or construction
// profiles still decode without shifting any established position.
const LEGACY_CONFIGURATION_FIELDS = Object.freeze([
  "layoutPreset",
  "layoutType",
  "width",
  "height",
  "depth",
  "sections",
  "shelves",
  "shelfThickness",
  "lowerCabinets",
  "lowerStorage",
  "drawerCount",
  "centerOpening",
  "deskOpening",
  "featureOpening",
  "tallDoors",
  "doorStyle",
  "doorCount",
  "hardware",
  "lighting",
  "lightingWarmth",
  "finish",
  "customPaintColor",
  "customPaintCode",
  "customPaintHex",
  "paintSelection",
  "crownStyle",
  "baseStyle",
  "layoutMetadata",
  "installation",
  "delivery"
]);
const CONFIGURATION_FIELDS = Object.freeze([
  ...LEGACY_CONFIGURATION_FIELDS,
  "drawerFrontStyle",
  "constructionProfile",
  "hardwareSelections"
]);
const COMPRESSED_CONFIGURATION_PREFIX = "z1_";
const MAX_CONFIGURATION_TOKEN_LENGTH = 65536;
const MAX_DECOMPRESSED_CONFIGURATION_LENGTH = 262144;
const COMPRESSION_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const HARDWARE_HANDOFF_MARKER = "jq-hardware-selections-1";
const HARDWARE_SNAPSHOT_HANDOFF_MARKER = "jq-hardware-snapshot-1";
const SECTION_STORAGE_HANDOFF_KEY = "~section-storage-1";
const HARDWARE_HANDOFF_KEYS = Object.freeze([
  "schemaVersion", "catalogVersion", "defaultVariantId", "defaultSnapshot", "byHostId", "migrationWarnings",
  "id", "variantId", "brandId", "brandName", "collectionId", "collectionName", "familyId", "familyName",
  "category", "sizeVariantId", "sizeLabel", "manufacturerSizeCode", "finishVariantId", "finishName", "finishCode",
  "canonicalFinishId", "canonicalFinishGroup", "canonicalFinishSwatch", "manufacturerProductNumber", "sku",
  "dimensionsMm", "diameter", "projection", "baseDiameter", "centerToCenter", "overallLength", "width", "height",
  "mounting", "holeCount", "pricing", "mode", "currency", "amount", "priceBand", "checkedAt", "sourceId", "note",
  "availability", "status", "leadTimeNote", "productStatus", "lastVerifiedAt", "asset", "strategy", "accuracy",
  "exactGeometryLicensed", "cadAvailability", "productionRule", "modelAccuracy", "selectable", "releaseGate", "warnings",
  "brand", "name", "marketPosition", "regions", "officialUrl", "logoUsage", "collection", "styles", "family", "material",
  "description", "compatiblePlacements", "recommendedApplications", "compatibilityRestrictions", "priceTier",
  "verificationCaveat", "imageUsage", "size", "label", "finish", "manufacturerName", "manufacturerCode",
  "isLivingFinish", "digitalSwatchIsApproximate", "canonical", "group", "swatch", "exact", "sourceIds", "sources",
  "publisher", "title", "type", "url", "accessedAt", "placement", "orientation", "horizontalAnchor", "verticalAnchor",
  "edgeOffsetMm", "crossAxisOffsetMm", "mirrored", "quantityPerFront", "code", "message", "path", "legacyToken",
  "fallbackLegacyToken", "currentCatalogVersion", "snapshotMarker"
]);
const HARDWARE_HANDOFF_KEY_TO_ALIAS = new Map(
  HARDWARE_HANDOFF_KEYS.map((key, index) => [key, `~${index.toString(36)}`])
);
const HARDWARE_HANDOFF_ALIAS_TO_KEY = new Map(
  [...HARDWARE_HANDOFF_KEY_TO_ALIAS].map(([key, alias]) => [alias, key])
);
const MODEL_URL_PROTOCOLS = new Set(["http:", "https:", "blob:"]);
const configurationCache = new Map();

export function inchesToMeters(value) {
  const inches = Number(value);
  if (!Number.isFinite(inches) || inches <= 0) throw new RangeError("Cabinet dimensions must be positive numbers.");
  return inches * 0.0254;
}

export function normalizeCabinetArConfiguration(config, layout, options = {}) {
  validateRawDimensions(config);
  const normalized = normalizeBookcaseConfig(config);
  if (!layout?.validation?.valid) throw new RangeError("The cabinet layout must be valid before preparing AR.");
  const sectionLookup = new Map(
    (layout.components || [])
      .filter((component) => component.role === "section")
      .map((component) => [component.id, Number(component.metadata?.index) || 0])
  );
  const shelves = (layout.components || [])
    .filter((component) => component.role === "shelf")
    .map((component) => ({
      section: sectionLookup.get(component.parentId) ?? parseSectionIndex(component.parentId),
      positionMeters: roundMeters(inchesToMeters(component.position.y))
    }))
    .sort((left, right) => left.section - right.section || left.positionMeters - right.positionMeters);
  const generatedDoorLeafCount = (layout.components || [])
    .filter((component) => component.role === "door")
    .length;
  const descriptorConstructionProfiles = new Set(
    (layout.components || [])
      .filter((component) => ["door", "drawer_front"].includes(component.role))
      .map((component) => component.metadata?.constructionProfile)
      .filter(Boolean)
  );
  const layoutConstructionProfile = layout.config?.constructionProfile || normalized.constructionProfile;
  if (
    layoutConstructionProfile !== normalized.constructionProfile
    || [...descriptorConstructionProfiles].some((profile) => profile !== layoutConstructionProfile)
  ) {
    throw new RangeError("The AR configuration and generated front construction profile must match.");
  }
  const canonical = normalizeBookcaseConfig({
    ...normalized,
    ...(layout.config || {}),
    doorCount: generatedDoorLeafCount
  });
  const productId = cleanIdentifier(options.productId || canonical.layoutType || canonical.layoutPreset, "cabinet");
  const configurationId = cleanIdentifier(options.configurationId || createDesignId(canonical, options.price || 0), "");
  const hardwareSchedule = (layout.components || [])
    .filter((component) => component.role === "handle")
    .map(createArHardwareScheduleEntry);

  return {
    schemaVersion: CABINET_AR_SCHEMA_VERSION,
    productId,
    ...(configurationId ? { configurationId } : {}),
    units: "meters",
    widthMeters: roundMeters(inchesToMeters(canonical.width)),
    heightMeters: roundMeters(inchesToMeters(canonical.height)),
    depthMeters: roundMeters(inchesToMeters(canonical.depth)),
    sections: canonical.sections,
    shelves,
    layoutType: canonical.layoutType,
    shelfThicknessMeters: roundMeters(inchesToMeters(canonical.shelfThickness)),
    lowerCabinets: canonical.lowerCabinets,
    lowerStorage: canonical.lowerStorage,
    drawerCount: canonical.drawerCount,
    centerOpening: canonical.centerOpening,
    deskOpening: canonical.deskOpening,
    featureOpening: canonical.featureOpening,
    tallDoors: canonical.tallDoors,
    constructionProfileId: layoutConstructionProfile,
    doorStyleId: canonical.doorStyle,
    drawerFrontStyleId: canonical.drawerFrontStyle,
    doorCount: generatedDoorLeafCount,
    doorLeafCount: generatedDoorLeafCount,
    baseStyleId: canonical.baseStyle,
    crownStyleId: canonical.crownStyle,
    finishId: canonical.finish,
    finishPreviewHex: canonical.customPaintHex || null,
    hardwareId: canonical.hardware,
    hardwareSelections: canonical.hardwareSelections,
    hardwareSchedule,
    lightingId: canonical.lighting,
    lightingWarmthKelvin: canonical.lightingWarmth,
    layoutMetadata: canonical.layoutMetadata
  };
}

export function stableStringify(value) {
  return JSON.stringify(sortForSerialization(value));
}

export function hashCabinetArConfiguration(configuration) {
  const source = stableStringify(configuration);
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < source.length; index += 1) {
    const code = source.charCodeAt(index);
    first ^= code;
    first = Math.imul(first, 0x01000193);
    second ^= code + index;
    second = Math.imul(second, 0x85ebca6b);
  }
  return `ar-${toHex(first)}${toHex(second)}`;
}

export function encodeCabinetConfiguration(config, options = {}) {
  const normalized = normalizeBookcaseConfig(config);
  const values = CONFIGURATION_FIELDS.map((field) => {
    if (field === "hardwareSelections") return compactHardwareSelectionsForHandoff(normalized[field]);
    if (field === "layoutMetadata") return compactLayoutMetadataForHandoff(normalized[field]);
    return normalized[field];
  });
  const serialized = JSON.stringify([CABINET_AR_SCHEMA_VERSION, values]);
  const uncompressed = encodeBase64Url(serialized);
  if (options.compress === false) return uncompressed;
  const compressed = `${COMPRESSED_CONFIGURATION_PREFIX}${compressConfigurationString(serialized)}`;
  return compressed.length < uncompressed.length ? compressed : uncompressed;
}

export function decodeCabinetConfiguration(token) {
  if (
    typeof token !== "string"
    || !token
    || token.length > MAX_CONFIGURATION_TOKEN_LENGTH
    || !/^[A-Za-z0-9_-]+$/.test(token)
  ) return null;
  try {
    const serialized = decodeConfigurationToken(token);
    if (!serialized || serialized.length > MAX_DECOMPRESSED_CONFIGURATION_LENGTH) return null;
    const payload = JSON.parse(serialized);
    if (!Array.isArray(payload) || payload[0] !== CABINET_AR_SCHEMA_VERSION || !Array.isArray(payload[1])) return null;
    const candidate = {};
    CONFIGURATION_FIELDS.forEach((field, index) => {
      if (index < payload[1].length) {
        if (field === "hardwareSelections") {
          candidate[field] = expandHardwareSelectionsFromHandoff(payload[1][index]);
        } else if (field === "layoutMetadata") {
          candidate[field] = expandLayoutMetadataFromHandoff(payload[1][index]);
        } else {
          candidate[field] = payload[1][index];
        }
      }
    });
    validateRawDimensions(candidate);
    return normalizeBookcaseConfig(migrateLegacyConstructionConfig(candidate));
  } catch (error) {
    return null;
  }
}

export function createCabinetArShareUrl(config, sourceUrl) {
  const url = new URL(sourceUrl, "https://jqbookcases.example/configurator.html");
  url.searchParams.delete("preset");
  url.searchParams.set(CABINET_AR_SHARE_PARAMETER, encodeCabinetConfiguration(config));
  return url.toString();
}

export function readCabinetArShareConfiguration(sourceUrl) {
  try {
    const url = new URL(sourceUrl, "https://jqbookcases.example/configurator.html");
    return decodeCabinetConfiguration(url.searchParams.get(CABINET_AR_SHARE_PARAMETER) || "");
  } catch (error) {
    return null;
  }
}

export function isCabinetArEnabled(host) {
  return host?.getAttribute?.(CABINET_AR_FEATURE_ATTRIBUTE) === "true";
}

export async function detectArCapability(environment = globalThis) {
  const navigatorObject = environment.navigator || {};
  const userAgent = String(navigatorObject.userAgent || "");
  const isIos = /iPad|iPhone|iPod/.test(userAgent) || (navigatorObject.platform === "MacIntel" && navigatorObject.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(userAgent);
  const isMobile = isIos || isAndroid || Boolean(environment.matchMedia?.("(pointer: coarse)")?.matches);
  let webXr = false;
  if (environment.isSecureContext !== false && navigatorObject.xr?.isSessionSupported) {
    try {
      webXr = await navigatorObject.xr.isSessionSupported("immersive-ar");
    } catch (error) {
      webXr = false;
    }
  }
  const quickLook = isIos && supportsQuickLook(environment.document);
  const sceneViewer = isAndroid;
  return {
    deviceCategory: isMobile ? "mobile" : "desktop",
    operatingSystem: isIos ? "ios" : isAndroid ? "android" : "desktop",
    webXr,
    quickLook,
    sceneViewer,
    canLaunchAr: Boolean(webXr || quickLook || sceneViewer),
    requiresHttps: environment.isSecureContext === false,
    isInAppBrowser: /(FBAN|FBAV|Instagram|Line\/|wv\))/i.test(userAgent)
  };
}

export function createArAnalyticsPayload(eventName, metadata = {}) {
  const allowed = [
    "productId", "configurationId", "deviceCategory", "operatingSystem", "arMode",
    "configurationHash", "failureReason"
  ];
  return allowed.reduce((payload, key) => {
    const value = metadata[key];
    if (value !== undefined && value !== null && value !== "") payload[key] = String(value).slice(0, 120);
    return payload;
  }, { event: eventName });
}

export function emitArAnalytics(eventName, metadata = {}, environment = globalThis) {
  const payload = createArAnalyticsPayload(eventName, metadata);
  if (Array.isArray(environment.dataLayer)) environment.dataLayer.push(payload);
  const EventConstructor = environment.CustomEvent || globalThis.CustomEvent;
  if (environment.document?.dispatchEvent && EventConstructor) {
    environment.document.dispatchEvent(new EventConstructor("jq:analytics", { detail: payload }));
  }
  return payload;
}

export function createArModelRequestCoordinator(resolver) {
  let sequence = 0;
  let destroyed = false;
  let activeController = null;
  return {
    async request(configuration, options = {}) {
      const requestSequence = ++sequence;
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;
      const callerSignal = options.signal;
      const abortForCaller = () => controller.abort(callerSignal?.reason);
      if (callerSignal?.aborted) abortForCaller();
      else callerSignal?.addEventListener?.("abort", abortForCaller, { once: true });
      try {
        const result = await resolver(configuration, { ...options, signal: controller.signal });
        return { result, stale: destroyed || requestSequence !== sequence };
      } finally {
        callerSignal?.removeEventListener?.("abort", abortForCaller);
        if (activeController === controller) activeController = null;
      }
    },
    invalidate() {
      sequence += 1;
      activeController?.abort();
      activeController = null;
    },
    destroy() {
      destroyed = true;
      sequence += 1;
      activeController?.abort();
      activeController = null;
    }
  };
}

export function createArModelProvider(options = {}) {
  const generateProceduralModel = options.generateProceduralModel;
  const endpoint = String(options.endpoint || "").trim();
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const remoteTimeoutMs = normalizeTimeout(options.remoteTimeoutMs, CABINET_AR_REMOTE_TIMEOUT_MS);
  return async function resolveArModel(configuration, context = {}) {
    const suppliedPosterUrl = context.posterUrl || null;
    let configurationHash = "";
    let generatedModel = null;
    let retainedModel = null;
    let resolved = null;
    const releasedUrls = new Set();
    try {
      configurationHash = hashCabinetArConfiguration(configuration);
      throwIfAborted(context.signal);
      const cached = readCachedModel(configurationHash);
      if (cached) {
        retainedModel = cached;
        return cached;
      }

      let remoteError = null;
      if (endpoint && typeof fetchImpl === "function") {
        try {
          resolved = await requestRemoteModel(
            endpoint,
            configuration,
            configurationHash,
            fetchImpl,
            context.signal,
            remoteTimeoutMs
          );
        } catch (error) {
          if (context.signal?.aborted || isAbortError(error)) throw error;
          remoteError = error;
        }
      }
      throwIfAborted(context.signal);
      if (!resolved && typeof generateProceduralModel === "function") {
        generatedModel = await generateProceduralModel(configuration, context);
        throwIfAborted(context.signal);
        resolved = {
          configurationHash,
          glbUrl: validateModelUrl(generatedModel.glbUrl, "glbUrl"),
          usdzUrl: generatedModel.usdzUrl ? validateModelUrl(generatedModel.usdzUrl, "usdzUrl") : null,
          posterUrl: generatedModel.posterUrl ? validateModelUrl(generatedModel.posterUrl, "posterUrl") : null,
          status: "ready",
          source: "procedural"
        };
      }
      if (!resolved?.glbUrl) {
        if (remoteError) throw remoteError;
        throw new Error("A 3D model could not be prepared for this configuration.");
      }
      retainedModel = writeCachedModel(configurationHash, resolved, releasedUrls);
      return retainedModel;
    } catch (error) {
      if (resolved && resolved !== retainedModel) releaseModelObjectUrls(resolved, releasedUrls);
      if (generatedModel && generatedModel !== retainedModel) releaseModelObjectUrls(generatedModel, releasedUrls);
      throw error;
    } finally {
      releaseUnusedObjectUrl(suppliedPosterUrl, retainedModel || generatedModel, releasedUrls);
    }
  };
}

export function clearArModelCache() {
  const cachedModels = [...configurationCache.values()];
  configurationCache.clear();
  const releasedUrls = new Set();
  cachedModels.forEach((model) => releaseModelObjectUrls(model, releasedUrls));
}

async function requestRemoteModel(endpoint, configuration, expectedHash, fetchImpl, signal, timeoutMs) {
  throwIfAborted(signal);
  const requestController = new AbortController();
  let timeoutId;
  let rejectCancellation;
  const cancellation = new Promise((resolve, reject) => { rejectCancellation = reject; });
  const cancelForCaller = () => {
    const error = abortReason(signal);
    requestController.abort(error);
    rejectCancellation(error);
  };
  signal?.addEventListener?.("abort", cancelForCaller, { once: true });
  timeoutId = globalThis.setTimeout(() => {
    const error = new Error("The AR model service timed out.");
    requestController.abort(error);
    rejectCancellation(error);
  }, timeoutMs);

  const request = (async () => {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ configuration }),
      credentials: "same-origin",
      signal: requestController.signal
    });
    if (!response.ok) throw new Error("The AR model service is temporarily unavailable.");
    const contentType = response.headers?.get?.("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) throw new Error("The AR model service returned an invalid response.");
    const payload = await response.json();
    if (payload.status !== "ready") {
      if (payload.status === "processing") throw new Error("The AR model is still being prepared. Please try again shortly.");
      throw new Error("This configuration is not available for AR yet.");
    }
    if (payload.configurationHash !== expectedHash) throw new Error("The AR model response did not match this configuration.");
    return {
      configurationHash: expectedHash,
      glbUrl: validateModelUrl(payload.glbUrl, "glbUrl"),
      usdzUrl: payload.usdzUrl ? validateModelUrl(payload.usdzUrl, "usdzUrl") : null,
      posterUrl: payload.posterUrl ? validateModelUrl(payload.posterUrl, "posterUrl") : null,
      status: "ready",
      source: "remote"
    };
  })();

  try {
    return await Promise.race([request, cancellation]);
  } finally {
    globalThis.clearTimeout(timeoutId);
    signal?.removeEventListener?.("abort", cancelForCaller);
  }
}

function readCachedModel(configurationHash) {
  const cached = configurationCache.get(configurationHash);
  if (!cached) return null;
  configurationCache.delete(configurationHash);
  configurationCache.set(configurationHash, cached);
  return cached;
}

function writeCachedModel(configurationHash, model, releasedUrls = new Set()) {
  const existing = readCachedModel(configurationHash);
  if (existing) {
    releaseModelObjectUrls(model, releasedUrls);
    return existing;
  }
  configurationCache.set(configurationHash, model);
  while (configurationCache.size > CABINET_AR_MODEL_CACHE_LIMIT) {
    const oldestHash = configurationCache.keys().next().value;
    const oldestModel = configurationCache.get(oldestHash);
    configurationCache.delete(oldestHash);
    releaseModelObjectUrls(oldestModel);
  }
  return model;
}

function releaseModelObjectUrls(model, releasedUrls = new Set()) {
  [model?.glbUrl, model?.usdzUrl, model?.posterUrl].forEach((url) => {
    if (!isObjectUrl(url) || releasedUrls.has(url) || cacheReferencesUrl(url)) return;
    releasedUrls.add(url);
    revokeObjectUrl(url);
  });
}

function releaseUnusedObjectUrl(url, retainedModel, releasedUrls = new Set()) {
  if (!isObjectUrl(url) || releasedUrls.has(url) || modelReferencesUrl(retainedModel, url) || cacheReferencesUrl(url)) return;
  releasedUrls.add(url);
  revokeObjectUrl(url);
}

function modelReferencesUrl(model, url) {
  return Boolean(model && [model.glbUrl, model.usdzUrl, model.posterUrl].includes(url));
}

function cacheReferencesUrl(url) {
  return [...configurationCache.values()].some((model) => modelReferencesUrl(model, url));
}

function isObjectUrl(value) {
  return typeof value === "string" && value.trim().startsWith("blob:");
}

function revokeObjectUrl(url) {
  try {
    globalThis.URL?.revokeObjectURL?.(url);
  } catch {
    // Object URL cleanup is best-effort and must not hide the model result.
  }
}

function normalizeTimeout(value, fallback) {
  if (value === undefined) return fallback;
  const milliseconds = Number(value);
  return Number.isFinite(milliseconds) && milliseconds >= 0 ? milliseconds : fallback;
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw abortReason(signal);
}

function abortReason(signal) {
  if (signal?.reason instanceof Error) return signal.reason;
  if (typeof DOMException === "function") return new DOMException("The operation was aborted.", "AbortError");
  const error = new Error("The operation was aborted.");
  error.name = "AbortError";
  return error;
}

function isAbortError(error) {
  return error?.name === "AbortError";
}

function validateRawDimensions(config) {
  ["width", "height", "depth"].forEach((field) => {
    const value = Number(config?.[field]);
    if (!Number.isFinite(value) || value <= 0) throw new RangeError(`Cabinet ${field} must be a positive number.`);
  });
}

function validateModelUrl(value, field) {
  let url;
  try {
    url = new URL(String(value), globalThis.location?.href || "https://jqbookcases.example/");
  } catch (error) {
    throw new Error(`The model provider returned an invalid ${field}.`);
  }
  if (!MODEL_URL_PROTOCOLS.has(url.protocol)) throw new Error(`The model provider returned an unsafe ${field}.`);
  return url.toString();
}

function supportsQuickLook(documentObject) {
  try {
    const anchor = documentObject?.createElement?.("a");
    return Boolean(anchor?.relList?.supports?.("ar"));
  } catch (error) {
    return false;
  }
}

function cleanIdentifier(value, fallback) {
  const cleaned = String(value || "").trim().replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80);
  return cleaned || fallback;
}

function parseSectionIndex(parentId) {
  const match = String(parentId || "").match(/section-(\d+)/);
  return match ? Math.max(0, Number(match[1]) - 1) : 0;
}

function createArHardwareScheduleEntry(component) {
  const metadata = component?.metadata || {};
  const snapshot = metadata.hardwareSnapshot || metadata.variantSnapshot || {};
  const category = metadata.category || snapshot.category || (metadata.hardwareType === "knob" ? "round_knob" : "bar_pull");
  return {
    componentId: component.id,
    hostId: component.hostId || component.parentId || null,
    variantId: metadata.variantId || snapshot.variantId || snapshot.id || metadata.hardware || null,
    category,
    canonicalFinishId: snapshot.canonicalFinishId || null,
    finishName: snapshot.finishName || null,
    finishSwatch: metadata.finishSwatch || snapshot.canonicalFinishSwatch || null,
    orientation: metadata.orientation || null,
    quantityIndex: Number(metadata.quantityIndex) || 1,
    proxyMode: metadata.proxyMode || null,
    modelAccuracy: metadata.modelAccuracy || snapshot.modelAccuracy || null
  };
}

function compactLayoutMetadataForHandoff(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return metadata;
  const sectionConfigs = Array.isArray(metadata.sectionConfigs) ? metadata.sectionConfigs : [];
  if (!sectionConfigs.length) return metadata;
  const compact = { ...metadata };
  delete compact.sectionConfigs;
  delete compact.sectionTypes;
  delete compact.sectionDoorLayouts;
  compact[SECTION_STORAGE_HANDOFF_KEY] = sectionConfigs.map((section) => [
    section.id,
    section.type,
    section.shelfCount,
    section.shelfDistribution,
    section.doorStyle,
    section.doorArrangement,
    section.drawerCount,
    section.drawerFrontStyle,
    section.lowerStorageHeight
  ]);
  return compact;
}

function expandLayoutMetadataFromHandoff(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return metadata;
  const records = metadata[SECTION_STORAGE_HANDOFF_KEY];
  if (!Array.isArray(records)) return metadata;
  const expanded = { ...metadata };
  delete expanded[SECTION_STORAGE_HANDOFF_KEY];
  expanded.sectionConfigs = records.map((record) => Array.isArray(record) ? {
    schemaVersion: 1,
    id: record[0],
    type: record[1],
    shelfCount: record[2],
    shelfDistribution: record[3],
    doorStyle: record[4],
    doorArrangement: record[5],
    drawerCount: record[6],
    drawerFrontStyle: record[7],
    lowerStorageHeight: record[8]
  } : record);
  return expanded;
}

function compactHardwareSelectionsForHandoff(selections) {
  const compactable = cloneHardwareHandoffValue(selections);
  if (isEmbeddedHardwareSnapshot(compactable?.defaultSnapshot, compactable?.defaultVariantId)) {
    compactable.defaultSnapshot = null;
  } else if (compactable?.defaultSnapshot) {
    compactable.defaultSnapshot = compactHardwareSnapshotForHandoff(compactable.defaultSnapshot);
  }
  for (const selection of Object.values(compactable?.byHostId || {})) {
    if (isEmbeddedHardwareSnapshot(selection?.snapshot, selection?.variantId)) selection.snapshot = null;
    else if (selection?.snapshot) selection.snapshot = compactHardwareSnapshotForHandoff(selection.snapshot);
  }
  return {
    marker: HARDWARE_HANDOFF_MARKER,
    value: transformHardwareHandoffKeys(compactable, HARDWARE_HANDOFF_KEY_TO_ALIAS)
  };
}

function expandHardwareSelectionsFromHandoff(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.marker !== HARDWARE_HANDOFF_MARKER) {
    return value;
  }
  return expandHardwareSnapshotsFromHandoff(
    transformHardwareHandoffKeys(value.value, HARDWARE_HANDOFF_ALIAS_TO_KEY)
  );
}

function transformHardwareHandoffKeys(value, keyMap) {
  if (Array.isArray(value)) return value.map((entry) => transformHardwareHandoffKeys(entry, keyMap));
  if (!value || typeof value !== "object") return value;
  const encoding = keyMap === HARDWARE_HANDOFF_KEY_TO_ALIAS;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
    const transformedKey = encoding
      ? keyMap.get(key) || (key.startsWith("~") ? `~${key}` : key)
      : key.startsWith("~~") ? key.slice(1) : keyMap.get(key) || key;
    return [transformedKey, transformHardwareHandoffKeys(entry, keyMap)];
  }));
}

function isEmbeddedHardwareSnapshot(snapshot, variantId) {
  if (!snapshot || !variantId) return false;
  const embedded = createHardwareVariantSnapshot(null, variantId);
  return Boolean(embedded) && equalHardwareHandoffValues(embedded, snapshot);
}

function cloneHardwareHandoffValue(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function compactHardwareSnapshotForHandoff(snapshot) {
  const compact = {
    snapshotMarker: HARDWARE_SNAPSHOT_HANDOFF_MARKER,
    schemaVersion: snapshot.schemaVersion,
    catalogVersion: snapshot.catalogVersion,
    id: snapshot.id,
    variantId: snapshot.variantId,
    selectable: snapshot.selectable,
    releaseGate: snapshot.releaseGate,
    warnings: snapshot.warnings,
    brand: snapshot.brand,
    collection: snapshot.collection,
    family: snapshot.family,
    size: snapshot.size,
    finish: snapshot.finish,
    exact: snapshot.exact,
    sources: snapshot.sources
  };
  const expanded = expandCompactHardwareSnapshot(compact);
  return equalHardwareHandoffValues(expanded, snapshot) ? compact : snapshot;
}

function equalHardwareHandoffValues(left, right) {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((entry, index) => equalHardwareHandoffValues(entry, right[index]));
  }
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => key === rightKeys[index] && equalHardwareHandoffValues(left[key], right[key]));
}

function expandHardwareSnapshotsFromHandoff(value) {
  if (Array.isArray(value)) return value.map(expandHardwareSnapshotsFromHandoff);
  if (!value || typeof value !== "object") return value;
  if (value.snapshotMarker === HARDWARE_SNAPSHOT_HANDOFF_MARKER) return expandCompactHardwareSnapshot(value);
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
    key,
    expandHardwareSnapshotsFromHandoff(entry)
  ]));
}

function expandCompactHardwareSnapshot(compact) {
  const brand = compact.brand || {};
  const collection = compact.collection || {};
  const family = compact.family || {};
  const size = compact.size || {};
  const finish = compact.finish || {};
  const canonical = finish.canonical || {};
  const exact = compact.exact || {};
  return {
    schemaVersion: compact.schemaVersion,
    catalogVersion: compact.catalogVersion,
    id: compact.id,
    variantId: compact.variantId,
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
    canonicalFinishGroup: canonical.group,
    canonicalFinishSwatch: canonical.swatch,
    manufacturerProductNumber: exact.manufacturerProductNumber,
    sku: exact.sku,
    dimensionsMm: cloneHardwareHandoffValue(size.dimensionsMm),
    mounting: cloneHardwareHandoffValue(size.mounting),
    pricing: cloneHardwareHandoffValue(exact.pricing),
    availability: cloneHardwareHandoffValue(exact.availability),
    productStatus: exact.productStatus,
    lastVerifiedAt: exact.lastVerifiedAt,
    asset: cloneHardwareHandoffValue(family.asset),
    modelAccuracy: family.asset?.accuracy,
    selectable: compact.selectable,
    releaseGate: compact.releaseGate,
    warnings: cloneHardwareHandoffValue(compact.warnings),
    brand: cloneHardwareHandoffValue(brand),
    collection: cloneHardwareHandoffValue(collection),
    family: cloneHardwareHandoffValue(family),
    size: cloneHardwareHandoffValue(size),
    finish: cloneHardwareHandoffValue(finish),
    exact: cloneHardwareHandoffValue(exact),
    sources: cloneHardwareHandoffValue(compact.sources)
  };
}

function roundMeters(value) {
  return Math.round(value * 1e6) / 1e6;
}

function sortForSerialization(value) {
  if (Array.isArray(value)) return value.map(sortForSerialization);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value).sort().reduce((result, key) => {
    result[key] = sortForSerialization(value[key]);
    return result;
  }, {});
}

function toHex(value) {
  return (value >>> 0).toString(16).padStart(8, "0");
}

function encodeBase64Url(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function decodeBase64Url(value) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function decodeConfigurationToken(token) {
  if (!token.startsWith(COMPRESSED_CONFIGURATION_PREFIX)) return decodeBase64Url(token);
  const compressed = token.slice(COMPRESSED_CONFIGURATION_PREFIX.length);
  const decompressed = decompressConfigurationString(compressed);
  if (typeof decompressed === "string" && decompressed.startsWith("[")) return decompressed;
  // A pre-existing raw base64url token can coincidentally start with the
  // compression marker. Preserve the schema-v1 decoder contract in that case.
  return decodeBase64Url(token);
}

// This is the small URI-safe LZ dictionary codec used only for AR handoff
// tokens. It keeps the synchronous share-link API while making complete saved
// hardware snapshots practical for QR byte-mode capacity.
function compressConfigurationString(value) {
  if (value == null) return "";
  return compressLz(value, 6, (code) => COMPRESSION_ALPHABET.charAt(code));
}

function decompressConfigurationString(value) {
  if (value == null || value === "") return null;
  const reverse = getCompressionAlphabetReverse();
  return decompressLz(value.length, 32, (index) => reverse[value.charAt(index)]);
}

let compressionAlphabetReverse = null;
function getCompressionAlphabetReverse() {
  if (compressionAlphabetReverse) return compressionAlphabetReverse;
  compressionAlphabetReverse = Object.create(null);
  for (let index = 0; index < COMPRESSION_ALPHABET.length; index += 1) {
    compressionAlphabetReverse[COMPRESSION_ALPHABET.charAt(index)] = index;
  }
  return compressionAlphabetReverse;
}

function compressLz(uncompressed, bitsPerCharacter, getCharacter) {
  const dictionary = Object.create(null);
  const dictionaryToCreate = Object.create(null);
  let current = "";
  let combined = "";
  let previous = "";
  let enlargeIn = 2;
  let dictionarySize = 3;
  let numberOfBits = 2;
  const data = [];
  let dataValue = 0;
  let dataPosition = 0;

  const writeBit = (bit) => {
    dataValue = (dataValue << 1) | bit;
    if (dataPosition === bitsPerCharacter - 1) {
      dataPosition = 0;
      data.push(getCharacter(dataValue));
      dataValue = 0;
    } else {
      dataPosition += 1;
    }
  };
  const writeBits = (count, input) => {
    let numeric = input;
    for (let index = 0; index < count; index += 1) {
      writeBit(numeric & 1);
      numeric >>= 1;
    }
  };
  const consumeDictionarySlot = () => {
    enlargeIn -= 1;
    if (enlargeIn === 0) {
      enlargeIn = 2 ** numberOfBits;
      numberOfBits += 1;
    }
  };
  const writeDictionaryValue = (input) => {
    if (Object.prototype.hasOwnProperty.call(dictionaryToCreate, input)) {
      const code = input.charCodeAt(0);
      if (code < 256) {
        writeBits(numberOfBits, 0);
        writeBits(8, code);
      } else {
        writeBits(numberOfBits, 1);
        writeBits(16, code);
      }
      consumeDictionarySlot();
      delete dictionaryToCreate[input];
    } else {
      writeBits(numberOfBits, dictionary[input]);
    }
    consumeDictionarySlot();
  };

  for (let index = 0; index < uncompressed.length; index += 1) {
    current = uncompressed.charAt(index);
    if (!Object.prototype.hasOwnProperty.call(dictionary, current)) {
      dictionary[current] = dictionarySize;
      dictionarySize += 1;
      dictionaryToCreate[current] = true;
    }
    combined = previous + current;
    if (Object.prototype.hasOwnProperty.call(dictionary, combined)) {
      previous = combined;
    } else {
      writeDictionaryValue(previous);
      dictionary[combined] = dictionarySize;
      dictionarySize += 1;
      previous = current;
    }
  }
  if (previous !== "") writeDictionaryValue(previous);
  writeBits(numberOfBits, 2);
  while (true) {
    dataValue <<= 1;
    if (dataPosition === bitsPerCharacter - 1) {
      data.push(getCharacter(dataValue));
      break;
    }
    dataPosition += 1;
  }
  return data.join("");
}

function decompressLz(length, resetValue, getNextValue) {
  const dictionary = [0, 1, 2];
  const data = { value: getNextValue(0), position: resetValue, index: 1 };
  let enlargeIn = 4;
  let dictionarySize = 4;
  let numberOfBits = 3;

  const readBits = (count) => {
    let bits = 0;
    let power = 1;
    const maximumPower = 2 ** count;
    while (power !== maximumPower) {
      const resultBit = data.value & data.position;
      data.position >>= 1;
      if (data.position === 0) {
        data.position = resetValue;
        data.value = getNextValue(data.index);
        data.index += 1;
      }
      bits |= (resultBit > 0 ? 1 : 0) * power;
      power <<= 1;
    }
    return bits;
  };

  let next = readBits(2);
  let character;
  if (next === 0) character = String.fromCharCode(readBits(8));
  else if (next === 1) character = String.fromCharCode(readBits(16));
  else if (next === 2) return "";
  else return null;
  dictionary[3] = character;
  let previous = character;
  const result = [character];
  let resultLength = character.length;

  while (true) {
    if (data.index > length) return null;
    let code = readBits(numberOfBits);
    if (code === 0 || code === 1) {
      character = String.fromCharCode(readBits(code === 0 ? 8 : 16));
      dictionary[dictionarySize] = character;
      code = dictionarySize;
      dictionarySize += 1;
      enlargeIn -= 1;
    } else if (code === 2) {
      return result.join("");
    }
    if (enlargeIn === 0) {
      enlargeIn = 2 ** numberOfBits;
      numberOfBits += 1;
    }

    let entry;
    if (dictionary[code] !== undefined) entry = dictionary[code];
    else if (code === dictionarySize) entry = previous + previous.charAt(0);
    else return null;
    resultLength += entry.length;
    if (resultLength > MAX_DECOMPRESSED_CONFIGURATION_LENGTH) return null;
    result.push(entry);
    dictionary[dictionarySize] = previous + entry.charAt(0);
    dictionarySize += 1;
    enlargeIn -= 1;
    previous = entry;
    if (enlargeIn === 0) {
      enlargeIn = 2 ** numberOfBits;
      numberOfBits += 1;
    }
  }
}
