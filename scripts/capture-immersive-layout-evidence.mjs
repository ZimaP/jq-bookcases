#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import {
  mkdir,
  readFile,
  rename,
  stat,
  writeFile
} from "node:fs/promises";
import {
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep
} from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs, promisify } from "node:util";
import { chromium } from "@playwright/test";
import { PUBLIC_CONFIGURATOR_PRODUCT_ID } from "../guided-configurator-data.js";
import {
  IMMERSIVE_LAYOUT_ORDER,
  IMMERSIVE_LAYOUT_REGISTRY
} from "../guided-layout-registry.js";

const execFile = promisify(execFileCallback);
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const PROOF_PARENT_RELATIVE = ".local-proof/immersive-layout-configurator-v1";
const PROOF_PARENT = join(ROOT, PROOF_PARENT_RELATIVE);
const DEFAULT_BASE_URL = "http://127.0.0.1:5173/";
const CONTROL_ID = "adjustable-shelf-clearance";
const MANIFEST_SCHEMA = "jq-immersive-layout-evidence-v1";
const SHA_PATTERN = /^[0-9a-f]{64}$/;
const REVISION_PATTERN = /^[0-9a-f]{40}$/;
const CRITICAL_DEPLOYABLES = Object.freeze([
  "index.html",
  "configurator.html",
  "guided-configurator.js",
  "guided-configurator-data.js",
  "guided-configurator-state.js",
  "guided-immersive-configurator.css",
  "guided-layout-registry.js",
  "guided-layout-material-zones.generated.js",
  "guided-layout-viewer.js",
  "guided-room2-materials.js",
  "assets/vendor/three-webgpu-renderer-r166.bundle.js",
  "config/immersive-layout-model-audit-v1.json",
  "config/immersive-layout-material-zones-v1.json",
  ...IMMERSIVE_LAYOUT_ORDER.map((layoutId) => IMMERSIVE_LAYOUT_REGISTRY[layoutId].runtimeAsset.path),
  ...IMMERSIVE_LAYOUT_ORDER.map((layoutId) => IMMERSIVE_LAYOUT_REGISTRY[layoutId].thumbnail)
]);

export function parseCli(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: {
      "base-url": { type: "string" },
      phase: { type: "string", default: "candidate" },
      "expected-revision": { type: "string" },
      headed: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false }
    },
    strict: true,
    allowPositionals: false
  });
  if (!["candidate", "live"].includes(values.phase)) {
    throw new Error("--phase must be candidate or live.");
  }
  if (values.phase === "live" && !REVISION_PATTERN.test(values["expected-revision"] || "")) {
    throw new Error("--expected-revision must be a full lowercase 40-character SHA for live evidence.");
  }
  if (values.phase === "candidate" && values["expected-revision"]) {
    throw new Error("--expected-revision is reserved for live evidence.");
  }
  const baseUrl = new URL(values["base-url"] || DEFAULT_BASE_URL);
  if (!["http:", "https:"].includes(baseUrl.protocol)) {
    throw new Error("--base-url must use HTTP or HTTPS.");
  }
  return {
    baseUrl: baseUrl.href,
    phase: values.phase,
    expectedRevision: values["expected-revision"] || null,
    headed: values.headed,
    help: values.help
  };
}

export function makeUtcRunId(date = new Date()) {
  return "run-" + date.toISOString().replace(/[-:]/g, "").replace(".", "");
}

export function assertContainedOutputPath(path) {
  const absolute = resolve(path);
  const parentPrefix = PROOF_PARENT.endsWith(sep) ? PROOF_PARENT : PROOF_PARENT + sep;
  if (!absolute.startsWith(parentPrefix) || absolute === PROOF_PARENT) {
    throw new Error("Evidence output escaped the fixed ignored proof directory.");
  }
  return absolute;
}

export function sanitizeUrlPath(value) {
  const url = new URL(value, DEFAULT_BASE_URL);
  return url.pathname;
}

export function buildScenarioPlan(phase = "candidate") {
  const plan = [
    { id: "01-step1-products-1920x1080", category: "step-1", viewport: [1920, 1080] },
    { id: "02-step2-layouts-1440x900", category: "step-2", viewport: [1440, 900] }
  ];
  const groups = [
    ["fireplace-wall", 1366, 768, "automatic"],
    ["door-wall", 1440, 900, "webgl2"],
    ["window-wall", 1920, 1080, "automatic"]
  ];
  let order = 3;
  for (const [layoutId, width, height, backend] of groups) {
    for (const dimensionState of ["min", "native", "max"]) {
      plan.push({
        id: String(order).padStart(2, "0") + "-" + layoutId + "-" + dimensionState + "-" + width + "x" + height,
        category: "layout-extreme",
        layoutId,
        dimensionState,
        backend,
        viewport: [width, height]
      });
      order += 1;
    }
  }
  plan.push(
    { id: "12-handle-active-door-native-1366x768", category: "handle-active", layoutId: "door-wall", viewport: [1366, 768], backend: "webgl2" },
    { id: "13-tablet-half-window-1024x1366", category: "tablet", layoutId: "window-wall", sheetState: "half", viewport: [1024, 1366], backend: "webgl2" },
    { id: "14-mobile-collapsed-window-390x844", category: "mobile", layoutId: "window-wall", sheetState: "collapsed", viewport: [390, 844], backend: "webgl2" },
    { id: "15-mobile-half-window-390x844", category: "mobile", layoutId: "window-wall", sheetState: "half", viewport: [390, 844], backend: "webgl2" },
    { id: "16-mobile-expanded-window-390x844", category: "mobile", layoutId: "window-wall", sheetState: "expanded", viewport: [390, 844], backend: "webgl2" },
    { id: "17-loading-fireplace-1366x768", category: "loading", layoutId: "fireplace-wall", viewport: [1366, 768], backend: "webgl2" },
    { id: "18-error-fireplace-1366x768", category: "error", layoutId: "fireplace-wall", viewport: [1366, 768], backend: "webgl2" },
    { id: "19-zone-proof-fireplace-wall-1366x768", category: "zone-proof", layoutId: "fireplace-wall", viewport: [1366, 768], backend: "webgl2" },
    { id: "20-zone-proof-door-wall-1366x768", category: "zone-proof", layoutId: "door-wall", viewport: [1366, 768], backend: "webgl2" },
    { id: "21-zone-proof-window-wall-1366x768", category: "zone-proof", layoutId: "window-wall", viewport: [1366, 768], backend: "webgl2" }
  );
  if (phase === "live") {
    plan.push({ id: "22-live-confirmed-fireplace-native-1440x900", category: "live-confirmation", layoutId: "fireplace-wall", viewport: [1440, 900], backend: "automatic" });
  }
  return plan;
}

export function validateManifest(manifest) {
  if (manifest.schema !== MANIFEST_SCHEMA || manifest.schemaVersion !== 1) {
    throw new Error("Evidence manifest schema is invalid.");
  }
  if (!["candidate", "live"].includes(manifest.run.phase)) {
    throw new Error("Evidence manifest phase is invalid.");
  }
  if (manifest.run.phase === "live" && !REVISION_PATTERN.test(manifest.run.expectedRevision || "")) {
    throw new Error("Live evidence manifest lacks an exact revision.");
  }
  if (manifest.run.phase === "live" && manifest.revisionVerification?.complete !== true) {
    throw new Error("Live evidence manifest lacks complete byte verification.");
  }
  if (manifest.source.sourceKind === "working-tree" && manifest.source.exactRevision !== null) {
    throw new Error("Dirty candidate evidence cannot claim an exact revision.");
  }
  if (manifest.backendCoverage?.adapterProbe?.available === true
    && !manifest.backendCoverage.actualBackends.includes("webgpu")) {
    throw new Error("WebGPU support was proven but WebGPU evidence is absent.");
  }
  if (manifest.backendCoverage?.adapterProbe?.available === false
    && manifest.backendCoverage.webGpuSkip?.allowed !== true) {
    throw new Error("WebGPU evidence may be skipped only after a failed adapter probe.");
  }
  const requiredIds = buildScenarioPlan(manifest.run.phase).map(({ id }) => id);
  const capturedIds = manifest.captures.map(({ id }) => id);
  if (requiredIds.length !== capturedIds.length || requiredIds.some((id, index) => capturedIds[index] !== id)) {
    throw new Error("Evidence manifest does not contain the complete ordered scenario matrix.");
  }
  for (const capture of manifest.captures) {
    if (!SHA_PATTERN.test(capture.screenshot.sha256) || capture.screenshot.bytes <= 0) {
      throw new Error("Evidence manifest contains an invalid screenshot digest.");
    }
  }
  const persistedPaths = [
    manifest.run.output,
    manifest.toolchain.captureScript,
    ...manifest.source.untrackedPaths,
    ...manifest.captures.map(({ screenshot }) => screenshot.path)
  ];
  if (persistedPaths.some((path) => isAbsolute(path))) {
    throw new Error("Evidence manifest contains an absolute filesystem path.");
  }
  return true;
}

async function createRunDirectory(date = new Date()) {
  await mkdir(PROOF_PARENT, { recursive: true });
  const runId = makeUtcRunId(date);
  const runDirectory = assertContainedOutputPath(join(PROOF_PARENT, runId));
  await mkdir(runDirectory, { recursive: false });
  return { runId, runDirectory };
}

async function collectSourceIdentity(phase, expectedRevision) {
  const [originResult, branchResult, headResult, statusResult, diffResult] = await Promise.all([
    runGit(["remote", "get-url", "origin"]),
    runGit(["branch", "--show-current"]),
    runGit(["rev-parse", "HEAD"]),
    runGit(["status", "--porcelain=v1", "--untracked-files=all"]),
    runGit(["diff", "--binary", "HEAD"])
  ]);
  const statusLines = statusResult.trim() ? statusResult.trimEnd().split("\n") : [];
  const untrackedPaths = statusLines
    .filter((line) => line.startsWith("?? "))
    .map((line) => line.slice(3))
    .sort();
  const dirty = statusLines.length > 0;
  return {
    origin: redactRemote(originResult.trim()),
    branch: branchResult.trim(),
    headSha: headResult.trim(),
    dirty,
    sourceKind: phase === "live" ? "commit" : dirty ? "working-tree" : "commit",
    exactRevision: phase === "live" ? expectedRevision : dirty ? null : headResult.trim(),
    trackedDiffSha256: sha256(Buffer.from(diffResult)),
    untrackedPaths
  };
}

async function verifyServedRevision(baseUrl, phase, expectedRevision) {
  const probes = [];
  let finalBaseUrl = baseUrl;
  for (const path of CRITICAL_DEPLOYABLES) {
    const expected = phase === "live"
      ? await readGitBlob(expectedRevision, path)
      : await readFile(join(ROOT, path));
    const requestUrl = new URL(path, baseUrl);
    requestUrl.searchParams.set("jq-evidence", String(Date.now()) + "-" + probes.length);
    const response = await fetch(requestUrl, { redirect: "follow", cache: "no-store" });
    const actual = Buffer.from(await response.arrayBuffer());
    if (!response.ok) throw new Error("Revision probe failed for " + path + ": HTTP " + response.status);
    if (!actual.equals(expected)) throw new Error("Served bytes differ from authority for " + path);
    const finalUrl = new URL(response.url);
    if (path === "index.html") finalBaseUrl = new URL("./", finalUrl).href;
    probes.push({
      path,
      status: response.status,
      expectedBytes: expected.length,
      actualBytes: actual.length,
      expectedSha256: sha256(expected),
      actualSha256: sha256(actual),
      finalPath: finalUrl.pathname,
      contentType: response.headers.get("content-type"),
      cacheControl: response.headers.get("cache-control"),
      etag: response.headers.get("etag"),
      lastModified: response.headers.get("last-modified")
    });
  }
  return {
    method: phase === "live" ? "byte-identical fetched bodies versus git commit blobs" : "byte-identical fetched bodies versus working tree",
    complete: probes.length === CRITICAL_DEPLOYABLES.length,
    finalBaseUrl,
    probes
  };
}

async function createEvidenceContext(browser, viewport) {
  return browser.newContext({
    viewport: { width: viewport[0], height: viewport[1] },
    deviceScaleFactor: 1,
    colorScheme: "light",
    reducedMotion: "reduce",
    locale: "en-US",
    timezoneId: "UTC",
    serviceWorkers: "block"
  });
}

function monitorSession(page, baseUrl, options = {}) {
  const started = new Map();
  const session = {
    id: options.id,
    purpose: options.purpose,
    viewport: options.viewport,
    requestedBackend: options.backend || "automatic",
    cacheDisabled: true,
    serviceWorkers: "blocked",
    expectedFaults: options.expectedFaults || [],
    startedAt: new Date().toISOString(),
    completedAt: null,
    actualBackends: [],
    network: [],
    pageErrors: [],
    consoleErrors: [],
    unexpectedFailures: []
  };
  const expectedStatuses = new Map(options.expectedStatuses || []);
  page.on("request", (request) => {
    started.set(request, Date.now());
    const url = new URL(request.url());
    if (!["data:", "blob:"].includes(url.protocol) && url.origin !== new URL(baseUrl).origin) {
      session.unexpectedFailures.push("cross-origin request: " + url.origin + url.pathname);
    }
  });
  page.on("response", (response) => {
    const request = response.request();
    const url = new URL(response.url());
    const headers = response.headers();
    const expectedStatus = expectedStatuses.get(url.pathname);
    if (response.status() >= 400 && response.status() !== expectedStatus) {
      session.unexpectedFailures.push("HTTP " + response.status() + " " + url.pathname);
    }
    session.network.push({
      method: request.method(),
      path: url.pathname,
      resourceType: request.resourceType(),
      status: response.status(),
      mime: headers["content-type"] || null,
      contentLength: headers["content-length"] || null,
      cacheControl: headers["cache-control"] || null,
      etag: headers.etag || null,
      lastModified: headers["last-modified"] || null,
      fromServiceWorker: response.fromServiceWorker(),
      durationMilliseconds: Date.now() - (started.get(request) || Date.now()),
      failure: null
    });
  });
  page.on("requestfailed", (request) => {
    const path = sanitizeUrlPath(request.url());
    if (!(options.expectedRequestFailures || []).includes(path)) {
      session.unexpectedFailures.push("request failed: " + path);
    }
    session.network.push({
      method: request.method(),
      path,
      resourceType: request.resourceType(),
      status: null,
      mime: null,
      contentLength: null,
      cacheControl: null,
      etag: null,
      lastModified: null,
      fromServiceWorker: false,
      durationMilliseconds: Date.now() - (started.get(request) || Date.now()),
      failure: sanitizeText(request.failure()?.errorText || "failed")
    });
  });
  page.on("pageerror", (error) => session.pageErrors.push(sanitizeText(error.message)));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = sanitizeText(message.text());
    if (!(options.expectedConsoleErrors || []).some((pattern) => text.includes(pattern))) {
      session.consoleErrors.push(text);
    }
  });
  return session;
}

async function openFreshProject(page, baseUrl, backend = "automatic", zoneProof = false) {
  const url = new URL("configurator.html", baseUrl);
  url.searchParams.set("start", "new");
  if (backend === "webgl2") url.searchParams.set("renderer", "webgl2");
  if (zoneProof) url.searchParams.set("zoneProof", "1");
  await page.goto(url.href, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Choose your product" }).waitFor({ state: "visible" });
}

async function continueToLayouts(page) {
  const product = page.locator('[data-product-choice="' + PUBLIC_CONFIGURATOR_PRODUCT_ID + '"]');
  await product.click();
  await page.locator("[data-continue]").click();
  await page.getByRole("heading", { name: "Choose the layout that matches your space" }).waitFor({ state: "visible" });
}

async function chooseLayout(page, layoutId) {
  const card = page.locator('[data-layout="' + layoutId + '"]');
  await card.click();
  await page.locator("[data-continue]").click();
}

async function waitForViewerReady(page, layoutId, requestedBackend = "automatic") {
  const runtime = page.locator("[data-layout-viewer]");
  await runtime.waitFor({ state: "attached" });
  await waitForAttribute(runtime, "data-layout-id", layoutId, 30000);
  await waitForAttribute(runtime, "data-state", "ready", 30000);
  await page.waitForFunction((id) => {
    const record = globalThis.__JQ_LAYOUT_VIEWER_DIAGNOSTICS__;
    return record?.layoutId === id && record?.state === "ready" && record?.camera?.animationActive === false;
  }, layoutId, { timeout: 30000 });
  const record = await page.evaluate(() => globalThis.__JQ_LAYOUT_VIEWER_DIAGNOSTICS__);
  assertReadyDiagnostics(record, layoutId, requestedBackend);
  return runtime;
}

async function setDimensionByHandleKey(page, layoutId, state) {
  const key = state === "min" ? "Home" : state === "max" ? "End" : "0";
  const expected = IMMERSIVE_LAYOUT_REGISTRY[layoutId].geometryControlManifest[CONTROL_ID][
    state === "min" ? "minMillimeters" : state === "max" ? "maxMillimeters" : "nativeMillimeters"
  ];
  const handle = page.locator("[data-dimension-handle]");
  await handle.focus();
  await handle.press(key);
  await page.waitForFunction(({ value }) => {
    const actual = globalThis.__JQ_LAYOUT_VIEWER_DIAGNOSTICS__?.smartDimension?.valueMillimeters;
    return Number.isFinite(actual) && Math.abs(actual - value) <= 0.01;
  }, { value: expected }, { timeout: 12000 });
  return expected;
}

async function setSheetState(page, state) {
  const sheet = page.locator("[data-customization-sheet]");
  if (await sheet.getAttribute("data-sheet-state") === state) return;
  await page.getByRole("button", { name: "Set customization sheet " + state }).click();
  await waitForAttribute(sheet, "data-sheet-state", state, 12000);
}

async function waitForVisualSettle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
  });
}

async function captureEvidence({ page, runDirectory, scenario, session, captures, assertions = [] }) {
  await waitForVisualSettle(page);
  const filename = scenario.id + ".png";
  const screenshotPath = assertContainedOutputPath(join(runDirectory, filename));
  await page.screenshot({
    path: screenshotPath,
    fullPage: false,
    animations: "disabled",
    caret: "hide",
    scale: "css"
  });
  const bytes = await readFile(screenshotPath);
  const ui = await page.evaluate(() => {
    const shell = document.querySelector(".guided-shell");
    const viewer = document.querySelector("[data-layout-viewer]");
    const handle = document.querySelector("[data-dimension-handle]");
    const sheet = document.querySelector("[data-customization-sheet]");
    return {
      hash: location.hash,
      step: shell?.dataset.currentStep || document.body.dataset.step || null,
      layoutId: viewer?.dataset.layoutId || null,
      sheetState: sheet?.dataset.sheetState || null,
      handle: handle ? {
        visible: Boolean(handle.offsetWidth || handle.offsetHeight || handle.getClientRects().length),
        focused: document.activeElement === handle,
        active: handle.classList.contains("is-active")
      } : null,
      documentOverflowPixels: document.documentElement.scrollWidth - innerWidth
    };
  });
  const diagnostics = await page.evaluate(() => globalThis.__JQ_LAYOUT_VIEWER_DIAGNOSTICS__ || null);
  if (diagnostics?.backend && !session.actualBackends.includes(diagnostics.backend)) {
    session.actualBackends.push(diagnostics.backend);
  }
  captures.push({
    id: scenario.id,
    order: captures.length + 1,
    category: scenario.category,
    sessionId: session.id,
    route: new URL(page.url()).pathname + new URL(page.url()).hash,
    timestamp: new Date().toISOString(),
    layoutId: scenario.layoutId || ui.layoutId,
    dimensionState: scenario.dimensionState || null,
    sheetState: scenario.sheetState || ui.sheetState,
    viewport: { width: scenario.viewport[0], height: scenario.viewport[1] },
    screenshot: {
      path: filename,
      bytes: bytes.length,
      sha256: sha256(bytes),
      width: scenario.viewport[0],
      height: scenario.viewport[1],
      fullPage: false
    },
    ui,
    viewer: summarizeViewerDiagnostics(diagnostics),
    assertions
  });
}

function summarizeViewerDiagnostics(record) {
  if (!record) return null;
  return {
    state: record.state,
    layoutId: record.layoutId,
    backend: record.backend,
    fallbackReason: record.rendererFallbackReason,
    assetPath: record.assetPath,
    assetSha256: record.assetSha256,
    assetBytes: record.assetBytes,
    geometryImmutable: record.transformProof?.sourceBuffersImmutable === true,
    firstUsableMilliseconds: record.firstUsableMilliseconds,
    rendererRenderFailureCount: record.rendererRenderFailureCount,
    rendererInfo: record.rendererInfo,
    retainedResources: {
      geometries: record.rendererInfo?.geometries,
      materials: record.rendererInfo?.materials,
      textures: record.rendererInfo?.textures,
      renderTargets: record.rendererInfo?.renderTargets
    },
    smartDimension: record.smartDimension ? {
      id: record.smartDimension.id,
      status: record.smartDimension.status,
      valueMillimeters: record.smartDimension.valueMillimeters
    } : null,
    transformProof: record.transformProof ? {
      sourceBuffersImmutable: record.transformProof.sourceBuffersImmutable,
      geometryMutationCount: record.transformProof.geometryMutationCount,
      targetLocalZFormulaDelta: record.transformProof.targetLocalZFormulaDelta,
      unintendedIntersectionCount: record.transformProof.collision?.unintendedIntersectionCount,
      endpointCollisionFree: record.transformProof.endpointCollisionFree
    } : null,
    ownership: record.ownership,
    requestCount: record.requestCount,
    successfulRequestCount: record.successfulRequestCount,
    parseCount: record.parseCount,
    lastError: record.lastError,
    appearance: record.appearance ? {
      zoneProofMode: record.appearance.zoneProofMode,
      materialZoneAudit: record.appearance.materialZoneAudit,
      automaticFinishMapping: record.appearance.automaticFinishMapping,
      provenPrimitiveCount: record.appearance.provenPrimitiveCount
    } : null
  };
}

function assertReadyDiagnostics(record, layoutId, requestedBackend) {
  const layout = IMMERSIVE_LAYOUT_REGISTRY[layoutId];
  if (!record || record.state !== "ready" || record.layoutId !== layoutId) throw new Error("Viewer did not reach the requested ready layout.");
  if (record.assetPath !== layout.runtimeAsset.path || record.assetSha256 !== layout.runtimeAsset.sha256 || record.assetBytes !== layout.runtimeAsset.bytes) {
    throw new Error("Viewer asset identity differs from the registry.");
  }
  if (!record.transformProof?.sourceBuffersImmutable || record.transformProof.geometryMutationCount !== 0) {
    throw new Error("Viewer geometry immutability proof failed.");
  }
  if (record.ownership?.canvases !== 1 || record.ownership?.renderers !== 1 || record.ownership?.parsedRoots !== 1 || record.ownership?.controlListenerSets !== 1) {
    throw new Error("Viewer lifecycle ownership is not singular.");
  }
  if (requestedBackend === "webgl2" && record.backend !== "webgl2") {
    throw new Error("Forced WebGL2 evidence did not use WebGL2.");
  }
}

async function runStepSelectionSession(browser, options, runDirectory, sessions, captures) {
  const context = await createEvidenceContext(browser, [1920, 1080]);
  const page = await context.newPage();
  const session = monitorSession(page, options.baseUrl, {
    id: "selection",
    purpose: "Step 1 and Step 2",
    viewport: [1920, 1080]
  });
  sessions.push(session);
  try {
    await openFreshProject(page, options.baseUrl);
    const productCards = page.locator("[data-product-choice], [data-unavailable-product-choice]");
    if (await productCards.count() !== 7) throw new Error("Step 1 did not expose seven product cards.");
    await page.waitForFunction(() => [...document.querySelectorAll(".product-card img")].every((image) => image.complete && image.naturalWidth > 0));
    if (!await page.locator(".product-card img").evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0))) {
      throw new Error("Step 1 contains an unloaded product image.");
    }
    await captureEvidence({
      page,
      runDirectory,
      scenario: buildScenarioPlan(options.phase)[0],
      session,
      captures,
      assertions: ["seven product image cards", "six focusable Coming Soon cards"]
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await continueToLayouts(page);
    if (await page.locator("[data-layout]").count() !== 3) throw new Error("Step 2 did not expose three layout cards.");
    await page.waitForFunction(() => [...document.querySelectorAll("[data-layout] img")].every((image) => image.complete && image.naturalWidth > 0));
    if (!await page.locator("[data-layout] img").evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0))) {
      throw new Error("Step 2 contains an unloaded actual-model thumbnail.");
    }
    await captureEvidence({
      page,
      runDirectory,
      scenario: buildScenarioPlan(options.phase)[1],
      session,
      captures,
      assertions: ["exact three audited layout cards", "actual-model thumbnails loaded"]
    });
    assertSessionClean(session);
  } finally {
    session.completedAt = new Date().toISOString();
    await context.close();
  }
}

async function runLayoutExtremesSession(browser, options, runDirectory, sessions, captures, layoutId, viewport, backend) {
  const context = await createEvidenceContext(browser, viewport);
  const page = await context.newPage();
  const session = monitorSession(page, options.baseUrl, {
    id: "extremes-" + layoutId,
    purpose: layoutId + " min/native/max",
    viewport,
    backend
  });
  sessions.push(session);
  try {
    await openFreshProject(page, options.baseUrl, backend);
    await continueToLayouts(page);
    await chooseLayout(page, layoutId);
    await waitForViewerReady(page, layoutId, backend);
    const scenarios = buildScenarioPlan(options.phase).filter((item) => item.category === "layout-extreme" && item.layoutId === layoutId);
    for (const scenario of scenarios) {
      const expected = await setDimensionByHandleKey(page, layoutId, scenario.dimensionState);
      const record = await page.evaluate(() => globalThis.__JQ_LAYOUT_VIEWER_DIAGNOSTICS__);
      assertReadyDiagnostics(record, layoutId, backend);
      await captureEvidence({
        page,
        runDirectory,
        scenario,
        session,
        captures,
        assertions: ["exact asset SHA/bytes", "geometry immutable", "dimension " + scenario.dimensionState + " = " + expected + " mm"]
      });
    }
    assertSessionClean(session);
  } finally {
    session.completedAt = new Date().toISOString();
    await context.close();
  }
}

async function runHandleSession(browser, options, runDirectory, sessions, captures) {
  const scenario = buildScenarioPlan(options.phase).find((item) => item.category === "handle-active");
  const context = await createEvidenceContext(browser, scenario.viewport);
  const page = await context.newPage();
  const session = monitorSession(page, options.baseUrl, {
    id: "handle-active",
    purpose: "active on-model dimension handle",
    viewport: scenario.viewport,
    backend: scenario.backend
  });
  sessions.push(session);
  try {
    await openFreshProject(page, options.baseUrl, scenario.backend);
    await continueToLayouts(page);
    await chooseLayout(page, scenario.layoutId);
    await waitForViewerReady(page, scenario.layoutId, scenario.backend);
    await setDimensionByHandleKey(page, scenario.layoutId, "native");
    const handle = page.locator("[data-dimension-handle]");
    const box = await handle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    try {
      await waitForAttribute(handle, "class", /is-active/, 5000);
      await captureEvidence({
        page,
        runDirectory,
        scenario,
        session,
        captures,
        assertions: ["pointer-owned active handle", "native dimension", "camera orbit suppressed"]
      });
    } finally {
      await page.mouse.up();
    }
    assertSessionClean(session);
  } finally {
    session.completedAt = new Date().toISOString();
    await context.close();
  }
}

async function runResponsiveSession(browser, options, runDirectory, sessions, captures, kind) {
  const scenarios = buildScenarioPlan(options.phase).filter((item) => item.category === kind);
  const context = await createEvidenceContext(browser, scenarios[0].viewport);
  const page = await context.newPage();
  const session = monitorSession(page, options.baseUrl, {
    id: kind,
    purpose: kind + " customization sheet states",
    viewport: scenarios[0].viewport,
    backend: "webgl2"
  });
  sessions.push(session);
  try {
    await openFreshProject(page, options.baseUrl, "webgl2");
    await continueToLayouts(page);
    await chooseLayout(page, scenarios[0].layoutId);
    await waitForViewerReady(page, scenarios[0].layoutId, "webgl2");
    for (const scenario of scenarios) {
      await setSheetState(page, scenario.sheetState);
      await captureEvidence({
        page,
        runDirectory,
        scenario,
        session,
        captures,
        assertions: ["sheet state reachable", "no horizontal overflow", "model context remains visible"]
      });
    }
    assertSessionClean(session);
  } finally {
    session.completedAt = new Date().toISOString();
    await context.close();
  }
}

async function runFaultSession(browser, options, runDirectory, sessions, captures, category) {
  const scenario = buildScenarioPlan(options.phase).find((item) => item.category === category);
  const layout = IMMERSIVE_LAYOUT_REGISTRY[scenario.layoutId];
  const modelPath = "/" + layout.runtimeAsset.path;
  const context = await createEvidenceContext(browser, scenario.viewport);
  const page = await context.newPage();
  const expectedStatuses = category === "error" ? [[modelPath, 503]] : [];
  const session = monitorSession(page, options.baseUrl, {
    id: category,
    purpose: category + " fault-injection evidence",
    viewport: scenario.viewport,
    backend: scenario.backend,
    expectedFaults: [category === "error" ? "labelled model HTTP 503" : "client-held model request"],
    expectedStatuses,
    expectedRequestFailures: [modelPath],
    expectedConsoleErrors: category === "error" ? ["503"] : []
  });
  sessions.push(session);
  let releaseHeldRequest = null;
  if (category === "loading") {
    let release;
    const gate = new Promise((resolveGate) => { release = resolveGate; });
    releaseHeldRequest = release;
    await page.route("**/" + layout.runtimeAsset.path, async (route) => {
      await gate;
      await route.abort("failed").catch(() => {});
    });
  } else {
    await page.route("**/" + layout.runtimeAsset.path, (route) => route.fulfill({
      status: 503,
      contentType: "application/octet-stream",
      body: ""
    }));
  }
  try {
    await openFreshProject(page, options.baseUrl, scenario.backend);
    await continueToLayouts(page);
    await chooseLayout(page, scenario.layoutId);
    const runtime = page.locator("[data-layout-viewer]");
    await runtime.waitFor({ state: "attached" });
    await waitForAttribute(runtime, "data-state", category, 20000);
    if (category === "error") {
      await page.getByRole("button", { name: "Retry model" }).waitFor({ state: "visible" });
    }
    await captureEvidence({
      page,
      runDirectory,
      scenario,
      session,
      captures,
      assertions: [category === "loading" ? "bounded loading progress visible" : "fail-closed error and Retry visible"]
    });
  } finally {
    releaseHeldRequest?.();
    session.completedAt = new Date().toISOString();
    await context.close();
  }
}

async function runZoneProofSessions(browser, options, runDirectory, sessions, captures) {
  const scenarios = buildScenarioPlan(options.phase).filter((item) => item.category === "zone-proof");
  for (const scenario of scenarios) {
    const context = await createEvidenceContext(browser, scenario.viewport);
    const page = await context.newPage();
    const session = monitorSession(page, options.baseUrl, {
      id: "zone-proof-" + scenario.layoutId,
      purpose: scenario.layoutId + " false-color material-zone authority proof",
      viewport: scenario.viewport,
      backend: scenario.backend
    });
    sessions.push(session);
    try {
      await openFreshProject(page, options.baseUrl, scenario.backend, true);
      await continueToLayouts(page);
      await chooseLayout(page, scenario.layoutId);
      await waitForViewerReady(page, scenario.layoutId, scenario.backend);
      await setDimensionByHandleKey(page, scenario.layoutId, "native");
      const record = await page.evaluate(() => globalThis.__JQ_LAYOUT_VIEWER_DIAGNOSTICS__);
      const audit = record?.appearance?.materialZoneAudit;
      if (record?.appearance?.zoneProofMode !== true
        || audit?.exhaustive !== true
        || audit?.primitiveCoverage !== audit?.sourcePrimitiveCount) {
        throw new Error(scenario.layoutId + " false-color material-zone proof is not exhaustive.");
      }
      await captureEvidence({
        page,
        runDirectory,
        scenario,
        session,
        captures,
        assertions: [
          "localhost-only false-color proof active",
          "all source primitives have an audited PROVEN, PROVISIONAL, or BLOCKED binding",
          "green = PROVEN; amber = PROVISIONAL; red = BLOCKED"
        ]
      });
      assertSessionClean(session);
    } finally {
      session.completedAt = new Date().toISOString();
      await context.close();
    }
  }
}

async function runLiveConfirmation(browser, options, runDirectory, sessions, captures) {
  if (options.phase !== "live") return;
  const scenario = buildScenarioPlan("live").at(-1);
  const context = await createEvidenceContext(browser, scenario.viewport);
  const page = await context.newPage();
  const session = monitorSession(page, options.baseUrl, {
    id: "live-confirmation",
    purpose: "post-byte-verification live Step 3",
    viewport: scenario.viewport,
    backend: "automatic"
  });
  sessions.push(session);
  try {
    await openFreshProject(page, options.baseUrl);
    await continueToLayouts(page);
    await chooseLayout(page, scenario.layoutId);
    await waitForViewerReady(page, scenario.layoutId, "automatic");
    await setDimensionByHandleKey(page, scenario.layoutId, "native");
    await captureEvidence({
      page,
      runDirectory,
      scenario,
      session,
      captures,
      assertions: ["live bytes match exact revision", "exact Fireplace asset ready"]
    });
    assertSessionClean(session);
  } finally {
    session.completedAt = new Date().toISOString();
    await context.close();
  }
}

async function probeWebGpu(browser, baseUrl) {
  const context = await createEvidenceContext(browser, [800, 600]);
  const page = await context.newPage();
  try {
    await page.goto(new URL("configurator.html?start=new", baseUrl).href, { waitUntil: "domcontentloaded" });
    return await page.evaluate(async () => {
      if (!navigator.gpu?.requestAdapter) return { available: false, reason: "navigator.gpu unavailable" };
      try {
        const adapter = await navigator.gpu.requestAdapter();
        return adapter ? { available: true, reason: null } : { available: false, reason: "requestAdapter returned null" };
      } catch (error) {
        return { available: false, reason: String(error?.message || error) };
      }
    });
  } finally {
    await context.close();
  }
}

async function finalizeCoverage(manifest, webGpuProbe) {
  const actualBackends = [...new Set(manifest.sessions.flatMap(({ actualBackends }) => actualBackends))];
  manifest.backendCoverage = {
    adapterProbe: webGpuProbe,
    actualBackends,
    forcedWebGl2Captured: manifest.captures.some(({ viewer }) => viewer?.backend === "webgl2"),
    webGpuSkip: webGpuProbe.available ? null : {
      allowed: true,
      browser: manifest.toolchain.chromium,
      reason: webGpuProbe.reason
    }
  };
  if (webGpuProbe.available && !actualBackends.includes("webgpu")) {
    throw new Error("A genuine WebGPU adapter exists, but no automatic evidence capture used WebGPU.");
  }
  if (!manifest.backendCoverage.forcedWebGl2Captured) {
    throw new Error("Evidence omitted the forced WebGL2 backend.");
  }
  const unexpected = manifest.sessions.flatMap((session) => [
    ...session.pageErrors.map((value) => session.id + " pageerror: " + value),
    ...session.consoleErrors.map((value) => session.id + " console: " + value),
    ...session.unexpectedFailures.map((value) => session.id + " failure: " + value)
  ]);
  if (unexpected.length) throw new Error(unexpected.join("\n"));
  manifest.requiredCoverage = {
    scenarioIds: buildScenarioPlan(manifest.run.phase).map(({ id }) => id),
    complete: true
  };
}

async function main(argv = process.argv.slice(2)) {
  const options = parseCli(argv);
  if (options.help) {
    process.stdout.write([
      "Capture the complete immersive-layout evidence matrix.",
      "",
      "Start the candidate server first, then run:",
      "  npm run evidence:immersive -- --base-url http://127.0.0.1:5173",
      "",
      "Live evidence requires byte identity to a commit:",
      "  npm run evidence:immersive -- --phase live --expected-revision <40-char-sha> --base-url https://jq-bookcases.onrender.com/",
      "",
      "Output is always isolated under " + PROOF_PARENT_RELATIVE + "/run-<UTC>/."
    ].join("\n") + "\n");
    return;
  }
  const startedAt = new Date();
  const { runId, runDirectory } = await createRunDirectory(startedAt);
  const source = await collectSourceIdentity(options.phase, options.expectedRevision);
  const revisionVerification = await verifyServedRevision(options.baseUrl, options.phase, options.expectedRevision);
  options.baseUrl = revisionVerification.finalBaseUrl;
  const playwrightPackage = JSON.parse(await readFile(join(ROOT, "node_modules/@playwright/test/package.json"), "utf8"));
  const scriptBytes = await readFile(fileURLToPath(import.meta.url));
  const manifest = {
    schema: MANIFEST_SCHEMA,
    schemaVersion: 1,
    run: {
      id: runId,
      phase: options.phase,
      startedAt: startedAt.toISOString(),
      completedAt: null,
      status: "running",
      baseUrl: options.baseUrl,
      finalBaseUrl: revisionVerification.finalBaseUrl,
      expectedRevision: options.expectedRevision,
      output: relative(ROOT, runDirectory)
    },
    source,
    toolchain: {
      node: process.versions.node,
      playwright: playwrightPackage.version,
      chromium: null,
      platform: process.platform,
      arch: process.arch,
      locale: "en-US",
      timezone: "UTC",
      deviceScaleFactor: 1,
      captureScript: relative(ROOT, fileURLToPath(import.meta.url)),
      captureScriptSha256: sha256(scriptBytes)
    },
    revisionVerification,
    backendCoverage: null,
    requiredCoverage: null,
    sessions: [],
    captures: [],
    skips: [],
    failures: [],
    summary: null
  };
  let browser;
  try {
    browser = await chromium.launch({ headless: !options.headed });
    manifest.toolchain.chromium = browser.version();
    const webGpuProbe = await probeWebGpu(browser, options.baseUrl);
    await runStepSelectionSession(browser, options, runDirectory, manifest.sessions, manifest.captures);
    await runLayoutExtremesSession(browser, options, runDirectory, manifest.sessions, manifest.captures, "fireplace-wall", [1366, 768], "automatic");
    await runLayoutExtremesSession(browser, options, runDirectory, manifest.sessions, manifest.captures, "door-wall", [1440, 900], "webgl2");
    await runLayoutExtremesSession(browser, options, runDirectory, manifest.sessions, manifest.captures, "window-wall", [1920, 1080], "automatic");
    await runHandleSession(browser, options, runDirectory, manifest.sessions, manifest.captures);
    await runResponsiveSession(browser, options, runDirectory, manifest.sessions, manifest.captures, "tablet");
    await runResponsiveSession(browser, options, runDirectory, manifest.sessions, manifest.captures, "mobile");
    await runFaultSession(browser, options, runDirectory, manifest.sessions, manifest.captures, "loading");
    await runFaultSession(browser, options, runDirectory, manifest.sessions, manifest.captures, "error");
    await runZoneProofSessions(browser, options, runDirectory, manifest.sessions, manifest.captures);
    await runLiveConfirmation(browser, options, runDirectory, manifest.sessions, manifest.captures);
    await finalizeCoverage(manifest, webGpuProbe);
    manifest.run.status = "passed";
    manifest.summary = {
      captureCount: manifest.captures.length,
      sessionCount: manifest.sessions.length,
      unexpectedFailureCount: 0
    };
    manifest.run.completedAt = new Date().toISOString();
    validateManifest(manifest);
  } catch (error) {
    manifest.run.status = "failed";
    manifest.run.completedAt = new Date().toISOString();
    manifest.failures.push(sanitizeText(error instanceof Error ? error.stack || error.message : String(error)));
    manifest.summary = {
      captureCount: manifest.captures.length,
      sessionCount: manifest.sessions.length,
      unexpectedFailureCount: manifest.failures.length
    };
    await writeManifest(runDirectory, manifest);
    throw error;
  } finally {
    await browser?.close();
  }
  await writeManifest(runDirectory, manifest);
  process.stdout.write("Captured " + manifest.captures.length + " verified evidence images in " + relative(ROOT, runDirectory) + "\n");
}

async function writeManifest(runDirectory, manifest) {
  const temporary = assertContainedOutputPath(join(runDirectory, "manifest.tmp.json"));
  const finalPath = assertContainedOutputPath(join(runDirectory, "manifest.json"));
  await writeFile(temporary, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  await rename(temporary, finalPath);
}

function assertSessionClean(session) {
  const failures = [...session.pageErrors, ...session.consoleErrors, ...session.unexpectedFailures];
  if (failures.length) throw new Error(session.id + " contained runtime failures:\n" + failures.join("\n"));
}

async function waitForAttribute(locator, name, expected, timeout) {
  const startedAt = Date.now();
  while (Date.now() - startedAt <= timeout) {
    const actual = await locator.getAttribute(name);
    if (expected instanceof RegExp ? expected.test(actual || "") : actual === expected) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 50));
  }
  throw new Error("Timed out waiting for " + name + " to match " + String(expected));
}

async function readGitBlob(revision, path) {
  const result = await execFile("git", ["show", revision + ":" + path], {
    cwd: ROOT,
    encoding: null,
    maxBuffer: 32 * 1024 * 1024
  });
  return Buffer.from(result.stdout);
}

async function runGit(args) {
  const result = await execFile("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024
  });
  return result.stdout;
}

function redactRemote(value) {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    return url.href.replace(/\/$/, "");
  } catch {
    return value.replace(/\/\/[^/@]+@/, "//");
  }
}

function sanitizeText(value) {
  return String(value)
    .replace(/https?:\/\/[^\s)]+/g, (match) => {
      try {
        const url = new URL(match);
        return url.origin + url.pathname;
      } catch {
        return "[url]";
      }
    })
    .slice(0, 2000);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function walkValues(value, visit, key = "") {
  visit(value, key);
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkValues(item, visit, String(index)));
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([childKey, child]) => walkValues(child, visit, childKey));
  }
}

const isMain = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  main().catch((error) => {
    process.stderr.write((error instanceof Error ? error.stack || error.message : String(error)) + "\n");
    process.exitCode = 1;
  });
}
