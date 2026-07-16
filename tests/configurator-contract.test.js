import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PROFILE_CAMERA_DURATION } from "../profile-camera.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (name) => readFileSync(`${root}/${name}`, "utf8");
const source = read("configurator-3d.js");
const workflow = read("configurator-experience.js");
const css = read("configurator-experience.css");
const precisionCss = read("configurator-precision.css");
const html = read("configurator.html");
const catalogProvider = read("benjamin-moore-colors.js");
const configSource = read("bookcase-config.js");

function methodBody(name, nextName) {
  const start = source.indexOf(`  ${name}(`);
  const end = source.indexOf(`\n  ${nextName}(`, start + 1);
  assert.notEqual(start, -1, `${name} must exist`);
  assert.notEqual(end, -1, `${nextName} must follow ${name}`);
  return source.slice(start, end);
}

test("the route mounts exactly one configurator host and one persistent viewer surface", () => {
  assert.equal((html.match(/data-bookcase-builder/g) || []).length, 1);
  assert.equal((source.match(/data-3d-viewer tabindex=/g) || []).length, 1);
  assert.equal((source.match(/new BookcaseViewer3D\(/g) || []).length, 1);
  assert.match(source, /this\.viewer = this\.createViewer\(this\.layout\)/);
});

test("the reference workspace owns one stage rail, persistent viewer, properties inspector, organizer, and width card", () => {
  const shell = methodBody("renderFullPageConfigurator", "renderStudioEntryShell");
  const inspector = methodBody("renderInspector", "renderWorkspaceProperties");

  assert.match(shell, /data-unified-configurator data-configurator-workspace/);
  assert.match(shell, /data-workspace-stages aria-label="Configurator stages"/);
  assert.match(shell, /data-properties-inspector data-controls-scroll aria-label="Design properties"/);
  assert.match(shell, /data-section-organizer aria-label="Bookcase sections"/);
  assert.match(shell, /data-total-width-card aria-label="Total width status"/);
  assert.equal((shell.match(/data-inspector-content/g) || []).length, 1);
  assert.equal((shell.match(/data-3d-viewer tabindex=/g) || []).length, 1);
  assert.doesNotMatch(shell, /data-contextual-editor|data-context-leader|preview-control-dock|data-viewer-zoom|data-view="/);
  assert.match(shell, /data-reset-view aria-label="Reset model view"/);
  assert.doesNotMatch(shell, /data-mode-panel|data-configurator-mode|configurator-step-rail|data-category-trigger/);
  assert.match(inspector, /inspectorContent\.innerHTML = this\.renderWorkspaceProperties\(\)/);
  assert.match(inspector, /sectionOrganizerContent\.innerHTML = this\.renderSectionOrganizer\(\)/);
  assert.match(inspector, /totalWidthContent\.innerHTML = this\.renderTotalWidthCard\(\)/);
  assert.match(inspector, /this\.captureWorkspaceFocus\(\)/);
  assert.match(inspector, /this\.restoreWorkspaceFocus\(focusedControl\)/);
  assert.doesNotMatch(inspector, /viewer\.innerHTML|host\.innerHTML|createViewer|new BookcaseViewer3D|viewer\.update/);
});

test("the compact model toolbar exposes global history, display toggles, interaction tools, and fullscreen", () => {
  const shell = methodBody("renderFullPageConfigurator", "renderStudioEntryShell");
  for (const hook of [
    "data-history-undo",
    "data-history-redo",
    "data-toggle-dimensions",
    "data-toggle-wall",
    'data-model-tool="pan"',
    'data-model-tool="select"',
    "data-model-fullscreen"
  ]) assert.ok(shell.includes(hook), `${hook} must be rendered in the model toolbar`);
  assert.equal((shell.match(/data-history-undo/g) || []).length, 1);
  assert.equal((shell.match(/data-history-redo/g) || []).length, 1);
  assert.equal((shell.match(/data-model-fullscreen/g) || []).length, 1);
  assert.match(shell, /class="workspace-model-toolbar" data-model-toolbar/);
  assert.match(shell, /class="workspace-viewer-room" data-viewer-room/);
  assert.match(source, /this\.viewer\.setInteractionTool\?\.\(this\.activeTool\)/);
  assert.match(source, /this\.viewer\.setDimensionsVisible\?\.\(this\.showDimensions\)/);
  assert.match(source, /this\.viewer\.setWallVisible\?\.\(this\.showWall\)/);
  assert.match(source, /document\.addEventListener\("fullscreenchange"/);
  for (const viewerMethod of ["setInteractionTool", "setDimensionsVisible", "setWallVisible"]) {
    assert.equal((source.match(new RegExp(`  ${viewerMethod}\\(`, "g")) || []).length, 1);
  }
});

test("stage navigation and model selection route the fixed properties inspector without mutating design state", () => {
  const stage = methodBody("activateWorkspaceStage", "snapshotDesignState");
  const select = methodBody("handleModelSelection", "renderContextEditor");
  const close = methodBody("closeContextEditor", "bindEvents");

  assert.match(stage, /this\.activeStageId = stageId/);
  assert.match(stage, /this\.activeInspectorGroup = STAGE_CONTROL_GROUPS\[stageId\]/);
  assert.match(stage, /this\.renderInspector\(/);
  assert.match(select, /this\.selection = selection/);
  assert.match(select, /resolveWorkspaceSelection\(selection, this\.layout\)/);
  assert.match(select, /this\.activeStageId = workspaceRoute/);
  assert.match(select, /this\.activeInspectorTabId = "general"/);
  assert.match(select, /this\.renderInspector\(/);
  assert.match(close, /this\.selection = null/);
  for (const presentationOnly of [stage, select, close]) {
    assert.doesNotMatch(
      presentationOnly,
      /this\.update\(|viewer\.update|evaluateBookcaseCandidate|calculateBookcasePrice|createViewer|new BookcaseViewer3D/
    );
  }
});

test("projected model section labels remain pointer and keyboard selectable", () => {
  assert.match(source, /data-overlay-section-select="\$\{index\}" aria-label="Select Section \$\{index \+ 1\}"/);
  assert.match(precisionCss, /section-designer-overlay button\.dimension-label\s*\{[^}]*pointer-events:\s*auto;/s);
  assert.match(precisionCss, /section-designer-overlay button\.dimension-label:focus-visible/);
});

test("section Storage steppers keep 44-pixel portrait and landscape phone targets", () => {
  assert.match(precisionCss, /@media \(max-width: 767px\)[\s\S]*workspace-storage-stepper \.workspace-number-stepper\s*\{[^}]*grid-template-columns:\s*44px minmax\(44px, 1fr\) 44px auto;/);
  assert.match(precisionCss, /@media \(min-width: 768px\) and \(max-width: 950px\) and \(orientation: landscape\) and \(max-height: 500px\)[\s\S]*workspace-storage-stepper \.workspace-number-stepper\s*\{[^}]*grid-template-columns:\s*44px minmax\(44px, 1fr\) 44px auto;/);
});

test("one delegated action path owns Save Design and Request Quote", () => {
  assert.equal((source.match(/handleSaveAction\(\) \{/g) || []).length, 1);
  assert.equal((source.match(/handleQuoteAction\(\) \{/g) || []).length, 1);
  assert.equal((source.match(/saveCurrentDesign\(\) \{/g) || []).length, 1);
  assert.equal((source.match(/openQuotePage\(\) \{/g) || []).length, 1);
  assert.match(source, /openQuotePage\(\) \{[\s\S]*this\.saveCurrentDesign\(\)[\s\S]*window\.location\.assign/);
  assert.match(source, /if \(!design\.persisted\)[\s\S]*blocked local design storage[\s\S]*return false/);
});

test("one accepted edit pipeline serves inspector and contextual edits after the explicit studio commit", () => {
  assert.equal((source.match(/update\(nextState, options = \{\}\) \{/g) || []).length, 1);
  assert.equal((source.match(/this\.viewer\.update\(state, evaluation\.layout\)/g) || []).length, 1);
  assert.match(source, /const evaluation = evaluateBookcaseCandidate\(nextState\)/);
  const entryCommit = methodBody("acceptStudioDesign", "initializeCabinetAr");
  assert.match(entryCommit, /evaluateBookcaseCandidate\(config\)/);
  assert.match(entryCommit, /this\.acceptedEvaluation = evaluation/);
  assert.match(entryCommit, /this\.pricing = evaluation\.pricing/);
  assert.match(entryCommit, /this\.createViewer\(this\.layout\)/);
  assert.doesNotMatch(source, /guidedPrice|allControlsPrice|guidedState|allControlsState/);
});

test("the cached shared total feeds estimate, review, Save, and Quote without surface-specific arithmetic", () => {
  const review = methodBody("renderReviewContent", "renderPresetMini");
  const summary = methodBody("updatePriceAndSummary", "setOptionalText");
  const save = methodBody("saveCurrentDesign", "openQuotePage");
  const quote = methodBody("openQuotePage", "showStatus");

  assert.match(review, /formatPrice\(this\.price\)/);
  assert.match(summary, /const price = this\.price/);
  assert.match(save, /createAcceptedDesignSnapshot\(this\.acceptedEvaluation\)/);
  assert.match(quote, /this\.saveCurrentDesign\(\)/);
  assert.doesNotMatch(`${review}\n${summary}\n${save}\n${quote}`, /calculateBookcasePrice|buildPricingContext|evaluateBookcaseCandidate/);
});

test("the reference workspace has complete navigation, toolbar, one-card Properties, organizer, and live-region semantics", () => {
  const shell = methodBody("renderFullPageConfigurator", "renderStudioEntryShell");
  const properties = methodBody("renderWorkspaceProperties", "getSelectedSectionState");
  const organizer = methodBody("renderSectionOrganizer", "renderTotalWidthCard");

  assert.match(shell, /<nav[^>]*aria-label="Configurator stages"/);
  assert.match(shell, /role="group" aria-label="Design history"/);
  assert.match(shell, /role="group" aria-label="Model display"/);
  assert.match(shell, /role="group" aria-label="Model interaction tool"/);
  assert.match(shell, /aria-keyshortcuts="Control\+Z Meta\+Z"/);
  assert.match(shell, /aria-roledescription="interactive 3D configurator"/);
  assert.match(shell, /data-selection-live role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(properties, /class="workspace-properties-panel" role="region"/);
  assert.match(properties, /aria-label="\$\{escapeHtml\(title\)\} controls"/);
  assert.match(properties, /this\.renderWorkspacePropertiesContent\(selectedSection\)/);
  assert.doesNotMatch(properties, /role="tablist"|role="tab"|role="tabpanel"|data-inspector-tab|aria-controls=/);
  assert.match(properties, /data-close-selection aria-label="Clear model selection"/);
  assert.match(organizer, /role="group" aria-label="Section organizer"/);
  assert.match(organizer, /aria-pressed=/);
  assert.match(organizer, /class="workspace-section-card-actions" role="group" aria-label="Section/);
  assert.match(organizer, /aria-label="Duplicate Section/);
  assert.match(organizer, /aria-label="Delete Section/);
  assert.match(source, /data-validation-field="customPaintColor"/);
  assert.match(source, /\[data-field\], \[data-validation-field\]/);
  assert.doesNotMatch(shell, /data-configurator-mode|data-mode-panel|data-appearance-tab|aria-modal="false"/);
});

test("the workspace exposes exactly eight directly reachable stages in reference order", () => {
  const stageContract = workflow.slice(
    workflow.indexOf("export const WORKSPACE_STAGES"),
    workflow.indexOf("export const STAGE_CONTROL_GROUPS")
  );
  const stages = [...stageContract.matchAll(/\{ id: "([^"]+)", label: "([^"]+)", subtitle: "([^"]+)", icon: "([^"]+)" \}/g)];
  assert.deepEqual(stages.map((match) => match[1]), [
    "space",
    "layout",
    "storage",
    "base_top",
    "finish",
    "hardware",
    "lighting",
    "preview"
  ]);
  assert.deepEqual(stages.map((match) => match[2]), [
    "Space",
    "Layout",
    "Storage",
    "Base & Top",
    "Finish",
    "Hardware",
    "Lighting",
    "Preview"
  ]);
  assert.equal(stages.length, 8);
  assert.ok(stages.every((match) => match[3] && match[4]), "every stage needs concise copy and an icon");

  assert.match(workflow, /space: Object\.freeze\(\["overall_size"\]\)/);
  assert.match(workflow, /layout: Object\.freeze\(\["sections_layout"\]\)/);
  assert.match(workflow, /storage: Object\.freeze\(\["shelves", "storage_fronts"\]\)/);
  assert.match(workflow, /base_top: Object\.freeze\(\["base_crown"\]\)/);
  const rail = methodBody("renderWorkspaceStageRail", "renderFullPageConfigurator");
  assert.match(rail, /WORKSPACE_STAGES\.map\(\(stage, index\)/);
  assert.match(rail, /data-workspace-stage="\$\{escapeHtml\(stage\.id\)\}"/);
  assert.match(rail, /aria-current="location"/);
  assert.match(rail, /workspace-stage-state" aria-hidden="true">\$\{index \+ 1\}/);
  assert.doesNotMatch(rail, /complete \? builderIcons\.check|is-complete/);
  assert.doesNotMatch(source, /data-guided-(?:back|continue)|data-mode-panel|data-configurator-mode|configurator-step-rail/);
  assert.doesNotMatch(workflow, /CONFIGURATOR_MODES|GUIDED_STEPS|ALL_CONTROL_CATEGORIES/);
});

test("selected sections feed the same one-card stage console without accepted-workspace tabs", () => {
  const properties = methodBody("renderWorkspacePropertiesContent", "renderLayoutConsole");
  assert.doesNotMatch(source, /getWorkspaceInspectorTabs\(|data-inspector-tab=/);
  assert.match(properties, /if \(this\.selection\)/);
  assert.match(properties, /editorId === "back"\) return this\.renderBackPanelSummary\(\)/);
  assert.match(properties, /editorId === "body"\) return this\.renderSpaceGroup\(\)/);
  assert.match(properties, /this\.activeStageId === "storage"\) return this\.renderStorageConsole\(selectedSection\)/);
  assert.match(properties, /groups\.map\(\(groupId\) => this\.renderControlGroup\(groupId, "properties"\)\)/);
  assert.equal((source.match(/renderControlGroup\(groupId, surface = "inspector"\) \{/g) || []).length, 1);
  assert.doesNotMatch(methodBody("renderFullPageConfigurator", "renderStudioEntryShell"), /data-contextual-editor|data-context-leader/);
});

test("Layout, Storage, and Base & Top each route to one dedicated Properties card", () => {
  const properties = methodBody("renderWorkspacePropertiesContent", "renderLayoutConsole");
  assert.match(properties, /this\.activeStageId === "layout"\) return this\.renderLayoutConsole\(\)/);
  assert.match(properties, /this\.activeStageId === "storage"\) return this\.renderStorageConsole\(selectedSection\)/);
  assert.match(properties, /this\.activeStageId === "base_top"\) return this\.renderStructureGroup\(\)/);
  assert.doesNotMatch(properties, /activeTab|renderLayoutCards|renderStorageFrontsGroup/);
});

test("the organizer projects accepted sections and the width card reports canonical overall width", () => {
  const organizer = methodBody("renderSectionOrganizer", "renderTotalWidthCard");
  const totalWidth = methodBody("renderTotalWidthCard", "renderControlGroup");
  assert.match(organizer, /createSectionOrganizerSummary\(this\.state, this\.layout\)/);
  assert.match(organizer, /addSection\(this\.state, this\.layout, this\.selectedSectionIndex\)/);
  assert.match(organizer, /data-section-add/);
  assert.match(organizer, /organizer\.items\.map\(\(section\)/);
  assert.match(organizer, /data-section-select="\$\{section\.index\}"/);
  assert.match(organizer, /data-section-duplicate="\$\{section\.index\}"/);
  assert.match(organizer, /data-section-delete="\$\{section\.index\}"/);
  assert.match(organizer, /class="workspace-section-card-actions"/);
  assert.match(organizer, /class="workspace-section-duplicate"/);
  assert.match(organizer, /class="workspace-section-delete"/);
  assert.doesNotMatch(organizer, /<details|<summary|workspace-section-menu/);
  assert.match(organizer, /duplicateSection\(this\.state, this\.layout, section\.index\)/);
  assert.match(organizer, /deleteSection\(this\.state, this\.layout, section\.index\)/);
  assert.match(organizer, /addAvailability\.accepted/);
  assert.match(organizer, /duplicateAvailability\.accepted/);
  assert.match(organizer, /deleteAvailability\.accepted/);
  assert.match(totalWidth, /validateUnifiedConfiguration\(this\.state, this\.layout, this\.drafts, \{ groupId: "overall_size" \}\)/);
  assert.match(totalWidth, /formatSectionWidth\(this\.state\.width\)/);
  assert.match(totalWidth, /Valid overall width/);
  assert.doesNotMatch(`${organizer}\n${totalWidth}`, /reduce\(|calculateBookcasePrice|evaluateBookcaseCandidate/);
});

test("rejected engine and renderer candidates cannot replace accepted state or pricing", () => {
  const update = methodBody("update", "renderDoorOptions");
  const engineRejection = update.indexOf("if (!evaluation.accepted)");
  const viewerCommit = update.indexOf("this.viewer.update(state, evaluation.layout)");
  const rendererRejection = update.indexOf("if (rendered === false)");
  const acceptedCommit = update.indexOf("this.acceptedEvaluation = committedEvaluation");

  assert.notEqual(engineRejection, -1);
  assert.notEqual(viewerCommit, -1);
  assert.notEqual(rendererRejection, -1);
  assert.notEqual(acceptedCommit, -1);
  assert.ok(engineRejection < viewerCommit, "engine rejection must precede any viewer mutation");
  assert.ok(rendererRejection < acceptedCommit, "renderer rejection must precede accepted-state mutation");
  assert.match(update.slice(engineRejection, viewerCommit), /return false/);
  assert.match(update.slice(rendererRejection, acceptedCommit), /return false/);
  assert.ok(update.indexOf("this.price = this.pricing.total") > acceptedCommit);
});

test("Door styles use builder-specific illustrated cards without the shared option-card collision", () => {
  const doors = methodBody("renderDoorGroup", "renderServiceGroup");
  assert.match(doors, /class="door-style-grid"/);
  assert.match(doors, /class="door-style-card"/);
  assert.match(doors, /doorPreviewIcons\[option\.value\]/);
  assert.doesNotMatch(doors, /class="option-card/);
  assert.doesNotMatch(doors, /Furniture-grade cabinet front/);
});

test("door quantity is a generated output and cannot drift from physical openings", () => {
  const doors = methodBody("renderDoorGroup", "renderServiceGroup");
  const sync = methodBody("renderDoorOptions", "syncControls");
  assert.match(doors, /data-generated-door-count/);
  assert.doesNotMatch(doors, /data-field="doorCount"|data-door-options/);
  assert.match(sync, /getApplicability\(this\.state, this\.layout\)\.generatedDoorCount/);
  assert.match(workflow, /field: "doorCount"[^\n]*access: "derived"/);
});

test("Storage exposes one accessible independent-section editor with conditional details", () => {
  const storage = methodBody("renderStorageConsole", "renderBackPanelSummary");
  const events = methodBody("bindEvents", "handleDelegatedClick");
  const click = methodBody("handleDelegatedClick", "activateWorkspaceStage");
  const commit = methodBody("commitSelectedSectionStorage", "commitSelectedSectionWidth");
  assert.match(storage, /class="workspace-storage-console" data-storage-console/);
  assert.match(storage, /data-selected-section-id="\$\{escapeHtml\(selected\.stableId \|\| selected\.id\)\}"/);
  assert.match(storage, /Section \$\{selected\.index \+ 1\} of \$\{designer\.sections\.length\}/);
  assert.match(storage, /data-storage-section-step="-1"/);
  assert.match(storage, /data-storage-section-step="1"/);
  assert.match(storage, /<strong>Each section is independent\.<\/strong>/);
  for (const label of ["Open Shelves", "Lower Doors + Shelves", "Lower Drawers + Shelves", "Full Doors", "Glass Display"]) {
    assert.match(source, new RegExp(`label: "${label.replaceAll("+", "\\+")}"`));
  }
  assert.match(storage, /sectionStoragePresets\.map/);
  assert.match(storage, /data-section-storage-preset="\$\{preset\.id\}"/);
  assert.match(storage, /renderStorageStepper\("shelfCount", "Shelf count", selected\.shelfCount, 0, 8\)/);
  assert.match(storage, /Evenly spaced automatically/);
  assert.doesNotMatch(storage, /data-section-storage-field="shelfDistribution"/);
  assert.match(storage, /usesDoors \|\| usesDrawers \? `<section class="workspace-storage-detail workspace-storage-fronts/);
  assert.match(storage, /usesDoors \? "workspace-storage-doors" : "workspace-storage-drawers"/);
  assert.match(storage, /renderStyleSelect\("doorStyle"/);
  assert.match(storage, /data-section-storage-field="doorArrangement"/);
  assert.match(storage, /renderStorageStepper\("drawerCount", "Drawer count", selected\.drawerCount, 1, 5\)/);
  assert.match(storage, /renderStyleSelect\("drawerFrontStyle"/);
  assert.match(storage, /renderStorageStepper\("lowerStorageHeight", "Cabinet height", selected\.lowerStorageHeight, 24, 42, 0\.25, "in"\)/);
  assert.ok(storage.indexOf("workspace-storage-fronts") < storage.indexOf("workspace-storage-shelves"));
  assert.match(storage, /Global · all sections/);
  assert.match(storage, /renderRangeControl\("shelfThickness", "Shelf thickness", 0\.75, 2, 0\.25, "in"\)/);
  assert.doesNotMatch(storage, /renderStepperControl\("shelves"|renderDoorGroup\(|data-field="drawerCount"/);
  assert.match(events, /data-section-storage-preset/);
  assert.match(events, /data-section-storage-field/);
  assert.match(click, /data-storage-section-step/);
  assert.match(click, /data-section-storage-step/);
  assert.match(commit, /setSectionStorageConfiguration\(this\.state, this\.selectedSectionIndex, patch, this\.layout\)/);
  assert.match(precisionCss, /\.workspace-storage-preset-grid/);
  assert.match(precisionCss, /\.workspace-storage-detail-fields/);
  assert.match(precisionCss, /@media \(max-width: 767px\)[\s\S]*\.workspace-storage-section-nav button[\s\S]*min-height: 44px/);
});

test("the unified Hardware stage explains when no generated front uses hardware", () => {
  const hardware = methodBody("renderHardwareGroup", "renderLightingGroup");
  assert.match(hardware, /data-hardware-empty-state/);
  assert.match(hardware, /data-workspace-stage-link="storage"/);
  assert.match(hardware, /const hasHardwareHosts = applicability\.showHardware/);
  assert.match(hardware, /No hardware quantity yet/);
  assert.match(hardware, /data-hardware-type/);
  assert.match(hardware, /data-hardware-finish/);
  assert.match(hardware, /hardware-library-button[^>]*\$\{hasHardwareHosts \? "" : `disabled/);
  assert.doesNotMatch(hardware, /control-section-hardware" data-applicability="hardware"/);
});

test("section steppers use buildable counts and the viewer never retains stale geometry", () => {
  const stepper = methodBody("handleStepperClick", "update");
  const controls = methodBody("syncControls", "syncDraftInputs");
  const rebuild = methodBody("rebuildModel", "updateCamera");
  assert.match(stepper, /allowedSectionCounts/);
  assert.match(controls, /data-section-limit/);
  assert.match(controls, /decrement\.disabled/);
  assert.doesNotMatch(rebuild, /if \(!this\.lastLayout\.validation\.valid\)[\s\S]*return/);
  assert.match(rebuild, /this\.scene\.remove\(this\.model\)[\s\S]*this\.model = nextModel/);
});

test("section operations respect build limits and feed the single global physical-design history", () => {
  const designer = methodBody("renderSectionDesignerGroup", "renderDoorGroup");
  const commit = methodBody("commitSectionOperation", "undoSectionChange");
  const undo = methodBody("undoSectionChange", "redoSectionChange");
  const redo = methodBody("redoSectionChange", "refreshSectionDesignerPresentation");
  const globalUndo = methodBody("undoDesignChange", "redoDesignChange");
  const globalRedo = methodBody("redoDesignChange", "syncWorkspaceToolbar");
  const update = methodBody("update", "renderDoorOptions");
  const dragStart = methodBody("beginRangeDrag", "updateRangeDrag");
  const dragEnd = methodBody("endRangeDrag", "applyRangePointerValue");

  assert.match(designer, /const splitDisabled = selected\.locked \|\| designer\.sections\.length >= this\.layout\.rules\.maxSections/);
  assert.match(designer, /const splitTooNarrow = selected\.width \+ 1e-6 < splitMinimumWidth/);
  assert.match(designer, /Splitting requires room for two/);
  assert.match(designer, /splitDisabled \? `disabled aria-describedby=/);
  assert.match(commit, /this\.update\(operation\.config, \{ sourceField: "layoutMetadata"/);
  assert.match(commit, /this\.renderInspector\(\);[\s\S]*this\.syncInterface\(\);[\s\S]*this\.showSectionDesignerError\(error\)/);
  assert.match(commit, /const requestedSelection = Number\.isInteger\(options\.selectedIndex\)/);
  assert.match(commit, /this\.selectSection\(requestedSelection, \{ openProperties: true, render: false, ensureFramed: true \}\)/);
  assert.ok(
    commit.indexOf("this.selectSection(requestedSelection") < commit.indexOf("this.refreshSectionDesignerPresentation()"),
    "the accepted section must become the inspector and organizer selection before presentation refreshes"
  );
  assert.match(undo, /return this\.undoDesignChange\(\)/);
  assert.match(redo, /return this\.redoDesignChange\(\)/);
  assert.match(globalUndo, /this\.designHistory\.undo\.pop\(\)/);
  assert.match(globalUndo, /recordHistory: false, historyReplay: true/);
  assert.match(globalUndo, /this\.designHistory\.redo\.push\(current\)/);
  assert.match(globalRedo, /this\.designHistory\.redo\.pop\(\)/);
  assert.match(globalRedo, /this\.designHistory\.undo\.push\(current\)/);
  assert.match(update, /if \(options\.recordHistory !== false\)/);
  assert.ok(update.indexOf("if (rendered === false)") < update.indexOf("this.recordDesignHistory(previousSnapshot)"));
  assert.match(dragStart, /startSnapshot: this\.snapshotDesignState\(\)/);
  assert.match(dragEnd, /if \(changed\)[\s\S]*this\.recordDesignHistory\(startSnapshot\)/);
  assert.doesNotMatch(source, /sectionUndoStack|sectionRedoStack|createSectionHistorySnapshot|applySectionHistorySnapshot/);
});

test("service and derived metadata updates never rebuild unchanged 3D geometry", () => {
  const partial = methodBody("applyPartialUpdate", "applyFinishMaterials");
  assert.match(partial, /nonVisualFields = new Set\(\["layoutPreset", "doorCount", "installation", "delivery"\]\)/);
  assert.match(partial, /every\(\(field\) => nonVisualFields\.has\(field\)\)/);
});

test("the entry has one direct start and three presentation-only selectors with no routes or idea library", () => {
  const shell = methodBody("renderStudioEntryShell", "renderStudioEntryCopyContent");
  const entry = methodBody("renderStudioEntryContent", "renderStudioIntroPreview");
  const preview = methodBody("renderStudioIntroPreview", "renderInspector");
  const motion = methodBody("startStudioPreviewMotion", "stopStudioPreviewMotion");
  const selection = methodBody("setStudioPreview", "handleStudioStart");
  const start = methodBody("handleStudioStart", "acceptStudioDesign");
  assert.equal((entry.match(/data-studio-start/g) || []).length, 1);
  assert.match(entry, /<h1[^>]*><span>Design any bookcase\.<\/span>\s*<em>Your vision, your way\.<\/em><\/h1>/);
  assert.match(entry, /data-studio-start><span>Start Building Your Bookcase<\/span>/);
  assert.match(shell, /data-price>Your project estimate will appear as you build<\/strong>/);
  assert.match(shell, /class="studio-preview-variants" role="group" aria-label="Preview different bookcase arrangements"/);
  assert.match(shell, /getStudioPreviewIdeas\(\)\.map\(\(idea, index\) =>[\s\S]*data-studio-preview-index="\$\{index\}"[\s\S]*aria-pressed=/);
  assert.match(preview, /data-studio-preview-idea="\$\{escapeHtml\(idea\.id\)\}"/);
  assert.match(preview, /this\.renderPresetMini\(idea, 1\)/);
  assert.match(preview, /idea\.callouts\.map\(\(callout\) =>/);
  assert.match(preview, /data-studio-preview-callout="\$\{escapeHtml\(callout\.id\)\}"/);
  assert.match(preview, /style="--studio-callout-y: \$\{escapeHtml\(callout\.y\)\}"/);
  assert.match(preview, /builderIcons\[callout\.icon\] \|\| builderIcons\.check/);
  assert.match(preview, /<small>\$\{escapeHtml\(callout\.label\)\}<\/small>/);
  assert.doesNotMatch(preview, /Add section|Resize any section/);
  assert.doesNotMatch(
    `${shell}\n${entry}\n${preview}`,
    /data-studio-route|data-studio-back|data-studio-dimension|data-idea-id|data-idea-filter|data-view-all-ideas|data-studio-preview-dot|studio-preview-dots|studio-preview-dot|studio-entry-locked-actions/
  );
  assert.match(motion, /prefers-reduced-motion: reduce/);
  assert.match(motion, /window\.setInterval\([\s\S]*this\.setStudioPreview\(\(this\.introPreviewIndex \+ 1\) % previewIdeas\.length, \{ manual: false \}\)[\s\S]*3600/);
  assert.match(selection, /if \(options\.manual\) this\.stopStudioPreviewMotion\(true\)/);
  assert.match(selection, /studioIntroPreview\.innerHTML = this\.renderStudioIntroPreview\(\)/);
  assert.match(selection, /setAttribute\("aria-pressed", String\(Number\(button\.dataset\.studioPreviewIndex\) === this\.introPreviewIndex\)\)/);
  assert.match(start, /createNeutralCustomConfig\(\{ \.\.\.STUDIO_PROVISIONAL_DIMENSIONS, sections: selectedSections \}\)/);
  assert.match(start, /this\.acceptStudioDesign\(startingPoint\.config, \{ source: "custom" \}\)/);
});

test("accepted Layout remains custom-first without a preset gallery", () => {
  const properties = methodBody("renderWorkspacePropertiesContent", "renderLayoutConsole");
  const layout = methodBody("renderLayoutConsole", "renderStorageConsole");
  assert.match(properties, /this\.activeStageId === "layout"\) return this\.renderLayoutConsole\(\)/);
  assert.match(layout, /class="workspace-layout-console" data-layout-console/);
  assert.doesNotMatch(`${properties}\n${layout}`, /renderLayoutCards|data-preset-id|foundation|Ideas|filterInspirationIdeas/);
});

test("accepted one-card stages separate Space, Layout, Storage, and Base & Top concerns", () => {
  const space = methodBody("renderSpaceGroup", "renderStructureStartGroup");
  const layout = methodBody("renderLayoutConsole", "renderStorageConsole");
  const storage = methodBody("renderStorageConsole", "renderBackPanelSummary");
  const construction = methodBody("renderStructureGroup", "renderFinishGroup");
  assert.match(space, /renderRangeControl\("width"/);
  assert.doesNotMatch(space, /renderRangeControl\("shelves"|renderRangeControl\("shelfThickness"/);
  assert.match(layout, /renderStepperControl\("sections"/);
  assert.match(layout, /data-section-width/);
  assert.doesNotMatch(layout, /data-section-type|renderStepperControl\("shelves"|data-field="baseStyle"/);
  assert.match(storage, /renderStorageStepper\("shelfCount"/);
  assert.match(storage, /renderRangeControl\("shelfThickness"/);
  assert.match(storage, /renderStyleSelect\("doorStyle"/);
  assert.match(storage, /renderStorageStepper\("drawerCount"/);
  assert.doesNotMatch(storage, /renderRangeControl\("width"|data-field="baseStyle"|data-field="crownStyle"/);
  assert.match(construction, /data-field="baseStyle"/);
  assert.match(construction, /data-field="crownStyle"/);
  assert.doesNotMatch(construction, /shelfThickness|lowerCabinets|doorStyle/);
});

test("Structure is an inline overview grid with selected detail and disclosed advanced actions", () => {
  const structure = methodBody("renderSectionDesignerGroup", "renderDoorGroup");
  assert.match(structure, /class="section-overview-grid" data-section-overview/);
  assert.match(structure, /class="section-overview-card/);
  assert.match(structure, /aria-pressed=/);
  assert.match(structure, /class="section-selected-mark"/);
  assert.match(structure, /class="section-inspector"/);
  assert.match(structure, /<details class="section-actions-disclosure"/);
  assert.doesNotMatch(structure, /section-strip|carousel|data-section-designer-close|>Done</);
  assert.match(css, /\.section-overview-grid \{[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(css, /\.section-overview-grid \{[\s\S]*overflow: visible;/);
});

test("the unified Layout group exposes the one-card console and guards precision focus", () => {
  const controls = methodBody("renderControlGroup", "renderShelvesGroup");
  assert.match(controls, /groupId === "sections_layout"\) return this\.renderLayoutConsole\(\)/);
  assert.doesNotMatch(controls, /renderLayoutCards|renderStructureStartGroup/);
  const widthCommit = methodBody("commitSelectedSectionWidth", "commitSectionDividerResize");
  assert.match(widthCommit, /rawValue === "" \|\| !Number\.isFinite\(targetWidth\)/);
  assert.match(widthCommit, /Enter a valid clear section width/);
  const viewerControls = methodBody("bindControls", "setView");
  assert.match(viewerControls, /event\.target !== this\.root[\s\S]*?\[data-section-overlay\]/);
  const update = methodBody("update", "renderDoorOptions");
  assert.doesNotMatch(update, /focusedHardwareInput/);
  assert.match(source, /captureWorkspaceFocus\(\)[\s\S]*restoreWorkspaceFocus\(snapshot\)/);
  assert.match(update, /this\.selectedSectionIndex = clamp\(this\.selectedSectionIndex/);
});

test("Structure and Storage subsection headings override the retired dark-panel heading color", () => {
  assert.match(css, /\.configurator-panel \.control-section \.section-overview-heading h3/);
  assert.match(css, /\.configurator-panel \.control-section \.storage-control-group > header h3/);
  assert.match(css, /font-size: 17px;[\s\S]*text-transform: none;/);
});

test("door and drawer front profiles render as independent compatible selectors", () => {
  const fronts = methodBody("renderDoorGroup", "renderServiceGroup");
  assert.match(fronts, /renderProfiles\("doorStyle", doorStyleOptions, "door"\)/);
  assert.match(fronts, /renderProfiles\("drawerFrontStyle", drawerFrontStyleOptions, "drawer"\)/);
  assert.match(fronts, />Door front profile</);
  assert.match(fronts, />Drawer front profile</);
  assert.doesNotMatch(fronts, /renderProfiles\("drawerFrontStyle", doorStyleOptions/);
});

test("Hardware separates geometry type from valid finishes but commits one canonical variant", () => {
  const hardware = methodBody("renderHardwareGroup", "renderLightingGroup");
  const commit = methodBody("commitHardwareSelection", "handleFieldInput");
  assert.match(hardware, /data-hardware-type/);
  assert.match(hardware, /data-hardware-finish/);
  assert.equal((hardware.match(/class="hardware-selected-mark"/g) || []).length, 2);
  assert.match(hardware, /getHardwareFinishesForType\(currentType\)/);
  assert.match(hardware, />Type</);
  assert.match(hardware, />Finish</);
  assert.doesNotMatch(hardware, /data-field="hardware"|hardwareOptions\.map/);
  assert.match(commit, /resolveHardwareVariant\(\{ \.\.\.currentSelection, \.\.\.selection \}, this\.state\.hardware\)/);
  assert.match(commit, /hardware: variant\.value/);
  assert.match(commit, /const existingSelections = this\.state\.hardwareSelections/);
  assert.match(commit, /byHostId: \{ \.\.\.\(existingSelections\.byHostId \|\| \{\}\) \}/);
  assert.match(commit, /\.\.\.\(existingSelections\.migrationWarnings \|\| \[\]\)/);
  assert.doesNotMatch(commit, /focusCameraForField|viewer\.focus/);
  assert.match(css, /\.hardware-type-grid/);
  assert.match(css, /\.hardware-finish-grid/);
});

test("organizer exposes direct section actions while section mutations preserve one selected Properties context", () => {
  const events = methodBody("bindEvents", "handleDelegatedClick");
  const click = methodBody("handleDelegatedClick", "activateWorkspaceStage");
  const commit = methodBody("commitSectionOperation", "undoSectionChange");

  assert.doesNotMatch(events, /workspace-section-menu|openMenu/);
  assert.doesNotMatch(click, /workspace-section-menu|activeSectionMenu/);
  assert.match(click, /target\.closest\?\.\("\[data-section-duplicate\]"\)/);
  assert.match(click, /target\.closest\?\.\("\[data-section-delete\]"\)/);
  assert.match(events, /window\.addEventListener\("pagehide"[\s\S]*if \(!event\.persisted\) this\.destroy\(\)[\s\S]*\{ signal \}/);
  const destroy = source.slice(
    source.indexOf("  destroy() {", source.indexOf("class BookcaseConfigurator")),
    source.indexOf("class BookcaseViewer3D")
  );
  assert.match(destroy, /this\.eventAbortController\?\.abort\(\)/);

  for (const operation of ["addSection", "duplicateSection", "deleteSection"]) {
    assert.match(click, new RegExp(`const operation = ${operation}\\(`));
  }
  assert.match(click, /operation\.reflowed[\s\S]*All clear widths were rebalanced[\s\S]*selectedIndex: operation\.selectedSectionIndex/);
  assert.match(click, /duplicated\.`, \{ selectedIndex: operation\.selectedSectionIndex \}/);
  assert.match(click, /operation\.reflowed[\s\S]*Remaining clear widths were rebalanced[\s\S]*selectedIndex: operation\.selectedSectionIndex/);
  assert.match(commit, /this\.selectSection\(requestedSelection, \{ openProperties: true, render: false, ensureFramed: true \}\)/);
});

test("Review expands canonical hardware into explicit customer-facing type and finish rows", () => {
  assert.match(workflow, /label: "Hardware type"/);
  assert.match(workflow, /label: "Hardware finish"/);
  assert.match(workflow, /getHardwareType\(state\.hardware\)/);
  assert.match(workflow, /getHardwareFinish\(state\.hardware\)/);
});

test("new designs reset unified presentation state while resume restores physical state", () => {
  const reset = methodBody("resetNewDesignPresentation", "consumeStudioStartParameter");
  const load = methodBody("loadInitialDesignRequest", "createStudioIntroViewer");
  assert.match(reset, /this\.activeInspectorGroup = normalizeInspectorGroup\("overall_size"\)/);
  assert.match(reset, /this\.activeStageId = "layout"/);
  assert.match(reset, /this\.activeInspectorTabId = "general"/);
  assert.match(reset, /this\.activeTool = "select"/);
  assert.match(reset, /this\.showDimensions = true/);
  assert.match(reset, /this\.showWall = true/);
  assert.match(reset, /this\.designHistory = \{ undo: \[\], redo: \[\], limit: 50 \}/);
  assert.match(reset, /this\.inspectorGroupCollapsed = false/);
  assert.match(reset, /this\.selection = null/);
  assert.match(reset, /this\.hoverSelection = null/);
  assert.match(reset, /this\.contextEditorOpen = false/);
  assert.match(reset, /this\.contextAnchor = null/);
  assert.match(reset, /this\.inspectorScrollPosition = 0/);
  assert.match(load, /source: "saved", intent: STUDIO_DESIGN_INTENTS\.resume/);
  assert.match(load, /source: "preset",[\s\S]*intent: STUDIO_DESIGN_INTENTS\.newDesign/);
  assert.doesNotMatch(reset, /CONFIGURATOR_MODES|guidedStep|furthestGuidedStepIndex|scrollPositions/);
  assert.doesNotMatch(source, /CONFIGURATOR_PREFERENCE_KEYS|GUIDED_STEPS/);
});

test("Project service cards avoid the shared option-card grid collision", () => {
  const service = methodBody("renderServiceGroup", "renderReviewContent");
  assert.match(service, /class="service-option-card"/);
  assert.doesNotMatch(service, /<label class="option-card/);
  assert.match(service, /deliveryOptionIcons\[option\.value\]/);
  assert.match(service, /installationOptionIcons\[option\.value\]/);
});

test("smart camera maps categories and fields to semantic component focus profiles", () => {
  assert.match(source, /const SMART_CAMERA_PROFILES = Object\.freeze/);
  assert.match(source, /doors: Object\.freeze\(\{[^}]*roles: \["door", "drawer_front"\]/s);
  assert.match(source, /crown: Object\.freeze\(\{[^}]*roles: \["crown"\]/s);
  assert.match(source, /base: Object\.freeze\(\{[^}]*roles: \["base", "trim"\]/s);
  assert.match(source, /sidePanels: Object\.freeze\(\{[^}]*roles: \["side_panel"\]/s);
  assert.match(source, /backPanel: Object\.freeze\(\{[^}]*roles: \["back_panel"\]/s);
  assert.match(source, /shelves: Object\.freeze\(\{[^}]*roles: \["shelf", "fixed_shelf"\]/s);
  assert.match(source, /hardware: Object\.freeze\(\{[^}]*roles: \["handle"\]/s);
  assert.match(source, /CAMERA_PROFILE_BY_FIELD/);
  assert.match(source, /sections: "overview"/);
  assert.match(source, /shelves: "overview"/);
  assert.match(source, /lowerCabinets: "overview"/);
  assert.match(source, /lowerStorage: "overview"/);
  assert.match(source, /drawerCount: "overview"/);
  assert.match(source, /doorStyle: "doors"/);
  assert.match(source, /crownStyle: "crown"/);
  assert.match(source, /baseStyle: "base"/);
  assert.match(source, /lightingWarmth: "lighting"/);
});

test("section and storage steppers restore whole-bookcase framing", () => {
  const stepper = methodBody("handleStepperClick", "update");
  assert.match(stepper, /this\.update\(\{ \.\.\.this\.state, \[fieldName\]: nextValue \}, \{ sourceField: fieldName \}\);\s*this\.focusCameraForField\(fieldName\);/);
});

test("base and crown profile radios support repeated click, Enter, and native Space activation", () => {
  assert.match(source, /const PROFILE_FOCUS_FIELDS = new Set\(\["baseStyle", "crownStyle"\]\)/);

  const events = methodBody("bindEvents", "handleDelegatedClick");
  const profileKeyboardStart = events.indexOf("const profileRadio = event.target.closest");
  const profileKeyboardEnd = events.indexOf("const colorQuery", profileKeyboardStart);
  assert.notEqual(profileKeyboardStart, -1, "profile radio keyboard handling must exist");
  assert.notEqual(profileKeyboardEnd, -1, "profile radio keyboard handling must precede color search handling");
  const profileKeyboard = events.slice(profileKeyboardStart, profileKeyboardEnd);
  assert.match(profileKeyboard, /event\.key === "Enter"[\s\S]*event\.preventDefault\(\)[\s\S]*profileRadio\.click\(\)/);
  assert.doesNotMatch(profileKeyboard, /event\.key === "(?: |Space|Spacebar)"/, "Space must retain native radio activation");

  const delegatedClick = methodBody("handleDelegatedClick", "focusInspectorGroup");
  assert.match(delegatedClick, /input\[type="radio"\]\[data-field\]/);
  assert.match(delegatedClick, /PROFILE_FOCUS_FIELDS\.has\(profileRadio\.dataset\.field\)/);
  assert.match(delegatedClick, /String\(this\.state\[fieldName\]\) === String\(profileRadio\.value\)/);
  assert.match(delegatedClick, /this\.requestProfileCameraFocus\(fieldName, \{ force: true \}\)/);
});

test("profile camera focus waits for updated geometry and replaces queued focus work", () => {
  const fieldInput = methodBody("handleFieldInput", "handleStepperClick");
  const updateIndex = fieldInput.indexOf("this.update(next, { sourceField: fieldName })");
  const profileFocusIndex = fieldInput.indexOf("this.requestProfileCameraFocus(fieldName, { force: true })");
  assert.notEqual(updateIndex, -1, "profile selections must update canonical geometry");
  assert.notEqual(profileFocusIndex, -1, "profile selections must request detail focus");
  assert.ok(updateIndex < profileFocusIndex, "updated geometry must be committed before final profile framing");

  const fieldFocus = methodBody("focusCameraForField", "requestProfileCameraFocus");
  assert.match(fieldFocus, /focusCameraForField\(fieldName, options = \{\}\)/);
  assert.match(fieldFocus, /this\.viewer\.focus\(profile, options\)/);

  const request = methodBody("requestProfileCameraFocus", "cancelQueuedProfileFocus");
  assert.ok(request.indexOf("this.cancelQueuedProfileFocus()") < request.indexOf("window.requestAnimationFrame"));
  assert.match(request, /this\.focusCameraForField\(fieldName, \{ \.\.\.options, force: true \}\)/);

  const cancel = methodBody("cancelQueuedProfileFocus", "scheduleOptionPreview");
  assert.match(cancel, /window\.cancelAnimationFrame\(this\.profileFocusFrame\)/);
  assert.match(cancel, /this\.profileFocusFrame = 0/);
});

test("profile framing uses semantic detail regions and the unobstructed viewer area", () => {
  assert.match(source, /crown: Object\.freeze\(\{[^}]*roles: \["crown"\][^}]*profileDetail: "crown"/s);
  assert.match(source, /base: Object\.freeze\(\{[^}]*roles: \["base", "trim"\][^}]*profileDetail: "base"/s);

  const safeViewport = methodBody("getSafeViewport", "focus");
  for (const overlay of [
    ".configurator-experience-toolbar",
    ".preview-heading > div",
    ".preview-control-dock",
    ":scope > .cabinet-ar-launch"
  ]) assert.ok(safeViewport.includes(`"${overlay}"`), `${overlay} must be included in safe framing`);
  assert.match(safeViewport, /const intersection = \{/);
  assert.match(safeViewport, /insets\.top = Math\.max/);
  assert.match(safeViewport, /insets\.right = Math\.max/);
  assert.match(safeViewport, /insets\.bottom = Math\.max/);
  assert.match(safeViewport, /insets\.left = Math\.max/);

  const pose = methodBody("getFocusPose", "getFocusBounds");
  assert.match(pose, /const viewport = this\.getSafeViewport\(\)/);
  for (const edge of ["top", "right", "bottom", "left"]) {
    assert.match(pose, new RegExp(`viewport\\.insets\\.${edge}`));
  }
  assert.match(pose, /viewportKey/);
  assert.match(pose, /resolveCollisionSafeRadius/);
  assert.match(source, /focusTargetCache = new Map\(\)/);
});

test("smart camera transitions replace stale work and use one on-demand render scheduler", () => {
  assert.match(source, /const SMART_CAMERA_DURATION = PROFILE_CAMERA_DURATION/);
  assert.ok(PROFILE_CAMERA_DURATION >= 600 && PROFILE_CAMERA_DURATION <= 900, "profile focus should animate for 600-900ms");
  assert.match(source, /window\.matchMedia\?\.\("\(prefers-reduced-motion: reduce\)"\)/);

  const transition = methodBody("animateToCameraPose", "applyCameraPose");
  assert.match(transition, /resolveCameraTransitionDuration\(requestedDuration, this\.reducedMotionQuery\?\.matches\)/);
  assert.match(transition, /if \(duration === 0\)/);
  assert.match(transition, /this\.cameraTransition = null;\s*this\.applyCameraPose\(\{ \.\.\.pose, theta: endTheta \}\)/);
  assert.match(transition, /if \(this\.cameraTransition\) this\.cameraTransitionCancellationCount \+= 1/);
  assert.match(transition, /sequence: \+\+this\.cameraTransitionSequence/);
  assert.match(transition, /duration,/);
  assert.doesNotMatch(transition, /requestAnimationFrame/, "camera transitions must use the shared render scheduler");
  assert.match(transition, /this\.requestRender\(\)/);

  const transitionUpdate = methodBody("updateCameraTransition", "cancelCameraTransition");
  assert.match(transitionUpdate, /easeInOutCubic\(progress\)/);
  assert.match(transitionUpdate, /this\.target\.lerpVectors/);

  const cancellation = methodBody("cancelCameraTransition", "setEnvironmentLightScale");
  assert.match(cancellation, /if \(this\.cameraTransition\) this\.cameraTransitionCancellationCount \+= 1/);
  assert.match(cancellation, /this\.cameraTransition = null/);

  const scheduler = methodBody("requestRender", "animate");
  assert.match(scheduler, /this\.destroyed \|\| this\.isRenderingFrame \|\| this\.animationFrame !== null/);
  assert.match(scheduler, /this\.animationFrame = window\.requestAnimationFrame\(\(time\) => this\.animate\(time\)\)/);

  const renderFrame = methodBody("animate", "getViewState");
  assert.match(renderFrame, /this\.animationFrame = null/);
  assert.match(renderFrame, /this\.renderCount \+= 1/);
  assert.match(
    renderFrame,
    /if \(this\.cameraTransition \|\| this\.pendingSectionPreview \|\| this\.pendingSectionPreviewRestore\) this\.requestRender\(\)/
  );
  assert.doesNotMatch(renderFrame, /requestAnimationFrame/, "render frames must reschedule only through the guarded scheduler");

  const viewer = source.slice(source.indexOf("class BookcaseViewer3D"));
  assert.equal((viewer.match(/this\.animationFrame = window\.requestAnimationFrame\(\(time\) => this\.animate\(time\)\)/g) || []).length, 1);
  assert.match(viewer, /renderCount: this\.renderCount/);
  assert.match(viewer, /renderScheduled: this\.animationFrame !== null/);
  assert.match(viewer, /cameraTransitionSequence: this\.cameraTransitionSequence/);
  assert.match(viewer, /cameraTransitionCancellations: this\.cameraTransitionCancellationCount/);

  assert.match(source, /shortestAngleDelta\(this\.theta, pose\.theta\)/);
  assert.match(source, /setProductLightingBoost\(normalizedKey === "lighting" \? 2\.35 : 1\)/);
  assert.match(source, /this\.viewer\.focus\(wasOpen \? "overview"/);
  const categoryToggle = methodBody("toggleInspectorGroup", "activateSectionDesigner");
  assert.doesNotMatch(categoryToggle, /this\.viewer\.setView/);
});

test("lighting packages can replace an in-flight lighting camera pose", () => {
  const focus = methodBody("focus", "getFocusPose");
  assert.match(focus, /const focusVariant = normalizedKey === "lighting"/);
  assert.match(focus, /focusVariant === this\.activeFocusVariant && this\.cameraTransition/);
  assert.match(focus, /this\.activeFocusVariant = focusVariant/);
});

test("puck lights render as restrained recessed diffusers instead of hanging spheres", () => {
  assert.match(source, /CylinderGeometry\(radius, radius, size\[1\] \* 0\.72, 28\)/);
  assert.match(source, /CylinderGeometry\(radius \* 0\.78, radius \* 0\.78, size\[1\] \* 0\.24, 28\)/);
  assert.match(source, /materials\.puckTrim/);
  assert.doesNotMatch(source, /SphereGeometry\(radius \* 0\.78/);
  assert.doesNotMatch(source, /getLightingLensColor/);
});

test("detail camera positions are relative to the focus target", () => {
  const updateCamera = methodBody("updateCamera", "requestRender");
  assert.match(updateCamera, /this\.target\.x \+ Math\.sin\(this\.theta\) \* horizontal/);
  assert.match(updateCamera, /this\.target\.z \+ Math\.cos\(this\.theta\) \* horizontal/);
  assert.match(updateCamera, /this\.camera\.lookAt\(this\.target\)/);
  assert.match(updateCamera, /this\.requestRender\(\)/);
});

test("visual-only mutations and restored camera state request an on-demand frame", () => {
  const environment = methodBody("setEnvironmentLightScale", "applyComponentHighlight");
  assert.match(environment, /light\.intensity =/);
  assert.match(environment, /this\.requestRender\(\)/);

  const finish = methodBody("applyFinishMaterials", "applyHardwareMaterial");
  const hardware = methodBody("applyHardwareMaterial", "applyLightingWarmth");
  const lighting = methodBody("applyLightingWarmth", "frameModel");
  const selection = methodBody("setSectionSelection", "refreshSectionInteractionLayer");
  for (const visualMutation of [finish, hardware, lighting, selection]) {
    assert.match(visualMutation, /this\.requestRender\(\)/);
  }

  const restore = methodBody("restoreCameraState", "resize");
  assert.match(restore, /this\.setEnvironmentLightScale/);
  assert.match(restore, /this\.updateCamera\(\)/);
});

test("hover option preview is reversible and isolated from canonical pricing state", () => {
  assert.match(source, /const HOVER_PREVIEW_FIELDS = new Set/);
  assert.match(source, /scheduleOptionPreview\(label, input\)/);
  assert.match(source, /beginOptionPreview\(label, input\)/);
  assert.match(source, /this\.viewer\.preview\(previewState, previewLayout, field\)/);
  assert.match(source, /this\.viewer\.restorePreview\(this\.state, this\.layout\)/);
  const preview = methodBody("beginOptionPreview", "endOptionPreview");
  assert.doesNotMatch(preview, /buildPricingContext|this\.price|saveCurrentDesign|localStorage/);
});

test("AR is a single left-rail action while estimate, Save, and Quote stay in the light footer", () => {
  const shell = methodBody("renderFullPageConfigurator", "renderStudioEntryShell");
  assert.equal((shell.match(/data-open-ar/g) || []).length, 1);
  assert.match(shell, /<nav class="workspace-stage-rail"[\s\S]*<button class="workspace-ar-card"[^>]*data-open-ar/);
  assert.match(shell, /aria-label="View this design in your room"/);
  assert.match(shell, /<strong>View in your room<\/strong>/);
  assert.equal((shell.match(/data-price/g) || []).length, 1);
  assert.match(shell, /Estimated price/);
  assert.match(shell, /data-price>\$\{formatPrice\(this\.pricing\.total\)\}/);
  assert.equal((shell.match(/data-save-design/g) || []).length, 1);
  assert.equal((shell.match(/data-open-order/g) || []).length, 1);
  assert.doesNotMatch(shell, /preview-price-pill|data-preview-price|Current estimated project price/);
  assert.doesNotMatch(shell, /cabinet-ar-launch|AR View in Your Room|See this bookcase at true scale/);
});

test("the left-rail AR action compacts with the horizontal tablet and phone stage navigation", () => {
  assert.match(
    css,
    /\.reference-workspace \.workspace-ar-card \{[\s\S]*?margin-top: 0;[\s\S]*?background: #fff;/
  );
  assert.match(
    css,
    /@media \(max-width: 1200px\)[\s\S]*?\.reference-workspace \.workspace-stage-rail \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) 176px;[\s\S]*?\.reference-workspace \.workspace-ar-card \{[\s\S]*?margin: 0;/
  );
  assert.match(
    css,
    /@media \(max-width: 767px\)[\s\S]*?\.reference-workspace \.workspace-stage-rail \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) 50px;[\s\S]*?\.reference-workspace \.workspace-ar-card \{[\s\S]*?width: 50px;/
  );
  assert.match(
    css,
    /@media \(max-width: 767px\)[\s\S]*?\.reference-workspace \.workspace-ar-card > span:not\(\.workspace-ar-mark\),[\s\S]*?\.workspace-ar-card > i \{[\s\S]*?display: none !important;/
  );
});

test("browser-verifiable diagnostics expose lifecycle counters without a global controller", () => {
  assert.match(source, /dataset\.diagnosticInterface = "unified"/);
  assert.match(source, /dataset\.diagnosticInspectorGroup/);
  assert.match(source, /dataset\.diagnosticWorkspaceStage/);
  assert.match(source, /dataset\.diagnosticInspectorTab/);
  assert.match(source, /dataset\.diagnosticHistoryUndo/);
  assert.match(source, /dataset\.diagnosticHistoryRedo/);
  assert.match(source, /dataset\.diagnosticSelectionKind/);
  assert.match(source, /dataset\.diagnosticSelectionEditor/);
  assert.match(source, /dataset\.diagnosticViewerInstance/);
  assert.match(source, /dataset\.diagnosticPriceCalculations/);
  assert.match(source, /dataset\.diagnosticPhysicalUpdates/);
  assert.match(source, /dataset\.diagnosticSaveActions/);
  assert.match(source, /dataset\.diagnosticQuoteActions/);
  assert.match(source, /dataset\.diagnosticCameraSequence/);
  assert.match(source, /dataset\.diagnosticCameraCancellations/);
  assert.match(source, /dataset\.diagnosticControlsEnabled/);
  assert.match(source, /dataset\.diagnosticReducedMotion/);
  assert.match(source, /dataset\.diagnosticConfiguration/);
  assert.match(source, /dataset\.diagnosticPricing/);
  const diagnostics = methodBody("getDiagnostics", "syncPresetCards");
  assert.match(diagnostics, /interface: "unified"/);
  assert.match(diagnostics, /activeInspectorGroup: this\.activeInspectorGroup/);
  assert.match(diagnostics, /activeWorkspaceStage: this\.activeStageId/);
  assert.match(diagnostics, /activeInspectorTab: this\.activeInspectorTabId/);
  assert.match(diagnostics, /history: \{ undo: this\.designHistory\.undo\.length, redo: this\.designHistory\.redo\.length \}/);
  assert.match(diagnostics, /selection: this\.selection/);
  assert.doesNotMatch(source, /window\.__jqConfigurator/);
});

test("viewer teardown removes controls, resources, and its canvas", () => {
  const viewer = source.slice(source.indexOf("class BookcaseViewer3D"));
  assert.match(viewer, /this\.controlAbortController = new AbortController\(\)/);
  assert.match(viewer, /this\.controlAbortController\?\.abort\(\)/);
  assert.match(viewer, /disposeObject\(this\.scene\)/);
  assert.match(viewer, /this\.renderer\.domElement\?\.remove\(\)/);
});

test("viewer controls remain enabled after focus and preserve browser zoom shortcuts", () => {
  const controls = methodBody("bindControls", "setView");
  for (const eventName of ["pointerdown", "pointermove", "pointerup", "pointercancel", "wheel", "keydown"]) {
    assert.match(controls, new RegExp(`addEventListener\\("${eventName}"`));
  }
  assert.match(controls, /this\.cancelCameraTransition\(\)/);
  assert.match(controls, /if \(event\.ctrlKey \|\| event\.metaKey\) return;/);
  assert.match(controls, /addEventListener\("wheel"[\s\S]*event\.preventDefault\(\)/);
  assert.match(controls, /addEventListener\("keydown"[\s\S]*event\.ctrlKey \|\| event\.metaKey/);
  assert.match(source, /controlsEnabled: !this\.destroyed/);
});

test("unified validation disables completion actions and links them to shared guidance", () => {
  const availability = methodBody("syncActionAvailability", "getDiagnostics");
  const delegatedClick = methodBody("handleDelegatedClick", "focusInspectorGroup");
  assert.match(availability, /validateUnifiedConfiguration\(this\.state, this\.layout, this\.drafts\)/);
  assert.match(availability, /\[data-action-hint\]/);
  assert.match(availability, /\[data-review-design\]/);
  assert.match(availability, /\[data-save-design\]/);
  assert.match(availability, /\[data-open-order\]/);
  assert.match(availability, /\[data-open-ar\]/);
  assert.match(availability, /button\.disabled = blocking/);
  assert.match(availability, /aria-describedby/);
  assert.match(availability, /className = "configurator-fix-stage"/);
  assert.match(availability, /fixButton\.dataset\.workspaceStageLink = issueStage\.id/);
  assert.match(availability, /fixButton\.dataset\.workspaceFocusField = issue\.field/);
  assert.match(delegatedClick, /field\?\.focus\(\{ preventScroll: false \}\)/);
  assert.match(source, /data-action-hint aria-live="polite"/);
  assert.doesNotMatch(source, /data-guided-errors/);
});

test("legacy dual-sidebar handlers and DOM-scanning state reconstruction are gone", () => {
  for (const retired of [
    "bindLegacyEvents", "handleFieldChangeLegacy", "readStateFromControls", "updateLegacy",
    "renderDoorOptionsLegacy", "renderPresetTray", "renderTrustRow", "syncLowerDependentControls"
  ]) assert.doesNotMatch(source, new RegExp(retired));
});

test("responsive presentation covers desktop, tablet, mobile, touch scrolling, and reduced motion", () => {
  assert.match(css, /\.reference-workspace \{[\s\S]*grid-template-columns: var\(--workspace-rail-width\) minmax\(0, 1fr\) var\(--workspace-properties-width\);/);
  assert.match(css, /\.reference-workspace \.workspace-stage-list \{[\s\S]*grid-template-rows: repeat\(8, minmax\(60px, 1fr\)\);/);
  for (const breakpoint of ["1200px", "767px"]) assert.match(css, new RegExp(`@media \\(max-width: ${breakpoint}\\)`));
  assert.match(css, /@media \(max-width: 1200px\)[\s\S]*\.reference-workspace \.workspace-stage-list \{[\s\S]*display: flex;[\s\S]*overflow-x: auto;/);
  assert.match(css, /@media \(max-width: 1200px\)[\s\S]*\.reference-workspace \.workspace-properties \{[\s\S]*grid-row: 4;[\s\S]*overflow-y: auto;[\s\S]*border-radius: 18px 18px 0 0;/);
  assert.match(precisionCss, /\.reference-workspace \.workspace-viewer-room > \.viewer-stage > canvas \{[\s\S]*touch-action: none;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.reference-workspace \*/);
  assert.match(css, /@media \(max-width: 1200px\)[\s\S]*\.reference-workspace > \.workspace-estimate-bar \{[\s\S]*position: sticky;[\s\S]*bottom: 0;/);
});

test("reference-workspace controls use a scoped contrasting focus ring and accessible touch targets", () => {
  assert.match(
    precisionCss,
    /Accepted-workspace interface polish[\s\S]*\.reference-workspace :is\([\s\S]*\[tabindex\][\s\S]*\):focus-visible \{[\s\S]*outline: 3px solid #734719;/
  );
  assert.match(
    precisionCss,
    /\.reference-workspace :is\([\s\S]*\.workspace-toolbar-group button,[\s\S]*\.workspace-section-card-main,[\s\S]*\.workspace-section-actions button[\s\S]*\) \{[\s\S]*touch-action: manipulation;/
  );
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*\.reference-workspace \.workspace-properties-panel :is\(button, summary, input, select\),[\s\S]*min-height: 44px;/);
});

test("the phone layout keeps the viewer persistent and presents Properties as the only contained sheet", () => {
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*\.reference-workspace \{[\s\S]*grid-template-rows: auto clamp\(330px, 48dvh, 410px\) 118px auto var\(--workspace-footer-height\);/);
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*\.reference-workspace \.workspace-properties \{[\s\S]*max-height: 64dvh;[\s\S]*grid-row: 4;/);
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*\.reference-workspace \.workspace-model \{[\s\S]*grid-template-rows: 48px minmax\(0, 1fr\);/);
  assert.match(precisionCss, /\.reference-workspace :is\([\s\S]*\.configurator-context-editor,[\s\S]*\.configurator-context-leader,[\s\S]*\.preview-control-dock,[\s\S]*\.configurator-model > \.cabinet-ar-launch[\s\S]*\) \{[\s\S]*display: none !important;/);
  const anchor = methodBody("updateContextAnchor", "closeContextEditor");
  assert.match(anchor, /void anchor/);
  assert.doesNotMatch(anchor, /matchMedia|getBoundingClientRect|contextLeader|style\.left|style\.top/);
});

test("the phone toolbar stays compact while the model remains directly selectable", () => {
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*min-height: calc\(100dvh - var\(--mobile-header-height, 52px\)\)/);
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*\.reference-workspace \.workspace-toolbar-group button \{[\s\S]*min-width: 38px;[\s\S]*min-height: 38px;/);
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*\.reference-workspace \.workspace-toolbar-group button b,[\s\S]*\.workspace-display-tools > span \{[\s\S]*display: none;/);
  assert.match(source, /aria-roledescription="interactive 3D configurator"/);
  assert.doesNotMatch(source, /data-configurator-mode|data-mode-panel/);
});

test("mobile appearance controls use dense color, hardware, and lighting grids", () => {
  assert.match(precisionCss, /Dense mobile appearance controls[\s\S]*\.finish-choice-grid \{[\s\S]*repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(precisionCss, /Dense mobile appearance controls[\s\S]*\.finish-choice-dot,[\s\S]*width: 30px;[\s\S]*height: 30px;/);
  assert.match(precisionCss, /Dense mobile appearance controls[\s\S]*\.hardware-choice \{[\s\S]*min-height: 52px;/);
  assert.match(precisionCss, /Dense mobile appearance controls[\s\S]*\.lighting-card \{[\s\S]*min-height: 56px;/);
});

test("the configurator route loads the experience module and final presentation layer", () => {
  assert.match(html, /configurator-experience\.css/);
  assert.match(html, /configurator-3d\.js/);
  assert.match(source, /from "\.\/configurator-experience\.js/);
  assert.match(workflow, /export const WORKSPACE_STAGES/);
  assert.match(workflow, /export const STAGE_CONTROL_GROUPS/);
  assert.match(workflow, /export const INSPECTOR_TAB_DEFINITIONS/);
  assert.match(workflow, /export const UNIFIED_CONTROL_GROUPS/);
  assert.match(workflow, /export const CONTEXT_EDITOR_DEFINITIONS/);
  assert.match(workflow, /export function validateUnifiedConfiguration/);
});

test("both unified editing surfaces use one lazy official-palette catalog provider", () => {
  assert.equal((source.match(/getBenjaminMooreColorCatalogProvider\(\)/g) || []).length, 1);
  assert.match(catalogProvider, /class ColorCatalogProvider/);
  assert.match(catalogProvider, /class BenjaminMooreColorCatalogProvider extends ColorCatalogProvider/);
  assert.match(catalogProvider, /fetch\(url, \{ credentials: "same-origin", cache: "force-cache" \}\)/);
  assert.doesNotMatch(catalogProvider, /fetch\([^\n]*benjaminmoore\.com/);
  assert.doesNotMatch(source, /guidedBenjaminMoore|allControlsBenjaminMoore/);
});

test("Benjamin Moore search is deliberate, accessible, escaped, and screen-reader announced", () => {
  const finish = methodBody("renderFinishGroup", "renderHardwareGroup");
  const resultsStart = source.indexOf("  async updateBenjaminMooreResults(");
  const resultsEnd = source.indexOf("\n  async applyBenjaminMooreQuery(", resultsStart + 1);
  assert.notEqual(resultsStart, -1);
  assert.notEqual(resultsEnd, -1);
  const results = source.slice(resultsStart, resultsEnd);
  assert.match(finish, /aria-describedby=.*bm-help .*bm-disclaimer/);
  assert.match(finish, /data-bm-status role="status" aria-live="polite"/);
  assert.match(finish, /target="_blank" rel="noopener noreferrer"/);
  assert.match(results, /escapeHtml\(color\.name\)/);
  assert.match(results, /data-bm-id/);
  assert.doesNotMatch(results, /applyBenjaminMooreColor\(matches\[0\]/);
  assert.match(source, /this\.showColorSearch = !this\.showColorSearch/);
  assert.match(source, /customPanel\.hidden = !this\.showColorSearch/);
});

test("structured paint identity is canonical and legacy custom fields remain compatibility mirrors", () => {
  assert.match(configSource, /paintSelection: null/);
  assert.match(configSource, /source: saved\?\.source === "benjamin-moore"/);
  assert.match(configSource, /catalogId:/);
  assert.match(configSource, /catalogVersion:/);
  assert.match(configSource, /sourceType:/);
  assert.match(configSource, /finish === "custom_bm" \? paintSelection : null/);
});

test("paint changes use the existing sRGB partial-material path without recoloring hardware or glass", () => {
  const partial = methodBody("applyPartialUpdate", "applyFinishMaterials");
  const finish = methodBody("applyFinishMaterials", "applyHardwareMaterial");
  assert.match(partial, /paintSelection/);
  assert.match(partial, /this\.applyFinishMaterials\(nextState\)/);
  assert.match(finish, /materials\.case, materials\.side, materials\.back, materials\.inset, materials\.edgeBlock/);
  assert.doesNotMatch(finish, /materials\.hardware|materials\.glass|new THREE\.Mesh/);
  assert.match(source, /outputColorSpace = THREE\.SRGBColorSpace/);
  assert.match(source, /toneMapping = THREE\.ACESFilmicToneMapping/);
  assert.match(source, /material\.color\?\.setHex\(finishColor\)/);
});
