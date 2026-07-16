import test from "node:test";
import assert from "node:assert/strict";

import { normalizeBookcaseConfig } from "../bookcase-config.js";
import {
  deleteSection,
  duplicateSection,
  getSectionDesignerState,
  setSectionStorageConfiguration
} from "../bookcase-sections.js";
import {
  createAcceptedDesignSnapshot,
  evaluateBookcaseCandidate,
  restoreAcceptedDesignSnapshot
} from "../bookcase-engine.js";

function mixedConfig() {
  return normalizeBookcaseConfig({
    width: 120,
    sections: 4,
    lighting: "no_lighting",
    layoutMetadata: {
      sectionTypes: ["open", "lower_doors", "drawers", "tall_doors"],
      sectionConfigs: [
        { id: "section-config-open", type: "open", shelfCount: 2 },
        { id: "section-config-doors", type: "lower_doors", shelfCount: 4, doorStyle: "flat" },
        { id: "section-config-drawers", type: "drawers", shelfCount: 3, drawerCount: 5, drawerFrontStyle: "slim_shaker" },
        { id: "section-config-glass", type: "tall_doors", shelfCount: 6, doorStyle: "glass" }
      ]
    }
  });
}

test("legacy global storage expands into complete stable section records", () => {
  const state = normalizeBookcaseConfig({
    width: 96,
    sections: 3,
    shelves: 5,
    drawerCount: 4,
    doorStyle: "flat",
    drawerFrontStyle: "slim_shaker",
    layoutMetadata: { sectionTypes: ["open", "lower_doors", "drawers"] }
  });

  assert.equal(state.layoutMetadata.sectionConfigs.length, 3);
  assert.deepEqual(state.layoutMetadata.sectionConfigs.map((section) => section.type), ["open", "lower_doors", "drawers"]);
  assert.deepEqual(state.layoutMetadata.sectionConfigs.map((section) => section.shelfCount), [5, 5, 5]);
  assert.deepEqual(state.layoutMetadata.sectionConfigs.map((section) => section.id), [
    "section-config-01",
    "section-config-02",
    "section-config-03"
  ]);
  assert.equal(state.layoutMetadata.sectionConfigs[1].doorStyle, "flat");
  assert.equal(state.layoutMetadata.sectionConfigs[2].drawerCount, 4);
  assert.equal(state.layoutMetadata.sectionConfigs[2].drawerFrontStyle, "slim_shaker");
});

test("each section generates its own shelves, front style, and drawer stack", () => {
  const evaluation = evaluateBookcaseCandidate(mixedConfig());
  assert.equal(evaluation.accepted, true, JSON.stringify(evaluation.errors));

  const shelvesBySection = Object.fromEntries(
    evaluation.layout.sectionIds.map((sectionId) => [
      sectionId,
      evaluation.layout.components.filter((component) => component.role === "shelf" && component.parentId === sectionId).length
    ])
  );
  assert.deepEqual(shelvesBySection, {
    "section-01": 2,
    "section-02": 4,
    "section-03": 3,
    "section-04": 6
  });
  assert.deepEqual(evaluation.bom.doors.byStyle, { flat: 2, glass: 2 });
  assert.equal(evaluation.bom.drawers.frontCount, 5);
  assert.deepEqual(evaluation.bom.drawers.byStyle, { slim_shaker: 5 });
  assert.equal(evaluation.bom.hardware.handleCount, evaluation.bom.doors.count + evaluation.bom.drawers.frontCount);
});

test("a section-local edit leaves unrelated section configuration unchanged", () => {
  const initial = evaluateBookcaseCandidate(mixedConfig());
  const before = structuredClone(initial.state.layoutMetadata.sectionConfigs);
  const operation = setSectionStorageConfiguration(initial.state, 1, {
    shelfCount: 7,
    doorStyle: "shaker",
    lowerStorageHeight: 36
  }, initial.layout);
  assert.equal(operation.accepted, true, operation.error?.message);
  const next = evaluateBookcaseCandidate(operation.config);
  assert.equal(next.accepted, true, JSON.stringify(next.errors));
  assert.equal(next.state.layoutMetadata.sectionConfigs[1].shelfCount, 7);
  assert.equal(next.state.layoutMetadata.sectionConfigs[1].doorStyle, "shaker");
  assert.equal(next.state.layoutMetadata.sectionConfigs[1].lowerStorageHeight, 36);
  assert.deepEqual(next.state.layoutMetadata.sectionConfigs[0], before[0]);
  assert.deepEqual(next.state.layoutMetadata.sectionConfigs[2], before[2]);
  assert.deepEqual(next.state.layoutMetadata.sectionConfigs[3], before[3]);
});

test("section identities survive duplicate and delete while the inserted copy gets a new id", () => {
  const initial = evaluateBookcaseCandidate({
    width: 144,
    sections: 3,
    lowerCabinets: false,
    lighting: "no_lighting",
    layoutMetadata: { sectionTypes: ["open", "open", "open"] }
  });
  const originalIds = initial.state.layoutMetadata.sectionConfigs.map((section) => section.id);
  const duplicate = duplicateSection(initial.state, initial.layout, 0);
  assert.equal(duplicate.accepted, true, duplicate.error?.message);
  const duplicatedIds = duplicate.config.layoutMetadata.sectionConfigs.map((section) => section.id);
  assert.equal(duplicatedIds[0], originalIds[0]);
  assert.notEqual(duplicatedIds[1], originalIds[0]);
  assert.deepEqual(duplicatedIds.slice(2), originalIds.slice(1));

  const duplicatedEvaluation = evaluateBookcaseCandidate(duplicate.config);
  const removed = deleteSection(duplicatedEvaluation.state, duplicatedEvaluation.layout, 1);
  assert.equal(removed.accepted, true, removed.error?.message);
  assert.deepEqual(removed.config.layoutMetadata.sectionConfigs.map((section) => section.id), originalIds);
});

test("section designer state and verified save restoration retain complete section settings", () => {
  const evaluation = evaluateBookcaseCandidate(mixedConfig());
  const designer = getSectionDesignerState(evaluation.state, evaluation.layout);
  assert.deepEqual(designer.sections.map((section) => section.stableId), [
    "section-config-open",
    "section-config-doors",
    "section-config-drawers",
    "section-config-glass"
  ]);
  assert.deepEqual(designer.sections.map((section) => section.shelfCount), [2, 4, 3, 6]);
  assert.equal(designer.sections[2].drawerCount, 5);

  const snapshot = createAcceptedDesignSnapshot(evaluation, { savedAt: "2026-07-16T12:00:00.000Z" });
  const restored = restoreAcceptedDesignSnapshot(snapshot);
  assert.equal(restored.accepted, true, JSON.stringify(restored.errors));
  assert.deepEqual(restored.state.layoutMetadata.sectionConfigs, evaluation.state.layoutMetadata.sectionConfigs);
  assert.equal(restored.pricing.total, evaluation.pricing.total);
});

test("verified schema-5 saves without section records migrate into section-local defaults", () => {
  const evaluation = evaluateBookcaseCandidate({
    width: 96,
    sections: 3,
    shelves: 4,
    drawerCount: 3,
    layoutMetadata: { sectionTypes: ["open", "lower_doors", "drawers"] }
  });
  const snapshot = createAcceptedDesignSnapshot(evaluation, { savedAt: "2026-07-16T12:00:00.000Z" });
  const legacySnapshot = structuredClone(snapshot);
  delete legacySnapshot.canonicalConfig.layoutMetadata.sectionConfigs;

  const restored = restoreAcceptedDesignSnapshot(legacySnapshot);
  assert.equal(restored.accepted, true, JSON.stringify(restored.errors));
  assert.equal(restored.migration?.sectionStorageSchemaVersion, 1);
  assert.equal(restored.migration?.preservedLegacySectionIntent, true);
  assert.deepEqual(restored.state.layoutMetadata.sectionConfigs.map((section) => section.shelfCount), [4, 4, 4]);
});
