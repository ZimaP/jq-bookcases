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
  await page.locator('[data-product="tv-unit"]').click();
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
