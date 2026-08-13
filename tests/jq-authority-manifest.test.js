import test from "node:test";
import assert from "node:assert/strict";
import {
  JQ_AUTHORITY_RECORDS_V1,
  JQ_AUTHORITY_REGISTRY_V1,
  JQ_AUTHORITY_SOURCE_IDS
} from "../jq-authority-manifest.js";

test("approved authority records cite explicit JQ source evidence", () => {
  const knownSources = new Set(Object.values(JQ_AUTHORITY_SOURCE_IDS));
  assert.ok(JQ_AUTHORITY_RECORDS_V1.length >= 30);
  for (const record of JQ_AUTHORITY_RECORDS_V1) {
    if (record.status !== "approved") continue;
    assert.ok(record.sources.length > 0, record.id);
    for (const source of record.sources) {
      assert.ok(knownSources.has(source.ref), `${record.id}: ${source.ref}`);
      assert.ok(Number.isInteger(source.page), record.id);
      assert.ok(source.page >= 1, record.id);
      if (source.ref === JQ_AUTHORITY_SOURCE_IDS.bookcasesJuly5) {
        assert.ok(source.page <= 7, record.id);
      } else {
        assert.equal(source.page, 1, record.id);
      }
    }
  }
});

test("drawing shelf span rules are represented exactly", () => {
  assert.deepEqual(
    JQ_AUTHORITY_REGISTRY_V1.get("rule:shelf-span:mdf-1in-27in").constraints,
    { material: "MDF", thicknessIn: 1, maximumClearSpanIn: 27 }
  );
  assert.deepEqual(
    JQ_AUTHORITY_REGISTRY_V1.get("rule:shelf-span:mdf-1.25in-31in").constraints,
    { material: "MDF", thicknessIn: 1.25, maximumClearSpanIn: 31 }
  );
  assert.deepEqual(
    JQ_AUTHORITY_REGISTRY_V1.get("rule:shelf-span:mdf-1.5in-36in").constraints,
    { material: "MDF", thicknessIn: 1.5, maximumClearSpanIn: 36 }
  );
});

test("drawing countertop rule is 1.25 inches", () => {
  assert.deepEqual(
    JQ_AUTHORITY_REGISTRY_V1.get("rule:countertop-thickness:1.25in").constraints,
    { thicknessIn: 1.25 }
  );
});

test("fireplace detail records explicit pins but keeps global filler applicability gated", () => {
  assert.deepEqual(
    JQ_AUTHORITY_REGISTRY_V1.get("rule:shelf-pin-diameter:5mm").constraints,
    { diameterMm: 5 }
  );
  const filler = JQ_AUTHORITY_REGISTRY_V1.evaluate("rule:filler-minimum:0.75in");
  assert.equal(filler.accepted, false);
  assert.equal(filler.code, "AUTHORITY_REVIEW_REQUIRED");
  assert.deepEqual(filler.record.constraints, { minimumIn: 0.75 });
});

test("unsupported repository defaults are not silently promoted", () => {
  for (const id of [
    "crown:classic-crown",
    "finish:white-dove",
    "hardware:brass-knob"
  ]) {
    const result = JQ_AUTHORITY_REGISTRY_V1.evaluate(id);
    assert.equal(result.accepted, false, id);
    assert.equal(result.code, "AUTHORITY_RECORD_MISSING", id);
  }
});

test("existing guided concepts without locked drawings remain pending", () => {
  for (const id of [
    "product:open-shelving",
    "product:floating-storage",
    "product:window-storage",
    "product:radiator-cover",
    "layout:left-niche",
    "layout:right-niche",
    "layout:window-wall",
    "layout:door-wall",
    "layout:corner-wall"
  ]) {
    const result = JQ_AUTHORITY_REGISTRY_V1.evaluate(id);
    assert.equal(result.accepted, false, id);
    assert.equal(result.code, "AUTHORITY_NOT_APPROVED", id);
    assert.equal(result.record.status, "pending", id);
  }
});

test("fireplace layout exists but remains review-only", () => {
  const result = JQ_AUTHORITY_REGISTRY_V1.evaluate("layout:fireplace-wall");
  assert.equal(result.accepted, false);
  assert.equal(result.code, "AUTHORITY_REVIEW_REQUIRED");
  assert.equal(result.record.status, "conditional");
});
