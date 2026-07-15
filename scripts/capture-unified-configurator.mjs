import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.QA_BASE_URL || "http://127.0.0.1:5173";
const outputDir = path.resolve(process.argv[2] || "artifacts/unified-configurator-qa");
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist", "--use-angle=swiftshader"]
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  colorScheme: "light",
  reducedMotion: "reduce",
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

const captures = [];

async function openDesign({ preset, viewport }) {
  await page.setViewportSize(viewport);
  await page.goto(`${baseUrl}/configurator.html?preset=${encodeURIComponent(preset)}`, { waitUntil: "networkidle" });
  await page.locator("[data-3d-viewer]").waitFor({ state: "visible" });
  await page.waitForFunction(() => document.querySelector("[data-3d-viewer]")?.dataset.renderValid === "true");
  await page.waitForFunction(() => !document.querySelector("[data-bookcase-builder]")?.__bookcaseConfigurator?.viewer?.getDiagnostics?.().cameraTransitionActive);
}

async function selectRole(role, occurrence = 0) {
  const selected = await page.evaluate(({ role: targetRole, occurrence: targetIndex }) => {
    const host = document.querySelector("[data-bookcase-builder]");
    const controller = host?.__bookcaseConfigurator;
    const candidates = controller?.layout?.components?.filter((component) => component.role === targetRole) || [];
    const component = candidates[targetIndex] || null;
    if (!component) return null;
    const anchor = controller.viewer.getComponentScreenAnchor?.(component.id) || null;
    controller.handleModelSelection({ componentId: component.id, source: "keyboard", anchor });
    return { id: component.id, role: component.role };
  }, { role, occurrence });
  if (!selected) throw new Error(`No ${role} descriptor was available for capture.`);
  await page.locator("[data-contextual-editor]").waitFor({ state: "visible" });
  return selected;
}

async function saveCapture(name, details = {}) {
  const file = path.join(outputDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  const audit = await page.evaluate(() => {
    const host = document.querySelector("[data-bookcase-builder]");
    const controller = host?.__bookcaseConfigurator;
    const viewer = controller?.viewer?.getDiagnostics?.() || {};
    return {
      interface: controller?.getDiagnostics?.().interface || null,
      selection: controller?.getDiagnostics?.().selection || null,
      contextEditorOpen: Boolean(controller?.contextEditorOpen),
      canvasCount: document.querySelectorAll("[data-3d-viewer] canvas").length,
      renderValid: document.querySelector("[data-3d-viewer]")?.dataset.renderValid || null,
      viewerInstance: viewer.instanceId || null,
      viewerRebuilds: viewer.rebuildCount || 0,
      previewActive: Boolean(viewer.previewActive),
      horizontalOverflow: document.documentElement.scrollWidth - innerWidth
    };
  });
  captures.push({ name, file: path.relative(process.cwd(), file), ...details, audit });
}

await openDesign({ preset: "classic-open", viewport: { width: 1440, height: 900 } });
await saveCapture("desktop-1440-no-selection", { viewport: "1440x900", state: "no-selection" });

await selectRole("section", 1);
await saveCapture("desktop-1440-section-selected", { viewport: "1440x900", state: "section-selected" });

await openDesign({ preset: "lower-cabinets", viewport: { width: 1440, height: 900 } });
await selectRole("door", 0);
await saveCapture("desktop-1440-door-selected", { viewport: "1440x900", state: "door-selected" });

await openDesign({ preset: "classic-open", viewport: { width: 1440, height: 900 } });
await selectRole("shelf", 0);
await saveCapture("desktop-1440-shelf-selected", { viewport: "1440x900", state: "shelf-selected" });

await openDesign({ preset: "lower-cabinets", viewport: { width: 1440, height: 900 } });
await selectRole("handle", 0);
await saveCapture("desktop-1440-handle-selected", { viewport: "1440x900", state: "handle-selected" });

await openDesign({ preset: "classic-open", viewport: { width: 1440, height: 900 } });
const divider = page.locator('[data-section-divider="0"]');
await divider.waitFor({ state: "visible" });
const dividerBox = await divider.boundingBox();
if (!dividerBox) throw new Error("The first divider handle has no visible bounds.");
await page.mouse.move(dividerBox.x + dividerBox.width / 2, dividerBox.y + dividerBox.height / 2);
await page.mouse.down();
await page.mouse.move(dividerBox.x + dividerBox.width / 2 + 42, dividerBox.y + dividerBox.height / 2, { steps: 6 });
await page.waitForFunction(() => Boolean(document.querySelector("[data-bookcase-builder]")?.__bookcaseConfigurator?.viewer?.getDiagnostics?.().previewActive));
await saveCapture("desktop-1440-divider-drag-preview", { viewport: "1440x900", state: "divider-drag-preview" });
await page.mouse.up();

await openDesign({ preset: "classic-open", viewport: { width: 1440, height: 900 } });
await selectRole("base", 0);
await saveCapture("desktop-1440-base-selected", { viewport: "1440x900", state: "base-selected" });

await openDesign({ preset: "display-wall", viewport: { width: 2560, height: 1440 } });
await saveCapture("desktop-wide-2560-no-selection", { viewport: "2560x1440", state: "no-selection" });

await openDesign({ preset: "classic-open", viewport: { width: 820, height: 1180 } });
await selectRole("section", 0);
await saveCapture("tablet-portrait-820-section-selected", { viewport: "820x1180", state: "section-selected" });

await openDesign({ preset: "lower-cabinets", viewport: { width: 1180, height: 820 } });
await selectRole("door", 0);
await saveCapture("tablet-landscape-1180-door-selected", { viewport: "1180x820", state: "door-selected" });

await openDesign({ preset: "lower-cabinets", viewport: { width: 390, height: 844 } });
await selectRole("door", 0);
await saveCapture("mobile-390-door-bottom-sheet", { viewport: "390x844", state: "door-selected-bottom-sheet" });

await openDesign({ preset: "classic-open", viewport: { width: 844, height: 390 } });
await saveCapture("short-landscape-844-no-selection", { viewport: "844x390", state: "no-selection" });

await writeFile(path.join(outputDir, "manifest.json"), `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  baseUrl,
  runtimeErrors,
  captures
}, null, 2)}\n`);

await browser.close();

if (runtimeErrors.length) {
  throw new Error(`Screenshot capture reported runtime errors:\n${runtimeErrors.join("\n")}`);
}

console.log(`Captured ${captures.length} unified configurator screenshots in ${outputDir}.`);
