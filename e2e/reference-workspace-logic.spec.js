import { test, expect } from "@playwright/test";

async function openWorkspace(page, preset = "classic-open") {
  await page.goto(`/configurator.html?preset=${encodeURIComponent(preset)}`, { waitUntil: "networkidle" });
  await expect(page.locator("[data-3d-viewer]")).toHaveAttribute("data-render-valid", "true", { timeout: 20_000 });
  await expect(page.locator("[data-3d-viewer] canvas")).toHaveCount(1);
}

async function expectSectionSelectionSynchronized(page) {
  const selection = await page.locator("[data-bookcase-builder]").evaluate((host) => {
    const controller = host.__bookcaseConfigurator;
    return {
      selectedSectionIndex: controller.selectedSectionIndex,
      selection: controller.getDiagnostics().selection,
      contextEditorOpen: controller.contextEditorOpen
    };
  });
  expect(selection.contextEditorOpen).toBe(true);
  expect(selection.selection).toMatchObject({
    editorId: "section",
    sectionIndex: selection.selectedSectionIndex
  });
  await expect(page.locator(`[data-section-select="${selection.selectedSectionIndex}"]`)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-properties-inspector] .workspace-properties-heading h2")).toHaveText(
    `Section ${selection.selectedSectionIndex + 1}`
  );
}

async function deleteFromOrganizerCard(page, index) {
  const card = page.locator(`[data-section-card="${index}"]`);
  const action = card.locator(`[data-section-delete="${index}"]`);
  await expect(action).toBeVisible();
  await action.click();
}

test("global hardware changes preserve exact per-host selections and migration warnings", async ({ page }) => {
  await openWorkspace(page, "lower-cabinets");
  const seeded = await page.locator("[data-bookcase-builder]").evaluate((host) => {
    const controller = host.__bookcaseConfigurator;
    const hostId = controller.layout.components.find((component) => component.role === "handle")?.hostId;
    const selections = structuredClone(controller.state.hardwareSelections);
    selections.byHostId[hostId] = {
      variantId: selections.defaultVariantId,
      snapshot: structuredClone(selections.defaultSnapshot),
      placement: {}
    };
    selections.migrationWarnings = [
      ...(selections.migrationWarnings || []),
      { code: "TEST_RETAINED_WARNING", message: "Retain this exact-selection warning." }
    ];
    const applied = controller.update(
      { ...controller.state, hardwareSelections: selections },
      { sourceField: "hardwareSelections" }
    );
    return {
      applied,
      hostId,
      variantId: controller.state.hardwareSelections.byHostId[hostId]?.variantId,
      snapshot: controller.state.hardwareSelections.byHostId[hostId]?.snapshot
    };
  });
  expect(seeded.applied).toBe(true);
  expect(seeded.hostId).toBeTruthy();

  await page.locator('[data-workspace-stage="hardware"]').click();
  const originalType = await page.locator("[data-properties-inspector] [data-hardware-type]:checked").inputValue();
  const nextType = originalType === "pull" ? "knob" : "pull";
  await page.locator(`[data-properties-inspector] .hardware-type-choice:has([data-hardware-type][value="${nextType}"])`).click();

  const result = await page.locator("[data-bookcase-builder]").evaluate((host, hostId) => {
    const selections = host.__bookcaseConfigurator.state.hardwareSelections;
    return {
      defaultVariantId: selections.defaultVariantId,
      exact: selections.byHostId[hostId],
      warningCodes: selections.migrationWarnings.map((warning) => warning.code)
    };
  }, seeded.hostId);
  expect(result.defaultVariantId).not.toBe(seeded.variantId);
  expect(result.exact.variantId).toBe(seeded.variantId);
  expect(result.exact.snapshot).toEqual(seeded.snapshot);
  expect(result.warningCodes).toContain("TEST_RETAINED_WARNING");
});

test("add, duplicate, and delete keep organizer, model selection, and Properties synchronized", async ({ page }) => {
  await openWorkspace(page, "display-wall");
  const add = page.locator("[data-section-organizer] [data-section-add]");
  await expect(add).toBeEnabled();
  await add.click();
  await expect(page.locator("[data-section-organizer] [data-section-card]")).toHaveCount(4);
  await expectSectionSelectionSynchronized(page);

  await openWorkspace(page, "display-wall");
  const duplicate = page.locator("[data-properties-inspector] [data-section-duplicate]");
  await expect(duplicate).toBeEnabled();
  await duplicate.click();
  await expect(page.locator("[data-section-organizer] [data-section-card]")).toHaveCount(4);
  await expectSectionSelectionSynchronized(page);

  await openWorkspace(page, "display-wall");
  await page.locator('[data-section-organizer] [data-section-select="0"]').click();
  const deleteSection = page.locator("[data-properties-inspector] [data-section-delete]");
  await expect(deleteSection).toBeEnabled();
  await deleteSection.click();
  await expect(page.locator("[data-section-organizer] [data-section-card]")).toHaveCount(2);
  await expectSectionSelectionSynchronized(page);
});

test("the default layout can add a neutral section and delete it from the selected organizer card", async ({ page }) => {
  await openWorkspace(page, "lower-cabinets");
  const add = page.locator("[data-section-organizer] [data-section-add]");
  await expect(add).toBeEnabled();
  await add.click();
  await expect(page.locator("[data-section-organizer] [data-section-card]")).toHaveCount(5);
  await expectSectionSelectionSynchronized(page);

  const added = await page.locator("[data-bookcase-builder]").evaluate((host) => {
    const controller = host.__bookcaseConfigurator;
    return {
      width: controller.state.width,
      selectedSectionIndex: controller.selectedSectionIndex,
      types: controller.layout.components
        .filter((component) => component.role === "section")
        .map((component) => component.metadata.type),
      widths: controller.layout.metrics.sectionClearWidths
    };
  });
  expect(added.width).toBe(96);
  expect(added.selectedSectionIndex).toBe(1);
  expect(added.types).toEqual(["lower_doors", "open", "lower_doors", "lower_doors", "lower_doors"]);
  expect(added.widths).toEqual([18.3, 18.3, 18.3, 18.3, 18.3]);

  await deleteFromOrganizerCard(page, 1);
  await expect(page.locator("[data-section-organizer] [data-section-card]")).toHaveCount(4);
  await expectSectionSelectionSynchronized(page);
});

test("delete reflows a door layout when an adjacent merge is not buildable", async ({ page }) => {
  await openWorkspace(page, "glass-library");
  await page.locator('[data-section-organizer] [data-section-select="0"]').click();
  await deleteFromOrganizerCard(page, 0);
  await expect(page.locator("[data-section-organizer] [data-section-card]")).toHaveCount(3);

  const result = await page.locator("[data-bookcase-builder]").evaluate((host) => {
    const controller = host.__bookcaseConfigurator;
    return {
      width: controller.state.width,
      types: controller.layout.components
        .filter((component) => component.role === "section")
        .map((component) => component.metadata.type),
      widths: controller.layout.metrics.sectionClearWidths,
      renderValid: controller.getDiagnostics().viewer.renderAudit.valid
    };
  });
  expect(result.width).toBe(108);
  expect(result.types).toEqual(["lower_doors", "lower_doors", "lower_doors"]);
  expect(result.widths).toEqual([35, 35, 35]);
  expect(result.renderValid).toBe(true);
  await expectSectionSelectionSynchronized(page);
});

test("organizer exposes visible labeled duplicate and delete actions without a disclosure menu", async ({ page }) => {
  await openWorkspace(page);
  const firstCard = page.locator('[data-section-card="0"]');
  await expect(firstCard.locator('.workspace-section-card-actions')).toBeVisible();
  await expect(firstCard.getByRole('button', { name: 'Duplicate Section 1' })).toBeVisible();
  await expect(firstCard.getByRole('button', { name: 'Delete Section 1' })).toBeVisible();
  await expect(page.locator('.workspace-section-menu, .workspace-section-card summary')).toHaveCount(0);
});

test("back-panel hits route to the read-only Back properties summary", async ({ page }) => {
  await openWorkspace(page);
  const result = await page.locator("[data-bookcase-builder]").evaluate((host) => {
    const controller = host.__bookcaseConfigurator;
    const backPanel = controller.layout.components.find((component) => component.role === "back_panel");
    return {
      accepted: controller.handleModelSelection({ componentId: backPanel?.id, source: "canvas" }),
      diagnostics: controller.getDiagnostics()
    };
  });
  expect(result.accepted).toBe(true);
  expect(result.diagnostics).toMatchObject({
    activeWorkspaceStage: "layout",
    contextEditorOpen: true,
    selection: {
      editorId: "back",
      role: "back_panel",
      title: "Fitted Back"
    }
  });
  await expect(page.locator("[data-properties-inspector] [data-inspector-tab]")).toHaveCount(0);
  await expect(page.locator("[data-properties-inspector] .workspace-properties-panel")).toHaveCount(1);
  await expect(page.locator("[data-properties-inspector] .workspace-properties-heading h2")).toHaveText("Fitted Back");
  await expect(page.locator("[data-properties-inspector] .workspace-readonly-property")).toContainText("Standard fitted back");
  await expect(page.locator("[data-properties-inspector] .workspace-readonly-property")).toContainText("Included");
});
