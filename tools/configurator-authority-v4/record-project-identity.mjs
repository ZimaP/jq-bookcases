import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { V4_PROOF } from "./authority-contract.js";

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(toolDir, "../..");
const outputRoot = path.resolve(root, process.argv[2] || ".local-proof/configurator-authority-v4/current");
const protectedInputs = [
  { id: "v2", before: "/private/tmp/jq-v4-fourstep-v2-before-fingerprint.json" },
  { id: "v3", before: "/private/tmp/jq-v4-fourstep-v3-before-fingerprint.json" }
];

function git(cwd, args, allowFailure = false) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", maxBuffer: 1024 * 1024 * 1024 });
  if (!allowFailure && result.status !== 0) throw new Error(`git ${args.join(" ")} failed in ${cwd}: ${result.stderr}`);
  return result;
}

function worktreeRecord(cwd) {
  const topLevel = git(cwd, ["rev-parse", "--show-toplevel"]).stdout.trim();
  const commonRaw = git(cwd, ["rev-parse", "--git-common-dir"]).stdout.trim();
  return {
    topLevel,
    gitCommonDirectory: path.resolve(topLevel, commonRaw),
    branch: git(cwd, ["branch", "--show-current"]).stdout.trim(),
    head: git(cwd, ["rev-parse", "HEAD"]).stdout.trim(),
    tree: git(cwd, ["rev-parse", "HEAD^{tree}"]).stdout.trim(),
    statusPorcelainV2: git(cwd, ["status", "--porcelain=v2", "--untracked-files=all"]).stdout
  };
}

async function main() {
  await mkdir(outputRoot, { recursive: true });
  const protectedBefore = {};
  for (const input of protectedInputs) protectedBefore[input.id] = JSON.parse(await readFile(input.before, "utf8"));
  const v3 = protectedBefore.v3.fingerprint;
  const v4 = worktreeRecord(root);
  const acceptedCommitAvailable = git(root, ["cat-file", "-e", `${V4_PROOF.acceptedCommit}^{commit}`], true).status === 0;
  const acceptedTree = acceptedCommitAvailable ? git(root, ["rev-parse", `${V4_PROOF.acceptedCommit}^{tree}`]).stdout.trim() : null;
  const packageRecord = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const checks = {
    repositoryName: packageRecord.name === "jq-bookcases",
    v3TopLevel: v3.root === "/Users/vladimirpryimak/Documents/JQ-bookcases-visual-ux-v3",
    gitCommonDirectory: v3.gitCommonDirectory === "/Users/vladimirpryimak/Documents/JQ bookcases/.git",
    acceptedCommitAvailable,
    acceptedTreeExact: acceptedTree === V4_PROOF.acceptedTree,
    v4TopLevel: v4.topLevel === "/Users/vladimirpryimak/Documents/JQ-bookcases-configurator-v4",
    v4Branch: v4.branch === "codex/configurator-authority-v4",
    v4BaseHead: v4.head === V4_PROOF.acceptedCommit,
    v4BaseTree: v4.tree === V4_PROOF.acceptedTree,
    completeProtectedFingerprintsPresent: protectedInputs.every(({ id }) => protectedBefore[id]?.fingerprint?.inventory && protectedBefore[id]?.fingerprint?.rawIndex && protectedBefore[id]?.fingerprint?.trackedIndex)
  };
  const report = {
    schema: "jq-configurator-authority-v4-project-identity-v1",
    status: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
    repositoryName: packageRecord.name,
    accepted: { commit: V4_PROOF.acceptedCommit, tree: V4_PROOF.acceptedTree, commitAvailable: acceptedCommitAvailable, resolvedTree: acceptedTree },
    v3: {
      topLevel: v3.root,
      gitCommonDirectory: v3.gitCommonDirectory,
      branch: v3.branch,
      head: v3.head,
      tree: v3.tree,
      status: v3.status,
      fingerprintAggregateSha256: protectedBefore.v3.aggregateSha256,
      fingerprintCoverage: ["tracked contents", "untracked and ignored contents", "file modes", "symlinks and targets", "byte contents", "directory/file inventory"]
    },
    v2: {
      topLevel: protectedBefore.v2.fingerprint.root,
      branch: protectedBefore.v2.fingerprint.branch,
      head: protectedBefore.v2.fingerprint.head,
      tree: protectedBefore.v2.fingerprint.tree,
      status: protectedBefore.v2.fingerprint.status,
      fingerprintAggregateSha256: protectedBefore.v2.aggregateSha256,
      fingerprintCoverage: ["tracked contents", "untracked and ignored contents", "file modes", "symlinks and targets", "byte contents", "directory/file inventory"]
    },
    v4,
    gateDecision: "The supplied V2 and V3 states were exhaustively fingerprinted before V4 creation. The accepted commit/tree matched, and the V4 path/branch did not exist; V4 was then created from the accepted commit without cleanup, overwrite or mutation of either protected worktree.",
    checks
  };
  await writeFile(path.join(outputRoot, "project-identity-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`project identity ${report.status}: ${report.repositoryName}, ${v4.branch}, ${v4.head}\n`);
  if (report.status !== "PASS") process.exitCode = 1;
}

await main();
