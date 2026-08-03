import { test, expect } from "@playwright/test";

const publicRoutes = [
  "/index.html",
  "/configurator.html?start=new",
  "/how-it-works.html",
  "/materials.html",
  "/inspiration.html",
  "/about.html",
  "/faq.html",
  "/request-quote.html",
  "/privacy.html",
  "/terms.html"
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
  await expect(preview).toHaveAttribute("data-preview-render-mode", "accepted-geometry");
  await expect(preview).toHaveAttribute("data-finish-mask-mode", "none");
  await expect(preview).toHaveAttribute("data-accepted-specification", "true");
  await expect(preview).toHaveAttribute("data-geometry-fingerprint", /.+/);
  await expect(preview).toHaveAttribute("data-specification-fingerprint", /.+/);
  await expect(preview.locator(
    "picture.concept-photo, picture.concept-room-photo, img.concept-photo, img.concept-room-photo, img.concept-furniture-photo, svg.concept-finish-overlay"
  )).toHaveCount(0);
  await expect(preview.locator("[data-accepted-fit-summary]")).toBeVisible();
  const canvas = preview.locator('.guided-3d-canvas[data-rendered="true"]');
  await expect(canvas).toHaveCount(1);
  await expect(canvas).toHaveAttribute("data-render-contract-valid", "true");
  await expect(canvas).toHaveAttribute("data-geometry-fingerprint", /.+/);
  await expect(canvas).toHaveAttribute("data-specification-fingerprint", /.+/);
  return canvas;
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

test("the guided accepted-geometry flow rebuilds dimensions and TV data across mirrored niches", async ({ page }) => {
  const failures = monitorRuntime(page);
  await page.goto("/configurator.html?start=new", { waitUntil: "networkidle" });
  await page.locator('[data-product-choice="tv-unit"]').click();
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Choose the room condition that matches your space" })).toBeVisible();
  await page.locator('[data-layout="right-niche"]').click();
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Tell us about your space" })).toBeVisible();
  await page.getByLabel("Wall width").fill("144");
  await page.getByLabel("Niche width").fill("120");
  const measurementCanvas = page.locator('.measurement-room[data-guided3d-state="ready"] .guided-3d-canvas');
  await expect(measurementCanvas).toHaveCount(1);
  const initialRoomFingerprint = await measurementCanvas.getAttribute("data-geometry-fingerprint");
  await page.getByLabel("Wall width").fill("126 1/2");
  await page.getByLabel("Right return").fill("6 1/2");
  await expect.poll(() => measurementCanvas.getAttribute("data-geometry-fingerprint"))
    .not.toBe(initialRoomFingerprint);
  const widerRoomFingerprint = await measurementCanvas.getAttribute("data-geometry-fingerprint");
  await page.getByLabel("Ceiling height").fill("100");
  await expect.poll(() => measurementCanvas.getAttribute("data-geometry-fingerprint"))
    .not.toBe(widerRoomFingerprint);
  const tallerRoomFingerprint = await measurementCanvas.getAttribute("data-geometry-fingerprint");
  await page.getByLabel("Desired built-in depth").fill("16");
  await expect.poll(() => measurementCanvas.getAttribute("data-geometry-fingerprint"))
    .not.toBe(tallerRoomFingerprint);
  await page.locator('[data-measurement="tvScreenSize"]').fill("55");
  await page.locator('[data-measurement="tvHeight"]').fill("28");
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Refine your concept" })).toBeVisible();
  const customizationCanvas = await expectAcceptedSmokePreview(page);
  const smallTvGeometryFingerprint = await customizationCanvas.getAttribute("data-geometry-fingerprint");
  const instanceId = await customizationCanvas.getAttribute("data-guided3d-instance");
  await page.getByRole("tab", { name: "Finish" }).click();
  await page.getByRole("button", { name: "Dark Walnut", exact: true }).click();
  await expect(customizationCanvas).toHaveAttribute("data-geometry-fingerprint", smallTvGeometryFingerprint);

  await page.locator("[data-back]").click();
  await expect(page.getByRole("heading", { name: "Tell us about your space" })).toBeVisible();
  await page.locator('[data-measurement="tvScreenSize"]').fill("65");
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Refine your concept" })).toBeVisible();
  const largerTvCanvas = await expectAcceptedSmokePreview(page);
  const largerTvGeometryFingerprint = await largerTvCanvas.getAttribute("data-geometry-fingerprint");
  expect(largerTvGeometryFingerprint).not.toBe(smallTvGeometryFingerprint);
  await expect(largerTvCanvas).toHaveAttribute("data-guided3d-instance", instanceId);

  await page.locator("[data-back]").click();
  await expect(page.getByRole("heading", { name: "Tell us about your space" })).toBeVisible();
  await page.locator("[data-back]").click();
  await expect(page.getByRole("heading", { name: "Choose the room condition that matches your space" })).toBeVisible();
  await page.locator('[data-layout="left-niche"]').click();
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Tell us about your space" })).toBeVisible();
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Refine your concept" })).toBeVisible();
  const mirroredCanvas = await expectAcceptedSmokePreview(page);
  await expect(mirroredCanvas).toHaveAttribute("data-guided3d-instance", instanceId);
  await expect(mirroredCanvas).toHaveAttribute("data-scene-layout", "left-niche");
  const geometryFingerprint = await mirroredCanvas.getAttribute("data-geometry-fingerprint");
  await page.locator("[data-continue]").click();

  const summary = page.locator(".project-summary-card");
  await expect(summary).toContainText("TV Unit");
  await expect(summary).toContainText("Left Niche");
  await expect(summary).toContainText("126 1/2 in");
  await expect(summary).toContainText("Accepted TV body");
  await expect(summary).toContainText("Generated TV opening");
  await expect(summary).toContainText("Dark Walnut");
  await expect(summary).toContainText(geometryFingerprint);
  const reviewCanvas = await expectAcceptedSmokePreview(page);
  await expect(reviewCanvas).toHaveAttribute("data-geometry-fingerprint", geometryFingerprint);

  await page.waitForTimeout(250);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Review your custom concept" })).toBeVisible();
  await expect(page.locator(".project-summary-card")).toContainText("126 1/2 in");
  const reloadedCanvas = await expectAcceptedSmokePreview(page);
  await expect(reloadedCanvas).toHaveAttribute("data-geometry-fingerprint", geometryFingerprint);
  expect(failures).toEqual([]);
});

test("accepted Bookcase geometry keeps one canvas while finish updates materials only", async ({ page }) => {
  const failures = monitorRuntime(page);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/configurator.html?start=new", { waitUntil: "networkidle" });
  await page.locator('[data-product-choice="open-shelving"]').click();
  await page.locator("[data-continue]").click();
  await page.locator('[data-layout="clear-wall"]').click();
  await page.locator("[data-continue]").click();
  await page.locator("[data-continue]").click();

  const canvas = await expectAcceptedSmokePreview(page);
  const instanceId = await canvas.getAttribute("data-guided3d-instance");
  const geometryFingerprint = await canvas.getAttribute("data-geometry-fingerprint");
  const geometryRebuildCount = await canvas.getAttribute("data-geometry-rebuild-count");
  const materialUpdateCount = Number(await canvas.getAttribute("data-material-update-count"));

  await page.getByRole("button", { name: "Charcoal", exact: true }).click();
  await expect.poll(async () => Number(await canvas.getAttribute("data-material-update-count")))
    .toBeGreaterThan(materialUpdateCount);
  await expect(canvas).toHaveAttribute("data-guided3d-instance", instanceId);
  await expect(canvas).toHaveAttribute("data-geometry-fingerprint", geometryFingerprint);
  await expect(canvas).toHaveAttribute("data-geometry-rebuild-count", geometryRebuildCount);
  await expect(page.locator(".guided-3d-canvas")).toHaveCount(1);

  await page.locator("[data-continue]").click();
  await expect(page.locator(".project-summary-card")).toContainText("Clear Wall");
  await expect(page.locator(".project-summary-card")).toContainText("Charcoal");
  await expect(page.locator(".project-summary-card")).toContainText(geometryFingerprint);
  const reviewCanvas = await expectAcceptedSmokePreview(page);
  await expect(reviewCanvas).toHaveAttribute("data-guided3d-instance", instanceId);

  await expect.poll(() => page.evaluate(() => (
    JSON.parse(localStorage.getItem("jqGuidedConfiguratorDraftV1") || "null")?.currentStep
  ))).toBe(5);
  await page.reload({ waitUntil: "networkidle" });
  const reloadedCanvas = await expectAcceptedSmokePreview(page);
  await expect(reloadedCanvas).toHaveAttribute("data-geometry-fingerprint", geometryFingerprint);
  expect(failures).toEqual([]);
});
