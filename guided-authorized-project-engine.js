import {
  evaluateGuidedProjectCandidate,
  prepareGuidedProjectPersistence,
  prepareGuidedQuote,
  restoreGuidedAcceptedSnapshot
} from "./guided-project-engine.js";
import {
  JQ_PROJECT_AUTHORITY_STAGES,
  createJqAuthorityDiagnostics,
  evaluateJqProjectAuthority
} from "./jq-project-authority.js";

export const GUIDED_AUTHORIZED_PROJECT_ENGINE_VERSION = "2026.08-jq-authority-v1";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const item of Object.values(value)) deepFreeze(item);
  return value;
}

function authorityRejection(stage, authority) {
  return deepFreeze({
    accepted: false,
    stage,
    authority,
    errors: createJqAuthorityDiagnostics(authority),
    warnings: []
  });
}

/**
 * Customer-facing evaluation path. Geometry authority is checked before room
 * fit or parametric generation, so an unsupported product/layout combination
 * never reaches the deterministic geometry engine.
 */
export function evaluateAuthorizedGuidedProjectCandidate(project = {}, options = {}) {
  const authority = evaluateJqProjectAuthority(project, {
    stage: JQ_PROJECT_AUTHORITY_STAGES.geometry
  });
  if (!authority.accepted) return authorityRejection("authority-geometry", authority);

  const specification = evaluateGuidedProjectCandidate(project, options);
  if (!specification.accepted) {
    return deepFreeze({ ...specification, authority });
  }
  return deepFreeze({ ...specification, authority });
}

/**
 * Atomic customer transaction. A rejected authority candidate preserves the
 * exact previous accepted specification just like any other rejected edit.
 */
export function transactAuthorizedGuidedProject(project, previousAccepted = null, options = {}) {
  const candidate = evaluateAuthorizedGuidedProjectCandidate(project, options);
  if (candidate.accepted) {
    return deepFreeze({
      accepted: true,
      changed: candidate.specificationFingerprint !== previousAccepted?.specificationFingerprint,
      geometryChanged: candidate.geometryFingerprint !== previousAccepted?.geometryFingerprint,
      materialChanged: candidate.selectionFingerprint !== previousAccepted?.selectionFingerprint,
      specification: candidate,
      rejectedCandidate: null,
      errors: [],
      warnings: candidate.warnings || []
    });
  }

  return deepFreeze({
    accepted: false,
    changed: false,
    geometryChanged: false,
    materialChanged: false,
    specification: previousAccepted?.accepted ? previousAccepted : null,
    rejectedCandidate: candidate,
    errors: candidate.errors || [],
    warnings: candidate.warnings || []
  });
}

/**
 * Save is stricter than preview geometry: exact finish/commercial selections
 * and the pricing schedule must also be authoritative before persistence.
 */
export function prepareAuthorizedGuidedProjectPersistence(
  project,
  previousAccepted = null,
  options = {}
) {
  const authority = evaluateJqProjectAuthority(project, {
    stage: JQ_PROJECT_AUTHORITY_STAGES.final
  });
  if (!authority.accepted) {
    return deepFreeze({
      accepted: false,
      persistable: false,
      kind: "guided-authorized-project",
      code: "GUIDED_FINAL_AUTHORITY_BLOCKED",
      message: "This design cannot be saved as a final JQ configuration until every final selection and pricing source is authorized.",
      project: null,
      snapshot: null,
      specification: previousAccepted?.accepted ? previousAccepted : null,
      transaction: null,
      authority,
      errors: createJqAuthorityDiagnostics(authority),
      warnings: []
    });
  }

  const preparation = prepareGuidedProjectPersistence(project, previousAccepted, options);
  return deepFreeze({ ...preparation, authority });
}

/**
 * Restores only a project that still satisfies current final authority. This
 * prevents old saved state from bypassing a later revoked/changed product rule.
 */
export function restoreAuthorizedGuidedAcceptedSnapshot(project, snapshot, options = {}) {
  const authority = evaluateJqProjectAuthority(project, {
    stage: JQ_PROJECT_AUTHORITY_STAGES.final
  });
  if (!authority.accepted) return authorityRejection("authority-restore", authority);
  const restored = restoreGuidedAcceptedSnapshot(project, snapshot, options);
  return deepFreeze({ ...restored, authority });
}

/** Quote transport is impossible until final authority passes. */
export function prepareAuthorizedGuidedQuote(project, snapshot, options = {}) {
  const authority = evaluateJqProjectAuthority(project, {
    stage: JQ_PROJECT_AUTHORITY_STAGES.final
  });
  if (!authority.accepted) {
    return deepFreeze({
      accepted: false,
      stage: "authority-quote",
      specification: null,
      snapshot: null,
      quote: null,
      authority,
      errors: createJqAuthorityDiagnostics(authority),
      warnings: []
    });
  }
  const prepared = prepareGuidedQuote(project, snapshot, options);
  return deepFreeze({ ...prepared, authority });
}
