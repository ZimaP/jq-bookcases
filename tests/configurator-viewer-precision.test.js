import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createArFrontProfileParts } from "../cabinet-ar-model.js";

const viewerSource = readFileSync(new URL("../configurator-3d.js", import.meta.url), "utf8");

function between(startMarker, endMarker) {
  const start = viewerSource.indexOf(startMarker);
  const end = viewerSource.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0, `Missing start marker: ${startMarker}`);
  assert.ok(end > start, `Missing end marker: ${endMarker}`);
  return viewerSource.slice(start, end);
}

function topLevelFunction(name) {
  const marker = `function ${name}(`;
  const start = viewerSource.indexOf(marker);
  assert.ok(start >= 0, `Missing function: ${name}`);
  const followingFunction = viewerSource.slice(start + marker.length).search(/\n(?:export\s+)?function\s+[A-Za-z_$][\w$]*\s*\(/);
  const end = followingFunction < 0
    ? viewerSource.length
    : start + marker.length + followingFunction;
  return viewerSource.slice(start, end);
}

function evaluatePureFunction(name) {
  const source = topLevelFunction(name);
  return Function(`"use strict"; ${source}; return ${name};`)();
}

test("section divider previews retain stable handle DOM", () => {
  const renderOverlay = between(
    "  renderSectionOverlay(layout, previewWidths = null) {",
    "  previewSectionDivider(dividerIndex, delta, result = null) {"
  );
  const previewDivider = between(
    "  previewSectionDivider(dividerIndex, delta, result = null) {",
    "  clearSectionDividerPreview() {"
  );

  const signatureIndex = renderOverlay.indexOf("const signature =");
  const signatureGuardIndex = renderOverlay.indexOf("signature !== this.sectionDesigner.overlaySignature");
  const innerHtmlIndex = renderOverlay.indexOf("this.sectionOverlay.innerHTML =");
  const signatureCommitIndex = renderOverlay.indexOf("this.sectionDesigner.overlaySignature = signature");

  assert.ok(signatureIndex >= 0, "Overlay rendering must derive a section signature.");
  assert.ok(signatureGuardIndex > signatureIndex, "DOM rebuilding must be guarded by the signature.");
  assert.ok(innerHtmlIndex > signatureGuardIndex, "The guarded branch may build the initial handle DOM.");
  assert.ok(signatureCommitIndex > innerHtmlIndex, "The rendered signature must be retained for later previews.");
  assert.match(renderOverlay, /querySelectorAll\("\[data-overlay-section\]"\)/);
  assert.match(renderOverlay, /value\.textContent\s*=/);

  assert.doesNotMatch(previewDivider, /innerHTML\s*=/, "Pointer previews cannot replace captured handles.");
  assert.match(previewDivider, /renderSectionOverlay\(canonicalLayout,\s*result\.widths\)/);
  assert.match(previewDivider, /querySelector\(`\[data-section-divider=/);
});

test("non-envelope hardware rebuilds preserve the exact camera pose", () => {
  const update = between(
    "  update(nextState, precomputedLayout = null, changedFields = null) {",
    "  resetSectionPreviewTransaction() {"
  );
  const preserveHelper = topLevelFunction("shouldPreserveExactCamera");

  const captureIndex = update.indexOf("const cameraSnapshot = hadModel ? this.getViewState() : null");
  const rebuildIndex = update.indexOf("this.rebuildModel(candidateState, precomputedLayout)");
  const preserveIndex = update.indexOf("shouldPreserveExactCamera(changes)");
  const restoreIndex = update.indexOf("this.restoreCameraState(cameraSnapshot, { preserveFrameMetrics: true })");

  assert.ok(captureIndex >= 0 && rebuildIndex > captureIndex, "Camera state must be captured before rebuilding.");
  assert.ok(preserveIndex > rebuildIndex && restoreIndex > preserveIndex, "A non-envelope rebuild must restore its captured pose.");
  for (const field of ["width", "height", "depth", "baseStyle", "crownStyle"]) {
    assert.match(preserveHelper, new RegExp(`[\"']${field}[\"']`), `${field} must be treated as envelope-affecting.`);
  }
  assert.doesNotMatch(preserveHelper, /["']hardware["']/, "Hardware is appearance-only and must not trigger reframing.");
  assert.match(preserveHelper, /changedFields/);
  assert.match(preserveHelper, /\.every\(/, "All changes must be checked against the envelope field set.");
});

test("measurements project layout coordinates through the active THREE camera", () => {
  const projection = between(
    "  projectLayoutPoint(layout, x, y, z, rootRect) {",
    "  applyPendingSectionPreview(now) {"
  );
  const overlayProjection = between(
    "  updateSectionOverlayProjection() {",
    "  projectLayoutPoint(layout, x, y, z, rootRect) {"
  );

  assert.match(projection, /new THREE\.Vector3\(/);
  assert.match(projection, /\.project\(this\.camera\)/);
  assert.match(projection, /rootRect\.width/);
  assert.match(projection, /rootRect\.height/);
  assert.match(overlayProjection, /root\.bounds\.min\.x/);
  assert.match(overlayProjection, /root\.bounds\.max\.x/);
  assert.match(overlayProjection, /this\.projectLayoutPoint\(/);
});

test("renderer pixel ratio is capped by total backing-buffer pixels", () => {
  const resize = between("  resize() {", "  update(nextState, precomputedLayout = null, changedFields = null) {");
  const resolver = topLevelFunction("resolveRendererPixelRatio");

  assert.match(resize, /resolveRendererPixelRatio\(width,\s*height,\s*window\.devicePixelRatio\s*\|\|\s*1\)/);
  assert.match(resolver, /Number\(width\)/);
  assert.match(resolver, /Number\(height\)/);
  assert.match(resolver, /cssPixels\s*=.*\*.*;/);
  assert.match(resolver, /Math\.sqrt\(/, "The DPR cap must be derived from a pixel-area budget.");
  assert.match(resolver, /MAX_[A-Z_]*PIXELS|pixelBudget|maximumPixels/i);
  assert.match(resolver, /Math\.min\(/);
});

test("drawer rendering consumes descriptor or config style and excludes glass", () => {
  const renderFront = between(
    "function renderDescriptorDoor(group, component, config, materials, size, position) {",
    "function renderDescriptorHandle(group, component, config, materials, size, position) {"
  );
  const resolveStyle = evaluatePureFunction("getRenderableFrontStyle");

  assert.match(renderFront, /getRenderableFrontStyle\(component, config\)/);
  assert.doesNotMatch(renderFront, /component\.role\s*===\s*["']drawer_front["']\s*\?\s*["']flat["']/);

  assert.equal(resolveStyle({ role: "drawer_front", metadata: { style: "slim_shaker" } }, { drawerFrontStyle: "flat" }), "slim_shaker");
  assert.equal(resolveStyle({ role: "drawer_front", metadata: {} }, { drawerFrontStyle: "flat" }), "flat");
  assert.equal(resolveStyle({ role: "drawer_front", metadata: { style: "glass" } }, { drawerFrontStyle: "glass" }), "shaker");
  assert.equal(resolveStyle({ role: "door", metadata: { style: "glass" } }, { doorStyle: "flat" }), "glass");
});

test("hardware appearance resolves canonical finish metadata for partial and rebuilt models", () => {
  const appearance = between(
    "function getHardwareAppearance(hardware) {",
    "function getHardwareShape(hardware) {"
  );
  const partialUpdate = between(
    "  applyHardwareMaterial(hardware) {",
    "  applyLightingWarmth(warmth) {"
  );
  const materials = between(
    "function createMaterials(baseColor, config) {",
    "function getHardwareAppearance(hardware) {"
  );

  assert.match(appearance, /getHardwareFinish\(hardware\)/);
  assert.match(appearance, /getHardwareFinishOption\(finish\)/);
  assert.match(appearance, /metadata\?\.materialColor/);
  assert.match(appearance, /metadata\?\.roughness/);
  assert.match(appearance, /metadata\?\.metalness/);
  assert.doesNotMatch(appearance, /startsWith\(|endsWith\(/);
  assert.match(partialUpdate, /getHardwareAppearance\(hardware\)/);
  assert.match(materials, /getHardwareAppearance\(config\.hardware\)/);
});

function frontComponent(role, style) {
  return { role, metadata: { style } };
}

function assertPartsFitEnvelope(parts, center, size) {
  assert.ok(parts.length > 0, "A front profile must emit geometry.");
  for (const part of parts) {
    assert.ok(["finish", "glass"].includes(part.material), `Unexpected front material: ${part.material}`);
    assert.equal(part.center.length, 3);
    assert.equal(part.size.length, 3);
    part.size.forEach((dimension) => assert.ok(Number.isFinite(dimension) && dimension > 0));
    for (let axis = 0; axis < 3; axis += 1) {
      const frontMinimum = center[axis] - size[axis] / 2;
      const frontMaximum = center[axis] + size[axis] / 2;
      const partMinimum = part.center[axis] - part.size[axis] / 2;
      const partMaximum = part.center[axis] + part.size[axis] / 2;
      assert.ok(partMinimum >= frontMinimum - 1e-9, `Part escaped the front on axis ${axis}.`);
      assert.ok(partMaximum <= frontMaximum + 1e-9, `Part escaped the front on axis ${axis}.`);
    }
  }
}

function horizontalRailThickness(parts, frontSize) {
  const rails = parts.filter((part) => (
    Math.abs(part.size[0] - frontSize[0]) < 1e-9
    && part.size[1] < frontSize[1] * 0.5
  ));
  assert.ok(rails.length >= 2, "A framed profile must emit top and bottom rails.");
  return Math.min(...rails.map((part) => part.size[1]));
}

test("AR door and drawer front profiles distinguish flat, Shaker, and slim Shaker geometry", () => {
  const center = [0.15, 0.4, -0.02];
  const size = [0.6, 0.32, 0.024];

  for (const role of ["door", "drawer_front"]) {
    const flat = createArFrontProfileParts(frontComponent(role, "flat"), center, size);
    const shaker = createArFrontProfileParts(frontComponent(role, "shaker"), center, size);
    const slim = createArFrontProfileParts(frontComponent(role, "slim_shaker"), center, size);

    assert.equal(flat.length, 1, `${role} flat fronts must remain a single slab.`);
    assert.ok(shaker.length > flat.length, `${role} Shaker fronts must include frame detail.`);
    assert.ok(slim.length > flat.length, `${role} slim Shaker fronts must include frame detail.`);
    assert.ok(horizontalRailThickness(slim, size) < horizontalRailThickness(shaker, size));
    assertPartsFitEnvelope(flat, center, size);
    assertPartsFitEnvelope(shaker, center, size);
    assertPartsFitEnvelope(slim, center, size);
  }
});

test("AR glass is door-only and short drawer profiles remain positive and clamped", () => {
  const center = [0, 0, 0];
  const standardSize = [0.52, 0.3, 0.02];
  const glassDoor = createArFrontProfileParts(frontComponent("door", "glass"), center, standardSize);
  const invalidGlassDrawer = createArFrontProfileParts(frontComponent("drawer_front", "glass"), center, standardSize);

  assert.ok(glassDoor.some((part) => part.material === "glass"), "Glass doors must contain a glass panel.");
  assert.ok(glassDoor.some((part) => part.material === "finish"), "Glass doors must retain a finished frame.");
  assert.ok(invalidGlassDrawer.length > 1, "An invalid glass drawer request must fall back to a framed profile.");
  assert.ok(invalidGlassDrawer.every((part) => part.material !== "glass"), "Drawer geometry can never contain glass.");

  const shortSize = [0.24, 0.012, 0.009];
  for (const style of ["shaker", "slim_shaker", "glass"]) {
    const role = style === "glass" ? "door" : "drawer_front";
    const parts = createArFrontProfileParts(frontComponent(role, style), center, shortSize);
    assertPartsFitEnvelope(parts, center, shortSize);
  }
});
