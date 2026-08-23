import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PREMIUM_MODEL_V1_CONTRACT } from "../../guided-premium-model-v1-contract.js";

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(toolDirectory, "../..");
const outputPath = "config/premium-model-v1-provenance.json";
const checkOnly = process.argv.includes("--check");

const BASE = Object.freeze({
  commit: "d42dc10b929b3abf0715fe066ec7bad89760ed3b",
  tree: "b1c68e6cbbbc95176ee655274242b92adf890c37"
});

const FILES = Object.freeze([
  "guided-layout-viewer.js",
  "guided-premium-model-v1-contract.js",
  "guided-premium-model-v1.js",
  "config/premium-model-v1-roles.json",
  "assets/premium-model-v1/ASSET-LICENSES.md",
  "assets/premium-model-v1/textures/oak/base-color.webp",
  "assets/premium-model-v1/textures/oak/normal.webp",
  "assets/premium-model-v1/textures/oak/roughness.webp",
  "assets/premium-model-v1/textures/walnut/base-color.webp",
  "assets/premium-model-v1/textures/walnut/normal.webp",
  "assets/premium-model-v1/textures/walnut/roughness.webp",
  "assets/models/room2/Room2-Fireplace-bookcases-source-v1.glb",
  "assets/models/room2/jq-door-wall-bookcase-room2-authoritative-v01.glb",
  "assets/models/room4/jq-window-wall-bookcases-cabinets-room4-authoritative-v01.glb"
]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return Object.is(value, -0) ? 0 : value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

const identities = [];
for (const relativePath of FILES) {
  const bytes = await readFile(path.join(root, relativePath));
  identities.push({ path: relativePath, bytes: bytes.length, sha256: sha256(bytes) });
}
const roleManifest = JSON.parse(await readFile(path.join(root, "config/premium-model-v1-roles.json"), "utf8"));
const provenance = {
  schema: "jq-premium-model-v1-provenance-v1",
  status: "ISOLATED VISUAL PREVIEW — OWNER ACCEPTANCE OPEN",
  acceptedBase: BASE,
  scope: {
    permitted: ["3D runtime materials", "PBR textures", "runtime-derived furniture bevel geometry", "shared lighting response", "shared contact-shadow policy"],
    excluded: ["interface", "navigation", "customer state", "pricing", "backend", "source GLB mutation", "production default without flag"]
  },
  activation: {
    query: "modelQuality=premium-v1",
    absentFlagBehavior: "accepted renderer path remains unchanged"
  },
  geometry: {
    method: "runtime replacement of exact 12-triangle axis-aligned furniture boxes only",
    bevelWidthMillimeters: PREMIUM_MODEL_V1_CONTRACT.bevel.widthMeters * 1000,
    sourceAssetsModified: false,
    worldBoundsPreserved: true,
    protectedArchitecture: true,
    derivationDeterministic: true
  },
  roleCoverage: {
    schema: roleManifest.schema,
    layouts: roleManifest.layouts.map(({ layoutId, primitiveCount, roleCounts }) => ({ layoutId, primitiveCount, roleCounts })),
    totalPrimitives: roleManifest.layouts.reduce((sum, { primitiveCount }) => sum + primitiveCount, 0)
  },
  textureProvenance: {
    oak: {
      asset: "White Oak Veneer",
      author: "Jenelle van Heerden",
      source: "https://polyhaven.com/a/white_oak_veneer",
      license: "CC0 1.0",
      licenseUrl: "https://polyhaven.com/license"
    },
    walnut: {
      asset: "European Walnut Veneer 05",
      author: "Jenelle van Heerden",
      source: "https://polyhaven.com/a/european_walnut_veneer_05",
      license: "CC0 1.0",
      licenseUrl: "https://polyhaven.com/license"
    },
    paint: "existing accepted repository PBR asset family"
  },
  files: identities
};
const serialized = `${JSON.stringify(stable(provenance), null, 2)}\n`;
if (checkOnly) {
  const current = await readFile(path.join(root, outputPath), "utf8").catch(() => "");
  if (current !== serialized) throw new Error(`${outputPath} is stale.`);
  process.stdout.write(`checked ${outputPath}\n`);
} else {
  await writeFile(path.join(root, outputPath), serialized);
  process.stdout.write(`generated ${outputPath}\n`);
}
