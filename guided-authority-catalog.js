import {
  PRODUCT_CHOICES,
  SHARED_ROOM_LAYOUTS
} from "./guided-configurator-data.js";
import { AUTHORITY_DECISIONS } from "./jq-authority-registry.js";
import {
  JQ_PROJECT_AUTHORITY_STAGES,
  evaluateJqProjectAuthority,
  resolveJqAuthorityProductId
} from "./jq-project-authority.js";

export const GUIDED_AUTHORITY_CATALOG_VERSION = 1;

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const item of Object.values(value)) deepFreeze(item);
  return value;
}

function catalogProject(productOrProject, layoutId) {
  if (typeof productOrProject === "string") {
    return { productId: productOrProject, layoutId };
  }
  return { ...productOrProject, layoutId, layout: layoutId };
}

export function evaluateAuthorityCatalogCombination(productOrProject, layoutId) {
  const project = catalogProject(productOrProject, layoutId);
  const productId = resolveJqAuthorityProductId(project);
  const authority = evaluateJqProjectAuthority(project, {
    stage: JQ_PROJECT_AUTHORITY_STAGES.geometry
  });
  return deepFreeze({
    productId,
    layoutId,
    decision: authority.decision,
    selectable: authority.decision === AUTHORITY_DECISIONS.allow,
    reviewOnly: authority.decision === AUTHORITY_DECISIONS.review,
    visible: authority.decision !== AUTHORITY_DECISIONS.reject,
    authority
  });
}

/**
 * Project the broad historical room catalog into the current JQ-authorized
 * customer choices for one product. Rejected combinations are absent;
 * conditional combinations can remain visible as explicitly non-selectable
 * review cards when requested.
 */
export function getAuthorizedLayoutsForProduct(productOrProject, options = {}) {
  const includeReview = options.includeReview !== false;
  return Object.freeze(SHARED_ROOM_LAYOUTS.flatMap((layout) => {
    const authority = evaluateAuthorityCatalogCombination(productOrProject, layout.id);
    if (!authority.visible) return [];
    if (authority.reviewOnly && !includeReview) return [];
    return [deepFreeze({
      ...layout,
      authorityDecision: authority.decision,
      authoritySelectable: authority.selectable,
      authorityReviewOnly: authority.reviewOnly,
      authority
    })];
  }));
}

/**
 * Step-1 customer products are derived from whether the product has at least
 * one exact geometry-authorized room combination. A product with no allowed
 * combination cannot be advertised as configurable merely because legacy code
 * has a renderer or a product card for it.
 */
export function getAuthorizedProductChoices(options = {}) {
  const includeReviewOnlyProducts = options.includeReviewOnlyProducts === true;
  return Object.freeze(PRODUCT_CHOICES.flatMap((choice) => {
    const layouts = SHARED_ROOM_LAYOUTS.map((layout) => (
      evaluateAuthorityCatalogCombination(choice.id, layout.id)
    ));
    const selectableLayoutIds = layouts
      .filter(({ selectable }) => selectable)
      .map(({ layoutId }) => layoutId);
    const reviewLayoutIds = layouts
      .filter(({ reviewOnly }) => reviewOnly)
      .map(({ layoutId }) => layoutId);
    const selectable = selectableLayoutIds.length > 0;
    const reviewOnly = !selectable && reviewLayoutIds.length > 0;
    if (!selectable && !(includeReviewOnlyProducts && reviewOnly)) return [];

    return [deepFreeze({
      ...choice,
      authorityDecision: selectable ? AUTHORITY_DECISIONS.allow : AUTHORITY_DECISIONS.review,
      authoritySelectable: selectable,
      authorityReviewOnly: reviewOnly,
      authorizedLayoutIds: Object.freeze(selectableLayoutIds),
      reviewLayoutIds: Object.freeze(reviewLayoutIds)
    })];
  }));
}

export function getAuthorityCatalogSummary() {
  const products = getAuthorizedProductChoices({ includeReviewOnlyProducts: true });
  const selectableProducts = products.filter(({ authoritySelectable }) => authoritySelectable);
  const reviewOnlyProducts = products.filter(({ authorityReviewOnly }) => authorityReviewOnly);
  const selectableCombinations = selectableProducts.flatMap((product) => (
    product.authorizedLayoutIds.map((layoutId) => `${product.id}+${layoutId}`)
  ));
  const reviewCombinations = products.flatMap((product) => (
    product.reviewLayoutIds.map((layoutId) => `${product.id}+${layoutId}`)
  ));
  return deepFreeze({
    version: GUIDED_AUTHORITY_CATALOG_VERSION,
    selectableProductIds: selectableProducts.map(({ id }) => id),
    reviewOnlyProductIds: reviewOnlyProducts.map(({ id }) => id),
    selectableCombinations,
    reviewCombinations
  });
}
