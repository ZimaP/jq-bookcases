import { test, expect } from "@playwright/test";

const phoneViewports = [
  { name: "320x568", width: 320, height: 568 },
  { name: "375x667", width: 375, height: 667 },
  { name: "390x844", width: 390, height: 844 },
  { name: "393x852", width: 393, height: 852 },
  { name: "414x896", width: 414, height: 896 },
  { name: "430x932", width: 430, height: 932 }
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

async function openMobileConfigurator(page, viewport) {
  await page.setViewportSize(viewport);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/configurator.html?preset=lower-cabinets", { waitUntil: "networkidle" });
  const viewer = page.locator("[data-3d-viewer]");
  await expect(viewer).toBeVisible();
  await expect(viewer).toHaveAttribute("data-render-valid", "true", { timeout: 20_000 });
  await expect(viewer.locator("canvas")).toHaveCount(1);
  await expect(page.locator("[data-mobile-category]")).toHaveCount(9);
  await settleFrames(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  return viewer;
}

async function readMobileGeometry(page) {
  return page.evaluate(() => {
    const bySelector = (selector) => document.querySelector(selector);
    const rect = (selector) => {
      const bounds = bySelector(selector)?.getBoundingClientRect();
      return bounds
        ? { top: bounds.top, right: bounds.right, bottom: bounds.bottom, left: bounds.left, width: bounds.width, height: bounds.height }
        : null;
    };
    const oneLineTextMetrics = (element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const lineRects = [...range.getClientRects()].filter((bounds) => bounds.width > 0 && bounds.height > 0);
      const style = getComputedStyle(element);
      return {
        lines: lineRects.length,
        whiteSpace: style.whiteSpace,
        writingMode: style.writingMode,
        width: element.getBoundingClientRect().width,
        height: element.getBoundingClientRect().height
      };
    };
    const sectionRail = bySelector(".workspace-section-cards");
    const categoryRail = bySelector("[data-mobile-category-list]");
    const workspace = bySelector("[data-configurator-workspace]");
    const footer = bySelector("[data-estimate-bar]");
    const cards = [...document.querySelectorAll("[data-section-card]")];
    const footerButtons = [...footer.querySelectorAll(".configurator-actions button")];
    const ordered = [
      bySelector("[data-site-header]"),
      bySelector(".workspace-viewer-room"),
      bySelector("[data-model-toolbar]"),
      bySelector("[data-section-organizer]"),
      bySelector("[data-mobile-categories]"),
      bySelector("[data-properties-inspector]"),
      footer
    ];

    return {
      viewport: { width: innerWidth, height: innerHeight },
      header: rect("[data-site-header]"),
      viewer: rect(".workspace-viewer-room"),
      toolbar: rect("[data-model-toolbar]"),
      sections: rect("[data-section-organizer]"),
      categories: rect("[data-mobile-categories]"),
      properties: rect("[data-properties-inspector]"),
      footer: rect("[data-estimate-bar]"),
      footerPosition: getComputedStyle(footer).position,
      footerButtons: footerButtons.map((button) => ({
        width: button.getBoundingClientRect().width,
        height: button.getBoundingClientRect().height,
        whiteSpace: getComputedStyle(button).whiteSpace
      })),
      documentOverflow: document.scrollingElement.scrollWidth - innerWidth,
      bodyOverflow: document.body.scrollWidth - innerWidth,
      workspacePaddingBottom: parseFloat(getComputedStyle(workspace).paddingBottom) || 0,
      sectionRail: {
        clientWidth: sectionRail.clientWidth,
        scrollWidth: sectionRail.scrollWidth,
        overflowX: getComputedStyle(sectionRail).overflowX,
        touchAction: getComputedStyle(sectionRail).touchAction
      },
      categoryRail: {
        clientWidth: categoryRail.clientWidth,
        scrollWidth: categoryRail.scrollWidth,
        overflowX: getComputedStyle(categoryRail).overflowX,
        touchAction: getComputedStyle(categoryRail).touchAction
      },
      cards: cards.map((card) => {
        const bounds = card.getBoundingClientRect();
        return {
          width: bounds.width,
          height: bounds.height,
          name: oneLineTextMetrics(card.querySelector(".workspace-section-card-main strong")),
          value: oneLineTextMetrics(card.querySelector(".workspace-section-card-width"))
        };
      }),
      domOrderIsCorrect: ordered.every((element, index) => (
        index === ordered.length - 1
        || Boolean(element.compareDocumentPosition(ordered[index + 1]) & Node.DOCUMENT_POSITION_FOLLOWING)
      ))
    };
  });
}

test("the deliberate mobile hierarchy holds at every required phone viewport", async ({ page }) => {
  test.setTimeout(180_000);
  const runtimeErrors = monitorRuntime(page);

  for (const viewport of phoneViewports) {
    const viewer = await openMobileConfigurator(page, viewport);
    const geometry = await readMobileGeometry(page);

    expect(geometry.domOrderIsCorrect, `${viewport.name}: DOM order`).toBe(true);
    expect(geometry.header.bottom, `${viewport.name}: header before viewer`).toBeLessThanOrEqual(geometry.viewer.top + 1);
    expect(geometry.viewer.bottom, `${viewport.name}: viewer before toolbar`).toBeLessThanOrEqual(geometry.toolbar.top + 1);
    expect(geometry.toolbar.bottom, `${viewport.name}: toolbar before sections`).toBeLessThanOrEqual(geometry.sections.top + 1);
    expect(geometry.sections.bottom, `${viewport.name}: sections before categories`).toBeLessThanOrEqual(geometry.categories.top + 1);
    expect(geometry.categories.bottom, `${viewport.name}: categories before properties`).toBeLessThanOrEqual(geometry.properties.top + 1);

    expect(geometry.viewer.height, `${viewport.name}: dominant viewer height`).toBeGreaterThanOrEqual(viewport.width * 0.85);
    expect(geometry.viewer.height, `${viewport.name}: viewer dominates organizer`).toBeGreaterThan(geometry.sections.height * 2.25);
    expect(geometry.viewer.width, `${viewport.name}: full-width viewer`).toBeGreaterThanOrEqual(viewport.width - 1);
    await expect(viewer).toHaveAttribute("data-render-valid", "true");

    expect(geometry.documentOverflow, `${viewport.name}: document horizontal overflow`).toBeLessThanOrEqual(1);
    expect(geometry.bodyOverflow, `${viewport.name}: body horizontal overflow`).toBeLessThanOrEqual(1);
    expect(geometry.sectionRail.scrollWidth, `${viewport.name}: section rail scroll range`).toBeGreaterThan(geometry.sectionRail.clientWidth + 8);
    expect(geometry.categoryRail.scrollWidth, `${viewport.name}: category rail scroll range`).toBeGreaterThan(geometry.categoryRail.clientWidth + 8);
    expect(geometry.sectionRail.overflowX).toMatch(/auto|scroll/);
    expect(geometry.categoryRail.overflowX).toMatch(/auto|scroll/);
    expect(geometry.sectionRail.touchAction).toContain("pan-x");
    expect(geometry.categoryRail.touchAction).toContain("pan-x");

    expect(geometry.cards.length).toBe(4);
    for (const [index, card] of geometry.cards.entries()) {
      expect(card.width, `${viewport.name}: Section ${index + 1} card width`).toBeGreaterThanOrEqual(127.5);
      expect(card.height, `${viewport.name}: Section ${index + 1} card height`).toBeGreaterThanOrEqual(96);
      expect(card.name.lines, `${viewport.name}: Section ${index + 1} name line count`).toBe(1);
      expect(card.value.lines, `${viewport.name}: Section ${index + 1} width line count`).toBe(1);
      expect(card.name.whiteSpace).toBe("nowrap");
      expect(card.value.whiteSpace).toBe("nowrap");
      expect(card.name.writingMode).toBe("horizontal-tb");
      expect(card.value.writingMode).toBe("horizontal-tb");
    }

    expect(geometry.footerPosition).toBe("fixed");
    expect(geometry.footer.bottom, `${viewport.name}: footer attached to viewport`).toBeCloseTo(viewport.height, 0);
    expect(geometry.workspacePaddingBottom, `${viewport.name}: footer clearance`).toBeGreaterThanOrEqual(geometry.footer.height + 20);
    for (const button of geometry.footerButtons) {
      expect(button.height, `${viewport.name}: footer touch target`).toBeGreaterThanOrEqual(44);
      expect(button.whiteSpace).toBe("nowrap");
    }

    await page.evaluate(() => window.scrollTo(0, document.scrollingElement.scrollHeight));
    await settleFrames(page, 2);
    const bottomClearance = await page.evaluate(() => {
      const properties = document.querySelector("[data-properties-inspector]").getBoundingClientRect();
      const footer = document.querySelector("[data-estimate-bar]").getBoundingClientRect();
      return footer.top - properties.bottom;
    });
    expect(bottomClearance, `${viewport.name}: settings clear sticky footer at page end`).toBeGreaterThanOrEqual(19);
  }

  expect(runtimeErrors).toEqual([]);
});

test("mobile rails reveal active items and section changes synchronize model state and price", async ({ page }) => {
  const runtimeErrors = monitorRuntime(page);
  const viewer = await openMobileConfigurator(page, { width: 390, height: 844 });

  const sectionRail = page.locator(".workspace-section-cards");
  await sectionRail.evaluate((element) => { element.scrollLeft = 0; });
  const firstSection = page.locator('[data-section-select="0"]');
  await firstSection.focus();
  await firstSection.press("End");
  const lastSection = page.locator('[data-section-select="3"]');
  await expect(lastSection).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => sectionRail.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  const selectedSectionVisibility = await page.locator("[data-section-card].is-selected").evaluate((card) => {
    const item = card.getBoundingClientRect();
    const rail = card.closest(".workspace-section-cards").getBoundingClientRect();
    return { left: item.left - rail.left, right: rail.right - item.right };
  });
  expect(selectedSectionVisibility.left).toBeGreaterThanOrEqual(-1);
  expect(selectedSectionVisibility.right).toBeGreaterThanOrEqual(-1);

  const sectionMenu = page.locator('[data-section-card="3"] .workspace-section-menu');
  const sectionMenuTrigger = sectionMenu.locator('[data-section-menu-trigger="3"]');
  await sectionMenuTrigger.click();
  await expect(sectionMenu).toHaveAttribute("open", "");
  const menuActions = sectionMenu.locator(":scope > div > button");
  await expect(menuActions).toHaveCount(2);
  for (const action of await menuActions.all()) {
    const box = await action.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
  await sectionMenuTrigger.press("Escape");
  await expect(sectionMenu).not.toHaveAttribute("open", "");
  await expect(sectionMenuTrigger).toBeFocused();

  const categoryRail = page.locator("[data-mobile-category-list]");
  await categoryRail.evaluate((element) => { element.scrollLeft = 0; });
  const sectionsCategory = page.locator('[data-mobile-category="sections"]');
  await sectionsCategory.focus();
  await sectionsCategory.press("End");
  const viewCategory = page.locator('[data-mobile-category="view"]');
  await expect(viewCategory).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('[data-mobile-category-panel="view"]')).toBeVisible();
  await expect.poll(() => categoryRail.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  const activeCategoryVisibility = await viewCategory.evaluate((tab) => {
    const item = tab.getBoundingClientRect();
    const rail = tab.closest("[data-mobile-category-list]").getBoundingClientRect();
    return { left: item.left - rail.left, right: rail.right - item.right };
  });
  expect(activeCategoryVisibility.left).toBeGreaterThanOrEqual(-1);
  expect(activeCategoryVisibility.right).toBeGreaterThanOrEqual(-1);

  await viewCategory.press("Home");
  await expect(page.locator('[data-mobile-category="sections"]')).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('[data-mobile-category-panel="sections"]')).toBeVisible();

  const before = await page.locator("[data-bookcase-builder]").evaluate((host) => {
    const controller = host.__bookcaseConfigurator;
    const diagnostics = controller.getDiagnostics();
    return {
      sections: diagnostics.state.sections,
      price: diagnostics.price,
      generation: controller.viewer.getModelGeneration(),
      updateCount: diagnostics.updateCount
    };
  });
  const increaseSections = page.locator('[data-step-field="sections"][data-step-direction="1"]');
  await expect(increaseSections).toBeEnabled();
  await increaseSections.click();

  await expect(page.locator("[data-section-card]")).toHaveCount(before.sections + 1);
  await expect(page.locator('input[data-field="sections"]')).toHaveValue(String(before.sections + 1));
  await expect(viewer).toHaveAttribute("data-render-valid", "true");
  await expect.poll(async () => page.locator("[data-bookcase-builder]").evaluate((host) => (
    host.__bookcaseConfigurator.getDiagnostics().state.sections
  ))).toBe(before.sections + 1);

  const after = await page.locator("[data-bookcase-builder]").evaluate((host) => {
    const controller = host.__bookcaseConfigurator;
    const diagnostics = controller.getDiagnostics();
    return {
      sections: diagnostics.state.sections,
      sectionComponents: controller.layout.components.filter((component) => component.role === "section").length,
      clearWidths: controller.layout.metrics.sectionClearWidths.length,
      price: diagnostics.price,
      renderedPrice: Number(document.querySelector("[data-price]").textContent.replace(/[^0-9]/g, "")),
      generation: controller.viewer.getModelGeneration(),
      updateCount: diagnostics.updateCount
    };
  });

  expect(after.sections).toBe(before.sections + 1);
  expect(after.sectionComponents).toBe(after.sections);
  expect(after.clearWidths).toBe(after.sections);
  expect(after.price).not.toBe(before.price);
  expect(after.renderedPrice).toBe(after.price);
  expect(after.generation).toBeGreaterThan(before.generation);
  expect(after.updateCount).toBeGreaterThan(before.updateCount);
  expect(runtimeErrors).toEqual([]);
});

test("mobile model and field routing retain crown and fitted-back editing context", async ({ page }) => {
  const runtimeErrors = monitorRuntime(page);
  await openMobileConfigurator(page, { width: 390, height: 844 });
  const builder = page.locator("[data-bookcase-builder]");

  const crownSelection = await builder.evaluate((host) => {
    const controller = host.__bookcaseConfigurator;
    const crown = controller.layout.components.find((component) => component.role === "crown");
    return {
      componentId: crown?.id || null,
      accepted: crown ? controller.handleModelSelection({ componentId: crown.id, source: "api" }) : false,
      category: controller.activeMobileCategoryId
    };
  });
  expect(crownSelection.componentId).toBeTruthy();
  expect(crownSelection).toMatchObject({ accepted: true, category: "crown" });
  await expect(page.locator('[data-mobile-category="crown"]')).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('[data-mobile-category-panel="crown"] [data-structure-part="crown"]')).toBeVisible();
  await expect(page.locator('[data-mobile-category-panel="crown"] [data-structure-part="base"]')).toBeHidden();

  const fieldRoute = await builder.evaluate((host) => {
    const controller = host.__bookcaseConfigurator;
    controller.focusInspectorGroup("base_crown", { field: "crownStyle", focus: false });
    return controller.activeMobileCategoryId;
  });
  expect(fieldRoute).toBe("crown");
  await expect(page.locator('[data-mobile-category-panel="crown"]')).toBeVisible();

  const backSelection = await builder.evaluate((host) => {
    const controller = host.__bookcaseConfigurator;
    const back = controller.layout.components.find((component) => component.role === "back_panel");
    return {
      accepted: back ? controller.handleModelSelection({ componentId: back.id, source: "api" }) : false,
      category: controller.activeMobileCategoryId
    };
  });
  expect(backSelection).toEqual({ accepted: true, category: "sections" });
  await expect(page.locator('[data-mobile-category="sections"]')).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('[data-mobile-category-panel="sections"] .workspace-readonly-property')).toContainText("Standard fitted back");
  expect(runtimeErrors).toEqual([]);
});
