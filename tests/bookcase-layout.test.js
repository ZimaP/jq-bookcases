import test from "node:test";
import assert from "node:assert/strict";

import {
  CONSTRUCTION_RULES,
  LIGHTING_WARMTH_OPTIONS,
  SHELF_THICKNESS_OPTIONS,
  boundsIntersect,
  containsBounds,
  findComponent,
  generateBookcaseLayout,
  normalizeLayoutConfig,
  validateBookcaseLayout
} from "../bookcase-layout.js";
import { defaultBookcaseConfig, layoutPresets } from "../bookcase-config.js";

const byRole = (layout, role) => layout.components.filter((component) => component.role === role);
const issueCodes = (validation) => validation.issues.map((item) => item.code);
const clone = (value) => JSON.parse(JSON.stringify(value));
const approximately = (actual, expected, epsilon = 1e-6) => {
  assert.ok(Math.abs(actual - expected) <= epsilon, String(actual) + " is not approximately " + String(expected));
};

test("default layout uses canonical inches and exact nominal outer dimensions", () => {
  const layout = generateBookcaseLayout();
  const root = findComponent(layout, "bookcase");

  assert.equal(layout.coordinateSystem.units, "inches");
  assert.deepEqual(layout.coordinateSystem.axes, { x: "width", y: "height", z: "depth" });
  assert.equal(layout.coordinateSystem.origin, "bottom-center-front");
  assert.deepEqual(root.bounds, {
    min: { x: -48, y: 0, z: 0 },
    max: { x: 48, y: 96, z: 15 }
  });
  assert.deepEqual(root.size, { x: 96, y: 96, z: 15 });
  assert.deepEqual(root.position, { x: 0, y: 48, z: 7.5 });
  assert.equal(layout.validation.valid, true);
});

test("interior dimensions derive from named construction rules", () => {
  const layout = generateBookcaseLayout();
  assert.equal(layout.metrics.interiorWidth, 96 - CONSTRUCTION_RULES.panelThickness * 2);
  assert.equal(
    layout.metrics.interiorClearHeight,
    96 - CONSTRUCTION_RULES.panelThickness - (layout.metrics.baseHeight + CONSTRUCTION_RULES.panelThickness)
  );
  assert.equal(layout.metrics.interiorClearDepth, 15 - CONSTRUCTION_RULES.backPanelThickness);
});

test("every descriptor has stable identity, hierarchy, bounds, size, and position", () => {
  const layout = generateBookcaseLayout();
  const ids = new Set();

  for (const component of layout.components) {
    for (const key of ["id", "role", "parentId", "hostId", "bounds", "size", "position"]) {
      assert.ok(key in component, component.id + " is missing " + key);
    }
    assert.equal(ids.has(component.id), false, component.id + " is duplicated");
    ids.add(component.id);
    assert.ok(component.size.x > 0);
    assert.ok(component.size.y > 0);
    assert.ok(component.size.z > 0);
    if (component.id !== "bookcase") assert.ok(ids.has(component.parentId) || layout.components.some((item) => item.id === component.parentId));
    if (component.hostId) assert.ok(layout.components.some((item) => item.id === component.hostId));
  }
  assert.deepEqual(layout.componentOrder, layout.components.map((component) => component.id));
});

test("section widths and divider thickness accumulate to the interior width", () => {
  const layout = generateBookcaseLayout();
  const sections = byRole(layout, "section");
  const dividers = byRole(layout, "divider");
  const accumulated = sections.reduce((total, section) => total + section.size.x, 0) +
    dividers.reduce((total, divider) => total + divider.size.x, 0);

  approximately(accumulated, layout.metrics.interiorWidth);
  assert.equal(sections.length, 4);
  assert.equal(dividers.length, 3);
  assert.deepEqual(layout.metrics.sectionClearWidths, sections.map((section) => section.size.x));
  assert.ok(layout.metrics.sectionClearWidths.every((width) => width === layout.metrics.sectionClearWidth));
  for (let index = 1; index < sections.length; index += 1) {
    approximately(
      sections[index].bounds.min.x - sections[index - 1].bounds.max.x,
      CONSTRUCTION_RULES.panelThickness
    );
  }
});

test("positive section ratios proportion clear widths and divider positions", () => {
  const layout = generateBookcaseLayout({
    width: 72,
    sections: 3,
    lowerCabinets: false,
    lighting: "no_lighting",
    layoutMetadata: { sectionRatios: [1, 2, 1] }
  });
  const sections = byRole(layout, "section");
  const dividers = byRole(layout, "divider");

  assert.deepEqual(layout.metrics.sectionClearWidths, [17.25, 34.5, 17.25]);
  assert.deepEqual(sections.map((section) => section.size.x), layout.metrics.sectionClearWidths);
  approximately(dividers[0].bounds.min.x, sections[0].bounds.max.x);
  approximately(dividers[0].bounds.max.x, sections[1].bounds.min.x);
  approximately(dividers[1].bounds.min.x, sections[1].bounds.max.x);
  approximately(dividers[1].bounds.max.x, sections[2].bounds.min.x);
  approximately(
    layout.metrics.sectionClearWidths.reduce((total, width) => total + width, 0) +
      CONSTRUCTION_RULES.panelThickness * (layout.config.sections - 1),
    layout.metrics.interiorWidth
  );
  assert.equal(layout.validation.valid, true, JSON.stringify(layout.validation.errors));
});

test("invalid or missing section ratios fall back to equal bays", () => {
  const baseConfig = { width: 72, sections: 3, lowerCabinets: false, lighting: "no_lighting" };
  const equalWidths = generateBookcaseLayout(baseConfig).metrics.sectionClearWidths;
  const invalidRatios = [
    [1, 2],
    [1, 0, 1],
    [1, -1, 1],
    [1, Number.POSITIVE_INFINITY, 1],
    [1, "2", 1]
  ];

  for (const sectionRatios of invalidRatios) {
    const layout = generateBookcaseLayout({
      ...baseConfig,
      layoutMetadata: { sectionRatios }
    });
    assert.deepEqual(layout.metrics.sectionClearWidths, equalWidths);
    assert.equal(layout.validation.valid, true, JSON.stringify({ sectionRatios, errors: layout.validation.errors }));
  }
});

test("positive ratios still surface minimum-clear-width validation", () => {
  const layout = generateBookcaseLayout({
    width: 96,
    sections: 4,
    lowerCabinets: false,
    lighting: "no_lighting",
    layoutMetadata: { sectionRatios: [0.1, 1, 1, 1] }
  });

  assert.ok(layout.metrics.sectionClearWidths[0] < CONSTRUCTION_RULES.minSectionClearWidth);
  assert.equal(layout.validation.valid, false);
  assert.ok(issueCodes(layout.validation).includes("MIN_SECTION_CLEAR_WIDTH"));
});

test("too many sections are auto-corrected to preserve minimum clear width", () => {
  const layout = generateBookcaseLayout({ width: 24, sections: 6, lowerCabinets: false });
  assert.equal(layout.config.sections, 1);
  assert.equal(byRole(layout, "section").length, 1);
  assert.ok(layout.metrics.sectionClearWidth >= CONSTRUCTION_RULES.minSectionClearWidth);
  assert.ok(layout.corrections.some((item) => item.code === "SECTION_COUNT_REDUCED"));
  assert.equal(layout.validation.valid, true);
});

test("section auto-correction can be disabled to surface actionable validation", () => {
  const layout = generateBookcaseLayout(
    { width: 24, sections: 6, lowerCabinets: false },
    { autoCorrectSections: false }
  );
  assert.equal(layout.config.sections, 6);
  assert.equal(layout.validation.valid, false);
  assert.ok(issueCodes(layout.validation).includes("MIN_SECTION_CLEAR_WIDTH"));
});

test("all supported shelf thicknesses flow into physical shelf descriptors", () => {
  for (const shelfThickness of SHELF_THICKNESS_OPTIONS) {
    const layout = generateBookcaseLayout({ shelfThickness, shelves: 4 });
    assert.equal(layout.config.shelfThickness, shelfThickness);
    assert.ok(byRole(layout, "shelf").length > 0);
    for (const shelf of byRole(layout, "shelf")) assert.equal(shelf.size.y, shelfThickness);
    assert.equal(layout.validation.valid, true);
  }
});

test("unsupported shelf thickness defaults explicitly", () => {
  const normalized = normalizeLayoutConfig({ shelfThickness: 1.1 });
  assert.equal(normalized.config.shelfThickness, 1.25);
  assert.ok(normalized.corrections.some((item) => item.code === "SHELF_THICKNESS_DEFAULTED"));
});

test("shelf count reduces when a short cabinet and thick shelves cannot maintain clearance", () => {
  const layout = generateBookcaseLayout({
    height: 72,
    shelves: 8,
    shelfThickness: 2,
    lowerCabinets: true
  });
  assert.ok(layout.config.shelves < 8);
  assert.ok(layout.corrections.some((item) => item.code === "SHELF_COUNT_REDUCED"));
  assert.equal(layout.validation.valid, true);
});

test("shelves stay inside their sections and preserve vertical clearance", () => {
  const layout = generateBookcaseLayout({ shelves: 6 });
  for (const shelf of byRole(layout, "shelf")) {
    const section = findComponent(layout, shelf.parentId);
    assert.equal(containsBounds(section.bounds, shelf.bounds), true);
  }

  for (const sectionId of layout.sectionIds) {
    const shelves = byRole(layout, "shelf")
      .filter((shelf) => shelf.parentId === sectionId)
      .sort((left, right) => left.bounds.min.y - right.bounds.min.y);
    for (let index = 1; index < shelves.length; index += 1) {
      const gap = shelves[index].bounds.min.y - shelves[index - 1].bounds.max.y;
      assert.ok(gap >= CONSTRUCTION_RULES.minShelfClearance - 1e-6);
    }
  }
});

test("default lower cabinet emits exactly eight hosted doors", () => {
  const layout = generateBookcaseLayout();
  const doors = byRole(layout, "door");
  assert.equal(doors.length, 8);
  assert.equal(layout.metrics.generatedDoorCount, 8);
  for (const door of doors) {
    const opening = findComponent(layout, door.hostId);
    assert.ok(opening);
    assert.equal(opening.role, "opening");
    assert.equal(door.parentId, opening.id);
    assert.equal(door.metadata.reveal, CONSTRUCTION_RULES.doorReveal);
  }
  assert.equal(layout.validation.valid, true);
});

test("double doors have equal slabs, consistent edge reveals, and the exact center gap", () => {
  const layout = generateBookcaseLayout();
  const opening = findComponent(layout, "section-01-lower-opening");
  const left = findComponent(layout, opening.id + "-door-left");
  const right = findComponent(layout, opening.id + "-door-right");

  approximately(left.size.x, right.size.x);
  approximately(left.bounds.min.x - opening.bounds.min.x, CONSTRUCTION_RULES.doorReveal);
  approximately(opening.bounds.max.x - right.bounds.max.x, CONSTRUCTION_RULES.doorReveal);
  approximately(left.bounds.min.y - opening.bounds.min.y, CONSTRUCTION_RULES.doorReveal);
  approximately(opening.bounds.max.y - left.bounds.max.y, CONSTRUCTION_RULES.doorReveal);
  approximately(right.bounds.min.x - left.bounds.max.x, CONSTRUCTION_RULES.doubleDoorCenterGap);
});

test("handles remain attached to and bounded by their parent faces", () => {
  const layout = generateBookcaseLayout({ hardware: "brass_pull" });
  const handles = byRole(layout, "handle");
  assert.equal(handles.length, 8);
  for (const handle of handles) {
    const face = findComponent(layout, handle.hostId);
    assert.equal(handle.parentId, face.id);
    assert.ok(handle.bounds.min.x >= face.bounds.min.x);
    assert.ok(handle.bounds.max.x <= face.bounds.max.x);
    assert.ok(handle.bounds.min.y >= face.bounds.min.y);
    assert.ok(handle.bounds.max.y <= face.bounds.max.y);
    approximately(handle.bounds.max.z, face.bounds.min.z);
  }
  assert.equal(layout.validation.valid, true);
});

test("push latch removes physical handle descriptors", () => {
  const layout = generateBookcaseLayout({ hardware: "push_latch" });
  assert.equal(byRole(layout, "handle").length, 0);
  assert.equal(layout.validation.valid, true);
});

test("drawer-oriented layouts create fitted stacks and hosted handles", () => {
  const layout = generateBookcaseLayout({
    layoutType: "lower_drawers",
    lowerStorage: "drawers",
    drawerCount: 3,
    hardware: "brass_pull"
  });
  const drawers = byRole(layout, "drawer_front");
  assert.equal(drawers.length, layout.config.sections * 3);
  assert.equal(byRole(layout, "door").length, 0);
  assert.equal(byRole(layout, "handle").length, drawers.length);

  for (const sectionId of layout.sectionIds) {
    const stack = drawers
      .filter((drawer) => drawer.parentId === sectionId + "-lower-opening")
      .sort((left, right) => left.bounds.min.y - right.bounds.min.y);
    assert.equal(stack.length, 3);
    for (let index = 1; index < stack.length; index += 1) {
      approximately(stack[index].bounds.min.y - stack[index - 1].bounds.max.y, CONSTRUCTION_RULES.drawerGap);
    }
  }
  assert.equal(layout.validation.valid, true);
});

test("preset metadata can assign drawers to selected sections only", () => {
  const layout = generateBookcaseLayout({
    layoutMetadata: { drawerSections: [1] },
    drawerCount: 4
  });
  assert.equal(byRole(layout, "drawer_front").length, 4);
  assert.equal(byRole(layout, "door").filter((door) => door.metadata.tier === "primary").length, 6);
  assert.equal(layout.validation.valid, true);
});

test("warm puck lights attach to the underside of the top panel", () => {
  const layout = generateBookcaseLayout({ lighting: "warm_pucks", lightingWarmth: 2700 });
  const lights = byRole(layout, "light");
  assert.equal(lights.length, layout.config.sections);
  for (const light of lights) {
    assert.equal(light.metadata.lightType, "puck");
    assert.equal(light.metadata.warmth, 2700);
    assert.equal(light.hostId, "top-panel");
    approximately(light.bounds.max.y, findComponent(layout, "top-panel").bounds.min.y);
  }
  assert.equal(layout.validation.valid, true);
});

test("shelf accent lights are hosted by the shelves they follow", () => {
  const layout = generateBookcaseLayout({ lighting: "shelf_accent" });
  const lights = byRole(layout, "light");
  const shelves = byRole(layout, "shelf");
  assert.equal(lights.length, shelves.length);
  for (const light of lights) {
    const shelf = findComponent(layout, light.hostId);
    assert.equal(shelf.role, "shelf");
    assert.equal(light.metadata.lightType, "shelf_led");
    approximately(light.bounds.max.y, shelf.bounds.min.y);
  }
  assert.equal(layout.validation.valid, true);
});

test("vertical LED strips attach to real side or divider panels", () => {
  const layout = generateBookcaseLayout({ lighting: "vertical_led" });
  const lights = byRole(layout, "light");
  assert.equal(lights.length, layout.config.sections * 2);
  for (const light of lights) {
    const host = findComponent(layout, light.hostId);
    assert.ok(["side_panel", "divider"].includes(host.role));
    assert.equal(light.metadata.lightType, "vertical_led");
  }
  assert.equal(layout.validation.valid, true);
});

test("full lighting package combines all host-attached lighting types and warmth", () => {
  const layout = generateBookcaseLayout({ lighting: "full_package", lightingWarmth: 3500 });
  const lights = byRole(layout, "light");
  const types = new Set(lights.map((light) => light.metadata.lightType));
  assert.deepEqual([...types].sort(), ["puck", "shelf_led", "vertical_led"]);
  assert.ok(lights.every((light) => light.metadata.warmth === 3500));
  assert.ok(lights.every((light) => findComponent(layout, light.hostId)));
  assert.equal(layout.validation.valid, true);
});

test("all supported warmth values are preserved and invalid warmth defaults", () => {
  for (const lightingWarmth of LIGHTING_WARMTH_OPTIONS) {
    const layout = generateBookcaseLayout({ lightingWarmth });
    assert.equal(layout.config.lightingWarmth, lightingWarmth);
  }
  const invalid = generateBookcaseLayout({ lightingWarmth: 4200 });
  assert.equal(invalid.config.lightingWarmth, 2700);
  assert.ok(invalid.corrections.some((item) => item.code === "LIGHTING_WARMTH_DEFAULTED"));
});

test("base and crown styles emit distinct renderer-facing descriptors", () => {
  const toe = generateBookcaseLayout({ baseStyle: "toe_kick", crownStyle: "none" });
  const plinth = generateBookcaseLayout({ baseStyle: "plinth", crownStyle: "slim_cap" });
  const furniture = generateBookcaseLayout({ baseStyle: "furniture_base", crownStyle: "classic_crown" });
  const soffit = generateBookcaseLayout({ crownStyle: "modern_soffit" });

  assert.ok(findComponent(toe, "base-toe-shadow"));
  assert.equal(byRole(toe, "crown").length, 0);
  assert.ok(findComponent(plinth, "base-plinth-cap"));
  assert.equal(byRole(plinth, "crown").length, 1);
  assert.equal(byRole(furniture, "trim").filter((item) => item.metadata.purpose === "foot").length, 2);
  assert.equal(byRole(furniture, "crown").length, 2);
  assert.equal(byRole(soffit, "crown").length, 1);
  assert.equal(toe.validation.valid && plinth.validation.valid && furniture.validation.valid && soffit.validation.valid, true);
});

test("all ten existing presets pass programmatic geometry validation", async (t) => {
  assert.equal(layoutPresets.length, 10);
  for (const preset of layoutPresets) {
    await t.test(preset.id, () => {
      const layout = generateBookcaseLayout({
        ...defaultBookcaseConfig,
        ...preset.config,
        layoutPreset: preset.id
      });
      assert.equal(layout.validation.valid, true, JSON.stringify(layout.validation.errors));
      assert.equal(byRole(layout, "section").length, layout.config.sections);
      assert.ok(layout.components.every((component) => component.id && component.role));
    });
  }
});

test("media, desk, glass, tall-storage, and asymmetric families use shared structured rules", () => {
  const media = generateBookcaseLayout({
    ...defaultBookcaseConfig,
    ...layoutPresets.find((preset) => preset.id === "media-wall").config
  });
  const desk = generateBookcaseLayout({
    ...defaultBookcaseConfig,
    ...layoutPresets.find((preset) => preset.id === "desk-niche").config
  });
  const glass = generateBookcaseLayout({
    ...defaultBookcaseConfig,
    ...layoutPresets.find((preset) => preset.id === "glass-library").config
  });
  const tall = generateBookcaseLayout({
    ...defaultBookcaseConfig,
    ...layoutPresets.find((preset) => preset.id === "tall-storage").config
  });
  const asymmetric = generateBookcaseLayout({
    ...defaultBookcaseConfig,
    ...layoutPresets.find((preset) => preset.id === "asymmetric-modern").config
  });

  assert.equal(findComponent(media, "feature-zone").metadata.kind, "media");
  assert.equal(findComponent(media, "feature-zone").metadata.memberSectionIds.length, 3);
  assert.ok(findComponent(desk, "desk-worktop"));
  assert.equal(byRole(glass, "door").filter((door) => door.id.includes("upper-glass-door")).length, glass.config.sections);
  assert.equal(byRole(tall, "door").filter((door) => door.id.includes("tall-door")).length, 2);
  const firstShelf = findComponent(asymmetric, "section-01-shelf-01");
  const secondShelf = findComponent(asymmetric, "section-02-shelf-01");
  assert.notEqual(firstShelf.position.y, secondShelf.position.y);
});

test("multi-bay media openings retain a lower support divider without crossing the opening", () => {
  const layout = generateBookcaseLayout({
    width: 120,
    sections: 4,
    lowerCabinets: true,
    centerOpening: true,
    layoutType: "media_wall",
    lighting: "no_lighting",
    layoutMetadata: { specialSpan: 2, sectionRatios: [1, 1.35, 1.35, 1] }
  });
  const support = findComponent(layout, "divider-02-lower-support");
  const opening = findComponent(layout, "feature-opening");
  const leftSection = findComponent(layout, "section-02");
  const rightSection = findComponent(layout, "section-03");

  assert.ok(support);
  assert.equal(support.role, "divider");
  assert.equal(support.metadata.partial, true);
  assert.equal(support.metadata.purpose, "lower_media_support");
  assert.equal(findComponent(layout, "divider-02"), null);
  approximately(support.bounds.min.x, leftSection.bounds.max.x);
  approximately(support.bounds.max.x, rightSection.bounds.min.x);
  approximately(support.bounds.min.y, findComponent(layout, "bottom-panel").bounds.max.y);
  approximately(support.bounds.max.y, opening.bounds.min.y);
  assert.equal(boundsIntersect(support.bounds, opening.bounds), false);
  assert.equal(leftSection.metadata.rightBoundaryId, support.id);
  assert.equal(rightSection.metadata.leftBoundaryId, support.id);
  assert.equal(layout.validation.valid, true, JSON.stringify(layout.validation.errors));
});

test("multi-bay desk openings remain clear of an internal support divider", () => {
  const layout = generateBookcaseLayout({
    width: 120,
    sections: 4,
    lowerCabinets: true,
    deskOpening: true,
    layoutType: "desk_niche",
    lighting: "no_lighting",
    layoutMetadata: { specialSpan: 2, sectionRatios: [1, 1.35, 1.35, 1] }
  });

  assert.equal(findComponent(layout, "divider-02"), null);
  assert.equal(findComponent(layout, "divider-02-lower-support"), null);
  assert.ok(findComponent(layout, "desk-worktop"));
  assert.equal(layout.validation.valid, true, JSON.stringify(layout.validation.errors));
});

test("minimum, maximum, narrow, wide, tall, shallow, and deep configurations are stable", () => {
  const scenarios = [
    { width: 24, height: 72, depth: 10, sections: 1, lowerCabinets: false },
    { width: 48, height: 72, depth: 10, sections: 2 },
    { width: 144, height: 96, depth: 15, sections: 6 },
    { width: 96, height: 120, depth: 15, sections: 4 },
    { width: 96, height: 96, depth: 10, sections: 4 },
    { width: 96, height: 96, depth: 24, sections: 4 },
    { width: 144, height: 120, depth: 24, sections: 6, shelves: 8 }
  ];
  for (const scenario of scenarios) {
    const layout = generateBookcaseLayout(scenario);
    assert.equal(layout.validation.valid, true, JSON.stringify({ scenario, errors: layout.validation.errors }));
    assert.equal(layout.metrics.overallWidth, scenario.width);
    assert.equal(layout.metrics.overallHeight, scenario.height);
    assert.equal(layout.metrics.overallDepth, scenario.depth);
  }
});

test("unsupported single-bay shelf spans are reported instead of silently rendered", () => {
  const layout = generateBookcaseLayout({
    width: 144,
    sections: 1,
    lowerCabinets: false,
    lighting: "no_lighting"
  });
  assert.equal(layout.validation.valid, false);
  assert.ok(issueCodes(layout.validation).includes("UNSUPPORTED_SHELF_SPAN"));
});

test("generation is deterministic and does not mutate input", () => {
  const input = {
    width: 108,
    sections: 4,
    shelfThickness: 1.5,
    layoutMetadata: { drawerSections: [2] }
  };
  const before = clone(input);
  const first = generateBookcaseLayout(input);
  const second = generateBookcaseLayout(input);
  assert.deepEqual(input, before);
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

test("serialized layouts restore and revalidate without scene state", () => {
  const original = generateBookcaseLayout({
    layoutType: "lower_drawers",
    lowerStorage: "drawers",
    lighting: "full_package"
  });
  const restored = JSON.parse(JSON.stringify(original));
  const validation = validateBookcaseLayout(restored);
  assert.equal(validation.valid, true);
  assert.deepEqual(restored.components, original.components);
});

test("configuration changes in sequence do not retain stale components", () => {
  const doorLayout = generateBookcaseLayout({ lowerCabinets: true, lowerStorage: "doors" });
  const openLayout = generateBookcaseLayout({ lowerCabinets: false, lighting: "no_lighting" });
  const drawerLayout = generateBookcaseLayout({ lowerCabinets: true, lowerStorage: "drawers" });
  const restoredDoorLayout = generateBookcaseLayout({ lowerCabinets: true, lowerStorage: "doors" });

  assert.equal(byRole(doorLayout, "door").length, 8);
  assert.equal(byRole(openLayout, "door").length, 0);
  assert.equal(byRole(openLayout, "drawer_front").length, 0);
  assert.ok(byRole(drawerLayout, "drawer_front").length > 0);
  assert.deepEqual(restoredDoorLayout, doorLayout);
});

test("removing a host component is detected as a floating attachment", () => {
  const layout = clone(generateBookcaseLayout({ lighting: "shelf_accent" }));
  const light = byRole(layout, "light")[0];
  layout.components = layout.components.filter((component) => component.id !== light.hostId);
  const validation = validateBookcaseLayout(layout);
  assert.equal(validation.valid, false);
  assert.ok(issueCodes(validation).includes("MISSING_HOST"));
});

test("moving a handle outside its door is detected", () => {
  const layout = clone(generateBookcaseLayout({ hardware: "brass_pull" }));
  const handle = byRole(layout, "handle")[0];
  handle.bounds.min.x += 100;
  handle.bounds.max.x += 100;
  handle.position.x += 100;
  const validation = validateBookcaseLayout(layout);
  assert.equal(validation.valid, false);
  assert.ok(issueCodes(validation).includes("HANDLE_OUTSIDE_FACE"));
});

test("moving a shelf outside its section is detected", () => {
  const layout = clone(generateBookcaseLayout());
  const shelf = byRole(layout, "shelf")[0];
  shelf.bounds.min.y += 100;
  shelf.bounds.max.y += 100;
  shelf.position.y += 100;
  const validation = validateBookcaseLayout(layout);
  assert.equal(validation.valid, false);
  assert.ok(issueCodes(validation).includes("OUTSIDE_PARENT_BOUNDS"));
});

test("coincident solid geometry is detected as a collision", () => {
  const layout = clone(generateBookcaseLayout());
  const shelves = byRole(layout, "shelf").filter((shelf) => shelf.parentId === "section-01");
  const probe = clone(shelves[0]);
  probe.id = "collision-probe";
  probe.metadata.ordinal = 99;
  layout.components.push(probe);
  const validation = validateBookcaseLayout(layout);
  assert.equal(boundsIntersect(probe.bounds, shelves[0].bounds), true);
  assert.equal(validation.valid, false);
  assert.ok(issueCodes(validation).includes("COMPONENT_COLLISION"));
});

test("duplicate ids and non-positive geometry are rejected", () => {
  const layout = clone(generateBookcaseLayout());
  const duplicate = clone(layout.components[1]);
  duplicate.size.x = 0;
  layout.components.push(duplicate);
  const validation = validateBookcaseLayout(layout);
  assert.equal(validation.valid, false);
  assert.ok(issueCodes(validation).includes("DUPLICATE_COMPONENT_ID"));
  assert.ok(issueCodes(validation).includes("NON_POSITIVE_SIZE"));
});

test("generated layouts contain no collisions, missing parents, or missing hosts", () => {
  const layout = generateBookcaseLayout({ lighting: "full_package" });
  const codes = issueCodes(layout.validation);
  assert.equal(codes.includes("COMPONENT_COLLISION"), false);
  assert.equal(codes.includes("MISSING_PARENT"), false);
  assert.equal(codes.includes("MISSING_HOST"), false);
  assert.equal(codes.includes("ATTACHMENT_MISMATCH"), false);
  assert.equal(layout.validation.valid, true);
});
