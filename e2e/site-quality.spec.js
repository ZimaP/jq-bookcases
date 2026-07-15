import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const routes = [
  "/index.html",
  "/configurator.html?start=welcome",
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
      await expect(page.locator("main")).toHaveCount(1);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator(".site-header")).toBeAttached();
      await expect(page.locator(".site-footer")).toBeAttached();
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

test("mobile navigation manages focus without hijacking unrelated Escape actions", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/faq.html", { waitUntil: "networkidle" });
  const toggle = page.locator(".nav-toggle");
  await expect(toggle).toHaveAccessibleName("Open navigation");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(toggle).toHaveAccessibleName("Close navigation");
  await expect(page.locator("#primary-navigation a").first()).toBeFocused();

  for (let index = 0; index < 10; index += 1) {
    await page.keyboard.press("Tab");
    const focusIsContained = await page.evaluate(() => document.querySelector(".site-header")?.contains(document.activeElement));
    expect(focusIsContained, `Tab ${index + 1} escaped the open mobile navigation`).toBe(true);
  }

  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toBeFocused();

  const search = page.getByRole("searchbox", { name: "Search frequently asked questions" });
  await search.fill("paint");
  await search.press("Escape");
  await expect(search).toHaveValue("");
  await expect(search).toBeFocused();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("body")).not.toHaveClass(/nav-open/);
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe("hidden");
});

test("mobile navigation actions remain readable on the dark menu surface", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/index.html", { waitUntil: "networkidle" });
  await page.locator(".nav-toggle").click();
  const contrast = await page.locator(".mobile-design-link").evaluate((element) => {
    const parse = (value) => value.match(/[\d.]+/g)?.slice(0, 3).map(Number) || [0, 0, 0];
    const luminance = (rgb) => {
      const channels = rgb.map((value) => {
        const channel = value / 255;
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const foreground = luminance(parse(getComputedStyle(element).color));
    const background = luminance([32, 27, 23]);
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
});

test("FAQ filtering, empty state, and accordion state remain synchronized", async ({ page }) => {
  await page.goto("/faq.html", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Finishes" }).click();
  await expect(page.locator(".accordion-item:visible")).toHaveCount(1);
  await expect(page.locator("[data-faq-result-count]")).toHaveText("Showing 1 question");

  const search = page.getByRole("searchbox", { name: "Search frequently asked questions" });
  await search.fill("unmatched phrase");
  await expect(page.locator("[data-faq-empty]")).toBeVisible();
  await expect(page.locator("[data-faq-result-count]")).toHaveText("Showing 0 questions");

  await search.fill("");
  await page.getByRole("button", { name: "All questions" }).click();
  const trigger = page.getByRole("button", { name: "How does the design process work?" });
  await trigger.press("Enter");
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#faq-2")).toBeVisible();
  await expect(page.locator('[aria-controls="faq-1"]')).toHaveAttribute("aria-expanded", "false");
});

test("FAQ deep links reveal the linked answer", async ({ page }) => {
  await page.goto("/faq.html#faq-6", { waitUntil: "networkidle" });
  await expect(page.locator("#faq-6")).toBeVisible();
  await expect(page.locator('[aria-controls="faq-6"]')).toHaveAttribute("aria-expanded", "true");
});

test("quote form cannot leak contact details through a no-JavaScript GET submission", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const route of routes) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("navigation", { name: "Primary navigation without JavaScript" })).toBeVisible();
    await expect(page.locator(".noscript-nav a")).toHaveCount(6);
  }
  await page.goto("/request-quote.html", { waitUntil: "domcontentloaded" });
  const previewNotice = page.locator("#quote-preview-notice");
  await expect(previewNotice).toContainText("does not currently transmit");
  await expect(previewNotice).toBeVisible();
  expect(await previewNotice.evaluate((element) => Boolean(element.closest("[inert]")))).toBe(false);
  await expect(page.locator("[data-quote-fields]")).toHaveAttribute("inert", "");
  await expect(page.locator("[data-quote-submit]")).toBeDisabled();
  await expect(page.locator("#quote-project-files")).toBeDisabled();
  await context.close();
});

test("quote form validates required data without retaining personal information", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage disabled", "SecurityError");
    };
  });
  await page.goto("/request-quote.html", { waitUntil: "networkidle" });
  const projectFiles = page.locator("#quote-project-files");
  await expect(projectFiles).toBeEnabled();
  await projectFiles.setInputFiles({
    name: "project-wall.png",
    mimeType: "image/png",
    buffer: Buffer.from("local preview fixture")
  });
  await expect(page.locator("[data-upload-status]")).toHaveText("1 file selected");
  await page.locator("[data-quote-finish]").selectOption("custom_bm");
  const customColor = page.getByRole("textbox", { name: "Benjamin Moore color name/code" });
  await expect(customColor).toBeVisible();
  await expect(customColor).toHaveAttribute("required", "");

  await page.getByRole("button", { name: "Prepare Project Brief" }).click();
  await expect(page.getByRole("textbox", { name: "Full Name" })).toBeFocused();
  await page.getByRole("textbox", { name: "Full Name" }).fill("QA Customer");
  await page.getByRole("textbox", { name: "Email Address" }).fill("qa@example.com");
  await customColor.fill("Hale Navy HC-154");
  await page.getByRole("button", { name: "Prepare Project Brief" }).click();
  await expect(page.locator("[data-quote-status]")).toContainText("No personal information was transmitted");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("jqBookcasesQuoteDraft"))).toBeNull();
});

test("unknown design IDs never fabricate a saved design or estimate", async ({ page }) => {
  await page.goto("/request-quote.html?design=BOGUS-DESIGN", { waitUntil: "networkidle" });
  await expect(page.locator("[data-saved-design-summary]")).toBeHidden();
  await expect(page.locator("[data-quote-status]")).toContainText("not available in this browser");
  await expect(page.locator('[name="designId"]')).toHaveValue("");
});

test("blocked local storage stops the quote handoff with recovery guidance", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage disabled", "SecurityError");
    };
  });
  await page.goto("/configurator.html?preset=lower-cabinets", { waitUntil: "networkidle" });
  await expect(page.locator("[data-3d-viewer]")).toHaveAttribute("data-render-valid", "true", { timeout: 20_000 });
  const navToggle = page.locator(".nav-toggle");
  await navToggle.click();
  await expect(page.locator("main")).toHaveAttribute("inert", "");
  await page.locator("#primary-navigation [data-header-request-quote]").click();
  await expect(page).toHaveURL(/configurator\.html\?preset=lower-cabinets$/);
  await expect(page.locator("[data-builder-status]")).toContainText("blocked local design storage");
  await expect(navToggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("body")).not.toHaveClass(/nav-open/);
  await expect(page.locator("main")).not.toHaveAttribute("inert", "");
  await expect(page.locator("#primary-navigation")).toHaveAttribute("inert", "");
});

test("configurator chrome stays separated at tablet and short-landscape breakpoints", async ({ page }) => {
  for (const viewport of [
    { width: 820, height: 1180, mode: "tablet-portrait" },
    { width: 844, height: 390, mode: "short-landscape" }
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/configurator.html?preset=classic-open", { waitUntil: "networkidle" });
    await expect(page.locator("[data-3d-viewer]")).toHaveAttribute("data-render-valid", "true", { timeout: 20_000 });

    const layout = await page.evaluate(() => {
      const rect = (element) => {
        const box = element.getBoundingClientRect();
        return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
      };
      const overlapArea = (first, second) => (
        Math.max(0, Math.min(first.right, second.right) - Math.max(first.left, second.left))
        * Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top))
      );
      const visibleButtons = [...document.querySelectorAll(".preview-control-dock button")]
        .filter((button) => button.getClientRects().length && getComputedStyle(button).visibility !== "hidden")
        .map(rect);
      const overlappingPairs = [];
      for (let first = 0; first < visibleButtons.length; first += 1) {
        for (let second = first + 1; second < visibleButtons.length; second += 1) {
          if (overlapArea(visibleButtons[first], visibleButtons[second]) > 1) overlappingPairs.push([first, second]);
        }
      }
      const background = getComputedStyle(document.querySelector(".site-header")).backgroundColor;
      const alpha = Number(background.match(/[\d.]+/g)?.[3] ?? 1);
      return {
        alpha,
        model: rect(document.querySelector(".configurator-model")),
        inspector: rect(document.querySelector("[data-unified-inspector]")),
        groups: [...document.querySelectorAll("[data-unified-inspector] [data-category-trigger]")].map(rect),
        visibleButtons,
        overlappingPairs,
        horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
        pageScrolls: document.documentElement.scrollHeight > innerHeight
      };
    });

    expect(layout.alpha, `${viewport.mode} header opacity`).toBeGreaterThanOrEqual(0.95);
    expect(layout.horizontalOverflow, `${viewport.mode} horizontal overflow`).toBeLessThanOrEqual(1);
    expect(layout.overlappingPairs, `${viewport.mode} overlapping viewer controls`).toEqual([]);

    if (viewport.mode === "short-landscape") {
      expect(layout.pageScrolls).toBe(true);
      for (const button of layout.visibleButtons) {
        expect(button.left).toBeGreaterThanOrEqual(layout.model.left);
        expect(button.right).toBeLessThanOrEqual(layout.model.right);
        expect(button.top).toBeGreaterThanOrEqual(layout.model.top);
        expect(button.bottom).toBeLessThanOrEqual(layout.model.bottom);
      }
      for (const group of layout.groups) {
        expect(group.left).toBeGreaterThanOrEqual(layout.inspector.left);
        expect(group.right).toBeLessThanOrEqual(layout.inspector.right + 1);
      }
    }
  }
});

test("corrupted saved configuration and malformed query data recover to the studio welcome", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("jqBookcasesDesign", "{ definitely not valid json");
  });
  const runtime = monitorPage(page);
  await page.goto("/configurator.html?preset=%E0%A4%A&design=%ZZ", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Start with your wall. Build it your way." })).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  expect(runtime.errors).toEqual([]);
  expect(runtime.failedRequests).toEqual([]);
});

test("selected option illustrations retain visible foreground contrast", async ({ page }) => {
  await page.goto("/configurator.html?preset=lower-cabinets", { waitUntil: "networkidle" });
  await expect(page.locator("[data-3d-viewer]")).toHaveAttribute("data-render-valid", "true", { timeout: 20_000 });
  await page.locator('[data-category-trigger="base_crown"]').click();
  await expect(page.locator('[data-category-panel="base_crown"]')).toBeVisible();

  const findings = await page.evaluate(() => {
    const parse = (value) => {
      const match = value.match(/[\d.]+/g)?.map(Number) || [];
      return match.length >= 3 ? match.slice(0, 3) : null;
    };
    const luminance = (rgb) => {
      const channels = rgb.map((value) => {
        const channel = value / 255;
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const ratio = (foreground, background) => {
      const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
      return (values[0] + 0.05) / (values[1] + 0.05);
    };

    const selectedOptions = new Set(document.querySelectorAll([
      ".style-choice:has(input:checked)",
      ".lighting-card:has(input:checked)",
      "input:checked + .option-card",
      '[aria-pressed="true"]'
    ].join(", ")));

    return [...selectedOptions]
      .filter((element) => element.querySelector("svg"))
      .map((element) => {
        const icon = element.querySelector(".style-diagram, .lighting-card-icon, svg");
        const style = getComputedStyle(element);
        const foregroundStyle = getComputedStyle(icon);
        const foreground = parse(foregroundStyle.color);
        const background = parse(style.backgroundColor);
        return {
          label: element.textContent.trim().replace(/\s+/g, " "),
          color: foregroundStyle.color,
          background: style.backgroundColor,
          contrast: foreground && background ? ratio(foreground, background) : 0
        };
      });
  });

  expect(findings.length).toBeGreaterThan(0);
  for (const finding of findings) expect(finding.contrast, JSON.stringify(finding)).toBeGreaterThanOrEqual(3);
});
