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

test("the unified shell owns one inspector and one persistent viewer without mode panels", () => {
  const shell = methodBody("renderFullPageConfigurator", "renderStudioEntryShell");
  const inspector = methodBody("renderInspector", "renderUnifiedInspector");

  assert.match(shell, /data-unified-configurator/);
  assert.match(shell, /aria-label="Bookcase inspector"[^>]*data-unified-inspector/);
  assert.equal((shell.match(/data-inspector-content/g) || []).length, 1);
  assert.equal((shell.match(/data-3d-viewer tabindex=/g) || []).length, 1);
  assert.match(shell, /data-contextual-editor/);
  assert.doesNotMatch(shell, /data-mode-panel|data-configurator-mode|configurator-step-rail/);
  assert.match(inspector, /inspectorContent\.innerHTML = this\.renderUnifiedInspector\(\)/);
  assert.doesNotMatch(inspector, /viewer\.innerHTML|host\.innerHTML|createViewer|new BookcaseViewer3D|viewer\.update/);
});

test("inspector expansion and model selection are presentation-only", () => {
  const toggle = methodBody("toggleInspectorGroup", "activateSectionDesigner");
  const select = methodBody("handleModelSelection", "renderContextEditor");
  const close = methodBody("closeContextEditor", "bindEvents");

  assert.match(toggle, /this\.activeInspectorGroup = normalized/);
  assert.match(select, /this\.selection = selection/);
  assert.match(select, /this\.renderContextEditor\(\)/);
  assert.match(close, /this\.selection = null/);
  for (const presentationOnly of [toggle, select, close]) {
    assert.doesNotMatch(
      presentationOnly,
      /this\.update\(|viewer\.update|evaluateBookcaseCandidate|calculateBookcasePrice|createViewer|new BookcaseViewer3D/
    );
  }
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

test("the unified inspector, contextual dialog, and validation have complete ARIA wiring", () => {
  const shell = methodBody("renderFullPageConfigurator", "renderStudioEntryShell");
  const group = methodBody("renderInspectorGroup", "renderControlGroup");

  assert.match(shell, /aria-label="Bookcase inspector"[^>]*data-unified-inspector/);
  assert.match(shell, /data-contextual-editor role="dialog" aria-modal="false" aria-labelledby=/);
  assert.match(shell, /data-close-context aria-label="Close contextual editor"/);
  assert.match(shell, /data-selection-live role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(group, /data-category-trigger=.*aria-expanded=.*aria-controls=/);
  assert.match(group, /data-category-panel=.*role="region" aria-labelledby=/);
  assert.match(source, /data-validation-field="customPaintColor"/);
  assert.match(source, /\[data-field\], \[data-validation-field\]/);
  assert.doesNotMatch(source, /role="tablist"|data-configurator-mode|data-mode-panel|data-appearance-tab/);
});

test("the inspector exposes exactly the nine unified control groups", () => {
  const groupContract = workflow.slice(
    workflow.indexOf("export const UNIFIED_CONTROL_GROUPS"),
    workflow.indexOf("export const PHYSICAL_CONFIG_FIELDS")
  );
  const groupIds = [...groupContract.matchAll(/\{ id: "([^"]+)", label: "([^"]+)" \}/g)];
  assert.deepEqual(groupIds.map((match) => match[1]), [
    "overall_size",
    "sections_layout",
    "shelves",
    "storage_fronts",
    "base_crown",
    "finish",
    "hardware",
    "lighting",
    "project_service"
  ]);
  assert.deepEqual(groupIds.map((match) => match[2]), [
    "Overall Size",
    "Sections & Layout",
    "Shelves",
    "Storage & Fronts",
    "Base & Crown",
    "Finish",
    "Hardware",
    "Lighting",
    "Project Service"
  ]);

  const inspector = methodBody("renderUnifiedInspector", "renderInspectorGroup");
  const controls = methodBody("renderControlGroup", "renderLayoutCards");
  assert.match(inspector, /UNIFIED_CONTROL_GROUPS\.map\(\(group\) => this\.renderInspectorGroup\(group\)\)/);
  for (const groupId of groupIds.map((match) => match[1])) {
    assert.match(controls, new RegExp(`groupId === "${groupId}"`));
  }
  assert.doesNotMatch(source, /data-guided-(?:back|continue)|data-mode-panel|data-configurator-mode|configurator-step-rail/);
  assert.doesNotMatch(workflow, /CONFIGURATOR_MODES|GUIDED_STEPS|ALL_CONTROL_CATEGORIES/);
});

test("the inspector and contextual editor share one control-group renderer", () => {
  const inspectorGroup = methodBody("renderInspectorGroup", "renderControlGroup");
  const contextEditor = methodBody("renderContextEditor", "getSelectionSummary");

  assert.match(inspectorGroup, /this\.renderControlGroup\(group\.id, "inspector"\)/);
  assert.match(contextEditor, /this\.selection\.controlGroupIds/);
  assert.match(contextEditor, /this\.renderControlGroup\(groupId, "context"\)/);
  assert.equal((source.match(/renderControlGroup\(groupId, surface = "inspector"\) \{/g) || []).length, 1);
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

test("the unified Storage & Fronts group reconciles global storage with explicit section types", () => {
  const storage = methodBody("renderStorageFrontsGroup", "renderSectionDesignerGroup");
  const input = methodBody("handleFieldInput", "handleStepperClick");
  assert.match(storage, /this\.renderDoorGroup\(\)/);
  assert.match(storage, /data-open-structure/);
  assert.match(input, /fieldName === "lowerCabinets" \|\| fieldName === "lowerStorage"/);
  assert.match(input, /applyGlobalStorageSelection\(/);
});

test("the unified Hardware group hides when no generated front uses hardware", () => {
  const hardware = methodBody("renderHardwareGroup", "renderLightingGroup");
  assert.match(hardware, /control-section-hardware" data-applicability="hardware"/);
  assert.doesNotMatch(hardware, /hardware-selection" data-applicability=/);
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

test("Section Designer enforces its hard limit and scopes undo history to structural state", () => {
  const designer = methodBody("renderSectionDesignerGroup", "renderDoorGroup");
  const commit = methodBody("commitSectionOperation", "undoSectionChange");
  const undo = methodBody("undoSectionChange", "redoSectionChange");
  const redo = methodBody("redoSectionChange", "refreshSectionDesignerPresentation");

  assert.match(designer, /const splitDisabled = selected\.locked \|\| designer\.sections\.length >= this\.layout\.rules\.maxSections/);
  assert.match(designer, /const splitTooNarrow = selected\.width \+ 1e-6 < splitMinimumWidth/);
  assert.match(designer, /Splitting requires room for two/);
  assert.match(designer, /splitDisabled \? `disabled aria-describedby=/);
  assert.match(commit, /createSectionHistorySnapshot\(this\.state\)/);
  assert.match(undo, /applySectionHistorySnapshot\(this\.state, previous\)/);
  assert.match(redo, /applySectionHistorySnapshot\(this\.state, next\)/);
  assert.doesNotMatch(`${commit}\n${undo}\n${redo}`, /structuredClone\(this\.state\)/);
});

test("service and derived metadata updates never rebuild unchanged 3D geometry", () => {
  const partial = methodBody("applyPartialUpdate", "applyFinishMaterials");
  assert.match(partial, /nonVisualFields = new Set\(\["layoutPreset", "doorCount", "installation", "delivery"\]\)/);
  assert.match(partial, /every\(\(field\) => nonVisualFields\.has\(field\)\)/);
});

test("Sections & Layout is custom-first while ideas remain engine-backed inspiration", () => {
  const controls = methodBody("renderControlGroup", "renderLayoutCards");
  const ideas = methodBody("renderStudioIdeaLibrary", "renderStudioIdeaCard");
  assert.match(controls, /groupId === "sections_layout"[\s\S]*renderLayoutCards\("inspector"\)[\s\S]*renderStructureStartGroup/);
  assert.match(controls, /surface === "inspector"/);
  assert.doesNotMatch(controls, /renderLayoutCards\("guided"\)|renderLayoutCards\("all"\)/);
  assert.match(ideas, /filterInspirationIdeas\(this\.inspirationFilter\)/);
  assert.match(ideas, /View all \$\{filtered\.length\} editable ideas/);
});

test("unified groups separate Size, Shelves, Storage & Fronts, and Base & Crown concerns", () => {
  const space = methodBody("renderSpaceGroup", "renderStructureStartGroup");
  const shelves = methodBody("renderShelvesGroup", "renderStorageFrontsGroup");
  const storage = methodBody("renderStorageFrontsGroup", "renderSectionDesignerGroup");
  const construction = methodBody("renderStructureGroup", "renderFinishGroup");
  assert.match(space, /renderRangeControl\("width"/);
  assert.doesNotMatch(space, /renderRangeControl\("shelves"|renderRangeControl\("shelfThickness"/);
  assert.match(shelves, /renderStepperControl\("shelves"/);
  assert.match(shelves, /renderRangeControl\("shelfThickness"/);
  assert.doesNotMatch(storage, /renderStepperControl\("shelves"/);
  assert.match(storage, /this\.renderDoorGroup\(\)/);
  assert.doesNotMatch(storage, /renderSectionDesignerGroup|data-section-designer-open/);
  assert.match(storage, /data-open-structure/);
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

test("the unified Sections & Layout group exposes Structure and guards precision focus", () => {
  const controls = methodBody("renderControlGroup", "renderLayoutCards");
  assert.match(controls, /groupId === "sections_layout"[\s\S]*this\.renderStructureStartGroup\(\)/);
  const widthCommit = methodBody("commitSelectedSectionWidth", "commitSectionDividerResize");
  assert.match(widthCommit, /rawValue === "" \|\| !Number\.isFinite\(targetWidth\)/);
  assert.match(widthCommit, /Enter a valid clear section width/);
  const viewerControls = methodBody("bindControls", "setView");
  assert.match(viewerControls, /event\.target !== this\.root[\s\S]*?\[data-section-overlay\]/);
  const update = methodBody("update", "renderDoorOptions");
  assert.match(update, /focusedHardwareInput/);
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
  assert.doesNotMatch(commit, /focusCameraForField|viewer\.focus/);
  assert.match(css, /\.hardware-type-grid/);
  assert.match(css, /\.hardware-finish-grid/);
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
  assert.match(source, /CylinderGeometry\(radius, radius, size\[1\] \* 0\.8, 20\)/);
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

test("the compact AR launch replaces the duplicate preview estimate", () => {
  const shell = methodBody("renderFullPageConfigurator", "renderStudioEntryShell");
  assert.equal((shell.match(/data-ar-label/g) || []).length, 1);
  assert.equal((shell.match(/>AR View in Your Room<\/span>/g) || []).length, 1);
  assert.match(shell, /aria-label="AR View in Your Room"/);
  assert.equal((shell.match(/data-price/g) || []).length, 1);
  assert.match(shell, /Estimated project price/);
  assert.match(shell, /data-price>\$\{formatPrice\(this\.pricing\.total\)\}/);
  assert.doesNotMatch(shell, /preview-price-pill|data-preview-price|Current estimated project price/);
  assert.doesNotMatch(shell, /cabinet-ar-launch-heading|cabinet-ar-launch-help|See this bookcase at true scale/);
  assert.match(shell, /<div class="cabinet-ar-launch">\s*<button class="cabinet-ar-launch-button"/);
});

test("the compact AR launch and review action have responsive centered placement", () => {
  assert.match(
    precisionCss,
    /@media \(min-width: 768px\)[\s\S]*?\.configurator-model > \.cabinet-ar-launch \{[\s\S]*?top: 16px;[\s\S]*?right: 20px;[\s\S]*?bottom: auto;[\s\S]*?background: transparent;/
  );
  assert.match(
    precisionCss,
    /\.configurator-model > \.cabinet-ar-launch \.cabinet-ar-launch-button \{[\s\S]*?display: inline-flex;[\s\S]*?width: auto;[\s\S]*?align-items: center;[\s\S]*?justify-content: center;/
  );
  assert.match(
    precisionCss,
    /\.configurator-review-button \{[\s\S]*?display: inline-flex;[\s\S]*?align-items: center;[\s\S]*?justify-content: center;[\s\S]*?text-align: center;/
  );
  assert.match(
    precisionCss,
    /@media \(max-width: 767px\)[\s\S]*?\.configurator-model > \.cabinet-ar-launch \{[\s\S]*?right: 10px;[\s\S]*?left: auto;[\s\S]*?bottom: 72px;/
  );
  assert.match(
    precisionCss,
    /@media \(min-width: 768px\) and \(max-width: 1279px\) and \(orientation: landscape\)[\s\S]*?\.configurator-model > \.cabinet-ar-launch \{[\s\S]*?top: 72px;[\s\S]*?right: 104px;/
  );
});

test("browser-verifiable diagnostics expose lifecycle counters without a global controller", () => {
  assert.match(source, /dataset\.diagnosticInterface = "unified"/);
  assert.match(source, /dataset\.diagnosticInspectorGroup/);
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
  assert.match(diagnostics, /selection: this\.selection/);
  assert.match(diagnostics, /contextEditorOpen: this\.contextEditorOpen/);
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
  assert.match(availability, /validateUnifiedConfiguration\(this\.state, this\.layout, this\.drafts\)/);
  assert.match(availability, /\[data-action-hint\]/);
  assert.match(availability, /\[data-review-design\]/);
  assert.match(availability, /\[data-save-design\]/);
  assert.match(availability, /\[data-open-order\]/);
  assert.match(availability, /\[data-open-ar\]/);
  assert.match(availability, /button\.disabled = blocking/);
  assert.match(availability, /aria-describedby/);
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
  assert.match(css, /grid-template-columns: clamp\(360px, 29vw, 420px\) minmax\(0, 1fr\)/);
  for (const breakpoint of ["900px", "767px"]) assert.match(css, new RegExp(`max-width: ${breakpoint}`));
  assert.match(css, /\.configurator-model \.viewer-stage \{[\s\S]*touch-action: none;/);
  assert.match(css, /\.configurator-control-experience \{[\s\S]*overflow-y: auto;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*\.configurator-experience > \.configurator-estimate-bar \{[\s\S]*position: sticky;[\s\S]*bottom: 0;/);
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*\.configurator-experience > \.configurator-estimate-bar \{[\s\S]*position: static;/);
});

test("light configurator controls use a contrasting focus ring and readable compact copy", () => {
  assert.match(
    css,
    /\.section-overview-card:focus-visible \{[\s\S]*?outline: 3px solid #6b431c;/
  );
  assert.match(
    css,
    /:is\(\.hardware-type-choice, \.hardware-finish-choice\) > input:focus-visible \+ span \{[\s\S]*?outline: 3px solid #6b431c;/
  );
  assert.match(
    css,
    /\.section-overview-card small \{[\s\S]*?font-size: 12px;/
  );
  assert.match(
    precisionCss,
    /\.control-section-storage \.door-style-copy strong \{[\s\S]*?font-size: 12px;/
  );
  assert.match(
    precisionCss,
    /\.control-section-storage \.control-helper \{[\s\S]*?font-size: 12px;/
  );
});

test("the phone layout keeps the inspector in document flow and opens context as one bottom sheet", () => {
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*\.configurator-experience \{[\s\S]*grid-template-rows: clamp\(350px, 52svh, 430px\) auto 72px;/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*\.configurator-control-experience \{[\s\S]*grid-row: 2;[\s\S]*overflow: visible;/);
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*\.configurator-context-editor \{[\s\S]*position: fixed;[\s\S]*inset: auto 0 0 !important;[\s\S]*max-height: min\(72dvh, 620px\);/);
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*\.configurator-context-leader,[\s\S]*\.configurator-hover-label \{[\s\S]*display: none;/);
  const anchor = methodBody("updateContextAnchor", "closeContextEditor");
  assert.match(anchor, /window\.matchMedia\("\(max-width: 767px\)"\)\.matches/);
  assert.match(anchor, /this\.elements\.contextLeader\.hidden = true/);
  const focus = methodBody("focusInspectorGroup", "focusCameraForCurrentContext");
  assert.match(focus, /category\?\.scrollIntoView\?\.\(\{ block: "nearest"/);
});

test("the phone header stays compact while the model remains directly selectable", () => {
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*--mobile-configurator-header-height: 52px;/);
  assert.match(css, /min-height: calc\(100dvh - var\(--mobile-configurator-header-height\)\)/);
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*\.configurator-model \{[\s\S]*min-height: 350px;/);
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
