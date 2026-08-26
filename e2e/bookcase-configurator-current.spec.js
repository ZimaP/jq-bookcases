import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  PRODUCT_CHOICES,
  PUBLIC_CONFIGURATOR_PRODUCT_ID,
  PUBLIC_CONFIGURATOR_PRODUCT_IDS
} from "../guided-configurator-data.js";
import {
  GUIDED_DRAFT_STORAGE_KEY,
  GUIDED_PROJECT_SCHEMA_VERSION,
  GUIDED_PROJECTS_STORAGE_KEY
} from "../guided-configurator-state.js";
import { IMMERSIVE_LAYOUT_ORDER, IMMERSIVE_LAYOUT_REGISTRY, getImmersiveLayout } from "../guided-layout-registry.js";

const CONTROL_ID = "adjustable-shelf-clearance";

function monitorRuntime(page) {
  const failures = [];
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console: ${message.text()}`);
  });
  page.on("requestfailed", (request) => failures.push(`request: ${request.url()} ${request.failure()?.errorText || "failed"}`));
  page.on("response", (response) => {
    if (response.status() >= 400 && !response.url().endsWith("/api/quote")) failures.push(`response: ${response.status()} ${response.url()}`);
  });
  return failures;
}

async function openFreshProject(page) {
  await page.goto("configurator.html?start=new", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Choose your product" })).toBeVisible();
  await expect(page).toHaveURL(/#step-1$/);
}

async function chooseProduct(page) {
  const product = page.locator(`[data-product-choice="${PUBLIC_CONFIGURATOR_PRODUCT_ID}"]`);
  await product.click();
  await expect(product).toHaveAttribute("aria-pressed", "true");
}

async function continueToLayouts(page) {
  await chooseProduct(page);
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Choose the layout that matches your space" })).toBeVisible();
}

async function continueToCustomization(page, layoutId = "fireplace-wall") {
  await continueToLayouts(page);
  const layout = page.locator(`[data-layout="${layoutId}"]`);
  await layout.click();
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Customize your space" })).toBeAttached();
  const runtime = page.locator("[data-layout-viewer]");
  await expect(runtime).toHaveAttribute("data-layout-id", layoutId, { timeout: 30_000 });
  await expect(runtime).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
  return runtime;
}

async function continueToReview(page, layoutId = "fireplace-wall") {
  const runtime = await continueToCustomization(page, layoutId);
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Review your project details" })).toBeVisible();
  await expect(page.locator("[data-guided-engine-status]")).toBeHidden();
  await expect(page).toHaveURL(/#step-4$/);
  await expect(runtime).toHaveAttribute("data-state", "ready");
}

function legacyProject(overrides = {}) {
  return {
    schemaVersion: 4,
    projectId: "JQ-LEGACY-IMMERSIVE",
    projectName: "Legacy saved project",
    currentStep: 5,
    maxVisitedStep: 5,
    category: "bookcase",
    productSelected: true,
    layout: "fireplace-wall",
    measurements: {
      wallWidth: 144,
      ceilingHeight: 96,
      desiredDepth: 14,
      fireplaceWidth: 42,
      fireplaceHeight: 32,
      mantelWidth: 60,
      mantelHeight: 48,
      fireplaceDepth: 8,
      tvAboveFireplace: "no"
    },
    style: "cabinet-base-shelves",
    finish: "natural-oak",
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
    draftKey: GUIDED_DRAFT_STORAGE_KEY,
    projectsKey: GUIDED_PROJECTS_STORAGE_KEY,
    draftValue: draft,
    projectValues: projects
  });
}

async function expectNoSeriousAxeViolations(page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(results.violations.filter(({ impact }) => ["critical", "serious"].includes(impact))).toEqual([]);
}

test("authorization exposes seven products, three layouts, and four steps without activating unavailable products", async ({ page }) => {
  const failures = monitorRuntime(page);
  await openFreshProject(page);
  await expect(page.getByRole("navigation", { name: "Project steps" }).getByRole("button")).toHaveCount(4);
  await expect(page.locator("[data-product-choice], [data-unavailable-product-choice]")).toHaveCount(7);
  for (const product of PRODUCT_CHOICES.filter(({ id }) => !PUBLIC_CONFIGURATOR_PRODUCT_IDS.includes(id))) {
    const card = page.locator(`[data-unavailable-product-choice="${product.id}"]`);
    await expect(card).toHaveAttribute("aria-disabled", "true");
    await expect(card).not.toHaveAttribute("disabled", "");
    await card.focus();
    await card.press("Enter");
    await expect(page.locator("[data-continue]")).toBeDisabled();
  }
  await continueToLayouts(page);
  await expect(page.locator("[data-layout]")).toHaveCount(3);
  expect(await page.locator("[data-layout]").evaluateAll((nodes) => nodes.map((node) => node.dataset.layout))).toEqual(IMMERSIVE_LAYOUT_ORDER);
  expect(failures).toEqual([]);
});

test("Window Storage preselects only Window Wall and preserves its exact authoritative journey", async ({ page }) => {
  const failures = monitorRuntime(page);
  const expected = getImmersiveLayout("window-wall");
  const modelRequests = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.endsWith(expected.runtimeAsset.path)) modelRequests.push(request.url());
  });
  await openFreshProject(page);
  const product = page.locator('[data-product-choice="window-storage"]');
  await product.click();
  await expect(product).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-continue]")).toBeEnabled();
  await page.locator("[data-continue]").click();
  await expect(page.locator("[data-layout]")).toHaveCount(1);
  const layout = page.locator('[data-layout="window-wall"]');
  await expect(layout).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-continue]")).toBeEnabled();
  expect(modelRequests).toEqual([]);

  await page.locator("[data-continue]").click();
  const runtime = page.locator("[data-layout-viewer]");
  await expect(runtime).toHaveAttribute("data-layout-id", "window-wall", { timeout: 30_000 });
  await expect(runtime).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
  await expect(runtime).toHaveAttribute("data-geometry-immutable", "true");
  const record = await page.evaluate(() => globalThis.__JQ_LAYOUT_VIEWER_DIAGNOSTICS__);
  expect(record.assetPath).toBe(expected.runtimeAsset.path);
  expect(record.assetBytes).toBe(expected.runtimeAsset.bytes);
  expect(record.assetSha256).toBe(expected.runtimeAsset.sha256);
  expect(record.ownership.parsedRoots).toBe(1);
  expect(modelRequests).toHaveLength(1);
  await expect(page.locator("[data-guided-3d-mount] img")).toHaveCount(0);

  await page.locator("[data-continue]").click();
  await expect(page.locator('[data-summary-value="product"]')).toHaveText("Window Storage");
  await expect(page.locator('[data-summary-value="layout"]')).toHaveText("Window Wall");
  await expect.poll(() => page.evaluate((key) => {
    const draft = JSON.parse(localStorage.getItem(key) || "null");
    return [draft?.category, draft?.style, draft?.layout];
  }, GUIDED_DRAFT_STORAGE_KEY)).toEqual(["window-storage", "window-seat-storage", "window-wall"]);
  expect(failures).toEqual([]);
});

test("query, hash, preset, and unsupported saved data cannot activate unavailable products", async ({ page }) => {
  const unsupported = legacyProject({
    projectId: "JQ-UNSUPPORTED-SAVED",
    projectName: "Saved media room",
    category: "tv-unit",
    style: "framed-tv-wall"
  });
  await seedStorage(page, { draft: unsupported, projects: [unsupported] });
  await page.goto("configurator.html?product=tv-unit&preset=media-wall#step-5", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/#step-1$/);
  await expect(page.locator("[data-unavailable-product]")).toContainText(/not available|remains/i);
  await expect(page.locator("[data-continue]")).toBeDisabled();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key))[0].projectId, GUIDED_PROJECTS_STORAGE_KEY)).toBe("JQ-UNSUPPORTED-SAVED");
  await chooseProduct(page);
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "null")?.projectId, GUIDED_DRAFT_STORAGE_KEY)).not.toBe("JQ-UNSUPPORTED-SAVED");
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key))[0].projectId, GUIDED_PROJECTS_STORAGE_KEY)).toBe("JQ-UNSUPPORTED-SAVED");
});

test("schema-four drafts migrate to schema five with isolated layout state and stable history", async ({ page }) => {
  await seedStorage(page, { draft: legacyProject() });
  await page.goto("configurator.html#step-5", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/#step-4$/);
  await expect(page.getByRole("heading", { name: "Review your project details" })).toBeVisible();
  await expect(page.locator("[data-layout-viewer]")).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
  const migrated = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), GUIDED_DRAFT_STORAGE_KEY);
  expect(migrated.schemaVersion).toBe(GUIDED_PROJECT_SCHEMA_VERSION);
  expect(Object.keys(migrated.layoutStates).sort()).toEqual([...IMMERSIVE_LAYOUT_ORDER].sort());
  for (const layoutId of IMMERSIVE_LAYOUT_ORDER) {
    expect(migrated.layoutStates[layoutId].smartDimensions[CONTROL_ID]).toBeCloseTo(
      IMMERSIVE_LAYOUT_REGISTRY[layoutId].geometryControlManifest[CONTROL_ID].nativeMillimeters,
      5
    );
  }
  await page.locator('[data-edit-section="details"]').click();
  await expect(page).toHaveURL(/#step-3$/);
  await page.goBack();
  await expect(page).toHaveURL(/#step-4$/);
  await page.goForward();
  await expect(page).toHaveURL(/#step-3$/);
});

test("the one-screen measurement editor canonicalizes input and reaches Review without shelf setup", async ({ page }) => {
  const failures = monitorRuntime(page);
  await openFreshProject(page);
  await continueToCustomization(page);
  await expect(page.locator("[data-customization-direct-panel]")).toHaveAttribute("data-customization-view", "overview");
  await expect(page.locator("[data-dimension-handle]")).toBeHidden();
  await expect(page.locator("[data-smart-dimension], [data-customization-mode-control]")).toHaveCount(0);
  await page.locator("[data-edit-fit]").click();
  await expect(page.getByRole("heading", { name: "Measurements in one place." })).toBeVisible();
  const wall = page.locator('[data-measurement="wallWidth"]');
  await wall.click();
  await wall.selectText();
  await wall.press("Backspace");
  await wall.pressSequentially("128.5");
  await expect(wall).toHaveValue("128.5");
  await wall.blur();
  await expect(wall).toHaveValue("128.5");
  await page.locator("[data-save-fit]").click();
  await expect(page.locator("[data-customization-direct-panel]")).toHaveAttribute("data-customization-view", "overview");
  await expect(page.locator("[data-guided-engine-title]")).toHaveCount(1);
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Review your project details" })).toBeVisible();
  await expect(page.locator('[data-summary-value="wallWidth"]')).toHaveText("128 1/2 in");
  await expect(page.locator(`[data-summary-value="smartDimension:${CONTROL_ID}"]`)).toHaveCount(0);
  await expect(page.getByText("Adjustable shelf clearance", { exact: true })).toHaveCount(0);
  expect(failures).toEqual([]);
});

test("Step 1 uses unavailable language and exposes all seven primary image cards", async ({ page }) => {
  await openFreshProject(page);
  const cards = page.locator(".product-grid--catalog .product-card");
  await expect(cards).toHaveCount(7);
  await expect(cards.locator(".product-card-title")).toHaveText(PRODUCT_CHOICES.map(({ label }) => label));
  await expect(cards.locator("img")).toHaveCount(7);
  await expect(cards.locator(".product-availability-badge")).toHaveText([
    "Available now",
    ...Array(4).fill("Not available yet"),
    "Available now",
    "Not available yet"
  ]);
  await expect(page.getByText("More Fitted Furniture Previews", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Coming soon/i)).toHaveCount(0);

  const unavailable = page.locator('[data-unavailable-product-choice="tv-unit"]');
  await unavailable.click({ force: true });
  await expect(unavailable).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("[data-continue]")).toBeDisabled();
  await expect(page.locator("[data-guided-toast]")).toContainText("not available yet");
});

test("direct customization exposes only relevant dimensions and its few buildable choices", async ({ page }) => {
  const failures = monitorRuntime(page);
  await openFreshProject(page);
  const runtime = await continueToCustomization(page, "door-wall");
  await expect(page.locator("[data-customization-mode-control], [data-customization-mode-panel]")).toHaveCount(0);
  await expect(page.locator('[data-direct-choice-group="baseStyle"] .direct-choice')).toHaveCount(2);
  await expect(page.locator('[data-direct-choice-group="doorStyle"] .direct-choice')).toHaveCount(3);
  await expect(page.locator('[data-direct-choice-group="topTreatment"] .direct-choice')).toHaveCount(2);
  await expect(page.locator('[data-direct-choice-group="lighting"] .direct-choice')).toHaveCount(2);
  await expect(page.locator('[data-direct-choice-group="finish"] [data-finish]')).toHaveCount(11);
  await expect(page.locator('[data-finish="natural-oak"]')).toHaveAttribute("aria-pressed", "true");

  await page.locator("[data-edit-fit]").click();
  const dimensions = page.locator("[data-room-measurements]");
  await expect(dimensions).toBeVisible();
  await expect(dimensions.locator("summary")).toHaveCount(0);
  for (const fieldId of [
    "wallWidth",
    "ceilingHeight",
    "desiredDepth",
    "doorWidth",
    "doorHeight",
    "doorLeftDistance",
    "doorTrimWidth",
    "doorSwing"
  ]) {
    await expect(page.locator(`[data-measurement="${fieldId}"]`)).toBeVisible();
  }
  for (const hiddenFieldId of ["lowerCabinetHeight", "lowerCabinetDepth", "upperBookcaseDepth", "toeKickHeight", "topFasciaHeight"]) {
    await expect(page.locator(`[data-measurement="${hiddenFieldId}"]`)).toHaveCount(0);
  }
  const doorWidth = page.locator('[data-measurement="doorWidth"]');
  await doorWidth.fill("38 1/2");
  await doorWidth.blur();
  await expect(doorWidth).toHaveValue("38.5");
  await page.locator("[data-save-fit]").click();

  await page.locator('[data-detail-key="doorStyle"][data-detail="flat-panel"]').click();
  await page.locator('[data-detail-key="lighting"][data-detail="warm-led"]').click();
  await page.locator('[data-finish="charcoal"]').click();
  await expect(page.locator('[data-finish="charcoal"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator('[data-detail-key="baseStyle"][data-detail="recessed-toe-kick"]').click();
  await expect(page.locator("[data-toe-kick-control]")).toBeVisible();
  await page.locator('[data-measurement-adjust="toeKickHeight"][data-measurement-delta="0.5"]').click();
  await page.locator('[data-measurement-adjust="toeKickHeight"][data-measurement-delta="0.5"]').click();
  await expect(page.locator("[data-toe-kick-control] output")).toHaveText("5 in");
  await page.locator('[data-detail-key="topTreatment"][data-detail="small-crown"]').click();
  await expect(page.locator("[data-standard-change-count]")).toHaveAttribute("data-standard-change-count", "5");
  await expect(runtime).toHaveAttribute("data-state", "ready");
  await page.locator("[data-continue]").click();

  await expect(page.getByRole("heading", { name: "Review your project details" })).toBeVisible();
  await expect(page.locator('[data-summary-value="doorWidth"]')).toHaveText("38 1/2 in");
  await expect(page.locator('[data-summary-value="finish"]')).toHaveText("Charcoal");
  await expect(page.locator('[data-summary-value="doorStyle"]')).toHaveText("Flat Panel");
  await expect(page.locator('[data-summary-value="hardware"]')).toHaveCount(0);
  await expect(page.locator('[data-summary-value="lighting"]')).toHaveText("Warm LED");
  await expect(page.locator('[data-summary-value="baseStyle"]')).toContainText("Recessed toe kick");
  await expect(page.locator('[data-summary-value="topTreatment"]')).toHaveText("Small crown");
  await expect(page.locator('[data-summary-value="toeKickHeight"]')).toHaveCount(0);
  await page.locator('[data-edit-section="details"]').click();
  await expect(page.locator('[data-detail-key="doorStyle"][data-detail="flat-panel"]')).toHaveAttribute("aria-pressed", "true");
  expect(failures).toEqual([]);
});

test("save and reload retain the selected layout, room fit, and direct choices", async ({ page }) => {
  await openFreshProject(page);
  await continueToCustomization(page, "window-wall");
  await page.locator("[data-edit-fit]").click();
  await page.locator('[data-measurement="wallWidth"]').fill("132");
  await page.locator('[data-measurement="wallWidth"]').blur();
  await page.locator("[data-save-fit]").click();
  await page.locator('[data-detail-key="doorStyle"][data-detail="slab"]').click();
  await page.locator('[data-detail-key="lighting"][data-detail="warm-led"]').click();
  await page.locator("[data-continue]").click();
  await page.locator("[data-save-project]").click();
  const saveDialog = page.locator("[data-save-dialog]");
  await saveDialog.getByLabel("Project name").fill("Park Avenue Window Wall");
  await saveDialog.getByRole("button", { name: "Save Project", exact: true }).click();
  await expect(page.locator("[data-guided-toast]")).toContainText("saved on this device");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Review your project details" })).toBeVisible();
  await expect(page.locator('[data-summary-value="layout"]')).toHaveText("Window Wall");
  await expect(page.locator('[data-summary-value="wallWidth"]')).toHaveText("132 in");
  await expect(page.locator('[data-summary-value="doorStyle"]')).toHaveText("Slab");
  await expect(page.locator('[data-summary-value="lighting"]')).toHaveText("Warm LED");
  await expect(page.locator(`[data-summary-value="smartDimension:${CONTROL_ID}"]`)).toHaveCount(0);
  await page.getByRole("button", { name: "My Projects", exact: true }).click();
  await expect(page.locator("[data-projects-dialog]").getByText("Park Avenue Window Wall", { exact: true })).toBeVisible();
});

test("quote preparation validates contact fields and keeps transmission under user control", async ({ page }) => {
  await openFreshProject(page);
  await continueToReview(page);
  await page.getByRole("button", { name: "Request a Quote" }).click();
  const dialog = page.locator("[data-quote-dialog]");
  await expect(dialog).toContainText("Online submission is not connected");
  await dialog.getByRole("button", { name: "Prepare Email Request" }).click();
  await expect(dialog.locator("[data-quote-error]")).toContainText("required contact details");
  for (const [name, value] of Object.entries({ fullName: "Alex Morgan", email: "alex@example.com", phone: "5165550188", zip: "11570" })) {
    await dialog.locator(`[name="${name}"]`).fill(value);
  }
  await dialog.getByRole("button", { name: "Prepare Email Request" }).click();
  await expect(dialog.locator("[data-quote-mode]")).toContainText("email draft is ready");
  await expect(dialog.locator("[data-email-fallback]")).toHaveAttribute("href", /Cabinets%20%2B%20Shelves/);
  await expect(dialog.locator("[data-email-fallback]")).toHaveAttribute("href", /Fireplace%20Wall/);
});

test("Step 3 unmount and browser history restore one clean current controller", async ({ page }) => {
  const failures = monitorRuntime(page);
  await openFreshProject(page);
  await continueToCustomization(page, "door-wall");
  await page.locator('[data-step="2"]').click();
  await expect(page.locator("[data-layout-viewer]")).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/#step-3$/);
  await expect(page.locator("[data-layout-viewer]")).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
  await expect(page.locator("[data-layout-viewer] canvas")).toHaveCount(1);
  expect(failures).toEqual([]);
});

test("Step 1, Step 2, normal Step 3, and Review have no serious accessibility violations", async ({ page }) => {
  test.slow();
  await openFreshProject(page);
  await expectNoSeriousAxeViolations(page);
  await continueToLayouts(page);
  await expectNoSeriousAxeViolations(page);
  await page.locator('[data-layout="fireplace-wall"]').click();
  await page.locator("[data-continue]").click();
  await expect(page.locator("[data-layout-viewer]")).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
  await expectNoSeriousAxeViolations(page);
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Review your project details" })).toBeVisible();
  await expectNoSeriousAxeViolations(page);
});

test("the complete flow stays same-origin and never loads retired renderers", async ({ page }) => {
  const failures = monitorRuntime(page);
  const remote = [];
  const models = [];
  const forbidden = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol !== "blob:" && !["127.0.0.1", "localhost"].includes(url.hostname)) remote.push(request.url());
    if (url.pathname.endsWith(".glb")) models.push(url.pathname.replace(/^\//, ""));
    if (/photoreal-matrix|guided-room2-viewer|guided-configurator-3d|vivid/i.test(url.pathname)) forbidden.push(request.url());
  });
  await openFreshProject(page);
  await continueToReview(page);
  expect(remote).toEqual([]);
  expect(models).toEqual([getImmersiveLayout("fireplace-wall").runtimeAsset.path]);
  expect(forbidden).toEqual([]);
  expect(failures).toEqual([]);
});
