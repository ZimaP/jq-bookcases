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
const LEGACY_ASSET_PATH = join(
  REPOSITORY_ROOT,
  "assets/photos/configurator/integrated/tv-unit/framed-tv-wall/tv01-clear-wall-photoreal-preview-v1.webp"
);
const LEGACY_SHA256 = "796469301d3abac8badccb7b3df8df4bacdd14a18154f3bb80d072eb95822ba9";
const EXPECTED_MATRIX_ASSET = "assets/photos/configurator/photoreal-matrix/tv-unit/clear-wall/preview-v1.webp";

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

test("the published TV clear-wall preview resolves by product and layout only", async () => {
  assert.equal(PUBLISHED_CUSTOMER_PREVIEWS.length, 50);
  const candidate = await exactCandidate();
  const preview = resolvePublishedCustomerPreview(candidate);

  assert.ok(preview);
  assert.equal(preview.schema, "jq-published-customer-preview-v1");
  assert.equal(preview.previewId, "tv-unit-clear-wall-photoreal-preview-v1");
  assert.equal(preview.captureId, "universal-photoreal-preview-matrix-v1");
  assert.deepEqual(preview.key, { productId: "tv-unit", layoutId: "clear-wall" });
  assert.equal(preview.finishOverrideId, null);
  assert.equal(preview.asset, EXPECTED_MATRIX_ASSET);
  assert.equal(preview.width, 1920);
  assert.equal(preview.height, 1280);
  assert.equal(preview.aspectRatio, "3 / 2");
  assert.equal(preview.mediaFit, "contain");
  assert.equal(preview.customerMaterialApproved, false);
  assert.equal(preview.customerBeautyRenderApproved, false);

  for (const key of [
    "accepted",
    "categoryId",
    "styleId",
    "finishId",
    "geometryFingerprint",
    "selectionFingerprint",
    "specificationFingerprint",
    "totalPrice"
  ]) {
    const value = candidate[key];
    const changed = {
      ...candidate,
      [key]: typeof value === "boolean"
        ? !value
        : typeof value === "number"
          ? value + 1
          : `${value}-different`
    };
    assert.equal(
      resolvePublishedCustomerPreview(changed)?.previewId,
      preview.previewId,
      `${key} is audit/customization state and must not gate the base preview`
    );
  }

  const otherProduct = resolvePublishedCustomerPreview({ ...candidate, productId: "cabinet-shelves" });
  const otherLayout = resolvePublishedCustomerPreview({ ...candidate, layoutId: "right-niche" });
  assert.equal(otherProduct?.key.productId, "cabinet-shelves");
  assert.notEqual(otherProduct?.asset, preview.asset);
  assert.equal(otherLayout?.key.layoutId, "right-niche");
  assert.notEqual(otherLayout?.asset, preview.asset);
  assert.equal(resolvePublishedCustomerPreview({ productId: "window-storage", layoutId: "clear-wall" }), null);
  assert.equal(resolvePublishedCustomerPreview({ productId: "tv-unit", layoutId: "window-wall" }), null);
  assert.equal(resolvePublishedCustomerPreview({ productId: "tv-unit", layoutId: "clear-wall" }), preview);
  assert.equal(resolvePublishedCustomerPreview({ productId: "tv-unit" }), null);
  assert.equal(resolvePublishedCustomerPreview({ layoutId: "clear-wall" }), null);
  assert.equal(resolvePublishedCustomerPreview(null), null);
  assert.equal(resolvePublishedCustomerPreview([]), null);
});

test("the tracked website asset is the exact unrecompressed Phase 7 WebP", async () => {
  const bytes = await readFile(LEGACY_ASSET_PATH);
  const metadata = await stat(LEGACY_ASSET_PATH);
  assert.equal(metadata.isFile(), true);
  assert.equal(metadata.size, 63940);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), LEGACY_SHA256);
  assert.deepEqual(readWebpDimensions(bytes), { width: 1920, height: 1280 });
});

test("Steps 3–5 share one immediate published-preview path with narrow load-error fallback", async () => {
  const [registrySource, generatedSource, configuratorSource, dataSource, cssSource, htmlSource] = await Promise.all([
    readFile(join(REPOSITORY_ROOT, "guided-published-preview-data.js"), "utf8"),
    readFile(join(REPOSITORY_ROOT, "guided-published-preview-registry.generated.js"), "utf8"),
    readFile(join(REPOSITORY_ROOT, "guided-configurator.js"), "utf8"),
    readFile(join(REPOSITORY_ROOT, "guided-configurator-data.js"), "utf8"),
    readFile(join(REPOSITORY_ROOT, "guided-configurator.css"), "utf8"),
    readFile(join(REPOSITORY_ROOT, "configurator.html"), "utf8")
  ]);

  assert.match(generatedSource, new RegExp(EXPECTED_MATRIX_ASSET.replaceAll("/", "\\/")));
  assert.doesNotMatch(registrySource, /\/Users\//);
  assert.doesNotMatch(generatedSource, /\/Users\//);
  assert.doesNotMatch(configuratorSource, /\/Users\//);
  assert.doesNotMatch(registrySource, /concept-tv-wall-v2\.png/);
  assert.match(dataSource, /"clear-wall": "assets\/photos\/configurator\/concept-tv-wall-v2\.png"/);
  assert.match(registrySource, /key: Object\.freeze\(\{\s*productId: record\.productId,\s*layoutId: record\.layoutId/);
  assert.match(registrySource, /BASE_PREVIEW_BY_KEY\.get\(key\)/);
  assert.doesNotMatch(registrySource, /Object\.entries\(preview\.match\)/);
  assert.match(configuratorSource, /function resolveCurrentPublishedPreview\(currentProject = project\)/);
  assert.match(configuratorSource, /renderMeasurementStep\(publishedPreview\)/);
  assert.match(configuratorSource, /renderCustomizationStep\(publishedPreview\)/);
  assert.match(configuratorSource, /renderReviewStep\(publishedPreview\)/);
  assert.match(configuratorSource, /renderConceptPreview\(\{ publishedPreview, includeFitSummary: false \}\)/);
  assert.match(configuratorSource, /renderConceptPreview\(\{ publishedPreview \}\)/);
  assert.doesNotMatch(configuratorSource, /customerPresentation/);
  assert.match(configuratorSource, /data-preview-render-mode="\$\{publishedPreview \? "published-photoreal" : "accepted-geometry"\}"/);
  assert.match(configuratorSource, /class="published-customer-preview-image"/);
  assert.match(configuratorSource, /data-published-preview-image/);
  assert.match(configuratorSource, /failedPublishedPreviewIds/);
  assert.match(configuratorSource, /markPublishedPreviewFailed/);
  assert.match(configuratorSource, /options\.staticGuidance \? "" :/);
  assert.match(configuratorSource, /: renderMeasurementDiagram\(measurementDiagramFields, selectedLayout\)/);
  assert.match(configuratorSource, /Photoreal preview/);
  assert.match(configuratorSource, /width="\$\{preview\.width\}"/);
  assert.match(configuratorSource, /height="\$\{preview\.height\}"/);
  assert.match(cssSource, /\.guided-shell:is\([\s\S]+\.guided-shell--step-3,[\s\S]+\.guided-shell--step-4,[\s\S]+\.guided-shell--step-5[\s\S]+\.concept-preview\.concept-preview--published-beauty/);
  assert.match(cssSource, /\.measurement-diagram-column--preview/);
  assert.match(cssSource, /\.measurement-guidance/);
  assert.match(configuratorSource, /--published-preview-aspect-ratio:\$\{escapeAttribute\(publishedPreview\.aspectRatio\)\}/);
  assert.match(configuratorSource, /--published-preview-media-fit:\$\{escapeAttribute\(publishedPreview\.mediaFit\)\}/);
  assert.match(cssSource, /aspect-ratio: var\(--published-preview-aspect-ratio\)/);
  assert.match(cssSource, /object-fit: var\(--published-preview-media-fit\)/);
  assert.match(cssSource, /\.published-customer-preview-image \{[\s\S]+display: block;[\s\S]+width: 100%;[\s\S]+height: auto;/);
  assert.match(htmlSource, /guided-configurator\.css\?v=universal-photoreal-preview-v1-20260803a/);
  assert.match(htmlSource, /guided-configurator\.js\?v=universal-photoreal-preview-v1-20260803a/);
});
