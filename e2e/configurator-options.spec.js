import { test, expect } from "@playwright/test";

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

async function openConfigurator(page, preset = "lower-cabinets") {
  await page.goto(`/configurator.html?preset=${encodeURIComponent(preset)}`, { waitUntil: "networkidle" });
  const viewer = page.locator("[data-3d-viewer]");
  await expect(viewer).toHaveAttribute("data-render-valid", "true", { timeout: 20_000 });
  await expect(viewer.locator("canvas")).toHaveCount(1);
  return viewer;
}

async function settleFrames(page, count = 4) {
  await page.evaluate(async (frameCount) => {
    for (let index = 0; index < frameCount; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }, count);
}

async function readDesign(page) {
  return page.locator("[data-bookcase-builder]").evaluate((host) => {
    const configurator = host.__bookcaseConfigurator;
    const diagnostics = configurator.getDiagnostics();
    const components = configurator.layout.components;
    const countRole = (role) => components.filter((component) => component.role === role).length;
    return {
      state: diagnostics.state,
      sectionConfigs: diagnostics.state.layoutMetadata?.sectionConfigs || [],
      price: diagnostics.price,
      updateCount: diagnostics.updateCount,
      fingerprint: diagnostics.pricing.bom.layoutFingerprint,
      bom: diagnostics.pricing.bom,
      lineItems: diagnostics.pricing.lineItems,
      sectionTypes: components
        .filter((component) => component.role === "section")
        .map((component) => component.metadata.type),
      sectionWidths: configurator.layout.metrics.sectionClearWidths,
      roles: {
        crown: countRole("crown"),
        door: countRole("door"),
        drawer: countRole("drawer_front"),
        handle: countRole("handle"),
        light: countRole("light"),
        shelf: countRole("shelf")
      },
      render: {
        valid: diagnostics.viewer.renderAudit.valid,
        expected: diagnostics.viewer.renderAudit.expectedCount,
        rendered: diagnostics.viewer.renderAudit.renderedCount,
        canvasCount: diagnostics.canvasCount
      },
      view: diagnostics.view
    };
  });
}

const categoryStage = Object.freeze({
  overall_size: "space",
  sections_layout: "layout",
  shelves: "storage",
  storage_fronts: "storage",
  base_crown: "base_top",
  finish: "finish",
  hardware: "hardware",
  lighting: "lighting",
  project_service: "preview"
});

async function openCategory(page, category) {
  const stage = categoryStage[category];
  if (!stage) throw new Error(`No workspace stage registered for ${category}`);
  const trigger = page.locator(`[data-workspace-stage="${stage}"]`);
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-current", "location");
  await expect(page.locator("[data-properties-inspector]")).toBeVisible();
}

function numberField(page, category, field) {
  void category;
  return page.locator(`[data-properties-inspector] input[type="number"][data-field="${field}"]`);
}

async function setNumber(page, category, field, value) {
  await openCategory(page, category);
  await numberField(page, category, field).fill(String(value));
  await expect.poll(async () => (await readDesign(page)).state[field]).toBe(value);
}

async function chooseRadio(page, category, field, value) {
  await openCategory(page, category);
  const control = page.locator(`[data-properties-inspector] input[data-field="${field}"][value="${value}"]`);
  const controlId = await control.getAttribute("id");
  const label = controlId
    ? page.locator(`label[for="${controlId}"]`)
    : control.locator("xpath=ancestor::label[1]");
  await label.click();
  await expect(control).toBeChecked();
  await expect.poll(async () => String((await readDesign(page)).state[field])).toBe(String(value));
}

async function chooseSectionType(page, index, type) {
  const presetByType = {
    open: "open_shelves",
    lower_doors: "lower_doors",
    drawers: "lower_drawers",
    tall_doors: "full_doors"
  };
  const preset = presetByType[type];
  if (!preset) throw new Error(`No Storage preset registered for section type ${type}`);
  await selectStorageSection(page, index);
  await page.locator(`[data-properties-inspector] [data-section-storage-preset="${preset}"]`).check();
  await expect.poll(async () => (await readDesign(page)).sectionTypes[index]).toBe(type);
}

async function selectStorageSection(page, index) {
  await openCategory(page, "storage_fronts");
  const section = page.locator(`[data-section-organizer] [data-section-select="${index}"]`);
  await section.click();
  await expect(section).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-properties-inspector] [data-storage-console] h3").first()).toHaveText(
    new RegExp(`Section ${index + 1} of`)
  );
}

async function setSectionNumber(page, index, field, value) {
  await selectStorageSection(page, index);
  const control = page.locator(
    `[data-properties-inspector] input[type="number"][data-section-storage-field="${field}"]`
  );
  await control.fill(String(value));
  await control.press("Enter");
  await expect.poll(async () => (await readDesign(page)).sectionConfigs[index]?.[field]).toBe(value);
}

async function chooseSectionStyle(page, index, field, value) {
  await selectStorageSection(page, index);
  const control = page.locator(
    `[data-properties-inspector] select[data-section-storage-field="${field}"]`
  );
  await control.selectOption(value);
  await expect.poll(async () => (await readDesign(page)).sectionConfigs[index]?.[field]).toBe(value);
}

async function chooseHardware(page, type, finish, canonicalVariant) {
  await openCategory(page, "hardware");
  const inspector = page.locator("[data-properties-inspector]");
  await inspector.locator(`.hardware-type-choice:has(input[value="${type}"])`).click();
  await expect(inspector.locator(`[data-hardware-type][value="${type}"]`)).toBeChecked();
  await inspector.locator(`.hardware-finish-choice:has(input[value="${finish}"])`).click();
  await expect(inspector.locator(`[data-hardware-finish][value="${finish}"]`)).toBeChecked();
  await expect.poll(async () => (await readDesign(page)).state.hardware).toBe(canonicalVariant);
}

function expectVerifiedModel(design) {
  expect(design.render.valid).toBe(true);
  expect(design.render.rendered).toBe(design.render.expected);
  expect(design.render.canvasCount).toBe(1);
  expect(design.fingerprint).toMatch(/^jq-layout-v1-[0-9a-f]{16}$/);
  expect(design.bom.layoutFingerprint).toBe(design.fingerprint);
}

test("dimension boundaries reconcile structurally while invalid drafts preserve the accepted model and estimate", async ({ page }) => {
  const runtimeErrors = monitorRuntime(page);
  const viewer = await openConfigurator(page);
  await openCategory(page, "overall_size");

  const initial = await readDesign(page);
  const width = numberField(page, "overall_size", "width");
  await width.fill("145");
  await expect(page.locator('[data-field-error="width"]')).toContainText("between 24 and 144 inches");
  await expect(page.locator("[data-save-design]").first()).toBeDisabled();
  await expect(viewer).toHaveAttribute("data-render-valid", "true");
  const invalid = await readDesign(page);
  expect(invalid.state.width).toBe(96);
  expect(invalid.price).toBe(initial.price);
  expect(invalid.fingerprint).toBe(initial.fingerprint);
  expect(invalid.updateCount).toBe(initial.updateCount);

  await width.fill("24");
  await expect.poll(async () => (await readDesign(page)).state.width).toBe(24);
  let design = await readDesign(page);
  expect(design.state.sections).toBe(1);
  expect(design.bom.overall.widthIn).toBe(24);
  expect(design.bom.sections.count).toBe(1);
  expect(design.sectionWidths[0]).toBeGreaterThanOrEqual(15);

  await setNumber(page, "overall_size", "height", 120);
  await setNumber(page, "overall_size", "depth", 10);
  await setSectionNumber(page, 0, "shelfCount", 8);
  await setNumber(page, "shelves", "shelfThickness", 0.75);
  design = await readDesign(page);
  expect(design.state).toMatchObject({ width: 24, height: 120, depth: 10, sections: 1, shelfThickness: 0.75 });
  expect(design.sectionConfigs[0]).toMatchObject({ type: "lower_doors", shelfCount: 8 });
  expect(design.bom.overall).toMatchObject({ widthIn: 24, heightIn: 120, depthIn: 10 });
  expect(design.bom.shelves.adjustableCount).toBe(8);
  expect(design.roles.shelf).toBe(8);
  expectVerifiedModel(design);

  await openCategory(page, "overall_size");
  await numberField(page, "overall_size", "depth").fill("9");
  await expect(page.locator('[data-field-error="depth"]')).toContainText("between 10 and 24 inches");
  const secondInvalid = await readDesign(page);
  expect(secondInvalid.state.depth).toBe(10);
  expect(secondInvalid.fingerprint).toBe(design.fingerprint);
  await numberField(page, "overall_size", "depth").fill("24");
  await expect.poll(async () => (await readDesign(page)).state.depth).toBe(24);
  await expect(page.locator('[data-field-error="depth"]')).toBeEmpty();
  await expect(page.locator("[data-save-design]").first()).toBeEnabled();
  expect(runtimeErrors).toEqual([]);
});

test("section count and mixed storage changes stay synchronized with geometry, BOM, applicability, undo, and redo", async ({ page }) => {
  const runtimeErrors = monitorRuntime(page);
  const viewer = await openConfigurator(page);
  await chooseSectionType(page, 0, "drawers");
  await setSectionNumber(page, 0, "drawerCount", 5);
  let design = await readDesign(page);
  expect(design.state.lowerCabinets).toBe(true);
  expect(design.sectionTypes).toEqual(["drawers", "lower_doors", "lower_doors", "lower_doors"]);
  expect(design.bom.drawers.frontCount).toBe(5);
  expect(design.roles.drawer).toBe(5);
  expect(design.roles.door).toBeGreaterThan(0);
  expect(design.lineItems.find((item) => item.code === "DRAWER_FRONTS")).toMatchObject({
    quantity: 5,
    unitRate: 55,
    amount: 275
  });

  await setNumber(page, "overall_size", "width", 132);
  await openCategory(page, "sections_layout");
  await expect(page.locator("[data-builder-form]")).toHaveAttribute("data-diagnostic-workspace-stage", "layout");
  const organizer = page.locator("[data-section-organizer]");
  await organizer.locator("[data-section-add]").click();
  await organizer.locator("[data-section-add]").click();
  await expect.poll(async () => (await readDesign(page)).state.sections).toBe(6);
  design = await readDesign(page);
  expect(design.bom.sections.count).toBe(6);
  expect(design.bom.drawers.frontCount).toBe(5);

  for (let count = 6; count > 3; count -= 1) {
    const selectedDelete = page.locator("[data-properties-inspector] [data-section-delete]");
    await expect(selectedDelete).toBeEnabled();
    await selectedDelete.click();
  }
  await expect.poll(async () => (await readDesign(page)).state.sections).toBe(3);
  await expect(organizer.locator("[data-section-card]")).toHaveCount(3);

  const firstSection = organizer.locator('[data-section-select="0"]');
  await firstSection.focus();
  await firstSection.press("End");
  await expect(organizer.locator('[data-section-select="2"]')).toBeFocused();
  await expect(organizer.locator('[data-section-select="2"]')).toHaveAttribute("aria-pressed", "true");
  await chooseSectionType(page, 0, "drawers");
  await chooseSectionType(page, 1, "open");
  await chooseSectionType(page, 2, "open");
  await expect.poll(async () => (await readDesign(page)).sectionTypes).toEqual(["drawers", "open", "open"]);
  design = await readDesign(page);
  expect(design.bom.drawers.frontCount).toBe(5);
  expect(design.roles.drawer).toBe(5);

  const changedFingerprint = design.fingerprint;
  await page.locator("[data-history-undo]").click();
  await expect.poll(async () => (await readDesign(page)).sectionTypes).toEqual(["drawers", "open", "lower_doors"]);
  await page.locator("[data-history-redo]").click();
  await expect.poll(async () => (await readDesign(page)).fingerprint).toBe(changedFingerprint);
  design = await readDesign(page);
  expect(design.sectionTypes).toEqual(["drawers", "open", "open"]);

  await openCategory(page, "sections_layout");
  await organizer.locator('[data-section-select="0"]').click();
  const selectedWidth = page.locator("[data-properties-inspector] [data-section-width]");
  await selectedWidth.fill("46.5");
  await selectedWidth.blur();
  await expect.poll(async () => (await readDesign(page)).sectionWidths[0]).toBe(46.5);

  await chooseSectionType(page, 0, "lower_doors");
  await expect.poll(async () => (await readDesign(page)).sectionTypes).toEqual(["lower_doors", "open", "open"]);
  design = await readDesign(page);
  expect(design.state).toMatchObject({ lowerCabinets: true, lowerStorage: "doors" });
  expect(design.roles.door).toBeGreaterThan(0);
  expect(design.roles.drawer).toBe(0);

  await chooseSectionType(page, 0, "drawers");
  await setSectionNumber(page, 0, "drawerCount", 5);
  await expect.poll(async () => (await readDesign(page)).sectionTypes).toEqual(["drawers", "open", "open"]);
  design = await readDesign(page);
  expect(design.roles.door).toBe(0);
  expect(design.roles.drawer).toBe(5);

  await chooseSectionType(page, 0, "open");
  await expect.poll(async () => (await readDesign(page)).sectionTypes).toEqual(["open", "open", "open"]);
  design = await readDesign(page);
  expect(design.state.lowerCabinets).toBe(false);
  expect(design.roles.door).toBe(0);
  expect(design.roles.drawer).toBe(0);

  await page.locator("[data-history-undo]").click();
  await expect.poll(async () => (await readDesign(page)).sectionTypes).toEqual(["drawers", "open", "open"]);
  design = await readDesign(page);
  expect(design.state).toMatchObject({ lowerCabinets: true, lowerStorage: "drawers" });
  expect(design.roles.door).toBe(0);
  expect(design.roles.drawer).toBe(5);
  expectVerifiedModel(design);
  await expect(viewer).toHaveAttribute("data-render-valid", "true");
  expect(runtimeErrors).toEqual([]);
});

test("the fixed Properties inspector exposes one selected-section Storage card with conditional controls", async ({ page }) => {
  const runtimeErrors = monitorRuntime(page);
  await openConfigurator(page);
  await openCategory(page, "storage_fronts");
  const inspector = page.locator("[data-properties-inspector]");
  await expect(inspector.locator("[data-inspector-tab]")).toHaveCount(0);
  await expect(inspector.locator(".workspace-properties-panel")).toHaveCount(1);
  await expect(inspector.locator("[data-storage-console]")).toHaveCount(1);
  await expect(inspector.locator("[data-front-profile-groups]")).toHaveCount(0);
  await expect(inspector.locator(".workspace-storage-doors")).toBeVisible();
  await expect(inspector.locator(".workspace-storage-drawers")).toHaveCount(0);
  const doorStyle = inspector.locator('select[data-section-storage-field="doorStyle"]');
  await expect(doorStyle.locator("option")).toHaveCount(4);
  await chooseSectionStyle(page, 0, "doorStyle", "flat");
  await expect(doorStyle).toHaveValue("flat");

  await chooseSectionType(page, 0, "drawers");
  await expect(inspector.locator("[data-inspector-tab]")).toHaveCount(0);
  await expect(inspector.locator(".workspace-storage-doors")).toHaveCount(0);
  await expect(inspector.locator(".workspace-storage-drawers")).toBeVisible();
  const drawerStyle = inspector.locator('select[data-section-storage-field="drawerFrontStyle"]');
  await expect(drawerStyle.locator("option")).toHaveCount(3);
  await chooseSectionStyle(page, 0, "drawerFrontStyle", "slim_shaker");
  await expect(drawerStyle).toHaveValue("slim_shaker");

  await selectStorageSection(page, 1);
  await expect(inspector.locator(".workspace-storage-doors")).toBeVisible();
  await expect(inspector.locator(".workspace-storage-drawers")).toHaveCount(0);
  await expect(inspector.locator('select[data-section-storage-field="doorStyle"]')).toHaveValue("shaker");
  expect((await readDesign(page)).sectionConfigs.slice(0, 2)).toMatchObject([
    { type: "drawers", drawerFrontStyle: "slim_shaker" },
    { type: "lower_doors", doorStyle: "shaker" }
  ]);
  expect(runtimeErrors).toEqual([]);
});

test("construction, fronts, finish, hardware, lighting, and service selections persist with matching geometry, BOM, pricing, and review", async ({ page }) => {
  const runtimeErrors = monitorRuntime(page);
  const viewer = await openConfigurator(page);
  const initial = await readDesign(page);

  await chooseRadio(page, "base_crown", "baseStyle", "toe_kick");
  await chooseRadio(page, "base_crown", "crownStyle", "none");
  await setNumber(page, "shelves", "shelfThickness", 2);
  await chooseSectionStyle(page, 0, "doorStyle", "glass");
  await chooseHardware(page, "pull", "matte_black", "matte_black_pull");
  await chooseRadio(page, "lighting", "lighting", "vertical_led");
  await chooseRadio(page, "lighting", "lightingWarmth", 3500);
  await chooseRadio(page, "project_service", "delivery", "pickup");
  await chooseRadio(page, "project_service", "installation", "no_installation");

  await chooseRadio(page, "finish", "finish", "silver_satin");
  await page.locator('[data-properties-inspector] [data-toggle-color-search]:not([data-color-search-close])').click();
  const colorSearch = page.locator('[data-properties-inspector] [data-bm-query]');
  await colorSearch.fill("HC-154");
  await colorSearch.press("Enter");
  await expect.poll(async () => (await readDesign(page)).state.finish).toBe("custom_bm");
  await expect(page.getByLabel("Applied Benjamin Moore color").getByText("Hale Navy", { exact: true })).toBeVisible();

  let design = await readDesign(page);
  expect(design.state).toMatchObject({
    baseStyle: "toe_kick",
    crownStyle: "none",
    shelfThickness: 2,
    finish: "custom_bm",
    customPaintColor: "Hale Navy",
    customPaintCode: "HC-154",
    hardware: "matte_black_pull",
    lighting: "vertical_led",
    lightingWarmth: 3500,
    delivery: "pickup",
    installation: "no_installation"
  });
  expect(design.roles.crown).toBe(0);
  expect(design.bom.trim.crownCount).toBe(0);
  expect(design.sectionConfigs[0]).toMatchObject({ type: "lower_doors", doorStyle: "glass" });
  expect(design.sectionConfigs.slice(1).every((section) => section.doorStyle === "shaker")).toBe(true);
  expect(design.bom.doors.byStyle.glass).toBeGreaterThan(0);
  expect(design.bom.doors.byStyle.shaker).toBeGreaterThan(0);
  expect(Object.values(design.bom.doors.byStyle).reduce((total, count) => total + count, 0)).toBe(design.bom.doors.count);
  expect(design.bom.hardware.byType.matte_black_pull).toBe(design.bom.hardware.handleCount);
  expect(design.bom.lighting.byType.vertical_led).toBe(design.bom.lighting.count);
  expect(design.lineItems.find((item) => item.code === "CROWN_STYLE")?.amount).toBe(0);
  expect(design.lineItems.find((item) => item.code === "INSTALLATION")?.amount).toBe(0);
  expect(design.lineItems.find((item) => item.code === "DELIVERY")?.amount).toBe(0);
  expect(design.price).not.toBe(initial.price);
  expectVerifiedModel(design);
  await expect(viewer).toHaveAttribute("data-render-valid", "true");

  await openCategory(page, "project_service");
  const reviewInvoker = page.locator("[data-review-design]").first();
  await reviewInvoker.click();
  const review = page.locator("[data-review-dialog]");
  await expect(review).toHaveAttribute("open", "");
  await expect(review).toContainText("Hale Navy HC-154");
  await expect(review).toContainText("Hardware type");
  await expect(review).toContainText("Pull");
  await expect(review).toContainText("Hardware finish");
  await expect(review).toContainText("Matte Black");
  await expect(review).toContainText("Side Vertical Lights");
  await expect(review).toContainText("Recessed Toe Kick");
  await page.keyboard.press("Escape");
  await expect(review).not.toHaveAttribute("open", "");
  await expect(reviewInvoker).toBeFocused();

  await page.locator("[data-save-design]").first().click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("jqBookcasesDesign") || "null"));
  expect(saved.canonicalConfig).toMatchObject(design.state);
  expect(saved.bom.layoutFingerprint).toBe(design.fingerprint);
  expect(saved.total).toBe(design.price);

  await page.goto("/configurator.html", { waitUntil: "networkidle" });
  await expect(page.locator("[data-3d-viewer]")).toHaveAttribute("data-render-valid", "true", { timeout: 20_000 });
  design = await readDesign(page);
  expect(design.state).toMatchObject({
    baseStyle: "toe_kick",
    crownStyle: "none",
    shelfThickness: 2,
    finish: "custom_bm",
    customPaintCode: "HC-154",
    hardware: "matte_black_pull",
    lighting: "vertical_led",
    lightingWarmth: 3500,
    delivery: "pickup",
    installation: "no_installation"
  });
  expect(design.sectionConfigs[0]).toMatchObject({ type: "lower_doors", doorStyle: "glass" });
  expect(design.sectionConfigs.slice(1).every((section) => section.doorStyle === "shaker")).toBe(true);
  expect(design.fingerprint).toBe(saved.layoutFingerprint);
  expect(design.price).toBe(saved.total);
  expectVerifiedModel(design);
  expect(runtimeErrors).toEqual([]);
});

test("mobile keyboard operation navigates workspace stages, manipulates the camera, reviews, saves, and restores without overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const runtimeErrors = monitorRuntime(page);
  const viewer = await openConfigurator(page, "classic-open");

  const layoutStage = page.locator('[data-workspace-stage="layout"]');
  await layoutStage.focus();
  await layoutStage.press("Enter");
  await expect(layoutStage).toHaveAttribute("aria-current", "location");
  await expect(page.locator("[data-section-organizer]")).toBeVisible();

  const spaceStage = page.locator('[data-workspace-stage="space"]');
  await spaceStage.focus();
  await spaceStage.press("Enter");
  await expect(spaceStage).toHaveAttribute("aria-current", "location");
  await numberField(page, "overall_size", "width").fill("120");
  await expect.poll(async () => (await readDesign(page)).state.width).toBe(120);

  await viewer.focus();
  const beforeCamera = (await readDesign(page)).view;
  await viewer.press("ArrowRight");
  await viewer.press("+");
  const afterCamera = (await readDesign(page)).view;
  expect(afterCamera.theta).not.toBe(beforeCamera.theta);
  expect(afterCamera.radius).toBeLessThan(beforeCamera.radius);

  const previewStage = page.locator('[data-workspace-stage="preview"]');
  await previewStage.focus();
  await previewStage.press("Enter");
  await expect(previewStage).toHaveAttribute("aria-current", "location");
  const reviewInvoker = page.locator("[data-review-design]").first();
  await reviewInvoker.focus();
  await reviewInvoker.press("Enter");
  await expect(page.locator("[data-review-dialog]")).toHaveAttribute("open", "");
  await expect(page.locator("[data-close-review]")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-review-dialog]")).not.toHaveAttribute("open", "");
  await expect(reviewInvoker).toBeFocused();

  await page.locator("[data-save-design]").first().click();
  const savedId = await page.evaluate(() => JSON.parse(localStorage.getItem("jqBookcasesDesign") || "null")?.id);
  expect(savedId).toMatch(/^JQ-[0-9A-Z]{7}$/);
  await page.goto("/configurator.html", { waitUntil: "networkidle" });
  await expect(page.locator("[data-3d-viewer]")).toHaveAttribute("data-render-valid", "true", { timeout: 20_000 });
  const restored = await readDesign(page);
  expect(restored.state.width).toBe(120);
  expect(restored.state.layoutType).toBe("classic");
  expectVerifiedModel(restored);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(runtimeErrors).toEqual([]);
});

test("Preview fits the entire bookcase and the next stage resolves a fresh camera intent", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const runtimeErrors = monitorRuntime(page);
  await openConfigurator(page, "classic-open");

  await page.locator("[data-bookcase-builder]").evaluate((host) => {
    host.__bookcaseConfigurator.viewer.focusSection(0, { force: true, duration: 0 });
  });
  await settleFrames(page, 3);
  const before = (await readDesign(page)).view;

  await page.locator('[data-workspace-stage="preview"]').click();
  await expect.poll(() => page.locator("[data-bookcase-builder]").evaluate((host) => ({
    focus: host.__bookcaseConfigurator.viewer.activeFocusKey,
    transitioning: Boolean(host.__bookcaseConfigurator.viewer.cameraTransition)
  }))).toEqual({ focus: "preview", transitioning: false });

  const framing = await page.locator("[data-bookcase-builder]").evaluate((host) => {
    const viewer = host.__bookcaseConfigurator.viewer;
    const sceneBounds = {
      min: { x: Infinity, y: Infinity, z: Infinity },
      max: { x: -Infinity, y: -Infinity, z: -Infinity }
    };
    viewer.model.updateMatrixWorld(true);
    viewer.model.traverse((object) => {
      if (!object.isMesh || !object.geometry || object.userData?.nonPhysicalHelper) return;
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
      const box = object.geometry.boundingBox;
      for (const x of [box.min.x, box.max.x]) {
        for (const y of [box.min.y, box.max.y]) {
          for (const z of [box.min.z, box.max.z]) {
            const point = viewer.camera.position.clone().set(x, y, z).applyMatrix4(object.matrixWorld);
            sceneBounds.min.x = Math.min(sceneBounds.min.x, point.x);
            sceneBounds.min.y = Math.min(sceneBounds.min.y, point.y);
            sceneBounds.min.z = Math.min(sceneBounds.min.z, point.z);
            sceneBounds.max.x = Math.max(sceneBounds.max.x, point.x);
            sceneBounds.max.y = Math.max(sceneBounds.max.y, point.y);
            sceneBounds.max.z = Math.max(sceneBounds.max.z, point.z);
          }
        }
      }
    });
    viewer.camera.updateMatrixWorld(true);
    const rect = viewer.root.getBoundingClientRect();
    const pixels = [];
    for (const x of [sceneBounds.min.x, sceneBounds.max.x]) {
      for (const y of [sceneBounds.min.y, sceneBounds.max.y]) {
        for (const z of [sceneBounds.min.z, sceneBounds.max.z]) {
          const projected = viewer.camera.position.clone().set(x, y, z).project(viewer.camera);
          pixels.push({
            x: (projected.x + 1) * rect.width / 2,
            y: (1 - projected.y) * rect.height / 2,
            depth: projected.z
          });
        }
      }
    }
    return { pixels, safe: viewer.getSafeViewport().localBounds };
  });

  for (const corner of framing.pixels) {
    expect(corner.x).toBeGreaterThanOrEqual(framing.safe.left - 1);
    expect(corner.x).toBeLessThanOrEqual(framing.safe.right + 1);
    expect(corner.y).toBeGreaterThanOrEqual(framing.safe.top - 1);
    expect(corner.y).toBeLessThanOrEqual(framing.safe.bottom + 1);
    expect(corner.depth).toBeGreaterThanOrEqual(-1);
    expect(corner.depth).toBeLessThanOrEqual(1);
  }

  await page.locator('[data-workspace-stage="storage"]').click();
  await settleFrames(page, 3);
  const after = (await readDesign(page)).view;
  const workspace = page.locator("[data-configurator-workspace]");
  await expect(workspace).toHaveAttribute("data-camera-state", "overview");
  await expect(workspace).toHaveAttribute("data-camera-profile", "overview");
  await expect(workspace).toHaveAttribute("data-camera-source-stage", "storage");
  await expect(workspace).toHaveAttribute("data-camera-source-section", "");
  expect(after.focus).toBe("overview");
  expect(after.focusVariant).not.toBe(before.focusVariant);
  expect(runtimeErrors).toEqual([]);
});
