import assert from "node:assert/strict";
import test from "node:test";

import { defaultBookcaseConfig, normalizeBookcaseConfig } from "../bookcase-config.js";
import { generateBookcaseLayout } from "../bookcase-layout.js";
import {
  clearArModelCache,
  createArAnalyticsPayload,
  createArModelProvider,
  createArModelRequestCoordinator,
  createCabinetArShareUrl,
  decodeCabinetConfiguration,
  detectArCapability,
  encodeCabinetConfiguration,
  hashCabinetArConfiguration,
  inchesToMeters,
  normalizeCabinetArConfiguration,
  readCabinetArShareConfiguration,
  stableStringify
} from "../cabinet-ar.js";
import { generateCabinetGlbArrayBuffer } from "../cabinet-ar-model.js";

function createArConfiguration(overrides = {}) {
  const config = normalizeBookcaseConfig({ ...defaultBookcaseConfig, ...overrides });
  const layout = generateBookcaseLayout(config);
  return { config, layout, ar: normalizeCabinetArConfiguration(config, layout, { price: 12345 }) };
}

test("inch-to-meter conversion is exact and rejects invalid dimensions", () => {
  assert.equal(inchesToMeters(1), 0.0254);
  assert.ok(Math.abs(inchesToMeters(96) - 2.4384) < 1e-12);
  assert.throws(() => inchesToMeters(0), /positive/);
  assert.throws(() => inchesToMeters(Number.NaN), /positive/);
});

test("configuration normalization maps exact dimensions, shelves, units, and finish", () => {
  const { config, layout, ar } = createArConfiguration({ width: 108, height: 102, depth: 18, sections: 3, shelves: 5, finish: "silver_satin" });
  assert.equal(ar.units, "meters");
  assert.equal(ar.widthMeters, 2.7432);
  assert.equal(ar.heightMeters, 2.5908);
  assert.equal(ar.depthMeters, 0.4572);
  assert.equal(ar.sections, 3);
  assert.equal(ar.finishId, "silver_satin");
  assert.equal(ar.shelves.length, layout.components.filter((component) => component.role === "shelf").length);
  assert.ok(ar.shelves.every((shelf) => shelf.positionMeters > 0));
  assert.equal(config.width, 108);
});

test("configuration normalization rejects invalid raw dimensions and invalid layouts", () => {
  const valid = createArConfiguration();
  assert.throws(() => normalizeCabinetArConfiguration({ ...valid.config, width: 0 }, valid.layout), /width/);
  assert.throws(() => normalizeCabinetArConfiguration(valid.config, { ...valid.layout, validation: { valid: false } }), /layout/);
});

test("stable serialization and hashes ignore object key order", () => {
  const left = { b: 2, a: { y: [3, 4], x: 1 } };
  const right = { a: { x: 1, y: [3, 4] }, b: 2 };
  assert.equal(stableStringify(left), stableStringify(right));
  assert.equal(hashCabinetArConfiguration(left), hashCabinetArConfiguration(right));
});

test("geometry-affecting changes produce different configuration hashes", () => {
  const standard = createArConfiguration().ar;
  const wider = createArConfiguration({ width: 120 }).ar;
  const moreShelves = createArConfiguration({ shelves: 6 }).ar;
  assert.notEqual(hashCabinetArConfiguration(standard), hashCabinetArConfiguration(wider));
  assert.notEqual(hashCabinetArConfiguration(standard), hashCabinetArConfiguration(moreShelves));
});

test("compact share links preserve the exact normalized configuration", () => {
  const { config } = createArConfiguration({
    layoutType: "asymmetric",
    width: 117,
    height: 105,
    depth: 19,
    sections: 5,
    finish: "custom_bm",
    customPaintColor: "Hale Navy",
    customPaintCode: "HC-154",
    customPaintHex: "#34495a"
  });
  const token = encodeCabinetConfiguration(config);
  assert.ok(token.length < 1600);
  assert.deepEqual(decodeCabinetConfiguration(token), config);
  const url = createCabinetArShareUrl(config, "https://example.com/configurator.html?preset=media-wall");
  assert.equal(new URL(url).searchParams.has("preset"), false);
  assert.deepEqual(readCabinetArShareConfiguration(url), config);
});

test("capability detection reports desktop fallback and supported WebXR", async () => {
  const desktop = await detectArCapability({
    navigator: { userAgent: "Mozilla/5.0 Firefox/140" },
    isSecureContext: true,
    matchMedia: () => ({ matches: false })
  });
  assert.equal(desktop.deviceCategory, "desktop");
  assert.equal(desktop.canLaunchAr, false);

  const android = await detectArCapability({
    navigator: {
      userAgent: "Mozilla/5.0 (Linux; Android 15) Chrome/140",
      xr: { isSessionSupported: async (mode) => mode === "immersive-ar" }
    },
    isSecureContext: true,
    matchMedia: () => ({ matches: true })
  });
  assert.equal(android.webXr, true);
  assert.equal(android.canLaunchAr, true);
});

test("model provider rejects missing models with a customer-safe error", async () => {
  clearArModelCache();
  const provider = createArModelProvider();
  await assert.rejects(() => provider(createArConfiguration().ar), /could not be prepared/);
});

test("stale asynchronous model requests cannot replace a newer request", async () => {
  const resolvers = [];
  const coordinator = createArModelRequestCoordinator((configuration) => new Promise((resolve) => {
    resolvers.push(() => resolve({ id: configuration.id }));
  }));
  const first = coordinator.request({ id: "first" });
  const second = coordinator.request({ id: "second" });
  resolvers[1]();
  assert.deepEqual(await second, { result: { id: "second" }, stale: false });
  resolvers[0]();
  assert.deepEqual(await first, { result: { id: "first" }, stale: true });
});

test("analytics payloads include only approved non-sensitive metadata", () => {
  const payload = createArAnalyticsPayload("ar_model_ready", {
    productId: "lower_cabinets",
    configurationHash: "ar-123",
    customerEmail: "not-allowed@example.com",
    roomImage: "not-allowed"
  });
  assert.deepEqual(payload, { event: "ar_model_ready", productId: "lower_cabinets", configurationHash: "ar-123" });
});

test("procedural GLB is valid GLB 2.0 metadata with meter dimensions", () => {
  const { layout, ar } = createArConfiguration({ width: 100, height: 90, depth: 16 });
  const glb = generateCabinetGlbArrayBuffer(ar, layout);
  const view = new DataView(glb);
  assert.equal(view.getUint32(0, true), 0x46546c67);
  assert.equal(view.getUint32(4, true), 2);
  assert.equal(view.getUint32(8, true), glb.byteLength);
  const jsonLength = view.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(glb, 20, jsonLength)).trim());
  assert.equal(json.asset.version, "2.0");
  assert.deepEqual(json.extras.nominalDimensions, [ar.widthMeters, ar.heightMeters, ar.depthMeters]);
  assert.equal(json.extras.units, "meters");
  assert.ok(json.meshes[0].primitives.length >= 1);
});

test("AR UI contracts include fixed scale, floor placement, fallbacks, and analytics events", async () => {
  const source = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../cabinet-ar-ui.js", import.meta.url), "utf8"));
  assert.match(source, /ar-placement=\"floor\"/);
  assert.match(source, /ar-scale=\"fixed\"/);
  assert.match(source, /camera-controls/);
  assert.match(source, /AR isn’t available in this browser/);
  assert.match(source, /data-ar-launch/);
  assert.match(source, /prepareIosUsdz/);
  assert.match(source, /prepareUSDZ/);
  assert.match(source, /generatedUsdzUrl/);
  assert.match(source, /querySelector\("\[data-ar-label\]"\)/);
  assert.doesNotMatch(source, /querySelector\("span"\)/);
  assert.match(source, /loading \? "Preparing Room View…" : "AR View in Your Room"/);
  [
    "ar_button_viewed", "ar_button_clicked", "ar_model_requested", "ar_model_ready", "ar_launch_started",
    "ar_launch_succeeded", "ar_launch_failed", "ar_unsupported_device", "ar_qr_displayed", "ar_qr_opened"
  ].forEach((eventName) => assert.match(source, new RegExp(eventName)));
});
