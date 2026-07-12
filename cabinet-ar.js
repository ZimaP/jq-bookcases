import { createDesignId, defaultBookcaseConfig, normalizeBookcaseConfig } from "./bookcase-config.js";

export const CABINET_AR_SCHEMA_VERSION = 1;
export const CABINET_AR_FEATURE_ATTRIBUTE = "data-enable-cabinet-ar";
export const CABINET_AR_SHARE_PARAMETER = "arConfig";
export const CABINET_AR_MODEL_VIEWER_URL = "https://ajax.googleapis.com/ajax/libs/model-viewer/4.3.1/model-viewer.min.js";
export const CABINET_AR_QR_MODULE_URL = "https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm";

const CONFIGURATION_FIELDS = Object.freeze(Object.keys(defaultBookcaseConfig));
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
  const productId = cleanIdentifier(options.productId || normalized.layoutType || normalized.layoutPreset, "cabinet");
  const configurationId = cleanIdentifier(options.configurationId || createDesignId(normalized, options.price || 0), "");
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

  return {
    schemaVersion: CABINET_AR_SCHEMA_VERSION,
    productId,
    ...(configurationId ? { configurationId } : {}),
    units: "meters",
    widthMeters: roundMeters(inchesToMeters(normalized.width)),
    heightMeters: roundMeters(inchesToMeters(normalized.height)),
    depthMeters: roundMeters(inchesToMeters(normalized.depth)),
    sections: normalized.sections,
    shelves,
    layoutType: normalized.layoutType,
    shelfThicknessMeters: roundMeters(inchesToMeters(normalized.shelfThickness)),
    lowerCabinets: normalized.lowerCabinets,
    lowerStorage: normalized.lowerStorage,
    drawerCount: normalized.drawerCount,
    centerOpening: normalized.centerOpening,
    deskOpening: normalized.deskOpening,
    featureOpening: normalized.featureOpening,
    tallDoors: normalized.tallDoors,
    doorStyleId: normalized.doorStyle,
    doorCount: normalized.doorCount,
    baseStyleId: normalized.baseStyle,
    crownStyleId: normalized.crownStyle,
    finishId: normalized.finish,
    finishPreviewHex: normalized.customPaintHex || null,
    hardwareId: normalized.hardware,
    lightingId: normalized.lighting,
    lightingWarmthKelvin: normalized.lightingWarmth,
    layoutMetadata: normalized.layoutMetadata
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
    return normalizeBookcaseConfig(candidate);
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
  return {
    async request(configuration, options) {
      const requestSequence = ++sequence;
      const result = await resolver(configuration, options);
      return { result, stale: destroyed || requestSequence !== sequence };
    },
    invalidate() {
      sequence += 1;
    },
    destroy() {
      destroyed = true;
      sequence += 1;
    }
  };
}

export function createArModelProvider(options = {}) {
  const generateProceduralModel = options.generateProceduralModel;
  const endpoint = String(options.endpoint || "").trim();
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  return async function resolveArModel(configuration, context = {}) {
    const configurationHash = hashCabinetArConfiguration(configuration);
    if (configurationCache.has(configurationHash)) return configurationCache.get(configurationHash);

    let resolved = null;
    if (endpoint && typeof fetchImpl === "function") {
      resolved = await requestRemoteModel(endpoint, configuration, configurationHash, fetchImpl, context.signal);
    }
    if (!resolved && typeof generateProceduralModel === "function") {
      const generated = await generateProceduralModel(configuration, context);
      resolved = {
        configurationHash,
        glbUrl: validateModelUrl(generated.glbUrl, "glbUrl"),
        usdzUrl: generated.usdzUrl ? validateModelUrl(generated.usdzUrl, "usdzUrl") : null,
        posterUrl: generated.posterUrl ? validateModelUrl(generated.posterUrl, "posterUrl") : null,
        status: "ready",
        source: "procedural"
      };
    }
    if (!resolved?.glbUrl) throw new Error("A 3D model could not be prepared for this configuration.");
    configurationCache.set(configurationHash, resolved);
    return resolved;
  };
}

export function clearArModelCache() {
  configurationCache.clear();
}

async function requestRemoteModel(endpoint, configuration, expectedHash, fetchImpl, signal) {
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ configuration }),
    credentials: "same-origin",
    signal
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
