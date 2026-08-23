import { access, copyFile, lstat, mkdir, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = path.resolve(toolDirectory, "../..");

const PUBLIC_PREVIEW_ALLOWLIST = Object.freeze([
  "assets/environments/jq-neutral-studio.hdr",
  "assets/favicon.svg",
  "assets/models/room2/Room2-Fireplace-bookcases-source-v1.glb",
  "assets/models/room2/jq-door-wall-bookcase-room2-authoritative-v01.glb",
  "assets/models/room4/jq-window-wall-bookcases-cabinets-room4-authoritative-v01.glb",
  "assets/photos/configurator/concept-cabinets-shelves-v2.avif",
  "assets/photos/configurator/concept-drawers-shelves-v2.avif",
  "assets/photos/configurator/concept-full-shelving-v2.avif",
  "assets/photos/configurator/concept-tv-wall-v2.avif",
  "assets/photos/configurator/concept-window-cabinets-v2.avif",
  "assets/photos/configurator/layout-model-thumbnails/door-wall-v1.png",
  "assets/photos/configurator/layout-model-thumbnails/fireplace-wall-v1.png",
  "assets/photos/configurator/layout-model-thumbnails/window-wall-v1.png",
  "assets/photos/configurator/product-floating-storage-v2.avif",
  "assets/photos/configurator/product-radiator-cover-v2.avif",
  "assets/photos/configurator/room-layouts/room-door-wall-v1.avif",
  "assets/photos/configurator/room-layouts/room-fireplace-wall-v1.avif",
  "assets/photos/configurator/room-layouts/room-window-wall-v1.avif",
  "assets/premium-model-v1/ASSET-LICENSES.md",
  "assets/premium-model-v1/textures/oak/base-color.webp",
  "assets/premium-model-v1/textures/oak/normal.webp",
  "assets/premium-model-v1/textures/oak/roughness.webp",
  "assets/room2-commercial-pbr-v1/ASSET-LICENSES.md",
  "assets/room2-commercial-pbr-v1/textures/oak/base-color.webp",
  "assets/room2-commercial-pbr-v1/textures/oak/normal.webp",
  "assets/room2-commercial-pbr-v1/textures/oak/roughness.webp",
  "assets/room2-commercial-pbr-v1/textures/paint/normal.webp",
  "assets/room2-commercial-pbr-v1/textures/paint/roughness.webp",
  "assets/room2-commercial-pbr-v1/textures/walnut/base-color.webp",
  "assets/room2-commercial-pbr-v1/textures/walnut/roughness.webp",
  "assets/vendor/licenses/three-0.166.1-LICENSE.txt",
  "assets/vendor/three-addons/lights/RectAreaLightUniformsLib.js",
  "assets/vendor/three-addons/loaders/GLTFLoader.js",
  "assets/vendor/three-addons/loaders/RGBELoader.js",
  "assets/vendor/three-addons/utils/BufferGeometryUtils.js",
  "assets/vendor/three.module.js",
  "bookcase-billable.js",
  "bookcase-bom.js",
  "bookcase-config.js",
  "bookcase-engine.js",
  "bookcase-layout.js",
  "bookcase-pricing.js",
  "bookcase-render-contract.js",
  "config/premium-model-v1-roles.json",
  "configurator.html",
  "guided-configurator-data.js",
  "guided-configurator-state.js",
  "guided-configurator.css",
  "guided-configurator.js",
  "guided-immersive-configurator.css",
  "guided-installation-solver.js",
  "guided-layout-material-zones.generated.js",
  "guided-layout-registry.js",
  "guided-layout-viewer.js",
  "guided-premium-model-v1-contract.js",
  "guided-premium-model-v1.js",
  "guided-product-adapter.js",
  "guided-product-engine.js",
  "guided-project-engine.js",
  "guided-render-contract.js",
  "guided-room-topology.js",
  "guided-room2-appearance.js",
  "guided-room2-integrity.js",
  "guided-room2-materials.js",
  "hardware-catalog.js",
  "hardware-compatibility.js",
  "icon-system.js",
  "styles.css",
  "styles/icons.css"
].sort());

async function prepare(outputDirectory) {
  const output = path.resolve(outputDirectory);
  try {
    await access(output, constants.F_OK);
    if ((await readdir(output)).length) throw new Error(`Preview output must be empty: ${output}`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    await mkdir(output, { recursive: true });
  }
  for (const relativePath of PUBLIC_PREVIEW_ALLOWLIST) {
    const source = path.join(sourceRoot, relativePath);
    const metadata = await lstat(source);
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      throw new Error(`Preview source must be a regular file: ${relativePath}`);
    }
    const destination = path.join(output, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(source, destination);
  }
  process.stdout.write(`${JSON.stringify({
    schema: "jq-premium-model-v1-public-preview-v1",
    output,
    allowlistedFiles: PUBLIC_PREVIEW_ALLOWLIST.length,
    repositoryMetadataIncluded: false,
    testsIncluded: false,
    toolsIncluded: false
  }, null, 2)}\n`);
}

const outputDirectory = process.argv[2];
if (!outputDirectory) throw new Error("Usage: node tools/premium-model-v1/prepare-preview-site.mjs <empty-output-directory>");
await prepare(outputDirectory);
