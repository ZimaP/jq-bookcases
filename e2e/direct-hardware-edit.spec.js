import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

function monitorRuntime(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("requestfailed", (request) => {
    errors.push(`requestfailed: ${request.method()} ${request.url()} (${request.failure()?.errorText || "unknown"})`);
  });
  return errors;
}

async function openDirectHardwareEditor(page) {
  await page.goto("/configurator.html?preset=lower-cabinets", { waitUntil: "networkidle" });
  const builder = page.locator("[data-bookcase-builder]");
  const viewer = page.locator("[data-3d-viewer]");
  await expect(viewer).toHaveAttribute("data-render-valid", "true", { timeout: 20_000 });
  await expect(viewer.locator("canvas")).toHaveCount(1);

  const hardwareStage = page.locator('[data-workspace-stage="hardware"]');
  await hardwareStage.click();
  await expect(hardwareStage).toHaveAttribute("aria-current", "location");
  const properties = page.locator("[data-properties-inspector]");
  await expect(properties).toBeVisible();
  await expect(properties.locator('[data-active-stage-panel="hardware"]')).toBeVisible();
  await properties.locator('[data-open-hardware-library]').click();

  const editor = page.locator("[data-direct-hardware-editor]");
  await expect(editor).toHaveAttribute("data-catalog-state", "ready", { timeout: 20_000 });
  await expect(editor).toHaveAttribute("data-enabled", "true");
  await expect(page.locator("body")).toHaveAttribute("data-direct-hardware-editing", "ready");
  await expect.poll(async () => builder.evaluate((host) => (
    Boolean(host.__bookcaseConfigurator?.directHardwareEditor?.presentation?.selected)
  ))).toBe(true);
  await expect.poll(async () => builder.evaluate((host) => (
    Boolean(host.__bookcaseConfigurator?.viewer?.getDiagnostics?.().cameraTransitionActive)
  ))).toBe(false);
  return { builder, viewer, editor, properties };
}

async function selectVisibleHardwareFromTree(page) {
  const componentId = await page.locator("[data-bookcase-builder]").evaluate((host) => (
    host.__bookcaseConfigurator?.directHardwareEditor?.presentation?.selected?.component?.id || null
  ));
  expect(componentId).toBeTruthy();
  await expect(page.locator("[data-direct-quick-card]")).toBeHidden();
  await expect(page.locator("[data-direct-quick-content]")).not.toBeEmpty();
  return componentId;
}

async function activateSuppressedQuickControl(locator) {
  await locator.evaluate((control) => control.click());
}

async function openHardwareLibrary(page, builder) {
  const opened = await builder.evaluate((host) => (
    host.__bookcaseConfigurator?.directHardwareEditor?.openLibrary?.() || false
  ));
  expect(opened).toBe(true);
  const library = page.locator("[data-hardware-library]");
  await expect(library).toBeVisible();
  return library;
}

async function readTransaction(page) {
  return page.locator("[data-bookcase-builder]").evaluate((host) => {
    const controller = host.__bookcaseConfigurator;
    const editor = controller.directHardwareEditor;
    const viewer = controller.viewer.getDiagnostics();
    const view = controller.viewer.getViewState();
    const selectedHostId = editor?.presentation?.selected?.host?.id
      || Object.keys(controller.state.hardwareSelections?.byHostId || {})[0]
      || null;
    const selectedVariant = editor?.getSelectedVariant?.();
    return {
      stateJson: JSON.stringify(controller.state),
      bomJson: JSON.stringify(controller.pricing?.bom),
      price: controller.price,
      updateCount: controller.updateCount,
      priceCalculationCount: controller.priceCalculationCount,
      selectedHostId,
      selectedVariantId: selectedVariant?.id || null,
      draftVariantId: editor?.presentation?.draft?.variantId || null,
      previewed: Boolean(editor?.presentation?.previewed),
      history: editor?.history?.snapshot?.() || null,
      hostSelection: selectedHostId
        ? structuredClone(controller.state.hardwareSelections?.byHostId?.[selectedHostId] || null)
        : null,
      hardwareCatalogVersion: controller.state.hardwareSelections?.catalogVersion || null,
      hardwareSchedule: structuredClone(controller.pricing?.bom?.hardware?.schedule || []),
      installation: controller.state.installation,
      canvasIdentity: host.querySelector("[data-3d-viewer] canvas")?.dataset.directHardwareIdentity || "",
      viewer: {
        updateCount: viewer.updateCount,
        rebuildCount: viewer.rebuildCount,
        partialUpdateCount: viewer.partialUpdateCount,
        previewCount: viewer.previewCount,
        previewActive: viewer.previewActive,
        selectedComponentId: viewer.directEditing?.selectedComponentId || null
      },
      camera: {
        state: controller.cameraIntentState?.cameraState || null,
        profile: controller.cameraIntentState?.profile || null,
        sourceStage: controller.cameraIntentState?.sourceStage || null,
        sourceSectionIndex: controller.cameraIntentState?.sourceSectionIndex ?? null
      },
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

function formatViolations(violations) {
  return violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    nodes: violation.nodes.map((node) => ({ target: node.target, summary: node.failureSummary }))
  }));
}

test("direct hardware preview is transactional, Apply is exact and partial, and history preserves unrelated edits", async ({ page }) => {
  const runtimeErrors = monitorRuntime(page);
  const { builder, viewer } = await openDirectHardwareEditor(page);
  const componentId = await selectVisibleHardwareFromTree(page);
  const quickCard = page.locator("[data-direct-quick-card]");

  await expect(quickCard.locator(".direct-hardware-edit__accuracy")).toHaveText("Legacy-safe approximation");
  await expect(quickCard.locator(".direct-hardware-edit__facts dt")).toHaveText([
    "Selected size",
    "Finish",
    "Center to center",
    "Overall length",
    "Projection",
    "Material"
  ]);
  const factValues = await quickCard.locator(".direct-hardware-edit__facts dd").allTextContents();
  expect(factValues).toHaveLength(6);
  expect(factValues.every((value) => value.trim().length > 0)).toBe(true);

  await viewer.evaluate((root) => {
    root.querySelector("canvas").dataset.directHardwareIdentity = "persistent-direct-hardware-canvas";
  });
  const before = await readTransaction(page);
  expect(before.selectedHostId).toBeTruthy();
  expect(before.viewer.selectedComponentId).toBe(componentId);

  const alternateFinish = quickCard.locator('.direct-hardware-edit__swatches [data-preview-variant]:not([aria-pressed="true"]):not([disabled])').first();
  const exactVariantId = await alternateFinish.getAttribute("data-preview-variant");
  expect(exactVariantId).toBeTruthy();
  await activateSuppressedQuickControl(alternateFinish);
  await expect.poll(async () => (await readTransaction(page)).draftVariantId).toBe(exactVariantId);
  await expect.poll(async () => (await readTransaction(page)).previewed).toBe(true);
  await expect(quickCard.locator(".direct-hardware-edit__accuracy")).toHaveText("Dimensionally accurate proxy");
  await expect(quickCard.locator("[data-apply-hardware]")).toBeEnabled();

  const preview = await readTransaction(page);
  expect(preview.stateJson, "preview must not mutate accepted state").toBe(before.stateJson);
  expect(preview.bomJson, "preview must not mutate accepted BOM").toBe(before.bomJson);
  expect(preview.price, "preview must not mutate accepted price").toBe(before.price);
  expect(preview.updateCount).toBe(before.updateCount);
  expect(preview.priceCalculationCount).toBe(before.priceCalculationCount);
  expect(preview.viewer.previewCount).toBe(before.viewer.previewCount + 1);
  expect(preview.viewer.previewActive).toBe(true);
  expect(preview.viewer.rebuildCount).toBe(before.viewer.rebuildCount);
  expect(preview.viewer.partialUpdateCount).toBeGreaterThan(before.viewer.partialUpdateCount);
  expect(preview.canvasIdentity).toBe("persistent-direct-hardware-canvas");
  expectExactCamera(preview.view, before.view);

  await activateSuppressedQuickControl(quickCard.locator("[data-apply-hardware]"));
  await expect.poll(async () => (await readTransaction(page)).hostSelection?.variantId).toBe(exactVariantId);
  await expect(quickCard).toBeHidden();
  await expect.poll(async () => (await readTransaction(page)).camera.state).toBe("overview");

  const applied = await readTransaction(page);
  expect(applied.updateCount).toBe(before.updateCount + 1);
  expect(applied.priceCalculationCount).toBe(before.priceCalculationCount + 1);
  expect(applied.viewer.previewActive).toBe(false);
  expect(applied.viewer.rebuildCount).toBe(before.viewer.rebuildCount);
  expect(applied.viewer.partialUpdateCount).toBeGreaterThan(preview.viewer.partialUpdateCount);
  expect(applied.canvasIdentity).toBe("persistent-direct-hardware-canvas");
  expect(applied.camera).toMatchObject({
    state: "overview",
    profile: "overview",
    sourceStage: "hardware"
  });
  expect(applied.hardwareCatalogVersion).toEqual(expect.any(String));
  expect(applied.hostSelection).toMatchObject({
    variantId: exactVariantId,
    snapshot: {
      variantId: exactVariantId,
      brandName: expect.any(String),
      familyName: expect.any(String),
      finishName: expect.any(String)
    }
  });
  const exactSchedule = applied.hardwareSchedule.find((entry) => entry.variantId === exactVariantId);
  expect(exactSchedule).toMatchObject({
    resolvedFrom: "host",
    quantity: expect.any(Number),
    modelAccuracy: "dimensionally_accurate_parametric_proxy"
  });
  expect(exactSchedule.locations.some((location) => location.hostId === before.selectedHostId)).toBe(true);

  // Reopen the same semantic target, then make an unrelated accepted edit after the hardware command.
  const reopenLibrary = page.locator('[data-properties-inspector] [data-open-hardware-library]');
  await expect(reopenLibrary).toBeVisible();
  await reopenLibrary.click();
  await expect.poll(async () => builder.evaluate((host) => (
    Boolean(host.__bookcaseConfigurator?.directHardwareEditor?.presentation?.selected)
  ))).toBe(true);
  await expect(quickCard).toBeHidden();
  await builder.evaluate((host) => {
    const controller = host.__bookcaseConfigurator;
    controller.update({ ...controller.state, installation: "no_installation" }, { sourceField: "installation" });
  });
  await expect.poll(async () => (await readTransaction(page)).installation).toBe("no_installation");
  await expect(quickCard.locator("[data-history-undo]")).toBeEnabled();

  expect(await builder.evaluate((host) => host.__bookcaseConfigurator.directHardwareEditor.undo())).toBe(true);
  await expect.poll(async () => (await readTransaction(page)).hostSelection).toBeNull();
  const undone = await readTransaction(page);
  expect(undone.installation, "hardware undo must preserve a later unrelated edit").toBe("no_installation");
  expect(undone.history).toMatchObject({ undoCount: 0, redoCount: 1 });

  expect(await builder.evaluate((host) => host.__bookcaseConfigurator.directHardwareEditor.redo())).toBe(true);
  await expect.poll(async () => (await readTransaction(page)).hostSelection?.variantId).toBe(exactVariantId);
  const redone = await readTransaction(page);
  expect(redone.installation, "hardware redo must preserve a later unrelated edit").toBe("no_installation");
  expect(redone.history).toMatchObject({ undoCount: 1, redoCount: 0 });

  // Both the explicit Cancel action and Escape restore the committed hardware preview.
  const anotherFinish = quickCard.locator('.direct-hardware-edit__swatches [data-preview-variant]:not([aria-pressed="true"]):not([disabled])').first();
  await activateSuppressedQuickControl(anotherFinish);
  await expect.poll(async () => (await readTransaction(page)).previewed).toBe(true);
  const committedAfterRedo = (await readTransaction(page)).stateJson;
  await activateSuppressedQuickControl(quickCard.locator("[data-cancel-preview]"));
  await expect.poll(async () => (await readTransaction(page)).previewed).toBe(false);
  expect((await readTransaction(page)).stateJson).toBe(committedAfterRedo);

  const escapeFinish = quickCard.locator('.direct-hardware-edit__swatches [data-preview-variant]:not([aria-pressed="true"]):not([disabled])').first();
  await activateSuppressedQuickControl(escapeFinish);
  await expect.poll(async () => (await readTransaction(page)).previewed).toBe(true);
  await page.keyboard.press("Escape");
  await expect(quickCard).toBeHidden();
  const escaped = await readTransaction(page);
  expect(escaped.previewed).toBe(false);
  expect(escaped.viewer.previewActive).toBe(false);
  expect(escaped.stateJson).toBe(committedAfterRedo);
  expect(runtimeErrors).toEqual([]);
});

test("library filtering exposes gated facts, traps focus, and passes its WCAG A/AA audit", async ({ page }) => {
  const runtimeErrors = monitorRuntime(page);
  const { builder } = await openDirectHardwareEditor(page);
  await selectVisibleHardwareFromTree(page);
  const library = await openHardwareLibrary(page, builder);
  await expect(library).toBeFocused();
  await page.keyboard.press("Tab");
  const closeLibrary = page.getByRole("button", { name: "Close hardware library" });
  await expect(closeLibrary).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  expect(await library.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Tab");
  await expect(closeLibrary).toBeFocused();

  const filters = library.locator(".direct-hardware-edit__filters");
  await filters.locator("summary").click();
  await library.locator('[data-library-filter="brand"]').selectOption("emtek");
  await library.locator("[data-library-search]").fill("select");
  await expect(library.locator("[data-library-summary]")).toHaveText("1 family · 12 exact variants");

  const exactFinish = library.locator('[data-library-filter="exactFinish"]');
  await expect(exactFinish.locator("option")).toHaveCount(48);
  const exactFinishValue = await exactFinish.locator("option").evaluateAll((options) => (
    options.find((option) => option.value.startsWith("emtek-select-rectangular-smooth|"))?.value || ""
  ));
  expect(exactFinishValue).toMatch(/^emtek-select-rectangular-smooth\|/);
  await exactFinish.selectOption(exactFinishValue);
  await expect(library.locator("[data-library-summary]")).toHaveText("1 family · 3 exact variants");

  const gatedCard = library.locator(".direct-hardware-edit__family-card", { hasText: "SELECT Rectangular Bar Smooth" });
  await expect(gatedCard).toHaveCount(1);
  await expect(gatedCard.locator(".direct-hardware-edit__caveat")).toContainText("Release gated");
  await expect(gatedCard.getByRole("button", { name: "Release gated", exact: true })).toBeDisabled();
  await gatedCard.getByRole("button", { name: "Details", exact: true }).click();

  const details = library.locator("section[data-product-details]");
  await expect(details).toBeVisible();
  await expect(details).toContainText("Exact product facts");
  await expect(details).toContainText("Manufacturer number");
  await expect(details).toContainText("Model accuracy");
  await expect(details.locator(".direct-hardware-edit__warnings")).toContainText("Release gate");
  await expect(details.locator(".direct-hardware-edit__sources a")).not.toHaveCount(0);
  await expect(details.getByRole("button", { name: /Release gated · details only/ })).toBeDisabled();
  await expect(library.locator("[data-library-body]")).toHaveAttribute("aria-hidden", "true");
  await expect(library.locator("[data-library-body]")).toHaveAttribute("inert", "");

  await details.getByRole("button", { name: "Back to library" }).click();
  await expect(details).toBeHidden();
  await expect(gatedCard.getByRole("button", { name: "Details", exact: true })).toBeFocused();

  const axe = await new AxeBuilder({ page })
    .include("[data-hardware-library]")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(formatViolations(axe.violations)).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});

test("phone layout keeps the fixed Properties sheet and hardware library bounded without horizontal overflow", async ({ page }) => {
  const runtimeErrors = monitorRuntime(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const { builder, properties } = await openDirectHardwareEditor(page);
  await selectVisibleHardwareFromTree(page);

  const editor = page.locator("[data-direct-hardware-editor]");
  const quickCard = page.locator("[data-direct-quick-card]");
  await expect(editor).toHaveAttribute("data-anchor-mode", "sheet");
  await expect(quickCard).toBeHidden();
  await properties.scrollIntoViewIfNeeded();
  const propertiesGeometry = await properties.evaluate((panel) => {
    const rect = panel.getBoundingClientRect();
    const style = getComputedStyle(panel);
    const scroller = panel.querySelector(".workspace-properties-panel");
    const scrollerRect = scroller.getBoundingClientRect();
    const scrollerStyle = getComputedStyle(scroller);
    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      width: rect.width,
      position: style.position,
      overflowY: style.overflowY,
      scrollerTop: scrollerRect.top,
      scrollerBottom: scrollerRect.bottom,
      scrollerOverflowY: scrollerStyle.overflowY,
      documentOverflow: document.documentElement.scrollWidth - window.innerWidth
    };
  });
  expect(propertiesGeometry.position).toBe("relative");
  expect(propertiesGeometry.left).toBeGreaterThanOrEqual(-1);
  expect(propertiesGeometry.right).toBeLessThanOrEqual(391);
  expect(propertiesGeometry.top).toBeGreaterThanOrEqual(-1);
  expect(propertiesGeometry.bottom).toBeLessThanOrEqual(845);
  expect(propertiesGeometry.width).toBeLessThanOrEqual(390);
  expect(propertiesGeometry.overflowY).toBe("hidden");
  expect(propertiesGeometry.scrollerTop).toBeGreaterThanOrEqual(propertiesGeometry.top);
  expect(propertiesGeometry.scrollerBottom).toBeLessThanOrEqual(propertiesGeometry.bottom + 1);
  expect(propertiesGeometry.scrollerOverflowY).toBe("auto");
  expect(propertiesGeometry.documentOverflow).toBeLessThanOrEqual(1);

  const library = await openHardwareLibrary(page, builder);
  const libraryGeometry = await library.evaluate((dialog) => {
    const rect = dialog.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      documentOverflow: document.documentElement.scrollWidth - window.innerWidth
    };
  });
  expect(libraryGeometry.left).toBeGreaterThanOrEqual(-1);
  expect(libraryGeometry.right).toBeLessThanOrEqual(libraryGeometry.viewportWidth + 1);
  expect(libraryGeometry.top).toBeGreaterThanOrEqual(45);
  expect(libraryGeometry.bottom).toBeLessThanOrEqual(libraryGeometry.viewportHeight + 1);
  expect(libraryGeometry.documentOverflow).toBeLessThanOrEqual(1);
  expect(runtimeErrors).toEqual([]);
});
