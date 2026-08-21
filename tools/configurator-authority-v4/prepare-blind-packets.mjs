import { chromium } from "playwright";
import { randomInt } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LAYOUTS } from "./authority-contract.js";

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(toolDir, "../..");
const evidenceRoot = path.resolve(root, process.argv[2] || ".local-proof/configurator-authority-v4/current");
const packetRoot = path.resolve(process.argv[3] || path.join(os.tmpdir(), `jq-v4-blind-${Date.now()}`));
const ffmpeg = process.env.FFMPEG || "ffmpeg";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: null, maxBuffer: 512 * 1024 * 1024, ...options });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed: ${(result.stderr || Buffer.alloc(0)).toString("utf8")}`);
  return result.stdout;
}

function pngSize(bytes) {
  assert(bytes.length >= 24 && bytes.subarray(1, 4).toString("ascii") === "PNG", "Expected PNG blind source.");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

async function renderOpaque(browser, source, output, sideLabel) {
  const bytes = await readFile(source);
  const size = pngSize(bytes);
  const header = 44;
  const context = await browser.newContext({ viewport: { width: size.width + 4, height: size.height + header + 4 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{margin:0;background:#e9ece8;color:#17231f;font:700 18px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.label{height:${header}px;display:grid;place-items:center}.frame{margin:0 2px 2px;border:0}.frame img{display:block;max-width:none}</style><div class="label">${sideLabel}</div><div class="frame"><img width="${size.width}" height="${size.height}" src="data:image/png;base64,${bytes.toString("base64")}"></div>`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: output });
  await context.close();
}

function shuffle(values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = randomInt(index + 1);
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

async function makeImagePair(browser, group, index, leftSource, rightSource, mapping) {
  const swap = randomInt(2) === 1;
  const sides = swap ? [rightSource, leftSource] : [leftSource, rightSource];
  const id = `${group}-${String(index).padStart(2, "0")}`;
  const directory = path.join(packetRoot, group);
  await mkdir(directory, { recursive: true });
  for (const [sideIndex, source] of sides.entries()) {
    const side = sideIndex === 0 ? "A" : "B";
    await renderOpaque(browser, source.path, path.join(directory, `${id}-side-${side.toLowerCase()}.png`), `Side ${side}`);
  }
  mapping[id] = { A: sides[0].version, B: sides[1].version, sources: { A: sides[0].path, B: sides[1].path }, rubric: leftSource.rubric };
}

function makeVideoPair(group, index, leftSource, rightSource, mapping) {
  const swap = randomInt(2) === 1;
  const sides = swap ? [rightSource, leftSource] : [leftSource, rightSource];
  const id = `${group}-${String(index).padStart(2, "0")}`;
  const directory = path.join(packetRoot, group);
  return mkdir(directory, { recursive: true }).then(() => {
    for (const [sideIndex, source] of sides.entries()) {
      const side = sideIndex === 0 ? "a" : "b";
      run(ffmpeg, ["-y", "-v", "error", "-i", source.path, "-vf", "pad=iw+4:ih+4:2:2:color=0xE9ECE8", "-an", "-c:v", "libx264", "-crf", "17", "-pix_fmt", "yuv420p", "-movflags", "+faststart", path.join(directory, `${id}-side-${side}.mp4`)]);
    }
    mapping[id] = { A: sides[0].version, B: sides[1].version, sources: { A: sides[0].path, B: sides[1].path }, rubric: leftSource.rubric };
  });
}

async function main() {
  await mkdir(packetRoot, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ["--force-color-profile=srgb"] });
  const mapping = {};
  try {
    let index = 0;
    for (const diagnosticId of ["proof-light", "proof-dark"]) for (const layout of LAYOUTS) {
      index += 1;
      const rubric = { layoutId: layout.id, diagnosticId, nativeScale: true, regions: ["face frames", "shelf fronts/undersides", "backs/interiors", "door boundaries/detail", "fillers/end panels", "countertops", "top rail", "toe/base", "hardware", "left/right cabinetry", "architectural opening"], failures: ["light washout", "dark crushing", "merged construction", "artificial outlines", "shimmer", "detached shadows"] };
      await makeImagePair(browser, "visual", index,
        { version: "accepted", path: path.join(evidenceRoot, "matched", `accepted-${layout.id}-${diagnosticId}.png`), rubric },
        { version: "v4", path: path.join(evidenceRoot, "matched", `v4-${layout.id}-${diagnosticId}.png`), rubric }, mapping);
    }
    index = 0;
    for (const viewport of [
      { width: 1920, height: 1080 }, { width: 1366, height: 768 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }
    ]) for (const layout of LAYOUTS) {
      index += 1;
      const rubric = { layoutId: layout.id, viewport, nativeScale: true, checks: ["accepted four-step navigation", "V4-owned Customization at Step 3 only", "relevant inputs", "pending content noninteractive", "no legacy tabs", "no customer shelf spacing", "model unobscured", "primary navigation visible", "readable labels", "touch targets"] };
      await makeImagePair(browser, "ux", index,
        { version: "accepted", path: path.join(evidenceRoot, "responsive", `accepted-${viewport.width}x${viewport.height}-${layout.id}-customize.png`), rubric },
        { version: "v4", path: path.join(evidenceRoot, "responsive", `v4-${viewport.width}x${viewport.height}-${layout.id}-configure.png`), rubric }, mapping);
    }
    const journeySources = shuffle(LAYOUTS.flatMap((layout) => Array.from({ length: 4 }, (_, offset) => ({ layoutId: layout.id, step: offset + 1, path: path.join(evidenceRoot, "journey", `v4-${layout.id}-step-${offset + 1}.png`) }))));
    await mkdir(path.join(packetRoot, "journey"), { recursive: true });
    for (const [journeyIndex, source] of journeySources.entries()) {
      const id = `journey-${String(journeyIndex + 1).padStart(2, "0")}`;
      await renderOpaque(browser, source.path, path.join(packetRoot, "journey", `${id}.png`), `Screen ${journeyIndex + 1}`);
      mapping[id] = { version: "v4", source: source.path, layoutId: source.layoutId, step: source.step };
    }
  } finally {
    await browser.close();
  }
  let orbitIndex = 0;
  for (const diagnosticId of ["proof-light", "proof-dark"]) for (const layout of LAYOUTS) {
    orbitIndex += 1;
    const rubric = { layoutId: layout.id, diagnosticId, nativeScale: true, checks: ["edge shimmer", "shadow crawl/popping", "detached shadows", "highlight discontinuity", "dark crush/light washout"] };
    await makeVideoPair("orbit", orbitIndex,
      { version: "accepted", path: path.join(evidenceRoot, "orbit", `accepted-${layout.id}-${diagnosticId}-orbit.mp4`), rubric },
      { version: "v4", path: path.join(evidenceRoot, "orbit", `v4-${layout.id}-${diagnosticId}-orbit.mp4`), rubric }, mapping);
  }
  process.stdout.write(`${JSON.stringify({ packetRoot, mapping })}\n`);
}

await main();
