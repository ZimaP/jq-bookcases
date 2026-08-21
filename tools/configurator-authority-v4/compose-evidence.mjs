import { chromium } from "playwright";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LAYOUTS } from "./authority-contract.js";

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(toolDir, "../..");
const evidenceRoot = path.resolve(root, process.argv[2] || ".local-proof/configurator-authority-v4/four-step-correction-current");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function pngSize(bytes) {
  assert(bytes.subarray(1, 4).toString("ascii") === "PNG", "Expected a PNG evidence frame.");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

async function source(relative, label, note) {
  const absolute = path.join(evidenceRoot, relative);
  const bytes = await readFile(absolute);
  return { absolute, relative, label, note, bytes, sha256: sha256(bytes), size: pngSize(bytes) };
}

async function compose(browser, outputRelative, title, entries, columns) {
  const gap = 12;
  const header = 58;
  const caption = 48;
  const columnWidths = Array.from({ length: columns }, (_, column) => Math.max(...entries.filter((_, index) => index % columns === column).map(({ size }) => size.width)));
  const rows = Math.ceil(entries.length / columns);
  const rowHeights = Array.from({ length: rows }, (_, row) => Math.max(...entries.slice(row * columns, (row + 1) * columns).map(({ size }) => size.height)));
  const width = columnWidths.reduce((sum, value) => sum + value, 0) + gap * (columns + 1);
  const height = header + rowHeights.reduce((sum, value) => sum + value + caption, 0) + gap * (rows + 1);
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>
    *{box-sizing:border-box}html,body{margin:0;background:#e9ece8;color:#17231f;font:14px/1.25 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    h1{height:${header}px;margin:0;padding:18px ${gap}px 8px;font-size:22px}.grid{display:grid;grid-template-columns:${columnWidths.map((value) => `${value}px`).join(" ")};gap:${gap}px;padding:0 ${gap}px ${gap}px}.cell{background:#fff;border:1px solid #bcc6c0}.caption{height:${caption}px;padding:6px 9px;font-weight:700}.caption small{display:block;color:#53625b;font-weight:500}.cell img{display:block;width:auto;height:auto;max-width:none}
  </style><h1>${title}</h1><div class="grid">${entries.map((entry) => `<div class="cell"><div class="caption">${entry.label}<small>${entry.note}</small></div><img width="${entry.size.width}" height="${entry.size.height}" src="data:image/png;base64,${entry.bytes.toString("base64")}"></div>`).join("")}</div>`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const output = path.join(evidenceRoot, outputRelative);
  await mkdir(path.dirname(output), { recursive: true });
  await page.screenshot({ path: output, fullPage: true });
  await context.close();
  const bytes = await readFile(output);
  return {
    path: outputRelative,
    bytes: bytes.length,
    sha256: sha256(bytes),
    nativeSourcePixelsPreserved: true,
    sourceFrames: entries.map(({ relative, label, note, sha256: hash, size }) => ({ path: relative, label, note, sha256: hash, size }))
  };
}

async function main() {
  const captureBytes = await readFile(path.join(evidenceRoot, "capture-manifest.json"));
  const capture = JSON.parse(captureBytes);
  if (capture.status !== "PASS") throw new Error("Cannot compose a correction packet from a failed capture manifest.");
  const browser = await chromium.launch({ headless: true, args: ["--force-color-profile=srgb"] });
  const records = [];
  try {
    for (const step of [1, 2, 4]) {
      records.push(await compose(browser, `contact-sheets/accepted-step-${step}-equivalence.png`, `Accepted baseline equivalence · Step ${step}`, [
        await source(`routes/baseline-step-${step}.png`, "Accepted baseline", "No proof flag"),
        await source(`routes/proof-step-${step}.png`, "V4 proof route", "Same accepted Step UI")
      ], 2));
    }
    for (const layout of LAYOUTS) {
      records.push(await compose(browser, `contact-sheets/${layout.id}-responsive.png`, `V4 Customization · ${layout.label}`, [
        await source(`step3/${layout.id}-desktop-1366x768.png`, "Desktop", "1366×768"),
        await source(`step3/${layout.id}-ipad-landscape-1024x768.png`, "iPad landscape", "1024×768"),
        await source(`step3/${layout.id}-ipad-portrait-768x1024.png`, "iPad portrait", "768×1024"),
        await source(`step3/${layout.id}-mobile-390x844.png`, "Mobile", "390×844")
      ], 2));
    }
  } finally {
    await browser.close();
  }
  const report = {
    schema: "jq-configurator-authority-v4-four-step-contact-sheets-v1",
    status: "PASS",
    correction: "Four-step restoration evidence. Steps 1, 2, and 4 are accepted baseline UI; only Step 3 Customization is V4-owned.",
    sourceCaptureManifest: { path: "capture-manifest.json", sha256: sha256(captureBytes) },
    nativeScalePolicy: "Every source frame is embedded at exactly one CSS pixel per source pixel. Labels and gutters are supplemental and do not rescale source pixels.",
    v3Policy: "V3 is owner-rejected and is intentionally absent from this corrective packet.",
    records
  };
  await writeFile(path.join(evidenceRoot, "contact-sheet-manifest.json"), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`composed ${records.length} four-step correction contact sheets\n`);
}

await main();
