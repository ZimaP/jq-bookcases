import { test, expect } from "@playwright/test";
import { PUBLISHED_CUSTOMER_PREVIEWS } from "../guided-published-preview-data.js";

const publicRoutes = [
  "index.html",
  "configurator.html?start=new",
  "how-it-works.html",
  "materials.html",
  "inspiration.html",
  "about.html",
  "faq.html",
  "request-quote.html",
  "privacy.html",
  "terms.html"
];
const INTERNAL_PUBLISHED_PREVIEW_AUDIT_STORAGE_KEY = "jqInternalPublishedPreviewAuditV1";

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
    if (response.status() >= 400) failures.push(`response: ${response.status()} ${response.url()}`);
  });
  return failures;
}

async function enableInternalPublishedPreviewAudit(page) {
  await page.addInitScript((storageKey) => {
    if (["http:", "https:"].includes(window.location.protocol)) {
      window.sessionStorage.setItem(storageKey, "enabled");
    }
  }, INTERNAL_PUBLISHED_PREVIEW_AUDIT_STORAGE_KEY);
}

function publishedPreviewFor(productId, layoutId) {
  const preview = PUBLISHED_CUSTOMER_PREVIEWS.find((candidate) => (
    candidate.key?.productId === productId
    && candidate.key?.layoutId === layoutId
    && !candidate.finishOverrideId
  ));
  if (!preview) throw new Error(`Missing published preview: ${productId}:${layoutId}`);
  return preview;
}

async function expectPublishedSmokePreview(page, expectedPreview, expectedSource = expectedPreview.asset) {
  const preview = page.locator(
    `.concept-preview[data-customer-preview-id="${expectedPreview.previewId}"]`
  );
  await expect(preview).toHaveAttribute("data-preview-render-mode", "published-photoreal");
  await expect(preview).toHaveAttribute("data-layout", expectedPreview.key.layoutId);
  await expect(preview.locator(".concept-finish-caption small")).toHaveText("Photoreal preview");
  await expect(preview.locator("canvas, .guided-3d-mount, .preview-controls")).toHaveCount(0);
  const image = preview.locator("[data-published-preview-image]");
  await expect(image).toHaveAttribute("src", expectedSource);
  await expect.poll(() => image.evaluate((node, expectedDimensions) => (
    node.complete
    && node.naturalWidth === expectedDimensions.width
    && node.naturalHeight === expectedDimensions.height
  ), {
    width: expectedPreview.width,
    height: expectedPreview.height
  })).toBe(true);
  return { preview, image };
}

async function forcePublishedPreviewLoadFailure(page) {
  let interceptedRequestCount = 0;
  const publishedAssets = PUBLISHED_CUSTOMER_PREVIEWS
    .map((preview) => preview.asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  await page.route(
    new RegExp(`/(?:${publishedAssets})(?:\\?.*)?$`),
    (route) => {
      interceptedRequestCount += 1;
      return route.fulfill({
        status: 200,
        contentType: "image/webp",
        body: "not-a-decodable-webp"
      });
    }
  );
  return () => interceptedRequestCount;
}

async function expectAcceptedSmokePreview(page) {
  const preview = page.locator(".concept-preview");
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
  await expect(canvas).toHaveAttribute("data-render-contract-valid", "true");
  await expect(canvas).toHaveAttribute("data-geometry-fingerprint", /.+/);
  await expect(canvas).toHaveAttribute("data-specification-fingerprint", /.+/);
  return canvas;
}

test("public routes render without runtime, network, or responsive overflow failures", async ({ page }) => {
  const failures = monitorRuntime(page);
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const route of publicRoutes) {
      failures.length = 0;
      const response = await page.goto(route, { waitUntil: "networkidle" });
      expect(response?.status()).toBeLessThan(400);
      await expect(page.locator("main#main")).toHaveCount(1);
      await expect(page.locator("h1")).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      expect(failures, `${viewport.width}x${viewport.height} ${route}`).toEqual([]);
    }
  }
});

test("the internal matrix audit path preserves published-preview coverage", async ({ page }) => {
  const failures = monitorRuntime(page);
  const rightPreview = publishedPreviewFor("tv-unit", "right-niche");
  const leftPreview = publishedPreviewFor("tv-unit", "left-niche");
  await enableInternalPublishedPreviewAudit(page);
  await page.goto("configurator.html?start=new", { waitUntil: "networkidle" });
  await page.locator('[data-product-choice="tv-unit"]').click();
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Choose the room condition that matches your space" })).toBeVisible();
  await page.locator('[data-layout="right-niche"]').click();
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Tell us about your space" })).toBeVisible();
  const rightStepThree = await expectPublishedSmokePreview(page, rightPreview);
  const rightSource = await rightStepThree.image.getAttribute("src");
  await page.getByLabel("Wall width").fill("132");
  await page.getByLabel("Ceiling height").fill("108");
  await page.getByLabel("Niche width").fill("108");
  await page.getByLabel("Niche height").fill("108");
  await page.getByLabel("Niche depth").fill("14");
  await page.getByLabel("Right return").fill("24");
  await page.locator('[data-measurement="tvScreenSize"]').fill("55");
  await page.locator('[data-measurement="tvHeight"]').fill("28");
  await page.locator('[data-measurement="soundbarRequired"]').selectOption("no");
  await expectPublishedSmokePreview(page, rightPreview, rightSource);
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Refine your concept" })).toBeVisible();
  const rightCustomization = await expectPublishedSmokePreview(page, rightPreview, rightSource);
  const smallTvGeometryFingerprint = await rightCustomization.preview.getAttribute("data-geometry-fingerprint");
  expect(smallTvGeometryFingerprint).toMatch(/.+/);
  await page.getByRole("tab", { name: "Finish" }).click();
  await page.getByRole("button", { name: "Dark Walnut", exact: true }).click();
  const updatedFinish = await expectPublishedSmokePreview(page, rightPreview, rightSource);
  await expect(updatedFinish.preview).toHaveAttribute("data-geometry-fingerprint", smallTvGeometryFingerprint);

  await page.locator("[data-back]").click();
  await expect(page.getByRole("heading", { name: "Tell us about your space" })).toBeVisible();
  await expectPublishedSmokePreview(page, rightPreview, rightSource);
  await page.locator('[data-measurement="tvScreenSize"]').fill("50");
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Refine your concept" })).toBeVisible();
  const changedTv = await expectPublishedSmokePreview(page, rightPreview, rightSource);
  const changedTvGeometryFingerprint = await changedTv.preview.getAttribute("data-geometry-fingerprint");
  expect(changedTvGeometryFingerprint).not.toBe(smallTvGeometryFingerprint);

  await page.locator("[data-back]").click();
  await expect(page.getByRole("heading", { name: "Tell us about your space" })).toBeVisible();
  await page.locator("[data-back]").click();
  await expect(page.getByRole("heading", { name: "Choose the room condition that matches your space" })).toBeVisible();
  await page.locator('[data-layout="left-niche"]').click();
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Tell us about your space" })).toBeVisible();
  const leftStepThree = await expectPublishedSmokePreview(page, leftPreview);
  const leftSource = await leftStepThree.image.getAttribute("src");
  expect(leftSource).not.toBe(rightSource);
  await page.getByLabel("Wall width").fill("132");
  await page.getByLabel("Ceiling height").fill("108");
  await page.getByLabel("Niche width").fill("108");
  await page.getByLabel("Niche height").fill("108");
  await page.getByLabel("Niche depth").fill("14");
  await page.getByLabel("Left return").fill("24");
  await page.locator('[data-measurement="tvScreenSize"]').fill("55");
  await page.locator('[data-measurement="tvHeight"]').fill("28");
  await page.locator('[data-measurement="soundbarRequired"]').selectOption("no");
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Refine your concept" })).toBeVisible();
  const mirroredPreview = await expectPublishedSmokePreview(page, leftPreview, leftSource);
  const geometryFingerprint = await mirroredPreview.preview.getAttribute("data-geometry-fingerprint");
  await page.locator("[data-continue]").click();

  const summary = page.locator(".project-summary-card");
  await expect(summary).toContainText("TV Unit");
  await expect(summary).toContainText("Left Niche");
  await expect(summary).toContainText("132 in");
  await expect(summary).toContainText("Accepted TV body");
  await expect(summary).toContainText("Generated TV opening");
  await expect(summary).toContainText("Dark Walnut");
  await expect(summary).toContainText(geometryFingerprint);
  const reviewPreview = await expectPublishedSmokePreview(page, leftPreview, leftSource);
  await expect(reviewPreview.preview).toHaveAttribute("data-geometry-fingerprint", geometryFingerprint);

  await expect.poll(() => page.evaluate(() => {
    const draft = JSON.parse(localStorage.getItem("jqGuidedConfiguratorDraftV1") || "null");
    return {
      currentStep: draft?.currentStep,
      layout: draft?.layout,
      geometryFingerprint: draft?.acceptedSnapshot?.geometryFingerprint
    };
  })).toEqual({ currentStep: 5, layout: "left-niche", geometryFingerprint });
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Review your custom concept" })).toBeVisible();
  await expect(page.locator(".project-summary-card")).toContainText("132 in");
  const reloadedPreview = await expectPublishedSmokePreview(page, leftPreview, leftSource);
  await expect(reloadedPreview.preview).toHaveAttribute("data-geometry-fingerprint", geometryFingerprint);
  expect(failures).toEqual([]);
});

test("a real published-image decode failure falls back to one persistent technical canvas", async ({ page }) => {
  const failures = monitorRuntime(page);
  const interceptedPublishedPreviewCount = await forcePublishedPreviewLoadFailure(page);
  await page.setViewportSize({ width: 1024, height: 768 });
  await enableInternalPublishedPreviewAudit(page);
  await page.goto("configurator.html?start=new", { waitUntil: "networkidle" });
  await page.locator('[data-product-choice="open-shelving"]').click();
  await page.locator("[data-continue]").click();
  await page.locator('[data-layout="clear-wall"]').click();
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Tell us about your space" })).toBeVisible();

  const measurementCanvas = page.locator(
    '.measurement-room[data-guided3d-state="ready"] .guided-3d-canvas[data-rendered="true"]'
  );
  await expect(measurementCanvas).toHaveCount(1);
  await expect(measurementCanvas).toHaveAttribute("data-show-product", "false");
  await expect(measurementCanvas).toHaveAttribute("data-show-dimensions", "true");
  await expect(measurementCanvas).toHaveAttribute("data-guided3d-instance", /.+/);
  expect(interceptedPublishedPreviewCount()).toBeGreaterThan(0);
  const instanceId = await measurementCanvas.getAttribute("data-guided3d-instance");

  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Refine your concept" })).toBeVisible();

  const canvas = await expectAcceptedSmokePreview(page);
  await expect(canvas).toHaveAttribute("data-guided3d-instance", instanceId);
  const geometryFingerprint = await canvas.getAttribute("data-geometry-fingerprint");
  const geometryRebuildCount = await canvas.getAttribute("data-geometry-rebuild-count");
  const materialUpdateCount = Number(await canvas.getAttribute("data-material-update-count"));

  await page.getByRole("button", { name: "Charcoal", exact: true }).click();
  await expect.poll(async () => Number(await canvas.getAttribute("data-material-update-count")))
    .toBeGreaterThan(materialUpdateCount);
  await expect(canvas).toHaveAttribute("data-guided3d-instance", instanceId);
  await expect(canvas).toHaveAttribute("data-geometry-fingerprint", geometryFingerprint);
  await expect(canvas).toHaveAttribute("data-geometry-rebuild-count", geometryRebuildCount);
  await expect(page.locator(".guided-3d-canvas")).toHaveCount(1);

  await page.locator("[data-continue]").click();
  await expect(page.locator(".project-summary-card")).toContainText("Clear Wall");
  await expect(page.locator(".project-summary-card")).toContainText("Charcoal");
  await expect(page.locator(".project-summary-card")).toContainText(geometryFingerprint);
  const reviewCanvas = await expectAcceptedSmokePreview(page);
  await expect(reviewCanvas).toHaveAttribute("data-guided3d-instance", instanceId);

  await expect.poll(() => page.evaluate(() => (
    JSON.parse(localStorage.getItem("jqGuidedConfiguratorDraftV1") || "null")?.currentStep
  ))).toBe(5);
  await page.reload({ waitUntil: "networkidle" });
  const reloadedCanvas = await expectAcceptedSmokePreview(page);
  await expect(reloadedCanvas).toHaveAttribute("data-geometry-fingerprint", geometryFingerprint);
  expect(failures).toEqual([]);
});
