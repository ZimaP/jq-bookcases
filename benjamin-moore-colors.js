/**
 * Curated local Benjamin Moore color lookup.
 *
 * This module is not an official Benjamin Moore API, does not make network
 * requests, and is not a substitute for a physical paint sample. Color names
 * and codes are catalog references; approximateHex values are deliberately
 * documented as screen-preview approximations only. On-screen color depends
 * on display calibration, lighting, paint product, substrate, and sheen.
 */

export const BENJAMIN_MOORE_COLOR_DATA_NOTICE =
  "Curated local catalog subset with approximate digital preview colors; not an official Benjamin Moore API or a color-accuracy guarantee.";

export const BENJAMIN_MOORE_DATASET_INFO = Object.freeze({
  kind: "curated-local-approximation",
  officialApiConnection: false,
  runtimeNetworkAccess: false,
  colorAccuracyGuaranteed: false,
  hexField: "approximateHex",
  lastReviewed: "2026-07-09",
  catalogSource: "Public Benjamin Moore color catalog",
  notice: BENJAMIN_MOORE_COLOR_DATA_NOTICE
});

const COLOR_DEFINITIONS = [
  ["White Dove", "OC-17", "#F0EEE5", "white"],
  ["Chantilly Lace", "OC-65", "#F5F4EE", "white"],
  ["Simply White", "OC-117", "#F4F3E8", "white"],
  ["Cloud White", "OC-130", "#F1EEE4", "white"],
  ["Silver Satin", "OC-26", "#DAD9D3", "white"],
  ["Decorator's White", "OC-149", "#ECEDE8", "white"],
  ["Super White", "OC-152", "#F3F4F0", "white"],
  ["Swiss Coffee", "OC-45", "#EDE7D8", "white"],
  ["Seapearl", "OC-19", "#E8E3D8", "white"],
  ["Calm", "OC-22", "#E6E2D8", "white"],
  ["Pale Oak", "OC-20", "#D6CEC2", "neutral"],
  ["Classic Gray", "OC-23", "#E3DFD5", "neutral"],
  ["Balboa Mist", "OC-27", "#D1CAC2", "neutral"],
  ["Collingwood", "OC-28", "#CAC5BC", "neutral"],
  ["Gray Owl", "OC-52", "#D4D5CD", "gray"],
  ["Manchester Tan", "HC-81", "#D5C6AA", "neutral"],
  ["Rockport Gray", "HC-105", "#A29D91", "gray"],
  ["Saybrook Sage", "HC-114", "#B2B4A0", "green"],
  ["Palladian Blue", "HC-144", "#C1D1C9", "blue"],
  ["Hale Navy", "HC-154", "#434B56", "blue"],
  ["Newburyport Blue", "HC-155", "#394A5C", "blue"],
  ["Van Deusen Blue", "HC-156", "#3E5063", "blue"],
  ["Boothbay Gray", "HC-165", "#AAB0AE", "gray"],
  ["Kendall Charcoal", "HC-166", "#686762", "gray"],
  ["Chelsea Gray", "HC-168", "#86847C", "gray"],
  ["Coventry Gray", "HC-169", "#B4B6B1", "gray"],
  ["Stonington Gray", "HC-170", "#CACBC5", "gray"],
  ["Revere Pewter", "HC-172", "#CCC4B8", "neutral"],
  ["Edgecomb Gray", "HC-173", "#D3C9BA", "neutral"],
  ["Essex Green", "HC-188", "#29352F", "green"]
];

export const BENJAMIN_MOORE_COLORS = Object.freeze(
  COLOR_DEFINITIONS.map(([name, code, approximateHex, family]) => Object.freeze({
    id: code.toLowerCase(),
    name,
    code,
    approximateHex,
    family,
    officialColorUrl: "https://www.benjaminmoore.com/en-us/paint-colors/color/" + code
  }))
);

const SEARCH_INDEX = BENJAMIN_MOORE_COLORS.map((color, order) => Object.freeze({
  color,
  order,
  nameKey: normalizeBenjaminMooreQuery(color.name),
  codeKey: normalizeBenjaminMooreCode(color.code),
  combinedKey: normalizeBenjaminMooreQuery(color.name + " " + color.code)
}));

const NAME_INDEX = new Map(SEARCH_INDEX.map((entry) => [entry.nameKey, entry.color]));
const CODE_INDEX = new Map(SEARCH_INDEX.map((entry) => [entry.codeKey, entry.color]));
const COMBINED_INDEX = new Map(SEARCH_INDEX.map((entry) => [entry.combinedKey, entry.color]));

/**
 * Normalize a human-entered name or code for comparison.
 *
 * Examples:
 *   "  WHITE-DOVE " -> "white dove"
 *   "OC - 17"       -> "oc 17"
 *   "hc154"         -> "hc 154"
 *   "Decorator’s"   -> "decorators"
 */
export function normalizeBenjaminMooreQuery(value) {
  if (value == null) return "";
  const stringValue = typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
  return stringValue
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .toLowerCase()
    .replace(/[’'\u0060]/g, "")
    .replace(/&/g, " and ")
    .replace(/([a-z])([0-9])/g, "$1 $2")
    .replace(/([0-9])([a-z])/g, "$1 $2")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Normalize a code to a punctuation-insensitive key.
 *
 * OC-17, oc 17, OC17, and " oc - 17 " all normalize to "oc17".
 */
export function normalizeBenjaminMooreCode(value) {
  return normalizeBenjaminMooreQuery(value).replace(/\s+/g, "");
}

/**
 * Search the curated subset by full or partial name and code.
 *
 * Results are deterministic and ranked as:
 * exact code/name, code prefix/fragment, name prefix, all-token match,
 * then general substring. Returned objects are the frozen dataset entries.
 */
export function searchBenjaminMooreColors(query, options = {}) {
  const queryKey = normalizeBenjaminMooreQuery(query);
  if (!queryKey) return [];

  const codeKey = normalizeBenjaminMooreCode(query);
  const codeLike = looksLikeColorCode(queryKey);
  const tokens = queryKey.split(" ").filter(Boolean);
  const requestedLimit = Number(options?.limit);
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(0, Math.min(BENJAMIN_MOORE_COLORS.length, Math.floor(requestedLimit)))
    : 10;
  if (limit === 0) return [];

  return SEARCH_INDEX
    .map((entry) => ({
      entry,
      score: getSearchScore(entry, queryKey, codeKey, codeLike, tokens)
    }))
    .filter((candidate) => Number.isFinite(candidate.score))
    .sort((left, right) => {
      if (left.score !== right.score) return left.score - right.score;
      const nameOrder = left.entry.color.name.localeCompare(right.entry.color.name);
      return nameOrder || left.entry.order - right.entry.order;
    })
    .slice(0, limit)
    .map((candidate) => candidate.entry.color);
}

/**
 * Find one exact color by its full name, code, or combined "name code" label.
 * Partial queries deliberately return null.
 *
 * An object with code and/or name is also accepted for safe saved-state
 * restoration. When both are supplied they must identify the same color.
 */
export function findExactBenjaminMooreColor(value) {
  if (value && typeof value === "object") {
    const byCode = value.code != null ? findBenjaminMooreColorByCode(value.code) : null;
    const byName = value.name != null ? findBenjaminMooreColorByName(value.name) : null;
    if (value.code != null && value.name != null) return byCode && byCode === byName ? byCode : null;
    return byCode || byName;
  }

  const queryKey = normalizeBenjaminMooreQuery(value);
  if (!queryKey) return null;
  return (
    NAME_INDEX.get(queryKey) ||
    CODE_INDEX.get(normalizeBenjaminMooreCode(value)) ||
    COMBINED_INDEX.get(queryKey) ||
    null
  );
}

export function findBenjaminMooreColorByCode(code) {
  const key = normalizeBenjaminMooreCode(code);
  return key ? CODE_INDEX.get(key) || null : null;
}

export function findBenjaminMooreColorByName(name) {
  const key = normalizeBenjaminMooreQuery(name);
  return key ? NAME_INDEX.get(key) || null : null;
}

function getSearchScore(entry, queryKey, codeKey, codeLike, tokens) {
  if (codeLike && entry.codeKey === codeKey) return 0;
  if (entry.nameKey === queryKey) return 0;
  if (entry.combinedKey === queryKey) return 0;
  if (codeLike && entry.codeKey.startsWith(codeKey)) return 10;
  if (codeLike && entry.codeKey.includes(codeKey)) return 20;
  if (entry.nameKey.startsWith(queryKey)) return 30;

  const searchable = entry.nameKey + " " + normalizeBenjaminMooreQuery(entry.color.code);
  if (tokens.length && tokens.every((token) => searchable.includes(token))) return 40;
  if (entry.nameKey.includes(queryKey) || entry.combinedKey.includes(queryKey)) return 50;
  return Number.POSITIVE_INFINITY;
}

function looksLikeColorCode(queryKey) {
  return /^(?:oc|hc|af|csp)(?:\s*\d.*)?$/.test(queryKey) || /^\d+(?:\s+\d+)?$/.test(queryKey);
}
