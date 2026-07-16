import test from "node:test";
import assert from "node:assert/strict";
import { evaluateBookcaseCandidate } from "../bookcase-engine.js";
import {
  STUDIO_DESIGN_INTENTS,
  STUDIO_PREVIEW_IDEA_IDS,
  STUDIO_PROVISIONAL_DIMENSIONS,
  createNeutralCustomConfig,
  getStudioPreviewIdeas,
  isStudioResumeRequest,
  isStudioWelcomeRequest,
  normalizeStudioDesignIntent,
  resolveStudioEntryState,
  suggestStudioSectionCount,
  validateStudioDimensions
} from "../configurator-studio.js";

test("the welcome exposes exactly three stable engine-backed presentation states", () => {
  assert.deepEqual([...STUDIO_PREVIEW_IDEA_IDS], [
    "classic-open",
    "display-wall",
    "tall-storage"
  ]);

  const previews = getStudioPreviewIdeas();
  assert.deepEqual(
    previews.map(({ id, name, config }) => ({
      id,
      name,
      width: config.width,
      height: config.height,
      sections: config.sections
    })),
    [
      { id: "classic-open", name: "Open Shelves", width: 96, height: 96, sections: 4 },
      { id: "display-wall", name: "Display Wall", width: 102, height: 96, sections: 3 },
      { id: "tall-storage", name: "Tall Storage + Shelves", width: 132, height: 96, sections: 4 }
    ]
  );
  assert.equal(new Set(previews.map((preview) => preview.id)).size, 3);
  assert.deepEqual(previews.map((preview) => preview.callouts.map((callout) => callout.label)), [
    ["Add shelves", "Resize sections"],
    ["Add drawers", "Add doors"],
    ["Add tall doors", "Mix storage"]
  ]);
  for (const preview of previews) {
    assert.equal(preview.callouts.length, 2);
    assert.deepEqual(preview.callouts.map((callout) => callout.side), ["left", "right"]);
    assert.equal(preview.callouts.every((callout) => callout.id && callout.icon && callout.y), true);
  }
  for (const preview of previews) {
    const evaluation = evaluateBookcaseCandidate(preview.config);
    assert.equal(evaluation.accepted, true, `${preview.id} must remain engine-backed`);
  }
});

test("new visitors stay presentation-only while valid explicit sources bypass welcome", () => {
  assert.deepEqual(resolveStudioEntryState(), { presentationOnly: true, source: "new" });
  assert.deepEqual(resolveStudioEntryState({ hasValidSavedDesign: true }), { presentationOnly: false, source: "saved" });
  assert.deepEqual(resolveStudioEntryState({ forceWelcome: true, hasValidSavedDesign: true }), { presentationOnly: true, source: "new" });
  assert.deepEqual(resolveStudioEntryState({ forceWelcome: true, hasValidPreset: true, hasValidSavedDesign: true }), { presentationOnly: false, source: "preset" });
  assert.deepEqual(resolveStudioEntryState({ forceWelcome: true, hasValidSharedConfiguration: true, hasValidPreset: true }), { presentationOnly: false, source: "share" });
});

test("only the explicit homepage start parameter forces the studio welcome", () => {
  assert.equal(isStudioWelcomeRequest("?start=welcome"), true);
  assert.equal(isStudioWelcomeRequest("start=welcome"), true);
  assert.equal(isStudioWelcomeRequest("?preset=media-wall"), false);
  assert.equal(isStudioWelcomeRequest("?start=resume"), false);
});

test("new-design and resume intents are explicit, exclusive, and safely normalized", () => {
  assert.equal(isStudioResumeRequest("?start=resume"), true);
  assert.equal(isStudioResumeRequest("start=resume"), true);
  assert.equal(isStudioResumeRequest("?start=welcome"), false);
  assert.equal(isStudioResumeRequest("?start=storage"), false);
  assert.equal(normalizeStudioDesignIntent(STUDIO_DESIGN_INTENTS.resume), "resume");
  for (const value of [undefined, null, "", "storage", "new-ish"]) {
    assert.equal(normalizeStudioDesignIntent(value), STUDIO_DESIGN_INTENTS.newDesign);
  }
});

test("studio dimensions validate all three physical inputs without silently clamping", () => {
  assert.equal(validateStudioDimensions(STUDIO_PROVISIONAL_DIMENSIONS).valid, true);
  const rejected = validateStudioDimensions({ width: 12, height: "", depth: "deep" });
  assert.equal(rejected.valid, false);
  assert.deepEqual(rejected.issues.map((issue) => issue.field), ["width", "height", "depth"]);
});

test("section suggestions are deterministic and stay inside engine limits", () => {
  assert.equal(suggestStudioSectionCount(24), 1);
  assert.equal(suggestStudioSectionCount(96), 4);
  assert.equal(suggestStudioSectionCount(132), 6);
  assert.equal(suggestStudioSectionCount(240), 6);
  assert.equal(suggestStudioSectionCount("unknown"), 4);
});

test("custom starts create one neutral, valid, equal-width open structure", () => {
  const result = createNeutralCustomConfig({ width: 108, height: 100, depth: 16, sections: 5 });
  assert.equal(result.accepted, true);
  assert.equal(result.config.layoutPreset, "custom");
  assert.equal(result.config.layoutType, "classic");
  assert.equal(result.config.lowerCabinets, false);
  assert.equal(result.config.lighting, "no_lighting");
  assert.equal(result.config.crownStyle, "slim_cap");
  assert.equal(result.config.baseStyle, "toe_kick");
  assert.deepEqual(result.config.layoutMetadata.sectionRatios, [1, 1, 1, 1, 1]);
  const evaluation = evaluateBookcaseCandidate(result.config);
  assert.equal(evaluation.accepted, true, JSON.stringify(evaluation.errors));
  assert.equal(evaluation.layout.components.some((component) => ["door", "drawer_front", "light"].includes(component.role)), false);
});

test("the one-click starter uses the neutral provisional framework", () => {
  const sections = suggestStudioSectionCount(STUDIO_PROVISIONAL_DIMENSIONS.width);
  const result = createNeutralCustomConfig({ ...STUDIO_PROVISIONAL_DIMENSIONS, sections });
  assert.equal(result.accepted, true);
  assert.deepEqual(
    { width: result.config.width, height: result.config.height, depth: result.config.depth, sections: result.config.sections },
    { width: 96, height: 96, depth: 15, sections: 4 }
  );
  assert.deepEqual(result.config.layoutMetadata.sectionRatios, [1, 1, 1, 1]);
  assert.equal(evaluateBookcaseCandidate(result.config).accepted, true);
});
