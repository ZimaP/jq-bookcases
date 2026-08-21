import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LAYOUTS, V4_PROOF } from "./authority-contract.js";

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(toolDir, "../..");
const outputRoot = path.resolve(root, process.argv[2] || ".local-proof/configurator-authority-v4/current");
const acceptedPort = Number(process.env.V4_PERF_ACCEPTED_PORT || 4204);
const candidatePort = Number(process.env.V4_PERF_CANDIDATE_PORT || 4205);
const acceptedOrigin = `http://127.0.0.1:${acceptedPort}`;
const candidateOrigin = `http://127.0.0.1:${candidatePort}`;
const coldRuns = Number(process.env.V4_PERF_RUNS || 5);
const steadySamples = Number(process.env.V4_PERF_FRAMES || 120);
const warmupSamples = 20;
const viewport = { width: 1200, height: 720 };
const round = (value, places = 6) => Number(Number(value).toFixed(places));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: null, maxBuffer: 512 * 1024 * 1024, ...options });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed: ${(result.stderr || Buffer.alloc(0)).toString("utf8")}`);
  return result;
}

function percentile(values, fraction) {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(ordered.length - 1, Math.ceil(ordered.length * fraction) - 1));
  return ordered[index];
}

function stats(values) {
  return {
    samples: values.length,
    minimum: round(Math.min(...values)),
    median: round(percentile(values, 0.5)),
    p95: round(percentile(values, 0.95)),
    maximum: round(Math.max(...values))
  };
}

function regression(baseline, candidate) {
  if (!Number.isFinite(baseline) || baseline === 0) return null;
  return round(((candidate - baseline) / baseline) * 100);
}

async function extractAcceptedTree() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "jq-v4-perf-accepted-"));
  const archive = run("git", ["archive", "--format=tar", V4_PROOF.acceptedCommit], { cwd: root }).stdout;
  run("tar", ["-xf", "-", "-C", directory], { input: archive });
  return directory;
}

function startServer(directory, port) {
  return spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], { cwd: directory, stdio: ["ignore", "pipe", "pipe"] });
}

async function waitForServer(origin) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${origin}/configurator.html`, { cache: "no-store" });
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${origin}.`);
}

function monitorPage(page) {
  const failures = [];
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") failures.push(`console: ${message.text()}`); });
  page.on("requestfailed", (request) => failures.push(`request: ${request.url()} ${request.failure()?.errorText || "failed"}`));
  page.on("response", (response) => { if (response.status() >= 400) failures.push(`response: ${response.status()} ${response.url()}`); });
  return failures;
}

async function installAcceptedControllerCapture(page) {
  await page.evaluate(async () => {
    const module = await import("./guided-layout-viewer.js?v=immersive-layout-configurator-v1");
    const prototype = module.GuidedLayoutViewerController.prototype;
    if (prototype.__jqV4PerfWrapped) return;
    const originalMount = prototype.mount;
    Object.defineProperty(prototype, "__jqV4PerfWrapped", { value: true });
    prototype.mount = function (...args) {
      globalThis.__JQ_V4_PERF_ACCEPTED_CONTROLLER__ = this;
      return originalMount.apply(this, args);
    };
  });
}

async function openAccepted(page, layoutId) {
  const wallStarted = performance.now();
  await page.goto(`${acceptedOrigin}/configurator.html?start=new&renderer=webgl2`, { waitUntil: "domcontentloaded" });
  await installAcceptedControllerCapture(page);
  await page.locator('[data-product-choice="cabinet-shelves"]').click();
  await page.locator("[data-continue]").click();
  await page.locator(`[data-layout="${layoutId}"]`).click();
  await page.locator("[data-continue]").click();
  await page.waitForFunction((id) => {
    const controller = globalThis.__JQ_V4_PERF_ACCEPTED_CONTROLLER__;
    return controller?.state === "ready" && controller.layoutId === id;
  }, layoutId, { timeout: 30000 });
  return { wallMilliseconds: performance.now() - wallStarted };
}

async function openV4(page, layoutId, diagnosticId = "proof-light") {
  const wallStarted = performance.now();
  await page.goto(`${candidateOrigin}/configurator.html?authorityProof=configurator-v4&renderer=webgl2&diagnostic=${diagnosticId}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => globalThis.__JQ_CONFIGURATOR_V4__?.ready(), null, { timeout: 30000 });
  await page.evaluate(() => globalThis.__JQ_CONFIGURATOR_V4__.navigate(2));
  await page.locator(`input[name="layout"][value="${layoutId}"]`).check();
  await page.waitForFunction((id) => globalThis.__JQ_CONFIGURATOR_V4__?.ready() && globalThis.__JQ_CONFIGURATOR_V4__.getViewerDiagnostics()?.layoutId === id, layoutId, { timeout: 30000 });
  return { wallMilliseconds: performance.now() - wallStarted };
}

async function readDiagnostics(page, variant) {
  return page.evaluate((kind) => kind === "accepted"
    ? globalThis.__JQ_V4_PERF_ACCEPTED_CONTROLLER__.getDiagnostics()
    : globalThis.__JQ_CONFIGURATOR_V4__.getViewerDiagnostics(), variant);
}

async function benchmarkFrames(page, variant) {
  return page.evaluate(async ({ variant, viewport, warmupSamples, steadySamples }) => {
    const controller = variant === "accepted"
      ? globalThis.__JQ_V4_PERF_ACCEPTED_CONTROLLER__
      : globalThis.__JQ_CONFIGURATOR_V4__.getCaptureController();
    controller.cancelCameraAnimation();
    controller.cancelRender();
    const runtime = controller.runtime;
    Object.assign(runtime.style, { position: "fixed", inset: "0 auto auto 0", width: `${viewport.width}px`, height: `${viewport.height}px`, zIndex: "2147483647" });
    document.body.append(runtime);
    controller.resize();
    controller.cancelRender();
    controller.renderer.toneMappingExposure = 1.07;
    controller.theta = 0;
    controller.phi = 0.1;
    controller.radius = controller.resolveFitRadius(controller.theta, controller.phi);
    controller.cameraTarget.fromArray(controller.layout.orbitTarget);
    controller.userAdjustedCamera = true;
    controller.updateCamera();
    const gl = controller.renderer.getContext();
    const render = async () => {
      const started = performance.now();
      await controller.renderNow();
      gl.finish();
      return performance.now() - started;
    };
    controller.requestShadowRefresh();
    const firstShadowMilliseconds = await render();
    const firstShadowInfo = { ...controller.renderer.info.render };
    for (let index = 0; index < warmupSamples; index += 1) {
      controller.theta = -0.18 + 0.36 * (index / Math.max(1, warmupSamples - 1));
      controller.updateCamera();
      await render();
    }
    const wall = [];
    const renderer = [];
    for (let index = 0; index < steadySamples; index += 1) {
      controller.theta = -0.22 + 0.44 * ((index % 60) / 59);
      controller.updateCamera();
      wall.push(await render());
      renderer.push(controller.lastFrameMilliseconds);
    }
    const diagnostics = controller.getDiagnostics();
    return {
      firstShadowMilliseconds,
      firstShadowInfo,
      steadyWallMilliseconds: wall,
      steadyRendererMilliseconds: renderer,
      rendererInfo: diagnostics.rendererInfo,
      ownership: diagnostics.ownership,
      shadowBudget: controller.shadowPrimitiveBudget,
      animationLoops: diagnostics.ownership.animationLoops,
      activeRafCallbacks: diagnostics.ownership.activeRafCallbacks
    };
  }, { variant, viewport, warmupSamples, steadySamples });
}

async function coldRun(browser, variant, layoutId, runIndex) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, serviceWorkers: "block", reducedMotion: "reduce", locale: "en-US", timezoneId: "America/New_York" });
  const page = await context.newPage();
  const failures = monitorPage(page);
  const open = variant === "accepted" ? await openAccepted(page, layoutId) : await openV4(page, layoutId);
  const diagnostics = await readDiagnostics(page, variant);
  const record = {
    variant,
    layoutId,
    runIndex,
    pageOpenWallMilliseconds: round(open.wallMilliseconds),
    viewerFirstUsableMilliseconds: diagnostics.firstUsableMilliseconds,
    calls: diagnostics.rendererInfo.calls,
    triangles: diagnostics.rendererInfo.triangles,
    geometries: diagnostics.rendererInfo.geometries,
    materials: diagnostics.rendererInfo.materials,
    textures: diagnostics.rendererInfo.textures,
    renderTargets: diagnostics.rendererInfo.renderTargets,
    ownership: diagnostics.ownership,
    failures
  };
  await context.close();
  return record;
}

async function steadyRun(browser, variant, layoutId) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, serviceWorkers: "block", reducedMotion: "reduce", locale: "en-US", timezoneId: "America/New_York" });
  const page = await context.newPage();
  const failures = monitorPage(page);
  if (variant === "accepted") await openAccepted(page, layoutId);
  else await openV4(page, layoutId);
  const frame = await benchmarkFrames(page, variant);
  await context.close();
  return {
    variant,
    layoutId,
    firstShadowMilliseconds: round(frame.firstShadowMilliseconds),
    firstShadowInfo: frame.firstShadowInfo,
    steadyWall: stats(frame.steadyWallMilliseconds),
    steadyRenderer: stats(frame.steadyRendererMilliseconds),
    rendererInfo: frame.rendererInfo,
    ownership: frame.ownership,
    shadowBudget: frame.shadowBudget,
    animationLoops: frame.animationLoops,
    activeRafCallbacks: frame.activeRafCallbacks,
    failures
  };
}

async function resourceSwitchRun(browser) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, serviceWorkers: "block", reducedMotion: "reduce" });
  const page = await context.newPage();
  const failures = monitorPage(page);
  await openV4(page, "fireplace-wall");
  const sequence = [];
  for (const layoutId of ["fireplace-wall", "door-wall", "window-wall", "fireplace-wall"]) {
    if (sequence.length) {
      await page.evaluate(() => globalThis.__JQ_CONFIGURATOR_V4__.navigate(2));
      await page.locator(`input[name="layout"][value="${layoutId}"]`).check();
      await page.waitForFunction((id) => globalThis.__JQ_CONFIGURATOR_V4__?.ready() && globalThis.__JQ_CONFIGURATOR_V4__.getViewerDiagnostics()?.layoutId === id, layoutId, { timeout: 30000 });
    }
    const diagnostics = await readDiagnostics(page, "v4");
    sequence.push({ layoutId, rendererInfo: diagnostics.rendererInfo, ownership: diagnostics.ownership, resourceDisposalCount: diagnostics.resourceDisposalCount, layoutSwitchCount: diagnostics.layoutSwitchCount });
  }
  const first = sequence[0].rendererInfo;
  const last = sequence.at(-1).rendererInfo;
  const growth = Object.fromEntries(["geometries", "materials", "textures", "renderTargets"].map((key) => [key, round((last[key] - first[key]) / Math.max(1, first[key]))]));
  await context.close();
  return { sequence, revisitGrowthFractions: growth, failures };
}

function groupCold(records, variant, layoutId) {
  const selected = records.filter((record) => record.variant === variant && record.layoutId === layoutId);
  return {
    viewerFirstUsable: stats(selected.map(({ viewerFirstUsableMilliseconds }) => viewerFirstUsableMilliseconds)),
    pageOpenWall: stats(selected.map(({ pageOpenWallMilliseconds }) => pageOpenWallMilliseconds)),
    calls: [...new Set(selected.map(({ calls }) => calls))],
    triangles: [...new Set(selected.map(({ triangles }) => triangles))],
    failures: selected.flatMap(({ failures }) => failures)
  };
}

async function main() {
  assert(Number.isInteger(coldRuns) && coldRuns > 0, "V4_PERF_RUNS must be a positive integer.");
  assert(Number.isInteger(steadySamples) && steadySamples >= 120, "V4_PERF_FRAMES must be at least 120.");
  await mkdir(outputRoot, { recursive: true });
  const acceptedDirectory = await extractAcceptedTree();
  const acceptedServer = startServer(acceptedDirectory, acceptedPort);
  const candidateServer = startServer(root, candidatePort);
  try {
    await Promise.all([waitForServer(acceptedOrigin), waitForServer(candidateOrigin)]);
    const browser = await chromium.launch({ headless: true, args: ["--force-color-profile=srgb"] });
    try {
      const cold = [];
      for (const variant of ["accepted", "v4"]) for (const layout of LAYOUTS) for (let runIndex = 0; runIndex < coldRuns; runIndex += 1) {
        cold.push(await coldRun(browser, variant, layout.id, runIndex));
      }
      const steady = [];
      for (const variant of ["accepted", "v4"]) for (const layout of LAYOUTS) steady.push(await steadyRun(browser, variant, layout.id));
      const resourceSwitch = await resourceSwitchRun(browser);
      const comparisons = LAYOUTS.map((layout) => {
        const acceptedCold = groupCold(cold, "accepted", layout.id);
        const v4Cold = groupCold(cold, "v4", layout.id);
        const acceptedSteady = steady.find((entry) => entry.variant === "accepted" && entry.layoutId === layout.id);
        const v4Steady = steady.find((entry) => entry.variant === "v4" && entry.layoutId === layout.id);
        return {
          layoutId: layout.id,
          accepted: { cold: acceptedCold, steady: acceptedSteady },
          v4: { cold: v4Cold, steady: v4Steady },
          regressionPercent: {
            coldFirstUsableMedian: regression(acceptedCold.viewerFirstUsable.median, v4Cold.viewerFirstUsable.median),
            coldFirstUsableP95: regression(acceptedCold.viewerFirstUsable.p95, v4Cold.viewerFirstUsable.p95),
            steadyWallMedian: regression(acceptedSteady.steadyWall.median, v4Steady.steadyWall.median),
            steadyWallP95: regression(acceptedSteady.steadyWall.p95, v4Steady.steadyWall.p95),
            steadyRendererMedian: regression(acceptedSteady.steadyRenderer.median, v4Steady.steadyRenderer.median),
            steadyRendererP95: regression(acceptedSteady.steadyRenderer.p95, v4Steady.steadyRenderer.p95)
          }
        };
      });
      const allFailures = [...cold.flatMap(({ failures }) => failures), ...steady.flatMap(({ failures }) => failures), ...resourceSwitch.failures];
      const hardGates = {
        atLeastFiveColdRunsPerVariantAndLayout: coldRuns >= 5,
        coldReadyAtMost5000Milliseconds: cold.every(({ viewerFirstUsableMilliseconds }) => viewerFirstUsableMilliseconds <= 5000),
        projectedAndObservedDrawCallsAtMost250: steady.every((entry) => Math.max(entry.firstShadowInfo.calls || 0, entry.shadowBudget?.projectedMaximumDrawCalls || 0, entry.rendererInfo.calls || 0) <= 250),
        trianglesAtMost30000: steady.every(({ rendererInfo }) => rendererInfo.triangles <= 30000),
        resourceRevisitGrowthAtMost15Percent: Object.values(resourceSwitch.revisitGrowthFractions).every((value) => value <= 0.15),
        exactlyOneViewerOwnerAndNoActiveRafAfterSampling: steady.every(({ ownership, animationLoops, activeRafCallbacks }) => ownership.canvases === 1 && ownership.renderers === 1 && ownership.parsedRoots === 1 && animationLoops === 0 && activeRafCallbacks === 0),
        consolePageNetworkErrors: allFailures.length === 0
      };
      const report = {
        schema: "jq-configurator-authority-v4-performance-v1",
        status: Object.values(hardGates).every(Boolean) ? "PASS" : "FAIL",
        accepted: { commit: V4_PROOF.acceptedCommit, tree: V4_PROOF.acceptedTree, archiveDirectory: acceptedDirectory },
        candidate: { root, branch: "codex/configurator-authority-v4" },
        protocol: {
          browser: chromium.executablePath(),
          backend: "webgl2",
          viewport,
          devicePixelRatio: 1,
          coldBrowserContextsPerVariantAndLayout: coldRuns,
          warmupFrames: warmupSamples,
          controlledSteadyFrames: steadySamples,
          gpuCompletion: "WebGL2RenderingContext.finish() after each renderNow()",
          firstShadowFrameReportedSeparately: true,
          hardBudgets: { coldReadyMilliseconds: 5000, drawCalls: 250, triangles: 30000, resourceRevisitGrowthFraction: 0.15 },
          frameRegressionPolicy: "reported exactly; no new percentage threshold invented by V4"
        },
        hardGates,
        comparisons,
        resourceSwitch,
        rawColdRuns: cold,
        failures: allFailures
      };
      await writeFile(path.join(outputRoot, "performance-report.json"), `${JSON.stringify(report, null, 2)}\n`);
      process.stdout.write(`performance ${report.status}: ${coldRuns} cold runs/layout/variant, ${steadySamples} controlled frames; ${allFailures.length} browser failures\n`);
      if (report.status !== "PASS") process.exitCode = 1;
    } finally {
      await browser.close();
    }
  } finally {
    acceptedServer.kill("SIGTERM");
    candidateServer.kill("SIGTERM");
  }
}

await main();
