import * as hardwareCatalogApi from "./hardware-catalog.js?v=engine-polish-20260716a";

/**
 * Standalone direct-on-model hardware editor.
 *
 * This module deliberately owns presentation state only. Canonical state,
 * layout generation, validation, pricing, and commits stay with the host
 * configurator through the functions supplied to DirectHardwareEditor.
 */

export const HARDWARE_APPLICATION_SCOPES = Object.freeze({
  item: "item",
  section: "section",
  allMatchingDoors: "all-matching-doors",
  allMatchingDrawers: "all-matching-drawers"
});

const FRONT_ROLES = new Set(["door", "drawer_front"]);
const PICKABLE_ROLES = new Set(["handle", "door", "drawer_front"]);
const DEFAULT_HISTORY_LIMIT = 50;
const LARGE_REPLACEMENT_COUNT = 12;

const SCOPE_LABELS = Object.freeze({
  [HARDWARE_APPLICATION_SCOPES.item]: "This component",
  [HARDWARE_APPLICATION_SCOPES.section]: "This section",
  [HARDWARE_APPLICATION_SCOPES.allMatchingDoors]: "All matching doors",
  [HARDWARE_APPLICATION_SCOPES.allMatchingDrawers]: "All matching drawers"
});

const SEARCH_SYNONYMS = Object.freeze({
  handle: "pull knob latch tab edge cup bar d handle",
  gold: "brass bronze champagne honey unlacquered",
  silver: "nickel chrome stainless steel",
  black: "matte black flat black",
  modern: "contemporary minimal",
  traditional: "classic transitional",
  accurate: "dimensionally accurate parametric proxy"
});

const LEGACY_HARDWARE_HINTS = Object.freeze({
  brass_knob: { categories: ["round_knob", "t_bar_knob"], finishes: ["satin-brass", "brass", "warm-brass"] },
  brass_pull: { categories: ["bar_pull", "d_handle_pull", "textured_bar_pull"], finishes: ["satin-brass", "brass", "warm-brass"] },
  matte_black_knob: { categories: ["round_knob", "t_bar_knob"], finishes: ["matte-black"] },
  matte_black_pull: { categories: ["bar_pull", "d_handle_pull", "textured_bar_pull"], finishes: ["matte-black"] },
  polished_nickel_pull: { categories: ["bar_pull", "d_handle_pull", "textured_bar_pull"], finishes: ["polished-nickel", "polished-chrome"] },
  polished_nickel_knob: { categories: ["round_knob", "t_bar_knob"], finishes: ["polished-nickel", "polished-chrome"] },
  unlacquered_brass_knob: { categories: ["round_knob", "t_bar_knob"], finishes: ["unlacquered-brass"] },
  satin_nickel_pull: { categories: ["bar_pull", "d_handle_pull", "textured_bar_pull"], finishes: ["satin-nickel"] }
});

function componentsFromLayout(layout) {
  return Array.isArray(layout?.components) ? layout.components : [];
}

export function cloneDirectHardwareValue(value) {
  if (value === undefined) return undefined;
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      // Canonical configurator state is JSON-safe; use the stable fallback.
    }
  }
  return JSON.parse(JSON.stringify(value));
}

export function escapeDirectHardwareHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeId(value) {
  return String(value || "direct-hardware")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "direct-hardware";
}

function safeUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function safeSwatch(value) {
  const text = String(value || "");
  return /^#[0-9a-f]{6}$/i.test(text) ? text : "#8f775c";
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, minimum, maximum) {
  if (maximum < minimum) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}

function getComponentId(selection) {
  if (typeof selection === "string") return selection;
  return selection?.componentId || selection?.id || selection?.descriptor?.id || selection?.component?.id || null;
}

function findSectionForComponent(component, componentById) {
  let current = component;
  const visited = new Set();
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    if (current.role === "section") return current;
    if (current.sectionId && componentById.has(current.sectionId)) {
      const explicit = componentById.get(current.sectionId);
      if (explicit?.role === "section") return explicit;
    }
    if (current.metadata?.sectionId && componentById.has(current.metadata.sectionId)) {
      const explicit = componentById.get(current.metadata.sectionId);
      if (explicit?.role === "section") return explicit;
    }
    current = componentById.get(current.parentId) || componentById.get(current.hostId) || null;
  }
  return null;
}

function frontMatchSignature(front) {
  return [
    front?.role || "",
    front?.metadata?.style || "",
    front?.metadata?.mounting || "",
    front?.metadata?.openingKind || ""
  ].join("|");
}

/**
 * Resolve a semantic viewer selection to its hardware host and anchor.
 * Handles resolve to their host front; door/drawer selections resolve to
 * themselves and use a hosted handle as the preferred screen anchor.
 */
export function resolveHardwareSelection(layout, selection) {
  const components = componentsFromLayout(layout);
  const componentById = new Map(components.map((component) => [component.id, component]));
  const selectedId = getComponentId(selection);
  let component = componentById.get(selectedId) || selection?.descriptor || selection?.component || null;

  if (!component && selection?.hostId) component = componentById.get(selection.hostId) || null;
  if (!component || !PICKABLE_ROLES.has(component.role)) return null;

  let host = component;
  if (component.role === "handle") host = componentById.get(component.hostId) || null;
  if (!host || !FRONT_ROLES.has(host.role)) return null;

  const hostedHandle = components.find((item) => item.role === "handle" && item.hostId === host.id) || null;
  const section = findSectionForComponent(host, componentById);
  return {
    component,
    host,
    handle: component.role === "handle" ? component : hostedHandle,
    anchorComponent: component.role === "handle" ? component : (hostedHandle || host),
    section,
    sectionId: section?.id || null
  };
}

/**
 * Pure scope resolver used by the controller and Node tests.
 */
export function resolveHardwareScope(layout, selection, scope = HARDWARE_APPLICATION_SCOPES.item) {
  const components = componentsFromLayout(layout);
  const componentById = new Map(components.map((component) => [component.id, component]));
  const resolved = resolveHardwareSelection(layout, selection);
  if (!resolved) {
    return {
      scope,
      hostIds: [],
      hosts: [],
      excluded: [{ componentId: getComponentId(selection), reason: "Selection is not a hardware-bearing front." }],
      sectionId: null,
      selectedHostId: null,
      hostRole: null
    };
  }

  const fronts = components.filter((component) => FRONT_ROLES.has(component.role));
  const excluded = [];
  let hosts = [];

  if (scope === HARDWARE_APPLICATION_SCOPES.item) {
    hosts = [resolved.host];
  } else if (scope === HARDWARE_APPLICATION_SCOPES.section) {
    if (!resolved.sectionId) {
      excluded.push({ componentId: resolved.host.id, reason: "The selected component has no resolvable section." });
    } else {
      hosts = fronts.filter((front) => findSectionForComponent(front, componentById)?.id === resolved.sectionId);
    }
  } else if (scope === HARDWARE_APPLICATION_SCOPES.allMatchingDoors) {
    if (resolved.host.role !== "door") {
      excluded.push({ componentId: resolved.host.id, reason: "Select a door to use the all-matching-doors scope." });
    } else {
      const signature = frontMatchSignature(resolved.host);
      hosts = fronts.filter((front) => front.role === "door" && frontMatchSignature(front) === signature);
    }
  } else if (scope === HARDWARE_APPLICATION_SCOPES.allMatchingDrawers) {
    if (resolved.host.role !== "drawer_front") {
      excluded.push({ componentId: resolved.host.id, reason: "Select a drawer to use the all-matching-drawers scope." });
    } else {
      const signature = frontMatchSignature(resolved.host);
      hosts = fronts.filter((front) => front.role === "drawer_front" && frontMatchSignature(front) === signature);
    }
  } else {
    excluded.push({ componentId: resolved.host.id, reason: `Unknown hardware application scope: ${scope}` });
  }

  const uniqueHosts = [];
  const seen = new Set();
  for (const host of hosts) {
    if (!host?.id || seen.has(host.id)) continue;
    seen.add(host.id);
    uniqueHosts.push(host);
  }

  return {
    scope,
    hostIds: uniqueHosts.map((host) => host.id),
    hosts: uniqueHosts,
    excluded,
    sectionId: resolved.sectionId,
    selectedHostId: resolved.host.id,
    hostRole: resolved.host.role
  };
}

export const resolveScopeTargets = resolveHardwareScope;

/**
 * Clamp and flip an anchored card within the model viewport. The return value
 * includes explicit leader endpoints so rendering is deterministic.
 */
export function clampHardwareAnchor(anchor = {}, viewport = {}, card = {}, options = {}) {
  if (anchor?.anchor && anchor?.viewport) {
    const config = anchor;
    return clampHardwareAnchor(config.anchor, config.viewport, config.card || {}, config.options || {});
  }

  const width = Math.max(0, finite(viewport.width));
  const height = Math.max(0, finite(viewport.height));
  const cardWidth = Math.max(0, finite(card.width));
  const cardHeight = Math.max(0, finite(card.height));
  const margin = Math.max(0, finite(options.margin, 16));
  const gap = Math.max(0, finite(options.gap, 22));
  const topInset = Math.max(margin, finite(options.topInset, margin));
  const bottomInset = Math.max(margin, finite(options.bottomInset, margin));
  const anchorX = clamp(finite(anchor.x, width / 2), margin, Math.max(margin, width - margin));
  const anchorY = clamp(finite(anchor.y, height / 2), topInset, Math.max(topInset, height - bottomInset));
  const spaceRight = width - margin - (anchorX + gap);
  const spaceLeft = anchorX - gap - margin;
  let side = options.preferredSide === "left" ? "left" : "right";
  if (side === "right" && cardWidth > spaceRight && spaceLeft > spaceRight) side = "left";
  if (side === "left" && cardWidth > spaceLeft && spaceRight >= spaceLeft) side = "right";

  const proposedLeft = side === "right" ? anchorX + gap : anchorX - gap - cardWidth;
  const left = clamp(proposedLeft, margin, Math.max(margin, width - cardWidth - margin));
  const top = clamp(
    anchorY - cardHeight * 0.42,
    topInset,
    Math.max(topInset, height - cardHeight - bottomInset)
  );
  const leaderEndX = side === "right" ? left : left + cardWidth;
  const leaderEndY = clamp(anchorY, top + 18, Math.max(top + 18, top + cardHeight - 18));

  return {
    left,
    top,
    side,
    anchorX,
    anchorY,
    leaderStart: { x: anchorX, y: anchorY },
    leaderEnd: { x: leaderEndX, y: leaderEndY },
    visible: anchor.visible !== false && width > 0 && height > 0
  };
}

export const clampAnchorPosition = clampHardwareAnchor;

function normalizeHistoryCommand(command) {
  if (!command || !("beforeState" in command) || !("afterState" in command)) {
    throw new TypeError("A hardware history command requires beforeState and afterState.");
  }
  return {
    ...command,
    beforeState: cloneDirectHardwareValue(command.beforeState),
    afterState: cloneDirectHardwareValue(command.afterState),
    beforeLayout: cloneDirectHardwareValue(command.beforeLayout),
    afterLayout: cloneDirectHardwareValue(command.afterLayout),
    metadata: cloneDirectHardwareValue(command.metadata || {})
  };
}

/** Bounded, atomic undo/redo storage. Preview operations never call record(). */
export class BoundedHardwareHistory {
  constructor(limit = DEFAULT_HISTORY_LIMIT) {
    this.limit = clamp(Math.trunc(finite(limit, DEFAULT_HISTORY_LIMIT)), 1, DEFAULT_HISTORY_LIMIT);
    this.undoStack = [];
    this.redoStack = [];
  }

  get undoCount() {
    return this.undoStack.length;
  }

  get redoCount() {
    return this.redoStack.length;
  }

  get canUndo() {
    return this.undoStack.length > 0;
  }

  get canRedo() {
    return this.redoStack.length > 0;
  }

  record(command) {
    const normalized = normalizeHistoryCommand(command);
    this.undoStack.push(normalized);
    if (this.undoStack.length > this.limit) this.undoStack.splice(0, this.undoStack.length - this.limit);
    this.redoStack.length = 0;
    return normalized;
  }

  peekUndo() {
    const command = this.undoStack.at(-1);
    return command ? cloneDirectHardwareValue(command) : null;
  }

  commitUndo() {
    const command = this.undoStack.pop() || null;
    if (command) this.redoStack.push(command);
    return command ? cloneDirectHardwareValue(command) : null;
  }

  peekRedo() {
    const command = this.redoStack.at(-1);
    return command ? cloneDirectHardwareValue(command) : null;
  }

  commitRedo() {
    const command = this.redoStack.pop() || null;
    if (command) {
      this.undoStack.push(command);
      if (this.undoStack.length > this.limit) this.undoStack.shift();
    }
    return command ? cloneDirectHardwareValue(command) : null;
  }

  clear() {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }

  snapshot() {
    return {
      limit: this.limit,
      undoCount: this.undoCount,
      redoCount: this.redoCount,
      canUndo: this.canUndo,
      canRedo: this.canRedo
    };
  }
}

export const HardwareHistory = BoundedHardwareHistory;

const editIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M5 19h3.3L19 8.3 15.7 5 5 15.7V19Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
    <path d="m13.9 6.8 3.3 3.3M4.5 21h15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
  </svg>`;

const closeIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
  </svg>`;

const listIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M9 6h10M9 12h10M9 18h10M5 6h.01M5 12h.01M5 18h.01" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
  </svg>`;

export function renderDirectHardwareEditorMarkup(options = {}) {
  const prefix = safeId(options.idPrefix || "direct-hardware");
  const status = options.catalogStatus === "invalid" ? "invalid" : (options.catalogStatus === "ready" ? "ready" : "loading");
  return `
    <div class="direct-hardware-edit" data-direct-hardware-editor data-catalog-state="${status}" data-enabled="false">
      <div class="direct-hardware-edit__loading" data-direct-loading role="status">
        <span class="direct-hardware-edit__spinner" aria-hidden="true"></span>
        <span>Preparing curated hardware…</span>
      </div>

      <div class="direct-hardware-edit__fallback" data-direct-fallback role="status" hidden>
        <strong>Direct hardware editing is unavailable.</strong>
        <span>Continue with the existing Hardware control; your accepted design is unchanged.</span>
      </div>

      <div class="direct-hardware-edit__helper" data-direct-helper hidden>
        <button type="button" class="direct-hardware-edit__helper-button" data-direct-toggle aria-pressed="true" aria-describedby="${prefix}-helper-copy">
          <span class="direct-hardware-edit__icon">${editIcon}</span>
          <span><strong>Edit on model</strong><small id="${prefix}-helper-copy">Choose a handle, door, or drawer</small></span>
        </button>
        <button type="button" class="direct-hardware-edit__icon-button" data-toggle-components aria-expanded="false" aria-controls="${prefix}-components" aria-label="Show editable components">
          ${listIcon}
        </button>
        <label class="direct-hardware-edit__compact-field">
          <span>Units</span>
          <select data-direct-units aria-label="Dimension display units">
            <option value="imperial">in</option>
            <option value="metric">mm</option>
          </select>
        </label>
        <label class="direct-hardware-edit__compact-field">
          <span>Scale</span>
          <select data-direct-scale aria-label="Human scale reference">
            <option value="hidden">Hidden</option>
            <option value="66">5 ft 6 in</option>
            <option value="72">6 ft</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label class="direct-hardware-edit__compact-field" data-custom-scale-field hidden>
          <span>Height</span>
          <input type="number" data-custom-scale min="36" max="96" step="0.125" value="66" inputmode="decimal" aria-label="Custom human height in inches">
        </label>
        <output class="direct-hardware-edit__height-output" data-overall-height aria-label="Overall bookcase height"></output>
      </div>

      <div class="direct-hardware-edit__hover-label" data-direct-hover-label hidden></div>

      <svg class="direct-hardware-edit__leader" data-direct-leader aria-hidden="true" focusable="false">
        <line data-direct-leader-line x1="0" y1="0" x2="0" y2="0"></line>
        <circle data-direct-anchor-dot cx="0" cy="0" r="5"></circle>
      </svg>

      <section class="direct-hardware-edit__quick-card" data-direct-quick-card role="dialog" aria-modal="false" aria-labelledby="${prefix}-quick-title" hidden>
        <div data-direct-quick-content></div>
      </section>

      <aside id="${prefix}-components" class="direct-hardware-edit__components" data-components-panel aria-labelledby="${prefix}-components-title" hidden>
        <header>
          <div><span class="direct-hardware-edit__eyebrow">Keyboard alternative</span><h2 id="${prefix}-components-title">Editable components</h2></div>
          <button type="button" class="direct-hardware-edit__icon-button" data-close-components aria-label="Close editable components">${closeIcon}</button>
        </header>
        <p>Select a front below to edit the same hardware shown in the 3D model.</p>
        <div class="direct-hardware-edit__component-tree" data-editable-components role="tree" aria-label="Bookcase hardware components"></div>
      </aside>

      <div class="direct-hardware-edit__drawer-backdrop" data-library-backdrop hidden></div>
      <section class="direct-hardware-edit__library" data-hardware-library role="dialog" aria-modal="true" aria-labelledby="${prefix}-library-title" tabindex="-1" hidden>
        <header class="direct-hardware-edit__library-header">
          <div><span class="direct-hardware-edit__eyebrow">Curated specification library</span><h2 id="${prefix}-library-title">Decorative hardware</h2></div>
          <button type="button" class="direct-hardware-edit__icon-button" data-close-library aria-label="Close hardware library">${closeIcon}</button>
        </header>
        <div class="direct-hardware-edit__library-body" data-library-body></div>
        <section class="direct-hardware-edit__details" data-product-details aria-label="Hardware details" hidden></section>
      </section>

      <div class="direct-hardware-edit__scale-reference" data-scale-reference aria-hidden="true" hidden>
        <span class="direct-hardware-edit__scale-figure"></span>
        <span class="direct-hardware-edit__scale-line"></span>
        <span class="direct-hardware-edit__scale-label" data-scale-label></span>
      </div>

      <svg class="direct-hardware-edit__measurement" data-measurement-overlay aria-hidden="true" focusable="false">
        <line data-height-line x1="0" y1="0" x2="0" y2="0"></line>
        <line data-height-tick-start x1="0" y1="0" x2="0" y2="0"></line>
        <line data-height-tick-end x1="0" y1="0" x2="0" y2="0"></line>
        <text data-height-label x="0" y="0"></text>
      </svg>

      <div id="${prefix}-status" class="direct-hardware-edit__sr-status" data-direct-status role="status" aria-live="polite" aria-atomic="true"></div>
    </div>`;
}

export const renderDirectHardwareEditorShell = renderDirectHardwareEditorMarkup;

function formatCategory(category) {
  return String(category || "Hardware")
    .split(/[_-]+/)
    .map((part) => part ? part[0].toUpperCase() + part.slice(1) : "")
    .join(" ");
}

function accuracyLabel(accuracy) {
  const value = String(accuracy || "");
  if (value.includes("legacy_safe_approximation")) return "Legacy-safe approximation";
  if (value.includes("dimensionally_accurate")) return "Dimensionally accurate proxy";
  if (value.includes("simplified")) return "Simplified neutral model";
  if (value.includes("licensed")) return "Licensed exact model";
  return "Neutral model placeholder";
}

function availabilityLabel(status) {
  return String(status || "status_unknown")
    .replaceAll("_", " ")
    .replace(/^./, (character) => character.toUpperCase());
}

function numericPrice(variant) {
  const amount = Number(variant?.pricing?.amount);
  return Number.isFinite(amount) ? amount : Number.POSITIVE_INFINITY;
}

function sizeMillimeters(variant) {
  const dimensions = variant?.dimensionsMm || {};
  return finite(dimensions.centerToCenter, finite(dimensions.overallLength, Number.POSITIVE_INFINITY));
}

function getVariantSearchText(variant) {
  return [
    variant.id,
    variant.familyName,
    variant.brandName,
    variant.collectionName,
    variant.category,
    variant.categoryLabel,
    variant.manufacturerProductNumber,
    variant.sku,
    variant.finishName,
    variant.finishCode,
    variant.canonicalFinishLabel,
    ...(variant.styles || [])
  ].filter(Boolean).join(" ").toLocaleLowerCase();
}

/** Join the normalized seed hierarchy into exact, display-ready records. */
export function createDirectHardwareCatalogView(catalog, apiIndex = null) {
  const brands = new Map((catalog?.brands || []).map((item) => [item.id, item]));
  const collections = new Map((catalog?.collections || []).map((item) => [item.id, item]));
  const canonicalFinishes = new Map((catalog?.canonicalFinishes || []).map((item) => [item.id, item]));
  const families = new Map((catalog?.families || []).map((item) => [item.id, item]));
  const sources = new Map((catalog?.sources || []).map((item) => [item.id, item]));
  const variants = [];

  for (const exact of catalog?.exactVariants || []) {
    const family = families.get(exact.familyId);
    if (!family) continue;
    const size = (family.sizeVariants || []).find((item) => item.id === exact.sizeVariantId);
    const finish = (family.finishVariants || []).find((item) => item.id === exact.finishVariantId);
    const brand = brands.get(family.brandId) || {};
    const collection = collections.get(family.collectionId) || {};
    const canonicalFinish = canonicalFinishes.get(finish?.canonicalFinishId) || {};
    const variantSources = (exact.sourceIds || family.sourceIds || [])
      .map((sourceId) => sources.get(sourceId))
      .filter(Boolean);
    const apiSnapshot = apiIndex ? hardwareCatalogApi.createHardwareVariantSnapshot(apiIndex, exact.id) : null;
    const variant = {
      ...exact,
      family,
      size,
      finish,
      brand,
      collection,
      canonicalFinish,
      sources: variantSources,
      familyName: family.name,
      brandName: brand.name || family.brandId,
      collectionName: collection.name || family.collectionId,
      category: family.category,
      categoryLabel: formatCategory(family.category),
      styles: family.styles || [],
      material: family.material || null,
      dimensionsMm: size?.dimensionsMm || {},
      mounting: size?.mounting || {},
      sizeLabel: size?.label || "Size not stated",
      finishName: finish?.manufacturerName || "Finish not stated",
      finishCode: finish?.manufacturerCode || null,
      canonicalFinishId: finish?.canonicalFinishId || null,
      canonicalFinishLabel: canonicalFinish.label || finish?.manufacturerName || "Other",
      swatch: safeSwatch(canonicalFinish.swatch),
      compatiblePlacements: family.compatiblePlacements || [],
      recommendedApplications: family.recommendedApplications || [],
      assetAccuracy: family.asset?.accuracy || null,
      accuracyLabel: accuracyLabel(family.asset?.accuracy),
      priceTier: family.priceTier || null,
      familyStatus: family.status || null,
      selectable: apiSnapshot ? apiSnapshot.selectable === true : exact.productStatus !== "discontinued",
      releaseGate: apiSnapshot?.releaseGate === true,
      releaseWarnings: apiSnapshot?.warnings || [],
      catalogSnapshot: apiSnapshot,
      searchText: ""
    };
    variant.searchText = getVariantSearchText(variant);
    variants.push(variant);
  }

  const variantsById = new Map(variants.map((variant) => [variant.id, variant]));
  const variantsByFamily = new Map();
  for (const variant of variants) {
    const members = variantsByFamily.get(variant.familyId) || [];
    members.push(variant);
    variantsByFamily.set(variant.familyId, members);
  }

  return {
    raw: catalog,
    apiIndex,
    catalogVersion: catalog?.catalogVersion || "unknown",
    brands,
    collections,
    canonicalFinishes,
    families,
    sources,
    variants,
    variantsById,
    variantsByFamily
  };
}

/** Build a facts-only card for a saved exact variant absent from this catalog. */
export function createSavedHardwareVariantView(snapshot, variantId = snapshot?.variantId || snapshot?.id) {
  if (!snapshot || typeof snapshot !== "object" || !variantId) return null;
  const family = snapshot.family || {};
  const size = snapshot.size || snapshot.sizeVariant || {};
  const finish = snapshot.finish || snapshot.finishVariant || {};
  const brand = snapshot.brand || {};
  const collection = snapshot.collection || {};
  const canonicalFinish = finish.canonical || snapshot.canonicalFinish || {};
  const variant = {
    id: String(variantId),
    variantId: String(variantId),
    familyId: snapshot.familyId || family.id || "saved-family",
    sizeVariantId: snapshot.sizeVariantId || size.id || "saved-size",
    finishVariantId: snapshot.finishVariantId || finish.id || "saved-finish",
    family,
    size,
    finish,
    brand,
    collection,
    canonicalFinish,
    sources: Array.isArray(snapshot.sources) ? snapshot.sources : [],
    familyName: snapshot.familyName || family.name || "Saved hardware",
    brandName: snapshot.brandName || brand.name || "Brand not stated",
    collectionName: snapshot.collectionName || collection.name || "Collection not stated",
    category: snapshot.category || family.category || "hardware",
    categoryLabel: formatCategory(snapshot.category || family.category || "hardware"),
    styles: family.styles || collection.styles || [],
    material: snapshot.material || family.material || null,
    dimensionsMm: snapshot.dimensionsMm || size.dimensionsMm || {},
    mounting: snapshot.mounting || size.mounting || {},
    sizeLabel: snapshot.sizeLabel || size.label || "Size not stated",
    finishName: snapshot.finishName || finish.manufacturerName || "Finish not stated",
    finishCode: snapshot.finishCode || finish.manufacturerCode || null,
    canonicalFinishId: snapshot.canonicalFinishId || finish.canonicalFinishId || canonicalFinish.id || null,
    canonicalFinishLabel: canonicalFinish.label || snapshot.finishName || finish.manufacturerName || "Other",
    swatch: safeSwatch(snapshot.canonicalFinishSwatch || canonicalFinish.swatch),
    compatiblePlacements: family.compatiblePlacements || snapshot.compatiblePlacements || [],
    recommendedApplications: family.recommendedApplications || [],
    assetAccuracy: snapshot.modelAccuracy || snapshot.asset?.accuracy || family.asset?.accuracy || null,
    accuracyLabel: accuracyLabel(snapshot.modelAccuracy || snapshot.asset?.accuracy || family.asset?.accuracy),
    priceTier: family.priceTier || null,
    pricing: snapshot.pricing || snapshot.exact?.pricing || {},
    availability: snapshot.availability || snapshot.exact?.availability || {},
    productStatus: snapshot.productStatus || snapshot.exact?.productStatus || "missing_from_catalog",
    lastVerifiedAt: snapshot.lastVerifiedAt || snapshot.exact?.lastVerifiedAt || null,
    manufacturerProductNumber: snapshot.manufacturerProductNumber || snapshot.exact?.manufacturerProductNumber || null,
    sku: snapshot.sku || snapshot.exact?.sku || null,
    selectable: false,
    releaseGate: true,
    releaseWarnings: ["This saved exact variant is no longer present in the current catalog. Its retained facts remain available, but it cannot be newly selected."],
    catalogSnapshot: snapshot,
    searchText: ""
  };
  variant.searchText = getVariantSearchText(variant);
  return variant;
}

function matchesRangeFilter(value, filter, ranges) {
  if (!filter) return true;
  if (value === null || value === undefined || value === "") return filter === "unknown";
  const number = Number(value);
  if (filter === "unknown") return !Number.isFinite(number);
  const range = ranges[filter];
  if (!range || !Number.isFinite(number)) return false;
  return number >= range[0] && number < range[1];
}

/** Pure predicate for the catalog drawer's normalized filters. */
export function matchesDirectHardwareFilters(variant, filters = {}) {
  if (!variant) return false;
  if (filters.brand && variant.family?.brandId !== filters.brand) return false;
  if (filters.collection && variant.family?.collectionId !== filters.collection) return false;
  if (filters.category && variant.category !== filters.category) return false;
  if (filters.style && !(variant.styles || []).includes(filters.style)) return false;
  if (filters.finish && variant.canonicalFinishId !== filters.finish) return false;
  if (filters.exactFinish && `${variant.familyId}|${variant.finishVariantId}` !== filters.exactFinish) return false;
  if (filters.size && variant.sizeVariantId !== filters.size) return false;
  if (filters.priceTier && variant.priceTier !== filters.priceTier) return false;
  if (filters.region && !(variant.family?.regions || []).includes(filters.region)) return false;
  const availability = variant.availability?.status || variant.productStatus || "";
  if (filters.availability && filters.availability !== availability && !(filters.availability === "discontinued" && variant.productStatus === "discontinued")) return false;
  const isAccurate = String(variant.assetAccuracy).includes("dimensionally_accurate");
  if (filters.accurate === "accurate" && !isAccurate) return false;
  if (filters.accurate === "placeholder" && isAccurate) return false;
  if (!matchesRangeFilter(variant.dimensionsMm?.centerToCenter, filters.centerToCenter, {
    "single-hole": [0, 0.001],
    "under-96": [0.001, 96],
    "96-160": [96, 160.001],
    "over-160": [160.001, Number.POSITIVE_INFINITY]
  })) return false;
  if (!matchesRangeFilter(variant.dimensionsMm?.overallLength, filters.overallLength, {
    "under-100": [0, 100],
    "100-200": [100, 200.001],
    "over-200": [200.001, Number.POSITIVE_INFINITY]
  })) return false;
  return true;
}

function validationIssues(result) {
  if (Array.isArray(result?.errors)) return result.errors;
  if (Array.isArray(result?.issues)) return result.issues.filter((issue) => issue?.severity !== "warning");
  return [];
}

function validationSucceeded(result) {
  if (result === true || result === undefined) return true;
  if (result === false || result === null) return false;
  if (Array.isArray(result)) return result.length === 0;
  if (typeof result === "object") {
    if ("valid" in result) return result.valid === true;
    if ("success" in result) return result.success === true;
    if ("ok" in result) return result.ok === true;
    return validationIssues(result).length === 0;
  }
  return false;
}

async function loadCatalogThroughApi() {
  const api = hardwareCatalogApi;
  const catalog = await api.loadHardwareCatalog();
  const validation = api.validateHardwareCatalog(catalog);
  if (!validationSucceeded(validation)) {
    const issues = validationIssues(validation);
    const detail = issues[0]?.message || issues[0]?.code || "Catalog validation failed.";
    throw new Error(detail);
  }

  const apiIndex = api.createHardwareCatalogIndex(catalog);
  return { api, catalog, apiIndex, view: createDirectHardwareCatalogView(catalog, apiIndex) };
}

function categorySupportsHost(variant, host) {
  const placements = variant?.compatiblePlacements || [];
  if (!placements.length) return false;
  if (host?.role === "drawer_front") {
    return ["drawer_front", "drawer", "drawer_top_edge"].some((placement) => placements.includes(placement));
  }
  if (host?.role !== "door") return false;
  const paired = host.metadata?.leafCount === 2
    || host.metadata?.arrangement === "pair"
    || host.metadata?.paired === true
    || Boolean(host.metadata?.pairId);
  if (placements.includes("paired_door") && paired) return true;
  return ["door", "door_top_edge", "door_side_edge", "door_edge", "door_horizontal"]
    .some((placement) => placements.includes(placement));
}

/** Conservative presentation-level screening; the canonical engine remains authoritative. */
export function assessDirectHardwareCompatibility(variant, host) {
  if (!variant || !host || !FRONT_ROLES.has(host.role)) {
    return { status: "not_compatible", warnings: ["No compatible hardware host is available."] };
  }
  if (!categorySupportsHost(variant, host)) {
    return { status: "not_compatible", warnings: [`${variant.categoryLabel || "This hardware"} is not listed for ${host.role === "door" ? "doors" : "drawer fronts"}.`] };
  }

  const warnings = [];
  const dimensions = variant.dimensionsMm || {};
  const overall = Number(dimensions.overallLength);
  const width = Number(dimensions.width);
  const projection = Number(dimensions.projection);
  const longAxisInches = host.role === "door" ? finite(host.size?.y) : finite(host.size?.x);
  const shortAxisInches = host.role === "door" ? finite(host.size?.x) : finite(host.size?.y);
  const usableLongMm = Math.max(0, longAxisInches * 25.4 - 50.8);
  const usableShortMm = Math.max(0, shortAxisInches * 25.4 - 25.4);

  if (!Number.isFinite(overall) || !Number.isFinite(projection)) {
    warnings.push("Critical overall-length or projection data is missing; use requires review.");
  }
  if (Number.isFinite(overall) && overall > usableLongMm) {
    return { status: "not_compatible", warnings: ["Overall hardware length exceeds the usable mounting zone."] };
  }
  if (Number.isFinite(width) && width > usableShortMm) {
    return { status: "not_compatible", warnings: ["Hardware width exceeds the usable front zone."] };
  }
  const profile = host.metadata?.profileGeometry;
  if (profile?.kind && profile.kind !== "slab") {
    const placement = recommendedPlacement(host, variant);
    const regionId = placement.orientation === "horizontal"
      ? (placement.verticalAnchor === "bottom" ? "bottom_rail" : "top_rail")
      : (placement.horizontalAnchor === "left" ? "left_stile" : "right_stile");
    const region = profile.solidRegions?.find((item) => item.id === regionId);
    const crossEnvelopeMm = Number(dimensions.diameter ?? dimensions.width ?? dimensions.height);
    const regionCrossMm = region
      ? (placement.orientation === "horizontal"
        ? region.bounds.max.y - region.bounds.min.y
        : region.bounds.max.x - region.bounds.min.x) * 25.4
      : null;
    if (Number.isFinite(crossEnvelopeMm) && Number.isFinite(regionCrossMm) && crossEnvelopeMm > regionCrossMm - 6.35 + 1e-6) {
      return { status: "not_compatible", warnings: ["The hardware envelope is wider than this framed front's usable rail or stile."] };
    }
  }
  if (variant.category === "cabinet_latch") {
    return { status: "not_compatible", warnings: ["This latch requires a linked body-and-catch relationship across paired leaves; direct selection remains unavailable until that production relationship is modeled."] };
  }
  if (["edge_pull", "tab_pull", "cabinet_latch"].includes(variant.category)) {
    warnings.push("Edge routing, reveal, or catch placement must be confirmed during production review.");
  }
  if (variant.finish?.isLivingFinish) warnings.push("This living finish will patinate and may vary between pieces.");
  if (variant.family?.verificationCaveat) warnings.push(variant.family.verificationCaveat);
  if (warnings.length) return { status: "possible_with_warning", warnings };

  const recommended = variant.recommendedApplications.some((application) => {
    const text = String(application).toLowerCase();
    return host.role === "door" ? text.includes("door") || text.includes("front") : text.includes("drawer") || text.includes("front");
  });
  return { status: recommended ? "recommended" : "compatible", warnings: [] };
}

function recommendedPlacement(host, variant) {
  const isDrawer = host?.role === "drawer_front";
  const framedDrawer = isDrawer && host?.metadata?.profileGeometry?.kind !== "slab";
  const framedDoor = host?.role === "door" && host?.metadata?.profileGeometry?.kind !== "slab";
  const compatiblePlacements = variant?.compatiblePlacements || [];
  const doorHorizontal = host?.role === "door" && compatiblePlacements.some((placement) => ["door_horizontal", "door_top_edge", "door_edge"].includes(placement));
  const topEdge = isDrawer
    ? compatiblePlacements.includes("drawer_top_edge") || framedDrawer
    : compatiblePlacements.some((placement) => ["door_top_edge", "door_edge"].includes(placement)) || (framedDoor && doorHorizontal);
  const latchSide = latchSideForDoor(host);
  return {
    orientation: isDrawer || doorHorizontal ? "horizontal" : "vertical",
    horizontalAnchor: isDrawer ? "center" : (latchSide || "right"),
    verticalAnchor: topEdge ? "top" : "middle",
    edgeOffsetMm: isDrawer ? 0 : 50.8,
    crossAxisOffsetMm: 0,
    mirrored: latchSide === "left",
    quantityPerFront: 1
  };
}

export function getRecommendedDirectHardwarePlacement(host, variant) {
  return recommendedPlacement(host, variant);
}

export function normalizeDirectHardwarePlacement(value = {}) {
  const placement = {};
  if (["horizontal", "vertical"].includes(value.orientation)) placement.orientation = value.orientation;
  if (["left", "center", "right", "custom"].includes(value.horizontalAnchor)) placement.horizontalAnchor = value.horizontalAnchor;
  if (["top", "middle", "bottom", "custom"].includes(value.verticalAnchor)) placement.verticalAnchor = value.verticalAnchor;
  if (value.edgeOffsetMm !== null && value.edgeOffsetMm !== "" && Number.isFinite(Number(value.edgeOffsetMm))) {
    placement.edgeOffsetMm = clamp(Number(value.edgeOffsetMm), -304.8, 304.8);
  }
  if (value.crossAxisOffsetMm !== null && value.crossAxisOffsetMm !== "" && Number.isFinite(Number(value.crossAxisOffsetMm))) {
    placement.crossAxisOffsetMm = clamp(Number(value.crossAxisOffsetMm), -304.8, 304.8);
  }
  if (typeof value.mirrored === "boolean") placement.mirrored = value.mirrored;
  if ([1, 2].includes(Number(value.quantityPerFront))) placement.quantityPerFront = Number(value.quantityPerFront);
  return placement;
}

export function canDirectHardwareHostUseDoublePlacement(host) {
  const widthInches = Number(host?.size?.x ?? host?.dimensions?.widthInches ?? host?.widthInches);
  return Number.isFinite(widthInches) && widthInches >= 18;
}

function latchSideForDoor(host) {
  const latchSide = host?.metadata?.latchSide;
  if (latchSide === "latch_left" || latchSide === "left") return "left";
  if (latchSide === "latch_right" || latchSide === "right") return "right";
  if (host?.metadata?.hingeSide === "hinge_left" || host?.metadata?.hingeSide === "left") return "right";
  if (host?.metadata?.hingeSide === "hinge_right" || host?.metadata?.hingeSide === "right") return "left";
  return null;
}

/** Preserve latch-edge semantics when one scoped change spans oppositely handed doors. */
export function adaptDirectHardwarePlacementForHost(placement, sourceHost, targetHost, variant) {
  const adapted = normalizeDirectHardwarePlacement({
    ...recommendedPlacement(targetHost, variant),
    ...(placement || {})
  });
  if (sourceHost?.role !== "door" || targetHost?.role !== "door") return adapted;
  const sourceLatch = latchSideForDoor(sourceHost);
  const targetLatch = latchSideForDoor(targetHost);
  if (!sourceLatch || !targetLatch || sourceLatch === targetLatch) return adapted;
  if (["left", "right"].includes(adapted.horizontalAnchor)) {
    const sourceUsedLatchEdge = adapted.horizontalAnchor === sourceLatch;
    adapted.horizontalAnchor = sourceUsedLatchEdge ? targetLatch : (targetLatch === "left" ? "right" : "left");
  }
  adapted.mirrored = !Boolean(adapted.mirrored);
  return adapted;
}

/** Pure placement-control markup for focused accessibility and contract tests. */
export function renderDirectHardwarePlacementControls(value = {}, options = {}) {
  const placement = normalizeDirectHardwarePlacement(value);
  const canUseDouble = options.canUseDouble === true;
  const editable = options.selectable !== false;
  const longAxisAnchor = placement.orientation === "horizontal" ? placement.horizontalAnchor : placement.verticalAnchor;
  const edgeOffsetActive = placement.orientation === "horizontal"
    ? ["left", "right", "custom"].includes(longAxisAnchor)
    : ["top", "bottom", "custom"].includes(longAxisAnchor);
  const customLongAxis = longAxisAnchor === "custom";
  return `<fieldset class="direct-hardware-edit__placement"${editable ? "" : " disabled"}>
    <legend>Placement</legend>
    <div class="direct-hardware-edit__placement-grid">
      <label>Orientation<select data-placement-field="orientation"><option value="horizontal"${placement.orientation === "horizontal" ? " selected" : ""}>Horizontal</option><option value="vertical"${placement.orientation === "vertical" ? " selected" : ""}>Vertical</option></select></label>
      <label>Horizontal anchor<select data-placement-field="horizontalAnchor"><option value="left"${placement.horizontalAnchor === "left" ? " selected" : ""}>Left</option><option value="center"${placement.horizontalAnchor === "center" ? " selected" : ""}>Center</option><option value="right"${placement.horizontalAnchor === "right" ? " selected" : ""}>Right</option><option value="custom"${placement.horizontalAnchor === "custom" ? " selected" : ""}>Custom offset</option></select></label>
      <label>Vertical anchor<select data-placement-field="verticalAnchor"><option value="top"${placement.verticalAnchor === "top" ? " selected" : ""}>Top</option><option value="middle"${placement.verticalAnchor === "middle" ? " selected" : ""}>Middle</option><option value="bottom"${placement.verticalAnchor === "bottom" ? " selected" : ""}>Bottom</option><option value="custom"${placement.verticalAnchor === "custom" ? " selected" : ""}>Custom offset</option></select></label>
      <label title="Edge offset applies along the hardware's long axis; Custom measures from the front center and accepts signed values.">Edge offset (mm)<input type="number" inputmode="decimal" min="${customLongAxis ? "-304.8" : "0"}" max="304.8" step="1" data-placement-field="edgeOffsetMm" value="${escapeDirectHardwareHtml(placement.edgeOffsetMm ?? 0)}"${edgeOffsetActive ? "" : " disabled"}></label>
      <label>Cross-axis offset (mm)<input type="number" inputmode="decimal" min="-304.8" max="304.8" step="1" data-placement-field="crossAxisOffsetMm" value="${escapeDirectHardwareHtml(placement.crossAxisOffsetMm ?? 0)}"></label>
      <label>Quantity<select data-placement-field="quantityPerFront"><option value="1"${placement.quantityPerFront !== 2 ? " selected" : ""}>One per front</option><option value="2"${placement.quantityPerFront === 2 ? " selected" : ""}${canUseDouble ? "" : " disabled"}>Two per front${canUseDouble ? "" : " (18 in+ only)"}</option></select></label>
    </div>
    <div class="direct-hardware-edit__placement-footer"><label class="direct-hardware-edit__placement-check"><input type="checkbox" data-placement-field="mirrored"${placement.mirrored ? " checked" : ""}><span>Mirror placement</span></label><button type="button" data-reset-placement>Reset to recommendation</button></div>
  </fieldset>`;
}

function currentPricingTotal(pricing) {
  const rawTotal = pricing?.total ?? pricing?.grandTotal ?? pricing?.estimatedTotal;
  if (rawTotal === null || rawTotal === undefined || rawTotal === "") return null;
  const total = Number(rawTotal);
  return Number.isFinite(total) ? total : null;
}

function hardwareAllowanceDelta(pricing) {
  const rawDelta = pricing?.hardwarePricing?.estimatedDelta;
  if (rawDelta === null || rawDelta === undefined || rawDelta === "") return null;
  const delta = Number(rawDelta);
  return Number.isFinite(delta) ? delta : null;
}

/** Resolve preview impact without losing sub-$25 hardware changes to project rounding. */
export function resolveDirectHardwarePricingImpact(currentPricing, proposedPricing) {
  const currentHardware = hardwareAllowanceDelta(currentPricing);
  const proposedHardware = hardwareAllowanceDelta(proposedPricing);
  if (proposedHardware !== null) {
    return {
      delta: proposedHardware - (currentHardware ?? 0),
      source: "hardware_allowance"
    };
  }
  const currentTotal = currentPricingTotal(currentPricing);
  const proposedTotal = currentPricingTotal(proposedPricing);
  return {
    delta: currentTotal !== null && proposedTotal !== null ? proposedTotal - currentTotal : null,
    source: "project_total"
  };
}

function normalizeEvaluation(result, proposedState, canonicalLayout, canonicalPricing) {
  if (!result || typeof result !== "object") {
    return {
      accepted: true,
      state: proposedState,
      layout: canonicalLayout,
      pricing: canonicalPricing,
      warnings: [],
      issues: []
    };
  }
  const issues = result.issues || result.validation?.issues || result.errors || [];
  const errors = Array.isArray(issues)
    ? issues.filter((issue) => issue?.severity === "error" || issue?.level === "error" || typeof issue === "string")
    : [];
  const accepted = result.accepted !== false && result.valid !== false && result.validation?.valid !== false && errors.length === 0;
  return {
    accepted,
    state: result.state || result.config || result.candidateState || proposedState,
    layout: result.layout || result.candidateLayout || canonicalLayout,
    pricing: result.pricing || result.price || canonicalPricing,
    warnings: result.warnings || (Array.isArray(issues) ? issues.filter((issue) => issue?.severity === "warning") : []),
    issues: Array.isArray(issues) ? issues : []
  };
}

function hostSelectionState(state, catalogView) {
  const next = cloneDirectHardwareValue(state || {});
  next.hardwareSelections = hardwareCatalogApi.normalizeHardwareSelections(next.hardwareSelections, next.hardware);
  next.hardwareSelections.catalogVersion = catalogView.catalogVersion;
  return next;
}

function humanizeIssue(issue) {
  if (typeof issue === "string") return issue;
  return issue?.message || issue?.reason || issue?.code || "Hardware change requires review.";
}

function formatCurrency(value, currency = "USD") {
  if (!Number.isFinite(Number(value))) return null;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value));
  } catch {
    return `$${Math.round(Number(value)).toLocaleString("en-US")}`;
  }
}

function formatMillimeters(value, units) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "Not stated";
  if (units === "metric") return `${Math.round(number)} mm`;
  const inches = number / 25.4;
  const eighths = Math.round(inches * 8);
  const whole = Math.floor(eighths / 8);
  const remainder = eighths % 8;
  if (!remainder) return `${whole} in`;
  const divisor = remainder % 4 === 0 ? 4 : (remainder % 2 === 0 ? 2 : 1);
  return `${whole ? `${whole} ` : ""}${remainder / divisor}/${8 / divisor} in`;
}

function isEditableTextTarget(target) {
  const name = String(target?.tagName || "").toLowerCase();
  return ["input", "textarea", "select"].includes(name) || target?.isContentEditable;
}

function focusableElements(container) {
  if (!container?.querySelectorAll) return [];
  return [...container.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )].filter((element) => {
    if (element.hidden || element.getAttribute("aria-hidden") === "true") return false;
    return !element.closest?.('[hidden], [aria-hidden="true"], [inert]');
  });
}

function callSafely(callback, ...args) {
  try {
    return callback?.(...args);
  } catch {
    return undefined;
  }
}

/** Minimal registry shared by direct editors and future contextual tools. */
export class ContextualEditorRegistry {
  constructor() {
    this.byKind = new Map();
    this.kindByRole = new Map();
  }

  register(kind, descriptor = {}) {
    const normalizedKind = String(kind || "").trim();
    const roles = [...new Set((descriptor.roles || descriptor.pickableRoles || []).map(String).filter(Boolean))];
    if (!normalizedKind || !roles.length) throw new TypeError("A contextual editor requires a kind and at least one role.");
    const normalized = Object.freeze({
      kind: normalizedKind,
      enabled: descriptor.enabled !== false,
      semanticLabel: descriptor.semanticLabel || normalizedKind,
      analyticsKind: descriptor.analyticsKind || normalizedKind,
      ...descriptor,
      roles: Object.freeze(roles)
    });
    this.byKind.set(normalizedKind, normalized);
    for (const role of roles) this.kindByRole.set(role, normalizedKind);
    return normalized;
  }

  getForKind(kind) {
    return this.byKind.get(String(kind || "")) || null;
  }

  getForRole(role) {
    const kind = this.kindByRole.get(String(role || ""));
    return kind ? this.byKind.get(kind) || null : null;
  }

  list() {
    return [...this.byKind.values()];
  }
}

export function createDirectEditorRegistry() {
  const registry = new ContextualEditorRegistry();
  registry.register("hardware", {
    roles: ["handle", "door", "drawer_front"],
    enabled: true,
    semanticLabel: "Decorative hardware",
    analyticsKind: "hardware"
  });
  const planned = [
    ["shelves", ["shelf", "fixed_shelf"], "Shelf details"],
    ["section", ["section"], "Section layout"],
    ["base", ["base", "trim"], "Base and toe-kick profile"],
    ["crown", ["crown"], "Crown profile"]
  ];
  for (const [kind, roles, semanticLabel] of planned) {
    registry.register(kind, {
      roles,
      enabled: false,
      semanticLabel,
      analyticsKind: kind,
      planned: true
    });
  }
  return registry;
}

export class DirectHardwareEditor {
  constructor({
    host,
    viewer,
    getState,
    getLayout,
    getPricing,
    evaluateCandidate,
    commitState,
    emitEvent,
    announce,
    ownsViewerSelection = true,
    showHelper = true,
    onClose
  } = {}) {
    this.host = host || null;
    this.viewer = viewer || null;
    this.getState = typeof getState === "function" ? getState : () => ({});
    this.getLayout = typeof getLayout === "function" ? getLayout : () => ({ components: [] });
    this.getPricing = typeof getPricing === "function" ? getPricing : () => ({});
    this.evaluateCandidate = typeof evaluateCandidate === "function" ? evaluateCandidate : (state) => ({ accepted: true, state, layout: this.getLayout(), pricing: this.getPricing() });
    this.commitState = typeof commitState === "function" ? commitState : () => false;
    this.emitEvent = typeof emitEvent === "function" ? emitEvent : () => {};
    this.externalAnnounce = typeof announce === "function" ? announce : () => {};
    this.ownsViewerSelection = ownsViewerSelection !== false;
    this.showHelper = showHelper !== false;
    this.onClose = typeof onClose === "function" ? onClose : () => {};

    this.history = new BoundedHardwareHistory(DEFAULT_HISTORY_LIMIT);
    this.registry = createDirectEditorRegistry();
    this.presentation = {
      available: false,
      enabled: false,
      hoveredComponentId: null,
      selected: null,
      scope: HARDWARE_APPLICATION_SCOPES.item,
      draft: null,
      previewed: false,
      query: "",
      filters: {
        brand: "",
        collection: "",
        category: "",
        style: "",
        finish: "",
        exactFinish: "",
        size: "",
        centerToCenter: "",
        overallLength: "",
        priceTier: "",
        availability: "",
        region: "",
        accurate: ""
      },
      sort: "recommended",
      libraryMode: "all",
      compare: new Set(),
      favorites: new Set(),
      recents: [],
      units: "imperial",
      scaleHeightInches: null,
      customScaleHeightInches: 66,
      largeApplyArmed: false,
      drawerOpen: false,
      componentsOpen: false,
      detailsVariantId: null,
      placementDraft: null
    };

    this.catalog = null;
    this.catalogApi = null;
    this.catalogApiIndex = null;
    this.catalogError = null;
    this.canonicalState = null;
    this.canonicalLayout = null;
    this.canonicalPricing = null;
    this.modelHost = null;
    this.root = null;
    this.elements = {};
    this.initialized = false;
    this.destroyed = false;
    this.previewToken = 0;
    this.canonicalRevision = 0;
    this.focusReturn = null;
    this.drawerFocusReturn = null;
    this.detailsFocusReturn = null;

    this.boundRootClick = (event) => this.handleRootClick(event);
    this.boundRootInput = (event) => this.handleRootInput(event);
    this.boundRootChange = (event) => this.handleRootChange(event);
    this.boundKeyDown = (event) => this.handleKeyDown(event);
    this.boundResize = () => this.updateAnchor();
  }

  async init() {
    if (this.destroyed) return false;
    if (this.initialized) return !this.catalogError;
    this.modelHost = this.host?.matches?.(".configurator-model")
      ? this.host
      : this.host?.querySelector?.(".configurator-model");
    if (!this.modelHost && this.host?.appendChild) this.modelHost = this.host;
    if (!this.modelHost?.ownerDocument) return false;

    const wrapper = this.modelHost.ownerDocument.createElement("div");
    wrapper.innerHTML = renderDirectHardwareEditorMarkup({ catalogStatus: "loading" }).trim();
    this.root = wrapper.firstElementChild;
    this.modelHost.appendChild(this.root);
    this.cacheElements();
    this.root.addEventListener("click", this.boundRootClick);
    this.root.addEventListener("input", this.boundRootInput);
    this.root.addEventListener("change", this.boundRootChange);
    this.modelHost.ownerDocument.addEventListener("keydown", this.boundKeyDown);
    this.modelHost.ownerDocument.defaultView?.addEventListener("resize", this.boundResize, { passive: true });
    this.initialized = true;

    try {
      const loaded = await loadCatalogThroughApi();
      if (this.destroyed) return false;
      this.catalogApi = loaded.api;
      this.catalogApiIndex = loaded.apiIndex;
      this.catalog = loaded.view;
      if (!this.catalog.variants.length || !this.catalog.families.size) throw new Error("The validated hardware catalog is empty.");
      this.root.dataset.catalogState = "ready";
      this.elements.loading.hidden = true;
      this.renderLibraryChrome();
      this.sync();
      this.announceStatus("Curated hardware is ready. Choose a handle, door, or drawer to edit.");
      this.track("catalog_ready", { catalogVersion: this.catalog.catalogVersion, variantCount: this.catalog.variants.length });
      return true;
    } catch (error) {
      if (this.destroyed) return false;
      this.catalogError = error instanceof Error ? error : new Error(String(error));
      this.failSafely(this.catalogError);
      return false;
    }
  }

  cacheElements() {
    const query = (selector) => this.root.querySelector(selector);
    this.elements = {
      loading: query("[data-direct-loading]"),
      fallback: query("[data-direct-fallback]"),
      helper: query("[data-direct-helper]"),
      helperButton: query("[data-direct-toggle]"),
      hoverLabel: query("[data-direct-hover-label]"),
      leader: query("[data-direct-leader]"),
      leaderLine: query("[data-direct-leader-line]"),
      anchorDot: query("[data-direct-anchor-dot]"),
      quickCard: query("[data-direct-quick-card]"),
      quickContent: query("[data-direct-quick-content]"),
      componentsPanel: query("[data-components-panel]"),
      componentTree: query("[data-editable-components]"),
      library: query("[data-hardware-library]"),
      libraryBackdrop: query("[data-library-backdrop]"),
      libraryBody: query("[data-library-body]"),
      details: query("[data-product-details]"),
      scaleReference: query("[data-scale-reference]"),
      scaleLabel: query("[data-scale-label]"),
      customScaleField: query("[data-custom-scale-field]"),
      customScaleInput: query("[data-custom-scale]"),
      overallHeight: query("[data-overall-height]"),
      measurementOverlay: query("[data-measurement-overlay]"),
      heightLine: query("[data-height-line]"),
      heightTickStart: query("[data-height-tick-start]"),
      heightTickEnd: query("[data-height-tick-end]"),
      heightLabel: query("[data-height-label]"),
      liveStatus: query("[data-direct-status]")
    };
  }

  failSafely(error) {
    this.presentation.enabled = false;
    this.root.dataset.catalogState = "invalid";
    this.root.dataset.enabled = "false";
    this.elements.loading.hidden = true;
    this.elements.helper.hidden = true;
    this.elements.fallback.hidden = false;
    if (this.ownsViewerSelection) {
      callSafely(this.viewer?.setDirectEditing?.bind(this.viewer), { enabled: false });
    }
    const message = "Direct hardware editing could not start. Continue with the existing Hardware control; your accepted design is unchanged.";
    this.announceStatus(message);
    this.track("fallback", { reason: error?.message || "catalog_invalid" });
  }

  setEnabled(enabled) {
    const next = Boolean(enabled) && this.presentation.available && Boolean(this.catalog) && !this.catalogError && !this.destroyed;
    if (!next && this.presentation.selected) this.close("disabled");
    this.presentation.enabled = next;
    if (this.root) {
      this.root.dataset.enabled = String(next);
      if (this.elements.helperButton) this.elements.helperButton.setAttribute("aria-pressed", String(next));
    }
    if (this.ownsViewerSelection) {
      callSafely(this.viewer?.setDirectEditing?.bind(this.viewer), {
        enabled: next,
        onHover: (selection) => this.handleViewerHover(selection),
        onSelect: (selection) => this.openForComponent(selection),
        onAnchorChange: (anchor) => this.updateAnchor(anchor)
      });
    }
    if (next) {
      this.sync();
      this.announceStatus("Direct editing enabled. Choose a handle, door, or drawer.");
    }
    return next;
  }

  setAvailable(available) {
    const next = Boolean(available) && Boolean(this.catalog) && !this.catalogError && !this.destroyed;
    this.presentation.available = next;
    if (this.root) {
      this.root.dataset.available = String(next);
      if (this.elements.helper) this.elements.helper.hidden = !next || !this.showHelper;
    }
    if (!next) this.setEnabled(false);
    else this.setEnabled(true);
    return next;
  }

  sync(options = {}) {
    if (this.destroyed) return false;
    const hadPreview = this.presentation.previewed || Boolean(this.presentation.draft);
    this.canonicalRevision += 1;
    if (options.source === "external") this.previewToken += 1;
    this.canonicalState = cloneDirectHardwareValue(this.getState() || {});
    this.canonicalLayout = this.getLayout() || { components: [] };
    this.canonicalPricing = this.getPricing() || {};
    if (options.source === "external" && (options.changedFields || []).some((field) => ["hardware", "hardwareSelections"].includes(field))) {
      this.history.clear();
    }
    if (hadPreview) {
      if (options.source !== "external") this.previewToken += 1;
      this.presentation.previewed = false;
      this.presentation.draft = null;
      this.presentation.placementDraft = null;
      this.presentation.largeApplyArmed = false;
      if (options.source !== "direct_commit") {
        callSafely(this.viewer?.restorePreview?.bind(this.viewer), this.canonicalState, this.canonicalLayout);
        this.announceStatus("The hardware preview was cleared because the accepted design changed.");
      }
    }
    this.renderComponentTree();
    this.updateScaleReference();

    if (this.presentation.selected) {
      const selectedId = this.presentation.selected.anchorComponent?.id || this.presentation.selected.component?.id;
      const refreshed = this.presentation.selected.plannedDescriptor
        ? this.resolveAnyContextualSelection(selectedId)
        : resolveHardwareSelection(this.canonicalLayout, selectedId);
      if (!refreshed) {
        this.close("component-removed");
      } else if (this.presentation.selected.plannedDescriptor) {
        this.presentation.selected = {
          component: refreshed.component,
          host: refreshed.component,
          anchorComponent: refreshed.component,
          section: null,
          sectionId: refreshed.component.id,
          plannedDescriptor: refreshed.descriptor
        };
        this.renderQuickCard();
        this.updateAnchor();
      } else {
        this.presentation.selected = refreshed;
        if (!this.presentation.previewed) this.renderQuickCard();
        this.updateAnchor();
      }
    }
    this.updateHistoryControls();
    return true;
  }

  openForComponent(selection) {
    if (!this.presentation.enabled || !this.catalog || this.catalogError) return false;
    this.canonicalState = cloneDirectHardwareValue(this.getState() || {});
    this.canonicalLayout = this.getLayout() || { components: [] };
    this.canonicalPricing = this.getPricing() || {};
    const resolved = resolveHardwareSelection(this.canonicalLayout, selection);
    if (!resolved) {
      const contextual = this.resolveAnyContextualSelection(selection);
      if (contextual?.descriptor?.planned) return this.openPlannedEditor(contextual);
      this.announceStatus("That component does not currently support direct hardware editing.");
      return false;
    }

    // Always invalidate a pending preview, including the first async preview
    // before it has reached the renderer and set `previewed`.
    this.restoreCanonicalPreview();
    this.focusReturn = this.modelHost.ownerDocument.activeElement;
    this.presentation.selected = resolved;
    this.presentation.scope = HARDWARE_APPLICATION_SCOPES.item;
    this.presentation.draft = null;
    this.presentation.placementDraft = null;
    this.presentation.previewed = false;
    this.presentation.largeApplyArmed = false;
    this.elements.quickCard.hidden = false;
    this.root.dataset.hasSelection = "true";
    callSafely(this.viewer?.setSelectedComponent?.bind(this.viewer), resolved.anchorComponent.id);
    this.renderComponentTree();
    this.renderQuickCard();
    this.updateAnchor();
    const label = this.semanticHostLabel(resolved.host);
    this.announceStatus(`${label} selected. Choose a hardware option, application scope, or open the full library.`);
    this.track("select", { componentId: resolved.component.id, hostId: resolved.host.id, role: resolved.host.role });
    this.track("open", { editor: "hardware", componentId: resolved.component.id });
    return true;
  }

  close(reason = "close") {
    if (!this.presentation.selected && !this.presentation.drawerOpen) return false;
    const priorSelection = this.presentation.selected;
    if (this.presentation.drawerOpen) this.closeLibrary({ restoreFocus: false });
    // Escape/close must cancel both a rendered preview and any in-flight
    // candidate evaluation or renderer promise.
    this.restoreCanonicalPreview();
    this.elements.quickCard.hidden = true;
    this.elements.leader.hidden = true;
    this.presentation.selected = null;
    this.presentation.draft = null;
    this.presentation.placementDraft = null;
    this.presentation.previewed = false;
    this.presentation.largeApplyArmed = false;
    delete this.root.dataset.hasSelection;
    if (this.ownsViewerSelection) callSafely(this.viewer?.clearDirectSelection?.bind(this.viewer));
    this.renderComponentTree();
    if (!["apply", "destroy", "disabled"].includes(reason)) {
      this.track("cancel", { reason, componentId: priorSelection?.component?.id || null });
    }
    const focusTarget = this.focusReturn?.isConnected
      ? this.focusReturn
      : this.modelHost.querySelector?.("[data-3d-viewer]");
    focusTarget?.focus?.({ preventScroll: true });
    this.focusReturn = null;
    this.onClose(reason, priorSelection);
    return true;
  }

  destroy() {
    if (this.destroyed) return;
    this.close("destroy");
    this.destroyed = true;
    this.previewToken += 1;
    if (this.ownsViewerSelection) {
      callSafely(this.viewer?.setDirectEditing?.bind(this.viewer), { enabled: false });
    }
    this.root?.removeEventListener("click", this.boundRootClick);
    this.root?.removeEventListener("input", this.boundRootInput);
    this.root?.removeEventListener("change", this.boundRootChange);
    this.modelHost?.ownerDocument?.removeEventListener("keydown", this.boundKeyDown);
    this.modelHost?.ownerDocument?.defaultView?.removeEventListener("resize", this.boundResize);
    this.root?.remove();
    this.root = null;
    this.elements = {};
    this.history.clear();
  }

  async undo() {
    const command = this.history.peekUndo();
    if (!command || this.destroyed) return false;
    this.restoreCanonicalPreview();
    const result = await this.commitHistoricalState(command.beforeState, {
      action: "undo",
      command: command.metadata
    });
    if (!result) return false;
    this.history.commitUndo();
    this.announceStatus(`Undid hardware change${command.metadata?.affectedCount ? ` for ${command.metadata.affectedCount} component${command.metadata.affectedCount === 1 ? "" : "s"}` : ""}.`);
    this.track("undo", { variantId: command.metadata?.variantId, scope: command.metadata?.scope });
    this.sync();
    return true;
  }

  async redo() {
    const command = this.history.peekRedo();
    if (!command || this.destroyed) return false;
    this.restoreCanonicalPreview();
    const result = await this.commitHistoricalState(command.afterState, {
      action: "redo",
      command: command.metadata
    });
    if (!result) return false;
    this.history.commitRedo();
    this.announceStatus(`Redid hardware change${command.metadata?.affectedCount ? ` for ${command.metadata.affectedCount} component${command.metadata.affectedCount === 1 ? "" : "s"}` : ""}.`);
    this.track("redo", { variantId: command.metadata?.variantId, scope: command.metadata?.scope });
    this.sync();
    return true;
  }

  async commitHistoricalState(state, metadata) {
    try {
      const currentState = cloneDirectHardwareValue(this.getState() || this.canonicalState || {});
      const nextState = {
        ...currentState,
        hardwareSelections: cloneDirectHardwareValue(state?.hardwareSelections || currentState.hardwareSelections)
      };
      const result = await this.commitState(nextState, {
        source: "direct-hardware-editor",
        kind: "hardwareSelections",
        historyAction: metadata.action,
        originalCommand: metadata.command
      });
      if (result === false || result?.accepted === false) return false;
      const acceptedState = result?.state || result?.config || nextState;
      const acceptedLayout = result?.layout || this.getLayout();
      callSafely(this.viewer?.restorePreview?.bind(this.viewer), acceptedState, acceptedLayout);
      return true;
    } catch (error) {
      this.announceStatus(`Could not ${metadata.action} the hardware change. ${error?.message || "The prior design remains accepted."}`);
      return false;
    }
  }

  semanticHostLabel(host) {
    if (!host) return "Hardware component";
    if (host.role === "drawer_front") {
      const ordinal = host.metadata?.ordinal;
      return ordinal ? `Drawer ${ordinal} hardware` : "Drawer hardware";
    }
    if (host.role === "door") {
      const side = host.metadata?.hingeSide === "hinge_left" ? "left-hinged" : (host.metadata?.hingeSide === "hinge_right" ? "right-hinged" : "");
      return `${side ? `${side} ` : ""}door hardware`;
    }
    return String(host.role || "component").replaceAll("_", " ");
  }

  resolveAnyContextualSelection(selection) {
    const layout = this.canonicalLayout || this.getLayout() || { components: [] };
    const componentId = getComponentId(selection);
    const component = componentsFromLayout(layout).find((item) => item.id === componentId)
      || selection?.descriptor
      || selection?.component
      || null;
    if (!component) return null;
    const descriptor = this.registry.getForRole(component.role);
    return descriptor ? { component, descriptor } : null;
  }

  openPlannedEditor(contextual) {
    if (!contextual?.component || !contextual?.descriptor) return false;
    this.restoreCanonicalPreview();
    this.focusReturn = this.modelHost.ownerDocument.activeElement;
    this.presentation.selected = {
      component: contextual.component,
      host: contextual.component,
      anchorComponent: contextual.component,
      section: null,
      sectionId: contextual.component.id,
      plannedDescriptor: contextual.descriptor
    };
    this.presentation.draft = null;
    this.presentation.placementDraft = null;
    this.presentation.previewed = false;
    this.elements.quickCard.hidden = false;
    this.root.dataset.hasSelection = "true";
    callSafely(this.viewer?.setSelectedComponent?.bind(this.viewer), contextual.component.id);
    this.renderComponentTree();
    this.renderQuickCard();
    this.updateAnchor();
    this.announceStatus(`${contextual.descriptor.semanticLabel} selected. Direct editing for this component is planned; existing controls remain available.`);
    this.track("planned_select", {
      componentId: contextual.component.id,
      role: contextual.component.role,
      editorKind: contextual.descriptor.analyticsKind
    });
    return true;
  }

  getCurrentVariantId(state = this.canonicalState) {
    if (!this.catalog || !this.presentation.selected || this.presentation.selected.plannedDescriptor) return null;
    const hostId = this.presentation.selected.host.id;
    const selections = state?.hardwareSelections;
    if (state?.hardware === "push_latch" && !selections?.byHostId?.[hostId]) return null;
    const variantId = selections?.byHostId?.[hostId]?.variantId || selections?.defaultVariantId;
    const savedEntry = selections?.byHostId?.[hostId];
    const savedSnapshot = savedEntry?.variantId === variantId ? savedEntry.snapshot : selections?.defaultSnapshot;
    if (variantId && (this.catalog.variantsById.has(variantId) || savedSnapshot)) return variantId;
    const hint = LEGACY_HARDWARE_HINTS[state?.hardware] || LEGACY_HARDWARE_HINTS.brass_pull;
    return this.catalog.variants.find((variant) =>
      hint.categories.includes(variant.category) && hint.finishes.includes(variant.canonicalFinishId)
    )?.id || this.catalog.variants[0]?.id || null;
  }

  getSelectedVariant() {
    const variantId = this.presentation.draft?.variantId || this.getCurrentVariantId();
    return variantId ? this.getVariantById(variantId) : null;
  }

  getVariantById(variantId, state = this.canonicalState) {
    const catalogVariant = this.catalog?.variantsById.get(variantId);
    if (catalogVariant) return catalogVariant;
    const hostId = this.presentation.selected?.host?.id;
    const selections = state?.hardwareSelections;
    const hostEntry = hostId ? selections?.byHostId?.[hostId] : null;
    const snapshot = hostEntry?.variantId === variantId
      ? hostEntry.snapshot
      : selections?.defaultVariantId === variantId ? selections.defaultSnapshot : null;
    return createSavedHardwareVariantView(snapshot, variantId);
  }

  getActivePlacement(variant = this.getSelectedVariant()) {
    if (!this.presentation.selected || this.presentation.selected.plannedDescriptor) return {};
    if (this.presentation.placementDraft) return cloneDirectHardwareValue(this.presentation.placementDraft);
    const host = this.presentation.selected.host;
    const hostId = host.id;
    const draftEntry = this.presentation.draft?.state?.hardwareSelections?.byHostId?.[hostId];
    const canonicalSelections = hardwareCatalogApi.normalizeHardwareSelections(
      this.canonicalState?.hardwareSelections,
      this.canonicalState?.hardware
    );
    const currentEntry = draftEntry || canonicalSelections.byHostId?.[hostId];
    return normalizeDirectHardwarePlacement({
      ...recommendedPlacement(host, variant),
      ...(currentEntry?.placement || {})
    });
  }

  canUseDoublePlacement() {
    return canDirectHardwareHostUseDoublePlacement(this.presentation.selected?.host);
  }

  neutralThumbnail(category) {
    const normalized = safeId(category || "hardware");
    return `<span class="direct-hardware-edit__thumbnail" data-thumbnail-category="${escapeDirectHardwareHtml(normalized)}" aria-hidden="true"><i></i><b></b><i></i></span>`;
  }

  replaceQuickContent(markup) {
    const container = this.elements.quickContent;
    if (!container) return;
    const active = container.ownerDocument?.activeElement;
    const dataAttributes = [
      "data-preview-variant", "data-placement-field", "data-hardware-scope",
      "data-favorite-family", "data-open-library", "data-product-details",
      "data-cancel-preview", "data-apply-hardware", "data-history-undo",
      "data-history-redo", "data-cancel-direct", "data-reset-placement"
    ];
    const focusAttribute = active && container.contains(active)
      ? dataAttributes.find((attribute) => active.hasAttribute?.(attribute))
      : null;
    const focusValue = focusAttribute ? active.getAttribute(focusAttribute) : null;
    let selection = null;
    try {
      if (active && Number.isInteger(active.selectionStart)) selection = [active.selectionStart, active.selectionEnd];
    } catch {}

    container.innerHTML = String(markup || "");
    if (!focusAttribute) return;
    const escapedValue = String(focusValue || "").replace(/[\\"]/g, "\\$&");
    const selector = focusValue ? `[${focusAttribute}="${escapedValue}"]` : `[${focusAttribute}]`;
    const replacement = container.querySelector(selector);
    replacement?.focus?.({ preventScroll: true });
    if (replacement && selection) {
      try { replacement.setSelectionRange(selection[0], selection[1]); } catch {}
    }
  }

  renderPlannedCard() {
    const selected = this.presentation.selected;
    const descriptor = selected?.plannedDescriptor;
    const component = selected?.component;
    const titleId = this.elements.quickCard.getAttribute("aria-labelledby") || "direct-hardware-quick-title";
    this.replaceQuickContent(`
      <header class="direct-hardware-edit__card-header">
        <div><span class="direct-hardware-edit__eyebrow">Selected on model</span><h2 id="${escapeDirectHardwareHtml(titleId)}">${escapeDirectHardwareHtml(descriptor.semanticLabel)}</h2></div>
        <button type="button" class="direct-hardware-edit__icon-button" data-cancel-direct aria-label="Close contextual editor">${closeIcon}</button>
      </header>
      <div class="direct-hardware-edit__planned-state">
        <span class="direct-hardware-edit__selection-mark" aria-hidden="true">${editIcon}</span>
        <div><strong>${escapeDirectHardwareHtml(String(component.role).replaceAll("_", " "))} selected</strong><p>This contextual editor is planned. Use the existing configurator controls for this option today.</p></div>
      </div>
      <div class="direct-hardware-edit__card-actions">
        <button type="button" class="direct-hardware-edit__button direct-hardware-edit__button--secondary" data-cancel-direct>Return to model</button>
      </div>`);
  }

  renderQuickCard() {
    if (!this.elements.quickContent || !this.presentation.selected) return;
    if (this.presentation.selected.plannedDescriptor) {
      this.renderPlannedCard();
      return;
    }
    if (this.canonicalState?.hardware === "push_latch" && !this.canonicalState?.hardwareSelections?.byHostId?.[this.presentation.selected.host.id]) {
      const titleId = this.elements.quickCard.getAttribute("aria-labelledby") || "direct-hardware-quick-title";
      this.replaceQuickContent(`
        <header class="direct-hardware-edit__card-header">
          <div><span class="direct-hardware-edit__eyebrow">${escapeDirectHardwareHtml(this.semanticHostLabel(this.presentation.selected.host))}</span><h2 id="${escapeDirectHardwareHtml(titleId)}">No visible hardware</h2></div>
          <button type="button" class="direct-hardware-edit__icon-button" data-cancel-direct aria-label="Close hardware editor">${closeIcon}</button>
        </header>
        <div class="direct-hardware-edit__planned-state"><span class="direct-hardware-edit__selection-mark" aria-hidden="true">${editIcon}</span><div><strong>Push-latch front</strong><p>This accepted front has no decorative handle. Open the curated library to preview visible hardware on it.</p></div></div>
        <div class="direct-hardware-edit__card-actions"><button type="button" class="direct-hardware-edit__button direct-hardware-edit__button--secondary" data-cancel-direct>Return to model</button><button type="button" class="direct-hardware-edit__button direct-hardware-edit__button--primary" data-open-library>View all hardware</button></div>`);
      return;
    }
    const variant = this.getSelectedVariant();
    if (!variant) {
      this.replaceQuickContent(`<p class="direct-hardware-edit__empty">No compatible catalog variant is available for this front.</p>`);
      return;
    }

    const draft = this.presentation.draft;
    const scopeResult = draft?.scopeResult || resolveHardwareScope(this.canonicalLayout, this.presentation.selected.component, this.presentation.scope);
    const affectedCount = draft?.affectedHosts?.length || 0;
    const exclusions = draft?.exclusions || scopeResult.excluded || [];
    const releaseWarnings = variant.releaseWarnings?.length
      ? variant.releaseWarnings
      : (!variant.selectable ? ["This saved variant is not selectable for new work."] : []);
    const warnings = [...releaseWarnings, ...(draft?.warnings || [])];
    const priceImpact = resolveDirectHardwarePricingImpact(this.canonicalPricing, draft?.pricing);
    const delta = priceImpact.delta;
    const priceLabel = priceImpact.source === "hardware_allowance" ? "Estimated hardware allowance impact" : "Prospective impact";
    const quoteOnlyPosture = variant.pricing?.mode === "quote_only"
      ? "Price confirmed with quote"
      : variant.pricing?.mode === "band" ? `${variant.pricing?.priceBand || "Catalog price band"} · confirmed with quote` : null;
    const priceText = quoteOnlyPosture || (!draft
      ? "Preview to estimate"
      : (delta === null
        ? "Estimate unavailable"
        : (Math.abs(delta) < 0.005
          ? (priceImpact.source === "hardware_allowance" ? "No estimated hardware allowance change" : "No estimated project-price change")
          : `${delta > 0 ? "+" : "−"}${formatCurrency(Math.abs(delta), variant.pricing?.currency || "USD")} estimated ${priceImpact.source === "hardware_allowance" ? "hardware allowance" : "project total"}`)));
    const titleId = this.elements.quickCard.getAttribute("aria-labelledby") || "direct-hardware-quick-title";
    const finishes = this.getFamilyFinishOptions(variant);
    const recommendations = this.getRecommendations(variant, 4);
    const favorite = this.presentation.favorites.has(variant.familyId);
    const placement = this.getActivePlacement(variant);
    const canUseDouble = this.canUseDoublePlacement();
    const canApply = Boolean(variant.selectable && draft?.accepted && affectedCount > 0);
    const confirmText = this.presentation.largeApplyArmed ? `Confirm ${affectedCount} changes` : "Apply";
    const committedModelAccuracy = this.presentation.selected.handle?.metadata?.modelAccuracy
      || this.presentation.selected.anchorComponent?.metadata?.modelAccuracy;
    const displayAccuracy = draft ? variant.accuracyLabel : accuracyLabel(committedModelAccuracy || variant.assetAccuracy);

    this.replaceQuickContent(`
      <header class="direct-hardware-edit__card-header">
        <div><span class="direct-hardware-edit__eyebrow">${escapeDirectHardwareHtml(this.semanticHostLabel(this.presentation.selected.host))}</span><h2 id="${escapeDirectHardwareHtml(titleId)}">${escapeDirectHardwareHtml(variant.familyName)}</h2></div>
        <div class="direct-hardware-edit__header-actions">
          <button type="button" class="direct-hardware-edit__icon-button" data-favorite-family="${escapeDirectHardwareHtml(variant.familyId)}" aria-pressed="${favorite}" aria-label="${favorite ? "Remove from" : "Add to"} favorites">♡</button>
          <button type="button" class="direct-hardware-edit__icon-button" data-cancel-direct aria-label="Close hardware editor">${closeIcon}</button>
        </div>
      </header>
      <div class="direct-hardware-edit__product-lead">
        ${this.neutralThumbnail(variant.category)}
        <div><strong>${escapeDirectHardwareHtml(variant.brandName)} · ${escapeDirectHardwareHtml(variant.collectionName)}</strong><span>${escapeDirectHardwareHtml(variant.categoryLabel)}</span><span class="direct-hardware-edit__accuracy">${escapeDirectHardwareHtml(displayAccuracy)}</span></div>
      </div>
      <dl class="direct-hardware-edit__facts">
        <div><dt>Selected size</dt><dd>${escapeDirectHardwareHtml(variant.sizeLabel)}</dd></div>
        <div><dt>Finish</dt><dd>${escapeDirectHardwareHtml(variant.finishName)}${variant.finishCode ? ` · ${escapeDirectHardwareHtml(variant.finishCode)}` : ""}</dd></div>
        <div><dt>Center to center</dt><dd>${escapeDirectHardwareHtml(formatMillimeters(variant.dimensionsMm.centerToCenter, this.presentation.units))}</dd></div>
        <div><dt>Overall length</dt><dd>${escapeDirectHardwareHtml(formatMillimeters(variant.dimensionsMm.overallLength, this.presentation.units))}</dd></div>
        <div><dt>Projection</dt><dd>${escapeDirectHardwareHtml(formatMillimeters(variant.dimensionsMm.projection, this.presentation.units))}</dd></div>
        <div><dt>Material</dt><dd>${escapeDirectHardwareHtml(variant.material || "Not stated")}</dd></div>
      </dl>
      <div class="direct-hardware-edit__price-impact"><span>${escapeDirectHardwareHtml(priceLabel)}</span><strong>${escapeDirectHardwareHtml(priceText)}</strong></div>
      <section class="direct-hardware-edit__option-section" aria-labelledby="${escapeDirectHardwareHtml(titleId)}-finishes">
        <h3 id="${escapeDirectHardwareHtml(titleId)}-finishes">Available family finishes</h3>
        <div class="direct-hardware-edit__swatches">${finishes.map((option) => `
          <button type="button" data-preview-variant="${escapeDirectHardwareHtml(option.id)}" aria-pressed="${option.id === variant.id}" aria-label="${option.selectable ? "Preview" : "Release gated; cannot preview"} ${escapeDirectHardwareHtml(option.finishName)}"${option.selectable ? "" : " disabled"}>
            <span style="--direct-swatch:${safeSwatch(option.swatch)}"></span><small>${escapeDirectHardwareHtml(option.finishName)}</small>
          </button>`).join("")}</div>
      </section>
      <section class="direct-hardware-edit__option-section" aria-labelledby="${escapeDirectHardwareHtml(titleId)}-scope">
        <label id="${escapeDirectHardwareHtml(titleId)}-scope">Apply to
          <select data-hardware-scope${variant.selectable ? "" : " disabled"}>${Object.entries(SCOPE_LABELS).map(([value, label]) => `<option value="${value}"${value === this.presentation.scope ? " selected" : ""}>${escapeDirectHardwareHtml(label)}</option>`).join("")}</select>
        </label>
        <p class="direct-hardware-edit__scope-summary">${draft ? `${affectedCount} compatible component${affectedCount === 1 ? "" : "s"} will change.` : "Choose an option to preview the affected components."}${exclusions.length ? ` ${exclusions.length} excluded.` : ""}</p>
      </section>
      ${renderDirectHardwarePlacementControls(placement, { canUseDouble, selectable: variant.selectable })}
      ${warnings.length || exclusions.length ? `<div class="direct-hardware-edit__warnings" role="status"><strong>Review before applying</strong><ul>${[...warnings.map(humanizeIssue), ...exclusions.map(humanizeIssue)].slice(0, 5).map((warning) => `<li>${escapeDirectHardwareHtml(warning)}</li>`).join("")}</ul></div>` : ""}
      ${recommendations.length ? `<section class="direct-hardware-edit__option-section"><h3>Compatible recommendations</h3><div class="direct-hardware-edit__recommendations">${recommendations.map((option) => `<button type="button" data-preview-variant="${escapeDirectHardwareHtml(option.id)}">${this.neutralThumbnail(option.category)}<span><strong>${escapeDirectHardwareHtml(option.brandName)}</strong><small>${escapeDirectHardwareHtml(option.familyName)}</small></span></button>`).join("")}</div></section>` : ""}
      <div class="direct-hardware-edit__secondary-links">
        <button type="button" data-open-library>View all hardware</button>
        <button type="button" data-product-details="${escapeDirectHardwareHtml(variant.id)}">Product details</button>
      </div>
      <div class="direct-hardware-edit__history-actions" aria-label="Hardware history">
        <button type="button" data-history-undo${this.history.canUndo ? "" : " disabled"}>Undo</button>
        <button type="button" data-history-redo${this.history.canRedo ? "" : " disabled"}>Redo</button>
      </div>
      <div class="direct-hardware-edit__card-actions">
        <button type="button" class="direct-hardware-edit__button direct-hardware-edit__button--secondary" data-cancel-preview>Cancel</button>
        <button type="button" class="direct-hardware-edit__button direct-hardware-edit__button--primary" data-apply-hardware${canApply ? "" : " disabled"}>${escapeDirectHardwareHtml(confirmText)}</button>
      </div>`);
  }

  getFamilyFinishOptions(variant) {
    const members = this.catalog?.variantsByFamily.get(variant.familyId) || [];
    const sameSize = members.filter((item) => item.sizeVariantId === variant.sizeVariantId);
    const seen = new Set();
    return sameSize.filter((item) => {
      if (seen.has(item.finishVariantId)) return false;
      seen.add(item.finishVariantId);
      return true;
    }).slice(0, 8);
  }

  getRecommendations(variant, limit = 4) {
    const host = this.presentation.selected?.host;
    return (this.catalog?.variants || [])
      .filter((candidate) => candidate.id !== variant.id && candidate.selectable)
      .filter((candidate) => assessDirectHardwareCompatibility(candidate, host).status !== "not_compatible")
      .sort((left, right) => {
        const leftScore = (left.category === variant.category ? 4 : 0) + (left.canonicalFinishId === variant.canonicalFinishId ? 2 : 0) + (left.familyId === variant.familyId ? 1 : 0);
        const rightScore = (right.category === variant.category ? 4 : 0) + (right.canonicalFinishId === variant.canonicalFinishId ? 2 : 0) + (right.familyId === variant.familyId ? 1 : 0);
        return rightScore - leftScore;
      })
      .filter((candidate, index, all) => all.findIndex((item) => item.familyId === candidate.familyId) === index)
      .slice(0, limit);
  }

  createSelectionEntry(variant, host, currentEntry, placementOverride = null) {
    const placement = normalizeDirectHardwarePlacement({
      ...recommendedPlacement(host, variant),
      ...(currentEntry?.placement || {}),
      ...(placementOverride || {})
    });
    const snapshot = this.catalogApi?.createHardwareVariantSnapshot(this.catalogApiIndex, variant.id) || null;
    return {
      catalogVersion: this.catalog.catalogVersion,
      variantId: variant.id,
      placement,
      snapshot
    };
  }

  async previewVariant(variantId, source = "quick_card") {
    if (!this.presentation.selected || this.presentation.selected.plannedDescriptor) return false;
    const variant = this.catalog?.variantsById.get(variantId);
    if (!variant || !variant.selectable) {
      this.announceStatus("That hardware variant is release gated and cannot be previewed as a new selection. Its saved facts remain available in Product details.");
      this.track("release_gate", { variantId, source, warnings: variant?.releaseWarnings?.length || 0 });
      return false;
    }
    const token = ++this.previewToken;
    const canonicalRevision = this.canonicalRevision;
    const scopeResult = resolveHardwareScope(this.canonicalLayout, this.presentation.selected.component, this.presentation.scope);
    const exclusions = [...scopeResult.excluded];
    const warnings = [];
    const affectedHosts = [];
    const placement = this.getActivePlacement(variant);
    const placementsByHostId = new Map();

    for (const host of scopeResult.hosts) {
      const hostPlacement = adaptDirectHardwarePlacementForHost(
        placement,
        this.presentation.selected.host,
        host,
        variant
      );
      if (hostPlacement.quantityPerFront === 2 && !canDirectHardwareHostUseDoublePlacement(host)) {
        exclusions.push({ componentId: host.id, reason: "Two handles require a front at least 18 inches wide." });
        continue;
      }
      const compatibility = assessDirectHardwareCompatibility(variant, host);
      if (compatibility.status === "not_compatible") {
        exclusions.push({ componentId: host.id, reason: compatibility.warnings.join(" ") || "Not compatible." });
        continue;
      }
      affectedHosts.push(host);
      placementsByHostId.set(host.id, hostPlacement);
      for (const warning of compatibility.warnings) warnings.push(`${this.semanticHostLabel(host)}: ${warning}`);
    }

    if (!affectedHosts.length) {
      this.presentation.draft = { variantId, accepted: false, scopeResult, affectedHosts, exclusions, warnings, pricing: this.canonicalPricing };
      this.renderQuickCard();
      this.announceStatus("No component in this scope can use that hardware variant.");
      this.track("warning", { variantId, scope: this.presentation.scope, exclusions: exclusions.length });
      return false;
    }

    const nextState = hostSelectionState(this.canonicalState, this.catalog);
    for (const host of affectedHosts) {
      const currentEntry = nextState.hardwareSelections.byHostId[host.id];
      nextState.hardwareSelections.byHostId[host.id] = this.createSelectionEntry(
        variant,
        host,
        currentEntry,
        placementsByHostId.get(host.id) || placement
      );
    }

    let evaluation;
    try {
      const rawEvaluation = await this.evaluateCandidate(nextState, {
        source: "direct-hardware-editor-preview",
        field: "hardwareSelections",
        variantId,
        scope: this.presentation.scope,
        hostIds: affectedHosts.map((host) => host.id)
      });
      if (token !== this.previewToken || canonicalRevision !== this.canonicalRevision || this.destroyed) return false;
      evaluation = normalizeEvaluation(rawEvaluation, nextState, this.canonicalLayout, this.canonicalPricing);
    } catch (error) {
      if (token !== this.previewToken) return false;
      this.presentation.draft = { variantId, accepted: false, scopeResult, affectedHosts: [], exclusions, warnings: [error?.message || "Candidate evaluation failed."], pricing: this.canonicalPricing };
      this.renderQuickCard();
      this.restoreCanonicalPreview();
      this.announceStatus("The hardware preview was rejected. Your accepted design is unchanged.");
      return false;
    }

    if (!evaluation.accepted) {
      const engineWarnings = evaluation.issues.map(humanizeIssue);
      this.presentation.draft = {
        variantId,
        accepted: false,
        scopeResult,
        affectedHosts: [],
        exclusions,
        warnings: [...warnings, ...engineWarnings],
        pricing: this.canonicalPricing
      };
      this.restoreCanonicalPreview({ keepDraft: true });
      this.renderQuickCard();
      this.announceStatus("The hardware preview is not buildable. Your accepted design is unchanged.");
      this.track("warning", { variantId, scope: this.presentation.scope, issues: engineWarnings.length });
      return false;
    }

    try {
      const previewResult = await this.viewer?.preview?.(evaluation.state, evaluation.layout, "hardwareSelections");
      if (previewResult === false) throw new Error("The renderer rejected the neutral hardware preview.");
    } catch (error) {
      if (token !== this.previewToken) return false;
      callSafely(this.viewer?.restorePreview?.bind(this.viewer), this.canonicalState, this.canonicalLayout);
      this.announceStatus(`The neutral hardware model could not be previewed. ${error?.message || "Your accepted selection remains visible."}`);
      this.track("asset_failure", { variantId });
      return false;
    }
    if (canonicalRevision !== this.canonicalRevision) {
      callSafely(this.viewer?.restorePreview?.bind(this.viewer), this.canonicalState, this.canonicalLayout);
      return false;
    }
    if (token !== this.previewToken || this.destroyed) return false;

    this.presentation.previewed = true;
    this.presentation.largeApplyArmed = false;
    this.presentation.placementDraft = cloneDirectHardwareValue(placement);
    this.presentation.draft = {
      variantId,
      accepted: true,
      state: cloneDirectHardwareValue(evaluation.state),
      layout: evaluation.layout,
      pricing: evaluation.pricing,
      scopeResult,
      affectedHosts,
      exclusions,
      warnings: [...warnings, ...(evaluation.warnings || []).map(humanizeIssue)]
    };
    this.presentation.recents = [variantId, ...this.presentation.recents.filter((id) => id !== variantId)].slice(0, 12);
    this.renderQuickCard();
    if (this.presentation.drawerOpen) this.updateLibraryResults();
    this.updateAnchor();
    const impact = resolveDirectHardwarePricingImpact(this.canonicalPricing, evaluation.pricing);
    const impactText = impact.delta !== null && Math.abs(impact.delta) >= 0.005
      ? ` Estimated ${impact.source === "hardware_allowance" ? "hardware allowance" : "project price"} changes by ${formatCurrency(impact.delta)}.`
      : "";
    this.announceStatus(`${variant.brandName} ${variant.familyName}, ${variant.finishName}, previewed on ${affectedHosts.length} component${affectedHosts.length === 1 ? "" : "s"}.${impactText}`);
    this.track("preview", { variantId, scope: this.presentation.scope, affectedCount: affectedHosts.length, source });
    return true;
  }

  restoreCanonicalPreview(options = {}) {
    this.previewToken += 1;
    callSafely(this.viewer?.restorePreview?.bind(this.viewer), this.canonicalState, this.canonicalLayout);
    this.presentation.previewed = false;
    if (!options.keepDraft) {
      this.presentation.draft = null;
      this.presentation.placementDraft = null;
    }
  }

  async applyDraft() {
    const draft = this.presentation.draft;
    if (!draft?.accepted || !draft.affectedHosts?.length) return false;
    if (draft.affectedHosts.length > LARGE_REPLACEMENT_COUNT && !this.presentation.largeApplyArmed) {
      this.presentation.largeApplyArmed = true;
      this.renderQuickCard();
      this.announceStatus(`This will change ${draft.affectedHosts.length} components. Activate Confirm to apply the replacement as one undoable change.`);
      return false;
    }

    const beforeState = cloneDirectHardwareValue(this.canonicalState);
    const beforeLayout = cloneDirectHardwareValue(this.canonicalLayout);
    const metadata = {
      source: "direct-hardware-editor",
      kind: "hardwareSelections",
      variantId: draft.variantId,
      scope: this.presentation.scope,
      affectedCount: draft.affectedHosts.length,
      hostIds: draft.affectedHosts.map((host) => host.id),
      exclusions: cloneDirectHardwareValue(draft.exclusions),
      warnings: cloneDirectHardwareValue(draft.warnings),
      catalogVersion: this.catalog.catalogVersion
    };

    let result;
    try {
      result = await this.commitState(cloneDirectHardwareValue(draft.state), metadata);
    } catch (error) {
      this.announceStatus(`Hardware could not be applied. ${error?.message || "Your prior accepted design remains active."}`);
      return false;
    }
    if (result === false || result?.accepted === false) {
      this.announceStatus("Hardware could not be applied. Your prior accepted design remains active.");
      return false;
    }

    const afterState = cloneDirectHardwareValue(result?.state || result?.config || draft.state);
    const afterLayout = cloneDirectHardwareValue(result?.layout || draft.layout || this.getLayout());
    this.history.record({
      beforeState: { hardwareSelections: cloneDirectHardwareValue(beforeState.hardwareSelections) },
      afterState: { hardwareSelections: cloneDirectHardwareValue(afterState.hardwareSelections) },
      beforeLayout,
      afterLayout,
      metadata
    });
    this.canonicalState = afterState;
    this.canonicalLayout = afterLayout;
    this.canonicalPricing = result?.pricing || draft.pricing || this.getPricing();
    this.presentation.previewed = false;
    this.presentation.draft = null;
    this.track("apply", metadata);
    this.announceStatus(`Applied ${this.catalog.variantsById.get(metadata.variantId)?.familyName || "hardware"} to ${metadata.affectedCount} component${metadata.affectedCount === 1 ? "" : "s"}.`);
    this.close("apply");
    return true;
  }

  renderComponentTree() {
    if (!this.elements.componentTree) return;
    const components = componentsFromLayout(this.canonicalLayout);
    const componentById = new Map(components.map((component) => [component.id, component]));
    const handlesByHost = new Map(components
      .filter((component) => component.role === "handle" && component.hostId)
      .map((component) => [component.hostId, component]));
    const groups = new Map();
    const registered = components.filter((component) => this.registry.getForRole(component.role));
    for (const item of registered) {
      if (item.role === "handle" && componentById.has(item.hostId) && FRONT_ROLES.has(componentById.get(item.hostId).role)) continue;
      const section = findSectionForComponent(item, componentById);
      const key = section?.id || "bookcase-profiles";
      const entry = groups.get(key) || {
        section,
        label: section ? null : "Bookcase profiles",
        items: []
      };
      entry.items.push(item);
      groups.set(key, entry);
    }
    if (!registered.length) {
      this.elements.componentTree.innerHTML = `<p class="direct-hardware-edit__empty">This design has no registered editable components.</p>`;
      return;
    }
    const targetIdForItem = (item) => (FRONT_ROLES.has(item.role) ? handlesByHost.get(item.id)?.id : null) || item.id;
    const treeTargetIds = [...groups.values()].flatMap((entry) => entry.items.map(targetIdForItem));
    const selectedTargetId = this.presentation.selected?.anchorComponent?.id || this.presentation.selected?.component?.id;
    const rovingTabStopId = treeTargetIds.includes(selectedTargetId) ? selectedTargetId : treeTargetIds[0];
    let sectionOrdinal = 0;
    this.elements.componentTree.innerHTML = [...groups.values()].map((entry) => {
      if (entry.section) sectionOrdinal += 1;
      const groupLabel = entry.label || `Section ${sectionOrdinal}`;
      return `
      <div class="direct-hardware-edit__tree-group" role="treeitem" aria-expanded="true" aria-level="1">
        <span>${escapeDirectHardwareHtml(groupLabel)}</span>
        <div role="group">${entry.items.map((item) => {
          const descriptor = this.registry.getForRole(item.role);
          const handle = FRONT_ROLES.has(item.role) ? handlesByHost.get(item.id) : null;
          const targetId = handle?.id || item.id;
          const selected = this.presentation.selected?.component?.id === targetId
            || this.presentation.selected?.host?.id === item.id;
          const title = FRONT_ROLES.has(item.role)
            ? this.semanticHostLabel(item)
            : descriptor.semanticLabel;
          const fact = FRONT_ROLES.has(item.role)
            ? `${item.metadata?.style || "front"} · ${handle ? "visible hardware" : "no visible handle"}`
            : `${String(item.role).replaceAll("_", " ")} · editor planned`;
          return `<button type="button" role="treeitem" aria-level="2" aria-selected="${selected}" data-editable-component-id="${escapeDirectHardwareHtml(targetId)}" tabindex="${targetId === rovingTabStopId ? "0" : "-1"}"><span class="direct-hardware-edit__selection-mark" aria-hidden="true"></span><span><strong>${escapeDirectHardwareHtml(title)}</strong><small>${escapeDirectHardwareHtml(fact)}</small></span></button>`;
        }).join("")}</div>
      </div>`;
    }).join("");
  }

  renderLibraryChrome() {
    if (!this.elements.libraryBody || !this.catalog) return;
    const brands = [...this.catalog.brands.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const collections = [...this.catalog.collections.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const categories = [...new Set(this.catalog.variants.map((variant) => variant.category))].sort();
    const finishes = [...this.catalog.canonicalFinishes.values()].sort((a, b) => String(a.label).localeCompare(String(b.label)));
    const styles = [...new Set(this.catalog.variants.flatMap((variant) => variant.styles || []))].sort();
    const exactFinishes = [...new Map(this.catalog.variants.map((variant) => [`${variant.familyId}|${variant.finishVariantId}`, variant])).values()]
      .sort((a, b) => String(a.finishName).localeCompare(String(b.finishName)));
    const sizes = [...new Map(this.catalog.variants.map((variant) => [variant.sizeVariantId, variant])).values()]
      .sort((a, b) => sizeMillimeters(a) - sizeMillimeters(b));
    const priceTiers = [...new Set(this.catalog.variants.map((variant) => variant.priceTier).filter(Boolean))].sort();
    const regions = [...new Set(this.catalog.variants.flatMap((variant) => variant.family?.regions || []))].sort();
    this.elements.libraryBody.innerHTML = `
      <div class="direct-hardware-edit__library-tools">
        <label class="direct-hardware-edit__search"><span>Search products, brands, finishes, or codes</span><input type="search" data-library-search placeholder="Try satin brass, cup pull, or US4" autocomplete="off"></label>
        <div class="direct-hardware-edit__mode-chips" role="group" aria-label="Hardware collections">
          ${[["all", "All"], ["recommended", "Recommended"], ["recent", "Recently viewed"], ["favorites", "Favorites"]].map(([value, label]) => `<button type="button" data-library-mode="${value}" aria-pressed="${this.presentation.libraryMode === value}">${label}</button>`).join("")}
        </div>
        <details class="direct-hardware-edit__filters">
          <summary>Filters and sort</summary>
          <div>
            <label>Brand<select data-library-filter="brand"><option value="">All brands</option>${brands.map((brand) => `<option value="${escapeDirectHardwareHtml(brand.id)}">${escapeDirectHardwareHtml(brand.name)}</option>`).join("")}</select></label>
            <label>Collection<select data-library-filter="collection"><option value="">All collections</option>${collections.map((collection) => `<option value="${escapeDirectHardwareHtml(collection.id)}">${escapeDirectHardwareHtml(collection.name)}</option>`).join("")}</select></label>
            <label>Category<select data-library-filter="category"><option value="">All categories</option>${categories.map((category) => `<option value="${escapeDirectHardwareHtml(category)}">${escapeDirectHardwareHtml(formatCategory(category))}</option>`).join("")}</select></label>
            <label>Style<select data-library-filter="style"><option value="">All styles</option>${styles.map((style) => `<option value="${escapeDirectHardwareHtml(style)}">${escapeDirectHardwareHtml(formatCategory(style))}</option>`).join("")}</select></label>
            <label>Finish group<select data-library-filter="finish"><option value="">All finishes</option>${finishes.map((finish) => `<option value="${escapeDirectHardwareHtml(finish.id)}">${escapeDirectHardwareHtml(finish.label)}</option>`).join("")}</select></label>
            <label>Exact manufacturer finish<select data-library-filter="exactFinish"><option value="">All exact finishes</option>${exactFinishes.map((variant) => `<option value="${escapeDirectHardwareHtml(`${variant.familyId}|${variant.finishVariantId}`)}">${escapeDirectHardwareHtml(`${variant.familyName} · ${variant.finishName}${variant.finishCode ? ` (${variant.finishCode})` : ""}`)}</option>`).join("")}</select></label>
            <label>Size<select data-library-filter="size"><option value="">All sizes</option>${sizes.map((variant) => `<option value="${escapeDirectHardwareHtml(variant.sizeVariantId)}">${escapeDirectHardwareHtml(`${variant.familyName} · ${variant.sizeLabel}`)}</option>`).join("")}</select></label>
            <label>Center to center<select data-library-filter="centerToCenter"><option value="">Any c.c.</option><option value="single-hole">Single hole</option><option value="under-96">Under 96 mm</option><option value="96-160">96–160 mm</option><option value="over-160">Over 160 mm</option><option value="unknown">Not stated</option></select></label>
            <label>Overall length<select data-library-filter="overallLength"><option value="">Any length</option><option value="under-100">Under 100 mm</option><option value="100-200">100–200 mm</option><option value="over-200">Over 200 mm</option><option value="unknown">Not stated</option></select></label>
            <label>Price tier<select data-library-filter="priceTier"><option value="">Any price tier</option>${priceTiers.map((tier) => `<option value="${escapeDirectHardwareHtml(tier)}">${escapeDirectHardwareHtml(formatCategory(tier))}</option>`).join("")}</select></label>
            <label>Availability<select data-library-filter="availability"><option value="">Any availability</option><option value="active_or_orderable">Active / orderable</option><option value="limited">Limited</option><option value="discontinued">Discontinued / saved only</option></select></label>
            <label>Region<select data-library-filter="region"><option value="">Any region</option>${regions.map((region) => `<option value="${escapeDirectHardwareHtml(region)}">${escapeDirectHardwareHtml(region)}</option>`).join("")}</select></label>
            <label>Model accuracy<select data-library-filter="accurate"><option value="">Any model</option><option value="accurate">Dimensionally accurate proxy</option><option value="placeholder">Neutral placeholder</option></select></label>
            <label>Sort<select data-library-sort><option value="recommended">Recommended</option><option value="popularity">Curated order</option><option value="price-low">Reference price: low to high</option><option value="size-small">Size: small to large</option></select></label>
          </div>
        </details>
      </div>
      <div class="direct-hardware-edit__library-note" role="note"><strong>Specification-first previews.</strong> Custom neutral CSS thumbnails are used; no manufacturer photography, logos, CAD, or textures are bundled.</div>
      <div class="direct-hardware-edit__results-heading"><strong data-library-summary></strong><span>Family-first results</span></div>
      <div class="direct-hardware-edit__family-grid" data-library-results></div>
      <section class="direct-hardware-edit__compare" data-library-compare aria-label="Hardware comparison" hidden></section>`;
    this.updateLibraryResults();
  }

  filteredLibraryVariants() {
    if (!this.catalog) return [];
    const selectedHost = this.presentation.selected?.host;
    const queryTokens = this.presentation.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const expandedTokens = queryTokens.flatMap((token) => [token, ...(SEARCH_SYNONYMS[token]?.split(/\s+/) || [])]);
    const recentSet = new Set(this.presentation.recents);
    return this.catalog.variants.filter((variant) => {
      const filters = this.presentation.filters;
      if (!matchesDirectHardwareFilters(variant, filters)) return false;
      if (this.presentation.libraryMode === "favorites" && !this.presentation.favorites.has(variant.familyId)) return false;
      if (this.presentation.libraryMode === "recent" && !recentSet.has(variant.id)) return false;
      if (this.presentation.libraryMode === "recommended" && assessDirectHardwareCompatibility(variant, selectedHost).status === "not_compatible") return false;
      if (queryTokens.length && !queryTokens.every((token) => {
        if (variant.searchText.includes(token)) return true;
        const synonyms = SEARCH_SYNONYMS[token];
        return synonyms ? synonyms.split(/\s+/).some((synonym) => variant.searchText.includes(synonym)) : false;
      })) return false;
      if (!queryTokens.length && expandedTokens.length && !expandedTokens.some((token) => variant.searchText.includes(token))) return false;
      return true;
    });
  }

  updateLibraryResults() {
    const results = this.elements.libraryBody?.querySelector?.("[data-library-results]");
    const summary = this.elements.libraryBody?.querySelector?.("[data-library-summary]");
    const compare = this.elements.libraryBody?.querySelector?.("[data-library-compare]");
    if (!results || !summary || !compare) return;
    const variants = this.filteredLibraryVariants();
    const byFamily = new Map();
    for (const variant of variants) {
      const group = byFamily.get(variant.familyId) || [];
      group.push(variant);
      byFamily.set(variant.familyId, group);
    }
    let families = [...byFamily.entries()].map(([familyId, members], order) => {
      const draftId = this.presentation.draft?.variantId;
      const recentId = this.presentation.recents.find((id) => members.some((variant) => variant.id === id));
      const representative = members.find((variant) => variant.id === draftId)
        || members.find((variant) => variant.id === recentId)
        || members.find((variant) => variant.selectable)
        || members[0];
      return { familyId, members, representative, order };
    });

    const selectedVariant = this.getSelectedVariant();
    families.sort((left, right) => {
      if (this.presentation.sort === "price-low") return numericPrice(left.representative) - numericPrice(right.representative);
      if (this.presentation.sort === "size-small") return sizeMillimeters(left.representative) - sizeMillimeters(right.representative);
      if (this.presentation.sort === "popularity") return left.order - right.order;
      const score = (entry) => {
        const variant = entry.representative;
        const compatibility = assessDirectHardwareCompatibility(variant, this.presentation.selected?.host).status;
        return (compatibility === "recommended" ? 8 : compatibility === "compatible" ? 5 : compatibility === "possible_with_warning" ? 2 : 0)
          + (selectedVariant && variant.category === selectedVariant.category ? 2 : 0)
          + (selectedVariant && variant.canonicalFinishId === selectedVariant.canonicalFinishId ? 1 : 0);
      };
      return score(right) - score(left) || left.order - right.order;
    });

    summary.textContent = `${families.length} ${families.length === 1 ? "family" : "families"} · ${variants.length} exact ${variants.length === 1 ? "variant" : "variants"}`;
    results.innerHTML = families.length ? families.map(({ familyId, members, representative }) => {
      const family = representative.family;
      const favorite = this.presentation.favorites.has(familyId);
      const compared = this.presentation.compare.has(representative.id);
      const active = representative.id === this.presentation.draft?.variantId;
      const price = representative.pricing?.mode === "quote_only"
        ? "Price confirmed with quote"
        : (formatCurrency(representative.pricing?.amount, representative.pricing?.currency) || representative.pricing?.priceBand || "Price under review");
      return `<article class="direct-hardware-edit__family-card" data-active="${active}">
        <div class="direct-hardware-edit__family-card-top">${this.neutralThumbnail(representative.category)}<button type="button" class="direct-hardware-edit__favorite" data-favorite-family="${escapeDirectHardwareHtml(familyId)}" aria-pressed="${favorite}" aria-label="${favorite ? "Remove from" : "Add to"} favorites">♡</button></div>
        <div class="direct-hardware-edit__family-copy"><span>${escapeDirectHardwareHtml(representative.brandName)} · ${escapeDirectHardwareHtml(representative.collectionName)}</span><h3>${escapeDirectHardwareHtml(representative.familyName)}</h3><p>${escapeDirectHardwareHtml(representative.categoryLabel)} · ${members.length} exact variants</p></div>
        <dl><div><dt>Preview size</dt><dd>${escapeDirectHardwareHtml(representative.sizeLabel)}</dd></div><div><dt>Finish</dt><dd><i style="--direct-swatch:${safeSwatch(representative.swatch)}"></i>${escapeDirectHardwareHtml(representative.finishName)}</dd></div><div><dt>Model</dt><dd>${escapeDirectHardwareHtml(representative.accuracyLabel)}</dd></div><div><dt>Price</dt><dd>${escapeDirectHardwareHtml(price)}</dd></div></dl>
        ${representative.releaseGate || family.verificationCaveat ? `<p class="direct-hardware-edit__caveat">Release gated · facts and saved restoration only</p>` : ""}
        <div class="direct-hardware-edit__family-actions"><button type="button" class="direct-hardware-edit__button direct-hardware-edit__button--primary" data-preview-variant="${escapeDirectHardwareHtml(representative.id)}"${representative.selectable ? "" : " disabled"}>${representative.selectable ? "Preview on selected front" : "Release gated"}</button><button type="button" data-product-details="${escapeDirectHardwareHtml(representative.id)}">Details</button><button type="button" data-compare-variant="${escapeDirectHardwareHtml(representative.id)}" aria-pressed="${compared}">${compared ? "Compared" : "Compare"}</button></div>
      </article>`;
    }).join("") : `<div class="direct-hardware-edit__empty"><strong>No matching hardware</strong><p>Clear a filter or try a broader product, finish, or manufacturer code.</p></div>`;

    const comparedVariants = [...this.presentation.compare].map((id) => this.catalog.variantsById.get(id)).filter(Boolean);
    compare.hidden = comparedVariants.length === 0;
    compare.innerHTML = comparedVariants.length ? `<header><div><span class="direct-hardware-edit__eyebrow">Compare up to three</span><h3>${comparedVariants.length} selected</h3></div><button type="button" data-clear-compare>Clear</button></header><div class="direct-hardware-edit__compare-grid">${comparedVariants.map((variant) => `<article><button type="button" data-remove-compare="${escapeDirectHardwareHtml(variant.id)}" aria-label="Remove ${escapeDirectHardwareHtml(variant.familyName)} from comparison">${closeIcon}</button><strong>${escapeDirectHardwareHtml(variant.brandName)}</strong><span>${escapeDirectHardwareHtml(variant.familyName)}</span><dl><div><dt>c.c.</dt><dd>${escapeDirectHardwareHtml(formatMillimeters(variant.dimensionsMm.centerToCenter, this.presentation.units))}</dd></div><div><dt>Length</dt><dd>${escapeDirectHardwareHtml(formatMillimeters(variant.dimensionsMm.overallLength, this.presentation.units))}</dd></div><div><dt>Projection</dt><dd>${escapeDirectHardwareHtml(formatMillimeters(variant.dimensionsMm.projection, this.presentation.units))}</dd></div><div><dt>Finish</dt><dd>${escapeDirectHardwareHtml(variant.finishName)}</dd></div></dl><button type="button" data-preview-variant="${escapeDirectHardwareHtml(variant.id)}"${variant.selectable ? "" : " disabled"}>${variant.selectable ? "Preview" : "Release gated"}</button></article>`).join("")}</div>` : "";
  }

  openLibrary() {
    if (!this.presentation.selected || this.presentation.selected.plannedDescriptor || !this.catalog) return false;
    this.drawerFocusReturn = this.modelHost.ownerDocument.activeElement;
    this.presentation.drawerOpen = true;
    this.elements.library.hidden = false;
    this.elements.libraryBackdrop.hidden = false;
    this.elements.libraryBody.querySelector("[data-library-search]").value = this.presentation.query;
    this.updateLibraryResults();
    this.elements.library.focus({ preventScroll: true });
    this.track("library_open", { componentId: this.presentation.selected.component.id });
    this.announceStatus("Hardware library opened. The selected bookcase front remains visible behind the drawer.");
    return true;
  }

  closeLibrary({ restoreFocus = true } = {}) {
    if (!this.presentation.drawerOpen) return false;
    this.presentation.drawerOpen = false;
    this.presentation.detailsVariantId = null;
    this.elements.details.hidden = true;
    this.elements.libraryBody.inert = false;
    this.elements.libraryBody.removeAttribute("aria-hidden");
    this.elements.library.hidden = true;
    this.elements.libraryBackdrop.hidden = true;
    if (restoreFocus) {
      const target = this.drawerFocusReturn?.isConnected ? this.drawerFocusReturn : this.elements.quickCard.querySelector("[data-open-library]");
      target?.focus?.({ preventScroll: true });
    }
    this.drawerFocusReturn = null;
    this.detailsFocusReturn = null;
    return true;
  }

  showProductDetails(variantId) {
    const variant = this.getVariantById(variantId);
    if (!variant) return false;
    if (!this.presentation.detailsVariantId) this.detailsFocusReturn = this.modelHost.ownerDocument.activeElement;
    if (!this.presentation.drawerOpen) this.openLibrary();
    this.presentation.detailsVariantId = variantId;
    this.elements.libraryBody.inert = true;
    this.elements.libraryBody.setAttribute("aria-hidden", "true");
    const releaseMessages = variant.releaseWarnings?.length
      ? variant.releaseWarnings.map(humanizeIssue)
      : (!variant.selectable ? ["This exact variant is retained for saved restoration and fact review, but cannot be selected for new work."] : []);
    const sourceLinks = variant.sources.map((source) => {
      const url = safeUrl(source.url);
      return url ? `<li><a href="${escapeDirectHardwareHtml(url)}" target="_blank" rel="noopener noreferrer" data-source-link="${escapeDirectHardwareHtml(source.id)}">${escapeDirectHardwareHtml(source.title || source.publisher || "Official source")}</a><small>${escapeDirectHardwareHtml(source.type || "source")} · checked ${escapeDirectHardwareHtml(source.accessedAt || variant.lastVerifiedAt || "date not stated")}</small></li>` : "";
    }).join("");
    this.elements.details.innerHTML = `
      <header><div><span class="direct-hardware-edit__eyebrow">Exact product facts</span><h3>${escapeDirectHardwareHtml(variant.familyName)}</h3></div><button type="button" class="direct-hardware-edit__icon-button" data-close-details aria-label="Close product details">${closeIcon}</button></header>
      <div class="direct-hardware-edit__details-lead">${this.neutralThumbnail(variant.category)}<div><strong>${escapeDirectHardwareHtml(variant.brandName)} · ${escapeDirectHardwareHtml(variant.collectionName)}</strong><span>${escapeDirectHardwareHtml(variant.sizeLabel)} · ${escapeDirectHardwareHtml(variant.finishName)}${variant.finishCode ? ` (${escapeDirectHardwareHtml(variant.finishCode)})` : ""}</span><span>${escapeDirectHardwareHtml(variant.accuracyLabel)}</span></div></div>
      <dl class="direct-hardware-edit__details-grid"><div><dt>Exact variant ID</dt><dd>${escapeDirectHardwareHtml(variant.id)}</dd></div><div><dt>Manufacturer number</dt><dd>${escapeDirectHardwareHtml(variant.manufacturerProductNumber || "Not stated")}</dd></div><div><dt>SKU</dt><dd>${escapeDirectHardwareHtml(variant.sku || "Not stated")}</dd></div><div><dt>Center to center</dt><dd>${escapeDirectHardwareHtml(formatMillimeters(variant.dimensionsMm.centerToCenter, this.presentation.units))}</dd></div><div><dt>Overall length</dt><dd>${escapeDirectHardwareHtml(formatMillimeters(variant.dimensionsMm.overallLength, this.presentation.units))}</dd></div><div><dt>Projection</dt><dd>${escapeDirectHardwareHtml(formatMillimeters(variant.dimensionsMm.projection, this.presentation.units))}</dd></div><div><dt>Width</dt><dd>${escapeDirectHardwareHtml(formatMillimeters(variant.dimensionsMm.width, this.presentation.units))}</dd></div><div><dt>Material</dt><dd>${escapeDirectHardwareHtml(variant.material || "Not stated")}</dd></div><div><dt>Mounting</dt><dd>${escapeDirectHardwareHtml(variant.mounting?.holeCount ? `${variant.mounting.holeCount} hole${variant.mounting.holeCount === 1 ? "" : "s"}; ${variant.mounting.screw || "screw details not stated"}` : "Not stated")}</dd></div><div><dt>Availability</dt><dd>${escapeDirectHardwareHtml(availabilityLabel(variant.availability?.status || variant.productStatus))} · checked ${escapeDirectHardwareHtml(variant.availability?.checkedAt || variant.lastVerifiedAt || "date not stated")}</dd></div><div><dt>Price posture</dt><dd>${escapeDirectHardwareHtml(variant.pricing?.mode === "quote_only" ? "Price confirmed with quote" : (formatCurrency(variant.pricing?.amount, variant.pricing?.currency) || variant.pricing?.priceBand || "Not stated"))}${variant.pricing?.checkedAt ? ` · checked ${escapeDirectHardwareHtml(variant.pricing.checkedAt)}` : ""}</dd></div><div><dt>Model accuracy</dt><dd>${escapeDirectHardwareHtml(variant.accuracyLabel)}</dd></div></dl>
      ${releaseMessages.length ? `<div class="direct-hardware-edit__warnings" role="note"><strong>Release gate</strong><ul>${releaseMessages.map((message) => `<li>${escapeDirectHardwareHtml(message)}</li>`).join("")}</ul></div>` : (variant.family.verificationCaveat ? `<div class="direct-hardware-edit__warnings" role="note"><strong>Verification caveat</strong><p>${escapeDirectHardwareHtml(variant.family.verificationCaveat)}</p></div>` : "")}
      <section class="direct-hardware-edit__sources"><h4>Official product/specification sources</h4><ul>${sourceLinks || "<li>No public source link is recorded for this exact variant.</li>"}</ul></section>
      <div class="direct-hardware-edit__card-actions"><button type="button" class="direct-hardware-edit__button direct-hardware-edit__button--secondary" data-close-details>Back to library</button><button type="button" class="direct-hardware-edit__button direct-hardware-edit__button--primary" data-preview-variant="${escapeDirectHardwareHtml(variant.id)}"${variant.selectable ? "" : " disabled"}>${variant.selectable ? "Preview on selected front" : "Release gated · details only"}</button></div>`;
    this.elements.details.hidden = false;
    this.elements.details.querySelector("[data-close-details]")?.focus({ preventScroll: true });
    this.track("details", { variantId });
    return true;
  }

  closeProductDetails() {
    if (!this.presentation.detailsVariantId) return false;
    const variantId = this.presentation.detailsVariantId;
    this.presentation.detailsVariantId = null;
    this.elements.details.hidden = true;
    this.elements.libraryBody.inert = false;
    this.elements.libraryBody.removeAttribute("aria-hidden");
    const storedInvoker = this.detailsFocusReturn;
    const fallbackInvoker = this.elements.library.querySelector(`[data-product-details="${globalThis.CSS?.escape ? CSS.escape(variantId) : safeId(variantId)}"]`);
    const focusTarget = storedInvoker?.isConnected && this.elements.library.contains(storedInvoker)
      ? storedInvoker
      : (fallbackInvoker || this.elements.library.querySelector("[data-close-library]"));
    focusTarget?.focus?.({ preventScroll: true });
    this.detailsFocusReturn = null;
    return true;
  }

  toggleFavorite(familyId) {
    if (this.presentation.favorites.has(familyId)) this.presentation.favorites.delete(familyId);
    else this.presentation.favorites.add(familyId);
    this.renderQuickCard();
    if (this.presentation.drawerOpen) this.updateLibraryResults();
  }

  toggleCompare(variantId) {
    if (this.presentation.compare.has(variantId)) {
      this.presentation.compare.delete(variantId);
    } else if (this.presentation.compare.size < 3) {
      this.presentation.compare.add(variantId);
    } else {
      this.announceStatus("You can compare up to three exact hardware variants.");
      return false;
    }
    this.updateLibraryResults();
    this.track("compare", { variantId, selected: this.presentation.compare.has(variantId), count: this.presentation.compare.size });
    return true;
  }

  handleRootClick(event) {
    const target = event.target?.closest?.("button, a, [data-library-backdrop]");
    if (!target || !this.root?.contains(target)) return;

    if (target.matches("[data-direct-toggle]")) {
      if (!this.presentation.available) return;
      this.setEnabled(!this.presentation.enabled);
      return;
    }
    if (target.matches("[data-toggle-components]")) {
      this.presentation.componentsOpen = !this.presentation.componentsOpen;
      this.elements.componentsPanel.hidden = !this.presentation.componentsOpen;
      target.setAttribute("aria-expanded", String(this.presentation.componentsOpen));
      if (this.presentation.componentsOpen) this.elements.componentsPanel.querySelector("[data-close-components]")?.focus({ preventScroll: true });
      return;
    }
    if (target.matches("[data-close-components]")) {
      this.presentation.componentsOpen = false;
      this.elements.componentsPanel.hidden = true;
      this.root.querySelector("[data-toggle-components]")?.setAttribute("aria-expanded", "false");
      this.root.querySelector("[data-toggle-components]")?.focus({ preventScroll: true });
      return;
    }
    if (target.matches("[data-editable-component-id]")) {
      if (this.openForComponent(target.dataset.editableComponentId)) {
        this.elements.quickCard.querySelector("button")?.focus({ preventScroll: true });
      }
      return;
    }
    if (target.matches("[data-preview-variant]")) {
      this.previewVariant(target.dataset.previewVariant, this.presentation.drawerOpen ? "library" : "quick_card");
      return;
    }
    if (target.matches("[data-apply-hardware]")) {
      this.applyDraft();
      return;
    }
    if (target.matches("[data-cancel-preview]")) {
      this.restoreCanonicalPreview();
      this.presentation.largeApplyArmed = false;
      this.renderQuickCard();
      if (this.presentation.drawerOpen) this.updateLibraryResults();
      this.announceStatus("Preview cancelled. Committed hardware restored.");
      return;
    }
    if (target.matches("[data-reset-placement]")) {
      const variant = this.getSelectedVariant();
      if (!variant) return;
      this.presentation.placementDraft = normalizeDirectHardwarePlacement(recommendedPlacement(this.presentation.selected?.host, variant));
      this.previewVariant(variant.id, "placement_reset");
      return;
    }
    if (target.matches("[data-cancel-direct]")) {
      this.close("cancel");
      return;
    }
    if (target.matches("[data-open-library]")) {
      this.openLibrary();
      return;
    }
    if (target.matches("[data-close-library]")) {
      this.closeLibrary();
      return;
    }
    if (target.matches("[data-library-backdrop]")) {
      this.closeLibrary();
      return;
    }
    if (target.matches("[data-product-details]")) {
      this.showProductDetails(target.dataset.productDetails);
      return;
    }
    if (target.matches("[data-close-details]")) {
      this.closeProductDetails();
      return;
    }
    if (target.matches("[data-library-mode]")) {
      this.presentation.libraryMode = target.dataset.libraryMode;
      this.elements.libraryBody.querySelectorAll("[data-library-mode]").forEach((button) => button.setAttribute("aria-pressed", String(button === target)));
      this.updateLibraryResults();
      this.track("filter", { mode: this.presentation.libraryMode });
      return;
    }
    if (target.matches("[data-favorite-family]")) {
      this.toggleFavorite(target.dataset.favoriteFamily);
      return;
    }
    if (target.matches("[data-compare-variant]")) {
      this.toggleCompare(target.dataset.compareVariant);
      return;
    }
    if (target.matches("[data-remove-compare]")) {
      this.presentation.compare.delete(target.dataset.removeCompare);
      this.updateLibraryResults();
      return;
    }
    if (target.matches("[data-clear-compare]")) {
      this.presentation.compare.clear();
      this.updateLibraryResults();
      return;
    }
    if (target.matches("[data-history-undo]")) {
      this.undo();
      return;
    }
    if (target.matches("[data-history-redo]")) {
      this.redo();
      return;
    }
    if (target.matches("[data-source-link]")) {
      this.track("spec_link", { sourceId: target.dataset.sourceLink, variantId: this.presentation.detailsVariantId });
    }
  }

  handleRootInput(event) {
    const target = event.target;
    if (target?.matches?.("[data-library-search]")) {
      this.presentation.query = target.value;
      this.updateLibraryResults();
      this.track("search", { queryLength: target.value.length });
      return;
    }
    if (target?.matches?.("[data-custom-scale]")) {
      this.presentation.customScaleHeightInches = clamp(finite(target.value, 66), 36, 96);
      if (this.root.querySelector("[data-direct-scale]")?.value === "custom") {
        this.presentation.scaleHeightInches = this.presentation.customScaleHeightInches;
        this.updateMeasurements();
      }
    }
  }

  handleRootChange(event) {
    const target = event.target;
    if (target?.matches?.("[data-placement-field]")) {
      const variant = this.getSelectedVariant();
      if (!variant) return;
      const field = target.dataset.placementField;
      const current = this.getActivePlacement(variant);
      let value = target.type === "checkbox" ? target.checked : target.value;
      if (["edgeOffsetMm", "crossAxisOffsetMm", "quantityPerFront"].includes(field)) value = Number(value);
      if (field === "quantityPerFront" && value === 2 && !this.canUseDoublePlacement()) {
        target.value = "1";
        value = 1;
        this.announceStatus("Two handles require a front at least 18 inches wide. Quantity remains one.");
      }
      this.presentation.placementDraft = normalizeDirectHardwarePlacement({ ...current, [field]: value });
      this.track("placement", { field, value: this.presentation.placementDraft[field] });
      this.previewVariant(variant.id, "placement_change");
      return;
    }
    if (target?.matches?.("[data-hardware-scope]")) {
      this.presentation.scope = target.value;
      this.presentation.largeApplyArmed = false;
      this.track("scope", { scope: target.value });
      const variantId = this.presentation.draft?.variantId || this.getCurrentVariantId();
      if (variantId) this.previewVariant(variantId, "scope_change");
      return;
    }
    if (target?.matches?.("[data-library-filter]")) {
      this.presentation.filters[target.dataset.libraryFilter] = target.value;
      this.updateLibraryResults();
      this.track("filter", { filter: target.dataset.libraryFilter, value: target.value });
      return;
    }
    if (target?.matches?.("[data-library-sort]")) {
      this.presentation.sort = target.value;
      this.updateLibraryResults();
      return;
    }
    if (target?.matches?.("[data-direct-units]")) {
      this.presentation.units = target.value === "metric" ? "metric" : "imperial";
      this.renderQuickCard();
      this.updateLibraryResults();
      if (this.presentation.detailsVariantId) this.showProductDetails(this.presentation.detailsVariantId);
      this.updateMeasurements();
      return;
    }
    if (target?.matches?.("[data-direct-scale]")) {
      const value = target.value;
      this.elements.customScaleField.hidden = value !== "custom";
      this.presentation.scaleHeightInches = value === "hidden"
        ? null
        : (value === "custom" ? this.presentation.customScaleHeightInches : finite(value, 66));
      this.updateMeasurements();
    }
  }

  handleKeyDown(event) {
    if (this.destroyed || !this.initialized) return;
    if (event.key === "Escape") {
      if (this.presentation.detailsVariantId) {
        event.preventDefault();
        this.closeProductDetails();
      } else if (this.presentation.drawerOpen) {
        event.preventDefault();
        this.closeLibrary();
      } else if (this.presentation.selected) {
        event.preventDefault();
        this.close("escape");
      }
      return;
    }

    if (this.presentation.drawerOpen && event.key === "Tab") {
      const focusables = focusableElements(this.elements.library);
      if (!focusables.length) {
        event.preventDefault();
        this.elements.library.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables.at(-1);
      const activeElement = this.modelHost.ownerDocument.activeElement;
      if (!this.elements.library.contains(activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
      return;
    }

    const treeItem = event.target?.closest?.("[data-editable-component-id]");
    if (treeItem && ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      const items = [...this.elements.componentTree.querySelectorAll("[data-editable-component-id]")];
      const index = items.indexOf(treeItem);
      let nextIndex = index;
      if (event.key === "ArrowDown") nextIndex = Math.min(items.length - 1, index + 1);
      if (event.key === "ArrowUp") nextIndex = Math.max(0, index - 1);
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = items.length - 1;
      if (items[nextIndex]) {
        event.preventDefault();
        items.forEach((item, itemIndex) => item.tabIndex = itemIndex === nextIndex ? 0 : -1);
        items[nextIndex].focus();
      }
      return;
    }

    if (!this.presentation.enabled || isEditableTextTarget(event.target)) return;
    const modifier = event.metaKey || event.ctrlKey;
    if (modifier && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) this.redo();
      else this.undo();
      return;
    }
    if (event.ctrlKey && !event.metaKey && event.key.toLowerCase() === "y") {
      event.preventDefault();
      this.redo();
    }
  }

  handleViewerHover(selection) {
    if (!this.presentation.enabled) return;
    const contextual = this.resolveAnyContextualSelection(selection);
    if (!contextual) {
      this.presentation.hoveredComponentId = null;
      this.elements.hoverLabel.hidden = true;
      return;
    }
    this.presentation.hoveredComponentId = contextual.component.id;
    this.elements.hoverLabel.textContent = contextual.descriptor.enabled
      ? `${contextual.descriptor.semanticLabel} · Select to edit`
      : `${contextual.descriptor.semanticLabel} · Editor planned`;
    const anchor = callSafely(this.viewer?.getComponentScreenAnchor?.bind(this.viewer), contextual.component.id);
    if (anchor && Number.isFinite(anchor.x) && Number.isFinite(anchor.y)) {
      this.elements.hoverLabel.style.left = `${anchor.x}px`;
      this.elements.hoverLabel.style.top = `${anchor.y}px`;
      this.elements.hoverLabel.hidden = false;
    } else {
      this.elements.hoverLabel.hidden = true;
    }
  }

  updateAnchor(anchorOverride = null) {
    this.updateMeasurements();
    if (!this.presentation.selected || !this.elements.quickCard || this.elements.quickCard.hidden) return;
    const windowObject = this.modelHost.ownerDocument.defaultView;
    const mobile = windowObject?.matchMedia?.("(max-width: 767px)")?.matches;
    this.root.dataset.anchorMode = mobile ? "sheet" : "anchored";
    if (mobile) {
      this.elements.quickCard.style.removeProperty("left");
      this.elements.quickCard.style.removeProperty("top");
      this.elements.leader.hidden = true;
      return;
    }
    const selectedId = this.presentation.selected.anchorComponent?.id || this.presentation.selected.component.id;
    const anchor = anchorOverride && Number.isFinite(anchorOverride.x)
      ? anchorOverride
      : callSafely(this.viewer?.getComponentScreenAnchor?.bind(this.viewer), selectedId);
    if (!anchor || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) {
      this.elements.leader.hidden = true;
      return;
    }
    const viewport = { width: this.modelHost.clientWidth, height: this.modelHost.clientHeight };
    const cardRect = this.elements.quickCard.getBoundingClientRect();
    const hostRect = this.modelHost.getBoundingClientRect();
    const coordinate = {
      x: anchor.coordinateSpace === "viewport" ? anchor.x - hostRect.left : anchor.x,
      y: anchor.coordinateSpace === "viewport" ? anchor.y - hostRect.top : anchor.y,
      visible: anchor.visible !== false
    };
    const placement = clampHardwareAnchor(coordinate, viewport, { width: cardRect.width, height: cardRect.height }, {
      margin: 14,
      gap: 24,
      topInset: 72,
      bottomInset: 96
    });
    this.elements.quickCard.style.left = `${placement.left}px`;
    this.elements.quickCard.style.top = `${placement.top}px`;
    this.elements.quickCard.dataset.side = placement.side;
    this.elements.leaderLine.setAttribute("x1", String(placement.leaderStart.x));
    this.elements.leaderLine.setAttribute("y1", String(placement.leaderStart.y));
    this.elements.leaderLine.setAttribute("x2", String(placement.leaderEnd.x));
    this.elements.leaderLine.setAttribute("y2", String(placement.leaderEnd.y));
    this.elements.anchorDot.setAttribute("cx", String(placement.anchorX));
    this.elements.anchorDot.setAttribute("cy", String(placement.anchorY));
    this.elements.leader.hidden = !placement.visible;
  }

  updateScaleReference() {
    this.updateMeasurements();
  }

  updateMeasurements() {
    if (!this.elements.overallHeight || !this.canonicalLayout) return;
    const fallbackHeight = finite(this.canonicalLayout?.config?.height || this.canonicalState?.height);
    const fallbackLabel = fallbackHeight > 0 ? formatMillimeters(fallbackHeight * 25.4, this.presentation.units) : "Height unavailable";
    this.elements.overallHeight.textContent = `${fallbackLabel} high`;
    this.elements.measurementOverlay.hidden = !this.presentation.enabled;
    if (!this.presentation.enabled) {
      this.elements.scaleReference.hidden = true;
      return;
    }
    const humanHeightIn = this.presentation.scaleHeightInches || undefined;
    const projection = callSafely(this.viewer?.getMeasurementProjection?.bind(this.viewer), { humanHeightIn });
    if (projection?.then) {
      projection.then((value) => this.renderMeasurementProjection(value)).catch(() => {});
    } else {
      this.renderMeasurementProjection(projection);
    }
  }

  renderMeasurementProjection(projection) {
    if (!projection || this.destroyed || !this.presentation.enabled) {
      this.elements.measurementOverlay.hidden = true;
      this.elements.scaleReference.hidden = true;
      return;
    }
    const overallInches = finite(projection.overallInches, finite(this.canonicalLayout?.config?.height));
    const overallLabel = overallInches > 0 ? formatMillimeters(overallInches * 25.4, this.presentation.units) : "Height unavailable";
    this.elements.overallHeight.textContent = `${overallLabel} high`;
    const start = projection.heightLine?.start;
    const end = projection.heightLine?.end;
    if (start && end && [start.x, start.y, end.x, end.y].every(Number.isFinite)) {
      this.elements.measurementOverlay.hidden = false;
      this.elements.heightLine.setAttribute("x1", String(start.x));
      this.elements.heightLine.setAttribute("y1", String(start.y));
      this.elements.heightLine.setAttribute("x2", String(end.x));
      this.elements.heightLine.setAttribute("y2", String(end.y));
      this.elements.heightTickStart.setAttribute("x1", String(start.x - 6));
      this.elements.heightTickStart.setAttribute("y1", String(start.y));
      this.elements.heightTickStart.setAttribute("x2", String(start.x + 6));
      this.elements.heightTickStart.setAttribute("y2", String(start.y));
      this.elements.heightTickEnd.setAttribute("x1", String(end.x - 6));
      this.elements.heightTickEnd.setAttribute("y1", String(end.y));
      this.elements.heightTickEnd.setAttribute("x2", String(end.x + 6));
      this.elements.heightTickEnd.setAttribute("y2", String(end.y));
      this.elements.heightLabel.setAttribute("x", String((start.x + end.x) / 2 + 10));
      this.elements.heightLabel.setAttribute("y", String((start.y + end.y) / 2));
      this.elements.heightLabel.textContent = overallLabel;
    } else {
      this.elements.measurementOverlay.hidden = true;
    }

    const floor = projection.human?.floor || projection.humanFloor || projection.humanFloorPoint;
    const head = projection.human?.head || projection.humanHead || projection.humanHeadPoint;
    if (!this.presentation.scaleHeightInches || !floor || !head || ![floor.x, floor.y, head.x, head.y].every(Number.isFinite)) {
      this.elements.scaleReference.hidden = true;
      return;
    }
    const height = Math.max(1, Math.abs(floor.y - head.y));
    const left = (floor.x + head.x) / 2;
    const top = Math.min(floor.y, head.y);
    this.elements.scaleReference.style.left = `${left}px`;
    this.elements.scaleReference.style.top = `${top}px`;
    this.elements.scaleReference.style.height = `${height}px`;
    this.elements.scaleLabel.textContent = formatMillimeters(this.presentation.scaleHeightInches * 25.4, this.presentation.units);
    this.elements.scaleReference.hidden = false;
  }

  updateHistoryControls() {
    if (!this.root) return;
    this.root.querySelectorAll("[data-history-undo]").forEach((button) => button.disabled = !this.history.canUndo);
    this.root.querySelectorAll("[data-history-redo]").forEach((button) => button.disabled = !this.history.canRedo);
  }

  announceStatus(message) {
    if (this.elements.liveStatus) this.elements.liveStatus.textContent = String(message || "");
    callSafely(this.externalAnnounce, String(message || ""));
  }

  track(action, payload = {}) {
    callSafely(this.emitEvent, `direct_hardware_${action}`, {
      editor: "hardware",
      ...payload
    });
  }
}

export default DirectHardwareEditor;
