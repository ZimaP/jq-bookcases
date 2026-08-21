import {
  FIELDS,
  PENDING_ITEMS,
  V4_PROOF,
  authorityItem,
  fieldsFor,
  isV4ProofRoute,
  layoutById
} from "./authority-contract.js";
import {
  readV4Draft,
  resetV4Field,
  setV4Field,
  setV4Layout,
  writeV4Draft
} from "./state.js";
import { createV4LayoutViewer } from "./viewer-v4.js";

if (!isV4ProofRoute()) throw new Error("Configurator Authority V4 is restricted to its exact loopback proof route.");

const app = document.querySelector("[data-guided-app]");
let project = readV4Draft();
let viewer = null;
let viewerState = "idle";
let mountedLayoutId = "";
let renderToken = 0;
let syncQueued = false;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
}

function currentStep() {
  const classes = app?.querySelector(".guided-shell")?.className || "";
  return Number(classes.match(/guided-shell--step-(\d+)/)?.[1]) || 0;
}

function currentValues() {
  return project.layoutStates[project.layout].values;
}

function statusPill(status) {
  const labels = { "review-only": "Design review", "pending-authority": "Pending", "blocked-by-asset": "Blocked" };
  return `<span class="v4-status-pill v4-status-pill--${escapeHtml(status)}">${escapeHtml(labels[status] || status)}</span>`;
}

function renderField(field) {
  const value = currentValues()[field.id];
  if (field.type === "radio") {
    return `<fieldset class="v4-field-card" data-v4-field="${escapeHtml(field.id)}">
      <legend>${escapeHtml(field.label)} ${statusPill("review-only")}</legend>
      <div class="v4-radio-row">${field.values.map((option) => `<label>
        <input type="radio" name="v4-${escapeHtml(field.id)}" value="${escapeHtml(option.value)}" ${value === option.value ? "checked" : ""}>
        <span>${escapeHtml(option.label)}</span>
      </label>`).join("")}</div>
      <p class="v4-field-note">Saved for design review; the source model does not switch base construction.</p>
      <button type="button" class="v4-reset" data-v4-reset="${escapeHtml(field.id)}" aria-label="Reset ${escapeHtml(field.label)} to approved default">Reset to ${escapeHtml(field.values.find((option) => option.value === field.defaultValue)?.label || field.defaultValue)}</button>
    </fieldset>`;
  }
  return `<div class="v4-field-card" data-v4-field="${escapeHtml(field.id)}">
    <div class="v4-field-heading"><label for="v4-${escapeHtml(field.id)}">${escapeHtml(field.label)}</label>${statusPill("review-only")}</div>
    <div class="v4-number-row">
      <input id="v4-${escapeHtml(field.id)}" name="${escapeHtml(field.id)}" type="number" inputmode="decimal" min="${field.min}" max="${field.max}" step="${field.step}" value="${value ?? ""}" aria-describedby="v4-${escapeHtml(field.id)}-help v4-${escapeHtml(field.id)}-error">
      <span aria-hidden="true">in</span>
      <button class="v4-reset" type="button" data-v4-reset="${escapeHtml(field.id)}" aria-label="Reset ${escapeHtml(field.label)} to approved default">Reset</button>
    </div>
    <p id="v4-${escapeHtml(field.id)}-help" class="v4-field-note">${field.min}–${field.max} in · approved default ${field.defaultValue} in · model unchanged</p>
    <p id="v4-${escapeHtml(field.id)}-error" class="v4-field-error" role="alert" hidden></p>
  </div>`;
}

function renderPendingItems() {
  return `<section class="v4-pending-section" aria-labelledby="v4-pending-title">
    <div class="v4-pending-intro"><h3 id="v4-pending-title">Finish &amp; options</h3><p>Selections pending approved catalog. Nothing in this section is selectable yet.</p></div>
    <ul class="v4-pending-list" aria-label="Pending product decisions">
      ${PENDING_ITEMS.map((id) => {
        const entry = authorityItem(id);
        return `<li data-v4-pending="${escapeHtml(id)}"><span><strong>${escapeHtml(entry.label)}</strong><small>${escapeHtml(entry.pendingDecision)}</small></span>${statusPill("pending-authority")}</li>`;
      }).join("")}
    </ul>
  </section>`;
}

function renderCustomization(layoutId) {
  const layout = layoutById(layoutId);
  return `<section class="v4-customization" data-v4-customization data-layout-id="${escapeHtml(layoutId)}" aria-label="Customization for ${escapeHtml(layout?.label || "selected layout")}">
    <section class="v4-model-stage" aria-label="Interactive ${escapeHtml(layout?.label || "selected layout")} model">
      <div class="v4-stage-heading"><span><small>Selected layout</small><strong>${escapeHtml(layout?.label || "Layout")}</strong></span><span class="v4-viewer-state" data-v4-viewer-state role="status">Preparing verified model</span></div>
      <div class="v4-viewer-host" data-v4-viewer></div>
      <div class="v4-camera-bar" aria-label="Model view controls">
        <div role="group" aria-label="Named views"><button type="button" data-v4-view="front">Front</button><button type="button" data-v4-view="left">Left</button><button type="button" data-v4-view="right">Right</button></div>
        <div role="group" aria-label="Camera controls"><button type="button" data-v4-camera="out" aria-label="Zoom out">−</button><button type="button" data-v4-camera="in" aria-label="Zoom in">+</button><button type="button" data-v4-camera="fit">Fit</button><button type="button" data-v4-camera="reset">Reset view</button></div>
      </div>
    </section>
    ${renderCustomizationPanel(layoutId)}
  </section>`;
}

function renderCustomizationPanel(layoutId) {
  const fields = fieldsFor(layoutId);
  return `<aside class="v4-customization-panel" aria-labelledby="v4-customization-title">
      <header><p class="v4-eyebrow">Design review inputs</p><h2 id="v4-customization-title">Customization</h2><p>Record only confirmed construction details for the selected layout. These values persist for design review; the verified model stays at its source dimensions.</p></header>
      <div class="v4-field-stack">${fields.map(renderField).join("")}</div>
      ${currentValues().baseType === "recessed" ? `<aside class="v4-blocked-note">${statusPill("blocked-by-asset")}<strong> Recessed-base height requires design confirmation.</strong><p>No authoritative range or independent model region exists, so no height control is shown.</p></aside>` : ""}
      ${renderPendingItems()}
      <footer class="v4-panel-actions"><button class="guided-button guided-button-secondary" type="button" data-back data-v4-back>Back</button><button class="guided-button guided-button-primary" type="button" data-continue data-v4-review>Review &amp; Details</button></footer>
    </aside>`;
}

function htmlToElement(html) {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

function persist() {
  project = writeV4Draft(project);
}

function setFieldValidity(input, result) {
  const message = input.closest("[data-v4-field]")?.querySelector(".v4-field-error");
  if (result.error) {
    input.setAttribute("aria-invalid", "true");
    if (message) { message.textContent = result.error; message.hidden = false; }
    return false;
  }
  input.removeAttribute("aria-invalid");
  if (message) { message.textContent = ""; message.hidden = true; }
  return true;
}

function rerenderCustomization(root, fieldId = "") {
  const panel = root.querySelector(".v4-customization-panel");
  if (!panel) return;
  const replacement = htmlToElement(renderCustomizationPanel(project.layout));
  panel.replaceWith(replacement);
  bindCustomizationPanel(root, replacement);
  if (fieldId) {
    root.querySelector(`#v4-${CSS.escape(fieldId)}, input[name="v4-${CSS.escape(fieldId)}"][value="${CSS.escape(String(currentValues()[fieldId]))}"]`)?.focus({ preventScroll: true });
  }
}

function bindCustomizationPanel(root, panel) {
  if (!panel) return;
  panel.querySelectorAll("[data-v4-field] input").forEach((input) => {
    const fieldId = input.name.replace(/^v4-/, "");
    const field = FIELDS.find((entry) => entry.id === fieldId);
    input.addEventListener(input.type === "radio" ? "change" : "input", () => {
      if (!field) return;
      const result = setV4Field(project, fieldId, input.value);
      if (!setFieldValidity(input, result)) return;
      project = result.project;
      persist();
      if (field.type === "radio") rerenderCustomization(root, fieldId);
    });
  });
  panel.querySelectorAll("[data-v4-reset]").forEach((button) => button.addEventListener("click", () => {
    const fieldId = button.dataset.v4Reset;
    const result = resetV4Field(project, fieldId);
    if (result.error) return;
    project = result.project;
    persist();
    rerenderCustomization(root, fieldId);
  }));
}

function bindCustomization(root) {
  if (!root) return;
  bindCustomizationPanel(root, root.querySelector(".v4-customization-panel"));
  root.querySelectorAll("[data-v4-view]").forEach((button) => button.addEventListener("click", () => viewer?.setView(button.dataset.v4View)));
  root.querySelectorAll("[data-v4-camera]").forEach((button) => button.addEventListener("click", () => viewer?.zoom(button.dataset.v4Camera)));
}

function updateStageState(state, details = {}) {
  viewerState = state;
  const output = app?.querySelector("[data-v4-viewer-state]");
  if (!output) return;
  output.dataset.state = state;
  output.textContent = state === "ready"
    ? "Verified source · proof diagnostic"
    : state === "error" ? `Model unavailable${details.message ? ` · ${details.message}` : ""}` : "Preparing verified model";
}

async function mountViewer(root, layoutId) {
  const host = root.querySelector("[data-v4-viewer]");
  if (!host) return;
  const token = ++renderToken;
  viewer?.dispose();
  viewer = createV4LayoutViewer({ onStateChange: updateStageState });
  mountedLayoutId = layoutId;
  viewer.mount(host);
  try {
    await viewer.update(project, { animate: false });
  } catch (error) {
    if (token === renderToken) updateStageState("error", { message: error.message });
  }
}

function unmountViewer() {
  renderToken += 1;
  viewer?.dispose();
  viewer = null;
  viewerState = "idle";
  mountedLayoutId = "";
}

function installCustomization() {
  syncQueued = false;
  if (currentStep() !== 3) {
    document.body.removeAttribute("data-v4-step3-active");
    if (app?.querySelector("[data-v4-customization]") || viewer) unmountViewer();
    return;
  }
  document.body.dataset.v4Step3Active = "true";
  const legacy = app?.querySelector(".immersive-configurator[data-layout-id]");
  if (!legacy) return;
  const layoutId = legacy.dataset.layoutId;
  if (!layoutById(layoutId)) return;
  if (project.layout !== layoutId) {
    project = setV4Layout(project, layoutId);
    persist();
  }
  const description = app.querySelector(".guided-content-head > p");
  if (description) description.textContent = "Record confirmed construction details beside the selected verified layout model.";
  const replacement = htmlToElement(renderCustomization(layoutId));
  legacy.replaceWith(replacement);
  bindCustomization(replacement);
  void mountViewer(replacement, layoutId);
}

function scheduleInstall() {
  if (syncQueued) return;
  syncQueued = true;
  queueMicrotask(installCustomization);
}

function normalizeRetiredHash() {
  if (location.hash !== "#step-5") return;
  history.replaceState(history.state, "", `${location.pathname}${location.search}#step-4`);
}

normalizeRetiredHash();
document.body.dataset.v4AuthorityProof = "true";
const observer = new MutationObserver(scheduleInstall);
if (app) observer.observe(app, { childList: true, subtree: true });
addEventListener("popstate", scheduleInstall);
addEventListener("hashchange", scheduleInstall);
addEventListener("beforeunload", () => {
  observer.disconnect();
  unmountViewer();
}, { once: true });
scheduleInstall();

globalThis.__JQ_CONFIGURATOR_V4__ = Object.freeze({
  getProject: () => structuredClone(project),
  getViewerDiagnostics: () => viewer?.getDiagnostics() || null,
  getDiagnostics: () => Object.freeze({
    schema: "jq-configurator-authority-v4-four-step-runtime-v1",
    currentStep: currentStep(),
    mountedLayoutId,
    viewerState,
    legacyModeSelectorCount: document.querySelectorAll(".immersive-mode-selector, [data-customization-tab], [data-customization-panel]").length,
    customerShelfSurfaceCount: document.querySelectorAll("[data-dimension-handle], [data-smart-dimension], [role=slider]").length,
    pendingInteractiveCount: document.querySelectorAll("[data-v4-pending] button, [data-v4-pending] input, [data-v4-pending] select, [data-v4-pending] [tabindex]").length,
    proofRoute: V4_PROOF.flag
  }),
  ready: () => viewerState === "ready"
});
