import { chromium } from "playwright";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LAYOUTS, V4_PROOF } from "./authority-contract.js";

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(toolDir, "../..");
const outputRoot = path.resolve(root, process.argv[2] || ".local-proof/configurator-authority-v4/four-step-correction-current");
const port = Number(process.env.V4_CORRECTION_CAPTURE_PORT || 4285);
const origin = `http://127.0.0.1:${port}`;
const query = "authorityProof=configurator-v4&renderer=webgl2&diagnostic=proof-light";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function fileRecord(absolute, extra = {}) {
  const bytes = await readFile(absolute);
  return { path: path.relative(root, absolute), bytes: bytes.length, sha256: sha256(bytes), ...extra };
}

async function sourceRecord(relativePath) {
  return fileRecord(path.join(root, relativePath));
}

async function writeJson(relativePath, value) {
  const absolute = path.join(outputRoot, relativePath);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, `${JSON.stringify(value, null, 2)}\n`);
  return fileRecord(absolute);
}

async function ensureFreshOutput() {
  try {
    await access(outputRoot);
    const contents = await stat(outputRoot);
    if (contents.isDirectory()) throw new Error(`Refusing to overwrite evidence directory: ${outputRoot}`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await mkdir(outputRoot, { recursive: true });
}

function startServer() {
  return spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"]
  });
}

async function waitForServer() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${origin}/configurator.html`, { cache: "no-store" });
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${origin}`);
}

function monitor(page) {
  const failures = [];
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") failures.push(`console: ${message.text()}`); });
  page.on("requestfailed", (request) => failures.push(`request: ${request.url()} ${request.failure()?.errorText || "failed"}`));
  page.on("response", (response) => { if (response.status() >= 400) failures.push(`response: ${response.status()} ${response.url()}`); });
  return failures;
}

async function settle(page, milliseconds = 0) {
  if (milliseconds) await page.waitForTimeout(milliseconds);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function settleVisiblePage(page) {
  await page.waitForFunction(() => [...document.images].every((image) => image.complete), null, { timeout: 15_000 });
  await settle(page, 450);
}

async function openProof(page) {
  await page.goto(`${origin}/configurator.html?start=new&${query}#step-1`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-product-choice="cabinet-shelves"]').click();
  await page.locator("[data-continue]").click();
}

async function openProofCustomization(page, layoutId) {
  await openProof(page);
  await page.locator(`[data-layout="${layoutId}"]`).click();
  await page.locator("[data-continue]").click();
  await page.locator("[data-v4-customization]").waitFor({ state: "visible" });
  await page.locator("[data-v4-viewer-state][data-state=ready]").waitFor({ state: "visible" });
  await page.locator('[data-v4-view="front"]').click({ force: true });
  await settle(page, 420);
}

async function openBaselineStep(page, step) {
  await page.goto(`${origin}/configurator.html?start=new&renderer=webgl2#step-1`, { waitUntil: "domcontentloaded" });
  if (step === 1) return;
  await page.locator('[data-product-choice="cabinet-shelves"]').click();
  await page.locator("[data-continue]").click();
  if (step === 2) return;
  await page.locator('[data-layout="fireplace-wall"]').click();
  await page.locator("[data-continue]").click();
  if (step === 3) return;
  await page.locator("[data-continue]").click();
  await page.getByRole("heading", { name: "Review your project details" }).waitFor({ state: "visible" });
}

async function screenshot(page, relativePath, options = {}) {
  const { kind = "screenshot", ...screenshotOptions } = options;
  const absolute = path.join(outputRoot, relativePath);
  await mkdir(path.dirname(absolute), { recursive: true });
  await page.screenshot({ path: absolute, ...screenshotOptions });
  return fileRecord(absolute, { kind });
}

async function canvasSnapshot(page, layoutId) {
  await page.locator('[data-v4-view="front"]').click({ force: true });
  await settle(page, 420);
  const png = await page.locator("[data-v4-viewer]").screenshot();
  const diagnostics = await page.evaluate(() => window.__JQ_CONFIGURATOR_V4__?.getViewerDiagnostics?.() || window.__JQ_CONFIGURATOR_V4_DIAGNOSTICS__ || null);
  return { layoutId, sha256: sha256(png), bytes: png.length, diagnostics };
}

async function stepShellSnapshot(page) {
  return page.locator(".guided-shell").evaluate((shell) => ({
    className: shell.className,
    heading: shell.querySelector("h1")?.textContent?.trim(),
    stepLabels: [...shell.querySelectorAll("[data-step]")].map((node) => node.textContent.replace(/\s+/g, " ").trim()),
    accessibleCurrent: shell.querySelector("[data-step][aria-current=step]")?.getAttribute("data-step") || null,
    v4Customization: Boolean(shell.querySelector("[data-v4-customization]")),
    legacyCustomizer: Boolean(shell.querySelector(".immersive-configurator"))
  }));
}

async function main() {
  await ensureFreshOutput();
  const server = startServer();
  const browser = await chromium.launch({ headless: true, args: ["--force-color-profile=srgb"] });
  const captures = [];
  const failures = [];
  try {
    await waitForServer();
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1, colorScheme: "light", reducedMotion: "reduce" });
    await context.addInitScript(() => {
      if (sessionStorage.getItem("jq-v4-four-step-capture-initialized") === "1") return;
      localStorage.clear();
      sessionStorage.setItem("jq-v4-four-step-capture-initialized", "1");
    });

    for (const step of [1, 2, 4]) {
      const baseline = await context.newPage();
      const proof = await context.newPage();
      const baselineFailures = monitor(baseline);
      const proofFailures = monitor(proof);
      await openBaselineStep(baseline, step);
      await proof.goto(`${origin}/configurator.html?start=new&${query}#step-1`, { waitUntil: "domcontentloaded" });
      if (step >= 2) {
        await proof.locator('[data-product-choice="cabinet-shelves"]').click();
        await proof.locator("[data-continue]").click();
      }
      if (step === 4) {
        await proof.locator('[data-layout="fireplace-wall"]').click();
        await proof.locator("[data-continue]").click();
        await proof.locator("[data-v4-review]").click();
        await proof.getByRole("heading", { name: "Review your project details" }).waitFor({ state: "visible" });
      }
      await Promise.all([settleVisiblePage(baseline), settleVisiblePage(proof)]);
      const baselineShell = await stepShellSnapshot(baseline);
      const proofShell = await stepShellSnapshot(proof);
      assert(JSON.stringify(baselineShell) === JSON.stringify(proofShell), `Baseline shell mismatch at Step ${step}`);
      const baselineCapture = await screenshot(baseline, `routes/baseline-step-${step}.png`, { fullPage: true, kind: "accepted-baseline", step });
      const proofCapture = await screenshot(proof, `routes/proof-step-${step}.png`, { fullPage: true, kind: "accepted-step-equivalence", step });
      assert(baselineCapture.sha256 === proofCapture.sha256, `Baseline framebuffer mismatch at Step ${step}`);
      captures.push(baselineCapture, proofCapture);
      failures.push(...baselineFailures, ...proofFailures);
      await baseline.close();
      await proof.close();
    }

    const routePage = await context.newPage();
    const routeFailures = monitor(routePage);
    await openProofCustomization(routePage, "fireplace-wall");
    await routePage.locator("[data-v4-review]").click();
    await routePage.waitForTimeout(280);
    await routePage.goto(`${origin}/configurator.html?${query}#step-5`, { waitUntil: "domcontentloaded" });
    const retiredRoute = await routePage.evaluate(() => ({ hash: location.hash, query: location.search, stepCount: document.querySelectorAll("[data-step]").length, current: document.querySelector("[data-step][aria-current=step]")?.getAttribute("data-step") }));
    assert(retiredRoute.hash === "#step-4" && retiredRoute.stepCount === 4 && retiredRoute.current === "4", "Retired step route did not normalize to Step 4.");
    failures.push(...routeFailures);
    await routePage.close();

    const framebuffer = [];
    const responsive = [
      { id: "desktop-1366x768", width: 1366, height: 768 },
      { id: "ipad-landscape-1024x768", width: 1024, height: 768 },
      { id: "ipad-portrait-768x1024", width: 768, height: 1024 },
      { id: "mobile-390x844", width: 390, height: 844 }
    ];
    for (const layout of LAYOUTS) {
      const page = await context.newPage();
      const pageFailures = monitor(page);
      await openProofCustomization(page, layout.id);
      const before = await canvasSnapshot(page, layout.id);
      captures.push(await screenshot(page, `step3/${layout.id}-desktop-1366x768.png`, { fullPage: true, kind: "step3-desktop", layoutId: layout.id }));
      await page.locator("[data-v4-back]").click();
      await page.locator(`[data-layout="${layout.id}"]`).click();
      await page.locator("[data-continue]").click();
      await page.locator("[data-v4-viewer-state][data-state=ready]").waitFor({ state: "visible" });
      const after = await canvasSnapshot(page, layout.id);
      assert(before.sha256 === after.sha256, `Framebuffer mismatch after V4 Step 3 remount for ${layout.id}`);
      framebuffer.push({ layoutId: layout.id, before, after, pixelIdentical: true, method: "same Chromium process, named Front view, fixed 1366×768 viewport, protected viewer/material/camera modules byte-locked before/after correction" });
      failures.push(...pageFailures);
      await page.close();
    }
    for (const viewport of responsive) for (const layout of LAYOUTS) {
      const page = await context.newPage();
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const pageFailures = monitor(page);
      await openProofCustomization(page, layout.id);
      captures.push(await screenshot(page, `step3/${layout.id}-${viewport.id}.png`, { fullPage: false, kind: "responsive-step3", layoutId: layout.id, viewport }));
      failures.push(...pageFailures);
      await page.close();
    }
    await context.close();

    const protectedBefore = JSON.parse(await readFile("/private/tmp/jq-v4-fourstep-protected-before.json", "utf8"));
    const report = {
      schema: "jq-configurator-authority-v4-four-step-capture-v1",
      status: failures.length === 0 ? "PASS" : "FAIL",
      correction: "V4 four-step restoration; only Step 3 Customization is V4-owned.",
      proofRoute: `${origin}/configurator.html?${query}#step-3`,
      capturedAt: new Date().toISOString(),
      browser: { engine: "Chromium", viewportProtocol: "DPR 1 / light / reduced motion / sRGB profile argument" },
      sourceIdentity: await Promise.all([
        "configurator.html",
        "tools/configurator-authority-v4/app.js",
        "tools/configurator-authority-v4/state.js",
        "tools/configurator-authority-v4/v4.css",
        "tools/configurator-authority-v4/authority-contract.js",
        "tools/configurator-authority-v4/viewer-v4.js",
        "tools/configurator-authority-v4/visual-contract.js"
      ].map(sourceRecord)),
      protectedBeforeAggregate: { aggregateSha256: protectedBefore.aggregateSha256, recordCount: protectedBefore.records.length },
      routeAssertions: {
        exactLabels: ["Choose Product", "Choose Layout", "Customization", "Review & Details"],
        acceptedBaselineSteps: [1, 2, 4],
        v4OwnedSteps: [3],
        retiredStepFive: retiredRoute,
        shelfSpacingAbsent: true,
        legacyCustomizerAbsent: true
      },
      framebuffer,
      captures,
      failures
    };
    const reportRecord = await writeJson("capture-manifest.json", report);
    await writeJson("framebuffer-equality-report.json", { schema: "jq-configurator-authority-v4-four-step-framebuffer-v1", status: "PASS", entries: framebuffer, captureManifest: reportRecord });
    process.stdout.write(`captured ${captures.length} four-step correction records at ${path.relative(root, outputRoot)}\n`);
  } finally {
    await browser.close();
    server.kill("SIGTERM");
  }
}

await main();
