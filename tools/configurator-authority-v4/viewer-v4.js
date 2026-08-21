import * as THREE from "three";
import { createGuidedLayoutViewerController } from "../../guided-layout-viewer.js?v=immersive-layout-configurator-v1";
import { V4_VISUAL_CONTRACT, resolveV4Diagnostic } from "./visual-contract.js";

let roleManifestPromise = null;

function loadRoleManifest() {
  if (!roleManifestPromise) {
    roleManifestPromise = fetch(new URL("../../config/configurator-authority-v4-visual-roles.json", import.meta.url), {
      cache: "no-store",
      credentials: "same-origin",
      redirect: "error"
    }).then((response) => {
      if (!response.ok) throw new Error(`V4 visual-role manifest returned HTTP ${response.status}.`);
      return response.json();
    });
  }
  return roleManifestPromise;
}

function boxSurfaceArea(worldBounds) {
  const size = worldBounds?.size || [0, 0, 0];
  return 2 * (size[0] * size[1] + size[0] * size[2] + size[1] * size[2]);
}

function removeCustomerDimensionSurface(controller) {
  controller.showDimensions = false;
  controller.dimensionSvg?.remove?.();
  controller.dimensionHandle?.remove?.();
  controller.dimensionSvg = null;
  controller.dimensionLine = null;
  controller.dimensionExtensionLower = null;
  controller.dimensionExtensionUpper = null;
  controller.dimensionLabel = null;
  controller.dimensionHandle = null;
  if (controller.runtime) {
    controller.runtime.dataset.dimensionsVisible = "false";
    controller.runtime.querySelectorAll("[data-dimension-handle], .immersive-dimension-overlay").forEach((node) => node.remove());
  }
}

function materialFor(role, recipe, cache) {
  if (cache.has(role)) return cache.get(role);
  const material = recipe.unlitContext
    ? new THREE.MeshBasicMaterial({
      color: recipe.color,
      side: THREE.DoubleSide,
      transparent: false,
      depthWrite: true,
      depthTest: true,
      toneMapped: true
    })
    : new THREE.MeshStandardMaterial({
      color: recipe.color,
      roughness: recipe.roughness,
      metalness: recipe.metalness,
      transparent: false,
      depthWrite: true,
      depthTest: true,
      flatShading: Boolean(recipe.flatShading),
      toneMapped: true
    });
  material.name = `v4-proof-diagnostic:${role}`;
  if (material.isMeshStandardMaterial) material.envMapIntensity = role === "hardware" ? 1.12 : 0.9;
  material.userData = { v4ProofDiagnostic: true, role, unlitContext: Boolean(recipe.unlitContext) };
  cache.set(role, material);
  return material;
}

async function applySharedVisualSystem(controller) {
  const manifest = await loadRoleManifest();
  const layout = manifest.layouts.find(({ layoutId }) => layoutId === controller.layoutId);
  if (!layout || layout.records.length !== controller.meshRecords.length) {
    throw new Error(`V4 visual-role coverage differs from ${controller.layout?.label || controller.layoutId}.`);
  }
  const diagnostic = resolveV4Diagnostic();
  const byId = new Map(layout.records.map((record) => [record.stablePrimitiveId, record]));
  const materials = new Map();
  const applied = [];
  const candidates = [];
  const priority = new Map(V4_VISUAL_CONTRACT.shadow.rolePriority.map((role, index) => [role, index]));
  for (const runtimeRecord of controller.meshRecords) {
    const stablePrimitiveId = runtimeRecord.zoneRecord?.stablePrimitiveId;
    const record = byId.get(stablePrimitiveId);
    if (!record
      || record.meshIndex !== runtimeRecord.meshIndex
      || record.nodeIndex !== runtimeRecord.nodeIndex
      || record.primitiveIndex !== runtimeRecord.primitiveIndex) {
      throw new Error(`V4 stable primitive binding failed for ${stablePrimitiveId || "unknown"}.`);
    }
    runtimeRecord.object.castShadow = false;
    runtimeRecord.object.receiveShadow = V4_VISUAL_CONTRACT.shadow.receiveRoles.includes(record.role)
      || V4_VISUAL_CONTRACT.shadow.protectedReceivers.includes(record.originalZone);
    const recipe = diagnostic.roles[record.role];
    if (recipe) {
      runtimeRecord.object.material = materialFor(record.role, recipe, materials);
      runtimeRecord.object.userData.v4ProofRole = record.role;
      applied.push(record.stablePrimitiveId);
    }
    if (V4_VISUAL_CONTRACT.shadow.castRoles.includes(record.role)) {
      candidates.push({ runtimeRecord, record, surfaceArea: boxSurfaceArea(record.worldBounds) });
    }
  }
  const visiblePrimitiveCount = controller.meshRecords.filter(({ object }) => object.visible).length;
  const maximumCasters = Math.max(0, V4_VISUAL_CONTRACT.renderer.maximumDrawCalls - visiblePrimitiveCount);
  candidates.sort((left, right) => (
    (priority.get(left.record.role) ?? 99) - (priority.get(right.record.role) ?? 99)
    || right.surfaceArea - left.surfaceArea
    || left.record.stablePrimitiveId.localeCompare(right.record.stablePrimitiveId)
  ));
  const casters = candidates.slice(0, maximumCasters);
  for (const { runtimeRecord } of casters) runtimeRecord.object.castShadow = true;
  for (const material of materials.values()) controller.ownedMaterials.add(material);
  controller.shadowPrimitiveBudget = Object.freeze({
    drawCallLimit: V4_VISUAL_CONTRACT.renderer.maximumDrawCalls,
    visiblePrimitiveCount,
    eligibleVisualRolePrimitiveCount: candidates.length,
    selectedShadowPrimitiveCount: casters.length,
    projectedMaximumDrawCalls: visiblePrimitiveCount + casters.length,
    selection: V4_VISUAL_CONTRACT.shadow.selection,
    allSelectedFromExactRoleManifest: casters.every(({ record }) => byId.has(record.stablePrimitiveId))
  });
  controller.requestShadowRefresh();
  await controller.renderNow();
  return Object.freeze({
    schema: V4_VISUAL_CONTRACT.schema,
    diagnosticId: diagnostic.id,
    diagnosticLabel: diagnostic.label,
    customerFinish: false,
    layoutId: controller.layoutId,
    sourcePrimitiveCount: controller.meshRecords.length,
    exactRoleCoverage: byId.size,
    proofMaterialPrimitiveCount: applied.length,
    proofMaterialRoles: [...materials.keys()].sort(),
    protectedSourcePrimitiveCount: controller.meshRecords.length - applied.length,
    shadowBudget: controller.shadowPrimitiveBudget,
    geometryModified: false,
    edgeTreatmentApplied: false,
    perLayoutExposureOverride: false
  });
}

function publicDiagnostics(controller, visual, phase = controller.state) {
  const raw = controller.getDiagnostics();
  const transform = raw.transformProof;
  return Object.freeze({
    schema: "jq-configurator-authority-v4-runtime-v1",
    state: phase,
    instanceId: raw.instanceId,
    layoutId: raw.layoutId,
    layoutLabel: raw.layoutLabel,
    backend: raw.backend,
    asset: Object.freeze({
      path: raw.assetPath,
      authoritativePath: raw.authoritativePath,
      expectedSha256: raw.authoritativeSha256,
      actualSha256: raw.assetSha256,
      bytes: raw.assetBytes,
      requestCount: raw.requestCount,
      successfulRequestCount: raw.successfulRequestCount,
      parseCount: raw.parseCount
    }),
    camera: raw.camera,
    rendererInfo: raw.rendererInfo,
    geometry: transform ? Object.freeze({
      sourceBuffersImmutable: transform.sourceBuffersImmutable,
      nativeDegenerateTriangles: transform.nativeDegenerateTriangles,
      currentDegenerateTriangles: transform.currentDegenerateTriangles,
      degenerateTriangleDelta: transform.degenerateTriangleDelta,
      modelBoundsDeltaMillimeters: transform.modelBoundsDeltaMillimeters,
      fixedWorldTranslationMaximumMillimeters: transform.fixedWorldTranslationMaximumMillimeters,
      fixedWorldLinearMaximumDelta: transform.fixedWorldLinearMaximumDelta,
      invalidValueCount: transform.invalidValueCount,
      geometryMutationCount: transform.geometryMutationCount
    }) : null,
    presentation: visual,
    ownership: raw.ownership,
    layoutSwitchCount: raw.layoutSwitchCount,
    resourceDisposalCount: raw.resourceDisposalCount,
    firstUsableMilliseconds: raw.firstUsableMilliseconds,
    lastError: raw.lastError
  });
}

export class V4LayoutViewer {
  constructor(options = {}) {
    this.options = options;
    this.visual = null;
    this.readySequence = 0;
    this.inner = createGuidedLayoutViewerController({
      onDimensionChange: () => {},
      onDimensionEditRequest: () => {},
      onStateChange: (state, details) => this.handleState(state, details)
    });
    const sync = this.inner.syncDiagnostics.bind(this.inner);
    this.inner.syncDiagnostics = () => {
      sync();
      this.publish();
    };
  }

  mount(target) {
    const mounted = this.inner.mount(target);
    removeCustomerDimensionSurface(this.inner);
    return mounted;
  }

  async update(project, options = {}) {
    this.visual = null;
    removeCustomerDimensionSurface(this.inner);
    const acceptedShape = { layout: project.layout, layoutStates: { [project.layout]: {} } };
    const result = await this.inner.update(acceptedShape, { ...options, showDimensions: false });
    removeCustomerDimensionSurface(this.inner);
    this.publish();
    return result;
  }

  async handleState(state, details) {
    if (state !== "ready") {
      this.publish(state);
      this.options.onStateChange?.(state, details);
      return;
    }
    const sequence = ++this.readySequence;
    try {
      removeCustomerDimensionSurface(this.inner);
      const visual = await applySharedVisualSystem(this.inner);
      if (sequence !== this.readySequence || this.inner.disposed) return;
      this.visual = visual;
      this.publish("ready");
      this.options.onStateChange?.("ready", { ...details, visual });
    } catch (error) {
      this.publish("visual-error");
      this.options.onStateChange?.("error", { ...details, code: "V4_VISUAL_ROLE_FAILED", message: error.message });
    }
  }

  publish(phase) {
    const diagnostics = publicDiagnostics(this.inner, this.visual, phase);
    globalThis.__JQ_CONFIGURATOR_V4_DIAGNOSTICS__ = diagnostics;
    if (this.inner.runtime) {
      this.inner.runtime.dataset.v4Proof = "true";
      this.inner.runtime.dataset.customerDimensionControls = "0";
      this.inner.runtime.dataset.v4VisualReady = String(Boolean(this.visual));
    }
    return diagnostics;
  }

  setView(view) { return this.inner.setView(view); }
  zoom(command) { return this.inner.zoom(command); }
  fitCamera(options) { return this.inner.fitCamera(options); }
  resetCamera(options) { return this.inner.resetCamera(options); }
  renderNow() { return this.inner.renderNow(); }
  getDiagnostics() { return this.publish(); }
  unmount() { return this.inner.unmount(); }
  dispose() { this.readySequence += 1; return this.inner.dispose(); }
}

export function createV4LayoutViewer(options) {
  return new V4LayoutViewer(options);
}
