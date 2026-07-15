import { mountIcons, setIcon } from "./icon-system.js?v=direct-hardware-20260714a";

const navItems = [
  { label: "How It Works", href: "how-it-works.html", page: "how" },
  { label: "Materials", href: "materials.html", page: "materials" },
  { label: "Inspiration", href: "inspiration.html", page: "inspiration" },
  { label: "About Us", href: "about.html", page: "about" },
  { label: "FAQ", href: "faq.html", page: "faq" }
];

const designBuilderHref = "configurator.html?start=resume";
const officialBrand = Object.freeze({
  shortName: "JQ Bookcases",
  initials: "JQ",
  name: "BOOKCASES",
  descriptor: "BUILT-INS & MILLWORK",
  product: "3D Bookcase Configurator"
});

function renderBrandLink(modifierClass = "brand--header") {
  return `
    <a class="brand ${modifierClass}" href="index.html" aria-label="${officialBrand.shortName} home">
      <span class="brand-mark" aria-hidden="true">${officialBrand.initials}</span>
      <span class="brand-copy" aria-hidden="true">
        <span class="brand-main">${officialBrand.name}</span>
        <span class="brand-sub">${officialBrand.descriptor}</span>
      </span>
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
  initFaqSearch();
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
          <button class="header-save-button" type="button" data-header-save-design aria-label="Save Design"><span>Save Design</span><i data-icon="save" aria-hidden="true"></i></button>
          <button class="button button-primary" type="button" data-header-request-quote>Request Quote</button>
        `
    : `
          <a class="header-save-button" href="${designBuilderHref}" aria-label="Design Your Bookcase"><span>Design Your Bookcase</span><i data-icon="camera-orbit" aria-hidden="true"></i></a>
          <a class="button button-primary${current === "quote" ? " is-active" : ""}" href="request-quote.html"${current === "quote" ? ' aria-current="page"' : ""}>Request Quote</a>
        `;

  const mobileCta = current === "configurator"
    ? `<button class="button button-primary mobile-cta" type="button" data-header-request-quote>Request Quote</button>`
    : `<a class="mobile-design-link" href="${designBuilderHref}">Design Your Bookcase</a><a class="button button-primary mobile-cta" href="request-quote.html">Request Quote</a>`;

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
          <a class="footer-design-link" href="configurator.html?start=welcome"><i data-icon="camera-orbit" aria-hidden="true"></i> Open the ${officialBrand.product}</a>
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
            <li><a href="configurator.html?start=welcome">Design Your Bookcase</a></li>
            <li><a href="request-quote.html">Request a Quote</a></li>
            <li><a href="faq.html">FAQ</a></li>
            <li><a href="faq.html#faq-6">Delivery &amp; Installation</a></li>
          </ul>
        </div>
        <div class="footer-project-card">
          <span class="section-kicker">Ready when you are</span>
          <h3>Start with a layout. Finish with a measured plan.</h3>
          <div class="footer-project-actions">
            <a class="button button-primary" href="configurator.html?start=welcome">Design Your Bookcase</a>
            <a class="text-link" href="request-quote.html">Request a Quote <i class="utility-icon" data-icon="arrow-right" aria-hidden="true"></i></a>
          </div>
        </div>
        <div class="footer-benefits" aria-label="Project benefits">
          <span><i data-icon="standard-delivery" aria-hidden="true"></i>Standard Delivery</span>
          <span><i data-icon="professional-installation" aria-hidden="true"></i>Professional Installation</span>
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

function initMobileNav() {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector("#primary-navigation");
  if (!toggle || !nav) return;

  const mobileNavigationQuery = window.matchMedia("(max-width: 900px)");
  const backgroundTargets = [
    document.querySelector(".skip-link"),
    document.querySelector("main"),
    document.querySelector("[data-site-footer]"),
    document.querySelector(".brand--header")
  ].filter(Boolean);
  const originalInertState = new Map();
  const focusableSelector = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])"
  ].join(",");

  const isOpen = () => document.body.classList.contains("nav-open");
  const setBackgroundInert = (inert) => {
    backgroundTargets.forEach((element) => {
      if (inert) {
        if (!originalInertState.has(element)) originalInertState.set(element, element.inert);
        element.inert = true;
      } else if (originalInertState.has(element)) {
        element.inert = originalInertState.get(element);
        originalInertState.delete(element);
      }
    });
  };
  const menuFocusables = () => [...nav.querySelectorAll(focusableSelector), toggle]
    .filter((element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden");

  const setOpen = (open, restoreFocus = true) => {
    const shouldOpen = Boolean(open && mobileNavigationQuery.matches);
    document.body.classList.toggle("nav-open", shouldOpen);
    toggle.setAttribute("aria-expanded", String(shouldOpen));
    toggle.setAttribute("aria-label", shouldOpen ? "Close navigation" : "Open navigation");
    const toggleIcon = toggle.querySelector("[data-icon]");
    if (toggleIcon) setIcon(toggleIcon, shouldOpen ? "close" : "menu");
    nav.inert = mobileNavigationQuery.matches && !shouldOpen;
    setBackgroundInert(shouldOpen);
    if (shouldOpen) window.requestAnimationFrame(() => nav.querySelector(focusableSelector)?.focus());
    else if (restoreFocus && mobileNavigationQuery.matches) toggle.focus();
  };

  const syncViewportState = () => {
    if (mobileNavigationQuery.matches) {
      nav.inert = !isOpen();
      return;
    }
    setOpen(false, false);
    nav.inert = false;
  };

  toggle.addEventListener("click", () => {
    setOpen(!isOpen());
  });

  nav.addEventListener("click", (event) => {
    if (event.target.closest("a, [data-header-request-quote]")) setOpen(false, false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!isOpen()) return;
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key !== "Tab" || !isOpen()) return;

    const focusables = menuFocusables();
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables.at(-1);
    const active = document.activeElement;
    if (!focusables.includes(active)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  });

  if (typeof mobileNavigationQuery.addEventListener === "function") {
    mobileNavigationQuery.addEventListener("change", syncViewportState);
  } else {
    mobileNavigationQuery.addListener(syncViewportState);
  }
  window.addEventListener("orientationchange", () => {
    if (isOpen()) setOpen(false, false);
  });
  syncViewportState();
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
    <div class="bookcase" data-finish="${finish}" data-hardware="${hardware}" style="--case-ratio:${ratio}" role="img" aria-label="${sections} section built-in bookcase preview">
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

    let linkedPanel = null;
    try {
      linkedPanel = window.location.hash ? document.getElementById(decodeURIComponent(window.location.hash.slice(1))) : null;
    } catch (error) {
      // A malformed fragment must not prevent the rest of the page from initializing.
    }
    if (linkedPanel && accordion.contains(linkedPanel)) {
      const linkedTrigger = [...accordion.querySelectorAll("[data-accordion-trigger]")]
        .find((trigger) => trigger.getAttribute("aria-controls") === linkedPanel.id);
      if (linkedTrigger?.getAttribute("aria-expanded") !== "true") linkedTrigger?.click();
      window.requestAnimationFrame(() => linkedTrigger?.scrollIntoView({ block: "start" }));
    }
  });
}

function initFaqSearch() {
  const tools = document.querySelector("[data-faq-tools]");
  const list = document.querySelector("[data-faq-list]");
  if (!tools || !list) return;

  const search = tools.querySelector("[data-faq-search]");
  const filters = Array.from(tools.querySelectorAll("[data-faq-filter]"));
  const items = Array.from(list.querySelectorAll(".accordion-item"));
  const resultCount = tools.querySelector("[data-faq-result-count]");
  const emptyState = document.querySelector("[data-faq-empty]");
  let activeCategory = "all";

  const normalize = (value) => value.trim().toLocaleLowerCase();
  const applyFilters = () => {
    const query = normalize(search?.value || "");
    let visibleCount = 0;

    items.forEach((item) => {
      const matchesCategory = activeCategory === "all" || item.dataset.faqCategory === activeCategory;
      const matchesSearch = !query || normalize(item.textContent || "").includes(query);
      const visible = matchesCategory && matchesSearch;
      item.hidden = !visible;
      if (visible) visibleCount += 1;
    });

    if (resultCount) {
      const scope = activeCategory === "all" && !query ? "all " : "";
      resultCount.textContent = visibleCount === 1
        ? "Showing 1 question"
        : `Showing ${scope}${visibleCount} questions`;
    }
    if (emptyState) emptyState.hidden = visibleCount !== 0;
  };

  filters.forEach((filter) => {
    filter.addEventListener("click", () => {
      activeCategory = filter.dataset.faqFilter || "all";
      filters.forEach((button) => button.setAttribute("aria-pressed", String(button === filter)));
      applyFilters();
    });
  });

  search?.addEventListener("input", applyFilters);
  search?.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !search.value) return;
    search.value = "";
    applyFilters();
  });
}

async function initQuoteForm() {
  const form = document.querySelector("[data-quote-form]");
  const interactiveFields = form?.querySelector("[data-quote-fields]");
  if (!form || !interactiveFields) return;
  interactiveFields.inert = false;

  const status = form.querySelector("[data-quote-status]");
  const finishSelect = form.querySelector("[data-quote-finish]");
  const customField = form.querySelector("[data-custom-bm-quote]");
  const savedSummary = form.querySelector("[data-saved-design-summary]");
  const photoInput = document.querySelector('input[type="file"][form="quote-request-form"], [data-quote-form] input[type="file"]');
  const photoStatus = document.querySelector("[data-upload-status]");
  const submitButton = form.querySelector("[data-quote-submit]");
  const storedDesign = getStoredDesign();
  const requestedDesignId = new URLSearchParams(window.location.search).get("design");

  let acceptedStoredDesign = null;
  if (
    storedDesign &&
    [2, 3, 4, 5].includes(Number(storedDesign.schemaVersion)) &&
    typeof storedDesign.id === "string" &&
    /^JQ-[A-Z0-9-]{5,20}$/.test(storedDesign.id)
  ) {
    try {
      const { restoreAcceptedDesignSnapshot } = await import("./bookcase-engine.js?v=direct-hardware-20260714a");
      const restored = restoreAcceptedDesignSnapshot(storedDesign);
      if (restored.accepted && restored.compatible) acceptedStoredDesign = { snapshot: storedDesign, restored };
    } catch (error) {
      // Corrupt, stale, or unavailable saved data is treated as absent.
    }
  }

  const activeStoredDesign = acceptedStoredDesign && (!requestedDesignId || requestedDesignId === acceptedStoredDesign.snapshot.id)
    ? acceptedStoredDesign
    : null;

  if (requestedDesignId && !activeStoredDesign) {
    showStatus(status, "That saved design is not available in this browser. Return to the configurator and save the design again.");
  }

  if (activeStoredDesign && savedSummary) {
    try {
      const [{ createQuotePrefill }, { BENJAMIN_MOORE_COLOR_DATA_NOTICE }] = await Promise.all([
        import("./quote-prefill.js?v=direct-hardware-20260714a"),
        import("./benjamin-moore-colors.js?v=direct-hardware-20260714a")
      ]);
      const activeDesignId = activeStoredDesign.snapshot.id;
      const config = activeStoredDesign.restored.state;
      const quotePrefill = createQuotePrefill(config);
      const doorFrontSummary = quotePrefill.frontProfiles?.door?.styles?.length
        ? quotePrefill.frontProfiles.door.styles
            .map((profile) => `${profile.count} ${profile.label}`)
            .join(" + ")
        : quotePrefill.frontProfiles?.door?.label || "";
      const designDetails = [
        formatStoredPrice(quotePrefill.price),
        quotePrefill.layoutLabel || "Custom layout",
        doorFrontSummary ? `Door fronts: ${doorFrontSummary}` : "",
        quotePrefill.frontProfiles?.drawer?.label ? `Drawer fronts: ${quotePrefill.frontProfiles.drawer.label}` : "",
        quotePrefill.hardwareSelection?.label ? `Hardware: ${quotePrefill.hardwareSelection.label}` : ""
      ].filter(Boolean).map(escapeHtml).join(" &middot; ");
      const hardwareSchedule = renderQuoteHardwareSchedule(quotePrefill.hardwareSchedule);
      savedSummary.hidden = false;
      savedSummary.innerHTML = `<span>Saved design</span><strong>${escapeHtml(activeDesignId)}</strong><small>${designDetails}</small>${hardwareSchedule}`;
      if (quotePrefill.customPaint) {
        const paintNotice = document.createElement("p");
        paintNotice.className = "quote-paint-disclaimer";
        paintNotice.textContent = BENJAMIN_MOORE_COLOR_DATA_NOTICE;
        savedSummary.insertAdjacentElement("afterend", paintNotice);
      }
      setFormValue(form, "designId", activeDesignId);
      Object.entries(quotePrefill.fields).forEach(([name, value]) => setFormValue(form, name, value));
      quotePrefill.options.forEach((value) => setFormCheckbox(form, "options", value));
    } catch (error) {
      showStatus(status, "Your saved design could not be prepared for this form. Return to the configurator and save it again.");
    }
  }

  const syncCustomPaint = () => {
    if (!finishSelect || !customField) return;
    const customSelected = finishSelect.value === "custom_bm";
    customField.hidden = !customSelected;
    customField.querySelector("input")?.toggleAttribute("required", customSelected);
  };

  finishSelect?.addEventListener("change", syncCustomPaint);
  syncCustomPaint();

  if (photoInput) photoInput.disabled = false;
  photoInput?.addEventListener("change", () => {
    if (!photoStatus) return;
    const count = photoInput.files?.length || 0;
    photoStatus.textContent = count ? `${count} file${count === 1 ? "" : "s"} selected` : "JPG, PNG, HEIC, or PDF";
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    showStatus(status, "Your project brief is complete in this local preview. No personal information was transmitted.");
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    status?.scrollIntoView({ behavior, block: "center" });
  });
  if (submitButton) submitButton.disabled = false;
}

function setFormValue(form, name, value) {
  if (!value) return;
  const field = form.elements.namedItem(name);
  if (!field || field instanceof RadioNodeList) return;
  if (field instanceof HTMLSelectElement && ![...field.options].some((option) => option.value === String(value))) return;
  field.value = value;
}

function setFormCheckbox(form, name, value) {
  const field = [...form.querySelectorAll(`input[type="checkbox"][name="${name}"]`)]
    .find((input) => input.value === String(value));
  if (field) field.checked = true;
}

function formatStoredPrice(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? `${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount)} estimate` : "";
}

function renderQuoteHardwareSchedule(schedule) {
  if (!Array.isArray(schedule) || !schedule.length) return "";
  const total = schedule.reduce((sum, entry) => sum + (Number(entry?.quantity) || 0), 0);
  const rows = schedule.map((entry) => {
    const identity = [entry.brand, entry.family].filter(Boolean).join(" · ") || entry.variantId || "Catalog hardware";
    const specification = [
      entry.size,
      entry.finish && `${entry.finish}${entry.finishCode ? ` (${entry.finishCode})` : ""}`,
      entry.manufacturerProductNumber || entry.sku
    ].filter(Boolean).join(" · ");
    const locations = (entry.locations || []).map((location) => location.sectionId || location.hostId).filter(Boolean).join(", ");
    const placement = formatQuoteHardwarePlacement(entry.placement);
    const verification = [entry.modelAccuracy, entry.catalogVersion, entry.verifiedAt && `verified ${entry.verifiedAt}`]
      .filter(Boolean).join(" · ");
    const warnings = (entry.warnings || []).map((warning) => typeof warning === "string" ? warning : warning?.message || warning?.code).filter(Boolean);
    const links = [...new Map((entry.links || []).map((link) => [link?.url, link])).values()]
      .map((link) => {
        const url = safeExternalUrl(link?.url);
        return url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.title || "Official product/specification source")}</a>` : "";
      }).filter(Boolean).join("");
    return `<li><div><strong>${Number(entry.quantity) || 0} × ${escapeHtml(identity)}</strong><small>${escapeHtml(specification || "Exact variant " + (entry.variantId || "not stated"))}</small><small>Exact variant: ${escapeHtml(entry.variantId || "not stated")}</small>${locations ? `<small>Location: ${escapeHtml(locations)}</small>` : ""}${placement ? `<small>Placement: ${escapeHtml(placement)}</small>` : ""}${verification ? `<small>Model/catalog: ${escapeHtml(verification)}</small>` : ""}${warnings.length ? `<small>Review: ${escapeHtml(warnings.join(" · "))}</small>` : ""}</div>${links ? `<nav aria-label="Official hardware sources">${links}</nav>` : ""}</li>`;
  }).join("");
  return `<details class="quote-hardware-schedule"><summary>Hardware schedule · ${total} piece${total === 1 ? "" : "s"}</summary><ul>${rows}</ul></details>`;
}

function formatQuoteHardwarePlacement(placement) {
  if (!placement || typeof placement !== "object") return "";
  return [
    placement.orientation,
    placement.horizontalAnchor,
    placement.verticalAnchor,
    Number.isFinite(placement.edgeOffsetMm) ? `${placement.edgeOffsetMm} mm edge offset` : null,
    Number.isFinite(placement.crossAxisOffsetMm) ? `${placement.crossAxisOffsetMm} mm cross-axis offset` : null,
    placement.quantityPerFront ? `${placement.quantityPerFront} per front` : null,
    placement.mirrored ? "mirrored" : null
  ].filter(Boolean).join(" · ");
}

function safeExternalUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch (error) {
    return "";
  }
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
