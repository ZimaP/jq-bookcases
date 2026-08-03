import {
  PUBLISHED_PHOTOREAL_MATRIX_ASSETS,
  PUBLISHED_PHOTOREAL_MATRIX_METADATA
} from "./guided-published-preview-registry.generated.js?v=universal-photoreal-preview-v1-20260803a";

const PREVIEW_SCHEMA = "jq-published-customer-preview-v1";
const CAPTURE_ID = "universal-photoreal-preview-matrix-v1";

export const PUBLISHED_CUSTOMER_PREVIEWS = Object.freeze(
  PUBLISHED_PHOTOREAL_MATRIX_ASSETS.map((record) => Object.freeze({
    schema: PREVIEW_SCHEMA,
    previewId: `${record.productId}-${record.layoutId}${record.finishOverrideId ? `-${record.finishOverrideId}` : ""}-photoreal-preview-v1`,
    captureId: CAPTURE_ID,
    key: Object.freeze({
      productId: record.productId,
      layoutId: record.layoutId
    }),
    finishOverrideId: record.finishOverrideId || null,
    asset: record.asset,
    assetSha256: record.assetSha256,
    assetBytes: record.assetBytes,
    mimeType: "image/webp",
    width: 1920,
    height: 1280,
    aspectRatio: "3 / 2",
    mediaFit: "contain",
    mediaObjectPosition: "50% 50%",
    alt: `Photoreal Natural Oak visualization of ${record.productLabel} for ${record.layoutLabel}`,
    materialProfileId: "natural-oak-visualization-v1",
    customerMaterialApproved: false,
    customerBeautyRenderApproved: false,
    provenance: Object.freeze({
      manifestSha256: PUBLISHED_PHOTOREAL_MATRIX_METADATA.manifestSha256,
      pipelineVersion: PUBLISHED_PHOTOREAL_MATRIX_METADATA.pipelineVersion,
      sourceCommit: PUBLISHED_PHOTOREAL_MATRIX_METADATA.sourceCommit,
      generatedAt: PUBLISHED_PHOTOREAL_MATRIX_METADATA.generatedAt,
      sourceFinish: record.sourceFinish,
      masterAsset: record.masterAsset,
      masterAssetSha256: record.masterAssetSha256,
      masterAssetBytes: record.masterAssetBytes,
      packageKey: record.packageKey
    }),
    match: Object.freeze({
      productId: record.productId,
      layoutId: record.layoutId,
      finishId: record.sourceFinish,
      geometryFingerprint: record.geometryFingerprint,
      selectionFingerprint: record.selectionFingerprint,
      specificationFingerprint: record.specificationFingerprint
    })
  }))
);

const BASE_PREVIEW_BY_KEY = new Map();
const FINISH_PREVIEW_BY_KEY = new Map();
for (const preview of PUBLISHED_CUSTOMER_PREVIEWS) {
  const key = previewKey(preview.key.productId, preview.key.layoutId);
  const index = preview.finishOverrideId ? FINISH_PREVIEW_BY_KEY : BASE_PREVIEW_BY_KEY;
  const indexedKey = preview.finishOverrideId
    ? `${key}\u0000${preview.finishOverrideId}`
    : key;
  if (index.has(indexedKey)) {
    throw new Error(`Duplicate published preview registry key: ${indexedKey}`);
  }
  index.set(indexedKey, preview);
}

/**
 * Resolve a published preview by the only required eligibility fields:
 * Step 1 product identity plus Step 2 layout identity.
 *
 * A dedicated finish asset may override that base key when explicitly
 * registered. All other capture metadata remains audit-only and never gates
 * the base preview.
 */
export function resolvePublishedCustomerPreview(candidate = {}) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const productId = String(candidate.productId || "").trim();
  const layoutId = String(candidate.layoutId || "").trim();
  if (!productId || !layoutId) return null;

  const key = previewKey(productId, layoutId);
  const finishId = String(candidate.finishId || "").trim();
  return (finishId && FINISH_PREVIEW_BY_KEY.get(`${key}\u0000${finishId}`))
    || BASE_PREVIEW_BY_KEY.get(key)
    || null;
}

function previewKey(productId, layoutId) {
  return `${productId}\u0000${layoutId}`;
}
