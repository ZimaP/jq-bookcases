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
    ["nicheDepth", "F"],
    ["leftReturn", "G"],
    ["rightReturn", "H"]
  ],
  "left-niche": [
    ["wallWidth", "A"],
    ["ceilingHeight", "B"],
    ["desiredDepth", "C"],
    ["nicheWidth", "D"],
    ["nicheHeight", "E"],
    ["nicheDepth", "F"],
    ["rightReturn", "H"]
  ],
  "right-niche": [
    ["wallWidth", "A"],
    ["ceilingHeight", "B"],
    ["desiredDepth", "C"],
    ["nicheWidth", "D"],
    ["nicheHeight", "E"],
    ["nicheDepth", "F"],
    ["leftReturn", "G"]
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
    ["mantelWidth", "F"],
    ["mantelHeight", "G"],
    ["fireplaceDepth", "H"],
    ["fireplaceLeftWidth", "I"],
    ["fireplaceRightWidth", "J"]
  ],
  "center-recess": [
    ["wallWidth", "A"],
    ["ceilingHeight", "B"],
    ["desiredDepth", "C"],
    ["nicheWidth", "D"],
    ["nicheHeight", "E"],
    ["nicheDepth", "F"],
    ["leftReturn", "G"],
    ["rightReturn", "H"]
  ],
  "window-wall": [
    ["wallWidth", "A"],
    ["ceilingHeight", "B"],
    ["desiredDepth", "C"],
    ["windowWidth", "D"],
    ["windowHeight", "E"],
    ["sillHeight", "F"],
    ["windowLeftDistance", "G"],
    ["windowRightDistance", "H"]
  ],
  "door-wall": [
    ["wallWidth", "A"],
    ["ceilingHeight", "B"],
    ["desiredDepth", "C"],
    ["doorWidth", "D"],
    ["doorHeight", "E"],
    ["doorLeftDistance", "F"],
    ["doorTrimWidth", "G"]
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

async function expectGuidedDimensionContract(room, expectedDimensions, context) {
  const labels = room.locator(".guided-3d-dimension-label");
  await expect(labels, `${context} semantic labels`).toHaveCount(expectedDimensions.length);
  const diagnostics = await labels.evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    const roles = String(element.dataset.dimensionLineRoles || "")
      .split(/\s+/)
      .filter(Boolean);
    return {
      fieldId: element.dataset.dimensionField,
      code: element.dataset.dimensionCode,
      axis: element.dataset.dimensionAxis,
      startAnchor: element.dataset.dimensionStartAnchor,
      endAnchor: element.dataset.dimensionEndAnchor,
      start: String(element.dataset.dimensionStart || "").split(",").map(Number),
      end: String(element.dataset.dimensionEnd || "").split(",").map(Number),
      length: Number(element.dataset.dimensionLength),
      witnessCount: Number(element.dataset.dimensionWitnessCount),
      lineCount: Number(element.dataset.dimensionLineCount),
      roles,
      hidden: element.hidden,
      value: element.querySelector("small")?.textContent?.trim() || "",
      rect: {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom
      }
    };
  }));

  expect(
    diagnostics.map(({ fieldId, code }) => [fieldId, code]),
    `${context} ordered fields and codes`
  ).toEqual(expectedDimensions);
  diagnostics.forEach((diagnostic) => {
    const fieldContext = `${context} ${diagnostic.fieldId}`;
    expect(diagnostic.hidden, `${fieldContext} label visible`).toBe(false);
    expect(diagnostic.axis, `${fieldContext} axis`).toMatch(/^(horizontal|vertical|depth|diagonal)$/);
    expect(diagnostic.start, `${fieldContext} start point`).toHaveLength(3);
    expect(diagnostic.end, `${fieldContext} end point`).toHaveLength(3);
    expect(diagnostic.start.every(Number.isFinite), `${fieldContext} finite start point`).toBe(true);
    expect(diagnostic.end.every(Number.isFinite), `${fieldContext} finite end point`).toBe(true);
    expect(diagnostic.length, `${fieldContext} positive line length`).toBeGreaterThan(0);
    expect(diagnostic.witnessCount, `${fieldContext} witness count`).toBeGreaterThanOrEqual(0);
    expect(diagnostic.lineCount, `${fieldContext} semantic line count`)
      .toBe(3 + diagnostic.witnessCount);
    expect(diagnostic.roles, `${fieldContext} main line`).toContain("dimension");
    expect(diagnostic.roles, `${fieldContext} start tick`).toContain("tick-start");
    expect(diagnostic.roles, `${fieldContext} end tick`).toContain("tick-end");
    if (diagnostic.witnessCount > 0) {
      expect(diagnostic.roles, `${fieldContext} start witness`).toContain("witness-start");
    }
    if (diagnostic.witnessCount > 1) {
      expect(diagnostic.roles, `${fieldContext} end witness`).toContain("witness-end");
    }
    expect(diagnostic.value, `${fieldContext} displayed value`).not.toBe("");
  });
  return diagnostics;
}

async function expectGuidedLabelsInsideScene(room, diagnostics, context) {
  const geometry = await room.evaluate((element) => {
    const scene = element.getBoundingClientRect();
    const labels = [...element.querySelectorAll(".guided-3d-dimension-label")].map((label) => {
      const rect = label.getBoundingClientRect();
      return {
        fieldId: label.dataset.dimensionField,
        rect: {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom
        }
      };
    });
    return {
      scene: {
        left: scene.left,
        right: scene.right,
        top: scene.top,
        bottom: scene.bottom
      },
      labels
    };
  });
  expect(geometry.labels.map(({ fieldId }) => fieldId))
    .toEqual(diagnostics.map(({ fieldId }) => fieldId));
  const overlaps = (first, second) => (
    first.left < second.right - 1
    && first.right > second.left + 1
    && first.top < second.bottom - 1
    && first.bottom > second.top + 1
  );
  expect(
    geometry.labels.every(({ rect }) => (
      rect.left >= geometry.scene.left - 1
      && rect.right <= geometry.scene.right + 1
      && rect.top >= geometry.scene.top - 1
      && rect.bottom <= geometry.scene.bottom + 1
    )),
    `${context} labels inside canonical scene`
  ).toBe(true);
  expect(
    geometry.labels.flatMap((first, index) => (
      geometry.labels.slice(index + 1)
        .filter((second) => overlaps(first.rect, second.rect))
        .map((second) => `${first.fieldId}/${second.fieldId}`)
    )),
    `${context} labels do not overlap`
  ).toEqual([]);
}

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
    "windowWidth",
    "windowHeight",
    "sillHeight",
    "windowLeftDistance",
    "windowRightDistance",
    "leftReturn",
    "rightReturn",
    "radiatorBelowWindow"
  ]) {
    await expect(page.locator(`[data-measurement-row="${fieldId}"]`)).toBeVisible();
  }

  await expect(page.locator('[data-measurement-row="windowLeftDistance"] .measurement-field-label'))
    .toContainText("Window distance from left wall");
  await expect(page.locator('[data-measurement-row="windowRightDistance"] .measurement-field-label'))
    .toContainText("Window distance from right wall");
  await expect(page.locator('[data-measurement-row="leftReturn"] .measurement-field-label'))
    .toContainText("Left built-in return width");
  await expect(page.locator('[data-measurement-row="rightReturn"] .measurement-field-label'))
    .toContainText("Right built-in return width");

  const width = page.locator('[data-measurement="wallWidth"]');
  const windowLeftDistance = page.locator('[data-measurement="windowLeftDistance"]');
  const windowRightDistance = page.locator('[data-measurement="windowRightDistance"]');
  const leftReturn = page.locator('[data-measurement="leftReturn"]');
  const rightReturn = page.locator('[data-measurement="rightReturn"]');
  await width.fill("121 1/2");
  await windowLeftDistance.fill("26 1/2");
  await windowRightDistance.fill("47");
  await leftReturn.fill("8 3/4");
  await rightReturn.fill("10 1/4");
  await expect(page.locator(
    '.guided-3d-dimension-label[data-dimension-field="wallWidth"] small'
  )).toHaveText("121.5 in");
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
  await expect(windowLeftDistance).toHaveValue("26.5");
  await expect(windowRightDistance).toHaveValue("47");
  await expect(leftReturn).toHaveValue("8.75");
  await expect(rightReturn).toHaveValue("10.25");

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
  await measurementCanvas.evaluate((canvas) => {
    window.__guidedE2ePersistentCanvas = canvas;
  });

  await page.locator('[data-measurement="nicheWidth"]').fill("90");
  await expect.poll(() => measurementCanvas.getAttribute("data-scene-signature"))
    .not.toBe(initialSignature);
  await expect(page.locator('[data-measurement-row="nicheWidth"] .measurement-warning')).toContainText(
    "does not match the 120 in wall width"
  );
  await expect(page.locator(".guided-3d-canvas")).toHaveCount(1);
  await expect(measurementScene.locator(":scope > picture.measurement-room-image")).toHaveCSS("opacity", "0");
  await expect(measurementScene.locator(":scope > [data-dimension-overlay]")).toHaveCount(0);
  await expect(measurementScene.locator(".guided-3d-dimension-label"))
    .toHaveCount(bookcaseMeasurementDimensions["left-niche"].length);
  const roomSignature = await measurementCanvas.getAttribute("data-room-signature");
  const cameraSignature = await measurementCanvas.getAttribute("data-camera-signature");
  expect(roomSignature).toMatch(/^g3d-room-v1-/);
  expect(cameraSignature).toMatch(/^g3d-camera-v1-/);

  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Refine your concept" })).toBeVisible();
  const customizationScene = page.locator('.concept-scene[data-guided3d-state="ready"]');
  await expect(customizationScene).toBeVisible();
  const customizationCanvas = customizationScene.locator(".guided-3d-canvas");
  await expect(customizationCanvas).toHaveCount(1);
  await expect(customizationCanvas).toHaveAttribute("data-guided3d-instance", instanceId);
  await expect(customizationCanvas).toHaveAttribute("data-show-product", "true");
  await expect(customizationCanvas).toHaveAttribute("data-show-dimensions", "false");
  await expect(customizationCanvas).toHaveAttribute("data-room-signature", roomSignature);
  await expect(customizationCanvas).toHaveAttribute("data-camera-signature", cameraSignature);
  expect(await customizationCanvas.evaluate(
    (canvas) => canvas === window.__guidedE2ePersistentCanvas
  )).toBe(true);
  await expect(customizationScene.locator("[data-room-layer], [data-product-layer]")).toHaveCount(0);
  await expect(customizationScene.locator(":scope > picture.concept-photo")).toHaveCount(1);
  await expect(customizationScene.locator(":scope > picture.concept-photo")).toHaveCSS("opacity", "0");

  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(customizationCanvas).toHaveAttribute("data-guided3d-instance", instanceId);
  await expect(page.locator(".guided-3d-canvas")).toHaveCount(1);
  await page.getByRole("button", { name: "Reset preview" }).click();
  await page.getByRole("tab", { name: "Details" }).click();
  await expect(page.locator(".guided-3d-canvas")).toHaveCount(1);
  await expect(page.locator(".guided-3d-canvas")).toHaveAttribute("data-guided3d-instance", instanceId);

  const preFinishSceneSignature = await customizationCanvas.getAttribute("data-scene-signature");
  await page.getByRole("tab", { name: "Finish" }).click();
  await page.getByRole("button", { name: "Charcoal", exact: true }).click();
  await expect(customizationCanvas).toHaveAttribute("data-guided3d-instance", instanceId);
  await expect(customizationCanvas).toHaveAttribute("data-room-signature", roomSignature);
  await expect(customizationCanvas).toHaveAttribute("data-camera-signature", cameraSignature);
  await expect.poll(() => customizationCanvas.getAttribute("data-scene-signature"))
    .not.toBe(preFinishSceneSignature);
  expect(await customizationCanvas.evaluate(
    (canvas) => canvas === window.__guidedE2ePersistentCanvas
  )).toBe(true);

  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Review your custom concept" })).toBeVisible();
  const reviewCanvas = page.locator('.concept-scene[data-guided3d-state="ready"] .guided-3d-canvas');
  await expect(reviewCanvas).toHaveCount(1);
  await expect(reviewCanvas).toHaveAttribute("data-guided3d-instance", instanceId);
  await expect(reviewCanvas).toHaveAttribute("data-show-product", "true");
  await expect(reviewCanvas).toHaveAttribute("data-room-signature", roomSignature);
  await expect(reviewCanvas).toHaveAttribute("data-camera-signature", cameraSignature);
  expect(await reviewCanvas.evaluate(
    (canvas) => canvas === window.__guidedE2ePersistentCanvas
  )).toBe(true);
  await expect(page.locator(".concept-scene [data-room-layer], .concept-scene [data-product-layer]"))
    .toHaveCount(0);
  await expect(page.locator(".guided-3d-canvas")).toHaveCount(1);
  expect(photographicFallbackRequests).toEqual([]);
});

test("all ten shared rooms render through one persistent real WebGL lifecycle", async ({ page }) => {
  const runtime = monitorRuntime(page);
  const matrix = [
    ["bookcase", "cabinet-base-shelves", "niche-layout"],
    ["bookcase", "drawer-base-shelves", "left-niche"],
    ["bookcase", "full-open-shelving", "right-niche"],
    ["tv-unit", "framed-tv-wall", "clear-wall"],
    ["floating-storage", "floating-drawer-bank", "fireplace-wall"],
    ["window-storage", "window-seat-storage", "center-recess"],
    ["radiator-cover", "clean-slat-cover", "window-wall"],
    ["tv-unit", "framed-tv-wall", "door-wall"],
    ["bookcase", "full-open-shelving", "corner-wall"],
    ["tv-unit", "framed-tv-wall", "double-opening"]
  ].map(([category, style, layout]) => ({ category, style, layout }));
  expect(matrix.map(({ layout }) => layout)).toEqual(sharedLayouts.map(({ id }) => id));

  await page.goto("/privacy.html");
  const result = await page.evaluate(async (cases) => {
    const { createGuidedSceneController } = await import(
      "/guided-configurator-3d.js?e2e=all-shared-room-runtime-matrix"
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
      const project = {
        ...entry,
        measurements,
        finish: "natural-oak",
        accentFinish: "warm-linen",
        doorStyle: "shaker",
        hardware: "brass-pull",
        lighting: "warm-led",
        baseStyle: "flush-base",
        topTreatment: "small-crown"
      };
      const updated = controller.update(project, {
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
      const initialDiagnostics = {
        scene: controller.canvas.dataset.sceneSignature,
        room: controller.canvas.dataset.roomSignature,
        camera: controller.canvas.dataset.cameraSignature
      };
      const finishUpdated = controller.update({
        ...project,
        finish: "charcoal"
      }, {
        showProduct: true,
        showDimensions: true
      });
      if (!finishUpdated) {
        throw new Error(`Finish update rejected for ${entry.category}/${entry.layout}`);
      }
      await waitFor(() => (
        controller.canvas?.dataset.rendered === "true"
        && controller.canvas.dataset.sceneSignature !== initialDiagnostics.scene
        && states.at(-1) === "ready"
      ));
      reports.push({
        ...entry,
        instance: controller.canvas.dataset.guided3dInstance,
        initialDiagnostics,
        finishDiagnostics: {
          scene: controller.canvas.dataset.sceneSignature,
          room: controller.canvas.dataset.roomSignature,
          camera: controller.canvas.dataset.cameraSignature
        },
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
  expect(new Set(result.reports.map((report) => report.initialDiagnostics.scene)).size)
    .toBe(matrix.length);
  expect(new Set(result.reports.map((report) => report.initialDiagnostics.room)).size)
    .toBe(matrix.length);
  result.reports.forEach((report) => {
    expect(report.rendered, `${report.category}/${report.layout} rendered`).toBe("true");
    expect(report.canvasWidth, `${report.category}/${report.layout} canvas width`).toBeGreaterThan(100);
    expect(report.canvasHeight, `${report.category}/${report.layout} canvas height`).toBeGreaterThan(100);
    expect(report.canvasCount, `${report.category}/${report.layout} canvas count`).toBe(1);
    expect(report.visibleLabels, `${report.category}/${report.layout} visible callouts`).toBeGreaterThanOrEqual(3);
    expect(report.labelsOverlap, `${report.category}/${report.layout} callout collisions`).toBe(false);
    expect(
      report.finishDiagnostics.scene,
      `${report.category}/${report.layout} finish changes scene`
    ).not.toBe(report.initialDiagnostics.scene);
    expect(
      report.finishDiagnostics.room,
      `${report.category}/${report.layout} finish preserves room`
    ).toBe(report.initialDiagnostics.room);
    expect(
      report.finishDiagnostics.camera,
      `${report.category}/${report.layout} finish preserves camera`
    ).toBe(report.initialDiagnostics.camera);
    expect(report.initialDiagnostics.room).toMatch(/^g3d-room-v1-/);
    expect(report.initialDiagnostics.camera).toMatch(/^g3d-camera-v1-/);
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

test("TV Unit keeps the canonical Between Openings scene through customization, review, and reload", async ({ page }) => {
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

      const measurementScene = page.locator(
        '.measurement-room[data-layout="double-opening"][data-guided3d-state="ready"]'
      );
      const measurementCanvas = measurementScene.locator(".guided-3d-canvas");
      await expect(measurementCanvas).toHaveAttribute("data-rendered", "true");
      await expect(measurementCanvas).toHaveAttribute("data-scene-layout", "double-opening");
      await expect(measurementCanvas).toHaveAttribute("data-show-product", "false");
      const instanceId = await measurementCanvas.getAttribute("data-guided3d-instance");
      const roomSignature = await measurementCanvas.getAttribute("data-room-signature");
      const cameraSignature = await measurementCanvas.getAttribute("data-camera-signature");
      expect(roomSignature).toMatch(/^g3d-room-v1-/);
      expect(cameraSignature).toMatch(/^g3d-camera-v1-/);

      await page.locator("[data-continue]").click();
      await expect(page.getByRole("heading", { name: "Refine your concept" })).toBeVisible();

      const customizationPreview = page.locator(
        '.concept-preview[data-category="tv-unit"][data-layout="double-opening"]'
      );
      await expect(customizationPreview).toHaveAttribute("data-preview-asset", productAsset);
      await expect(customizationPreview.locator("[data-room-layer], [data-product-layer]")).toHaveCount(0);
      await expect(customizationPreview.locator(".concept-scene > picture.concept-photo")).toHaveCount(1);
      const customizationCanvas = customizationPreview.locator(".guided-3d-canvas");
      await expect(customizationCanvas).toHaveAttribute("data-guided3d-instance", instanceId);
      await expect(customizationCanvas).toHaveAttribute("data-room-signature", roomSignature);
      await expect(customizationCanvas).toHaveAttribute("data-camera-signature", cameraSignature);
      await expect(customizationCanvas).toHaveAttribute("data-show-product", "true");
      const preFinishSceneSignature = await customizationCanvas.getAttribute("data-scene-signature");
      await page.getByRole("tab", { name: "Finish" }).click();
      await page.getByRole("button", { name: "Charcoal", exact: true }).click();
      await expect(customizationPreview).toHaveAttribute("data-finish", "charcoal");
      await expect(customizationCanvas).toHaveAttribute("data-room-signature", roomSignature);
      await expect(customizationCanvas).toHaveAttribute("data-camera-signature", cameraSignature);
      await expect.poll(() => customizationCanvas.getAttribute("data-scene-signature"))
        .not.toBe(preFinishSceneSignature);
      await page.waitForTimeout(250);
      await page.locator("[data-continue]").click();
      await expect(page.getByRole("heading", { name: "Review your custom concept" })).toBeVisible();
      const reviewPreview = page.locator(
        '.concept-preview[data-category="tv-unit"][data-layout="double-opening"]'
      );
      const reviewCanvas = reviewPreview.locator(".guided-3d-canvas");
      await expect(reviewPreview.locator("[data-room-layer], [data-product-layer]")).toHaveCount(0);
      await expect(reviewCanvas).toHaveAttribute("data-guided3d-instance", instanceId);
      await expect(reviewCanvas).toHaveAttribute("data-room-signature", roomSignature);
      await expect(reviewCanvas).toHaveAttribute("data-camera-signature", cameraSignature);
      await expect(reviewPreview.locator(".concept-scene > picture.concept-photo")).toHaveCount(1);

      await page.reload({ waitUntil: "networkidle" });
      await expect(page).toHaveURL(/configurator\.html#step-5$/);
      await expect(page.getByRole("heading", { name: "Review your custom concept" })).toBeVisible();
      const reloadedReviewPreview = page.locator(
        '.concept-preview[data-category="tv-unit"][data-layout="double-opening"]'
      );
      const reloadedCanvas = reloadedReviewPreview.locator(".guided-3d-canvas");
      await expect(reloadedReviewPreview.locator("[data-room-layer], [data-product-layer]"))
        .toHaveCount(0);
      await expect(reloadedCanvas).toHaveAttribute("data-room-signature", roomSignature);
      await expect(reloadedCanvas).toHaveAttribute("data-camera-signature", cameraSignature);
      await expect(reloadedCanvas).not.toHaveAttribute("data-guided3d-instance", instanceId);
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
    await expect(preview.locator("img.concept-photo")).toHaveAttribute("data-fallback-src", variant.asset);
    await expect(preview.locator(".concept-scene")).toHaveAttribute("data-guided3d-state", "ready");
    await expect(preview.locator("[data-room-layer], [data-product-layer]")).toHaveCount(0);
    await expect(preview.locator(".guided-3d-canvas")).toHaveCount(1);
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

  await openFreshProject(page);
  await page.locator('[data-product-choice="drawer-shelves"]').click();
  await page.locator("[data-continue]").click();
  await chooseLayout(page, "Door Wall");
  await page.locator("[data-continue]").click();
  await expect(page.locator(".selected-layout-chip")).toContainText("Door Wall");
  await expect(page.locator('[data-measurement="doorWidth"]')).toBeVisible();
  await expect(page.locator('[data-measurement="doorHeight"]')).toBeVisible();
  const measurementCanvas = page.locator(
    '.measurement-room[data-layout="door-wall"] .guided-3d-canvas'
  );
  await expect(measurementCanvas).toHaveAttribute("data-rendered", "true");
  const instanceId = await measurementCanvas.getAttribute("data-guided3d-instance");
  const roomSignature = await measurementCanvas.getAttribute("data-room-signature");
  const cameraSignature = await measurementCanvas.getAttribute("data-camera-signature");
  await page.locator("[data-continue]").click();

  const customizationPreview = page.locator('.concept-preview[data-layout="door-wall"]');
  await expect(customizationPreview).toHaveAttribute(
    "data-preview-key",
    "bookcase:drawer-base-shelves:door-wall"
  );
  await expect(customizationPreview).toHaveAttribute("data-style", "drawer-base-shelves");
  await expect(customizationPreview).toHaveAttribute("data-preview-asset", asset);
  await expect(customizationPreview.locator('[data-layout-context="door-wall"]')).toHaveAccessibleName(
    "Selected room condition: Door Wall"
  );
  await expect(customizationPreview.locator("[data-room-layer], [data-product-layer]")).toHaveCount(0);
  await expect(customizationPreview.locator(".concept-scene > picture.concept-photo")).toHaveCount(1);
  await expect(customizationPreview.locator("img.concept-photo")).toHaveAttribute("data-fallback-src", asset);
  const customizationCanvas = customizationPreview.locator(".guided-3d-canvas");
  await expect(customizationCanvas).toHaveAttribute("data-guided3d-instance", instanceId);
  await expect(customizationCanvas).toHaveAttribute("data-room-signature", roomSignature);
  await expect(customizationCanvas).toHaveAttribute("data-camera-signature", cameraSignature);

  await page.getByRole("tab", { name: "Finish" }).click();
  await page.getByRole("button", { name: "Charcoal", exact: true }).click();
  await expect(customizationPreview).toHaveAttribute("data-finish", "charcoal");
  await expect(customizationCanvas).toHaveAttribute("data-room-signature", roomSignature);
  await expect(customizationCanvas).toHaveAttribute("data-camera-signature", cameraSignature);

  await page.locator("[data-continue]").click();
  const reviewPreview = page.locator('.concept-preview[data-layout="door-wall"]');
  await expect(page.locator('[data-summary-value="layout"]')).toHaveText("Door Wall");
  await expect(page.locator('[data-summary-value="product"]')).toHaveText("Drawers + Shelves");
  await expect(reviewPreview).toHaveAttribute("data-preview-key", "bookcase:drawer-base-shelves:door-wall");
  await expect(reviewPreview).toHaveAttribute("data-preview-asset", asset);
  await expect(reviewPreview.locator("[data-room-layer], [data-product-layer]")).toHaveCount(0);
  await expect(reviewPreview.locator(".guided-3d-canvas")).toHaveAttribute(
    "data-guided3d-instance",
    instanceId
  );
  await expect(reviewPreview.locator(".guided-3d-canvas"))
    .toHaveAttribute("data-room-signature", roomSignature);
  await expect(reviewPreview.locator(".guided-3d-canvas"))
    .toHaveAttribute("data-camera-signature", cameraSignature);
});

test("Right Niche semantic 3D guides explain every dimension and keep preview metadata clear", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openFreshProject(page);
  await continueToLayouts(page);
  await chooseLayout(page, "Right Niche");
  await page.locator("[data-continue]").click();

  const room = page.locator('.measurement-room[data-layout="right-niche"]');
  await expect(room).toHaveAttribute("data-guided3d-state", "ready");
  await expect(room.locator(":scope > [data-dimension-overlay]")).toHaveCount(0);
  const diagnostics = await expectGuidedDimensionContract(
    room,
    bookcaseMeasurementDimensions["right-niche"],
    "Right Niche"
  );
  await expectGuidedLabelsInsideScene(room, diagnostics, "Right Niche");
  await expect(room.locator(".guided-3d-dimension-label small")).toHaveText([
    "120 in",
    "96 in",
    "14 in",
    "96 in",
    "96 in",
    "14 in",
    "24 in"
  ]);
  await expect(page.locator('[data-measurement-row="wallWidth"] .measurement-code')).toHaveText("A");
  await expect(page.locator('[data-measurement-row="ceilingHeight"] .measurement-code')).toHaveText("B");
  await expect(page.locator('[data-measurement-row="desiredDepth"] .measurement-code')).toHaveText("C");

  await page.locator('[data-measurement="wallWidth"]').fill("132");
  await expect(room.locator(
    '.guided-3d-dimension-label[data-dimension-field="wallWidth"] small'
  )).toHaveText("132 in");
  const measurementCanvas = room.locator(".guided-3d-canvas");
  await expect(measurementCanvas).toHaveAttribute("data-rendered", "true");
  const instanceId = await measurementCanvas.getAttribute("data-guided3d-instance");
  await page.locator("[data-continue]").click();

  const preview = page.locator('.concept-preview[data-layout="right-niche"]');
  const metadata = preview.locator(".concept-preview-meta");
  const context = preview.locator('[data-layout-context="right-niche"]');
  await expect(preview).toHaveAttribute(
    "data-preview-asset",
    "assets/photos/configurator/integrated/bookcase/cabinet-base-shelves/right-niche-v1.png"
  );
  await expect(context).toContainText("Right Niche");
  await expect(preview.locator(".concept-scene")).toHaveAttribute("data-guided3d-state", "ready");
  await expect(preview.locator("[data-room-layer], [data-product-layer]")).toHaveCount(0);
  await expect(preview.locator(".guided-3d-canvas")).toHaveCount(1);
  await expect(preview.locator(".guided-3d-canvas"))
    .toHaveAttribute("data-guided3d-instance", instanceId);
  await expect(preview.locator(".concept-scene > picture.concept-photo")).toHaveCount(1);
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

test("TV measurement scene keeps semantic screen callouts separate at landscape tablet size", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openFreshProject(page);
  await continueToLayouts(page, "TV Unit");
  await chooseLayout(page, "Clear Wall");
  await page.locator("[data-continue]").click();

  const room = page.locator('.measurement-room[data-layout="clear-wall"]');
  await expect(room).toHaveAttribute("data-guided3d-state", "ready");
  await expect(room.locator(":scope > [data-dimension-overlay], :scope > .measurement-feature"))
    .toHaveCount(0);
  const expectedDimensions = [
    ["wallWidth", "A"],
    ["ceilingHeight", "B"],
    ["desiredDepth", "C"],
    ["tvScreenSize", "D"],
    ["tvHeight", "E"]
  ];
  const diagnostics = await expectGuidedDimensionContract(
    room,
    expectedDimensions,
    "TV Clear Wall"
  );
  await expectGuidedLabelsInsideScene(room, diagnostics, "TV Clear Wall");
  expect(diagnostics.find(({ fieldId }) => fieldId === "tvScreenSize")?.axis)
    .toBe("diagonal");
  expect(diagnostics.find(({ fieldId }) => fieldId === "tvHeight")?.axis)
    .toBe("vertical");
  await expect(room.locator(
    '.guided-3d-dimension-label[data-dimension-field="tvScreenSize"] strong'
  )).toContainText("TV screen size (diagonal)");
  await expect(room.locator(
    '.guided-3d-dimension-label[data-dimension-field="tvHeight"] strong'
  )).toContainText("TV overall height");
});

test("all ten bookcase layouts preserve the canonical scene and dimensions at the required landscape viewports", async ({ page }) => {
  test.setTimeout(600_000);

  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 1536, height: 1024 },
    { width: 1366, height: 1024 }
  ]) {
    await page.setViewportSize(viewport);
    await openFreshProject(page);
    await continueToLayouts(page);

    for (const roomLayout of sharedLayouts) {
      const expectedDimensions = bookcaseMeasurementDimensions[roomLayout.id];
      const thumbnail = page.locator(`[data-layout-thumbnail="${roomLayout.id}"]`);
      await expect(thumbnail, `${roomLayout.label} thumbnail ready`).toHaveAttribute(
        "data-layout-thumbnail-state",
        "ready",
        { timeout: 90_000 }
      );
      const step2Signatures = await thumbnail.evaluate((element) => ({
        room: element.dataset.roomSignature || "",
        camera: element.dataset.cameraSignature || ""
      }));
      expect(step2Signatures.room, `${roomLayout.label} Step 2 room signature`)
        .toMatch(/^g3d-room-v1-/);
      expect(step2Signatures.camera, `${roomLayout.label} Step 2 camera signature`)
        .toMatch(/^g3d-camera-v1-/);

      await chooseLayout(page, roomLayout.label);
      await page.locator("[data-continue]").click();

      const room = page.locator(`.measurement-room[data-layout="${roomLayout.id}"]`);
      const context = `${viewport.width}x${viewport.height} ${roomLayout.label}`;

      await expect(room, `${context} room`).toHaveAttribute("data-guided3d-state", "ready");
      await expect(
        room.locator(":scope > [data-dimension-overlay], [data-dimension-span]"),
        `${context} legacy overlay absent`
      ).toHaveCount(0);
      const canvas = room.locator(".guided-3d-canvas");
      await expect(canvas, `${context} canvas`).toHaveCount(1);
      await expect(canvas, `${context} rendered`).toHaveAttribute("data-rendered", "true");
      await expect(canvas, `${context} layout`).toHaveAttribute("data-scene-layout", roomLayout.id);
      await expect(canvas, `${context} dimension mode`).toHaveAttribute("data-show-dimensions", "true");
      await expect(canvas, `${context} room signature`).toHaveAttribute(
        "data-room-signature",
        /^g3d-room-v1-/
      );
      await expect(canvas, `${context} camera signature`).toHaveAttribute(
        "data-camera-signature",
        /^g3d-camera-v1-/
      );
      await expect(canvas, `${context} Step 2/3 room continuity`).toHaveAttribute(
        "data-room-signature",
        step2Signatures.room
      );
      await expect(canvas, `${context} Step 2/3 camera continuity`).toHaveAttribute(
        "data-camera-signature",
        step2Signatures.camera
      );
      const instanceId = await canvas.getAttribute("data-guided3d-instance");
      const initialSceneSignature = await canvas.getAttribute("data-scene-signature");

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

      const diagnostics = await expectGuidedDimensionContract(room, expectedDimensions, context);
      await expectGuidedLabelsInsideScene(room, diagnostics, context);

      const wallWidth = page.locator('[data-measurement="wallWidth"]');
      const originalWallWidth = await wallWidth.inputValue();
      await wallWidth.fill(String(Number(originalWallWidth) + 1));
      await expect.poll(
        () => canvas.getAttribute("data-scene-signature"),
        { message: `${context} measurement update changes scene geometry` }
      ).not.toBe(initialSceneSignature);
      const adjustedSignatures = await canvas.evaluate((element) => ({
        room: element.dataset.roomSignature || "",
        camera: element.dataset.cameraSignature || "",
        scene: element.dataset.sceneSignature || ""
      }));
      expect(adjustedSignatures.room, `${context} adjusted room signature`)
        .not.toBe(step2Signatures.room);
      expect(adjustedSignatures.camera, `${context} adjusted camera signature`)
        .toMatch(/^g3d-camera-v1-/);
      const adjustedDiagnostics = await expectGuidedDimensionContract(
        room,
        expectedDimensions,
        `${context} adjusted`
      );
      await expectGuidedLabelsInsideScene(room, adjustedDiagnostics, `${context} adjusted`);
      await expect(room.locator(
        '.guided-3d-dimension-label[data-dimension-field="wallWidth"] small'
      )).toHaveText(`${Number(originalWallWidth) + 1} in`);

      await page.locator("[data-continue]").click();
      await expect(page.getByRole("heading", { name: "Refine your concept" })).toBeVisible();
      const concept = page.locator('.concept-scene[data-guided3d-state="ready"]');
      const conceptCanvas = concept.locator(".guided-3d-canvas");
      await expect(conceptCanvas, `${context} Step 4 canvas`).toHaveCount(1);
      await expect(conceptCanvas, `${context} persistent controller`).toHaveAttribute(
        "data-guided3d-instance",
        instanceId
      );
      await expect(conceptCanvas, `${context} Step 3/4 room continuity`).toHaveAttribute(
        "data-room-signature",
        adjustedSignatures.room
      );
      await expect(conceptCanvas, `${context} Step 3/4 camera continuity`).toHaveAttribute(
        "data-camera-signature",
        adjustedSignatures.camera
      );
      await expect(conceptCanvas).toHaveAttribute("data-show-product", "true");
      await expect(conceptCanvas).toHaveAttribute("data-show-dimensions", "false");
      await expect(concept.locator("[data-room-layer], [data-product-layer]")).toHaveCount(0);

      const preFinishSignature = await conceptCanvas.getAttribute("data-scene-signature");
      await page.getByRole("tab", { name: "Finish", exact: true }).click();
      await page.getByRole("button", { name: "Charcoal", exact: true }).click();
      await expect.poll(
        () => conceptCanvas.getAttribute("data-scene-signature"),
        { message: `${context} finish update changes only product appearance` }
      ).not.toBe(preFinishSignature);
      await expect(conceptCanvas).toHaveAttribute(
        "data-room-signature",
        adjustedSignatures.room
      );
      await expect(conceptCanvas).toHaveAttribute(
        "data-camera-signature",
        adjustedSignatures.camera
      );
      await expect(conceptCanvas).toHaveAttribute("data-guided3d-instance", instanceId);
      await page.getByRole("button", { name: "Natural Oak", exact: true }).click();

      const geometry = await page.evaluate(() => ({
        horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth
      }));
      expect(geometry.horizontalOverflow, `${context} horizontal overflow`).toBeLessThanOrEqual(1);

      await page.locator("[data-back]").click();
      await expect(page.getByRole("heading", { name: "Tell us about your space" })).toBeVisible();
      const restoredRoom = page.locator(`.measurement-room[data-layout="${roomLayout.id}"]`);
      const restoredCanvas = restoredRoom.locator(".guided-3d-canvas");
      await wallWidth.fill(originalWallWidth);
      await expect(restoredCanvas, `${context} restored Step 3 room`).toHaveAttribute(
        "data-room-signature",
        step2Signatures.room
      );
      await expect(restoredCanvas, `${context} restored Step 3 camera`).toHaveAttribute(
        "data-camera-signature",
        step2Signatures.camera
      );
      await expect(restoredCanvas, `${context} restored persistent controller`).toHaveAttribute(
        "data-guided3d-instance",
        instanceId
      );
      await page.locator("[data-back]").click();
      await expect(page.getByRole("heading", { name: "Choose the room condition that matches your space" })).toBeVisible();
    }
  }
});

test("dense iPad Room & Size keeps every Between Openings 3D label readable", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 960 });
  await openFreshProject(page);
  await continueToLayouts(page, "TV Unit");
  await chooseLayout(page, "Between Openings");
  await page.locator("[data-continue]").click();

  const layout = page.locator(".measurement-layout--dense");
  const room = page.locator('.measurement-room[data-layout="double-opening"]');
  await expect(layout).toBeVisible();
  await expect(room).toHaveAttribute("data-guided3d-state", "ready");
  await expect(room.locator(":scope > [data-dimension-overlay]")).toHaveCount(0);
  const diagnostics = await expectGuidedDimensionContract(
    room,
    bookcaseMeasurementDimensions["double-opening"],
    "dense iPad Between Openings"
  );
  await expectGuidedLabelsInsideScene(room, diagnostics, "dense iPad Between Openings");

  const geometry = await page.evaluate(() => {
    const layoutElement = document.querySelector(".measurement-layout--dense");
    const panel = layoutElement.querySelector(".measurement-panel");
    const diagram = layoutElement.querySelector(".measurement-diagram-card");
    const runtime = diagram.querySelector(".guided-3d-runtime");
    return {
      panelWidth: panel.getBoundingClientRect().width,
      diagramWidth: diagram.getBoundingClientRect().width,
      runtimeWidth: runtime.getBoundingClientRect().width,
      runtimeHeight: runtime.getBoundingClientRect().height
    };
  });

  expect(geometry.panelWidth).toBeGreaterThanOrEqual(450);
  expect(geometry.panelWidth).toBeLessThanOrEqual(475);
  expect(geometry.diagramWidth).toBeGreaterThanOrEqual(700);
  expect(geometry.runtimeWidth).toBeGreaterThanOrEqual(700);
  expect(geometry.runtimeHeight).toBeGreaterThan(300);
});

test("Door Wall 3D dimensions stay on semantic architecture at desktop and iPad landscape sizes", async ({ page }) => {
  const expectedAnchors = Object.freeze({
    wallWidth: ["wall-left-boundary", "wall-right-boundary"],
    ceilingHeight: ["finished-floor", "ceiling-plane"],
    desiredDepth: ["product-front-plane", "wall-face"],
    doorWidth: ["door-left-jamb", "door-right-jamb"],
    doorHeight: ["door-threshold", "door-head"],
    doorLeftDistance: ["door-visual-left-edge", "visual-left-wall-boundary"],
    doorTrimWidth: ["door-jamb", "door-trim-outer-edge"]
  });

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
    const context = `${viewport.width}x${viewport.height} Door Wall`;
    await expect(room).toHaveAttribute("data-guided3d-state", "ready");
    await expect(room.locator(":scope > [data-dimension-overlay], [data-dimension-span]"))
      .toHaveCount(0);
    const diagnostics = await expectGuidedDimensionContract(
      room,
      bookcaseMeasurementDimensions["door-wall"],
      context
    );
    await expectGuidedLabelsInsideScene(room, diagnostics, context);
    expect(
      Object.fromEntries(diagnostics.map((diagnostic) => [
        diagnostic.fieldId,
        [diagnostic.startAnchor, diagnostic.endAnchor]
      ])),
      `${context} canonical architectural anchors`
    ).toEqual(expectedAnchors);
    expect(diagnostics.find(({ fieldId }) => fieldId === "wallWidth")?.axis)
      .toBe("horizontal");
    expect(diagnostics.find(({ fieldId }) => fieldId === "ceilingHeight")?.axis)
      .toBe("vertical");
    expect(diagnostics.find(({ fieldId }) => fieldId === "desiredDepth")?.axis)
      .toBe("depth");

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
        room.locator(`.guided-3d-dimension-label[data-dimension-field="${fieldId}"] small`),
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
  const roomThumbnails = page.locator("[data-layout-thumbnail]");
  await expect(roomThumbnails).toHaveCount(sharedLayouts.length);
  await expect.poll(() => roomThumbnails.evaluateAll((mounts) => mounts.every((mount) => {
    const image = mount.querySelector("[data-layout-3d-thumbnail]");
    return (
      mount.dataset.layoutThumbnailState === "ready"
      && image?.complete
      && image.naturalWidth > 0
      && image.currentSrc.startsWith("data:image/png")
    );
  }))).toBe(true);
  const thumbnailDiagnostics = await roomThumbnails.evaluateAll((mounts) => mounts.map((mount) => ({
    layout: mount.dataset.layoutThumbnail,
    scene: mount.dataset.roomSceneId,
    room: mount.dataset.roomSignature,
    camera: mount.dataset.cameraSignature
  })));
  expect(thumbnailDiagnostics.map(({ layout }) => layout))
    .toEqual(sharedLayouts.map(({ id }) => id));
  expect(thumbnailDiagnostics.map(({ scene }) => scene))
    .toEqual(sharedLayouts.map(({ id }) => id));
  expect(new Set(thumbnailDiagnostics.map(({ room }) => room)).size).toBe(sharedLayouts.length);
  thumbnailDiagnostics.forEach(({ room, camera }) => {
    expect(room).toMatch(/^g3d-room-v1-/);
    expect(camera).toMatch(/^g3d-camera-v1-/);
  });

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
  await expect(page.locator(".concept-scene")).toHaveAttribute("data-guided3d-state", "ready");
  await expect(page.locator(".concept-scene [data-room-layer], .concept-scene [data-product-layer]"))
    .toHaveCount(0);
  await expect(page.locator(".concept-scene .guided-3d-canvas")).toHaveCount(1);
  await expect(page.locator(".concept-scene .guided-3d-canvas")).toHaveCSS("display", "block");

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

test("no-WebGL fallback preserves the complete canonical room in the shared 3:2 frame", async ({ page }) => {
  await page.route("**/guided-configurator-3d.js*", (route) => route.fulfill({
    contentType: "text/javascript",
    body: 'export function createGuidedSceneController() { throw new Error("WebGL unavailable in fallback framing test"); }'
  }));

  await openFreshProject(page);
  await continueToLayouts(page);

  const thumbnail = page.locator('[data-layout="niche-layout"] [data-layout-thumbnail]');
  await expect(thumbnail).toHaveAttribute("data-layout-thumbnail-state", "fallback");
  const thumbnailImage = thumbnail.locator("img");
  await expect(thumbnailImage).toHaveCSS("object-fit", "contain");
  await expect(thumbnailImage).toHaveCSS("object-position", "50% 50%");
  await expect.poll(() => thumbnailImage.evaluate((image) => (
    image.complete && image.naturalWidth === image.naturalHeight && image.naturalWidth > 1
  ))).toBe(true);
  const thumbnailFraming = await thumbnail.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const overlayStyle = getComputedStyle(element, "::after");
    return {
      aspectRatio: bounds.width / bounds.height,
      backgroundImage: style.backgroundImage,
      fallbackOverlayDisplay: overlayStyle.display
    };
  });
  expect(thumbnailFraming.aspectRatio).toBeCloseTo(1.5, 2);
  expect(thumbnailFraming.backgroundImage).toBe("none");
  expect(thumbnailFraming.fallbackOverlayDisplay).toBe("none");

  await chooseLayout(page, "Niche Layout");
  await page.locator("[data-continue]").click();

  const measurementRoom = page.locator('.measurement-room[data-layout="niche-layout"]');
  await expect(measurementRoom).toHaveAttribute("data-guided3d-state", "fallback");
  const measurementImage = measurementRoom.locator("img.measurement-room-image");
  await expect(measurementImage).toHaveCSS("object-fit", "contain");
  await expect(measurementImage).toHaveCSS("object-position", "50% 50%");
  await expect.poll(() => measurementImage.evaluate((image) => (
    image.complete && image.naturalWidth === image.naturalHeight && image.naturalWidth > 1
  ))).toBe(true);
  expect(await measurementRoom.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return bounds.width / bounds.height;
  })).toBeCloseTo(1.5, 2);

  await page.locator("[data-continue]").click();
  const conceptScene = page.locator(".concept-scene");
  await expect(conceptScene).toHaveAttribute("data-guided3d-state", "fallback");
  const conceptImage = conceptScene.locator("img.concept-photo");
  await expect(conceptImage).toHaveCSS("object-fit", "contain");
  await expect(conceptImage).toHaveCSS("object-position", "50% 50%");
  await expect(conceptScene.locator(".concept-finish-overlay"))
    .toHaveAttribute("preserveAspectRatio", "xMidYMid meet");
  expect(await conceptScene.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return bounds.width / bounds.height;
  })).toBeCloseTo(1.5, 2);
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
      await expect(preview).toHaveAttribute("data-preview-asset", expectedAsset);
      await expect(preview.locator(".concept-scene")).toHaveAttribute("data-guided3d-state", "fallback");
      await expect(preview.locator("[data-room-layer], [data-product-layer]")).toHaveCount(0);
      await expect(preview.locator(".concept-scene > picture.concept-photo")).toHaveCount(1);
      await expect(preview.locator(".concept-scene img.concept-photo")).toHaveCount(1);
      await expect(preview.locator(".concept-finish-overlay")).toBeVisible();
      await expect(preview.locator("img.concept-photo")).toHaveCSS(
        "object-fit",
        expected.layoutPreviewFit
      );
      await expect(preview.locator("img.concept-photo")).toHaveCSS(
        "object-position",
        expected.layoutPreviewPosition
      );
      await expect(preview.locator(".concept-finish-overlay")).toHaveAttribute(
        "preserveAspectRatio",
        `xMidYMid ${expected.layoutPreviewFit === "cover" ? "slice" : "meet"}`
      );
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
  const mobileRoom = page.locator('.measurement-room[data-layout="window-wall"]');
  const mobileDiagnostics = await expectGuidedDimensionContract(
    mobileRoom,
    bookcaseMeasurementDimensions["window-wall"],
    "390x844 Window Wall"
  );
  await expectGuidedLabelsInsideScene(mobileRoom, mobileDiagnostics, "390x844 Window Wall");
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
