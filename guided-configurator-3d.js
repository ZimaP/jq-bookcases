import * as THREE from "./assets/vendor/three.module.js";
import { createGuidedScenePlan } from "./guided-scene-plan.js?v=luxury-configurator-engine-v1-20260802c";
import {
  applyGuidedEnvironment,
  applyPhysicalBoxUvs,
  applyPhysicalExtrusionUvs,
  createGuidedMaterialLibrary,
  isGuidedSharedTexture
} from "./guided-materials.js?v=luxury-configurator-engine-v1";
import {
  auditGuidedAcceptedSpecification,
  createGuidedSceneDescriptors,
  validateGuidedRenderedManifest
} from "./guided-render-contract.js?v=luxury-configurator-engine-v1";
import {
  createGuidedAcceptedComponentRenderPlan as createSharedGuidedAcceptedComponentRenderPlan,
  finiteGuidedAcceptedNumber as finiteAcceptedNumber,
  isGuidedAcceptedCrownProfile as isAcceptedCrownProfile,
  isGuidedAcceptedRenderBounds as isAcceptedRenderBounds
} from "./guided-render-primitives.js?v=blender-render-foundation-v1";

const INCH_TO_SCENE = 1 / 12;
const MAX_DEVICE_PIXEL_RATIO = 2;
const MIN_SURFACE_THICKNESS = 0.065;
const CAMERA_FOV = 35;
const CAMERA_NEAR = 0.04;
const CAMERA_FAR = 320;
const CONCEPT_SCENE_PURPOSE = "accepted-fitted-millwork-specification";
const ARCHITECTURAL_CLEARANCE = 2.5;
const DIMENSION_LABEL_GAP = 6;
const DIMENSION_LABEL_VIEWPORT_PADDING = 8;
const DIMENSION_LABEL_BOTTOM_RESERVE = 44;
const GUIDED_NEUTRAL_MATERIAL_COLOR = 0xb8b5ae;
const GUIDED_NEUTRAL_MATERIAL_ROUGHNESS = 0.72;
const GUIDED_NEUTRAL_MATERIAL_SLOTS = Object.freeze([
  "case",
  "side",
  "back",
  "front",
  "inset",
  "accent"
]);
const GUIDED_FINISH_TEXTURE_SLOTS = Object.freeze([
  "map",
  "normalMap",
  "roughnessMap",
  "aoMap"
]);
const GUIDED_APPEARANCE_DESCRIPTOR_ROLES = new Set(["handle", "light"]);

export const GUIDED_RESOURCE_FALLBACKS = Object.freeze({
  material: Object.freeze({
    code: "GUIDED_MATERIAL_ASSET_FALLBACK",
    id: "jq-neutral-material-v1",
    label: "JQ Neutral Material",
    message: "A selected finish asset could not be loaded. The preview is using JQ Neutral Material instead."
  }),
  environment: Object.freeze({
    code: "GUIDED_ENVIRONMENT_ASSET_FALLBACK",
    id: "jq-neutral-studio-lighting-v1",
    label: "JQ Neutral Studio Lighting",
    message: "The preview environment could not be loaded. The preview is using JQ Neutral Studio Lighting instead."
  })
});

/**
 * Replace finish-dependent surfaces with an explicit, asset-independent
 * neutral material. Hardware, glass, screens, and lighting remain separate
 * materials and are intentionally untouched. Accent surfaces join the
 * fallback because both match-exterior and sprayed accent paints depend on
 * finish assets loaded through this material pipeline.
 */
export function applyGuidedNeutralMaterialFallback(library) {
  if (!library || typeof library !== "object") return false;
  const fallback = GUIDED_RESOURCE_FALLBACKS.material;
  const requestedFinishId = library.requestedFinishId || library.finishId || "unknown";
  let applied = false;

  GUIDED_NEUTRAL_MATERIAL_SLOTS.forEach((slot) => {
    const material = library[slot];
    if (!material || typeof material !== "object") return;
    GUIDED_FINISH_TEXTURE_SLOTS.forEach((textureSlot) => {
      if (textureSlot in material) material[textureSlot] = null;
    });
    material.color?.set?.(GUIDED_NEUTRAL_MATERIAL_COLOR);
    material.roughness = GUIDED_NEUTRAL_MATERIAL_ROUGHNESS;
    material.metalness = 0;
    material.name = `${fallback.label} · ${slot}`;
    material.userData ||= {};
    material.userData.guidedRequestedFinishId = slot === "accent"
      ? library.accentFinishId || requestedFinishId
      : requestedFinishId;
    material.userData.guidedFinishId = fallback.id;
    material.userData.guidedFallbackId = fallback.id;
    material.userData.guidedNeutralFallback = true;
    material.needsUpdate = true;
    applied = true;
  });

  if (!applied) return false;
  library.requestedFinishId = requestedFinishId;
  library.finishId = fallback.id;
  library.finishFamily = "neutral-fallback";
  library.accentFinishId = fallback.id;
  library.accentMatchesExterior = true;
  library.repeatInches = Object.freeze([12, 12]);
  library.fallbackId = fallback.id;
  return true;
}

let guidedSceneInstanceSequence = 0;

/**
 * Create the lightweight renderer used by the guided configurator.
 *
 * The room plan is presentation-only. Product meshes are created exclusively
 * from the audited descriptor graph in the accepted guided specification.
 */
export function createGuidedSceneController(options = {}) {
  return new GuidedSceneController(options);
}

export class GuidedSceneController {
  constructor(options = {}) {
    this.instanceId = ++guidedSceneInstanceSequence;
    this.onStateChange = typeof options.onStateChange === "function"
      ? options.onStateChange
      : () => {};
    this.onError = typeof options.onError === "function"
      ? options.onError
      : () => {};
    this.onWarning = typeof options.onWarning === "function"
      ? options.onWarning
      : () => {};

    this.runtime = null;
    this.canvas = null;
    this.labelLayer = null;
    this.hint = null;
    this.resourceWarningElement = null;
    this.mountTarget = null;
    this.ownerWindow = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.content = null;
    this.dimensionLabels = [];
    this.resizeObserver = null;
    this.resizeAbortController = null;
    this.resizeFrame = null;
    this.controlAbortController = null;
    this.animationFrame = null;
    this.rendering = false;
    this.disposed = false;
    this.failed = false;
    this.state = "idle";
    this.plan = null;
    this.options = Object.freeze({ showProduct: false, showDimensions: false });
    this.sceneSignature = "";
    this.geometrySignature = "";
    this.appearanceSignature = "";
    this.materialSignature = "";
    this.topologySignature = "";
    this.acceptedSpecification = null;
    this.productGroup = null;
    this.renderAudit = null;
    this.geometryRebuildCount = 0;
    this.appearanceUpdateCount = 0;
    this.materialUpdateCount = 0;
    this.userAdjustedCamera = false;
    this.resourceWarnings = new Map();
    this.activeMaterialLoad = null;

    this.cameraTarget = new THREE.Vector3();
    this.defaultCameraTarget = new THREE.Vector3();
    this.theta = -0.08;
    this.phi = 0.12;
    this.radius = 14;
    this.baseRadius = 14;
    this.defaultTheta = -0.08;
    this.defaultPhi = 0.12;
    this.minRadius = 5;
    this.maxRadius = 34;
    this.activePointers = new Map();
    this.dragPoint = null;
    this.pinchDistance = null;
  }

  mount(target) {
    if (this.disposed) return false;
    if (!target || typeof target.appendChild !== "function") {
      return this.fail(new TypeError("A valid guided 3D mount target is required."));
    }

    this.notifyState("loading");
    try {
      this.ensureRuntime(target.ownerDocument || globalThis.document);
      this.mountTarget = target;
      this.ownerWindow = target.ownerDocument?.defaultView || globalThis.window || null;
      if (this.runtime.parentNode !== target) target.appendChild(this.runtime);
      this.runtime.hidden = false;
      this.observeMountTarget();
      this.resize();
      this.scheduleResize();
      this.requestRender();
      return true;
    } catch (error) {
      return this.fail(error);
    }
  }

  unmount() {
    if (this.disposed) return;
    this.cancelScheduledRender();
    this.cancelScheduledResize();
    this.resizeObserver?.disconnect();
    this.resizeAbortController?.abort();
    this.resizeAbortController = null;
    this.runtime?.remove();
    this.mountTarget = null;
  }

  update(project, options = {}) {
    if (this.disposed) return false;
    const nextOptions = Object.freeze({
      showProduct: options.showProduct === true,
      showDimensions: options.showDimensions === true,
      acceptedSpecification: options.acceptedSpecification || null,
      rejectedCandidate: options.rejectedCandidate || null
    });
    const preserveReadyPresentation = this.state === "ready"
      && this.failed !== true;

    if (!preserveReadyPresentation) this.notifyState("loading");
    try {
      if (!this.runtime) {
        const documentRef = this.mountTarget?.ownerDocument || globalThis.document;
        if (!documentRef) throw new Error("The guided 3D scene requires a browser document.");
        this.ensureRuntime(documentRef);
      }

      const acceptedSpecification = nextOptions.acceptedSpecification;
      if (nextOptions.showProduct) {
        const audit = auditGuidedAcceptedSpecification(acceptedSpecification);
        if (!audit.valid) {
          const first = audit.errors[0];
          const error = new Error(first?.message || "The fitted configuration is not accepted for rendering.");
          error.code = first?.code || "GUIDED_SPECIFICATION_NOT_ACCEPTED";
          throw error;
        }
      }
      const plan = createRenderReadyScenePlan(
        createGuidedScenePlan(project),
        acceptedSpecification?.accepted ? acceptedSpecification.room : null
      );
      if (acceptedSpecification?.accepted && acceptedSpecification.layoutId !== plan.room?.layoutId) {
        const error = new Error("The accepted room topology does not match the visible room plan.");
        error.code = "VISIBLE_ROOM_TOPOLOGY_MISMATCH";
        throw error;
      }
      if (nextOptions.showProduct && acceptedSpecification?.accepted) {
        applyAcceptedTargetZones(plan, acceptedSpecification);
      }
      validateScenePlan(plan);
      const nextTopologySignature = [
        plan.room?.layoutId || "unselected",
        plan.selection?.categoryId || "unknown",
        plan.selection?.styleId || "unknown"
      ].join(":");
      const preserveAdjustedCamera = this.userAdjustedCamera
        && this.topologySignature === nextTopologySignature;

      this.plan = plan;
      this.options = nextOptions;
      this.acceptedSpecification = acceptedSpecification;
      const nextGeometrySignature = createGeometrySceneSignature(plan, acceptedSpecification, nextOptions);
      const nextAppearanceSignature = createGuidedAppearanceDescriptorSignature(
        nextOptions.showProduct ? acceptedSpecification : null
      );
      const nextMaterialSignature = acceptedSpecification?.selectionFingerprint
        || createMaterialSignature(plan.selection);
      const geometryChanged = nextGeometrySignature !== this.geometrySignature;
      const appearanceChanged = nextAppearanceSignature !== this.appearanceSignature;
      const materialChanged = nextMaterialSignature !== this.materialSignature;
      this.geometrySignature = nextGeometrySignature;
      this.appearanceSignature = nextAppearanceSignature;
      this.materialSignature = nextMaterialSignature;
      this.sceneSignature = acceptedSpecification?.specificationFingerprint || createSceneSignature(plan);
      this.topologySignature = nextTopologySignature;
      this.failed = false;
      this.runtime.hidden = false;
      delete this.runtime.dataset.rendered;
      delete this.canvas.dataset.rendered;
      this.runtime.dataset.scenePurpose = CONCEPT_SCENE_PURPOSE;
      this.syncDiagnostics();
      if (geometryChanged || !this.content) {
        this.rebuildScene();
        this.configureCamera({ preserveAdjustedCamera });
      } else if (appearanceChanged && this.options.showProduct) {
        this.refreshProductAppearance();
      } else if (materialChanged && this.options.showProduct) {
        this.refreshProductMaterials();
      }
      this.syncDiagnostics();
      this.requestRender();
      return true;
    } catch (error) {
      return this.fail(error);
    }
  }

  zoom(action) {
    if (this.disposed || !this.camera) return false;
    if (action === "reset") return this.resetCamera();
    if (action !== "in" && action !== "out") return false;
    const multiplier = action === "in" ? 0.86 : 1.16;
    this.radius = clamp(this.radius * multiplier, this.minRadius, this.maxRadius);
    this.userAdjustedCamera = true;
    this.updateCamera();
    return true;
  }

  resetCamera() {
    if (this.disposed || !this.camera) return false;
    this.theta = this.defaultTheta;
    this.phi = this.defaultPhi;
    this.radius = this.baseRadius;
    this.cameraTarget.copy(this.defaultCameraTarget);
    this.userAdjustedCamera = false;
    this.updateCamera();
    return true;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.activeMaterialLoad) this.activeMaterialLoad.active = false;
    this.activeMaterialLoad = null;
    this.cancelScheduledRender();
    this.cancelScheduledResize();
    this.resizeObserver?.disconnect();
    this.resizeAbortController?.abort();
    this.controlAbortController?.abort();
    this.activePointers.clear();
    this.dimensionLabels.forEach(({ element }) => element.remove());
    this.dimensionLabels = [];

    if (this.content) {
      this.scene?.remove(this.content);
      disposeObject3D(this.content);
      this.content.clear();
    }
    this.scene?.clear();
    this.renderer?.renderLists?.dispose();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss?.();
    this.runtime?.remove();

    this.mountTarget = null;
    this.runtime = null;
    this.labelLayer = null;
    this.hint = null;
    this.resourceWarningElement = null;
    this.content = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.canvas = null;
    this.plan = null;
    this.resourceWarnings.clear();
  }

  ensureRuntime(documentRef) {
    if (this.renderer && this.runtime) return;
    if (!documentRef?.createElement) {
      throw new Error("The guided 3D scene requires DOM support.");
    }

    const runtime = documentRef.createElement("div");
    runtime.className = "guided-3d-runtime";
    runtime.style.position = "relative";
    runtime.style.width = "100%";
    runtime.style.height = "100%";
    runtime.style.overflow = "hidden";
    runtime.dataset.guided3dInstance = String(this.instanceId);
    runtime.setAttribute("data-guided-3d-instance", String(this.instanceId));
    runtime.dataset.scenePurpose = CONCEPT_SCENE_PURPOSE;

    const labelLayer = documentRef.createElement("div");
    labelLayer.className = "guided-3d-label-layer";
    labelLayer.style.position = "absolute";
    labelLayer.style.inset = "0";
    labelLayer.style.overflow = "hidden";
    labelLayer.style.pointerEvents = "none";
    labelLayer.setAttribute("aria-hidden", "true");

    const hint = documentRef.createElement("div");
    hint.className = "guided-3d-hint";
    hint.setAttribute("aria-hidden", "true");
    ["Drag to orbit", "Focus + scroll or + / −", "0 resets"].forEach((message) => {
      const item = documentRef.createElement("span");
      item.textContent = message;
      hint.appendChild(item);
    });

    const instructions = documentRef.createElement("p");
    instructions.id = `guided-3d-instructions-${this.instanceId}`;
    instructions.className = "visually-hidden";
    instructions.style.position = "absolute";
    instructions.style.width = "1px";
    instructions.style.height = "1px";
    instructions.style.overflow = "hidden";
    instructions.style.clipPath = "inset(50%)";
    instructions.style.whiteSpace = "nowrap";
    instructions.textContent = [
      "Interactive three-dimensional room and fitted furniture viewer.",
      "Use the arrow keys to orbit, plus and minus to zoom, and 0 or Home to reset.",
      "Pointer users can drag to orbit and focus the viewer before scrolling to zoom."
    ].join(" ");

    const resourceWarning = documentRef.createElement("p");
    resourceWarning.id = `guided-3d-resource-warning-${this.instanceId}`;
    resourceWarning.className = "visually-hidden";
    resourceWarning.style.position = "absolute";
    resourceWarning.style.width = "1px";
    resourceWarning.style.height = "1px";
    resourceWarning.style.overflow = "hidden";
    resourceWarning.style.clipPath = "inset(50%)";
    resourceWarning.style.whiteSpace = "nowrap";
    resourceWarning.setAttribute("role", "status");
    resourceWarning.setAttribute("aria-live", "polite");
    resourceWarning.setAttribute("aria-atomic", "true");
    resourceWarning.hidden = true;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf2efea);
    scene.fog = new THREE.Fog(0xf2efea, 24, 76);

    const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, CAMERA_NEAR, CAMERA_FAR);
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance"
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.88;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0xf2efea, 1);

    const canvas = renderer.domElement;
    canvas.className = "guided-3d-canvas";
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "application");
    canvas.setAttribute("aria-roledescription", "interactive 3D viewer");
    canvas.setAttribute("aria-label", "Room and fitted furniture concept");
    canvas.setAttribute("aria-describedby", `${instructions.id} ${resourceWarning.id}`);
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.touchAction = "none";
    canvas.dataset.guided3dInstance = String(this.instanceId);
    canvas.setAttribute("data-guided-3d-instance", String(this.instanceId));

    runtime.append(canvas, labelLayer, hint, instructions, resourceWarning);

    this.runtime = runtime;
    this.canvas = canvas;
    this.labelLayer = labelLayer;
    this.hint = hint;
    this.resourceWarningElement = resourceWarning;
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.content = new THREE.Group();
    this.content.name = "guided-concept-scene";
    this.content.userData.scenePurpose = CONCEPT_SCENE_PURPOSE;
    this.scene.add(this.content);
    applyGuidedEnvironment(THREE, this.scene, renderer, "warm", {
      onLoad: () => this.requestRender(),
      onError: (error, source) => this.handleEnvironmentAssetFailure(error, source)
    });
    this.setupLighting();
    this.bindControls();
    this.syncDiagnostics();
  }

  setupLighting() {
    const hemisphere = new THREE.HemisphereLight(0xfffcf7, 0xa99c8e, 0.88);
    hemisphere.name = "guided-room-hemisphere";
    this.scene.add(hemisphere);

    const key = new THREE.DirectionalLight(0xfff1df, 1.05);
    key.name = "guided-room-key";
    key.position.set(-4.5, 10.5, -8.5);
    key.castShadow = true;
    key.shadow.mapSize.set(1536, 1536);
    key.shadow.bias = -0.0002;
    key.shadow.normalBias = 0.012;
    key.shadow.radius = 5;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 55;
    this.scene.add(key);
    this.scene.add(key.target);
    this.keyLight = key;

    const fill = new THREE.DirectionalLight(0xf5ecdf, 0.32);
    fill.name = "guided-room-fill";
    fill.position.set(8, 6, -4);
    this.scene.add(fill);

    const wallBounce = new THREE.DirectionalLight(0xe8e2da, 0.24);
    wallBounce.name = "guided-wall-bounce";
    wallBounce.position.set(-5, 5, 8);
    this.scene.add(wallBounce);
  }

  bindControls() {
    this.controlAbortController?.abort();
    this.controlAbortController = new AbortController();
    const signal = this.controlAbortController.signal;
    const canvas = this.canvas;

    canvas.addEventListener("pointerdown", (event) => {
      if (event.button != null && event.button !== 0) return;
      event.preventDefault();
      canvas.focus({ preventScroll: true });
      canvas.setPointerCapture?.(event.pointerId);
      this.activePointers.set(event.pointerId, pointFromPointerEvent(event));
      this.dragPoint = pointFromPointerEvent(event);
      this.pinchDistance = this.getPinchDistance();
      this.userAdjustedCamera = true;
      this.runtime.classList.add("is-interacting");
      canvas.dataset.interacting = "true";
    }, { signal });

    canvas.addEventListener("pointermove", (event) => {
      if (!this.activePointers.has(event.pointerId)) return;
      event.preventDefault();
      const previous = this.activePointers.get(event.pointerId);
      const current = pointFromPointerEvent(event);
      this.activePointers.set(event.pointerId, current);

      if (this.activePointers.size >= 2) {
        const nextDistance = this.getPinchDistance();
        if (this.pinchDistance && nextDistance) {
          this.radius = clamp(
            this.radius * (this.pinchDistance / nextDistance),
            this.minRadius,
            this.maxRadius
          );
        }
        this.pinchDistance = nextDistance;
      } else {
        const dx = current.x - previous.x;
        const dy = current.y - previous.y;
        this.theta = clamp(this.theta - dx * 0.006, -0.82, 0.82);
        this.phi = clamp(this.phi + dy * 0.0045, -0.04, 0.66);
        this.dragPoint = current;
      }
      this.updateCamera();
    }, { signal });

    const finishPointer = (event) => {
      if (!this.activePointers.has(event.pointerId)) return;
      this.activePointers.delete(event.pointerId);
      if (canvas.hasPointerCapture?.(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      const remaining = [...this.activePointers.values()];
      this.dragPoint = remaining[0] || null;
      this.pinchDistance = this.getPinchDistance();
      if (!this.activePointers.size) {
        this.runtime.classList.remove("is-interacting");
        delete canvas.dataset.interacting;
      }
    };
    canvas.addEventListener("pointerup", finishPointer, { signal });
    canvas.addEventListener("pointercancel", finishPointer, { signal });
    canvas.addEventListener("lostpointercapture", (event) => {
      this.activePointers.delete(event.pointerId);
      if (!this.activePointers.size) {
        this.runtime.classList.remove("is-interacting");
        delete canvas.dataset.interacting;
      }
    }, { signal });

    canvas.addEventListener("wheel", (event) => {
      const activeElement = canvas.ownerDocument?.activeElement;
      if (activeElement !== canvas && !this.runtime.contains(activeElement)) return;
      if (event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      const multiplier = event.deltaY < 0 ? 0.9 : 1.11;
      this.radius = clamp(this.radius * multiplier, this.minRadius, this.maxRadius);
      this.userAdjustedCamera = true;
      this.updateCamera();
    }, { passive: false, signal });

    canvas.addEventListener("keydown", (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "0" || event.key === "Home") {
        event.preventDefault();
        this.resetCamera();
        return;
      }
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        this.zoom("in");
        return;
      }
      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        this.zoom("out");
        return;
      }
      if (event.key === "ArrowLeft") this.theta = clamp(this.theta + 0.1, -0.82, 0.82);
      else if (event.key === "ArrowRight") this.theta = clamp(this.theta - 0.1, -0.82, 0.82);
      else if (event.key === "ArrowUp") this.phi = clamp(this.phi + 0.075, -0.04, 0.66);
      else if (event.key === "ArrowDown") this.phi = clamp(this.phi - 0.075, -0.04, 0.66);
      else return;
      event.preventDefault();
      this.userAdjustedCamera = true;
      this.updateCamera();
    }, { signal });

    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      this.cancelScheduledRender();
      this.fail(new Error("The interactive 3D preview lost its graphics context."));
    }, { signal });

    canvas.addEventListener("webglcontextrestored", () => {
      if (this.disposed || !this.plan) return;
      this.failed = false;
      this.runtime.hidden = false;
      delete this.runtime.dataset.rendered;
      delete this.canvas.dataset.rendered;
      this.notifyState("loading");
      try {
        this.rebuildScene();
        this.configureCamera({ preserveAdjustedCamera: this.userAdjustedCamera });
        this.requestRender();
      } catch (error) {
        this.fail(error);
      }
    }, { signal });
  }

  getPinchDistance() {
    if (this.activePointers.size < 2) return null;
    const [first, second] = [...this.activePointers.values()];
    return Math.hypot(second.x - first.x, second.y - first.y);
  }

  observeMountTarget() {
    this.resizeObserver?.disconnect();
    this.resizeAbortController?.abort();
    this.resizeAbortController = null;
    if (!this.mountTarget) return;

    const ResizeObserverClass = this.ownerWindow?.ResizeObserver || globalThis.ResizeObserver;
    if (typeof ResizeObserverClass === "function") {
      this.resizeObserver ||= new ResizeObserverClass(() => this.scheduleResize());
      this.resizeObserver.observe(this.mountTarget);
      return;
    }

    if (this.ownerWindow?.addEventListener) {
      this.resizeAbortController = new AbortController();
      this.ownerWindow.addEventListener("resize", () => this.resize(), {
        signal: this.resizeAbortController.signal
      });
    }
  }

  resize() {
    if (this.disposed || !this.renderer || !this.camera || !this.runtime?.isConnected) return;
    const rect = this.runtime.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width || this.mountTarget?.clientWidth || 1));
    const height = Math.max(1, Math.round(rect.height || this.mountTarget?.clientHeight || 1));
    const dpr = Math.min(
      MAX_DEVICE_PIXEL_RATIO,
      Math.max(1, Number(this.ownerWindow?.devicePixelRatio) || 1)
    );
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  scheduleResize() {
    if (this.disposed || this.resizeFrame !== null) return;
    const request = this.ownerWindow?.requestAnimationFrame?.bind(this.ownerWindow)
      || globalThis.requestAnimationFrame?.bind(globalThis);
    if (!request) {
      this.resize();
      return;
    }
    this.resizeFrame = request(() => {
      this.resizeFrame = null;
      this.resize();
    });
  }

  cancelScheduledResize() {
    if (this.resizeFrame === null) return;
    const cancel = this.ownerWindow?.cancelAnimationFrame?.bind(this.ownerWindow)
      || globalThis.cancelAnimationFrame?.bind(globalThis);
    cancel?.(this.resizeFrame);
    this.resizeFrame = null;
  }

  rebuildScene() {
    if (this.activeMaterialLoad) this.activeMaterialLoad.active = false;
    this.activeMaterialLoad = null;
    if (!this.options.showProduct) this.clearResourceWarning("material");
    if (this.content) {
      this.scene.remove(this.content);
      disposeObject3D(this.content);
      this.content.clear();
    }
    this.dimensionLabels.forEach(({ element }) => element.remove());
    this.dimensionLabels = [];
    this.labelLayer.replaceChildren();

    this.content = new THREE.Group();
    this.content.name = "guided-accepted-scene";
    this.content.userData.scenePurpose = CONCEPT_SCENE_PURPOSE;
    this.scene.add(this.content);

    const roomGroup = new THREE.Group();
    roomGroup.name = "guided-room-geometry";
    roomGroup.userData.source = "guided-scene-plan";
    const roomMaterials = createRoomMaterials();
    roomGroup.userData.materials = roomMaterials;
    this.content.add(roomGroup);
    renderRoomPlan(roomGroup, this.plan, roomMaterials, {
      suppressCoveredRadiator: this.options.showProduct
        && this.plan.selection?.categoryId === "radiator-cover"
    });

    if (this.options.showProduct) {
      this.mountAcceptedProductGroup(this.content);
    } else {
      this.productGroup = null;
      this.renderAudit = null;
    }

    const dimensions = new THREE.Group();
    dimensions.name = "guided-measurement-callouts";
    dimensions.userData.nonPhysicalHelper = true;
    dimensions.visible = this.options.showDimensions;
    this.content.add(dimensions);
    if (this.options.showDimensions) {
      renderDimensionCallouts(
        dimensions,
        this.plan.dimensionCallouts,
        this.labelLayer,
        this.dimensionLabels
      );
    }
    this.geometryRebuildCount += 1;
  }

  mountAcceptedProductGroup(parent) {
    const productGroup = new THREE.Group();
    productGroup.name = "guided-product-accepted-descriptors";
    productGroup.userData = {
      scenePurpose: CONCEPT_SCENE_PURPOSE,
      source: "accepted-guided-specification",
      geometryFingerprint: this.acceptedSpecification?.geometryFingerprint || null,
      specificationFingerprint: this.acceptedSpecification?.specificationFingerprint || null,
      billOfMaterials: true,
      pricing: this.acceptedSpecification?.pricingStatus || "unavailable"
    };
    const productMaterials = this.createProductMaterialLibrary();
    productGroup.userData.materials = productMaterials;
    parent.add(productGroup);
    this.productGroup = productGroup;
    const records = renderAcceptedProduct(
      productGroup,
      this.acceptedSpecification,
      productMaterials
    );
    this.renderAudit = validateGuidedRenderedManifest(this.acceptedSpecification, records);
    if (!this.renderAudit.valid) {
      const first = this.renderAudit.issues[0];
      const error = new Error(first?.message || "Accepted descriptors did not reach the scene.");
      error.code = first?.code || "GUIDED_RENDER_CONTRACT_FAILED";
      throw error;
    }
    productGroup.userData.renderAudit = this.renderAudit;
  }

  refreshProductAppearance() {
    const parent = this.productGroup?.parent || this.content;
    if (!parent) return;
    if (this.productGroup) {
      parent.remove(this.productGroup);
      disposeObject3D(this.productGroup);
      this.productGroup.clear();
    }
    this.productGroup = null;
    this.renderAudit = null;
    this.mountAcceptedProductGroup(parent);
    this.appearanceUpdateCount += 1;
  }

  refreshProductMaterials() {
    if (!this.productGroup) return;
    const previous = this.productGroup.userData.materials;
    const materials = this.createProductMaterialLibrary();
    this.productGroup.traverse((child) => {
      const slot = child.userData?.materialSlot;
      if (!slot || (!child.isMesh && !child.isLineSegments)) return;
      child.material = materials[slot] || materials.case;
    });
    this.productGroup.userData.materials = materials;
    disposeMaterialLibrary(previous);
    this.materialUpdateCount += 1;
  }

  createProductMaterialLibrary() {
    if (this.activeMaterialLoad) this.activeMaterialLoad.active = false;
    this.clearResourceWarning("material");
    const context = {
      active: true,
      failed: false,
      library: null
    };
    this.activeMaterialLoad = context;
    const library = createGuidedMaterialLibrary(THREE, this.plan.selection, {
      onLoad: () => {
        if (context.active && this.activeMaterialLoad === context) this.requestRender();
      },
      onError: (error, source) => {
        if (!context.active || this.activeMaterialLoad !== context || this.disposed) return;
        context.failed = true;
        this.handleMaterialAssetFailure(context, error, source);
      }
    });
    context.library = library;
    if (context.failed) applyGuidedNeutralMaterialFallback(library);
    return library;
  }

  handleMaterialAssetFailure(context, error, source) {
    if (!context?.active || this.activeMaterialLoad !== context || this.disposed) return;
    if (context.library) applyGuidedNeutralMaterialFallback(context.library);
    this.recordResourceFallbackWarning("material", error, source);
    this.requestRender();
  }

  handleEnvironmentAssetFailure(error, source) {
    if (this.disposed) return;
    const fallback = GUIDED_RESOURCE_FALLBACKS.environment;
    if (this.scene) {
      this.scene.environment = null;
      this.scene.userData ||= {};
      this.scene.userData.requestedEnvironmentSource = normalizeResourceSource(source, error);
      this.scene.userData.environmentSource = fallback.id;
      this.scene.userData.environmentPreview = "";
      this.scene.userData.environmentFallbackId = fallback.id;
    }
    if (this.renderer) this.renderer.toneMappingExposure = 0.95;
    this.recordResourceFallbackWarning("environment", error, source);
    this.requestRender();
  }

  recordResourceFallbackWarning(kind, error, source) {
    const fallback = GUIDED_RESOURCE_FALLBACKS[kind];
    if (!fallback) return null;
    const normalizedSource = normalizeResourceSource(source, error);
    const previous = this.resourceWarnings.get(kind);
    const sources = new Set(previous?.sources || []);
    const sourceAdded = !sources.has(normalizedSource);
    sources.add(normalizedSource);
    const warning = Object.freeze({
      code: fallback.code,
      severity: "warning",
      kind,
      fallbackId: fallback.id,
      fallbackLabel: fallback.label,
      message: fallback.message,
      errorCode: String(error?.code || ""),
      sources: Object.freeze([...sources].sort())
    });
    this.resourceWarnings.set(kind, warning);
    this.syncDiagnostics();
    if (!previous || sourceAdded) {
      try {
        this.onWarning(warning);
      } catch (callbackError) {
        // Warning reporting must not replace the recoverable renderer fallback.
      }
    }
    return warning;
  }

  clearResourceWarning(kind) {
    if (!this.resourceWarnings.delete(kind)) return false;
    this.syncDiagnostics();
    return true;
  }

  getResourceWarnings() {
    return [...this.resourceWarnings.values()].map((warning) => Object.freeze({
      ...warning,
      sources: Object.freeze([...warning.sources])
    }));
  }

  configureCamera({ preserveAdjustedCamera = false } = {}) {
    const frame = getPlanCameraFrame(this.plan, this.camera?.aspect || 1);
    const previousScale = this.baseRadius > 0 ? this.radius / this.baseRadius : 1;
    this.defaultCameraTarget.copy(frame.target);
    this.baseRadius = frame.radius;
    this.minRadius = frame.radius * 0.46;
    this.maxRadius = frame.radius * 2.35;
    this.defaultTheta = frame.theta;
    this.defaultPhi = frame.phi;

    if (preserveAdjustedCamera) {
      this.cameraTarget.copy(frame.target);
      this.radius = clamp(frame.radius * previousScale, this.minRadius, this.maxRadius);
    } else {
      this.theta = frame.theta;
      this.phi = frame.phi;
      this.radius = frame.radius;
      this.cameraTarget.copy(frame.target);
      this.userAdjustedCamera = false;
    }

    if (this.keyLight) {
      const shadowExtent = Math.max(8, frame.shadowExtent);
      this.keyLight.position.set(
        frame.target.x - shadowExtent * 0.12,
        frame.target.y + shadowExtent * 1.05,
        frame.target.z - shadowExtent * 1.05
      );
      this.keyLight.target.position.copy(frame.target);
      this.keyLight.target.updateMatrixWorld();
      this.keyLight.shadow.camera.left = -shadowExtent;
      this.keyLight.shadow.camera.right = shadowExtent;
      this.keyLight.shadow.camera.top = shadowExtent;
      this.keyLight.shadow.camera.bottom = -shadowExtent;
      this.keyLight.shadow.camera.far = Math.max(55, shadowExtent * 4.5);
      this.keyLight.shadow.camera.updateProjectionMatrix();
    }
    this.updateCamera();
  }

  updateCamera() {
    if (!this.camera) return;
    const horizontalRadius = Math.cos(this.phi) * this.radius;
    this.camera.position.set(
      this.cameraTarget.x + Math.sin(this.theta) * horizontalRadius,
      this.cameraTarget.y + Math.sin(this.phi) * this.radius,
      this.cameraTarget.z - Math.cos(this.theta) * horizontalRadius
    );
    this.camera.lookAt(this.cameraTarget);
    this.camera.updateMatrixWorld();
    this.requestRender();
  }

  requestRender() {
    if (
      this.disposed
      || this.failed
      || !this.renderer
      || !this.runtime?.isConnected
      || this.animationFrame !== null
      || this.rendering
    ) return;
    const request = this.ownerWindow?.requestAnimationFrame?.bind(this.ownerWindow)
      || globalThis.requestAnimationFrame?.bind(globalThis);
    if (!request) return;
    this.animationFrame = request(() => {
      this.animationFrame = null;
      if (this.disposed || this.failed || !this.runtime?.isConnected) return;
      this.rendering = true;
      try {
        this.renderer.render(this.scene, this.camera);
        this.updateDimensionLabelPositions();
        if (this.plan) {
          this.runtime.dataset.rendered = "true";
          this.canvas.dataset.rendered = "true";
          if (this.state !== "ready") this.notifyState("ready");
        }
      } catch (error) {
        this.fail(error);
      } finally {
        this.rendering = false;
      }
    });
  }

  cancelScheduledRender() {
    if (this.animationFrame === null) return;
    const cancel = this.ownerWindow?.cancelAnimationFrame?.bind(this.ownerWindow)
      || globalThis.cancelAnimationFrame?.bind(globalThis);
    cancel?.(this.animationFrame);
    this.animationFrame = null;
  }

  updateDimensionLabelPositions() {
    if (!this.options.showDimensions || !this.camera || !this.runtime) return;
    const rect = this.runtime.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    if (!width || !height) return;

    const projectedLabels = [];
    this.dimensionLabels.forEach((descriptor, index) => {
      const projected = descriptor.anchor.clone().project(this.camera);
      const visible = projected.z >= -1
        && projected.z <= 1
        && projected.x >= -1.16
        && projected.x <= 1.16
        && projected.y >= -1.16
        && projected.y <= 1.16;
      descriptor.element.hidden = !visible;
      if (!visible) return;
      const x = (projected.x * 0.5 + 0.5) * width;
      const y = (-projected.y * 0.5 + 0.5) * height;
      projectedLabels.push({
        descriptor,
        index,
        x,
        y,
        width: Math.max(1, descriptor.element.offsetWidth || 98),
        height: Math.max(1, descriptor.element.offsetHeight || 40)
      });
    });
    positionDimensionLabels(projectedLabels, width, height);
  }

  syncDiagnostics() {
    const warnings = this.getResourceWarnings();
    const values = {
      guided3dInstance: String(this.instanceId),
      sceneLayout: this.plan?.room?.layoutId || "",
      showProduct: String(this.options.showProduct === true),
      showDimensions: String(this.options.showDimensions === true),
      sceneSignature: this.sceneSignature || "",
      geometryFingerprint: this.acceptedSpecification?.geometryFingerprint || "",
      specificationFingerprint: this.acceptedSpecification?.specificationFingerprint || "",
      geometryRebuildCount: String(this.geometryRebuildCount),
      appearanceUpdateCount: String(this.appearanceUpdateCount),
      materialUpdateCount: String(this.materialUpdateCount),
      renderContractValid: String(this.renderAudit?.valid === true),
      resourceFallbackActive: String(warnings.length > 0),
      resourceWarningCount: String(warnings.length),
      resourceWarningCodes: warnings.map(({ code }) => code).join(" "),
      resourceFallbackIds: warnings.map(({ fallbackId }) => fallbackId).join(" "),
      materialFallbackActive: String(this.resourceWarnings.has("material")),
      environmentFallbackActive: String(this.resourceWarnings.has("environment"))
    };
    [this.runtime, this.canvas].filter(Boolean).forEach((element) => {
      Object.assign(element.dataset, values);
      element.setAttribute("data-guided-3d-instance", String(this.instanceId));
    });
    if (this.resourceWarningElement) {
      this.resourceWarningElement.textContent = warnings
        .map(({ message }) => message)
        .join(" ");
      this.resourceWarningElement.hidden = warnings.length === 0;
    }
  }

  notifyState(state) {
    this.state = state;
    if (this.runtime) this.runtime.dataset.state = state;
    try {
      this.onStateChange(state);
    } catch (error) {
      // A host callback must not make the renderer unusable.
    }
  }

  fail(error) {
    this.failed = true;
    this.cancelScheduledRender();
    if (this.runtime) {
      this.runtime.dataset.state = "fallback";
      this.runtime.hidden = true;
    }
    try {
      this.onError(error);
    } catch (callbackError) {
      // Preserve the original graceful fallback even if reporting fails.
    }
    this.notifyState("fallback");
    return false;
  }
}

function normalizeResourceSource(source, error) {
  const candidate = source
    || error?.target?.currentSrc
    || error?.target?.src
    || error?.source
    || "unknown-asset";
  return String(candidate);
}

function positionDimensionLabels(labels, viewportWidth, viewportHeight) {
  const placed = [];
  const top = DIMENSION_LABEL_VIEWPORT_PADDING;
  const left = DIMENSION_LABEL_VIEWPORT_PADDING;
  const right = Math.max(left, viewportWidth - DIMENSION_LABEL_VIEWPORT_PADDING);
  const bottom = Math.max(
    top,
    viewportHeight - DIMENSION_LABEL_VIEWPORT_PADDING - DIMENSION_LABEL_BOTTOM_RESERVE
  );

  labels
    .slice()
    .sort((first, second) => first.index - second.index)
    .forEach((label) => {
      const halfWidth = Math.min(label.width / 2, Math.max(0.5, (right - left) / 2));
      const halfHeight = Math.min(label.height / 2, Math.max(0.5, (bottom - top) / 2));
      const stepX = Math.max(48, label.width * 0.62);
      const stepY = label.height + DIMENSION_LABEL_GAP;
      const candidates = createDimensionLabelCandidates(label.x, label.y, stepX, stepY);
      let best = null;

      candidates.forEach((candidate, candidateIndex) => {
        const x = clamp(candidate.x, left + halfWidth, right - halfWidth);
        const y = clamp(candidate.y, top + halfHeight, bottom - halfHeight);
        label.descriptor.element.style.transform = (
          `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`
        );
        const measured = label.descriptor.element.getBoundingClientRect();
        const rect = inflateLabelRect(measured, DIMENSION_LABEL_GAP / 2);
        const overlap = placed.reduce(
          (total, occupied) => total + getRectOverlapArea(rect, occupied),
          0
        );
        const movement = Math.hypot(x - label.x, y - label.y);
        const score = overlap * 1_000_000 + movement + candidateIndex * 0.001;
        if (!best || score < best.score) best = { x, y, rect, score, overlap };
      });

      if (!best) return;
      placed.push(best.rect);
      label.descriptor.element.style.transform = (
        `translate3d(${best.x}px, ${best.y}px, 0) translate(-50%, -50%)`
      );
      label.descriptor.element.dataset.collisionAdjusted = String(best.overlap === 0 && (
        Math.abs(best.x - label.x) > 0.5 || Math.abs(best.y - label.y) > 0.5
      ));
    });
}

function createDimensionLabelCandidates(x, y, stepX, stepY) {
  const candidates = [{ x, y }];
  for (let ring = 1; ring <= 5; ring += 1) {
    const horizontal = stepX * ring;
    const vertical = stepY * ring;
    candidates.push(
      { x, y: y - vertical },
      { x, y: y + vertical },
      { x: x - horizontal, y },
      { x: x + horizontal, y },
      { x: x - horizontal, y: y - vertical },
      { x: x + horizontal, y: y - vertical },
      { x: x - horizontal, y: y + vertical },
      { x: x + horizontal, y: y + vertical }
    );
  }
  return candidates;
}

function inflateLabelRect(rect, padding) {
  return {
    left: rect.left - padding,
    right: rect.right + padding,
    top: rect.top - padding,
    bottom: rect.bottom + padding
  };
}

function getRectOverlapArea(first, second) {
  const width = Math.max(0, Math.min(first.right, second.right) - Math.max(first.left, second.left));
  const height = Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top));
  return width * height;
}

function createRenderReadyScenePlan(sourcePlan, acceptedRoom = null) {
  const plan = JSON.parse(JSON.stringify(sourcePlan));
  if (acceptedRoom?.accepted) {
    plan.purpose = CONCEPT_SCENE_PURPOSE;
    plan.units = "inches";
    plan.measurements = {
      ...plan.measurements,
      wallWidth: acceptedRoom.wallWidth,
      ceilingHeight: acceptedRoom.ceilingHeight,
      desiredDepth: acceptedRoom.desiredDepth
    };
    plan.room = createAcceptedRoomRenderDescriptor(acceptedRoom);
    plan.dimensionCallouts = syncAcceptedRoomDimensionCallouts(
      plan.dimensionCallouts,
      acceptedRoom
    );
    return plan;
  }
  const finalized = [];
  const hiddenDimensionGroups = new Set();
  const finalizeFeatures = (matcher, resolver, dimensionGroup) => {
    plan.room.features
      .filter((feature) => matcher(getSemanticKind(feature)))
      .forEach((feature) => {
        const authoredBounds = feature.bounds;
        const resolvedBounds = resolver(feature, plan);
        if (!isBounds(resolvedBounds)) {
          feature.renderHidden = true;
          hiddenDimensionGroups.add(dimensionGroup);
          return;
        }
        feature.bounds = createBounds(resolvedBounds.min, resolvedBounds.max);
        feature.renderAdjusted = !boundsNearlyEqual(authoredBounds, feature.bounds);
        finalized.push(feature);
      });
  };

  /*
   * Resolve architectural envelopes before any mesh, product zone, callout, or
   * camera frame consumes the plan. This keeps the scene internally truthful:
   * a safety adjustment is plan data for this render, not a mesh-only offset.
   */
  finalizeFeatures((kind) => /window/.test(kind), resolveNonOverlappingWindowBounds, "window");
  finalizeFeatures((kind) => /radiator/.test(kind), resolveNonOverlappingRadiatorBounds, "radiator");
  finalizeFeatures(isScreenFeatureKind, resolveNonOverlappingScreenBounds, "screen");

  const windowFeature = plan.room.features.find((feature) => (
    !feature.renderHidden && /window/.test(getSemanticKind(feature))
  ));
  const radiatorFeature = plan.room.features.find((feature) => (
    !feature.renderHidden && /radiator/.test(getSemanticKind(feature))
  ));
  if (plan.selection?.categoryId === "window-storage" && windowFeature) {
    syncWindowStorageTargetZones(plan, windowFeature.bounds);
  }
  if (plan.selection?.categoryId === "radiator-cover" && radiatorFeature) {
    syncRadiatorCoverTargetZone(plan, radiatorFeature.bounds);
  }

  finalized.forEach((feature) => syncFeatureDimensionCallouts(plan, feature));
  if (hiddenDimensionGroups.size) {
    plan.dimensionCallouts = plan.dimensionCallouts.filter((callout) => (
      !hiddenDimensionGroups.has(getDimensionGroup(callout?.fieldId))
    ));
  }
  return plan;
}

function createAcceptedRoomRenderDescriptor(room) {
  const left = finiteOr(room.planes?.leftWall?.value, -Number(room.wallWidth) / 2);
  const right = finiteOr(room.planes?.rightWall?.value, Number(room.wallWidth) / 2);
  const floor = finiteOr(room.floorPlaneY, 0);
  const ceiling = finiteOr(room.ceilingHeight, finiteOr(room.planes?.ceiling?.value, 96));
  const rear = finiteOr(room.rearWallPlaneZ, finiteOr(room.planes?.rearWall?.value, 0));
  const roomWidth = right - left;
  const front = Math.min(
    -Math.max(54, roomWidth * 0.58),
    ...Object.values(room.features || {})
      .map((feature) => Number(feature?.bounds?.min?.z))
      .filter(Number.isFinite)
  );
  const niche = Object.values(room.features || {}).find((feature) => (
    /niche|recess/.test(String(feature?.kind || feature?.id || ""))
    && isBounds(feature?.bounds)
  ));
  const back = Math.max(
    rear,
    niche?.bounds?.max?.z ?? rear
  );
  const bounds = createBounds(
    { x: left, y: floor, z: front },
    { x: right, y: ceiling, z: back + 1.2 }
  );
  const surfaces = createAcceptedRoomSurfaces({
    room,
    bounds,
    niche,
    left,
    right,
    floor,
    ceiling,
    rear,
    front,
    back
  });
  const features = createAcceptedRoomFeatures(room, rear);
  return {
    layoutId: room.layoutId,
    label: room.layoutId,
    condition: room.layoutKind || room.layoutId,
    buildDepth: room.desiredDepth,
    bounds,
    surfaces,
    features,
    cameraIntent: room.cameraIntent || "front",
    source: "accepted-room-topology",
    topologySchemaVersion: room.schemaVersion,
    installationZoneIds: (room.installationZones || []).map((zone) => zone.id)
  };
}

function createAcceptedRoomSurfaces(context) {
  const {
    room,
    bounds,
    niche,
    left,
    right,
    floor,
    ceiling,
    rear,
    front,
    back
  } = context;
  const surfaces = [
    acceptedSurface("room-floor", "floor", createBounds(
      { x: left - 24, y: floor - 1.1, z: front - 18 },
      { x: right + 24, y: floor, z: back + 18 }
    )),
    acceptedSurface("room-ceiling", "ceiling", createBounds(
      { x: left - 12, y: ceiling, z: front },
      { x: right + 12, y: ceiling + 1, z: back + 8 }
    )),
    acceptedSurface("room-left-wall", "side-wall", createBounds(
      { x: left - 1.2, y: floor, z: front },
      { x: left, y: ceiling, z: back + 1 }
    )),
    acceptedSurface("room-right-wall", "side-wall", createBounds(
      { x: right, y: floor, z: front },
      { x: right + 1.2, y: ceiling, z: back + 1 }
    ))
  ];

  if (niche) {
    appendAcceptedNicheSurfaces(surfaces, {
      room,
      niche,
      left,
      right,
      floor,
      ceiling,
      rear
    });
  } else {
    surfaces.push(acceptedSurface("room-back-wall", "back-wall", createBounds(
      { x: left, y: floor, z: rear },
      { x: right, y: ceiling, z: rear + 1.2 }
    )));
    surfaces.push(acceptedSurface("room-baseboard", "room-baseboard", createBounds(
      { x: left, y: floor, z: rear - 0.7 },
      { x: right, y: floor + 4.25, z: rear + 0.7 }
    )));
  }

  if (room.layoutId === "corner-wall") {
    const corner = room.features?.corner;
    const returnLength = Math.max(
      Number(corner?.returnRun) || 0,
      Math.abs(front - rear)
    );
    surfaces.push(acceptedSurface("corner-return-wall", "return-wall", createBounds(
      { x: right, y: floor, z: rear - returnLength },
      { x: right + 1.2, y: ceiling, z: rear }
    )));
  }
  return surfaces;
}

function appendAcceptedNicheSurfaces(surfaces, context) {
  const { room, niche, left, right, floor, ceiling, rear } = context;
  const nicheBounds = niche.bounds;
  const nicheBack = nicheBounds.max.z;
  const addWallSpan = (id, minX, maxX) => {
    if (maxX - minX <= 0.001) return;
    surfaces.push(acceptedSurface(id, "back-wall", createBounds(
      { x: minX, y: floor, z: rear },
      { x: maxX, y: ceiling, z: rear + 1.2 }
    )));
    surfaces.push(acceptedSurface(`${id}-baseboard`, "room-baseboard", createBounds(
      { x: minX, y: floor, z: rear - 0.7 },
      { x: maxX, y: floor + 4.25, z: rear + 0.7 }
    )));
  };
  addWallSpan("room-back-wall-left", left, nicheBounds.min.x);
  addWallSpan("room-back-wall-right", nicheBounds.max.x, right);
  if (nicheBounds.max.y < ceiling - 0.001) {
    surfaces.push(acceptedSurface("room-back-wall-above-niche", "back-wall", createBounds(
      { x: nicheBounds.min.x, y: nicheBounds.max.y, z: rear },
      { x: nicheBounds.max.x, y: ceiling, z: rear + 1.2 }
    )));
  }
  surfaces.push(acceptedSurface("niche-back", "recess-back", createBounds(
    { x: nicheBounds.min.x, y: nicheBounds.min.y, z: nicheBack },
    { x: nicheBounds.max.x, y: nicheBounds.max.y, z: nicheBack + 1 }
  )));

  const returnSides = room.layoutId === "niche-layout"
    ? ["left", "right"]
    : [String(niche.returnSide || niche.side || "")];
  if (returnSides.includes("left")) {
    surfaces.push(acceptedSurface("niche-left-return", "recess-return", createBounds(
      { x: nicheBounds.min.x, y: nicheBounds.min.y, z: rear },
      { x: nicheBounds.min.x, y: nicheBounds.max.y, z: nicheBack }
    )));
  }
  if (returnSides.includes("right")) {
    surfaces.push(acceptedSurface("niche-right-return", "recess-return", createBounds(
      { x: nicheBounds.max.x, y: nicheBounds.min.y, z: rear },
      { x: nicheBounds.max.x, y: nicheBounds.max.y, z: nicheBack }
    )));
  }
  if (nicheBounds.max.y < ceiling - 0.001) {
    surfaces.push(acceptedSurface("niche-soffit", "recess-return", createBounds(
      { x: nicheBounds.min.x, y: nicheBounds.max.y, z: rear },
      { x: nicheBounds.max.x, y: nicheBounds.max.y, z: nicheBack }
    )));
  }
}

function createAcceptedRoomFeatures(room, rearWallZ) {
  const features = [];
  for (const source of Object.values(room.features || {})) {
    if (!source || !isBounds(source.bounds)) continue;
    const kind = String(source.kind || source.id || "feature");
    if (/niche|recess|corner/.test(kind)) continue;
    const feature = {
      ...JSON.parse(JSON.stringify(source)),
      bounds: createAcceptedFeaturePresentationBounds(source, rearWallZ),
      source: "accepted-room-topology",
      measurements: {
        doorTrimWidth: source.trimWidth,
        doorSwing: source.swing,
        valveLocation: source.valveLocation
      },
      metadata: {
        doorSwing: source.swing,
        acceptedFeature: true
      }
    };
    features.push(feature);
    if (isBounds(source.mantelBounds)) {
      features.push({
        id: `${source.id || "fireplace"}-mantel`,
        kind: "mantel",
        bounds: cloneSceneBounds(source.mantelBounds),
        source: "accepted-room-topology"
      });
    }
    if (isBounds(source.trimBounds)) {
      features.push({
        id: `${source.id || "door"}-trim`,
        kind: "door-trim",
        bounds: createAcceptedOpeningFaceBounds(source.trimBounds, rearWallZ),
        source: "accepted-room-topology",
        measurements: { doorTrimWidth: source.trimWidth }
      });
    }
  }
  return features;
}

function createAcceptedFeaturePresentationBounds(feature, rearWallZ) {
  const kind = String(feature.kind || feature.id || "");
  if (/window|door|opening|passage/.test(kind)) {
    return createAcceptedOpeningFaceBounds(feature.bounds, rearWallZ);
  }
  return cloneSceneBounds(feature.bounds);
}

function createAcceptedOpeningFaceBounds(bounds, rearWallZ) {
  return createBounds(
    { x: bounds.min.x, y: bounds.min.y, z: rearWallZ - 1 },
    { x: bounds.max.x, y: bounds.max.y, z: rearWallZ }
  );
}

function cloneSceneBounds(bounds) {
  return createBounds(
    { x: bounds.min.x, y: bounds.min.y, z: bounds.min.z },
    { x: bounds.max.x, y: bounds.max.y, z: bounds.max.z }
  );
}

function acceptedSurface(id, kind, bounds) {
  return { id, kind, source: "accepted-room-topology", bounds };
}

function syncAcceptedRoomDimensionCallouts(callouts, room) {
  const values = {
    wallWidth: Number(room.wallWidth),
    ceilingHeight: Number(room.ceilingHeight),
    desiredDepth: Number(room.desiredDepth)
  };
  return (Array.isArray(callouts) ? callouts : []).map((callout) => (
    Object.hasOwn(values, callout.fieldId) && Number.isFinite(values[callout.fieldId])
      ? { ...callout, value: values[callout.fieldId], enteredValue: values[callout.fieldId], adjusted: false }
      : callout
  ));
}

function syncWindowStorageTargetZones(plan, windowBounds) {
  const existing = plan.targetZones;
  const belowTemplate = existing.find((zone) => zone.id === "product-below-window");
  if (!belowTemplate) return;

  const wallLeft = plan.room.bounds.min.x;
  const wallRight = plan.room.bounds.max.x;
  const roomHeight = getBoundsHeight(plan.room.bounds);
  const sideTemplates = existing.filter((zone) => (
    zone.id === "product-window-right" || zone.id === "product-window-left"
  ));
  const sideHeight = sideTemplates.length
    ? Math.max(...sideTemplates.map((zone) => zone.bounds.max.y - zone.bounds.min.y))
    : Math.max(1, roomHeight - 3);
  const zoneMinY = belowTemplate.bounds.min.y;
  const zoneMinZ = belowTemplate.bounds.min.z;
  const zoneMaxZ = belowTemplate.bounds.max.z;
  const replacement = [
    createBackWallTargetZone(
      belowTemplate,
      "product-below-window",
      "below",
      createBounds(
        { x: windowBounds.min.x, y: zoneMinY, z: zoneMinZ },
        {
          x: windowBounds.max.x,
          y: belowTemplate.bounds.max.y,
          z: zoneMaxZ
        }
      )
    )
  ];

  if (windowBounds.min.x - wallLeft > 14) {
    const template = existing.find((zone) => zone.id === "product-window-right")
      || sideTemplates[0]
      || belowTemplate;
    replacement.push(createBackWallTargetZone(
      template,
      "product-window-right",
      "right",
      createBounds(
        { x: wallLeft + 1, y: zoneMinY, z: zoneMinZ },
        {
          x: windowBounds.min.x - 1.5,
          y: zoneMinY + sideHeight,
          z: zoneMaxZ
        }
      )
    ));
  }
  if (wallRight - windowBounds.max.x > 14) {
    const template = existing.find((zone) => zone.id === "product-window-left")
      || sideTemplates[0]
      || belowTemplate;
    replacement.push(createBackWallTargetZone(
      template,
      "product-window-left",
      "left",
      createBounds(
        { x: windowBounds.max.x + 1.5, y: zoneMinY, z: zoneMinZ },
        {
          x: wallRight - 1,
          y: zoneMinY + sideHeight,
          z: zoneMaxZ
        }
      )
    ));
  }

  const unrelated = existing.filter((zone) => (
    zone.id !== "product-below-window"
    && zone.id !== "product-window-right"
    && zone.id !== "product-window-left"
  ));
  plan.targetZones = [...unrelated, ...replacement];
}

function syncRadiatorCoverTargetZone(plan, radiatorBounds) {
  const index = plan.targetZones.findIndex((zone) => zone.id === "product-radiator-cover");
  if (index < 0) return;
  const template = plan.targetZones[index];
  const wallLeft = plan.room.bounds.min.x;
  const wallRight = plan.room.bounds.max.x;
  const padding = 4;
  const minX = clamp(radiatorBounds.min.x - padding, wallLeft, wallRight - 12);
  const maxX = clamp(radiatorBounds.max.x + padding, wallLeft + 12, wallRight);
  const roomHeight = getBoundsHeight(plan.room.bounds);
  const bounds = createBounds(
    {
      x: minX,
      y: template.bounds.min.y,
      z: template.bounds.min.z
    },
    {
      x: maxX,
      y: Math.min(
        template.bounds.min.y + roomHeight * 0.46,
        radiatorBounds.max.y + padding
      ),
      z: template.bounds.max.z
    }
  );
  plan.targetZones[index] = createBackWallTargetZone(
    template,
    "product-radiator-cover",
    "below",
    bounds
  );
}

function createBackWallTargetZone(template, id, role, bounds) {
  return {
    ...template,
    id,
    role,
    bounds,
    size: { ...bounds.size },
    frame: {
      ...template.frame,
      origin: { ...bounds.min }
    }
  };
}

function syncFeatureDimensionCallouts(plan, feature) {
  const kind = getSemanticKind(feature);
  const bounds = feature.bounds;
  const room = plan.room.bounds;
  plan.dimensionCallouts.forEach((callout) => {
    const fieldId = String(callout?.fieldId || "");
    const z = finiteOr(callout?.start?.z, bounds.min.z - 5);
    let endpoints = null;

    if (/window/.test(kind)) {
      if (fieldId === "windowWidth") {
        endpoints = {
          axis: "width",
          start: { x: bounds.min.x, y: bounds.max.y + 4, z },
          end: { x: bounds.max.x, y: bounds.max.y + 4, z }
        };
      } else if (fieldId === "windowHeight") {
        endpoints = {
          axis: "height",
          start: { x: bounds.max.x + 5, y: bounds.min.y, z },
          end: { x: bounds.max.x + 5, y: bounds.max.y, z }
        };
      } else if (fieldId === "sillHeight") {
        endpoints = {
          axis: "height",
          start: { x: bounds.min.x - 5, y: room.min.y, z },
          end: { x: bounds.min.x - 5, y: bounds.min.y, z }
        };
      } else if (fieldId === "windowLeftDistance") {
        endpoints = {
          axis: "width",
          start: { x: bounds.max.x, y: finiteOr(callout.start?.y, 7), z },
          end: { x: room.max.x, y: finiteOr(callout.end?.y, 7), z }
        };
      } else if (fieldId === "windowRightDistance") {
        endpoints = {
          axis: "width",
          start: { x: room.min.x, y: finiteOr(callout.start?.y, 7), z },
          end: { x: bounds.min.x, y: finiteOr(callout.end?.y, 7), z }
        };
      }
    } else if (/radiator/.test(kind)) {
      if (fieldId === "radiatorWidth") {
        endpoints = {
          axis: "width",
          start: { x: bounds.min.x, y: bounds.max.y + 4, z },
          end: { x: bounds.max.x, y: bounds.max.y + 4, z }
        };
      } else if (fieldId === "radiatorHeight") {
        endpoints = {
          axis: "height",
          start: { x: bounds.max.x + 5, y: bounds.min.y, z },
          end: { x: bounds.max.x + 5, y: bounds.max.y, z }
        };
      } else if (fieldId === "radiatorDepth") {
        endpoints = {
          axis: "depth",
          start: { x: bounds.max.x + 7, y: 4, z: bounds.min.z },
          end: { x: bounds.max.x + 7, y: 4, z: bounds.max.z }
        };
      }
    } else if (isScreenFeatureKind(kind)) {
      if (fieldId === "tvScreenSize") {
        endpoints = {
          axis: "diagonal",
          start: { x: bounds.min.x, y: bounds.min.y, z },
          end: { x: bounds.max.x, y: bounds.max.y, z }
        };
      } else if (fieldId === "tvHeight") {
        endpoints = {
          axis: "height",
          start: { x: bounds.max.x + 5, y: bounds.min.y, z },
          end: { x: bounds.max.x + 5, y: bounds.max.y, z }
        };
      }
    }
    if (endpoints) updateDimensionCallout(callout, endpoints);
  });
}

function updateDimensionCallout(callout, endpoints) {
  callout.axis = endpoints.axis;
  callout.start = endpoints.start;
  callout.end = endpoints.end;
  callout.value = Number(distanceBetweenPoints(endpoints.start, endpoints.end).toFixed(4));
  const entered = Number(callout.enteredValue);
  callout.adjusted = Number.isFinite(entered)
    && Math.abs(entered - callout.value) > 0.005;
}

function distanceBetweenPoints(start, end) {
  return Math.hypot(
    Number(end.x) - Number(start.x),
    Number(end.y) - Number(start.y),
    Number(end.z) - Number(start.z)
  );
}

function getDimensionGroup(fieldId) {
  if (/^window|^sillHeight$/.test(String(fieldId || ""))) return "window";
  if (/^radiator/.test(String(fieldId || ""))) return "radiator";
  if (/^tv/.test(String(fieldId || ""))) return "screen";
  return "";
}

function boundsNearlyEqual(first, second, epsilon = 0.005) {
  return isBounds(first) && isBounds(second)
    && ["x", "y", "z"].every((axis) => (
      Math.abs(first.min[axis] - second.min[axis]) <= epsilon
      && Math.abs(first.max[axis] - second.max[axis]) <= epsilon
    ));
}

function validateScenePlan(plan) {
  if (!plan || typeof plan !== "object") {
    throw new TypeError("The guided scene planner did not return a scene plan.");
  }
  if (plan.version !== 1 || plan.units !== "inches") {
    throw new TypeError("The guided scene renderer requires version 1 inch-based scene plans.");
  }
  if (!plan.room || !isBounds(plan.room.bounds)) {
    throw new TypeError("The guided scene plan is missing valid room bounds.");
  }
  if (!Array.isArray(plan.room.surfaces) || !Array.isArray(plan.room.features)) {
    throw new TypeError("The guided scene plan is missing room topology descriptors.");
  }
  if (!Array.isArray(plan.targetZones) || !Array.isArray(plan.dimensionCallouts)) {
    throw new TypeError("The guided scene plan is missing target zones or dimension anchors.");
  }
}

function renderRoomPlan(group, plan, materials, options = {}) {
  const surfaces = plan.room.surfaces;
  const surfaceKinds = new Set();

  surfaces.forEach((surface) => {
    if (!surface || !isBounds(surface.bounds)) return;
    const semantic = getSemanticKind(surface);
    const isSideSurface = /(?:side|return)-wall|recess-return/.test(semantic);
    surfaceKinds.add(semantic);
    const material = getRoomSurfaceMaterial(semantic, materials);
    const thickness = getSurfaceThicknessOptions(semantic);
    const mesh = addBoundsBox(group, surface.bounds, material, {
      ...thickness,
      castShadow: !semantic.includes("floor") && !isSideSurface,
      receiveShadow: !isSideSurface,
      edgeMaterial: semantic.includes("trim") || semantic.includes("base")
        ? materials.edge
        : null
    });
    if (!mesh) return;
    mesh.name = `guided-surface-${surface.id || semantic}`;
    mesh.userData = {
      source: "guided-scene-plan",
      descriptorId: surface.id || null,
      semantic
    };
  });

  ensureRoomEnvelope(group, plan.room, materials, surfaceKinds);

  plan.room.features.forEach((feature) => {
    if (!feature || feature.renderHidden || !isBounds(feature.bounds)) return;
    if (options.suppressCoveredRadiator && /radiator/.test(getSemanticKind(feature))) return;
    renderRoomFeature(group, feature, plan, materials);
  });
}

function ensureRoomEnvelope(group, room, materials, surfaceKinds) {
  const bounds = room.bounds;
  const roomWidth = getBoundsWidth(bounds);
  const roomHeight = getBoundsHeight(bounds);
  const wallZ = getBackWallZ(room);
  const floorFront = Math.min(
    bounds.min.z,
    ...room.surfaces.map((surface) => surface?.bounds?.min?.z).filter(Number.isFinite),
    -Math.max(54, roomWidth * 0.56)
  );
  const floorBack = Math.max(wallZ, bounds.max.z);

  if (![...surfaceKinds].some((kind) => kind.includes("floor"))) {
    addSceneBox(
      group,
      [roomWidth + 48, 1.1, floorBack - floorFront + 24],
      [
        (bounds.min.x + bounds.max.x) / 2,
        bounds.min.y - 0.55,
        (floorFront + floorBack) / 2 - 5
      ],
      materials.floor,
      { castShadow: false, receiveShadow: true }
    ).name = "guided-room-floor";
  }

  if (![...surfaceKinds].some((kind) => kind.includes("wall"))) {
    addSceneBox(
      group,
      [roomWidth + 36, roomHeight + 18, 1.2],
      [
        (bounds.min.x + bounds.max.x) / 2,
        bounds.min.y + roomHeight / 2,
        wallZ + 0.6
      ],
      materials.wall,
      { castShadow: false, receiveShadow: true }
    ).name = "guided-room-back-wall";
  }

  if (![...surfaceKinds].some((kind) => (
    kind.includes("baseboard") || kind.includes("base-board") || kind.includes("room-trim")
  ))) {
    const trimHeight = clamp(roomHeight * 0.045, 3.5, 5.5);
    addSceneBox(
      group,
      [roomWidth + 36, trimHeight, 1.35],
      [
        (bounds.min.x + bounds.max.x) / 2,
        bounds.min.y + trimHeight / 2,
        wallZ - 0.15
      ],
      materials.trim,
      { edgeMaterial: materials.edge }
    ).name = "guided-room-baseboard";
  }

  const hasSideWall = [...surfaceKinds].some((kind) => (
    kind.includes("side-wall") || kind.includes("return-wall")
  ));
  if (!hasSideWall && /niche|corner|recess/.test(String(room.condition || ""))) {
    const returnDepth = Math.max(30, Number(room.buildDepth) || 14);
    const sideHeight = roomHeight + 10;
    const sideCenterZ = wallZ - returnDepth / 2;
    addSceneBox(
      group,
      [1.2, sideHeight, returnDepth],
      [bounds.min.x - 0.6, bounds.min.y + roomHeight / 2, sideCenterZ],
      materials.wall,
      { castShadow: false, receiveShadow: false }
    ).name = "guided-room-left-return";
    addSceneBox(
      group,
      [1.2, sideHeight, returnDepth],
      [bounds.max.x + 0.6, bounds.min.y + roomHeight / 2, sideCenterZ],
      materials.wall,
      { castShadow: false, receiveShadow: false }
    ).name = "guided-room-right-return";
  }
}

function isScreenFeatureKind(kind) {
  return /(^|-)tv($|-)|television|screen/.test(String(kind || ""));
}

function isArchitecturalObstacleFeature(feature) {
  const kind = getSemanticKind(feature);
  if (isScreenFeatureKind(kind)) return false;
  return /(^|-)(door|window|fireplace|firebox|hearth|mantel|opening|passage|radiator|projection|column|pilaster)($|-)/.test(kind);
}

function isProductObstacleFeature(feature, context) {
  if (!isScreenFeatureKind(getSemanticKind(feature))) {
    return isArchitecturalObstacleFeature(feature);
  }
  const category = String(context?.selection?.categoryId || "");
  const style = String(context?.selection?.styleId || "");
  return category !== "tv-unit" && !/tv|media/.test(style);
}

function resolveNonOverlappingScreenBounds(feature, plan) {
  if (!isBounds(feature?.bounds)) return null;
  const normalized = normalizeScreenAspectBounds(feature.bounds, plan.measurements);
  const mountingProjection = findScreenMountingProjection(plan, normalized);
  const original = mountingProjection
    ? createBounds(
      { x: normalized.min.x, y: normalized.min.y, z: mountingProjection.bounds.min.z - 0.2 },
      { x: normalized.max.x, y: normalized.max.y, z: mountingProjection.bounds.min.z - 0.1 }
    )
    : normalized;
  const obstacles = plan.room.features
    .filter((candidate) => (
      candidate !== feature
      && candidate !== mountingProjection
      && isBounds(candidate?.bounds)
      && isArchitecturalObstacleFeature(candidate)
    ))
    .map((candidate) => ({
      feature: candidate,
      bounds: getFeatureExclusionBounds(candidate, plan)
    }))
    .filter(({ bounds }) => (
      isBounds(bounds)
      && rangesOverlap(
        original.min.y,
        original.max.y,
        bounds.min.y - ARCHITECTURAL_CLEARANCE,
        bounds.max.y + ARCHITECTURAL_CLEARANCE
      )
    ));
  const collides = obstacles.some(({ bounds }) => rangesOverlap(
    original.min.x,
    original.max.x,
    bounds.min.x - ARCHITECTURAL_CLEARANCE,
    bounds.max.x + ARCHITECTURAL_CLEARANCE
  ));
  if (!collides) return original;

  const envelope = getScreenHorizontalEnvelope(plan, original);
  let intervals = [[envelope.min, envelope.max]];
  obstacles.forEach(({ bounds }) => {
    intervals = subtractWidthInterval(
      intervals,
      bounds.min.x - ARCHITECTURAL_CLEARANCE,
      bounds.max.x + ARCHITECTURAL_CLEARANCE
    );
  });
  if (!intervals.length) return null;

  const originalWidth = getBoundsWidth(original);
  const originalHeight = getBoundsHeight(original);
  const originalCenterX = (original.min.x + original.max.x) / 2;
  const originalCenterY = (original.min.y + original.max.y) / 2;
  const screenMargin = ARCHITECTURAL_CLEARANCE * 0.6;
  const ranked = intervals
    .map(([start, end]) => ({
      start,
      end,
      usableWidth: end - start - screenMargin * 2,
      distance: Math.abs(clamp(originalCenterX, start, end) - originalCenterX)
    }))
    .filter((interval) => interval.usableWidth >= 12)
    .sort((first, second) => {
      const firstFits = first.usableWidth >= originalWidth;
      const secondFits = second.usableWidth >= originalWidth;
      if (firstFits !== secondFits) return firstFits ? -1 : 1;
      if (first.distance !== second.distance) return first.distance - second.distance;
      if (first.usableWidth !== second.usableWidth) return second.usableWidth - first.usableWidth;
      return first.start - second.start;
    });
  const selected = ranked[0];
  if (!selected) return null;

  const width = Math.min(originalWidth, selected.usableWidth);
  const height = originalWidth > 0
    ? originalHeight * (width / originalWidth)
    : originalHeight;
  const centerX = clamp(
    originalCenterX,
    selected.start + screenMargin + width / 2,
    selected.end - screenMargin - width / 2
  );
  return createBounds(
    {
      x: centerX - width / 2,
      y: originalCenterY - height / 2,
      z: original.min.z
    },
    {
      x: centerX + width / 2,
      y: originalCenterY + height / 2,
      z: original.max.z
    }
  );
}

function findScreenMountingProjection(plan, screenBounds) {
  const centerX = (screenBounds.min.x + screenBounds.max.x) / 2;
  const centerY = (screenBounds.min.y + screenBounds.max.y) / 2;
  return plan.room.features.find((candidate) => (
    /projection|column|pilaster/.test(getSemanticKind(candidate))
    && isBounds(candidate?.bounds)
    && centerX >= candidate.bounds.min.x
    && centerX <= candidate.bounds.max.x
    && centerY >= candidate.bounds.min.y
    && centerY <= candidate.bounds.max.y
  )) || null;
}

function normalizeScreenAspectBounds(bounds, measurements = {}) {
  if (!isBounds(bounds)) return bounds;
  const diagonal = Number(measurements?.tvScreenSize);
  const enteredHeight = Number(measurements?.tvHeight);
  if (
    !Number.isFinite(diagonal)
    || !Number.isFinite(enteredHeight)
    || diagonal <= enteredHeight
    || enteredHeight <= 0
  ) return bounds;

  const intendedWidth = Math.sqrt(Math.max(0, diagonal ** 2 - enteredHeight ** 2));
  const ratio = intendedWidth / enteredHeight;
  const currentWidth = getBoundsWidth(bounds);
  const currentHeight = getBoundsHeight(bounds);
  if (!Number.isFinite(ratio) || ratio <= 0 || currentWidth <= 0 || currentHeight <= 0) {
    return bounds;
  }
  const width = Math.min(currentWidth, currentHeight * ratio);
  const height = Math.min(currentHeight, width / ratio);
  const centerX = (bounds.min.x + bounds.max.x) / 2;
  const centerY = (bounds.min.y + bounds.max.y) / 2;
  return createBounds(
    { x: centerX - width / 2, y: centerY - height / 2, z: bounds.min.z },
    { x: centerX + width / 2, y: centerY + height / 2, z: bounds.max.z }
  );
}

function resolveNonOverlappingWindowBounds(feature, plan) {
  if (!isBounds(feature?.bounds)) return null;
  const original = feature.bounds;
  const originalWidth = getBoundsWidth(original);
  const originalHeight = getBoundsHeight(original);
  const trim = clamp(Math.min(originalWidth, originalHeight) * 0.055, 2.25, 4);
  const obstacles = plan.room.features
    .filter((candidate) => (
      candidate !== feature
      && isBounds(candidate?.bounds)
      && !/window/.test(getSemanticKind(candidate))
      && !/radiator/.test(getSemanticKind(candidate))
      && isArchitecturalObstacleFeature(candidate)
    ))
    .map((candidate) => getFeatureExclusionBounds(candidate, plan))
    .filter((bounds) => (
      isBounds(bounds)
      && rangesOverlap(original.min.y, original.max.y, bounds.min.y, bounds.max.y)
    ));
  const collides = obstacles.some((bounds) => rangesOverlap(
    original.min.x - trim,
    original.max.x + trim,
    bounds.min.x - ARCHITECTURAL_CLEARANCE,
    bounds.max.x + ARCHITECTURAL_CLEARANCE
  ));
  if (!collides) return original;

  let intervals = [[plan.room.bounds.min.x, plan.room.bounds.max.x]];
  obstacles.forEach((bounds) => {
    intervals = subtractWidthInterval(
      intervals,
      bounds.min.x - ARCHITECTURAL_CLEARANCE,
      bounds.max.x + ARCHITECTURAL_CLEARANCE
    );
  });
  const originalCenterX = (original.min.x + original.max.x) / 2;
  const candidates = intervals
    .map(([start, end]) => {
      const usableStart = start + trim;
      const usableEnd = end - trim;
      const width = Math.min(originalWidth, usableEnd - usableStart);
      const centerX = clamp(
        originalCenterX,
        usableStart + width / 2,
        usableEnd - width / 2
      );
      return {
        width,
        centerX,
        distance: Math.abs(centerX - originalCenterX)
      };
    })
    .filter(({ width }) => width >= 8)
    .sort((first, second) => (
      first.distance - second.distance
      || second.width - first.width
      || first.centerX - second.centerX
    ));
  const selected = candidates[0];
  if (!selected) return null;

  return createBounds(
    {
      x: selected.centerX - selected.width / 2,
      y: original.min.y,
      z: original.min.z
    },
    {
      x: selected.centerX + selected.width / 2,
      y: original.min.y + originalHeight,
      z: original.max.z
    }
  );
}

function resolveNonOverlappingRadiatorBounds(feature, plan) {
  if (!isBounds(feature?.bounds)) return null;
  const original = feature.bounds;
  const originalWidth = getBoundsWidth(original);
  const originalHeight = getBoundsHeight(original);
  const obstacles = plan.room.features
    .filter((candidate) => (
      candidate !== feature
      && isBounds(candidate?.bounds)
      && !/window|radiator/.test(getSemanticKind(candidate))
      && isArchitecturalObstacleFeature(candidate)
    ))
    .map((candidate) => getFeatureExclusionBounds(candidate, plan))
    .filter((bounds) => (
      isBounds(bounds)
      && rangesOverlap(original.min.y, original.max.y, bounds.min.y, bounds.max.y)
    ));
  const collides = obstacles.some((bounds) => rangesOverlap(
    original.min.x,
    original.max.x,
    bounds.min.x - ARCHITECTURAL_CLEARANCE,
    bounds.max.x + ARCHITECTURAL_CLEARANCE
  ));
  if (!collides) return original;

  let intervals = [[plan.room.bounds.min.x, plan.room.bounds.max.x]];
  obstacles.forEach((bounds) => {
    intervals = subtractWidthInterval(
      intervals,
      bounds.min.x - ARCHITECTURAL_CLEARANCE,
      bounds.max.x + ARCHITECTURAL_CLEARANCE
    );
  });
  const originalCenterX = (original.min.x + original.max.x) / 2;
  const candidates = intervals
    .map(([start, end]) => {
      const width = Math.min(originalWidth, end - start);
      const centerX = clamp(
        originalCenterX,
        start + width / 2,
        end - width / 2
      );
      return {
        width,
        centerX,
        distance: Math.abs(centerX - originalCenterX)
      };
    })
    .filter(({ width }) => width >= 10)
    .sort((first, second) => (
      first.distance - second.distance
      || second.width - first.width
      || first.centerX - second.centerX
    ));
  const selected = candidates[0];
  if (!selected) return null;

  return createBounds(
    {
      x: selected.centerX - selected.width / 2,
      y: original.min.y,
      z: original.min.z
    },
    {
      x: selected.centerX + selected.width / 2,
      y: original.min.y + originalHeight,
      z: original.max.z
    }
  );
}

function getFeatureExclusionBounds(feature, plan) {
  if (feature?.renderHidden) return null;
  if (!isBounds(feature?.bounds)) return feature?.bounds;
  const kind = getSemanticKind(feature);
  const bounds = feature.bounds;
  if (!isBounds(bounds)) return null;
  if (isScreenFeatureKind(kind)) {
    return bounds;
  }

  const width = getBoundsWidth(bounds);
  const height = getBoundsHeight(bounds);
  if (/fireplace|firebox|hearth/.test(kind)) {
    const surround = clamp(Math.min(width, height) * 0.09, 3, 6);
    const centerX = (bounds.min.x + bounds.max.x) / 2;
    const mantelWidth = finiteOr(
      feature.measurements?.mantelWidth,
      finiteOr(
        feature.metadata?.mantelWidth,
        finiteOr(plan?.measurements?.mantelWidth, width * 1.28)
      )
    );
    const mantelY = finiteOr(
      feature.measurements?.mantelHeight,
      finiteOr(
        feature.metadata?.mantelHeight,
        finiteOr(plan?.measurements?.mantelHeight, bounds.max.y + surround)
      )
    );
    const renderedWidth = Math.max(
      width + surround * 2.3,
      Math.max(width + surround * 2, mantelWidth)
    );
    const mantelDepth = Math.max(5, getBoundsDepth(bounds) + 3);
    const hearthDepth = Math.max(8, getBoundsDepth(bounds) + 5);
    return createBounds(
      {
        x: centerX - renderedWidth / 2,
        y: bounds.min.y - surround / 2,
        z: Math.min(
          bounds.min.z - 2.6,
          bounds.min.z - 1.8 - mantelDepth / 2,
          bounds.min.z + 0.4 - hearthDepth
        )
      },
      {
        x: centerX + renderedWidth / 2,
        y: Math.max(bounds.max.y + surround / 2, mantelY + surround * 0.36),
        z: bounds.max.z
      }
    );
  }

  if (/door/.test(kind) && !/door-trim|door-casing/.test(kind)) {
    const trim = resolveDoorTrimWidth(bounds, feature);
    return expandBounds(bounds, {
      left: trim,
      right: trim,
      top: trim,
      front: Math.max(1.55, getBoundsDepth(bounds))
    });
  }
  if (/window/.test(kind)) {
    const trim = clamp(Math.min(width, height) * 0.055, 2.25, 4);
    return expandBounds(bounds, {
      left: trim,
      right: trim,
      bottom: trim * 0.5,
      top: trim,
      front: Math.max(2.8, width * 0.08)
    });
  }
  if (/opening|passage/.test(kind)) {
    const trim = clamp(Math.min(width, height) * 0.04, 2.25, 4);
    return expandBounds(bounds, {
      left: trim,
      right: trim,
      top: trim,
      front: Math.max(1.45, getBoundsDepth(bounds))
    });
  }
  return bounds;
}

function expandBounds(bounds, amounts = {}) {
  return createBounds(
    {
      x: bounds.min.x - Math.max(0, finiteOr(amounts.left, 0)),
      y: bounds.min.y - Math.max(0, finiteOr(amounts.bottom, 0)),
      z: bounds.min.z - Math.max(0, finiteOr(amounts.front, 0))
    },
    {
      x: bounds.max.x + Math.max(0, finiteOr(amounts.right, 0)),
      y: bounds.max.y + Math.max(0, finiteOr(amounts.top, 0)),
      z: bounds.max.z + Math.max(0, finiteOr(amounts.back, 0))
    }
  );
}

function resolveDoorTrimWidth(bounds, feature) {
  const fallback = clamp(
    Math.min(getBoundsWidth(bounds), getBoundsHeight(bounds)) * 0.045,
    2.5,
    4.5
  );
  return Math.max(
    MIN_SURFACE_THICKNESS / INCH_TO_SCENE,
    finiteOr(feature?.measurements?.doorTrimWidth, fallback)
  );
}

function getScreenHorizontalEnvelope(plan, screenBounds) {
  const screenCenterY = (screenBounds.min.y + screenBounds.max.y) / 2;
  const backWallZones = plan.targetZones
    .filter((zone) => (
      isBounds(zone?.bounds)
      && Math.abs(Number(zone.frame?.widthAxis?.x) || 0) >= 0.75
      && screenCenterY >= zone.bounds.min.y
      && screenCenterY <= zone.bounds.max.y
    ))
    .sort((first, second) => {
      const firstPrimary = String(first.role || "") === "primary";
      const secondPrimary = String(second.role || "") === "primary";
      if (firstPrimary !== secondPrimary) return firstPrimary ? -1 : 1;
      return getBoundsWidth(second.bounds) - getBoundsWidth(first.bounds);
    });
  const zone = backWallZones[0];
  return zone
    ? { min: zone.bounds.min.x, max: zone.bounds.max.x }
    : { min: plan.room.bounds.min.x, max: plan.room.bounds.max.x };
}

function subtractWidthInterval(intervals, exclusionStart, exclusionEnd) {
  return intervals.flatMap(([start, end]) => {
    if (exclusionEnd <= start || exclusionStart >= end) return [[start, end]];
    const segments = [];
    if (exclusionStart > start) segments.push([start, Math.min(end, exclusionStart)]);
    if (exclusionEnd < end) segments.push([Math.max(start, exclusionEnd), end]);
    return segments.filter(([segmentStart, segmentEnd]) => segmentEnd > segmentStart);
  });
}

function rangesOverlap(firstStart, firstEnd, secondStart, secondEnd) {
  return firstEnd > secondStart && secondEnd > firstStart;
}

function boundsIntersect(first, second) {
  return isBounds(first) && isBounds(second)
    && rangesOverlap(first.min.x, first.max.x, second.min.x, second.max.x)
    && rangesOverlap(first.min.y, first.max.y, second.min.y, second.max.y)
    && rangesOverlap(first.min.z, first.max.z, second.min.z, second.max.z);
}

function renderRoomFeature(group, feature, plan, materials) {
  if (feature?.renderHidden) return;
  const kind = getSemanticKind(feature);
  const bounds = feature.bounds;
  if (!bounds) return;
  const frontZ = bounds.min.z;
  const backZ = bounds.max.z;
  const width = getBoundsWidth(bounds);
  const height = getBoundsHeight(bounds);
  const depth = Math.max(1, getBoundsDepth(bounds));
  const centerX = (bounds.min.x + bounds.max.x) / 2;
  const centerY = (bounds.min.y + bounds.max.y) / 2;
  const source = {
    source: feature.source || "guided-scene-plan",
    descriptorId: feature.id || null,
    featureKind: feature.kind
  };

  if (/niche|recess/.test(kind)) {
    const hasAuthoredRecessSurfaces = plan.room.surfaces.some((surface) => (
      /recess-back|recess-return/.test(getSemanticKind(surface))
    ));
    if (hasAuthoredRecessSurfaces) return;
    const reveal = clamp(Math.min(width, height) * 0.018, 1.25, 2.75);
    addSceneBox(
      group,
      [width, height, 0.8],
      [centerX, centerY, backZ + 0.4],
      materials.recess,
      { castShadow: false, receiveShadow: true }
    ).userData = source;
    addSceneBox(
      group,
      [reveal, height, depth],
      [bounds.min.x + reveal / 2, centerY, frontZ + depth / 2],
      materials.wallSide,
      { castShadow: false, receiveShadow: true }
    ).userData = source;
    addSceneBox(
      group,
      [reveal, height, depth],
      [bounds.max.x - reveal / 2, centerY, frontZ + depth / 2],
      materials.wallSide,
      { castShadow: false, receiveShadow: true }
    ).userData = source;
    addSceneBox(
      group,
      [width, reveal, depth],
      [centerX, bounds.max.y - reveal / 2, frontZ + depth / 2],
      materials.wallSide,
      { castShadow: false, receiveShadow: true }
    ).userData = source;
    return;
  }

  if (/window/.test(kind)) {
    renderWindowFeature(group, bounds, feature, materials);
    return;
  }

  if (/door-trim|door-casing/.test(kind)) {
    const trim = clamp(Math.min(width, height) * 0.045, 2.5, 4.5);
    addRectangularFrame(
      group,
      bounds,
      trim,
      1.55,
      bounds.min.z - 0.25,
      materials.trim,
      materials.edge,
      { includeBottom: false }
    );
    return;
  }

  if (/door/.test(kind)) {
    const hasSeparateDoorTrim = plan.room.features.some((candidate) => (
      candidate !== feature && /door-trim|door-casing/.test(getSemanticKind(candidate))
    ));
    renderDoorFeature(group, bounds, feature, materials, {
      includeTrim: !hasSeparateDoorTrim
    });
    return;
  }

  if (/double-opening|opening|passage/.test(kind)) {
    renderOpeningFeature(group, bounds, feature, materials);
    return;
  }

  if (/fireplace|firebox|hearth/.test(kind)) {
    const hasSeparateMantel = plan.room.features.some((candidate) => (
      candidate !== feature && /mantel/.test(getSemanticKind(candidate))
    ));
    renderFireplaceFeature(group, bounds, feature, materials, {
      includeMantel: !hasSeparateMantel
    });
    return;
  }

  if (/mantel/.test(kind)) {
    addBoundsBox(group, bounds, materials.stone, {
      minHeight: 1.5,
      minDepth: 3,
      edgeMaterial: materials.edge
    });
    return;
  }

  if (/radiator/.test(kind)) {
    renderRadiatorFeature(group, bounds, feature, materials);
    return;
  }

  if (isScreenFeatureKind(kind)) {
    renderScreen(group, bounds, materials.screen, source);
    return;
  }

  if (/projection|column|pilaster/.test(kind)) {
    const hasAuthoredProjectionSurfaces = plan.room.surfaces.some((surface) => (
      /projection-face|projection-side/.test(getSemanticKind(surface))
    ));
    if (hasAuthoredProjectionSurfaces) return;
    const mesh = addBoundsBox(group, bounds, materials.wallSide, {
      castShadow: true,
      receiveShadow: true,
      minDepth: 1
    });
    if (mesh) mesh.userData = source;
  }
}

function renderWindowFeature(group, bounds, feature, materials) {
  const width = getBoundsWidth(bounds);
  const height = getBoundsHeight(bounds);
  const centerX = (bounds.min.x + bounds.max.x) / 2;
  const centerY = (bounds.min.y + bounds.max.y) / 2;
  const z = bounds.min.z - 0.35;
  const trim = clamp(Math.min(width, height) * 0.055, 2.25, 4);
  const frameDepth = 1.25;

  addSceneBox(group, [width, height, 0.55], [centerX, centerY, bounds.max.z], materials.windowGlass, {
    castShadow: false,
    receiveShadow: false
  });
  addRectangularFrame(group, bounds, trim, frameDepth, z, materials.trim, materials.edge);
  addSceneBox(group, [trim * 0.44, Math.max(1, height - trim * 2), frameDepth * 0.72], [centerX, centerY, z - 0.08], materials.trim);
  addSceneBox(group, [Math.max(1, width - trim * 2), trim * 0.44, frameDepth * 0.72], [centerX, centerY, z - 0.08], materials.trim);

  const sillDepth = Math.max(frameDepth * 2.8, Math.min(7, width * 0.08));
  addSceneBox(group, [width + trim * 1.2, trim * 0.58, sillDepth], [
    centerX,
    bounds.min.y - trim * 0.25,
    z - sillDepth / 2 + frameDepth / 2
  ], materials.trim, { edgeMaterial: materials.edge });
}

function renderDoorFeature(group, bounds, feature, materials, options = {}) {
  const width = getBoundsWidth(bounds);
  const height = getBoundsHeight(bounds);
  const centerX = (bounds.min.x + bounds.max.x) / 2;
  const centerY = (bounds.min.y + bounds.max.y) / 2;
  const z = bounds.max.z + 0.2;
  const trim = resolveDoorTrimWidth(bounds, feature);
  const slabReveal = clamp(Math.min(width, height) * 0.015, 0.5, 1.25);
  const slabWidth = Math.max(1, width - slabReveal * 2);
  const slabHeight = Math.max(1, height - slabReveal);

  addSceneBox(group, [slabWidth, slabHeight, 1.3], [centerX, bounds.min.y + slabHeight / 2, z], materials.door, {
    edgeMaterial: materials.edge
  });
  if (options.includeTrim !== false) {
    addRectangularFrame(group, bounds, trim, 1.55, bounds.min.z - 0.25, materials.trim, materials.edge, {
      includeBottom: false
    });
  }

  const panelMargin = clamp(Math.min(slabWidth, slabHeight) * 0.1, 3, 5);
  const panelHeight = Math.max(4, (slabHeight - panelMargin * 3) / 2);
  [bounds.min.y + panelMargin + panelHeight / 2, bounds.min.y + panelMargin * 2 + panelHeight * 1.5]
    .forEach((panelY) => {
      addSceneBox(group, [
        Math.max(3, slabWidth - panelMargin * 2),
        panelHeight,
        0.32
      ], [centerX, panelY, z - 0.8], materials.doorInset, {
        castShadow: true,
        receiveShadow: true,
        edgeMaterial: materials.edge
      });
    });

  const swing = String(feature.measurements?.doorSwing || feature.metadata?.doorSwing || "");
  const hingeLeft = !swing.startsWith("right");
  const knobX = centerX + (hingeLeft ? slabWidth * 0.38 : -slabWidth * 0.38);
  const knob = new THREE.Mesh(
    new THREE.SphereGeometry(toSceneLength(0.8), 18, 12),
    materials.hardware
  );
  knob.position.set(toSceneLength(knobX), toSceneLength(bounds.min.y + height * 0.48), toSceneLength(bounds.min.z - 1.25));
  knob.castShadow = true;
  group.add(knob);
}

function renderOpeningFeature(group, bounds, feature, materials) {
  const width = getBoundsWidth(bounds);
  const height = getBoundsHeight(bounds);
  const centerX = (bounds.min.x + bounds.max.x) / 2;
  const centerY = (bounds.min.y + bounds.max.y) / 2;
  const depth = Math.max(5, getBoundsDepth(bounds));
  const z = bounds.min.z - 0.15;
  const trim = clamp(Math.min(width, height) * 0.04, 2.25, 4);

  addSceneBox(group, [width - trim, height - trim, 0.7], [centerX, centerY, bounds.max.z + 0.3], materials.opening, {
    castShadow: false,
    receiveShadow: true
  });
  addRectangularFrame(group, bounds, trim, 1.45, z, materials.trim, materials.edge, {
    includeBottom: false
  });
  addSceneBox(group, [trim * 0.55, Math.max(1, height - trim), depth], [
    bounds.min.x + trim * 0.28,
    centerY,
    bounds.min.z + depth / 2
  ], materials.wallSide, { castShadow: false, receiveShadow: true });
  addSceneBox(group, [trim * 0.55, Math.max(1, height - trim), depth], [
    bounds.max.x - trim * 0.28,
    centerY,
    bounds.min.z + depth / 2
  ], materials.wallSide, { castShadow: false, receiveShadow: true });
}

function renderFireplaceFeature(group, bounds, feature, materials, options = {}) {
  const width = getBoundsWidth(bounds);
  const height = getBoundsHeight(bounds);
  const centerX = (bounds.min.x + bounds.max.x) / 2;
  const centerY = (bounds.min.y + bounds.max.y) / 2;
  const z = bounds.min.z - 0.6;
  const surround = clamp(Math.min(width, height) * 0.09, 3, 6);

  addSceneBox(group, [width, height, 2], [centerX, centerY, z], materials.firebox, {
    castShadow: false,
    receiveShadow: true
  });
  addRectangularFrame(group, bounds, surround, 2.4, z - 0.8, materials.stone, materials.edge);

  if (options.includeMantel !== false) {
    const mantelWidth = finiteOr(
      feature.measurements?.mantelWidth,
      finiteOr(feature.metadata?.mantelWidth, width * 1.28)
    );
    const mantelY = finiteOr(
      feature.measurements?.mantelHeight,
      finiteOr(feature.metadata?.mantelHeight, bounds.max.y + surround)
    );
    addSceneBox(group, [
      Math.max(width + surround * 2, mantelWidth),
      surround * 0.72,
      Math.max(5, getBoundsDepth(bounds) + 3)
    ], [centerX, mantelY, z - 1.2], materials.stone, { edgeMaterial: materials.edge });
  }

  const hearthDepth = Math.max(8, getBoundsDepth(bounds) + 5);
  addSceneBox(group, [
    width + surround * 2.3,
    surround * 0.48,
    hearthDepth
  ], [centerX, bounds.min.y + surround * 0.24, z - hearthDepth / 2 + 1], materials.stone, {
    edgeMaterial: materials.edge
  });
}

function renderRadiatorFeature(group, bounds, feature, materials) {
  const width = getBoundsWidth(bounds);
  const height = getBoundsHeight(bounds);
  const depth = Math.max(2.5, getBoundsDepth(bounds));
  const centerX = (bounds.min.x + bounds.max.x) / 2;
  const centerY = (bounds.min.y + bounds.max.y) / 2;
  const z = bounds.min.z - depth / 2;
  addSceneBox(group, [width, height, depth], [centerX, centerY, z], materials.radiator, {
    edgeMaterial: materials.edge
  });

  const slatCount = clamp(Math.round(width / Math.max(height * 0.18, 3)), 5, 18);
  const gap = width / (slatCount + 1);
  for (let index = 1; index <= slatCount; index += 1) {
    addSceneBox(group, [
      Math.max(0.65, gap * 0.34),
      Math.max(1, height - 3),
      0.65
    ], [bounds.min.x + gap * index, centerY, bounds.min.z - depth - 0.25], materials.radiatorInset, {
      castShadow: true,
      receiveShadow: true
    });
  }
}

function renderScreen(group, bounds, material, userData = {}) {
  const width = getBoundsWidth(bounds);
  const height = getBoundsHeight(bounds);
  const centerX = (bounds.min.x + bounds.max.x) / 2;
  const centerY = (bounds.min.y + bounds.max.y) / 2;
  const screen = addSceneBox(group, [width, height, 1.5], [centerX, centerY, bounds.min.z - 0.75], material, {
    castShadow: true,
    receiveShadow: false
  });
  screen.userData = userData;
  return screen;
}

function renderDimensionCallouts(group, callouts, labelLayer, labels) {
  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0x9c6d2e,
    transparent: true,
    opacity: 0.94,
    depthTest: true
  });
  const haloMaterial = new THREE.LineBasicMaterial({
    color: 0xfff8ed,
    transparent: true,
    opacity: 0.55,
    depthTest: false
  });
  group.userData.materials = { lineMaterial, haloMaterial };

  callouts.forEach((callout) => {
    if (!isPoint(callout?.start) || !isPoint(callout?.end)) return;
    const start = pointToScene(callout.start);
    const end = pointToScene(callout.end);
    const direction = end.clone().sub(start);
    if (direction.lengthSq() < 1e-8) return;
    const midpoint = start.clone().lerp(end, 0.5);
    const perpendicular = getCalloutTickDirection(direction).multiplyScalar(toSceneLength(2.25));

    addSceneLine(group, [start, end], haloMaterial);
    addSceneLine(group, [start, end], lineMaterial);
    addSceneLine(group, [
      start.clone().sub(perpendicular),
      start.clone().add(perpendicular)
    ], lineMaterial);
    addSceneLine(group, [
      end.clone().sub(perpendicular),
      end.clone().add(perpendicular)
    ], lineMaterial);

    const label = labelLayer.ownerDocument.createElement("span");
    label.className = "guided-3d-dimension-label";
    label.style.position = "absolute";
    label.style.left = "0";
    label.style.top = "0";
    label.style.display = "grid";
    label.dataset.dimensionField = String(callout.fieldId || "");
    label.dataset.dimensionCode = String(callout.code || "");
    const title = labelLayer.ownerDocument.createElement("strong");
    if (callout.code) {
      const code = labelLayer.ownerDocument.createElement("b");
      code.textContent = callout.code;
      title.append(code);
    }
    title.append(labelLayer.ownerDocument.createTextNode(
      callout.label || callout.fieldId || "Dimension"
    ));
    const value = labelLayer.ownerDocument.createElement("small");
    value.textContent = formatDimensionValue(callout);
    label.append(title, value);
    labelLayer.appendChild(label);
    labels.push({ element: label, anchor: midpoint, callout });
  });
}

function getCalloutTickDirection(direction) {
  const normalized = direction.clone().normalize();
  if (Math.abs(normalized.y) > 0.75) return new THREE.Vector3(1, 0, 0);
  if (Math.abs(normalized.x) > 0.75) return new THREE.Vector3(0, 1, 0);
  return new THREE.Vector3(0, 1, 0);
}

function formatDimensionValue(callout) {
  const value = Number(callout.value);
  if (!Number.isFinite(value)) return "Enter measurement";
  const shown = `${Number(value.toFixed(2))} in`;
  const entered = Number(callout.enteredValue);
  if (
    callout.adjusted === true
    && Number.isFinite(entered)
    && Math.abs(entered - value) > 0.005
  ) {
    return `${shown} shown · ${Number(entered.toFixed(2))} in entered`;
  }
  return shown;
}

function createRoomMaterials() {
  const floorMap = createProceduralFloorTexture();
  floorMap.wrapS = THREE.RepeatWrapping;
  floorMap.wrapT = THREE.RepeatWrapping;
  floorMap.repeat.set(6, 5);

  return {
    wall: new THREE.MeshStandardMaterial({ color: 0xece8e1, roughness: 0.95, metalness: 0 }),
    wallSide: new THREE.MeshStandardMaterial({ color: 0xe3ded6, roughness: 0.96, metalness: 0 }),
    recess: new THREE.MeshStandardMaterial({ color: 0xd8d2c9, roughness: 0.98, metalness: 0 }),
    trim: new THREE.MeshStandardMaterial({ color: 0xf5f2ec, roughness: 0.72, metalness: 0 }),
    door: new THREE.MeshStandardMaterial({ color: 0xeeeae3, roughness: 0.76, metalness: 0 }),
    doorInset: new THREE.MeshStandardMaterial({ color: 0xe5e0d7, roughness: 0.82, metalness: 0 }),
    floor: new THREE.MeshStandardMaterial({
      color: 0xd6c6af,
      map: floorMap,
      roughness: 0.84,
      metalness: 0
    }),
    opening: new THREE.MeshStandardMaterial({ color: 0x7f786f, roughness: 1, metalness: 0 }),
    windowGlass: new THREE.MeshPhysicalMaterial({
      color: 0xc8dde3,
      roughness: 0.17,
      metalness: 0,
      transparent: true,
      opacity: 0.68,
      depthWrite: false,
      transmission: 0.08,
      clearcoat: 0.45,
      clearcoatRoughness: 0.16
    }),
    firebox: new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 0.9, metalness: 0.02 }),
    stone: new THREE.MeshStandardMaterial({ color: 0xb8b0a7, roughness: 0.84, metalness: 0 }),
    radiator: new THREE.MeshStandardMaterial({ color: 0xe7e4df, roughness: 0.58, metalness: 0.32 }),
    radiatorInset: new THREE.MeshStandardMaterial({ color: 0x8c8984, roughness: 0.52, metalness: 0.48 }),
    screen: new THREE.MeshStandardMaterial({
      color: 0x101214,
      roughness: 0.23,
      metalness: 0.12,
      emissive: 0x080b0d,
      emissiveIntensity: 0.18
    }),
    hardware: new THREE.MeshStandardMaterial({ color: 0x7b725f, roughness: 0.38, metalness: 0.75 }),
    edge: new THREE.LineBasicMaterial({ color: 0x80776b, transparent: true, opacity: 0.16 })
  };
}

function getRoomSurfaceMaterial(semantic, materials) {
  if (semantic.includes("floor")) return materials.floor;
  if (/base|trim|casing|molding|moulding|sill/.test(semantic)) return materials.trim;
  if (/recess|niche|back/.test(semantic)) return materials.recess;
  if (/side|return|reveal/.test(semantic)) return materials.wallSide;
  return materials.wall;
}

function getSurfaceThicknessOptions(semantic) {
  if (semantic.includes("floor")) {
    return { minHeight: 1, yBias: -0.5 };
  }
  if (/side-wall|return-wall|left-wall|right-wall/.test(semantic)) {
    return { minWidth: 1 };
  }
  if (/trim|base|casing|molding|moulding/.test(semantic)) {
    return { minDepth: 1.1 };
  }
  return { minDepth: 1 };
}

function createProceduralFloorTexture() {
  const canvas = globalThis.document?.createElement?.("canvas");
  if (!canvas) return null;
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = "#d7c8b4";
  context.fillRect(0, 0, 256, 256);

  for (let y = 0; y < 256; y += 32) {
    context.fillStyle = y % 64 ? "rgba(91, 65, 42, 0.035)" : "rgba(255, 255, 255, 0.035)";
    context.fillRect(0, y, 256, 32);
    context.strokeStyle = "rgba(83, 60, 39, 0.2)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(0, y + 0.5);
    context.lineTo(256, y + 0.5);
    context.stroke();
    for (let x = -32; x < 288; x += 64) {
      context.strokeStyle = "rgba(98, 71, 47, 0.075)";
      context.beginPath();
      context.moveTo(x + (y % 64 ? 32 : 0), y);
      context.lineTo(x + (y % 64 ? 32 : 0), y + 32);
      context.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function renderAcceptedProduct(group, acceptedSpecification, materials) {
  const descriptors = createGuidedSceneDescriptors(acceptedSpecification);
  const setGroups = new Map();
  const records = [];

  for (const descriptor of descriptors) {
    let setGroup = setGroups.get(descriptor.descriptorSetId);
    if (!setGroup) {
      setGroup = createAcceptedDescriptorSetRoot(descriptor);
      group.add(setGroup);
      setGroups.set(descriptor.descriptorSetId, setGroup);
    }
    const componentGroup = new THREE.Group();
    componentGroup.name = `accepted-component-${descriptor.componentId}`;
    componentGroup.userData = {
      componentId: descriptor.componentId,
      descriptorSetId: descriptor.descriptorSetId,
      role: descriptor.role,
      acceptedPhysicalDescriptor: true
    };
    setGroup.add(componentGroup);
    const rendered = renderAcceptedComponent(componentGroup, descriptor, materials);
    records.push(Object.freeze({
      componentId: descriptor.componentId,
      meshCount: rendered.meshes.length,
      materialSlots: rendered.plan.materialSlots,
      worldBounds: rendered.plan.worldBounds,
      submeshes: Object.freeze(rendered.plan.submeshes.map((submesh) => Object.freeze({
        submeshId: submesh.submeshId,
        geometry: submesh.geometry,
        materialSlot: submesh.materialSlot,
        grainRole: submesh.grainRole,
        worldBounds: submesh.worldBounds
      })))
    }));
  }
  group.userData.renderRecords = Object.freeze(records);
  return records;
}

function createAcceptedDescriptorSetRoot(descriptor) {
  const transform = descriptor.transform;
  const xAxis = new THREE.Vector3(transform.basis.x.x, transform.basis.x.y, transform.basis.x.z);
  const yAxis = new THREE.Vector3(transform.basis.y.x, transform.basis.y.y, transform.basis.y.z);
  const zAxis = new THREE.Vector3(transform.basis.z.x, transform.basis.z.y, transform.basis.z.z);
  const matrix = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
  const root = new THREE.Group();
  root.name = `accepted-descriptor-set-${descriptor.descriptorSetId}`;
  root.quaternion.setFromRotationMatrix(matrix);
  root.position.set(
    toSceneLength(transform.translation.x),
    toSceneLength(transform.translation.y),
    toSceneLength(transform.translation.z)
  );
  root.userData = {
    descriptorSetId: descriptor.descriptorSetId,
    installationId: descriptor.installationId,
    zoneId: descriptor.zoneId,
    rootScale: [1, 1, 1],
    source: "accepted-guided-specification"
  };
  return root;
}

/**
 * Resolve one accepted physical descriptor into renderer-facing submeshes.
 *
 * This is deliberately pure: the descriptor remains the only geometric
 * source of truth, while the Three.js layer below only realizes this plan.
 * Rails, stiles, fields, and authored crown cross-sections therefore remain
 * auditable without inspecting pixels or reverse-engineering a scene graph.
 */
export function createGuidedAcceptedComponentRenderPlan(descriptor) {
  return createSharedGuidedAcceptedComponentRenderPlan(descriptor);
}

function renderAcceptedComponent(group, descriptor, materials) {
  const plan = createGuidedAcceptedComponentRenderPlan(descriptor);
  const edgeMaterial = descriptor.role === "screen"
    ? materials.screenEdge
    : ["handle", "light", "screen", "back_panel", "backing_panel", "mounting_rail"].includes(descriptor.role)
      ? null
      : materials.edge;
  const meshes = plan.submeshes.map((submesh) => {
    const material = materials[submesh.materialSlot] || materials.case;
    const mesh = submesh.geometry === "crown_profile_extrusion"
      ? addAcceptedProfileExtrusion(group, submesh, material, {
        descriptorRole: descriptor.role,
        componentId: descriptor.componentId,
        edgeMaterial: submesh.edgeVisible ? edgeMaterial : null,
        edgeMaterialSlot: "edge",
        repeatInches: materials.repeatInches
      })
      : addSceneBox(
        group,
        acceptedBoundsSize(submesh.bounds),
        acceptedBoundsCenter(submesh.bounds),
        material,
        {
          descriptorRole: descriptor.role,
          materialSlot: submesh.materialSlot,
          submeshId: submesh.submeshId,
          componentId: descriptor.componentId,
          repeatInches: materials.repeatInches,
          uvRole: submesh.grainRole,
          edgeMaterial: submesh.edgeVisible ? edgeMaterial : null,
          edgeMaterialSlot: descriptor.role === "screen" ? "screenEdge" : "edge",
          castShadow: descriptor.role !== "light",
          receiveShadow: descriptor.role !== "light" && descriptor.role !== "screen"
        }
      );
    mesh.userData.descriptorMetadata = descriptor.metadata;
    mesh.userData.acceptedSubmeshId = submesh.submeshId;
    mesh.userData.acceptedLocalBounds = submesh.bounds;
    return mesh;
  });
  if (descriptor.role === "light") {
    const light = new THREE.PointLight(0xffdfad, 0.22, toSceneLength(26), 1.8);
    light.position.copy(meshes[0].position);
    light.userData.acceptedComponentId = descriptor.componentId;
    light.userData.finishIndependent = true;
    group.add(light);
  }
  return { plan, meshes };
}

function addAcceptedProfileExtrusion(parent, submesh, material, options = {}) {
  const geometry = createGuidedAcceptedProfileExtrusionGeometry(
    submesh,
    options.repeatInches
  );

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = options.castShadow !== false;
  mesh.receiveShadow = options.receiveShadow !== false;
  mesh.userData = {
    scenePurpose: CONCEPT_SCENE_PURPOSE,
    materialSlot: submesh.materialSlot,
    componentId: options.componentId,
    descriptorRole: options.descriptorRole,
    guidedGrainRole: submesh.grainRole,
    acceptedSubmeshId: submesh.submeshId,
    acceptedProfileExtrusion: true
  };
  parent.add(mesh);

  if (options.edgeMaterial) {
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 24),
      options.edgeMaterial
    );
    edges.userData.nonPhysicalHelper = true;
    edges.userData.materialSlot = options.edgeMaterialSlot || "edge";
    parent.add(edges);
  }
  return mesh;
}

export function createGuidedAcceptedProfileExtrusionGeometry(submesh, repeatInches) {
  const bounds = submesh.bounds;
  const profile = submesh.profileGeometry;
  if (!isAcceptedRenderBounds(bounds) || !isAcceptedCrownProfile(profile)) {
    throw new TypeError("An accepted authored crown profile is required.");
  }
  const extrusionAxis = profile.extrusion.axis;
  const projectionAxis = profile.crossSection.projectionAxis;
  const projectionDirection = Number(profile.crossSection.projectionDirection) >= 0 ? 1 : -1;
  const projectionLength = bounds.max[projectionAxis] - bounds.min[projectionAxis];
  const mountingPlane = finiteAcceptedNumber(
    profile.crossSection.mountingPlane,
    projectionDirection > 0 ? bounds.min[projectionAxis] : bounds.max[projectionAxis]
  );
  const shape = new THREE.Shape();
  profile.outline.forEach((point, index) => {
    const y = bounds.min.y + Number(point.height) * (bounds.max.y - bounds.min.y);
    const projection = mountingPlane
      + projectionDirection * Number(point.projection) * projectionLength;
    if (index === 0) shape.moveTo(toSceneLength(projection), toSceneLength(y));
    else shape.lineTo(toSceneLength(projection), toSceneLength(y));
  });
  shape.closePath();

  const extrusionMin = Number(profile.extrusion.min);
  const extrusionMax = Number(profile.extrusion.max);
  const extrusionLength = extrusionMax - extrusionMin;
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: toSceneLength(extrusionLength),
    steps: 1,
    bevelEnabled: false,
    curveSegments: 1
  });
  const positions = geometry.attributes.position;
  for (let index = 0; index < positions.count; index += 1) {
    const shapeProjection = positions.getX(index);
    const height = positions.getY(index);
    const extrusion = toSceneLength(extrusionMin) + positions.getZ(index);
    if (extrusionAxis === "x") {
      positions.setXYZ(index, extrusion, height, shapeProjection);
    } else {
      positions.setXYZ(index, shapeProjection, height, extrusion);
    }
  }
  positions.needsUpdate = true;
  applyPhysicalExtrusionUvs(geometry, repeatInches, extrusionAxis, {
    unitsPerInch: INCH_TO_SCENE,
    role: submesh.grainRole || "crown",
    crossSectionAxes: ["y", projectionAxis]
  });
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData ||= {};
  geometry.userData.guidedProfileGeometry = {
    kind: profile.kind,
    profileId: profile.profileId || null,
    outlineUnits: profile.outlineUnits || "normalized",
    extrusionAxis,
    projectionAxis
  };
  return geometry;
}

function acceptedBoundsSize(bounds) {
  return [
    bounds.max.x - bounds.min.x,
    bounds.max.y - bounds.min.y,
    bounds.max.z - bounds.min.z
  ];
}

function acceptedBoundsCenter(bounds) {
  return [
    (bounds.min.x + bounds.max.x) / 2,
    (bounds.min.y + bounds.max.y) / 2,
    (bounds.min.z + bounds.max.z) / 2
  ];
}

function getPlanCameraFrame(plan, aspect) {
  const bounds = collectPlanBounds(plan);
  const width = Math.max(1, getBoundsWidth(bounds) * INCH_TO_SCENE);
  const height = Math.max(1, getBoundsHeight(bounds) * INCH_TO_SCENE);
  const depth = Math.max(0.5, getBoundsDepth(bounds) * INCH_TO_SCENE);
  const targetBounds = plan.targetZones.length
    ? unionBounds(plan.targetZones.map((zone) => zone.bounds))
    : plan.room.bounds;
  const wallTargetZ = Number.isFinite(targetBounds?.min?.z)
    ? (targetBounds.min.z + targetBounds.max.z) / 2
    : getBackWallZ(plan.room);
  const target = new THREE.Vector3(
    toSceneLength(
      (bounds.min.x + bounds.max.x) / 2
      + (plan.room.layoutId === "corner-wall" ? 24 : 0)
    ),
    toSceneLength(bounds.min.y + getBoundsHeight(bounds) * 0.45),
    toSceneLength(wallTargetZ)
  );

  const verticalFov = THREE.MathUtils.degToRad(CAMERA_FOV);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(0.35, aspect));
  const verticalDistance = (height * 0.58) / Math.tan(verticalFov / 2);
  const horizontalDistance = (width * 0.56) / Math.tan(horizontalFov / 2);
  const baseRadius = clamp(
    Math.max(verticalDistance, horizontalDistance) + depth * 0.22,
    7,
    58
  );
  const radius = plan.room.layoutId === "corner-wall"
    ? clamp(baseRadius * 1.15, 7, 58)
    : baseRadius;

  return {
    target,
    radius,
    theta: plan.room.layoutId === "corner-wall" ? -0.34 : -0.08,
    phi: 0.115,
    shadowExtent: Math.max(width, height) * 0.7
  };
}

function collectPlanBounds(plan) {
  const calloutBounds = plan.dimensionCallouts.map((callout) => {
    if (!isPoint(callout?.start) || !isPoint(callout?.end)) return null;
    return createBounds(
      {
        x: Math.min(callout.start.x, callout.end.x),
        y: Math.min(callout.start.y, callout.end.y),
        z: Math.min(callout.start.z, callout.end.z)
      },
      {
        x: Math.max(callout.start.x, callout.end.x),
        y: Math.max(callout.start.y, callout.end.y),
        z: Math.max(callout.start.z, callout.end.z)
      }
    );
  });
  const candidates = [
    plan.room.bounds,
    ...plan.room.surfaces.map((surface) => surface?.bounds),
    ...plan.room.features.map((feature) => feature?.renderHidden ? null : feature?.bounds),
    ...plan.targetZones.map((zone) => zone?.bounds),
    ...calloutBounds
  ].filter(isBounds);
  return unionBounds(candidates) || plan.room.bounds;
}

function unionBounds(boundsList) {
  if (!boundsList.length) return null;
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  boundsList.forEach((bounds) => {
    min.x = Math.min(min.x, bounds.min.x);
    min.y = Math.min(min.y, bounds.min.y);
    min.z = Math.min(min.z, bounds.min.z);
    max.x = Math.max(max.x, bounds.max.x);
    max.y = Math.max(max.y, bounds.max.y);
    max.z = Math.max(max.z, bounds.max.z);
  });
  return createBounds(min, max);
}

function createBounds(min, max) {
  return {
    min: { x: min.x, y: min.y, z: min.z },
    max: { x: max.x, y: max.y, z: max.z },
    size: {
      width: max.x - min.x,
      height: max.y - min.y,
      depth: max.z - min.z
    }
  };
}

function getBoundsCorners(bounds) {
  const corners = [];
  [bounds.min.x, bounds.max.x].forEach((x) => {
    [bounds.min.y, bounds.max.y].forEach((y) => {
      [bounds.min.z, bounds.max.z].forEach((z) => {
        corners.push(new THREE.Vector3(x, y, z));
      });
    });
  });
  return corners;
}

function addBoundsBox(parent, bounds, material, options = {}) {
  if (!isBounds(bounds)) return null;
  const width = Math.max(
    getBoundsWidth(bounds),
    Number(options.minWidth) || MIN_SURFACE_THICKNESS / INCH_TO_SCENE
  );
  const height = Math.max(
    getBoundsHeight(bounds),
    Number(options.minHeight) || MIN_SURFACE_THICKNESS / INCH_TO_SCENE
  );
  const depth = Math.max(
    getBoundsDepth(bounds),
    Number(options.minDepth) || MIN_SURFACE_THICKNESS / INCH_TO_SCENE
  );
  const center = [
    (bounds.min.x + bounds.max.x) / 2 + finiteOr(options.xBias, 0),
    (bounds.min.y + bounds.max.y) / 2 + finiteOr(options.yBias, 0),
    (bounds.min.z + bounds.max.z) / 2 + finiteOr(options.zBias, 0)
  ];
  return addSceneBox(parent, [width, height, depth], center, material, options);
}

function addSceneBox(parent, sizeInches, centerInches, material, options = {}) {
  const width = Math.max(MIN_SURFACE_THICKNESS, toSceneLength(sizeInches[0]));
  const height = Math.max(MIN_SURFACE_THICKNESS, toSceneLength(sizeInches[1]));
  const depth = Math.max(MIN_SURFACE_THICKNESS, toSceneLength(sizeInches[2]));
  const geometry = new THREE.BoxGeometry(width, height, depth);
  if (options.repeatInches) {
    applyPhysicalBoxUvs(
      geometry,
      sizeInches,
      options.repeatInches,
      options.uvRole || options.descriptorRole || "case"
    );
  }
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(
    toSceneLength(centerInches[0]),
    toSceneLength(centerInches[1]),
    toSceneLength(centerInches[2])
  );
  mesh.castShadow = options.castShadow !== false;
  mesh.receiveShadow = options.receiveShadow !== false;
  mesh.userData.scenePurpose = options.scenePurpose || CONCEPT_SCENE_PURPOSE;
  if (options.materialSlot) mesh.userData.materialSlot = options.materialSlot;
  if (options.componentId) mesh.userData.componentId = options.componentId;
  if (options.descriptorRole) mesh.userData.descriptorRole = options.descriptorRole;
  if (options.uvRole) mesh.userData.guidedGrainRole = options.uvRole;
  if (options.submeshId) mesh.userData.acceptedSubmeshId = options.submeshId;
  parent.add(mesh);

  if (options.edgeMaterial) {
    const edgeGeometry = new THREE.EdgesGeometry(geometry, 30);
    const edges = new THREE.LineSegments(edgeGeometry, options.edgeMaterial);
    edges.position.copy(mesh.position);
    edges.userData.nonPhysicalHelper = true;
    edges.userData.materialSlot = options.edgeMaterialSlot || "edge";
    parent.add(edges);
  }
  return mesh;
}

function addRectangularFrame(
  group,
  bounds,
  trimWidth,
  depth,
  z,
  material,
  edgeMaterial,
  options = {}
) {
  const width = getBoundsWidth(bounds);
  const height = getBoundsHeight(bounds);
  const centerX = (bounds.min.x + bounds.max.x) / 2;
  const centerY = (bounds.min.y + bounds.max.y) / 2;
  addSceneBox(group, [trimWidth, height + trimWidth, depth], [
    bounds.min.x - trimWidth / 2,
    centerY,
    z
  ], material, { edgeMaterial });
  addSceneBox(group, [trimWidth, height + trimWidth, depth], [
    bounds.max.x + trimWidth / 2,
    centerY,
    z
  ], material, { edgeMaterial });
  addSceneBox(group, [width + trimWidth * 2, trimWidth, depth], [
    centerX,
    bounds.max.y + trimWidth / 2,
    z
  ], material, { edgeMaterial });
  if (options.includeBottom !== false) {
    addSceneBox(group, [width + trimWidth * 2, trimWidth, depth], [
      centerX,
      bounds.min.y - trimWidth / 2,
      z
    ], material, { edgeMaterial });
  }
}

function addSceneLine(parent, points, material) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const line = new THREE.Line(geometry, material);
  line.userData.nonPhysicalHelper = true;
  line.renderOrder = material.depthTest === false ? 3 : 2;
  parent.add(line);
  return line;
}

function disposeObject3D(object) {
  if (!object?.traverse) return;
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  object.traverse((child) => {
    if (child.geometry) geometries.add(child.geometry);
    const childMaterials = Array.isArray(child.material)
      ? child.material
      : child.material
        ? [child.material]
        : [];
    childMaterials.forEach((material) => {
      materials.add(material);
      Object.keys(material).forEach((key) => {
        const value = material[key];
        if (value?.isTexture) textures.add(value);
      });
    });
    const declaredMaterials = child.userData?.materials;
    if (declaredMaterials && typeof declaredMaterials === "object") {
      Object.values(declaredMaterials).forEach((material) => {
        if (!material?.isMaterial) return;
        materials.add(material);
        Object.keys(material).forEach((key) => {
          const value = material[key];
          if (value?.isTexture) textures.add(value);
        });
      });
    }
  });
  geometries.forEach((geometry) => geometry.dispose?.());
  textures.forEach((texture) => {
    if (!isGuidedSharedTexture(texture)) texture.dispose?.();
  });
  materials.forEach((material) => material.dispose?.());
}

function disposeMaterialLibrary(library) {
  const materials = new Set(
    Object.values(library || {}).filter((value) => value?.isMaterial)
  );
  materials.forEach((material) => material.dispose?.());
}

function applyAcceptedTargetZones(plan, acceptedSpecification) {
  const installations = new Map(
    (acceptedSpecification.fit?.installations || []).map((installation) => [
      installation.id,
      installation
    ])
  );
  plan.targetZones = (acceptedSpecification.product?.descriptorSets || []).map((set) => {
    const bounds = transformAcceptedBounds(set.physicalBounds || set.bounds, set.transform);
    const installation = installations.get(set.installationId);
    return {
      id: set.id,
      role: installation?.role || set.zoneId || "primary",
      source: "accepted-guided-specification",
      bounds,
      size: bounds.size,
      frame: {
        origin: bounds.min,
        widthAxis: { x: 1, y: 0, z: 0 },
        heightAxis: { x: 0, y: 1, z: 0 },
        depthAxis: { x: 0, y: 0, z: 1 }
      },
      excludes: []
    };
  });
}

function transformAcceptedBounds(bounds, transform = {}) {
  const translation = transform.translation || {};
  const basis = transform.basis || {};
  const xAxis = basis.x || { x: 1, y: 0, z: 0 };
  const yAxis = basis.y || { x: 0, y: 1, z: 0 };
  const zAxis = basis.z || { x: 0, y: 0, z: 1 };
  const points = [];
  [bounds.min.x, bounds.max.x].forEach((x) => {
    [bounds.min.y, bounds.max.y].forEach((y) => {
      [bounds.min.z, bounds.max.z].forEach((z) => {
        points.push({
          x: finiteOr(translation.x, 0) + xAxis.x * x + yAxis.x * y + zAxis.x * z,
          y: finiteOr(translation.y, 0) + xAxis.y * x + yAxis.y * y + zAxis.y * z,
          z: finiteOr(translation.z, 0) + xAxis.z * x + yAxis.z * y + zAxis.z * z
        });
      });
    });
  });
  return createBounds(
    {
      x: Math.min(...points.map((point) => point.x)),
      y: Math.min(...points.map((point) => point.y)),
      z: Math.min(...points.map((point) => point.z))
    },
    {
      x: Math.max(...points.map((point) => point.x)),
      y: Math.max(...points.map((point) => point.y)),
      z: Math.max(...points.map((point) => point.z))
    }
  );
}

/**
 * Appearance fixtures can change independently from fitted casework geometry.
 * The renderer uses this signature to refresh only the accepted product group
 * when handles or lighting descriptors are added, removed, or reshaped.
 */
export function createGuidedAppearanceDescriptorSignature(acceptedSpecification) {
  const sets = acceptedSpecification?.product?.descriptorSets
    || acceptedSpecification?.descriptorSets
    || [];
  return createStableHash(
    "guided-appearance-descriptors-v1",
    sets.map((set) => ({
      id: set?.id || null,
      installationId: set?.installationId || null,
      components: (Array.isArray(set?.components) ? set.components : [])
        .filter((component) => GUIDED_APPEARANCE_DESCRIPTOR_ROLES.has(component?.role))
        .map((component) => ({
          id: component.id,
          role: component.role,
          parentId: component.parentId || null,
          hostId: component.hostId || null,
          bounds: component.bounds || null,
          metadata: component.metadata || null
        }))
    }))
  );
}

function createGeometrySceneSignature(plan, acceptedSpecification, options) {
  const signatureInput = {
    room: acceptedSpecification?.room || {
      layoutId: plan.room.layoutId,
      bounds: plan.room.bounds,
      surfaces: plan.room.surfaces,
      features: plan.room.features
    },
    geometryFingerprint: options.showProduct
      ? acceptedSpecification?.geometryFingerprint || null
      : null,
    showProduct: options.showProduct,
    showDimensions: options.showDimensions,
    dimensionCallouts: options.showDimensions ? plan.dimensionCallouts : []
  };
  return createStableHash("guided-geometry-scene-v1", signatureInput);
}

function createMaterialSignature(selection) {
  return createStableHash("guided-material-state-v1", {
    finish: selection?.finish?.id,
    accentFinish: selection?.accentFinish?.id,
    hardware: selection?.details?.hardware,
    lighting: selection?.details?.lighting
  });
}

function createStableHash(prefix, value) {
  const source = stableStringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${prefix}-${(hash >>> 0).toString(36)}`;
}

function createSceneSignature(plan) {
  const signatureInput = {
    version: plan.version,
    selection: plan.selection,
    measurements: plan.measurements,
    room: {
      layoutId: plan.room.layoutId,
      bounds: plan.room.bounds,
      surfaces: plan.room.surfaces,
      features: plan.room.features
    },
    targetZones: plan.targetZones,
    dimensionCallouts: plan.dimensionCallouts
  };
  const source = stableStringify(signatureInput);
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `g3d-v1-${(hash >>> 0).toString(36)}`;
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => (
    `${JSON.stringify(key)}:${stableStringify(value[key])}`
  )).join(",")}}`;
}

function getSemanticKind(descriptor) {
  return String(
    descriptor?.kind
    || descriptor?.role
    || descriptor?.id
    || "surface"
  ).toLowerCase().replaceAll("_", "-");
}

function getBackWallZ(room) {
  const backSurface = room.surfaces.find((surface) => (
    /back-wall|recess-back|projection-face/.test(getSemanticKind(surface))
  ));
  if (backSurface?.bounds) {
    return (backSurface.bounds.min.z + backSurface.bounds.max.z) / 2;
  }
  return room.bounds.max.z;
}

function isBounds(value) {
  return Boolean(
    value
    && isPoint(value.min)
    && isPoint(value.max)
    && value.max.x >= value.min.x
    && value.max.y >= value.min.y
    && value.max.z >= value.min.z
  );
}

function isPoint(value) {
  return Boolean(
    value
    && Number.isFinite(Number(value.x))
    && Number.isFinite(Number(value.y))
    && Number.isFinite(Number(value.z))
  );
}

function getBoundsWidth(bounds) {
  return Number(bounds?.size?.width) || Math.max(0, Number(bounds?.max?.x) - Number(bounds?.min?.x));
}

function getBoundsHeight(bounds) {
  return Number(bounds?.size?.height) || Math.max(0, Number(bounds?.max?.y) - Number(bounds?.min?.y));
}

function getBoundsDepth(bounds) {
  return Number(bounds?.size?.depth) || Math.max(0, Number(bounds?.max?.z) - Number(bounds?.min?.z));
}

function pointToScene(point) {
  return new THREE.Vector3(
    toSceneLength(point.x),
    toSceneLength(point.y),
    toSceneLength(point.z)
  );
}

function toSceneLength(value) {
  return finiteOr(value, 0) * INCH_TO_SCENE;
}

function pointFromPointerEvent(event) {
  return { x: event.clientX, y: event.clientY };
}

function parseColor(value, fallback) {
  const match = String(value || "").trim().match(/^#?([0-9a-f]{6})$/i);
  return match ? Number.parseInt(match[1], 16) : fallback;
}

function normalizeCssColor(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value || "").trim())
    ? String(value).trim()
    : fallback;
}

function positiveFinite(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function finiteOr(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
