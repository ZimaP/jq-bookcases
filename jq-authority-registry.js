/**
 * JQ Bookcases authority gate.
 *
 * This module is intentionally independent from UI, geometry, pricing and
 * rendering. It answers one question: may a product choice enter accepted JQ
 * state? Unknown, pending and unavailable choices are denied by default.
 */

export const AUTHORITY_REGISTRY_SCHEMA_VERSION = 1;

export const AUTHORITY_STATUS = Object.freeze({
  approved: "approved",
  conditional: "conditional",
  pending: "pending",
  unavailable: "unavailable"
});

export const AUTHORITY_DECISIONS = Object.freeze({
  allow: "allow",
  review: "review",
  reject: "reject"
});

const AUTHORITY_STATUSES = Object.freeze(Object.values(AUTHORITY_STATUS));
const DECISION_BY_STATUS = Object.freeze({
  [AUTHORITY_STATUS.approved]: AUTHORITY_DECISIONS.allow,
  [AUTHORITY_STATUS.conditional]: AUTHORITY_DECISIONS.review,
  [AUTHORITY_STATUS.pending]: AUTHORITY_DECISIONS.reject,
  [AUTHORITY_STATUS.unavailable]: AUTHORITY_DECISIONS.reject
});

function normalizeToken(value) {
  return String(value ?? "").trim();
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const item of Object.values(value)) deepFreeze(item);
  return value;
}

function normalizeSources(sources) {
  if (!Array.isArray(sources)) return [];
  return sources
    .filter((source) => source && typeof source === "object")
    .map((source) => {
      const type = normalizeToken(source.type);
      const ref = normalizeToken(source.ref);
      if (!type || !ref) {
        throw new TypeError("Authority sources require non-empty type and ref values.");
      }
      return {
        type,
        ref,
        page: source.page ?? null,
        note: normalizeToken(source.note) || null
      };
    });
}

export function defineAuthorityRecord(record) {
  const id = normalizeToken(record?.id);
  const status = normalizeToken(record?.status);
  if (!id) throw new TypeError("Authority record id is required.");
  if (!AUTHORITY_STATUSES.includes(status)) {
    throw new TypeError(`Unknown authority status for ${id}: ${status || "<empty>"}`);
  }

  const sources = normalizeSources(record?.sources);
  if (status === AUTHORITY_STATUS.approved && sources.length === 0) {
    throw new TypeError(`Approved authority record ${id} must cite at least one source.`);
  }

  return deepFreeze({
    schemaVersion: AUTHORITY_REGISTRY_SCHEMA_VERSION,
    id,
    kind: normalizeToken(record?.kind) || "option",
    status,
    decision: DECISION_BY_STATUS[status],
    sources,
    constraints: record?.constraints && typeof record.constraints === "object"
      ? { ...record.constraints }
      : {},
    notes: normalizeToken(record?.notes) || null
  });
}

export function createAuthorityRegistry(records = []) {
  if (!Array.isArray(records)) throw new TypeError("Authority registry records must be an array.");
  const map = new Map();

  for (const raw of records) {
    const record = defineAuthorityRecord(raw);
    if (map.has(record.id)) throw new TypeError(`Duplicate authority record: ${record.id}`);
    map.set(record.id, record);
  }

  function evaluate(id) {
    const normalizedId = normalizeToken(id);
    const record = map.get(normalizedId) || null;
    if (!record) {
      return deepFreeze({
        accepted: false,
        id: normalizedId || null,
        decision: AUTHORITY_DECISIONS.reject,
        code: "AUTHORITY_RECORD_MISSING",
        record: null
      });
    }
    if (record.decision === AUTHORITY_DECISIONS.allow) {
      return deepFreeze({
        accepted: true,
        id: record.id,
        decision: record.decision,
        code: null,
        record
      });
    }
    return deepFreeze({
      accepted: false,
      id: record.id,
      decision: record.decision,
      code: record.decision === AUTHORITY_DECISIONS.review
        ? "AUTHORITY_REVIEW_REQUIRED"
        : "AUTHORITY_NOT_APPROVED",
      record
    });
  }

  return Object.freeze({
    schemaVersion: AUTHORITY_REGISTRY_SCHEMA_VERSION,
    get(id) {
      return map.get(normalizeToken(id)) || null;
    },
    evaluate,
    evaluateAll(ids = []) {
      const results = [...new Set(ids.map(normalizeToken).filter(Boolean))].map(evaluate);
      const failures = results.filter((result) => !result.accepted);
      return deepFreeze({
        accepted: failures.length === 0,
        results,
        failures
      });
    },
    values() {
      return Object.freeze([...map.values()]);
    }
  });
}
