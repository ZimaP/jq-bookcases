import { readFileSync, writeFileSync } from "node:fs";

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first === -1) throw new Error(`Patch target not found: ${label}`);
  if (source.indexOf(before, first + before.length) !== -1) {
    throw new Error(`Patch target is not unique: ${label}`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

function patchConfigurator() {
  const path = "configurator-3d.js";
  let source = readFileSync(path, "utf8");

  source = replaceOnce(
    source,
    "  createDesignId,\n",
    "",
    "remove legacy createDesignId import"
  );

  source = replaceOnce(
    source,
    "import { calculateBookcasePrice, formatPrice } from \"./bookcase-pricing.js?v=site-system-20260710a\";\n",
    "import { calculateBookcasePrice, formatPrice } from \"./bookcase-pricing.js?v=site-system-20260710a\";\nimport {\n  createAcceptedDesignSnapshot,\n  evaluateBookcaseCandidate,\n  restoreAcceptedDesignSnapshot\n} from \"./bookcase-engine.js?v=engine-hardening-20260711a\";\n",
    "import atomic engine"
  );

  source = replaceOnce(
    source,
`  constructor(host, index) {
    this.host = host;
    this.id = \`jq-builder-\${index + 1}\`;
    this.state = normalizeBookcaseConfig(this.loadInitialConfig());
    this.activeView = "three-quarter";
    this.doorOptionKey = "";
    this.activeRangeDrag = null;
    this.render();
    this.cacheElements();
    this.viewer = this.createViewer();
    this.bindEvents();
    this.update(this.state);
  }
`,
`  constructor(host, index) {
    this.host = host;
    this.id = \`jq-builder-\${index + 1}\`;
    const initialEvaluation = evaluateBookcaseCandidate(this.loadInitialConfig());
    const acceptedInitial = initialEvaluation.accepted
      ? initialEvaluation
      : evaluateBookcaseCandidate(defaultBookcaseConfig);
    if (!acceptedInitial.accepted) throw new Error("The default bookcase configuration must be valid.");
    this.acceptedEvaluation = acceptedInitial;
    this.state = acceptedInitial.state;
    this.layout = acceptedInitial.layout;
    this.bom = acceptedInitial.bom;
    this.pricing = acceptedInitial.pricing;
    this.activeView = "three-quarter";
    this.doorOptionKey = "";
    this.activeRangeDrag = null;
    this.render();
    this.cacheElements();
    this.viewer = this.createViewer();
    this.bindEvents();
    this.update(this.state, { silent: true });
  }
`,
    "constructor accepted artifacts"
  );

  source = replaceOnce(
    source,
`      const stored = JSON.parse(localStorage.getItem("jqBookcasesDesign") || "null");
      if (!stored || ![2, 3].includes(Number(stored.schemaVersion))) return defaultBookcaseConfig;
      const candidate = normalizeBookcaseConfig(stored.config || stored.state || {});
      return generateBookcaseLayout(candidate).validation.valid ? candidate : defaultBookcaseConfig;
`,
`      const stored = JSON.parse(localStorage.getItem("jqBookcasesDesign") || "null");
      if (!stored || ![2, 3, 4].includes(Number(stored.schemaVersion))) return defaultBookcaseConfig;
      const restored = restoreAcceptedDesignSnapshot(stored);
      return restored.accepted ? restored.state : defaultBookcaseConfig;
`,
    "validated save restore"
  );

  source = replaceOnce(
    source,
    '<strong data-price>${formatPrice(calculateBookcasePrice(this.state))}</strong>',
    '<strong data-price>${formatPrice(this.pricing?.total ?? calculateBookcasePrice(this.state, this.layout))}</strong>',
    "initial accepted price"
  );

  source = replaceOnce(
    source,
`    this.update({
      ...this.state,
      ...preset.config,
      ...retainedSelections,
      layoutPreset: preset.id
    });
    this.showStatus(\`${preset.name} preset applied. You can keep customizing from here.\`);
`,
`    const applied = this.update({
      ...this.state,
      ...preset.config,
      ...retainedSelections,
      layoutPreset: preset.id
    });
    if (applied) this.showStatus(\`${preset.name} preset applied. You can keep customizing from here.\`);
`,
    "preset transaction result"
  );

  source = replaceOnce(
    source,
`  update(nextState) {
    const normalizedState = normalizeBookcaseConfig(nextState);
    this.layout = generateBookcaseLayout(normalizedState);
    this.state = normalizeBookcaseConfig({ ...normalizedState, ...this.layout.config });
    this.state.layoutPreset = this.findMatchingPresetId(this.state);
    this.renderDoorOptions();
    this.syncControls();
    this.syncLowerDependentControls();
    this.syncPresetCards();
    this.updatePriceAndSummary();
    this.viewer.update(this.state, this.layout);
    if (!this.layout.validation.valid) {
      this.showStatus(this.layout.validation.errors[0]?.message || "This configuration is not structurally valid.", true);
    } else if (this.layout.corrections.length) {
      this.showStatus(this.layout.corrections.map((correction) => correction.message || correction).join(" "));
    }
  }
`,
`  update(nextState, options = {}) {
    const evaluation = evaluateBookcaseCandidate(nextState);
    if (!evaluation.accepted) {
      this.syncControls();
      const errorMessage = evaluation.errors[0]?.message || "This configuration is not structurally valid.";
      this.showStatus(errorMessage, true);
      return false;
    }

    const layoutPreset = this.findMatchingPresetId(evaluation.state);
    const state = normalizeBookcaseConfig({ ...evaluation.state, layoutPreset });
    const committedEvaluation = {
      ...evaluation,
      state,
      pricing: { ...evaluation.pricing, state }
    };

    this.acceptedEvaluation = committedEvaluation;
    this.state = state;
    this.layout = evaluation.layout;
    this.bom = evaluation.bom;
    this.pricing = committedEvaluation.pricing;
    this.renderDoorOptions();
    this.syncControls();
    this.syncLowerDependentControls();
    this.syncPresetCards();
    this.updatePriceAndSummary();
    this.viewer.update(this.state, this.layout);

    if (!options.silent && evaluation.corrections.length) {
      this.showStatus(evaluation.corrections.map((correction) => correction.message || correction).join(" "));
    } else if (!options.silent) {
      this.clearStatus();
    }
    return true;
  }
`,
    "atomic update"
  );

  source = replaceOnce(
    source,
`  updatePriceAndSummary() {
    const price = calculateBookcasePrice(this.state);
`,
`  updatePriceAndSummary() {
    const price = this.pricing?.total ?? calculateBookcasePrice(this.state, this.layout);
`,
    "accepted summary price"
  );

  source = replaceOnce(
    source,
`  saveCurrentDesign() {
    const price = calculateBookcasePrice(this.state);
    const id = createDesignId(this.state, price);
    const design = {
      schemaVersion: 3,
      id,
      price,
      config: this.state,
      savedAt: new Date().toISOString()
    };
    let persisted = false;
    try {
      localStorage.setItem("jqBookcasesDesign", JSON.stringify(design));
      persisted = true;
    } catch (error) {
      // Local storage may be disabled; keep the visible ID available.
    }
    return { ...design, persisted };
  }
`,
`  saveCurrentDesign() {
    const design = createAcceptedDesignSnapshot(this.acceptedEvaluation);
    let persisted = false;
    try {
      localStorage.setItem("jqBookcasesDesign", JSON.stringify(design));
      persisted = true;
    } catch (error) {
      // Local storage may be disabled; keep the visible ID available.
    }
    return { ...design, persisted };
  }
`,
    "accepted snapshot persistence"
  );

  source = replaceOnce(
    source,
`  showStatus(message, persistent = false) {
`,
`  clearStatus() {
    window.clearTimeout(this.statusTimer);
    this.elements.status.textContent = "";
    this.elements.status.classList.remove("is-visible");
  }

  showStatus(message, persistent = false) {
`,
    "clear persistent rejection status"
  );

  writeFileSync(path, source);
}

function patchQuoteFlow() {
  const path = "site.js";
  let source = readFileSync(path, "utf8");

  source = replaceOnce(
    source,
    "    const config = matchingStoredDesign?.config || matchingStoredDesign?.state || {};\n",
    "    const config = matchingStoredDesign?.canonicalConfig || matchingStoredDesign?.config || matchingStoredDesign?.state || {};\n",
    "quote canonical config"
  );
  source = replaceOnce(
    source,
    "    const designDetails = [formatStoredPrice(matchingStoredDesign?.price), formatPresetLabel(config.layoutPreset)].filter(Boolean).map(escapeHtml).join(\" &middot; \");\n",
    "    const designDetails = [formatStoredPrice(matchingStoredDesign?.total ?? matchingStoredDesign?.price), formatPresetLabel(config.layoutPreset)].filter(Boolean).map(escapeHtml).join(\" &middot; \");\n",
    "quote accepted total"
  );

  writeFileSync(path, source);
}

function patchFingerprint() {
  const path = "bookcase-bom.js";
  let source = readFileSync(path, "utf8");
  source = replaceOnce(
    source,
    "    coordinateSystem: layout.coordinateSystem,\n    config: layout.config,\n    components: layout.components.map((component) => ({\n",
    "    coordinateSystem: layout.coordinateSystem,\n    components: layout.components.map((component) => ({\n",
    "physical-only layout fingerprint"
  );
  writeFileSync(path, source);
}

patchConfigurator();
patchQuoteFlow();
patchFingerprint();
