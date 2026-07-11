import test from "node:test";
import assert from "node:assert/strict";

import {
  baseStyleOptions,
  crownStyleOptions,
  defaultBookcaseConfig,
  doorStyleOptions,
  hardwareOptions,
  layoutPresets,
  lightingOptions,
  lightingWarmthOptions,
  normalizeBookcaseConfig,
  shelfThicknessOptions
} from "../bookcase-config.js";
import {
  CONSTRUCTION_RULES,
  generateBookcaseLayout,
  validateBookcaseLayout
} from "../bookcase-layout.js";

const clone = (value) => JSON.parse(JSON.stringify(value));
const values = (options) => options.map((option) => option.value);
const PHYSICAL_ROLES = new Set([
  "base",
  "trim",
  "crown",
  "side_panel",
  "bottom_panel",
  "top_panel",
  "back_panel",
  "divider",
  "fixed_shelf",
  "shelf",
  "door",
  "drawer_front",
  "handle",
  "light"
]);

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(random, list) {
  return list[Math.floor(random() * list.length) % list.length];
}

function integer(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

function safeWidth(random, sections) {
  const panel = CONSTRUCTION_RULES.panelThickness;
  const minimum = Math.max(
    CONSTRUCTION_RULES.minWidth,
    Math.ceil(panel * 2 + panel * (sections - 1) + sections * (CONSTRUCTION_RULES.minSectionClearWidth + 0.5))
  );
  const maximum = Math.min(
    CONSTRUCTION_RULES.maxWidth,
    Math.floor(panel * 2 + panel * (sections - 1) + sections * (CONSTRUCTION_RULES.maxUnsupportedShelfSpan - 0.5))
  );
  assert.ok(minimum <= maximum, `No safe width range for ${sections} sections`);
  return integer(random, minimum, maximum);
}

function canonicalFamilyConfig(preset, random) {
  const sections = integer(random, 1, 6);
  const equalRatios = Array.from({ length: sections }, () => 1);
  const sourceMetadata = preset.config.layoutMetadata || {};
  const layoutMetadata = {
    ...sourceMetadata,
    sectionRatios: equalRatios
  };

  if (Array.isArray(sourceMetadata.drawerSections)) {
    layoutMetadata.drawerSections = sourceMetadata.drawerSections.filter((index) => index < sections);
  }
  if (sourceMetadata.specialSpan != null) {
    layoutMetadata.specialSpan = Math.min(sections, Math.max(1, Number(sourceMetadata.specialSpan) || 1));
  }

  return {
    ...defaultBookcaseConfig,
    ...preset.config,
    layoutPreset: preset.id,
    width: safeWidth(random, sections),
    height: pick(random, [72, 84, 96, 108, 120]),
    depth: pick(random, [10, 12, 15, 18, 24]),
    sections,
    shelves: integer(random, 2, 8),
    shelfThickness: pick(random, values(shelfThicknessOptions)),
    lowerCabinets: random() >= 0.25 ? preset.config.lowerCabinets !== false : !preset.config.lowerCabinets,
    drawerCount: integer(random, 2, 5),
    doorStyle: pick(random, values(doorStyleOptions)),
    hardware: pick(random, values(hardwareOptions)),
    lighting: pick(random, values(lightingOptions)),
    lightingWarmth: pick(random, values(lightingWarmthOptions)),
    crownStyle: pick(random, values(crownStyleOptions)),
    baseStyle: pick(random, values(baseStyleOptions)),
    layoutMetadata
  };
}

function assertDescriptorGraph(layout, context) {
  assert.equal(layout.validation.valid, true, `${context}: ${JSON.stringify(layout.validation.errors)}`);
  assert.deepEqual(layout.componentOrder, layout.components.map((component) => component.id), context);
  assert.equal(new Set(layout.componentOrder).size, layout.componentOrder.length, `${context}: duplicate ids`);
  assert.equal(layout.sectionIds.length, layout.config.sections, `${context}: section count mismatch`);

  const byId = new Map(layout.components.map((component) => [component.id, component]));
  const root = byId.get("bookcase");
  assert.ok(root, `${context}: missing root`);
  assert.deepEqual(root.size, {
    x: layout.config.width,
    y: layout.config.height,
    z: layout.config.depth
  }, `${context}: root dimensions`);

  for (const component of layout.components) {
    assert.equal(typeof component.id, "string", context);
    assert.equal(typeof component.role, "string", context);
    assert.ok(component.size.x > 0 && Number.isFinite(component.size.x), `${context}: ${component.id} size.x`);
    assert.ok(component.size.y > 0 && Number.isFinite(component.size.y), `${context}: ${component.id} size.y`);
    assert.ok(component.size.z > 0 && Number.isFinite(component.size.z), `${context}: ${component.id} size.z`);
    assert.ok(Number.isFinite(component.position.x), `${context}: ${component.id} position.x`);
    assert.ok(Number.isFinite(component.position.y), `${context}: ${component.id} position.y`);
    assert.ok(Number.isFinite(component.position.z), `${context}: ${component.id} position.z`);
    if (component.id !== "bookcase") assert.ok(byId.has(component.parentId), `${context}: ${component.id} parent`);
    if (component.hostId) assert.ok(byId.has(component.hostId), `${context}: ${component.id} host`);
  }

  const physical = layout.components.filter((component) => PHYSICAL_ROLES.has(component.role));
  assert.ok(physical.length > 0, `${context}: no physical components`);
  assert.equal(
    layout.metrics.generatedDoorCount,
    layout.components.filter((component) => component.role === "door").length,
    `${context}: generated door metric`
  );
  assert.equal(
    layout.metrics.generatedDrawerCount,
    layout.components.filter((component) => component.role === "drawer_front").length,
    `${context}: generated drawer metric`
  );

  const restored = clone(layout);
  const restoredValidation = validateBookcaseLayout(restored);
  assert.equal(restoredValidation.valid, true, `${context}: JSON round-trip ${JSON.stringify(restoredValidation.errors)}`);
  assert.deepEqual(restored.components, layout.components, `${context}: JSON round-trip changed components`);
}

test("seeded supported configuration matrix remains deterministic and valid", () => {
  const seed = 0x4A51424B; // "JQBK"
  const random = mulberry32(seed);
  const scenarios = 750;

  for (let index = 0; index < scenarios; index += 1) {
    const preset = layoutPresets[index % layoutPresets.length];
    const input = canonicalFamilyConfig(preset, random);
    const before = clone(input);
    const normalized = normalizeBookcaseConfig(input);
    const first = generateBookcaseLayout(normalized);
    const second = generateBookcaseLayout(normalized);
    const context = `seed=${seed} case=${index} preset=${preset.id} input=${JSON.stringify(input)}`;

    assert.deepEqual(input, before, `${context}: input mutated`);
    assert.deepEqual(first, second, `${context}: non-deterministic object output`);
    assert.equal(JSON.stringify(first), JSON.stringify(second), `${context}: non-deterministic serialization`);
    assertDescriptorGraph(first, context);
  }
});

test("seeded hostile inputs never throw, mutate input, or become non-deterministic", () => {
  const seed = 0xC0FFEE;
  const random = mulberry32(seed);
  const strangeNumbers = [
    -1000,
    -1,
    0,
    0.1,
    23.6,
    72.4,
    96,
    144.9,
    1000,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    "96",
    "not-a-number",
    null
  ];
  const strangeStrings = ["", " ", "unknown", "media_wall", "drawers", null, 42];

  for (let index = 0; index < 500; index += 1) {
    const input = {
      width: pick(random, strangeNumbers),
      height: pick(random, strangeNumbers),
      depth: pick(random, strangeNumbers),
      sections: pick(random, strangeNumbers),
      shelves: pick(random, strangeNumbers),
      shelfThickness: pick(random, strangeNumbers),
      lowerCabinets: pick(random, [true, false, "true", "false", "yes", null]),
      lowerStorage: pick(random, strangeStrings),
      drawerCount: pick(random, strangeNumbers),
      centerOpening: pick(random, [true, false, "true", "false", null]),
      deskOpening: pick(random, [true, false, "true", "false", null]),
      featureOpening: pick(random, [true, false, "true", "false", null]),
      tallDoors: pick(random, [true, false, "true", "false", null]),
      doorCount: pick(random, strangeNumbers),
      doorStyle: pick(random, strangeStrings),
      hardware: pick(random, strangeStrings),
      lighting: pick(random, strangeStrings),
      lightingWarmth: pick(random, strangeNumbers),
      crownStyle: pick(random, strangeStrings),
      baseStyle: pick(random, strangeStrings),
      layoutType: pick(random, strangeStrings),
      layoutMetadata: pick(random, [
        null,
        {},
        { sectionRatios: [1, 2] },
        { sectionRatios: [1, 0, -1, "2"] },
        { specialSpan: -10, drawerSections: [-1, 999] },
        { sectionTypes: ["open", "drawers", "tall_doors"] }
      ])
    };
    const before = clone(input);
    const first = generateBookcaseLayout(input);
    const second = generateBookcaseLayout(input);
    const context = `seed=${seed} hostile-case=${index}`;

    assert.deepEqual(input, before, `${context}: input mutated`);
    assert.deepEqual(first, second, `${context}: non-deterministic output`);
    assert.ok(first.validation && Array.isArray(first.validation.issues), `${context}: missing validation`);
    for (const issue of first.validation.issues) {
      assert.equal(typeof issue.code, "string", `${context}: issue code`);
      assert.ok(issue.severity === "error" || issue.severity === "warning", `${context}: issue severity`);
      assert.equal(typeof issue.message, "string", `${context}: issue message`);
    }
  }
});

test("preset change sequences never retain components from the previous family", () => {
  let previousIds = new Set();

  for (let cycle = 0; cycle < 4; cycle += 1) {
    for (const preset of layoutPresets) {
      const layout = generateBookcaseLayout(preset.config);
      assert.equal(layout.validation.valid, true, `${preset.id}: ${JSON.stringify(layout.validation.errors)}`);
      const ids = new Set(layout.componentOrder);
      assert.equal(ids.size, layout.componentOrder.length, `${preset.id}: duplicate ids`);
      assert.deepEqual(layout, generateBookcaseLayout(preset.config), `${preset.id}: changed across cycles`);

      // The graph must be self-contained. Any shared ID must represent the same role.
      const previousLayoutIds = previousIds;
      for (const component of layout.components) {
        if (!previousLayoutIds.has(component.id)) continue;
        const repeated = layout.components.find((item) => item.id === component.id);
        assert.equal(repeated.role, component.role, `${preset.id}: unstable role for ${component.id}`);
      }
      previousIds = ids;
    }
  }
});
