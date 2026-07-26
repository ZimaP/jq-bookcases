import { mountIcons } from "./icon-system.js?v=interface-polish-20260715a";
import {
  CATEGORY_DEFINITIONS,
  DETAIL_OPTIONS,
  FINISH_OPTIONS,
  getCategory,
  getCompatibleDetails,
  getFinish,
  getLayout,
  getMeasurementFields,
  getStyle
} from "./guided-configurator-data.js?v=guided-configurator-20260726a";
import {
  buildProjectSummary,
  createProject,
  createProjectStore,
  formatInches,
  normalizeProject,
  parseInches,
  validateMeasurements
} from "./guided-configurator-state.js?v=guided-configurator-20260726a";

const STEP_DEFINITIONS = Object.freeze([
  Object.freeze({ id: 1, label: "Choose Layout", title: "Choose the layout that matches your space", description: "Start with the wall, opening, or room condition where your built-in will be installed." }),
  Object.freeze({ id: 2, label: "Room & Size", title: "Tell us about your space", description: "Add a few approximate measurements so we can shape a preliminary project concept." }),
  Object.freeze({ id: 3, label: "Customization", title: "Refine your concept", description: "Choose a curated style direction and a few finishing details. We’ll keep the process simple." }),
  Object.freeze({ id: 4, label: "Review & Details", title: "Review your custom concept", description: "Check your selections, save the project, or share it with our design team for a quote." })
]);

const LEGACY_PRESET_MAP = Object.freeze({
  "media-wall": Object.freeze({ category: "tv-unit", layout: "clear-tv-wall", style: "library-media" }),
  "library-wall": Object.freeze({ category: "bookcase", layout: "clear-wall", style: "library-style" }),
  "feature-wall": Object.freeze({ category: "bookcase", layout: "fireplace-wall", style: "lower-cabinets-shelves" }),
  "lower-cabinets": Object.freeze({ category: "bookcase", layout: "clear-wall", style: "lower-cabinets-shelves" }),
  "desk-niche": Object.freeze({ category: "floating-storage", layout: "floating-clear-wall", style: "display-ledge-storage" }),
  "classic-open": Object.freeze({ category: "bookcase", layout: "clear-wall", style: "open-shelving" })
});

const app = document.querySelector("[data-guided-app]");
const store = createProjectStore();
const quoteEndpointMeta = document.querySelector('meta[name="jq-quote-endpoint"]');

let project = initializeProject();
let activeCustomizationTab = "style";
let previewScale = 1;
let saveDialogMode = "save";
let renamingProjectId = null;
let toastTimer = 0;
let draftTimer = 0;
let storageWarningShown = false;

if (app) {
  initializeStaticShell();
  renderApp();
  bindAppEvents();
  bindDialogEvents();
  bindHistory();
}

function initializeProject() {
  const params = new URLSearchParams(window.location.search);
  const savedProjectId = params.get("project");
  const explicitStart = params.get("start");
  const preset = LEGACY_PRESET_MAP[params.get("preset")];

  const savedProject = savedProjectId ? store.getProject(savedProjectId) : null;
  const draft = explicitStart === "new" ? null : store.loadDraft();
  let initial = savedProject;
  if (
    savedProject
    && draft?.projectId === savedProject.projectId
    && Date.parse(draft.updatedAt) >= Date.parse(savedProject.updatedAt)
  ) {
    initial = draft;
  } else if (!savedProject) {
    initial = draft;
  }
  if (!initial) initial = createProject();

  if (preset) {
    initial = normalizeProject({
      ...initial,
      category: preset.category,
      layout: preset.layout,
      style: preset.style,
      currentStep: 1,
      maxVisitedStep: Math.max(1, initial.maxVisitedStep || 1),
      measurements: {}
    });
  }

  const hashStep = Number(window.location.hash.match(/^#step-(\d)$/)?.[1]);
  if (hashStep >= 1 && hashStep <= Math.max(1, initial.maxVisitedStep || 1)) initial.currentStep = hashStep;

  if (explicitStart || preset) {
    params.delete("start");
    params.delete("preset");
    const search = params.toString();
    history.replaceState(
      { step: initial.currentStep },
      "",
      `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`
    );
  }
  return normalizeProject(initial);
}

function initializeStaticShell() {
  mountIcons(document);

  const menuButton = document.querySelector("[data-guided-menu-button]");
  const menu = document.querySelector("#guided-menu");
  menuButton?.addEventListener("click", () => {
    const open = menu?.hasAttribute("hidden");
    menu?.toggleAttribute("hidden", !open);
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    if (open) menu?.querySelector("a")?.focus();
  });

  document.addEventListener("click", (event) => {
    if (!menu || menu.hidden) return;
    if (event.target.closest("#guided-menu, [data-guided-menu-button]")) return;
    closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (menu && !menu.hidden) {
      closeMenu();
      menuButton?.focus();
    }
  });

  document.querySelector("[data-guided-save]")?.addEventListener("click", openSaveDialog);
  document.querySelector("[data-guided-projects]")?.addEventListener("click", openProjectsDialog);
}

function closeMenu() {
  const menu = document.querySelector("#guided-menu");
  const menuButton = document.querySelector("[data-guided-menu-button]");
  menu?.setAttribute("hidden", "");
  menuButton?.setAttribute("aria-expanded", "false");
  menuButton?.setAttribute("aria-label", "Open menu");
}

function renderApp(options = {}) {
  if (!app) return;
  const step = STEP_DEFINITIONS[project.currentStep - 1];
  app.innerHTML = `
    <div class="guided-shell">
      ${renderStepper()}
      <div class="guided-workspace">
        ${renderCategoryNavigation()}
        <section class="guided-main" aria-labelledby="guided-page-title">
          <header class="guided-content-head">
            <span class="guided-eyebrow">Step ${project.currentStep} of 4 · ${escapeHtml(getCategory(project.category).label)}</span>
            <h1 id="guided-page-title" tabindex="-1">${escapeHtml(step.title)}</h1>
            <p>${escapeHtml(step.description)}</p>
          </header>
          ${renderCurrentStep()}
        </section>
      </div>
    </div>
  `;
  mountIcons(app);
  applyPreviewScale();
  scheduleDraftSave();

  if (options.focusHeading) {
    requestAnimationFrame(() => app.querySelector("#guided-page-title")?.focus({ preventScroll: true }));
  }
}

function renderStepper() {
  return `
    <nav class="guided-stepper" aria-label="Project steps">
      ${STEP_DEFINITIONS.map((step) => {
        const current = project.currentStep === step.id;
        const complete = step.id < project.currentStep || (step.id < project.maxVisitedStep && step.id !== project.currentStep);
        const reachable = step.id <= project.maxVisitedStep;
        const classes = ["guided-step", current ? "is-current" : "", complete ? "is-complete" : ""].filter(Boolean).join(" ");
        return `
          <button
            class="${classes}"
            type="button"
            data-step="${step.id}"
            ${reachable && !current ? "" : "disabled"}
            ${current ? 'aria-current="step"' : ""}
            aria-label="${escapeHtml(`${step.label}${current ? ", current step" : complete ? ", completed" : ""}`)}"
          >
            <span class="guided-step-number">${complete ? '<i data-icon="check" aria-hidden="true"></i>' : step.id}</span>
            <span class="guided-step-label">${escapeHtml(step.label)}</span>
          </button>
        `;
      }).join("")}
    </nav>
  `;
}

function renderCategoryNavigation() {
  return `
    <nav class="guided-category-nav" aria-label="Project category">
      ${CATEGORY_DEFINITIONS.map((category) => `
        <button
          class="guided-category${category.id === project.category ? " is-selected" : ""}"
          type="button"
          data-category="${category.id}"
          aria-pressed="${category.id === project.category}"
        >
          <span class="category-line-icon category-line-icon--${category.icon}" aria-hidden="true"><span></span></span>
          <span>${escapeHtml(category.label)}</span>
        </button>
      `).join("")}
    </nav>
  `;
}

function renderCurrentStep() {
  if (project.currentStep === 1) return renderLayoutStep();
  if (project.currentStep === 2) return renderMeasurementStep();
  if (project.currentStep === 3) return renderCustomizationStep();
  return renderReviewStep();
}

function renderLayoutStep() {
  const category = getCategory(project.category);
  return `
    <div class="layout-grid" role="group" aria-label="${escapeHtml(category.label)} layouts">
      ${category.layouts.map((layout) => {
        const selected = layout.id === project.layout;
        return `
          <button
            class="layout-card${selected ? " is-selected" : ""}"
            type="button"
            data-layout="${layout.id}"
            aria-pressed="${selected}"
          >
            ${selected ? '<span class="layout-selected-mark" aria-label="Selected"><i data-icon="check" aria-hidden="true"></i></span>' : ""}
            ${renderLayoutIllustration(layout)}
            <span class="layout-card-title">${escapeHtml(layout.label)}</span>
          </button>
        `;
      }).join("")}
    </div>
    <aside class="guided-info">
      <i data-icon="information" aria-hidden="true"></i>
      <span>Your selected layout will be converted into a pre-designed concept in the next steps, where you can choose the size, style, finish, and key details.</span>
    </aside>
    <div class="guided-actions">
      <button class="guided-button guided-button-primary" type="button" data-continue ${project.layout ? "" : "disabled"}>
        Continue <i data-icon="arrow-right" aria-hidden="true"></i>
      </button>
    </div>
  `;
}

function renderLayoutIllustration(layout) {
  return `
    <span class="layout-illustration" data-layout-variant="${escapeAttribute(layout.id)}" data-condition="${escapeAttribute(layout.condition)}" data-feature="${escapeAttribute(layout.feature)}" aria-hidden="true">
      <span class="arch-wall"></span>
      <span class="arch-side left"></span>
      <span class="arch-side right"></span>
      <span class="arch-feature"></span>
      <span class="arch-floor"></span>
    </span>
  `;
}

function renderMeasurementStep() {
  const selectedLayout = getLayout(project.category, project.layout);
  const fields = getMeasurementFields(project.category, project.layout);
  const validation = validateMeasurements(project);
  let previousGroup = "";

  const fieldMarkup = fields.map((field) => {
    const warning = validation.warnings.find((item) => item.field === field.id);
    const groupHeading = field.group !== previousGroup
      ? `<h2 class="measurement-group-title">${escapeHtml(field.group)}</h2>`
      : "";
    previousGroup = field.group;
    return `${groupHeading}${renderMeasurementField(field, warning)}`;
  }).join("");

  return `
    <div class="measurement-layout">
      <section class="measurement-panel" aria-label="Approximate room measurements">
        <p class="selected-layout-chip"><span>${escapeHtml(getCategory(project.category).label)}</span><span aria-hidden="true">·</span><span>${escapeHtml(selectedLayout?.label || "Select a layout")}</span></p>
        <p class="measurement-format-hint">Use inches. Decimals and common fractions are welcome.</p>
        <div class="measurement-fields">${fieldMarkup}</div>
        <p class="measurement-error" data-measurement-error role="alert" ${validation.errors.length ? "" : "hidden"}>
          ${validation.errors.length ? escapeHtml(validation.errors[0].message) : ""}
        </p>
      </section>
      ${renderMeasurementDiagram(fields, selectedLayout)}
    </div>
    <aside class="guided-info">
      <i data-icon="information" aria-hidden="true"></i>
      <span>Approximate measurements are okay. Our team will confirm final field dimensions before production.</span>
    </aside>
    <div class="guided-actions">
      <button class="guided-button guided-button-secondary" type="button" data-back>
        <i data-icon="chevron-left" aria-hidden="true"></i> Back
      </button>
      <button class="guided-button guided-button-primary" type="button" data-continue>
        Continue <i data-icon="arrow-right" aria-hidden="true"></i>
      </button>
    </div>
  `;
}

function renderMeasurementField(field, warning) {
  const value = project.measurements[field.id];
  const control = field.type === "select"
    ? `
      <select id="measurement-${field.id}" data-measurement="${field.id}">
        ${field.values.map((option) => `<option value="${escapeAttribute(option.value)}"${option.value === value ? " selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
      </select>
    `
    : `
      <input
        id="measurement-${field.id}"
        type="text"
        inputmode="decimal"
        data-measurement="${field.id}"
        value="${escapeAttribute(value === null || value === undefined ? "" : formatInches(value, { decimal: true }))}"
        aria-describedby="measurement-help-${field.id}${warning ? ` measurement-warning-${field.id}` : ""}"
        ${field.required ? "required" : ""}
      >
      <span class="measurement-unit" aria-hidden="true">in</span>
    `;

  return `
    <div class="measurement-field" data-measurement-row="${field.id}">
      <label class="measurement-field-label" for="measurement-${field.id}">
        <span class="measurement-code" aria-hidden="true">${escapeHtml(field.code)}</span>${escapeHtml(field.label)}
      </label>
      <span class="measurement-input-wrap">${control}</span>
      <small class="measurement-help" id="measurement-help-${field.id}">
        ${field.type === "inches" ? "Enter an approximate value in inches." : "Choose the closest answer."}
      </small>
      ${warning ? `<small class="measurement-warning" id="measurement-warning-${field.id}">${escapeHtml(warning.message)}</small>` : ""}
    </div>
  `;
}

function renderMeasurementDiagram(fields, selectedLayout) {
  const dimensionFields = fields.filter((field) => field.type === "inches");
  return `
    <figure class="measurement-diagram-card" aria-label="Measurement diagram for ${escapeAttribute(selectedLayout?.label || "selected layout")}">
      <div class="measurement-room" data-condition="${escapeAttribute(selectedLayout?.condition || "clear-wall")}" data-feature="${escapeAttribute(selectedLayout?.feature || "none")}">
        <span class="measurement-room-wall"></span>
        <span class="measurement-room-side left"></span>
        <span class="measurement-room-side right"></span>
        <span class="measurement-feature"></span>
        <span class="measurement-room-floor"></span>
      </div>
      <div class="dimension-overlay" data-dimension-overlay>
        ${dimensionFields.map((field, index) => renderDimensionChip(field, index, dimensionFields)).join("")}
      </div>
    </figure>
  `;
}

function renderDimensionChip(field, index, fields) {
  const value = project.measurements[field.id];
  const displayValue = field.type === "select"
    ? field.values.find((option) => option.value === value)?.label || "Not sure"
    : value === null || value === undefined ? "Add estimate" : `${formatInches(value)} in`;
  const placement = dimensionPlacement(field, index, fields);
  return `
    <span class="dimension-chip" data-dimension-chip="${field.id}" data-position="${placement.position}" style="${placement.style}">
      <strong>${escapeHtml(field.code)} · ${escapeHtml(field.label)}</strong>
      <span>${escapeHtml(displayValue)}</span>
    </span>
  `;
}

function dimensionPlacement(field, index, fields) {
  if (field.position) {
    const repeatedBefore = fields
      .slice(0, index)
      .filter((candidate) => candidate.position === field.position)
      .length;
    if (!repeatedBefore) return { position: field.position, style: "" };
    if (field.position === "feature-left" || field.position === "feature-right") {
      return { position: field.position, style: `top:${27 + repeatedBefore * 16}%` };
    }
    if (field.position === "lower-left" || field.position === "lower-right") {
      return { position: field.position, style: `bottom:${17 + repeatedBefore * 14}%` };
    }
    return { position: field.position, style: "" };
  }
  if (index === 0) return { position: "top", style: "" };
  if (index === 1) return { position: "left", style: "" };
  if (index === 2) return { position: "bottom", style: "" };
  const side = index % 2 === 0 ? "custom-left" : "custom-right";
  const row = Math.floor((index - 3) / 2);
  return { position: side, style: `top:${Math.min(78, 12 + row * 17)}%` };
}

function renderCustomizationStep() {
  return `
    <div class="customization-layout">
      <section class="customization-panel" aria-label="Concept customization">
        ${renderCustomizationTabs()}
        <div
          class="customization-content"
          id="customization-panel"
          role="tabpanel"
          aria-labelledby="customization-tab-${activeCustomizationTab}"
          tabindex="0"
        >
          ${renderCustomizationPanel()}
        </div>
        <div class="customization-actions">
          <button class="guided-button guided-button-secondary" type="button" data-back>
            <i data-icon="chevron-left" aria-hidden="true"></i> Back
          </button>
          <button class="guided-button guided-button-primary" type="button" data-continue>
            Continue <i data-icon="arrow-right" aria-hidden="true"></i>
          </button>
        </div>
      </section>
      ${renderConceptPreview()}
    </div>
  `;
}

function renderCustomizationTabs() {
  const tabs = [
    { id: "style", label: "Style" },
    { id: "finish", label: "Finish" },
    { id: "details", label: "Details" }
  ];
  return `
    <div class="customization-tabs" role="tablist" aria-label="Customization sections">
      ${tabs.map((tab) => `
        <button
          class="customization-tab"
          id="customization-tab-${tab.id}"
          type="button"
          role="tab"
          data-customization-tab="${tab.id}"
          aria-controls="customization-panel"
          aria-selected="${activeCustomizationTab === tab.id}"
          tabindex="${activeCustomizationTab === tab.id ? "0" : "-1"}"
        >${escapeHtml(tab.label)}</button>
      `).join("")}
    </div>
  `;
}

function renderCustomizationPanel() {
  if (activeCustomizationTab === "finish") return renderFinishChoices();
  if (activeCustomizationTab === "details") return renderDetailChoices();
  return renderStyleChoices();
}

function renderStyleChoices() {
  const category = getCategory(project.category);
  return `
    <section class="choice-section">
      <h3>Curated ${escapeHtml(category.label)} concepts</h3>
      <div class="choice-grid">
        ${category.styles.map((style) => {
          const selected = style.id === project.style;
          return `
            <button class="choice-card${selected ? " is-selected" : ""}" type="button" data-style="${style.id}" aria-pressed="${selected}">
              ${selected ? '<span class="choice-selected-mark" aria-label="Selected"><i data-icon="check" aria-hidden="true"></i></span>' : ""}
              <span class="style-thumb" data-style="${escapeAttribute(style.id)}" aria-hidden="true"></span>
              <span class="choice-card-title">${escapeHtml(style.label)}</span>
            </button>
          `;
        }).join("")}
      </div>
    </section>
    <p class="guided-dialog-note">Each direction is a starting point. Our designers will refine proportions and construction after field measurement.</p>
  `;
}

function renderFinishChoices() {
  return `
    ${renderFinishGroup("Wood finishes", "wood", FINISH_OPTIONS.wood)}
    ${renderFinishGroup("Painted finishes", "paint", FINISH_OPTIONS.paint)}
    ${renderFinishGroup("Accent or interior", "accentFinish", FINISH_OPTIONS.accent)}
  `;
}

function renderFinishGroup(label, key, options) {
  const selectedId = key === "accentFinish" ? project.accentFinish : project.finish;
  return `
    <section class="choice-section">
      <h3>${escapeHtml(label)}</h3>
      <div class="finish-grid">
        ${options.map((finish) => `
          <button
            class="finish-choice${selectedId === finish.id ? " is-selected" : ""}"
            type="button"
            data-finish-key="${key}"
            data-finish="${finish.id}"
            data-family="${finish.family}"
            aria-pressed="${selectedId === finish.id}"
            title="${escapeAttribute(finish.label)}"
          >
            <span class="finish-swatch" style="--swatch-color:${escapeAttribute(finish.color)}" aria-hidden="true"></span>
            <span class="finish-label">${escapeHtml(finish.label)}</span>
          </button>
        `).join("")}
      </div>
    </section>
  `;
}

function renderDetailChoices() {
  const compatible = getCompatibleDetails(project.category, project.style);
  const groups = [
    { key: "doorStyle", label: "Door style", options: compatible.doorStyle },
    { key: "hardware", label: "Hardware", options: compatible.hardware },
    { key: "lighting", label: "Lighting", options: compatible.lighting },
    { key: "baseStyle", label: "Base style", options: compatible.baseStyle },
    { key: "topTreatment", label: "Top treatment", options: compatible.topTreatment }
  ].filter((group) => group.options.length);

  if (!groups.length) {
    return `<p class="guided-dialog-note">This concept has no additional details to choose. Our design team will finish the construction details with you.</p>`;
  }

  return groups.map((group) => `
    <section class="choice-section">
      <h3>${escapeHtml(group.label)}</h3>
      <div class="choice-grid${group.options.length === 3 ? " choice-grid--three" : ""}">
        ${group.options.map((option) => {
          const selected = project[group.key] === option.id;
          return `
            <button class="choice-card${selected ? " is-selected" : ""}" type="button" data-detail-key="${group.key}" data-detail="${option.id}" aria-pressed="${selected}">
              ${selected ? '<span class="choice-selected-mark" aria-label="Selected"><i data-icon="check" aria-hidden="true"></i></span>' : ""}
              <span class="choice-card-title">${escapeHtml(option.label)}</span>
            </button>
          `;
        }).join("")}
      </div>
    </section>
  `).join("");
}

function renderConceptPreview() {
  const category = getCategory(project.category);
  const layout = getLayout(project.category, project.layout);
  const selectedStyle = getStyle(project.category, project.style);
  const finish = getFinish(project.finish);
  const accentFinish = project.accentFinish === "no-accent" ? finish : getFinish(project.accentFinish);
  const hardware = DETAIL_OPTIONS.hardware.find((option) => option.id === project.hardware);
  const layoutFeature = resolveConceptFeature(category.id, layout);
  const centerIsTower = category.id === "bookcase" && ["none", "recess"].includes(layoutFeature);
  const lightingClass = project.lighting && project.lighting !== "no-lighting" ? " has-lighting" : "";
  const doorCount = category.id === "floating-storage" ? 5 : category.id === "window-storage" ? 6 : 4;
  const hardwareToken = project.hardware || "none";

  return `
    <figure
      class="concept-preview"
      data-category="${escapeAttribute(category.id)}"
      data-layout="${escapeAttribute(layout?.id || "unselected")}"
      data-style="${escapeAttribute(selectedStyle.id)}"
      data-preview-asset="${escapeAttribute(project.previewAsset)}"
      aria-label="${escapeAttribute(`${category.label} concept preview in ${finish.label}`)}"
    >
      <div class="concept-scene" data-concept-scene>
        <span class="concept-wall"></span>
        <span class="concept-ceiling"></span>
        <span class="concept-floor"></span>
        <span class="concept-rug"></span>
        <div
          class="concept-unit${lightingClass}"
          data-style="${escapeAttribute(selectedStyle.id)}"
          style="--unit-finish:${escapeAttribute(finish.color)};--accent-finish:${escapeAttribute(accentFinish.color)};--hardware-color:${escapeAttribute(hardware?.color || "#302d2a")};--door-count:${doorCount}"
          aria-hidden="true"
        >
          ${renderConceptTower("left")}
          ${centerIsTower ? renderConceptTower("center") : `<div class="concept-center-feature" data-feature="${escapeAttribute(layoutFeature)}"></div>`}
          ${renderConceptTower("right")}
          <div class="concept-base">
            ${Array.from({ length: doorCount }, () => `
              <span class="concept-door" data-door-style="${escapeAttribute(project.doorStyle || "flat-panel")}">
                <i class="concept-hardware" data-hardware="${escapeAttribute(hardwareToken)}"></i>
              </span>
            `).join("")}
          </div>
        </div>
      </div>
      <figcaption class="concept-preview-caption">
        <strong>${escapeHtml(selectedStyle.label)}</strong>
        <span>${escapeHtml([
          layout?.label,
          finish.label,
          project.accentFinish === "no-accent" ? "" : `${accentFinish.label} interior`,
          lightingLabel(project.lighting)
        ].filter(Boolean).join(" · "))}</span>
      </figcaption>
      ${renderPreviewControls()}
    </figure>
  `;
}

function renderConceptTower(position) {
  return `
    <div class="concept-tower concept-tower--${position}">
      <span class="concept-shelf"></span>
      <span class="concept-shelf"></span>
      <span class="concept-shelf"></span>
      <span class="concept-shelf"></span>
    </div>
  `;
}

function resolveConceptFeature(categoryId, layout) {
  if (categoryId === "tv-unit" && layout?.feature !== "fireplace") return "tv";
  if (categoryId === "window-storage") return "window";
  if (categoryId === "radiator-cover") return layout?.feature === "window" ? "window" : "radiator";
  return layout?.feature || "none";
}

function lightingLabel(lightingId) {
  return DETAIL_OPTIONS.lighting.find((option) => option.id === lightingId)?.label || "";
}

function renderPreviewControls() {
  return `
    <div class="preview-controls" aria-label="Preview controls">
      <button class="preview-control" type="button" data-preview-zoom="out" aria-label="Zoom out"><i data-icon="zoom-out" aria-hidden="true"></i></button>
      <button class="preview-control" type="button" data-preview-zoom="reset" aria-label="Reset preview"><i data-icon="reset" aria-hidden="true"></i></button>
      <button class="preview-control" type="button" data-preview-zoom="in" aria-label="Zoom in"><i data-icon="zoom-in" aria-hidden="true"></i></button>
    </div>
  `;
}

function renderReviewStep() {
  const summary = buildProjectSummary(project);
  return `
    <div class="review-layout">
      <div class="project-summary-column">
        <section class="project-summary-card" aria-labelledby="project-summary-title">
          <header class="summary-heading">
            <h2 id="project-summary-title">Project Summary</h2>
            <button class="guided-icon-button" type="button" data-edit-step="2" aria-label="Edit room measurements">
              <i data-icon="dimensions" aria-hidden="true"></i>
            </button>
          </header>
          <dl class="summary-list">
            ${summary.map((row) => `
              <div class="summary-row">
                <dt>${escapeHtml(row.label)}</dt>
                <dd>
                  <span data-summary-value="${escapeAttribute(row.key)}">${escapeHtml(row.value)}</span>
                  ${row.step < 4 ? `<button class="summary-edit" type="button" data-edit-step="${row.step}" aria-label="Edit ${escapeAttribute(row.label)}">Edit</button>` : ""}
                </dd>
              </div>
            `).join("")}
          </dl>
        </section>
        <div class="review-notes">
          <label for="project-notes">Notes for our design team
            <textarea id="project-notes" data-project-notes maxlength="2000" placeholder="Anything else we should consider?">${escapeHtml(project.notes)}</textarea>
          </label>
        </div>
        <div class="summary-actions">
          <button class="guided-button guided-button-primary" type="button" data-open-quote>
            Request a Quote <i data-icon="arrow-right" aria-hidden="true"></i>
          </button>
          <button class="guided-button guided-button-secondary" type="button" data-save-project>
            Save Project <i data-icon="save" aria-hidden="true"></i>
          </button>
          <button class="guided-button guided-button-secondary" type="button" data-back>
            <i data-icon="chevron-left" aria-hidden="true"></i> Back to Customization
          </button>
        </div>
      </div>
      ${renderConceptPreview()}
    </div>
    <p class="guided-support">
      <i data-icon="help-center" aria-hidden="true"></i>
      <span>Need help? <a href="mailto:info@jqwoodworking.com">Contact our design team.</a></span>
    </p>
  `;
}

function bindAppEvents() {
  app.addEventListener("click", (event) => {
    const target = event.target.closest("button, a");
    if (!target) return;

    if (target.matches("[data-step]")) {
      navigateToStep(Number(target.dataset.step));
      return;
    }
    if (target.matches("[data-category]")) {
      selectCategory(target.dataset.category);
      return;
    }
    if (target.matches("[data-layout]")) {
      const layoutId = target.dataset.layout;
      selectLayout(layoutId);
      requestAnimationFrame(() => app.querySelector(`[data-layout="${CSS.escape(layoutId)}"]`)?.focus());
      return;
    }
    if (target.matches("[data-continue]")) {
      continueFromStep();
      return;
    }
    if (target.matches("[data-back]")) {
      navigateToStep(Math.max(1, project.currentStep - 1));
      return;
    }
    if (target.matches("[data-customization-tab]")) {
      activeCustomizationTab = target.dataset.customizationTab;
      renderApp();
      requestAnimationFrame(() => app.querySelector(`[data-customization-tab="${activeCustomizationTab}"]`)?.focus());
      return;
    }
    if (target.matches("[data-style]")) {
      const styleId = target.dataset.style;
      updateProject({ style: styleId });
      renderApp();
      requestAnimationFrame(() => app.querySelector(`[data-style="${CSS.escape(styleId)}"]`)?.focus());
      return;
    }
    if (target.matches("[data-finish]")) {
      const key = target.dataset.finishKey === "accentFinish" ? "accentFinish" : "finish";
      const finishId = target.dataset.finish;
      updateProject({ [key]: finishId });
      renderApp();
      requestAnimationFrame(() => app.querySelector(`[data-finish-key="${CSS.escape(key)}"][data-finish="${CSS.escape(finishId)}"]`)?.focus());
      return;
    }
    if (target.matches("[data-detail]")) {
      const detailKey = target.dataset.detailKey;
      const detailId = target.dataset.detail;
      updateProject({ [detailKey]: detailId });
      renderApp();
      requestAnimationFrame(() => app.querySelector(`[data-detail-key="${CSS.escape(detailKey)}"][data-detail="${CSS.escape(detailId)}"]`)?.focus());
      return;
    }
    if (target.matches("[data-preview-zoom]")) {
      updatePreviewScale(target.dataset.previewZoom);
      return;
    }
    if (target.matches("[data-edit-step]")) {
      navigateToStep(Number(target.dataset.editStep));
      return;
    }
    if (target.matches("[data-open-quote]")) {
      openQuoteDialog();
      return;
    }
    if (target.matches("[data-save-project]")) {
      openSaveDialog();
    }
  });

  app.addEventListener("input", (event) => {
    if (event.target.matches("[data-measurement]")) {
      updateMeasurementFromControl(event.target);
      return;
    }
    if (event.target.matches("[data-project-notes]")) {
      project.notes = event.target.value.slice(0, 2000);
      project.updatedAt = new Date().toISOString();
      const summaryValue = app.querySelector('[data-summary-value="notes"]');
      if (summaryValue) summaryValue.textContent = project.notes || "—";
      scheduleDraftSave();
    }
  });

  app.addEventListener("change", (event) => {
    if (!event.target.matches("[data-measurement]")) return;
    updateMeasurementFromControl(event.target, { finalize: true });
  });

  app.addEventListener("keydown", (event) => {
    const tab = event.target.closest("[data-customization-tab]");
    if (!tab || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const tabs = [...app.querySelectorAll("[data-customization-tab]")];
    const currentIndex = tabs.indexOf(tab);
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    tabs[nextIndex].click();
  });
}

function selectCategory(categoryId) {
  if (categoryId === project.category) return;
  const base = createProject({ category: categoryId, projectId: project.projectId, projectName: project.projectName });
  project = normalizeProject({
    ...base,
    createdAt: project.createdAt,
    updatedAt: new Date().toISOString(),
    currentStep: 1,
    maxVisitedStep: 1
  });
  activeCustomizationTab = "style";
  previewScale = 1;
  renderApp({ focusHeading: true });
  showToast(`${getCategory(categoryId).label} selected. Choose a layout to continue.`);
}

function selectLayout(layoutId) {
  project = normalizeProject({
    ...project,
    layout: layoutId,
    measurements: project.measurements,
    updatedAt: new Date().toISOString()
  });
  renderApp();
}

function continueFromStep() {
  if (project.currentStep === 1 && !project.layout) {
    showToast("Please choose the layout that best matches your space.");
    return;
  }
  if (project.currentStep === 2) {
    const validation = validateMeasurements(project);
    if (!validation.valid) {
      const error = validation.errors[0];
      const message = app.querySelector("[data-measurement-error]");
      if (message) {
        message.hidden = false;
        message.textContent = error.message;
      }
      app.querySelector(`[data-measurement="${CSS.escape(error.field)}"]`)?.focus();
      return;
    }
  }
  navigateToStep(Math.min(4, project.currentStep + 1));
}

function navigateToStep(step, options = {}) {
  const targetStep = Math.min(4, Math.max(1, Number(step) || 1));
  if (targetStep > project.maxVisitedStep + 1) return;
  if (targetStep > 1 && !project.layout) {
    project.currentStep = 1;
    showToast("Choose a layout before moving to the next step.");
    renderApp({ focusHeading: true });
    return;
  }
  if (targetStep > 2 && !validateMeasurements(project).valid) {
    project.currentStep = 2;
    showToast("Add the three basic room measurements before continuing.");
    renderApp({ focusHeading: true });
    return;
  }

  project.currentStep = targetStep;
  project.maxVisitedStep = Math.max(project.maxVisitedStep, targetStep);
  project.updatedAt = new Date().toISOString();
  previewScale = 1;
  renderApp({ focusHeading: true });

  if (options.history !== false) {
    history.pushState({ step: targetStep }, "", `${window.location.pathname}${window.location.search}#step-${targetStep}`);
  }
  window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

function updateMeasurementFromControl(control, options = {}) {
  const field = getMeasurementFields(project.category, project.layout).find((candidate) => candidate.id === control.dataset.measurement);
  if (!field) return;
  const value = field.type === "select" ? control.value : parseInches(control.value);
  project.measurements[field.id] = value;
  project.updatedAt = new Date().toISOString();
  scheduleDraftSave();
  updateDimensionChip(field, value);

  const row = control.closest("[data-measurement-row]");
  const formatErrorId = `measurement-format-error-${field.id}`;
  const existingFormatError = row?.querySelector(".measurement-input-error");
  const invalidFormat = field.type === "inches" && control.value.trim() !== "" && value === null;
  control.toggleAttribute("aria-invalid", invalidFormat);
  if (invalidFormat) {
    const message = "Please use inches, a decimal, or a common fraction such as 42 1/2.";
    if (existingFormatError) existingFormatError.textContent = message;
    else row?.insertAdjacentHTML("beforeend", `<small class="measurement-input-error" id="${escapeAttribute(formatErrorId)}">${message}</small>`);
    const describedBy = new Set((control.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean));
    describedBy.add(formatErrorId);
    control.setAttribute("aria-describedby", [...describedBy].join(" "));
  } else {
    existingFormatError?.remove();
    const describedBy = (control.getAttribute("aria-describedby") || "")
      .split(/\s+/)
      .filter((id) => id && id !== formatErrorId);
    control.setAttribute("aria-describedby", describedBy.join(" "));
  }

  const existingWarning = row?.querySelector(".measurement-warning");
  if (field.type === "inches" && value !== null && (value < field.min || value > field.max)) {
    const message = `${field.label} is outside our usual ${formatInches(field.min)}–${formatInches(field.max)} in range. You can continue and our team will review it.`;
    if (existingWarning) existingWarning.textContent = message;
    else row?.insertAdjacentHTML("beforeend", `<small class="measurement-warning">${escapeHtml(message)}</small>`);
  } else {
    existingWarning?.remove();
  }

  const errorBox = app.querySelector("[data-measurement-error]");
  if (errorBox && validateMeasurements(project).valid) errorBox.hidden = true;
  if (options.finalize && field.type === "inches" && value !== null) control.value = formatInches(value, { decimal: true });
}

function updateDimensionChip(field, value) {
  const chip = app.querySelector(`[data-dimension-chip="${CSS.escape(field.id)}"] span:last-child`);
  if (!chip) return;
  chip.textContent = field.type === "select"
    ? field.values.find((option) => option.value === value)?.label || "Not sure"
    : value === null ? "Add estimate" : `${formatInches(value)} in`;
}

function updateProject(patch) {
  project = normalizeProject({
    ...project,
    ...patch,
    updatedAt: new Date().toISOString()
  });
}

function updatePreviewScale(action) {
  if (action === "in") previewScale = Math.min(1.2, previewScale + 0.1);
  else if (action === "out") previewScale = Math.max(0.8, previewScale - 0.1);
  else previewScale = 1;
  applyPreviewScale();
}

function applyPreviewScale() {
  app?.querySelectorAll("[data-concept-scene]").forEach((scene) => {
    scene.style.setProperty("--preview-scale", String(previewScale));
  });
}

function scheduleDraftSave() {
  window.clearTimeout(draftTimer);
  draftTimer = window.setTimeout(() => {
    if (store.saveDraft(project) || storageWarningShown) return;
    storageWarningShown = true;
    showToast("Automatic saving is unavailable in this browser. Keep this page open or enable local storage.");
  }, 180);
}

function bindHistory() {
  history.replaceState({ step: project.currentStep }, "", `${window.location.pathname}${window.location.search}#step-${project.currentStep}`);
  window.addEventListener("popstate", (event) => {
    const requestedStep = Number(event.state?.step || window.location.hash.match(/^#step-(\d)$/)?.[1]);
    if (requestedStep >= 1 && requestedStep <= project.maxVisitedStep) navigateToStep(requestedStep, { history: false });
  });
}

function bindDialogEvents() {
  document.querySelectorAll("[data-dialog-close]").forEach((button) => {
    button.addEventListener("click", () => button.closest("dialog")?.close());
  });

  document.querySelectorAll(".guided-dialog").forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      const inside = event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
      if (!inside) dialog.close();
    });
  });

  document.querySelector("[data-save-form]")?.addEventListener("submit", handleSaveForm);
  document.querySelector("[data-new-project]")?.addEventListener("click", startNewProject);
  document.querySelector("[data-projects-list]")?.addEventListener("click", handleProjectListAction);
  document.querySelector("[data-quote-form]")?.addEventListener("submit", handleQuoteSubmit);
}

function openDialog(dialog) {
  if (!dialog) return;
  if (dialog.open) return;
  dialog.showModal();
  mountIcons(dialog);
}

function openSaveDialog() {
  const dialog = document.querySelector("[data-save-dialog]");
  const form = dialog?.querySelector("[data-save-form]");
  if (!dialog || !form) return;
  saveDialogMode = "save";
  renamingProjectId = null;
  const title = dialog.querySelector("#save-dialog-title");
  if (title) title.textContent = "Save this project";
  form.elements.projectName.value = project.projectName === "Untitled Project"
    ? `${getCategory(project.category).label} Project`
    : project.projectName;
  openDialog(dialog);
  requestAnimationFrame(() => form.elements.projectName.select());
}

function handleSaveForm(event) {
  event.preventDefault();
  const dialog = event.currentTarget.closest("dialog");
  const name = event.currentTarget.elements.projectName.value.trim();
  if (!name) {
    event.currentTarget.elements.projectName.focus();
    return;
  }

  if (saveDialogMode === "rename" && renamingProjectId) {
    const renamed = store.renameProject(renamingProjectId, name);
    if (!renamed) {
      showToast("We couldn’t rename this project because local storage is unavailable.");
      return;
    }
    dialog.close();
    renderProjectsList();
    showToast("Project renamed.");
    return;
  }

  project.projectName = name.slice(0, 80);
  project.status = "saved";
  project.updatedAt = new Date().toISOString();
  const savedProject = store.saveProject(project, project.projectName);
  if (!savedProject || !store.saveDraft(savedProject)) {
    project.status = "draft";
    showToast("We couldn’t save this project because local storage is unavailable.");
    return;
  }
  project = savedProject;
  dialog.close();
  showToast(`“${project.projectName}” was saved on this device.`);
}

function openProjectsDialog() {
  renderProjectsList();
  openDialog(document.querySelector("[data-projects-dialog]"));
}

function renderProjectsList() {
  const list = document.querySelector("[data-projects-list]");
  if (!list) return;
  const projects = store.listProjects();
  if (!projects.length) {
    list.innerHTML = `<p class="guided-project-empty">No saved projects yet. Your current work is still being kept as an automatic draft.</p>`;
    return;
  }

  list.innerHTML = projects.map((saved) => {
    const category = getCategory(saved.category);
    const layout = getLayout(saved.category, saved.layout);
    return `
      <article class="saved-project">
        <div class="saved-project-copy">
          <strong>${escapeHtml(saved.projectName)}</strong>
          <small>${escapeHtml([category.label, layout?.label, formatSavedDate(saved.updatedAt)].filter(Boolean).join(" · "))}</small>
        </div>
        <div class="saved-project-actions">
          <button type="button" data-project-action="resume" data-project-id="${escapeAttribute(saved.projectId)}" aria-label="Resume ${escapeAttribute(saved.projectName)}"><i data-icon="chevron-right" aria-hidden="true"></i></button>
          <button type="button" data-project-action="rename" data-project-id="${escapeAttribute(saved.projectId)}" aria-label="Rename ${escapeAttribute(saved.projectName)}"><i data-icon="dimensions" aria-hidden="true"></i></button>
          <button type="button" data-project-action="duplicate" data-project-id="${escapeAttribute(saved.projectId)}" aria-label="Duplicate ${escapeAttribute(saved.projectName)}"><i data-icon="copy" aria-hidden="true"></i></button>
          <button type="button" data-project-action="delete" data-project-id="${escapeAttribute(saved.projectId)}" aria-label="Delete ${escapeAttribute(saved.projectName)}"><i data-icon="trash" aria-hidden="true"></i></button>
        </div>
      </article>
    `;
  }).join("");
  mountIcons(list);
}

function handleProjectListAction(event) {
  const button = event.target.closest("[data-project-action]");
  if (!button) return;
  const saved = store.getProject(button.dataset.projectId);
  if (!saved) {
    renderProjectsList();
    return;
  }

  if (button.dataset.projectAction === "resume") {
    project = normalizeProject(saved);
    document.querySelector("[data-projects-dialog]")?.close();
    previewScale = 1;
    activeCustomizationTab = "style";
    renderApp({ focusHeading: true });
    history.replaceState({ step: project.currentStep }, "", `${window.location.pathname}?project=${encodeURIComponent(project.projectId)}#step-${project.currentStep}`);
    showToast(`Resumed “${project.projectName}.”`);
    return;
  }

  if (button.dataset.projectAction === "rename") {
    saveDialogMode = "rename";
    renamingProjectId = saved.projectId;
    const dialog = document.querySelector("[data-save-dialog]");
    const form = dialog?.querySelector("[data-save-form]");
    const title = dialog?.querySelector("#save-dialog-title");
    if (title) title.textContent = "Rename project";
    if (form) form.elements.projectName.value = saved.projectName;
    openDialog(dialog);
    requestAnimationFrame(() => form?.elements.projectName.select());
    return;
  }

  if (button.dataset.projectAction === "duplicate") {
    if (!store.duplicateProject(saved.projectId)) {
      showToast("We couldn’t duplicate this project because local storage is unavailable.");
      return;
    }
    renderProjectsList();
    showToast("Project duplicated.");
    return;
  }

  if (button.dataset.projectAction === "delete") {
    if (!window.confirm(`Delete “${saved.projectName}” from this device? This cannot be undone.`)) return;
    if (!store.deleteProject(saved.projectId)) {
      showToast("We couldn’t delete this project because local storage is unavailable.");
      return;
    }
    renderProjectsList();
    showToast("Project deleted.");
  }
}

function startNewProject() {
  project = createProject();
  if (!store.saveDraft(project)) {
    storageWarningShown = true;
    showToast("This new project can’t be saved locally in the current browser.");
  }
  document.querySelector("[data-projects-dialog]")?.close();
  activeCustomizationTab = "style";
  previewScale = 1;
  renderApp({ focusHeading: true });
  history.replaceState({ step: 1 }, "", `${window.location.pathname}#step-1`);
  showToast("A new project is ready.");
}

function openQuoteDialog() {
  const dialog = document.querySelector("[data-quote-dialog]");
  const form = dialog?.querySelector("[data-quote-form]");
  const success = dialog?.querySelector("[data-quote-success]");
  if (!dialog || !form || !success) return;
  form.hidden = false;
  success.hidden = true;
  const error = form.querySelector("[data-quote-error]");
  if (error) error.hidden = true;
  form.elements.notes.value = project.notes || "";
  for (const [key, value] of Object.entries(project.customerDetails || {})) {
    const field = form.elements.namedItem(key);
    if (field && "value" in field) field.value = value;
  }
  updateQuoteMode(form);
  openDialog(dialog);
  requestAnimationFrame(() => form.elements.fullName.focus());
}

function updateQuoteMode(form) {
  const endpoint = quoteEndpointMeta?.content.trim();
  const mode = form.querySelector("[data-quote-mode]");
  const submit = form.querySelector("[data-quote-submit]");
  if (endpoint) {
    mode.textContent = "Your request and selected files will be sent securely to the JQ design team.";
    submit.textContent = "Send Quote Request";
  } else {
    mode.textContent = "Online submission is not connected on this static site. We’ll prepare a complete email for you to review and send; selected files must be attached in your email app.";
    submit.textContent = "Prepare Email Request";
  }
}

async function handleQuoteSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const error = form.querySelector("[data-quote-error]");
  const submit = form.querySelector("[data-quote-submit]");
  if (error) error.hidden = true;

  if (!form.checkValidity()) {
    form.reportValidity();
    if (error) {
      error.textContent = "Please complete the required contact details before continuing.";
      error.hidden = false;
    }
    return;
  }

  const fileError = validateQuoteFiles(form);
  if (fileError) {
    if (error) {
      error.textContent = fileError;
      error.hidden = false;
    }
    return;
  }

  const formData = new FormData(form);
  project.customerDetails = {
    fullName: String(formData.get("fullName") || ""),
    email: String(formData.get("email") || ""),
    phone: String(formData.get("phone") || ""),
    zip: String(formData.get("zip") || ""),
    address: String(formData.get("address") || ""),
    timeline: String(formData.get("timeline") || ""),
    contactMethod: String(formData.get("contactMethod") || "")
  };
  project.notes = String(formData.get("notes") || "").slice(0, 2000);
  project.uploadedFiles = [...form.querySelectorAll('input[type="file"]')]
    .flatMap((input) => [...(input.files || [])])
    .map((file) => ({ name: file.name, size: file.size, type: file.type }));
  project.updatedAt = new Date().toISOString();
  store.saveDraft(project);

  const endpoint = quoteEndpointMeta?.content.trim();
  if (!endpoint) {
    prepareQuoteEmail(project);
    const mode = form.querySelector("[data-quote-mode]");
    mode.innerHTML = `Your email draft is ready. Send it to complete the request, and attach any selected files. If no email window opened, <a href="${escapeAttribute(buildMailtoUrl(project))}" data-email-fallback>open the prepared email again</a>.`;
    return;
  }

  submit.disabled = true;
  submit.textContent = "Sending…";
  try {
    formData.append("project", JSON.stringify(project));
    const response = await fetch(endpoint, {
      method: "POST",
      body: formData,
      headers: { Accept: "application/json" }
    });
    if (!response.ok) throw new Error(`Quote endpoint returned ${response.status}`);
    const result = await response.json().catch(() => ({}));
    const reference = typeof result.reference === "string" && result.reference.trim()
      ? result.reference.trim()
      : project.projectId;
    project.status = "quote-requested";
    project.updatedAt = new Date().toISOString();
    store.saveDraft(project);
    if (project.projectName !== "Untitled Project") store.saveProject(project);
    showQuoteSuccess(reference);
  } catch {
    if (error) {
      error.textContent = "We couldn’t send your request right now. Your project is still saved on this device. Please try again or email info@jqwoodworking.com.";
      error.hidden = false;
    }
  } finally {
    submit.disabled = false;
    submit.textContent = "Send Quote Request";
  }
}

function validateQuoteFiles(form) {
  const files = [...form.querySelectorAll('input[type="file"]')].flatMap((input) => [...(input.files || [])]);
  const oversized = files.find((file) => file.size > 10 * 1024 * 1024);
  if (oversized) return `${oversized.name} is larger than 10 MB. Please choose a smaller file.`;
  const unsupported = files.find((file) => {
    const name = file.name.toLowerCase();
    return !(file.type.startsWith("image/") || file.type === "application/pdf" || name.endsWith(".heic") || name.endsWith(".pdf"));
  });
  if (unsupported) return `${unsupported.name} is not a supported image or PDF file.`;
  return "";
}

function buildMailtoUrl(currentProject) {
  const summary = buildProjectSummary(currentProject)
    .map((row) => `${row.label}: ${row.value}`)
    .join("\n");
  const details = currentProject.customerDetails;
  const attachments = currentProject.uploadedFiles.length
    ? `\n\nFiles to attach manually:\n${currentProject.uploadedFiles.map((file) => `- ${file.name}`).join("\n")}`
    : "";
  const subject = `JQ Project Quote Request · ${currentProject.projectId}`;
  const body = [
    `Hello JQ design team,`,
    "",
    "I would like to request a quote for the project below.",
    "",
    `Project reference: ${currentProject.projectId}`,
    `Project name: ${currentProject.projectName}`,
    `Name: ${details.fullName}`,
    `Email: ${details.email}`,
    `Phone: ${details.phone}`,
    `ZIP: ${details.zip}`,
    `Installation address: ${details.address || "Not provided"}`,
    `Preferred timeline: ${details.timeline}`,
    `Preferred contact: ${details.contactMethod}`,
    "",
    summary,
    "",
    `Additional notes: ${currentProject.notes || "None"}`,
    attachments,
    "",
    "Please let me know the next step for a design review and field measurement."
  ].join("\n");
  return `mailto:info@jqwoodworking.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function prepareQuoteEmail(currentProject) {
  const anchor = document.createElement("a");
  anchor.href = buildMailtoUrl(currentProject);
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

function showQuoteSuccess(reference) {
  const dialog = document.querySelector("[data-quote-dialog]");
  const form = dialog?.querySelector("[data-quote-form]");
  const success = dialog?.querySelector("[data-quote-success]");
  if (!form || !success) return;
  form.hidden = true;
  success.hidden = false;
  success.innerHTML = `
    <h3>Your project request was sent.</h3>
    <p><strong>Reference:</strong> ${escapeHtml(reference)}</p>
    <p>We received your ${escapeHtml(getCategory(project.category).label.toLowerCase())} concept, approximate measurements, selections, contact details, and selected files.</p>
    <p>The JQ design team will review the project and contact you using your preferred method to discuss feasibility, final measurements, and next steps.</p>
    <div class="guided-dialog-actions">
      <button class="guided-button guided-button-primary" type="button" data-dialog-close>Done</button>
    </div>
  `;
  mountIcons(success);
  success.querySelector("[data-dialog-close]")?.addEventListener("click", () => dialog.close());
  success.focus?.();
}

function showToast(message) {
  const toast = document.querySelector("[data-guided-toast]");
  if (!toast) return;
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 3600);
}

function formatSavedDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
