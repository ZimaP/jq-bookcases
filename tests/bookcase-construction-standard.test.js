import test from "node:test";
import assert from "node:assert/strict";

import {
  CONSTRUCTION_PROFILE_IDS,
  CONSTRUCTION_RULES,
  DOOR_ARRANGEMENTS,
  FRONT_PROFILE_CATALOG,
  boundsIntersect,
  findComponent,
  generateBookcaseLayout,
  getConstructionReferencePlanes,
  getFrontBounds,
  resolveDoorArrangement,
  validateBookcaseLayout
} from "../bookcase-layout.js";
import {
  defaultBookcaseConfig,
  hardwareVariants
} from "../bookcase-config.js";

const clone = (value) => JSON.parse(JSON.stringify(value));
const byRole = (layout, role) => layout.components.filter((component) => component.role === role);
const issueCodes = (validation) => validation.issues.map((item) => item.code);
const round = (value) => Math.round(Number(value) * 1e6) / 1e6;

function approximately(actual, expected, epsilon = 1e-6) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `${actual} is not approximately ${expected}`
  );
}

function assertBoundsEqual(actual, expected) {
  for (const face of ["min", "max"]) {
    for (const axis of ["x", "y", "z"]) {
      approximately(actual[face][axis], expected[face][axis]);
    }
  }
}

function syncBox(component) {
  for (const axis of ["x", "y", "z"]) {
    component.size[axis] = round(component.bounds.max[axis] - component.bounds.min[axis]);
    component.position[axis] = round((component.bounds.max[axis] + component.bounds.min[axis]) / 2);
  }
}

function pointInRegion(point, region, epsilon = 1e-6) {
  return point.x >= region.bounds.min.x - epsilon &&
    point.x <= region.bounds.max.x + epsilon &&
    point.y >= region.bounds.min.y - epsilon &&
    point.y <= region.bounds.max.y + epsilon;
}

function singleSectionLayout({
  type = "lower_doors",
  arrangement = "auto",
  width = 24,
  constructionProfile = CONSTRUCTION_PROFILE_IDS.inset,
  doorStyle = "shaker",
  drawerFrontStyle = "shaker",
  drawerCount = 3,
  hardware = "brass_pull",
  baseStyle = "plinth",
  layoutType = "mixed",
  crownStyle = "none",
  lighting = "no_lighting"
} = {}) {
  const usesDoorLayout = type === "lower_doors" || type === "tall_doors";
  return generateBookcaseLayout({
    ...defaultBookcaseConfig,
    width,
    sections: 1,
    constructionProfile,
    doorStyle,
    drawerFrontStyle,
    drawerCount,
    hardware,
    baseStyle,
    layoutType,
    crownStyle,
    lighting,
    layoutMetadata: {
      sectionRatios: [1],
      sectionTypes: [type],
      sectionDoorLayouts: [usesDoorLayout ? { arrangement } : null]
    }
  });
}

function glassUpperLayout(overrides = {}) {
  return singleSectionLayout({
    type: "open",
    layoutType: "glass_library",
    doorStyle: "glass",
    ...overrides
  });
}

function expectMutationCode(layout, code, mutate) {
  assert.equal(layout.validation.valid, true, JSON.stringify(layout.validation.errors));
  const changed = clone(layout);
  mutate(changed);
  const validation = validateBookcaseLayout(changed);
  assert.equal(validation.valid, false, `${code} mutation unexpectedly remained valid`);
  assert.ok(
    issueCodes(validation).includes(code),
    `${code} was not reported: ${JSON.stringify(validation.errors)}`
  );
}

test("construction reference planes are pure, explicit, and profile-aware", () => {
  const insetConfig = {
    width: 96,
    height: 108,
    depth: 18,
    baseStyle: "toe_kick",
    constructionProfile: CONSTRUCTION_PROFILE_IDS.inset
  };
  const inset = getConstructionReferencePlanes(insetConfig);
  assert.deepEqual(inset, getConstructionReferencePlanes(insetConfig));
  assert.equal(inset.floorPlaneY, 0);
  assert.equal(inset.outerLeftPlaneX, -48);
  assert.equal(inset.outerRightPlaneX, 48);
  assert.equal(inset.outerTopPlaneY, 108);
  assert.equal(inset.carcassFrontPlaneZ, 0);
  assert.equal(inset.finishedFrontPlaneZ, 0);
  assert.equal(inset.shelfFrontPlaneZ, CONSTRUCTION_RULES.doorThickness);
  assert.equal(inset.backInteriorPlaneZ, 18 - CONSTRUCTION_RULES.backPanelThickness);
  assert.equal(inset.outerBackPlaneZ, 18);
  assert.equal(inset.baseFrontPlaneZ, CONSTRUCTION_RULES.recessedToeKickDepth);
  assert.equal(inset.toeKickPlatePlaneZ, CONSTRUCTION_RULES.recessedToeKickDepth);
  assert.equal(inset.frontOutwardDirectionZ, -1);
  assert.equal(inset.carcassInwardDirectionZ, 1);

  const legacy = getConstructionReferencePlanes({
    ...insetConfig,
    baseStyle: "plinth",
    constructionProfile: CONSTRUCTION_PROFILE_IDS.legacyOverlay
  });
  assert.equal(legacy.finishedFrontPlaneZ, -CONSTRUCTION_RULES.doorThickness);
  assert.equal(legacy.shelfFrontPlaneZ, CONSTRUCTION_RULES.openShelfFrontSetback);
  assert.equal(legacy.baseFrontPlaneZ, 0);

  assert.throws(
    () => getConstructionReferencePlanes({ width: 96, height: 96, depth: Number.NaN }),
    /Finite width, height, and depth/
  );
});

test("shared front bounds encode inset and legacy overlay depth without changing fitted X/Y", () => {
  const opening = {
    bounds: {
      min: { x: -12, y: 4.75, z: 0 },
      max: { x: 12, y: 34.75, z: 14.75 }
    }
  };
  const inset = getFrontBounds({ opening, mounting: "inset", frontPlaneZ: 0 });
  const overlay = getFrontBounds({
    opening,
    mounting: "overlay",
    frontPlaneZ: -CONSTRUCTION_RULES.doorThickness
  });
  assert.deepEqual(inset.min, {
    x: -12 + CONSTRUCTION_RULES.doorReveal,
    y: 4.75 + CONSTRUCTION_RULES.doorReveal,
    z: 0
  });
  assert.equal(inset.max.z, CONSTRUCTION_RULES.doorThickness);
  assert.equal(overlay.min.z, -CONSTRUCTION_RULES.doorThickness);
  assert.equal(overlay.max.z, 0);
  assert.equal(getFrontBounds({ opening, mounting: "inset" }).min.z, opening.bounds.min.z);
  assert.equal(
    getFrontBounds({ opening, mounting: "overlay" }).min.z,
    opening.bounds.min.z - CONSTRUCTION_RULES.doorThickness
  );
  assert.equal(inset.min.x, overlay.min.x);
  assert.equal(inset.max.x, overlay.max.x);
  assert.equal(inset.min.y, overlay.min.y);
  assert.equal(inset.max.y, overlay.max.y);

  const pair = [0, 1].map((leafIndex) => getFrontBounds({
    opening,
    mounting: "inset",
    frontPlaneZ: 0,
    meetingGap: CONSTRUCTION_RULES.doubleDoorCenterGap,
    leafCount: 2,
    leafIndex
  }));
  approximately(pair[0].max.x - pair[0].min.x, pair[1].max.x - pair[1].min.x);
  approximately(pair[1].min.x - pair[0].max.x, CONSTRUCTION_RULES.doubleDoorCenterGap);
});

test("recessed toe kick is a floor-connected assembly around a genuine three-inch void", () => {
  const layout = generateBookcaseLayout({
    ...defaultBookcaseConfig,
    baseStyle: "toe_kick",
    crownStyle: "none",
    lighting: "no_lighting"
  });
  assert.equal(layout.validation.valid, true, JSON.stringify(layout.validation.errors));
  assert.equal(layout.metrics.baseHeight, CONSTRUCTION_RULES.recessedToeKickHeight);
  assert.equal(findComponent(layout, "base-toe-shadow"), null);

  const structural = findComponent(layout, "base");
  const plate = findComponent(layout, "base-toe-kick-plate");
  const leftReturn = findComponent(layout, "base-toe-return-left");
  const rightReturn = findComponent(layout, "base-toe-return-right");
  const toeVoid = findComponent(layout, "base-toe-kick-void");
  assert.ok(structural && plate && leftReturn && rightReturn && toeVoid);
  assert.equal(toeVoid.metadata.purpose, "usable_toe_space");
  assert.equal(toeVoid.size.z, CONSTRUCTION_RULES.recessedToeKickDepth);
  assert.equal(toeVoid.bounds.min.z, layout.metrics.referencePlanes.finishedFrontPlaneZ);
  assert.equal(toeVoid.bounds.max.z, layout.metrics.referencePlanes.toeKickPlatePlaneZ);
  assert.equal(plate.bounds.min.z, toeVoid.bounds.max.z);
  assert.equal(structural.bounds.min.z, plate.bounds.max.z);
  assert.equal(leftReturn.bounds.min.x, layout.metrics.referencePlanes.outerLeftPlaneX);
  assert.equal(rightReturn.bounds.max.x, layout.metrics.referencePlanes.outerRightPlaneX);

  const physicalBase = layout.components.filter((component) =>
    ["base", "trim"].includes(component.role) && component.metadata?.style === "toe_kick"
  );
  assert.ok(physicalBase.every((component) => component.bounds.min.y === 0));
  assert.ok(physicalBase.every((component) => !boundsIntersect(component.bounds, toeVoid.bounds)));
});

test("flush plinth is flush on the front and both sides with no cap or overhang", () => {
  const layout = generateBookcaseLayout({
    ...defaultBookcaseConfig,
    baseStyle: "plinth",
    crownStyle: "none",
    lighting: "no_lighting"
  });
  const plinth = findComponent(layout, "base");
  const planes = layout.metrics.referencePlanes;
  assert.equal(layout.validation.valid, true, JSON.stringify(layout.validation.errors));
  assert.equal(layout.metrics.baseHeight, CONSTRUCTION_RULES.flushPlinthHeight);
  assert.equal(plinth.bounds.min.x, planes.outerLeftPlaneX);
  assert.equal(plinth.bounds.max.x, planes.outerRightPlaneX);
  assert.equal(plinth.bounds.min.z, planes.finishedFrontPlaneZ);
  assert.equal(plinth.bounds.min.y, planes.floorPlaneY);
  assert.equal(plinth.metadata.purpose, "flush_plinth");
  assert.equal(plinth.metadata.allowDecorativeOverhang, false);
  assert.equal(plinth.metadata.allowOverhang, false);
  assert.equal(findComponent(layout, "base-plinth-cap"), null);
});

test("furniture base uses mirrored three-by-three front feet joined by an apron", () => {
  const layout = generateBookcaseLayout({
    ...defaultBookcaseConfig,
    baseStyle: "furniture_base",
    crownStyle: "none",
    lighting: "no_lighting"
  });
  const planes = layout.metrics.referencePlanes;
  const left = findComponent(layout, "base-foot-left");
  const right = findComponent(layout, "base-foot-right");
  const apron = findComponent(layout, "base-furniture-apron");
  const support = findComponent(layout, "base");
  assert.equal(layout.validation.valid, true, JSON.stringify(layout.validation.errors));
  assert.equal(layout.metrics.baseHeight, CONSTRUCTION_RULES.furnitureBaseHeight);
  assert.equal(left.size.x, CONSTRUCTION_RULES.furnitureFootWidth);
  assert.equal(right.size.x, CONSTRUCTION_RULES.furnitureFootWidth);
  assert.equal(left.size.z, CONSTRUCTION_RULES.furnitureFootDepth);
  assert.equal(right.size.z, CONSTRUCTION_RULES.furnitureFootDepth);
  assert.ok(left.size.z < layout.config.depth);
  assert.ok(right.size.z < layout.config.depth);
  assert.equal(left.bounds.min.x, planes.outerLeftPlaneX + CONSTRUCTION_RULES.furnitureFootOutsideInset);
  assert.equal(right.bounds.max.x, planes.outerRightPlaneX - CONSTRUCTION_RULES.furnitureFootOutsideInset);
  assert.equal(left.bounds.min.x, -right.bounds.max.x);
  assert.equal(left.bounds.max.x, -right.bounds.min.x);
  assert.equal(left.bounds.min.y, planes.floorPlaneY);
  assert.equal(right.bounds.min.y, planes.floorPlaneY);
  assert.equal(apron.bounds.min.x, left.bounds.max.x);
  assert.equal(apron.bounds.max.x, right.bounds.min.x);
  assert.equal(apron.bounds.max.y, left.bounds.max.y);
  assert.equal(apron.bounds.min.z, planes.finishedFrontPlaneZ);
  assert.equal(apron.metadata.floorContact, false);
  assert.equal(support.metadata.purpose, "hidden_rear_support");
  assert.equal(support.size.z, CONSTRUCTION_RULES.furnitureRearSupportDepth);
  assert.equal(support.bounds.max.z, planes.outerBackPlaneZ);
  assert.equal(support.bounds.min.x, planes.outerLeftPlaneX + CONSTRUCTION_RULES.furnitureRearSupportSideInset);
  assert.equal(support.bounds.max.x, planes.outerRightPlaneX - CONSTRUCTION_RULES.furnitureRearSupportSideInset);
  assert.equal(support.metadata.visible, false);
});

test("inset and migrated legacy layouts preserve explicit front-plane semantics", () => {
  const inset = singleSectionLayout({ arrangement: "single_hinge_left" });
  const insetDoor = byRole(inset, "door")[0];
  const insetHandle = byRole(inset, "handle")[0];
  const separator = byRole(inset, "fixed_shelf")[0];
  assert.equal(inset.validation.valid, true, JSON.stringify(inset.validation.errors));
  assert.equal(insetDoor.metadata.mounting, "inset");
  assert.equal(insetDoor.bounds.min.z, 0);
  assert.equal(insetDoor.bounds.max.z, CONSTRUCTION_RULES.doorThickness);
  assert.equal(insetDoor.metadata.frontPlaneZ, 0);
  assert.equal(insetDoor.metadata.backPlaneZ, CONSTRUCTION_RULES.doorThickness);
  assert.equal(insetHandle.bounds.max.z, insetDoor.bounds.min.z);
  assert.ok(insetHandle.bounds.min.z < insetDoor.bounds.min.z);
  assert.ok(separator.bounds.min.z >= insetDoor.bounds.max.z);

  const legacy = singleSectionLayout({
    constructionProfile: CONSTRUCTION_PROFILE_IDS.legacyOverlay,
    arrangement: "auto"
  });
  const legacyDoors = byRole(legacy, "door");
  assert.equal(legacy.validation.valid, true, JSON.stringify(legacy.validation.errors));
  assert.equal(legacyDoors.length, 2, "legacy lower-door Auto must preserve the former pair");
  for (const door of legacyDoors) {
    assert.equal(door.metadata.mounting, "overlay");
    assert.equal(door.metadata.constructionProfile, CONSTRUCTION_PROFILE_IDS.legacyOverlay);
    assert.equal(door.bounds.min.z, -CONSTRUCTION_RULES.doorThickness);
    assert.equal(door.bounds.max.z, 0);
    const handle = findComponent(legacy, `${door.id}-handle`);
    assert.equal(handle.bounds.max.z, door.bounds.min.z);
  }

  const insetDrawers = singleSectionLayout({ type: "drawers" });
  for (const drawer of byRole(insetDrawers, "drawer_front")) {
    assert.equal(drawer.metadata.mounting, "inset");
    assert.equal(drawer.bounds.min.z, 0);
    assert.equal(drawer.bounds.max.z, CONSTRUCTION_RULES.doorThickness);
  }
});

test("Auto uses finished leaf width at 18, 23, 31, and 46.5 inch openings", () => {
  const expectations = new Map([
    [18, { leafCount: 1, leafWidth: 17.75 }],
    [23, { leafCount: 1, leafWidth: 22.75 }],
    [31, { leafCount: 2, leafWidth: 15.3125 }],
    [46.5, { leafCount: 2, leafWidth: 23.0625 }]
  ]);
  for (const [width, expected] of expectations) {
    const resolved = resolveDoorArrangement({
      opening: { size: { x: width } },
      requested: "auto",
      constructionProfile: CONSTRUCTION_PROFILE_IDS.inset
    });
    assert.equal(resolved.valid, true);
    assert.equal(resolved.leafCount, expected.leafCount);
    assert.equal(resolved.leafWidth, expected.leafWidth);
  }

  const forcedWideSingle = resolveDoorArrangement({
    opening: { size: { x: 31 } },
    requested: "single_hinge_left"
  });
  assert.equal(forcedWideSingle.valid, false);
  assert.equal(forcedWideSingle.reason, "This opening is too wide for one supported door.");

  const forcedNarrowPair = resolveDoorArrangement({
    opening: { size: { x: 18 } },
    requested: "pair"
  });
  assert.equal(forcedNarrowPair.valid, false);
  assert.equal(forcedNarrowPair.reason, "A pair would create leaves below the supported minimum width.");
});

test("generated manual arrangements are either exact or rejected with leaf-width codes", () => {
  const overWideSingle = singleSectionLayout({
    width: 48,
    arrangement: "single_hinge_right"
  });
  assert.equal(overWideSingle.validation.valid, false);
  assert.ok(issueCodes(overWideSingle.validation).includes("DOOR_LEAF_TOO_WIDE"));
  assert.ok(byRole(overWideSingle, "door").every((door) => door.metadata.arrangementBuildable === false));

  const tooNarrowPair = generateBookcaseLayout({
    ...defaultBookcaseConfig,
    width: 48,
    sections: 2,
    baseStyle: "plinth",
    crownStyle: "none",
    lighting: "no_lighting",
    layoutMetadata: {
      sectionRatios: [15, 30.75],
      sectionTypes: ["lower_doors", "open"],
      sectionDoorLayouts: [{ arrangement: "pair" }, null]
    }
  });
  const narrowLeaves = byRole(tooNarrowPair, "door");
  assert.equal(findComponent(tooNarrowPair, "section-01").size.x, 15);
  assert.equal(tooNarrowPair.validation.valid, false);
  assert.ok(issueCodes(tooNarrowPair.validation).includes("DOOR_LEAF_TOO_NARROW"));
  assert.ok(narrowLeaves.every((door) => door.metadata.arrangementBuildable === false));

  const pair = singleSectionLayout({ width: 32.5, arrangement: "pair" });
  const leaves = byRole(pair, "door").sort((left, right) => left.position.x - right.position.x);
  const handles = byRole(pair, "handle").sort((left, right) => left.position.x - right.position.x);
  assert.equal(pair.validation.valid, true, JSON.stringify(pair.validation.errors));
  assert.equal(leaves.length, 2);
  assert.equal(pair.metrics.generatedDoorCount, 2);
  assert.equal(pair.config.doorCount, 2);
  approximately(leaves[0].size.x, leaves[1].size.x);
  approximately(leaves[1].bounds.min.x - leaves[0].bounds.max.x, CONSTRUCTION_RULES.doubleDoorCenterGap);
  assert.deepEqual(
    leaves.map((door) => [door.metadata.hingeSide, door.metadata.latchSide]),
    [["hinge_left", "latch_right"], ["hinge_right", "latch_left"]]
  );
  const meetingCenter = (leaves[0].bounds.max.x + leaves[1].bounds.min.x) / 2;
  approximately(meetingCenter - handles[0].position.x, handles[1].position.x - meetingCenter);
  approximately(handles[0].position.y, handles[1].position.y);
});

test("hinge side controls the latch-side handle and lower slab uses the two-inch reference", () => {
  const left = singleSectionLayout({
    arrangement: "single_hinge_left",
    doorStyle: "flat",
    hardware: "brass_knob"
  });
  const right = singleSectionLayout({
    arrangement: "single_hinge_right",
    doorStyle: "flat",
    hardware: "brass_knob"
  });
  const leftDoor = byRole(left, "door")[0];
  const rightDoor = byRole(right, "door")[0];
  const leftHandle = byRole(left, "handle")[0];
  const rightHandle = byRole(right, "handle")[0];

  assert.equal(leftDoor.metadata.hingeSide, "hinge_left");
  assert.equal(leftDoor.metadata.latchSide, "latch_right");
  assert.equal(rightDoor.metadata.hingeSide, "hinge_right");
  assert.equal(rightDoor.metadata.latchSide, "latch_left");
  approximately(leftDoor.bounds.max.x - leftHandle.metadata.mountingCenter.x, CONSTRUCTION_RULES.handleEdgeInset);
  approximately(leftDoor.bounds.max.y - leftHandle.metadata.mountingCenter.y, CONSTRUCTION_RULES.handleEdgeInset);
  approximately(rightHandle.metadata.mountingCenter.x - rightDoor.bounds.min.x, CONSTRUCTION_RULES.handleEdgeInset);
  approximately(rightDoor.bounds.max.y - rightHandle.metadata.mountingCenter.y, CONSTRUCTION_RULES.handleEdgeInset);
  approximately(leftHandle.position.x, -rightHandle.position.x);
  assert.equal(leftHandle.metadata.orientation, "neutral");
  assert.deepEqual(leftHandle.size, {
    x: CONSTRUCTION_RULES.knobDiameter,
    y: CONSTRUCTION_RULES.knobDiameter,
    z: CONSTRUCTION_RULES.knobProjection
  });
});

test("hardware solver covers lower framed, upper glass, tall, and drawer contexts", () => {
  const lower = singleSectionLayout({
    arrangement: "single_hinge_left",
    doorStyle: "shaker",
    hardware: "brass_pull"
  });
  const lowerDoor = byRole(lower, "door")[0];
  const lowerHandle = byRole(lower, "handle")[0];
  assert.equal(lowerHandle.metadata.placementRuleId, "lower_latch_frame");
  assert.equal(lowerHandle.metadata.supportingFrontRegion, "right_stile");
  assert.equal(lowerHandle.metadata.orientation, "vertical");
  assert.ok(pointInRegion(lowerHandle.metadata.mountingCenter, lowerDoor.metadata.profileGeometry.solidRegions[1]));

  const upper = glassUpperLayout({ hardware: "brass_pull" });
  const glassDoor = byRole(upper, "door")[0];
  const glassHandle = byRole(upper, "handle")[0];
  assert.equal(upper.validation.valid, true, JSON.stringify(upper.validation.errors));
  assert.equal(glassDoor.metadata.profileGeometry.fieldRegion.kind, "glass");
  assert.equal(glassHandle.metadata.placementRuleId, "upper_latch_frame");
  assert.equal(glassHandle.metadata.supportingFrontRegion, "right_stile");
  assert.ok(!pointInRegion(glassHandle.metadata.mountingCenter, glassDoor.metadata.profileGeometry.fieldRegion));
  assert.ok(glassHandle.position.y < glassDoor.position.y);

  const tall = singleSectionLayout({
    type: "tall_doors",
    arrangement: "single_hinge_right",
    hardware: "brass_pull"
  });
  const tallDoor = byRole(tall, "door")[0];
  const tallHandle = byRole(tall, "handle")[0];
  assert.equal(tallHandle.metadata.placementRuleId, "tall_latch_stile_aff_40");
  assert.equal(tallHandle.metadata.orientation, "vertical");
  assert.equal(tallHandle.metadata.latchSide, "latch_left");
  approximately(tallHandle.metadata.mountingCenter.y, CONSTRUCTION_RULES.tallDoorHandleCenterY);
  assert.ok(tallHandle.bounds.min.y >= tallDoor.bounds.min.y);
  assert.ok(tallHandle.bounds.max.y <= tallDoor.bounds.max.y);

  const drawers = singleSectionLayout({
    type: "drawers",
    drawerFrontStyle: "shaker",
    hardware: "brass_pull"
  });
  for (const drawer of byRole(drawers, "drawer_front")) {
    const handle = findComponent(drawers, `${drawer.id}-handle`);
    assert.equal(handle.metadata.orientation, "horizontal");
    assert.equal(handle.metadata.placementRuleId, "drawer_frame_nearest_safe_rail_centerline");
    approximately(handle.metadata.mountingCenter.x, drawer.position.x);
    const region = drawer.metadata.profileGeometry.solidRegions.find(
      (item) => item.id === handle.metadata.supportingFrontRegion
    );
    assert.ok(pointInRegion(handle.metadata.mountingCenter, region));
  }
});

test("hardware finish variants preserve catalog geometry while type changes geometry", () => {
  const pulls = hardwareVariants.filter((variant) => variant.type === "pull").map((variant) => {
    const layout = singleSectionLayout({
      doorStyle: "flat",
      arrangement: "single_hinge_left",
      hardware: variant.value
    });
    const handle = byRole(layout, "handle")[0];
    return { size: handle.size, position: handle.position, orientation: handle.metadata.orientation };
  });
  for (const geometry of pulls.slice(1)) assert.deepEqual(geometry, pulls[0]);

  const knobs = hardwareVariants.filter((variant) => variant.type === "knob").map((variant) => {
    const layout = singleSectionLayout({
      doorStyle: "flat",
      arrangement: "single_hinge_left",
      hardware: variant.value
    });
    const handle = byRole(layout, "handle")[0];
    return { size: handle.size, position: handle.position, orientation: handle.metadata.orientation };
  });
  for (const geometry of knobs.slice(1)) assert.deepEqual(geometry, knobs[0]);
  assert.notDeepEqual(pulls[0].size, knobs[0].size);

  const pushLatch = singleSectionLayout({ hardware: "push_latch" });
  assert.equal(byRole(pushLatch, "handle").length, 0);
  assert.equal(pushLatch.validation.valid, true, JSON.stringify(pushLatch.validation.errors));
});

test("front profiles use stable inch dimensions and safely clamp short drawers", () => {
  const shakerNarrow = singleSectionLayout({
    width: 24,
    arrangement: "single_hinge_left",
    doorStyle: "shaker"
  });
  const shakerWide = singleSectionLayout({
    width: 25.5,
    arrangement: "single_hinge_left",
    doorStyle: "shaker"
  });
  const slim = singleSectionLayout({ doorStyle: "slim_shaker" });
  const flat = singleSectionLayout({ doorStyle: "flat" });
  const glass = glassUpperLayout();
  const narrowProfile = byRole(shakerNarrow, "door")[0].metadata.profileGeometry;
  const wideProfile = byRole(shakerWide, "door")[0].metadata.profileGeometry;
  const slimProfile = byRole(slim, "door")[0].metadata.profileGeometry;
  const flatProfile = byRole(flat, "door")[0].metadata.profileGeometry;
  const glassProfile = byRole(glass, "door")[0].metadata.profileGeometry;
  assert.equal(narrowProfile.frameWidth, CONSTRUCTION_RULES.shakerFrameWidth);
  assert.equal(wideProfile.frameWidth, CONSTRUCTION_RULES.shakerFrameWidth);
  assert.equal(narrowProfile.nominalFrameWidth, FRONT_PROFILE_CATALOG.shaker.nominalFrameWidth);
  assert.equal(slimProfile.frameWidth, CONSTRUCTION_RULES.slimShakerFrameWidth);
  assert.ok(slimProfile.frameWidth < narrowProfile.frameWidth);
  assert.equal(flatProfile.kind, "slab");
  assert.equal(flatProfile.frameWidth, 0);
  assert.equal(glassProfile.frameWidth, CONSTRUCTION_RULES.glassFrameWidth);
  assert.equal(glassProfile.fieldRegion.kind, "glass");

  const shortDrawers = singleSectionLayout({
    type: "drawers",
    drawerCount: 5,
    drawerFrontStyle: "shaker"
  });
  assert.equal(shortDrawers.validation.valid, true, JSON.stringify(shortDrawers.validation.errors));
  for (const drawer of byRole(shortDrawers, "drawer_front")) {
    const profile = drawer.metadata.profileGeometry;
    assert.equal(profile.valid, true);
    assert.equal(profile.correction, "PROFILE_FRAME_WIDTH_REDUCED");
    assert.ok(profile.frameWidth < CONSTRUCTION_RULES.shakerFrameWidth);
    assert.ok(profile.frameWidth >= CONSTRUCTION_RULES.minDrawerProfileFrameWidth);
    assert.ok(profile.centerFieldBounds.max.x > profile.centerFieldBounds.min.x);
    assert.ok(profile.centerFieldBounds.max.y > profile.centerFieldBounds.min.y);
    approximately(
      profile.centerFieldBounds.max.y - profile.centerFieldBounds.min.y,
      CONSTRUCTION_RULES.minProfileCenterField
    );
  }
});

test("named validator invariants identify semantic front, hardware, profile, and base mutations", () => {
  const lower = singleSectionLayout({
    arrangement: "single_hinge_left",
    doorStyle: "shaker",
    hardware: "brass_pull"
  });
  expectMutationCode(lower, "FRONT_PLANE_MISMATCH", (layout) => {
    byRole(layout, "door")[0].metadata.frontPlaneZ += 0.25;
  });
  expectMutationCode(lower, "HINGE_LATCH_CONFLICT", (layout) => {
    const door = byRole(layout, "door")[0];
    door.metadata.latchSide = "latch_left";
  });
  expectMutationCode(lower, "HARDWARE_OUTSIDE_FRONT", (layout) => {
    const handle = byRole(layout, "handle")[0];
    handle.bounds.min.x += 100;
    handle.bounds.max.x += 100;
    syncBox(handle);
  });
  expectMutationCode(lower, "HARDWARE_COUNT_MISMATCH", (layout) => {
    layout.components = layout.components.filter((component) => component.role !== "handle");
  });
  expectMutationCode(lower, "PROFILE_SUBGEOMETRY_OUTSIDE_FRONT", (layout) => {
    const door = byRole(layout, "door")[0];
    door.metadata.profileGeometry.solidRegions[0].bounds.min.x = door.bounds.min.x - 1;
  });

  const glass = glassUpperLayout({ hardware: "brass_pull" });
  expectMutationCode(glass, "HARDWARE_ON_GLASS", (layout) => {
    const door = byRole(layout, "door")[0];
    const handle = byRole(layout, "handle")[0];
    const field = door.metadata.profileGeometry.fieldRegion.bounds;
    const center = {
      x: round((field.min.x + field.max.x) / 2),
      y: round((field.min.y + field.max.y) / 2),
      z: door.metadata.frontPlaneZ
    };
    const halfX = handle.size.x / 2;
    const halfY = handle.size.y / 2;
    handle.bounds.min.x = center.x - halfX;
    handle.bounds.max.x = center.x + halfX;
    handle.bounds.min.y = center.y - halfY;
    handle.bounds.max.y = center.y + halfY;
    handle.metadata.mountingCenter = center;
    handle.metadata.mountingCenters = [center];
    syncBox(handle);
  });
  expectMutationCode(glass, "HARDWARE_ON_GLASS", (layout) => {
    const door = byRole(layout, "door")[0];
    const handle = byRole(layout, "handle")[0];
    const field = door.metadata.profileGeometry.fieldRegion.bounds;
    handle.bounds.min.x = field.max.x - 0.25;
    syncBox(handle);
  });

  const flatLatch = singleSectionLayout({
    arrangement: "single_hinge_left",
    doorStyle: "flat",
    hardware: "brass_knob"
  });
  expectMutationCode(flatLatch, "HARDWARE_LATCH_SIDE_MISMATCH", (layout) => {
    const door = byRole(layout, "door")[0];
    const handle = byRole(layout, "handle")[0];
    const center = {
      ...handle.metadata.mountingCenter,
      x: door.bounds.min.x + CONSTRUCTION_RULES.handleEdgeInset
    };
    const halfX = handle.size.x / 2;
    handle.bounds.min.x = center.x - halfX;
    handle.bounds.max.x = center.x + halfX;
    handle.metadata.mountingCenter = center;
    handle.metadata.mountingCenters = [center];
    syncBox(handle);
  });

  const pair = singleSectionLayout({ width: 32.5, arrangement: "pair" });
  expectMutationCode(pair, "PAIR_MEETING_GAP_MISMATCH", (layout) => {
    const leaves = byRole(layout, "door").sort((left, right) => left.position.x - right.position.x);
    leaves[0].bounds.max.x += 0.05;
    syncBox(leaves[0]);
  });

  const toe = generateBookcaseLayout({
    ...defaultBookcaseConfig,
    baseStyle: "toe_kick",
    crownStyle: "none",
    lighting: "no_lighting"
  });
  expectMutationCode(toe, "TOE_KICK_VOID_OCCUPIED", (layout) => {
    const structural = findComponent(layout, "base");
    structural.bounds.min.z = 1;
    syncBox(structural);
  });
  expectMutationCode(toe, "TOE_KICK_VOID_OCCUPIED", (layout) => {
    const toeVoid = findComponent(layout, "base-toe-kick-void");
    const foreignSolid = clone(toeVoid);
    foreignSolid.id = "foreign-trim-inside-toe-void";
    foreignSolid.role = "trim";
    foreignSolid.metadata = { style: "foreign_style", purpose: "invalid_fill", visible: true };
    layout.components.push(foreignSolid);
  });

  const plinth = generateBookcaseLayout({
    ...defaultBookcaseConfig,
    baseStyle: "plinth",
    crownStyle: "none",
    lighting: "no_lighting"
  });
  expectMutationCode(plinth, "PLINTH_NOT_FLUSH", (layout) => {
    const base = findComponent(layout, "base");
    base.bounds.min.z -= 0.25;
    syncBox(base);
  });

  const furniture = generateBookcaseLayout({
    ...defaultBookcaseConfig,
    baseStyle: "furniture_base",
    crownStyle: "none",
    lighting: "no_lighting"
  });
  expectMutationCode(furniture, "FURNITURE_FOOT_FULL_DEPTH", (layout) => {
    const foot = findComponent(layout, "base-foot-left");
    foot.bounds.max.z = layout.config.depth;
    syncBox(foot);
  });
  expectMutationCode(furniture, "FURNITURE_SUPPORT_NOT_HIDDEN", (layout) => {
    const support = findComponent(layout, "base");
    support.bounds.min.x = layout.metrics.referencePlanes.outerLeftPlaneX;
    syncBox(support);
  });

  const crownedLights = generateBookcaseLayout({
    ...defaultBookcaseConfig,
    crownStyle: "classic_crown",
    lighting: "warm_pucks"
  });
  expectMutationCode(crownedLights, "ATTACHMENT_SURFACE_DISCONNECTED", (layout) => {
    const light = byRole(layout, "light")[0];
    const crown = findComponent(layout, "crown-classic-cap");
    light.hostId = crown.id;
    const height = light.size.y;
    light.bounds.max.y = crown.bounds.min.y;
    light.bounds.min.y = crown.bounds.min.y - height;
    syncBox(light);
  });
});

test("layout metrics separate nominal and decorative envelopes", () => {
  const layout = generateBookcaseLayout({
    ...defaultBookcaseConfig,
    baseStyle: "plinth",
    crownStyle: "classic_crown",
    hardware: "brass_pull",
    lighting: "no_lighting"
  });
  const root = findComponent(layout, "bookcase");
  assert.equal(layout.validation.valid, true, JSON.stringify(layout.validation.errors));
  assertBoundsEqual(layout.metrics.nominalBounds, root.bounds);
  assert.equal(layout.metrics.finishedFrontPlaneZ, 0);
  assert.equal(layout.metrics.maximumFrontProjection, CONSTRUCTION_RULES.pullProjection);
  assert.equal(layout.metrics.maximumSideOverhang, CONSTRUCTION_RULES.maxCrownSideOverhang);
  assert.equal(layout.metrics.maximumTopOverhang, 0);
  assert.equal(layout.metrics.decorativeBounds.min.x, root.bounds.min.x - CONSTRUCTION_RULES.maxCrownSideOverhang);
  assert.equal(layout.metrics.decorativeBounds.max.x, root.bounds.max.x + CONSTRUCTION_RULES.maxCrownSideOverhang);
  assert.equal(layout.metrics.decorativeBounds.min.z, -CONSTRUCTION_RULES.pullProjection);
  assert.equal(layout.metrics.decorativeBounds.max.z, root.bounds.max.z);
});

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

test("fixed-seed construction sweep is finite, deterministic, and rejects unsupported leaves", () => {
  const random = mulberry32(0x4a515631);
  const bases = ["toe_kick", "plinth", "furniture_base"];
  const profiles = ["flat", "shaker", "slim_shaker", "glass"];
  const sectionKinds = ["open", "lower_doors", "drawers", "tall_doors"];
  const arrangements = [...DOOR_ARRANGEMENTS];
  const hardware = [...hardwareVariants.map((variant) => variant.value), "push_latch"];
  const lights = ["no_lighting", "warm_pucks", "vertical_led", "shelf_accent", "full_package"];
  const crowns = ["none", "slim_cap", "classic_crown", "modern_soffit"];
  const heights = [72, 84, 96, 108, 120];
  const depths = [10, 12, 15, 18, 24];
  const seen = {
    bases: new Set(),
    profiles: new Set(),
    sectionKinds: new Set(),
    arrangements: new Set(),
    hardware: new Set(),
    lights: new Set(),
    crowns: new Set(),
    heights: new Set(),
    depths: new Set(),
    widths: new Set(),
    sections: new Set(),
    ratioKinds: new Set()
  };
  let rejectedManualLayouts = 0;
  let rejectedAutoLayouts = 0;
  let acceptedLayouts = 0;

  for (let index = 0; index < 120; index += 1) {
    const sections = 1 + (index % 6);
    const asymmetric = sections > 1 && index % 2 === 1;
    const panelEnvelope = CONSTRUCTION_RULES.panelThickness * (sections + 1);
    const minimumBay = asymmetric ? 18 : CONSTRUCTION_RULES.minSectionClearWidth;
    const minimumWidth = panelEnvelope + minimumBay * sections;
    const width = index === 0
      ? 24
      : index === 1
        ? 144
        : Math.round((minimumWidth + random() * (144 - minimumWidth)) * 4) / 4;
    const sectionTypes = Array.from(
      { length: sections },
      (_, sectionIndex) => sectionKinds[(index + sectionIndex) % sectionKinds.length]
    );
    const sectionDoorLayouts = sectionTypes.map((type, sectionIndex) => {
      if (type !== "lower_doors" && type !== "tall_doors") return null;
      const arrangement = arrangements[(Math.floor(index / 2) + sectionIndex) % arrangements.length];
      seen.arrangements.add(arrangement);
      return { arrangement };
    });
    const sectionRatios = asymmetric
      ? Array.from({ length: sections }, (_, sectionIndex) => 0.95 + ((index + sectionIndex) % 5) * 0.025)
      : Array(sections).fill(1);
    const config = {
      ...defaultBookcaseConfig,
      width,
      height: heights[index % heights.length],
      depth: depths[(index * 2) % depths.length],
      sections,
      shelves: 2 + (index % 7),
      baseStyle: bases[index % bases.length],
      doorStyle: profiles[index % profiles.length],
      drawerFrontStyle: profiles[index % 3],
      hardware: hardware[index % hardware.length],
      lighting: lights[index % lights.length],
      crownStyle: crowns[index % crowns.length],
      layoutType: index % 11 === 0 ? "glass_library" : "mixed",
      layoutMetadata: { sectionRatios, sectionTypes, sectionDoorLayouts }
    };
    const layout = generateBookcaseLayout(config);
    const repeated = generateBookcaseLayout(config);
    assert.deepEqual(layout, repeated, `generation changed at sweep case ${index}`);
    assert.equal(layout.config.sections, sections);

    seen.bases.add(config.baseStyle);
    seen.profiles.add(config.doorStyle);
    seen.hardware.add(config.hardware);
    seen.lights.add(config.lighting);
    seen.crowns.add(config.crownStyle);
    seen.heights.add(config.height);
    seen.depths.add(config.depth);
    seen.widths.add(config.width);
    seen.sections.add(config.sections);
    seen.ratioKinds.add(asymmetric ? "asymmetric" : "symmetric");
    sectionTypes.forEach((type) => seen.sectionKinds.add(type));

    const ids = new Set(layout.components.map((component) => component.id));
    assert.equal(ids.size, layout.components.length);
    for (const component of layout.components) {
      const values = [
        ...Object.values(component.size),
        ...Object.values(component.position),
        ...Object.values(component.bounds.min),
        ...Object.values(component.bounds.max)
      ];
      assert.ok(values.every(Number.isFinite), `${component.id} is non-finite in case ${index}`);
      assert.ok(Object.values(component.size).every((value) => value > 0), `${component.id} is non-positive in case ${index}`);
      if (component.id !== "bookcase") assert.ok(ids.has(component.parentId), `${component.id} is missing its parent`);
      if (component.hostId) assert.ok(ids.has(component.hostId), `${component.id} is missing its host`);
    }

    for (const front of layout.components.filter((component) =>
      component.role === "door" || component.role === "drawer_front"
    )) {
      approximately(front.bounds.min.z, front.metadata.frontPlaneZ);
      assert.ok(front.bounds.max.z > front.bounds.min.z);
      assert.equal(front.metadata.mounting, "inset");
    }
    for (const handle of byRole(layout, "handle")) {
      const host = findComponent(layout, handle.hostId);
      approximately(handle.bounds.max.z, host.metadata.frontPlaneZ);
      const center = handle.metadata.mountingCenter;
      assert.ok(host.metadata.profileGeometry.solidRegions.some((region) => pointInRegion(center, region)));
      if (host.metadata.profileGeometry.fieldRegion?.kind === "glass") {
        assert.equal(pointInRegion(center, host.metadata.profileGeometry.fieldRegion), false);
      }
    }
    if (config.baseStyle === "toe_kick") {
      const toeVoid = findComponent(layout, "base-toe-kick-void");
      const physicalBase = layout.components.filter((component) =>
        ["base", "trim"].includes(component.role) && component.metadata?.style === "toe_kick"
      );
      assert.equal(toeVoid.size.z, CONSTRUCTION_RULES.recessedToeKickDepth);
      assert.ok(physicalBase.every((component) => !boundsIntersect(component.bounds, toeVoid.bounds)));
    }

    const rejectedLeaves = byRole(layout, "door").filter(
      (door) => door.metadata.arrangementBuildable === false
    );
    if (rejectedLeaves.length) {
      if (rejectedLeaves.some((door) => door.metadata.requestedArrangement !== "auto")) {
        rejectedManualLayouts += 1;
      }
      if (rejectedLeaves.some((door) => door.metadata.requestedArrangement === "auto")) {
        rejectedAutoLayouts += 1;
      }
      assert.equal(layout.validation.valid, false);
      assert.ok(layout.validation.errors.every((error) =>
        error.code === "DOOR_LEAF_TOO_WIDE" || error.code === "DOOR_LEAF_TOO_NARROW"
      ), JSON.stringify({ index, errors: layout.validation.errors }));
    } else {
      acceptedLayouts += 1;
      assert.equal(layout.validation.valid, true, JSON.stringify({ index, errors: layout.validation.errors }));
    }
  }

  assert.ok(acceptedLayouts > 0);
  assert.ok(rejectedManualLayouts > 0);
  assert.ok(rejectedAutoLayouts > 0);
  assert.deepEqual([...seen.bases].sort(), [...bases].sort());
  assert.deepEqual([...seen.profiles].sort(), [...profiles].sort());
  assert.deepEqual([...seen.sectionKinds].sort(), [...sectionKinds].sort());
  assert.deepEqual([...seen.arrangements].sort(), [...arrangements].sort());
  assert.deepEqual([...seen.hardware].sort(), [...hardware].sort());
  assert.deepEqual([...seen.lights].sort(), [...lights].sort());
  assert.deepEqual([...seen.crowns].sort(), [...crowns].sort());
  assert.deepEqual([...seen.heights].sort((a, b) => a - b), heights);
  assert.deepEqual([...seen.depths].sort((a, b) => a - b), depths);
  assert.deepEqual([...seen.sections].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual([...seen.ratioKinds].sort(), ["asymmetric", "symmetric"]);
  assert.ok(seen.widths.has(24));
  assert.ok(seen.widths.has(144));
});
