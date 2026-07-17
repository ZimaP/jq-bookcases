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

test("model rebuilds advance the active camera intent without replaying persistent UI selection", () => {
  const update = between(
    "  update(nextState, options = {}) {",
    "  renderDoorOptions() {"
  );
  const generationBranch = update.slice(update.indexOf("const nextCameraModelGeneration"));

  assert.match(generationBranch, /type: "model-change"/);
  assert.match(generationBranch, /targetValid: this\.isCameraIntentTargetValid\(\)/);
  assert.match(generationBranch, /preserveUserPose: shouldPreserveExactCamera\(changedFields\)/);
  assert.doesNotMatch(generationBranch, /type: "selection-change"/);
});

test("Preview fits the full model while every stage resolves a fresh camera intent", () => {
  const activation = between(
    "  activateWorkspaceStage(stageId, options = {}) {",
    "  snapshotDesignState() {"
  );
  const fit = between(
    "  fitFullModel(options = {}) {",
    "  focusSection(index, options = {}) {"
  );
  const resize = between(
    "  resize() {",
    "  update(nextState, precomputedLayout = null, changedFields = null) {"
  );

  assert.match(activation, /this\.cancelQueuedCameraIntent\(\)/);
  assert.match(activation, /this\.endOptionPreview\(null, \{ restore: true \}\)/);
  assert.match(activation, /this\.viewer\.cancelCameraTransition\?\.\(\)/);
  assert.match(activation, /this\.dispatchCameraIntent\(\{[\s\S]*type: "stage-change"[\s\S]*stage: stageId/);
  assert.doesNotMatch(activation, /previewCameraState|getViewState|restoreCameraState/);
  assert.match(fit, /new THREE\.Box3\(\)\.setFromObject\(this\.model\)/);
  assert.match(fit, /calculateBoundsCameraPose\(\{/);
  assert.match(fit, /fitMargin: 1\.12/);
  assert.match(fit, /const profileKey = \["finish", "preview", "lighting"\]\.includes\(options\.profileKey\)/);
  assert.match(fit, /this\.activeFocusKey = profileKey/);
  assert.match(fit, /this\.clearComponentHighlight\(\)/);
  assert.match(resize, /this\.onCameraInteraction\("viewport-change", \{ modelGeneration: this\.modelGeneration \}\)/);
});

test("changing sections dispatches a fresh section-context intent while preserving the manual angle", () => {
  const selection = between(
    "  selectSection(index, options = {}) {",
    "  commitSelectedSectionStorage(patch, successMessage) {"
  );
  const focus = between(
    "  focusSection(index, options = {}) {",
    "  zoom(direction) {"
  );
  const framing = between(
    "  frameModel(preserveZoom = true, transition = false) {",
    "  rebuildModel(nextState, precomputedLayout = null) {"
  );

  assert.match(selection, /previousSectionIndex/);
  assert.match(selection, /this\.selectedSectionIndex\s*!==\s*previousSectionIndex/);
  assert.match(selection, /this\.dispatchCameraIntent\(\{[\s\S]*type: "section-change"/);
  assert.match(selection, /sectionIndex: this\.selectedSectionIndex/);
  assert.match(focus, /focusVariant === this\.activeFocusVariant/);
  assert.match(focus, /new THREE\.Box3\(\)\.setFromObject\(this\.model\)/);
  assert.doesNotMatch(focus, /descriptorBoundsToSceneBox\(section\.bounds/);
  assert.match(focus, /const theta = options\.preserveAngles \? this\.theta : SMART_CAMERA_PROFILES\.overview\.theta/);
  assert.match(focus, /const phi = options\.preserveAngles \? this\.phi : SMART_CAMERA_PROFILES\.overview\.phi/);
  assert.match(focus, /resolveCollisionSafeRadius/);
  assert.match(focus, /calculateViewportAwareTarget/);
  assert.match(framing, /this\.activeFocusKey === "section"/);
  assert.match(framing, /this\.focusSection\(this\.sectionDesigner\.selectedIndex/);
  assert.equal(
    (viewerSource.match(/onSelect: \(index\) => this\.selectSection\(index, \{ render: false, ensureFramed: true \}\)/g) || []).length,
    3,
    "Every model-backed section selection hook must request section framing."
  );
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

test("cabinet surfaces use solid sprayed-paint materials without veneer maps", () => {
  const materials = between(
    "function createMaterials(baseColor, config) {",
    "function getHardwareAppearance(hardware) {"
  );

  for (const key of ["case", "side", "back", "inset"]) {
    assert.match(materials, new RegExp(`${key}: new THREE\\.MeshStandardMaterial\\(\\{ color: baseColor, roughness:`));
  }
  assert.doesNotMatch(materials, /createFinishTexture|\bmap:|bumpMap|normalMap|roughnessMap/);
  assert.match(materials, /JQ cabinetry is painted, not veneered/);
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

test("direct model picking covers generated product roles and ignores unrelated helpers", () => {
  const roles = between(
    "const DIRECT_EDITABLE_ROLES = new Set([",
    "const DIRECT_EDIT_KIND_BY_ROLE = Object.freeze({"
  );
  const kinds = between(
    "const DIRECT_EDIT_KIND_BY_ROLE = Object.freeze({",
    "let viewerInstanceSequence = 0;"
  );
  for (const role of [
    "light",
    "divider",
    "top_panel",
    "side_panel",
    "back_panel",
    "bottom_panel",
    "assembly"
  ]) {
    assert.match(roles, new RegExp(`['\"]${role}['\"]`), `${role} must be directly selectable.`);
  }
  assert.match(kinds, /light:\s*["']lighting["']/);
  assert.match(kinds, /divider:\s*["']divider["']/);
  for (const role of ["side_panel", "back_panel", "bottom_panel", "assembly"]) {
    assert.match(kinds, new RegExp(`${role}:\\s*[\"']body[\"']`));
  }

  const hitResolver = between("  resolveDirectHit(event) {", "  updateDirectEditHover(event) {");
  assert.match(hitResolver, /nonPhysicalHelper/);
  assert.match(hitResolver, /directEditHitProxy\s*===\s*true/);
  assert.match(hitResolver, /["']section["']/);
  assert.match(hitResolver, /["']back_panel["']/);

  const proxy = topLevelFunction("addDirectEditHitProxy");
  assert.match(proxy, /["']divider["']/);
  assert.match(proxy, /["']light["']/);
  assert.match(proxy, /nonPhysicalHelper:\s*true/);
  assert.match(proxy, /directEditHitProxy:\s*true/);
});

test("canvas selection carries pointer coordinates and reports a blank click", () => {
  const payload = between(
    "  getDirectSelectionPayload(componentId, source = \"canvas\", pointer = null) {",
    "  resolveDirectHit(event) {"
  );
  const pointerSelection = between(
    "  selectDirectComponentFromPointer(event) {",
    "  selectDirectComponent(componentId, options = {}) {"
  );
  const clearSelection = between(
    "  clearDirectSelection(options = {}) {",
    "  clearDirectHighlightGroup() {"
  );

  assert.match(payload, /anchorClientX/);
  assert.match(payload, /anchorClientY/);
  assert.match(pointerSelection, /clientX:\s*event\.clientX/);
  assert.match(pointerSelection, /clientY:\s*event\.clientY/);
  assert.match(pointerSelection, /clearDirectSelection\(\{ notifySelect: true \}\)/);
  assert.match(clearSelection, /onSelect\?\.\(null\)/);
});

test("accepted layouts reconcile selection while rejected candidates leave accepted audit state untouched", () => {
  const partial = between(
    "  applyHardwareDescriptorLayout(nextLayout, nextState) {",
    "  applyLightingWarmth(warmth) {"
  );
  const rebuild = between(
    "  rebuildModel(nextState, precomputedLayout = null) {",
    "  updateConstructionInspector(layout) {"
  );

  assert.match(partial, /const previousLayout = this\.lastLayout/);
  assert.match(partial, /this\.reconcileDirectSelection\(previousLayout, nextLayout,/);
  assert.match(partial, /resolveDirectSelectionForLayout/);
  assert.match(partial, /metadata\?\.boundaryIndex/);
  assert.match(partial, /component\.hostId === previous\.hostId/);

  const rejectionIndex = rebuild.indexOf("if (!layoutValid || !renderValid)");
  const layoutCommitIndex = rebuild.indexOf("this.lastLayout = candidateLayout");
  const auditCommitIndex = rebuild.indexOf("this.lastRenderAudit = candidateRenderAudit");
  assert.ok(rejectionIndex >= 0);
  assert.ok(layoutCommitIndex > rejectionIndex, "Accepted layout metadata must commit after validation.");
  assert.ok(auditCommitIndex > rejectionIndex, "Accepted render audit must commit after validation.");
  assert.doesNotMatch(rebuild.slice(0, rejectionIndex), /this\.lastLayout\s*=/);
  assert.doesNotMatch(rebuild.slice(0, rejectionIndex), /this\.lastRenderAudit\s*=/);
  assert.match(rebuild, /this\.lastRejectedRenderAudit = candidateRenderAudit/);
  assert.match(rebuild, /this\.reconcileDirectSelection\(previousLayout, candidateLayout,/);
  assert.match(partial, /queueMicrotask/);
});

test("selection remapping prefers stable semantic targets and clears deleted sections", () => {
  const method = between(
    "  resolveDirectSelectionForLayout(componentId, previousLayout, nextLayout) {",
    "  reconcileDirectSelection(previousLayout, nextLayout, options = {}) {"
  ).trim();
  const directRoles = new Set([
    "assembly", "section", "shelf", "door", "handle", "light", "divider",
    "base", "trim", "crown", "top_panel", "side_panel", "back_panel", "bottom_panel"
  ]);
  const getDescriptorSectionId = (layout, component) => {
    const index = new Map((layout?.components || []).map((item) => [item.id, item]));
    const visited = new Set();
    let current = component;
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      if (current.role === "section") return current.id;
      current = index.get(current.parentId || current.hostId) || null;
    }
    return null;
  };
  const resolve = Function(
    "DIRECT_EDITABLE_ROLES",
    "getDescriptorSectionId",
    `"use strict"; function ${method} return resolveDirectSelectionForLayout;`
  )(directRoles, getDescriptorSectionId);

  const sharedPrevious = [
    { id: "bookcase", role: "assembly" },
    { id: "section-01", role: "section", hostId: "bookcase", metadata: { index: 0 } },
    { id: "section-03", role: "section", hostId: "bookcase", metadata: { index: 2 } },
    { id: "opening-01", role: "opening", parentId: "section-01", hostId: "section-01" },
    { id: "door-01", role: "door", parentId: "opening-01", hostId: "opening-01" },
    { id: "handle-old", role: "handle", parentId: "door-01", hostId: "door-01" },
    { id: "shelf-01", role: "shelf", parentId: "section-01", hostId: "section-01" },
    { id: "light-old", role: "light", parentId: "section-01", hostId: "shelf-01" },
    { id: "crown-old", role: "crown", parentId: "bookcase", hostId: "bookcase" },
    { id: "divider-old", role: "divider", parentId: "bookcase", hostId: "bookcase", metadata: { boundaryIndex: 1 } }
  ];
  const next = {
    components: [
      { id: "bookcase", role: "assembly" },
      { id: "section-01", role: "section", hostId: "bookcase", metadata: { index: 0 } },
      { id: "opening-01", role: "opening", parentId: "section-01", hostId: "section-01" },
      { id: "door-01", role: "door", parentId: "opening-01", hostId: "opening-01" },
      { id: "shelf-01", role: "shelf", parentId: "section-01", hostId: "section-01" },
      { id: "light-new", role: "light", parentId: "section-01", hostId: "top-panel" },
      { id: "crown-new", role: "crown", parentId: "bookcase", hostId: "bookcase" },
      { id: "divider-new", role: "divider", parentId: "bookcase", hostId: "bookcase", metadata: { boundaryIndex: 1 } }
    ]
  };
  const previous = { components: sharedPrevious };

  assert.equal(resolve("handle-old", previous, next), "door-01");
  assert.equal(resolve("light-old", previous, next), "light-new");
  assert.equal(resolve("crown-old", previous, next), "crown-new");
  assert.equal(resolve("divider-old", previous, next), "divider-new");
  assert.equal(resolve("section-03", previous, next), null);
});

test("safe viewport data exposes local and client-space bounds for contextual UI", () => {
  const safeViewport = between("  getSafeViewport() {", "  focus(profileKey = \"overview\", options = {}) {");
  assert.match(safeViewport, /localBounds/);
  assert.match(safeViewport, /clientBounds/);
  assert.match(safeViewport, /rootRect\.left \+ localBounds\.left/);
  assert.match(safeViewport, /rootRect\.top \+ localBounds\.top/);
  assert.match(safeViewport, /Object\.freeze\(\{ \.\.\.insets \}\)/);
});
