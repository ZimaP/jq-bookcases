import * as THREE from "./assets/vendor/three.module.js";
import {
  baseStyleOptions,
  createDesignId,
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
  lightingOptions,
  normalizeBookcaseConfig,
  optionLabels
} from "./bookcase-config.js?v=bm-finishes-20260708c";
import { calculateBookcasePrice, formatPrice } from "./bookcase-pricing.js?v=bm-finishes-20260708c";

const numericFields = new Set(["width", "height", "depth", "sections", "shelves", "doorCount"]);
const benjaminMooreColorsUrl = "https://www.benjaminmoore.com/en-us/paint-colors";
const lineIconSvg = (paths) => `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    ${paths}
  </svg>
`;
const builderIcons = {
  reset: lineIconSvg(`<path d="M4.8 9.1a7.4 7.4 0 1 1 1.9 7.6"/><path d="M4.8 9.1V4.7"/><path d="M4.8 9.1h4.4"/>`),
  cube: lineIconSvg(`<path d="M12 3.7 19.2 8v8L12 20.3 4.8 16V8L12 3.7z"/><path d="M4.8 8 12 12.3 19.2 8"/><path d="M12 12.3v8"/>`),
  front: lineIconSvg(`<rect x="5.2" y="4.6" width="13.6" height="14.8" rx="1.2"/><path d="M8.2 8.2h7.6"/><path d="M8.2 12h7.6"/><path d="M8.2 15.8h7.6"/>`),
  threeQuarter: lineIconSvg(`<path d="M7 6.2h9.8l2.5 2.5v8.9H7z"/><path d="M16.8 6.2v11.4"/><path d="M7 9h12.3"/><path d="M10 12.6h4"/><path d="M10 15.6h4"/>`),
  side: lineIconSvg(`<path d="M6.4 5.2h9.8l1.4 1.4v12.2H7.8l-1.4-1.4z"/><path d="M7.8 6.6h9.8"/><path d="M7.8 6.6v12.2"/><path d="M10.4 9.8h4.8"/><path d="M10.4 14.2h4.8"/>`),
  delivery: lineIconSvg(`<path d="M3.8 7.1h9.5v8.2H3.8z"/><path d="M13.3 10h3.6l3 3v2.3h-6.6z"/><path d="M5.8 17.2a1.8 1.8 0 1 0 3.6 0 1.8 1.8 0 0 0-3.6 0z"/><path d="M15.5 17.2a1.8 1.8 0 1 0 3.6 0 1.8 1.8 0 0 0-3.6 0z"/><path d="M3.8 15.3h2"/><path d="M9.4 15.3h6.1"/>`),
  install: lineIconSvg(`<path d="m4.5 19.5 6.7-6.7"/><path d="m9.1 10.7 4.1-4.1a3.7 3.7 0 0 1 5-.3l-3.1 3.1 2.2 2.2 3.1-3.1a3.7 3.7 0 0 1-.3 5l-4.1 4.1"/><path d="m4.8 4.7 5.6 5.6"/><path d="M3.9 6.8 6.8 3.9"/>`),
  warranty: lineIconSvg(`<path d="M12 3.6 18.7 6v5.2c0 4.5-2.8 7.7-6.7 9.2-3.9-1.5-6.7-4.7-6.7-9.2V6L12 3.6z"/><path d="m8.8 12.1 2.1 2.1 4.4-4.6"/>`)
};
const finishPalette = {
  white_dove: { case: 0xd6d0c3, side: 0xc3baab, inside: 0xa39a8d, edge: 0x776e63 },
  simply_white: { case: 0xe1dbd0, side: 0xc9c0b1, inside: 0xa89f92, edge: 0x7d7468 },
  chantilly_lace: { case: 0xe7e3da, side: 0xcdc6ba, inside: 0xaaa398, edge: 0x7c746a },
  swiss_coffee: { case: 0xd2c7b7, side: 0xbdb2a2, inside: 0x9f9588, edge: 0x776d61 },
  revere_pewter: { case: 0xb4aca0, side: 0x9f978b, inside: 0x82796f, edge: 0x665d53 },
  custom_bm: { case: 0xd3c8b8, side: 0xbeb3a3, inside: 0x9f9588, edge: 0x756b5f }
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
    this.state = normalizeBookcaseConfig(defaultBookcaseConfig);
    this.activeView = "three-quarter";
    this.doorOptionKey = "";
    this.activeRangeDrag = null;
    this.render();
    this.cacheElements();
    this.viewer = this.createViewer();
    this.bindEvents();
    this.update(this.state);
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
      update: () => {},
      setView: () => {}
    };
  }

  render() {
    this.host.innerHTML = `
      <div class="builder-shell">
        <section class="studio-intro-panel" aria-labelledby="${this.id}-title">
          <h1 id="${this.id}-title"><span>Design your</span><span>bookcase your way.</span></h1>
          <p>Create a custom built-in in minutes. Adjust sizes, layout, finishes and details to see your price update in real time.</p>
        </section>

        <section class="studio-model" aria-labelledby="${this.id}-viewer-title">
          <h2 id="${this.id}-viewer-title" class="sr-only">Interactive 3D built-in bookcase model</h2>
          <div class="viewer-stage" data-3d-viewer tabindex="0" role="img" aria-label="Interactive 3D built-in bookcase model"></div>
          <div class="view-controls" aria-label="3D view controls">
            <button type="button" data-view="reset"><span class="view-icon view-icon-reset" aria-hidden="true">${builderIcons.reset}</span>Reset</button>
            <button type="button" data-view="three-dimensional"><span class="view-icon view-icon-cube" aria-hidden="true">${builderIcons.cube}</span>3D View</button>
            <button type="button" data-view="front"><span class="view-icon view-icon-front" aria-hidden="true">${builderIcons.front}</span>Front</button>
            <button type="button" data-view="three-quarter"><span class="view-icon view-icon-three-quarter" aria-hidden="true">${builderIcons.threeQuarter}</span>3/4 View</button>
            <button type="button" data-view="side"><span class="view-icon view-icon-side" aria-hidden="true">${builderIcons.side}</span>Side</button>
          </div>
          <p class="viewer-helper-line">Drag to rotate &middot; Scroll to zoom &middot; Arrow keys rotate</p>
        </section>

        <aside class="builder-panel studio-control-dock" aria-label="Configuration panel">
          <form class="builder-form" data-builder-form>
            ${this.renderDimensionsGroup()}
            ${this.renderLayoutGroup()}
            ${this.renderFinishGroup()}
            ${this.renderHardwareGroup()}
            ${this.renderLightingGroup()}
          </form>
          <p class="status-message" data-builder-status role="status"></p>
          <div class="builder-action-proxies" hidden>
            <button type="button" data-save-design>Save Design</button>
            <button type="button" data-open-order="measurement">Request Quote</button>
          </div>
        </aside>

        ${this.renderPresetTray()}
        <section class="studio-price-note" aria-label="Estimated price">
          <span>Estimated Price</span>
          <strong data-price>${formatPrice(calculateBookcasePrice(this.state))}</strong>
          <small>* Online pricing is an estimate.</small>
          <small class="studio-price-disclaimer">Final pricing depends on field measurements, selected paint color, finish level, site conditions, and installation requirements.</small>
        </section>
        ${this.renderTrustRow()}
      </div>

      <div class="order-drawer" data-order-drawer aria-hidden="true">
        <button class="order-scrim" type="button" data-close-order aria-label="Close order form"></button>
        <aside class="order-panel" role="dialog" aria-modal="true" aria-labelledby="${this.id}-order-title">
          <button class="order-close" type="button" data-close-order aria-label="Close order form">&times;</button>
          <span class="section-kicker">Saved specification</span>
          <h2 id="${this.id}-order-title">Request final measurement</h2>
          <p class="lead">Send the current configuration for review. We will confirm field measurements, wall conditions, access, and installation requirements before final pricing.</p>
          <div class="order-design-strip">
            <span>Design ID <strong data-order-design-id></strong></span>
            <span>Estimate <strong data-order-price></strong></span>
          </div>
          <form class="order-form" data-order-form>
            <input type="hidden" name="designId">
            <input type="hidden" name="estimatedPrice">
            <input type="hidden" name="configurationJson">
            <div class="form-grid compact">
              ${this.renderTextField("name", "Name", "text", "Your name")}
              ${this.renderTextField("email", "Email", "email", "you@example.com")}
              ${this.renderTextField("phone", "Phone", "tel", "(555) 000-0000")}
              ${this.renderTextField("zip", "ZIP code", "text", "10001")}
              ${this.renderTextField("address", "Project city/address", "text", "Street, city")}
              ${this.renderTextField("installDate", "Desired installation timeline", "text", "Example: 6-8 weeks")}
              ${this.renderTextField("wallWidth", "Wall width", "text", "96 inches")}
              ${this.renderTextField("ceilingHeight", "Ceiling height", "text", "96 inches")}
            </div>
            <fieldset class="field">
              <legend class="fieldset-label">Installation needed?</legend>
              <div class="segment-group two">
                <div class="segment"><input id="${this.id}-order-install-yes" name="orderInstallation" type="radio" value="yes" checked><label for="${this.id}-order-install-yes">Yes</label></div>
                <div class="segment"><input id="${this.id}-order-install-no" name="orderInstallation" type="radio" value="no"><label for="${this.id}-order-install-no">No</label></div>
              </div>
            </fieldset>
            <div class="field">
              <label for="${this.id}-notes">Notes</label>
              <textarea id="${this.id}-notes" name="notes" placeholder="Tell us about outlets, baseboards, radiators, access, or design preferences."></textarea>
            </div>
            <div class="order-actions">
              <button class="button button-secondary" type="button" data-save-design>Save My Design</button>
              <button class="button button-primary" type="submit">Request Final Measurement</button>
            </div>
          </form>
          <div class="order-success" data-order-success hidden role="status"></div>
        </aside>
      </div>
    `;
  }

  renderPresetTray() {
    const presets = [
      ...layoutPresets.filter((preset) => preset.id === defaultBookcaseConfig.layoutPreset),
      ...layoutPresets.filter((preset) => preset.id !== defaultBookcaseConfig.layoutPreset)
    ];

    return `
      <section class="preset-tray" aria-label="Layout presets">
        <div class="preset-tray-heading">
          <span class="section-kicker">Choose a layout</span>
          <button class="preset-scroll preset-scroll-prev" type="button" data-preset-scroll="-1" aria-label="Scroll layouts left"></button>
        </div>
        <div class="preset-list">
          ${presets.map((preset, index) => `
            <button class="preset-card" type="button" data-preset-id="${preset.id}" aria-label="Use ${preset.name} preset">
              ${this.renderPresetMini(preset, index + 1)}
              <span class="preset-card-title">${index + 1}. ${this.formatPresetName(preset.name)}</span>
              <span class="preset-check" aria-hidden="true">&#10003;</span>
            </button>
          `).join("")}
        </div>
        <button class="preset-scroll preset-scroll-next" type="button" data-preset-scroll="1" aria-label="Scroll layouts right"></button>
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
    return name
      .replace("Media Wall with TV Opening", "Media Wall (TV Opening)")
      .replace("Home Office / Desk Niche", "Desk Niche (Home Office)")
      .replace("Modern Asymmetrical Shelves", "Asymmetrical Modern")
      .replace("Tall Storage + Open Shelves", "Tall Storage + Shelves")
      .replace("Fireplace / Feature Wall", "Feature Wall");
  }

  renderPresetMini(preset, index) {
    const sections = Math.min(5, preset.config.sections || 3);
    const shelves = Math.min(5, preset.config.shelves || 4);
    const layoutType = preset.config.layoutType || preset.id;
    const centerBay = Math.floor(sections / 2);
    const featureSpan = preset.config.featureOpening && sections >= 4 ? 2 : 1;
    const featureStart = Math.max(0, Math.floor((sections - featureSpan) / 2));
    const featureEnd = featureStart + featureSpan - 1;
    const bays = Array.from({ length: sections }, (_, bayIndex) => {
      const special = preset.config.featureOpening && bayIndex >= featureStart && bayIndex <= featureEnd
        ? " is-feature"
        : preset.config.centerOpening && bayIndex === centerBay
        ? " is-media"
        : preset.config.deskOpening && bayIndex === centerBay
          ? " is-desk"
          : preset.config.tallDoors && (bayIndex === 0 || bayIndex === sections - 1)
            ? " is-tall"
            : "";
      const marker = special.includes("is-media")
        ? `<span class="mini-tv" aria-hidden="true"></span>`
        : special.includes("is-desk")
          ? `<span class="mini-desk" aria-hidden="true"></span>`
          : special.includes("is-feature") && bayIndex === featureStart
            ? `<span class="mini-fireplace" aria-hidden="true"></span>`
            : "";
      return `<span class="preset-bay${special}" style="--mini-shelves:${shelves}">${marker}</span>`;
    }).join("");
    return `
      <span class="preset-mini is-${layoutType.replace(/_/g, "-")}" data-mini-layout="${layoutType}" data-mini-preset="${preset.id}">
        <span class="preset-number">${index}</span>
        <span class="preset-crown"></span>
        <span class="preset-bays" style="grid-template-columns:repeat(${sections}, minmax(0, 1fr));">${bays}</span>
        <span class="preset-base${preset.config.lowerCabinets ? " has-doors" : ""}"></span>
      </span>
    `;
  }

  renderDimensionsGroup() {
    return `
      <section class="control-section control-section-dimensions">
        <h3>Dimensions</h3>
        ${this.renderRangeControl("width", "Width", 24, 144, 1, "in")}
        ${this.renderRangeControl("height", "Height", 72, 120, 1, "in")}
        ${this.renderRangeControl("depth", "Depth", 10, 24, 1, "in")}
      </section>
    `;
  }

  renderLayoutGroup() {
    return `
      <section class="control-section control-section-layout">
        <h3>Layout</h3>
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

  renderFinishGroup() {
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
        <h3>PAINT FINISH</h3>
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
        <h3>Hardware</h3>
        <fieldset class="field lower-dependent" data-lower-dependent>
          <legend class="fieldset-label">Hardware options</legend>
          <div class="hardware-grid">${hardware}</div>
        </fieldset>
      </section>
    `;
  }

  renderLightingGroup() {
    const options = lightingOptions.map((option) => `
      <option value="${option.value}">${option.label}</option>
    `).join("");

    return `
      <section class="control-section control-section-lighting">
        <h3>Lighting</h3>
        <label class="lighting-select-label" for="${this.id}-lighting">Lighting options</label>
        <select class="lighting-select" id="${this.id}-lighting" data-field="lighting" name="${this.id}-lighting">
          ${options}
        </select>
      </section>
    `;
  }

  renderTopBaseGroup() {
    return `
      <details class="control-section" open>
        <summary>Top &amp; Base Detail</summary>
        ${this.renderSegmentField("crownStyle", "Crown style", crownStyleOptions)}
        ${this.renderSegmentField("baseStyle", "Base style", baseStyleOptions)}
      </details>
    `;
  }

  renderRangeControl(name, label, min, max, step, unit) {
    return `
      <div class="range-control" data-range-control="${name}">
        <div class="range-label">
          <label for="${this.id}-${name}-range">${label}</label>
          <div class="range-value">
            <input id="${this.id}-${name}-number" data-field="${name}" type="number" min="${min}" max="${max}" step="${step}" inputmode="numeric">
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

  renderSegmentField(name, label, options, extraClass = "") {
    const segments = options.map((option) => `
      <div class="segment">
        <input id="${this.id}-${name}-${option.value}" data-field="${name}" name="${this.id}-${name}" type="radio" value="${option.value}">
        <label for="${this.id}-${name}-${option.value}">${option.label}</label>
      </div>
    `).join("");

    return `
      <fieldset class="field ${extraClass}" ${extraClass ? "data-lower-dependent" : ""}>
        <legend class="fieldset-label">${label}</legend>
        <div class="segment-group">${segments}</div>
      </fieldset>
    `;
  }

  renderTextField(name, label, type, placeholder) {
    return `
      <div class="field">
        <label for="${this.id}-order-${name}">${label}</label>
        <input id="${this.id}-order-${name}" name="${name}" type="${type}" placeholder="${placeholder}" ${name === "name" || name === "email" || name === "phone" || name === "zip" ? "required" : ""}>
      </div>
    `;
  }

  cacheElements() {
    this.elements = {
      viewer: this.host.querySelector("[data-3d-viewer]"),
      form: this.host.querySelector("[data-builder-form]"),
      price: this.host.querySelector("[data-price]"),
      status: this.host.querySelector("[data-builder-status]"),
      doorOptions: this.host.querySelector("[data-door-options]"),
      drawer: this.host.querySelector("[data-order-drawer]"),
      orderForm: this.host.querySelector("[data-order-form]"),
      orderSuccess: this.host.querySelector("[data-order-success]")
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
      button.addEventListener("click", () => this.setView(button.dataset.view));
    });

    this.host.querySelectorAll("[data-preset-id]").forEach((button) => {
      button.addEventListener("click", () => this.applyPreset(button.dataset.presetId));
    });

    this.host.querySelectorAll("[data-preset-scroll]").forEach((button) => {
      button.addEventListener("click", () => this.scrollPresetTray(Number(button.dataset.presetScroll)));
    });

    this.host.querySelectorAll("[data-save-design]").forEach((button) => {
      button.addEventListener("click", () => {
        const design = this.saveCurrentDesign();
        this.showStatus(`Saved design ${design.id}.`);
      });
    });

    this.host.querySelector("[data-favorite-design]")?.addEventListener("click", () => {
      const design = this.saveCurrentDesign();
      this.showStatus(`Favorited design ${design.id}.`);
    });

    this.host.querySelectorAll("[data-open-order]").forEach((button) => {
      button.addEventListener("click", () => this.openOrderDrawer(button.dataset.openOrder));
    });

    this.host.querySelectorAll("[data-close-order]").forEach((button) => {
      button.addEventListener("click", () => this.closeOrderDrawer());
    });

    this.host.querySelector("[data-focus-controls]")?.addEventListener("click", () => {
      this.host.querySelector(".builder-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.setTimeout(() => this.host.querySelector("[data-field]")?.focus(), 280);
    });

    this.elements.orderForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const design = this.saveCurrentDesign();
      const leadData = Object.fromEntries(new FormData(this.elements.orderForm).entries());
      try {
        localStorage.setItem(`jqBookcasesLead-${design.id}`, JSON.stringify({
          ...leadData,
          design,
          submittedAt: new Date().toISOString()
        }));
      } catch (error) {
        // Saving can fail in private browsing; the visible design ID still lets the customer continue.
      }
      this.elements.orderSuccess.hidden = false;
      this.elements.orderSuccess.innerHTML = `<strong>Request saved.</strong> Your design ID is ${design.id}. We will use this configuration for measurement and order review.`;
      this.elements.orderSuccess.focus?.();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && this.elements.drawer.classList.contains("is-open")) this.closeOrderDrawer();
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
    this.update({
      ...this.state,
      ...preset.config,
      layoutPreset: preset.id
    });
    this.showStatus(`${preset.name} preset applied. You can keep customizing from here.`);
  }

  scrollPresetTray(direction) {
    const list = this.host.querySelector(".preset-list");
    if (!list) return;
    list.scrollBy({ left: direction * list.clientWidth * 0.72, behavior: "smooth" });
  }

  handleFieldChange(target) {
    if (target.type !== "radio" && target.type !== "checkbox") {
      this.syncMatchingInputs(target.dataset.field, target.value, target);
    }
    this.update(this.readStateFromControls());
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

  update(nextState) {
    this.state = normalizeBookcaseConfig(nextState);
    this.renderDoorOptions();
    this.syncControls();
    this.syncLowerDependentControls();
    this.syncPresetCards();
    this.updatePriceAndSummary();
    this.viewer.update(this.state);
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
    return this.state.customPaintColor ? `${baseLabel}: ${this.state.customPaintColor}` : `${baseLabel} selected`;
  }

  syncPaintFinishControls() {
    const customSelected = this.state.finish === "custom_bm";
    this.host.querySelector(".builder-shell")?.classList.toggle("is-custom-paint-selected", customSelected);

    const selectedLine = this.host.querySelector("[data-selected-finish]");
    if (selectedLine) selectedLine.textContent = `Selected: ${this.getFinishLabel()}`;

    const customPanel = this.host.querySelector("[data-custom-bm-fields]");
    if (customPanel) customPanel.hidden = !customSelected;
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
    const currentPreset = layoutPresets.find((preset) => preset.id === this.state.layoutPreset) || layoutPresets[1];
    const activePreset = this.host.querySelector("[data-active-preset]");
    const presetDescription = this.host.querySelector("[data-preset-description]");
    if (activePreset) activePreset.textContent = currentPreset.name;
    if (presetDescription) presetDescription.textContent = currentPreset.description;
    this.host.querySelectorAll("[data-preset-id]").forEach((button) => {
      const isActive = button.dataset.presetId === currentPreset.id;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  }

  updatePriceAndSummary() {
    const price = calculateBookcasePrice(this.state);
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
    const price = calculateBookcasePrice(this.state);
    const id = createDesignId(this.state, price);
    const design = {
      id,
      price,
      config: this.state,
      savedAt: new Date().toISOString()
    };
    try {
      localStorage.setItem("jqBookcasesDesign", JSON.stringify(design));
    } catch (error) {
      // Local storage may be disabled; keep the visible ID available.
    }
    return design;
  }

  openOrderDrawer() {
    const design = this.saveCurrentDesign();
    this.elements.drawer.classList.add("is-open");
    this.elements.drawer.setAttribute("aria-hidden", "false");
    document.body.classList.add("drawer-open");
    this.elements.orderSuccess.hidden = true;
    this.host.querySelector("[data-order-design-id]").textContent = design.id;
    this.host.querySelector("[data-order-price]").textContent = formatPrice(design.price);
    this.elements.orderForm.elements.designId.value = design.id;
    this.elements.orderForm.elements.estimatedPrice.value = design.price;
    this.elements.orderForm.elements.configurationJson.value = JSON.stringify(design.config);
    this.elements.orderForm.elements.wallWidth.value = `${this.state.width} inches`;
    this.elements.orderForm.elements.ceilingHeight.value = `${this.state.height} inches`;
    window.setTimeout(() => this.elements.orderForm.elements.name.focus(), 80);
  }

  closeOrderDrawer() {
    this.elements.drawer.classList.remove("is-open");
    this.elements.drawer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("drawer-open");
  }

  showStatus(message) {
    this.elements.status.textContent = message;
    this.elements.status.classList.add("is-visible");
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
    this.update(this.state);
    this.animate();
  }

  setupEnvironment() {
    this.scene.fog = new THREE.FogExp2(0x6b6359, 0.014);
    this.scene.add(new THREE.HemisphereLight(0xf8f0e5, 0x665e55, 2.05));

    const key = new THREE.DirectionalLight(0xf7ecdf, 3.62);
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

    const fill = new THREE.DirectionalLight(0xeee6db, 1.14);
    fill.position.set(-6, 4.6, 5.4);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0xdccfc0, 0.7);
    rim.position.set(-4.8, 5.8, -4.6);
    this.scene.add(rim);

    const leftGlow = new THREE.PointLight(0xe8dccb, 0.34, 18);
    leftGlow.position.set(-7.2, 4.2, 2.7);
    this.scene.add(leftGlow);

    const rightGlow = new THREE.PointLight(0xe8dccb, 0.3, 18);
    rightGlow.position.set(7.2, 4.0, 2.8);
    this.scene.add(rightGlow);

    const contactMaterial = new THREE.MeshBasicMaterial({
      map: createContactShadowTexture(),
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const contact = new THREE.Mesh(new THREE.PlaneGeometry(48, 18.5), contactMaterial);
    contact.rotation.x = -Math.PI / 2;
    contact.position.set(0, -0.048, 0.3);
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
  }

  update(nextState) {
    this.state = normalizeBookcaseConfig(nextState);
    this.rebuildModel();
    const widthUnits = inchesToUnits(this.state.width);
    const heightUnits = inchesToUnits(this.state.height);
    const depthUnits = inchesToUnits(this.state.depth);
    this.target.set(0, heightUnits * 0.52, 0);
    const aspect = this.camera.aspect || 1;
    const compositionScale = aspect < 0.95 ? 3.25 : aspect < 1.15 ? 2.22 : 1.62;
    const wideLayoutScale = 1 + Math.max(0, widthUnits - 10) * 0.08;
    this.baseRadius = Math.max(widthUnits, heightUnits, depthUnits) * compositionScale * wideLayoutScale;
    this.radius = this.previewMode ? this.baseRadius * 0.78 : this.radius ? clamp(this.radius, this.baseRadius * 0.82, this.baseRadius * 1.58) : this.baseRadius;
    this.updateCamera();
  }

  rebuildModel() {
    this.scene.remove(this.model);
    disposeObject(this.model);
    this.model = buildBookcaseModel(this.state);
    this.scene.add(this.model);
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
    window.requestAnimationFrame(() => this.animate());
  }
}

function buildBookcaseModel(state) {
  const config = normalizeBookcaseConfig(state);
  const palette = finishPalette[config.finish];
  const materials = createMaterials(palette, config);
  const group = new THREE.Group();
  group.userData.edgeLine = materials.edgeLine;
  const measuredHeight = inchesToUnits(config.height);
  const width = inchesToUnits(config.width) * 1.18;
  const height = measuredHeight * 0.92;
  const depth = inchesToUnits(config.depth) * 1.08;
  const outer = 0.175;
  const partition = 0.128;
  const shelf = 0.105;
  const lowerHeight = config.lowerCabinets ? Math.min(2.42, height * 0.318) : outer + 0.12;
  const innerWidth = width - outer * 2;
  const bayWidth = (innerWidth - partition * (config.sections - 1)) / config.sections;
  const shelfDepth = depth - 0.18;

  addBox(group, [width, height, 0.055], [0, height / 2, -depth / 2 + 0.028], materials.back, true);
  addBox(group, [width * 0.96, height * 0.98, 0.018], [0, height / 2, -depth / 2 + 0.064], materials.backShade, false);
  addBox(group, [outer, height, depth], [-width / 2 + outer / 2, height / 2, 0], materials.side);
  addBox(group, [outer, height, depth], [width / 2 - outer / 2, height / 2, 0], materials.side);
  addBox(group, [width, outer, depth], [0, height - outer / 2, 0], materials.case);
  addBox(group, [width, outer, depth], [0, outer / 2, 0], materials.case);

  for (let index = 1; index < config.sections; index += 1) {
    const x = -innerWidth / 2 + index * (bayWidth + partition) - partition / 2;
    if (isPartitionInsideClearOpening(config, index)) {
      const lowerPartitionHeight = Math.max(0.4, lowerHeight - outer * 0.8);
      addBox(group, [partition, lowerPartitionHeight, shelfDepth], [x, lowerPartitionHeight / 2 + outer * 0.2, 0.015], materials.case);
    } else {
      addBox(group, [partition, height - outer * 2, shelfDepth], [x, height / 2, 0.015], materials.case);
    }
  }

  const upperBottom = config.lowerCabinets ? lowerHeight + shelf * 1.28 : outer + shelf * 0.5;
  const upperTop = height - outer - 0.2;
  const shelfSpan = Math.max(0.8, upperTop - upperBottom);
  const renderedShelfCount = getRenderedShelfCount(config);

  for (let bay = 0; bay < config.sections; bay += 1) {
    const bayX = getBayX(bay, innerWidth, bayWidth, partition);
    for (let row = 1; row <= renderedShelfCount; row += 1) {
      if (shouldSkipShelf(config, bay, row)) continue;
      const y = getShelfY(config, bay, row, upperBottom, upperTop, shelfSpan, renderedShelfCount);
      addShelf(group, materials, [bayWidth, shelf, shelfDepth], [bayX, y, 0.02], depth);
      addShelfObjects(group, materials, bayX, bayWidth, y + shelf / 2, shelfDepth, bay, row);
    }
  }
  const metrics = { width, height, depth, outer, partition, shelf, lowerHeight, innerWidth, bayWidth, shelfDepth, upperBottom, upperTop, shelfSpan, renderedShelfCount };

  if (config.lowerCabinets) {
    addLowerCabinets(group, config, materials, metrics);
  } else {
    addShelf(group, materials, [innerWidth, shelf, shelfDepth], [0, lowerHeight + 0.32, 0.02], depth);
  }

  addShelfPinRows(group, config, materials, metrics);
  if (config.centerOpening) addMediaOpening(group, config, materials, metrics);
  if (config.deskOpening) addDeskNiche(group, config, materials, metrics);
  if (config.featureOpening) addFeatureWallOpening(group, config, materials, metrics);
  if (config.layoutType === "display_wall") addDisplayWallMoment(group, config, materials, metrics);
  if (config.layoutType === "asymmetric" || config.layoutType === "walnut_modern") addAsymmetricAccents(group, config, materials, metrics);
  if (config.layoutType === "glass_library") addUpperGlassDoors(group, config, materials, metrics);
  if (config.tallDoors) addTallStorageDoors(group, config, materials, metrics);
  addPuckLights(group, config, materials, metrics);
  addFaceFrameDetails(group, config, materials, metrics);

  addCrown(group, config, materials, width, height, depth);
  addBase(group, config, materials, width, depth);
  group.position.y = measuredHeight - height;
  return group;
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
  addBox(group, size, position, materials.case);
  const z = position[2] + depth / 2 + 0.012;
  const rail = config.doorStyle === "slim_shaker" ? 0.062 : 0.105;

  if (config.doorStyle === "flat") {
    addBox(group, [width * 0.92, 0.014, 0.022], [position[0], position[1] + height * 0.38, z], materials.reveal, false);
    addBox(group, [width * 0.92, 0.014, 0.022], [position[0], position[1] - height * 0.38, z], materials.reveal, false);
    if (options.openingSide) {
      const stileX = position[0] + (options.openingSide === "right" ? width / 2 - 0.045 : -width / 2 + 0.045);
      addBox(group, [0.014, height * 0.82, 0.024], [stileX, position[1], z + 0.004], materials.reveal, false);
    }
    return;
  }

  if (config.doorStyle === "glass") {
    addBox(group, [width - rail * 2.25, height - rail * 2.25, 0.026], [position[0], position[1], z + 0.004], materials.glass, false);
    addBox(group, [0.012, height - rail * 2.55, 0.03], [position[0], position[1], z + 0.025], materials.glassLine, false);
  } else {
    addBox(group, [width - rail * 2.3, height - rail * 2.3, 0.028], [position[0], position[1], z - 0.006], materials.inset, false);
    addBox(group, [width - rail * 2.65, 0.018, 0.02], [position[0], position[1] + height / 2 - rail * 1.38, z + 0.012], materials.highlight, false);
    addBox(group, [0.016, height - rail * 2.75, 0.02], [position[0] - width / 2 + rail * 1.36, position[1], z + 0.012], materials.highlight, false);
  }

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

function addShelfObjects(group, materials, bayX, bayWidth, shelfY, shelfDepth, bay, row) {
  if ((bay + row) % 2 === 0 || row === 1) {
    const bookCount = Math.min(5, Math.max(2, Math.floor(bayWidth * 1.7)));
    const start = bayX - bayWidth * (row % 2 === 0 ? 0.28 : 0.12);
    for (let index = 0; index < bookCount; index += 1) {
      const bookWidth = 0.055 + (index % 2) * 0.02;
      const bookHeight = 0.34 + ((index + bay) % 3) * 0.05;
      addBox(group, [bookWidth, bookHeight, 0.18], [start + index * 0.075, shelfY + bookHeight / 2, shelfDepth / 2 - 0.26], materials.decorBooks[index % materials.decorBooks.length], false);
    }
  }

  if ((bay + row) % 3 === 0) {
    const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.28, 18), materials.decorVase);
    vase.position.set(bayX + bayWidth * 0.24, shelfY + 0.14, shelfDepth / 2 - 0.28);
    vase.castShadow = true;
    group.add(vase);
  }

  if ((bay + row) % 4 === 1) {
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.48), materials.decorBowl);
    bowl.position.set(bayX - bayWidth * 0.22, shelfY + 0.08, shelfDepth / 2 - 0.3);
    bowl.scale.y = 0.48;
    bowl.castShadow = true;
    group.add(bowl);
  }

  if ((bay + row) % 5 === 2) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.13, 14), materials.decorVase);
    pot.position.set(bayX + bayWidth * 0.18, shelfY + 0.065, shelfDepth / 2 - 0.28);
    pot.castShadow = true;
    group.add(pot);

    [
      [0, 0.2, 0, 1.15, 0.7, 0.9],
      [-0.08, 0.18, 0.02, 0.95, 0.62, 0.78],
      [0.08, 0.17, -0.01, 0.95, 0.6, 0.78]
    ].forEach(([xOffset, yOffset, zOffset, scaleX, scaleY, scaleZ]) => {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), materials.decorPlant);
      leaf.position.set(bayX + bayWidth * 0.18 + xOffset, shelfY + yOffset, shelfDepth / 2 - 0.28 + zOffset);
      leaf.scale.set(scaleX, scaleY, scaleZ);
      leaf.castShadow = true;
      group.add(leaf);
    });
  }
}

function createFinishTexture(finish, baseColor, lineColor, surface) {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 192;
  const context = canvas.getContext("2d");
  const base = `#${baseColor.toString(16).padStart(6, "0")}`;
  const line = `#${lineColor.toString(16).padStart(6, "0")}`;
  context.fillStyle = base;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const lineCount = 34;
  context.lineCap = "round";
  for (let index = 0; index < lineCount; index += 1) {
    const x = (index * 17 + (index % 7) * 5) % canvas.width;
    const wobble = 2;
    const alpha = 0.025 + (index % 3) * 0.012;
    context.strokeStyle = hexToRgba(line, alpha);
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

function hexToRgba(hex, alpha) {
  const value = Number.parseInt(hex.slice(1), 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function createMaterials(palette, config) {
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
  const caseTexture = createFinishTexture(config.finish, palette.case, palette.edge, "case");
  const sideTexture = createFinishTexture(config.finish, palette.side, palette.edge, "side");
  const backTexture = createFinishTexture(config.finish, palette.inside, palette.edge, "back");
  const insetTexture = createFinishTexture(config.finish, palette.side, palette.edge, "inset");
  const paintBump = 0.004;

  return {
    case: new THREE.MeshStandardMaterial({ color: palette.case, map: caseTexture, bumpMap: caseTexture, bumpScale: paintBump * 0.66, roughness: 0.66, metalness: 0 }),
    side: new THREE.MeshStandardMaterial({ color: palette.side, map: sideTexture, bumpMap: sideTexture, bumpScale: paintBump * 0.64, roughness: 0.7, metalness: 0 }),
    back: new THREE.MeshStandardMaterial({ color: palette.inside, map: backTexture, bumpMap: backTexture, bumpScale: paintBump * 0.42, roughness: 0.84, metalness: 0, emissive: palette.inside, emissiveIntensity: 0.08 }),
    inset: new THREE.MeshStandardMaterial({ color: palette.side, map: insetTexture, bumpMap: insetTexture, bumpScale: paintBump * 0.5, roughness: 0.74, metalness: 0, emissive: palette.side, emissiveIntensity: 0.03 }),
    edgeBlock: new THREE.MeshStandardMaterial({ color: palette.edge, roughness: 0.86, metalness: 0 }),
    shadow: new THREE.MeshStandardMaterial({ color: 0x2a251f, roughness: 0.9, metalness: 0 }),
    reveal: new THREE.MeshStandardMaterial({ color: 0x514538, roughness: 0.92, metalness: 0 }),
    innerShadow: new THREE.MeshBasicMaterial({ color: 0x211b16, transparent: true, opacity: 0.18, depthWrite: false }),
    backShade: new THREE.MeshBasicMaterial({ color: 0x241e19, transparent: true, opacity: 0.08, depthWrite: false }),
    highlight: new THREE.MeshBasicMaterial({ color: 0xfff6e9, transparent: true, opacity: 0.18, depthWrite: false }),
    pinHole: new THREE.MeshStandardMaterial({ color: 0x4e4034, roughness: 0.96, metalness: 0 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xe7edf0, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.1, depthWrite: false, clearcoat: 0.85, clearcoatRoughness: 0.08, transmission: 0.35 }),
    glassLine: new THREE.MeshPhysicalMaterial({ color: 0xfffbf2, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.16, depthWrite: false, clearcoat: 0.8 }),
    hardware: new THREE.MeshStandardMaterial({
      color: hardwareColor,
      roughness: isBlackHardware ? 0.62 : isNickelHardware ? 0.26 : 0.34,
      metalness: isBlackHardware ? 0.2 : 0.84
    }),
    edgeLine: new THREE.LineBasicMaterial({ color: palette.edge, transparent: true, opacity: 0.16 }),
    puckLight: new THREE.MeshStandardMaterial({ color: 0xfff1cd, emissive: 0xffc46f, emissiveIntensity: 1.4, roughness: 0.35, metalness: 0.1 }),
    ledStrip: new THREE.MeshStandardMaterial({ color: 0xffedca, emissive: 0xffc77c, emissiveIntensity: 1.2, roughness: 0.28, metalness: 0.1 }),
    decorBooks: [
      new THREE.MeshStandardMaterial({ color: 0x8a7966, roughness: 0.8 }),
      new THREE.MeshStandardMaterial({ color: 0x4b4a43, roughness: 0.82 }),
      new THREE.MeshStandardMaterial({ color: 0xb69662, roughness: 0.72 })
    ],
    decorVase: new THREE.MeshStandardMaterial({ color: 0x7b756a, roughness: 0.86 }),
    decorBowl: new THREE.MeshStandardMaterial({ color: 0x9d8264, roughness: 0.76 }),
    decorPlant: new THREE.MeshStandardMaterial({ color: 0x4e633f, roughness: 0.82 })
  };
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
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        ["map", "bumpMap", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap"].forEach((key) => {
          material[key]?.dispose?.();
        });
        material.dispose?.();
      });
    }
  });
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
