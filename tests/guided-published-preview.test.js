import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { evaluateGuidedProjectCandidate } from "../guided-project-engine.js";
import {
  PUBLISHED_CUSTOMER_PREVIEW_POLICY,
  PUBLISHED_CUSTOMER_PREVIEWS,
  resolveApprovedPublishedCustomerPreview,
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

test("customer-facing published previews are disabled with an empty approval list", async () => {
  assert.equal(PUBLISHED_CUSTOMER_PREVIEW_POLICY.publishedPreviewModeEnabled, false);
  assert.deepEqual(PUBLISHED_CUSTOMER_PREVIEW_POLICY.approvedPublishedPreviewKeys, []);

  const candidate = await exactCandidate();
  assert.ok(resolvePublishedCustomerPreview(candidate), "the historical registry remains auditable");
  assert.equal(resolveApprovedPublishedCustomerPreview(candidate), null);

  for (const preview of PUBLISHED_CUSTOMER_PREVIEWS) {
    assert.equal(
      resolveApprovedPublishedCustomerPreview({
        productId: preview.key.productId,
        layoutId: preview.key.layoutId,
        finishId: preview.finishOverrideId
      }),
      null,
      `${preview.previewId} must stay on the technical-viewer fallback until approved`
    );
  }
});

test("the tracked website asset is the exact unrecompressed Phase 7 WebP", async () => {
  const bytes = await readFile(LEGACY_ASSET_PATH);
  const metadata = await stat(LEGACY_ASSET_PATH);
  assert.equal(metadata.isFile(), true);
  assert.equal(metadata.size, 63940);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), LEGACY_SHA256);
  assert.deepEqual(readWebpDimensions(bytes), { width: 1920, height: 1280 });
});

test("the four-step public path always uses the immersive registry viewer while dormant preview evidence stays excluded", async () => {
  const [registrySource, generatedSource, configuratorSource, dataSource, cssSource, immersiveCssSource, htmlSource] = await Promise.all([
    readFile(join(REPOSITORY_ROOT, "guided-published-preview-data.js"), "utf8"),
    readFile(join(REPOSITORY_ROOT, "guided-published-preview-registry.generated.js"), "utf8"),
    readFile(join(REPOSITORY_ROOT, "guided-configurator.js"), "utf8"),
    readFile(join(REPOSITORY_ROOT, "guided-configurator-data.js"), "utf8"),
    readFile(join(REPOSITORY_ROOT, "guided-configurator.css"), "utf8"),
    readFile(join(REPOSITORY_ROOT, "guided-immersive-configurator.css"), "utf8"),
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
  assert.match(registrySource, /publishedPreviewModeEnabled: false/);
  assert.match(registrySource, /approvedPublishedPreviewKeys: Object\.freeze\(\[\]\)/);
  assert.match(registrySource, /function resolveApprovedPublishedCustomerPreview/);
  assert.doesNotMatch(registrySource, /Object\.entries\(preview\.match\)/);
  assert.doesNotMatch(configuratorSource, /guided-published-preview-data/);
  assert.doesNotMatch(configuratorSource, /resolveApprovedPublishedCustomerPreview/);
  assert.doesNotMatch(configuratorSource, /isInternalPublishedPreviewAuditEnabled/);
  assert.match(configuratorSource, /if \(project\.currentStep === 3\) return renderCustomizationStep\(\)/);
  assert.match(configuratorSource, /return renderReviewStep\(\)/);
  assert.match(configuratorSource, /data-preview-render-mode="immersive-layout-glb"/);
  assert.match(configuratorSource, /data-guided-3d-mode="immersive-layout"/);
  assert.match(configuratorSource, /data-guided-3d-mode="layout-review-reference"/);
  assert.match(configuratorSource, /renderConceptPreview\(\)/);
  assert.doesNotMatch(configuratorSource, /customerPresentation/);
  assert.doesNotMatch(configuratorSource, /published-customer-preview-image/);
  assert.doesNotMatch(configuratorSource, /data-published-preview-image/);
  assert.doesNotMatch(configuratorSource, /failedPublishedPreviewIds/);
  assert.match(configuratorSource, /data-customization-direct-panel/);
  assert.match(configuratorSource, /data-edit-fit/);
  assert.match(configuratorSource, /data-save-fit/);
  assert.match(configuratorSource, /renderMeasurementDiagram\(fields, selectedLayout, \{ staticGuidance: true \}\)/);
  assert.match(configuratorSource, /CUSTOMER_HIDDEN_MEASUREMENT_IDS/);
  assert.match(configuratorSource, /showDimensions: false/);
  assert.match(configuratorSource, /Adjustable shelf positions — no setup needed here/);
  assert.match(configuratorSource, /Measurements in one place\./);
  assert.doesNotMatch(configuratorSource, /Additional model dimensions|Not yet configurable/);
  assert.match(configuratorSource, /Digital preview only\. Final dimensions and finishes require design confirmation\./);
  assert.match(configuratorSource, /Adjustable shelves are included and can be repositioned after installation/);
  assert.match(cssSource, /Public Room 2 fixed-reference integration/);
  assert.match(cssSource, /\.measurement-guidance/);
  assert.match(immersiveCssSource, /\.immersive-configurator/);
  assert.match(immersiveCssSource, /\.customization-direct-panel/);
  assert.match(immersiveCssSource, /\.direct-choice-grid/);
  assert.match(immersiveCssSource, /\.direct-finish-grid/);
  assert.match(immersiveCssSource, /\.dimensions-workspace--direct/);
  assert.match(htmlSource, /guided-immersive-configurator\.css\?v=finish-premium-production-v1-20260824a/);
  assert.match(htmlSource, /guided-configurator\.js\?v=ios1/);
});
