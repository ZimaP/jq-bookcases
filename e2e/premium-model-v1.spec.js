import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import {
  IMMERSIVE_LAYOUT_ORDER,
  IMMERSIVE_LAYOUT_REGISTRY
} from "../guided-layout-registry.js";

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
    expect(premium.lighting.exposure).toBe(0.93);
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
      await page.getByRole("button", { name: "Finish", exact: true }).click();
      const label = finishId === "warm-white" ? "Warm White" : "Charcoal";
      await page.getByRole("button", { name: label, exact: true }).click();
      await expect.poll(async () => (await diagnostics(page)).appearance.premiumModelV1?.finishId).toBe(finishId);
      await page.getByRole("button", { name: "Close Finish", exact: true }).click();
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
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
    await page.getByRole("button", { name: "Finish", exact: true }).click();
    await page.getByRole("button", { name: "Natural Oak", exact: true }).click();
    await expect.poll(async () => (await diagnostics(page)).appearance.premiumModelV1?.finishId).toBe("natural-oak");
    await page.getByRole("button", { name: "Close Finish", exact: true }).click();
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const restoredOak = await diagnostics(page);
    expect(restoredOak.appearance.premiumModelV1.uvMapping.projectedPrimitiveCount).toBeGreaterThan(0);
    expect(restoredOak.appearance.premiumModelV1.uvMapping.mappingFingerprintFNV1a32).toBe(naturalUvFingerprint);
    expect(new Set([hashes[1], hashes[2], sha256(await canvas.screenshot())]).size).toBe(3);
  }
  expect(failures).toEqual([]);
});

test("Light, Medium, and Dark Walnut use one restrained veneer PBR system across every layout", async ({ page }) => {
  test.slow();
  const failures = monitorFailures(page);
  const walnutFinishes = [
    ["light-walnut", "Light Walnut"],
    ["medium-walnut", "Medium Walnut"],
    ["dark-walnut", "Dark Walnut"]
  ];
  for (const layoutId of IMMERSIVE_LAYOUT_ORDER) {
    await openLayout(page, layoutId);
    const canvas = page.locator("canvas");
    const initial = await diagnostics(page);
    const geometryCount = initial.appearance.premiumModelV1.geometry.runtimeBeveledPrimitiveCount;
    const hashes = [];
    let walnutUvFingerprint = null;
    for (const [finishId, label] of walnutFinishes) {
      await page.getByRole("button", { name: "Finish", exact: true }).click();
      await page.getByRole("button", { name: label, exact: true }).click();
      await expect.poll(async () => (await diagnostics(page)).appearance.premiumModelV1?.finishId).toBe(finishId);
      await page.getByRole("button", { name: "Close Finish", exact: true }).click();
      await page.getByRole("button", { name: "Left", exact: true }).click();
      await expect.poll(async () => (await diagnostics(page)).camera.animationActive).toBe(false);
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const record = await diagnostics(page);
      const premium = record.appearance.premiumModelV1;
      expect(premium.geometry.runtimeBeveledPrimitiveCount).toBe(geometryCount);
      expect(premium.materialResponse.family).toBe("walnut");
      expect(premium.texturePaths).toEqual([
        "assets/premium-model-v1/textures/walnut/base-color.webp",
        "assets/premium-model-v1/textures/walnut/normal.webp",
        "assets/premium-model-v1/textures/walnut/roughness.webp"
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

test("production-style route remains byte-for-byte viewer behavior without the preview flag", async ({ page }) => {
  const failures = monitorFailures(page);
  const runtime = await openLayout(page, "fireplace-wall", "renderer=webgl2");
  await expect(runtime).toHaveAttribute("data-premium-model-v1", "false");
  await expect(runtime).toHaveAttribute("data-premium-model-v1-ready", "false");
  const record = await diagnostics(page);
  expect(record.appearance.premiumModelV1).toBeNull();
  expect(record.assetSha256).toBe(record.authoritativeSha256);
  expect(record.transformProof.sourceBuffersImmutable).toBe(true);
  expect(failures).toEqual([]);
});
