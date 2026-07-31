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

test("the guided project flow works through review and refresh", async ({ page }) => {
  const failures = monitorRuntime(page);
  await page.goto("/configurator.html?start=new", { waitUntil: "networkidle" });
  await page.locator('[data-product-choice="tv-unit"]').click();
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Choose the room condition that matches your space" })).toBeVisible();
  await page.locator('[data-layout="clear-wall"]').click();
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Tell us about your space" })).toBeVisible();
  await page.getByLabel("Wall width").fill("126 1/2");
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Refine your concept" })).toBeVisible();
  await page.getByRole("tab", { name: "Finish" }).click();
  await page.getByRole("button", { name: "Dark Walnut", exact: true }).click();
  await page.locator("[data-continue]").click();

  const summary = page.locator(".project-summary-card");
  await expect(summary).toContainText("TV Unit");
  await expect(summary).toContainText("Clear Wall");
  await expect(summary).toContainText("126 1/2 in");
  await expect(summary).toContainText("Dark Walnut");
  await page.waitForTimeout(250);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Review your custom concept" })).toBeVisible();
  await expect(page.locator(".project-summary-card")).toContainText("126 1/2 in");
  expect(failures).toEqual([]);
});

test("layered Bookcase Clear Wall remains aligned through finish, review, and reload", async ({ page }) => {
  const failures = monitorRuntime(page);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/configurator.html?start=new", { waitUntil: "networkidle" });
  await page.locator('[data-product-choice="open-shelving"]').click();
  await page.locator("[data-continue]").click();
  await page.locator('[data-layout="clear-wall"]').click();
  await page.locator("[data-continue]").click();

  const measurementRoom = page.locator('.measurement-room[data-layout="clear-wall"]');
  await expect(measurementRoom).toBeVisible();
  const roomAsset = await measurementRoom.getAttribute("data-room-asset");
  expect(roomAsset).toBe("assets/photos/configurator/room-layouts/room-clear-wall-v1.png");
  await page.locator("[data-continue]").click();

  const preview = page.locator(
    '.concept-preview[data-layout="clear-wall"][data-style="full-open-shelving"]'
  );
  const roomImage = preview.locator("img.concept-room-photo");
  const furnitureImage = preview.locator("img.concept-furniture-photo");
  const finishOverlay = preview.locator("svg.concept-finish-overlay");
  await expect(preview).toHaveAttribute("data-preview-render-mode", "room-plus-furniture");
  await expect(preview).toHaveAttribute("data-room-asset", roomAsset);
  await expect(roomImage).toBeVisible();
  await expect(furnitureImage).toBeVisible();
  await expect(finishOverlay).toBeVisible();
  await expect(roomImage).toHaveCSS("object-fit", "cover");
  await expect(furnitureImage).toHaveCSS("object-fit", "cover");
  await expect(finishOverlay).toHaveAttribute("preserveAspectRatio", "xMidYMid slice");

  const alignedLayers = await preview.evaluate((element) => {
    const scene = element.querySelector("[data-concept-scene]");
    const layers = [
      element.querySelector("img.concept-room-photo"),
      element.querySelector("img.concept-furniture-photo"),
      element.querySelector("svg.concept-finish-overlay")
    ];
    const sceneRect = scene.getBoundingClientRect();
    const tolerance = 1;
    return layers.every((layer) => {
      const rect = layer.getBoundingClientRect();
      return Math.abs(rect.left - sceneRect.left) <= tolerance
        && Math.abs(rect.top - sceneRect.top) <= tolerance
        && Math.abs(rect.right - sceneRect.right) <= tolerance
        && Math.abs(rect.bottom - sceneRect.bottom) <= tolerance;
    });
  });
  expect(alignedLayers).toBe(true);

  await page.getByRole("button", { name: "Charcoal", exact: true }).click();
  await expect(preview).toHaveAttribute("data-finish", "charcoal");
  await page.locator("[data-continue]").click();
  await expect(page.locator(".project-summary-card")).toContainText("Clear Wall");
  await expect(page.locator(".project-summary-card")).toContainText("Charcoal");
  await expect(page.locator(".concept-preview")).toHaveAttribute(
    "data-preview-render-mode",
    "room-plus-furniture"
  );
  await expect.poll(() => page.evaluate(() => (
    JSON.parse(localStorage.getItem("jqGuidedConfiguratorDraftV1") || "null")?.currentStep
  ))).toBe(5);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".concept-preview")).toHaveAttribute("data-room-asset", roomAsset);
  await expect(page.locator(".concept-preview img.concept-furniture-photo")).toBeVisible();
  expect(failures).toEqual([]);
});
