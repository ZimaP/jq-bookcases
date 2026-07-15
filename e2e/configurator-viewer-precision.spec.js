import { expect, test } from "@playwright/test";

function monitorRuntime(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  return errors;
}

async function openConfigurator(page) {
  await page.goto("/configurator.html?preset=lower-cabinets", { waitUntil: "networkidle" });
  const viewer = page.locator("[data-3d-viewer]");
  await expect(viewer).toHaveAttribute("data-render-valid", "true", { timeout: 20_000 });
  await expect(viewer.locator("canvas")).toHaveCount(1);
  await expect(page.locator("[data-builder-form]")).toHaveAttribute("data-diagnostic-camera-transition", "false");
  return viewer;
}

async function openCategory(page, category) {
  const trigger = page.locator(`[data-category-trigger="${category}"]`);
  if (await trigger.getAttribute("aria-expanded") !== "true") await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(`[data-category-panel="${category}"]`)).toBeVisible();
}

async function readHardwareViewerState(page) {
  return page.locator("[data-bookcase-builder]").evaluate((host) => {
    const controller = host.__bookcaseConfigurator;
    const diagnostics = controller.viewer.getDiagnostics();
    const view = controller.viewer.getViewState();
    const canvas = host.querySelector("[data-3d-viewer] canvas");
    return {
      hardware: controller.state.hardware,
      activeView: controller.activeView,
      canvasCount: host.querySelectorAll("[data-3d-viewer] canvas").length,
      canvasIdentity: canvas?.dataset.viewerPrecisionIdentity || "",
      partialUpdateCount: diagnostics.partialUpdateCount,
      rebuildCount: diagnostics.rebuildCount,
      view: {
        theta: view.theta,
        phi: view.phi,
        radius: view.radius,
        focus: view.focus,
        focusVariant: view.focusVariant,
        environmentScale: view.environmentScale,
        exposure: view.exposure,
        target: view.target,
        position: view.position
      }
    };
  });
}

function expectExactCamera(actual, expected) {
  for (const key of ["theta", "phi", "radius", "environmentScale", "exposure"]) {
    expect(actual[key]).toBeCloseTo(expected[key], 12);
  }
  expect(actual.focus).toBe(expected.focus);
  expect(actual.focusVariant).toBe(expected.focusVariant);
  for (const group of ["target", "position"]) {
    for (const axis of ["x", "y", "z"]) {
      expect(actual[group][axis]).toBeCloseTo(expected[group][axis], 12);
    }
  }
}

test("hardware finish and type changes preserve the exact custom camera and persistent canvas", async ({ page }) => {
  const runtimeErrors = monitorRuntime(page);
  const viewer = await openConfigurator(page);
  await openCategory(page, "hardware");
  await expect(page.locator("[data-builder-form]")).toHaveAttribute("data-diagnostic-camera-transition", "false");

  await viewer.evaluate((root) => {
    root.querySelector("canvas").dataset.viewerPrecisionIdentity = "persistent-viewer-canvas";
  });
  await viewer.focus();
  await viewer.press("ArrowRight");
  await viewer.press("ArrowUp");
  await viewer.press("+");
  const before = await readHardwareViewerState(page);
  expect(before.activeView).toBe("custom");
  expect(before.hardware).toBe("brass_knob");

  const matteBlackFinish = page.locator('[data-hardware-finish][value="matte_black"]');
  await matteBlackFinish.focus();
  await matteBlackFinish.press("Space");
  await expect.poll(async () => (await readHardwareViewerState(page)).hardware).toBe("matte_black_knob");
  await expect(page.locator('[data-hardware-finish][value="matte_black"]')).toBeFocused();
  const afterFinish = await readHardwareViewerState(page);
  expect(afterFinish.partialUpdateCount).toBe(before.partialUpdateCount + 1);
  expect(afterFinish.rebuildCount).toBe(before.rebuildCount);
  expect(afterFinish.activeView).toBe("custom");
  expect(afterFinish.canvasCount).toBe(1);
  expect(afterFinish.canvasIdentity).toBe("persistent-viewer-canvas");
  expectExactCamera(afterFinish.view, before.view);

  const pullType = page.locator('[data-hardware-type][value="pull"]');
  await pullType.focus();
  await pullType.press("Space");
  await expect.poll(async () => (await readHardwareViewerState(page)).hardware).toBe("matte_black_pull");
  await expect(page.locator('[data-hardware-type][value="pull"]')).toBeFocused();
  const afterType = await readHardwareViewerState(page);
  expect(afterType.partialUpdateCount).toBe(afterFinish.partialUpdateCount + 1);
  expect(afterType.rebuildCount).toBe(afterFinish.rebuildCount);
  expect(afterType.activeView).toBe("custom");
  expect(afterType.canvasCount).toBe(1);
  expect(afterType.canvasIdentity).toBe("persistent-viewer-canvas");
  expectExactCamera(afterType.view, before.view);
  expect(runtimeErrors).toEqual([]);
});

test("selecting a front in the model opens its unified context editor without committing a design change", async ({ page }) => {
  const runtimeErrors = monitorRuntime(page);
  const viewer = await openConfigurator(page);
  await page.locator("[data-bookcase-builder]").evaluate((root) => root.__bookcaseConfigurator.setView("front"));
  await expect(page.locator("[data-builder-form]")).toHaveAttribute("data-diagnostic-camera-transition", "false");

  const host = page.locator("[data-bookcase-builder]");
  const before = await host.evaluate((root) => {
    const controller = root.__bookcaseConfigurator;
    const canvas = root.querySelector("[data-3d-viewer] canvas");
    canvas.dataset.viewerPrecisionIdentity = "direct-selection-canvas";
    return {
      updateCount: controller.updateCount,
      priceCalculationCount: controller.priceCalculationCount,
      fingerprint: controller.bom.layoutFingerprint
    };
  });
  const target = await host.evaluate((root) => {
    const controller = root.__bookcaseConfigurator;
    const viewerRoot = root.querySelector("[data-3d-viewer]");
    const rect = viewerRoot.getBoundingClientRect();
    const candidates = controller.layout.components.filter((component) => ["door", "drawer_front"].includes(component.role));
    for (const component of candidates) {
      const anchor = controller.viewer.getComponentScreenAnchor(component.id);
      if (!anchor?.visible) continue;
      const clientX = rect.left + anchor.x;
      const clientY = rect.top + anchor.y;
      const hit = controller.viewer.resolveDirectHit({ clientX, clientY });
      if (["door", "drawer_front"].includes(hit?.role)) {
        return { componentId: hit.id, role: hit.role, clientX, clientY };
      }
    }
    return null;
  });
  expect(target).not.toBeNull();

  await page.mouse.click(target.clientX, target.clientY);
  const contextEditor = page.locator("[data-contextual-editor]");
  await expect(contextEditor).toBeVisible();
  await expect(page.locator("[data-context-title]")).toHaveText(/Door|Drawer/);
  const shell = page.locator("[data-builder-form]");
  await expect(shell).toHaveAttribute("data-diagnostic-interface", "unified");
  await expect(shell).toHaveAttribute("data-diagnostic-inspector-group", "storage_fronts");
  await expect(shell).toHaveAttribute("data-diagnostic-selection-kind", "front");
  await expect(shell).toHaveAttribute("data-diagnostic-selection-editor", /door|drawer/);
  await expect(shell).toHaveAttribute("data-diagnostic-direct-selected", target.componentId);
  await expect(page.locator('[data-category-trigger="storage_fronts"]')).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator('[data-category-panel="storage_fronts"]')).toBeVisible();

  const afterSelection = await host.evaluate((root) => {
    const controller = root.__bookcaseConfigurator;
    return {
      updateCount: controller.updateCount,
      priceCalculationCount: controller.priceCalculationCount,
      fingerprint: controller.bom.layoutFingerprint,
      canvasCount: root.querySelectorAll("[data-3d-viewer] canvas").length,
      canvasIdentity: root.querySelector("[data-3d-viewer] canvas")?.dataset.viewerPrecisionIdentity || ""
    };
  });
  expect(afterSelection).toEqual({
    ...before,
    canvasCount: 1,
    canvasIdentity: "direct-selection-canvas"
  });

  await page.locator("[data-close-context]").click();
  await expect(contextEditor).toBeHidden();
  await expect(shell).toHaveAttribute("data-diagnostic-selection-kind", "");
  await expect(shell).toHaveAttribute("data-diagnostic-direct-selected", "");
  await expect(viewer.locator("canvas")).toHaveCount(1);
  expect(runtimeErrors).toEqual([]);
});

test("divider drag keeps the captured handle, previews without pricing, then commits once", async ({ page }) => {
  const runtimeErrors = monitorRuntime(page);
  const viewer = await openConfigurator(page);
  await page.locator("[data-bookcase-builder]").evaluate((host) => {
    const controller = host.__bookcaseConfigurator;
    controller.activateSectionDesigner({ render: false, announce: false });
    const handle = host.querySelector('[data-section-divider="0"]');
    if (handle) handle.dataset.viewerPrecisionIdentity = "captured-divider";
    const canvas = host.querySelector("[data-3d-viewer] canvas");
    if (canvas) canvas.dataset.viewerPrecisionIdentity = "persistent-viewer-canvas";
  });
  await expect(page.locator("[data-builder-form]")).toHaveAttribute("data-diagnostic-camera-transition", "false");

  const handle = page.locator('[data-section-divider="0"]');
  await expect(handle).toBeVisible();
  await expect(handle).toBeEnabled();
  const before = await page.locator("[data-bookcase-builder]").evaluate((host) => {
    const controller = host.__bookcaseConfigurator;
    return {
      updateCount: controller.updateCount,
      priceCalculationCount: controller.priceCalculationCount,
      widths: controller.layout.metrics.sectionClearWidths.slice(),
      view: controller.viewer.getViewState()
    };
  });

  const box = await handle.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height - 18);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 28, box.y + box.height - 18, { steps: 4 });

  await expect.poll(() => page.locator("[data-bookcase-builder]").evaluate((host) => (
    host.__bookcaseConfigurator.viewer.sectionPreviewRendered
  ))).toBe(true);
  const during = await page.locator("[data-bookcase-builder]").evaluate((host) => {
    const controller = host.__bookcaseConfigurator;
    const currentHandle = host.querySelector('[data-section-divider="0"]');
    return {
      sameHandle: currentHandle?.dataset.viewerPrecisionIdentity === "captured-divider",
      activeDrag: Boolean(controller.activeSectionDividerDrag),
      updateCount: controller.updateCount,
      priceCalculationCount: controller.priceCalculationCount,
      acceptedWidths: controller.layout.metrics.sectionClearWidths.slice(),
      previewWidths: controller.viewer.lastLayout.metrics.sectionClearWidths.slice(),
      label: host.querySelector('[data-overlay-section="0"] [data-section-dimension-value]')?.textContent || ""
    };
  });
  expect(during.sameHandle).toBe(true);
  expect(during.activeDrag).toBe(true);
  expect(during.updateCount).toBe(before.updateCount);
  expect(during.priceCalculationCount).toBe(before.priceCalculationCount);
  expect(during.acceptedWidths).toEqual(before.widths);
  expect(during.previewWidths).not.toEqual(before.widths);
  expect(during.label).toMatch(/ in$/);

  await page.mouse.up();
  await expect.poll(() => page.locator("[data-bookcase-builder]").evaluate((host) => (
    host.__bookcaseConfigurator.updateCount
  ))).toBe(before.updateCount + 1);
  const after = await page.locator("[data-bookcase-builder]").evaluate((host) => {
    const controller = host.__bookcaseConfigurator;
    return {
      updateCount: controller.updateCount,
      priceCalculationCount: controller.priceCalculationCount,
      widths: controller.layout.metrics.sectionClearWidths.slice(),
      activeDrag: Boolean(controller.activeSectionDividerDrag),
      canvasCount: host.querySelectorAll("[data-3d-viewer] canvas").length,
      canvasIdentity: host.querySelector("[data-3d-viewer] canvas")?.dataset.viewerPrecisionIdentity || "",
      view: controller.viewer.getViewState()
    };
  });
  expect(after.updateCount).toBe(before.updateCount + 1);
  expect(after.priceCalculationCount).toBe(before.priceCalculationCount + 1);
  expect(after.widths).not.toEqual(before.widths);
  expect(after.activeDrag).toBe(false);
  expect(after.canvasCount).toBe(1);
  expect(after.canvasIdentity).toBe("persistent-viewer-canvas");
  expectExactCamera(after.view, before.view);
  await expect(viewer).toHaveAttribute("data-render-valid", "true");
  expect(runtimeErrors).toEqual([]);
});

test("Structure precision inputs, keyboard dividers, selection clamping, and merge selection stay synchronized", async ({ page }) => {
  const runtimeErrors = monitorRuntime(page);
  await openConfigurator(page);
  await openCategory(page, "sections_layout");

  const host = page.locator("[data-bookcase-builder]");
  const beforeBlank = await host.evaluate((root) => {
    const controller = root.__bookcaseConfigurator;
    return {
      widths: controller.layout.metrics.sectionClearWidths.slice(),
      updateCount: controller.updateCount,
      fingerprint: controller.bom.layoutFingerprint
    };
  });
  const exactWidth = page.locator("[data-section-width]");
  await exactWidth.fill("");
  await exactWidth.press("Tab");
  await expect(exactWidth).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("[data-section-width-error]")).toContainText("Enter a valid clear section width");
  const afterBlank = await host.evaluate((root) => {
    const controller = root.__bookcaseConfigurator;
    return {
      widths: controller.layout.metrics.sectionClearWidths.slice(),
      updateCount: controller.updateCount,
      fingerprint: controller.bom.layoutFingerprint
    };
  });
  expect(afterBlank).toEqual(beforeBlank);

  const divider = page.locator('[data-section-divider="0"]');
  const beforeKeyboard = await host.evaluate((root) => ({
    widths: root.__bookcaseConfigurator.layout.metrics.sectionClearWidths.slice(),
    view: root.__bookcaseConfigurator.viewer.getViewState()
  }));
  await divider.focus();
  await divider.press("ArrowRight");
  const afterKeyboard = await host.evaluate((root) => ({
    widths: root.__bookcaseConfigurator.layout.metrics.sectionClearWidths.slice(),
    view: root.__bookcaseConfigurator.viewer.getViewState()
  }));
  expect(afterKeyboard.widths).not.toEqual(beforeKeyboard.widths);
  expect(afterKeyboard.widths.slice(2)).toEqual(beforeKeyboard.widths.slice(2));
  expectExactCamera(afterKeyboard.view, beforeKeyboard.view);

  let sectionCount = page.locator('[data-stepper-control="sections"] input[data-field="sections"]');
  await sectionCount.fill("6");
  await expect(page.locator("[data-section-select]")).toHaveCount(6);
  await page.locator('[data-section-select="5"]').click();
  sectionCount = page.locator('[data-stepper-control="sections"] input[data-field="sections"]');
  await sectionCount.fill("5");
  await expect(page.locator("[data-section-select]")).toHaveCount(5);
  await expect(page.locator('[data-section-select="4"]')).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => host.evaluate((root) => root.__bookcaseConfigurator.viewer.sectionDesigner.selectedIndex)).toBe(4);

  await page.locator('[data-section-select="2"]').click();
  await page.locator("[data-section-actions] > summary").click();
  await page.locator('[data-section-merge="left"]').click();
  await expect(page.locator("[data-section-select]")).toHaveCount(4);
  await expect(page.locator('[data-section-select="1"]')).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => host.evaluate((root) => root.__bookcaseConfigurator.viewer.sectionDesigner.selectedIndex)).toBe(1);

  const unifiedSectionCount = page.locator('[data-category-panel="sections_layout"] [data-stepper-control="sections"] input[data-field="sections"]');
  await expect(unifiedSectionCount).toHaveCount(1);
  await unifiedSectionCount.fill("3");
  await expect.poll(() => host.evaluate((root) => root.__bookcaseConfigurator.state.sections)).toBe(3);
  await expect.poll(() => host.evaluate((root) => root.__bookcaseConfigurator.layout.metrics.sectionClearWidths)).toEqual([31, 31, 31]);
  expect(runtimeErrors).toEqual([]);
});
