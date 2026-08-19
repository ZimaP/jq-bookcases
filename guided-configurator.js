import { mountIcons } from "./icon-system.js?v=product-first-20260727a";
import {
  DETAIL_OPTIONS,
  FINISH_OPTIONS,
  PUBLIC_CONFIGURATOR_LAYOUT_CHOICES,
  PRODUCT_CHOICES,
  getCategory,
  getCompatibleDetails,
  getLayout,
  getMeasurementDiagramSpec,
  getMeasurementFields,
  getProductChoice,
  getProductChoiceForSelection,
  getPublicConfiguratorLayoutChoices,
  getStyle,
  isPublicConfiguratorLayout,
  isPublicConfiguratorProduct
} from "./guided-configurator-data.js?v=public-room2-glb-v1-20260817a";
import {
  buildProjectSummary,
  createProject,
  createProjectStore,
  formatInches,
  normalizeProject,
  parseInches,
  prepareMeasurementsForLayout,
  validateMeasurements
} from "./guided-configurator-state.js?v=public-room2-glb-v1-20260817a";
import {
  getImmersiveLayout,
  inchesToMillimeters,
  millimetersToInches,
  normalizeSmartDimension
} from "./guided-layout-registry.js?v=immersive-layout-configurator-v1";
import {
  resolveProductLayoutCompatibility
} from "./guided-product-adapter.js?v=tv-drawing-4-geometry-v1-20260802a";
import {
  createGuidedAcceptedSnapshot,
  prepareGuidedProjectPersistence,
  prepareGuidedQuote,
  restoreGuidedAcceptedSnapshot,
  transactGuidedProject
} from "./guided-project-engine.js?v=fitted-slim-cap-return-v1-20260803a";

const STEP_DEFINITIONS = Object.freeze([
  Object.freeze({ id: 1, label: "Choose Product", mobileLabel: "Product", title: "Choose your product", description: "Explore the complete fitted-furniture collection. Cabinets + Shelves and Window Storage are available to configure now." }),
  Object.freeze({ id: 2, label: "Choose Layout", mobileLabel: "Layout", title: "Choose the layout that matches your space", description: "Select the wall layout you want to plan. Any measurements it needs will appear next." }),
  Object.freeze({ id: 3, label: "Customization", mobileLabel: "Customize", title: "Customize your space", description: "Work directly with the selected three-dimensional layout, then save room measurements, finish, and details." }),
  Object.freeze({ id: 4, label: "Review & Details", mobileLabel: "Review", title: "Review your project details", description: "Check your saved selections beside the same verified layout model before saving or preparing a quote." })
]);

const GUIDED_DIAGNOSTIC_MESSAGES = Object.freeze({
  MISSING_BASE_ROOM_DIMENSIONS: "Enter Wall Width, Ceiling Height, and Desired Built-In Depth to validate the project details.",
  MISSING_FEATURE_MEASUREMENTS: "Complete the opening, obstacle, or return measurements required by this layout.",
  MISSING_CORNER_RETURN: "Enter the corner return measurement required by this layout.",
  NICHE_WIDTH_EXCEEDS_WALL: "Reduce the niche width or increase the wall width so the layout fits.",
  FEATURE_INTERSECTION: "Adjust the opening or obstacle measurements so the fitted areas do not overlap.",
  ROOM_WIDTH_RECONCILIATION_FAILED: "Review the wall and feature widths so they reconcile within the selected layout.",
  OPENING_CLEARANCE_FAILED: "Increase the available clearance around the opening or choose a compatible layout.",
  INSTALLATION_ZONE_TOO_NARROW: "Increase the available fitted width or choose a compatible layout.",
  INSTALLATION_ZONE_TOO_SHORT: "Increase the available fitted height or choose a compatible layout.",
  NO_COMPATIBLE_INSTALLATION_ZONE: "Adjust the room measurements or choose a layout with a compatible fitted area.",
  CONFIGURATION_NOT_ACCEPTED: "Review the measurements for the selected layout before continuing."
});

const LEGACY_PRESET_MAP = Object.freeze({
  "media-wall": Object.freeze({ category: "tv-unit", layout: "clear-wall", style: "library-media" }),
  "library-wall": Object.freeze({ category: "bookcase", layout: "clear-wall", style: "full-open-shelving" }),
  "feature-wall": Object.freeze({ category: "bookcase", layout: "fireplace-wall", style: "cabinet-base-shelves" }),
  "lower-cabinets": Object.freeze({ category: "bookcase", layout: "clear-wall", style: "cabinet-base-shelves" }),
  "desk-niche": Object.freeze({ category: "floating-storage", layout: "clear-wall", style: "display-ledge-storage" }),
  "classic-open": Object.freeze({ category: "bookcase", layout: "clear-wall", style: "full-open-shelving" })
});

const BOOKCASE_CONFIGURATION_DEFAULTS = Object.freeze({
  "cabinet-base-shelves": Object.freeze({
    hardware: "brass-pull",
    lighting: "warm-led",
    baseStyle: "flush-base",
    topTreatment: "small-crown"
  }),
  "drawer-base-shelves": Object.freeze({
    hardware: "brass-pull",
    lighting: "warm-led",
    baseStyle: "recessed-toe-kick",
    topTreatment: "small-crown"
  }),
  "tv-wall-cabinets": Object.freeze({
    hardware: "knob",
    lighting: "warm-led",
    baseStyle: "recessed-toe-kick",
    topTreatment: "traditional-crown"
  }),
  "full-open-shelving": Object.freeze({
    lighting: "warm-led",
    baseStyle: "flush-base",
    topTreatment: "traditional-crown"
  })
});

const app = document.querySelector("[data-guided-app]");
const store = createProjectStore();
const quoteEndpointMeta = document.querySelector('meta[name="jq-quote-endpoint"]');

let project = initializeProject();
const restoredAcceptedSpecification = project.acceptedSnapshot
  ? restoreGuidedAcceptedSnapshot(project, project.acceptedSnapshot)
  : null;
let activeCustomizationTab = "view";
let activeDimensionFieldId = "";
let customizationModeFocusReturn = null;
let activeNamedView = "";
const customizationMobileQuery = window.matchMedia("(max-width: 767px)");
const customizationTabletQuery = window.matchMedia("(max-width: 1279px)");
let customizationSheetState = customizationMobileQuery.matches
  ? "collapsed"
  : customizationTabletQuery.matches ? "half" : "expanded";
let customizationSheetFocusReturn = null;
let previewScale = 1;
let saveDialogMode = "save";
let renamingProjectId = null;
let toastTimer = 0;
let draftTimer = 0;
let storageWarningShown = false;
const previewPreloadCache = new Set();
let guidedSceneController = null;
let guidedSceneImportPromise = null;
let guidedSceneSyncToken = 0;
let guidedSceneMeasurementTimer = 0;
let guidedSceneFocusReturn = null;
let acceptedSpecification = restoredAcceptedSpecification?.accepted
  ? restoredAcceptedSpecification
  : project.acceptedSnapshot?.acceptedSpecification || null;
let guidedProjectTransaction = restoredAcceptedSpecification?.accepted
  ? {
      accepted: true,
      specification: restoredAcceptedSpecification,
      errors: [],
      warnings: restoredAcceptedSpecification.warnings || []
    }
  : null;

normalizeInitialProjectReachability();

if (app) {
  initializeStaticShell();
  renderApp();
  bindAppEvents();
  bindDialogEvents();
  bindHistory();
  customizationMobileQuery.addEventListener("change", handleCustomizationBreakpointChange);
  customizationTabletQuery.addEventListener("change", handleCustomizationBreakpointChange);
  window.addEventListener("pagehide", (event) => {
    if (event.persisted) return;
    window.clearTimeout(guidedSceneMeasurementTimer);
    app.dataset.measurementTimerOwnership = "0";
    guidedSceneController?.dispose?.();
    guidedSceneController = null;
  });
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

  if (preset && isPublicConfiguratorProduct(preset.category, preset.style)) {
    initial = normalizeProject({
      ...initial,
      category: preset.category,
      productSelected: true,
      layout: preset.layout,
      style: preset.style,
      currentStep: 1,
      maxVisitedStep: Math.max(1, initial.maxVisitedStep || 1),
      measurements: {}
    });
  }

  const migrationSource = initial.workflowMigrationSource;
  const rawHashStep = Number(window.location.hash.match(/^#step-(\d+)$/)?.[1]);
  const hashStep = normalizeWorkflowStep(rawHashStep, {
    legacyFiveStep: migrationSource === "five-step" || migrationSource === "legacy-category-flow"
  });
  if (hashStep >= 1 && hashStep <= Math.max(1, initial.maxVisitedStep || 1)) initial.currentStep = hashStep;

  if (initial.productAvailability === "unavailable") {
    // This is only the active working copy. The saved record in My Projects is
    // left untouched until the customer explicitly renames, duplicates, or
    // deletes it.
    initial.currentStep = 1;
    initial.maxVisitedStep = 1;
  } else if (initial.layoutAvailability === "unavailable") {
    // Preserve the unsupported layout and its measurements in the working
    // copy, but never let a stale draft, project, preset, or hash enter the
    // audited immersive viewer path.
    initial.currentStep = 2;
    initial.maxVisitedStep = Math.min(2, Math.max(2, initial.maxVisitedStep || 2));
  }

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

function normalizeWorkflowStep(rawStep, options = {}) {
  const step = Number(rawStep);
  if (!Number.isFinite(step)) return null;
  if (options.legacyFiveStep) {
    if (step <= 1) return 1;
    if (step === 2) return 2;
    if (step <= 4) return 3;
    return 4;
  }
  return Math.min(4, Math.max(1, step));
}

function normalizeInitialProjectReachability() {
  if (project.productAvailability === "unavailable") {
    project.currentStep = 1;
    project.maxVisitedStep = 1;
    history.replaceState(
      { step: 1 },
      "",
      `${window.location.pathname}${window.location.search}#step-1`
    );
    return;
  }
  if (project.layoutAvailability === "unavailable") {
    project.currentStep = 2;
    project.maxVisitedStep = Math.min(2, project.maxVisitedStep);
    history.replaceState(
      { step: 2 },
      "",
      `${window.location.pathname}${window.location.search}#step-2`
    );
    return;
  }
  if (project.currentStep < 4) return;
  const transaction = transactGuidedProject(project, acceptedSpecification);
  if (transaction.accepted) return;
  project.currentStep = 3;
  project.maxVisitedStep = Math.min(3, project.maxVisitedStep);
  history.replaceState(
    { step: 3 },
    "",
    `${window.location.pathname}${window.location.search}#step-3`
  );
}

function isActivePublicProject(candidate = project) {
  return candidate?.productSelected === true
    && candidate.productAvailability === "available"
    && isPublicConfiguratorProduct(candidate.category, candidate.style);
}

function isActivePublicLayout(candidate = project) {
  return isActivePublicProject(candidate)
    && candidate?.layoutAvailability === "available"
    && isPublicConfiguratorLayout(candidate.category, candidate.style, candidate.layout);
}

function getGuidedDiagnosticMessage(diagnostic) {
  if (diagnostic?.message) return diagnostic.message;
  return GUIDED_DIAGNOSTIC_MESSAGES[diagnostic?.code]
    || "Review the measurements for the selected layout and correct the values before continuing.";
}

function formatGuidedDiagnostic(diagnostic) {
  const code = diagnostic?.code || "CONFIGURATION_NOT_ACCEPTED";
  return `${getGuidedDiagnosticMessage(diagnostic)} (${code})`;
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
  window.clearTimeout(guidedSceneMeasurementTimer);
  guidedSceneMeasurementTimer = 0;
  app.dataset.measurementTimerOwnership = "0";
  syncAcceptedSpecification();
  const step = STEP_DEFINITIONS[project.currentStep - 1];
  app.innerHTML = `
    <div class="guided-shell guided-shell--step-${project.currentStep}">
      ${renderStepper()}
      <div class="guided-workspace guided-workspace--unified">
        <section class="guided-main" aria-labelledby="guided-page-title">
          <header class="guided-content-head">
            <h1 id="guided-page-title" tabindex="-1">${escapeHtml(step.title)}</h1>
            <p>${escapeHtml(step.description)}</p>
          </header>
          ${renderCurrentStep()}
        </section>
      </div>
    </div>
  `;
  mountIcons(app);
  syncLayoutThumbnailStates();
  syncSaveControlState();
  applyPreviewScale();
  syncGuidedScene();
  syncCustomizationSheetAccessibility();
  scheduleDraftSave();
  scheduleLikelyNextStepImages();

  requestAnimationFrame(() => {
    if (!options.focusHeading) return;
    app.querySelector("#guided-page-title")?.focus({ preventScroll: true });
  });
}

function syncAcceptedSpecification() {
  const savedAccepted = project.acceptedSnapshot?.acceptedSpecification;
  const previous = acceptedSpecification?.projectId === project.projectId
    ? acceptedSpecification
    : savedAccepted?.projectId === project.projectId ? savedAccepted : null;
  guidedProjectTransaction = transactGuidedProject(project, previous);
  if (guidedProjectTransaction.accepted) {
    acceptedSpecification = guidedProjectTransaction.specification;
    project.acceptedSnapshot = createGuidedAcceptedSnapshot(acceptedSpecification, project);
  } else {
    acceptedSpecification = guidedProjectTransaction.specification;
  }
  return guidedProjectTransaction;
}

function prepareCurrentProjectPersistence() {
  const preparation = prepareGuidedProjectPersistence(project, acceptedSpecification);
  guidedProjectTransaction = preparation.transaction;
  if (preparation.accepted) {
    acceptedSpecification = preparation.specification;
    project.acceptedSnapshot = preparation.snapshot;
  } else {
    acceptedSpecification = preparation.specification;
  }
  syncSaveControlState();
  return preparation;
}

function syncSaveControlState() {
  const unavailableProduct = project.productAvailability === "unavailable";
  const unavailableLayout = project.layoutAvailability === "unavailable";
  const blocked = guidedProjectTransaction?.accepted === false || unavailableProduct || unavailableLayout;
  const diagnostic = guidedProjectTransaction?.errors?.[0];
  document.querySelectorAll("[data-guided-save], [data-save-project]").forEach((button) => {
    button.dataset.persistenceState = blocked ? "rejected-candidate" : "ready";
    if (blocked) {
      button.setAttribute(
        "title",
        unavailableProduct || unavailableLayout
          ? unavailableProduct
            ? "This saved product is unavailable in the public preview. Its existing record remains in My Projects."
            : "This saved layout is unavailable in the three-layout interactive preview. Its existing record remains in My Projects."
          : `${getGuidedDiagnosticMessage(diagnostic)} Save is unavailable until this edit is corrected.`
      );
    } else {
      button.removeAttribute("title");
    }
  });
}

function scheduleLikelyNextStepImages() {
  let assets = [];

  if (project.currentStep === 1 && isActivePublicProject()) {
    assets = PUBLIC_CONFIGURATOR_LAYOUT_CHOICES.map((layout) => layout.previewAsset);
  }

  if (!assets.length) return;
  window.setTimeout(() => {
    [...new Set(assets)].forEach(preloadPreviewAsset);
  }, 0);
}

function preloadPreviewAsset(asset) {
  if (!asset) return;

  const optimizedSource = assetSupportsOptimizedVersion(asset)
    ? optimizedImageAsset(asset)
    : asset;
  const sources = [optimizedSource];

  for (const source of sources) {
    if (previewPreloadCache.has(source)) continue;
    previewPreloadCache.add(source);
    const image = new Image();
    image.decoding = "async";
    image.src = source;
  }
}

function assetSupportsOptimizedVersion(asset) {
  const source = String(asset || "");
  return source.endsWith(".png")
    && !source.includes("/furniture/")
    && !source.includes("-finish-mask-");
}

function optimizedImageAsset(asset) {
  const source = String(asset || "");
  return source.replace(/\.png$/i, ".avif");
}

function renderOptimizedPicture(asset, options = {}) {
  const source = String(asset || "");
  const optimizedSource = optimizedImageAsset(source);
  const pictureClass = ["guided-picture", options.pictureClass].filter(Boolean).join(" ");
  const imageClass = ["guided-picture-image", options.imageClass].filter(Boolean).join(" ");
  const loading = options.loading === "eager" ? "eager" : "lazy";
  const fetchPriority = options.fetchPriority ? ` fetchpriority="${escapeAttribute(options.fetchPriority)}"` : "";
  const style = options.style ? ` style="${escapeAttribute(options.style)}"` : "";
  const deferredFallback = options.deferredFallback === true;
  const sourceAttribute = deferredFallback
    ? `data-fallback-srcset="${escapeAttribute(optimizedSource)}"`
    : `srcset="${escapeAttribute(optimizedSource)}"`;
  const imageSourceAttributes = deferredFallback
    ? `src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" data-fallback-src="${escapeAttribute(source)}"`
    : `src="${escapeAttribute(source)}"`;

  return `
    <picture class="${escapeAttribute(pictureClass)}" aria-hidden="true">
      <source type="image/avif" ${sourceAttribute}>
      <img
        class="${escapeAttribute(imageClass)}"
        ${imageSourceAttributes}
        alt=""
        loading="${loading}"
        decoding="async"
        ${fetchPriority}${style}
      >
    </picture>
  `;
}

function renderPngImage(asset, options = {}) {
  const imageClass = ["guided-picture-image", options.imageClass].filter(Boolean).join(" ");
  const loading = options.loading === "eager" ? "eager" : "lazy";
  const fetchPriority = options.fetchPriority ? ` fetchpriority="${escapeAttribute(options.fetchPriority)}"` : "";
  const layoutThumbnail = options.layoutThumbnail === true ? " data-layout-thumbnail" : "";

  return `
    <img
      class="${escapeAttribute(imageClass)}"
      src="${escapeAttribute(asset)}"
      alt=""
      loading="${loading}"
      decoding="async"
      ${fetchPriority}
      ${layoutThumbnail}
      aria-hidden="true"
    >
  `;
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
            <span class="guided-step-number">${step.id}</span>
            <span class="guided-step-label guided-step-label--full" aria-hidden="true">${escapeHtml(step.label)}</span>
            <span class="guided-step-label guided-step-label--mobile" aria-hidden="true">${escapeHtml(step.mobileLabel)}</span>
          </button>
        `;
      }).join("")}
    </nav>
  `;
}

function renderCategoryIcon(icon) {
  const common = `class="category-line-icon category-line-icon--${escapeAttribute(icon)}" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"`;
  const paths = {
    bookcase: `
      <rect x="5.5" y="8" width="7.5" height="25" rx="1"></rect>
      <rect x="15.8" y="6.5" width="7.5" height="26.5" rx="1"></rect>
      <path d="M26.2 8.2l6.7-.7 2.4 24.3-6.7.7z"></path>
      <path d="M8.2 12h2.1M18.5 10.5h2.1M29.1 11.7l2.1-.2"></path>
    `,
    tv: `
      <rect x="4.5" y="7" width="31" height="21" rx="1.5"></rect>
      <path d="M15 33h10M20 28v5"></path>
    `,
    floating: `
      <rect x="4.5" y="8.5" width="22" height="15" rx="1"></rect>
      <path d="M26.5 15.5h9v15h-22v-7"></path>
      <path d="M9 27.2h22"></path>
    `,
    window: `
      <rect x="6.5" y="5" width="27" height="30" rx=".8"></rect>
      <path d="M20 5v30M6.5 20h27"></path>
    `,
    radiator: `
      <rect x="5" y="8" width="5.5" height="24" rx="2.7"></rect>
      <rect x="11.1" y="6.5" width="5.5" height="27" rx="2.7"></rect>
      <rect x="17.2" y="6" width="5.5" height="28" rx="2.7"></rect>
      <rect x="23.3" y="6.5" width="5.5" height="27" rx="2.7"></rect>
      <rect x="29.4" y="8" width="5.5" height="24" rx="2.7"></rect>
      <path d="M7.8 32v2M32.2 32v2"></path>
    `
  };
  return `<svg ${common}>${paths[icon] || paths.bookcase}</svg>`;
}

function renderCurrentStep() {
  if (project.currentStep === 1) return renderProductStep();
  if (project.currentStep === 2) return renderLayoutStep();
  if (project.currentStep === 3) return renderCustomizationStep();
  return renderReviewStep();
}

function renderProductStep() {
  const unavailableSelection = project.productAvailability === "unavailable"
    ? getProductChoiceForSelection(project.category, project.style)
    : null;
  return `
    ${unavailableSelection ? `
      <aside class="unavailable-project-notice" role="status" data-unavailable-product>
        <i data-icon="information" aria-hidden="true"></i>
        <span><strong>${escapeHtml(unavailableSelection.label)} is not available in this preview.</strong> Your saved project remains in My Projects unchanged. Choose an available product below to start a separate preview.</span>
      </aside>
    ` : ""}
    <div class="product-grid product-grid--catalog" role="group" aria-label="Product choices">
      ${PRODUCT_CHOICES.map((choice, index) => {
        const category = getCategory(choice.categoryId);
        const style = getStyle(choice.categoryId, choice.styleId);
        const available = isPublicConfiguratorProduct(choice.categoryId, style.id);
        const selected = available
          && project.productSelected
          && choice.categoryId === project.category
          && choice.styleId === project.style;
        return `
          <button
            class="product-card${available ? "" : " is-unavailable"}${selected ? " is-selected" : ""}"
            type="button"
            ${available
              ? `data-product-choice="${escapeAttribute(choice.id)}" data-product-category="${escapeAttribute(choice.categoryId)}" data-product-style="${escapeAttribute(style.id)}" aria-pressed="${selected}"`
              : `data-unavailable-product-choice="${escapeAttribute(choice.id)}" aria-disabled="true" aria-pressed="false"`}
            aria-label="${escapeAttribute(`${choice.label}${selected ? ", selected" : available ? ", available now" : ", not available yet"}`)}"
          >
            ${selected ? '<span class="choice-selected-mark" aria-hidden="true"><i data-icon="check" aria-hidden="true"></i></span>' : ""}
            ${available ? '<span class="product-availability-badge">Available now</span>' : '<span class="product-availability-badge product-availability-badge--unavailable">Not available yet</span>'}
            <span class="product-card-image" aria-hidden="true">
              ${renderOptimizedPicture(style.previewAsset || category.productPreviewAsset, {
                loading: index === 0 ? "eager" : "lazy",
                fetchPriority: index === 0 ? "high" : "low",
                style: `object-position:${choice.previewPosition || "50% 50%"}`
              })}
            </span>
            <span class="product-card-copy">
              <span class="product-card-reference">${escapeHtml(choice.drawingRef || category.label)}</span>
              <span class="product-card-heading">
                ${renderCategoryIcon(category.icon)}
                <span class="product-card-title">${escapeHtml(choice.label)}</span>
              </span>
              <span class="product-card-description">${escapeHtml(choice.description)}</span>
            </span>
          </button>
        `;
      }).join("")}
    </div>
    <div class="guided-actions">
      <button class="guided-button guided-button-primary" type="button" data-continue ${isActivePublicProject() ? "" : "disabled"}>
        Continue <i data-icon="arrow-right" aria-hidden="true"></i>
      </button>
    </div>
  `;
}

function renderLayoutStep() {
  const category = getCategory(project.category);
  const selectedStyle = getStyle(category.id, project.style);
  const selectedProduct = getProductChoiceForSelection(category.id, selectedStyle.id);
  const showProductFamily = selectedProduct?.label !== category.label;
  const unavailableLayout = project.layoutAvailability === "unavailable"
    ? getLayout(project.category, project.layout)
    : null;
  const publicLayoutChoices = getPublicConfiguratorLayoutChoices(project.category, project.style);
  const availableLayoutLabels = publicLayoutChoices.map(({ label }) => label).join(" or ");
  return `
    <div class="selected-product-banner">
      <span class="selected-product-banner-icon">${renderCategoryIcon(category.icon)}</span>
      <span>
        <small>Your selection</small>
        <strong>${escapeHtml(selectedProduct?.label || selectedStyle.label)}</strong>
        ${showProductFamily ? `<span class="selected-product-family">${escapeHtml(category.label)}</span>` : ""}
      </span>
      <button type="button" data-step="1">Change product</button>
    </div>
    ${unavailableLayout ? `
      <aside class="unavailable-project-notice" role="status" data-unavailable-layout>
        <i data-icon="information" aria-hidden="true"></i>
        <span><strong>${escapeHtml(unavailableLayout.label)} is not available for this product.</strong> Its saved measurements remain in My Projects. Choose ${escapeHtml(availableLayoutLabels)} to continue.</span>
      </aside>
    ` : ""}
    <div class="layout-grid layout-grid--immersive" role="group" aria-label="Layout choices">
      ${publicLayoutChoices.map((layout) => {
        const registry = getImmersiveLayout(layout.id);
        const modelAvailable = Boolean(registry?.runtimeAsset?.path && registry?.thumbnail);
        const compatibility = resolveProductLayoutCompatibility({
          project: { ...project, layout: layout.id },
          topology: { layoutId: layout.id }
        });
        const selected = layout.id === project.layout;
        const statusLabel = compatibility.status === "conditional" ? "Measurements required" : "Ready to customize";
        return `
          <button
            class="layout-card layout-card--${escapeAttribute(compatibility.status)}${selected ? " is-selected" : ""}${modelAvailable ? "" : " is-model-unavailable"}"
            type="button"
            data-layout="${escapeAttribute(layout.id)}"
            data-layout-availability="${modelAvailable ? "available" : "unavailable"}"
            data-thumbnail-state="${modelAvailable ? "loading" : "model-unavailable"}"
            data-compatibility="${escapeAttribute(compatibility.status)}"
            aria-pressed="${selected}"
            data-base-label="${escapeAttribute(`${layout.label}, ${statusLabel}`)}"
            aria-label="${escapeAttribute(`${layout.label}, ${modelAvailable ? statusLabel : "model unavailable"}`)}"
            ${modelAvailable ? "" : "disabled"}
          >
            ${selected ? '<span class="layout-selected-mark" aria-hidden="true"><i data-icon="check" aria-hidden="true"></i></span>' : ""}
            <span class="layout-compatibility-badge">${escapeHtml(statusLabel)}</span>
            <span class="layout-illustration layout-illustration--photo layout-illustration--actual-model" aria-hidden="true">
              ${modelAvailable ? renderPngImage(registry.thumbnail, { loading: "eager", layoutThumbnail: true }) : ""}
              <span class="layout-thumbnail-state" data-layout-thumbnail-status>
                <span data-thumbnail-message="loading">Loading model preview…</span>
                <span data-thumbnail-message="error">Preview image unavailable</span>
                <span data-thumbnail-message="model-unavailable">Model unavailable</span>
              </span>
            </span>
            <span class="layout-card-copy">
              <span class="layout-card-title">${escapeHtml(layout.label)}</span>
              <span class="layout-card-subtitle">Interactive 3D model</span>
            </span>
          </button>
        `;
      }).join("")}
    </div>
    <aside class="guided-info">
      <i data-icon="information" aria-hidden="true"></i>
      <span>Each layout uses its own verified model and preserves its own dimensions when you switch. Room measurements appear in Customization.</span>
    </aside>
    <div class="guided-actions">
      <button class="guided-button guided-button-secondary" type="button" data-back>
        <i data-icon="chevron-left" aria-hidden="true"></i> Back
      </button>
      <button class="guided-button guided-button-primary" type="button" data-continue ${isActivePublicLayout() ? "" : "disabled"}>
        Continue <i data-icon="arrow-right" aria-hidden="true"></i>
      </button>
    </div>
  `;
}

function renderLayoutPreview(layout) {
  if (layout.previewMode === "sprite") {
    const optimizedAsset = optimizedImageAsset(layout.previewAsset);
    return `
      <span
        class="layout-illustration layout-illustration--photo layout-illustration--sprite"
        aria-hidden="true"
        style="background-image:url('${escapeAttribute(layout.previewAsset)}');background-image:image-set(url('${escapeAttribute(optimizedAsset)}') type('image/avif'),url('${escapeAttribute(layout.previewAsset)}') type('image/png'));background-position:${escapeAttribute(layout.previewPosition)}"
      ></span>
    `;
  }
  return `
    <span class="layout-illustration layout-illustration--photo" aria-hidden="true">
      ${renderOptimizedPicture(layout.previewAsset, {
        loading: "eager",
        style: `object-position:${layout.previewPosition || "50% 50%"}`
      })}
    </span>
  `;
}

function renderLayoutIllustration(layout) {
  const leftReturn = ["niche", "left-niche"].includes(layout.condition);
  const rightReturn = ["niche", "right-niche"].includes(layout.condition);
  const isCorner = layout.condition === "corner";
  const illustrationId = escapeAttribute(layout.id);
  return `
    <span class="layout-illustration layout-illustration--architectural" data-layout-variant="${escapeAttribute(layout.id)}" data-condition="${escapeAttribute(layout.condition)}" data-feature="${escapeAttribute(layout.feature)}" aria-hidden="true">
      <svg class="layout-architectural-svg" viewBox="0 0 260 166" focusable="false">
        <defs>
          <linearGradient id="layout-wall-${illustrationId}" x1="0" y1="0" x2="0.85" y2="1">
            <stop offset="0" stop-color="#f8f7f5"></stop>
            <stop offset="0.55" stop-color="#efeeec"></stop>
            <stop offset="1" stop-color="#e7e5e2"></stop>
          </linearGradient>
          <linearGradient id="layout-left-return-${illustrationId}" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#d8d8d7"></stop>
            <stop offset="1" stop-color="#efefee"></stop>
          </linearGradient>
          <linearGradient id="layout-right-return-${illustrationId}" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#f1f1f0"></stop>
            <stop offset="1" stop-color="#d2d2d1"></stop>
          </linearGradient>
          <linearGradient id="layout-floor-${illustrationId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#d4bc9c"></stop>
            <stop offset="1" stop-color="#bb9670"></stop>
          </linearGradient>
          <pattern id="layout-planks-${illustrationId}" width="56" height="12" patternUnits="userSpaceOnUse">
            <rect width="56" height="12" fill="transparent"></rect>
            <path d="M0 .5H56M0 11.5H56M18 0V12M46 0V12" fill="none" stroke="#8e6a47" stroke-opacity=".2" stroke-width=".7"></path>
            <path d="M5 4c9-2 19-2 29 0M25 8c8-1 16-.8 25 .5" fill="none" stroke="#8e6a47" stroke-opacity=".12" stroke-width=".65"></path>
          </pattern>
          <radialGradient id="layout-fire-${illustrationId}" cx=".5" cy=".7" r=".7">
            <stop offset="0" stop-color="#ffd16a"></stop>
            <stop offset=".45" stop-color="#db6b20"></stop>
            <stop offset="1" stop-color="#48150c"></stop>
          </radialGradient>
          <filter id="layout-shadow-${illustrationId}" x="-20%" y="-20%" width="140%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.2" flood-color="#6e665d" flood-opacity=".17"></feDropShadow>
          </filter>
        </defs>
        <rect width="260" height="166" fill="#fbfaf8"></rect>
        <ellipse class="layout-room-shadow" cx="130" cy="153" rx="115" ry="7"></ellipse>
        <path class="layout-drawing-wall" d="M29 24H231V116H29Z" fill="url(#layout-wall-${illustrationId})" filter="url(#layout-shadow-${illustrationId})"></path>
        <path class="layout-drawing-floor" d="M29 116H231L252 156H8Z" fill="url(#layout-floor-${illustrationId})"></path>
        <path class="layout-floor-texture" d="M29 116H231L252 156H8Z" fill="url(#layout-planks-${illustrationId})"></path>
        <path class="layout-floor-board" d="M19 137H241M74 116L68 156M126 116L126 156M180 116L187 156"></path>
        ${leftReturn
    ? `<path class="layout-drawing-return layout-drawing-return--left" d="M29 24L9 36V137L29 116Z" fill="url(#layout-left-return-${illustrationId})"></path>`
    : `<path class="layout-drawing-return layout-drawing-return--edge-left" d="M29 24L22 30V126L29 116Z" fill="url(#layout-left-return-${illustrationId})"></path>`}
        ${rightReturn
    ? `<path class="layout-drawing-return layout-drawing-return--right" d="M231 24L251 36V137L231 116Z" fill="url(#layout-right-return-${illustrationId})"></path>`
    : `<path class="layout-drawing-return layout-drawing-return--edge-right" d="M231 24L238 30V126L231 116Z" fill="url(#layout-right-return-${illustrationId})"></path>`}
        ${isCorner ? `<path class="layout-drawing-return layout-drawing-return--corner" d="M174 24L231 36V137L174 116Z" fill="url(#layout-right-return-${illustrationId})"></path><path class="layout-corner-line" d="M174 24V116"></path>` : ""}
        <path class="layout-baseboard" d="M29 111H231V116H29Z"></path>
        ${renderLayoutFeature(layout, illustrationId)}
      </svg>
    </span>
  `;
}

function renderLayoutFeature(layout, illustrationId = escapeAttribute(layout.id)) {
  if (layout.id === "center-recess") {
    return `
      <path class="layout-recess-side" d="M92 28L101 36V116H92Z"></path>
      <path class="layout-recess-side layout-recess-side--right" d="M168 28L159 36V116H168Z"></path>
      <path class="layout-recess-shadow" d="M92 28H168V116H92Z"></path>
      <path class="layout-recess-cap" d="M88 24H172V31H88Z"></path>
    `;
  }
  if (layout.id === "double-opening") {
    return `${renderDoorFeature(59)}${renderDoorFeature(159)}`;
  }
  if (layout.id === "bay-window") {
    return `
      <path class="layout-window-frame" d="M91 51L108 44H152L169 51V102L152 108H108L91 102Z"></path>
      <path class="layout-window-line" d="M108 44V108M152 44V108M130 44V108M91 76H169"></path>
    `;
  }

  let markup = "";
  if (layout.feature === "window") {
    const wide = ["wide-window", "window-side-bookcases"].includes(layout.id);
    const x = wide ? 82 : 99;
    const width = wide ? 96 : 62;
    const innerX = x + 6;
    const innerWidth = width - 12;
    markup += `
      <rect class="layout-window-trim" x="${x}" y="43" width="${width}" height="67" rx="1"></rect>
      <rect class="layout-window-frame" x="${innerX}" y="49" width="${innerWidth}" height="55" rx=".5"></rect>
      <path class="layout-window-line" d="M${innerX + innerWidth / 3} 49V104M${innerX + (innerWidth * 2) / 3} 49V104M${innerX} 76.5H${innerX + innerWidth}"></path>
      <path class="layout-window-sill" d="M${x - 5} 111H${x + width + 5}"></path>
    `;
  } else if (layout.feature === "door") {
    markup += renderDoorFeature(107);
  } else if (layout.feature === "fireplace") {
    markup += `
      <path class="layout-chimney-side" d="M105 29L112 35V116H105Z"></path>
      <path class="layout-chimney-side layout-chimney-side--right" d="M155 29L148 35V116H155Z"></path>
      <rect class="layout-chimney-front" x="105" y="29" width="50" height="87"></rect>
      <path class="layout-chimney-cap" d="M100 25H160V32H100Z"></path>
      <path class="layout-mantel" d="M98 80H162V88H98Z"></path>
      <rect class="layout-fireplace-surround" x="108" y="88" width="44" height="28"></rect>
      <rect class="layout-firebox" x="114" y="94" width="32" height="22" fill="url(#layout-fire-${illustrationId})"></rect>
      <path class="layout-fire" d="M120 115C118 107 124 103 127 97C130 104 136 105 136 113C140 110 142 106 143 103C148 109 147 114 145 116Z"></path>
    `;
  } else if (layout.feature === "tv") {
    markup += `
      <rect class="layout-tv-screen" x="91" y="52" width="78" height="42" rx="1"></rect>
      <path class="layout-tv-glint" d="M98 58L119 58"></path>
      <path class="layout-tv-console" d="M80 103H180V114H80Z"></path>
    `;
  } else if (layout.feature === "radiator") {
    markup += renderRadiatorFeature();
  }

  if (layout.id === "fireplace-tv") {
    markup += '<rect class="layout-tv-screen" x="105" y="39" width="50" height="29" rx="1"></rect>';
  }
  if (["window-radiator", "radiator-below-window"].includes(layout.id)) {
    markup += renderRadiatorFeature(112);
  }
  if (layout.id === "window-side-tv") {
    markup += '<rect class="layout-tv-screen layout-tv-screen--side" x="49" y="61" width="43" height="27" rx="1"></rect>';
  }
  return markup;
}

function renderDoorFeature(x) {
  return `
    <rect class="layout-door-trim" x="${x - 4}" y="39" width="54" height="77"></rect>
    <rect class="layout-door-frame" x="${x}" y="43" width="46" height="73"></rect>
    <path class="layout-door-panel" d="M${x + 7} 51H${x + 39}V76H${x + 7}ZM${x + 7} 83H${x + 39}V108H${x + 7}Z"></path>
    <circle class="layout-door-knob" cx="${x + 37}" cy="80" r="1.8"></circle>
  `;
}

function renderRadiatorFeature(y = 81) {
  return `
    <rect class="layout-radiator-frame" x="99" y="${y}" width="62" height="27" rx="3"></rect>
    <path class="layout-radiator-fins" d="M107 ${y + 5}V${y + 22}M116 ${y + 5}V${y + 22}M125 ${y + 5}V${y + 22}M134 ${y + 5}V${y + 22}M143 ${y + 5}V${y + 22}M152 ${y + 5}V${y + 22}"></path>
  `;
}

function getCustomizationMeasurementContext() {
  const selectedLayout = getLayout(project.category, project.layout);
  const diagramFields = getMeasurementFields(project.category, project.layout);
  const fields = diagramFields;
  const diagramFieldIds = new Set(
    selectMeasurementDiagramFields(fields, selectedLayout).map((field) => field.id)
  );
  const denseMeasurements = fields.length > 8;
  const validation = validateMeasurements(project);
  const measurementDiagramFields = selectMeasurementDiagramFields(fields, selectedLayout);
  return { selectedLayout, fields, diagramFieldIds, denseMeasurements, validation, measurementDiagramFields };
}

function renderDimensionsChoices() {
  const { selectedLayout, fields, validation } = getCustomizationMeasurementContext();
  const registry = getImmersiveLayout(project.layout);
  const control = registry?.geometryControlManifest?.["adjustable-shelf-clearance"];
  const storedValue = project.layoutStates?.[project.layout]?.smartDimensions?.[control?.id];
  const smartValue = normalizeSmartDimension(project.layout, control?.id, storedValue ?? control?.nativeMillimeters);
  const selectedField = fields.find((field) => field.id === activeDimensionFieldId) || null;
  const selectedWarning = selectedField
    ? validation.warnings.find((item) => item.field === selectedField.id)
    : null;
  const diagnostic = guidedProjectTransaction?.accepted === false
    ? guidedProjectTransaction.errors?.[0]
    : null;

  return `
    <div class="dimensions-workspace dimensions-workspace--immersive">
      <p class="dimension-mode-intro">Select a project dimension to edit it. Only the audited shelf clearance changes the visible model; every other value is saved for design review.</p>
      ${control ? `
        <section class="smart-dimension-control" data-smart-dimension-control="${escapeAttribute(control.id)}">
          <div class="smart-dimension-heading">
            <span>
              <strong>${escapeHtml(control.label)}</strong>
              <small>${escapeHtml(selectedLayout?.label || registry.label)} · Preview control</small>
            </span>
            <span class="authority-badge authority-badge--proven">Proven</span>
          </div>
          <label class="smart-dimension-field" for="smart-dimension-${escapeAttribute(control.id)}">
            <span>Clearance</span>
            <span class="smart-dimension-input-wrap">
              <input
                id="smart-dimension-${escapeAttribute(control.id)}"
                type="number"
                inputmode="decimal"
                data-smart-dimension="${escapeAttribute(control.id)}"
                min="${millimetersToInches(control.minMillimeters).toFixed(2)}"
                max="${millimetersToInches(control.maxMillimeters).toFixed(2)}"
                step="any"
                value="${millimetersToInches(smartValue).toFixed(2)}"
                aria-describedby="smart-dimension-range-${escapeAttribute(control.id)} smart-dimension-disclaimer"
              >
              <span>in</span>
            </span>
          </label>
          <small class="smart-dimension-error" data-smart-dimension-error role="alert" hidden>Enter a value within the displayed range.</small>
          <div class="smart-dimension-range" id="smart-dimension-range-${escapeAttribute(control.id)}">
            <span>${millimetersToInches(control.minMillimeters).toFixed(2)} in</span>
            <span>Native ${millimetersToInches(control.nativeMillimeters).toFixed(2)} in</span>
            <span>${millimetersToInches(control.maxMillimeters).toFixed(2)} in</span>
          </div>
          <button class="smart-dimension-reset" type="button" data-smart-dimension-reset="${escapeAttribute(control.id)}">
            <i data-icon="reset" aria-hidden="true"></i> Reset to native
          </button>
          <p id="smart-dimension-disclaimer">Preview only — final dimensions require design confirmation.</p>
        </section>
      ` : ""}
      <section class="room-measurements room-measurements--contextual" data-room-measurements aria-labelledby="room-measurements-title">
        <header class="room-measurements-heading">
          <span><strong id="room-measurements-title">Project dimensions</strong><small>Saved independently for ${escapeHtml(selectedLayout?.label || "this layout")}</small></span>
        </header>
        ${selectedField ? `
          <div class="dimension-context-popover" data-dimension-context="${escapeAttribute(selectedField.id)}">
            <button class="dimension-context-back" type="button" data-dimension-list>
              <i data-icon="chevron-left" aria-hidden="true"></i> All dimensions
            </button>
            <div class="dimension-authority-line">
              <strong>${escapeHtml(selectedField.label)}</strong>
              <span class="authority-badge authority-badge--review">Review only</span>
            </div>
            <p>This value is recorded for design review and does not deform the verified model.</p>
            ${renderMeasurementField(selectedField, selectedWarning, false)}
            <p class="measurement-format-hint">Use inches. Decimals and common fractions such as 42 1/2 are accepted.</p>
          </div>
        ` : `
          <div class="dimension-inventory" data-dimension-inventory role="list" aria-label="Project dimensions">
            ${fields.map((field) => `
              <button type="button" role="listitem" data-dimension-field="${escapeAttribute(field.id)}">
                <span><strong>${escapeHtml(field.label)}</strong><small>${escapeHtml(field.group)}</small></span>
                <span>Review only <i data-icon="chevron-right" aria-hidden="true"></i></span>
              </button>
            `).join("")}
          </div>
        `}
        <p class="measurement-error" data-measurement-error role="alert" ${validation.errors.length ? "" : "hidden"}>${validation.errors.length ? escapeHtml(validation.errors[0].message) : ""}</p>
        <p class="transaction-diagnostic" data-transaction-diagnostic role="alert" ${diagnostic ? "" : "hidden"}>${diagnostic ? escapeHtml(`Last accepted project specification preserved. ${formatGuidedDiagnostic(diagnostic)}`) : ""}</p>
      </section>
      <details class="automatic-engineering-note">
        <summary>Fixed and automatic engineering allowances</summary>
        <p>Clear-maple UV cabinet interiors, standardized fillers, face frames, kicks, and construction clearances are coordinated during design review. Shelf rules use 1-inch MDF up to 27 inches, 1.25-inch MDF up to 31 inches, and 1.5-inch MDF up to 36 inches, with a 1.25-inch countertop.</p>
      </details>
    </div>
  `;
}

function selectMeasurementDiagramFields(fields, selectedLayout) {
  const fieldsById = new Map(fields.map((field) => [field.id, field]));
  return getMeasurementDiagramSpec(project.category, selectedLayout?.id)
    .spans
    .map((span) => fieldsById.get(span.fieldId))
    .filter(Boolean);
}

function renderMeasurementField(field, warning, showDiagramCode = true) {
  const value = project.measurements[field.id];
  const referenceLabels = {
    wallWidth: "Wall Width",
    ceilingHeight: "Ceiling Height",
    desiredDepth: "Desired Built-In Depth",
    leftReturn: "Left Return",
    rightReturn: "Right Return",
    windowWidth: "Window Width",
    windowHeight: "Window Height",
    sillHeight: "Sill Height",
    radiatorBelowWindow: "Radiator Below Window"
  };
  const fieldLabel = referenceLabels[field.id] || field.label;
  const control = field.id === "radiatorBelowWindow"
    ? `
      <span class="measurement-toggle" role="radiogroup" aria-labelledby="measurement-label-${field.id}">
        ${[...field.values].reverse().map((option) => `
          <label class="${option.value === value ? "is-selected" : ""}">
            <input
              id="measurement-${field.id}-${escapeAttribute(option.value)}"
              type="radio"
              name="measurement-${field.id}"
              data-measurement="${field.id}"
              value="${escapeAttribute(option.value)}"
              ${option.value === value ? "checked" : ""}
            >
            <span>${escapeHtml(option.label)}</span>
          </label>
        `).join("")}
      </span>
    `
    : field.type === "select"
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
  const measurementCode = showDiagramCode && field.code
    ? `<span class="measurement-code">${escapeHtml(field.code)}</span>`
    : "";
  const labelMarkup = field.id === "radiatorBelowWindow"
    ? `<span class="measurement-field-label" id="measurement-label-${field.id}">${measurementCode}<span>${escapeHtml(fieldLabel)}</span></span>`
    : `<label class="measurement-field-label" for="measurement-${field.id}">${measurementCode}<span>${escapeHtml(fieldLabel)}</span></label>`;

  return `
    <div class="measurement-field" data-measurement-row="${field.id}">
      ${labelMarkup}
      <span class="measurement-input-wrap">${control}</span>
      <small class="measurement-help visually-hidden" id="measurement-help-${field.id}">
        ${field.type === "inches" ? "Enter an approximate value in inches." : "Choose the closest answer."}
      </small>
      ${warning ? `<small class="measurement-warning" id="measurement-warning-${field.id}">${escapeHtml(warning.message)}</small>` : ""}
    </div>
  `;
}

function renderMeasurementDiagram(fields, selectedLayout, options = {}) {
  const diagramSpec = getMeasurementDiagramSpec(project.category, selectedLayout?.id);
  const fieldsById = new Map(
    fields
      .filter((field) => field.type === "inches")
      .map((field) => [field.id, field])
  );
  const dimensions = diagramSpec.spans
    .map((span) => ({ span, field: fieldsById.get(span.fieldId) }))
    .filter(({ field }) => Boolean(field));
  const roomVisual = renderOptimizedPicture(
    selectedLayout?.previewAsset || getLayout(project.category, "clear-wall")?.previewAsset,
    {
      pictureClass: "measurement-room-image",
      imageClass: "measurement-room-image",
      deferredFallback: options.staticGuidance !== true
    }
  );
  const syntheticFeature = (
    selectedLayout?.id === "clear-wall"
    && ["tv", "window", "radiator"].includes(diagramSpec.feature)
  ) ? '<span class="measurement-feature" aria-hidden="true"></span>' : "";

  return `
    <figure
      class="measurement-diagram-card"
      data-media-fit="${escapeAttribute(diagramSpec.mediaFit)}"
      data-media-aspect-ratio="${escapeAttribute(diagramSpec.mediaAspectRatio)}"
      data-media-position="${escapeAttribute(diagramSpec.mediaObjectPosition)}"
      style="--measurement-media-aspect-ratio:${escapeAttribute(diagramSpec.mediaAspectRatio)};--measurement-media-position:${escapeAttribute(diagramSpec.mediaObjectPosition)}"
      aria-label="Measurement diagram for ${escapeAttribute(selectedLayout?.label || "selected layout")}"
    >
      <div
        class="measurement-room measurement-room--photo${options.staticGuidance ? " measurement-room--static-guidance" : ""}"
        data-layout="${escapeAttribute(selectedLayout?.id || "clear-wall")}"
        data-condition="${escapeAttribute(selectedLayout?.condition || "clear-wall")}"
        data-feature="${escapeAttribute(diagramSpec.feature)}"
      >
        ${roomVisual}
        ${syntheticFeature}
        ${renderDimensionDrawing(dimensions, diagramSpec)}
        ${options.staticGuidance ? "" : `
          <div
            class="guided-3d-mount guided-3d-mount--measurements"
            data-guided-3d-mount
            data-guided-3d-mode="measurements"
            aria-label="Interactive three-dimensional room measurement preview"
          ></div>
        `}
      </div>
    </figure>
  `;
}

function renderDimensionDrawing(dimensions, diagramSpec) {
  return `
    <svg
      class="dimension-overlay measurement-dimension-drawing"
      data-dimension-overlay
      data-dimension-drawing
      data-dimension-count="${dimensions.length}"
      viewBox="0 0 ${diagramSpec.width} ${diagramSpec.height}"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      ${dimensions.map(({ field, span }) => {
        const [x1, y1, x2, y2] = span.line;
        const value = project.measurements[field.id];
        const displayValue = value === null || value === undefined
          ? "Add estimate"
          : `${formatInches(value)} in`;
        const annotationName = getDimensionAnnotationName(field, span);
        const labelScale = diagramSpec.width / 1000;
        const labelWidth = Math.min(
          190,
          Math.max(
            112,
            annotationName.length * 4.8 + (field.code ? 34 : 0) + 20
          )
        ) * labelScale;
        const labelHeight = 32 * labelScale;
        const labelRadius = 8 * labelScale;
        return `
          <g
            class="measurement-dimension-span"
            data-dimension-span="${escapeAttribute(field.id)}"
            data-dimension-code="${escapeAttribute(field.code || "")}"
            data-dimension-axis="${escapeAttribute(span.axis)}"
            data-dimension-priority="${escapeAttribute(span.priority)}"
            data-dimension-end-style="${escapeAttribute(span.endStyle)}"
          >
            ${span.extensions.map(([extensionX1, extensionY1, extensionX2, extensionY2], index) => `
              <line
                class="measurement-dimension-extension${span.extensionRole === "tick" ? " is-end-tick" : ""}"
                data-dimension-extension="${escapeAttribute(field.id)}"
                data-dimension-tick="${index === 0 ? "start" : "end"}"
                x1="${extensionX1}"
                y1="${extensionY1}"
                x2="${extensionX2}"
                y2="${extensionY2}"
              ></line>
            `).join("")}
            <line
              class="measurement-dimension-line"
              data-dimension-line="${escapeAttribute(field.id)}"
              x1="${x1}"
              y1="${y1}"
              x2="${x2}"
              y2="${y2}"
            ></line>
            ${span.endStyle === "arrow"
              ? renderDimensionArrowheads(span.line, diagramSpec.width)
              : ""}
            <g
              class="measurement-annotation-anchor"
              transform="translate(${span.label.x} ${span.label.y})"
            >
              <g
                class="dimension-chip measurement-annotation"
                data-dimension-chip="${escapeAttribute(field.id)}"
                data-dimension-label="${escapeAttribute(field.id)}"
                data-dimension-code="${escapeAttribute(field.code || "")}"
                data-dimension-priority="${escapeAttribute(span.priority)}"
                style="--dimension-label-font-size:${11 * labelScale}px;--dimension-value-font-size:${9.5 * labelScale}px;--dimension-shadow-y:${3 * labelScale}px;--dimension-shadow-blur:${6 * labelScale}px"
              >
                <g class="measurement-annotation-copy">
                  <rect
                    class="measurement-annotation-card"
                    x="${-labelWidth / 2}"
                    y="${-labelHeight / 2}"
                    width="${labelWidth}"
                    height="${labelHeight}"
                    rx="${labelRadius}"
                    ry="${labelRadius}"
                  ></rect>
                  <text
                    class="measurement-annotation-label"
                    text-anchor="middle"
                    x="0"
                    y="${-3 * labelScale}"
                  >
                    ${field.code ? `<tspan class="measurement-annotation-code">${escapeHtml(field.code)}</tspan>` : ""}
                    ${field.code ? `<tspan class="measurement-annotation-separator" dx="${4 * labelScale}">·</tspan>` : ""}
                    <tspan class="measurement-annotation-name"${field.code ? ` dx="${4 * labelScale}"` : ""}>${escapeHtml(annotationName)}</tspan>
                  </text>
                  <text
                    class="measurement-annotation-value"
                    data-dimension-value
                    text-anchor="middle"
                    x="0"
                    y="${13 * labelScale}"
                  >${escapeHtml(displayValue)}</text>
                </g>
              </g>
            </g>
          </g>
        `;
      }).join("")}
    </svg>
  `;
}

function getDimensionAnnotationName(field, span) {
  const referenceLabels = {
    wallWidth: "Wall width",
    ceilingHeight: "Ceiling height",
    desiredDepth: "Built-in depth",
    windowWidth: "Window width",
    windowHeight: "Window height",
    tvScreenSize: "TV diagonal",
    tvHeight: "TV height"
  };
  return span.labelOverride || referenceLabels[field.id] || field.label;
}

function renderDimensionArrowheads(line, diagramWidth) {
  const [x1, y1, x2, y2] = line;
  const deltaX = x2 - x1;
  const deltaY = y2 - y1;
  const length = Math.hypot(deltaX, deltaY);
  if (!length) return "";
  const unitX = deltaX / length;
  const unitY = deltaY / length;
  const normalX = -unitY;
  const normalY = unitX;
  const arrowScale = diagramWidth / 1000;
  const arrowLength = 9 * arrowScale;
  const arrowHalfWidth = 4.25 * arrowScale;
  const startBaseX = x1 + unitX * arrowLength;
  const startBaseY = y1 + unitY * arrowLength;
  const endBaseX = x2 - unitX * arrowLength;
  const endBaseY = y2 - unitY * arrowLength;
  const arrowPath = (tipX, tipY, baseX, baseY) => (
    `M${tipX} ${tipY}`
    + `L${baseX + normalX * arrowHalfWidth} ${baseY + normalY * arrowHalfWidth}`
    + `L${baseX - normalX * arrowHalfWidth} ${baseY - normalY * arrowHalfWidth}Z`
  );
  return `
    <path
      class="measurement-dimension-arrow"
      data-dimension-end="start"
      d="${arrowPath(x1, y1, startBaseX, startBaseY)}"
    ></path>
    <path
      class="measurement-dimension-arrow"
      data-dimension-end="end"
      d="${arrowPath(x2, y2, endBaseX, endBaseY)}"
    ></path>
  `;
}

function renderCustomizationStep() {
  const registry = getImmersiveLayout(project.layout);
  const mode = getActiveCustomizationMode();
  return `
    <div class="immersive-configurator immersive-configurator--viewer-first" data-immersive-configurator data-layout-id="${escapeAttribute(project.layout)}" data-customization-mode="${escapeAttribute(mode)}">
      <section class="immersive-viewer-surface" aria-label="Interactive ${escapeAttribute(registry?.label || "layout")} model">
        <div class="immersive-viewer-meta">
          <span class="immersive-layout-mark">${escapeHtml(registry?.roomId?.toUpperCase() || "JQ")}</span>
          <span><small>Selected layout</small><strong>${escapeHtml(registry?.label || "Layout")}</strong></span>
        </div>
        ${renderCustomizationModes()}
        <div class="immersive-viewer-stage">
          <div class="guided-3d-mount guided-3d-mount--immersive" data-guided-3d-mount data-guided-3d-mode="immersive-layout" aria-label="Interactive three-dimensional ${escapeAttribute(registry?.label || "layout")}"></div>
        </div>
        <div class="immersive-engine-status" data-guided-engine-status role="status" aria-live="polite" tabindex="-1">
          <span><strong data-guided-engine-title>Loading ${escapeHtml(registry?.label || "selected layout")}</strong><small data-guided-engine-copy>The exact registered model is being verified.</small></span>
          <button type="button" data-guided-engine-retry hidden>Retry viewer</button>
        </div>
        ${mode === "dimensions" && !activeDimensionFieldId
          ? renderDimensionModeHint()
          : mode === "view" ? "" : renderCustomizationOverlay(mode, registry)}
        <div class="immersive-viewer-footer">
          <button class="guided-button guided-button-secondary immersive-back-action" type="button" data-back>
            <i data-icon="chevron-left" aria-hidden="true"></i> Back
          </button>
          <div class="immersive-view-toolbar" aria-label="Model view controls">
            <div class="immersive-named-views" role="group" aria-label="Named views">
              ${["front", "left", "right"].map((view) => {
                const selected = activeNamedView === view;
                return `<button type="button" data-viewer-view="${view}" class="${selected ? "is-active" : ""}" aria-pressed="${selected}">${view[0].toUpperCase()}${view.slice(1)}</button>`;
              }).join("")}
            </div>
            <div class="immersive-camera-actions" role="group" aria-label="Camera controls">
              <button type="button" data-viewer-command="out" aria-label="Zoom out"><i data-icon="zoom-out" aria-hidden="true"></i></button>
              <button type="button" data-viewer-command="in" aria-label="Zoom in"><i data-icon="zoom-in" aria-hidden="true"></i></button>
              <button type="button" data-viewer-command="fit" aria-label="Fit model"><i data-icon="fullscreen" aria-hidden="true"></i><span>Fit</span></button>
              <button type="button" data-viewer-command="reset" aria-label="Reset view"><i data-icon="reset" aria-hidden="true"></i><span>Reset</span></button>
            </div>
          </div>
          <button class="guided-button guided-button-primary immersive-review-action" type="button" data-continue>
            Review &amp; Details <i data-icon="arrow-right" aria-hidden="true"></i>
          </button>
        </div>
      </section>
    </div>
  `;
}

function getActiveCustomizationMode() {
  if (activeCustomizationTab === "details") return "options";
  return ["view", "dimensions", "finish", "options"].includes(activeCustomizationTab)
    ? activeCustomizationTab
    : "view";
}

function renderCustomizationModes() {
  const mode = getActiveCustomizationMode();
  const panelOpen = mode !== "view" && !(mode === "dimensions" && !activeDimensionFieldId);
  const modes = [
    { id: "view", label: "View" },
    { id: "dimensions", label: "Dimensions" },
    { id: "finish", label: "Finish" },
    { id: "options", label: "Options" }
  ];
  return `
    <div class="immersive-mode-selector" role="group" aria-label="Customization mode">
      ${modes.map((item) => `
        <button
          class="immersive-mode-button${mode === item.id ? " is-active" : ""}"
          type="button"
          data-customization-mode-control="${item.id}"
          aria-pressed="${mode === item.id}"
          ${!panelOpen || item.id === "view" ? "" : `aria-controls="customization-mode-panel"`}
        >${escapeHtml(item.label)}</button>
      `).join("")}
    </div>
  `;
}

function renderDimensionModeHint() {
  return `
    <div class="immersive-dimension-hint" role="status">
      <span>Select the on-model shelf-clearance control to edit it.</span>
      <button type="button" data-dimension-inventory-open>Project dimensions</button>
    </div>
  `;
}

function renderCustomizationOverlay(mode, registry) {
  const title = { dimensions: "Dimensions", finish: "Finish", options: "Options" }[mode];
  return `
    <aside
      class="immersive-mode-panel immersive-mode-panel--${escapeAttribute(mode)}"
      id="customization-mode-panel"
      data-customization-mode-panel="${escapeAttribute(mode)}"
      aria-labelledby="customization-mode-title"
    >
      <header class="immersive-mode-panel-header">
        <span><small>${escapeHtml(registry?.label || "Layout")}</small><strong id="customization-mode-title">${escapeHtml(title)}</strong></span>
        <button type="button" data-customization-mode-close aria-label="Close ${escapeAttribute(title)}"><i data-icon="close" aria-hidden="true"></i></button>
      </header>
      <div class="immersive-mode-panel-content">
        ${mode === "dimensions" ? renderDimensionsChoices() : mode === "finish" ? renderFinishChoices() : renderDetailChoices()}
      </div>
      <p class="immersive-preview-disclaimer">Digital preview only. Final dimensions and finishes require design confirmation.</p>
    </aside>
  `;
}

function renderFinishChoices() {
  const appearance = getImmersiveLayout(project.layout)?.appearanceManifest;
  const canPreviewFinish = (appearance?.provenMeshIndices?.length || 0) > 0;
  const referencePaintFinishes = ["shop-primed", "warm-white", "soft-ivory", "sage-gray", "charcoal"]
    .map((finishId) => FINISH_OPTIONS.paint.find((finish) => finish.id === finishId))
    .filter(Boolean);
  return `
    <h3 class="customization-group-heading">Finish</h3>
    ${renderDeferredModelDisclosure("Finish")}
    ${renderFinishGroup("White Oak and walnut", "wood", FINISH_OPTIONS.wood)}
    ${renderFinishGroup("Shop-primed and cabinet paint", "paint", referencePaintFinishes)}
    <p class="finish-design-note">Final Sherwin-Williams cabinet-grade color and code are confirmed during design review.${canPreviewFinish ? " The on-screen Fireplace finish is a provisional digital preview." : " This layout keeps its embedded model materials on screen."}</p>
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
            data-project-field="${key === "accentFinish" ? "accentFinish" : "finish"}"
            data-finish="${finish.id}"
            data-family="${finish.family}"
            aria-pressed="${selectedId === finish.id}"
            aria-describedby="finish-mapping-status"
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

function renderDetailChoices({ compact = false } = {}) {
  const compatible = getCompatibleDetails(project.category, project.style);
  const groups = [
    { key: "doorStyle", label: "Door style", options: compatible.doorStyle },
    { key: "hardware", label: "Hardware", options: compatible.hardware },
    { key: "lighting", label: "Lighting", options: compatible.lighting },
    { key: "baseStyle", label: "Installation", options: compatible.baseStyle, expanded: true },
    { key: "topTreatment", label: "Top treatment", options: compatible.topTreatment }
  ]
    .map((group) => ({
      ...group,
      options: compact && group.key === "hardware"
        ? group.options.filter((option) => option.id !== "none")
        : group.options
    }))
    .filter((group) => group.options.length && (!compact || ["hardware", "lighting"].includes(group.key)));

  if (!groups.length) {
    return `<p class="guided-dialog-note">This concept has no additional details to choose. Our design team will finish the construction details with you.</p>`;
  }

  return `
    <h3 class="customization-group-heading">Details</h3>
    ${renderDeferredModelDisclosure("Details, hardware, and lighting")}
    ${groups.map((group) => `
      <section class="choice-section choice-section--${escapeAttribute(group.key)}">
        <h3>${escapeHtml(group.label)}</h3>
        <div class="detail-choice-grid detail-choice-grid--${escapeAttribute(group.key)}${group.expanded ? " detail-choice-grid--expanded" : ""}">
          ${group.options.map((option) => {
            const selected = project[group.key] === option.id;
            const hardwareIcon = option.id === "knob"
              ? "hardware-knob"
              : option.id === "none"
              ? "minus"
              : "handle-pull";
            return `
              <button
                class="detail-choice${selected ? " is-selected" : ""}"
                type="button"
                data-detail-key="${group.key}"
                data-detail="${option.id}"
                aria-pressed="${selected}"
                style="--detail-color:${escapeAttribute(option.color || "#262626")}"
              >
                ${group.key === "hardware" ? `
                  <span class="detail-option-icon detail-option-icon--${escapeAttribute(option.id)}" aria-hidden="true">
                    <i data-icon="${hardwareIcon}" aria-hidden="true"></i>
                  </span>
                ` : ""}
                <span class="detail-choice-copy">
                  <span class="detail-choice-title">${escapeHtml(option.shortLabel || option.label)}</span>
                  ${option.description ? `<span class="detail-choice-description">${escapeHtml(option.description)}</span>` : ""}
                </span>
              </button>
            `;
          }).join("")}
        </div>
      </section>
    `).join("")}
  `;
}

function renderDeferredModelDisclosure(groupLabel) {
  const isFinish = groupLabel === "Finish";
  const appearance = getImmersiveLayout(project.layout)?.appearanceManifest;
  const finishMappingAvailable = (appearance?.provenMeshIndices?.length || 0) > 0;
  return `
    <aside class="fixed-reference-disclosure" role="note" data-deferred-model-disclosure="${escapeAttribute(groupLabel.toLowerCase())}" ${isFinish ? 'id="finish-mapping-status"' : ""}>
      <i data-icon="information" aria-hidden="true"></i>
      <span>${isFinish
        ? finishMappingAvailable
          ? `<strong>The selected Finish is previewed only on audited millwork surfaces.</strong> This provisional digital appearance is not a calibrated or approved physical sample.`
          : `<strong>Your Finish selection is saved for design review.</strong> This layout retains its embedded source materials because runtime finish mapping is not audited.`
        : `<strong>Your ${escapeHtml(groupLabel.toLowerCase())} selections are saved with this project.</strong> Only the proven shelf-clearance control changes preview geometry; other selections require design confirmation.`}</span>
    </aside>
  `;
}

function renderConceptPreview(options = {}) {
  const category = getCategory(project.category);
  const layout = getLayout(project.category, project.layout);
  const registry = getImmersiveLayout(project.layout);
  const selectedStyle = getStyle(project.category, project.style);
  const selectedProduct = getProductChoiceForSelection(category.id, selectedStyle.id);
  const previewLabel = selectedProduct?.label || selectedStyle.label;

  return `
    <figure
      class="concept-preview"
      data-category="${escapeAttribute(category.id)}"
      data-layout="${escapeAttribute(layout?.id || "unselected")}"
      data-style="${escapeAttribute(selectedStyle.id)}"
      data-preview-render-mode="immersive-layout-glb"
      data-model-asset="${escapeAttribute(registry?.runtimeAsset?.path || "")}"
      data-finish-mask-mode="${registry?.appearanceManifest?.provenMeshIndices?.length ? "audited-allowlist-only" : "embedded-source-only"}"
      data-project-specification-accepted="${acceptedSpecification?.accepted === true}"
      data-geometry-fingerprint="${escapeAttribute(registry?.authoritativeSource?.sourceContractFingerprint || registry?.authoritativeSource?.geometryFingerprint || "")}"
      aria-label="${escapeAttribute(`Interactive reference model for ${previewLabel} and ${layout?.label || "selected layout"}`)}"
    >
      <div class="concept-preview-meta">
        <div class="fixed-reference-heading">
          <span class="fixed-reference-mark" aria-hidden="true">${escapeHtml(registry?.roomId?.toUpperCase() || "JQ")}</span>
          <span>
            <small>Verified authoritative layout preview</small>
            <strong>${escapeHtml(registry?.label || "Selected layout")}</strong>
          </span>
        </div>
        ${renderConceptLayoutContext(layout, "layout-review-reference")}
      </div>
      <div class="concept-scene-frame">
        <div class="concept-scene" data-concept-scene>
          <div class="guided-engine-status" data-guided-engine-status role="status" aria-live="polite">
            <strong data-guided-engine-title>Loading ${escapeHtml(registry?.label || "selected layout")}</strong>
            <span data-guided-engine-copy>The exact authoritative GLB is being verified and parsed. No substitute model or image will be used.</span>
          </div>
          <div
            class="guided-3d-mount guided-3d-mount--concept"
            data-guided-3d-mount
            data-guided-3d-mode="layout-review-reference"
            aria-label="${escapeAttribute(`Interactive reference model for ${previewLabel} and ${layout?.label || "selected layout"}`)}"
          ></div>
        </div>
        ${renderPreviewControls()}
      </div>
      <figcaption class="fixed-reference-model-disclosure" data-fixed-reference-model-disclosure>
        <strong>Digital preview only. Final dimensions and finishes require design confirmation.</strong>
        <span>${registry?.appearanceManifest?.provenMeshIndices?.length
          ? "The selected Finish is previewed only on audited millwork zones."
          : "Embedded source materials are preserved because automatic finish mapping is not yet proven for this model."} The proven shelf-clearance control affects preview geometry only.</span>
      </figcaption>
    </figure>
  `;
}

function renderConceptLayoutContext(layout, mode = "layout-review-reference") {
  if (!layout) return "";
  return `
    <div
      class="concept-layout-context"
      data-layout-context="${escapeAttribute(layout.id)}"
      data-layout-context-mode="${escapeAttribute(mode)}"
      role="note"
      aria-label="${escapeAttribute(`Selected layout: ${layout.label}`)}"
    >
      <span class="concept-layout-context-copy">
        <small>Selected layout</small>
        <strong>${escapeHtml(layout.label)}</strong>
      </span>
    </div>
  `;
}

function renderPreviewControls() {
  return `
    <div class="preview-controls" aria-label="Preview controls">
      <button class="preview-control" type="button" data-preview-zoom="out" aria-label="Zoom out"><i data-icon="zoom-out" aria-hidden="true"></i></button>
      <button class="preview-control" type="button" data-preview-zoom="in" aria-label="Zoom in"><i data-icon="zoom-in" aria-hidden="true"></i></button>
      <button class="preview-control" type="button" data-preview-zoom="reset" aria-label="Reset preview"><i data-icon="reset" aria-hidden="true"></i></button>
    </div>
  `;
}

function renderReviewStep() {
  const summary = buildProjectSummary(project, { acceptedSpecification });
  const rowsByKey = new Map(summary.map((row) => [row.key, row]));
  const dimensionKeys = [
    ...getMeasurementFields(project.category, project.layout).map((field) => field.id),
    ...summary.filter((row) => row.key.startsWith("smartDimension:")).map((row) => row.key)
  ];
  const customerKeys = summary.filter((row) => row.key.startsWith("customer:")).map((row) => row.key);
  const rowsFor = (keys) => keys.map((key) => rowsByKey.get(key)).filter(Boolean);
  const summaryLabels = {
    wallWidth: "Wall Width",
    ceilingHeight: "Height",
    desiredDepth: "Depth"
  };
  const renderRows = (rows) => `
    <dl class="summary-list">
      ${rows.map((row) => `
        <div class="summary-row">
          <dt>${escapeHtml(summaryLabels[row.key] || row.label)}</dt>
          <dd><span data-summary-value="${escapeAttribute(row.key)}">${escapeHtml(row.value)}</span></dd>
        </div>
      `).join("")}
    </dl>
  `;
  const renderSection = (title, rows, edit = null) => rows.length ? `
    <section class="review-summary-section" data-review-section="${escapeAttribute(edit?.section || title.toLowerCase().replaceAll(" ", "-"))}">
      <header>
        <h3>${escapeHtml(title)}</h3>
        ${edit ? `
          <button
            class="review-edit-link"
            type="button"
            ${edit.step ? `data-edit-step="${edit.step}"` : `data-edit-section="${escapeAttribute(edit.section)}"`}
          >${escapeHtml(edit.label || "Edit")}</button>
        ` : ""}
      </header>
      ${renderRows(rows)}
    </section>
  ` : "";
  return `
    <div class="review-layout">
      <div class="project-summary-column">
        <section class="project-summary-card" aria-labelledby="project-summary-title">
          <header class="summary-heading">
            <h2 id="project-summary-title">Project Summary</h2>
            <button class="guided-icon-button" type="button" data-edit-review aria-label="Edit project notes">
              <i data-icon="edit" aria-hidden="true"></i>
            </button>
          </header>
          ${renderSection("Project details", rowsFor(["projectName", ...customerKeys]))}
          ${renderSection("Product", rowsFor(["product", "category"]), { step: 1, label: "Change product" })}
          ${renderSection("Layout", rowsFor(["layout"]), { step: 2, label: "Change layout" })}
          ${renderSection("Dimensions", rowsFor(dimensionKeys), { section: "dimensions" })}
          ${renderSection("Finish", rowsFor(["finish", "accentFinish"]), { section: "finish" })}
          ${renderSection("Details", rowsFor(["doorStyle", "hardware", "lighting", "baseStyle", "topTreatment"]), { section: "details" })}
          ${renderSection("Validation notes", rowsFor(["warnings"]))}
          ${renderSection("Notes", rowsFor(["notes"]))}
        </section>
        <div class="summary-actions">
          <button class="guided-button guided-button-primary" type="button" data-open-quote>
            Request a Quote <i data-icon="arrow-right" aria-hidden="true"></i>
          </button>
          <button class="guided-button guided-button-secondary" type="button" data-save-project>
            Save Project <i data-icon="bookmark" aria-hidden="true"></i>
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

function syncLayoutThumbnailStates() {
  for (const image of app?.querySelectorAll?.("[data-layout-thumbnail]") || []) {
    if (!image.complete) continue;
    setLayoutThumbnailState(image, image.naturalWidth > 0 ? "ready" : "error");
  }
}

function setLayoutThumbnailState(image, state) {
  const card = image?.closest?.(".layout-card");
  if (!card || !["ready", "error"].includes(state)) return;
  card.dataset.thumbnailState = state;
  image.hidden = state === "error";
  const baseLabel = card.dataset.baseLabel || card.getAttribute("aria-label") || "Layout";
  card.setAttribute("aria-label", state === "error" ? `${baseLabel}, preview image unavailable` : baseLabel);
}

function bindAppEvents() {
  app.addEventListener("load", (event) => {
    if (event.target.matches?.("[data-layout-thumbnail]")) setLayoutThumbnailState(event.target, "ready");
  }, true);
  app.addEventListener("error", (event) => {
    if (event.target.matches?.("[data-layout-thumbnail]")) setLayoutThumbnailState(event.target, "error");
  }, true);
  app.addEventListener("click", (event) => {
    const target = event.target.closest("button, a");
    if (!target) {
      const clickedViewer = event.target.closest?.(".immersive-viewer-surface");
      const clickedPanel = event.target.closest?.("[data-customization-mode-panel]");
      const clickedSelector = event.target.closest?.(".immersive-mode-selector");
      if (clickedViewer && !clickedPanel && !clickedSelector && getActiveCustomizationMode() !== "view") {
        closeCustomizationMode();
      }
      return;
    }

    if (target.matches("[data-step]")) {
      navigateToStep(Number(target.dataset.step));
      return;
    }
    if (target.matches("[data-product-choice]")) {
      selectProductChoice(target.dataset.productChoice);
      return;
    }
    if (target.matches("[data-unavailable-product-choice]")) {
      showToast(`${target.getAttribute("aria-label")?.replace(/, not available yet$/i, "") || "This product"} is not available yet.`);
      return;
    }
    if (target.matches("[data-layout]")) {
      const layoutId = target.dataset.layout;
      selectLayout(layoutId);
      requestAnimationFrame(() => app.querySelector(`[data-layout="${CSS.escape(layoutId)}"]`)?.focus());
      return;
    }
    if (target.matches("[data-guided-engine-retry]")) {
      retryGuidedScene();
      return;
    }
    if (target.matches("[data-viewer-view]")) {
      if (guidedSceneController?.setView?.(target.dataset.viewerView)) {
        setNamedViewButtonState(target.dataset.viewerView);
      }
      return;
    }
    if (target.matches("[data-viewer-command]")) {
      setNamedViewButtonState();
      guidedSceneController?.zoom?.(target.dataset.viewerCommand);
      return;
    }
    if (target.matches("[data-smart-dimension-reset]")) {
      guidedSceneController?.resetSmartDimension?.();
      return;
    }
    if (target.matches("[data-customization-mode-control]")) {
      setCustomizationMode(target.dataset.customizationModeControl, target);
      return;
    }
    if (target.matches("[data-customization-mode-close]")) {
      closeCustomizationMode();
      return;
    }
    if (target.matches("[data-dimension-field]")) {
      activeDimensionFieldId = target.dataset.dimensionField;
      renderApp();
      requestAnimationFrame(() => app.querySelector("[data-dimension-context] input, [data-dimension-context] select")?.focus());
      return;
    }
    if (target.matches("[data-dimension-inventory-open]")) {
      activeDimensionFieldId = "__inventory";
      renderApp();
      requestAnimationFrame(() => app.querySelector("[data-dimension-inventory] button")?.focus());
      return;
    }
    if (target.matches("[data-dimension-list]")) {
      activeDimensionFieldId = "__inventory";
      renderApp();
      requestAnimationFrame(() => app.querySelector("[data-dimension-inventory] button")?.focus());
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
    if (target.matches("[data-finish]")) {
      const key = target.dataset.finishKey === "accentFinish" ? "accentFinish" : "finish";
      const finishId = target.dataset.finish;
      updateProject({ [key]: finishId });
      renderApp();
      requestAnimationFrame(() => app.querySelector(`[data-project-field="${CSS.escape(key)}"][data-finish="${CSS.escape(finishId)}"]`)?.focus());
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
    if (target.matches("[data-edit-review]")) {
      openReviewEditDialog();
      return;
    }
    if (target.matches("[data-edit-step]")) {
      navigateToStep(Number(target.dataset.editStep));
      return;
    }
    if (target.matches("[data-edit-section]")) {
      activeCustomizationTab = target.dataset.editSection === "details"
        ? "options"
        : target.dataset.editSection;
      navigateToStep(3);
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
    if (event.target.matches("[data-smart-dimension]")) {
      updateSmartDimensionFromControl(event.target);
      return;
    }
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
    if (event.target.matches("[data-smart-dimension]")) {
      updateSmartDimensionFromControl(event.target, { finalize: true });
      return;
    }
    if (event.target.matches("[data-measurement]")) updateMeasurementFromControl(event.target, { finalize: true });
  });

  app.addEventListener("keydown", (event) => {
    if (
      event.target.matches?.("[data-layout-viewer] canvas")
      && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "=", "-", "_", "Home", "0"].includes(event.key)
    ) {
      setNamedViewButtonState();
    }
    const card = event.target.closest?.("[data-product-choice], [data-layout]");
    if (card && ["Enter", " ", "Spacebar"].includes(event.key)) {
      event.preventDefault();
      card.click();
      return;
    }

    if (event.key === "Escape" && getActiveCustomizationMode() !== "view") {
      event.preventDefault();
      closeCustomizationMode();
      return;
    }
    const tab = event.target.closest("[data-customization-mode-control]");
    if (!tab || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const tabs = [...app.querySelectorAll("[data-customization-mode-control]")];
    const currentIndex = tabs.indexOf(tab);
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    tabs[nextIndex].click();
  });

  app.addEventListener("pointerdown", (event) => {
    if (event.target.closest?.("[data-layout-viewer] canvas")) setNamedViewButtonState();
  }, true);
  app.addEventListener("wheel", (event) => {
    if (event.target.closest?.("[data-layout-viewer] canvas")) setNamedViewButtonState();
  }, { capture: true, passive: true });
}

function setNamedViewButtonState(activeView = "") {
  activeNamedView = activeView;
  for (const button of app?.querySelectorAll?.("[data-viewer-view]") || []) {
    const selected = button.dataset.viewerView === activeView;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-pressed", String(selected));
  }
}

function setCustomizationMode(mode, trigger = null) {
  const nextMode = mode === "details" ? "options" : mode;
  if (!["view", "dimensions", "finish", "options"].includes(nextMode)) return;
  if (nextMode !== "view" && trigger) customizationModeFocusReturn = trigger;
  activeCustomizationTab = nextMode;
  if (nextMode !== "dimensions") activeDimensionFieldId = "";
  renderApp();
  requestAnimationFrame(() => {
    app.querySelector(`[data-customization-mode-control="${CSS.escape(nextMode)}"]`)?.focus({ preventScroll: true });
  });
}

function closeCustomizationMode() {
  const focusReturn = customizationModeFocusReturn;
  activeCustomizationTab = "view";
  activeDimensionFieldId = "";
  customizationModeFocusReturn = null;
  renderApp();
  requestAnimationFrame(() => {
    const key = focusReturn?.dataset?.customizationModeControl
      || (focusReturn?.dataset?.dimensionHandle ? "dimensions" : "view");
    app.querySelector(`[data-customization-mode-control="${CSS.escape(key)}"]`)?.focus({ preventScroll: true });
  });
}

function selectProductChoice(productId) {
  const choice = getProductChoice(productId);
  if (!choice || !isPublicConfiguratorProduct(choice.categoryId, choice.styleId)) return;
  if (
    project.productSelected
    && project.category === choice.categoryId
    && project.style === choice.styleId
  ) {
    requestAnimationFrame(() => app.querySelector(`[data-product-choice="${CSS.escape(choice.id)}"]`)?.focus());
    return;
  }
  const category = getCategory(choice.categoryId);
  const selectedStyle = getStyle(category.id, choice.styleId);
  const constructionDefaults = category.id === "bookcase"
    ? BOOKCASE_CONFIGURATION_DEFAULTS[selectedStyle.id] || {}
    : {};
  const preserveProjectIdentity = project.productAvailability !== "unavailable";
  const base = createProject({
    category: category.id,
    productSelected: true,
    projectId: preserveProjectIdentity ? project.projectId : undefined,
    projectName: preserveProjectIdentity ? project.projectName : undefined
  });
  project = normalizeProject({
    ...base,
    createdAt: preserveProjectIdentity ? project.createdAt : base.createdAt,
    productSelected: true,
    style: selectedStyle.id,
    ...constructionDefaults,
    layout: choice.id === "window-storage" ? "window-wall" : null,
    currentStep: 1,
    maxVisitedStep: 1,
    updatedAt: new Date().toISOString()
  });
  activeCustomizationTab = "view";
  activeDimensionFieldId = "";
  previewScale = 1;
  renderApp();
  requestAnimationFrame(() => app.querySelector(`[data-product-choice="${CSS.escape(choice.id)}"]`)?.focus());
  showToast(preserveProjectIdentity
    ? `${choice.label} selected.`
    : `${choice.label} started as a new preview; your unavailable saved project was kept.`);
}

function selectLayout(layoutId) {
  if (!isActivePublicProject()) return;
  if (!isPublicConfiguratorLayout(project.category, project.style, layoutId)) return;
  const compatibility = resolveProductLayoutCompatibility({
    project: { ...project, layout: layoutId },
    topology: { layoutId }
  });
  if (compatibility.status === "unavailable") return;
  if (layoutId !== project.layout) {
    activeNamedView = "";
    activeDimensionFieldId = "";
  }
  const layoutStates = JSON.parse(JSON.stringify(project.layoutStates || {}));
  if (project.layout && layoutStates[project.layout]) {
    layoutStates[project.layout].measurements = { ...project.measurements };
  }
  const nextMeasurements = prepareMeasurementsForLayout({ ...project, layoutStates }, layoutId);
  layoutStates[layoutId] = {
    ...(layoutStates[layoutId] || {}),
    measurements: nextMeasurements
  };
  project = normalizeProject({
    ...project,
    layoutStates,
    layout: layoutId,
    measurements: nextMeasurements,
    updatedAt: new Date().toISOString()
  });
  renderApp();
}

function continueFromStep() {
  if (project.currentStep === 1 && !isActivePublicProject()) {
    showToast("Choose Cabinets + Shelves or Window Storage to continue.");
    return;
  }
  if (project.currentStep === 2 && !project.layout) {
    showToast("Please choose the layout that best matches your space.");
    return;
  }
  if (project.currentStep === 2 && !isActivePublicLayout()) {
    const labels = getPublicConfiguratorLayoutChoices(project.category, project.style).map(({ label }) => label);
    showToast(`Choose ${labels.join(labels.length > 1 ? ", " : "")} to continue.`);
    return;
  }
  if (project.currentStep === 3) {
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
    const transaction = syncAcceptedSpecification();
    if (!transaction.accepted) {
      const diagnostic = transaction.errors[0] || {
        code: "CONFIGURATION_NOT_ACCEPTED",
        message: "These measurements do not yet resolve to a safe fitted configuration."
      };
      const message = app.querySelector("[data-measurement-error]");
      if (message) {
        message.hidden = false;
        message.textContent = formatGuidedDiagnostic(diagnostic);
      }
      showToast(formatGuidedDiagnostic(diagnostic));
      return;
    }
  }
  navigateToStep(Math.min(4, project.currentStep + 1));
}

function navigateToStep(step, options = {}) {
  const targetStep = Math.min(4, Math.max(1, Number(step) || 1));
  if (targetStep > project.maxVisitedStep + 1) return;
  if (targetStep > 1 && !isActivePublicProject()) {
    project.currentStep = 1;
    project.maxVisitedStep = 1;
    showToast(project.productAvailability === "unavailable"
      ? "That saved product is not available in this preview. Its record remains in My Projects."
      : "Choose an available product before moving on.");
    renderApp({ focusHeading: true });
    return;
  }
  if (targetStep > 2 && !isActivePublicLayout()) {
    project.currentStep = 2;
    project.maxVisitedStep = Math.min(2, project.maxVisitedStep);
    showToast(project.layoutAvailability === "unavailable"
      ? "That saved layout is retained but is not available for the selected product."
      : "Choose an interactive layout before moving to Customization.");
    renderApp({ focusHeading: true });
    return;
  }
  if (targetStep > 3 && !validateMeasurements(project).valid) {
    project.currentStep = 3;
    showToast("Add the three basic room measurements before continuing.");
    renderApp({ focusHeading: true });
    return;
  }
  if (targetStep > 3 && !syncAcceptedSpecification().accepted) {
    project.currentStep = 3;
    const diagnostic = guidedProjectTransaction?.errors?.[0];
    showToast(diagnostic ? formatGuidedDiagnostic(diagnostic) : "The fitted configuration needs review before continuing.");
    renderApp({ focusHeading: true });
    return;
  }

  project.currentStep = targetStep;
  project.maxVisitedStep = Math.max(project.maxVisitedStep, targetStep);
  project.updatedAt = new Date().toISOString();
  previewScale = 1;
  if (targetStep !== 3 && customizationMobileQuery.matches && customizationSheetState === "expanded") {
    customizationSheetState = "half";
  }
  hideToast();
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
  if (project.layout && project.layoutStates?.[project.layout]) {
    project.layoutStates[project.layout].measurements = { ...project.measurements };
  }
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

  syncMeasurementWarnings();

  if (control.type === "radio") {
    row?.querySelectorAll(".measurement-toggle label").forEach((label) => {
      label.classList.toggle("is-selected", Boolean(label.querySelector("input")?.checked));
    });
  }

  const errorBox = app.querySelector("[data-measurement-error]");
  if (errorBox && validateMeasurements(project).valid) errorBox.hidden = true;
  if (options.finalize && field.type === "inches" && value !== null) control.value = formatInches(value, { decimal: true });
  scheduleMeasurementSceneUpdate({ immediate: options.finalize });
}

function syncMeasurementWarnings() {
  const warningsByField = new Map();
  for (const warning of validateMeasurements(project).warnings) {
    if (!warningsByField.has(warning.field)) warningsByField.set(warning.field, []);
    warningsByField.get(warning.field).push(warning.message);
  }

  app.querySelectorAll("[data-measurement-row]").forEach((row) => {
    const fieldId = row.dataset.measurementRow;
    const warningId = `measurement-warning-${fieldId}`;
    const messages = warningsByField.get(fieldId) || [];
    const controls = row.querySelectorAll("[data-measurement]");
    let warning = row.querySelector(".measurement-warning");

    if (messages.length) {
      if (!warning) {
        warning = document.createElement("small");
        warning.className = "measurement-warning";
        row.appendChild(warning);
      }
      warning.id = warningId;
      warning.textContent = messages.join(" ");
      controls.forEach((control) => {
        const describedBy = new Set(
          (control.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean)
        );
        describedBy.add(warningId);
        control.setAttribute("aria-describedby", [...describedBy].join(" "));
      });
      return;
    }

    warning?.remove();
    controls.forEach((control) => {
      const describedBy = (control.getAttribute("aria-describedby") || "")
        .split(/\s+/)
        .filter((id) => id && id !== warningId);
      control.setAttribute("aria-describedby", describedBy.join(" "));
    });
  });
}

function scheduleMeasurementSceneUpdate(options = {}) {
  window.clearTimeout(guidedSceneMeasurementTimer);
  const update = () => {
    guidedSceneMeasurementTimer = 0;
    app.dataset.measurementTimerOwnership = "0";
    const transaction = syncAcceptedSpecification();
    syncTransactionDiagnostic(transaction);
    syncSaveControlState();
    guidedSceneController?.update(project, getGuidedSceneOptions());
  };
  if (options.immediate) {
    update();
    return;
  }
  guidedSceneMeasurementTimer = window.setTimeout(update, 120);
  app.dataset.measurementTimerOwnership = "1";
}

function syncTransactionDiagnostic(transaction = guidedProjectTransaction) {
  const diagnostic = transaction?.accepted === false ? transaction.errors?.[0] : null;
  const registry = getImmersiveLayout(project.layout);
  const layoutLabel = registry?.label || "selected layout";
  const message = app?.querySelector("[data-transaction-diagnostic]");
  if (message) {
    message.hidden = !diagnostic;
    message.textContent = diagnostic
      ? `Last accepted project specification preserved. ${formatGuidedDiagnostic(diagnostic)} The ${layoutLabel} source model remains unchanged except for its audited shelf-preview control.`
      : "";
  }
  const status = app?.querySelector("[data-guided-engine-status]");
  if (status) {
    status.querySelector("[data-guided-engine-title]").textContent = diagnostic
      ? "Project edit needs attention"
      : `${layoutLabel} reference model`;
    status.querySelector("[data-guided-engine-copy]").textContent = diagnostic
      ? `${formatGuidedDiagnostic(diagnostic)} The exact registered source remains fail-closed.`
      : "The proven shelf-clearance control moves one audited shelf group; every other dimension remains saved project data pending design confirmation.";
  }
  const preview = app?.querySelector(".concept-preview");
  if (preview) {
    preview.dataset.projectSpecificationAccepted = String(acceptedSpecification?.accepted === true);
  }
}

function updateSmartDimensionFromControl(control, options = {}) {
  const definition = getImmersiveLayout(project.layout)?.geometryControlManifest?.[control.dataset.smartDimension];
  if (!definition) return;
  const inches = Number(control.value);
  const minimumInches = millimetersToInches(definition.minMillimeters);
  const maximumInches = millimetersToInches(definition.maxMillimeters);
  const displayedEndpointToleranceInches = 0.005001;
  const valid = Number.isFinite(inches)
    && inches >= minimumInches - displayedEndpointToleranceInches
    && inches <= maximumInches + displayedEndpointToleranceInches;
  control.toggleAttribute("aria-invalid", !valid);
  const error = control.closest("[data-smart-dimension-control]")?.querySelector("[data-smart-dimension-error]");
  if (error) error.hidden = valid;
  if (!valid) return;
  const clampedInches = Math.min(maximumInches, Math.max(minimumInches, inches));
  const millimeters = normalizeSmartDimension(project.layout, definition.id, inchesToMillimeters(clampedInches));
  const source = options.finalize ? "panel-change" : "panel-input";
  if (!guidedSceneController?.commitDimension?.(millimeters, source)) {
    persistSmartDimension({ layoutId: project.layout, controlId: definition.id, value: millimeters, source });
  }
  if (options.finalize) control.value = millimetersToInches(millimeters).toFixed(2);
}

function persistSmartDimension({ layoutId, controlId, value }) {
  if (!layoutId || !controlId || !project.layoutStates?.[layoutId]) return;
  project.layoutStates[layoutId].smartDimensions = {
    ...(project.layoutStates[layoutId].smartDimensions || {}),
    [controlId]: value
  };
  project.updatedAt = new Date().toISOString();
  const input = app?.querySelector(`[data-smart-dimension="${CSS.escape(controlId)}"]`);
  if (input && layoutId === project.layout && document.activeElement !== input) {
    input.value = millimetersToInches(value).toFixed(2);
  }
  scheduleDraftSave();
}

function focusSmartDimensionEditor({ controlId }) {
  if (!controlId) return;
  customizationModeFocusReturn = document.activeElement?.closest?.(".immersive-viewer-surface button, .immersive-viewer-surface [tabindex]")
    || app?.querySelector(`[data-dimension-handle="${CSS.escape(controlId)}"]`)
    || null;
  const selector = `[data-smart-dimension="${CSS.escape(controlId)}"]`;
  if (activeCustomizationTab !== "dimensions" || !app?.querySelector(selector)) {
    activeCustomizationTab = "dimensions";
    activeDimensionFieldId = controlId;
    renderApp();
  }
  requestAnimationFrame(() => {
    const input = app?.querySelector(selector);
    input?.focus({ preventScroll: true });
    input?.scrollIntoView?.({ block: "center", inline: "nearest" });
    input?.select?.();
  });
}

function setCustomizationSheetState(state, trigger = null) {
  if (!["collapsed", "half", "expanded"].includes(state)) return;
  const leavingExpanded = customizationSheetState === "expanded" && state !== "expanded";
  if (state === "expanded" && trigger) customizationSheetFocusReturn = trigger;
  customizationSheetState = state;
  const sheet = app?.querySelector("[data-customization-sheet]");
  if (!sheet) return;
  sheet.dataset.sheetState = state;
  sheet.querySelector("[data-sheet-cycle]")?.setAttribute("aria-expanded", String(state === "expanded"));
  sheet.querySelectorAll("[data-sheet-state-control]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.sheetStateControl === state));
  });
  syncCustomizationSheetAccessibility();
  if (state === "expanded" && customizationMobileQuery.matches) {
    requestAnimationFrame(() => sheet.querySelector('[role="tab"][aria-selected="true"]')?.focus({ preventScroll: true }));
  } else if (leavingExpanded && customizationSheetFocusReturn?.isConnected) {
    customizationSheetFocusReturn.focus({ preventScroll: true });
  }
  requestAnimationFrame(() => {
    guidedSceneController?.resize?.();
    guidedSceneController?.fitCamera?.({ preserveOrientation: true, animate: !prefersReducedMotion() });
  });
}

function syncCustomizationSheetAccessibility() {
  const sheet = app?.querySelector("[data-customization-sheet]");
  const mobile = customizationMobileQuery.matches;
  const expanded = Boolean(sheet) && mobile && customizationSheetState === "expanded";
  const outsideSheet = [
    document.querySelector("[data-site-header]"),
    document.querySelector(".skip-link"),
    app?.querySelector(".guided-stepper"),
    app?.querySelector(".immersive-viewer-surface")
  ].filter(Boolean);
  for (const element of outsideSheet) element.inert = expanded;
  if (!sheet) return;
  const collapsed = mobile && customizationSheetState === "collapsed";
  const panel = sheet.querySelector(".customization-panel");
  const actions = sheet.querySelector(".immersive-sticky-actions");
  const grip = sheet.querySelector("[data-sheet-cycle]");
  const focusWasInsideCollapsedRegion = collapsed
    && (panel?.contains(document.activeElement) || actions?.contains(document.activeElement));
  if (panel) panel.inert = collapsed;
  if (actions) actions.inert = collapsed;
  if (focusWasInsideCollapsedRegion) {
    requestAnimationFrame(() => grip?.focus({ preventScroll: true }));
  }
  if (expanded) {
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.setAttribute("aria-labelledby", "customization-sheet-title");
  } else {
    sheet.removeAttribute("role");
    sheet.removeAttribute("aria-modal");
    sheet.removeAttribute("aria-labelledby");
  }
  sheet.toggleAttribute("data-focus-contained", expanded);
  grip?.setAttribute("aria-label", `Customization sheet is ${customizationSheetState}; change height`);
}

function handleCustomizationBreakpointChange() {
  const nextState = customizationMobileQuery.matches
    ? "collapsed"
    : customizationTabletQuery.matches ? "half" : "expanded";
  setCustomizationSheetState(nextState);
}

function trapExpandedSheetFocus(event) {
  if (event.key === "Escape" && customizationSheetState === "expanded" && customizationMobileQuery.matches) {
    event.preventDefault();
    setCustomizationSheetState("half");
    return true;
  }
  if (event.key !== "Tab" || customizationSheetState !== "expanded" || !customizationMobileQuery.matches) return false;
  const sheet = app?.querySelector("[data-customization-sheet]");
  if (!sheet) return false;
  const focusable = [...sheet.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])')]
    .filter((element) => !element.closest("[inert]") && element.getClientRects().length);
  if (!focusable.length) return false;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!sheet.contains(document.activeElement)) {
    event.preventDefault();
    first.focus();
    return true;
  }
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
    return true;
  }
  if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
    return true;
  }
  return false;
}

function updateDimensionChip(field, value) {
  const chip = app.querySelector(`[data-dimension-chip="${CSS.escape(field.id)}"] [data-dimension-value]`);
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
  else if (action === "out") previewScale = Math.max(1, previewScale - 0.1);
  else previewScale = 1;
  guidedSceneController?.zoom(action);
  applyPreviewScale();
}

function applyPreviewScale() {
  app?.querySelectorAll("[data-concept-scene]").forEach((scene) => {
    scene.style.setProperty(
      "--preview-scale",
      scene.dataset.guided3dState === "ready" ? "1" : String(previewScale)
    );
  });
  app?.querySelectorAll("[data-preview-zoom]").forEach((button) => {
    button.disabled = false;
  });
}

function getGuidedSceneOptions() {
  return {
    showDimensions: project.currentStep === 3 && getActiveCustomizationMode() === "dimensions",
    showProduct: project.currentStep >= 3,
    acceptedSpecification,
    rejectedCandidate: guidedProjectTransaction?.rejectedCandidate || null
  };
}

function updateGuidedSceneState(state, details = {}) {
  const mount = app?.querySelector("[data-guided-3d-mount]");
  const registry = getImmersiveLayout(project.layout);
  const layoutLabel = registry?.label || "selected layout";
  const immersiveSurface = mount?.closest(".immersive-viewer-surface");
  if (immersiveSurface) {
    const focusedToolbarControl = document.activeElement?.closest?.("[data-viewer-view], [data-viewer-command]");
    const runtimeExists = Boolean(mount.querySelector("[data-layout-viewer]"));
    const controlsEnabled = ["ready", "finish-loading", "finish-error"].includes(state);
    const runtimeStatusAccessible = runtimeExists && ["loading", "error"].includes(state);
    mount.inert = !(controlsEnabled || runtimeStatusAccessible);
    if (mount.inert) mount.setAttribute("aria-hidden", "true");
    else mount.removeAttribute("aria-hidden");
    immersiveSurface.dataset.guided3dState = state;
    immersiveSurface.dataset.guided3dBackend = details.backend || guidedSceneController?.getDiagnostics?.().backend || "";
    immersiveSurface.querySelectorAll("[data-viewer-view], [data-viewer-command]").forEach((button) => {
      button.disabled = !controlsEnabled;
    });
    if (state === "loading" && focusedToolbarControl) {
      guidedSceneFocusReturn = focusedToolbarControl;
      requestAnimationFrame(() => mount.querySelector("[data-viewer-status]")?.focus({ preventScroll: true }));
    }
    const status = immersiveSurface.querySelector("[data-guided-engine-status]");
    if (status) {
      const statusHadFocus = status.contains(document.activeElement);
      const finishState = state === "finish-loading" || state === "finish-error";
      status.hidden = state === "ready"
        || (runtimeExists && !finishState);
      const title = state === "finish-loading"
        ? "Loading selected Finish"
        : state === "finish-error"
          ? "Selected Finish unavailable"
          : state === "loading" ? `Loading ${layoutLabel}` : `${layoutLabel} model unavailable`;
      const copy = details.message || (state === "finish-loading"
        ? "The verified material is loading and will appear atomically when ready."
        : state === "finish-error"
          ? "Select this Finish again or use Retry; the last applied material remains intact."
          : state === "loading"
            ? "The exact registered model is being verified."
            : "The viewer failed closed; no substitute model or image was loaded.");
      status.querySelector("[data-guided-engine-title]").textContent = title;
      status.querySelector("[data-guided-engine-copy]").textContent = copy;
      const retry = status.querySelector("[data-guided-engine-retry]");
      if (retry) retry.hidden = !["finish-error", "error", "fallback"].includes(state);
      if (state === "ready" && statusHadFocus) {
        const selectedFinish = app.querySelector('[data-project-field="finish"][aria-pressed="true"]');
        requestAnimationFrame(() => (selectedFinish || mount.querySelector("canvas"))?.focus({ preventScroll: true }));
      }
    }
    if (state === "ready" && guidedSceneFocusReturn) {
      const focusReturn = guidedSceneFocusReturn;
      guidedSceneFocusReturn = null;
      requestAnimationFrame(() => {
        if (focusReturn.isConnected && !focusReturn.disabled) focusReturn.focus({ preventScroll: true });
        else mount.querySelector("canvas")?.focus({ preventScroll: true });
      });
    }
    if (state === "error" && immersiveSurface.contains(document.activeElement)) {
      requestAnimationFrame(() => {
        const retry = runtimeExists
          ? mount.querySelector("[data-viewer-retry]:not([hidden])")
          : immersiveSurface.querySelector("[data-guided-engine-retry]:not([hidden])");
        retry?.focus({ preventScroll: true });
      });
    }
    return;
  }
  const scene = mount?.closest(".measurement-room, .concept-scene");
  if (!scene) return;
  const interactive = state === "ready";
  mount.inert = !interactive;
  if (interactive) mount.removeAttribute("aria-hidden");
  else mount.setAttribute("aria-hidden", "true");
  const status = scene.querySelector("[data-guided-engine-status]");
  if (status) status.hidden = state === "ready";
  if (state === "fallback" || state === "error") {
    if (status) {
      status.querySelector("[data-guided-engine-title]").textContent = `${layoutLabel} model unavailable`;
      status.querySelector("[data-guided-engine-copy]").textContent = details.message
        || "The viewer failed closed; no old generated model, photograph, or different GLB was substituted.";
    }
  } else if (state === "loading") {
    if (status) {
      status.querySelector("[data-guided-engine-title]").textContent = `Loading ${layoutLabel}`;
      status.querySelector("[data-guided-engine-copy]").textContent = details.message
        || "The exact SHA-locked authoritative GLB is being verified and parsed.";
    }
  } else if (state === "finish-loading") {
    if (status) {
      status.querySelector("[data-guided-engine-title]").textContent = "Loading selected Finish";
      status.querySelector("[data-guided-engine-copy]").textContent = details.message
        || "The new provisional digital material is loading and will appear atomically when ready.";
    }
  } else if (state === "finish-error") {
    if (status) {
      status.querySelector("[data-guided-engine-title]").textContent = "Selected Finish unavailable";
      status.querySelector("[data-guided-engine-copy]").textContent = details.message
        || "The material could not be loaded. Select a verified Finish to continue or select this option again to retry.";
    }
  }
  scene.dataset.guided3dState = state;
  applyPreviewScale();
}

function retryGuidedScene() {
  const state = app?.querySelector(".immersive-viewer-surface")?.dataset.guided3dState;
  const status = app?.querySelector("[data-guided-engine-status]");
  const restoreStatusFocus = status?.contains(document.activeElement);
  if (restoreStatusFocus) {
    guidedSceneFocusReturn = app.querySelector('[data-project-field="finish"][aria-pressed="true"]')
      || app.querySelector("[data-layout-viewer] canvas");
  }
  updateGuidedSceneState(state === "finish-error" ? "finish-loading" : "loading");
  if (restoreStatusFocus) requestAnimationFrame(() => status?.focus({ preventScroll: true }));
  if (guidedSceneController) {
    if (state === "finish-error") void guidedSceneController.update(project, getGuidedSceneOptions());
    else void guidedSceneController.retry();
    return;
  }
  guidedSceneImportPromise = null;
  syncGuidedScene();
}

function syncGuidedScene() {
  const mount = app?.querySelector("[data-guided-3d-mount]");
  const token = ++guidedSceneSyncToken;

  if (!mount) {
    guidedSceneController?.unmount?.();
    return;
  }

  if (!isActivePublicLayout()) {
    guidedSceneController?.unmount?.();
    updateGuidedSceneState("fallback", {
      message: "The interactive model is available for Cabinets + Shelves with Fireplace Wall, Door Wall, or Window Wall."
    });
    return;
  }

  if (!guidedSceneController) updateGuidedSceneState("loading");
  const importPromise = guidedSceneImportPromise ||= import("./guided-layout-viewer.js?v=immersive-layout-configurator-v1");
  importPromise
    .then(({ createGuidedLayoutViewerController }) => {
      if (token !== guidedSceneSyncToken || !mount.isConnected) return;
      guidedSceneController ||= createGuidedLayoutViewerController({
        onStateChange: updateGuidedSceneState,
        onDimensionChange: persistSmartDimension,
        onDimensionEditRequest: focusSmartDimensionEditor
      });
      guidedSceneController.mount(mount);
      return Promise.resolve(guidedSceneController.update(project, getGuidedSceneOptions())).then(() => {
        if (token !== guidedSceneSyncToken || !mount.isConnected) return;
        const diagnostics = guidedSceneController?.getDiagnostics?.();
        const presentationState = diagnostics?.state === "ready"
          && diagnostics?.lastError?.code === "FINISH_LOAD_FAILED"
          ? "finish-error"
          : diagnostics?.state;
        if (presentationState) updateGuidedSceneState(presentationState, {
          layoutId: diagnostics.layoutId,
          backend: diagnostics.backend,
          message: diagnostics.lastError?.message
        });
      });
    })
    .catch(() => {
      if (guidedSceneImportPromise === importPromise) guidedSceneImportPromise = null;
      if (token === guidedSceneSyncToken) updateGuidedSceneState("error", {
        message: "The interactive viewer could not start. Retry to load the verified module again."
      });
    });
}

function scheduleDraftSave() {
  window.clearTimeout(draftTimer);
  draftTimer = window.setTimeout(() => {
    const preparation = prepareCurrentProjectPersistence();
    const hasLastAcceptedDesign = Boolean(preparation.specification?.accepted || project.acceptedSnapshot);
    if (!preparation.accepted && hasLastAcceptedDesign) return;
    const saved = preparation.accepted
      ? store.saveAcceptedDraft(preparation)
      : store.saveDraft(project);
    if (saved || storageWarningShown) return;
    storageWarningShown = true;
    showToast("Automatic saving is unavailable in this browser. Keep this page open or enable local storage.");
  }, 180);
}

function bindHistory() {
  history.replaceState({ step: project.currentStep }, "", `${window.location.pathname}${window.location.search}#step-${project.currentStep}`);
  window.addEventListener("popstate", (event) => {
    const rawStep = Number(event.state?.step || window.location.hash.match(/^#step-(\d+)$/)?.[1]);
    const requestedStep = normalizeWorkflowStep(rawStep);
    if (requestedStep >= 1 && requestedStep <= project.maxVisitedStep) {
      navigateToStep(requestedStep, { history: false });
    }
    if (rawStep !== project.currentStep || requestedStep !== rawStep) {
      history.replaceState(
        { step: project.currentStep },
        "",
        `${window.location.pathname}${window.location.search}#step-${project.currentStep}`
      );
    }
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
  document.querySelector("[data-review-edit-form]")?.addEventListener("submit", handleReviewEditForm);
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
  if (project.productAvailability === "unavailable" || project.layoutAvailability === "unavailable") {
    showToast(`This unavailable ${project.productAvailability === "unavailable" ? "product" : "layout"} remains in My Projects and cannot be resaved as an active public preview.`);
    return;
  }
  const preparation = prepareCurrentProjectPersistence();
  if (!preparation.accepted) {
    showToast(`${preparation.message} (${preparation.code})`);
    return;
  }
  saveDialogMode = "save";
  renamingProjectId = null;
  const title = dialog.querySelector("#save-dialog-title");
  if (title) title.textContent = "Save this project";
  const selectedProduct = getProductChoiceForSelection(project.category, project.style);
  form.elements.projectName.value = project.projectName === "Untitled Project"
    ? `${selectedProduct?.label || getCategory(project.category).label} Project`
    : project.projectName;
  openDialog(dialog);
  requestAnimationFrame(() => form.elements.projectName.select());
}

function openReviewEditDialog() {
  const dialog = document.querySelector("[data-review-edit-dialog]");
  const form = dialog?.querySelector("[data-review-edit-form]");
  if (!dialog || !form) return;
  form.elements.projectNotes.value = project.notes || "";
  openDialog(dialog);
  requestAnimationFrame(() => form.elements.projectNotes.focus());
}

function handleReviewEditForm(event) {
  event.preventDefault();
  const dialog = event.currentTarget.closest("dialog");
  updateProject({
    notes: event.currentTarget.elements.projectNotes.value.trim().slice(0, 2000)
  });
  store.saveDraft(project);
  dialog?.close();
  renderApp();
  showToast("Project notes updated.");
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

  const preparation = prepareCurrentProjectPersistence();
  if (!preparation.accepted) {
    showToast(`${preparation.message} (${preparation.code})`);
    return;
  }
  const projectName = name.slice(0, 80);
  const savedProject = store.saveAcceptedProject(preparation, projectName);
  if (!savedProject || !store.saveDraft(savedProject)) {
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
    const selectedProduct = getProductChoiceForSelection(saved.category, saved.style);
    const layout = getLayout(saved.category, saved.layout);
    const unavailableSelection = saved.productAvailability === "unavailable" || saved.layoutAvailability === "unavailable";
    return `
      <article class="saved-project${unavailableSelection ? " saved-project--unavailable" : ""}" data-saved-product-availability="${escapeAttribute(saved.productAvailability)}" data-saved-layout-availability="${escapeAttribute(saved.layoutAvailability)}">
        <div class="saved-project-copy">
          <strong>${escapeHtml(saved.projectName)}</strong>
          <small>${escapeHtml([selectedProduct?.label || category.label, layout?.label, formatSavedDate(saved.updatedAt)].filter(Boolean).join(" · "))}</small>
          ${unavailableSelection ? `<em>${saved.productAvailability === "unavailable" ? "Product" : "Layout"} unavailable in this public preview · saved record retained</em>` : ""}
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
    if (project.productAvailability === "unavailable") {
      project.currentStep = 1;
      project.maxVisitedStep = 1;
    } else if (project.layoutAvailability === "unavailable") {
      project.currentStep = 2;
      project.maxVisitedStep = 2;
    }
    document.querySelector("[data-projects-dialog]")?.close();
    previewScale = 1;
    activeCustomizationTab = "view";
    activeDimensionFieldId = "";
    renderApp({ focusHeading: true });
    history.replaceState({ step: project.currentStep }, "", `${window.location.pathname}?project=${encodeURIComponent(project.projectId)}#step-${project.currentStep}`);
    showToast(project.productAvailability === "unavailable" || project.layoutAvailability === "unavailable"
      ? `“${project.projectName}” is retained but its ${project.productAvailability === "unavailable" ? "product" : "layout"} is not available in this preview.`
      : `Resumed “${project.projectName}.”`);
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
  activeCustomizationTab = "view";
  activeDimensionFieldId = "";
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

  syncAcceptedSpecification();
  const quotePreparation = prepareGuidedQuote(project, project.acceptedSnapshot);
  if (!quotePreparation.accepted) {
    if (error) {
      error.textContent = "We couldn’t verify the accepted project specification for quoting. Return to the review step, confirm the details, and try again.";
      error.hidden = false;
    }
    return;
  }
  acceptedSpecification = quotePreparation.specification;
  project.acceptedSnapshot = quotePreparation.snapshot;

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
    prepareQuoteEmail(project, quotePreparation);
    const mode = form.querySelector("[data-quote-mode]");
    mode.innerHTML = `Your email draft is ready. Send it to complete the request, and attach any selected files. If no email window opened, <a href="${escapeAttribute(buildMailtoUrl(project, quotePreparation))}" data-email-fallback>open the prepared email again</a>.`;
    return;
  }

  submit.disabled = true;
  submit.textContent = "Sending…";
  try {
    formData.append("project", JSON.stringify(createConnectedQuotePayload(project, quotePreparation)));
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

function buildMailtoUrl(currentProject, preparedQuote = null) {
  const quotePreparation = preparedQuote?.accepted
    ? preparedQuote
    : prepareGuidedQuote(currentProject, currentProject.acceptedSnapshot);
  if (!quotePreparation.accepted) return "";
  const summary = buildProjectSummary(currentProject, {
    acceptedSpecification: quotePreparation.specification,
    acceptedQuote: quotePreparation.quote
  })
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

function createConnectedQuotePayload(currentProject, quotePreparation) {
  const payload = {
    ...currentProject,
    acceptedSnapshot: quotePreparation.snapshot,
    acceptedQuote: quotePreparation.quote
  };
  delete payload.acceptedSpecification;
  return payload;
}

function prepareQuoteEmail(currentProject, quotePreparation) {
  const anchor = document.createElement("a");
  anchor.href = buildMailtoUrl(currentProject, quotePreparation);
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

function hideToast() {
  window.clearTimeout(toastTimer);
  toastTimer = 0;
  const toast = document.querySelector("[data-guided-toast]");
  if (toast) toast.hidden = true;
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
