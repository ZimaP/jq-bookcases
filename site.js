import { mountIcons, setIcon } from "./icon-system.js?v=site-system-20260711b";

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

document.addEventListener("DOMContentLoaded", () => {
  injectHeader();
  injectFooter();
  mountIcons();
  initHeaderScrollState();
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
          <button class="header-save-button" type="button" data-header-save-design><span>Save Design</span><i data-icon="heart" aria-hidden="true"></i></button>
          <button class="button button-primary" type="button" data-header-request-quote>Request Quote</button>
        `
    : `
          <a class="header-save-button" href="${designBuilderHref}"><span>Save Design</span><i data-icon="heart" aria-hidden="true"></i></a>
          <a class="button button-primary${current === "quote" ? " is-active" : ""}" href="request-quote.html"${current === "quote" ? ' aria-current="page"' : ""}>Request Quote</a>
        `;

  const mobileCta = current === "configurator"
    ? `<button class="button button-primary mobile-cta" type="button" data-header-request-quote>Request Quote</button>`
    : `<a class="mobile-design-link" href="configurator.html">Save Design</a><a class="button button-primary mobile-cta" href="request-quote.html">Request Quote</a>`;

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
            <i data-icon="menu" aria-hidden="true"></i>
          </button>
        </div>
      </nav>
    </header>
  `;
}

function initHeaderScrollState() {
  const header = document.querySelector(".site-header");
  if (!header || document.body.dataset.page === "home") return;

  const update = () => header.classList.toggle("is-scrolled", window.scrollY > 12);
  update();
  window.addEventListener("scroll", update, { passive: true });
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
      const navIcon = navToggle?.querySelector("[data-icon]");
      if (navIcon) setIcon(navIcon, "menu");
    });
  });
}

function injectFooter() {
  const host = document.querySelector("[data-site-footer]");
  if (!host) return;

  if (host.dataset.footerVariant === "reference") {
    host.innerHTML = renderReferenceFooter(document.body.dataset.page || "");
    return;
  }

  host.innerHTML = `
    <footer class="site-footer">
      <div class="footer-grid">
        <div>
          ${renderBrandLink("footer-brand")}
          <p>Premium built-ins, expertly crafted for your home.</p>
          <a class="footer-design-link" href="configurator.html"><i data-icon="configurator-3d" aria-hidden="true"></i> Open the ${officialBrand.product}</a>
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
            <a class="text-link" href="request-quote.html">Request a Quote <i class="utility-icon" data-icon="arrow-right" aria-hidden="true"></i></a>
          </div>
        </div>
        <div class="footer-benefits" aria-label="Project benefits">
          <span><i data-icon="delivery" aria-hidden="true"></i>Delivery Standard</span>
          <span><i data-icon="tools" aria-hidden="true"></i>Installation Professional</span>
          <span><i data-icon="warranty" aria-hidden="true"></i>Warranty Lifetime</span>
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

function renderReferenceFooter(page) {
  const brandCopy = page === "materials"
    ? "Premium semi-custom built-ins, expertly crafted for your home."
    : page === "about"
      ? "Premium semi-custom built-ins, crafted for your home."
      : "Premium built-ins, crafted for your home.";
  const materialsTrust = page === "materials"
    ? `
      <div class="ref-footer-trust" aria-label="Project assurances">
        <span><i data-icon="delivery" aria-hidden="true"></i>Delivery Standard</span>
        <span><i data-icon="tools" aria-hidden="true"></i>Installation Professional</span>
        <span><i data-icon="warranty" aria-hidden="true"></i>Warranty Lifetime</span>
      </div>
    `
    : "";

  return `
    <footer class="ref-site-footer">
      <div class="ref-footer-inner">
        <div class="ref-footer-brand-column">
          ${renderBrandLink("ref-footer-brand")}
          <p>${brandCopy}</p>
          <div class="ref-footer-social" aria-label="Social channels">
            <span data-icon="instagram" role="img" aria-label="Instagram"></span>
            <span data-icon="pinterest" role="img" aria-label="Pinterest"></span>
            <span data-icon="houzz" role="img" aria-label="Houzz"></span>
          </div>
        </div>
        <div class="ref-footer-column">
          <h3>Company</h3>
          <ul>
            <li><a href="about.html">About Us</a></li>
            <li><a href="how-it-works.html">Our Process</a></li>
            <li><a href="materials.html">Materials &amp; Quality</a></li>
            <li><a href="faq.html">Care &amp; Warranty</a></li>
          </ul>
        </div>
        <div class="ref-footer-column">
          <h3>Support</h3>
          <ul>
            <li><a href="faq.html">FAQ</a></li>
            <li><a href="request-quote.html">Design Help</a></li>
            <li><a href="faq.html#faq-6">Delivery &amp; Installation</a></li>
            <li><a href="request-quote.html">Contact Us</a></li>
          </ul>
        </div>
        <div class="ref-footer-interest">
          <h3>Design ideas &amp; inspiration</h3>
          <p>Talk with our team about ideas, materials, and your project.</p>
          <a class="ref-footer-contact" href="request-quote.html"><span>Contact us</span><i data-icon="arrow-right" aria-hidden="true"></i></a>
        </div>
        ${materialsTrust}
      </div>
      <div class="ref-footer-bottom">
        <span>&copy; 2024 JQ Bookcases. All rights reserved.</span>
        <span><a href="privacy.html">Privacy Policy</a><i aria-hidden="true"></i><a href="terms.html">Terms of Service</a></span>
      </div>
    </footer>
  `;
}

function initMobileNav() {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector("#primary-navigation");
  if (!toggle || !nav) return;

  const setOpen = (open, restoreFocus = true) => {
    document.body.classList.toggle("nav-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    const toggleIcon = toggle.querySelector("[data-icon]");
    if (toggleIcon) setIcon(toggleIcon, open ? "close" : "menu");
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
      if (icon) {
        icon.setAttribute("aria-hidden", "true");
        setIcon(icon, trigger.getAttribute("aria-expanded") === "true" ? "minus" : "plus");
      }
      if (panel) panel.hidden = trigger.getAttribute("aria-expanded") !== "true";
      trigger.addEventListener("click", () => {
        const isOpen = trigger.getAttribute("aria-expanded") === "true";
        accordion.querySelectorAll("[data-accordion-trigger]").forEach((otherTrigger) => {
          if (otherTrigger === trigger) return;
          otherTrigger.setAttribute("aria-expanded", "false");
          const otherIcon = otherTrigger.querySelector(".accordion-icon");
          if (otherIcon) setIcon(otherIcon, "plus");
          const otherPanel = document.getElementById(otherTrigger.getAttribute("aria-controls"));
          otherPanel?.classList.remove("is-open");
          if (otherPanel) otherPanel.hidden = true;
          otherTrigger.closest(".accordion-item")?.classList.remove("is-open");
        });
        trigger.setAttribute("aria-expanded", String(!isOpen));
        if (icon) setIcon(icon, isOpen ? "plus" : "minus");
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
    const config = matchingStoredDesign?.config || matchingStoredDesign?.state || {};
    const designDetails = [formatStoredPrice(matchingStoredDesign?.price), formatPresetLabel(config.layoutPreset)].filter(Boolean).map(escapeHtml).join(" &middot; ");
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
