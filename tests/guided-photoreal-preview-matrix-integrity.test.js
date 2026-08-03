import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, posix } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  PRODUCT_CHOICES,
  SHARED_ROOM_LAYOUTS
} from "../guided-configurator-data.js";
import {
  PUBLISHED_CUSTOMER_PREVIEWS,
  resolvePublishedCustomerPreview
} from "../guided-published-preview-data.js";
import {
  GUIDED_PRODUCT_LAYOUT_COMPATIBILITY
} from "../guided-product-adapter.js";
import {
  PHOTOREAL_MATRIX_HEIGHT,
  PHOTOREAL_MATRIX_INVALID_COUNT,
  PHOTOREAL_MATRIX_MANIFEST_KIND,
  PHOTOREAL_MATRIX_MANIFEST_SCHEMA_VERSION,
  PHOTOREAL_MATRIX_PIPELINE_VERSION,
  PHOTOREAL_MATRIX_PROVENANCE_PATH,
  PHOTOREAL_MATRIX_PUBLIC_ROOT,
  PHOTOREAL_MATRIX_VALID_COUNT,
  PHOTOREAL_MATRIX_WIDTH,
  discoverPhotorealMatrix,
  hashCanonical,
  matrixKey,
  publishedPathFor
} from "../tools/blender/photoreal-matrix-contract.mjs";
import { readWebpDimensions } from "../tools/blender/run-clay-worker.mjs";

const REPOSITORY_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = join(REPOSITORY_ROOT, PHOTOREAL_MATRIX_PROVENANCE_PATH);
const LEGACY_PHASE7_ASSET = "assets/photos/configurator/integrated/tv-unit/framed-tv-wall/tv01-clear-wall-photoreal-preview-v1.webp";

const EXPECTED_PRODUCTS = Object.freeze([
  ["cabinet-shelves", "bookcase", "cabinet-base-shelves"],
  ["drawer-shelves", "bookcase", "drawer-base-shelves"],
  ["open-shelving", "bookcase", "full-open-shelving"],
  ["tv-unit", "tv-unit", "framed-tv-wall"],
  ["floating-storage", "floating-storage", "floating-drawer-bank"],
  ["window-storage", "window-storage", "window-seat-storage"],
  ["radiator-cover", "radiator-cover", "clean-slat-cover"]
]);

const EXPECTED_LAYOUTS = Object.freeze([
  "niche-layout",
  "left-niche",
  "right-niche",
  "clear-wall",
  "fireplace-wall",
  "center-recess",
  "window-wall",
  "door-wall",
  "corner-wall",
  "double-opening"
]);

const EXPECTED_INVALID_KEYS = Object.freeze([
  "tv-unit:center-recess",
  "tv-unit:window-wall",
  "window-storage:niche-layout",
  "window-storage:left-niche",
  "window-storage:right-niche",
  "window-storage:clear-wall",
  "window-storage:fireplace-wall",
  "window-storage:center-recess",
  "window-storage:door-wall",
  "window-storage:corner-wall",
  "window-storage:double-opening",
  "radiator-cover:niche-layout",
  "radiator-cover:left-niche",
  "radiator-cover:right-niche",
  "radiator-cover:clear-wall",
  "radiator-cover:fireplace-wall",
  "radiator-cover:center-recess",
  "radiator-cover:door-wall",
  "radiator-cover:corner-wall",
  "radiator-cover:double-opening"
]);

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function previewConflictKey(preview) {
  return [
    preview.key?.productId,
    preview.key?.layoutId,
    preview.finishOverrideId || "base"
  ].join(":");
}

test("the matrix independently matches the authoritative seven products, ten layouts, and compatibility policy", async () => {
  assert.deepEqual(
    PRODUCT_CHOICES.map(({ id, categoryId, styleId }) => [id, categoryId, styleId]),
    EXPECTED_PRODUCTS
  );
  assert.deepEqual(SHARED_ROOM_LAYOUTS.map(({ id }) => id), EXPECTED_LAYOUTS);

  const compatibilityConfig = await readJson(join(REPOSITORY_ROOT, "config/product-layout-compatibility.json"));
  assert.deepEqual(compatibilityConfig.matrix, GUIDED_PRODUCT_LAYOUT_COMPATIBILITY);

  const matrix = discoverPhotorealMatrix();
  const allExpectedKeys = EXPECTED_PRODUCTS.flatMap(([productId]) => (
    EXPECTED_LAYOUTS.map((layoutId) => `${productId}:${layoutId}`)
  ));
  const statusCounts = matrix.combinations.reduce((counts, entry) => {
    counts[entry.compatibilityStatus] = (counts[entry.compatibilityStatus] || 0) + 1;
    return counts;
  }, {});

  assert.equal(matrix.totalCount, 70);
  assert.equal(matrix.validCount, PHOTOREAL_MATRIX_VALID_COUNT);
  assert.equal(matrix.invalidCount, PHOTOREAL_MATRIX_INVALID_COUNT);
  assert.deepEqual(matrix.combinations.map(({ key }) => key), allExpectedKeys);
  assert.deepEqual(matrix.invalid.map(({ key }) => key), EXPECTED_INVALID_KEYS);
  assert.deepEqual(statusCounts, { supported: 29, conditional: 21, unavailable: 20 });
  assert.equal(new Set(matrix.combinations.map(({ key }) => key)).size, 70);
});

test("the published registry has one non-conflicting base asset for every valid pair and none for unavailable pairs", () => {
  const matrix = discoverPhotorealMatrix();
  const validKeys = new Set(matrix.valid.map(({ key }) => key));
  const invalidKeys = new Set(EXPECTED_INVALID_KEYS);
  const conflictKeys = PUBLISHED_CUSTOMER_PREVIEWS.map(previewConflictKey);
  const basePreviews = PUBLISHED_CUSTOMER_PREVIEWS.filter(({ finishOverrideId }) => !finishOverrideId);

  assert.equal(new Set(conflictKeys).size, conflictKeys.length, "registry keys and finish scopes must be unique");
  assert.equal(basePreviews.length, PHOTOREAL_MATRIX_VALID_COUNT);
  assert.deepEqual(
    new Set(basePreviews.map(({ key }) => matrixKey(key.productId, key.layoutId))),
    validKeys
  );

  for (const preview of PUBLISHED_CUSTOMER_PREVIEWS) {
    const key = matrixKey(preview.key?.productId, preview.key?.layoutId);
    assert.ok(validKeys.has(key), `${key} is not a valid guided combination`);
    assert.ok(!invalidKeys.has(key), `${key} is unavailable and must never be published`);
    assert.equal(preview.schema, "jq-published-customer-preview-v1");
    assert.equal(preview.captureId, "universal-photoreal-preview-matrix-v1");
    assert.equal(preview.asset, publishedPathFor(preview.key.productId, preview.key.layoutId));
    assert.match(preview.alt, /^Photoreal Natural Oak visualization of /);
    assert.equal(preview.customerMaterialApproved, false);
    assert.equal(preview.customerBeautyRenderApproved, false);
  }

  for (const entry of matrix.invalid) {
    assert.equal(
      resolvePublishedCustomerPreview({ productId: entry.productId, layoutId: entry.layoutId }),
      null,
      `${entry.key} must stay on the technical-viewer fallback`
    );
  }
});

test("every base matrix preview resolves solely by product and layout", () => {
  const basePreviews = PUBLISHED_CUSTOMER_PREVIEWS.filter(({ finishOverrideId }) => !finishOverrideId);
  const ignoredDownstreamState = {
    accepted: false,
    categoryId: "changed-category",
    styleId: "changed-style",
    finishId: "changed-finish",
    hardwareId: "changed-hardware",
    hardware: "changed-hardware",
    doorStyle: "changed-door-style",
    lighting: "changed-lighting",
    dimensions: { width: 999, height: 999, depth: 999 },
    measurements: { wallWidth: 999, ceilingHeight: 999, desiredDepth: 99 },
    totalPrice: 999999,
    price: 999999,
    geometryFingerprint: "jq-guided-geometry-v1-changed",
    selectionFingerprint: "jq-guided-selection-v1-changed",
    specificationFingerprint: "jq-guided-spec-v1-changed",
    acceptedSnapshot: null,
    customization: { anything: "changed" }
  };

  for (const preview of basePreviews) {
    const candidate = {
      ...ignoredDownstreamState,
      productId: preview.key.productId,
      layoutId: preview.key.layoutId
    };
    assert.equal(resolvePublishedCustomerPreview(candidate)?.previewId, preview.previewId);

    for (const [field, changedValue] of Object.entries(ignoredDownstreamState)) {
      const changedCandidate = {
        productId: preview.key.productId,
        layoutId: preview.key.layoutId,
        [field]: changedValue
      };
      assert.equal(
        resolvePublishedCustomerPreview(changedCandidate)?.previewId,
        preview.previewId,
        `${field} must not gate ${preview.previewId}`
      );
    }
  }

  assert.equal(resolvePublishedCustomerPreview({ productId: "unknown", layoutId: "clear-wall" }), null);
  assert.equal(resolvePublishedCustomerPreview({ productId: "tv-unit", layoutId: "unknown" }), null);
  assert.equal(resolvePublishedCustomerPreview({ productId: "tv-unit" }), null);
  assert.equal(resolvePublishedCustomerPreview({ layoutId: "clear-wall" }), null);
});

test("the published provenance manifest covers the entire matrix without absolute local paths", async () => {
  const manifest = await readJson(MANIFEST_PATH);
  const matrix = discoverPhotorealMatrix();

  assert.equal(manifest.kind, PHOTOREAL_MATRIX_MANIFEST_KIND);
  assert.equal(manifest.schemaVersion, PHOTOREAL_MATRIX_MANIFEST_SCHEMA_VERSION);
  assert.equal(manifest.pipelineVersion, PHOTOREAL_MATRIX_PIPELINE_VERSION);
  assert.match(manifest.generatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  assert.match(manifest.sourceCommit, /^[a-f0-9]{40}$/);
  assert.deepEqual(manifest.failures, []);
  assert.match(manifest.manifestSha256, /^[a-f0-9]{64}$/);
  const { manifestSha256, ...manifestPayload } = manifest;
  assert.equal(hashCanonical(manifestPayload), manifestSha256);
  assert.deepEqual(manifest.counts, {
    products: 7,
    layouts: 10,
    total: 70,
    valid: PHOTOREAL_MATRIX_VALID_COUNT,
    unavailable: PHOTOREAL_MATRIX_INVALID_COUNT,
    published: PHOTOREAL_MATRIX_VALID_COUNT,
    pending: 0,
    failed: 0
  });
  assert.equal(manifest.entries.length, matrix.totalCount);
  assert.equal(new Set(manifest.entries.map(({ key }) => key)).size, matrix.totalCount);
  assert.deepEqual(manifest.entries.map(({ key }) => key), matrix.combinations.map(({ key }) => key));
  assert.doesNotMatch(JSON.stringify(manifest), /\/Users\/|\/home\/|file:\/\/|[A-Za-z]:\\\\/);

  for (const [index, entry] of manifest.entries.entries()) {
    const authority = matrix.combinations[index];
    assert.equal(entry.key, authority.key);
    assert.equal(entry.valid, authority.valid);
    assert.equal(entry.publishedPath, authority.publishedPath);
    assert.equal(entry.masterPath, authority.masterPath);
    assert.equal(entry.lastFailure, null);
    assert.equal(isAbsolute(entry.publishedPath), false);
    assert.equal(isAbsolute(entry.masterPath), false);
    assert.equal(posix.normalize(entry.publishedPath), entry.publishedPath);
    assert.equal(posix.normalize(entry.masterPath), entry.masterPath);
    assert.ok(!entry.publishedPath.includes(".."));
    assert.ok(!entry.masterPath.includes(".."));
    if (authority.valid) {
      assert.equal(entry.renderStatus, "published");
      assert.ok(entry.provenance, `${entry.key} must include render provenance`);
      const provenance = entry.provenance;
      assert.equal(provenance.key, entry.key);
      assert.equal(provenance.productId, entry.productId);
      assert.equal(provenance.layoutId, entry.layoutId);
      assert.equal(provenance.sourceCommit, manifest.sourceCommit);
      assert.match(provenance.sourceCommand, /^npm run blender:photoreal-matrix/);
      assert.equal(provenance.sourceFinish, "natural-oak");
      assert.match(provenance.geometryFingerprint, /^jq-guided-geometry-v1-/);
      assert.match(provenance.selectionFingerprint, /^jq-guided-selection-v1-/);
      assert.match(provenance.specificationFingerprint, /^jq-guided-spec-v1-/);
      assert.match(provenance.packageKey, /^jq-photoreal-preview-matrix-v1-[a-f0-9]{64}$/);
      assert.match(provenance.generatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      assert.deepEqual(
        {
          path: provenance.publishedAsset?.path,
          mimeType: provenance.publishedAsset?.mimeType,
          width: provenance.publishedAsset?.width,
          height: provenance.publishedAsset?.height
        },
        {
          path: entry.publishedPath,
          mimeType: "image/webp",
          width: PHOTOREAL_MATRIX_WIDTH,
          height: PHOTOREAL_MATRIX_HEIGHT
        }
      );
      assert.ok(Number.isSafeInteger(provenance.publishedAsset.bytes) && provenance.publishedAsset.bytes > 0);
      assert.match(provenance.publishedAsset.sha256, /^[a-f0-9]{64}$/);
      assert.deepEqual(
        {
          path: provenance.masterAsset?.path,
          mimeType: provenance.masterAsset?.mimeType,
          width: provenance.masterAsset?.width,
          height: provenance.masterAsset?.height,
          colorDepth: provenance.masterAsset?.colorDepth
        },
        {
          path: entry.masterPath,
          mimeType: "image/png",
          width: PHOTOREAL_MATRIX_WIDTH,
          height: PHOTOREAL_MATRIX_HEIGHT,
          colorDepth: 16
        }
      );
      assert.ok(Number.isSafeInteger(provenance.masterAsset.bytes) && provenance.masterAsset.bytes > 0);
      assert.match(provenance.masterAsset.sha256, /^[a-f0-9]{64}$/);
      assert.deepEqual(Object.keys(provenance.artifactPaths || {}).sort(), ["blend", "package", "result"]);
      for (const artifactPath of Object.values(provenance.artifactPaths)) {
        assert.equal(typeof artifactPath, "string");
        assert.equal(isAbsolute(artifactPath), false);
        assert.equal(posix.normalize(artifactPath), artifactPath);
        assert.ok(!artifactPath.includes(".."));
      }
    } else {
      assert.equal(entry.renderStatus, "unavailable");
      assert.equal(entry.provenance, null);
    }
  }
});

test("every registry WebP is tracked, correctly named, hashed, sized, and dimensioned", async () => {
  const manifest = await readJson(MANIFEST_PATH);
  const manifestByKey = new Map(manifest.entries.map((entry) => [entry.key, entry]));
  const seenAssets = new Set();

  for (const preview of PUBLISHED_CUSTOMER_PREVIEWS) {
    const key = matrixKey(preview.key.productId, preview.key.layoutId);
    const expectedAsset = `${PHOTOREAL_MATRIX_PUBLIC_ROOT}/${preview.key.productId}/${preview.key.layoutId}/preview-v1.webp`;
    assert.equal(preview.asset, expectedAsset);
    assert.equal(isAbsolute(preview.asset), false);
    assert.equal(posix.normalize(preview.asset), preview.asset);
    assert.ok(!preview.asset.includes(".."));
    assert.ok(!seenAssets.has(preview.asset), `duplicate published path ${preview.asset}`);
    seenAssets.add(preview.asset);

    const bytes = await readFile(join(REPOSITORY_ROOT, preview.asset));
    const metadata = await stat(join(REPOSITORY_ROOT, preview.asset));
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    assert.equal(metadata.isFile(), true);
    assert.equal(metadata.size, preview.assetBytes);
    assert.equal(sha256, preview.assetSha256);
    assert.deepEqual(readWebpDimensions(bytes), {
      width: PHOTOREAL_MATRIX_WIDTH,
      height: PHOTOREAL_MATRIX_HEIGHT
    });
    assert.equal(preview.width, PHOTOREAL_MATRIX_WIDTH);
    assert.equal(preview.height, PHOTOREAL_MATRIX_HEIGHT);
    assert.equal(preview.mimeType, "image/webp");
    assert.equal(preview.aspectRatio, "3 / 2");

    const manifestEntry = manifestByKey.get(key);
    assert.ok(manifestEntry, `${key} is missing from the provenance manifest`);
    assert.equal(manifestEntry.renderStatus, "published");
    assert.equal(manifestEntry.publishedPath, preview.asset);
    assert.equal(manifestEntry.provenance.publishedAsset.path, preview.asset);
    assert.equal(manifestEntry.provenance.publishedAsset.bytes, preview.assetBytes);
    assert.equal(manifestEntry.provenance.publishedAsset.sha256, preview.assetSha256);
    assert.equal(manifestEntry.provenance.publishedAsset.width, preview.width);
    assert.equal(manifestEntry.provenance.publishedAsset.height, preview.height);
    assert.equal(preview.provenance.manifestSha256, manifest.manifestSha256);
    assert.equal(preview.provenance.pipelineVersion, manifest.pipelineVersion);
    assert.equal(preview.provenance.sourceCommit, manifest.sourceCommit);
    assert.equal(preview.provenance.generatedAt, manifest.generatedAt);
    assert.equal(preview.provenance.sourceFinish, "natural-oak");
    assert.equal(preview.provenance.masterAsset, manifestEntry.masterPath);
    assert.equal(preview.provenance.masterAssetBytes, manifestEntry.provenance.masterAsset.bytes);
    assert.equal(preview.provenance.masterAssetSha256, manifestEntry.provenance.masterAsset.sha256);
    assert.equal(preview.provenance.packageKey, manifestEntry.provenance.packageKey);
  }

  const legacyBytes = await readFile(join(REPOSITORY_ROOT, LEGACY_PHASE7_ASSET));
  assert.equal(createHash("sha256").update(legacyBytes).digest("hex"), "796469301d3abac8badccb7b3df8df4bacdd14a18154f3bb80d072eb95822ba9");
  assert.deepEqual(readWebpDimensions(legacyBytes), { width: 1920, height: 1280 });
});
