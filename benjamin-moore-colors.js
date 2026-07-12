export const BENJAMIN_MOORE_COLOR_DATA_NOTICE =
  "Digital preview only. On-screen colors may differ from actual paint because of your display, lighting, paint product, and sheen. Confirm the final color with an official Benjamin Moore sample.";

export const BENJAMIN_MOORE_OFFICIAL_COLORS_URL = "https://www.benjaminmoore.com/en-us/paint-colors";
export const BENJAMIN_MOORE_OFFICIAL_PALETTES_URL = "https://www.benjaminmoore.com/en-us/architects-designers/download-benjamin-moore-color-palettes";
export const BENJAMIN_MOORE_CATALOG_URL = "./data/generated/benjamin-moore-colors.json?v=bm-ase-aab26493687b";

export class ColorCatalogProvider {
  search() { throw new Error("ColorCatalogProvider.search() must be implemented."); }
  getByCode() { throw new Error("ColorCatalogProvider.getByCode() must be implemented."); }
  getById() { throw new Error("ColorCatalogProvider.getById() must be implemented."); }
  normalizeCode(value) { return normalizeBenjaminMooreCode(value); }
  getCatalogMetadata() { throw new Error("ColorCatalogProvider.getCatalogMetadata() must be implemented."); }
  getOfficialReference() { return null; }
}

export class BenjaminMooreColorCatalogProvider extends ColorCatalogProvider {
  constructor(options = {}) {
    super();
    this.catalogUrl = options.catalogUrl || BENJAMIN_MOORE_CATALOG_URL;
    this.catalogLoader = options.catalogLoader || (() => loadCatalogJson(this.catalogUrl));
    this.catalogPromise = null;
    this.catalog = null;
    this.index = null;
  }

  async load() {
    if (!this.catalogPromise) {
      this.catalogPromise = Promise.resolve(this.catalogLoader()).then((payload) => {
        if (!payload || !Array.isArray(payload.colors)) throw new Error("The Benjamin Moore color catalog is unavailable.");
        this.catalog = payload;
        this.index = buildIndex(payload.colors);
        return payload;
      }).catch((error) => {
        this.catalogPromise = null;
        throw error;
      });
    }
    return this.catalogPromise;
  }

  async search(query, options = {}) {
    const queryKey = normalizeBenjaminMooreQuery(query);
    if (!queryKey) return [];
    await this.load();
    const requestedLimit = Number(options.limit);
    const limit = Number.isFinite(requestedLimit) ? Math.max(0, Math.min(20, Math.floor(requestedLimit))) : 12;
    if (!limit) return [];
    const normalizedCode = this.normalizeCode(query);
    const canonicalCode = normalizeCanonicalCode(query);
    const queryWords = queryKey.split(" ").filter(Boolean);
    return this.index.entries
      .map((entry) => ({ entry, score: scoreEntry(entry, { queryKey, normalizedCode, canonicalCode, queryWords }) }))
      .filter((candidate) => Number.isFinite(candidate.score))
      .sort((left, right) => left.score - right.score || left.entry.color.name.localeCompare(right.entry.color.name) || left.entry.color.code.localeCompare(right.entry.color.code, "en", { numeric: true }))
      .slice(0, limit)
      .map((candidate) => candidate.entry.color);
  }

  async getByCode(code) {
    await this.load();
    return this.index.byCode.get(this.normalizeCode(code)) || null;
  }

  async getById(id) {
    await this.load();
    return this.index.byId.get(String(id || "")) || null;
  }

  async getByName(name) {
    await this.load();
    return this.index.byName.get(normalizeBenjaminMooreQuery(name)) || null;
  }

  async getExact(value) {
    if (value && typeof value === "object") {
      const byCode = value.code ? await this.getByCode(value.code) : null;
      const byName = value.name ? await this.getByName(value.name) : null;
      if (value.code && value.name) return byCode && byCode === byName ? byCode : null;
      return byCode || byName;
    }
    const byCode = await this.getByCode(value);
    if (byCode) return byCode;
    return this.getByName(value);
  }

  async getCatalogMetadata() {
    const catalog = await this.load();
    const { colors: _colors, ...metadata } = catalog;
    return metadata;
  }

  getOfficialReference() {
    return BENJAMIN_MOORE_OFFICIAL_COLORS_URL;
  }
}

export function normalizeBenjaminMooreQuery(value) {
  if (value == null) return "";
  const stringValue = typeof value === "string" || typeof value === "number" ? String(value) : "";
  return stringValue
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .toLowerCase()
    .replace(/[’'`®™]/g, "")
    .replace(/&/g, " and ")
    .replace(/([a-z])([0-9])/g, "$1 $2")
    .replace(/([0-9])([a-z])/g, "$1 $2")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeBenjaminMooreCode(value) {
  return String(value == null ? "" : value).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function createBenjaminMoorePaintSelection(color) {
  if (!color || typeof color !== "object") return null;
  return {
    source: "benjamin-moore",
    brand: "Benjamin Moore",
    catalogId: String(color.id || ""),
    code: String(color.code || ""),
    name: String(color.name || ""),
    collections: Array.isArray(color.collections) ? color.collections.map(String) : [],
    previewHex: String(color.hex || ""),
    previewRgb: color.rgb ? { r: Number(color.rgb.r), g: Number(color.rgb.g), b: Number(color.rgb.b) } : null,
    catalogVersion: String(color.catalogVersion || ""),
    sourceType: "official-palette"
  };
}

function buildIndex(colors) {
  const entries = colors.map((color) => ({
    color,
    canonicalCode: normalizeCanonicalCode(color.code),
    codeKey: normalizeBenjaminMooreCode(color.code),
    nameKey: normalizeBenjaminMooreQuery(color.name),
    nameWords: normalizeBenjaminMooreQuery(color.name).split(" ").filter(Boolean),
    aliasKeys: (color.aliases || []).map(normalizeBenjaminMooreQuery)
  }));
  return {
    entries,
    byCode: new Map(entries.map((entry) => [entry.codeKey, entry.color])),
    byId: new Map(entries.map((entry) => [entry.color.id, entry.color])),
    byName: new Map(entries.flatMap((entry) => [[entry.nameKey, entry.color], ...entry.aliasKeys.map((alias) => [alias, entry.color])]))
  };
}

function scoreEntry(entry, query) {
  if (query.canonicalCode && entry.canonicalCode === query.canonicalCode) return 0;
  if (query.normalizedCode && entry.codeKey === query.normalizedCode) return 1;
  if (entry.nameKey === query.queryKey || entry.aliasKeys.includes(query.queryKey)) return 2;
  if (entry.nameKey.startsWith(query.queryKey)) return 3;
  if (query.normalizedCode && entry.codeKey.startsWith(query.normalizedCode)) return 4;
  if (query.queryWords.length && query.queryWords.every((word) => entry.nameWords.some((candidate) => candidate.startsWith(word)))) return 5;
  if (entry.nameKey.includes(query.queryKey) || entry.aliasKeys.some((alias) => alias.includes(query.queryKey))) return 6;
  return Number.POSITIVE_INFINITY;
}

function normalizeCanonicalCode(value) {
  return String(value == null ? "" : value).trim().toUpperCase().replace(/\s+/g, "-");
}

async function loadCatalogJson(url) {
  const response = await fetch(url, { credentials: "same-origin", cache: "force-cache" });
  if (!response.ok) throw new Error(`Catalog request failed with status ${response.status}.`);
  return response.json();
}

let sharedProvider;
export function getBenjaminMooreColorCatalogProvider() {
  if (!sharedProvider) sharedProvider = new BenjaminMooreColorCatalogProvider();
  return sharedProvider;
}

export async function searchBenjaminMooreColors(query, options) {
  return getBenjaminMooreColorCatalogProvider().search(query, options);
}

export async function findExactBenjaminMooreColor(value) {
  return getBenjaminMooreColorCatalogProvider().getExact(value);
}

export async function findBenjaminMooreColorByCode(value) {
  return getBenjaminMooreColorCatalogProvider().getByCode(value);
}

export async function findBenjaminMooreColorByName(value) {
  return getBenjaminMooreColorCatalogProvider().getByName(value);
}
