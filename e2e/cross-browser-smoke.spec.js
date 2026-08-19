import { test, expect } from "@playwright/test";
import { IMMERSIVE_LAYOUT_REGISTRY } from "../guided-layout-registry.js";

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
    const sheet = document.querySelector("[data-customization-sheet]").getBoundingClientRect();
    const actions = document.querySelector(".immersive-sticky-actions").getBoundingClientRect();
    return {
      viewerWidth: viewer.width,
      viewerHeight: viewer.height,
      mainWidth: main.width,
      sheetBottom: sheet.bottom,
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

test("Firefox forced WebGL2 preserves one exact Door Wall controller through Review", async ({ page, browserName }) => {
  test.skip(browserName !== "firefox", "Firefox-specific supported-fallback journey.");
  const failures = monitorRuntime(page);
  const runtime = await openCustomization(page, "door-wall", "renderer=webgl2");
  const initial = await expectExactReadyRuntime(page, "door-wall");
  expect(initial.rendererFallbackReason).toMatch(/explicitly forced/i);
  const handle = page.locator("[data-dimension-handle]");
  await handle.focus();
  await handle.press("End");
  await expect(handle).toHaveAttribute(
    "aria-valuenow",
    String(IMMERSIVE_LAYOUT_REGISTRY["door-wall"].geometryControlManifest["adjustable-shelf-clearance"].maxMillimeters)
  );
  await page.getByRole("tab", { name: "Finish" }).click();
  await page.getByRole("button", { name: "Charcoal", exact: true }).click();
  await expect(page.getByRole("button", { name: "Charcoal", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#finish-mapping-status")).toContainText(/saved for design review/i);
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Review your project details" })).toBeVisible();
  await expect(page.locator(".project-summary-card")).toContainText("Door Wall");
  await expect(page.locator(".project-summary-card")).toContainText("Adjustable shelf clearance");
  await expect(page.locator(".project-summary-card")).toContainText("Charcoal");
  await expect(page.locator("[data-guided-engine-status]")).toBeHidden();
  await expect(runtime).toHaveAttribute("data-state", "ready");
  expect((await diagnostics(page)).instanceId).toBe(initial.instanceId);
  expect(failures).toEqual([]);
});

test("WebKit automatic fallback remains responsive from desktop through short mobile", async ({ page, browserName }) => {
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
    { width: 1440, height: 900, widthRatio: 0.7 },
    { width: 1024, height: 1366, heightRatio: 0.56 },
    { width: 1024, height: 768, heightRatio: 0.56, actionsVisible: true },
    { width: 844, height: 390, heightRatio: 0.56, actionsVisible: true }
  ]) {
    await page.setViewportSize(viewport);
    const metrics = await responsiveMetrics(page);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth + 1);
    if (viewport.widthRatio) expect(metrics.viewerWidth / metrics.mainWidth).toBeGreaterThanOrEqual(viewport.widthRatio);
    if (viewport.heightRatio) expect(metrics.viewerHeight / metrics.innerHeight).toBeGreaterThanOrEqual(viewport.heightRatio);
    if (viewport.actionsVisible) {
      expect(metrics.actionsTop).toBeGreaterThanOrEqual(0);
      expect(metrics.actionsBottom).toBeLessThanOrEqual(metrics.innerHeight + 1);
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  for (const state of ["collapsed", "half", "expanded"]) {
    await page.getByRole("button", { name: `Set customization sheet ${state}` }).click();
    const metrics = await responsiveMetrics(page);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth + 1);
    expect(metrics.sheetBottom).toBeLessThanOrEqual(metrics.innerHeight + 1);
    if (state === "half") {
      expect(metrics.viewerHeight / metrics.innerHeight).toBeGreaterThanOrEqual(0.52);
      expect(metrics.viewerHeight / metrics.innerHeight).toBeLessThanOrEqual(0.58);
    }
  }
  await expect(page.locator("[data-customization-sheet]")).toHaveAttribute("role", "dialog");
  await expect(page.getByRole("tab", { selected: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-customization-sheet]")).toHaveAttribute("data-sheet-state", "half");

  await page.setViewportSize({ width: 320, height: 568 });
  await page.getByRole("button", { name: "Set customization sheet collapsed" }).click();
  await page.locator("[data-dimension-handle]").click();
  const input = page.locator('[data-smart-dimension="adjustable-shelf-clearance"]');
  await expect(page.locator("[data-customization-sheet]")).toHaveAttribute("data-sheet-state", "expanded");
  await expect(input).toBeFocused();
  const inputBox = await input.boundingBox();
  expect(inputBox.height).toBeGreaterThanOrEqual(44);
  expect(inputBox.y).toBeGreaterThanOrEqual(0);
  expect(inputBox.y + inputBox.height).toBeLessThanOrEqual(568);
  expect((await diagnostics(page)).instanceId).toBe(initial.instanceId);
  expect(modelRequests).toBe(1);
  expect(failures).toEqual([]);
});
