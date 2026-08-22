import test from "node:test";
import assert from "node:assert/strict";
import {
  createGuidedAuthorityDiagnostics,
  evaluateGuidedProductLayoutAuthority,
  getGuidedCombinationAuthorityId
} from "../jq-product-authority.js";

test("combination authority ids are deterministic", () => {
  assert.equal(
    getGuidedCombinationAuthorityId("tv-unit", "clear-wall"),
    "combination:tv-unit+clear-wall"
  );
  assert.equal(getGuidedCombinationAuthorityId("", "clear-wall"), null);
});

test("drawing-backed TV unit on clear wall is approved", () => {
  const result = evaluateGuidedProductLayoutAuthority("tv-unit", "clear-wall");
  assert.equal(result.accepted, true);
  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.authorityIds, [
    "product:tv-unit",
    "layout:clear-wall",
    "combination:tv-unit+clear-wall"
  ]);
});

test("drawing-backed cabinet and drawer combinations are approved only where explicit", () => {
  assert.equal(
    evaluateGuidedProductLayoutAuthority("cabinet-shelves", "clear-wall").accepted,
    true
  );
  assert.equal(
    evaluateGuidedProductLayoutAuthority("cabinet-shelves", "niche-layout").accepted,
    true
  );
  assert.equal(
    evaluateGuidedProductLayoutAuthority("drawer-shelves", "clear-wall").accepted,
    true
  );

  const unproven = evaluateGuidedProductLayoutAuthority("drawer-shelves", "niche-layout");
  assert.equal(unproven.accepted, false);
  assert.ok(unproven.failures.some((failure) => (
    failure.id === "combination:drawer-shelves+niche-layout"
    && failure.code === "AUTHORITY_RECORD_MISSING"
  )));
});

test("adding two individually known choices does not invent a new combination", () => {
  const result = evaluateGuidedProductLayoutAuthority("tv-unit", "niche-layout");
  assert.equal(result.accepted, false);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].id, "combination:tv-unit+niche-layout");
  assert.equal(result.failures[0].code, "AUTHORITY_RECORD_MISSING");
});

test("pending public products are blocked even on an approved clear wall", () => {
  const result = evaluateGuidedProductLayoutAuthority("floating-storage", "clear-wall");
  assert.equal(result.accepted, false);
  assert.ok(result.failures.some((failure) => (
    failure.id === "product:floating-storage"
    && failure.status === "pending"
  )));
});

test("fireplace composition is review-only rather than silently accepted", () => {
  const result = evaluateGuidedProductLayoutAuthority("cabinet-shelves", "fireplace-wall");
  assert.equal(result.accepted, false);
  assert.ok(result.failures.some((failure) => failure.id === "layout:fireplace-wall"));
  assert.ok(result.failures.some((failure) => (
    failure.id === "combination:cabinet-shelves+fireplace-wall"
  )));
  assert.ok(result.failures.every((failure) => failure.code === "AUTHORITY_REVIEW_REQUIRED"));

  const diagnostics = createGuidedAuthorityDiagnostics(result);
  assert.ok(diagnostics.length >= 1);
  assert.ok(diagnostics.every((diagnostic) => diagnostic.code === "JQ_AUTHORITY_REVIEW_REQUIRED"));
});

test("unknown or incomplete product selections deny by default", () => {
  const unknown = evaluateGuidedProductLayoutAuthority("invented-product", "clear-wall");
  assert.equal(unknown.accepted, false);
  assert.ok(unknown.failures.some((failure) => failure.id === "product:invented-product"));

  const incomplete = evaluateGuidedProductLayoutAuthority(null, "clear-wall");
  assert.equal(incomplete.accepted, false);
  assert.equal(incomplete.failures[0].code, "AUTHORITY_SELECTION_INCOMPLETE");
});
