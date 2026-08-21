import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { V4_PROOF } from "./authority-contract.js";

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(toolDir, "../..");
const outputRoot = path.resolve(root, process.argv[2] || ".local-proof/configurator-authority-v4/four-step-correction-current");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const stripAnsi = (text) => String(text || "").replace(/\u001b\[[0-9;]*m/g, "");

function runRaw(command, args, options = {}) {
  const { env = {}, ...spawnOptions } = options;
  return spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 1024,
    ...spawnOptions,
    env: { ...process.env, ...env, FORCE_COLOR: "0", NO_COLOR: "1" }
  });
}

function commandRecord(id, command, args, options = {}) {
  const started = performance.now();
  const result = runRaw(command, args, options);
  const record = {
    id,
    command: [command, ...args].join(" "),
    exitCode: result.status,
    signal: result.signal,
    durationMilliseconds: Number((performance.now() - started).toFixed(1)),
    passed: result.status === 0,
    stdout: stripAnsi(result.stdout),
    stderr: stripAnsi(result.stderr)
  };
  process.stdout.write(`${record.passed ? "PASS" : "FAIL"} ${id} (${record.durationMilliseconds} ms)\n`);
  return record;
}

function gitText(args) {
  const result = runRaw("git", args);
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  return result.stdout.trim();
}

async function pathRecord(relative, status) {
  const absolute = path.join(root, relative);
  const metadata = await lstat(absolute);
  const type = metadata.isSymbolicLink() ? "symlink" : metadata.isDirectory() ? "directory" : metadata.isFile() ? "regular" : "other";
  const record = { path: relative, status, type, mode: (metadata.mode & 0o7777).toString(8).padStart(4, "0"), bytes: metadata.size };
  if (metadata.isFile()) record.sha256 = sha256(await readFile(absolute));
  if (metadata.isSymbolicLink()) record.linkTarget = await readlink(absolute);
  return record;
}

async function changedFilesReport() {
  const statusResult = runRaw("git", ["status", "--short", "--untracked-files=all"]);
  if (statusResult.status !== 0) throw new Error(`git status failed: ${statusResult.stderr}`);
  const statusLines = statusResult.stdout.replace(/\r?\n$/, "").split(/\r?\n/).filter(Boolean);
  const records = [];
  for (const line of statusLines) {
    const status = line.slice(0, 2);
    const relative = line.slice(3).replace(/^"|"$/g, "");
    records.push(await pathRecord(relative, status));
  }
  return {
    schema: "jq-configurator-authority-v4-changed-files-v1",
    branch: gitText(["branch", "--show-current"]),
    head: gitText(["rev-parse", "HEAD"]),
    tree: gitText(["rev-parse", "HEAD^{tree}"]),
    commitCreated: false,
    records,
    packageJsonChanged: records.some(({ path: relative }) => relative === "package.json"),
    lockfileChanged: records.some(({ path: relative }) => relative === "package-lock.json"),
    actionsIntentionallyNotTaken: ["commit", "push", "merge", "deploy", "publish", "email/contact John", "backend/account work", "production-default visual change", "V2 mutation", "V3 mutation", "GLB geometry surgery", "package-policy change", "pricing"]
  };
}

function recordKey(record) {
  return record.path;
}

function sameRecord(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function fourStepChangedFilesReport() {
  const beforePath = "/private/tmp/jq-v4-fourstep-v4-before-fingerprint.json";
  const afterPath = `/private/tmp/jq-v4-fourstep-v4-after-${process.pid}.json`;
  const fingerprintTool = "/private/tmp/jq-v4-fingerprint.mjs";
  const before = JSON.parse(await readFile(beforePath, "utf8"));
  const fingerprintRun = runRaw(process.execPath, [fingerprintTool, root, afterPath]);
  if (fingerprintRun.status !== 0) throw new Error(`Current V4 fingerprint failed: ${fingerprintRun.stderr}`);
  const after = JSON.parse(await readFile(afterPath, "utf8"));
  const beforeByPath = new Map(before.fingerprint.inventory.map((record) => [recordKey(record), record]));
  const afterByPath = new Map(after.fingerprint.inventory.map((record) => [recordKey(record), record]));
  const paths = new Set([...beforeByPath.keys(), ...afterByPath.keys()]);
  const changes = [...paths].sort().flatMap((relative) => {
    const prior = beforeByPath.get(relative);
    const current = afterByPath.get(relative);
    if (!prior) return [{ path: relative, kind: "added", after: current }];
    if (!current) return [{ path: relative, kind: "removed", before: prior }];
    return sameRecord(prior, current) ? [] : [{ path: relative, kind: "changed", before: prior, after: current }];
  });
  const allowlist = JSON.parse(await readFile(path.join(root, "config/configurator-authority-v4-four-step-change-allowlist.json"), "utf8"));
  const candidateRoot = ".local-proof/configurator-authority-v4";
  const isAllowed = (relative) => allowlist.allowedPaths.includes(relative)
    || allowlist.allowedPaths.some((allowed) => allowed.startsWith(`${relative}/`))
    || relative === candidateRoot
    || relative.startsWith(`${candidateRoot}/candidate-four-step-`);
  const isTransient = (relative) => (allowlist.transientTestArtifacts || []).some((allowed) => allowed === relative || (allowed.endsWith("/**") && relative.startsWith(allowed.slice(0, -3))));
  const unexpected = changes.filter(({ path: relative }) => !isAllowed(relative) && !isTransient(relative));
  return {
    schema: "jq-configurator-authority-v4-four-step-changed-files-v1",
    status: unexpected.length === 0 ? "PASS" : "FAIL",
    beforeFingerprint: { path: beforePath, aggregateSha256: before.aggregateSha256 },
    afterFingerprint: { path: afterPath, aggregateSha256: after.aggregateSha256 },
    allowlist: "config/configurator-authority-v4-four-step-change-allowlist.json",
    changes: changes.map((change) => ({ ...change, classification: isAllowed(change.path) ? "allowed-correction" : isTransient(change.path) ? "transient-test-artifact" : "unexpected" })),
    unexpected
  };
}

function staleJourneyClaimRecord() {
  const files = [
    "tools/configurator-authority-v4/app.js",
    "tools/configurator-authority-v4/authority-contract.js",
    "tools/configurator-authority-v4/capture-evidence.mjs",
    "tools/configurator-authority-v4/compose-evidence.mjs",
    "tools/configurator-authority-v4/finalize-handoff.mjs",
    "tools/configurator-authority-v4/prepare-blind-packets.mjs",
    "tools/configurator-authority-v4/verify-v4.mjs",
    "tests/configurator-authority-v4.test.js",
    "e2e/configurator-authority-v4.spec.js",
    "config/configurator-authority-v4-four-step.json",
    "config/configurator-authority-v4-four-step-coverage.json",
    "config/configurator-authority-v4-four-step-interaction.json"
  ];
  const expression = "five-step navigation|shared five-step|one five-step|Step . of 5|step <= 5";
  const result = runRaw("rg", ["-n", "-i", expression, ...files]);
  if (![0, 1].includes(result.status)) throw new Error(`Stale-claim scan failed: ${result.stderr}`);
  const rawMatches = result.status === 0 ? stripAnsi(result.stdout).trim().split(/\r?\n/).filter(Boolean) : [];
  const knownGuardMatches = rawMatches.filter((line) => line.includes("const expression =") || line.includes("UI_COPY.some"));
  const matches = rawMatches.filter((line) => !knownGuardMatches.includes(line));
  return { expression, files, matches, knownGuardMatches, passed: matches.length === 0 };
}

async function main() {
  await mkdir(outputRoot, { recursive: true });
  const syntaxFiles = [
    "tools/configurator-authority-v4/app.js",
    "tools/configurator-authority-v4/authority-contract.js",
    "tools/configurator-authority-v4/state.js",
    "tools/configurator-authority-v4/viewer-v4.js",
    "tools/configurator-authority-v4/visual-contract.js",
    "tools/configurator-authority-v4/generate-contracts.mjs",
    "tools/configurator-authority-v4/validate-contracts.mjs",
    "tools/configurator-authority-v4/capture-evidence.mjs",
    "tools/configurator-authority-v4/analyze-evidence.mjs",
    "tools/configurator-authority-v4/measure-performance.mjs",
    "tools/configurator-authority-v4/compose-evidence.mjs",
    "tools/configurator-authority-v4/prepare-blind-packets.mjs",
    "tools/configurator-authority-v4/verify-source-identity.mjs",
    "tools/configurator-authority-v4/record-payload.mjs",
    "tools/configurator-authority-v4/record-protected-fingerprints.mjs",
    "tools/configurator-authority-v4/record-project-identity.mjs",
    "tools/configurator-authority-v4/finalize-handoff.mjs",
    "tools/configurator-authority-v4/verify-v4.mjs",
    "tests/configurator-authority-v4.test.js",
    "e2e/configurator-authority-v4.spec.js"
  ];
  const commands = [
    commandRecord("identity", "git", ["rev-parse", "HEAD", "HEAD^{tree}"]),
    commandRecord("git-diff-check-before", "git", ["diff", "--check"]),
    commandRecord("package-policy-unchanged", "git", ["diff", "--quiet", V4_PROOF.acceptedCommit, "--", "package.json", "package-lock.json"]),
    commandRecord("schema-validation", process.execPath, ["tools/configurator-authority-v4/validate-contracts.mjs"]),
    commandRecord("generated-contract-freshness", process.execPath, ["tools/configurator-authority-v4/generate-contracts.mjs", "--check"]),
    ...syntaxFiles.map((file) => commandRecord(`syntax:${file}`, process.execPath, ["--check", file])),
    commandRecord("focused-unit", process.execPath, ["--test", "tests/configurator-authority-v4.test.js"]),
    commandRecord("focused-chromium", "npx", ["playwright", "test", "e2e/configurator-authority-v4.spec.js", "--project=chromium", "--reporter=line"], { env: { PLAYWRIGHT_PORT: "4233" } }),
    commandRecord("full-node-test-suite", "npm", ["test"]),
    commandRecord("production-build", "npm", ["run", "build"]),
    commandRecord("full-browser-test-suite", "npm", ["run", "test:browser", "--", "--reporter=line"], { env: { PLAYWRIGHT_PORT: "4234" } }),
    commandRecord("git-diff-check-after", "git", ["diff", "--check"])
  ];
  const identity = commands.find(({ id }) => id === "identity")?.stdout.trim().split(/\s+/) || [];
  const identityPass = identity[0] === V4_PROOF.acceptedCommit && identity[1] === V4_PROOF.acceptedTree;
  const fourStepChanges = await fourStepChangedFilesReport();
  const staleJourneyClaims = staleJourneyClaimRecord();
  const report = {
    schema: "jq-configurator-authority-v4-verification-v1",
    status: commands.every(({ passed }) => passed) && identityPass && fourStepChanges.status === "PASS" && staleJourneyClaims.passed ? "PASS" : "FAIL",
    accepted: { commit: V4_PROOF.acceptedCommit, tree: V4_PROOF.acceptedTree },
    identityPass,
    commands,
    fourStepChanges,
    staleJourneyClaims
  };
  const changes = await changedFilesReport();
  await writeFile(path.join(outputRoot, "verification-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(path.join(outputRoot, "changed-files-report.json"), `${JSON.stringify(changes, null, 2)}\n`);
  await writeFile(path.join(outputRoot, "four-step-changed-files-report.json"), `${JSON.stringify(fourStepChanges, null, 2)}\n`);
  process.stdout.write(`verification ${report.status}: ${commands.filter(({ passed }) => passed).length}/${commands.length} commands passed\n`);
  if (report.status !== "PASS") process.exitCode = 1;
}

await main();
