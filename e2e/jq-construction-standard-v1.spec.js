import { expect, test } from "@playwright/test";

import { CONSTRUCTION_PROFILE_IDS, defaultBookcaseConfig, layoutPresets } from "../bookcase-config.js";
import { CONSTRUCTION_RULES } from "../bookcase-layout.js";

const artifactDirectory = "test-results/jq-construction-standard-v1";
const requiredViewports = [
  { width: 1440, height: 900 },
  { width: 1536, height: 1024 },
  { width: 1920, height: 1080 },
  { width: 3840, height: 2160 },
  { width: 1180, height: 820 },
  { width: 1024, height: 900 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 360, height: 800 }
];

function monitorRuntime(page) {
  const errors = [];
  const webglWarnings = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    const entry = `${message.type()}: ${message.text()}`;
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
    const screenshotReadbackNotice = /GL Driver Message.*GPU stall due to ReadPixels/i.test(message.text());
    if (/webgl/i.test(message.text())
      && ["error", "warning"].includes(message.type())
      && !screenshotReadbackNotice) {
      webglWarnings.push(entry);
    }
  });
  page.on("requestfailed", (request) => {
    errors.push(`requestfailed: ${request.method()} ${request.url()} (${request.failure()?.errorText || "unknown"})`);
  });
  return { errors, webglWarnings };
}

async function settleFrames(page, count = 3) {
  await page.evaluate(async (frameCount) => {
    for (let index = 0; index < frameCount; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }, count);
}

async function waitForCamera(page) {
  await expect.poll(() => page.locator("[data-bookcase-builder]").evaluate((host) => (
    Boolean(host.__bookcaseConfigurator?.viewer?.getDiagnostics?.().cameraTransitionActive)
  ))).toBe(false);
  await settleFrames(page);
}

async function openConstructionQa(page) {
  await page.goto("/configurator.html?preset=lower-cabinets&constructionDebug=1", { waitUntil: "networkidle" });
  const viewer = page.locator("[data-3d-viewer]");
  await expect(viewer).toBeVisible();
  await expect(viewer).toHaveAttribute("data-render-valid", "true", { timeout: 20_000 });
  await expect(viewer.locator("canvas")).toHaveCount(1);
  await expect(page.locator("[data-construction-inspector]")).toBeVisible();

  for (const key of ["planes", "bounds", "toe"]) {
    const toggle = page.locator(`[data-construction-debug="${key}"]`);
    await toggle.evaluate((input) => {
      if (!input.checked) return;
      input.checked = false;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }
  await page.locator("[data-construction-inspector]").evaluate((element) => {
    element.hidden = true;
  });
  await settleFrames(page);
  return viewer;
}

async function applyScenario(page, config) {
  const accepted = await page.locator("[data-bookcase-builder]").evaluate((host, nextConfig) => {
    return host.__bookcaseConfigurator.update(nextConfig, {
      silent: true,
      sourceField: "constructionQa"
    });
  }, config);
  expect(accepted).toBe(true);
  const viewer = page.locator("[data-3d-viewer]");
  await expect(viewer).toHaveAttribute("data-render-valid", "true");
  await expect(viewer.locator("canvas")).toHaveCount(1);
  await waitForCamera(page);
  const state = await readConstructionState(page);
  expect(state.validation.valid).toBe(true);
  expect(state.renderAudit.valid).toBe(true);
  expect(state.renderAudit.renderedCount).toBe(state.renderAudit.expectedCount);
  expect(state.canvasCount).toBe(1);
  expect(state.webgl.geometries).toBeGreaterThan(0);
  expect(state.webgl.calls).toBeGreaterThan(0);
  expect(state.webgl.triangles).toBeGreaterThan(0);
  return state;
}

async function readConstructionState(page) {
  return page.locator("[data-bookcase-builder]").evaluate((host) => {
    const controller = host.__bookcaseConfigurator;
    const layout = controller.layout;
    const viewer = controller.viewer.getDiagnostics();
    return {
      state: structuredClone(controller.state),
      layoutConfig: structuredClone(layout.config),
      referencePlanes: structuredClone(layout.metrics.referencePlanes),
      metrics: {
        generatedDoorCount: layout.metrics.generatedDoorCount,
        nominalBounds: structuredClone(layout.metrics.nominalBounds),
        decorativeBounds: structuredClone(layout.metrics.decorativeBounds)
      },
      validation: structuredClone(layout.validation),
      components: layout.components.map((component) => ({
        id: component.id,
        role: component.role,
        parentId: component.parentId,
        hostId: component.hostId,
        size: structuredClone(component.size),
        position: structuredClone(component.position),
        bounds: structuredClone(component.bounds),
        metadata: structuredClone(component.metadata || {})
      })),
      price: controller.price,
      activeView: controller.activeView,
      view: structuredClone(controller.viewer.getViewState()),
      viewerInstanceId: viewer.instanceId,
      canvasCount: host.querySelectorAll("[data-3d-viewer] canvas").length,
      canvasIdentity: host.querySelector("[data-3d-viewer] canvas")?.dataset.constructionQaIdentity || "",
      renderAudit: structuredClone(viewer.renderAudit),
      webgl: structuredClone(viewer.webgl),
      constructionDebug: structuredClone(viewer.constructionDebug)
    };
  });
}

async function setView(page, view) {
  if (view !== "reset") {
    await page.locator("[data-bookcase-builder]").evaluate((host) => {
      host.__bookcaseConfigurator.setView("reset");
    });
    await waitForCamera(page);
  }
  await page.locator("[data-bookcase-builder]").evaluate((host, nextView) => {
    host.__bookcaseConfigurator.setView(nextView);
  }, view);
  await waitForCamera(page);
}

async function focusDetail(page, profile) {
  await page.locator("[data-bookcase-builder]").evaluate((host, nextProfile) => {
    host.__bookcaseConfigurator.viewer.focus(nextProfile, { force: true, duration: 0 });
    host.__bookcaseConfigurator.activeView = "custom";
  }, profile);
  await waitForCamera(page);
}

async function focusBaseInspection(page, theta) {
  await focusDetail(page, "base");
  await page.locator("[data-bookcase-builder]").evaluate((host, angle) => {
    const controller = host.__bookcaseConfigurator;
    controller.viewer.theta = angle;
    controller.viewer.phi = 0.08;
    controller.viewer.updateCamera();
    controller.activeView = "custom";
  }, theta);
  await settleFrames(page);
}

async function focusFurnitureBaseFront(page) {
  await page.locator("[data-bookcase-builder]").evaluate((host) => {
    const controller = host.__bookcaseConfigurator;
    const viewer = controller.viewer;
    viewer.cancelCameraTransition();
    viewer.theta = 0;
    viewer.phi = 0.05;
    viewer.radius = Math.max(12, (controller.state.width / 12) * 1.8);
    viewer.target.set(0, controller.layout.metrics.baseHeight / 24, 0);
    viewer.activeFocusKey = "base";
    viewer.activeFocusVariant = "base:full-front";
    viewer.updateCamera();
    controller.activeView = "custom";
  });
  await settleFrames(page);
}

async function captureViewer(viewer, basename) {
  await viewer.screenshot({
    path: `${artifactDirectory}/${basename}.png`,
    animations: "disabled"
  });
}

function byRole(state, role) {
  return state.components.filter((component) => component.role === role);
}

function findComponent(state, id) {
  return state.components.find((component) => component.id === id);
}

function positiveIntersection(left, right, epsilon = 1e-6) {
  return ["x", "y", "z"].every((axis) => (
    Math.min(left.max[axis], right.max[axis]) - Math.max(left.min[axis], right.min[axis]) > epsilon
  ));
}

function pointInRegion(point, region, epsilon = 1e-6) {
  return point.x >= region.bounds.min.x - epsilon
    && point.x <= region.bounds.max.x + epsilon
    && point.y >= region.bounds.min.y - epsilon
    && point.y <= region.bounds.max.y + epsilon;
}

function expectCameraPreserved(actual, expected) {
  for (const key of ["theta", "phi", "radius", "environmentScale", "exposure"]) {
    expect(actual[key]).toBeCloseTo(expected[key], 12);
  }
  expect(actual.focus).toBe(expected.focus);
  expect(actual.focusVariant).toBe(expected.focusVariant);
  for (const group of ["target", "position"]) {
    for (const axis of ["x", "y", "z"]) {
      expect(actual[group][axis]).toBeCloseTo(expected[group][axis], 12);
    }
  }
}

function oneSectionConfig(overrides = {}) {
  return {
    ...defaultBookcaseConfig,
    layoutPreset: "custom",
    width: 24,
    height: 96,
    depth: 15,
    sections: 1,
    constructionProfile: CONSTRUCTION_PROFILE_IDS.inset,
    lowerCabinets: true,
    lowerStorage: "doors",
    tallDoors: false,
    crownStyle: "none",
    lighting: "no_lighting",
    layoutMetadata: {
      sectionRatios: [1],
      sectionTypes: ["lower_doors"],
      sectionDoorLayouts: [{ arrangement: "auto" }]
    },
    ...overrides
  };
}

test("JQ Construction Standard V1 renders buildable assemblies across scenarios and viewports", async ({ page }) => {
  test.setTimeout(180_000);
  const runtime = monitorRuntime(page);
  let viewer = await openConstructionQa(page);
  await viewer.evaluate((element) => {
    element.querySelector("canvas").dataset.constructionQaIdentity = "jq-construction-standard-v1-canvas";
  });

  const toeConfig = {
    ...defaultBookcaseConfig,
    width: 96,
    height: 96,
    depth: 15,
    constructionProfile: CONSTRUCTION_PROFILE_IDS.inset,
    baseStyle: "toe_kick",
    crownStyle: "none"
  };
  let state = await applyScenario(page, toeConfig);
  const toeVoid = findComponent(state, "base-toe-kick-void");
  const toePlate = findComponent(state, "base-toe-kick-plate");
  const toeBase = findComponent(state, "base");
  expect(toeVoid.metadata.kind).toBe("toe_kick_void");
  expect(toeVoid.size.y).toBe(CONSTRUCTION_RULES.recessedToeKickHeight);
  expect(toeVoid.size.z).toBe(CONSTRUCTION_RULES.recessedToeKickDepth);
  expect(toePlate.bounds.min.z).toBe(CONSTRUCTION_RULES.recessedToeKickDepth);
  expect(toeBase.bounds.min.z).toBeGreaterThanOrEqual(toePlate.bounds.max.z);
  expect(findComponent(state, "base-toe-shadow")).toBeUndefined();
  expect(["base-toe-return-left", "base-toe-return-right"].map((id) => findComponent(state, id).bounds.min.y)).toEqual([0, 0]);
  const toeVoidOccupants = state.components.filter((component) => (
    !["assembly", "section", "section_group", "opening"].includes(component.role)
      && positiveIntersection(component.bounds, toeVoid.bounds)
  ));
  expect(toeVoidOccupants).toEqual([]);
  expect(state.constructionDebug.profile).toBe(CONSTRUCTION_PROFILE_IDS.inset);
  expect(state.constructionDebug.referencePlanes.toeKickPlatePlaneZ).toBe(CONSTRUCTION_RULES.recessedToeKickDepth);
  await setView(page, "front");
  await captureViewer(viewer, "engine-toe-kick-front");
  await setView(page, "three-quarter");
  await captureViewer(viewer, "engine-toe-kick-three-quarter");
  await focusBaseInspection(page, Math.PI / 2 - 0.28);
  await captureViewer(viewer, "engine-toe-kick-side");

  state = await applyScenario(page, { ...toeConfig, baseStyle: "plinth" });
  const plinth = findComponent(state, "base");
  expect(plinth.metadata.purpose).toBe("flush_plinth");
  expect(plinth.bounds.min.x).toBe(state.referencePlanes.outerLeftPlaneX);
  expect(plinth.bounds.max.x).toBe(state.referencePlanes.outerRightPlaneX);
  expect(plinth.bounds.min.z).toBe(state.referencePlanes.finishedFrontPlaneZ);
  expect(plinth.bounds.min.y).toBe(state.referencePlanes.floorPlaneY);
  expect(findComponent(state, "base-plinth-cap")).toBeUndefined();
  await focusDetail(page, "base");
  await captureViewer(viewer, "engine-flush-plinth");

  state = await applyScenario(page, { ...toeConfig, baseStyle: "furniture_base" });
  const furnitureFeet = byRole(state, "trim").filter((component) => component.metadata.purpose === "front_foot");
  const apron = findComponent(state, "base-furniture-apron");
  expect(furnitureFeet).toHaveLength(2);
  expect(furnitureFeet.map((foot) => foot.size.z)).toEqual([
    CONSTRUCTION_RULES.furnitureFootDepth,
    CONSTRUCTION_RULES.furnitureFootDepth
  ]);
  expect(furnitureFeet.every((foot) => foot.size.z < state.layoutConfig.depth)).toBe(true);
  expect(furnitureFeet[0].bounds.min.x).toBeCloseTo(-furnitureFeet[1].bounds.max.x, 12);
  expect(furnitureFeet[0].bounds.max.x).toBeCloseTo(-furnitureFeet[1].bounds.min.x, 12);
  expect(apron.bounds.min.x).toBe(furnitureFeet[0].bounds.max.x);
  expect(apron.bounds.max.x).toBe(furnitureFeet[1].bounds.min.x);
  await focusFurnitureBaseFront(page);
  await captureViewer(viewer, "engine-furniture-base-front");
  await focusBaseInspection(page, Math.PI / 2 - 0.28);
  await captureViewer(viewer, "engine-furniture-base-side");

  const autoSingleConfig = oneSectionConfig();
  state = await applyScenario(page, autoSingleConfig);
  let doors = byRole(state, "door");
  let handles = byRole(state, "handle");
  expect(doors).toHaveLength(1);
  expect(handles).toHaveLength(1);
  expect(doors[0].metadata.requestedArrangement).toBe("auto");
  expect(doors[0].metadata.arrangement).toBe("single_hinge_left");
  expect(doors[0].metadata.mounting).toBe("inset");
  expect(doors[0].bounds.min.z).toBe(state.referencePlanes.finishedFrontPlaneZ);
  expect(doors[0].bounds.max.z).toBe(CONSTRUCTION_RULES.doorThickness);
  expect(handles[0].bounds.max.z).toBe(state.referencePlanes.finishedFrontPlaneZ);
  expect(handles[0].bounds.min.z).toBeLessThan(state.referencePlanes.finishedFrontPlaneZ);
  await setView(page, "front");
  await captureViewer(viewer, "engine-single-door-inset");

  const autoPairConfig = oneSectionConfig({
    width: 48,
    layoutMetadata: {
      sectionRatios: [1],
      sectionTypes: ["lower_doors"],
      sectionDoorLayouts: [{ arrangement: "auto" }]
    }
  });
  state = await applyScenario(page, autoPairConfig);
  doors = byRole(state, "door").sort((left, right) => left.metadata.leafIndex - right.metadata.leafIndex);
  handles = byRole(state, "handle").sort((left, right) => left.position.x - right.position.x);
  expect(doors).toHaveLength(2);
  expect(doors.every((door) => door.metadata.arrangement === "pair")).toBe(true);
  expect(doors[0].size.x).toBeCloseTo(doors[1].size.x, 12);
  expect(doors[1].bounds.min.x - doors[0].bounds.max.x).toBeCloseTo(CONSTRUCTION_RULES.doubleDoorCenterGap, 12);
  expect(handles[0].position.x).toBeCloseTo(-handles[1].position.x, 12);
  await setView(page, "front");
  await captureViewer(viewer, "engine-paired-door-inset");

  const forcedLeftConfig = oneSectionConfig({
    layoutMetadata: {
      sectionRatios: [1],
      sectionTypes: ["lower_doors"],
      sectionDoorLayouts: [{ arrangement: "single_hinge_left" }]
    }
  });
  state = await applyScenario(page, forcedLeftConfig);
  doors = byRole(state, "door");
  handles = byRole(state, "handle");
  expect(doors).toHaveLength(1);
  expect(doors[0].metadata.hingeSide).toBe("hinge_left");
  expect(doors[0].metadata.latchSide).toBe("latch_right");
  expect(handles[0].metadata.latchSide).toBe("latch_right");
  expect(handles[0].metadata.mountingCenter.x).toBeGreaterThan(doors[0].position.x);
  await setView(page, "front");
  await captureViewer(viewer, "engine-single-hinge-left");

  await setView(page, "three-dimensional");
  await viewer.focus();
  await viewer.press("ArrowRight");
  await viewer.press("ArrowUp");
  await viewer.press("+");
  await settleFrames(page);
  const cameraBeforeHingeChange = await readConstructionState(page);
  expect(cameraBeforeHingeChange.activeView).toBe("custom");
  const forcedRightConfig = oneSectionConfig({
    layoutMetadata: {
      sectionRatios: [1],
      sectionTypes: ["lower_doors"],
      sectionDoorLayouts: [{ arrangement: "single_hinge_right" }]
    }
  });
  state = await applyScenario(page, forcedRightConfig);
  doors = byRole(state, "door");
  handles = byRole(state, "handle");
  expect(doors).toHaveLength(1);
  expect(doors[0].metadata.hingeSide).toBe("hinge_right");
  expect(doors[0].metadata.latchSide).toBe("latch_left");
  expect(handles[0].metadata.latchSide).toBe("latch_left");
  expect(handles[0].metadata.mountingCenter.x).toBeLessThan(doors[0].position.x);
  expect(state.activeView).toBe("custom");
  expect(state.viewerInstanceId).toBe(cameraBeforeHingeChange.viewerInstanceId);
  expect(state.canvasIdentity).toBe("jq-construction-standard-v1-canvas");
  expectCameraPreserved(state.view, cameraBeforeHingeChange.view);
  await setView(page, "front");
  await captureViewer(viewer, "engine-single-hinge-right");

  const tallConfig = oneSectionConfig({
    lowerCabinets: false,
    tallDoors: true,
    layoutType: "tall_storage",
    layoutMetadata: {
      sectionRatios: [1],
      sectionTypes: ["tall_doors"],
      sectionDoorLayouts: [{ arrangement: "auto" }]
    }
  });
  state = await applyScenario(page, tallConfig);
  doors = byRole(state, "door");
  handles = byRole(state, "handle");
  expect(doors).toHaveLength(1);
  expect(doors[0].metadata.openingKind).toBe("tall_storage");
  expect(doors[0].metadata.leafCount).toBe(1);
  expect(handles).toHaveLength(1);
  expect(handles[0].metadata.mountingCenter.y).toBe(CONSTRUCTION_RULES.tallDoorHandleCenterY);
  expect(handles[0].metadata.placementRuleId).toContain("aff_40");
  await setView(page, "front");
  await captureViewer(viewer, "engine-tall-door");

  const glassPreset = layoutPresets.find((preset) => preset.id === "glass-library");
  state = await applyScenario(page, {
    ...defaultBookcaseConfig,
    ...glassPreset.config,
    constructionProfile: CONSTRUCTION_PROFILE_IDS.inset
  });
  const glassDoors = byRole(state, "door").filter((door) => door.metadata.style === "glass");
  const glassHandles = byRole(state, "handle").filter((handle) => (
    glassDoors.some((door) => door.id === handle.hostId)
  ));
  expect(glassDoors).toHaveLength(8);
  expect(glassHandles).toHaveLength(glassDoors.length);
  for (const handle of glassHandles) {
    const door = glassDoors.find((candidate) => candidate.id === handle.hostId);
    const center = handle.metadata.mountingCenter;
    expect(handle.metadata.supportingRegionKind).toBe("solid");
    expect(door.metadata.profileGeometry.solidRegions.some((region) => pointInRegion(center, region))).toBe(true);
    expect(pointInRegion(center, door.metadata.profileGeometry.fieldRegion)).toBe(false);
  }
  await focusDetail(page, "hardware");
  await captureViewer(viewer, "engine-glass-hardware");

  const drawerConfig = {
    ...defaultBookcaseConfig,
    layoutPreset: "custom",
    constructionProfile: CONSTRUCTION_PROFILE_IDS.inset,
    layoutType: "lower_drawers",
    lowerCabinets: true,
    lowerStorage: "drawers",
    drawerFrontStyle: "slim_shaker",
    hardware: "brass_pull",
    lighting: "no_lighting",
    layoutMetadata: {
      sectionRatios: [1, 1, 1, 1],
      sectionTypes: ["drawers", "drawers", "drawers", "drawers"],
      sectionDoorLayouts: [null, null, null, null]
    }
  };
  state = await applyScenario(page, drawerConfig);
  const drawers = byRole(state, "drawer_front");
  const drawerHandles = byRole(state, "handle");
  expect(drawers).toHaveLength(12);
  expect(drawerHandles).toHaveLength(drawers.length);
  expect(drawers.every((drawer) => drawer.metadata.mounting === "inset" && drawer.bounds.min.z === 0)).toBe(true);
  for (const handle of drawerHandles) {
    const drawer = drawers.find((candidate) => candidate.id === handle.hostId);
    expect(handle.metadata.orientation).toBe("horizontal");
    expect(handle.metadata.mountingCenter.x).toBeCloseTo(drawer.position.x, 12);
    expect(handle.metadata.supportingRegionKind).toBe("solid");
  }
  await focusDetail(page, "doors");
  await captureViewer(viewer, "engine-drawer-fronts");

  state = await applyScenario(page, {
    ...defaultBookcaseConfig,
    constructionProfile: CONSTRUCTION_PROFILE_IDS.inset,
    baseStyle: "toe_kick"
  });
  const viewportViewerInstance = state.viewerInstanceId;
  for (const viewport of requiredViewports) {
    await page.setViewportSize(viewport);
    await settleFrames(page, 4);
    const label = `${viewport.width}x${viewport.height}`;
    const audit = await page.locator("[data-bookcase-builder]").evaluate((host) => {
      const controller = host.__bookcaseConfigurator;
      const diagnostics = controller.viewer.getDiagnostics();
      const canvasRect = host.querySelector("[data-3d-viewer] canvas")?.getBoundingClientRect();
      const view = controller.viewer.getViewState();
      return {
        renderValid: host.querySelector("[data-3d-viewer]")?.dataset.renderValid,
        canvasCount: host.querySelectorAll("[data-3d-viewer] canvas").length,
        canvasWidth: canvasRect?.width || 0,
        canvasHeight: canvasRect?.height || 0,
        horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
        viewerInstanceId: diagnostics.instanceId,
        renderedCount: diagnostics.renderAudit.renderedCount,
        expectedCount: diagnostics.renderAudit.expectedCount,
        webgl: diagnostics.webgl,
        finiteCamera: [view.theta, view.phi, view.radius, view.position.x, view.position.y, view.position.z]
          .every(Number.isFinite)
      };
    });
    expect(audit.renderValid, `${label} render validity`).toBe("true");
    expect(audit.canvasCount, `${label} canvas count`).toBe(1);
    expect(audit.canvasWidth, `${label} canvas width`).toBeGreaterThan(100);
    expect(audit.canvasHeight, `${label} canvas height`).toBeGreaterThan(100);
    expect(audit.horizontalOverflow, `${label} horizontal overflow`).toBeLessThanOrEqual(1);
    expect(audit.viewerInstanceId, `${label} persistent viewer`).toBe(viewportViewerInstance);
    expect(audit.renderedCount, `${label} render manifest`).toBe(audit.expectedCount);
    expect(audit.webgl.calls, `${label} WebGL calls`).toBeGreaterThan(0);
    expect(audit.webgl.triangles, `${label} WebGL triangles`).toBeGreaterThan(0);
    expect(audit.finiteCamera, `${label} finite camera`).toBe(true);

    if (viewport.width === 3840) {
      await setView(page, "three-quarter");
      await page.screenshot({
        path: `${artifactDirectory}/engine-4k-overview.png`,
        animations: "disabled"
      });
    }
    if (viewport.width === 390) {
      await setView(page, "front");
      await page.screenshot({
        path: `${artifactDirectory}/engine-mobile-fronts.png`,
        animations: "disabled"
      });
    }
  }

  const legacyConfig = structuredClone(defaultBookcaseConfig);
  delete legacyConfig.constructionProfile;
  delete legacyConfig.layoutMetadata.sectionDoorLayouts;
  await page.evaluate((config) => {
    localStorage.setItem("jqBookcasesDesign", JSON.stringify({ schemaVersion: 3, config }));
  }, legacyConfig);
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto("/configurator.html?start=resume&constructionDebug=1", { waitUntil: "networkidle" });
  viewer = page.locator("[data-3d-viewer]");
  await expect(viewer).toHaveAttribute("data-render-valid", "true", { timeout: 20_000 });
  await expect(viewer.locator("canvas")).toHaveCount(1);
  await page.locator("[data-construction-inspector]").evaluate((element) => {
    element.hidden = true;
  });
  state = await readConstructionState(page);
  doors = byRole(state, "door");
  expect(state.state.constructionProfile).toBe(CONSTRUCTION_PROFILE_IDS.legacyOverlay);
  expect(state.referencePlanes.finishedFrontPlaneZ).toBe(-CONSTRUCTION_RULES.doorThickness);
  expect(doors).toHaveLength(8);
  expect(doors.every((door) => door.metadata.mounting === "overlay" && door.metadata.arrangement === "pair")).toBe(true);
  expect(doors.every((door) => door.bounds.min.z === -CONSTRUCTION_RULES.doorThickness && door.bounds.max.z === 0)).toBe(true);
  expect(state.renderAudit.valid).toBe(true);
  expect(state.renderAudit.renderedCount).toBe(state.renderAudit.expectedCount);
  await setView(page, "front");
  await captureViewer(viewer, "engine-legacy-overlay");

  expect(runtime.errors).toEqual([]);
  expect(runtime.webglWarnings).toEqual([]);
});
