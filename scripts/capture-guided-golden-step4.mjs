#!/usr/bin/env node

import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "@playwright/test";

const DEFAULT_BASE_URL = "http://127.0.0.1:5173";
const DEFAULT_OUTPUT = "artifacts/guided-golden-step4";
const VIEWPORT = Object.freeze({ width: 1536, height: 1024 });

const { values } = parseArgs({
  options: {
    "base-url": { type: "string" },
    output: { type: "string", short: "o" },
    fixture: { type: "string", multiple: true },
    headed: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false }
  },
  strict: true,
  allowPositionals: false
});

if (values.help) {
  console.log(`Capture accepted Step 4 geometry for the guided golden fixtures.

Start the local site in another terminal:
  npm run serve

Capture all 12 fixtures:
  node scripts/capture-guided-golden-step4.mjs \\
    --base-url http://127.0.0.1:5173 \\
    --output artifacts/guided-golden-step4

Capture one or more fixtures while iterating:
  node scripts/capture-guided-golden-step4.mjs \\
    --fixture G01-right-niche-tv \\
    --fixture G09-corner \\
    --output /tmp/jq-guided-golden

Options may also be supplied as GUIDED_GOLDEN_BASE_URL and
GUIDED_GOLDEN_OUTPUT environment variables.`);
  process.exit(0);
}

const baseUrl = normalizeBaseUrl(
  values["base-url"] || process.env.GUIDED_GOLDEN_BASE_URL || DEFAULT_BASE_URL
);
const outputDirectory = resolve(
  values.output || process.env.GUIDED_GOLDEN_OUTPUT || DEFAULT_OUTPUT
);
const catalogPath = resolve("config/golden-projects.json");
const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
validateCatalog(catalog);

const fixtureFilter = new Set(values.fixture || []);
const unknownFixtures = [...fixtureFilter].filter((id) => (
  !catalog.projects.some((project) => project.id === id)
));
if (unknownFixtures.length) {
  throw new Error(`Unknown golden fixture${unknownFixtures.length === 1 ? "" : "s"}: ${unknownFixtures.join(", ")}`);
}
const projects = fixtureFilter.size
  ? catalog.projects.filter((project) => fixtureFilter.has(project.id))
  : catalog.projects;

await assertServerReady(baseUrl);
await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch({ headless: !values.headed });
const evidence = [];
const failed = [];

try {
  for (const project of projects) {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
      colorScheme: "light",
      reducedMotion: "reduce",
      locale: "en-US",
      timezoneId: "UTC",
      serviceWorkers: "block"
    });
    const page = await context.newPage();
    const runtimeFailures = monitorRuntime(page);
    const filename = `${project.id}-step4.png`;
    const screenshotPath = resolve(outputDirectory, filename);

    try {
      console.log(`[${project.id}] selecting ${project.productId} / ${project.layoutId}`);
      await driveFixtureToStep4(page, baseUrl, project);
      const accepted = await waitForAcceptedStep4(page, project);

      if (runtimeFailures.length) {
        throw new Error(`runtime failures:\n${runtimeFailures.map((failure) => `  - ${failure}`).join("\n")}`);
      }

      await page.evaluate(async () => {
        window.scrollTo(0, 0);
        await document.fonts.ready;
        await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
      });
      await page.screenshot({
        path: screenshotPath,
        fullPage: false,
        animations: "disabled",
        caret: "hide",
        scale: "device"
      });

      evidence.push({
        id: project.id,
        productId: project.productId,
        layoutId: project.layoutId,
        finish: project.finish,
        screenshot: filename,
        geometryFingerprint: accepted.geometryFingerprint,
        specificationFingerprint: accepted.specificationFingerprint,
        renderContractValid: true
      });
      console.log(`[${project.id}] wrote ${screenshotPath}`);
    } catch (error) {
      const diagnosticPath = resolve(outputDirectory, `${project.id}-FAILED.png`);
      await page.screenshot({ path: diagnosticPath, fullPage: true, animations: "disabled" }).catch(() => {});
      failed.push({
        id: project.id,
        error: error instanceof Error ? error.message : String(error),
        diagnostic: relative(outputDirectory, diagnosticPath)
      });
      console.error(`[${project.id}] FAILED: ${failed.at(-1).error}`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

const manifest = {
  schemaVersion: 1,
  source: "config/golden-projects.json",
  catalogSchemaVersion: catalog.schemaVersion,
  viewport: VIEWPORT,
  route: "/configurator.html?start=new",
  step: 4,
  expectedFixtureCount: projects.length,
  capturedFixtureCount: evidence.length,
  fixtures: evidence
};
await writeFile(
  resolve(outputDirectory, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8"
);

if (failed.length) {
  throw new Error(
    `Golden capture completed with ${failed.length} failure${failed.length === 1 ? "" : "s"}:\n`
    + failed.map(({ id, error, diagnostic }) => `- ${id}: ${error} (${diagnostic})`).join("\n")
  );
}

console.log(`Captured ${evidence.length} accepted Step 4 golden screenshot${evidence.length === 1 ? "" : "s"} in ${outputDirectory}`);

async function driveFixtureToStep4(page, siteBaseUrl, project) {
  await page.goto(`${siteBaseUrl}/configurator.html?start=new`, { waitUntil: "networkidle" });
  await expectVisibleHeading(page, "What would you like us to build?");

  const productCard = page.locator(`[data-product-choice="${cssAttribute(project.productId)}"]`);
  await assertCount(productCard, 1, `${project.id} product card`);
  await productCard.click();
  await assertAttribute(productCard, "aria-pressed", "true", `${project.id} selected product`);
  await clickContinue(page);

  await expectVisibleHeading(page, "Choose the room condition that matches your space");
  const layoutCard = page.locator(`[data-layout="${cssAttribute(project.layoutId)}"]`);
  await assertCount(layoutCard, 1, `${project.id} room layout card`);
  if (await layoutCard.isDisabled()) {
    throw new Error(`${project.id} exposes ${project.layoutId} as unavailable for ${project.productId}`);
  }
  await layoutCard.click();
  await assertAttribute(layoutCard, "aria-pressed", "true", `${project.id} selected layout`);
  await clickContinue(page);

  await expectVisibleHeading(page, "Tell us about your space");
  for (const [fieldId, value] of Object.entries(project.measurements || {})) {
    await setMeasurement(page, project, fieldId, value);
  }
  await clickContinue(page);

  await expectVisibleHeading(page, "Refine your concept");
  if (!page.url().endsWith("#step-4")) {
    throw new Error(`${project.id} did not navigate to Step 4; current URL is ${page.url()}`);
  }
  const finish = page.locator(`button[data-finish="${cssAttribute(project.finish)}"]`);
  await assertCount(finish, 1, `${project.id} finish ${project.finish}`);
  await finish.click();
  await assertAttribute(finish, "aria-pressed", "true", `${project.id} selected finish`);
}

async function setMeasurement(page, project, fieldId, value) {
  const controls = page.locator(`[data-measurement="${cssAttribute(fieldId)}"]`);
  const count = await controls.count();
  if (!count) {
    if (isDerivedHiddenMeasurement(project, fieldId, value)) {
      console.log(`[${project.id}] ${fieldId} is safely derived by the topology-specific UI`);
      return;
    }
    throw new Error(`${project.id} measurement ${fieldId} is absent from the real Step 3 form`);
  }
  const first = controls.first();
  const control = await first.evaluate((element) => ({
    tagName: element.tagName.toLowerCase(),
    type: element instanceof HTMLInputElement ? element.type : null
  }));

  if (control.type === "radio") {
    const radio = page.locator(
      `[data-measurement="${cssAttribute(fieldId)}"][value="${cssAttribute(String(value))}"]`
    );
    await assertCount(radio, 1, `${project.id} ${fieldId}=${value}`);
    await radio.check();
    return;
  }
  if (control.tagName === "select") {
    await first.selectOption(String(value));
    return;
  }
  await first.fill(String(value));
  await first.blur();
}

function isDerivedHiddenMeasurement(project, fieldId, value) {
  if (
    (project.layoutId === "right-niche" && fieldId === "leftReturn")
    || (project.layoutId === "left-niche" && fieldId === "rightReturn")
  ) {
    return Number(value) === 0;
  }
  if (!["windowLeftDistance", "windowRightDistance"].includes(fieldId)) return false;
  const wallWidth = Number(project.measurements?.wallWidth);
  const windowWidth = Number(project.measurements?.windowWidth);
  const distance = Number(value);
  if (![wallWidth, windowWidth, distance].every(Number.isFinite)) return false;
  return Math.abs(distance - (wallWidth - windowWidth) / 2) <= 0.001;
}

async function waitForAcceptedStep4(page, project) {
  const preview = page.locator(".concept-preview");
  await assertCount(preview, 1, `${project.id} concept preview`);
  await preview.waitFor({ state: "visible", timeout: 20_000 });
  await page.waitForFunction(() => {
    const figure = document.querySelector(".concept-preview");
    const scene = figure?.querySelector("[data-concept-scene]");
    const canvas = figure?.querySelector(".guided-3d-canvas");
    return figure?.dataset.acceptedSpecification === "true"
      && Boolean(figure.dataset.geometryFingerprint)
      && Boolean(figure.dataset.specificationFingerprint)
      && scene?.dataset.guided3dState === "ready"
      && canvas?.dataset.rendered === "true"
      && canvas?.dataset.renderContractValid === "true"
      && canvas.dataset.geometryFingerprint === figure.dataset.geometryFingerprint
      && canvas.dataset.specificationFingerprint === figure.dataset.specificationFingerprint;
  }, null, { timeout: 30_000 });
  await page.waitForLoadState("networkidle");

  const details = await preview.evaluate((figure) => {
    const canvas = figure.querySelector(".guided-3d-canvas");
    const fitSummary = figure.querySelector("[data-accepted-fit-summary]");
    return {
      accepted: figure.dataset.acceptedSpecification,
      productId: figure.dataset.category,
      layoutId: figure.dataset.layout,
      finish: figure.dataset.finish,
      geometryFingerprint: figure.dataset.geometryFingerprint,
      specificationFingerprint: figure.dataset.specificationFingerprint,
      fitSummaryVisible: Boolean(fitSummary && fitSummary.getClientRects().length),
      renderContractValid: canvas?.dataset.renderContractValid
    };
  });

  if (details.accepted !== "true" || details.renderContractValid !== "true") {
    throw new Error(`${project.id} did not expose an accepted, render-valid specification`);
  }
  if (details.layoutId !== project.layoutId || details.finish !== project.finish) {
    throw new Error(
      `${project.id} preview drifted: expected ${project.layoutId}/${project.finish}, got ${details.layoutId}/${details.finish}`
    );
  }
  if (!details.fitSummaryVisible) {
    throw new Error(`${project.id} accepted fit summary is not visible`);
  }
  return details;
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
    if (response.status() >= 400) failures.push(`response: ${response.status()} ${response.url()}`);
  });
  return failures;
}

async function clickContinue(page) {
  const button = page.locator("[data-continue]");
  await assertCount(button, 1, "Continue button");
  if (await button.isDisabled()) throw new Error("Continue button is disabled");
  await button.click();
}

async function expectVisibleHeading(page, name) {
  await page.getByRole("heading", { name, exact: true }).waitFor({ state: "visible", timeout: 20_000 });
}

async function assertCount(locator, expected, label) {
  const actual = await locator.count();
  if (actual !== expected) throw new Error(`${label}: expected ${expected} element(s), found ${actual}`);
}

async function assertAttribute(locator, name, expected, label) {
  const actual = await locator.getAttribute(name);
  if (actual !== expected) throw new Error(`${label}: expected ${name}=${expected}, got ${actual}`);
}

async function assertServerReady(siteBaseUrl) {
  const url = `${siteBaseUrl}/configurator.html`;
  let response;
  try {
    response = await fetch(url, { redirect: "follow" });
  } catch (error) {
    throw new Error(`Cannot reach ${url}. Start the site with \"npm run serve\" first. (${error.message})`);
  }
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}. Start the repository root with \"npm run serve\".`);
  }
}

function validateCatalog(value) {
  if (value?.schemaVersion !== 1 || !Array.isArray(value.projects)) {
    throw new Error("config/golden-projects.json is not a supported schemaVersion 1 catalog");
  }
  if (value.projects.length !== 12 || new Set(value.projects.map(({ id }) => id)).size !== 12) {
    throw new Error("config/golden-projects.json must contain exactly 12 uniquely named fixtures");
  }
  for (const project of value.projects) {
    if (!project?.id || !project.productId || !project.layoutId || !project.finish || !project.measurements) {
      throw new Error(`Golden fixture ${project?.id || "(missing id)"} is incomplete`);
    }
  }
}

function normalizeBaseUrl(value) {
  const url = new URL(value);
  return url.href.replace(/\/$/, "");
}

function cssAttribute(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}
