import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  PUBLIC_CONFIGURATOR_COMING_SOON_CHOICES,
  PUBLIC_CONFIGURATOR_COMING_SOON_LAYOUTS,
  PUBLIC_CONFIGURATOR_LAYOUT_ID,
  PUBLIC_CONFIGURATOR_PRODUCT_CHOICES,
  SHARED_ROOM_LAYOUTS,
  getMeasurementFields
} from "../guided-configurator-data.js";

const ACTIVE_PRODUCT = PUBLIC_CONFIGURATOR_PRODUCT_CHOICES[0];
const ACTIVE_LAYOUT_ID = PUBLIC_CONFIGURATOR_LAYOUT_ID;
const ROOM2_SHA256 = "251af4f7cb669976dec9dcaa46905982f9ae085b7bfb30e27e1bf9900a01a8d5";
const ROOM2_GEOMETRY_FINGERPRINT = "8762fe4326e22e46a163343e5fde410e231d651b48d1b1c9be8391febec8f6ff";
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

async function chooseLayout(page, layoutId = ACTIVE_LAYOUT_ID) {
  const card = page.locator(`[data-layout="${layoutId}"]`);
  await card.click();
  await expect(card).toHaveAttribute("aria-pressed", "true");
}

async function continueToCustomization(page, layoutId = ACTIVE_LAYOUT_ID) {
  await continueToLayouts(page);
  await chooseLayout(page, layoutId);
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Plan details beside the Room 2 reference" })).toBeVisible();
  await expect(page).toHaveURL(/#step-3$/);
  await expect(page.getByRole("tab", { name: "Dimensions" })).toHaveAttribute("aria-selected", "true");
}

async function expectAcceptedScene(page) {
  const preview = page.locator(".concept-preview");
  await expect(preview).toHaveCount(1);
  await expect(preview).toHaveAttribute("data-preview-render-mode", "fixed-room2-glb");
  await expect(preview.locator("[data-published-preview-image], picture.concept-photo, img.concept-photo")).toHaveCount(0);
  const canvas = preview.locator('.guided-room2-canvas[data-rendered="true"]');
  await expect(canvas).toHaveCount(1);
  await expect(canvas).toHaveAttribute("data-room2-scene-purpose", "fixed-room2-reference-glb");
  await expect(canvas).toHaveAttribute("data-room2-asset-sha256", ROOM2_SHA256);
  await expect(canvas).toHaveAttribute("data-room2-geometry-fingerprint", ROOM2_GEOMETRY_FINGERPRINT);
  await expect(canvas).toHaveAttribute("data-room2-request-count", "1");
  await expect(canvas).toHaveAttribute("data-room2-parse-count", "1");
  return canvas;
}

async function continueToReview(page, layoutId = ACTIVE_LAYOUT_ID) {
  await continueToCustomization(page, layoutId);
  await expectAcceptedScene(page);
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Review your project details" })).toBeVisible();
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
    layout: ACTIVE_LAYOUT_ID,
    measurements: {
      wallWidth: 120,
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
  await expect(saved).toContainText("Product unavailable in this public preview");
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

test("only the authorized Cabinets + Shelves / Fireplace Wall path is selectable", async ({ page }) => {
  await openFreshProject(page);
  await continueToLayouts(page);
  const renderedLayoutIds = await page.locator("[data-layout]").evaluateAll(
    (cards) => cards.map((card) => card.dataset.layout)
  );
  expect(renderedLayoutIds).toEqual([ACTIVE_LAYOUT_ID]);
  await expect(page.locator("[data-layout]:disabled")).toHaveCount(0);
  await expect(page.locator("[data-coming-soon-layout]")).toHaveCount(PUBLIC_CONFIGURATOR_COMING_SOON_LAYOUTS.length);
  expect(await page.locator("[data-coming-soon-layout]").evaluateAll(
    (cards) => cards.every((card) => card.disabled)
  )).toBe(true);
  await chooseLayout(page);
  await expect(page.locator("[data-continue]")).toBeEnabled();
});

test("Choose Product and Choose Layout retain the accepted card compositions at every supported breakpoint", async ({ page }) => {
  for (const viewport of [
    { name: "desktop", width: 1440, height: 900, columns: 5, minCardWidth: 180 },
    { name: "reported tablet", width: 1280, height: 960, columns: 5, minCardWidth: 180 },
    { name: "tablet", width: 1024, height: 768, columns: 4, minCardWidth: 170 },
    { name: "phone", width: 390, height: 844, columns: 2, minCardWidth: 140 }
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openFreshProject(page);
    await expect(page.getByRole("heading", { name: "Choose your product" })).toBeVisible();
    await expect(page.locator(".available-product")).toHaveCount(1);
    await expect(page.locator(".product-card--primary")).toHaveCount(1);
    await expect(page.locator(".coming-soon-products")).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    await continueToLayouts(page);
    await expect(page.locator(".available-layout, .coming-soon-layouts, .layout-grid--available")).toHaveCount(0);
    await expect(page.locator(".layout-grid .layout-card")).toHaveCount(SHARED_ROOM_LAYOUTS.length);
    await expect(page.locator(".layout-grid .layout-card-title")).toHaveText(
      SHARED_ROOM_LAYOUTS.map(({ label }) => label)
    );

    const geometry = await page.locator(".layout-grid").evaluate((grid) => {
      const gridRect = grid.getBoundingClientRect();
      const cards = [...grid.querySelectorAll(".layout-card")];
      const cardRects = cards.map((card) => card.getBoundingClientRect());
      return {
        columns: getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length,
        gridWidth: gridRect.width,
        minCardWidth: Math.min(...cardRects.map(({ width }) => width)),
        maxCardWidth: Math.max(...cardRects.map(({ width }) => width)),
        horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    });
    expect(geometry.columns, viewport.name).toBe(viewport.columns);
    expect(geometry.gridWidth, `${viewport.name} full-width layout grid`).toBeGreaterThan(viewport.width * 0.82);
    expect(geometry.minCardWidth, `${viewport.name} usable layout cards`).toBeGreaterThanOrEqual(viewport.minCardWidth);
    expect(geometry.maxCardWidth - geometry.minCardWidth, `${viewport.name} equal layout cards`).toBeLessThan(2);
    expect(geometry.horizontalOverflow, viewport.name).toBeLessThanOrEqual(1);
  }
});

test("Coming soon layouts cannot activate through pointer, keyboard, preset, hash, or saved-state injection", async ({ page }) => {
  await openFreshProject(page);
  await continueToLayouts(page);
  const disabled = page.locator('[data-coming-soon-layout="clear-wall"]');
  await expect(disabled).toBeDisabled();
  await disabled.evaluate((button) => button.click());
  await disabled.dispatchEvent("click");
  await disabled.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Space");
  await expect(page.locator("[data-layout]")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("[data-continue]")).toBeDisabled();

  await page.goto("configurator.html?start=new&preset=lower-cabinets#step-4", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/#step-2$/);
  await expect(page.locator("[data-unavailable-layout]")).toContainText("Clear Wall is not available");
  await expect(page.locator(".guided-room2-canvas")).toHaveCount(0);

  const unsupportedLayout = legacyProject({
    projectId: "JQ-UNSUPPORTED-LAYOUT",
    projectName: "Saved clear wall",
    layout: "clear-wall"
  });
  await seedStorage(page, { draft: unsupportedLayout });
  await page.goto("configurator.html#step-4", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/#step-2$/);
  await expect(page.locator("[data-unavailable-layout]")).toContainText("saved measurements remain");
  await expect(page.locator(".guided-room2-canvas")).toHaveCount(0);
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), DRAFT_KEY);
  expect(stored).toMatchObject({ layout: "clear-wall", layoutAvailability: "unavailable" });
});

test("Fireplace Wall puts all applicable measurement fields inside Customization", async ({ page }) => {
  await openFreshProject(page);
  await continueToLayouts(page);
  await chooseLayout(page);
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Plan details beside the Room 2 reference" })).toBeVisible();
  const expectedFields = getMeasurementFields("bookcase", ACTIVE_LAYOUT_ID).map(({ id }) => id);
  const renderedFields = await page.locator("[data-measurement-row]").evaluateAll(
    (rows) => rows.map((row) => row.dataset.measurementRow)
  );
  expect(renderedFields).toEqual(expectedFields);
  await expect(page.locator("[data-measurement-guidance]")).toBeVisible();
  await expectAcceptedScene(page);
});

test("Customization immediately owns one controller, canvas, RAF, timer, and listener set", async ({ page }) => {
  await openFreshProject(page);
  await continueToCustomization(page);
  let canvas = await expectAcceptedScene(page);
  const instance = await canvas.getAttribute("data-guided3d-instance");
  const assertSingleOwnership = async () => {
    canvas = page.locator(".guided-3d-canvas");
    await expect(canvas).toHaveCount(1);
    await expect(canvas).toHaveAttribute("data-guided3d-instance", instance);
    const ownership = await canvas.evaluate((element) => ({
      renderFrame: Number(element.dataset.room2RenderFrameOwnership),
      resizeObserver: Number(element.dataset.room2ResizeObserverOwnership),
      resizeListener: Number(element.dataset.room2ResizeListenerOwnership),
      controlListener: Number(element.dataset.room2ControlListenerOwnership),
      canvas: Number(element.dataset.room2CanvasOwnership),
      renderer: Number(element.dataset.room2RendererOwnership),
      controller: Number(element.dataset.room2ControllerOwnership),
      parsedRoot: Number(element.dataset.room2ParsedRootOwnership)
    }));
    expect(ownership.renderFrame).toBeLessThanOrEqual(1);
    expect(ownership.resizeObserver + ownership.resizeListener).toBe(1);
    expect(ownership.controlListener).toBe(1);
    expect(ownership.canvas).toBe(1);
    expect(ownership.renderer).toBe(1);
    expect(ownership.controller).toBe(1);
    expect(ownership.parsedRoot).toBe(1);
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

test("the studio-neutral profile owns one PMREM, three scene lights, and one static shadow refresh", async ({ page }) => {
  await openFreshProject(page);
  await continueToCustomization(page);
  const canvas = await expectAcceptedScene(page);
  const materialDigest = await canvas.getAttribute("data-room2-runtime-material-digest");
  const materialAppearanceDigest = await canvas.getAttribute("data-room2-runtime-material-appearance-digest");
  const modelFingerprint = await canvas.getAttribute("data-room2-runtime-model-fingerprint");
  const imageDigest = await canvas.getAttribute("data-room2-embedded-image-payload-digest");
  const readJsonAttribute = async (name) => JSON.parse(await canvas.getAttribute(name));
  const renderer = await readJsonAttribute("data-room2-renderer-state");
  const lighting = await readJsonAttribute("data-room2-lighting-state");
  const environment = await readJsonAttribute("data-room2-environment-state");
  const initialShadows = await readJsonAttribute("data-room2-shadow-state");

  expect(await canvas.getAttribute("data-room2-appearance-profile")).toBe("room2-studio-neutral-v1");
  expect(materialAppearanceDigest).toMatch(/^[a-f0-9]{64}$/);
  expect(imageDigest).toBe("6c737d2ff899087b3227f9202dcf95c874474d65dfbc6ec83c778748feced153");
  expect(renderer).toMatchObject({
    className: "WebGLRenderer",
    backend: "webgl2",
    threeRevision: "166",
    colorManagementEnabled: true,
    workingColorSpace: "srgb-linear",
    outputColorSpace: "srgb",
    outputTransformCount: 1,
    toneMapping: "aces-filmic",
    exposure: 0.82,
    shadowType: "pcf-soft"
  });
  expect(lighting.directLightCount).toBe(3);
  expect(lighting.semanticRoleCount).toBe(3);
  expect(Object.keys(lighting.roles)).toEqual(["key", "fill", "rim"]);
  expect(Object.values(lighting.roles).filter(({ castShadow }) => castShadow)).toHaveLength(1);
  expect(environment).toMatchObject({
    type: "three-r166-room-environment-pmrem",
    intensity: 0.55,
    rotationRadians: 0,
    generationCount: 1,
    retainedRenderTargets: 1
  });
  expect(initialShadows).toMatchObject({ casterCount: 1, casterRole: "key", refreshCount: 1, autoUpdate: false });

  const initialCamera = await canvas.getAttribute("data-room2-camera-state");
  await canvas.focus();
  await canvas.press("ArrowLeft");
  await expect.poll(() => canvas.getAttribute("data-room2-camera-state")).not.toBe(initialCamera);
  await canvas.press("ArrowRight");
  await expect.poll(async () => (await readJsonAttribute("data-room2-shadow-state")).refreshPending).toBe(false);
  const afterOrbitShadows = await readJsonAttribute("data-room2-shadow-state");
  expect(afterOrbitShadows.refreshCount).toBe(initialShadows.refreshCount);
  await expect(canvas).toHaveAttribute("data-room2-runtime-material-digest", materialDigest);
  await expect(canvas).toHaveAttribute("data-room2-runtime-material-appearance-digest", materialAppearanceDigest);
  await expect(canvas).toHaveAttribute("data-room2-runtime-model-fingerprint", modelFingerprint);
  await expect(canvas).toHaveAttribute("data-room2-embedded-image-payload-digest", imageDigest);
});

test("orbit, zoom, reset, Review, and browser history preserve the one viewer session", async ({ page }) => {
  await openFreshProject(page);
  await continueToCustomization(page);
  let canvas = await expectAcceptedScene(page);
  const instance = await canvas.getAttribute("data-guided3d-instance");
  const root = await canvas.getAttribute("data-room2-parsed-root-identity");
  const initialCamera = await canvas.getAttribute("data-room2-camera-state");
  await canvas.focus();
  await canvas.press("ArrowLeft");
  await expect.poll(() => canvas.getAttribute("data-room2-camera-state")).not.toBe(initialCamera);
  const reset = page.getByRole("button", { name: "Reset preview" });
  await expect(reset).toBeEnabled();
  await reset.click();
  await expect(canvas).toHaveAttribute("data-room2-camera-state", initialCamera);
  await canvas.focus();
  await canvas.press("ArrowRight");
  await canvas.press("+");
  const adjustedCamera = await canvas.getAttribute("data-room2-camera-state");

  await page.locator("[data-continue]").click();
  await expect(page).toHaveURL(/#step-4$/);
  canvas = await expectAcceptedScene(page);
  await expect(canvas).toHaveAttribute("data-guided3d-instance", instance);
  await expect(canvas).toHaveAttribute("data-room2-parsed-root-identity", root);
  await expect(canvas).toHaveAttribute("data-room2-camera-state", adjustedCamera);
  await expect(canvas).toHaveAttribute("data-room2-request-count", "1");
  await expect(canvas).toHaveAttribute("data-room2-parse-count", "1");

  await page.goBack();
  await expect(page).toHaveURL(/#step-3$/);
  canvas = await expectAcceptedScene(page);
  await expect(canvas).toHaveAttribute("data-room2-camera-state", adjustedCamera);
  await canvas.focus();
  await canvas.press("0");
  await expect(canvas).toHaveAttribute("data-room2-camera-state", initialCamera);
});

test("explicit document teardown disposes the Room 2 viewer and removes its canvas ownership", async ({ page }) => {
  await openFreshProject(page);
  await continueToCustomization(page);
  await expectAcceptedScene(page);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false })));
  await expect(page.locator(".guided-room2-canvas")).toHaveCount(0);
  const diagnostics = await page.evaluate(() => globalThis.__JQ_ROOM2_VIEWER_DIAGNOSTICS__);
  expect(diagnostics.state).toBe("disposed");
  expect(diagnostics.ownership).toMatchObject({
    canvases: 0,
    renderers: 0,
    controllers: 0,
    parsedRoots: 0,
    animationLoops: 0,
    renderFrames: 0,
    resizeObservers: 0,
    resizeListeners: 0,
    controlListenerSets: 0
  });
  expect(diagnostics.environment).toMatchObject({ generationCount: 1, retainedRenderTargets: 0 });
  expect(diagnostics.lighting.directLightCount).toBe(0);
  expect(diagnostics.shadows.casterCount).toBe(0);
});

test("a rejected dimension edit preserves the last accepted scene and names the diagnostic", async ({ page }) => {
  await openFreshProject(page);
  await continueToCustomization(page);
  const canvas = await expectAcceptedScene(page);
  const acceptedGeometry = await canvas.getAttribute("data-room2-geometry-fingerprint");
  const acceptedModel = await canvas.getAttribute("data-room2-runtime-model-fingerprint");
  const acceptedRoot = await canvas.getAttribute("data-room2-parsed-root-identity");
  const wallWidth = page.locator('[data-measurement="wallWidth"]');
  await wallWidth.fill("");
  await expect(page.locator("[data-transaction-diagnostic]")).toBeVisible();
  await expect(page.locator("[data-transaction-diagnostic]")).toContainText("Last accepted project specification preserved");
  await expect(page.locator("[data-transaction-diagnostic]")).toContainText(
    "Enter Wall Width, Ceiling Height, and Desired Built-In Depth"
  );
  await expect(page.locator("[data-transaction-diagnostic]")).not.toContainText("undefined");
  await expect(page.locator("[data-transaction-diagnostic]")).toContainText(/\([A-Z0-9_]+\)/);
  await expect(canvas).toHaveAttribute("data-room2-geometry-fingerprint", acceptedGeometry);
  await expect(canvas).toHaveAttribute("data-room2-runtime-model-fingerprint", acceptedModel);
  await expect(canvas).toHaveAttribute("data-room2-parsed-root-identity", acceptedRoot);
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
  await continueToCustomization(page);
  const width = page.locator('[data-measurement="wallWidth"]');
  await width.fill("121 1/2");
  await width.blur();
  await expect(width).toHaveValue("121.5");
  await width.fill("190");
  await expect(page.locator('[data-measurement-row="wallWidth"] .measurement-warning'))
    .toContainText("outside our usual");
  const fireplaceWidth = page.locator('[data-measurement="fireplaceWidth"]');
  await fireplaceWidth.fill("about four feet");
  await expect(fireplaceWidth).toHaveAttribute("aria-invalid", "");
  await expect(page.locator('[data-measurement-row="fireplaceWidth"] .measurement-input-error'))
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

test("deferred finish and details persist without changing the fixed Room 2 scene or camera", async ({ page }) => {
  await openFreshProject(page);
  await continueToCustomization(page);
  let canvas = await expectAcceptedScene(page);
  await expect(page.locator('[data-deferred-model-disclosure="dimensions"]')).toContainText("not yet shown on the fixed Room 2 reference model");
  const instance = await canvas.getAttribute("data-guided3d-instance");
  const geometryBefore = await canvas.getAttribute("data-room2-runtime-model-fingerprint");
  const materialsBefore = await canvas.getAttribute("data-room2-runtime-material-digest");
  const materialAppearanceBefore = await canvas.getAttribute("data-room2-runtime-material-appearance-digest");
  const rootBefore = await canvas.getAttribute("data-room2-parsed-root-identity");
  const cameraBefore = await canvas.getAttribute("data-room2-camera-state");
  await page.getByRole("tab", { name: "Finish" }).click();
  await expect(page.locator('[data-deferred-model-disclosure="finish"]')).toContainText("saved with this project");
  await page.locator('[data-finish-key="paint"][data-finish="charcoal"]').click();
  canvas = page.locator(".guided-3d-canvas");
  await expect(canvas).toHaveAttribute("data-guided3d-instance", instance);
  await expect(canvas).toHaveAttribute("data-room2-runtime-model-fingerprint", geometryBefore);
  await expect(canvas).toHaveAttribute("data-room2-runtime-material-digest", materialsBefore);
  await expect(canvas).toHaveAttribute("data-room2-runtime-material-appearance-digest", materialAppearanceBefore);
  await expect(canvas).toHaveAttribute("data-room2-parsed-root-identity", rootBefore);
  await expect(canvas).toHaveAttribute("data-room2-camera-state", cameraBefore);
  await page.getByRole("tab", { name: "Details" }).click();
  await expect(page.locator('[data-deferred-model-disclosure="details, hardware, and lighting"]')).toContainText("not yet shown on the fixed Room 2 reference model");
  await page.locator('[data-detail-key="hardware"][data-detail="black-pull"]').click();
  for (const key of ["doorStyle", "lighting", "baseStyle", "topTreatment"]) {
    const alternative = page.locator(`[data-detail-key="${key}"][aria-pressed="false"]`).first();
    await expect(alternative).toBeVisible();
    await alternative.click();
    await expect(canvas).toHaveAttribute("data-room2-runtime-model-fingerprint", geometryBefore);
    await expect(canvas).toHaveAttribute("data-room2-runtime-material-digest", materialsBefore);
    await expect(canvas).toHaveAttribute("data-room2-runtime-material-appearance-digest", materialAppearanceBefore);
    await expect(canvas).toHaveAttribute("data-room2-parsed-root-identity", rootBefore);
    await expect(canvas).toHaveAttribute("data-room2-camera-state", cameraBefore);
  }
  await page.locator("[data-continue]").click();
  const summary = page.locator(".project-summary-card");
  await expect(summary.locator('[data-summary-value="product"]')).toHaveText("Cabinets + Shelves");
  await expect(summary.locator('[data-summary-value="layout"]')).toHaveText("Fireplace Wall");
  await expect(summary.locator('[data-summary-value="finish"]')).toHaveText("Charcoal");
  await expect(summary.locator('[data-summary-value="hardware"]')).toHaveText("Black Pull");
  await expect(page.locator(".guided-3d-canvas")).toHaveAttribute("data-guided3d-instance", instance);
  await expect(page.locator(".guided-3d-canvas")).toHaveAttribute("data-room2-runtime-material-digest", materialsBefore);
  await expect(page.locator(".guided-3d-canvas")).toHaveAttribute("data-room2-runtime-material-appearance-digest", materialAppearanceBefore);
  await expect(page.locator(".guided-3d-canvas")).toHaveAttribute("data-room2-camera-state", cameraBefore);
  await page.locator('[data-edit-section="finish"]').click();
  await expect(page.getByRole("tab", { name: "Finish" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('[data-finish-key="paint"][data-finish="charcoal"]'))
    .toHaveAttribute("aria-pressed", "true");
});

test("five-step drafts and stale hashes normalize while Back and Forward remain stable", async ({ page }) => {
  await seedStorage(page, { draft: legacyProject() });
  await page.goto("configurator.html#step-5", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/#step-4$/);
  await expect(page.getByRole("heading", { name: "Review your project details" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Project steps" }).getByRole("button")).toHaveCount(4);
  await page.locator('[data-edit-section="finish"]').click();
  await expect(page).toHaveURL(/#step-3$/);
  await page.goBack();
  await expect(page).toHaveURL(/#step-4$/);
  await page.goForward();
  await expect(page).toHaveURL(/#step-3$/);
  await expect.poll(() => page.evaluate((key) => {
    const stored = JSON.parse(localStorage.getItem(key));
    return { schemaVersion: stored.schemaVersion, currentStep: stored.currentStep };
  }, DRAFT_KEY)).toEqual({ schemaVersion: 4, currentStep: 3 });
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), DRAFT_KEY);
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
  await expect(page.getByRole("heading", { name: "Plan details beside the Room 2 reference" })).toBeVisible();
  await expect(page.locator('[data-step="4"]')).toBeDisabled();
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), DRAFT_KEY);
  expect(stored.currentStep).toBe(3);
  expect(stored.maxVisitedStep).toBe(3);
});

test("save, reload, My Projects, rename, duplicate, delete, and resume retain state", async ({ page }) => {
  await openFreshProject(page);
  await continueToReview(page);
  await page.locator("[data-save-project]").click();
  const saveDialog = page.locator("[data-save-dialog]");
  await saveDialog.getByLabel("Project name").fill("Park Avenue Library");
  await saveDialog.getByRole("button", { name: "Save Project", exact: true }).click();
  await expect(page.locator("[data-guided-toast]")).toContainText("saved on this device");
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Review your project details" })).toBeVisible();
  await expect(page.locator('[data-summary-value="layout"]')).toHaveText("Fireplace Wall");
  let canvas = await expectAcceptedScene(page);
  const viewerInstance = await canvas.getAttribute("data-guided3d-instance");
  const parsedRoot = await canvas.getAttribute("data-room2-parsed-root-identity");
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
  await expect(page.getByRole("heading", { name: "Review your project details" })).toBeVisible();
  await expect(page).toHaveURL(/project=JQ-.+#step-4$/);
  canvas = await expectAcceptedScene(page);
  await expect(canvas).toHaveAttribute("data-guided3d-instance", viewerInstance);
  await expect(canvas).toHaveAttribute("data-room2-parsed-root-identity", parsedRoot);
  await expect(canvas).toHaveAttribute("data-room2-request-count", "1");
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
  await expect(dialog.locator("[data-email-fallback]")).toHaveAttribute("href", /Fireplace%20Wall/);
});

test("Customization shows deterministic loading and requests the exact GLB once", async ({ page }) => {
  let requests = 0;
  await page.route("**/assets/models/room2/Room2-Fireplace-bookcases-source-v1.glb", async (route) => {
    requests += 1;
    await new Promise((resolve) => setTimeout(resolve, 350));
    await route.continue();
  });
  await openFreshProject(page);
  await continueToLayouts(page);
  await chooseLayout(page);
  await page.locator("[data-continue]").click();
  const status = page.locator("[data-guided-engine-status]");
  await expect(status).toBeVisible();
  await expect(status).toContainText("Loading fixed Room 2 reference");
  const canvas = await expectAcceptedScene(page);
  await expect(status).toBeHidden();
  expect(requests).toBe(1);
  await expect(canvas).toHaveAttribute("data-room2-request-count", "1");
});

test("the public runtime material snapshot is deterministic across clean document loads", async ({ page }) => {
  await openFreshProject(page);
  await continueToCustomization(page);
  let canvas = await expectAcceptedScene(page);
  const firstDigest = await canvas.getAttribute("data-room2-runtime-material-digest");
  const firstAppearanceDigest = await canvas.getAttribute("data-room2-runtime-material-appearance-digest");
  expect(firstDigest).toMatch(/^[a-f0-9]{64}$/);
  expect(firstAppearanceDigest).toMatch(/^[a-f0-9]{64}$/);
  await page.reload({ waitUntil: "networkidle" });
  canvas = await expectAcceptedScene(page);
  await expect(canvas).toHaveAttribute("data-room2-runtime-material-digest", firstDigest);
  await expect(canvas).toHaveAttribute("data-room2-runtime-material-appearance-digest", firstAppearanceDigest);
  await expect(canvas).toHaveAttribute("data-room2-request-count", "1");
  await expect(canvas).toHaveAttribute("data-room2-parse-count", "1");
});

test("renderer failure is visible and fail-closed without substituting a photograph", async ({ page }) => {
  await page.route("**/assets/models/room2/Room2-Fireplace-bookcases-source-v1.glb", (route) => route.fulfill({ status: 503 }));
  await openFreshProject(page);
  await continueToCustomization(page);
  const preview = page.locator(".concept-preview");
  const scene = preview.locator('.concept-scene[data-guided3d-state="fallback"]');
  await expect(scene).toBeVisible();
  await expect(scene.locator("[data-guided-engine-status] strong")).toHaveText("Fixed Room 2 model unavailable");
  await expect(scene.locator("[data-guided-engine-status]")).toContainText(
    "No substitute model or image was loaded"
  );
  await expect(preview.locator("canvas")).toBeHidden();
  await expect(preview.locator("img.concept-photo, [data-published-preview-image]")).toHaveCount(0);
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Review your project details" })).toBeVisible();
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
  const layout = page.locator(`[data-layout="${ACTIVE_LAYOUT_ID}"]`);
  await layout.focus();
  await page.keyboard.press("Enter");
  await expect(layout).toHaveAttribute("aria-pressed", "true");
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Plan details beside the Room 2 reference" })).toBeFocused();
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
    await continueToCustomization(page);
    const canvas = await expectAcceptedScene(page);
    const shadowState = JSON.parse(await canvas.getAttribute("data-room2-shadow-state"));
    expect(shadowState.mapSize, `${viewport.name} shadow tier`).toBe(viewport.name === "phone" ? 1024 : 2048);
    expect(shadowState.refreshCount, `${viewport.name} initial shadow refresh`).toBe(1);
    expect(shadowState.autoUpdate, `${viewport.name} static shadow mode`).toBe(false);
    const geometry = await page.evaluate(() => {
      const preview = document.querySelector(".concept-preview").getBoundingClientRect();
      const controls = document.querySelector(".customization-controls-column").getBoundingClientRect();
      const actions = [...document.querySelectorAll(".customization-actions .guided-button")]
        .map((button) => button.getBoundingClientRect());
      const referenceLabels = [...document.querySelectorAll(
        ".fixed-reference-heading small, .fixed-reference-heading strong, .concept-layout-context-copy strong"
      )].map((element) => ({
        text: element.textContent.trim(),
        textOverflow: getComputedStyle(element).textOverflow,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth
      }));
      const visibleWidth = Math.max(0, Math.min(preview.right, innerWidth) - Math.max(preview.left, 0));
      const visibleHeight = Math.max(0, Math.min(preview.bottom, innerHeight) - Math.max(preview.top, 0));
      return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        preview: { top: preview.top, bottom: preview.bottom, width: preview.width, height: preview.height },
        visiblePreviewArea: visibleWidth * visibleHeight,
        controls: { top: controls.top, width: controls.width },
        actionMinHeight: Math.min(...actions.map(({ height }) => height)),
        referenceLabels
      };
    });
    expect(geometry.scrollWidth, viewport.name).toBeLessThanOrEqual(geometry.clientWidth);
    expect(geometry.visiblePreviewArea, `${viewport.name} initial preview intersection`).toBeGreaterThan(0);
    expect(geometry.preview.width, viewport.name).toBeGreaterThan(viewport.name === "phone" ? 340 : 480);
    expect(geometry.preview.height, viewport.name).toBeGreaterThanOrEqual(viewport.name === "phone" ? 360 : 490);
    expect(geometry.actionMinHeight, viewport.name).toBeGreaterThanOrEqual(44);
    expect(
      geometry.referenceLabels.every(({ scrollWidth, clientWidth }) => scrollWidth <= clientWidth + 1),
      `${viewport.name} fixed-reference labels are fully legible`
    ).toBe(true);

    await canvas.focus();
    await expect(canvas).toBeFocused();
    const focus = await canvas.evaluate((element) => {
      const style = getComputedStyle(element);
      return { outlineStyle: style.outlineStyle, outlineWidth: Number.parseFloat(style.outlineWidth) };
    });
    expect(focus.outlineStyle, `${viewport.name} visible focus style`).not.toBe("none");
    expect(focus.outlineWidth, `${viewport.name} visible focus width`).toBeGreaterThan(0);

    const actionButtons = page.locator(".customization-actions .guided-button");
    for (let index = 0; index < await actionButtons.count(); index += 1) {
      const action = actionButtons.nth(index);
      await action.scrollIntoViewIfNeeded();
      const reachability = await action.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const centerX = Math.min(innerWidth - 1, Math.max(0, rect.left + rect.width / 2));
        const centerY = Math.min(innerHeight - 1, Math.max(0, rect.top + rect.height / 2));
        const topmost = document.elementFromPoint(centerX, centerY);
        return {
          visible: rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth,
          unobscured: topmost === element || element.contains(topmost),
          width: rect.width,
          height: rect.height
        };
      });
      expect(reachability.visible, `${viewport.name} primary action ${index} visible`).toBe(true);
      expect(reachability.unobscured, `${viewport.name} primary action ${index} unobscured`).toBe(true);
      expect(reachability.width, `${viewport.name} primary action ${index} width`).toBeGreaterThanOrEqual(44);
      expect(reachability.height, `${viewport.name} primary action ${index} height`).toBeGreaterThanOrEqual(44);
    }

    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(
      results.violations.filter(({ impact }) => ["critical", "serious"].includes(impact)),
      `${viewport.name} critical/serious accessibility violations`
    ).toEqual([]);
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
  await continueToCustomization(page);
  await expectAcceptedScene(page);
  results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(results.violations.filter(({ impact }) => ["critical", "serious"].includes(impact))).toEqual([]);
});

test("the complete public flow makes no forbidden remote or preview-matrix requests", async ({ page }) => {
  const runtime = monitorRuntime(page);
  const remoteRequests = [];
  const matrixRequests = [];
  const modelRequests = [];
  const oldRendererRequests = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol !== "blob:" && !["127.0.0.1", "localhost"].includes(url.hostname)) remoteRequests.push(request.url());
    if (url.pathname.includes("/assets/photos/configurator/photoreal-matrix/")) matrixRequests.push(request.url());
    if (url.pathname.endsWith("/Room2-Fireplace-bookcases-source-v1.glb")) modelRequests.push(request.url());
    if (url.pathname.endsWith("/guided-configurator-3d.js")) oldRendererRequests.push(request.url());
  });
  await openFreshProject(page);
  await continueToReview(page);
  await expectAcceptedScene(page);
  expect(remoteRequests).toEqual([]);
  expect(matrixRequests).toEqual([]);
  expect(modelRequests).toHaveLength(1);
  expect(oldRendererRequests).toEqual([]);
  expect(runtime).toEqual([]);
});
