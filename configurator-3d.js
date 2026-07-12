import * as THREE from "./assets/vendor/three.module.js";
import { diagramSvg, iconSvg } from "./icon-system.js?v=site-system-20260711d";
import {
  baseStyleOptions,
  crownStyleOptions,
  defaultBookcaseConfig,
  deliveryOptions,
  doorStyleOptions,
  finishOptions,
  getDoorCountOptions,
  hardwareOptions,
  inchesToUnits,
  installationOptions,
  layoutPresets,
  lightingWarmthOptions,
  lightingOptions,
  normalizeBookcaseConfig,
  optionLabels,
  shelfThicknessOptions
} from "./bookcase-config.js?v=benjamin-moore-20260712a";
import { generateBookcaseLayout } from "./bookcase-layout.js?v=configurator-20260711e";
import { buildPricingContext, formatPrice } from "./bookcase-pricing.js?v=benjamin-moore-20260712a";
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
  createSavedDesignRecord,
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
} from "./configurator-experience.js?v=benjamin-moore-20260712a";

const numericFields = new Set(["width", "height", "depth", "sections", "shelves", "shelfThickness", "lightingWarmth", "doorCount", "drawerCount"]);
const builderIcons = Object.freeze({
  dimensions: iconSvg("dimensions"),
  layout: iconSvg("layouts"),
  structure: iconSvg("materials"),
  lighting: iconSvg("lighting"),
  finish: iconSvg("paint-finish"),
  hardware: iconSvg("hardware"),
  bookmark: iconSvg("bookmark"),
  search: iconSvg("search"),
  cube: iconSvg("view-3d"),
  front: iconSvg("view-front"),
  threeQuarter: iconSvg("view-three-quarter"),
  side: iconSvg("view-side"),
  check: iconSvg("check"),
  plus: iconSvg("plus"),
  minus: iconSvg("minus")
});

const basePreviewIcons = Object.freeze({
  toe_kick: diagramSvg("base-toe-kick"),
  plinth: diagramSvg("base-plinth"),
  furniture_base: diagramSvg("base-furniture")
});

const crownPreviewIcons = Object.freeze({
  none: diagramSvg("crown-none"),
  slim_cap: diagramSvg("crown-slim"),
  classic_crown: diagramSvg("crown-classic"),
  modern_soffit: diagramSvg("crown-soffit")
});

const lightingPreviewIcons = Object.freeze({
  no_lighting: iconSvg("lighting-none"),
  warm_pucks: iconSvg("lighting-pucks"),
  shelf_accent: iconSvg("lighting-shelf"),
  vertical_led: iconSvg("lighting-vertical"),
  full_package: iconSvg("lighting-package")
});

const hardwarePreviewIcons = Object.freeze({
  brass_knob: diagramSvg("hardware-brass-knob"),
  matte_black_knob: diagramSvg("hardware-black-knob"),
  brass_pull: diagramSvg("hardware-brass-pull"),
  matte_black_pull: diagramSvg("hardware-black-pull"),
  polished_nickel_pull: diagramSvg("hardware-nickel-pull")
});
const finishPalette = {
  white_dove: 0xeee9dc,
  simply_white: 0xf5f0e4,
  chantilly_lace: 0xf7f5ee,
  cloud_white: 0xeee8dc,
  silver_satin: 0xd8d7d2,
  custom_bm: 0xd3c8b8
};
let viewerInstanceSequence = 0;

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-bookcase-builder]").forEach((host, index) => {
    if (host.__bookcaseConfigurator) return;
    host.__bookcaseConfigurator = new BookcaseConfigurator(host, index);
  });
});

class BookcaseConfigurator {
  constructor(host, index) {
    this.host = host;
    this.id = `jq-builder-${index + 1}`;
    this.state = normalizeBookcaseConfig(this.loadInitialConfig());
    this.basePresetId = inferBasePresetId(this.state);
    this.mode = this.loadPreference(CONFIGURATOR_PREFERENCE_KEYS.mode, normalizeConfiguratorMode);
    this.guidedStep = this.loadPreference(CONFIGURATOR_PREFERENCE_KEYS.guidedStep, normalizeGuidedStep);
    this.expandedCategory = this.loadPreference(CONFIGURATOR_PREFERENCE_KEYS.allCategory, normalizeAllCategory);
    this.appearanceTab = "finish";
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
    this.activeView = "three-quarter";
    this.activeRangeDrag = null;
    this.layout = generateBookcaseLayout(this.state);
    this.state = normalizeBookcaseConfig({ ...this.state, ...this.layout.config });
    this.pricing = buildPricingContext(this.state, this.layout);
    this.price = this.pricing.total;
    this.priceCalculationCount += 1;
    this.render();
    this.cacheElements();
    this.viewer = this.createViewer(this.layout);
    this.bindEvents();
    this.renderActiveControls();
    this.syncInterface();
    this.verifyRestoredPaintSelection();
  }

  loadPreference(key, normalizer) {
    try {
      return normalizer(localStorage.getItem(key));
    } catch (error) {
      return normalizer(null);
    }
  }

  async verifyRestoredPaintSelection() {
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

  loadInitialConfig() {
    const requestedPresetId = new URLSearchParams(window.location.search).get("preset");
    const requestedPreset = layoutPresets.find((preset) => preset.id === requestedPresetId);
    if (requestedPreset) {
      return {
        ...defaultBookcaseConfig,
        ...requestedPreset.config,
        layoutPreset: requestedPreset.id
      };
    }
    try {
      const stored = JSON.parse(localStorage.getItem("jqBookcasesDesign") || "null");
      if (!stored || ![2, 3].includes(Number(stored.schemaVersion))) return defaultBookcaseConfig;
      const candidate = normalizeBookcaseConfig(stored.config || stored.state || {});
      return generateBookcaseLayout(candidate).validation.valid ? candidate : defaultBookcaseConfig;
    } catch (error) {
      return defaultBookcaseConfig;
    }
  }

  createViewer(initialLayout = null) {
    if (!isWebGLAvailable()) return this.createViewerFallback();
    try {
      return new BookcaseViewer3D(this.elements.viewer, this.state, initialLayout, (interaction) => {
        if (interaction === "rotate") this.activeView = "custom";
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
      update: () => {},
      setView: () => {},
      zoom: () => {},
      getViewState: () => null,
      getDiagnostics: () => ({ instanceId: "fallback", updateCount: 0, rebuildCount: 0 }),
      destroy: () => {}
    };
  }

  render() {
    this.renderFullPageConfigurator();
  }

  renderFullPageConfigurator() {
    this.host.innerHTML = `
      <form class="builder-shell configurator-shell configurator-experience" data-builder-form novalidate>
        <h1 id="${this.id}-viewer-title" class="sr-only">3D Bookcase Configurator</h1>

        <header class="configurator-experience-toolbar">
          <div class="configurator-experience-heading">
            <span class="section-kicker">Design Studio</span>
            <strong data-mode-description>Build your bookcase one step at a time.</strong>
          </div>
          <div class="configurator-mode-selector" role="tablist" aria-label="Configuration experience">
            <button id="${this.id}-mode-guided" type="button" role="tab" data-configurator-mode="guided" aria-controls="${this.id}-guided-panel">
              <span>Guided Setup</span><small>Step-by-step</small>
            </button>
            <button id="${this.id}-mode-all" type="button" role="tab" data-configurator-mode="all" aria-controls="${this.id}-all-panel">
              <span>All Controls</span><small>Direct access</small>
            </button>
          </div>
        </header>

        <aside class="builder-panel configurator-panel configurator-control-experience" aria-label="Bookcase configuration controls" data-controls-scroll>
          <section id="${this.id}-guided-panel" role="tabpanel" aria-labelledby="${this.id}-mode-guided" data-mode-panel="guided"></section>
          <section id="${this.id}-all-panel" role="tabpanel" aria-labelledby="${this.id}-mode-all" data-mode-panel="all" hidden></section>
        </aside>

        <section class="studio-model configurator-model" aria-labelledby="${this.id}-viewer-title">
          <div class="preview-heading">
            <div><span>Live preview</span><small>Drag to rotate · Use +/− to zoom</small></div>
            <div class="preview-tools" role="group" aria-label="Preview zoom and reset controls">
              <button type="button" data-viewer-zoom="in" aria-label="Zoom in">+</button>
              <button type="button" data-viewer-zoom="out" aria-label="Zoom out">−</button>
              <button type="button" data-reset-view>Reset view</button>
            </div>
          </div>
          <div class="viewer-stage" data-3d-viewer tabindex="0" role="group" aria-roledescription="interactive 3D preview" aria-label="Built-in bookcase preview. Use arrow keys to rotate and plus or minus to zoom."></div>
          <div class="view-controls" role="group" aria-label="3D view controls">
            <button type="button" data-view="three-dimensional" aria-pressed="false"><span class="view-icon" aria-hidden="true">${builderIcons.cube}</span>3D</button>
            <button type="button" data-view="front" aria-pressed="false"><span class="view-icon" aria-hidden="true">${builderIcons.front}</span>Front</button>
            <button type="button" data-view="three-quarter" aria-pressed="true"><span class="view-icon" aria-hidden="true">${builderIcons.threeQuarter}</span>3/4</button>
            <button type="button" data-view="side" aria-pressed="false"><span class="view-icon" aria-hidden="true">${builderIcons.side}</span>Side</button>
          </div>
        </section>

        <section class="configurator-estimate-bar" aria-label="Estimate and next steps">
          <div class="configurator-price-block">
            <span class="price-kicker">Estimated project price</span>
            <strong data-price>${formatPrice(this.price)}</strong>
          </div>
          <p id="${this.id}-action-hint" class="configurator-quote-note" data-action-hint aria-live="polite">Final pricing is confirmed after measurements and project details are verified.</p>
          <div class="configurator-actions">
            <button class="configurator-review-button" type="button" data-review-design>Review Design</button>
            <button class="configurator-save-button" type="button" data-save-design aria-label="Save Design">${builderIcons.bookmark}<span>Save Design</span></button>
            <button class="configurator-quote-button" type="button" data-open-order="measurement">Request a Quote</button>
          </div>
        </section>

        <dialog class="configurator-review-dialog" data-review-dialog aria-labelledby="${this.id}-review-dialog-title">
          <div class="configurator-review-dialog-shell">
            <div class="configurator-review-dialog-heading">
              <div><span class="section-kicker">Review Design</span><h2 id="${this.id}-review-dialog-title">Your custom bookcase</h2></div>
              <button type="button" data-close-review aria-label="Close design review">×</button>
            </div>
            <div data-review-dialog-content></div>
          </div>
        </dialog>

        <p class="status-message" data-builder-status role="status" aria-live="polite"></p>
      </form>
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
        this.elements.controlsScroll.scrollTop = options.resetScroll ? 0 : this.scrollPositions[this.mode] || 0;
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
        <ol class="guided-progress" aria-label="Guided setup progress">
          ${GUIDED_STEPS.map((item, index) => `
            <li class="${index < stepIndex ? "is-complete" : ""} ${index === stepIndex ? "is-current" : ""}">
              <button type="button" data-guided-step="${item.id}" aria-label="Step ${index + 1}: ${item.label}" ${index === stepIndex ? 'aria-current="step"' : ""}>
                <span>${index + 1}</span><small>${item.shortLabel}</small>
              </button>
            </li>
          `).join("")}
        </ol>
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
            : '<button type="button" class="guided-continue is-primary" data-guided-continue>Continue</button>'}
        </nav>
      </div>
    `;
  }

  renderGuidedStepContent(stepId) {
    if (stepId === "layout") {
      return `
        ${this.renderLayoutCards("guided")}
        <div class="guided-inline-actions">
          <button type="button" data-use-recommended="layout">Use recommended</button>
          <button type="button" data-not-sure="layout">I’m not sure</button>
        </div>
      `;
    }
    if (stepId === "dimensions") {
      return `
        ${this.renderDimensionsGroup()}
        <aside class="guided-tip"><strong>Helpful starting point</strong><span>15 inches works well for books and display pieces. Cabinet storage often benefits from 16–18 inches.</span></aside>
        <div class="guided-inline-actions">
          <button type="button" data-use-recommended="dimensions">Use layout dimensions</button>
          <button type="button" data-not-sure="dimensions">I’m not sure about measurements</button>
        </div>
      `;
    }
    if (stepId === "storage") return this.renderStorageGroup();
    if (stepId === "construction") {
      return `${this.renderStructureGroup()}${this.renderDoorGroup()}`;
    }
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
    const applicability = category.id === "doors" ? "doors" : category.id === "hardware" ? "hardware" : "";
    return `
      <section class="configurator-category" data-category="${category.id}" ${applicability ? `data-applicability="${applicability}"` : ""}>
        <h3>
          <button id="${panelId}-trigger" type="button" data-category-trigger="${category.id}" aria-expanded="${expanded}" aria-controls="${panelId}">
            <span>${escapeHtml(category.label)}<small data-category-summary="${escapeHtml(category.id)}">${escapeHtml(getCategorySummary(category.id, this.state, this.layout, this.basePresetId))}</small></span>
            <i aria-hidden="true">${expanded ? "−" : "+"}</i>
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
    if (categoryId === "storage") return this.renderStorageGroup();
    if (categoryId === "construction") return this.renderStructureGroup();
    if (categoryId === "doors") return this.renderDoorGroup();
    if (categoryId === "finish") return this.renderFinishGroup();
    if (categoryId === "hardware") return this.renderHardwareGroup();
    if (categoryId === "lighting") return this.renderLightingGroup();
    if (categoryId === "service") return this.renderServiceGroup();
    return "";
  }

  renderLayoutCards(context = "guided") {
    return `
      <div class="layout-card-grid is-${context}" role="group" aria-label="Bookcase layouts">
        ${layoutPresets.map((preset, index) => `
          <button class="layout-card" type="button" data-preset-id="${preset.id}" aria-pressed="false">
            ${this.renderPresetMini(preset, index + 1)}
            <span class="layout-card-copy"><strong>${preset.name}</strong><small>${preset.description}</small></span>
            ${preset.id === "lower-cabinets" ? '<span class="recommended-badge">Recommended</span>' : ""}
            <span class="layout-card-check" aria-hidden="true">${builderIcons.check}</span>
          </button>
        `).join("")}
      </div>
    `;
  }

  renderStorageGroup() {
    return `
      <section class="control-section control-section-storage">
        ${this.renderStepperControl("sections", "Vertical sections", 1, 6)}
        ${this.renderStepperControl("shelves", "Shelves per section", 2, 8)}
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
        <aside class="guided-tip"><strong>Built safely</strong><span>Section and shelf counts are automatically reconciled with structural clearances.</span></aside>
      </section>
    `;
  }

  renderDoorGroup() {
    const styles = doorStyleOptions.map((option) => `
      <label class="option-card compact-option-card">
        <input data-field="doorStyle" name="${this.id}-doorStyle" type="radio" value="${option.value}">
        <span><strong>${option.label}</strong><small>${option.value === "glass" ? "Framed glass display door" : "Furniture-grade cabinet front"}</small></span>
      </label>
    `).join("");
    const counts = [2, 4, 6, 8, 10, 12].map((count) => `
      <label><input data-field="doorCount" name="${this.id}-doorCount" type="radio" value="${count}"><span>${count}</span></label>
    `).join("");
    return `
      <section class="control-section control-section-doors" data-applicability="doors">
        <fieldset class="choice-field" data-applicability="doors">
          <legend>Door style</legend>
          <div class="option-card-grid">${styles}</div>
        </fieldset>
        <fieldset class="choice-field" data-applicability="doors">
          <legend>Door count</legend>
          <div class="segmented-options door-count-options" data-door-options>${counts}</div>
          <p class="control-helper">Door count follows valid section openings so every front remains usable.</p>
        </fieldset>
      </section>
    `;
  }

  renderAppearanceExperience() {
    const applicability = getApplicability(this.state, this.layout);
    if (this.appearanceTab === "hardware" && !applicability.showHardware) this.appearanceTab = "finish";
    const tabs = [
      { id: "finish", label: "Finish", available: true },
      { id: "hardware", label: "Hardware", available: applicability.showHardware },
      { id: "lighting", label: "Lighting", available: true }
    ];
    return `
      <div class="appearance-tabs" role="tablist" aria-label="Appearance options">
        ${tabs.filter((tab) => tab.available).map((tab) => `
          <button id="${this.id}-appearance-${tab.id}" type="button" role="tab" data-appearance-tab="${tab.id}" aria-controls="${this.id}-appearance-panel" aria-selected="${this.appearanceTab === tab.id}" tabindex="${this.appearanceTab === tab.id ? "0" : "-1"}">${tab.label}</button>
        `).join("")}
      </div>
      <div id="${this.id}-appearance-panel" class="appearance-panel" role="tabpanel" aria-labelledby="${this.id}-appearance-${this.appearanceTab}">
        ${this.appearanceTab === "finish" ? this.renderFinishGroup() : this.appearanceTab === "hardware" ? this.renderHardwareGroup() : this.renderLightingGroup()}
      </div>
    `;
  }

  renderServiceGroup() {
    const deliveries = deliveryOptions.map((option) => `
      <label class="option-card compact-option-card"><input data-field="delivery" name="${this.id}-delivery" type="radio" value="${option.value}"><span><strong>${option.label}</strong></span></label>
    `).join("");
    const installations = installationOptions.map((option) => `
      <label class="option-card compact-option-card"><input data-field="installation" name="${this.id}-installation" type="radio" value="${option.value}"><span><strong>${option.label}</strong></span></label>
    `).join("");
    return `
      <section class="control-section control-section-service">
        <fieldset class="choice-field"><legend>Delivery</legend><div class="option-card-grid">${deliveries}</div></fieldset>
        <fieldset class="choice-field"><legend>Installation</legend><div class="option-card-grid">${installations}</div></fieldset>
      </section>
    `;
  }

  renderReviewContent({ includeActions = true } = {}) {
    const groups = createReviewGroups(this.state, this.layout, this.basePresetId);
    const corrections = this.layout?.corrections || [];
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
        ${this.state.finish === "custom_bm" ? `<aside class="review-paint-disclaimer" aria-label="Digital paint preview notice">${escapeHtml(BENJAMIN_MOORE_COLOR_DATA_NOTICE)}</aside>` : ""}
        <div class="review-estimate">
          <span>Estimated project price</span><strong>${formatPrice(this.price)}</strong>
          <p>Final pricing is confirmed after measurements and project details are verified.</p>
        </div>
        ${includeActions ? `
          <div class="review-actions">
            <button type="button" data-save-design aria-label="Save Design">${builderIcons.bookmark}<span>Save Design</span></button>
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
      </section>
    `;
  }

  renderStructureGroup() {
    const thicknesses = shelfThicknessOptions.map((option) => `
      <div class="structure-choice">
        <input id="${this.id}-shelfThickness-${option.value}" data-field="shelfThickness" name="${this.id}-shelfThickness" type="radio" value="${option.value}">
        <label for="${this.id}-shelfThickness-${option.value}">${option.label}</label>
      </div>
    `).join("");
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
        <h2><span class="control-heading-icon" aria-hidden="true">${builderIcons.structure}</span>Structure</h2>
        <fieldset class="structure-field">
          <legend>Shelf Thickness</legend>
          <div class="thickness-grid">${thicknesses}</div>
        </fieldset>
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
          <button class="additional-colors-button" type="button" data-toggle-color-search>${selected ? "Change Benjamin Moore color" : "Benjamin Moore Search"}</button>
          <div class="bm-search" data-custom-bm-fields ${this.showColorSearch || this.state.finish === "custom_bm" ? "" : "hidden"}>
            <div class="bm-search-heading"><strong>Benjamin Moore Color</strong><span>Search by color name or code.</span></div>
            ${selectedCard}
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
            <span class="hardware-choice-icon" aria-hidden="true">${hardwarePreviewIcons[option.value]}</span>
            <span>${option.label}</span>
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
      form: this.host.querySelector("[data-builder-form]"),
      price: this.host.querySelector("[data-price]"),
      status: this.host.querySelector("[data-builder-status]"),
      controlsScroll: this.host.querySelector("[data-controls-scroll]"),
      guidedPanel: this.host.querySelector('[data-mode-panel="guided"]'),
      allPanel: this.host.querySelector('[data-mode-panel="all"]'),
      modeDescription: this.host.querySelector("[data-mode-description]"),
      reviewDialog: this.host.querySelector("[data-review-dialog]"),
      reviewDialogContent: this.host.querySelector("[data-review-dialog-content]")
    };
  }

  bindEvents() {
    this.host.addEventListener("pointerdown", (event) => {
      const range = event.target.closest?.('.range-control input[type="range"][data-field]');
      if (!range || !this.host.contains(range)) return;
      this.beginRangeDrag(event, range);
    });
    this.host.addEventListener("pointermove", (event) => this.updateRangeDrag(event));
    this.host.addEventListener("pointerup", (event) => this.endRangeDrag(event));
    this.host.addEventListener("pointercancel", (event) => this.endRangeDrag(event));

    this.host.addEventListener("input", (event) => {
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
      const field = event.target.closest?.("[data-field]");
      if (!field || !this.host.contains(field)) return;
      if (field.type !== "radio" && field.type !== "checkbox" && field.tagName !== "SELECT") return;
      this.handleFieldInput(field);
    });

    this.host.addEventListener("keydown", (event) => {
      const modeButton = event.target.closest?.("[data-configurator-mode]");
      if (modeButton) {
        this.handleModeSelectorKeydown(event, modeButton);
        return;
      }
      const appearanceButton = event.target.closest?.("[data-appearance-tab]");
      if (appearanceButton) this.handleAppearanceTabsKeydown(event, appearanceButton);
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
    const modeButton = target.closest?.("[data-configurator-mode]");
    if (modeButton) {
      this.switchMode(modeButton.dataset.configuratorMode);
      return;
    }
    const guidedStep = target.closest?.("[data-guided-step]");
    if (guidedStep) {
      this.goToGuidedStep(guidedStep.dataset.guidedStep);
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
      this.toggleCategory(categoryTrigger.dataset.categoryTrigger);
      return;
    }
    const appearanceTab = target.closest?.("[data-appearance-tab]");
    if (appearanceTab) {
      this.setAppearanceTab(appearanceTab.dataset.appearanceTab, { focus: true });
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
      this.setView(viewButton.dataset.view);
      return;
    }
    const zoomButton = target.closest?.("[data-viewer-zoom]");
    if (zoomButton) {
      this.viewer.zoom(zoomButton.dataset.viewerZoom === "in" ? -1 : 1);
      this.syncDiagnosticsAttributes();
      return;
    }
    if (target.closest?.("[data-reset-view]")) {
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
    if (target.closest?.("[data-toggle-color-search]")) {
      this.showColorSearch = true;
      this.host.querySelectorAll("[data-custom-bm-fields]").forEach((panel) => {
        panel.hidden = false;
      });
      this.host.querySelector("[data-bm-query]")?.focus();
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

  handleAppearanceTabsKeydown(event, button) {
    const buttons = [...this.host.querySelectorAll("[data-appearance-tab]")];
    const index = buttons.indexOf(button);
    let nextIndex = index;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % buttons.length;
    else if (event.key === "ArrowLeft") nextIndex = (index - 1 + buttons.length) % buttons.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = buttons.length - 1;
    else return;
    event.preventDefault();
    this.setAppearanceTab(buttons[nextIndex]?.dataset.appearanceTab, { focus: true });
  }

  switchMode(nextMode, options = {}) {
    const normalizedMode = normalizeConfiguratorMode(nextMode);
    const previousMode = this.mode;
    const shouldOpenSharedReview = previousMode === CONFIGURATOR_MODES.guided
      && normalizedMode === CONFIGURATOR_MODES.all
      && this.guidedStep === "review"
      && !options.category;
    if (normalizedMode === CONFIGURATOR_MODES.all) {
      this.expandedCategory = normalizeAllCategory(options.category || categoryForGuidedStep(options.guidedStep || this.guidedStep, this.appearanceTab));
      this.savePreference(CONFIGURATOR_PREFERENCE_KEYS.allCategory, this.expandedCategory);
    } else {
      this.guidedStep = normalizeGuidedStep(options.guidedStep || guidedStepForCategory(this.expandedCategory));
      this.savePreference(CONFIGURATOR_PREFERENCE_KEYS.guidedStep, this.guidedStep);
    }
    this.mode = normalizedMode;
    this.savePreference(CONFIGURATOR_PREFERENCE_KEYS.mode, this.mode);
    this.renderActiveControls({ previousMode });
    this.syncInterface();
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
    this.guidedStep = nextStep;
    this.savePreference(CONFIGURATOR_PREFERENCE_KEYS.guidedStep, this.guidedStep);
    this.renderActiveControls({ previousMode: this.mode, resetScroll: true });
    this.syncInterface();
    this.focusGuidedHeading();
  }

  focusGuidedHeading() {
    window.requestAnimationFrame(() => {
      this.host.querySelector("[data-guided-heading]")?.focus({ preventScroll: true });
    });
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
      if (icon) icon.textContent = open ? "−" : "+";
      if (panel) panel.hidden = !open;
    });
  }

  setAppearanceTab(tabId, options = {}) {
    const applicability = getApplicability(this.state, this.layout);
    const allowed = ["finish", "lighting", ...(applicability.showHardware ? ["hardware"] : [])];
    this.appearanceTab = allowed.includes(tabId) ? tabId : "finish";
    this.renderActiveControls({ previousMode: this.mode });
    this.syncInterface();
    if (options.focus) this.host.querySelector('[data-appearance-tab="' + this.appearanceTab + '"]')?.focus();
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
      this.showStatus("Choose “Confirm start over” to reset the physical design. Your preview view will stay in place.");
      return;
    }
    try {
      localStorage.removeItem("jqBookcasesDesign");
    } catch (error) {
      // Reset remains available when storage is unavailable.
    }
    this.basePresetId = defaultBookcaseConfig.layoutPreset;
    this.drafts = {};
    this.clearResetConfirmation();
    this.update(defaultBookcaseConfig, { sourceField: "reset" });
    this.renderActiveControls({ previousMode: this.mode });
    this.syncInterface();
    this.showStatus("Design reset to the recommended Full Bookcase. Your preview view is unchanged.");
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
    this.basePresetId = transition.preset.id;
    this.drafts = {};
    this.update(transition.config, { sourceField: "layoutPreset" });
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
      "doorCount",
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
    if (fieldName === "customPaintColor" && String(value).trim()) next.finish = "custom_bm";
    this.update(next, { sourceField: fieldName });
  }

  handleStepperClick(button) {
    const fieldName = button.dataset.stepField;
    const input = this.host.querySelector(`input[data-field="${fieldName}"]`);
    if (!input) return;
    const direction = Number(button.dataset.stepDirection) || 0;
    const min = Number(input.min) || Number.NEGATIVE_INFINITY;
    const max = Number(input.max) || Number.POSITIVE_INFINITY;
    const step = Number(input.step) || 1;
    const nextValue = clamp((Number(input.value) || min) + direction * step, min, max);
    input.value = nextValue;
    delete this.drafts[fieldName];
    this.update({ ...this.state, [fieldName]: nextValue }, { sourceField: fieldName });
  }

  update(nextState, options = {}) {
    const previousState = this.state;
    const normalizedState = normalizeBookcaseConfig(nextState);
    const nextLayout = generateBookcaseLayout(normalizedState);
    const correctedState = normalizeBookcaseConfig({ ...normalizedState, ...nextLayout.config });
    correctedState.layoutPreset = this.findMatchingPresetId(correctedState);
    const changedFields = getChangedConfigFields(previousState, correctedState);

    this.layout = nextLayout;
    this.state = correctedState;
    if (!changedFields.length) {
      this.syncInterface();
      if (options.sourceField) this.clearStatus();
      return;
    }

    this.updateCount += 1;
    this.pricing = buildPricingContext(this.state, this.layout);
    this.price = this.pricing.total;
    this.priceCalculationCount += 1;
    this.viewer.update(this.state, this.layout, changedFields);
    if (changedFields.some((field) => ["finish", "customPaintColor", "customPaintCode", "customPaintHex", "paintSelection"].includes(field))) {
      this.renderActiveControls({ previousMode: this.mode });
    }
    if (this.appearanceTab === "hardware" && !getApplicability(this.state, this.layout).showHardware) {
      this.appearanceTab = "finish";
      this.renderActiveControls({ previousMode: this.mode });
    }
    this.renderDoorOptions();
    this.syncInterface();

    if (!this.layout.validation.valid) {
      this.showStatus(this.layout.validation.errors[0]?.message || "This configuration is not structurally valid.", true);
    } else if (this.layout.corrections.length) {
      this.showStatus(this.layout.corrections.map((correction) => correction.message || correction).join(" "));
    } else if (options.sourceField) {
      this.clearStatus();
    }
  }

  renderDoorOptions() {
    const allowed = new Set(getDoorCountOptions(this.state.width, this.state.sections).map(String));
    this.host.querySelectorAll("[data-door-options] input[data-field=\"doorCount\"]").forEach((input) => {
      const available = allowed.has(String(input.value));
      input.disabled = !available;
      input.closest("label")?.toggleAttribute("hidden", !available);
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
      customPanel.hidden = !(this.showColorSearch || customSelected);
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
    if (!this.elements?.shell) return;
    this.elements.shell.dataset.interfaceMode = this.mode;
    this.elements.shell.classList.toggle("is-guided-mode", this.mode === CONFIGURATOR_MODES.guided);
    this.elements.shell.classList.toggle("is-all-controls-mode", this.mode === CONFIGURATOR_MODES.all);
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

  syncDiagnosticsAttributes() {
    const shell = this.elements?.shell;
    if (!shell) return;
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
    shell.dataset.diagnosticCanvasCount = String(this.elements.viewer?.querySelectorAll("canvas").length || 0);
    shell.dataset.diagnosticActiveView = this.activeView;
    shell.dataset.diagnosticView = JSON.stringify({
      theta: Number(view.theta || 0).toFixed(5),
      phi: Number(view.phi || 0).toFixed(5),
      radiusRatio: view.baseRadius ? Number(view.radius / view.baseRadius).toFixed(5) : "0.00000"
    });
    shell.dataset.diagnosticConfiguration = JSON.stringify(this.state);
    shell.dataset.diagnosticPricing = JSON.stringify({
      pricingVersion: this.pricing.pricingVersion,
      billableQuantities: this.pricing.billableQuantities,
      componentCharges: this.pricing.componentCharges,
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
        dimensions: ["width", "height", "depth"],
        storage: ["sections", "shelves", "lowerCabinets", "lowerStorage", "drawerCount"],
        construction: ["shelfThickness", "baseStyle", "crownStyle"],
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
  }

  getDiagnostics() {
    return {
      mode: this.mode,
      guidedStep: this.guidedStep,
      expandedCategory: this.expandedCategory,
      state: { ...this.state },
      price: this.price,
      pricing: {
        pricingVersion: this.pricing.pricingVersion,
        billableQuantities: this.pricing.billableQuantities,
        componentCharges: this.pricing.componentCharges
      },
      updateCount: this.updateCount,
      priceCalculationCount: this.priceCalculationCount,
      saveActionCount: this.saveActionCount,
      quoteActionCount: this.quoteActionCount,
      viewer: this.viewer.getDiagnostics?.(),
      view: this.viewer.getViewState?.(),
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
    const design = createSavedDesignRecord(this.state, this.price);
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

  clearStatus() {
    window.clearTimeout(this.statusTimer);
    this.elements.status.textContent = "";
    this.elements.status.classList.remove("is-visible");
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
    this.target = new THREE.Vector3(0, inchesToUnits(this.state.height) / 2, 0);
    this.theta = -0.14;
    this.phi = 0.12;
    this.baseRadius = 12;
    this.radius = 0;
    this.drag = null;
    this.model = new THREE.Group();
    this.scene.add(this.model);
    this.setupEnvironment();
    this.bindControls();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.root);
    this.resize();
    this.update(this.state, initialLayout, ["initial"]);
    this.animate();
  }

  setupEnvironment() {
    this.scene.fog = new THREE.FogExp2(0x302b26, 0.006);
    this.scene.add(new THREE.HemisphereLight(0xf7f1e8, 0x2b2824, 1.7));

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
      this.drag = { x: event.clientX, y: event.clientY };
      this.root.setPointerCapture(event.pointerId);
      this.root.classList.add("is-dragging");
    }, { signal });

    this.root.addEventListener("pointermove", (event) => {
      if (!this.drag) return;
      const dx = event.clientX - this.drag.x;
      const dy = event.clientY - this.drag.y;
      this.drag = { x: event.clientX, y: event.clientY };
      this.theta -= dx * 0.007;
      this.phi = clamp(this.phi + dy * 0.004, -0.12, 0.72);
      this.onCameraInteraction("rotate");
      this.updateCamera();
    }, { signal });

    this.root.addEventListener("pointerup", (event) => {
      this.drag = null;
      if (this.root.hasPointerCapture(event.pointerId)) this.root.releasePointerCapture(event.pointerId);
      this.root.classList.remove("is-dragging");
    }, { signal });

    this.root.addEventListener("pointercancel", () => {
      this.drag = null;
      this.root.classList.remove("is-dragging");
    }, { signal });

    this.root.addEventListener("wheel", (event) => {
      if (event.ctrlKey || event.metaKey) return;
      if (window.matchMedia("(max-width: 1280px)").matches) return;
      event.preventDefault();
      this.radius = clamp(this.radius + event.deltaY * 0.008, this.baseRadius * 0.82, this.baseRadius * 1.58);
      this.onCameraInteraction("zoom");
      this.updateCamera();
    }, { passive: false, signal });

    this.root.addEventListener("keydown", (event) => {
      if (event.ctrlKey || event.metaKey) return;
      if (event.key === "ArrowLeft") this.theta -= 0.12;
      else if (event.key === "ArrowRight") this.theta += 0.12;
      else if (event.key === "ArrowUp") this.phi = clamp(this.phi + 0.08, -0.12, 0.72);
      else if (event.key === "ArrowDown") this.phi = clamp(this.phi - 0.08, -0.12, 0.72);
      else if (event.key === "+" || event.key === "=") this.radius = clamp(this.radius * 0.9, this.baseRadius * 0.82, this.baseRadius * 1.58);
      else if (event.key === "-") this.radius = clamp(this.radius * 1.1, this.baseRadius * 0.82, this.baseRadius * 1.58);
      else return;
      event.preventDefault();
      this.onCameraInteraction(event.key === "+" || event.key === "=" || event.key === "-" ? "zoom" : "rotate");
      this.updateCamera();
    }, { signal });
  }

  setView(view) {
    if (view === "front") {
      this.theta = 0;
      this.phi = 0.08;
    } else if (view === "side") {
      this.theta = Math.PI / 2;
      this.phi = 0.12;
    } else if (view === "three-quarter") {
      this.theta = -0.14;
      this.phi = 0.12;
    } else if (view === "three-dimensional") {
      this.theta = -0.42;
      this.phi = 0.2;
    } else {
      this.theta = -0.14;
      this.phi = 0.12;
    }
    if (view === "reset") this.radius = this.baseRadius;
    this.updateCamera();
  }

  zoom(direction) {
    const scale = Number(direction) < 0 ? 0.9 : 1.1;
    this.radius = clamp(this.radius * scale, this.baseRadius * 0.82, this.baseRadius * 1.58);
    this.onCameraInteraction("zoom");
    this.updateCamera();
  }

  resize() {
    const rect = this.root.getBoundingClientRect();
    const width = Math.max(320, rect.width);
    const height = Math.max(340, rect.height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    if (this.model?.children?.length) this.frameModel(true);
  }

  update(nextState, precomputedLayout = null, changedFields = null) {
    const previousState = this.state;
    const next = normalizeBookcaseConfig(nextState);
    const changes = Array.isArray(changedFields) ? changedFields : getChangedConfigFields(previousState, next);
    this.state = next;
    this.updateCount += 1;

    if (this.model?.children?.length && this.applyPartialUpdate(previousState, next, changes)) {
      this.partialUpdateCount += 1;
      return;
    }

    this.rebuildModel(precomputedLayout);
    this.frameModel(true);
  }

  applyPartialUpdate(previousState, nextState, changedFields) {
    const changed = new Set(changedFields);
    const finishFields = new Set(["finish", "customPaintColor", "customPaintCode", "customPaintHex", "paintSelection"]);
    const onlyFinish = changed.size > 0 && [...changed].every((field) => finishFields.has(field));
    if (onlyFinish) {
      this.applyFinishMaterials(nextState);
      return true;
    }
    if (changed.size === 1 && changed.has("lightingWarmth")) {
      this.applyLightingWarmth(nextState.lightingWarmth);
      return true;
    }
    if (changed.size === 1 && changed.has("hardware") && getHardwareShape(previousState.hardware) === getHardwareShape(nextState.hardware)) {
      this.applyHardwareMaterial(nextState.hardware);
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
      if (child.isPointLight) child.color.setHex(color);
    });
  }

  frameModel(preserveZoom = true) {
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
    this.target.set(center.x, center.y + size.y * (compactAspect ? 0.01 : -0.025), center.z);
    const ratio = clamp(previousRatio || 1, 0.84, 1.48);
    this.radius = this.baseRadius * ratio;
    this.updateCamera();
  }

  rebuildModel(precomputedLayout = null) {
    const nextModel = buildBookcaseModel(this.state, precomputedLayout);
    this.lastLayout = nextModel.userData.layout;
    if (!this.lastLayout.validation.valid) {
      disposeMaterialSet(nextModel.userData.materials);
      disposeObject(nextModel);
      return;
    }
    this.scene.remove(this.model);
    disposeMaterialSet(this.model?.userData?.materials);
    disposeObject(this.model);
    this.model = nextModel;
    this.scene.add(this.model);
    this.rebuildCount += 1;
  }

  updateCamera() {
    const horizontal = Math.cos(this.phi) * this.radius;
    this.camera.position.set(
      Math.sin(this.theta) * horizontal,
      this.target.y + Math.sin(this.phi) * this.radius,
      Math.cos(this.theta) * horizontal
    );
    this.camera.lookAt(this.target);
  }

  animate() {
    if (this.destroyed) return;
    this.renderer.render(this.scene, this.camera);
    this.animationFrame = window.requestAnimationFrame(() => this.animate());
  }

  getViewState() {
    return {
      theta: this.theta,
      phi: this.phi,
      radius: this.radius,
      baseRadius: this.baseRadius
    };
  }

  getDiagnostics() {
    return {
      instanceId: this.instanceId,
      updateCount: this.updateCount,
      rebuildCount: this.rebuildCount,
      partialUpdateCount: this.partialUpdateCount,
      canvasConnected: Boolean(this.renderer.domElement?.isConnected)
    };
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.controlAbortController?.abort();
    window.cancelAnimationFrame(this.animationFrame);
    this.resizeObserver?.disconnect();
    this.scene.remove(this.model);
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
    pointLightCount: 0
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

  layout.components.forEach((component, index) => {
    if (logicalRoles.has(component.role)) return;
    const componentGroup = componentGroups.get(component.id) || group;
    renderLayoutComponent(componentGroup, group, component, config, materials, depth, index);
  });

  return group;
}

function renderLayoutComponent(componentGroup, rootGroup, component, config, materials, bookcaseDepth, index) {
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
    const doorConfig = component.role === "drawer_front"
      ? { ...config, doorStyle: "flat" }
      : { ...config, doorStyle: component.metadata?.style || config.doorStyle };
    addDoor(componentGroup, doorConfig, materials, size, position, {
      openingSide: component.metadata?.hingeSide || component.metadata?.openingSide
    });
    return;
  }

  if (component.role === "handle") {
    addLayoutHandle(componentGroup, component, config, materials, size, position);
    return;
  }

  if (component.role === "light") {
    addLayoutLight(componentGroup, rootGroup, component, materials, size, position);
    return;
  }

  if (component.role === "shelf") {
    addShelf(componentGroup, materials, size, position, bookcaseDepth);
    return;
  }

  if (component.role === "base") {
    renderLayoutBase(componentGroup, component, config, materials, size, position);
    return;
  }

  if (component.role === "crown") {
    renderLayoutCrown(componentGroup, component, config, materials, bookcaseDepth);
    return;
  }

  if (component.role === "trim" && component.metadata?.style === config.baseStyle) return;

  const material = getLayoutMaterial(component, materials);
  addBox(componentGroup, size, position, material, !["trim", "crown", "base"].includes(component.role));
}

function getLayoutMaterial(component, materials) {
  if (component.role === "back_panel") return materials.back;
  if (component.metadata?.purpose === "recess") return materials.shadow;
  return materials.case;
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
    const puck = new THREE.Mesh(new THREE.CylinderGeometry(Math.max(size[0], size[2]) * 0.5, Math.max(size[0], size[2]) * 0.5, size[1], 20), materials.puckLight);
    puck.position.set(...position);
    puck.castShadow = false;
    group.add(puck);
  } else {
    addBox(group, size, position, materials.ledStrip, false);
  }

  if (rootGroup.userData.pointLightCount >= 18) return;
  const temperature = Number(component.metadata?.warmth) || 2700;
  const color = getLightingTemperatureColor(temperature);
  const glow = new THREE.PointLight(color, type === "puck" ? 0.4 : 0.11, type === "puck" ? 2.2 : 1.5);
  glow.position.set(position[0], position[1] - (type === "vertical_led" ? 0 : 0.09), position[2] + 0.045);
  group.add(glow);
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
    puckLight: new THREE.MeshStandardMaterial({ color: lightColor, emissive: lightColor, emissiveIntensity: 1.25, roughness: 0.35, metalness: 0.08 }),
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
