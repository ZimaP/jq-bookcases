import { JQ_AUTHORITY_REGISTRY_V1 } from "./jq-authority-manifest.js";

export const JQ_PRODUCT_AUTHORITY_VERSION = 1;

export const GUIDED_PRODUCT_AUTHORITY_IDS = Object.freeze({
  "cabinet-shelves": "product:cabinet-shelves",
  "drawer-shelves": "product:drawer-shelves",
  "open-shelving": "product:open-shelving",
  "tv-unit": "product:tv-unit",
  "floating-storage": "product:floating-storage",
  "window-storage": "product:window-storage",
  "radiator-cover": "product:radiator-cover"
});

export const GUIDED_LAYOUT_AUTHORITY_IDS = Object.freeze({
  "niche-layout": "layout:niche-layout",
  "left-niche": "layout:left-niche",
  "right-niche": "layout:right-niche",
  "clear-wall": "layout:clear-wall",
  "fireplace-wall": "layout:fireplace-wall",
  "center-recess": "layout:center-recess",
  "window-wall": "layout:window-wall",
  "door-wall": "layout:door-wall",
  "corner-wall": "layout:corner-wall",
  "double-opening": "layout:double-opening"
});

export function getGuidedCombinationAuthorityId(productId, layoutId) {
  const product = String(productId ?? "").trim();
  const layout = String(layoutId ?? "").trim();
  return product && layout ? `combination:${product}+${layout}` : null;
}

/**
 * Evaluate the exact public Product + Layout choice before it is allowed to
 * become accepted JQ state.
 *
 * Three independent records must pass:
 *   1. the product family;
 *   2. the room layout;
 *   3. the exact product-layout combination.
 *
 * This means adding a product to one catalog and a layout to another can never
 * accidentally create a new manufacturable configuration.
 */
export function evaluateGuidedProductLayoutAuthority(
  productId,
  layoutId,
  registry = JQ_AUTHORITY_REGISTRY_V1
) {
  const productAuthorityId = GUIDED_PRODUCT_AUTHORITY_IDS[productId]
    || (productId ? `product:${productId}` : null);
  const layoutAuthorityId = GUIDED_LAYOUT_AUTHORITY_IDS[layoutId]
    || (layoutId ? `layout:${layoutId}` : null);
  const combinationAuthorityId = getGuidedCombinationAuthorityId(productId, layoutId);
  const requestedIds = [productAuthorityId, layoutAuthorityId, combinationAuthorityId]
    .filter(Boolean);

  if (requestedIds.length !== 3) {
    return deepFreeze({
      accepted: false,
      version: JQ_PRODUCT_AUTHORITY_VERSION,
      productId: productId || null,
      layoutId: layoutId || null,
      authorityIds: requestedIds,
      failures: [{
        id: null,
        code: "AUTHORITY_SELECTION_INCOMPLETE",
        decision: "reject",
        status: null
      }]
    });
  }

  const evaluation = registry.evaluateAll(requestedIds);
  return deepFreeze({
    accepted: evaluation.accepted,
    version: JQ_PRODUCT_AUTHORITY_VERSION,
    productId,
    layoutId,
    authorityIds: requestedIds,
    failures: evaluation.failures.map((failure) => ({
      id: failure.id,
      code: failure.code,
      decision: failure.decision,
      status: failure.record?.status || null
    }))
  });
}

export function createGuidedAuthorityDiagnostics(authority) {
  if (authority?.accepted) return Object.freeze([]);
  return Object.freeze((authority?.failures || []).map((failure) => Object.freeze({
    code: failure.code === "AUTHORITY_REVIEW_REQUIRED"
      ? "JQ_AUTHORITY_REVIEW_REQUIRED"
      : "JQ_AUTHORITY_NOT_APPROVED",
    severity: "error",
    message: failure.code === "AUTHORITY_REVIEW_REQUIRED"
      ? "This JQ product/layout choice requires an explicit review before it can become an accepted configuration."
      : "This JQ product/layout choice is not approved by the current authoritative product manifest.",
    authorityId: failure.id,
    authorityStatus: failure.status,
    authorityCode: failure.code
  })));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const item of Object.values(value)) deepFreeze(item);
  return value;
}
