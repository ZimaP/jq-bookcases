import { test, expect } from "@playwright/test";

const products = [
  { id: "bookcase", label: "Bookcase", style: "cabinet-base-shelves" },
  { id: "tv-unit", label: "TV Unit", style: "framed-tv-wall" },
  { id: "floating-storage", label: "Floating Storage", style: "floating-drawer-bank" },
  { id: "window-storage", label: "Window Storage", style: "window-seat-storage" },
  { id: "radiator-cover", label: "Radiator Cover", style: "clean-slat-cover" }
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
  await expect(page.getByRole("heading", { name: "Choose your bookcase design" })).toBeVisible();
  await expect(page).toHaveURL(/configurator\.html#step-1$/);
}

async function chooseProduct(page, label = "Bookcase") {
  const product = products.find((candidate) => candidate.label === label);
  if (!product) throw new Error(`Unknown product: ${label}`);
  const category = page.locator(`[data-category="${product.id}"]`);
  if (await category.getAttribute("aria-pressed") !== "true") {
    await category.click();
  }
  const card = page.locator(`[data-product-style="${product.style}"]`);
  await card.click();
  await expect(card).toHaveAttribute("aria-pressed", "true");
}

async function continueToLayouts(page, product = "Bookcase") {
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

async function continueToReview(page, layout = "Clear Wall", product = "Bookcase") {
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
  await expect(page.locator("[data-category]")).toHaveCount(5);
  await expect(page.locator("[data-product-style]")).toHaveCount(3);
  await expect(page.locator("[data-product-style] .product-card-title")).toHaveText([
    "Cabinets + Shelves",
    "Drawers + Shelves",
    "Full Open Shelving"
  ]);
  await expect(page.locator(".product-card-reference")).toHaveText(["Drawing 7", "Drawings 5–6", "Drawings 1–2"]);
  await expect(page.locator("[data-product-style] picture source[type='image/avif']")).toHaveCount(3);
  await expect.poll(() => page.locator("[data-product-style] img").evaluateAll((images) => (
    images.every((image) => image.complete && image.naturalWidth > 0 && image.currentSrc.endsWith(".avif"))
  ))).toBe(true);
  await expect(page.locator("canvas, [data-3d-viewer], model-viewer")).toHaveCount(0);
  expect(requests.some((path) => /configurator-3d|three\.module|cabinet-ar|direct-hardware/i.test(path))).toBe(false);
  expect(runtime).toEqual([]);
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

  for (const label of [
    "Wall Width (A)",
    "Ceiling Height (B)",
    "Desired Depth (C)",
    "Left Return",
    "Right Return",
    "Window Width",
    "Window Height",
    "Sill Height",
    "Radiator Below Window"
  ]) {
    await expect(page.getByLabel(label)).toBeVisible();
  }

  const width = page.getByLabel("Wall width");
  await width.fill("121 1/2");
  await expect(page.locator('[data-dimension-chip="wallWidth"]')).toContainText("121 1/2 in");
  await width.fill("190");
  await expect(page.locator('[data-measurement-row="wallWidth"] .measurement-warning')).toContainText("outside our usual");
  const optionalWindowWidth = page.getByLabel("Window width");
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

  await width.selectText();
  await width.press("Backspace");
  await expect(width).toHaveValue("");
  await page.locator("[data-continue]").click();
  await expect(page.locator("[data-measurement-error]")).toContainText("approximate wall width");
  await expect(width).toBeFocused();
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
  await expect(diagonal).toContainText("TV diagonal");
  await expect(height).toContainText("TV height");
  await expect(diagram.locator(".measurement-annotation-label")).toHaveText(["A", "B", "C", "TV diagonal", "TV height"]);

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
    const overlaps = (first, second) => (
      first.left < second.right
      && first.right > second.left
      && first.top < second.bottom
      && first.bottom > second.top
    );
    return {
      tvCenterDelta: Math.abs(tvRect.centerX - (diagramRect.left + diagramRect.width / 2)),
      calloutsOverlap: overlaps(diagonalRect, heightRect),
      diagonalBeforeTv: diagonalRect.right < tvRect.left,
      heightAfterTv: heightRect.left > tvRect.right,
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
  expect(geometry.diagonalBeforeTv).toBe(true);
  expect(geometry.heightAfterTv).toBe(true);
  expect(geometry.allInsideDiagram).toBe(true);
});

test("landscape tablet keeps Steps 1–4 and every navigation action in one screen", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openFreshProject(page);
  await chooseProduct(page);
  await expectOneScreenFit(page, [
    ".guided-header",
    ".guided-stepper",
    ".guided-category-nav",
    ".product-grid",
    ".guided-info",
    ".guided-actions"
  ]);

  await page.locator("[data-continue]").click();
  await expectOneScreenFit(page, [
    ".guided-category-nav",
    ".selected-product-banner",
    ".layout-grid",
    ".guided-info",
    ".guided-actions"
  ]);
  const layoutRows = await page.locator("[data-layout]").evaluateAll((cards) => (
    [...new Set(cards.map((card) => Math.round(card.getBoundingClientRect().top)))]
  ));
  expect(layoutRows).toHaveLength(2);

  await chooseLayout(page, "Clear Wall");
  await page.locator("[data-continue]").click();
  await expectOneScreenFit(page, [
    ".guided-category-nav",
    ".measurement-panel",
    ".measurement-diagram-card",
    ".guided-info",
    ".guided-actions"
  ]);

  await page.locator("[data-continue]").click();
  await expectOneScreenFit(page, [
    ".guided-category-nav",
    ".customization-panel",
    ".concept-preview",
    ".customization-actions"
  ]);
  await expect(page.locator("img.concept-photo")).toHaveCSS("object-fit", "contain");

  for (const tab of ["Details", "Design", "Finish"]) {
    await page.getByRole("tab", { name: tab }).click();
    const contentFit = await page.locator(".customization-content").evaluate((element) => ({
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight
    }));
    expect(contentFit.scrollHeight, `${tab} tab`).toBeLessThanOrEqual(contentFit.clientHeight + 1);
    await expectOneScreenFit(page, [".customization-panel", ".concept-preview", ".customization-actions"]);
  }
});

test("style, finish, compatibility, preview, and review summary stay synchronized", async ({ page }) => {
  await openFreshProject(page);
  await continueToLayouts(page);
  await chooseLayout(page, "Clear Wall");
  await page.locator("[data-continue]").click();
  await page.getByLabel("Wall width").fill("132.25");
  await page.locator("[data-continue]").click();

  await page.getByRole("tab", { name: "Design" }).click();
  await expect.poll(() => page.locator(".style-thumb img").evaluateAll((images) => (
    images.length === 3
      && images.every((image) => image.complete && image.naturalWidth > 0 && image.currentSrc.endsWith(".avif"))
  ))).toBe(true);
  await page.locator('button[data-style="drawer-base-shelves"]').click();
  await expect(page.locator(".concept-preview")).toHaveAttribute(
    "data-preview-asset",
    "assets/photos/configurator/concept-drawers-shelves-v1.png"
  );
  await page.locator('button[data-style="cabinet-base-shelves"]').click();
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
  await page.getByLabel("Wall width").fill("137 3/8");
  await page.getByLabel("Fireplace opening width").fill("45.5");
  await page.waitForTimeout(300);
  await page.reload({ waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "Tell us about your space" })).toBeVisible();
  await expect(page.getByLabel("Wall width")).toHaveValue("137.38");
  await expect(page.getByLabel("Fireplace opening width")).toHaveValue("45.5");
  await page.goBack();
  await expect(page.getByRole("button", { name: /Fireplace Wall/ })).toHaveAttribute("aria-pressed", "true");
  await page.goForward();
  await expect(page.getByLabel("Fireplace opening width")).toHaveValue("45.5");
});

test("inspiration presets apply once and then restore edits after refresh", async ({ page }) => {
  await page.goto("/configurator.html?preset=media-wall", { waitUntil: "networkidle" });
  await expect(page.locator('[data-category="tv-unit"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-product-style="library-media"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/configurator\.html#step-1$/);
  await page.locator("[data-continue]").click();
  await expect(page.locator('button[data-layout="clear-wall"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator("[data-continue]").click();
  await page.getByLabel("Wall width").fill("129.5");
  await page.waitForTimeout(250);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Tell us about your space" })).toBeVisible();
  await expect(page.getByLabel("Wall width")).toHaveValue("129.5");
  await expect(page.getByLabel("TV screen size (diagonal)")).toBeVisible();
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
  const firstProduct = page.locator('[data-product-style="cabinet-base-shelves"]');
  await firstProduct.focus();
  await firstProduct.press("Space");
  await expect(firstProduct).toHaveAttribute("aria-pressed", "true");
  await page.locator("[data-continue]").click();

  const firstLayout = page.getByRole("button", { name: "Niche Layout", exact: true });
  await firstLayout.focus();
  await firstLayout.press("Enter");
  await expect(page.locator('button[data-layout="niche-layout"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator("[data-continue]").click();
  await page.locator("[data-continue]").click();

  const styleTab = page.getByRole("tab", { name: "Design" });
  await styleTab.focus();
  await styleTab.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Finish" })).toHaveAttribute("aria-selected", "true");
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

  const productTargets = await page.locator("[data-product-style]").evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().height));
  expect(Math.min(...productTargets)).toBeGreaterThanOrEqual(44);
  await expect(page.locator(".guided-step-label--mobile")).toHaveText(["Product", "Layout", "Size", "Finish", "Review"]);
  await continueToLayouts(page, "Radiator Cover");
  const categoryNavigation = await page.evaluate(() => {
    const navigation = document.querySelector(".guided-category-nav");
    const selected = navigation.querySelector(".guided-category.is-selected");
    const navigationRect = navigation.getBoundingClientRect();
    const selectedRect = selected.getBoundingClientRect();
    const labelsFit = [...navigation.querySelectorAll(".guided-category > span:last-child")]
      .every((label) => label.scrollWidth <= label.clientWidth + 1);
    return {
      centeredDelta: Math.abs(
        (selectedRect.left + selectedRect.width / 2)
        - (navigationRect.left + navigationRect.width / 2)
      ),
      labelsFit
    };
  });
  expect(categoryNavigation.centeredDelta).toBeLessThanOrEqual(2);
  expect(categoryNavigation.labelsFit).toBe(true);
  await expect(page.locator(".layout-grid")).toHaveCSS("grid-template-columns", /.+ .+/);
  const cardTargets = await page.locator("[data-layout]").evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().height));
  expect(Math.min(...cardTargets)).toBeGreaterThanOrEqual(44);
  await chooseLayout(page, "Window Wall");
  await page.locator("[data-continue]").click();
  await expect(page.locator("[data-dimension-chip]")).toHaveCount(5);
  expect(await page.locator("[data-dimension-chip]").evaluateAll((chips) => (
    chips.map((chip) => chip.dataset.dimensionChip)
  ))).toEqual(["wallWidth", "ceilingHeight", "desiredDepth", "windowWidth", "windowHeight"]);
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
