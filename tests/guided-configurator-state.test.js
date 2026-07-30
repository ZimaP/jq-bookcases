import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  BOOKCASE_INTEGRATED_PREVIEW_ASSETS,
  CATEGORY_DEFINITIONS,
  DETAIL_OPTIONS,
  FINISH_OPTIONS,
  PRODUCT_CHOICES,
  PRODUCT_INTEGRATED_PREVIEW_ASSETS,
  PUBLIC_BOOKCASE_STYLE_IDS,
  SHARED_ROOM_LAYOUTS,
  getCompatibleDetails,
  getLayout,
  getMeasurementDiagramSpec,
  getMeasurementFields,
  resolvePreviewAsset,
  resolvePreviewPresentation
} from "../guided-configurator-data.js";
import {
  GUIDED_DRAFT_STORAGE_KEY,
  GUIDED_PROJECTS_STORAGE_KEY,
  buildProjectSummary,
  createProject,
  createProjectStore,
  formatInches,
  normalizeProject,
  parseInches,
  prepareMeasurementsForLayout,
  validateMeasurements
} from "../guided-configurator-state.js";

class MemoryStorage {
  #records = new Map();

  getItem(key) {
    return this.#records.has(key) ? this.#records.get(key) : null;
  }

  setItem(key, value) {
    this.#records.set(key, String(value));
  }

  removeItem(key) {
    this.#records.delete(key);
  }
}

class ToggleStorage extends MemoryStorage {
  blocked = false;

  setItem(key, value) {
    if (this.blocked) throw new DOMException("Storage blocked", "QuotaExceededError");
    super.setItem(key, value);
  }
}

const categoryById = (id) => CATEGORY_DEFINITIONS.find((category) => category.id === id);

function assertNormalizedEnvelope(envelope, previewKey) {
  assert.ok(envelope, `${previewKey} is missing its installation envelope`);
  for (const key of ["x", "y", "width", "height"]) {
    assert.equal(
      Number.isFinite(envelope[key]),
      true,
      `${previewKey} installation envelope ${key} must be finite`
    );
    assert.ok(
      envelope[key] >= 0 && envelope[key] <= 1,
      `${previewKey} installation envelope ${key} must be normalized`
    );
  }
  assert.ok(envelope.width > 0, `${previewKey} installation envelope must have width`);
  assert.ok(envelope.height > 0, `${previewKey} installation envelope must have height`);
  assert.ok(envelope.x + envelope.width <= 1, `${previewKey} installation envelope exceeds room width`);
  assert.ok(envelope.y + envelope.height <= 1, `${previewKey} installation envelope exceeds room height`);
  assert.ok(
    envelope.width * envelope.height <= 0.76,
    `${previewKey} installation envelope is too broad to preserve the selected room`
  );
  assert.ok(
    Math.min(
      envelope.x,
      envelope.y,
      1 - envelope.x - envelope.width,
      1 - envelope.y - envelope.height
    ) >= 0.039,
    `${previewKey} installation envelope must leave the canonical room visible on every edge`
  );
}

test("all five customer categories use the same ten room conditions", () => {
  assert.deepEqual(
    CATEGORY_DEFINITIONS.map((category) => category.id),
    ["bookcase", "tv-unit", "floating-storage", "window-storage", "radiator-cover"]
  );
  assert.deepEqual(
    SHARED_ROOM_LAYOUTS.map((layout) => layout.label),
    ["Niche Layout", "Left Niche", "Right Niche", "Clear Wall", "Fireplace Wall", "Center Projection", "Window Wall", "Door Wall", "Corner Wall", "Between Openings"]
  );
  assert.equal(new Set(SHARED_ROOM_LAYOUTS.map((layout) => layout.id)).size, 10);
  assert.ok(SHARED_ROOM_LAYOUTS.every((layout) => layout.previewAsset.endsWith(".png")));
  const standaloneRoomAssets = new Map([
    ["niche-layout", "room-niche-layout-v1.png"],
    ["left-niche", "room-left-niche-v1.png"],
    ["right-niche", "room-right-niche-v1.png"],
    ["fireplace-wall", "room-fireplace-wall-v1.png"]
  ]);
  for (const [layoutId, assetName] of standaloneRoomAssets) {
    const roomLayout = SHARED_ROOM_LAYOUTS.find((layout) => layout.id === layoutId);
    assert.equal(roomLayout.previewMode, "image");
    assert.ok(roomLayout.previewAsset.endsWith(assetName));
  }
  assert.equal(
    new Set([...standaloneRoomAssets.keys()].map((layoutId) => (
      SHARED_ROOM_LAYOUTS.find((layout) => layout.id === layoutId).previewAsset
    ))).size,
    standaloneRoomAssets.size
  );
  for (const category of CATEGORY_DEFINITIONS) {
    assert.equal(category.layouts, SHARED_ROOM_LAYOUTS);
    assert.deepEqual(category.layouts.map((layout) => layout.id), SHARED_ROOM_LAYOUTS.map((layout) => layout.id));
    assert.equal(getLayout(category.id, "window-wall")?.label, "Window Wall");
  }
});

test("measurement schemas are derived from category and layout conditions", () => {
  const windowFields = getMeasurementFields("bookcase", "window-wall").map((field) => field.id);
  const doorFields = getMeasurementFields("bookcase", "door-wall").map((field) => field.id);
  const fireplaceFields = getMeasurementFields("bookcase", "fireplace-wall").map((field) => field.id);
  const tvFields = getMeasurementFields("tv-unit", "clear-wall").map((field) => field.id);
  const radiatorFields = getMeasurementFields("radiator-cover", "clear-wall").map((field) => field.id);

  assert.deepEqual(windowFields.slice(0, 3), ["wallWidth", "ceilingHeight", "desiredDepth"]);
  assert.ok(windowFields.includes("windowWidth"));
  assert.ok(windowFields.includes("radiatorBelowWindow"));
  assert.ok(!windowFields.includes("doorSwing"));
  assert.ok(doorFields.includes("doorWidth"));
  assert.ok(doorFields.includes("doorSwing"));
  assert.ok(fireplaceFields.includes("mantelHeight"));
  assert.ok(fireplaceFields.includes("tvAboveFireplace"));
  assert.ok(tvFields.includes("tvScreenSize"));
  assert.ok(tvFields.includes("outletLocation"));
  assert.ok(radiatorFields.includes("radiatorDepth"));
  assert.ok(radiatorFields.includes("valveLocation"));
});

test("all ten bookcase room diagrams expose ordered architectural dimension geometry", () => {
  const expectedDimensions = new Map([
    ["niche-layout", [
      ["wallWidth", "A"],
      ["ceilingHeight", "B"],
      ["desiredDepth", "C"],
      ["nicheWidth", "D"],
      ["nicheHeight", "E"],
      ["nicheDepth", "F"]
    ]],
    ["left-niche", [
      ["wallWidth", "A"],
      ["ceilingHeight", "B"],
      ["desiredDepth", "C"],
      ["nicheWidth", "D"],
      ["nicheHeight", "E"],
      ["nicheDepth", "F"]
    ]],
    ["right-niche", [
      ["wallWidth", "A"],
      ["ceilingHeight", "B"],
      ["desiredDepth", "C"],
      ["nicheWidth", "D"],
      ["nicheHeight", "E"],
      ["nicheDepth", "F"]
    ]],
    ["clear-wall", [
      ["wallWidth", "A"],
      ["ceilingHeight", "B"],
      ["desiredDepth", "C"]
    ]],
    ["fireplace-wall", [
      ["wallWidth", "A"],
      ["ceilingHeight", "B"],
      ["desiredDepth", "C"],
      ["fireplaceWidth", "D"],
      ["fireplaceHeight", "E"],
      ["mantelWidth", "F"]
    ]],
    ["center-recess", [
      ["wallWidth", "A"],
      ["ceilingHeight", "B"],
      ["desiredDepth", "C"],
      ["nicheWidth", "D"],
      ["nicheHeight", "E"],
      ["nicheDepth", "F"]
    ]],
    ["window-wall", [
      ["wallWidth", "A"],
      ["ceilingHeight", "B"],
      ["desiredDepth", "C"],
      ["windowWidth", "D"],
      ["windowHeight", "E"],
      ["sillHeight", "F"]
    ]],
    ["door-wall", [
      ["wallWidth", "A"],
      ["ceilingHeight", "B"],
      ["desiredDepth", "C"],
      ["doorWidth", "D"],
      ["doorHeight", "E"],
      ["doorLeftDistance", "F"]
    ]],
    ["corner-wall", [
      ["wallWidth", "A"],
      ["ceilingHeight", "B"],
      ["desiredDepth", "C"],
      ["cornerReturn", "D"]
    ]],
    ["double-opening", [
      ["wallWidth", "A"],
      ["ceilingHeight", "B"],
      ["desiredDepth", "C"],
      ["openingLeftDistance", "D"],
      ["openingRightDistance", "E"]
    ]]
  ]);
  const validAxes = new Set(["horizontal", "vertical", "depth", "diagonal"]);

  for (const roomLayout of SHARED_ROOM_LAYOUTS) {
    const spec = getMeasurementDiagramSpec("bookcase", roomLayout.id);
    const fieldsById = new Map(
      getMeasurementFields("bookcase", roomLayout.id).map((field) => [field.id, field])
    );
    const actualDimensions = spec.spans.map((span) => [
      span.fieldId,
      fieldsById.get(span.fieldId)?.code
    ]);
    const context = `${roomLayout.label} measurement diagram`;

    assert.equal(spec.layoutId, roomLayout.id, `${context} keeps the selected layout`);
    assert.ok(Number.isFinite(spec.width) && spec.width > 0, `${context} has a finite width`);
    assert.ok(Number.isFinite(spec.height) && spec.height > 0, `${context} has a finite height`);
    assert.deepEqual(actualDimensions, expectedDimensions.get(roomLayout.id), `${context} fields and codes`);
    assert.equal(new Set(spec.spans.map((span) => span.fieldId)).size, spec.spans.length, `${context} field IDs are unique`);
    assert.equal(new Set(actualDimensions.map(([, code]) => code)).size, spec.spans.length, `${context} codes are unique`);

    for (const span of spec.spans) {
      const coordinates = [
        ...span.line,
        ...span.extensions.flat(),
        span.label.x,
        span.label.y
      ];
      assert.ok(validAxes.has(span.axis), `${context} ${span.fieldId} uses a supported axis`);
      assert.equal(span.line.length, 4, `${context} ${span.fieldId} has two line endpoints`);
      assert.equal(span.extensions.length, 2, `${context} ${span.fieldId} has two witness lines`);
      assert.ok(span.extensions.every((extension) => extension.length === 4), `${context} ${span.fieldId} witness endpoints`);
      assert.ok(coordinates.every(Number.isFinite), `${context} ${span.fieldId} coordinates are finite`);
      assert.notDeepEqual(span.line.slice(0, 2), span.line.slice(2), `${context} ${span.fieldId} line has length`);

      for (const [index, coordinate] of coordinates.entries()) {
        const limit = index % 2 === 0 ? spec.width : spec.height;
        assert.ok(
          coordinate >= 0 && coordinate <= limit,
          `${context} ${span.fieldId} coordinate ${coordinate} is inside the normalized drawing`
        );
      }
    }
  }
});

test("room diagrams use native image ratios and Door Wall dimensions anchor to real architectural edges", () => {
  const expectedViewBoxes = new Map([
    ["niche-layout", [627, 627]],
    ["left-niche", [627, 627]],
    ["right-niche", [627, 627]],
    ["clear-wall", [1536, 1024]],
    ["fireplace-wall", [627, 627]],
    ["center-recess", [1536, 1024]],
    ["window-wall", [1536, 1024]],
    ["door-wall", [1536, 1024]],
    ["corner-wall", [1536, 1024]],
    ["double-opening", [1536, 1024]]
  ]);

  for (const [layoutId, expectedViewBox] of expectedViewBoxes) {
    const spec = getMeasurementDiagramSpec("bookcase", layoutId);
    assert.deepEqual([spec.width, spec.height], expectedViewBox, `${layoutId} native image viewBox`);
  }

  const doorSpec = getMeasurementDiagramSpec("bookcase", "door-wall");
  const doorSpans = new Map(doorSpec.spans.map((span) => [span.fieldId, span]));
  assert.deepEqual(doorSpans.get("wallWidth").line, [240, 178, 1295, 178]);
  assert.deepEqual(doorSpans.get("wallWidth").extensions, [
    [240, 157, 240, 204],
    [1295, 157, 1295, 204]
  ]);
  assert.deepEqual(doorSpans.get("ceilingHeight").line, [270, 157, 270, 758]);
  assert.deepEqual(doorSpans.get("desiredDepth").line, [1295, 758, 1452, 840]);
  assert.equal(doorSpans.get("desiredDepth").endStyle, "tick");
  assert.equal(doorSpans.get("desiredDepth").extensionRole, "tick");
  assert.deepEqual(doorSpans.get("doorWidth").line, [659, 232, 880, 232]);
  assert.deepEqual(doorSpans.get("doorWidth").extensions, [
    [659, 208, 659, 279],
    [880, 208, 880, 279]
  ]);
  assert.deepEqual(doorSpans.get("doorHeight").line, [940, 279, 940, 758]);
  assert.deepEqual(doorSpans.get("doorHeight").extensions, [
    [880, 279, 960, 279],
    [880, 758, 960, 758]
  ]);
  assert.deepEqual(doorSpans.get("doorLeftDistance").line, [240, 638, 639, 638]);
  assert.ok(!doorSpans.has("doorTrimWidth"), "trim remains a small local field, not a long wall dimension");
  assert.ok(!doorSpans.has("doorSwing"), "door swing remains directional data, not a linear dimension");

  const doubleOpeningSpec = getMeasurementDiagramSpec("tv-unit", "double-opening");
  const doubleOpeningSpans = new Map(
    doubleOpeningSpec.spans.map((span) => [span.fieldId, span])
  );
  assert.deepEqual(doubleOpeningSpans.get("wallWidth").line, [304, 244, 1230, 244]);
  assert.deepEqual(doubleOpeningSpans.get("ceilingHeight").line, [330, 150, 330, 785]);
  assert.deepEqual(doubleOpeningSpans.get("desiredDepth").line, [1230, 785, 1310, 828]);
  assert.deepEqual(doubleOpeningSpans.get("openingLeftDistance").line, [304, 690, 520, 690]);
  assert.deepEqual(doubleOpeningSpans.get("openingRightDistance").line, [1016, 690, 1230, 690]);

  const [depthX1, depthY1, depthX2, depthY2] = doorSpans.get("desiredDepth").line;
  assert.ok(
    Math.abs(((depthY2 - depthY1) / (depthX2 - depthX1)) - (82 / 157)) < 0.000001,
    "built-in depth follows the right wall-floor perspective"
  );
});

test("inch parsing accepts decimals, mixed fractions, hyphenated fractions, and unicode fractions", () => {
  assert.equal(parseInches(42.5), 42.5);
  assert.equal(parseInches("42.5 in"), 42.5);
  assert.equal(parseInches("42 1/2"), 42.5);
  assert.equal(parseInches("42-1/2"), 42.5);
  assert.equal(parseInches("7/8"), 0.875);
  assert.equal(parseInches("42½"), 42.5);
  assert.equal(parseInches(""), null);
  assert.equal(parseInches("-2"), null);
  assert.equal(parseInches("twelve"), null);
  assert.equal(formatInches(42.5), "42 1/2");
  assert.equal(formatInches(0.875), "7/8");
  assert.equal(formatInches(42.5, { decimal: true }), "42.5");
});

test("niche layout selection derives distinct left, centered, and right returns from the room envelope", () => {
  const project = createProject();
  project.measurements = {
    wallWidth: 120,
    ceilingHeight: 96,
    desiredDepth: 14,
    nicheWidth: 96
  };

  assert.deepEqual(
    pickReturns(prepareMeasurementsForLayout(project, "left-niche")),
    { leftReturn: 0, rightReturn: 24 }
  );
  assert.deepEqual(
    pickReturns(prepareMeasurementsForLayout(project, "niche-layout")),
    { leftReturn: 12, rightReturn: 12 }
  );
  assert.deepEqual(
    pickReturns(prepareMeasurementsForLayout(project, "right-niche")),
    { leftReturn: 24, rightReturn: 0 }
  );

  function pickReturns(measurements) {
    return {
      leftReturn: measurements.leftReturn,
      rightReturn: measurements.rightReturn
    };
  }
});

test("core measurements are required while unusual values remain non-blocking warnings", () => {
  const incomplete = createProject({ now: 1, random: 0.1 });
  assert.equal(incomplete.productSelected, false);
  assert.equal(incomplete.currentStep, 1);
  let result = validateMeasurements(incomplete);
  assert.equal(result.valid, false);
  assert.equal(result.errors[0].field, "layout");

  const warningProject = normalizeProject({
    ...incomplete,
    layout: "clear-wall",
    measurements: {
      wallWidth: 200,
      ceilingHeight: 60,
      desiredDepth: 30
    }
  }, { now: 2 });
  result = validateMeasurements(warningProject);
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.warnings.length, 3);
  assert.ok(result.warnings.every((warning) => warning.message.includes("You can continue")));

  warningProject.measurements.wallWidth = null;
  result = validateMeasurements(warningProject);
  assert.equal(result.valid, false);
  assert.match(result.errors[0].message, /approximate wall width/i);
});

test("five-step state and legacy category layouts migrate without losing a project", () => {
  const modern = normalizeProject({
    ...createProject({ now: 4, random: 0.12, productSelected: true }),
    currentStep: 5,
    maxVisitedStep: 5,
    layout: "clear-wall"
  }, { now: 5 });
  assert.equal(modern.currentStep, 5);
  assert.equal(modern.maxVisitedStep, 5);
  assert.equal(modern.productSelected, true);

  const legacy = normalizeProject({
    schemaVersion: 1,
    projectId: "JQ-LEGACY-0001",
    projectName: "Legacy media wall",
    category: "tv-unit",
    layout: "clear-tv-wall",
    currentStep: 4,
    maxVisitedStep: 4,
    measurements: {
      wallWidth: 120,
      ceilingHeight: 96,
      desiredDepth: 14
    }
  }, { now: 6 });
  assert.equal(legacy.productSelected, true);
  assert.equal(legacy.layout, "clear-wall");
  assert.equal(legacy.currentStep, 5);
  assert.equal(legacy.maxVisitedStep, 5);
});

test("normalization removes incompatible detail choices without disturbing project identity", () => {
  const project = normalizeProject({
    ...createProject({ now: 10, random: 0.2 }),
    layout: "clear-wall",
    style: "full-open-shelving",
    hardware: "black-pull",
    doorStyle: "glass",
    lighting: "integrated-led"
  }, { now: 11 });
  const compatible = getCompatibleDetails(project.category, project.style);

  assert.equal(project.style, "full-open-shelving");
  assert.equal(project.hardware, null);
  assert.equal(project.doorStyle, null);
  assert.equal(project.lighting, "integrated-led");
  assert.equal(compatible.hardware.length, 0);
  assert.equal(compatible.doorStyle.length, 0);
  assert.equal(project.projectId, "JQ-0000A-7777");
});

test("project summaries reflect normalized measurements and curated selections", () => {
  const project = normalizeProject({
    ...createProject({ now: 20, random: 0.3 }),
    category: "bookcase",
    layout: "window-wall",
    measurements: {
      wallWidth: "121 1/2",
      ceilingHeight: 96,
      desiredDepth: 14,
      windowWidth: 48,
      windowHeight: 42,
      sillHeight: 30,
      windowLeftDistance: 30,
      windowRightDistance: 43.5,
      radiatorBelowWindow: "yes"
    },
    style: "cabinet-base-shelves",
    finish: "charcoal",
    accentFinish: "ink-blue",
    hardware: "brass-pull",
    lighting: "warm-led",
    notes: "Preserve the existing crown."
  }, { now: 21 });
  const summary = Object.fromEntries(buildProjectSummary(project).map((row) => [row.key, row.value]));

  assert.equal(summary.layout, "Window Wall");
  assert.equal(summary.wallWidth, "121 1/2 in");
  assert.equal(summary.windowRightDistance, "43 1/2 in");
  assert.equal(summary.radiatorBelowWindow, "Yes");
  assert.equal(summary.product, "Cabinets + Shelves");
  assert.equal(summary.category, "Bookcase");
  assert.equal(summary.finish, "Charcoal");
  assert.equal(summary.accentFinish, "Ink Blue");
  assert.equal(summary.hardware, "Brass Pull");
  assert.equal(summary.notes, "Preserve the existing crown.");

  const summarySteps = Object.fromEntries(buildProjectSummary(project).map((row) => [row.key, row.step]));
  assert.equal(summarySteps.product, 1);
  assert.equal(summarySteps.category, 1);
  assert.equal(summarySteps.layout, 2);
  assert.equal(summarySteps.wallWidth, 3);
  assert.equal(summarySteps.notes, 5);
});

test("every public Bookcase construction maps to the selected room scene", async () => {
  const bookcaseStyles = categoryById("bookcase").styles;
  assert.deepEqual(
    bookcaseStyles.map((style) => style.id),
    ["cabinet-base-shelves", "drawer-base-shelves", "tv-wall-cabinets", "full-open-shelving"]
  );
  assert.ok(bookcaseStyles.every((style) => style.drawingRef));
  assert.ok(bookcaseStyles.every((style) => style.previewAsset.startsWith("assets/photos/configurator/concept-")));
  assert.deepEqual(
    PUBLIC_BOOKCASE_STYLE_IDS,
    ["cabinet-base-shelves", "drawer-base-shelves", "full-open-shelving"]
  );

  const resolvedAssets = new Set();
  for (const layout of SHARED_ROOM_LAYOUTS) {
    const layoutAssets = BOOKCASE_INTEGRATED_PREVIEW_ASSETS[layout.id];
    assert.ok(layoutAssets, `missing Bookcase preview matrix row for ${layout.id}`);
    assert.deepEqual(Object.keys(layoutAssets).sort(), [...PUBLIC_BOOKCASE_STYLE_IDS].sort());

    for (const styleId of PUBLIC_BOOKCASE_STYLE_IDS) {
      const expectedAsset = layoutAssets[styleId];
      const presentation = resolvePreviewPresentation("bookcase", styleId, layout.id);
      const previewKey = `bookcase:${styleId}:${layout.id}`;

      assert.equal(resolvePreviewAsset("bookcase", styleId, layout.id), expectedAsset);
      assert.equal(presentation.previewKey, previewKey);
      assert.equal(presentation.categoryId, "bookcase");
      assert.equal(presentation.styleId, styleId);
      assert.equal(presentation.layoutId, layout.id);
      assert.equal(presentation.integratedLayoutId, layout.id);
      assert.equal(presentation.renderMode, "layered");
      assert.equal(presentation.roomAsset, layout.previewAsset);
      assert.equal(presentation.productAsset, expectedAsset);
      assert.equal(presentation.conceptAsset, expectedAsset);
      assert.notEqual(presentation.productAsset, presentation.roomAsset);
      assertNormalizedEnvelope(presentation.installationEnvelope, previewKey);

      const png = await readFile(new URL(`../${expectedAsset}`, import.meta.url));
      const avif = await readFile(new URL(`../${expectedAsset.replace(/\.png$/, ".avif")}`, import.meta.url));
      assert.ok(png.byteLength > 10_000, `${previewKey} PNG is empty`);
      assert.ok(avif.byteLength > 10_000, `${previewKey} AVIF is empty`);
      if (expectedAsset.includes("/integrated/")) {
        const finishMask = await readFile(
          new URL(`../${expectedAsset.replace(/-v1\.png$/, "-finish-mask-v1.png")}`, import.meta.url)
        );
        assert.ok(finishMask.byteLength > 1_000, `${previewKey} finish mask is empty`);
      }
      resolvedAssets.add(expectedAsset);
    }
  }

  assert.equal(resolvedAssets.size, PUBLIC_BOOKCASE_STYLE_IDS.length * SHARED_ROOM_LAYOUTS.length);

  const legacyMediaPreview = resolvePreviewPresentation("bookcase", "tv-wall-cabinets", "door-wall");
  assert.equal(legacyMediaPreview.renderMode, "missing-integrated-scene");
  assert.equal(legacyMediaPreview.integratedLayoutId, null);
  assert.equal(
    legacyMediaPreview.conceptAsset,
    "assets/photos/configurator/room-layouts/room-door-wall-v1.png"
  );
});

test("the seven product cards resolve to seventy exact product and room scenes", async () => {
  assert.deepEqual(
    PRODUCT_CHOICES.map(({ id, label, categoryId, styleId }) => ({ id, label, categoryId, styleId })),
    [
      { id: "cabinet-shelves", label: "Cabinets + Shelves", categoryId: "bookcase", styleId: "cabinet-base-shelves" },
      { id: "drawer-shelves", label: "Drawers + Shelves", categoryId: "bookcase", styleId: "drawer-base-shelves" },
      { id: "open-shelving", label: "Full Open Shelving", categoryId: "bookcase", styleId: "full-open-shelving" },
      { id: "tv-unit", label: "TV Unit", categoryId: "tv-unit", styleId: "framed-tv-wall" },
      { id: "floating-storage", label: "Floating Storage", categoryId: "floating-storage", styleId: "floating-drawer-bank" },
      { id: "window-storage", label: "Window Storage", categoryId: "window-storage", styleId: "window-seat-storage" },
      { id: "radiator-cover", label: "Radiator Cover", categoryId: "radiator-cover", styleId: "clean-slat-cover" }
    ]
  );

  assert.equal(new Set(PRODUCT_CHOICES.map((choice) => choice.id)).size, 7);
  const exactAssets = new Set();
  let resolvedSceneCount = 0;

  for (const choice of PRODUCT_CHOICES) {
    const productMatrix = PRODUCT_INTEGRATED_PREVIEW_ASSETS[choice.id];
    assert.ok(productMatrix, `missing preview matrix for ${choice.id}`);
    assert.deepEqual(
      Object.keys(productMatrix).sort(),
      SHARED_ROOM_LAYOUTS.map((layout) => layout.id).sort()
    );

    for (const layout of SHARED_ROOM_LAYOUTS) {
      const previewKey = `${choice.categoryId}:${choice.styleId}:${layout.id}`;
      const expectedAsset = productMatrix[layout.id];
      const presentation = resolvePreviewPresentation(choice.categoryId, choice.styleId, layout.id);

      assert.equal(presentation.previewKey, previewKey);
      assert.equal(presentation.categoryId, choice.categoryId);
      assert.equal(presentation.styleId, choice.styleId);
      assert.equal(presentation.layoutId, layout.id);
      assert.equal(presentation.integratedLayoutId, layout.id);
      assert.equal(presentation.renderMode, "layered");
      assert.equal(presentation.roomAsset, layout.previewAsset);
      assert.equal(presentation.productAsset, expectedAsset);
      assert.equal(presentation.conceptAsset, expectedAsset);
      assert.notEqual(presentation.productAsset, presentation.roomAsset);
      assertNormalizedEnvelope(presentation.installationEnvelope, previewKey);

      const png = await readFile(new URL(`../${expectedAsset}`, import.meta.url));
      const avif = await readFile(new URL(`../${expectedAsset.replace(/\.png$/, ".avif")}`, import.meta.url));
      assert.ok(png.byteLength > 10_000, `${previewKey} PNG is empty`);
      assert.ok(avif.byteLength > 10_000, `${previewKey} AVIF is empty`);

      if (expectedAsset.includes("/integrated/")) {
        const maskAsset = expectedAsset.replace(/-v1\.png$/, "-finish-mask-v1.png");
        const finishMask = await readFile(new URL(`../${maskAsset}`, import.meta.url));
        assert.ok(finishMask.byteLength > 1_000, `${previewKey} finish mask is empty`);
      }

      exactAssets.add(expectedAsset);
      resolvedSceneCount += 1;
    }
  }

  assert.equal(resolvedSceneCount, PRODUCT_CHOICES.length * SHARED_ROOM_LAYOUTS.length);
  // Cabinets + Shelves and Window Storage intentionally share the same approved
  // cabinetry-around-a-window scene for Window Wall; every other asset is unique.
  assert.equal(exactAssets.size, 69);
});

test("preview presentations preserve the canonical room as a separate layer for all seventy selections", () => {
  for (const choice of PRODUCT_CHOICES) {
    for (const layout of SHARED_ROOM_LAYOUTS) {
      const presentation = resolvePreviewPresentation(choice.categoryId, choice.styleId, layout.id);
      assert.equal(presentation.layoutId, layout.id);
      assert.equal(presentation.integratedLayoutId, layout.id);
      assert.equal(presentation.layoutLabel, layout.label);
      assert.equal(presentation.roomAsset, layout.previewAsset);
      assert.equal(presentation.layoutContextAsset, layout.previewAsset);
      assert.equal(
        presentation.productAsset,
        PRODUCT_INTEGRATED_PREVIEW_ASSETS[choice.id][layout.id]
      );
      assert.notEqual(presentation.productAsset, presentation.roomAsset);
      assert.equal(presentation.layoutPreviewMode, layout.previewMode);
      assert.equal(presentation.layoutPreviewPosition, layout.previewPosition);
      assert.equal(presentation.renderMode, "layered");
      assertNormalizedEnvelope(presentation.installationEnvelope, presentation.previewKey);
    }
  }

  const betweenOpenings = resolvePreviewPresentation("tv-unit", "framed-tv-wall", "double-opening");
  assert.equal(betweenOpenings.layoutId, "double-opening");
  assert.equal(betweenOpenings.layoutLabel, "Between Openings");
  assert.equal(
    betweenOpenings.roomAsset,
    "assets/photos/configurator/room-layouts/room-double-opening-v1.png"
  );
  assert.equal(
    betweenOpenings.productAsset,
    "assets/photos/configurator/integrated/tv-unit/framed-tv-wall/double-opening-v2.png"
  );
  assert.equal(betweenOpenings.conceptAsset, betweenOpenings.productAsset);
  assert.equal(betweenOpenings.installationEnvelopeId, "tv-unit-double-opening-v2-cabinet");
  assert.deepEqual(
    betweenOpenings.installationEnvelope,
    { x: 0.267, y: 0.195, width: 0.466, height: 0.61 }
  );
  assert.equal(betweenOpenings.renderMode, "layered");
  assert.notEqual(
    betweenOpenings.productAsset,
    betweenOpenings.roomAsset
  );

  const normalized = normalizeProject({
    ...createProject({ now: 24, random: 0.24 }),
    productSelected: true,
    category: "tv-unit",
    layout: "between-openings",
    style: "framed-tv-wall",
    finish: "charcoal"
  }, { now: 25 });
  assert.equal(normalized.layout, "double-opening");
  assert.equal(normalized.previewAsset, betweenOpenings.productAsset);
});

test("legacy hidden Bookcase styles migrate without inventing an integrated room scene", () => {
  const migrated = normalizeProject({
    ...createProject({ now: 30, random: 0.31 }),
    layout: "clear-wall",
    style: "display-shelving"
  }, { now: 31 });
  assert.equal(migrated.style, "tv-wall-cabinets");
  assert.equal(migrated.previewAsset, "assets/photos/configurator/room-layouts/room-clear-wall-v1.png");
  assert.equal(
    resolvePreviewPresentation("bookcase", migrated.style, migrated.layout).renderMode,
    "missing-integrated-scene"
  );
});

test("project store supports drafts, multiple saves, rename, duplicate, resume, and delete", () => {
  const storage = new MemoryStorage();
  const projects = createProjectStore(storage);
  const original = normalizeProject({
    ...createProject({ now: 100, random: 0.1 }),
    layout: "clear-wall",
    projectName: "Library"
  }, { now: 101 });

  assert.equal(projects.saveDraft(original), true);
  assert.equal(projects.loadDraft().projectName, "Library");
  assert.ok(storage.getItem(GUIDED_DRAFT_STORAGE_KEY));

  projects.saveProject(original);
  assert.equal(projects.listProjects().length, 1);
  assert.equal(projects.getProject(original.projectId).status, "saved");

  const renamed = projects.renameProject(original.projectId, "Front Library");
  assert.equal(renamed.projectName, "Front Library");

  const duplicate = projects.duplicateProject(original.projectId, { now: 200, random: 0.2 });
  assert.notEqual(duplicate.projectId, original.projectId);
  assert.equal(duplicate.projectName, "Front Library Copy");
  assert.equal(projects.listProjects().length, 2);
  assert.ok(storage.getItem(GUIDED_PROJECTS_STORAGE_KEY));

  assert.equal(projects.deleteProject(original.projectId), true);
  assert.equal(projects.listProjects().length, 1);
  assert.equal(projects.deleteProject("missing"), false);
  assert.equal(projects.clearDraft(), true);
  assert.equal(projects.loadDraft(), null);
});

test("catalog provides the complete curated finish and detail collections", () => {
  assert.deepEqual(FINISH_OPTIONS.wood.map((finish) => finish.label), ["White Oak", "Natural Oak", "Light Walnut", "Medium Walnut", "Dark Walnut"]);
  assert.deepEqual(FINISH_OPTIONS.paint.map((finish) => finish.label), ["Warm White", "Soft Ivory", "Light Greige", "Sage Gray", "Charcoal"]);
  for (const finish of [...FINISH_OPTIONS.wood, ...FINISH_OPTIONS.paint]) {
    assert.match(finish.color, /^#[0-9a-f]{6}$/i);
    assert.ok(finish.preview.tintOpacity > 0 && finish.preview.tintOpacity <= 1);
    assert.ok(finish.preview.toneOpacity >= 0 && finish.preview.toneOpacity <= 1);
    assert.match(finish.preview.toneColor, /^#[0-9a-f]{6}$/i);
    assert.ok(["screen", "soft-light", "multiply"].includes(finish.preview.toneBlend));
  }
  assert.deepEqual(DETAIL_OPTIONS.hardware.map((option) => option.label), ["Knob", "Brass Pull", "Black Pull", "No Visible Hardware"]);
  assert.deepEqual(DETAIL_OPTIONS.lighting.map((option) => option.label), ["No Lighting", "Warm LED", "Integrated LED"]);
  assert.equal(getCompatibleDetails("floating-storage", "floating-cabinets").baseStyle.length, 0);
});

test("project store reports blocked writes instead of fabricating save success", () => {
  const storage = new ToggleStorage();
  const projects = createProjectStore(storage);
  const project = normalizeProject({
    ...createProject({ now: 300, random: 0.4 }),
    layout: "clear-wall",
    projectName: "Blocked Save"
  }, { now: 301 });

  assert.ok(projects.saveProject(project));
  storage.blocked = true;
  assert.equal(projects.saveDraft(project), false);
  assert.equal(projects.saveProject({ ...project, projectName: "Changed" }), null);
  assert.equal(projects.renameProject(project.projectId, "Renamed"), null);
  assert.equal(projects.duplicateProject(project.projectId), null);
  assert.equal(projects.deleteProject(project.projectId), false);
});

test("the public configurator lazily ships its unified guided 3D scene without the legacy workspace runtime", async () => {
  const [html, guidedUi, guidedState, guidedScene, workflow] = await Promise.all([
    readFile(new URL("../configurator.html", import.meta.url), "utf8"),
    readFile(new URL("../guided-configurator.js", import.meta.url), "utf8"),
    readFile(new URL("../guided-configurator-state.js", import.meta.url), "utf8"),
    readFile(new URL("../guided-configurator-3d.js", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/deploy-pages-production.yml", import.meta.url), "utf8")
  ]);

  assert.match(html, /guided-configurator\.js/);
  assert.doesNotMatch(html, /assets\/vendor\/three\.module|src=["']configurator-3d|cabinet-ar|direct-hardware/);
  assert.match(guidedUi, /import\(["']\.\/guided-configurator-3d\.js/);
  assert.match(guidedScene, /assets\/vendor\/three\.module\.js/);
  assert.doesNotMatch(`${guidedUi}\n${guidedState}`, /bookcase-engine|cabinet-ar/);
  assert.match(workflow, /test ! -e _site\/configurator-3d\.js/);
  assert.match(workflow, /test -f _site\/guided-configurator-3d\.js/);
  assert.match(workflow, /test -f _site\/guided-scene-plan\.js/);
  assert.match(workflow, /test -f _site\/assets\/vendor\/three\.module\.js/);
});
