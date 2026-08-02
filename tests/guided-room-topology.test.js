import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  GUIDED_BOUNDARY_KINDS,
  GUIDED_ROOM_LAYOUT_IDS,
  resolveRoomTopology
} from "../guided-room-topology.js";

const boundaryKinds = new Set(GUIDED_BOUNDARY_KINDS);

const projects = Object.freeze({
  "niche-layout": {
    wallWidth: 120,
    ceilingHeight: 96,
    desiredDepth: 15,
    nicheWidth: 96,
    nicheHeight: 96,
    nicheDepth: 15,
    leftReturn: 12,
    rightReturn: 12
  },
  "left-niche": {
    wallWidth: 120,
    ceilingHeight: 96,
    desiredDepth: 14,
    nicheWidth: 96,
    nicheHeight: 90,
    nicheDepth: 12,
    leftReturn: 0
  },
  "right-niche": {
    wallWidth: 120,
    ceilingHeight: 96,
    desiredDepth: 14,
    nicheWidth: 96,
    nicheHeight: 96,
    nicheDepth: 14,
    rightReturn: 12
  },
  "clear-wall": {
    wallWidth: 144,
    ceilingHeight: 108,
    desiredDepth: 15
  },
  "fireplace-wall": {
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
  },
  "center-recess": {
    wallWidth: 144,
    ceilingHeight: 108,
    desiredDepth: 15,
    nicheWidth: 48,
    nicheHeight: 72,
    nicheDepth: 8
  },
  "window-wall": {
    wallWidth: 144,
    ceilingHeight: 96,
    desiredDepth: 18,
    windowWidth: 60,
    windowHeight: 48,
    sillHeight: 30,
    windowLeftDistance: 42,
    windowRightDistance: 42,
    radiatorBelowWindow: "no"
  },
  "door-wall": {
    wallWidth: 144,
    ceilingHeight: 96,
    desiredDepth: 14,
    doorWidth: 36,
    doorHeight: 80,
    doorLeftDistance: 54,
    doorTrimWidth: 3.5,
    doorSwing: "right-in"
  },
  "corner-wall": {
    wallWidth: 120,
    ceilingHeight: 96,
    desiredDepth: 13,
    cornerReturn: 60
  },
  "double-opening": {
    wallWidth: 96,
    ceilingHeight: 96,
    desiredDepth: 14,
    openingLeftDistance: 24,
    openingRightDistance: 24
  }
});

const expectedZoneIds = Object.freeze({
  "niche-layout": ["center"],
  "left-niche": ["main"],
  "right-niche": ["main"],
  "clear-wall": ["main"],
  "fireplace-wall": ["left", "right", "optional-over-mantel"],
  "center-recess": ["left", "right", "optional-surround"],
  "window-wall": ["left", "right", "below-window", "optional-above-window"],
  "door-wall": ["left", "right", "optional-over-door"],
  "corner-wall": ["primary-run", "return-run", "corner"],
  "double-opening": ["between-openings"]
});

function project(layoutId, overrides = {}) {
  return { layoutId, measurements: { ...projects[layoutId], ...overrides } };
}

function assertFinite(value, path = "topology") {
  if (typeof value === "number") {
    assert.equal(Number.isFinite(value), true, `${path} must be finite`);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) assertFinite(child, `${path}.${key}`);
}

test("all ten public room IDs resolve explicit finite planes and positive zones", () => {
  assert.equal(GUIDED_ROOM_LAYOUT_IDS.length, 10);
  for (const layoutId of GUIDED_ROOM_LAYOUT_IDS) {
    const result = resolveRoomTopology(project(layoutId));
    assert.equal(result.accepted, true, `${layoutId}: ${JSON.stringify(result.errors)}`);
    assert.equal(result.layoutId, layoutId);
    assert.equal(result.units, "inches");
    assert.equal(result.floorPlaneY, 0);
    assert.equal(result.rearWallPlaneZ, 0);
    assert.equal(result.planes.floor.kind, "floor");
    assert.equal(result.planes.ceiling.kind, "ceiling");
    assert.deepEqual(result.installationZones.map((zone) => zone.id), expectedZoneIds[layoutId]);
    assert.equal(result.cameraIntent, layoutId === "corner-wall" ? "corner-oblique" : "front");
    for (const zone of result.installationZones) {
      assert.ok(zone.rightPlaneX > zone.leftPlaneX, `${layoutId}/${zone.id} width`);
      assert.ok(zone.topPlaneY > zone.bottomPlaneY, `${layoutId}/${zone.id} height`);
      assert.ok(boundaryKinds.has(zone.leftBoundaryKind));
      assert.ok(boundaryKinds.has(zone.rightBoundaryKind));
      assert.ok(boundaryKinds.has(zone.topBoundaryKind));
      assert.ok(boundaryKinds.has(zone.bottomBoundaryKind));
      assert.ok(Array.isArray(zone.featureClearances));
      assert.ok(Array.isArray(zone.exclusionVolumeIds));
      assert.ok(zone.orientation);
    }
    assertFinite(result);
    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(result.installationZones), true);
  }
});

test("left and right niches are distinct unilateral topologies", () => {
  const left = resolveRoomTopology(project("left-niche"));
  const right = resolveRoomTopology(project("right-niche"));

  assert.equal(left.features.niche.side, "left");
  assert.equal(left.installationZones[0].leftBoundaryKind, "return");
  assert.equal(left.installationZones[0].rightBoundaryKind, "open-edge");
  assert.equal(right.features.niche.side, "right");
  assert.equal(right.installationZones[0].leftBoundaryKind, "open-edge");
  assert.equal(right.installationZones[0].rightBoundaryKind, "return");
  assert.notDeepEqual(left.features.niche.bounds, right.features.niche.bounds);
});

test("architectural features produce explicit exclusion volumes and clear zones", () => {
  const cases = [
    ["fireplace-wall", ["fireplace-opening-exclusion", "fireplace-service-exclusion"]],
    ["center-recess", ["center-projection-exclusion"]],
    ["window-wall", ["window-opening-exclusion"]],
    ["door-wall", ["door-opening-exclusion", "door-swing-exclusion"]],
    ["double-opening", ["left-opening-exclusion", "right-opening-exclusion"]]
  ];
  for (const [layoutId, expectedIds] of cases) {
    const result = resolveRoomTopology(project(layoutId));
    assert.equal(result.accepted, true);
    assert.deepEqual(result.exclusionVolumes.map((item) => item.id), expectedIds);
    for (const volume of result.exclusionVolumes) {
      assert.ok(volume.bounds.maxX > volume.bounds.minX);
      assert.ok(volume.bounds.maxY > volume.bounds.minY);
      assert.ok(volume.bounds.maxZ > volume.bounds.minZ);
    }
  }
});

test("radiator service and ventilation stay explicit below a window", () => {
  const result = resolveRoomTopology(project("window-wall", {
    wallWidth: 120,
    windowWidth: 60,
    windowLeftDistance: 30,
    windowRightDistance: 30,
    sillHeight: 32,
    radiatorBelowWindow: "yes",
    radiatorWidth: 48,
    radiatorHeight: 26,
    radiatorDepth: 9
  }));

  assert.equal(result.accepted, true);
  assert.equal(result.features.radiator.kind, "radiator");
  const service = result.exclusionVolumes.find((item) => item.id === "radiator-service-exclusion");
  assert.ok(service);
  assert.equal(service.ventilationRequired, true);
  assert.equal(service.bounds.min.z, -11);
  assert.equal(service.bounds.max.z, 0);
  assert.equal(result.installationZones.find((zone) => zone.id === "below-window").installByDefault, false);
});

test("named failures reject unknown, missing, and irreconcilable room geometry", () => {
  const unknown = resolveRoomTopology({ layoutId: "photo-room", measurements: projects["clear-wall"] });
  assert.equal(unknown.accepted, false);
  assert.equal(unknown.errors[0].code, "UNKNOWN_ROOM_LAYOUT");

  const missing = resolveRoomTopology({ layoutId: "clear-wall", measurements: { wallWidth: 120 } });
  assert.equal(missing.accepted, false);
  assert.equal(missing.errors[0].code, "MISSING_BASE_ROOM_DIMENSIONS");
  assert.deepEqual(missing.errors[0].fields, ["ceilingHeight", "desiredDepth"]);

  const mismatch = resolveRoomTopology(project("niche-layout", { rightReturn: 4 }));
  assert.equal(mismatch.accepted, false);
  assert.equal(mismatch.errors[0].code, "ROOM_WIDTH_RECONCILIATION_FAILED");

  const corner = resolveRoomTopology(project("corner-wall", { cornerReturn: "" }));
  assert.equal(corner.accepted, false);
  assert.equal(corner.errors[0].code, "MISSING_CORNER_RETURN");

  const door = resolveRoomTopology(project("door-wall", { doorLeftDistance: 120 }));
  assert.equal(door.accepted, false);
  assert.equal(door.errors[0].code, "OPENING_CLEARANCE_FAILED");
});

test("niche depth reports controlled projection instead of shrinking geometry", () => {
  const result = resolveRoomTopology(project("left-niche", {
    desiredDepth: 18,
    nicheDepth: 12
  }));

  assert.equal(result.accepted, true);
  assert.equal(result.installationZones[0].backPlaneZ, 12);
  assert.equal(result.warnings[0].code, "DEPTH_EXCEEDS_ALLOWED_PROJECTION");
  assert.equal(result.warnings[0].projectionBeyondReturn, 6);
});

test("guided mixed-inch strings retain current measurement semantics", () => {
  const result = resolveRoomTopology({
    layout: "clear-wall",
    measurements: {
      wallWidth: "120 1/2 in",
      ceilingHeight: "96½\"",
      desiredDepth: "14-1/4"
    }
  });

  assert.equal(result.accepted, true);
  assert.equal(result.wallWidth, 120.5);
  assert.equal(result.ceilingHeight, 96.5);
  assert.equal(result.desiredDepth, 14.25);
});

test("topology output is deterministic and does not mutate guided state", () => {
  const input = project("fireplace-wall");
  const before = structuredClone(input);
  const first = resolveRoomTopology(input);
  const second = resolveRoomTopology(input);

  assert.deepEqual(first, second);
  assert.deepEqual(input, before);
  assert.equal(Object.isFrozen(first.features.fireplace), true);
  assert.equal(Object.isFrozen(first.exclusionVolumes[0].bounds), true);
});

test("600 deterministic valid candidates preserve finite plane and zone invariants", () => {
  for (let index = 0; index < 600; index += 1) {
    const wallWidth = 72 + (index % 145) * 0.5;
    const ceilingHeight = 72 + (index % 49);
    const desiredDepth = 10 + (index % 29) * 0.5;
    const isNiche = index % 2 === 0;
    const candidate = isNiche
      ? resolveRoomTopology({
        layoutId: "niche-layout",
        measurements: {
          wallWidth,
          ceilingHeight,
          desiredDepth,
          nicheWidth: wallWidth - 12,
          nicheHeight: ceilingHeight,
          nicheDepth: Math.max(4, desiredDepth - 2),
          leftReturn: 6,
          rightReturn: 6
        }
      })
      : resolveRoomTopology({
        layoutId: "clear-wall",
        measurements: { wallWidth, ceilingHeight, desiredDepth }
      });
    assert.equal(candidate.accepted, true, `candidate ${index}`);
    assertFinite(candidate, `candidate.${index}`);
    for (const zone of candidate.installationZones) {
      assert.ok(zone.rightPlaneX > zone.leftPlaneX);
      assert.ok(zone.topPlaneY > zone.bottomPlaneY);
    }
  }
});

test("pure topology source has no DOM or Three.js imports", async () => {
  const source = await readFile(new URL("../guided-room-topology.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /from\s+["'][^"']*(?:three|guided-configurator-3d)/i);
  assert.doesNotMatch(source, /\b(?:document|window)\s*\./);
  assert.doesNotMatch(source, /\b(?:HTMLElement|WebGLRenderer)\b/);
});
