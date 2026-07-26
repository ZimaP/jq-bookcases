import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const routes = [
  "/index.html",
  "/configurator.html?start=new",
  "/how-it-works.html",
  "/materials.html",
  "/inspiration.html",
  "/about.html",
  "/faq.html",
  "/request-quote.html",
  "/privacy.html",
  "/terms.html"
];

const auditViewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "phone", width: 390, height: 844 }
];

function monitorPage(page) {
  const errors = [];
  const failedRequests = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("requestfailed", (request) => {
    failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText || "failed"}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.url()}`);
  });
  return { errors, failedRequests };
}

function formatViolations(violations) {
  return violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: violation.nodes.map((node) => ({ target: node.target, summary: node.failureSummary }))
  }));
}

test("every public route is stable, complete, and overflow-free at desktop and phone sizes", async ({ page }) => {
  const runtime = monitorPage(page);

  for (const viewport of auditViewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const route of routes) {
      runtime.errors.length = 0;
      runtime.failedRequests.length = 0;
      const response = await page.goto(route, { waitUntil: "networkidle" });
      expect(response?.status(), `${viewport.name} ${route} response`).toBeLessThan(400);
      await expect(page.locator("main#main")).toHaveCount(1);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("[data-site-header]")).toBeAttached();
      await expect(page.locator("[data-site-footer]")).toBeAttached();
      await expect(page.locator('.skip-link[href="#main"]')).toHaveCount(1);

      const integrity = await page.evaluate(async () => {
        const images = [...document.images];
        await Promise.all(images.map((image) => image.complete
          ? Promise.resolve()
          : new Promise((resolve) => {
              image.addEventListener("load", resolve, { once: true });
              image.addEventListener("error", resolve, { once: true });
            })));
        const ids = [...document.querySelectorAll("[id]")].map((element) => element.id);
        const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
        return {
          overflow: document.documentElement.scrollWidth - window.innerWidth,
          duplicateIds: [...new Set(duplicates)],
          brokenImages: images.filter((image) => !image.naturalWidth).map((image) => image.currentSrc || image.src),
          title: document.title,
          language: document.documentElement.lang
        };
      });

      expect(integrity.overflow, `${viewport.name} ${route} horizontal overflow`).toBeLessThanOrEqual(1);
      expect(integrity.duplicateIds, `${viewport.name} ${route} duplicate IDs`).toEqual([]);
      expect(integrity.brokenImages, `${viewport.name} ${route} broken images`).toEqual([]);
      expect(integrity.title, `${viewport.name} ${route} title`).toMatch(/JQ Bookcases/);
      expect(integrity.language).toBe("en");
      expect(runtime.errors, `${viewport.name} ${route} console`).toEqual([]);
      expect(runtime.failedRequests, `${viewport.name} ${route} network`).toEqual([]);
    }
  }
});

for (const route of routes) {
  test(`WCAG A/AA audit: ${route}`, async ({ page }) => {
    await page.goto(route, { waitUntil: "networkidle" });
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(formatViolations(results.violations)).toEqual([]);
  });
}

test("mobile navigation manages focus on both the site shell and guided configurator", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/faq.html", { waitUntil: "networkidle" });
  const toggle = page.locator(".nav-toggle");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#primary-navigation a").first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toBeFocused();

  await page.goto("/configurator.html?start=new", { waitUntil: "networkidle" });
  const guidedToggle = page.locator("[data-guided-menu-button]");
  await guidedToggle.click();
  await expect(guidedToggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#guided-menu a").first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(guidedToggle).toHaveAttribute("aria-expanded", "false");
  await expect(guidedToggle).toBeFocused();
});

test("FAQ filtering, empty state, accordion state, and deep links remain synchronized", async ({ page }) => {
  await page.goto("/faq.html", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Finishes" }).click();
  await expect(page.locator(".accordion-item:visible")).toHaveCount(1);
  await expect(page.locator("[data-faq-result-count]")).toHaveText("Showing 1 question");

  const search = page.getByRole("searchbox", { name: "Search frequently asked questions" });
  await search.fill("unmatched phrase");
  await expect(page.locator("[data-faq-empty]")).toBeVisible();
  await expect(page.locator("[data-faq-result-count]")).toHaveText("Showing 0 questions");

  await page.goto("/faq.html#faq-6", { waitUntil: "networkidle" });
  await expect(page.locator("#faq-6")).toBeVisible();
  await expect(page.locator('[aria-controls="faq-6"]')).toHaveAttribute("aria-expanded", "true");
});

test("public pages retain useful navigation when JavaScript is unavailable", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const route of routes) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    const navigation = page.getByRole("navigation", { name: "Primary navigation without JavaScript" });
    await expect(navigation).toBeVisible();
    expect(await navigation.locator("a").count(), route).toBeGreaterThanOrEqual(3);
  }
  await context.close();
});

test("the standalone quote preview validates data without pretending to transmit it", async ({ page }) => {
  await page.goto("/request-quote.html", { waitUntil: "networkidle" });
  await expect(page.locator("#quote-preview-notice")).toContainText("does not currently transmit");
  const projectFiles = page.locator("#quote-project-files");
  await expect(projectFiles).toBeEnabled();
  await projectFiles.setInputFiles({
    name: "project-wall.png",
    mimeType: "image/png",
    buffer: Buffer.from("local preview fixture")
  });
  await expect(page.locator("[data-upload-status]")).toHaveText("1 file selected");
  await page.getByRole("button", { name: "Prepare Project Brief" }).click();
  await expect(page.getByRole("textbox", { name: "Full Name" })).toBeFocused();
  await page.getByRole("textbox", { name: "Full Name" }).fill("QA Customer");
  await page.getByRole("textbox", { name: "Email Address" }).fill("qa@example.com");
  await page.getByRole("button", { name: "Prepare Project Brief" }).click();
  await expect(page.locator("[data-quote-status]")).toContainText("No personal information was transmitted");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("jqBookcasesQuoteDraft"))).toBeNull();
});

test("corrupted guided draft data recovers safely to a new project", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("jqGuidedConfiguratorDraftV1", "{ definitely not valid json");
  });
  const runtime = monitorPage(page);
  await page.goto("/configurator.html?start=resume", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Choose the layout that matches your space" })).toBeVisible();
  await expect(page.locator("[data-continue]")).toBeDisabled();
  await expect(page.locator("canvas, [data-3d-viewer]")).toHaveCount(0);
  expect(runtime.errors).toEqual([]);
  expect(runtime.failedRequests).toEqual([]);
});

test("selected choices expose a non-color state and visible keyboard focus", async ({ page }) => {
  await page.goto("/configurator.html?start=new", { waitUntil: "networkidle" });
  const card = page.getByRole("button", { name: "Clear Wall", exact: true });
  await card.click();
  const selectedCard = page.locator('[data-layout="clear-wall"]');
  await expect(selectedCard).toHaveAttribute("aria-pressed", "true");
  await expect(selectedCard.locator(".layout-selected-mark")).toHaveAccessibleName("Selected");
  await selectedCard.focus();
  await page.keyboard.press("Tab");
  const keyboardTarget = page.getByRole("button", { name: "Center Recess", exact: true });
  await expect(keyboardTarget).toBeFocused();
  const focus = await keyboardTarget.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
  });
  expect(focus.outlineStyle).not.toBe("none");
  expect(Number.parseFloat(focus.outlineWidth)).toBeGreaterThan(0);
});
