import * as THREE from "./assets/vendor/three.module.js";
import { diagramSvg, iconSvg } from "./icon-system.js?v=interface-polish-20260715a";
import {
  baseStyleOptions,
  crownStyleOptions,
  defaultBookcaseConfig,
  deliveryOptions,
  drawerFrontStyleOptions,
  doorStyleOptions,
  finishOptions,
  getHardwareFinish,
  getHardwareFinishOption,
  getHardwareFinishesForType,
  getHardwareType,
  hardwareTypeOptions,
  inchesToUnits,
  installationOptions,
  layoutPresets,
  lightingWarmthOptions,
  lightingOptions,
  normalizeBookcaseConfig,
  optionLabels,
  resolveHardwareVariant
} from "./bookcase-config.js?v=engine-polish-20260716a";
import { generateBookcaseLayout } from "./bookcase-layout.js?v=engine-polish-20260716a";
import { formatPrice } from "./bookcase-pricing.js?v=engine-polish-20260716a";
import {
  addSection,
  applySectionWidths,
  applyGlobalStorageSelection,
  deleteSection,
  duplicateSection,
  equalizeSectionWidths,
  getSectionDesignerState,
  mergeSection,
  reconcileSectionCustomization,
  resetSectionCustomization,
  resizeAdjacentSections,
  setSectionClearWidth,
  setSectionDoorArrangement,
  setSectionStorageConfiguration,
  setSectionType,
  splitSection
} from "./bookcase-sections.js?v=engine-polish-20260716a";
import {
  CAMERA_INTENT_STATES,
  PROFILE_CAMERA_DURATION,
  calculateBoundsCameraPose,
  calculateProfileCameraPose,
  calculateViewportAwareTarget,
  createCameraIntentState,
  isProfileCameraKey,
  resolveCameraIntent,
  resolveCameraTransitionDuration
} from "./profile-camera.js?v=workspace-camera-20260716i";
import {
  BENJAMIN_MOORE_COLOR_DATA_NOTICE,
  BENJAMIN_MOORE_OFFICIAL_COLORS_URL,
  createBenjaminMoorePaintSelection,
  getBenjaminMooreColorCatalogProvider
} from "./benjamin-moore-colors.js?v=engine-polish-20260716a";
import {
  STAGE_CONTROL_GROUPS,
  UNIFIED_CONTROL_GROUPS,
  WORKSPACE_STAGES,
  createSectionOrganizerSummary,
  createQuoteUrl,
  createReviewGroups,
  createPresetTransition,
  escapeHtml,
  getApplicability,
  getInspectorGroupSummary,
  getChangedConfigFields,
  getInvalidDraftIssues,
  hasBlockingConfigurationIssue,
  inferBasePresetId,
  inspectorGroupForField,
  normalizeInspectorGroup,
  reconcileSelectionContext,
  resolveWorkspaceSelection,
  resolveSelectionContext,
  shouldRunAction,
  validateUnifiedConfiguration
} from "./configurator-experience.js?v=engine-polish-20260716a";
import {
  createAcceptedDesignSnapshot,
  evaluateBookcaseCandidate,
  restoreAcceptedDesignSnapshot
} from "./bookcase-engine.js?v=engine-polish-20260716a";
import { createLegacyHardwareSelections } from "./hardware-catalog.js?v=engine-polish-20260716a";
import { resolveDirectEditIntersection } from "./direct-edit-picking.js?v=engine-polish-20260716a";
import {
  createCabinetLatchProxyParts,
  createCupPullProxyParts,
  createLinearPullProxyParts,
  descriptorMountCentersToScene
} from "./hardware-proxy-geometry.js?v=engine-polish-20260716a";
import {
  createExpectedRenderManifest,
  validateRenderedManifest
} from "./bookcase-render-contract.js?v=engine-polish-20260716a";
import {
  STUDIO_CAPABILITIES,
  STUDIO_DESIGN_INTENTS,
  STUDIO_ENTRY_VIEWS,
  STUDIO_PROVISIONAL_DIMENSIONS,
  createNeutralCustomConfig,
  getStudioPreviewIdeas,
  isStudioResumeRequest,
  isStudioWelcomeRequest,
  normalizeStudioDesignIntent,
  normalizeStudioEntryView,
  suggestStudioSectionCount
} from "./configurator-studio.js?v=responsive-callouts-20260715e";

const numericFields = new Set(["width", "height", "depth", "sections", "shelves", "shelfThickness", "lightingWarmth", "drawerCount"]);
const sectionStoragePresets = Object.freeze([
  Object.freeze({
    id: "open_shelves",
    label: "Open Shelves",
    description: "Open display with adjustable shelves",
    patch: Object.freeze({ type: "open", shelfCount: 4 })
  }),
  Object.freeze({
    id: "lower_doors",
    label: "Lower Doors + Shelves",
    description: "Closed storage below, open shelves above",
    patch: Object.freeze({ type: "lower_doors", shelfCount: 3, lowerStorageHeight: 30, doorArrangement: "auto" })
  }),
  Object.freeze({
    id: "lower_drawers",
    label: "Lower Drawers + Shelves",
    description: "Drawer storage below, open shelves above",
    patch: Object.freeze({ type: "drawers", shelfCount: 3, drawerCount: 3, lowerStorageHeight: 30 })
  }),
  Object.freeze({
    id: "full_doors",
    label: "Full Doors",
    description: "Full-height concealed storage",
    patch: Object.freeze({ type: "tall_doors", shelfCount: 4, doorStyle: "shaker", doorArrangement: "auto" })
  }),
  Object.freeze({
    id: "glass_display",
    label: "Glass Display",
    description: "Full-height glass doors with display shelves",
    patch: Object.freeze({ type: "tall_doors", shelfCount: 4, doorStyle: "glass", doorArrangement: "auto" })
  })
]);
const builderIcons = Object.freeze({
  dimensions: iconSvg("dimensions"),
  width: iconSvg("width"),
  space: iconSvg("space-frame"),
  layout: iconSvg("sections"),
  storage: iconSvg("storage"),
  structure: iconSvg("crown-molding"),
  ideas: iconSvg("inspiration"),
  lighting: iconSvg("light-bulb"),
  finish: iconSvg("paint-finish"),
  hardware: iconSvg("hardware"),
  preview: iconSvg("preview-eye"),
  shelves: iconSvg("shelves"),
  doors: iconSvg("doors"),
  drawers: iconSvg("drawers"),
  backPanel: iconSvg("back-panel"),
  save: iconSvg("save"),
  search: iconSvg("search"),
  orbit: iconSvg("camera-orbit"),
  front: iconSvg("camera-front"),
  threeQuarter: iconSvg("camera-three-quarter"),
  side: iconSvg("camera-side"),
  augmentedReality: iconSvg("augmented-reality"),
  close: iconSvg("close"),
  check: iconSvg("check"),
  plus: iconSvg("plus"),
  minus: iconSvg("minus"),
  back: iconSvg("chevron-left"),
  zoomIn: iconSvg("zoom-in"),
  zoomOut: iconSvg("zoom-out"),
  reset: iconSvg("reset"),
  undo: iconSvg("undo"),
  redo: iconSvg("redo"),
  information: iconSvg("information"),
  chevronRight: iconSvg("chevron-right"),
  copy: iconSvg("copy"),
  delete: iconSvg("trash"),
  pan: iconSvg("pan"),
  select: iconSvg("select"),
  fullscreen: iconSvg("fullscreen"),
  more: iconSvg("more-horizontal"),
  premiumMaterials: iconSvg("material-layers"),
  craftsmanship: iconSvg("craftsmanship"),
  customFit: iconSvg("dimensions"),
});

const studioCapabilityIcons = Object.freeze([
  builderIcons.layout,
  builderIcons.structure,
  builderIcons.dimensions,
  builderIcons.finish,
  builderIcons.storage,
  builderIcons.lighting,
  builderIcons.shelves,
  builderIcons.customFit
]);

const deliveryOptionIcons = Object.freeze({
  pickup: iconSvg("shop-pickup"),
  standard: iconSvg("standard-delivery"),
  priority: iconSvg("priority-delivery")
});

const installationOptionIcons = Object.freeze({
  no_installation: iconSvg("no-installation"),
  professional: iconSvg("professional-installation")
});

const basePreviewIcons = Object.freeze({
  toe_kick: diagramSvg("base-toe-kick"),
  plinth: diagramSvg("base-plinth"),
  furniture_base: diagramSvg("base-furniture")
});

const crownPreviewIcons = Object.freeze({
  none: diagramSvg("crown-flat-top"),
  slim_cap: diagramSvg("crown-step"),
  classic_crown: diagramSvg("crown-classic"),
  modern_soffit: diagramSvg("crown-built-up")
});

const doorPreviewIcons = Object.freeze({
  shaker: diagramSvg("door-shaker"),
  flat: diagramSvg("door-flat"),
  slim_shaker: diagramSvg("door-slim-shaker"),
  glass: diagramSvg("door-glass")
});

const lightingPreviewIcons = Object.freeze({
  no_lighting: iconSvg("lighting-off"),
  warm_pucks: iconSvg("puck-light"),
  shelf_accent: iconSvg("under-shelf-light"),
  vertical_led: iconSvg("interior-light"),
  full_package: iconSvg("light-scenes")
});

const hardwareTypeIcons = Object.freeze({
  knob: iconSvg("hardware-knob"),
  pull: iconSvg("handle-pull")
});
const finishPalette = {
  white_dove: 0xeee9dc,
  simply_white: 0xf5f0e4,
  chantilly_lace: 0xf7f5ee,
  cloud_white: 0xeee8dc,
  silver_satin: 0xd8d7d2,
  custom_bm: 0xd3c8b8
};

const SMART_CAMERA_DURATION = PROFILE_CAMERA_DURATION;
const SMART_CAMERA_PROFILES = Object.freeze({
  overview: Object.freeze({ theta: -0.18, phi: 0.11, radiusScale: 1, roles: [] }),
  doors: Object.freeze({ theta: 0, phi: 0.015, radiusScale: 0.58, roles: ["door", "drawer_front"], selection: "center", limit: 1, boundsWidthScale: 0.6, boundsHeightScale: 0.34 }),
  crown: Object.freeze({ theta: -0.62, phi: -0.08, radiusScale: 0.4, roles: ["crown"], fallbackRoles: ["top_panel"], fallbackRegion: "top", profileDetail: "crown" }),
  base: Object.freeze({ theta: -0.62, phi: 0.11, radiusScale: 0.4, roles: ["base", "trim"], fallbackRegion: "bottom", profileDetail: "base" }),
  sidePanels: Object.freeze({ theta: -0.72, phi: 0.12, radiusScale: 0.82, roles: ["side_panel"], selection: "leftmost", limit: 1 }),
  backPanel: Object.freeze({ theta: 2.68, phi: 0.12, radiusScale: 0.84, roles: ["back_panel"] }),
  shelves: Object.freeze({ theta: -0.34, phi: -0.055, radiusScale: 0.72, roles: ["shelf", "fixed_shelf"], selection: "centerInterior", limit: 6 }),
  lighting: Object.freeze({ theta: -0.36, phi: -0.1, radiusScale: 0.62, roles: ["light"], fallbackRoles: ["shelf", "fixed_shelf"], selection: "centerInterior", limit: 3, targetModelZOffset: -0.08, environmentScale: 0.9, exposure: 1.06 }),
  hardware: Object.freeze({ theta: -0.3, phi: 0.015, radiusScale: 0.46, roles: ["handle"], fallbackRoles: ["door", "drawer_front"], selection: "center", limit: 2 }),
  finish: Object.freeze({ theta: -0.36, phi: 0.14, radiusScale: 0.94, roles: [], exposure: 1.14 })
});

const LIGHTING_CAMERA_OVERRIDES = Object.freeze({
  warm_pucks: Object.freeze({ theta: -0.46, phi: -0.28, radiusScale: 0.56, selection: "center", limit: 1, targetModelYOffset: -0.055, targetModelZOffset: -0.04 }),
  shelf_accent: Object.freeze({ theta: -0.38, phi: -0.13, radiusScale: 0.54, selection: "centerInterior", limit: 2, targetModelYOffset: -0.015, targetModelZOffset: -0.06 }),
  vertical_led: Object.freeze({ theta: -0.4, phi: -0.035, radiusScale: 0.64, selection: "centerInterior", limit: 2, targetModelZOffset: -0.08 }),
  full_package: Object.freeze({ theta: -0.48, phi: -0.17, radiusScale: 0.62, selection: "centerInterior", limit: 3, targetModelYOffset: -0.02, targetModelZOffset: -0.07 })
});

const CAMERA_PROFILE_BY_CATEGORY = Object.freeze({
  overall_size: "overview",
  sections_layout: "overview",
  shelves: "shelves",
  storage_fronts: "doors",
  base_crown: "overview",
  finish: "finish",
  hardware: "hardware",
  lighting: "lighting",
  project_service: "overview"
});

const CAMERA_PROFILE_BY_FIELD = Object.freeze({
  layoutPreset: "overview",
  width: "overview",
  height: "overview",
  depth: "overview",
  sections: "overview",
  shelves: "overview",
  shelfThickness: "shelves",
  lowerCabinets: "overview",
  lowerStorage: "overview",
  drawerCount: "overview",
  doorStyle: "doors",
  drawerFrontStyle: "doors",
  doorCount: "overview",
  crownStyle: "crown",
  baseStyle: "base",
  sidePanels: "sidePanels",
  backPanel: "backPanel",
  finish: "finish",
  customPaintColor: "finish",
  customPaintCode: "finish",
  customPaintHex: "finish",
  hardware: "hardware",
  lighting: "lighting",
  lightingWarmth: "lighting"
});

const PROFILE_FOCUS_FIELDS = new Set(["baseStyle", "crownStyle"]);
const HOVER_PREVIEW_FIELDS = new Set(["doorStyle", "drawerFrontStyle", "baseStyle", "crownStyle", "finish", "lighting", "lightingWarmth"]);
const DIRECT_EDIT_LAYER = 2;
const DIRECT_EDITABLE_ROLES = new Set([
  "handle",
  "door",
  "drawer_front",
  "shelf",
  "fixed_shelf",
  "section",
  "light",
  "divider",
  "base",
  "trim",
  "crown",
  "top_panel",
  "side_panel",
  "back_panel",
  "bottom_panel",
  "assembly"
]);
const DIRECT_EDIT_KIND_BY_ROLE = Object.freeze({
  handle: "hardware",
  door: "front",
  drawer_front: "front",
  shelf: "shelf",
  fixed_shelf: "shelf",
  section: "section",
  light: "lighting",
  divider: "divider",
  base: "base",
  trim: "base",
  crown: "crown",
  top_panel: "crown",
  side_panel: "body",
  back_panel: "body",
  bottom_panel: "body",
  assembly: "body"
});
let viewerInstanceSequence = 0;

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-bookcase-builder]").forEach(async (host, index) => {
    if (host.__bookcaseConfigurator) return;
    if (host.getAttribute("data-enable-cabinet-ar") === "true") {
      try {
        const { readCabinetArShareConfiguration } = await import("./cabinet-ar.js?v=engine-polish-20260716a");
        host.__cabinetArSharedConfiguration = readCabinetArShareConfiguration(window.location.href);
      } catch (error) {
        host.__cabinetArSharedConfiguration = null;
      }
    }
    host.__bookcaseConfigurator = new BookcaseConfigurator(host, index);
  });
});

class BookcaseConfigurator {
  constructor(host, index) {
    this.host = host;
    this.id = `jq-builder-${index + 1}`;
    this.eventAbortController = new AbortController();
    this.destroyed = false;
    this.arEnabled = this.host.getAttribute("data-enable-cabinet-ar") === "true";
    const directHardwareFlag = new URLSearchParams(window.location.search).get("directHardwareEditing");
    this.directHardwareEditingEnabled = this.host.getAttribute("data-direct-hardware-editing") !== "false"
      && directHardwareFlag !== "0"
      && directHardwareFlag !== "false";
    this.directHardwareEditor = null;
    this.directHardwareEditorPromise = null;
    this.directHardwareOverlayOpen = false;
    const initialRequest = this.loadInitialDesignRequest();
    const initialEvaluation = initialRequest.config ? evaluateBookcaseCandidate(initialRequest.config) : null;
    this.hasAcceptedDesign = Boolean(initialEvaluation?.accepted);
    this.initialSource = this.hasAcceptedDesign ? initialRequest.source : "new";
    this.designIntent = normalizeStudioDesignIntent(initialRequest.intent);
    this.acceptedEvaluation = this.hasAcceptedDesign ? initialEvaluation : null;
    this.state = this.hasAcceptedDesign ? initialEvaluation.state : null;
    this.layout = this.hasAcceptedDesign ? initialEvaluation.layout : null;
    this.bom = this.hasAcceptedDesign ? initialEvaluation.bom : null;
    this.pricing = this.hasAcceptedDesign ? initialEvaluation.pricing : null;
    this.basePresetId = this.hasAcceptedDesign ? inferBasePresetId(this.state) : defaultBookcaseConfig.layoutPreset;
    this.activeInspectorGroup = normalizeInspectorGroup("overall_size");
    this.activeStageId = "layout";
    this.activeInspectorTabId = "general";
    this.activeTool = "select";
    this.showDimensions = true;
    this.showWall = true;
    this.fullscreen = false;
    this.designHistory = { undo: [], redo: [], limit: 50 };
    this.inspectorGroupCollapsed = false;
    this.selection = null;
    this.hoverSelection = null;
    this.contextEditorOpen = false;
    this.contextInvoker = null;
    this.contextAnchor = null;
    this.entryView = STUDIO_ENTRY_VIEWS.welcome;
    this.introPreviewIndex = 0;
    this.introPreviewTimer = 0;
    this.introPreviewStopped = false;
    this.analyticsEvents = [];
    this.welcomeViewed = false;
    this.drafts = {};
    this.inspectorScrollPosition = 0;
    this.actionStartedAt = {};
    this.showColorSearch = false;
    this.colorQueryDraft = "";
    this.colorSearchTimer = 0;
    this.colorSearchSequence = 0;
    this.colorCatalog = getBenjaminMooreColorCatalogProvider();
    this.resetConfirmationExpires = 0;
    this.resetConfirmationTimer = 0;
    this.reviewInvoker = null;
    this.updateCount = 0;
    this.priceCalculationCount = 0;
    this.saveActionCount = 0;
    this.quoteActionCount = 0;
    this.sectionDesignerActive = false;
    this.selectedSectionIndex = 0;
    this.sectionWidthDraft = "";
    this.sectionActionsExpanded = false;
    this.sectionDesignerCameraState = null;
    this.sectionDesignerCameraChanged = false;
    this.previewCameraState = null;
    this.previewActiveView = null;
    this.activeSectionDividerDrag = null;
    this.activeView = "front";
    this.arController = null;
    this.arControllerPromise = null;
    this.activeRangeDrag = null;
    this.profileFocusFrame = 0;
    this.cameraIntentFrame = 0;
    this.pendingCameraIntentCommand = null;
    this.cameraIntentState = createCameraIntentState({
      sourceStage: this.activeStageId,
      sourceSectionIndex: this.selectedSectionIndex
    });
    this.optionPreview = null;
    this.optionPreviewTimer = 0;
    this.price = this.hasAcceptedDesign ? this.pricing.total : null;
    if (this.hasAcceptedDesign) this.priceCalculationCount += 1;
    if (this.hasAcceptedDesign && this.designIntent === STUDIO_DESIGN_INTENTS.newDesign) {
      this.resetNewDesignPresentation();
    }
    this.render();
    this.cacheElements();
    this.viewer = this.hasAcceptedDesign ? this.createViewer(this.layout) : this.createStudioIntroViewer();
    this.bindEvents();
    if (this.hasAcceptedDesign) {
      if (this.arEnabled) this.initializeCabinetAr();
      this.renderInspector();
      this.syncInterface();
      this.initializeUnifiedModelInteraction();
      this.activateSectionDesigner({ render: false, announce: false, focusCamera: false });
      this.selectSection(this.selectedSectionIndex, { openProperties: true, render: true });
      this.viewer.setInteractionTool?.(this.activeTool);
      this.viewer.setDimensionsVisible?.(this.showDimensions);
      this.viewer.setWallVisible?.(this.showWall);
      this.setView("front");
      this.dispatchCameraIntent({
        type: "stage-change",
        stage: this.activeStageId,
        sectionIndex: this.selectedSectionIndex,
        duration: 0
      });
      this.verifyRestoredPaintSelection();
      this.emitStudioEvent("studio_entry_bypassed", { source: this.initialSource });
    } else {
      this.syncStudioEntry();
      this.emitWelcomeViewed();
    }
  }

  async verifyRestoredPaintSelection() {
    if (!this.hasAcceptedDesign || !this.state) return;
    const savedPaint = this.state.paintSelection;
    if (this.state.finish !== "custom_bm" || !savedPaint) return;
    try {
      const current = await this.colorCatalog.getById(savedPaint.catalogId) || await this.colorCatalog.getByCode(savedPaint.code);
      if (!current) this.showStatus(`Saved paint ${savedPaint.name} ${savedPaint.code} is no longer in the current catalog. Its saved digital preview is preserved.`, true);
    } catch (error) {
      this.showStatus("The current color catalog could not be checked. Your saved paint and digital preview are preserved.", true);
    }
  }

  resetNewDesignPresentation() {
    this.designIntent = STUDIO_DESIGN_INTENTS.newDesign;
    this.activeInspectorGroup = normalizeInspectorGroup("overall_size");
    this.activeStageId = "layout";
    this.activeInspectorTabId = "general";
    this.activeTool = "select";
    this.showDimensions = true;
    this.showWall = true;
    this.fullscreen = false;
    this.designHistory = { undo: [], redo: [], limit: 50 };
    this.inspectorGroupCollapsed = false;
    this.selection = null;
    this.hoverSelection = null;
    this.contextEditorOpen = false;
    this.contextAnchor = null;
    this.inspectorScrollPosition = 0;
    this.sectionDesignerActive = false;
    this.selectedSectionIndex = 0;
    this.sectionWidthDraft = "";
    this.sectionActionsExpanded = false;
  }

  consumeStudioStartParameter() {
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete("start");
    window.history.replaceState(window.history.state, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
  }

  loadInitialDesignRequest() {
    if (this.host.__cabinetArSharedConfiguration) {
      return { config: this.host.__cabinetArSharedConfiguration, source: "share", intent: STUDIO_DESIGN_INTENTS.newDesign };
    }
    const searchParams = new URLSearchParams(window.location.search);
    const requestedPresetId = searchParams.get("preset");
    const requestedPreset = layoutPresets.find((preset) => preset.id === requestedPresetId);
    if (requestedPreset) {
      return {
        config: {
          ...defaultBookcaseConfig,
          ...requestedPreset.config,
          layoutPreset: requestedPreset.id
        },
        source: "preset",
        intent: STUDIO_DESIGN_INTENTS.newDesign
      };
    }
    if (isStudioWelcomeRequest(window.location.search)) {
      this.consumeStudioStartParameter();
      return { config: null, source: "new", intent: STUDIO_DESIGN_INTENTS.newDesign };
    }
    const explicitResume = isStudioResumeRequest(window.location.search);
    if (explicitResume) this.consumeStudioStartParameter();
    try {
      const stored = JSON.parse(localStorage.getItem("jqBookcasesDesign") || "null");
      if (!stored || ![2, 3, 4, 5].includes(Number(stored.schemaVersion))) {
        return { config: null, source: "new", intent: STUDIO_DESIGN_INTENTS.newDesign };
      }
      const restored = restoreAcceptedDesignSnapshot(stored);
      return restored.accepted
        ? { config: restored.state, source: "saved", intent: STUDIO_DESIGN_INTENTS.resume }
        : { config: null, source: "new", intent: STUDIO_DESIGN_INTENTS.newDesign };
    } catch (error) {
      return { config: null, source: "new", intent: STUDIO_DESIGN_INTENTS.newDesign };
    }
  }

  createStudioIntroViewer() {
    return {
      update: () => false,
      setView: () => {},
      zoom: () => {},
      focus: () => {},
      preview: () => {},
      restorePreview: () => {},
      setDirectEditing: () => {},
      setSelectedComponent: () => false,
      clearDirectSelection: () => {},
      setInteractionTool: () => {},
      setDimensionsVisible: () => {},
      setWallVisible: () => {},
      resize: () => {},
      getComponentScreenAnchor: () => null,
      getSafeViewport: () => Object.freeze({ width: 0, height: 0, insets: Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 }) }),
      getMeasurementProjection: () => null,
      getViewState: () => null,
      getDiagnostics: () => ({
        instanceId: "studio-intro",
        presentationOnly: true,
        updateCount: 0,
        rebuildCount: 0,
        geometryCount: 0,
        textureCount: 0
      }),
      destroy: () => this.stopStudioPreviewMotion(),
      lastRenderAudit: { valid: true, issues: [] },
      lastRejectedRenderAudit: null
    };
  }

  createViewer(initialLayout = null) {
    if (!isWebGLAvailable()) return this.createViewerFallback();
    try {
      return new BookcaseViewer3D(
        this.elements.viewer,
        this.state,
        initialLayout,
        (interaction, detail) => this.handleViewerCameraInteraction(interaction, detail)
      );
    } catch (error) {
      return this.createViewerFallback();
    }
  }

  createViewerFallback() {
    this.elements.viewer.innerHTML = `
      <div class="viewer-fallback" role="status">
        <strong>3D preview requires WebGL.</strong>
        <span>Your configuration, pricing, and saved design still update here. Open this page in a WebGL-enabled browser to rotate the live model.</span>
      </div>
    `;
    return {
      update: () => true,
      setView: () => {},
      zoom: () => {},
      focus: () => {},
      preview: () => {},
      restorePreview: () => {},
      setDirectEditing: () => {},
      setSelectedComponent: () => false,
      clearDirectSelection: () => {},
      setInteractionTool: () => {},
      setDimensionsVisible: () => {},
      setWallVisible: () => {},
      resize: () => {},
      applyCameraIntent: () => false,
      adoptCameraIntent: () => {},
      cancelCameraTransition: () => {},
      getModelGeneration: () => 0,
      getComponentScreenAnchor: () => null,
      getSafeViewport: () => {
        const bounds = this.elements.viewer.getBoundingClientRect();
        return Object.freeze({
          width: bounds.width,
          height: bounds.height,
          insets: Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 }),
          localBounds: Object.freeze({ left: 0, top: 0, right: bounds.width, bottom: bounds.height })
        });
      },
      getMeasurementProjection: () => null,
      getViewState: () => null,
      getDiagnostics: () => ({ instanceId: "fallback", updateCount: 0, rebuildCount: 0 }),
      destroy: () => {},
      lastRenderAudit: { valid: true, issues: [] },
      lastRejectedRenderAudit: null
    };
  }

  render() {
    this.renderFullPageConfigurator();
  }

  renderWorkspaceStageRail() {
    return WORKSPACE_STAGES.map((stage, index) => {
      const active = stage.id === this.activeStageId;
      const icon = builderIcons[stage.icon || stage.id] || builderIcons.layout;
      return `
        <button type="button" class="workspace-stage${active ? " is-active" : ""}" data-workspace-stage="${escapeHtml(stage.id)}" aria-label="${escapeHtml(`${stage.label}: ${stage.subtitle}`)}" ${active ? 'aria-current="location"' : ""}>
          <span class="workspace-stage-icon" aria-hidden="true">${icon}</span>
          <span class="workspace-stage-copy"><strong>${escapeHtml(stage.label)}</strong><small>${escapeHtml(stage.subtitle)}</small></span>
          <span class="workspace-stage-state" aria-hidden="true">${index + 1}</span>
        </button>
      `;
    }).join("");
  }

  renderFullPageConfigurator() {
    if (!this.hasAcceptedDesign) {
      this.renderStudioEntryShell();
      return;
    }
    this.host.innerHTML = `
      <form class="builder-shell configurator-shell configurator-experience reference-workspace" data-builder-form data-unified-configurator data-configurator-workspace novalidate>
        <h1 id="${this.id}-viewer-title" class="sr-only">3D Bookcase Configurator</h1>
        <nav class="workspace-stage-rail" data-workspace-stages aria-label="Configurator stages">
          <div class="workspace-stage-list">${this.renderWorkspaceStageRail()}</div>
          ${this.arEnabled ? `
            <button class="workspace-ar-card" type="button" data-open-ar aria-label="View this design in your room">
              <span class="workspace-ar-mark" aria-hidden="true">AR</span>
              <span><strong>View in your room</strong><small>See it in your space</small></span>
              <i aria-hidden="true">${builderIcons.chevronRight}</i>
            </button>
          ` : ""}
        </nav>

        <section class="studio-model configurator-model workspace-model" data-model-workspace aria-labelledby="${this.id}-viewer-title">
          <header class="workspace-model-toolbar" data-model-toolbar>
            <div class="workspace-toolbar-group workspace-history-tools" role="group" aria-label="Design history">
              <button type="button" data-history-undo aria-label="Undo design change" aria-keyshortcuts="Control+Z Meta+Z" disabled><span aria-hidden="true">${builderIcons.undo}</span><b>Undo</b></button>
              <button type="button" class="is-redo" data-history-redo aria-label="Redo design change" aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y Meta+Y" disabled><span aria-hidden="true">${builderIcons.redo}</span><b>Redo</b></button>
            </div>
            <div class="workspace-toolbar-group workspace-display-tools" role="group" aria-label="Model display">
              <span>Show:</span>
              <button type="button" data-toggle-dimensions aria-pressed="true">Dimensions</button>
              <button type="button" data-toggle-wall aria-pressed="true">Wall</button>
            </div>
            <div class="workspace-toolbar-group workspace-model-tools" role="group" aria-label="Model interaction tool">
              <button type="button" data-model-tool="pan" aria-pressed="false" aria-label="Pan model" title="Pan model"><span aria-hidden="true">${builderIcons.pan}</span></button>
              <button type="button" data-model-tool="select" aria-pressed="true" aria-label="Select model component" title="Select model component"><span aria-hidden="true">${builderIcons.select}</span></button>
              <button type="button" data-reset-view aria-label="Reset model view" title="Reset model view"><span aria-hidden="true">${builderIcons.reset}</span></button>
              <button type="button" data-model-fullscreen aria-pressed="false" aria-label="Enter model fullscreen" title="Fullscreen model"><span aria-hidden="true">${builderIcons.fullscreen}</span></button>
            </div>
          </header>
          <div class="workspace-viewer-room" data-viewer-room>
            <div class="viewer-stage" data-3d-viewer tabindex="0" role="application" aria-roledescription="interactive 3D configurator" aria-label="Built-in bookcase model. Select a component to edit, or choose the hand tool to pan. Use plus or minus to zoom."></div>
            <div class="configurator-hover-label" data-model-hover-label hidden></div>
          </div>
        </section>

        <aside class="workspace-properties" data-properties-inspector data-controls-scroll aria-label="Design properties" tabindex="-1">
          <div class="workspace-properties-content" data-inspector-content></div>
        </aside>

        <section class="workspace-section-organizer" data-section-organizer aria-label="Bookcase sections">
          <div data-section-organizer-content></div>
        </section>

        <aside class="workspace-total-width" data-total-width-card aria-label="Total width status">
          <div data-total-width-content></div>
        </aside>

        <footer class="configurator-estimate-bar workspace-estimate-bar" data-estimate-bar aria-label="Estimate and next steps">
          <div class="configurator-price-block">
            <span class="price-kicker">Estimated price</span>
            <strong data-price>${formatPrice(this.pricing.total)}</strong>
            <p id="${this.id}-action-hint" class="configurator-quote-note" data-action-hint aria-live="polite">Pricing is estimated and subject to final measurements.</p>
          </div>
          <div class="studio-trust-row" aria-label="JQ Bookcases value commitments">
            <div class="studio-trust-item"><span class="studio-trust-icon" aria-hidden="true">${builderIcons.premiumMaterials}</span><span><strong>Premium Materials</strong><small>Furniture-grade construction</small></span></div>
            <div class="studio-trust-item"><span class="studio-trust-icon" aria-hidden="true">${builderIcons.craftsmanship}</span><span><strong>Expert Craftsmanship</strong><small>Built by skilled artisans</small></span></div>
            <div class="studio-trust-item"><span class="studio-trust-icon" aria-hidden="true">${builderIcons.customFit}</span><span><strong>Custom Fit</strong><small>Made for your exact space</small></span></div>
          </div>
          <div class="configurator-actions">
            <button class="configurator-save-button" type="button" data-save-design aria-label="Save Design">${builderIcons.save}<span>Save Design</span></button>
            <button class="configurator-quote-button" type="button" data-open-order="measurement">Request a Quote</button>
          </div>
        </footer>

        <dialog class="configurator-review-dialog" data-review-dialog aria-labelledby="${this.id}-review-dialog-title">
          <div class="configurator-review-dialog-shell">
            <div class="configurator-review-dialog-heading">
              <div><span class="section-kicker">Review Design</span><h2 id="${this.id}-review-dialog-title">Your custom bookcase</h2></div>
              <button type="button" data-close-review aria-label="Close design review">${builderIcons.close}</button>
            </div>
            <div data-review-dialog-content></div>
          </div>
        </dialog>

        ${this.arEnabled ? `<dialog class="cabinet-ar-dialog" data-ar-dialog aria-labelledby="cabinet-ar-title"></dialog>` : ""}

        <p class="sr-only" data-selection-live role="status" aria-live="polite" aria-atomic="true"></p>
        <p class="status-message" data-builder-status role="status" aria-live="polite"></p>
      </form>
    `;
  }

  renderStudioEntryShell() {
    this.entryView = normalizeStudioEntryView(this.entryView);
    this.host.innerHTML = `
      <form class="studio-entry-shell" data-builder-form data-entry-view="${this.entryView}" novalidate>
        <section class="studio-entry-copy" aria-labelledby="${this.id}-entry-title">
          ${this.renderStudioEntryCopyContent()}
        </section>

        <section class="studio-intro-stage" aria-label="Bookcase arrangement presentation">
          <div class="studio-preview-composition">
            <div class="studio-intro-preview" data-studio-intro-preview>
              ${this.renderStudioIntroPreview()}
            </div>
            <div class="studio-preview-variants" role="group" aria-label="Preview different bookcase arrangements">
              ${getStudioPreviewIdeas().map((idea, index) => `
                <button type="button" data-studio-preview-index="${index}" aria-pressed="${index === this.introPreviewIndex}">${escapeHtml(index === 0 ? "Open framework" : index === 1 ? "Mixed storage" : "Tall zones")}</button>
              `).join("")}
            </div>
          </div>
        </section>

        <footer class="studio-entry-lockbar" aria-label="Estimate available after starting a design">
          <span class="studio-entry-estimate-icon" aria-hidden="true">${builderIcons.customFit}</span>
          <div class="studio-entry-estimate">
            <strong data-price>Your project estimate will appear as you build</strong>
            <small>Pricing updates in real time based on your selections and changes.</small>
          </div>
        </footer>
        <p class="status-message" data-builder-status role="status" aria-live="polite"></p>
      </form>
    `;
  }

  renderStudioEntryCopyContent() {
    return this.renderStudioEntryContent();
  }

  renderStudioEntryContent() {
    return `
      <header class="studio-welcome-heading">
        <span class="section-kicker">One studio. Total freedom.</span>
        <h1 id="${this.id}-entry-title"><span>Design any bookcase.</span> <em>Your vision, your way.</em></h1>
        <p>From layout and storage to finishes and lighting—customize every detail to create a built-in that’s perfectly yours.</p>
      </header>
      <ul class="studio-capability-list" aria-label="What you can customize">
        ${STUDIO_CAPABILITIES.map((capability, index) => `<li>${studioCapabilityIcons[index] || builderIcons.check}<span>${escapeHtml(capability)}</span></li>`).join("")}
      </ul>
      <div class="studio-entry-action">
        <button class="studio-start-button" type="button" data-studio-start><span>Start Building Your Bookcase</span><span aria-hidden="true">${builderIcons.chevronRight}</span></button>
      </div>
    `;
  }

  renderStudioIntroPreview() {
    const previewIdeas = getStudioPreviewIdeas();
    const idea = previewIdeas[clamp(this.introPreviewIndex, 0, previewIdeas.length - 1)] || previewIdeas[0];
    if (!idea) return "";
    const layout = generateBookcaseLayout(idea.config);
    return `
      <div class="studio-preview-scaffold" data-studio-preview-idea="${escapeHtml(idea.id)}">
        <div class="studio-preview-drawing">${this.renderPresetMini(idea, 1)}</div>
        <span class="studio-preview-measure is-height" aria-hidden="true"><strong>${layout.config.height} in</strong><small>Wall height</small></span>
        <span class="studio-preview-measure is-width" aria-hidden="true"><strong>${layout.config.width} in</strong><small>Wall width</small></span>
        ${idea.callouts.map((callout) => `
          <span class="studio-preview-callout is-${escapeHtml(callout.side)}" data-studio-preview-callout="${escapeHtml(callout.id)}" style="--studio-callout-y: ${escapeHtml(callout.y)}">${builderIcons[callout.icon] || builderIcons.check}<small>${escapeHtml(callout.label)}</small></span>
        `).join("")}
      </div>
      <p class="studio-preview-caption"><strong>${escapeHtml(idea.name)}</strong><span>${layout.config.sections} engine-derived sections · presentation only</span></p>
    `;
  }

  renderInspector(options = {}) {
    if (!this.elements?.inspectorContent) return;
    this.clearResetConfirmation();
    const focusedControl = options.preserveFocus === false ? null : this.captureWorkspaceFocus();
    const scrollTop = this.elements.controlsScroll?.scrollTop || 0;
    this.elements.inspectorContent.innerHTML = this.renderWorkspaceProperties();
    const renderedTitle = this.elements.inspectorContent.querySelector(".workspace-properties-heading h2")?.textContent?.trim();
    this.elements.controlsScroll?.setAttribute(
      "aria-label",
      this.selection && renderedTitle ? `${renderedTitle} properties` : "Design properties"
    );
    if (this.elements.sectionOrganizerContent) {
      this.elements.sectionOrganizerContent.innerHTML = this.renderSectionOrganizer();
    }
    if (this.elements.totalWidthContent) {
      this.elements.totalWidthContent.innerHTML = this.renderTotalWidthCard();
    }
    const stageList = this.elements.stageRail?.querySelector(".workspace-stage-list");
    if (stageList) stageList.innerHTML = this.renderWorkspaceStageRail();
    window.requestAnimationFrame(() => {
      if (!this.elements.controlsScroll) return;
      this.elements.controlsScroll.scrollTop = options.resetScroll ? 0 : scrollTop;
      this.restoreWorkspaceFocus(focusedControl);
    });
  }

  captureWorkspaceFocus() {
    const active = document.activeElement;
    if (!active || !this.host.contains(active)) return null;
    if (active.id) return { id: active.id };
    const attributes = [
      "data-workspace-stage",
      "data-hardware-type",
      "data-hardware-finish",
      "data-section-type",
      "data-section-select",
      "data-section-add",
      "data-section-duplicate",
      "data-section-delete",
      "data-section-equalize",
      "data-step-field",
      "data-section-width-step",
      "data-storage-section-step",
      "data-section-storage-step",
      "data-section-storage-field",
      "data-section-storage-preset",
      "data-toggle-color-search",
      "data-search-bm",
      "data-review-design"
    ];
    const attribute = attributes.find((name) => active.hasAttribute?.(name));
    if (!attribute) return null;
    return {
      attribute,
      attributeValue: active.getAttribute(attribute),
      value: "value" in active ? String(active.value) : null,
      direction: active.getAttribute("data-step-direction")
    };
  }

  restoreWorkspaceFocus(snapshot) {
    if (!snapshot) return;
    let target = snapshot.id ? this.host.querySelectorAll("[id]") : [];
    if (snapshot.id) {
      target = [...target].find((element) => element.id === snapshot.id) || null;
    } else {
      const candidates = [...this.host.querySelectorAll(`[${snapshot.attribute}]`)]
        .filter((element) => element.getAttribute(snapshot.attribute) === snapshot.attributeValue)
        .filter((element) => snapshot.value === null || !("value" in element) || String(element.value) === snapshot.value)
        .filter((element) => snapshot.direction === null || element.getAttribute("data-step-direction") === snapshot.direction);
      target = candidates[0] || null;
    }
    if (!target && ["data-section-delete", "data-section-duplicate"].includes(snapshot.attribute)) {
      target = this.host.querySelector(`[data-section-select="${this.selectedSectionIndex}"]`);
    }
    target?.focus?.({ preventScroll: true });
  }

  renderWorkspaceProperties() {
    const stage = WORKSPACE_STAGES.find((item) => item.id === this.activeStageId) || WORKSPACE_STAGES[0];
    const selectedSection = this.getSelectedSectionState();
    const title = this.selection
      ? this.selection.title
      : stage.id === "storage" ? "Interior options" : stage.label;
    const subtitle = this.selection
      ? (selectedSection ? formatSectionType(selectedSection.type) : this.selection.summary || stage.subtitle)
      : stage.id === "storage" ? "Shelves, doors & drawers" : stage.subtitle;
    return `
      <header class="workspace-properties-heading">
        <div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p></div>
        ${this.selection ? `<button type="button" data-close-selection aria-label="Clear model selection">${builderIcons.close}</button>` : ""}
      </header>
      <section class="workspace-properties-panel" role="region" aria-label="${escapeHtml(title)} controls" data-active-stage-panel="${escapeHtml(stage.id)}" data-inspector-view="${escapeHtml(stage.id)}">
        ${this.renderWorkspacePropertiesContent(selectedSection)}
      </section>
    `;
  }

  getSelectedSectionState() {
    const sections = getSectionDesignerState(this.state, this.layout).sections;
    const index = this.selection
      ? (Number.isInteger(this.selection.sectionIndex) ? this.selection.sectionIndex : -1)
      : this.selectedSectionIndex;
    return sections[index] || null;
  }

  renderWorkspacePropertiesContent(selectedSection) {
    if (this.selection) {
      const editorId = this.selection.editorId;
      if (editorId === "back") return this.renderBackPanelSummary();
      if (editorId === "body") return this.renderSpaceGroup();
    }
    if (this.activeStageId === "layout") return this.renderLayoutConsole();
    if (this.activeStageId === "storage") return this.renderStorageConsole(selectedSection);
    if (this.activeStageId === "base_top") return this.renderStructureGroup();
    if (this.activeStageId === "preview") return `
      <section class="workspace-preview-stage">
        <button class="workspace-review-launch" type="button" data-review-design>Review Design</button>
        ${this.renderServiceGroup()}
        <button class="workspace-reset-link" type="button" data-reset-design>Start over</button>
      </section>`;
    const groups = STAGE_CONTROL_GROUPS[this.activeStageId] || [];
    return groups.map((groupId) => this.renderControlGroup(groupId, "properties")).join("");
  }

  renderLayoutConsole() {
    const designer = getSectionDesignerState(this.state, this.layout);
    this.selectedSectionIndex = clamp(this.selectedSectionIndex, 0, Math.max(0, designer.sections.length - 1));
    const selected = designer.sections[this.selectedSectionIndex];
    if (!selected) return "";
    const widthValue = this.sectionWidthDraft || formatSectionWidth(selected.width);
    const duplicateAvailability = duplicateSection(this.state, this.layout, selected.index);
    const deleteAvailability = deleteSection(this.state, this.layout, selected.index);
    return `
      <section class="workspace-layout-console" data-layout-console aria-label="Section layout controls">
        <section class="workspace-console-block workspace-layout-count" aria-labelledby="${this.id}-layout-count-heading">
          <header class="workspace-console-heading">
            <div><span aria-hidden="true">${builderIcons.layout}</span><h3 id="${this.id}-layout-count-heading">Sections</h3></div>
            <p>Set the number of vertical sections. Room dimensions stay in Space.</p>
          </header>
          ${this.renderStepperControl("sections", "Number of sections", 1, 6)}
          <p class="control-helper section-limit-helper" data-section-limit></p>
        </section>
        <section class="workspace-console-block workspace-layout-width section-width-editor" aria-labelledby="${this.id}-section-width-label">
          <header class="workspace-console-heading is-selected-section">
            <div><span aria-hidden="true">${builderIcons.width}</span><h3 id="${this.id}-section-width-label">Section ${selected.index + 1} width</h3></div>
            <strong>${formatSectionWidth(selected.width)} in clear</strong>
          </header>
          <div class="section-width-input workspace-number-stepper">
            <button type="button" data-section-width-step="-0.5" aria-label="Decrease Section ${selected.index + 1} clear width">${builderIcons.minus}</button>
            <input id="${this.id}-section-width" data-section-width type="number" min="${designer.minimumClearWidth}" step="0.25" inputmode="decimal" value="${escapeHtml(widthValue)}" aria-labelledby="${this.id}-section-width-label" aria-describedby="${this.id}-section-width-help ${this.id}-section-width-error">
            <button type="button" data-section-width-step="0.5" aria-label="Increase Section ${selected.index + 1} clear width">${builderIcons.plus}</button>
            <span>in</span>
          </div>
          <p id="${this.id}-section-width-help" class="control-helper">Bookcase width stays ${formatSectionWidth(this.state.width)} in. Drag a model divider or use these controls.</p>
          <p id="${this.id}-section-width-error" class="inline-validation-message" data-section-width-error aria-live="polite"></p>
        </section>
        <div class="workspace-section-actions">
          <button type="button" data-section-equalize>${builderIcons.width}<span>Equalize Widths</span></button>
          <button type="button" data-section-duplicate ${duplicateAvailability.accepted ? "" : `disabled aria-describedby="${this.id}-duplicate-reason"`}>${builderIcons.copy}<span>Duplicate Section</span></button>
          <button type="button" class="is-destructive" data-section-delete ${deleteAvailability.accepted ? "" : `disabled aria-describedby="${this.id}-delete-reason"`}>${builderIcons.delete}<span>Delete Section</span></button>
        </div>
        ${duplicateAvailability.accepted ? "" : `<p id="${this.id}-duplicate-reason" class="workspace-action-reason"><strong>Duplicate unavailable:</strong> ${escapeHtml(duplicateAvailability.error?.message || "This section cannot be duplicated.")}</p>`}
        ${deleteAvailability.accepted ? "" : `<p id="${this.id}-delete-reason" class="workspace-action-reason"><strong>Delete unavailable:</strong> ${escapeHtml(deleteAvailability.error?.message || "This section cannot be deleted.")}</p>`}
      </section>
    `;
  }

  renderStorageConsole(selectedSection = null) {
    const designer = getSectionDesignerState(this.state, this.layout);
    const requestedIndex = Number.isInteger(selectedSection?.index)
      ? selectedSection.index
      : this.selectedSectionIndex;
    this.selectedSectionIndex = clamp(requestedIndex, 0, Math.max(0, designer.sections.length - 1));
    const selected = designer.sections[this.selectedSectionIndex];
    if (!selected) return "";
    const usesDoors = ["lower_doors", "tall_doors"].includes(selected.type);
    const usesDrawers = selected.type === "drawers";
    const usesLowerStorage = selected.type === "lower_doors" || usesDrawers;
    const arrangement = selected.doorLayout?.arrangement || selected.configuration?.doorArrangement || "auto";
    const generatedDoor = this.layout.components.find((component) => (
      component.role === "door" && component.id.startsWith(`${selected.id}-`)
    ));
    const arrangementAvailability = generatedDoor?.metadata?.arrangementAvailability || {};
    const activePresetId = selected.type === "tall_doors"
      ? (selected.doorStyle === "glass" ? "glass_display" : "full_doors")
      : selected.type === "lower_doors" ? "lower_doors"
        : selected.type === "drawers" ? "lower_drawers"
          : "open_shelves";
    const renderStorageStepper = (field, label, value, min, max, step = 1, unit = "") => `
      <div class="workspace-storage-stepper" data-section-storage-control="${field}">
        <label for="${this.id}-section-${field}">${escapeHtml(label)}</label>
        <div class="workspace-number-stepper">
          <button type="button" data-section-storage-step="${field}" data-step-direction="-${step}" data-min="${min}" data-max="${max}" aria-label="Decrease ${escapeHtml(label)}" ${Number(value) <= min ? "disabled" : ""}>${builderIcons.minus}</button>
          <input id="${this.id}-section-${field}" data-section-storage-field="${field}" type="number" min="${min}" max="${max}" step="${step}" inputmode="${Number(step) % 1 === 0 ? "numeric" : "decimal"}" value="${escapeHtml(value)}" aria-describedby="${this.id}-section-storage-scope ${this.id}-section-${field}-error">
          <button type="button" data-section-storage-step="${field}" data-step-direction="${step}" data-min="${min}" data-max="${max}" aria-label="Increase ${escapeHtml(label)}" ${Number(value) >= max ? "disabled" : ""}>${builderIcons.plus}</button>
          ${unit ? `<span aria-hidden="true">${escapeHtml(unit)}</span>` : ""}
        </div>
        <p id="${this.id}-section-${field}-error" class="inline-validation-message" data-section-storage-error="${field}" aria-live="polite"></p>
      </div>`;
    const renderStyleSelect = (field, label, options, value) => `
      <label class="workspace-storage-select">
        <span>${escapeHtml(label)}</span>
        <select data-section-storage-field="${field}" aria-describedby="${this.id}-section-storage-scope">
          ${options.map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === value ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
        </select>
      </label>`;
    const shelvesHeading = usesLowerStorage
      ? "Shelves above"
      : usesDoors ? "Interior shelves" : "Shelves";
    const frontsHeading = usesDrawers
      ? "Lower cabinet"
      : usesLowerStorage ? "Lower cabinet" : "Doors";
    const frontsIcon = usesDrawers ? builderIcons.drawers : builderIcons.doors;
    return `
      <section class="workspace-storage-console" data-storage-console data-selected-section-id="${escapeHtml(selected.stableId || selected.id)}" aria-labelledby="${this.id}-storage-section-heading">
        <header class="workspace-storage-section-header">
          <div class="workspace-storage-section-title">
            <span class="workspace-storage-section-icon" aria-hidden="true">${builderIcons.storage}</span>
            <div>
              <p>Selected section</p>
              <h3 id="${this.id}-storage-section-heading">Section ${selected.index + 1} of ${designer.sections.length}</h3>
            </div>
          </div>
          <nav class="workspace-storage-section-nav" aria-label="Choose a section to customize">
            <button type="button" data-storage-section-step="-1" aria-label="Customize previous section" ${selected.index === 0 ? "disabled" : ""}>${builderIcons.back}</button>
            <button type="button" data-storage-section-step="1" aria-label="Customize next section" ${selected.index === designer.sections.length - 1 ? "disabled" : ""}>${builderIcons.chevronRight}</button>
          </nav>
        </header>
        <p id="${this.id}-section-storage-scope" class="workspace-storage-scope-note"><strong>Each section is independent.</strong> These controls change only Section ${selected.index + 1}; choose another section above or in the organizer to customize it separately.</p>

        <section class="workspace-storage-presets" aria-labelledby="${this.id}-storage-layout-heading">
          <header class="workspace-console-heading">
            <div><h3 id="${this.id}-storage-layout-heading">Storage layout</h3></div>
            <small>Starting configurations</small>
          </header>
          <fieldset ${selected.locked ? "disabled" : ""}>
            <legend class="sr-only">Storage layout preset for Section ${selected.index + 1}</legend>
            <div class="workspace-storage-preset-grid">
              ${sectionStoragePresets.map((preset) => `
                <label class="workspace-storage-preset">
                  <input type="radio" name="${this.id}-section-storage-preset" data-section-storage-preset="${preset.id}" value="${preset.id}" ${activePresetId === preset.id ? "checked" : ""}>
                  <span>
                    <strong>${escapeHtml(preset.label)}</strong>
                    <small>${escapeHtml(preset.description)}</small>
                  </span>
                  ${activePresetId === preset.id ? `<i aria-hidden="true">${builderIcons.check}</i>` : ""}
                </label>
              `).join("")}
            </div>
          </fieldset>
          ${selected.locked ? `<p class="workspace-property-note" role="note">This preset feature is structurally locked.</p>` : ""}
        </section>

        ${usesDoors || usesDrawers ? `<section class="workspace-storage-detail workspace-storage-fronts ${usesDoors ? "workspace-storage-doors" : "workspace-storage-drawers"}" aria-labelledby="${this.id}-storage-fronts-heading">
          <header class="workspace-console-heading">
            <div><span aria-hidden="true">${frontsIcon}</span><h3 id="${this.id}-storage-fronts-heading">${frontsHeading}</h3></div>
            <small>Section ${selected.index + 1}</small>
          </header>
          <fieldset class="workspace-storage-detail-fields" ${selected.locked ? "disabled" : ""}>
            <legend class="sr-only">${frontsHeading} settings for Section ${selected.index + 1}</legend>
            ${usesLowerStorage ? renderStorageStepper("lowerStorageHeight", "Cabinet height", selected.lowerStorageHeight, 24, 42, 0.25, "in") : ""}
            ${usesDrawers ? renderStorageStepper("drawerCount", "Drawer count", selected.drawerCount, 1, 5) : ""}
            ${usesDrawers ? renderStyleSelect("drawerFrontStyle", "Drawer front", drawerFrontStyleOptions, selected.drawerFrontStyle) : ""}
            ${usesDoors ? renderStyleSelect("doorStyle", "Door style", doorStyleOptions, selected.doorStyle) : ""}
          </fieldset>
          ${usesDoors ? `<fieldset class="section-door-arrangement-field" ${selected.locked ? "disabled" : ""}>
            <legend>Door arrangement</legend>
            <div class="segmented-options section-door-arrangement-options">
              ${[["auto", "Auto"], ["single_hinge_left", "Left"], ["single_hinge_right", "Right"], ["pair", "Pair"]].map(([value, label]) => {
                const option = arrangementAvailability[value] || { enabled: true, reason: null };
                const reasonId = `${this.id}-storage-door-${value}-reason`;
                return `
                  <label class="${option.enabled === false ? "is-disabled" : ""}">
                    <input type="radio" name="${this.id}-section-door-arrangement" data-section-storage-field="doorArrangement" value="${value}" ${arrangement === value ? "checked" : ""} ${option.enabled === false ? `disabled aria-describedby="${reasonId}"` : `aria-describedby="${this.id}-section-storage-scope"`}>
                    <span>${label}</span>
                  </label>
                  ${option.reason ? `<small id="${reasonId}" class="sr-only">${escapeHtml(option.reason)}</small>` : ""}`;
              }).join("")}
            </div>
            <p class="control-helper">Auto chooses the best valid leaf arrangement for this section width.</p>
          </fieldset>` : ""}
        </section>` : ""}

        <section class="workspace-storage-detail workspace-storage-shelves" aria-labelledby="${this.id}-storage-shelves-heading">
          <header class="workspace-console-heading">
            <div><span aria-hidden="true">${builderIcons.shelves}</span><h3 id="${this.id}-storage-shelves-heading">${shelvesHeading}</h3></div>
            <small>Section ${selected.index + 1}</small>
          </header>
          <fieldset class="workspace-storage-detail-fields" ${selected.locked ? "disabled" : ""}>
            <legend class="sr-only">Shelf settings for Section ${selected.index + 1}</legend>
            ${renderStorageStepper("shelfCount", "Shelf count", selected.shelfCount, 0, 8)}
            <div class="workspace-storage-automatic" role="note">
              <span>Distribution</span>
              <strong>Evenly spaced automatically</strong>
            </div>
          </fieldset>
          <div class="workspace-storage-global" aria-labelledby="${this.id}-storage-global-heading">
            <header class="workspace-console-heading">
              <div><h3 id="${this.id}-storage-global-heading">Shelf thickness</h3></div>
              <strong class="workspace-global-badge">Global · all sections</strong>
            </header>
            <p class="control-helper">This construction choice applies to every shelf in the bookcase.</p>
            ${this.renderRangeControl("shelfThickness", "Shelf thickness", 0.75, 2, 0.25, "in")}
          </div>
        </section>

        ${selected.warnings?.length ? `<div class="section-warning" role="status">${selected.warnings.map((warning) => escapeHtml(warning.message)).join(" ")}</div>` : ""}
      </section>
    `;
  }

  renderBackPanelSummary() {
    return `
      <section class="workspace-readonly-property">
        <span aria-hidden="true">${builderIcons.backPanel}</span>
        <div><h3>Standard fitted back</h3><p>A continuous furniture-grade back is included behind every section and follows the selected finish. Custom back options are not yet available.</p></div>
        <strong>Included</strong>
      </section>
    `;
  }

  renderSectionThumbnail(section, semanticThumbnail = null) {
    const sectionType = section.type || semanticThumbnail?.sectionType || "open";
    const shelfCount = semanticThumbnail
      ? semanticThumbnail.shelfCount
      : sectionType === "tall_doors" ? 0 : Math.min(5, Math.max(2, Number(this.state.shelves) || 4));
    const drawerFrontCount = semanticThumbnail?.drawerFrontCount
      ?? (sectionType === "drawers" ? Math.min(4, Math.max(2, Number(this.state.drawerCount) || 3)) : 0);
    const doorLeafCount = semanticThumbnail?.doorLeafCount
      ?? (["lower_doors", "tall_doors"].includes(sectionType) ? 1 : 0);
    const lowerFronts = drawerFrontCount
      ? Array.from({ length: drawerFrontCount }, () => "<i></i>").join("")
      : sectionType === "lower_doors" && doorLeafCount ? Array.from({ length: doorLeafCount }, () => "<i class=\"is-door\"></i>").join("") : "";
    return `
      <span class="workspace-section-thumbnail is-${escapeHtml(sectionType)}">
        <span class="workspace-thumbnail-shelves">${Array.from({ length: shelfCount }, () => "<i></i>").join("")}</span>
        ${sectionType === "tall_doors" ? `<span class="workspace-thumbnail-tall-door is-${doorLeafCount > 1 ? "pair" : "single"}"></span>` : ""}
        ${lowerFronts ? `<span class="workspace-thumbnail-fronts">${lowerFronts}</span>` : ""}
      </span>
    `;
  }

  renderSectionOrganizer() {
    const organizer = createSectionOrganizerSummary(this.state, this.layout);
    const addAvailability = addSection(this.state, this.layout, this.selectedSectionIndex);
    return `
      <header class="workspace-organizer-summary">
        <div><strong>Sections (${organizer.sectionCount})</strong><small>${escapeHtml(organizer.totalClearWidthLabel)}</small>${addAvailability.accepted ? "" : `<small class="workspace-organizer-note">${escapeHtml(addAvailability.error?.message || "A section cannot be added.")}</small>`}</div>
      </header>
      <div class="workspace-section-cards" role="group" aria-label="Section organizer" data-section-count="${organizer.sectionCount}" style="--workspace-section-count:${organizer.sectionCount}">
        <button class="workspace-add-section" type="button" data-section-add ${addAvailability.accepted ? "" : `disabled title="${escapeHtml(addAvailability.error?.message || "A section cannot be added.")}"`}>
          <span aria-hidden="true">${builderIcons.plus}</span><strong>Add<br>Section</strong>
        </button>
        ${organizer.items.map((section) => {
          const duplicateAvailability = duplicateSection(this.state, this.layout, section.index);
          const deleteAvailability = deleteSection(this.state, this.layout, section.index);
          return `
          <article class="workspace-section-card${section.index === this.selectedSectionIndex ? " is-selected" : ""}" data-section-card="${section.index}">
            <button type="button" class="workspace-section-card-main" data-section-select="${section.index}" aria-pressed="${section.index === this.selectedSectionIndex}">
              ${this.renderSectionThumbnail(section, section.thumbnail)}
              <span><strong>${escapeHtml(section.title)}</strong><small>${escapeHtml(section.widthLabel.replace(" clear", ""))}</small></span>
              ${section.index === this.selectedSectionIndex ? `<i class="workspace-selected-check" aria-hidden="true">${builderIcons.check}</i>` : ""}
            </button>
            <div class="workspace-section-card-actions" role="group" aria-label="Section ${section.index + 1} actions">
              <button type="button" class="workspace-section-duplicate" data-section-duplicate="${section.index}" aria-label="Duplicate Section ${section.index + 1}" title="${escapeHtml(duplicateAvailability.accepted ? `Duplicate Section ${section.index + 1}` : duplicateAvailability.error?.message || "Unavailable")}" ${duplicateAvailability.accepted ? "" : "disabled"}>${builderIcons.copy}</button>
              <button type="button" class="workspace-section-delete" data-section-delete="${section.index}" aria-label="Delete Section ${section.index + 1}" title="${escapeHtml(deleteAvailability.accepted ? `Delete Section ${section.index + 1}` : deleteAvailability.error?.message || "Unavailable")}" ${deleteAvailability.accepted ? "" : "disabled"}>${builderIcons.delete}</button>
            </div>
          </article>
        `;}).join("")}
      </div>
    `;
  }

  renderTotalWidthCard() {
    const dimensionValidation = validateUnifiedConfiguration(this.state, this.layout, this.drafts, { groupId: "overall_size" });
    const accepted = dimensionValidation.valid !== false && this.layout?.validation?.valid !== false;
    return `
      <span>Total width</span>
      <strong>${formatSectionWidth(this.state.width)} <small>in</small></strong>
      <p>${accepted ? "Valid overall width" : "Review dimensions"}<i aria-hidden="true" class="${accepted ? "is-valid" : "is-invalid"}">${accepted ? builderIcons.check : builderIcons.information}</i></p>
    `;
  }

  renderControlGroup(groupId, surface = "inspector") {
    const originalId = this.id;
    if (surface !== "inspector") this.id = `${originalId}-${surface}`;
    try {
      if (groupId === "overall_size") return this.renderSpaceGroup();
      if (groupId === "sections_layout") return this.renderLayoutConsole();
      if (groupId === "shelves" || groupId === "storage_fronts") return this.renderStorageConsole();
      if (groupId === "base_crown") return this.renderStructureGroup();
      if (groupId === "finish") return this.renderFinishGroup();
      if (groupId === "hardware") return this.renderHardwareGroup();
      if (groupId === "lighting") return this.renderLightingGroup();
      if (groupId === "project_service") return this.renderServiceGroup();
      return "";
    } finally {
      this.id = originalId;
    }
  }

  renderShelvesGroup() {
    return `
      <section class="control-section control-section-storage" aria-labelledby="${this.id}-shelves-heading">
        <header><h2 id="${this.id}-shelves-heading"><span class="control-heading-icon" aria-hidden="true">${builderIcons.shelves}</span>Shelves</h2><p>These settings apply to every shelf-bearing section.</p></header>
        ${this.renderStepperControl("shelves", "Shelves per shelf-bearing section", 2, 8)}
        ${this.renderRangeControl("shelfThickness", "Shelf thickness", 0.75, 2, 0.25, "in")}
      </section>
    `;
  }

  renderStorageFrontsGroup(scope = "doors") {
    const isDrawers = scope === "drawers";
    const designer = getSectionDesignerState(this.state, this.layout);
    const matchingSections = designer.sections.filter((section) => isDrawers
      ? section.type === "drawers"
      : ["lower_doors", "tall_doors"].includes(section.type));
    const noun = isDrawers ? "drawer" : "door";
    const pluralNoun = isDrawers ? "drawers" : "doors";
    if (!matchingSections.length) {
      return `
        <section class="workspace-storage-empty" aria-labelledby="${this.id}-${noun}-empty-heading">
          <span aria-hidden="true">${isDrawers ? builderIcons.drawers : builderIcons.doors}</span>
          <h3 id="${this.id}-${noun}-empty-heading">No ${noun} sections yet</h3>
          <p>Choose which sections use ${pluralNoun} in Layout. Storage will then show their configuration here.</p>
          <button class="workspace-related-stage" type="button" data-section-select="${this.selectedSectionIndex}">Choose section types ${builderIcons.chevronRight}</button>
        </section>
      `;
    }
    const sectionButtons = matchingSections.map((section) => `
      <button type="button" data-storage-section-select="${section.index}" data-storage-section-tab="${scope}">Section ${section.index + 1}</button>
    `).join("");
    const generatedDrawerCount = Number(this.bom?.drawers?.frontCount || 0);
    return `
      <section class="control-section control-section-storage workspace-storage-task" data-storage-scope="${escapeHtml(scope)}" aria-label="${isDrawers ? "Drawer" : "Door"} controls">
        <header class="workspace-storage-task-summary">
          <div><span aria-hidden="true">${isDrawers ? builderIcons.drawers : builderIcons.doors}</span><h3>${matchingSections.length} ${noun} section${matchingSections.length === 1 ? "" : "s"}</h3></div>
          <p>${isDrawers ? "Count and front profile apply to every drawer section." : "Front profile applies to every door section. Open a section to set its door arrangement."}</p>
          <div class="workspace-storage-section-list" role="group" aria-label="${isDrawers ? "Drawer" : "Door"} sections">${sectionButtons}</div>
        </header>
        ${isDrawers ? `<div class="drawer-quantity-card">${this.renderStepperControl("drawerCount", "Drawers per section", 2, 5)}</div>` : ""}
        <section class="storage-control-group storage-fronts-group">
          ${this.renderDoorGroup(isDrawers ? "drawers" : "doors")}
        </section>
        ${isDrawers ? `<div class="generated-front-count"><span>Generated drawer fronts</span><strong>${generatedDrawerCount}</strong></div>` : ""}
        <button class="workspace-related-stage" type="button" data-section-select="${matchingSections[0].index}">Edit section types ${builderIcons.chevronRight}</button>
      </section>
    `;
  }

  renderSectionDesignerGroup() {
    const designer = getSectionDesignerState(this.state, this.layout);
    this.selectedSectionIndex = clamp(this.selectedSectionIndex, 0, Math.max(0, designer.sections.length - 1));
    const selected = designer.sections[this.selectedSectionIndex];
    if (!selected) return "";
    const typeLabels = {
      open: ["Open Shelves", "Full-height adjustable shelving"],
      lower_doors: ["Lower Doors", "Closed storage with shelves above"],
      drawers: ["Lower Drawers", `${this.state.drawerCount} drawers with shelves above`],
      tall_doors: ["Tall Door", "Fitted full-height hinged storage"]
    };
    const sectionComponents = this.layout.components.filter((component) => component.id.startsWith(`${selected.id}-`));
    const generated = {
      doors: sectionComponents.filter((component) => component.role === "door").length,
      drawers: sectionComponents.filter((component) => component.role === "drawer_front").length,
      handles: sectionComponents.filter((component) => component.role === "handle").length,
      shelves: sectionComponents.filter((component) => component.role === "shelf").length
    };
    const generatedDoor = sectionComponents.find((component) => component.role === "door");
    const doorAvailability = generatedDoor?.metadata?.arrangementAvailability || {};
    const doorArrangement = selected.doorLayout?.arrangement || "auto";
    const doorArrangementOptions = [
      ["auto", "Auto"],
      ["single_hinge_left", "Single, hinge left"],
      ["single_hinge_right", "Single, hinge right"],
      ["pair", "Pair"]
    ];
    const usesHingedDoors = selected.type === "lower_doors" || selected.type === "tall_doors";
    const widthValue = this.sectionWidthDraft || formatSectionWidth(selected.width);
    const splitMinimumWidth = designer.minimumClearWidth * 2 + designer.panelThickness;
    const splitTooNarrow = selected.width + 1e-6 < splitMinimumWidth;
    const splitDisabled = selected.locked || designer.sections.length >= this.layout.rules.maxSections || splitTooNarrow;
    const splitReason = selected.locked
      ? "This preset feature section cannot be split."
      : designer.sections.length >= this.layout.rules.maxSections
        ? `This design already uses the maximum of ${this.layout.rules.maxSections} sections.`
        : `Splitting requires room for two ${formatSectionWidth(designer.minimumClearWidth)} in clear sections plus the divider.`;
    const mergeLeftDisabled = selected.index === 0 || selected.locked || designer.sections[selected.index - 1]?.locked;
    const mergeRightDisabled = selected.index === designer.sections.length - 1 || selected.locked || designer.sections[selected.index + 1]?.locked;
    const mergeLeftReason = selected.locked
      ? "Locked feature sections cannot be merged."
      : selected.index === 0
        ? "Section 1 has no section to its left."
        : "The section to the left is a locked preset feature.";
    const mergeRightReason = selected.locked
      ? "Locked feature sections cannot be merged."
      : selected.index === designer.sections.length - 1
        ? `Section ${designer.sections.length} has no section to its right.`
        : "The section to the right is a locked preset feature.";
    return `
      <section class="section-designer is-inline" data-section-designer aria-label="Section Designer">
        <header class="section-overview-heading">
          <div><span class="section-kicker">Section Overview</span><h3>Choose a section to edit</h3></div>
          <p>All ${designer.sections.length} sections are shown below. The selected section is also highlighted in the preview.</p>
        </header>
        <div class="section-overview-grid" data-section-overview data-section-count="${designer.sections.length}" role="group" aria-label="Bookcase sections">
          ${designer.sections.map((section) => `
            <button type="button" data-section-select="${section.index}" aria-pressed="${section.index === selected.index}" class="section-overview-card${section.index === selected.index ? " is-selected" : ""}${section.locked ? " is-locked" : ""}">
              <span>Section ${section.index + 1}</span>
              <strong>${formatSectionWidth(section.width)} in</strong>
              <small>${escapeHtml(formatSectionType(section.type))}${section.locked ? " · Locked" : ""}</small>
              <i class="section-selected-mark" aria-hidden="true">${builderIcons.check}</i>
              ${section.index === selected.index ? '<span class="sr-only">Selected</span>' : ""}
            </button>
          `).join("")}
        </div>
        <section class="section-inspector" aria-labelledby="${this.id}-selected-section-heading">
          <header class="selected-section-heading">
            <div><span class="section-kicker">Selected section</span><h3 id="${this.id}-selected-section-heading">Section ${selected.index + 1}</h3></div>
            <strong>${escapeHtml(formatSectionType(selected.type))}</strong>
          </header>
          <div class="section-width-editor">
            <label for="${this.id}-section-width">Exact clear width</label>
            <div class="section-width-input">
              <button type="button" data-section-width-step="-0.5" aria-label="Decrease Section ${selected.index + 1} clear width by half an inch">${builderIcons.minus}</button>
              <input id="${this.id}-section-width" data-section-width type="number" min="${designer.minimumClearWidth}" step="0.25" inputmode="decimal" value="${escapeHtml(widthValue)}" aria-describedby="${this.id}-section-width-help ${this.id}-section-width-error">
              <span>in clear</span>
              <button type="button" data-section-width-step="0.5" aria-label="Increase Section ${selected.index + 1} clear width by half an inch">${builderIcons.plus}</button>
            </div>
            <p id="${this.id}-section-width-help" class="control-helper" data-section-drag-hint>Overall width stays ${this.state.width} in. Use these controls or drag an adjacent divider in the preview.</p>
            <p id="${this.id}-section-width-error" class="inline-validation-message" data-section-width-error aria-live="polite"></p>
          </div>
          <fieldset class="section-type-field" ${selected.locked ? "disabled" : ""}>
            <legend>Section type</legend>
            <div class="section-type-grid">
              ${Object.entries(typeLabels).map(([type, [label, description]]) => `
                <label class="section-type-card">
                  <input type="radio" name="${this.id}-section-type" data-section-type="${type}" ${selected.type === type ? "checked" : ""}>
                  <span><strong>${label}</strong><small>${description}</small></span>
                </label>
              `).join("")}
            </div>
          </fieldset>
          ${usesHingedDoors ? `
            <fieldset class="section-door-arrangement-field">
              <legend>Door arrangement</legend>
              <div class="segmented-options section-door-arrangement-options">
                ${doorArrangementOptions.map(([value, label]) => {
                  const option = doorAvailability[value] || { enabled: true, reason: null };
                  const reasonId = `${this.id}-door-arrangement-${value}-reason`;
                  return `
                    <label class="section-door-arrangement-option${option.enabled ? "" : " is-disabled"}" ${option.reason ? `title="${escapeHtml(option.reason)}"` : ""}>
                      <input type="radio" name="${this.id}-section-door-arrangement" data-section-door-arrangement="${value}" value="${value}" ${doorArrangement === value ? "checked" : ""} ${option.enabled ? "" : `disabled aria-describedby="${reasonId}"`}>
                      <span>${label}</span>
                    </label>
                    ${option.reason ? `<small id="${reasonId}" class="sr-only">${escapeHtml(option.reason)}</small>` : ""}
                  `;
                }).join("")}
              </div>
              <p class="control-helper">Auto selects one leaf when it fits the supported width, otherwise a valid pair.</p>
            </fieldset>
          ` : ""}
          ${selected.locked ? `<p class="section-lock-note">This section belongs to the preset’s ${escapeHtml(formatSectionType(selected.type))} zone. Change to a non-feature layout to edit its type.</p>` : ""}
          <dl class="section-generated-summary">
            <div><dt>Generated fronts</dt><dd>${generated.doors} doors · ${generated.drawers} drawers</dd></div>
            <div><dt>Hardware</dt><dd>${generated.handles} handles</dd></div>
            <div><dt>Adjustable shelves</dt><dd>${generated.shelves}</dd></div>
          </dl>
          ${selected.warnings.length ? `<div class="section-warning" role="status">${selected.warnings.map((warning) => escapeHtml(warning.message)).join(" ")}</div>` : ""}
          <details class="section-actions-disclosure" data-section-actions ${this.sectionActionsExpanded ? "open" : ""}>
            <summary>Section actions</summary>
            <div class="section-designer-actions">
              <button type="button" data-section-split ${splitDisabled ? `disabled aria-describedby="${this.id}-split-reason"` : ""}>Duplicate / Split</button>
              <button type="button" data-section-merge="left" ${mergeLeftDisabled ? `disabled aria-describedby="${this.id}-merge-left-reason"` : ""}>Merge Left</button>
              <button type="button" data-section-merge="right" ${mergeRightDisabled ? `disabled aria-describedby="${this.id}-merge-right-reason"` : ""}>Merge Right</button>
              <button type="button" data-section-equalize>Equalize Widths</button>
            </div>
            <p id="${this.id}-split-reason" class="sr-only">${escapeHtml(splitReason)}</p>
            <p id="${this.id}-merge-left-reason" class="sr-only">${escapeHtml(mergeLeftReason)}</p>
            <p id="${this.id}-merge-right-reason" class="sr-only">${escapeHtml(mergeRightReason)}</p>
          </details>
          <div class="section-history-actions" aria-label="Section edit history">
            <button type="button" data-section-undo ${this.designHistory.undo.length ? "" : `disabled aria-describedby="${this.id}-undo-reason"`}>Undo</button>
            <button type="button" data-section-redo ${this.designHistory.redo.length ? "" : `disabled aria-describedby="${this.id}-redo-reason"`}>Redo</button>
            <button type="button" data-section-reset>Reset to Preset</button>
          </div>
          <p id="${this.id}-undo-reason" class="sr-only">No section edit is available to undo.</p>
          <p id="${this.id}-redo-reason" class="sr-only">No section edit is available to redo.</p>
        </section>
      </section>
    `;
  }

  renderDoorGroup(scope = "all", options = {}) {
    const descriptions = {
      shaker: "Classic framed profile",
      flat: "Clean slab front",
      slim_shaker: "Narrow framed profile",
      glass: "Framed glass display door"
    };
    const renderProfiles = (field, options, kind) => options.map((option) => `
      <label class="door-style-card" data-front-profile="${kind}" data-front-style="${option.value}">
        <input data-field="${field}" name="${this.id}-${field}" type="radio" value="${option.value}">
        <span class="door-style-card-content">
          <span class="door-style-illustration" aria-hidden="true">${doorPreviewIcons[option.value]}</span>
          <span class="door-style-copy"><strong>${option.label}</strong><small>${descriptions[option.value]}</small></span>
        </span>
      </label>
    `).join("");
    const doorApplicability = options.alwaysVisible ? "" : ' data-applicability="doors"';
    const drawerApplicability = options.alwaysVisible ? "" : ' data-applicability="drawers"';
    return `
      <div class="front-profile-groups" data-front-profile-groups>
        ${scope === "drawers" ? "" : `<fieldset class="choice-field front-profile-group"${doorApplicability}>
          <legend>Door front profile</legend>
          <div class="door-style-grid">${renderProfiles("doorStyle", doorStyleOptions, "door")}</div>
          <div class="generated-front-count">
            <span>Generated door count</span>
            <output data-generated-door-count aria-live="polite"></output>
          </div>
        </fieldset>`}
        ${scope === "doors" ? "" : `<fieldset class="choice-field front-profile-group"${drawerApplicability}>
          <legend>Drawer front profile</legend>
          <div class="door-style-grid">${renderProfiles("drawerFrontStyle", drawerFrontStyleOptions, "drawer")}</div>
          <p class="control-helper">Drawer fronts support Shaker, Flat Panel, and Slim Shaker profiles.</p>
        </fieldset>`}
      </div>
    `;
  }

  renderServiceGroup() {
    const deliveries = deliveryOptions.map((option) => `
      <label class="service-option-card"><input data-field="delivery" name="${this.id}-delivery" type="radio" value="${option.value}"><span><span class="service-option-icon" aria-hidden="true">${deliveryOptionIcons[option.value]}</span><strong>${option.label}</strong></span></label>
    `).join("");
    const installations = installationOptions.map((option) => `
      <label class="service-option-card"><input data-field="installation" name="${this.id}-installation" type="radio" value="${option.value}"><span><span class="service-option-icon" aria-hidden="true">${installationOptionIcons[option.value]}</span><strong>${option.label}</strong></span></label>
    `).join("");
    return `
      <section class="control-section control-section-service">
        <fieldset class="choice-field"><legend>Delivery</legend><div class="option-card-grid service-option-grid is-delivery">${deliveries}</div></fieldset>
        <fieldset class="choice-field"><legend>Installation</legend><div class="option-card-grid service-option-grid is-installation">${installations}</div></fieldset>
      </section>
    `;
  }

  renderHardwareScheduleReview() {
    const schedule = Array.isArray(this.bom?.hardware?.schedule) ? this.bom.hardware.schedule : [];
    if (!schedule.length) return "";
    const catalogVersion = this.bom?.hardware?.catalogVersion || schedule[0]?.catalogVersion || "catalog snapshot";
    const cards = schedule.map((item) => {
      const productCode = item.manufacturerProductNumber || item.sku || "Manufacturer number not listed";
      const dimensions = [
        Number.isFinite(item.centerToCenterMm) && item.centerToCenterMm > 0 ? `${formatHardwareMillimeters(item.centerToCenterMm)} c.c.` : null,
        Number.isFinite(item.overallLengthMm) && item.overallLengthMm > 0 ? `${formatHardwareMillimeters(item.overallLengthMm)} overall` : null,
        Number.isFinite(item.projectionMm) && item.projectionMm > 0 ? `${formatHardwareMillimeters(item.projectionMm)} projection` : null
      ].filter(Boolean);
      const locations = (item.locations || []).map((location) => {
        const label = location.sectionId || location.hostId || "front";
        return `${label}${location.quantity > 1 ? ` (${location.quantity})` : ""}`;
      });
      const links = [...new Map(
        (item.links || [])
          .filter((link) => isSafeExternalUrl(link?.url))
          .map((link) => [link.url, link])
      ).values()];
      const warnings = [...new Set(item.warnings || [])];
      return `
        <article class="review-hardware-card">
          <header>
            <div><span>${escapeHtml(item.brand || "Verified catalog item")}</span><h4>${escapeHtml(item.family || item.variantId)}</h4></div>
            <strong aria-label="Quantity ${Number(item.quantity) || 0}">×${Number(item.quantity) || 0}</strong>
          </header>
          <dl>
            <div><dt>Exact variant</dt><dd>${escapeHtml(item.variantId)}</dd></div>
            <div><dt>Manufacturer no.</dt><dd>${escapeHtml(productCode)}</dd></div>
            <div><dt>Size</dt><dd>${escapeHtml([item.size, ...dimensions].filter(Boolean).join(" · ") || "Not specified")}</dd></div>
            <div><dt>Finish</dt><dd>${escapeHtml([item.finish, item.finishCode].filter(Boolean).join(" · ") || "Not specified")}</dd></div>
            <div><dt>Placement</dt><dd>${escapeHtml(formatHardwarePlacement(item.placement))}</dd></div>
            <div><dt>Location</dt><dd>${escapeHtml(locations.join(", ") || "Generated front locations")}</dd></div>
            <div><dt>Model</dt><dd>${escapeHtml(formatHardwareTechnicalLabel(item.modelAccuracy || "neutral proxy"))}</dd></div>
            <div><dt>Pricing</dt><dd>${escapeHtml(formatHardwarePricingPosture(item.pricing))}</dd></div>
          </dl>
          ${warnings.length ? `<aside><strong>Review</strong><ul>${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul></aside>` : ""}
          ${links.length ? `<nav aria-label="Official product and specification sources">${links.map((link) => `<a href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer noopener">${escapeHtml(link.type?.includes("spec") ? "Official specification" : link.title || "Official product source")}</a>`).join("")}</nav>` : ""}
        </article>
      `;
    }).join("");
    return `
      <section class="review-hardware-schedule" aria-labelledby="${this.id}-hardware-schedule-title">
        <header class="review-hardware-schedule__header">
          <div><span>Generated accepted components</span><h3 id="${this.id}-hardware-schedule-title">Hardware schedule</h3></div>
          <button type="button" data-edit-group="hardware">Edit</button>
        </header>
        <p>Exact catalog selections and quantities from the accepted model. Reference/list prices are estimates; final hardware pricing is confirmed in the JQ quote.</p>
        <div class="review-hardware-schedule__grid">${cards}</div>
        <small>Catalog ${escapeHtml(catalogVersion)}. Product facts and source links are preserved with the saved design.</small>
      </section>
    `;
  }

  renderReviewContent({ includeActions = true } = {}) {
    const groups = createReviewGroups(this.state, this.layout, this.basePresetId);
    const corrections = this.layout?.corrections || [];
    const engineeringWarnings = [...new Map(
      (this.layout?.validation?.warnings || [])
        .filter((item) => item.code === "SHELF_SUPPORT_REVIEW")
        .map((item) => [item.message, item])
    ).values()];
    return `
      <div class="configuration-review" data-review-content>
        <div class="review-summary-grid">
          ${groups.map((group) => `
            <section class="review-summary-group">
              <header><h3>${escapeHtml(group.title)}</h3><button type="button" data-edit-group="${escapeHtml(group.inspectorGroupId)}" ${group.inspectorField ? `data-edit-field="${escapeHtml(group.inspectorField)}"` : ""}>Edit</button></header>
              <dl>${group.items.map((item) => `<div><dt>${escapeHtml(item.label)}</dt><dd>${escapeHtml(item.value)}</dd></div>`).join("")}</dl>
            </section>
          `).join("")}
        </div>
        ${this.renderHardwareScheduleReview()}
        ${corrections.length ? `<aside class="review-assumptions"><strong>Adjusted for buildability</strong><ul>${corrections.map((item) => `<li>${escapeHtml(item.message || item)}</li>`).join("")}</ul></aside>` : ""}
        ${engineeringWarnings.length ? `<aside class="review-assumptions"><strong>Engineering review</strong><ul>${engineeringWarnings.map((item) => `<li>${escapeHtml(item.message)}</li>`).join("")}</ul></aside>` : ""}
        ${this.state.finish === "custom_bm" ? `<aside class="review-paint-disclaimer" aria-label="Digital paint preview notice">${escapeHtml(BENJAMIN_MOORE_COLOR_DATA_NOTICE)}</aside>` : ""}
        <div class="review-estimate">
          <span>Estimated project price</span><strong>${formatPrice(this.price)}</strong>
          <p>Final pricing is confirmed after measurements and project details are verified.</p>
        </div>
        ${includeActions ? `
          <div class="review-actions">
            ${this.arEnabled ? `<button type="button" data-open-ar aria-label="View in Your Room">${builderIcons.augmentedReality}<span>View in Your Room</span></button>` : ""}
            <button type="button" data-save-design aria-label="Save Design">${builderIcons.save}<span>Save Design</span></button>
            <button type="button" class="is-primary" data-open-order="measurement">Request a Quote</button>
          </div>
        ` : ""}
      </div>
    `;
  }

  renderPresetMini(preset, index) {
    const layout = generateBookcaseLayout(preset.config);
    const width = layout.config.width;
    const height = layout.config.height;
    const drawableRoles = new Set([
      "base",
      "side_panel",
      "top_panel",
      "bottom_panel",
      "divider",
      "shelf",
      "fixed_shelf",
      "door",
      "drawer_front",
      "crown",
      "trim"
    ]);
    const rectangles = layout.components
      .filter((component) => drawableRoles.has(component.role))
      .map((component) => {
        const role = component.role.replace(/_/g, "-");
        const style = component.metadata?.style ? ` is-${component.metadata.style.replace(/_/g, "-")}` : "";
        return `<rect class="mini-part mini-${role}${style}" x="${component.bounds.min.x}" y="${component.bounds.min.y}" width="${component.size.x}" height="${component.size.y}" rx="${component.role === "door" || component.role === "drawer_front" ? 0.35 : 0}"/>`;
      }).join("");
    const opening = layout.components.find((component) => component.id === "feature-opening");
    const openingMarker = opening ? this.renderPresetOpening(opening) : "";
    return `
      <span class="preset-mini is-${layout.config.layoutType.replace(/_/g, "-")}" data-mini-layout="${layout.config.layoutType}" data-mini-preset="${preset.id}">
        <span class="preset-number">${index}</span>
        <svg viewBox="0 0 ${width + 4} ${height + 4}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
          <g transform="translate(${width / 2 + 2} ${height + 2}) scale(1 -1)">
            ${rectangles}
            ${openingMarker}
          </g>
        </svg>
      </span>
    `;
  }

  renderPresetOpening(opening) {
    const kind = opening.metadata?.kind;
    const x = opening.bounds.min.x;
    const y = opening.bounds.min.y;
    const width = opening.size.x;
    const height = opening.size.y;
    if (kind === "media") {
      return `<rect class="mini-opening mini-media-screen" x="${x + width * 0.14}" y="${y + height * 0.27}" width="${width * 0.72}" height="${height * 0.48}" rx="1.2"/>`;
    }
    if (kind === "feature") {
      return `<rect class="mini-opening mini-firebox" x="${x + width * 0.25}" y="${y + height * 0.04}" width="${width * 0.5}" height="${height * 0.48}" rx="0.8"/><path class="mini-opening-line" d="M${x + width * 0.16} ${y + height * 0.56}H${x + width * 0.84}"/>`;
    }
    if (kind === "desk") {
      return `<path class="mini-opening-line" d="M${x + width * 0.08} ${y + height * 0.37}H${x + width * 0.92}M${x + width * 0.16} ${y + height * 0.37}V${y + height * 0.08}M${x + width * 0.84} ${y + height * 0.37}V${y + height * 0.08}"/>`;
    }
    return "";
  }

  renderSpaceGroup() {
    return `
      <section class="control-section control-section-dimensions">
        <h2><span class="control-heading-icon" aria-hidden="true">${builderIcons.dimensions}</span>Space</h2>
        ${this.renderRangeControl("width", "Wall width", 24, 144, 1, "in")}
        ${this.renderRangeControl("height", "Available height", 72, 120, 1, "in")}
        ${this.renderRangeControl("depth", "Bookcase depth", 10, 24, 1, "in")}
        <p class="control-helper">Measurements can be refined throughout the design. Final production dimensions are verified with your project details.</p>
      </section>
    `;
  }

  renderStructureStartGroup() {
    return `
      <section class="control-section control-section-sections" data-structure-editor>
        <div class="structure-count-control">
          ${this.renderStepperControl("sections", "Vertical sections", 1, 6)}
          <p class="control-helper section-limit-helper" data-section-limit></p>
        </div>
        ${this.renderSectionDesignerGroup()}
      </section>
    `;
  }

  renderStructureGroup() {
    const baseChoices = baseStyleOptions.map((option) => `
      <div class="style-choice" data-style="${option.value}">
        <input id="${this.id}-baseStyle-${option.value}" data-field="baseStyle" name="${this.id}-baseStyle" type="radio" value="${option.value}">
        <label for="${this.id}-baseStyle-${option.value}">
          <span class="style-diagram style-diagram-base" aria-hidden="true">${basePreviewIcons[option.value]}</span>
          <span>${option.label}</span>
        </label>
      </div>
    `).join("");
    const crownChoices = crownStyleOptions.map((option) => `
      <div class="style-choice" data-style="${option.value}">
        <input id="${this.id}-crownStyle-${option.value}" data-field="crownStyle" name="${this.id}-crownStyle" type="radio" value="${option.value}">
        <label for="${this.id}-crownStyle-${option.value}">
          <span class="style-diagram style-diagram-crown" aria-hidden="true">${crownPreviewIcons[option.value]}</span>
          <span>${option.label}</span>
        </label>
      </div>
    `).join("");

    return `
      <section class="control-section control-section-structure">
        <h2><span class="control-heading-icon" aria-hidden="true">${builderIcons.structure}</span>Base &amp; Top</h2>
        <fieldset class="structure-field">
          <legend>Base Style</legend>
          <div class="style-choice-grid base-choice-grid">${baseChoices}</div>
        </fieldset>
        <fieldset class="structure-field">
          <legend>Crown / Top Style</legend>
          <div class="style-choice-grid crown-choice-grid">${crownChoices}</div>
        </fieldset>
      </section>
    `;
  }

  renderFinishGroup() {
    const swatches = finishOptions.filter((option) => !option.custom).map((option) => {
        const match = option.label.match(/^(.*) (OC-\d+)$/);
        const name = match?.[1] || option.label;
        const code = match?.[2] || "";
        return `
          <div class="finish-choice">
            <input id="${this.id}-finish-${option.value}" data-field="finish" name="${this.id}-finish" type="radio" value="${option.value}">
            <label for="${this.id}-finish-${option.value}" title="${option.label}">
              <span class="finish-choice-dot" style="--swatch:${option.swatch}" aria-hidden="true"></span>
              <span>${name}<small>${code}</small></span>
            </label>
          </div>
        `;
      }).join("");

    const selected = this.state.finish === "custom_bm" ? this.state.paintSelection : null;
    const collection = selected?.collections?.join(", ") || "";
    const selectedCard = selected ? `
      <section class="bm-selected-color" aria-label="Applied Benjamin Moore color">
        <span class="bm-selected-swatch" style="--bm-result-color:${escapeHtml(selected.previewHex)}" aria-hidden="true"></span>
        <div><span>Benjamin Moore</span><strong>${escapeHtml(selected.name)}</strong><small>${escapeHtml(selected.code)}${collection ? ` · ${escapeHtml(collection)}` : ""}</small></div>
        <span class="bm-applied-badge">Applied to bookcase</span>
      </section>
    ` : "";

    return `
        <section class="control-section control-section-finish">
          <h2><span class="control-heading-icon" aria-hidden="true">${builderIcons.finish}</span>Finish</h2>
          <fieldset class="finish-field">
            <legend>Popular JQ Colors</legend>
            <div class="finish-choice-grid">${swatches}</div>
          </fieldset>
          ${selectedCard}
          <button class="additional-colors-button" type="button" data-toggle-color-search>${this.showColorSearch ? "Close Benjamin Moore Search" : selected ? "Change Benjamin Moore color" : "Benjamin Moore Search"}</button>
          <div class="bm-search" data-custom-bm-fields role="region" aria-label="Benjamin Moore color search" ${this.showColorSearch ? "" : "hidden"}>
            <div class="bm-search-heading"><span><strong>Benjamin Moore Color</strong><small>Search by color name or code.</small></span><button class="bm-search-close" type="button" data-toggle-color-search data-color-search-close aria-label="Close Benjamin Moore color search">${builderIcons.close}</button></div>
            <label for="${this.id}-customPaintColor">Color name or code</label>
            <div class="bm-search-input">
              <input id="${this.id}-customPaintColor" data-bm-query data-validation-field="customPaintColor" data-default-describedby="${this.id}-bm-help ${this.id}-bm-disclaimer" type="search" maxlength="80" placeholder="OC-17, HC-154, White Dove…" autocomplete="off" aria-describedby="${this.id}-bm-help ${this.id}-bm-disclaimer">
              <button type="button" data-search-bm aria-label="Search Benjamin Moore colors">${builderIcons.search}</button>
            </div>
            <p id="${this.id}-bm-help" class="bm-search-help">Examples: OC-17, HC-154, White Dove, Hale Navy</p>
            <div class="bm-search-results" id="${this.id}-bm-results" data-bm-results aria-label="Benjamin Moore search results" hidden></div>
            <p class="inline-validation-message" data-field-error="customPaintColor" aria-live="polite"></p>
            <p class="bm-search-status" data-bm-status role="status" aria-live="polite">Search the official local palette catalog. Your current finish will not change until you apply a result.</p>
            <p id="${this.id}-bm-disclaimer" class="bm-preview-disclaimer">${escapeHtml(BENJAMIN_MOORE_COLOR_DATA_NOTICE)}</p>
            <a class="bm-official-link" href="${BENJAMIN_MOORE_OFFICIAL_COLORS_URL}" target="_blank" rel="noopener noreferrer">Browse Benjamin Moore colors</a>
          </div>
        </section>
    `;
  }

  renderHardwareGroup() {
    const applicability = getApplicability(this.state, this.layout);
    const hasHardwareHosts = applicability.showHardware;
    const currentType = getHardwareType(this.state.hardware) || hardwareTypeOptions[0].value;
    const currentFinish = getHardwareFinish(this.state.hardware);
    const types = hardwareTypeOptions.map((option) => `
      <label class="hardware-type-choice">
        <input data-hardware-type name="${this.id}-hardware-type" type="radio" value="${option.value}" ${option.value === currentType ? "checked" : ""}>
        <span><i aria-hidden="true">${hardwareTypeIcons[option.value]}</i><strong>${escapeHtml(option.label)}</strong><em class="hardware-selected-mark" aria-hidden="true">${builderIcons.check}</em></span>
      </label>
    `).join("");
    const finishes = getHardwareFinishesForType(currentType)
      .map((finish) => getHardwareFinishOption(finish))
      .filter(Boolean)
      .map((option) => `
        <label class="hardware-finish-choice">
          <input data-hardware-finish name="${this.id}-hardware-finish" type="radio" value="${option.value}" ${option.value === currentFinish ? "checked" : ""}>
          <span><i style="--hardware-finish:${option.swatch}" aria-hidden="true"></i><strong>${escapeHtml(option.label)}</strong><em class="hardware-selected-mark" aria-hidden="true">${builderIcons.check}</em></span>
        </label>
      `).join("");
    return `
        <section class="control-section control-section-hardware">
          <h2><span class="control-heading-icon" aria-hidden="true">${builderIcons.hardware}</span>Hardware</h2>
          <div class="hardware-selection">
            ${hasHardwareHosts ? "" : `
              <div class="workspace-hardware-notice" data-hardware-empty-state role="note" id="${this.id}-hardware-host-note">
                <span aria-hidden="true">${builderIcons.information}</span>
                <p><strong>No hardware quantity yet.</strong> Choose a type and finish now; it will be applied automatically when you add doors or drawers.</p>
                <button class="workspace-related-stage" type="button" data-workspace-stage-link="storage">Add fronts in Storage ${builderIcons.chevronRight}</button>
              </div>`}
            <p class="control-scope-note">Standard type and finish apply to all visible hardware. Use the expanded library for an exact front, section, or matching-front scope.</p>
            <fieldset class="hardware-type-field">
              <legend>Type</legend>
              <div class="hardware-type-grid">${types}</div>
            </fieldset>
            <fieldset class="hardware-finish-field">
              <legend>Finish</legend>
              <div class="hardware-finish-grid">${finishes}</div>
            </fieldset>
            <button class="additional-colors-button hardware-library-button" type="button" data-open-hardware-library ${hasHardwareHosts ? "" : `disabled aria-describedby="${this.id}-hardware-host-note" title="Add a door or drawer before assigning catalog hardware to an exact front."`}>Open expanded hardware library</button>
          </div>
        </section>
    `;
  }

  renderLightingGroup() {
    const generatedLightCount = getApplicability(this.state, this.layout).generatedLightCount;
    const scopeNote = generatedLightCount > 0
      ? `Applies to all ${generatedLightCount} compatible ${generatedLightCount === 1 ? "location" : "locations"} in the accepted design.`
      : "Choose a lighting package to generate compatible locations across the accepted design.";
    const lighting = lightingOptions.map((option) => `
        <div class="lighting-card" data-lighting="${option.value}">
          <input id="${this.id}-lighting-${option.value}" data-field="lighting" name="${this.id}-lighting" type="radio" value="${option.value}">
          <label for="${this.id}-lighting-${option.value}">
            <span class="lighting-card-icon" aria-hidden="true">${lightingPreviewIcons[option.value]}</span>
            <span>${option.label}</span>
          </label>
        </div>
      `).join("");
    const warmth = lightingWarmthOptions.map((option) => `
        <div class="warmth-choice">
          <input id="${this.id}-lightingWarmth-${option.value}" data-field="lightingWarmth" name="${this.id}-lightingWarmth" type="radio" value="${option.value}">
          <label for="${this.id}-lightingWarmth-${option.value}"><strong>${option.label}</strong><small>${option.description}</small></label>
        </div>
      `).join("");
    return `
        <section class="control-section control-section-lighting">
          <h2><span class="control-heading-icon" aria-hidden="true">${builderIcons.lighting}</span>Lighting</h2>
          <p class="control-scope-note">${scopeNote}</p>
          <fieldset class="lighting-field">
            <legend class="sr-only">Lighting package</legend>
            <div class="lighting-grid">${lighting}</div>
          </fieldset>
          <fieldset class="warmth-field" data-applicability="lighting-warmth">
            <legend>Warmth</legend>
            <div class="warmth-grid">${warmth}</div>
          </fieldset>
        </section>
    `;
  }

  renderRangeControl(name, label, min, max, step, unit) {
    return `
      <div class="range-control" data-range-control="${name}">
        <div class="range-label">
          <label for="${this.id}-${name}-range">${label}</label>
          <div class="range-value">
            <input id="${this.id}-${name}-number" data-field="${name}" type="number" min="${min}" max="${max}" step="${step}" inputmode="${Number(step) % 1 === 0 ? "numeric" : "decimal"}" aria-label="${label} value">
            ${unit ? `<span>${unit}</span>` : ""}
          </div>
        </div>
        <input id="${this.id}-${name}-range" data-field="${name}" type="range" min="${min}" max="${max}" step="${step}">
        <div class="range-bounds" aria-hidden="true"><span>${min}</span><span>${max}</span></div>
        <p class="inline-validation-message" data-field-error="${name}" aria-live="polite"></p>
      </div>
    `;
  }

  renderStepperControl(name, label, min, max) {
    return `
      <div class="stepper-control" data-stepper-control="${name}">
        <span>${label}</span>
        <div class="stepper">
          <button type="button" data-step-field="${name}" data-step-direction="-1" aria-label="Decrease ${label}">${builderIcons.minus}</button>
          <input id="${this.id}-${name}-number" data-field="${name}" type="number" min="${min}" max="${max}" step="1" inputmode="numeric" aria-label="${label}">
          <button type="button" data-step-field="${name}" data-step-direction="1" aria-label="Increase ${label}">${builderIcons.plus}</button>
        </div>
        <p class="inline-validation-message" data-field-error="${name}" aria-live="polite"></p>
      </div>
    `;
  }

  cacheElements() {
    this.elements = {
      shell: this.host.querySelector("[data-builder-form]"),
      viewer: this.host.querySelector("[data-3d-viewer]"),
      studioIntroPreview: this.host.querySelector("[data-studio-intro-preview]"),
      form: this.host.querySelector("[data-builder-form]"),
      price: this.host.querySelector("[data-price]"),
      status: this.host.querySelector("[data-builder-status]"),
      controlsScroll: this.host.querySelector("[data-controls-scroll]"),
      inspectorContent: this.host.querySelector("[data-inspector-content]"),
      stageRail: this.host.querySelector("[data-workspace-stages]"),
      modelWorkspace: this.host.querySelector("[data-model-workspace]"),
      sectionOrganizerContent: this.host.querySelector("[data-section-organizer-content]"),
      totalWidthContent: this.host.querySelector("[data-total-width-content]"),
      contextEditor: this.host.querySelector("[data-contextual-editor]"),
      contextContent: this.host.querySelector("[data-context-content]"),
      contextTitle: this.host.querySelector("[data-context-title]"),
      contextSummary: this.host.querySelector("[data-context-summary]"),
      contextEyebrow: this.host.querySelector("[data-context-eyebrow]"),
      contextLeader: this.host.querySelector("[data-context-leader]"),
      contextLeaderLine: this.host.querySelector("[data-context-leader-line]"),
      contextAnchorDot: this.host.querySelector("[data-context-anchor-dot]"),
      hoverLabel: this.host.querySelector("[data-model-hover-label]"),
      selectionLive: this.host.querySelector("[data-selection-live]"),
      reviewDialog: this.host.querySelector("[data-review-dialog]"),
      reviewDialogContent: this.host.querySelector("[data-review-dialog-content]"),
      arDialog: this.host.querySelector("[data-ar-dialog]")
    };
  }

  emitStudioEvent(name, detail = {}) {
    const safeDetail = Object.freeze({
      ...detail,
      entryView: this.hasAcceptedDesign ? "accepted" : this.entryView
    });
    this.analyticsEvents.push({ name, detail: safeDetail });
    this.host.dispatchEvent(new CustomEvent("jq:studio", {
      bubbles: true,
      detail: Object.freeze({ name, ...safeDetail })
    }));
  }

  emitWelcomeViewed() {
    if (this.welcomeViewed) return;
    this.welcomeViewed = true;
    this.emitStudioEvent("studio_welcome_viewed", { source: "new" });
  }

  syncStudioEntry() {
    document.body.dataset.studioState = "presentation";
    if (!this.elements?.shell) return;
    this.elements.shell.dataset.diagnosticAcceptedDesign = "false";
    this.elements.shell.dataset.diagnosticEntryView = this.entryView;
    this.elements.shell.dataset.diagnosticPhysicalUpdates = "0";
    this.elements.shell.dataset.diagnosticPriceCalculations = "0";
    this.elements.shell.dataset.diagnosticCanvasCount = "0";
    this.elements.shell.dataset.diagnosticViewerInstance = "studio-intro";
    this.elements.shell.dataset.diagnosticConfiguration = "null";
    this.elements.shell.dataset.diagnosticPricing = "null";
    this.startStudioPreviewMotion();
  }

  startStudioPreviewMotion() {
    this.stopStudioPreviewMotion();
    if (this.hasAcceptedDesign || this.introPreviewStopped || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const previewIdeas = getStudioPreviewIdeas();
    if (previewIdeas.length < 2) return;
    this.introPreviewTimer = window.setInterval(() => {
      this.setStudioPreview((this.introPreviewIndex + 1) % previewIdeas.length, { manual: false });
    }, 3600);
  }

  stopStudioPreviewMotion(permanent = false) {
    window.clearInterval(this.introPreviewTimer);
    this.introPreviewTimer = 0;
    if (permanent) this.introPreviewStopped = true;
  }

  setStudioPreview(index, options = {}) {
    const previewIdeas = getStudioPreviewIdeas();
    if (!previewIdeas.length) return;
    this.introPreviewIndex = clamp(Number(index) || 0, 0, previewIdeas.length - 1);
    if (options.manual) this.stopStudioPreviewMotion(true);
    if (this.elements?.studioIntroPreview) this.elements.studioIntroPreview.innerHTML = this.renderStudioIntroPreview();
    this.host.querySelectorAll("[data-studio-preview-index]").forEach((button) => {
      button.setAttribute("aria-pressed", String(Number(button.dataset.studioPreviewIndex) === this.introPreviewIndex));
    });
  }

  handleStudioStart() {
    const selectedSections = suggestStudioSectionCount(STUDIO_PROVISIONAL_DIMENSIONS.width);
    const startingPoint = createNeutralCustomConfig({ ...STUDIO_PROVISIONAL_DIMENSIONS, sections: selectedSections });
    if (!startingPoint.accepted) {
      this.showStatus(startingPoint.issues[0]?.message || "The design studio could not start.", true);
      return;
    }
    this.emitStudioEvent("studio_build_started", { sectionCount: selectedSections });
    this.acceptStudioDesign(startingPoint.config, { source: "custom" });
  }

  acceptStudioDesign(config, options = {}) {
    const evaluation = evaluateBookcaseCandidate(config);
    if (!evaluation.accepted) {
      this.showStatus(evaluation.errors[0]?.message || "This starting point could not be created.", true);
      return false;
    }
    this.stopStudioPreviewMotion(true);
    this.viewer?.destroy?.();
    this.hasAcceptedDesign = true;
    this.initialSource = options.source || "custom";
    this.acceptedEvaluation = evaluation;
    this.state = evaluation.state;
    this.layout = evaluation.layout;
    this.bom = evaluation.bom;
    this.pricing = evaluation.pricing;
    this.price = evaluation.pricing.total;
    this.basePresetId = inferBasePresetId(this.state);
    this.priceCalculationCount += 1;
    this.drafts = {};
    this.designIntent = STUDIO_DESIGN_INTENTS.newDesign;
    this.resetNewDesignPresentation();
    this.render();
    this.cacheElements();
    this.viewer = this.createViewer(this.layout);
    if (this.arEnabled) this.initializeCabinetAr();
    document.body.dataset.studioState = "accepted";
    this.renderInspector({ resetScroll: true });
    this.syncInterface();
    this.initializeUnifiedModelInteraction();
    this.activateSectionDesigner({ render: false, announce: false, focusCamera: false });
    this.selectSection(this.selectedSectionIndex, { openProperties: true, render: true });
    this.viewer.setInteractionTool?.(this.activeTool);
    this.viewer.setDimensionsVisible?.(this.showDimensions);
    this.viewer.setWallVisible?.(this.showWall);
    this.setView("front");
    this.dispatchCameraIntent({
      type: "stage-change",
      stage: this.activeStageId,
      sectionIndex: this.selectedSectionIndex,
      duration: 0
    });
    this.directHardwareEditorPromise = null;
    this.emitStudioEvent("studio_design_accepted", {
      source: this.initialSource,
      ideaId: options.ideaId || null,
      sectionCount: this.state.sections
    });
    window.requestAnimationFrame(() => this.elements.controlsScroll?.focus?.({ preventScroll: true }));
    return true;
  }

  initializeCabinetAr() {
    if (this.arControllerPromise) return this.arControllerPromise;
    this.arControllerPromise = import("./cabinet-ar-ui.js?v=reference-layout-20260715g")
      .then(({ CabinetArController }) => {
        if (!this.elements.arDialog) return null;
        this.arController = new CabinetArController({
          host: this.host,
          dialog: this.elements.arDialog,
          getState: () => this.state,
          getLayout: () => this.layout,
          getPrice: () => this.price
        });
        return this.arController;
      })
      .catch(() => null);
    return this.arControllerPromise;
  }

  initializeDirectHardwareEditor() {
    if (!this.directHardwareEditingEnabled || !this.hasAcceptedDesign) return Promise.resolve(null);
    if (this.directHardwareEditorPromise) return this.directHardwareEditorPromise;
    document.body.dataset.directHardwareEditing = "loading";
    this.directHardwareEditorPromise = import("./direct-hardware-editor.js?v=engine-polish-20260716a")
      .then(async ({ DirectHardwareEditor }) => {
        if (!this.hasAcceptedDesign || !this.elements?.viewer) return null;
        this.directHardwareEditor?.destroy?.();
        this.directHardwareEditor = new DirectHardwareEditor({
          host: this.host,
          viewer: this.viewer,
          getState: () => this.state,
          getLayout: () => this.layout,
          getPricing: () => this.pricing,
          evaluateCandidate: (state) => evaluateBookcaseCandidate(state),
          commitState: (state, metadata = {}) => {
            this.viewer.restorePreview?.(this.state, this.layout);
            const committed = this.update(state, {
              sourceField: "hardwareSelections",
              silent: true,
              directHardware: metadata
            });
            if (committed) {
              this.showStatus(metadata.message || "Hardware selection applied to the accepted design.");
            }
            return committed;
          },
          emitEvent: (name, detail = {}) => this.emitStudioEvent(name, detail),
          announce: (message, persistent = false) => this.showStatus(message, persistent),
          ownsViewerSelection: false,
          showHelper: false,
          onClose: (reason) => this.handleDirectHardwareEditorClose(reason)
        });
        const ready = await this.directHardwareEditor.init();
        if (!ready) {
          document.body.dataset.directHardwareEditing = "fallback";
          return this.directHardwareEditor;
        }
        this.directHardwareEditor.setAvailable(true);
        document.body.dataset.directHardwareEditing = "ready";
        return this.directHardwareEditor;
      })
      .catch((error) => {
        document.body.dataset.directHardwareEditing = "fallback";
        this.emitStudioEvent("direct_hardware_fallback", { reason: error?.message || "module-load" });
        this.showStatus("The expanded hardware library is unavailable. The standard hardware controls remain available.", true);
        return null;
      });
    return this.directHardwareEditorPromise;
  }

  async openExpandedHardwareEditor() {
    const editor = await this.initializeDirectHardwareEditor();
    if (!editor) return false;
    const componentId = [
      this.selection?.componentId,
      this.selection?.hostId,
      this.selection?.highlightTarget?.componentId
    ].find((id) => this.layout.components.some((component) => component.id === id && ["handle", "door", "drawer_front"].includes(component.role)))
      || this.layout.components.find((component) => component.role === "handle")?.id
      || this.layout.components.find((component) => ["door", "drawer_front"].includes(component.role))?.id;
    if (!componentId || !editor.openForComponent(componentId)) {
      this.showStatus("Add a door or drawer before opening the expanded hardware library.", true);
      return false;
    }
    this.directHardwareOverlayOpen = true;
    this.elements?.shell?.classList.add("is-direct-hardware-open");
    this.contextEditorOpen = false;
    this.elements?.shell?.classList.remove("is-context-open");
    if (this.elements?.contextEditor) this.elements.contextEditor.hidden = true;
    if (this.elements?.contextLeader) this.elements.contextLeader.hidden = true;
    this.syncDiagnosticsAttributes();
    return true;
  }

  handleDirectHardwareEditorClose(reason) {
    this.directHardwareOverlayOpen = false;
    this.elements?.shell?.classList.remove("is-direct-hardware-open");
    if (!this.hasAcceptedDesign || reason === "destroy" || !this.selection) return;
    this.contextEditorOpen = true;
    this.renderContextEditor();
    this.syncInterface();
  }

  initializeUnifiedModelInteraction() {
    if (!this.hasAcceptedDesign || !this.viewer?.setDirectEditing) return;
    this.viewer.setDirectEditing({
      enabled: true,
      onHover: (payload) => this.handleModelHover(payload),
      onSelect: (payload) => this.handleModelSelection(payload),
      onAnchorChange: (anchor) => this.updateContextAnchor(anchor)
    });
  }

  resolveModelSelection(payload) {
    if (!payload) return null;
    const componentId = typeof payload === "string" ? payload : payload.componentId;
    if (!componentId) return null;
    const resolved = resolveSelectionContext(this.layout, componentId, payload.source || "canvas");
    if (!resolved) return null;
    return {
      ...resolved,
      anchorClientX: Number.isFinite(payload.anchorClientX) ? payload.anchorClientX : null,
      anchorClientY: Number.isFinite(payload.anchorClientY) ? payload.anchorClientY : null,
      projectedAnchor: payload.anchor || null,
      source: payload.source || resolved.source || "canvas"
    };
  }

  handleModelHover(payload) {
    this.hoverSelection = this.resolveModelSelection(payload);
    const label = this.elements?.hoverLabel;
    if (!label) return;
    if (!this.hoverSelection || this.contextEditorOpen) {
      label.hidden = true;
      return;
    }
    const anchor = payload?.anchor || this.viewer.getComponentScreenAnchor?.(this.hoverSelection.componentId);
    if (!anchor?.visible) {
      label.hidden = true;
      return;
    }
    label.textContent = this.hoverSelection.title;
    label.hidden = false;
    const viewerRect = this.elements.viewer.getBoundingClientRect();
    const modelRect = this.elements.viewer.closest(".configurator-model")?.getBoundingClientRect() || viewerRect;
    label.style.left = `${anchor.x + viewerRect.left - modelRect.left}px`;
    label.style.top = `${anchor.y + viewerRect.top - modelRect.top}px`;
  }

  handleModelSelection(payload) {
    if (!payload) {
      if (this.directHardwareOverlayOpen) this.directHardwareEditor?.close?.("blank-canvas");
      this.closeContextEditor({ clearViewer: false, announce: false });
      return false;
    }
    if (this.directHardwareOverlayOpen) {
      const componentId = typeof payload === "string" ? payload : payload.componentId;
      if (this.directHardwareEditor?.openForComponent?.(componentId)) return true;
      this.directHardwareEditor?.close?.("selection-changed");
    }
    const selection = this.resolveModelSelection(payload);
    if (!selection) return false;
    this.contextInvoker = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.selection = selection;
    this.contextEditorOpen = true;
    this.activeInspectorGroup = normalizeInspectorGroup(selection.inspectorGroupId);
    const workspaceRoute = resolveWorkspaceSelection(selection, this.layout);
    this.activeStageId = workspaceRoute?.stageId || selection.stageId || "layout";
    this.activeInspectorTabId = "general";
    this.inspectorGroupCollapsed = false;
    if (Number.isInteger(selection.sectionIndex)) this.selectedSectionIndex = selection.sectionIndex;
    this.viewer.setSectionSelection?.(this.selectedSectionIndex);
    this.viewer.setSelectedComponent?.(selection.highlightTarget?.componentId || selection.componentId);
    this.renderInspector({ focusGroup: this.activeInspectorGroup });
    this.syncInterface();
    this.dispatchCameraIntent({
      type: "selection-change",
      stage: this.activeStageId,
      sectionIndex: this.selectedSectionIndex,
      selection
    });
    this.activeView = "custom";
    const announcement = `${selection.title} selected.`;
    if (this.elements.selectionLive) this.elements.selectionLive.textContent = announcement;
    if (selection.source === "keyboard") {
      window.requestAnimationFrame(() => this.host.querySelector("[data-close-selection]")?.focus({ preventScroll: true }));
    }
    return true;
  }

  renderContextEditor() {
    // Context now renders in the fixed properties inspector. This compatibility
    // hook remains for existing update paths and intentionally creates no overlay.
  }

  getSelectionSummary(selection) {
    const sectionLabel = Number.isInteger(selection.sectionIndex) ? `Section ${selection.sectionIndex + 1}` : "";
    if (selection.kind === "shelf") return `${sectionLabel} · Shelf quantity applies to every shelf-bearing section.`;
    if (selection.kind === "hardware") return `${sectionLabel} · Standard hardware applies to all visible hardware.`;
    if (selection.kind === "divider") return "Resize the adjacent sections while preserving the overall width.";
    if (sectionLabel) return sectionLabel;
    return "Edits use the same accepted design transaction as the inspector.";
  }

  updateContextAnchor(anchor = null) {
    void anchor;
  }

  closeContextEditor(options = {}) {
    if (!this.contextEditorOpen && !this.selection) return;
    this.contextEditorOpen = false;
    this.selection = null;
    this.contextAnchor = null;
    this.elements?.shell?.classList.remove("is-context-open");
    if (this.elements?.contextEditor) this.elements.contextEditor.hidden = true;
    if (this.elements?.contextLeader) this.elements.contextLeader.hidden = true;
    if (this.elements?.hoverLabel) this.elements.hoverLabel.hidden = true;
    if (options.clearViewer !== false) this.viewer.clearDirectSelection?.();
    this.renderInspector();
    this.syncInterface();
    if (options.camera !== false) {
      this.dispatchCameraIntent({
        type: "selection-change",
        stage: this.activeStageId,
        sectionIndex: this.selectedSectionIndex,
        selection: null
      });
      this.activeView = "three-quarter";
    }
    if (options.restoreFocus && this.contextInvoker?.isConnected) this.contextInvoker.focus({ preventScroll: true });
    if (options.announce !== false && this.elements?.selectionLive) this.elements.selectionLive.textContent = "Model selection cleared.";
  }

  bindEvents() {
    const signal = this.eventAbortController.signal;
    this.host.addEventListener("submit", (event) => event.preventDefault(), { signal });
    this.host.addEventListener("pointerdown", (event) => {
      if (!this.hasAcceptedDesign && event.target.closest?.("[data-studio-intro-preview], [data-studio-preview-index]")) {
        this.stopStudioPreviewMotion(true);
      }
      if (event.target.closest?.("[data-3d-viewer]")) this.cancelQueuedProfileFocus();
      const divider = event.target.closest?.("[data-section-divider]");
      if (divider && this.host.contains(divider)) {
        this.beginSectionDividerDrag(event, divider);
        return;
      }
      const range = event.target.closest?.('.range-control input[type="range"][data-field]');
      if (!range || !this.host.contains(range)) return;
      this.focusCameraForField(range.dataset.field);
      this.beginRangeDrag(event, range);
    }, { signal });
    this.host.addEventListener("pointermove", (event) => {
      this.updateSectionDividerDrag(event);
      this.updateRangeDrag(event);
    }, { signal });
    this.host.addEventListener("pointerup", (event) => {
      this.endSectionDividerDrag(event);
      this.endRangeDrag(event);
    }, { signal });
    this.host.addEventListener("pointercancel", (event) => {
      this.cancelSectionDividerDrag(event);
      this.endRangeDrag(event, { applyFinal: false });
    }, { signal });
    this.host.addEventListener("lostpointercapture", (event) => {
      if (this.activeSectionDividerDrag?.handle === event.target) {
        this.cancelSectionDividerDrag(event);
        return;
      }
      if (this.activeRangeDrag?.range !== event.target) return;
      this.endRangeDrag(event, { applyFinal: false, releaseCapture: false });
    }, { signal });
    const cancelInterruptedPointerWork = () => {
      this.cancelSectionDividerDrag();
      this.endRangeDrag(null, { applyFinal: false });
    };
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") cancelInterruptedPointerWork();
    }, { signal });
    window.addEventListener("blur", cancelInterruptedPointerWork, { signal });

    this.host.addEventListener("pointerover", (event) => {
      if (event.pointerType === "touch") return;
      const label = event.target.closest?.("label");
      if (!label || !this.host.contains(label) || label.contains(event.relatedTarget)) return;
      const input = label.querySelector('input[data-field]') || (label.htmlFor ? document.getElementById(label.htmlFor) : null);
      if (!input?.matches?.("input[data-field]") || !this.host.contains(input)) return;
      this.focusCameraForField(input.dataset.field);
      this.scheduleOptionPreview(label, input);
    }, { signal });

    this.host.addEventListener("pointerout", (event) => {
      const label = event.target.closest?.("label");
      if (!label || !this.host.contains(label) || label.contains(event.relatedTarget)) return;
      this.endOptionPreview(label);
    }, { signal });

    this.host.addEventListener("focusin", (event) => {
      const field = event.target.closest?.("[data-field], [data-validation-field]");
      if (field && this.host.contains(field)) this.focusCameraForField(field.dataset.field || field.dataset.validationField);
    }, { signal });

    this.host.addEventListener("input", (event) => {
      const sectionWidth = event.target.closest?.("[data-section-width]");
      if (sectionWidth && this.host.contains(sectionWidth)) {
        this.sectionWidthDraft = sectionWidth.value;
        sectionWidth.removeAttribute("aria-invalid");
        const error = this.host.querySelector("[data-section-width-error]");
        if (error) error.textContent = "";
        return;
      }
      const sectionStorageNumber = event.target.closest?.('input[type="number"][data-section-storage-field]');
      if (sectionStorageNumber && this.host.contains(sectionStorageNumber)) {
        this.clearSectionStorageInputError(sectionStorageNumber);
        return;
      }
      const colorQuery = event.target.closest?.("[data-bm-query]");
      if (colorQuery && this.host.contains(colorQuery)) {
        this.colorQueryDraft = colorQuery.value;
        window.clearTimeout(this.colorSearchTimer);
        this.colorSearchTimer = window.setTimeout(() => this.updateBenjaminMooreResults(colorQuery.value), 160);
        return;
      }
      const field = event.target.closest?.("[data-field]");
      if (!field || !this.host.contains(field)) return;
      if (field.type === "radio" || field.type === "checkbox" || field.tagName === "SELECT") return;
      if (field.type === "range" && this.activeRangeDrag?.range === field) return;
      this.handleFieldInput(field);
    }, { signal });

    this.host.addEventListener("change", (event) => {
      const sectionWidth = event.target.closest?.("[data-section-width]");
      if (sectionWidth && this.host.contains(sectionWidth)) {
        this.commitSelectedSectionWidth(sectionWidth.value);
        return;
      }
      const storagePresetInput = event.target.closest?.("[data-section-storage-preset]");
      if (storagePresetInput && this.host.contains(storagePresetInput)) {
        const preset = sectionStoragePresets.find((item) => item.id === storagePresetInput.dataset.sectionStoragePreset);
        if (preset) {
          this.commitSelectedSectionStorage(
            preset.patch,
            `${preset.label} applied to Section ${this.selectedSectionIndex + 1}.`
          );
        }
        return;
      }
      const sectionStorageInput = event.target.closest?.("[data-section-storage-field]");
      if (sectionStorageInput && this.host.contains(sectionStorageInput)) {
        const field = sectionStorageInput.dataset.sectionStorageField;
        let value = sectionStorageInput.value;
        if (sectionStorageInput.type === "number") {
          const validation = this.validateSectionStorageNumber(sectionStorageInput);
          if (!validation.valid) {
            this.showSectionStorageInputError(sectionStorageInput, validation.message);
            return;
          }
          value = validation.value;
          this.clearSectionStorageInputError(sectionStorageInput);
        }
        this.commitSelectedSectionStorage(
          { [field]: value },
          `${formatSectionStorageField(field)} updated for Section ${this.selectedSectionIndex + 1}.`
        );
        return;
      }
      const sectionTypeInput = event.target.closest?.("[data-section-type]");
      if (sectionTypeInput && this.host.contains(sectionTypeInput)) {
        this.commitSectionOperation(
          setSectionType(this.state, this.selectedSectionIndex, sectionTypeInput.dataset.sectionType, this.layout),
          `${formatSectionType(sectionTypeInput.dataset.sectionType)} applied to Section ${this.selectedSectionIndex + 1}.`
        );
        return;
      }
      const doorArrangementInput = event.target.closest?.("[data-section-door-arrangement]");
      if (doorArrangementInput && this.host.contains(doorArrangementInput)) {
        this.commitSectionOperation(
          setSectionDoorArrangement(
            this.state,
            this.selectedSectionIndex,
            doorArrangementInput.dataset.sectionDoorArrangement,
            this.layout
          ),
          `Door arrangement updated for Section ${this.selectedSectionIndex + 1}.`
        );
        return;
      }
      const hardwareTypeInput = event.target.closest?.("[data-hardware-type]");
      if (hardwareTypeInput && this.host.contains(hardwareTypeInput)) {
        this.commitHardwareSelection({ type: hardwareTypeInput.value });
        return;
      }
      const hardwareFinishInput = event.target.closest?.("[data-hardware-finish]");
      if (hardwareFinishInput && this.host.contains(hardwareFinishInput)) {
        this.commitHardwareSelection({ finish: hardwareFinishInput.value });
        return;
      }
      const field = event.target.closest?.("[data-field]");
      if (!field || !this.host.contains(field)) return;
      if (field.type !== "radio" && field.type !== "checkbox" && field.tagName !== "SELECT") return;
      this.handleFieldInput(field);
    }, { signal });

    this.host.addEventListener("keydown", (event) => {
      const isTextEditing = event.target.matches?.("input:not([type=radio]):not([type=checkbox]), textarea, [contenteditable=true]");
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !isTextEditing) {
        const key = event.key.toLowerCase();
        if (key === "z" || key === "y") {
          event.preventDefault();
          if (key === "y" || (key === "z" && event.shiftKey)) this.redoDesignChange();
          else this.undoDesignChange();
          return;
        }
      }
      if (event.key === "Escape" && this.contextEditorOpen) {
        event.preventDefault();
        this.closeContextEditor({ restoreFocus: true });
        return;
      }
      const divider = event.target.closest?.("[data-section-divider]");
      if (divider && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
        event.preventDefault();
        const step = event.shiftKey ? 1 : 0.5;
        const delta = event.key === "ArrowRight" ? step : -step;
        this.commitSectionDividerResize(Number(divider.dataset.sectionDivider), delta);
        return;
      }
      const sectionWidth = event.target.closest?.("[data-section-width]");
      if (sectionWidth && event.key === "Enter") {
        event.preventDefault();
        this.commitSelectedSectionWidth(sectionWidth.value);
        return;
      }
      const sectionStorageNumber = event.target.closest?.('input[type="number"][data-section-storage-field]');
      if (sectionStorageNumber && event.key === "Enter") {
        event.preventDefault();
        sectionStorageNumber.dispatchEvent(new Event("change", { bubbles: true }));
        return;
      }
      const numericField = event.target.closest?.('input[type="number"][data-field]');
      if (numericField && event.key === "Enter") {
        event.preventDefault();
        this.handleFieldInput(numericField);
        return;
      }
      const sectionOption = event.target.closest?.("[data-section-select]");
      if (sectionOption && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        const count = getSectionDesignerState(this.state, this.layout).sections.length;
        const current = Number(sectionOption.dataset.sectionSelect);
        let next = event.key === "Home" ? 0 : event.key === "End" ? count - 1 : current;
        if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
          next = clamp(current + (event.key === "ArrowRight" ? 1 : -1), 0, count - 1);
        } else if (["ArrowUp", "ArrowDown"].includes(event.key)) {
          const container = sectionOption.closest(".workspace-section-cards");
          const options = [...(container?.querySelectorAll("[data-section-select]") || [])];
          const rows = [];
          for (const option of options) {
            const rect = option.getBoundingClientRect();
            let row = rows.find((candidate) => Math.abs(candidate.top - rect.top) <= 2);
            if (!row) {
              row = { top: rect.top, items: [] };
              rows.push(row);
            }
            row.items.push({ option, center: rect.left + rect.width / 2 });
          }
          rows.sort((left, right) => left.top - right.top);
          const rowIndex = rows.findIndex((row) => row.items.some((item) => item.option === sectionOption));
          const targetRow = rows[rowIndex + (event.key === "ArrowDown" ? 1 : -1)];
          if (targetRow) {
            const currentRect = sectionOption.getBoundingClientRect();
            const center = currentRect.left + currentRect.width / 2;
            const target = targetRow.items.reduce((closest, item) => (
              !closest || Math.abs(item.center - center) < Math.abs(closest.center - center) ? item : closest
            ), null);
            next = Number(target?.option.dataset.sectionSelect ?? current);
          }
        }
        this.selectSection(next, { openProperties: true, focus: true, ensureFramed: true });
        return;
      }
      const profileRadio = event.target.closest?.('input[type="radio"][data-field]');
      if (profileRadio && PROFILE_FOCUS_FIELDS.has(profileRadio.dataset.field)) {
        if (event.key === "Enter") {
          event.preventDefault();
          profileRadio.click();
        }
        return;
      }
      const colorQuery = event.target.closest?.("[data-bm-query]");
      if (!colorQuery) return;
      if (event.key === "Escape") this.closeBenjaminMooreResults();
      if (event.key === "Enter") {
        event.preventDefault();
        this.applyBenjaminMooreQuery(colorQuery.value);
      }
    }, { signal });

    this.host.addEventListener("click", (event) => this.handleDelegatedClick(event), { signal });

    this.elements.reviewDialog?.addEventListener("click", (event) => {
      if (event.target === this.elements.reviewDialog) this.closeReviewDialog();
    }, { signal });
    this.elements.reviewDialog?.addEventListener("cancel", (event) => {
      event.preventDefault();
      this.closeReviewDialog();
    }, { signal });
    this.elements.reviewDialog?.addEventListener("close", () => this.restoreReviewFocus(), { signal });
    this.elements.form?.addEventListener("submit", (event) => event.preventDefault(), { signal });
    document.addEventListener("fullscreenchange", () => {
      this.syncWorkspaceToolbar();
      window.requestAnimationFrame(() => this.viewer.resize?.());
    }, { signal });
    window.addEventListener("pagehide", (event) => {
      if (!event.persisted) this.destroy();
    }, { signal });
  }

  handleDelegatedClick(event) {
    const target = event.target;
    if (!this.hasAcceptedDesign) {
      const preview = target.closest?.("[data-studio-preview-index]");
      if (preview) {
        this.setStudioPreview(Number(preview.dataset.studioPreviewIndex), { manual: true });
        this.emitStudioEvent("studio_intro_preview_changed", { previewIndex: this.introPreviewIndex });
        return;
      }
      if (target.closest?.("[data-studio-start]")) this.handleStudioStart();
      return;
    }
    const stageButton = target.closest?.("[data-workspace-stage], [data-workspace-stage-link]");
    if (stageButton) {
      const focusField = stageButton.dataset.workspaceFocusField;
      this.activateWorkspaceStage(
        stageButton.dataset.workspaceStage || stageButton.dataset.workspaceStageLink,
        { focus: !focusField }
      );
      if (focusField) {
        window.requestAnimationFrame(() => {
          const field = [...this.host.querySelectorAll("[data-field]")]
            .find((element) => element.dataset.field === focusField && !element.disabled && element.type !== "range");
          field?.focus({ preventScroll: false });
          field?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
        });
      }
      return;
    }
    if (target.closest?.("[data-close-selection]")) {
      this.closeContextEditor({ restoreFocus: true });
      return;
    }
    if (target.closest?.("[data-history-undo]")) {
      this.undoDesignChange();
      return;
    }
    if (target.closest?.("[data-history-redo]")) {
      this.redoDesignChange();
      return;
    }
    if (target.closest?.("[data-toggle-dimensions]")) {
      this.showDimensions = !this.showDimensions;
      this.viewer.setDimensionsVisible?.(this.showDimensions);
      this.dispatchCameraIntent({ type: "layout-change", sectionIndex: this.selectedSectionIndex });
      this.syncWorkspaceToolbar();
      return;
    }
    if (target.closest?.("[data-toggle-wall]")) {
      this.showWall = !this.showWall;
      this.viewer.setWallVisible?.(this.showWall);
      this.dispatchCameraIntent({ type: "layout-change", sectionIndex: this.selectedSectionIndex });
      this.syncWorkspaceToolbar();
      return;
    }
    const modelTool = target.closest?.("[data-model-tool]");
    if (modelTool) {
      this.activeTool = modelTool.dataset.modelTool;
      this.viewer.setInteractionTool?.(this.activeTool);
      this.syncWorkspaceToolbar();
      return;
    }
    if (target.closest?.("[data-model-fullscreen]")) {
      this.toggleModelFullscreen();
      return;
    }
    const profileRadio = target.closest?.('input[type="radio"][data-field]');
    if (profileRadio && PROFILE_FOCUS_FIELDS.has(profileRadio.dataset.field)) {
      const fieldName = profileRadio.dataset.field;
      if (String(this.state[fieldName]) === String(profileRadio.value)) {
        this.requestProfileCameraFocus(fieldName, { force: true });
      }
      return;
    }
    if (target.closest?.("[data-open-hardware-library]")) {
      this.openExpandedHardwareEditor();
      return;
    }
    if (target.closest?.("[data-close-context]")) {
      this.closeContextEditor({ restoreFocus: true });
      return;
    }
    const categoryTrigger = target.closest?.("[data-category-trigger]");
    if (categoryTrigger) {
      this.toggleInspectorGroup(categoryTrigger.dataset.categoryTrigger);
      return;
    }
    if (target.closest?.("[data-open-structure]")) {
      this.focusInspectorGroup("sections_layout");
      return;
    }
    const sectionActionsSummary = target.closest?.(".section-actions-disclosure > summary");
    if (sectionActionsSummary) {
      this.sectionActionsExpanded = !sectionActionsSummary.parentElement.open;
      return;
    }
    const storageSectionStep = target.closest?.("[data-storage-section-step]");
    if (storageSectionStep) {
      const direction = Number(storageSectionStep.dataset.storageSectionStep);
      this.selectSection(this.selectedSectionIndex + direction, {
        openProperties: true,
        ensureFramed: true,
        stageId: "storage",
        inspectorGroupId: "storage_fronts"
      });
      window.requestAnimationFrame(() => {
        const preferred = this.host.querySelector(`[data-storage-section-step="${direction}"]:not(:disabled)`);
        const fallback = this.host.querySelector("[data-storage-section-step]:not(:disabled)");
        (preferred || fallback)?.focus({ preventScroll: true });
      });
      return;
    }
    const sectionSelect = target.closest?.("[data-section-select]");
    if (sectionSelect) {
      this.selectSection(Number(sectionSelect.dataset.sectionSelect), { openProperties: true, focus: true, ensureFramed: true });
      return;
    }
    const storageSectionSelect = target.closest?.("[data-storage-section-select]");
    if (storageSectionSelect) {
      this.selectSection(Number(storageSectionSelect.dataset.storageSectionSelect), {
        openProperties: true,
        ensureFramed: true,
        stageId: "storage",
        inspectorGroupId: "storage_fronts",
        inspectorTabId: storageSectionSelect.dataset.storageSectionTab || "doors"
      });
      return;
    }
    const overlaySectionSelect = target.closest?.("[data-overlay-section-select]");
    if (overlaySectionSelect) {
      this.selectSection(Number(overlaySectionSelect.dataset.overlaySectionSelect), {
        openProperties: true,
        ensureFramed: true
      });
      return;
    }
    const storageValueStep = target.closest?.("[data-section-storage-step]");
    if (storageValueStep) {
      const field = storageValueStep.dataset.sectionStorageStep;
      const selected = getSectionDesignerState(this.state, this.layout).sections[this.selectedSectionIndex];
      const currentValue = Number(selected?.[field]);
      const delta = Number(storageValueStep.dataset.stepDirection);
      const minimum = Number(storageValueStep.dataset.min);
      const maximum = Number(storageValueStep.dataset.max);
      if (selected && Number.isFinite(currentValue) && Number.isFinite(delta)) {
        const nextValue = clamp(currentValue + delta, minimum, maximum);
        this.commitSelectedSectionStorage(
          { [field]: nextValue },
          `${formatSectionStorageField(field)} updated for Section ${this.selectedSectionIndex + 1}.`
        );
      }
      return;
    }
    const widthStep = target.closest?.("[data-section-width-step]");
    if (widthStep) {
      const designer = getSectionDesignerState(this.state, this.layout);
      const selected = designer.sections[this.selectedSectionIndex];
      if (selected) this.commitSelectedSectionWidth(selected.width + Number(widthStep.dataset.sectionWidthStep));
      return;
    }
    if (target.closest?.("[data-section-split]")) {
      this.commitSectionOperation(splitSection(this.state, this.layout, this.selectedSectionIndex), "Section split accepted.");
      return;
    }
    if (target.closest?.("[data-section-add]")) {
      const operation = addSection(this.state, this.layout, this.selectedSectionIndex);
      this.commitSectionOperation(
        operation,
        operation.reflowed
          ? `Section added. All clear widths were rebalanced while the overall width stayed ${this.state.width} inches.`
          : "Section added.",
        { selectedIndex: operation.selectedSectionIndex }
      );
      return;
    }
    const duplicate = target.closest?.("[data-section-duplicate]");
    if (duplicate) {
      const index = duplicate.dataset.sectionDuplicate === "" ? this.selectedSectionIndex : Number(duplicate.dataset.sectionDuplicate);
      const operation = duplicateSection(this.state, this.layout, index);
      this.commitSectionOperation(operation, `Section ${index + 1} duplicated.`, { selectedIndex: operation.selectedSectionIndex });
      return;
    }
    const deleteButton = target.closest?.("[data-section-delete]");
    if (deleteButton) {
      const index = deleteButton.dataset.sectionDelete === "" ? this.selectedSectionIndex : Number(deleteButton.dataset.sectionDelete);
      const operation = deleteSection(this.state, this.layout, index);
      this.commitSectionOperation(
        operation,
        operation.reflowed
          ? `Section ${index + 1} deleted. Remaining clear widths were rebalanced while the overall width stayed ${this.state.width} inches.`
          : `Section ${index + 1} deleted.`,
        { selectedIndex: operation.selectedSectionIndex }
      );
      return;
    }
    const merge = target.closest?.("[data-section-merge]");
    if (merge) {
      const operation = mergeSection(this.state, this.layout, this.selectedSectionIndex, merge.dataset.sectionMerge);
      this.commitSectionOperation(
        operation,
        "Sections merged.",
        { selectedIndex: operation.affectedSections?.[0] }
      );
      return;
    }
    if (target.closest?.("[data-section-equalize]")) {
      this.commitSectionOperation(equalizeSectionWidths(this.state, this.layout), "Section widths equalized.");
      return;
    }
    if (target.closest?.("[data-section-reset]")) {
      this.commitSectionOperation(resetSectionCustomization(this.state, this.basePresetId), "Section customization reset to the selected preset.");
      return;
    }
    if (target.closest?.("[data-section-undo]")) {
      this.undoSectionChange();
      return;
    }
    if (target.closest?.("[data-section-redo]")) {
      this.redoSectionChange();
      return;
    }
    const presetButton = target.closest?.("[data-preset-id]");
    if (presetButton) {
      this.applyPreset(presetButton.dataset.presetId);
      return;
    }
    const stepperButton = target.closest?.("[data-step-field]");
    if (stepperButton) {
      this.handleStepperClick(stepperButton);
      return;
    }
    const viewButton = target.closest?.("[data-view]");
    if (viewButton) {
      this.cancelQueuedProfileFocus();
      this.setView(viewButton.dataset.view);
      return;
    }
    const zoomButton = target.closest?.("[data-viewer-zoom]");
    if (zoomButton) {
      this.cancelQueuedProfileFocus();
      this.viewer.zoom(zoomButton.dataset.viewerZoom === "in" ? -1 : 1);
      this.syncDiagnosticsAttributes();
      return;
    }
    if (target.closest?.("[data-reset-view]")) {
      this.cancelQueuedProfileFocus();
      this.setView("reset");
      this.showStatus("Preview view reset. Your design is unchanged.");
      return;
    }
    if (target.closest?.("[data-review-design]")) {
      if (this.ensureConfigurationActionable()) this.openReviewDialog();
      return;
    }
    const arButton = target.closest?.("[data-open-ar]");
    if (arButton) {
      if (!this.ensureConfigurationActionable()) return;
      this.initializeCabinetAr().then((controller) => {
        if (controller) controller.open(arButton);
        else this.showStatus("The room view could not load. Your design is unchanged.", true);
      });
      return;
    }
    if (target.closest?.("[data-close-review]")) {
      this.closeReviewDialog();
      return;
    }
    const editButton = target.closest?.("[data-edit-group]");
    if (editButton) {
      this.closeReviewDialog();
      this.focusInspectorGroup(editButton.dataset.editGroup, { field: editButton.dataset.editField || "" });
      return;
    }
    const colorSearchToggle = target.closest?.("[data-toggle-color-search]");
    if (colorSearchToggle) {
      this.showColorSearch = !this.showColorSearch;
      this.host.querySelectorAll("[data-custom-bm-fields]").forEach((panel) => {
        panel.hidden = !this.showColorSearch;
      });
      this.host.querySelectorAll("[data-toggle-color-search]:not([data-color-search-close])").forEach((button) => {
        button.textContent = this.showColorSearch
          ? "Close Benjamin Moore Search"
          : this.state.finish === "custom_bm" ? "Change Benjamin Moore color" : "Benjamin Moore Search";
      });
      if (this.showColorSearch) this.host.querySelector("[data-bm-query]")?.focus();
      else this.closeBenjaminMooreResults();
      return;
    }
    const searchButton = target.closest?.("[data-search-bm]");
    if (searchButton) {
      this.applyBenjaminMooreQuery(this.host.querySelector("[data-bm-query]")?.value || "");
      return;
    }
    const result = target.closest?.("[data-bm-id]");
    if (result) {
      this.applyBenjaminMooreResult(result.dataset.bmId);
      return;
    }
    const recommended = target.closest?.("[data-use-recommended]");
    if (recommended) {
      this.applyRecommendedChoice(recommended.dataset.useRecommended);
      return;
    }
    const unsure = target.closest?.("[data-not-sure]");
    if (unsure) {
      this.showStatus(unsure.dataset.notSure === "dimensions"
        ? "That’s okay. Use a close estimate now; final measurements are verified before production."
        : "The Full Bookcase is a flexible recommended starting point.");
      return;
    }
    if (target.closest?.("[data-reset-design]")) {
      this.requestDesignReset(target.closest("[data-reset-design]"));
      return;
    }
    if (target.closest?.("[data-save-design]")) {
      this.handleSaveAction();
      return;
    }
    if (target.closest?.("[data-open-order]")) {
      this.handleQuoteAction();
    }
  }

  activateWorkspaceStage(stageId, options = {}) {
    if (!WORKSPACE_STAGES.some((stage) => stage.id === stageId)) return false;
    this.cancelQueuedProfileFocus();
    this.cancelQueuedCameraIntent();
    this.endOptionPreview(null, { restore: true });
    this.viewer.cancelCameraTransition?.();
    this.activeStageId = stageId;
    this.activeInspectorGroup = STAGE_CONTROL_GROUPS[stageId]?.[0] || "overall_size";
    this.activeInspectorTabId = "general";
    this.selection = null;
    this.contextEditorOpen = false;
    this.viewer.clearDirectSelection?.();
    this.renderInspector({ resetScroll: true });
    this.syncInterface();
    this.dispatchCameraIntent({
      type: "stage-change",
      stage: stageId,
      sectionIndex: this.selectedSectionIndex,
      duration: SMART_CAMERA_DURATION
    });
    this.activeView = ["lighting"].includes(stageId) ? "custom" : "three-quarter";
    this.syncViewButtons();
    this.syncDiagnosticsAttributes();
    if (options.focus !== false) {
      window.requestAnimationFrame(() => this.host.querySelector(`[data-workspace-stage="${stageId}"]`)?.focus({ preventScroll: true }));
    }
    return true;
  }

  snapshotDesignState() {
    if (typeof structuredClone === "function") return structuredClone(this.state);
    return JSON.parse(JSON.stringify(this.state));
  }

  recordDesignHistory(snapshot) {
    this.designHistory.undo.push(snapshot);
    if (this.designHistory.undo.length > this.designHistory.limit) this.designHistory.undo.shift();
    this.designHistory.redo = [];
  }

  undoDesignChange() {
    const snapshot = this.designHistory.undo.pop();
    if (!snapshot) return false;
    const current = this.snapshotDesignState();
    if (!this.update(snapshot, { sourceField: "history", recordHistory: false, historyReplay: true, silent: true })) {
      this.designHistory.undo.push(snapshot);
      return false;
    }
    this.designHistory.redo.push(current);
    if (this.designHistory.redo.length > this.designHistory.limit) this.designHistory.redo.shift();
    this.syncWorkspaceToolbar();
    this.syncDiagnosticsAttributes();
    this.showStatus("Design change undone.");
    return true;
  }

  redoDesignChange() {
    const snapshot = this.designHistory.redo.pop();
    if (!snapshot) return false;
    const current = this.snapshotDesignState();
    if (!this.update(snapshot, { sourceField: "history", recordHistory: false, historyReplay: true, silent: true })) {
      this.designHistory.redo.push(snapshot);
      return false;
    }
    this.designHistory.undo.push(current);
    if (this.designHistory.undo.length > this.designHistory.limit) this.designHistory.undo.shift();
    this.syncWorkspaceToolbar();
    this.syncDiagnosticsAttributes();
    this.showStatus("Design change redone.");
    return true;
  }

  syncWorkspaceToolbar() {
    const undo = this.host.querySelector("[data-history-undo]");
    const redo = this.host.querySelector("[data-history-redo]");
    if (undo) undo.disabled = this.designHistory.undo.length === 0;
    if (redo) redo.disabled = this.designHistory.redo.length === 0;
    this.host.querySelectorAll("[data-toggle-dimensions]").forEach((button) => button.setAttribute("aria-pressed", String(this.showDimensions)));
    this.host.querySelectorAll("[data-toggle-wall]").forEach((button) => button.setAttribute("aria-pressed", String(this.showWall)));
    this.host.querySelectorAll("[data-model-tool]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.modelTool === this.activeTool)));
    const isFullscreen = Boolean(document.fullscreenElement === this.elements?.modelWorkspace || this.elements?.modelWorkspace?.classList.contains("is-pseudo-fullscreen"));
    this.fullscreen = isFullscreen;
    this.host.querySelectorAll("[data-model-fullscreen]").forEach((button) => {
      button.setAttribute("aria-pressed", String(isFullscreen));
      button.setAttribute("aria-label", isFullscreen ? "Exit model fullscreen" : "Enter model fullscreen");
    });
  }

  async toggleModelFullscreen() {
    const workspace = this.elements?.modelWorkspace;
    if (!workspace) return;
    try {
      if (document.fullscreenElement === workspace) await document.exitFullscreen();
      else if (workspace.requestFullscreen) await workspace.requestFullscreen();
      else workspace.classList.toggle("is-pseudo-fullscreen");
    } catch {
      workspace.classList.toggle("is-pseudo-fullscreen");
    }
    this.syncWorkspaceToolbar();
    window.requestAnimationFrame(() => this.viewer.resize?.());
  }

  focusInspectorGroup(groupId, options = {}) {
    const normalized = normalizeInspectorGroup(groupId);
    this.activeInspectorGroup = normalized;
    this.activeStageId = WORKSPACE_STAGES.find((stage) => STAGE_CONTROL_GROUPS[stage.id]?.includes(normalized))?.id || this.activeStageId;
    this.activeInspectorTabId = "general";
    if (options.preserveSelection !== true) {
      this.selection = null;
      this.contextEditorOpen = false;
      this.viewer.clearDirectSelection?.();
    }
    this.inspectorGroupCollapsed = false;
    this.renderInspector();
    this.syncInterface();
    this.focusCameraForCurrentContext();
    window.requestAnimationFrame(() => {
      const category = this.host.querySelector(`[data-inspector-group="${normalized}"]`);
      const destination = category || this.elements?.controlsScroll;
      destination?.scrollIntoView?.({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      if (options.focus !== false) (category?.querySelector("[data-category-trigger]") || destination)?.focus?.({ preventScroll: true });
    });
  }

  getCameraModelGeneration() {
    return Number(this.viewer?.getModelGeneration?.() ?? this.viewer?.modelGeneration ?? 0) || 0;
  }

  isCameraIntentTargetValid(state = this.cameraIntentState) {
    if (!state) return true;
    if (state.targetKind === "section") {
      return Number.isInteger(state.sourceSectionIndex)
        && state.sourceSectionIndex >= 0
        && state.sourceSectionIndex < Number(this.state?.sections || 0);
    }
    if (state.targetKind === "detail" && state.targetComponentId) {
      return Boolean(this.layout?.components?.some((component) => component.id === state.targetComponentId));
    }
    return true;
  }

  dispatchCameraIntent(event, options = {}) {
    const current = this.cameraIntentState || createCameraIntentState({ sourceStage: this.activeStageId });
    const resolution = resolveCameraIntent(current, {
      ...event,
      stage: event.stage || this.activeStageId,
      modelGeneration: event.modelGeneration ?? this.getCameraModelGeneration()
    });
    this.cameraIntentState = resolution.state;
    this.viewer?.adoptCameraIntent?.(resolution.state);
    this.syncCameraIntentAttributes();

    if (!resolution.command) return resolution.state;
    this.viewer?.cancelCameraTransition?.();
    this.pendingCameraIntentCommand = resolution.command;
    if (this.cameraIntentFrame) window.cancelAnimationFrame(this.cameraIntentFrame);
    const apply = () => {
      this.cameraIntentFrame = 0;
      const command = this.pendingCameraIntentCommand;
      this.pendingCameraIntentCommand = null;
      if (
        !command
        || this.destroyed
        || command.intentGeneration !== this.cameraIntentState.intentGeneration
      ) return;
      const latestModelGeneration = this.getCameraModelGeneration();
      if (command.modelGeneration !== latestModelGeneration) {
        this.dispatchCameraIntent({
          type: "model-change",
          stage: this.activeStageId,
          sectionIndex: this.selectedSectionIndex,
          modelGeneration: latestModelGeneration,
          targetValid: this.isCameraIntentTargetValid()
        });
        return;
      }
      const applied = this.viewer?.applyCameraIntent?.(command) === true;
      if (!applied) {
        this.dispatchCameraIntent({
          type: "transition-complete",
          intentGeneration: command.intentGeneration,
          modelGeneration: command.modelGeneration
        });
      }
    };
    if (options.immediate) apply();
    else this.cameraIntentFrame = window.requestAnimationFrame(apply);
    return resolution.state;
  }

  cancelQueuedCameraIntent() {
    if (this.cameraIntentFrame) window.cancelAnimationFrame(this.cameraIntentFrame);
    this.cameraIntentFrame = 0;
    this.pendingCameraIntentCommand = null;
  }

  handleViewerCameraInteraction(interaction, detail = {}) {
    if (["gesture-start", "rotate", "pan", "zoom", "reset"].includes(interaction)) {
      this.activeView = "custom";
      if (this.sectionDesignerActive) this.sectionDesignerCameraChanged = true;
      if (this.cameraIntentState?.cameraState !== CAMERA_INTENT_STATES.userControlled) {
        this.dispatchCameraIntent({ type: "manual-interaction", modelGeneration: detail.modelGeneration });
      }
    } else if (interaction === "focus-complete") {
      this.dispatchCameraIntent({
        type: "transition-complete",
        intentGeneration: detail.intentGeneration,
        modelGeneration: detail.modelGeneration
      });
    } else if (interaction === "viewport-change") {
      this.dispatchCameraIntent({ type: "viewport-change", modelGeneration: detail.modelGeneration });
    }
    this.syncViewButtons();
    this.syncDiagnosticsAttributes();
  }

  syncCameraIntentAttributes() {
    const state = this.cameraIntentState || createCameraIntentState({ sourceStage: this.activeStageId });
    const targets = [this.elements?.shell, this.elements?.viewer].filter(Boolean);
    for (const target of targets) {
      target.dataset.cameraState = state.cameraState;
      target.dataset.cameraProfile = state.profile;
      target.dataset.cameraSourceStage = state.sourceStage;
      target.dataset.cameraSourceSection = Number.isInteger(state.sourceSectionIndex)
        ? String(state.sourceSectionIndex)
        : "";
    }
  }

  focusCameraForCurrentContext(options = {}) {
    this.cancelQueuedProfileFocus();
    this.dispatchCameraIntent({
      type: "stage-change",
      stage: this.activeStageId,
      sectionIndex: this.selectedSectionIndex,
      duration: options.duration
    });
    this.activeView = "three-quarter";
    this.syncViewButtons();
    this.syncDiagnosticsAttributes();
  }

  focusCameraForField(fieldName, options = {}) {
    const profile = CAMERA_PROFILE_BY_FIELD[fieldName];
    if (!profile) return;
    this.dispatchCameraIntent({
      type: "field-focus",
      stage: this.activeStageId,
      sectionIndex: this.selectedSectionIndex,
      field: fieldName,
      value: this.state?.[fieldName],
      profile,
      transient: true,
      duration: options.duration
    });
    this.activeView = profile === "overview" ? "three-quarter" : "custom";
    this.syncViewButtons();
    this.syncDiagnosticsAttributes();
  }

  requestProfileCameraFocus(fieldName, options = {}) {
    if (!PROFILE_FOCUS_FIELDS.has(fieldName) || !this.viewer?.focus) return;
    this.cancelQueuedProfileFocus();
    this.profileFocusFrame = window.requestAnimationFrame(() => {
      this.profileFocusFrame = 0;
      this.focusCameraForField(fieldName, { ...options, force: true });
    });
  }

  cancelQueuedProfileFocus() {
    if (!this.profileFocusFrame) return;
    window.cancelAnimationFrame(this.profileFocusFrame);
    this.profileFocusFrame = 0;
  }

  scheduleOptionPreview(label, input) {
    window.clearTimeout(this.optionPreviewTimer);
    if (!HOVER_PREVIEW_FIELDS.has(input.dataset.field) || input.disabled || input.checked) return;
    this.optionPreviewTimer = window.setTimeout(() => this.beginOptionPreview(label, input), 90);
  }

  beginOptionPreview(label, input) {
    if (!label.isConnected || input.disabled || input.checked) return;
    const field = input.dataset.field;
    const rawValue = input.value;
    const value = numericFields.has(field) ? Number(rawValue) : rawValue;
    if (this.optionPreview?.field === field && String(this.optionPreview.value) === String(value)) return;

    this.optionPreview?.label?.classList.remove("is-live-previewing");
    const previewState = normalizeBookcaseConfig({ ...this.state, [field]: value });
    const previewLayout = generateBookcaseLayout(previewState);
    this.optionPreview = { label, field, value };
    this.viewer.preview(previewState, previewLayout, field);
    this.focusCameraForField(field);
    this.host.dataset.previewField = field;
    this.host.dataset.previewValue = String(value);
    label.classList.add("is-live-previewing");
    this.syncDiagnosticsAttributes();
  }

  endOptionPreview(label = null, { restore = true } = {}) {
    window.clearTimeout(this.optionPreviewTimer);
    this.optionPreviewTimer = 0;
    if (!this.optionPreview || (label && this.optionPreview.label !== label)) return;
    this.optionPreview.label?.classList.remove("is-live-previewing");
    this.optionPreview = null;
    delete this.host.dataset.previewField;
    delete this.host.dataset.previewValue;
    if (restore) {
      this.viewer.restorePreview(this.state, this.layout);
      this.dispatchCameraIntent({
        type: "stage-change",
        stage: this.activeStageId,
        sectionIndex: this.selectedSectionIndex,
        modelGeneration: this.getCameraModelGeneration()
      });
    }
    this.syncDiagnosticsAttributes();
  }

  toggleInspectorGroup(groupId) {
    const normalized = normalizeInspectorGroup(groupId);
    const currentPanel = this.host.querySelector('[data-category-panel="' + normalized + '"]');
    const wasOpen = normalized === this.activeInspectorGroup && currentPanel?.hidden === false;
    this.activeInspectorGroup = normalized;
    this.inspectorGroupCollapsed = wasOpen;
    this.host.querySelectorAll("[data-category]").forEach((category) => {
      const open = !wasOpen && category.dataset.category === normalized;
      const trigger = category.querySelector("[data-category-trigger]");
      const panel = category.querySelector("[data-category-panel]");
      trigger?.setAttribute("aria-expanded", String(open));
      const icon = trigger?.querySelector("i");
      if (icon) icon.innerHTML = open ? builderIcons.minus : builderIcons.plus;
      if (panel) panel.hidden = !open;
    });
    const profile = wasOpen ? "overview" : CAMERA_PROFILE_BY_CATEGORY[normalized] || "overview";
    this.dispatchCameraIntent(profile === "overview"
      ? { type: "stage-change", stage: this.activeStageId, sectionIndex: this.selectedSectionIndex }
      : { type: "field-focus", stage: this.activeStageId, sectionIndex: this.selectedSectionIndex, profile, field: normalized });
    this.activeView = profile === "overview" ? "three-quarter" : "custom";
    this.syncViewButtons();
    this.syncDiagnosticsAttributes();
  }

  activateSectionDesigner(options = {}) {
    this.sectionDesignerActive = true;
    this.selectedSectionIndex = clamp(
      this.selectedSectionIndex,
      0,
      Math.max(0, getSectionDesignerState(this.state, this.layout).sections.length - 1)
    );
    this.sectionWidthDraft = "";
    this.viewer.setSectionDesigner?.({
      active: true,
      selectedIndex: this.selectedSectionIndex,
      layout: this.layout,
      onSelect: (index) => this.selectSection(index, { render: false, ensureFramed: true })
    });
    if (options.focusCamera === true) this.setView("front");
    if (options.render !== false) {
      this.renderInspector();
      this.syncInterface();
      if (options.focus !== false) window.requestAnimationFrame(() => this.host.querySelector(`[data-section-select="${this.selectedSectionIndex}"]`)?.focus({ preventScroll: true }));
    }
    if (options.announce !== false) {
      this.showStatus("Section Designer is active. Clear widths are dimensions inside the cabinet panels.");
    }
  }

  deactivateSectionDesigner(options = {}) {
    if (!this.sectionDesignerActive) return;
    this.sectionDesignerActive = false;
    this.sectionWidthDraft = "";
    this.activeSectionDividerDrag = null;
    this.viewer.setSectionDesigner?.({ active: false });
    if (!this.sectionDesignerCameraChanged && this.sectionDesignerCameraState) {
      this.viewer.restoreCameraState?.(this.sectionDesignerCameraState);
      this.activeView = this.sectionDesignerCameraState.activeView || "custom";
    }
    this.sectionDesignerCameraState = null;
    if (options.render !== false) {
      this.renderInspector();
      this.syncInterface();
    }
    if (options.announce !== false) {
      this.showStatus("Section Designer closed. Your accepted section design is unchanged.");
    }
  }

  selectSection(index, options = {}) {
    const count = getSectionDesignerState(this.state, this.layout).sections.length;
    const previousSectionIndex = this.selectedSectionIndex;
    this.selectedSectionIndex = clamp(Number(index) || 0, 0, Math.max(0, count - 1));
    this.sectionWidthDraft = "";
    if (options.openProperties) {
      const component = this.layout.components.find((item) => (
        item.role === "section" && Number(item.metadata?.index) === this.selectedSectionIndex
      ));
      const resolved = component
        ? resolveSelectionContext(this.layout, { componentId: component.id, source: "organizer" }, "organizer")
        : null;
      this.selection = resolved || {
        componentId: component?.id || `section-${this.selectedSectionIndex + 1}`,
        title: `Section ${this.selectedSectionIndex + 1}`,
        summary: formatSectionType(getSectionDesignerState(this.state, this.layout).sections[this.selectedSectionIndex]?.type || "open"),
        editorId: "section",
        inspectorGroupId: "sections_layout",
        sectionIndex: this.selectedSectionIndex
      };
      this.contextEditorOpen = true;
      const sectionStage = options.stageId
        || (["layout", "storage"].includes(this.activeStageId) ? this.activeStageId : "layout");
      this.activeStageId = sectionStage;
      this.activeInspectorGroup = normalizeInspectorGroup(
        options.inspectorGroupId || (sectionStage === "storage" ? "storage_fronts" : "sections_layout")
      );
      this.activeInspectorTabId = "general";
    }
    this.viewer.setSectionSelection?.(this.selectedSectionIndex);
    if (this.selection) this.viewer.setSelectedComponent?.(this.selection.highlightTarget?.componentId || this.selection.componentId);
    if (options.ensureFramed || this.selectedSectionIndex !== previousSectionIndex || options.forceSectionFocus) {
      this.dispatchCameraIntent({
        type: "section-change",
        stage: this.activeStageId,
        sectionIndex: this.selectedSectionIndex,
        duration: SMART_CAMERA_DURATION
      });
      this.activeView = "custom";
    }
    if (options.render !== false) {
      this.renderInspector();
      if (this.contextEditorOpen) this.renderContextEditor();
      this.syncInterface();
    }
    if (options.focus) {
      window.requestAnimationFrame(() => this.host.querySelector(`[data-section-select="${this.selectedSectionIndex}"]`)?.focus({ preventScroll: true }));
    }
  }

  commitSelectedSectionStorage(patch, successMessage) {
    return this.commitSectionOperation(
      setSectionStorageConfiguration(this.state, this.selectedSectionIndex, patch, this.layout),
      successMessage
    );
  }

  validateSectionStorageNumber(input) {
    const raw = String(input?.value ?? "").trim();
    const value = Number(raw);
    const min = input?.min === "" ? Number.NEGATIVE_INFINITY : Number(input.min);
    const max = input?.max === "" ? Number.POSITIVE_INFINITY : Number(input.max);
    const step = !input?.step || input.step === "any" ? null : Number(input.step);
    const base = Number.isFinite(min) ? min : 0;
    const stepOffset = step && Number.isFinite(step) && step > 0 ? (value - base) / step : 0;
    const stepAligned = !step || !Number.isFinite(step) || step <= 0
      || Math.abs(stepOffset - Math.round(stepOffset)) <= 1e-7;
    const label = input?.closest?.("[data-section-storage-control]")?.querySelector("label")?.textContent?.trim()
      || formatSectionStorageField(input?.dataset?.sectionStorageField || "value");
    if (raw && Number.isFinite(value) && value >= min && value <= max && stepAligned) {
      return { valid: true, value };
    }
    const range = Number.isFinite(min) && Number.isFinite(max) ? ` between ${min} and ${max}` : "";
    const increment = step && Number.isFinite(step) && step > 0 ? ` in increments of ${step}` : "";
    return {
      valid: false,
      value: null,
      message: `Enter ${label.toLowerCase()}${range}${increment}.`
    };
  }

  clearSectionStorageInputError(input) {
    input?.removeAttribute?.("aria-invalid");
    const error = input?.closest?.("[data-section-storage-control]")?.querySelector("[data-section-storage-error]");
    if (error) error.textContent = "";
  }

  showSectionStorageInputError(input, message) {
    input?.setAttribute?.("aria-invalid", "true");
    const error = input?.closest?.("[data-section-storage-control]")?.querySelector("[data-section-storage-error]");
    if (error) error.textContent = message;
    this.showStatus(message, true);
  }

  commitSelectedSectionWidth(value) {
    const rawValue = typeof value === "string" ? value.trim() : value;
    const targetWidth = Number(rawValue);
    if (rawValue === "" || !Number.isFinite(targetWidth)) {
      this.sectionWidthDraft = typeof value === "string" ? value : "";
      this.showSectionDesignerError({ message: "Enter a valid clear section width." });
      return false;
    }
    const designer = getSectionDesignerState(this.state, this.layout);
    const widthResult = setSectionClearWidth(designer.widths, this.selectedSectionIndex, targetWidth, this.layout.rules);
    if (!widthResult.accepted) {
      this.showSectionDesignerError(widthResult.error);
      return false;
    }
    const operation = applySectionWidths(this.state, this.layout, widthResult.widths);
    operation.affectedSections = widthResult.affectedSections;
    const acceptedWidth = widthResult.widths[this.selectedSectionIndex];
    return this.commitSectionOperation(
      operation,
      widthResult.clamped
        ? `Section ${this.selectedSectionIndex + 1} was adjusted to ${formatSectionWidth(acceptedWidth)} inches to keep the adjacent section buildable.`
        : `Section ${this.selectedSectionIndex + 1} width updated.`
    );
  }

  commitSectionDividerResize(dividerIndex, delta) {
    const designer = getSectionDesignerState(this.state, this.layout);
    const widthResult = resizeAdjacentSections(designer.widths, dividerIndex, delta, this.layout.rules);
    if (!widthResult.accepted) {
      this.showSectionDesignerError(widthResult.error);
      return;
    }
    const operation = applySectionWidths(this.state, this.layout, widthResult.widths);
    operation.affectedSections = widthResult.affectedSections;
    this.selectedSectionIndex = Math.min(dividerIndex, widthResult.widths.length - 1);
    this.commitSectionOperation(operation, "Divider position updated.");
  }

  commitSectionOperation(operation, successMessage, options = {}) {
    if (!operation?.accepted || !operation.config) {
      const error = operation?.error || { message: "That section change is not buildable." };
      // Native radio state changes before the structural operation is
      // validated. Re-render from the accepted model so a rejected option can
      // never look selected while the 3D design remains unchanged.
      this.renderInspector();
      this.syncInterface();
      this.showSectionDesignerError(error);
      return false;
    }
    const applied = this.update(operation.config, { sourceField: "layoutMetadata", refreshSectionDesigner: false });
    if (!applied) return false;
    const requestedSelection = Number.isInteger(options.selectedIndex)
      ? options.selectedIndex
      : this.selectedSectionIndex;
    this.selectSection(requestedSelection, { openProperties: true, render: false, ensureFramed: true });
    this.sectionWidthDraft = "";
    this.refreshSectionDesignerPresentation();
    this.showStatus(successMessage);
    return true;
  }

  undoSectionChange() {
    return this.undoDesignChange();
  }

  redoSectionChange() {
    return this.redoDesignChange();
  }

  refreshSectionDesignerPresentation() {
    if (this.sectionDesignerActive) {
      this.viewer.setSectionDesigner?.({
        active: true,
        selectedIndex: this.selectedSectionIndex,
        layout: this.layout,
        onSelect: (index) => this.selectSection(index, { render: false, ensureFramed: true })
      });
    }
    this.renderInspector();
    this.syncInterface();
  }

  showSectionDesignerError(error) {
    const message = error?.message || "That section change is not buildable.";
    this.host.querySelectorAll("[data-section-width-error]").forEach((host) => {
      host.textContent = message;
    });
    this.host.querySelectorAll("[data-section-width]").forEach((input) => {
      input.setAttribute("aria-invalid", "true");
    });
    this.showStatus(message, true);
  }

  beginSectionDividerDrag(event, handle) {
    if (
      !this.sectionDesignerActive
      || (event.button != null && event.button !== 0)
      || event.isPrimary === false
      || this.activeSectionDividerDrag
    ) return;
    const overlay = handle.closest("[data-section-overlay]");
    const rect = overlay?.getBoundingClientRect();
    if (!rect?.width) return;
    const dividerIndex = Number(handle.dataset.sectionDivider);
    const descriptor = this.layout.components.find((component) => (
      component.role === "divider" && Number(component.metadata?.boundaryIndex) === dividerIndex + 1
    )) || this.layout.components.find((component) => component.id === `divider-${String(dividerIndex + 1).padStart(2, "0")}`);
    if (descriptor && this.selection?.componentId !== descriptor.id) {
      this.handleModelSelection({
        componentId: descriptor.id,
        source: "canvas",
        anchorClientX: event.clientX,
        anchorClientY: event.clientY,
        anchor: this.viewer.getComponentScreenAnchor?.(descriptor.id)
      });
    }
    this.activeSectionDividerDrag = {
      pointerId: event.pointerId,
      dividerIndex,
      startX: event.clientX,
      delta: 0,
      pixelWidth: rect.width,
      overallWidth: Number(this.layout.metrics?.overallWidth) || this.state.width,
      handle
    };
    handle.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  updateSectionDividerDrag(event) {
    const drag = this.activeSectionDividerDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const rawDelta = (event.clientX - drag.startX) / drag.pixelWidth * drag.overallWidth;
    drag.delta = Math.round(rawDelta * 4) / 4;
    const widths = getSectionDesignerState(this.state, this.layout).widths;
    const result = resizeAdjacentSections(widths, drag.dividerIndex, drag.delta, this.layout.rules);
    this.viewer.previewSectionDivider?.(drag.dividerIndex, drag.delta, result);
  }

  endSectionDividerDrag(event) {
    const drag = this.activeSectionDividerDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    this.activeSectionDividerDrag = null;
    if (drag.handle.hasPointerCapture?.(event.pointerId)) drag.handle.releasePointerCapture(event.pointerId);
    this.viewer.clearSectionDividerPreview?.();
    if (Math.abs(drag.delta) >= 0.25) this.commitSectionDividerResize(drag.dividerIndex, drag.delta);
    else this.dispatchCameraIntent({
      type: "section-change",
      stage: this.activeStageId,
      sectionIndex: this.selectedSectionIndex,
      modelGeneration: this.getCameraModelGeneration(),
      duration: 0
    });
  }

  cancelSectionDividerDrag(event = null) {
    const drag = this.activeSectionDividerDrag;
    if (!drag || (event?.pointerId != null && drag.pointerId !== event.pointerId)) return;
    this.activeSectionDividerDrag = null;
    if (drag.handle.hasPointerCapture?.(drag.pointerId)) drag.handle.releasePointerCapture(drag.pointerId);
    this.viewer.clearSectionDividerPreview?.();
    this.dispatchCameraIntent({
      type: "section-change",
      stage: this.activeStageId,
      sectionIndex: this.selectedSectionIndex,
      modelGeneration: this.getCameraModelGeneration(),
      duration: 0
    });
  }

  openReviewDialog() {
    if (!this.elements.reviewDialog) return;
    this.reviewInvoker = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.syncReviewContent();
    if (typeof this.elements.reviewDialog.showModal === "function") this.elements.reviewDialog.showModal();
    else this.elements.reviewDialog.setAttribute("open", "");
    this.elements.reviewDialog.querySelector("[data-close-review]")?.focus();
  }

  closeReviewDialog() {
    if (!this.elements.reviewDialog?.open) return;
    if (typeof this.elements.reviewDialog.close === "function") this.elements.reviewDialog.close();
    else {
      this.elements.reviewDialog.removeAttribute("open");
      this.restoreReviewFocus();
    }
  }

  restoreReviewFocus() {
    const invoker = this.reviewInvoker;
    this.reviewInvoker = null;
    if (!invoker?.isConnected) return;
    window.requestAnimationFrame(() => {
      if (invoker.isConnected && !this.elements.reviewDialog?.open) invoker.focus({ preventScroll: true });
    });
  }

  applyRecommendedChoice(kind) {
    if (kind === "layout") {
      this.applyPreset(defaultBookcaseConfig.layoutPreset);
      return;
    }
    if (kind === "dimensions") {
      const preset = layoutPresets.find((item) => item.id === this.basePresetId)
        || layoutPresets.find((item) => item.id === defaultBookcaseConfig.layoutPreset);
      this.drafts = {};
      this.update({
        ...this.state,
        width: preset.config.width,
        height: preset.config.height,
        depth: preset.config.depth
      }, { sourceField: "dimensions" });
      this.showStatus("Recommended dimensions restored for this layout.");
    }
  }

  requestDesignReset(button) {
    const now = Date.now();
    if (now >= this.resetConfirmationExpires) {
      this.resetConfirmationExpires = now + 4500;
      button.textContent = "Confirm start over";
      window.clearTimeout(this.resetConfirmationTimer);
      this.resetConfirmationTimer = window.setTimeout(() => this.clearResetConfirmation(), 4500);
      this.showStatus("Choose “Confirm start over” to clear this accepted design and return to the start screen.");
      return;
    }
    try {
      localStorage.removeItem("jqBookcasesDesign");
    } catch (error) {
      // Reset remains available when storage is unavailable.
    }
    this.clearResetConfirmation();
    this.returnToStudioWelcome();
  }

  returnToStudioWelcome() {
    this.closeReviewDialog();
    this.stopStudioPreviewMotion();
    this.directHardwareEditor?.destroy?.();
    this.directHardwareEditor = null;
    this.directHardwareEditorPromise = null;
    this.viewer?.destroy?.();
    this.arController?.destroy?.();
    this.arController = null;
    this.arControllerPromise = null;
    this.hasAcceptedDesign = false;
    this.initialSource = "new";
    this.designIntent = STUDIO_DESIGN_INTENTS.newDesign;
    this.acceptedEvaluation = null;
    this.state = null;
    this.layout = null;
    this.bom = null;
    this.pricing = null;
    this.price = null;
    this.basePresetId = defaultBookcaseConfig.layoutPreset;
    this.activeInspectorGroup = normalizeInspectorGroup("overall_size");
    this.inspectorGroupCollapsed = false;
    this.selection = null;
    this.hoverSelection = null;
    this.contextEditorOpen = false;
    this.entryView = STUDIO_ENTRY_VIEWS.welcome;
    this.introPreviewIndex = 0;
    this.introPreviewStopped = false;
    this.drafts = {};
    this.updateCount = 0;
    this.priceCalculationCount = 0;
    this.saveActionCount = 0;
    this.quoteActionCount = 0;
    this.sectionDesignerActive = false;
    this.render();
    this.cacheElements();
    this.viewer = this.createStudioIntroViewer();
    this.syncStudioEntry();
    this.emitStudioEvent("studio_start_over", { source: "accepted-design" });
    this.showStatus("Accepted design cleared. Start building when you’re ready.");
    window.requestAnimationFrame(() => this.host.querySelector("[data-studio-start]")?.focus());
  }

  clearResetConfirmation() {
    window.clearTimeout(this.resetConfirmationTimer);
    this.resetConfirmationTimer = 0;
    this.resetConfirmationExpires = 0;
    this.host.querySelectorAll("[data-reset-design]").forEach((button) => {
      button.textContent = "Start over";
    });
  }

  handleSaveAction() {
    if (!this.ensureConfigurationActionable()) return;
    const now = Date.now();
    if (!shouldRunAction(this.actionStartedAt.save, now)) return;
    this.actionStartedAt.save = now;
    this.saveActionCount += 1;
    this.syncActionAvailability();
    this.syncDiagnosticsAttributes();
    const design = this.saveCurrentDesign();
    this.showStatus(design.persisted
      ? `Saved design ${design.id}.`
      : `Design ${design.id} is ready, but this browser could not store it.`);
    window.setTimeout(() => this.syncActionAvailability(), 720);
  }

  handleQuoteAction() {
    if (!this.ensureConfigurationActionable()) return;
    const now = Date.now();
    if (!shouldRunAction(this.actionStartedAt.quote, now)) return;
    this.actionStartedAt.quote = now;
    this.quoteActionCount += 1;
    this.syncActionAvailability();
    this.syncDiagnosticsAttributes();
    this.openQuotePage();
  }

  ensureConfigurationActionable() {
    if (!hasBlockingConfigurationIssue(this.state, this.layout, this.drafts)) return true;
    const issues = validateUnifiedConfiguration(this.state, this.layout, this.drafts).issues;
    const issue = issues[0] || { field: "configuration", message: "Review the highlighted configuration issue first." };
    this.focusInspectorGroup(issue.inspectorGroupId || inspectorGroupForField(issue.field), { focus: false, field: issue.field });
    window.requestAnimationFrame(() => {
      this.host.querySelector('[data-field="' + issue.field + '"], [data-validation-field="' + issue.field + '"]')?.focus?.({ preventScroll: true });
    });
    this.showStatus(issue.message, true);
    return false;
  }

  beginRangeDrag(event, range) {
    if ((event.button != null && event.button !== 0) || event.isPrimary === false || this.activeRangeDrag) return;
    const control = range.closest("[data-range-control]");
    const travelLane = this.measureRangeTravelLane(range);
    if (!travelLane) return;
    this.activeRangeDrag = {
      range,
      control,
      travelLane,
      pointerId: event.pointerId,
      startSnapshot: this.snapshotDesignState(),
      changed: false,
      frameRequest: 0,
      latestClientX: event.clientX
    };
    control?.classList.add("is-dragging");
    range.focus({ preventScroll: true });
    range.setPointerCapture?.(event.pointerId);
    this.applyRangePointerValue(event, range);
    event.preventDefault();
  }

  updateRangeDrag(event) {
    const drag = this.activeRangeDrag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag.latestClientX = event.clientX;
    if (!drag.frameRequest) {
      drag.frameRequest = window.requestAnimationFrame(() => {
        drag.frameRequest = 0;
        if (this.activeRangeDrag !== drag || !drag.range.isConnected) return;
        this.applyRangePointerValue({ clientX: drag.latestClientX }, drag.range);
      });
    }
    event.preventDefault();
  }

  endRangeDrag(event, options = {}) {
    const drag = this.activeRangeDrag;
    if (!drag || (event && event.pointerId !== drag.pointerId)) return;
    if (drag.frameRequest) {
      window.cancelAnimationFrame(drag.frameRequest);
      drag.frameRequest = 0;
    }
    if (options.applyFinal !== false && Number.isFinite(event?.clientX) && drag.range.isConnected) {
      this.applyRangePointerValue(event, drag.range);
    }
    this.activeRangeDrag = null;
    drag.control?.classList.remove("is-dragging");
    if (options.releaseCapture !== false && drag.range.hasPointerCapture?.(drag.pointerId)) {
      drag.range.releasePointerCapture(drag.pointerId);
    }
    if (drag.changed) {
      this.recordDesignHistory(drag.startSnapshot);
      this.syncWorkspaceToolbar();
      this.syncDiagnosticsAttributes();
    }
    this.renderInspector();
    this.syncInterface();
  }

  applyRangePointerValue(event, range) {
    if (!range?.isConnected || !Number.isFinite(event?.clientX)) return false;
    const travelLane = this.activeRangeDrag?.range === range
      ? this.activeRangeDrag.travelLane
      : this.measureRangeTravelLane(range);
    if (!travelLane) return false;
    const min = Number(range.min);
    const max = Number(range.max);
    const step = Number(range.step) || 1;
    const ratio = clamp((event.clientX - travelLane.left) / travelLane.width, 0, 1);
    const rawValue = min + ratio * (max - min);
    const steppedValue = min + Math.round((rawValue - min) / step) * step;
    const value = clamp(steppedValue, min, max);
    const previousValue = Number(this.state[range.dataset.field]);
    range.value = String(value);
    if (Math.abs(previousValue - value) <= 1e-9) return false;
    delete this.drafts[range.dataset.field];
    const applied = this.update(
      { ...this.state, [range.dataset.field]: value },
      { sourceField: range.dataset.field, recordHistory: this.activeRangeDrag ? false : true }
    );
    if (applied && this.activeRangeDrag && Math.abs(previousValue - value) > 1e-9) this.activeRangeDrag.changed = true;
    return applied;
  }

  measureRangeTravelLane(range) {
    const rect = range?.getBoundingClientRect?.();
    if (!rect || rect.width <= 0) return null;
    const configuredThumbSize = Number.parseFloat(
      window.getComputedStyle(range).getPropertyValue("--range-thumb-size")
    );
    const thumbSize = clamp(
      Number.isFinite(configuredThumbSize) && configuredThumbSize > 0 ? configuredThumbSize : 20,
      0,
      rect.width
    );
    const inset = thumbSize / 2;
    return {
      left: rect.left + inset,
      width: Math.max(rect.width - thumbSize, 1)
    };
  }

  setView(view) {
    this.cancelQueuedProfileFocus();
    const intent = this.dispatchCameraIntent({ type: "manual-interaction" });
    this.viewer.setView(view, {
      intentGeneration: intent.intentGeneration,
      modelGeneration: intent.modelGeneration
    });
    this.activeView = view === "reset" ? "three-quarter" : view;
    this.syncViewButtons();
    this.syncDiagnosticsAttributes();
  }

  syncViewButtons() {
    this.host.querySelectorAll("[data-view]").forEach((button) => {
      const active = button.dataset.view === this.activeView;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  applyPreset(presetId) {
    const transition = createPresetTransition(this.state, this.basePresetId, presetId);
    if (!transition.preset) return;
    this.drafts = {};
    const applied = this.update(transition.config, { sourceField: "layoutPreset" });
    if (!applied) return;
    this.basePresetId = transition.preset.id;
    this.syncInterface();
    if (this.sectionDesignerActive) this.refreshSectionDesignerPresentation();
    this.showStatus(`${transition.preset.name} preset applied.${transition.dimensionsPreserved ? " Your measured dimensions were kept." : ""} Layout-specific structure was reconciled automatically.`);
  }

  async updateBenjaminMooreResults(query) {
    const resultsHost = this.host.querySelector("[data-bm-results]");
    const status = this.host.querySelector("[data-bm-status]");
    const input = this.host.querySelector("[data-bm-query]");
    if (!resultsHost || !status || !input) return;
    const normalizedQuery = query.trim();
    const searchSequence = ++this.colorSearchSequence;
    if (!normalizedQuery) {
      resultsHost.hidden = true;
      resultsHost.innerHTML = "";
      status.textContent = "Search the official local palette catalog. Your current finish will not change until you apply a result.";
      return;
    }
    status.textContent = "Loading the Benjamin Moore color catalog…";
    try {
      const matches = await this.colorCatalog.search(normalizedQuery, { limit: 4 });
      if (searchSequence !== this.colorSearchSequence) return;
      if (!matches.length) {
        resultsHost.hidden = true;
        resultsHost.innerHTML = "";
        status.textContent = "No Benjamin Moore color was found for that name or code. Check the code and try again.";
        return;
      }
      resultsHost.innerHTML = matches.map((color) => {
        const collection = color.collections?.[0] || "";
        return `
          <article class="bm-result-card">
            <span class="bm-result-swatch" style="--bm-result-color:${escapeHtml(color.hex)}" aria-hidden="true"></span>
            <span class="bm-result-copy"><strong>${escapeHtml(color.name)}</strong><small>${escapeHtml(color.code)}${collection ? ` · ${escapeHtml(collection)}` : ""}</small></span>
            <button type="button" data-bm-id="${escapeHtml(color.id)}" aria-label="Apply ${escapeHtml(color.name)} ${escapeHtml(color.code)}">Apply</button>
          </article>
        `;
      }).join("");
      resultsHost.hidden = false;
      status.textContent = `${matches.length} ${matches.length === 1 ? "result" : "results"}. Choose Apply to update the bookcase.`;
    } catch (error) {
      if (searchSequence !== this.colorSearchSequence) return;
      resultsHost.hidden = true;
      resultsHost.innerHTML = "";
      status.textContent = "Color search is temporarily unavailable. Your current finish has not changed.";
    }
  }

  async applyBenjaminMooreQuery(query) {
    const normalizedQuery = query.trim();
    this.colorQueryDraft = normalizedQuery;
    if (!normalizedQuery) {
      this.host.querySelector("[data-bm-query]")?.focus();
      this.updateBenjaminMooreResults("");
      return;
    }
    try {
      const exact = await this.colorCatalog.getExact(normalizedQuery);
      if (exact) {
        this.applyBenjaminMooreColor(exact);
        return;
      }
      await this.updateBenjaminMooreResults(normalizedQuery);
    } catch (error) {
      const status = this.host.querySelector("[data-bm-status]");
      if (status) status.textContent = "Color search is temporarily unavailable. Your current finish has not changed.";
    }
  }

  async applyBenjaminMooreResult(catalogId) {
    try {
      const color = await this.colorCatalog.getById(catalogId);
      if (color) this.applyBenjaminMooreColor(color);
    } catch (error) {
      const status = this.host.querySelector("[data-bm-status]");
      if (status) status.textContent = "Color search is temporarily unavailable. Your current finish has not changed.";
    }
  }

  applyBenjaminMooreColor(color) {
    const paintSelection = createBenjaminMoorePaintSelection(color);
    if (!paintSelection) return;
    this.showColorSearch = false;
    this.colorQueryDraft = `${color.name} ${color.code}`;
    this.update({
      ...this.state,
      finish: "custom_bm",
      customPaintColor: color.name,
      customPaintCode: color.code,
      customPaintHex: color.hex,
      paintSelection
    }, { sourceField: "finish" });
    const input = this.host.querySelector("[data-bm-query]");
    if (input) input.value = `${color.name} ${color.code}`;
    this.closeBenjaminMooreResults();
    const status = this.host.querySelector("[data-bm-status]");
    if (status) status.textContent = `Applied ${color.name} ${color.code} to the bookcase. Digital preview only.`;
    this.showStatus(`${color.name} ${color.code} applied to the full bookcase.`);
  }

  closeBenjaminMooreResults() {
    const resultsHost = this.host.querySelector("[data-bm-results]");
    const input = this.host.querySelector("[data-bm-query]");
    if (resultsHost) resultsHost.hidden = true;
  }

  findMatchingPresetId(config) {
    const keys = [
      "layoutType",
      "width",
      "height",
      "depth",
      "sections",
      "shelves",
      "shelfThickness",
      "lowerCabinets",
      "lowerStorage",
      "drawerCount",
      "centerOpening",
      "deskOpening",
      "featureOpening",
      "tallDoors",
      "doorStyle",
      "drawerFrontStyle",
      "crownStyle",
      "baseStyle",
      "layoutMetadata"
    ];
    const signature = JSON.stringify(keys.map((key) => config[key]));
    return layoutPresets.find((preset) => {
      const presetConfig = normalizeBookcaseConfig({ ...preset.config, layoutPreset: preset.id });
      return JSON.stringify(keys.map((key) => presetConfig[key])) === signature;
    })?.id || "custom";
  }

  commitHardwareSelection(selection = {}) {
    const currentSelection = {
      type: getHardwareType(this.state.hardware),
      finish: getHardwareFinish(this.state.hardware)
    };
    const variant = resolveHardwareVariant({ ...currentSelection, ...selection }, this.state.hardware);
    const nextDefaultSelections = createLegacyHardwareSelections(variant.value);
    const existingSelections = this.state.hardwareSelections && typeof this.state.hardwareSelections === "object"
      ? this.state.hardwareSelections
      : {};
    return this.update({
      ...this.state,
      hardware: variant.value,
      hardwareSelections: {
        ...nextDefaultSelections,
        byHostId: { ...(existingSelections.byHostId || {}) },
        migrationWarnings: [
          ...(existingSelections.migrationWarnings || []),
          ...(nextDefaultSelections.migrationWarnings || [])
        ]
      }
    }, { sourceField: "hardware" });
  }

  handleFieldInput(target) {
    const fieldName = target.dataset.field;
    if (!fieldName) return;
    this.endOptionPreview(null, { restore: false });
    let value;
    if (target.type === "checkbox") {
      value = target.checked;
    } else if (numericFields.has(fieldName)) {
      const raw = String(target.value ?? "");
      const numeric = Number(raw);
      const min = target.min === "" ? Number.NEGATIVE_INFINITY : Number(target.min);
      const max = target.max === "" ? Number.POSITIVE_INFINITY : Number(target.max);
      if (target.type === "number" && (!raw.trim() || !Number.isFinite(numeric) || numeric < min || numeric > max)) {
        this.drafts[fieldName] = raw;
        this.syncDraftInputs(fieldName, raw, target);
        this.syncValidationMessages({ valid: false, issues: getInvalidDraftIssues(this.drafts) });
        this.syncActionAvailability();
        return;
      }
      value = numeric;
      delete this.drafts[fieldName];
    } else {
      value = target.value;
    }
    let next = { ...this.state, [fieldName]: value };
    let storageFallbackMessage = "";
    if (fieldName === "lowerCabinets" || fieldName === "lowerStorage") {
      const storageTransition = applyGlobalStorageSelection(
        this.state,
        this.layout,
        { [fieldName]: value }
      );
      Object.assign(next, storageTransition.config);
      if (
        fieldName === "lowerCabinets"
        && value === true
        && next.lowerStorage === "drawers"
        && !evaluateBookcaseCandidate(next).accepted
      ) {
        const doorFallback = applyGlobalStorageSelection(
          this.state,
          this.layout,
          { lowerCabinets: true, lowerStorage: "doors" }
        );
        next = { ...next, ...doorFallback.config };
        storageFallbackMessage = "Lower doors were applied because drawers do not fit every current section width.";
      }
    }
    if (fieldName === "sections") {
      const reconciliation = reconcileSectionCustomization(this.state, value, this.layout.rules);
      if (!reconciliation.accepted) {
        this.showStatus(reconciliation.error.message, true);
        this.syncInterface();
        return;
      }
      Object.assign(next, reconciliation.config);
    }
    if (fieldName === "customPaintColor" && String(value).trim()) next.finish = "custom_bm";
    const updated = this.update(next, { sourceField: fieldName });
    if (updated && storageFallbackMessage) this.showStatus(storageFallbackMessage);
    if (PROFILE_FOCUS_FIELDS.has(fieldName)) this.requestProfileCameraFocus(fieldName, { force: true });
    else this.focusCameraForField(fieldName);
  }

  handleStepperClick(button) {
    const fieldName = button.dataset.stepField;
    const input = button.closest("[data-stepper-control]")?.querySelector(`input[data-field="${fieldName}"]`)
      || this.host.querySelector(`input[data-field="${fieldName}"]`);
    if (!input) return;
    const direction = Number(button.dataset.stepDirection) || 0;
    const currentValue = Number(input.value);
    const allowedSectionCounts = fieldName === "sections" && Array.isArray(this.layout?.config?.allowedSectionCounts)
      ? this.layout.config.allowedSectionCounts
      : null;
    if (allowedSectionCounts) {
      const candidates = allowedSectionCounts.filter((value) => direction < 0 ? value < currentValue : value > currentValue);
      if (!candidates.length) return;
      const nextValue = direction < 0 ? Math.max(...candidates) : Math.min(...candidates);
      input.value = nextValue;
      delete this.drafts[fieldName];
      const nextState = fieldName === "sections"
        ? reconcileSectionCustomization(this.state, nextValue, this.layout.rules)
        : { accepted: true, config: { ...this.state, [fieldName]: nextValue } };
      if (!nextState.accepted) {
        this.showStatus(nextState.error.message, true);
        return;
      }
      this.update(nextState.config, { sourceField: fieldName });
      this.focusCameraForField(fieldName);
      return;
    }
    const min = Number(input.min) || Number.NEGATIVE_INFINITY;
    const max = Number(input.max) || Number.POSITIVE_INFINITY;
    const step = Number(input.step) || 1;
    const nextValue = clamp((currentValue || min) + direction * step, min, max);
    input.value = nextValue;
    delete this.drafts[fieldName];
    this.update({ ...this.state, [fieldName]: nextValue }, { sourceField: fieldName });
    this.focusCameraForField(fieldName);
  }

  update(nextState, options = {}) {
    const previousState = this.state;
    const evaluation = evaluateBookcaseCandidate(nextState);
    if (!evaluation.accepted) {
      this.syncInterface();
      const errorMessage = evaluation.errors[0]?.message || "This configuration is not structurally valid.";
      this.showStatus(errorMessage, true);
      return false;
    }

    const layoutPreset = this.findMatchingPresetId(evaluation.state);
    const state = normalizeBookcaseConfig({ ...evaluation.state, layoutPreset });
    const committedEvaluation = {
      ...evaluation,
      state,
      pricing: { ...evaluation.pricing, state }
    };
    const changedFields = getChangedConfigFields(previousState, state);

    if (!changedFields.length) {
      this.syncInterface();
      if (options.sourceField) this.clearStatus();
      return true;
    }

    this.selectedSectionIndex = clamp(this.selectedSectionIndex, 0, Math.max(0, state.sections - 1));
    const previousCameraModelGeneration = this.getCameraModelGeneration();
    const rendered = this.viewer.update(state, evaluation.layout, changedFields);
    if (rendered === false) {
      this.syncInterface();
      const renderMessage = this.viewer.lastRejectedRenderAudit?.issues?.[0]?.message ||
        "The 3D renderer rejected this configuration and kept the last verified model.";
      this.showStatus(renderMessage, true);
      return false;
    }

    if (options.recordHistory !== false) {
      const previousSnapshot = typeof structuredClone === "function"
        ? structuredClone(previousState)
        : JSON.parse(JSON.stringify(previousState));
      this.recordDesignHistory(previousSnapshot);
    }

    this.acceptedEvaluation = committedEvaluation;
    this.state = state;
    this.layout = evaluation.layout;
    this.bom = evaluation.bom;
    this.pricing = committedEvaluation.pricing;
    this.price = this.pricing.total;
    this.updateCount += 1;
    this.priceCalculationCount += 1;
    this.arController?.handleConfigurationChanged();
    if (this.selection) {
      this.selection = reconcileSelectionContext(this.selection, this.layout);
      if (!this.selection) {
        this.contextEditorOpen = false;
        this.elements?.shell?.classList.remove("is-context-open");
        if (this.elements?.contextEditor) this.elements.contextEditor.hidden = true;
        if (this.elements?.contextLeader) this.elements.contextLeader.hidden = true;
      } else {
        this.activeInspectorGroup = this.selection.inspectorGroupId;
        if (Number.isInteger(this.selection.sectionIndex)) this.selectedSectionIndex = this.selection.sectionIndex;
        this.viewer.setSelectedComponent?.(this.selection.highlightTarget?.componentId || this.selection.componentId);
      }
    }
    if (!this.activeRangeDrag?.range?.isConnected) this.renderInspector();
    if (this.contextEditorOpen && this.selection) this.renderContextEditor();
    this.syncInterface();
    this.directHardwareEditor?.sync?.({
      source: options.directHardware ? "direct_commit" : "external",
      changedFields
    });
    if (this.sectionDesignerActive && options.refreshSectionDesigner !== false) {
      this.viewer.setSectionDesigner?.({
        active: true,
        selectedIndex: this.selectedSectionIndex,
        layout: this.layout,
        onSelect: (index) => this.selectSection(index, { render: false, ensureFramed: true })
      });
    }
    const nextCameraModelGeneration = this.getCameraModelGeneration();
    if (nextCameraModelGeneration !== previousCameraModelGeneration) {
      this.dispatchCameraIntent({
        type: "model-change",
        stage: this.activeStageId,
        sectionIndex: this.selectedSectionIndex,
        modelGeneration: nextCameraModelGeneration,
        targetValid: this.isCameraIntentTargetValid(),
        preserveUserPose: shouldPreserveExactCamera(changedFields)
      });
    }
    const engineeringWarning = evaluation.warnings.find((item) => item.code === "SHELF_SUPPORT_REVIEW");
    if (!options.silent && evaluation.corrections.length) {
      this.showStatus(evaluation.corrections.map((correction) => correction.message || correction).join(" "));
    } else if (!options.silent && engineeringWarning) {
      this.showStatus(engineeringWarning.message);
    } else if (!options.silent) {
      this.clearStatus();
    }
    return true;
  }

  renderDoorOptions() {
    const generatedDoorCount = getApplicability(this.state, this.layout).generatedDoorCount;
    this.host.querySelectorAll("[data-generated-door-count]").forEach((output) => {
      output.textContent = `${generatedDoorCount} ${generatedDoorCount === 1 ? "door" : "doors"}`;
    });
  }

  syncControls() {
    Object.entries(this.state).forEach(([key, value]) => {
      this.host.querySelectorAll(`[data-field="${key}"]`).forEach((field) => {
        if (field.type === "number" && Object.prototype.hasOwnProperty.call(this.drafts, key)) {
          field.value = this.drafts[key];
          return;
        }
        if (field.type === "checkbox") {
          field.checked = Boolean(value);
        } else if (field.type === "radio") {
          field.checked = String(field.value) === String(value);
        } else {
          field.value = value;
        }
        if (field.type === "range") {
          const min = Number(field.min) || 0;
          const max = Number(field.max) || 100;
          const progress = ((Number(value) - min) / Math.max(1, max - min)) * 100;
          field.style.setProperty("--range-progress", `${progress}%`);
        }
      });
    });

    const allowedSectionCounts = Array.isArray(this.layout?.config?.allowedSectionCounts)
      ? this.layout.config.allowedSectionCounts
      : [1, 2, 3, 4, 5, 6];
    const minSections = allowedSectionCounts[0];
    const maxSections = allowedSectionCounts[allowedSectionCounts.length - 1];
    this.host.querySelectorAll('[data-stepper-control="sections"]').forEach((control) => {
      const decrement = control.querySelector('[data-step-direction="-1"]');
      const increment = control.querySelector('[data-step-direction="1"]');
      if (decrement) decrement.disabled = !allowedSectionCounts.some((value) => value < this.state.sections);
      if (increment) increment.disabled = !allowedSectionCounts.some((value) => value > this.state.sections);
    });
    this.host.querySelectorAll("[data-section-limit]").forEach((helper) => {
      const contiguous = allowedSectionCounts.every((value, index) => index === 0 || value === allowedSectionCounts[index - 1] + 1);
      const range = contiguous && minSections !== maxSections
        ? `${minSections}–${maxSections}`
        : allowedSectionCounts.join(", ");
      helper.textContent = minSections === maxSections
        ? `${minSections} ${minSections === 1 ? "section is" : "sections are"} required at ${this.state.width} inches wide.`
        : `Supported at ${this.state.width} inches wide: ${range} sections.`;
    });

    const liveWidth = this.host.querySelector("[data-live-width]");
    const liveHeight = this.host.querySelector("[data-live-height]");
    const liveDepth = this.host.querySelector("[data-live-depth]");
    if (liveWidth) liveWidth.textContent = `${this.state.width}"`;
    if (liveHeight) liveHeight.textContent = `${this.state.height}"`;
    if (liveDepth) liveDepth.textContent = `${this.state.depth}"`;
    this.syncPaintFinishControls();
    this.syncViewButtons();
  }

  syncDraftInputs(fieldName, value, source) {
    this.host.querySelectorAll(`[data-field="${fieldName}"]`).forEach((field) => {
      if (field !== source && field.type === "number") field.value = value;
    });
  }

  getFinishLabel() {
    const baseLabel = optionLabels.finish[this.state.finish] || "Paint finish";
    if (this.state.finish !== "custom_bm") return baseLabel;
    const selected = [this.state.customPaintColor, this.state.customPaintCode].filter(Boolean).join(" ");
    return selected || `${baseLabel} selected`;
  }

  syncPaintFinishControls() {
    const customSelected = this.state.finish === "custom_bm";
    this.host.querySelector(".builder-shell")?.classList.toggle("is-custom-paint-selected", customSelected);

    const selectedLine = this.host.querySelector("[data-selected-finish]");
    if (selectedLine) selectedLine.textContent = `Selected: ${this.getFinishLabel()}`;

    const customPanel = this.host.querySelector("[data-custom-bm-fields]");
    if (customPanel) {
      customPanel.hidden = !this.showColorSearch;
      customPanel.classList.toggle("is-selected", customSelected);
    }
    const query = this.host.querySelector("[data-bm-query]");
    if (query && document.activeElement !== query && customSelected) {
      query.value = [this.state.customPaintColor, this.state.customPaintCode].filter(Boolean).join(" ");
    } else if (query && document.activeElement !== query && !customSelected) {
      query.value = this.showColorSearch ? this.colorQueryDraft : "";
      if (!this.showColorSearch) {
        this.closeBenjaminMooreResults();
        const searchStatus = this.host.querySelector("[data-bm-status]");
        if (searchStatus) searchStatus.textContent = "Search the official local palette catalog. Your current finish will not change until you apply a result.";
      } else if (this.colorQueryDraft) {
        this.updateBenjaminMooreResults(this.colorQueryDraft);
      }
    }
  }

  syncInterface() {
    if (!this.hasAcceptedDesign || !this.elements?.shell) return;
    document.body.dataset.studioState = "accepted";
    this.elements.shell.dataset.diagnosticAcceptedDesign = "true";
    this.elements.shell.dataset.interface = "unified";
    this.elements.shell.classList.toggle("is-context-open", this.contextEditorOpen);
    this.syncReviewContent();
    this.syncControls();
    this.renderDoorOptions();
    this.syncApplicability();
    this.syncPresetCards();
    this.updatePriceAndSummary();
    this.syncCategorySummaries();
    this.syncValidationMessages();
    this.syncActionAvailability();
    this.syncWorkspaceToolbar();
    this.syncDiagnosticsAttributes();
  }

  syncDiagnosticsAttributes() {
    const shell = this.elements?.shell;
    if (!shell) return;
    if (!this.hasAcceptedDesign) {
      this.syncStudioEntry();
      return;
    }
    this.syncCameraIntentAttributes();
    const viewer = this.viewer?.getDiagnostics?.() || {};
    const view = this.viewer?.getViewState?.() || {};
    shell.dataset.diagnosticInterface = "unified";
    shell.dataset.diagnosticInspectorGroup = this.activeInspectorGroup;
    shell.dataset.diagnosticWorkspaceStage = this.activeStageId;
    shell.dataset.diagnosticInspectorTab = this.activeInspectorTabId;
    shell.dataset.diagnosticHistoryUndo = String(this.designHistory.undo.length);
    shell.dataset.diagnosticHistoryRedo = String(this.designHistory.redo.length);
    shell.dataset.diagnosticSelectionKind = this.selection?.kind || "";
    shell.dataset.diagnosticSelectionEditor = this.selection?.editorId || "";
    shell.dataset.diagnosticPhysicalUpdates = String(this.updateCount);
    shell.dataset.diagnosticPriceCalculations = String(this.priceCalculationCount);
    shell.dataset.diagnosticSaveActions = String(this.saveActionCount);
    shell.dataset.diagnosticQuoteActions = String(this.quoteActionCount);
    shell.dataset.diagnosticViewerInstance = String(viewer.instanceId ?? "fallback");
    shell.dataset.diagnosticViewerUpdates = String(viewer.updateCount ?? 0);
    shell.dataset.diagnosticViewerRebuilds = String(viewer.rebuildCount ?? 0);
    shell.dataset.diagnosticViewerPartialUpdates = String(viewer.partialUpdateCount ?? 0);
    shell.dataset.diagnosticViewerPreviews = String(viewer.previewCount ?? 0);
    shell.dataset.diagnosticViewerPreviewActive = String(Boolean(viewer.previewActive));
    shell.dataset.diagnosticDirectEditing = String(Boolean(viewer.directEditing?.enabled));
    shell.dataset.diagnosticDirectSelected = String(viewer.directEditing?.selectedComponentId || "");
    shell.dataset.diagnosticDirectHitProxies = String(viewer.directEditing?.hitProxyCount || 0);
    shell.dataset.diagnosticCameraFocus = String(viewer.activeFocus ?? "overview");
    shell.dataset.diagnosticCameraTransition = String(Boolean(viewer.cameraTransitionActive));
    shell.dataset.diagnosticCameraSequence = String(viewer.cameraTransitionSequence ?? 0);
    shell.dataset.diagnosticCameraCancellations = String(viewer.cameraTransitionCancellations ?? 0);
    shell.dataset.diagnosticCameraIntentGeneration = String(this.cameraIntentState?.intentGeneration ?? 0);
    shell.dataset.diagnosticCameraModelGeneration = String(this.cameraIntentState?.modelGeneration ?? 0);
    shell.dataset.diagnosticControlsEnabled = String(Boolean(viewer.controlsEnabled));
    shell.dataset.diagnosticReducedMotion = String(Boolean(viewer.reducedMotion));
    shell.dataset.diagnosticCanvasCount = String(this.elements.viewer?.querySelectorAll("canvas").length || 0);
    shell.dataset.diagnosticActiveView = this.activeView;
    shell.dataset.diagnosticView = JSON.stringify({
      theta: Number(view.theta || 0).toFixed(5),
      phi: Number(view.phi || 0).toFixed(5),
      radiusRatio: view.baseRadius ? Number(view.radius / view.baseRadius).toFixed(5) : "0.00000",
      environmentScale: Number(view.environmentScale ?? 1).toFixed(5),
      exposure: Number(view.exposure ?? 1.08).toFixed(5),
      target: {
        x: Number(view.target?.x || 0).toFixed(5),
        y: Number(view.target?.y || 0).toFixed(5),
        z: Number(view.target?.z || 0).toFixed(5)
      }
    });
    shell.dataset.diagnosticConfiguration = JSON.stringify(this.state);
    shell.dataset.diagnosticPricing = JSON.stringify({
      pricingVersion: this.pricing.pricingVersion,
      bom: this.bom,
      lineItems: this.pricing.lineItems,
      total: this.pricing.total
    });
  }

  syncApplicability() {
    const applicability = getApplicability(this.state, this.layout);
    const visibility = {
      cabinets: applicability.showCabinetControls,
      drawers: applicability.showDrawerCount,
      doors: applicability.showDoorControls,
      fronts: applicability.hasFronts,
      hardware: applicability.showHardware,
      "lighting-warmth": applicability.showLightingWarmth
    };
    this.host.querySelectorAll("[data-applicability]").forEach((element) => {
      const visible = visibility[element.dataset.applicability] !== false;
      element.hidden = !visible;
      element.toggleAttribute("inert", !visible);
    });
  }

  syncCategorySummaries() {
    this.host.querySelectorAll("[data-category-summary]").forEach((element) => {
      element.textContent = getInspectorGroupSummary(element.dataset.categorySummary, this.state, this.layout, this.basePresetId);
    });
  }

  syncReviewContent() {
    if (this.elements.reviewDialogContent) {
      this.elements.reviewDialogContent.innerHTML = this.renderReviewContent({ includeActions: true });
    }
  }

  syncValidationMessages(result = null) {
    const validation = result || validateUnifiedConfiguration(this.state, this.layout, this.drafts);
    this.host.querySelectorAll("[data-field], [data-validation-field]").forEach((field) => {
      field.removeAttribute("aria-invalid");
      const defaultDescription = field.dataset.defaultDescribedby?.trim();
      if (defaultDescription) field.setAttribute("aria-describedby", defaultDescription);
      else field.removeAttribute("aria-describedby");
    });
    this.host.querySelectorAll("[data-field-error]").forEach((element) => {
      element.textContent = "";
    });
    validation.issues.forEach((issue) => {
      const errors = [...this.host.querySelectorAll('[data-field-error="' + issue.field + '"]')];
      errors.forEach((error, index) => {
        error.id = `${this.id}-error-${issue.field}-${index + 1}`;
        error.textContent = issue.message;
      });
      this.host.querySelectorAll('[data-field="' + issue.field + '"], [data-validation-field="' + issue.field + '"]').forEach((field, index) => {
        field.setAttribute("aria-invalid", "true");
        const error = errors[Math.min(index, Math.max(0, errors.length - 1))];
        if (error?.id) {
          const descriptions = new Set((field.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean));
          descriptions.add(error.id);
          field.setAttribute("aria-describedby", [...descriptions].join(" "));
        }
      });
    });
    const invalidGroups = new Set(validation.issues.map((issue) => issue.inspectorGroupId || inspectorGroupForField(issue.field)));
    this.host.querySelectorAll("[data-category]").forEach((category) => {
      category.classList.toggle("needs-attention", invalidGroups.has(category.dataset.category));
    });
    this.host.querySelectorAll("[data-workspace-stage]").forEach((stageButton) => {
      const stage = WORKSPACE_STAGES.find((item) => item.id === stageButton.dataset.workspaceStage);
      const issue = validation.issues.find((item) => STAGE_CONTROL_GROUPS[stage?.id]?.includes(item.inspectorGroupId || inspectorGroupForField(item.field)));
      stageButton.classList.toggle("needs-attention", Boolean(issue));
      if (issue) {
        stageButton.setAttribute("aria-label", `${stage.label}, needs attention: ${issue.message}`);
        stageButton.setAttribute("aria-invalid", "true");
      } else {
        stageButton.setAttribute("aria-label", `${stage.label}: ${stage.subtitle}`);
        stageButton.removeAttribute("aria-invalid");
      }
    });
  }

  syncActionAvailability() {
    const validation = validateUnifiedConfiguration(this.state, this.layout, this.drafts);
    const blocking = !validation.valid;
    const now = Date.now();
    const saveLocked = !shouldRunAction(this.actionStartedAt.save, now);
    const quoteLocked = !shouldRunAction(this.actionStartedAt.quote, now);
    const actionHint = this.host.querySelector("[data-action-hint]");
    if (actionHint) {
      const issue = validation.issues[0];
      actionHint.textContent = blocking
        ? `${issue?.message || "Review the highlighted configuration issue."} Complete the highlighted field before reviewing, saving, or requesting a quote.`
        : "Final pricing is confirmed after measurements and project details are verified.";
      if (blocking && issue) {
        const issueGroup = issue.inspectorGroupId || inspectorGroupForField(issue.field);
        const issueStage = WORKSPACE_STAGES.find((stage) => STAGE_CONTROL_GROUPS[stage.id]?.includes(issueGroup));
        if (issueStage) {
          const fixButton = document.createElement("button");
          fixButton.type = "button";
          fixButton.className = "configurator-fix-stage";
          fixButton.dataset.workspaceStageLink = issueStage.id;
          fixButton.dataset.workspaceFocusField = issue.field;
          fixButton.textContent = `Fix ${issueStage.label}`;
          actionHint.append(" ", fixButton);
        }
      }
      actionHint.classList.toggle("is-blocking", blocking);
    }
    this.host.querySelectorAll("[data-review-design]").forEach((button) => {
      button.disabled = blocking;
      button.setAttribute("aria-disabled", String(button.disabled));
      if (blocking && actionHint?.id) button.setAttribute("aria-describedby", actionHint.id);
      else button.removeAttribute("aria-describedby");
    });
    this.host.querySelectorAll("[data-save-design]").forEach((button) => {
      button.disabled = blocking || saveLocked;
      button.setAttribute("aria-disabled", String(button.disabled));
      if (blocking && actionHint?.id) button.setAttribute("aria-describedby", actionHint.id);
      else button.removeAttribute("aria-describedby");
    });
    this.host.querySelectorAll("[data-open-order]").forEach((button) => {
      button.disabled = blocking || quoteLocked;
      button.setAttribute("aria-disabled", String(button.disabled));
      if (blocking && actionHint?.id) button.setAttribute("aria-describedby", actionHint.id);
      else button.removeAttribute("aria-describedby");
    });
    this.host.querySelectorAll("[data-open-ar]").forEach((button) => {
      button.disabled = blocking;
      button.setAttribute("aria-disabled", String(button.disabled));
      if (blocking && actionHint?.id) button.setAttribute("aria-describedby", actionHint.id);
      else button.removeAttribute("aria-describedby");
    });
  }

  getDiagnostics() {
    if (!this.hasAcceptedDesign) {
      return {
        acceptedDesign: false,
        entryView: this.entryView,
        state: null,
        price: null,
        pricing: null,
        updateCount: 0,
        priceCalculationCount: 0,
        saveActionCount: 0,
        quoteActionCount: 0,
        analyticsEvents: [...this.analyticsEvents],
        viewer: this.viewer?.getDiagnostics?.(),
        view: null,
        canvasCount: 0
      };
    }
    return {
      acceptedDesign: true,
      initialSource: this.initialSource,
      interface: "unified",
      activeInspectorGroup: this.activeInspectorGroup,
      activeWorkspaceStage: this.activeStageId,
      activeInspectorTab: this.activeInspectorTabId,
      history: { undo: this.designHistory.undo.length, redo: this.designHistory.redo.length },
      display: { dimensions: this.showDimensions, wall: this.showWall, tool: this.activeTool, fullscreen: this.fullscreen },
      selection: this.selection ? { ...this.selection } : null,
      contextEditorOpen: this.contextEditorOpen,
      state: { ...this.state },
      price: this.price,
      pricing: {
        pricingVersion: this.pricing.pricingVersion,
        bom: this.bom,
        lineItems: this.pricing.lineItems
      },
      updateCount: this.updateCount,
      priceCalculationCount: this.priceCalculationCount,
      saveActionCount: this.saveActionCount,
      quoteActionCount: this.quoteActionCount,
      analyticsEvents: [...this.analyticsEvents],
      viewer: this.viewer?.getDiagnostics?.(),
      view: this.viewer?.getViewState?.(),
      canvasCount: this.elements.viewer?.querySelectorAll("canvas").length || 0
    };
  }

  syncPresetCards() {
    const currentPreset = layoutPresets.find((preset) => preset.id === this.state.layoutPreset);
    const activePresetId = currentPreset?.id || this.basePresetId;
    const activePreset = this.host.querySelector("[data-active-preset]");
    const presetDescription = this.host.querySelector("[data-preset-description]");
    if (activePreset) activePreset.textContent = currentPreset?.name || "Custom layout";
    if (presetDescription) presetDescription.textContent = currentPreset?.description || "Customized from a JQ Bookcases layout.";
    this.host.querySelectorAll("[data-preset-id]").forEach((button) => {
      const isActive = button.dataset.presetId === activePresetId;
      button.classList.toggle("is-active", isActive);
      button.classList.toggle("is-customized", isActive && !currentPreset);
      button.setAttribute("aria-pressed", String(isActive));
    });
  }

  updatePriceAndSummary() {
    const price = this.price;
    const currentPreset = layoutPresets.find((preset) => preset.id === this.state.layoutPreset);
    this.elements.price.textContent = formatPrice(price);
    this.setOptionalText("[data-summary-preset]", currentPreset?.name || "Custom");
    this.setOptionalText("[data-summary-sections]", this.state.sections);
    this.setOptionalText("[data-summary-shelves]", this.state.shelves);
    this.setOptionalText("[data-summary-finish]", this.getFinishLabel());
    const hardwareSummary = getInspectorGroupSummary("hardware", this.state, this.layout, this.basePresetId);
    const lightingSummary = getInspectorGroupSummary("lighting", this.state, this.layout, this.basePresetId);
    this.setOptionalText("[data-summary-hardware]", `${hardwareSummary} / ${lightingSummary}`);
    this.setOptionalText("[data-summary-installation]", optionLabels.installation[this.state.installation].replace(" Installation", ""));
  }

  setOptionalText(selector, value) {
    const element = this.host.querySelector(selector);
    if (element) element.textContent = value;
  }

  saveCurrentDesign() {
    const design = createAcceptedDesignSnapshot(this.acceptedEvaluation);
    let persisted = false;
    try {
      localStorage.setItem("jqBookcasesDesign", JSON.stringify(design));
      persisted = true;
    } catch (error) {
      // Local storage may be disabled; keep the visible ID available.
    }
    return { ...design, persisted };
  }

  openQuotePage() {
    const design = this.saveCurrentDesign();
    if (!design.persisted) {
      this.showStatus("This browser blocked local design storage, so the quote handoff could not be prepared. Allow site storage and try again.", true);
      window.setTimeout(() => this.syncActionAvailability(), 720);
      return false;
    }
    window.location.assign(createQuoteUrl(design.id));
    return true;
  }

  clearStatus() {
    window.clearTimeout(this.statusTimer);
    this.elements.status.textContent = "";
    this.elements.status.classList.remove("is-visible");
  }

  showStatus(message, persistent = false) {
    window.clearTimeout(this.statusTimer);
    this.elements.status.textContent = message;
    this.elements.status.classList.add("is-visible");
    if (!persistent) {
      this.statusTimer = window.setTimeout(() => {
        this.elements.status.classList.remove("is-visible");
      }, 3200);
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.eventAbortController?.abort();
    this.stopStudioPreviewMotion(true);
    window.clearTimeout(this.statusTimer);
    window.clearTimeout(this.colorSearchTimer);
    window.clearTimeout(this.resetConfirmationTimer);
    this.directHardwareEditor?.destroy?.();
    this.viewer?.destroy?.();
    this.arController?.destroy?.();
    if (this.host.__bookcaseConfigurator === this) delete this.host.__bookcaseConfigurator;
  }

}

class BookcaseViewer3D {
  constructor(root, initialState, initialLayout = null, onCameraInteraction = null) {
    this.root = root;
    this.instanceId = ++viewerInstanceSequence;
    this.state = normalizeBookcaseConfig(initialState);
    this.onCameraInteraction = typeof onCameraInteraction === "function" ? onCameraInteraction : () => {};
    this.updateCount = 0;
    this.rebuildCount = 0;
    this.partialUpdateCount = 0;
    this.previewCount = 0;
    this.previewActive = false;
    this.renderCount = 0;
    this.animationFrame = null;
    this.isRenderingFrame = false;
    this.destroyed = false;
    this.controlAbortController = new AbortController();
    this.constructionDebugEnabled = new URLSearchParams(window.location.search).get("constructionDebug") === "1";
    this.constructionDebugState = {
      isolate: "all",
      showBounds: false,
      showRenderedBounds: false,
      showPlanes: true,
      showToeVoid: true
    };
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setClearColor(0x6a6258, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.root.appendChild(this.renderer.domElement);
    this.sectionInteractionLayer = new THREE.Group();
    this.sectionInteractionLayer.name = "section-designer-interaction-layer";
    this.sectionInteractionLayer.userData.nonPhysicalHelper = true;
    this.scene.add(this.sectionInteractionLayer);
    this.constructionDebugGroup = new THREE.Group();
    this.constructionDebugGroup.name = "construction-debug-helpers";
    this.constructionDebugGroup.userData.nonPhysicalHelper = true;
    this.constructionDebugGroup.visible = this.constructionDebugEnabled;
    this.scene.add(this.constructionDebugGroup);
    this.sectionOverlay = document.createElement("div");
    this.sectionOverlay.className = "section-designer-overlay";
    this.sectionOverlay.dataset.sectionOverlay = "";
    this.sectionOverlay.hidden = true;
    this.root.appendChild(this.sectionOverlay);
    this.sectionRaycaster = new THREE.Raycaster();
    this.sectionPointer = new THREE.Vector2();
    this.directEditRaycaster = new THREE.Raycaster();
    this.directEditRaycaster.layers.set(DIRECT_EDIT_LAYER);
    this.directEditPointer = new THREE.Vector2();
    this.directEdit = {
      enabled: false,
      hoveredComponentId: null,
      selectedComponentId: null,
      onHover: null,
      onSelect: null,
      onAnchorChange: null
    };
    this.lastRejectedRenderAudit = null;
    this.directHighlightGroup = new THREE.Group();
    this.directHighlightGroup.name = "direct-edit-highlight-layer";
    this.directHighlightGroup.userData.nonPhysicalHelper = true;
    this.scene.add(this.directHighlightGroup);
    this.sectionDesigner = {
      active: false,
      selectedIndex: 0,
      onSelect: null,
      layout: null,
      measurement: null,
      overlaySignature: ""
    };
    this.pendingSectionPreview = null;
    this.pendingSectionPreviewRestore = null;
    this.sectionPreviewCanonical = null;
    this.sectionPreviewRendered = false;
    this.sectionPreviewLastAppliedAt = 0;
    this.applyingSectionPreview = false;
    this.target = new THREE.Vector3(0, inchesToUnits(this.state.height) / 2, 0);
    this.theta = -0.14;
    this.phi = 0.12;
    this.baseRadius = 12;
    this.radius = 0;
    this.overviewTarget = this.target.clone();
    this.activeFocusKey = "overview";
    this.activeFocusVariant = "overview";
    this.cameraTransition = null;
    this.cameraTransitionSequence = 0;
    this.cameraTransitionCancellationCount = 0;
    this.cameraIntentGeneration = 0;
    this.modelGeneration = 0;
    this.cameraIntentProfile = "overview";
    this.focusTargetCache = new Map();
    this.focusRadius = this.baseRadius;
    this.reducedMotionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)") || null;
    this.environmentLights = [];
    this.environmentLightScale = 1;
    this.activeTool = "select";
    this.dimensionsVisible = true;
    this.wallVisible = true;
    this.roomEnvironment = new THREE.Group();
    this.roomEnvironment.name = "nonphysical-room-environment";
    this.roomEnvironment.userData.nonPhysicalHelper = true;
    this.scene.add(this.roomEnvironment);
    this.highlightState = null;
    this.drag = null;
    this.model = new THREE.Group();
    this.scene.add(this.model);
    this.setupEnvironment();
    this.setupConstructionInspector();
    this.bindControls();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.root);
    this.resize();
    if (!this.update(this.state, initialLayout, ["initial"])) {
      throw new Error("The initial 3D model failed the descriptor render contract.");
    }
    this.requestRender();
  }

  setupEnvironment() {
    this.scene.fog = new THREE.FogExp2(0xf3f0eb, 0.004);
    this.renderer.setClearColor(0xf5f2ee, 1);
    const hemisphere = new THREE.HemisphereLight(0xfffcf7, 0xc7b9a8, 1.55);
    this.scene.add(hemisphere);

    const key = new THREE.DirectionalLight(0xf7ecdf, 2.45);
    key.position.set(4.2, 8.6, 6.4);
    key.castShadow = true;
    key.shadow.mapSize.set(1536, 1536);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 30;
    key.shadow.camera.left = -9;
    key.shadow.camera.right = 9;
    key.shadow.camera.top = 9;
    key.shadow.camera.bottom = -9;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xfff8ef, 0.72);
    fill.position.set(-6, 4.6, 5.4);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0xe9ddcf, 0.46);
    rim.position.set(-4.8, 5.8, -4.6);
    this.scene.add(rim);

    const leftGlow = new THREE.PointLight(0xe8dccb, 0.12, 18);
    leftGlow.position.set(-7.2, 4.2, 2.7);
    this.scene.add(leftGlow);

    const rightGlow = new THREE.PointLight(0xe8dccb, 0.11, 18);
    rightGlow.position.set(7.2, 4.0, 2.8);
    this.scene.add(rightGlow);
    this.environmentLights = [hemisphere, key, fill, rim, leftGlow, rightGlow];
    this.environmentLights.forEach((light) => {
      light.userData.smartFocusBaseIntensity = light.intensity;
    });

    const contactMaterial = new THREE.MeshBasicMaterial({
      map: createContactShadowTexture(),
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const contact = new THREE.Mesh(new THREE.PlaneGeometry(13, 4.2), contactMaterial);
    contact.userData.nonPhysicalHelper = true;
    contact.name = "nonphysical-contact-shadow";
    contact.rotation.x = -Math.PI / 2;
    contact.position.set(0, -0.025, 0.12);
    this.scene.add(contact);

    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xf1efeb, roughness: 0.94, metalness: 0 });
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(22, 12), wallMaterial);
    wall.name = "nonphysical-room-wall";
    wall.userData.nonPhysicalHelper = true;
    wall.position.set(0, 5.55, -0.9);
    wall.receiveShadow = true;
    this.roomWall = wall;
    this.roomEnvironment.add(wall);

    const baseboardMaterial = new THREE.MeshStandardMaterial({ color: 0xf8f7f4, roughness: 0.72 });
    const baseboard = new THREE.Mesh(new THREE.BoxGeometry(22, 0.18, 0.12), baseboardMaterial);
    baseboard.name = "nonphysical-room-baseboard";
    baseboard.userData.nonPhysicalHelper = true;
    baseboard.position.set(0, 0.1, -0.82);
    baseboard.castShadow = true;
    baseboard.receiveShadow = true;
    this.roomBaseboard = baseboard;
    this.roomEnvironment.add(baseboard);

    const floorTexture = createRoomFloorTexture();
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(7, 4);
    const floorMaterial = new THREE.MeshStandardMaterial({ map: floorTexture, color: 0xe0d1bd, roughness: 0.88, metalness: 0 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(22, 12), floorMaterial);
    floor.name = "nonphysical-room-floor";
    floor.userData.nonPhysicalHelper = true;
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -0.055, 3.8);
    floor.receiveShadow = true;
    this.roomFloor = floor;
    this.roomEnvironment.add(floor);

  }

  setupConstructionInspector() {
    if (!this.constructionDebugEnabled) return;
    const inspector = document.createElement("aside");
    inspector.className = "construction-inspector";
    inspector.dataset.constructionInspector = "";
    inspector.setAttribute("aria-label", "JQ construction inspector");
    inspector.innerHTML = `
      <header><strong>JQ Construction Inspector</strong><small>Developer mode</small></header>
      <div class="construction-inspector-actions" role="group" aria-label="Isolate components">
        <button type="button" data-construction-isolate="all" aria-pressed="true">All</button>
        <button type="button" data-construction-isolate="base" aria-pressed="false">Base</button>
        <button type="button" data-construction-isolate="fronts" aria-pressed="false">Fronts</button>
        <button type="button" data-construction-isolate="hardware" aria-pressed="false">Hardware</button>
      </div>
      <label><input type="checkbox" data-construction-debug="planes" checked> Reference planes</label>
      <label><input type="checkbox" data-construction-debug="bounds"> Descriptor bounds</label>
      <label><input type="checkbox" data-construction-debug="rendered"> Rendered bounds</label>
      <label><input type="checkbox" data-construction-debug="toe" checked> Toe-kick void</label>
      <pre data-construction-report></pre>
    `;
    this.root.appendChild(inspector);
    this.constructionInspector = inspector;
    inspector.addEventListener("click", (event) => {
      const button = event.target.closest?.("[data-construction-isolate]");
      if (!button) return;
      this.constructionDebugState.isolate = button.dataset.constructionIsolate;
      inspector.querySelectorAll("[data-construction-isolate]").forEach((item) => {
        item.setAttribute("aria-pressed", String(item === button));
      });
      this.updateConstructionInspector(this.lastLayout);
    }, { signal: this.controlAbortController.signal });
    inspector.addEventListener("change", (event) => {
      const toggle = event.target.closest?.("[data-construction-debug]");
      if (!toggle) return;
      const key = toggle.dataset.constructionDebug;
      if (key === "planes") this.constructionDebugState.showPlanes = toggle.checked;
      if (key === "bounds") this.constructionDebugState.showBounds = toggle.checked;
      if (key === "rendered") this.constructionDebugState.showRenderedBounds = toggle.checked;
      if (key === "toe") this.constructionDebugState.showToeVoid = toggle.checked;
      this.updateConstructionInspector(this.lastLayout);
    }, { signal: this.controlAbortController.signal });
  }

  bindControls() {
    const signal = this.controlAbortController.signal;
    this.root.addEventListener("pointerdown", (event) => {
      if (event.target.closest?.("[data-section-overlay]")) return;
      if ((event.button != null && event.button !== 0) || event.isPrimary === false || this.drag) return;
      this.cancelCameraTransition();
      this.drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false, tool: this.activeTool };
      this.root.setPointerCapture(event.pointerId);
      this.root.classList.add("is-dragging");
      this.onCameraInteraction("gesture-start", { modelGeneration: this.modelGeneration });
    }, { signal });

    this.root.addEventListener("pointermove", (event) => {
      if (!this.drag) {
        this.updateDirectEditHover(event);
        return;
      }
      if (event.pointerId !== this.drag.pointerId) return;
      const dx = event.clientX - this.drag.x;
      const dy = event.clientY - this.drag.y;
      const moved = this.drag.moved || Math.hypot(event.clientX - this.drag.startX, event.clientY - this.drag.startY) > 5;
      this.drag = { ...this.drag, x: event.clientX, y: event.clientY, moved };
      if (this.drag.tool === "pan") {
        const scale = Math.max(0.002, this.radius * 0.0017);
        const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
        const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
        this.target.addScaledVector(right, -dx * scale).addScaledVector(up, dy * scale);
        this.target.x = clamp(this.target.x, -8, 8);
        this.target.y = clamp(this.target.y, -1, 12);
        this.onCameraInteraction("pan");
      } else {
        this.theta -= dx * 0.007;
        this.phi = clamp(this.phi + dy * 0.004, -0.12, 0.72);
        this.onCameraInteraction("rotate");
      }
      this.updateCamera();
    }, { signal });

    this.root.addEventListener("pointerup", (event) => {
      if (!this.drag || event.pointerId !== this.drag.pointerId) return;
      const drag = this.finishPointerDrag(event.pointerId);
      const isClick = Boolean(drag && !drag.moved);
      const selectDirectComponent = this.activeTool === "select" && this.directEdit.enabled && isClick;
      const selectSection = this.sectionDesigner.active && !selectDirectComponent && isClick;
      if (selectDirectComponent) this.selectDirectComponentFromPointer(event);
      else if (selectSection) this.selectSectionFromPointer(event);
    }, { signal });

    this.root.addEventListener("pointercancel", (event) => {
      this.finishPointerDrag(event.pointerId);
    }, { signal });

    this.root.addEventListener("lostpointercapture", (event) => {
      this.finishPointerDrag(event.pointerId, { releaseCapture: false });
    }, { signal });

    const cancelInterruptedGesture = () => this.finishPointerDrag();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") cancelInterruptedGesture();
    }, { signal });
    window.addEventListener("blur", cancelInterruptedGesture, { signal });

    this.root.addEventListener("pointerleave", () => {
      if (!this.drag) this.setDirectHoveredComponent(null);
    }, { signal });

    this.root.addEventListener("wheel", (event) => {
      if (event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      this.cancelCameraTransition();
      const limits = this.getZoomLimits();
      this.radius = clamp(this.radius + event.deltaY * 0.008, limits.min, limits.max);
      this.onCameraInteraction("zoom");
      this.updateCamera();
    }, { passive: false, signal });

    this.root.addEventListener("keydown", (event) => {
      if (event.ctrlKey || event.metaKey) return;
      if (event.target !== this.root && event.target.closest?.("[data-section-overlay], button, input, select, textarea, [contenteditable='true']")) return;
      if ((event.key === "Enter" || event.key === " ") && this.directEdit.enabled) {
        const componentId = this.directEdit.hoveredComponentId || this.directEdit.selectedComponentId;
        if (componentId) {
          event.preventDefault();
          this.selectDirectComponent(componentId, { source: "keyboard" });
          return;
        }
      }
      this.cancelCameraTransition();
      const limits = this.getZoomLimits();
      if (event.key === "0") {
        event.preventDefault();
        this.onCameraInteraction("reset");
        this.setView("reset");
        return;
      }
      if (this.activeTool === "pan" && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
        const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
        const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
        if (event.key === "ArrowLeft") this.target.addScaledVector(right, -0.25);
        if (event.key === "ArrowRight") this.target.addScaledVector(right, 0.25);
        if (event.key === "ArrowUp") this.target.addScaledVector(up, 0.25);
        if (event.key === "ArrowDown") this.target.addScaledVector(up, -0.25);
      } else if (event.key === "ArrowLeft") this.theta -= 0.12;
      else if (event.key === "ArrowRight") this.theta += 0.12;
      else if (event.key === "ArrowUp") this.phi = clamp(this.phi + 0.08, -0.12, 0.72);
      else if (event.key === "ArrowDown") this.phi = clamp(this.phi - 0.08, -0.12, 0.72);
      else if (event.key === "+" || event.key === "=") this.radius = clamp(this.radius * 0.9, limits.min, limits.max);
      else if (event.key === "-") this.radius = clamp(this.radius * 1.1, limits.min, limits.max);
      else return;
      event.preventDefault();
      this.onCameraInteraction(event.key === "+" || event.key === "=" || event.key === "-" ? "zoom" : "rotate");
      this.updateCamera();
    }, { signal });
  }

  finishPointerDrag(pointerId = null, options = {}) {
    const drag = this.drag;
    if (!drag || (pointerId != null && drag.pointerId !== pointerId)) return null;
    this.drag = null;
    if (options.releaseCapture !== false && this.root.hasPointerCapture?.(drag.pointerId)) {
      this.root.releasePointerCapture(drag.pointerId);
    }
    this.root.classList.remove("is-dragging");
    return drag;
  }

  setInteractionTool(tool) {
    this.activeTool = tool === "pan" ? "pan" : "select";
    this.root.dataset.interactionTool = this.activeTool;
    this.root.classList.toggle("is-pan-tool", this.activeTool === "pan");
    this.root.style.cursor = this.activeTool === "pan" ? "grab" : "";
    if (this.activeTool === "pan") this.setDirectHoveredComponent(null);
  }

  setDimensionsVisible(visible) {
    this.dimensionsVisible = visible !== false;
    this.root.dataset.dimensionsVisible = String(this.dimensionsVisible);
    if (this.sectionOverlay) this.sectionOverlay.hidden = !this.dimensionsVisible || !this.sectionDesigner.active;
    this.requestRender();
  }

  setWallVisible(visible) {
    this.wallVisible = visible !== false;
    this.root.dataset.wallVisible = String(this.wallVisible);
    if (this.roomWall) this.roomWall.visible = this.wallVisible;
    if (this.roomBaseboard) this.roomBaseboard.visible = this.wallVisible;
    if (this.roomFloor) this.roomFloor.visible = this.wallVisible;
    this.requestRender();
  }

  setDirectEditing(options = {}) {
    this.directEdit.enabled = options.enabled !== false;
    this.directEdit.onHover = typeof options.onHover === "function" ? options.onHover : null;
    this.directEdit.onSelect = typeof options.onSelect === "function" ? options.onSelect : null;
    this.directEdit.onAnchorChange = typeof options.onAnchorChange === "function" ? options.onAnchorChange : null;
    this.root.dataset.directEditing = String(this.directEdit.enabled);
    this.root.setAttribute(
      "aria-label",
      this.directEdit.enabled
        ? "Built-in bookcase preview. Drag to rotate. Point to a section, front, shelf, handle, light, divider, base, crown, or body panel to edit it."
        : "Built-in bookcase preview. Use arrow keys to rotate and plus or minus to zoom."
    );
    if (!this.directEdit.enabled) this.clearDirectSelection();
    else this.notifyDirectAnchor();
  }

  getDirectComponent(componentId) {
    return this.lastLayout?.components?.find((component) => component.id === componentId) || null;
  }

  getDirectSelectionPayload(componentId, source = "canvas", pointer = null) {
    const component = this.getDirectComponent(componentId);
    if (!component || !DIRECT_EDITABLE_ROLES.has(component.role)) return null;
    const pointerClientX = Number(pointer?.clientX);
    const pointerClientY = Number(pointer?.clientY);
    return Object.freeze({
      componentId: component.id,
      role: component.role,
      hostId: component.hostId || component.id,
      sectionId: component.metadata?.sectionId || getDescriptorSectionId(this.lastLayout, component),
      editableKind: DIRECT_EDIT_KIND_BY_ROLE[component.role] || null,
      semanticLabel: formatDirectComponentLabel(component),
      anchor: this.getComponentScreenAnchor(component.id),
      anchorClientX: Number.isFinite(pointerClientX) ? pointerClientX : null,
      anchorClientY: Number.isFinite(pointerClientY) ? pointerClientY : null,
      source
    });
  }

  resolveDirectHit(event) {
    if (!this.directEdit.enabled || !this.model?.children?.length) return null;
    const rect = this.root.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    this.directEditPointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    this.directEditRaycaster.setFromCamera(this.directEditPointer, this.camera);
    const intersections = this.directEditRaycaster
      .intersectObject(this.model, true)
      .filter((intersection) => (
        !intersection.object?.userData?.nonPhysicalHelper
        || intersection.object.userData.directEditHitProxy === true
      ));
    return resolveDirectEditIntersection(intersections, {
      root: this.model,
      getComponent: (componentId) => this.getDirectComponent(componentId),
      isEditable: (component) => DIRECT_EDITABLE_ROLES.has(component.role),
      isFallback: (component) => ["section", "back_panel", "assembly"].includes(component?.role)
    });
  }

  updateDirectEditHover(event) {
    if (!this.directEdit.enabled || event.pointerType === "touch") return;
    const component = this.resolveDirectHit(event);
    this.setDirectHoveredComponent(component?.id || null);
  }

  setDirectHoveredComponent(componentId) {
    const nextId = componentId && this.getDirectComponent(componentId) ? componentId : null;
    if (this.directEdit.hoveredComponentId === nextId) return;
    this.directEdit.hoveredComponentId = nextId;
    this.root.classList.toggle("has-direct-hover", Boolean(nextId));
    this.root.style.cursor = nextId ? "pointer" : "";
    this.refreshDirectHighlight();
    this.directEdit.onHover?.(nextId ? this.getDirectSelectionPayload(nextId, "hover") : null);
  }

  selectDirectComponentFromPointer(event) {
    const component = this.resolveDirectHit(event);
    if (!component) {
      this.clearDirectSelection({ notifySelect: true });
      return false;
    }
    if (component.role === "section" && this.sectionDesigner.active) {
      const sectionIndex = Number(component.metadata?.index);
      if (Number.isInteger(sectionIndex)) {
        this.setSectionSelection(sectionIndex);
        this.sectionDesigner.onSelect?.(sectionIndex);
      }
    }
    return this.selectDirectComponent(component.id, {
      source: event.pointerType === "touch" ? "touch" : "canvas",
      pointer: { clientX: event.clientX, clientY: event.clientY }
    });
  }

  selectDirectComponent(componentId, options = {}) {
    const payload = this.getDirectSelectionPayload(componentId, options.source || "api", options.pointer);
    if (!payload) return false;
    this.directEdit.selectedComponentId = componentId;
    this.root.classList.add("has-direct-selection");
    this.refreshDirectHighlight();
    this.notifyDirectAnchor();
    this.directEdit.onSelect?.(payload);
    return true;
  }

  setSelectedComponent(componentId) {
    if (!componentId) {
      this.clearDirectSelection();
      return false;
    }
    const component = this.getDirectComponent(componentId);
    if (!component || !DIRECT_EDITABLE_ROLES.has(component.role)) return false;
    this.directEdit.selectedComponentId = component.id;
    this.root.classList.add("has-direct-selection");
    this.refreshDirectHighlight();
    this.notifyDirectAnchor();
    return true;
  }

  clearDirectSelection(options = {}) {
    this.directEdit.hoveredComponentId = null;
    this.directEdit.selectedComponentId = null;
    this.root.classList.remove("has-direct-hover", "has-direct-selection");
    this.root.style.cursor = "";
    this.refreshDirectHighlight();
    this.directEdit.onHover?.(null);
    this.directEdit.onAnchorChange?.(null);
    if (options.notifySelect) this.directEdit.onSelect?.(null);
  }

  clearDirectHighlightGroup() {
    while (this.directHighlightGroup.children.length) {
      const child = this.directHighlightGroup.children.pop();
      disposeObject(child);
    }
  }

  refreshDirectHighlight() {
    if (!this.directHighlightGroup) return;
    this.clearDirectHighlightGroup();
    const selectedId = this.directEdit.selectedComponentId;
    const hoveredId = this.directEdit.hoveredComponentId;
    const componentId = selectedId || hoveredId;
    const component = componentId ? this.getDirectComponent(componentId) : null;
    if (!component || !this.lastLayout) {
      this.requestRender();
      return;
    }
    const box = descriptorBoundsToSceneBox(component.bounds, this.lastLayout.config.depth);
    const helper = new THREE.Box3Helper(box, selectedId ? 0xc8954d : 0xd6aa69);
    helper.material.transparent = true;
    helper.material.opacity = selectedId ? 0.96 : 0.68;
    helper.material.depthTest = false;
    helper.renderOrder = 100;
    helper.userData.nonPhysicalHelper = true;
    this.directHighlightGroup.add(helper);

    if (selectedId) {
      const anchor = getDescriptorSelectionAnchor(component);
      const sceneAnchor = descriptorPointToSceneVector(anchor, this.lastLayout.config.depth);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.045, 0.072, 28),
        new THREE.MeshBasicMaterial({
          color: 0xc8954d,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.95,
          depthTest: false
        })
      );
      ring.position.copy(sceneAnchor);
      ring.quaternion.copy(this.camera.quaternion);
      ring.renderOrder = 101;
      ring.userData.nonPhysicalHelper = true;
      this.directHighlightGroup.add(ring);
    }
    this.requestRender();
  }

  getComponentScreenAnchor(componentId) {
    const component = this.getDirectComponent(componentId);
    if (!component || !this.lastLayout) return null;
    const rect = this.root.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const anchor = descriptorPointToSceneVector(
      getDescriptorSelectionAnchor(component),
      this.lastLayout.config.depth
    );
    this.camera.updateMatrixWorld();
    const projected = anchor.clone().project(this.camera);
    return Object.freeze({
      componentId,
      x: (projected.x + 1) * rect.width / 2,
      y: (1 - projected.y) * rect.height / 2,
      visible: projected.z >= -1 && projected.z <= 1,
      viewportWidth: rect.width,
      viewportHeight: rect.height
    });
  }

  getMeasurementProjection(options = {}) {
    const root = this.getDirectComponent("bookcase")
      || this.lastLayout?.components?.find((component) => component.role === "assembly");
    if (!root || !this.lastLayout) return null;
    const rect = this.root.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const project = (point) => {
      const vector = descriptorPointToSceneVector(point, this.lastLayout.config.depth);
      this.camera.updateMatrixWorld();
      vector.project(this.camera);
      return {
        x: (vector.x + 1) * rect.width / 2,
        y: (1 - vector.y) * rect.height / 2,
        visible: vector.z >= -1 && vector.z <= 1
      };
    };
    const humanHeightIn = clamp(Number(options.humanHeightIn) || 72, 36, 96);
    const frontZ = Number(this.lastLayout.metrics?.referencePlanes?.finishedFrontPlaneZ ?? root.bounds.min.z);
    const dimensionX = root.bounds.min.x - Math.max(2, this.lastLayout.config.width * 0.025);
    const humanX = root.bounds.max.x + Math.max(8, this.lastLayout.config.width * 0.08);
    return Object.freeze({
      overall: Object.freeze({
        widthIn: this.lastLayout.config.width,
        heightIn: this.lastLayout.config.height,
        depthIn: this.lastLayout.config.depth
      }),
      heightLine: Object.freeze({
        start: project({ x: dimensionX, y: root.bounds.min.y, z: frontZ }),
        end: project({ x: dimensionX, y: root.bounds.max.y, z: frontZ })
      }),
      human: Object.freeze({
        heightIn: humanHeightIn,
        floor: project({ x: humanX, y: 0, z: frontZ }),
        head: project({ x: humanX, y: humanHeightIn, z: frontZ })
      }),
      viewportWidth: rect.width,
      viewportHeight: rect.height
    });
  }

  notifyDirectAnchor() {
    if (!this.directEdit.enabled || !this.directEdit.selectedComponentId) return;
    this.directEdit.onAnchorChange?.(
      this.getComponentScreenAnchor(this.directEdit.selectedComponentId)
    );
  }

  getModelGeneration() {
    return this.modelGeneration;
  }

  adoptCameraIntent(intent = {}) {
    if (Number.isInteger(intent.intentGeneration)) this.cameraIntentGeneration = intent.intentGeneration;
    if (typeof intent.profile === "string" && intent.profile) this.cameraIntentProfile = intent.profile;
    this.root.dataset.cameraIntentGeneration = String(this.cameraIntentGeneration);
    this.root.dataset.cameraModelGeneration = String(this.modelGeneration);
  }

  applyCameraIntent(command = {}) {
    if (
      !Number.isInteger(command.intentGeneration)
      || command.intentGeneration !== this.cameraIntentGeneration
      || command.modelGeneration !== this.modelGeneration
    ) return false;
    const options = {
      duration: command.duration,
      force: true,
      intentGeneration: command.intentGeneration,
      modelGeneration: command.modelGeneration,
      componentId: command.targetComponentId || null
    };
    if (command.targetKind === "model") {
      return this.fitFullModel({ ...options, profileKey: command.profile });
    }
    if (command.targetKind === "section") {
      return this.focusSection(command.sourceSectionIndex, options);
    }
    if (command.targetKind === "detail") {
      return this.focus(command.profile, options);
    }
    if (command.targetKind === "user") {
      return this.refitUserControlledCamera(options);
    }
    return false;
  }

  setView(view, options = {}) {
    let theta = -0.14;
    let phi = 0.12;
    if (view === "front" || view === "reset") {
      theta = 0;
      phi = 0.08;
    } else if (view === "side") {
      theta = Math.PI / 2;
      phi = 0.12;
    } else if (view === "three-quarter") {
      theta = -0.14;
      phi = 0.12;
    } else if (view === "three-dimensional") {
      theta = -0.42;
      phi = 0.2;
    }
    this.clearComponentHighlight();
    this.setProductLightingBoost(1);
    this.activeFocusKey = "overview";
    this.activeFocusVariant = "overview";
    this.focusRadius = this.baseRadius;
    this.root.dataset.cameraFocus = "overview";
    this.animateToCameraPose({
      theta,
      phi,
      radius: view === "reset" ? this.baseRadius : this.radius,
      target: this.overviewTarget,
      environmentScale: 1,
      exposure: 1.08
    }, {
      duration: options.duration ?? SMART_CAMERA_DURATION,
      intentGeneration: options.intentGeneration,
      modelGeneration: options.modelGeneration
    });
  }

  refitUserControlledCamera(options = {}) {
    if (!this.model?.children?.length) return false;
    const bounds = new THREE.Box3().setFromObject(this.model);
    if (bounds.isEmpty()) return false;
    const previousRatio = this.baseRadius > 0 && this.radius > 0
      ? clamp(this.radius / this.baseRadius, 0.82, 1.48)
      : 1;
    const calculated = calculateBoundsCameraPose({
      bounds: box3ToPlainBounds(bounds),
      theta: this.theta,
      phi: this.phi,
      verticalFovDegrees: this.camera.fov,
      aspect: this.camera.aspect,
      viewport: this.getSafeViewport(),
      fitMargin: 1.08
    });
    const target = new THREE.Vector3(calculated.target.x, calculated.target.y, calculated.target.z);
    const radius = this.resolveCollisionSafeRadius(
      calculated.theta,
      calculated.phi,
      target,
      calculated.radius * previousRatio
    );
    this.activeFocusKey = "user";
    this.activeFocusVariant = `user:${this.modelGeneration}`;
    this.focusRadius = radius;
    this.root.dataset.cameraFocus = "user";
    this.animateToCameraPose({
      theta: calculated.theta,
      phi: calculated.phi,
      radius,
      target,
      environmentScale: this.environmentLightScale,
      exposure: this.renderer.toneMappingExposure
    }, options);
    return true;
  }

  ensureModelComfortablyFramed() {
    if (!this.model?.children?.length) return false;
    this.camera.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(this.model);
    if (bounds.isEmpty()) return false;
    const rootRect = this.root.getBoundingClientRect();
    if (!rootRect.width || !rootRect.height) return false;
    const corners = [];
    for (const x of [bounds.min.x, bounds.max.x]) {
      for (const y of [bounds.min.y, bounds.max.y]) {
        for (const z of [bounds.min.z, bounds.max.z]) corners.push(new THREE.Vector3(x, y, z).project(this.camera));
      }
    }
    const envelope = corners.reduce((result, point) => ({
      left: Math.min(result.left, (point.x + 1) * rootRect.width / 2),
      right: Math.max(result.right, (point.x + 1) * rootRect.width / 2),
      top: Math.min(result.top, (1 - point.y) * rootRect.height / 2),
      bottom: Math.max(result.bottom, (1 - point.y) * rootRect.height / 2)
    }), { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity });
    const horizontalPadding = Math.max(24, rootRect.width * 0.045);
    const topPadding = Math.max(18, rootRect.height * 0.035);
    const bottomPadding = Math.max(66, rootRect.height * 0.12);
    const correctionNeeded = envelope.left < horizontalPadding
      || envelope.right > rootRect.width - horizontalPadding
      || envelope.top < topPadding
      || envelope.bottom > rootRect.height - bottomPadding;
    if (!correctionNeeded) return false;
    this.setView("reset");
    return true;
  }

  fitFullModel(options = {}) {
    if (!this.model?.children?.length) return false;
    const bounds = new THREE.Box3().setFromObject(this.model);
    if (bounds.isEmpty()) return false;
    const profileKey = ["finish", "preview", "lighting"].includes(options.profileKey) ? options.profileKey : "overview";
    const profile = profileKey === "finish"
      ? SMART_CAMERA_PROFILES.finish
      : profileKey === "lighting"
        ? { ...SMART_CAMERA_PROFILES.lighting, ...(LIGHTING_CAMERA_OVERRIDES[this.state.lighting] || {}) }
        : SMART_CAMERA_PROFILES.overview;
    const viewport = this.getSafeViewport();
    const calculated = calculateBoundsCameraPose({
      bounds: box3ToPlainBounds(bounds),
      theta: profile.theta,
      phi: profile.phi,
      verticalFovDegrees: this.camera.fov,
      aspect: this.camera.aspect,
      viewport,
      fitMargin: 1.12
    });
    let radius = calculated.radius;
    let targetData = calculated.target;
    for (let pass = 0; pass < 2; pass += 1) {
      const target = new THREE.Vector3(targetData.x, targetData.y, targetData.z);
      const collisionSafeRadius = this.resolveCollisionSafeRadius(
        calculated.theta,
        calculated.phi,
        target,
        radius
      );
      if (collisionSafeRadius <= radius + 0.0001) break;
      radius = collisionSafeRadius;
      targetData = calculateViewportAwareTarget({
        focusCenter: calculated.focusCenter,
        radius,
        theta: calculated.theta,
        phi: calculated.phi,
        verticalFovDegrees: this.camera.fov,
        aspect: this.camera.aspect,
        viewport: calculated.viewport
      });
    }
    const target = new THREE.Vector3(targetData.x, targetData.y, targetData.z);
    this.clearComponentHighlight();
    this.setProductLightingBoost(profileKey === "lighting" ? 2.35 : 1);
    this.activeFocusKey = profileKey;
    this.activeFocusVariant = `${profileKey}:${this.modelGeneration}`;
    this.focusRadius = radius;
    this.root.dataset.cameraFocus = profileKey;
    this.animateToCameraPose({
      theta: calculated.theta,
      phi: calculated.phi,
      radius,
      target,
      environmentScale: profile.environmentScale ?? 1,
      exposure: profile.exposure ?? 1.08
    }, {
      duration: options.duration ?? SMART_CAMERA_DURATION,
      intentGeneration: options.intentGeneration,
      modelGeneration: options.modelGeneration
    });
    return true;
  }

  focusSection(index, options = {}) {
    const sections = (this.lastLayout?.components || [])
      .filter((component) => component.role === "section")
      .sort((left, right) => Number(left.metadata?.index) - Number(right.metadata?.index));
    if (!sections.length) return false;
    const sectionIndex = clamp(Number(index) || 0, 0, sections.length - 1);
    const section = sections[sectionIndex];
    const focusVariant = `section:${section.metadata?.configId || section.id}`;
    if (!options.force && focusVariant === this.activeFocusVariant) return false;

    const bounds = new THREE.Box3().setFromObject(this.model);
    if (bounds.isEmpty()) return false;
    const viewport = this.getSafeViewport();
    const theta = options.preserveAngles ? this.theta : SMART_CAMERA_PROFILES.overview.theta;
    const phi = options.preserveAngles ? this.phi : SMART_CAMERA_PROFILES.overview.phi;
    const calculated = calculateBoundsCameraPose({
      bounds: box3ToPlainBounds(bounds),
      theta,
      phi,
      verticalFovDegrees: this.camera.fov,
      aspect: this.camera.aspect,
      viewport,
      fitMargin: 1.12
    });
    let radius = calculated.radius;
    let targetData = calculated.target;
    let target = new THREE.Vector3(targetData.x, targetData.y, targetData.z);
    const collisionSafeRadius = this.resolveCollisionSafeRadius(theta, phi, target, radius);
    if (collisionSafeRadius > radius + 0.0001) {
      radius = collisionSafeRadius;
      targetData = calculateViewportAwareTarget({
        focusCenter: calculated.focusCenter,
        radius,
        theta,
        phi,
        verticalFovDegrees: this.camera.fov,
        aspect: this.camera.aspect,
        viewport
      });
      target = new THREE.Vector3(targetData.x, targetData.y, targetData.z);
    }

    this.activeFocusKey = "section";
    this.activeFocusVariant = focusVariant;
    this.focusRadius = radius;
    this.sectionDesigner.selectedIndex = sectionIndex;
    this.root.dataset.cameraFocus = "section";
    this.root.dataset.cameraSection = String(sectionIndex + 1);
    this.setProductLightingBoost(1);
    this.animateToCameraPose({
      theta,
      phi,
      radius,
      target,
      environmentScale: 1,
      exposure: 1.08
    }, {
      duration: options.duration ?? SMART_CAMERA_DURATION,
      intentGeneration: options.intentGeneration,
      modelGeneration: options.modelGeneration
    });
    return true;
  }

  zoom(direction) {
    const scale = Number(direction) < 0 ? 0.9 : 1.1;
    const limits = this.getZoomLimits();
    const radius = clamp(this.radius * scale, limits.min, limits.max);
    this.onCameraInteraction("zoom");
    this.animateToCameraPose({
      theta: this.theta,
      phi: this.phi,
      radius,
      target: this.target,
      environmentScale: this.environmentLightScale,
      exposure: this.renderer.toneMappingExposure
    }, { duration: 360 });
  }

  getZoomLimits() {
    const detailFocus = this.activeFocusKey !== "overview" && Number.isFinite(this.focusRadius) && this.focusRadius > 0;
    const referenceRadius = detailFocus ? this.focusRadius : this.baseRadius;
    return {
      min: detailFocus ? Math.min(this.baseRadius * 0.58, referenceRadius * 0.62) : this.baseRadius * 0.58,
      max: Math.max(this.baseRadius * 1.58, referenceRadius * 2.25)
    };
  }

  getSafeViewport() {
    const rootRect = this.root.getBoundingClientRect();
    const width = Math.max(1, rootRect.width);
    const height = Math.max(1, rootRect.height);
    const insets = { top: 0, right: 0, bottom: 0, left: 0 };
    const container = this.root.closest(".configurator-model");
    if (container) {
      const overlays = container.querySelectorAll([
        ".configurator-experience-toolbar",
        ".workspace-model-toolbar",
        ".preview-heading > div",
        ".preview-control-dock",
        ":scope > .cabinet-ar-launch"
      ].join(","));
      overlays.forEach((overlay) => {
        const style = window.getComputedStyle(overlay);
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return;
        const rect = overlay.getBoundingClientRect();
        const intersection = {
          left: Math.max(rootRect.left, rect.left),
          right: Math.min(rootRect.right, rect.right),
          top: Math.max(rootRect.top, rect.top),
          bottom: Math.min(rootRect.bottom, rect.bottom)
        };
        const overlapWidth = intersection.right - intersection.left;
        const overlapHeight = intersection.bottom - intersection.top;
        if (overlapWidth <= 0 || overlapHeight <= 0) return;

        const edgeTolerance = Math.max(18, Math.min(width, height) * 0.04);
        const topOffset = intersection.top - rootRect.top;
        const touchesTop = topOffset <= Math.max(edgeTolerance, overlapHeight);
        const touchesRight = intersection.right >= rootRect.right - edgeTolerance;
        const touchesBottom = intersection.bottom >= rootRect.bottom - edgeTolerance;
        const touchesLeft = intersection.left <= rootRect.left + edgeTolerance;
        const horizontalOverlay = overlapWidth >= width * 0.32;
        const verticalOverlay = overlapHeight >= height * 0.16;
        const gap = Math.max(8, Math.min(width, height) * 0.018);

        if (touchesTop && overlapWidth >= Math.min(120, width * 0.16)) {
          insets.top = Math.max(insets.top, intersection.bottom - rootRect.top + gap);
        }
        if (touchesBottom && horizontalOverlay) {
          insets.bottom = Math.max(insets.bottom, rootRect.bottom - intersection.top + gap);
        }
        if (touchesRight && verticalOverlay && !horizontalOverlay) {
          insets.right = Math.max(insets.right, rootRect.right - intersection.left + gap);
        }
        if (touchesLeft && verticalOverlay && !horizontalOverlay) {
          insets.left = Math.max(insets.left, intersection.right - rootRect.left + gap);
        }
      });
    }
    const localBounds = Object.freeze({
      left: insets.left,
      top: insets.top,
      right: Math.max(insets.left, width - insets.right),
      bottom: Math.max(insets.top, height - insets.bottom),
      width: Math.max(0, width - insets.left - insets.right),
      height: Math.max(0, height - insets.top - insets.bottom)
    });
    const clientBounds = Object.freeze({
      left: rootRect.left + localBounds.left,
      top: rootRect.top + localBounds.top,
      right: rootRect.left + localBounds.right,
      bottom: rootRect.top + localBounds.bottom,
      width: localBounds.width,
      height: localBounds.height
    });
    return Object.freeze({
      width,
      height,
      insets: Object.freeze({ ...insets }),
      localBounds,
      clientBounds
    });
  }

  focus(profileKey = "overview", options = {}) {
    const normalizedKey = SMART_CAMERA_PROFILES[profileKey] ? profileKey : "overview";
    const focusVariant = normalizedKey === "lighting"
      ? `${normalizedKey}:${this.state.lighting}:${this.state.crownStyle}`
      : normalizedKey;
    const profile = SMART_CAMERA_PROFILES[normalizedKey];
    const pose = this.getFocusPose(normalizedKey, profile, options);
    if (!options.force && focusVariant === this.activeFocusVariant && this.cameraTransition) return;
    const alreadyAtPose = focusVariant === this.activeFocusVariant
      && this.target.distanceTo(pose.target) < 0.01
      && Math.abs(shortestAngleDelta(this.theta, pose.theta)) < 0.005
      && Math.abs(this.phi - pose.phi) < 0.005
      && Math.abs(this.radius - pose.radius) < 0.01;
    this.activeFocusKey = normalizedKey;
    this.activeFocusVariant = focusVariant;
    this.focusRadius = pose.radius;
    this.root.dataset.cameraFocus = normalizedKey;
    this.setProductLightingBoost(normalizedKey === "lighting" ? 2.35 : 1);
    this.applyComponentHighlight(pose.activeRoles);
    if (alreadyAtPose && !options.force) return;
    this.animateToCameraPose(pose, {
      duration: options.duration ?? SMART_CAMERA_DURATION,
      intentGeneration: options.intentGeneration,
      modelGeneration: options.modelGeneration
    });
    return true;
  }

  getFocusPose(profileKey, profile, options = {}) {
    const resolvedProfile = profileKey === "lighting"
      ? { ...profile, ...(LIGHTING_CAMERA_OVERRIDES[this.state.lighting] || {}) }
      : profile;
    const viewport = this.getSafeViewport();
    const viewportKey = [
      viewport.width,
      viewport.height,
      viewport.insets.top,
      viewport.insets.right,
      viewport.insets.bottom,
      viewport.insets.left
    ].map((value) => Math.round(value)).join("x");
    const cacheKey = `${profileKey}:${options.componentId || "profile"}:${profileKey === "lighting" ? `${this.state.lighting}:${this.state.crownStyle}` : "default"}:${this.modelGeneration}:${Number(this.camera.aspect || 1).toFixed(3)}:${viewportKey}`;
    const cached = this.focusTargetCache.get(cacheKey);
    if (cached) {
      return {
        ...cached,
        target: cached.target.clone(),
        activeRoles: [...cached.activeRoles]
      };
    }

    const result = this.getFocusBounds(resolvedProfile, options);
    if (isProfileCameraKey(resolvedProfile.profileDetail)) {
      const modelBounds = new THREE.Box3().setFromObject(this.model);
      const calculated = calculateProfileCameraPose({
        kind: resolvedProfile.profileDetail,
        modelBounds: box3ToPlainBounds(modelBounds),
        featureBounds: box3ToPlainBounds(result.bounds),
        verticalFovDegrees: this.camera.fov,
        aspect: this.camera.aspect,
        viewport
      });
      let radius = calculated.radius;
      let targetData = calculated.target;
      for (let pass = 0; pass < 2; pass += 1) {
        const target = new THREE.Vector3(targetData.x, targetData.y, targetData.z);
        const collisionSafeRadius = this.resolveCollisionSafeRadius(
          calculated.theta,
          calculated.phi,
          target,
          radius
        );
        if (collisionSafeRadius <= radius + 0.0001) break;
        radius = collisionSafeRadius;
        targetData = calculateViewportAwareTarget({
          focusCenter: calculated.focusCenter,
          radius,
          theta: calculated.theta,
          phi: calculated.phi,
          verticalFovDegrees: this.camera.fov,
          aspect: this.camera.aspect,
          viewport: calculated.viewport
        });
      }
      const pose = {
        theta: calculated.theta,
        phi: calculated.phi,
        radius,
        target: new THREE.Vector3(targetData.x, targetData.y, targetData.z),
        activeRoles: result.activeRoles,
        environmentScale: resolvedProfile.environmentScale ?? 1,
        exposure: resolvedProfile.exposure ?? 1.08
      };
      this.focusTargetCache.set(cacheKey, {
        ...pose,
        target: pose.target.clone(),
        activeRoles: [...pose.activeRoles]
      });
      return pose;
    }
    const bounds = result.bounds.clone();
    if (Number.isFinite(resolvedProfile.boundsWidthScale)) {
      const boundsCenter = bounds.getCenter(new THREE.Vector3());
      const width = Math.max(bounds.max.x - bounds.min.x, 0.1);
      const halfDetailWidth = width * clamp(resolvedProfile.boundsWidthScale, 0.1, 1) * 0.5;
      bounds.min.x = boundsCenter.x - halfDetailWidth;
      bounds.max.x = boundsCenter.x + halfDetailWidth;
    }
    if (Number.isFinite(resolvedProfile.boundsHeightScale)) {
      const boundsCenter = bounds.getCenter(new THREE.Vector3());
      const height = Math.max(bounds.max.y - bounds.min.y, 0.1);
      const halfDetailHeight = height * clamp(resolvedProfile.boundsHeightScale, 0.1, 1) * 0.5;
      bounds.min.y = boundsCenter.y - halfDetailHeight;
      bounds.max.y = boundsCenter.y + halfDetailHeight;
    }
    const focusCenter = bounds.getCenter(new THREE.Vector3());
    const modelSize = new THREE.Box3().setFromObject(this.model).getSize(new THREE.Vector3());
    focusCenter.y += modelSize.y * (resolvedProfile.targetModelYOffset || 0);
    focusCenter.z += modelSize.z * (resolvedProfile.targetModelZOffset || 0);
    const shiftedBounds = bounds.clone();
    const centerDelta = focusCenter.clone().sub(bounds.getCenter(new THREE.Vector3()));
    shiftedBounds.translate(centerDelta);
    const calculated = calculateBoundsCameraPose({
      bounds: box3ToPlainBounds(shiftedBounds),
      theta: resolvedProfile.theta,
      phi: resolvedProfile.phi,
      verticalFovDegrees: this.camera.fov,
      aspect: this.camera.aspect,
      viewport,
      fitMargin: 1.14
    });
    const desiredRadius = Math.max(this.baseRadius * resolvedProfile.radiusScale, calculated.radius);
    const target = new THREE.Vector3(calculated.target.x, calculated.target.y, calculated.target.z);
    const radius = this.resolveCollisionSafeRadius(resolvedProfile.theta, resolvedProfile.phi, target, desiredRadius);
    const pose = {
      theta: resolvedProfile.theta,
      phi: resolvedProfile.phi,
      radius: clamp(radius, this.baseRadius * 0.4, this.baseRadius * 1.55),
      target,
      activeRoles: result.activeRoles,
      environmentScale: resolvedProfile.environmentScale ?? 1,
      exposure: resolvedProfile.exposure ?? 1.08
    };
    this.focusTargetCache.set(cacheKey, {
      ...pose,
      target: pose.target.clone(),
      activeRoles: [...pose.activeRoles]
    });
    return pose;
  }

  getFocusBounds(profile, options = {}) {
    const modelBounds = new THREE.Box3().setFromObject(this.model);
    const modelCenter = modelBounds.getCenter(new THREE.Vector3());
    const modelSize = modelBounds.getSize(new THREE.Vector3());
    if (options.componentId) {
      let componentBounds = null;
      this.model.updateMatrixWorld(true);
      this.model.traverse((child) => {
        if (componentBounds || child.userData?.componentId !== options.componentId) return;
        const bounds = new THREE.Box3().setFromObject(child);
        if (!bounds.isEmpty()) componentBounds = bounds;
      });
      if (componentBounds) {
        const component = this.lastLayout?.components?.find((item) => item.id === options.componentId);
        return { bounds: componentBounds, activeRoles: component?.role ? [component.role] : [] };
      }
    }
    const requestedRoles = profile.roles || [];
    if (!requestedRoles.length) return { bounds: modelBounds, activeRoles: [] };

    const collect = (roles) => {
      const candidates = [];
      this.model.updateMatrixWorld(true);
      this.model.traverse((child) => {
        if (!child.userData?.componentId || !roles.includes(child.userData.role)) return;
        const bounds = new THREE.Box3().setFromObject(child);
        if (!bounds.isEmpty()) candidates.push({ child, bounds, center: bounds.getCenter(new THREE.Vector3()) });
      });
      if (profile.selection === "center") candidates.sort((a, b) => Math.abs(a.center.x) - Math.abs(b.center.x));
      if (profile.selection === "centerInterior") {
        const score = (candidate) => (
          Math.abs(candidate.center.x - modelCenter.x) / Math.max(modelSize.x, 0.1)
          + Math.abs(candidate.center.y - modelCenter.y) / Math.max(modelSize.y, 0.1) * 0.6
        );
        candidates.sort((a, b) => score(a) - score(b));
      }
      if (profile.selection === "leftmost") candidates.sort((a, b) => a.center.x - b.center.x);
      return profile.limit ? candidates.slice(0, profile.limit) : candidates;
    };

    let activeRoles = requestedRoles;
    let candidates = collect(requestedRoles);
    if (!candidates.length && profile.fallbackRoles?.length) {
      activeRoles = profile.fallbackRoles;
      candidates = collect(activeRoles);
    }
    if (!candidates.length && profile.fallbackRegion) {
      const bounds = modelBounds.clone();
      const height = Math.max(bounds.max.y - bounds.min.y, 0.1);
      if (profile.fallbackRegion === "top") bounds.min.y = bounds.max.y - height * 0.18;
      if (profile.fallbackRegion === "bottom") bounds.max.y = bounds.min.y + height * 0.18;
      return { bounds, activeRoles: [] };
    }
    if (!candidates.length) return { bounds: modelBounds, activeRoles: [] };
    const bounds = new THREE.Box3();
    candidates.forEach((candidate) => bounds.union(candidate.bounds));
    return { bounds, activeRoles };
  }

  resolveCollisionSafeRadius(theta, phi, target, desiredRadius) {
    const modelBounds = new THREE.Box3().setFromObject(this.model);
    const direction = new THREE.Vector3(
      Math.sin(theta) * Math.cos(phi),
      Math.sin(phi),
      Math.cos(theta) * Math.cos(phi)
    ).normalize();
    const intersection = new THREE.Ray(target.clone(), direction).intersectBox(modelBounds, new THREE.Vector3());
    if (!intersection) return desiredRadius;
    const modelSize = modelBounds.getSize(new THREE.Vector3());
    const clearance = Math.max(0.32, modelSize.z * 0.24);
    return Math.max(desiredRadius, target.distanceTo(intersection) + clearance);
  }

  animateToCameraPose(pose, options = {}) {
    const intentGeneration = Number.isInteger(options.intentGeneration)
      ? options.intentGeneration
      : this.cameraIntentGeneration;
    const modelGeneration = Number.isInteger(options.modelGeneration)
      ? options.modelGeneration
      : this.modelGeneration;
    if (intentGeneration !== this.cameraIntentGeneration || modelGeneration !== this.modelGeneration) return false;
    const endTheta = this.theta + shortestAngleDelta(this.theta, pose.theta);
    const requestedDuration = Number(options.duration ?? SMART_CAMERA_DURATION);
    const duration = resolveCameraTransitionDuration(requestedDuration, this.reducedMotionQuery?.matches);
    if (duration === 0) {
      if (this.cameraTransition) this.cameraTransitionCancellationCount += 1;
      this.cameraTransition = null;
      this.applyCameraPose({ ...pose, theta: endTheta });
      this.onCameraInteraction("focus-complete", { intentGeneration, modelGeneration });
      return true;
    }
    if (this.cameraTransition) this.cameraTransitionCancellationCount += 1;
    this.cameraTransition = {
      sequence: ++this.cameraTransitionSequence,
      intentGeneration,
      modelGeneration,
      startedAt: performance.now(),
      duration,
      startTheta: this.theta,
      endTheta,
      startPhi: this.phi,
      endPhi: pose.phi,
      startRadius: this.radius,
      endRadius: pose.radius,
      startTarget: this.target.clone(),
      endTarget: pose.target.clone(),
      startEnvironmentScale: this.environmentLightScale,
      endEnvironmentScale: pose.environmentScale ?? 1,
      startExposure: this.renderer.toneMappingExposure,
      endExposure: pose.exposure ?? 1.08
    };
    this.requestRender();
    return true;
  }

  applyCameraPose(pose) {
    this.theta = pose.theta;
    this.phi = pose.phi;
    this.radius = pose.radius;
    this.target.copy(pose.target);
    this.environmentLightScale = pose.environmentScale ?? 1;
    this.renderer.toneMappingExposure = pose.exposure ?? 1.08;
    this.environmentLights.forEach((light) => {
      light.intensity = (light.userData.smartFocusBaseIntensity || 0) * this.environmentLightScale;
    });
    this.updateCamera();
  }

  updateCameraTransition(now) {
    const transition = this.cameraTransition;
    if (!transition) return;
    if (
      transition.intentGeneration !== this.cameraIntentGeneration
      || transition.modelGeneration !== this.modelGeneration
    ) {
      this.cancelCameraTransition();
      return;
    }
    const progress = clamp((now - transition.startedAt) / transition.duration, 0, 1);
    const eased = easeInOutCubic(progress);
    this.theta = THREE.MathUtils.lerp(transition.startTheta, transition.endTheta, eased);
    this.phi = THREE.MathUtils.lerp(transition.startPhi, transition.endPhi, eased);
    this.radius = THREE.MathUtils.lerp(transition.startRadius, transition.endRadius, eased);
    this.target.lerpVectors(transition.startTarget, transition.endTarget, eased);
    this.environmentLightScale = THREE.MathUtils.lerp(transition.startEnvironmentScale, transition.endEnvironmentScale, eased);
    this.renderer.toneMappingExposure = THREE.MathUtils.lerp(transition.startExposure, transition.endExposure, eased);
    this.environmentLights.forEach((light) => {
      light.intensity = (light.userData.smartFocusBaseIntensity || 0) * this.environmentLightScale;
    });
    this.updateCamera();
    if (progress >= 1) {
      this.cameraTransition = null;
      this.onCameraInteraction("focus-complete", {
        intentGeneration: transition.intentGeneration,
        modelGeneration: transition.modelGeneration
      });
    }
  }

  cancelCameraTransition() {
    if (this.cameraTransition) this.cameraTransitionCancellationCount += 1;
    this.cameraTransition = null;
  }

  setEnvironmentLightScale(scale = 1) {
    this.environmentLightScale = Number.isFinite(scale) ? scale : 1;
    this.environmentLights.forEach((light) => {
      light.intensity = (light.userData.smartFocusBaseIntensity || 0) * this.environmentLightScale;
    });
    this.requestRender();
  }

  applyComponentHighlight(roles = []) {
    this.clearComponentHighlight();
    if (!roles.length) return;
    const selectedObjects = new Set();
    this.model.traverse((child) => {
      if (!child.userData?.componentId || !roles.includes(child.userData.role)) return;
      child.traverse((descendant) => {
        if (descendant.material) selectedObjects.add(descendant);
      });
    });
    if (!selectedObjects.size) return;

    const materialSnapshots = new Map();
    const selectedMaterials = new Map();
    const clonedMaterials = new Set();
    this.model.traverse((child) => {
      const materials = Array.isArray(child.material) ? child.material : child.material ? [child.material] : [];
      materials.forEach((material) => {
        if (!materialSnapshots.has(material)) {
          materialSnapshots.set(material, {
            color: material.color?.clone(),
            opacity: material.opacity,
            emissive: material.emissive?.clone(),
            emissiveIntensity: material.emissiveIntensity
          });
        }
      });
      if (!selectedObjects.has(child) || !child.material) return;
      selectedMaterials.set(child, child.material);
      const cloneMaterial = (material) => {
        const clone = material.clone();
        clonedMaterials.add(clone);
        return clone;
      };
      child.material = Array.isArray(child.material)
        ? child.material.map(cloneMaterial)
        : cloneMaterial(child.material);
    });

    materialSnapshots.forEach((snapshot, material) => {
      material.color?.multiplyScalar(0.93);
      if (material.transparent) material.opacity = snapshot.opacity * 0.96;
      material.needsUpdate = true;
    });
    this.highlightState = { materialSnapshots, selectedMaterials, clonedMaterials };
    this.requestRender();
  }

  clearComponentHighlight() {
    const state = this.highlightState;
    if (!state) return;
    state.selectedMaterials.forEach((material, object) => {
      object.material = material;
    });
    state.materialSnapshots.forEach((snapshot, material) => {
      if (snapshot.color) material.color?.copy(snapshot.color);
      if (snapshot.emissive) material.emissive?.copy(snapshot.emissive);
      if (typeof snapshot.opacity === "number") material.opacity = snapshot.opacity;
      if (typeof snapshot.emissiveIntensity === "number") material.emissiveIntensity = snapshot.emissiveIntensity;
      material.needsUpdate = true;
    });
    state.clonedMaterials.forEach((material) => material.dispose());
    this.highlightState = null;
    this.requestRender();
  }

  setProductLightingBoost(scale = 1) {
    const environment = new Set(this.environmentLights);
    this.model?.traverse((child) => {
      if (!child.isLight || environment.has(child) || !child.userData?.productLight) return;
      if (!Number.isFinite(child.userData.smartFocusBaseIntensity)) child.userData.smartFocusBaseIntensity = child.intensity;
      child.intensity = child.userData.smartFocusBaseIntensity * scale;
    });
    this.requestRender();
  }

  refreshComponentHighlight() {
    if (this.activeFocusKey === "section") return;
    const profile = SMART_CAMERA_PROFILES[this.activeFocusKey] || SMART_CAMERA_PROFILES.overview;
    const pose = this.getFocusPose(this.activeFocusKey, profile);
    this.applyComponentHighlight(pose.activeRoles);
  }

  setSectionDesigner(options = {}) {
    this.sectionDesigner.active = Boolean(options.active);
    if (Number.isInteger(options.selectedIndex)) this.sectionDesigner.selectedIndex = options.selectedIndex;
    if (typeof options.onSelect === "function") this.sectionDesigner.onSelect = options.onSelect;
    if (options.layout) this.sectionDesigner.layout = options.layout;
    if (!this.sectionDesigner.active) {
      const canonical = this.sectionPreviewCanonical;
      this.pendingSectionPreview = null;
      this.pendingSectionPreviewRestore = null;
      if (canonical && this.sectionPreviewRendered) {
        this.applyingSectionPreview = true;
        this.previewActive = false;
        try {
          this.update(canonical.state, canonical.layout, getChangedConfigFields(this.state, canonical.state));
        } finally {
          this.applyingSectionPreview = false;
        }
      }
      this.clearSectionInteractionLayer();
      this.sectionOverlay.hidden = true;
      this.sectionOverlay.innerHTML = "";
      this.sectionDesigner.measurement = null;
      this.sectionDesigner.overlaySignature = "";
      this.sectionPreviewCanonical = null;
      this.sectionPreviewRendered = false;
      return;
    }
    this.refreshSectionInteractionLayer(this.sectionDesigner.layout || this.lastLayout);
  }

  setSectionSelection(index) {
    const sectionCount = (this.sectionDesigner.layout || this.lastLayout)?.components
      ?.filter((component) => component.role === "section").length || 0;
    this.sectionDesigner.selectedIndex = clamp(Number(index) || 0, 0, Math.max(0, sectionCount - 1));
    this.sectionInteractionLayer.children.forEach((mesh) => {
      const selected = mesh.userData.sectionIndex === this.sectionDesigner.selectedIndex;
      mesh.material.opacity = selected ? 0.08 : 0.008;
      mesh.material.color.setHex(selected ? 0xb88a52 : 0xd8c4a8);
    });
    this.updateSectionOverlaySelection();
    this.requestRender();
  }

  refreshSectionInteractionLayer(layout) {
    this.clearSectionInteractionLayer();
    if (!this.sectionDesigner.active || !layout) return;
    if (!this.applyingSectionPreview || !this.sectionPreviewCanonical) {
      this.sectionDesigner.layout = layout;
    }
    const sections = layout.components
      .filter((component) => component.role === "section")
      .sort((left, right) => Number(left.metadata?.index) - Number(right.metadata?.index));
    for (const section of sections) {
      const size = [inchesToUnits(section.size.x), inchesToUnits(section.size.y), inchesToUnits(section.size.z)];
      const material = new THREE.MeshBasicMaterial({
        color: section.metadata.index === this.sectionDesigner.selectedIndex ? 0xb88a52 : 0xd8c4a8,
        transparent: true,
        opacity: section.metadata.index === this.sectionDesigner.selectedIndex ? 0.08 : 0.008,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
      mesh.position.set(
        inchesToUnits(section.position.x),
        inchesToUnits(section.position.y),
        inchesToUnits(layout.config.depth) / 2 - inchesToUnits(section.position.z)
      );
      mesh.renderOrder = 100;
      mesh.userData = { nonPhysicalHelper: true, sectionIndex: section.metadata.index, sectionId: section.id };
      this.sectionInteractionLayer.add(mesh);
    }
    this.renderSectionOverlay(layout);
    this.requestRender();
  }

  clearSectionInteractionLayer() {
    let removed = false;
    while (this.sectionInteractionLayer.children.length) {
      const child = this.sectionInteractionLayer.children[this.sectionInteractionLayer.children.length - 1];
      this.sectionInteractionLayer.remove(child);
      child.geometry?.dispose();
      child.material?.dispose();
      removed = true;
    }
    if (removed) this.requestRender();
  }

  renderSectionOverlay(layout, previewWidths = null) {
    if (!this.sectionDesigner.active || !layout) return;
    const sections = layout.components
      .filter((component) => component.role === "section")
      .sort((left, right) => Number(left.metadata?.index) - Number(right.metadata?.index));
    const root = layout.components.find((component) => component.id === "bookcase");
    if (!root || !sections.length) return;
    const widths = (previewWidths || layout.metrics.sectionClearWidths || sections.map((section) => section.size.x))
      .map((width) => Number(width));
    const signature = sections.map((section) => section.id).join("|");
    if (signature !== this.sectionDesigner.overlaySignature) {
      const labels = sections.map((section, index) => `
        <span class="section-dimension" data-overlay-section="${index}">
          <i class="dimension-line" aria-hidden="true"></i>
          <i class="dimension-tick is-start" aria-hidden="true"></i>
          <i class="dimension-tick is-end" aria-hidden="true"></i>
          <button type="button" class="dimension-label" data-overlay-section-select="${index}" aria-label="Select Section ${index + 1}"><strong data-section-dimension-value></strong><small>clear</small></button>
        </span>
      `).join("");
      const handles = sections.slice(0, -1).map((section, index) => `
        <button type="button" class="section-divider-handle" data-section-divider="${index}" aria-label="Resize divider between Sections ${index + 1} and ${index + 2}">
          <span class="section-divider-guide" aria-hidden="true"></span>
          <i class="section-divider-grip" aria-hidden="true"></i>
        </button>
      `).join("");
      this.sectionOverlay.innerHTML = `
        <div class="section-dimension-track">${labels}</div>
        <div class="overall-dimension" aria-hidden="true">
          <i class="dimension-line" aria-hidden="true"></i>
          <i class="dimension-tick is-start" aria-hidden="true"></i>
          <i class="dimension-tick is-end" aria-hidden="true"></i>
          <span class="dimension-label"><strong data-overall-dimension-value></strong><small>overall</small></span>
        </div>
        <div class="overall-height-dimension" aria-hidden="true">
          <i class="dimension-line" aria-hidden="true"></i>
          <i class="dimension-tick is-start" aria-hidden="true"></i>
          <i class="dimension-tick is-end" aria-hidden="true"></i>
          <span class="dimension-label"><strong data-overall-height-value></strong><small>height</small></span>
        </div>
        <div class="overall-depth-dimension" aria-hidden="true">
          <i class="dimension-line" aria-hidden="true"></i>
          <span class="dimension-label"><strong data-overall-depth-value></strong><small>depth</small></span>
        </div>
        <div class="section-divider-layer">${handles}</div>
      `;
      this.sectionDesigner.overlaySignature = signature;
    }

    const measurementBounds = createSectionMeasurementBounds(layout, sections, widths);
    this.sectionDesigner.measurement = { layout, root, sections, widths, bounds: measurementBounds };
    this.sectionOverlay.querySelectorAll("[data-overlay-section]").forEach((label, index) => {
      const value = label.querySelector("[data-section-dimension-value]");
      if (value) value.textContent = `${formatSectionWidth(widths[index])} in`;
    });
    const overallValue = this.sectionOverlay.querySelector("[data-overall-dimension-value]");
    if (overallValue) overallValue.textContent = `${formatSectionWidth(layout.metrics.overallWidth)} in`;
    const overallHeightValue = this.sectionOverlay.querySelector("[data-overall-height-value]");
    if (overallHeightValue) overallHeightValue.textContent = `${formatSectionWidth(layout.config.height)} in`;
    const overallDepthValue = this.sectionOverlay.querySelector("[data-overall-depth-value]");
    if (overallDepthValue) overallDepthValue.textContent = `${formatSectionWidth(layout.config.depth)} in`;
    this.sectionOverlay.hidden = !this.dimensionsVisible;
    this.updateSectionOverlaySelection();
    this.updateSectionOverlayProjection();
  }

  previewSectionDivider(dividerIndex, delta, result = null) {
    if (!this.sectionDesigner.active) return;
    if (result?.accepted) {
      const canonicalLayout = this.sectionPreviewCanonical?.layout || this.sectionDesigner.layout || this.lastLayout;
      if (!this.sectionPreviewCanonical) {
        this.sectionPreviewCanonical = {
          state: normalizeBookcaseConfig(this.state),
          layout: canonicalLayout
        };
      }
      this.renderSectionOverlay(canonicalLayout, result.widths);
      this.pendingSectionPreview = { widths: result.widths.slice() };
      this.pendingSectionPreviewRestore = null;
      this.requestRender();
    }
    const handle = this.sectionOverlay.querySelector(`[data-section-divider="${dividerIndex}"]`);
    if (handle) {
      const appliedDelta = Number(result?.appliedDelta ?? delta);
      handle.dataset.previewDelta = `${appliedDelta > 0 ? "+" : ""}${formatSectionWidth(appliedDelta)} in`;
      handle.classList.toggle("is-invalid", result?.accepted === false);
      handle.classList.toggle("is-clamped", Boolean(result?.clamped));
    }
  }

  clearSectionDividerPreview() {
    this.pendingSectionPreview = null;
    this.sectionOverlay.querySelectorAll("[data-section-divider]").forEach((handle) => {
      delete handle.dataset.previewDelta;
      handle.classList.remove("is-invalid", "is-clamped");
    });
    if (!this.sectionPreviewCanonical) {
      this.renderSectionOverlay(this.sectionDesigner.layout || this.lastLayout);
      return;
    }
    const canonical = this.sectionPreviewCanonical;
    this.renderSectionOverlay(canonical.layout);
    if (this.sectionPreviewRendered) {
      this.pendingSectionPreviewRestore = canonical;
      this.requestRender();
    } else {
      this.sectionPreviewCanonical = null;
    }
  }

  updateSectionOverlaySelection() {
    const selectedIndex = this.sectionDesigner.selectedIndex;
    this.sectionOverlay.querySelectorAll("[data-overlay-section]").forEach((label) => {
      label.classList.toggle("is-selected", Number(label.dataset.overlaySection) === selectedIndex);
    });
    this.sectionOverlay.querySelectorAll("[data-section-divider]").forEach((handle) => {
      const index = Number(handle.dataset.sectionDivider);
      handle.classList.toggle("is-selected", index === selectedIndex || index + 1 === selectedIndex);
    });
  }

  updateSectionOverlayProjection() {
    const measurement = this.sectionDesigner.measurement;
    if (!this.sectionDesigner.active || this.sectionOverlay.hidden || !measurement?.root || !measurement.bounds?.length) return;
    const rootRect = this.root.getBoundingClientRect();
    if (!rootRect.width || !rootRect.height) return;

    this.camera.updateMatrixWorld(true);
    const { layout, root, bounds, widths } = measurement;
    const frontZ = Number(root.bounds.min.z) || 0;
    const baseY = Number(root.bounds.min.y) || 0;
    const topY = Number(root.bounds.max.y) || Number(layout.config.height) || 0;
    const outsideLeftPoint = this.projectLayoutPoint(layout, root.bounds.min.x, baseY, frontZ, rootRect);
    const outsideRightPoint = this.projectLayoutPoint(layout, root.bounds.max.x, baseY, frontZ, rootRect);
    const outsideTopLeftPoint = this.projectLayoutPoint(layout, root.bounds.min.x, topY, frontZ, rootRect);
    const outsideTopRightPoint = this.projectLayoutPoint(layout, root.bounds.max.x, topY, frontZ, rootRect);
    const outsideLeft = Math.min(outsideLeftPoint.x, outsideRightPoint.x);
    const outsideRight = Math.max(outsideLeftPoint.x, outsideRightPoint.x);
    const projectedWidth = Math.max(1, outsideRight - outsideLeft);
    const safeViewport = this.getSafeViewport();
    const desiredSectionY = Math.max(outsideLeftPoint.y, outsideRightPoint.y) + 20;
    const safeTop = Number(safeViewport.localBounds?.top ?? safeViewport.insets.top) || 0;
    const overallY = Math.max(safeTop + 8, Math.min(outsideTopLeftPoint.y, outsideTopRightPoint.y) - 38);
    const maximumSectionY = rootRect.height - Math.max(24, safeViewport.insets.bottom || 0) - 34;
    const verticalShift = Math.min(0, maximumSectionY - desiredSectionY);
    const sectionY = desiredSectionY + verticalShift;
    const frontality = Math.abs(Math.cos(this.theta));
    const enoughProjectedWidth = projectedWidth >= Math.max(150, rootRect.width * 0.24);
    const hasMeasurementRoom = sectionY >= Math.max(outsideLeftPoint.y, outsideRightPoint.y) + 8;
    const legible = frontality >= 0.68 && enoughProjectedWidth;

    this.sectionOverlay.style.left = `${outsideLeft}px`;
    this.sectionOverlay.style.width = `${projectedWidth}px`;
    this.sectionOverlay.style.top = "0px";
    this.sectionOverlay.style.right = "auto";
    this.sectionOverlay.style.bottom = "0px";
    this.sectionOverlay.classList.toggle("is-perspective-faded", !legible);
    this.sectionOverlay.classList.toggle("is-space-constrained", !hasMeasurementRoom);
    this.sectionOverlay.dataset.measurementLegible = String(legible);

    const projectedSegments = [];
    bounds.forEach((sectionBounds, index) => {
      const start = this.projectLayoutPoint(layout, sectionBounds.minX, baseY, frontZ, rootRect);
      const end = this.projectLayoutPoint(layout, sectionBounds.maxX, baseY, frontZ, rootRect);
      const left = Math.min(start.x, end.x) - outsideLeft;
      const width = Math.max(1, Math.abs(end.x - start.x));
      const segment = this.sectionOverlay.querySelector(`[data-overlay-section="${index}"]`);
      if (!segment) return;
      segment.style.left = `${left}px`;
      segment.style.top = `${sectionY}px`;
      segment.style.width = `${width}px`;
      segment.classList.toggle("is-compact-label", width < (rootRect.width <= 480 ? 54 : 66));
      segment.classList.toggle("is-ultra-compact-label", width < 44);
      const value = segment.querySelector("[data-section-dimension-value]");
      if (value) {
        const compactMobileValue = rootRect.width <= 480 && bounds.length >= 5;
        value.textContent = compactMobileValue
          ? `${Number(Number(widths[index]).toFixed(1))}\u2033`
          : `${formatSectionWidth(widths[index])} in`;
      }
      projectedSegments.push(segment);
    });

    const measureLabelOverlap = () => projectedSegments.some((segment, index) => {
      const next = projectedSegments[index + 1];
      if (!next) return false;
      const currentLabel = segment.querySelector(".dimension-label")?.getBoundingClientRect();
      const nextLabel = next.querySelector(".dimension-label")?.getBoundingClientRect();
      return Boolean(currentLabel && nextLabel && currentLabel.right > nextLabel.left + 0.5);
    });
    this.sectionOverlay.classList.remove("has-label-collisions", "has-unresolved-label-collisions");
    void this.sectionOverlay.offsetWidth;
    const needsLabelCompaction = measureLabelOverlap();
    this.sectionOverlay.classList.toggle("has-label-collisions", needsLabelCompaction);
    if (needsLabelCompaction) {
      projectedSegments.forEach((segment, index) => {
        const value = segment.querySelector("[data-section-dimension-value]");
        if (value) value.textContent = `${Number(Number(widths[index]).toFixed(1))}\u2033`;
      });
      void this.sectionOverlay.offsetWidth;
    }
    const labelsOverlap = measureLabelOverlap();
    this.sectionOverlay.classList.toggle("has-unresolved-label-collisions", labelsOverlap);
    this.sectionOverlay.dataset.labelCollision = String(labelsOverlap);

    const overall = this.sectionOverlay.querySelector(".overall-dimension");
    if (overall) {
      overall.style.left = "0px";
      overall.style.top = `${overallY}px`;
      overall.style.width = `${projectedWidth}px`;
    }

    this.sectionOverlay.querySelectorAll("[data-section-divider]").forEach((handle) => {
      const dividerIndex = Number(handle.dataset.sectionDivider);
      const dividerX = bounds[dividerIndex]?.maxX + Number(layout.rules?.panelThickness || 0) / 2;
      const bottom = this.projectLayoutPoint(layout, dividerX, baseY, frontZ, rootRect);
      const top = this.projectLayoutPoint(layout, dividerX, topY, frontZ, rootRect);
      const handleTop = Math.min(top.y, sectionY - 14);
      const handleHeight = Math.max(72, sectionY - handleTop + 14);
      handle.style.left = `${bottom.x - outsideLeft}px`;
      handle.style.top = `${handleTop}px`;
      handle.style.height = `${handleHeight}px`;
      handle.disabled = !legible;
      handle.setAttribute("aria-disabled", String(!legible));
    });
  }

  projectLayoutPoint(layout, x, y, z, rootRect) {
    const point = new THREE.Vector3(
      inchesToUnits(x),
      inchesToUnits(y),
      inchesToUnits(layout.config.depth) / 2 - inchesToUnits(z)
    ).project(this.camera);
    return {
      x: (point.x + 1) * rootRect.width / 2,
      y: (1 - point.y) * rootRect.height / 2,
      depth: point.z
    };
  }

  applyPendingSectionPreview(now) {
    if (this.pendingSectionPreview) {
      if (now - this.sectionPreviewLastAppliedAt < 32) return;
      const pending = this.pendingSectionPreview;
      const canonical = this.sectionPreviewCanonical;
      this.pendingSectionPreview = null;
      if (!canonical) return;
      const previewState = normalizeBookcaseConfig({
        ...canonical.state,
        layoutMetadata: {
          ...canonical.state.layoutMetadata,
          sectionRatios: sectionWidthsToStableRatios(pending.widths)
        }
      });
      const previewLayout = generateBookcaseLayout(previewState);
      if (!previewLayout.validation?.valid) return;
      this.applyingSectionPreview = true;
      this.previewActive = true;
      this.previewCount += 1;
      let applied = false;
      try {
        applied = this.update(previewState, previewLayout, ["layoutMetadata"]);
      } finally {
        this.applyingSectionPreview = false;
      }
      if (applied) {
        this.sectionPreviewRendered = true;
        this.sectionPreviewLastAppliedAt = now;
        this.renderSectionOverlay(previewLayout, pending.widths);
      }
      return;
    }

    if (!this.pendingSectionPreviewRestore) return;
    const canonical = this.pendingSectionPreviewRestore;
    this.pendingSectionPreviewRestore = null;
    this.applyingSectionPreview = true;
    this.previewActive = false;
    try {
      this.update(canonical.state, canonical.layout, getChangedConfigFields(this.state, canonical.state));
    } finally {
      this.applyingSectionPreview = false;
    }
    this.sectionPreviewCanonical = null;
    this.sectionPreviewRendered = false;
    this.renderSectionOverlay(canonical.layout);
  }

  selectSectionFromPointer(event) {
    if (!this.sectionDesigner.active || !this.sectionInteractionLayer.children.length) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.sectionPointer.set(
      ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1,
      -((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1
    );
    this.sectionRaycaster.setFromCamera(this.sectionPointer, this.camera);
    const hit = this.sectionRaycaster.intersectObjects(this.sectionInteractionLayer.children, false)[0];
    if (!hit) return;
    this.setSectionSelection(hit.object.userData.sectionIndex);
    this.sectionDesigner.onSelect?.(hit.object.userData.sectionIndex);
  }

  restoreCameraState(snapshot, options = {}) {
    if (!snapshot) return;
    this.cancelCameraTransition();
    this.theta = Number.isFinite(Number(snapshot.theta)) ? Number(snapshot.theta) : 0;
    this.phi = Number.isFinite(Number(snapshot.phi)) ? Number(snapshot.phi) : 0;
    if (!options.preserveFrameMetrics) {
      this.baseRadius = Number(snapshot.baseRadius) || this.baseRadius;
    }
    this.radius = Number(snapshot.radius) || this.baseRadius;
    this.target.set(
      Number.isFinite(Number(snapshot.target?.x)) ? Number(snapshot.target.x) : 0,
      Number.isFinite(Number(snapshot.target?.y)) ? Number(snapshot.target.y) : 0,
      Number.isFinite(Number(snapshot.target?.z)) ? Number(snapshot.target.z) : 0
    );
    this.activeFocusKey = snapshot.focus || "overview";
    this.activeFocusVariant = snapshot.focusVariant || this.activeFocusKey;
    this.focusRadius = Number(snapshot.focusRadius) || this.baseRadius;
    this.root.dataset.cameraFocus = this.activeFocusKey;
    this.setEnvironmentLightScale(Number.isFinite(Number(snapshot.environmentScale)) ? Number(snapshot.environmentScale) : 1);
    this.renderer.toneMappingExposure = Number.isFinite(Number(snapshot.exposure)) ? Number(snapshot.exposure) : 1.08;
    this.setProductLightingBoost(this.activeFocusKey === "lighting" ? 2.35 : 1);
    this.refreshComponentHighlight();
    this.updateCamera();
  }

  resize() {
    const rect = this.root.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const pixelRatio = resolveRendererPixelRatio(width, height, window.devicePixelRatio || 1);
    if (Math.abs(this.renderer.getPixelRatio() - pixelRatio) > 0.001) this.renderer.setPixelRatio(pixelRatio);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    if (this.model?.children?.length) {
      this.onCameraInteraction("viewport-change", { modelGeneration: this.modelGeneration });
    } else this.updateSectionOverlayProjection();
    this.notifyDirectAnchor();
  }

  update(nextState, precomputedLayout = null, changedFields = null) {
    const externalUpdate = !this.applyingSectionPreview;
    if (externalUpdate) {
      this.pendingSectionPreview = null;
      this.pendingSectionPreviewRestore = null;
    }
    const previousState = this.state;
    const candidateState = normalizeBookcaseConfig(nextState);
    const changes = Array.isArray(changedFields) ? changedFields : getChangedConfigFields(previousState, candidateState);

    if (this.model?.children?.length && this.applyPartialUpdate(previousState, candidateState, changes, precomputedLayout)) {
      this.state = candidateState;
      this.lastRejectedRenderAudit = null;
      this.root.dataset.renderCandidateValid = "true";
      this.updateCount += 1;
      this.partialUpdateCount += 1;
      if (externalUpdate) this.resetSectionPreviewTransaction();
      return true;
    }

    const hadModel = Boolean(this.model?.children?.length);
    const cameraSnapshot = hadModel ? this.getViewState() : null;
    const rebuilt = this.rebuildModel(candidateState, precomputedLayout);
    if (!rebuilt) return false;
    this.state = candidateState;
    this.updateCount += 1;
    if (hadModel && shouldPreserveExactCamera(changes)) {
      this.updateModelFrameMetrics();
      this.restoreCameraState(cameraSnapshot, { preserveFrameMetrics: true });
      this.refreshComponentHighlight();
      this.refreshDirectHighlight();
      this.notifyDirectAnchor();
    } else {
      this.frameModel(true, hadModel);
      this.refreshDirectHighlight();
      this.notifyDirectAnchor();
    }
    if (externalUpdate) this.resetSectionPreviewTransaction();
    return true;
  }

  resetSectionPreviewTransaction() {
    const hadSectionPreview = Boolean(this.sectionPreviewCanonical || this.sectionPreviewRendered);
    this.pendingSectionPreview = null;
    this.pendingSectionPreviewRestore = null;
    this.sectionPreviewCanonical = null;
    this.sectionPreviewRendered = false;
    if (hadSectionPreview) this.previewActive = false;
  }

  preview(nextState, precomputedLayout, sourceField) {
    this.previewActive = true;
    this.previewCount += 1;
    const applied = this.update(nextState, precomputedLayout, [sourceField]);
    if (applied === false) this.previewActive = false;
    return applied;
  }

  restorePreview(canonicalState, canonicalLayout) {
    if (!this.previewActive) return;
    const changedFields = getChangedConfigFields(this.state, canonicalState);
    this.previewActive = false;
    this.update(canonicalState, canonicalLayout, changedFields);
  }

  applyPartialUpdate(previousState, nextState, changedFields, precomputedLayout = null) {
    const changed = new Set(changedFields);
    const nonVisualFields = new Set(["layoutPreset", "doorCount", "installation", "delivery"]);
    if (changed.size > 0 && [...changed].every((field) => nonVisualFields.has(field))) {
      return true;
    }
    const finishFields = new Set(["finish", "customPaintColor", "customPaintCode", "customPaintHex", "paintSelection"]);
    const onlyFinish = changed.size > 0 && [...changed].every((field) => finishFields.has(field));
    if (onlyFinish) {
      this.clearComponentHighlight();
      this.applyFinishMaterials(nextState);
      this.refreshComponentHighlight();
      return true;
    }
    if (changed.size === 1 && changed.has("lightingWarmth")) {
      this.clearComponentHighlight();
      this.applyLightingWarmth(nextState.lightingWarmth);
      this.refreshComponentHighlight();
      return true;
    }
    if (changed.size === 1 && changed.has("hardware") && getHardwareShape(previousState.hardware) === getHardwareShape(nextState.hardware)) {
      this.clearComponentHighlight();
      this.applyHardwareMaterial(nextState.hardware);
      this.refreshComponentHighlight();
      return true;
    }
    if (
      changed.size > 0
      && [...changed].every((field) => ["hardware", "hardwareSelections"].includes(field))
      && precomputedLayout?.validation?.valid
    ) {
      return this.applyHardwareDescriptorLayout(precomputedLayout, nextState);
    }
    return false;
  }

  applyFinishMaterials(config) {
    const materials = this.model.userData.materials;
    if (!materials) return;
    const finishColor = config.finish === "custom_bm" && config.customPaintHex
      ? hexToNumber(config.customPaintHex, finishPalette.custom_bm)
      : finishPalette[config.finish] || finishPalette.white_dove;
    const revealColor = new THREE.Color(finishColor).lerp(new THREE.Color(0x211e1b), 0.66);
    const edgeColor = new THREE.Color(finishColor).lerp(new THREE.Color(0x342f2a), 0.5);
    [materials.case, materials.side, materials.back, materials.inset, materials.edgeBlock].forEach((material) => {
      if (!material) return;
      material.color?.setHex(finishColor);
      material.needsUpdate = true;
    });
    materials.reveal?.color?.copy(revealColor);
    materials.edgeLine?.color?.copy(edgeColor);
    this.requestRender();
  }

  applyHardwareMaterial(hardware) {
    const material = this.model.userData.materials?.hardware;
    if (!material) return;
    const appearance = getHardwareAppearance(hardware);
    material.color.setHex(appearance.color);
    material.roughness = appearance.roughness;
    material.metalness = appearance.metalness;
    material.needsUpdate = true;
    this.requestRender();
  }

  applyHardwareDescriptorLayout(nextLayout, nextState) {
    const componentGroups = this.model.userData?.componentGroups;
    const materials = this.model.userData?.materials;
    if (!(componentGroups instanceof Map) || !materials) return false;
    const previousLayout = this.lastLayout;
    const currentHandles = (this.lastLayout?.components || []).filter((component) => component.role === "handle");
    const nextHandles = (nextLayout.components || []).filter((component) => component.role === "handle");
    const currentIds = currentHandles.map((component) => component.id).sort();
    const nextIds = nextHandles.map((component) => component.id).sort();

    const replacements = new Map();
    const replacementRecords = [];
    const depth = inchesToUnits(nextLayout.config.depth);
    for (const component of nextHandles) {
      const replacement = new THREE.Group();
      replacement.name = component.id;
      replacement.userData = {
        componentId: component.id,
        role: component.role,
        parentId: component.parentId,
        hostId: component.hostId,
        sectionId: getDescriptorSectionId(nextLayout, component),
        editableKind: "hardware",
        selectionAnchor: getDescriptorSelectionAnchor(component),
        bounds: component.bounds,
        edgeLine: materials.edgeLine
      };
      renderLayoutComponent(replacement, this.model, component, nextState, materials, depth);
      replacement.updateMatrixWorld(true);
      const record = collectOwnedMeshRecord(replacement, component.id);
      if (!record) {
        disposeDirectReplacement(replacement);
        replacements.forEach(disposeDirectReplacement);
        return false;
      }
      addDirectEditHitProxy(replacement, component, nextLayout.config.depth);
      replacements.set(component.id, replacement);
      replacementRecords.push(record);
    }

    const changedHandleIds = new Set([...currentIds, ...nextIds]);
    const retainedRecords = (this.model.userData.renderRecords || [])
      .filter((record) => !changedHandleIds.has(record.componentId));
    const candidateRecords = [...retainedRecords, ...replacementRecords];
    const audit = validateRenderedManifest(nextLayout, candidateRecords);
    if (!audit.valid) {
      this.lastRejectedRenderAudit = audit;
      this.root.dataset.renderCandidateValid = "false";
      replacements.forEach(disposeDirectReplacement);
      return false;
    }

    this.clearComponentHighlight();
    const nextHandleIds = new Set(nextIds);
    for (const component of currentHandles) {
      if (nextHandleIds.has(component.id)) continue;
      const target = componentGroups.get(component.id);
      target?.parent?.remove?.(target);
      disposeDirectReplacement(target);
      componentGroups.delete(component.id);
    }
    for (const component of nextHandles) {
      const target = componentGroups.get(component.id);
      const replacement = replacements.get(component.id);
      if (target) {
        disposeDirectReplacement(target);
        while (replacement.children.length) target.add(replacement.children[0]);
        target.userData = { ...target.userData, ...replacement.userData };
      } else {
        const parent = componentGroups.get(component.parentId) || this.model;
        parent.add(replacement);
        componentGroups.set(component.id, replacement);
      }
    }
    this.lastLayout = nextLayout;
    this.model.userData.layout = nextLayout;
    this.model.userData.renderRecords = candidateRecords;
    this.model.userData.renderAudit = audit;
    this.lastRenderAudit = audit;
    this.lastRejectedRenderAudit = null;
    this.root.dataset.renderCandidateValid = "true";
    this.model.updateMatrixWorld(true);
    this.reconcileDirectSelection(previousLayout, nextLayout, {
      notify: !this.previewActive && !this.applyingSectionPreview
    });
    this.refreshComponentHighlight();
    this.refreshDirectHighlight();
    this.notifyDirectAnchor();
    this.modelGeneration += 1;
    this.requestRender();
    return true;
  }

  resolveDirectSelectionForLayout(componentId, previousLayout, nextLayout) {
    if (!componentId || !Array.isArray(nextLayout?.components)) return null;
    const nextComponents = nextLayout.components;
    const nextIndex = new Map(nextComponents.map((component) => [component.id, component]));
    const exact = nextIndex.get(componentId);
    if (exact && DIRECT_EDITABLE_ROLES.has(exact.role)) return exact.id;

    const previous = previousLayout?.components?.find((component) => component.id === componentId);
    if (!previous) return null;
    const editable = nextComponents.filter((component) => DIRECT_EDITABLE_ROLES.has(component.role));
    const previousSectionId = previous.metadata?.sectionId
      || getDescriptorSectionId(previousLayout, previous);

    if (previous.role === "divider") {
      const boundaryIndex = Number(previous.metadata?.boundaryIndex);
      const divider = editable.find((component) => (
        component.role === "divider"
        && Number(component.metadata?.boundaryIndex) === boundaryIndex
      ));
      if (divider) return divider.id;
    }

    if (previous.role === "side_panel") {
      const sidePanel = editable.find((component) => (
        component.role === "side_panel"
        && component.metadata?.side === previous.metadata?.side
      ));
      if (sidePanel) return sidePanel.id;
    }

    if (["base", "trim"].includes(previous.role)) {
      return editable.find((component) => component.role === previous.role)?.id
        || editable.find((component) => component.role === "base")?.id
        || null;
    }
    if (["crown", "top_panel"].includes(previous.role)) {
      return editable.find((component) => component.role === previous.role)?.id
        || editable.find((component) => component.role === "crown")?.id
        || editable.find((component) => component.role === "top_panel")?.id
        || null;
    }

    if (previous.role === "light" && previousSectionId) {
      const sameSectionLight = editable.find((component) => (
        component.role === "light"
        && (component.metadata?.sectionId || getDescriptorSectionId(nextLayout, component)) === previousSectionId
      ));
      if (sameSectionLight) return sameSectionLight.id;
    }

    if (["section", "divider"].includes(previous.role)) return null;

    if (previous.hostId) {
      const sameHostedRole = editable.find((component) => (
        component.role === previous.role && component.hostId === previous.hostId
      ));
      if (sameHostedRole) return sameHostedRole.id;
      const host = nextIndex.get(previous.hostId);
      if (host && DIRECT_EDITABLE_ROLES.has(host.role)) return host.id;
    }

    if (previousSectionId) {
      const sameSectionRole = editable.find((component) => (
        component.role === previous.role
        && (component.metadata?.sectionId || getDescriptorSectionId(nextLayout, component)) === previousSectionId
      ));
      if (sameSectionRole && ["light", "handle"].includes(previous.role)) return sameSectionRole.id;
      const section = nextIndex.get(previousSectionId);
      if (section && DIRECT_EDITABLE_ROLES.has(section.role)) return section.id;
    }

    if (previous.role === "assembly") {
      return editable.find((component) => component.role === "assembly")?.id || null;
    }
    return null;
  }

  reconcileDirectSelection(previousLayout, nextLayout, options = {}) {
    const previousSelectedId = this.directEdit.selectedComponentId;
    const nextSelectedId = this.resolveDirectSelectionForLayout(
      previousSelectedId,
      previousLayout,
      nextLayout
    );
    const previousHoveredId = this.directEdit.hoveredComponentId;
    const nextHoveredId = previousHoveredId
      && nextLayout?.components?.some((component) => (
        component.id === previousHoveredId && DIRECT_EDITABLE_ROLES.has(component.role)
      ))
      ? previousHoveredId
      : null;

    this.directEdit.selectedComponentId = nextSelectedId;
    this.directEdit.hoveredComponentId = nextHoveredId;
    this.root.classList.toggle("has-direct-selection", Boolean(nextSelectedId));
    this.root.classList.toggle("has-direct-hover", Boolean(nextHoveredId));
    this.root.style.cursor = nextHoveredId ? "pointer" : "";

    if (previousHoveredId && !nextHoveredId) this.directEdit.onHover?.(null);
    if (previousSelectedId && previousSelectedId !== nextSelectedId && options.notify !== false) {
      queueMicrotask(() => {
        if (
          this.destroyed
          || this.lastLayout !== nextLayout
          || this.directEdit.selectedComponentId !== nextSelectedId
        ) return;
        this.directEdit.onSelect?.(
          nextSelectedId ? this.getDirectSelectionPayload(nextSelectedId, "api") : null
        );
        if (!nextSelectedId) this.directEdit.onAnchorChange?.(null);
      });
    }
    return nextSelectedId;
  }

  applyLightingWarmth(warmth) {
    const materials = this.model.userData.materials;
    const color = getLightingTemperatureColor(warmth);
    [materials?.puckLight, materials?.ledStrip].forEach((material) => {
      if (!material) return;
      material.color.setHex(color);
      material.emissive?.setHex(color);
      material.needsUpdate = true;
    });
    this.model.traverse((child) => {
      if (child.isLight && child.userData?.productLight) child.color.setHex(color);
    });
    this.requestRender();
  }

  updateModelFrameMetrics() {
    if (!this.model?.children?.length) return;
    const bounds = new THREE.Box3().setFromObject(this.model);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const verticalFov = THREE.MathUtils.degToRad(this.camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(this.camera.aspect || 1, 0.3));
    const heightDistance = size.y / (2 * Math.tan(verticalFov / 2));
    const widthDistance = size.x / (2 * Math.tan(horizontalFov / 2));
    const depthAllowance = size.z * 0.58;
    const compactAspect = (this.camera.aspect || 1) < 0.85;
    this.baseRadius = Math.max(heightDistance, widthDistance) * (compactAspect ? 1.34 : 1.32) + depthAllowance;
    this.overviewTarget.set(center.x, center.y + size.y * (compactAspect ? 0.01 : 0.015), center.z);
    this.focusTargetCache.clear();
  }

  frameModel(preserveZoom = true, transition = false) {
    if (!this.model?.children?.length) return;
    const previousRatio = preserveZoom && this.baseRadius > 0 && this.radius > 0
      ? this.radius / this.baseRadius
      : 1;
    this.updateModelFrameMetrics();
    const ratio = clamp(previousRatio || 1, 0.84, 1.48);
    if (transition) {
      if (this.activeFocusKey === "section") {
        this.focusSection(this.sectionDesigner.selectedIndex, { duration: SMART_CAMERA_DURATION, force: true });
      } else {
        const duration = isProfileCameraKey(this.activeFocusKey) ? PROFILE_CAMERA_DURATION : 480;
        this.focus(this.activeFocusKey || "overview", { duration, force: true });
      }
    } else {
      this.target.copy(this.overviewTarget);
      this.radius = this.baseRadius * ratio;
      this.updateCamera();
    }
  }

  rebuildModel(nextState, precomputedLayout = null) {
    this.clearComponentHighlight();
    const previousLayout = this.lastLayout;
    const nextModel = buildBookcaseModel(nextState, precomputedLayout);
    const candidateLayout = nextModel.userData.layout;
    const candidateRenderAudit = nextModel.userData.renderAudit;
    const layoutValid = Boolean(candidateLayout?.validation?.valid);
    const renderValid = Boolean(candidateRenderAudit?.valid);
    if (!layoutValid || !renderValid) {
      this.lastRejectedRenderAudit = candidateRenderAudit;
      this.root.dataset.renderCandidateValid = "false";
      if (candidateRenderAudit?.issues?.length) {
        console.error("JQ Bookcases render contract rejected a model", candidateRenderAudit.issues);
      }
      disposeMaterialSet(nextModel.userData?.materials);
      disposeObject(nextModel);
      return false;
    }
    this.scene.remove(this.model);
    disposeMaterialSet(this.model?.userData?.materials);
    disposeObject(this.model);
    this.model = nextModel;
    this.scene.add(this.model);
    this.lastLayout = candidateLayout;
    this.lastRenderAudit = candidateRenderAudit;
    this.lastRejectedRenderAudit = null;
    this.reconcileDirectSelection(previousLayout, candidateLayout, {
      notify: !this.previewActive && !this.applyingSectionPreview
    });
    this.updateConstructionInspector(this.lastLayout);
    if (this.sectionDesigner.active) this.refreshSectionInteractionLayer(this.lastLayout);
    this.rebuildCount += 1;
    this.modelGeneration += 1;
    this.focusTargetCache.clear();
    this.root.dataset.renderValid = "true";
    this.root.dataset.renderCandidateValid = "true";
    this.root.dataset.renderComponents = String(this.lastRenderAudit.renderedCount || 0);
    this.root.dataset.renderExpected = String(this.lastRenderAudit.expectedCount || 0);
    return true;
  }

  updateConstructionInspector(layout) {
    if (!this.constructionDebugEnabled || !layout?.components) return;
    while (this.constructionDebugGroup.children.length) {
      const child = this.constructionDebugGroup.children.pop();
      disposeObject(child);
    }
    const isolate = this.constructionDebugState.isolate;
    const visibleRoles = isolate === "base"
      ? new Set(["base", "trim"])
      : isolate === "fronts"
        ? new Set(["door", "drawer_front"])
        : isolate === "hardware"
          ? new Set(["handle"])
          : null;
    this.model.traverse((object) => {
      if (!object.userData?.componentId) return;
      const role = object.userData.role;
      if (["assembly", "section", "section_group", "opening"].includes(role)) {
        object.visible = true;
        return;
      }
      object.visible = !visibleRoles || visibleRoles.has(role);
    });

    const depth = inchesToUnits(layout.config.depth);
    const toSceneBox = (component) => new THREE.Box3(
      new THREE.Vector3(
        inchesToUnits(component.bounds.min.x),
        inchesToUnits(component.bounds.min.y),
        depth / 2 - inchesToUnits(component.bounds.max.z)
      ),
      new THREE.Vector3(
        inchesToUnits(component.bounds.max.x),
        inchesToUnits(component.bounds.max.y),
        depth / 2 - inchesToUnits(component.bounds.min.z)
      )
    );
    const addBounds = (component, color) => {
      const helper = new THREE.Box3Helper(toSceneBox(component), color);
      helper.userData.nonPhysicalHelper = true;
      helper.name = `debug-bounds-${component.id}`;
      this.constructionDebugGroup.add(helper);
    };

    if (this.constructionDebugState.showBounds) {
      for (const component of layout.components) {
        if (!component.bounds || ["assembly", "section", "section_group", "opening"].includes(component.role)) continue;
        if (visibleRoles && !visibleRoles.has(component.role)) continue;
        addBounds(component, component.role === "handle" ? 0xffb000 : 0x49a7ff);
      }
    }
    if (this.constructionDebugState.showRenderedBounds) {
      const componentById = new Map(layout.components.map((component) => [component.id, component]));
      for (const record of this.model.userData?.renderRecords || []) {
        const component = componentById.get(record.componentId);
        if (!component || (visibleRoles && !visibleRoles.has(component.role))) continue;
        const renderedBox = new THREE.Box3(
          new THREE.Vector3(record.bounds.min.x, record.bounds.min.y, record.bounds.min.z),
          new THREE.Vector3(record.bounds.max.x, record.bounds.max.y, record.bounds.max.z)
        );
        const helper = new THREE.Box3Helper(renderedBox, 0xff4dff);
        helper.userData.nonPhysicalHelper = true;
        helper.name = `debug-rendered-bounds-${record.componentId}`;
        this.constructionDebugGroup.add(helper);
      }
    }
    const toeVoid = layout.components.find((component) => component.metadata?.kind === "toe_kick_void");
    if (toeVoid && this.constructionDebugState.showToeVoid) addBounds(toeVoid, 0x55ff88);

    if (this.constructionDebugState.showPlanes) {
      const planes = layout.metrics.referencePlanes || {};
      const width = inchesToUnits(layout.config.width);
      const height = inchesToUnits(layout.config.height);
      const addVerticalPlane = (name, planeZ, color) => {
        if (!Number.isFinite(planeZ)) return;
        const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false });
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
        plane.position.set(0, height / 2, depth / 2 - inchesToUnits(planeZ));
        plane.userData.nonPhysicalHelper = true;
        plane.name = `debug-plane-${name}`;
        this.constructionDebugGroup.add(plane);
      };
      addVerticalPlane("carcass-front", planes.carcassFrontPlaneZ, 0x4da3ff);
      addVerticalPlane("finished-front", planes.finishedFrontPlaneZ, 0xffb347);
      addVerticalPlane("toe-kick-plate", planes.toeKickPlatePlaneZ, 0x55dd88);
    }

    for (const validationIssue of layout.validation?.issues || []) {
      if (!/COLLISION/.test(validationIssue.code)) continue;
      const component = layout.components.find((item) => item.id === validationIssue.componentId);
      if (component) addBounds(component, 0xff3344);
    }

    const report = this.constructionInspector?.querySelector("[data-construction-report]");
    if (report) {
      const planes = layout.metrics.referencePlanes || {};
      const fronts = layout.components.filter((component) => ["door", "drawer_front"].includes(component.role));
      const handles = layout.components.filter((component) => component.role === "handle");
      const bases = layout.components.filter((component) => ["base", "trim"].includes(component.role) && component.metadata?.style === layout.config.baseStyle);
      const collisionPairs = (layout.validation?.issues || [])
        .filter((item) => /COLLISION/.test(item.code))
        .map((item) => `${item.componentId} ↔ ${item.relatedId}`);
      report.textContent = [
        `Profile: ${layout.config.constructionProfile}`,
        `Front plane: ${planes.finishedFrontPlaneZ} in`,
        `Base height: ${layout.metrics.baseHeight} in`,
        `Nominal bounds: ${JSON.stringify(layout.metrics.nominalBounds)}`,
        `Decorative bounds: ${JSON.stringify(layout.metrics.decorativeBounds)}`,
        `Render: ${this.lastRenderAudit?.renderedCount || 0}/${this.lastRenderAudit?.expectedCount || 0}`,
        `Render/descriptor issues: ${(this.lastRenderAudit?.issues || []).map((item) => item.code).join(", ") || "none"}`,
        `Validation: ${layout.validation.valid ? "valid" : layout.validation.issues.map((item) => item.code).join(", ")}`,
        `Collision pairs: ${collisionPairs.join(", ") || "none"}`,
        "",
        "COMPONENTS",
        ...layout.components.map((component) => `${component.id} · ${component.role} · host ${component.hostId || "—"}`),
        "",
        "BASE",
        ...bases.map((component) => `${component.id} · ${component.metadata?.purpose} · recess ${component.metadata?.recessDepth || 0} in`),
        "",
        "FRONTS",
        ...fronts.map((component) => `${component.id} · ${component.size.x} in · ${component.metadata?.mounting} · reveal ${component.metadata?.reveal} · gap ${component.metadata?.meetingGap ?? "—"} · ${component.metadata?.hingeSide || "drawer"}/${component.metadata?.latchSide || "—"}`),
        "",
        "HARDWARE",
        ...handles.map((component) => `${component.id} · ${JSON.stringify(component.metadata?.mountingCenter)} · ${component.metadata?.placementRuleId}`)
      ].join("\n");
    }
    this.requestRender();
  }

  updateCamera() {
    const horizontal = Math.cos(this.phi) * this.radius;
    this.camera.position.set(
      this.target.x + Math.sin(this.theta) * horizontal,
      this.target.y + Math.sin(this.phi) * this.radius,
      this.target.z + Math.cos(this.theta) * horizontal
    );
    this.camera.lookAt(this.target);
    this.updateSectionOverlayProjection();
    if (this.directEdit.selectedComponentId) {
      this.refreshDirectHighlight();
      this.notifyDirectAnchor();
    }
    this.requestRender();
  }

  requestRender() {
    if (this.destroyed || this.isRenderingFrame || this.animationFrame !== null) return;
    this.animationFrame = window.requestAnimationFrame((time) => this.animate(time));
  }

  animate(now = performance.now()) {
    this.animationFrame = null;
    if (this.destroyed) return;
    this.isRenderingFrame = true;
    try {
      this.applyPendingSectionPreview(now);
      this.updateCameraTransition(now);
      this.renderer.render(this.scene, this.camera);
      this.renderCount += 1;
      const memory = this.renderer.info.memory;
      const render = this.renderer.info.render;
      this.root.dataset.renderCount = String(this.renderCount);
      this.root.dataset.webglGeometries = String(memory.geometries || 0);
      this.root.dataset.webglTextures = String(memory.textures || 0);
      this.root.dataset.webglCalls = String(render.calls || 0);
      this.root.dataset.webglTriangles = String(render.triangles || 0);
    } finally {
      this.isRenderingFrame = false;
    }
    if (this.cameraTransition || this.pendingSectionPreview || this.pendingSectionPreviewRestore) this.requestRender();
  }

  getViewState() {
    return {
      theta: this.theta,
      phi: this.phi,
      radius: this.radius,
      baseRadius: this.baseRadius,
      focus: this.activeFocusKey,
      focusVariant: this.activeFocusVariant,
      focusRadius: this.focusRadius,
      transitioning: Boolean(this.cameraTransition),
      environmentScale: this.environmentLightScale,
      exposure: this.renderer.toneMappingExposure,
      target: { x: this.target.x, y: this.target.y, z: this.target.z },
      position: { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z }
    };
  }

  getDiagnostics() {
    let directHitProxyCount = 0;
    this.model?.traverse?.((object) => {
      if (object.userData?.directEditHitProxy) directHitProxyCount += 1;
    });
    return {
      instanceId: this.instanceId,
      updateCount: this.updateCount,
      rebuildCount: this.rebuildCount,
      partialUpdateCount: this.partialUpdateCount,
      previewCount: this.previewCount,
      previewActive: this.previewActive,
      renderCount: this.renderCount,
      renderScheduled: this.animationFrame !== null,
      activeFocus: this.activeFocusKey,
      cameraTransitionActive: Boolean(this.cameraTransition),
      cameraTransitionSequence: this.cameraTransitionSequence,
      cameraTransitionCancellations: this.cameraTransitionCancellationCount,
      cameraIntentGeneration: this.cameraIntentGeneration,
      modelGeneration: this.modelGeneration,
      controlsEnabled: !this.destroyed,
      reducedMotion: Boolean(this.reducedMotionQuery?.matches),
      canvasConnected: Boolean(this.renderer.domElement?.isConnected),
      interactionTool: this.activeTool,
      dimensionsVisible: this.dimensionsVisible,
      wallVisible: this.wallVisible,
      directEditing: {
        enabled: this.directEdit.enabled,
        hoveredComponentId: this.directEdit.hoveredComponentId,
        selectedComponentId: this.directEdit.selectedComponentId,
        hitProxyCount: directHitProxyCount
      },
      constructionDebug: this.constructionDebugEnabled ? {
        ...this.constructionDebugState,
        profile: this.lastLayout?.config?.constructionProfile,
        referencePlanes: this.lastLayout?.metrics?.referencePlanes,
        validationIssues: this.lastLayout?.validation?.issues || []
      } : null,
      renderAudit: this.lastRenderAudit,
      rejectedRenderAudit: this.lastRejectedRenderAudit,
      webgl: {
        geometries: this.renderer.info.memory.geometries || 0,
        textures: this.renderer.info.memory.textures || 0,
        calls: this.renderer.info.render.calls || 0,
        triangles: this.renderer.info.render.triangles || 0
      }
    };
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.clearComponentHighlight();
    this.controlAbortController?.abort();
    if (this.animationFrame !== null) window.cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
    this.resizeObserver?.disconnect();
    this.scene.remove(this.model);
    this.clearSectionInteractionLayer();
    this.sectionOverlay?.remove();
    this.constructionInspector?.remove();
    this.scene.remove(this.constructionDebugGroup);
    disposeObject(this.constructionDebugGroup);
    disposeMaterialSet(this.model?.userData?.materials);
    disposeObject(this.model);
    disposeObject(this.scene);
    this.scene.clear();
    this.renderer.renderLists?.dispose();
    this.renderer.dispose();
    this.renderer.domElement?.remove();
  }
}

function getDescriptorSectionId(layout, component, index = null) {
  if (!layout?.components || !component) return null;
  const componentIndex = index || new Map(layout.components.map((item) => [item.id, item]));
  let current = component;
  const visited = new Set();
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    if (current.role === "section") return current.id;
    const nextId = current.parentId || current.hostId;
    current = nextId ? componentIndex.get(nextId) : null;
  }
  return null;
}

function getDescriptorSelectionAnchor(component) {
  const semantic = component?.metadata?.selectionAnchor
    || component?.metadata?.mountingCenter
    || component?.metadata?.mountingCenters?.[0];
  if (semantic && [semantic.x, semantic.y, semantic.z].every(Number.isFinite)) {
    return { x: semantic.x, y: semantic.y, z: semantic.z };
  }
  const bounds = component?.bounds;
  if (!bounds) return { x: 0, y: 0, z: 0 };
  return {
    x: (bounds.min.x + bounds.max.x) / 2,
    y: (bounds.min.y + bounds.max.y) / 2,
    z: bounds.min.z
  };
}

function descriptorPointToSceneVector(point, bookcaseDepth) {
  return new THREE.Vector3(
    inchesToUnits(point.x),
    inchesToUnits(point.y),
    inchesToUnits(bookcaseDepth) / 2 - inchesToUnits(point.z)
  );
}

function descriptorBoundsToSceneBox(value, bookcaseDepth) {
  const depth = inchesToUnits(bookcaseDepth);
  return new THREE.Box3(
    new THREE.Vector3(
      inchesToUnits(value.min.x),
      inchesToUnits(value.min.y),
      depth / 2 - inchesToUnits(value.max.z)
    ),
    new THREE.Vector3(
      inchesToUnits(value.max.x),
      inchesToUnits(value.max.y),
      depth / 2 - inchesToUnits(value.min.z)
    )
  );
}

function addDirectEditHitProxy(group, component, bookcaseDepth) {
  if (component.role === "assembly") return;
  if (!["handle", "section", "divider", "light"].includes(component.role)) {
    group.traverse((object) => {
      if (object.isMesh && !object.userData?.nonPhysicalHelper) object.layers.enable(DIRECT_EDIT_LAYER);
    });
    return;
  }
  const box = descriptorBoundsToSceneBox(component.bounds, bookcaseDepth);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  if (component.role === "handle") {
    size.x = Math.max(size.x, 0.28);
    size.y = Math.max(size.y, 0.28);
    size.z = Math.max(size.z, 0.24);
  } else if (component.role === "divider") {
    size.x = Math.max(size.x, 0.16);
    size.z = Math.max(size.z, 0.12);
  } else if (component.role === "light") {
    size.x = Math.max(size.x, 0.12);
    size.y = Math.max(size.y, 0.12);
    size.z = Math.max(size.z, 0.12);
  }
  const proxyMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    colorWrite: false
  });
  proxyMaterial.userData.directHitProxyMaterial = true;
  const proxy = new THREE.Mesh(
    new THREE.BoxGeometry(size.x, size.y, size.z),
    proxyMaterial
  );
  proxy.name = `${component.id}-direct-edit-hit-proxy`;
  proxy.position.copy(center);
  proxy.layers.set(DIRECT_EDIT_LAYER);
  proxy.userData = {
    nonPhysicalHelper: true,
    directEditHitProxy: true,
    componentId: component.id,
    role: component.role,
    hostId: component.hostId,
    sectionId: component.metadata?.sectionId || null,
    editableKind: DIRECT_EDIT_KIND_BY_ROLE[component.role] || null
  };
  group.add(proxy);
}

function formatDirectComponentLabel(component) {
  const role = String(component?.role || "component").replace(/_/g, " ");
  const sectionId = component?.metadata?.sectionId || "";
  const ordinal = sectionId.match(/(\d+)$/)?.[1];
  return `${role.replace(/\b\w/g, (letter) => letter.toUpperCase())}${ordinal ? ` in section ${Number(ordinal)}` : ""}`;
}

function buildBookcaseModel(state, precomputedLayout = null) {
  const config = normalizeBookcaseConfig(state);
  const layout = precomputedLayout || generateBookcaseLayout(config);
  const finishColor = config.finish === "custom_bm" && config.customPaintHex
    ? hexToNumber(config.customPaintHex, finishPalette.custom_bm)
    : finishPalette[config.finish] || finishPalette.white_dove;
  const materials = createMaterials(finishColor, config);
  const group = new THREE.Group();
  group.name = "bookcase-assembly";
  group.userData = {
    edgeLine: materials.edgeLine,
    materials,
    layout,
    pointLightCount: 0,
    renderRecords: [],
    renderAudit: { valid: false, issues: [] }
  };

  const depth = inchesToUnits(layout.config.depth);
  const logicalRoles = new Set(["assembly", "section", "section_group", "opening"]);
  const descriptorIndex = new Map(layout.components.map((component) => [component.id, component]));
  const componentGroups = new Map();
  componentGroups.set("bookcase", group);
  group.userData.componentGroups = componentGroups;

  layout.components.forEach((component) => {
    if (component.role === "assembly") {
      componentGroups.set(component.id, group);
      return;
    }
    const componentGroup = new THREE.Group();
    componentGroup.name = component.id;
    componentGroup.userData = {
      componentId: component.id,
      role: component.role,
      parentId: component.parentId,
      hostId: component.hostId,
      sectionId: getDescriptorSectionId(layout, component, descriptorIndex),
      editableKind: DIRECT_EDIT_KIND_BY_ROLE[component.role] || null,
      selectionAnchor: getDescriptorSelectionAnchor(component),
      bounds: component.bounds,
      edgeLine: materials.edgeLine
    };
    componentGroups.set(component.id, componentGroup);
  });

  layout.components.forEach((component) => {
    if (component.role === "assembly") return;
    const componentGroup = componentGroups.get(component.id);
    const parentGroup = componentGroups.get(component.parentId) || group;
    parentGroup.add(componentGroup);
  });

  layout.components.forEach((component) => {
    if (logicalRoles.has(component.role)) return;
    const componentGroup = componentGroups.get(component.id) || group;
    renderLayoutComponent(componentGroup, group, component, config, materials, depth);
  });

  if (layout.validation?.valid) {
    group.updateMatrixWorld(true);
    const renderRecords = collectRenderedComponentRecords(layout, componentGroups);
    group.userData.renderRecords = renderRecords;
    group.userData.renderAudit = validateRenderedManifest(layout, renderRecords);
    layout.components.forEach((component) => {
      if (!DIRECT_EDITABLE_ROLES.has(component.role)) return;
      const componentGroup = componentGroups.get(component.id);
      if (componentGroup) addDirectEditHitProxy(componentGroup, component, layout.config.depth);
    });
    group.updateMatrixWorld(true);
  } else {
    group.userData.renderAudit = {
      valid: false,
      expectedCount: 0,
      renderedCount: 0,
      issues: layout.validation?.errors || []
    };
  }

  return group;
}

function renderLayoutComponent(componentGroup, rootGroup, component, config, materials, bookcaseDepth) {
  const size = [
    inchesToUnits(component.size.x),
    inchesToUnits(component.size.y),
    inchesToUnits(component.size.z)
  ];
  const position = [
    inchesToUnits(component.position.x),
    inchesToUnits(component.position.y),
    bookcaseDepth / 2 - inchesToUnits(component.position.z)
  ];
  if (size.some((value) => !Number.isFinite(value) || value <= 0)) return;

  if (component.role === "door" || component.role === "drawer_front") {
    renderDescriptorDoor(componentGroup, component, config, materials, size, position);
    return;
  }
  if (component.role === "handle") {
    renderDescriptorHandle(componentGroup, component, config, materials, size, position);
    return;
  }
  if (component.role === "light") {
    renderDescriptorLight(componentGroup, rootGroup, component, materials, size, position);
    return;
  }
  if (component.role === "crown" && renderDescriptorCrown(componentGroup, component, materials, size, position)) {
    return;
  }

  const material = getLayoutMaterial(component, materials);
  const showEdges = !["trim", "crown", "base"].includes(component.role);
  addBox(componentGroup, size, position, material, showEdges);
}

function getLayoutMaterial(component, materials) {
  if (component.role === "back_panel") return materials.back;
  return materials.case;
}

function renderDescriptorCrown(group, component, materials, size, position) {
  const profile = component.metadata?.profileGeometry;
  const outline = Array.isArray(profile?.outline) ? profile.outline : [];
  const extrusionAxis = profile?.extrusion?.axis;
  if (
    profile?.kind !== "crown_profile_extrusion"
    || outline.length < 3
    || !["x", "z"].includes(extrusionAxis)
  ) return false;

  const [width, height, depth] = size;
  const projectionDirection = Number(profile.crossSection?.projectionDirection) >= 0 ? 1 : -1;
  const points = outline.map((point) => ({
    height: clamp(Number(point.height), 0, 1),
    projection: clamp(Number(point.projection), 0, 1)
  }));
  if (points.some((point) => !Number.isFinite(point.height) || !Number.isFinite(point.projection))) return false;

  const shape = new THREE.Shape();
  points.forEach((point, index) => {
    const localY = -height / 2 + point.height * height;
    let shapeX;
    if (extrusionAxis === "x") {
      const localZ = -depth / 2 + point.projection * depth;
      shapeX = -localZ;
    } else {
      shapeX = projectionDirection > 0
        ? -width / 2 + point.projection * width
        : width / 2 - point.projection * width;
    }
    if (index === 0) shape.moveTo(shapeX, localY);
    else shape.lineTo(shapeX, localY);
  });
  shape.closePath();

  const extrusionLength = extrusionAxis === "x" ? width : depth;
  if (!Number.isFinite(extrusionLength) || extrusionLength <= 0) return false;
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: extrusionLength,
    steps: 1,
    bevelEnabled: false,
    curveSegments: 1
  });
  if (extrusionAxis === "x") {
    geometry.rotateY(Math.PI / 2);
    geometry.translate(-width / 2, 0, 0);
  } else {
    geometry.translate(0, 0, -depth / 2);
  }
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, materials.case);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  const edgeMaterial = group.userData.edgeLine
    || new THREE.LineBasicMaterial({ color: 0x8f806e, transparent: true, opacity: 0.16 });
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 24), edgeMaterial);
  edges.position.copy(mesh.position);
  group.add(edges);
  return true;
}

function renderDescriptorDoor(group, component, config, materials, size, position) {
  const [width, height, depth] = size;
  const [x, y, z] = position;
  const style = getRenderableFrontStyle(component, config);

  if (style === "flat") {
    addBox(group, size, position, materials.case);
    return;
  }

  const profile = component.metadata?.profileGeometry;
  if (!profile || !Number.isFinite(profile.frameWidth) || profile.frameWidth <= 0) {
    addBox(group, size, position, materials.case);
    return;
  }
  const rail = inchesToUnits(profile.frameWidth);
  const frameDepth = clamp(inchesToUnits(profile.frameDepth), 0.001, depth);
  const panelRecess = clamp(inchesToUnits(profile.panelRecess), 0, Math.max(0, depth - 0.001));
  const panelDepth = clamp(inchesToUnits(profile.panelDepth), 0.001, Math.max(0.001, depth - panelRecess));
  const frontSemantics = resolveRenderedFrontSemantics(component, z, depth);
  const frameZ = frontSemantics.visibleFrontZ + frontSemantics.inwardDirection * frameDepth / 2;
  const panelZ = frontSemantics.visibleFrontZ + frontSemantics.inwardDirection * (panelRecess + panelDepth / 2);
  const centerWidth = width - rail * 2;
  const centerHeight = height - rail * 2;
  if (centerWidth <= 0 || centerHeight <= 0) {
    addBox(group, size, position, materials.case);
    return;
  }

  addBox(group, [width, rail, frameDepth], [x, y + height / 2 - rail / 2, frameZ], materials.case, true);
  addBox(group, [width, rail, frameDepth], [x, y - height / 2 + rail / 2, frameZ], materials.case, true);
  addBox(group, [rail, centerHeight, frameDepth], [x - width / 2 + rail / 2, y, frameZ], materials.case, true);
  addBox(group, [rail, centerHeight, frameDepth], [x + width / 2 - rail / 2, y, frameZ], materials.case, true);
  addBox(
    group,
    [centerWidth, centerHeight, panelDepth],
    [x, y, panelZ],
    style === "glass" ? materials.glass : materials.inset,
    false
  );
}

function resolveRenderedFrontSemantics(component, descriptorCenterZ, descriptorDepth) {
  const frontPlaneZ = Number(component.metadata?.frontPlaneZ);
  const backPlaneZ = Number(component.metadata?.backPlaneZ);
  const mounting = component.metadata?.mounting;
  if (
    !["inset", "overlay"].includes(mounting) ||
    !Number.isFinite(frontPlaneZ) ||
    !Number.isFinite(backPlaneZ) ||
    Math.abs(frontPlaneZ - backPlaneZ) <= 1e-9
  ) {
    throw new RangeError(`Front ${component.id} is missing semantic mounting planes.`);
  }
  // Layout +Z points inward while scene +Z points outward. The descriptor's
  // declared front/back planes determine the scene direction once; profile
  // subgeometry never guesses from an AABB sign.
  const outwardDirection = frontPlaneZ < backPlaneZ ? 1 : -1;
  return {
    mounting,
    visibleFrontZ: descriptorCenterZ + outwardDirection * descriptorDepth / 2,
    outwardDirection,
    inwardDirection: -outwardDirection
  };
}

function renderDescriptorHandle(group, component, config, materials, size, position) {
  const hardwareToken = component.metadata?.hardware || config.hardware;
  if (hardwareToken === "push_latch") return;
  const orientation = component.metadata?.orientation || (size[0] > size[1] ? "horizontal" : "vertical");
  const category = component.metadata?.category
    || component.metadata?.hardwareCategory
    || component.metadata?.variantSnapshot?.category
    || component.metadata?.snapshot?.category
    || null;
  const hardwareType = component.metadata?.hardwareType || getHardwareShape(hardwareToken);
  const isPull = hardwareType === "pull" || Boolean(category && !["round_knob", "t_bar_knob", "cabinet_latch"].includes(category));
  const material = getDescriptorHardwareMaterial(materials, component, hardwareToken);
  const sceneMountCenters = descriptorMountCentersToScene(
    component.metadata?.mountingCenters || [],
    component.position,
    position
  );

  if (["edge_pull", "tab_pull"].includes(category)) {
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(size[0] * 0.94, size[1] * 0.82, size[2] * 0.72),
      material
    );
    edge.position.set(position[0], position[1], position[2] + size[2] * 0.08);
    edge.castShadow = true;
    group.add(edge);
    return;
  }

  if (category === "cup_pull") {
    const recipe = createCupPullProxyParts(size, position, orientation, sceneMountCenters);
    const geometry = new THREE.TorusGeometry(1, 0.28, 12, 28, Math.PI);
    geometry.computeBoundingBox();
    const geometryBox = geometry.boundingBox;
    const geometrySize = new THREE.Vector3();
    const geometryCenter = new THREE.Vector3();
    geometryBox.getSize(geometrySize);
    geometryBox.getCenter(geometryCenter);
    geometry.translate(-geometryCenter.x, -geometryCenter.y, -geometryCenter.z);
    const targetX = recipe.horizontal ? recipe.targetSize[0] : recipe.targetSize[1];
    const targetY = recipe.horizontal ? recipe.targetSize[1] : recipe.targetSize[0];
    geometry.scale(
      targetX / geometrySize.x,
      targetY / geometrySize.y,
      recipe.targetSize[2] / geometrySize.z
    );
    const cup = new THREE.Mesh(geometry, material);
    if (!recipe.horizontal) cup.rotation.z = Math.PI / 2;
    cup.position.set(...recipe.shellPosition);
    cup.castShadow = true;
    group.add(cup);
    for (const mountRecipe of recipe.mounts) {
      const mount = new THREE.Mesh(
        new THREE.CylinderGeometry(mountRecipe.radius, mountRecipe.radius, mountRecipe.length, 14),
        material
      );
      mount.rotation.x = Math.PI / 2;
      mount.position.set(...mountRecipe.position);
      mount.castShadow = true;
      group.add(mount);
    }
    return;
  }

  if (category === "cabinet_latch") {
    const latchParts = createCabinetLatchProxyParts(size, position, component.metadata?.placement?.mirrored);
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(...latchParts.body.size),
      material
    );
    body.position.set(...latchParts.body.position);
    body.castShadow = true;
    group.add(body);
    const catchPiece = new THREE.Mesh(
      new THREE.BoxGeometry(...latchParts.catch.size),
      material
    );
    catchPiece.position.set(...latchParts.catch.position);
    catchPiece.castShadow = true;
    group.add(catchPiece);
    return;
  }

  if (category === "t_bar_knob") {
    const horizontal = orientation !== "vertical";
    const length = horizontal ? size[0] : size[1];
    const radius = Math.max(0.003, Math.min(horizontal ? size[1] : size[0], size[2]) * 0.32);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length * 0.94, 18), material);
    if (horizontal) bar.rotation.z = Math.PI / 2;
    bar.position.set(position[0], position[1], position[2] + size[2] * 0.14);
    bar.castShadow = true;
    group.add(bar);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.54, radius * 0.54, size[2] * 0.56, 14), material);
    stem.rotation.x = Math.PI / 2;
    stem.position.set(position[0], position[1], position[2] - size[2] * 0.08);
    stem.castShadow = true;
    group.add(stem);
    return;
  }

  if (isPull) {
    const recipe = createLinearPullProxyParts(size, position, orientation, sceneMountCenters);
    const pull = new THREE.Mesh(
      new THREE.CylinderGeometry(recipe.bar.radius, recipe.bar.radius, recipe.bar.length, 18),
      material
    );
    if (recipe.horizontal) pull.rotation.z = Math.PI / 2;
    pull.position.set(...recipe.bar.position);
    pull.castShadow = true;
    group.add(pull);
    for (const standoffRecipe of recipe.standoffs) {
      const standoff = new THREE.Mesh(
        new THREE.CylinderGeometry(standoffRecipe.radius, standoffRecipe.radius, standoffRecipe.length, 14),
        material
      );
      standoff.rotation.x = Math.PI / 2;
      standoff.position.set(...standoffRecipe.position);
      standoff.castShadow = true;
      group.add(standoff);
    }
    return;
  }

  const radius = Math.max(0.004, Math.min(size[0], size[1]) / 2);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 16), material);
  knob.scale.z = size[2] / (radius * 2);
  knob.position.set(...position);
  knob.castShadow = true;
  group.add(knob);
}

function getDescriptorHardwareMaterial(materials, component, fallbackHardware) {
  const metadata = component?.metadata || {};
  const snapshot = metadata.variantSnapshot || metadata.snapshot || metadata.hardwareSnapshot || {};
  const swatch = metadata.finishSwatch
    || snapshot.finishSwatch
    || snapshot.canonicalFinishSwatch
    || snapshot.canonicalFinish?.swatch
    || snapshot.proxySpec?.finish?.swatch
    || snapshot.finish?.swatch
    || null;
  const color = /^#[0-9a-f]{6}$/i.test(String(swatch || ""))
    ? Number.parseInt(String(swatch).slice(1), 16)
    : null;
  if (color == null) return materials.hardware;
  if (!(materials.hardwareVariantCache instanceof Map)) materials.hardwareVariantCache = new Map();
  const finishName = String(
    metadata.finishName
    || snapshot.finishName
    || snapshot.finish?.manufacturerName
    || ""
  ).toLowerCase();
  const key = `${color}:${finishName}`;
  if (materials.hardwareVariantCache.has(key)) return materials.hardwareVariantCache.get(key);
  const appearance = getHardwareAppearance(fallbackHardware);
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: /polished|chrome/.test(finishName) ? 0.22 : /black|bronze/.test(finishName) ? 0.48 : appearance.roughness,
    metalness: /black/.test(finishName) ? 0.5 : 0.86
  });
  materials.hardwareVariantCache.set(key, material);
  return material;
}

function renderDescriptorLight(group, rootGroup, component, materials, size, position) {
  const type = component.metadata?.lightType || "puck";
  if (type === "puck") {
    const radius = Math.max(0.003, Math.min(size[0], size[2]) * 0.45);
    const trim = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, size[1] * 0.72, 28),
      materials.puckTrim
    );
    trim.position.set(...position);
    trim.castShadow = false;
    group.add(trim);
    const diffuser = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.78, radius * 0.78, size[1] * 0.24, 28),
      materials.puckLight
    );
    diffuser.position.set(position[0], position[1] - size[1] * 0.35, position[2]);
    diffuser.castShadow = false;
    group.add(diffuser);
  } else {
    addBox(
      group,
      [size[0] * 0.88, size[1] * 0.88, size[2] * 0.88],
      position,
      materials.ledStrip,
      false
    );
  }

  if (rootGroup.userData.pointLightCount >= 18) return;
  const temperature = Number(component.metadata?.warmth) || 2700;
  const color = getLightingTemperatureColor(temperature);
  const glow = new THREE.PointLight(color, type === "puck" ? 0.4 : 0.11, type === "puck" ? 2.2 : 1.5);
  glow.userData.productLight = true;
  glow.position.set(position[0], position[1] - (type === "vertical_led" ? 0 : 0.09), position[2] + 0.045);
  group.add(glow);
  rootGroup.userData.pointLightCount += 1;
}

function collectRenderedComponentRecords(layout, componentGroups) {
  const expected = createExpectedRenderManifest(layout);
  const expectedIds = new Set(expected.map((descriptor) => descriptor.componentId));
  const records = [];
  for (const descriptor of expected) {
    const componentGroup = componentGroups.get(descriptor.componentId);
    const record = componentGroup ? collectOwnedMeshRecord(componentGroup, descriptor.componentId) : null;
    if (record) records.push(record);
  }
  for (const [componentId, componentGroup] of componentGroups) {
    if (componentId === "bookcase" || expectedIds.has(componentId)) continue;
    const unexpected = collectOwnedMeshRecord(componentGroup, componentId);
    if (unexpected) records.push(unexpected);
  }
  return records;
}

function collectOwnedMeshRecord(componentGroup, componentId) {
  const bounds = new THREE.Box3().makeEmpty();
  let meshCount = 0;

  const visit = (object) => {
    if (object !== componentGroup && object.userData?.componentId) return;
    if (object.userData?.nonPhysicalHelper) return;
    if (object.isMesh && object.geometry) {
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
      const meshBounds = object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld);
      bounds.union(meshBounds);
      meshCount += 1;
    }
    object.children.forEach(visit);
  };
  visit(componentGroup);

  if (!meshCount || bounds.isEmpty()) return null;
  return {
    componentId,
    meshCount,
    bounds: {
      min: { x: bounds.min.x, y: bounds.min.y, z: bounds.min.z },
      max: { x: bounds.max.x, y: bounds.max.y, z: bounds.max.z }
    }
  };
}

function createRoomFloorTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 192;
  const context = canvas.getContext("2d");
  context.fillStyle = "#ddd0bd";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "rgba(113, 87, 61, 0.22)";
  context.lineWidth = 1;
  for (let y = -48; y < canvas.height + 48; y += 24) {
    for (let x = -48; x < canvas.width + 48; x += 48) {
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + 48, y + 24);
      context.stroke();
      context.beginPath();
      context.moveTo(x + 48, y);
      context.lineTo(x, y + 24);
      context.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createContactShadowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(128, 64, 8, 128, 64, 120);
  gradient.addColorStop(0, "rgba(20, 16, 12, 0.28)");
  gradient.addColorStop(0.42, "rgba(20, 16, 12, 0.13)");
  gradient.addColorStop(1, "rgba(20, 16, 12, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createMaterials(baseColor, config) {
  const hardwareAppearance = getHardwareAppearance(config.hardware);
  const edgeColor = new THREE.Color(baseColor).lerp(new THREE.Color(0x342f2a), 0.5).getHex();
  const revealColor = new THREE.Color(baseColor).lerp(new THREE.Color(0x211e1b), 0.66).getHex();
  const lightColor = getLightingTemperatureColor(config.lightingWarmth);

  return {
    // JQ cabinetry is painted, not veneered. The slight roughness differences
    // describe sprayed paint over casework and inset panels without inventing
    // a directional wood-grain color or bump texture.
    case: new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.58, metalness: 0 }),
    side: new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.6, metalness: 0 }),
    back: new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.72, metalness: 0 }),
    inset: new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.64, metalness: 0 }),
    edgeBlock: new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.82, metalness: 0 }),
    shadow: new THREE.MeshStandardMaterial({ color: 0x28241f, roughness: 0.92, metalness: 0 }),
    reveal: new THREE.MeshStandardMaterial({ color: revealColor, roughness: 0.92, metalness: 0 }),
    innerShadow: new THREE.MeshBasicMaterial({ color: 0x211b16, transparent: true, opacity: 0.18, depthWrite: false }),
    highlight: new THREE.MeshBasicMaterial({ color: 0xfffbf4, transparent: true, opacity: 0.15, depthWrite: false }),
    pinHole: new THREE.MeshStandardMaterial({ color: 0x4e4034, roughness: 0.96, metalness: 0 }),
    screen: new THREE.MeshStandardMaterial({ color: 0x17191a, roughness: 0.28, metalness: 0.08, emissive: 0x101213, emissiveIntensity: 0.12 }),
    firebox: new THREE.MeshStandardMaterial({ color: 0x211f1c, roughness: 0.94, metalness: 0 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xdce8ec, roughness: 0.18, metalness: 0, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide, clearcoat: 0.35, clearcoatRoughness: 0.2 }),
    glassLine: new THREE.MeshPhysicalMaterial({ color: 0xfffbf2, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.2, depthWrite: false, clearcoat: 0.8 }),
    hardware: new THREE.MeshStandardMaterial({
      color: hardwareAppearance.color,
      roughness: hardwareAppearance.roughness,
      metalness: hardwareAppearance.metalness
    }),
    edgeLine: new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: 0.2 }),
    puckTrim: new THREE.MeshStandardMaterial({ color: 0xf4f0e7, roughness: 0.42, metalness: 0.14 }),
    puckLight: new THREE.MeshBasicMaterial({ color: lightColor, transparent: true, opacity: 0.92, toneMapped: false }),
    ledStrip: new THREE.MeshStandardMaterial({ color: lightColor, emissive: lightColor, emissiveIntensity: 1.05, roughness: 0.28, metalness: 0.08 })
  };
}

function getHardwareAppearance(hardware) {
  const finish = getHardwareFinish(hardware);
  const metadata = getHardwareFinishOption(finish);
  return {
    color: metadata?.materialColor ?? 0xb38a4a,
    roughness: metadata?.roughness ?? 0.34,
    metalness: metadata?.metalness ?? 0.84
  };
}

function getHardwareShape(hardware) {
  if (hardware === "push_latch") return "none";
  return getHardwareType(hardware) || "knob";
}

function getRenderableFrontStyle(component, config) {
  const requested = component.metadata?.style || (
    component.role === "drawer_front" ? config.drawerFrontStyle : config.doorStyle
  );
  if (component.role === "drawer_front") {
    return ["shaker", "flat", "slim_shaker"].includes(requested) ? requested : "shaker";
  }
  return ["shaker", "flat", "slim_shaker", "glass"].includes(requested) ? requested : "flat";
}

function getLightingTemperatureColor(temperature) {
  const numeric = Number(temperature) || 2700;
  return numeric >= 3400 ? 0xfff2dc : numeric >= 2900 ? 0xffe4bc : 0xffcf8d;
}

function hexToNumber(value, fallback) {
  const match = String(value || "").trim().match(/^#?([0-9a-f]{6})$/i);
  return match ? Number.parseInt(match[1], 16) : fallback;
}

function addBox(parent, size, position, material, edge = true) {
  const geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);

  if (edge) {
    const edgeMaterial = material.userData?.edgeLine || parent.userData.edgeLine;
    const lineMaterial = edgeMaterial || new THREE.LineBasicMaterial({ color: 0x8f806e, transparent: true, opacity: 0.15 });
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), lineMaterial);
    edges.position.copy(mesh.position);
    parent.add(edges);
  }
  return mesh;
}

function disposeObject(object) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  object.traverse((child) => {
    if (child.geometry) geometries.add(child.geometry);
    if (child.material) {
      const childMaterials = Array.isArray(child.material) ? child.material : [child.material];
      childMaterials.forEach((material) => {
        materials.add(material);
        ["map", "bumpMap", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap"].forEach((key) => {
          if (material[key]) textures.add(material[key]);
        });
      });
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose?.());
}

function disposeDirectReplacement(group) {
  if (!group?.traverse) return;
  group.traverse((child) => {
    if (child === group) return;
    child.geometry?.dispose?.();
    const childMaterials = Array.isArray(child.material) ? child.material : child.material ? [child.material] : [];
    childMaterials.forEach((material) => {
      if (material?.userData?.directHitProxyMaterial) material.dispose?.();
    });
  });
  group.clear?.();
}

function disposeMaterialSet(materialSet) {
  if (!materialSet || typeof materialSet !== "object") return;
  const textures = new Set();
  const materials = new Set();
  const candidates = Object.values(materialSet).flatMap((value) => (
    value instanceof Map ? [...value.values()] : [value]
  ));
  candidates.forEach((material) => {
    if (!material || typeof material.dispose !== "function") return;
    materials.add(material);
    ["map", "bumpMap", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap"].forEach((key) => {
      if (material[key]) textures.add(material[key]);
    });
  });
  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
}

function isWebGLAvailable() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      (window.WebGL2RenderingContext && canvas.getContext("webgl2")) ||
      (window.WebGLRenderingContext && canvas.getContext("webgl"))
    );
  } catch (error) {
    return false;
  }
}

function box3ToPlainBounds(bounds) {
  return {
    min: { x: bounds.min.x, y: bounds.min.y, z: bounds.min.z },
    max: { x: bounds.max.x, y: bounds.max.y, z: bounds.max.z }
  };
}

function shortestAngleDelta(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

function easeInOutCubic(value) {
  const t = clamp(value, 0, 1);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function formatSectionWidth(value) {
  return Number(Number(value || 0).toFixed(2)).toString();
}

function formatSectionType(type) {
  return {
    open: "Open Shelves",
    lower_doors: "Lower Doors",
    drawers: "Lower Drawers",
    tall_doors: "Tall Door",
    media: "Media Feature",
    desk: "Desk Feature",
    feature: "Fireplace Feature"
  }[type] || "Generated Section";
}

function formatSectionStorageField(field) {
  return {
    shelfCount: "Shelf count",
    shelfDistribution: "Shelf distribution",
    doorStyle: "Door style",
    doorArrangement: "Door arrangement",
    drawerCount: "Drawer count",
    drawerFrontStyle: "Drawer front style",
    lowerStorageHeight: "Lower storage height"
  }[field] || "Section storage";
}

function formatHardwareMillimeters(value) {
  return `${Number(Number(value).toFixed(1))} mm`;
}

function formatHardwareTechnicalLabel(value) {
  const label = String(value || "").replaceAll("_", " ").trim();
  return label ? `${label.charAt(0).toUpperCase()}${label.slice(1)}` : "Not specified";
}

function formatHardwarePlacement(placement) {
  if (!placement || typeof placement !== "object" || !Object.keys(placement).length) return "JQ recommended placement";
  const parts = [
    placement.orientation,
    placement.horizontalAnchor,
    placement.verticalAnchor,
    Number.isFinite(placement.edgeOffsetMm) ? `${formatHardwareMillimeters(placement.edgeOffsetMm)} edge offset` : null,
    Number.isFinite(placement.crossAxisOffsetMm) ? `${formatHardwareMillimeters(placement.crossAxisOffsetMm)} cross-axis offset` : null,
    placement.quantityPerFront ? `${placement.quantityPerFront} per front` : null,
    placement.mirrored ? "mirrored" : null
  ].filter(Boolean).map(formatHardwareTechnicalLabel);
  return parts.join(" · ") || "JQ recommended placement";
}

function formatHardwarePricingPosture(pricing) {
  if (!pricing || typeof pricing !== "object") return "Price confirmed with quote";
  if (pricing.mode === "reference_unit" && Number.isFinite(pricing.amount)) {
    const symbol = pricing.currency === "CAD" ? "CA$" : "$";
    const checked = pricing.checkedAt ? ` · checked ${pricing.checkedAt}` : "";
    return `${symbol}${Number(pricing.amount).toFixed(2)} reference/list per unit${checked}`;
  }
  if (pricing.mode === "band" && pricing.priceBand) return `${pricing.priceBand} price band · confirmed with quote`;
  return "Price confirmed with quote";
}

function isSafeExternalUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" || url.protocol === "http:";
  } catch (error) {
    return false;
  }
}

const MAX_VIEWER_RENDER_PIXELS = 10_000_000;

function resolveRendererPixelRatio(width, height, devicePixelRatio) {
  const cssPixels = Math.max(1, Number(width) || 1) * Math.max(1, Number(height) || 1);
  const requestedRatio = clamp(Number(devicePixelRatio) || 1, 1, 2);
  const pixelBudgetRatio = Math.sqrt(MAX_VIEWER_RENDER_PIXELS / cssPixels);
  return clamp(Math.min(requestedRatio, pixelBudgetRatio), 0.75, 2);
}

function shouldPreserveExactCamera(changedFields = []) {
  const envelopeFields = new Set(["width", "height", "depth", "baseStyle", "crownStyle"]);
  return changedFields.every((field) => !envelopeFields.has(field));
}

function sectionWidthsToStableRatios(widths) {
  const normalized = widths.map((width) => Number(width));
  if (!normalized.length || normalized.some((width) => !Number.isFinite(width) || width <= 0)) return [];
  const total = normalized.reduce((sum, width) => sum + width, 0);
  let allocated = 0;
  return normalized.map((width, index) => {
    if (index === normalized.length - 1) return Number((1 - allocated).toFixed(12));
    const ratio = Number((width / total).toFixed(12));
    allocated = Number((allocated + ratio).toFixed(12));
    return ratio;
  });
}

function createSectionMeasurementBounds(layout, sections, widths) {
  const panelThickness = Number(layout.rules?.panelThickness) || 0;
  let cursor = Number(sections[0]?.bounds?.min?.x) || 0;
  return widths.map((width) => {
    const minX = cursor;
    const maxX = minX + width;
    cursor = maxX + panelThickness;
    return { minX, maxX };
  });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
