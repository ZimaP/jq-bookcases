import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

const baseUrl = process.env.QA_BASE_URL || "http://127.0.0.1:5173";
const outputDirectory = path.resolve(process.argv[2] || "artifacts/responsive-workspace-qa/after");
const viewports = [
  { width: 2048, height: 1152 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1180, height: 820 },
  { width: 1024, height: 768 },
  { width: 820, height: 1180 }
];

await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist", "--use-angle=swiftshader"]
});
const page = await browser.newPage({
  viewport: viewports[0],
  colorScheme: "light",
  deviceScaleFactor: 1
});

const runtimeErrors = [];
page.on("pageerror", (error) => runtimeErrors.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error") runtimeErrors.push(`console: ${message.text()}`);
});
page.on("requestfailed", (request) => {
  runtimeErrors.push(`requestfailed: ${request.method()} ${request.url()} (${request.failure()?.errorText || "unknown"})`);
});

const metrics = {};

for (const viewport of viewports) {
  await page.setViewportSize(viewport);
  await page.goto(`${baseUrl}/configurator.html?preset=lower-cabinets&capture=responsive-workspace`, {
    waitUntil: "networkidle"
  });
  const viewer = page.locator("[data-3d-viewer]");
  await viewer.waitFor({ state: "visible" });
  await page.waitForFunction(() => document.querySelector("[data-3d-viewer]")?.dataset.renderValid === "true");
  await page.locator('[data-workspace-stage="layout"]').click();
  await page.waitForFunction(() => {
    const host = document.querySelector("[data-bookcase-builder]");
    const shell = document.querySelector("[data-builder-form]");
    return shell?.dataset.cameraState !== "transitioning"
      && host?.__bookcaseConfigurator?.viewer?.getDiagnostics?.().cameraTransitionActive === false;
  });
  await page.evaluate(async () => {
    await document.fonts?.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });

  const key = `${viewport.width}x${viewport.height}`;
  metrics[key] = await page.evaluate(() => {
    const measure = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
        scrollWidth: element.scrollWidth,
        scrollHeight: element.scrollHeight,
        clientWidth: element.clientWidth,
        clientHeight: element.clientHeight
      };
    };
    const shell = document.querySelector("[data-builder-form]");
    return {
      viewport: { width: innerWidth, height: innerHeight },
      document: {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight
      },
      workspace: measure(".reference-workspace"),
      rail: measure(".workspace-stage-rail"),
      model: measure(".workspace-model"),
      viewer: measure("[data-3d-viewer]"),
      toolbar: measure(".workspace-model-toolbar"),
      properties: measure(".workspace-properties"),
      propertyPanel: measure(".workspace-properties-panel"),
      organizer: measure(".workspace-section-organizer"),
      footer: measure(".workspace-estimate-bar"),
      sectionCount: document.querySelectorAll("[data-section-organizer] [data-section-card]").length,
      camera: {
        state: shell?.dataset.cameraState || null,
        profile: shell?.dataset.cameraProfile || null,
        sourceStage: shell?.dataset.cameraSourceStage || null,
        sourceSection: shell?.dataset.cameraSourceSection || null
      },
      renderValid: document.querySelector("[data-3d-viewer]")?.dataset.renderValid || null
    };
  });

  await page.screenshot({
    path: path.join(outputDirectory, `${key}.png`),
    fullPage: false,
    animations: "disabled"
  });
}

await writeFile(path.join(outputDirectory, "metrics.json"), `${JSON.stringify(metrics, null, 2)}\n`);
await browser.close();

if (runtimeErrors.length) {
  throw new Error(`Responsive workspace capture reported runtime errors:\n${runtimeErrors.join("\n")}`);
}

console.log(`Captured ${viewports.length} responsive workspace screenshots in ${outputDirectory}.`);
