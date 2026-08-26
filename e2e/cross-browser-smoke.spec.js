import { devices, test, expect } from "@playwright/test";
import { IMMERSIVE_LAYOUT_REGISTRY, getImmersiveLayout } from "../guided-layout-registry.js";

const PUBLIC_ROUTES = [
  "index.html",
  "configurator.html?start=new",
  "how-it-works.html",
  "materials.html",
  "inspiration.html",
  "about.html",
  "faq.html",
  "request-quote.html",
  "privacy.html",
  "terms.html"
];

function monitorRuntime(page) {
  const failures = [];
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console: ${message.text()}`);
  });
  page.on("requestfailed", (request) => {
    failures.push(`request: ${request.url()} ${request.failure()?.errorText || "failed"}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && !response.url().endsWith("/api/quote")) failures.push(`response: ${response.status()} ${response.url()}`);
  });
  return failures;
}

async function diagnostics(page) {
  return page.evaluate(() => globalThis.__JQ_LAYOUT_VIEWER_DIAGNOSTICS__);
}

async function openCustomization(page, layoutId, query = "") {
  const suffix = query ? `&${query.replace(/^\?/, "")}` : "";
  await page.goto(`configurator.html?start=new${suffix}`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-product-choice="cabinet-shelves"]').click();
  await page.locator("[data-continue]").click();
  await page.locator(`[data-layout="${layoutId}"]`).click();
  await page.locator("[data-continue]").click();
  const runtime = page.locator("[data-layout-viewer]");
  await expect(runtime).toHaveAttribute("data-layout-id", layoutId, { timeout: 30_000 });
  await expect(runtime).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
  return runtime;
}

async function expectExactReadyRuntime(page, layoutId) {
  const expected = IMMERSIVE_LAYOUT_REGISTRY[layoutId];
  const record = await diagnostics(page);
  expect(record.state).toBe("ready");
  expect(record.backend).toBe("webgl2");
  expect(record.assetSha256).toBe(expected.runtimeAsset.sha256);
  expect(record.assetBytes).toBe(expected.runtimeAsset.bytes);
  expect(record.smartDimension.status).toBe("PROVEN");
  expect(record.transformProof.sourceBuffersImmutable).toBe(true);
  expect(record.transformProof.geometryMutationCount).toBe(0);
  expect(record.ownership.canvases).toBe(1);
  expect(record.ownership.renderers).toBe(1);
  expect(record.ownership.controlListenerSets).toBe(1);
  await expect(page.locator("[data-guided-3d-mount] img")).toHaveCount(0);
  return record;
}

async function responsiveMetrics(page) {
  return page.evaluate(() => {
    const viewer = document.querySelector(".immersive-viewer-surface").getBoundingClientRect();
    const main = document.querySelector(".immersive-configurator").getBoundingClientRect();
    const panel = document.querySelector("[data-customization-direct-panel]")?.getBoundingClientRect();
    const actions = document.querySelector(".immersive-viewer-footer").getBoundingClientRect();
    return {
      viewerWidth: viewer.width,
      viewerHeight: viewer.height,
      mainWidth: main.width,
      panelWidth: panel?.width ?? null,
      panelTop: panel?.top ?? null,
      panelBottom: panel?.bottom ?? null,
      actionsTop: actions.top,
      actionsBottom: actions.bottom,
      innerWidth,
      innerHeight,
      scrollWidth: document.documentElement.scrollWidth
    };
  });
}

test("public routes stay runtime-clean and overflow-free in Firefox and WebKit", async ({ page, browserName }) => {
  test.skip(browserName === "chromium", "Chromium has the full immersive acceptance suite.");
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    for (const route of PUBLIC_ROUTES) {
      const routePage = await page.context().newPage();
      const failures = monitorRuntime(routePage);
      await routePage.setViewportSize(viewport);
      const response = await routePage.goto(route, { waitUntil: "domcontentloaded" });
      expect(response?.status(), `${browserName} ${viewport.width}x${viewport.height} ${route}`).toBeLessThan(400);
      await expect(routePage.locator("main#main")).toHaveCount(1);
      await expect(routePage.locator("h1")).toHaveCount(1);
      expect(await routePage.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      expect(failures, `${browserName} ${viewport.width}x${viewport.height} ${route}`).toEqual([]);
      await routePage.close();
    }
  }
});

test("Firefox forced WebGL2 preserves one exact Door Wall controller through direct customization and Review", async ({ page, browserName }) => {
  test.skip(browserName !== "firefox", "Firefox-specific supported-fallback journey.");
  const failures = monitorRuntime(page);
  const runtime = await openCustomization(page, "door-wall", "renderer=webgl2");
  const initial = await expectExactReadyRuntime(page, "door-wall");
  expect(initial.rendererFallbackReason).toMatch(/explicitly forced/i);
  await expect(page.locator("[data-dimension-handle]")).toBeHidden();
  await expect(page.locator("[data-smart-dimension], [data-customization-mode-control]")).toHaveCount(0);
  await page.locator("[data-edit-fit]").click();
  await page.locator('[data-measurement="doorWidth"]').fill("40");
  await page.locator('[data-measurement="doorWidth"]').blur();
  await page.locator("[data-save-fit]").click();
  await page.locator('[data-detail-key="doorStyle"][data-detail="slab"]').click();
  await page.locator('[data-detail-key="lighting"][data-detail="warm-led"]').click();
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Review your project details" })).toBeVisible();
  await expect(page.locator(".project-summary-card")).toContainText("Door Wall");
  await expect(page.locator(".project-summary-card")).not.toContainText("Adjustable shelf clearance");
  await expect(page.locator('[data-summary-value="doorWidth"]')).toHaveText("40 in");
  await expect(page.locator('[data-summary-value="doorStyle"]')).toHaveText("Slab");
  await expect(page.locator('[data-summary-value="lighting"]')).toHaveText("Warm LED");
  await expect(page.locator("[data-guided-engine-status]")).toBeHidden();
  await expect(runtime).toHaveAttribute("data-state", "ready");
  expect((await diagnostics(page)).instanceId).toBe(initial.instanceId);
  expect(failures).toEqual([]);
});

test("WebKit automatic fallback keeps the direct panel responsive from desktop through short mobile", async ({ page, browserName }) => {
  test.skip(browserName !== "webkit", "WebKit-specific fallback and responsive matrix.");
  const failures = monitorRuntime(page);
  let modelRequests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.endsWith("/assets/models/room4/jq-window-wall-bookcases-cabinets-room4-authoritative-v01.glb")) modelRequests += 1;
  });
  await openCustomization(page, "window-wall");
  const initial = await expectExactReadyRuntime(page, "window-wall");
  expect(initial.rendererFallbackReason).toMatch(/WebGPU unavailable|initialization failed/i);
  expect(modelRequests).toBe(1);

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1024, height: 1366 },
    { width: 1024, height: 768 },
    { width: 844, height: 390 }
  ]) {
    await page.setViewportSize(viewport);
    const metrics = await responsiveMetrics(page);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth + 1);
    expect(metrics.viewerWidth).toBeGreaterThan(0);
    expect(metrics.panelWidth).toBeGreaterThan(0);
    expect(metrics.viewerWidth).toBeLessThanOrEqual(metrics.mainWidth + 1);
    expect(metrics.panelWidth).toBeLessThanOrEqual(metrics.mainWidth + 1);
    if (viewport.width >= 900) {
      expect(metrics.actionsTop).toBeGreaterThanOrEqual(0);
      expect(metrics.actionsBottom).toBeLessThanOrEqual(metrics.innerHeight + 1);
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('[data-customization-view="overview"]')).toBeVisible();
  await page.locator("[data-edit-fit]").click();
  await expect(page.locator('[data-customization-view="measurements"]')).toBeVisible();
  expect((await responsiveMetrics(page)).scrollWidth).toBeLessThanOrEqual(391);
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-customization-view="overview"]')).toBeVisible();

  await page.setViewportSize({ width: 320, height: 568 });
  await page.locator("[data-edit-fit]").click();
  const input = page.locator('[data-measurement="wallWidth"]');
  await input.scrollIntoViewIfNeeded();
  await expect(input).toBeVisible();
  const inputBox = await input.boundingBox();
  expect(inputBox.height).toBeGreaterThanOrEqual(44);
  expect(inputBox.y).toBeGreaterThanOrEqual(0);
  expect(inputBox.y + inputBox.height).toBeLessThanOrEqual(568);
  await expect(page.locator('[data-smart-dimension="adjustable-shelf-clearance"]')).toHaveCount(0);
  await expect(page.locator("[data-dimension-handle]")).toBeHidden();
  expect((await diagnostics(page)).instanceId).toBe(initial.instanceId);
  expect(modelRequests).toBe(1);
  expect(failures).toEqual([]);
});

test("iPhone WebKit completes Window Wall parsing with the bounded mobile GLB and survives reload", async ({ browser, browserName }) => {
  test.skip(browserName !== "webkit", "WebKit-specific iPhone model-load regression.");
  const context = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await context.newPage();
  const failures = monitorRuntime(page);
  let mobileRequests = 0;
  let authoritativeRequests = 0;
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path.endsWith("/jq-window-wall-bookcases-cabinets-room4-authoritative-v01-ios-v1.glb")) mobileRequests += 1;
    if (path.endsWith("/jq-window-wall-bookcases-cabinets-room4-authoritative-v01.glb")) authoritativeRequests += 1;
  });

  const runtime = await openCustomization(page, "window-wall", "modelQuality=premium-v1&renderer=webgl2");
  const expected = getImmersiveLayout("window-wall", { userAgent: "iPhone" });
  let record = await diagnostics(page);
  expect(record.state).toBe("ready");
  expect(record.backend).toBe("webgl2");
  expect(record.assetPath).toBe(expected.runtimeAsset.path);
  expect(record.assetSha256).toBe(expected.runtimeAsset.sha256);
  expect(record.assetBytes).toBe(expected.runtimeAsset.bytes);
  expect(record.authoritativeSha256).toBe(expected.authoritativeSource.sha256);
  expect(record.transformProof.sourceBuffersImmutable).toBe(true);
  expect(record.transformProof.geometryMutationCount).toBe(0);
  expect(record.ownership.canvases).toBe(1);
  expect(mobileRequests).toBe(1);
  expect(authoritativeRequests).toBe(0);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(runtime).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
  record = await diagnostics(page);
  expect(record.assetSha256).toBe(expected.runtimeAsset.sha256);
  expect(record.assetBytes).toBe(expected.runtimeAsset.bytes);
  expect(record.ownership.canvases).toBe(1);
  expect(mobileRequests).toBe(2);
  expect(authoritativeRequests).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  expect(failures).toEqual([]);
  await context.close();
});
