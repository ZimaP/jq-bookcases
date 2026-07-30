import { test, expect } from "@playwright/test";
import {
  PRODUCT_CHOICES,
  PRODUCT_INTEGRATED_PREVIEW_ASSETS,
  SHARED_ROOM_LAYOUTS,
  resolvePreviewPresentation
} from "../guided-configurator-data.js";

const products = [
  { id: "cabinet-shelves", label: "Cabinets + Shelves", category: "bookcase", style: "cabinet-base-shelves" },
  { id: "drawer-shelves", label: "Drawers + Shelves", category: "bookcase", style: "drawer-base-shelves" },
  { id: "open-shelving", label: "Full Open Shelving", category: "bookcase", style: "full-open-shelving" },
  { id: "tv-unit", label: "TV Unit", category: "tv-unit", style: "framed-tv-wall" },
  { id: "floating-storage", label: "Floating Storage", category: "floating-storage", style: "floating-drawer-bank" },
  { id: "window-storage", label: "Window Storage", category: "window-storage", style: "window-seat-storage" },
  { id: "radiator-cover", label: "Radiator Cover", category: "radiator-cover", style: "clean-slat-cover" }
];

const sharedLayouts = [
  { id: "niche-layout", label: "Niche Layout" },
  { id: "left-niche", label: "Left Niche" },
  { id: "right-niche", label: "Right Niche" },
  { id: "clear-wall", label: "Clear Wall" },
  { id: "fireplace-wall", label: "Fireplace Wall" },
  { id: "center-recess", label: "Center Projection" },
  { id: "window-wall", label: "Window Wall" },
  { id: "door-wall", label: "Door Wall" },
  { id: "corner-wall", label: "Corner Wall" },
  { id: "double-opening", label: "Between Openings" }
];

const bookcaseMeasurementDimensions = Object.freeze({
  "niche-layout": [
    ["wallWidth", "A"],
    ["ceilingHeight", "B"],
    ["desiredDepth", "C"],
    ["nicheWidth", "D"],
    ["nicheHeight", "E"],
    ["nicheDepth", "F"]
  ],
  "left-niche": [
    ["wallWidth", "A"],
    ["ceilingHeight", "B"],
    ["desiredDepth", "C"],
    ["nicheWidth", "D"],
    ["nicheHeight", "E"],
    ["nicheDepth", "F"]
  ],
  "right-niche": [
    ["wallWidth", "A"],
    ["ceilingHeight", "B"],
    ["desiredDepth", "C"],
    ["nicheWidth", "D"],
    ["nicheHeight", "E"],
    ["nicheDepth", "F"]
  ],
  "clear-wall": [
    ["wallWidth", "A"],
    ["ceilingHeight", "B"],
    ["desiredDepth", "C"]
  ],
  "fireplace-wall": [
    ["wallWidth", "A"],
    ["ceilingHeight", "B"],
    ["desiredDepth", "C"],
    ["fireplaceWidth", "D"],
    ["fireplaceHeight", "E"],
    ["mantelWidth", "F"]
  ],
  "center-recess": [
    ["wallWidth", "A"],
    ["ceilingHeight", "B"],
    ["desiredDepth", "C"],
    ["nicheWidth", "D"],
    ["nicheHeight", "E"],
    ["nicheDepth", "F"]
  ],
  "window-wall": [
    ["wallWidth", "A"],
    ["ceilingHeight", "B"],
    ["desiredDepth", "C"],
    ["windowWidth", "D"],
    ["windowHeight", "E"],
    ["sillHeight", "F"]
  ],
  "door-wall": [
    ["wallWidth", "A"],
    ["ceilingHeight", "B"],
    ["desiredDepth", "C"],
    ["doorWidth", "D"],
    ["doorHeight", "E"],
    ["doorLeftDistance", "F"]
  ],
  "corner-wall": [
    ["wallWidth", "A"],
    ["ceilingHeight", "B"],
    ["desiredDepth", "C"],
    ["cornerReturn", "D"]
  ],
  "double-opening": [
    ["wallWidth", "A"],
    ["ceilingHeight", "B"],
    ["desiredDepth", "C"],
    ["openingLeftDistance", "D"],
    ["openingRightDistance", "E"]
  ]
});

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
  await page.goto("/configurator.html?start=new", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "What would you like us to build?" })).toBeVisible();
  await expect(page).toHaveURL(/configurator\.html#step-1$/);
}

async function chooseProduct(page, label = "Cabinets + Shelves") {
  const product = products.find((candidate) => candidate.label === label);
  if (!product) throw new Error(`Unknown product: ${label}`);
  const card = page.locator(`[data-product-choice="${product.id}"]`);
  await card.click();
  await expect(card).toHaveAttribute("aria-pressed", "true");
}

async function continueToLayouts(page, product = "Cabinets + Shelves") {
  await chooseProduct(page, product);
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Choose the room condition that matches your space" })).toBeVisible();
  await expect(page).toHaveURL(/configurator\.html#step-2$/);
}

async function chooseLayout(page, label) {
  const card = page.getByRole("button", { name: label, exact: true });
  const layoutId = await card.getAttribute("data-layout");
  await card.click();
  await expect(page.locator(`[data-layout="${layoutId}"]`)).toHaveAttribute("aria-pressed", "true");
}

async function expectOneScreenFit(page, selectors) {
  const report = await page.evaluate((targets) => {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    return {
      viewport,
      documentOverflow: document.documentElement.scrollHeight - viewport.height,
      elements: targets.map((selector) => {
        const element = document.querySelector(selector);
        if (!element) return { selector, missing: true };
        const rect = element.getBoundingClientRect();
        return {
          selector,
          missing: false,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          left: rect.left
        };
      })
    };
  }, selectors);

  expect(report.documentOverflow).toBeLessThanOrEqual(1);
  for (const element of report.elements) {
    expect(element.missing, element.selector).toBe(false);
    expect(element.top, `${element.selector} top`).toBeGreaterThanOrEqual(-1);
    expect(element.left, `${element.selector} left`).toBeGreaterThanOrEqual(-1);
    expect(element.right, `${element.selector} right`).toBeLessThanOrEqual(report.viewport.width + 1);
    expect(element.bottom, `${element.selector} bottom`).toBeLessThanOrEqual(report.viewport.height + 1);
  }
}

async function continueToReview(page, layout = "Clear Wall", product = "Cabinets + Shelves") {
  await continueToLayouts(page, product);
  await chooseLayout(page, layout);
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Tell us about your space" })).toBeVisible();
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Refine your concept" })).toBeVisible();
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Review your custom concept" })).toBeVisible();
}

async function fillQuoteContact(page) {
  const dialog = page.locator("[data-quote-dialog]");
  const contact = {
    fullName: "Alex Morgan",
    email: "alex@example.com",
    phone: "5165550188",
    zip: "11570"
  };
  for (const [name, value] of Object.entries(contact)) {
    const field = dialog.locator(`input[name="${name}"]`);
    await field.fill(value);
    await expect(field).toHaveValue(value);
  }
  return dialog;
}

async function serveWithQuoteEndpoint(page, status, body) {
  await page.route("**/configurator.html*", async (route) => {
    const response = await route.fetch();
    const html = (await response.text()).replace(
      '<meta name="jq-quote-endpoint" content="">',
      '<meta name="jq-quote-endpoint" content="/api/quote">'
    );
    await route.fulfill({
      response,
      body: html,
      headers: { ...response.headers(), "content-type": "text/html; charset=utf-8" }
    });
  });
  await page.route("**/api/quote", (route) => route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body)
  }));
}

test("public route is the lightweight five-step configurator and excludes the 3D engine", async ({ page }) => {
  const runtime = monitorRuntime(page);
  const requests = [];
  page.on("request", (request) => requests.push(new URL(request.url()).pathname));
  await openFreshProject(page);

  await expect(page.locator("[data-guided-app]")).toHaveCount(1);
  await expect(page.getByRole("navigation", { name: "Project steps" }).getByRole("button")).toHaveCount(5);
  await expect(page.locator(".guided-category-nav")).toHaveCount(0);
  await expect(page.locator("[data-product-choice]")).toHaveCount(7);
  await expect(page.locator("[data-product-choice] .product-card-title")).toHaveText([
    "Cabinets + Shelves",
    "Drawers + Shelves",
    "Full Open Shelving",
    "TV Unit",
    "Floating Storage",
    "Window Storage",
    "Radiator Cover"
  ]);
  await expect(page.locator("[data-product-choice] picture source[type='image/avif']")).toHaveCount(7);
  await expect.poll(() => page.locator("[data-product-choice] img").evaluateAll((images) => (
    images.every((image) => image.complete && image.naturalWidth > 0 && image.currentSrc.endsWith(".avif"))
  ))).toBe(true);
  await expect(page.locator("canvas, [data-3d-viewer], model-viewer")).toHaveCount(0);
  expect(requests.some((path) => /configurator-3d|three\.module|cabinet-ar|direct-hardware/i.test(path))).toBe(false);
  expect(runtime).toEqual([]);
});

test("wide desktop keeps all seven product cards readable and fully visible", async ({ page }) => {
  await page.setViewportSize({ width: 2491, height: 1146 });
  await openFreshProject(page);

  const cards = page.locator("[data-product-choice]");
  await expect(cards).toHaveCount(7);
  await expect.poll(() => cards.locator("img").evaluateAll((images) => (
    images.every((image) => image.complete && image.naturalWidth > 0)
  ))).toBe(true);

  const geometry = await page.evaluate(() => {
    const tolerance = 1;
    const grid = document.querySelector(".product-grid--catalog").getBoundingClientRect();
    const cardReports = [...document.querySelectorAll("[data-product-choice]")].map((card) => {
      const cardRect = bounds(card);
      const imageRect = bounds(card.querySelector(".product-card-image"));
      const titleRect = bounds(card.querySelector(".product-card-title"));
      return {
        card: cardRect,
        image: imageRect,
        title: titleRect,
        insideViewport: (
          cardRect.top >= -tolerance
          && cardRect.left >= -tolerance
          && cardRect.right <= window.innerWidth + tolerance
          && cardRect.bottom <= window.innerHeight + tolerance
        ),
        insideGrid: (
          cardRect.top >= grid.top - tolerance
          && cardRect.right <= grid.right + tolerance
          && cardRect.bottom <= grid.bottom + tolerance
          && cardRect.left >= grid.left - tolerance
        ),
        noInternalOverflow: (
          card.scrollWidth <= card.clientWidth + tolerance
          && card.scrollHeight <= card.clientHeight + tolerance
        )
      };
    });
    const widths = cardReports.map(({ card }) => card.width);
    const rowTops = cardReports
      .map(({ card }) => card.top)
      .sort((a, b) => a - b)
      .reduce((rows, top) => {
        if (!rows.some((rowTop) => Math.abs(rowTop - top) <= 2)) rows.push(top);
        return rows;
      }, []);
    return {
      horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
      verticalOverflow: document.documentElement.scrollHeight - window.innerHeight,
      widthSpread: Math.max(...widths) - Math.min(...widths),
      rowTops,
      cards: cardReports
    };

    function bounds(element) {
      const rect = element.getBoundingClientRect();
      return {
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
        height: rect.height
      };
    }
  });

  expect(geometry.horizontalOverflow).toBeLessThanOrEqual(1);
  expect(geometry.verticalOverflow).toBeLessThanOrEqual(1);
  expect(geometry.widthSpread).toBeLessThanOrEqual(2);
  expect(geometry.rowTops).toHaveLength(2);
  for (const [index, card] of geometry.cards.entries()) {
    const label = `product card ${index + 1}`;
    expect(card.insideViewport, `${label} inside viewport`).toBe(true);
    expect(card.insideGrid, `${label} inside grid`).toBe(true);
    expect(card.noInternalOverflow, `${label} internal overflow`).toBe(true);
    expect(card.card.width, `${label} width`).toBeGreaterThanOrEqual(250);
    expect(card.card.height, `${label} height`).toBeGreaterThanOrEqual(180);
    expect(card.image.width, `${label} image width`).toBeGreaterThanOrEqual(240);
    expect(card.title.left, `${label} title left`).toBeGreaterThanOrEqual(card.card.left - 1);
    expect(card.title.right, `${label} title right`).toBeLessThanOrEqual(card.card.right + 1);
  }

  await chooseProduct(page);
  await expect(page.locator("[data-continue]")).toBeEnabled();
  await expectOneScreenFit(page, [".product-grid--catalog", ".guided-actions"]);
});

test("Continue requires explicit choices and every product uses the same ten room layouts", async ({ page }) => {
  await openFreshProject(page);
  await expect(page.locator("[data-continue]")).toBeDisabled();

  for (const product of products) {
    await openFreshProject(page);
    await continueToLayouts(page, product.label);
    const cards = page.locator("[data-layout]");
    await expect(cards).toHaveCount(sharedLayouts.length);
    await expect(cards.locator(".layout-card-title")).toHaveText(sharedLayouts.map((layout) => layout.label));
    expect(await cards.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-layout"))))
      .toEqual(sharedLayouts.map((layout) => layout.id));
    await expect(page.locator("[data-continue]")).toBeDisabled();
  }
});

test("measurement fields adapt to the layout, accept fractions, warn gently, and retain values", async ({ page }) => {
  await openFreshProject(page);
  await continueToLayouts(page);
  await chooseLayout(page, "Window Wall");
  await page.locator("[data-continue]").click();

  for (const fieldId of [
    "wallWidth",
    "ceilingHeight",
    "desiredDepth",
    "leftReturn",
    "rightReturn",
    "windowWidth",
    "windowHeight",
    "sillHeight",
    "radiatorBelowWindow"
  ]) {
    await expect(page.locator(`[data-measurement-row="${fieldId}"]`)).toBeVisible();
  }

  const width = page.locator('[data-measurement="wallWidth"]');
  await width.fill("121 1/2");
  await expect(page.locator('[data-dimension-chip="wallWidth"]')).toContainText("121 1/2 in");
  await width.fill("190");
  await expect(page.locator('[data-measurement-row="wallWidth"] .measurement-warning')).toContainText("outside our usual");
  const optionalWindowWidth = page.locator('[data-measurement="windowWidth"]');
  await optionalWindowWidth.fill("about four feet");
  await expect(page.locator('[data-measurement-row="windowWidth"] .measurement-input-error')).toContainText("decimal, or a common fraction");
  await expect(optionalWindowWidth).toHaveAttribute("aria-invalid", "");
  await optionalWindowWidth.fill("48");

  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Refine your concept" })).toBeVisible();
  await expect(page.locator(".concept-preview")).toHaveAttribute(
    "data-preview-asset",
    "assets/photos/configurator/concept-window-cabinets-v1.png"
  );
  await page.locator("[data-back]").click();
  await expect(width).toHaveValue("190");

  await width.fill("");
  await expect(width).toHaveValue("");
  await page.locator("[data-continue]").click();
  await expect(page.locator("[data-measurement-error]")).toContainText("approximate wall width");
  await expect(width).toBeFocused();
});

test("one spatial 3D scene persists from room measurements through review", async ({ page }) => {
  const photographicFallbackRequests = [];
  page.on("request", (request) => {
    if (/\/assets\/photos\/configurator\/integrated\//.test(request.url())) {
      photographicFallbackRequests.push(request.url());
    }
  });
  await openFreshProject(page);
  await continueToLayouts(page);
  await chooseLayout(page, "Left Niche");
  await page.locator("[data-continue]").click();

  const measurementScene = page.locator('.measurement-room[data-guided3d-state="ready"]');
  await expect(measurementScene).toBeVisible();
  const measurementCanvas = measurementScene.locator(".guided-3d-canvas");
  await expect(measurementCanvas).toHaveCount(1);
  await expect(measurementCanvas).toHaveAttribute("data-rendered", "true");
  await expect(measurementCanvas).toHaveAttribute("data-scene-layout", "left-niche");
  await expect(measurementCanvas).toHaveAttribute("data-show-product", "false");
  await expect(measurementCanvas).toHaveAttribute("data-show-dimensions", "true");
  const instanceId = await measurementCanvas.getAttribute("data-guided3d-instance");
  const initialSignature = await measurementCanvas.getAttribute("data-scene-signature");

  await page.locator('[data-measurement="nicheWidth"]').fill("90");
  await expect.poll(() => measurementCanvas.getAttribute("data-scene-signature"))
    .not.toBe(initialSignature);
  await expect(page.locator('[data-measurement-row="nicheWidth"] .measurement-warning')).toContainText(
    "does not match the 120 in wall width"
  );
  await expect(page.locator(".guided-3d-canvas")).toHaveCount(1);
  await expect(measurementScene.locator(":scope > picture.measurement-room-image")).toHaveCSS("opacity", "0");
  await expect(measurementScene.locator(":scope > .dimension-overlay")).toHaveCSS("opacity", "0");

  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Refine your concept" })).toBeVisible();
  const customizationScene = page.locator('.concept-scene[data-guided3d-state="ready"]');
  await expect(customizationScene).toBeVisible();
  const customizationCanvas = customizationScene.locator(".guided-3d-canvas");
  await expect(customizationCanvas).toHaveCount(1);
  await expect(customizationCanvas).toHaveAttribute("data-guided3d-instance", instanceId);
  await expect(customizationCanvas).toHaveAttribute("data-show-product", "true");
  await expect(customizationCanvas).toHaveAttribute("data-show-dimensions", "false");
  await expect(customizationScene.locator(":scope > picture.concept-photo")).toHaveCSS("opacity", "0");

  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(customizationCanvas).toHaveAttribute("data-guided3d-instance", instanceId);
  await expect(page.locator(".guided-3d-canvas")).toHaveCount(1);
  await page.getByRole("button", { name: "Reset preview" }).click();
  await page.getByRole("tab", { name: "Details" }).click();
  await expect(page.locator(".guided-3d-canvas")).toHaveCount(1);
  await expect(page.locator(".guided-3d-canvas")).toHaveAttribute("data-guided3d-instance", instanceId);

  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Review your custom concept" })).toBeVisible();
  const reviewCanvas = page.locator('.concept-scene[data-guided3d-state="ready"] .guided-3d-canvas');
  await expect(reviewCanvas).toHaveCount(1);
  await expect(reviewCanvas).toHaveAttribute("data-guided3d-instance", instanceId);
  await expect(reviewCanvas).toHaveAttribute("data-show-product", "true");
  expect(photographicFallbackRequests).toEqual([]);
});

test("representative room and product branches render through one real WebGL lifecycle", async ({ page }) => {
  const runtime = monitorRuntime(page);
  const matrix = [
    ["tv-unit", "framed-tv-wall", "door-wall"],
    ["window-storage", "window-seat-storage", "window-wall"],
    ["radiator-cover", "clean-slat-cover", "window-wall"],
    ["bookcase", "full-open-shelving", "corner-wall"],
    ["bookcase", "drawer-base-shelves", "double-opening"],
    ["floating-storage", "floating-drawer-bank", "fireplace-wall"]
  ].map(([category, style, layout]) => ({ category, style, layout }));

  await page.goto("/privacy.html");
  const result = await page.evaluate(async (cases) => {
    const { createGuidedSceneController } = await import(
      "/guided-configurator-3d.js?e2e=representative-runtime-matrix"
    );
    const host = document.createElement("div");
    host.style.cssText = "position:relative;width:960px;height:640px";
    document.body.replaceChildren(host);

    const states = [];
    const errors = [];
    const controller = createGuidedSceneController({
      onStateChange: (state) => states.push(state),
      onError: (error) => errors.push(String(error?.message || error))
    });
    controller.mount(host);

    const measurements = {
      wallWidth: 120,
      ceilingHeight: 96,
      desiredDepth: 14,
      nicheWidth: 96,
      nicheHeight: 90,
      nicheDepth: 14,
      leftReturn: 12,
      rightReturn: 12,
      windowWidth: 48,
      windowHeight: 42,
      sillHeight: 30,
      doorWidth: 36,
      doorHeight: 80,
      doorLeftDistance: 24,
      doorTrimWidth: 3.5,
      fireplaceWidth: 42,
      fireplaceHeight: 32,
      fireplaceDepth: 8,
      mantelWidth: 60,
      mantelHeight: 48,
      cornerReturn: 48,
      openingLeftDistance: 24,
      openingRightDistance: 24,
      tvScreenSize: 65,
      tvHeight: 33,
      radiatorWidth: 48,
      radiatorHeight: 26,
      radiatorDepth: 9
    };
    const reports = [];

    for (const entry of cases) {
      const updated = controller.update({
        ...entry,
        measurements,
        finish: "natural-oak",
        accentFinish: "warm-linen",
        doorStyle: "shaker",
        hardware: "brass-pull",
        lighting: "warm-led",
        baseStyle: "flush-base",
        topTreatment: "small-crown"
      }, {
        showProduct: true,
        showDimensions: true
      });
      if (!updated) throw new Error(`Scene update rejected for ${entry.category}/${entry.layout}`);
      await waitFor(() => (
        controller.canvas?.dataset.rendered === "true"
        && states.at(-1) === "ready"
      ));

      const labels = [...host.querySelectorAll(".guided-3d-dimension-label:not([hidden])")];
      const rectangles = labels.map((label) => label.getBoundingClientRect());
      const labelsOverlap = rectangles.some((first, index) => (
        rectangles.slice(index + 1).some((second) => (
          first.left < second.right
          && first.right > second.left
          && first.top < second.bottom
          && first.bottom > second.top
        ))
      ));
      reports.push({
        ...entry,
        instance: controller.canvas.dataset.guided3dInstance,
        signature: controller.canvas.dataset.sceneSignature,
        rendered: controller.canvas.dataset.rendered,
        canvasWidth: controller.canvas.width,
        canvasHeight: controller.canvas.height,
        canvasCount: host.querySelectorAll("canvas").length,
        visibleLabels: labels.length,
        labelsOverlap
      });
    }

    controller.renderer.render = () => {
      throw new Error("synthetic draw failure");
    };
    const drawFailureScheduled = controller.update({
      ...cases[0],
      measurements,
      finish: "dark-walnut"
    }, {
      showProduct: true,
      showDimensions: false
    });
    await waitFor(() => states.at(-1) === "fallback");
    const failure = {
      drawFailureScheduled,
      state: states.at(-1),
      runtimeHidden: controller.runtime.hidden,
      errors: [...errors]
    };
    controller.dispose();

    return {
      reports,
      failure,
      canvasCountAfterDispose: host.querySelectorAll("canvas").length
    };

    async function waitFor(predicate) {
      const deadline = performance.now() + 5000;
      while (!predicate()) {
        if (performance.now() > deadline) throw new Error("Timed out waiting for the guided renderer.");
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    }
  }, matrix);

  expect(result.reports).toHaveLength(matrix.length);
  expect(new Set(result.reports.map((report) => report.instance)).size).toBe(1);
  expect(new Set(result.reports.map((report) => report.signature)).size).toBe(matrix.length);
  result.reports.forEach((report) => {
    expect(report.rendered, `${report.category}/${report.layout} rendered`).toBe("true");
    expect(report.canvasWidth, `${report.category}/${report.layout} canvas width`).toBeGreaterThan(100);
    expect(report.canvasHeight, `${report.category}/${report.layout} canvas height`).toBeGreaterThan(100);
    expect(report.canvasCount, `${report.category}/${report.layout} canvas count`).toBe(1);
    expect(report.visibleLabels, `${report.category}/${report.layout} visible callouts`).toBeGreaterThanOrEqual(3);
    expect(report.labelsOverlap, `${report.category}/${report.layout} callout collisions`).toBe(false);
  });
  expect(result.failure.drawFailureScheduled).toBe(true);
  expect(result.failure.state).toBe("fallback");
  expect(result.failure.runtimeHidden).toBe(true);
  expect(result.failure.errors).toContain("synthetic draw failure");
  expect(result.canvasCountAfterDispose).toBe(0);
  expect(runtime).toEqual([]);
});

test("Between Openings remains visible through customization and review", async ({ page }) => {
  await openFreshProject(page);
  const fullShelving = page.locator('[data-product-choice="open-shelving"]');
  await fullShelving.click();
  await expect(fullShelving).toHaveAttribute("aria-pressed", "true");
  await page.locator("[data-continue]").click();
  await chooseLayout(page, "Between Openings");
  await page.locator("[data-continue]").click();

  await expect(page.locator(".selected-layout-chip")).toContainText("Between Openings");
  await expect(page.locator('[data-measurement="openingLeftDistance"]')).toBeVisible();
  await expect(page.locator('[data-measurement="openingRightDistance"]')).toBeVisible();
  const measurementCanvas = page.locator(
    '.measurement-room[data-layout="double-opening"] .guided-3d-canvas'
  );
  await expect(measurementCanvas).toHaveAttribute("data-rendered", "true");
  await expect(measurementCanvas).toHaveAttribute("data-scene-layout", "double-opening");
  const sceneInstance = await measurementCanvas.getAttribute("data-guided3d-instance");
  await page.locator("[data-continue]").click();

  const customizationPreview = page.locator('.concept-preview[data-layout="double-opening"]');
  const customizationContext = customizationPreview.locator('[data-layout-context="double-opening"]');
  const productAsset = "assets/photos/configurator/concept-full-shelving-between-openings-v1.png";
  await expect(customizationPreview).toHaveAttribute("data-preview-asset", productAsset);
  await expect(customizationContext).toBeVisible();
  await expect(customizationContext).toHaveAccessibleName("Selected room condition: Between Openings");
  await expect(customizationContext).toHaveAttribute(
    "data-layout-context-asset",
    "assets/photos/configurator/room-layouts/room-double-opening-v1.png"
  );
  await expect(customizationContext.locator(".concept-layout-context-visual")).toHaveCount(0);
  await expect(customizationPreview.locator("img.concept-photo")).toHaveAttribute(
    "data-fallback-src",
    "assets/photos/configurator/concept-full-shelving-between-openings-v1.png"
  );
  await expect(customizationPreview.locator(".concept-scene")).toHaveAttribute("data-guided3d-state", "ready");
  expect(await customizationPreview.locator("img.concept-photo").evaluate(
    (image) => (
      image.currentSrc.startsWith("data:image/gif")
      && image.naturalWidth === 1
      && image.naturalHeight === 1
    )
  )).toBe(true);
  const customizationCanvas = customizationPreview.locator(".guided-3d-canvas");
  await expect(customizationCanvas).toHaveAttribute("data-guided3d-instance", sceneInstance);
  await expect(customizationCanvas).toHaveAttribute("data-show-product", "true");
  await expect(customizationCanvas).toHaveAttribute("data-show-dimensions", "false");
  await expect(customizationPreview.locator("[data-room-layer], [data-product-layer]")).toHaveCount(0);
  await expect(customizationPreview.locator("canvas")).toHaveCount(1);

  await page.getByRole("button", { name: "Charcoal", exact: true }).click();
  await expect(customizationPreview).toHaveAttribute("data-finish", "charcoal");
  await expect(customizationContext).toBeVisible();
  await page.locator("[data-continue]").click();

  const reviewPreview = page.locator('.concept-preview[data-layout="double-opening"]');
  await expect(page.locator('[data-summary-value="layout"]')).toHaveText("Between Openings");
  await expect(reviewPreview).toHaveAttribute("data-preview-asset", productAsset);
  await expect(reviewPreview).toHaveAttribute("data-finish", "charcoal");
  await expect(reviewPreview.locator(".guided-3d-canvas")).toHaveAttribute(
    "data-guided3d-instance",
    sceneInstance
  );
  await expect(reviewPreview.locator("[data-room-layer], [data-product-layer]")).toHaveCount(0);
  await expect(reviewPreview.locator('[data-layout-context="double-opening"]')).toBeVisible();
  await expect(reviewPreview.locator('[data-layout-context="double-opening"]')).toHaveAccessibleName(
    "Selected room condition: Between Openings"
  );
});

test("TV Unit keeps the exact Between Openings room through customization, review, and reload", async ({ page }) => {
  const roomAsset = "assets/photos/configurator/room-layouts/room-double-opening-v1.png";
  const productAsset = "assets/photos/configurator/integrated/tv-unit/framed-tv-wall/double-opening-v2.png";
  const viewports = [
    { name: "desktop", width: 1180, height: 820 },
    { name: "iPad landscape", width: 1280, height: 720 }
  ];

  for (const viewport of viewports) {
    await test.step(viewport.name, async () => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openFreshProject(page);
      await continueToLayouts(page, "TV Unit");
      await chooseLayout(page, "Between Openings");
      await page.locator("[data-continue]").click();

      const stepThreeRoom = page.locator(
        '.measurement-room[data-layout="double-opening"] img.measurement-room-image'
      );
      await expect(stepThreeRoom).toBeVisible();
      await expect.poll(() => stepThreeRoom.evaluate((image) => (
        image.complete
          && image.naturalWidth > 0
          && /room-double-opening-v1\.(?:avif|png)$/.test(new URL(image.currentSrc).pathname)
      ))).toBe(true);
      const stepThreeRoomSource = await stepThreeRoom.evaluate((image) => image.currentSrc);

      await page.locator("[data-continue]").click();
      await expect(page.getByRole("heading", { name: "Refine your concept" })).toBeVisible();

      const customizationPreview = page.locator(
        '.concept-preview[data-category="tv-unit"][data-layout="double-opening"]'
      );
      const customizationRoom = customizationPreview.locator("[data-room-layer] img");
      const customizationProduct = customizationPreview.locator("[data-product-layer]");
      await expect(customizationPreview).toHaveAttribute("data-preview-render-mode", "layered");
      await expect(customizationPreview).toHaveAttribute("data-room-asset", roomAsset);
      await expect(customizationPreview).toHaveAttribute("data-product-asset", productAsset);
      await expect(customizationProduct).toHaveAttribute(
        "data-installation-envelope-id",
        "tv-unit-double-opening-v2-cabinet"
      );
      await expect(customizationProduct).toHaveAttribute(
        "data-installation-envelope",
        "0.267,0.195,0.466,0.61"
      );
      await expect.poll(() => customizationRoom.evaluate((image) => (
        image.complete && image.naturalWidth > 0 ? image.currentSrc : ""
      ))).toBe(stepThreeRoomSource);
      await expect.poll(() => customizationProduct.locator("img").evaluate((image) => (
        image.complete
          && image.naturalWidth > 0
          && /double-opening-v2\.(?:avif|png)$/.test(new URL(image.currentSrc).pathname)
      ))).toBe(true);

      const customizationLayers = await customizationPreview.evaluate((preview) => {
        const scene = preview.querySelector("[data-concept-scene]").getBoundingClientRect();
        const room = preview.querySelector("[data-room-layer]").getBoundingClientRect();
        const product = preview.querySelector("[data-product-layer]");
        const productRect = product.getBoundingClientRect();
        const productStyle = getComputedStyle(product);
        return {
          roomFillsScene: (
            Math.abs(room.left - scene.left) <= 1
            && Math.abs(room.top - scene.top) <= 1
            && Math.abs(room.right - scene.right) <= 1
            && Math.abs(room.bottom - scene.bottom) <= 1
          ),
          productInsideScene: (
            productRect.left >= scene.left - 1
            && productRect.top >= scene.top - 1
            && productRect.right <= scene.right + 1
            && productRect.bottom <= scene.bottom + 1
          ),
          productIsConstrained: productStyle.clipPath !== "none" || productStyle.maskImage !== "none"
        };
      });
      expect(customizationLayers).toEqual({
        roomFillsScene: true,
        productInsideScene: true,
        productIsConstrained: true
      });

      await page.getByRole("button", { name: "Charcoal", exact: true }).click();
      await expect(customizationPreview).toHaveAttribute("data-finish", "charcoal");
      await page.waitForTimeout(250);
      await page.locator("[data-continue]").click();
      await expect(page.getByRole("heading", { name: "Review your custom concept" })).toBeVisible();
      const reviewPreview = page.locator(
        '.concept-preview[data-category="tv-unit"][data-layout="double-opening"]'
      );
      await expect(reviewPreview).toHaveAttribute("data-room-asset", roomAsset);
      await expect(reviewPreview).toHaveAttribute("data-product-asset", productAsset);
      await expect(reviewPreview.locator("[data-product-layer]")).toHaveAttribute(
        "data-installation-envelope",
        /.+/
      );
      await expect.poll(() => reviewPreview.locator("[data-room-layer] img").evaluate((image) => (
        image.complete && image.naturalWidth > 0 ? image.currentSrc : ""
      ))).toBe(stepThreeRoomSource);

      await page.reload({ waitUntil: "networkidle" });
      await expect(page).toHaveURL(/configurator\.html#step-4$/);
      await expect(page.getByRole("heading", { name: "Refine your concept" })).toBeVisible();
      const reloadedCustomizationPreview = page.locator(
        '.concept-preview[data-category="tv-unit"][data-layout="double-opening"]'
      );
      await expect(reloadedCustomizationPreview).toHaveAttribute("data-room-asset", roomAsset);
      await expect(reloadedCustomizationPreview).toHaveAttribute("data-product-asset", productAsset);
      await expect.poll(() => reloadedCustomizationPreview.locator("[data-room-layer] img").evaluate((image) => (
        image.complete && image.naturalWidth > 0 ? image.currentSrc : ""
      ))).toBe(stepThreeRoomSource);

      await page.locator("[data-continue]").click();
      await expect(page.getByRole("heading", { name: "Review your custom concept" })).toBeVisible();
      const reloadedPreview = page.locator(
        '.concept-preview[data-category="tv-unit"][data-layout="double-opening"]'
      );
      await expect(reloadedPreview).toHaveAttribute("data-room-asset", roomAsset);
      await expect(reloadedPreview).toHaveAttribute("data-product-asset", productAsset);
      await expect.poll(() => reloadedPreview.locator("[data-room-layer] img").evaluate((image) => (
        image.complete && image.naturalWidth > 0 ? image.currentSrc : ""
      ))).toBe(stepThreeRoomSource);
    });
  }
});

test("Between Openings keeps every bookcase construction in the selected room", async ({ page }) => {
  const variants = [
    {
      product: "cabinet-shelves",
      style: "cabinet-base-shelves",
      asset: "assets/photos/configurator/concept-cabinets-shelves-between-openings-v1.png"
    },
    {
      product: "drawer-shelves",
      style: "drawer-base-shelves",
      asset: "assets/photos/configurator/concept-drawers-shelves-between-openings-v1.png"
    },
    {
      product: "open-shelving",
      style: "full-open-shelving",
      asset: "assets/photos/configurator/concept-full-shelving-between-openings-v1.png"
    }
  ];

  for (const variant of variants) {
    await openFreshProject(page);
    await page.locator(`[data-product-choice="${variant.product}"]`).click();
    await page.locator("[data-continue]").click();
    await chooseLayout(page, "Between Openings");
    await page.locator("[data-continue]").click();
    await page.locator("[data-continue]").click();

    const preview = page.locator('.concept-preview[data-layout="double-opening"]');
    await expect(preview).toHaveAttribute("data-preview-asset", variant.asset);
    await expect(preview).toHaveAttribute("data-preview-render-mode", "integrated");
    await expect(preview.locator("img.concept-photo")).toHaveAttribute("data-fallback-src", variant.asset);
    await expect(preview.locator(".concept-scene")).toHaveAttribute("data-guided3d-state", "ready");
    expect(await preview.locator("img.concept-photo").evaluate(
      (image) => (
        image.currentSrc.startsWith("data:image/gif")
        && image.naturalWidth === 1
        && image.naturalHeight === 1
      )
    )).toBe(true);
    await expect(preview.locator('[data-layout-context="double-opening"]')).toHaveAccessibleName(
      "Selected room condition: Between Openings"
    );
  }
});

test("Door Wall keeps the selected drawer construction through customization and review", async ({ page }) => {
  const asset = "assets/photos/configurator/integrated/bookcase/drawer-base-shelves/door-wall-v1.png";
  const avifAsset = asset.replace(/\.png$/, ".avif");
  const finishMaskAsset = asset.replace(/-v1\.png$/, "-finish-mask-v1.png");
  let finishMaskStatus = 0;
  page.on("response", (response) => {
    if (new URL(response.url()).pathname.endsWith(finishMaskAsset)) {
      finishMaskStatus = response.status();
    }
  });

  await openFreshProject(page);
  await page.locator('[data-product-choice="drawer-shelves"]').click();
  await page.locator("[data-continue]").click();
  await chooseLayout(page, "Door Wall");
  await page.locator("[data-continue]").click();
  await expect(page.locator(".selected-layout-chip")).toContainText("Door Wall");
  await expect(page.locator('[data-measurement="doorWidth"]')).toBeVisible();
  await expect(page.locator('[data-measurement="doorHeight"]')).toBeVisible();
  expect(finishMaskStatus).toBe(0);
  await page.locator("[data-continue]").click();

  const customizationPreview = page.locator('.concept-preview[data-layout="door-wall"]');
  await expect(customizationPreview).toHaveAttribute(
    "data-preview-key",
    "bookcase:drawer-base-shelves:door-wall"
  );
  await expect(customizationPreview).toHaveAttribute("data-style", "drawer-base-shelves");
  await expect(customizationPreview).toHaveAttribute("data-preview-asset", asset);
  await expect(customizationPreview).toHaveAttribute(
    "data-room-asset",
    "assets/photos/configurator/room-layouts/room-door-wall-v1.png"
  );
  await expect(customizationPreview).toHaveAttribute("data-product-asset", asset);
  await expect(customizationPreview).toHaveAttribute("data-preview-render-mode", "layered");
  await expect(customizationPreview.locator('[data-layout-context="door-wall"]')).toHaveAccessibleName(
    "Selected room condition: Door Wall"
  );
  await expect(customizationPreview.locator("img.concept-photo")).toHaveAttribute("data-fallback-src", asset);
  await expect(customizationPreview.locator("source[data-fallback-srcset]")).toHaveAttribute(
    "data-fallback-srcset",
    avifAsset
  );
  await expect(customizationPreview.locator("image[data-fallback-href]")).toHaveAttribute(
    "data-fallback-href",
    finishMaskAsset
  );
  expect(finishMaskStatus).toBe(0);

  await page.getByRole("tab", { name: "Finish" }).click();
  await page.getByRole("button", { name: "Charcoal", exact: true }).click();
  await expect(customizationPreview).toHaveAttribute("data-finish", "charcoal");
  await expect(customizationPreview.locator(".concept-finish-overlay")).toBeVisible();
  const customizationImageSource = await customizationPreview.locator("img.concept-photo").evaluate(
    (image) => image.currentSrc
  );

  await page.locator("[data-continue]").click();
  const reviewPreview = page.locator('.concept-preview[data-layout="door-wall"]');
  await expect(page.locator('[data-summary-value="layout"]')).toHaveText("Door Wall");
  await expect(page.locator('[data-summary-value="product"]')).toHaveText("Drawers + Shelves");
  await expect(reviewPreview).toHaveAttribute("data-preview-key", "bookcase:drawer-base-shelves:door-wall");
  await expect(reviewPreview).toHaveAttribute("data-preview-asset", asset);
  await expect(reviewPreview).toHaveAttribute("data-preview-render-mode", "integrated");
  const reviewImageSource = await reviewPreview.locator("img.concept-photo").evaluate(
    (image) => image.currentSrc
  );
  expect(reviewImageSource).toBe(customizationImageSource);
  expect(reviewImageSource.startsWith("data:image/gif")).toBe(true);
  expect(finishMaskStatus).toBe(0);
});

test("Right Niche measurement guides explain every visible dimension and keep preview metadata off the furniture", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openFreshProject(page);
  await continueToLayouts(page);
  await chooseLayout(page, "Right Niche");
  await page.locator("[data-continue]").click();

  const diagram = page.locator(".measurement-diagram-card");
  const room = diagram.locator(".measurement-room");
  const guideLabels = diagram.locator(".measurement-annotation-label");
  await expect(room.locator(":scope > .dimension-overlay")).toBeVisible();
  await expect(guideLabels.locator(".measurement-annotation-code")).toHaveText([
    "A",
    "B",
    "C",
    "D",
    "E",
    "F"
  ]);
  await expect(guideLabels.locator(".measurement-annotation-name")).toHaveText([
    "Wall width",
    "Ceiling height",
    "Built-in depth",
    "Niche width",
    "Niche height",
    "Niche depth"
  ]);
  await expect(diagram.locator("[data-dimension-value]")).toHaveText([
    "120 in",
    "96 in",
    "14 in",
    "96 in",
    "96 in",
    "14 in"
  ]);
  await expect(diagram.locator("[data-dimension-span]")).toHaveCount(6);
  await expect(diagram.locator("[data-dimension-line]")).toHaveCount(6);
  await expect(diagram.locator("[data-dimension-extension]")).toHaveCount(12);
  await expect(page.locator('[data-measurement-row="wallWidth"] .measurement-code')).toHaveText("A");
  await expect(page.locator('[data-measurement-row="ceilingHeight"] .measurement-code')).toHaveText("B");
  await expect(page.locator('[data-measurement-row="desiredDepth"] .measurement-code')).toHaveText("C");

  const guideGeometry = await room.evaluate((element) => {
    const roomRect = element.getBoundingClientRect();
    const callouts = [...element.querySelectorAll(".measurement-annotation-copy")].map((callout) => {
      const rect = callout.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    });
    const overlaps = (first, second) => (
      first.left < second.right
      && first.right > second.left
      && first.top < second.bottom
      && first.bottom > second.top
    );
    return {
      allInsideRoom: callouts.every((rect) => (
        rect.left >= roomRect.left - 1
        && rect.right <= roomRect.right + 1
        && rect.top >= roomRect.top - 1
        && rect.bottom <= roomRect.bottom + 1
      )),
      overlappingPairs: callouts.flatMap((first, index) => (
        callouts.slice(index + 1).filter((second) => overlaps(first, second))
      )).length
    };
  });
  expect(guideGeometry.allInsideRoom).toBe(true);
  expect(guideGeometry.overlappingPairs).toBe(0);

  await page.locator('[data-measurement="wallWidth"]').fill("132");
  await expect(diagram.locator('[data-dimension-chip="wallWidth"] [data-dimension-value]')).toHaveText("132 in");
  await page.locator("[data-continue]").click();

  const preview = page.locator('.concept-preview[data-layout="right-niche"]');
  const metadata = preview.locator(".concept-preview-meta");
  const context = preview.locator('[data-layout-context="right-niche"]');
  await expect(preview).toHaveAttribute(
    "data-preview-asset",
    "assets/photos/configurator/integrated/bookcase/cabinet-base-shelves/right-niche-v1.png"
  );
  await expect(preview).toHaveAttribute(
    "data-room-asset",
    "assets/photos/configurator/room-layouts/room-right-niche-v1.png"
  );
  await expect(preview).toHaveAttribute(
    "data-product-asset",
    "assets/photos/configurator/integrated/bookcase/cabinet-base-shelves/right-niche-v1.png"
  );
  await expect(preview).toHaveAttribute("data-preview-render-mode", "layered");
  await expect(context).toContainText("Right Niche");
  await expect(preview.locator("[data-room-layer]")).toBeVisible();
  await expect(preview.locator("[data-product-layer]")).toBeVisible();
  const previewGeometry = await preview.evaluate((element) => {
    const meta = element.querySelector(".concept-preview-meta").getBoundingClientRect();
    const scene = element.querySelector(".concept-scene").getBoundingClientRect();
    const finish = element.querySelector(".concept-finish-caption").getBoundingClientRect();
    const contextRect = element.querySelector("[data-layout-context]").getBoundingClientRect();
    const overlaps = (first, second) => (
      first.left < second.right
      && first.right > second.left
      && first.top < second.bottom
      && first.bottom > second.top
    );
    return {
      metadataBeforeScene: meta.bottom <= scene.top + 1,
      contextBeforeScene: contextRect.bottom <= scene.top + 1,
      labelsOverlap: overlaps(finish, contextRect)
    };
  });
  expect(previewGeometry.metadataBeforeScene).toBe(true);
  expect(previewGeometry.contextBeforeScene).toBe(true);
  expect(previewGeometry.labelsOverlap).toBe(false);
  await expect(metadata).toBeVisible();
});

test("TV measurement diagram keeps the screen centered and its callouts separate at landscape tablet size", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openFreshProject(page);
  await continueToLayouts(page, "TV Unit");
  await chooseLayout(page, "Clear Wall");
  await page.locator("[data-continue]").click();

  const diagram = page.locator(".measurement-diagram-card");
  const room = diagram.locator(".measurement-room");
  const tv = room.locator(".measurement-feature");
  const diagonal = diagram.locator('[data-dimension-chip="tvScreenSize"]');
  const height = diagram.locator('[data-dimension-chip="tvHeight"]');

  await expect(room).toHaveAttribute("data-feature", "tv");
  await expect(tv).toBeVisible();
  await expect(diagonal.locator(".measurement-annotation-code")).toHaveText("D");
  await expect(diagonal.locator(".measurement-annotation-name")).toHaveText("TV diagonal");
  await expect(height.locator(".measurement-annotation-code")).toHaveText("E");
  await expect(height.locator(".measurement-annotation-name")).toHaveText("TV height");
  await expect(diagram.locator(".measurement-annotation-code")).toHaveText([
    "A",
    "B",
    "C",
    "D",
    "E"
  ]);
  await expect(diagram.locator(".measurement-annotation-name")).toHaveText([
    "Wall width",
    "Ceiling height",
    "Built-in depth",
    "TV diagonal",
    "TV height"
  ]);
  await expect(diagram.locator('[data-dimension-span="tvScreenSize"]')).toHaveAttribute("data-dimension-axis", "diagonal");
  await expect(diagram.locator('[data-dimension-span="tvHeight"]')).toHaveAttribute("data-dimension-axis", "vertical");
  await expect(diagram.locator('[data-dimension-extension="tvScreenSize"]')).toHaveCount(2);
  await expect(diagram.locator('[data-dimension-extension="tvHeight"]')).toHaveCount(2);

  const geometry = await diagram.evaluate((element) => {
    const bounds = (selector) => {
      const rect = element.querySelector(selector).getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        centerX: rect.left + rect.width / 2
      };
    };
    const diagramRect = element.getBoundingClientRect();
    const tvRect = bounds(".measurement-feature");
    const diagonalRect = bounds('[data-dimension-chip="tvScreenSize"]');
    const heightRect = bounds('[data-dimension-chip="tvHeight"]');
    const lineLength = (fieldId) => {
      const line = element.querySelector(`[data-dimension-line="${fieldId}"]`);
      const matrix = line.getScreenCTM();
      const point = (x, y) => {
        const svgPoint = line.ownerSVGElement.createSVGPoint();
        svgPoint.x = x;
        svgPoint.y = y;
        return svgPoint.matrixTransform(matrix);
      };
      const start = point(line.x1.baseVal.value, line.y1.baseVal.value);
      const end = point(line.x2.baseVal.value, line.y2.baseVal.value);
      return Math.hypot(end.x - start.x, end.y - start.y);
    };
    const overlaps = (first, second) => (
      first.left < second.right
      && first.right > second.left
      && first.top < second.bottom
      && first.bottom > second.top
    );
    return {
      tvCenterDelta: Math.abs(tvRect.centerX - (diagramRect.left + diagramRect.width / 2)),
      calloutsOverlap: overlaps(diagonalRect, heightRect),
      diagonalLineLength: lineLength("tvScreenSize"),
      heightLineLength: lineLength("tvHeight"),
      allInsideDiagram: [tvRect, diagonalRect, heightRect].every((rect) => (
        rect.left >= diagramRect.left
        && rect.right <= diagramRect.right
        && rect.top >= diagramRect.top
        && rect.bottom <= diagramRect.bottom
      ))
    };
  });

  expect(geometry.tvCenterDelta).toBeLessThanOrEqual(2);
  expect(geometry.calloutsOverlap).toBe(false);
  expect(geometry.diagonalLineLength).toBeGreaterThan(20);
  expect(geometry.heightLineLength).toBeGreaterThan(20);
  expect(geometry.allInsideDiagram).toBe(true);
});

test("all ten bookcase layouts keep architectural dimension lines and labels valid at desktop and iPad landscape sizes", async ({ page }) => {
  test.slow();

  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 1180, height: 820 }
  ]) {
    await page.setViewportSize(viewport);
    await openFreshProject(page);
    await continueToLayouts(page);

    for (const roomLayout of sharedLayouts) {
      const expectedDimensions = bookcaseMeasurementDimensions[roomLayout.id];
      await chooseLayout(page, roomLayout.label);
      await page.locator("[data-continue]").click();

      const room = page.locator(`.measurement-room[data-layout="${roomLayout.id}"]`);
      const drawing = room.locator("[data-dimension-drawing]");
      const spans = drawing.locator("[data-dimension-span]");
      const labels = room.locator("[data-dimension-label]");
      const context = `${viewport.width}x${viewport.height} ${roomLayout.label}`;

      await expect(room, `${context} room`).toBeVisible();
      await expect(drawing, `${context} drawing`).toBeVisible();
      await expect(spans, `${context} spans`).toHaveCount(expectedDimensions.length);
      await expect(labels, `${context} labels`).toHaveCount(expectedDimensions.length);
      expect(
        await spans.evaluateAll((elements) => elements.map((element) => [
          element.dataset.dimensionSpan,
          element.dataset.dimensionCode
        ])),
        `${context} ordered fields and codes`
      ).toEqual(expectedDimensions);
      expect(
        await labels.evaluateAll((elements) => elements.map((element) => [
          element.dataset.dimensionLabel,
          element.dataset.dimensionCode
        ])),
        `${context} ordered label fields and codes`
      ).toEqual(expectedDimensions);

      await expect.poll(
        () => room.locator("img.measurement-room-image").evaluate((image) => (
          image.complete
          && image.currentSrc.startsWith("data:image/gif")
          && image.naturalWidth === 1
          && image.naturalHeight === 1
          && Boolean(image.dataset.fallbackSrc)
        )),
        { message: `${context} room fallback remains deferred while 3D is ready` }
      ).toBe(true);

      const geometry = await room.evaluate((element, expectedCount) => {
        const tolerance = 1;
        const roomRect = element.getBoundingClientRect();
        const drawingElement = element.querySelector("[data-dimension-drawing]");
        const imageElement = element.querySelector("img.measurement-room-image");
        const spanElements = [...element.querySelectorAll("[data-dimension-span]")];
        const visibleLabels = [...element.querySelectorAll("[data-dimension-label] .measurement-annotation-copy")]
          .filter((label) => {
            const style = getComputedStyle(label);
            const rect = label.getBoundingClientRect();
            return (
              style.display !== "none"
              && style.visibility !== "hidden"
              && Number(style.opacity) > 0
              && rect.width > 0
              && rect.height > 0
            );
          })
          .map((label) => {
            const rect = label.getBoundingClientRect();
            return {
              fieldId: label.closest("[data-dimension-label]").dataset.dimensionLabel,
              left: rect.left,
              right: rect.right,
              top: rect.top,
              bottom: rect.bottom
            };
          });
        const overlaps = (first, second) => (
          first.left < second.right - tolerance
          && first.right > second.left + tolerance
          && first.top < second.bottom - tolerance
          && first.bottom > second.top + tolerance
        );
        const lineLength = (line) => {
          const matrix = line.getScreenCTM();
          const point = (x, y) => {
            const svgPoint = line.ownerSVGElement.createSVGPoint();
            svgPoint.x = x;
            svgPoint.y = y;
            return svgPoint.matrixTransform(matrix);
          };
          const start = point(line.x1.baseVal.value, line.y1.baseVal.value);
          const end = point(line.x2.baseVal.value, line.y2.baseVal.value);
          return Math.hypot(end.x - start.x, end.y - start.y);
        };
        const spanReports = spanElements.map((span) => {
          const fieldId = span.dataset.dimensionSpan;
          const line = span.querySelector(`[data-dimension-line="${CSS.escape(fieldId)}"]`);
          const extensions = [...span.querySelectorAll(`[data-dimension-extension="${CSS.escape(fieldId)}"]`)];
          const lineStyle = getComputedStyle(line);
          return {
            fieldId,
            endStyle: span.dataset.dimensionEndStyle,
            lineCount: span.querySelectorAll(`[data-dimension-line="${CSS.escape(fieldId)}"]`).length,
            extensionCount: extensions.length,
            ticks: extensions.map((extension) => extension.dataset.dimensionTick),
            endTickCount: extensions.filter((extension) => extension.classList.contains("is-end-tick")).length,
            arrowCount: span.querySelectorAll("[data-dimension-end]").length,
            nestedLabelCount: span.querySelectorAll(":scope [data-dimension-label]").length,
            visibleStroke: lineStyle.stroke !== "none" && Number(lineStyle.opacity) > 0,
            lineLength: lineLength(line)
          };
        });
        const overlappingPairs = visibleLabels.flatMap((first, index) => (
          visibleLabels.slice(index + 1)
            .filter((second) => overlaps(first, second))
            .map((second) => `${first.fieldId}/${second.fieldId}`)
        ));

        return {
          expectedCount,
          drawingInsideRoom: (() => {
            const rect = drawingElement.getBoundingClientRect();
            return (
              rect.left >= roomRect.left - tolerance
              && rect.right <= roomRect.right + tolerance
              && rect.top >= roomRect.top - tolerance
              && rect.bottom <= roomRect.bottom + tolerance
            );
          })(),
          oneResponsiveOverlay: element.querySelectorAll(":scope > svg[data-dimension-overlay]").length === 1,
          viewBoxMatchesImage: (() => {
            const viewBox = drawingElement.viewBox.baseVal;
            return Math.abs(
              (viewBox.width / viewBox.height)
              - (imageElement.naturalWidth / imageElement.naturalHeight)
            ) < 0.000001;
          })(),
          coverTransformsMatch: (
            drawingElement.getAttribute("preserveAspectRatio") === "xMidYMid slice"
            && getComputedStyle(imageElement).objectFit === "cover"
            && getComputedStyle(imageElement).objectPosition === "50% 50%"
          ),
          pointerEventsDisabled: (
            getComputedStyle(drawingElement).pointerEvents === "none"
            && spanElements.every((span) => getComputedStyle(span).pointerEvents === "none")
          ),
          visibleLabelCount: visibleLabels.length,
          labelsInsideRoom: visibleLabels.every((rect) => (
            rect.left >= roomRect.left - tolerance
            && rect.right <= roomRect.right + tolerance
            && rect.top >= roomRect.top - tolerance
            && rect.bottom <= roomRect.bottom + tolerance
          )),
          overlappingPairs,
          spanReports,
          horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
          verticalOverflow: document.documentElement.scrollHeight - window.innerHeight
        };
      }, expectedDimensions.length);

      expect(geometry.drawingInsideRoom, `${context} drawing stays inside room`).toBe(true);
      expect(geometry.oneResponsiveOverlay, `${context} uses one SVG overlay`).toBe(true);
      expect(geometry.viewBoxMatchesImage, `${context} SVG ratio matches the room image`).toBe(true);
      expect(geometry.coverTransformsMatch, `${context} image and SVG share one cover transform`).toBe(true);
      expect(geometry.pointerEventsDisabled, `${context} overlay ignores pointer events`).toBe(true);
      expect(geometry.visibleLabelCount, `${context} visible label count`).toBe(expectedDimensions.length);
      expect(geometry.labelsInsideRoom, `${context} labels stay inside room`).toBe(true);
      expect(geometry.overlappingPairs, `${context} labels do not overlap`).toEqual([]);
      expect(geometry.horizontalOverflow, `${context} horizontal overflow`).toBeLessThanOrEqual(1);
      if (viewport.width === 1280 && viewport.height === 720) {
        expect(geometry.verticalOverflow, `${context} vertical overflow`).toBeLessThanOrEqual(1);
      }
      for (const span of geometry.spanReports) {
        expect(span.lineCount, `${context} ${span.fieldId} main line`).toBe(1);
        expect(span.extensionCount, `${context} ${span.fieldId} witness lines`).toBe(2);
        expect(span.ticks, `${context} ${span.fieldId} witness endpoints`).toEqual(["start", "end"]);
        expect(span.nestedLabelCount, `${context} ${span.fieldId} nested label`).toBe(1);
        if (span.endStyle === "tick") {
          expect(span.endTickCount, `${context} ${span.fieldId} architectural end ticks`).toBe(2);
          expect(span.arrowCount, `${context} ${span.fieldId} omits arrowheads`).toBe(0);
        } else {
          expect(span.endStyle, `${context} ${span.fieldId} arrow end style`).toBe("arrow");
          expect(span.arrowCount, `${context} ${span.fieldId} arrowheads`).toBe(2);
        }
        expect(span.visibleStroke, `${context} ${span.fieldId} stroke`).toBe(true);
        expect(span.lineLength, `${context} ${span.fieldId} rendered line length`).toBeGreaterThan(10);
      }

      await page.locator("[data-back]").click();
      await expect(page.getByRole("heading", { name: "Choose the room condition that matches your space" })).toBeVisible();
    }
  }
});

test("dense iPad Room & Size keeps every Between Openings dimension card readable", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 960 });
  await openFreshProject(page);
  await continueToLayouts(page, "TV Unit");
  await chooseLayout(page, "Between Openings");
  await page.locator("[data-continue]").click();

  const layout = page.locator(".measurement-layout--dense");
  const room = page.locator('.measurement-room[data-layout="double-opening"]');
  const drawing = room.locator("svg[data-dimension-overlay]");
  await expect(layout).toBeVisible();
  await expect(drawing).toHaveAttribute("viewBox", "0 0 1536 1024");
  await expect(drawing).toHaveAttribute("preserveAspectRatio", "xMidYMid slice");

  const geometry = await page.evaluate(() => {
    const layoutElement = document.querySelector(".measurement-layout--dense");
    const panel = layoutElement.querySelector(".measurement-panel");
    const diagram = layoutElement.querySelector(".measurement-diagram-card");
    const roomElement = diagram.querySelector('.measurement-room[data-layout="double-opening"]');
    const drawingElement = roomElement.querySelector("svg[data-dimension-overlay]");
    const roomRect = roomElement.getBoundingClientRect();
    const lineSource = (fieldId) => {
      const line = drawingElement.querySelector(`[data-dimension-line="${CSS.escape(fieldId)}"]`);
      return [
        line.x1.baseVal.value,
        line.y1.baseVal.value,
        line.x2.baseVal.value,
        line.y2.baseVal.value
      ];
    };
    const labels = [...roomElement.querySelectorAll("[data-dimension-label]")].map((label) => {
      const rect = label.querySelector(".measurement-annotation-card").getBoundingClientRect();
      return {
        fieldId: label.dataset.dimensionLabel,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom
      };
    });
    const overlaps = (first, second) => (
      first.left < second.right - 1
      && first.right > second.left + 1
      && first.top < second.bottom - 1
      && first.bottom > second.top + 1
    );
    return {
      panelWidth: panel.getBoundingClientRect().width,
      diagramWidth: diagram.getBoundingClientRect().width,
      lineSources: {
        wallWidth: lineSource("wallWidth"),
        ceilingHeight: lineSource("ceilingHeight"),
        desiredDepth: lineSource("desiredDepth"),
        openingLeftDistance: lineSource("openingLeftDistance"),
        openingRightDistance: lineSource("openingRightDistance")
      },
      clippedLabels: labels
        .filter((label) => (
          label.left < roomRect.left - 1
          || label.right > roomRect.right + 1
          || label.top < roomRect.top - 1
          || label.bottom > roomRect.bottom + 1
        ))
        .map((label) => label.fieldId),
      labelOverlaps: labels.flatMap((first, index) => (
        labels.slice(index + 1)
          .filter((second) => overlaps(first, second))
          .map((second) => `${first.fieldId}/${second.fieldId}`)
      ))
    };
  });

  expect(geometry.panelWidth).toBeGreaterThanOrEqual(450);
  expect(geometry.panelWidth).toBeLessThanOrEqual(475);
  expect(geometry.diagramWidth).toBeGreaterThanOrEqual(700);
  expect(geometry.lineSources).toEqual({
    wallWidth: [304, 244, 1230, 244],
    ceilingHeight: [330, 150, 330, 785],
    desiredDepth: [1230, 785, 1310, 828],
    openingLeftDistance: [304, 690, 520, 690],
    openingRightDistance: [1016, 690, 1230, 690]
  });
  expect(geometry.clippedLabels).toEqual([]);
  expect(geometry.labelOverlaps).toEqual([]);
});

test("Door Wall dimension overlay stays on the measured architecture at desktop and iPad landscape sizes", async ({ page }) => {
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 1180, height: 820 }
  ]) {
    await page.setViewportSize(viewport);
    await openFreshProject(page);
    await continueToLayouts(page);
    await chooseLayout(page, "Door Wall");
    await page.locator("[data-continue]").click();

    const room = page.locator('.measurement-room[data-layout="door-wall"]');
    const drawing = room.locator("svg[data-dimension-overlay]");
    const context = `${viewport.width}x${viewport.height} Door Wall`;
    await expect(drawing, `${context} overlay`).toHaveCount(1);
    await expect(drawing).toHaveAttribute("viewBox", "0 0 1536 1024");
    await expect(drawing).toHaveAttribute("preserveAspectRatio", "xMidYMid slice");
    await expect(room.locator(":scope > [data-dimension-label]")).toHaveCount(0);

    const geometry = await room.evaluate((element) => {
      const svg = element.querySelector("svg[data-dimension-overlay]");
      const roomRect = element.getBoundingClientRect();
      const sourcePoint = (x, y) => {
        const point = svg.createSVGPoint();
        point.x = x;
        point.y = y;
        const screenPoint = point.matrixTransform(svg.getScreenCTM());
        return { x: screenPoint.x, y: screenPoint.y };
      };
      const lineReport = (fieldId) => {
        const line = svg.querySelector(`[data-dimension-line="${CSS.escape(fieldId)}"]`);
        const start = sourcePoint(line.x1.baseVal.value, line.y1.baseVal.value);
        const end = sourcePoint(line.x2.baseVal.value, line.y2.baseVal.value);
        return {
          source: [
            line.x1.baseVal.value,
            line.y1.baseVal.value,
            line.x2.baseVal.value,
            line.y2.baseVal.value
          ],
          start,
          end,
          dx: end.x - start.x,
          dy: end.y - start.y
        };
      };
      const labels = [...svg.querySelectorAll("[data-dimension-label]")].map((label) => {
        const rect = label.querySelector(".measurement-annotation-card").getBoundingClientRect();
        return {
          fieldId: label.dataset.dimensionLabel,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom
        };
      });
      const overlaps = (first, second) => (
        first.left < second.right - 1
        && first.right > second.left + 1
        && first.top < second.bottom - 1
        && first.bottom > second.top + 1
      );
      const openingTopLeft = sourcePoint(659, 279);
      const openingBottomRight = sourcePoint(880, 758);
      const doorOpening = {
        left: openingTopLeft.x,
        right: openingBottomRight.x,
        top: openingTopLeft.y,
        bottom: openingBottomRight.y
      };
      const rightFloorCorner = sourcePoint(1295, 758);

      return {
        lines: {
          wallWidth: lineReport("wallWidth"),
          ceilingHeight: lineReport("ceilingHeight"),
          desiredDepth: lineReport("desiredDepth"),
          doorWidth: lineReport("doorWidth"),
          doorHeight: lineReport("doorHeight"),
          doorLeftDistance: lineReport("doorLeftDistance")
        },
        labelsInsideRoom: labels.every((label) => (
          label.left >= roomRect.left - 1
          && label.right <= roomRect.right + 1
          && label.top >= roomRect.top - 1
          && label.bottom <= roomRect.bottom + 1
        )),
        labelOverlaps: labels.flatMap((first, index) => (
          labels.slice(index + 1)
            .filter((second) => overlaps(first, second))
            .map((second) => `${first.fieldId}/${second.fieldId}`)
        )),
        labelsOverDoor: labels
          .filter((label) => overlaps(label, doorOpening))
          .map((label) => label.fieldId),
        rightFloorCorner,
        depthEndStyle: svg.querySelector('[data-dimension-span="desiredDepth"]').dataset.dimensionEndStyle,
        depthTickCount: svg.querySelectorAll(
          '[data-dimension-span="desiredDepth"] .measurement-dimension-extension.is-end-tick'
        ).length,
        depthArrowCount: svg.querySelectorAll(
          '[data-dimension-span="desiredDepth"] [data-dimension-end]'
        ).length,
        trimDimensionCount: svg.querySelectorAll('[data-dimension-span="doorTrimWidth"]').length,
        swingDimensionCount: svg.querySelectorAll('[data-dimension-span="doorSwing"]').length
      };
    });

    expect(geometry.lines.wallWidth.source, `${context} wall-width source anchors`).toEqual([240, 178, 1295, 178]);
    expect(geometry.lines.ceilingHeight.source, `${context} ceiling-height source anchors`).toEqual([270, 157, 270, 758]);
    expect(geometry.lines.desiredDepth.source, `${context} depth source anchors`).toEqual([1295, 758, 1452, 840]);
    expect(geometry.lines.doorWidth.source, `${context} door-width jamb anchors`).toEqual([659, 232, 880, 232]);
    expect(geometry.lines.doorHeight.source, `${context} door-height opening anchors`).toEqual([940, 279, 940, 758]);
    expect(geometry.lines.doorLeftDistance.source, `${context} left-distance trim anchors`).toEqual([240, 638, 639, 638]);
    expect(Math.abs(geometry.lines.wallWidth.dy), `${context} wall width is horizontal`).toBeLessThan(0.01);
    expect(Math.abs(geometry.lines.ceilingHeight.dx), `${context} ceiling height is vertical`).toBeLessThan(0.01);
    expect(Math.abs(geometry.lines.doorWidth.dy), `${context} door width is horizontal`).toBeLessThan(0.01);
    expect(Math.abs(geometry.lines.doorHeight.dx), `${context} door height is vertical`).toBeLessThan(0.01);
    expect(Math.abs(geometry.lines.doorLeftDistance.dy), `${context} left distance is horizontal`).toBeLessThan(0.01);
    expect(geometry.lines.desiredDepth.dx, `${context} depth moves forward`).toBeGreaterThan(0);
    expect(geometry.lines.desiredDepth.dy, `${context} depth follows floor perspective`).toBeGreaterThan(0);
    expect(
      Math.abs(geometry.lines.desiredDepth.start.x - geometry.rightFloorCorner.x),
      `${context} depth begins at the back-wall face`
    ).toBeLessThan(0.01);
    expect(
      Math.abs(geometry.lines.desiredDepth.start.y - geometry.rightFloorCorner.y),
      `${context} depth begins at the right wall-floor junction`
    ).toBeLessThan(0.01);
    expect(geometry.labelsInsideRoom, `${context} cards remain inside the room`).toBe(true);
    expect(geometry.labelOverlaps, `${context} cards do not overlap`).toEqual([]);
    expect(geometry.labelsOverDoor, `${context} cards do not cover the door opening`).toEqual([]);
    expect(geometry.depthEndStyle, `${context} depth uses ticks`).toBe("tick");
    expect(geometry.depthTickCount, `${context} depth endpoint ticks`).toBe(2);
    expect(geometry.depthArrowCount, `${context} depth has no linear arrows`).toBe(0);
    expect(geometry.trimDimensionCount, `${context} trim is not a long wall dimension`).toBe(0);
    expect(geometry.swingDimensionCount, `${context} swing is not a linear dimension`).toBe(0);

    const updates = new Map([
      ["wallWidth", ["132", "132 in"]],
      ["ceilingHeight", ["101", "101 in"]],
      ["desiredDepth", ["16", "16 in"]],
      ["doorWidth", ["38", "38 in"]],
      ["doorHeight", ["84", "84 in"]],
      ["doorLeftDistance", ["27", "27 in"]]
    ]);
    for (const [fieldId, [inputValue, expectedValue]] of updates) {
      await page.locator(`[data-measurement="${fieldId}"]`).fill(inputValue);
      await expect(
        drawing.locator(`[data-dimension-label="${fieldId}"] [data-dimension-value]`),
        `${context} ${fieldId} value`
      ).toHaveText(expectedValue);
    }
  }
});

test("landscape tablet keeps Steps 1–4 and every navigation action in one screen", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openFreshProject(page);
  await chooseProduct(page);
  await expectOneScreenFit(page, [
    ".guided-header",
    ".guided-stepper",
    ".product-grid--catalog",
    ".guided-actions"
  ]);

  await page.locator("[data-continue]").click();
  await expectOneScreenFit(page, [
    ".selected-product-banner",
    ".layout-grid",
    ".guided-info",
    ".guided-actions"
  ]);
  const layoutRows = await page.locator("[data-layout]").evaluateAll((cards) => (
    cards
      .map((card) => card.getBoundingClientRect().top)
      .sort((a, b) => a - b)
      .reduce((rows, top) => {
        if (!rows.some((rowTop) => Math.abs(rowTop - top) <= 2)) rows.push(top);
        return rows;
      }, [])
  ));
  expect(layoutRows).toHaveLength(2);
  await expect(page.locator(".layout-illustration--sprite")).toHaveCount(0);
  const roomImages = page.locator(".layout-grid .layout-illustration img");
  await expect(roomImages).toHaveCount(10);
  await expect.poll(() => roomImages.evaluateAll((images) => (
    images.every((image) => (
      image.complete
      && image.naturalWidth > 0
      && new URL(image.currentSrc).pathname.endsWith(".avif")
    ))
  ))).toBe(true);
  const standaloneRoomPaths = await page.locator([
    '[data-layout="niche-layout"] img',
    '[data-layout="left-niche"] img',
    '[data-layout="right-niche"] img',
    '[data-layout="fireplace-wall"] img'
  ].join(",")).evaluateAll((images) => images.map((image) => new URL(image.currentSrc).pathname));
  expect(new Set(standaloneRoomPaths).size).toBe(4);

  await chooseLayout(page, "Clear Wall");
  await page.locator("[data-continue]").click();
  await expectOneScreenFit(page, [
    ".measurement-panel",
    ".measurement-diagram-card",
    ".guided-info",
    ".guided-actions"
  ]);

  await page.locator("[data-continue]").click();
  await expectOneScreenFit(page, [
    ".customization-panel",
    ".concept-preview",
    ".customization-actions"
  ]);
  await expect(page.locator("[data-room-layer] img")).toHaveCSS("object-fit", "cover");
  await expect(page.locator("[data-product-layer] img")).toHaveCSS("object-fit", "cover");

  for (const tab of ["Details", "Finish"]) {
    await page.getByRole("tab", { name: tab }).click();
    const contentFit = await page.locator(".customization-content").evaluate((element) => ({
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight
    }));
    expect(contentFit.scrollHeight, `${tab} tab`).toBeLessThanOrEqual(contentFit.clientHeight + 1);
    await expectOneScreenFit(page, [".customization-panel", ".concept-preview", ".customization-actions"]);
  }
});

test("product, finish, compatibility, preview, and review summary stay synchronized", async ({ page }) => {
  await openFreshProject(page);
  await continueToLayouts(page);
  await chooseLayout(page, "Clear Wall");
  await page.locator("[data-continue]").click();
  await page.locator('[data-measurement="wallWidth"]').fill("132.25");
  await page.locator("[data-continue]").click();

  await expect(page.locator(".concept-preview")).toHaveAttribute("data-style", "cabinet-base-shelves");
  await expect(page.locator(".concept-preview")).toHaveAttribute(
    "data-preview-asset",
    "assets/photos/configurator/concept-cabinets-shelves-v1.png"
  );
  await page.getByRole("tab", { name: "Finish" }).click();
  await page.getByRole("button", { name: "Charcoal", exact: true }).click();
  const customizationPreview = page.locator(".concept-preview");
  await expect(customizationPreview).toHaveAttribute("data-finish", "charcoal");
  await expect(customizationPreview).toHaveAttribute("data-finish-family", "paint");
  await expect(customizationPreview.locator(".concept-finish-overlay")).toBeVisible();
  await expect(customizationPreview.locator(".concept-finish-overlay-tint")).toHaveCSS("fill", "rgb(52, 54, 56)");
  await expect(customizationPreview.locator(".concept-finish-caption")).toContainText("Charcoal");
  await expect(page.locator(".concept-unit")).toHaveCSS("--unit-finish", "#343638");
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page.locator("[data-concept-scene]")).toHaveCSS("--preview-scale", "1");
  await expect(page.locator(".guided-3d-canvas")).toHaveAttribute("data-rendered", "true");
  await page.getByRole("button", { name: "Reset preview" }).click();
  await expect(page.locator("[data-concept-scene]")).toHaveCSS("--preview-scale", "1");

  await page.getByRole("tab", { name: "Details" }).click();
  await expect(page.getByRole("heading", { name: "Installation" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hardware" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Door style" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Lighting" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Top treatment" })).toBeVisible();
  await page.locator('[data-detail-key="hardware"][data-detail="black-pull"]').click();
  await page.locator("[data-continue]").click();

  const summary = page.locator(".project-summary-card");
  await expect(summary).toContainText("Bookcase");
  await expect(summary).toContainText("Clear Wall");
  await expect(summary).toContainText("132 1/4 in");
  await expect(summary).toContainText("Cabinets + Shelves");
  await expect(summary).toContainText("Charcoal");
  await expect(summary).toContainText("Black Pull");
  await expect(page.locator(".concept-preview")).toHaveAttribute("data-finish", "charcoal");
  await expect(page.locator(".concept-finish-caption")).toContainText("Charcoal");
  await page.getByRole("button", { name: "Edit project notes" }).click();
  await page.getByLabel("Notes for our design team").fill("Keep the original picture rail.");
  await page.getByRole("button", { name: "Save Notes" }).click();
  await expect(summary.locator('[data-summary-value="notes"]')).toHaveText("Keep the original picture rail.");
  await expect(page.locator(".concept-preview")).toHaveAttribute("data-style", "cabinet-base-shelves");
});

test("automatic draft saving restores the active step and values after refresh", async ({ page }) => {
  await openFreshProject(page);
  await continueToLayouts(page);
  await chooseLayout(page, "Fireplace Wall");
  await page.locator("[data-continue]").click();
  await page.locator('[data-measurement="wallWidth"]').fill("137 3/8");
  await page.locator('[data-measurement="fireplaceWidth"]').fill("45.5");
  await page.waitForTimeout(300);
  await page.reload({ waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "Tell us about your space" })).toBeVisible();
  await expect(page.locator('[data-measurement="wallWidth"]')).toHaveValue("137.38");
  await expect(page.locator('[data-measurement="fireplaceWidth"]')).toHaveValue("45.5");
  await page.goBack();
  await expect(page.getByRole("button", { name: /Fireplace Wall/ })).toHaveAttribute("aria-pressed", "true");
  await page.goForward();
  await expect(page.locator('[data-measurement="fireplaceWidth"]')).toHaveValue("45.5");
});

test("inspiration presets apply once and then restore edits after refresh", async ({ page }) => {
  await page.goto("/configurator.html?preset=media-wall", { waitUntil: "networkidle" });
  await expect(page.locator('[data-product-choice="tv-unit"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/configurator\.html#step-1$/);
  await page.locator("[data-continue]").click();
  await expect(page.locator('button[data-layout="clear-wall"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator("[data-continue]").click();
  await page.locator('[data-measurement="wallWidth"]').fill("129.5");
  await page.waitForTimeout(250);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Tell us about your space" })).toBeVisible();
  await expect(page.locator('[data-measurement="wallWidth"]')).toHaveValue("129.5");
  await expect(page.locator('[data-measurement="tvScreenSize"]')).toBeVisible();
});

test("saved projects can be renamed, duplicated, deleted, and resumed", async ({ page }) => {
  await openFreshProject(page);
  await continueToLayouts(page);
  await chooseLayout(page, "Niche Layout");
  await page.getByRole("button", { name: "Save Project", exact: true }).click();
  const saveDialog = page.locator("[data-save-dialog]");
  await saveDialog.getByLabel("Project name").fill("Park Avenue Library");
  await saveDialog.getByRole("button", { name: "Save Project", exact: true }).click();

  await page.getByRole("button", { name: "My Projects", exact: true }).click();
  const projectsDialog = page.locator("[data-projects-dialog]");
  await expect(projectsDialog.getByText("Park Avenue Library", { exact: true })).toBeVisible();
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
  await expect(page.getByRole("button", { name: /Niche Layout/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/project=JQ-/);
});

test("blocked local storage never reports a project as saved", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage unavailable", "QuotaExceededError");
    };
  });
  await openFreshProject(page);
  await continueToLayouts(page);
  await chooseLayout(page, "Clear Wall");
  await page.getByRole("button", { name: "Save Project", exact: true }).click();
  const dialog = page.locator("[data-save-dialog]");
  await dialog.getByLabel("Project name").fill("Unsaved Library");
  await dialog.getByRole("button", { name: "Save Project", exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(page.locator("[data-guided-toast]")).toContainText("couldn’t save this project");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("jqGuidedConfiguratorProjectsV1"))).toBeNull();
});

test("the static quote path validates contact details and honestly prepares an email", async ({ page }) => {
  await openFreshProject(page);
  await continueToReview(page);
  await page.getByRole("button", { name: "Request a Quote" }).click();
  const dialog = page.locator("[data-quote-dialog]");
  await expect(dialog).toContainText("Online submission is not connected");
  await dialog.getByRole("button", { name: "Prepare Email Request" }).click();
  await expect(dialog.locator("[data-quote-error]")).toContainText("required contact details");

  await fillQuoteContact(page);
  await dialog.locator('[name="photos"]').setInputFiles({
    name: "oversized-room.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(10 * 1024 * 1024 + 1)
  });
  await dialog.getByRole("button", { name: "Prepare Email Request" }).click();
  await expect(dialog.locator("[data-quote-error]")).toContainText("larger than 10 MB");
  await dialog.locator('[name="photos"]').setInputFiles([]);
  await dialog.getByRole("button", { name: "Prepare Email Request" }).click();
  await expect(dialog.locator("[data-quote-mode]")).toContainText("email draft is ready");
  await expect(dialog.locator("[data-email-fallback]")).toHaveAttribute("href", /^mailto:info@jqwoodworking\.com/);
  await expect(dialog.locator("[data-email-fallback]")).toHaveAttribute("href", /JQ%20Project%20Quote%20Request/);
});

test("a connected quote endpoint shows a real success state and project reference", async ({ page }) => {
  await serveWithQuoteEndpoint(page, 200, { reference: "JQ-WEB-2607" });
  await openFreshProject(page);
  await continueToReview(page);
  await page.getByRole("button", { name: "Request a Quote" }).click();
  const dialog = await fillQuoteContact(page);
  await dialog.getByRole("button", { name: "Send Quote Request" }).click();
  await expect(dialog.locator("[data-quote-success]")).toContainText("Your project request was sent.");
  await expect(dialog.locator("[data-quote-success]")).toContainText("JQ-WEB-2607");
  await expect(dialog.locator("[data-quote-success]")).toContainText("design team will review");
});

test("a failed connected quote request keeps the project and reports an honest error", async ({ page }) => {
  await serveWithQuoteEndpoint(page, 503, { error: "temporarily unavailable" });
  await openFreshProject(page);
  await continueToReview(page);
  await page.getByRole("button", { name: "Request a Quote" }).click();
  const dialog = await fillQuoteContact(page);
  await dialog.getByRole("button", { name: "Send Quote Request" }).click();
  await expect(dialog.locator("[data-quote-error]")).toContainText("couldn’t send your request");
  await expect(dialog.locator("[data-quote-form]")).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("jqGuidedConfiguratorDraftV1"))).not.toBeNull();
});

test("keyboard interaction covers product and layout cards, tabs, completed steps, and menu dismissal", async ({ page }) => {
  await openFreshProject(page);
  const firstProduct = page.locator('[data-product-choice="cabinet-shelves"]');
  await firstProduct.focus();
  await expect(firstProduct).toBeFocused();
  await page.keyboard.press("Space");
  await expect(firstProduct).toHaveAttribute("aria-pressed", "true");
  await page.locator("[data-continue]").click();
  await expect(
    page.getByRole("heading", { name: "Choose the room condition that matches your space" })
  ).toBeFocused();

  const firstLayout = page.getByRole("button", { name: "Niche Layout", exact: true });
  await firstLayout.focus();
  await expect(firstLayout).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator('button[data-layout="niche-layout"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator("[data-continue]").click();
  await page.locator("[data-continue]").click();

  const finishTab = page.getByRole("tab", { name: "Finish" });
  await finishTab.focus();
  await finishTab.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Details" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: /Choose Layout, completed/ }).click();
  await expect(page.getByRole("heading", { name: "Choose the room condition that matches your space" })).toBeVisible();

  const menu = page.getByRole("button", { name: "Open menu" });
  await menu.click();
  await expect(page.getByRole("navigation", { name: "Configurator menu" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("navigation", { name: "Configurator menu" })).toBeHidden();
  await expect(menu).toBeFocused();
});

test("one complete guided flow works for every product category", async ({ page }) => {
  for (const product of products) {
    await openFreshProject(page);
    await continueToReview(page, sharedLayouts[0].label, product.label);
    await expect(page.locator(".project-summary-card")).toContainText(product.label);
    await expect(page.locator(".project-summary-card")).toContainText(sharedLayouts[0].label);
  }
});

test("all seventy product and room combinations retain a compatible photographic fallback", async ({ page }) => {
  await page.route("**/guided-configurator-3d.js*", (route) => route.fulfill({
    contentType: "text/javascript",
    body: 'export function createGuidedSceneController() { throw new Error("WebGL unavailable in fallback test"); }'
  }));
  const runtime = monitorRuntime(page);

  for (const product of PRODUCT_CHOICES) {
    await openFreshProject(page);
    await page.locator(`[data-product-choice="${product.id}"]`).click();
    await page.locator("[data-continue]").click();

    for (const layout of SHARED_ROOM_LAYOUTS) {
      const expected = resolvePreviewPresentation(product.categoryId, product.styleId, layout.id);
      const expectedAsset = PRODUCT_INTEGRATED_PREVIEW_ASSETS[product.id][layout.id];

      await page.locator(`[data-layout="${layout.id}"]`).click();
      await page.locator("[data-continue]").click();
      await page.locator("[data-continue]").click();

      const preview = page.locator(".concept-preview");
      await expect(preview).toHaveAttribute("data-category", product.categoryId);
      await expect(preview).toHaveAttribute("data-style", product.styleId);
      await expect(preview).toHaveAttribute("data-layout", layout.id);
      await expect(preview).toHaveAttribute("data-preview-key", expected.previewKey);
      await expect(preview).toHaveAttribute("data-preview-render-mode", "integrated");
      await expect(preview).toHaveAttribute("data-preview-asset", expectedAsset);
      await expect(preview.locator(".concept-scene")).toHaveAttribute("data-guided3d-state", "fallback");
      await expect(preview.locator(".concept-finish-overlay")).toBeVisible();
      await expect.poll(() => preview.locator("img.concept-photo").evaluate((image, avifAsset) => (
        image.complete
          && image.naturalWidth > 0
          && image.naturalHeight > 0
          && new URL(image.currentSrc).pathname.endsWith(avifAsset)
      ), expectedAsset.replace(/\.png$/, ".avif"))).toBe(true);

      await page.getByRole("button", { name: /Choose Layout, completed/ }).click();
    }
  }

  expect(runtime.filter((failure) => !failure.includes("net::ERR_ABORTED"))).toEqual([]);
});

test("desktop, iPad, and phone layouts are overflow-free with usable mobile controls", async ({ page }) => {
  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 1280, height: 720 },
    { width: 1180, height: 820 },
    { width: 820, height: 1180 },
    { width: 390, height: 844 }
  ]) {
    await page.setViewportSize(viewport);
    await openFreshProject(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${viewport.width}x${viewport.height}`).toBeLessThanOrEqual(1);
  }

  const productTargets = await page.locator("[data-product-choice]").evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().height));
  expect(Math.min(...productTargets)).toBeGreaterThanOrEqual(44);
  await expect(page.locator(".guided-step-label--mobile")).toHaveText(["Product", "Layout", "Size", "Finish", "Review"]);
  await continueToLayouts(page, "Radiator Cover");
  await expect(page.locator(".guided-category-nav")).toHaveCount(0);
  await expect(page.locator(".layout-grid")).toHaveCSS("grid-template-columns", /.+ .+/);
  const cardTargets = await page.locator("[data-layout]").evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().height));
  expect(Math.min(...cardTargets)).toBeGreaterThanOrEqual(44);
  await chooseLayout(page, "Window Wall");
  await page.locator("[data-continue]").click();
  await expect(page.locator("[data-dimension-chip]")).toHaveCount(6);
  expect(await page.locator("[data-dimension-chip]").evaluateAll((chips) => (
    chips.map((chip) => chip.dataset.dimensionChip)
  ))).toEqual(["wallWidth", "ceilingHeight", "desiredDepth", "windowWidth", "windowHeight", "sillHeight"]);
  const mobileOrder = await page.evaluate(() => {
    const diagram = document.querySelector(".measurement-diagram-card").getBoundingClientRect();
    const form = document.querySelector(".measurement-panel").getBoundingClientRect();
    const actions = document.querySelector(".guided-actions");
    const information = document.querySelector(".guided-info").getBoundingClientRect();
    const actionsRect = actions.getBoundingClientRect();
    const style = getComputedStyle(actions);
    return {
      diagramBeforeForm: diagram.top < form.top,
      actionsPosition: style.position,
      actionsBottom: style.bottom,
      actionsFollowContent: actionsRect.top >= information.bottom - 1
    };
  });
  expect(mobileOrder.diagramBeforeForm).toBe(true);
  expect(mobileOrder.actionsPosition).toBe("static");
  expect(mobileOrder.actionsBottom).toBe("auto");
  expect(mobileOrder.actionsFollowContent).toBe(true);
  await page.screenshot({ path: "test-results/guided-configurator-phone.png", fullPage: true });

  await page.setViewportSize({ width: 1280, height: 720 });
  await openFreshProject(page);
  await continueToLayouts(page);
  await chooseLayout(page, "Clear Wall");
  await page.locator("[data-continue]").click();
  await page.locator("[data-continue]").click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), "1280x720 customization").toBeLessThanOrEqual(1);
  await page.locator("[data-continue]").click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), "1280x720 review").toBeLessThanOrEqual(1);
});
