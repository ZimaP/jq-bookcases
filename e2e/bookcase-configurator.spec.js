import { test, expect } from "@playwright/test";
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
    ["projectionWidth", "D"],
    ["projectionHeight", "E"],
    ["projectionDepth", "F"]
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
  const layoutId = sharedLayouts.find((layout) => layout.label === label)?.id;
  if (!layoutId) throw new Error(`Unknown room layout: ${label}`);
  const card = page.locator(`[data-layout="${layoutId}"]`);
  await card.click();
  await expect(page.locator(`[data-layout="${layoutId}"]`)).toHaveAttribute("aria-pressed", "true");
}

async function expectAcceptedGeometryPreview(preview) {
  await expect(preview).toHaveAttribute("data-preview-render-mode", "accepted-geometry");
  await expect(preview).toHaveAttribute("data-finish-mask-mode", "none");
  await expect(preview).toHaveAttribute("data-accepted-specification", "true");
  await expect(preview).toHaveAttribute("data-geometry-fingerprint", /.+/);
  await expect(preview).toHaveAttribute("data-specification-fingerprint", /.+/);
  await expect(preview.locator(
    "picture.concept-photo, picture.concept-room-photo, img.concept-photo, img.concept-room-photo, img.concept-furniture-photo, svg.concept-finish-overlay"
  )).toHaveCount(0);
  await expect(preview.locator("[data-accepted-fit-summary]")).toBeVisible();

  const canvas = preview.locator('.guided-3d-canvas[data-rendered="true"]');
  await expect(canvas).toHaveCount(1);
  await expect(canvas).toHaveAttribute("data-geometry-fingerprint", /.+/);
  await expect(canvas).toHaveAttribute("data-specification-fingerprint", /.+/);
  await expect(canvas).toHaveAttribute("data-render-contract-valid", "true");
  return canvas;
}

async function expectNoHorizontalOverflow(page, selectors) {
  const report = await page.evaluate((targets) => ({
    viewportWidth: window.innerWidth,
    documentOverflow: document.documentElement.scrollWidth - window.innerWidth,
    elements: targets.map((selector) => {
      const element = document.querySelector(selector);
      if (!element) return { selector, missing: true };
      const rect = element.getBoundingClientRect();
      return {
        selector,
        missing: false,
        left: rect.left,
        right: rect.right
      };
    })
  }), selectors);

  expect(report.documentOverflow).toBeLessThanOrEqual(1);
  for (const element of report.elements) {
    expect(element.missing, element.selector).toBe(false);
    expect(element.left, `${element.selector} left`).toBeGreaterThanOrEqual(-1);
    expect(element.right, `${element.selector} right`).toBeLessThanOrEqual(report.viewportWidth + 1);
  }
}

async function expectOneScreenWorkspace(page, selectors, context) {
  const report = await page.evaluate((targets) => {
    const isRendered = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none"
        && style.visibility !== "hidden"
        && Number(style.opacity) > 0
        && rect.width > 0
        && rect.height > 0
      );
    };
    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
      verticalOverflow: document.documentElement.scrollHeight - window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      groups: targets.map((selector) => ({
        selector,
        elements: [...document.querySelectorAll(selector)]
          .filter(isRendered)
          .map((element, index) => {
            const rect = element.getBoundingClientRect();
            return {
              index,
              left: rect.left,
              right: rect.right,
              top: rect.top,
              bottom: rect.bottom,
              width: rect.width,
              height: rect.height
            };
          })
      }))
    };
  }, selectors);

  expect(report.horizontalOverflow, `${context} horizontal document overflow`).toBeLessThanOrEqual(1);
  expect(report.verticalOverflow, `${context} vertical document overflow`).toBeLessThanOrEqual(1);
  expect(report.scrollX, `${context} horizontal scroll position`).toBe(0);
  expect(report.scrollY, `${context} vertical scroll position`).toBe(0);
  for (const group of report.groups) {
    expect(group.elements.length, `${context} ${group.selector} rendered`).toBeGreaterThan(0);
    for (const element of group.elements) {
      const label = `${context} ${group.selector}[${element.index}]`;
      expect(element.left, `${label} left`).toBeGreaterThanOrEqual(-1);
      expect(element.right, `${label} right`).toBeLessThanOrEqual(report.viewportWidth + 1);
      expect(element.top, `${label} top`).toBeGreaterThanOrEqual(-1);
      expect(element.bottom, `${label} bottom`).toBeLessThanOrEqual(report.viewportHeight + 1);
    }
  }
  return report;
}

async function expectMeasurementWorkspaceInOneScreen(page, context) {
  const report = await expectOneScreenWorkspace(page, [
    ".guided-header",
    ".guided-stepper",
    ".guided-content-head",
    ".measurement-panel",
    ".measurement-panel [data-measurement-row]",
    ".measurement-panel [data-measurement]",
    ".guided-info",
    ".guided-actions",
    ".guided-actions .guided-button",
    ".measurement-diagram-card"
  ], context);

  const geometry = await page.evaluate(() => {
    const panelElement = document.querySelector(".measurement-panel");
    const rect = (selector) => document.querySelector(selector).getBoundingClientRect();
    const panel = panelElement.getBoundingClientRect();
    const information = rect(".guided-info");
    const actions = rect(".guided-actions");
    const diagram = rect(".measurement-diagram-card");
    const overlap = (first, second) => (
      first.left < second.right - 1
      && first.right > second.left + 1
      && first.top < second.bottom - 1
      && first.bottom > second.top + 1
    );
    return {
      panelBeforeInformation: panel.bottom <= information.top + 1,
      informationBeforeActions: information.bottom <= actions.top + 1,
      controlsClearDiagram: (
        !overlap(panel, diagram)
        && !overlap(information, diagram)
        && !overlap(actions, diagram)
      ),
      panelHasNoClippedOverflow: panelElement.scrollHeight <= panelElement.clientHeight + 1,
      fieldsInsidePanel: [
        ...panelElement.querySelectorAll("[data-measurement-row], .measurement-input-wrap")
      ].every((element) => {
        const elementRect = element.getBoundingClientRect();
        return (
          elementRect.left >= panel.left - 1
          && elementRect.right <= panel.right + 1
          && elementRect.top >= panel.top - 1
          && elementRect.bottom <= panel.bottom + 1
        );
      }),
      diagramRatio: diagram.width / diagram.height,
      buttonHeights: [...document.querySelectorAll(".guided-actions .guided-button")]
        .map((button) => button.getBoundingClientRect().height),
      controlHeights: [...document.querySelectorAll(
        '.measurement-panel input:not([type="radio"]), .measurement-panel select, .measurement-panel .measurement-toggle'
      )]
        .filter((control) => getComputedStyle(control).display !== "none")
        .map((control) => control.getBoundingClientRect().height)
    };
  });

  expect(geometry.panelBeforeInformation, `${context} panel precedes note`).toBe(true);
  expect(geometry.informationBeforeActions, `${context} note precedes actions`).toBe(true);
  expect(geometry.controlsClearDiagram, `${context} controls do not overlap diagram`).toBe(true);
  expect(geometry.panelHasNoClippedOverflow, `${context} panel has no clipped fields`).toBe(true);
  expect(geometry.fieldsInsidePanel, `${context} fields stay inside panel`).toBe(true);
  expect(geometry.diagramRatio, `${context} usable diagram ratio`).toBeGreaterThanOrEqual(1.25);
  expect(geometry.diagramRatio, `${context} usable diagram ratio`).toBeLessThanOrEqual(1.8);
  expect(Math.min(...geometry.buttonHeights), `${context} action target height`).toBeGreaterThanOrEqual(43);
  expect(Math.min(...geometry.controlHeights), `${context} measurement control height`).toBeGreaterThanOrEqual(35);
  return report;
}

async function expectCustomizationWorkspaceInOneScreen(page, context) {
  return expectOneScreenWorkspace(page, [
    ".guided-header",
    ".guided-stepper",
    ".guided-content-head",
    ".customization-panel",
    ".customization-actions",
    ".customization-actions .guided-button",
    ".concept-preview",
    ".concept-preview-meta",
    ".concept-scene",
    ".preview-controls"
  ], context);
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

test("public route presents the accepted-geometry five-step configurator", async ({ page }) => {
  const runtime = monitorRuntime(page);
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
  expect(runtime).toEqual([]);
});

test("Step 1 product cards use one edge-to-edge 13:10 media format without changing room-card fitting", async ({ page }) => {
  for (const viewport of [
    { name: "desktop", width: 1280, height: 720 },
    { name: "iPad landscape", width: 1024, height: 768 },
    { name: "phone", width: 390, height: 844 }
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
        && getComputedStyle(image).objectFit === "cover"
      )))).toBe(true);

      const geometry = await page.locator("[data-product-choice]").evaluateAll((cards) => cards.map((card) => {
        const cardRect = card.getBoundingClientRect();
        const mediaRect = card.querySelector(".product-card-image").getBoundingClientRect();
        const copyRect = card.querySelector(".product-card-copy").getBoundingClientRect();
        const image = card.querySelector("img");
        const imageRect = image.getBoundingClientRect();
        const scale = Math.max(
          mediaRect.width / image.naturalWidth,
          mediaRect.height / image.naturalHeight
        );
        return {
          cardWidth: cardRect.width,
          cardHeight: cardRect.height,
          mediaWidth: mediaRect.width,
          mediaHeight: mediaRect.height,
          copyHeight: copyRect.height,
          imageEdges: {
            left: Math.abs(imageRect.left - mediaRect.left),
            top: Math.abs(imageRect.top - mediaRect.top),
            right: Math.abs(imageRect.right - mediaRect.right),
            bottom: Math.abs(imageRect.bottom - mediaRect.bottom)
          },
          paintedWidth: image.naturalWidth * scale,
          paintedHeight: image.naturalHeight * scale,
          objectPosition: getComputedStyle(image).objectPosition
        };
      }));

      const spread = (values) => Math.max(...values) - Math.min(...values);
      expect(spread(geometry.map(({ cardWidth }) => cardWidth))).toBeLessThanOrEqual(1);
      expect(spread(geometry.map(({ cardHeight }) => cardHeight))).toBeLessThanOrEqual(1);
      expect(spread(geometry.map(({ mediaWidth }) => mediaWidth))).toBeLessThanOrEqual(1);
      expect(spread(geometry.map(({ mediaHeight }) => mediaHeight))).toBeLessThanOrEqual(1);
      expect(spread(geometry.map(({ copyHeight }) => copyHeight))).toBeLessThanOrEqual(1);
      expect(geometry.every(({
        cardWidth,
        cardHeight,
        mediaWidth,
        mediaHeight,
        imageEdges,
        paintedWidth,
        paintedHeight
      }) => (
        cardWidth > 0
        && cardHeight > 0
        && Math.abs(mediaWidth / mediaHeight - 1.3) <= 0.01
        && Math.abs(mediaWidth - cardWidth) <= 2
        && mediaHeight > 0
        && mediaHeight < cardHeight
        && Object.values(imageEdges).every((edge) => edge <= 1)
        && paintedWidth >= mediaWidth - 1
        && paintedHeight >= mediaHeight - 1
      ))).toBe(true);
      expect(geometry.map(({ objectPosition }) => objectPosition)).toEqual([
        "50% 25%",
        "50% 50%",
        "50% 50%",
        "50% 50%",
        "50% 50%",
        "50% 50%",
        "50% 50%"
      ]);
      expect(await page.evaluate(() => (
        document.documentElement.scrollWidth - window.innerWidth
      ))).toBeLessThanOrEqual(1);
    });
  }

  await continueToLayouts(page);
  const layoutImages = page.locator(".layout-grid .layout-illustration img");
  await expect(layoutImages).toHaveCount(sharedLayouts.length);
  await expect.poll(() => layoutImages.evaluateAll((images) => (
    images.every((image) => getComputedStyle(image).objectFit === "cover")
  ))).toBe(true);
});

test("Step 2 room cards use one consistent edge-to-edge media format without selected-state shifts", async ({ page }) => {
  const readGeometry = () => page.locator("[data-layout]").evaluateAll((cards) => cards.map((card) => {
    const cardRect = card.getBoundingClientRect();
    const mediaRect = card.querySelector(".layout-illustration").getBoundingClientRect();
    const image = card.querySelector("img");
    const imageRect = image.getBoundingClientRect();
    const scale = Math.max(
      mediaRect.width / image.naturalWidth,
      mediaRect.height / image.naturalHeight
    );
    return {
      id: card.dataset.layout,
      offsetLeft: card.offsetLeft,
      offsetTop: card.offsetTop,
      cardWidth: cardRect.width,
      cardHeight: cardRect.height,
      mediaWidth: mediaRect.width,
      mediaHeight: mediaRect.height,
      imageEdges: {
        left: Math.abs(imageRect.left - mediaRect.left),
        top: Math.abs(imageRect.top - mediaRect.top),
        right: Math.abs(imageRect.right - mediaRect.right),
        bottom: Math.abs(imageRect.bottom - mediaRect.bottom)
      },
      objectFit: getComputedStyle(image).objectFit,
      sourceAspectRatio: image.naturalWidth / image.naturalHeight,
      visibleWidthFraction: mediaRect.width / (image.naturalWidth * scale),
      visibleHeightFraction: mediaRect.height / (image.naturalHeight * scale)
    };
  }));

  for (const viewport of [
    { name: "desktop", width: 1280, height: 720 },
    { name: "iPad landscape", width: 1024, height: 768 }
  ]) {
    await test.step(viewport.name, async () => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openFreshProject(page);
      await continueToLayouts(page);

      const cards = page.locator("[data-layout]");
      const images = cards.locator(".layout-illustration img");
      await expect(cards).toHaveCount(sharedLayouts.length);
      await expect.poll(() => images.evaluateAll((elements) => elements.every((image) => (
        image.complete
        && image.naturalWidth > 0
        && image.naturalHeight > 0
      )))).toBe(true);

      const beforeSelection = await readGeometry();
      const spread = (values) => Math.max(...values) - Math.min(...values);
      expect(beforeSelection.map(({ id }) => id)).toEqual(sharedLayouts.map(({ id }) => id));
      expect(spread(beforeSelection.map(({ cardWidth }) => cardWidth))).toBeLessThanOrEqual(1);
      expect(spread(beforeSelection.map(({ cardHeight }) => cardHeight))).toBeLessThanOrEqual(1);
      expect(spread(beforeSelection.map(({ mediaWidth }) => mediaWidth))).toBeLessThanOrEqual(1);
      expect(spread(beforeSelection.map(({ mediaHeight }) => mediaHeight))).toBeLessThanOrEqual(1);
      expect(beforeSelection.every(({
        mediaWidth,
        mediaHeight,
        imageEdges,
        objectFit,
        sourceAspectRatio,
        visibleWidthFraction,
        visibleHeightFraction
      }) => (
        mediaWidth / mediaHeight >= 1
        && mediaWidth / mediaHeight <= 1.65
        && Object.values(imageEdges).every((edge) => edge <= 1)
        && objectFit === "cover"
        // Four legacy room references are square while the responsive card is
        // landscape. Preserve at least 60% of square references and 90% of
        // authored landscape references without allowing letterboxing.
        && visibleWidthFraction >= (sourceAspectRatio <= 1.05 ? 0.6 : 0.9)
        && visibleHeightFraction >= (sourceAspectRatio <= 1.05 ? 0.6 : 0.9)
      ))).toBe(true);
      expect(await page.evaluate(() => (
        document.documentElement.scrollWidth - window.innerWidth
      ))).toBeLessThanOrEqual(1);

      const selectedCard = page.locator('[data-layout="double-opening"]');
      await selectedCard.focus();
      await selectedCard.press("Space");
      await expect(selectedCard).toHaveAttribute("aria-pressed", "true");
      await expect(selectedCard).toHaveCSS("border-left-width", "1px");
      await expect(selectedCard).toHaveCSS("border-right-width", "1px");

      const afterSelection = await readGeometry();
      for (const cardBefore of beforeSelection) {
        const cardAfter = afterSelection.find(({ id }) => id === cardBefore.id);
        for (const property of [
          "offsetLeft",
          "offsetTop",
          "cardWidth",
          "cardHeight",
          "mediaWidth",
          "mediaHeight"
        ]) {
          expect(Math.abs(cardAfter[property] - cardBefore[property])).toBeLessThanOrEqual(1);
        }
      }
    });
  }
});

test("Step 1 centers the three-card bottom row without selected-state geometry shifts", async ({ page }) => {
  const readLayout = () => page.evaluate(() => {
    const grid = document.querySelector(".guided-shell--step-1 .product-grid--catalog");
    const gridRect = grid.getBoundingClientRect();
    const cards = [...grid.querySelectorAll("[data-product-choice]")].map((card) => {
      const rect = card.getBoundingClientRect();
      return {
        id: card.dataset.productChoice,
        left: rect.left - gridRect.left,
        right: rect.right - gridRect.left,
        top: rect.top - gridRect.top,
        width: rect.width,
        height: rect.height
      };
    });
    return {
      gridWidth: gridRect.width,
      columnGap: parseFloat(getComputedStyle(grid).columnGap),
      cards
    };
  });

  for (const viewport of [
    { name: "desktop", width: 1280, height: 720 },
    { name: "iPad landscape", width: 1024, height: 768 }
  ]) {
    await test.step(viewport.name, async () => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openFreshProject(page);

      const beforeSelection = await readLayout();
      const topRow = beforeSelection.cards.slice(0, 4);
      const bottomRow = beforeSelection.cards.slice(4);
      const spread = (values) => Math.max(...values) - Math.min(...values);
      const gaps = (cards) => cards.slice(1).map((card, index) => (
        card.left - cards[index].right
      ));

      expect(topRow.map(({ id }) => id)).toEqual([
        "cabinet-shelves",
        "drawer-shelves",
        "open-shelving",
        "tv-unit"
      ]);
      expect(bottomRow.map(({ id }) => id)).toEqual([
        "floating-storage",
        "window-storage",
        "radiator-cover"
      ]);
      expect(spread(topRow.map(({ top }) => top))).toBeLessThanOrEqual(1);
      expect(spread(bottomRow.map(({ top }) => top))).toBeLessThanOrEqual(1);
      expect(spread(beforeSelection.cards.map(({ width }) => width))).toBeLessThanOrEqual(1);
      expect(spread(beforeSelection.cards.map(({ height }) => height))).toBeLessThanOrEqual(1);
      expect(topRow[0].left).toBeLessThanOrEqual(1);
      expect(Math.abs(topRow[3].right - beforeSelection.gridWidth)).toBeLessThanOrEqual(1);
      for (const gap of gaps(topRow)) {
        expect(Math.abs(gap - beforeSelection.columnGap)).toBeLessThanOrEqual(1);
      }
      for (const gap of gaps(bottomRow)) {
        expect(Math.abs(gap - beforeSelection.columnGap)).toBeLessThanOrEqual(1);
      }
      expect(Math.abs(bottomRow[0].left - (
        beforeSelection.gridWidth - bottomRow[2].right
      ))).toBeLessThanOrEqual(1);

      const radiator = page.locator('[data-product-choice="radiator-cover"]');
      await radiator.focus();
      await radiator.press("Space");
      await expect(radiator).toHaveAttribute("aria-pressed", "true");
      await expect(radiator).toHaveClass(/is-selected/);
      await expect(radiator).toHaveCSS("border-left-width", "1px");
      await expect(radiator).toHaveCSS("border-right-width", "1px");

      const afterSelection = await readLayout();
      for (const cardBefore of beforeSelection.cards) {
        const cardAfter = afterSelection.cards.find(({ id }) => id === cardBefore.id);
        for (const property of ["left", "right", "top", "width", "height"]) {
          expect(Math.abs(cardAfter[property] - cardBefore[property])).toBeLessThanOrEqual(1);
        }
      }
    });
  }
});

test("wide desktop keeps all seven product cards equal and horizontally contained", async ({ page }) => {
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
  expect(geometry.verticalOverflow).toBeGreaterThanOrEqual(0);
  expect(geometry.widthSpread).toBeLessThanOrEqual(2);
  expect(geometry.rowTops).toHaveLength(2);
  for (const [index, card] of geometry.cards.entries()) {
    const label = `product card ${index + 1}`;
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
  await page.locator("[data-continue]").scrollIntoViewIfNeeded();
  await expect(page.locator("[data-continue]")).toBeVisible();
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
    "radiatorBelowWindow"
  ]) {
    await expect(page.locator('[data-measurement-row="' + fieldId + '"]')).toBeVisible();
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

  await width.fill("190");
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Refine your concept" })).toBeVisible();
  await expectAcceptedGeometryPreview(page.locator(".concept-preview"));
  await page.locator("[data-back]").click();
  await expect(width).toHaveValue("190");

  await width.fill("121 1/2");

  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Refine your concept" })).toBeVisible();
  await expectAcceptedGeometryPreview(page.locator(".concept-preview"));
  await page.locator("[data-back]").click();
  await expect(width).toHaveValue("121.5");

  await width.fill("");
  await expect(width).toHaveValue("");
  await page.locator("[data-continue]").click();
  await expect(page.locator("[data-measurement-error]")).toContainText("approximate wall width");
  await expect(width).toBeFocused();
});

test("one accepted 3D scene persists and separates geometry rebuilds from material updates", async ({ page }) => {
  const obsoleteSceneRequests = [];
  page.on("request", (request) => {
    if (/\/assets\/photos\/configurator\/(?:integrated|furniture)\//.test(request.url()) || /-finish-mask-/.test(request.url())) {
      obsoleteSceneRequests.push(request.url());
    }
  });

  await openFreshProject(page);
  await continueToLayouts(page, "TV Unit");
  await chooseLayout(page, "Right Niche");
  await page.locator("[data-continue]").click();
  await page.locator('[data-measurement="wallWidth"]').fill("144");
  await page.locator('[data-measurement="nicheWidth"]').fill("120");

  const measurementCanvas = page.locator('.measurement-room[data-guided3d-state="ready"] .guided-3d-canvas');
  await expect(measurementCanvas).toHaveCount(1);
  await expect(measurementCanvas).toHaveAttribute("data-rendered", "true");
  await expect(measurementCanvas).toHaveAttribute("data-scene-layout", "right-niche");
  await expect(measurementCanvas).toHaveAttribute("data-show-product", "false");
  await expect(measurementCanvas).toHaveAttribute("data-show-dimensions", "true");
  await expect(measurementCanvas).toHaveAttribute("data-geometry-fingerprint", /.+/);
  const instanceId = await measurementCanvas.getAttribute("data-guided3d-instance");
  const initialGeometryFingerprint = await measurementCanvas.getAttribute("data-geometry-fingerprint");

  await page.locator('[data-measurement="wallWidth"]').fill("126");
  await page.locator('[data-measurement="rightReturn"]').fill("6");
  await expect.poll(() => measurementCanvas.getAttribute("data-geometry-fingerprint"))
    .not.toBe(initialGeometryFingerprint);

  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Refine your concept" })).toBeVisible();
  const preview = page.locator(".concept-preview");
  const customizationCanvas = await expectAcceptedGeometryPreview(preview);
  await expect(customizationCanvas).toHaveAttribute("data-guided3d-instance", instanceId);
  await expect(customizationCanvas).toHaveAttribute("data-show-product", "true");
  await expect(customizationCanvas).toHaveAttribute("data-show-dimensions", "false");
  await expect(page.locator(".guided-3d-canvas")).toHaveCount(1);

  const geometryFingerprint = await customizationCanvas.getAttribute("data-geometry-fingerprint");
  const geometryRebuildCount = Number(await customizationCanvas.getAttribute("data-geometry-rebuild-count"));
  const materialUpdateCount = Number(await customizationCanvas.getAttribute("data-material-update-count"));
  const specificationFingerprint = await customizationCanvas.getAttribute("data-specification-fingerprint");

  await page.getByRole("button", { name: "Dark Walnut", exact: true }).click();
  await expect.poll(async () => Number(await customizationCanvas.getAttribute("data-material-update-count")))
    .toBeGreaterThan(materialUpdateCount);
  await expect(customizationCanvas).toHaveAttribute("data-geometry-fingerprint", geometryFingerprint);
  await expect(customizationCanvas).toHaveAttribute("data-geometry-rebuild-count", String(geometryRebuildCount));
  await expect(customizationCanvas).not.toHaveAttribute("data-specification-fingerprint", specificationFingerprint);
  await expect(page.locator(".guided-3d-canvas")).toHaveCount(1);

  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Review your custom concept" })).toBeVisible();
  const reviewCanvas = await expectAcceptedGeometryPreview(page.locator(".concept-preview"));
  await expect(reviewCanvas).toHaveAttribute("data-guided3d-instance", instanceId);
  await expect(reviewCanvas).toHaveAttribute("data-geometry-fingerprint", geometryFingerprint);
  await expect(page.locator(".guided-3d-canvas")).toHaveCount(1);
  expect(obsoleteSceneRequests).toEqual([]);
});

test("the exact TV01 Natural Oak Review uses the versioned photoreal preview without changing Step 4", async ({ page }) => {
  const previewResponses = [];
  page.on("response", (response) => {
    if (response.url().endsWith("/tv01-clear-wall-photoreal-preview-v1.webp")) {
      previewResponses.push(response.status());
    }
  });

  await openFreshProject(page);
  await continueToLayouts(page, "TV Unit");
  await chooseLayout(page, "Clear Wall");
  await page.locator("[data-continue]").click();
  await page.locator("[data-continue]").click();

  const customizationPreview = page.locator(".concept-preview");
  await expectAcceptedGeometryPreview(customizationPreview);
  await expect(customizationPreview).toHaveAttribute("data-finish", "natural-oak");
  await page.getByRole("tab", { name: "Details" }).click();
  await page.locator('[data-detail-key="hardware"][data-detail="black-pull"]').click();
  await expect(page.locator(".guided-3d-canvas")).toHaveCount(1);
  await page.locator("[data-continue]").click();

  await expect(page.getByRole("heading", { name: "Review your custom concept" })).toBeVisible();
  const reviewPreview = page.locator(
    '[data-customer-preview-id="tv01-clear-wall-photoreal-preview-v1"]'
  );
  await expect(reviewPreview).toHaveCount(1);
  await expect(reviewPreview).toHaveAttribute("data-preview-render-mode", "published-photoreal");
  await expect(reviewPreview).toHaveAttribute("data-customer-preview-capture", "photoreal-beauty-v1");
  await expect(reviewPreview).toHaveAttribute(
    "data-geometry-fingerprint",
    "jq-guided-geometry-v1-028YPJG43EJF6"
  );
  await expect(reviewPreview).toHaveAttribute(
    "data-specification-fingerprint",
    "jq-guided-spec-v1-0qpej5s"
  );
  await expect(reviewPreview.locator("canvas")).toHaveCount(0);
  await expect(reviewPreview.locator(".guided-3d-mount")).toHaveCount(0);
  await expect(reviewPreview.locator(".preview-controls")).toHaveCount(0);

  const image = reviewPreview.locator(".published-customer-preview-image");
  await expect(image).toHaveCount(1);
  await expect(image).toHaveAttribute(
    "src",
    "assets/photos/configurator/integrated/tv-unit/framed-tv-wall/tv01-clear-wall-photoreal-preview-v1.webp"
  );
  await expect(image).toHaveAttribute("width", "1920");
  await expect(image).toHaveAttribute("height", "1280");
  await expect.poll(() => image.evaluate((node) => ({
    complete: node.complete,
    width: node.naturalWidth,
    height: node.naturalHeight
  }))).toEqual({ complete: true, width: 1920, height: 1280 });

  const mediaGeometry = await reviewPreview.evaluate((preview) => {
    const frame = preview.querySelector(".concept-scene-frame").getBoundingClientRect();
    const imageRect = preview.querySelector(".published-customer-preview-image").getBoundingClientRect();
    const imageStyle = getComputedStyle(preview.querySelector(".published-customer-preview-image"));
    return {
      frameRatio: frame.width / frame.height,
      widthDelta: Math.abs(frame.width - imageRect.width),
      heightDelta: Math.abs(frame.height - imageRect.height),
      objectFit: imageStyle.objectFit,
      documentOverflow: document.documentElement.scrollWidth - window.innerWidth
    };
  });
  expect(Math.abs(mediaGeometry.frameRatio - 1.5)).toBeLessThan(0.01);
  expect(mediaGeometry.widthDelta).toBeLessThanOrEqual(1);
  expect(mediaGeometry.heightDelta).toBeLessThanOrEqual(1);
  expect(mediaGeometry.objectFit).toBe("contain");
  expect(mediaGeometry.documentOverflow).toBeLessThanOrEqual(1);
  expect(previewResponses).toContain(200);

  const summary = page.locator(".project-summary-card");
  await expect(summary).toContainText("Natural Oak");
  await expect(summary).toContainText("Black Pull");
  await expect(summary).toContainText("$15,050");

  await page.getByRole("button", { name: "Customization, completed" }).click();
  await expect(page.getByRole("heading", { name: "Refine your concept" })).toBeVisible();
  await expectAcceptedGeometryPreview(page.locator(".concept-preview"));
  await expect(page.locator("[data-customer-preview-id]")).toHaveCount(0);
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

      const geometry = await room.evaluate((element, expectedCount) => {
        const tolerance = 1;
        const roomRect = element.getBoundingClientRect();
        const drawingElement = element.querySelector("[data-dimension-drawing]");
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
          finiteArchitecturalViewBox: (() => {
            const viewBox = drawingElement.viewBox.baseVal;
            return Number.isFinite(viewBox.width)
              && Number.isFinite(viewBox.height)
              && viewBox.width > 0
              && viewBox.height > 0;
          })(),
          responsiveTransform: drawingElement.getAttribute("preserveAspectRatio") === "xMidYMid slice",
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
      expect(geometry.finiteArchitecturalViewBox, `${context} SVG keeps a finite authored viewBox`).toBe(true);
      expect(geometry.responsiveTransform, `${context} SVG keeps one responsive transform`).toBe(true);
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
  const stepOneOverflow = await page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth - window.innerWidth,
    vertical: document.documentElement.scrollHeight - window.innerHeight
  }));
  expect(stepOneOverflow.horizontal).toBeLessThanOrEqual(1);
  expect(stepOneOverflow.vertical).toBeLessThanOrEqual(1);

  await page.locator("[data-continue]").click();
  const stepTwoOverflow = await page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth - window.innerWidth,
    vertical: document.documentElement.scrollHeight - window.innerHeight
  }));
  expect(stepTwoOverflow.horizontal).toBeLessThanOrEqual(1);
  expect(stepTwoOverflow.vertical).toBeLessThanOrEqual(1);
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
    images.every((image) => image.complete && image.naturalWidth > 0)
  ))).toBe(true);

  await chooseLayout(page, "Clear Wall");
  await page.locator("[data-continue]").click();
  await expectMeasurementWorkspaceInOneScreen(page, "1280x720 Clear Wall Room & Size");

  await page.locator("[data-continue]").click();
  await expectOneScreenWorkspace(page, [
    ".customization-panel",
    ".concept-preview",
    ".customization-actions"
  ], "1280x720 Clear Wall Customization");
  await expectAcceptedGeometryPreview(page.locator(".concept-preview"));

  for (const tab of ["Details", "Finish"]) {
    await page.getByRole("tab", { name: tab }).click();
    await expectOneScreenWorkspace(page, [
      ".customization-panel",
      ".concept-preview",
      ".customization-actions"
    ], "1280x720 Clear Wall " + tab + " tab");
    await expect(page.locator(".guided-3d-canvas")).toHaveCount(1);
  }
});

test("product, finish, compatibility, accepted geometry, and review summary stay synchronized", async ({ page }) => {
  await openFreshProject(page);
  await continueToLayouts(page);
  await chooseLayout(page, "Clear Wall");
  await page.locator("[data-continue]").click();
  await page.locator('[data-measurement="wallWidth"]').fill("132.25");
  await page.locator("[data-continue]").click();

  const customizationPreview = page.locator(".concept-preview");
  await expect(customizationPreview).toHaveAttribute("data-style", "cabinet-base-shelves");
  const canvas = await expectAcceptedGeometryPreview(customizationPreview);
  const geometryFingerprint = await canvas.getAttribute("data-geometry-fingerprint");
  const geometryRebuildCount = await canvas.getAttribute("data-geometry-rebuild-count");
  const materialUpdateCount = Number(await canvas.getAttribute("data-material-update-count"));

  await page.getByRole("tab", { name: "Finish" }).click();
  await page.getByRole("button", { name: "Charcoal", exact: true }).click();
  await expect(customizationPreview).toHaveAttribute("data-finish", "charcoal");
  await expect(customizationPreview).toHaveAttribute("data-finish-family", "paint");
  await expect(customizationPreview.locator(".concept-finish-caption")).toContainText("Charcoal");
  await expect.poll(async () => Number(await canvas.getAttribute("data-material-update-count")))
    .toBeGreaterThan(materialUpdateCount);
  await expect(canvas).toHaveAttribute("data-geometry-fingerprint", geometryFingerprint);
  await expect(canvas).toHaveAttribute("data-geometry-rebuild-count", geometryRebuildCount);
  await expect(customizationPreview.locator("svg.concept-finish-overlay")).toHaveCount(0);

  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page.locator("[data-concept-scene]")).toHaveCSS("--preview-scale", "1");
  await expect(page.locator(".guided-3d-canvas")).toHaveAttribute("data-rendered", "true");
  await page.getByRole("button", { name: "Reset preview" }).click();

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
  await expect(summary).toContainText(geometryFingerprint);
  await expectAcceptedGeometryPreview(page.locator(".concept-preview"));
  await page.getByRole("button", { name: "Edit project notes" }).click();
  await page.getByLabel("Notes for our design team").fill("Keep the original picture rail.");
  await page.getByRole("button", { name: "Save Notes" }).click();
  await expect(summary.locator('[data-summary-value="notes"]')).toHaveText("Keep the original picture rail.");
});

test("Clear Wall freestanding selection commits a distinct fractional accepted fit", async ({ page }) => {
  await openFreshProject(page);
  await continueToLayouts(page);
  await chooseLayout(page, "Clear Wall");
  await page.locator("[data-continue]").click();
  await page.locator('[data-measurement="wallWidth"]').fill("120");
  await page.locator('[data-measurement="ceilingHeight"]').fill("96");
  await page.locator('[data-measurement="desiredDepth"]').fill("14.25");
  await page.locator("[data-continue]").click();

  const canvas = await expectAcceptedGeometryPreview(page.locator(".concept-preview"));
  const fittedGeometry = await canvas.getAttribute("data-geometry-fingerprint");
  const fittedSpecification = await canvas.getAttribute("data-specification-fingerprint");
  await expect(page.locator("[data-accepted-fit-summary]")).toContainText("117 × 96 × 14 1/4 in");

  await page.getByRole("tab", { name: "Details" }).click();
  const freestandingChoice = page.locator(
    '[data-detail-key="baseStyle"][data-detail="furniture-base"]'
  );
  await freestandingChoice.click();
  await expect(freestandingChoice).toHaveAttribute("aria-pressed", "true");
  await expect(canvas).not.toHaveAttribute("data-geometry-fingerprint", fittedGeometry);
  await expect(canvas).not.toHaveAttribute("data-specification-fingerprint", fittedSpecification);
  await expect(page.locator("[data-accepted-fit-summary]")).toContainText(
    "119 × 95 1/2 × 14 1/4 in"
  );
  await expect(page.locator("[data-guided-engine-status]")).not.toContainText(
    "Last accepted design preserved"
  );

  const freestandingGeometry = await canvas.getAttribute("data-geometry-fingerprint");
  await page.locator("[data-continue]").click();
  await expect(page.locator(".project-summary-card")).toContainText("Freestanding · No fillers");
  await expect(page.locator(".project-summary-card")).toContainText(freestandingGeometry);
  const reviewCanvas = await expectAcceptedGeometryPreview(page.locator(".concept-preview"));
  await expect(reviewCanvas).toHaveAttribute("data-geometry-fingerprint", freestandingGeometry);
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

test("a rejected edit cannot overwrite the last accepted saved project or drift after reload", async ({ page }) => {
  await openFreshProject(page);
  await continueToLayouts(page);
  await chooseLayout(page, "Clear Wall");
  await page.locator("[data-continue]").click();
  await page.locator('[data-measurement="wallWidth"]').fill("132");
  await page.locator("[data-continue]").click();

  const acceptedCanvas = await expectAcceptedGeometryPreview(page.locator(".concept-preview"));
  const acceptedGeometryFingerprint = await acceptedCanvas.getAttribute("data-geometry-fingerprint");
  const acceptedSpecificationFingerprint = await acceptedCanvas.getAttribute("data-specification-fingerprint");

  await page.getByRole("button", { name: "Save Project", exact: true }).click();
  const saveDialog = page.locator("[data-save-dialog]");
  await saveDialog.getByLabel("Project name").fill("Atomic Library");
  await saveDialog.getByRole("button", { name: "Save Project", exact: true }).click();
  await expect(page.locator("[data-guided-toast]")).toContainText("was saved on this device");

  await page.locator("[data-back]").click();
  await expect(page.getByRole("heading", { name: "Tell us about your space" })).toBeVisible();
  await page.locator('[data-measurement="wallWidth"]').fill("-1");
  await page.waitForTimeout(350);

  await page.getByRole("button", { name: "Save Project", exact: true }).click();
  await expect(saveDialog).not.toBeVisible();
  await expect(page.locator("[data-guided-toast]")).toContainText("GUIDED_SAVE_REJECTED_CANDIDATE");
  await expect(page.getByRole("button", { name: "Save Project", exact: true }))
    .toHaveAttribute("data-persistence-state", "rejected-candidate");

  const storedBeforeReload = await page.evaluate(() => ({
    draft: JSON.parse(localStorage.getItem("jqGuidedConfiguratorDraftV1")),
    projects: JSON.parse(localStorage.getItem("jqGuidedConfiguratorProjectsV1"))
  }));
  expect(storedBeforeReload.draft.measurements.wallWidth).toBe(132);
  expect(storedBeforeReload.projects[0].measurements.wallWidth).toBe(132);
  expect(storedBeforeReload.projects[0].acceptedSnapshot.geometryFingerprint)
    .toBe(acceptedGeometryFingerprint);
  expect(storedBeforeReload.projects[0].acceptedSnapshot.specificationFingerprint)
    .toBe(acceptedSpecificationFingerprint);

  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator('[data-measurement="wallWidth"]')).toHaveValue("132");
  await page.locator("[data-continue]").click();
  const reloadedCanvas = await expectAcceptedGeometryPreview(page.locator(".concept-preview"));
  await expect(reloadedCanvas).toHaveAttribute("data-geometry-fingerprint", acceptedGeometryFingerprint);
  await expect(reloadedCanvas).toHaveAttribute("data-specification-fingerprint", acceptedSpecificationFingerprint);
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

test("one complete accepted-geometry flow works for every product category", async ({ page }) => {
  const compatibleLayout = {
    "window-storage": "Window Wall",
    "radiator-cover": "Window Wall"
  };
  for (const product of products) {
    const layout = compatibleLayout[product.id] || "Clear Wall";
    await openFreshProject(page);
    await continueToReview(page, layout, product.label);
    await expect(page.locator(".project-summary-card")).toContainText(product.label);
    await expect(page.locator(".project-summary-card")).toContainText(layout);
    await expectAcceptedGeometryPreview(page.locator(".concept-preview"));
  }
});

test("representative topology branches preserve generated product identity through review and reload", async ({ page }) => {
  const runtime = monitorRuntime(page);
  const cases = [
    { product: "Cabinets + Shelves", style: "cabinet-base-shelves", layout: "Fireplace Wall", layoutId: "fireplace-wall" },
    { product: "Drawers + Shelves", style: "drawer-base-shelves", layout: "Door Wall", layoutId: "door-wall" },
    { product: "Full Open Shelving", style: "full-open-shelving", layout: "Between Openings", layoutId: "double-opening" },
    {
      product: "TV Unit",
      style: "framed-tv-wall",
      layout: "Right Niche",
      layoutId: "right-niche",
      measurements: { wallWidth: "144", nicheWidth: "120" }
    },
    { product: "Floating Storage", style: "floating-drawer-bank", layout: "Corner Wall", layoutId: "corner-wall" },
    { product: "Window Storage", style: "window-seat-storage", layout: "Window Wall", layoutId: "window-wall" },
    { product: "Radiator Cover", style: "clean-slat-cover", layout: "Window Wall", layoutId: "window-wall" }
  ];

  for (const entry of cases) {
    await openFreshProject(page);
    await continueToLayouts(page, entry.product);
    await chooseLayout(page, entry.layout);
    await page.locator("[data-continue]").click();
    await expect(page.getByRole("heading", { name: "Tell us about your space" })).toBeVisible();
    for (const [fieldId, value] of Object.entries(entry.measurements || {})) {
      await page.locator(`[data-measurement="${fieldId}"]`).fill(value);
    }
    await page.locator("[data-continue]").click();

    const preview = page.locator(".concept-preview");
    await expect(preview).toHaveAttribute("data-layout", entry.layoutId);
    await expect(preview).toHaveAttribute("data-style", entry.style);
    const canvas = await expectAcceptedGeometryPreview(preview);
    const geometryFingerprint = await canvas.getAttribute("data-geometry-fingerprint");
    await expect(preview.locator("[data-layout-context]")).toHaveAttribute("data-layout-context", entry.layoutId);

    await page.locator("[data-continue]").click();
    const summary = page.locator(".project-summary-card");
    await expect(summary).toContainText(entry.product);
    await expect(summary).toContainText(entry.layout);
    await expect(summary).toContainText(geometryFingerprint);
    await expectAcceptedGeometryPreview(page.locator(".concept-preview"));

    await page.waitForTimeout(300);
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Review your custom concept" })).toBeVisible();
    const restored = await expectAcceptedGeometryPreview(page.locator(".concept-preview"));
    await expect(restored).toHaveAttribute("data-geometry-fingerprint", geometryFingerprint);
  }

  expect(runtime).toEqual([]);
});

test("renderer failure is visible and fail-closed without substituting a concept image", async ({ page }) => {
  const obsoleteSceneRequests = [];
  page.on("request", (request) => {
    if (/\/assets\/photos\/configurator\/(?:integrated|furniture)\//.test(request.url()) || /-finish-mask-/.test(request.url())) {
      obsoleteSceneRequests.push(request.url());
    }
  });
  await page.route("**/guided-configurator-3d.js*", (route) => route.fulfill({
    contentType: "text/javascript",
    body: 'export function createGuidedSceneController() { throw new Error("WebGL unavailable in fail-closed test"); }'
  }));

  await openFreshProject(page);
  await continueToLayouts(page, "TV Unit");
  await chooseLayout(page, "Clear Wall");
  await page.locator("[data-continue]").click();
  await page.locator("[data-continue]").click();

  const preview = page.locator(".concept-preview");
  const scene = preview.locator('.concept-scene[data-guided3d-state="fallback"]');
  await expect(scene).toBeVisible();
  await expect(preview).toHaveAttribute("data-preview-render-mode", "accepted-geometry");
  await expect(preview).toHaveAttribute("data-accepted-specification", "true");
  await expect(scene.locator("[data-guided-engine-status] strong")).toHaveText("3D preview unavailable");
  await expect(scene.locator("[data-guided-engine-status]")).toContainText(
    "failed closed; no unrelated product or room image was substituted"
  );
  await expect(preview.locator(
    "picture.concept-photo, picture.concept-room-photo, img.concept-photo, img.concept-room-photo, img.concept-furniture-photo, svg.concept-finish-overlay"
  )).toHaveCount(0);
  await expect(preview.locator("canvas")).toHaveCount(0);

  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Review your custom concept" })).toBeVisible();
  await expect(page.locator('.concept-scene[data-guided3d-state="fallback"]')).toBeVisible();
  await expect(page.locator(".concept-preview").locator(
    "picture.concept-photo, img.concept-photo, svg.concept-finish-overlay"
  )).toHaveCount(0);
  expect(obsoleteSceneRequests).toEqual([]);
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
  await expectNoHorizontalOverflow(page, [
    ".measurement-panel",
    ".measurement-diagram-card",
    ".guided-info",
    ".guided-actions"
  ]);
  await page.screenshot({ path: "test-results/guided-configurator-phone.png", fullPage: true });
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Refine your concept" })).toBeVisible();
  await expectNoHorizontalOverflow(page, [
    ".customization-panel",
    ".concept-preview",
    ".customization-actions"
  ]);

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
