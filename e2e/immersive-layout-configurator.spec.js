import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { PRODUCT_CHOICES, PUBLIC_CONFIGURATOR_PRODUCT_ID } from "../guided-configurator-data.js";
import {
  IMMERSIVE_LAYOUT_ORDER,
  IMMERSIVE_LAYOUT_REGISTRY,
  millimetersToInches
} from "../guided-layout-registry.js";

const CONTROL_ID = "adjustable-shelf-clearance";
const MODEL_PATH_PATTERN = /\/assets\/models\/room(?:2|4)\/.*\.glb$/;

function monitorUnexpectedFailures(page) {
  const failures = [];
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console: ${message.text()}`);
  });
  page.on("requestfailed", (request) => failures.push(`request: ${request.url()} ${request.failure()?.errorText || "failed"}`));
  page.on("response", (response) => {
    if (response.status() >= 400 && !response.url().endsWith("/api/quote")) failures.push(`response: ${response.status()} ${response.url()}`);
  });
  return failures;
}

async function openFreshProject(page, query = "") {
  const suffix = query ? `&${query.replace(/^\?/, "")}` : "";
  await page.goto(`configurator.html?start=new${suffix}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Choose your product" })).toBeVisible();
  await expect(page).toHaveURL(/#step-1$/);
}

async function continueToLayouts(page) {
  const product = page.locator(`[data-product-choice="${PUBLIC_CONFIGURATOR_PRODUCT_ID}"]`);
  await product.click();
  await expect(product).toHaveAttribute("aria-pressed", "true");
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Choose the layout that matches your space" })).toBeVisible();
}

async function chooseLayout(page, layoutId) {
  const card = page.locator(`[data-layout="${layoutId}"]`);
  await card.click();
  await expect(card).toHaveAttribute("aria-pressed", "true");
}

async function waitForViewerReady(page, layoutId) {
  const runtime = page.locator("[data-layout-viewer]");
  await expect(runtime).toHaveAttribute("data-layout-id", layoutId, { timeout: 25_000 });
  await expect(runtime).toHaveAttribute("data-state", "ready", { timeout: 25_000 });
  await expect(runtime).toHaveAttribute("data-geometry-immutable", "true");
  return runtime;
}

async function continueToCustomization(page, layoutId, query = "") {
  await openFreshProject(page, query);
  await continueToLayouts(page);
  await chooseLayout(page, layoutId);
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Customize your space" })).toBeAttached();
  return waitForViewerReady(page, layoutId);
}

async function switchLayout(page, layoutId) {
  await page.locator("[data-back]").click();
  await expect(page.getByRole("heading", { name: "Choose the layout that matches your space" })).toBeVisible();
  await chooseLayout(page, layoutId);
  await page.locator("[data-continue]").click();
  return waitForViewerReady(page, layoutId);
}

async function diagnostics(page) {
  return page.evaluate(() => globalThis.__JQ_LAYOUT_VIEWER_DIAGNOSTICS__);
}

async function hasGenuineWebGpuAdapter(page) {
  if (page.url() === "about:blank") {
    await page.goto("configurator.html?start=new", { waitUntil: "domcontentloaded" });
  }
  return page.evaluate(async () => {
    if (!navigator.gpu?.requestAdapter) return false;
    try {
      return Boolean(await navigator.gpu.requestAdapter());
    } catch {
      return false;
    }
  });
}

function createConfiguredPage(browser, baseURL) {
  return browser.newPage({
    baseURL,
    viewport: { width: 1536, height: 1024 },
    colorScheme: "light",
    reducedMotion: "reduce"
  });
}

function assertGeometryProof(record, expectedMillimeters) {
  const proof = record.transformProof;
  expect(record.state).toBe("ready");
  expect(record.assetSha256).toBe(record.authoritativeSha256);
  expect(record.smartDimension.status).toBe("PROVEN");
  expect(record.smartDimension.valueMillimeters).toBeCloseTo(expectedMillimeters, 5);
  expect(proof.sourceBuffersImmutable).toBe(true);
  expect(proof.geometryMutationCount).toBe(0);
  expect(proof.invalidValueCount).toBe(0);
  expect(proof.fixedWorldTranslationMaximumMillimeters).toBeLessThanOrEqual(0.25);
  expect(proof.fixedWorldLinearMaximumDelta).toBeLessThanOrEqual(1e-8);
  expect(proof.fixedLocalScaleMaximumDelta).toBeLessThanOrEqual(1e-8);
  expect(proof.fixedLocalQuaternionMaximumAngleRadians).toBeLessThanOrEqual(1e-6);
  expect(proof.hardwareWorldTranslationMaximumMillimeters).toBeLessThanOrEqual(0.25);
  expect(proof.hardwareWorldLinearMaximumDelta).toBeLessThanOrEqual(1e-8);
  expect(proof.targetLocalZFormulaDelta).toBeLessThanOrEqual(1e-8);
  expect(proof.targetNonZPositionMaximumDelta).toBeLessThanOrEqual(1e-8);
  expect(proof.targetScaleMaximumDelta).toBeLessThanOrEqual(1e-8);
  expect(proof.targetQuaternionMaximumAngleRadians).toBeLessThanOrEqual(1e-6);
  expect(proof.clearanceDeltaMillimeters).toBeLessThanOrEqual(0.5);
  expect(proof.targetThicknessDeltaMillimeters).toBeLessThanOrEqual(0.5);
  expect(proof.targetXZBoundsMaximumDeltaMillimeters).toBeLessThanOrEqual(0.25);
  expect(proof.degenerateTriangleDelta).toBe(0);
  expect(proof.collision.unintendedIntersectionCount).toBe(0);
  expect(proof.collision.maximumPenetrationIncreaseMillimeters).toBeLessThanOrEqual(0.25);
  expect(proof.endpointCollisionFree).toBe(true);
  expect(record.rendererInfo.calls).toBeLessThanOrEqual(250);
  expect(record.rendererInfo.triangles).toBeLessThanOrEqual(30_000);
  expect(record.ownership.animationLoops + record.ownership.activeRafCallbacks).toBeLessThanOrEqual(1);
}

async function setDisplayedDimension(page, millimeters) {
  const input = page.locator(`[data-smart-dimension="${CONTROL_ID}"]`);
  await input.fill(millimetersToInches(millimeters).toFixed(2));
  await input.blur();
  await expect.poll(async () => (await diagnostics(page)).smartDimension.valueMillimeters).toBeCloseTo(millimeters, 5);
}

test("Step 1 restores seven image cards and Step 2 exposes exactly three audited layouts", async ({ page }) => {
  const failures = monitorUnexpectedFailures(page);
  await openFreshProject(page);
  await expect(page.locator("[data-product-choice], [data-unavailable-product-choice]")).toHaveCount(7);
  await expect(page.locator(".product-card img")).toHaveCount(7);
  await expect(page.locator(`[data-product-choice="${PUBLIC_CONFIGURATOR_PRODUCT_ID}"]`)).not.toHaveAttribute("aria-disabled", "true");
  for (const product of PRODUCT_CHOICES.filter(({ id }) => id !== PUBLIC_CONFIGURATOR_PRODUCT_ID)) {
    const card = page.locator(`[data-unavailable-product-choice="${product.id}"]`);
    await expect(card).toHaveAttribute("aria-disabled", "true");
    await card.focus();
    await expect(card).toBeFocused();
    await card.press("Enter");
    await expect(card).toHaveAttribute("aria-pressed", "false");
  }
  await expect(page.locator("[data-continue]")).toBeDisabled();
  await continueToLayouts(page);
  await expect(page.locator("[data-layout]")).toHaveCount(3);
  await expect(page.locator("[data-layout] img")).toHaveCount(3);
  const ids = await page.locator("[data-layout]").evaluateAll((cards) => cards.map((card) => card.dataset.layout));
  expect(ids).toEqual(IMMERSIVE_LAYOUT_ORDER);
  const images = await page.locator("[data-layout] img").evaluateAll((nodes) => nodes.map((image) => ({ complete: image.complete, width: image.naturalWidth, height: image.naturalHeight })));
  expect(images.every(({ complete, width, height }) => complete && width > 0 && height > 0)).toBe(true);
  expect(failures).toEqual([]);
});

test("every authoritative layout loads once and proves min/native/max plus fifty real reset cycles", async ({ page }) => {
  test.slow();
  const failures = monitorUnexpectedFailures(page);
  const modelRequests = [];
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (MODEL_PATH_PATTERN.test(pathname)) modelRequests.push(pathname.replace(/^\//, ""));
  });
  await openFreshProject(page);
  await continueToLayouts(page);
  expect(modelRequests).toEqual([]);
  for (const [index, layoutId] of IMMERSIVE_LAYOUT_ORDER.entries()) {
    const layout = IMMERSIVE_LAYOUT_REGISTRY[layoutId];
    const control = layout.geometryControlManifest[CONTROL_ID];
    if (index === 0) {
      await chooseLayout(page, layoutId);
      await page.locator("[data-continue]").click();
      await waitForViewerReady(page, layoutId);
    } else await switchLayout(page, layoutId);
    expect(modelRequests.filter((path) => path === layout.runtimeAsset.path)).toHaveLength(1);
    const loaded = await diagnostics(page);
    expect(loaded.assetBytes).toBe(layout.runtimeAsset.bytes);
    expect(loaded.assetSha256).toBe(layout.runtimeAsset.sha256);
    expect(loaded.requestCount).toBe(index + 1);
    expect(loaded.successfulRequestCount).toBe(index + 1);
    expect(loaded.appearance.materialZoneAudit.exhaustive).toBe(true);
    for (const value of [control.minMillimeters, control.nativeMillimeters, control.maxMillimeters]) {
      await setDisplayedDimension(page, value);
      assertGeometryProof(await diagnostics(page), value);
    }
    await page.evaluate(({ maximumInches }) => {
      const input = document.querySelector('[data-smart-dimension="adjustable-shelf-clearance"]');
      const reset = document.querySelector('[data-smart-dimension-reset="adjustable-shelf-clearance"]');
      for (let cycle = 0; cycle < 50; cycle += 1) {
        input.value = maximumInches;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        reset.click();
      }
    }, { maximumInches: millimetersToInches(control.maxMillimeters).toFixed(2) });
    await expect.poll(async () => (await diagnostics(page)).smartDimension.valueMillimeters).toBeCloseTo(control.nativeMillimeters, 5);
    const afterCycles = await diagnostics(page);
    assertGeometryProof(afterCycles, control.nativeMillimeters);
    expect(afterCycles.smartDimension.dimensionResetCount).toBeGreaterThanOrEqual(50);
  }
  expect(failures).toEqual([]);
});

test("per-layout dimensions survive A→B→C→A, reload, Review, and Back without cross-talk", async ({ page }) => {
  const failures = monitorUnexpectedFailures(page);
  await continueToCustomization(page, "fireplace-wall");
  const fireplace = IMMERSIVE_LAYOUT_REGISTRY["fireplace-wall"].geometryControlManifest[CONTROL_ID];
  const door = IMMERSIVE_LAYOUT_REGISTRY["door-wall"].geometryControlManifest[CONTROL_ID];
  const window = IMMERSIVE_LAYOUT_REGISTRY["window-wall"].geometryControlManifest[CONTROL_ID];
  await setDisplayedDimension(page, fireplace.minMillimeters);
  await page.locator('[data-measurement="lowerCabinetHeight"]').fill("35");
  await page.locator('[data-measurement="lowerCabinetHeight"]').blur();
  await switchLayout(page, "door-wall");
  await setDisplayedDimension(page, door.maxMillimeters);
  await page.locator('[data-measurement="lowerCabinetHeight"]').fill("36");
  await page.locator('[data-measurement="lowerCabinetHeight"]').blur();
  await switchLayout(page, "window-wall");
  await setDisplayedDimension(page, window.nativeMillimeters);
  await page.locator('[data-measurement="lowerCabinetHeight"]').fill("37");
  await page.locator('[data-measurement="lowerCabinetHeight"]').blur();
  await switchLayout(page, "fireplace-wall");
  await expect(page.locator(`[data-smart-dimension="${CONTROL_ID}"]`)).toHaveValue("0.00");
  await expect(page.locator('[data-measurement="lowerCabinetHeight"]')).toHaveValue("35");
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForViewerReady(page, "fireplace-wall");
  await expect(page.locator(`[data-smart-dimension="${CONTROL_ID}"]`)).toHaveValue("0.00");
  await expect(page.locator('[data-measurement="lowerCabinetHeight"]')).toHaveValue("35");
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Review your project details" })).toBeVisible();
  await expect(page.getByText("Adjustable shelf clearance", { exact: true })).toBeVisible();
  await expect(page.locator('[data-summary-value="lowerCabinetHeight"]')).toHaveText("35 in");
  await expect(page.locator("[data-layout-viewer]")).toHaveAttribute("data-dimensions-visible", "false");
  await expect(page.locator("[data-dimension-handle]")).toBeHidden();
  await page.locator('[data-edit-section="dimensions"]').click();
  await waitForViewerReady(page, "fireplace-wall");
  await expect(page.locator("[data-layout-viewer]")).toHaveAttribute("data-dimensions-visible", "true");
  expect(failures).toEqual([]);
});

test("on-model editing, orbit, wheel, keyboard, named views, Fit, and Reset share one controller", async ({ page }) => {
  const failures = monitorUnexpectedFailures(page);
  const runtime = await continueToCustomization(page, "door-wall");
  const instanceId = (await diagnostics(page)).instanceId;
  const handle = page.locator("[data-dimension-handle]");
  await expect(handle).toBeVisible();
  await handle.click();
  await expect(page.locator(`[data-smart-dimension="${CONTROL_ID}"]`)).toBeFocused();
  await handle.focus();
  await handle.press("End");
  const maximum = IMMERSIVE_LAYOUT_REGISTRY["door-wall"].geometryControlManifest[CONTROL_ID].maxMillimeters;
  await expect(handle).toHaveAttribute("aria-valuenow", String(maximum));
  const cameraBeforeHandle = (await diagnostics(page)).camera;
  const handleBox = await handle.boundingBox();
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2 + 30, { steps: 4 });
  await page.mouse.up();
  expect((await diagnostics(page)).camera.theta).toBeCloseTo(cameraBeforeHandle.theta, 8);
  const canvas = runtime.locator("canvas");
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.45);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.45, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => (await diagnostics(page)).camera.theta).not.toBeCloseTo(cameraBeforeHandle.theta, 3);
  const radius = (await diagnostics(page)).camera.radius;
  await canvas.hover();
  await page.mouse.wheel(0, -240);
  await expect.poll(async () => (await diagnostics(page)).camera.radius).toBeLessThan(radius);
  const leftView = page.getByRole("button", { name: "Left" });
  await leftView.click();
  await expect(leftView).toHaveClass(/is-active/);
  await expect(leftView).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("tab", { name: "Finish" }).click();
  await expect(page.getByRole("button", { name: "Left" })).toHaveAttribute("aria-pressed", "true");
  await canvas.focus();
  await canvas.press("ArrowRight");
  await expect(page.getByRole("button", { name: "Left" })).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Fit model" }).click();
  await page.getByRole("button", { name: "Reset view" }).click();
  const final = await diagnostics(page);
  expect(final.instanceId).toBe(instanceId);
  expect(final.ownership.canvases).toBe(1);
  expect(final.ownership.renderers).toBe(1);
  expect(final.ownership.controlListenerSets).toBe(1);
  expect(failures).toEqual([]);
});

test("touch orbit and two-pointer pinch update the same camera without changing the dimension", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Chromium CDP supplies deterministic native touch events.");
  await page.setViewportSize({ width: 390, height: 844 });
  const runtime = await continueToCustomization(page, "door-wall", "renderer=webgl2");
  const canvas = runtime.locator("canvas");
  const box = await canvas.boundingBox();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
  const initial = await diagnostics(page);
  const touch = (id, x, y) => ({ id, x, y, radiusX: 8, radiusY: 8, force: 1 });
  const orbitStart = touch(1, box.x + box.width * 0.52, box.y + box.height * 0.22);
  const orbitEnd = touch(1, orbitStart.x + 72, orbitStart.y + 18);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [orbitStart] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [orbitEnd] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(async () => (await diagnostics(page)).camera.theta).not.toBeCloseTo(initial.camera.theta, 3);

  const beforePinch = await diagnostics(page);
  const centerY = box.y + box.height * 0.3;
  const pinchStart = [
    touch(2, box.x + box.width * 0.4, centerY),
    touch(3, box.x + box.width * 0.6, centerY)
  ];
  const pinchEnd = [
    touch(2, box.x + box.width * 0.27, centerY),
    touch(3, box.x + box.width * 0.73, centerY)
  ];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pinchStart });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pinchEnd });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(async () => (await diagnostics(page)).camera.radius).toBeLessThan(beforePinch.camera.radius);
  const final = await diagnostics(page);
  expect(final.smartDimension.valueMillimeters).toBe(initial.smartDimension.valueMillimeters);
  expect(final.instanceId).toBe(initial.instanceId);
  expect(final.ownership.canvases).toBe(1);
  expect(final.ownership.controlListenerSets).toBe(1);
});

test("WebGPU is genuine when available, forced WebGL2 works, and an import failure demotes safely", async ({ browser, baseURL }) => {
  const webgpuPage = await createConfiguredPage(browser, baseURL);
  const hasWebGpu = await hasGenuineWebGpuAdapter(webgpuPage);
  if (hasWebGpu) {
    await continueToCustomization(webgpuPage, "fireplace-wall");
    const record = await diagnostics(webgpuPage);
    expect(record.backend).toBe("webgpu");
    expect(record.ownership.animationLoops).toBe(1);
  }
  await webgpuPage.close();
  const forcedPage = await createConfiguredPage(browser, baseURL);
  await continueToCustomization(forcedPage, "door-wall", "renderer=webgl2");
  const forced = await diagnostics(forcedPage);
  expect(forced.backend).toBe("webgl2");
  expect(forced.rendererFallbackReason).toContain("forced");
  expect(forced.ownership.animationLoops).toBe(0);
  await forcedPage.close();
  if (hasWebGpu) {
    const failedImportPage = await createConfiguredPage(browser, baseURL);
    await failedImportPage.route("**/assets/vendor/three-webgpu-renderer-r166.bundle.js*", (route) => route.abort("failed"));
    await continueToCustomization(failedImportPage, "window-wall");
    const fallback = await diagnostics(failedImportPage);
    expect(fallback.backend).toBe("webgl2");
    expect(fallback.rendererFallbackReason).toMatch(/WebGPU.*failed|fallback/i);
    await failedImportPage.close();
  }
});

test("first-frame and late WebGPU failures preserve the journey timer and recover through WebGL2", async ({ browser, baseURL }) => {
  test.slow();
  const probe = await createConfiguredPage(browser, baseURL);
  const hasWebGpu = await hasGenuineWebGpuAdapter(probe);
  await probe.close();
  test.skip(!hasWebGpu, "Chromium genuinely lacks WebGPU; supported WebGL2 is covered separately.");
  for (const mode of ["first", "late"]) {
    const page = await createConfiguredPage(browser, baseURL);
    await page.addInitScript((renderFailureMode) => {
      globalThis.__JQ_IMMERSIVE_VIEWER_TEST_HOOKS__ = { renderFailureMode };
    }, mode);
    await continueToCustomization(page, "fireplace-wall");
    if (mode === "late") await page.getByRole("button", { name: "Zoom in" }).click();
    await expect(page.locator("[data-layout-viewer]")).toHaveAttribute("data-renderer-backend", "webgl2", { timeout: 25_000 });
    const record = await diagnostics(page);
    expect(record.rendererRenderFailureCount).toBe(1);
    expect(record.rendererFallbackReason).toContain("WebGPU rendering failed");
    expect(record.firstUsableMilliseconds).toBeGreaterThan(0);
    expect(record.firstUsableMilliseconds).toBeLessThanOrEqual(5_000);
    expect(record.state).toBe("ready");
    await page.close();
  }
});

test("a new layout supersedes a WebGPU fallback reload already in flight", async ({ browser, baseURL }) => {
  test.slow();
  const probe = await createConfiguredPage(browser, baseURL);
  const hasWebGpu = await hasGenuineWebGpuAdapter(probe);
  await probe.close();
  test.skip(!hasWebGpu, "Chromium genuinely lacks WebGPU; supported WebGL2 is covered separately.");

  const page = await createConfiguredPage(browser, baseURL);
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    globalThis.__JQ_IMMERSIVE_VIEWER_TEST_HOOKS__ = { renderFailureMode: "late" };
  });

  const doorPath = IMMERSIVE_LAYOUT_REGISTRY["door-wall"].runtimeAsset.path;
  const windowLayout = IMMERSIVE_LAYOUT_REGISTRY["window-wall"];
  let doorAttempts = 0;
  let windowAttempts = 0;
  let heldRequest = null;
  let heldRequestOutcome = null;
  let heldHandlerSettled = false;
  let releaseHeldRequest;
  const heldGate = new Promise((resolve) => {
    releaseHeldRequest = resolve;
  });

  page.on("request", (request) => {
    const path = new URL(request.url()).pathname.replace(/^\//, "");
    if (path === windowLayout.runtimeAsset.path) windowAttempts += 1;
  });
  page.on("requestfailed", (request) => {
    if (request === heldRequest) heldRequestOutcome = "failed";
  });
  page.on("requestfinished", (request) => {
    if (request === heldRequest) heldRequestOutcome = "finished";
  });
  await page.route(`**/${doorPath}`, async (route) => {
    doorAttempts += 1;
    if (doorAttempts !== 2) {
      await route.continue();
      return;
    }
    heldRequest = route.request();
    await heldGate;
    try {
      await route.continue();
    } catch {
      heldRequestOutcome ||= "route-rejected";
    } finally {
      heldHandlerSettled = true;
    }
  });

  try {
    await continueToCustomization(page, "door-wall");
    const initial = await diagnostics(page);
    expect(initial.backend).toBe("webgpu");
    expect(initial.requestCount).toBe(1);
    expect(initial.parseCount).toBe(1);
    expect(doorAttempts).toBe(1);

    await page.getByRole("button", { name: "Zoom in" }).click();
    await expect.poll(() => doorAttempts).toBe(2);
    await expect(page.locator(".immersive-viewer-surface")).toHaveAttribute("data-guided3d-state", "loading");

    await page.locator("[data-back]").click();
    await expect(page.getByRole("heading", { name: "Choose the layout that matches your space" })).toBeVisible();
    await chooseLayout(page, "window-wall");
    await page.locator("[data-continue]").click();
    await expect(page.getByRole("heading", { name: "Customize your space" })).toBeAttached();
    await expect.poll(() => windowAttempts).toBe(1);

    releaseHeldRequest();
    await waitForViewerReady(page, "window-wall");
    await expect.poll(() => heldHandlerSettled).toBe(true);
    await expect.poll(() => heldRequestOutcome).not.toBeNull();
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

    const final = await diagnostics(page);
    expect(final.instanceId).toBe(initial.instanceId);
    expect(final.layoutId).toBe("window-wall");
    expect(final.backend).toBe("webgl2");
    expect(final.rendererRenderFailureCount).toBe(1);
    expect(final.rendererFallbackReason).toContain("WebGPU rendering failed");
    expect(final.assetPath).toBe(windowLayout.runtimeAsset.path);
    expect(final.assetSha256).toBe(windowLayout.runtimeAsset.sha256);
    expect(final.assetBytes).toBe(windowLayout.runtimeAsset.bytes);
    expect(final.requestCount).toBe(3);
    expect(final.successfulRequestCount).toBe(2);
    expect(final.parseCount).toBe(2);
    expect(final.layoutSwitchCount).toBe(1);
    expect(final.lastError).toBeNull();
    expect(final.ownership.canvases).toBe(1);
    expect(final.ownership.renderers).toBe(1);
    expect(final.ownership.parsedRoots).toBe(1);
    expect(final.ownership.controlListenerSets).toBe(1);
    await expect(page.locator("[data-layout-viewer]")).toHaveCount(1);
    await expect(page.locator("[data-layout-viewer] canvas")).toHaveCount(1);
    expect(pageErrors).toEqual([]);
  } finally {
    releaseHeldRequest?.();
    await page.close();
  }
});

test("asset failure is fail-closed, focusable, accessible, and Retry recovers", async ({ page }) => {
  let attempts = 0;
  await page.route("**/assets/models/room2/Room2-Fireplace-bookcases-source-v1.glb", async (route) => {
    attempts += 1;
    if (attempts === 1) await route.fulfill({ status: 503, contentType: "application/octet-stream", body: "" });
    else await route.continue();
  });
  await openFreshProject(page);
  await continueToLayouts(page);
  await chooseLayout(page, "fireplace-wall");
  await page.locator("[data-continue]").click();
  const runtime = page.locator("[data-layout-viewer]");
  await expect(runtime).toHaveAttribute("data-state", "error", { timeout: 20_000 });
  const retry = page.getByRole("button", { name: "Retry model" });
  await expect(retry).toBeVisible();
  await expect(page.getByRole("heading", { name: "Customize your space" })).toBeFocused();
  await retry.focus();
  await expect(retry).toBeFocused();
  await expect(page.locator("[data-guided-3d-mount] img")).toHaveCount(0);
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter(({ impact }) => ["serious", "critical"].includes(impact))).toEqual([]);
  await retry.click();
  await waitForViewerReady(page, "fireplace-wall");
  await expect(runtime.locator("canvas")).toBeFocused();
  expect(attempts).toBe(2);
});

test("initial Finish supersession keeps the parsed model and retries only the failed latest texture", async ({ page }) => {
  test.slow();
  const pageErrors = [];
  const modelRequests = [];
  let oakStarted = false;
  let oakAttempts = 0;
  let paintNormalAttempts = 0;
  let releaseOak;
  const oakGate = new Promise((resolve) => { releaseOak = resolve; });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    if (MODEL_PATH_PATTERN.test(new URL(request.url()).pathname)) modelRequests.push(request.url());
  });
  await page.route("**/assets/room2-commercial-pbr-v1/textures/oak/base-color.webp", async (route) => {
    oakAttempts += 1;
    const response = await route.fetch();
    oakStarted = true;
    await oakGate;
    await route.fulfill({ response });
  });
  await page.route("**/assets/room2-commercial-pbr-v1/textures/paint/normal.webp", async (route) => {
    paintNormalAttempts += 1;
    if (paintNormalAttempts === 1) {
      await route.fulfill({ status: 503, contentType: "image/webp", body: "" });
    } else {
      await route.continue();
    }
  });

  await openFreshProject(page);
  await continueToLayouts(page);
  await chooseLayout(page, "fireplace-wall");
  await page.locator("[data-continue]").click();
  await expect.poll(() => oakStarted).toBe(true);
  await page.getByRole("tab", { name: "Finish" }).click();
  await page.getByRole("button", { name: "Light Walnut" }).click();
  await page.getByRole("button", { name: "Charcoal" }).click();
  await expect(page.getByRole("button", { name: "Charcoal" })).toBeFocused();
  releaseOak();

  const runtime = page.locator("[data-layout-viewer]");
  const surface = page.locator(".immersive-viewer-surface");
  await expect(runtime).toHaveAttribute("data-state", "ready", { timeout: 25_000 });
  await expect(surface).toHaveAttribute("data-guided3d-state", "finish-error", { timeout: 25_000 });
  const failed = await diagnostics(page);
  const failedMaterials = failed.appearance.acceptedRoom2MaterialSystem;
  expect(failed.requestCount).toBe(1);
  expect(failed.parseCount).toBe(1);
  expect(failed.appearance.requestedFinishId).toBe("charcoal");
  expect(failed.appearance.appliedFinishId).toBe("natural-oak");
  expect(failed.lastError.code).toBe("FINISH_LOAD_FAILED");
  expect(failedMaterials.textureRequests["assets/room2-commercial-pbr-v1/textures/paint/normal.webp"]).toBe(1);
  const instanceId = failed.instanceId;
  const camera = failed.camera;

  const retry = page.getByRole("button", { name: "Retry viewer" });
  await expect(retry).toBeVisible();
  await retry.click();
  await expect(surface).toHaveAttribute("data-guided3d-state", "ready", { timeout: 25_000 });
  await expect(page.getByRole("button", { name: "Charcoal" })).toBeFocused();
  const recovered = await diagnostics(page);
  const recoveredMaterials = recovered.appearance.acceptedRoom2MaterialSystem;
  expect(recovered.instanceId).toBe(instanceId);
  expect(recovered.requestCount).toBe(1);
  expect(recovered.parseCount).toBe(1);
  expect(recovered.camera).toEqual(camera);
  expect(recovered.appearance.appliedFinishId).toBe("charcoal");
  expect(recovered.lastError).toBeNull();
  expect(recoveredMaterials.textureRequests["assets/room2-commercial-pbr-v1/textures/paint/normal.webp"]).toBe(2);
  expect(recoveredMaterials.textureRequests["assets/room2-commercial-pbr-v1/textures/paint/roughness.webp"]).toBe(1);
  expect(modelRequests).toHaveLength(1);
  expect(oakAttempts).toBe(1);
  expect(paintNormalAttempts).toBe(2);
  expect(pageErrors).toEqual([]);
});

test("desktop, tablet, short landscape, and mobile sheet states are reachable without overflow", async ({ page }) => {
  const failures = monitorUnexpectedFailures(page);
  await continueToCustomization(page, "window-wall");
  const viewports = [
    { width: 1920, height: 1080, minimumViewerRatio: 0.7 },
    { width: 1440, height: 900, minimumViewerRatio: 0.7 },
    { width: 1366, height: 768, minimumViewerRatio: 0.7 },
    { width: 1024, height: 1366, minimumViewerHeight: 0.56 },
    { width: 1024, height: 768, minimumViewerHeight: 0.56 },
    { width: 844, height: 390, minimumViewerHeight: 0.56 }
  ];
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    const metrics = await page.evaluate(() => {
      const viewer = document.querySelector(".immersive-viewer-surface").getBoundingClientRect();
      const main = document.querySelector(".immersive-configurator").getBoundingClientRect();
      const actions = document.querySelector(".immersive-sticky-actions");
      const primaryAction = actions?.querySelector("[data-continue]")?.getBoundingClientRect();
      const smartInput = document.querySelector("[data-smart-dimension]");
      return {
        viewerWidth: viewer.width,
        viewerHeight: viewer.height,
        mainWidth: main.width,
        bodyScrollWidth: document.body.scrollWidth,
        innerWidth,
        innerHeight,
        actionClientHeight: actions?.clientHeight || 0,
        actionScrollHeight: actions?.scrollHeight || 0,
        primaryActionBottom: primaryAction?.bottom || 0,
        smartInputColor: smartInput ? getComputedStyle(smartInput).color : null
      };
    });
    expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.innerWidth + 1);
    if (viewport.minimumViewerRatio) expect(metrics.viewerWidth / metrics.mainWidth).toBeGreaterThanOrEqual(viewport.minimumViewerRatio);
    if (viewport.minimumViewerHeight) expect(metrics.viewerHeight / viewport.height).toBeGreaterThanOrEqual(viewport.minimumViewerHeight);
    if (viewport.width === 1366 && viewport.height === 768) {
      expect(metrics.actionScrollHeight).toBeLessThanOrEqual(metrics.actionClientHeight);
      expect(metrics.primaryActionBottom).toBeLessThanOrEqual(metrics.innerHeight);
      expect(metrics.smartInputColor).toBe("rgb(17, 17, 16)");
      await expect(page.locator("[data-guided-toast]")).toBeHidden();
    }
  }
  await page.setViewportSize({ width: 667, height: 375 });
  await page.getByRole("button", { name: "Set customization sheet half" }).click();
  const landscape = await page.evaluate(() => {
    const viewer = document.querySelector(".immersive-viewer-surface").getBoundingClientRect();
    const sheet = document.querySelector("[data-customization-sheet]").getBoundingClientRect();
    const tabs = document.querySelector(".customization-tabs").getBoundingClientRect();
    const toolbar = document.querySelector(".immersive-view-toolbar").getBoundingClientRect();
    const authority = document.querySelector(".immersive-viewer-authority").getBoundingClientRect();
    return {
      viewerHeight: viewer.height,
      viewerTop: viewer.top,
      sheetTop: sheet.top,
      sheetBottom: sheet.bottom,
      tabsTop: tabs.top,
      tabsBottom: tabs.bottom,
      toolbarTop: toolbar.top,
      toolbarBottom: toolbar.bottom,
      authorityBottom: authority.bottom,
      innerHeight
    };
  });
  expect(landscape.viewerHeight / landscape.innerHeight).toBeGreaterThanOrEqual(0.52);
  expect(landscape.viewerHeight / landscape.innerHeight).toBeLessThanOrEqual(0.58);
  expect((landscape.sheetTop - landscape.viewerTop) / landscape.innerHeight).toBeGreaterThanOrEqual(0.52);
  expect((landscape.sheetTop - landscape.viewerTop) / landscape.innerHeight).toBeLessThanOrEqual(0.58);
  expect(landscape.sheetTop).toBeGreaterThanOrEqual(0);
  expect(landscape.sheetBottom).toBeLessThanOrEqual(landscape.innerHeight + 1);
  expect(landscape.tabsTop).toBeGreaterThanOrEqual(landscape.sheetTop);
  expect(landscape.tabsBottom).toBeLessThanOrEqual(landscape.sheetBottom + 1);
  expect(landscape.authorityBottom).toBeLessThanOrEqual(landscape.toolbarTop + 1);
  expect(landscape.toolbarBottom).toBeLessThanOrEqual(landscape.sheetTop + 1);
  await page.getByRole("button", { name: "Set customization sheet collapsed" }).click();
  const landscapeHandle = page.locator("[data-dimension-handle]");
  await landscapeHandle.click();
  await expect(page.locator("[data-customization-sheet]")).toHaveAttribute("data-sheet-state", "expanded");
  await expect(page.locator(`[data-smart-dimension="${CONTROL_ID}"]`)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-customization-sheet]")).toHaveAttribute("data-sheet-state", "half");
  await expect(landscapeHandle).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  for (const state of ["collapsed", "half", "expanded"]) {
    await page.getByRole("button", { name: `Set customization sheet ${state}` }).click();
    await expect(page.locator("[data-customization-sheet]")).toHaveAttribute("data-sheet-state", state);
    const mobile = await page.evaluate(() => {
      const viewer = document.querySelector(".immersive-viewer-surface").getBoundingClientRect();
      const sheet = document.querySelector("[data-customization-sheet]").getBoundingClientRect();
      return { viewerHeight: viewer.height, sheetBottom: sheet.bottom, bodyWidth: document.body.scrollWidth, viewportWidth: innerWidth, viewportHeight: innerHeight };
    });
    expect(mobile.bodyWidth).toBeLessThanOrEqual(mobile.viewportWidth + 1);
    expect(mobile.sheetBottom).toBeLessThanOrEqual(mobile.viewportHeight + 1);
    if (state === "half") {
      expect(mobile.viewerHeight / mobile.viewportHeight).toBeGreaterThanOrEqual(0.52);
      expect(mobile.viewerHeight / mobile.viewportHeight).toBeLessThanOrEqual(0.58);
    }
  }
  await expect(page.locator("[data-customization-sheet]")).toHaveAttribute("role", "dialog");
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-customization-sheet]")).toHaveAttribute("data-sheet-state", "half");
  await page.setViewportSize({ width: 320, height: 568 });
  const shortPhone = await page.evaluate(() => {
    const authority = document.querySelector(".immersive-viewer-authority").getBoundingClientRect();
    const toolbar = document.querySelector(".immersive-view-toolbar").getBoundingClientRect();
    const sheet = document.querySelector("[data-customization-sheet]").getBoundingClientRect();
    return { authorityBottom: authority.bottom, toolbarTop: toolbar.top, toolbarBottom: toolbar.bottom, sheetTop: sheet.top };
  });
  expect(shortPhone.authorityBottom).toBeLessThanOrEqual(shortPhone.toolbarTop + 1);
  expect(shortPhone.toolbarBottom).toBeLessThanOrEqual(shortPhone.sheetTop + 1);
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter(({ impact }) => ["serious", "critical"].includes(impact))).toEqual([]);
  expect(failures).toEqual([]);
});

test("cold throttled load stays under five seconds and ten switches retain bounded resources", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Chromium CDP provides the reproducible throttling contract.");
  test.slow();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 50, downloadThroughput: 25_000_000 / 8, uploadThroughput: 5_000_000 / 8, connectionType: "wifi" });
  await continueToCustomization(page, "fireplace-wall", "renderer=webgl2");
  const baseline = await diagnostics(page);
  expect(baseline.firstUsableMilliseconds).toBeLessThanOrEqual(5_000);
  for (const layoutId of ["door-wall", "window-wall", "fireplace-wall", "door-wall", "window-wall", "fireplace-wall", "door-wall", "window-wall", "door-wall", "fireplace-wall"]) await switchLayout(page, layoutId);
  const final = await diagnostics(page);
  expect(final.layoutSwitchCount).toBeGreaterThanOrEqual(10);
  expect(final.ownership.canvases).toBe(1);
  expect(final.ownership.renderers).toBe(1);
  expect(final.ownership.parsedRoots).toBe(1);
  expect(final.rendererInfo.geometries).toBeLessThanOrEqual(Math.ceil(baseline.rendererInfo.geometries * 1.15));
  expect(final.rendererInfo.materials).toBeLessThanOrEqual(Math.ceil(baseline.rendererInfo.materials * 1.15));
  expect(final.rendererInfo.textures).toBeLessThanOrEqual(Math.ceil(Math.max(1, baseline.rendererInfo.textures) * 1.15));
  expect(final.rendererInfo.renderTargets).toBeLessThanOrEqual(Math.ceil(Math.max(1, baseline.rendererInfo.renderTargets) * 1.15));
});

test("the three-layout journey makes only local verified model requests and no Vivid request", async ({ page }) => {
  const failures = monitorUnexpectedFailures(page);
  const requests = [];
  const modelResponses = [];
  page.on("request", (request) => requests.push(request.url()));
  page.on("response", (response) => {
    if (MODEL_PATH_PATTERN.test(new URL(response.url()).pathname)) modelResponses.push({ url: response.url(), contentType: response.headers()["content-type"] || "" });
  });
  await continueToCustomization(page, "fireplace-wall");
  await switchLayout(page, "door-wall");
  await switchLayout(page, "window-wall");
  expect(requests.some((url) => /vivid/i.test(url))).toBe(false);
  expect(requests.filter((url) => /^https?:/.test(url) && new URL(url).origin !== new URL(page.url()).origin)).toEqual([]);
  expect(modelResponses).toHaveLength(3);
  expect(modelResponses.every(({ contentType }) => /model\/gltf-binary|application\/octet-stream/i.test(contentType))).toBe(true);
  expect(failures).toEqual([]);
});
