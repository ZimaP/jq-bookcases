import {
  CABINET_AR_MODEL_VIEWER_URL,
  CABINET_AR_QR_MODULE_URL,
  createArModelProvider,
  createArModelRequestCoordinator,
  createCabinetArShareUrl,
  detectArCapability,
  emitArAnalytics,
  hashCabinetArConfiguration,
  normalizeCabinetArConfiguration
} from "./cabinet-ar.js";
import { generateProceduralCabinetModel } from "./cabinet-ar-model.js";

let modelViewerLoader;

export class CabinetArController {
  constructor(options) {
    this.host = options.host;
    this.dialog = options.dialog;
    this.getState = options.getState;
    this.getLayout = options.getLayout;
    this.getPrice = options.getPrice;
    this.invoker = null;
    this.destroyed = false;
    this.activeConfigurationHash = "";
    this.arLaunchSucceeded = false;
    this.slowTimer = 0;
    this.generatedUsdzUrl = "";
    this.analyticsMetadata = {};
    this.modelProvider = createArModelProvider({
      endpoint: document.querySelector('meta[name="jq-ar-model-endpoint"]')?.content || "",
      generateProceduralModel: generateProceduralCabinetModel
    });
    this.coordinator = createArModelRequestCoordinator(this.modelProvider);
    this.renderShell();
    this.bindEvents();
    this.observeLaunchButton();
  }

  async open(invoker) {
    if (this.destroyed || !this.dialog || this.loading) return;
    this.invoker = invoker || document.activeElement;
    this.loading = true;
    this.setLaunchButtonLoading(true);
    const state = this.getState();
    const layout = this.getLayout();
    let configuration;
    try {
      configuration = normalizeCabinetArConfiguration(state, layout, { price: this.getPrice() });
    } catch (error) {
      this.loading = false;
      this.setLaunchButtonLoading(false);
      this.showDialog();
      this.renderError("Complete the cabinet dimensions before preparing the room view.");
      return;
    }
    const configurationHash = hashCabinetArConfiguration(configuration);
    this.activeConfigurationHash = configurationHash;
    const shareUrl = createCabinetArShareUrl(state, window.location.href);
    this.analyticsMetadata = {
      productId: configuration.productId,
      configurationId: configuration.configurationId,
      configurationHash
    };
    emitArAnalytics("ar_button_clicked", this.analyticsMetadata);
    this.renderLoading(configuration);
    this.showDialog();
    emitArAnalytics("ar_model_requested", this.analyticsMetadata);
    this.slowTimer = window.setTimeout(() => this.showSlowConnectionMessage(), 6000);

    try {
      const [capability, modelResult] = await Promise.all([
        detectArCapability(window),
        this.coordinator.request(configuration, { layout, posterUrl: await this.createPosterUrl() })
      ]);
      if (modelResult.stale || this.destroyed || configurationHash !== this.currentConfigurationHash()) return;
      await loadModelViewer();
      if (modelResult.stale || this.destroyed || configurationHash !== this.currentConfigurationHash()) return;
      let resolvedModel = modelResult.result;
      if (capability.operatingSystem === "ios" && !capability.quickLook && !resolvedModel.usdzUrl) {
        const generatedUsdzUrl = await prepareIosUsdz(resolvedModel.glbUrl);
        if (generatedUsdzUrl) {
          this.releaseGeneratedUsdz();
          this.generatedUsdzUrl = generatedUsdzUrl;
          resolvedModel = { ...resolvedModel, usdzUrl: generatedUsdzUrl };
        }
      }
      if (modelResult.stale || this.destroyed || configurationHash !== this.currentConfigurationHash()) return;
      window.clearTimeout(this.slowTimer);
      this.loading = false;
      this.setLaunchButtonLoading(false);
      this.renderReady(configuration, resolvedModel, capability, shareUrl);
      emitArAnalytics("ar_model_ready", { ...this.analyticsMetadata, deviceCategory: capability.deviceCategory, operatingSystem: capability.operatingSystem });
    } catch (error) {
      if (this.destroyed || configurationHash !== this.activeConfigurationHash) return;
      window.clearTimeout(this.slowTimer);
      this.loading = false;
      this.setLaunchButtonLoading(false);
      this.renderError(humanizeError(error));
      emitArAnalytics("ar_launch_failed", { ...this.analyticsMetadata, failureReason: "model_preparation" });
    }
  }

  handleConfigurationChanged() {
    if (!this.activeConfigurationHash) return;
    this.coordinator.invalidate();
    this.activeConfigurationHash = "";
    this.loading = false;
    window.clearTimeout(this.slowTimer);
    this.setLaunchButtonLoading(false);
    this.releaseGeneratedUsdz();
    if (this.dialog?.open) {
      this.renderNotice("Your cabinet changed. Close this window and open “View in Your Room” again to prepare the latest design.");
    }
  }

  destroy() {
    this.destroyed = true;
    window.clearTimeout(this.slowTimer);
    this.coordinator.destroy();
    this.releaseGeneratedUsdz();
    this.intersectionObserver?.disconnect();
  }

  renderShell() {
    this.dialog.innerHTML = `
      <div class="cabinet-ar-dialog-shell">
        <header class="cabinet-ar-heading">
          <div><span class="section-kicker">View in your room</span><h2 id="cabinet-ar-title">Place your cabinet at true scale</h2></div>
          <button type="button" data-close-ar aria-label="Close room view">×</button>
        </header>
        <div class="cabinet-ar-content" data-ar-content></div>
      </div>
    `;
  }

  bindEvents() {
    this.dialog.addEventListener("click", (event) => {
      if (event.target === this.dialog || event.target.closest?.("[data-close-ar]")) this.close();
      if (event.target.closest?.("[data-ar-launch]")) {
        emitArAnalytics("ar_launch_started", { ...this.analyticsMetadata, arMode: event.target.closest("[data-ar-launch]").dataset.arMode || "automatic" });
      }
      if (event.target.closest?.("[data-ar-phone-link]")) emitArAnalytics("ar_qr_opened", this.analyticsMetadata);
    });
    this.dialog.addEventListener("close", () => this.restoreFocus());
  }

  observeLaunchButton() {
    const button = this.host.querySelector("[data-open-ar]");
    if (!button) return;
    if (!("IntersectionObserver" in window)) {
      emitArAnalytics("ar_button_viewed", {});
      return;
    }
    this.intersectionObserver = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      emitArAnalytics("ar_button_viewed", {});
      this.intersectionObserver.disconnect();
    }, { threshold: 0.55 });
    this.intersectionObserver.observe(button);
  }

  renderLoading(configuration) {
    this.content.innerHTML = `
      <div class="cabinet-ar-loading" role="status" aria-live="polite">
        <span class="cabinet-ar-spinner" aria-hidden="true"></span>
        <strong>Preparing your configured cabinet…</strong>
        <p>${formatDimensions(configuration)} · ${configuration.sections} sections</p>
        <small data-ar-slow-message>We’re building a lightweight 3D model only after you ask for it.</small>
      </div>
    `;
  }

  renderReady(configuration, model, capability, shareUrl) {
    this.arLaunchSucceeded = false;
    const remoteModel = model.source === "remote";
    const iosQuickLook = capability.quickLook || (capability.operatingSystem === "ios" && Boolean(model.usdzUrl));
    if (iosQuickLook && !capability.quickLook) capability = { ...capability, quickLook: true, canLaunchAr: true };
    const available = capability.webXr || capability.quickLook || (remoteModel && capability.sceneViewer);
    const arModes = [
      ...(capability.webXr ? ["webxr"] : ["webxr"]),
      ...(remoteModel ? ["scene-viewer"] : []),
      "quick-look"
    ].join(" ");
    const iosSource = model.usdzUrl ? ` ios-src="${escapeAttribute(model.usdzUrl)}"` : "";
    const poster = model.posterUrl ? ` poster="${escapeAttribute(model.posterUrl)}"` : "";
    this.content.innerHTML = `
      <div class="cabinet-ar-layout">
        <section class="cabinet-ar-viewer-panel" aria-label="Interactive configured cabinet preview">
          <model-viewer
            src="${escapeAttribute(model.glbUrl)}"${iosSource}${poster}
            alt="Configured ${escapeAttribute(configuration.productId)} cabinet, ${formatDimensions(configuration)}"
            camera-controls
            ar
            ar-modes="${arModes}"
            ar-placement="floor"
            ar-scale="fixed"
            shadow-intensity="1.2"
            shadow-softness="0.85"
            exposure="1.05"
            touch-action="pan-y"
            xr-environment>
            <button class="cabinet-ar-enter-button" type="button" slot="ar-button" data-ar-launch data-ar-mode="automatic">Start AR</button>
            <p class="cabinet-ar-scan-prompt" aria-live="polite">Move your phone slowly to find the floor.</p>
          </model-viewer>
          <div class="cabinet-ar-summary" aria-label="Configuration summary">
            <strong>${formatDimensions(configuration)}</strong>
            <span>${configuration.sections} sections · ${configuration.finishId.replaceAll("_", " ")}</span>
          </div>
        </section>
        <aside class="cabinet-ar-guidance">
          ${capability.deviceCategory === "desktop" ? desktopHandoffMarkup(shareUrl) : mobileInstructionsMarkup(available, capability, remoteModel)}
          <div class="cabinet-ar-privacy-note"><strong>Your camera stays on your device.</strong><span>JQ Bookcases does not upload, store, or analyze the camera view.</span></div>
        </aside>
      </div>
      <p class="cabinet-ar-disclaimer">AR visualization is for planning purposes. Confirm all room and product measurements before ordering.</p>
    `;
    const modelViewer = this.content.querySelector("model-viewer");
    modelViewer?.addEventListener("ar-status", (event) => this.handleArStatus(event, capability));
    modelViewer?.addEventListener("error", () => {
      this.renderNotice("The 3D model could not be loaded. Your cabinet configuration is still saved on this page.", true);
      emitArAnalytics("ar_launch_failed", { ...this.analyticsMetadata, failureReason: "model_download" });
    });
    if (!available && capability.deviceCategory === "mobile") {
      emitArAnalytics("ar_unsupported_device", { ...this.analyticsMetadata, deviceCategory: capability.deviceCategory, operatingSystem: capability.operatingSystem });
    }
    if (capability.deviceCategory === "desktop") this.renderQrCode(shareUrl);
  }

  async renderQrCode(shareUrl) {
    const canvas = this.content.querySelector("[data-ar-qr]");
    if (!canvas) return;
    try {
      const qr = await import(CABINET_AR_QR_MODULE_URL);
      await qr.toCanvas(canvas, shareUrl, {
        errorCorrectionLevel: "M",
        width: 184,
        margin: 1,
        color: { dark: "#302923", light: "#fffdf8" }
      });
      emitArAnalytics("ar_qr_displayed", this.analyticsMetadata);
    } catch (error) {
      canvas.hidden = true;
      const fallback = this.content.querySelector("[data-ar-qr-fallback]");
      if (fallback) fallback.hidden = false;
    }
  }

  handleArStatus(event, capability) {
    const status = event.detail?.status;
    if ((status === "session-started" || status === "object-placed") && !this.arLaunchSucceeded) {
      this.arLaunchSucceeded = true;
      emitArAnalytics("ar_launch_succeeded", {
        ...this.analyticsMetadata,
        deviceCategory: capability.deviceCategory,
        operatingSystem: capability.operatingSystem,
        arMode: capability.webXr ? "webxr" : capability.quickLook ? "quick-look" : "scene-viewer"
      });
    }
    if (status === "failed") {
      this.arLaunchSucceeded = false;
      this.renderNotice("AR could not start. Check camera permission, then try again in Safari on iPhone/iPad or Chrome on an AR-capable Android device.", true);
      emitArAnalytics("ar_launch_failed", { ...this.analyticsMetadata, failureReason: "session_start" });
    }
  }

  renderError(message) {
    this.content.innerHTML = `
      <div class="cabinet-ar-state cabinet-ar-error" role="alert">
        <strong>We couldn’t prepare the room view.</strong>
        <p>${escapeHtml(message)}</p>
        <p>Your design is unchanged. You can continue configuring or try again.</p>
      </div>
    `;
  }

  renderNotice(message, isError = false) {
    const existing = this.content.querySelector("[data-ar-notice]");
    if (existing) existing.remove();
    const notice = document.createElement("p");
    notice.dataset.arNotice = "";
    notice.className = `cabinet-ar-notice${isError ? " is-error" : ""}`;
    notice.setAttribute("role", isError ? "alert" : "status");
    notice.textContent = message;
    this.content.prepend(notice);
  }

  showSlowConnectionMessage() {
    const message = this.content.querySelector("[data-ar-slow-message]");
    if (message) message.textContent = "This is taking longer than usual. Keep this window open while the model finishes preparing.";
  }

  showDialog() {
    if (this.dialog.open) return;
    if (typeof this.dialog.showModal === "function") this.dialog.showModal();
    else this.dialog.setAttribute("open", "");
    this.dialog.querySelector("[data-close-ar]")?.focus();
  }

  close() {
    if (!this.dialog.open) return;
    if (typeof this.dialog.close === "function") this.dialog.close();
    else {
      this.dialog.removeAttribute("open");
      this.restoreFocus();
    }
  }

  restoreFocus() {
    if (this.invoker?.isConnected) this.invoker.focus();
    this.invoker = null;
  }

  setLaunchButtonLoading(loading) {
    const button = this.host.querySelector("[data-open-ar]");
    if (!button) return;
    button.disabled = loading;
    button.setAttribute("aria-busy", String(loading));
    const label = button.querySelector("span");
    if (label) label.textContent = loading ? "Preparing Room View…" : "View in Your Room";
  }

  currentConfigurationHash() {
    try {
      return hashCabinetArConfiguration(normalizeCabinetArConfiguration(this.getState(), this.getLayout(), { price: this.getPrice() }));
    } catch (error) {
      return "";
    }
  }

  async createPosterUrl() {
    const canvas = this.host.querySelector("[data-3d-viewer] canvas");
    if (!canvas?.toBlob) return null;
    return new Promise((resolve) => {
      try {
        canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : null), "image/webp", 0.78);
      } catch (error) {
        resolve(null);
      }
    });
  }

  releaseGeneratedUsdz() {
    if (!this.generatedUsdzUrl) return;
    URL.revokeObjectURL(this.generatedUsdzUrl);
    this.generatedUsdzUrl = "";
  }

  get content() {
    return this.dialog.querySelector("[data-ar-content]");
  }
}

function loadModelViewer() {
  if (customElements.get("model-viewer")) return Promise.resolve();
  if (modelViewerLoader) return modelViewerLoader;
  modelViewerLoader = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.type = "module";
    script.src = CABINET_AR_MODEL_VIEWER_URL;
    script.dataset.cabinetArDependency = "model-viewer";
    script.addEventListener("load", () => customElements.whenDefined("model-viewer").then(resolve), { once: true });
    script.addEventListener("error", () => reject(new Error("The interactive AR viewer could not be loaded.")), { once: true });
    document.head.appendChild(script);
  });
  return modelViewerLoader;
}

async function prepareIosUsdz(glbUrl) {
  const viewer = document.createElement("model-viewer");
  viewer.setAttribute("loading", "eager");
  viewer.style.cssText = "position:fixed;left:-10000px;top:0;width:2px;height:2px;opacity:0;pointer-events:none;";
  document.body.appendChild(viewer);
  try {
    const loaded = new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("USDZ preparation timed out.")), 20000);
      viewer.addEventListener("load", () => { window.clearTimeout(timeout); resolve(); }, { once: true });
      viewer.addEventListener("error", () => { window.clearTimeout(timeout); reject(new Error("USDZ source failed to load.")); }, { once: true });
    });
    viewer.src = glbUrl;
    await loaded;
    if (typeof viewer.prepareUSDZ !== "function") return null;
    return await viewer.prepareUSDZ();
  } catch (error) {
    return null;
  } finally {
    viewer.remove();
  }
}

function desktopHandoffMarkup(shareUrl) {
  return `
    <section class="cabinet-ar-phone-handoff">
      <span class="section-kicker">Open on your phone</span>
      <h3>View this configuration in your room</h3>
      <p>Scan the QR code with a compatible iPhone, iPad, or Android device. The link preserves this exact cabinet configuration.</p>
      <canvas data-ar-qr width="184" height="184" aria-label="QR code for this cabinet configuration"></canvas>
      <p data-ar-qr-fallback hidden>The QR code could not load, but the secure configuration link below still works.</p>
      <a href="${escapeAttribute(shareUrl)}" data-ar-phone-link>Open this configuration on your phone</a>
    </section>
  `;
}

function mobileInstructionsMarkup(available, capability, remoteModel) {
  const fallback = !available
    ? `<div class="cabinet-ar-compatibility" role="status"><strong>AR isn’t available in this browser.</strong><span>${compatibilityReason(capability, remoteModel)}</span></div>`
    : "";
  return `
    ${fallback}
    <section class="cabinet-ar-instructions">
      <span class="section-kicker">Before you start</span>
      <ol>
        <li>Move your phone slowly to scan the floor.</li>
        <li>Tap the floor to place the cabinet.</li>
        <li>Drag or rotate the cabinet to position it.</li>
        <li>Confirm all measurements before ordering.</li>
      </ol>
    </section>
  `;
}

function compatibilityReason(capability, remoteModel) {
  if (capability.requiresHttps) return "AR requires a secure HTTPS page. The interactive 3D preview remains available.";
  if (capability.isInAppBrowser) return "Open this page in Safari on iPhone/iPad or Chrome on Android.";
  if (capability.operatingSystem === "android" && !capability.webXr && !remoteModel) {
    return "This preview needs WebXR on Android. Scene Viewer will be enabled when the production public model service is configured.";
  }
  return "AR requires a compatible iPhone, iPad, or AR-capable Android device. You can still rotate the 3D preview.";
}

function formatDimensions(configuration) {
  const inches = (meters) => Math.round((meters / 0.0254) * 10) / 10;
  return `${inches(configuration.widthMeters)}″ W × ${inches(configuration.heightMeters)}″ H × ${inches(configuration.depthMeters)}″ D`;
}

function humanizeError(error) {
  const message = String(error?.message || "");
  if (/viewer could not be loaded/i.test(message)) return "The interactive viewer could not load. Check your connection and try again.";
  if (/model service/i.test(message)) return message;
  if (/model|geometry|GLB/i.test(message)) return "The configured 3D model could not be prepared. Please try again.";
  return "The room view is temporarily unavailable. Please try again.";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
