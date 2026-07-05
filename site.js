const navItems = [
  { label: "How It Works", href: "how-it-works.html", page: "how" },
  { label: "Materials", href: "materials.html", page: "materials" },
  { label: "Inspiration", href: "inspiration.html", page: "inspiration" },
  { label: "About Us", href: "about.html", page: "about" },
  { label: "FAQ", href: "faq.html", page: "faq" }
];

const iconMap = {
  shield: `<path d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6l7-3z"/><path d="M9 12l2 2 4-5"/>`,
  leaf: `<path d="M19 4c-7 1-12 5-13 12 5 1 10-1 13-7 1.5-2.7 1.2-5 0-5z"/><path d="M5 20c2.5-6 7-9 13-12"/>`,
  truck: `<path d="M3 7h10v9H3z"/><path d="M13 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>`,
  home: `<path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/><path d="M10 20v-6h4v6"/>`,
  grid: `<path d="M4 4h16v16H4z"/><path d="M4 10h16"/><path d="M4 16h16"/><path d="M10 4v16"/><path d="M16 4v16"/>`,
  ruler: `<path d="M4 17L17 4l3 3L7 20z"/><path d="M9 16l-2-2"/><path d="M12 13l-2-2"/><path d="M15 10l-2-2"/>`,
  tag: `<path d="M20 12l-8 8-8-8V4h8z"/><circle cx="9" cy="9" r="1.5"/>`,
  dollar: `<path d="M12 3v18"/><path d="M16 7.5c-1-1-2.4-1.5-4-1.5-2.3 0-4 1-4 2.8 0 4.2 8 1.8 8 6.4 0 1.8-1.7 2.8-4 2.8-1.9 0-3.5-.7-4.6-1.9"/>`,
  calendar: `<path d="M5 5h14v15H5z"/><path d="M8 3v4"/><path d="M16 3v4"/><path d="M5 10h14"/><path d="M9 15l2 2 4-4"/>`,
  wrench: `<path d="M20 7a5 5 0 0 1-6.7 6.7L7 20l-3-3 6.3-6.3A5 5 0 0 1 17 4l-3 3 3 3z"/>`,
  people: `<path d="M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/><path d="M2 21a6 6 0 0 1 12 0"/><path d="M17 11a3 3 0 1 0 0-6"/><path d="M16 15a5 5 0 0 1 6 5"/>`,
  flag: `<path d="M5 21V4"/><path d="M5 5c4-2 7 2 11 0v9c-4 2-7-2-11 0"/>`,
  layers: `<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 12l9 5 9-5"/><path d="M3 16l9 5 9-5"/>`,
  tree: `<path d="M12 3l5 6h-3l4 5h-4l3 4H7l3-4H6l4-5H7z"/><path d="M12 18v3"/>`,
  badge: `<path d="M12 3l3 2 4 .5.5 4 2 2.5-2 3-.5 4-4 .5-3 2-3-2-4-.5-.5-4-2-3 2-2.5.5-4 4-.5z"/><path d="M9 12l2 2 4-5"/>`,
  drill: `<path d="M4 8h10v5H4z"/><path d="M14 9h5l2 2-2 2h-5"/><path d="M7 13v6h4v-6"/><path d="M6 19h6"/>`,
  headset: `<path d="M4 13v-1a8 8 0 0 1 16 0v1"/><path d="M4 13h4v6H4z"/><path d="M16 13h4v6h-4z"/><path d="M16 19c0 1.5-1.5 2-4 2"/>`,
  pin: `<path d="M12 21s7-6.2 7-12A7 7 0 1 0 5 9c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>`,
  brush: `<path d="M14 4l6 6-8 8-6-6z"/><path d="M4 14c-1.2 1.2-1 3 0 4 1 1 2.8 1.2 4 0"/>`,
  check: `<path d="M20 6L9 17l-5-5"/>`,
  arrow: `<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>`,
  sparkle: `<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z"/>`
};

const finishLabels = {
  "alabaster": "Alabaster",
  "warm-white": "Warm White",
  "black": "Black",
  "natural-oak": "Natural Oak",
  "walnut": "Walnut"
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
  initAccordions();
  initContactForm();
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

  host.innerHTML = `
    <header class="site-header">
      <nav class="navbar" aria-label="Primary navigation">
        <a class="brand" href="index.html" aria-label="JQ Bookcases home">
          <span class="brand-main">JQ BOOKCASES</span>
          <span class="brand-sub">BUILT-INS &amp; MILLWORK</span>
        </a>
        <div class="nav-links" id="primary-navigation">
          ${links}
          <a class="button button-primary mobile-cta" href="configurator.html">Start Designing</a>
        </div>
        <div class="header-actions">
          <a class="button button-primary" href="configurator.html">Start Designing</a>
          <button class="nav-toggle" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="primary-navigation">
            <span></span><span></span><span></span>
          </button>
        </div>
      </nav>
    </header>
  `;
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
          <p>Semi-custom built-in bookcases, designed online and refined through a measured shop process.</p>
          <p style="margin-top:16px;">Proudly serving NYC &amp; Tri-State Area.</p>
        </div>
        <div>
          <h3>Shop</h3>
          <ul class="footer-list">
            <li><a href="configurator.html">Configurator</a></li>
            <li><a href="materials.html">Materials</a></li>
            <li><a href="inspiration.html">Inspiration</a></li>
            <li><a href="contact.html">Quote Review</a></li>
          </ul>
        </div>
        <div>
          <h3>Company</h3>
          <ul class="footer-list">
            <li><a href="about.html">About Us</a></li>
            <li><a href="how-it-works.html">How It Works</a></li>
            <li><a href="faq.html">FAQ</a></li>
          </ul>
        </div>
        <div>
          <h3>Project Notes</h3>
          <p>Material guidance, design ideas, and quote-review reminders for built-in projects.</p>
          <form class="newsletter" data-newsletter>
            <label class="sr-only" for="newsletter-email">Email address</label>
            <input id="newsletter-email" name="email" type="email" placeholder="Email address" autocomplete="email" required>
            <button type="submit" aria-label="Sign up">&rarr;</button>
          </form>
        </div>
      </div>
      <div class="footer-bottom">
        <span>&copy; 2026 JQ Bookcases. All rights reserved.</span>
        <span class="footer-bottom-links">
          <a href="contact.html">Contact</a>
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
    el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths}</svg>`;
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
    finish: dataset.finish || "alabaster",
    hardware: dataset.hardware || "brushed-brass"
  };
}

function renderBookcase(host, state) {
  const sections = clampInt(state.sections, 1, 6);
  const shelves = clampInt(state.shelves, 1, 6);
  const doors = clampInt(state.doors, 2, 8);
  const lowerCabinets = state.lowerCabinets !== false && state.lowerCabinets !== "false";
  const finish = state.finish || "alabaster";
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
      window.location.href = `contact.html?design=${encodeURIComponent(id)}`;
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
    "alabaster": 0,
    "warm-white": 100,
    "black": 450,
    "natural-oak": 950,
    "walnut": 1200
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
    finish: finishLabels[state.finish],
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
        trigger.setAttribute("aria-expanded", String(!isOpen));
        if (panel) panel.classList.toggle("is-open", !isOpen);
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
