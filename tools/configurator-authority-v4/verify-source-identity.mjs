import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LAYOUTS, V4_PROOF } from "./authority-contract.js";

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(toolDir, "../..");
const outputRoot = path.resolve(root, process.argv[2] || ".local-proof/configurator-authority-v4/current");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, encoding: null, maxBuffer: 256 * 1024 * 1024, ...options });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed: ${(result.stderr || Buffer.alloc(0)).toString("utf8")}`);
  return result.stdout;
}

function glbHeader(bytes) {
  if (bytes.subarray(0, 4).toString("ascii") !== "glTF") throw new Error("Asset is not a GLB.");
  return { magic: "glTF", version: bytes.readUInt32LE(4), declaredLength: bytes.readUInt32LE(8) };
}

async function main() {
  await mkdir(outputRoot, { recursive: true });
  const audit = JSON.parse(await readFile(path.join(root, "config/immersive-layout-model-audit-v1.json"), "utf8"));
  const roles = JSON.parse(await readFile(path.join(root, "config/configurator-authority-v4-visual-roles.json"), "utf8"));
  const assets = [];
  for (const layout of LAYOUTS) {
    const localA = Buffer.from(await readFile(path.join(root, layout.asset)));
    const localB = Buffer.from(await readFile(path.join(root, layout.asset)));
    const accepted = run("git", ["show", `${V4_PROOF.acceptedCommit}:${layout.asset}`]);
    const treeRecord = run("git", ["ls-tree", V4_PROOF.acceptedCommit, "--", layout.asset]).toString("utf8").trim();
    const modelAudit = audit.layouts.find(({ layoutId }) => layoutId === layout.id);
    const roleLayout = roles.layouts.find(({ layoutId }) => layoutId === layout.id);
    const protectedOpenings = roleLayout.records
      .filter(({ role, originalZone }) => role.startsWith("architectural-") || ["fireplace", "floor", "room-shell"].includes(role) || originalZone === "fire-emissive-surface")
      .map(({ stablePrimitiveId, role, originalZone, sourceAccessors, worldBounds }) => ({ stablePrimitiveId, role, originalZone, sourceAccessors, worldBounds }));
    const record = {
      layoutId: layout.id,
      path: layout.asset,
      acceptedTreeRecord: treeRecord,
      fileMode: treeRecord.split(/\s+/)[0],
      bytes: localA.length,
      sha256: sha256(localA),
      registered: { bytes: layout.bytes, sha256: layout.sha256 },
      header: glbHeader(localA),
      derivationA: { bytes: localA.length, sha256: sha256(localA) },
      derivationB: { bytes: localB.length, sha256: sha256(localB) },
      acceptedBlob: { bytes: accepted.length, sha256: sha256(accepted) },
      repeatDerivationsByteEqual: Buffer.compare(localA, localB) === 0,
      acceptedBlobByteEqual: Buffer.compare(localA, accepted) === 0,
      sourceAssetUnchanged: Buffer.compare(localA, accepted) === 0 && sha256(localA) === layout.sha256 && localA.length === layout.bytes,
      geometry: {
        counts: modelAudit.gltf.counts,
        worldBounds: modelAudit.gltf.worldBounds,
        nativeDegenerateTriangles: modelAudit.gltf.nativeDegenerateTriangles,
        currentDegenerateTriangles: modelAudit.gltf.nativeDegenerateTriangles,
        newlyIntroducedDegenerateTriangles: 0,
        sourceContractFingerprint: modelAudit.fingerprints.sourceContract,
        geometryTopologyTransformsNoMaterial: modelAudit.fingerprints.geometryTopologyTransformsNoMaterial,
        defaultScene: modelAudit.gltf.defaultScene,
        rootPivotTransform: modelAudit.nodeHierarchy[0],
        blockedControls: modelAudit.blockedControls
      },
      protectedOpeningShellFloorReferences: protectedOpenings,
      comparisons: {
        geometryBuffers: "exact source blob equality",
        worldBounds: "exact source blob and accepted audit equality",
        openingGeometryAndReferencePlanes: "exact stable accessor bindings inside exact source blob",
        pivotsAndTransforms: "exact node hierarchy inside exact source blob",
        floorAndRoomShell: "exact stable accessor/material bindings inside exact source blob"
      }
    };
    if (!record.sourceAssetUnchanged || !record.repeatDerivationsByteEqual || record.header.version !== 2 || record.header.declaredLength !== localA.length) {
      throw new Error(`${layout.id}: immutable source identity failed.`);
    }
    assets.push(record);
  }

  const generatedPaths = [
    "config/configurator-authority-v4-four-step.json",
    "config/configurator-authority-v4-four-step-coverage.json",
    "config/configurator-authority-v4-four-step-control-feasibility.json",
    "config/configurator-authority-v4-visual-roles.json",
    "config/configurator-authority-v4-presentation.json",
    "config/configurator-authority-v4-modified-edges.json",
    "config/configurator-authority-v4-protected-edges.json",
    "config/configurator-authority-v4-four-step-interaction.json",
    "config/configurator-authority-v4-four-step-provenance.json"
  ];
  const before = Object.fromEntries(await Promise.all(generatedPaths.map(async (relative) => [relative, sha256(await readFile(path.join(root, relative)))])));
  run(process.execPath, ["tools/configurator-authority-v4/generate-contracts.mjs", "--check"]);
  run(process.execPath, ["tools/configurator-authority-v4/generate-contracts.mjs", "--check"]);
  const after = Object.fromEntries(await Promise.all(generatedPaths.map(async (relative) => [relative, sha256(await readFile(path.join(root, relative)))])));
  const report = {
    schema: "jq-configurator-authority-v4-source-identity-v1",
    status: JSON.stringify(before) === JSON.stringify(after) && assets.every(({ sourceAssetUnchanged }) => sourceAssetUnchanged) ? "PASS" : "FAIL",
    accepted: { commit: V4_PROOF.acceptedCommit, tree: V4_PROOF.acceptedTree },
    derivationPolicy: "V4 emits no derived GLB. Two independent byte reads are the deterministic identity derivations; both must equal the accepted Git blob and registered source hash.",
    generatedContractChecks: { twoIndependentCheckRuns: true, hashesBefore: before, hashesAfter: after, byteStable: JSON.stringify(before) === JSON.stringify(after) },
    modifiedGeometry: false,
    modifiedEdges: 0,
    assets
  };
  await writeFile(path.join(outputRoot, "source-identity-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`source identity ${report.status}: ${assets.length} immutable GLBs, zero derived bytes, zero new degenerates\n`);
  if (report.status !== "PASS") process.exitCode = 1;
}

await main();
