import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(toolDir, "../..");
const evidenceRoot = path.resolve(root, process.argv[2] || ".local-proof/configurator-authority-v4/current");
const ffmpeg = process.env.FFMPEG || "ffmpeg";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const round = (value, places = 6) => Number(Number(value).toFixed(places));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: null, maxBuffer: 768 * 1024 * 1024, ...options });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed: ${(result.stderr || Buffer.alloc(0)).toString("utf8")}`);
  return result.stdout;
}

function pngSize(bytes) {
  assert(bytes.length >= 24 && bytes.subarray(1, 4).toString("ascii") === "PNG", "Expected a PNG evidence file.");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function quantile(histogram, count, fraction) {
  const target = Math.max(0, Math.min(count - 1, Math.round((count - 1) * fraction)));
  let cumulative = 0;
  for (let index = 0; index < histogram.length; index += 1) {
    cumulative += histogram[index];
    if (cumulative > target) return index;
  }
  return histogram.length - 1;
}

function summarizeRgb(rgb, width, height) {
  const pixelCount = width * height;
  assert(rgb.length === pixelCount * 3, `Decoded RGB size differs from ${width}x${height}.`);
  const histogram = new Uint32Array(256);
  let sum = 0;
  let sumSquared = 0;
  let horizontalTotal = 0;
  let verticalTotal = 0;
  let horizontalCount = 0;
  let verticalCount = 0;
  const lumaAt = (offset) => 0.2126 * rgb[offset] + 0.7152 * rgb[offset + 1] + 0.0722 * rgb[offset + 2];
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const offset = pixel * 3;
    const luma = lumaAt(offset);
    histogram[Math.max(0, Math.min(255, Math.round(luma)))] += 1;
    sum += luma;
    sumSquared += luma * luma;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    if (x + 1 < width && (x & 1) === 0 && (y & 1) === 0) {
      horizontalTotal += Math.abs(luma - lumaAt(offset + 3));
      horizontalCount += 1;
    }
    if (y + 1 < height && (x & 1) === 0 && (y & 1) === 0) {
      verticalTotal += Math.abs(luma - lumaAt(offset + width * 3));
      verticalCount += 1;
    }
  }
  const mean = sum / pixelCount;
  const variance = Math.max(0, sumSquared / pixelCount - mean * mean);
  const countRange = (minimum, maximum) => histogram.slice(minimum, maximum + 1).reduce((total, value) => total + value, 0);
  const p01 = quantile(histogram, pixelCount, 0.01);
  const p05 = quantile(histogram, pixelCount, 0.05);
  const p10 = quantile(histogram, pixelCount, 0.1);
  const p50 = quantile(histogram, pixelCount, 0.5);
  const p90 = quantile(histogram, pixelCount, 0.9);
  const p95 = quantile(histogram, pixelCount, 0.95);
  const p99 = quantile(histogram, pixelCount, 0.99);
  return {
    width,
    height,
    pixelCount,
    rec709Luma: {
      mean: round(mean),
      standardDeviation: round(Math.sqrt(variance)),
      p01,
      p05,
      p10,
      p50,
      p90,
      p95,
      p99,
      p05ToP95: p95 - p05,
      clippedBlackFraction: round(histogram[0] / pixelCount),
      nearBlackFraction: round(countRange(0, 5) / pixelCount),
      nearWhiteFraction: round(countRange(250, 255) / pixelCount),
      clippedWhiteFraction: round(histogram[255] / pixelCount)
    },
    sampledNeighborDifference: {
      horizontalMean: round(horizontalTotal / Math.max(1, horizontalCount)),
      verticalMean: round(verticalTotal / Math.max(1, verticalCount)),
      sampleStridePixels: 2
    }
  };
}

function compareRgb(left, right, width, height) {
  assert(left.length === right.length, "Paired evidence dimensions differ.");
  const histogram = new Uint32Array(256);
  let sum = 0;
  let changed = 0;
  const pixels = width * height;
  for (let offset = 0; offset < left.length; offset += 3) {
    const leftLuma = 0.2126 * left[offset] + 0.7152 * left[offset + 1] + 0.0722 * left[offset + 2];
    const rightLuma = 0.2126 * right[offset] + 0.7152 * right[offset + 1] + 0.0722 * right[offset + 2];
    const difference = Math.abs(rightLuma - leftLuma);
    histogram[Math.max(0, Math.min(255, Math.round(difference)))] += 1;
    sum += difference;
    if (difference >= 2) changed += 1;
  }
  return {
    meanAbsoluteRec709LumaDifference: round(sum / pixels),
    p50AbsoluteDifference: quantile(histogram, pixels, 0.5),
    p90AbsoluteDifference: quantile(histogram, pixels, 0.9),
    fractionChangedByAtLeast2: round(changed / pixels)
  };
}

async function decodePng(absolute) {
  const encoded = await readFile(absolute);
  const { width, height } = pngSize(encoded);
  const rgb = run(ffmpeg, ["-v", "error", "-i", absolute, "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"]);
  return { encoded, rgb, width, height, stats: summarizeRgb(rgb, width, height) };
}

function key(record) {
  return [record.kind, record.layoutId, record.diagnosticId, record.role || "", record.side || ""].join("|");
}

function median(values) {
  if (!values.length) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

async function analyzeOrbit(record) {
  const absolute = path.resolve(root, record.path);
  const encoded = await readFile(absolute);
  const width = 1200;
  const height = 720;
  const frameBytes = width * height;
  const raw = run(ffmpeg, ["-v", "error", "-i", absolute, "-f", "rawvideo", "-pix_fmt", "gray", "pipe:1"]);
  assert(raw.length % frameBytes === 0, `${record.path}: decoded orbit size is not whole frames.`);
  const frameCount = raw.length / frameBytes;
  const frameMeans = [];
  const adjacentMeanDifferences = [];
  let previous = null;
  for (let frame = 0; frame < frameCount; frame += 1) {
    const current = raw.subarray(frame * frameBytes, (frame + 1) * frameBytes);
    let sum = 0;
    let delta = 0;
    let samples = 0;
    for (let index = 0; index < current.length; index += 4) {
      sum += current[index];
      if (previous) delta += Math.abs(current[index] - previous[index]);
      samples += 1;
    }
    frameMeans.push(sum / samples);
    if (previous) adjacentMeanDifferences.push(delta / samples);
    previous = current;
  }
  const adjacentMedian = median(adjacentMeanDifferences);
  const adjacentMaximum = Math.max(0, ...adjacentMeanDifferences);
  return {
    path: record.path,
    bytes: encoded.length,
    sha256: sha256(encoded),
    version: record.version,
    layoutId: record.layoutId,
    diagnosticId: record.diagnosticId,
    frameCount,
    frameMeans: frameMeans.map((value) => round(value)),
    adjacentFrameMeanAbsoluteDifference: {
      median: round(adjacentMedian),
      maximum: round(adjacentMaximum),
      maximumToMedianRatio: round(adjacentMaximum / Math.max(0.000001, adjacentMedian)),
      interpretation: "Supporting continuity signal only. The deterministic orbit changes the image every frame; human native-scale review decides shimmer/shadow stability."
    }
  };
}

async function main() {
  const manifestPath = path.join(evidenceRoot, "capture-manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assert(manifest.protocol?.backend === "webgl2", "Evidence renderer is not WebGL2.");
  assert(manifest.protocol?.devicePixelRatio === 1, "Evidence is not native DPR 1.");
  assert(manifest.checks?.every(({ cameraExact, rendererExact, failures }) => cameraExact && rendererExact && failures.length === 0), "Matched capture protocol contains a failed pair.");

  const imageRecords = manifest.captures.filter(({ kind }) => ["matched-model", "native-role-crop"].includes(kind));
  const acceptedByKey = new Map(imageRecords.filter(({ version }) => version === "accepted").map((record) => [key(record), record]));
  const pairs = [];
  for (const candidateRecord of imageRecords.filter(({ version }) => version === "v4")) {
    const acceptedRecord = acceptedByKey.get(key(candidateRecord));
    assert(acceptedRecord, `Missing accepted pair for ${candidateRecord.path}.`);
    const [accepted, candidate] = await Promise.all([
      decodePng(path.resolve(root, acceptedRecord.path)),
      decodePng(path.resolve(root, candidateRecord.path))
    ]);
    assert(accepted.width === candidate.width && accepted.height === candidate.height, `${candidateRecord.path}: paired dimensions differ.`);
    pairs.push({
      kind: candidateRecord.kind,
      layoutId: candidateRecord.layoutId,
      diagnosticId: candidateRecord.diagnosticId,
      role: candidateRecord.role || null,
      side: candidateRecord.side || null,
      clip: candidateRecord.clip || null,
      accepted: { path: acceptedRecord.path, bytes: accepted.encoded.length, sha256: sha256(accepted.encoded), stats: accepted.stats },
      v4: { path: candidateRecord.path, bytes: candidate.encoded.length, sha256: sha256(candidate.encoded), stats: candidate.stats },
      comparison: compareRgb(accepted.rgb, candidate.rgb, candidate.width, candidate.height)
    });
  }

  const orbitRecords = [];
  for (const record of manifest.captures.filter(({ kind }) => kind === "orbit-recording")) orbitRecords.push(await analyzeOrbit(record));
  const rolePairs = pairs.filter(({ kind }) => kind === "native-role-crop");
  const matchedPairs = pairs.filter(({ kind }) => kind === "matched-model");
  const advisories = [];
  for (const pair of rolePairs) {
    if (pair.v4.stats.rec709Luma.p05ToP95 < 3) advisories.push(`${pair.layoutId}/${pair.diagnosticId}/${pair.role}/${pair.side}: low crop luma span`);
    if (pair.v4.stats.rec709Luma.nearWhiteFraction > 0.98) advisories.push(`${pair.layoutId}/${pair.diagnosticId}/${pair.role}/${pair.side}: near-white-dominant crop`);
    if (pair.v4.stats.rec709Luma.nearBlackFraction > 0.98) advisories.push(`${pair.layoutId}/${pair.diagnosticId}/${pair.role}/${pair.side}: near-black-dominant crop`);
  }
  const roleSummary = Object.values(rolePairs.reduce((summary, pair) => {
    const id = `${pair.layoutId}|${pair.diagnosticId}|${pair.role}`;
    const entry = summary[id] ||= { layoutId: pair.layoutId, diagnosticId: pair.diagnosticId, role: pair.role, sides: [], minimumV4P05ToP95: Infinity, medianMeanAbsoluteDifference: [] };
    entry.sides.push(pair.side);
    entry.minimumV4P05ToP95 = Math.min(entry.minimumV4P05ToP95, pair.v4.stats.rec709Luma.p05ToP95);
    entry.medianMeanAbsoluteDifference.push(pair.comparison.meanAbsoluteRec709LumaDifference);
    return summary;
  }, {})).map((entry) => ({ ...entry, sides: [...new Set(entry.sides)].sort(), medianMeanAbsoluteDifference: round(median(entry.medianMeanAbsoluteDifference)) }));

  const report = {
    schema: "jq-configurator-authority-v4-visual-analysis-v1",
    status: "supporting-automated-evidence-only",
    evidenceRoot: path.relative(root, evidenceRoot),
    protocol: {
      luma: "Rec.709 0.2126R + 0.7152G + 0.0722B on decoded sRGB bytes",
      nativeScale: "DPR 1; no image resizing",
      pairing: "exact camera/projection/world matrices, viewport, renderer, exposure, browser and diagnostic ID",
      decisionBoundary: "Automated crop statistics cannot establish owner acceptance or visual quality. The randomized native-scale visual/geometry review is the visual gate."
    },
    inventory: { matchedPairs: matchedPairs.length, nativeRolePairs: rolePairs.length, orbitRecordings: orbitRecords.length },
    protocolPass: manifest.checks.every(({ cameraExact, rendererExact, failures }) => cameraExact && rendererExact && failures.length === 0),
    advisories,
    roleSummary,
    matchedPairs,
    rolePairs,
    orbitRecords
  };
  await writeFile(path.join(evidenceRoot, "visual-analysis.json"), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`visual analysis recorded ${matchedPairs.length} matched pairs, ${rolePairs.length} native role pairs and ${orbitRecords.length} orbit recordings; ${advisories.length} automated advisories (supporting only)\n`);
}

await main();
