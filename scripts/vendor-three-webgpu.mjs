import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build, version as esbuildVersion } from "esbuild";

const EXPECTED_THREE_VERSION = "0.166.1";
const EXPECTED_ESBUILD_VERSION = "0.28.2";
const checkOnly = process.argv.includes("--check");
const root = resolve(import.meta.dirname, "..");
const threePackagePath = resolve(root, "node_modules/three/package.json");
const entryPoint = resolve(root, "node_modules/three/examples/jsm/renderers/webgpu/WebGPURenderer.js");
const outputPath = resolve(root, "assets/vendor/three-webgpu-renderer-r166.bundle.js");

const threePackage = JSON.parse(await readFile(threePackagePath, "utf8"));
if (threePackage.version !== EXPECTED_THREE_VERSION) {
  throw new Error(`Expected three ${EXPECTED_THREE_VERSION}; received ${threePackage.version}.`);
}
if (esbuildVersion !== EXPECTED_ESBUILD_VERSION) {
  throw new Error(`Expected esbuild ${EXPECTED_ESBUILD_VERSION}; received ${esbuildVersion}.`);
}

const result = await build({
  entryPoints: [entryPoint],
  bundle: true,
  external: ["three"],
  format: "esm",
  minify: true,
  legalComments: "none",
  target: ["es2022"],
  write: false,
  banner: {
    js: "/* Three.js r166.1 WebGPURenderer bundle; MIT license: assets/vendor/licenses/three-0.166.1-LICENSE.txt */"
  }
});

const generated = result.outputFiles[0].contents;
const sha256 = createHash("sha256").update(generated).digest("hex");

if (checkOnly) {
  const committed = await readFile(outputPath);
  if (!committed.equals(generated)) {
    throw new Error(`${outputPath} is stale; run npm run vendor:webgpu.`);
  }
  console.log(`Verified deterministic Three.js WebGPU bundle (${generated.byteLength} bytes, ${sha256}).`);
} else {
  await writeFile(outputPath, generated);
  console.log(`Wrote deterministic Three.js WebGPU bundle (${generated.byteLength} bytes, ${sha256}).`);
}
