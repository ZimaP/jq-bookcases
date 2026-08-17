import { test, expect } from "@playwright/test";

const publicRoutes = [
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
    if (response.status() >= 400) failures.push(`response: ${response.status()} ${response.url()}`);
  });
  return failures;
}

async function expectAcceptedSmokePreview(page) {
  const preview = page.locator(".concept-preview");
  await expect(preview).toHaveAttribute("data-preview-render-mode", "fixed-room2-glb");
  await expect(preview.locator(
    "picture.concept-photo, picture.concept-room-photo, img.concept-photo, img.concept-room-photo, img.concept-furniture-photo, svg.concept-finish-overlay, [data-published-preview-image]"
  )).toHaveCount(0);
  const canvas = preview.locator('.guided-room2-canvas[data-rendered="true"]');
  await expect(canvas).toHaveCount(1);
  await expect(canvas).toHaveAttribute("data-room2-asset-sha256", "251af4f7cb669976dec9dcaa46905982f9ae085b7bfb30e27e1bf9900a01a8d5");
  await expect(canvas).toHaveAttribute("data-room2-geometry-fingerprint", "8762fe4326e22e46a163343e5fde410e231d651b48d1b1c9be8391febec8f6ff");
  return canvas;
}

async function openCustomization(page, layoutId = "fireplace-wall") {
  await page.goto("configurator.html?start=new", { waitUntil: "networkidle" });
  await page.locator('[data-product-choice="cabinet-shelves"]').click();
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Choose the layout that matches your space" })).toBeVisible();
  await page.locator(`[data-layout="${layoutId}"]`).click();
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Plan details beside the Room 2 reference" })).toBeVisible();
  await expect(page).toHaveURL(/#step-3$/);
}

test("public routes render without runtime, network, or responsive overflow failures", async ({ page }) => {
  const failures = monitorRuntime(page);
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const route of publicRoutes) {
      failures.length = 0;
      const response = await page.goto(route, { waitUntil: "networkidle" });
      expect(response?.status()).toBeLessThan(400);
      await expect(page.locator("main#main")).toHaveCount(1);
      await expect(page.locator("h1")).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      expect(failures, `${viewport.width}x${viewport.height} ${route}`).toEqual([]);
    }
  }
});

test("the public Cabinets + Shelves journey reaches the accepted scene and review", async ({ page }) => {
  const failures = monitorRuntime(page);
  await page.goto("configurator.html?start=new", { waitUntil: "networkidle" });
  const stepper = page.getByRole("navigation", { name: "Project steps" });
  await expect(stepper.locator(".guided-step-label--full")).toHaveText([
    "Choose Product",
    "Choose Layout",
    "Customization",
    "Review & Details"
  ]);
  await expect(page.locator("[data-product-choice]")).toHaveCount(1);
  expect(await page.locator("[data-coming-soon-product]").evaluateAll(
    (buttons) => buttons.every((button) => button.disabled)
  )).toBe(true);

  await openCustomization(page);
  const canvas = await expectAcceptedSmokePreview(page);
  const instanceId = await canvas.getAttribute("data-guided3d-instance");
  const originalGeometry = await canvas.getAttribute("data-room2-runtime-model-fingerprint");
  const originalMaterial = await canvas.getAttribute("data-room2-runtime-material-digest");
  const originalCamera = await canvas.getAttribute("data-room2-camera-state");
  await expect(page.getByRole("tab", { name: "Dimensions" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "Finish" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Details" })).toBeVisible();

  await page.getByLabel("Wall width").fill("132");
  await page.getByLabel("Wall width").blur();
  await expect(canvas).toHaveAttribute("data-room2-runtime-model-fingerprint", originalGeometry);
  await expect(canvas).toHaveAttribute("data-room2-camera-state", originalCamera);
  await page.getByRole("tab", { name: "Finish" }).click();
  await page.getByRole("button", { name: "Charcoal", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-guided3d-instance", instanceId);
  await expect(canvas).toHaveAttribute("data-room2-runtime-model-fingerprint", originalGeometry);
  await expect(canvas).toHaveAttribute("data-room2-runtime-material-digest", originalMaterial);
  await expect(canvas).toHaveAttribute("data-room2-camera-state", originalCamera);
  await expect(page.locator(".guided-3d-canvas")).toHaveCount(1);

  await page.locator("[data-continue]").click();
  await expect(page).toHaveURL(/#step-4$/);
  const summary = page.locator(".project-summary-card");
  await expect(summary).toContainText("Cabinets + Shelves");
  await expect(summary).toContainText("Fireplace Wall");
  await expect(summary).toContainText("132 in");
  await expect(summary).toContainText("Charcoal");
  const reviewCanvas = await expectAcceptedSmokePreview(page);
  await expect(reviewCanvas).toHaveAttribute("data-guided3d-instance", instanceId);
  await expect(reviewCanvas).toHaveAttribute("data-room2-runtime-model-fingerprint", originalGeometry);
  await expect(reviewCanvas).toHaveAttribute("data-room2-camera-state", originalCamera);
  await expect.poll(() => page.evaluate(() => (
    JSON.parse(localStorage.getItem("jqGuidedConfiguratorDraftV1") || "null")?.currentStep
  ))).toBe(4);
  expect(failures).toEqual([]);
});

test("Customization and Review retain one accepted controller across navigation", async ({ page }) => {
  const failures = monitorRuntime(page);
  await page.setViewportSize({ width: 1024, height: 768 });
  await openCustomization(page);
  let canvas = await expectAcceptedSmokePreview(page);
  const instanceId = await canvas.getAttribute("data-guided3d-instance");
  const geometryFingerprint = await canvas.getAttribute("data-room2-runtime-model-fingerprint");
  const materialDigest = await canvas.getAttribute("data-room2-runtime-material-digest");
  const rootIdentity = await canvas.getAttribute("data-room2-parsed-root-identity");
  const cameraState = await canvas.getAttribute("data-room2-camera-state");

  await page.getByRole("tab", { name: "Finish" }).click();
  await page.getByRole("button", { name: "Charcoal", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-guided3d-instance", instanceId);
  await expect(canvas).toHaveAttribute("data-room2-runtime-model-fingerprint", geometryFingerprint);
  await expect(canvas).toHaveAttribute("data-room2-runtime-material-digest", materialDigest);
  await expect(canvas).toHaveAttribute("data-room2-camera-state", cameraState);

  await page.locator("[data-continue]").click();
  await expect(page).toHaveURL(/#step-4$/);
  canvas = await expectAcceptedSmokePreview(page);
  await expect(canvas).toHaveAttribute("data-guided3d-instance", instanceId);
  await expect(canvas).toHaveAttribute("data-room2-parsed-root-identity", rootIdentity);
  await expect(canvas).toHaveAttribute("data-room2-camera-state", cameraState);
  await expect(page.locator(".guided-3d-canvas")).toHaveCount(1);
  await page.goBack();
  await expect(page).toHaveURL(/#step-3$/);
  canvas = await expectAcceptedSmokePreview(page);
  await expect(canvas).toHaveAttribute("data-guided3d-instance", instanceId);
  await expect(canvas).toHaveAttribute("data-room2-camera-state", cameraState);
  await page.goForward();
  await expect(page).toHaveURL(/#step-4$/);
  canvas = await expectAcceptedSmokePreview(page);
  await expect(canvas).toHaveAttribute("data-guided3d-instance", instanceId);
  await expect(canvas).toHaveAttribute("data-room2-camera-state", cameraState);

  const ownership = await canvas.evaluate((element) => ({
    renderFrame: Number(element.dataset.room2RenderFrameOwnership),
    resizeObserver: Number(element.dataset.room2ResizeObserverOwnership),
    resizeListener: Number(element.dataset.room2ResizeListenerOwnership),
    controlListener: Number(element.dataset.room2ControlListenerOwnership)
  }));
  expect(ownership.renderFrame).toBeLessThanOrEqual(1);
  expect(ownership.resizeObserver + ownership.resizeListener).toBe(1);
  expect(ownership.controlListener).toBe(1);
  expect(failures).toEqual([]);
});
