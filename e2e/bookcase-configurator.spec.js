import { test, expect } from "@playwright/test";

const presetIds = [
  "lower-cabinets",
  "classic-open",
  "media-wall",
  "library-wall",
  "display-wall",
  "glass-library",
  "desk-niche",
  "feature-wall",
  "asymmetric-modern",
  "tall-storage"
];

function monitorRuntime(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  return errors;
}

async function openVerifiedConfigurator(page) {
  await page.goto("/configurator.html", { waitUntil: "networkidle" });
  const viewer = page.locator("[data-3d-viewer]");
  await expect(viewer).toBeVisible();
  await expect(viewer).toHaveAttribute("data-render-valid", "true", { timeout: 20_000 });
  await expect(viewer.locator("canvas")).toHaveCount(1);
  return viewer;
}

test("default configurator boots with a verified WebGL model and no runtime errors", async ({ page }) => {
  const errors = monitorRuntime(page);
  const viewer = await openVerifiedConfigurator(page);

  await expect(page.locator("[data-price]")).toContainText("$");
  await expect(page.locator('[data-field="width"]').first()).toHaveValue("96");
  await expect(page.locator('[data-field="sections"]')).toHaveValue("4");
  await expect(viewer).toHaveAttribute("aria-label", /Interactive 3D/i);
  expect(errors).toEqual([]);
});

test("all ten commercial presets render through the descriptor contract", async ({ page }) => {
  const errors = monitorRuntime(page);
  const viewer = await openVerifiedConfigurator(page);

  for (const presetId of presetIds) {
    const card = page.locator(`[data-preset-id="${presetId}"]`);
    await card.click();
    await expect(card).toHaveAttribute("aria-pressed", "true");
    await expect(viewer).toHaveAttribute("data-render-valid", "true");
    await expect(viewer.locator("canvas")).toHaveCount(1);
  }

  expect(errors).toEqual([]);
});

test("an invalid candidate rolls controls and price back while preserving the verified model", async ({ page }) => {
  const errors = monitorRuntime(page);
  const viewer = await openVerifiedConfigurator(page);
  const width = page.locator("#jq-builder-1-width-number");
  const sections = page.locator("#jq-builder-1-sections-number");
  const price = page.locator("[data-price]");

  await width.fill("144");
  await expect(width).toHaveValue("144");
  await expect(viewer).toHaveAttribute("data-render-valid", "true");
  const acceptedPrice = await price.textContent();

  await sections.fill("1");
  await expect(sections).toHaveValue("4");
  await expect(price).toHaveText(acceptedPrice || "");
  await expect(viewer).toHaveAttribute("data-render-valid", "true");
  await expect(page.locator("[data-builder-status]")).toContainText(/shelf span/i);
  await expect(viewer.locator("canvas")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("saved schema-v4 design is canonical, reloadable, and quote-ready", async ({ page }) => {
  const errors = monitorRuntime(page);
  const viewer = await openVerifiedConfigurator(page);

  await page.locator('[data-preset-id="display-wall"]').click();
  await expect(viewer).toHaveAttribute("data-render-valid", "true");
  await page.locator("[data-save-design]").click();
  await expect(page.locator("[data-builder-status]")).toContainText(/Saved design JQ-/i);

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("jqBookcasesDesign") || "null"));
  expect(saved).toBeTruthy();
  expect(saved.schemaVersion).toBe(4);
  expect(saved.id).toMatch(/^JQ-[0-9A-Z]{7}$/);
  expect(saved.canonicalConfig.layoutPreset).toBe("display-wall");
  expect(saved.layoutFingerprint).toMatch(/^jq-layout-v1-[0-9a-f]{16}$/);
  expect(saved.bom.layoutFingerprint).toBe(saved.layoutFingerprint);
  expect(saved.priceBreakdown.total).toBe(saved.total);
  expect(saved).not.toHaveProperty("layout");
  expect(saved).not.toHaveProperty("components");

  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator("[data-3d-viewer]")).toHaveAttribute("data-render-valid", "true");
  await expect(page.locator('[data-preset-id="display-wall"]')).toHaveAttribute("aria-pressed", "true");

  await page.goto(`/request-quote.html?design=${encodeURIComponent(saved.id)}`, { waitUntil: "networkidle" });
  await expect(page.locator("[data-saved-design-summary]")).toBeVisible();
  await expect(page.locator("[data-saved-design-summary]")).toContainText(saved.id);
  await expect(page.locator('[name="designId"]')).toHaveValue(saved.id);
  await expect(page.locator('[name="wallWidth"]')).toHaveValue(`${saved.canonicalConfig.width}\"`);
  await expect(page.locator('[name="layout"]')).toHaveValue("display-wall");
  expect(errors).toEqual([]);
});

test("rapid preset cycling leaves one canvas and a verified final model", async ({ page }) => {
  const errors = monitorRuntime(page);
  const viewer = await openVerifiedConfigurator(page);

  for (let cycle = 0; cycle < 3; cycle += 1) {
    for (const presetId of presetIds) {
      await page.locator(`[data-preset-id="${presetId}"]`).click();
    }
  }

  await page.locator('[data-preset-id="lower-cabinets"]').click();
  await expect(viewer).toHaveAttribute("data-render-valid", "true");
  await expect(page.locator('[data-preset-id="lower-cabinets"]')).toHaveAttribute("aria-pressed", "true");
  await expect(viewer.locator("canvas")).toHaveCount(1);
  await expect(page.locator("[data-bookcase-builder] canvas")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("mobile viewport keeps controls usable and the accepted model valid", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = monitorRuntime(page);
  const viewer = await openVerifiedConfigurator(page);

  await expect(page.locator("#jq-builder-1-width-number")).toBeVisible();
  await expect(page.locator("[data-save-design]")).toBeVisible();
  await page.locator('[data-preset-id="classic-open"]').click();
  await expect(viewer).toHaveAttribute("data-render-valid", "true");
  await expect(page.locator('[data-preset-id="classic-open"]')).toHaveAttribute("aria-pressed", "true");
  expect(errors).toEqual([]);
});
