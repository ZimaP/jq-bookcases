import { expect, test } from "@playwright/test";

const workspaceViewports = [
  { width: 2011, height: 1198 },
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 1180, height: 820 },
  { width: 1024, height: 900 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 360, height: 800 }
];

const expectedStages = ["space", "layout", "storage", "base_top", "finish", "hardware", "lighting", "preview"];
const desktopAuditViewports = [
  { width: 2011, height: 1198 },
  { width: 1440, height: 900 },
  { width: 1280, height: 720 }
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

test("reference workspace keeps one model, eight stages, fixed Properties, and responsive organizer regions", async ({ page }) => {
  const runtimeIssues = monitorRuntime(page);
  await page.setViewportSize(workspaceViewports[0]);
  const viewer = await openWorkspace(page);

  const stages = page.locator("[data-workspace-stage]");
  await expect(stages).toHaveCount(8);
  expect(await stages.evaluateAll((items) => items.map((item) => item.dataset.workspaceStage))).toEqual(expectedStages);
  expect(await stages.locator(".workspace-stage-state").allTextContents()).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"]);
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

test("desktop Properties uses one scroll surface and keeps every task readable", async ({ page }) => {
  const runtimeIssues = monitorRuntime(page);
  await page.setViewportSize({ width: 2011, height: 1198 });
  await openWorkspace(page);

  const auditCurrentTask = async (label) => {
    const audit = await page.locator("[data-properties-inspector]").evaluate(async (inspector) => {
      const content = inspector.querySelector("[data-inspector-content]");
      const panel = inspector.querySelector(".workspace-properties-panel");
      const panelBounds = panel?.getBoundingClientRect();
      const isRendered = (element) => {
        const style = getComputedStyle(element);
        const bounds = element.getBoundingClientRect();
        return !element.hidden
          && style.display !== "none"
          && style.visibility !== "hidden"
          && Number(style.opacity || 1) > 0
          && bounds.width > 1
          && bounds.height > 1;
      };
      const visibleControlProxies = panel
        ? Array.from(panel.querySelectorAll("button, select, summary, a, input:not([type='radio']):not([type='checkbox']), label"))
          .filter(isRendered)
        : [];
      const readableCards = panel
        ? Array.from(panel.querySelectorAll([
          ".style-choice > label",
          ".finish-choice > label",
          ".lighting-card > label",
          ".workspace-storage-preset > span",
          ".workspace-stage-empty"
        ].join(","))).filter(isRendered)
        : [];
      const prominentLabels = panel
        ? Array.from(panel.querySelectorAll([
          ".style-choice > label > span:last-child",
          ".finish-choice-name",
          ".finish-choice label > span:last-child",
          ".lighting-card label > span:last-child",
          ".workspace-storage-preset > span > strong",
          ".workspace-stage-empty h3"
        ].join(","))).filter(isRendered)
        : [];
      const readableIcons = panel
        ? Array.from(panel.querySelectorAll([
          ".style-diagram",
          ".finish-choice-dot",
          ".finish-choice-swatch",
          ".lighting-card-icon",
          ".workspace-storage-section-icon",
          ".workspace-stage-empty-icon"
        ].join(","))).filter(isRendered)
        : [];
      const nestedVerticalScrollers = panel
        ? Array.from(panel.querySelectorAll("*"))
          .filter((element) => {
            const overflowY = getComputedStyle(element).overflowY;
            return ["auto", "scroll"].includes(overflowY)
              && element.scrollHeight > element.clientHeight + 1;
          })
          .map((element) => element.className || element.tagName)
        : [];

      if (panel) {
        panel.scrollTop = panel.scrollHeight;
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      const lastControlBounds = visibleControlProxies.at(-1)?.getBoundingClientRect() || null;
      const cardHeights = readableCards.map((card) => card.getBoundingClientRect().height);
      const labelFonts = prominentLabels.map((element) => Number.parseFloat(getComputedStyle(element).fontSize));
      const iconSizes = readableIcons.map((icon) => {
        const bounds = icon.getBoundingClientRect();
        return Math.min(bounds.width, bounds.height);
      });
      return {
        pageHorizontalOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
        pageVerticalOverflow: Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
        inspectorClientHeight: inspector.clientHeight,
        inspectorScrollHeight: inspector.scrollHeight,
        contentClientHeight: content?.clientHeight || 0,
        contentScrollHeight: content?.scrollHeight || 0,
        panelClientHeight: panel?.clientHeight || 0,
        panelScrollHeight: panel?.scrollHeight || 0,
        panelScrollTop: panel?.scrollTop || 0,
        panelMaxScroll: panel ? Math.max(0, panel.scrollHeight - panel.clientHeight) : 0,
        panelTop: panelBounds?.top || 0,
        panelBottom: panelBounds?.bottom || 0,
        lastControlTop: lastControlBounds?.top || 0,
        lastControlBottom: lastControlBounds?.bottom || 0,
        inspectorOverflowY: getComputedStyle(inspector).overflowY,
        contentOverflowY: content ? getComputedStyle(content).overflowY : "",
        panelOverflowY: panel ? getComputedStyle(panel).overflowY : "",
        horizontalOverflow: Math.max(
          inspector.scrollWidth - inspector.clientWidth,
          (content?.scrollWidth || 0) - (content?.clientWidth || 0),
          (panel?.scrollWidth || 0) - (panel?.clientWidth || 0)
        ),
        nestedVerticalScrollers,
        readableCardCount: cardHeights.length,
        minReadableCardHeight: cardHeights.length ? Math.min(...cardHeights) : null,
        prominentLabelCount: labelFonts.length,
        minProminentLabelFont: labelFonts.length ? Math.min(...labelFonts) : null,
        readableIconCount: iconSizes.length,
        minReadableIconSize: iconSizes.length ? Math.min(...iconSizes) : null
      };
    });
    expect(audit.pageHorizontalOverflow, `${label} page horizontal overflow`).toBeLessThanOrEqual(1);
    expect(audit.pageVerticalOverflow, `${label} page vertical overflow`).toBeLessThanOrEqual(1);
    expect(audit.inspectorOverflowY, `${label} inspector overflow mode`).toBe("hidden");
    expect(audit.contentOverflowY, `${label} Properties content overflow mode`).toBe("hidden");
    expect(audit.panelOverflowY, `${label} task scroll surface`).toBe("auto");
    expect(audit.inspectorScrollHeight, `${label} inspector content`).toBeLessThanOrEqual(audit.inspectorClientHeight + 1);
    expect(audit.panelClientHeight, `${label} task viewport fits Properties content`).toBeLessThanOrEqual(audit.contentClientHeight + 1);
    expect(audit.horizontalOverflow, `${label} Properties horizontal overflow`).toBeLessThanOrEqual(1);
    expect(audit.nestedVerticalScrollers, `${label} nested vertical scroll surfaces`).toEqual([]);
    expect(audit.panelScrollTop, `${label} task can reach its scroll extent`).toBeGreaterThanOrEqual(audit.panelMaxScroll - 1);
    expect(audit.lastControlTop, `${label} final control starts inside Properties`).toBeGreaterThanOrEqual(audit.panelTop - 1);
    expect(audit.lastControlBottom, `${label} last control remains visible`).toBeLessThanOrEqual(audit.panelBottom + 1);
    if (audit.readableCardCount > 0) {
      expect(audit.minReadableCardHeight, `${label} choice card height`).toBeGreaterThanOrEqual(50);
    }
    if (audit.prominentLabelCount > 0) {
      expect(audit.minProminentLabelFont, `${label} prominent choice label size`).toBeGreaterThanOrEqual(9);
    }
    if (audit.readableIconCount > 0) {
      expect(audit.minReadableIconSize, `${label} choice icon size`).toBeGreaterThanOrEqual(24);
    }
  };

  for (const viewport of desktopAuditViewports) {
    await page.setViewportSize(viewport);
    await settleFrames(page);
    for (const stage of expectedStages) {
      await page.locator(`[data-workspace-stage="${stage}"]`).click();
      const inspector = page.locator("[data-properties-inspector]");
      await expect(inspector.locator("[data-inspector-tab]")).toHaveCount(0);
      await expect(inspector.locator(".workspace-properties-panel")).toHaveCount(1);
      await auditCurrentTask(`${viewport.width}x${viewport.height} ${stage}`);
    }

    await page.locator('[data-workspace-stage="storage"]').click();
    await page.locator('[data-section-organizer] [data-section-select="0"]').click();
    const drawerPreset = page.locator('[data-properties-inspector] .workspace-storage-preset:has([data-section-storage-preset="lower_drawers"])');
    await drawerPreset.click();
    await expect(page.locator('[data-properties-inspector] [data-section-storage-preset="lower_drawers"]')).toBeChecked();
    await expect(page.locator('[data-properties-inspector] .workspace-storage-drawers')).toHaveCount(1);
    await expect(page.locator('[data-properties-inspector] .workspace-storage-doors')).toHaveCount(0);
    await auditCurrentTask(`${viewport.width}x${viewport.height} storage/drawers-configured`);

    await page.locator('[data-workspace-stage="layout"]').click();
    await page.locator('[data-section-organizer] [data-section-select="0"]').click();
    await expect(page.locator("[data-properties-inspector] [data-inspector-tab]")).toHaveCount(0);
    await expect(page.locator("[data-properties-inspector] .workspace-properties-panel")).toHaveCount(1);
    await auditCurrentTask(`${viewport.width}x${viewport.height} layout/selected`);

    await page.locator('[data-workspace-stage="storage"]').click();
    await page.locator('[data-section-organizer] [data-section-select="0"]').click();
    await expect(page.locator("[data-properties-inspector] [data-inspector-tab]")).toHaveCount(0);
    await expect(page.locator("[data-properties-inspector] .workspace-properties-panel")).toHaveCount(1);
    await auditCurrentTask(`${viewport.width}x${viewport.height} storage/selected`);
  }

  expect(runtimeIssues).toEqual([]);
});

test("Storage choices stay readable and the final controls remain reachable", async ({ page }) => {
  const runtimeIssues = monitorRuntime(page);
  await page.setViewportSize({ width: 2011, height: 1198 });
  await openWorkspace(page);

  for (const viewport of desktopAuditViewports) {
    await page.setViewportSize(viewport);
    await settleFrames(page);
    await page.locator('[data-workspace-stage="storage"]').click();

    const auditStorageState = async (label, expectedState) => {
      const audit = await page.locator("[data-properties-inspector]").evaluate(async (inspector) => {
        const panel = inspector.querySelector(".workspace-properties-panel");
        const console = inspector.querySelector(".workspace-storage-console");
        const presetCards = Array.from(inspector.querySelectorAll(".workspace-storage-preset > span"));
        const presetLabels = Array.from(inspector.querySelectorAll(".workspace-storage-preset > span > strong"));
        const selects = Array.from(inspector.querySelectorAll("[data-section-storage-field][type='number'], .workspace-storage-select select"));
        const stepperButtons = Array.from(inspector.querySelectorAll("[data-section-storage-step]"));
        const panelBounds = panel.getBoundingClientRect();
        const consoleBounds = console.getBoundingClientRect();
        const cardBounds = presetCards.map((card) => card.getBoundingClientRect());
        const controlBounds = [...selects, ...stepperButtons].map((control) => control.getBoundingClientRect());
        const checkedPreset = inspector.querySelector("[data-section-storage-preset]:checked");
        panel.scrollTop = panel.scrollHeight;
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const finalControl = inspector.querySelector(".workspace-storage-global [data-field='shelfThickness'][type='range']");
        const finalControlBounds = finalControl?.getBoundingClientRect();
        return {
          pageHorizontalOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
          pageVerticalOverflow: Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
          presetCount: presetCards.length,
          checkedPreset: checkedPreset?.value || "",
          doorSections: inspector.querySelectorAll(".workspace-storage-doors").length,
          drawerSections: inspector.querySelectorAll(".workspace-storage-drawers").length,
          lowerHeightSections: inspector.querySelectorAll('.workspace-storage-fronts [data-section-storage-control="lowerStorageHeight"]').length,
          shelfSteppers: inspector.querySelectorAll('[data-section-storage-control="shelfCount"]').length,
          drawerSteppers: inspector.querySelectorAll('[data-section-storage-control="drawerCount"]').length,
          lowerHeightSteppers: inspector.querySelectorAll('[data-section-storage-control="lowerStorageHeight"]').length,
          selectCount: inspector.querySelectorAll(".workspace-storage-select select").length,
          labelsFit: presetLabels.every((label) => (
            label.scrollWidth <= label.clientWidth + 1
            && label.scrollHeight <= label.clientHeight + 1
          )),
          minCardHeight: Math.min(...cardBounds.map((bounds) => bounds.height)),
          controlsHaveArea: controlBounds.every((bounds) => bounds.width > 0 && bounds.height >= 36),
          cardsContained: cardBounds.every((bounds) => (
            bounds.left >= panelBounds.left - 1
            && bounds.right <= panelBounds.right + 1
          )),
          consoleContained: consoleBounds.left >= panelBounds.left - 1
            && consoleBounds.right <= panelBounds.right + 1,
          horizontalOverflow: Math.max(
            inspector.scrollWidth - inspector.clientWidth,
            panel.scrollWidth - panel.clientWidth
          ),
          panelOverflowY: getComputedStyle(panel).overflowY,
          panelMaxScroll: Math.max(0, panel.scrollHeight - panel.clientHeight),
          panelScrollTop: panel.scrollTop,
          finalControlVisible: Boolean(finalControlBounds)
            && finalControlBounds.top >= panelBounds.top - 1
            && finalControlBounds.bottom <= panelBounds.bottom + 1
        };
      });

      expect(audit.pageHorizontalOverflow, `${label} page horizontal overflow`).toBeLessThanOrEqual(1);
      expect(audit.pageVerticalOverflow, `${label} page vertical overflow`).toBeLessThanOrEqual(1);
      expect(audit.presetCount, `${label} storage presets`).toBe(5);
      expect(audit.checkedPreset, `${label} active preset`).toBe(expectedState.preset);
      expect(audit.doorSections, `${label} conditional door controls`).toBe(expectedState.doors);
      expect(audit.drawerSections, `${label} conditional drawer controls`).toBe(expectedState.drawers);
      expect(audit.lowerHeightSections, `${label} lower-height controls`).toBe(1);
      expect(audit.shelfSteppers, `${label} shelf stepper`).toBe(1);
      expect(audit.drawerSteppers, `${label} drawer stepper`).toBe(expectedState.drawers);
      expect(audit.lowerHeightSteppers, `${label} lower-height stepper`).toBe(1);
      expect(audit.selectCount, `${label} section-specific selects`).toBe(1);
      expect(audit.labelsFit, `${label} preset labels`).toBe(true);
      expect(audit.minCardHeight, `${label} preset card height`).toBeGreaterThanOrEqual(50);
      expect(audit.controlsHaveArea, `${label} section controls have readable targets`).toBe(true);
      expect(audit.cardsContained, `${label} horizontal card containment`).toBe(true);
      expect(audit.consoleContained, `${label} horizontal console containment`).toBe(true);
      expect(audit.horizontalOverflow, `${label} horizontal overflow`).toBeLessThanOrEqual(1);
      expect(audit.panelOverflowY, `${label} Properties scroll surface`).toBe("auto");
      expect(audit.panelScrollTop, `${label} scroll extent`).toBeGreaterThanOrEqual(audit.panelMaxScroll - 1);
      expect(audit.finalControlVisible, `${label} final shelf-thickness control reachable`).toBe(true);
    };

    const doorPreset = page.locator('[data-properties-inspector] .workspace-storage-preset:has([data-section-storage-preset="lower_doors"])');
    await doorPreset.click();
    await expect(page.locator('[data-properties-inspector] [data-section-storage-preset="lower_doors"]')).toBeChecked();
    await auditStorageState(`${viewport.width}x${viewport.height} lower doors`, { preset: "lower_doors", doors: 1, drawers: 0 });

    const drawerPreset = page.locator('[data-properties-inspector] .workspace-storage-preset:has([data-section-storage-preset="lower_drawers"])');
    await drawerPreset.click();
    await expect(page.locator('[data-properties-inspector] [data-section-storage-preset="lower_drawers"]')).toBeChecked();
    await auditStorageState(`${viewport.width}x${viewport.height} lower drawers`, { preset: "lower_drawers", doors: 0, drawers: 1 });
  }

  expect(runtimeIssues).toEqual([]);
});

test("six section cards remain readable and reachable in the desktop organizer", async ({ page }) => {
  const runtimeIssues = monitorRuntime(page);
  for (const viewport of desktopAuditViewports) {
    await page.setViewportSize(viewport);
    await openWorkspace(page);
    await addSection(page);
    await addSection(page);
    await expect(page.locator("[data-section-organizer] [data-section-card]")).toHaveCount(6);
    await expect(page.locator("[data-section-organizer] [data-section-add]")).toBeDisabled();

    const audit = await page.locator(".workspace-section-cards").evaluate(async (cards) => {
      const bounds = cards.getBoundingClientRect();
      const organizerBounds = cards.closest("[data-section-organizer]").getBoundingClientRect();
      const items = Array.from(cards.querySelectorAll(".workspace-add-section, .workspace-section-card"));
      const sectionCards = Array.from(cards.querySelectorAll(".workspace-section-card"));
      const labels = Array.from(cards.querySelectorAll(".workspace-section-card-main strong"));
      const initialFirstBounds = items[0].getBoundingClientRect();
      const sectionWidths = sectionCards.map((card) => card.getBoundingClientRect().width);
      const labelFonts = labels.map((label) => Number.parseFloat(getComputedStyle(label).fontSize));
      const rowCount = new Set(items.map((item) => Math.round(item.getBoundingClientRect().top))).size;
      const itemContentBounds = items.map((item) => {
        const itemBounds = item.getBoundingClientRect();
        return {
          left: itemBounds.left - bounds.left + cards.scrollLeft,
          right: itemBounds.right - bounds.left + cards.scrollLeft
        };
      });
      cards.scrollLeft = cards.scrollWidth;
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const finalItemBounds = items.at(-1).getBoundingClientRect();
      return {
        pageHorizontalOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
        pageVerticalOverflow: Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
        horizontalOverflow: Math.max(0, cards.scrollWidth - cards.clientWidth),
        verticalOverflow: Math.max(0, cards.scrollHeight - cards.clientHeight),
        overflowX: getComputedStyle(cards).overflowX,
        overflowY: getComputedStyle(cards).overflowY,
        rowCount,
        organizerBounded: organizerBounds.left >= -1
          && organizerBounds.right <= window.innerWidth + 1
          && bounds.left >= organizerBounds.left - 1
          && bounds.right <= organizerBounds.right + 1,
        itemsInsideScrollContent: itemContentBounds.every((itemBounds) => (
          itemBounds.left >= -1 && itemBounds.right <= cards.scrollWidth + 1
        )),
        firstItemInitiallyVisible: initialFirstBounds.left >= bounds.left - 1
          && initialFirstBounds.right <= bounds.right + 1,
        finalItemReachable: finalItemBounds.left >= bounds.left - 1
          && finalItemBounds.right <= bounds.right + 1,
        scrollAtEnd: cards.scrollLeft >= cards.scrollWidth - cards.clientWidth - 1,
        minSectionWidth: Math.min(...sectionWidths),
        maxSectionWidth: Math.max(...sectionWidths),
        minLabelFont: Math.min(...labelFonts),
        labelsReadable: labels.every((label) => label.clientWidth > 0 && label.scrollWidth <= label.clientWidth + 1)
      };
    });
    expect(audit.pageHorizontalOverflow, `${viewport.width}x${viewport.height} page horizontal overflow`).toBeLessThanOrEqual(1);
    expect(audit.pageVerticalOverflow, `${viewport.width}x${viewport.height} page vertical overflow`).toBeLessThanOrEqual(1);
    expect(audit.overflowX, `${viewport.width}x${viewport.height} organizer horizontal policy`).toBe("auto");
    expect(audit.overflowY, `${viewport.width}x${viewport.height} organizer vertical policy`).toBe("hidden");
    expect(audit.verticalOverflow, `${viewport.width}x${viewport.height} organizer vertical overflow`).toBeLessThanOrEqual(1);
    expect(audit.rowCount, `${viewport.width}x${viewport.height} organizer row count`).toBe(1);
    expect(audit.organizerBounded, `${viewport.width}x${viewport.height} organizer bounds`).toBe(true);
    expect(audit.itemsInsideScrollContent, `${viewport.width}x${viewport.height} cards inside scroll content`).toBe(true);
    expect(audit.firstItemInitiallyVisible, `${viewport.width}x${viewport.height} Add Section reachable`).toBe(true);
    expect(audit.finalItemReachable, `${viewport.width}x${viewport.height} final section reachable`).toBe(true);
    expect(audit.scrollAtEnd, `${viewport.width}x${viewport.height} organizer reaches its end`).toBe(true);
    expect(audit.minSectionWidth, `${viewport.width}x${viewport.height} minimum section card width`).toBeGreaterThanOrEqual(84);
    expect(audit.maxSectionWidth, `${viewport.width}x${viewport.height} bounded section card width`).toBeLessThanOrEqual(240);
    expect(audit.minLabelFont, `${viewport.width}x${viewport.height} section label size`).toBeGreaterThanOrEqual(9);
    expect(audit.labelsReadable, `${viewport.width}x${viewport.height} section labels`).toBe(true);
  }
  expect(runtimeIssues).toEqual([]);
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
