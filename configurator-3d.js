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
  normalizeBookcaseConfig,
  optionLabels
} from "./bookcase-config.js";
import { calculateBookcasePrice, formatPrice } from "./bookcase-pricing.js";

const numericFields = new Set(["width", "height", "depth", "sections", "shelves", "doorCount"]);
const finishPalette = {
  alabaster: { case: 0xeee6dc, side: 0xd6caba, inside: 0xd9ccbc, edge: 0x8f806e },
  warm_white: { case: 0xf6efe4, side: 0xdfd4c4, inside: 0xe6dacb, edge: 0x9b8b78 },
  soft_black: { case: 0x272520, side: 0x151411, inside: 0x201e1a, edge: 0x5a554d },
  natural_oak: { case: 0xc59a61, side: 0xaa7d48, inside: 0xb88954, edge: 0x6d4d2c },
  walnut: { case: 0x6e4b35, side: 0x4f3425, inside: 0x5b3c2d, edge: 0xa98765 }
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
    this.doorOptionKey = "";
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
        <div class="builder-intro">
          <span class="eyebrow">Custom-quality bookcases without <span class="nowrap">custom-project chaos.</span></span>
          <div class="builder-intro-grid">
            <div>
              <h1 id="${this.id}-title">Premium Built-In Bookcases, Designed Online</h1>
              <p class="lead">Choose your dimensions, layout, finish, cabinet options, and installation preferences - then see your 3D model and estimated price update instantly.</p>
            </div>
            <div class="builder-intro-actions" aria-label="Builder actions">
              <button class="button button-primary" type="button" data-focus-controls>Start Designing</button>
              <button class="button button-secondary" type="button" data-open-order="measurement">Request Final Measurement</button>
            </div>
          </div>
        </div>

        <div class="builder-workspace">
          <section class="viewer-card" aria-labelledby="${this.id}-viewer-title">
            <div class="viewer-card-top">
              <div>
                <span class="section-kicker">Interactive 3D model</span>
                <h2 id="${this.id}-viewer-title">Rotate your built-in in real time.</h2>
              </div>
              <p class="viewer-help">Drag to rotate &bull; Scroll to zoom &bull; Arrow keys rotate</p>
            </div>
            <div class="viewer-stage" data-3d-viewer tabindex="0" role="img" aria-label="Interactive 3D built-in bookcase model"></div>
            <div class="view-controls" aria-label="3D view controls">
              <button type="button" data-view="reset">Reset View</button>
              <button type="button" data-view="front">Front View</button>
              <button type="button" data-view="three-quarter">3/4 View</button>
              <button type="button" data-view="side">Side View</button>
            </div>
            <div class="viewer-spec-strip" aria-label="Current design summary">
              <span><strong data-live-width>96&quot;</strong> width</span>
              <span><strong data-live-height>96&quot;</strong> height</span>
              <span><strong data-live-depth>15&quot;</strong> depth</span>
              <span><strong data-live-sections>3</strong> sections</span>
              <span><strong data-live-shelves>4</strong> shelves</span>
            </div>
          </section>

          <aside class="builder-panel" aria-label="Configuration panel">
            <div class="price-summary">
              <span>Estimated Price</span>
              <strong data-price>${formatPrice(calculateBookcasePrice(this.state))}</strong>
              <p>Online pricing is an estimate. Final price is confirmed after field measurement, wall condition review, delivery access, and installation requirements.</p>
            </div>

            <form class="builder-form" data-builder-form>
              ${this.renderDimensionsGroup()}
              ${this.renderLayoutGroup()}
              ${this.renderLowerStorageGroup()}
              ${this.renderFinishGroup()}
              ${this.renderHardwareGroup()}
              ${this.renderTopBaseGroup()}
              ${this.renderServicesGroup()}
            </form>

            <div class="quote-summary builder-quote-summary" aria-label="Selected design summary">
              <div class="preview-row"><span>Size</span><strong class="preview-value" data-summary-size></strong></div>
              <div class="preview-row"><span>Layout</span><strong class="preview-value" data-summary-layout></strong></div>
              <div class="preview-row"><span>Lower</span><strong class="preview-value" data-summary-lower></strong></div>
              <div class="preview-row"><span>Finish</span><strong class="preview-value" data-summary-finish></strong></div>
              <div class="preview-row"><span>Hardware</span><strong class="preview-value" data-summary-hardware></strong></div>
              <div class="preview-row"><span>Top / Base</span><strong class="preview-value" data-summary-details></strong></div>
              <p class="status-message" data-builder-status role="status"></p>
              <div class="quote-actions">
                <button class="button button-primary" type="button" data-open-order="continue">Continue</button>
                <button class="button button-secondary" type="button" data-save-design>Save My Design</button>
                <button class="button button-soft" type="button" data-open-order="review">Order Review</button>
              </div>
            </div>
          </aside>
        </div>
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
              ${this.renderTextField("address", "Project address / city", "text", "Street, city")}
              ${this.renderTextField("installDate", "Desired install date", "date", "")}
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
              <label for="${this.id}-wall-photo">Upload wall photo placeholder</label>
              <input id="${this.id}-wall-photo" name="wallPhoto" type="file" accept="image/*">
            </div>
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

  renderDimensionsGroup() {
    return `
      <details class="control-section" open>
        <summary>Dimensions</summary>
        ${this.renderRangeControl("width", "Width", 48, 180, 1, "in")}
        ${this.renderRangeControl("height", "Height", 72, 120, 1, "in")}
        ${this.renderRangeControl("depth", "Depth", 10, 24, 1, "in")}
      </details>
    `;
  }

  renderLayoutGroup() {
    return `
      <details class="control-section" open>
        <summary>Layout</summary>
        ${this.renderRangeControl("sections", "Vertical sections", 1, 6, 1, "")}
        ${this.renderRangeControl("shelves", "Shelves per section", 2, 8, 1, "")}
      </details>
    `;
  }

  renderLowerStorageGroup() {
    return `
      <details class="control-section" open>
        <summary>Lower Storage</summary>
        <div class="toggle-row premium-toggle">
          <label for="${this.id}-lowerCabinets">Lower cabinets</label>
          <label class="switch">
            <input id="${this.id}-lowerCabinets" data-field="lowerCabinets" type="checkbox">
            <span aria-hidden="true"></span>
          </label>
        </div>
        <fieldset class="field lower-dependent" data-lower-dependent>
          <legend class="fieldset-label">Door count</legend>
          <div class="segment-group three" data-door-options></div>
        </fieldset>
        ${this.renderSegmentField("doorStyle", "Door style", doorStyleOptions, "lower-dependent")}
      </details>
    `;
  }

  renderFinishGroup() {
    const swatches = finishOptions.map((option) => `
      <div class="finish-swatch">
        <input id="${this.id}-finish-${option.value}" data-field="finish" name="${this.id}-finish" type="radio" value="${option.value}">
        <label for="${this.id}-finish-${option.value}">
          <span class="finish-dot" style="--swatch:${option.swatch}"></span>
          ${option.label}
        </label>
      </div>
    `).join("");

    return `
      <details class="control-section" open>
        <summary>Finish</summary>
        <fieldset class="field">
          <legend class="fieldset-label">Finish swatches</legend>
          <div class="finish-grid">${swatches}</div>
        </fieldset>
      </details>
    `;
  }

  renderHardwareGroup() {
    return `
      <details class="control-section" open>
        <summary>Hardware</summary>
        ${this.renderSegmentField("hardware", "Hardware options", hardwareOptions, "lower-dependent")}
      </details>
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

  renderServicesGroup() {
    return `
      <details class="control-section">
        <summary>Services</summary>
        ${this.renderSegmentField("delivery", "Delivery option", deliveryOptions)}
        ${this.renderSegmentField("installation", "Installation option", installationOptions)}
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
    this.host.addEventListener("input", (event) => {
      if (event.target.matches("[data-field]")) this.handleFieldChange(event.target);
    });

    this.host.addEventListener("change", (event) => {
      if (event.target.matches("[data-field]")) this.handleFieldChange(event.target);
    });

    this.host.querySelectorAll("[data-view]").forEach((button) => {
      button.addEventListener("click", () => this.viewer.setView(button.dataset.view));
    });

    this.host.querySelectorAll("[data-save-design]").forEach((button) => {
      button.addEventListener("click", () => {
        const design = this.saveCurrentDesign();
        this.showStatus(`Saved design ${design.id}.`);
      });
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

  handleFieldChange(target) {
    if (target.type !== "radio" && target.type !== "checkbox") {
      this.syncMatchingInputs(target.dataset.field, target.value, target);
    }
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
    this.updatePriceAndSummary();
    this.viewer.update(this.state);
  }

  renderDoorOptions() {
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

    this.host.querySelector("[data-live-width]").textContent = `${this.state.width}"`;
    this.host.querySelector("[data-live-height]").textContent = `${this.state.height}"`;
    this.host.querySelector("[data-live-depth]").textContent = `${this.state.depth}"`;
    this.host.querySelector("[data-live-sections]").textContent = this.state.sections;
    this.host.querySelector("[data-live-shelves]").textContent = this.state.shelves;
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

  updatePriceAndSummary() {
    const price = calculateBookcasePrice(this.state);
    this.elements.price.textContent = formatPrice(price);
    this.host.querySelector("[data-summary-size]").textContent = `${this.state.width}" W x ${this.state.height}" H x ${this.state.depth}" D`;
    this.host.querySelector("[data-summary-layout]").textContent = `${this.state.sections} sections / ${this.state.shelves} shelves`;
    this.host.querySelector("[data-summary-lower]").textContent = this.state.lowerCabinets
      ? `${this.state.doorCount} ${optionLabels.doorStyle[this.state.doorStyle]} doors`
      : "Open lower shelves";
    this.host.querySelector("[data-summary-finish]").textContent = optionLabels.finish[this.state.finish];
    this.host.querySelector("[data-summary-hardware]").textContent = this.state.lowerCabinets
      ? optionLabels.hardware[this.state.hardware]
      : "No lower hardware";
    this.host.querySelector("[data-summary-details]").textContent = `${optionLabels.crownStyle[this.state.crownStyle]} / ${optionLabels.baseStyle[this.state.baseStyle]}`;
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
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.root.appendChild(this.renderer.domElement);
    this.target = new THREE.Vector3(0, inchesToUnits(this.state.height) / 2, 0);
    this.theta = -0.58;
    this.phi = 0.23;
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
    this.scene.add(new THREE.HemisphereLight(0xfffbf2, 0xc3b3a0, 2.4));
    const key = new THREE.DirectionalLight(0xfff4df, 3.1);
    key.position.set(5, 8, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 30;
    key.shadow.camera.left = -9;
    key.shadow.camera.right = 9;
    key.shadow.camera.top = 9;
    key.shadow.camera.bottom = -9;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xffffff, 0.72);
    fill.position.set(-5, 4, 5);
    this.scene.add(fill);

    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xeee4d6, roughness: 0.86, metalness: 0 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(28, 22), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -0.02, 1.2);
    floor.receiveShadow = true;
    this.scene.add(floor);

    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xf7f2ea, roughness: 0.92, metalness: 0 });
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(28, 14), wallMaterial);
    wall.position.set(0, 5.3, -2.4);
    wall.receiveShadow = true;
    this.scene.add(wall);
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
      this.radius = clamp(this.radius + event.deltaY * 0.008, this.baseRadius * 0.58, this.baseRadius * 1.85);
      this.updateCamera();
    }, { passive: false });

    this.root.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") this.theta -= 0.12;
      else if (event.key === "ArrowRight") this.theta += 0.12;
      else if (event.key === "ArrowUp") this.phi = clamp(this.phi + 0.08, -0.12, 0.72);
      else if (event.key === "ArrowDown") this.phi = clamp(this.phi - 0.08, -0.12, 0.72);
      else if (event.key === "+" || event.key === "=") this.radius = clamp(this.radius * 0.9, this.baseRadius * 0.58, this.baseRadius * 1.85);
      else if (event.key === "-") this.radius = clamp(this.radius * 1.1, this.baseRadius * 0.58, this.baseRadius * 1.85);
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
    } else {
      this.theta = -0.58;
      this.phi = 0.23;
    }
    if (view === "reset") this.radius = this.baseRadius;
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
    this.baseRadius = Math.max(widthUnits, heightUnits, depthUnits) * 2.08;
    this.radius = this.radius ? clamp(this.radius, this.baseRadius * 0.7, this.baseRadius * 1.85) : this.baseRadius;
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
  const width = inchesToUnits(config.width);
  const height = inchesToUnits(config.height);
  const depth = inchesToUnits(config.depth);
  const outer = 0.16;
  const partition = 0.115;
  const shelf = 0.095;
  const lowerHeight = config.lowerCabinets ? Math.min(2.55, height * 0.34) : outer + 0.12;
  const innerWidth = width - outer * 2;
  const bayWidth = (innerWidth - partition * (config.sections - 1)) / config.sections;
  const shelfDepth = depth - 0.18;

  addBox(group, [width, height, 0.055], [0, height / 2, -depth / 2 + 0.028], materials.back, true);
  addBox(group, [outer, height, depth], [-width / 2 + outer / 2, height / 2, 0], materials.side);
  addBox(group, [outer, height, depth], [width / 2 - outer / 2, height / 2, 0], materials.side);
  addBox(group, [width, outer, depth], [0, height - outer / 2, 0], materials.case);
  addBox(group, [width, outer, depth], [0, outer / 2, 0], materials.case);

  for (let index = 1; index < config.sections; index += 1) {
    const x = -innerWidth / 2 + index * (bayWidth + partition) - partition / 2;
    addBox(group, [partition, height - outer * 2, shelfDepth], [x, height / 2, 0.015], materials.case);
  }

  const upperBottom = config.lowerCabinets ? lowerHeight + shelf * 0.8 : outer + shelf * 0.5;
  const upperTop = height - outer - 0.2;
  const shelfSpan = Math.max(0.8, upperTop - upperBottom);

  for (let bay = 0; bay < config.sections; bay += 1) {
    const bayX = -innerWidth / 2 + bayWidth / 2 + bay * (bayWidth + partition);
    for (let row = 1; row <= config.shelves; row += 1) {
      const y = upperBottom + (shelfSpan / (config.shelves + 1)) * row;
      addBox(group, [bayWidth, shelf, shelfDepth], [bayX, y, 0.02], materials.case);
      addShelfObjects(group, materials, bayX, bayWidth, y + shelf / 2, shelfDepth, bay, row);
    }
  }

  if (config.lowerCabinets) {
    addLowerCabinets(group, config, materials, width, depth, lowerHeight);
  } else {
    addBox(group, [innerWidth, shelf, shelfDepth], [0, lowerHeight + 0.32, 0.02], materials.case);
  }

  addCrown(group, config, materials, width, height, depth);
  addBase(group, config, materials, width, depth);
  return group;
}

function addLowerCabinets(group, config, materials, width, depth, lowerHeight) {
  const faceZ = depth / 2 + 0.034;
  const railHeight = 0.16;
  addBox(group, [width - 0.05, railHeight, depth], [0, lowerHeight + railHeight / 2, 0], materials.case);
  addBox(group, [width - 0.1, lowerHeight - 0.12, 0.06], [0, lowerHeight / 2 + 0.03, faceZ - 0.01], materials.case);

  const doorGap = 0.035;
  const doorWidth = (width - 0.34) / config.doorCount;
  const doorHeight = lowerHeight - 0.46;
  const startX = -width / 2 + 0.17 + doorWidth / 2;
  for (let index = 0; index < config.doorCount; index += 1) {
    const x = startX + index * doorWidth;
    addDoor(group, config, materials, [doorWidth - doorGap, doorHeight, 0.065], [x, lowerHeight / 2 + 0.04, faceZ]);
    addHardware(group, config, materials, x, doorWidth, lowerHeight, faceZ + 0.05, index);
  }
}

function addDoor(group, config, materials, size, position) {
  const [width, height, depth] = size;
  addBox(group, size, position, materials.case);
  const z = position[2] + depth / 2 + 0.012;
  const rail = config.doorStyle === "slim_shaker" ? 0.055 : 0.09;

  if (config.doorStyle === "flat") {
    addBox(group, [width * 0.86, 0.018, 0.022], [position[0], position[1] + height * 0.35, z], materials.edgeBlock, false);
    addBox(group, [width * 0.86, 0.018, 0.022], [position[0], position[1] - height * 0.35, z], materials.edgeBlock, false);
    return;
  }

  if (config.doorStyle === "glass") {
    addBox(group, [width - rail * 2.4, height - rail * 2.4, 0.025], [position[0], position[1], z + 0.004], materials.glass, false);
  } else {
    addBox(group, [width - rail * 2.2, height - rail * 2.2, 0.025], [position[0], position[1], z - 0.004], materials.inset, false);
  }

  addBox(group, [width - rail, rail, 0.032], [position[0], position[1] + height / 2 - rail / 2, z], materials.case, false);
  addBox(group, [width - rail, rail, 0.032], [position[0], position[1] - height / 2 + rail / 2, z], materials.case, false);
  addBox(group, [rail, height - rail, 0.032], [position[0] - width / 2 + rail / 2, position[1], z], materials.case, false);
  addBox(group, [rail, height - rail, 0.032], [position[0] + width / 2 - rail / 2, position[1], z], materials.case, false);
}

function addHardware(group, config, materials, doorX, doorWidth, lowerHeight, z, index) {
  if (config.hardware === "push_latch") return;
  const handedOffset = index % 2 === 0 ? doorWidth * 0.26 : -doorWidth * 0.26;
  const x = doorX + handedOffset;
  const y = lowerHeight * 0.53;

  if (config.hardware === "matte_black_pull") {
    const pull = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.42, 16), materials.hardware);
    pull.position.set(x, y, z + 0.028);
    pull.castShadow = true;
    group.add(pull);
    addBox(group, [0.08, 0.035, 0.045], [x, y + 0.16, z + 0.01], materials.hardware, false);
    addBox(group, [0.08, 0.035, 0.045], [x, y - 0.16, z + 0.01], materials.hardware, false);
    return;
  }

  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.065, 18, 14), materials.hardware);
  knob.position.set(x, y, z + 0.04);
  knob.castShadow = true;
  group.add(knob);
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
}

function addShelfObjects(group, materials, bayX, bayWidth, shelfY, shelfDepth, bay, row) {
  if ((bay + row) % 2 === 0) {
    const bookCount = Math.min(5, Math.max(2, Math.floor(bayWidth * 1.7)));
    const start = bayX - bayWidth * 0.28;
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
}

function createMaterials(palette, config) {
  const hardwareColor = {
    brass_knob: 0xb38a4a,
    matte_black_pull: 0x171614,
    polished_nickel_knob: 0xd8d9d2,
    push_latch: 0xb38a4a
  }[config.hardware];

  return {
    case: new THREE.MeshStandardMaterial({ color: palette.case, roughness: 0.66, metalness: 0 }),
    side: new THREE.MeshStandardMaterial({ color: palette.side, roughness: 0.72, metalness: 0 }),
    back: new THREE.MeshStandardMaterial({ color: palette.inside, roughness: 0.84, metalness: 0 }),
    inset: new THREE.MeshStandardMaterial({ color: palette.inside, roughness: 0.78, metalness: 0 }),
    edgeBlock: new THREE.MeshStandardMaterial({ color: palette.edge, roughness: 0.84, metalness: 0 }),
    shadow: new THREE.MeshStandardMaterial({ color: 0x24211d, roughness: 0.88, metalness: 0 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xdedbd2, roughness: 0.18, metalness: 0, transparent: true, opacity: 0.42 }),
    hardware: new THREE.MeshStandardMaterial({ color: hardwareColor, roughness: config.hardware === "matte_black_pull" ? 0.62 : 0.34, metalness: config.hardware === "matte_black_pull" ? 0.2 : 0.82 }),
    edgeLine: new THREE.LineBasicMaterial({ color: palette.edge, transparent: true, opacity: config.finish === "soft_black" ? 0.24 : 0.18 }),
    decorBooks: [
      new THREE.MeshStandardMaterial({ color: 0x8a7966, roughness: 0.8 }),
      new THREE.MeshStandardMaterial({ color: 0x4b4a43, roughness: 0.82 }),
      new THREE.MeshStandardMaterial({ color: 0xb69662, roughness: 0.72 })
    ],
    decorVase: new THREE.MeshStandardMaterial({ color: 0x7b756a, roughness: 0.86 })
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
      materials.forEach((material) => material.dispose?.());
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
