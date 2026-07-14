import * as THREE from "./assets/vendor/three.module.js";
import { diagramSvg, iconSvg } from "./icon-system.js?v=jq-icons-20260713i";
import {
  baseStyleOptions,
  crownStyleOptions,
  defaultBookcaseConfig,
  deliveryOptions,
  doorStyleOptions,
  finishOptions,
  hardwareOptions,
  inchesToUnits,
  installationOptions,
  layoutPresets,
  lightingWarmthOptions,
  lightingOptions,
  normalizeBookcaseConfig,
  optionLabels
} from "./bookcase-config.js?v=engine-contract-20260713s";
import { generateBookcaseLayout } from "./bookcase-layout.js?v=engine-contract-20260713s";
import { formatPrice } from "./bookcase-pricing.js?v=engine-contract-20260713s";
import {
  applySectionWidths,
  equalizeSectionWidths,
  getSectionDesignerState,
  mergeSection,
  reconcileSectionCustomization,
  resetSectionCustomization,
  resizeAdjacentSections,
  setSectionClearWidth,
  setSectionType,
  splitSection
} from "./bookcase-sections.js?v=section-designer-20260713a";
import {
  PROFILE_CAMERA_DURATION,
  calculateProfileCameraPose,
  calculateViewportAwareTarget,
  isProfileCameraKey,
  resolveCameraTransitionDuration
} from "./profile-camera.js?v=profile-camera-20260713a";
import {
  BENJAMIN_MOORE_COLOR_DATA_NOTICE,
  BENJAMIN_MOORE_OFFICIAL_COLORS_URL,
  createBenjaminMoorePaintSelection,
  getBenjaminMooreColorCatalogProvider
} from "./benjamin-moore-colors.js?v=bm-catalog-20260712a";
import {
  ALL_CONTROL_CATEGORIES,
  CONFIGURATOR_MODES,
  CONFIGURATOR_PREFERENCE_KEYS,
  GUIDED_STEPS,
  categoryForField,
  categoryForGuidedStep,
  createQuoteUrl,
  createReviewGroups,
  createPresetTransition,
  escapeHtml,
  getApplicability,
  getCategorySummary,
  getChangedConfigFields,
  getGuidedStepIndex,
  getInvalidDraftIssues,
  guidedStepForField,
  guidedStepForCategory,
  hasBlockingConfigurationIssue,
  inferBasePresetId,
  normalizeAllCategory,
  normalizeConfiguratorMode,
  normalizeGuidedStep,
  shouldRunAction,
  validateGuidedStep
} from "./configurator-experience.js?v=custom-studio-20260713a";
import {
  createAcceptedDesignSnapshot,
  evaluateBookcaseCandidate,
  restoreAcceptedDesignSnapshot
} from "./bookcase-engine.js?v=engine-hardening-20260711a";
import {
  createExpectedRenderManifest,
  validateRenderedManifest
} from "./bookcase-render-contract.js?v=engine-hardening-20260711a";
import {
  INSPIRATION_FILTERS,
  STUDIO_CAPABILITIES,
  STUDIO_ENTRY_VIEWS,
  STUDIO_PROVISIONAL_DIMENSIONS,
  createNeutralCustomConfig,
  filterInspirationIdeas,
  getInspirationIdea,
  getStudioPreviewIdeas,
  inspirationIdeas,
  isStudioWelcomeRequest,
  normalizeStudioEntryView,
  suggestStudioSectionCount,
  validateStudioDimensions
} from "./configurator-studio.js?v=custom-studio-20260713b";

const numericFields = new Set(["width", "height", "depth", "sections", "shelves", "shelfThickness", "lightingWarmth", "drawerCount"]);
const builderIcons = Object.freeze({
  dimensions: iconSvg("dimensions"),
  layout: iconSvg("layout"),
  structure: iconSvg("material-layers"),
  lighting: iconSvg("lighting"),
  finish: iconSvg("paint-finish"),
  hardware: iconSvg("hardware"),
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
  premiumMaterials: iconSvg("material-layers"),
  craftsmanship: iconSvg("craftsmanship"),
  customFit: iconSvg("dimensions"),
});

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

const hardwarePreviewIcons = Object.freeze({
  brass_knob: iconSvg("hardware-knob"),
  matte_black_knob: iconSvg("hardware-knob"),
  brass_pull: iconSvg("handle-pull"),
  matte_black_pull: iconSvg("handle-pull"),
  polished_nickel_pull: iconSvg("handle-pull")
});

const hardwareFinishSwatches = Object.freeze({
  brass_knob: "#b58a4d",
  brass_pull: "#b58a4d",
  matte_black_knob: "#2f2c29",
  matte_black_pull: "#2f2c29",
  polished_nickel_pull: "#c8c7c3"
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
  warm_pucks: Object.freeze({ theta: -0.2, phi: -0.24, radiusScale: 0.52, selection: "center", limit: 1, targetModelYOffset: -0.055, targetModelZOffset: -0.025 }),
  shelf_accent: Object.freeze({ theta: -0.38, phi: -0.13, radiusScale: 0.54, selection: "centerInterior", limit: 2, targetModelYOffset: -0.015, targetModelZOffset: -0.06 }),
  vertical_led: Object.freeze({ theta: -0.4, phi: -0.035, radiusScale: 0.64, selection: "centerInterior", limit: 2, targetModelZOffset: -0.08 }),
  full_package: Object.freeze({ theta: -0.38, phi: -0.1, radiusScale: 0.6, selection: "centerInterior", limit: 3, targetModelYOffset: -0.02, targetModelZOffset: -0.07 })
});

const CAMERA_PROFILE_BY_CATEGORY = Object.freeze({
  layout: "overview",
  dimensions: "overview",
  storage: "overview",
  construction: "overview",
  doors: "doors",
  finish: "finish",
  hardware: "hardware",
  lighting: "lighting",
  service: "overview",
  sidePanels: "sidePanels",
  backPanel: "backPanel"
});

const CAMERA_PROFILE_BY_GUIDED_STEP = Object.freeze({
  layout: "overview",
  dimensions: "overview",
  storage: "overview",
  construction: "overview",
  appearance: "finish",
  review: "overview"
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
const HOVER_PREVIEW_FIELDS = new Set(["doorStyle", "baseStyle", "crownStyle", "finish", "hardware", "lighting", "lightingWarmth"]);
let viewerInstanceSequence = 0;

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-bookcase-builder]").forEach(async (host, index) => {
    if (host.__bookcaseConfigurator) return;
    if (host.getAttribute("data-enable-cabinet-ar") === "true") {
      try {
        const { readCabinetArShareConfiguration } = await import("./cabinet-ar.js?v=cabinet-ar-20260712b");
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
    this.arEnabled = this.host.getAttribute("data-enable-cabinet-ar") === "true";
    const initialRequest = this.loadInitialDesignRequest();
    const initialEvaluation = initialRequest.config ? evaluateBookcaseCandidate(initialRequest.config) : null;
    this.hasAcceptedDesign = Boolean(initialEvaluation?.accepted);
    this.initialSource = this.hasAcceptedDesign ? initialRequest.source : "new";
    this.acceptedEvaluation = this.hasAcceptedDesign ? initialEvaluation : null;
    this.state = this.hasAcceptedDesign ? initialEvaluation.state : null;
    this.layout = this.hasAcceptedDesign ? initialEvaluation.layout : null;
    this.bom = this.hasAcceptedDesign ? initialEvaluation.bom : null;
    this.pricing = this.hasAcceptedDesign ? initialEvaluation.pricing : null;
    this.basePresetId = this.hasAcceptedDesign ? inferBasePresetId(this.state) : defaultBookcaseConfig.layoutPreset;
    this.mode = this.loadPreference(CONFIGURATOR_PREFERENCE_KEYS.mode, normalizeConfiguratorMode);
    this.guidedStep = this.loadPreference(CONFIGURATOR_PREFERENCE_KEYS.guidedStep, normalizeGuidedStep);
    this.expandedCategory = this.loadPreference(CONFIGURATOR_PREFERENCE_KEYS.allCategory, normalizeAllCategory);
    this.entryView = STUDIO_ENTRY_VIEWS.welcome;
    this.inspirationFilter = "all";
    this.inspirationExpanded = false;
    this.studioDimensions = { ...STUDIO_PROVISIONAL_DIMENSIONS };
    this.studioDimensionsProvisional = false;
    this.studioDimensionIssues = [];
    this.studioSectionCount = suggestStudioSectionCount(this.studioDimensions.width);
    this.introPreviewIndex = 1;
    this.introPreviewTimer = 0;
    this.introPreviewStopped = false;
    this.analyticsEvents = [];
    this.welcomeViewed = false;
    this.drafts = {};
    this.scrollPositions = { guided: 0, all: 0 };
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
    this.sectionUndoStack = [];
    this.sectionRedoStack = [];
    this.sectionDesignerCameraState = null;
    this.sectionDesignerCameraChanged = false;
    this.activeSectionDividerDrag = null;
    this.activeView = "three-quarter";
    this.arController = null;
    this.arControllerPromise = null;
    this.activeRangeDrag = null;
    this.profileFocusFrame = 0;
    this.optionPreview = null;
    this.optionPreviewTimer = 0;
    this.price = this.hasAcceptedDesign ? this.pricing.total : null;
    if (this.hasAcceptedDesign) this.priceCalculationCount += 1;
    this.render();
    this.cacheElements();
    this.viewer = this.hasAcceptedDesign ? this.createViewer(this.layout) : this.createStudioIntroViewer();
    this.bindEvents();
    if (this.hasAcceptedDesign) {
      if (this.arEnabled) this.initializeCabinetAr();
      this.renderActiveControls();
      this.syncInterface();
      this.focusCameraForCurrentContext({ duration: SMART_CAMERA_DURATION });
      this.verifyRestoredPaintSelection();
      this.emitStudioEvent("studio_entry_bypassed", { source: this.initialSource });
    } else {
      this.syncStudioEntry();
      this.emitWelcomeViewed();
    }
  }

  loadPreference(key, normalizer) {
    try {
      return normalizer(localStorage.getItem(key));
    } catch (error) {
      return normalizer(null);
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

  savePreference(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      // Preferences are optional when storage is unavailable.
    }
  }

  loadInitialDesignRequest() {
    if (this.host.__cabinetArSharedConfiguration) {
      return { config: this.host.__cabinetArSharedConfiguration, source: "share" };
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
        source: "preset"
      };
    }
    if (isStudioWelcomeRequest(window.location.search)) {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete("start");
      window.history.replaceState(window.history.state, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
      return { config: null, source: "new" };
    }
    try {
      const stored = JSON.parse(localStorage.getItem("jqBookcasesDesign") || "null");
      if (!stored || ![2, 3, 4].includes(Number(stored.schemaVersion))) return { config: null, source: "new" };
      const restored = restoreAcceptedDesignSnapshot(stored);
      return restored.accepted
        ? { config: restored.state, source: "saved" }
        : { config: null, source: "new" };
    } catch (error) {
      return { config: null, source: "new" };
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
      lastRenderAudit: { valid: true, issues: [] }
    };
  }

  createViewer(initialLayout = null) {
    if (!isWebGLAvailable()) return this.createViewerFallback();
    try {
      return new BookcaseViewer3D(this.elements.viewer, this.state, initialLayout, (interaction) => {
        if (interaction === "rotate") this.activeView = "custom";
        if (this.sectionDesignerActive && ["rotate", "zoom"].includes(interaction)) this.sectionDesignerCameraChanged = true;
        this.syncViewButtons();
        this.syncDiagnosticsAttributes();
      });
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
      getViewState: () => null,
      getDiagnostics: () => ({ instanceId: "fallback", updateCount: 0, rebuildCount: 0 }),
      destroy: () => {},
      lastRenderAudit: { valid: true, issues: [] }
    };
  }

  render() {
    this.renderFullPageConfigurator();
  }

  renderFullPageConfigurator() {
    if (!this.hasAcceptedDesign) {
      this.renderStudioEntryShell();
      return;
    }
    this.host.innerHTML = `
      <form class="builder-shell configurator-shell configurator-experience" data-builder-form novalidate>
        <h1 id="${this.id}-viewer-title" class="sr-only">3D Bookcase Configurator</h1>

        <aside class="configurator-step-rail" aria-label="Guided setup steps" data-step-rail>
          <ol>
            ${GUIDED_STEPS.map((item, index) => `
              <li data-step-rail-item="${item.id}">
                <button type="button" data-guided-step="${item.id}" aria-label="Step ${index + 1}: ${item.label}">
                  <span>${index + 1}</span><small>${item.shortLabel}</small>
                </button>
              </li>
            `).join("")}
          </ol>
        </aside>

        <aside class="builder-panel configurator-panel configurator-control-experience" aria-label="Bookcase configuration controls" data-controls-scroll>
          <header class="configurator-panel-intro">
            <span class="section-kicker">Design your bookcase</span>
            <strong data-mode-description>Build your bookcase one step at a time.</strong>
          </header>
          <section id="${this.id}-guided-panel" role="tabpanel" aria-labelledby="${this.id}-mode-guided" data-mode-panel="guided"></section>
          <section id="${this.id}-all-panel" role="tabpanel" aria-labelledby="${this.id}-mode-all" data-mode-panel="all" hidden></section>
        </aside>

        <section class="studio-model configurator-model" aria-labelledby="${this.id}-viewer-title">
          <header class="configurator-experience-toolbar">
            <div class="configurator-mode-selector" role="tablist" aria-label="Configuration experience">
              <button id="${this.id}-mode-guided" type="button" role="tab" data-configurator-mode="guided" aria-controls="${this.id}-guided-panel">
                <span>Guided Setup</span><small>Step-by-step</small>
              </button>
              <button id="${this.id}-mode-all" type="button" role="tab" data-configurator-mode="all" aria-controls="${this.id}-all-panel">
                <span>All Controls</span><small>Direct access</small>
              </button>
            </div>
          </header>
          <div class="preview-heading">
            <div><span>Live preview</span><small>Drag to rotate · Use arrow keys or the view dock</small></div>
          </div>
          <div class="viewer-stage" data-3d-viewer tabindex="0" role="group" aria-roledescription="interactive 3D preview" aria-label="Built-in bookcase preview. Use arrow keys to rotate and plus or minus to zoom."></div>
          <div class="preview-control-dock" aria-label="Preview controls">
            <div class="preview-tools" role="group" aria-label="Preview zoom and reset controls">
              <button type="button" data-viewer-zoom="in" aria-label="Zoom in" title="Zoom in"><span class="view-icon" aria-hidden="true">${builderIcons.zoomIn}</span><small>Zoom in</small></button>
              <button type="button" data-viewer-zoom="out" aria-label="Zoom out" title="Zoom out"><span class="view-icon" aria-hidden="true">${builderIcons.zoomOut}</span><small>Zoom out</small></button>
              <button type="button" data-reset-view aria-label="Rotate to default view" title="Rotate to default view"><span class="view-icon" aria-hidden="true">${builderIcons.reset}</span><small>Rotate</small></button>
            </div>
            <div class="view-controls" role="group" aria-label="3D view controls">
              <button type="button" data-view="three-dimensional" aria-pressed="false"><span class="view-icon" aria-hidden="true">${builderIcons.orbit}</span><small>3D</small></button>
              <button type="button" data-view="front" aria-pressed="false"><span class="view-icon" aria-hidden="true">${builderIcons.front}</span><small>Front</small></button>
              <button type="button" data-view="three-quarter" aria-pressed="true"><span class="view-icon" aria-hidden="true">${builderIcons.threeQuarter}</span><small>3/4</small></button>
              <button type="button" data-view="side" aria-pressed="false"><span class="view-icon" aria-hidden="true">${builderIcons.side}</span><small>Side</small></button>
            </div>
          </div>
          ${this.arEnabled ? `
            <div class="cabinet-ar-launch">
              <button class="cabinet-ar-launch-button" type="button" data-open-ar aria-label="AR View in Your Room">
                <span class="view-icon" aria-hidden="true">${builderIcons.augmentedReality}</span><span data-ar-label>AR View in Your Room</span>
              </button>
            </div>
          ` : ""}
        </section>

        <section class="configurator-estimate-bar" aria-label="Estimate and next steps">
          <div class="configurator-price-block">
            <span class="price-kicker">Estimated project price</span>
            <strong data-price>${formatPrice(this.pricing.total)}</strong>
            <p id="${this.id}-action-hint" class="configurator-quote-note" data-action-hint aria-live="polite">Final pricing is confirmed after measurements and project details are verified.</p>
          </div>
          <div class="studio-trust-row" aria-label="JQ Bookcases value commitments">
            <div class="studio-trust-item"><span class="studio-trust-icon" aria-hidden="true">${builderIcons.premiumMaterials}</span><span><strong>Premium Materials</strong><small>Furniture-grade construction</small></span></div>
            <div class="studio-trust-item"><span class="studio-trust-icon" aria-hidden="true">${builderIcons.craftsmanship}</span><span><strong>Expert Craftsmanship</strong><small>Built by skilled artisans</small></span></div>
            <div class="studio-trust-item"><span class="studio-trust-icon" aria-hidden="true">${builderIcons.customFit}</span><span><strong>Custom Fit</strong><small>Made for your exact space</small></span></div>
          </div>
          <div class="configurator-actions">
            <button class="configurator-review-button" type="button" data-review-design>Review Design</button>
            <button class="configurator-save-button" type="button" data-save-design aria-label="Save Design">${builderIcons.save}<span>Save Design</span></button>
            <button class="configurator-quote-button" type="button" data-open-order="measurement">Request a Quote</button>
          </div>
        </section>

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

        <section class="studio-intro-stage" aria-labelledby="${this.id}-preview-title">
          <header class="studio-intro-heading">
            <span class="section-kicker">A flexible starting point</span>
            <h2 id="${this.id}-preview-title">One system, many arrangements</h2>
            <p>These presentation views are derived from buildable configurations. They are not your design and do not create an estimate.</p>
          </header>
          <div class="studio-preview-composition">
            <div class="studio-intro-preview" data-studio-intro-preview aria-live="polite">
              ${this.renderStudioIntroPreview()}
            </div>
            <div class="studio-preview-variants" role="group" aria-label="Preview different arrangement capabilities">
              ${getStudioPreviewIdeas().map((idea, index) => `
                <button type="button" data-studio-preview-index="${index}" aria-pressed="${index === this.introPreviewIndex}">${escapeHtml(index === 0 ? "Open framework" : index === 1 ? "Mixed storage" : "Tall zones")}</button>
              `).join("")}
            </div>
          </div>
        </section>

        <footer class="studio-entry-lockbar" aria-label="Estimate and actions available after starting a design">
          <div class="studio-entry-estimate">
            <span>Project estimate</span>
            <strong data-price>Your estimate will appear as you build</strong>
            <small>No configuration, price, or design ID has been created yet.</small>
          </div>
          <div class="studio-entry-locked-actions" aria-label="Actions unlock after a design begins">
            <button type="button" disabled aria-disabled="true">Save after you start</button>
            <button type="button" disabled aria-disabled="true">Quote after you start</button>
          </div>
        </footer>
        <p class="status-message" data-builder-status role="status" aria-live="polite"></p>
      </form>
    `;
  }

  renderStudioEntryCopyContent() {
    return `${this.entryView === STUDIO_ENTRY_VIEWS.welcome ? "" : `
      <button class="studio-entry-back" type="button" data-studio-back>${builderIcons.back}<span>Back to studio start</span></button>
    `}${this.renderStudioEntryContent()}`;
  }

  renderStudioEntryContent() {
    if (this.entryView === STUDIO_ENTRY_VIEWS.custom) return this.renderStudioCustomStart();
    if (this.entryView === STUDIO_ENTRY_VIEWS.ideas) return this.renderStudioIdeaLibrary();
    return `
      <header class="studio-welcome-heading">
        <span class="section-kicker">Built around your space</span>
        <h1 id="${this.id}-entry-title">Start with your wall. Build it your way.</h1>
        <p>Your room sets the boundaries; the details stay yours. Begin with measurements or an editable idea, then shape every section, storage type, profile, finish, and lighting choice in one continuous design studio.</p>
      </header>
      <ul class="studio-capability-list" aria-label="What you can customize">
        ${STUDIO_CAPABILITIES.map((capability) => `<li>${builderIcons.check}<span>${escapeHtml(capability)}</span></li>`).join("")}
      </ul>
      <div class="studio-entry-routes">
        <button class="studio-route-card is-primary" type="button" data-studio-route="custom">
          <span class="studio-route-number" aria-hidden="true">01</span>
          <span><small>Recommended</small><strong>Start with my space</strong><em>Enter my dimensions</em></span>
          ${builderIcons.dimensions}
        </button>
        <button class="studio-route-card" type="button" data-studio-route="ideas">
          <span class="studio-route-number" aria-hidden="true">02</span>
          <span><small>Explore possibilities</small><strong>Use an editable idea</strong><em>Browse ideas</em></span>
          ${builderIcons.layout}
        </button>
      </div>
      <p class="studio-reassurance">Every starting point stays editable. Media, desk, and fireplace openings explain their structural constraints where you edit them.</p>
    `;
  }

  renderStudioCustomStart() {
    const issueFor = (field) => this.studioDimensionIssues.find((issue) => issue.field === field)?.message || "";
    return `
      <header class="studio-welcome-heading is-compact">
        <span class="section-kicker">Start with my space</span>
        <h1 id="${this.id}-entry-title">Give the design a real boundary.</h1>
        <p>Enter the wall dimensions you know. If they are provisional, you can revise them in Space before saving or requesting a quote.</p>
      </header>
      ${this.studioDimensionsProvisional ? `
        <p class="studio-provisional-note" role="status"><strong>Provisional measurements</strong> We started with 96 × 96 × 15 inches. Confirm these before production planning.</p>
      ` : ""}
      <fieldset class="studio-dimension-fields">
        <legend>Wall and bookcase dimensions</legend>
        ${[
          ["width", "Wall width", 24, 144],
          ["height", "Available height", 72, 120],
          ["depth", "Preferred depth", 10, 24]
        ].map(([field, label, min, max]) => `
          <label>
            <span>${label}<small>${min}–${max} in</small></span>
            <span class="studio-dimension-input"><input data-studio-dimension="${field}" type="number" min="${min}" max="${max}" step="1" inputmode="decimal" value="${escapeHtml(this.studioDimensions[field])}" aria-label="${label} in inches" aria-describedby="${this.id}-studio-${field}-error"><i aria-hidden="true">in</i></span>
            <small id="${this.id}-studio-${field}-error" class="studio-field-error" data-studio-dimension-error="${field}">${escapeHtml(issueFor(field))}</small>
          </label>
        `).join("")}
      </fieldset>
      <button class="studio-unsure-button" type="button" data-studio-unsure>I’m not sure yet</button>
      <fieldset class="studio-section-choice">
        <legend>Starting structure</legend>
        <p>Choose a section count. We’ll begin with equal open sections and no cabinets or lighting.</p>
        <div role="radiogroup" aria-label="Starting section count">
          ${[1, 2, 3, 4, 5, 6].map((count) => `
            <label><input type="radio" name="${this.id}-studio-sections" data-studio-sections value="${count}" ${count === this.studioSectionCount ? "checked" : ""}><span>${count}</span></label>
          `).join("")}
        </div>
      </fieldset>
      <button class="studio-create-button" type="button" data-studio-create>Build my starting structure</button>
      <p class="studio-reassurance">This creates your first accepted design. Only then will the live 3D model, estimate, Save, Quote, and room view become available.</p>
    `;
  }

  renderStudioIdeaLibrary() {
    const filtered = filterInspirationIdeas(this.inspirationFilter);
    const visible = this.inspirationExpanded || this.inspirationFilter !== "all" ? filtered : filtered.slice(0, 6);
    return `
      <header class="studio-welcome-heading is-compact">
        <span class="section-kicker">Ideas, not limits</span>
        <h1 id="${this.id}-entry-title">Choose a buildable idea to reshape.</h1>
        <p>Every card is backed by the same configuration engine. Choose one to create your first accepted design, then edit its dimensions, sections, storage, construction, and appearance.</p>
      </header>
      <div class="studio-idea-filters" role="group" aria-label="Filter editable ideas">
        ${INSPIRATION_FILTERS.map((filter) => `
          <button type="button" data-idea-filter="${filter.id}" aria-pressed="${filter.id === this.inspirationFilter}">${escapeHtml(filter.label)}</button>
        `).join("")}
      </div>
      <div class="studio-idea-grid" data-studio-idea-grid>
        ${visible.map((idea) => this.renderStudioIdeaCard(idea)).join("")}
      </div>
      ${this.inspirationFilter === "all" && !this.inspirationExpanded && filtered.length > visible.length ? `
        <button class="studio-view-all" type="button" data-view-all-ideas>View all ${filtered.length} editable ideas</button>
      ` : ""}
      <p class="studio-reassurance">“Fully editable” means every section type and width can be changed directly. Feature openings remain editable within the structural rules shown in the designer.</p>
    `;
  }

  renderStudioIdeaCard(idea) {
    const preset = layoutPresets.find((item) => item.id === idea.id);
    const index = layoutPresets.findIndex((item) => item.id === idea.id) + 1;
    return `
      <button class="studio-idea-card" type="button" data-idea-id="${escapeHtml(idea.id)}">
        ${this.renderPresetMini(preset, index)}
        <span class="studio-idea-copy">
          <span><small>${escapeHtml(INSPIRATION_FILTERS.find((filter) => filter.id === idea.category)?.label || idea.category)}</small>${idea.fullyEditable ? "<em>Fully editable</em>" : "<em>Feature constraints</em>"}</span>
          <strong>${escapeHtml(idea.name)}</strong>
          <small>${escapeHtml(idea.description)}</small>
        </span>
      </button>
    `;
  }

  renderStudioIntroPreview() {
    const previewIdeas = getStudioPreviewIdeas();
    const idea = previewIdeas[clamp(this.introPreviewIndex, 0, previewIdeas.length - 1)] || previewIdeas[0];
    const preset = layoutPresets.find((item) => item.id === idea.id);
    const layout = generateBookcaseLayout(preset.config);
    return `
      <div class="studio-preview-scaffold" data-studio-preview-idea="${escapeHtml(idea.id)}">
        <span class="studio-dimension-line is-width" aria-hidden="true"><i></i><small><b>${layout.config.width} in</b><span>Wall width</span></small><i></i></span>
        <span class="studio-dimension-line is-height" aria-hidden="true"><i></i><small><b>${layout.config.height} in</b><span>Wall height</span></small><i></i></span>
        <div class="studio-preview-drawing">${this.renderPresetMini(preset, 1)}</div>
        <span class="studio-preview-callout is-add">${builderIcons.plus}<small>Add section</small></span>
        <span class="studio-preview-callout is-resize">${builderIcons.dimensions}<small>Resize any section</small></span>
      </div>
      <p class="studio-preview-caption"><strong>${escapeHtml(idea.name)}</strong><span>${layout.config.sections} engine-derived sections · presentation only</span></p>
    `;
  }

  renderActiveControls(options = {}) {
    if (!this.elements?.guidedPanel || !this.elements?.allPanel) return;
    this.clearResetConfirmation();
    const previousMode = options.previousMode || this.mode;
    if (this.elements.controlsScroll) this.scrollPositions[previousMode] = this.elements.controlsScroll.scrollTop;

    const guidedActive = this.mode === CONFIGURATOR_MODES.guided;
    this.elements.guidedPanel.hidden = !guidedActive;
    this.elements.guidedPanel.toggleAttribute("inert", !guidedActive);
    this.elements.allPanel.hidden = guidedActive;
    this.elements.allPanel.toggleAttribute("inert", guidedActive);

    if (guidedActive) {
      this.elements.allPanel.innerHTML = "";
      this.elements.guidedPanel.innerHTML = this.renderGuidedExperience();
    } else {
      this.elements.guidedPanel.innerHTML = "";
      this.elements.allPanel.innerHTML = this.renderAllControlsExperience();
    }

    window.requestAnimationFrame(() => {
      if (this.elements.controlsScroll) {
        const usesMobileDocumentFlow = window.matchMedia("(max-width: 767px)").matches
          && this.elements.controlsScroll.scrollHeight <= this.elements.controlsScroll.clientHeight + 1;

        if (options.resetScroll && usesMobileDocumentFlow) {
          const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
          this.elements.controlsScroll.scrollIntoView({ behavior, block: "start" });
        } else {
          this.elements.controlsScroll.scrollTop = options.resetScroll ? 0 : this.scrollPositions[this.mode] || 0;
        }
      }
    });
  }

  renderGuidedExperience() {
    const stepIndex = getGuidedStepIndex(this.guidedStep);
    const step = GUIDED_STEPS[stepIndex];
    return `
      <div class="guided-experience" data-guided-experience>
        <div class="guided-progress-heading">
          <span>Step ${stepIndex + 1} of ${GUIDED_STEPS.length}</span>
          <strong>${step.label}</strong>
        </div>
        <header class="guided-step-heading" data-guided-heading tabindex="-1">
          <span class="section-kicker">${step.label}</span>
          <h2>${step.title}</h2>
          <p>${step.description}</p>
        </header>
        <div class="guided-step-content" data-guided-step-content="${step.id}">
          ${this.renderGuidedStepContent(step.id)}
        </div>
        <div class="guided-step-errors" data-guided-errors tabindex="-1" aria-live="polite"></div>
        <nav class="guided-navigation" aria-label="Guided setup navigation">
          <button type="button" class="guided-back" data-guided-back ${stepIndex === 0 ? "disabled" : ""}>Back</button>
          ${step.id === "review"
            ? '<button type="button" class="guided-continue is-primary" data-open-order="measurement">Request a Quote</button>'
            : `<button type="button" class="guided-continue is-primary" data-guided-continue>Continue to ${GUIDED_STEPS[stepIndex + 1].shortLabel}</button>`}
        </nav>
      </div>
    `;
  }

  renderGuidedStepContent(stepId) {
    if (stepId === "layout") {
      return this.renderStructureStartGroup();
    }
    if (stepId === "dimensions") {
      return this.renderSpaceGroup();
    }
    if (stepId === "storage") return this.renderStorageGroup();
    if (stepId === "construction") return this.renderConstructionExperience();
    if (stepId === "appearance") return this.renderAppearanceExperience();
    return `${this.renderReviewContent({ includeActions: false })}
      <section class="guided-review-service" aria-labelledby="${this.id}-guided-service-heading">
        <h3 id="${this.id}-guided-service-heading">Confirm project service</h3>
        <p>Choose the delivery and installation support included in this estimate.</p>
        ${this.renderServiceGroup()}
      </section>`;
  }

  renderAllControlsExperience() {
    return `
      <div class="all-controls-experience" data-all-controls-experience>
        <header class="all-controls-heading">
          <div><span class="section-kicker">All Controls</span><h2>Fine-tune every available detail</h2><p>Open any category and edit applicable settings directly.</p></div>
          <button type="button" data-review-design>Review Design</button>
        </header>
        <div class="configurator-accordion" data-configurator-accordion>
          ${ALL_CONTROL_CATEGORIES.map((category) => this.renderAccordionCategory(category)).join("")}
        </div>
        <div class="all-controls-secondary-actions">
          <button type="button" data-reset-design>Start over</button>
        </div>
      </div>
    `;
  }

  renderAccordionCategory(category) {
    const expanded = category.id === this.expandedCategory;
    const panelId = `${this.id}-category-${category.id}`;
    const applicability = category.id === "doors" ? "fronts" : category.id === "hardware" ? "hardware" : "";
    return `
      <section class="configurator-category" data-category="${category.id}" ${applicability ? `data-applicability="${applicability}"` : ""}>
        <h3>
          <button id="${panelId}-trigger" type="button" data-category-trigger="${category.id}" aria-expanded="${expanded}" aria-controls="${panelId}">
            <span>${escapeHtml(category.label)}<small data-category-summary="${escapeHtml(category.id)}">${escapeHtml(getCategorySummary(category.id, this.state, this.layout, this.basePresetId))}</small></span>
            <i aria-hidden="true">${expanded ? builderIcons.minus : builderIcons.plus}</i>
          </button>
        </h3>
        <div id="${panelId}" class="configurator-category-panel" data-category-panel="${category.id}" role="region" aria-labelledby="${panelId}-trigger" ${expanded ? "" : "hidden"}>
          ${this.renderCategoryContent(category.id)}
        </div>
      </section>
    `;
  }

  renderCategoryContent(categoryId) {
    if (categoryId === "layout") return this.renderLayoutCards("all");
    if (categoryId === "dimensions") return this.renderDimensionsGroup();
    if (categoryId === "section_designer") return this.renderSectionDesignerGroup();
    if (categoryId === "storage") return this.renderStorageGroup("all");
    if (categoryId === "construction") return this.renderStructureGroup();
    if (categoryId === "doors") return this.renderDoorGroup();
    if (categoryId === "finish") return this.renderFinishGroup();
    if (categoryId === "hardware") return this.renderHardwareGroup();
    if (categoryId === "lighting") return this.renderLightingGroup();
    if (categoryId === "service") return this.renderServiceGroup();
    return "";
  }

  renderLayoutCards(context = "guided") {
    const renderCards = (presets) => presets.map((preset) => {
      const index = layoutPresets.findIndex((item) => item.id === preset.id) + 1;
      return `
        <button class="layout-card" type="button" data-preset-id="${preset.id}" aria-pressed="false">
          ${this.renderPresetMini(preset, index)}
          <span class="layout-card-copy"><strong>${preset.name}</strong><small>${preset.description}</small></span>
          <span class="layout-card-check" aria-hidden="true">${builderIcons.check}</span>
        </button>
      `;
    }).join("");
    return `
      <div class="layout-card-grid is-${context}" role="group" aria-label="Bookcase layouts">${renderCards(layoutPresets)}</div>
    `;
  }

  renderStorageGroup(context = "guided") {
    return `
      <section class="control-section control-section-storage">
        ${this.renderRangeControl("shelves", "Shelves per open section", 2, 8, 1, "")}
        <div class="toggle-row premium-toggle">
          <label for="${this.id}-lowerCabinets">Lower cabinets</label>
          <label class="switch">
            <input id="${this.id}-lowerCabinets" data-field="lowerCabinets" type="checkbox">
            <span aria-hidden="true"></span>
          </label>
        </div>
        <fieldset class="choice-field" data-applicability="cabinets">
          <legend>Lower storage style</legend>
          <div class="segmented-options">
            <label><input data-field="lowerStorage" name="${this.id}-lowerStorage" type="radio" value="doors"><span>Doors</span></label>
            <label><input data-field="lowerStorage" name="${this.id}-lowerStorage" type="radio" value="drawers"><span>Drawers</span></label>
          </div>
        </fieldset>
        <div data-applicability="drawers">
          ${this.renderStepperControl("drawerCount", "Drawers per drawer section", 2, 5)}
        </div>
        ${context === "guided" ? this.renderDoorGroup() : ""}
        ${context === "guided" ? this.sectionDesignerActive ? this.renderSectionDesignerGroup() : `
          <aside class="section-designer-entry">
            <div><strong>Customize each section</strong><p>Mix doors, drawers, open shelving, and precise bay widths without changing the overall size.</p></div>
            <button type="button" data-section-designer-open>Customize each section</button>
          </aside>
        ` : ""}
      </section>
    `;
  }

  renderSectionDesignerGroup() {
    const designer = getSectionDesignerState(this.state, this.layout);
    this.selectedSectionIndex = clamp(this.selectedSectionIndex, 0, Math.max(0, designer.sections.length - 1));
    const selected = designer.sections[this.selectedSectionIndex];
    if (!this.sectionDesignerActive) {
      return `
        <section class="section-designer-intro">
          <span class="section-kicker">Premium control</span>
          <h3>Customize each section</h3>
          <p>Mix doors, drawers, open shelving, and precise clear widths while one accepted design continues to drive the model and estimate.</p>
          <button type="button" data-section-designer-open>Open Section Designer</button>
        </section>
      `;
    }
    if (!selected) return "";
    const typeLabels = {
      open: ["Open Shelves", "Full-height adjustable shelving"],
      lower_doors: ["Lower Doors", "Closed storage with shelves above"],
      drawers: ["Lower Drawers", `${this.state.drawerCount} drawers with shelves above`],
      tall_doors: ["Tall Door", "One fitted full-height door"]
    };
    const sectionComponents = this.layout.components.filter((component) => component.id.startsWith(`${selected.id}-`));
    const generated = {
      doors: sectionComponents.filter((component) => component.role === "door").length,
      drawers: sectionComponents.filter((component) => component.role === "drawer_front").length,
      handles: sectionComponents.filter((component) => component.role === "handle").length,
      shelves: sectionComponents.filter((component) => component.role === "shelf").length
    };
    const widthValue = this.sectionWidthDraft || formatSectionWidth(selected.width);
    return `
      <section class="section-designer" data-section-designer aria-label="Section Designer">
        <header class="section-designer-heading">
          <div><span class="section-kicker">Section Designer</span><h3>Section ${selected.index + 1} of ${designer.sections.length}</h3></div>
          <button type="button" data-section-designer-close aria-label="Close Section Designer">Done</button>
        </header>
        <div class="section-strip" role="listbox" aria-label="Bookcase sections">
          ${designer.sections.map((section) => `
            <button type="button" role="option" data-section-select="${section.index}" aria-selected="${section.index === selected.index}" class="section-strip-card${section.index === selected.index ? " is-selected" : ""}${section.locked ? " is-locked" : ""}">
              <span>Section ${section.index + 1}</span><strong>${formatSectionWidth(section.width)} in</strong><small>${escapeHtml(formatSectionType(section.type))}${section.locked ? " · Locked" : ""}</small>
            </button>
          `).join("")}
        </div>
        <div class="section-inspector">
          <div class="section-width-editor">
            <label for="${this.id}-section-width">Clear section width</label>
            <div class="section-width-input">
              <button type="button" data-section-width-step="-0.5" aria-label="Decrease clear width by half an inch">${builderIcons.minus}</button>
              <input id="${this.id}-section-width" data-section-width type="number" min="${designer.minimumClearWidth}" step="0.25" inputmode="decimal" value="${escapeHtml(widthValue)}" aria-describedby="${this.id}-section-width-help ${this.id}-section-width-error">
              <span>in clear</span>
              <button type="button" data-section-width-step="0.5" aria-label="Increase clear width by half an inch">${builderIcons.plus}</button>
            </div>
            <p id="${this.id}-section-width-help" class="control-helper">Overall nominal width stays ${this.state.width} in. Neighboring sections absorb accepted width changes.</p>
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
          ${selected.locked ? `<p class="section-lock-note">This section belongs to the preset’s ${escapeHtml(formatSectionType(selected.type))} zone. Change to a non-feature layout to edit its type.</p>` : ""}
          <dl class="section-generated-summary">
            <div><dt>Generated fronts</dt><dd>${generated.doors} doors · ${generated.drawers} drawers</dd></div>
            <div><dt>Hardware</dt><dd>${generated.handles} handles</dd></div>
            <div><dt>Adjustable shelves</dt><dd>${generated.shelves}</dd></div>
          </dl>
          ${selected.warnings.length ? `<div class="section-warning" role="status">${selected.warnings.map((warning) => escapeHtml(warning.message)).join(" ")}</div>` : ""}
          <div class="section-designer-actions">
            <button type="button" data-section-split ${selected.locked ? "disabled" : ""}>Duplicate / Split</button>
            <button type="button" data-section-merge="left" ${selected.index === 0 || selected.locked ? "disabled" : ""}>Merge Left</button>
            <button type="button" data-section-merge="right" ${selected.index === designer.sections.length - 1 || selected.locked ? "disabled" : ""}>Merge Right</button>
            <button type="button" data-section-equalize>Equalize Widths</button>
            <button type="button" data-section-reset>Reset to Preset</button>
            <button type="button" data-section-undo ${this.sectionUndoStack.length ? "" : "disabled"}>Undo</button>
            <button type="button" data-section-redo ${this.sectionRedoStack.length ? "" : "disabled"}>Redo</button>
          </div>
        </div>
      </section>
    `;
  }

  renderDoorGroup() {
    const descriptions = {
      shaker: "Classic framed profile",
      flat: "Clean slab front",
      slim_shaker: "Narrow framed profile",
      glass: "Framed glass display door"
    };
    const styles = doorStyleOptions.map((option) => `
      <label class="door-style-card" data-door-style="${option.value}">
        <input data-field="doorStyle" name="${this.id}-doorStyle" type="radio" value="${option.value}">
        <span class="door-style-card-content">
          <span class="door-style-illustration" aria-hidden="true">${doorPreviewIcons[option.value]}</span>
          <span class="door-style-copy"><strong>${option.label}</strong><small>${descriptions[option.value]}</small></span>
        </span>
      </label>
    `).join("");
    return `
      <section class="control-section control-section-doors" data-applicability="fronts">
        <fieldset class="choice-field" data-applicability="fronts">
          <legend>Front style</legend>
          <div class="door-style-grid">${styles}</div>
        </fieldset>
        <div class="generated-front-count" data-applicability="doors">
          <span>Generated door count</span>
          <output data-generated-door-count aria-live="polite"></output>
          <p class="control-helper">Automatically follows the actual section openings so the preview, hardware, and price always match.</p>
        </div>
      </section>
    `;
  }

  renderConstructionExperience() {
    return this.renderStructureGroup();
  }

  renderAppearanceExperience() {
    return `
      <div class="appearance-sections" aria-label="Appearance options">
        ${this.renderFinishGroup()}
        ${this.renderHardwareGroup()}
        ${this.renderLightingGroup()}
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
              <header><h3>${escapeHtml(group.title)}</h3><button type="button" data-edit-step="${escapeHtml(group.step)}">Edit</button></header>
              <dl>${group.items.map((item) => `<div><dt>${escapeHtml(item.label)}</dt><dd>${escapeHtml(item.value)}</dd></div>`).join("")}</dl>
            </section>
          `).join("")}
        </div>
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

  renderDimensionsGroup() {
    return `
      <section class="control-section control-section-dimensions">
        <h2><span class="control-heading-icon" aria-hidden="true">${builderIcons.dimensions}</span>Dimensions</h2>
        ${this.renderRangeControl("width", "Width", 24, 144, 1, "in")}
        ${this.renderRangeControl("height", "Height", 72, 120, 1, "in")}
        ${this.renderRangeControl("depth", "Depth", 10, 24, 1, "in")}
        ${this.renderRangeControl("shelves", "Shelves per section", 2, 8, 1, "")}
        ${this.renderRangeControl("shelfThickness", "Shelf thickness", 0.75, 2, 0.25, "in")}
      </section>
    `;
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
      <section class="control-section control-section-storage control-section-guided-structure">
        ${this.renderStepperControl("sections", "Vertical sections", 1, 6)}
        <p class="control-helper section-limit-helper" data-section-limit></p>
        ${this.sectionDesignerActive ? this.renderSectionDesignerGroup() : `
          <aside class="section-designer-entry">
            <div><strong>Shape each section</strong><p>Resize, split, merge, or change individual section types while the overall wall width stays fixed.</p></div>
            <button type="button" data-section-designer-open>Open Section Designer</button>
          </aside>
        `}
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
        <h2><span class="control-heading-icon" aria-hidden="true">${builderIcons.structure}</span>Construction</h2>
        ${this.renderRangeControl("shelfThickness", "Shelf thickness", 0.75, 2, 0.25, "in")}
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
          <div class="bm-search" data-custom-bm-fields ${this.showColorSearch ? "" : "hidden"}>
            <div class="bm-search-heading"><strong>Benjamin Moore Color</strong><span>Search by color name or code.</span></div>
            <label for="${this.id}-customPaintColor">Color name or code</label>
            <div class="bm-search-input">
              <input id="${this.id}-customPaintColor" data-bm-query data-validation-field="customPaintColor" type="search" maxlength="80" placeholder="OC-17, HC-154, White Dove…" autocomplete="off" aria-describedby="${this.id}-bm-help ${this.id}-bm-disclaimer">
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
    const hardware = hardwareOptions.map((option) => `
        <div class="hardware-choice" data-hardware="${option.value}">
          <input id="${this.id}-hardware-${option.value}" data-field="hardware" name="${this.id}-hardware" type="radio" value="${option.value}">
          <label for="${this.id}-hardware-${option.value}" title="${option.label}">
            <span class="hardware-choice-icon" style="--hardware-finish:${hardwareFinishSwatches[option.value]}" aria-hidden="true">${hardwarePreviewIcons[option.value]}</span>
            <span class="hardware-choice-name">${option.label}</span>
          </label>
        </div>
      `).join("");
    return `
        <section class="control-section control-section-hardware">
          <h2><span class="control-heading-icon" aria-hidden="true">${builderIcons.hardware}</span>Hardware</h2>
          <fieldset class="hardware-field" data-applicability="hardware">
            <legend class="sr-only">Hardware options</legend>
            <div class="hardware-choice-grid">${hardware}</div>
          </fieldset>
        </section>
    `;
  }

  renderLightingGroup() {
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
            <input id="${this.id}-${name}-number" data-field="${name}" type="number" min="${min}" max="${max}" step="${step}" inputmode="numeric" aria-label="${label} value">
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
      stepRail: this.host.querySelector("[data-step-rail]"),
      guidedPanel: this.host.querySelector('[data-mode-panel="guided"]'),
      allPanel: this.host.querySelector('[data-mode-panel="all"]'),
      modeDescription: this.host.querySelector("[data-mode-description]"),
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

  renderStudioEntryView(options = {}) {
    this.stopStudioPreviewMotion();
    const shell = this.elements?.shell;
    const entryCopy = shell?.querySelector(".studio-entry-copy");
    const canUpdateRouteInPlace = !this.hasAcceptedDesign
      && shell?.classList.contains("studio-entry-shell")
      && entryCopy;

    if (canUpdateRouteInPlace) {
      shell.dataset.entryView = this.entryView;
      entryCopy.innerHTML = this.renderStudioEntryCopyContent();
      entryCopy.scrollTop = 0;
      this.cacheElements();
    } else {
      this.render();
      this.cacheElements();
      this.viewer = this.createStudioIntroViewer();
    }
    this.syncStudioEntry();
    if (options.focusSelector) window.requestAnimationFrame(() => this.host.querySelector(options.focusSelector)?.focus());
  }

  startStudioPreviewMotion() {
    this.stopStudioPreviewMotion();
    if (this.hasAcceptedDesign || this.introPreviewStopped || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    this.introPreviewTimer = window.setInterval(() => {
      const previewIdeas = getStudioPreviewIdeas();
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
    this.introPreviewIndex = clamp(Number(index) || 0, 0, previewIdeas.length - 1);
    if (options.manual) this.stopStudioPreviewMotion(true);
    if (this.elements?.studioIntroPreview) this.elements.studioIntroPreview.innerHTML = this.renderStudioIntroPreview();
    this.host.querySelectorAll("[data-studio-preview-index]").forEach((button) => {
      button.setAttribute("aria-pressed", String(Number(button.dataset.studioPreviewIndex) === this.introPreviewIndex));
    });
  }

  readStudioDimensions() {
    const values = {};
    this.host.querySelectorAll("[data-studio-dimension]").forEach((input) => {
      values[input.dataset.studioDimension] = input.value;
    });
    return values;
  }

  handleStudioCustomStart() {
    const rawDimensions = this.readStudioDimensions();
    const validation = validateStudioDimensions(rawDimensions);
    this.studioDimensionIssues = [...validation.issues];
    if (!validation.valid) {
      this.studioDimensions = { ...this.studioDimensions, ...rawDimensions };
      this.renderStudioEntryView({ focusSelector: `[data-studio-dimension="${validation.issues[0].field}"]` });
      this.showStatus(validation.issues[0].message, true);
      return;
    }
    this.studioDimensions = { ...validation.dimensions };
    const selectedSections = Number(this.host.querySelector("[data-studio-sections]:checked")?.value) || suggestStudioSectionCount(validation.dimensions.width);
    this.studioSectionCount = selectedSections;
    const startingPoint = createNeutralCustomConfig({ ...validation.dimensions, sections: selectedSections });
    if (!startingPoint.accepted) {
      this.showStatus(startingPoint.issues[0]?.message || "Review the starting dimensions.", true);
      return;
    }
    this.emitStudioEvent("studio_custom_dimensions_accepted", {
      provisional: this.studioDimensionsProvisional,
      sectionCount: selectedSections
    });
    this.acceptStudioDesign(startingPoint.config, { source: "custom", guidedStep: "storage" });
  }

  acceptStudioIdea(ideaId) {
    const idea = getInspirationIdea(ideaId);
    if (!idea) return;
    this.emitStudioEvent("studio_idea_selected", {
      ideaId: idea.id,
      category: idea.category,
      fullyEditable: idea.fullyEditable
    });
    this.acceptStudioDesign(idea.config, { source: "idea", ideaId: idea.id, guidedStep: "dimensions" });
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
    this.guidedStep = normalizeGuidedStep(options.guidedStep || "dimensions");
    this.mode = CONFIGURATOR_MODES.guided;
    this.expandedCategory = normalizeAllCategory("dimensions");
    this.priceCalculationCount += 1;
    this.drafts = {};
    this.render();
    this.cacheElements();
    this.viewer = this.createViewer(this.layout);
    if (this.arEnabled) this.initializeCabinetAr();
    document.body.dataset.studioState = "accepted";
    this.renderActiveControls();
    this.syncInterface();
    this.focusCameraForCurrentContext({ duration: SMART_CAMERA_DURATION });
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
    this.arControllerPromise = import("./cabinet-ar-ui.js?v=interface-ar-20260713a")
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

  bindEvents() {
    this.host.addEventListener("submit", (event) => event.preventDefault());
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
    });
    this.host.addEventListener("pointermove", (event) => {
      this.updateSectionDividerDrag(event);
      this.updateRangeDrag(event);
    });
    this.host.addEventListener("pointerup", (event) => {
      this.endSectionDividerDrag(event);
      this.endRangeDrag(event);
    });
    this.host.addEventListener("pointercancel", (event) => {
      this.cancelSectionDividerDrag(event);
      this.endRangeDrag(event);
    });

    this.host.addEventListener("pointerover", (event) => {
      if (event.pointerType === "touch") return;
      const label = event.target.closest?.("label");
      if (!label || !this.host.contains(label) || label.contains(event.relatedTarget)) return;
      const input = label.querySelector('input[data-field]') || (label.htmlFor ? document.getElementById(label.htmlFor) : null);
      if (!input?.matches?.("input[data-field]") || !this.host.contains(input)) return;
      this.focusCameraForField(input.dataset.field);
      this.scheduleOptionPreview(label, input);
    });

    this.host.addEventListener("pointerout", (event) => {
      const label = event.target.closest?.("label");
      if (!label || !this.host.contains(label) || label.contains(event.relatedTarget)) return;
      this.endOptionPreview(label);
    });

    this.host.addEventListener("focusin", (event) => {
      const field = event.target.closest?.("[data-field], [data-validation-field]");
      if (field && this.host.contains(field)) this.focusCameraForField(field.dataset.field || field.dataset.validationField);
    });

    this.host.addEventListener("input", (event) => {
      const sectionWidth = event.target.closest?.("[data-section-width]");
      if (sectionWidth && this.host.contains(sectionWidth)) {
        this.sectionWidthDraft = sectionWidth.value;
        const error = this.host.querySelector("[data-section-width-error]");
        if (error) error.textContent = "";
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
      this.handleFieldInput(field);
    });

    this.host.addEventListener("change", (event) => {
      const sectionWidth = event.target.closest?.("[data-section-width]");
      if (sectionWidth && this.host.contains(sectionWidth)) {
        this.commitSelectedSectionWidth(sectionWidth.value);
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
      const field = event.target.closest?.("[data-field]");
      if (!field || !this.host.contains(field)) return;
      if (field.type !== "radio" && field.type !== "checkbox" && field.tagName !== "SELECT") return;
      this.handleFieldInput(field);
    });

    this.host.addEventListener("keydown", (event) => {
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
      const sectionOption = event.target.closest?.("[data-section-select]");
      if (sectionOption && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        const count = getSectionDesignerState(this.state, this.layout).sections.length;
        const current = Number(sectionOption.dataset.sectionSelect);
        const next = event.key === "Home" ? 0 : event.key === "End" ? count - 1 : clamp(current + (event.key === "ArrowRight" ? 1 : -1), 0, count - 1);
        this.selectSection(next, { focus: true });
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
      const modeButton = event.target.closest?.("[data-configurator-mode]");
      if (modeButton) {
        this.handleModeSelectorKeydown(event, modeButton);
        return;
      }
      const colorQuery = event.target.closest?.("[data-bm-query]");
      if (!colorQuery) return;
      if (event.key === "Escape") this.closeBenjaminMooreResults();
      if (event.key === "Enter") {
        event.preventDefault();
        this.applyBenjaminMooreQuery(colorQuery.value);
      }
    });

    this.host.addEventListener("click", (event) => this.handleDelegatedClick(event));

    this.elements.reviewDialog?.addEventListener("click", (event) => {
      if (event.target === this.elements.reviewDialog) this.closeReviewDialog();
    });
    this.elements.reviewDialog?.addEventListener("close", () => this.restoreReviewFocus());
    this.elements.form?.addEventListener("submit", (event) => event.preventDefault());
  }

  handleDelegatedClick(event) {
    const target = event.target;
    if (!this.hasAcceptedDesign) {
      const route = target.closest?.("[data-studio-route]");
      if (route) {
        this.stopStudioPreviewMotion(true);
        this.entryView = normalizeStudioEntryView(route.dataset.studioRoute);
        this.studioDimensionIssues = [];
        this.emitStudioEvent(this.entryView === STUDIO_ENTRY_VIEWS.custom ? "studio_custom_route_opened" : "studio_ideas_opened");
        this.renderStudioEntryView({ focusSelector: "[data-studio-back]" });
        return;
      }
      if (target.closest?.("[data-studio-back]")) {
        this.entryView = STUDIO_ENTRY_VIEWS.welcome;
        this.studioDimensionIssues = [];
        this.renderStudioEntryView({ focusSelector: "[data-studio-route]" });
        return;
      }
      if (target.closest?.("[data-studio-unsure]")) {
        this.studioDimensions = { ...STUDIO_PROVISIONAL_DIMENSIONS };
        this.studioDimensionsProvisional = true;
        this.studioDimensionIssues = [];
        this.studioSectionCount = suggestStudioSectionCount(this.studioDimensions.width);
        this.emitStudioEvent("studio_provisional_dimensions_used");
        this.renderStudioEntryView({ focusSelector: "[data-studio-dimension=\"width\"]" });
        return;
      }
      if (target.closest?.("[data-studio-create]")) {
        this.handleStudioCustomStart();
        return;
      }
      const preview = target.closest?.("[data-studio-preview-index]");
      if (preview) {
        this.setStudioPreview(Number(preview.dataset.studioPreviewIndex), { manual: true });
        this.emitStudioEvent("studio_intro_preview_changed", { previewIndex: this.introPreviewIndex });
        return;
      }
      const filter = target.closest?.("[data-idea-filter]");
      if (filter) {
        this.inspirationFilter = filter.dataset.ideaFilter;
        this.inspirationExpanded = this.inspirationFilter !== "all";
        this.emitStudioEvent("studio_ideas_filtered", { filter: this.inspirationFilter });
        this.renderStudioEntryView({ focusSelector: `[data-idea-filter="${this.inspirationFilter}"]` });
        return;
      }
      if (target.closest?.("[data-view-all-ideas]")) {
        this.inspirationExpanded = true;
        this.emitStudioEvent("studio_ideas_expanded", { visibleCount: inspirationIdeas.length });
        this.renderStudioEntryView({ focusSelector: "[data-studio-idea-grid] [data-idea-id]:nth-child(7)" });
        return;
      }
      const idea = target.closest?.("[data-idea-id]");
      if (idea) {
        this.acceptStudioIdea(idea.dataset.ideaId);
        return;
      }
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
    const modeButton = target.closest?.("[data-configurator-mode]");
    if (modeButton) {
      this.switchMode(modeButton.dataset.configuratorMode);
      return;
    }
    const guidedStep = target.closest?.("[data-guided-step]");
    if (guidedStep) {
      if (this.mode === CONFIGURATOR_MODES.guided) this.goToGuidedStep(guidedStep.dataset.guidedStep);
      else this.switchMode(CONFIGURATOR_MODES.guided, { guidedStep: guidedStep.dataset.guidedStep });
      return;
    }
    if (target.closest?.("[data-guided-back]")) {
      this.goToAdjacentGuidedStep(-1);
      return;
    }
    if (target.closest?.("[data-guided-continue]")) {
      this.goToAdjacentGuidedStep(1);
      return;
    }
    const categoryTrigger = target.closest?.("[data-category-trigger]");
    if (categoryTrigger) {
      const categoryId = categoryTrigger.dataset.categoryTrigger;
      const opening = categoryId === "section_designer" && categoryTrigger.getAttribute("aria-expanded") !== "true";
      this.toggleCategory(categoryTrigger.dataset.categoryTrigger);
      if (categoryId === "section_designer") {
        if (opening) this.activateSectionDesigner();
        else this.deactivateSectionDesigner();
      }
      return;
    }
    if (target.closest?.("[data-section-designer-open]")) {
      this.activateSectionDesigner();
      return;
    }
    if (target.closest?.("[data-section-designer-close]")) {
      this.deactivateSectionDesigner();
      return;
    }
    const sectionSelect = target.closest?.("[data-section-select]");
    if (sectionSelect) {
      this.selectSection(Number(sectionSelect.dataset.sectionSelect));
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
    const merge = target.closest?.("[data-section-merge]");
    if (merge) {
      this.commitSectionOperation(
        mergeSection(this.state, this.layout, this.selectedSectionIndex, merge.dataset.sectionMerge),
        "Sections merged."
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
      this.viewer.setView("reset");
      this.activeView = "three-quarter";
      this.syncViewButtons();
      this.syncDiagnosticsAttributes();
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
    const editButton = target.closest?.("[data-edit-step]");
    if (editButton) {
      this.closeReviewDialog();
      this.switchMode(CONFIGURATOR_MODES.guided, { guidedStep: editButton.dataset.editStep });
      this.focusGuidedHeading();
      return;
    }
    const colorSearchToggle = target.closest?.("[data-toggle-color-search]");
    if (colorSearchToggle) {
      this.showColorSearch = !this.showColorSearch;
      this.host.querySelectorAll("[data-custom-bm-fields]").forEach((panel) => {
        panel.hidden = !this.showColorSearch;
      });
      colorSearchToggle.textContent = this.showColorSearch
        ? "Close Benjamin Moore Search"
        : this.state.finish === "custom_bm" ? "Change Benjamin Moore color" : "Benjamin Moore Search";
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

  handleModeSelectorKeydown(event, button) {
    const buttons = [...this.host.querySelectorAll("[data-configurator-mode]")];
    const index = buttons.indexOf(button);
    let nextIndex = index;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % buttons.length;
    else if (event.key === "ArrowLeft") nextIndex = (index - 1 + buttons.length) % buttons.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = buttons.length - 1;
    else return;
    event.preventDefault();
    buttons[nextIndex]?.focus();
    this.switchMode(buttons[nextIndex]?.dataset.configuratorMode);
  }

  switchMode(nextMode, options = {}) {
    const normalizedMode = normalizeConfiguratorMode(nextMode);
    const previousMode = this.mode;
    const shouldOpenSharedReview = previousMode === CONFIGURATOR_MODES.guided
      && normalizedMode === CONFIGURATOR_MODES.all
      && this.guidedStep === "review"
      && !options.category;
    if (normalizedMode === CONFIGURATOR_MODES.all) {
      this.expandedCategory = normalizeAllCategory(options.category || (this.sectionDesignerActive ? "section_designer" : categoryForGuidedStep(options.guidedStep || this.guidedStep)));
      this.savePreference(CONFIGURATOR_PREFERENCE_KEYS.allCategory, this.expandedCategory);
    } else {
      this.guidedStep = normalizeGuidedStep(options.guidedStep || (this.sectionDesignerActive ? "layout" : guidedStepForCategory(this.expandedCategory)));
      this.savePreference(CONFIGURATOR_PREFERENCE_KEYS.guidedStep, this.guidedStep);
    }
    this.mode = normalizedMode;
    this.savePreference(CONFIGURATOR_PREFERENCE_KEYS.mode, this.mode);
    this.renderActiveControls({ previousMode });
    this.syncInterface();
    this.focusCameraForCurrentContext();
    if (shouldOpenSharedReview) this.openReviewDialog();
    this.showStatus(this.mode === CONFIGURATOR_MODES.guided
      ? "Guided Setup is active. Your design and preview are unchanged."
      : "All Controls is active. Your design and preview are unchanged.");
  }

  goToAdjacentGuidedStep(direction) {
    const currentIndex = getGuidedStepIndex(this.guidedStep);
    if (direction > 0 && !this.validateAndFocusStep(this.guidedStep)) return;
    const nextIndex = clamp(currentIndex + direction, 0, GUIDED_STEPS.length - 1);
    this.goToGuidedStep(GUIDED_STEPS[nextIndex].id, { skipValidation: direction < 0 });
  }

  goToGuidedStep(stepId, options = {}) {
    const nextStep = normalizeGuidedStep(stepId);
    const currentIndex = getGuidedStepIndex(this.guidedStep);
    const nextIndex = getGuidedStepIndex(nextStep);
    if (!options.skipValidation && nextIndex > currentIndex && !this.validateAndFocusStep(this.guidedStep)) return;
    if (this.sectionDesignerActive && nextStep !== "layout") this.deactivateSectionDesigner();
    this.guidedStep = nextStep;
    this.savePreference(CONFIGURATOR_PREFERENCE_KEYS.guidedStep, this.guidedStep);
    this.renderActiveControls({ previousMode: this.mode, resetScroll: true });
    this.syncInterface();
    this.focusCameraForCurrentContext();
    this.focusGuidedHeading();
  }

  focusGuidedHeading() {
    window.requestAnimationFrame(() => {
      this.host.querySelector("[data-guided-heading]")?.focus({ preventScroll: true });
    });
  }

  focusCameraForCurrentContext(options = {}) {
    if (!this.viewer?.focus) return;
    if (this.sectionDesignerActive) {
      this.setView("front");
      return;
    }
    this.cancelQueuedProfileFocus();
    const profile = this.mode === CONFIGURATOR_MODES.guided
      ? CAMERA_PROFILE_BY_GUIDED_STEP[this.guidedStep] || "overview"
      : CAMERA_PROFILE_BY_CATEGORY[this.expandedCategory] || "overview";
    this.viewer.focus(profile, options);
    this.activeView = profile === "overview" ? "three-quarter" : "custom";
    this.syncViewButtons();
    this.syncDiagnosticsAttributes();
  }

  focusCameraForField(fieldName, options = {}) {
    const profile = CAMERA_PROFILE_BY_FIELD[fieldName];
    if (!profile || !this.viewer?.focus) return;
    this.viewer.focus(profile, options);
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
    if (restore) this.viewer.restorePreview(this.state, this.layout);
    this.syncDiagnosticsAttributes();
  }

  toggleCategory(categoryId) {
    const normalized = normalizeAllCategory(categoryId);
    const currentPanel = this.host.querySelector('[data-category-panel="' + normalized + '"]');
    const wasOpen = normalized === this.expandedCategory && currentPanel?.hidden === false;
    this.expandedCategory = normalized;
    this.savePreference(CONFIGURATOR_PREFERENCE_KEYS.allCategory, normalized);
    this.host.querySelectorAll("[data-category]").forEach((category) => {
      const open = !wasOpen && category.dataset.category === normalized;
      const trigger = category.querySelector("[data-category-trigger]");
      const panel = category.querySelector("[data-category-panel]");
      trigger?.setAttribute("aria-expanded", String(open));
      const icon = trigger?.querySelector("i");
      if (icon) icon.innerHTML = open ? builderIcons.minus : builderIcons.plus;
      if (panel) panel.hidden = !open;
    });
    this.viewer.focus(wasOpen ? "overview" : CAMERA_PROFILE_BY_CATEGORY[normalized] || "overview");
    this.activeView = "custom";
    this.syncViewButtons();
    this.syncDiagnosticsAttributes();
  }

  activateSectionDesigner() {
    if (!this.sectionDesignerActive) {
      const viewState = this.viewer.getViewState?.() || null;
      this.sectionDesignerCameraState = viewState ? { ...viewState, activeView: this.activeView } : null;
      this.sectionDesignerCameraChanged = false;
    }
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
      onSelect: (index) => this.selectSection(index)
    });
    this.setView("front");
    this.renderActiveControls({ previousMode: this.mode });
    this.syncInterface();
    window.requestAnimationFrame(() => this.host.querySelector(`[data-section-select="${this.selectedSectionIndex}"]`)?.focus({ preventScroll: true }));
    this.showStatus("Section Designer is active. Clear widths are dimensions inside the cabinet panels.");
  }

  deactivateSectionDesigner() {
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
    this.renderActiveControls({ previousMode: this.mode });
    this.syncInterface();
    this.showStatus("Section Designer closed. Your accepted section design is unchanged.");
  }

  selectSection(index, options = {}) {
    const count = getSectionDesignerState(this.state, this.layout).sections.length;
    this.selectedSectionIndex = clamp(Number(index) || 0, 0, Math.max(0, count - 1));
    this.sectionWidthDraft = "";
    this.viewer.setSectionSelection?.(this.selectedSectionIndex);
    this.renderActiveControls({ previousMode: this.mode });
    this.syncInterface();
    if (options.focus) {
      window.requestAnimationFrame(() => this.host.querySelector(`[data-section-select="${this.selectedSectionIndex}"]`)?.focus({ preventScroll: true }));
    }
  }

  commitSelectedSectionWidth(value) {
    const designer = getSectionDesignerState(this.state, this.layout);
    const widthResult = setSectionClearWidth(designer.widths, this.selectedSectionIndex, Number(value), this.layout.rules);
    if (!widthResult.accepted) {
      this.showSectionDesignerError(widthResult.error);
      return;
    }
    const operation = applySectionWidths(this.state, this.layout, widthResult.widths);
    operation.affectedSections = widthResult.affectedSections;
    this.commitSectionOperation(operation, `Section ${this.selectedSectionIndex + 1} width updated.`);
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

  commitSectionOperation(operation, successMessage) {
    if (!operation?.accepted || !operation.config) {
      this.showSectionDesignerError(operation?.error || { message: "That section change is not buildable." });
      return false;
    }
    const previous = structuredClone(this.state);
    const applied = this.update(operation.config, { sourceField: "layoutMetadata", refreshSectionDesigner: false });
    if (!applied) return false;
    this.sectionUndoStack.push(previous);
    if (this.sectionUndoStack.length > 30) this.sectionUndoStack.shift();
    this.sectionRedoStack = [];
    this.selectedSectionIndex = clamp(this.selectedSectionIndex, 0, Math.max(0, this.state.sections - 1));
    this.sectionWidthDraft = "";
    this.refreshSectionDesignerPresentation();
    this.showStatus(successMessage);
    return true;
  }

  undoSectionChange() {
    const previous = this.sectionUndoStack.pop();
    if (!previous) return;
    const current = structuredClone(this.state);
    if (!this.update(previous, { sourceField: "layoutMetadata", refreshSectionDesigner: false })) {
      this.sectionUndoStack.push(previous);
      return;
    }
    this.sectionRedoStack.push(current);
    if (this.sectionRedoStack.length > 30) this.sectionRedoStack.shift();
    this.selectedSectionIndex = clamp(this.selectedSectionIndex, 0, Math.max(0, this.state.sections - 1));
    this.refreshSectionDesignerPresentation();
    this.showStatus("Section change undone.");
  }

  redoSectionChange() {
    const next = this.sectionRedoStack.pop();
    if (!next) return;
    const current = structuredClone(this.state);
    if (!this.update(next, { sourceField: "layoutMetadata", refreshSectionDesigner: false })) {
      this.sectionRedoStack.push(next);
      return;
    }
    this.sectionUndoStack.push(current);
    if (this.sectionUndoStack.length > 30) this.sectionUndoStack.shift();
    this.selectedSectionIndex = clamp(this.selectedSectionIndex, 0, Math.max(0, this.state.sections - 1));
    this.refreshSectionDesignerPresentation();
    this.showStatus("Section change redone.");
  }

  refreshSectionDesignerPresentation() {
    if (this.sectionDesignerActive) {
      this.viewer.setSectionDesigner?.({
        active: true,
        selectedIndex: this.selectedSectionIndex,
        layout: this.layout,
        onSelect: (index) => this.selectSection(index)
      });
    }
    this.renderActiveControls({ previousMode: this.mode });
    this.syncInterface();
  }

  showSectionDesignerError(error) {
    const message = error?.message || "That section change is not buildable.";
    const host = this.host.querySelector("[data-section-width-error]");
    if (host) host.textContent = message;
    this.showStatus(message, true);
  }

  beginSectionDividerDrag(event, handle) {
    if (!this.sectionDesignerActive) return;
    const overlay = handle.closest("[data-section-overlay]");
    const rect = overlay?.getBoundingClientRect();
    if (!rect?.width) return;
    this.activeSectionDividerDrag = {
      pointerId: event.pointerId,
      dividerIndex: Number(handle.dataset.sectionDivider),
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
    drag.handle.releasePointerCapture?.(event.pointerId);
    this.viewer.clearSectionDividerPreview?.();
    if (Math.abs(drag.delta) >= 0.25) this.commitSectionDividerResize(drag.dividerIndex, drag.delta);
  }

  cancelSectionDividerDrag(event) {
    if (!this.activeSectionDividerDrag || this.activeSectionDividerDrag.pointerId !== event.pointerId) return;
    this.activeSectionDividerDrag = null;
    this.viewer.clearSectionDividerPreview?.();
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
    if (this.reviewInvoker?.isConnected) this.reviewInvoker.focus();
    this.reviewInvoker = null;
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
      this.showStatus("Choose “Confirm start over” to clear this accepted design and return to the two studio starting routes.");
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
    this.viewer?.destroy?.();
    this.arController?.destroy?.();
    this.arController = null;
    this.arControllerPromise = null;
    this.hasAcceptedDesign = false;
    this.initialSource = "new";
    this.acceptedEvaluation = null;
    this.state = null;
    this.layout = null;
    this.bom = null;
    this.pricing = null;
    this.price = null;
    this.basePresetId = defaultBookcaseConfig.layoutPreset;
    this.entryView = STUDIO_ENTRY_VIEWS.welcome;
    this.inspirationFilter = "all";
    this.inspirationExpanded = false;
    this.studioDimensions = { ...STUDIO_PROVISIONAL_DIMENSIONS };
    this.studioDimensionsProvisional = false;
    this.studioDimensionIssues = [];
    this.studioSectionCount = suggestStudioSectionCount(this.studioDimensions.width);
    this.introPreviewStopped = false;
    this.drafts = {};
    this.updateCount = 0;
    this.priceCalculationCount = 0;
    this.saveActionCount = 0;
    this.quoteActionCount = 0;
    this.sectionDesignerActive = false;
    this.sectionUndoStack = [];
    this.sectionRedoStack = [];
    this.render();
    this.cacheElements();
    this.viewer = this.createStudioIntroViewer();
    this.syncStudioEntry();
    this.emitStudioEvent("studio_start_over", { source: "accepted-design" });
    this.showStatus("Accepted design cleared. Choose how you want to begin again.");
    window.requestAnimationFrame(() => this.host.querySelector("[data-studio-route]")?.focus());
  }

  clearResetConfirmation() {
    window.clearTimeout(this.resetConfirmationTimer);
    this.resetConfirmationTimer = 0;
    this.resetConfirmationExpires = 0;
    this.host.querySelectorAll("[data-reset-design]").forEach((button) => {
      button.textContent = "Start over";
    });
  }

  validateAndFocusStep(stepId) {
    const result = validateGuidedStep(stepId, this.state, this.layout, this.drafts);
    this.syncValidationMessages(result);
    if (result.valid) return true;
    const issue = result.issues[0];
    this.showStatus(issue.message, true);
    const field = this.host.querySelector('[data-field="' + issue.field + '"], [data-validation-field="' + issue.field + '"]');
    (field || this.host.querySelector("[data-guided-errors]"))?.focus?.();
    return false;
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
    const issues = validateGuidedStep("review", this.state, this.layout, this.drafts).issues;
    const issue = issues[0] || { field: "configuration", message: "Review the highlighted configuration issue first." };
    const targetStep = guidedStepForField(issue.field);
    if (this.mode === CONFIGURATOR_MODES.guided) this.goToGuidedStep(targetStep, { skipValidation: true });
    else {
      this.expandedCategory = categoryForField(issue.field);
      this.renderActiveControls({ previousMode: this.mode });
      this.syncInterface();
    }
    this.showStatus(issue.message, true);
    return false;
  }

  beginRangeDrag(event, range) {
    if (event.button != null && event.button !== 0) return;
    this.activeRangeDrag = { range, pointerId: event.pointerId };
    range.focus({ preventScroll: true });
    range.setPointerCapture?.(event.pointerId);
    this.applyRangePointerValue(event, range);
    event.preventDefault();
  }

  updateRangeDrag(event) {
    if (!this.activeRangeDrag || event.pointerId !== this.activeRangeDrag.pointerId) return;
    this.applyRangePointerValue(event, this.activeRangeDrag.range);
    event.preventDefault();
  }

  endRangeDrag(event) {
    if (!this.activeRangeDrag) return;
    const { range, pointerId } = this.activeRangeDrag;
    if (!event || event.pointerId === pointerId) {
      range.releasePointerCapture?.(pointerId);
      this.activeRangeDrag = null;
    }
  }

  applyRangePointerValue(event, range) {
    const rect = range.getBoundingClientRect();
    const min = Number(range.min);
    const max = Number(range.max);
    const step = Number(range.step) || 1;
    const ratio = clamp((event.clientX - rect.left) / Math.max(rect.width, 1), 0, 1);
    const rawValue = min + ratio * (max - min);
    const steppedValue = min + Math.round((rawValue - min) / step) * step;
    const value = clamp(steppedValue, min, max);
    range.value = String(value);
    delete this.drafts[range.dataset.field];
    this.update({ ...this.state, [range.dataset.field]: value }, { sourceField: range.dataset.field });
  }

  setView(view) {
    this.cancelQueuedProfileFocus();
    this.viewer.setView(view);
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
    this.sectionUndoStack = [];
    this.sectionRedoStack = [];
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
      const matches = await this.colorCatalog.search(normalizedQuery, { limit: 12 });
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
      "crownStyle",
      "baseStyle",
      "layoutMetadata"
    ];
    const signature = JSON.stringify(keys.map((key) => config[key]));
    return layoutPresets.find((preset) => JSON.stringify(keys.map((key) => preset.config[key])) === signature)?.id || "custom";
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
    const next = { ...this.state, [fieldName]: value };
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
    this.update(next, { sourceField: fieldName });
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

    const rendered = this.viewer.update(state, evaluation.layout);
    if (rendered === false) {
      this.syncInterface();
      const renderMessage = this.viewer.lastRenderAudit?.issues?.[0]?.message ||
        "The 3D renderer rejected this configuration and kept the last verified model.";
      this.showStatus(renderMessage, true);
      return false;
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
    if (changedFields.some((field) => ["finish", "customPaintColor", "customPaintCode", "customPaintHex", "paintSelection"].includes(field))) {
      this.renderActiveControls({ previousMode: this.mode });
    }
    this.syncInterface();
    if (this.sectionDesignerActive && options.refreshSectionDesigner !== false) {
      this.viewer.setSectionDesigner?.({
        active: true,
        selectedIndex: this.selectedSectionIndex,
        layout: this.layout,
        onSelect: (index) => this.selectSection(index)
      });
      this.renderActiveControls({ previousMode: this.mode });
      this.syncInterface();
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
    this.elements.shell.dataset.interfaceMode = this.mode;
    this.elements.shell.classList.toggle("is-guided-mode", this.mode === CONFIGURATOR_MODES.guided);
    this.elements.shell.classList.toggle("is-all-controls-mode", this.mode === CONFIGURATOR_MODES.all);
    this.elements.shell.classList.toggle("is-review-context", this.mode === CONFIGURATOR_MODES.all || this.guidedStep === "review");
    this.syncStepRail();
    this.host.querySelectorAll("[data-configurator-mode]").forEach((button) => {
      const active = button.dataset.configuratorMode === this.mode;
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
      button.classList.toggle("is-active", active);
    });
    if (this.elements.modeDescription) {
      this.elements.modeDescription.textContent = this.mode === CONFIGURATOR_MODES.guided
        ? "Build your bookcase one step at a time."
        : "View and edit all available settings.";
    }
    this.syncReviewContent();
    this.syncControls();
    this.renderDoorOptions();
    this.syncApplicability();
    this.syncPresetCards();
    this.updatePriceAndSummary();
    this.syncCategorySummaries();
    this.syncValidationMessages();
    this.syncActionAvailability();
    this.syncDiagnosticsAttributes();
  }

  syncStepRail() {
    const stepIndex = getGuidedStepIndex(this.guidedStep);
    this.host.querySelectorAll("[data-step-rail-item]").forEach((item, index) => {
      const button = item.querySelector("button[data-guided-step]");
      const marker = button?.querySelector("span");
      const complete = index < stepIndex;
      const current = index === stepIndex;
      item.classList.toggle("is-complete", complete);
      item.classList.toggle("is-current", current);
      if (button) {
        button.toggleAttribute("aria-current", current);
        if (current) button.setAttribute("aria-current", "step");
      }
      if (marker) marker.innerHTML = complete ? builderIcons.check : String(index + 1);
    });
  }

  syncDiagnosticsAttributes() {
    const shell = this.elements?.shell;
    if (!shell) return;
    if (!this.hasAcceptedDesign) {
      this.syncStudioEntry();
      return;
    }
    const viewer = this.viewer?.getDiagnostics?.() || {};
    const view = this.viewer?.getViewState?.() || {};
    shell.dataset.diagnosticMode = this.mode;
    shell.dataset.diagnosticGuidedStep = this.guidedStep;
    shell.dataset.diagnosticCategory = this.expandedCategory;
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
    shell.dataset.diagnosticCameraFocus = String(viewer.activeFocus ?? "overview");
    shell.dataset.diagnosticCameraTransition = String(Boolean(viewer.cameraTransitionActive));
    shell.dataset.diagnosticCameraSequence = String(viewer.cameraTransitionSequence ?? 0);
    shell.dataset.diagnosticCameraCancellations = String(viewer.cameraTransitionCancellations ?? 0);
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
      element.textContent = getCategorySummary(element.dataset.categorySummary, this.state, this.layout, this.basePresetId);
    });
  }

  syncReviewContent() {
    if (this.elements.reviewDialogContent) {
      this.elements.reviewDialogContent.innerHTML = this.renderReviewContent({ includeActions: true });
    }
    if (this.mode === CONFIGURATOR_MODES.guided && this.guidedStep === "review") {
      const guidedContent = this.elements.guidedPanel?.querySelector('[data-guided-step-content="review"]');
      if (guidedContent) guidedContent.innerHTML = this.renderGuidedStepContent("review");
    }
  }

  syncValidationMessages(result = null) {
    const validation = result || (this.mode === CONFIGURATOR_MODES.guided
      ? validateGuidedStep(this.guidedStep, this.state, this.layout, this.drafts)
      : validateGuidedStep("review", this.state, this.layout, this.drafts));
    this.host.querySelectorAll("[data-field], [data-validation-field]").forEach((field) => {
      field.removeAttribute("aria-invalid");
      field.removeAttribute("aria-describedby");
    });
    this.host.querySelectorAll("[data-field-error]").forEach((element) => {
      element.textContent = "";
    });
    validation.issues.forEach((issue) => {
      const errorId = this.id + "-error-" + issue.field;
      this.host.querySelectorAll('[data-field="' + issue.field + '"], [data-validation-field="' + issue.field + '"]').forEach((field) => {
        field.setAttribute("aria-invalid", "true");
        field.setAttribute("aria-describedby", errorId);
      });
      const error = this.host.querySelector('[data-field-error="' + issue.field + '"]');
      if (error) {
        error.id = errorId;
        error.textContent = issue.message;
      }
    });
    const errorHost = this.host.querySelector("[data-guided-errors]");
    if (errorHost) {
      errorHost.innerHTML = validation.issues.length
        ? `<p>${validation.issues.map((issue) => escapeHtml(issue.message)).join(" ")}</p>`
        : "";
    }
    const invalidFields = new Set(validation.issues.map((issue) => issue.field));
    this.host.querySelectorAll("[data-category]").forEach((category) => {
      const registryFields = {
        dimensions: ["width", "height", "depth", "shelves", "shelfThickness"],
        storage: ["sections", "lowerCabinets", "lowerStorage", "drawerCount", "doorStyle", "doorCount"],
        construction: ["baseStyle", "crownStyle"],
        doors: ["doorStyle", "doorCount"],
        finish: ["finish", "customPaintColor", "customPaintCode", "customPaintHex"]
      }[category.dataset.category] || [];
      category.classList.toggle("needs-attention", registryFields.some((field) => invalidFields.has(field)));
    });
  }

  syncActionAvailability() {
    const validation = validateGuidedStep("review", this.state, this.layout, this.drafts);
    const blocking = !validation.valid;
    const now = Date.now();
    const saveLocked = !shouldRunAction(this.actionStartedAt.save, now);
    const quoteLocked = !shouldRunAction(this.actionStartedAt.quote, now);
    const actionHint = this.host.querySelector("[data-action-hint]");
    if (actionHint) {
      actionHint.textContent = blocking
        ? `${validation.issues[0]?.message || "Review the highlighted configuration issue."} Complete the highlighted field before reviewing, saving, or requesting a quote.`
        : "Final pricing is confirmed after measurements and project details are verified.";
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
      mode: this.mode,
      guidedStep: this.guidedStep,
      expandedCategory: this.expandedCategory,
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
    const hardwareSummary = getCategorySummary("hardware", this.state, this.layout, this.basePresetId);
    const lightingSummary = getCategorySummary("lighting", this.state, this.layout, this.basePresetId);
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
    window.location.assign(createQuoteUrl(design.id));
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
    this.destroyed = false;
    this.controlAbortController = new AbortController();
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
    this.sectionOverlay = document.createElement("div");
    this.sectionOverlay.className = "section-designer-overlay";
    this.sectionOverlay.dataset.sectionOverlay = "";
    this.sectionOverlay.hidden = true;
    this.root.appendChild(this.sectionOverlay);
    this.sectionRaycaster = new THREE.Raycaster();
    this.sectionPointer = new THREE.Vector2();
    this.sectionDesigner = { active: false, selectedIndex: 0, onSelect: null, layout: null };
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
    this.focusTargetCache = new Map();
    this.focusRadius = this.baseRadius;
    this.reducedMotionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)") || null;
    this.environmentLights = [];
    this.environmentLightScale = 1;
    this.highlightState = null;
    this.drag = null;
    this.model = new THREE.Group();
    this.scene.add(this.model);
    this.setupEnvironment();
    this.bindControls();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.root);
    this.resize();
    if (!this.update(this.state, initialLayout, ["initial"])) {
      throw new Error("The initial 3D model failed the descriptor render contract.");
    }
    this.animate();
  }

  setupEnvironment() {
    this.scene.fog = new THREE.FogExp2(0x302b26, 0.006);
    const hemisphere = new THREE.HemisphereLight(0xf7f1e8, 0x2b2824, 1.7);
    this.scene.add(hemisphere);

    const key = new THREE.DirectionalLight(0xf7ecdf, 3.15);
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

    const fill = new THREE.DirectionalLight(0xeee6db, 0.92);
    fill.position.set(-6, 4.6, 5.4);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0xdccfc0, 0.58);
    rim.position.set(-4.8, 5.8, -4.6);
    this.scene.add(rim);

    const leftGlow = new THREE.PointLight(0xe8dccb, 0.22, 18);
    leftGlow.position.set(-7.2, 4.2, 2.7);
    this.scene.add(leftGlow);

    const rightGlow = new THREE.PointLight(0xe8dccb, 0.2, 18);
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
    contact.rotation.x = -Math.PI / 2;
    contact.position.set(0, -0.025, 0.12);
    this.scene.add(contact);

  }

  bindControls() {
    const signal = this.controlAbortController.signal;
    this.root.addEventListener("pointerdown", (event) => {
      if (event.target.closest?.("[data-section-overlay]")) return;
      this.cancelCameraTransition();
      this.drag = { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false };
      this.root.setPointerCapture(event.pointerId);
      this.root.classList.add("is-dragging");
    }, { signal });

    this.root.addEventListener("pointermove", (event) => {
      if (!this.drag) return;
      const dx = event.clientX - this.drag.x;
      const dy = event.clientY - this.drag.y;
      const moved = this.drag.moved || Math.hypot(event.clientX - this.drag.startX, event.clientY - this.drag.startY) > 5;
      this.drag = { ...this.drag, x: event.clientX, y: event.clientY, moved };
      this.theta -= dx * 0.007;
      this.phi = clamp(this.phi + dy * 0.004, -0.12, 0.72);
      this.onCameraInteraction("rotate");
      this.updateCamera();
    }, { signal });

    this.root.addEventListener("pointerup", (event) => {
      const selectSection = this.sectionDesigner.active && this.drag && !this.drag.moved;
      this.drag = null;
      if (this.root.hasPointerCapture(event.pointerId)) this.root.releasePointerCapture(event.pointerId);
      this.root.classList.remove("is-dragging");
      if (selectSection) this.selectSectionFromPointer(event);
    }, { signal });

    this.root.addEventListener("pointercancel", () => {
      this.drag = null;
      this.root.classList.remove("is-dragging");
    }, { signal });

    this.root.addEventListener("wheel", (event) => {
      if (event.ctrlKey || event.metaKey) return;
      if (window.matchMedia("(max-width: 1280px)").matches) return;
      event.preventDefault();
      this.cancelCameraTransition();
      const limits = this.getZoomLimits();
      this.radius = clamp(this.radius + event.deltaY * 0.008, limits.min, limits.max);
      this.onCameraInteraction("zoom");
      this.updateCamera();
    }, { passive: false, signal });

    this.root.addEventListener("keydown", (event) => {
      if (event.ctrlKey || event.metaKey) return;
      this.cancelCameraTransition();
      const limits = this.getZoomLimits();
      if (event.key === "ArrowLeft") this.theta -= 0.12;
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

  setView(view) {
    let theta = -0.14;
    let phi = 0.12;
    if (view === "front") {
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
    }, { duration: SMART_CAMERA_DURATION });
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
    if (!container) return { width, height, insets };

    const overlays = container.querySelectorAll([
      ".configurator-experience-toolbar",
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
      const touchesTop = intersection.top <= rootRect.top + edgeTolerance;
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
    return { width, height, insets };
  }

  focus(profileKey = "overview", options = {}) {
    const normalizedKey = SMART_CAMERA_PROFILES[profileKey] ? profileKey : "overview";
    const focusVariant = normalizedKey === "lighting"
      ? `${normalizedKey}:${this.state.lighting}`
      : normalizedKey;
    const profile = SMART_CAMERA_PROFILES[normalizedKey];
    const pose = this.getFocusPose(normalizedKey, profile);
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
    this.animateToCameraPose(pose, { duration: options.duration ?? SMART_CAMERA_DURATION });
  }

  getFocusPose(profileKey, profile) {
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
    const cacheKey = `${profileKey}:${profileKey === "lighting" ? this.state.lighting : "default"}:${this.rebuildCount}:${Number(this.camera.aspect || 1).toFixed(3)}:${viewportKey}`;
    const cached = this.focusTargetCache.get(cacheKey);
    if (cached) {
      return {
        ...cached,
        target: cached.target.clone(),
        activeRoles: [...cached.activeRoles]
      };
    }

    const result = this.getFocusBounds(resolvedProfile);
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
    const size = bounds.getSize(new THREE.Vector3());
    const target = bounds.getCenter(new THREE.Vector3());
    const modelSize = new THREE.Box3().setFromObject(this.model).getSize(new THREE.Vector3());
    target.y += modelSize.y * (resolvedProfile.targetModelYOffset || 0);
    target.z += modelSize.z * (resolvedProfile.targetModelZOffset || 0);
    const verticalFov = THREE.MathUtils.degToRad(this.camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(this.camera.aspect || 1, 0.3));
    const fitDistance = Math.max(
      size.y / Math.max(2 * Math.tan(verticalFov / 2), 0.01),
      size.x / Math.max(2 * Math.tan(horizontalFov / 2), 0.01)
    ) * 1.14 + size.z * 0.48;
    const desiredRadius = Math.max(this.baseRadius * resolvedProfile.radiusScale, fitDistance);
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

  getFocusBounds(profile) {
    const modelBounds = new THREE.Box3().setFromObject(this.model);
    const modelCenter = modelBounds.getCenter(new THREE.Vector3());
    const modelSize = modelBounds.getSize(new THREE.Vector3());
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
    const endTheta = this.theta + shortestAngleDelta(this.theta, pose.theta);
    const requestedDuration = Number(options.duration ?? SMART_CAMERA_DURATION);
    const duration = resolveCameraTransitionDuration(requestedDuration, this.reducedMotionQuery?.matches);
    if (duration === 0) {
      if (this.cameraTransition) this.cameraTransitionCancellationCount += 1;
      this.cameraTransition = null;
      this.applyCameraPose({ ...pose, theta: endTheta });
      this.onCameraInteraction("focus-complete");
      return;
    }
    if (this.cameraTransition) this.cameraTransitionCancellationCount += 1;
    this.cameraTransition = {
      sequence: ++this.cameraTransitionSequence,
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
      this.onCameraInteraction("focus-complete");
    }
  }

  cancelCameraTransition() {
    if (this.cameraTransition) this.cameraTransitionCancellationCount += 1;
    this.cameraTransition = null;
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
  }

  setProductLightingBoost(scale = 1) {
    const environment = new Set(this.environmentLights);
    this.model?.traverse((child) => {
      if (!child.isLight || environment.has(child) || !child.userData?.productLight) return;
      if (!Number.isFinite(child.userData.smartFocusBaseIntensity)) child.userData.smartFocusBaseIntensity = child.intensity;
      child.intensity = child.userData.smartFocusBaseIntensity * scale;
    });
  }

  refreshComponentHighlight() {
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
      this.clearSectionInteractionLayer();
      this.sectionOverlay.hidden = true;
      this.sectionOverlay.innerHTML = "";
      return;
    }
    this.refreshSectionInteractionLayer(this.sectionDesigner.layout || this.lastLayout);
  }

  setSectionSelection(index) {
    this.sectionDesigner.selectedIndex = Number(index) || 0;
    this.sectionInteractionLayer.children.forEach((mesh) => {
      const selected = mesh.userData.sectionIndex === this.sectionDesigner.selectedIndex;
      mesh.material.opacity = selected ? 0.15 : 0.012;
      mesh.material.color.setHex(selected ? 0xb88a52 : 0xd8c4a8);
    });
    this.sectionOverlay.querySelectorAll("[data-overlay-section]").forEach((label) => {
      label.classList.toggle("is-selected", Number(label.dataset.overlaySection) === this.sectionDesigner.selectedIndex);
    });
  }

  refreshSectionInteractionLayer(layout) {
    this.clearSectionInteractionLayer();
    if (!this.sectionDesigner.active || !layout) return;
    this.sectionDesigner.layout = layout;
    const sections = layout.components
      .filter((component) => component.role === "section")
      .sort((left, right) => Number(left.metadata?.index) - Number(right.metadata?.index));
    for (const section of sections) {
      const size = [inchesToUnits(section.size.x), inchesToUnits(section.size.y), inchesToUnits(section.size.z)];
      const material = new THREE.MeshBasicMaterial({
        color: section.metadata.index === this.sectionDesigner.selectedIndex ? 0xb88a52 : 0xd8c4a8,
        transparent: true,
        opacity: section.metadata.index === this.sectionDesigner.selectedIndex ? 0.15 : 0.012,
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
  }

  clearSectionInteractionLayer() {
    while (this.sectionInteractionLayer.children.length) {
      const child = this.sectionInteractionLayer.children[this.sectionInteractionLayer.children.length - 1];
      this.sectionInteractionLayer.remove(child);
      child.geometry?.dispose();
      child.material?.dispose();
    }
  }

  renderSectionOverlay(layout, previewWidths = null) {
    if (!this.sectionDesigner.active || !layout) return;
    const sections = layout.components
      .filter((component) => component.role === "section")
      .sort((left, right) => Number(left.metadata?.index) - Number(right.metadata?.index));
    const root = layout.components.find((component) => component.id === "bookcase");
    if (!root || !sections.length) return;
    const overall = layout.metrics.overallWidth;
    const widths = previewWidths || layout.metrics.sectionClearWidths;
    const leftEdge = root.bounds.min.x;
    const labels = sections.map((section, index) => {
      const left = (section.bounds.min.x - leftEdge) / overall * 100;
      const width = section.size.x / overall * 100;
      return `<span class="section-dimension${index === this.sectionDesigner.selectedIndex ? " is-selected" : ""}" data-overlay-section="${index}" style="--section-left:${left}%;--section-width:${width}%"><strong>${formatSectionWidth(widths[index])} in</strong><small>clear</small></span>`;
    }).join("");
    const handles = sections.slice(0, -1).map((section, index) => {
      const boundary = (section.bounds.max.x - leftEdge + layout.rules.panelThickness / 2) / overall * 100;
      return `<button type="button" class="section-divider-handle" data-section-divider="${index}" style="--divider-left:${boundary}%" aria-label="Resize divider between Sections ${index + 1} and ${index + 2}"><span aria-hidden="true"></span></button>`;
    }).join("");
    this.sectionOverlay.hidden = false;
    this.sectionOverlay.innerHTML = `<div class="overall-dimension"><span>${formatSectionWidth(overall)} in overall nominal width</span></div><div class="section-dimension-track">${labels}${handles}</div>`;
  }

  previewSectionDivider(dividerIndex, delta, result = null) {
    if (!this.sectionDesigner.active) return;
    if (result?.accepted) this.renderSectionOverlay(this.sectionDesigner.layout || this.lastLayout, result.widths);
    const handle = this.sectionOverlay.querySelector(`[data-section-divider="${dividerIndex}"]`);
    if (handle) {
      handle.dataset.previewDelta = `${delta > 0 ? "+" : ""}${formatSectionWidth(delta)} in`;
      handle.classList.toggle("is-invalid", result?.accepted === false);
    }
  }

  clearSectionDividerPreview() {
    this.renderSectionOverlay(this.sectionDesigner.layout || this.lastLayout);
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

  restoreCameraState(snapshot) {
    if (!snapshot) return;
    this.cancelCameraTransition();
    this.theta = Number(snapshot.theta) || 0;
    this.phi = Number(snapshot.phi) || 0;
    this.baseRadius = Number(snapshot.baseRadius) || this.baseRadius;
    this.radius = Number(snapshot.radius) || this.baseRadius;
    this.target.set(
      Number(snapshot.target?.x) || 0,
      Number(snapshot.target?.y) || 0,
      Number(snapshot.target?.z) || 0
    );
    this.activeFocusKey = snapshot.focus || "overview";
    this.setEnvironmentLightScale(Number(snapshot.environmentScale) || 1);
    this.renderer.toneMappingExposure = Number(snapshot.exposure) || 1.08;
    this.updateCamera();
  }

  resize() {
    const rect = this.root.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    if (this.model?.children?.length) this.frameModel(true, this.activeFocusKey !== "overview");
  }

  update(nextState, precomputedLayout = null, changedFields = null) {
    const previousState = this.state;
    const candidateState = normalizeBookcaseConfig(nextState);
    const changes = Array.isArray(changedFields) ? changedFields : getChangedConfigFields(previousState, candidateState);

    if (this.model?.children?.length && this.applyPartialUpdate(previousState, candidateState, changes)) {
      this.state = candidateState;
      this.updateCount += 1;
      this.partialUpdateCount += 1;
      return true;
    }

    const hadModel = Boolean(this.model?.children?.length);
    const rebuilt = this.rebuildModel(candidateState, precomputedLayout);
    if (!rebuilt) return false;
    this.state = candidateState;
    this.updateCount += 1;
    this.frameModel(true, hadModel);
    return true;
  }

  preview(nextState, precomputedLayout, sourceField) {
    this.previewActive = true;
    this.previewCount += 1;
    this.update(nextState, precomputedLayout, [sourceField]);
  }

  restorePreview(canonicalState, canonicalLayout) {
    if (!this.previewActive) return;
    const changedFields = getChangedConfigFields(this.state, canonicalState);
    this.previewActive = false;
    this.update(canonicalState, canonicalLayout, changedFields);
  }

  applyPartialUpdate(previousState, nextState, changedFields) {
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
  }

  applyHardwareMaterial(hardware) {
    const material = this.model.userData.materials?.hardware;
    if (!material) return;
    const color = getHardwareMaterialColor(hardware);
    const isBlack = hardware.startsWith("matte_black");
    const isNickel = hardware.startsWith("polished_nickel");
    material.color.setHex(color);
    material.roughness = isBlack ? 0.62 : isNickel ? 0.26 : 0.34;
    material.metalness = isBlack ? 0.2 : 0.84;
    material.needsUpdate = true;
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
  }

  frameModel(preserveZoom = true, transition = false) {
    if (!this.model?.children?.length) return;
    const previousRatio = preserveZoom && this.baseRadius > 0 && this.radius > 0
      ? this.radius / this.baseRadius
      : 1;
    const bounds = new THREE.Box3().setFromObject(this.model);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const verticalFov = THREE.MathUtils.degToRad(this.camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(this.camera.aspect || 1, 0.3));
    const heightDistance = size.y / (2 * Math.tan(verticalFov / 2));
    const widthDistance = size.x / (2 * Math.tan(horizontalFov / 2));
    const depthAllowance = size.z * 0.58;
    const compactAspect = (this.camera.aspect || 1) < 0.85;
    this.baseRadius = Math.max(heightDistance, widthDistance) * (compactAspect ? 1.28 : 1.21) + depthAllowance;
    this.overviewTarget.set(center.x, center.y + size.y * (compactAspect ? 0.01 : -0.025), center.z);
    const ratio = clamp(previousRatio || 1, 0.84, 1.48);
    this.focusTargetCache.clear();
    if (transition) {
      const duration = isProfileCameraKey(this.activeFocusKey) ? PROFILE_CAMERA_DURATION : 480;
      this.focus(this.activeFocusKey || "overview", { duration, force: true });
    } else {
      this.target.copy(this.overviewTarget);
      this.radius = this.baseRadius * ratio;
      this.updateCamera();
    }
  }

  rebuildModel(nextState, precomputedLayout = null) {
    this.clearComponentHighlight();
    const nextModel = buildBookcaseModel(nextState, precomputedLayout);
    this.lastLayout = nextModel.userData.layout;
    this.lastRenderAudit = nextModel.userData.renderAudit;
    const layoutValid = Boolean(this.lastLayout?.validation?.valid);
    const renderValid = Boolean(this.lastRenderAudit?.valid);
    if (!layoutValid || !renderValid) {
      this.root.dataset.renderValid = "false";
      if (this.lastRenderAudit?.issues?.length) {
        console.error("JQ Bookcases render contract rejected a model", this.lastRenderAudit.issues);
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
    if (this.sectionDesigner.active) this.refreshSectionInteractionLayer(this.lastLayout);
    this.rebuildCount += 1;
    this.focusTargetCache.clear();
    this.root.dataset.renderValid = "true";
    this.root.dataset.renderComponents = String(this.lastRenderAudit.renderedCount || 0);
    this.root.dataset.renderExpected = String(this.lastRenderAudit.expectedCount || 0);
    return true;
  }

  updateCamera() {
    const horizontal = Math.cos(this.phi) * this.radius;
    this.camera.position.set(
      this.target.x + Math.sin(this.theta) * horizontal,
      this.target.y + Math.sin(this.phi) * this.radius,
      this.target.z + Math.cos(this.theta) * horizontal
    );
    this.camera.lookAt(this.target);
  }

  animate(now = performance.now()) {
    if (this.destroyed) return;
    this.updateCameraTransition(now);
    this.renderer.render(this.scene, this.camera);
    const memory = this.renderer.info.memory;
    const render = this.renderer.info.render;
    this.root.dataset.webglGeometries = String(memory.geometries || 0);
    this.root.dataset.webglTextures = String(memory.textures || 0);
    this.root.dataset.webglCalls = String(render.calls || 0);
    this.root.dataset.webglTriangles = String(render.triangles || 0);
    this.animationFrame = window.requestAnimationFrame((time) => this.animate(time));
  }

  getViewState() {
    return {
      theta: this.theta,
      phi: this.phi,
      radius: this.radius,
      baseRadius: this.baseRadius,
      focus: this.activeFocusKey,
      transitioning: Boolean(this.cameraTransition),
      environmentScale: this.environmentLightScale,
      exposure: this.renderer.toneMappingExposure,
      target: { x: this.target.x, y: this.target.y, z: this.target.z },
      position: { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z }
    };
  }

  getDiagnostics() {
    return {
      instanceId: this.instanceId,
      updateCount: this.updateCount,
      rebuildCount: this.rebuildCount,
      partialUpdateCount: this.partialUpdateCount,
      previewCount: this.previewCount,
      previewActive: this.previewActive,
      activeFocus: this.activeFocusKey,
      cameraTransitionActive: Boolean(this.cameraTransition),
      cameraTransitionSequence: this.cameraTransitionSequence,
      cameraTransitionCancellations: this.cameraTransitionCancellationCount,
      controlsEnabled: !this.destroyed,
      reducedMotion: Boolean(this.reducedMotionQuery?.matches),
      canvasConnected: Boolean(this.renderer.domElement?.isConnected),
      renderAudit: this.lastRenderAudit,
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
    window.cancelAnimationFrame(this.animationFrame);
    this.resizeObserver?.disconnect();
    this.scene.remove(this.model);
    this.clearSectionInteractionLayer();
    this.sectionOverlay?.remove();
    disposeMaterialSet(this.model?.userData?.materials);
    disposeObject(this.model);
    disposeObject(this.scene);
    this.scene.clear();
    this.renderer.renderLists?.dispose();
    this.renderer.dispose();
    this.renderer.domElement?.remove();
  }
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
  const logicalRoles = new Set(["assembly", "section", "section_group"]);
  const componentGroups = new Map();
  componentGroups.set("bookcase", group);

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

  if (component.role === "opening") {
    renderLayoutOpening(componentGroup, component, materials, size, position, bookcaseDepth);
    return;
  }
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

  const material = getLayoutMaterial(component, materials);
  const showEdges = !["trim", "crown", "base"].includes(component.role);
  addBox(componentGroup, size, position, material, showEdges);
}

function getLayoutMaterial(component, materials) {
  if (component.role === "back_panel") return materials.back;
  if (component.metadata?.purpose === "recess") return materials.shadow;
  return materials.case;
}

function renderDescriptorDoor(group, component, config, materials, size, position) {
  const [width, height, depth] = size;
  const [x, y, z] = position;
  const style = component.role === "drawer_front"
    ? "flat"
    : component.metadata?.style || config.doorStyle;

  if (style === "flat") {
    addBox(group, size, position, materials.case);
    return;
  }

  const rail = clamp(
    style === "slim_shaker" ? Math.min(width, height) * 0.065 : Math.min(width, height) * 0.095,
    Math.min(width, height) * 0.04,
    Math.min(width, height) * 0.22
  );
  const backingDepth = depth * 0.46;
  const faceDepth = depth - backingDepth;
  const backZ = z - depth / 2 + backingDepth / 2;
  const faceZ = z + depth / 2 - faceDepth / 2;
  const centerWidth = Math.max(width - rail * 2, width * 0.25);
  const centerHeight = Math.max(height - rail * 2, height * 0.25);

  addBox(
    group,
    [width, height, backingDepth],
    [x, y, backZ],
    style === "glass" ? materials.glass : materials.inset,
    false
  );
  addBox(group, [width, rail, faceDepth], [x, y + height / 2 - rail / 2, faceZ], materials.case, false);
  addBox(group, [width, rail, faceDepth], [x, y - height / 2 + rail / 2, faceZ], materials.case, false);
  addBox(group, [rail, centerHeight, faceDepth], [x - width / 2 + rail / 2, y, faceZ], materials.case, false);
  addBox(group, [rail, centerHeight, faceDepth], [x + width / 2 - rail / 2, y, faceZ], materials.case, false);

  if (style !== "glass") {
    const panelDepth = Math.min(faceDepth * 0.48, depth * 0.28);
    addBox(
      group,
      [centerWidth, centerHeight, panelDepth],
      [x, y, z + depth / 2 - faceDepth + panelDepth / 2],
      materials.inset,
      false
    );
  }
}

function renderDescriptorHandle(group, component, config, materials, size, position) {
  const hardwareType = component.metadata?.hardware || config.hardware;
  if (hardwareType === "push_latch") return;
  const orientation = component.metadata?.orientation || (size[0] > size[1] ? "horizontal" : "vertical");
  const isPull = hardwareType.endsWith("_pull");

  if (isPull) {
    const horizontal = orientation === "horizontal";
    const length = (horizontal ? size[0] : size[1]) * 0.72;
    const crossA = horizontal ? size[1] : size[0];
    const radius = Math.max(0.003, Math.min(crossA, size[2]) * 0.24);
    const pull = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 18), materials.hardware);
    if (horizontal) pull.rotation.z = Math.PI / 2;
    pull.position.set(...position);
    pull.castShadow = true;
    group.add(pull);
    return;
  }

  const radius = Math.max(0.004, Math.min(size[0], size[1], size[2]) * 0.38);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 16), materials.hardware);
  knob.position.set(...position);
  knob.castShadow = true;
  group.add(knob);
}

function renderDescriptorLight(group, rootGroup, component, materials, size, position) {
  const type = component.metadata?.lightType || "puck";
  if (type === "puck") {
    const radius = Math.max(0.003, Math.min(size[0], size[2]) * 0.45);
    const puck = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, size[1] * 0.8, 20), materials.puckLight);
    puck.position.set(...position);
    puck.castShadow = false;
    group.add(puck);
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
  glow.position.set(position[0], position[1] - (type === "vertical_led" ? 0 : 0.09), position[2] + 0.045);
  group.add(glow);
  rootGroup.userData.pointLightCount += 1;
}

function collectRenderedComponentRecords(layout, componentGroups) {
  const expected = createExpectedRenderManifest(layout);
  const records = [];
  for (const descriptor of expected) {
    const componentGroup = componentGroups.get(descriptor.componentId);
    const record = componentGroup ? collectOwnedMeshRecord(componentGroup, descriptor.componentId) : null;
    if (record) records.push(record);
  }
  return records;
}

function collectOwnedMeshRecord(componentGroup, componentId) {
  const bounds = new THREE.Box3().makeEmpty();
  let meshCount = 0;

  const visit = (object) => {
    if (object !== componentGroup && object.userData?.componentId) return;
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

function renderLayoutOpening(group, component, materials, size, position, bookcaseDepth) {
  if (component.id !== "feature-opening") return;
  const kind = component.metadata?.kind;
  const backZ = -bookcaseDepth / 2 + 0.024;
  const bottom = position[1] - size[1] / 2;
  if (kind === "media") {
    const screenWidth = size[0] * 0.72;
    const screenHeight = Math.min(size[1] * 0.5, screenWidth * 0.56);
    const screenY = bottom + size[1] * 0.56;
    addBox(group, [screenWidth, screenHeight, 0.028], [position[0], screenY, backZ], materials.screen, false);
    addBox(group, [screenWidth * 0.94, 0.012, 0.018], [position[0], screenY - screenHeight / 2 - 0.035, backZ + 0.018], materials.hardware, false);
    return;
  }
  if (kind === "feature") {
    const fireboxWidth = size[0] * 0.5;
    const fireboxHeight = size[1] * 0.44;
    const fireboxY = bottom + fireboxHeight / 2 + size[1] * 0.04;
    addBox(group, [fireboxWidth, fireboxHeight, 0.045], [position[0], fireboxY, backZ + 0.014], materials.firebox, false);
    addBox(group, [size[0] * 0.76, 0.075, 0.19], [position[0], bottom + size[1] * 0.56, backZ + 0.08], materials.case, false);
  }
}

function renderLayoutBase(group, component, config, materials, size, position) {
  const [width, height, depth] = size;
  if (config.baseStyle === "toe_kick") {
    addBox(group, size, position, materials.case);
    addBox(group, [width * 0.97, height * 0.72, 0.018], [position[0], position[1] - height * 0.08, position[2] + depth / 2 + 0.008], materials.shadow, false);
    return;
  }
  if (config.baseStyle === "furniture_base") {
    const front = position[2] + depth / 2;
    const apronHeight = height * 0.46;
    const footWidth = Math.min(width * 0.08, 0.25);
    addBox(group, [width * 0.94, height * 0.54, depth * 0.55], [position[0], position[1] + height * 0.23, position[2] - depth * 0.2], materials.case);
    addBox(group, [width * 0.98, apronHeight, 0.16], [position[0], position[1] + height * 0.27, front - 0.08], materials.case);
    [-1, 1].forEach((direction) => {
      addBox(group, [footWidth, height * 0.64, 0.2], [position[0] + direction * (width / 2 - footWidth * 0.9), position[1] - height * 0.18, front - 0.1], materials.case);
    });
    return;
  }
  addBox(group, size, position, materials.case);
  addBox(group, [width + 0.045, Math.min(0.065, height * 0.24), depth + 0.035], [position[0], position[1] + height / 2 - Math.min(0.032, height * 0.12), position[2]], materials.case);
}

function renderLayoutCrown(group, component, config, materials, bookcaseDepth) {
  const purpose = component.metadata?.purpose;
  if (config.crownStyle === "classic_crown" && purpose !== "classic_cap") return;
  const width = inchesToUnits(config.width);
  const top = inchesToUnits(config.height);
  const depth = bookcaseDepth;
  if (config.crownStyle === "slim_cap") {
    addBox(group, [width + 0.08, 0.055, depth + 0.07], [0, top - 0.027, 0], materials.case);
    addBox(group, [width + 0.03, 0.045, depth + 0.025], [0, top - 0.077, 0], materials.case);
    return;
  }
  if (config.crownStyle === "modern_soffit") {
    addBox(group, [width + 0.035, 0.2, depth + 0.03], [0, top - 0.1, 0], materials.case);
    addBox(group, [width + 0.095, 0.045, depth + 0.09], [0, top - 0.022, 0], materials.case);
    addBox(group, [width + 0.065, 0.04, depth + 0.055], [0, top - 0.2, 0], materials.case);
    return;
  }
  addBox(group, [width + 0.04, 0.055, depth + 0.035], [0, top - 0.165, 0], materials.case);
  addBox(group, [width + 0.1, 0.085, depth + 0.105], [0, top - 0.102, 0], materials.case);
  addBox(group, [width + 0.16, 0.055, depth + 0.16], [0, top - 0.027, 0], materials.case);
  addBox(group, [width + 0.12, 0.018, 0.02], [0, top - 0.07, depth / 2 + 0.07], materials.highlight, false);
}

function addLayoutHandle(group, component, config, materials, size, position) {
  const hardwareType = component.metadata?.hardware || config.hardware;
  if (hardwareType === "push_latch") return;
  const isPull = hardwareType.endsWith("_pull") || component.metadata?.kind === "pull";
  const hostPlane = position[2] - size[2] / 2;
  const gripPlane = position[2] + size[2] / 2;

  if (isPull) {
    const length = Math.max(size[0], size[1], 0.26);
    const pull = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.023, length, 18), materials.hardware);
    if (size[0] > size[1]) pull.rotation.z = Math.PI / 2;
    pull.position.set(position[0], position[1], gripPlane - 0.012);
    pull.castShadow = true;
    group.add(pull);
    const stemOffset = length * 0.34;
    const horizontal = size[0] > size[1];
    [-1, 1].forEach((direction) => {
      const stemPosition = [...position];
      if (horizontal) stemPosition[0] += direction * stemOffset;
      else stemPosition[1] += direction * stemOffset;
      stemPosition[2] = hostPlane + size[2] * 0.48;
      addBox(group, [0.055, 0.03, Math.max(size[2] * 0.9, 0.04)], stemPosition, materials.hardware, false);
    });
    return;
  }

  const radius = clamp(Math.min(size[0], size[1]) * 0.5, 0.035, 0.064);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 16), materials.hardware);
  knob.position.set(position[0], position[1], hostPlane + size[2] * 0.72);
  knob.castShadow = true;
  group.add(knob);
  const rosette = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.15, radius * 1.15, 0.014, 22), materials.hardware);
  rosette.rotation.x = Math.PI / 2;
  rosette.position.set(position[0], position[1], hostPlane + 0.008);
  rosette.castShadow = true;
  group.add(rosette);
}

function addLayoutLight(group, rootGroup, component, materials, size, position) {
  const type = component.metadata?.lightType || "puck";
  if (type === "puck") {
    const radius = Math.max(size[0], size[2]) * 0.5;
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, size[1], 28), materials.puckTrim);
    housing.position.set(position[0], position[1] - 0.003, position[2]);
    housing.castShadow = false;
    group.add(housing);

    // Keep the visible diffuser as a thin recessed lens. A spherical glow
    // reads as a hanging bulb at profile-camera distance and exaggerates the
    // fixture, especially below the tall built-up soffit.
    const diffuser = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.68, radius * 0.68, Math.min(size[1] * 0.22, 0.007), 28), materials.puckLight);
    diffuser.position.set(position[0], position[1] - size[1] * 0.56 - 0.004, position[2]);
    diffuser.castShadow = false;
    diffuser.renderOrder = 3;
    group.add(diffuser);
  } else {
    addBox(group, size, position, materials.ledStrip, false);
  }

  if (rootGroup.userData.pointLightCount >= 18) return;
  const temperature = Number(component.metadata?.warmth) || 2700;
  const color = getLightingTemperatureColor(temperature);
  const glow = type === "puck"
    ? new THREE.SpotLight(color, 0.36, 2.8, Math.PI * 0.34, 0.76, 1.2)
    : new THREE.PointLight(color, 0.11, 1.5);
  glow.userData.productLight = true;
  glow.position.set(position[0], position[1] - (type === "vertical_led" ? 0 : 0.09), position[2] + 0.025);
  group.add(glow);
  if (type === "puck") {
    glow.target.position.set(position[0], position[1] - 0.95, position[2] + 0.08);
    group.add(glow.target);
    const halo = new THREE.PointLight(color, 0.055, 0.72, 1.55);
    halo.userData.productLight = true;
    halo.position.set(position[0], position[1] - 0.055, position[2] + 0.012);
    group.add(halo);
  }
  rootGroup.userData.pointLightCount += 1;
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

function getBayX(bay, innerWidth, bayWidth, partition) {
  return -innerWidth / 2 + bayWidth / 2 + bay * (bayWidth + partition);
}

function addShelf(group, materials, size, position, depth) {
  const [width, height, shelfDepth] = size;
  const [x, y, z] = position;
  addBox(group, size, position, materials.case);
  addBox(group, [width + 0.04, height * 1.08, 0.078], [x, y + height * 0.02, depth / 2 - 0.044], materials.case, false);
  addBox(group, [width + 0.01, 0.014, 0.028], [x, y + height / 2 + 0.016, depth / 2 - 0.076], materials.highlight, false);
  addBox(group, [width + 0.018, 0.016, 0.032], [x, y - height / 2 - 0.012, depth / 2 - 0.086], materials.reveal, false);
  addBox(group, [width * 0.94, 0.018, 0.045], [x, y + height / 2 + 0.014, -shelfDepth / 2 + 0.078], materials.innerShadow, false);
}

function addShelfPinRows(group, config, materials, metrics) {
  if (metrics.shelfSpan < 1.2) return;
  const holeCount = Math.min(9, Math.max(5, config.shelves + 3));
  const frontZ = metrics.depth / 2 - 0.23;
  const backZ = metrics.depth / 2 - 0.43;
  const yStart = metrics.upperBottom + 0.34;
  const yEnd = metrics.upperTop - 0.34;
  const span = Math.max(0.1, yEnd - yStart);

  for (let bay = 0; bay < config.sections; bay += 1) {
    if (config.tallDoors && (bay === 0 || bay === config.sections - 1)) continue;
    const bayX = getBayX(bay, metrics.innerWidth, metrics.bayWidth, metrics.partition);
    const sideXs = [bayX - metrics.bayWidth / 2 + 0.035, bayX + metrics.bayWidth / 2 - 0.035];
    for (let index = 0; index < holeCount; index += 1) {
      const y = yStart + (span / Math.max(1, holeCount - 1)) * index;
      sideXs.forEach((x) => {
        addBox(group, [0.008, 0.024, 0.024], [x, y, frontZ], materials.pinHole, false);
        addBox(group, [0.008, 0.02, 0.02], [x, y, backZ], materials.pinHole, false);
      });
    }
  }
}

function addFaceFrameDetails(group, config, materials, metrics) {
  const faceZ = metrics.depth / 2 + 0.018;
  const stile = 0.105;
  const topY = metrics.height - metrics.outer / 2;
  const bottomY = metrics.outer / 2;

  addBox(group, [stile, metrics.height - metrics.outer * 0.5, 0.08], [-metrics.width / 2 + metrics.outer / 2, metrics.height / 2, faceZ], materials.case, false);
  addBox(group, [stile, metrics.height - metrics.outer * 0.5, 0.08], [metrics.width / 2 - metrics.outer / 2, metrics.height / 2, faceZ], materials.case, false);
  addBox(group, [0.018, metrics.height - metrics.outer * 0.8, 0.032], [-metrics.width / 2 + metrics.outer + 0.018, metrics.height / 2, faceZ + 0.044], materials.highlight, false);
  addBox(group, [0.018, metrics.height - metrics.outer * 0.8, 0.032], [metrics.width / 2 - metrics.outer - 0.018, metrics.height / 2, faceZ + 0.044], materials.innerShadow, false);
  for (let index = 1; index < config.sections; index += 1) {
    const x = -metrics.innerWidth / 2 + index * (metrics.bayWidth + metrics.partition) - metrics.partition / 2;
    if (isPartitionInsideClearOpening(config, index)) {
      const lowerStileHeight = Math.max(0.4, metrics.lowerHeight + 0.08);
      addBox(group, [stile, lowerStileHeight, 0.08], [x, lowerStileHeight / 2, faceZ], materials.case, false);
      addBox(group, [0.016, lowerStileHeight * 0.96, 0.03], [x - stile * 0.25, lowerStileHeight / 2, faceZ + 0.044], materials.highlight, false);
    } else {
      addBox(group, [stile, metrics.height - metrics.outer * 1.7, 0.08], [x, metrics.height / 2, faceZ], materials.case, false);
      addBox(group, [0.016, metrics.height - metrics.outer * 2.05, 0.03], [x - stile * 0.25, metrics.height / 2, faceZ + 0.044], materials.highlight, false);
    }
  }

  addBox(group, [metrics.width + 0.03, 0.095, 0.08], [0, topY, faceZ], materials.case, false);
  addBox(group, [metrics.width + 0.03, 0.08, 0.08], [0, bottomY, faceZ], materials.case, false);
  addBox(group, [metrics.width * 0.98, 0.018, 0.032], [0, topY + 0.036, faceZ + 0.044], materials.highlight, false);
  addBox(group, [metrics.width * 0.98, 0.018, 0.035], [0, bottomY - 0.034, faceZ + 0.046], materials.innerShadow, false);
  if (config.lowerCabinets) {
    addBox(group, [metrics.width + 0.02, 0.115, 0.085], [0, metrics.lowerHeight + 0.05, faceZ + 0.01], materials.case, false);
    addBox(group, [metrics.width * 0.98, 0.018, 0.036], [0, metrics.lowerHeight + 0.108, faceZ + 0.06], materials.highlight, false);
  }
}

function getCenterRange(config, wide = false) {
  const span = wide && config.sections >= 4 ? 2 : 1;
  const start = Math.max(0, Math.floor((config.sections - span) / 2));
  return { start, end: start + span - 1, span };
}

function isBayInRange(bay, range) {
  return bay >= range.start && bay <= range.end;
}

function isPartitionInsideClearOpening(config, partitionIndex) {
  if (!config.centerOpening && !config.deskOpening && !config.featureOpening) return false;
  const range = getCenterRange(config, true);
  return partitionIndex > range.start && partitionIndex <= range.end;
}

function shouldSkipShelf(config, bay, row) {
  if (config.tallDoors && (bay === 0 || bay === config.sections - 1)) return true;
  if (config.centerOpening && isBayInRange(bay, getCenterRange(config, true))) return true;
  if (config.deskOpening && isBayInRange(bay, getCenterRange(config, true))) return true;
  if (config.featureOpening && isBayInRange(bay, getCenterRange(config, true))) return true;
  if (config.layoutType === "display_wall" && bay === Math.floor(config.sections / 2) && row === 2) return true;
  if (config.layoutType === "asymmetric") return (bay === 1 && row === 2) || (bay === 2 && row === 3) || (bay === 3 && row === 1);
  if (config.layoutType === "walnut_modern") return (bay === 0 && row === 3) || (bay === 2 && row === 1);
  return false;
}

function getRenderedShelfCount(config) {
  return config.lowerCabinets ? Math.max(1, config.shelves - 1) : config.shelves;
}

function getShelfY(config, bay, row, upperBottom, upperTop, shelfSpan, shelfCount = config.shelves) {
  const baseY = getAlignedShelfY(config, row, upperBottom, shelfSpan, shelfCount);
  if (config.layoutType !== "asymmetric") return baseY;
  const offsets = [0.12, -0.16, 0.08, -0.08, 0.15, -0.12];
  const offset = offsets[bay % offsets.length] * (shelfSpan / Math.max(shelfCount, 2));
  return clamp(baseY + offset, upperBottom + 0.28, upperTop - 0.18);
}

function getAlignedShelfY(config, row, upperBottom, shelfSpan, shelfCount = config.shelves) {
  return upperBottom + (shelfSpan / (shelfCount + 1)) * row;
}

function addMediaOpening(group, config, materials, metrics) {
  const range = getCenterRange(config, true);
  const openingWidth = metrics.bayWidth * range.span + metrics.partition * (range.span - 1);
  const centerBay = (range.start + range.end) / 2;
  const x = getBayX(centerBay, metrics.innerWidth, metrics.bayWidth, metrics.partition);
  const backZ = -metrics.depth / 2 + 0.088;
  const screenWidth = openingWidth * 0.76;
  const screenHeight = Math.min(metrics.shelfSpan * 0.52, 2.5);
  const screenY = metrics.upperBottom + metrics.shelfSpan * 0.42;

  addBox(group, [openingWidth, metrics.shelf * 1.1, metrics.shelfDepth], [x, metrics.upperBottom + metrics.shelf * 0.5, 0.02], materials.case);
  addBox(group, [openingWidth, metrics.shelf * 1.1, metrics.shelfDepth], [x, metrics.upperTop - metrics.shelf * 1.2, 0.02], materials.case);
  addBox(group, [screenWidth + 0.16, screenHeight + 0.16, 0.035], [x, screenY, backZ - 0.012], materials.edgeBlock, false);
  addBox(group, [screenWidth, screenHeight, 0.04], [x, screenY, backZ + 0.016], materials.shadow, false);
  addBox(group, [screenWidth * 0.74, 0.03, 0.032], [x, screenY - screenHeight / 2 - 0.14, backZ + 0.032], materials.case, false);
}

function addDeskNiche(group, config, materials, metrics) {
  const range = getCenterRange(config, true);
  const openingWidth = metrics.bayWidth * range.span + metrics.partition * (range.span - 1);
  const centerBay = (range.start + range.end) / 2;
  const x = getBayX(centerBay, metrics.innerWidth, metrics.bayWidth, metrics.partition);
  const faceZ = metrics.depth / 2 + 0.035;
  const deskY = metrics.lowerHeight + 0.22;
  const backHeight = Math.min(metrics.shelfSpan * 0.5, 2.45);
  const backY = deskY + backHeight / 2 + 0.08;

  addBox(group, [openingWidth + 0.1, 0.12, metrics.depth - 0.08], [x, deskY, 0.03], materials.edgeBlock);
  addBox(group, [openingWidth * 0.94, backHeight, 0.045], [x, backY, -metrics.depth / 2 + 0.09], materials.inset, false);
  addBox(group, [openingWidth * 0.22, 0.035, 0.12], [x - openingWidth * 0.18, deskY + 0.08, faceZ], materials.hardware, false);
}

function addFeatureWallOpening(group, config, materials, metrics) {
  const range = getCenterRange(config, true);
  const openingWidth = metrics.bayWidth * range.span + metrics.partition * (range.span - 1);
  const centerBay = (range.start + range.end) / 2;
  const x = getBayX(centerBay, metrics.innerWidth, metrics.bayWidth, metrics.partition);
  const backZ = -metrics.depth / 2 + 0.088;
  const faceZ = metrics.depth / 2 + 0.04;
  const panelWidth = openingWidth * 0.84;
  const panelHeight = Math.min(metrics.shelfSpan * 0.5, 2.24);
  const panelY = metrics.upperBottom + metrics.shelfSpan * 0.55;
  const mantelY = metrics.lowerHeight + Math.min(0.5, metrics.shelfSpan * 0.13);
  const fireboxWidth = Math.min(openingWidth * 0.48, 1.25);
  const fireboxHeight = Math.min(metrics.shelfSpan * 0.19, 0.78);
  const fireboxY = mantelY - fireboxHeight * 0.66;

  addBox(group, [openingWidth, metrics.shelf * 1.12, metrics.shelfDepth], [x, metrics.upperBottom + metrics.shelf * 0.5, 0.02], materials.case);
  addBox(group, [openingWidth, metrics.shelf * 1.12, metrics.shelfDepth], [x, metrics.upperTop - metrics.shelf * 1.2, 0.02], materials.case);
  addBox(group, [panelWidth, panelHeight, 0.04], [x, panelY, backZ], materials.inset, false);
  addBox(group, [panelWidth * 1.08, 0.07, 0.065], [x, panelY + panelHeight / 2 + 0.04, backZ + 0.024], materials.edgeBlock, false);
  addBox(group, [panelWidth * 1.08, 0.07, 0.065], [x, panelY - panelHeight / 2 - 0.04, backZ + 0.024], materials.edgeBlock, false);
  addBox(group, [0.07, panelHeight + 0.14, 0.065], [x - panelWidth * 0.54, panelY, backZ + 0.024], materials.edgeBlock, false);
  addBox(group, [0.07, panelHeight + 0.14, 0.065], [x + panelWidth * 0.54, panelY, backZ + 0.024], materials.edgeBlock, false);
  addBox(group, [openingWidth * 0.72, 0.16, metrics.depth * 0.62], [x, mantelY, 0.03], materials.case);
  addBox(group, [fireboxWidth + 0.22, fireboxHeight + 0.2, 0.052], [x, fireboxY, faceZ - 0.08], materials.edgeBlock, false);
  addBox(group, [fireboxWidth, fireboxHeight, 0.06], [x, fireboxY, faceZ - 0.045], materials.shadow, false);
  addBox(group, [fireboxWidth * 0.72, 0.025, 0.034], [x, fireboxY - fireboxHeight * 0.38, faceZ - 0.005], materials.hardware, false);
}

function addDisplayWallMoment(group, config, materials, metrics) {
  const bay = Math.floor(config.sections / 2);
  const bayX = getBayX(bay, metrics.innerWidth, metrics.bayWidth, metrics.partition);
  const faceZ = metrics.depth / 2 - 0.14;
  const artHeight = Math.min(metrics.shelfSpan * 0.34, 1.52);
  const artY = metrics.upperBottom + metrics.shelfSpan * 0.45;

  addBox(group, [metrics.bayWidth * 0.52, artHeight, 0.045], [bayX, artY, faceZ], materials.inset, false);
  addBox(group, [metrics.bayWidth * 0.62, 0.045, 0.055], [bayX, artY + artHeight / 2 + 0.04, faceZ + 0.02], materials.edgeBlock, false);
  addBox(group, [metrics.bayWidth * 0.62, 0.045, 0.055], [bayX, artY - artHeight / 2 - 0.04, faceZ + 0.02], materials.edgeBlock, false);
  addBox(group, [0.045, artHeight + 0.12, 0.055], [bayX - metrics.bayWidth * 0.31, artY, faceZ + 0.02], materials.edgeBlock, false);
  addBox(group, [0.045, artHeight + 0.12, 0.055], [bayX + metrics.bayWidth * 0.31, artY, faceZ + 0.02], materials.edgeBlock, false);
}

function addAsymmetricAccents(group, config, materials, metrics) {
  const dividerHeight = metrics.shelfSpan * 0.42;
  const dividerY = metrics.upperBottom + metrics.shelfSpan * 0.46;
  const bay = Math.min(config.sections - 1, 2);
  const bayX = getBayX(bay, metrics.innerWidth, metrics.bayWidth, metrics.partition);
  addBox(group, [0.08, dividerHeight, metrics.shelfDepth], [bayX + metrics.bayWidth * 0.22, dividerY, 0.02], materials.case);

  const longBay = config.sections > 3 ? 0 : config.sections - 1;
  const longBayX = getBayX(longBay, metrics.innerWidth, metrics.bayWidth, metrics.partition);
  addBox(group, [metrics.bayWidth * 0.7, 0.08, metrics.shelfDepth], [longBayX + metrics.bayWidth * 0.08, metrics.upperBottom + metrics.shelfSpan * 0.68, 0.02], materials.case);
}

function addUpperGlassDoors(group, config, materials, metrics) {
  const faceZ = metrics.depth / 2 + 0.04;
  const glassConfig = { ...config, doorStyle: "glass" };
  const doorHeight = metrics.upperTop - metrics.upperBottom + 0.08;
  for (let bay = 0; bay < config.sections; bay += 1) {
    const x = getBayX(bay, metrics.innerWidth, metrics.bayWidth, metrics.partition);
    const doorCenterY = metrics.upperBottom + doorHeight / 2 - 0.02;
    const openingSide = bay % 2 === 0 ? "right" : "left";
    addDoor(group, glassConfig, materials, [metrics.bayWidth * 0.94, doorHeight, 0.045], [x, doorCenterY, faceZ], { openingSide });
    addHardware(group, config, materials, {
      doorX: x,
      doorWidth: metrics.bayWidth * 0.94,
      doorHeight,
      doorCenterY,
      z: faceZ + 0.05,
      openingSide,
      placement: "upper",
      scale: 0.82
    });
  }
}

function addTallStorageDoors(group, config, materials, metrics) {
  const faceZ = metrics.depth / 2 + 0.06;
  const doorHeight = metrics.height - metrics.outer * 2 - 0.34;
  [0, config.sections - 1].forEach((bay, index) => {
    const x = getBayX(bay, metrics.innerWidth, metrics.bayWidth, metrics.partition);
    const doorCenterY = metrics.outer + doorHeight / 2 + 0.18;
    const openingSide = index === 0 ? "right" : "left";
    addDoor(group, config, materials, [metrics.bayWidth * 0.94, doorHeight, 0.07], [x, doorCenterY, faceZ], { openingSide });
    addHardware(group, config, materials, {
      doorX: x,
      doorWidth: metrics.bayWidth * 0.94,
      doorHeight,
      doorCenterY,
      z: faceZ + 0.052,
      openingSide,
      placement: "tall",
      scale: 0.92
    });
  });
}

function addPuckLights(group, config, materials, metrics) {
  if (config.lighting === "no_lighting") return;
  const lightBays = [];
  for (let bay = 0; bay < config.sections; bay += 1) {
    if (config.tallDoors && (bay === 0 || bay === config.sections - 1)) continue;
    if (config.centerOpening && isBayInRange(bay, getCenterRange(config, true))) continue;
    if (config.deskOpening && isBayInRange(bay, getCenterRange(config, true))) continue;
    if (config.featureOpening && isBayInRange(bay, getCenterRange(config, true))) continue;
    lightBays.push(bay);
  }

  if (config.lighting === "vertical_led") {
    addVerticalLedStrips(group, materials, metrics, lightBays);
    return;
  }

  if (config.lighting === "shelf_accent") {
    addShelfAccentLights(group, config, materials, metrics, lightBays);
    return;
  }

  lightBays.slice(0, 6).forEach((bay) => {
    const x = getBayX(bay, metrics.innerWidth, metrics.bayWidth, metrics.partition);
    const y = Math.min(metrics.height - metrics.outer * 0.48, metrics.upperTop + metrics.shelf * 0.08);
    const z = metrics.depth / 2 - 0.26;
    const puck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.018, 18), materials.puckLight);
    puck.position.set(x, y, z);
    puck.castShadow = false;
    group.add(puck);

    const glow = new THREE.PointLight(0xffd89b, 0.18, 1.8);
    glow.position.set(x, y - 0.14, z - 0.08);
    group.add(glow);
  });
}

function addVerticalLedStrips(group, materials, metrics, lightBays) {
  const stripHeight = Math.max(0.8, metrics.upperTop - metrics.upperBottom - 0.36);
  const stripY = metrics.upperBottom + stripHeight / 2 + 0.16;
  const stripZ = metrics.depth / 2 - 0.22;

  lightBays.forEach((bay, index) => {
    const bayX = getBayX(bay, metrics.innerWidth, metrics.bayWidth, metrics.partition);
    const sideOffset = metrics.bayWidth / 2 - 0.065;
    const stripXs = [bayX - sideOffset, bayX + sideOffset];
    stripXs.forEach((x) => {
      addBox(group, [0.018, stripHeight, 0.018], [x, stripY, stripZ], materials.ledStrip, false);
    });
    if (index < 4) {
      const glow = new THREE.PointLight(0xffd4a2, 0.11, 2.4);
      glow.position.set(bayX, stripY, stripZ - 0.14);
      group.add(glow);
    }
  });
}

function addShelfAccentLights(group, config, materials, metrics, lightBays) {
  lightBays.forEach((bay) => {
    const bayX = getBayX(bay, metrics.innerWidth, metrics.bayWidth, metrics.partition);
    for (let row = 1; row <= Math.min(metrics.renderedShelfCount, 5); row += 1) {
      if (shouldSkipShelf(config, bay, row)) continue;
      const shelfY = getShelfY(config, bay, row, metrics.upperBottom, metrics.upperTop, metrics.shelfSpan, metrics.renderedShelfCount);
      const y = shelfY - metrics.shelf * 0.68;
      const z = metrics.depth / 2 - 0.16;
      addBox(group, [metrics.bayWidth * 0.62, 0.014, 0.018], [bayX, y, z], materials.ledStrip, false);
      if (row <= 2) {
        const glow = new THREE.PointLight(0xffd7a0, 0.065, 1.35);
        glow.position.set(bayX, y - 0.08, z - 0.08);
        group.add(glow);
      }
    }
  });
}

function addLowerCabinets(group, config, materials, metrics) {
  const { width, depth, lowerHeight } = metrics;
  const faceZ = depth / 2 + 0.034;
  const topRailHeight = 0.16;
  const sideReveal = 0.18;
  const pairGap = 0.045;
  const centerGap = 0.026;
  const pairCount = Math.max(1, Math.floor(config.doorCount / 2));
  const doorHeight = lowerHeight - 0.28;
  const doorCenterY = lowerHeight / 2 + 0.02;
  addBox(group, [width - 0.05, topRailHeight, depth], [0, lowerHeight + topRailHeight / 2, 0], materials.case);
  addBox(group, [width - 0.1, lowerHeight - 0.14, 0.06], [0, lowerHeight / 2 + 0.02, faceZ - 0.025], materials.reveal);

  const addDoorPair = (pairX, pairWidth) => {
    const doorWidth = (pairWidth - centerGap) / 2;
    const leftX = pairX - centerGap / 2 - doorWidth / 2;
    const rightX = pairX + centerGap / 2 + doorWidth / 2;

    addBox(group, [0.018, doorHeight + 0.08, 0.025], [pairX, doorCenterY, faceZ + 0.025], materials.reveal, false);
    addDoor(group, config, materials, [doorWidth, doorHeight, 0.07], [leftX, doorCenterY, faceZ], { openingSide: "right" });
    addDoor(group, config, materials, [doorWidth, doorHeight, 0.07], [rightX, doorCenterY, faceZ], { openingSide: "left" });
    addHardware(group, config, materials, {
      doorX: leftX,
      doorWidth,
      doorHeight,
      doorCenterY,
      z: faceZ + 0.052,
      openingSide: "right",
      placement: "lower"
    });
    addHardware(group, config, materials, {
      doorX: rightX,
      doorWidth,
      doorHeight,
      doorCenterY,
      z: faceZ + 0.052,
      openingSide: "left",
      placement: "lower"
    });
  };

  if (config.tallDoors && config.sections > 2) {
    for (let bay = 1; bay < config.sections - 1; bay += 1) {
      addDoorPair(getBayX(bay, metrics.innerWidth, metrics.bayWidth, metrics.partition), metrics.bayWidth * 0.92);
    }
    return;
  }

  const usableWidth = width - sideReveal * 2 - pairGap * Math.max(0, pairCount - 1);
  const pairWidth = usableWidth / pairCount;
  const startX = -width / 2 + sideReveal + pairWidth / 2;

  for (let pair = 0; pair < pairCount; pair += 1) {
    addDoorPair(startX + pair * (pairWidth + pairGap), pairWidth);
  }
}

function addDoor(group, config, materials, size, position, options = {}) {
  const [width, height, depth] = size;
  const revealPad = 0.026;
  addBox(group, [width + revealPad, height + revealPad, 0.018], [position[0], position[1], position[2] - depth / 2 - 0.006], materials.reveal, false);
  const z = position[2] + depth / 2 + 0.012;
  const rail = config.doorStyle === "slim_shaker" ? 0.062 : 0.105;

  if (config.doorStyle === "glass") {
    const glassWidth = Math.max(0.04, width - rail * 2.25);
    const glassHeight = Math.max(0.08, height - rail * 2.25);
    addBox(group, [width - rail, rail, depth], [position[0], position[1] + height / 2 - rail / 2, position[2]], materials.case, false);
    addBox(group, [width - rail, rail, depth], [position[0], position[1] - height / 2 + rail / 2, position[2]], materials.case, false);
    addBox(group, [rail, height - rail, depth], [position[0] - width / 2 + rail / 2, position[1], position[2]], materials.case, false);
    addBox(group, [rail, height - rail, depth], [position[0] + width / 2 - rail / 2, position[1], position[2]], materials.case, false);
    addBox(group, [0.012, glassHeight, 0.012], [position[0], position[1], z + 0.012], materials.glassLine, false);
    addBox(group, [glassWidth * 0.9, 0.01, 0.012], [position[0], position[1] + glassHeight * 0.42, z + 0.012], materials.glassLine, false);
    return;
  }

  addBox(group, size, position, materials.case);

  if (config.doorStyle === "flat") {
    addBox(group, [width * 0.92, 0.014, 0.022], [position[0], position[1] + height * 0.38, z], materials.reveal, false);
    addBox(group, [width * 0.92, 0.014, 0.022], [position[0], position[1] - height * 0.38, z], materials.reveal, false);
    if (options.openingSide) {
      const stileX = position[0] + (options.openingSide === "right" ? width / 2 - 0.045 : -width / 2 + 0.045);
      addBox(group, [0.014, height * 0.82, 0.024], [stileX, position[1], z + 0.004], materials.reveal, false);
    }
    return;
  }

  addBox(group, [width - rail * 2.3, height - rail * 2.3, 0.028], [position[0], position[1], z - 0.006], materials.inset, false);
  addBox(group, [width - rail * 2.65, 0.018, 0.02], [position[0], position[1] + height / 2 - rail * 1.38, z + 0.012], materials.highlight, false);
  addBox(group, [0.016, height - rail * 2.75, 0.02], [position[0] - width / 2 + rail * 1.36, position[1], z + 0.012], materials.highlight, false);

  addBox(group, [width - rail, rail, 0.038], [position[0], position[1] + height / 2 - rail / 2, z], materials.case, false);
  addBox(group, [width - rail, rail, 0.038], [position[0], position[1] - height / 2 + rail / 2, z], materials.case, false);
  addBox(group, [rail, height - rail, 0.038], [position[0] - width / 2 + rail / 2, position[1], z], materials.case, false);
  addBox(group, [rail, height - rail, 0.038], [position[0] + width / 2 - rail / 2, position[1], z], materials.case, false);
  addBox(group, [width - rail * 1.25, 0.014, 0.018], [position[0], position[1] + height / 2 - rail * 0.28, z + 0.028], materials.highlight, false);
  addBox(group, [0.014, height - rail * 1.25, 0.018], [position[0] - width / 2 + rail * 0.28, position[1], z + 0.028], materials.highlight, false);
}

function addHardware(group, config, materials, options) {
  if (config.hardware === "push_latch") return;
  const {
    doorX,
    doorWidth,
    doorHeight,
    doorCenterY,
    z,
    openingSide,
    placement,
    scale = 1
  } = options;
  const railInset = clamp(doorWidth * 0.18, 0.105, 0.18);
  const x = doorX + (openingSide === "right" ? doorWidth / 2 - railInset : -doorWidth / 2 + railInset);
  const doorTop = doorCenterY + doorHeight / 2;
  const y = placement === "tall"
    ? clamp(3.55, doorCenterY - doorHeight * 0.2, doorTop - 0.42)
    : placement === "upper"
      ? doorCenterY - doorHeight * 0.1
      : doorTop - clamp(doorHeight * 0.18, 0.24, 0.34);

  if (config.hardware.endsWith("_pull")) {
    const pullHeight = (placement === "tall" ? 0.66 : 0.46) * scale;
    const pull = new THREE.Mesh(new THREE.CylinderGeometry(0.023 * scale, 0.023 * scale, pullHeight, 16), materials.hardware);
    pull.position.set(x, y, z + 0.028);
    pull.castShadow = true;
    group.add(pull);
    addBox(group, [0.062 * scale, 0.03 * scale, 0.048], [x, y + pullHeight * 0.36, z + 0.01], materials.hardware, false);
    addBox(group, [0.062 * scale, 0.03 * scale, 0.048], [x, y - pullHeight * 0.36, z + 0.01], materials.hardware, false);
    return;
  }

  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.058 * scale, 20, 16), materials.hardware);
  knob.position.set(x, y, z + 0.04);
  knob.castShadow = true;
  group.add(knob);
  const rosette = new THREE.Mesh(new THREE.CylinderGeometry(0.072 * scale, 0.072 * scale, 0.014, 22), materials.hardware);
  rosette.rotation.x = Math.PI / 2;
  rosette.position.set(x, y, z + 0.016);
  rosette.castShadow = true;
  group.add(rosette);
}

function addCrown(group, config, materials, width, height, depth) {
  if (config.crownStyle === "none") return;
  if (config.crownStyle === "slim_cap") {
    addBox(group, [width + 0.24, 0.14, depth + 0.18], [0, height + 0.07, 0], materials.case);
    return;
  }
  if (config.crownStyle === "modern_soffit") {
    addBox(group, [width + 0.08, 0.46, depth + 0.08], [0, height + 0.23, -0.02], materials.case);
    addBox(group, [width + 0.24, 0.08, depth + 0.18], [0, height + 0.5, 0], materials.side);
    return;
  }
  addBox(group, [width + 0.16, 0.1, depth + 0.08], [0, height + 0.05, 0], materials.case);
  addBox(group, [width + 0.34, 0.14, depth + 0.24], [0, height + 0.17, 0], materials.side);
  addBox(group, [width + 0.22, 0.1, depth + 0.14], [0, height + 0.3, 0], materials.case);
  addBox(group, [width + 0.18, 0.018, 0.035], [0, height + 0.345, depth / 2 + 0.055], materials.highlight, false);
  addBox(group, [width + 0.3, 0.02, 0.05], [0, height + 0.11, depth / 2 + 0.12], materials.innerShadow, false);
}

function addBase(group, config, materials, width, depth) {
  if (config.baseStyle === "toe_kick") {
    addBox(group, [width - 0.45, 0.22, 0.22], [0, 0.11, depth / 2 - 0.17], materials.shadow, false);
    return;
  }
  if (config.baseStyle === "furniture_base") {
    addBox(group, [width + 0.18, 0.14, depth + 0.12], [0, 0.07, 0], materials.side);
    const footPositions = [-width / 2 + 0.28, width / 2 - 0.28];
    footPositions.forEach((x) => {
      addBox(group, [0.18, 0.36, 0.24], [x, 0.18, depth / 2 - 0.12], materials.side);
    });
    return;
  }
  addBox(group, [width + 0.28, 0.26, depth + 0.14], [0, 0.13, 0], materials.side);
  addBox(group, [width + 0.08, 0.08, depth + 0.04], [0, 0.31, 0], materials.case);
  addBox(group, [width + 0.18, 0.02, 0.035], [0, 0.45, depth / 2 + 0.04], materials.highlight, false);
  addBox(group, [width + 0.36, 0.035, 0.06], [0, 0.035, depth / 2 + 0.08], materials.innerShadow, false);
}

function createFinishTexture(surface) {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 192;
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  const lineCount = 34;
  context.lineCap = "round";
  for (let index = 0; index < lineCount; index += 1) {
    const x = (index * 17 + (index % 7) * 5) % canvas.width;
    const wobble = 2;
    const alpha = 0.018 + (index % 3) * 0.008;
    context.strokeStyle = `rgba(34, 29, 24, ${alpha})`;
    context.lineWidth = 0.45;
    context.beginPath();
    context.moveTo(x, -10);
    for (let y = 0; y <= canvas.height + 12; y += 24) {
      const wave = Math.sin((y + index * 13) * 0.055) * wobble;
      context.lineTo(x + wave, y);
    }
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(surface === "back" ? 2.4 : 1.4, surface === "inset" ? 2.2 : 3.4);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createMaterials(baseColor, config) {
  const hardwareColor = getHardwareMaterialColor(config.hardware);
  const isBlackHardware = config.hardware.startsWith("matte_black");
  const isNickelHardware = config.hardware.startsWith("polished_nickel");
  const caseTexture = createFinishTexture("case");
  const sideTexture = createFinishTexture("side");
  const backTexture = createFinishTexture("back");
  const insetTexture = createFinishTexture("inset");
  const paintBump = 0.004;
  const edgeColor = new THREE.Color(baseColor).lerp(new THREE.Color(0x342f2a), 0.5).getHex();
  const revealColor = new THREE.Color(baseColor).lerp(new THREE.Color(0x211e1b), 0.66).getHex();
  const lightColor = getLightingTemperatureColor(config.lightingWarmth);

  return {
    case: new THREE.MeshStandardMaterial({ color: baseColor, map: caseTexture, bumpMap: caseTexture, bumpScale: paintBump * 0.66, roughness: 0.66, metalness: 0 }),
    side: new THREE.MeshStandardMaterial({ color: baseColor, map: sideTexture, bumpMap: sideTexture, bumpScale: paintBump * 0.64, roughness: 0.7, metalness: 0 }),
    back: new THREE.MeshStandardMaterial({ color: baseColor, map: backTexture, bumpMap: backTexture, bumpScale: paintBump * 0.42, roughness: 0.82, metalness: 0 }),
    inset: new THREE.MeshStandardMaterial({ color: baseColor, map: insetTexture, bumpMap: insetTexture, bumpScale: paintBump * 0.5, roughness: 0.74, metalness: 0 }),
    edgeBlock: new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.82, metalness: 0 }),
    shadow: new THREE.MeshStandardMaterial({ color: 0x28241f, roughness: 0.92, metalness: 0 }),
    reveal: new THREE.MeshStandardMaterial({ color: revealColor, roughness: 0.92, metalness: 0 }),
    innerShadow: new THREE.MeshBasicMaterial({ color: 0x211b16, transparent: true, opacity: 0.18, depthWrite: false }),
    highlight: new THREE.MeshBasicMaterial({ color: 0xfffbf4, transparent: true, opacity: 0.15, depthWrite: false }),
    pinHole: new THREE.MeshStandardMaterial({ color: 0x4e4034, roughness: 0.96, metalness: 0 }),
    screen: new THREE.MeshStandardMaterial({ color: 0x17191a, roughness: 0.28, metalness: 0.08, emissive: 0x101213, emissiveIntensity: 0.12 }),
    firebox: new THREE.MeshStandardMaterial({ color: 0x211f1c, roughness: 0.94, metalness: 0 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xe7edf0, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.055, depthWrite: false, side: THREE.DoubleSide, clearcoat: 0.75, clearcoatRoughness: 0.1 }),
    glassLine: new THREE.MeshPhysicalMaterial({ color: 0xfffbf2, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.2, depthWrite: false, clearcoat: 0.8 }),
    hardware: new THREE.MeshStandardMaterial({
      color: hardwareColor,
      roughness: isBlackHardware ? 0.62 : isNickelHardware ? 0.26 : 0.34,
      metalness: isBlackHardware ? 0.2 : 0.84
    }),
    edgeLine: new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: 0.2 }),
    puckTrim: new THREE.MeshStandardMaterial({ color: 0xf4f0e7, roughness: 0.42, metalness: 0.14 }),
    puckLight: new THREE.MeshBasicMaterial({ color: lightColor, transparent: true, opacity: 0.92, toneMapped: false }),
    ledStrip: new THREE.MeshStandardMaterial({ color: lightColor, emissive: lightColor, emissiveIntensity: 1.05, roughness: 0.28, metalness: 0.08 })
  };
}

function getHardwareMaterialColor(hardware) {
  return {
    brass_knob: 0xb38a4a,
    brass_pull: 0xb38a4a,
    matte_black_knob: 0x171614,
    matte_black_pull: 0x171614,
    polished_nickel_pull: 0xd8d9d2,
    push_latch: 0xb38a4a
  }[hardware] || 0xb38a4a;
}

function getHardwareShape(hardware) {
  if (hardware === "push_latch") return "none";
  return String(hardware || "").endsWith("_pull") ? "pull" : "knob";
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

function disposeMaterialSet(materialSet) {
  if (!materialSet || typeof materialSet !== "object") return;
  const textures = new Set();
  const materials = new Set();
  Object.values(materialSet).forEach((material) => {
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
  return Number(Number(value || 0).toFixed(3)).toString();
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
