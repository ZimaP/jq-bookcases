import {
  AUTHORITY_DECISIONS,
  createAuthorityRegistry
} from "./jq-authority-registry.js";
import { JQ_AUTHORITY_RECORDS_V1 } from "./jq-authority-manifest.js";
import { JQ_OWNER_AUTHORITY_RECORDS_V1 } from "./jq-authority-owner-manifest.js";

export const JQ_PROJECT_AUTHORITY_VERSION = 1;

export const JQ_PROJECT_AUTHORITY_STAGES = Object.freeze({
  geometry: "geometry",
  final: "final"
});

export const JQ_PROJECT_AUTHORITY_REGISTRY_V1 = createAuthorityRegistry([
  ...JQ_AUTHORITY_RECORDS_V1,
  ...JQ_OWNER_AUTHORITY_RECORDS_V1
]);

const FIXED_GEOMETRY_AUTHORITY_IDS = Object.freeze([
  "material:interior-clear-maple-uv"
]);

function token(value) {
  return String(value ?? "").trim().toLowerCase();
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const item of Object.values(value)) deepFreeze(item);
  return value;
}

function finalSelectionAuthorityIds(project = {}) {
  const ids = [];
  const finish = token(project.finish);
  const hardware = token(project.hardware);
  const lighting = token(project.lighting);
  const crown = token(project.topTreatment || project.crownStyle);

  if (finish) ids.push(`finish:${finish}`);
  if (hardware) ids.push(`hardware:${hardware}`);
  if (lighting) ids.push(`lighting:${lighting}`);
  if (crown) ids.push(`crown:${crown}`);
  return ids;
}

/**
 * Resolve the authority records that govern one customer project.
 *
 * Geometry authority is deliberately small and hard: the product, the room
 * layout, their exact combination, and the fixed clear-maple interior rule.
 * Final authority adds customer-facing finish/hardware/lighting/crown choices;
 * until those exact records exist they reject by default.
 */
export function resolveJqProjectAuthorityIds(project = {}, options = {}) {
  const stage = options.stage || JQ_PROJECT_AUTHORITY_STAGES.geometry;
  const productId = token(project.productId || project.productChoiceId);
  const layoutId = token(project.layoutId || project.layout);
  const ids = [
    productId ? `product:${productId}` : "product:<missing>",
    layoutId ? `layout:${layoutId}` : "layout:<missing>",
    productId && layoutId
      ? `combination:${productId}+${layoutId}`
      : "combination:<missing>",
    ...FIXED_GEOMETRY_AUTHORITY_IDS
  ];

  if (stage === JQ_PROJECT_AUTHORITY_STAGES.final) {
    ids.push(...finalSelectionAuthorityIds(project));
  }

  return Object.freeze([...new Set(ids)]);
}

export function evaluateJqProjectAuthority(project = {}, options = {}) {
  const stage = options.stage || JQ_PROJECT_AUTHORITY_STAGES.geometry;
  if (!Object.values(JQ_PROJECT_AUTHORITY_STAGES).includes(stage)) {
    throw new TypeError(`Unknown JQ authority stage: ${stage}`);
  }

  const authorityIds = resolveJqProjectAuthorityIds(project, { stage });
  const evaluation = JQ_PROJECT_AUTHORITY_REGISTRY_V1.evaluateAll(authorityIds);
  const hasReject = evaluation.failures.some(
    (failure) => failure.decision === AUTHORITY_DECISIONS.reject
  );
  const hasReview = evaluation.failures.some(
    (failure) => failure.decision === AUTHORITY_DECISIONS.review
  );
  const decision = hasReject
    ? AUTHORITY_DECISIONS.reject
    : hasReview
      ? AUTHORITY_DECISIONS.review
      : AUTHORITY_DECISIONS.allow;

  return deepFreeze({
    accepted: evaluation.accepted,
    authorityVersion: JQ_PROJECT_AUTHORITY_VERSION,
    stage,
    decision,
    authorityIds,
    results: evaluation.results,
    failures: evaluation.failures,
    code: evaluation.accepted
      ? null
      : decision === AUTHORITY_DECISIONS.review
        ? "JQ_PROJECT_AUTHORITY_REVIEW_REQUIRED"
        : "JQ_PROJECT_AUTHORITY_REJECTED"
  });
}

export function createJqAuthorityDiagnostics(authority) {
  if (authority?.accepted) return Object.freeze([]);
  return Object.freeze((authority?.failures || []).map((failure) => Object.freeze({
    code: failure.code || authority?.code || "JQ_PROJECT_AUTHORITY_REJECTED",
    severity: "error",
    authorityId: failure.id,
    authorityStatus: failure.record?.status || "missing",
    message: failure.decision === AUTHORITY_DECISIONS.review
      ? `JQ review is required before ${failure.id || "this selection"} can enter accepted product state.`
      : `JQ has not authorized ${failure.id || "this selection"} for accepted product state.`
  })));
}
