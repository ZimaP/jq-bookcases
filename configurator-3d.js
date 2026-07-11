import * as THREE from "./assets/vendor/three.module.js";
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
} from "./bookcase-config.js?v=site-system-20260710a";
import { generateBookcaseLayout } from "./bookcase-layout.js?v=site-system-20260710a";
import { calculateBookcasePrice, formatPrice } from "./bookcase-pricing.js?v=site-system-20260710a";
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
  findExactBenjaminMooreColor,
  searchBenjaminMooreColors
} from "./benjamin-moore-colors.js?v=site-system-20260710a";

const numericFields = new Set(["width", "height", "depth", "sections", "shelves", "shelfThickness", "lightingWarmth", "doorCount"]);
const benjaminMooreColorsUrl = "https://www.benjaminmoore.com/en-us/paint-colors";
const lineIconSvg = (paths) => `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    ${paths}
  </svg>
`;
const builderIcons = {
  dimensions: lineIconSvg(`<path d="m4.4 16.8 12.4-12.4 2.8 2.8L7.2 19.6z"/><path d="m8.6 16.1-1.7-1.7"/><path d="m11.3 13.4-1.7-1.7"/><path d="m14 10.7-1.7-1.7"/><path d="m16.7 8-1.7-1.7"/>`),
  layout: lineIconSvg(`<path d="M4.5 5.2h6.2v5.1H4.5zM13.3 5.2h6.2v8.1h-6.2zM4.5 12.9h6.2v5.9H4.5zM13.3 15.9h6.2v2.9h-6.2z"/>`),
  structure: lineIconSvg(`<path d="m12 3.5 7.2 4.2v8.5L12 20.5l-7.2-4.3V7.7z"/><path d="m8.6 9.6 3.4 2 3.4-2M12 11.6v4.6"/>`),
  lighting: lineIconSvg(`<path d="M8.1 14.8c-1.3-1.1-2.1-2.7-2.1-4.5a6 6 0 1 1 12 0c0 1.8-.8 3.4-2.1 4.5-.8.7-1.1 1.4-1.2 2.2H9.3c-.1-.8-.4-1.5-1.2-2.2z"/><path d="M9.6 20h4.8M9.4 17h5.2"/>`),
  finish: lineIconSvg(`<path d="M4.3 6.2h10.2v4.1H4.3z"/><path d="M7.1 10.3v2.6h4.7v7.2H7.1v-7.2M14.5 7.4h2.8c1.4 0 2.4 1 2.4 2.3v1.1"/>`),
  hardware: lineIconSvg(`<path d="M4.2 8.2h15.6v7.6H4.2z"/><path d="M8.1 12h7.8M6.2 10.2v3.6M17.8 10.2v3.6"/>`),
  bookmark: lineIconSvg(`<path d="M6.4 4.2h11.2v16l-5.6-3.5-5.6 3.5z"/><path d="M9.2 7.7h5.6"/>`),
  search: lineIconSvg(`<circle cx="10.7" cy="10.7" r="5.8"/><path d="m15.1 15.1 4.4 4.4"/>`),
  chevronLeft: lineIconSvg(`<path d="m14.7 5.5-6.5 6.5 6.5 6.5"/>`),
  chevronRight: lineIconSvg(`<path d="m9.3 5.5 6.5 6.5-6.5 6.5"/>`),
  reset: lineIconSvg(`<path d="M4.8 9.1a7.4 7.4 0 1 1 1.9 7.6"/><path d="M4.8 9.1V4.7"/><path d="M4.8 9.1h4.4"/>`),
  cube: lineIconSvg(`<path d="M12 3.7 19.2 8v8L12 20.3 4.8 16V8L12 3.7z"/><path d="M4.8 8 12 12.3 19.2 8"/><path d="M12 12.3v8"/>`),
  front: lineIconSvg(`<rect x="5.2" y="4.6" width="13.6" height="14.8" rx="1.2"/><path d="M8.2 8.2h7.6"/><path d="M8.2 12h7.6"/><path d="M8.2 15.8h7.6"/>`),
  threeQuarter: lineIconSvg(`<path d="M7 6.2h9.8l2.5 2.5v8.9H7z"/><path d="M16.8 6.2v11.4"/><path d="M7 9h12.3"/><path d="M10 12.6h4"/><path d="M10 15.6h4"/>`),
  side: lineIconSvg(`<path d="M6.4 5.2h9.8l1.4 1.4v12.2H7.8l-1.4-1.4z"/><path d="M7.8 6.6h9.8"/><path d="M7.8 6.6v12.2"/><path d="M10.4 9.8h4.8"/><path d="M10.4 14.2h4.8"/>`),
  delivery: lineIconSvg(`<path d="M3.8 7.1h9.5v8.2H3.8z"/><path d="M13.3 10h3.6l3 3v2.3h-6.6z"/><path d="M5.8 17.2a1.8 1.8 0 1 0 3.6 0 1.8 1.8 0 0 0-3.6 0z"/><path d="M15.5 17.2a1.8 1.8 0 1 0 3.6 0 1.8 1.8 0 0 0-3.6 0z"/><path d="M3.8 15.3h2"/><path d="M9.4 15.3h6.1"/>`),
  install: lineIconSvg(`<path d="m4.5 19.5 6.7-6.7"/><path d="m9.1 10.7 4.1-4.1a3.7 3.7 0 0 1 5-.3l-3.1 3.1 2.2 2.2 3.1-3.1a3.7 3.7 0 0 1-.3 5l-4.1 4.1"/><path d="m4.8 4.7 5.6 5.6"/><path d="M3.9 6.8 6.8 3.9"/>`),
  warranty: lineIconSvg(`<path d="M12 3.6 18.7 6v5.2c0 4.5-2.8 7.7-6.7 9.2-3.9-1.5-6.7-4.7-6.7-9.2V6L12 3.6z"/><path d="m8.8 12.1 2.1 2.1 4.4-4.6"/>`)
};

const productPreviewSvg = (content) => `
  <svg viewBox="0 0 64 36" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    ${content}
  </svg>
`;

const basePreviewIcons = {
  toe_kick: productPreviewSvg(`<path d="M10 8h44v17H10z"/><path d="M14 25h36v6H14"/><path d="M14 28h36"/>`),
  plinth: productPreviewSvg(`<path d="M10 7h44v19H10z"/><path d="M8 26h48v5H8z"/>`),
  furniture_base: productPreviewSvg(`<path d="M10 6h44v19H10z"/><path d="M7 25h50v4H7z"/><path d="M11 29v3M53 29v3"/>`)
};

const crownPreviewIcons = {
  none: productPreviewSvg(`<path d="M10 12h44v17H10z"/><path d="M10 12h44"/>`),
  slim_cap: productPreviewSvg(`<path d="M11 14h42v15H11z"/><path d="M8 11h48v3H8z"/>`),
  classic_crown: productPreviewSvg(`<path d="M12 16h40v13H12z"/><path d="M7 9h50v3H7z"/><path d="M9 12c0 3 3 4 3 4h40s3-1 3-4"/>`),
  modern_soffit: productPreviewSvg(`<path d="M12 9h40v20H12z"/><path d="M8 6h48v4H8z"/><path d="M10 10h44v4H10"/>`)
};

const lightingPreviewIcons = {
  no_lighting: lineIconSvg(`<circle cx="12" cy="12" r="7.2"/><path d="m7 17 10-10"/>`),
  warm_pucks: lineIconSvg(`<path d="M5 6.5h14"/><path d="M9 8.5c.6 2.3 1.6 3.5 3 3.5s2.4-1.2 3-3.5"/><path d="m9.2 15.2-1.6 2.1M12 15.7V19M14.8 15.2l1.6 2.1"/>`),
  shelf_accent: lineIconSvg(`<path d="M4.5 7h15"/><path d="M6.5 10h11"/><path d="m8 13-1.8 4M12 13v4.5M16 13l1.8 4"/>`),
  vertical_led: lineIconSvg(`<path d="M7 4.5v15M17 4.5v15"/><path d="M10 7h4M10 12h4M10 17h4"/>`),
  full_package: lineIconSvg(`<path d="M8.5 14.7c-1.2-1-2-2.5-2-4.2a5.5 5.5 0 1 1 11 0c0 1.7-.8 3.2-2 4.2-.7.6-1 1.3-1.1 2H9.6c-.1-.7-.4-1.4-1.1-2z"/><path d="M9.8 19.5h4.4M4.2 8.5H2M22 8.5h-2.2M5.2 3.7 3.7 2.2M18.8 3.7l1.5-1.5"/>`)
};

const hardwarePreviewIcons = {
  brass_knob: productPreviewSvg(`<circle cx="32" cy="15" r="7"/><path d="M32 22v7M27 30h10"/>`),
  matte_black_knob: productPreviewSvg(`<circle cx="32" cy="15" r="7"/><path d="M32 22v7M27 30h10"/>`),
  brass_pull: productPreviewSvg(`<path d="M14 19h36"/><path d="M18 19v7M46 19v7"/><path d="M15 16h34"/>`),
  matte_black_pull: productPreviewSvg(`<path d="M14 19h36"/><path d="M18 19v7M46 19v7"/><path d="M15 16h34"/>`),
  polished_nickel_pull: productPreviewSvg(`<path d="M14 19h36"/><path d="M18 19v7M46 19v7"/><path d="M15 16h34"/>`)
};
const finishPalette = {
  white_dove: 0xeee9dc,
  simply_white: 0xf5f0e4,
  chantilly_lace: 0xf7f5ee,
  cloud_white: 0xeee8dc,
  silver_satin: 0xd8d7d2,
  custom_bm: 0xd3c8b8
};

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-bookcase-builder]").forEach((host, index) => {
    new BookcaseConfigurator(host, index);
  });
});

class BookcaseConfigurator {
  constructor(host, index) {
    this.host = host;
    this.id = `jq-builder-${index + 1}`;
    const initialEvaluation = evaluateBookcaseCandidate(this.loadInitialConfig());
    const acceptedInitial = initialEvaluation.accepted
      ? initialEvaluation
      : evaluateBookcaseCandidate(defaultBookcaseConfig);
    if (!acceptedInitial.accepted) throw new Error("The default bookcase configuration must be valid.");
    this.acceptedEvaluation = acceptedInitial;
    this.state = acceptedInitial.state;
    this.layout = acceptedInitial.layout;
    this.bom = acceptedInitial.bom;
    this.pricing = acceptedInitial.pricing;
    this.activeView = "three-quarter";
    this.doorOptionKey = "";
    this.activeRangeDrag = null;
    this.render();
    this.cacheElements();
    this.viewer = this.createViewer();
    this.bindEvents();
    this.update(this.state, { silent: true });
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
      if (!stored || ![2, 3, 4].includes(Number(stored.schemaVersion))) return defaultBookcaseConfig;
      const restored = restoreAcceptedDesignSnapshot(stored);
      return restored.accepted ? restored.state : defaultBookcaseConfig;
    } catch (error) {
      return defaultBookcaseConfig;
    }
  }

  createViewer() {
    if (!isWebGLAvailable()) return this.createViewerFallback();
    try {
      return new BookcaseViewer3D(this.elements.viewer, this.state);
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
      lastRenderAudit: { valid: true, issues: [] }
    };
  }

  render() {
    this.renderFullPageConfigurator();
  }

  renderFullPageConfigurator() {
    this.host.innerHTML = `
      <form class="builder-shell configurator-shell" data-builder-form>
        <h1 id="${this.id}-viewer-title" class="sr-only">3D Bookcase Configurator</h1>
        <aside class="builder-panel configurator-panel configurator-panel-left" aria-label="Dimensions, layout, and structure controls">
          ${this.renderDimensionsGroup()}
          ${this.renderLayoutGroup()}
          ${this.renderStructureGroup()}
        </aside>

        <section class="studio-model configurator-model" aria-labelledby="${this.id}-viewer-title">
          <div class="viewer-stage" data-3d-viewer tabindex="0" role="img" aria-label="Interactive 3D built-in bookcase model"></div>
          <div class="view-controls" role="group" aria-label="3D view controls">
            <button type="button" data-view="reset"><span class="view-icon" aria-hidden="true">${builderIcons.reset}</span>Reset</button>
            <button type="button" data-view="three-dimensional"><span class="view-icon" aria-hidden="true">${builderIcons.cube}</span>3D View</button>
            <button type="button" data-view="front"><span class="view-icon" aria-hidden="true">${builderIcons.front}</span>Front</button>
            <button type="button" data-view="three-quarter"><span class="view-icon" aria-hidden="true">${builderIcons.threeQuarter}</span>3/4 View</button>
            <button type="button" data-view="side"><span class="view-icon" aria-hidden="true">${builderIcons.side}</span>Side</button>
          </div>
          <p class="viewer-helper-line">Drag to rotate &middot; Scroll to zoom &middot; Arrow keys rotate</p>
        </section>

        <aside class="builder-panel configurator-panel configurator-panel-right" aria-label="Lighting, finish, and hardware controls">
          ${this.renderLightingGroup()}
          ${this.renderFinishGroup()}
          ${this.renderHardwareGroup()}
        </aside>

        ${this.renderPresetTray()}

        <section class="configurator-estimate-bar" aria-label="Estimate and next steps">
          <div class="configurator-price-block">
            <span class="price-kicker">Estimated Price</span>
            <strong data-price>${formatPrice(this.pricing?.total ?? calculateBookcasePrice(this.state, this.layout))}</strong>
          </div>
          <p class="configurator-quote-note">Final quote after<br>field verification.</p>
          ${this.renderTrustRow()}
          <div class="configurator-actions">
            <button class="configurator-quote-button" type="button" data-open-order="measurement">Request a Quote</button>
            <button class="configurator-save-button" type="button" data-save-design>${builderIcons.bookmark}<span>Save Design</span></button>
          </div>
        </section>

        <p class="status-message" data-builder-status role="status"></p>
        <div class="builder-action-proxies" hidden>
          <button type="button" data-favorite-design>Favorite design</button>
        </div>
      </form>
    `;
  }

  renderPresetTray() {
    const preferredOrder = [
      "lower-cabinets",
      "classic-open",
      "media-wall",
      "library-wall",
      "display-wall",
      "glass-library",
      "desk-niche",
      "feature-wall",
      "asymmetric-modern",
      "tall-storage"
    ];
    const presets = [...layoutPresets].sort((left, right) => preferredOrder.indexOf(left.id) - preferredOrder.indexOf(right.id));
    return `
      <section class="preset-tray" aria-label="Layout presets">
        <div class="preset-tray-heading">
          <span class="section-kicker">Choose a layout</span>
        </div>
        <button class="preset-scroll preset-scroll-prev" type="button" data-preset-scroll="-1" aria-label="Scroll layouts left">${builderIcons.chevronLeft}</button>
        <div class="preset-list">
          ${presets.map((preset, index) => `
            <button class="preset-card" type="button" data-preset-id="${preset.id}" aria-label="Use ${preset.name} preset">
              ${this.renderPresetMini(preset, index + 1)}
              <span class="preset-card-title">${this.formatPresetName(preset.name)}</span>
              <span class="preset-check" aria-hidden="true">&#10003;</span>
            </button>
          `).join("")}
        </div>
        <button class="preset-scroll preset-scroll-next" type="button" data-preset-scroll="1" aria-label="Scroll layouts right">${builderIcons.chevronRight}</button>
      </section>
    `;
  }

  renderTrustRow() {
    const items = [
      ["delivery", "Delivery", "Standard"],
      ["install", "Installation", "Professional"],
      ["warranty", "Warranty", "Lifetime"]
    ];
    return `
      <section class="studio-trust-row" aria-label="Builder assurances">
        ${items.map(([icon, title, copy]) => `
          <div class="studio-trust-item">
            <span class="studio-trust-icon studio-trust-icon-${icon}" aria-hidden="true">${builderIcons[icon]}</span>
            <span><strong>${title}</strong><small>${copy}</small></span>
          </div>
        `).join("")}
      </section>
    `;
  }

  formatPresetName(name) {
    return name;
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

  renderLayoutGroup() {
    return `
      <section class="control-section control-section-layout">
        <h2><span class="control-heading-icon" aria-hidden="true">${builderIcons.layout}</span>Layout</h2>
        ${this.renderStepperControl("sections", "Sections", 1, 6)}
        ${this.renderStepperControl("shelves", "Shelves per section", 2, 8)}
        <div class="toggle-row premium-toggle">
          <label for="${this.id}-lowerCabinets">Lower cabinets</label>
          <label class="switch">
            <input id="${this.id}-lowerCabinets" data-field="lowerCabinets" type="checkbox">
            <span aria-hidden="true"></span>
          </label>
        </div>
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
    if (this.host.dataset.mode === "configurator") {
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

      return `
        <section class="control-section control-section-finish">
          <h2><span class="control-heading-icon" aria-hidden="true">${builderIcons.finish}</span>Finish</h2>
          <fieldset class="finish-field">
            <legend class="sr-only">Benjamin Moore paint finish</legend>
            <div class="finish-choice-grid">${swatches}</div>
          </fieldset>
          <div class="bm-search" data-custom-bm-fields>
            <label for="${this.id}-customPaintColor">Search Benjamin Moore colors</label>
            <div class="bm-search-input">
              <input id="${this.id}-customPaintColor" data-bm-query type="search" maxlength="80" placeholder="Name or code, e.g. HC-154" autocomplete="off">
              <button type="button" data-search-bm aria-label="Search local Benjamin Moore color data">${builderIcons.search}</button>
            </div>
            <div class="bm-search-results" id="${this.id}-bm-results" data-bm-results hidden></div>
            <p class="bm-search-status" data-bm-status>Local curated data · approximate only; verify with a physical sample.</p>
          </div>
        </section>
      `;
    }

    const swatches = finishOptions.map((option) => {
      const swatchLabel = option.custom ? "Custom Benjamin Moore Color" : option.label;
      return `
        <div class="finish-swatch${option.custom ? " is-custom-finish" : ""}">
          <input id="${this.id}-finish-${option.value}" data-field="finish" name="${this.id}-finish" type="radio" value="${option.value}">
          <label for="${this.id}-finish-${option.value}" title="${swatchLabel}" aria-label="${swatchLabel}">
            <span class="finish-dot" style="--swatch:${option.swatch}">${option.custom ? "<span class=\"finish-custom-plus\">+</span><span class=\"finish-custom-text\">Custom</span>" : ""}</span>
            <span class="sr-only">${swatchLabel}</span>
          </label>
        </div>
      `;
    }).join("");

    return `
      <section class="control-section control-section-finish">
        <h2>Paint Finish</h2>
        <p class="finish-helper">Recommended Benjamin Moore colors.</p>
        <fieldset class="field">
          <legend class="fieldset-label">Choose from recommended Benjamin Moore colors or enter your preferred Benjamin Moore color.</legend>
          <div class="finish-grid">${swatches}</div>
          <p class="selected-finish-line" data-selected-finish></p>
          <div class="custom-paint-panel" data-custom-bm-fields hidden>
            <label for="${this.id}-customPaintColor">Benjamin Moore color name/code</label>
            <input id="${this.id}-customPaintColor" data-field="customPaintColor" type="text" maxlength="80" placeholder="Example: Hale Navy HC-154" autocomplete="off">
            <a href="${benjaminMooreColorsUrl}" target="_blank" rel="noopener noreferrer">Browse Benjamin Moore colors</a>
          </div>
        </fieldset>
      </section>
    `;
  }

  renderHardwareGroup() {
    if (this.host.dataset.mode === "configurator") {
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
          <fieldset class="hardware-field lower-dependent" data-lower-dependent>
            <legend class="sr-only">Hardware options</legend>
            <div class="hardware-choice-grid">${hardware}</div>
          </fieldset>
        </section>
      `;
    }

    const hardware = hardwareOptions.map((option) => `
      <div class="hardware-swatch">
        <input id="${this.id}-hardware-${option.value}" data-field="hardware" name="${this.id}-hardware" type="radio" value="${option.value}">
        <label for="${this.id}-hardware-${option.value}" title="${option.label}" aria-label="${option.label}">
          <span class="hardware-dot hardware-dot-${option.value}" aria-hidden="true"></span>
          <span class="sr-only">${option.label}</span>
        </label>
      </div>
    `).join("");

    return `
      <section class="control-section control-section-hardware">
        <h2>Hardware</h2>
        <fieldset class="field lower-dependent" data-lower-dependent>
          <legend class="fieldset-label">Hardware options</legend>
          <div class="hardware-grid">${hardware}</div>
        </fieldset>
      </section>
    `;
  }

  renderLightingGroup() {
    if (this.host.dataset.mode === "configurator") {
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
          <fieldset class="warmth-field">
            <legend>Warmth</legend>
            <div class="warmth-grid">${warmth}</div>
          </fieldset>
        </section>
      `;
    }

    const options = lightingOptions.map((option) => `
      <option value="${option.value}">${option.label}</option>
    `).join("");

    return `
      <section class="control-section control-section-lighting">
        <h2>Lighting</h2>
        <label class="lighting-select-label" for="${this.id}-lighting">Lighting options</label>
        <select class="lighting-select" id="${this.id}-lighting" data-field="lighting" name="${this.id}-lighting">
          ${options}
        </select>
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
      </div>
    `;
  }

  renderStepperControl(name, label, min, max) {
    return `
      <div class="stepper-control" data-stepper-control="${name}">
        <span>${label}</span>
        <div class="stepper">
          <button type="button" data-step-field="${name}" data-step-direction="-1" aria-label="Decrease ${label}">&minus;</button>
          <input id="${this.id}-${name}-number" data-field="${name}" type="number" min="${min}" max="${max}" step="1" inputmode="numeric" aria-label="${label}">
          <button type="button" data-step-field="${name}" data-step-direction="1" aria-label="Increase ${label}">+</button>
        </div>
      </div>
    `;
  }

  cacheElements() {
    this.elements = {
      viewer: this.host.querySelector("[data-3d-viewer]"),
      form: this.host.querySelector("[data-builder-form]"),
      price: this.host.querySelector("[data-price]"),
      status: this.host.querySelector("[data-builder-status]"),
      doorOptions: this.host.querySelector("[data-door-options]")
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
      if (event.target.matches("[data-field]")) this.handleFieldChange(event.target);
    });

    this.host.addEventListener("change", (event) => {
      if (event.target.matches("[data-field]")) this.handleFieldChange(event.target);
    });

    this.host.addEventListener("click", (event) => {
      const button = event.target.closest("[data-step-field]");
      if (!button || !this.host.contains(button)) return;
      this.handleStepperClick(button);
    });

    this.host.querySelectorAll("[data-view]").forEach((button) => {
      button.addEventListener("click", () => {
        if (button.dataset.view === "reset") {
          try {
            localStorage.removeItem("jqBookcasesDesign");
          } catch (error) {
            // Reset still succeeds when local storage is unavailable.
          }
          this.update(defaultBookcaseConfig);
          this.viewer.setView("reset");
          this.activeView = "three-quarter";
          this.syncViewButtons();
          this.showStatus("Configuration reset to the Full Bookcase layout.");
          return;
        }
        this.setView(button.dataset.view);
      });
    });

    this.host.querySelectorAll("[data-preset-id]").forEach((button) => {
      button.addEventListener("click", () => this.applyPreset(button.dataset.presetId));
    });

    this.host.querySelectorAll("[data-preset-scroll]").forEach((button) => {
      button.addEventListener("click", () => this.scrollPresetTray(Number(button.dataset.presetScroll)));
    });
    const presetList = this.host.querySelector(".preset-list");
    presetList?.addEventListener("scroll", () => this.syncPresetScrollButtons(), { passive: true });
    window.addEventListener("resize", () => this.syncPresetScrollButtons(), { passive: true });
    window.requestAnimationFrame(() => this.syncPresetScrollButtons());

    this.host.querySelectorAll("[data-save-design]").forEach((button) => {
      button.addEventListener("click", () => {
        const design = this.saveCurrentDesign();
        this.showStatus(design.persisted
          ? `Saved design ${design.id}.`
          : `Design ${design.id} is ready, but this browser could not store it.`);
      });
    });

    this.host.querySelector("[data-favorite-design]")?.addEventListener("click", () => {
      const design = this.saveCurrentDesign();
      this.showStatus(`Favorited design ${design.id}.`);
    });

    const colorQuery = this.host.querySelector("[data-bm-query]");
    colorQuery?.addEventListener("input", () => this.updateBenjaminMooreResults(colorQuery.value));
    colorQuery?.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        this.closeBenjaminMooreResults();
        return;
      }
      if (event.key !== "Enter") return;
      event.preventDefault();
      this.applyBenjaminMooreQuery(colorQuery.value);
    });
    this.host.querySelector("[data-search-bm]")?.addEventListener("click", () => {
      this.applyBenjaminMooreQuery(colorQuery?.value || "");
    });
    this.host.addEventListener("click", (event) => {
      const result = event.target.closest?.("[data-bm-code]");
      if (!result || !this.host.contains(result)) return;
      const color = findExactBenjaminMooreColor(result.dataset.bmCode);
      if (color) this.applyBenjaminMooreColor(color);
    });

    this.host.querySelectorAll("[data-open-order]").forEach((button) => {
      button.addEventListener("click", () => this.openQuotePage());
    });

    this.host.querySelector("[data-focus-controls]")?.addEventListener("click", () => {
      this.host.querySelector(".builder-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.setTimeout(() => this.host.querySelector("[data-field]")?.focus(), 280);
    });

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
    this.syncMatchingInputs(range.dataset.field, range.value, range);
    this.update(this.readStateFromControls());
  }

  setView(view) {
    this.viewer.setView(view);
    this.activeView = view === "reset" ? "three-dimensional" : view;
    this.syncViewButtons();
  }

  syncViewButtons() {
    this.host.querySelectorAll("[data-view]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.view === this.activeView);
    });
  }

  applyPreset(presetId) {
    const preset = layoutPresets.find((item) => item.id === presetId);
    if (!preset) return;
    const retainedSelections = {
      finish: this.state.finish,
      customPaintColor: this.state.customPaintColor,
      customPaintCode: this.state.customPaintCode,
      customPaintHex: this.state.customPaintHex,
      hardware: this.state.hardware,
      lighting: this.state.lighting,
      lightingWarmth: this.state.lightingWarmth,
      delivery: this.state.delivery,
      installation: this.state.installation
    };
    const applied = this.update({
      ...this.state,
      ...preset.config,
      ...retainedSelections,
      layoutPreset: preset.id
    });
    if (applied) this.showStatus(`${preset.name} preset applied. You can keep customizing from here.`);
  }

  scrollPresetTray(direction) {
    const list = this.host.querySelector(".preset-list");
    if (!list) return;
    list.scrollBy({ left: direction * list.clientWidth * 0.72, behavior: "smooth" });
    window.setTimeout(() => this.syncPresetScrollButtons(), 320);
  }

  syncPresetScrollButtons() {
    const list = this.host.querySelector(".preset-list");
    if (!list) return;
    const maximum = Math.max(0, list.scrollWidth - list.clientWidth);
    const previous = this.host.querySelector('[data-preset-scroll="-1"]');
    const next = this.host.querySelector('[data-preset-scroll="1"]');
    if (previous) previous.disabled = list.scrollLeft <= 1;
    if (next) next.disabled = list.scrollLeft >= maximum - 1;
  }

  updateBenjaminMooreResults(query) {
    const resultsHost = this.host.querySelector("[data-bm-results]");
    const status = this.host.querySelector("[data-bm-status]");
    const input = this.host.querySelector("[data-bm-query]");
    if (!resultsHost || !status || !input) return;
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      resultsHost.hidden = true;
      resultsHost.innerHTML = "";
      status.textContent = "Local curated data · approximate only; verify with a physical sample.";
      return;
    }
    const matches = searchBenjaminMooreColors(normalizedQuery, { limit: 5 });
    if (!matches.length) {
      resultsHost.hidden = true;
      resultsHost.innerHTML = "";
      status.textContent = `No local match for “${normalizedQuery}”. Try a full name or code.`;
      return;
    }
    resultsHost.innerHTML = matches.map((color) => `
      <button type="button" data-bm-code="${color.code}" aria-label="Apply ${color.name} ${color.code}">
        <span class="bm-result-swatch" style="--bm-result-color:${color.approximateHex}" aria-hidden="true"></span>
        <span><strong>${color.name}</strong><small>${color.code}</small></span>
      </button>
    `).join("");
    resultsHost.hidden = false;
    status.textContent = `${matches.length} local ${matches.length === 1 ? "match" : "matches"}. Select a color to apply it.`;
  }

  applyBenjaminMooreQuery(query) {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      this.host.querySelector("[data-bm-query]")?.focus();
      this.updateBenjaminMooreResults("");
      return;
    }
    const exact = findExactBenjaminMooreColor(normalizedQuery);
    if (exact) {
      this.applyBenjaminMooreColor(exact);
      return;
    }
    this.updateBenjaminMooreResults(normalizedQuery);
  }

  applyBenjaminMooreColor(color) {
    this.update({
      ...this.state,
      finish: "custom_bm",
      customPaintColor: color.name,
      customPaintCode: color.code,
      customPaintHex: color.approximateHex
    });
    const input = this.host.querySelector("[data-bm-query]");
    if (input) input.value = `${color.name} ${color.code}`;
    this.closeBenjaminMooreResults();
    const status = this.host.querySelector("[data-bm-status]");
    if (status) status.textContent = `Applied ${color.name} ${color.code}. Verify the final finish with a physical paint sample.`;
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

  handleFieldChange(target) {
    if (target.type !== "radio" && target.type !== "checkbox") {
      this.syncMatchingInputs(target.dataset.field, target.value, target);
    }
    const next = this.readStateFromControls();
    if (target.dataset.field === "customPaintColor" && target.value.trim()) next.finish = "custom_bm";
    this.update(next);
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
    this.update(this.readStateFromControls());
  }

  readStateFromControls() {
    const next = { ...this.state };
    this.host.querySelectorAll("[data-field]").forEach((field) => {
      const key = field.dataset.field;
      if (field.type === "radio" && !field.checked) return;
      if (field.type === "checkbox") {
        next[key] = field.checked;
      } else if (numericFields.has(key)) {
        next[key] = Number(field.value);
      } else {
        next[key] = field.value;
      }
    });
    return normalizeBookcaseConfig(next);
  }

  update(nextState, options = {}) {
    const evaluation = evaluateBookcaseCandidate(nextState);
    if (!evaluation.accepted) {
      this.syncControls();
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

    const rendered = this.viewer.update(state, evaluation.layout);
    if (rendered === false) {
      this.syncControls();
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
    this.renderDoorOptions();
    this.syncControls();
    this.syncLowerDependentControls();
    this.syncPresetCards();
    this.updatePriceAndSummary();

    if (!options.silent && evaluation.corrections.length) {
      this.showStatus(evaluation.corrections.map((correction) => correction.message || correction).join(" "));
    } else if (!options.silent) {
      this.clearStatus();
    }
    return true;
  }

  renderDoorOptions() {
    if (!this.elements.doorOptions) return;
    const options = getDoorCountOptions(this.state.width, this.state.sections);
    const key = options.join(",");
    if (key === this.doorOptionKey) return;
    this.doorOptionKey = key;
    this.elements.doorOptions.innerHTML = options.map((option) => `
      <div class="segment">
        <input id="${this.id}-doorCount-${option}" data-field="doorCount" name="${this.id}-doorCount" type="radio" value="${option}">
        <label for="${this.id}-doorCount-${option}">${option}</label>
      </div>
    `).join("");
  }

  syncControls() {
    Object.entries(this.state).forEach(([key, value]) => {
      this.host.querySelectorAll(`[data-field="${key}"]`).forEach((field) => {
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
      const permanentSearch = this.host.dataset.mode === "configurator";
      customPanel.hidden = permanentSearch ? false : !customSelected;
      customPanel.classList.toggle("is-selected", customSelected);
    }
    const query = this.host.querySelector("[data-bm-query]");
    if (query && document.activeElement !== query && customSelected) {
      query.value = [this.state.customPaintColor, this.state.customPaintCode].filter(Boolean).join(" ");
    } else if (query && document.activeElement !== query && !customSelected) {
      query.value = "";
      this.closeBenjaminMooreResults();
      const searchStatus = this.host.querySelector("[data-bm-status]");
      if (searchStatus) searchStatus.textContent = "Local curated data · approximate only; verify with a physical sample.";
    }
  }

  syncMatchingInputs(fieldName, value, source) {
    this.host.querySelectorAll(`[data-field="${fieldName}"]`).forEach((field) => {
      if (field !== source && field.type !== "radio" && field.type !== "checkbox") field.value = value;
    });
  }

  syncLowerDependentControls() {
    this.host.querySelectorAll("[data-lower-dependent]").forEach((group) => {
      group.classList.toggle("is-disabled", !this.state.lowerCabinets);
      group.querySelectorAll("input").forEach((input) => {
        input.disabled = !this.state.lowerCabinets;
      });
    });
  }

  syncPresetCards() {
    const currentPreset = layoutPresets.find((preset) => preset.id === this.state.layoutPreset);
    const activePreset = this.host.querySelector("[data-active-preset]");
    const presetDescription = this.host.querySelector("[data-preset-description]");
    if (activePreset) activePreset.textContent = currentPreset?.name || "Custom layout";
    if (presetDescription) presetDescription.textContent = currentPreset?.description || "Customized from a JQ Bookcases layout.";
    this.host.querySelectorAll("[data-preset-id]").forEach((button) => {
      const isActive = button.dataset.presetId === currentPreset?.id;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  }

  updatePriceAndSummary() {
    const price = this.pricing?.total ?? calculateBookcasePrice(this.state, this.layout);
    const currentPreset = layoutPresets.find((preset) => preset.id === this.state.layoutPreset);
    this.elements.price.textContent = formatPrice(price);
    this.setOptionalText("[data-summary-preset]", currentPreset?.name || "Custom");
    this.setOptionalText("[data-summary-sections]", this.state.sections);
    this.setOptionalText("[data-summary-shelves]", this.state.shelves);
    this.setOptionalText("[data-summary-finish]", this.getFinishLabel());
    const hardwareLabel = optionLabels.hardware[this.state.hardware]
      .replace("Brushed ", "")
      .replace("Slim ", "")
      .replace(" / No Hardware", "")
      .replace(" / Push Latch", "");
    this.setOptionalText("[data-summary-hardware]", `${hardwareLabel} / ${optionLabels.lighting[this.state.lighting]}`);
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
    window.location.assign(`request-quote.html?design=${encodeURIComponent(design.id)}`);
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
  constructor(root, initialState) {
    this.root = root;
    this.state = normalizeBookcaseConfig(initialState);
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
    this.previewMode = false;
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
    if (!this.update(this.state)) {
      throw new Error("The initial 3D model failed the descriptor render contract.");
    }
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
    this.root.addEventListener("pointerdown", (event) => {
      this.drag = { x: event.clientX, y: event.clientY };
      this.root.setPointerCapture(event.pointerId);
      this.root.classList.add("is-dragging");
    });

    this.root.addEventListener("pointermove", (event) => {
      if (!this.drag) return;
      const dx = event.clientX - this.drag.x;
      const dy = event.clientY - this.drag.y;
      this.drag = { x: event.clientX, y: event.clientY };
      this.theta -= dx * 0.007;
      this.phi = clamp(this.phi + dy * 0.004, -0.12, 0.72);
      this.updateCamera();
    });

    this.root.addEventListener("pointerup", (event) => {
      this.drag = null;
      this.root.releasePointerCapture(event.pointerId);
      this.root.classList.remove("is-dragging");
    });

    this.root.addEventListener("pointercancel", () => {
      this.drag = null;
      this.root.classList.remove("is-dragging");
    });

    this.root.addEventListener("wheel", (event) => {
      event.preventDefault();
      this.radius = clamp(this.radius + event.deltaY * 0.008, this.baseRadius * 0.82, this.baseRadius * 1.58);
      this.updateCamera();
    }, { passive: false });

    this.root.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") this.theta -= 0.12;
      else if (event.key === "ArrowRight") this.theta += 0.12;
      else if (event.key === "ArrowUp") this.phi = clamp(this.phi + 0.08, -0.12, 0.72);
      else if (event.key === "ArrowDown") this.phi = clamp(this.phi - 0.08, -0.12, 0.72);
      else if (event.key === "+" || event.key === "=") this.radius = clamp(this.radius * 0.9, this.baseRadius * 0.82, this.baseRadius * 1.58);
      else if (event.key === "-") this.radius = clamp(this.radius * 1.1, this.baseRadius * 0.82, this.baseRadius * 1.58);
      else return;
      event.preventDefault();
      this.updateCamera();
    });
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

  setPreviewMode(enabled) {
    this.previewMode = Boolean(enabled);
    this.renderer.toneMappingExposure = this.previewMode ? 1.18 : 1.08;
    if (this.previewMode) {
      this.theta = -0.22;
      this.phi = 0.1;
      this.radius = this.baseRadius * 0.78;
    } else {
      this.radius = clamp(this.radius || this.baseRadius, this.baseRadius * 0.82, this.baseRadius * 1.58);
    }
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

  update(nextState, precomputedLayout = null) {
    const candidateState = normalizeBookcaseConfig(nextState);
    const rebuilt = this.rebuildModel(candidateState, precomputedLayout);
    if (!rebuilt) return false;
    this.state = candidateState;
    this.frameModel(true);
    return true;
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
    const ratio = this.previewMode ? 0.82 : clamp(previousRatio || 1, 0.84, 1.48);
    this.radius = this.baseRadius * ratio;
    this.updateCamera();
  }

  rebuildModel(nextState, precomputedLayout = null) {
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
      disposeObject(nextModel);
      return false;
    }
    this.scene.remove(this.model);
    disposeObject(this.model);
    this.model = nextModel;
    this.scene.add(this.model);
    this.root.dataset.renderValid = "true";
    this.root.dataset.renderComponents = String(this.lastRenderAudit.renderedCount || 0);
    this.root.dataset.renderExpected = String(this.lastRenderAudit.expectedCount || 0);
    return true;
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
    this.renderer.render(this.scene, this.camera);
    const memory = this.renderer.info.memory;
    const render = this.renderer.info.render;
    this.root.dataset.webglGeometries = String(memory.geometries || 0);
    this.root.dataset.webglTextures = String(memory.textures || 0);
    this.root.dataset.webglCalls = String(render.calls || 0);
    this.root.dataset.webglTriangles = String(render.triangles || 0);
    window.requestAnimationFrame(() => this.animate());
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
  const hardwareColor = {
    brass_knob: 0xb38a4a,
    brass_pull: 0xb38a4a,
    matte_black_knob: 0x171614,
    matte_black_pull: 0x171614,
    polished_nickel_pull: 0xd8d9d2,
    push_latch: 0xb38a4a
  }[config.hardware];
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
