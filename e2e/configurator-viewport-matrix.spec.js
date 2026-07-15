import { expect, test } from "@playwright/test";

const workspaceViewports = [
  { width: 2011, height: 1198 },
  { width: 1440, height: 900 },
  { width: 1180, height: 820 },
  { width: 1024, height: 900 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 360, height: 800 }
];

const expectedStages = ["space", "layout", "storage", "finish", "hardware", "lighting", "preview"];

function monitorRuntime(page) {
  const issues = [];
  page.on("pageerror", (error) => issues.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    const driverOnlyReadbackWarning = message.type() === "warning"
      && /GL Driver Message .*GPU stall due to ReadPixels/.test(message.text());
    if (driverOnlyReadbackWarning) return;
    if (["warning", "error"].includes(message.type())) {
      issues.push(`console ${message.type()}: ${message.text()}`);
    }
  });
  return issues;
}

async function settleFrames(page, count = 4) {
  await page.evaluate(async (frameCount) => {
    for (let index = 0; index < frameCount; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }, count);
}

async function openWorkspace(page) {
  await page.goto("/configurator.html?preset=lower-cabinets", { waitUntil: "networkidle" });
  const viewer = page.locator("[data-3d-viewer]");
  await expect(viewer).toHaveAttribute("data-render-valid", "true", { timeout: 20_000 });
  await expect(viewer.locator("canvas")).toHaveCount(1);
  return viewer;
}

async function addSection(page) {
  const add = page.locator("[data-section-organizer] [data-section-add]");
  await expect(add).toBeEnabled();
  await add.click();
}

test("reference workspace keeps one model, seven stages, fixed Properties, and responsive organizer regions", async ({ page }) => {
  const runtimeIssues = monitorRuntime(page);
  await page.setViewportSize(workspaceViewports[0]);
  const viewer = await openWorkspace(page);

  const stages = page.locator("[data-workspace-stage]");
  await expect(stages).toHaveCount(7);
  expect(await stages.evaluateAll((items) => items.map((item) => item.dataset.workspaceStage))).toEqual(expectedStages);
  await expect(page.locator("[data-properties-inspector]")).toHaveCount(1);
  await expect(page.locator("[data-section-organizer]")).toHaveCount(1);
  await expect(page.locator("[data-total-width-card]")).toHaveCount(1);
  await expect(page.locator("[data-3d-viewer]")).toHaveCount(1);
  await expect(page.locator("[data-contextual-editor], [data-unified-inspector], [data-viewer-zoom], [data-view]")).toHaveCount(0);

  for (const viewport of workspaceViewports) {
    const label = `${viewport.width}x${viewport.height}`;
    await page.setViewportSize(viewport);
    await page.evaluate(() => window.scrollTo(0, 0));
    await settleFrames(page);

    await expect(viewer, `${label} viewer`).toHaveAttribute("data-render-valid", "true");
    await expect(viewer.locator("canvas"), `${label} persistent canvas`).toHaveCount(1);
    await expect(page.locator("[data-properties-inspector]"), `${label} Properties`).toBeVisible();
    await expect(page.locator("[data-section-organizer]"), `${label} organizer`).toBeVisible();
    await expect(page.locator("[data-total-width-card]"), `${label} width card`).toBeVisible();
    await expect(page.locator("[data-estimate-bar]"), `${label} estimate footer`).toBeVisible();

    const audit = await page.evaluate(() => {
      const rect = (selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const bounds = element.getBoundingClientRect();
        return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, width: bounds.width, height: bounds.height };
      };
      const host = document.querySelector("[data-bookcase-builder]");
      const diagnostics = host?.__bookcaseConfigurator?.getDiagnostics();
      const viewerRoot = document.querySelector("[data-3d-viewer]");
      return {
        pageOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
        workspace: rect("[data-configurator-workspace]"),
        rail: rect("[data-workspace-stages]"),
        model: rect("[data-model-workspace]"),
        inspector: rect("[data-properties-inspector]"),
        organizer: rect("[data-section-organizer]"),
        widthCard: rect("[data-total-width-card]"),
        footer: rect("[data-estimate-bar]"),
        stageDirection: getComputedStyle(document.querySelector(".workspace-stage-list")).display,
        renderValid: viewerRoot?.dataset.renderValid || "",
        canvasCount: viewerRoot?.querySelectorAll("canvas").length || 0,
        renderedComponents: Number(viewerRoot?.dataset.renderComponents || 0),
        expectedComponents: Number(viewerRoot?.dataset.renderExpected || 0),
        acceptedDesign: Boolean(diagnostics?.acceptedDesign),
        interface: diagnostics?.interface || ""
      };
    });

    expect(audit.pageOverflow, `${label} page horizontal overflow`).toBeLessThanOrEqual(1);
    expect(audit.acceptedDesign, `${label} accepted design`).toBe(true);
    expect(audit.interface, `${label} interface`).toBe("unified");
    expect(audit.renderValid, `${label} render validity`).toBe("true");
    expect(audit.canvasCount, `${label} canvas count`).toBe(1);
    expect(audit.renderedComponents, `${label} rendered components`).toBeGreaterThan(0);
    expect(audit.renderedComponents, `${label} complete component render`).toBe(audit.expectedComponents);
    for (const [region, bounds] of Object.entries({
      rail: audit.rail,
      model: audit.model,
      inspector: audit.inspector,
      organizer: audit.organizer,
      widthCard: audit.widthCard,
      footer: audit.footer
    })) {
      expect(bounds, `${label} ${region} exists`).not.toBeNull();
      expect(bounds.width, `${label} ${region} width`).toBeGreaterThan(0);
      expect(bounds.height, `${label} ${region} height`).toBeGreaterThan(0);
    }

    if (viewport.width > 1200) {
      expect(audit.rail.right, `${label} left rail before model`).toBeLessThanOrEqual(audit.model.left + 1);
      expect(audit.model.right, `${label} model before fixed Properties`).toBeLessThanOrEqual(audit.inspector.left + 1);
      expect(audit.organizer.top, `${label} organizer below model`).toBeGreaterThanOrEqual(audit.model.bottom - 1);
      expect(audit.widthCard.left, `${label} width card aligned under Properties`).toBeGreaterThanOrEqual(audit.inspector.left - 1);
      expect(audit.stageDirection, `${label} vertical stage list`).toBe("grid");
    } else {
      expect(audit.rail.bottom, `${label} stage navigator before model`).toBeLessThanOrEqual(audit.model.top + 12);
      expect(audit.organizer.top, `${label} organizer below model`).toBeGreaterThanOrEqual(audit.model.bottom - 1);
      expect(audit.inspector.top, `${label} Properties sheet below organizer`).toBeGreaterThanOrEqual(audit.organizer.bottom - 1);
      expect(audit.stageDirection, `${label} horizontal stage list`).toBe("flex");
    }
    expect(runtimeIssues, `${label} runtime warnings/errors`).toEqual([]);
  }
});

test("six projected clear-width labels remain collision-free on narrow mobile", async ({ page }) => {
  const runtimeIssues = monitorRuntime(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openWorkspace(page);
  await page.locator('[data-workspace-stage="space"]').click();
  await page.locator('[data-properties-inspector] input[type="number"][data-field="width"]').fill("132");
  await expect.poll(async () => Number(await page.locator('[data-builder-form]').getAttribute('data-diagnostic-configuration').then((value) => JSON.parse(value || '{}').width))).toBe(132);
  await page.locator('[data-workspace-stage="layout"]').click();
  await addSection(page);
  await addSection(page);
  await expect(page.locator("[data-section-organizer] [data-section-card]")).toHaveCount(6);
  await expect(page.locator("[data-overlay-section]")).toHaveCount(6);

  for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 800 }]) {
    await page.setViewportSize(viewport);
    await settleFrames(page);
    const audit = await page.locator("[data-section-overlay]").evaluate((overlay) => {
      const labels = Array.from(overlay.querySelectorAll("[data-overlay-section] .dimension-label"))
        .map((label) => {
          const rect = label.getBoundingClientRect();
          return { left: rect.left, right: rect.right, width: rect.width, visible: rect.width > 0 && rect.height > 0 };
        });
      return {
        labels,
        collisionState: overlay.dataset.labelCollision,
        canvasCount: overlay.closest("[data-3d-viewer]")?.querySelectorAll("canvas").length || 0,
        pageOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth)
      };
    });
    expect(audit.canvasCount).toBe(1);
    expect(audit.pageOverflow).toBeLessThanOrEqual(1);
    expect(audit.labels).toHaveLength(6);
    audit.labels.forEach((label) => expect(label.visible).toBe(true));
    for (let index = 0; index < audit.labels.length - 1; index += 1) {
      expect(
        audit.labels[index].right,
        `${viewport.width}x${viewport.height} label ${index + 1} must not overlap label ${index + 2}`
      ).toBeLessThanOrEqual(audit.labels[index + 1].left + 0.5);
    }
    expect(audit.collisionState).toBe("false");
    expect(runtimeIssues).toEqual([]);
  }
});
