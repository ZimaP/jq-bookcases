import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AUTHORITY_ITEMS, V4_PROOF } from "./authority-contract.js";

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(toolDir, "../..");
const outputRoot = path.resolve(root, process.argv[2] || ".local-proof/configurator-authority-v4/four-step-correction-current");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function evidence(relative) {
  const absolute = path.join(outputRoot, relative);
  const bytes = await readFile(absolute);
  return { path: relative, bytes: bytes.length, sha256: sha256(bytes), json: JSON.parse(bytes) };
}

function gate(id, status, command, artifacts, note, hard = true) {
  return { id, hard, status, command, artifacts: artifacts.map(({ path: artifactPath, bytes, sha256: hash }) => ({ path: artifactPath, bytes, sha256: hash })), note };
}

async function main() {
  const files = Object.fromEntries(await Promise.all([
    "project-identity-report.json",
    "source-identity-report.json",
    "payload-report.json",
    "capture-manifest.json",
    "framebuffer-equality-report.json",
    "contact-sheet-manifest.json",
    "verification-report.json",
    "changed-files-report.json",
    "protected-worktree-fingerprint-report.json",
    "v4-protected-hash-equality.json"
  ].map(async (relative) => [relative, await evidence(relative)])));
  const authorityBytes = await readFile(path.join(root, "config/configurator-authority-v4-four-step.json"));
  const coverageBytes = await readFile(path.join(root, "config/configurator-authority-v4-four-step-coverage.json"));
  const feasibilityBytes = await readFile(path.join(root, "config/configurator-authority-v4-four-step-control-feasibility.json"));
  const interactionBytes = await readFile(path.join(root, "config/configurator-authority-v4-four-step-interaction.json"));
  const authority = { path: "config/configurator-authority-v4-four-step.json", bytes: authorityBytes.length, sha256: sha256(authorityBytes), json: JSON.parse(authorityBytes) };
  const coverage = { path: "config/configurator-authority-v4-four-step-coverage.json", bytes: coverageBytes.length, sha256: sha256(coverageBytes), json: JSON.parse(coverageBytes) };
  const feasibility = { path: "config/configurator-authority-v4-four-step-control-feasibility.json", bytes: feasibilityBytes.length, sha256: sha256(feasibilityBytes), json: JSON.parse(feasibilityBytes) };
  const interaction = { path: "config/configurator-authority-v4-four-step-interaction.json", bytes: interactionBytes.length, sha256: sha256(interactionBytes), json: JSON.parse(interactionBytes) };
  const fourStep = authority.json.steps.map(({ label }) => label).join("|") === "Choose Product|Choose Layout|Customization|Review & Details";
  const coveragePass = Object.values(coverage.json.assertions || {}).every(Boolean);
  const interactionPass = interaction.json.architecture?.exactStepOrder?.join("|") === "Choose Product|Choose Layout|Customization|Review & Details"
    && interaction.json.architecture?.v4OwnedSteps?.join("|") === "3"
    && interaction.json.intentionallyAbsent?.includes("customer shelf spacing");
  const feasibilityPass = feasibility.json.controls?.every(({ authorityId, safeTransformOrDerivation }) => authorityId === "JQ-STYLE-LAYOUT-001" || safeTransformOrDerivation === "none");
  const gates = [
    gate("identity", files["project-identity-report.json"].json.status, "node tools/configurator-authority-v4/record-project-identity.mjs <candidate>", [files["project-identity-report.json"]], "Accepted commit/tree and isolated V4 worktree identity."),
    gate("four-step-authority-contract", fourStep && coveragePass ? "PASS" : "FAIL", "node tools/configurator-authority-v4/validate-contracts.mjs && node tools/configurator-authority-v4/generate-contracts.mjs --check", [authority, coverage], "Exact accepted four-step journey; all V4 controls stay in Step 3."),
    gate("control-feasibility", feasibilityPass ? "PASS" : "FAIL", "node tools/configurator-authority-v4/validate-contracts.mjs", [feasibility], "No unsupported live geometry control was introduced."),
    gate("routing-and-baseline-equivalence", files["capture-manifest.json"].json.status, "node tools/configurator-authority-v4/capture-evidence.mjs <candidate>", [files["capture-manifest.json"], files["contact-sheet-manifest.json"]], "Steps 1, 2, and 4 match accepted baseline UI; #step-5 normalizes once to #step-4."),
    gate("unified-step3-and-shelf-removal", interactionPass ? "PASS" : "FAIL", "npx playwright test e2e/configurator-authority-v4.spec.js --project=chromium", [interaction, files["verification-report.json"]], "One V4 Customization component for Fireplace, Door, and Window; no customer shelf state or control."),
    gate("framebuffer-equality", files["framebuffer-equality-report.json"].json.status, "node tools/configurator-authority-v4/capture-evidence.mjs <candidate>", [files["framebuffer-equality-report.json"]], "Same-process fixed-camera model canvases are equal before/after Step 3 remount."),
    gate("protected-files", files["v4-protected-hash-equality.json"].json.exactRecordEquality && files["v4-protected-hash-equality.json"].json.aggregateEquality ? "PASS" : "FAIL", "node tools/configurator-authority-v4/record-protected-fingerprints.mjs <candidate>", [files["v4-protected-hash-equality.json"]], "GLBs, visual/renderer assets, package files, and prior V4 visual evidence retain exact protected hashes."),
    gate("v2-v3-immutability", files["protected-worktree-fingerprint-report.json"].json.status, "node tools/configurator-authority-v4/record-protected-fingerprints.mjs <candidate>", [files["protected-worktree-fingerprint-report.json"]], "V2 and rejected V3 complete fingerprints remain byte-identical."),
    gate("source-geometry", files["source-identity-report.json"].json.status, "node tools/configurator-authority-v4/verify-source-identity.mjs <candidate>", [files["source-identity-report.json"]], "All three source GLBs exactly equal accepted blobs; no geometry or edge derivation."),
    gate("focused-and-full-validation", files["verification-report.json"].json.status, "node tools/configurator-authority-v4/verify-v4.mjs <candidate>", [files["verification-report.json"], files["changed-files-report.json"]], "Focused unit/Chromium, full suite, production build, accessibility, error and network checks."),
    gate("payload-hard", files["payload-report.json"].json.v4?.hardGatePass ? "PASS" : "FAIL", "locked Node 22.23.2 record-payload.mjs <candidate>", [files["payload-report.json"]], "Unchanged repository packaging policy and hard <=150,000 gzip-byte regression gate."),
    gate("payload-engineering-target", files["payload-report.json"].json.v4?.engineeringTargetPass ? "PASS" : "MISS_NON_BLOCKING", "same authoritative payload command", [files["payload-report.json"]], "The 148,000-byte engineering target is non-blocking by owner instruction.", false),
    gate("owner-acceptance", "PENDING", "owner review", [], "This is a local V4 proof; owner approval is not claimed.", false),
    gate("release-readiness", "NOT_CLAIMED", "not authorized", [], "No commit, push, merge, deployment, or publication was performed.", false)
  ];
  const hardPass = gates.filter(({ hard }) => hard).every(({ status }) => status === "PASS");
  const report = {
    schema: "jq-configurator-authority-v4-four-step-acceptance-gates-v1",
    automatedVerification: hardPass ? "PASS" : "FAIL",
    finalStatus: hardPass ? "FOUR-STEP V4 CORRECTION READY FOR OWNER REVIEW" : "FOUR-STEP V4 CORRECTION NOT READY FOR OWNER REVIEW",
    ownerAcceptance: "PENDING",
    releaseReadiness: "NOT CLAIMED",
    accepted: { commit: V4_PROOF.acceptedCommit, tree: V4_PROOF.acceptedTree },
    gates,
    pendingOrBlockedAuthority: AUTHORITY_ITEMS.filter(({ authorityStatus }) => ["pending-authority", "blocked-by-asset"].includes(authorityStatus)).map(({ id, label, authorityStatus, blocker, pendingDecision }) => ({ id, label, authorityStatus, blocker: blocker || pendingDecision })),
    actionsIntentionallyNotTaken: ["commit", "push", "merge", "deploy", "publish", "production-default changes", "GLB or geometry mutation", "renderer/material/lighting/camera mutation", "V2 mutation", "V3 mutation", "package-policy change", "pricing invention"]
  };
  await writeFile(path.join(outputRoot, "acceptance-gate-manifest.json"), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${report.finalStatus}: ${gates.filter(({ hard, status }) => hard && status === "PASS").length}/${gates.filter(({ hard }) => hard).length} hard gates passed\n`);
  if (!hardPass) process.exitCode = 1;
}

await main();
