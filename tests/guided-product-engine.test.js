import test from "node:test";
import assert from "node:assert/strict";

import {
  GUIDED_PRODUCT_FAILURES,
  createGuidedProductCandidate,
  createGuidedProductIntent,
  deriveCanonicalTvGeometry,
  resolveGuidedProductId,
  resolveProductLayoutCompatibility
} from "../guided-product-adapter.js";
import {
  GUIDED_PRODUCT_ENGINE_FAILURES,
  createGuidedGeometryFingerprint,
  createGuidedRenderManifest,
  evaluateGuidedProductCandidate
} from "../guided-product-engine.js";

const room = (layoutId, options = {}) => ({
  accepted: true,
  schemaVersion: 1,
  units: "inches",
  layoutId,
  layoutKind: options.layoutKind || "test-room",
  features: options.features || {},
  installationZones: options.installationZones || [],
  cameraIntent: options.cameraIntent || "front"
});

const installation = (options = {}) => {
  const mode = options.mode || "fitted";
  const width = options.width ?? 96;
  const height = options.height ?? 96;
  const depth = options.depth ?? 15;
  const bottomY = options.bottomY ?? (mode === "floating" ? 18 : 0);
  const baseHeight = mode === "floating" ? 0 : mode === "freestanding" ? 4.5 : 4;
  return {
    id: options.id || "installation-01",
    zoneId: options.zoneId || "main",
    role: options.role || "main",
    mode,
    zoneBounds: options.zoneBounds || {
      left: -width / 2,
      right: width / 2,
      bottom: bottomY,
      top: bottomY + height,
      back: 0
    },
    casework: {
      width,
      bodyHeight: options.bodyHeight ?? height - baseHeight - (mode === "fitted" ? 0.75 : 0),
      overallHeight: height,
      depth,
      leftPlaneX: -width / 2,
      rightPlaneX: width / 2,
      bottomPlaneY: bottomY,
      bodyBottomPlaneY: bottomY,
      topPlaneY: bottomY + height,
      backPlaneZ: 0,
      frontPlaneZ: -depth
    },
    treatments: {
      left: { kind: "none", width: 0 },
      right: { kind: "none", width: 0 },
      base: { kind: mode === "floating" ? "none" : "built-in-base", height: baseHeight },
      top: { kind: mode === "fitted" ? "scribe-or-crown" : "finished-top", height: mode === "fitted" ? 0.75 : 0 }
    },
    anchors: {
      floorY: 0,
      bottomY,
      backZ: 0,
      frontZ: -depth,
      centerX: options.centerX || 0,
      mountingHeight: mode === "floating" ? bottomY : null
    },
    orientation: options.orientation || {
      origin: { x: 0, y: bottomY, z: -depth },
      widthAxis: [1, 0, 0],
      heightAxis: [0, 1, 0],
      depthAxis: [0, 0, 1]
    },
    invariants: { rootScale: options.rootScale || [1, 1, 1] }
  };
};

const acceptedFit = (...installations) => ({
  accepted: true,
  schemaVersion: 1,
  units: "inches",
  mode: installations[0]?.mode || "fitted",
  zoneIds: installations.map((item) => item.zoneId),
  installations,
  casework: installations[0]?.casework,
  treatments: installations[0]?.treatments,
  anchors: installations[0]?.anchors,
  invariants: { rootScale: [1, 1, 1] }
});

const project = (productId, layoutId, options = {}) => ({
  productId,
  layoutId,
  category: options.category,
  style: options.style,
  measurements: options.measurements || {},
  finish: options.finish || "natural-oak",
  accentFinish: options.accentFinish || "natural-oak",
  doorStyle: options.doorStyle || "shaker",
  hardware: options.hardware || "brass-pull",
  lighting: options.lighting || "warm-led",
  baseStyle: options.baseStyle || "flush-base",
  topTreatment: options.topTreatment || "small-crown"
});

const findBySuffix = (result, suffix) => result.descriptorSets
  .flatMap((set) => set.components)
  .find((item) => item.id.endsWith(`/${suffix}`));

const byRole = (result, role) => result.descriptorSets
  .flatMap((set) => set.components)
  .filter((item) => item.role === role);

const size = (item, axis) => item.bounds.max[axis] - item.bounds.min[axis];

test("guided product identity and pre-fit intent preserve the seven public choices", () => {
  assert.equal(resolveGuidedProductId({ category: "bookcase", style: "cabinet-base-shelves" }), "cabinet-shelves");
  assert.equal(resolveGuidedProductId({ category: "tv-unit", style: "framed-tv-wall" }), "tv-unit");
  assert.equal(resolveGuidedProductId({ productId: "radiator-cover" }), "radiator-cover");

  const topology = room("window-wall", {
    installationZones: [
      { id: "left", role: "left", leftPlaneX: -60, rightPlaneX: -31 },
      { id: "below-window", role: "below-window", leftPlaneX: -30, rightPlaneX: 30 }
    ]
  });
  const windowIntent = createGuidedProductIntent(
    project("window-storage", "window-wall", { measurements: { mountingHeight: 18 } }),
    topology
  );
  assert.equal(windowIntent.accepted, true);
  assert.equal(windowIntent.installationMode, "fitted");
  assert.deepEqual(windowIntent.installationZoneIds, ["below-window"]);
  assert.ok(windowIntent.zoneRoles.includes("below-window"));

  const bookcaseWindowIntent = createGuidedProductIntent(
    project("cabinet-shelves", "window-wall"),
    room("window-wall", {
      installationZones: [
        { id: "left", role: "left", leftPlaneX: -60, rightPlaneX: -31 },
        { id: "below-window", role: "below-window", leftPlaneX: -30, rightPlaneX: 30 },
        { id: "right", role: "right", leftPlaneX: 31, rightPlaneX: 60 }
      ]
    })
  );
  assert.deepEqual(bookcaseWindowIntent.preferredZoneIds, ["left", "right"]);

  const floatingIntent = createGuidedProductIntent(project("floating-storage", "clear-wall", {
    measurements: { mountingHeight: 18 }
  }), room("clear-wall"));
  assert.equal(floatingIntent.installationMode, "floating");
  assert.equal(floatingIntent.mountingHeight, 18);
});

test("compatibility reports status, required fields, and fail-closed unavailable pairs", () => {
  const conditional = resolveProductLayoutCompatibility({
    project: project("cabinet-shelves", "fireplace-wall"),
    topology: room("fireplace-wall")
  });
  assert.equal(conditional.status, "conditional");
  assert.equal(conditional.ready, false);
  assert.deepEqual(conditional.missingFields, ["fireplaceWidth", "fireplaceHeight", "fireplaceDepth"]);

  const ready = resolveProductLayoutCompatibility({
    project: project("cabinet-shelves", "fireplace-wall", {
      measurements: { fireplaceWidth: 42, fireplaceHeight: 32, fireplaceDepth: 0 }
    }),
    topology: room("fireplace-wall")
  });
  assert.equal(ready.ready, true);

  const unavailable = createGuidedProductCandidate({
    project: project("window-storage", "fireplace-wall", {
      measurements: { windowWidth: 60, windowHeight: 48, sillHeight: 30 }
    }),
    topology: room("fireplace-wall"),
    fit: acceptedFit(installation())
  });
  assert.equal(unavailable.accepted, false);
  assert.equal(unavailable.errors[0].code, GUIDED_PRODUCT_FAILURES.unsupportedLayout);

  const fireplaceTvNo = resolveProductLayoutCompatibility({
    project: project("tv-unit", "fireplace-wall", {
      measurements: { tvScreenSize: 65, tvAboveFireplace: "no" }
    }),
    topology: room("fireplace-wall")
  });
  assert.equal(fireplaceTvNo.status, "unavailable");
  assert.equal(fireplaceTvNo.ready, false);

  const fireplaceTvYes = resolveProductLayoutCompatibility({
    project: project("tv-unit", "fireplace-wall", {
      measurements: { tvScreenSize: 65, tvAboveFireplace: "yes" }
    }),
    topology: room("fireplace-wall")
  });
  assert.equal(fireplaceTvYes.status, "review-only");
  assert.equal(fireplaceTvYes.ready, true);

  const overMantelTopology = room("fireplace-wall", {
    installationZones: [
      { id: "left-of-fireplace", role: "left", leftPlaneX: -60, rightPlaneX: -30 },
      { id: "optional-over-mantel", role: "optional-over-mantel", leftPlaneX: -30, rightPlaneX: 30 }
    ]
  });
  assert.deepEqual(
    createGuidedProductIntent(project("tv-unit", "fireplace-wall", {
      measurements: { tvScreenSize: 65, tvAboveFireplace: "no" }
    }), overMantelTopology).preferredZoneIds,
    []
  );
  assert.deepEqual(
    createGuidedProductIntent(project("tv-unit", "fireplace-wall", {
      measurements: { tvScreenSize: 65, tvAboveFireplace: "yes" }
    }), overMantelTopology).preferredZoneIds,
    ["optional-over-mantel"]
  );
});

test("TV body, opening, service clearance, and soundbar geometry derive from real measurements", () => {
  const diagonalOnly = deriveCanonicalTvGeometry({ tvScreenSize: 65, soundbarRequired: "no" });
  assert.equal(diagonalOnly.accepted, true);
  assert.ok(Math.abs(diagonalOnly.body.width - 56.65241) < 1e-6);
  assert.ok(Math.abs(diagonalOnly.body.height - 31.8670) < 0.001);
  assert.ok(Math.abs(diagonalOnly.opening.width - diagonalOnly.body.width - 4) < 1e-6);
  assert.ok(Math.abs(diagonalOnly.opening.height - diagonalOnly.body.height - 4) < 1e-6);
  assert.equal(diagonalOnly.body.derivation.width, "default-aspect-ratio");

  const explicitHeight = deriveCanonicalTvGeometry({
    tvScreenSize: 65,
    tvHeight: 33,
    soundbarRequired: "yes"
  });
  assert.equal(explicitHeight.body.width, 56);
  assert.equal(explicitHeight.body.height, 33);
  assert.deepEqual(explicitHeight.opening, { width: 60, height: 37 });
  assert.equal(explicitHeight.soundbar.zoneHeight, 4.5);
  assert.equal(explicitHeight.requiredAssemblyHeight, 42.5);

  const conflict = deriveCanonicalTvGeometry({ tvScreenSize: 65, tvWidth: 60, tvHeight: 40 });
  assert.equal(conflict.body.width, 60);
  assert.equal(conflict.body.height, 40);
  assert.ok(conflict.warnings.some((warning) => warning.code === "TV_DIMENSIONS_CONFLICT"));

  const impossible = deriveCanonicalTvGeometry({ tvScreenSize: 55, tvHeight: 60 });
  assert.equal(impossible.accepted, false);
  assert.equal(impossible.errors[0].code, GUIDED_PRODUCT_FAILURES.tvDimensions);
});

test("the three public bookcases reuse canonical descriptors and canonical pricing", () => {
  const cases = [
    ["cabinet-shelves", "door"],
    ["drawer-shelves", "drawer_front"],
    ["open-shelving", "shelf"]
  ];
  for (const [productId, expectedRole] of cases) {
    const result = evaluateGuidedProductCandidate({
      project: project(productId, "clear-wall"),
      topology: room("clear-wall"),
      fit: acceptedFit(installation({ width: 96 }))
    });
    assert.equal(result.accepted, true, JSON.stringify(result.errors));
    assert.equal(result.engine, "existing-bookcase");
    assert.equal(result.canonicalEvaluations.length, 1);
    assert.equal(result.canonicalEvaluations[0].evaluation.accepted, true);
    assert.ok(byRole(result, expectedRole).length > 0);
    assert.equal(result.pricingStatus, "canonical");
    assert.ok(result.pricing.total > 0);
    assert.equal(result.descriptorSets[0].validation.valid, true);
  }

  const open = evaluateGuidedProductCandidate({
    project: project("open-shelving", "clear-wall"),
    topology: room("clear-wall"),
    fit: acceptedFit(installation({ width: 96 }))
  });
  assert.equal(byRole(open, "door").length, 0);
  assert.equal(byRole(open, "drawer_front").length, 0);
  assert.equal(byRole(open, "handle").length, 0);
});

test("single-zone project pricing remains identical to its canonical breakdown", () => {
  const input = {
    project: project("cabinet-shelves", "clear-wall"),
    topology: room("clear-wall"),
    fit: acceptedFit(installation({ width: 96, depth: 16 }))
  };
  const first = evaluateGuidedProductCandidate(input);
  const repeated = evaluateGuidedProductCandidate(structuredClone(input));
  assert.equal(first.accepted, true, JSON.stringify(first.errors));
  const canonical = first.pricing.installations[0].breakdown;
  assert.equal(first.pricing.total, canonical.total);
  assert.equal(first.pricing.subtotalBeforeMultipliers, canonical.subtotalBeforeMultipliers);
  assert.deepEqual(first.pricing.multipliers, canonical.multipliers);
  assert.equal(first.pricing.subtotal, canonical.subtotal);
  assert.equal(first.pricing.minimumApplied, canonical.minimumApplied);
  assert.equal(first.pricing.roundingIncrement, canonical.roundingIncrement);
  assert.deepEqual(
    first.pricing.lineItems.map(({ sourceInstallationIds, ...line }) => line),
    canonical.lineItems
  );
  assert.deepEqual(repeated.pricing, first.pricing);
});

test("the 120 by 96 right-niche TV golden keeps a measured opening and no random frame", () => {
  const result = evaluateGuidedProductCandidate({
    project: project("tv-unit", "right-niche", {
      measurements: {
        wallWidth: 120,
        ceilingHeight: 96,
        desiredDepth: 14,
        nicheWidth: 96,
        tvScreenSize: 65,
        tvHeight: 33,
        soundbarRequired: "yes"
      }
    }),
    topology: room("right-niche"),
    fit: acceptedFit(installation({ width: 93, height: 96, depth: 14 }))
  });
  assert.equal(result.accepted, true, JSON.stringify(result.errors));
  assert.equal(result.engine, "existing-bookcase-media-adapter");

  assert.deepEqual(result.tv.body, {
    width: 56,
    height: 33,
    derivation: {
      width: "diagonal-and-explicit-height",
      height: null
    }
  });
  assert.deepEqual(result.tv.opening, { width: 60, height: 37 });
  assert.deepEqual(result.tv.soundbar, {
    required: true,
    zoneHeight: 4.5,
    ventilationClearance: 1
  });
  assert.equal(result.tv.requiredAssemblyHeight, 42.5);

  const tv = findBySuffix(result, "tv-body");
  const opening = findBySuffix(result, "tv-service-opening");
  const soundbar = findBySuffix(result, "soundbar-equipment-zone");
  assert.equal(size(tv, "x"), 56);
  assert.equal(size(tv, "y"), 33);
  assert.equal(size(opening, "x"), 60);
  assert.equal(size(opening, "y"), 37);
  assert.equal(size(soundbar, "y"), 4.5);
  assert.equal(opening.metadata.noDecorativeFrame, true);
  assert.equal(result.descriptorSets.flatMap((set) => set.components).some((item) => /tv.*frame|frame.*tv/i.test(item.id)), false);
  assert.ok(findBySuffix(result, "media-console-top"));
  assert.ok(byRole(result, "door").some((item) => item.id.includes("media-console-door")));
  assert.equal(findBySuffix(result, "feature-zone").metadata.memberSectionIds.length, 1);
  assert.equal(byRole(result, "section").length, 3);

  const manifestIds = new Set(result.renderManifest.entries.map((entry) => entry.componentId));
  assert.ok(manifestIds.has(tv.id));
  assert.equal(manifestIds.has(opening.id), false);

  const descriptorSet = result.descriptorSets[0];
  const evaluation = result.canonicalEvaluations[0].evaluation;
  const pricing = result.pricing.installations[0];
  const quantities = pricing.breakdown.acceptedDescriptorGraph;
  assert.equal(result.pricingStatus, "canonical");
  assert.equal(result.pricing.basis, "final-accepted-descriptor-graph");
  assert.equal(pricing.basis, "final-accepted-descriptor-graph");
  assert.deepEqual(evaluation.layout.components, descriptorSet.components);
  assert.equal(evaluation.layoutFingerprint, evaluation.bom.layoutFingerprint);
  assert.equal(evaluation.layoutFingerprint, pricing.breakdown.bom.layoutFingerprint);
  assert.equal(quantities.source, "final-accepted-descriptor-graph");
  assert.equal(quantities.componentCount, 32);
  assert.equal(quantities.byRole.door, 5);
  assert.equal(quantities.byRole.fixed_shelf, 3);
  assert.equal(quantities.byRole.door, byRole(result, "door").length);
  assert.equal(quantities.byRole.fixed_shelf, byRole(result, "fixed_shelf").length);
  assert.equal(quantities.byRole.backing_panel, 1);
  assert.equal(quantities.byRole.screen, undefined);
  assert.equal(quantities.componentCount, quantities.componentIds.length);
  assert.ok(quantities.componentIds.every((id) => descriptorSet.components.some((item) => item.id === id)));
  assert.deepEqual(quantities.customerEquipmentIds, [tv.id]);
  assert.equal(evaluation.bom.doors.count, quantities.byRole.door);
  assert.equal(evaluation.bom.shelves.fixedCount, quantities.byRole.fixed_shelf);
  assert.equal(
    pricing.breakdown.lineItems.find((item) => item.code === "DOOR_STYLE_FLAT").quantity,
    quantities.byRole.door
  );
  assert.equal(result.pricing.total, pricing.breakdown.total);
  assert.equal(
    result.pricing.lineItems.find((item) => item.code === "DOOR_STYLE_FLAT").quantity,
    quantities.byRole.door
  );
  for (const projectCode of ["BASE_PROJECT", "INSTALLATION", "DELIVERY"]) {
    assert.equal(result.pricing.lineItems.filter((item) => item.code === projectCode).length, 1);
  }
});

test("TV changes rebuild the media geometry, while cabinet finish does not", () => {
  const base = {
    topology: room("clear-wall"),
    fit: acceptedFit(installation({ width: 120, height: 96, depth: 15 }))
  };
  const first = evaluateGuidedProductCandidate({
    ...base,
    project: project("tv-unit", "clear-wall", {
      finish: "natural-oak",
      measurements: { tvScreenSize: 55, soundbarRequired: "no" }
    })
  });
  const finishOnly = evaluateGuidedProductCandidate({
    ...base,
    project: project("tv-unit", "clear-wall", {
      finish: "dark-walnut",
      measurements: { tvScreenSize: 55, soundbarRequired: "no" }
    })
  });
  const largerTv = evaluateGuidedProductCandidate({
    ...base,
    project: project("tv-unit", "clear-wall", {
      finish: "dark-walnut",
      measurements: { tvScreenSize: 65, soundbarRequired: "no" }
    })
  });
  const soundbar = evaluateGuidedProductCandidate({
    ...base,
    project: project("tv-unit", "clear-wall", {
      finish: "natural-oak",
      measurements: { tvScreenSize: 55, soundbarRequired: "yes" }
    })
  });
  assert.equal(first.accepted, true);
  assert.equal(finishOnly.accepted, true);
  assert.equal(largerTv.accepted, true);
  assert.equal(soundbar.accepted, true);
  assert.equal(first.geometryFingerprint, finishOnly.geometryFingerprint);
  assert.notDeepEqual(first.materialState.assignments, finishOnly.materialState.assignments);
  assert.notEqual(first.geometryFingerprint, largerTv.geometryFingerprint);
  assert.notEqual(first.geometryFingerprint, soundbar.geometryFingerprint);
  assert.equal(first.tv.soundbar.required, false);
  assert.equal(soundbar.tv.soundbar.required, true);
  assert.equal(soundbar.tv.requiredAssemblyHeight, first.tv.opening.height + 5.5);
  assert.notDeepEqual(first.tv.body, largerTv.tv.body);
  assert.notDeepEqual(first.tv.opening, largerTv.tv.opening);

  for (const candidate of [first, finishOnly, largerTv, soundbar]) {
    const evaluation = candidate.canonicalEvaluations[0].evaluation;
    const pricing = candidate.pricing.installations[0];
    assert.equal(candidate.pricing.basis, "final-accepted-descriptor-graph");
    assert.equal(pricing.basis, "final-accepted-descriptor-graph");
    assert.equal(pricing.breakdown.bom.layoutFingerprint, evaluation.layoutFingerprint);
    assert.deepEqual(evaluation.layout.components, candidate.descriptorSets[0].components);
  }
  assert.notEqual(
    first.pricing.installations[0].breakdown.bom.layoutFingerprint,
    largerTv.pricing.installations[0].breakdown.bom.layoutFingerprint
  );
  assert.notEqual(
    first.pricing.installations[0].breakdown.bom.layoutFingerprint,
    soundbar.pricing.installations[0].breakdown.bom.layoutFingerprint
  );
  assert.deepEqual(
    first.pricing.installations[0].breakdown.acceptedDescriptorGraph,
    soundbar.pricing.installations[0].breakdown.acceptedDescriptorGraph
  );
});

test("hardware and lighting selections remain outside the physical geometry fingerprint", () => {
  const input = {
    topology: room("clear-wall"),
    fit: acceptedFit(installation({ width: 96 }))
  };
  const choices = [
    { hardware: "brass-pull", lighting: "warm-led" },
    { hardware: "black-pull", lighting: "warm-led" },
    { hardware: "knob", lighting: "warm-led" },
    { hardware: "none", lighting: "warm-led" },
    { hardware: "brass-pull", lighting: "no-lighting" },
    { hardware: "brass-pull", lighting: "integrated-led" }
  ].map((options) => evaluateGuidedProductCandidate({
    ...input,
    project: project("cabinet-shelves", "clear-wall", options)
  }));

  for (const candidate of choices) assert.equal(candidate.accepted, true);
  assert.equal(new Set(choices.map(({ geometryFingerprint }) => geometryFingerprint)).size, 1);
  assert.equal(new Set(choices.map(({ materialState }) => JSON.stringify(materialState))).size, choices.length);

  const structuralGraph = (candidate) => candidate.descriptorSets.map((set) => ({
    id: set.id,
    installationId: set.installationId,
    zoneId: set.zoneId,
    physicalBounds: set.physicalBounds,
    transform: set.transform,
    components: set.components.filter(({ role }) => !["handle", "light"].includes(role))
  }));
  for (const candidate of choices.slice(1)) {
    assert.deepEqual(structuralGraph(candidate), structuralGraph(choices[0]));
  }

  const [warm, noLighting, integrated] = [choices[0], choices[4], choices[5]];
  assert.equal(byRole(noLighting, "light").length, 0);
  assert.ok(byRole(warm, "light").length > 0);
  assert.ok(byRole(integrated, "light").length > byRole(warm, "light").length);
  assert.notDeepEqual(noLighting.renderManifest, warm.renderManifest);
  assert.notDeepEqual(warm.renderManifest, integrated.renderManifest);

  const lightingCharge = (candidate) => candidate.pricing.installations[0].breakdown.lineItems
    .filter(({ code }) => code.startsWith("LIGHTING_"))
    .reduce((sum, item) => sum + item.amount, 0);
  assert.equal(lightingCharge(noLighting), 0);
  assert.ok(lightingCharge(warm) > 0);
  assert.ok(lightingCharge(integrated) > lightingCharge(warm));
});

test("Floating Storage is deterministic, wall mounted, base-free, and price-safe", () => {
  const input = {
    project: project("floating-storage", "clear-wall", {
      measurements: { wallWidth: 120, ceilingHeight: 96, desiredDepth: 16, mountingHeight: 18 }
    }),
    topology: room("clear-wall"),
    fit: acceptedFit(installation({ mode: "floating", width: 118, height: 78, depth: 16, bottomY: 18 }))
  };
  const first = evaluateGuidedProductCandidate(input);
  const second = evaluateGuidedProductCandidate(structuredClone(input));
  assert.equal(first.accepted, true, JSON.stringify(first.errors));
  assert.deepEqual(first.descriptorSets, second.descriptorSets);
  assert.deepEqual(first.renderManifest, second.renderManifest);
  assert.equal(first.geometryFingerprint, second.geometryFingerprint);
  assert.equal(first.descriptorSets[0].transform.translation.y, 18);
  assert.equal(first.descriptorSets[0].rootScale.join("/"), "1/1/1");
  assert.equal(byRole(first, "base").length, 0);
  assert.equal(byRole(first, "crown").length, 0);
  assert.equal(first.pricing, null);
  assert.equal(first.pricingStatus, "unavailable");
  assert.ok(findBySuffix(first, "floating-mounting-rail"));
  assert.equal(Object.isFrozen(first), true);
});

test("Window Storage terminates below the sill and rejects unresolved radiator conflicts", () => {
  const windowFeature = {
    id: "window",
    kind: "window",
    bounds: { min: { x: -30, y: 30, z: 0 }, max: { x: 30, y: 78, z: 1 } }
  };
  const baseInput = {
    project: project("window-storage", "window-wall", {
      measurements: { windowWidth: 60, windowHeight: 48, sillHeight: 30, radiatorBelowWindow: "no" }
    }),
    topology: room("window-wall", { features: { window: windowFeature } }),
    fit: acceptedFit(installation({ id: "window-fit", zoneId: "below-window", role: "below-window", width: 60, height: 29, depth: 18 }))
  };
  const result = evaluateGuidedProductCandidate(baseInput);
  assert.equal(result.accepted, true, JSON.stringify(result.errors));
  assert.equal(findBySuffix(result, "window-seat-top").bounds.max.y, 29);
  assert.equal(findBySuffix(result, "window-opening-clearance").bounds.max.y, 30);
  assert.equal(result.pricingStatus, "unavailable");

  const blocked = evaluateGuidedProductCandidate({
    ...baseInput,
    project: project("window-storage", "window-wall", {
      measurements: { windowWidth: 60, windowHeight: 48, sillHeight: 30, radiatorBelowWindow: "yes" }
    })
  });
  assert.equal(blocked.accepted, false);
  assert.equal(blocked.errors[0].code, GUIDED_PRODUCT_ENGINE_FAILURES.windowRadiator);
});

test("Radiator Cover emits an explicit obstruction, service envelope, and ventilated removable face", () => {
  const radiatorFeature = {
    id: "radiator",
    kind: "radiator",
    bounds: { min: { x: -24, y: 0, z: 5 }, max: { x: 24, y: 26, z: 14 } }
  };
  const result = evaluateGuidedProductCandidate({
    project: project("radiator-cover", "window-wall", {
      measurements: { radiatorWidth: 48, radiatorHeight: 26, radiatorDepth: 9, valveLocation: "right" }
    }),
    topology: room("window-wall", { features: { radiator: radiatorFeature } }),
    fit: acceptedFit(installation({ id: "radiator-fit", zoneId: "below-window", role: "below-window", width: 57.5, height: 31, depth: 14 }))
  });
  assert.equal(result.accepted, true, JSON.stringify(result.errors));
  const descriptorSet = result.descriptorSets[0];
  const root = findBySuffix(result, "radiator-cover");
  assert.equal(size(root, "x"), 57.5);
  assert.equal(size(root, "y"), 31);
  assert.equal(size(root, "z"), 14);
  assert.deepEqual(descriptorSet.physicalBounds, root.bounds);
  assert.equal(root.metadata.fitEnvelopeContract, "accepted-fit-exact");

  const radiator = findBySuffix(result, "radiator-body");
  const service = findBySuffix(result, "radiator-service-envelope");
  assert.equal(size(service, "x"), 52);
  assert.equal(size(service, "y"), 28);
  assert.equal(size(service, "z"), 11);
  assert.equal(service.metadata.clearance, 2);
  const frontPlinth = findBySuffix(result, "installation-treatment-base-plinth");
  assert.equal(frontPlinth.role, "plinth");
  assert.equal(frontPlinth.metadata.installationTreatment.position, "base");
  assert.ok(frontPlinth.bounds.max.z <= service.bounds.min.z);
  for (const component of [radiator, service, ...byRole(result, "slat")]) {
    for (const axis of ["x", "y", "z"]) {
      assert.ok(component.bounds.min[axis] >= root.bounds.min[axis]);
      assert.ok(component.bounds.max[axis] <= root.bounds.max[axis]);
    }
  }
  assert.ok(byRole(result, "slat").length > 20);
  assert.ok(byRole(result, "slat").every((slat) => slat.bounds.max.z <= service.bounds.min.z));
  assert.equal(byRole(result, "back_panel").length, 0);
  assert.equal(result.pricing, null);
  assert.ok(result.warnings.some((warning) => warning.code === "RADIATOR_VENTILATION_ENGINEERING_REVIEW"));
});

test("Radiator Cover rejects a depth that cannot preserve service clearance behind its removable face", () => {
  const result = evaluateGuidedProductCandidate({
    project: project("radiator-cover", "window-wall", {
      measurements: { radiatorWidth: 48, radiatorHeight: 26, radiatorDepth: 9 }
    }),
    topology: room("window-wall", {
      features: {
        radiator: {
          id: "radiator",
          kind: "radiator",
          bounds: { min: { x: -24, y: 0, z: 0 }, max: { x: 24, y: 26, z: 9 } }
        }
      }
    }),
    fit: acceptedFit(installation({
      id: "radiator-shallow-fit",
      zoneId: "below-window",
      role: "below-window",
      width: 57.5,
      height: 31,
      depth: 11.5
    }))
  });

  assert.equal(result.accepted, false);
  assert.equal(result.errors[0].code, GUIDED_PRODUCT_ENGINE_FAILURES.radiatorFit);
  assert.deepEqual(result.errors[0].required, {
    width: 52,
    height: 28.75,
    depth: 11.75,
    serviceDepth: 11,
    removableFaceThickness: 0.75
  });
});

test("multi-zone canonical products keep global IDs stable and price one accepted project", () => {
  const left = installation({ id: "left-fit", zoneId: "left", role: "left", width: 48, depth: 16, centerX: -50 });
  const right = installation({ id: "right-fit", zoneId: "right", role: "right", width: 48, depth: 16, centerX: 50 });
  const input = {
    project: project("cabinet-shelves", "fireplace-wall", {
      measurements: { fireplaceWidth: 42, fireplaceHeight: 32, fireplaceDepth: 8 }
    }),
    topology: room("fireplace-wall"),
    fit: acceptedFit(left, right)
  };
  const result = evaluateGuidedProductCandidate(input);
  const repeated = evaluateGuidedProductCandidate(structuredClone(input));
  assert.equal(result.accepted, true, JSON.stringify(result.errors));
  assert.equal(result.descriptorSets.length, 2);
  assert.equal(result.canonicalEvaluations.length, 2);
  const ids = result.descriptorSets.flatMap((set) => set.components.map((item) => item.id));
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.some((id) => id.startsWith("guided-left-fit/")));
  assert.ok(ids.some((id) => id.startsWith("guided-right-fit/")));
  const canonicalSum = result.canonicalEvaluations.reduce((sum, item) => sum + item.evaluation.pricing.total, 0);
  assert.ok(result.pricing.total < canonicalSum);
  assert.equal(result.pricing.aggregation, "single-project-canonical-line-items");
  assert.equal(result.pricing.acceptedCaseworkWidthIn, 96);
  assert.equal(result.pricing.available, true);
  assert.equal(result.pricing.multipliers.depth, 1.08);
  assert.equal(
    result.pricing.subtotal,
    Math.round((result.pricing.subtotalBeforeMultipliers * 1.08 + Number.EPSILON) * 100) / 100
  );
  for (const code of ["BASE_PROJECT", "INSTALLATION", "DELIVERY"]) {
    assert.equal(result.pricing.lineItems.filter((item) => item.code === code).length, 1);
  }
  const envelope = result.pricing.lineItems.find((item) => item.code === "ENVELOPE_AREA");
  assert.equal(envelope.quantity, result.pricing.installations.reduce((sum, item) => (
    sum + item.breakdown.lineItems.find((line) => line.code === "ENVELOPE_AREA").quantity
  ), 0));
  assert.deepEqual(repeated.pricing, result.pricing);
});

test("the explicit corner join keeps its 13-inch fit and uses deterministic physical descriptors", () => {
  const primary = installation({
    id: "primary-fit",
    zoneId: "primary-run",
    role: "primary-run",
    width: 96,
    depth: 13,
    centerX: -6
  });
  const returning = installation({
    id: "return-fit",
    zoneId: "return-run",
    role: "return-run",
    width: 48,
    depth: 13,
    centerX: 36,
    orientation: {
      origin: { x: 60, y: 0, z: 0 },
      widthAxis: [0, 0, -1],
      heightAxis: [0, 1, 0],
      depthAxis: [-1, 0, 0]
    }
  });
  const corner = installation({
    id: "corner-fit",
    zoneId: "corner",
    role: "corner-join",
    width: 13,
    depth: 13,
    centerX: 6.5,
    zoneBounds: { left: 0, right: 13, bottom: 0, top: 96, back: 0 },
    orientation: {
      origin: { x: 47, y: 0, z: 0 },
      widthAxis: [1, 0, 0],
      heightAxis: [0, 1, 0],
      depthAxis: [0, 0, -1]
    }
  });
  const input = {
    project: project("open-shelving", "corner-wall", {
      measurements: { wallWidth: 120, ceilingHeight: 96, desiredDepth: 13, cornerReturn: 60 }
    }),
    topology: room("corner-wall", { layoutKind: "l-shaped-corner" }),
    fit: acceptedFit(primary, returning, corner)
  };

  const first = evaluateGuidedProductCandidate(input);
  const repeated = evaluateGuidedProductCandidate(structuredClone(input));
  assert.equal(first.accepted, true, JSON.stringify(first.errors));
  assert.equal(first.descriptorSets.length, 3);
  assert.deepEqual(
    first.descriptorSets.map((set) => [set.installationId, set.zoneId]),
    [["primary-fit", "primary-run"], ["return-fit", "return-run"], ["corner-fit", "corner"]]
  );
  assert.equal(first.canonicalConfigs.length, 2);
  assert.equal(first.canonicalConfigs.some((entry) => entry.installationId === "corner-fit"), false);
  assert.equal(first.canonicalEvaluations.length, 2);

  const cornerSet = first.descriptorSets.find((set) => set.installationId === "corner-fit");
  assert.ok(cornerSet);
  assert.equal(cornerSet.id, "guided-corner-fit");
  assert.equal(cornerSet.installationContract.role, "corner-join");
  assert.deepEqual(cornerSet.rootScale, [1, 1, 1]);
  assert.equal(size({ bounds: cornerSet.bounds }, "x"), 13);
  assert.equal(size({ bounds: cornerSet.bounds }, "y"), 96);
  assert.equal(size({ bounds: cornerSet.bounds }, "z"), 13);
  assert.equal(cornerSet.canonicalLayoutFingerprint, null);
  assert.equal(cornerSet.canonicalRenderContract, null);
  assert.equal(cornerSet.validation.valid, true, JSON.stringify(cornerSet.validation.errors));

  const cornerRoot = cornerSet.components.find((item) => item.id.endsWith("/corner-join"));
  assert.deepEqual(cornerRoot.metadata.joinsInstallationIds, ["primary-fit", "return-fit"]);
  assert.ok(cornerSet.components.some((item) => item.id.endsWith("/corner-join-primary-spine")));
  assert.ok(cornerSet.components.some((item) => item.id.endsWith("/corner-join-return-spine")));
  assert.ok(cornerSet.components.some((item) => item.role === "shelf"));
  assert.ok(first.renderManifest.entries
    .filter((entry) => entry.installationId === "corner-fit")
    .every((entry) => entry.materialSlot));

  assert.equal(first.pricingStatus, "design-review");
  assert.equal(first.pricing.available, false);
  assert.equal(first.pricing.total, null);
  assert.ok(first.pricing.provisionalCanonicalTotal > 0);
  assert.equal(first.pricing.acceptedCaseworkWidthIn, 157);
  assert.deepEqual(first.pricing.unpricedDescriptorSets.map((set) => [
    set.installationId,
    set.installationRole
  ]), [["corner-fit", "corner-join"]]);
  assert.ok(first.pricing.unpricedDescriptorSets[0].billableComponentCount > 0);

  assert.deepEqual(repeated.descriptorSets, first.descriptorSets);
  assert.equal(repeated.geometryFingerprint, first.geometryFingerprint);
  assert.deepEqual(repeated.pricing, first.pricing);
});

test("named failures reject invalid fit, impossible TV, and canonical dimension correction", () => {
  const invalidScale = evaluateGuidedProductCandidate({
    project: project("cabinet-shelves", "clear-wall"),
    topology: room("clear-wall"),
    fit: acceptedFit(installation({ rootScale: [0.8, 1, 1] }))
  });
  assert.equal(invalidScale.accepted, false);
  assert.equal(invalidScale.errors[0].code, GUIDED_PRODUCT_FAILURES.globalScale);

  const impossibleTv = evaluateGuidedProductCandidate({
    project: project("tv-unit", "clear-wall", { measurements: { tvScreenSize: 65, tvHeight: 33 } }),
    topology: room("clear-wall"),
    fit: acceptedFit(installation({ width: 50 }))
  });
  assert.equal(impossibleTv.accepted, false);
  assert.equal(impossibleTv.errors[0].code, GUIDED_PRODUCT_ENGINE_FAILURES.tvOpeningFit);
  assert.ok(impossibleTv.errors[0].resolutions.includes("smaller-tv"));

  const corrected = evaluateGuidedProductCandidate({
    project: project("cabinet-shelves", "clear-wall"),
    topology: room("clear-wall"),
    fit: acceptedFit(installation({ width: 20 }))
  });
  assert.equal(corrected.accepted, false);
  assert.equal(corrected.errors[0].code, GUIDED_PRODUCT_ENGINE_FAILURES.canonicalDimensionDrift);

  const duplicateTv = evaluateGuidedProductCandidate({
    project: project("tv-unit", "clear-wall", { measurements: { tvScreenSize: 55 } }),
    topology: room("clear-wall"),
    fit: acceptedFit(
      installation({ id: "left", zoneId: "left", role: "left" }),
      installation({ id: "right", zoneId: "right", role: "right" })
    )
  });
  assert.equal(duplicateTv.accepted, false);
  assert.equal(duplicateTv.errors[0].code, GUIDED_PRODUCT_FAILURES.tvZone);
});

test("fingerprint and manifest helpers are deterministic and material independent", () => {
  const input = {
    project: project("cabinet-shelves", "clear-wall"),
    topology: room("clear-wall"),
    fit: acceptedFit(installation())
  };
  const result = evaluateGuidedProductCandidate(input);
  assert.equal(result.accepted, true);
  assert.equal(
    createGuidedGeometryFingerprint(result.descriptorSets, {
      productId: result.productId,
      layoutId: result.layoutId,
      topologyRef: result.topologyRef,
      fitRef: result.fitRef
    }),
    result.geometryFingerprint
  );
  assert.deepEqual(createGuidedRenderManifest(result.descriptorSets), result.renderManifest);
  assert.equal(result.renderManifest.expectedCount, result.renderManifest.entries.length);
  assert.equal(new Set(result.renderManifest.entries.map((entry) => entry.componentId)).size, result.renderManifest.entries.length);
  assert.ok(result.renderManifest.entries.every((entry) => entry.materialSlot));
  assert.ok(result.descriptorSets.every((set) => set.components.every((item) => (
    item.bounds.min.x >= set.bounds.min.x && item.bounds.max.x <= set.bounds.max.x &&
    item.bounds.min.y >= set.bounds.min.y && item.bounds.max.y <= set.bounds.max.y &&
    item.bounds.min.z >= set.bounds.min.z && item.bounds.max.z <= set.bounds.max.z
  ))));
});
