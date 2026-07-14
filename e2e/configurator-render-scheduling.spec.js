import { test, expect } from "@playwright/test";

async function readViewerDiagnostics(page) {
  return page.locator("[data-bookcase-builder]").evaluate((host) => (
    host.__bookcaseConfigurator?.getDiagnostics?.().viewer || null
  ));
}

async function waitForViewerIdle(page, { stableFor = 600, timeout = 8_000 } = {}) {
  const deadline = Date.now() + timeout;
  let previous = await readViewerDiagnostics(page);
  let stableSince = null;

  while (Date.now() < deadline) {
    await page.waitForTimeout(100);
    const current = await readViewerDiagnostics(page);
    const unchanged = current?.renderCount === previous?.renderCount;
    const idle = current && !current.renderScheduled && !current.cameraTransitionActive;

    if (unchanged && idle) {
      if (stableSince === null) stableSince = Date.now();
      if (Date.now() - stableSince >= stableFor) return current;
    } else {
      stableSince = null;
    }
    previous = current;
  }

  throw new Error(`The viewer did not remain idle for ${stableFor}ms: ${JSON.stringify(previous)}`);
}

test("the 3D viewer renders on demand, animates camera moves, and returns to idle", async ({ page }) => {
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/configurator.html?preset=classic-open", { waitUntil: "networkidle" });

  const viewer = page.locator("[data-3d-viewer]");
  await expect(viewer).toHaveAttribute("data-render-valid", "true", { timeout: 20_000 });
  await expect.poll(async () => (await readViewerDiagnostics(page))?.renderCount || 0).toBeGreaterThan(0);

  // Font and ResizeObserver work may legitimately schedule late frames. Require
  // a sustained quiet window instead of assuming a fixed startup delay.
  const idle = await waitForViewerIdle(page);
  expect(idle.renderScheduled).toBe(false);
  expect(idle.cameraTransitionActive).toBe(false);

  await page.locator('[data-view="front"]').click();
  await expect.poll(async () => (await readViewerDiagnostics(page))?.cameraTransitionActive).toBe(true);
  const transitionStart = await readViewerDiagnostics(page);
  await expect.poll(async () => (await readViewerDiagnostics(page))?.renderCount || 0).toBeGreaterThan(transitionStart.renderCount);
  await expect.poll(async () => (await readViewerDiagnostics(page))?.cameraTransitionActive, { timeout: 3_000 }).toBe(false);

  const settled = await waitForViewerIdle(page);
  expect(settled.renderScheduled).toBe(false);
  expect(settled.cameraTransitionActive).toBe(false);

  // Structure is a strict Guided step with an inline designer. Advancing out
  // restores its captured camera/light state and must return the viewer idle.
  await expect(page.locator('[data-guided-step="layout"]')).toBeDisabled();
  await page.locator("[data-guided-continue]").click();
  await expect(page.locator('[data-guided-step-content="layout"]')).toBeVisible();
  await expect(page.locator('[data-guided-step="layout"]')).toHaveAttribute("aria-current", "step");
  await expect(page.locator("[data-section-designer]")).toBeVisible();
  await expect(page.locator("[data-section-designer-open], [data-section-designer-close]")).toHaveCount(0);
  await expect.poll(async () => (await readViewerDiagnostics(page))?.renderCount || 0).toBeGreaterThan(settled.renderCount);
  const structureIdle = await waitForViewerIdle(page);
  await page.locator("[data-guided-continue]").click();
  await expect(page.locator('[data-guided-step-content="storage"]')).toBeVisible();
  await expect(page.locator("[data-section-designer]")).toHaveCount(0);
  await expect.poll(async () => (await readViewerDiagnostics(page))?.renderCount || 0).toBeGreaterThan(structureIdle.renderCount);
  await waitForViewerIdle(page);

  expect(runtimeErrors).toEqual([]);
});
