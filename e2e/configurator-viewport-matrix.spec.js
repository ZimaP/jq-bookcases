import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const requiredViewports = [
  { name: "desktop-2048x1152", width: 2048, height: 1152 },
  { name: "desktop-1920x1080", width: 1920, height: 1080 },
  { name: "desktop-1536x1024", width: 1536, height: 1024 },
  { name: "desktop-1440x900", width: 1440, height: 900 },
  { name: "desktop-1366x768", width: 1366, height: 768 },
  { name: "desktop-1280x800", width: 1280, height: 800 },
  { name: "landscape-1366x1024", width: 1366, height: 1024 },
  { name: "landscape-1180x820", width: 1180, height: 820 },
  { name: "landscape-1024x768", width: 1024, height: 768 },
  { name: "portrait-1024x1366", width: 1024, height: 1366 },
  { name: "portrait-820x1180", width: 820, height: 1180 },
  { name: "portrait-768x1024", width: 768, height: 1024 }
];

const stages = ["space", "layout", "storage", "base_top", "finish", "hardware", "lighting", "preview"];
const overviewProfiles = Object.freeze({
  space: "overview",
  layout: "overview",
  storage: "overview",
  base_top: "overview",
  finish: "finish",
  hardware: "overview",
  lighting: "lighting",
  preview: "preview"
});

test.describe.configure({ mode: "serial", timeout: 180_000 });

function monitorRuntime(page) {
  const issues = [];
  page.on("pageerror", (error) => issues.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    const readbackWarning = message.type() === "warning"
      && /GL Driver Message .*GPU stall due to ReadPixels/.test(message.text());
    if (!readbackWarning && message.type() === "error") {
      issues.push(`console error: ${message.text()}`);
    }
  });
  page.on("requestfailed", (request) => {
    issues.push(`requestfailed: ${request.method()} ${request.url()} (${request.failure()?.errorText || "unknown"})`);
  });
  return issues;
}

async function settleWorkspace(page, frames = 3) {
  await page.evaluate(async (frameCount) => {
    await document.fonts?.ready;
    for (let index = 0; index < frameCount; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }, frames);
}

async function waitForCamera(page) {
  const workspace = page.locator("[data-configurator-workspace]");
  await expect.poll(async () => {
    const state = await workspace.getAttribute("data-camera-state");
    const transitioning = await page.locator("[data-bookcase-builder]").evaluate((host) => (
      Boolean(host.__bookcaseConfigurator?.viewer?.getDiagnostics?.().cameraTransitionActive)
    ));
    return state !== "transitioning" && transitioning === false;
  }).toBe(true);
  await settleWorkspace(page);
}

async function openWorkspace(page) {
  await page.goto("/configurator.html?preset=lower-cabinets", { waitUntil: "networkidle" });
  const viewer = page.locator("[data-3d-viewer]");
  await expect(viewer).toHaveAttribute("data-render-valid", "true", { timeout: 20_000 });
  await expect(viewer.locator("canvas")).toHaveCount(1);
  await expect(page.locator("[data-configurator-workspace]")).toHaveAttribute("data-camera-state", /overview|transitioning/);
  await waitForCamera(page);
  return viewer;
}

function formatViolations(violations) {
  return violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    nodes: violation.nodes.map((node) => node.target)
  }));
}

async function setStage(page, stage) {
  const button = page.locator(`[data-workspace-stage="${stage}"]`);
  await button.click();
  await expect(button).toHaveAttribute("aria-current", "location");
  await expect(page.locator("[data-properties-inspector] .workspace-properties-panel")).toHaveCount(1);
  await waitForCamera(page);
}

async function setSectionCount(page, count) {
  const cards = page.locator("[data-section-organizer] [data-section-card]");
  let current = await cards.count();
  while (current > count) {
    const targetIndex = current - 1;
    const select = page.locator(`[data-section-organizer] [data-section-select="${targetIndex}"]`);
    if (await select.getAttribute("aria-pressed") !== "true") await select.click();
    const remove = page.locator(`[data-section-organizer] [data-section-delete="${targetIndex}"]:not([disabled])`);
    await expect(remove).toBeVisible();
    await remove.click();
    current -= 1;
    await expect(cards).toHaveCount(current);
  }
  while (current < count) {
    const add = page.locator("[data-section-organizer] [data-section-add]");
    await expect(add).toBeEnabled();
    await add.click();
    current += 1;
    await expect(cards).toHaveCount(current);
  }
  await settleWorkspace(page);
}

async function readFullModelFraming(page) {
  return page.locator("[data-bookcase-builder]").evaluate((host) => {
    const viewer = host.__bookcaseConfigurator.viewer;
    viewer.model.updateMatrixWorld(true);
    viewer.camera.updateMatrixWorld(true);
    const root = viewer.root.getBoundingClientRect();
    const projected = [];
    viewer.model.traverse((object) => {
      if (!object.isMesh || !object.geometry || object.userData?.nonPhysicalHelper) return;
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
      const box = object.geometry.boundingBox;
      for (const x of [box.min.x, box.max.x]) {
        for (const y of [box.min.y, box.max.y]) {
          for (const z of [box.min.z, box.max.z]) {
            const point = viewer.camera.position.clone().set(x, y, z).applyMatrix4(object.matrixWorld).project(viewer.camera);
            projected.push({
              x: (point.x + 1) * root.width / 2,
              y: (1 - point.y) * root.height / 2,
              depth: point.z
            });
          }
        }
      }
    });
    const safe = viewer.getSafeViewport().localBounds;
    return {
      safe,
      bounds: {
        left: Math.min(...projected.map((point) => point.x)),
        right: Math.max(...projected.map((point) => point.x)),
        top: Math.min(...projected.map((point) => point.y)),
        bottom: Math.max(...projected.map((point) => point.y)),
        near: Math.min(...projected.map((point) => point.depth)),
        far: Math.max(...projected.map((point) => point.depth))
      }
    };
  });
}

async function expectFullModelFit(page, label) {
  const { safe, bounds } = await readFullModelFraming(page);
  expect(bounds.left, `${label} model left`).toBeGreaterThanOrEqual(safe.left - 1.5);
  expect(bounds.right, `${label} model right`).toBeLessThanOrEqual(safe.right + 1.5);
  expect(bounds.top, `${label} model top`).toBeGreaterThanOrEqual(safe.top - 1.5);
  expect(bounds.bottom, `${label} model bottom`).toBeLessThanOrEqual(safe.bottom + 1.5);
  expect(bounds.near, `${label} near clipping plane`).toBeGreaterThanOrEqual(-1);
  expect(bounds.far, `${label} far clipping plane`).toBeLessThanOrEqual(1);
}

async function auditWorkspaceGeometry(page, label, options = {}) {
  const audit = await page.evaluate(() => {
    const rectangle = (element) => {
      if (!element) return null;
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
    const bySelector = (selector) => document.querySelector(selector);
    const rendered = (element) => {
      const style = getComputedStyle(element);
      const bounds = element.getBoundingClientRect();
      return !element.hidden
        && style.display !== "none"
        && style.visibility !== "hidden"
        && Number(style.opacity || 1) > 0.05
        && bounds.width > 1
        && bounds.height > 1;
    };
    const intersectionArea = (first, second) => {
      if (!first || !second) return 0;
      return Math.max(0, Math.min(first.right, second.right) - Math.max(first.left, second.left))
        * Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top));
    };
    const contains = (outer, inner, tolerance = 1) => Boolean(outer && inner)
      && inner.left >= outer.left - tolerance
      && inner.right <= outer.right + tolerance
      && inner.top >= outer.top - tolerance
      && inner.bottom <= outer.bottom + tolerance;

    const workspace = bySelector("[data-configurator-workspace]");
    const inspector = bySelector("[data-properties-inspector]");
    const content = bySelector("[data-inspector-content]");
    const panel = bySelector("[data-properties-inspector] .workspace-properties-panel");
    const toolbar = bySelector("[data-model-toolbar]");
    const organizer = bySelector("[data-section-organizer]");
    const cards = bySelector(".workspace-section-cards");
    const footer = bySelector("[data-estimate-bar]");
    const viewer = bySelector("[data-3d-viewer]");
    const elements = {
      workspace: rectangle(workspace),
      rail: rectangle(bySelector("[data-workspace-stages]")),
      model: rectangle(bySelector("[data-model-workspace]")),
      inspector: rectangle(inspector),
      organizer: rectangle(organizer),
      cards: rectangle(cards),
      widthCard: rectangle(bySelector("[data-total-width-card]")),
      footer: rectangle(footer),
      toolbar: rectangle(toolbar),
      viewer: rectangle(viewer)
    };

    const controlSelectors = [
      "button", "input", "select", "textarea", "summary", "a[href]",
      ".style-choice label", ".finish-choice label", ".hardware-type-choice",
      ".hardware-finish-choice", ".lighting-card label", ".workspace-storage-preset"
    ].join(",");
    const controls = inspector
      ? [...new Set(inspector.querySelectorAll(controlSelectors))].filter(rendered)
      : [];
    const criticalLabels = inspector
      ? [...inspector.querySelectorAll([
        ".style-choice label > span:last-child", ".finish-choice label > span:last-child",
        ".hardware-type-choice strong", ".hardware-finish-choice strong",
        ".lighting-card strong", ".workspace-storage-preset strong"
      ].join(","))].filter(rendered)
      : [];
    const toolbarButtons = toolbar ? [...toolbar.querySelectorAll("button")].filter(rendered) : [];
    const sectionItems = cards ? [...cards.querySelectorAll(".workspace-add-section, .workspace-section-card")].filter(rendered) : [];
    const sectionActions = cards ? [...cards.querySelectorAll("button")].filter(rendered) : [];
    const sectionContents = cards ? [...cards.querySelectorAll(
      ".workspace-section-thumbnail, .workspace-section-card-main > span:not(.workspace-section-thumbnail)"
    )].filter(rendered) : [];
    const dimensionLabels = [...document.querySelectorAll("[data-section-overlay] .dimension-label")].filter(rendered);
    const toolbarBounds = elements.toolbar;
    const organizerBounds = elements.organizer;
    const safe = viewer && hostSafeViewport(viewer);

    function hostSafeViewport(viewerElement) {
      const host = viewerElement.closest("[data-bookcase-builder]");
      const viewport = host?.__bookcaseConfigurator?.viewer?.getSafeViewport?.();
      return viewport?.clientBounds || null;
    }

    const pairOverlaps = (items) => {
      const pairs = [];
      items.forEach((item, index) => {
        const first = rectangle(item);
        items.slice(index + 1).forEach((candidate, offset) => {
          if (intersectionArea(first, rectangle(candidate)) > 1) pairs.push([index, index + offset + 1]);
        });
      });
      return pairs;
    };

    const scrolling = document.scrollingElement;
    return {
      elements,
      documentOverflow: {
        x: Math.max(0, scrolling.scrollWidth - scrolling.clientWidth),
        y: Math.max(0, scrolling.scrollHeight - scrolling.clientHeight)
      },
      surfaces: {
        inspectorX: Math.max(0, inspector.scrollWidth - inspector.clientWidth),
        inspectorY: Math.max(0, inspector.scrollHeight - inspector.clientHeight),
        contentX: Math.max(0, content.scrollWidth - content.clientWidth),
        contentY: Math.max(0, content.scrollHeight - content.clientHeight),
        panelX: Math.max(0, panel.scrollWidth - panel.clientWidth),
        panelY: Math.max(0, panel.scrollHeight - panel.clientHeight),
        toolbarX: Math.max(0, toolbar.scrollWidth - toolbar.clientWidth),
        toolbarY: Math.max(0, toolbar.scrollHeight - toolbar.clientHeight),
        organizerX: Math.max(0, organizer.scrollWidth - organizer.clientWidth),
        organizerY: Math.max(0, organizer.scrollHeight - organizer.clientHeight),
        cardsX: Math.max(0, cards.scrollWidth - cards.clientWidth),
        cardsY: Math.max(0, cards.scrollHeight - cards.clientHeight)
      },
      controlCount: controls.length,
      controlsContained: controls.every((control) => contains(elements.inspector, rectangle(control))),
      criticalLabelsUnclipped: criticalLabels.every((label) => (
        label.scrollWidth <= label.clientWidth + 1 && label.scrollHeight <= label.clientHeight + 1
      )),
      toolbarButtonsContained: toolbarButtons.every((button) => contains(elements.toolbar, rectangle(button))),
      toolbarButtonOverlaps: pairOverlaps(toolbarButtons),
      sectionCount: cards?.querySelectorAll("[data-section-card]").length || 0,
      sectionItemsContained: sectionItems.every((item) => contains(elements.cards, rectangle(item))),
      sectionActionsContained: sectionActions.every((action) => contains(elements.cards, rectangle(action))),
      sectionContentsContained: sectionContents.every((item) => contains(rectangle(item.closest(".workspace-section-card")), rectangle(item))),
      sectionContentsUnclipped: sectionContents.every((item) => (
        item.scrollWidth <= item.clientWidth + 1 && item.scrollHeight <= item.clientHeight + 1
      )),
      footerOrganizerOverlap: intersectionArea(elements.footer, elements.organizer),
      footerPropertiesOverlap: intersectionArea(elements.footer, elements.inspector),
      modelPropertiesOverlap: intersectionArea(elements.model, elements.inspector),
      labels: dimensionLabels.map((label) => ({
        className: label.closest("[data-overlay-section], .overall-dimension, .overall-height-dimension, .overall-depth-dimension")?.className || "",
        bounds: rectangle(label),
        toolbarOverlap: intersectionArea(rectangle(label), toolbarBounds),
        organizerOverlap: intersectionArea(rectangle(label), organizerBounds),
        insideSafeViewport: contains(safe, rectangle(label), 1.5)
      })),
      labelCollision: bySelector("[data-section-overlay]")?.dataset.labelCollision || "",
      regionsInsideWorkspace: Object.entries(elements)
        .filter(([name]) => !["workspace"].includes(name))
        .every(([, bounds]) => contains(elements.workspace, bounds)),
      workspaceInsideViewport: elements.workspace.left >= -1
        && elements.workspace.right <= innerWidth + 1
        && elements.workspace.top >= -1
        && elements.workspace.bottom <= innerHeight + 1
    };
  });

  expect(audit.documentOverflow.x, `${label} document horizontal overflow`).toBeLessThanOrEqual(1);
  expect(audit.documentOverflow.y, `${label} document vertical overflow`).toBeLessThanOrEqual(1);
  for (const [surface, overflow] of Object.entries(audit.surfaces)) {
    expect(overflow, `${label} ${surface} overflow`).toBeLessThanOrEqual(1);
  }
  expect(audit.controlCount, `${label} visible Properties controls`).toBeGreaterThan(0);
  expect(audit.controlsContained, `${label} Properties control containment`).toBe(true);
  expect(audit.criticalLabelsUnclipped, `${label} critical option labels`).toBe(true);
  expect(audit.toolbarButtonsContained, `${label} toolbar button containment`).toBe(true);
  expect(audit.toolbarButtonOverlaps, `${label} toolbar button collisions`).toEqual([]);
  expect(audit.sectionItemsContained, `${label} section item containment`).toBe(true);
  expect(audit.sectionActionsContained, `${label} section action containment`).toBe(true);
  expect(audit.sectionContentsContained, `${label} section content containment`).toBe(true);
  expect(audit.sectionContentsUnclipped, `${label} section content clipping`).toBe(true);
  expect(audit.footerOrganizerOverlap, `${label} footer/organizer overlap`).toBeLessThanOrEqual(1);
  expect(audit.footerPropertiesOverlap, `${label} footer/Properties overlap`).toBeLessThanOrEqual(1);
  expect(audit.modelPropertiesOverlap, `${label} model/Properties overlap`).toBeLessThanOrEqual(1);
  expect(audit.regionsInsideWorkspace, `${label} workspace region containment`).toBe(true);
  expect(audit.workspaceInsideViewport, `${label} workspace viewport containment`).toBe(true);

  if (options.annotations !== false) {
    expect(audit.labels.length, `${label} visible dimension labels`).toBeGreaterThan(0);
    expect(audit.labelCollision, `${label} section label collision state`).toBe("false");
    for (const [index, annotation] of audit.labels.entries()) {
      expect(annotation.toolbarOverlap, `${label} annotation ${index + 1}/toolbar overlap`).toBeLessThanOrEqual(1);
      expect(annotation.organizerOverlap, `${label} annotation ${index + 1}/organizer overlap`).toBeLessThanOrEqual(1);
      expect(annotation.insideSafeViewport, `${label} annotation ${index + 1} safe viewport`).toBe(true);
    }
  }
  return audit;
}

for (const viewport of requiredViewports) {
  test(`${viewport.name} keeps every default task and 1–6 sections in one viewport`, async ({ page }) => {
    const runtimeIssues = monitorRuntime(page);
    await page.setViewportSize(viewport);
    await openWorkspace(page);

    await expect(page.locator("[data-workspace-stage]")).toHaveCount(8);
    await expect(page.locator("[data-section-organizer] [data-section-card]")).toHaveCount(4);

    for (const stage of stages) {
      await setStage(page, stage);
      const workspace = page.locator("[data-configurator-workspace]");
      await expect(workspace, `${viewport.name} ${stage} state`).toHaveAttribute("data-camera-state", "overview");
      await expect(workspace, `${viewport.name} ${stage} profile`).toHaveAttribute("data-camera-profile", overviewProfiles[stage]);
      await expect(workspace, `${viewport.name} ${stage} source stage`).toHaveAttribute("data-camera-source-stage", stage);
      await expect(workspace, `${viewport.name} ${stage} source section`).toHaveAttribute("data-camera-source-section", "");
      await auditWorkspaceGeometry(page, `${viewport.name} ${stage}`);
      await expectFullModelFit(page, `${viewport.name} ${stage}`);
    }

    await setStage(page, "storage");
    for (const preset of ["lower_doors", "lower_drawers"]) {
      const choice = page.locator(`[data-properties-inspector] [data-section-storage-preset="${preset}"]`);
      await choice.check();
      await expect(choice).toBeChecked();
      await settleWorkspace(page);
      await auditWorkspaceGeometry(page, `${viewport.name} storage ${preset}`);
    }

    await setStage(page, "layout");
    await setSectionCount(page, 1);
    let audit = await auditWorkspaceGeometry(page, `${viewport.name} one section`);
    expect(audit.sectionCount).toBe(1);
    await expectFullModelFit(page, `${viewport.name} one section`);

    await setSectionCount(page, 6);
    audit = await auditWorkspaceGeometry(page, `${viewport.name} six sections`);
    expect(audit.sectionCount).toBe(6);
    await expectFullModelFit(page, `${viewport.name} six sections`);

    const dimensions = page.locator("[data-toggle-dimensions]");
    await dimensions.click();
    await expect(dimensions).toHaveAttribute("aria-pressed", "false");
    await auditWorkspaceGeometry(page, `${viewport.name} dimensions off`, { annotations: false });
    await dimensions.click();
    await expect(dimensions).toHaveAttribute("aria-pressed", "true");
    await settleWorkspace(page);
    await auditWorkspaceGeometry(page, `${viewport.name} dimensions on`);

    const wall = page.locator("[data-toggle-wall]");
    await wall.click();
    await expect(wall).toHaveAttribute("aria-pressed", "false");
    await auditWorkspaceGeometry(page, `${viewport.name} wall off`);
    await wall.click();
    await expect(wall).toHaveAttribute("aria-pressed", "true");

    expect(runtimeIssues, `${viewport.name} runtime issues`).toEqual([]);
  });
}

test("accepted compact header navigation stays legible", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await openWorkspace(page);

  await expect(page.locator("#primary-navigation")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(page.locator("#primary-navigation .nav-link").first()).toHaveCSS("color", "rgb(36, 37, 34)");

  await page.setViewportSize({ width: 820, height: 1180 });
  const toggle = page.locator(".nav-toggle");
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveCSS("color", "rgb(36, 37, 34)");
  await expect(toggle).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#primary-navigation")).toHaveCSS("background-color", "rgb(33, 29, 24)");
  await expect(page.locator("#primary-navigation .nav-link").first()).toHaveCSS("color", "rgb(247, 243, 237)");
  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
});

test("compact Properties labels and Benjamin Moore results remain readable", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await openWorkspace(page);

  await setStage(page, "layout");
  const layoutActionSizes = await page.locator("[data-properties-inspector] .workspace-section-actions button").evaluateAll((buttons) => (
    buttons.map((button) => Number.parseFloat(getComputedStyle(button).fontSize))
  ));
  expect(Math.min(...layoutActionSizes)).toBeGreaterThanOrEqual(10);
  await auditWorkspaceGeometry(page, "readable Layout labels");

  await setStage(page, "base_top");
  const baseLabelSizes = await page.locator("[data-properties-inspector] .style-choice > label > span:last-child").evaluateAll((labels) => (
    labels.filter((label) => label.getClientRects().length).map((label) => Number.parseFloat(getComputedStyle(label).fontSize))
  ));
  expect(Math.min(...baseLabelSizes)).toBeGreaterThanOrEqual(10);
  await auditWorkspaceGeometry(page, "readable Base & Top labels");

  await setStage(page, "finish");
  await page.locator("[data-toggle-color-search]:not([data-color-search-close])").click();
  await page.locator("[data-bm-query]").fill("whit");
  const results = page.locator("[data-bm-results] .bm-result-card");
  await expect(results).toHaveCount(4);
  const resultTypography = await results.evaluateAll((cards) => cards.map((card) => ({
    name: Number.parseFloat(getComputedStyle(card.querySelector("strong")).fontSize),
    detail: Number.parseFloat(getComputedStyle(card.querySelector("small")).fontSize),
    action: Number.parseFloat(getComputedStyle(card.querySelector("button")).fontSize),
    nameClipped: card.querySelector("strong").scrollWidth > card.querySelector("strong").clientWidth + 1
      || card.querySelector("strong").scrollHeight > card.querySelector("strong").clientHeight + 1
  })));
  for (const typography of resultTypography) {
    expect(typography.name).toBeGreaterThanOrEqual(11);
    expect(typography.detail).toBeGreaterThanOrEqual(10);
    expect(typography.action).toBeGreaterThanOrEqual(10);
    expect(typography.nameClipped).toBe(false);
  }
  await auditWorkspaceGeometry(page, "readable Benjamin Moore results");
});

test("smart camera invalidates stale base, section, and hardware detail intents", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 900 });
  const runtimeIssues = monitorRuntime(page);
  await openWorkspace(page);
  const workspace = page.locator("[data-configurator-workspace]");

  await setStage(page, "base_top");
  const base = page.locator('[data-properties-inspector] [data-field="baseStyle"][value="plinth"]');
  await base.locator("xpath=ancestor::*[contains(@class, 'style-choice')][1]/label").click();
  await expect(base).toBeChecked();
  await waitForCamera(page);
  await expect(workspace).toHaveAttribute("data-camera-state", "detail-focus");
  await expect(workspace).toHaveAttribute("data-camera-profile", "base");
  await expect(workspace).toHaveAttribute("data-camera-source-stage", "base_top");

  await setStage(page, "layout");
  await expect(workspace).toHaveAttribute("data-camera-state", "overview");
  await expect(workspace).toHaveAttribute("data-camera-profile", "overview");
  await expect(workspace).toHaveAttribute("data-camera-source-section", "");
  await expectFullModelFit(page, "Layout after base focus");

  await page.locator('[data-section-organizer] [data-section-select="1"]').click();
  await waitForCamera(page);
  await expect(workspace).toHaveAttribute("data-camera-state", "section-context");
  await expect(workspace).toHaveAttribute("data-camera-profile", "section");
  await expect(workspace).toHaveAttribute("data-camera-source-stage", "layout");
  await expect(workspace).toHaveAttribute("data-camera-source-section", "1");
  await expectFullModelFit(page, "Section context after section change");

  await setStage(page, "storage");
  const focusedDoor = await page.locator("[data-bookcase-builder]").evaluate((host) => {
    const controller = host.__bookcaseConfigurator;
    const section = controller.layout.components.find((component) => (
      component.role === "section" && Number(component.metadata?.index) === controller.selectedSectionIndex
    ));
    const door = controller.layout.components.find((component) => (
      component.role === "door" && component.metadata?.sectionId === section?.id
    ));
    return door && controller.viewer.selectDirectComponent(door.id, { source: "api" })
      ? { componentId: door.id, sectionIndex: controller.selectedSectionIndex }
      : null;
  });
  expect(focusedDoor).not.toBeNull();
  await waitForCamera(page);
  await expect(workspace).toHaveAttribute("data-camera-state", "detail-focus");
  await expect(workspace).toHaveAttribute("data-camera-profile", "doors");
  await expect(workspace).toHaveAttribute("data-camera-source-section", String(focusedDoor.sectionIndex));

  const nextSection = focusedDoor.sectionIndex === 0 ? 1 : 0;
  await page.locator(`[data-section-organizer] [data-section-select="${nextSection}"]`).click();
  await waitForCamera(page);
  await expect(workspace).toHaveAttribute("data-camera-state", "section-context");
  await expect(workspace).toHaveAttribute("data-camera-profile", "section");
  await expect(workspace).toHaveAttribute("data-camera-source-section", String(nextSection));
  await expectFullModelFit(page, "Section context after door detail");

  const removedDoor = await page.locator("[data-bookcase-builder]").evaluate((host) => {
    const controller = host.__bookcaseConfigurator;
    const section = controller.layout.components.find((component) => (
      component.role === "section" && Number(component.metadata?.index) === controller.selectedSectionIndex
    ));
    const door = controller.layout.components.find((component) => (
      component.role === "door" && component.metadata?.sectionId === section?.id
    ));
    return door && controller.viewer.selectDirectComponent(door.id, { source: "api" }) ? door.id : null;
  });
  expect(removedDoor).not.toBeNull();
  await waitForCamera(page);
  await expect(workspace).toHaveAttribute("data-camera-state", "detail-focus");
  await page.locator(`[data-section-organizer] [data-section-delete="${nextSection}"]`).click();
  await waitForCamera(page);
  await expect(workspace).toHaveAttribute("data-camera-state", /overview|section-context/);
  const staleTarget = await page.locator("[data-bookcase-builder]").evaluate((host, componentId) => {
    const controller = host.__bookcaseConfigurator;
    return {
      componentStillExists: controller.layout.components.some((component) => component.id === componentId),
      cameraTarget: controller.cameraIntentState?.targetComponentId || null
    };
  }, removedDoor);
  expect(staleTarget).toEqual({ componentStillExists: false, cameraTarget: null });
  await expectFullModelFit(page, "Model after deleting focused section");

  await setStage(page, "hardware");
  const selectedHandle = await page.locator("[data-bookcase-builder]").evaluate((host) => {
    const controller = host.__bookcaseConfigurator;
    const handle = controller.layout.components.find((component) => component.role === "handle");
    return handle ? controller.viewer.selectDirectComponent(handle.id, { source: "api" }) : false;
  });
  expect(selectedHandle).toBe(true);
  await waitForCamera(page);
  await expect(workspace).toHaveAttribute("data-camera-state", "detail-focus");
  await expect(workspace).toHaveAttribute("data-camera-profile", "hardware");
  await expect(workspace).toHaveAttribute("data-camera-source-stage", "hardware");

  await setStage(page, "space");
  await expect(workspace).toHaveAttribute("data-camera-state", "overview");
  await expect(workspace).toHaveAttribute("data-camera-profile", "overview");
  await expect(workspace).toHaveAttribute("data-camera-source-section", "");
  await expectFullModelFit(page, "Space after hardware focus");

  const viewer = page.locator("[data-3d-viewer]");
  const beforeReset = await page.locator("[data-bookcase-builder]").evaluate((host) => ({
    theta: host.__bookcaseConfigurator.viewer.theta,
    cancellations: host.__bookcaseConfigurator.viewer.cameraTransitionCancellationCount
  }));
  expect(Math.abs(beforeReset.theta)).toBeGreaterThan(0.05);
  await viewer.focus();
  await viewer.press("0");
  await waitForCamera(page);
  await expect(workspace).toHaveAttribute("data-camera-state", "user-controlled");
  const afterReset = await page.locator("[data-bookcase-builder]").evaluate((host) => ({
    theta: host.__bookcaseConfigurator.viewer.theta,
    cancellations: host.__bookcaseConfigurator.viewer.cameraTransitionCancellationCount
  }));
  expect(Math.abs(afterReset.theta)).toBeLessThan(0.01);
  expect(afterReset.cancellations).toBe(beforeReset.cancellations);

  await viewer.focus();
  await viewer.press("ArrowRight");
  await expect(workspace).toHaveAttribute("data-camera-state", "user-controlled");
  await setStage(page, "preview");
  await expect(workspace).toHaveAttribute("data-camera-state", "overview");
  await expect(workspace).toHaveAttribute("data-camera-profile", "preview");
  await expectFullModelFit(page, "Preview after manual camera");

  await page.setViewportSize({ width: 1180, height: 820 });
  await waitForCamera(page);
  await expect(workspace).toHaveAttribute("data-camera-state", "overview");
  await expect(workspace).toHaveAttribute("data-camera-profile", "preview");
  await auditWorkspaceGeometry(page, "Preview after iPad resize");
  await expectFullModelFit(page, "Preview after iPad resize");
  expect(runtimeIssues).toEqual([]);
});

test.describe("touch tablet workspace", () => {
  test.use({ hasTouch: true });

  test("six-section organizer keeps touch actions, content, and grid keyboard movement usable", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await openWorkspace(page);
    expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);
    await setStage(page, "layout");
    await setSectionCount(page, 6);
    await auditWorkspaceGeometry(page, "touch landscape six sections");

    const firstSection = page.locator('[data-section-select="0"]');
    await firstSection.focus();
    await firstSection.press("ArrowDown");
    await expect(page.locator('[data-section-select="3"]')).toHaveAttribute("aria-pressed", "true");
    const selectedActions = page.locator("[data-section-card].is-selected .workspace-section-card-actions button:visible");
    await expect(selectedActions).toHaveCount(2);
    for (const action of await selectedActions.all()) {
      const box = await action.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(40);
      expect(box?.height).toBeGreaterThanOrEqual(40);
    }

    await page.setViewportSize({ width: 768, height: 1024 });
    await waitForCamera(page);
    await auditWorkspaceGeometry(page, "touch portrait six sections");
    await expect(page.locator("[data-workspace-stage]"), "all icon-only stages stay named").toHaveCount(8);
    for (const stage of await page.locator("[data-workspace-stage]").all()) {
      await expect(stage).toHaveAttribute("aria-label", /\S/);
    }

    await setSectionCount(page, 4);
    await auditWorkspaceGeometry(page, "touch portrait four sections");
    const fourSectionCards = await page.locator("[data-section-card]").evaluateAll((cards) => cards.map((card) => {
      const cardBounds = card.getBoundingClientRect();
      const contained = (element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.left >= cardBounds.left - 1
          && bounds.right <= cardBounds.right + 1
          && bounds.top >= cardBounds.top - 1
          && bounds.bottom <= cardBounds.bottom + 1;
      };
      const content = [...card.querySelectorAll(
        ".workspace-section-thumbnail, .workspace-section-card-main > span:not(.workspace-section-thumbnail)"
      )];
      const labels = [...card.querySelectorAll(
        ".workspace-section-card-main strong, .workspace-section-card-main small"
      )];
      return {
        childContentContained: content.every(contained),
        labelsContained: labels.every(contained),
        labelsUnclipped: labels.every((label) => (
          label.scrollWidth <= label.clientWidth + 1 && label.scrollHeight <= label.clientHeight + 1
        ))
      };
    }));
    expect(fourSectionCards, "touch portrait four-section card count").toHaveLength(4);
    expect(
      fourSectionCards.every(({ childContentContained }) => childContentContained),
      "touch portrait four-section child content containment"
    ).toBe(true);
    expect(
      fourSectionCards.every(({ labelsContained, labelsUnclipped }) => labelsContained && labelsUnclipped),
      "touch portrait four-section label containment"
    ).toBe(true);
  });
});

test("accepted iPad workspace has no WCAG A/AA violations", async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await openWorkspace(page);
  const results = await new AxeBuilder({ page })
    .include("[data-configurator-workspace]")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(formatViolations(results.violations)).toEqual([]);
});
