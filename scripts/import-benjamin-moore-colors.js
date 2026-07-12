#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = path.join(ROOT, "data/vendor/benjamin-moore/source");
const OUTPUT_DIR = path.join(ROOT, "data/generated");
const CATALOG_PATH = path.join(OUTPUT_DIR, "benjamin-moore-colors.json");
const MANIFEST_PATH = path.join(OUTPUT_DIR, "benjamin-moore-catalog-manifest.json");

export const SOURCE_DOWNLOAD_DATE = "2026-07-12";
export const OFFICIAL_PALETTE_PAGE = "https://www.benjaminmoore.com/en-us/architects-designers/download-benjamin-moore-color-palettes";

export const SOURCE_DEFINITIONS = Object.freeze([
  source("benjaminmoore_affinity_en-us.ase", "Affinity Color Collection", "https://www.benjaminmoore.com/-/media/sites/benjaminmoore/files/palettedownloads/ase/en-us/benjaminmoore_affinity_en-us.ase", 90),
  source("benjaminmoore_classiccolors_en-us.ase", "Benjamin Moore Classics", "https://www.benjaminmoore.com/-/media/sites/benjaminmoore/files/palettedownloads/ase/en-us/benjaminmoore_classiccolors_en-us.ase", 90),
  source("benjaminmoore_colorstories_en-us.ase", "Color Stories", "https://www.benjaminmoore.com/-/media/sites/benjaminmoore/files/palettedownloads/ase/en-us/benjaminmoore_colorstories_en-us.ase", 90),
  source("benjaminmoore_colorpreview_en-us.ase", "Color Preview", "https://www.benjaminmoore.com/-/media/sites/benjaminmoore/files/palettedownloads/ase/en-us/benjaminmoore_colorpreview_en-us.ase", 90),
  source("benjaminmoore_historicalcolors_en-us.ase", "Historical Colors", "https://www.benjaminmoore.com/-/media/sites/benjaminmoore/files/palettedownloads/ase/en-us/benjaminmoore_historicalcolors_en-us.ase", 90),
  source("benjaminmoore_off-whitecolors_en-us.ase", "Off White Collection", "https://www.benjaminmoore.com/-/media/sites/benjaminmoore/files/palettedownloads/ase/en-us/benjaminmoore_off-whitecolors_en-us.ase", 90),
  source("benjaminmoore_williamsburgcolorcollection_en-us.ase", "Williamsburg Color Collection", "https://www.benjaminmoore.com/-/media/sites/benjaminmoore/files/palettedownloads/ase/en-us/benjaminmoore_williamsburgcolorcollection_en-us.ase", 90),
  source("benjaminmoore_americascolors_en-us.ase", "America's Colors", "https://www.benjaminmoore.com/-/media/sites/benjaminmoore/files/palettedownloads/ase/en-us/benjaminmoore_americascolors_en-us.ase", 90),
  source("benjaminmoore_designerclassics_en-us.ase", "Designer Classics", "https://www.benjaminmoore.com/-/media/sites/benjaminmoore/files/palettedownloads/ase/en-us/benjaminmoore_designerclassics_en-us.ase", 90),
  source("benjaminmoore_colorsforvinylsiding_en-us.ase", "Colors for Vinyl", "https://www.benjaminmoore.com/-/media/sites/benjaminmoore/files/palettedownloads/ase/en-us/benjaminmoore_colorsforvinylsiding_en-us.ase", 70),
  source("BenjaminMoore_ColorTrends2026_en-us.ase", "Color Trends 2026 Palette", "https://media.benjaminmoore.com/WebServices/prod/ColorTrends/2026/PaletteDownloads/BenjaminMoore_ColorTrends2026_en-us.ase", 100)
]);

function source(filename, collection, url, priority) {
  return Object.freeze({ filename, collection, url, priority });
}

export function parseAse(buffer, sourceDefinition = {}) {
  if (!Buffer.isBuffer(buffer)) throw new TypeError("ASE input must be a Buffer.");
  if (buffer.length < 12 || buffer.toString("ascii", 0, 4) !== "ASEF") {
    throw new Error(`Invalid ASE header in ${sourceDefinition.filename || "input"}.`);
  }
  const major = buffer.readUInt16BE(4);
  const minor = buffer.readUInt16BE(6);
  if (major !== 1 || minor !== 0) throw new Error(`Unsupported ASE version ${major}.${minor} in ${sourceDefinition.filename || "input"}.`);

  const blockCount = buffer.readUInt32BE(8);
  const colors = [];
  let offset = 12;
  for (let blockIndex = 0; blockIndex < blockCount; blockIndex += 1) {
    assertReadable(buffer, offset, 6, sourceDefinition.filename);
    const blockType = buffer.readUInt16BE(offset);
    const blockLength = buffer.readUInt32BE(offset + 2);
    const payloadStart = offset + 6;
    const blockEnd = payloadStart + blockLength;
    assertReadable(buffer, payloadStart, blockLength, sourceDefinition.filename);
    offset = blockEnd;
    if (blockType !== 0x0001) continue;

    let cursor = payloadStart;
    const nameLength = buffer.readUInt16BE(cursor);
    cursor += 2;
    const aseName = readUtf16Be(buffer, cursor, nameLength);
    cursor += nameLength * 2;
    const colorSpace = buffer.toString("ascii", cursor, cursor + 4);
    cursor += 4;
    if (colorSpace !== "RGB ") {
      throw new Error(`Unsupported ASE color space ${JSON.stringify(colorSpace)} for ${aseName} in ${sourceDefinition.filename || "input"}.`);
    }
    assertReadable(buffer, cursor, 14, sourceDefinition.filename);
    const components = [buffer.readFloatBE(cursor), buffer.readFloatBE(cursor + 4), buffer.readFloatBE(cursor + 8)];
    if (components.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) {
      throw new Error(`Invalid RGB components for ${aseName} in ${sourceDefinition.filename || "input"}.`);
    }
    const parsedName = parseOfficialColorName(aseName);
    if (!parsedName) throw new Error(`Could not extract a color code and name from ${JSON.stringify(aseName)} in ${sourceDefinition.filename || "input"}.`);
    const rgb = Object.fromEntries(["r", "g", "b"].map((channel, index) => [channel, Math.round(components[index] * 255)]));
    colors.push({
      ...parsedName,
      normalizedCode: normalizeCode(parsedName.code),
      rgb,
      hex: rgbToHex(rgb),
      sourceRgb: components.map((value) => Number(value.toFixed(8))),
      collection: sourceDefinition.collection || "Unspecified collection",
      sourceFilename: sourceDefinition.filename || "unknown.ase",
      sourcePriority: Number(sourceDefinition.priority) || 0
    });
  }
  if (offset !== buffer.length) throw new Error(`Unexpected trailing data in ${sourceDefinition.filename || "input"}.`);
  return colors;
}

export function parseOfficialColorName(value) {
  const clean = String(value || "").trim();
  const match = clean.match(/^([A-Z]{1,4}-\d+(?:-\d+)?|\d+(?:-\d+)?)\s+(.+)$/i);
  if (!match) return null;
  return { code: match[1].toUpperCase(), name: match[2].trim() };
}

export function normalizeCode(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function mergeCatalogRecords(records) {
  const byCode = new Map();
  let duplicateRecordsMerged = 0;
  let minorDigitalVariantsMerged = 0;
  for (const record of records) {
    const current = byCode.get(record.normalizedCode);
    if (!current) {
      byCode.set(record.normalizedCode, {
        id: `benjamin-moore:${record.code.toLowerCase()}`,
        brand: "Benjamin Moore",
        code: record.code,
        normalizedCode: record.normalizedCode,
        name: record.name,
        collections: [record.collection],
        rgb: record.rgb,
        hex: record.hex,
        aliases: [],
        sourceFiles: [record.sourceFilename],
        sourceType: "official-palette",
        _priority: record.sourcePriority,
        _variants: [{ hex: record.hex, sourceFilename: record.sourceFilename }]
      });
      continue;
    }
    duplicateRecordsMerged += 1;
    const nameMatches = normalizeName(current.name) === normalizeName(record.name);
    const maximumChannelDelta = Math.max(
      Math.abs(current.rgb.r - record.rgb.r),
      Math.abs(current.rgb.g - record.rgb.g),
      Math.abs(current.rgb.b - record.rgb.b)
    );
    if (!nameMatches || maximumChannelDelta > 1) {
      throw new Error(
        `Conflicting duplicate color code ${record.code}: ${current.name} ${current.hex} vs ${record.name} ${record.hex} (${record.sourceFilename}).`
      );
    }
    if (record.name !== current.name && !current.aliases.includes(record.name)) current.aliases.push(record.name);
    if (!current.collections.includes(record.collection)) current.collections.push(record.collection);
    if (!current.sourceFiles.includes(record.sourceFilename)) current.sourceFiles.push(record.sourceFilename);
    if (record.hex !== current.hex) {
      minorDigitalVariantsMerged += 1;
      current._variants.push({ hex: record.hex, sourceFilename: record.sourceFilename });
      if (record.sourcePriority > current._priority) {
        current.name = record.name;
        current.rgb = record.rgb;
        current.hex = record.hex;
        current._priority = record.sourcePriority;
      }
    }
  }

  const colors = [...byCode.values()].map((color) => {
    color.collections.sort((left, right) => left.localeCompare(right));
    color.sourceFiles.sort((left, right) => left.localeCompare(right));
    color.aliases.sort((left, right) => left.localeCompare(right));
    delete color._priority;
    delete color._variants;
    return color;
  }).sort((left, right) => compareCodes(left.code, right.code) || left.name.localeCompare(right.name));

  return { colors, duplicateRecordsMerged, minorDigitalVariantsMerged };
}

export async function buildCatalog({ sourceDir = SOURCE_DIR } = {}) {
  const available = new Set(await readdir(sourceDir));
  const missing = SOURCE_DEFINITIONS.filter((definition) => !available.has(definition.filename));
  if (missing.length) throw new Error(`Missing official ASE source files: ${missing.map((item) => item.filename).join(", ")}`);

  const sources = [];
  const parsedRecords = [];
  for (const definition of SOURCE_DEFINITIONS) {
    const data = await readFile(path.join(sourceDir, definition.filename));
    const hash = sha256(data);
    const records = parseAse(data, definition);
    parsedRecords.push(...records);
    sources.push({
      filename: definition.filename,
      collection: definition.collection,
      url: definition.url,
      sha256: hash,
      bytes: data.length,
      colorRecords: records.length
    });
  }
  const versionSeed = sources.map((item) => `${item.filename}:${item.sha256}`).join("\n");
  const catalogVersion = `bm-ase-${sha256(Buffer.from(versionSeed)).slice(0, 12)}`;
  const merged = mergeCatalogRecords(parsedRecords);
  const colors = merged.colors.map((color) => ({ ...color, catalogVersion }));
  const collections = [...new Set(colors.flatMap((color) => color.collections))].sort((a, b) => a.localeCompare(b));
  const aliasCount = colors.reduce((sum, color) => sum + color.aliases.length, 0);
  const manifest = {
    brand: "Benjamin Moore",
    catalogVersion,
    generatedDate: SOURCE_DOWNLOAD_DATE,
    sourceType: "official-palette",
    officialPalettePage: OFFICIAL_PALETTE_PAGE,
    runtimeNetworkAccess: false,
    digitalPreviewOnly: true,
    sourceFileCount: sources.length,
    uniqueColorCodeCount: colors.length,
    uniqueColorCount: colors.length,
    collectionCount: collections.length,
    aliasCount,
    duplicateRecordsMerged: merged.duplicateRecordsMerged,
    minorDigitalVariantsMerged: merged.minorDigitalVariantsMerged,
    conflictingRecords: 0,
    collections,
    sources
  };
  return { catalog: { ...manifest, colors }, manifest };
}

export async function writeCatalog(options = {}) {
  const outputDir = options.outputDir || OUTPUT_DIR;
  const { catalog, manifest } = await buildCatalog(options);
  await mkdir(outputDir, { recursive: true });
  const catalogJson = stableJson(catalog);
  const manifestWithSize = { ...manifest, catalogBytes: Buffer.byteLength(catalogJson) };
  await writeFile(path.join(outputDir, path.basename(CATALOG_PATH)), catalogJson);
  await writeFile(path.join(outputDir, path.basename(MANIFEST_PATH)), stableJson(manifestWithSize));
  return { catalog, manifest: manifestWithSize };
}

function readUtf16Be(buffer, offset, codeUnitCount) {
  assertReadable(buffer, offset, codeUnitCount * 2, "ASE string");
  let value = "";
  for (let index = 0; index < Math.max(0, codeUnitCount - 1); index += 1) {
    value += String.fromCharCode(buffer.readUInt16BE(offset + index * 2));
  }
  return value;
}

function assertReadable(buffer, offset, length, filename = "input") {
  if (offset < 0 || length < 0 || offset + length > buffer.length) throw new Error(`Truncated ASE data in ${filename}.`);
}

function normalizeName(value) {
  return String(value || "").normalize("NFKD").replace(/\p{Mark}/gu, "").replace(/[®™]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function rgbToHex(rgb) {
  return `#${[rgb.r, rgb.g, rgb.b].map((value) => value.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

function compareCodes(left, right) {
  return left.localeCompare(right, "en", { numeric: true, sensitivity: "base" });
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function main() {
  const result = await writeCatalog();
  process.stdout.write(`${JSON.stringify(result.manifest, null, 2)}\n`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
