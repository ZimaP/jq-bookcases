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
  await page.locator("[data-properties-inspector]").waitFor({ state: "visible" });
  return selected;
}

async function selectSection(index, type = null) {
  await page.locator(`[data-section-select="${index}"]`).click();
  if (type) {
    await page.locator(`label:has([data-section-type="${type}"])`).click();
    await page.locator(`[data-section-type="${type}"]`).waitFor({ state: "attached" });
  }
  await page.waitForFunction((selectedIndex) => (
    document.querySelector(`[data-section-card="${selectedIndex}"]`)?.classList.contains("is-selected")
  ), index);
  await page.evaluate(() => document.querySelector("[data-bookcase-builder]")?.__bookcaseConfigurator?.clearStatus?.());
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
      activeWorkspaceStage: controller?.getDiagnostics?.().activeWorkspaceStage || null,
      activeInspectorTab: controller?.getDiagnostics?.().activeInspectorTab || null,
      selection: controller?.getDiagnostics?.().selection || null,
      history: controller?.getDiagnostics?.().history || null,
      canvasCount: document.querySelectorAll("[data-3d-viewer] canvas").length,
      stageCount: document.querySelectorAll("[data-workspace-stage]").length,
      propertiesCount: document.querySelectorAll("[data-properties-inspector]").length,
      organizerCount: document.querySelectorAll("[data-section-organizer]").length,
      renderValid: document.querySelector("[data-3d-viewer]")?.dataset.renderValid || null,
      viewerInstance: viewer.instanceId || null,
      viewerRebuilds: viewer.rebuildCount || 0,
      previewActive: Boolean(viewer.previewActive),
      horizontalOverflow: document.documentElement.scrollWidth - innerWidth
    };
  });
  captures.push({ name, file: path.relative(process.cwd(), file), ...details, audit });
}

await openDesign({ preset: "lower-cabinets", viewport: { width: 1536, height: 1024 } });
await selectSection(2, "drawers");
await saveCapture("desktop-1536-layout-selected", { viewport: "1536x1024", state: "section-3-lower-drawers-general" });

await page.locator("[data-close-selection]").click();
await saveCapture("desktop-1536-no-selection", { viewport: "1536x1024", state: "no-selection" });

await selectSection(2);
await page.locator('[data-inspector-tab="shelves"]').click();
await saveCapture("desktop-1536-shelves-tab", { viewport: "1536x1024", state: "section-3-shelves" });

await selectRole("handle", 0);
await saveCapture("desktop-1536-hardware-selected", { viewport: "1536x1024", state: "hardware-selected" });

await page.locator("[data-toggle-dimensions]").click();
await saveCapture("desktop-1536-dimensions-off", { viewport: "1536x1024", state: "dimensions-off" });

await page.locator("[data-toggle-wall]").click();
await saveCapture("desktop-1536-wall-off", { viewport: "1536x1024", state: "wall-off" });

await page.locator('[data-workspace-stage="space"]').click();
await page.locator('[data-active-stage-panel="space"] input[type="number"][data-field="height"]').fill("97");
await page.locator('[data-active-stage-panel="space"] input[type="number"][data-field="height"]').press("Enter");
await saveCapture("desktop-1536-undo-available", { viewport: "1536x1024", state: "undo-available" });

await openDesign({ preset: "lower-cabinets", viewport: { width: 1440, height: 900 } });
await selectSection(2, "drawers");
await saveCapture("desktop-1440-layout-selected", { viewport: "1440x900", state: "section-3-lower-drawers" });

await openDesign({ preset: "lower-cabinets", viewport: { width: 1280, height: 800 } });
await selectSection(2, "drawers");
await saveCapture("laptop-1280-layout-selected", { viewport: "1280x800", state: "section-3-lower-drawers" });

await openDesign({ preset: "lower-cabinets", viewport: { width: 1180, height: 820 } });
await selectSection(2, "drawers");
await page.locator('[data-inspector-tab="drawers"]').click();
await saveCapture("tablet-landscape-properties-drawer", { viewport: "1180x820", state: "drawer-properties" });

await openDesign({ preset: "classic-open", viewport: { width: 820, height: 1180 } });
await selectSection(1);
await saveCapture("tablet-portrait-section-selected", { viewport: "820x1180", state: "section-selected" });

await openDesign({ preset: "lower-cabinets", viewport: { width: 390, height: 844 } });
await selectSection(2, "drawers");
await saveCapture("mobile-390-properties-bottom-sheet", { viewport: "390x844", state: "properties-bottom-sheet" });

await page.locator("[data-section-organizer]").scrollIntoViewIfNeeded();
await saveCapture("mobile-390-section-organizer", { viewport: "390x844", state: "section-organizer" });

await openDesign({ preset: "classic-open", viewport: { width: 844, height: 390 } });
await saveCapture("short-landscape-toolbar", { viewport: "844x390", state: "toolbar" });

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
