import { test, expect } from "@playwright/test";

const publicRoutes = [
  "/index.html",
  "/configurator.html?start=welcome",
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
  page.on("requestfailed", (request) => failures.push(`request: ${request.url()} ${request.failure()?.errorText || "failed"}`));
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

test("a physical dimension edit rebuilds one valid model and survives reload", async ({ page }) => {
  const failures = monitorRuntime(page);
  await page.goto("/configurator.html?preset=lower-cabinets", { waitUntil: "networkidle" });
  const viewer = page.locator("[data-3d-viewer]");
  await expect(viewer).toHaveAttribute("data-render-valid", "true", { timeout: 20_000 });
  const spaceStage = page.locator('[data-workspace-stage="space"]');
  await spaceStage.click();
  await expect(spaceStage).toHaveAttribute("aria-current", "location");
  const inspector = page.locator("[data-properties-inspector]");
  await expect(inspector).toBeVisible();
  await expect(inspector.locator('[data-active-stage-panel="space"]')).toBeVisible();
  const width = inspector.locator('input[type="number"][data-field="width"]');
  await width.fill("120");
  await width.press("Enter");
  await expect(width).toHaveValue("120");
  await expect(viewer).toHaveAttribute("data-render-valid", "true");
  await page.locator("[data-save-design]").first().click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("jqBookcasesDesign") || "null")?.canonicalConfig?.width)).toBe(120);

  await page.goto("/configurator.html", { waitUntil: "networkidle" });
  await expect(page.locator("[data-3d-viewer]")).toHaveAttribute("data-render-valid", "true", { timeout: 20_000 });
  const restoredWidth = await page.locator("[data-bookcase-builder]").evaluate((host) => host.__bookcaseConfigurator?.state?.width);
  expect(restoredWidth).toBe(120);
  expect(failures).toEqual([]);
});

test("room-view entry prepares the real procedural GLB and closes back to its invoker", async ({ page }) => {
  const failures = monitorRuntime(page);
  await page.route("https://ajax.googleapis.com/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/javascript",
    headers: { "access-control-allow-origin": "*" },
    body: "if (!customElements.get('model-viewer')) customElements.define('model-viewer', class extends HTMLElement {});"
  }));
  await page.route("https://cdn.jsdelivr.net/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/javascript",
    headers: { "access-control-allow-origin": "*" },
    body: "export async function toCanvas(canvas) { const context = canvas.getContext('2d'); context.fillStyle = '#302923'; context.fillRect(0, 0, 12, 12); }"
  }));

  await page.goto("/configurator.html?preset=display-wall", { waitUntil: "networkidle" });
  await expect(page.locator("[data-3d-viewer]")).toHaveAttribute("data-render-valid", "true", { timeout: 20_000 });
  const launch = page.locator("[data-open-ar]").first();
  await launch.click();
  const dialog = page.locator("dialog.cabinet-ar-dialog");
  await expect(dialog).toBeVisible();
  const model = dialog.locator("model-viewer");
  await expect(model).toBeVisible({ timeout: 20_000 });
  await expect(model).toHaveAttribute("src", /^blob:/);
  await expect(model).toHaveAttribute("ar-scale", "fixed");
  await expect(model).toHaveAttribute("ar-placement", "floor");
  await expect(dialog.getByText("Open on your phone")).toBeVisible();
  await dialog.getByRole("button", { name: "Close room view" }).click();
  await expect(dialog).toBeHidden();
  await expect(launch).toBeFocused();
  expect(failures).toEqual([]);
});
