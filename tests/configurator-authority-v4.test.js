import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AUTHORITY_ITEMS,
  AUTHORITY_STATUSES,
  FIELDS,
  LAYOUTS,
  PENDING_ITEMS,
  STEPS,
  UI_COPY,
  V4_PROOF,
  isV4ProofRoute
} from "../tools/configurator-authority-v4/authority-contract.js";
import {
  createV4Project,
  normalizeV4Project,
  resetV4Field,
  setV4Field,
  setV4Layout,
  serializedCustomerKeys,
  validateV4Customization
} from "../tools/configurator-authority-v4/state.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (relativePath) => JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const run = (args) => spawnSync(process.execPath, args, { cwd: root, encoding: "utf8" });

test("V4 correction remains pinned to the accepted four-step baseline", () => {
  assert.equal(V4_PROOF.acceptedCommit, "109e5cf6c420725ec872530d4809675f4a09c7e6");
  assert.equal(V4_PROOF.acceptedTree, "d46d3cb00357fa24c5b5346392b0f65d390534ae");
  const identity = spawnSync("git", ["rev-parse", "HEAD", "HEAD^{tree}"], { cwd: root, encoding: "utf8" });
  assert.equal(identity.status, 0, identity.stderr);
  assert.deepEqual(identity.stdout.trim().split(/\s+/), [V4_PROOF.acceptedCommit, V4_PROOF.acceptedTree]);
  const baseline = spawnSync("git", ["show", `${V4_PROOF.acceptedCommit}:guided-configurator.js`], { cwd: root, encoding: "utf8" });
  assert.equal(baseline.status, 0, baseline.stderr);
  assert.match(baseline.stdout, /Choose Product[\s\S]*Choose Layout[\s\S]*Customization[\s\S]*Review & Details/);
});

test("authority schema, coverage and correction generator are current", async () => {
  const validation = run(["tools/configurator-authority-v4/validate-contracts.mjs"]);
  assert.equal(validation.status, 0, validation.stderr);
  assert.match(validation.stdout, /schema PASS/);
  const generated = run(["tools/configurator-authority-v4/generate-contracts.mjs", "--check"]);
  assert.equal(generated.status, 0, generated.stderr);
  const authority = await readJson("config/configurator-authority-v4-four-step.json");
  const coverage = await readJson("config/configurator-authority-v4-four-step-coverage.json");
  const feasibility = await readJson("config/configurator-authority-v4-four-step-control-feasibility.json");
  const schema = await readJson("config/configurator-authority-v4-four-step.schema.json");
  assert.equal(authority.schema, "jq-configurator-authority-v4-four-step");
  assert.deepEqual(authority.steps.map(({ label }) => label), ["Choose Product", "Choose Layout", "Customization", "Review & Details"]);
  assert.equal(schema.properties.steps.minItems, 4);
  assert.equal(schema.properties.steps.maxItems, 4);
  assert.equal(coverage.assertions.everyVisibleElementHasAuthority, true);
  assert.equal(coverage.assertions.everyAuthorityItemDisposed, true);
  assert.equal(coverage.assertions.noCustomerShelfSpacingField, true);
  assert.equal(coverage.assertions.noInteractivePendingAuthority, true);
  assert.equal(feasibility.layoutGeometryInventory.length, 3);
  assert.equal(feasibility.layoutGeometryInventory.reduce((sum, layout) => sum + layout.completePrimitiveMaterialInventory.length, 0), 494);
});

test("only the accepted four steps and the V4-owned Customization fields remain", () => {
  assert.deepEqual(STEPS.map(({ label }) => label), ["Choose Product", "Choose Layout", "Customization", "Review & Details"]);
  assert.deepEqual(STEPS.map(({ number }) => number), [1, 2, 3, 4]);
  assert.deepEqual(LAYOUTS.map(({ id }) => id), ["fireplace-wall", "door-wall", "window-wall"]);
  assert.equal(FIELDS.length, 6);
  assert.ok(FIELDS.every(({ stepId }) => stepId === "customization"));
  assert.deepEqual(FIELDS.filter(({ type }) => type === "radio").flatMap(({ values }) => values.map(({ value }) => value)), ["flush", "recessed"]);
  assert.equal(FIELDS.some(({ id, label }) => /shelf.*(space|spacing|clearance)/i.test(`${id} ${label}`)), false);
  assert.equal(AUTHORITY_ITEMS.some((entry) => entry.customerVisibility.interactive && ["pending-authority", "blocked-by-asset"].includes(entry.authorityStatus)), false);
  assert.equal(PENDING_ITEMS.length, 8);
  assert.deepEqual([...new Set(AUTHORITY_ITEMS.map(({ authorityStatus }) => authorityStatus))].sort(), [...AUTHORITY_STATUSES].sort());
  assert.equal(UI_COPY.some(({ label }) => /Step . of 5|^Room$|^Style$|^Configure$/i.test(label)), false);
});

test("Customization state is layout-scoped, validates authority increments and drops retired V4 controls", () => {
  let project = createV4Project();
  project = setV4Field(project, "lowerCabinetHeight", 36).project;
  project = setV4Field(project, "baseType", "recessed").project;
  project = setV4Layout(project, "door-wall");
  assert.equal(project.layoutStates["door-wall"].values.lowerCabinetHeight, 34.5);
  project = setV4Field(project, "lowerCabinetHeight", 24.25).project;
  project = setV4Layout(project, "fireplace-wall");
  assert.equal(project.layoutStates["fireplace-wall"].values.lowerCabinetHeight, 36);
  assert.equal(project.layoutStates["fireplace-wall"].values.baseType, "recessed");
  assert.match(setV4Field(project, "lowerCabinetHeight", 36.125).error, /increments/);
  project = resetV4Field(project, "lowerCabinetHeight").project;
  assert.equal(project.layoutStates["fireplace-wall"].values.lowerCabinetHeight, 34.5);
  const stale = structuredClone(project);
  stale.finish = "invented-finish";
  stale.layoutStates["fireplace-wall"].smartDimensions = { legacy: 12 };
  stale.layoutStates["fireplace-wall"].values.shelfSpacing = 12;
  stale.layoutStates["fireplace-wall"].values.roomWidth = 120;
  const migrated = normalizeV4Project(stale);
  assert.equal(Object.hasOwn(migrated, "finish"), false);
  assert.equal(Object.hasOwn(migrated.layoutStates["fireplace-wall"], "smartDimensions"), false);
  assert.equal(Object.hasOwn(migrated.layoutStates["fireplace-wall"].values, "shelfSpacing"), false);
  assert.equal(Object.hasOwn(migrated.layoutStates["fireplace-wall"].values, "roomWidth"), false);
  assert.deepEqual(serializedCustomerKeys(migrated).layoutState, ["values"]);
  assert.deepEqual(validateV4Customization(migrated), []);
});

test("every V4 numeric field supports min/default/max and reset without a model transform", () => {
  for (const layout of LAYOUTS) {
    let project = setV4Layout(createV4Project(), layout.id);
    for (const field of FIELDS.filter((entry) => entry.layouts.includes(layout.id) && entry.type === "number")) {
      for (const value of [field.min, field.defaultValue, field.max]) {
        const result = setV4Field(project, field.id, value);
        assert.equal(result.error, null, `${layout.id}/${field.id}/${value}`);
        project = result.project;
        assert.equal(project.layoutStates[layout.id].values[field.id], value);
      }
      assert.match(setV4Field(project, field.id, field.max + field.step).error, /Enter/);
      project = resetV4Field(project, field.id).project;
      assert.equal(project.layoutStates[layout.id].values[field.id], field.defaultValue);
    }
  }
});

test("proof gate is exact, loopback-only and no-flag code remains baseline-first", async () => {
  assert.equal(isV4ProofRoute(new URL("http://127.0.0.1/configurator.html?authorityProof=configurator-v4")), true);
  assert.equal(isV4ProofRoute(new URL("http://localhost/configurator.html?authorityProof=configurator-v4")), true);
  assert.equal(isV4ProofRoute(new URL("http://[::1]/configurator.html?authorityProof=configurator-v4")), true);
  assert.equal(isV4ProofRoute(new URL("https://jqbookcases.com/configurator.html?authorityProof=configurator-v4")), false);
  assert.equal(isV4ProofRoute(new URL("http://127.0.0.1/configurator.html")), false);
  const html = await readFile(path.join(root, "configurator.html"), "utf8");
  assert.match(html, /await import\("\.\/guided-configurator\.js\?v=immersive-layout-configurator-v1"\);[\s\S]*await import\("\.\/tools\/configurator-authority-v4\/app\.js/);
  assert.match(html, /location\.hash === "#step-5"[\s\S]*history\.replaceState[\s\S]*#step-4/);
  assert.match(html, /else \{[\s\S]*await import\("\.\/guided-configurator\.js\?v=immersive-layout-configurator-v1"\);[\s\S]*\}/);
});

test("all three GLBs and retained visual contracts stay byte-identical source assets", async () => {
  const provenance = await readJson("config/configurator-authority-v4-four-step-provenance.json");
  for (const layout of LAYOUTS) {
    const source = await readFile(path.join(root, layout.asset));
    assert.equal(source.length, layout.bytes);
    assert.equal(sha256(source), layout.sha256);
    assert.equal(source.subarray(0, 4).toString("ascii"), "glTF");
    assert.equal(provenance.sourceAssets.find(({ path: asset }) => asset === layout.asset).sha256, layout.sha256);
  }
  const roles = await readJson("config/configurator-authority-v4-visual-roles.json");
  const presentation = await readJson("config/configurator-authority-v4-presentation.json");
  const modifiedEdges = await readJson("config/configurator-authority-v4-modified-edges.json");
  assert.equal(roles.layouts.reduce((sum, layout) => sum + layout.records.length, 0), 494);
  assert.equal(presentation.proofOnly, true);
  assert.equal(presentation.modifiedGeometry, false);
  assert.equal(modifiedEdges.edgeTreatmentApplied, false);
});
