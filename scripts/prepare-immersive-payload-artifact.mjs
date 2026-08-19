import { constants } from "node:fs";
import { access, copyFile, lstat, mkdir, readFile, readdir } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PRODUCTION_JAVASCRIPT_AND_CSS_ALLOWLIST = Object.freeze([
  "about-reference.css",
  "assets/vendor/three-addons/environments/RoomEnvironment.js",
  "assets/vendor/three-addons/lights/RectAreaLightUniformsLib.js",
  "assets/vendor/three-addons/loaders/GLTFLoader.js",
  "assets/vendor/three-addons/loaders/RGBELoader.js",
  "assets/vendor/three-addons/utils/BufferGeometryUtils.js",
  "assets/vendor/three-webgpu-renderer-r166.bundle.js",
  "assets/vendor/three.module.js",
  "benjamin-moore-colors.js",
  "bookcase-billable.js",
  "bookcase-bom.js",
  "bookcase-config.js",
  "bookcase-engine.js",
  "bookcase-layout.js",
  "bookcase-pricing.js",
  "bookcase-render-contract.js",
  "bright-theme.css",
  "guided-configurator-data.js",
  "guided-configurator-state.js",
  "guided-configurator.css",
  "guided-configurator.js",
  "guided-immersive-configurator.css",
  "guided-installation-solver.js",
  "guided-layout-material-zones.generated.js",
  "guided-layout-registry.js",
  "guided-layout-viewer.js",
  "guided-materials.js",
  "guided-product-adapter.js",
  "guided-product-engine.js",
  "guided-project-engine.js",
  "guided-published-preview-data.js",
  "guided-published-preview-registry.generated.js",
  "guided-render-contract.js",
  "guided-render-primitives.js",
  "guided-room-topology.js",
  "guided-room2-appearance.js",
  "guided-room2-integrity.js",
  "guided-room2-materials.js",
  "hardware-catalog.js",
  "hardware-compatibility.js",
  "home-reference.css",
  "how-it-works-reference.css",
  "icon-system.js",
  "inspiration-reference.css",
  "materials-reference.css",
  "quote-prefill.js",
  "reference-pages.css",
  "site.js",
  "styles/icons.css",
  "styles.css",
  "visual-consistency.css",
].sort());

async function listEmittedJavaScriptAndCss(directory, root = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const absolutePath = resolve(directory, entry.name);
    const metadata = await lstat(absolutePath);
    if (metadata.isSymbolicLink()) throw new Error(`Production payload refuses symbolic links: ${absolutePath}`);
    if (metadata.isDirectory()) files.push(...await listEmittedJavaScriptAndCss(absolutePath, root));
    else if (metadata.isFile() && /\.(?:css|js)$/u.test(entry.name)) files.push(relative(root, absolutePath));
  }
  return files.sort();
}

async function assertSourceFile(sourceRoot, path) {
  const source = resolve(sourceRoot, path);
  const metadata = await lstat(source);
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error(`Production payload source must be a regular file: ${path}`);
  }
  return source;
}

export async function preparePayloadArtifact(outputDirectory, sourceDirectory = process.cwd()) {
  const output = resolve(outputDirectory);
  try {
    await access(output, constants.F_OK);
    if ((await readdir(output)).length > 0) throw new Error(`Payload output must be empty: ${output}`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    await mkdir(output, { recursive: true });
  }
  for (const path of PRODUCTION_JAVASCRIPT_AND_CSS_ALLOWLIST) {
    const source = await assertSourceFile(sourceDirectory, path);
    const destination = resolve(output, path);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(source, destination);
  }
  return output;
}

export async function verifyPayloadArtifact(siteDirectory, sourceDirectory = process.cwd()) {
  const site = resolve(siteDirectory);
  const emitted = await listEmittedJavaScriptAndCss(site);
  if (JSON.stringify(emitted) !== JSON.stringify(PRODUCTION_JAVASCRIPT_AND_CSS_ALLOWLIST)) {
    const expected = new Set(PRODUCTION_JAVASCRIPT_AND_CSS_ALLOWLIST);
    const actual = new Set(emitted);
    const missing = PRODUCTION_JAVASCRIPT_AND_CSS_ALLOWLIST.filter((path) => !actual.has(path));
    const unexpected = emitted.filter((path) => !expected.has(path));
    throw new Error(`Production JS/CSS allowlist drift. Missing: ${missing.join(", ") || "none"}. Unexpected: ${unexpected.join(", ") || "none"}.`);
  }
  for (const path of PRODUCTION_JAVASCRIPT_AND_CSS_ALLOWLIST) {
    const source = await assertSourceFile(sourceDirectory, path);
    const emittedFile = resolve(site, path);
    const [sourceBytes, emittedBytes] = await Promise.all([readFile(source), readFile(emittedFile)]);
    if (!sourceBytes.equals(emittedBytes)) throw new Error(`Production payload bytes differ from source: ${path}`);
  }
  return site;
}

async function main() {
  const verify = process.argv[2] === "--verify";
  const directory = process.argv[verify ? 3 : 2];
  if (!directory) {
    throw new Error("Usage: node scripts/prepare-immersive-payload-artifact.mjs [--verify] <directory>");
  }
  const result = verify
    ? await verifyPayloadArtifact(directory)
    : await preparePayloadArtifact(directory);
  process.stdout.write(`${verify ? "Verified" : "Prepared"} production JS/CSS payload at ${result}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
