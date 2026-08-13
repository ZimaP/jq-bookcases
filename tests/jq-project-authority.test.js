import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  JQ_PROJECT_AUTHORITY_STAGES,
  evaluateJqProjectAuthority,
  resolveJqProjectAuthorityIds
} from "../jq-project-authority.js";

const goldenCatalog = JSON.parse(readFileSync(
  new URL("../config/golden-projects.json", import.meta.url),
  "utf8"
));
const goldenById = new Map(goldenCatalog.projects.map((project) => [project.id, project]));

const EXPECTED_GEOMETRY_AUTHORITY = Object.freeze({
  "G01-right-niche-tv": "reject",
  "G02-center-niche-cabinets": "allow",
  "G03-clear-drawers-wide": "allow",
  "G04-clear-open": "reject",
  "G05-fireplace": "review",
  "G06-window-storage": "reject",
  "G07-door-wall": "reject",
  "G08-between-openings": "reject",
  "G09-corner": "reject",
  "G10-floating": "reject",
  "G11-radiator": "reject",
  "G12-round-trip": "reject"
});

test("all twelve legacy golden projects have an explicit authority disposition", () => {
  assert.equal(goldenCatalog.projects.length, 12);
  assert.deepEqual(
    [...goldenById.keys()].sort(),
    Object.keys(EXPECTED_GEOMETRY_AUTHORITY).sort()
  );

  for (const project of goldenCatalog.projects) {
    const result = evaluateJqProjectAuthority(project);
    assert.equal(result.decision, EXPECTED_GEOMETRY_AUTHORITY[project.id], project.id);
    assert.equal(result.accepted, result.decision === "allow", project.id);
  }
});

test("drawing-authorized cabinet alcove and drawer clear-wall projects pass geometry authority", () => {
  for (const id of ["G02-center-niche-cabinets", "G03-clear-drawers-wide"]) {
    const result = evaluateJqProjectAuthority(goldenById.get(id));
    assert.equal(result.accepted, true, id);
    assert.equal(result.decision, "allow", id);
    assert.ok(result.authorityIds.includes("material:interior-clear-maple-uv"), id);
    assert.equal(result.failures.length, 0, id);
  }
});

test("fireplace geometry is review-only rather than silently accepted", () => {
  const result = evaluateJqProjectAuthority(goldenById.get("G05-fireplace"));
  assert.equal(result.accepted, false);
  assert.equal(result.decision, "review");
  assert.equal(result.code, "JQ_PROJECT_AUTHORITY_REVIEW_REQUIRED");
  assert.ok(result.failures.some(({ id }) => id === "layout:fireplace-wall"));
  assert.ok(result.failures.some(({ id }) => id === "combination:cabinet-shelves+fireplace-wall"));
});

test("a known product and known layout still reject when their exact combination is missing", () => {
  const result = evaluateJqProjectAuthority(goldenById.get("G12-round-trip"));
  assert.equal(result.accepted, false);
  assert.equal(result.decision, "reject");
  assert.ok(result.results.some(({ id, accepted }) => id === "product:drawer-shelves" && accepted));
  assert.ok(result.results.some(({ id, accepted }) => id === "layout:niche-layout" && accepted));
  assert.ok(result.failures.some(({ id, code }) => (
    id === "combination:drawer-shelves+niche-layout"
    && code === "AUTHORITY_RECORD_MISSING"
  )));
});

test("missing product or layout identifiers reject by default", () => {
  const result = evaluateJqProjectAuthority({});
  assert.equal(result.accepted, false);
  assert.equal(result.decision, "reject");
  assert.ok(result.authorityIds.includes("product:<missing>"));
  assert.ok(result.authorityIds.includes("layout:<missing>"));
  assert.ok(result.authorityIds.includes("combination:<missing>"));
});

test("final authority blocks unapproved finish and pricing even when geometry is approved", () => {
  const project = goldenById.get("G02-center-niche-cabinets");
  const geometry = evaluateJqProjectAuthority(project, {
    stage: JQ_PROJECT_AUTHORITY_STAGES.geometry
  });
  const final = evaluateJqProjectAuthority(project, {
    stage: JQ_PROJECT_AUTHORITY_STAGES.final
  });

  assert.equal(geometry.accepted, true);
  assert.equal(final.accepted, false);
  assert.equal(final.decision, "reject");
  assert.ok(final.authorityIds.includes("finish:warm-white"));
  assert.ok(final.authorityIds.includes("pricing:jq-schedule-v1"));
  assert.ok(final.failures.some(({ id }) => id === "finish:warm-white"));
  assert.ok(final.failures.some(({ id }) => id === "pricing:jq-schedule-v1"));
});

test("final authority rejects a project with no finish rather than treating omission as approval", () => {
  const project = structuredClone(goldenById.get("G02-center-niche-cabinets"));
  delete project.finish;
  const final = evaluateJqProjectAuthority(project, { stage: "final" });
  assert.equal(final.accepted, false);
  assert.ok(final.authorityIds.includes("finish:<missing>"));
  assert.ok(final.failures.some(({ id }) => id === "finish:<missing>"));
});

test("authority ID resolution is deterministic and duplicate-free", () => {
  const project = {
    productId: " cabinet-shelves ",
    layoutId: " NICHE-LAYOUT ",
    finish: "Warm-White",
    hardware: "Brass-Pull",
    lighting: "Warm-Led",
    topTreatment: "Small-Crown"
  };
  const first = resolveJqProjectAuthorityIds(project, { stage: "final" });
  const repeated = resolveJqProjectAuthorityIds(structuredClone(project), { stage: "final" });
  assert.deepEqual(repeated, first);
  assert.equal(new Set(first).size, first.length);
  assert.deepEqual(first, [
    "product:cabinet-shelves",
    "layout:niche-layout",
    "combination:cabinet-shelves+niche-layout",
    "material:interior-clear-maple-uv",
    "finish:warm-white",
    "hardware:brass-pull",
    "lighting:warm-led",
    "crown:small-crown",
    "pricing:jq-schedule-v1"
  ]);
});
