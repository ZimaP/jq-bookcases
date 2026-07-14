import {
  createDesignId,
  migrateLegacyConstructionConfig,
  normalizeBookcaseConfig
} from "./bookcase-config.js?v=configurator-construction-20260714b";

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
  "constructionProfile"
]);
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

export function encodeCabinetConfiguration(config) {
  const normalized = normalizeBookcaseConfig(config);
  const values = CONFIGURATION_FIELDS.map((field) => normalized[field]);
  return encodeBase64Url(JSON.stringify([CABINET_AR_SCHEMA_VERSION, values]));
}

export function decodeCabinetConfiguration(token) {
  if (typeof token !== "string" || !token || token.length > 4096 || !/^[A-Za-z0-9_-]+$/.test(token)) return null;
  try {
    const payload = JSON.parse(decodeBase64Url(token));
    if (!Array.isArray(payload) || payload[0] !== CABINET_AR_SCHEMA_VERSION || !Array.isArray(payload[1])) return null;
    const candidate = {};
    CONFIGURATION_FIELDS.forEach((field, index) => {
      if (index < payload[1].length) candidate[field] = payload[1][index];
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
