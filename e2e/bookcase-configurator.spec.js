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

async function openVerifiedConfigurator(page, presetId = "lower-cabinets") {
  await page.goto(`/configurator.html?preset=${encodeURIComponent(presetId)}`, { waitUntil: "networkidle" });
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

async function openPresetLibrary(page) {
  const allControls = page.getByRole("tab", { name: /All Controls/ });
  if (await allControls.getAttribute("aria-selected") !== "true") await allControls.click();
  const trigger = page.locator('[data-category-trigger="layout"]');
  if (await trigger.getAttribute("aria-expanded") !== "true") await trigger.click();
  await expect(page.locator("[data-preset-id]").first()).toBeVisible();
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

test("new visitor sees an unnumbered presentation-only welcome with no commercial artifacts", async ({ page }) => {
  const errors = monitorRuntime(page);
  await page.goto("/configurator.html", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "Start with your wall. Build it your way." })).toBeVisible();
  await expect(page.getByRole("button", { name: /Start with my space/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Use an editable idea/ })).toBeVisible();
  await expect(page.locator("[data-3d-viewer]")).toHaveCount(0);
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.locator("[data-save-design], [data-open-order], [data-open-ar]")).toHaveCount(0);
  await expect(page.locator("[data-price]")).toHaveText("Your estimate will appear as you build");
  await expect(page.getByRole("button", { name: "Save after you start" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Quote after you start" })).toBeDisabled();

  const diagnostics = await page.locator("[data-builder-form]").evaluate((shell) => ({ ...shell.dataset }));
  expect(diagnostics.diagnosticAcceptedDesign).toBe("false");
  expect(diagnostics.diagnosticEntryView).toBe("welcome");
  expect(diagnostics.diagnosticPriceCalculations).toBe("0");
  expect(diagnostics.diagnosticPhysicalUpdates).toBe("0");
  expect(diagnostics.diagnosticConfiguration).toBe("null");
  expect(diagnostics.diagnosticPricing).toBe("null");
  expect(errors).toEqual([]);
});

test("custom-space route creates the first neutral accepted design exactly once", async ({ page }) => {
  const errors = monitorRuntime(page);
  await page.goto("/configurator.html", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Start with my space/ }).click();
  await page.locator('[data-studio-dimension="width"]').fill("108");
  await page.locator('[data-studio-dimension="height"]').fill("100");
  await page.locator('[data-studio-dimension="depth"]').fill("16");
  await page.locator('[data-studio-sections][value="5"]').check();
  await page.getByRole("button", { name: "Build my starting structure" }).click();

  const viewer = page.locator("[data-3d-viewer]");
  await expect(viewer).toHaveAttribute("data-render-valid", "true", { timeout: 20_000 });
  await expect(viewer.locator("canvas")).toHaveCount(1);
  const accepted = await readAcceptedDesign(page);
  expect(accepted.diagnostics.acceptedDesign).toBe(true);
  expect(accepted.diagnostics.state.width).toBe(108);
  expect(accepted.diagnostics.state.height).toBe(100);
  expect(accepted.diagnostics.state.depth).toBe(16);
  expect(accepted.diagnostics.state.sections).toBe(5);
  expect(accepted.diagnostics.state.lowerCabinets).toBe(false);
  expect(accepted.diagnostics.state.lighting).toBe("no_lighting");
  expect(accepted.diagnostics.priceCalculationCount).toBe(1);
  expect(accepted.diagnostics.updateCount).toBe(0);
  expect(errors).toEqual([]);
});

test("idea route filters real configurations and accepts one editable idea", async ({ page }) => {
  const errors = monitorRuntime(page);
  await page.goto("/configurator.html", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Use an editable idea/ }).click();
  await expect(page.locator("[data-idea-id]")).toHaveCount(6);
  await expect(page.getByRole("button", { name: "View all 10 editable ideas" })).toBeVisible();
  await page.getByRole("button", { name: "Storage", exact: true }).click();
  await expect(page.locator("[data-idea-id]")).toHaveCount(4);
  await page.locator('[data-idea-id="display-wall"]').click();
  await expect(page.locator("[data-3d-viewer]")).toHaveAttribute("data-render-valid", "true", { timeout: 20_000 });
  const accepted = await readAcceptedDesign(page);
  expect(accepted.diagnostics.state.layoutPreset).toBe("display-wall");
  expect(accepted.diagnostics.initialSource).toBe("idea");
  expect(accepted.diagnostics.guidedStep).toBe("dimensions");
  expect(errors).toEqual([]);
});

test("explicit preset bypass boots with a verified WebGL model and no runtime errors", async ({ page }) => {
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
  await openPresetLibrary(page);

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

  await page.goto("/configurator.html", { waitUntil: "networkidle" });
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

  await openPresetLibrary(page);
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

  await page.goto("/configurator.html", { waitUntil: "networkidle" });
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
  await openPresetLibrary(page);

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

test("welcome composition is usable at every required desktop and mobile viewport", async ({ page }) => {
  const viewports = [
    { width: 1440, height: 900 },
    { width: 1024, height: 900 },
    { width: 390, height: 844 },
    { width: 360, height: 800 }
  ];
  const errors = monitorRuntime(page);
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/configurator.html", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Start with your wall. Build it your way." })).toBeVisible();
    await expect(page.getByRole("button", { name: /Start with my space/ })).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(0);
    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(horizontalOverflow).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: `artifacts/custom-studio-qa/welcome-${viewport.width}x${viewport.height}.png`,
      animations: "disabled"
    });
  }
  expect(errors).toEqual([]);
});

test("Start over clears the accepted design and returns to both studio routes", async ({ page }) => {
  await openVerifiedConfigurator(page, "display-wall");
  await openPresetLibrary(page);
  await page.getByRole("button", { name: "Start over", exact: true }).click();
  await page.getByRole("button", { name: "Confirm start over", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Start with your wall. Build it your way." })).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.locator("[data-3d-viewer]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Start with my space/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Use an editable idea/ })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("jqBookcasesDesign"))).toBeNull();
});

test("mobile viewport keeps controls usable and the accepted model valid", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = monitorRuntime(page);
  const viewer = await openVerifiedConfigurator(page);

  await expect(page.locator("[data-save-design]").first()).toBeVisible();
  await openPresetLibrary(page);
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
