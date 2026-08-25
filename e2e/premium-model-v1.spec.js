import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import {
  IMMERSIVE_LAYOUT_ORDER,
  IMMERSIVE_LAYOUT_REGISTRY
} from "../guided-layout-registry.js";
import { GUIDED_DRAFT_STORAGE_KEY } from "../guided-configurator-state.js";

const QUERY = "modelQuality=premium-v1&renderer=webgl2";

function monitorFailures(page) {
  const failures = [];
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console: ${message.text()}`);
  });
  page.on("requestfailed", (request) => failures.push(`request: ${request.url()} ${request.failure()?.errorText || "failed"}`));
  page.on("response", (response) => {
    if (response.status() >= 400 && !response.url().endsWith("/api/quote")) {
      failures.push(`response: ${response.status()} ${response.url()}`);
    }
  });
  return failures;
}

async function openLayout(page, layoutId, query = QUERY) {
  await page.goto(`configurator.html?start=new&${query}`, { waitUntil: "domcontentloaded" });
  const product = page.locator('[data-product-choice="cabinet-shelves"]');
  await product.click();
  await page.locator("[data-continue]").click();
  await page.locator(`[data-layout="${layoutId}"]`).click();
  await page.locator("[data-continue]").click();
  const runtime = page.locator("[data-layout-viewer]");
  await expect(runtime).toHaveAttribute("data-layout-id", layoutId, { timeout: 30_000 });
  await expect(runtime).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
  return runtime;
}

async function diagnostics(page) {
  return page.evaluate(() => globalThis.__JQ_LAYOUT_VIEWER_DIAGNOSTICS__);
}

async function reloadWithSavedFinish(page, finishId, query = QUERY) {
  await expect.poll(() => page.evaluate((key) => Boolean(localStorage.getItem(key)), GUIDED_DRAFT_STORAGE_KEY)).toBe(true);
  await page.evaluate(({ key, nextFinish, nextQuery }) => {
    const draft = JSON.parse(localStorage.getItem(key));
    draft.finish = nextFinish;
    draft.updatedAt = new Date().toISOString();
    localStorage.setItem(key, JSON.stringify(draft));
    history.replaceState(history.state, "", `${location.pathname}?${nextQuery}#step-3`);
  }, { key: GUIDED_DRAFT_STORAGE_KEY, nextFinish: finishId, nextQuery: query });
  await page.reload({ waitUntil: "domcontentloaded" });
  const runtime = page.locator("[data-layout-viewer]");
  await expect(runtime).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
  await expect.poll(async () => (await diagnostics(page)).appearance.premiumModelV1?.finishId).toBe(finishId);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("premium model preview is exact, bounded, shared by all three layouts, and 3D-only", async ({ page }) => {
  test.slow();
  const failures = monitorFailures(page);
  for (const layoutId of IMMERSIVE_LAYOUT_ORDER) {
    const runtime = await openLayout(page, layoutId);
    await expect(runtime).toHaveAttribute("data-premium-model-v1", "true");
    await expect(runtime).toHaveAttribute("data-premium-model-v1-ready", "true");
    await expect(page.locator("canvas")).toHaveCount(1);
    const record = await diagnostics(page);
    const expected = IMMERSIVE_LAYOUT_REGISTRY[layoutId];
    const premium = record.appearance.premiumModelV1;
    expect(record.state).toBe("ready");
    expect(record.backend).toBe("webgl2");
    expect(record.assetSha256).toBe(expected.authoritativeSource.sha256);
    expect(record.assetSha256).toBe(record.authoritativeSha256);
    expect(record.ownership.canvases).toBe(1);
    expect(record.ownership.renderers).toBe(1);
    expect(record.ownership.parsedRoots).toBe(1);
    expect(record.transformProof.sourceBuffersImmutable).toBe(true);
    expect(record.transformProof.modelBoundsDeltaMillimeters).toBeLessThanOrEqual(0.05);
    expect(premium.schema).toBe("jq-premium-model-v1");
    expect(premium.interfaceModified).toBe(false);
    expect(premium.sharedLightingProfileUnchanged).toBe(false);
    expect(premium.sharedLightingOverrideApplied).toBe(true);
    expect(premium.lighting.sharedAcrossLayouts).toBe(true);
    expect(premium.lighting.exposure).toBe(1.03);
    expect(premium.lighting.shadowFilter).toBe("pcf-radius");
    expect(premium.lighting.shadowStrength).toBe(0.48);
    expect(premium.lighting.shadowRadius).toBe(4);
    expect(premium.lighting.shadowNormalBias).toBe(0.012);
    expect(premium.exteriorGround.spacingMillimeters).toBe(304.8);
    expect(premium.exteriorGround.lineCount).toBeGreaterThan(0);
    expect(premium.exteriorGround.marginMeters).toBe(36);
    expect(premium.exteriorGround.fogNearMeters).toBe(24);
    expect(premium.exteriorGround.fogFarMeters).toBe(58);
    expect(premium.exteriorGround.sourceFloorBounds).toBe(false);
    expect(premium.exteriorGround.excludesInteriorFloor).toBe(true);
    expect(premium.exteriorGround.parent).toBe("scene");
    expect(premium.floorSurface).toEqual({
      primitiveCount: 1,
      sourceColorMapReusedAsMicroBump: true,
      bumpScale: 0.004
    });
    expect(premium.architecturalMaterialScope.roomShells).toBe(true);
    expect(premium.architecturalMaterialScope.doorWallOpening).toBe(layoutId === "door-wall");
    expect(premium.sourcePrimitiveCount).toBe(expected.sourceMetadata.primitives);
    expect(premium.exactPrimitiveCoverage).toBe(expected.sourceMetadata.primitives);
    expect(premium.premiumMaterialPrimitiveCount).toBeGreaterThan(0);
    expect(premium.materialResponse.family).toBe("oak");
    expect(premium.materialResponse.maximumClearcoat).toBeLessThanOrEqual(0.11);
    expect(premium.materialResponse.minimumClearcoatRoughness).toBeGreaterThanOrEqual(0.74);
    expect(premium.materialResponse.maximumEnvMapIntensity).toBeLessThanOrEqual(0.74);
    expect(premium.materialResponse.maximumSpecularIntensity).toBeLessThanOrEqual(0.32);
    expect(premium.geometry.sourceAssetsModified).toBe(false);
    expect(premium.geometry.runtimeBeveledPrimitiveCount).toBeGreaterThan(0);
    expect(premium.geometry.derivedDegenerateTriangles).toBe(0);
    expect(premium.geometry.wrongWindingTriangles).toBe(0);
    expect(premium.geometry.maximumNormalLengthError).toBeLessThanOrEqual(1e-6);
    expect(premium.geometry.maximumWorldBoundsDeltaMillimeters).toBeLessThanOrEqual(0.05);
    expect(premium.materialResponse.roleResponses["door-detail"].colorHex)
      .not.toBe(premium.materialResponse.roleResponses["frame-stile"].colorHex);
    expect(premium.uvMapping.method).toBe("stable cabinet-scale straight-grain projection");
    expect(premium.uvMapping.projectedPrimitiveCount).toBeGreaterThan(0);
    expect(premium.shadowBudget.projectedMaximumDrawCalls).toBeLessThanOrEqual(250);
    expect(record.rendererInfo.calls).toBeLessThanOrEqual(250);
    expect(record.rendererInfo.triangles).toBeLessThanOrEqual(45_000);
  }
  expect(failures).toEqual([]);
});

test("oak, warm paint, and charcoal produce distinct live PBR frames without changing derived geometry", async ({ page }) => {
  test.slow();
  const failures = monitorFailures(page);
  for (const layoutId of IMMERSIVE_LAYOUT_ORDER) {
    await openLayout(page, layoutId);
    const canvas = page.locator("canvas");
    const natural = await diagnostics(page);
    const geometryCount = natural.appearance.premiumModelV1.geometry.runtimeBeveledPrimitiveCount;
    const naturalUvFingerprint = natural.appearance.premiumModelV1.uvMapping.mappingFingerprintFNV1a32;
    const hashes = [sha256(await canvas.screenshot())];
    for (const finishId of ["warm-white", "charcoal"]) {
      await reloadWithSavedFinish(page, finishId);
      const record = await diagnostics(page);
      expect(record.appearance.premiumModelV1.geometry.runtimeBeveledPrimitiveCount).toBe(geometryCount);
      expect(record.appearance.premiumModelV1.materialType).toBe("MeshPhysicalMaterial");
      expect(record.appearance.premiumModelV1.materialResponse.family).toBe("paint");
      expect(record.appearance.premiumModelV1.materialResponse.maximumClearcoat).toBeLessThanOrEqual(0.18);
      expect(record.appearance.premiumModelV1.materialResponse.minimumClearcoatRoughness).toBeGreaterThanOrEqual(0.68);
      expect(record.appearance.premiumModelV1.materialResponse.maximumEnvMapIntensity).toBeLessThanOrEqual(0.8);
      expect(record.appearance.premiumModelV1.materialResponse.maximumSpecularIntensity).toBeLessThanOrEqual(0.42);
      hashes.push(sha256(await canvas.screenshot()));
    }
    expect(new Set(hashes).size).toBe(3);
    await reloadWithSavedFinish(page, "natural-oak");
    const restoredOak = await diagnostics(page);
    expect(restoredOak.appearance.premiumModelV1.texturePaths).toEqual([
      "assets/premium-model-v1/textures/oak/base-color-worksite-reference-v1.webp",
      "assets/premium-model-v1/textures/oak/normal-worksite-reference-v1.webp",
      "assets/premium-model-v1/textures/oak/roughness-worksite-reference-v1.webp"
    ]);
    expect(restoredOak.appearance.premiumModelV1.uvMapping.projectedPrimitiveCount).toBeGreaterThan(0);
    expect(restoredOak.appearance.premiumModelV1.uvMapping.mappingFingerprintFNV1a32).toBe(naturalUvFingerprint);
    expect(new Set([hashes[1], hashes[2], sha256(await canvas.screenshot())]).size).toBe(3);
    await reloadWithSavedFinish(page, "white-oak");
    const whiteOak = await diagnostics(page);
    expect(whiteOak.appearance.premiumModelV1.texturePaths).toEqual([
      "assets/premium-model-v1/textures/oak/base-color-white-oak-reference-v2.webp",
      "assets/premium-model-v1/textures/oak/normal-white-oak-reference-v2.webp",
      "assets/premium-model-v1/textures/oak/roughness-white-oak-reference-v2.webp"
    ]);
    expect(whiteOak.appearance.premiumModelV1.uvMapping.mappingFingerprintFNV1a32).toBe(naturalUvFingerprint);
  }
  expect(failures).toEqual([]);
});

test("Light, Medium, and Dark Walnut use one restrained veneer PBR system across every layout", async ({ page }) => {
  test.slow();
  const failures = monitorFailures(page);
  const walnutFinishes = ["light-walnut", "medium-walnut", "dark-walnut"];
  for (const layoutId of IMMERSIVE_LAYOUT_ORDER) {
    await openLayout(page, layoutId);
    const canvas = page.locator("canvas");
    const initial = await diagnostics(page);
    const geometryCount = initial.appearance.premiumModelV1.geometry.runtimeBeveledPrimitiveCount;
    const hashes = [];
    let walnutUvFingerprint = null;
    for (const finishId of walnutFinishes) {
      await reloadWithSavedFinish(page, finishId);
      await page.getByRole("button", { name: "Left", exact: true }).click();
      await expect.poll(async () => (await diagnostics(page)).camera.animationActive).toBe(false);
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const record = await diagnostics(page);
      const premium = record.appearance.premiumModelV1;
      expect(premium.geometry.runtimeBeveledPrimitiveCount).toBe(geometryCount);
      expect(premium.materialResponse.family).toBe("walnut");
      expect(premium.texturePaths).toEqual([
        `assets/premium-model-v1/textures/walnut/base-color-${finishId.replace("-walnut", "")}-reference-v2.webp`,
        "assets/premium-model-v1/textures/walnut/normal-reference-v2.webp",
        "assets/premium-model-v1/textures/walnut/roughness-reference-v2.webp"
      ]);
      expect(premium.uvMapping.method).toBe("stable cabinet-scale straight-grain projection");
      expect(premium.uvMapping.projectedPrimitiveCount).toBeGreaterThan(0);
      expect(premium.materialResponse.maximumClearcoat).toBeLessThanOrEqual(0.09);
      expect(premium.materialResponse.minimumClearcoatRoughness).toBeGreaterThanOrEqual(0.76);
      expect(premium.materialResponse.maximumEnvMapIntensity).toBeLessThanOrEqual(0.7);
      expect(premium.materialResponse.maximumSpecularIntensity).toBeLessThanOrEqual(0.3);
      if (walnutUvFingerprint === null) walnutUvFingerprint = premium.uvMapping.mappingFingerprintFNV1a32;
      expect(premium.uvMapping.mappingFingerprintFNV1a32).toBe(walnutUvFingerprint);
      hashes.push(sha256(await canvas.screenshot()));
    }
    expect(new Set(hashes).size).toBe(3);
  }
  expect(failures).toEqual([]);
});

test("explicit standard-mode opt-out preserves the accepted renderer path", async ({ page }) => {
  const failures = monitorFailures(page);
  const runtime = await openLayout(page, "fireplace-wall", "modelQuality=standard&renderer=webgl2");
  await expect(runtime).toHaveAttribute("data-premium-model-v1", "false");
  await expect(runtime).toHaveAttribute("data-premium-model-v1-ready", "false");
  const record = await diagnostics(page);
  expect(record.appearance.premiumModelV1).toBeNull();
  expect(record.assetSha256).toBe(record.authoritativeSha256);
  expect(record.transformProof.sourceBuffersImmutable).toBe(true);
  expect(failures).toEqual([]);
});

test("all canonical paint colors are customer-selectable and retain a bounded satin response", async ({ page }) => {
  test.slow();
  const failures = monitorFailures(page);
  await openLayout(page, "window-wall");
  await expect(page.locator('[data-direct-choice-group="finish"] [data-finish]')).toHaveCount(11);
  const paintFinishes = ["shop-primed", "warm-white", "soft-ivory", "light-greige", "sage-gray", "charcoal"];
  const hashes = [];
  for (const finishId of paintFinishes) {
    await reloadWithSavedFinish(page, finishId);
    await expect(page.locator(`[data-finish="${finishId}"]`)).toHaveAttribute("aria-pressed", "true");
    const record = await diagnostics(page);
    expect(record.appearance.premiumModelV1.finishId).toBe(finishId);
    expect(record.appearance.premiumModelV1.materialResponse.family).toBe("paint");
    expect(record.appearance.premiumModelV1.materialResponse.maximumClearcoat).toBeLessThanOrEqual(0.18);
    expect(record.appearance.premiumModelV1.materialResponse.minimumClearcoatRoughness).toBeGreaterThanOrEqual(0.68);
    expect(record.appearance.premiumModelV1.materialResponse.maximumEnvMapIntensity).toBeLessThanOrEqual(0.8);
    hashes.push(sha256(await page.locator("canvas").screenshot()));
  }
  expect(new Set(hashes).size).toBe(paintFinishes.length);
  await reloadWithSavedFinish(page, "warm-white");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-finish="warm-white"]')).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => (await diagnostics(page)).appearance.premiumModelV1?.finishId).toBe("warm-white");
  expect(failures).toEqual([]);
});
