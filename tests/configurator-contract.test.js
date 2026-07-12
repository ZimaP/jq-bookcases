import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (name) => readFileSync(`${root}/${name}`, "utf8");
const source = read("configurator-3d.js");
const workflow = read("configurator-experience.js");
const css = read("configurator-experience.css");
const html = read("configurator.html");
const catalogProvider = read("benjamin-moore-colors.js");
const configSource = read("bookcase-config.js");

function methodBody(name, nextName) {
  const start = source.indexOf(`  ${name}(`);
  const end = source.indexOf(`\n  ${nextName}(`, start + 1);
  assert.notEqual(start, -1, `${name} must exist`);
  assert.notEqual(end, -1, `${nextName} must follow ${name}`);
  return source.slice(start, end);
}

test("the route mounts exactly one configurator host and one persistent viewer surface", () => {
  assert.equal((html.match(/data-bookcase-builder/g) || []).length, 1);
  assert.equal((source.match(/data-3d-viewer tabindex=/g) || []).length, 1);
  assert.equal((source.match(/new BookcaseViewer3D\(/g) || []).length, 1);
  assert.match(source, /this\.viewer = this\.createViewer\(this\.layout\)/);
});

test("mode panels never contain or replace the shared viewer", () => {
  const shell = methodBody("renderFullPageConfigurator", "renderActiveControls");
  assert.ok(shell.indexOf("data-mode-panel=\"all\"") < shell.indexOf("data-3d-viewer"));
  const activeControls = methodBody("renderActiveControls", "renderGuidedExperience");
  assert.match(activeControls, /guidedPanel\.innerHTML/);
  assert.match(activeControls, /allPanel\.innerHTML/);
  assert.doesNotMatch(activeControls, /viewer\.innerHTML|host\.innerHTML|createViewer|new BookcaseViewer3D/);
});

test("switching modes is presentation-only and cannot price, update, or remount the model", () => {
  const switchMode = methodBody("switchMode", "goToAdjacentGuidedStep");
  assert.match(switchMode, /renderActiveControls/);
  assert.match(switchMode, /syncInterface/);
  assert.doesNotMatch(switchMode, /this\.update\(|viewer\.update|calculateBookcasePrice|createViewer|new BookcaseViewer3D/);
});

test("one delegated action path owns Save Design and Request Quote", () => {
  assert.equal((source.match(/handleSaveAction\(\) \{/g) || []).length, 1);
  assert.equal((source.match(/handleQuoteAction\(\) \{/g) || []).length, 1);
  assert.equal((source.match(/saveCurrentDesign\(\) \{/g) || []).length, 1);
  assert.equal((source.match(/openQuotePage\(\) \{/g) || []).length, 1);
  assert.match(source, /openQuotePage\(\) \{[\s\S]*this\.saveCurrentDesign\(\)[\s\S]*window\.location\.assign/);
});

test("one price pipeline and one physical update pipeline serve both modes", () => {
  assert.equal((source.match(/update\(nextState, options = \{\}\) \{/g) || []).length, 1);
  assert.equal((source.match(/this\.pricing = buildPricingContext\(this\.state, this\.layout\)/g) || []).length, 2);
  assert.equal((source.match(/this\.price = this\.pricing\.total/g) || []).length, 2);
  assert.equal((source.match(/this\.viewer\.update\(this\.state, this\.layout, changedFields\)/g) || []).length, 1);
  assert.doesNotMatch(source, /guidedPrice|allControlsPrice|guidedState|allControlsState/);
});

test("the cached shared total feeds estimate, review, Save, and Quote without mode-specific arithmetic", () => {
  const review = methodBody("renderReviewContent", "renderPresetMini");
  const summary = methodBody("updatePriceAndSummary", "setOptionalText");
  const save = methodBody("saveCurrentDesign", "openQuotePage");
  const quote = methodBody("openQuotePage", "showStatus");

  assert.match(review, /formatPrice\(this\.price\)/);
  assert.match(summary, /const price = this\.price/);
  assert.match(save, /createSavedDesignRecord\(this\.state, this\.price\)/);
  assert.match(quote, /this\.saveCurrentDesign\(\)/);
  assert.doesNotMatch(`${review}\n${summary}\n${save}\n${quote}`, /calculateBookcasePrice|buildPricingContext/);
});

test("mode tabs, appearance tabs, accordions, and validation have complete ARIA wiring", () => {
  assert.match(source, /role="tablist" aria-label="Configuration experience"/);
  assert.match(source, /role="tab" data-configurator-mode="guided" aria-controls=/);
  assert.match(source, /role="tabpanel" aria-labelledby=.*data-mode-panel="guided"/);
  assert.match(source, /role="tab" data-appearance-tab=.*aria-controls=.*aria-selected=/);
  assert.match(source, /class="appearance-panel" role="tabpanel" aria-labelledby=/);
  assert.match(source, /data-category-trigger=.*aria-expanded=.*aria-controls=/);
  assert.match(source, /data-category-panel=.*role="region" aria-labelledby=/);
  assert.match(source, /data-validation-field="customPaintColor"/);
  assert.match(source, /\[data-field\], \[data-validation-field\]/);
});

test("Guided-only navigation and All-Controls-only accordions remain separated", () => {
  const guided = methodBody("renderGuidedExperience", "renderGuidedStepContent");
  const all = methodBody("renderAllControlsExperience", "renderAccordionCategory");
  assert.match(guided, /guided-progress/);
  assert.match(guided, /data-guided-back/);
  assert.match(guided, /data-guided-continue/);
  assert.doesNotMatch(guided, /data-configurator-accordion/);
  assert.match(all, /data-configurator-accordion/);
  assert.match(all, /data-review-design/);
  assert.doesNotMatch(all, /guided-progress|data-guided-back|data-guided-continue/);
});

test("browser-verifiable diagnostics expose lifecycle counters without a global controller", () => {
  assert.match(source, /dataset\.diagnosticViewerInstance/);
  assert.match(source, /dataset\.diagnosticPriceCalculations/);
  assert.match(source, /dataset\.diagnosticPhysicalUpdates/);
  assert.match(source, /dataset\.diagnosticSaveActions/);
  assert.match(source, /dataset\.diagnosticQuoteActions/);
  assert.match(source, /dataset\.diagnosticConfiguration/);
  assert.match(source, /dataset\.diagnosticPricing/);
  assert.doesNotMatch(source, /window\.__jqConfigurator/);
});

test("viewer teardown removes controls, resources, and its canvas", () => {
  const viewer = source.slice(source.indexOf("class BookcaseViewer3D"));
  assert.match(viewer, /this\.controlAbortController = new AbortController\(\)/);
  assert.match(viewer, /this\.controlAbortController\?\.abort\(\)/);
  assert.match(viewer, /disposeObject\(this\.scene\)/);
  assert.match(viewer, /this\.renderer\.domElement\?\.remove\(\)/);
});

test("viewer controls preserve standard browser zoom shortcuts", () => {
  const controls = methodBody("bindControls", "setView");
  assert.match(controls, /if \(event\.ctrlKey \|\| event\.metaKey\) return;/);
  assert.match(controls, /addEventListener\("wheel"[\s\S]*event\.preventDefault\(\)/);
  assert.match(controls, /addEventListener\("keydown"[\s\S]*event\.ctrlKey \|\| event\.metaKey/);
});

test("blocking drafts disable review and link all completion actions to guidance", () => {
  const availability = methodBody("syncActionAvailability", "getDiagnostics");
  assert.match(availability, /\[data-review-design\]/);
  assert.match(availability, /button\.disabled = blocking/);
  assert.match(availability, /aria-describedby/);
  assert.match(source, /data-guided-errors tabindex="-1"/);
});

test("legacy dual-sidebar handlers and DOM-scanning state reconstruction are gone", () => {
  for (const retired of [
    "bindLegacyEvents", "handleFieldChangeLegacy", "readStateFromControls", "updateLegacy",
    "renderDoorOptionsLegacy", "renderPresetTray", "renderTrustRow", "syncLowerDependentControls"
  ]) assert.doesNotMatch(source, new RegExp(retired));
});

test("responsive presentation covers desktop, tablet, mobile, touch scrolling, and reduced motion", () => {
  assert.match(css, /grid-template-columns: clamp\(360px, 29vw, 420px\) minmax\(0, 1fr\)/);
  for (const breakpoint of ["1280px", "900px", "760px", "390px"]) assert.match(css, new RegExp(`max-width: ${breakpoint}`));
  assert.match(css, /touch-action: pan-y/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\.guided-navigation \{\s*position: static;/);
});

test("the configurator route loads the experience module and final presentation layer", () => {
  assert.match(html, /configurator-experience\.css/);
  assert.match(html, /configurator-3d\.js/);
  assert.match(source, /from "\.\/configurator-experience\.js/);
  assert.match(workflow, /export const GUIDED_STEPS/);
});

test("both interface modes use one lazy official-palette catalog provider", () => {
  assert.equal((source.match(/getBenjaminMooreColorCatalogProvider\(\)/g) || []).length, 1);
  assert.match(catalogProvider, /class ColorCatalogProvider/);
  assert.match(catalogProvider, /class BenjaminMooreColorCatalogProvider extends ColorCatalogProvider/);
  assert.match(catalogProvider, /fetch\(url, \{ credentials: "same-origin", cache: "force-cache" \}\)/);
  assert.doesNotMatch(catalogProvider, /fetch\([^\n]*benjaminmoore\.com/);
  assert.doesNotMatch(source, /guidedBenjaminMoore|allControlsBenjaminMoore/);
});

test("Benjamin Moore search is deliberate, accessible, escaped, and screen-reader announced", () => {
  const finish = methodBody("renderFinishGroup", "renderHardwareGroup");
  const resultsStart = source.indexOf("  async updateBenjaminMooreResults(");
  const resultsEnd = source.indexOf("\n  async applyBenjaminMooreQuery(", resultsStart + 1);
  assert.notEqual(resultsStart, -1);
  assert.notEqual(resultsEnd, -1);
  const results = source.slice(resultsStart, resultsEnd);
  assert.match(finish, /aria-describedby=.*bm-help .*bm-disclaimer/);
  assert.match(finish, /data-bm-status role="status" aria-live="polite"/);
  assert.match(finish, /target="_blank" rel="noopener noreferrer"/);
  assert.match(results, /escapeHtml\(color\.name\)/);
  assert.match(results, /data-bm-id/);
  assert.doesNotMatch(results, /applyBenjaminMooreColor\(matches\[0\]/);
});

test("structured paint identity is canonical and legacy custom fields remain compatibility mirrors", () => {
  assert.match(configSource, /paintSelection: null/);
  assert.match(configSource, /source: saved\?\.source === "benjamin-moore"/);
  assert.match(configSource, /catalogId:/);
  assert.match(configSource, /catalogVersion:/);
  assert.match(configSource, /sourceType:/);
  assert.match(configSource, /finish === "custom_bm" \? paintSelection : null/);
});

test("paint changes use the existing sRGB partial-material path without recoloring hardware or glass", () => {
  const partial = methodBody("applyPartialUpdate", "applyFinishMaterials");
  const finish = methodBody("applyFinishMaterials", "applyHardwareMaterial");
  assert.match(partial, /paintSelection/);
  assert.match(partial, /this\.applyFinishMaterials\(nextState\)/);
  assert.match(finish, /materials\.case, materials\.side, materials\.back, materials\.inset, materials\.edgeBlock/);
  assert.doesNotMatch(finish, /materials\.hardware|materials\.glass|new THREE\.Mesh/);
  assert.match(source, /outputColorSpace = THREE\.SRGBColorSpace/);
  assert.match(source, /toneMapping = THREE\.ACESFilmicToneMapping/);
  assert.match(source, /material\.color\?\.setHex\(finishColor\)/);
});
