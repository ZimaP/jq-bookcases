import { expect, test } from "@playwright/test";

const structureViewports = [
  { width: 1440, height: 900 },
  { width: 1536, height: 1024 },
  { width: 1920, height: 1080 },
  { width: 3840, height: 2160 },
  { width: 1180, height: 820 },
  { width: 1024, height: 900 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 360, height: 800 }
];

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

test("accepted Structure stays usable at every required configurator viewport", async ({ page }) => {
  const runtimeIssues = monitorRuntime(page);
  await page.setViewportSize(structureViewports[0]);
  await page.goto("/configurator.html?preset=lower-cabinets", { waitUntil: "networkidle" });

  const viewer = page.locator("[data-3d-viewer]");
  await expect(viewer).toHaveAttribute("data-render-valid", "true", { timeout: 20_000 });
  await expect(viewer.locator("canvas")).toHaveCount(1);
  await page.locator("[data-guided-continue]").click();
  await expect(page.locator('[data-guided-step-content="layout"]')).toBeVisible();
  await expect(page.locator('[data-guided-step="layout"]')).toHaveAttribute("aria-current", "step");

  const sectionCount = page.locator('[data-stepper-control="sections"] input[data-field="sections"]');
  await sectionCount.fill("3");
  await expect(page.locator("[data-section-select]")).toHaveCount(3);
  await expect(page.locator("[data-section-divider]")).toHaveCount(2);

  for (const viewport of structureViewports) {
    const label = `${viewport.width}x${viewport.height}`;
    await page.setViewportSize(viewport);
    await settleFrames(page);

    await expect(viewer, `${label} viewer`).toHaveAttribute("data-render-valid", "true");
    await expect(viewer.locator("canvas"), `${label} persistent canvas`).toHaveCount(1);
    await expect(page.locator("[data-section-designer]"), `${label} Structure editor`).toBeVisible();
    await expect(page.locator("[data-section-select]"), `${label} Structure cards`).toHaveCount(3);
    await expect(page.locator("[data-overlay-section]"), `${label} clear-width labels`).toHaveCount(3);
    await expect(page.locator("[data-section-divider]"), `${label} divider handles`).toHaveCount(2);
    await expect(page.locator("[data-overall-dimension-value]"), `${label} overall label`).toHaveText(/\d+(?:\.\d+)? in/);

    const audit = await page.evaluate(() => {
      const overflow = (element) => Math.max(0, element.scrollWidth - element.clientWidth);
      const bounds = (element) => {
        const rect = element.getBoundingClientRect();
        return {
          width: rect.width,
          height: rect.height,
          visible: rect.width > 0
            && rect.height > 0
            && getComputedStyle(element).visibility !== "hidden"
            && Number(getComputedStyle(element).opacity) > 0
        };
      };
      const host = document.querySelector("[data-bookcase-builder]");
      const controller = host?.__bookcaseConfigurator;
      const viewerRoot = document.querySelector("[data-3d-viewer]");
      const cards = Array.from(document.querySelectorAll("[data-section-select]"));
      const handles = Array.from(document.querySelectorAll("[data-section-divider]"));
      const sectionLabels = Array.from(document.querySelectorAll("[data-overlay-section]"));
      const overallLabel = document.querySelector("[data-overall-dimension-value]")?.closest(".overall-dimension");
      const overflowRegions = {
        page: document.documentElement,
        guidedStep: document.querySelector('[data-guided-step-content="layout"]'),
        sectionDesigner: document.querySelector("[data-section-designer]"),
        sectionOverview: document.querySelector("[data-section-overview]")
      };

      return {
        overflow: Object.fromEntries(Object.entries(overflowRegions).map(([name, element]) => [
          name,
          element ? overflow(element) : null
        ])),
        cards: cards.map(bounds),
        handles: handles.map((element) => ({
          ...bounds(element),
          disabled: element.disabled,
          ariaDisabled: element.getAttribute("aria-disabled")
        })),
        sectionLabels: sectionLabels.map((element) => ({
          ...bounds(element),
          value: element.querySelector("[data-section-dimension-value]")?.textContent?.trim() || ""
        })),
        overallLabel: overallLabel ? bounds(overallLabel) : null,
        renderValid: viewerRoot?.dataset.renderValid || "",
        canvasCount: viewerRoot?.querySelectorAll("canvas").length || 0,
        renderedComponents: Number(viewerRoot?.dataset.renderComponents || 0),
        expectedComponents: Number(viewerRoot?.dataset.renderExpected || 0),
        acceptedDesign: Boolean(controller?.getDiagnostics().acceptedDesign),
        guidedStep: controller?.getDiagnostics().guidedStep || ""
      };
    });

    for (const [region, overflow] of Object.entries(audit.overflow)) {
      expect(overflow, `${label} ${region} horizontal overflow`).not.toBeNull();
      expect(overflow, `${label} ${region} horizontal overflow`).toBeLessThanOrEqual(1);
    }
    expect(audit.acceptedDesign, `${label} accepted design`).toBe(true);
    expect(audit.guidedStep, `${label} guided step`).toBe("layout");
    expect(audit.renderValid, `${label} render validity`).toBe("true");
    expect(audit.canvasCount, `${label} canvas count`).toBe(1);
    expect(audit.renderedComponents, `${label} rendered components`).toBeGreaterThan(0);
    expect(audit.renderedComponents, `${label} complete component render`).toBe(audit.expectedComponents);

    for (const [index, card] of audit.cards.entries()) {
      expect(card.visible, `${label} Section ${index + 1} card visibility`).toBe(true);
      expect(card.width, `${label} Section ${index + 1} card target width`).toBeGreaterThanOrEqual(44);
      expect(card.height, `${label} Section ${index + 1} card target height`).toBeGreaterThanOrEqual(44);
    }
    for (const [index, handle] of audit.handles.entries()) {
      expect(handle.visible, `${label} divider ${index + 1} visibility`).toBe(true);
      expect(handle.disabled, `${label} divider ${index + 1} enabled`).toBe(false);
      expect(handle.ariaDisabled, `${label} divider ${index + 1} aria-enabled`).toBe("false");
      expect(handle.width, `${label} divider ${index + 1} target width`).toBeGreaterThanOrEqual(44);
      expect(handle.height, `${label} divider ${index + 1} target height`).toBeGreaterThanOrEqual(44);
    }
    for (const [index, sectionLabel] of audit.sectionLabels.entries()) {
      expect(sectionLabel.visible, `${label} Section ${index + 1} clear-width label visibility`).toBe(true);
      expect(sectionLabel.value, `${label} Section ${index + 1} clear-width value`).toMatch(/\d+(?:\.\d+)? in/);
    }
    expect(audit.overallLabel?.visible, `${label} overall dimension visibility`).toBe(true);
    expect(runtimeIssues, `${label} runtime warnings/errors`).toEqual([]);
  }
});

test("six projected clear-width labels do not collide on narrow mobile", async ({ page }) => {
  const runtimeIssues = monitorRuntime(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/configurator.html?preset=lower-cabinets", { waitUntil: "networkidle" });
  await page.locator("[data-guided-continue]").click();
  await page.locator('[data-stepper-control="sections"] input[data-field="sections"]').fill("6");
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
        canvasCount: overlay.closest("[data-3d-viewer]")?.querySelectorAll("canvas").length || 0
      };
    });
    expect(audit.canvasCount).toBe(1);
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
