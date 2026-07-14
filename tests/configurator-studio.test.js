import test from "node:test";
import assert from "node:assert/strict";
import { evaluateBookcaseCandidate } from "../bookcase-engine.js";
import {
  INSPIRATION_FILTERS,
  STUDIO_PROVISIONAL_DIMENSIONS,
  createNeutralCustomConfig,
  filterInspirationIdeas,
  getStudioPreviewIdeas,
  inspirationIdeas,
  isStudioWelcomeRequest,
  resolveStudioEntryState,
  suggestStudioSectionCount,
  validateStudioDimensions
} from "../configurator-studio.js";

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

test("the idea library contains only real engine-backed configurations with honest editability", () => {
  assert.equal(inspirationIdeas.length, 10);
  assert.deepEqual(INSPIRATION_FILTERS.map((filter) => filter.id), ["all", "library", "storage", "media", "work", "feature"]);
  for (const idea of inspirationIdeas) {
    assert.deepEqual(Object.keys(idea), ["id", "name", "description", "category", "tags", "fullyEditable", "config"]);
    assert.equal(evaluateBookcaseCandidate(idea.config).accepted, true, idea.id);
    const constrained = Boolean(idea.config.centerOpening || idea.config.deskOpening || idea.config.featureOpening);
    assert.equal(idea.fullyEditable, !constrained, idea.id);
  }
  assert.equal(filterInspirationIdeas("library").every((idea) => idea.category === "library"), true);
  assert.equal(filterInspirationIdeas("unsupported").length, inspirationIdeas.length);
  assert.deepEqual(getStudioPreviewIdeas().map((idea) => idea.id), ["classic-open", "display-wall", "tall-storage"]);
});
