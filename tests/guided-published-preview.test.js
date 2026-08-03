import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { evaluateGuidedProjectCandidate } from "../guided-project-engine.js";
import {
  PUBLISHED_CUSTOMER_PREVIEWS,
  resolvePublishedCustomerPreview
} from "../guided-published-preview-data.js";
import { readWebpDimensions } from "../tools/blender/run-clay-worker.mjs";

const REPOSITORY_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE_PATH = join(
  REPOSITORY_ROOT,
  "tests/fixtures/blender-prototype/TV01-clear-wall-foundation.json"
);
const ASSET_PATH = join(
  REPOSITORY_ROOT,
  "assets/photos/configurator/integrated/tv-unit/framed-tv-wall/tv01-clear-wall-photoreal-preview-v1.webp"
);
const EXPECTED_ASSET = "assets/photos/configurator/integrated/tv-unit/framed-tv-wall/tv01-clear-wall-photoreal-preview-v1.webp";
const EXPECTED_SHA256 = "796469301d3abac8badccb7b3df8df4bacdd14a18154f3bb80d072eb95822ba9";

async function exactCandidate() {
  const fixture = JSON.parse(await readFile(FIXTURE_PATH, "utf8"));
  const specification = evaluateGuidedProjectCandidate(fixture.project);
  assert.equal(specification.accepted, true);
  return {
    accepted: specification.accepted,
    categoryId: "tv-unit",
    productId: specification.productId,
    styleId: "framed-tv-wall",
    layoutId: specification.layoutId,
    finishId: fixture.project.finish,
    geometryFingerprint: specification.geometryFingerprint,
    selectionFingerprint: specification.selectionFingerprint,
    specificationFingerprint: specification.specificationFingerprint,
    totalPrice: specification.pricing.total
  };
}

test("the published TV01 preview resolves only for the exact accepted Natural Oak capture", async () => {
  assert.equal(PUBLISHED_CUSTOMER_PREVIEWS.length, 1);
  const candidate = await exactCandidate();
  const preview = resolvePublishedCustomerPreview(candidate);

  assert.ok(preview);
  assert.equal(preview.schema, "jq-published-customer-preview-v1");
  assert.equal(preview.previewId, "tv01-clear-wall-photoreal-preview-v1");
  assert.equal(preview.captureId, "photoreal-beauty-v1");
  assert.equal(preview.asset, EXPECTED_ASSET);
  assert.equal(preview.width, 1920);
  assert.equal(preview.height, 1280);
  assert.equal(preview.aspectRatio, "3 / 2");
  assert.equal(preview.mediaFit, "contain");
  assert.equal(preview.customerMaterialApproved, false);
  assert.equal(preview.customerBeautyRenderApproved, false);

  for (const [key, value] of Object.entries(candidate)) {
    const changed = {
      ...candidate,
      [key]: typeof value === "boolean"
        ? !value
        : typeof value === "number"
          ? value + 1
          : `${value}-different`
    };
    assert.equal(resolvePublishedCustomerPreview(changed), null, `${key} must fail closed`);
  }
  assert.equal(resolvePublishedCustomerPreview(null), null);
  assert.equal(resolvePublishedCustomerPreview([]), null);
});

test("the tracked website asset is the exact unrecompressed Phase 7 WebP", async () => {
  const bytes = await readFile(ASSET_PATH);
  const metadata = await stat(ASSET_PATH);
  assert.equal(metadata.isFile(), true);
  assert.equal(metadata.size, 63940);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), EXPECTED_SHA256);
  assert.deepEqual(readWebpDimensions(bytes), { width: 1920, height: 1280 });
});

test("the Review integration is scoped, relative, versioned, and leaves the legacy TV concept intact", async () => {
  const [registrySource, configuratorSource, dataSource, cssSource] = await Promise.all([
    readFile(join(REPOSITORY_ROOT, "guided-published-preview-data.js"), "utf8"),
    readFile(join(REPOSITORY_ROOT, "guided-configurator.js"), "utf8"),
    readFile(join(REPOSITORY_ROOT, "guided-configurator-data.js"), "utf8"),
    readFile(join(REPOSITORY_ROOT, "guided-configurator.css"), "utf8")
  ]);

  assert.match(registrySource, new RegExp(EXPECTED_ASSET.replaceAll("/", "\\/")));
  assert.doesNotMatch(registrySource, /\/Users\//);
  assert.doesNotMatch(configuratorSource, /\/Users\//);
  assert.doesNotMatch(registrySource, /concept-tv-wall-v2\.png/);
  assert.match(dataSource, /"clear-wall": "assets\/photos\/configurator\/concept-tv-wall-v2\.png"/);
  assert.match(configuratorSource, /renderConceptPreview\(\{ customerPresentation: true \}\)/);
  assert.match(configuratorSource, /renderConceptPreview\(\)/);
  assert.match(configuratorSource, /data-preview-render-mode="\$\{publishedPreview \? "published-photoreal" : "accepted-geometry"\}"/);
  assert.match(configuratorSource, /class="published-customer-preview-image"/);
  assert.match(configuratorSource, /width="\$\{preview\.width\}"/);
  assert.match(configuratorSource, /height="\$\{preview\.height\}"/);
  assert.match(cssSource, /\.guided-shell--step-5[\s\S]+\.concept-preview--published-beauty/);
  assert.match(configuratorSource, /--published-preview-aspect-ratio:\$\{escapeAttribute\(publishedPreview\.aspectRatio\)\}/);
  assert.match(configuratorSource, /--published-preview-media-fit:\$\{escapeAttribute\(publishedPreview\.mediaFit\)\}/);
  assert.match(cssSource, /aspect-ratio: var\(--published-preview-aspect-ratio\)/);
  assert.match(cssSource, /object-fit: var\(--published-preview-media-fit\)/);
});
