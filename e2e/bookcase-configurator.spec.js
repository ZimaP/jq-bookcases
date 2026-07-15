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
  await page.locator('[data-workspace-stage="layout"]').click();
  const ideas = page.locator("[data-properties-inspector] .workspace-foundation-ideas");
  if (await ideas.getAttribute("open") === null) await ideas.locator("summary").click();
  await expect(page.locator("[data-preset-id]").first()).toBeVisible();
}

async function openSectionDesigner(page) {
  await page.locator('[data-workspace-stage="layout"]').click();
  await expect(page.locator('[data-workspace-stage="layout"]')).toHaveAttribute("aria-current", "step");
  await expect(page.locator("[data-properties-inspector]")).toBeVisible();
  await expect(page.locator("[data-section-organizer] [data-section-card]")).toHaveCount(4);
}

function sectionButton(page, index) {
  return page.locator(`[data-section-organizer] [data-section-select="${index}"]`);
}

async function setSectionWidth(page, index, width) {
  await sectionButton(page, index).click();
  const input = page.locator("[data-section-width]");
  await input.fill(String(width));
  await input.press("Enter");
  await expect(page.locator("[data-section-width-error]")).toBeEmpty();
}

async function setSectionType(page, index, type) {
  await sectionButton(page, index).click();
  await page.locator(`[data-properties-inspector] .workspace-section-type-card:has([data-section-type="${type}"])`).click();
}

async function expectReferenceStages(page) {
  const stages = page.locator("[data-workspace-stage]");
  await expect(stages).toHaveCount(7);
  expect(await stages.evaluateAll((items) => items.map((item) => item.dataset.workspaceStage))).toEqual([
    "space", "layout", "storage", "finish", "hardware", "lighting", "preview"
  ]);
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

test("homepage design CTAs force the welcome while plain configurator links resume saved work", async ({ page }) => {
  const errors = monitorRuntime(page);
  await openVerifiedConfigurator(page, "display-wall");
  await page.locator('[data-workspace-stage="storage"]').click();
  await expect(page.locator("[data-builder-form]")).toHaveAttribute("data-diagnostic-workspace-stage", "storage");
  await page.locator("[data-save-design]").first().click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("jqBookcasesDesign"))).not.toBeNull();

  await page.goto("/configurator.html", { waitUntil: "networkidle" });
  await expect(page.locator("[data-3d-viewer]")).toHaveAttribute("data-render-valid", "true");
  await expect(page.getByRole("heading", { name: "Start with your wall. Build it your way." })).toHaveCount(0);
  await expect(page.locator("[data-builder-form]")).toHaveAttribute("data-diagnostic-interface", "unified");

  await page.goto("/index.html", { waitUntil: "networkidle" });
  const heroCta = page.getByRole("region", { name: "Custom built-in bookcases, designed around your space." })
    .getByRole("link", { name: "Design Your Bookcase" });
  await expect(heroCta).toHaveAttribute("href", "configurator.html?start=welcome");
  await heroCta.click();
  await expect(page.getByRole("heading", { name: "Start with your wall. Build it your way." })).toBeVisible();
  await expect(page.getByRole("button", { name: /Start with my space/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Use an editable idea/ })).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("jqBookcasesDesign"))).not.toBeNull();
  expect(new URL(page.url()).searchParams.has("start")).toBe(false);

  await page.goto("/index.html", { waitUntil: "networkidle" });
  const bottomCta = page.getByRole("region", { name: "Build a bookcase you can actually picture at home." })
    .getByRole("link", { name: "Design Your Bookcase" });
  await expect(bottomCta).toHaveAttribute("href", "configurator.html?start=welcome");
  await bottomCta.click();
  await expect(page.getByRole("heading", { name: "Start with your wall. Build it your way." })).toBeVisible();

  await page.goto("/index.html", { waitUntil: "networkidle" });
  const resumeLink = page.locator('a.header-save-button[aria-label="Design Your Bookcase"]');
  await expect(resumeLink).toHaveAttribute("href", "configurator.html?start=resume");
  await resumeLink.click();
  await expect(page.locator("[data-3d-viewer]")).toHaveAttribute("data-render-valid", "true");
  const resumed = await readAcceptedDesign(page);
  expect(resumed.diagnostics.initialSource).toBe("saved");
  expect(resumed.diagnostics.state.layoutPreset).toBe("display-wall");
  expect(resumed.diagnostics.interface).toBe("unified");
  expect(new URL(page.url()).searchParams.has("start")).toBe(false);
  expect(errors).toEqual([]);
});

test("custom-space route creates the first neutral accepted design exactly once", async ({ page }) => {
  const errors = monitorRuntime(page);
  await page.goto("/configurator.html", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Start with my space/ }).click();
  await page.locator('[data-studio-dimension="width"]').fill("108");
  await page.locator('[data-studio-dimension="height"]').fill("100");
  await page.locator('[data-studio-dimension="depth"]').fill("16");
  await expect(page.locator("[data-studio-sections]")).toHaveCount(0);
  await expect(page.getByText("You can change wall width, height, and depth at any time inside the design studio.")).toBeVisible();
  await page.getByRole("button", { name: "Start with these dimensions" }).click();

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
  expect(accepted.diagnostics.interface).toBe("unified");
  expect(accepted.diagnostics.activeInspectorGroup).toBe("sections_layout");
  expect(accepted.diagnostics.activeWorkspaceStage).toBe("layout");
  await expectReferenceStages(page);
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
  expect(accepted.diagnostics.interface).toBe("unified");
  expect(accepted.diagnostics.activeInspectorGroup).toBe("sections_layout");
  expect(accepted.diagnostics.activeWorkspaceStage).toBe("layout");
  await expectReferenceStages(page);
  expect(errors).toEqual([]);
});

test("explicit preset bypass boots with a verified WebGL model and no runtime errors", async ({ page }) => {
  const errors = monitorRuntime(page);
  const viewer = await openVerifiedConfigurator(page);

  await expect(page.locator("[data-price]")).toContainText("$");
  const accepted = await readAcceptedDesign(page);
  expect(accepted.diagnostics.state.width).toBe(96);
  expect(accepted.diagnostics.state.sections).toBe(4);
  expect(accepted.diagnostics.interface).toBe("unified");
  expect(accepted.diagnostics.activeInspectorGroup).toBe("sections_layout");
  expect(accepted.diagnostics.activeWorkspaceStage).toBe("layout");
  await expectReferenceStages(page);
  await expect(viewer).toHaveAttribute("aria-label", /bookcase preview/i);
  expect(errors).toEqual([]);
});

test("workspace display tools are presentation-only and global history spans dimensions and finish", async ({ page }) => {
  const errors = monitorRuntime(page);
  const viewer = await openVerifiedConfigurator(page);
  const baseline = await readAcceptedDesign(page);
  const baselinePrice = baseline.diagnostics.price;
  const baselineUpdates = baseline.diagnostics.updateCount;

  await page.locator("[data-toggle-dimensions]").click();
  await expect(page.locator("[data-toggle-dimensions]")).toHaveAttribute("aria-pressed", "false");
  await page.locator("[data-toggle-wall]").click();
  await expect(page.locator("[data-toggle-wall]")).toHaveAttribute("aria-pressed", "false");
  await page.locator('[data-model-tool="pan"]').click();
  await expect(page.locator('[data-model-tool="pan"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator('[data-model-tool="select"]').click();
  await expect(page.locator('[data-model-tool="select"]')).toHaveAttribute("aria-pressed", "true");
  let current = await readAcceptedDesign(page);
  expect(current.diagnostics.price).toBe(baselinePrice);
  expect(current.diagnostics.updateCount).toBe(baselineUpdates);
  await expect(viewer.locator("canvas")).toHaveCount(1);

  await page.locator('[data-workspace-stage="space"]').click();
  const width = page.locator('[data-properties-inspector] input[type="number"][data-field="width"]');
  await width.fill("100");
  await expect.poll(async () => (await readAcceptedDesign(page)).diagnostics.state.width).toBe(100);

  await page.locator('[data-workspace-stage="finish"]').click();
  const finish = page.locator('[data-properties-inspector] input[data-field="finish"][value="silver_satin"]');
  await page.locator(`label[for="${await finish.getAttribute("id")}"]`).click();
  await expect.poll(async () => (await readAcceptedDesign(page)).diagnostics.state.finish).toBe("silver_satin");

  await page.locator("[data-history-undo]").click();
  current = await readAcceptedDesign(page);
  expect(current.diagnostics.state.finish).toBe("white_dove");
  expect(current.diagnostics.state.width).toBe(100);
  await page.locator("[data-history-undo]").click();
  expect((await readAcceptedDesign(page)).diagnostics.state.width).toBe(96);
  await page.locator("[data-history-redo]").click();
  expect((await readAcceptedDesign(page)).diagnostics.state.width).toBe(100);
  await page.locator("[data-history-redo]").click();
  current = await readAcceptedDesign(page);
  expect(current.diagnostics.state.finish).toBe("silver_satin");
  expect(current.diagnostics.state.width).toBe(100);
  await expect(viewer).toHaveAttribute("data-render-valid", "true");
  expect(errors).toEqual([]);
});

test("direct model selection routes into the fixed stage-aware Properties inspector", async ({ page }) => {
  const errors = monitorRuntime(page);
  await openVerifiedConfigurator(page);
  const selected = await page.locator("[data-bookcase-builder]").evaluate((host) => {
    const controller = host.__bookcaseConfigurator;
    const door = controller.layout.components.find((component) => component.role === "door");
    if (!door) return null;
    const accepted = controller.handleModelSelection({ componentId: door.id, source: "keyboard" });
    return accepted ? door.id : null;
  });
  expect(selected).toBeTruthy();

  await expect(page.locator("[data-properties-inspector]")).toBeVisible();
  await expect(page.locator('[data-workspace-stage="storage"]')).toHaveAttribute("aria-current", "step");
  await expect(page.locator('[data-inspector-tab="doors"]')).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("[data-contextual-editor]")).toHaveCount(0);
  const diagnostics = await page.locator("[data-bookcase-builder]").evaluate((host) => host.__bookcaseConfigurator.getDiagnostics());
  expect(diagnostics.selection.componentId).toBe(selected);
  expect(diagnostics.activeWorkspaceStage).toBe("storage");
  expect(diagnostics.activeInspectorTab).toBe("doors");
  expect(diagnostics.updateCount).toBe(0);
  expect(diagnostics.priceCalculationCount).toBe(1);
  expect(errors).toEqual([]);
});

test("hardware type and finish stay canonical, compatible, selected, and camera-stable", async ({ page }) => {
  const errors = monitorRuntime(page);
  await openVerifiedConfigurator(page, "lower-cabinets");
  await page.locator('[data-workspace-stage="hardware"]').click();
  await expect(page.locator("[data-hardware-type]")).toHaveCount(2);
  await expect(page.locator("[data-hardware-finish]")).toHaveCount(2);
  await expect.poll(() => page.locator("[data-bookcase-builder]").evaluate(
    (host) => host.__bookcaseConfigurator.getDiagnostics().viewer.cameraTransitionActive
  )).toBe(false);

  const readPose = () => page.locator("[data-bookcase-builder]").evaluate((host) => {
    const view = host.__bookcaseConfigurator.getDiagnostics().view;
    return {
      theta: view.theta,
      phi: view.phi,
      radius: view.radius,
      environmentScale: view.environmentScale,
      exposure: view.exposure,
      target: view.target,
      position: view.position
    };
  });

  const initialPose = await readPose();
  await page.locator('.hardware-type-choice:has(input[value="pull"])').click();
  await settleFrames(page, 4);
  await expect(page.locator("[data-hardware-finish]")).toHaveCount(3);
  await expect(page.locator('[data-hardware-type][value="pull"] + span .hardware-selected-mark')).toBeVisible();
  let accepted = await readAcceptedDesign(page);
  expect(accepted.diagnostics.state.hardware).toBe("brass_pull");
  expect(await readPose()).toEqual(initialPose);

  await page.locator('.hardware-finish-choice:has(input[value="matte_black"])').click();
  await settleFrames(page, 4);
  await expect(page.locator('[data-hardware-finish][value="matte_black"] + span .hardware-selected-mark')).toBeVisible();
  accepted = await readAcceptedDesign(page);
  expect(accepted.diagnostics.state.hardware).toBe("matte_black_pull");
  expect(await readPose()).toEqual(initialPose);
  await expect(page.locator("[data-3d-viewer] canvas")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("all ten commercial presets render through the descriptor contract", async ({ page }) => {
  const errors = monitorRuntime(page);
  const viewer = await openVerifiedConfigurator(page);
  await openPresetLibrary(page);

  for (const presetId of presetIds) {
    await openPresetLibrary(page);
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
  await width.fill("");
  await width.press("Enter");
  await expect(width).toHaveValue("");
  await expect(width).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("[data-section-width-error]")).toContainText(/valid clear section width/i);
  await expect(page.locator("[data-price]")).toHaveText(`$${accepted.diagnostics.price.toLocaleString("en-US")}`);
  await expect(viewer).toHaveAttribute("data-render-valid", "true");
  await expect(page.locator("[data-builder-status]")).toContainText(/valid clear section width/i);
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

test("section organizer accepts a mixed design with validated add, duplicate, delete, global history, save, and restore", async ({ page }) => {
  const errors = monitorRuntime(page);
  const viewer = await openVerifiedConfigurator(page);
  await openSectionDesigner(page);

  await page.locator('[data-workspace-stage="space"]').click();
  await page.locator('[data-properties-inspector] input[type="number"][data-field="width"]').fill("132");
  await expect.poll(async () => (await readAcceptedDesign(page)).diagnostics.state.width).toBe(132);
  await openSectionDesigner(page);

  await setSectionWidth(page, 0, 18);
  await setSectionWidth(page, 1, 42);
  await setSectionWidth(page, 2, 20);
  await setSectionType(page, 0, "open");
  await setSectionType(page, 1, "drawers");
  await setSectionType(page, 3, "tall_doors");

  let accepted = await readAcceptedDesign(page);
  expect(accepted.widths).toEqual([18, 42, 20, 48.25]);
  expect(accepted.types).toEqual(["open", "drawers", "lower_doors", "tall_doors"]);
  expect(accepted.doors).toBe(3);
  expect(accepted.drawers).toBe(3);
  expect(accepted.diagnostics.canvasCount).toBe(1);
  await expect(viewer).toHaveAttribute("data-render-valid", "true");

  const overallWidth = accepted.diagnostics.state.width;
  await page.locator("[data-section-organizer] [data-section-add]").click();
  await expect(page.locator("[data-section-organizer] [data-section-card]")).toHaveCount(5);
  expect((await readAcceptedDesign(page)).diagnostics.state.width).toBe(overallWidth);

  // Add Section intentionally creates a neutral, minimum-width bay. Duplicate
  // the still-wide drawer bay so the split remains construction-valid.
  await sectionButton(page, 1).click();
  await expect(page.locator("[data-properties-inspector] [data-section-duplicate]")).toBeEnabled();
  await page.locator("[data-properties-inspector] [data-section-duplicate]").click();
  await expect(page.locator("[data-section-organizer] [data-section-card]")).toHaveCount(6);
  expect((await readAcceptedDesign(page)).diagnostics.state.width).toBe(overallWidth);

  await page.locator("[data-properties-inspector] [data-section-delete]").click();
  await expect(page.locator("[data-section-organizer] [data-section-card]")).toHaveCount(5);
  await page.locator("[data-history-undo]").click();
  await expect(page.locator("[data-section-organizer] [data-section-card]")).toHaveCount(6);
  await page.locator("[data-history-redo]").click();
  await expect(page.locator("[data-section-organizer] [data-section-card]")).toHaveCount(5);
  await page.locator("[data-properties-inspector] [data-section-delete]").click();
  await expect(page.locator("[data-section-organizer] [data-section-card]")).toHaveCount(4);
  accepted = await readAcceptedDesign(page);
  expect(accepted.diagnostics.state.width).toBe(overallWidth);
  expect(accepted.diagnostics.canvasCount).toBe(1);
  const savedWidths = accepted.widths;
  const savedTypes = accepted.types;

  await page.locator("[data-save-design]").first().click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("jqBookcasesDesign") || "null"));
  expect(saved.canonicalConfig.layoutMetadata.sectionTypes).toEqual(savedTypes);
  expect(saved.bom.layoutFingerprint).toBe(saved.layoutFingerprint);

  await page.goto("/configurator.html", { waitUntil: "networkidle" });
  await expect(page.locator("[data-3d-viewer]")).toHaveAttribute("data-render-valid", "true");
  const restored = await readAcceptedDesign(page);
  expect(restored.widths).toEqual(savedWidths);
  expect(restored.types).toEqual(savedTypes);
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
  expect(saved.schemaVersion).toBe(5);
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
    { width: 2011, height: 1198 },
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
    const composition = await page.evaluate(() => {
      const shell = document.querySelector(".studio-entry-shell");
      const leftCopy = document.querySelector(".studio-welcome-heading p");
      const rightCopy = document.querySelector(".studio-intro-heading p");
      const preview = document.querySelector(".studio-preview-composition");
      const leftTitle = document.querySelector(".studio-welcome-heading h1").getBoundingClientRect();
      const rightTitle = document.querySelector(".studio-intro-heading h2").getBoundingClientRect();
      const rightHeading = document.querySelector(".studio-intro-heading").getBoundingClientRect();
      const previewBounds = preview.getBoundingClientRect();
      const stageBounds = document.querySelector(".studio-intro-stage").getBoundingClientRect();
      const drawingBounds = document.querySelector(".studio-preview-drawing").getBoundingClientRect();
      return {
        bodyToken: getComputedStyle(shell).getPropertyValue("--studio-type-body").trim(),
        leftBodySize: getComputedStyle(leftCopy).fontSize,
        rightBodySize: getComputedStyle(rightCopy).fontSize,
        previewHeight: previewBounds.height,
        leftTitleSize: parseFloat(getComputedStyle(document.querySelector(".studio-welcome-heading h1")).fontSize),
        rightTitleSize: parseFloat(getComputedStyle(document.querySelector(".studio-intro-heading h2")).fontSize),
        titleTopDelta: Math.abs(leftTitle.top - rightTitle.top),
        rightCenterDelta: Math.abs((rightHeading.left + rightHeading.width / 2) - (previewBounds.left + previewBounds.width / 2)),
        previewStageCenterDelta: Math.abs((previewBounds.left + previewBounds.width / 2) - (stageBounds.left + stageBounds.width / 2)),
        drawingCenterDelta: Math.abs((drawingBounds.left + drawingBounds.width / 2) - (previewBounds.left + previewBounds.width / 2)),
        verticalSpaceDelta: Math.abs((rightHeading.top - stageBounds.top) - (stageBounds.bottom - previewBounds.bottom)),
        variantSize: parseFloat(getComputedStyle(document.querySelector(".studio-preview-variants button")).fontSize),
        dimensionSize: parseFloat(getComputedStyle(document.querySelector(".studio-dimension-line small")).fontSize),
        calloutSize: parseFloat(getComputedStyle(document.querySelector(".studio-preview-callout")).fontSize)
      };
    });
    expect(composition.bodyToken).toBe("13px");
    expect(composition.leftBodySize).toBe(composition.rightBodySize);
    expect(composition.leftTitleSize).toBe(composition.rightTitleSize);
    expect(composition.drawingCenterDelta).toBeLessThanOrEqual(1);
    if (viewport.width > 760) {
      expect(composition.previewHeight).toBeLessThanOrEqual(620.5);
      expect(composition.titleTopDelta).toBeLessThanOrEqual(1);
      expect(composition.rightCenterDelta).toBeLessThanOrEqual(1);
      expect(composition.previewStageCenterDelta).toBeLessThanOrEqual(1);
      if (viewport.height >= 1100) expect(composition.verticalSpaceDelta).toBeLessThanOrEqual(8);
      expect(composition.variantSize).toBeGreaterThanOrEqual(13);
      expect(composition.dimensionSize).toBeGreaterThanOrEqual(13);
      expect(composition.calloutSize).toBeGreaterThanOrEqual(12);
    } else {
      expect(composition.variantSize).toBeGreaterThanOrEqual(11);
      expect(composition.calloutSize).toBeGreaterThanOrEqual(10);
    }
    await page.screenshot({
      path: `test-results/custom-studio-qa/welcome-${viewport.width}x${viewport.height}.png`,
      animations: "disabled"
    });
    await page.getByRole("button", { name: /Start with my space/ }).click();
    await expect(page.locator("[data-studio-sections]")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Start with these dimensions" })).toBeVisible();
    const customHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(customHorizontalOverflow).toBeLessThanOrEqual(1);
    if (viewport.width <= 760) {
      await page.screenshot({
        path: `test-results/custom-studio-qa/custom-${viewport.width}x${viewport.height}.png`,
        fullPage: true,
        animations: "disabled"
      });
    }
  }
  expect(errors).toEqual([]);
});

test("opening a studio route preserves the desktop composition anchors", async ({ page }) => {
  const viewports = [
    { width: 2005, height: 1199 },
    { width: 1440, height: 900 },
    { width: 1024, height: 900 }
  ];
  const errors = monitorRuntime(page);
  const measure = () => page.evaluate(() => {
    const rect = (selector) => {
      const bounds = document.querySelector(selector).getBoundingClientRect();
      return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
    };
    return {
      heading: rect(".studio-welcome-heading"),
      stageHeading: rect(".studio-intro-heading"),
      preview: rect(".studio-preview-composition")
    };
  });

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/configurator.html", { waitUntil: "networkidle" });
    const welcome = await measure();
    await page.locator(".studio-intro-stage").evaluate((stage) => {
      stage.dataset.routeTransitionSentinel = "preserved";
    });
    await page.getByRole("button", { name: /Start with my space/ }).click();
    const custom = await measure();
    await page.screenshot({
      path: `test-results/custom-studio-qa/custom-${viewport.width}x${viewport.height}.png`,
      animations: "disabled"
    });
    await page.getByRole("button", { name: "Back to studio start" }).click();
    await page.getByRole("button", { name: /Use an editable idea/ }).click();
    const ideas = await measure();

    await expect(page.locator(".studio-intro-stage")).toHaveAttribute("data-route-transition-sentinel", "preserved");
    for (const route of [custom, ideas]) {
      expect(Math.abs(route.heading.x - welcome.heading.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(route.heading.y - welcome.heading.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(route.stageHeading.x - welcome.stageHeading.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(route.stageHeading.y - welcome.stageHeading.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(route.preview.x - welcome.preview.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(route.preview.y - welcome.preview.y)).toBeLessThanOrEqual(1);
    }
    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(horizontalOverflow).toBeLessThanOrEqual(1);
  }
  expect(errors).toEqual([]);
});

test("navigation hover uses the shared underline position on every public page", async ({ page }) => {
  const routes = [
    "/index.html",
    "/how-it-works.html",
    "/materials.html",
    "/inspiration.html",
    "/about.html",
    "/faq.html",
    "/configurator.html?start=welcome"
  ];

  for (const route of routes) {
    await page.goto(route, { waitUntil: "networkidle" });
    const link = page.locator('.nav-links a.nav-link', { hasText: "How It Works" });
    await link.hover();
    const underline = await link.evaluate((element) => {
      const style = getComputedStyle(element, "::after");
      return { bottom: style.bottom, height: style.height };
    });
    expect(underline).toEqual({ bottom: "7px", height: "1px" });
  }
});

test("Start over clears the accepted design and returns to both studio routes", async ({ page }) => {
  await openVerifiedConfigurator(page, "display-wall");
  await page.locator('[data-workspace-stage="preview"]').click();
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
  await page.locator('[data-workspace-stage="layout"]').click();
  await expect(page.locator('[data-workspace-stage="layout"]')).toHaveAttribute("aria-current", "step");
  await expect(page.locator("[data-properties-inspector]")).toBeVisible();
  await expect(page.locator("[data-section-width]")).toBeVisible();
  await expect(page.locator("[data-section-organizer] [data-section-card]")).toHaveCount(4);
  await expectReferenceStages(page);
  expect(await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth))).toBeLessThanOrEqual(1);
  await settleFrames(page);
  await page.screenshot({
    path: "test-results/preset-gallery/mobile-classic-open.png",
    fullPage: true,
    animations: "disabled"
  });
  expect(errors).toEqual([]);
});
