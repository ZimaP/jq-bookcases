import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTHORITY_DECISIONS,
  AUTHORITY_REGISTRY_SCHEMA_VERSION,
  AUTHORITY_STATUS,
  createAuthorityRegistry,
  defineAuthorityRecord
} from "../jq-authority-registry.js";

test("approved records require explicit source evidence", () => {
  assert.throws(
    () => defineAuthorityRecord({ id: "finish:white_dove", status: AUTHORITY_STATUS.approved }),
    /must cite at least one source/
  );
});

test("authority sources require type and ref", () => {
  assert.throws(
    () => defineAuthorityRecord({
      id: "finish:white_dove",
      status: AUTHORITY_STATUS.approved,
      sources: [{ type: "drawing" }]
    }),
    /require non-empty type and ref/
  );
});

test("registry is deny-by-default for unknown product choices", () => {
  const registry = createAuthorityRegistry([]);
  assert.deepEqual(registry.evaluate("unknown"), {
    accepted: false,
    id: "unknown",
    decision: AUTHORITY_DECISIONS.reject,
    code: "AUTHORITY_RECORD_MISSING",
    record: null
  });
});

test("approved record is accepted only when evidence is present", () => {
  const registry = createAuthorityRegistry([{
    id: "finish:white_dove",
    status: AUTHORITY_STATUS.approved,
    sources: [{ type: "owner-approval", ref: "finish-photo-01" }]
  }]);
  const result = registry.evaluate("finish:white_dove");
  assert.equal(result.accepted, true);
  assert.equal(result.code, null);
  assert.equal(result.record.schemaVersion, AUTHORITY_REGISTRY_SCHEMA_VERSION);
});

test("pending and unavailable records are rejected", () => {
  const registry = createAuthorityRegistry([
    { id: "crown:classic", status: AUTHORITY_STATUS.pending },
    { id: "layout:unsupported", status: AUTHORITY_STATUS.unavailable }
  ]);
  assert.equal(registry.evaluate("crown:classic").code, "AUTHORITY_NOT_APPROVED");
  assert.equal(registry.evaluate("layout:unsupported").code, "AUTHORITY_NOT_APPROVED");
});

test("conditional records cannot silently enter accepted product state", () => {
  const registry = createAuthorityRegistry([{
    id: "layout:fireplace",
    status: AUTHORITY_STATUS.conditional
  }]);
  const result = registry.evaluate("layout:fireplace");
  assert.equal(result.accepted, false);
  assert.equal(result.decision, AUTHORITY_DECISIONS.review);
  assert.equal(result.code, "AUTHORITY_REVIEW_REQUIRED");
});

test("duplicate authority ids are rejected", () => {
  assert.throws(() => createAuthorityRegistry([
    { id: "layout:right-niche", status: AUTHORITY_STATUS.pending },
    { id: "layout:right-niche", status: AUTHORITY_STATUS.unavailable }
  ]), /Duplicate authority record/);
});

test("evaluateAll rejects the complete candidate when any authority fails", () => {
  const registry = createAuthorityRegistry([
    {
      id: "product:bookcase",
      status: AUTHORITY_STATUS.approved,
      sources: [{ type: "drawing", ref: "BOOKCASES-7-5-26.pdf" }]
    },
    { id: "finish:unknown", status: AUTHORITY_STATUS.pending }
  ]);
  const result = registry.evaluateAll(["product:bookcase", "finish:unknown"]);
  assert.equal(result.accepted, false);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].id, "finish:unknown");
});
