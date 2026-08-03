import test from "node:test";
import assert from "node:assert/strict";

import {
  GUIDED_PRODUCT_LAYOUT_COMPATIBILITY
} from "../guided-product-adapter.js";
import {
  createGuidedAcceptedSnapshot,
  evaluateGuidedProjectCandidate,
  restoreGuidedAcceptedSnapshot
} from "../guided-project-engine.js";
import {
  createGuidedSceneDescriptors,
  transformGuidedBoundsToWorld,
  transformGuidedPointToWorld
} from "../guided-render-contract.js";

const EPSILON = 0.001;
const VARIANTS_PER_PAIR = 6;
const PRODUCTS = Object.freeze([
  "cabinet-shelves",
  "drawer-shelves",
  "open-shelving",
  "tv-unit",
  "floating-storage",
  "window-storage",
  "radiator-cover"
]);
const LAYOUTS = Object.freeze([
  "niche-layout",
  "left-niche",
  "right-niche",
  "clear-wall",
  "fireplace-wall",
  "center-recess",
  "window-wall",
  "door-wall",
  "corner-wall",
  "double-opening"
]);
const APPEARANCE_FIXTURE_ROLES = new Set(["handle", "light"]);
const FULLY_CONTAINING_PARENT_ROLES = new Set([
  "section_group",
  "section",
  "opening"
]);

test("the seeded full-matrix generator is deterministic and covers 420 compatibility cases", () => {
  const first = createMatrixCases(0x51a7f00d);
  const repeated = createMatrixCases(0x51a7f00d);

  assert.deepEqual(repeated, first);
  assert.equal(first.length, PRODUCTS.length * LAYOUTS.length * VARIANTS_PER_PAIR);
  assert.equal(new Set(first.map(({ key }) => key)).size, first.length);
  assert.deepEqual(new Set(first.map(({ productId }) => productId)), new Set(PRODUCTS));
  assert.deepEqual(new Set(first.map(({ layoutId }) => layoutId)), new Set(LAYOUTS));
});

test("all reachable product/topology candidates pass the physical quality gate and unavailable pairs fail closed", () => {
  const cases = createMatrixCases(0x51a7f00d);
  const failures = [];
  let acceptedCount = 0;
  let unavailableCount = 0;
  let drawing4RejectedCount = 0;

  for (const matrixCase of cases) {
    try {
      const specification = evaluateGuidedProjectCandidate(matrixCase.project);
      if (matrixCase.status === "unavailable") {
        unavailableCount += 1;
        assert.equal(specification.accepted, false, `${matrixCase.key} unexpectedly accepted`);
        assert.equal(specification.stage, "product-compatibility", `${matrixCase.key} rejected at the wrong stage`);
        assert.equal(
          specification.errors?.[0]?.code,
          "UNSUPPORTED_PRODUCT_LAYOUT",
          `${matrixCase.key} did not fail with the closed compatibility diagnostic`
        );
        continue;
      }

      if (specification.errors?.[0]?.code === "TV_DRAWING_4_TEMPLATE_FIT_REJECTED") {
        drawing4RejectedCount += 1;
        assert.equal(matrixCase.productId, "tv-unit", matrixCase.key);
        assert.equal(specification.accepted, false, matrixCase.key);
        assert.equal(specification.stage, "product-geometry", matrixCase.key);
        assert.match(
          specification.errors[0]?.reason || "",
          /^(SIDE_MODULE_PAIRED_DOORS_UNBUILDABLE|SIDE_MODULE_SHELF_SPAN_EXCEEDED)$/,
          matrixCase.key
        );
        continue;
      }

      acceptedCount += 1;
      assert.equal(
        specification.accepted,
        true,
        `${matrixCase.key}: ${specification.stage || "unknown"} ${JSON.stringify(specification.errors || [])}`
      );
      assert.equal(specification.audit.valid, true, `${matrixCase.key} failed its built-in audit`);
      assertAcceptedScaleContract(specification, matrixCase.key);
      assertWorldBoundsStayInsideZones(specification, matrixCase.key);
      assertDescriptorSolidsAvoidExclusions(specification, matrixCase.key);
      assertSemanticHierarchyContainment(specification, matrixCase.key);
      assertTreatmentAndManifestParity(specification, matrixCase.key);
      assertCompactRoundTrip(specification, matrixCase.project, matrixCase.key);
    } catch (error) {
      failures.push({
        key: matrixCase.key,
        status: matrixCase.status,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  assert.equal(acceptedCount, 284, "matrix drift changed the expected accepted reachable-case count");
  assert.equal(drawing4RejectedCount, 16, "matrix drift changed the expected Drawing 4 fit-rejection count");
  assert.equal(unavailableCount, 120, "matrix drift changed the expected unavailable-case count");
  assert.equal(failures.length, 0, summarizeFailures(failures));
});

function createMatrixCases(seed) {
  const cases = [];
  for (const [productIndex, productId] of PRODUCTS.entries()) {
    for (const [layoutIndex, layoutId] of LAYOUTS.entries()) {
      const status = GUIDED_PRODUCT_LAYOUT_COMPATIBILITY[productId]?.[layoutId];
      assert.ok(status, `Missing compatibility entry for ${productId}:${layoutId}`);
      for (let variant = 0; variant < VARIANTS_PER_PAIR; variant += 1) {
        const caseSeed = mixSeed(seed, productIndex, layoutIndex, variant);
        const key = `${productId}:${layoutId}:seed-${caseSeed.toString(16).padStart(8, "0")}`;
        cases.push({
          key,
          productId,
          layoutId,
          status,
          project: createSeededProject(productId, layoutId, variant, caseSeed)
        });
      }
    }
  }
  return cases;
}

function createSeededProject(productId, layoutId, variant, seed) {
  const random = seededRandom(seed);
  const measurements = createMeasurements(layoutId, productId, random);
  if (productId === "tv-unit") {
    // Explicit body dimensions exercise the customer-owned TV contract without
    // putting a derived irrational width exactly on a rounded media-span edge.
    measurements.tvBodyWidth = integer(random, 42, 48);
    measurements.tvBodyHeight = integer(random, 24, 29);
    measurements.tvMounting = ["wall-mounted", "stand-mounted", "not-sure"][variant % 3];
    measurements.outletLocation = ["behind-tv", "near-floor", "unknown"][variant % 3];
    measurements.soundbarRequired = variant % 2 ? "yes" : "no";
    if (layoutId === "fireplace-wall") measurements.tvAboveFireplace = "yes";
  }
  if (productId === "floating-storage") {
    measurements.mountingHeight = halfInch(random, 14, 24);
  }
  if (productId === "radiator-cover") {
    measurements.radiatorBelowWindow = "yes";
    measurements.radiatorWidth = measurements.windowWidth - integer(random, 8, 12);
    measurements.radiatorHeight = measurements.sillHeight - integer(random, 8, 11);
    measurements.radiatorDepth = integer(random, 7, Math.max(7, measurements.desiredDepth - 3));
    measurements.valveLocation = ["left", "right", "both", "unknown"][variant % 4];
  }

  return {
    projectId: `JQ-MATRIX-${seed.toString(36).toUpperCase()}`,
    productId,
    layoutId,
    measurements,
    finish: ["natural-oak", "warm-white", "dark-walnut", "medium-walnut"][variant % 4],
    accentFinish: ["warm-white", "soft-ivory", "natural-oak"][variant % 3],
    doorStyle: ["shaker", "flat-panel", "inset-panel"][variant % 3],
    hardware: ["brass-pull", "matte-black-pull", "none"][variant % 3],
    lighting: ["warm-led", "integrated-led", "no-lighting"][variant % 3],
    baseStyle: "built-in-base",
    topTreatment: ["simple-crown", "flush-scribe", "none"][variant % 3]
  };
}

function createMeasurements(layoutId, productId, random) {
  // The canonical casework engine accepts whole-inch carcass depths. Keep the
  // candidates inside that executable contract so this gate measures physical
  // correctness rather than deliberately exercising input normalization.
  const desiredDepth = integer(random, 12, 17);
  switch (layoutId) {
    case "niche-layout": {
      const wallWidth = integer(random, 120, 144);
      const ceilingHeight = integer(random, 88, 108);
      const leftReturn = integer(random, 8, 14);
      const rightReturn = integer(random, 8, 14);
      return {
        wallWidth,
        ceilingHeight,
        desiredDepth,
        nicheWidth: wallWidth - leftReturn - rightReturn,
        nicheHeight: integer(random, 84, Math.min(104, ceilingHeight)),
        nicheDepth: desiredDepth,
        leftReturn,
        rightReturn
      };
    }
    case "left-niche":
    case "right-niche": {
      const wallWidth = integer(random, 120, 144);
      const ceilingHeight = integer(random, 88, 108);
      const offset = integer(random, 8, 16);
      const side = layoutId === "left-niche" ? "leftReturn" : "rightReturn";
      return {
        wallWidth,
        ceilingHeight,
        desiredDepth,
        nicheWidth: wallWidth - offset,
        nicheHeight: integer(random, 84, Math.min(104, ceilingHeight)),
        nicheDepth: desiredDepth,
        [side]: offset
      };
    }
    case "clear-wall":
      return {
        wallWidth: integer(random, 96, 144),
        ceilingHeight: integer(random, 84, 112),
        desiredDepth
      };
    case "fireplace-wall": {
      const isTv = productId === "tv-unit";
      const fireplaceWidth = integer(random, 36, 46);
      const mantelWidth = integer(random, 52, 60);
      const wallWidth = integer(random, 168, 184);
      return {
        wallWidth,
        ceilingHeight: isTv ? 120 : integer(random, 96, 112),
        desiredDepth,
        fireplaceWidth,
        fireplaceHeight: integer(random, 24, 30),
        fireplaceDepth: integer(random, 6, 10),
        mantelWidth,
        mantelHeight: integer(random, 30, 34),
        fireplaceLeftWidth: Math.floor((wallWidth - mantelWidth - 4) / 2),
        fireplaceRightWidth: Math.floor((wallWidth - mantelWidth - 4) / 2),
        tvAboveFireplace: isTv ? "yes" : "no"
      };
    }
    case "center-recess":
      return {
        wallWidth: integer(random, 156, 180),
        ceilingHeight: integer(random, 96, 112),
        desiredDepth,
        projectionWidth: integer(random, 42, 54),
        projectionHeight: integer(random, 48, 72),
        projectionDepth: integer(random, 6, 10)
      };
    case "window-wall": {
      const wallWidth = integer(random, 144, 160);
      const windowWidth = integer(random, 58, 68);
      const leftDistance = Math.floor((wallWidth - windowWidth) / 2);
      const rightDistance = wallWidth - windowWidth - leftDistance;
      const radiator = productId === "radiator-cover";
      return {
        wallWidth,
        ceilingHeight: integer(random, 96, 112),
        desiredDepth,
        windowWidth,
        windowHeight: integer(random, 40, 48),
        sillHeight: integer(random, 34, 40),
        windowLeftDistance: leftDistance,
        windowRightDistance: rightDistance,
        radiatorBelowWindow: radiator ? "yes" : "no"
      };
    }
    case "door-wall": {
      const wallWidth = integer(random, 144, 160);
      const doorWidth = integer(random, 32, 38);
      const trimWidth = integer(random, 2, 4);
      const leftDistance = productId === "tv-unit"
        ? integer(random, 3, 7)
        : Math.floor((wallWidth - doorWidth) / 2);
      return {
        wallWidth,
        ceilingHeight: integer(random, 96, 112),
        desiredDepth,
        doorWidth,
        doorHeight: integer(random, 78, 84),
        doorLeftDistance: leftDistance,
        doorTrimWidth: trimWidth,
        doorSwing: ["left-in", "right-in", "left-out", "right-out"][integer(random, 0, 3)]
      };
    }
    case "corner-wall":
      return {
        wallWidth: integer(random, 128, 144),
        ceilingHeight: integer(random, 88, 108),
        desiredDepth,
        cornerReturn: integer(random, 58, 72)
      };
    case "double-opening":
      return {
        wallWidth: integer(random, 132, 148),
        ceilingHeight: integer(random, 88, 108),
        desiredDepth,
        openingLeftDistance: integer(random, 16, 24),
        openingRightDistance: integer(random, 16, 24)
      };
    default:
      assert.fail(`Unhandled layout ${layoutId}`);
  }
}

function assertAcceptedScaleContract(specification, label) {
  assert.deepEqual(specification.fit.invariants.rootScale, [1, 1, 1], `${label} fit root scale drifted`);
  assert.equal(specification.fit.invariants.noGlobalScaling, true, `${label} enabled global scaling`);
  assert.deepEqual(specification.product.renderManifest.rootScale, [1, 1, 1], `${label} manifest root scale drifted`);
  for (const installation of specification.fit.installations) {
    assert.deepEqual(installation.invariants.rootScale, [1, 1, 1], `${label}/${installation.id} root scale drifted`);
  }
  for (const set of specification.product.descriptorSets) {
    assert.deepEqual(set.rootScale, [1, 1, 1], `${label}/${set.id} root scale drifted`);
  }
}

function assertWorldBoundsStayInsideZones(specification, label) {
  const installations = new Map(specification.fit.installations.map((installation) => [installation.id, installation]));
  const zones = new Map(specification.room.installationZones.map((zone) => [zone.id, zone]));

  for (const set of specification.product.descriptorSets) {
    const installation = installations.get(set.installationId);
    const zone = zones.get(set.zoneId);
    assert.ok(installation, `${label}/${set.id} references no installation`);
    assert.ok(zone, `${label}/${set.id} references no topology zone`);
    const physicalComponents = set.components.filter((component) => (
      component.metadata?.physical !== false
      && !APPEARANCE_FIXTURE_ROLES.has(component.role)
    ));
    assert.ok(physicalComponents.length > 0, `${label}/${set.id} has no physical solids`);
    const corners = physicalComponents.flatMap((component) => worldCorners(component.bounds, set.transform));
    const orientation = zone.orientation;
    const origin = orientation.origin;
    const widthOrigin = Number(orientation.widthCoordinateAtOrigin || 0);

    for (const point of corners) {
      const relative = subtract(point, origin);
      const widthCoordinate = widthOrigin + dot(relative, orientation.widthAxis);
      const heightCoordinate = Number(origin.y) + dot(relative, orientation.heightAxis);
      const depthCoordinate = dot(relative, orientation.depthAxis);
      assert.ok(
        widthCoordinate >= zone.leftPlaneX - EPSILON && widthCoordinate <= zone.rightPlaneX + EPSILON,
        `${label}/${set.id} exits ${zone.id} along its width axis (${widthCoordinate})`
      );
      assert.ok(
        heightCoordinate >= zone.bottomPlaneY - EPSILON && heightCoordinate <= zone.topPlaneY + EPSILON,
        `${label}/${set.id} exits ${zone.id} along its height axis (${heightCoordinate})`
      );
      assert.ok(
        depthCoordinate >= -EPSILON,
        `${label}/${set.id} crosses behind ${zone.id}'s accepted back plane (${depthCoordinate})`
      );
    }

    const setWorldBounds = transformGuidedBoundsToWorld(set.physicalBounds, set.transform);
    assert.ok(hasPositiveVolume(setWorldBounds), `${label}/${set.id} has no positive world-space envelope`);
    assert.equal(installation.zoneId, zone.id, `${label}/${set.id} installation/topology zone mismatch`);
  }
}

function assertDescriptorSolidsAvoidExclusions(specification, label) {
  const exclusions = specification.room.exclusionVolumes || [];
  if (!exclusions.length) return;
  const descriptors = createGuidedSceneDescriptors(specification);
  const intersections = [];
  for (const descriptor of descriptors) {
    const worldBounds = transformGuidedBoundsToWorld(descriptor.bounds, descriptor.transform);
    for (const exclusion of exclusions) {
      if (positiveIntersectionVolume(worldBounds, exclusion.bounds) > EPSILON) {
        intersections.push(`${descriptor.componentId} -> ${exclusion.id}`);
      }
    }
  }
  assert.deepEqual(intersections, [], `${label} descriptor/exclusion intersections: ${intersections.join(", ")}`);
}

function assertSemanticHierarchyContainment(specification, label) {
  for (const set of specification.product.descriptorSets) {
    const byId = new Map(set.components.map((component) => [component.id, component]));
    for (const component of set.components) {
      const parent = component.parentId ? byId.get(component.parentId) : null;
      const host = component.hostId ? byId.get(component.hostId) : null;
      if (component.parentId) assert.ok(parent, `${label}/${component.id} has a missing parent`);
      if (component.hostId) assert.ok(host, `${label}/${component.id} has a missing host`);

      if (
        parent
        && FULLY_CONTAINING_PARENT_ROLES.has(parent.role)
        && component.metadata?.installationTreatment?.primary !== true
      ) {
        assertBoundsContain(parent.bounds, component.bounds, `${label}/${component.id} parent containment`);
      }
      if (parent && ["door", "drawer_front"].includes(parent.role)) {
        assertAxesContain(parent.bounds, component.bounds, ["x", "y"], `${label}/${component.id} front-host containment`);
      }
      if (host?.role === "top_panel" && component.role === "light") {
        assertAxesContain(host.bounds, component.bounds, ["x", "z"], `${label}/${component.id} lighting-host containment`);
      }
      if (host?.role === "opening") {
        assertBoundsContain(host.bounds, component.bounds, `${label}/${component.id} opening-host containment`);
      }
    }
  }
}

function assertTreatmentAndManifestParity(specification, label) {
  const manifest = specification.product.renderManifest;
  const sceneDescriptors = createGuidedSceneDescriptors(specification);
  const manifestIds = manifest.entries.map((entry) => entry.componentId);
  const sceneIds = sceneDescriptors.map((entry) => entry.componentId);
  assert.equal(manifest.expectedCount, manifest.entries.length, `${label} manifest count drifted`);
  assert.equal(new Set(manifestIds).size, manifestIds.length, `${label} manifest contains duplicate ids`);
  assert.deepEqual([...manifestIds].sort(), [...sceneIds].sort(), `${label} renderer/manifest component parity drifted`);

  const installations = new Map(specification.fit.installations.map((installation) => [installation.id, installation]));
  for (const set of specification.product.descriptorSets) {
    const installation = installations.get(set.installationId);
    const primaryTreatments = set.components.filter((component) => (
      component.metadata?.installationTreatment?.primary === true
    ));
    const expectedTreatments = expectedPhysicalTreatments(installation);
    assert.equal(
      primaryTreatments.length,
      expectedTreatments.length,
      `${label}/${set.id} accepted treatment/component count mismatch; expected `
        + `${expectedTreatments.map(({ position }) => position).join(",")}; actual `
        + `${primaryTreatments.map((component) => component.metadata.installationTreatment.position).join(",")}`
    );
    for (const expected of expectedTreatments) {
      const matches = primaryTreatments.filter((component) => (
        component.metadata.installationTreatment.id === expected.treatment.id
        && component.metadata.installationTreatment.position === expected.position
      ));
      assert.equal(matches.length, 1, `${label}/${set.id} must realize ${expected.position} exactly once`);
      const component = matches[0];
      assert.equal(
        manifestIds.filter((id) => id === component.id).length,
        1,
        `${label}/${component.id} treatment is not rendered exactly once`
      );
      const metadata = component.metadata.installationTreatment;
      assert.equal(metadata.source, "accepted-installation-fit", `${label}/${component.id} treatment source drifted`);
      assertBoundsAlmostEqual(
        metadata.solvedWorldBounds,
        expected.treatment.bounds,
        `${label}/${component.id} solved treatment transform`
      );
      if (expected.treatment.kind === "finished-end" || expected.treatment.kind === "clearance") {
        const physicalWidth = component.bounds.max.x - component.bounds.min.x;
        assert.ok(
          Math.abs(physicalWidth - Number(expected.treatment.endPanelThickness)) <= EPSILON,
          `${label}/${component.id} finished-end panel thickness drifted`
        );
        assert.ok(
          Math.abs(Number(component.metadata.designClearance)
            - (Number(expected.treatment.width) - physicalWidth)) <= EPSILON,
          `${label}/${component.id} finished-end design clearance drifted`
        );
      } else {
        const solvedWorld = transformGuidedBoundsToWorld(metadata.solvedLocalBounds, set.transform);
        assertBoundsAlmostEqual(
          solvedWorld,
          expected.treatment.bounds,
          `${label}/${component.id} solved treatment local/world transform`
        );
      }
    }
  }
}

function assertCompactRoundTrip(specification, project, label) {
  const snapshot = createGuidedAcceptedSnapshot(specification, project);
  assert.equal(snapshot.schemaVersion, 2, `${label} did not save a compact v2 snapshot`);
  assert.equal(Object.hasOwn(snapshot, "acceptedSpecification"), false, `${label} embedded its descriptor graph`);
  const serialized = JSON.stringify(snapshot);
  assert.ok(Buffer.byteLength(serialized, "utf8") < 4_096, `${label} snapshot exceeded 4 KiB`);
  const restored = restoreGuidedAcceptedSnapshot(structuredClone(project), JSON.parse(serialized));
  assert.equal(restored.accepted, true, `${label} compact restore failed: ${JSON.stringify(restored.errors || [])}`);
  assert.equal(restored.geometryFingerprint, specification.geometryFingerprint, `${label} geometry fingerprint changed`);
  assert.equal(restored.selectionFingerprint, specification.selectionFingerprint, `${label} selection fingerprint changed`);
  assert.equal(restored.specificationFingerprint, specification.specificationFingerprint, `${label} spec fingerprint changed`);
  assert.deepEqual(restored.room, specification.room, `${label} topology changed on restore`);
  assert.deepEqual(restored.fit, specification.fit, `${label} fit changed on restore`);
  assert.deepEqual(
    restored.product.descriptorSets,
    specification.product.descriptorSets,
    `${label} descriptor graph changed on restore`
  );
}

function expectedPhysicalTreatments(installation) {
  const treatments = installation.treatments;
  return [
    ["left", treatments.left, "width"],
    ["right", treatments.right, "width"],
    ["base", treatments.base, "height"],
    ["top", treatments.top, "height"]
  ].flatMap(([position, treatment, dimension]) => {
    const amount = Number(treatment?.[dimension] || 0);
    if (amount <= EPSILON || treatment?.kind === "none") return [];
    if (["left", "right"].includes(position)) {
      const sideIsPhysical = treatment.kind === "filler"
        || Number(treatment.endPanelThickness) > EPSILON;
      if (!sideIsPhysical) return [];
    }
    return [{ position, treatment }];
  });
}

function worldCorners(bounds, transform) {
  const corners = [];
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        corners.push(transformGuidedPointToWorld({ x, y, z }, transform));
      }
    }
  }
  return corners;
}

function assertBoundsContain(container, child, label) {
  assertAxesContain(container, child, ["x", "y", "z"], label);
}

function assertAxesContain(container, child, axes, label) {
  for (const axis of axes) {
    assert.ok(child.min[axis] >= container.min[axis] - EPSILON, `${label} underflows ${axis}`);
    assert.ok(child.max[axis] <= container.max[axis] + EPSILON, `${label} overflows ${axis}`);
  }
}

function assertBoundsAlmostEqual(actual, expected, label) {
  assert.ok(expected, `${label} has no solved world bounds`);
  for (const edge of ["min", "max"]) {
    for (const axis of ["x", "y", "z"]) {
      assert.ok(
        Math.abs(Number(actual[edge][axis]) - Number(expected[edge][axis])) <= EPSILON,
        `${label} ${edge}.${axis} drifted (${actual[edge][axis]} vs ${expected[edge][axis]})`
      );
    }
  }
}

function positiveIntersectionVolume(left, right) {
  return ["x", "y", "z"].reduce((volume, axis) => (
    volume * Math.max(
      0,
      Math.min(Number(left.max[axis]), Number(right.max[axis]))
        - Math.max(Number(left.min[axis]), Number(right.min[axis]))
    )
  ), 1);
}

function hasPositiveVolume(bounds) {
  return ["x", "y", "z"].every((axis) => bounds.max[axis] - bounds.min[axis] > EPSILON);
}

function subtract(left, right) {
  return {
    x: Number(left.x) - Number(right.x),
    y: Number(left.y) - Number(right.y),
    z: Number(left.z) - Number(right.z)
  };
}

function dot(left, right) {
  return Number(left.x) * Number(right[0])
    + Number(left.y) * Number(right[1])
    + Number(left.z) * Number(right[2]);
}

function mixSeed(seed, productIndex, layoutIndex, variant) {
  let mixed = seed >>> 0;
  for (const value of [productIndex + 1, layoutIndex + 1, variant + 1]) {
    mixed ^= Math.imul(value, 0x9e3779b1);
    mixed = Math.imul(mixed ^ (mixed >>> 16), 0x85ebca6b) >>> 0;
    mixed = Math.imul(mixed ^ (mixed >>> 13), 0xc2b2ae35) >>> 0;
    mixed ^= mixed >>> 16;
  }
  return mixed >>> 0;
}

function seededRandom(initialSeed) {
  let state = initialSeed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function integer(random, minimum, maximum) {
  return minimum + Math.floor(random() * (maximum - minimum + 1));
}

function halfInch(random, minimum, maximum) {
  return integer(random, minimum * 2, maximum * 2) / 2;
}

function summarizeFailures(failures) {
  if (!failures.length) return "";
  const groups = new Map();
  for (const failure of failures) {
    const signature = failure.message.replace(failure.key, "<case>");
    const group = groups.get(signature) || { count: 0, examples: [] };
    group.count += 1;
    if (group.examples.length < 3) group.examples.push(failure.key);
    groups.set(signature, group);
  }
  const summary = [...groups.entries()].slice(0, 40).map(([message, group]) => (
    `${group.count}× ${message}\n    examples: ${group.examples.join(", ")}`
  ));
  return `${failures.length} of 420 matrix cases failed:\n${summary.join("\n")}`;
}
