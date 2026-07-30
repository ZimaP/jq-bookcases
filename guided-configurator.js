import { mountIcons } from "./icon-system.js?v=product-first-20260727a";
import {
  DETAIL_OPTIONS,
  FINISH_OPTIONS,
  PRODUCT_CHOICES,
  PRODUCT_INTEGRATED_PREVIEW_ASSETS,
  SHARED_ROOM_LAYOUTS,
  getCategory,
  getCompatibleDetails,
  getFinish,
  getLayout,
  getMeasurementDiagramSpec,
  getMeasurementFields,
  getProductChoice,
  getProductChoiceForSelection,
  getStyle,
  resolvePreviewPresentation
} from "./guided-configurator-data.js?v=room-preview-fix-20260730a";
import {
  buildProjectSummary,
  createProject,
  createProjectStore,
  formatInches,
  normalizeProject,
  parseInches,
  validateMeasurements
} from "./guided-configurator-state.js?v=room-preview-fix-20260730a";

const STEP_DEFINITIONS = Object.freeze([
  Object.freeze({ id: 1, label: "Choose Product", mobileLabel: "Product", title: "What would you like us to build?", description: "Start with the type of fitted furniture you need. We’ll shape it around your room in the next step." }),
  Object.freeze({ id: 2, label: "Choose Layout", mobileLabel: "Layout", title: "Choose the room condition that matches your space", description: "Select the wall or room condition where your fitted furniture will be built." }),
  Object.freeze({ id: 3, label: "Room & Size", mobileLabel: "Size", title: "Tell us about your space", description: "Enter the basic measurements so we can build a pre-designed concept for your wall." }),
  Object.freeze({ id: 4, label: "Customization", mobileLabel: "Finish", title: "Refine your concept", description: "Choose the finish, hardware, and lighting for the design you selected." }),
  Object.freeze({ id: 5, label: "Review & Details", mobileLabel: "Review", title: "Review your custom concept", description: "Check your selections and request a quote or save the project for later." })
]);

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

const CONCEPT_FINISH_MASKS = Object.freeze({
  "concept-cabinets-shelves-v1.png": Object.freeze({
    viewBox: "0 0 1254 1254",
    width: 1254,
    height: 1254,
    rectangles: Object.freeze([
      [195, 82, 872, 76],
      [195, 112, 55, 596],
      [615, 112, 39, 596],
      [1016, 112, 55, 596],
      [205, 112, 850, 34],
      [222, 280, 804, 24],
      [222, 414, 804, 24],
      [222, 548, 804, 24],
      [222, 680, 804, 28],
      [194, 694, 880, 325]
    ])
  }),
  "concept-drawers-shelves-v1.png": Object.freeze({
    viewBox: "0 0 1448 1086",
    width: 1448,
    height: 1086,
    rectangles: Object.freeze([
      [221, 38, 1048, 98],
      [220, 96, 46, 615],
      [714, 96, 36, 615],
      [1218, 96, 49, 615],
      [248, 98, 985, 34],
      [250, 241, 979, 25],
      [250, 386, 979, 25],
      [250, 532, 979, 25],
      [250, 684, 979, 29],
      [204, 700, 1084, 289]
    ])
  }),
  "concept-full-shelving-v1.png": Object.freeze({
    viewBox: "0 0 1536 1024",
    width: 1536,
    height: 1024,
    rectangles: Object.freeze([
      [177, 59, 1173, 68],
      [193, 108, 39, 782],
      [568, 108, 39, 782],
      [945, 108, 38, 782],
      [1305, 108, 42, 782],
      [211, 108, 1118, 34],
      [224, 245, 1081, 25],
      [224, 371, 1081, 25],
      [224, 497, 1081, 25],
      [224, 620, 1081, 25],
      [224, 741, 1081, 25],
      [224, 865, 1081, 27],
      [193, 872, 1144, 55]
    ])
  }),
  "concept-tv-wall-v1.png": Object.freeze({
    viewBox: "0 0 1536 1024",
    width: 1536,
    height: 1024,
    rectangles: Object.freeze([
      [166, 53, 1227, 75],
      [174, 103, 43, 543],
      [480, 103, 38, 543],
      [906, 103, 39, 543],
      [1334, 103, 43, 543],
      [196, 103, 1155, 39],
      [200, 245, 1149, 25],
      [200, 373, 301, 25],
      [929, 373, 420, 25],
      [200, 503, 301, 25],
      [929, 503, 420, 25],
      [493, 339, 465, 30],
      [493, 339, 28, 306],
      [930, 339, 28, 306],
      [493, 615, 465, 30],
      [200, 631, 1149, 21],
      [157, 643, 1231, 286]
    ])
  }),
  "concept-window-cabinets-v1.png": Object.freeze({
    viewBox: "0 0 1448 1086",
    width: 1448,
    height: 1086,
    rectangles: Object.freeze([
      [107, 75, 1233, 81],
      [109, 120, 45, 635],
      [436, 120, 42, 635],
      [977, 120, 42, 635],
      [1294, 120, 45, 635],
      [117, 120, 1215, 36],
      [126, 286, 326, 24],
      [998, 286, 322, 24],
      [126, 438, 326, 24],
      [998, 438, 322, 24],
      [126, 587, 326, 24],
      [998, 587, 322, 24],
      [126, 738, 326, 24],
      [998, 738, 322, 24],
      [97, 748, 1253, 219]
    ])
  }),
  "concept-cabinets-shelves-between-openings-v1.png": Object.freeze({
    viewBox: "0 0 1536 1024",
    width: 1536,
    height: 1024,
    rectangles: Object.freeze([
      [369, 148, 794, 58],
      [365, 183, 37, 417],
      [758, 183, 31, 417],
      [1127, 183, 37, 417],
      [390, 184, 750, 27],
      [392, 290, 744, 22],
      [392, 397, 744, 22],
      [392, 496, 744, 22],
      [365, 594, 799, 207],
      [365, 782, 799, 20]
    ])
  }),
  "concept-drawers-shelves-between-openings-v1.png": Object.freeze({
    viewBox: "0 0 1536 1024",
    width: 1536,
    height: 1024,
    rectangles: Object.freeze([
      [389, 147, 756, 58],
      [389, 187, 33, 431],
      [746, 187, 31, 431],
      [1113, 187, 33, 431],
      [410, 189, 711, 26],
      [411, 299, 708, 22],
      [411, 404, 708, 22],
      [411, 500, 708, 22],
      [389, 612, 757, 176],
      [389, 770, 757, 20]
    ])
  }),
  "concept-full-shelving-between-openings-v1.png": Object.freeze({
    viewBox: "0 0 1536 1024",
    width: 1536,
    height: 1024,
    rectangles: Object.freeze([
      [324, 168, 885, 50],
      [332, 198, 34, 594],
      [620, 198, 31, 594],
      [890, 198, 31, 594],
      [1175, 198, 34, 594],
      [352, 199, 835, 25],
      [354, 305, 830, 21],
      [354, 407, 830, 21],
      [354, 500, 830, 21],
      [354, 599, 830, 21],
      [354, 690, 830, 21],
      [354, 779, 830, 21],
      [332, 787, 877, 29]
    ])
  }),
  "product-floating-storage-v1.png": Object.freeze({
    viewBox: "0 0 1536 1024",
    width: 1536,
    height: 1024,
    rectangles: Object.freeze([
      [241, 484, 1065, 25],
      [241, 484, 28, 66],
      [1278, 484, 28, 66],
      [269, 532, 1009, 20],
      [190, 548, 1142, 217]
    ])
  }),
  "product-radiator-cover-v1.png": Object.freeze({
    viewBox: "0 0 1536 1024",
    width: 1536,
    height: 1024,
    rectangles: Object.freeze([
      [113, 389, 1307, 31],
      [126, 414, 1277, 426]
    ])
  }),
  "assets/photos/configurator/integrated/tv-unit/framed-tv-wall/double-opening-v2.png": Object.freeze({
    viewBox: "0 0 1536 1024",
    width: 1536,
    height: 1024,
    rectangles: Object.freeze([
      [420, 205, 696, 611]
    ]),
    cutouts: Object.freeze([
      [590, 349, 355, 216]
    ])
  }),
  "assets/photos/configurator/integrated/floating-storage/floating-drawer-bank/double-opening-v3.png": Object.freeze({
    viewBox: "0 0 1536 1024",
    width: 1536,
    height: 1024,
    rectangles: Object.freeze([
      [390, 510, 751, 194]
    ])
  }),
  "assets/photos/configurator/integrated/window-storage/window-seat-storage/double-opening-v2.png": Object.freeze({
    viewBox: "0 0 1536 1024",
    width: 1536,
    height: 1024,
    rectangles: Object.freeze([
      [357, 128, 819, 52],
      [375, 165, 785, 42],
      [375, 172, 170, 660],
      [990, 172, 170, 660],
      [375, 696, 785, 162]
    ])
  }),
  "assets/photos/configurator/integrated/radiator-cover/clean-slat-cover/double-opening-v2.png": Object.freeze({
    viewBox: "0 0 1536 1024",
    width: 1536,
    height: 1024,
    rectangles: Object.freeze([
      [408, 582, 723, 235]
    ])
  })
});

const app = document.querySelector("[data-guided-app]");
const store = createProjectStore();
const quoteEndpointMeta = document.querySelector('meta[name="jq-quote-endpoint"]');

let project = initializeProject();
let activeCustomizationTab = "finish";
let previewScale = 1;
let saveDialogMode = "save";
let renamingProjectId = null;
let toastTimer = 0;
let draftTimer = 0;
let storageWarningShown = false;
const previewPreloadCache = new Set();

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
      productSelected: true,
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
  if (project.currentStep >= 2) preloadPreviewAsset(project.previewAsset);
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
  applyPreviewScale();
  scheduleDraftSave();
  scheduleLikelyNextStepImages();

  requestAnimationFrame(() => {
    if (options.focusHeading) app.querySelector("#guided-page-title")?.focus({ preventScroll: true });
  });
}

function scheduleLikelyNextStepImages() {
  let assets = [];
  if (project.currentStep === 1 && project.productSelected) {
    assets = SHARED_ROOM_LAYOUTS.map((layout) => layout.previewAsset);
  } else if ([2, 3].includes(project.currentStep)) {
    const category = getCategory(project.category);
    const selectedProduct = getProductChoiceForSelection(project.category, project.style);
    assets = [
      ...Object.values(PRODUCT_INTEGRATED_PREVIEW_ASSETS[selectedProduct?.id] || {}),
      category.productPreviewAsset,
      "assets/photos/configurator/concept-window-cabinets-v1.png"
    ];
  }

  if (!assets.length) return;
  window.setTimeout(() => {
    [...new Set(assets)].forEach(preloadPreviewAsset);
  }, 0);
}

function preloadPreviewAsset(asset) {
  if (!asset) return;

  const generatedFinishMask = resolveGeneratedIntegratedFinishMask(asset)?.maskAsset;
  const sources = [
    optimizedImageAsset(asset),
    generatedFinishMask
  ].filter(Boolean);

  for (const source of sources) {
    if (previewPreloadCache.has(source)) continue;
    previewPreloadCache.add(source);
    const image = new Image();
    image.decoding = "async";
    image.src = source;
  }
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

  return `
    <picture class="${escapeAttribute(pictureClass)}" aria-hidden="true">
      <source type="image/avif" srcset="${escapeAttribute(optimizedSource)}">
      <img
        class="${escapeAttribute(imageClass)}"
        src="${escapeAttribute(source)}"
        alt=""
        loading="${loading}"
        decoding="async"
        ${fetchPriority}${style}
      >
    </picture>
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
  if (project.currentStep === 3) return renderMeasurementStep();
  if (project.currentStep === 4) return renderCustomizationStep();
  return renderReviewStep();
}

function renderProductStep() {
  return `
    <div class="product-grid product-grid--catalog" role="group" aria-label="Product choices">
      ${PRODUCT_CHOICES.map((choice, index) => {
        const category = getCategory(choice.categoryId);
        const style = getStyle(choice.categoryId, choice.styleId);
        const selected = project.productSelected
          && choice.categoryId === project.category
          && choice.styleId === project.style;
        return `
          <button
            class="product-card${selected ? " is-selected" : ""}"
            type="button"
            data-product-choice="${escapeAttribute(choice.id)}"
            data-product-category="${escapeAttribute(choice.categoryId)}"
            data-product-style="${style.id}"
            aria-pressed="${selected}"
            aria-label="${escapeAttribute(choice.label)}"
          >
            ${selected ? '<span class="choice-selected-mark" aria-hidden="true"><i data-icon="check" aria-hidden="true"></i></span>' : ""}
            <span class="product-card-image" aria-hidden="true">
              ${renderOptimizedPicture(style.previewAsset || category.productPreviewAsset, {
                loading: "eager",
                fetchPriority: index === 0 ? "high" : "low",
                style: "object-position:50% 50%"
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
      <button class="guided-button guided-button-primary" type="button" data-continue ${project.productSelected ? "" : "disabled"}>
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
    <div class="layout-grid" role="group" aria-label="Room conditions">
      ${SHARED_ROOM_LAYOUTS.map((layout) => {
        const selected = layout.id === project.layout;
        return `
          <button
            class="layout-card${selected ? " is-selected" : ""}"
            type="button"
            data-layout="${layout.id}"
            aria-pressed="${selected}"
            aria-label="${escapeAttribute(layout.label)}"
          >
            ${selected ? '<span class="layout-selected-mark" aria-hidden="true"><i data-icon="check" aria-hidden="true"></i></span>' : ""}
            ${renderLayoutPreview(layout)}
            <span class="layout-card-copy">
              <span class="layout-card-title">${escapeHtml(layout.label)}</span>
            </span>
          </button>
        `;
      }).join("")}
    </div>
    <aside class="guided-info">
      <i data-icon="information" aria-hidden="true"></i>
      <span>These same ten room conditions apply to every product. Choose the closest match — our team will confirm the details before production.</span>
    </aside>
    <div class="guided-actions">
      <button class="guided-button guided-button-secondary" type="button" data-back>
        <i data-icon="chevron-left" aria-hidden="true"></i> Back
      </button>
      <button class="guided-button guided-button-primary" type="button" data-continue ${project.layout ? "" : "disabled"}>
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

function renderMeasurementStep() {
  const selectedLayout = getLayout(project.category, project.layout);
  const diagramFields = getMeasurementFields(project.category, project.layout);
  const fields = selectedLayout?.feature === "window"
    ? diagramFields.filter((field) => !["windowLeftDistance", "windowRightDistance"].includes(field.id))
    : diagramFields;
  const diagramFieldIds = new Set(
    selectMeasurementDiagramFields(fields, selectedLayout).map((field) => field.id)
  );
  const denseMeasurements = fields.length > 9;
  const validation = validateMeasurements(project);
  let previousGroup = "";

  const fieldMarkup = fields.map((field) => {
    const warning = validation.warnings.find((item) => item.field === field.id);
    const groupHeading = field.group !== previousGroup
      ? `<h2 class="measurement-group-title">${escapeHtml(field.group)}</h2>`
      : "";
    previousGroup = field.group;
    return `${groupHeading}${renderMeasurementField(field, warning, diagramFieldIds.has(field.id))}`;
  }).join("");

  return `
    <div class="measurement-layout${denseMeasurements ? " measurement-layout--dense" : ""}">
      <section
        class="measurement-panel${denseMeasurements ? " measurement-panel--dense" : ""}"
        data-measurement-field-count="${fields.length}"
        aria-label="Approximate room measurements"
      >
        <h2 class="measurement-panel-title">Selected Layout</h2>
        <p class="selected-layout-chip">
          ${renderCategoryIcon(getCategory(project.category).icon)}
          <span>${escapeHtml(selectedLayout?.label || "Select a layout")}</span>
        </p>
        <p class="measurement-format-hint visually-hidden">Use inches. Decimals and common fractions are welcome.</p>
        <div class="measurement-fields">${fieldMarkup}</div>
        <p class="measurement-error" data-measurement-error role="alert" ${validation.errors.length ? "" : "hidden"}>
          ${validation.errors.length ? escapeHtml(validation.errors[0].message) : ""}
        </p>
      </section>
      ${renderMeasurementDiagram(selectMeasurementDiagramFields(fields, selectedLayout), selectedLayout)}
    </div>
    <aside class="guided-info">
      <i data-icon="information" aria-hidden="true"></i>
      <span>Don’t worry if your measurements are approximate — our team can confirm detail before production.</span>
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

function renderMeasurementDiagram(fields, selectedLayout) {
  const diagramSpec = getMeasurementDiagramSpec(project.category, selectedLayout?.id);
  const fieldsById = new Map(
    fields
      .filter((field) => field.type === "inches")
      .map((field) => [field.id, field])
  );
  const dimensions = diagramSpec.perimeterSpans
    .map((span) => ({ span, field: fieldsById.get(span.fieldId) }))
    .filter(({ field }) => Boolean(field));
  const roomVisual = renderOptimizedPicture(
    selectedLayout?.previewAsset || getLayout(project.category, "clear-wall")?.previewAsset,
    {
      pictureClass: "measurement-room-image",
      imageClass: "measurement-room-image",
      loading: "eager",
      fetchPriority: "high"
    }
  );
  const syntheticFeature = (
    selectedLayout?.id === "clear-wall"
    && ["tv", "window", "radiator"].includes(diagramSpec.feature)
  ) ? '<span class="measurement-feature" aria-hidden="true"></span>' : "";

  return `
    <figure class="measurement-diagram-card" aria-label="Measurement diagram for ${escapeAttribute(selectedLayout?.label || "selected layout")}">
      <div
        class="measurement-room measurement-room--photo"
        data-layout="${escapeAttribute(selectedLayout?.id || "clear-wall")}"
        data-condition="${escapeAttribute(selectedLayout?.condition || "clear-wall")}"
        data-feature="${escapeAttribute(diagramSpec.feature)}"
      >
        ${roomVisual}
        ${syntheticFeature}
        ${renderDimensionDrawing(dimensions, diagramSpec)}
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
      preserveAspectRatio="xMidYMid meet"
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
        const labelScale = diagramSpec.height / 480;
        const labelWidth = Math.min(
          190,
          Math.max(
            112,
            annotationName.length * 4.8 + 20
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
                    <tspan class="measurement-annotation-name">${escapeHtml(annotationName)}</tspan>
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
  return `
    <div class="customization-layout">
      <div class="customization-controls-column">
        <section class="customization-panel" aria-label="Concept customization">
          ${renderCustomizationTabs()}
          <div class="customization-content" id="customization-panel">
            ${renderCustomizationPanel()}
          </div>
        </section>
        <div class="customization-actions">
          <button class="guided-button guided-button-secondary" type="button" data-back>
            <i data-icon="chevron-left" aria-hidden="true"></i> Back
          </button>
          <button class="guided-button guided-button-primary" type="button" data-continue>
            Continue <i data-icon="arrow-right" aria-hidden="true"></i>
          </button>
        </div>
      </div>
      ${renderConceptPreview()}
    </div>
  `;
}

function renderCustomizationTabs() {
  const tabs = [
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
          aria-controls="customization-section-${tab.id}"
          aria-selected="${activeCustomizationTab === tab.id}"
          tabindex="${activeCustomizationTab === tab.id ? "0" : "-1"}"
        >${escapeHtml(tab.label)}</button>
      `).join("")}
    </div>
  `;
}

function renderCustomizationPanel() {
  return `
    <div
      class="customization-section customization-section--finish${activeCustomizationTab === "finish" ? " is-active" : ""}"
      id="customization-section-finish"
      role="tabpanel"
      aria-labelledby="customization-tab-finish"
    >
      ${activeCustomizationTab === "finish" ? renderFinishChoices() : ""}
    </div>
    <div
      class="customization-section customization-section--details${activeCustomizationTab === "details" ? " is-active" : ""}"
      id="customization-section-details"
      role="tabpanel"
      aria-labelledby="customization-tab-details"
    >
      ${activeCustomizationTab === "details" ? renderDetailChoices() : ""}
    </div>
  `;
}

function renderFinishChoices() {
  const referencePaintFinishes = ["warm-white", "soft-ivory", "sage-gray", "charcoal"]
    .map((finishId) => FINISH_OPTIONS.paint.find((finish) => finish.id === finishId))
    .filter(Boolean);
  return `
    <h3 class="customization-group-heading">Finish</h3>
    ${renderFinishGroup("Wood finishes", "wood", FINISH_OPTIONS.wood)}
    ${renderFinishGroup("Paint / Accent Colors", "paint", referencePaintFinishes)}
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
                </span>
              </button>
            `;
          }).join("")}
        </div>
      </section>
    `).join("")}
  `;
}

function renderConceptPreview() {
  const category = getCategory(project.category);
  const layout = getLayout(project.category, project.layout);
  const selectedStyle = getStyle(project.category, project.style);
  const selectedProduct = getProductChoiceForSelection(category.id, selectedStyle.id);
  const previewPresentation = resolvePreviewPresentation(category.id, selectedStyle.id, layout?.id);
  const finish = getFinish(project.finish);
  const finishPreview = finish.preview || {};
  const accentFinish = project.accentFinish === "no-accent" ? finish : getFinish(project.accentFinish);
  const hardware = DETAIL_OPTIONS.hardware.find((option) => option.id === project.hardware);
  const doorCount = category.id === "floating-storage" ? 5 : category.id === "window-storage" ? 6 : 4;
  const previewScope = conceptPreviewScope(category, layout, selectedStyle, previewPresentation);

  return `
    <figure
      class="concept-preview"
      data-category="${escapeAttribute(category.id)}"
      data-layout="${escapeAttribute(layout?.id || "unselected")}"
      data-style="${escapeAttribute(selectedStyle.id)}"
      data-preview-key="${escapeAttribute(previewPresentation.previewKey)}"
      data-finish="${escapeAttribute(finish.id)}"
      data-finish-family="${escapeAttribute(finish.family)}"
      data-preview-asset="${escapeAttribute(previewPresentation.conceptAsset)}"
      data-layout-context-asset="${escapeAttribute(previewPresentation.layoutContextAsset || "")}"
      data-preview-render-mode="${escapeAttribute(previewPresentation.renderMode)}"
      data-preview-scope="${escapeAttribute(previewScope.id)}"
      style="--finish-color:${escapeAttribute(finish.color)};--finish-tint-opacity:${escapeAttribute(finishPreview.tintOpacity ?? 0)};--finish-tone-color:${escapeAttribute(finishPreview.toneColor || "transparent")};--finish-tone-blend:${escapeAttribute(finishPreview.toneBlend || "normal")};--finish-tone-opacity:${escapeAttribute(finishPreview.toneOpacity ?? 0)}"
      aria-label="${escapeAttribute(`${selectedProduct?.label || selectedStyle.label} for ${layout?.label || category.label} in ${finish.label}`)}"
    >
      <div class="concept-preview-meta">
        <div class="concept-finish-caption" aria-live="polite">
          <span class="concept-finish-caption-swatch" aria-hidden="true"></span>
          <span>
            <small>Live finish</small>
            <strong>${escapeHtml(finish.label)}</strong>
          </span>
        </div>
        ${renderConceptLayoutContext(layout, previewPresentation)}
      </div>
      <div class="concept-scene" data-concept-scene>
        ${renderOptimizedPicture(previewPresentation.conceptAsset, {
          pictureClass: "concept-photo",
          imageClass: "concept-photo",
          loading: "eager",
          fetchPriority: "high"
        })}
        ${renderConceptFinishOverlay(previewPresentation.conceptAsset)}
        ${previewPresentation.renderMode === "missing-integrated-scene" ? `
          <div class="concept-preview-unavailable" role="status">
            <strong>Room-specific concept in preparation</strong>
            <span>We will not substitute an unrelated room for ${escapeHtml(layout?.label || "this layout")}.</span>
          </div>
        ` : ""}
        <div
          class="concept-unit concept-unit--sentinel"
          data-style="${escapeAttribute(selectedStyle.id)}"
          style="display:none;--unit-finish:${escapeAttribute(finish.color)};--accent-finish:${escapeAttribute(accentFinish.color)};--hardware-color:${escapeAttribute(hardware?.color || "#302d2a")};--door-count:${doorCount}"
          aria-hidden="true"
        ></div>
      </div>
      ${renderPreviewControls()}
    </figure>
  `;
}

function renderConceptLayoutContext(layout, previewPresentation) {
  if (!layout || !previewPresentation.layoutContextAsset) return "";
  return `
    <div
      class="concept-layout-context"
      data-layout-context="${escapeAttribute(layout.id)}"
      data-layout-context-asset="${escapeAttribute(previewPresentation.layoutContextAsset)}"
      data-layout-context-mode="${escapeAttribute(previewPresentation.renderMode)}"
      role="note"
      aria-label="${escapeAttribute(`Selected room condition: ${layout.label}`)}"
    >
      <span class="concept-layout-context-copy">
        <small>Selected room</small>
        <strong>${escapeHtml(layout.label)}</strong>
      </span>
    </div>
  `;
}

function renderConceptFinishOverlay(previewAsset) {
  const assetName = String(previewAsset || "").split("/").pop();
  const definition = CONCEPT_FINISH_MASKS[previewAsset]
    || CONCEPT_FINISH_MASKS[assetName]
    || resolveGeneratedIntegratedFinishMask(previewAsset);
  if (!definition) return "";

  const maskId = `concept-finish-mask-${String(previewAsset).replace(/[^a-z0-9]+/gi, "-")}`;
  const maskContents = definition.maskAsset
    ? `
      <image
        href="${escapeAttribute(definition.maskAsset)}"
        x="0"
        y="0"
        width="${definition.width || 1536}"
        height="${definition.height || 1024}"
        preserveAspectRatio="none"
      ></image>
    `
    : `
      ${(definition.rectangles || []).map(([x, y, width, height]) => (
        `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="2" fill="#fff"></rect>`
      )).join("")}
      ${(definition.polygons || []).map((points) => (
        `<polygon points="${points}" fill="#fff"></polygon>`
      )).join("")}
      ${(definition.cutouts || []).map(([x, y, width, height]) => (
        `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="2" fill="#000"></rect>`
      )).join("")}
    `;
  return `
    <svg
      class="concept-finish-overlay"
      viewBox="${definition.viewBox || "0 0 1536 1024"}"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <mask
          id="${maskId}"
          maskUnits="userSpaceOnUse"
          maskContentUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="${definition.width || 1536}"
          height="${definition.height || 1024}"
          style="mask-type: luminance"
        >
          ${maskContents}
        </mask>
      </defs>
      <rect
        class="concept-finish-overlay-tint"
        width="${definition.width || 1536}"
        height="${definition.height || 1024}"
        mask="url(#${maskId})"
      ></rect>
      <rect
        class="concept-finish-overlay-tone"
        width="${definition.width || 1536}"
        height="${definition.height || 1024}"
        mask="url(#${maskId})"
      ></rect>
    </svg>
  `;
}

function resolveGeneratedIntegratedFinishMask(previewAsset) {
  const explicitMaskAssets = Object.freeze({
    "assets/photos/configurator/integrated/tv-unit/framed-tv-wall/double-opening-v2.png":
      "assets/photos/configurator/integrated/tv-unit/framed-tv-wall/double-opening-finish-mask-v1.png"
  });
  const explicitMaskAsset = explicitMaskAssets[String(previewAsset || "")];
  if (explicitMaskAsset) {
    return Object.freeze({
      viewBox: "0 0 1536 1024",
      width: 1536,
      height: 1024,
      maskAsset: explicitMaskAsset
    });
  }

  const match = String(previewAsset || "").match(
    /integrated\/([^/]+)\/([^/]+)\/([^/]+)-v\d+\.png$/
  );
  if (!match) return null;

  return Object.freeze({
    viewBox: "0 0 1536 1024",
    width: 1536,
    height: 1024,
    maskAsset: String(previewAsset).replace(/-v\d+\.png$/, "-finish-mask-v1.png")
  });
}

function conceptPreviewScope(category, layout, selectedStyle, previewPresentation) {
  if (previewPresentation.renderMode === "integrated") {
    return { id: "layout-and-configuration", label: "Layout + configuration reference" };
  }
  if (previewPresentation.renderMode === "missing-integrated-scene") {
    return { id: "missing-integrated-scene", label: `${selectedStyle.label} · ${layout?.label || "room"} render unavailable` };
  }
  return { id: "category", label: "Curated concept reference" };
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
      <button class="preview-control" type="button" data-preview-zoom="in" aria-label="Zoom in"><i data-icon="zoom-in" aria-hidden="true"></i></button>
      <button class="preview-control" type="button" data-preview-zoom="reset" aria-label="Reset preview"><i data-icon="reset" aria-hidden="true"></i></button>
    </div>
  `;
}

function renderReviewStep() {
  const summary = buildProjectSummary(project);
  const summaryKeys = [
    "product",
    "category",
    "layout",
    "wallWidth",
    "ceilingHeight",
    "desiredDepth",
    "finish",
    "doorStyle",
    "hardware",
    "lighting",
    "baseStyle",
    "topTreatment",
    "notes"
  ];
  const summaryLabels = {
    wallWidth: "Wall Width",
    ceilingHeight: "Height",
    desiredDepth: "Depth"
  };
  const conciseSummary = summaryKeys
    .map((key) => summary.find((row) => row.key === key))
    .filter(Boolean);
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
          <dl class="summary-list">
            ${conciseSummary.map((row) => `
              <div class="summary-row">
                <dt>${escapeHtml(summaryLabels[row.key] || row.label)}</dt>
                <dd><span data-summary-value="${escapeAttribute(row.key)}">${escapeHtml(row.value)}</span></dd>
              </div>
            `).join("")}
          </dl>
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

function bindAppEvents() {
  app.addEventListener("click", (event) => {
    const target = event.target.closest("button, a");
    if (!target) return;

    if (target.matches("[data-step]")) {
      navigateToStep(Number(target.dataset.step));
      return;
    }
    if (target.matches("[data-product-choice]")) {
      selectProductChoice(target.dataset.productChoice);
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
    if (target.matches("[data-edit-review]")) {
      openReviewEditDialog();
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
    const card = event.target.closest?.("[data-product-choice], [data-layout]");
    if (card && ["Enter", " ", "Spacebar"].includes(event.key)) {
      event.preventDefault();
      card.click();
      return;
    }

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

function selectProductChoice(productId) {
  const choice = getProductChoice(productId);
  if (!choice) return;
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
  const base = createProject({
    category: category.id,
    productSelected: true,
    projectId: project.projectId,
    projectName: project.projectName
  });
  project = normalizeProject({
    ...base,
    createdAt: project.createdAt,
    productSelected: true,
    style: selectedStyle.id,
    ...constructionDefaults,
    layout: null,
    currentStep: 1,
    maxVisitedStep: 1,
    updatedAt: new Date().toISOString()
  });
  activeCustomizationTab = "finish";
  previewScale = 1;
  renderApp();
  requestAnimationFrame(() => app.querySelector(`[data-product-choice="${CSS.escape(choice.id)}"]`)?.focus());
  showToast(`${choice.label} selected.`);
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
  if (project.currentStep === 1 && !project.productSelected) {
    showToast("Please choose what you would like us to build.");
    return;
  }
  if (project.currentStep === 2 && !project.layout) {
    showToast("Please choose the layout that best matches your space.");
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
  }
  navigateToStep(Math.min(5, project.currentStep + 1));
}

function navigateToStep(step, options = {}) {
  const targetStep = Math.min(5, Math.max(1, Number(step) || 1));
  if (targetStep > project.maxVisitedStep + 1) return;
  if (targetStep > 1 && !project.productSelected) {
    project.currentStep = 1;
    showToast("Choose what you would like us to build before moving on.");
    renderApp({ focusHeading: true });
    return;
  }
  if (targetStep > 2 && !project.layout) {
    project.currentStep = 2;
    showToast("Choose a room layout before moving to measurements.");
    renderApp({ focusHeading: true });
    return;
  }
  if (targetStep > 3 && !validateMeasurements(project).valid) {
    project.currentStep = 3;
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

  if (control.type === "radio") {
    row?.querySelectorAll(".measurement-toggle label").forEach((label) => {
      label.classList.toggle("is-selected", Boolean(label.querySelector("input")?.checked));
    });
  }

  const errorBox = app.querySelector("[data-measurement-error]");
  if (errorBox && validateMeasurements(project).valid) errorBox.hidden = true;
  if (options.finalize && field.type === "inches" && value !== null) control.value = formatInches(value, { decimal: true });
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
    const selectedProduct = getProductChoiceForSelection(saved.category, saved.style);
    const layout = getLayout(saved.category, saved.layout);
    return `
      <article class="saved-project">
        <div class="saved-project-copy">
          <strong>${escapeHtml(saved.projectName)}</strong>
          <small>${escapeHtml([selectedProduct?.label || category.label, layout?.label, formatSavedDate(saved.updatedAt)].filter(Boolean).join(" · "))}</small>
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
    activeCustomizationTab = "finish";
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
  activeCustomizationTab = "finish";
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
