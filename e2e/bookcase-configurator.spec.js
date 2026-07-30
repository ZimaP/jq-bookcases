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

const visibleMeasurementDimensions = Object.freeze(["wallWidth", "ceilingHeight"]);

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

async function expectIntegratedPreview(preview, expectedAsset) {
  await expect(preview).toHaveAttribute("data-preview-render-mode", "integrated");
  await expect(preview).toHaveAttribute("data-preview-asset", expectedAsset);
  expect(
    await preview.evaluate((element) => (
      ["data-room-asset", "data-product-asset"]
        .filter((attribute) => element.hasAttribute(attribute))
    ))
  ).toEqual([]);
  await expect(preview.locator("[data-room-layer], [data-product-layer]")).toHaveCount(0);
  await expect(
    preview.locator("[data-installation-envelope], [data-installation-envelope-id]")
  ).toHaveCount(0);

  const picture = preview.locator("picture.concept-photo");
  await expect(picture).toHaveCount(1);
  await expect(picture).toBeVisible();
  const image = picture.locator("img");
  await expect(image).toHaveCount(1);
  await expect(image).toBeVisible();
  await expect(image).toHaveCSS("object-fit", "contain");
  await expect.poll(() => image.evaluate((element, asset) => (
    element.complete
      && element.naturalWidth > 0
      && element.naturalHeight > 0
      && new URL(element.currentSrc).pathname.endsWith(asset.replace(/\.png$/, ".avif"))
  ), expectedAsset)).toBe(true);
  const finishOverlay = preview.locator("svg.concept-finish-overlay");
  await expect(finishOverlay).toBeVisible();
  await expect(finishOverlay).toHaveAttribute("preserveAspectRatio", "xMidYMid meet");
  return image;
}

async function readConceptImageGeometry(image) {
  return image.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      currentSrc: element.currentSrc,
      naturalWidth: element.naturalWidth,
      naturalHeight: element.naturalHeight,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      objectFit: style.objectFit,
      objectPosition: style.objectPosition
    };
  });
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

test("Step 1 product cards show every full composition without changing room-card fitting", async ({ page }) => {
  for (const viewport of [
    { name: "desktop", width: 1280, height: 720 },
    { name: "iPad landscape", width: 1024, height: 768 }
  ]) {
    await test.step(viewport.name, async () => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openFreshProject(page);

      const images = page.locator(".guided-shell--step-1 .product-grid--catalog [data-product-choice] img");
      await expect(images).toHaveCount(products.length);
      await expect.poll(() => images.evaluateAll((elements) => elements.every((image) => (
        image.complete
        && image.naturalWidth > 0
        && image.naturalHeight > 0
        && getComputedStyle(image).objectFit === "contain"
        && getComputedStyle(image).objectPosition === "50% 50%"
        && getComputedStyle(image).transform === "none"
      )))).toBe(true);

      const geometry = await page.locator("[data-product-choice]").evaluateAll((cards) => cards.map((card) => {
        const cardRect = card.getBoundingClientRect();
        const mediaRect = card.querySelector(".product-card-image").getBoundingClientRect();
        return {
          cardWidth: cardRect.width,
          cardHeight: cardRect.height,
          mediaWidth: mediaRect.width,
          mediaHeight: mediaRect.height
        };
      }));
      expect(geometry.every(({ cardWidth, cardHeight, mediaWidth, mediaHeight }) => (
        cardWidth > 0
        && cardHeight > 0
        && Math.abs(mediaWidth - cardWidth) <= 2
        && mediaHeight > 0
        && mediaHeight < cardHeight
      ))).toBe(true);
    });
  }

  await continueToLayouts(page);
  const layoutImages = page.locator(".layout-grid .layout-illustration img");
  await expect(layoutImages).toHaveCount(sharedLayouts.length);
  await expect.poll(() => layoutImages.evaluateAll((images) => (
    images.every((image) => getComputedStyle(image).objectFit === "cover")
  ))).toBe(true);
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
  await page.locator("[data-continue]").click();

  const customizationPreview = page.locator('.concept-preview[data-layout="double-opening"]');
  const customizationContext = customizationPreview.locator('[data-layout-context="double-opening"]');
  const roomAsset = "assets/photos/configurator/room-layouts/room-double-opening-v1.png";
  const conceptAsset = "assets/photos/configurator/concept-full-shelving-between-openings-v1.png";
  await expectIntegratedPreview(customizationPreview, conceptAsset);
  await expect(customizationContext).toBeVisible();
  await expect(customizationContext).toHaveAccessibleName("Selected room condition: Between Openings");
  await expect(customizationContext).toHaveAttribute("data-layout-context-asset", roomAsset);
  const contextGeometry = await customizationPreview.evaluate((preview) => {
    const previewRect = preview.getBoundingClientRect();
    const metaRect = preview.querySelector(".concept-preview-meta").getBoundingClientRect();
    const sceneRect = preview.querySelector(".concept-scene").getBoundingClientRect();
    const finishRect = preview.querySelector(".concept-finish-caption").getBoundingClientRect();
    const contextRect = preview.querySelector("[data-layout-context]").getBoundingClientRect();
    const pictureRect = preview.querySelector("picture.concept-photo").getBoundingClientRect();
    const overlaps = (first, second) => (
      first.left < second.right
      && first.right > second.left
      && first.top < second.bottom
      && first.bottom > second.top
    );
    return {
      widthRatio: contextRect.width / previewRect.width,
      heightRatio: contextRect.height / previewRect.height,
      metaBeforeScene: metaRect.bottom <= sceneRect.top + 1,
      contextBeforeScene: contextRect.bottom <= sceneRect.top + 1,
      controlsDoNotOverlap: !overlaps(finishRect, contextRect),
      pictureFillsScene: (
        Math.abs(pictureRect.left - sceneRect.left) <= 1
        && Math.abs(pictureRect.top - sceneRect.top) <= 1
        && Math.abs(pictureRect.right - sceneRect.right) <= 1
        && Math.abs(pictureRect.bottom - sceneRect.bottom) <= 1
      ),
      insidePreview: (
        contextRect.top >= previewRect.top
        && contextRect.right <= previewRect.right
        && contextRect.bottom <= previewRect.bottom
        && contextRect.left >= previewRect.left
      )
    };
  });
  expect(contextGeometry.insidePreview).toBe(true);
  expect(contextGeometry.widthRatio).toBeLessThan(0.5);
  expect(contextGeometry.heightRatio).toBeLessThan(0.12);
  expect(contextGeometry.metaBeforeScene).toBe(true);
  expect(contextGeometry.contextBeforeScene).toBe(true);
  expect(contextGeometry.controlsDoNotOverlap).toBe(true);
  expect(contextGeometry.pictureFillsScene).toBe(true);

  await page.getByRole("button", { name: "Charcoal", exact: true }).click();
  await expect(customizationPreview).toHaveAttribute("data-finish", "charcoal");
  await expect(customizationContext).toBeVisible();
  await page.locator("[data-continue]").click();

  const reviewPreview = page.locator('.concept-preview[data-layout="double-opening"]');
  await expect(page.locator('[data-summary-value="layout"]')).toHaveText("Between Openings");
  await expectIntegratedPreview(reviewPreview, conceptAsset);
  await expect(reviewPreview).toHaveAttribute("data-finish", "charcoal");
  await expect(reviewPreview.locator('[data-layout-context="double-opening"]')).toBeVisible();
  await expect(reviewPreview.locator('[data-layout-context="double-opening"]')).toHaveAccessibleName(
    "Selected room condition: Between Openings"
  );
});

test("TV Unit keeps one exact Between Openings composite through customization, review, and reload", async ({ page }) => {
  const conceptAsset = "assets/photos/configurator/integrated/tv-unit/framed-tv-wall/double-opening-v2.png";
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

      await page.locator("[data-continue]").click();
      await expect(page.getByRole("heading", { name: "Refine your concept" })).toBeVisible();

      const customizationPreview = page.locator(
        '.concept-preview[data-category="tv-unit"][data-layout="double-opening"]'
      );
      await expectIntegratedPreview(customizationPreview, conceptAsset);

      const customizationLayers = await customizationPreview.evaluate((preview) => {
        const scene = preview.querySelector("[data-concept-scene]").getBoundingClientRect();
        const picture = preview.querySelector("picture.concept-photo").getBoundingClientRect();
        return {
          pictureFillsScene: (
            Math.abs(picture.left - scene.left) <= 1
            && Math.abs(picture.top - scene.top) <= 1
            && Math.abs(picture.right - scene.right) <= 1
            && Math.abs(picture.bottom - scene.bottom) <= 1
          )
        };
      });
      expect(customizationLayers).toEqual({ pictureFillsScene: true });

      await page.getByRole("button", { name: "Charcoal", exact: true }).click();
      await expect(customizationPreview).toHaveAttribute("data-finish", "charcoal");
      await page.waitForTimeout(250);
      await page.locator("[data-continue]").click();
      await expect(page.getByRole("heading", { name: "Review your custom concept" })).toBeVisible();
      const reviewPreview = page.locator(
        '.concept-preview[data-category="tv-unit"][data-layout="double-opening"]'
      );
      await expectIntegratedPreview(reviewPreview, conceptAsset);

      await page.locator('[data-step="4"]').click();
      await expect(page).toHaveURL(/configurator\.html#step-4$/);
      await expect(page.getByRole("heading", { name: "Refine your concept" })).toBeVisible();
      await page.reload({ waitUntil: "networkidle" });
      await expect(page).toHaveURL(/configurator\.html#step-4$/);
      await expect(page.getByRole("heading", { name: "Refine your concept" })).toBeVisible();
      const reloadedCustomizationPreview = page.locator(
        '.concept-preview[data-category="tv-unit"][data-layout="double-opening"]'
      );
      await expectIntegratedPreview(reloadedCustomizationPreview, conceptAsset);

      await page.locator("[data-continue]").click();
      await expect(page.getByRole("heading", { name: "Review your custom concept" })).toBeVisible();
      const reloadedPreview = page.locator(
        '.concept-preview[data-category="tv-unit"][data-layout="double-opening"]'
      );
      await expectIntegratedPreview(reloadedPreview, conceptAsset);
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
    const image = await expectIntegratedPreview(preview, variant.asset);
    await expect.poll(() => image.evaluate((element) => (
      element.naturalWidth === 1536 && element.naturalHeight === 1024
    ))).toBe(true);
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
  await expect.poll(() => finishMaskStatus).toBe(200);
  await page.locator("[data-continue]").click();

  const customizationPreview = page.locator('.concept-preview[data-layout="door-wall"]');
  await expect(customizationPreview).toHaveAttribute(
    "data-preview-key",
    "bookcase:drawer-base-shelves:door-wall"
  );
  await expect(customizationPreview).toHaveAttribute("data-style", "drawer-base-shelves");
  const customizationImage = await expectIntegratedPreview(customizationPreview, asset);
  await expect(customizationPreview.locator('[data-layout-context="door-wall"]')).toHaveAccessibleName(
    "Selected room condition: Door Wall"
  );
  await expect.poll(() => customizationImage.evaluate((image, expectedPath) => (
    image.naturalWidth === 1536
      && image.naturalHeight === 1024
      && new URL(image.currentSrc).pathname.endsWith(expectedPath)
  ), avifAsset)).toBe(true);
  const beforeFinish = await readConceptImageGeometry(customizationImage);

  await page.getByRole("tab", { name: "Finish" }).click();
  await page.getByRole("button", { name: "Charcoal", exact: true }).click();
  await expect(customizationPreview).toHaveAttribute("data-finish", "charcoal");
  const updatedCustomizationImage = await expectIntegratedPreview(customizationPreview, asset);
  const afterFinish = await readConceptImageGeometry(updatedCustomizationImage);
  expect(afterFinish.currentSrc).toBe(beforeFinish.currentSrc);
  expect(afterFinish.naturalWidth).toBe(beforeFinish.naturalWidth);
  expect(afterFinish.naturalHeight).toBe(beforeFinish.naturalHeight);
  expect(afterFinish.objectFit).toBe(beforeFinish.objectFit);
  expect(afterFinish.objectPosition).toBe(beforeFinish.objectPosition);
  for (const key of ["left", "top", "width", "height"]) {
    expect(afterFinish[key], `finish preserves ${key}`).toBeCloseTo(beforeFinish[key], 1);
  }

  await page.locator("[data-continue]").click();
  const reviewPreview = page.locator('.concept-preview[data-layout="door-wall"]');
  await expect(page.locator('[data-summary-value="layout"]')).toHaveText("Door Wall");
  await expect(page.locator('[data-summary-value="product"]')).toHaveText("Drawers + Shelves");
  await expect(reviewPreview).toHaveAttribute("data-preview-key", "bookcase:drawer-base-shelves:door-wall");
  const reviewImage = await expectIntegratedPreview(reviewPreview, asset);
  const reviewImageSource = await reviewImage.evaluate((image) => image.currentSrc);
  expect(reviewImageSource).toBe(afterFinish.currentSrc);
});

test("Right Niche shows only room perimeter dimensions and one integrated preview", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openFreshProject(page);
  await continueToLayouts(page);
  await chooseLayout(page, "Right Niche");
  await page.locator("[data-continue]").click();

  const diagram = page.locator(".measurement-diagram-card");
  const room = diagram.locator(".measurement-room");
  const guideLabels = diagram.locator(".measurement-annotation-label");
  await expect(room.locator(":scope > .dimension-overlay")).toBeVisible();
  await expect(guideLabels.locator(".measurement-annotation-code")).toHaveCount(0);
  await expect(guideLabels.locator(".measurement-annotation-name")).toHaveText([
    "Wall width",
    "Ceiling height"
  ]);
  await expect(diagram.locator("[data-dimension-value]")).toHaveText([
    "120 in",
    "96 in"
  ]);
  await expect(diagram.locator("[data-dimension-span]")).toHaveCount(2);
  await expect(diagram.locator("[data-dimension-line]")).toHaveCount(2);
  await expect(diagram.locator("[data-dimension-extension]")).toHaveCount(4);
  await expect(diagram.locator("[data-dimension-end]")).toHaveCount(4);
  await expect(diagram.locator('[data-dimension-span="desiredDepth"]')).toHaveCount(0);
  await expect(diagram.locator('[data-dimension-span="nicheWidth"]')).toHaveCount(0);
  await expect(diagram.locator('[data-dimension-span="nicheHeight"]')).toHaveCount(0);
  await expect(diagram.locator('[data-dimension-span="nicheDepth"]')).toHaveCount(0);
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
  await expectIntegratedPreview(
    preview,
    "assets/photos/configurator/integrated/bookcase/cabinet-base-shelves/right-niche-v1.png"
  );
  await expect(context).toContainText("Right Niche");
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

test("TV room keeps its feature while the overlay shows only wall width and ceiling height", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openFreshProject(page);
  await continueToLayouts(page, "TV Unit");
  await chooseLayout(page, "Clear Wall");
  await page.locator("[data-continue]").click();

  const diagram = page.locator(".measurement-diagram-card");
  const room = diagram.locator(".measurement-room");
  const tv = room.locator(".measurement-feature");

  await expect(room).toHaveAttribute("data-feature", "tv");
  await expect(tv).toBeVisible();
  await expect(diagram.locator(".measurement-annotation-code")).toHaveCount(0);
  await expect(diagram.locator(".measurement-annotation-name")).toHaveText([
    "Wall width",
    "Ceiling height"
  ]);
  await expect(diagram.locator("[data-dimension-span]")).toHaveCount(2);
  await expect(diagram.locator('[data-dimension-span="tvScreenSize"]')).toHaveCount(0);
  await expect(diagram.locator('[data-dimension-span="tvHeight"]')).toHaveCount(0);
  await expect(page.locator('[data-measurement-row="tvScreenSize"] .measurement-code')).toHaveText("D");
  await expect(page.locator('[data-measurement-row="tvHeight"] .measurement-code')).toHaveText("E");

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
    const labels = [...element.querySelectorAll("[data-dimension-label]")].map((label) => (
      bounds(`[data-dimension-label="${CSS.escape(label.dataset.dimensionLabel)}"]`)
    ));
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
      calloutsOverlap: overlaps(labels[0], labels[1]),
      widthLineLength: lineLength("wallWidth"),
      heightLineLength: lineLength("ceilingHeight"),
      allInsideDiagram: [tvRect, ...labels].every((rect) => (
        rect.left >= diagramRect.left
        && rect.right <= diagramRect.right
        && rect.top >= diagramRect.top
        && rect.bottom <= diagramRect.bottom
      ))
    };
  });

  expect(geometry.tvCenterDelta).toBeLessThanOrEqual(2);
  expect(geometry.calloutsOverlap).toBe(false);
  expect(geometry.widthLineLength).toBeGreaterThan(20);
  expect(geometry.heightLineLength).toBeGreaterThan(20);
  expect(geometry.allInsideDiagram).toBe(true);
});

test("all ten bookcase layouts render one responsive two-dimension perimeter overlay", async ({ page }) => {
  test.slow();

  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 1180, height: 820 }
  ]) {
    await page.setViewportSize(viewport);
    await openFreshProject(page);
    await continueToLayouts(page);

    for (const roomLayout of sharedLayouts) {
      await chooseLayout(page, roomLayout.label);
      await page.locator("[data-continue]").click();

      const room = page.locator(`.measurement-room[data-layout="${roomLayout.id}"]`);
      const drawing = room.locator("[data-dimension-drawing]");
      const spans = drawing.locator("[data-dimension-span]");
      const labels = room.locator("[data-dimension-label]");
      const context = `${viewport.width}x${viewport.height} ${roomLayout.label}`;

      await expect(room, `${context} room`).toBeVisible();
      await expect(drawing, `${context} drawing`).toBeVisible();
      await expect(drawing, `${context} count metadata`).toHaveAttribute("data-dimension-count", "2");
      await expect(spans, `${context} spans`).toHaveCount(2);
      await expect(labels, `${context} labels`).toHaveCount(2);
      expect(
        await spans.evaluateAll((elements) => elements.map((element) => element.dataset.dimensionSpan)),
        `${context} ordered perimeter fields`
      ).toEqual(visibleMeasurementDimensions);
      expect(
        await labels.evaluateAll((elements) => elements.map((element) => element.dataset.dimensionLabel)),
        `${context} ordered perimeter labels`
      ).toEqual(visibleMeasurementDimensions);
      await expect(drawing.locator(".measurement-annotation-code"), `${context} image codes`).toHaveCount(0);
      await expect(drawing.locator("[data-dimension-line]"), `${context} main lines`).toHaveCount(2);
      await expect(drawing.locator("[data-dimension-extension]"), `${context} endpoint extensions`).toHaveCount(4);
      await expect(drawing.locator("[data-dimension-end]"), `${context} arrowheads`).toHaveCount(4);
      await expect(drawing.locator('[data-dimension-span="desiredDepth"]'), `${context} no depth`).toHaveCount(0);

      await expect.poll(
        () => room.locator("img.measurement-room-image").evaluate((image) => (
          image.complete && image.naturalWidth > 0 && image.naturalHeight > 0
        )),
        { message: `${context} room image loaded` }
      ).toBe(true);

      const geometry = await room.evaluate((element) => {
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
          containTransformsMatch: (
            drawingElement.getAttribute("preserveAspectRatio") === "xMidYMid meet"
            && getComputedStyle(imageElement).objectFit === "contain"
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
      });

      expect(geometry.drawingInsideRoom, `${context} drawing stays inside room`).toBe(true);
      expect(geometry.oneResponsiveOverlay, `${context} uses one SVG overlay`).toBe(true);
      expect(geometry.viewBoxMatchesImage, `${context} SVG ratio matches the room image`).toBe(true);
      expect(geometry.containTransformsMatch, `${context} image and SVG share one contain transform`).toBe(true);
      expect(geometry.pointerEventsDisabled, `${context} overlay ignores pointer events`).toBe(true);
      expect(geometry.visibleLabelCount, `${context} visible label count`).toBe(2);
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
        expect(span.endStyle, `${context} ${span.fieldId} arrow end style`).toBe("arrow");
        expect(span.endTickCount, `${context} ${span.fieldId} short endpoint extensions`).toBe(2);
        expect(span.arrowCount, `${context} ${span.fieldId} arrowheads`).toBe(2);
        expect(span.visibleStroke, `${context} ${span.fieldId} stroke`).toBe(true);
        expect(span.lineLength, `${context} ${span.fieldId} rendered line length`).toBeGreaterThan(10);
      }

      await page.locator("[data-back]").click();
      await expect(page.getByRole("heading", { name: "Choose the room condition that matches your space" })).toBeVisible();
    }
  }
});

test("dense iPad Room & Size keeps both Between Openings perimeter cards readable", async ({ page }) => {
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
  await expect(drawing).toHaveAttribute("preserveAspectRatio", "xMidYMid meet");
  await expect(drawing.locator("[data-dimension-span]")).toHaveCount(2);

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
        ceilingHeight: lineSource("ceilingHeight")
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
  expect(Math.abs(geometry.lineSources.wallWidth[0] - 304), "left wall boundary").toBeLessThan(1);
  expect(Math.abs(geometry.lineSources.wallWidth[2] - 1230), "right wall boundary").toBeLessThan(1);
  expect(geometry.lineSources.wallWidth[1]).toBe(geometry.lineSources.wallWidth[3]);
  expect(Math.abs(geometry.lineSources.ceilingHeight[1] - 150), "ceiling boundary").toBeLessThan(1);
  expect(Math.abs(geometry.lineSources.ceilingHeight[3] - 785), "finished floor boundary").toBeLessThan(1);
  expect(geometry.lineSources.ceilingHeight[0]).toBe(geometry.lineSources.ceilingHeight[2]);
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
    await expect(drawing).toHaveAttribute("preserveAspectRatio", "xMidYMid meet");
    await expect(drawing.locator("[data-dimension-span]")).toHaveCount(2);
    await expect(drawing.locator("[data-dimension-extension]")).toHaveCount(4);
    await expect(drawing.locator("[data-dimension-end]")).toHaveCount(4);
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
      return {
        lines: {
          wallWidth: lineReport("wallWidth"),
          ceilingHeight: lineReport("ceilingHeight")
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
        renderedFields: [...svg.querySelectorAll("[data-dimension-span]")]
          .map((span) => span.dataset.dimensionSpan),
        depthDimensionCount: svg.querySelectorAll('[data-dimension-span="desiredDepth"]').length,
        doorDimensionCount: svg.querySelectorAll(
          '[data-dimension-span="doorWidth"], [data-dimension-span="doorHeight"], [data-dimension-span="doorLeftDistance"]'
        ).length,
        trimDimensionCount: svg.querySelectorAll('[data-dimension-span="doorTrimWidth"]').length,
        swingDimensionCount: svg.querySelectorAll('[data-dimension-span="doorSwing"]').length
      };
    });

    expect(Math.abs(geometry.lines.wallWidth.source[0] - 240), `${context} left wall anchor`).toBeLessThan(1);
    expect(Math.abs(geometry.lines.wallWidth.source[2] - 1295), `${context} right wall anchor`).toBeLessThan(1);
    expect(Math.abs(geometry.lines.ceilingHeight.source[1] - 157), `${context} ceiling anchor`).toBeLessThan(1);
    expect(Math.abs(geometry.lines.ceilingHeight.source[3] - 758), `${context} floor anchor`).toBeLessThan(1);
    expect(Math.abs(geometry.lines.wallWidth.dy), `${context} wall width is horizontal`).toBeLessThan(0.01);
    expect(Math.abs(geometry.lines.ceilingHeight.dx), `${context} ceiling height is vertical`).toBeLessThan(0.01);
    expect(geometry.labelsInsideRoom, `${context} cards remain inside the room`).toBe(true);
    expect(geometry.labelOverlaps, `${context} cards do not overlap`).toEqual([]);
    expect(geometry.labelsOverDoor, `${context} cards do not cover the door opening`).toEqual([]);
    expect(geometry.renderedFields, `${context} visible dimensions`).toEqual(visibleMeasurementDimensions);
    expect(geometry.depthDimensionCount, `${context} omits depth`).toBe(0);
    expect(geometry.doorDimensionCount, `${context} omits door feature dimensions`).toBe(0);
    expect(geometry.trimDimensionCount, `${context} trim is not a long wall dimension`).toBe(0);
    expect(geometry.swingDimensionCount, `${context} swing is not a linear dimension`).toBe(0);

    const updates = new Map([
      ["wallWidth", ["132", "132 in"]],
      ["ceilingHeight", ["101", "101 in"]]
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
  await expectIntegratedPreview(
    page.locator(".concept-preview"),
    "assets/photos/configurator/concept-cabinets-shelves-v1.png"
  );

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
  await expect(page.locator("[data-concept-scene]")).toHaveCSS("--preview-scale", "1.1");
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

test("all seventy product and room combinations render one exact full-room composite", async ({ page }) => {
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
      const measurementRoom = page.locator(`.measurement-room[data-layout="${layout.id}"] img.measurement-room-image`);
      await expect.poll(() => measurementRoom.evaluate((image) => (
        image.complete && image.naturalWidth > 0 ? image.currentSrc : ""
      ))).not.toBe("");
      await page.locator("[data-continue]").click();

      const preview = page.locator(".concept-preview");
      await expect(preview).toHaveAttribute("data-category", product.categoryId);
      await expect(preview).toHaveAttribute("data-style", product.styleId);
      await expect(preview).toHaveAttribute("data-layout", layout.id);
      await expect(preview).toHaveAttribute("data-preview-key", expected.previewKey);
      expect(expected.renderMode, `${product.id}/${layout.id} presentation mode`).toBe("integrated");
      expect(expected.conceptAsset, `${product.id}/${layout.id} presentation asset`).toBe(expectedAsset);
      await expectIntegratedPreview(preview, expectedAsset);

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
  await expect(page.locator("[data-dimension-chip]")).toHaveCount(2);
  expect(await page.locator("[data-dimension-chip]").evaluateAll((chips) => (
    chips.map((chip) => chip.dataset.dimensionChip)
  ))).toEqual(["wallWidth", "ceilingHeight"]);
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
