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
import { IMMERSIVE_LAYOUT_ORDER, IMMERSIVE_LAYOUT_REGISTRY, millimetersToInches } from "../guided-layout-registry.js";

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
  const expected = IMMERSIVE_LAYOUT_REGISTRY["window-wall"];
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
  await page.locator('[data-edit-section="finish"]').click();
  await expect(page).toHaveURL(/#step-3$/);
  await page.goBack();
  await expect(page).toHaveURL(/#step-4$/);
  await page.goForward();
  await expect(page).toHaveURL(/#step-3$/);
});

test("character-by-character dimension input canonicalizes only on commit and reaches Review", async ({ page }) => {
  const failures = monitorRuntime(page);
  await openFreshProject(page);
  await continueToCustomization(page);
  await page.getByRole("button", { name: "Dimensions", exact: true }).click();
  await page.locator("[data-dimension-handle]").click();
  const smart = page.locator(`[data-smart-dimension="${CONTROL_ID}"]`);
  await smart.click();
  await smart.selectText();
  await smart.press("Backspace");
  await smart.pressSequentially("12.5");
  await expect(smart).toHaveValue("12.5");
  await smart.blur();
  await expect(smart).toHaveValue("12.45");
  await page.locator('[data-dimension-field="wallWidth"]').click();
  const wall = page.locator('[data-measurement="wallWidth"]');
  await wall.fill("150");
  await wall.blur();
  await wall.fill("152");
  await wall.blur();
  await expect(page.locator("[data-guided-engine-title]")).toHaveCount(1);
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Review your project details" })).toBeVisible();
  await expect(page.locator(`[data-summary-value="smartDimension:${CONTROL_ID}"]`)).toContainText("12 7/16 in");
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

test("contextual project dimensions and saved Finish and Options choices reach Review", async ({ page }) => {
  const failures = monitorRuntime(page);
  await openFreshProject(page);
  const runtime = await continueToCustomization(page, "door-wall");
  await expect(page.locator("[data-customization-mode-panel]")).toHaveCount(0);
  await page.getByRole("button", { name: "Dimensions", exact: true }).click();
  await page.getByRole("button", { name: "Project dimensions", exact: true }).click();
  const dimensions = page.locator("[data-room-measurements]");
  await expect(dimensions).toBeVisible();
  await expect(dimensions.locator("summary")).toHaveCount(0);
  for (const fieldId of [
    "wallWidth",
    "ceilingHeight",
    "desiredDepth",
    "lowerCabinetHeight",
    "lowerCabinetDepth",
    "upperBookcaseDepth",
    "toeKickHeight",
    "topFasciaHeight",
    "doorWidth",
    "doorHeight",
    "doorLeftDistance",
    "doorTrimWidth",
    "doorSwing"
  ]) {
    await expect(page.locator(`[data-dimension-field="${fieldId}"]`)).toBeVisible();
  }
  await page.locator('[data-dimension-field="lowerCabinetHeight"]').click();
  const lowerHeight = page.locator('[data-measurement="lowerCabinetHeight"]');
  await lowerHeight.fill("35 1/2");
  await lowerHeight.blur();
  await expect(lowerHeight).toHaveValue("35.5");
  await expect(page.locator(".automatic-engineering-note")).toContainText("1.25-inch countertop");

  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Shop-Primed", exact: true }).click();
  await expect(runtime).toHaveAttribute("data-state", "ready");
  await expect(page.locator(".immersive-viewer-surface")).not.toHaveAttribute("data-guided3d-state", "finish-error");

  await page.getByRole("button", { name: "Options", exact: true }).click();
  await page.getByRole("button", { name: /Flat Panel/ }).click();
  await page.getByRole("button", { name: /Black Pull/ }).click();
  await page.getByRole("button", { name: /Integrated LED/ }).click();
  await page.getByRole("button", { name: /Recessed toe kick/ }).click();
  await page.getByRole("button", { name: /Dykes crown profile/ }).click();
  await page.locator("[data-continue]").click();

  await expect(page.getByRole("heading", { name: "Review your project details" })).toBeVisible();
  await expect(page.locator('[data-summary-value="lowerCabinetHeight"]')).toHaveText("35 1/2 in");
  await expect(page.locator('[data-summary-value="finish"]')).toHaveText("Shop-Primed");
  await expect(page.locator('[data-summary-value="doorStyle"]')).toHaveText("Flat Panel");
  await expect(page.locator('[data-summary-value="hardware"]')).toHaveText("Black Pull");
  await expect(page.locator('[data-summary-value="lighting"]')).toHaveText("Integrated LED");
  await expect(page.locator('[data-summary-value="baseStyle"]')).toContainText("Recessed toe kick");
  await expect(page.locator('[data-summary-value="topTreatment"]')).toHaveText("Dykes crown profile");
  await page.locator('[data-edit-section="finish"]').click();
  await expect(page.getByRole("button", { name: "Finish", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Shop-Primed", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(failures).toEqual([]);
});

test("save and reload retain the selected layout and smart dimension", async ({ page }) => {
  await openFreshProject(page);
  await continueToCustomization(page, "window-wall");
  await page.getByRole("button", { name: "Dimensions", exact: true }).click();
  await page.locator("[data-dimension-handle]").click();
  const control = IMMERSIVE_LAYOUT_REGISTRY["window-wall"].geometryControlManifest[CONTROL_ID];
  const inches = millimetersToInches(control.maxMillimeters).toFixed(2);
  const input = page.locator(`[data-smart-dimension="${CONTROL_ID}"]`);
  await input.fill(inches);
  await input.blur();
  await page.locator("[data-continue]").click();
  await page.locator("[data-save-project]").click();
  const saveDialog = page.locator("[data-save-dialog]");
  await saveDialog.getByLabel("Project name").fill("Park Avenue Window Wall");
  await saveDialog.getByRole("button", { name: "Save Project", exact: true }).click();
  await expect(page.locator("[data-guided-toast]")).toContainText("saved on this device");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Review your project details" })).toBeVisible();
  await expect(page.locator('[data-summary-value="layout"]')).toHaveText("Window Wall");
  await expect(page.locator(`[data-summary-value="smartDimension:${CONTROL_ID}"]`)).toContainText(`${Number(inches)} in`);
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
  expect(models).toEqual([IMMERSIVE_LAYOUT_REGISTRY["fireplace-wall"].runtimeAsset.path]);
  expect(forbidden).toEqual([]);
  expect(failures).toEqual([]);
});
