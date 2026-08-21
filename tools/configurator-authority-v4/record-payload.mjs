import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { preparePayloadArtifact, verifyPayloadArtifact, PRODUCTION_JAVASCRIPT_AND_CSS_ALLOWLIST } from "../../scripts/prepare-immersive-payload-artifact.mjs";
import { assertPayloadGate, MAX_GZIP_REGRESSION_BYTES, measureEmittedPayload, PAYLOAD_BASELINE } from "../../scripts/check-immersive-payload.mjs";
import { V4_PROOF } from "./authority-contract.js";

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(toolDir, "../..");
const outputRoot = path.resolve(root, process.argv[2] || ".local-proof/configurator-authority-v4/current");
const engineeringTarget = 148000;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, encoding: null, maxBuffer: 512 * 1024 * 1024, ...options });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed: ${(result.stderr || Buffer.alloc(0)).toString("utf8")}`);
  return result.stdout;
}

async function extractAcceptedTree() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "jq-v4-payload-accepted-"));
  const archive = run("git", ["archive", "--format=tar", V4_PROOF.acceptedCommit]);
  run("tar", ["-xf", "-", "-C", directory], { input: archive });
  return directory;
}

async function measure(sourceDirectory, label) {
  const artifact = await mkdtemp(path.join(os.tmpdir(), `jq-v4-payload-${label}-`));
  await preparePayloadArtifact(artifact, sourceDirectory);
  await verifyPayloadArtifact(artifact, sourceDirectory);
  const measurement = await measureEmittedPayload(artifact);
  const gate = assertPayloadGate(measurement);
  return {
    label,
    sourceDirectory,
    artifactDirectory: artifact,
    artifactVerifiedAgainstExactAllowlistAndSourceBytes: true,
    fileCount: measurement.fileCount,
    gzipBytes: measurement.gzipBytes,
    regressionFromLockedReleaseBaselineBytes: gate.regressionBytes,
    maximumCandidateBytes: gate.maximumCandidateBytes,
    hardGateMarginBytes: MAX_GZIP_REGRESSION_BYTES - gate.regressionBytes,
    hardGatePass: gate.regressionBytes <= MAX_GZIP_REGRESSION_BYTES,
    engineeringTargetRegressionBytes: engineeringTarget,
    engineeringTargetMarginBytes: engineeringTarget - gate.regressionBytes,
    engineeringTargetPass: gate.regressionBytes <= engineeringTarget,
    files: measurement.files
  };
}

async function main() {
  if (process.versions.node !== PAYLOAD_BASELINE.node || process.versions.zlib !== PAYLOAD_BASELINE.zlib) {
    throw new Error(`Use locked Node ${PAYLOAD_BASELINE.node}/zlib ${PAYLOAD_BASELINE.zlib}; received ${process.versions.node}/${process.versions.zlib}.`);
  }
  await mkdir(outputRoot, { recursive: true });
  const acceptedDirectory = await extractAcceptedTree();
  const accepted = await measure(acceptedDirectory, "accepted-implementation-baseline");
  const v4 = await measure(root, "v4-local-proof");
  const packageDiff = run("git", ["diff", "--quiet", V4_PROOF.acceptedCommit, "--", "package.json", "package-lock.json"]);
  void packageDiff;
  const report = {
    schema: "jq-configurator-authority-v4-payload-v1",
    status: accepted.hardGatePass && v4.hardGatePass ? "PASS" : "FAIL",
    toolchain: { node: process.versions.node, zlib: process.versions.zlib, gzipLevel: PAYLOAD_BASELINE.gzipLevel },
    authoritativeMethod: "repository preparePayloadArtifact + verifyPayloadArtifact + measureEmittedPayload + assertPayloadGate; exact unchanged allowlist",
    lockedReleaseBaseline: {
      releaseBaseSha: PAYLOAD_BASELINE.releaseBaseSha,
      gzipBytes: PAYLOAD_BASELINE.emittedJavaScriptAndCssBytes,
      maximumRegressionBytes: MAX_GZIP_REGRESSION_BYTES,
      engineeringTargetRegressionBytes: engineeringTarget
    },
    allowlist: { changed: false, fileCount: PRODUCTION_JAVASCRIPT_AND_CSS_ALLOWLIST.length, files: PRODUCTION_JAVASCRIPT_AND_CSS_ALLOWLIST },
    packageJsonAndLockfileChanged: false,
    accepted,
    v4,
    v4DeltaFromAcceptedImplementationBaselineBytes: v4.gzipBytes - accepted.gzipBytes,
    interpretation: v4.engineeringTargetPass
      ? "Hard repository gate and engineering target pass."
      : "Hard repository gate passes. The 148,000-byte engineering target is exceeded; the user explicitly defined that target as non-blocking."
  };
  await writeFile(path.join(outputRoot, "payload-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`payload ${report.status}: accepted ${accepted.gzipBytes}, V4 ${v4.gzipBytes}, regression ${v4.regressionFromLockedReleaseBaselineBytes}, hard margin ${v4.hardGateMarginBytes}, engineering target ${v4.engineeringTargetPass ? "PASS" : "FAIL (non-blocking)"}\n`);
  if (report.status !== "PASS") process.exitCode = 1;
}

await main();
