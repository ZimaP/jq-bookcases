import { readFileSync, writeFileSync } from "node:fs";

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first === -1) throw new Error(`Patch target not found: ${label}`);
  if (source.indexOf(before, first + before.length) !== -1) {
    throw new Error(`Patch target is not unique: ${label}`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

function replaceBlock(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  if (start === -1) throw new Error(`Block start not found: ${label}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end === -1) throw new Error(`Block end not found: ${label}`);
  return source.slice(0, start) + replacement + source.slice(end);
}

const path = "configurator-3d.js";
let source = readFileSync(path, "utf8");

source = replaceOnce(
  source,
  `import {
  createAcceptedDesignSnapshot,
  evaluateBookcaseCandidate,
  restoreAcceptedDesignSnapshot
} from "./bookcase-engine.js?v=engine-hardening-20260711a";
`,
  `import {
  createAcceptedDesignSnapshot,
  evaluateBookcaseCandidate,
  restoreAcceptedDesignSnapshot
} from "./bookcase-engine.js?v=engine-hardening-20260711a";
import {
  createExpectedRenderManifest,
  validateRenderedManifest
} from "./bookcase-render-contract.js?v=engine-hardening-20260711a";
`,
  "renderer contract import"
);

source = replaceOnce(
  source,
  `    return {
      update: () => {},
      setView: () => {}
    };
`,
  `    return {
      update: () => true,
      setView: () => {},
      lastRenderAudit: { valid: true, issues: [] }
    };
`,
  "fallback accepts valid state"
);

source = replaceBlock(
  source,
  "  update(nextState, options = {}) {",
  "  renderDoorOptions() {",
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

    const rendered = this.viewer.update(state, evaluation.layout);
    if (rendered === false) {
      this.syncControls();
      const renderMessage = this.viewer.lastRenderAudit?.issues?.[0]?.message ||
        "The 3D renderer rejected this configuration and kept the last verified model.";
      this.showStatus(renderMessage, true);
      return false;
    }

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

    if (!options.silent && evaluation.corrections.length) {
      this.showStatus(evaluation.corrections.map((correction) => correction.message || correction).join(" "));
    } else if (!options.silent) {
      this.clearStatus();
    }
    return true;
  }

`,
  "transaction includes renderer acceptance"
);

source = replaceBlock(
  source,
  "  update(nextState, precomputedLayout = null) {",
  "  frameModel(preserveZoom = true) {",
  `  update(nextState, precomputedLayout = null) {
    const candidateState = normalizeBookcaseConfig(nextState);
    const rebuilt = this.rebuildModel(candidateState, precomputedLayout);
    if (!rebuilt) return false;
    this.state = candidateState;
    this.frameModel(true);
    return true;
  }

`,
  "viewer update transaction"
);

source = replaceBlock(
  source,
  "  rebuildModel(precomputedLayout = null) {",
  "  updateCamera() {",
  `  rebuildModel(nextState, precomputedLayout = null) {
    const nextModel = buildBookcaseModel(nextState, precomputedLayout);
    this.lastLayout = nextModel.userData.layout;
    this.lastRenderAudit = nextModel.userData.renderAudit;
    const layoutValid = Boolean(this.lastLayout?.validation?.valid);
    const renderValid = Boolean(this.lastRenderAudit?.valid);
    if (!layoutValid || !renderValid) {
      this.root.dataset.renderValid = "false";
      if (this.lastRenderAudit?.issues?.length) {
        console.error("JQ Bookcases render contract rejected a model", this.lastRenderAudit.issues);
      }
      disposeObject(nextModel);
      return false;
    }
    this.scene.remove(this.model);
    disposeObject(this.model);
    this.model = nextModel;
    this.scene.add(this.model);
    this.root.dataset.renderValid = "true";
    return true;
  }

`,
  "viewer render audit gate"
);

source = replaceBlock(
  source,
  "function buildBookcaseModel(state, precomputedLayout = null) {",
  "function renderLayoutComponent(",
  `function buildBookcaseModel(state, precomputedLayout = null) {
  const config = normalizeBookcaseConfig(state);
  const layout = precomputedLayout || generateBookcaseLayout(config);
  const finishColor = config.finish === "custom_bm" && config.customPaintHex
    ? hexToNumber(config.customPaintHex, finishPalette.custom_bm)
    : finishPalette[config.finish] || finishPalette.white_dove;
  const materials = createMaterials(finishColor, config);
  const group = new THREE.Group();
  group.name = "bookcase-assembly";
  group.userData = {
    edgeLine: materials.edgeLine,
    layout,
    pointLightCount: 0,
    renderRecords: [],
    renderAudit: { valid: false, issues: [] }
  };

  const depth = inchesToUnits(layout.config.depth);
  const logicalRoles = new Set(["assembly", "section", "section_group"]);
  const componentGroups = new Map();
  componentGroups.set("bookcase", group);

  layout.components.forEach((component) => {
    if (component.role === "assembly") {
      componentGroups.set(component.id, group);
      return;
    }
    const componentGroup = new THREE.Group();
    componentGroup.name = component.id;
    componentGroup.userData = {
      componentId: component.id,
      role: component.role,
      parentId: component.parentId,
      hostId: component.hostId,
      bounds: component.bounds,
      edgeLine: materials.edgeLine
    };
    componentGroups.set(component.id, componentGroup);
  });

  layout.components.forEach((component) => {
    if (component.role === "assembly") return;
    const componentGroup = componentGroups.get(component.id);
    const parentGroup = componentGroups.get(component.parentId) || group;
    parentGroup.add(componentGroup);
  });

  layout.components.forEach((component) => {
    if (logicalRoles.has(component.role)) return;
    const componentGroup = componentGroups.get(component.id) || group;
    renderLayoutComponent(componentGroup, group, component, config, materials, depth);
  });

  if (layout.validation?.valid) {
    group.updateMatrixWorld(true);
    const renderRecords = collectRenderedComponentRecords(layout, componentGroups);
    group.userData.renderRecords = renderRecords;
    group.userData.renderAudit = validateRenderedManifest(layout, renderRecords);
  } else {
    group.userData.renderAudit = {
      valid: false,
      expectedCount: 0,
      renderedCount: 0,
      issues: layout.validation?.errors || []
    };
  }

  return group;
}

`,
  "descriptor-driven model build"
);

source = replaceBlock(
  source,
  "function renderLayoutComponent(",
  "function getLayoutMaterial(",
  `function renderLayoutComponent(componentGroup, rootGroup, component, config, materials, bookcaseDepth) {
  const size = [
    inchesToUnits(component.size.x),
    inchesToUnits(component.size.y),
    inchesToUnits(component.size.z)
  ];
  const position = [
    inchesToUnits(component.position.x),
    inchesToUnits(component.position.y),
    bookcaseDepth / 2 - inchesToUnits(component.position.z)
  ];
  if (size.some((value) => !Number.isFinite(value) || value <= 0)) return;

  if (component.role === "opening") {
    renderLayoutOpening(componentGroup, component, materials, size, position, bookcaseDepth);
    return;
  }
  if (component.role === "door" || component.role === "drawer_front") {
    renderDescriptorDoor(componentGroup, component, config, materials, size, position);
    return;
  }
  if (component.role === "handle") {
    renderDescriptorHandle(componentGroup, component, config, materials, size, position);
    return;
  }
  if (component.role === "light") {
    renderDescriptorLight(componentGroup, rootGroup, component, materials, size, position);
    return;
  }

  const material = getLayoutMaterial(component, materials);
  const showEdges = !["trim", "crown", "base"].includes(component.role);
  addBox(componentGroup, size, position, material, showEdges);
}

`,
  "strict descriptor component renderer"
);

source = replaceOnce(
  source,
  `function renderLayoutOpening(group, component, materials, size, position, bookcaseDepth) {
`,
  `function renderDescriptorDoor(group, component, config, materials, size, position) {
  const [width, height, depth] = size;
  const [x, y, z] = position;
  const style = component.role === "drawer_front"
    ? "flat"
    : component.metadata?.style || config.doorStyle;

  if (style === "flat") {
    addBox(group, size, position, materials.case);
    return;
  }

  const rail = clamp(
    style === "slim_shaker" ? Math.min(width, height) * 0.065 : Math.min(width, height) * 0.095,
    Math.min(width, height) * 0.04,
    Math.min(width, height) * 0.22
  );
  const backingDepth = depth * 0.46;
  const faceDepth = depth - backingDepth;
  const backZ = z - depth / 2 + backingDepth / 2;
  const faceZ = z + depth / 2 - faceDepth / 2;
  const centerWidth = Math.max(width - rail * 2, width * 0.25);
  const centerHeight = Math.max(height - rail * 2, height * 0.25);

  addBox(
    group,
    [width, height, backingDepth],
    [x, y, backZ],
    style === "glass" ? materials.glass : materials.inset,
    false
  );
  addBox(group, [width, rail, faceDepth], [x, y + height / 2 - rail / 2, faceZ], materials.case, false);
  addBox(group, [width, rail, faceDepth], [x, y - height / 2 + rail / 2, faceZ], materials.case, false);
  addBox(group, [rail, centerHeight, faceDepth], [x - width / 2 + rail / 2, y, faceZ], materials.case, false);
  addBox(group, [rail, centerHeight, faceDepth], [x + width / 2 - rail / 2, y, faceZ], materials.case, false);

  if (style !== "glass") {
    const panelDepth = Math.min(faceDepth * 0.48, depth * 0.28);
    addBox(
      group,
      [centerWidth, centerHeight, panelDepth],
      [x, y, z + depth / 2 - faceDepth + panelDepth / 2],
      materials.inset,
      false
    );
  }
}

function renderDescriptorHandle(group, component, config, materials, size, position) {
  const hardwareType = component.metadata?.hardware || config.hardware;
  if (hardwareType === "push_latch") return;
  const orientation = component.metadata?.orientation || (size[0] > size[1] ? "horizontal" : "vertical");
  const isPull = hardwareType.endsWith("_pull");

  if (isPull) {
    const horizontal = orientation === "horizontal";
    const length = (horizontal ? size[0] : size[1]) * 0.72;
    const crossA = horizontal ? size[1] : size[0];
    const radius = Math.max(0.003, Math.min(crossA, size[2]) * 0.24);
    const pull = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 18), materials.hardware);
    if (horizontal) pull.rotation.z = Math.PI / 2;
    pull.position.set(...position);
    pull.castShadow = true;
    group.add(pull);
    return;
  }

  const radius = Math.max(0.004, Math.min(size[0], size[1], size[2]) * 0.38);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 16), materials.hardware);
  knob.position.set(...position);
  knob.castShadow = true;
  group.add(knob);
}

function renderDescriptorLight(group, rootGroup, component, materials, size, position) {
  const type = component.metadata?.lightType || "puck";
  if (type === "puck") {
    const radius = Math.max(0.003, Math.min(size[0], size[2]) * 0.45);
    const puck = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, size[1] * 0.8, 20), materials.puckLight);
    puck.position.set(...position);
    puck.castShadow = false;
    group.add(puck);
  } else {
    addBox(
      group,
      [size[0] * 0.88, size[1] * 0.88, size[2] * 0.88],
      position,
      materials.ledStrip,
      false
    );
  }

  if (rootGroup.userData.pointLightCount >= 18) return;
  const temperature = Number(component.metadata?.warmth) || 2700;
  const color = getLightingTemperatureColor(temperature);
  const glow = new THREE.PointLight(color, type === "puck" ? 0.4 : 0.11, type === "puck" ? 2.2 : 1.5);
  glow.position.set(position[0], position[1] - (type === "vertical_led" ? 0 : 0.09), position[2] + 0.045);
  group.add(glow);
  rootGroup.userData.pointLightCount += 1;
}

function collectRenderedComponentRecords(layout, componentGroups) {
  const expected = createExpectedRenderManifest(layout);
  const records = [];
  for (const descriptor of expected) {
    const componentGroup = componentGroups.get(descriptor.componentId);
    const record = componentGroup ? collectOwnedMeshRecord(componentGroup, descriptor.componentId) : null;
    if (record) records.push(record);
  }
  return records;
}

function collectOwnedMeshRecord(componentGroup, componentId) {
  const bounds = new THREE.Box3().makeEmpty();
  let meshCount = 0;

  const visit = (object) => {
    if (object !== componentGroup && object.userData?.componentId) return;
    if (object.isMesh && object.geometry) {
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
      const meshBounds = object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld);
      bounds.union(meshBounds);
      meshCount += 1;
    }
    object.children.forEach(visit);
  };
  visit(componentGroup);

  if (!meshCount || bounds.isEmpty()) return null;
  return {
    componentId,
    meshCount,
    bounds: {
      min: { x: bounds.min.x, y: bounds.min.y, z: bounds.min.z },
      max: { x: bounds.max.x, y: bounds.max.y, z: bounds.max.z }
    }
  };
}

function renderLayoutOpening(group, component, materials, size, position, bookcaseDepth) {
`,
  "bounded descriptor render helpers"
);

writeFileSync(path, source);
