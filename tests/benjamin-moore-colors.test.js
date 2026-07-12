import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  BENJAMIN_MOORE_COLOR_DATA_NOTICE,
  BenjaminMooreColorCatalogProvider,
  ColorCatalogProvider,
  createBenjaminMoorePaintSelection,
  normalizeBenjaminMooreCode,
  normalizeBenjaminMooreQuery
} from "../benjamin-moore-colors.js";
import {
  SOURCE_DEFINITIONS,
  buildCatalog,
  mergeCatalogRecords,
  parseAse,
  parseOfficialColorName
} from "../scripts/import-benjamin-moore-colors.js";

const catalogPath = new URL("../data/generated/benjamin-moore-colors.json", import.meta.url);
const sourcePath = new URL("../data/vendor/benjamin-moore/source/benjaminmoore_off-whitecolors_en-us.ase", import.meta.url);
const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const provider = new BenjaminMooreColorCatalogProvider({ catalogLoader: () => catalog });

test("catalog provider abstraction exposes the reusable provider contract", () => {
  assert.equal(provider instanceof ColorCatalogProvider, true);
  for (const method of ["search", "getByCode", "getById", "normalizeCode", "getCatalogMetadata", "getOfficialReference"]) {
    assert.equal(typeof provider[method], "function");
  }
});

test("all official ASE sources parse as RGB and record their source identity", async () => {
  for (const source of SOURCE_DEFINITIONS) {
    const buffer = await readFile(new URL(`../data/vendor/benjamin-moore/source/${source.filename}`, import.meta.url));
    const records = parseAse(buffer, source);
    assert.ok(records.length > 0, source.filename);
    assert.ok(records.every((record) => /^#[0-9A-F]{6}$/.test(record.hex)), source.filename);
    assert.ok(records.every((record) => record.sourceFilename === source.filename), source.filename);
  }
});

test("ASE parsing extracts official code, name, and RGB data", async () => {
  const records = parseAse(await readFile(sourcePath), SOURCE_DEFINITIONS.find((item) => item.filename.includes("off-white")));
  const whiteDove = records.find((record) => record.code === "OC-17");
  assert.deepEqual({ name: whiteDove.name, hex: whiteDove.hex, rgb: whiteDove.rgb }, {
    name: "White Dove",
    hex: "#F0EFE6",
    rgb: { r: 240, g: 239, b: 230 }
  });
  assert.deepEqual(parseOfficialColorName("2128-30 Evening Dove"), { code: "2128-30", name: "Evening Dove" });
});

test("catalog generation is deterministic and records hashes and provenance", async () => {
  const first = await buildCatalog();
  const second = await buildCatalog();
  assert.deepEqual(first, second);
  assert.equal(first.manifest.sourceFileCount, 11);
  assert.equal(first.manifest.collectionCount, 11);
  assert.equal(first.manifest.uniqueColorCodeCount, 4056);
  assert.equal(first.manifest.duplicateRecordsMerged, 83);
  assert.equal(first.manifest.minorDigitalVariantsMerged, 40);
  assert.ok(first.manifest.sources.every((source) => /^[a-f0-9]{64}$/.test(source.sha256)));
});

test("duplicate colors merge collections while materially conflicting codes fail", () => {
  const base = { code: "OC-17", normalizedCode: "OC17", name: "White Dove", rgb: { r: 240, g: 239, b: 230 }, hex: "#F0EFE6", collection: "A", sourceFilename: "a.ase", sourcePriority: 1 };
  const merged = mergeCatalogRecords([base, { ...base, collection: "B", sourceFilename: "b.ase" }]);
  assert.deepEqual(merged.colors[0].collections, ["A", "B"]);
  assert.equal(merged.duplicateRecordsMerged, 1);
  assert.throws(() => mergeCatalogRecords([base, { ...base, rgb: { r: 20, g: 30, b: 40 }, hex: "#141E28", sourceFilename: "bad.ase" }]), /Conflicting duplicate color code OC-17/);
});

test("catalog integrity includes required official records and digital values", async () => {
  const expected = [
    ["OC-17", "White Dove", "#F0EFE6"],
    ["HC-154", "Hale Navy", "#434B56"],
    ["1495", "October Mist", "#B6B8A5"],
    ["2128-30", "Evening Dove", "#525B68"]
  ];
  for (const [code, name, hex] of expected) {
    const color = await provider.getByCode(code);
    assert.deepEqual([color.name, color.hex], [name, hex]);
  }
});

test("code normalization accepts punctuation, spacing, and case variants", () => {
  assert.deepEqual(["OC-17", "oc17", "OC 17"].map(normalizeBenjaminMooreCode), ["OC17", "OC17", "OC17"]);
  assert.deepEqual(["HC-154", "hc154", "HC 154"].map(normalizeBenjaminMooreCode), ["HC154", "HC154", "HC154"]);
  assert.equal(normalizeBenjaminMooreQuery("DÉCORATOR’S WHITE"), "decorators white");
});

test("search finds official colors by exact code, formatted code, and name", async () => {
  for (const query of ["OC-17", "oc17", "OC 17", "White Dove", "white dove"]) {
    assert.equal((await provider.search(query))[0]?.name, "White Dove", query);
  }
  assert.equal((await provider.search("HC-154"))[0]?.name, "Hale Navy");
  assert.equal((await provider.search("hc154"))[0]?.name, "Hale Navy");
  assert.equal((await provider.search("1495"))[0]?.name, "October Mist");
  assert.equal((await provider.search("2128 30"))[0]?.name, "Evening Dove");
  assert.equal((await provider.search("AF655"))[0]?.name, "Silhouette");
});

test("exact code outranks partial names, results are limited, and unsafe input is inert", async () => {
  assert.equal((await provider.search("1495"))[0].code, "1495");
  assert.equal((await provider.search("white", { limit: 7 })).length, 7);
  assert.deepEqual(await provider.search("<img src=x onerror=alert(1)>"), []);
  assert.deepEqual(await provider.search("definitely not a catalog color"), []);
});

test("paint selections retain production identity and official preview metadata", async () => {
  const color = await provider.getByCode("HC-154");
  const selection = createBenjaminMoorePaintSelection(color);
  assert.deepEqual(selection, {
    source: "benjamin-moore",
    brand: "Benjamin Moore",
    catalogId: "benjamin-moore:hc-154",
    code: "HC-154",
    name: "Hale Navy",
    collections: ["Historical Colors"],
    previewHex: "#434B56",
    previewRgb: { r: 67, g: 75, b: 86 },
    catalogVersion: catalog.catalogVersion,
    sourceType: "official-palette"
  });
  assert.match(BENJAMIN_MOORE_COLOR_DATA_NOTICE, /Digital preview only/);
  assert.match(BENJAMIN_MOORE_COLOR_DATA_NOTICE, /official Benjamin Moore sample/);
});
