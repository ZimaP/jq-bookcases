import { createHash } from "node:crypto";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { FIELDS, LAYOUTS, PENDING_ITEMS, STEPS, V4_PROOF } from "../tools/configurator-authority-v4/authority-contract.js";

const QUERY = "authorityProof=configurator-v4&renderer=webgl2&diagnostic=proof-light";
const FOUR_STEP_LABELS = ["Choose Product", "Choose Layout", "Customization", "Review & Details"];

function monitorFailures(page) {
  const failures = [];
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") failures.push(`console: ${message.text()}`); });
  page.on("requestfailed", (request) => failures.push(`request: ${request.url()} ${request.failure()?.errorText || "failed"}`));
  page.on("response", (response) => { if (response.status() >= 400) failures.push(`response: ${response.status()} ${response.url()}`); });
  return failures;
}

async function expectNoSeriousAxeViolations(page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(results.violations.filter(({ impact }) => ["critical", "serious"].includes(impact))).toEqual([]);
}

async function waitForCustomization(page) {
  await expect(page.locator("[data-v4-customization]")).toBeVisible();
  await expect(page.locator("[data-v4-viewer-state][data-state=ready]")).toBeVisible();
  await expect(page.locator("[data-v4-viewer] canvas")).toBeVisible();
}

async function openFreshProof(page) {
  await page.goto(`configurator.html?start=new&${QUERY}#step-1`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Choose your product" })).toBeVisible();
}

async function selectProductAndLayout(page, layoutId = "fireplace-wall") {
  await page.locator('[data-product-choice="cabinet-shelves"]').click();
  await page.locator("[data-continue]").click();
  await expect(page.getByRole("heading", { name: "Choose the layout that matches your space" })).toBeVisible();
  await page.locator(`[data-layout="${layoutId}"]`).click();
  await page.locator("[data-continue]").click();
  await waitForCustomization(page);
}

async function viewerDiagnostics(page) {
  return page.evaluate(() => window.__JQ_CONFIGURATOR_V4__?.getViewerDiagnostics?.() || window.__JQ_CONFIGURATOR_V4_DIAGNOSTICS__ || null);
}

function screenshotHash(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("jq-v4-four-step-test-initialized") === "1") return;
    localStorage.clear();
    sessionStorage.setItem("jq-v4-four-step-test-initialized", "1");
  });
});

test("production-style route remains baseline-only without the proof flag", async ({ page }) => {
  const failures = monitorFailures(page);
  const requests = [];
  page.on("request", (request) => requests.push(new URL(request.url()).pathname));
  await page.goto("configurator.html?start=new&renderer=webgl2#step-1", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Choose your product" })).toBeVisible();
  await expect(page.locator("[data-v4-customization]")).toHaveCount(0);
  await expect(page.locator("link[href*='configurator-authority-v4/v4.css']")).toHaveCount(0);
  expect(requests.some((pathname) => pathname.includes("/tools/configurator-authority-v4/"))).toBe(false);
  expect(await page.evaluate(() => window.__JQ_CONFIGURATOR_V4__)).toBeUndefined();
  expect(failures).toEqual([]);
});

test("four accepted step indicators, exact labels, aria-current and retired hash routing are restored", async ({ page }) => {
  const failures = monitorFailures(page);
  await openFreshProof(page);
  const stepper = page.getByRole("navigation", { name: "Project steps" });
  await expect(stepper.getByRole("button")).toHaveCount(4);
  await expect(stepper.getByRole("button")).toHaveText(FOUR_STEP_LABELS.map((label, index) => new RegExp(`${index + 1}[\\s\\S]*${label}`)));
  await expect(stepper.getByRole("button").nth(0)).toHaveAttribute("aria-current", "step");
  await selectProductAndLayout(page, "fireplace-wall");
  await expect(stepper.getByRole("button").nth(2)).toHaveAttribute("aria-current", "step");
  await page.locator("[data-v4-review]").click();
  await expect(page.getByRole("heading", { name: "Review your project details" })).toBeVisible();
  await expect(stepper.getByRole("button").nth(3)).toHaveAttribute("aria-current", "step");
  await page.waitForTimeout(350);
  await page.goto(`configurator.html?${QUERY}#step-5`, { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(new RegExp(`\\?${QUERY.replace(/[?&]/g, "\\$&")}#step-4$`));
  await expect(page.getByRole("heading", { name: "Review your project details" })).toBeVisible();
  await expect(stepper.getByRole("button")).toHaveCount(4);
  await stepper.getByRole("button", { name: /Choose Layout/ }).focus();
  await expect(stepper.getByRole("button", { name: /Choose Layout/ })).toBeFocused();
  expect(failures).toEqual([]);
});

test("direct accepted four-step routes, keyboard step navigation and proof query preservation work", async ({ page }) => {
  const failures = monitorFailures(page);
  await openFreshProof(page);
  await selectProductAndLayout(page, "window-wall");
  await page.locator("[data-v4-review]").click();
  await expect(page.getByRole("heading", { name: "Review your project details" })).toBeVisible();
  const expected = new Map([
    [4, "Review your project details"],
    [3, "Customization"],
    [2, "Choose the layout that matches your space"],
    [1, "Choose your product"]
  ]);
  for (const [step, heading] of expected) {
    await page.goto(`configurator.html?${QUERY}#step-${step}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(page.locator(`[data-step="${step}"]`)).toHaveAttribute("aria-current", "step");
    await expect(page).toHaveURL(new RegExp(`\\?${QUERY.replace(/[?&]/g, "\\$&")}#step-${step}$`));
    if (step === 3) {
      await waitForCustomization(page);
      await expect(page.locator("body")).not.toContainText(/room size|room width|room height|room depth/i);
    }
  }
  const layoutStep = page.locator('[data-step="2"]');
  await layoutStep.focus();
  await expect(layoutStep).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Choose the layout that matches your space" })).toBeVisible();
  await expect(page.locator('[data-step="2"]')).toHaveAttribute("aria-current", "step");
  expect(failures).toEqual([]);
});

test("Steps 1, 2 and 4 preserve accepted baseline UI while V4 changes only Step 3", async ({ browser }) => {
  const baseline = await browser.newPage();
  const proof = await browser.newPage();
  const baselineFailures = monitorFailures(baseline);
  const proofFailures = monitorFailures(proof);
  const snapshot = async (page) => page.locator(".guided-shell").evaluate((shell) => ({
    className: shell.className,
    heading: shell.querySelector("h1")?.textContent?.trim(),
    stepLabels: [...shell.querySelectorAll("[data-step]")].map((node) => node.textContent.replace(/\s+/g, " ").trim()),
    buttons: [...shell.querySelectorAll("button")].map((node) => ({ text: node.textContent.replace(/\s+/g, " ").trim(), disabled: node.disabled }))
  }));
  await baseline.goto("configurator.html?start=new&renderer=webgl2#step-1", { waitUntil: "domcontentloaded" });
  await proof.goto(`configurator.html?start=new&${QUERY}#step-1`, { waitUntil: "domcontentloaded" });
  expect(await snapshot(proof)).toEqual(await snapshot(baseline));
  for (const page of [baseline, proof]) {
    await page.locator('[data-product-choice="cabinet-shelves"]').click();
    await page.locator("[data-continue]").click();
  }
  expect(await snapshot(proof)).toEqual(await snapshot(baseline));
  for (const page of [baseline, proof]) {
    await page.locator('[data-layout="door-wall"]').click();
    await page.locator("[data-continue]").click();
  }
  await waitForCustomization(proof);
  await baseline.locator("[data-continue]").click();
  await proof.locator("[data-v4-review]").click();
  await expect(baseline.getByRole("heading", { name: "Review your project details" })).toBeVisible();
  await expect(proof.getByRole("heading", { name: "Review your project details" })).toBeVisible();
  expect(await snapshot(proof)).toEqual(await snapshot(baseline));
  expect(proofFailures).toEqual([]);
  expect(baselineFailures).toEqual([]);
  await baseline.close();
  await proof.close();
});

test("one V4 Customization component serves Fireplace, Door and Window without shelf or legacy controls", async ({ page }) => {
  const failures = monitorFailures(page);
  await openFreshProof(page);
  for (const layout of LAYOUTS) {
    if (layout.id === "fireplace-wall") await selectProductAndLayout(page, layout.id);
    else {
      await page.locator("[data-v4-back]").click();
      await expect(page.getByRole("heading", { name: "Choose the layout that matches your space" })).toBeVisible();
      await page.locator(`[data-layout="${layout.id}"]`).click();
      await page.locator("[data-continue]").click();
      await waitForCustomization(page);
    }
    const record = await viewerDiagnostics(page);
    expect(record.asset.path).toBe(layout.asset);
    expect(record.asset.actualSha256).toBe(layout.sha256);
    expect(record.asset.bytes).toBe(layout.bytes);
    expect(record.geometry.sourceBuffersImmutable).toBe(true);
    expect(record.geometry.degenerateTriangleDelta).toBe(0);
    expect(record.geometry.modelBoundsDeltaMillimeters).toBe(0);
    expect(record.geometry.fixedWorldTranslationMaximumMillimeters).toBe(0);
    expect(record.presentation.exactRoleCoverage).toBe(layout.primitiveCount);
    expect(record.presentation.geometryModified).toBe(false);
    expect(record.presentation.shadowBudget.projectedMaximumDrawCalls).toBeLessThanOrEqual(245);
    await expect(page.locator("[data-v4-field]")).toHaveCount(FIELDS.length);
    await expect(page.locator(".immersive-mode-selector, [data-customization-tab], [data-customization-panel], [role=slider], [data-dimension-handle]")).toHaveCount(0);
    await expect(page.locator("[data-v4-pending]")).toHaveCount(PENDING_ITEMS.length);
    await expect(page.locator("[data-v4-pending] button, [data-v4-pending] input, [data-v4-pending] select, [data-v4-pending] [tabindex]")).toHaveCount(0);
    const accessibilityText = await page.locator("body").innerText();
    expect(accessibilityText).not.toMatch(/shelf spacing|shelf clearance|adjustable shelf clearance/i);
  }
  expect(failures).toEqual([]);
});

test("Customization values type, validate, reset, persist by layout and survive reload/history", async ({ page }) => {
  const failures = monitorFailures(page);
  await openFreshProof(page);
  await selectProductAndLayout(page, "fireplace-wall");
  for (const field of FIELDS.filter(({ type }) => type === "number")) {
    const input = page.locator(`#v4-${field.id}`);
    await expect(input).toHaveAttribute("min", String(field.min));
    await expect(input).toHaveAttribute("max", String(field.max));
    await expect(input).toHaveAttribute("step", String(field.step));
    await input.fill(String(field.min + field.step / 2));
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator(`#v4-${field.id}-error`)).toHaveAttribute("role", "alert");
    await input.fill(String(field.min));
    await input.press("ArrowUp");
    await expect(input).toHaveValue(String(field.min + field.step));
    await input.fill(String(field.max));
    await page.locator(`[data-v4-reset="${field.id}"]`).click();
    await expect(input).toHaveValue(String(field.defaultValue));
  }
  await page.locator("#v4-lowerCabinetHeight").fill("36");
  await page.locator('input[name="v4-baseType"][value="recessed"]').check();
  await expect(page.locator(".v4-blocked-note")).toBeVisible();
  await page.locator("[data-v4-back]").click();
  await page.locator('[data-layout="door-wall"]').click();
  await page.locator("[data-continue]").click();
  await waitForCustomization(page);
  await expect(page.locator("#v4-lowerCabinetHeight")).toHaveValue("34.5");
  await page.locator("#v4-lowerCabinetHeight").fill("24.25");
  await page.locator("[data-v4-back]").click();
  await page.goBack();
  await waitForCustomization(page);
  await expect(page.locator("#v4-lowerCabinetHeight")).toHaveValue("24.25");
  await page.goForward();
  await expect(page.getByRole("heading", { name: "Choose the layout that matches your space" })).toBeVisible();
  await page.goBack();
  await waitForCustomization(page);
  await expect(page.locator("#v4-lowerCabinetHeight")).toHaveValue("24.25");
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForCustomization(page);
  await expect(page.locator("#v4-lowerCabinetHeight")).toHaveValue("24.25");
  await page.locator("[data-v4-back]").click();
  await page.locator('[data-layout="fireplace-wall"]').click();
  await page.locator("[data-continue]").click();
  await waitForCustomization(page);
  await expect(page.locator("#v4-lowerCabinetHeight")).toHaveValue("36");
  await expect(page.locator('input[name="v4-baseType"][value="recessed"]')).toBeChecked();
  expect(failures).toEqual([]);
});

test("same-process fixed-camera V4 canvas is pixel-identical after each Customization remount", async ({ page }) => {
  const failures = monitorFailures(page);
  await openFreshProof(page);
  for (const layout of LAYOUTS) {
    if (layout.id === "fireplace-wall") await selectProductAndLayout(page, layout.id);
    else {
      await page.locator("[data-v4-back]").click();
      await page.locator(`[data-layout="${layout.id}"]`).click();
      await page.locator("[data-continue]").click();
      await waitForCustomization(page);
    }
    await page.locator('[data-v4-view="front"]').click();
    await page.waitForTimeout(450);
    const before = screenshotHash(await page.locator("[data-v4-viewer]").screenshot());
    await page.locator("[data-v4-back]").click();
    await page.locator(`[data-layout="${layout.id}"]`).click();
    await page.locator("[data-continue]").click();
    await waitForCustomization(page);
    await page.locator('[data-v4-view="front"]').click();
    await page.waitForTimeout(450);
    const after = screenshotHash(await page.locator("[data-v4-viewer]").screenshot());
    expect(after, layout.id).toBe(before);
  }
  expect(failures).toEqual([]);
});

test("V4 Step 3 is accessible and usable without covering the model at desktop, iPad and mobile sizes", async ({ page }) => {
  const failures = monitorFailures(page);
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await openFreshProof(page);
    await selectProductAndLayout(page, "window-wall");
    await expectNoSeriousAxeViolations(page);
    await page.locator(".v4-panel-actions").scrollIntoViewIfNeeded();
    await expect(page.locator(".v4-panel-actions")).toBeInViewport();
    const geometry = await page.evaluate(() => {
      const rect = (selector) => document.querySelector(selector).getBoundingClientRect().toJSON();
      return { model: rect(".v4-model-stage"), viewer: rect("[data-v4-viewer]"), panel: rect(".v4-customization-panel"), actions: rect(".v4-panel-actions") };
    });
    expect(geometry.viewer.width).toBeGreaterThan(0);
    expect(geometry.viewer.height).toBeGreaterThanOrEqual(viewport.width <= 600 ? 280 : 300);
    expect(geometry.actions.top).toBeGreaterThanOrEqual(geometry.panel.top - 1);
    expect(geometry.actions.bottom).toBeLessThanOrEqual(geometry.panel.bottom + 1);
    const sideBySide = geometry.model.right <= geometry.panel.left + 1;
    const stacked = geometry.model.bottom <= geometry.panel.top + 1;
    expect(sideBySide || stacked).toBe(true);
    const targets = await page.locator(".v4-camera-bar button:visible, .v4-panel-actions button:visible, .v4-number-row button:visible, .v4-radio-row label:visible").evaluateAll((nodes) => nodes.map((node) => ({ label: node.textContent.trim(), ...node.getBoundingClientRect().toJSON() })));
    for (const target of targets) {
      expect(target.width, `${viewport.width}x${viewport.height} ${target.label}`).toBeGreaterThanOrEqual(44);
      expect(target.height, `${viewport.width}x${viewport.height} ${target.label}`).toBeGreaterThanOrEqual(44);
    }
  }
  expect(failures).toEqual([]);
});
