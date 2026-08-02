import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { resolveRoomTopology } from "../guided-room-topology.js";
import {
  DEFAULT_INSTALLATION_FIT_POLICY,
  INSTALLATION_MODES,
  solveInstallation
} from "../guided-installation-solver.js";

function room(layoutId, measurements) {
  const result = resolveRoomTopology({ layoutId, measurements });
  assert.equal(result.accepted, true, JSON.stringify(result.errors));
  return result;
}

const centerNiche = () => room("niche-layout", {
  wallWidth: 120,
  ceilingHeight: 96,
  desiredDepth: 15,
  nicheWidth: 96,
  nicheHeight: 96,
  nicheDepth: 15,
  leftReturn: 12,
  rightReturn: 12
});

const clearWall = (overrides = {}) => room("clear-wall", {
  wallWidth: 120,
  ceilingHeight: 96,
  desiredDepth: 14,
  ...overrides
});

test("fitted niche creates separate equal fillers, 4-inch base, and ceiling contact", () => {
  const result = solveInstallation({
    room: centerNiche(),
    product: { id: "cabinet-shelves", baseStyle: "flush-base", topTreatment: "small-crown" }
  });

  assert.equal(result.accepted, true);
  assert.equal(result.mode, "fitted");
  assert.equal(result.installations[0].mode, "fitted");
  assert.equal(result.treatments.left.kind, "filler");
  assert.equal(result.treatments.right.kind, "filler");
  assert.equal(result.treatments.left.width, result.treatments.right.width);
  assert.equal(result.treatments.left.width, 1.5);
  assert.notEqual(result.treatments.left.id, result.treatments.right.id);
  assert.equal(result.treatments.base.height, 4);
  assert.equal(result.anchors.floorY, 0);
  assert.equal(result.anchors.bottomY, 0);
  assert.equal(result.anchors.backZ, 15);
  assert.equal(result.casework.frontPlaneZ, 0);
  assert.equal(result.casework.topPlaneY, 96);
  assert.equal(result.installations[0].invariants.topFitted, true);
  assert.deepEqual(result.invariants.rootScale, [1, 1, 1]);
  assert.equal(result.invariants.noGlobalScaling, true);
});

test("one-sided niche uses a finished end panel at the open edge", () => {
  const oneSided = room("right-niche", {
    wallWidth: 120,
    ceilingHeight: 96,
    desiredDepth: 14,
    nicheWidth: 96,
    nicheHeight: 96,
    nicheDepth: 14,
    rightReturn: 12
  });
  const result = solveInstallation({ room: oneSided, product: { id: "tv-unit" } });

  assert.equal(result.accepted, true);
  assert.equal(result.treatments.left.kind, "finished-end");
  assert.equal(result.treatments.left.endPanelThickness, 0.75);
  assert.equal(result.treatments.left.designClearance, 0.5);
  assert.equal(result.treatments.right.kind, "filler");
  assert.notEqual(result.treatments.left.width, result.treatments.right.width);
});

test("desired depth moves only the physical front plane", () => {
  const shallow = solveInstallation({ room: clearWall({ desiredDepth: 14 }), product: { id: "drawer-shelves" } });
  const deep = solveInstallation({ room: clearWall({ desiredDepth: 18 }), product: { id: "drawer-shelves" } });

  assert.equal(shallow.accepted, true);
  assert.equal(deep.accepted, true);
  assert.equal(shallow.casework.width, deep.casework.width);
  assert.equal(shallow.casework.overallHeight, deep.casework.overallHeight);
  assert.equal(shallow.casework.backPlaneZ, deep.casework.backPlaneZ);
  assert.equal(shallow.casework.frontPlaneZ, -14);
  assert.equal(deep.casework.frontPlaneZ, -18);
  assert.deepEqual(shallow.invariants.rootScale, deep.invariants.rootScale);
});

test("freestanding mode centers deliberate clearances and uses the canonical furniture base", () => {
  const result = solveInstallation({
    room: clearWall(),
    product: {
      id: "cabinet-shelves",
      installationMode: "freestanding",
      baseStyle: "furniture-base",
      targetWidth: 96,
      targetHeight: 84
    }
  });

  assert.equal(result.accepted, true);
  assert.equal(result.mode, "freestanding");
  assert.equal(result.treatments.left.kind, "clearance");
  assert.equal(result.treatments.left.width, 12);
  assert.equal(result.treatments.right.width, 12);
  assert.equal(result.treatments.left.finishedExteriorSide, true);
  assert.equal(result.treatments.right.finishedExteriorSide, true);
  assert.equal(result.treatments.base.kind, "furniture-base");
  assert.equal(result.treatments.base.height, 4.5);
  assert.equal(result.casework.width, 96);
  assert.equal(result.casework.overallHeight, 84);
  assert.ok(result.casework.topPlaneY < result.zoneBounds.top);
});

test("floating mode requires and preserves mounting height with no base", () => {
  const result = solveInstallation({
    room: clearWall({ desiredDepth: 16 }),
    product: {
      id: "floating-storage",
      installationMode: "floating",
      measurements: { mountingHeight: "18 in" }
    }
  });

  assert.equal(result.accepted, true);
  assert.equal(result.mode, "floating");
  assert.equal(result.installations[0].mode, "floating");
  assert.equal(result.treatments.base.kind, "none");
  assert.equal(result.treatments.base.height, 0);
  assert.equal(result.treatments.top.kind, "integrated-finished-top");
  assert.equal(result.treatments.top.height, 0);
  assert.equal(result.treatments.top.nominalThickness, 0.75);
  assert.equal(result.treatments.top.includedInCasework, true);
  assert.equal(result.anchors.mountingHeight, 18);
  assert.equal(result.anchors.bottomY, 18);
  assert.equal(result.casework.bottomPlaneY, 18);
  assert.equal(result.casework.overallHeight, 24);
  assert.equal(result.casework.bodyHeight, 24);
  assert.ok(result.casework.bottomPlaneY > result.anchors.floorY);
  assert.equal(result.installations[0].invariants.floorAnchored, true);
  assert.equal(result.warnings[0].code, "FLOATING_ATTACHMENT_ENGINEERING_REQUIRED");

  const rejected = solveInstallation({
    room: clearWall(),
    product: { id: "floating-storage", installationMode: "floating" }
  });
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.errors[0].code, "MISSING_MOUNTING_HEIGHT");
});

test("canonical width granularity is absorbed by physical side treatments", () => {
  const symmetric = solveInstallation({
    room: clearWall({ wallWidth: 120.5 }),
    product: { id: "cabinet-shelves", caseworkWidthStep: 1 }
  });

  assert.equal(symmetric.accepted, true);
  assert.equal(symmetric.casework.width, 117);
  assert.equal(symmetric.casework.widthStep, 1);
  assert.equal(symmetric.casework.widthQuantized, true);
  assert.equal(symmetric.treatments.left.width, 1.75);
  assert.equal(symmetric.treatments.right.width, 1.75);
  assert.equal(symmetric.treatments.left.granularityAdjustment, 0.25);
  assert.equal(symmetric.treatments.right.granularityAdjustment, 0.25);
  assert.equal(
    symmetric.treatments.left.width
      + symmetric.casework.width
      + symmetric.treatments.right.width,
    120.5
  );
  assert.equal(symmetric.installations[0].invariants.caseworkWidthGranularity, true);

  const fireplace = room("fireplace-wall", {
    wallWidth: 180,
    ceilingHeight: 108,
    desiredDepth: 15,
    fireplaceWidth: 42,
    fireplaceHeight: 32,
    mantelWidth: 60,
    mantelHeight: 48,
    fireplaceDepth: 8,
    fireplaceLeftWidth: 48,
    fireplaceRightWidth: 48
  });
  const asymmetric = solveInstallation({
    room: fireplace,
    product: { id: "cabinet-shelves", caseworkWidthStep: 1 }
  });
  assert.equal(asymmetric.accepted, true);
  for (const installation of asymmetric.installations) {
    assert.equal(Number.isInteger(installation.casework.width), true);
    assert.equal(
      installation.treatments.left.width
        + installation.casework.width
        + installation.treatments.right.width,
      installation.zoneBounds.right - installation.zoneBounds.left
    );
  }

  const invalidStep = solveInstallation({
    room: clearWall(),
    product: { id: "cabinet-shelves", caseworkWidthStep: 0 }
  });
  assert.equal(invalidStep.accepted, false);
  assert.equal(invalidStep.errors[0].code, "INVALID_CASEWORK_WIDTH_STEP");
});

test("fireplace side zones solve atomically as a deterministic multi-zone fit", () => {
  const fireplace = room("fireplace-wall", {
    wallWidth: 180,
    ceilingHeight: 108,
    desiredDepth: 15,
    fireplaceWidth: 42,
    fireplaceHeight: 32,
    mantelWidth: 60,
    mantelHeight: 48,
    fireplaceDepth: 8,
    fireplaceLeftWidth: 48,
    fireplaceRightWidth: 48
  });
  const result = solveInstallation({ room: fireplace, product: { id: "cabinet-shelves" } });

  assert.equal(result.accepted, true);
  assert.deepEqual(result.zoneIds, ["left", "right"]);
  assert.equal(result.installations.length, 2);
  assert.equal(result.invariants.multiZone, true);
  assert.equal(result.installations[0].exclusionVolumeIds.includes("fireplace-service-exclusion"), true);
  assert.equal(result.installations[1].exclusionVolumeIds.includes("fireplace-service-exclusion"), true);
  assert.notEqual(result.installations[0].id, result.installations[1].id);

  const selected = solveInstallation({
    room: fireplace,
    product: { id: "tv-unit", preferredZoneIds: ["optional-over-mantel"] }
  });
  assert.equal(selected.accepted, true);
  assert.deepEqual(selected.zoneIds, ["optional-over-mantel"]);
  assert.equal(selected.treatments.base.kind, "feature-support");
  assert.equal(selected.treatments.base.height, 0);
});

test("window and radiator zone selection retains the service envelope contract", () => {
  const windowRoom = room("window-wall", {
    wallWidth: 120,
    ceilingHeight: 96,
    desiredDepth: 14,
    windowWidth: 60,
    windowHeight: 48,
    sillHeight: 32,
    windowLeftDistance: 30,
    windowRightDistance: 30,
    radiatorBelowWindow: "yes",
    radiatorWidth: 48,
    radiatorHeight: 26,
    radiatorDepth: 9
  });
  const result = solveInstallation({
    room: windowRoom,
    product: { id: "radiator-cover", zoneRoles: ["below-window"] }
  });

  assert.equal(result.accepted, true);
  assert.deepEqual(result.zoneIds, ["below-window"]);
  assert.equal(result.installations[0].exclusionVolumeIds.includes("radiator-service-exclusion"), true);
  assert.equal(result.installations[0].featureClearances[0].featureId, "window");
});

test("corner topology fits both runs and the explicit corner join without scaling", () => {
  const cornerRoom = room("corner-wall", {
    wallWidth: 120,
    ceilingHeight: 96,
    desiredDepth: 13,
    cornerReturn: 60
  });
  const result = solveInstallation({ room: cornerRoom, product: { id: "open-shelving" } });

  assert.equal(result.accepted, true);
  assert.deepEqual(result.zoneIds, ["primary-run", "return-run", "corner"]);
  assert.equal(result.installations.length, 3);
  assert.deepEqual(result.installations[1].orientation.widthAxis, [0, 0, -1]);
  assert.equal(result.installations[2].role, "corner-join");
  assert.equal(result.installations[2].treatments.left.width, 0);
  assert.deepEqual(result.installations[2].invariants.rootScale, [1, 1, 1]);
});

test("named invalid candidates fail closed without partial installations", () => {
  const badRoom = solveInstallation({ room: { accepted: false, errors: [{ code: "BAD_ROOM" }] } });
  assert.equal(badRoom.accepted, false);
  assert.equal(badRoom.errors[0].code, "ROOM_NOT_ACCEPTED");

  const missingZone = solveInstallation({
    room: clearWall(),
    product: { id: "tv-unit", installationZoneIds: ["photo-zone"] }
  });
  assert.equal(missingZone.accepted, false);
  assert.equal(missingZone.errors[0].code, "UNKNOWN_INSTALLATION_ZONE");
  assert.equal("installations" in missingZone, false);

  const invalidMode = solveInstallation({ room: clearWall(), mode: "scaled-image" });
  assert.equal(invalidMode.accepted, false);
  assert.equal(invalidMode.errors[0].code, "UNKNOWN_INSTALLATION_MODE");

  const narrowRoom = {
    accepted: true,
    desiredDepth: 14,
    floorPlaneY: 0,
    installationZones: [{
      id: "tiny",
      role: "primary",
      leftPlaneX: 0,
      rightPlaneX: 2,
      bottomPlaneY: 0,
      topPlaneY: 96,
      backPlaneZ: 0,
      leftBoundaryKind: "wall",
      rightBoundaryKind: "wall",
      topBoundaryKind: "ceiling",
      featureClearances: [],
      exclusionVolumeIds: []
    }]
  };
  const narrow = solveInstallation({ room: narrowRoom });
  assert.equal(narrow.accepted, false);
  assert.equal(narrow.errors[0].code, "INSTALLATION_ZONE_TOO_NARROW");
});

test("solver output is deterministic, deeply immutable, and leaves inputs untouched", () => {
  const inputRoom = centerNiche();
  const product = { id: "drawer-shelves", baseStyle: "flush-base" };
  const roomBefore = structuredClone(inputRoom);
  const productBefore = structuredClone(product);
  const first = solveInstallation({ room: inputRoom, product });
  const second = solveInstallation({ room: inputRoom, product });

  assert.deepEqual(first, second);
  assert.deepEqual(inputRoom, roomBefore);
  assert.deepEqual(product, productBefore);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.installations), true);
  assert.equal(Object.isFrozen(first.treatments.left.bounds), true);
  assert.equal(Object.isFrozen(DEFAULT_INSTALLATION_FIT_POLICY), true);
});

test("550 fitted candidates satisfy exact width, height, anchoring, and root-scale invariants", () => {
  assert.deepEqual(INSTALLATION_MODES, ["fitted", "freestanding", "floating"]);
  for (let index = 0; index < 550; index += 1) {
    const wallWidth = 36 + (index % 217) * 0.5;
    const ceilingHeight = 72 + (index % 73) * 0.5;
    const desiredDepth = 10 + (index % 29) * 0.5;
    const candidate = solveInstallation({
      room: clearWall({ wallWidth, ceilingHeight, desiredDepth }),
      product: { id: "cabinet-shelves" }
    });
    assert.equal(candidate.accepted, true, `candidate ${index}`);
    const installation = candidate.installations[0];
    const width = installation.treatments.left.width
      + installation.casework.width
      + installation.treatments.right.width;
    const height = installation.treatments.base.height
      + installation.casework.bodyHeight
      + installation.treatments.top.height;
    assert.ok(Math.abs(width - wallWidth) <= 0.001);
    assert.ok(Math.abs(height - ceilingHeight) <= 0.001);
    assert.equal(installation.anchors.floorY, 0);
    assert.equal(installation.anchors.backZ, 0);
    assert.equal(installation.casework.frontPlaneZ, -desiredDepth);
    assert.deepEqual(installation.invariants.rootScale, [1, 1, 1]);
  }
});

test("pure fit source has no DOM, Three.js, or global-scale implementation", async () => {
  const source = await readFile(new URL("../guided-installation-solver.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /from\s+["'][^"']*(?:three|guided-configurator-3d)/i);
  assert.doesNotMatch(source, /\b(?:document|window|HTMLElement|WebGLRenderer)\b/);
  assert.doesNotMatch(source, /\.scale\.(?:set|x|y|z)\s*=/);
});
