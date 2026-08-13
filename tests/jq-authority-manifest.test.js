import test from "node:test";
import assert from "node:assert/strict";
import {
  JQ_AUTHORITY_RECORDS_V1,
  JQ_AUTHORITY_REGISTRY_V1,
  JQ_AUTHORITY_SOURCE_IDS
} from "../jq-authority-manifest.js";

test("drawing-backed authority seed contains only explicit source citations", () => {
  assert.ok(JQ_AUTHORITY_RECORDS_V1.length >= 10);
  for (const record of JQ_AUTHORITY_RECORDS_V1) {
    assert.equal(record.status, "approved");
    assert.ok(record.sources.length > 0);
    for (const source of record.sources) {
      assert.equal(source.ref, JQ_AUTHORITY_SOURCE_IDS.bookcasesJuly5);
      assert.ok(Number.isInteger(source.page));
      assert.ok(source.page >= 1 && source.page <= 7);
    }
  }
});

test("July 5 drawing shelf span rules are represented exactly", () => {
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

test("July 5 drawing countertop rule is 1.25 inches", () => {
  assert.deepEqual(
    JQ_AUTHORITY_REGISTRY_V1.get("rule:countertop-thickness:1.25in").constraints,
    { thicknessIn: 1.25 }
  );
});

test("unsupported repository defaults are not silently promoted by the seed manifest", () => {
  for (const id of [
    "crown:classic-crown",
    "finish:white-dove",
    "hardware:brass-knob",
    "layout:fireplace-wall"
  ]) {
    const result = JQ_AUTHORITY_REGISTRY_V1.evaluate(id);
    assert.equal(result.accepted, false, id);
    assert.equal(result.code, "AUTHORITY_RECORD_MISSING", id);
  }
});
