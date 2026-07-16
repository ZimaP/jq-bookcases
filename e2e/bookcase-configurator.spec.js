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

const welcomePreviewStates = [
  { index: 0, label: "Open framework", id: "classic-open", name: "Open Shelves", width: 96, height: 96, callouts: ["Add shelves", "Resize sections"] },
  { index: 1, label: "Mixed storage", id: "display-wall", name: "Display Wall", width: 102, height: 96, callouts: ["Add drawers", "Add doors"] },
  { index: 2, label: "Tall zones", id: "tall-storage", name: "Tall Storage + Shelves", width: 132, height: 96, callouts: ["Add tall doors", "Mix storage"] }
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

async function openSectionDesigner(page, expectedSectionCount = null) {
  await page.locator('[data-workspace-stage="layout"]').click();
  await expect(page.locator('[data-workspace-stage="layout"]')).toHaveAttribute("aria-current", "location");
  await expect(page.locator("[data-properties-inspector]")).toBeVisible();
  if (Number.isInteger(expectedSectionCount)) {
    await expect(page.locator("[data-section-organizer] [data-section-card]")).toHaveCount(expectedSectionCount);
  }
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
  const storagePresetByType = {
    open: "open_shelves",
    lower_doors: "lower_doors",
    drawers: "lower_drawers",
    tall_doors: "full_doors"
  };
  const presetId = storagePresetByType[type];
  if (!presetId) throw new Error(`No Storage preset is defined for section type: ${type}`);
  await page.locator('[data-workspace-stage="storage"]').click();
  await expect(page.locator('[data-workspace-stage="storage"]')).toHaveAttribute("aria-current", "location");
  await sectionButton(page, index).click();
  const preset = page.locator(`[data-properties-inspector] [data-section-storage-preset="${presetId}"]`);
  await preset.check();
  await expect(preset).toBeChecked();
}

async function expectReferenceStages(page) {
  const stages = page.locator("[data-workspace-stage]");
  await expect(stages).toHaveCount(8);
  expect(await stages.evaluateAll((items) => items.map((item) => item.dataset.workspaceStage))).toEqual([
    "space", "layout", "storage", "base_top", "finish", "hardware", "lighting", "preview"
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

test("new visitor sees one presentation-only start action with no setup routes", async ({ page }) => {
  const errors = monitorRuntime(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/configurator.html", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "Design any bookcase. Your vision, your way." })).toBeVisible();
  await expect(page.locator("[data-studio-start]")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Start Building Your Bookcase", exact: true })).toHaveCount(1);
  const previewGroup = page.getByRole("group", { name: "Preview different bookcase arrangements" });
  const previewSelectors = previewGroup.locator("[data-studio-preview-index]");
  await expect(previewSelectors).toHaveCount(3);
  await expect(previewSelectors).toHaveText(welcomePreviewStates.map((state) => state.label));
  await expect(page.locator("[data-studio-route], [data-studio-back], [data-studio-dimension], [data-idea-id], [data-idea-filter], [data-view-all-ideas], [data-studio-preview-dot], .studio-dimension-line, .studio-preview-dots, .studio-preview-dot")).toHaveCount(0);
  await expect(page.locator("[data-3d-viewer]")).toHaveCount(0);
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.locator("[data-save-design], [data-open-order], [data-open-ar]")).toHaveCount(0);
  await expect(page.locator("[data-price]")).toHaveText("Your project estimate will appear as you build");

  const activePreview = page.locator("[data-studio-preview-idea]");
  for (const state of welcomePreviewStates) {
    await previewSelectors.nth(state.index).click();
    await expect(activePreview).toHaveAttribute("data-studio-preview-idea", state.id);
    await expect(activePreview.locator(`[data-mini-preset="${state.id}"]`)).toHaveCount(1);
    await expect(page.locator(".studio-preview-caption strong")).toHaveText(state.name);
    await expect(activePreview.locator("[data-studio-preview-callout]")).toHaveText(state.callouts);
    expect(await previewSelectors.evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-pressed"))))
      .toEqual(welcomePreviewStates.map((candidate) => String(candidate.index === state.index)));
  }

  const diagnostics = await page.locator("[data-builder-form]").evaluate((shell) => ({ ...shell.dataset }));
  expect(diagnostics.diagnosticAcceptedDesign).toBe("false");
  expect(diagnostics.diagnosticEntryView).toBe("welcome");
  expect(diagnostics.diagnosticPriceCalculations).toBe("0");
  expect(diagnostics.diagnosticPhysicalUpdates).toBe("0");
  expect(diagnostics.diagnosticConfiguration).toBe("null");
  expect(diagnostics.diagnosticPricing).toBe("null");
  expect(errors).toEqual([]);
});

test("welcome presentation rotates automatically and a manual choice stops the rotation", async ({ page }) => {
  await page.clock.install();
  await page.goto("/configurator.html", { waitUntil: "networkidle" });
  const activePreview = page.locator("[data-studio-preview-idea]");
  await expect(activePreview).toHaveAttribute("data-studio-preview-idea", "classic-open");
  await expect(activePreview.locator("[data-studio-preview-callout]")).toHaveText(welcomePreviewStates[0].callouts);

  await page.clock.fastForward(3600);
  await expect(activePreview).toHaveAttribute("data-studio-preview-idea", "display-wall");
  await expect(activePreview.locator("[data-studio-preview-callout]")).toHaveText(welcomePreviewStates[1].callouts);
  await page.clock.fastForward(3600);
  await expect(activePreview).toHaveAttribute("data-studio-preview-idea", "tall-storage");
  await expect(activePreview.locator("[data-studio-preview-callout]")).toHaveText(welcomePreviewStates[2].callouts);
  await page.clock.fastForward(3600);
  await expect(activePreview).toHaveAttribute("data-studio-preview-idea", "classic-open");
  await expect(activePreview.locator("[data-studio-preview-callout]")).toHaveText(welcomePreviewStates[0].callouts);

  await page.getByRole("button", { name: "Tall zones", exact: true }).click();
  await page.clock.fastForward(10_800);
  await expect(activePreview).toHaveAttribute("data-studio-preview-idea", "tall-storage");
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.locator("[data-builder-form]")).toHaveAttribute("data-diagnostic-accepted-design", "false");
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
  await expect(page.getByRole("heading", { name: "Design any bookcase. Your vision, your way." })).toHaveCount(0);
  await expect(page.locator("[data-builder-form]")).toHaveAttribute("data-diagnostic-interface", "unified");

  await page.goto("/index.html", { waitUntil: "networkidle" });
  const heroCta = page.getByRole("region", { name: "Custom built-in bookcases, designed around your space." })
    .getByRole("link", { name: "Design Your Bookcase" });
  await expect(heroCta).toHaveAttribute("href", "configurator.html?start=welcome");
  await heroCta.click();
  await expect(page.getByRole("heading", { name: "Design any bookcase. Your vision, your way." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start Building Your Bookcase", exact: true })).toBeVisible();
  await expect(page.locator("[data-studio-route], [data-studio-dimension], [data-idea-id]")).toHaveCount(0);
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("jqBookcasesDesign"))).not.toBeNull();
  expect(new URL(page.url()).searchParams.has("start")).toBe(false);

  await page.goto("/index.html", { waitUntil: "networkidle" });
  const bottomCta = page.getByRole("region", { name: "Build a bookcase you can actually picture at home." })
    .getByRole("link", { name: "Design Your Bookcase" });
  await expect(bottomCta).toHaveAttribute("href", "configurator.html?start=welcome");
  await bottomCta.click();
  await expect(page.getByRole("heading", { name: "Design any bookcase. Your vision, your way." })).toBeVisible();

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

test("Start Building Your Bookcase creates the neutral accepted design after any presentation choice", async ({ page }) => {
  const errors = monitorRuntime(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/configurator.html", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Tall zones", exact: true }).click();
  await expect(page.locator("[data-studio-preview-idea]")).toHaveAttribute("data-studio-preview-idea", "tall-storage");
  await page.getByRole("button", { name: "Start Building Your Bookcase", exact: true }).click();

  const viewer = page.locator("[data-3d-viewer]");
  await expect(viewer).toHaveAttribute("data-render-valid", "true", { timeout: 20_000 });
  await expect(viewer.locator("canvas")).toHaveCount(1);
  const accepted = await readAcceptedDesign(page);
  expect(accepted.diagnostics.acceptedDesign).toBe(true);
  expect(accepted.diagnostics.state.width).toBe(96);
  expect(accepted.diagnostics.state.height).toBe(96);
  expect(accepted.diagnostics.state.depth).toBe(15);
  expect(accepted.diagnostics.state.sections).toBe(4);
  expect(accepted.diagnostics.state.layoutPreset).toBe("custom");
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
  await expect(page.locator('[data-workspace-stage="storage"]')).toHaveAttribute("aria-current", "location");
  await expect(page.locator("[data-properties-inspector] [data-inspector-tab]")).toHaveCount(0);
  await expect(page.locator("[data-properties-inspector] .workspace-properties-panel")).toHaveCount(1);
  await expect(page.locator("[data-properties-inspector] [data-storage-console]")).toBeVisible();
  await expect(page.locator('[data-properties-inspector] .workspace-storage-doors [data-section-storage-field="doorStyle"]')).toBeVisible();
  await expect(page.locator("[data-contextual-editor]")).toHaveCount(0);
  const diagnostics = await page.locator("[data-bookcase-builder]").evaluate((host) => host.__bookcaseConfigurator.getDiagnostics());
  expect(diagnostics.selection.componentId).toBe(selected);
  expect(diagnostics.activeWorkspaceStage).toBe("storage");
  expect(diagnostics.updateCount).toBe(0);
  expect(diagnostics.priceCalculationCount).toBe(1);
  expect(errors).toEqual([]);
});

test("open shelving keeps hardware choices available and explains when quantity is zero", async ({ page }) => {
  const errors = monitorRuntime(page);
  await openVerifiedConfigurator(page, "classic-open");

  await page.locator('[data-workspace-stage="hardware"]').click();
  await expect(page.locator('[data-workspace-stage="hardware"]')).toHaveAttribute("aria-current", "location");
  const emptyState = page.locator("[data-hardware-empty-state]");
  await expect(emptyState).toBeVisible();
  await expect(emptyState).toContainText("No hardware quantity yet");
  await expect(page.locator("[data-hardware-type]")).toHaveCount(2);
  await expect(page.locator("[data-hardware-finish]")).toHaveCount(4);
  await expect(page.locator("[data-open-hardware-library]")).toBeDisabled();

  await emptyState.getByRole("button", { name: "Add fronts in Storage" }).click();
  await expect(page.locator('[data-workspace-stage="storage"]')).toHaveAttribute("aria-current", "location");
  await expect(page.locator("[data-properties-inspector] [data-storage-console]")).toBeVisible();
  expect(errors).toEqual([]);
});

test("focus survives an accepted inspector choice after Properties rerenders", async ({ page }) => {
  const errors = monitorRuntime(page);
  await openVerifiedConfigurator(page, "lower-cabinets");
  await page.locator('[data-workspace-stage="finish"]').click();

  const finish = page.locator('[data-properties-inspector] input[data-field="finish"][value="silver_satin"]');
  await finish.focus();
  await finish.press("Space");
  await expect.poll(async () => (await readAcceptedDesign(page)).diagnostics.state.finish).toBe("silver_satin");

  const rerenderedFinish = page.locator('[data-properties-inspector] input[data-field="finish"][value="silver_satin"]');
  await expect(rerenderedFinish).toBeChecked();
  await expect(rerenderedFinish).toBeFocused();
  expect(errors).toEqual([]);
});

test("Benjamin Moore search keeps its helper and disclaimer through live interface sync", async ({ page }) => {
  const errors = monitorRuntime(page);
  await openVerifiedConfigurator(page, "lower-cabinets");
  await page.locator('[data-workspace-stage="finish"]').click();
  await page.locator("[data-toggle-color-search]:not([data-color-search-close])").click();

  const query = page.locator("[data-bm-query]");
  await expect(query).toBeVisible();
  const readDescriptions = () => query.evaluate((input) => {
    const ids = (input.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean);
    const defaultIds = (input.dataset.defaultDescribedby || "").split(/\s+/).filter(Boolean);
    return {
      ids,
      defaultIds,
      classes: ids.map((id) => document.getElementById(id)?.className || "")
    };
  });

  const before = await readDescriptions();
  expect(before.ids).toEqual(before.defaultIds);
  expect(before.classes).toEqual(expect.arrayContaining(["bm-search-help", "bm-preview-disclaimer"]));

  await page.locator("[data-bookcase-builder]").evaluate((host) => host.__bookcaseConfigurator.syncInterface());
  await expect.poll(readDescriptions).toEqual(before);
  expect(errors).toEqual([]);
});

test("customer section widths are concise in the interface while accepted widths remain exact", async ({ page }) => {
  const errors = monitorRuntime(page);
  await openVerifiedConfigurator(page, "classic-open");
  await openSectionDesigner(page, 4);

  const accepted = await readAcceptedDesign(page);
  expect(accepted.widths).toEqual([23.0625, 23.0625, 23.0625, 23.0625]);
  await expect(page.locator("[data-section-width]")).toHaveValue("23.06");

  const displayedWidths = await page.locator("[data-section-organizer] [data-section-card] small").allTextContents();
  expect(displayedWidths).toEqual(["23.06 in", "23.06 in", "23.06 in", "23.06 in"]);
  for (const label of displayedWidths) {
    const decimals = label.match(/\.(\d+)/)?.[1] || "";
    expect(decimals.length).toBeLessThanOrEqual(2);
  }
  expect(errors).toEqual([]);
});

test("fractional shelf thickness declares decimal keyboard input", async ({ page }) => {
  const errors = monitorRuntime(page);
  await openVerifiedConfigurator(page, "classic-open");
  await page.locator('[data-workspace-stage="storage"]').click();

  const shelfThickness = page.locator('[data-range-control="shelfThickness"] input[type="number"]');
  await expect(shelfThickness).toBeVisible();
  await expect(shelfThickness).toHaveAttribute("step", "0.25");
  await expect(shelfThickness).toHaveAttribute("inputmode", "decimal");
  expect(errors).toEqual([]);
});

test("hardware type and finish stay canonical, compatible, selected, and camera-stable", async ({ page }) => {
  const errors = monitorRuntime(page);
  await openVerifiedConfigurator(page, "lower-cabinets");
  await page.locator('[data-workspace-stage="hardware"]').click();
  await expect(page.locator("[data-hardware-type]")).toHaveCount(2);
  await expect(page.locator("[data-hardware-finish]")).toHaveCount(4);
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
  await expect(page.locator("[data-hardware-finish]")).toHaveCount(4);
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

  for (const presetId of presetIds) {
    const viewer = await openVerifiedConfigurator(page, presetId);
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
  await openSectionDesigner(page, 4);
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
  await openSectionDesigner(page, 4);

  await page.locator('[data-workspace-stage="space"]').click();
  await page.locator('[data-properties-inspector] input[type="number"][data-field="width"]').fill("132");
  await expect.poll(async () => (await readAcceptedDesign(page)).diagnostics.state.width).toBe(132);
  await openSectionDesigner(page, 4);

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
  await openSectionDesigner(page, 5);
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
  await openSectionDesigner(page, 4);
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
  const viewer = await openVerifiedConfigurator(page, "display-wall");

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
  expect((await readAcceptedDesign(page)).diagnostics.state.layoutPreset).toBe("display-wall");

  await page.goto(`/request-quote.html?design=${encodeURIComponent(saved.id)}`, { waitUntil: "networkidle" });
  await expect(page.locator("[data-saved-design-summary]")).toBeVisible();
  await expect(page.locator("[data-saved-design-summary]")).toContainText(saved.id);
  await expect(page.locator('[name="designId"]')).toHaveValue(saved.id);
  await expect(page.locator('[name="wallWidth"]')).toHaveValue(`${saved.canonicalConfig.width}\"`);
  await expect(page.locator('[name="layout"]')).toHaveValue("display-wall");
  expect(errors).toEqual([]);
});

test("successive explicit preset boots leave one verified model", async ({ page }) => {
  const errors = monitorRuntime(page);
  for (const presetId of presetIds) await openVerifiedConfigurator(page, presetId);
  const viewer = await openVerifiedConfigurator(page, "lower-cabinets");
  await expect(viewer).toHaveAttribute("data-render-valid", "true");
  await expect(viewer.locator("canvas")).toHaveCount(1);
  await expect(page.locator("[data-bookcase-builder] canvas")).toHaveCount(1);
  await settleFrames(page, 6);

  const final = await readRenderDiagnostics(viewer);
  expect(final.components).toBe(final.expected);
  expect(final.geometries).toBeGreaterThan(0);
  expect(final.calls).toBeGreaterThan(0);
  expect(final.triangles).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("welcome composition is usable at every required desktop and mobile viewport", async ({ page }) => {
  const viewports = [
    { width: 2011, height: 1198 },
    { width: 1536, height: 1024 },
    { width: 1440, height: 900 },
    { width: 1200, height: 900 },
    { width: 1199, height: 900 },
    { width: 1024, height: 900 },
    { width: 390, height: 844 },
    { width: 360, height: 800 }
  ];
  const errors = monitorRuntime(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/configurator.html", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Design any bookcase. Your vision, your way." })).toBeVisible();
    const startButton = page.getByRole("button", { name: "Start Building Your Bookcase", exact: true });
    await expect(startButton).toHaveCount(1);
    await expect(page.locator("[data-studio-start]")).toHaveCount(1);
    const previewSelectors = page.locator("[data-studio-preview-index]");
    await expect(previewSelectors).toHaveCount(3);
    await expect(page.locator("[data-studio-route], [data-studio-back], [data-studio-dimension], [data-idea-id], [data-idea-filter], [data-view-all-ideas], [data-studio-preview-dot], .studio-dimension-line, .studio-preview-dots, .studio-preview-dot")).toHaveCount(0);
    await expect(page.locator("canvas")).toHaveCount(0);

    const activePreview = page.locator("[data-studio-preview-idea]");
    for (const state of welcomePreviewStates) {
      await previewSelectors.nth(state.index).click();
      await expect(activePreview).toHaveAttribute("data-studio-preview-idea", state.id);
      await expect(activePreview.locator(`[data-mini-preset="${state.id}"]`)).toHaveCount(1);
      await expect(activePreview.locator("[data-studio-preview-callout]")).toHaveText(state.callouts);
      const stateGeometry = await activePreview.evaluate((preview) => {
        const readRect = (element) => {
          const bounds = element.getBoundingClientRect();
          return {
            left: bounds.left,
            right: bounds.right,
            top: bounds.top,
            bottom: bounds.bottom
          };
        };
        return {
          preview: readRect(preview.closest(".studio-intro-stage")),
          drawing: readRect(preview.querySelector(".studio-preview-drawing")),
          callouts: [...preview.querySelectorAll("[data-studio-preview-callout]")].map(readRect)
        };
      });
      for (const callout of stateGeometry.callouts) {
        expect(callout.left, `${viewport.width}x${viewport.height} ${state.label} callout left containment`).toBeGreaterThanOrEqual(stateGeometry.preview.left - 1);
        expect(callout.right, `${viewport.width}x${viewport.height} ${state.label} callout right containment`).toBeLessThanOrEqual(stateGeometry.preview.right + 1);
        expect(callout.top, `${viewport.width}x${viewport.height} ${state.label} callout top containment`).toBeGreaterThanOrEqual(stateGeometry.preview.top - 1);
        expect(callout.bottom, `${viewport.width}x${viewport.height} ${state.label} callout bottom containment`).toBeLessThanOrEqual(stateGeometry.preview.bottom + 1);
        const overlapWidth = Math.max(0, Math.min(callout.right, stateGeometry.drawing.right) - Math.max(callout.left, stateGeometry.drawing.left));
        const overlapHeight = Math.max(0, Math.min(callout.bottom, stateGeometry.drawing.bottom) - Math.max(callout.top, stateGeometry.drawing.top));
        expect(overlapWidth * overlapHeight, `${viewport.width}x${viewport.height} ${state.label} callout does not cover drawing`).toBeLessThanOrEqual(1);
      }
    }
    await expect(activePreview).toHaveAttribute("data-studio-preview-idea", "tall-storage");
    await expect(activePreview.locator('[data-mini-preset="tall-storage"]')).toHaveCount(1);
    const callouts = activePreview.locator(".studio-preview-callout");
    await expect(callouts).toHaveCount(2);
    await expect(callouts).toHaveText(welcomePreviewStates[2].callouts);
    const measures = activePreview.locator(".studio-preview-measure");
    await expect(measures).toHaveCount(2);
    await expect(measures.nth(0).locator("strong")).toHaveText(`${welcomePreviewStates[2].height} in`);
    await expect(measures.nth(0).locator("small")).toHaveText("Wall height");
    await expect(measures.nth(1).locator("strong")).toHaveText(`${welcomePreviewStates[2].width} in`);
    await expect(measures.nth(1).locator("small")).toHaveText("Wall width");

    const composition = await page.evaluate(() => {
      const readRect = (element) => {
        const bounds = element.getBoundingClientRect();
        return {
          left: bounds.left,
          right: bounds.right,
          top: bounds.top,
          bottom: bounds.bottom,
          width: bounds.width,
          height: bounds.height
        };
      };
      const rect = (selector) => readRect(document.querySelector(selector));
      const shell = document.querySelector(".studio-entry-shell");
      const shellStyle = getComputedStyle(shell);
      return {
        pageOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
        shell: readRect(shell),
        shellInnerRight: shell.getBoundingClientRect().right - parseFloat(shellStyle.paddingRight || "0"),
        copy: rect(".studio-entry-copy"),
        copyContent: rect(".studio-entry-action"),
        heading: rect(".studio-welcome-heading"),
        capabilities: rect(".studio-capability-list"),
        preview: rect(".studio-intro-stage"),
        drawing: rect(".studio-preview-drawing"),
        callouts: [...document.querySelectorAll("[data-studio-preview-callout]")].map(readRect),
        footer: rect(".studio-entry-lockbar"),
        cta: rect(".studio-start-button")
      };
    });

    expect(composition.pageOverflow, `${viewport.width}x${viewport.height} horizontal overflow`).toBeLessThanOrEqual(1);
    expect(composition.cta.height, `${viewport.width}x${viewport.height} CTA height`).toBeGreaterThanOrEqual(44);
    expect(composition.cta.left, `${viewport.width}x${viewport.height} CTA left containment`).toBeGreaterThanOrEqual(composition.copy.left - 1);
    expect(composition.cta.right, `${viewport.width}x${viewport.height} CTA right containment`).toBeLessThanOrEqual(composition.copy.right + 1);
    expect(Math.abs(composition.heading.left - composition.copyContent.left), `${viewport.width}x${viewport.height} heading/action left edge`).toBeLessThanOrEqual(1);
    expect(Math.abs(composition.heading.right - composition.copyContent.right), `${viewport.width}x${viewport.height} heading/action right edge`).toBeLessThanOrEqual(1);
    expect(Math.abs(composition.capabilities.left - composition.copyContent.left), `${viewport.width}x${viewport.height} capabilities/action left edge`).toBeLessThanOrEqual(1);
    expect(Math.abs(composition.capabilities.right - composition.copyContent.right), `${viewport.width}x${viewport.height} capabilities/action right edge`).toBeLessThanOrEqual(1);
    for (const callout of composition.callouts) {
      expect(callout.left, `${viewport.width}x${viewport.height} callout left containment`).toBeGreaterThanOrEqual(composition.preview.left - 1);
      expect(callout.right, `${viewport.width}x${viewport.height} callout right containment`).toBeLessThanOrEqual(composition.preview.right + 1);
      expect(callout.top, `${viewport.width}x${viewport.height} callout top containment`).toBeGreaterThanOrEqual(composition.preview.top - 1);
      expect(callout.bottom, `${viewport.width}x${viewport.height} callout bottom containment`).toBeLessThanOrEqual(composition.preview.bottom + 1);
      const overlapWidth = Math.max(0, Math.min(callout.right, composition.drawing.right) - Math.max(callout.left, composition.drawing.left));
      const overlapHeight = Math.max(0, Math.min(callout.bottom, composition.drawing.bottom) - Math.max(callout.top, composition.drawing.top));
      expect(overlapWidth * overlapHeight, `${viewport.width}x${viewport.height} callout does not cover drawing`).toBeLessThanOrEqual(1);
    }

    if (viewport.width >= 1200) {
      expect(composition.preview.right, `${viewport.width}x${viewport.height} preview before copy`).toBeLessThanOrEqual(composition.copy.left + 1);
      expect(composition.preview.width, `${viewport.width}x${viewport.height} preview wider than visible copy`).toBeGreaterThan(composition.copyContent.width);
      const expectedCopyCenter = (composition.preview.right + composition.shellInnerRight) / 2;
      const actualCopyCenter = (composition.copyContent.left + composition.copyContent.right) / 2;
      expect(Math.abs(actualCopyCenter - expectedCopyCenter), `${viewport.width}x${viewport.height} copy centered in right region`).toBeLessThanOrEqual(1);
      expect(composition.footer.top, `${viewport.width}x${viewport.height} footer below preview`).toBeGreaterThanOrEqual(composition.preview.bottom - 1);
      expect(composition.footer.top, `${viewport.width}x${viewport.height} footer below copy`).toBeGreaterThanOrEqual(composition.copy.bottom - 1);
      expect(composition.footer.left, `${viewport.width}x${viewport.height} footer spans preview edge`).toBeLessThanOrEqual(composition.preview.left + 1);
      expect(composition.footer.right, `${viewport.width}x${viewport.height} footer spans copy edge`).toBeGreaterThanOrEqual(composition.copy.right - 1);
    } else {
      expect(composition.copy.bottom, `${viewport.width}x${viewport.height} copy before preview`).toBeLessThanOrEqual(composition.preview.top + 1);
      expect(composition.preview.bottom, `${viewport.width}x${viewport.height} preview before footer`).toBeLessThanOrEqual(composition.footer.top + 1);
      expect(composition.footer.left, `${viewport.width}x${viewport.height} footer left alignment`).toBeGreaterThanOrEqual(composition.shell.left - 1);
      expect(composition.footer.right, `${viewport.width}x${viewport.height} footer right alignment`).toBeLessThanOrEqual(composition.shell.right + 1);
    }
    await page.screenshot({
      path: `test-results/custom-studio-qa/welcome-${viewport.width}x${viewport.height}.png`,
      animations: "disabled"
    });
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

test("Start over clears the accepted design and returns to the single start screen", async ({ page }) => {
  await openVerifiedConfigurator(page, "display-wall");
  await page.locator('[data-workspace-stage="preview"]').click();
  await page.getByRole("button", { name: "Start over", exact: true }).click();
  await page.getByRole("button", { name: "Confirm start over", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Design any bookcase. Your vision, your way." })).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.locator("[data-3d-viewer]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Start Building Your Bookcase", exact: true })).toHaveCount(1);
  await expect(page.locator("[data-studio-start]")).toHaveCount(1);
  await expect(page.locator("[data-studio-preview-index]")).toHaveCount(3);
  await expect(page.locator("[data-studio-route], [data-studio-dimension], [data-idea-id], [data-studio-preview-dot], .studio-preview-dots, .studio-preview-dot")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("jqBookcasesDesign"))).toBeNull();
});

test("mobile viewport keeps controls usable and the accepted model valid", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = monitorRuntime(page);
  const viewer = await openVerifiedConfigurator(page, "classic-open");

  await expect(page.locator("[data-save-design]").first()).toBeVisible();
  await expect(viewer).toHaveAttribute("data-render-valid", "true");
  await page.locator('[data-workspace-stage="layout"]').click();
  await expect(page.locator('[data-workspace-stage="layout"]')).toHaveAttribute("aria-current", "location");
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
