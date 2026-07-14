import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../configurator-3d.js", import.meta.url), "utf8");

function block(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0, `Missing start marker: ${startMarker}`);
  assert.ok(end > start, `Missing end marker: ${endMarker}`);
  return source.slice(start, end);
}

test("configurator imports and applies the pure render contract", () => {
  assert.match(source, /createExpectedRenderManifest/);
  assert.match(source, /validateRenderedManifest/);
  assert.match(source, /bookcase-render-contract\.js/);

  const modelBuilder = block(
    "function buildBookcaseModel(state, precomputedLayout = null) {",
    "function renderLayoutComponent("
  );
  assert.match(modelBuilder, /collectRenderedComponentRecords/);
  assert.match(modelBuilder, /validateRenderedManifest\(layout, renderRecords\)/);
  assert.match(modelBuilder, /group\.userData\.renderAudit/);
});

test("renderer acceptance happens before accepted UI state is committed", () => {
  const update = block(
    "  update(nextState, options = {}) {",
    "  renderDoorOptions() {"
  );
  const renderIndex = update.indexOf("this.viewer.update(state, evaluation.layout)");
  const commitIndex = update.indexOf("this.acceptedEvaluation = committedEvaluation");

  assert.ok(renderIndex >= 0, "The candidate must be rendered before commit.");
  assert.ok(commitIndex > renderIndex, "Accepted state cannot commit before renderer validation.");
  assert.match(update, /if \(rendered === false\)/);
  assert.match(update, /kept the last verified model/);
});

test("viewer swaps models only after layout and render audits pass", () => {
  const rebuild = block(
    "  rebuildModel(nextState, precomputedLayout = null) {",
    "  updateCamera() {"
  );
  const validationIndex = rebuild.indexOf("if (!layoutValid || !renderValid)");
  const swapIndex = rebuild.indexOf("this.model = nextModel");

  assert.ok(validationIndex >= 0);
  assert.ok(swapIndex > validationIndex);
  assert.match(rebuild, /disposeObject\(nextModel\)/);
  assert.match(rebuild, /this\.root\.dataset\.renderValid = "true"/);
});

test("active physical renderer consumes descriptor dimensions without base, crown, or shelf recalc", () => {
  const renderer = block(
    "function renderLayoutComponent(",
    "function getLayoutMaterial("
  );

  assert.match(renderer, /inchesToUnits\(component\.size\.x\)/);
  assert.match(renderer, /inchesToUnits\(component\.position\.x\)/);
  assert.doesNotMatch(renderer, /renderLayoutBase/);
  assert.doesNotMatch(renderer, /renderLayoutCrown/);
  assert.doesNotMatch(renderer, /addShelf/);
  assert.doesNotMatch(renderer, /config\.baseStyle/);
  assert.doesNotMatch(renderer, /config\.crownStyle/);
  assert.match(renderer, /addBox\(componentGroup, size, position, material/);
});

test("front profile rendering derives scene depth from semantic mounting planes", () => {
  const frontRenderer = block(
    "function renderDescriptorDoor(",
    "function renderDescriptorHandle("
  );
  assert.match(frontRenderer, /resolveRenderedFrontSemantics\(component, z, depth\)/);
  assert.match(frontRenderer, /component\.metadata\?\.frontPlaneZ/);
  assert.match(frontRenderer, /component\.metadata\?\.backPlaneZ/);
  assert.match(frontRenderer, /component\.metadata\?\.mounting/);
  assert.match(frontRenderer, /inwardDirection/);
  assert.doesNotMatch(frontRenderer, /const visibleFrontZ = z \+ depth \/ 2/);
});

test("physical child groups are excluded from parent render-bound records", () => {
  const collector = block(
    "function collectOwnedMeshRecord(componentGroup, componentId) {",
    "function createContactShadowTexture("
  );
  assert.match(collector, /object !== componentGroup && object\.userData\?\.componentId/);
  assert.match(collector, /object\.geometry\.boundingBox\.clone\(\)\.applyMatrix4\(object\.matrixWorld\)/);
});

test("WebGL fallback accepts validated state without creating split-state behavior", () => {
  const fallback = block(
    "  createViewerFallback() {",
    "  render() {"
  );
  assert.match(fallback, /update: \(\) => true/);
  assert.match(fallback, /lastRenderAudit: \{ valid: true, issues: \[\] \}/);
});
