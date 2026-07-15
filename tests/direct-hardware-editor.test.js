import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createHardwareCatalogIndex } from "../hardware-catalog.js";

import {
  adaptDirectHardwarePlacementForHost,
  assessDirectHardwareCompatibility,
  BoundedHardwareHistory,
  canDirectHardwareHostUseDoublePlacement,
  ContextualEditorRegistry,
  HARDWARE_APPLICATION_SCOPES,
  clampHardwareAnchor,
  createDirectHardwareCatalogView,
  createDirectEditorRegistry,
  createSavedHardwareVariantView,
  DirectHardwareEditor,
  escapeDirectHardwareHtml,
  getRecommendedDirectHardwarePlacement,
  matchesDirectHardwareFilters,
  normalizeDirectHardwarePlacement,
  renderDirectHardwareEditorMarkup,
  renderDirectHardwarePlacementControls,
  resolveDirectHardwarePricingImpact,
  resolveHardwareScope,
  resolveHardwareSelection
} from "../direct-hardware-editor.js";

const component = (id, role, parentId, hostId, metadata = {}) => ({
  id,
  role,
  parentId,
  hostId,
  metadata,
  size: { x: role === "drawer_front" ? 28 : 18, y: role === "door" ? 36 : 8, z: 0.75 },
  bounds: { min: { x: 0, y: 0, z: -0.75 }, max: { x: 18, y: 36, z: 0 } },
  position: { x: 9, y: 18, z: -0.375 }
});

function scopeFixture() {
  return {
    components: [
      component("bookcase", "assembly", null, null),
      component("section-01", "section", "bookcase", "bookcase"),
      component("section-01-opening", "opening", "section-01", "section-01"),
      component("door-a", "door", "section-01-opening", "section-01-opening", { style: "slim_shaker", mounting: "inset" }),
      component("door-a-handle", "handle", "door-a", "door-a"),
      component("drawer-a", "drawer_front", "section-01-opening", "section-01-opening", { style: "flat", mounting: "inset", ordinal: 1 }),
      component("drawer-a-handle", "handle", "drawer-a", "drawer-a"),
      component("section-02", "section", "bookcase", "bookcase"),
      component("section-02-opening", "opening", "section-02", "section-02"),
      component("door-b", "door", "section-02-opening", "section-02-opening", { style: "slim_shaker", mounting: "inset" }),
      component("door-b-handle", "handle", "door-b", "door-b"),
      component("door-c", "door", "section-02-opening", "section-02-opening", { style: "glass", mounting: "inset" }),
      component("door-c-handle", "handle", "door-c", "door-c"),
      component("drawer-b", "drawer_front", "section-02-opening", "section-02-opening", { style: "flat", mounting: "inset", ordinal: 1 }),
      component("drawer-b-handle", "handle", "drawer-b", "drawer-b")
    ]
  };
}

test("hardware selection resolves handles and hosted fronts to stable semantic hosts", () => {
  const layout = scopeFixture();
  const fromHandle = resolveHardwareSelection(layout, "door-a-handle");
  assert.equal(fromHandle.component.id, "door-a-handle");
  assert.equal(fromHandle.host.id, "door-a");
  assert.equal(fromHandle.anchorComponent.id, "door-a-handle");
  assert.equal(fromHandle.sectionId, "section-01");

  const fromFront = resolveHardwareSelection(layout, { componentId: "drawer-a" });
  assert.equal(fromFront.host.id, "drawer-a");
  assert.equal(fromFront.anchorComponent.id, "drawer-a-handle");
  assert.equal(resolveHardwareSelection(layout, "section-01"), null);
});

test("scope resolution covers item, section, and matching front groups without duplicate hosts", () => {
  const layout = scopeFixture();

  assert.deepEqual(
    resolveHardwareScope(layout, "door-a-handle", HARDWARE_APPLICATION_SCOPES.item).hostIds,
    ["door-a"]
  );
  assert.deepEqual(
    resolveHardwareScope(layout, "door-a", HARDWARE_APPLICATION_SCOPES.section).hostIds,
    ["door-a", "drawer-a"]
  );
  assert.deepEqual(
    resolveHardwareScope(layout, "door-a", HARDWARE_APPLICATION_SCOPES.allMatchingDoors).hostIds,
    ["door-a", "door-b"]
  );
  assert.deepEqual(
    resolveHardwareScope(layout, "drawer-a-handle", HARDWARE_APPLICATION_SCOPES.allMatchingDrawers).hostIds,
    ["drawer-a", "drawer-b"]
  );

  const incompatibleScope = resolveHardwareScope(
    layout,
    "drawer-a",
    HARDWARE_APPLICATION_SCOPES.allMatchingDoors
  );
  assert.deepEqual(incompatibleScope.hostIds, []);
  assert.match(incompatibleScope.excluded[0].reason, /Select a door/);
});

test("anchor clamping flips near edges and keeps card plus leader endpoints in bounds", () => {
  const nearRight = clampHardwareAnchor(
    { x: 386, y: 8 },
    { width: 400, height: 300 },
    { width: 132, height: 108 },
    { margin: 16, gap: 20, topInset: 24, bottomInset: 28 }
  );
  assert.equal(nearRight.side, "left");
  assert.ok(nearRight.left >= 16);
  assert.ok(nearRight.left + 132 <= 384);
  assert.ok(nearRight.top >= 24);
  assert.ok(nearRight.top + 108 <= 272);
  assert.deepEqual(nearRight.leaderStart, { x: 384, y: 24 });
  assert.equal(nearRight.leaderEnd.x, nearRight.left + 132);

  const nearLeft = clampHardwareAnchor(
    { x: 12, y: 290 },
    { width: 400, height: 300 },
    { width: 120, height: 90 },
    { margin: 16, gap: 20, bottomInset: 20 }
  );
  assert.equal(nearLeft.side, "right");
  assert.ok(nearLeft.top + 90 <= 280);

  const objectSignature = clampHardwareAnchor({
    anchor: { x: 200, y: 150 },
    viewport: { width: 400, height: 300 },
    card: { width: 100, height: 100 },
    options: { margin: 10 }
  });
  assert.equal(objectSignature.visible, true);
});

test("bounded history treats a bulk state change atomically and clears redo on a new commit", () => {
  const history = new BoundedHardwareHistory(2);
  const command = (id) => ({
    beforeState: { id: id - 1, hardwareSelections: { byHostId: {} } },
    afterState: { id, hardwareSelections: { byHostId: { a: { variantId: `v-${id}` }, b: { variantId: `v-${id}` } } } },
    metadata: { affectedCount: 2, scope: "section" }
  });

  history.record(command(1));
  history.record(command(2));
  history.record(command(3));
  assert.deepEqual(history.snapshot(), {
    limit: 2,
    undoCount: 2,
    redoCount: 0,
    canUndo: true,
    canRedo: false
  });
  assert.equal(history.peekUndo().afterState.id, 3);
  history.commitUndo();
  assert.equal(history.peekRedo().afterState.id, 3);
  assert.equal(history.undoCount, 1);
  assert.equal(history.redoCount, 1);
  history.commitRedo();
  assert.equal(history.undoCount, 2);
  assert.equal(history.redoCount, 0);
  history.commitUndo();
  history.record(command(4));
  assert.equal(history.redoCount, 0);

  const snapshot = history.peekUndo();
  snapshot.afterState.id = 99;
  assert.equal(history.peekUndo().afterState.id, 4, "history snapshots cannot mutate stored commands");
});

test("contextual registry maps hardware roles and keeps planned editors explicitly disabled", () => {
  const registry = createDirectEditorRegistry();
  assert.ok(registry instanceof ContextualEditorRegistry);
  assert.equal(registry.getForRole("handle").kind, "hardware");
  assert.equal(registry.getForRole("door").enabled, true);
  assert.equal(registry.getForRole("drawer_front").kind, "hardware");
  assert.equal(registry.getForRole("shelf").planned, true);
  assert.equal(registry.getForRole("section").enabled, false);
  assert.equal(registry.getForRole("crown").semanticLabel, "Crown profile");
  assert.equal(registry.getForRole("light"), null);
});

test("pure shell markup exposes one accessible card, library, tree, measurements, and live region", () => {
  const html = renderDirectHardwareEditorMarkup({ idPrefix: "test editor", catalogStatus: "ready" });
  assert.match(html, /class="direct-hardware-edit"/);
  assert.match(html, /data-catalog-state="ready"/);
  assert.match(html, /data-direct-quick-card role="dialog" aria-modal="false"/);
  assert.match(html, /data-hardware-library role="dialog" aria-modal="true"/);
  assert.match(html, /data-editable-components role="tree"/);
  assert.match(html, /aria-live="polite" aria-atomic="true"/);
  assert.match(html, /data-direct-units aria-label="Dimension display units"/);
  assert.match(html, /data-direct-scale aria-label="Human scale reference"/);
  assert.match(html, /value="custom"/);
  assert.match(html, /data-measurement-overlay/);
  assert.match(html, /data-overall-height aria-label="Overall bookcase height"/);
  assert.doesNotMatch(html, /<img\b/i, "the shell must not include manufacturer imagery");
  assert.doesNotMatch(html, /test editor/, "generated IDs must be sanitized");
  assert.match(html, /test-editor-components/);
});

test("catalog and component text escaping is inert", () => {
  assert.equal(
    escapeDirectHardwareHtml(`<img src=x onerror="alert('x')"> &`),
    "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt; &amp;"
  );
});

test("catalog filters cover family-scoped exact finishes and dimensional unknowns", () => {
  const variant = {
    familyId: "family-a",
    finishVariantId: "shared-finish",
    sizeVariantId: "size-a",
    category: "edge_pull",
    canonicalFinishId: "warm-brass",
    priceTier: "premium",
    styles: ["modern", "minimal"],
    family: {
      brandId: "brand-a",
      collectionId: "collection-a",
      regions: ["US", "CA"]
    },
    availability: { status: "active_or_orderable" },
    productStatus: "active",
    assetAccuracy: "dimensionally_accurate_parametric_proxy",
    dimensionsMm: { centerToCenter: 128, overallLength: 154 }
  };
  assert.equal(matchesDirectHardwareFilters(variant, {
    brand: "brand-a",
    collection: "collection-a",
    category: "edge_pull",
    style: "minimal",
    finish: "warm-brass",
    exactFinish: "family-a|shared-finish",
    size: "size-a",
    centerToCenter: "96-160",
    overallLength: "100-200",
    priceTier: "premium",
    availability: "active_or_orderable",
    region: "CA",
    accurate: "accurate"
  }), true);
  assert.equal(matchesDirectHardwareFilters(variant, { exactFinish: "family-b|shared-finish" }), false);
  assert.equal(matchesDirectHardwareFilters({ ...variant, dimensionsMm: { centerToCenter: 0, overallLength: null } }, {
    centerToCenter: "single-hole",
    overallLength: "unknown"
  }), true, "null dimensions must remain unknown instead of coercing to zero");
});

test("placement helpers preserve custom anchors, clamp offsets, and enforce the two-handle width rule", () => {
  assert.deepEqual(normalizeDirectHardwarePlacement({
    orientation: "vertical",
    horizontalAnchor: "custom",
    verticalAnchor: "custom",
    edgeOffsetMm: 999,
    crossAxisOffsetMm: -999,
    mirrored: true,
    quantityPerFront: "2"
  }), {
    orientation: "vertical",
    horizontalAnchor: "custom",
    verticalAnchor: "custom",
    edgeOffsetMm: 304.8,
    crossAxisOffsetMm: -304.8,
    mirrored: true,
    quantityPerFront: 2
  });
  assert.equal(canDirectHardwareHostUseDoublePlacement({ size: { x: 17.99 } }), false);
  assert.equal(canDirectHardwareHostUseDoublePlacement({ size: { x: 18 } }), true);
  assert.equal(getRecommendedDirectHardwarePlacement(
    component("edge-drawer", "drawer_front", "opening", "opening"),
    { category: "tab_pull", compatiblePlacements: ["drawer_top_edge"] }
  ).verticalAnchor, "top");
  assert.equal(getRecommendedDirectHardwarePlacement(
    component("framed-drawer", "drawer_front", "opening", "opening", { profileGeometry: { kind: "framed_panel" } }),
    { category: "t_bar_knob", compatiblePlacements: ["drawer_front"] }
  ).verticalAnchor, "top");
  assert.equal(getRecommendedDirectHardwarePlacement(
    component("framed-drawer", "drawer_front", "opening", "opening", { profileGeometry: { kind: "framed_panel" } }),
    { category: "t_bar_knob", compatiblePlacements: ["drawer_front"] }
  ).orientation, "horizontal");
  assert.equal(getRecommendedDirectHardwarePlacement(
    component("tab-door", "door", "opening", "opening"),
    { category: "tab_pull", compatiblePlacements: ["door_edge"] }
  ).verticalAnchor, "top");
  assert.equal(getRecommendedDirectHardwarePlacement(
    component("cup-door", "door", "opening", "opening", { profileGeometry: { kind: "framed_panel" } }),
    { category: "cup_pull", compatiblePlacements: ["door_horizontal"] }
  ).verticalAnchor, "top");

  const controls = renderDirectHardwarePlacementControls({
    orientation: "vertical",
    horizontalAnchor: "custom",
    verticalAnchor: "custom",
    quantityPerFront: 1
  }, { canUseDouble: false });
  assert.match(controls, /data-placement-field="horizontalAnchor"/);
  assert.match(controls, /value="custom" selected/);
  assert.match(controls, /value="2" disabled/);
  assert.match(controls, /data-reset-placement/);
  assert.match(controls, /min="-304\.8"[^>]*data-placement-field="edgeOffsetMm"/);
  assert.match(renderDirectHardwarePlacementControls({
    orientation: "vertical",
    verticalAnchor: "middle"
  }), /data-placement-field="edgeOffsetMm"[^>]*disabled/);
  assert.doesNotMatch(renderDirectHardwarePlacementControls({
    orientation: "vertical",
    verticalAnchor: "top"
  }), /data-placement-field="edgeOffsetMm"[^>]*disabled/);
  assert.match(renderDirectHardwarePlacementControls({}, { selectable: false }), /fieldset class="direct-hardware-edit__placement" disabled/);
});

test("scoped door placement adapts latch-edge anchoring and mirroring per target handing", () => {
  const source = component("left-leaf", "door", "opening", "opening", { hingeSide: "hinge_left", leafCount: 2, arrangement: "pair" });
  const target = component("right-leaf", "door", "opening", "opening", { hingeSide: "hinge_right", leafCount: 2, arrangement: "pair" });
  const variant = { category: "bar_pull", compatiblePlacements: ["door"] };
  const adapted = adaptDirectHardwarePlacementForHost({
    orientation: "vertical",
    horizontalAnchor: "right",
    verticalAnchor: "middle",
    mirrored: false,
    quantityPerFront: 1
  }, source, target, variant);
  assert.equal(adapted.horizontalAnchor, "left");
  assert.equal(adapted.mirrored, true);

  const custom = adaptDirectHardwarePlacementForHost({
    orientation: "vertical",
    horizontalAnchor: "custom",
    verticalAnchor: "custom",
    mirrored: false,
    quantityPerFront: 1
  }, source, target, variant);
  assert.equal(custom.horizontalAnchor, "custom");
  assert.equal(custom.mirrored, true);
});

test("presentation compatibility recognizes edge, top-edge, horizontal-door, and paired-door catalog tokens", () => {
  const baseVariant = {
    category: "edge_pull",
    categoryLabel: "Edge pull",
    dimensionsMm: { overallLength: 90, width: 12, projection: 20 },
    finish: {},
    family: {},
    recommendedApplications: []
  };
  const drawer = component("drawer", "drawer_front", "opening", "opening");
  const door = component("door", "door", "opening", "opening", { leafCount: 1 });
  const pairedDoor = component("paired", "door", "opening", "opening", { leafCount: 2, arrangement: "pair" });
  assert.notEqual(assessDirectHardwareCompatibility({ ...baseVariant, compatiblePlacements: ["drawer_top_edge"] }, drawer).status, "not_compatible");
  assert.notEqual(assessDirectHardwareCompatibility({ ...baseVariant, compatiblePlacements: ["door_side_edge"] }, door).status, "not_compatible");
  assert.notEqual(assessDirectHardwareCompatibility({ ...baseVariant, category: "cup_pull", compatiblePlacements: ["door_horizontal"] }, door).status, "not_compatible");
  const latch = { ...baseVariant, category: "cabinet_latch", compatiblePlacements: ["paired_door"] };
  assert.equal(assessDirectHardwareCompatibility(latch, door).status, "not_compatible");
  const pairedLatch = assessDirectHardwareCompatibility(latch, pairedDoor);
  assert.equal(pairedLatch.status, "not_compatible");
  assert.match(pairedLatch.warnings[0], /linked body-and-catch/i);
});

test("catalog view propagates release gates and selectable snapshots", () => {
  const catalog = JSON.parse(readFileSync(new URL("../data/hardware/jq-hardware-catalog.seed.json", import.meta.url), "utf8"));
  const index = createHardwareCatalogIndex(catalog);
  const view = createDirectHardwareCatalogView(catalog, index);
  assert.equal(view.families.size, 12);
  assert.equal(view.variants.length, 124);
  const gated = view.variants.filter((variant) => variant.releaseGate);
  assert.equal(gated.length, 12);
  assert.ok(gated.every((variant) => variant.selectable === false && variant.releaseWarnings.length > 0));
  assert.ok(view.variants.some((variant) => variant.selectable === true && variant.releaseGate === false));
});

test("pricing impact prefers exact hardware allowance deltas before rounded project totals", () => {
  assert.deepEqual(resolveDirectHardwarePricingImpact(
    { total: 5000, hardwarePricing: { estimatedDelta: 0 } },
    { total: 5000, hardwarePricing: { estimatedDelta: -2.07 } }
  ), { delta: -2.07, source: "hardware_allowance" });
  assert.deepEqual(resolveDirectHardwarePricingImpact(
    { total: 5000 },
    { total: 5025 }
  ), { delta: 25, source: "project_total" });
});

test("saved variants missing from the current catalog remain factual and nonselectable", () => {
  const saved = createSavedHardwareVariantView({
    variantId: "retired-family__retired-size__retired-finish",
    brandName: "Retained Brand",
    familyName: "Retained Pull",
    collectionName: "Archive",
    category: "bar_pull",
    sizeLabel: "128 mm c.c.",
    finishName: "Archive Bronze",
    finishCode: "AB",
    manufacturerProductNumber: "RET-128-AB",
    dimensionsMm: { centerToCenter: 128, overallLength: 150, width: 10, projection: 28 },
    modelAccuracy: "partial_parametric_proxy",
    sources: [{ id: "retained-source", title: "Retained official source", url: "https://example.com/retained" }]
  });
  assert.equal(saved.id, "retired-family__retired-size__retired-finish");
  assert.equal(saved.familyName, "Retained Pull");
  assert.equal(saved.finishCode, "AB");
  assert.equal(saved.manufacturerProductNumber, "RET-128-AB");
  assert.equal(saved.selectable, false);
  assert.equal(saved.releaseGate, true);
  assert.match(saved.releaseWarnings[0], /no longer present/i);
});

test("history replay merges hardware into the latest accepted non-hardware state", async () => {
  let accepted = {
    width: 120,
    finish: "custom_bm",
    hardwareSelections: { schemaVersion: 1, defaultVariantId: "new", byHostId: { door: { variantId: "new" } } }
  };
  const editor = new DirectHardwareEditor({
    getState: () => accepted,
    getLayout: () => ({ components: [] }),
    getPricing: () => ({}),
    commitState: (state) => {
      accepted = structuredClone(state);
      return { accepted: true, state: accepted, layout: { components: [] }, pricing: {} };
    },
    viewer: { restorePreview() {} }
  });

  const restored = await editor.commitHistoricalState({
    hardwareSelections: { schemaVersion: 1, defaultVariantId: "old", byHostId: {} }
  }, { action: "undo" });
  assert.equal(restored, true);
  assert.equal(accepted.width, 120);
  assert.equal(accepted.finish, "custom_bm");
  assert.equal(accepted.hardwareSelections.defaultVariantId, "old");
});

test("an external accepted update invalidates a stale hardware preview", () => {
  let restored = 0;
  const editor = new DirectHardwareEditor({
    getState: () => ({ width: 110, hardwareSelections: { schemaVersion: 1, defaultVariantId: "current", byHostId: {} } }),
    getLayout: () => ({ components: [] }),
    getPricing: () => ({ total: 100 }),
    viewer: { restorePreview() { restored += 1; } }
  });
  editor.presentation.previewed = true;
  editor.presentation.draft = { accepted: true, state: { width: 96 } };
  editor.presentation.placementDraft = { orientation: "vertical" };

  editor.sync({ source: "external", changedFields: ["width"] });
  assert.equal(editor.presentation.previewed, false);
  assert.equal(editor.presentation.draft, null);
  assert.equal(editor.presentation.placementDraft, null);
  assert.equal(editor.canonicalState.width, 110);
  assert.equal(restored, 1);
});

function createAsyncPreviewFixture({ evaluateCandidate, preview }) {
  const host = component("door-a", "door", "opening", "opening", { style: "flat", mounting: "inset", profileGeometry: { kind: "slab" } });
  const layout = { components: [host] };
  const variant = {
    id: "family__size__finish",
    familyId: "family",
    sizeVariantId: "size",
    finishVariantId: "finish",
    familyName: "Test Pull",
    brandName: "Test Brand",
    collectionName: "Test Collection",
    category: "bar_pull",
    categoryLabel: "Bar Pull",
    compatiblePlacements: ["door"],
    recommendedApplications: ["doors"],
    dimensionsMm: { centerToCenter: 96, overallLength: 112, width: 10, projection: 25 },
    mounting: { holeCount: 2 },
    pricing: { mode: "reference_unit", amount: 20, currency: "USD" },
    selectable: true,
    family: {},
    finish: {},
    assetAccuracy: "dimensionally_accurate_parametric_proxy"
  };
  let state = {
    width: 96,
    hardware: "brass_pull",
    hardwareSelections: { schemaVersion: 1, catalogVersion: "test", defaultVariantId: variant.id, byHostId: {} }
  };
  const viewer = { preview, restorePreview() {} };
  const editor = new DirectHardwareEditor({
    getState: () => state,
    getLayout: () => layout,
    getPricing: () => ({ total: 100, hardwarePricing: { estimatedDelta: 0 } }),
    evaluateCandidate,
    viewer
  });
  editor.catalog = {
    catalogVersion: "test",
    variants: [variant],
    variantsById: new Map([[variant.id, variant]]),
    variantsByFamily: new Map([[variant.familyId, [variant]]]),
    families: new Map([[variant.familyId, {}]])
  };
  editor.catalogApi = { createHardwareVariantSnapshot: () => ({ variantId: variant.id }) };
  editor.catalogApiIndex = {};
  editor.canonicalState = structuredClone(state);
  editor.canonicalLayout = layout;
  editor.canonicalPricing = { total: 100, hardwarePricing: { estimatedDelta: 0 } };
  editor.canonicalRevision = 1;
  editor.presentation.selected = resolveHardwareSelection(layout, host.id);
  return { editor, variant, layout, getState: () => state, setState: (next) => { state = next; } };
}

test("an external sync cancels the first in-flight async preview before it reaches the viewer", async () => {
  let resolveEvaluation;
  let viewerCalls = 0;
  let candidateState;
  const fixture = createAsyncPreviewFixture({
    evaluateCandidate: (state) => {
      candidateState = state;
      return new Promise((resolve) => { resolveEvaluation = resolve; });
    },
    preview: () => { viewerCalls += 1; return true; }
  });
  const pending = fixture.editor.previewVariant(fixture.variant.id);
  fixture.setState({ ...fixture.getState(), width: 120 });
  fixture.editor.sync({ source: "external", changedFields: ["width"] });
  resolveEvaluation({ accepted: true, state: candidateState, layout: fixture.layout, pricing: { total: 100 } });
  assert.equal(await pending, false);
  assert.equal(viewerCalls, 0);
  assert.equal(fixture.editor.presentation.draft, null);
});

test("closing the editor cancels the first in-flight async preview before it reaches the viewer", async () => {
  let resolveEvaluation;
  let viewerCalls = 0;
  let candidateState;
  const fixture = createAsyncPreviewFixture({
    evaluateCandidate: (state) => {
      candidateState = state;
      return new Promise((resolve) => { resolveEvaluation = resolve; });
    },
    preview: () => { viewerCalls += 1; return true; }
  });
  fixture.editor.modelHost = {
    ownerDocument: { activeElement: null },
    querySelector: () => null
  };
  fixture.editor.root = { dataset: { hasSelection: "true" } };
  fixture.editor.elements = {
    quickCard: { hidden: false },
    leader: { hidden: false },
    componentTree: null
  };
  fixture.editor.renderComponentTree = () => {};

  const pending = fixture.editor.previewVariant(fixture.variant.id);
  assert.equal(fixture.editor.close("escape"), true);
  resolveEvaluation({ accepted: true, state: candidateState, layout: fixture.layout, pricing: { total: 100 } });

  assert.equal(await pending, false);
  assert.equal(viewerCalls, 0);
  assert.equal(fixture.editor.presentation.selected, null);
  assert.equal(fixture.editor.presentation.draft, null);
});

test("a renderer rejection never arms Apply for an unrendered preview", async () => {
  let candidateState;
  const fixture = createAsyncPreviewFixture({
    evaluateCandidate: (state) => {
      candidateState = state;
      return { accepted: true, state: candidateState, layout: fixture.layout, pricing: { total: 100 } };
    },
    preview: () => false
  });
  assert.equal(await fixture.editor.previewVariant(fixture.variant.id), false);
  assert.equal(fixture.editor.presentation.previewed, false);
  assert.equal(fixture.editor.presentation.draft, null);
});

test("push-latch fronts do not masquerade as the fallback catalog knob", () => {
  const host = component("push-door", "door", "opening", "opening");
  const layout = { components: [host] };
  const editor = new DirectHardwareEditor();
  editor.catalog = { variantsById: new Map([["fallback-knob", { id: "fallback-knob" }]]), variants: [] };
  editor.presentation.selected = resolveHardwareSelection(layout, host.id);
  editor.canonicalState = {
    hardware: "push_latch",
    hardwareSelections: { defaultVariantId: "fallback-knob", defaultSnapshot: { variantId: "fallback-knob" }, byHostId: {} }
  };
  assert.equal(editor.getCurrentVariantId(), null);
});
