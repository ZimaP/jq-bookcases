#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import {
  access,
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { readWebpDimensions, resolveBlenderExecutable } from "./run-clay-worker.mjs";
import {
  PHOTOREAL_MATRIX_HEIGHT,
  PHOTOREAL_MATRIX_INVALID_COUNT,
  PHOTOREAL_MATRIX_MANIFEST_KIND,
  PHOTOREAL_MATRIX_MANIFEST_SCHEMA_VERSION,
  PHOTOREAL_MATRIX_MASTER_COLOR_DEPTH,
  PHOTOREAL_MATRIX_PIPELINE_VERSION,
  PHOTOREAL_MATRIX_PROVENANCE_PATH,
  PHOTOREAL_MATRIX_VALID_COUNT,
  PHOTOREAL_MATRIX_WIDTH,
  artifactPathsFor,
  createPhotorealMatrixProvenanceManifest,
  createPhotorealMatrixRenderPackage,
  deterministicJson,
  discoverPhotorealMatrix,
  hashCanonical,
  validatePhotorealMatrixRenderPackage
} from "./photoreal-matrix-contract.mjs";

const execFileAsync = promisify(execFile);
const MODULE_DIRECTORY = dirname(fileURLToPath(import.meta.url));

export const PHOTOREAL_MATRIX_REPOSITORY_ROOT = resolve(MODULE_DIRECTORY, "../..");
export const PHOTOREAL_MATRIX_WORKER_PATH = join(MODULE_DIRECTORY, "photoreal_matrix_worker.py");
export const PHOTOREAL_MATRIX_DEFAULT_MANIFEST_PATH = join(
  PHOTOREAL_MATRIX_REPOSITORY_ROOT,
  PHOTOREAL_MATRIX_PROVENANCE_PATH
);

const SHA40_RE = /^[a-f0-9]{40}$/;
const SHA256_RE = /^[a-f0-9]{64}$/;
const GUIDED_FINGERPRINT_RE = /^jq-guided-[a-z0-9-]+-v[0-9]+-[a-z0-9]+$/i;
const MAX_MASTER_BYTES = 256 * 1024 * 1024;
const MAX_WEBP_BYTES = 64 * 1024 * 1024;

export class PhotorealMatrixRunnerError extends Error {
  constructor(code, message, details = []) {
    super(message);
    this.name = "PhotorealMatrixRunnerError";
    this.code = code;
    this.details = details;
  }
}

export function parsePhotorealMatrixArguments(argv = process.argv.slice(2)) {
  const options = {
    only: [],
    resume: false,
    force: false,
    validateOnly: false,
    manifestOnly: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--resume") options.resume = true;
    else if (argument === "--force") options.force = true;
    else if (argument === "--validate-only") options.validateOnly = true;
    else if (argument === "--manifest-only") options.manifestOnly = true;
    else if (argument === "--only") {
      const value = argv[index + 1];
      assert(value && !value.startsWith("--"), "MISSING_ONLY_VALUE", "--only requires one or more product:layout keys.");
      options.only.push(...value.split(",").map((entry) => entry.trim()).filter(Boolean));
      index += 1;
    } else if (argument.startsWith("--only=")) {
      options.only.push(...argument.slice("--only=".length).split(",").map((entry) => entry.trim()).filter(Boolean));
    } else {
      throw new PhotorealMatrixRunnerError("UNKNOWN_ARGUMENT", `Unknown photoreal matrix argument ${argument}.`);
    }
  }
  assert(!(options.resume && options.force), "CONFLICTING_RUN_MODE", "--resume and --force are mutually exclusive.");
  assert(!(options.validateOnly && options.manifestOnly), "CONFLICTING_RUN_MODE", "--validate-only and --manifest-only are mutually exclusive.");
  assert(!(options.manifestOnly && (options.resume || options.force)), "CONFLICTING_RUN_MODE", "--manifest-only cannot be combined with render overwrite modes.");
  return Object.freeze({ ...options, only: Object.freeze([...new Set(options.only)]) });
}

export function selectPhotorealMatrixEntries(only = []) {
  const matrix = discoverPhotorealMatrix();
  if (!only?.length) return matrix.valid;
  const selected = [];
  for (const key of only) {
    const entry = matrix.combinations.find((candidate) => candidate.key === key);
    assert(entry, "UNKNOWN_MATRIX_KEY", `Unknown product/layout key ${key}.`);
    assert(entry.valid, "UNAVAILABLE_MATRIX_KEY", `${key} is explicitly unavailable and cannot be rendered.`);
    selected.push(entry);
  }
  return Object.freeze(selected);
}

export async function materializePhotorealMatrixManifest(options = {}) {
  const repositoryRoot = absolutePath(options.repositoryRoot || PHOTOREAL_MATRIX_REPOSITORY_ROOT);
  const manifestPath = absolutePath(
    options.manifestPath || PHOTOREAL_MATRIX_PROVENANCE_PATH,
    repositoryRoot
  );
  const sourceCommit = options.sourceCommit || await resolveSourceCommit(repositoryRoot);
  const existing = await readOptionalJson(manifestPath);
  const records = existing?.entries
    ?.map((entry) => entry?.provenance)
    .filter(Boolean) || [];
  const failures = Array.isArray(existing?.failures) ? existing.failures : [];
  const manifest = createPhotorealMatrixProvenanceManifest({
    sourceCommit,
    generatedAt: options.generatedAt || new Date().toISOString(),
    records,
    failures
  });
  const validation = await validatePhotorealMatrixProvenanceManifest(manifest, {
    repositoryRoot,
    requireAssets: false
  });
  assert(validation.valid, "PROVENANCE_MANIFEST_INVALID", "Generated matrix provenance manifest is invalid.", validation.errors);
  await writeDeterministicJsonAtomic(manifestPath, manifest);
  return Object.freeze({ manifestPath, manifest, validation });
}

export async function runPhotorealMatrix(options = {}) {
  const repositoryRoot = absolutePath(options.repositoryRoot || PHOTOREAL_MATRIX_REPOSITORY_ROOT);
  const manifestPath = absolutePath(
    options.manifestPath || PHOTOREAL_MATRIX_PROVENANCE_PATH,
    repositoryRoot
  );
  const selected = selectPhotorealMatrixEntries(options.only || []);
  const sourceCommit = options.sourceCommit || await resolveSourceCommit(repositoryRoot);
  assert(SHA40_RE.test(sourceCommit), "INVALID_SOURCE_COMMIT", "Photoreal matrix provenance requires a full Git commit SHA.");

  if (options.manifestOnly) {
    return materializePhotorealMatrixManifest({
      repositoryRoot,
      manifestPath,
      sourceCommit,
      generatedAt: options.generatedAt
    });
  }

  const packages = [];
  for (const entry of selected) {
    const renderPackage = createPhotorealMatrixRenderPackage(entry.productId, entry.layoutId, {
      sourceCommit
    });
    const validation = validatePhotorealMatrixRenderPackage(renderPackage);
    assert(validation.valid, "MATRIX_PACKAGE_VALIDATION_FAILED", `${entry.key} failed authoritative package validation.`, validation.errors);
    packages.push({ entry, renderPackage, validation });
  }

  const existingManifest = await readOptionalJson(manifestPath);
  const existingValidation = existingManifest
    ? await validatePhotorealMatrixProvenanceManifest(existingManifest, {
        repositoryRoot,
        requireAssets: options.validateOnly ? "published-only" : false
      })
    : null;
  if (existingValidation) {
    assert(existingValidation.valid, "EXISTING_PROVENANCE_INVALID", "Existing photoreal matrix provenance is invalid.", existingValidation.errors);
  }

  if (options.validateOnly) {
    return Object.freeze({
      mode: "validate-only",
      sourceCommit,
      selectedCount: selected.length,
      validMatrixCount: PHOTOREAL_MATRIX_VALID_COUNT,
      unavailableMatrixCount: PHOTOREAL_MATRIX_INVALID_COUNT,
      packageKeys: Object.freeze(packages.map(({ renderPackage }) => renderPackage.packageKey)),
      existingManifest: existingValidation
    });
  }

  const blenderExecutable = options.blenderExecutable
    || resolveBlenderExecutable(options.environment || process.env);
  const workerPath = absolutePath(options.workerPath || PHOTOREAL_MATRIX_WORKER_PATH, repositoryRoot);
  await assertExecutable(blenderExecutable);
  await access(workerPath, fsConstants.R_OK);

  const recordsByKey = new Map(
    (existingManifest?.entries || [])
      .filter((entry) => entry?.provenance)
      .map((entry) => [entry.key, entry.provenance])
  );
  const failuresByKey = new Map(
    (existingManifest?.failures || []).map((failure) => [failure.key, failure])
  );
  const completed = [];
  const skipped = [];
  const failed = [];
  const writeCurrentManifest = async (requireAssets = true) => {
    const manifest = createPhotorealMatrixProvenanceManifest({
      sourceCommit,
      generatedAt: options.generatedAt || new Date().toISOString(),
      records: [...recordsByKey.values()],
      failures: [...failuresByKey.values()]
    });
    const validation = await validatePhotorealMatrixProvenanceManifest(manifest, {
      repositoryRoot,
      requireAssets
    });
    assert(validation.valid, "PROVENANCE_MANIFEST_INVALID", "Rendered provenance manifest failed validation.", validation.errors);
    await writeDeterministicJsonAtomic(manifestPath, manifest);
    return manifest;
  };
  if (existingManifest && existingManifest.sourceCommit !== sourceCommit) {
    assert(
      options.force,
      "SOURCE_COMMIT_CHANGED",
      `Existing matrix outputs were rendered from ${existingManifest.sourceCommit}; use --force to replace them from ${sourceCommit}.`
    );
    const selectedKeys = new Set(packages.map(({ entry }) => entry.key));
    const unselectedPublishedKeys = [...recordsByKey.keys()].filter((key) => !selectedKeys.has(key));
    assert(
      unselectedPublishedKeys.length === 0,
      "SOURCE_COMMIT_PARTIAL_FORCE_FORBIDDEN",
      "A source-commit change requires every previously published key to be included in the force rerender.",
      unselectedPublishedKeys
    );
    recordsByKey.clear();
    failuresByKey.clear();
    await writeCurrentManifest(false);
  }
  for (const { entry, renderPackage } of packages) {
    const relativePaths = artifactPathsFor(entry.productId, entry.layoutId);
    const paths = absoluteArtifactPaths(relativePaths, repositoryRoot);
    try {
      const existingRecord = recordsByKey.get(entry.key);
      if (options.resume && existingRecord) {
        const recordValidation = await validateProvenanceRecord(
          existingRecord,
          entry,
          repositoryRoot,
          true,
          sourceCommit
        );
        if (recordValidation.valid) {
          skipped.push(entry.key);
          failuresByKey.delete(entry.key);
          continue;
        }
      }

      const existingOutputs = await existingPathList([
        paths.master,
        paths.artifactWebp,
        paths.package,
        paths.result,
        paths.blend,
        paths.published
      ]);
      if (options.force || options.resume && existingOutputs.length) {
        // Remove stale published eligibility before deleting or replacing files.
        recordsByKey.delete(entry.key);
        failuresByKey.delete(entry.key);
        await writeCurrentManifest(true);
        for (const path of existingOutputs) await rm(path, { force: true });
      } else if (existingOutputs.length) {
        throw new PhotorealMatrixRunnerError(
          "EXISTING_MATRIX_OUTPUT",
          `${entry.key} already has output files; use --resume or --force.`,
          existingOutputs.map((path) => relativeToRepository(path, repositoryRoot))
        );
      }

      await mkdir(dirname(paths.master), { recursive: true });
      await mkdir(dirname(paths.published), { recursive: true });
      await writeFile(paths.package, deterministicJson(renderPackage), "utf8");
      await runProcess(blenderExecutable, [
        "--background",
        "--factory-startup",
        "--python",
        workerPath,
        "--",
        "--package", paths.package,
        "--project-root", repositoryRoot,
        "--output-dir", dirname(paths.master),
        "--master", paths.master,
        "--beauty", paths.artifactWebp,
        "--result", paths.result,
        "--blend", paths.blend
      ], {
        cwd: repositoryRoot,
        environment: options.environment || process.env,
        spawnImplementation: options.spawnImplementation || spawn,
        inherit: options.inheritOutput !== false
      });

      const verified = await validateRenderedOutputs(renderPackage, paths);
      await copyFile(paths.artifactWebp, paths.published);
      const published = await inspectWebp(paths.published);
      assert(
        published.sha256 === verified.webp.sha256
          && published.bytes === verified.webp.bytes
          && published.width === PHOTOREAL_MATRIX_WIDTH
          && published.height === PHOTOREAL_MATRIX_HEIGHT,
        "PUBLISHED_COPY_MISMATCH",
        `${entry.key} published WebP differs from the verified artifact.`
      );
      const record = createProvenanceRecord({
        entry,
        renderPackage,
        sourceCommit,
        generatedAt: options.generatedAt || new Date().toISOString(),
        paths: relativePaths,
        verified: { ...verified, published }
      });
      recordsByKey.set(entry.key, record);
      failuresByKey.delete(entry.key);
      completed.push(entry.key);
      await writeCurrentManifest(true);
    } catch (error) {
      // A missing overwrite flag is an operator precondition error, not an
      // individual render failure.  Preserve the verified record and asset.
      if (error?.code === "EXISTING_MATRIX_OUTPUT") throw error;
      recordsByKey.delete(entry.key);
      await rm(paths.published, { force: true });
      const failure = {
        key: entry.key,
        code: error?.code || "PHOTOREAL_MATRIX_RENDER_FAILED",
        message: error instanceof Error ? error.message : String(error),
        failedAt: new Date().toISOString()
      };
      failuresByKey.set(entry.key, failure);
      failed.push(failure);
      await writeCurrentManifest(true);
    }
  }

  const finalManifest = await readOptionalJson(manifestPath)
    || createPhotorealMatrixProvenanceManifest({ sourceCommit, generatedAt: new Date().toISOString() });
  let finalValidation = null;
  if (failed.length === 0 && selected.length === PHOTOREAL_MATRIX_VALID_COUNT) {
    finalValidation = await validateFinalPhotorealMatrixProvenanceManifest(finalManifest, {
      repositoryRoot
    });
    assert(
      finalValidation.valid,
      "FINAL_PROVENANCE_INVALID",
      "The complete photoreal matrix failed final asset and provenance validation.",
      finalValidation.errors
    );
  }
  const outcome = Object.freeze({
    mode: "render",
    sourceCommit,
    selectedCount: selected.length,
    completed: Object.freeze(completed),
    skipped: Object.freeze(skipped),
    failed: Object.freeze(failed),
    manifestPath,
    manifest: finalManifest,
    finalValidation
  });
  if (failed.length) {
    throw new PhotorealMatrixRunnerError(
      "PHOTOREAL_MATRIX_PARTIAL_FAILURE",
      `${failed.length} matrix render(s) failed after ${completed.length} succeeded and ${skipped.length} resumed.`,
      failed
    );
  }
  return outcome;
}

export async function validatePhotorealMatrixProvenanceManifest(manifest, options = {}) {
  const errors = [];
  const repositoryRoot = absolutePath(options.repositoryRoot || PHOTOREAL_MATRIX_REPOSITORY_ROOT);
  try {
    const manifestKeys = new Set([
      "kind", "schemaVersion", "pipelineVersion", "generatedAt", "sourceCommit",
      "authoritativeSources", "counts", "entries", "failures", "manifestSha256"
    ]);
    assert(manifest && typeof manifest === "object" && !Array.isArray(manifest), "INVALID_MANIFEST", "Provenance manifest must be an object.");
    assert(JSON.stringify(Object.keys(manifest).sort()) === JSON.stringify([...manifestKeys].sort()), "INVALID_MANIFEST_SHAPE", "Provenance manifest has unknown or missing fields.");
    assert(manifest.kind === PHOTOREAL_MATRIX_MANIFEST_KIND, "INVALID_MANIFEST_KIND", "Unknown provenance manifest kind.");
    assert(manifest.schemaVersion === PHOTOREAL_MATRIX_MANIFEST_SCHEMA_VERSION, "INVALID_MANIFEST_SCHEMA", "Unknown provenance manifest schema.");
    assert(manifest.pipelineVersion === PHOTOREAL_MATRIX_PIPELINE_VERSION, "INVALID_MANIFEST_PIPELINE", "Provenance pipeline version drifted.");
    assert(SHA40_RE.test(manifest.sourceCommit || ""), "INVALID_MANIFEST_COMMIT", "Manifest source commit must be a full Git SHA.");
    assert(isIsoTimestamp(manifest.generatedAt), "INVALID_MANIFEST_TIMESTAMP", "Manifest generatedAt must be a non-null ISO timestamp.");
    const manifestWithoutHash = Object.fromEntries(Object.entries(manifest).filter(([key]) => key !== "manifestSha256"));
    assert(SHA256_RE.test(manifest.manifestSha256 || "") && manifest.manifestSha256 === hashCanonical(manifestWithoutHash), "INVALID_MANIFEST_HASH", "Manifest SHA-256 does not match canonical content.");
    const matrix = discoverPhotorealMatrix();
    assert(Array.isArray(manifest.entries) && manifest.entries.length === matrix.totalCount, "MANIFEST_ENTRY_COUNT_DRIFT", "Provenance manifest must contain all 70 matrix pairs.");
    assert(manifest.counts?.products === 7 && manifest.counts?.layouts === 10, "MANIFEST_AXIS_COUNT_DRIFT", "Provenance matrix axes drifted.");
    assert(manifest.counts?.total === 70 && manifest.counts?.valid === 50 && manifest.counts?.unavailable === 20, "MANIFEST_MATRIX_COUNT_DRIFT", "Provenance matrix counts drifted.");
    assert(Array.isArray(manifest.failures), "INVALID_MANIFEST_FAILURES", "Manifest failures must be an array.");
    const failuresByKey = new Map();
    for (const failure of manifest.failures) {
      const failureKeys = new Set(["key", "code", "message", "failedAt"]);
      assert(failure && typeof failure === "object" && JSON.stringify(Object.keys(failure).sort()) === JSON.stringify([...failureKeys].sort()), "INVALID_FAILURE_SHAPE", "Manifest failure has unknown or missing fields.");
      assert(matrix.valid.some((entry) => entry.key === failure.key), "INVALID_FAILURE_KEY", `Failure ${failure.key} is not a valid matrix pair.`);
      assert(typeof failure.code === "string" && failure.code.length > 0 && typeof failure.message === "string" && failure.message.length > 0, "INVALID_FAILURE_DIAGNOSTIC", `${failure.key} failure diagnostic is incomplete.`);
      assert(isIsoTimestamp(failure.failedAt), "INVALID_FAILURE_TIMESTAMP", `${failure.key} failure timestamp is invalid.`);
      assert(!failuresByKey.has(failure.key), "DUPLICATE_FAILURE_KEY", `Failure ${failure.key} is duplicated.`);
      failuresByKey.set(failure.key, failure);
    }
    assert(new Set(manifest.entries.map((entry) => entry.key)).size === 70, "DUPLICATE_MANIFEST_KEY", "Provenance manifest contains duplicate keys.");
    let publishedCount = 0;
    for (const authoritative of matrix.combinations) {
      const entry = manifest.entries.find((candidate) => candidate.key === authoritative.key);
      assert(entry, "MISSING_MANIFEST_KEY", `Provenance manifest omits ${authoritative.key}.`);
      assert(
        entry.productId === authoritative.productId
          && entry.layoutId === authoritative.layoutId
          && entry.compatibilityStatus === authoritative.compatibilityStatus
          && entry.valid === authoritative.valid,
        "MANIFEST_AUTHORITY_DRIFT",
        `Provenance entry ${authoritative.key} differs from guided compatibility authority.`
      );
      if (!entry.valid) {
        assert(entry.renderStatus === "unavailable" && entry.provenance === null && entry.lastFailure === null, "INVALID_UNAVAILABLE_PROVENANCE", `${entry.key} must remain unavailable with no asset or failure.`);
        continue;
      }
      if (entry.provenance) {
        publishedCount += 1;
        const recordValidation = await validateProvenanceRecord(
          entry.provenance,
          authoritative,
          repositoryRoot,
          options.requireAssets || false,
          manifest.sourceCommit
        );
        assert(recordValidation.valid, "INVALID_PROVENANCE_RECORD", `${entry.key} provenance record is invalid.`, recordValidation.errors);
        assert(entry.renderStatus === "published", "INVALID_RENDER_STATUS", `${entry.key} has provenance but is not published.`);
        assert(entry.lastFailure === null && !failuresByKey.has(entry.key), "PUBLISHED_FAILURE_CONFLICT", `${entry.key} cannot be both published and failed.`);
      } else {
        assert(entry.renderStatus === "pending", "INVALID_RENDER_STATUS", `${entry.key} has no provenance and must be pending.`);
        assert(JSON.stringify(entry.lastFailure) === JSON.stringify(failuresByKey.get(entry.key) || null), "FAILURE_ENTRY_DRIFT", `${entry.key} entry failure differs from top-level failures.`);
      }
    }
    assert(manifest.counts.published === publishedCount && manifest.counts.pending === 50 - publishedCount, "MANIFEST_PUBLISHED_COUNT_DRIFT", "Published/pending counts differ from provenance records.");
    assert(manifest.counts.failed === manifest.failures.length, "MANIFEST_FAILURE_COUNT_DRIFT", "Failure count differs from failure records.");
    if (options.requireComplete === true) {
      assert(publishedCount === PHOTOREAL_MATRIX_VALID_COUNT && manifest.failures.length === 0, "INCOMPLETE_FINAL_MATRIX", "Final provenance requires all 50 valid combinations and zero failures.");
    }
    return Object.freeze({ valid: true, publishedCount, errors: Object.freeze([]) });
  } catch (error) {
    errors.push(normalizeError(error));
    return Object.freeze({ valid: false, publishedCount: 0, errors: Object.freeze(errors) });
  }
}

export async function validateFinalPhotorealMatrixProvenanceManifest(manifest, options = {}) {
  return validatePhotorealMatrixProvenanceManifest(manifest, {
    ...options,
    requireAssets: true,
    requireComplete: true
  });
}

export async function validateProvenanceRecord(record, entry, repositoryRoot, requireAssets = false, expectedSourceCommit = null) {
  try {
    const requiredKeys = new Set([
      "key", "productId", "layoutId", "sourceCommit", "sourceCommand", "sourceFinish",
      "geometryFingerprint", "selectionFingerprint", "specificationFingerprint", "packageKey",
      "generatedAt", "publishedAsset", "masterAsset", "artifactPaths"
    ]);
    assert(record && typeof record === "object" && !Array.isArray(record), "INVALID_PROVENANCE_RECORD", "Provenance record must be an object.");
    assert(JSON.stringify(Object.keys(record).sort()) === JSON.stringify([...requiredKeys].sort()), "INVALID_PROVENANCE_RECORD_SHAPE", `${entry.key} provenance has unknown or missing fields.`);
    assert(record.key === entry.key && record.productId === entry.productId && record.layoutId === entry.layoutId, "PROVENANCE_IDENTITY_MISMATCH", `${entry.key} provenance identifies another pair.`);
    assert(SHA40_RE.test(record.sourceCommit), "INVALID_PROVENANCE_COMMIT", `${entry.key} provenance source commit is invalid.`);
    if (expectedSourceCommit) assert(record.sourceCommit === expectedSourceCommit, "PROVENANCE_COMMIT_MISMATCH", `${entry.key} source commit differs from the manifest source commit.`);
    assert(isIsoTimestamp(record.generatedAt), "INVALID_PROVENANCE_TIMESTAMP", `${entry.key} provenance generatedAt is invalid.`);
    for (const key of ["geometryFingerprint", "selectionFingerprint", "specificationFingerprint"]) {
      assert(GUIDED_FINGERPRINT_RE.test(record[key] || ""), "INVALID_PROVENANCE_FINGERPRINT", `${entry.key} ${key} is invalid.`);
    }
    assert(record.sourceFinish === "natural-oak", "PROVENANCE_FINISH_DRIFT", `${entry.key} provenance must identify Natural Oak.`);
    assert(record.sourceCommand === `npm run blender:photoreal-matrix -- --only ${entry.key}`, "PROVENANCE_COMMAND_DRIFT", `${entry.key} provenance command is stale.`);
    assert(/^jq-photoreal-preview-matrix-v1-[a-f0-9]{64}$/.test(record.packageKey), "INVALID_PROVENANCE_PACKAGE_KEY", `${entry.key} package key is invalid.`);
    validateAssetMetadata(record.publishedAsset, entry.publishedPath, "image/webp", false);
    validateAssetMetadata(record.masterAsset, entry.masterPath, "image/png", true);
    const expectedArtifacts = artifactPathsFor(entry.productId, entry.layoutId);
    const artifactKeys = new Set(["package", "result", "blend"]);
    assert(record.artifactPaths && JSON.stringify(Object.keys(record.artifactPaths).sort()) === JSON.stringify([...artifactKeys].sort()), "INVALID_ARTIFACT_PATH_SHAPE", `${entry.key} artifactPaths has unknown or missing fields.`);
    assert(record.artifactPaths.package === expectedArtifacts.package && record.artifactPaths.result === expectedArtifacts.result && record.artifactPaths.blend === expectedArtifacts.blend, "ARTIFACT_PATH_DRIFT", `${entry.key} artifact paths do not match the naming contract.`);
    for (const path of [
      record.publishedAsset.path,
      record.masterAsset.path,
      record.artifactPaths.package,
      record.artifactPaths.result,
      record.artifactPaths.blend
    ]) {
      assert(typeof path === "string" && path && !isAbsolute(path) && !path.includes(".."), "UNSAFE_PROVENANCE_PATH", `${entry.key} provenance contains an unsafe path.`);
    }
    if (requireAssets) {
      const published = await inspectWebp(resolve(repositoryRoot, record.publishedAsset.path));
      assertAssetMatchesMetadata(published, record.publishedAsset, `${entry.key} publishedAsset`);
      if (requireAssets === true) {
        const master = await inspectPng(resolve(repositoryRoot, record.masterAsset.path));
        assertAssetMatchesMetadata(master, record.masterAsset, `${entry.key} masterAsset`);
        for (const path of Object.values(record.artifactPaths)) {
          const info = await stat(resolve(repositoryRoot, path));
          assert(info.isFile() && !info.isSymbolicLink(), "PROVENANCE_ARTIFACT_MISSING", `${entry.key} artifact is not a regular file: ${path}`);
        }
      }
    }
    return Object.freeze({ valid: true, errors: Object.freeze([]) });
  } catch (error) {
    return Object.freeze({ valid: false, errors: Object.freeze([normalizeError(error)]) });
  }
}

export async function inspectPng(path) {
  const bytes = await readFile(path);
  assert(bytes.length >= 29, "INVALID_PNG", `${path} is too small to be a PNG.`);
  assert(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), "INVALID_PNG", `${path} has an invalid PNG signature.`);
  assert(bytes.toString("ascii", 12, 16) === "IHDR", "INVALID_PNG", `${path} has no leading IHDR.`);
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const colorDepth = bytes[24];
  const colorType = bytes[25];
  assert(colorType === 2, "INVALID_PNG_COLOR_MODE", `${path} must be RGB PNG (color type 2).`);
  return Object.freeze({
    path,
    width,
    height,
    colorDepth,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex")
  });
}

export async function inspectWebp(path) {
  const bytes = await readFile(path);
  const dimensions = readWebpDimensions(bytes);
  return Object.freeze({
    path,
    width: dimensions.width,
    height: dimensions.height,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex")
  });
}

async function validateRenderedOutputs(renderPackage, paths) {
  const master = await inspectPng(paths.master);
  const webp = await inspectWebp(paths.artifactWebp);
  assert(master.width === PHOTOREAL_MATRIX_WIDTH && master.height === PHOTOREAL_MATRIX_HEIGHT, "MASTER_DIMENSIONS_MISMATCH", "Master PNG must be 1920×1280.");
  assert(master.colorDepth === PHOTOREAL_MATRIX_MASTER_COLOR_DEPTH, "MASTER_DEPTH_MISMATCH", "Master PNG must be 16-bit RGB.");
  assert(master.bytes > 0 && master.bytes <= MAX_MASTER_BYTES, "MASTER_SIZE_INVALID", "Master PNG exceeds its byte contract.");
  assert(webp.width === PHOTOREAL_MATRIX_WIDTH && webp.height === PHOTOREAL_MATRIX_HEIGHT, "WEBP_DIMENSIONS_MISMATCH", "Published WebP must be 1920×1280.");
  assert(webp.bytes > 0 && webp.bytes <= MAX_WEBP_BYTES, "WEBP_SIZE_INVALID", "Published WebP exceeds its byte contract.");
  const result = JSON.parse(await readFile(paths.result, "utf8"));
  assert(result?.kind === "jq-photoreal-preview-matrix-render-result" && result?.schemaVersion === 1 && result?.status === "succeeded", "WORKER_RESULT_INVALID", "Matrix worker result did not succeed.");
  assert(result.key === renderPackage.identity.key && result.packageKey === renderPackage.packageKey, "WORKER_RESULT_IDENTITY_MISMATCH", "Matrix worker result targets another package.");
  assert(result.authority?.customerMaterialApproved === false && result.authority?.customerBeautyRenderApproved === false, "CUSTOMER_APPROVAL_FORBIDDEN", "Worker result changed customer approval flags.");
  const masterResult = result.outputs?.find((output) => output.pass === "master");
  const webpResult = result.outputs?.find((output) => output.pass === "published-preview");
  assertOutputMatchesResult(master, masterResult, "master");
  assertOutputMatchesResult(webp, webpResult, "published-preview");
  const blendInfo = await stat(paths.blend);
  assert(blendInfo.isFile() && blendInfo.size > 0 && !blendInfo.isSymbolicLink(), "BLEND_OUTPUT_INVALID", "Matrix blend archive is missing or empty.");
  return Object.freeze({ master, webp, result });
}

function createProvenanceRecord({ entry, renderPackage, sourceCommit, generatedAt, paths, verified }) {
  return Object.freeze({
    key: entry.key,
    productId: entry.productId,
    layoutId: entry.layoutId,
    sourceCommit,
    sourceCommand: `npm run blender:photoreal-matrix -- --only ${entry.key}`,
    sourceFinish: "natural-oak",
    geometryFingerprint: renderPackage.identity.geometryFingerprint,
    selectionFingerprint: renderPackage.identity.selectionFingerprint,
    specificationFingerprint: renderPackage.identity.specificationFingerprint,
    packageKey: renderPackage.packageKey,
    generatedAt,
    publishedAsset: {
      path: paths.published,
      mimeType: "image/webp",
      width: verified.published.width,
      height: verified.published.height,
      bytes: verified.published.bytes,
      sha256: verified.published.sha256
    },
    masterAsset: {
      path: paths.master,
      mimeType: "image/png",
      width: verified.master.width,
      height: verified.master.height,
      colorDepth: verified.master.colorDepth,
      bytes: verified.master.bytes,
      sha256: verified.master.sha256
    },
    artifactPaths: {
      package: paths.package,
      result: paths.result,
      blend: paths.blend
    }
  });
}

function validateAssetMetadata(metadata, expectedPath, mimeType, requireColorDepth) {
  const keys = new Set(["path", "mimeType", "width", "height", "bytes", "sha256"]);
  if (requireColorDepth) keys.add("colorDepth");
  assert(metadata && typeof metadata === "object" && JSON.stringify(Object.keys(metadata).sort()) === JSON.stringify([...keys].sort()), "INVALID_ASSET_METADATA_SHAPE", `${expectedPath} metadata has unknown or missing fields.`);
  assert(metadata?.path === expectedPath && metadata?.mimeType === mimeType, "ASSET_METADATA_IDENTITY_MISMATCH", `Asset metadata must target ${expectedPath}.`);
  assert(metadata.width === PHOTOREAL_MATRIX_WIDTH && metadata.height === PHOTOREAL_MATRIX_HEIGHT, "ASSET_METADATA_DIMENSIONS_MISMATCH", `${expectedPath} metadata dimensions drifted.`);
  assert(Number.isInteger(metadata.bytes) && metadata.bytes > 0, "ASSET_METADATA_SIZE_INVALID", `${expectedPath} metadata bytes are invalid.`);
  assert(SHA256_RE.test(metadata.sha256 || ""), "ASSET_METADATA_HASH_INVALID", `${expectedPath} metadata hash is invalid.`);
  if (requireColorDepth) assert(metadata.colorDepth === 16, "ASSET_METADATA_DEPTH_INVALID", `${expectedPath} metadata color depth must be 16.`);
}

function assertAssetMatchesMetadata(actual, metadata, label) {
  for (const key of ["width", "height", "bytes", "sha256"]) {
    assert(actual[key] === metadata[key], "ASSET_INTEGRITY_MISMATCH", `${label} differs at ${key}.`);
  }
  if (metadata.colorDepth !== undefined) {
    assert(actual.colorDepth === metadata.colorDepth, "ASSET_INTEGRITY_MISMATCH", `${label} differs at colorDepth.`);
  }
}

function assertOutputMatchesResult(actual, record, label) {
  assert(record && record.mimeType === (label === "master" ? "image/png" : "image/webp"), "WORKER_RESULT_OUTPUT_MISSING", `Worker result omits ${label}.`);
  for (const key of ["width", "height", "bytes", "sha256"]) {
    assert(record[key] === actual[key], "WORKER_RESULT_OUTPUT_MISMATCH", `Worker result ${label} differs at ${key}.`);
  }
}

async function resolveSourceCommit(repositoryRoot) {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], {
      cwd: repositoryRoot,
      encoding: "utf8"
    });
    const value = stdout.trim().toLowerCase();
    assert(SHA40_RE.test(value), "INVALID_SOURCE_COMMIT", "git rev-parse HEAD did not return a full commit SHA.");
    return value;
  } catch (error) {
    if (error instanceof PhotorealMatrixRunnerError) throw error;
    throw new PhotorealMatrixRunnerError("SOURCE_COMMIT_UNAVAILABLE", "Unable to resolve the current Git commit for provenance.", [String(error)]);
  }
}

async function runProcess(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = options.spawnImplementation(command, args, {
      cwd: options.cwd,
      env: options.environment,
      stdio: options.inherit ? "inherit" : ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => { stdout += chunk; });
    child.stderr?.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => reject(new PhotorealMatrixRunnerError("BLENDER_PROCESS_START_FAILED", `Unable to start Blender: ${error.message}`)));
    child.on("close", (code, signal) => {
      if (code === 0) {
        resolvePromise({ code, stdout, stderr });
        return;
      }
      reject(new PhotorealMatrixRunnerError(
        "BLENDER_PROCESS_FAILED",
        `Blender matrix worker exited with ${signal ? `signal ${signal}` : `code ${code}`}.`,
        [stdout, stderr].filter(Boolean)
      ));
    });
  });
}

async function assertExecutable(path) {
  await access(path, fsConstants.X_OK);
  const information = await stat(path);
  assert(information.isFile() && !information.isSymbolicLink(), "BLENDER_EXECUTABLE_INVALID", `Blender executable is not a regular file: ${path}`);
}

async function readOptionalJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function writeDeterministicJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, deterministicJson(value), "utf8");
  await rename(temporary, path);
}

async function existingPathList(paths) {
  const existing = [];
  for (const path of paths) {
    try {
      await access(path, fsConstants.F_OK);
      existing.push(path);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  return existing;
}

function absoluteArtifactPaths(paths, repositoryRoot) {
  return Object.freeze({
    master: resolve(repositoryRoot, paths.master),
    artifactWebp: resolve(repositoryRoot, paths.webp),
    package: resolve(repositoryRoot, paths.package),
    result: resolve(repositoryRoot, paths.result),
    blend: resolve(repositoryRoot, paths.blend),
    published: resolve(repositoryRoot, paths.published)
  });
}

function absolutePath(path, base = process.cwd()) {
  return isAbsolute(path) ? resolve(path) : resolve(base, path);
}

function relativeToRepository(path, repositoryRoot) {
  return path.startsWith(`${repositoryRoot}/`) ? path.slice(repositoryRoot.length + 1) : path;
}

function isIsoTimestamp(value) {
  if (typeof value !== "string" || !value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function normalizeError(error) {
  return Object.freeze({
    code: error?.code || "PHOTOREAL_MATRIX_RUNNER_ERROR",
    message: error instanceof Error ? error.message : String(error),
    details: Array.isArray(error?.details) ? structuredClone(error.details) : []
  });
}

function assert(condition, code, message, details = []) {
  if (!condition) throw new PhotorealMatrixRunnerError(code, message, details);
}

async function main() {
  const options = parsePhotorealMatrixArguments();
  const result = await runPhotorealMatrix(options);
  if (result.mode === "validate-only") {
    console.log(`Validated ${result.selectedCount} photoreal matrix package(s); authoritative matrix is 50 valid / 20 unavailable.`);
  } else if (options.manifestOnly) {
    console.log(`Wrote authoritative 70-entry matrix manifest to ${relativeToRepository(result.manifestPath, PHOTOREAL_MATRIX_REPOSITORY_ROOT)}.`);
  } else {
    console.log(`Photoreal matrix complete: ${result.completed.length} rendered, ${result.skipped.length} resumed.`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((error) => {
    const normalized = normalizeError(error);
    console.error(`${normalized.code}: ${normalized.message}`);
    for (const detail of normalized.details) console.error(typeof detail === "string" ? detail : JSON.stringify(detail));
    process.exitCode = 1;
  });
}
