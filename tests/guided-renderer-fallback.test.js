import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  GUIDED_RESOURCE_FALLBACKS,
  GuidedSceneController,
  applyGuidedNeutralMaterialFallback,
  createGuidedAppearanceDescriptorSignature
} from "../guided-configurator-3d.js";
import { applyGuidedEnvironment } from "../guided-materials.js";

function createFinishMaterial() {
  return {
    map: { id: "albedo" },
    normalMap: { id: "normal" },
    roughnessMap: { id: "roughness" },
    aoMap: { id: "ao" },
    color: {
      value: null,
      set(value) {
        this.value = value;
      }
    },
    roughness: 0.4,
    metalness: 0.3,
    userData: {},
    needsUpdate: false
  };
}

function createMaterialLibrary(accentFinishId = "ink-blue") {
  return {
    case: createFinishMaterial(),
    side: createFinishMaterial(),
    back: createFinishMaterial(),
    front: createFinishMaterial(),
    inset: createFinishMaterial(),
    accent: createFinishMaterial(),
    hardware: { id: "selected-hardware" },
    glass: { id: "glass" },
    led: { id: "led" },
    screen: { id: "screen" },
    finishId: "natural-oak",
    finishFamily: "wood",
    accentFinishId,
    accentMatchesExterior: accentFinishId === "no-accent",
    repeatInches: [24, 48]
  };
}

function createDiagnosticElement() {
  return {
    dataset: {},
    attributes: new Map(),
    setAttribute(name, value) {
      this.attributes.set(name, value);
    }
  };
}

test("missing finish assets neutralize exterior and accent surfaces without changing independent materials", () => {
  const library = createMaterialLibrary("ink-blue");
  const independentMaterials = {
    hardware: library.hardware,
    glass: library.glass,
    led: library.led,
    screen: library.screen
  };

  assert.equal(applyGuidedNeutralMaterialFallback(library), true);
  assert.equal(library.requestedFinishId, "natural-oak");
  assert.equal(library.finishId, GUIDED_RESOURCE_FALLBACKS.material.id);
  assert.equal(library.finishFamily, "neutral-fallback");

  for (const slot of ["case", "side", "back", "front", "inset", "accent"]) {
    const material = library[slot];
    assert.equal(material.map, null);
    assert.equal(material.normalMap, null);
    assert.equal(material.roughnessMap, null);
    assert.equal(material.aoMap, null);
    assert.equal(material.metalness, 0);
    assert.equal(material.userData.guidedNeutralFallback, true);
    assert.equal(material.userData.guidedFallbackId, GUIDED_RESOURCE_FALLBACKS.material.id);
    assert.equal(
      material.userData.guidedRequestedFinishId,
      slot === "accent" ? "ink-blue" : "natural-oak"
    );
    assert.equal(material.needsUpdate, true);
    assert.match(material.name, /JQ Neutral Material/);
  }

  for (const [slot, material] of Object.entries(independentMaterials)) {
    assert.equal(library[slot], material, `${slot} remains independently assigned`);
  }

  const matchExterior = createMaterialLibrary("no-accent");
  assert.equal(applyGuidedNeutralMaterialFallback(matchExterior), true);
  assert.equal(matchExterior.accent.userData.guidedNeutralFallback, true);
  assert.equal(matchExterior.accent.userData.guidedRequestedFinishId, "no-accent");
});

test("appearance descriptor signatures refresh handles and lighting without treating casework as geometry", () => {
  const specification = (components) => ({
    product: {
      descriptorSets: [{
        id: "guided-main",
        installationId: "installation-01",
        components: [
          {
            id: "guided-main/case",
            role: "side_panel",
            bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 96, z: 15 } },
            metadata: { materialSlot: "side" }
          },
          ...components
        ]
      }]
    }
  });
  const handle = {
    id: "guided-main/handle-01",
    role: "handle",
    parentId: "guided-main/door-01",
    hostId: "guided-main/door-01",
    bounds: { min: { x: 10, y: 30, z: 0 }, max: { x: 16, y: 31, z: 1 } },
    metadata: { materialSlot: "hardware", hardware: "brass-pull" }
  };
  const puck = {
    id: "guided-main/light-01",
    role: "light",
    parentId: "guided-main/top",
    hostId: "guided-main/top",
    bounds: { min: { x: 20, y: 90, z: 2 }, max: { x: 22, y: 90.25, z: 4 } },
    metadata: { materialSlot: "led", lightType: "puck" }
  };
  const noFixtures = createGuidedAppearanceDescriptorSignature(specification([]));
  const warm = createGuidedAppearanceDescriptorSignature(specification([handle, puck]));
  const black = createGuidedAppearanceDescriptorSignature(specification([{
    ...handle,
    metadata: { ...handle.metadata, hardware: "black-pull" }
  }, puck]));
  const integrated = createGuidedAppearanceDescriptorSignature(specification([
    handle,
    puck,
    {
      ...puck,
      id: "guided-main/light-02",
      metadata: { ...puck.metadata, lightType: "shelf_led" }
    }
  ]));
  const changedCasework = structuredClone(specification([handle, puck]));
  changedCasework.product.descriptorSets[0].components[0].bounds.max.y = 108;

  assert.notEqual(noFixtures, warm);
  assert.notEqual(warm, black);
  assert.notEqual(warm, integrated);
  assert.equal(
    createGuidedAppearanceDescriptorSignature(changedCasework),
    warm,
    "casework changes remain governed by the physical geometry signature"
  );
});

test("resource failures remain recoverable and publish stable warning diagnostics", () => {
  const notifications = [];
  const controller = new GuidedSceneController({
    onWarning: (warning) => notifications.push(warning)
  });
  const library = createMaterialLibrary();
  const materialContext = { active: true, failed: true, library };
  controller.activeMaterialLoad = materialContext;
  controller.runtime = createDiagnosticElement();
  controller.canvas = createDiagnosticElement();
  controller.resourceWarningElement = { hidden: true, textContent: "" };

  controller.handleMaterialAssetFailure(
    materialContext,
    Object.assign(new Error("not found"), { code: "ENOENT" }),
    "assets/textures/wood/natural-oak/albedo.jpg"
  );
  controller.handleMaterialAssetFailure(
    materialContext,
    new Error("duplicate callback"),
    "assets/textures/wood/natural-oak/albedo.jpg"
  );

  assert.equal(controller.failed, false);
  assert.equal(notifications.length, 1, "the same failed asset warns only once");
  assert.equal(controller.runtime.dataset.materialFallbackActive, "true");
  assert.equal(
    controller.canvas.dataset.resourceWarningCodes,
    GUIDED_RESOURCE_FALLBACKS.material.code
  );

  controller.scene = { environment: { id: "failed-texture" }, userData: {} };
  controller.renderer = { toneMappingExposure: 0.88 };
  controller.handleEnvironmentAssetFailure(
    new Error("environment missing"),
    "assets/environments/jq-warm-interior.jpg"
  );

  const warnings = controller.getResourceWarnings();
  assert.equal(controller.failed, false);
  assert.equal(controller.scene.environment, null);
  assert.equal(
    controller.scene.userData.environmentFallbackId,
    GUIDED_RESOURCE_FALLBACKS.environment.id
  );
  assert.equal(controller.renderer.toneMappingExposure, 0.95);
  assert.deepEqual(
    warnings.map(({ code }) => code).sort(),
    [
      GUIDED_RESOURCE_FALLBACKS.environment.code,
      GUIDED_RESOURCE_FALLBACKS.material.code
    ].sort()
  );
  assert.equal(controller.runtime.dataset.resourceFallbackActive, "true");
  assert.equal(controller.runtime.dataset.resourceWarningCount, "2");
  assert.equal(controller.runtime.dataset.environmentFallbackActive, "true");
  assert.equal(controller.resourceWarningElement.hidden, false);
  assert.match(controller.resourceWarningElement.textContent, /JQ Neutral Material/);
  assert.match(controller.resourceWarningElement.textContent, /JQ Neutral Studio Lighting/);
});

test("a cached asset failure is replayed with its source to later preview consumers", async () => {
  let rejectLoad;
  let loaderCalls = 0;
  class TextureLoader {
    load(source, onLoad, onProgress, onError) {
      loaderCalls += 1;
      rejectLoad = () => onError(Object.assign(new Error("missing"), { code: "ENOENT" }));
      return { userData: {}, source };
    }
  }
  const FakeThree = {
    TextureLoader,
    EquirectangularReflectionMapping: "equirectangular",
    SRGBColorSpace: "srgb"
  };
  const firstErrors = [];
  const firstScene = { userData: {} };
  applyGuidedEnvironment(FakeThree, firstScene, null, "warm", {
    onError: (error, source) => firstErrors.push({ error, source })
  });
  rejectLoad();

  assert.equal(firstErrors.length, 1);
  assert.equal(firstErrors[0].source, "assets/environments/jq-warm-interior.jpg");
  assert.equal(firstScene.environment.userData.guidedAssetStatus, "failed");

  const cachedErrors = [];
  applyGuidedEnvironment(FakeThree, { userData: {} }, null, "warm", {
    onError: (error, source) => cachedErrors.push({ error, source })
  });
  await Promise.resolve();

  assert.equal(loaderCalls, 1, "the failed shared asset is not fetched twice");
  assert.equal(cachedErrors.length, 1);
  assert.equal(cachedErrors[0].error.code, "ENOENT");
  assert.equal(cachedErrors[0].source, "assets/environments/jq-warm-interior.jpg");
});

test("the build syntax gate includes the guided golden capture utility", async () => {
  const packageSource = await readFile(new URL("../package.json", import.meta.url), "utf8");
  assert.match(
    packageSource,
    /node --check scripts\/capture-guided-golden-step4\.mjs/
  );
});
