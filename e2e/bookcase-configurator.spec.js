import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  PUBLIC_CONFIGURATOR_COMING_SOON_CHOICES,
  PUBLIC_CONFIGURATOR_PRODUCT_CHOICES,
  SHARED_ROOM_LAYOUTS,
  getMeasurementFields
} from "../guided-configurator-data.js";
import {
  GUIDED_PRODUCT_LAYOUT_COMPATIBILITY
} from "../guided-product-adapter.js";

const ACTIVE_PRODUCT = PUBLIC_CONFIGURATOR_PRODUCT_CHOICES[0];
const DRAFT_KEY = "jqGuidedConfiguratorDraftV1";
const PROJECTS_KEY = "jqGuidedConfiguratorProjectsV1";

function monitorRuntime(page) {
  const failures = [];
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console: ${message.text()}`);
  });
  page.on("requestfailed", (request) => {
    failures.push(`request: ${request.url()} ${request.failure()?.errorText || "failed"}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && !response.url().endsWith("/api/quote")) {
      failures.push(`response: ${response.status()} ${response.url()}`);
    }
  });
  return failures;
}

async function openFreshProject(page) {
  await page.goto("configurator.html?start=new", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Choose your product" })).toBeVisible();
  await expect(page).toHaveURL(/configurator\.html#step-1$/);
}

async function chooseActiveProduct(page) {
  const card = page.locator(`[data-product-choice="${ACTIVE_PRODUCT.id}"]`);
  await card.click();
  await expect(card).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-continue]")).toBeEnabled();
}

async function continueToLayouts(page) {
  await chooseActiveProduct(page);
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Choose the layout that matches your space" })).toBeVisible();
  await expect(page).toHaveURL(/#step-2$/);
}

async function chooseLayout(page, layoutId = "clear-wall") {
  const card = page.locator(`[data-layout="${layoutId}"]`);
  await card.click();
  await expect(card).toHaveAttribute("aria-pressed", "true");
}

async function continueToCustomization(page, layoutId = "clear-wall") {
  await continueToLayouts(page);
  await chooseLayout(page, layoutId);
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Customize your fitted design" })).toBeVisible();
  await expect(page).toHaveURL(/#step-3$/);
  await expect(page.getByRole("tab", { name: "Dimensions" })).toHaveAttribute("aria-selected", "true");
}

async function expectAcceptedScene(page) {
  const preview = page.locator(".concept-preview");
  await expect(preview).toHaveCount(1);
  await expect(preview).toHaveAttribute("data-preview-render-mode", "accepted-geometry");
  await expect(preview).toHaveAttribute("data-accepted-specification", "true");
  await expect(preview).toHaveAttribute("data-geometry-fingerprint", /.+/);
  await expect(preview.locator("[data-published-preview-image], picture.concept-photo, img.concept-photo")).toHaveCount(0);
  const canvas = preview.locator('.guided-3d-canvas[data-rendered="true"]');
  await expect(canvas).toHaveCount(1);
  await expect(canvas).toHaveAttribute("data-render-contract-valid", "true");
  await expect(canvas).toHaveAttribute("data-geometry-fingerprint", /.+/);
  await expect(canvas).toHaveAttribute("data-specification-fingerprint", /.+/);
  return canvas;
}

async function continueToReview(page, layoutId = "clear-wall") {
  await continueToCustomization(page, layoutId);
  await expectAcceptedScene(page);
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Review your custom concept" })).toBeVisible();
  await expect(page).toHaveURL(/#step-4$/);
}

function legacyProject(overrides = {}) {
  return {
    schemaVersion: 3,
    projectId: "JQ-LEGACY-FOUR-STEP",
    projectName: "Legacy saved project",
    currentStep: 5,
    maxVisitedStep: 5,
    category: "bookcase",
    productSelected: true,
    layout: "clear-wall",
    measurements: { wallWidth: 120, ceilingHeight: 96, desiredDepth: 14 },
    style: "cabinet-base-shelves",
    finish: "white-oak",
    accentFinish: "natural-oak",
    doorStyle: "shaker",
    hardware: "brass-pull",
    lighting: "warm-led",
    baseStyle: "flush-base",
    topTreatment: "small-crown",
    notes: "",
    uploadedFiles: [],
    customerDetails: {},
    acceptedSnapshot: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    status: "saved",
    ...overrides
  };
}

async function seedStorage(page, { draft = null, projects = [] } = {}) {
  await page.addInitScript(({ draftKey, projectsKey, draftValue, projectValues }) => {
    if (draftValue) localStorage.setItem(draftKey, JSON.stringify(draftValue));
    else localStorage.removeItem(draftKey);
    localStorage.setItem(projectsKey, JSON.stringify(projectValues));
  }, {
    draftKey: DRAFT_KEY,
    projectsKey: PROJECTS_KEY,
    draftValue: draft,
    projectValues: projects
  });
}

async function fillQuoteContact(dialog) {
  for (const [name, value] of Object.entries({
    fullName: "Alex Morgan",
    email: "alex@example.com",
    phone: "5165550188",
    zip: "11570"
  })) {
    await dialog.locator(`[name="${name}"]`).fill(value);
  }
}

test("the public route exposes exactly the authorized four-step journey", async ({ page }) => {
  const runtime = monitorRuntime(page);
  await openFreshProject(page);
  const stepper = page.getByRole("navigation", { name: "Project steps" });
  await expect(stepper.getByRole("button")).toHaveCount(4);
  await expect(stepper.locator(".guided-step-label--full")).toHaveText([
    "Choose Product",
    "Choose Layout",
    "Customization",
    "Review & Details"
  ]);
  await expect(page.getByText("Room & Size", { exact: true })).toHaveCount(0);
  await expect(page.locator("[data-product-choice]")).toHaveCount(1);
  await expect(page.locator("[data-product-choice] .product-card-title")).toHaveText("Cabinets + Shelves");
  await expect(page.locator("[data-coming-soon-product]")).toHaveCount(
    PUBLIC_CONFIGURATOR_COMING_SOON_CHOICES.length
  );
  expect(await page.locator("[data-coming-soon-product]").evaluateAll(
    (buttons) => buttons.every((button) => button.disabled)
  )).toBe(true);
  await expect(page.locator("[data-continue]")).toBeDisabled();
  expect(runtime).toEqual([]);
});

test("Coming soon products cannot activate by pointer, keyboard, query, or preset", async ({ page }) => {
  await openFreshProject(page);
  const comingSoon = page.locator('[data-coming-soon-product="tv-unit"]');
  await expect(comingSoon).toBeDisabled();
  await comingSoon.evaluate((button) => button.click());
  await comingSoon.dispatchEvent("click");
  await expect(page.locator("[data-product-choice]")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("[data-continue]")).toBeDisabled();
  await comingSoon.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Space");
  await expect(page.locator("[data-continue]")).toBeDisabled();

  await page.goto("configurator.html?start=new&product=tv-unit#step-4", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/#step-1$/);
  await expect(page.locator("[data-product-choice]")).toHaveAttribute("aria-pressed", "false");
  await page.goto("configurator.html?start=new&preset=media-wall#step-5", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/configurator\.html#step-1$/);
  await expect(page.locator("[data-product-choice]")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("[data-continue]")).toBeDisabled();
});

test("direct unsupported draft injection is retained but routed safely to Choose Product", async ({ page }) => {
  const unsupported = legacyProject({
    projectId: "JQ-UNSUPPORTED-DRAFT",
    projectName: "Legacy TV wall",
    category: "tv-unit",
    style: "framed-tv-wall"
  });
  await seedStorage(page, { draft: unsupported });
  await page.goto("configurator.html#step-5", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/#step-1$/);
  await expect(page.locator("[data-unavailable-product]")).toContainText("TV Unit is not available");
  await expect(page.locator("[data-product-choice]")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("[data-continue]")).toBeDisabled();
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), DRAFT_KEY);
  expect(stored).toMatchObject({
    category: "tv-unit",
    style: "framed-tv-wall",
    productSelected: true,
    productAvailability: "unavailable"
  });
});

test("unsupported saved projects remain intact and starting Cabinets + Shelves creates a separate draft", async ({ page }) => {
  const unsupported = legacyProject({
    projectId: "JQ-UNSUPPORTED-SAVED",
    projectName: "Saved media room",
    category: "tv-unit",
    style: "framed-tv-wall"
  });
  await seedStorage(page, { projects: [unsupported] });
  await openFreshProject(page);
  await page.getByRole("button", { name: "My Projects", exact: true }).click();
  const dialog = page.locator("[data-projects-dialog]");
  const saved = dialog.locator('[data-saved-product-availability="unavailable"]');
  await expect(saved).toContainText("Saved media room");
  await expect(saved).toContainText("Unavailable in this public preview");
  await dialog.getByRole("button", { name: "Resume Saved media room" }).click();
  await expect(page.locator("[data-unavailable-product]")).toContainText("saved project remains");
  await expect(page).toHaveURL(/project=JQ-UNSUPPORTED-SAVED#step-1$/);

  const before = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), PROJECTS_KEY);
  expect(before[0]).toMatchObject({
    projectId: "JQ-UNSUPPORTED-SAVED",
    category: "tv-unit",
    style: "framed-tv-wall"
  });
  await chooseActiveProduct(page);
  await expect.poll(() => page.evaluate((key) => {
    const draft = JSON.parse(localStorage.getItem(key) || "null");
    return draft?.projectId || null;
  }, DRAFT_KEY)).not.toBe("JQ-UNSUPPORTED-SAVED");
  const after = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), PROJECTS_KEY);
  expect(after).toEqual(before);
});

test("only compatibility-approved Cabinets + Shelves layouts are selectable", async ({ page }) => {
  await openFreshProject(page);
  await continueToLayouts(page);
  const approvedLayoutIds = SHARED_ROOM_LAYOUTS
    .filter(({ id }) => GUIDED_PRODUCT_LAYOUT_COMPATIBILITY[ACTIVE_PRODUCT.id][id] !== "unavailable")
    .map(({ id }) => id);
  const renderedLayoutIds = await page.locator("[data-layout]").evaluateAll(
    (cards) => cards.map((card) => card.dataset.layout)
  );
  expect(renderedLayoutIds).toEqual(approvedLayoutIds);
  await expect(page.locator("[data-layout]:disabled")).toHaveCount(0);
  for (const layoutId of approvedLayoutIds) {
    await chooseLayout(page, layoutId);
    await expect(page.locator("[data-continue]")).toBeEnabled();
  }
});

test("every approved layout puts all applicable measurement fields inside Customization", async ({ page }) => {
  await openFreshProject(page);
  await continueToLayouts(page);
  const approvedLayouts = SHARED_ROOM_LAYOUTS.filter(
    ({ id }) => GUIDED_PRODUCT_LAYOUT_COMPATIBILITY[ACTIVE_PRODUCT.id][id] !== "unavailable"
  );
  for (const [index, layout] of approvedLayouts.entries()) {
    await chooseLayout(page, layout.id);
    await page.locator("[data-continue]").click();
    await expect(page.getByRole("heading", { name: "Customize your fitted design" })).toBeVisible();
    const expectedFields = getMeasurementFields("bookcase", layout.id).map(({ id }) => id);
    const renderedFields = await page.locator("[data-measurement-row]").evaluateAll(
      (rows) => rows.map((row) => row.dataset.measurementRow)
    );
    expect(renderedFields, layout.label).toEqual(expectedFields);
    await expect(page.locator("[data-measurement-guidance]")).toBeVisible();
    await expectAcceptedScene(page);
    if (index < approvedLayouts.length - 1) {
      await page.locator('[data-step="2"]').click();
      await expect(page.getByRole("heading", { name: "Choose the layout that matches your space" })).toBeVisible();
    }
  }
});

test("Customization immediately owns one controller, canvas, RAF, timer, and listener set", async ({ page }) => {
  await openFreshProject(page);
  await continueToCustomization(page, "niche-layout");
  let canvas = await expectAcceptedScene(page);
  const instance = await canvas.getAttribute("data-guided-3d-instance");
  const assertSingleOwnership = async () => {
    canvas = page.locator(".guided-3d-canvas");
    await expect(canvas).toHaveCount(1);
    await expect(canvas).toHaveAttribute("data-guided-3d-instance", instance);
    const ownership = await canvas.evaluate((element) => ({
      renderFrame: Number(element.dataset.renderFrameOwnership),
      resizeFrame: Number(element.dataset.resizeFrameOwnership),
      resizeObserver: Number(element.dataset.resizeObserverOwnership),
      resizeListener: Number(element.dataset.resizeListenerOwnership),
      controlListener: Number(element.dataset.controlListenerOwnership)
    }));
    expect(ownership.renderFrame).toBeLessThanOrEqual(1);
    expect(ownership.resizeFrame).toBeLessThanOrEqual(1);
    expect(ownership.resizeObserver + ownership.resizeListener).toBe(1);
    expect(ownership.controlListener).toBe(1);
    await expect(page.locator("[data-guided-app]")).toHaveAttribute("data-measurement-timer-ownership", "0");
  };
  await assertSingleOwnership();
  await page.getByRole("tab", { name: "Finish" }).click();
  await assertSingleOwnership();
  await page.getByRole("tab", { name: "Details" }).click();
  await assertSingleOwnership();
  await page.locator("[data-continue]").click();
  await expect(page).toHaveURL(/#step-4$/);
  await assertSingleOwnership();
  await page.locator('[data-edit-section="dimensions"]').click();
  await expect(page).toHaveURL(/#step-3$/);
  await assertSingleOwnership();
});

test("a rejected dimension edit preserves the last accepted scene and names the diagnostic", async ({ page }) => {
  await openFreshProject(page);
  await continueToCustomization(page);
  const canvas = await expectAcceptedScene(page);
  const acceptedGeometry = await canvas.getAttribute("data-geometry-fingerprint");
  const acceptedSpecification = await canvas.getAttribute("data-specification-fingerprint");
  const wallWidth = page.locator('[data-measurement="wallWidth"]');
  await wallWidth.fill("");
  await expect(page.locator("[data-transaction-diagnostic]")).toBeVisible();
  await expect(page.locator("[data-transaction-diagnostic]")).toContainText("Last accepted design preserved");
  await expect(page.locator("[data-transaction-diagnostic]")).toContainText(
    "Enter Wall Width, Ceiling Height, and Desired Built-In Depth"
  );
  await expect(page.locator("[data-transaction-diagnostic]")).not.toContainText("undefined");
  await expect(page.locator("[data-transaction-diagnostic]")).toContainText(/\([A-Z0-9_]+\)/);
  await expect(canvas).toHaveAttribute("data-geometry-fingerprint", acceptedGeometry);
  await expect(canvas).toHaveAttribute("data-specification-fingerprint", acceptedSpecification);
  await expect(page.locator(".guided-3d-canvas")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Save Project", exact: true }))
    .toHaveAttribute("data-persistence-state", "rejected-candidate");
  await page.locator("[data-continue]").click();
  await expect(page).toHaveURL(/#step-3$/);
  await expect(wallWidth).toBeFocused();
  await wallWidth.fill("121 1/2");
  await wallWidth.blur();
  await expect(page.locator("[data-transaction-diagnostic]")).toBeHidden();
});

test("fraction parsing, bounds guidance, and the compact measurement guide remain accessible", async ({ page }) => {
  await openFreshProject(page);
  await continueToCustomization(page, "window-wall");
  const width = page.locator('[data-measurement="wallWidth"]');
  await width.fill("121 1/2");
  await width.blur();
  await expect(width).toHaveValue("121.5");
  await width.fill("190");
  await expect(page.locator('[data-measurement-row="wallWidth"] .measurement-warning'))
    .toContainText("outside our usual");
  const windowWidth = page.locator('[data-measurement="windowWidth"]');
  await windowWidth.fill("about four feet");
  await expect(windowWidth).toHaveAttribute("aria-invalid", "");
  await expect(page.locator('[data-measurement-row="windowWidth"] .measurement-input-error'))
    .toContainText("decimal, or a common fraction");
  await expect(page.locator("[data-guided-app]"))
    .toHaveAttribute("data-measurement-timer-ownership", "0");
  const guide = page.locator("[data-measurement-guidance]");
  await guide.locator("summary").click();
  await expect(guide).toHaveAttribute("open", "");
  await expect(guide.locator(".measurement-room--static-guidance")).toBeVisible();
  await expect(guide.locator("canvas, [data-guided-3d-mount]")).toHaveCount(0);
  await expect(page.locator(".guided-3d-canvas")).toHaveCount(1);
});

test("finish and details update the accepted scene and Review without losing state", async ({ page }) => {
  await openFreshProject(page);
  await continueToCustomization(page);
  let canvas = await expectAcceptedScene(page);
  const instance = await canvas.getAttribute("data-guided-3d-instance");
  const geometryBefore = await canvas.getAttribute("data-geometry-fingerprint");
  const rebuildsBefore = await canvas.getAttribute("data-geometry-rebuild-count");
  const materialsBefore = Number(await canvas.getAttribute("data-material-update-count"));
  await page.getByRole("tab", { name: "Finish" }).click();
  await page.locator('[data-finish-key="paint"][data-finish="charcoal"]').click();
  canvas = page.locator(".guided-3d-canvas");
  await expect(canvas).toHaveAttribute("data-guided-3d-instance", instance);
  await expect(canvas).toHaveAttribute("data-geometry-fingerprint", geometryBefore);
  await expect(canvas).toHaveAttribute("data-geometry-rebuild-count", rebuildsBefore);
  await expect.poll(async () => Number(await canvas.getAttribute("data-material-update-count")))
    .toBeGreaterThan(materialsBefore);
  await page.getByRole("tab", { name: "Details" }).click();
  await page.locator('[data-detail-key="hardware"][data-detail="black-pull"]').click();
  await page.locator("[data-continue]").click();
  const summary = page.locator(".project-summary-card");
  await expect(summary.locator('[data-summary-value="product"]')).toHaveText("Cabinets + Shelves");
  await expect(summary.locator('[data-summary-value="layout"]')).toHaveText("Clear Wall");
  await expect(summary.locator('[data-summary-value="finish"]')).toHaveText("Charcoal");
  await expect(summary.locator('[data-summary-value="hardware"]')).toHaveText("Black Pull");
  await expect(page.locator(".guided-3d-canvas")).toHaveAttribute("data-guided-3d-instance", instance);
  await page.locator('[data-edit-section="finish"]').click();
  await expect(page.getByRole("tab", { name: "Finish" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('[data-finish-key="paint"][data-finish="charcoal"]'))
    .toHaveAttribute("aria-pressed", "true");
});

test("five-step drafts and stale hashes normalize while Back and Forward remain stable", async ({ page }) => {
  await seedStorage(page, { draft: legacyProject() });
  await page.goto("configurator.html#step-5", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/#step-4$/);
  await expect(page.getByRole("heading", { name: "Review your custom concept" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Project steps" }).getByRole("button")).toHaveCount(4);
  await page.locator('[data-edit-section="finish"]').click();
  await expect(page).toHaveURL(/#step-3$/);
  await page.goBack();
  await expect(page).toHaveURL(/#step-4$/);
  await page.goForward();
  await expect(page).toHaveURL(/#step-3$/);
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), DRAFT_KEY);
  expect(stored.schemaVersion).toBe(4);
  expect(stored.currentStep).toBe(3);
  expect(stored.maxVisitedStep).toBeLessThanOrEqual(4);
  expect(stored).toMatchObject({ category: "bookcase", style: "cabinet-base-shelves" });
});

test("an invalid legacy review position is capped at Customization", async ({ page }) => {
  await seedStorage(page, {
    draft: legacyProject({
      measurements: { wallWidth: null, ceilingHeight: 96, desiredDepth: 14 }
    })
  });
  await page.goto("configurator.html#step-5", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/#step-3$/);
  await expect(page.getByRole("heading", { name: "Customize your fitted design" })).toBeVisible();
  await expect(page.locator('[data-step="4"]')).toBeDisabled();
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), DRAFT_KEY);
  expect(stored.currentStep).toBe(3);
  expect(stored.maxVisitedStep).toBe(3);
});

test("save, reload, My Projects, rename, duplicate, delete, and resume retain state", async ({ page }) => {
  await openFreshProject(page);
  await continueToReview(page, "niche-layout");
  await page.locator("[data-save-project]").click();
  const saveDialog = page.locator("[data-save-dialog]");
  await saveDialog.getByLabel("Project name").fill("Park Avenue Library");
  await saveDialog.getByRole("button", { name: "Save Project", exact: true }).click();
  await expect(page.locator("[data-guided-toast]")).toContainText("saved on this device");
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Review your custom concept" })).toBeVisible();
  await expect(page.locator('[data-summary-value="layout"]')).toHaveText("Niche Layout");
  await page.getByRole("button", { name: "My Projects", exact: true }).click();
  const projectsDialog = page.locator("[data-projects-dialog]");
  await projectsDialog.getByRole("button", { name: "Duplicate Park Avenue Library" }).click();
  await expect(projectsDialog.locator(".saved-project")).toHaveCount(2);
  await projectsDialog.getByRole("button", { name: "Rename Park Avenue Library", exact: true }).click();
  await saveDialog.getByLabel("Project name").fill("Garden Library");
  await saveDialog.getByRole("button", { name: "Save Project", exact: true }).click();
  await expect(projectsDialog.getByText("Garden Library", { exact: true })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await projectsDialog.getByRole("button", { name: "Delete Park Avenue Library Copy" }).click();
  await expect(projectsDialog.locator(".saved-project")).toHaveCount(1);
  await projectsDialog.getByRole("button", { name: "Resume Garden Library" }).click();
  await expect(page.getByRole("heading", { name: "Review your custom concept" })).toBeVisible();
  await expect(page).toHaveURL(/project=JQ-.+#step-4$/);
});

test("the non-transmitting quote preview keeps verified project prefill and privacy boundaries", async ({ page }) => {
  await openFreshProject(page);
  await continueToReview(page);
  await page.getByRole("button", { name: "Request a Quote" }).click();
  const dialog = page.locator("[data-quote-dialog]");
  await expect(dialog).toContainText("Online submission is not connected");
  await dialog.getByRole("button", { name: "Prepare Email Request" }).click();
  await expect(dialog.locator("[data-quote-error]")).toContainText("required contact details");
  await fillQuoteContact(dialog);
  await dialog.getByRole("button", { name: "Prepare Email Request" }).click();
  await expect(dialog.locator("[data-quote-mode]")).toContainText("email draft is ready");
  await expect(dialog.locator("[data-email-fallback]")).toHaveAttribute("href", /Cabinets%20%2B%20Shelves/);
  await expect(dialog.locator("[data-email-fallback]")).toHaveAttribute("href", /Clear%20Wall/);
});

test("renderer failure is visible and fail-closed without substituting a photograph", async ({ page }) => {
  await page.route("**/guided-configurator-3d.js*", (route) => route.fulfill({
    contentType: "text/javascript",
    body: 'export function createGuidedSceneController() { throw new Error("WebGL unavailable in fail-closed test"); }'
  }));
  await openFreshProject(page);
  await continueToCustomization(page);
  const preview = page.locator(".concept-preview");
  const scene = preview.locator('.concept-scene[data-guided3d-state="fallback"]');
  await expect(scene).toBeVisible();
  await expect(scene.locator("[data-guided-engine-status] strong")).toHaveText("3D preview unavailable");
  await expect(scene.locator("[data-guided-engine-status]")).toContainText(
    "failed closed; no unrelated product or room image was substituted"
  );
  await expect(preview.locator("canvas, img.concept-photo, [data-published-preview-image]")).toHaveCount(0);
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Review your custom concept" })).toBeVisible();
  await expect(page.locator('.concept-scene[data-guided3d-state="fallback"]')).toBeVisible();
});

test("keyboard and focus behavior covers cards, tabs, completed steps, and menu dismissal", async ({ page }) => {
  await openFreshProject(page);
  const product = page.locator('[data-product-choice="cabinet-shelves"]');
  await product.focus();
  await page.keyboard.press("Space");
  await expect(product).toHaveAttribute("aria-pressed", "true");
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Choose the layout that matches your space" })).toBeFocused();
  const layout = page.locator('[data-layout="niche-layout"]');
  await layout.focus();
  await page.keyboard.press("Enter");
  await expect(layout).toHaveAttribute("aria-pressed", "true");
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Customize your fitted design" })).toBeFocused();
  const dimensions = page.getByRole("tab", { name: "Dimensions" });
  await dimensions.focus();
  await dimensions.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Finish" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Finish" }).press("End");
  await expect(page.getByRole("tab", { name: "Details" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: /Choose Layout, completed/ }).click();
  await expect(page.getByRole("heading", { name: "Choose the layout that matches your space" })).toBeVisible();
  const menuButton = page.getByRole("button", { name: "Open menu" });
  await menuButton.click();
  await expect(page.getByRole("navigation", { name: "Configurator menu" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("navigation", { name: "Configurator menu" })).toBeHidden();
  await expect(menuButton).toBeFocused();
});

test("desktop, tablet, and phone Customization layouts are overflow-free and keep the preview useful", async ({ page }) => {
  for (const viewport of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "tablet", width: 1024, height: 768 },
    { name: "phone", width: 390, height: 844 }
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openFreshProject(page);
    await continueToCustomization(page, "window-wall");
    await expectAcceptedScene(page);
    const geometry = await page.evaluate(() => {
      const preview = document.querySelector(".concept-preview").getBoundingClientRect();
      const controls = document.querySelector(".customization-controls-column").getBoundingClientRect();
      const actions = [...document.querySelectorAll(".customization-actions .guided-button")]
        .map((button) => button.getBoundingClientRect());
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        preview: { top: preview.top, bottom: preview.bottom, width: preview.width, height: preview.height },
        controls: { top: controls.top, width: controls.width },
        actionMinHeight: Math.min(...actions.map(({ height }) => height))
      };
    });
    expect(geometry.overflow, viewport.name).toBeLessThanOrEqual(1);
    expect(geometry.preview.width, viewport.name).toBeGreaterThan(viewport.name === "phone" ? 340 : 480);
    expect(geometry.preview.height, viewport.name).toBeGreaterThanOrEqual(viewport.name === "phone" ? 360 : 490);
    expect(geometry.actionMinHeight, viewport.name).toBeGreaterThanOrEqual(44);
    if (viewport.name === "desktop") {
      expect(geometry.preview.bottom).toBeLessThanOrEqual(viewport.height + 1);
      expect(geometry.preview.width).toBeGreaterThan(geometry.controls.width);
      await page.screenshot({
        path: "test-results/public-four-step-configurator-customization-desktop.png",
        fullPage: true
      });
    }
    if (viewport.name === "phone") expect(geometry.preview.top).toBeLessThan(geometry.controls.top);
  }
});

test("the supported four-step path has no serious accessibility violations", async ({ page }) => {
  await openFreshProject(page);
  let results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(results.violations.filter(({ impact }) => ["critical", "serious"].includes(impact))).toEqual([]);
  await continueToCustomization(page, "door-wall");
  await expectAcceptedScene(page);
  results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(results.violations.filter(({ impact }) => ["critical", "serious"].includes(impact))).toEqual([]);
});

test("the complete public flow makes no forbidden remote or preview-matrix requests", async ({ page }) => {
  const runtime = monitorRuntime(page);
  const remoteRequests = [];
  const matrixRequests = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) remoteRequests.push(request.url());
    if (url.pathname.includes("/assets/photos/configurator/photoreal-matrix/")) matrixRequests.push(request.url());
  });
  await openFreshProject(page);
  await continueToReview(page, "double-opening");
  await expectAcceptedScene(page);
  expect(remoteRequests).toEqual([]);
  expect(matrixRequests).toEqual([]);
  expect(runtime).toEqual([]);
});
