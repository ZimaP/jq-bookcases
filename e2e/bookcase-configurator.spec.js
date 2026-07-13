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

async function settleFrames(page, count = 3) {
  await page.evaluate(async (frameCount) => {
    for (let index = 0; index < frameCount; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }, count);
}

async function readRenderDiagnostics(viewer) {
  return viewer.evaluate((element) => ({
    valid: element.dataset.renderValid,
    components: Number(element.dataset.renderComponents || 0),
    expected: Number(element.dataset.renderExpected || 0),
    geometries: Number(element.dataset.webglGeometries || 0),
    textures: Number(element.dataset.webglTextures || 0),
    calls: Number(element.dataset.webglCalls || 0),
    triangles: Number(element.dataset.webglTriangles || 0)
  }));
}

async function openVerifiedConfigurator(page) {
  await page.goto("/configurator.html", { waitUntil: "networkidle" });
  const viewer = page.locator("[data-3d-viewer]");
  await expect(viewer).toBeVisible();
  await expect(viewer).toHaveAttribute("data-render-valid", "true", { timeout: 20_000 });
  await expect(viewer.locator("canvas")).toHaveCount(1);
  await settleFrames(page);
  const diagnostics = await readRenderDiagnostics(viewer);
  expect(diagnostics.components).toBeGreaterThan(0);
  expect(diagnostics.components).toBe(diagnostics.expected);
  expect(diagnostics.geometries).toBeGreaterThan(0);
  expect(diagnostics.calls).toBeGreaterThan(0);
  expect(diagnostics.triangles).toBeGreaterThan(0);
  return viewer;
}

async function openSectionDesigner(page) {
  await page.locator('[data-guided-step="storage"]').click();
  await page.locator("[data-section-designer-open]").click();
  await expect(page.locator("[data-section-designer]")).toBeVisible();
  await expect(page.locator("[data-section-select]")).toHaveCount(4);
}

async function setSectionWidth(page, index, width) {
  await page.locator(`[data-section-select="${index}"]`).click();
  const input = page.locator("[data-section-width]");
  await input.fill(String(width));
  await input.press("Enter");
  await expect(page.locator("[data-section-width-error]")).toBeEmpty();
}

async function setSectionType(page, index, type) {
  await page.locator(`[data-section-select="${index}"]`).click();
  await page.locator(`[data-section-type="${type}"]`).check();
}

async function readAcceptedDesign(page) {
  return page.locator("[data-bookcase-builder]").evaluate((host) => {
    const configurator = host.__bookcaseConfigurator;
    return {
      diagnostics: configurator.getDiagnostics(),
      widths: configurator.layout.metrics.sectionClearWidths,
      types: configurator.layout.components
        .filter((component) => component.role === "section")
        .map((component) => component.metadata.type),
      doors: configurator.layout.components.filter((component) => component.role === "door").length,
      drawers: configurator.layout.components.filter((component) => component.role === "drawer_front").length
    };
  });
}

test("default configurator boots with a verified WebGL model and no runtime errors", async ({ page }) => {
  const errors = monitorRuntime(page);
  const viewer = await openVerifiedConfigurator(page);

  await expect(page.locator("[data-price]")).toContainText("$");
  const accepted = await readAcceptedDesign(page);
  expect(accepted.diagnostics.state.width).toBe(96);
  expect(accepted.diagnostics.state.sections).toBe(4);
  await expect(viewer).toHaveAttribute("aria-label", /bookcase preview/i);
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
    await settleFrames(page);
    const diagnostics = await readRenderDiagnostics(viewer);
    expect(diagnostics.components).toBe(diagnostics.expected);
    await viewer.screenshot({
      path: `test-results/preset-gallery/${presetId}.png`,
      animations: "disabled"
    });
  }

  expect(errors).toEqual([]);
});

test("an invalid section draft preserves the accepted model, BOM, price, and save identity", async ({ page }) => {
  const errors = monitorRuntime(page);
  const viewer = await openVerifiedConfigurator(page);
  await openSectionDesigner(page);
  const accepted = await readAcceptedDesign(page);
  const acceptedDiagnostics = await readRenderDiagnostics(viewer);

  const width = page.locator("[data-section-width]");
  await width.fill("10");
  await width.press("Enter");
  await expect(width).toHaveValue("10");
  await expect(page.locator("[data-section-width-error]")).toContainText(/at least 15 in clear/i);
  await expect(page.locator("[data-price]")).toHaveText(`$${accepted.diagnostics.price.toLocaleString("en-US")}`);
  await expect(viewer).toHaveAttribute("data-render-valid", "true");
  await expect(page.locator("[data-builder-status]")).toContainText(/at least 15 in clear/i);
  await expect(viewer.locator("canvas")).toHaveCount(1);
  await settleFrames(page);
  const rejected = await readAcceptedDesign(page);
  const rejectedDiagnostics = await readRenderDiagnostics(viewer);
  expect(rejected.widths).toEqual(accepted.widths);
  expect(rejected.diagnostics.pricing.bom.layoutFingerprint).toBe(accepted.diagnostics.pricing.bom.layoutFingerprint);
  expect(rejected.diagnostics.price).toBe(accepted.diagnostics.price);
  expect(rejected.diagnostics.updateCount).toBe(accepted.diagnostics.updateCount);
  expect(rejectedDiagnostics.components).toBe(acceptedDiagnostics.components);
  expect(rejectedDiagnostics.expected).toBe(acceptedDiagnostics.expected);
  expect(errors).toEqual([]);
});

test("Section Designer accepts the canonical mixed design with undo, redo, split, merge, save, and restore", async ({ page }) => {
  const errors = monitorRuntime(page);
  const viewer = await openVerifiedConfigurator(page);
  await openSectionDesigner(page);

  await setSectionWidth(page, 0, 18);
  await setSectionWidth(page, 1, 30);
  await setSectionWidth(page, 2, 20);
  await setSectionType(page, 0, "open");
  await setSectionType(page, 1, "drawers");
  await setSectionType(page, 3, "tall_doors");

  let accepted = await readAcceptedDesign(page);
  expect(accepted.widths).toEqual([18, 30, 20, 24.25]);
  expect(accepted.types).toEqual(["open", "drawers", "lower_doors", "tall_doors"]);
  expect(accepted.doors).toBe(3);
  expect(accepted.drawers).toBe(3);
  expect(accepted.diagnostics.canvasCount).toBe(1);
  await expect(viewer).toHaveAttribute("data-render-valid", "true");

  await page.locator('[data-section-select="1"]').click();
  await setSectionWidth(page, 1, 31);
  const beforeSplit = await readAcceptedDesign(page);
  await page.locator("[data-section-split]").click();
  await expect(page.locator("[data-section-select]")).toHaveCount(5);
  await page.locator('[data-section-merge="right"]').click();
  await expect(page.locator("[data-section-select]")).toHaveCount(4);
  accepted = await readAcceptedDesign(page);
  expect(accepted.widths).toEqual(beforeSplit.widths);

  await page.locator("[data-section-undo]").click();
  await expect(page.locator("[data-section-select]")).toHaveCount(5);
  await page.locator("[data-section-redo]").click();
  await expect(page.locator("[data-section-select]")).toHaveCount(4);
  await setSectionWidth(page, 1, 30);
  accepted = await readAcceptedDesign(page);
  expect(accepted.widths).toEqual([18, 30, 20, 24.25]);

  await page.locator("[data-save-design]").first().click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("jqBookcasesDesign") || "null"));
  expect(saved.canonicalConfig.layoutMetadata.sectionTypes).toEqual(["open", "drawers", "lower_doors", "tall_doors"]);
  expect(saved.bom.layoutFingerprint).toBe(saved.layoutFingerprint);

  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator("[data-3d-viewer]")).toHaveAttribute("data-render-valid", "true");
  const restored = await readAcceptedDesign(page);
  expect(restored.widths).toEqual([18, 30, 20, 24.25]);
  expect(restored.types).toEqual(["open", "drawers", "lower_doors", "tall_doors"]);
  expect(restored.diagnostics.pricing.bom.layoutFingerprint).toBe(saved.layoutFingerprint);
  expect(errors).toEqual([]);
});

test("one hundred successive section edits remain resource-bounded", async ({ page }) => {
  const errors = monitorRuntime(page);
  const viewer = await openVerifiedConfigurator(page);
  await openSectionDesigner(page);
  const baseline = await readRenderDiagnostics(viewer);

  await page.evaluate(() => {
    for (let cycle = 0; cycle < 50; cycle += 1) {
      document.querySelector('[data-section-width-step="0.5"]')?.click();
      document.querySelector('[data-section-width-step="-0.5"]')?.click();
    }
  });

  await settleFrames(page, 8);
  const final = await readRenderDiagnostics(viewer);
  const accepted = await readAcceptedDesign(page);
  expect(accepted.widths).toEqual([23.0625, 23.0625, 23.0625, 23.0625]);
  expect(accepted.diagnostics.updateCount).toBe(100);
  expect(accepted.diagnostics.canvasCount).toBe(1);
  expect(final.components).toBe(final.expected);
  expect(final.components).toBe(baseline.components);
  // Three.js retains a small bounded set of resized buffer variants; it must
  // not grow with the 100 accepted rebuilds.
  expect(final.geometries).toBeLessThanOrEqual(baseline.geometries + 6);
  expect(final.textures).toBeLessThanOrEqual(baseline.textures + 2);
  expect(errors).toEqual([]);
});

test("saved schema-v4 design is canonical, reloadable, and quote-ready", async ({ page }) => {
  const errors = monitorRuntime(page);
  const viewer = await openVerifiedConfigurator(page);

  await page.locator('[data-preset-id="display-wall"]').click();
  await expect(viewer).toHaveAttribute("data-render-valid", "true");
  await page.locator("[data-save-design]").first().click();
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

test("rapid preset cycling is leak-bounded and leaves one verified model", async ({ page }) => {
  const errors = monitorRuntime(page);
  const viewer = await openVerifiedConfigurator(page);
  const baseline = await readRenderDiagnostics(viewer);

  await page.evaluate((ids) => {
    for (let cycle = 0; cycle < 10; cycle += 1) {
      for (const presetId of ids) document.querySelector(`[data-preset-id="${presetId}"]`)?.click();
    }
    document.querySelector('[data-preset-id="lower-cabinets"]')?.click();
  }, presetIds);
  await expect(viewer).toHaveAttribute("data-render-valid", "true");
  await expect(page.locator('[data-preset-id="lower-cabinets"]')).toHaveAttribute("aria-pressed", "true");
  await expect(viewer.locator("canvas")).toHaveCount(1);
  await expect(page.locator("[data-bookcase-builder] canvas")).toHaveCount(1);
  await settleFrames(page, 6);

  const final = await readRenderDiagnostics(viewer);
  expect(final.components).toBe(final.expected);
  expect(final.components).toBe(baseline.components);
  expect(final.geometries).toBeLessThanOrEqual(baseline.geometries + 2);
  expect(final.textures).toBeLessThanOrEqual(baseline.textures + 2);
  expect(errors).toEqual([]);
});

test("mobile viewport keeps controls usable and the accepted model valid", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = monitorRuntime(page);
  const viewer = await openVerifiedConfigurator(page);

  await expect(page.locator("[data-save-design]").first()).toBeVisible();
  await page.locator('[data-preset-id="classic-open"]').click();
  await expect(viewer).toHaveAttribute("data-render-valid", "true");
  await expect(page.locator('[data-preset-id="classic-open"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator('[data-guided-step="storage"]').click();
  await expect(page.locator("[data-section-designer-open]")).toBeVisible();
  await page.locator("[data-section-designer-open]").click();
  await expect(page.locator("[data-section-designer]")).toBeVisible();
  await expect(page.locator("[data-section-width]")).toBeVisible();
  await expect(page.locator("[data-section-select]")).toHaveCount(4);
  await settleFrames(page);
  await page.screenshot({
    path: "test-results/preset-gallery/mobile-classic-open.png",
    fullPage: true,
    animations: "disabled"
  });
  expect(errors).toEqual([]);
});
