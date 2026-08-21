import { spawnSync } from "node:child_process";
import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(toolDir, "../..");
const outputRoot = path.resolve(root, process.argv[2] || ".local-proof/configurator-authority-v4/current");
const fingerprintTool = "/private/tmp/jq-v4-fingerprint.mjs";
const protectedV4Before = "/private/tmp/jq-v4-fourstep-protected-before.json";
const protectedWorktrees = [
  {
    id: "v2",
    root: "/Users/vladimirpryimak/Documents/JQ-bookcases-fireplace-pbr-v2",
    before: "/private/tmp/jq-v4-fourstep-v2-before-fingerprint.json"
  },
  {
    id: "v3",
    root: "/Users/vladimirpryimak/Documents/JQ-bookcases-visual-ux-v3",
    before: "/private/tmp/jq-v4-fourstep-v3-before-fingerprint.json"
  }
];

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", maxBuffer: 1024 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed: ${result.stderr}`);
  return result.stdout;
}

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

async function protectedV4Record() {
  const before = JSON.parse(await readFile(protectedV4Before, "utf8"));
  const records = [];
  for (const expected of before.records) {
    const absolute = path.join(root, expected.path);
    const metadata = await lstat(absolute);
    if (!metadata.isFile()) throw new Error(`Protected V4 path changed type: ${expected.path}`);
    const bytes = await readFile(absolute);
    records.push({
      path: expected.path,
      type: "file",
      mode: (metadata.mode & 0o7777).toString(8).padStart(4, "0"),
      bytes: bytes.length,
      sha256: sha256(bytes)
    });
  }
  const aggregateSha256 = sha256(JSON.stringify(records));
  const exactRecordEquality = JSON.stringify(before.records) === JSON.stringify(records);
  return {
    id: "v4-protected-files",
    recordCount: records.length,
    exactRecordEquality,
    beforeAggregateSha256: before.aggregateSha256,
    afterAggregateSha256: aggregateSha256,
    aggregateEquality: before.aggregateSha256 === aggregateSha256,
    coverage: ["GLBs", "renderer/material/lighting/camera files", "geometry/provenance assets", "prior visual captures and orbits", "package.json", "lockfile", "byte contents", "file modes"],
    before,
    after: { schema: before.schema, root, aggregateSha256, recordCount: records.length, records }
  };
}

async function main() {
  await mkdir(outputRoot, { recursive: true });
  const records = [];
  const v4Record = await protectedV4Record();
  await writeFile(path.join(outputRoot, "v4-protected-before-hashes.json"), `${JSON.stringify(v4Record.before, null, 2)}\n`);
  await writeFile(path.join(outputRoot, "v4-protected-after-hashes.json"), `${JSON.stringify(v4Record.after, null, 2)}\n`);
  await writeFile(path.join(outputRoot, "v4-protected-hash-equality.json"), `${JSON.stringify(v4Record, null, 2)}\n`);
  if (!v4Record.exactRecordEquality || !v4Record.aggregateEquality) throw new Error("V4 protected-file hash equality changed.");
  records.push({ id: v4Record.id, root, exactFingerprintEquality: v4Record.exactRecordEquality, beforeAggregateSha256: v4Record.beforeAggregateSha256, afterAggregateSha256: v4Record.afterAggregateSha256 });
  for (const worktree of protectedWorktrees) {
    const afterTemporary = `/private/tmp/jq-v4-${worktree.id}-after-fingerprint.json`;
    run(process.execPath, [fingerprintTool, worktree.root, afterTemporary]);
    const [beforeBytes, afterBytes] = await Promise.all([readFile(worktree.before), readFile(afterTemporary)]);
    const before = JSON.parse(beforeBytes);
    const after = JSON.parse(afterBytes);
    const exactFingerprintEquality = JSON.stringify(before.fingerprint) === JSON.stringify(after.fingerprint);
    const record = {
      id: worktree.id,
      root: worktree.root,
      exactFingerprintEquality,
      beforeAggregateSha256: before.aggregateSha256,
      afterAggregateSha256: after.aggregateSha256,
      aggregateEquality: before.aggregateSha256 === after.aggregateSha256,
      coverage: ["tracked contents", "untracked and ignored contents", "file modes", "symlinks and targets", "byte contents", "directory/file inventory", "raw Git index", "tracked index", "binary worktree diff", "porcelain status"],
      before,
      after
    };
    await writeFile(path.join(outputRoot, `${worktree.id}-before-fingerprint.json`), beforeBytes);
    await writeFile(path.join(outputRoot, `${worktree.id}-after-fingerprint.json`), afterBytes);
    await writeFile(path.join(outputRoot, `${worktree.id}-fingerprint-equality.json`), `${JSON.stringify(record, null, 2)}\n`);
    if (!exactFingerprintEquality || !record.aggregateEquality) throw new Error(`${worktree.id.toUpperCase()} protected worktree fingerprint changed.`);
    records.push({ id: record.id, root: record.root, exactFingerprintEquality, beforeAggregateSha256: record.beforeAggregateSha256, afterAggregateSha256: record.afterAggregateSha256 });
  }
  const summary = { schema: "jq-configurator-authority-v4-four-step-protected-fingerprints-v1", status: "PASS", fingerprintTool, protectedV4Before, records };
  await writeFile(path.join(outputRoot, "protected-worktree-fingerprint-report.json"), `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`protected fingerprints PASS: ${records.map(({ id, beforeAggregateSha256 }) => `${id.toUpperCase()} ${beforeAggregateSha256}`).join(", ")}\n`);
}

await main();
