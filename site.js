const navItems = [
  { label: "How It Works", href: "how-it-works.html", page: "how" },
  { label: "Materials", href: "materials.html", page: "materials" },
  { label: "Inspiration", href: "inspiration.html", page: "inspiration" },
  { label: "About Us", href: "about.html", page: "about" },
  { label: "FAQ", href: "faq.html", page: "faq" }
];

const designBuilderHref = "index.html#design-builder";

const iconMap = {
  shield: `<path d="M12 3.6 18.7 6v5.2c0 4.5-2.8 7.7-6.7 9.2-3.9-1.5-6.7-4.7-6.7-9.2V6L12 3.6z"/><path d="m8.8 12.1 2.1 2.1 4.4-4.6"/>`,
  leaf: `<path d="M19.4 4.6c-6.6.7-11.5 4.2-12.6 10.8 4.9 1.2 9.4-1 11.9-6.3 1-2.1 1.2-3.6.7-4.5z"/><path d="M5.2 19.6c2.6-5.8 6.6-9.2 12.8-11.7"/>`,
  truck: `<path d="M3.8 7.1h9.5v8.2H3.8z"/><path d="M13.3 10h3.6l3 3v2.3h-6.6z"/><path d="M5.8 17.2a1.8 1.8 0 1 0 3.6 0 1.8 1.8 0 0 0-3.6 0z"/><path d="M15.5 17.2a1.8 1.8 0 1 0 3.6 0 1.8 1.8 0 0 0-3.6 0z"/><path d="M3.8 15.3h2"/><path d="M9.4 15.3h6.1"/>`,
  home: `<path d="m4 11 8-6.8 8 6.8"/><path d="M6.5 10.2v9.2h11v-9.2"/><path d="M10 19.4v-5.3h4v5.3"/>`,
  grid: `<rect x="4.2" y="4.2" width="15.6" height="15.6" rx="1.2"/><path d="M4.2 10h15.6"/><path d="M4.2 15.8h15.6"/><path d="M10 4.2v15.6"/><path d="M15.8 4.2v15.6"/>`,
  ruler: `<path d="m4.4 16.8 12.4-12.4 2.8 2.8L7.2 19.6z"/><path d="m8.6 16.1-1.7-1.7"/><path d="m11.3 13.4-1.7-1.7"/><path d="m14 10.7-1.7-1.7"/><path d="m16.7 8-1.7-1.7"/>`,
  tag: `<path d="m20 12-8 8-8-8V4h8z"/><path d="M8.7 8.7h.1"/><circle cx="8.8" cy="8.8" r="1.35"/>`,
  dollar: `<path d="M12 4v16"/><path d="M16 7.7c-.9-.8-2.3-1.3-3.8-1.3-2.2 0-3.9 1-3.9 2.6 0 4 7.5 1.8 7.5 6 0 1.7-1.6 2.7-3.9 2.7-1.9 0-3.5-.6-4.6-1.8"/>`,
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
  instagram: `<rect x="5" y="5" width="14" height="14" rx="4"/><circle cx="12" cy="12" r="3.2"/><path d="M16.2 7.9h.1"/>`,
  pinterest: `<path d="M12.1 4.4c-3.8 0-6.2 2.6-6.2 5.7 0 2 1.1 3.6 2.8 4.1"/><path d="M11 20.2c.6-2.6 1.2-5.2 1.8-7.8"/><path d="M10.1 12.6c-.4-1 .1-3.4 2.3-3.4 1.5 0 2.4 1 2.4 2.3 0 2-1.3 3.5-3 3.2-.8-.1-1.3-.6-1.6-1.2"/><path d="M12.1 4.4c3.7 0 6 2.4 6 5.8 0 4-2.8 6.7-6.5 6.5"/>`,
  houzz: `<path d="M6 20V4l6 3.1v4.6l6-3.1V20h-6v-5.1L6 12v8z"/>`,
  check: `<path d="M20 6 9 17l-5-5"/>`,
  arrow: `<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>`,
  sparkle: `<path d="m12 3.6 1.7 4.9 4.9 1.7-4.9 1.7-1.7 4.9-1.7-4.9-4.9-1.7 4.9-1.7z"/><path d="m18.8 16.8.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>`
};

const finishLabels = {
  "white-dove": "White Dove OC-17",
  "simply-white": "Simply White OC-117",
  "chantilly-lace": "Chantilly Lace OC-65",
  "swiss-coffee": "Swiss Coffee OC-45",
  "revere-pewter": "Revere Pewter HC-172",
  "custom-bm": "Custom Color"
};

const hardwareLabels = {
  "brushed-brass": "Brushed Brass",
  "matte-black": "Matte Black",
  "polished-nickel": "Polished Nickel"
};

const deliveryLabels = {
  "pickup": "Pickup / shop coordination",
  "standard": "Standard delivery",
  "priority": "Priority delivery review"
};

const leadTimeLabels = {
  "pickup": "Estimated after quote review",
  "standard": "Estimated 4-6 weeks after approval",
  "priority": "Reviewed during quote review"
};

const installationLabels = {
  "none": "No Installation",
  "professional": "Professional Installation"
};

document.addEventListener("DOMContentLoaded", () => {
  injectHeader();
  injectFooter();
  initIcons();
  initMobileNav();
  initBookcases();
  initConfigurator();
  initHeaderBuilderActions();
  initAccordions();
  initContactForm();
  initQuoteForm();
  initNewsletter();
});

function injectHeader() {
  const host = document.querySelector("[data-site-header]");
  if (!host) return;

  const current = document.body.dataset.page || "home";
  const links = navItems.map((item) => {
    const active = item.page === current ? " is-active" : "";
    return `<a class="nav-link${active}" href="${item.href}">${item.label}</a>`;
  }).join("");

  const headerActions = current === "home"
    ? `
          <button class="header-save-button" type="button" data-header-save-design>Save Design</button>
          <button class="button button-primary" type="button" data-header-request-quote>Request Quote</button>
        `
    : `
          <a class="header-save-button" href="${designBuilderHref}">Save Design</a>
          <a class="button button-primary${current === "quote" ? " is-active" : ""}" href="request-quote.html">Request Quote</a>
        `;

  host.innerHTML = `
    <header class="site-header">
      <nav class="navbar" aria-label="Primary navigation">
        <a class="brand" href="index.html" aria-label="JQ Bookcases home">
          <span class="brand-main">JQ BOOKCASES</span>
          <span class="brand-sub">BUILT-INS &amp; MILLWORK</span>
        </a>
        <div class="nav-links" id="primary-navigation">
          ${links}
          <a class="button button-primary mobile-cta" href="request-quote.html">Request Quote</a>
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
  document.querySelector("[data-header-save-design]")?.addEventListener("click", () => {
    document.querySelector("[data-bookcase-builder] [data-save-design]")?.click();
  });

  document.querySelector("[data-header-request-quote]")?.addEventListener("click", () => {
    document.querySelector("[data-bookcase-builder] [data-open-order]")?.click();
  });
}

function injectFooter() {
  const host = document.querySelector("[data-site-footer]");
  if (!host) return;

  host.innerHTML = `
    <footer class="site-footer">
      <div class="footer-grid">
        <div>
          <a class="footer-brand" href="index.html">
            <span class="brand-main">JQ BOOKCASES</span>
            <span class="brand-sub">BUILT-INS &amp; MILLWORK</span>
          </a>
          <p>Premium built-ins, expertly crafted for your home.</p>
          <div class="footer-socials" aria-label="Social links">
            <span aria-hidden="true"><i data-icon="instagram"></i></span>
            <span aria-hidden="true"><i data-icon="pinterest"></i></span>
            <span aria-hidden="true"><i data-icon="houzz"></i></span>
          </div>
        </div>
        <div>
          <h3>Company</h3>
          <ul class="footer-list">
            <li><a href="about.html">About Us</a></li>
            <li><a href="how-it-works.html">Our Process</a></li>
            <li><a href="materials.html">Materials &amp; Quality</a></li>
            <li><a href="faq.html">Care &amp; Warranty</a></li>
          </ul>
        </div>
        <div>
          <h3>Support</h3>
          <ul class="footer-list">
            <li><a href="faq.html">FAQ</a></li>
            <li><a href="request-quote.html">Design Help</a></li>
            <li><a href="how-it-works.html">Delivery &amp; Installation</a></li>
            <li><a href="request-quote.html">Contact Us</a></li>
          </ul>
        </div>
        <div>
          <h3>Design ideas &amp; inspiration</h3>
          <p>Sign up for tips, projects, and product highlights.</p>
          <form class="newsletter" data-newsletter>
            <label class="sr-only" for="newsletter-email">Email address</label>
            <input id="newsletter-email" name="email" type="email" placeholder="Email address" autocomplete="email" required>
            <button type="submit" aria-label="Sign up">&rarr;</button>
          </form>
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

  const setOpen = (open) => {
    document.body.classList.toggle("nav-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
  };

  toggle.addEventListener("click", () => {
    setOpen(!document.body.classList.contains("nav-open"));
  });

  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) setOpen(false);
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

function initConfigurator() {
  const form = document.querySelector("[data-configurator-form]");
  if (!form) return;

  const priceEl = document.querySelector("[data-estimated-price]");
  const status = document.querySelector("[data-config-status]");
  const saveButtons = document.querySelectorAll("[data-save-design]");
  const reviewButtons = document.querySelectorAll("[data-review-design]");
  const bookcaseHost = document.querySelector("#config-bookcase");
  const dimensionHost = document.querySelector("[data-config-dimensions]");

  const update = () => {
    const state = getConfigState(form);
    const price = calculatePrice(state);
    if (priceEl) priceEl.textContent = formatPrice(price);
    if (bookcaseHost) renderBookcase(bookcaseHost, state);
    updateDimensionLabels(dimensionHost || document, state);
    updateDoorControl(form, state);
    updateSummary(state, price);
  };

  const normalizeAndUpdate = () => {
    const state = getConfigState(form);
    normalizeConfigInputs(form, state);
    update();
  };

  form.addEventListener("input", update);
  form.addEventListener("change", normalizeAndUpdate);

  saveButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const state = getConfigState(form);
      normalizeConfigInputs(form, state);
      const id = saveDesign(state);
      showStatus(status, `Saved design ID ${id}. Use this ID when you request quote review.`);
      update();
    });
  });

  reviewButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const state = getConfigState(form);
      normalizeConfigInputs(form, state);
      const id = saveDesign(state);
      window.location.href = `request-quote.html?design=${encodeURIComponent(id)}`;
    });
  });

  update();
}

function getConfigState(form) {
  const state = {
    width: clampInt(form.elements.width.value, 48, 180),
    height: clampInt(form.elements.height.value, 72, 120),
    depth: clampInt(form.elements.depth.value, 10, 24),
    sections: clampInt(form.elements.sections.value, 2, 6),
    shelves: clampInt(form.elements.shelves.value, 3, 6),
    lowerCabinets: form.elements.lowerCabinets.checked,
    doors: clampInt(form.elements.doors.value, 2, 8),
    finish: form.elements.finish.value,
    hardware: form.elements.hardware.value,
    delivery: form.elements.delivery.value,
    installation: form.elements.installation.value
  };

  return state;
}

function normalizeConfigInputs(form, state) {
  form.elements.width.value = state.width;
  form.elements.height.value = state.height;
  form.elements.depth.value = state.depth;
  form.elements.sections.value = state.sections;
  form.elements.shelves.value = state.shelves;
  form.elements.doors.value = state.doors;
}

function updateDoorControl(form, state) {
  const row = form.querySelector("[data-door-control]");
  const select = form.elements.doors;
  if (!row || !select) return;
  row.hidden = !state.lowerCabinets;
  select.disabled = !state.lowerCabinets;
}

function calculatePrice(state) {
  const sizeScale = (state.width / 96) * (state.height / 96) * (state.depth / 15);
  const finishAdd = {
    "white-dove": 0,
    "simply-white": 0,
    "chantilly-lace": 0,
    "swiss-coffee": 0,
    "revere-pewter": 0,
    "custom-bm": 0
  }[state.finish] || 0;

  const hardwareAdd = {
    "brushed-brass": 150,
    "matte-black": 0,
    "polished-nickel": 175
  }[state.hardware] || 0;

  const deliveryAdd = {
    "pickup": 0,
    "standard": 160,
    "priority": 650
  }[state.delivery] || 0;

  const installationAdd = state.installation === "professional" ? 800 : 0;
  const lowerAdd = state.lowerCabinets ? 450 + state.doors * 72 : 0;

  const price = 3300 +
    sizeScale * 850 +
    state.sections * 170 +
    state.shelves * 50 +
    lowerAdd +
    finishAdd +
    hardwareAdd +
    deliveryAdd +
    installationAdd;

  return Math.round(price / 50) * 50;
}

function updateDimensionLabels(root, state) {
  if (!root) return;
  root.querySelectorAll("[data-dim-width]").forEach((el) => { el.textContent = `${state.width}"`; });
  root.querySelectorAll("[data-dim-height]").forEach((el) => { el.textContent = `${state.height}"`; });
  root.querySelectorAll("[data-dim-depth]").forEach((el) => { el.textContent = `${state.depth}"`; });
  root.querySelectorAll("[data-dim-sections]").forEach((el) => { el.textContent = state.sections; });
  root.querySelectorAll("[data-dim-shelves]").forEach((el) => { el.textContent = state.shelves; });
}

function updateSummary(state, price) {
  const fields = {
    size: `${state.width}" W x ${state.height}" H x ${state.depth}" D`,
    layout: `${state.sections} sections / ${state.shelves} shelves`,
    lower: state.lowerCabinets ? `${state.doors} lower doors` : "Open lower section",
    finish: finishLabels[state.finish] || finishLabels[normalizePaintFinish(state.finish)],
    hardware: hardwareLabels[state.hardware],
    delivery: deliveryLabels[state.delivery],
    lead: leadTimeLabels[state.delivery],
    installation: installationLabels[state.installation],
    price: formatPrice(price)
  };

  Object.entries(fields).forEach(([key, value]) => {
    document.querySelectorAll(`[data-summary-${key}]`).forEach((el) => {
      el.textContent = value;
    });
  });
}

function saveDesign(state) {
  const price = calculatePrice(state);
  const id = createDesignId(state, price);
  const design = {
    id,
    price,
    state,
    savedAt: new Date().toISOString()
  };
  try {
    localStorage.setItem("jqBookcasesDesign", JSON.stringify(design));
  } catch (error) {
    // Local storage may be disabled; the visible ID is still useful.
  }
  return id;
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

function createDesignId(state, price) {
  const source = JSON.stringify(state) + price;
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = ((hash << 5) - hash + source.charCodeAt(i)) | 0;
  }
  return `JQ-${Math.abs(hash).toString(36).toUpperCase().slice(0, 5).padStart(5, "0")}`;
}

function initAccordions() {
  document.querySelectorAll("[data-accordion]").forEach((accordion) => {
    accordion.querySelectorAll("[data-accordion-trigger]").forEach((trigger) => {
      const panel = document.getElementById(trigger.getAttribute("aria-controls"));
      trigger.addEventListener("click", () => {
        const isOpen = trigger.getAttribute("aria-expanded") === "true";
        accordion.querySelectorAll("[data-accordion-trigger]").forEach((otherTrigger) => {
          if (otherTrigger === trigger) return;
          otherTrigger.setAttribute("aria-expanded", "false");
          document.getElementById(otherTrigger.getAttribute("aria-controls"))?.classList.remove("is-open");
          otherTrigger.closest(".accordion-item")?.classList.remove("is-open");
        });
        trigger.setAttribute("aria-expanded", String(!isOpen));
        if (panel) panel.classList.toggle("is-open", !isOpen);
        trigger.closest(".accordion-item")?.classList.toggle("is-open", !isOpen);
      });
    });
  });
}

function initContactForm() {
  const form = document.querySelector("[data-contact-form]");
  const status = document.querySelector("[data-contact-status]");
  const designField = document.querySelector("#saved-design-id");
  if (designField) {
    const params = new URLSearchParams(window.location.search);
    const queryId = params.get("design");
    const stored = getStoredDesign();
    if (queryId) designField.value = queryId;
    else if (stored?.id) designField.value = stored.id;
  }
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    showStatus(status, "Thanks. Your project details are ready for quote review. We will confirm dimensions, site conditions, and next steps before final pricing.");
    status?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function initQuoteForm() {
  const form = document.querySelector("[data-quote-form]");
  if (!form) return;

  const status = form.querySelector("[data-quote-status]");
  const finishSelect = form.querySelector("[data-quote-finish]");
  const customField = form.querySelector("[data-custom-bm-quote]");

  const syncCustomPaint = () => {
    if (!finishSelect || !customField) return;
    const customSelected = finishSelect.value === "custom_bm";
    customField.hidden = !customSelected;
    customField.querySelector("input")?.toggleAttribute("required", customSelected);
  };

  finishSelect?.addEventListener("change", syncCustomPaint);
  syncCustomPaint();

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    showStatus(status, "Thanks — your quote request has been prepared. Final submission connection can be added in the next backend phase.");
    status?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function initNewsletter() {
  document.querySelectorAll("[data-newsletter]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = form.querySelector("input");
      if (input) input.value = "";
      form.querySelector("button").textContent = "Done";
    });
  });
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

function formatPrice(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function clampInt(value, min, max) {
  return Math.min(max, Math.max(min, Math.round(Number(value) || min)));
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || min));
}
