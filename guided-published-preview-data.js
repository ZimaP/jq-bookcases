const TV01_CLEAR_WALL_PHOTOREAL_PREVIEW = Object.freeze({
  schema: "jq-published-customer-preview-v1",
  previewId: "tv01-clear-wall-photoreal-preview-v1",
  captureId: "photoreal-beauty-v1",
  asset: "assets/photos/configurator/integrated/tv-unit/framed-tv-wall/tv01-clear-wall-photoreal-preview-v1.webp",
  assetSha256: "796469301d3abac8badccb7b3df8df4bacdd14a18154f3bb80d072eb95822ba9",
  assetBytes: 63940,
  mimeType: "image/webp",
  width: 1920,
  height: 1280,
  aspectRatio: "3 / 2",
  mediaFit: "contain",
  mediaObjectPosition: "50% 50%",
  alt: "Natural Oak TV Unit installed on a clear wall",
  materialProfileId: "natural-oak-visualization-v1",
  customerMaterialApproved: false,
  customerBeautyRenderApproved: false,
  match: Object.freeze({
    accepted: true,
    categoryId: "tv-unit",
    productId: "tv-unit",
    styleId: "framed-tv-wall",
    layoutId: "clear-wall",
    finishId: "natural-oak",
    geometryFingerprint: "jq-guided-geometry-v1-028YPJG43EJF6",
    selectionFingerprint: "jq-guided-selection-v1-0mnaift",
    specificationFingerprint: "jq-guided-spec-v1-0qpej5s",
    totalPrice: 15050
  })
});

export const PUBLISHED_CUSTOMER_PREVIEWS = Object.freeze([
  TV01_CLEAR_WALL_PHOTOREAL_PREVIEW
]);

/**
 * Resolve a published preview only when the complete accepted
 * project identity matches its authored capture. A partial match must retain
 * the live technical renderer rather than borrowing an unrelated photograph.
 */
export function resolvePublishedCustomerPreview(candidate = {}) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  return PUBLISHED_CUSTOMER_PREVIEWS.find((preview) => (
    Object.entries(preview.match).every(([key, value]) => candidate[key] === value)
  )) || null;
}
