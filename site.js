const navItems = [
  { label: "How It Works", href: "how-it-works.html", page: "how" },
  { label: "Materials", href: "materials.html", page: "materials" },
  { label: "Inspiration", href: "inspiration.html", page: "inspiration" },
  { label: "About Us", href: "about.html", page: "about" },
  { label: "FAQ", href: "faq.html", page: "faq" }
];

const designBuilderHref = "configurator.html";
const officialBrand = Object.freeze({
  name: "JQ BOOKCASES",
  descriptor: "BUILT-INS & MILLWORK",
  product: "3D Bookcase Configurator"
});

function renderBrandLink(className = "brand") {
  return `
    <a class="${className}" href="index.html" aria-label="JQ Bookcases home">
      <span class="brand-main">${officialBrand.name}</span>
      <span class="brand-sub">${officialBrand.descriptor}</span>
    </a>
  `;
}

const iconMap = {
  shield: `<path d="M12 3.6 18.7 6v5.2c0 4.5-2.8 7.7-6.7 9.2-3.9-1.5-6.7-4.7-6.7-9.2V6L12 3.6z"/><path d="m8.8 12.1 2.1 2.1 4.4-4.6"/>`,
  leaf: `<path d="M19.4 4.6c-6.6.7-11.5 4.2-12.6 10.8 4.9 1.2 9.4-1 11.9-6.3 1-2.1 1.2-3.6.7-4.5z"/><path d="M5.2 19.6c2.6-5.8 6.6-9.2 12.8-11.7"/>`,
  truck: `<path d="M3.8 7.1h9.5v8.2H3.8z"/><path d="M13.3 10h3.6l3 3v2.3h-6.6z"/><path d="M5.8 17.2a1.8 1.8 0 1 0 3.6 0 1.8 1.8 0 0 0-3.6 0z"/><path d="M15.5 17.2a1.8 1.8 0 1 0 3.6 0 1.8 1.8 0 0 0-3.6 0z"/><path d="M3.8 15.3h2"/><path d="M9.4 15.3h6.1"/>`,
  home: `<path d="m4 11 8-6.8 8 6.8"/><path d="M6.5 10.2v9.2h11v-9.2"/><path d="M10 19.4v-5.3h4v5.3"/>`,
  grid: `<rect x="4.2" y="4.2" width="15.6" height="15.6" rx="1.2"/><path d="M4.2 10h15.6"/><path d="M4.2 15.8h15.6"/><path d="M10 4.2v15.6"/><path d="M15.8 4.2v15.6"/>`,
  ruler: `<path d="m4.4 16.8 12.4-12.4 2.8 2.8L7.2 19.6z"/><path d="m8.6 16.1-1.7-1.7"/><path d="m11.3 13.4-1.7-1.7"/><path d="m14 10.7-1.7-1.7"/><path d="m16.7 8-1.7-1.7"/>`,
  tag: `<path d="m20 12-8 8-8-8V4h8z"/><path d="M8.7 8.7h.1"/><circle cx="8.8" cy="8.8" r="1.35"/>`,
  calendar: `<rect x="5" y="5.2" width="14" height="14.4" rx="1.4"/><path d="M8.2 3.4v3.7"/><path d="M15.8 3.4v3.7"/><path d="M5 10h14"/><path d="m9.1 15 1.8 1.8 4-4.2"/>`,
  wrench: `<path d="m4.5 19.5 6.7-6.7"/><path d="m9.1 10.7 4.1-4.1a3.7 3.7 0 0 1 5-.3l-3.1 3.1 2.2 2.2 3.1-3.1a3.7 3.7 0 0 1-.3 5l-4.1 4.1"/><path d="m4.8 4.7 5.6 5.6"/><path d="M3.9 6.8 6.8 3.9"/>`,
  people: `<path d="M8.2 11.2a3.8 3.8 0 1 0 0-7.6 3.8 3.8 0 0 0 0 7.6z"/><path d="M2.8 20.2c.7-3.2 2.6-5 5.4-5s4.7 1.8 5.4 5"/><path d="M16.4 10.9a3.1 3.1 0 1 0-.2-6.1"/><path d="M15.6 15.1c2.7.2 4.5 1.9 5.1 4.8"/>`,
  flag: `<path d="M5.5 20.5V4.4"/><path d="M5.5 5.2c3.6-1.8 6.5 1.8 10.7 0v8.2c-4.2 1.8-7.1-1.8-10.7 0"/>`,
  layers: `<path d="m12 3.8 8.5 4.6-8.5 4.7-8.5-4.7z"/><path d="m3.5 12.1 8.5 4.7 8.5-4.7"/><path d="m3.5 16 8.5 4.7 8.5-4.7"/>`,
  tree: `<path d="m12 3.6 4.4 5.2h-2.6l3.8 4.5h-3.2l2.8 3.5H6.8l2.8-3.5H6.4l3.8-4.5H7.6z"/><path d="M12 16.8v3.6"/>`,
  badge: `<path d="m12 3.5 2.6 1.7 3.2.5.5 3.2L20 12l-1.7 3.1-.5 3.2-3.2.5-2.6 1.7-2.6-1.7-3.2-.5-.5-3.2L4 12l1.7-3.1.5-3.2 3.2-.5z"/><path d="m8.8 12.1 2.1 2.1 4.4-4.6"/>`,
  drill: `<path d="M4.3 7.9h9.2v5.1H4.3z"/><path d="M13.5 9.1h4.2l2.1 1.4-2.1 1.4h-4.2"/><path d="M7 13v5.9h4V13"/><path d="M6.2 18.9h5.6"/><path d="M9 7.9v-2h4.2"/>`,
  headset: `<path d="M4.2 13v-1a7.8 7.8 0 0 1 15.6 0v1"/><path d="M4.2 13h3.7v5.8H4.2z"/><path d="M16.1 13h3.7v5.8h-3.7z"/><path d="M16.1 18.8c0 1.5-1.3 2.2-4.1 2.2"/>`,
  pin: `<path d="M12 21s6.7-6 6.7-11.7a6.7 6.7 0 1 0-13.4 0C5.3 15 12 21 12 21z"/><circle cx="12" cy="9.3" r="2.35"/>`,
  brush: `<path d="m14.2 4.2 5.6 5.6-7.5 7.5-5.6-5.6z"/><path d="M5.3 13.2c-1.5 1.2-1.7 3.3-.5 4.7 1.4 1.2 3.5 1 4.7-.5"/><path d="m12.3 17.3-2.8.1"/>`,
  bookmark: `<path d="M6.4 4.2h11.2v16l-5.6-3.5-5.6 3.5z"/><path d="M9.2 7.7h5.6"/>`,
  check: `<path d="M20 6 9 17l-5-5"/>`,
  sparkle: `<path d="m12 3.6 1.7 4.9 4.9 1.7-4.9 1.7-1.7 4.9-1.7-4.9-4.9-1.7 4.9-1.7z"/><path d="m18.8 16.8.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>`
};

document.addEventListener("DOMContentLoaded", () => {
  injectHeader();
  injectFooter();
  initIcons();
  initMobileNav();
  initBookcases();
  initHeaderBuilderActions();
  initAccordions();
  initQuoteForm();
});

function injectHeader() {
  const host = document.querySelector("[data-site-header]");
  if (!host) return;

  const current = document.body.dataset.page || "home";
  const links = navItems.map((item) => {
    const active = item.page === current ? " is-active" : "";
    const currentAttribute = item.page === current ? ' aria-current="page"' : "";
    return `<a class="nav-link${active}" href="${item.href}"${currentAttribute}>${item.label}</a>`;
  }).join("");

  const headerActions = current === "configurator"
    ? `
          <button class="header-save-button" type="button" data-header-save-design><i data-icon="bookmark" aria-hidden="true"></i><span>Save Design</span></button>
          <button class="button button-primary" type="button" data-header-request-quote>Request a Quote</button>
        `
    : `
          <a class="header-save-button" href="${designBuilderHref}"><i data-icon="grid" aria-hidden="true"></i><span>Design Your Bookcase</span></a>
          <a class="button button-primary${current === "quote" ? " is-active" : ""}" href="request-quote.html"${current === "quote" ? ' aria-current="page"' : ""}>Request a Quote</a>
        `;

  const mobileCta = current === "configurator"
    ? `<button class="button button-primary mobile-cta" type="button" data-header-request-quote>Request a Quote</button>`
    : `<a class="mobile-design-link" href="configurator.html">Design Your Bookcase</a><a class="button button-primary mobile-cta" href="request-quote.html">Request a Quote</a>`;

  host.innerHTML = `
    <header class="site-header">
      <nav class="navbar" aria-label="Primary navigation">
        ${renderBrandLink()}
        <div class="nav-links" id="primary-navigation">
          ${links}
          ${mobileCta}
        </div>
        <div class="header-actions">
          ${headerActions}
          <button class="nav-toggle" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="primary-navigation">
            <span></span><span></span><span></span>
          </button>
        </div>
      </nav>
    </header>
  `;
}

function initHeaderBuilderActions() {
  document.querySelectorAll("[data-header-save-design]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelector("[data-bookcase-builder] [data-save-design]")?.click();
    });
  });

  document.querySelectorAll("[data-header-request-quote]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelector("[data-bookcase-builder] [data-open-order]")?.click();
      document.body.classList.remove("nav-open");
      const navToggle = document.querySelector(".nav-toggle");
      navToggle?.setAttribute("aria-expanded", "false");
      navToggle?.setAttribute("aria-label", "Open navigation");
    });
  });
}

function injectFooter() {
  const host = document.querySelector("[data-site-footer]");
  if (!host) return;

  host.innerHTML = `
    <footer class="site-footer">
      <div class="footer-grid">
        <div>
          ${renderBrandLink("footer-brand")}
          <p>Premium built-ins, expertly crafted for your home.</p>
          <a class="footer-design-link" href="configurator.html"><i data-icon="grid" aria-hidden="true"></i> Open the ${officialBrand.product}</a>
        </div>
        <div>
          <h3>Explore</h3>
          <ul class="footer-list">
            <li><a href="how-it-works.html">How It Works</a></li>
            <li><a href="materials.html">Materials</a></li>
            <li><a href="inspiration.html">Inspiration</a></li>
            <li><a href="about.html">About Us</a></li>
          </ul>
        </div>
        <div>
          <h3>Plan Your Project</h3>
          <ul class="footer-list">
            <li><a href="configurator.html">Design Your Bookcase</a></li>
            <li><a href="request-quote.html">Request a Quote</a></li>
            <li><a href="faq.html">FAQ</a></li>
            <li><a href="faq.html#faq-6">Delivery &amp; Installation</a></li>
          </ul>
        </div>
        <div class="footer-project-card">
          <span class="section-kicker">Ready when you are</span>
          <h3>Start with a layout. Finish with a measured plan.</h3>
          <div class="footer-project-actions">
            <a class="button button-primary" href="configurator.html">Design Your Bookcase</a>
            <a class="text-link" href="request-quote.html">Request a Quote <span aria-hidden="true">&rarr;</span></a>
          </div>
        </div>
        <div class="footer-benefits" aria-label="Project benefits">
          <span><i data-icon="truck"></i>Delivery Standard</span>
          <span><i data-icon="wrench"></i>Installation Professional</span>
          <span><i data-icon="shield"></i>Warranty Lifetime</span>
        </div>
      </div>
      <div class="footer-bottom">
        <span>&copy; 2026 JQ Bookcases. All rights reserved.</span>
        <span class="footer-bottom-links">
          <a href="privacy.html">Privacy Policy</a>
          <a href="terms.html">Terms of Service</a>
        </span>
      </div>
    </footer>
  `;
}

function initIcons() {
  document.querySelectorAll("[data-icon]").forEach((el) => {
    const name = el.dataset.icon;
    const paths = iconMap[name] || iconMap.sparkle;
    el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
  });
}

function initMobileNav() {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector("#primary-navigation");
  if (!toggle || !nav) return;

  const setOpen = (open, restoreFocus = true) => {
    document.body.classList.toggle("nav-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    if (open) window.requestAnimationFrame(() => nav.querySelector("a, button")?.focus());
    else if (restoreFocus) toggle.focus();
  };

  toggle.addEventListener("click", () => {
    setOpen(!document.body.classList.contains("nav-open"));
  });

  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) setOpen(false, false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });
}

function initBookcases() {
  document.querySelectorAll("[data-bookcase]").forEach((host) => {
    renderBookcase(host, datasetToState(host.dataset));
  });
}

function datasetToState(dataset) {
  return {
    width: Number(dataset.width) || 96,
    height: Number(dataset.height) || 96,
    depth: Number(dataset.depth) || 15,
    sections: Number(dataset.sections) || 3,
    shelves: Number(dataset.shelves) || 4,
    lowerCabinets: dataset.lower !== "false",
    doors: Number(dataset.doors) || 6,
    finish: normalizePaintFinish(dataset.finish || "white-dove"),
    hardware: dataset.hardware || "brushed-brass"
  };
}

function renderBookcase(host, state) {
  const sections = clampInt(state.sections, 1, 6);
  const shelves = clampInt(state.shelves, 1, 6);
  const doors = clampInt(state.doors, 2, 8);
  const lowerCabinets = state.lowerCabinets !== false && state.lowerCabinets !== "false";
  const finish = normalizePaintFinish(state.finish || "white-dove");
  const hardware = state.hardware || "brushed-brass";
  const width = clampInt(state.width || 96, 48, 180);
  const height = clampInt(state.height || 96, 72, 120);
  const ratio = clampNumber(width / height, 0.62, 1.55).toFixed(2);

  const bayHtml = Array.from({ length: sections }, () => {
    const cells = Array.from({ length: shelves }, () => `<div class="shelf-cell"></div>`).join("");
    return `<div class="case-bay" style="--shelf-count:${shelves}">${cells}</div>`;
  }).join("");

  const doorHtml = Array.from({ length: doors }, () => `<div class="case-door"></div>`).join("");

  host.innerHTML = `
    <div class="bookcase" data-finish="${finish}" data-hardware="${hardware}" style="--case-ratio:${ratio}" aria-label="${sections} section built-in bookcase preview">
      <div class="case-crown"></div>
      <div class="case-shelves" style="grid-template-columns:repeat(${sections}, minmax(0, 1fr));">${bayHtml}</div>
      <div class="case-lower${lowerCabinets ? "" : " is-off"}" style="grid-template-columns:repeat(${doors}, minmax(0, 1fr));">${doorHtml}</div>
      <div class="case-base"></div>
    </div>
  `;
}

function normalizePaintFinish(value) {
  const legacyMap = {
    alabaster: "white-dove",
    "warm-white": "swiss-coffee",
    black: "revere-pewter",
    "natural-oak": "revere-pewter",
    walnut: "revere-pewter"
  };
  return legacyMap[value] || value;
}

function initAccordions() {
  document.querySelectorAll("[data-accordion]").forEach((accordion) => {
    accordion.querySelectorAll("[data-accordion-trigger]").forEach((trigger) => {
      const panel = document.getElementById(trigger.getAttribute("aria-controls"));
      const icon = trigger.querySelector(".accordion-icon");
      if (icon) icon.setAttribute("aria-hidden", "true");
      if (panel) panel.hidden = trigger.getAttribute("aria-expanded") !== "true";
      trigger.addEventListener("click", () => {
        const isOpen = trigger.getAttribute("aria-expanded") === "true";
        accordion.querySelectorAll("[data-accordion-trigger]").forEach((otherTrigger) => {
          if (otherTrigger === trigger) return;
          otherTrigger.setAttribute("aria-expanded", "false");
          const otherPanel = document.getElementById(otherTrigger.getAttribute("aria-controls"));
          otherPanel?.classList.remove("is-open");
          if (otherPanel) otherPanel.hidden = true;
          otherTrigger.closest(".accordion-item")?.classList.remove("is-open");
        });
        trigger.setAttribute("aria-expanded", String(!isOpen));
        if (panel) {
          panel.classList.toggle("is-open", !isOpen);
          panel.hidden = isOpen;
        }
        trigger.closest(".accordion-item")?.classList.toggle("is-open", !isOpen);
      });
    });
  });
}

function initQuoteForm() {
  const form = document.querySelector("[data-quote-form]");
  if (!form) return;

  const status = form.querySelector("[data-quote-status]");
  const finishSelect = form.querySelector("[data-quote-finish]");
  const customField = form.querySelector("[data-custom-bm-quote]");
  const savedSummary = form.querySelector("[data-saved-design-summary]");
  const photoInput = document.querySelector('input[type="file"][form="quote-request-form"], [data-quote-form] input[type="file"]');
  const photoStatus = form.querySelector("[data-upload-status]");
  const storedDesign = getStoredDesign();
  const requestedDesignId = new URLSearchParams(window.location.search).get("design");
  const activeDesignId = requestedDesignId || storedDesign?.id || "";

  if (activeDesignId && savedSummary) {
    const matchingStoredDesign = storedDesign?.id === activeDesignId ? storedDesign : null;
    const config = matchingStoredDesign?.canonicalConfig || matchingStoredDesign?.config || matchingStoredDesign?.state || {};
    const designDetails = [formatStoredPrice(matchingStoredDesign?.total ?? matchingStoredDesign?.price), formatPresetLabel(config.layoutPreset)].filter(Boolean).map(escapeHtml).join(" &middot; ");
    savedSummary.hidden = false;
    savedSummary.innerHTML = `<span>Saved design</span><strong>${escapeHtml(activeDesignId)}</strong><small>${designDetails}</small>`;
    setFormValue(form, "designId", activeDesignId);
    setFormValue(form, "wallWidth", config.width ? `${config.width}\"` : "");
    setFormValue(form, "ceilingHeight", config.height ? `${config.height}\"` : "");
    setFormValue(form, "bookcaseHeight", config.height ? `${config.height}\"` : "");
    setFormValue(form, "depth", config.depth ? `${config.depth}\"` : "");
    setFormValue(form, "layout", config.layoutPreset || "");
    setFormValue(form, "paintFinish", config.finish || "");
  }

  const syncCustomPaint = () => {
    if (!finishSelect || !customField) return;
    const customSelected = finishSelect.value === "custom_bm";
    customField.hidden = !customSelected;
    customField.querySelector("input")?.toggleAttribute("required", customSelected);
  };

  finishSelect?.addEventListener("change", syncCustomPaint);
  syncCustomPaint();

  photoInput?.addEventListener("change", () => {
    if (!photoStatus) return;
    const count = photoInput.files?.length || 0;
    photoStatus.textContent = count ? `${count} file${count === 1 ? "" : "s"} selected` : "JPG, PNG, HEIC, or PDF";
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const draft = {};
    new FormData(form).forEach((value, key) => {
      const cleanValue = value instanceof File ? value.name : value;
      if (draft[key]) draft[key] = Array.isArray(draft[key]) ? [...draft[key], cleanValue] : [draft[key], cleanValue];
      else draft[key] = cleanValue;
    });
    try {
      localStorage.setItem("jqBookcasesQuoteDraft", JSON.stringify({ savedAt: new Date().toISOString(), fields: draft }));
    } catch (error) {
      // The confirmation remains useful when browser storage is unavailable.
    }
    showStatus(status, "Your project brief is complete and saved in this browser. This local preview does not transmit personal information.");
    status?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function setFormValue(form, name, value) {
  if (!value) return;
  const field = form.elements.namedItem(name);
  if (!field || field instanceof RadioNodeList) return;
  if (field instanceof HTMLSelectElement && ![...field.options].some((option) => option.value === String(value))) return;
  field.value = value;
}

function formatStoredPrice(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? `${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount)} estimate` : "";
}

function formatPresetLabel(value) {
  if (!value) return "Custom layout";
  return String(value).split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;" })[character]);
}

function getStoredDesign() {
  try {
    return JSON.parse(localStorage.getItem("jqBookcasesDesign") || "null");
  } catch (error) {
    return null;
  }
}

function showStatus(el, message) {
  if (!el) return;
  el.textContent = message;
  el.classList.add("is-visible");
}

function clampInt(value, min, max) {
  return Math.min(max, Math.max(min, Math.round(Number(value) || min)));
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || min));
}
