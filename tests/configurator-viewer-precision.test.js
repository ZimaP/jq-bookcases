import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createArFrontProfileParts,
  createArHandleGeometryParts
} from "../cabinet-ar-model.js";
import { inchesToMeters } from "../cabinet-ar.js";
import {
  defaultBookcaseConfig,
  normalizeBookcaseConfig
} from "../bookcase-config.js";
import {
  generateBookcaseLayout,
  getFrontProfileDefinition,
  resolveFrontProfileGeometry
} from "../bookcase-layout.js";

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

function frontComponent(role, style, options = {}) {
  const width = options.width ?? 24;
  const height = options.height ?? 30;
  const depth = options.depth ?? 0.75;
  const x = options.x ?? 0;
  const minY = options.minY ?? 0;
  const frontPlaneZ = options.frontPlaneZ ?? 0;
  const component = {
    id: options.id || `${role}-${style}`,
    role,
    bounds: {
      min: { x: x - width / 2, y: minY, z: frontPlaneZ },
      max: { x: x + width / 2, y: minY + height, z: frontPlaneZ + depth }
    },
    size: { x: width, y: height, z: depth },
    position: { x, y: minY + height / 2, z: frontPlaneZ + depth / 2 },
    metadata: {
      style,
      mounting: frontPlaneZ < 0 ? "overlay" : "inset",
      frontPlaneZ,
      backPlaneZ: frontPlaneZ + depth
    }
  };
  component.metadata.profileGeometry = resolveFrontProfileGeometry(
    component,
    getFrontProfileDefinition(style)
  );
  return component;
}

function componentArInput(component, cabinetDepthInches = 15) {
  return {
    center: [
      component.position.x * 0.0254,
      component.position.y * 0.0254,
      cabinetDepthInches * 0.0254 / 2 - component.position.z * 0.0254
    ],
    size: [component.size.x, component.size.y, component.size.z].map(inchesToMeters)
  };
}

function frontParts(component, cabinetDepthInches = 15) {
  const input = componentArInput(component, cabinetDepthInches);
  return { ...input, parts: createArFrontProfileParts(component, input.center, input.size) };
}

function assertPartsFitEnvelope(parts, center, size, allowedMaterials = ["finish", "glass"]) {
  assert.ok(parts.length > 0, "A front profile must emit geometry.");
  for (const part of parts) {
    assert.ok(allowedMaterials.includes(part.material), `Unexpected material: ${part.material}`);
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

function horizontalRailThickness(parts) {
  const rails = parts.filter((part) => ["top_rail", "bottom_rail"].includes(part.kind));
  assert.ok(rails.length >= 2, "A framed profile must emit top and bottom rails.");
  return Math.min(...rails.map((part) => part.size[1]));
}

test("AR door and drawer profiles consume stable descriptor frame widths in inches", () => {
  for (const role of ["door", "drawer_front"]) {
    const flatInput = frontParts(frontComponent(role, "flat"));
    const shakerInput = frontParts(frontComponent(role, "shaker"));
    const slimInput = frontParts(frontComponent(role, "slim_shaker"));
    const wideShaker = frontParts(frontComponent(role, "shaker", { width: 40, height: 42 }));

    assert.equal(flatInput.parts.length, 1, `${role} flat fronts must remain a single slab.`);
    assert.ok(shakerInput.parts.length > flatInput.parts.length, `${role} Shaker fronts must include frame detail.`);
    assert.ok(slimInput.parts.length > flatInput.parts.length, `${role} slim Shaker fronts must include frame detail.`);
    assert.equal(horizontalRailThickness(shakerInput.parts), inchesToMeters(2.25));
    assert.equal(horizontalRailThickness(wideShaker.parts), inchesToMeters(2.25));
    assert.equal(horizontalRailThickness(slimInput.parts), inchesToMeters(1.25));
    assert.ok(horizontalRailThickness(slimInput.parts) < horizontalRailThickness(shakerInput.parts));
    for (const input of [flatInput, shakerInput, slimInput, wideShaker]) {
      assertPartsFitEnvelope(input.parts, input.center, input.size);
    }
  }
});

test("AR glass uses the exact descriptor field and short drawers use the clamped profile", () => {
  const glassComponent = frontComponent("door", "glass", { width: 24, height: 30 });
  const glassInput = frontParts(glassComponent);
  const glassPart = glassInput.parts.find((part) => part.material === "glass");
  const field = glassComponent.metadata.profileGeometry.fieldRegion;
  assert.ok(glassPart, "Glass doors must contain a glass center field.");
  assert.equal(glassPart.size[0], inchesToMeters(field.bounds.max.x - field.bounds.min.x));
  assert.equal(glassPart.size[1], inchesToMeters(field.bounds.max.y - field.bounds.min.y));
  assert.ok(glassPart.size[0] < glassInput.size[0] && glassPart.size[1] < glassInput.size[1]);
  assert.equal(glassInput.parts.filter((part) => part.material === "finish").length, 4);
  assertPartsFitEnvelope(glassInput.parts, glassInput.center, glassInput.size);

  const invalidGlassDrawer = frontParts(frontComponent("drawer_front", "glass"));
  assert.ok(invalidGlassDrawer.parts.length > 1, "An invalid glass drawer fixture remains framed.");
  assert.ok(invalidGlassDrawer.parts.every((part) => part.material !== "glass"), "Drawer geometry can never contain glass.");

  const shortDrawer = frontComponent("drawer_front", "shaker", { width: 12, height: 4 });
  const shortInput = frontParts(shortDrawer);
  assert.equal(
    horizontalRailThickness(shortInput.parts),
    inchesToMeters(shortDrawer.metadata.profileGeometry.frameWidth)
  );
  assert.equal(shortDrawer.metadata.profileGeometry.correction, "PROFILE_FRAME_WIDTH_REDUCED");
  assertPartsFitEnvelope(shortInput.parts, shortInput.center, shortInput.size);
});

test("AR front depth follows semantic visible-front and panel-recess planes for inset and overlay", () => {
  for (const frontPlaneZ of [0, -0.75]) {
    const component = frontComponent("door", "shaker", { frontPlaneZ });
    const input = frontParts(component);
    const visibleFrontSceneZ = inchesToMeters(15) / 2 - frontPlaneZ * 0.0254;
    const frameParts = input.parts.filter((part) => part.kind !== "inset_panel");
    const panel = input.parts.find((part) => part.kind === "inset_panel");
    assert.ok(frameParts.length === 4 && panel);
    frameParts.forEach((part) => {
      assert.ok(Math.abs(part.center[2] + part.size[2] / 2 - visibleFrontSceneZ) < 1e-9);
    });
    assert.ok(Math.abs(
      panel.center[2] + panel.size[2] / 2
      - (visibleFrontSceneZ - inchesToMeters(component.metadata.profileGeometry.panelRecess))
    ) < 1e-9);
    assertPartsFitEnvelope(input.parts, input.center, input.size);
  }
});

function firstHandleFor(hardware, overrides = {}) {
  const config = normalizeBookcaseConfig({
    ...defaultBookcaseConfig,
    width: 72,
    sections: 3,
    lighting: "no_lighting",
    hardware,
    ...overrides
  });
  const layout = generateBookcaseLayout(config);
  assert.equal(layout.validation.valid, true, JSON.stringify(layout.validation.errors));
  const handle = layout.components.find((component) => component.role === "handle");
  assert.ok(handle);
  return { config, layout, handle, input: componentArInput(handle, config.depth) };
}

function partSignature(parts) {
  return parts.map(({ kind, shape, axis, center, size }) => ({ kind, shape, axis, center, size }));
}

test("AR knobs and pulls use descriptor hardware metadata and remain inside their envelopes", () => {
  const knob = firstHandleFor("brass_knob");
  const knobParts = createArHandleGeometryParts(knob.handle, knob.input.center, knob.input.size);
  assert.deepEqual(knobParts.map((part) => part.kind), ["knob_cap", "knob_stem"]);
  assert.equal(knobParts[0].shape, "ellipsoid");
  assertPartsFitEnvelope(knobParts, knob.input.center, knob.input.size, ["hardware"]);

  const pull = firstHandleFor("brass_pull");
  const pullParts = createArHandleGeometryParts(pull.handle, pull.input.center, pull.input.size);
  assert.equal(pull.handle.metadata.orientation, "vertical");
  assert.deepEqual(pullParts.map((part) => part.kind), ["pull_bar", "pull_standoff", "pull_standoff"]);
  assert.equal(pullParts[0].axis, "y");
  assert.equal(pullParts[0].size[1], inchesToMeters(pull.handle.metadata.nominalLength));
  assertPartsFitEnvelope(pullParts, pull.input.center, pull.input.size, ["hardware"]);

  const otherFinish = firstHandleFor("matte_black_pull");
  const otherParts = createArHandleGeometryParts(otherFinish.handle, otherFinish.input.center, otherFinish.input.size);
  assert.deepEqual(partSignature(otherParts), partSignature(pullParts));
  assert.notDeepEqual(partSignature(knobParts), partSignature(pullParts));
});

test("AR drawer pulls stay horizontal and paired door pulls mirror their descriptor centers", () => {
  const drawer = firstHandleFor("brass_pull", {
    width: 48,
    sections: 2,
    lowerStorage: "drawers",
    layoutMetadata: {
      sectionRatios: [1, 1],
      sectionTypes: ["drawers", "drawers"]
    }
  });
  const drawerParts = createArHandleGeometryParts(drawer.handle, drawer.input.center, drawer.input.size);
  assert.equal(drawer.handle.metadata.orientation, "horizontal");
  assert.equal(drawerParts[0].axis, "x");
  assertPartsFitEnvelope(drawerParts, drawer.input.center, drawer.input.size, ["hardware"]);

  const pairConfig = normalizeBookcaseConfig({
    ...defaultBookcaseConfig,
    width: 48,
    sections: 1,
    hardware: "brass_pull",
    layoutMetadata: {
      sectionRatios: [1],
      sectionTypes: ["lower_doors"],
      sectionDoorLayouts: [{ arrangement: "pair" }]
    }
  });
  const pairLayout = generateBookcaseLayout(pairConfig);
  assert.equal(pairLayout.validation.valid, true, JSON.stringify(pairLayout.validation.errors));
  const handles = pairLayout.components.filter((component) => component.role === "handle");
  assert.equal(handles.length, 2);
  assert.ok(Math.abs(handles[0].position.x + handles[1].position.x) < 1e-9);
  for (const handle of handles) {
    const input = componentArInput(handle, pairConfig.depth);
    const parts = createArHandleGeometryParts(handle, input.center, input.size);
    assertPartsFitEnvelope(parts, input.center, input.size, ["hardware"]);
  }
});
