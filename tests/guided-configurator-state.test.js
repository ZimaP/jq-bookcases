import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  BOOKCASE_INTEGRATED_PREVIEW_ASSETS,
  CATEGORY_DEFINITIONS,
  DETAIL_OPTIONS,
  FINISH_OPTIONS,
  PREVIEW_FINISH_MASK_ASSETS,
  PRODUCT_CHOICES,
  PUBLIC_CONFIGURATOR_COMING_SOON_CHOICES,
  PUBLIC_CONFIGURATOR_COMING_SOON_LAYOUTS,
  PUBLIC_CONFIGURATOR_LAYOUT_CHOICES,
  PUBLIC_CONFIGURATOR_LAYOUT_ID,
  PUBLIC_CONFIGURATOR_PRODUCT_CHOICES,
  PUBLIC_CONFIGURATOR_PRODUCT_ID,
  PRODUCT_INTEGRATED_PREVIEW_ASSETS,
  PUBLIC_BOOKCASE_STYLE_IDS,
  SHARED_ROOM_LAYOUTS,
  getCompatibleDetails,
  getLayout,
  getMeasurementDiagramSpec,
  getMeasurementFields,
  resolveFinishMaskAsset,
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
import { prepareGuidedProjectPersistence } from "../guided-project-engine.js";

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

function assertIntegratedPresentation(presentation, expectedAsset, previewKey) {
  assert.equal(presentation.conceptAsset, expectedAsset, `${previewKey} full-room composite`);
  assert.equal(presentation.renderMode, "integrated", `${previewKey} integrated render mode`);
  assert.equal(
    presentation.authoredLayoutId,
    presentation.layoutId,
    `${previewKey} authored room topology matches the selected layout`
  );
  assert.equal(
    presentation.integratedLayoutId,
    presentation.layoutId,
    `${previewKey} integrated room topology matches the selected layout`
  );
  assert.equal(presentation.mediaFit, "cover", `${previewKey} media fills the scene`);
  assert.ok(
    Number.isFinite(presentation.mediaWidth) && presentation.mediaWidth > 0,
    `${previewKey} media width`
  );
  assert.ok(
    Number.isFinite(presentation.mediaHeight) && presentation.mediaHeight > 0,
    `${previewKey} media height`
  );
  assert.equal(
    presentation.mediaAspectRatio,
    `${presentation.mediaWidth} / ${presentation.mediaHeight}`,
    `${previewKey} media aspect ratio is derived from the authored canvas`
  );
  assert.match(
    presentation.mediaObjectPosition,
    /^(?:0|50|100)% (?:0|50|100)%$/,
    `${previewKey} has a deterministic focal position`
  );
  assert.match(
    presentation.mediaSvgPreserveAspectRatio,
    /^x(?:Min|Mid|Max)Y(?:Min|Mid|Max) slice$/,
    `${previewKey} mask uses the same edge-filling alignment`
  );
  assert.equal(presentation.finishMaskMode, "asset", `${previewKey} uses an approved material mask`);
  assert.equal(
    presentation.finishMaskViewBox,
    `0 0 ${presentation.finishMaskWidth} ${presentation.finishMaskHeight}`,
    `${previewKey} finish mask has an explicit source coordinate system`
  );
  assert.equal(
    presentation.finishMaskWidth,
    presentation.mediaWidth,
    `${previewKey} finish mask width matches the photograph`
  );
  assert.equal(
    presentation.finishMaskHeight,
    presentation.mediaHeight,
    `${previewKey} finish mask height matches the photograph`
  );
  assert.match(
    presentation.finishMaskAsset,
    /-finish-mask-v\d+\.png$/,
    `${previewKey} references an authored finish mask`
  );
  for (const field of [
    "roomAsset",
    "productAsset",
    "installationEnvelope",
    "installationEnvelopeId"
  ]) {
    assert.equal(
      Object.hasOwn(presentation, field),
      false,
      `${previewKey} must not expose the obsolete ${field} layer field`
    );
  }
}

function assertRoomPlusFurniturePresentation(presentation, expectedFurnitureAsset, previewKey) {
  assert.equal(presentation.renderMode, "room-plus-furniture", `${previewKey} layered render mode`);
  assert.equal(
    presentation.conceptAsset,
    presentation.layoutContextAsset,
    `${previewKey} concept state stores the selected room asset`
  );
  assert.equal(
    presentation.roomAsset,
    presentation.layoutContextAsset,
    `${previewKey} reuses the exact measurement room`
  );
  assert.equal(
    presentation.furnitureAsset,
    expectedFurnitureAsset,
    `${previewKey} uses an architecture-free furniture layer`
  );
  assert.equal(presentation.authoredLayoutId, presentation.layoutId, `${previewKey} authored room topology`);
  assert.equal(presentation.integratedLayoutId, presentation.layoutId, `${previewKey} resolved room topology`);
  assert.equal(presentation.mediaFit, "cover", `${previewKey} media fills the scene`);
  assert.equal(presentation.mediaWidth, 1536, `${previewKey} shared scene width`);
  assert.equal(presentation.mediaHeight, 1024, `${previewKey} shared scene height`);
  assert.equal(presentation.mediaAspectRatio, "1536 / 1024", `${previewKey} shared scene aspect ratio`);
  assert.equal(presentation.mediaSvgPreserveAspectRatio, "xMidYMid slice", `${previewKey} shared crop alignment`);
  assert.equal(presentation.finishMaskMode, "asset", `${previewKey} asset-backed finish mask`);
  assert.equal(presentation.finishMaskWidth, presentation.mediaWidth, `${previewKey} finish mask width`);
  assert.equal(presentation.finishMaskHeight, presentation.mediaHeight, `${previewKey} finish mask height`);
  assert.match(presentation.finishMaskAsset, /-finish-mask-v\d+\.png$/, `${previewKey} finish mask asset`);
  assert.deepEqual(
    Object.keys(presentation.installationEnvelope).sort(),
    ["height", "width", "x", "y"],
    `${previewKey} normalized furniture envelope`
  );
  for (const value of Object.values(presentation.installationEnvelope)) {
    assert.ok(value >= 0 && value <= 1, `${previewKey} normalized envelope value`);
  }
}

function pngColorType(buffer) {
  assert.equal(buffer.subarray(1, 4).toString("ascii"), "PNG", "PNG signature");
  return buffer[25];
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
      ["projectionWidth", "D"],
      ["projectionHeight", "E"],
      ["projectionDepth", "F"]
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
    { leftReturn: 24, rightReturn: 0 }
  );
  assert.deepEqual(
    pickReturns(prepareMeasurementsForLayout(project, "niche-layout")),
    { leftReturn: 12, rightReturn: 12 }
  );
  assert.deepEqual(
    pickReturns(prepareMeasurementsForLayout(project, "right-niche")),
    { leftReturn: 0, rightReturn: 24 }
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

test("five-step positions migrate into the four-step workflow without losing a project", () => {
  const modern = normalizeProject({
    ...createProject({ now: 4, random: 0.12, productSelected: true }),
    currentStep: 5,
    maxVisitedStep: 5,
    layout: "fireplace-wall"
  }, { now: 5 });
  assert.equal(modern.currentStep, 4);
  assert.equal(modern.maxVisitedStep, 4);
  assert.equal(modern.productSelected, true);
  assert.equal(modern.productAvailability, "available");
  assert.equal(modern.workflowMigrationSource, null);

  for (const [oldStep, newStep] of [[1, 1], [2, 2], [3, 3], [4, 3], [5, 4]]) {
    const migrated = normalizeProject({
      ...createProject({ now: 4, random: 0.12, productSelected: true }),
      schemaVersion: 3,
      currentStep: oldStep,
      maxVisitedStep: oldStep,
      layout: oldStep > 1 ? "fireplace-wall" : null
    }, { now: 5 });
    assert.equal(migrated.currentStep, newStep, `old step ${oldStep}`);
    assert.equal(migrated.maxVisitedStep, newStep, `old maxVisitedStep ${oldStep}`);
    assert.equal(migrated.workflowMigrationSource, "five-step");
  }

  const incompleteReview = normalizeProject({
    ...createProject({ now: 4, random: 0.12, productSelected: true }),
    schemaVersion: 3,
    currentStep: 5,
    maxVisitedStep: 5,
    layout: "fireplace-wall",
    measurements: { wallWidth: null, ceilingHeight: 96, desiredDepth: 14 }
  }, { now: 5 });
  assert.equal(incompleteReview.currentStep, 3);
  assert.equal(incompleteReview.maxVisitedStep, 3);

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
  assert.equal(legacy.currentStep, 1);
  assert.equal(legacy.maxVisitedStep, 1);
  assert.equal(legacy.productAvailability, "unavailable");
  assert.equal(legacy.workflowMigrationSource, "legacy-category-flow");

  const legacyProjection = normalizeProject({
    ...createProject({ now: 7, productSelected: true }),
    layout: "center-recess",
    measurements: {
      wallWidth: 144,
      ceilingHeight: 108,
      desiredDepth: 15,
      nicheWidth: 48,
      nicheHeight: 72,
      nicheDepth: 8
    }
  }, { now: 8 });
  assert.equal(legacyProjection.measurements.projectionWidth, 48);
  assert.equal(legacyProjection.measurements.projectionHeight, 72);
  assert.equal(legacyProjection.measurements.projectionDepth, 8);
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
  assert.equal(summarySteps.finish, 3);
  assert.equal(summarySteps.hardware, 3);
  assert.equal(summarySteps.notes, 4);
});

test("public availability keeps the full catalog intact while exposing one active product", () => {
  assert.equal(PUBLIC_CONFIGURATOR_PRODUCT_ID, "cabinet-shelves");
  assert.equal(PUBLIC_CONFIGURATOR_LAYOUT_ID, "fireplace-wall");
  assert.deepEqual(PUBLIC_CONFIGURATOR_PRODUCT_CHOICES.map(({ id }) => id), ["cabinet-shelves"]);
  assert.deepEqual(PUBLIC_CONFIGURATOR_LAYOUT_CHOICES.map(({ id }) => id), ["fireplace-wall"]);
  assert.deepEqual(
    PUBLIC_CONFIGURATOR_COMING_SOON_LAYOUTS.map(({ id }) => id),
    SHARED_ROOM_LAYOUTS.filter(({ id }) => id !== "fireplace-wall").map(({ id }) => id)
  );
  assert.deepEqual(
    PUBLIC_CONFIGURATOR_COMING_SOON_CHOICES.map(({ id }) => id),
    PRODUCT_CHOICES.filter(({ id }) => id !== "cabinet-shelves").map(({ id }) => id)
  );

  const unsupported = normalizeProject({
    ...createProject({ now: 25, random: 0.2 }),
    schemaVersion: 3,
    category: "tv-unit",
    style: "framed-tv-wall",
    productSelected: true,
    layout: "clear-wall",
    currentStep: 5,
    maxVisitedStep: 5
  }, { now: 26 });
  assert.equal(unsupported.category, "tv-unit");
  assert.equal(unsupported.style, "framed-tv-wall");
  assert.equal(unsupported.productSelected, true);
  assert.equal(unsupported.productAvailability, "unavailable");
  assert.equal(unsupported.layout, "clear-wall");
  assert.equal(unsupported.currentStep, 1);
  assert.equal(unsupported.maxVisitedStep, 1);
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
      const layeredClearWall = layout.id === "clear-wall";

      assert.equal(
        resolvePreviewAsset("bookcase", styleId, layout.id),
        layeredClearWall ? layout.previewAsset : expectedAsset
      );
      assert.equal(presentation.previewKey, previewKey);
      assert.equal(presentation.categoryId, "bookcase");
      assert.equal(presentation.styleId, styleId);
      assert.equal(presentation.layoutId, layout.id);
      assert.equal(presentation.integratedLayoutId, layout.id);
      if (layeredClearWall) {
        assertRoomPlusFurniturePresentation(presentation, expectedAsset, previewKey);
      } else {
        assertIntegratedPresentation(presentation, expectedAsset, previewKey);
      }

      const png = await readFile(new URL(`../${expectedAsset}`, import.meta.url));
      assert.ok(png.byteLength > 10_000, `${previewKey} PNG is empty`);
      if (layeredClearWall) {
        assert.equal(pngColorType(png), 6, `${previewKey} furniture PNG has an alpha channel`);
      } else {
        const avif = await readFile(new URL(`../${expectedAsset.replace(/\.png$/, ".avif")}`, import.meta.url));
        assert.ok(avif.byteLength > 10_000, `${previewKey} AVIF is empty`);
      }
      if (presentation.finishMaskMode === "asset") {
        const finishMask = await readFile(
          new URL(`../${presentation.finishMaskAsset}`, import.meta.url)
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
  assert.equal(legacyMediaPreview.authoredLayoutId, "door-wall");
  assert.equal(
    legacyMediaPreview.conceptAsset,
    "assets/photos/configurator/room-layouts/room-door-wall-v1.png"
  );

  const drawerConcept = resolvePreviewPresentation("bookcase", "drawer-base-shelves");
  assert.equal(drawerConcept.authoredLayoutId, "niche-layout");
  assert.equal(drawerConcept.mediaWidth, 1448);
  assert.equal(drawerConcept.mediaHeight, 1086);

  const radiatorConcept = resolvePreviewPresentation("radiator-cover", "clean-slat-cover");
  assert.equal(radiatorConcept.authoredLayoutId, "window-wall");
  assert.equal(radiatorConcept.mediaWidth, 1536);
  assert.equal(radiatorConcept.mediaHeight, 1024);
});

test("Step 1 Bookcase product cards use the empty v2 artwork cohort", async () => {
  const expectedCardAssets = new Map([
    ["cabinet-shelves", "assets/photos/configurator/concept-cabinets-shelves-v2.png"],
    ["drawer-shelves", "assets/photos/configurator/concept-drawers-shelves-v2.png"],
    ["open-shelving", "assets/photos/configurator/concept-full-shelving-v2.png"]
  ]);
  const retiredPropFilledAssets = new Set([
    "assets/photos/configurator/concept-cabinets-shelves-v1.png",
    "assets/photos/configurator/concept-drawers-shelves-v1.png",
    "assets/photos/configurator/concept-full-shelving-v1.png"
  ]);
  const bookcaseCategory = categoryById("bookcase");
  const activeCardAssets = [];

  for (const choice of PRODUCT_CHOICES.filter(({ categoryId }) => categoryId === "bookcase")) {
    const style = bookcaseCategory.styles.find(({ id }) => id === choice.styleId);
    const cardAsset = style?.previewAsset || bookcaseCategory.productPreviewAsset;
    const expectedAsset = expectedCardAssets.get(choice.id);

    assert.equal(cardAsset, expectedAsset, `${choice.label} uses its reviewed empty-shelf card`);
    assert.equal(retiredPropFilledAssets.has(cardAsset), false, `${choice.label} rejects prop-filled v1 artwork`);
    assert.doesNotMatch(cardAsset, /-v1\.png$/, `${choice.label} is cache-safe`);

    const png = await readFile(new URL(`../${cardAsset}`, import.meta.url));
    const avif = await readFile(new URL(`../${cardAsset.replace(/\.png$/, ".avif")}`, import.meta.url));
    assert.ok(png.byteLength > 10_000, `${choice.label} empty-shelf PNG is present`);
    assert.ok(avif.byteLength > 10_000, `${choice.label} empty-shelf AVIF is present`);
    activeCardAssets.push(cardAsset);
  }

  assert.deepEqual(activeCardAssets, [...expectedCardAssets.values()]);
  assert.equal(bookcaseCategory.productPreviewAsset, expectedCardAssets.get("cabinet-shelves"));

  const configuratorHtml = await readFile(new URL("../configurator.html", import.meta.url), "utf8");
  assert.match(
    configuratorHtml,
    /rel="preload" href="assets\/photos\/configurator\/concept-cabinets-shelves-v2\.avif"/,
    "the initial Step 1 preload uses the empty Cabinets + Shelves card"
  );
  for (const retiredAsset of retiredPropFilledAssets) {
    assert.doesNotMatch(configuratorHtml, new RegExp(retiredAsset.replace(".png", "\\.(?:png|avif)")));
  }
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
  const finishSources = new Set();
  const resolvedMasks = new Set();
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

      assert.doesNotMatch(
        expectedAsset,
        /-v1\.png$/,
        `${previewKey} uses the cache-safe empty-shelf asset cohort`
      );

      assert.equal(presentation.previewKey, previewKey);
      assert.equal(presentation.categoryId, choice.categoryId);
      assert.equal(presentation.styleId, choice.styleId);
      assert.equal(presentation.layoutId, layout.id);
      assert.equal(presentation.integratedLayoutId, layout.id);
      const layeredClearWall = choice.categoryId === "bookcase" && layout.id === "clear-wall";
      if (layeredClearWall) {
        assertRoomPlusFurniturePresentation(presentation, expectedAsset, previewKey);
      } else {
        assertIntegratedPresentation(presentation, expectedAsset, previewKey);
      }
      const finishSource = presentation.furnitureAsset || presentation.conceptAsset;
      assert.equal(
        presentation.finishMaskAsset,
        PREVIEW_FINISH_MASK_ASSETS[finishSource],
        `${previewKey} uses the explicitly approved wood-material mask`
      );

      const png = await readFile(new URL(`../${expectedAsset}`, import.meta.url));
      assert.ok(png.byteLength > 10_000, `${previewKey} PNG is empty`);
      if (layeredClearWall) {
        assert.equal(pngColorType(png), 6, `${previewKey} furniture PNG has an alpha channel`);
      } else {
        const avif = await readFile(new URL(`../${expectedAsset.replace(/\.png$/, ".avif")}`, import.meta.url));
        assert.ok(avif.byteLength > 10_000, `${previewKey} AVIF is empty`);
      }

      if (presentation.finishMaskMode === "asset") {
        assert.match(
          presentation.finishMaskAsset,
          /-finish-mask-v4\.png$/,
          `${previewKey} uses the empty-shelf wood-only mask cohort`
        );
        const finishMask = await readFile(
          new URL(`../${presentation.finishMaskAsset}`, import.meta.url)
        );
        assert.ok(finishMask.byteLength > 1_000, `${previewKey} finish mask is empty`);
      }

      exactAssets.add(expectedAsset);
      finishSources.add(finishSource);
      resolvedMasks.add(presentation.finishMaskAsset);
      resolvedSceneCount += 1;
    }
  }

  assert.equal(resolvedSceneCount, PRODUCT_CHOICES.length * SHARED_ROOM_LAYOUTS.length);
  // Cabinets + Shelves and Window Storage intentionally share the same approved
  // cabinetry-around-a-window scene for Window Wall; every other asset is unique.
  assert.equal(exactAssets.size, 69);
  assert.equal(finishSources.size, 69);
  assert.equal(resolvedMasks.size, 69);
  assert.deepEqual(
    [...finishSources].sort(),
    Object.keys(PREVIEW_FINISH_MASK_ASSETS).sort(),
    "the approved mask allowlist exactly covers the active public preview sources"
  );
  assert.equal(Object.values(PREVIEW_FINISH_MASK_ASSETS).every(Boolean), true);
});

test("unapproved preview assets fail closed without an inferred finish mask", () => {
  const unknownAsset = "assets/photos/configurator/integrated/tv-unit/framed-tv-wall/right-niche-v99.png";
  assert.equal(resolveFinishMaskAsset(unknownAsset), null);
  assert.equal(resolveFinishMaskAsset(""), null);
});

test("preview presentations expose truthful media contracts for all seventy selections", () => {
  for (const choice of PRODUCT_CHOICES) {
    for (const layout of SHARED_ROOM_LAYOUTS) {
      const presentation = resolvePreviewPresentation(choice.categoryId, choice.styleId, layout.id);
      const expectedAsset = PRODUCT_INTEGRATED_PREVIEW_ASSETS[choice.id][layout.id];
      assert.equal(presentation.layoutId, layout.id);
      assert.equal(presentation.integratedLayoutId, layout.id);
      assert.equal(presentation.layoutLabel, layout.label);
      assert.equal(presentation.layoutContextAsset, layout.previewAsset);
      assert.equal(presentation.layoutPreviewMode, layout.previewMode);
      assert.equal(presentation.layoutPreviewPosition, layout.previewPosition);
      if (choice.categoryId === "bookcase" && layout.id === "clear-wall") {
        assertRoomPlusFurniturePresentation(presentation, expectedAsset, presentation.previewKey);
      } else {
        assertIntegratedPresentation(presentation, expectedAsset, presentation.previewKey);
      }
    }
  }

  const betweenOpenings = resolvePreviewPresentation("tv-unit", "framed-tv-wall", "double-opening");
  assert.equal(betweenOpenings.layoutId, "double-opening");
  assert.equal(betweenOpenings.layoutLabel, "Between Openings");
  assert.equal(
    betweenOpenings.conceptAsset,
    "assets/photos/configurator/integrated/tv-unit/framed-tv-wall/double-opening-v3.png"
  );
  assertIntegratedPresentation(
    betweenOpenings,
    "assets/photos/configurator/integrated/tv-unit/framed-tv-wall/double-opening-v3.png",
    betweenOpenings.previewKey
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
  assert.equal(normalized.previewAsset, betweenOpenings.conceptAsset);
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

test("compact accepted snapshots survive normalization and storage while retaining physical summary rows", () => {
  const acceptedSnapshot = {
    schemaVersion: 2,
    engineVersion: "2026.08-luxury-configurator-v1",
    specificationSchemaVersion: 1,
    projectId: "JQ-COMPACT-0001",
    productId: "tv-unit",
    layoutId: "clear-wall",
    geometryFingerprint: "jq-guided-geometry-v1-compact",
    selectionFingerprint: "jq-guided-selection-v1-compact",
    specificationFingerprint: "jq-guided-spec-v1-compact",
    regeneration: {
      topologyFingerprint: "jq-guided-snapshot-room-v1-compact",
      fitFingerprint: "jq-guided-snapshot-fit-v1-compact",
      descriptorFingerprint: "jq-guided-snapshot-descriptors-v1-compact",
      materialFingerprint: "jq-guided-snapshot-materials-v1-compact",
      cameraFingerprint: "jq-guided-snapshot-camera-v1-compact"
    },
    summary: {
      installations: [{
        zoneId: "main",
        role: "primary",
        casework: { width: 117, overallHeight: 96, depth: 14 },
        treatments: {
          left: { kind: "filler", width: 1.5 },
          right: { kind: "filler", width: 1.5 },
          base: { kind: "built-in-base", height: 4 },
          top: { kind: "scribe-or-crown", height: 0.75 }
        }
      }],
      tv: {
        accepted: true,
        body: { width: 56, height: 33 },
        opening: { width: 60, height: 37 }
      }
    }
  };
  const project = normalizeProject({
    ...createProject({ now: 90, random: 0.09, category: "tv-unit", productSelected: true }),
    projectId: "JQ-COMPACT-0001",
    layout: "clear-wall",
    acceptedSnapshot
  }, { now: 91 });
  assert.deepEqual(project.acceptedSnapshot, acceptedSnapshot);
  assert.equal(Object.hasOwn(project.acceptedSnapshot, "acceptedSpecification"), false);

  const storage = new MemoryStorage();
  const projects = createProjectStore(storage);
  assert.equal(projects.saveDraft(project), true);
  const restored = projects.loadDraft();
  assert.deepEqual(restored.acceptedSnapshot, acceptedSnapshot);
  assert.ok(Buffer.byteLength(storage.getItem(GUIDED_DRAFT_STORAGE_KEY), "utf8") < 8_192);

  const summary = Object.fromEntries(buildProjectSummary(restored).map((row) => [row.key, row.value]));
  assert.equal(summary.fittedSize, "117 × 96 × 14 in");
  assert.equal(summary.tvBody, "56 × 33 in");
  assert.equal(summary.tvOpening, "60 × 37 in");
  assert.equal(summary.geometryFingerprint, acceptedSnapshot.geometryFingerprint);
});

test("Radiator Cover defaults the Window Wall obstruction to present", () => {
  const radiatorProject = createProject({
    now: 92,
    random: 0.12,
    category: "radiator-cover",
    productSelected: true
  });
  const measurements = prepareMeasurementsForLayout(radiatorProject, "window-wall");
  assert.equal(measurements.radiatorBelowWindow, "yes");
  assert.equal(measurements.windowWidth, 60);
  assert.equal(measurements.sillHeight, 32);
  assert.equal(measurements.radiatorWidth, 48);
  assert.equal(measurements.radiatorHeight, 26);
  assert.equal(measurements.radiatorDepth, 9);
});

test("review and quote summary rows expose accepted pricing, warnings, and geometry identity", () => {
  const summaryProject = normalizeProject({
    ...createProject({ now: 93, random: 0.13, productSelected: true }),
    layout: "clear-wall"
  }, { now: 94 });
  const rows = Object.fromEntries(buildProjectSummary(summaryProject, {
    acceptedSpecification: {
      accepted: true,
      fit: { installations: [] },
      product: { tv: null },
      geometryFingerprint: "jq-guided-geometry-v1-summary",
      pricing: { available: true, total: 12345 },
      warnings: [{
        code: "DESIGN_REVIEW_NOTE",
        message: "Field measurements must be confirmed."
      }]
    },
    acceptedQuote: {
      identity: {
        geometryFingerprint: "jq-guided-geometry-v1-summary"
      },
      pricing: {
        available: true,
        total: 12345,
        fingerprint: "jq-guided-quote-pricing-v1-summary"
      },
      warnings: {
        fingerprint: "jq-guided-quote-warnings-v1-summary",
        items: [{
          code: "DESIGN_REVIEW_NOTE",
          message: "Field measurements must be confirmed."
        }]
      },
      bom: {
        componentCount: 13,
        billableComponentCount: 12,
        customerEquipmentCount: 1,
        byRole: { door: 4, screen: 1, shelf: 8 },
        fingerprint: "jq-guided-quote-bom-v1-summary"
      },
      integrity: {
        verified: true,
        quoteFingerprint: "jq-guided-quote-contract-v1-summary"
      }
    }
  }).map((row) => [row.key, row.value]));

  assert.equal(rows.pricing, "$12,345");
  assert.equal(rows.pricingFingerprint, "jq-guided-quote-pricing-v1-summary");
  assert.equal(rows.geometryFingerprint, "jq-guided-geometry-v1-summary");
  assert.equal(rows.warnings, "Field measurements must be confirmed. (DESIGN_REVIEW_NOTE)");
  assert.equal(rows.warningsFingerprint, "jq-guided-quote-warnings-v1-summary");
  assert.equal(rows.bom, "12 billable components (13 physical; 1 customer equipment) · door 4, screen 1, shelf 8");
  assert.equal(rows.bomFingerprint, "jq-guided-quote-bom-v1-summary");
  assert.equal(rows.quoteFingerprint, "jq-guided-quote-contract-v1-summary");
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

test("project store accepts only an engine-verified persistence contract for accepted saves", () => {
  const storage = new MemoryStorage();
  const projects = createProjectStore(storage);
  const base = createProject({
    now: 250,
    random: 0.25,
    category: "bookcase",
    productSelected: true,
    projectName: "Accepted Library"
  });
  const acceptedProject = normalizeProject({
    ...base,
    layout: "clear-wall",
    measurements: prepareMeasurementsForLayout(base, "clear-wall")
  }, { now: 251 });
  const accepted = prepareGuidedProjectPersistence(acceptedProject);
  assert.equal(accepted.accepted, true, JSON.stringify(accepted.errors));
  assert.equal(projects.saveAcceptedDraft(accepted), true);
  assert.ok(projects.saveAcceptedProject(accepted, "Accepted Library"));

  const storedDraft = projects.loadDraft();
  const storedProject = projects.getProject(acceptedProject.projectId);
  const acceptedFingerprint = accepted.specification.specificationFingerprint;
  assert.equal(storedDraft.acceptedSnapshot.specificationFingerprint, acceptedFingerprint);
  assert.equal(storedProject.acceptedSnapshot.specificationFingerprint, acceptedFingerprint);

  const invalidEdit = structuredClone(accepted.project);
  invalidEdit.measurements.wallWidth = -1;
  const rejected = prepareGuidedProjectPersistence(invalidEdit, accepted.specification);
  assert.equal(rejected.code, "GUIDED_SAVE_REJECTED_CANDIDATE");
  assert.equal(projects.saveAcceptedDraft(rejected), false);
  assert.equal(projects.saveAcceptedProject(rejected, "Invalid Library"), null);
  assert.equal(projects.loadDraft().measurements.wallWidth, storedDraft.measurements.wallWidth);
  assert.equal(
    projects.getProject(acceptedProject.projectId).acceptedSnapshot.specificationFingerprint,
    acceptedFingerprint
  );

  const forged = structuredClone(accepted);
  forged.project.acceptedSnapshot.geometryFingerprint = "jq-guided-geometry-v1-forged";
  assert.equal(projects.saveAcceptedDraft(forged), false);
  assert.equal(projects.saveAcceptedProject(forged, "Forged Library"), null);
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

test("the public configurator lazily ships the fixed Room 2 GLB viewer without the old generated scene", async () => {
  const [html, guidedUi, guidedState, room2Viewer, appearance, workflow] = await Promise.all([
    readFile(new URL("../configurator.html", import.meta.url), "utf8"),
    readFile(new URL("../guided-configurator.js", import.meta.url), "utf8"),
    readFile(new URL("../guided-configurator-state.js", import.meta.url), "utf8"),
    readFile(new URL("../guided-room2-viewer.js", import.meta.url), "utf8"),
    readFile(new URL("../guided-room2-appearance.js", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/deploy-pages-production.yml", import.meta.url), "utf8")
  ]);

  assert.match(html, /guided-configurator\.js/);
  assert.match(html, /"three": "\.\/assets\/vendor\/three\.module\.js"/);
  assert.doesNotMatch(html, /src=["']configurator-3d|cabinet-ar|direct-hardware/);
  assert.match(guidedUi, /import\(["']\.\/guided-room2-viewer\.js/);
  assert.doesNotMatch(guidedUi, /import\(["']\.\/guided-configurator-3d\.js/);
  assert.match(room2Viewer, /assets\/vendor\/three\.module\.js/);
  assert.match(room2Viewer, /GLTFLoader/);
  assert.match(appearance, /Room2-Fireplace-bookcases-source-v1\.glb/);
  assert.doesNotMatch(`${guidedUi}\n${guidedState}`, /bookcase-engine|cabinet-ar/);
  assert.match(workflow, /test ! -e _site\/configurator-3d\.js/);
  assert.match(workflow, /test ! -e _site\/guided-configurator-3d\.js/);
  assert.match(workflow, /test -f _site\/guided-room2-viewer\.js/);
  assert.match(workflow, /Room2-Fireplace-bookcases-source-v1\.glb/);
  assert.match(workflow, /test -f _site\/assets\/vendor\/three\.module\.js/);
});
