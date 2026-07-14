import assert from "node:assert/strict";
import test from "node:test";

import {
  CONSTRUCTION_PROFILE_IDS,
  defaultBookcaseConfig,
  layoutPresets,
  migrateLegacyConstructionConfig,
  normalizeBookcaseConfig
} from "../bookcase-config.js";
import { generateBookcaseLayout } from "../bookcase-layout.js";
import {
  CABINET_AR_MODEL_CACHE_LIMIT,
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
import {
  generateCabinetGlbArrayBuffer,
  generateProceduralCabinetModel,
  getArDescriptorEnvelope
} from "../cabinet-ar-model.js";
import { loadModelViewer } from "../cabinet-ar-ui.js";

function createArConfiguration(overrides = {}) {
  const config = normalizeBookcaseConfig({ ...defaultBookcaseConfig, ...overrides });
  const layout = generateBookcaseLayout(config);
  return { config, layout, ar: normalizeCabinetArConfiguration(config, layout, { price: 12345 }) };
}

function parseGlbJson(glb) {
  const view = new DataView(glb);
  const jsonLength = view.getUint32(12, true);
  return JSON.parse(new TextDecoder().decode(new Uint8Array(glb, 20, jsonLength)).trim());
}

test("inch-to-meter conversion is exact and rejects invalid dimensions", () => {
  assert.equal(inchesToMeters(1), 0.0254);
  assert.ok(Math.abs(inchesToMeters(96) - 2.4384) < 1e-12);
  assert.throws(() => inchesToMeters(0), /positive/);
  assert.throws(() => inchesToMeters(Number.NaN), /positive/);
});

test("configuration normalization maps exact dimensions, shelves, units, finish, and front profiles", () => {
  const { config, layout, ar } = createArConfiguration({
    width: 72,
    height: 102,
    depth: 18,
    sections: 3,
    shelves: 5,
    doorCount: 12,
    finish: "silver_satin",
    drawerFrontStyle: "slim_shaker",
    layoutMetadata: {
      sectionRatios: [1, 1, 1],
      sectionTypes: ["lower_doors", "lower_doors", "lower_doors"],
      sectionDoorLayouts: [
        { arrangement: "single_hinge_left" },
        { arrangement: "auto" },
        { arrangement: "single_hinge_right" }
      ]
    }
  });
  assert.equal(ar.units, "meters");
  assert.equal(ar.widthMeters, 1.8288);
  assert.equal(ar.heightMeters, 2.5908);
  assert.equal(ar.depthMeters, 0.4572);
  assert.equal(ar.sections, 3);
  assert.equal(ar.finishId, "silver_satin");
  assert.equal(ar.doorStyleId, "shaker");
  assert.equal(ar.drawerFrontStyleId, "slim_shaker");
  assert.equal(ar.constructionProfileId, CONSTRUCTION_PROFILE_IDS.inset);
  assert.equal(ar.doorCount, layout.components.filter((component) => component.role === "door").length);
  assert.equal(ar.doorLeafCount, ar.doorCount);
  assert.equal(
    normalizeCabinetArConfiguration({ ...config, doorCount: ar.doorCount }, layout, { price: 12345 }).configurationId,
    ar.configurationId
  );
  assert.deepEqual(ar.layoutMetadata.sectionDoorLayouts, config.layoutMetadata.sectionDoorLayouts);
  assert.equal(ar.shelves.length, layout.components.filter((component) => component.role === "shelf").length);
  assert.ok(ar.shelves.every((shelf) => shelf.positionMeters > 0));
  assert.equal(config.width, 72);
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
  const config = normalizeBookcaseConfig({
    ...defaultBookcaseConfig,
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
  const payload = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
  assert.ok(token.length < 1600);
  assert.equal(payload[1].at(-2), config.drawerFrontStyle);
  assert.equal(payload[1].at(-1), config.constructionProfile);
  assert.deepEqual(decodeCabinetConfiguration(token), config);
  const url = createCabinetArShareUrl(config, "https://example.com/configurator.html?preset=media-wall");
  assert.equal(new URL(url).searchParams.has("preset"), false);
  assert.deepEqual(readCabinetArShareConfiguration(url), config);
});

test("schema-v1 share tokens created before construction profiles restore legacy overlay meaning", () => {
  const normalized = normalizeBookcaseConfig({
    ...defaultBookcaseConfig,
    doorStyle: "flat",
    hardware: "polished_nickel_pull",
    lightingWarmth: 3500,
    crownStyle: "none",
    baseStyle: "toe_kick",
    installation: "no_installation",
    delivery: "priority"
  });
  const token = encodeCabinetConfiguration(normalized);
  const payload = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
  payload[1].pop();
  const legacyToken = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const decoded = decodeCabinetConfiguration(legacyToken);

  assert.equal(decoded.constructionProfile, CONSTRUCTION_PROFILE_IDS.legacyOverlay);
  assert.equal(decoded.drawerFrontStyle, "shaker");
  assert.equal(decoded.doorStyle, "flat");
  assert.equal(decoded.hardware, "polished_nickel_pull");
  assert.equal(decoded.delivery, "priority");
  assert.ok(decoded.layoutMetadata.sectionDoorLayouts
    .filter(Boolean)
    .every((entry) => entry.arrangement === "pair"));
});

test("schema-v1 share tokens created before drawer profiles retain every original position", () => {
  const normalized = normalizeBookcaseConfig({
    ...defaultBookcaseConfig,
    doorStyle: "flat",
    hardware: "polished_nickel_pull",
    lightingWarmth: 3500,
    crownStyle: "none",
    baseStyle: "toe_kick",
    installation: "no_installation",
    delivery: "priority"
  });
  const token = encodeCabinetConfiguration(normalized);
  const payload = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
  payload[1].pop();
  payload[1].pop();
  const legacyToken = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const decoded = decodeCabinetConfiguration(legacyToken);

  assert.equal(decoded.constructionProfile, CONSTRUCTION_PROFILE_IDS.legacyOverlay);
  assert.equal(decoded.doorStyle, "flat");
  assert.equal(decoded.drawerFrontStyle, "flat");
  assert.equal(decoded.hardware, "polished_nickel_pull");
  assert.equal(decoded.lightingWarmth, 3500);
  assert.equal(decoded.crownStyle, "none");
  assert.equal(decoded.baseStyle, "toe_kick");
  assert.equal(decoded.installation, "no_installation");
  assert.equal(decoded.delivery, "priority");
  assert.ok(decoded.layoutMetadata.sectionDoorLayouts
    .filter(Boolean)
    .every((entry) => entry.arrangement === "pair"));
});

test("migrated crown-bearing glass and tall presets remain valid in procedural AR", () => {
  for (const presetId of ["glass-library", "tall-storage"]) {
    const preset = layoutPresets.find((candidate) => candidate.id === presetId);
    const source = structuredClone({ ...defaultBookcaseConfig, ...preset.config });
    delete source.constructionProfile;
    if (source.layoutMetadata) delete source.layoutMetadata.sectionDoorLayouts;
    const config = migrateLegacyConstructionConfig(source);
    const layout = generateBookcaseLayout(config);
    assert.equal(layout.validation.valid, true, `${presetId}: ${JSON.stringify(layout.validation.errors)}`);
    const ar = normalizeCabinetArConfiguration(config, layout, { price: 12345 });
    const json = parseGlbJson(generateCabinetGlbArrayBuffer(ar, layout));
    assert.equal(ar.constructionProfileId, CONSTRUCTION_PROFILE_IDS.legacyOverlay);
    assert.equal(json.extras.constructionProfile, CONSTRUCTION_PROFILE_IDS.legacyOverlay);
    assert.equal(json.extras.doorLeafCount, layout.components.filter(
      (component) => component.role === "door"
    ).length);
  }
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

test("model cache is bounded and revokes cached object URLs on eviction and clear", async () => {
  await withTrackedObjectUrlRevocation(async (revokedUrls) => {
    const provider = createArModelProvider({
      generateProceduralModel: async (configuration, context) => ({
        glbUrl: `blob:model-${configuration.id}`,
        usdzUrl: null,
        posterUrl: context.posterUrl
      })
    });

    for (let index = 0; index <= CABINET_AR_MODEL_CACHE_LIMIT; index += 1) {
      await provider({ id: index }, { posterUrl: `blob:poster-${index}` });
    }

    assert.deepEqual(revokedUrls, ["blob:model-0", "blob:poster-0"]);
    clearArModelCache();
    assert.equal(revokedUrls.length, (CABINET_AR_MODEL_CACHE_LIMIT + 1) * 2);
    assert.equal(new Set(revokedUrls).size, revokedUrls.length);
    assert.ok(revokedUrls.includes(`blob:model-${CABINET_AR_MODEL_CACHE_LIMIT}`));
    assert.ok(revokedUrls.includes(`blob:poster-${CABINET_AR_MODEL_CACHE_LIMIT}`));
  });
});

test("model provider revokes unused poster blobs on cache hits, remote results, and errors", async () => {
  await withTrackedObjectUrlRevocation(async (revokedUrls) => {
    const cachedConfiguration = { id: "cached" };
    const cachedProvider = createArModelProvider({
      generateProceduralModel: async (configuration, context) => ({
        glbUrl: "https://cdn.example.com/cached.glb",
        usdzUrl: null,
        posterUrl: context.posterUrl
      })
    });
    await cachedProvider(cachedConfiguration, { posterUrl: "blob:poster-retained" });
    await cachedProvider(cachedConfiguration, { posterUrl: "blob:poster-cache-hit" });
    assert.deepEqual(revokedUrls, ["blob:poster-cache-hit"]);

    const remoteConfiguration = { id: "remote" };
    const remoteProvider = createArModelProvider({
      endpoint: "/api/ar",
      fetchImpl: async () => jsonResponse({
        configurationHash: hashCabinetArConfiguration(remoteConfiguration),
        glbUrl: "https://cdn.example.com/remote.glb",
        status: "ready"
      })
    });
    const remote = await remoteProvider(remoteConfiguration, { posterUrl: "blob:poster-remote" });
    assert.equal(remote.source, "remote");
    assert.ok(revokedUrls.includes("blob:poster-remote"));

    const unavailableProvider = createArModelProvider({
      endpoint: "/api/ar",
      fetchImpl: async () => jsonResponse({}, { ok: false })
    });
    await assert.rejects(
      () => unavailableProvider({ id: "error" }, { posterUrl: "blob:poster-error" }),
      /temporarily unavailable/
    );
    assert.ok(revokedUrls.includes("blob:poster-error"));
    assert.equal(revokedUrls.includes("blob:poster-retained"), false);
  });
});

test("concurrent requests share the first cached model and release the duplicate result", async () => {
  await withTrackedObjectUrlRevocation(async (revokedUrls) => {
    const generators = [];
    const provider = createArModelProvider({
      generateProceduralModel: async () => new Promise((resolve) => generators.push(resolve))
    });
    const configuration = { id: "concurrent" };
    const firstRequest = provider(configuration, { posterUrl: "blob:poster-first" });
    const secondRequest = provider(configuration, { posterUrl: "blob:poster-second" });
    assert.equal(generators.length, 2);

    generators[0]({ glbUrl: "blob:model-first", usdzUrl: null, posterUrl: "blob:poster-first" });
    const first = await firstRequest;
    generators[1]({ glbUrl: "blob:model-second", usdzUrl: null, posterUrl: "blob:poster-second" });
    const second = await secondRequest;

    assert.equal(second, first);
    assert.deepEqual(revokedUrls, ["blob:model-second", "blob:poster-second"]);
  });
});

test("remote model deadlines fall back procedurally while caller aborts do not", async () => {
  await withTrackedObjectUrlRevocation(async (revokedUrls) => {
    let proceduralCalls = 0;
    const provider = createArModelProvider({
      endpoint: "/api/ar",
      remoteTimeoutMs: 0,
      fetchImpl: async () => new Promise(() => {}),
      generateProceduralModel: async (configuration, context) => {
        proceduralCalls += 1;
        return {
          glbUrl: `https://cdn.example.com/${configuration.id}.glb`,
          usdzUrl: null,
          posterUrl: context.posterUrl
        };
      }
    });

    const fallback = await provider({ id: "timeout" }, { posterUrl: "blob:poster-timeout" });
    assert.equal(fallback.source, "procedural");
    assert.equal(proceduralCalls, 1);
    assert.equal(revokedUrls.includes("blob:poster-timeout"), false);

    const abortController = new AbortController();
    const abortedRequest = provider(
      { id: "aborted" },
      { signal: abortController.signal, posterUrl: "blob:poster-aborted" }
    );
    abortController.abort();
    await assert.rejects(abortedRequest, (error) => error?.name === "AbortError");
    assert.equal(proceduralCalls, 1);
    assert.ok(revokedUrls.includes("blob:poster-aborted"));
  });
});

test("stale asynchronous model requests cannot replace a newer request", async () => {
  const resolvers = [];
  const signals = [];
  const coordinator = createArModelRequestCoordinator((configuration, options) => new Promise((resolve) => {
    signals.push(options.signal);
    resolvers.push(() => resolve({ id: configuration.id }));
  }));
  const first = coordinator.request({ id: "first" });
  const second = coordinator.request({ id: "second" });
  assert.equal(signals[0].aborted, true);
  assert.equal(signals[1].aborted, false);
  resolvers[1]();
  assert.deepEqual(await second, { result: { id: "second" }, stale: false });
  resolvers[0]();
  assert.deepEqual(await first, { result: { id: "first" }, stale: true });

  const third = coordinator.request({ id: "third" });
  coordinator.destroy();
  assert.equal(signals[2].aborted, true);
  resolvers[2]();
  assert.deepEqual(await third, { result: { id: "third" }, stale: true });
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
  const json = parseGlbJson(glb);
  assert.equal(json.asset.version, "2.0");
  assert.deepEqual(json.extras.nominalDimensions, [ar.widthMeters, ar.heightMeters, ar.depthMeters]);
  assert.equal(json.extras.units, "meters");
  assert.equal(json.extras.constructionProfile, ar.constructionProfileId);
  assert.equal(json.extras.doorLeafCount, ar.doorLeafCount);
  assert.deepEqual(json.extras.geometryContract, {
    fronts: "descriptor-profile-geometry",
    hardware: "descriptor-hardware-geometry",
    lights: "descriptor-light-geometry"
  });
  assert.ok(json.meshes[0].primitives.length >= 1);
});

test("procedural AR derives its exact envelope from bounds instead of rounded convenience fields", () => {
  const component = {
    bounds: {
      min: { x: -17.439516, y: 5.375, z: -1 },
      max: { x: 17.439515, y: 15.208333, z: 0 }
    },
    // Deliberately contradictory values prove that these derived fields are
    // not an independent source of AR geometry.
    size: { x: 99, y: 99, z: 99 },
    position: { x: 99, y: 99, z: 99 }
  };
  const cabinetDepthMeters = inchesToMeters(15);
  assert.deepEqual(getArDescriptorEnvelope(component, cabinetDepthMeters), {
    center: [
      ((component.bounds.min.x + component.bounds.max.x) / 2) * 0.0254,
      ((component.bounds.min.y + component.bounds.max.y) / 2) * 0.0254,
      cabinetDepthMeters / 2 - ((component.bounds.min.z + component.bounds.max.z) / 2) * 0.0254
    ],
    size: [
      (component.bounds.max.x - component.bounds.min.x) * 0.0254,
      (component.bounds.max.y - component.bounds.min.y) * 0.0254,
      (component.bounds.max.z - component.bounds.min.z) * 0.0254
    ]
  });
});

test("display-wall procedural GLB exports every descriptor-backed light with an emissive material", () => {
  const preset = layoutPresets.find((candidate) => candidate.id === "display-wall");
  const config = normalizeBookcaseConfig({ ...defaultBookcaseConfig, ...preset.config });
  const layout = generateBookcaseLayout(config);
  assert.equal(layout.validation.valid, true);
  const lights = layout.components.filter((component) => component.role === "light");
  assert.ok(lights.length > 0, "The display wall must contain descriptor-backed light geometry.");

  const ar = normalizeCabinetArConfiguration(config, layout, { price: 12345 });
  const glb = generateCabinetGlbArrayBuffer(ar, layout);
  const json = parseGlbJson(glb);
  const lightMaterialIndex = json.materials.findIndex((material) => material.name === "light");
  assert.ok(lightMaterialIndex >= 0);
  assert.equal(json.materials[lightMaterialIndex].emissiveFactor.length, 3);
  const lightPrimitive = json.meshes[0].primitives.find((primitive) => primitive.material === lightMaterialIndex);
  assert.ok(lightPrimitive, "Descriptor-backed lights must not be dropped from the GLB graph.");
  assert.equal(
    json.accessors[lightPrimitive.attributes.POSITION].count,
    lights.length * 24,
    "Every light descriptor must contribute one complete box to the emissive geometry group."
  );
});

test("procedural AR fails closed when validated descriptor profile or hardware metadata is missing", () => {
  const { layout, ar } = createArConfiguration();
  const invalidFrontLayout = structuredClone(layout);
  const front = invalidFrontLayout.components.find((component) => component.role === "door");
  front.metadata.profileGeometry.solidRegions = [];
  assert.throws(
    () => generateCabinetGlbArrayBuffer(ar, invalidFrontLayout),
    /did not produce semantic geometry/
  );

  const invalidHardwareLayout = structuredClone(layout);
  const handle = invalidHardwareLayout.components.find((component) => component.role === "handle");
  delete handle.metadata.visualDimensions;
  assert.throws(
    () => generateCabinetGlbArrayBuffer(ar, invalidHardwareLayout),
    /did not produce semantic geometry/
  );
});

test("procedural model generation honors cancellation before allocating an object URL", async () => {
  const { layout, ar } = createArConfiguration();
  const abortController = new AbortController();
  abortController.abort();
  const originalCreateObjectUrl = URL.createObjectURL;
  URL.createObjectURL = () => assert.fail("an aborted export must not allocate an object URL");
  try {
    await assert.rejects(
      () => generateProceduralCabinetModel(ar, { layout, signal: abortController.signal }),
      (error) => error?.name === "AbortError"
    );
  } finally {
    URL.createObjectURL = originalCreateObjectUrl;
  }
});

test("model-viewer dependency loading stops if the custom element never registers", async () => {
  const originalDocument = globalThis.document;
  const originalCustomElements = globalThis.customElements;
  const scripts = [];
  globalThis.document = {
    createElement: () => new FakeScriptElement(),
    head: { appendChild: (script) => scripts.push(script) }
  };
  globalThis.customElements = {
    get: () => undefined,
    whenDefined: () => new Promise(() => {})
  };

  try {
    const attempt = loadModelViewer(5);
    scripts[0].dispatch("load");
    await assert.rejects(attempt, /did not become available/);
    assert.equal(scripts[0].removed, true);
  } finally {
    restoreGlobal("document", originalDocument);
    restoreGlobal("customElements", originalCustomElements);
  }
});

test("model-viewer dependency loading can retry after a failed script", async () => {
  const originalDocument = globalThis.document;
  const originalCustomElements = globalThis.customElements;
  const scripts = [];
  let modelViewerDefined = false;
  globalThis.document = {
    createElement: () => new FakeScriptElement(),
    head: { appendChild: (script) => scripts.push(script) }
  };
  globalThis.customElements = {
    get: () => modelViewerDefined ? {} : undefined,
    whenDefined: async () => { modelViewerDefined = true; }
  };

  try {
    const firstAttempt = loadModelViewer();
    assert.equal(scripts.length, 1);
    scripts[0].dispatch("error");
    await assert.rejects(firstAttempt, /could not be loaded/);
    assert.equal(scripts[0].removed, true);

    const secondAttempt = loadModelViewer();
    assert.notEqual(secondAttempt, firstAttempt);
    assert.equal(scripts.length, 2);
    scripts[1].dispatch("load");
    await secondAttempt;
    assert.equal(modelViewerDefined, true);
  } finally {
    restoreGlobal("document", originalDocument);
    restoreGlobal("customElements", originalCustomElements);
  }
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
  assert.match(source, /retryableLoader = loader\.catch/);
  assert.match(source, /modelViewerLoader === retryableLoader/);
  assert.match(source, /modelViewerLoader = null/);
  assert.match(source, /script\.remove\(\)/);
  assert.match(source, /destroy\(\)[\s\S]*clearArModelCache\(\)/);
  assert.match(source, /querySelector\("\[data-ar-label\]"\)/);
  assert.doesNotMatch(source, /querySelector\("span"\)/);
  assert.match(source, /loading \? "Preparing Room View…" : "AR View in Your Room"/);
  [
    "ar_button_viewed", "ar_button_clicked", "ar_model_requested", "ar_model_ready", "ar_launch_started",
    "ar_launch_succeeded", "ar_launch_failed", "ar_unsupported_device", "ar_qr_displayed", "ar_qr_opened"
  ].forEach((eventName) => assert.match(source, new RegExp(eventName)));
});

function jsonResponse(payload, options = {}) {
  return {
    ok: options.ok ?? true,
    headers: { get: (name) => name.toLowerCase() === "content-type" ? "application/json" : null },
    json: async () => payload
  };
}

async function withTrackedObjectUrlRevocation(callback) {
  clearArModelCache();
  const originalRevokeObjectUrl = URL.revokeObjectURL;
  const revokedUrls = [];
  URL.revokeObjectURL = (url) => revokedUrls.push(url);
  try {
    await callback(revokedUrls);
  } finally {
    clearArModelCache();
    URL.revokeObjectURL = originalRevokeObjectUrl;
  }
}

class FakeScriptElement {
  constructor() {
    this.dataset = {};
    this.listeners = new Map();
    this.removed = false;
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  dispatch(type) {
    this.listeners.get(type)?.();
  }

  remove() {
    this.removed = true;
  }
}

function restoreGlobal(name, value) {
  if (value === undefined) delete globalThis[name];
  else globalThis[name] = value;
}
