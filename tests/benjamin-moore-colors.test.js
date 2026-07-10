import test from "node:test";
import assert from "node:assert/strict";

import {
  BENJAMIN_MOORE_COLORS,
  BENJAMIN_MOORE_COLOR_DATA_NOTICE,
  BENJAMIN_MOORE_DATASET_INFO,
  findBenjaminMooreColorByCode,
  findBenjaminMooreColorByName,
  findExactBenjaminMooreColor,
  normalizeBenjaminMooreCode,
  normalizeBenjaminMooreQuery,
  searchBenjaminMooreColors
} from "../benjamin-moore-colors.js";

test("dataset is a frozen curated local subset with explicit accuracy limits", () => {
  assert.ok(BENJAMIN_MOORE_COLORS.length >= 24);
  assert.equal(Object.isFrozen(BENJAMIN_MOORE_COLORS), true);
  assert.ok(BENJAMIN_MOORE_COLORS.every((color) => Object.isFrozen(color)));
  assert.equal(Object.isFrozen(BENJAMIN_MOORE_DATASET_INFO), true);
  assert.equal(BENJAMIN_MOORE_DATASET_INFO.officialApiConnection, false);
  assert.equal(BENJAMIN_MOORE_DATASET_INFO.runtimeNetworkAccess, false);
  assert.equal(BENJAMIN_MOORE_DATASET_INFO.colorAccuracyGuaranteed, false);
  assert.match(BENJAMIN_MOORE_COLOR_DATA_NOTICE, /curated local/i);
  assert.match(BENJAMIN_MOORE_COLOR_DATA_NOTICE, /not an official/i);
  assert.match(BENJAMIN_MOORE_COLOR_DATA_NOTICE, /approximate/i);
});

test("required JQ and Hale Navy color records are present", () => {
  const required = new Map([
    ["OC-17", "White Dove"],
    ["OC-65", "Chantilly Lace"],
    ["OC-117", "Simply White"],
    ["OC-130", "Cloud White"],
    ["OC-26", "Silver Satin"],
    ["HC-154", "Hale Navy"]
  ]);

  for (const [code, name] of required) {
    assert.equal(findBenjaminMooreColorByCode(code)?.name, name);
  }
});

test("records have unique names and codes plus documented approximate hex values", () => {
  const names = new Set();
  const codes = new Set();
  for (const color of BENJAMIN_MOORE_COLORS) {
    assert.equal(names.has(color.name), false, color.name + " is duplicated");
    assert.equal(codes.has(color.code), false, color.code + " is duplicated");
    names.add(color.name);
    codes.add(color.code);
    assert.match(color.approximateHex, /^#[0-9A-F]{6}$/);
    assert.equal(color.officialColorUrl.endsWith("/" + color.code), true);
  }
});

test("query normalization is insensitive to capitalization, extra spaces, and hyphens", () => {
  assert.equal(normalizeBenjaminMooreQuery("  WHITE   DOVE  "), "white dove");
  assert.equal(normalizeBenjaminMooreQuery("white-dove"), "white dove");
  assert.equal(normalizeBenjaminMooreQuery("  Hale---Navy "), "hale navy");
});

test("query normalization handles curly apostrophes and combining marks", () => {
  assert.equal(normalizeBenjaminMooreQuery("DÉCORATOR’S-WHITE"), "decorators white");
  assert.equal(normalizeBenjaminMooreQuery("Decorator's White"), "decorators white");
});

test("code normalization treats spaces and hyphens equivalently", () => {
  const forms = ["OC-17", "oc 17", "OC17", " oc - 17 "];
  assert.deepEqual(forms.map(normalizeBenjaminMooreCode), ["oc17", "oc17", "oc17", "oc17"]);
  assert.equal(normalizeBenjaminMooreQuery("hc154"), "hc 154");
});

test("name search is case-insensitive", () => {
  const results = searchBenjaminMooreColors("hAlE nAvY");
  assert.equal(results[0]?.code, "HC-154");
});

test("partial name search finds all matching local colors", () => {
  const grayResults = searchBenjaminMooreColors("gray", { limit: 30 });
  assert.ok(grayResults.length >= 8);
  assert.ok(grayResults.some((color) => color.name === "Gray Owl"));
  assert.ok(grayResults.some((color) => color.name === "Edgecomb Gray"));
  assert.ok(grayResults.every((color) => color.name.toLowerCase().includes("gray")));
});

test("multi-token name searches do not require adjacent words", () => {
  const results = searchBenjaminMooreColors("blue van");
  assert.equal(results[0]?.name, "Van Deusen Blue");
});

test("exact code searches accept capitalization, spaces, and missing hyphens", () => {
  for (const query of ["HC-154", "hc 154", "HC154", " hc - 154 "]) {
    const results = searchBenjaminMooreColors(query);
    assert.equal(results[0]?.name, "Hale Navy");
  }
});

test("numeric code fragments and code prefixes return useful matches", () => {
  assert.equal(searchBenjaminMooreColors("154")[0]?.code, "HC-154");
  const historicalBlues = searchBenjaminMooreColors("HC-15", { limit: 10 });
  assert.deepEqual(
    historicalBlues.map((color) => color.code),
    ["HC-154", "HC-155", "HC-156"]
  );
});

test("search limit is honored without mutating the dataset", () => {
  const before = BENJAMIN_MOORE_COLORS.map((color) => color.code);
  assert.equal(searchBenjaminMooreColors("white", { limit: 3 }).length, 3);
  assert.deepEqual(BENJAMIN_MOORE_COLORS.map((color) => color.code), before);
  assert.deepEqual(searchBenjaminMooreColors("white", { limit: 0 }), []);
});

test("empty, unsupported, and no-result searches return an empty array", () => {
  assert.deepEqual(searchBenjaminMooreColors(""), []);
  assert.deepEqual(searchBenjaminMooreColors("   "), []);
  assert.deepEqual(searchBenjaminMooreColors(null), []);
  assert.deepEqual(searchBenjaminMooreColors("definitely not a catalog color"), []);
});

test("exact matcher accepts a normalized full name", () => {
  assert.equal(findExactBenjaminMooreColor("  white-dove  ")?.code, "OC-17");
  assert.equal(findExactBenjaminMooreColor("DECORATOR’S WHITE")?.code, "OC-149");
});

test("exact matcher accepts normalized codes", () => {
  assert.equal(findExactBenjaminMooreColor("oc 65")?.name, "Chantilly Lace");
  assert.equal(findExactBenjaminMooreColor("OC117")?.name, "Simply White");
});

test("exact matcher accepts a combined name and code label", () => {
  const color = findExactBenjaminMooreColor("Hale Navy HC-154");
  assert.equal(color?.name, "Hale Navy");
  assert.equal(color?.code, "HC-154");
});

test("exact matcher rejects partial and contradictory values", () => {
  assert.equal(findExactBenjaminMooreColor("Hale"), null);
  assert.equal(findExactBenjaminMooreColor("OC-1"), null);
  assert.equal(findExactBenjaminMooreColor({ name: "White Dove", code: "HC-154" }), null);
  assert.equal(findExactBenjaminMooreColor({}), null);
});

test("dedicated exact name and code helpers return null for unknown values", () => {
  assert.equal(findBenjaminMooreColorByName("pale oak")?.code, "OC-20");
  assert.equal(findBenjaminMooreColorByCode("hc 173")?.name, "Edgecomb Gray");
  assert.equal(findBenjaminMooreColorByName("Pale"), null);
  assert.equal(findBenjaminMooreColorByCode("HC-999"), null);
});

test("search results are the original frozen records", () => {
  const result = searchBenjaminMooreColors("White Dove")[0];
  assert.equal(result, findBenjaminMooreColorByCode("OC-17"));
  assert.equal(Object.isFrozen(result), true);
});
