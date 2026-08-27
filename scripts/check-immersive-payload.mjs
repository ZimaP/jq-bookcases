import { readFileSync } from "node:fs";
import { lstat, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";

const LOCKED_RELEASE_BASE_SHA = "01ef95b2be567e0160a1c12e6c76fc0f68a1a430";
const LOCKED_BASELINE_GZIP_BYTES = 882_497;
const LOCKED_BASELINE_FILE_COUNT = 51;
const LOCKED_BASELINE_SCHEMA_VERSION = 1;
const LOCKED_GZIP_LEVEL = 9;
const LOCKED_NODE_VERSION = "22.23.2";
const LOCKED_ZLIB_VERSION = "1.3.1-e00f703";

const baselineRecord = JSON.parse(readFileSync(
  new URL("../config/immersive-layout-payload-baseline-v1.json", import.meta.url),
  "utf8",
));
const recordedBaselineTotal = baselineRecord.files.reduce(
  (total, file) => total + file.gzipBytes,
  0,
);
const recordedPaths = baselineRecord.files.map(({ path }) => path);
if (
  recordedBaselineTotal !== baselineRecord.emittedJavaScriptAndCssBytes ||
  baselineRecord.files.length !== baselineRecord.fileCount ||
  new Set(recordedPaths).size !== recordedPaths.length ||
  JSON.stringify(recordedPaths) !== JSON.stringify([...recordedPaths].sort())
) {
  throw new Error("The recorded immersive payload baseline manifest is internally inconsistent.");
}
if (
  baselineRecord.schemaVersion !== LOCKED_BASELINE_SCHEMA_VERSION ||
  baselineRecord.releaseBaseSha !== LOCKED_RELEASE_BASE_SHA ||
  baselineRecord.emittedJavaScriptAndCssBytes !== LOCKED_BASELINE_GZIP_BYTES ||
  baselineRecord.fileCount !== LOCKED_BASELINE_FILE_COUNT ||
  baselineRecord.runtime?.node !== LOCKED_NODE_VERSION ||
  baselineRecord.runtime?.zlib !== LOCKED_ZLIB_VERSION ||
  baselineRecord.method?.gzipLevel !== LOCKED_GZIP_LEVEL
) {
  throw new Error("The immersive payload baseline does not match the locked release-base authority.");
}

export const PAYLOAD_BASELINE = Object.freeze({
  releaseBaseSha: baselineRecord.releaseBaseSha,
  node: baselineRecord.runtime.node,
  zlib: baselineRecord.runtime.zlib,
  gzipLevel: baselineRecord.method.gzipLevel,
  emittedJavaScriptAndCssBytes: baselineRecord.emittedJavaScriptAndCssBytes,
});

export const MAX_GZIP_REGRESSION_BYTES = 150_000;

async function listPayloadFiles(directory, rootDirectory = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const entryPath = resolve(directory, entry.name);
    const metadata = await lstat(entryPath);
    if (metadata.isSymbolicLink()) {
      throw new Error(`Payload measurement refuses symbolic links: ${entryPath}`);
    }
    if (metadata.isDirectory()) {
      files.push(...await listPayloadFiles(entryPath, rootDirectory));
      continue;
    }
    if (metadata.isFile() && /\.(?:css|js)$/u.test(entry.name)) {
      files.push({
        absolutePath: entryPath,
        relativePath: entryPath.slice(resolve(rootDirectory).length + 1),
      });
    }
  }

  return files;
}

export async function measureEmittedPayload(siteDirectory) {
  const rootDirectory = resolve(siteDirectory);
  const files = await listPayloadFiles(rootDirectory);
  if (files.length === 0) {
    throw new Error(`No emitted JavaScript or CSS found under ${rootDirectory}.`);
  }

  const measuredFiles = [];
  let gzipBytes = 0;
  for (const file of files) {
    const source = await readFile(file.absolutePath);
    const compressedBytes = gzipSync(source, { level: PAYLOAD_BASELINE.gzipLevel }).byteLength;
    measuredFiles.push({ path: file.relativePath, gzipBytes: compressedBytes });
    gzipBytes += compressedBytes;
  }

  return Object.freeze({
    rootDirectory,
    fileCount: measuredFiles.length,
    gzipBytes,
    files: Object.freeze(measuredFiles),
  });
}

export function assertPayloadGate(measurement) {
  const regressionBytes = measurement.gzipBytes - PAYLOAD_BASELINE.emittedJavaScriptAndCssBytes;
  const maximumCandidateBytes =
    PAYLOAD_BASELINE.emittedJavaScriptAndCssBytes + MAX_GZIP_REGRESSION_BYTES;
  if (regressionBytes > MAX_GZIP_REGRESSION_BYTES) {
    throw new Error(
      `Emitted JavaScript/CSS gzip regression is ${regressionBytes} bytes; ` +
      `the limit is ${MAX_GZIP_REGRESSION_BYTES} bytes ` +
      `(candidate ${measurement.gzipBytes}, maximum ${maximumCandidateBytes}).`,
    );
  }
  return Object.freeze({ regressionBytes, maximumCandidateBytes });
}

async function main() {
  const siteDirectory = process.argv[2];
  if (!siteDirectory) {
    throw new Error("Usage: node scripts/check-immersive-payload.mjs <emitted-site-directory>");
  }
  if (process.versions.node !== PAYLOAD_BASELINE.node || process.versions.zlib !== PAYLOAD_BASELINE.zlib) {
    throw new Error(
      `Payload gate requires Node ${PAYLOAD_BASELINE.node} with zlib ${PAYLOAD_BASELINE.zlib}; ` +
      `received Node ${process.versions.node} with zlib ${process.versions.zlib}.`,
    );
  }

  const measurement = await measureEmittedPayload(siteDirectory);
  const gate = assertPayloadGate(measurement);
  process.stdout.write(`${JSON.stringify({
    releaseBaseSha: PAYLOAD_BASELINE.releaseBaseSha,
    method: `sum(gzipSync(level=${PAYLOAD_BASELINE.gzipLevel})) over emitted .js/.css`,
    baselineGzipBytes: PAYLOAD_BASELINE.emittedJavaScriptAndCssBytes,
    candidateGzipBytes: measurement.gzipBytes,
    regressionGzipBytes: gate.regressionBytes,
    maximumRegressionGzipBytes: MAX_GZIP_REGRESSION_BYTES,
    fileCount: measurement.fileCount,
  }, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
