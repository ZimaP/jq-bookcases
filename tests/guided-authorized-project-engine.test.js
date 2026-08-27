import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { evaluateGuidedProjectCandidate } from "../guided-project-engine.js";
import {
  evaluateAuthorizedGuidedProjectCandidate,
  prepareAuthorizedGuidedProjectPersistence,
  prepareAuthorizedGuidedQuote,
  restoreAuthorizedGuidedAcceptedSnapshot,
  transactAuthorizedGuidedProject
} from "../guided-authorized-project-engine.js";

const goldenCatalog = JSON.parse(readFileSync(
  new URL("../config/golden-projects.json", import.meta.url),
  "utf8"
));
const goldenById = new Map(goldenCatalog.projects.map((project) => [project.id, project]));

test("authorized geometry reaches the existing deterministic engine", () => {
  const result = evaluateAuthorizedGuidedProjectCandidate(
    goldenById.get("G02-center-niche-cabinets")
  );
  assert.equal(result.accepted, true, JSON.stringify(result.errors));
  assert.equal(result.authority.accepted, true);
  assert.equal(result.authority.stage, "geometry");
  assert.ok(result.geometryFingerprint.startsWith("jq-guided-geometry-v1-"));
});

test("unsupported geometry is rejected before customer acceptance", () => {
  const project = goldenById.get("G01-right-niche-tv");
  const engineeringCore = evaluateGuidedProjectCandidate(project);
  const customerPath = evaluateAuthorizedGuidedProjectCandidate(project);

  assert.equal(engineeringCore.accepted, true, "legacy fixture remains usable for engineering regression");
  assert.equal(customerPath.accepted, false);
  assert.equal(customerPath.stage, "authority-geometry");
  assert.equal(customerPath.authority.decision, "reject");
  assert.ok(customerPath.errors.some(({ authorityId }) => authorityId === "layout:right-niche"));
  assert.ok(customerPath.errors.some(({ authorityId }) => authorityId === "combination:tv-unit+right-niche"));
});

test("fireplace remains a named review gate in the customer path", () => {
  const result = evaluateAuthorizedGuidedProjectCandidate(goldenById.get("G05-fireplace"));
  assert.equal(result.accepted, false);
  assert.equal(result.stage, "authority-geometry");
  assert.equal(result.authority.decision, "review");
  assert.ok(result.errors.some(({ code }) => code === "AUTHORITY_REVIEW_REQUIRED"));
});

test("an unauthorized edit preserves the exact previous accepted specification", () => {
  const accepted = evaluateAuthorizedGuidedProjectCandidate(
    goldenById.get("G02-center-niche-cabinets")
  );
  assert.equal(accepted.accepted, true);

  const transaction = transactAuthorizedGuidedProject(
    goldenById.get("G01-right-niche-tv"),
    accepted
  );
  assert.equal(transaction.accepted, false);
  assert.equal(transaction.changed, false);
  assert.equal(transaction.geometryChanged, false);
  assert.equal(transaction.materialChanged, false);
  assert.equal(transaction.specification, accepted);
  assert.equal(transaction.rejectedCandidate.stage, "authority-geometry");
});

test("final persistence is blocked until exact finish and pricing authority exist", () => {
  const project = goldenById.get("G02-center-niche-cabinets");
  const accepted = evaluateAuthorizedGuidedProjectCandidate(project);
  assert.equal(accepted.accepted, true);

  const preparation = prepareAuthorizedGuidedProjectPersistence(project, accepted);
  assert.equal(preparation.accepted, false);
  assert.equal(preparation.persistable, false);
  assert.equal(preparation.code, "GUIDED_FINAL_AUTHORITY_BLOCKED");
  assert.equal(preparation.project, null);
  assert.equal(preparation.snapshot, null);
  assert.equal(preparation.specification, accepted);
  assert.ok(preparation.errors.some(({ authorityId }) => authorityId === "finish:warm-white"));
  assert.ok(preparation.errors.some(({ authorityId }) => authorityId === "pricing:jq-schedule-v1"));
});

test("quote and restore cannot bypass final authority", () => {
  const project = goldenById.get("G02-center-niche-cabinets");
  const quote = prepareAuthorizedGuidedQuote(project, null);
  const restored = restoreAuthorizedGuidedAcceptedSnapshot(project, null);

  assert.equal(quote.accepted, false);
  assert.equal(quote.stage, "authority-quote");
  assert.equal(restored.accepted, false);
  assert.equal(restored.stage, "authority-restore");
  assert.ok(quote.errors.some(({ authorityId }) => authorityId === "pricing:jq-schedule-v1"));
  assert.ok(restored.errors.some(({ authorityId }) => authorityId === "finish:warm-white"));
});
