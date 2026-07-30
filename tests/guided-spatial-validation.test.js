import test from "node:test";
import assert from "node:assert/strict";
import {
  createProject,
  validateMeasurements,
  validateSpatialRelationships
} from "../guided-configurator-state.js";

const warningFields = (warnings) => warnings.map((warning) => warning.field);

test("niche relationships compare the room envelope without treating depth differences as conflicts", () => {
  const warnings = validateSpatialRelationships({
    wallWidth: 120,
    ceilingHeight: 96,
    desiredDepth: 24,
    nicheWidth: 97,
    nicheHeight: 97,
    nicheDepth: 4,
    leftReturn: 12,
    rightReturn: 12
  });

  assert.deepEqual(warningFields(warnings), ["nicheHeight", "nicheWidth"]);
  assert.match(warnings[0].message, /niche height.*exceeds.*ceiling height/i);
  assert.match(warnings[1].message, /niche width.*left and right returns.*does not match.*wall width/i);
  assert.ok(warnings.every((warning) => warning.message.includes("You can continue")));

  assert.deepEqual(validateSpatialRelationships({
    wallWidth: 100.3,
    ceilingHeight: 96,
    desiredDepth: 24,
    nicheWidth: 100,
    nicheHeight: 96,
    nicheDepth: 4,
    leftReturn: 0.1,
    rightReturn: 0.2
  }), []);

  assert.deepEqual(validateSpatialRelationships({
    wallWidth: 120,
    nicheWidth: 96,
    leftReturn: 12,
    desiredDepth: 24,
    nicheDepth: 4
  }), []);
});

test("door and window extents warn when openings run beyond the wall or ceiling", () => {
  const doorWarnings = validateSpatialRelationships({
    wallWidth: 120,
    ceilingHeight: 96,
    doorWidth: 40,
    doorHeight: 97,
    doorLeftDistance: 81
  });

  assert.deepEqual(warningFields(doorWarnings), ["doorWidth", "doorHeight"]);
  assert.match(doorWarnings[0].message, /extent from the left wall.*exceeds.*wall width/i);
  assert.match(doorWarnings[1].message, /door height.*exceeds.*ceiling height/i);

  const windowWarnings = validateSpatialRelationships({
    wallWidth: 120,
    ceilingHeight: 96,
    windowWidth: 48,
    windowHeight: 42,
    sillHeight: 55,
    windowLeftDistance: 40,
    windowRightDistance: 33
  });

  assert.deepEqual(warningFields(windowWarnings), ["windowWidth", "windowHeight"]);
  assert.match(windowWarnings[0].message, /window width.*known wall distances.*exceed.*wall width/i);
  assert.match(windowWarnings[1].message, /sill height plus window height.*exceed.*ceiling height/i);

  assert.deepEqual(validateSpatialRelationships({
    wallWidth: 120,
    ceilingHeight: 96,
    windowWidth: 48,
    windowHeight: 42,
    sillHeight: 54,
    windowLeftDistance: 36,
    windowRightDistance: 36
  }), []);
});

test("fireplace openings, mantel dimensions, and explicit side widths stay within the room envelope", () => {
  const envelopeWarnings = validateSpatialRelationships({
    wallWidth: 120,
    ceilingHeight: 96,
    fireplaceWidth: 121,
    fireplaceHeight: 97,
    mantelWidth: 122,
    mantelHeight: 98,
    fireplaceLeftWidth: 12,
    fireplaceRightWidth: 12
  });

  assert.deepEqual(warningFields(envelopeWarnings), [
    "fireplaceWidth",
    "fireplaceHeight",
    "mantelWidth",
    "mantelHeight"
  ]);
  assert.match(envelopeWarnings[0].message, /fireplace opening width.*exceeds.*wall width/i);
  assert.match(envelopeWarnings[1].message, /fireplace opening height.*exceeds.*ceiling height/i);
  assert.match(envelopeWarnings[2].message, /mantel width.*exceeds.*wall width/i);
  assert.match(envelopeWarnings[3].message, /mantel height.*exceeds.*ceiling height/i);

  const sideWidthWarnings = validateSpatialRelationships({
    wallWidth: 120,
    fireplaceWidth: 42,
    fireplaceLeftWidth: 40,
    fireplaceRightWidth: 39
  });

  assert.deepEqual(warningFields(sideWidthWarnings), ["fireplaceWidth"]);
  assert.match(sideWidthWarnings[0].message, /available widths on both sides.*total 121 in.*wall width/i);
});

test("validateMeasurements appends spatial warnings without making them blockers or replacing range checks", () => {
  const nicheProject = createProject({ now: 1, random: 0.25, category: "bookcase" });
  nicheProject.layout = "left-niche";
  nicheProject.measurements = {
    wallWidth: 120,
    ceilingHeight: 96,
    desiredDepth: 14,
    nicheWidth: 97,
    nicheHeight: 97,
    nicheDepth: 14,
    leftReturn: 12,
    rightReturn: 12
  };

  const spatialResult = validateMeasurements(nicheProject);
  assert.equal(spatialResult.valid, true);
  assert.deepEqual(warningFields(spatialResult.warnings), ["nicheHeight", "nicheWidth"]);
  assert.equal(spatialResult.errors.length, 0);

  const rangeProject = createProject({ now: 2, random: 0.5, category: "bookcase" });
  rangeProject.layout = "clear-wall";
  rangeProject.measurements = {
    wallWidth: 200,
    ceilingHeight: 60,
    desiredDepth: 30
  };

  const rangeResult = validateMeasurements(rangeProject);
  assert.equal(rangeResult.valid, true);
  assert.equal(rangeResult.warnings.length, 3);
  assert.ok(rangeResult.warnings.every((warning) => /outside our usual.*You can continue/i.test(warning.message)));
});
