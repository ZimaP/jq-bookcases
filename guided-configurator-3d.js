import * as THREE from "./assets/vendor/three.module.js";
import { createGuidedScenePlan } from "./guided-scene-plan.js?v=unified-guided-scene-20260729d";

const INCH_TO_SCENE = 1 / 12;
const MAX_DEVICE_PIXEL_RATIO = 2;
const MIN_SURFACE_THICKNESS = 0.065;
const CAMERA_FOV = 35;
const CAMERA_NEAR = 0.04;
const CAMERA_FAR = 320;
const CONCEPT_SCENE_PURPOSE = "customer-concept-scene-descriptor";
const ARCHITECTURAL_CLEARANCE = 2.5;
const DIMENSION_LABEL_GAP = 6;
const DIMENSION_LABEL_VIEWPORT_PADDING = 8;
const DIMENSION_LABEL_BOTTOM_RESERVE = 44;

let guidedSceneInstanceSequence = 0;

/**
 * Create the lightweight renderer used by the guided configurator.
 *
 * This viewer intentionally consumes the guided scene plan rather than the
 * manufacturing engine. Its cabinetry is a concept-scene descriptor
 * visualization only; it never creates bill-of-material or pricing data.
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

    this.runtime = null;
    this.canvas = null;
    this.labelLayer = null;
    this.hint = null;
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
    this.topologySignature = "";
    this.userAdjustedCamera = false;

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
      showDimensions: options.showDimensions === true
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

      const plan = createRenderReadyScenePlan(createGuidedScenePlan(project));
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
      this.sceneSignature = createSceneSignature(plan);
      this.topologySignature = nextTopologySignature;
      this.failed = false;
      this.runtime.hidden = false;
      delete this.runtime.dataset.rendered;
      delete this.canvas.dataset.rendered;
      this.runtime.dataset.scenePurpose = CONCEPT_SCENE_PURPOSE;
      this.syncDiagnostics();
      this.rebuildScene();
      this.configureCamera({ preserveAdjustedCamera });
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
    this.content = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.canvas = null;
    this.plan = null;
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
    canvas.setAttribute("aria-describedby", instructions.id);
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.touchAction = "none";
    canvas.dataset.guided3dInstance = String(this.instanceId);
    canvas.setAttribute("data-guided-3d-instance", String(this.instanceId));

    runtime.append(canvas, labelLayer, hint, instructions);

    this.runtime = runtime;
    this.canvas = canvas;
    this.labelLayer = labelLayer;
    this.hint = hint;
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.content = new THREE.Group();
    this.content.name = "guided-concept-scene";
    this.content.userData.scenePurpose = CONCEPT_SCENE_PURPOSE;
    this.scene.add(this.content);
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
    if (this.content) {
      this.scene.remove(this.content);
      disposeObject3D(this.content);
      this.content.clear();
    }
    this.dimensionLabels.forEach(({ element }) => element.remove());
    this.dimensionLabels = [];
    this.labelLayer.replaceChildren();

    this.content = new THREE.Group();
    this.content.name = "guided-concept-scene";
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
      const productGroup = new THREE.Group();
      productGroup.name = "guided-product-concept";
      productGroup.userData = {
        scenePurpose: CONCEPT_SCENE_PURPOSE,
        source: "guided-scene-plan",
        billOfMaterials: false,
        pricing: false
      };
      const productMaterials = createProductMaterials(this.plan.selection);
      productGroup.userData.materials = productMaterials;
      this.content.add(productGroup);
      renderProductPlan(productGroup, this.plan, productMaterials);
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
    const values = {
      guided3dInstance: String(this.instanceId),
      sceneLayout: this.plan?.room?.layoutId || "",
      showProduct: String(this.options.showProduct === true),
      showDimensions: String(this.options.showDimensions === true),
      sceneSignature: this.sceneSignature || ""
    };
    [this.runtime, this.canvas].filter(Boolean).forEach((element) => {
      Object.assign(element.dataset, values);
      element.setAttribute("data-guided-3d-instance", String(this.instanceId));
    });
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

function createRenderReadyScenePlan(sourcePlan) {
  const plan = JSON.parse(JSON.stringify(sourcePlan));
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

function renderProductPlan(group, plan, materials) {
  const zones = plan.targetZones.filter((zone) => isBounds(zone?.bounds));
  const featuresById = new Map(
    plan.room.features.map((feature) => [feature.id, feature])
  );
  if (!zones.length) return;

  zones.forEach((zone) => {
    const zoneRoot = createZoneRoot(zone);
    if (!zoneRoot) return;
    zoneRoot.name = `guided-product-zone-${zone.id || zone.role || "primary"}`;
    zoneRoot.userData = {
      source: zone.source || "guided-scene-plan",
      descriptorId: zone.id || null,
      zoneRole: zone.role || "primary",
      scenePurpose: CONCEPT_SCENE_PURPOSE,
      billOfMaterials: false,
      pricing: false
    };
    group.add(zoneRoot);

    const context = {
      zone,
      width: getZoneWidth(zone),
      height: getZoneHeight(zone),
      depth: getZoneDepth(zone),
      role: String(zone.role || "primary"),
      exclusions: resolveZoneExclusions(zone, featuresById, plan.room.features, plan),
      plan,
      selection: plan.selection,
      materials
    };
    if (context.width <= 0 || context.height <= 0 || context.depth <= 0) return;
    renderProductZone(zoneRoot, context);
  });
}

function renderProductZone(group, context) {
  const category = String(context.selection?.categoryId || "bookcase");
  const style = String(context.selection?.styleId || "");

  if (category === "floating-storage") {
    renderFloatingStorage(group, context);
    return;
  }
  if (category === "radiator-cover") {
    renderRadiatorCover(group, context);
    return;
  }
  if (category === "window-storage") {
    renderWindowStorage(group, context);
    return;
  }
  if (category === "tv-unit" || style.includes("tv") || style.includes("media")) {
    renderMediaWall(group, context);
    return;
  }

  renderBookcaseProduct(group, context);
}

function renderBookcaseProduct(group, context) {
  const style = String(context.selection?.styleId || "");
  const role = context.role;
  if (role === "below") {
    getRenderableWidthIntervals(context).forEach(([start, end]) => {
      if (end - start < 4) return;
      renderBaseStorage(group, {
        ...context,
        x: start,
        y: 0,
        width: end - start,
        height: context.height,
        depth: context.depth,
        storage: style.includes("drawer") ? "drawers" : "doors"
      });
    });
    return;
  }
  if (role === "above") {
    getRenderableWidthIntervals(context).forEach(([start, end]) => {
      if (end - start < 4) return;
      renderOpenCase(group, {
        ...context,
        x: start,
        y: 0,
        width: end - start,
        height: context.height,
        depth: context.depth,
        includeBase: false
      });
    });
    return;
  }

  const intervals = getRenderableWidthIntervals(context);
  intervals.forEach(([start, end]) => {
    const width = end - start;
    if (width < Math.min(context.width * 0.06, 4)) return;
    renderBookcaseBank(group, {
      ...context,
      x: start,
      width,
      style
    });
  });
}

function renderBookcaseBank(group, context) {
  const { x, width, height, depth, style } = context;
  const openOnly = style.includes("full-open");
  const storageKind = style.includes("drawer") ? "drawers" : "doors";
  const lowerHeight = openOnly ? 0 : height * 0.29;
  const upperY = lowerHeight;
  const upperHeight = height - lowerHeight;

  if (lowerHeight > 0) {
    renderBaseStorage(group, {
      ...context,
      x,
      y: 0,
      width,
      height: lowerHeight,
      depth,
      storage: storageKind
    });
  }

  renderOpenCase(group, {
    ...context,
    x,
    y: upperY,
    width,
    height: upperHeight,
    depth,
    includeBase: openOnly
  });
  renderTopTreatment(group, {
    ...context,
    x,
    y: height,
    width,
    depth
  });
  if (openOnly) {
    renderBaseTreatment(group, {
      ...context,
      x,
      width,
      depth
    });
  }
}

function renderOpenCase(group, context) {
  const {
    x,
    y,
    width,
    height,
    depth,
    materials,
    selection
  } = context;
  if (width <= 0 || height <= 0 || depth <= 0) return;

  const frame = visualFrameThickness(width, height);
  const usableWidth = Math.max(frame, width - frame * 2);
  const sectionCount = clamp(Math.round(width / Math.max(height * 0.38, 1)), 1, 4);
  const sectionWidth = usableWidth / sectionCount;
  const shelfCount = clamp(Math.round(3 + height / Math.max(width, 1)), 3, 6);
  const shelfDepth = depth * 0.9;
  const shelfThickness = frame * 0.56;
  const backThickness = Math.max(0.55, frame * 0.34);

  addSceneBox(group, [frame, height, depth], [x + frame / 2, y + height / 2, depth / 2], materials.side, {
    edgeMaterial: materials.edge
  });
  addSceneBox(group, [frame, height, depth], [x + width - frame / 2, y + height / 2, depth / 2], materials.side, {
    edgeMaterial: materials.edge
  });
  addSceneBox(group, [width, frame, depth], [x + width / 2, y + height - frame / 2, depth / 2], materials.case, {
    edgeMaterial: materials.edge
  });
  if (context.includeBase) {
    addSceneBox(group, [width, frame, depth], [x + width / 2, y + frame / 2, depth / 2], materials.case, {
      edgeMaterial: materials.edge
    });
  }
  addSceneBox(group, [width - frame * 1.2, height - frame, backThickness], [
    x + width / 2,
    y + height / 2,
    depth - backThickness / 2
  ], materials.back, { castShadow: false, receiveShadow: true });

  for (let section = 1; section < sectionCount; section += 1) {
    const dividerX = x + frame + sectionWidth * section;
    addSceneBox(group, [frame * 0.72, height, depth], [
      dividerX,
      y + height / 2,
      depth / 2
    ], materials.side, { edgeMaterial: materials.edge });
  }

  for (let shelfIndex = 1; shelfIndex <= shelfCount; shelfIndex += 1) {
    const shelfY = y + frame + ((height - frame * 2) * shelfIndex) / (shelfCount + 1);
    addSceneBox(group, [usableWidth, shelfThickness, shelfDepth], [
      x + width / 2,
      shelfY,
      depth / 2
    ], materials.case, { edgeMaterial: materials.edge });

    if (selection?.details?.lighting && selection.details.lighting !== "no-lighting") {
      addSceneBox(group, [
        usableWidth * 0.84,
        Math.max(0.18, shelfThickness * 0.14),
        Math.max(0.22, depth * 0.08)
      ], [
        x + width / 2,
        shelfY - shelfThickness * 0.54,
        depth * 0.2
      ], materials.led, { castShadow: false, receiveShadow: false });
      addProductLight(group, [
        x + width / 2,
        shelfY - shelfThickness,
        depth * 0.24
      ], selection.details.lighting);
    }
  }
}

function renderBaseStorage(group, context) {
  const {
    x,
    y,
    width,
    height,
    depth,
    storage,
    materials,
    selection
  } = context;
  if (width <= 0 || height <= 0 || depth <= 0) return;
  const frame = visualFrameThickness(width, height);
  const frontZ = -Math.max(0.25, depth * 0.018);
  const columns = clamp(Math.round(width / Math.max(height * 1.28, 1)), 1, 4);
  const columnWidth = width / columns;

  addSceneBox(group, [width, height, depth], [x + width / 2, y + height / 2, depth / 2], materials.case, {
    edgeMaterial: materials.edge
  });
  addSceneBox(group, [width - frame, height - frame, Math.max(0.55, frame * 0.35)], [
    x + width / 2,
    y + height / 2,
    frontZ
  ], materials.reveal, { castShadow: false, receiveShadow: true });

  if (storage === "drawers") {
    const rows = 3;
    const gap = Math.max(0.35, frame * 0.23);
    const panelWidth = Math.max(1, columnWidth - gap * 1.6);
    const panelHeight = Math.max(1, (height - gap * (rows + 1)) / rows);
    for (let column = 0; column < columns; column += 1) {
      for (let row = 0; row < rows; row += 1) {
        const centerX = x + columnWidth * (column + 0.5);
        const centerY = y + gap + panelHeight / 2 + row * (panelHeight + gap);
        renderFrontPanel(group, {
          centerX,
          centerY,
          width: panelWidth,
          height: panelHeight,
          z: frontZ - 0.55,
          style: selection?.details?.doorStyle || "shaker",
          materials,
          hardware: selection?.details?.hardware,
          drawer: true
        });
      }
    }
  } else {
    const gap = Math.max(0.4, frame * 0.24);
    const panelWidth = Math.max(1, columnWidth - gap * 1.5);
    const panelHeight = Math.max(1, height - gap * 2);
    for (let column = 0; column < columns; column += 1) {
      renderFrontPanel(group, {
        centerX: x + columnWidth * (column + 0.5),
        centerY: y + height / 2,
        width: panelWidth,
        height: panelHeight,
        z: frontZ - 0.55,
        style: selection?.details?.doorStyle || "shaker",
        materials,
        hardware: selection?.details?.hardware,
        drawer: false,
        hardwareSide: column % 2 ? -1 : 1
      });
    }
  }

  renderBaseTreatment(group, { ...context, x, y, width, depth });
}

function renderFrontPanel(group, descriptor) {
  const {
    centerX,
    centerY,
    width,
    height,
    z,
    style,
    materials,
    hardware,
    drawer,
    hardwareSide = 0
  } = descriptor;
  const panelMaterial = style === "glass" ? materials.glass : materials.front;
  addSceneBox(group, [width, height, 0.72], [centerX, centerY, z], panelMaterial, {
    edgeMaterial: materials.edge
  });

  if (style === "shaker" || style === "glass") {
    const rail = clamp(Math.min(width, height) * 0.1, 0.85, 2.4);
    const insetWidth = Math.max(0.6, width - rail * 2);
    const insetHeight = Math.max(0.6, height - rail * 2);
    if (style !== "glass") {
      addSceneBox(group, [insetWidth, insetHeight, 0.18], [
        centerX,
        centerY,
        z - 0.44
      ], materials.inset, { castShadow: true, receiveShadow: true });
    }
    addSceneBox(group, [width, rail, 0.26], [centerX, centerY + height / 2 - rail / 2, z - 0.52], materials.front);
    addSceneBox(group, [width, rail, 0.26], [centerX, centerY - height / 2 + rail / 2, z - 0.52], materials.front);
    addSceneBox(group, [rail, insetHeight, 0.26], [centerX - width / 2 + rail / 2, centerY, z - 0.52], materials.front);
    addSceneBox(group, [rail, insetHeight, 0.26], [centerX + width / 2 - rail / 2, centerY, z - 0.52], materials.front);
  }

  if (!hardware || hardware === "none") return;
  const hardwareX = drawer
    ? centerX
    : centerX + hardwareSide * width * 0.34;
  addCabinetHardware(group, {
    x: hardwareX,
    y: drawer ? centerY : centerY,
    z: z - 1.05,
    width,
    hardware,
    material: materials.hardware
  });
}

function addCabinetHardware(group, descriptor) {
  const { x, y, z, width, hardware, material } = descriptor;
  if (hardware === "knob") {
    const knob = new THREE.Mesh(
      new THREE.SphereGeometry(toSceneLength(clamp(width * 0.035, 0.55, 0.95)), 18, 12),
      material
    );
    knob.position.set(toSceneLength(x), toSceneLength(y), toSceneLength(z));
    knob.castShadow = true;
    group.add(knob);
    return;
  }

  const pullWidth = clamp(width * 0.24, 3, 7);
  const bar = new THREE.Mesh(
    new THREE.CylinderGeometry(toSceneLength(0.22), toSceneLength(0.22), toSceneLength(pullWidth), 18),
    material
  );
  bar.rotation.z = Math.PI / 2;
  bar.position.set(toSceneLength(x), toSceneLength(y), toSceneLength(z));
  bar.castShadow = true;
  group.add(bar);
  [-1, 1].forEach((side) => {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(toSceneLength(0.18), toSceneLength(0.18), toSceneLength(0.7), 14),
      material
    );
    post.rotation.x = Math.PI / 2;
    post.position.set(
      toSceneLength(x + side * pullWidth * 0.42),
      toSceneLength(y),
      toSceneLength(z + 0.35)
    );
    post.castShadow = true;
    group.add(post);
  });
}

function renderBaseTreatment(group, context) {
  const { x, y = 0, width, depth, materials, selection } = context;
  const baseStyle = String(selection?.details?.baseStyle || "flush-base");
  const baseHeight = clamp(Math.min(width, depth) * 0.075, 1.6, 3.5);
  if (baseStyle === "recessed-toe-kick") {
    addSceneBox(group, [
      Math.max(1, width - baseHeight * 1.3),
      baseHeight,
      depth * 0.68
    ], [
      x + width / 2,
      y + baseHeight / 2,
      depth * 0.63
    ], materials.toe, { castShadow: true, receiveShadow: true });
    return;
  }
  if (baseStyle === "furniture-base") {
    const footWidth = Math.max(1, baseHeight * 0.62);
    [x + footWidth, x + width - footWidth].forEach((footX) => {
      addSceneBox(group, [footWidth, baseHeight * 1.45, footWidth], [
        footX,
        y + baseHeight * 0.72,
        depth * 0.72
      ], materials.case, { edgeMaterial: materials.edge });
    });
    return;
  }
  addSceneBox(group, [width, baseHeight, depth], [
    x + width / 2,
    y + baseHeight / 2,
    depth / 2
  ], materials.case, { edgeMaterial: materials.edge });
}

function renderTopTreatment(group, context) {
  const { x, y, width, depth, materials, selection } = context;
  const treatment = String(selection?.details?.topTreatment || "small-crown");
  if (treatment === "simple-finished-top") return;
  const railHeight = clamp(Math.min(width, depth) * 0.075, 1.5, 3.5);
  const projection = treatment === "traditional-crown" ? railHeight * 0.7 : railHeight * 0.35;
  addSceneBox(group, [
    width + projection * 2,
    railHeight,
    depth + projection
  ], [
    x + width / 2,
    y - railHeight / 2,
    depth / 2 - projection / 2
  ], materials.case, { edgeMaterial: materials.edge });
  if (treatment === "traditional-crown") {
    addSceneBox(group, [
      width + projection * 2.8,
      railHeight * 0.58,
      depth + projection * 1.55
    ], [
      x + width / 2,
      y + railHeight * 0.22,
      depth / 2 - projection * 0.78
    ], materials.case, { edgeMaterial: materials.edge });
  }
}

function renderMediaWall(group, context) {
  if (context.role === "below") {
    getArchitecturalSafeWidthIntervals(context).forEach(([start, end]) => {
      if (end - start < 4) return;
      renderBaseStorage(group, {
        ...context,
        x: start,
        y: 0,
        width: end - start,
        storage: "doors"
      });
    });
    return;
  }
  if (context.role === "left" || context.role === "right" || context.role === "return") {
    getArchitecturalSafeWidthIntervals(context).forEach((interval) => (
      renderBookcaseInterval(group, context, interval)
    ));
    return;
  }
  if (context.role === "above") {
    getArchitecturalSafeWidthIntervals(context).forEach(([start, end]) => {
      if (end - start < 4) return;
      renderOpenCase(group, {
        ...context,
        x: start,
        y: 0,
        width: end - start,
        includeBase: true
      });
    });
    return;
  }

  const mediaFeature = findZoneFeature(context, /tv|screen|television/);
  const safeMediaBounds = mediaFeature?.renderHidden ? null : mediaFeature?.bounds || null;
  const localMedia = safeMediaBounds
    ? projectBoundsIntoZone(context.zone, safeMediaBounds)
    : null;
  const architecturalExclusions = context.exclusions.filter(({ feature }) => (
    isArchitecturalObstacleFeature(feature)
  ));
  if (!architecturalExclusions.length) {
    renderMediaWallSegment(group, context, [0, context.width], localMedia, {
      mediaFeaturePresent: Boolean(mediaFeature)
    });
    return;
  }

  const intervals = getArchitecturalSafeWidthIntervals(context);
  const mediaWasRelocated = Boolean(mediaFeature?.renderAdjusted && safeMediaBounds);
  const mediaInterval = selectMediaWidthInterval(intervals, localMedia, {
    allowClosest: mediaWasRelocated || !mediaFeature
  });

  if (mediaInterval) {
    intervals.forEach((interval) => {
      if (interval === mediaInterval) {
        renderMediaWallSegment(group, context, interval, localMedia, {
          constrained: true,
          mediaFeaturePresent: Boolean(mediaFeature)
        });
        return;
      }
      renderBookcaseInterval(group, context, interval);
    });
    return;
  }

  renderRaisedMediaLayout(group, context, intervals, localMedia, {
    mediaFeaturePresent: Boolean(mediaFeature)
  });
}

function renderMediaWallSegment(group, context, interval, localMedia, options = {}) {
  const { height, depth, materials } = context;
  const [start, end] = interval;
  const width = end - start;
  if (width < 8) return;
  const baseHeight = height * 0.27;
  renderBaseStorage(group, {
    ...context,
    x: start,
    y: 0,
    width,
    height: baseHeight,
    storage: "doors"
  });

  const desiredMedia = localMedia || {
    min: { x: start + width * 0.29, y: height * 0.39, z: 0 },
    max: { x: start + width * 0.71, y: height * 0.72, z: depth }
  };
  const sideGap = Math.max(1.5, visualFrameThickness(width, height));
  const maximumScreenWidth = options.constrained
    ? Math.max(1, width - sideGap * 1.4)
    : width * 0.58;
  const minimumScreenWidth = Math.min(maximumScreenWidth, width * 0.28);
  const screenWidth = clamp(
    desiredMedia.max.x - desiredMedia.min.x,
    minimumScreenWidth,
    maximumScreenWidth
  );
  const screenHeight = clamp(
    desiredMedia.max.y - desiredMedia.min.y,
    Math.min(height * 0.2, screenWidth * 0.72),
    height * 0.42
  );
  const backdropHalfWidth = screenWidth / 2 + sideGap * 0.65;
  const screenX = clamp(
    (desiredMedia.min.x + desiredMedia.max.x) / 2,
    start + backdropHalfWidth,
    end - backdropHalfWidth
  );
  const screenY = clamp(
    (desiredMedia.min.y + desiredMedia.max.y) / 2,
    baseHeight + screenHeight / 2,
    height - screenHeight / 2
  );
  const leftWidth = Math.max(0, screenX - screenWidth / 2 - sideGap - start);
  const rightStart = screenX + screenWidth / 2 + sideGap;
  const rightWidth = Math.max(0, end - rightStart);
  const upperHeight = height - baseHeight;

  if (leftWidth > 3) {
    renderOpenCase(group, {
      ...context,
      x: start,
      y: baseHeight,
      width: leftWidth,
      height: upperHeight,
      includeBase: false
    });
  }
  if (rightWidth > 3) {
    renderOpenCase(group, {
      ...context,
      x: rightStart,
      y: baseHeight,
      width: rightWidth,
      height: upperHeight,
      includeBase: false
    });
  }

  addSceneBox(group, [screenWidth + sideGap * 1.3, screenHeight + sideGap * 1.3, Math.max(1, depth * 0.08)], [
    screenX,
    screenY,
    depth - Math.max(0.5, depth * 0.04)
  ], materials.back, { castShadow: false, receiveShadow: true });
  if (!options.mediaFeaturePresent) {
    addSceneBox(group, [screenWidth, screenHeight, 1.35], [
      screenX,
      screenY,
      -0.68
    ], materials.screen, { castShadow: true, receiveShadow: false, edgeMaterial: materials.screenEdge });
  }

  const bridgeBottom = screenY + screenHeight / 2 + sideGap;
  if (height - bridgeBottom > 4) {
    renderOpenCase(group, {
      ...context,
      x: Math.max(start, screenX - screenWidth / 2 - sideGap),
      y: bridgeBottom,
      width: Math.min(end, screenX + screenWidth / 2 + sideGap)
        - Math.max(start, screenX - screenWidth / 2 - sideGap),
      height: height - bridgeBottom,
      includeBase: true
    });
  }
  renderTopTreatment(group, { ...context, x: start, y: height, width, depth });
}

function selectMediaWidthInterval(intervals, localMedia, options = {}) {
  if (!intervals.length) return null;
  if (!localMedia) {
    if (!options.allowClosest) return null;
    return intervals
      .slice()
      .sort((first, second) => (second[1] - second[0]) - (first[1] - first[0]))[0];
  }
  const direct = intervals.find(([start, end]) => (
    localMedia.min.x >= start - 0.25 && localMedia.max.x <= end + 0.25
  ));
  if (direct) return direct;
  if (!options.allowClosest) return null;
  const center = (localMedia.min.x + localMedia.max.x) / 2;
  return intervals
    .filter(([start, end]) => end - start >= 12)
    .slice()
    .sort((first, second) => {
      const firstDistance = Math.abs(clamp(center, first[0], first[1]) - center);
      const secondDistance = Math.abs(clamp(center, second[0], second[1]) - center);
      if (firstDistance !== secondDistance) return firstDistance - secondDistance;
      return (second[1] - second[0]) - (first[1] - first[0]);
    })[0] || null;
}

function renderBookcaseInterval(group, context, interval) {
  const [start, end] = interval;
  const width = end - start;
  if (width < Math.min(context.width * 0.06, 4)) return;
  renderBookcaseBank(group, {
    ...context,
    x: start,
    width,
    style: "cabinet-base-shelves"
  });
}

function renderRaisedMediaLayout(group, context, intervals, localMedia, options = {}) {
  if (!localMedia) {
    intervals.forEach((interval) => renderBookcaseInterval(group, context, interval));
    return;
  }

  const sideGap = Math.max(1.5, visualFrameThickness(context.width, context.height));
  intervals.forEach((interval) => {
    subtractWidthInterval(
      [interval],
      localMedia.min.x - sideGap,
      localMedia.max.x + sideGap
    ).forEach((segment) => renderBookcaseInterval(group, context, segment));
  });

  const screenWidth = clamp(
    localMedia.max.x - localMedia.min.x,
    1,
    Math.max(1, context.width - sideGap * 1.3)
  );
  const screenHeight = clamp(
    localMedia.max.y - localMedia.min.y,
    1,
    context.height * 0.48
  );
  const screenX = clamp(
    (localMedia.min.x + localMedia.max.x) / 2,
    screenWidth / 2 + sideGap * 0.65,
    context.width - screenWidth / 2 - sideGap * 0.65
  );
  const screenY = clamp(
    (localMedia.min.y + localMedia.max.y) / 2,
    screenHeight / 2,
    context.height - screenHeight / 2
  );
  addSceneBox(
    group,
    [screenWidth + sideGap * 1.3, screenHeight + sideGap * 1.3, Math.max(1, context.depth * 0.08)],
    [screenX, screenY, context.depth - Math.max(0.5, context.depth * 0.04)],
    context.materials.back,
    { castShadow: false, receiveShadow: true }
  );
  if (!options.mediaFeaturePresent) {
    addSceneBox(group, [screenWidth, screenHeight, 1.35], [
      screenX,
      screenY,
      -0.68
    ], context.materials.screen, {
      castShadow: true,
      receiveShadow: false,
      edgeMaterial: context.materials.screenEdge
    });
  }

  const bridgeStart = Math.max(0, screenX - screenWidth / 2 - sideGap);
  const bridgeEnd = Math.min(context.width, screenX + screenWidth / 2 + sideGap);
  const bridgeBottom = screenY + screenHeight / 2 + sideGap;
  if (bridgeEnd - bridgeStart > 4 && context.height - bridgeBottom > 4) {
    renderOpenCase(group, {
      ...context,
      x: bridgeStart,
      y: bridgeBottom,
      width: bridgeEnd - bridgeStart,
      height: context.height - bridgeBottom,
      includeBase: true
    });
    renderTopTreatment(group, {
      ...context,
      x: bridgeStart,
      y: context.height,
      width: bridgeEnd - bridgeStart,
      depth: context.depth
    });
  }
}

function renderFloatingStorage(group, context) {
  const { height, depth } = context;
  getArchitecturalSafeWidthIntervals(context).forEach(([start, end]) => {
    const width = end - start;
    if (width < 8) return;
    renderFloatingStorageSegment(group, context, { start, width, height, depth });
  });
}

function renderFloatingStorageSegment(group, context, segment) {
  const { start, width, height, depth } = segment;
  const roleDefinesEnvelope = context.role === "below";
  const cabinetHeight = roleDefinesEnvelope ? height : height * 0.24;
  const cabinetY = roleDefinesEnvelope ? 0 : height * 0.31;
  const cabinetWidth = roleDefinesEnvelope ? width : width * 0.86;
  const cabinetX = start + (width - cabinetWidth) / 2;
  renderBaseStorage(group, {
    ...context,
    x: cabinetX,
    y: cabinetY,
    width: cabinetWidth,
    height: cabinetHeight,
    depth: Math.min(depth, Math.max(depth * 0.78, 6)),
    storage: "drawers",
    selection: {
      ...context.selection,
      details: {
        ...context.selection?.details,
        baseStyle: "floating"
      }
    }
  });
}

function renderWindowStorage(group, context) {
  if (context.role === "left" || context.role === "right" || context.role === "return") {
    getArchitecturalSafeWidthIntervals(context).forEach((interval) => (
      renderBookcaseInterval(group, context, interval)
    ));
    return;
  }
  if (context.role === "above") {
    getArchitecturalSafeWidthIntervals(context).forEach(([start, end]) => {
      if (end - start < 4) return;
      renderOpenCase(group, {
        ...context,
        x: start,
        y: 0,
        width: end - start,
        includeBase: true
      });
    });
    return;
  }

  const seatEnvelopeHeight = context.role === "below"
    ? context.height
    : context.height * 0.31;
  getArchitecturalSafeWidthIntervals(context).forEach(([start, end]) => {
    const width = end - start;
    if (width < 8) return;
    const topThickness = Math.min(
      seatEnvelopeHeight * 0.18,
      Math.max(1.25, seatEnvelopeHeight * 0.06)
    );
    const cabinetHeight = Math.max(1, seatEnvelopeHeight - topThickness);
    renderBaseStorage(group, {
      ...context,
      x: start,
      y: 0,
      width,
      height: cabinetHeight,
      storage: "doors"
    });
    addSceneBox(group, [
      width,
      topThickness,
      context.depth + Math.max(1, context.depth * 0.08)
    ], [
      start + width / 2,
      cabinetHeight + topThickness / 2,
      context.depth / 2 - Math.max(0.5, context.depth * 0.04)
    ], context.materials.accent, { edgeMaterial: context.materials.edge });
  });
}

function renderRadiatorCover(group, context) {
  const intervals = getArchitecturalSafeWidthIntervals(context, {
    ignore: ({ feature }) => /radiator/.test(getSemanticKind(feature))
  });
  const plannedRadiator = context.plan.room.features.find((feature) => (
    /radiator/.test(getSemanticKind(feature))
  ));
  if (plannedRadiator?.renderHidden) return;
  const radiator = context.exclusions.find(({ feature, localBounds }) => (
    /radiator/.test(getSemanticKind(feature)) && isBounds(localBounds)
  ));
  if (!radiator) {
    if (plannedRadiator) return;
    intervals.forEach((interval) => renderRadiatorCoverSegment(group, context, interval));
    return;
  }

  const targetCenter = (radiator.localBounds.min.x + radiator.localBounds.max.x) / 2;
  const selected = intervals
    .map((interval) => ({
      interval,
      distance: targetCenter < interval[0]
        ? interval[0] - targetCenter
        : targetCenter > interval[1]
          ? targetCenter - interval[1]
          : 0
    }))
    .sort((first, second) => (
      first.distance - second.distance
      || (second.interval[1] - second.interval[0]) - (first.interval[1] - first.interval[0])
      || first.interval[0] - second.interval[0]
    ))[0];
  if (selected) {
    renderRadiatorCoverSegment(group, context, selected.interval, radiator.localBounds);
  }
}

function renderRadiatorCoverSegment(group, context, interval, targetBounds = null) {
  const { height, depth, materials } = context;
  const [intervalStart, intervalEnd] = interval;
  const intervalWidth = intervalEnd - intervalStart;
  if (intervalWidth < 12) return;
  const coverHeight = context.role === "below" ? height : height * 0.38;
  const targetWidth = isBounds(targetBounds) ? getBoundsWidth(targetBounds) : null;
  const coverWidth = targetWidth !== null
    ? Math.min(intervalWidth, Math.max(12, targetWidth + ARCHITECTURAL_CLEARANCE * 2))
    : context.role === "primary"
      ? intervalWidth * 0.84
      : intervalWidth;
  const targetCenter = isBounds(targetBounds)
    ? (targetBounds.min.x + targetBounds.max.x) / 2
    : intervalStart + intervalWidth / 2;
  const startX = clamp(
    targetCenter - coverWidth / 2,
    intervalStart,
    intervalEnd - coverWidth
  );
  const frame = visualFrameThickness(coverWidth, coverHeight);

  addSceneBox(group, [coverWidth, frame, depth], [
    startX + coverWidth / 2,
    coverHeight - frame / 2,
    depth / 2
  ], materials.case, { edgeMaterial: materials.edge });
  addSceneBox(group, [frame, coverHeight, depth], [
    startX + frame / 2,
    coverHeight / 2,
    depth / 2
  ], materials.side, { edgeMaterial: materials.edge });
  addSceneBox(group, [frame, coverHeight, depth], [
    startX + coverWidth - frame / 2,
    coverHeight / 2,
    depth / 2
  ], materials.side, { edgeMaterial: materials.edge });
  addSceneBox(group, [coverWidth, frame, depth], [
    startX + coverWidth / 2,
    frame / 2,
    depth / 2
  ], materials.case, { edgeMaterial: materials.edge });

  const openingWidth = Math.max(1, coverWidth - frame * 2);
  const openingHeight = Math.max(1, coverHeight - frame * 2);
  addSceneBox(group, [
    openingWidth,
    openingHeight,
    Math.max(0.65, frame * 0.35)
  ], [
    startX + coverWidth / 2,
    coverHeight / 2,
    Math.max(frame, depth * 0.8)
  ], materials.reveal, { castShadow: false, receiveShadow: true });

  const slatCount = clamp(Math.round(openingWidth / Math.max(coverHeight * 0.11, 1)), 8, 24);
  const spacing = openingWidth / (slatCount + 1);
  for (let index = 1; index <= slatCount; index += 1) {
    addSceneBox(group, [
      Math.max(0.6, spacing * 0.38),
      openingHeight,
      Math.max(0.45, frame * 0.32)
    ], [
      startX + frame + spacing * index,
      coverHeight / 2,
      -Math.max(0.25, frame * 0.2)
    ], materials.front, { castShadow: true, receiveShadow: true });
  }

  addSceneBox(group, [
    coverWidth + frame * 0.8,
    frame * 0.72,
    depth + frame
  ], [
    startX + coverWidth / 2,
    coverHeight + frame * 0.35,
    depth / 2 - frame * 0.42
  ], materials.case, { edgeMaterial: materials.edge });
}

function createProductMaterials(selection) {
  const finish = selection?.finish || {};
  const baseColor = parseColor(finish.color, 0xb88e5e);
  const accentColor = parseColor(selection?.accentFinish?.color, baseColor);
  const isWood = finish.family === "wood";
  const finishMap = isWood ? createProceduralWoodTexture(finish.color) : null;
  if (finishMap) {
    finishMap.wrapS = THREE.RepeatWrapping;
    finishMap.wrapT = THREE.RepeatWrapping;
    finishMap.repeat.set(2, 5);
  }
  const hardwareAppearance = getGuidedHardwareAppearance(selection?.details?.hardware);
  const darker = new THREE.Color(baseColor).lerp(new THREE.Color(0x1d1915), 0.54).getHex();
  const insetColor = new THREE.Color(baseColor).lerp(new THREE.Color(0xf8f4ed), isWood ? 0.08 : 0.04).getHex();
  const lightingColor = selection?.details?.lighting === "integrated-led" ? 0xffe8be : 0xffcf91;

  const caseMaterial = new THREE.MeshStandardMaterial({
    color: finishMap ? 0xffffff : baseColor,
    map: finishMap,
    roughness: isWood ? 0.56 : 0.48,
    metalness: 0
  });

  return {
    case: caseMaterial,
    side: new THREE.MeshStandardMaterial({
      color: finishMap ? 0xf8f5f0 : baseColor,
      map: finishMap,
      roughness: isWood ? 0.58 : 0.5,
      metalness: 0
    }),
    back: new THREE.MeshStandardMaterial({
      color: insetColor,
      roughness: isWood ? 0.68 : 0.6,
      metalness: 0
    }),
    front: new THREE.MeshStandardMaterial({
      color: finishMap ? 0xffffff : baseColor,
      map: finishMap,
      roughness: isWood ? 0.52 : 0.45,
      metalness: 0
    }),
    inset: new THREE.MeshStandardMaterial({ color: insetColor, roughness: 0.68, metalness: 0 }),
    accent: new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.58, metalness: 0 }),
    reveal: new THREE.MeshStandardMaterial({ color: darker, roughness: 0.88, metalness: 0 }),
    toe: new THREE.MeshStandardMaterial({ color: 0x292621, roughness: 0.9, metalness: 0 }),
    hardware: new THREE.MeshStandardMaterial({
      color: hardwareAppearance.color,
      roughness: hardwareAppearance.roughness,
      metalness: hardwareAppearance.metalness
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xd5e2e3,
      roughness: 0.12,
      metalness: 0,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      transmission: 0.12,
      clearcoat: 0.64,
      clearcoatRoughness: 0.12
    }),
    led: new THREE.MeshStandardMaterial({
      color: lightingColor,
      emissive: lightingColor,
      emissiveIntensity: 2.2,
      roughness: 0.25,
      metalness: 0.05,
      toneMapped: false
    }),
    screen: new THREE.MeshStandardMaterial({
      color: 0x0d1012,
      roughness: 0.19,
      metalness: 0.14,
      emissive: 0x0b0e10,
      emissiveIntensity: 0.2
    }),
    edge: new THREE.LineBasicMaterial({
      color: darker,
      transparent: true,
      opacity: isWood ? 0.22 : 0.16
    }),
    screenEdge: new THREE.LineBasicMaterial({ color: 0x4c5052, transparent: true, opacity: 0.34 })
  };
}

function createProceduralWoodTexture(rawColor) {
  const canvas = globalThis.document?.createElement?.("canvas");
  if (!canvas) return null;
  canvas.width = 128;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) return null;
  const base = normalizeCssColor(rawColor, "#b88e5e");
  context.fillStyle = base;
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let x = -8; x < canvas.width + 8; x += 7) {
    const phase = (x * 0.37) % (Math.PI * 2);
    context.beginPath();
    for (let y = 0; y <= canvas.height; y += 4) {
      const drift = Math.sin(y * 0.045 + phase) * 2.1 + Math.sin(y * 0.013 + phase * 0.6) * 3.4;
      if (y === 0) context.moveTo(x + drift, y);
      else context.lineTo(x + drift, y);
    }
    context.strokeStyle = x % 14
      ? "rgba(68, 39, 20, 0.105)"
      : "rgba(255, 247, 231, 0.085)";
    context.lineWidth = x % 14 ? 0.75 : 1.1;
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function getGuidedHardwareAppearance(hardwareId) {
  if (hardwareId === "black-pull") {
    return { color: 0x202224, roughness: 0.46, metalness: 0.62 };
  }
  if (hardwareId === "brass-pull") {
    return { color: 0xb48a42, roughness: 0.3, metalness: 0.86 };
  }
  return { color: 0x393633, roughness: 0.38, metalness: 0.72 };
}

function addProductLight(group, position, lightingId) {
  const conceptRoot = findConceptRoot(group);
  conceptRoot.userData.productLightCount = Number(conceptRoot.userData.productLightCount) || 0;
  if (conceptRoot.userData.productLightCount >= 8) return;
  const color = lightingId === "integrated-led" ? 0xffe8bf : 0xffcf91;
  const light = new THREE.PointLight(color, 0.36, toSceneLength(30), 1.7);
  light.position.set(...position.map(toSceneLength));
  light.castShadow = false;
  group.add(light);
  conceptRoot.userData.productLightCount += 1;
}

function findConceptRoot(object) {
  let current = object;
  while (current.parent && current.parent.userData?.scenePurpose === CONCEPT_SCENE_PURPOSE) {
    current = current.parent;
  }
  return current;
}

function createZoneRoot(zone) {
  const widthAxis = normalizedAxis(zone.frame?.widthAxis, new THREE.Vector3(1, 0, 0));
  const heightAxis = normalizedAxis(zone.frame?.heightAxis, new THREE.Vector3(0, 1, 0));
  const depthAxis = normalizedAxis(zone.frame?.depthAxis, new THREE.Vector3(0, 0, 1));
  const origin = isPoint(zone.frame?.origin)
    ? zone.frame.origin
    : zone.bounds.min;

  const matrix = new THREE.Matrix4().makeBasis(widthAxis, heightAxis, depthAxis);
  const root = new THREE.Group();
  root.quaternion.setFromRotationMatrix(matrix);
  root.position.copy(pointToScene(origin));
  return root;
}

function normalizedAxis(candidate, fallback) {
  if (!isPoint(candidate)) return fallback.clone();
  const vector = new THREE.Vector3(candidate.x, candidate.y, candidate.z);
  return vector.lengthSq() > 1e-8 ? vector.normalize() : fallback.clone();
}

function getZoneWidth(zone) {
  return getZoneAxisSpan(
    zone,
    zone.frame?.widthAxis,
    positiveFinite(zone.size?.width, getBoundsWidth(zone.bounds))
  );
}

function getZoneHeight(zone) {
  return getZoneAxisSpan(
    zone,
    zone.frame?.heightAxis,
    positiveFinite(zone.size?.height, getBoundsHeight(zone.bounds))
  );
}

function getZoneDepth(zone) {
  return getZoneAxisSpan(
    zone,
    zone.frame?.depthAxis,
    positiveFinite(zone.size?.depth, Math.max(1, getBoundsDepth(zone.bounds)))
  );
}

function getZoneAxisSpan(zone, axisCandidate, fallback) {
  if (!isBounds(zone?.bounds) || !isPoint(axisCandidate)) return fallback;
  const axis = normalizedAxis(axisCandidate, new THREE.Vector3(1, 0, 0));
  const projections = getBoundsCorners(zone.bounds).map((corner) => corner.dot(axis));
  const span = Math.max(...projections) - Math.min(...projections);
  return positiveFinite(span, fallback);
}

function resolveZoneExclusions(zone, featuresById, roomFeatures = [], plan = {}) {
  const declared = (Array.isArray(zone.excludes) ? zone.excludes : [])
    .map((reference) => {
      if (typeof reference === "string") return featuresById.get(reference) || null;
      if (reference?.id && featuresById.has(reference.id)) return featuresById.get(reference.id);
      if (isBounds(reference?.bounds)) return reference;
      if (isBounds(reference)) return { id: null, kind: "exclusion", bounds: reference };
      return null;
    })
    .filter(Boolean);
  const implicitArchitectural = roomFeatures.filter((feature) => (
    isBounds(feature?.bounds)
    && isProductObstacleFeature(feature, { selection: plan.selection })
    && boundsIntersect(getFeatureExclusionBounds(feature, plan), zone.bounds)
  ));
  const unique = [];
  const seen = new Set();
  [...declared, ...implicitArchitectural].forEach((feature) => {
    const identity = feature.id || feature;
    if (seen.has(identity)) return;
    seen.add(identity);
    unique.push(feature);
  });

  return unique
    .map((feature) => {
      const exclusionBounds = getFeatureExclusionBounds(feature, plan);
      if (!isBounds(exclusionBounds)) {
        return { feature, exclusionBounds: null, localBounds: null };
      }
      return {
        feature,
        exclusionBounds,
        localBounds: projectBoundsIntoZone(zone, exclusionBounds)
      };
    })
    .filter(({ localBounds }) => isBounds(localBounds));
}

function projectBoundsIntoZone(zone, bounds) {
  const origin = isPoint(zone.frame?.origin) ? zone.frame.origin : zone.bounds.min;
  const widthAxis = normalizedAxis(zone.frame?.widthAxis, new THREE.Vector3(1, 0, 0));
  const heightAxis = normalizedAxis(zone.frame?.heightAxis, new THREE.Vector3(0, 1, 0));
  const depthAxis = normalizedAxis(zone.frame?.depthAxis, new THREE.Vector3(0, 0, 1));
  const localMin = new THREE.Vector3(Infinity, Infinity, Infinity);
  const localMax = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  const originVector = new THREE.Vector3(origin.x, origin.y, origin.z);

  getBoundsCorners(bounds).forEach((corner) => {
    const relative = corner.sub(originVector);
    const local = new THREE.Vector3(
      relative.dot(widthAxis),
      relative.dot(heightAxis),
      relative.dot(depthAxis)
    );
    localMin.min(local);
    localMax.max(local);
  });

  return createBounds(
    { x: localMin.x, y: localMin.y, z: localMin.z },
    { x: localMax.x, y: localMax.y, z: localMax.z }
  );
}

function getRenderableWidthIntervals(context) {
  let intervals = [[0, context.width]];
  const tallExclusions = context.exclusions.filter(({ localBounds }) => {
    const overlapBottom = Math.max(0, localBounds.min.y);
    const overlapTop = Math.min(context.height, localBounds.max.y);
    return overlapTop - overlapBottom > context.height * 0.24;
  });

  tallExclusions.forEach(({ localBounds, feature }) => {
    const clearance = isProductObstacleFeature(feature, context)
      ? ARCHITECTURAL_CLEARANCE
      : 0;
    const exclusionStart = clamp(localBounds.min.x - clearance, 0, context.width);
    const exclusionEnd = clamp(localBounds.max.x + clearance, 0, context.width);
    if (exclusionEnd <= exclusionStart) return;
    intervals = subtractWidthInterval(intervals, exclusionStart, exclusionEnd);
  });
  return intervals;
}

function getArchitecturalSafeWidthIntervals(context, options = {}) {
  let intervals = [[0, context.width]];
  context.exclusions
    .filter((exclusion) => (
      isProductObstacleFeature(exclusion.feature, context)
      && !(typeof options.ignore === "function" && options.ignore(exclusion))
    ))
    .filter(({ localBounds }) => rangesOverlap(
      0,
      context.height,
      localBounds.min.y,
      localBounds.max.y
    ))
    .forEach(({ localBounds }) => {
      intervals = subtractWidthInterval(
        intervals,
        clamp(localBounds.min.x - ARCHITECTURAL_CLEARANCE, 0, context.width),
        clamp(localBounds.max.x + ARCHITECTURAL_CLEARANCE, 0, context.width)
      );
    });
  return intervals;
}

function findZoneFeature(context, matcher) {
  const excludedMatch = context.exclusions.find(({ feature }) => (
    !feature.renderHidden && matcher.test(getSemanticKind(feature))
  ));
  if (excludedMatch) return excludedMatch.feature;
  return context.plan.room.features.find((feature) => (
    !feature.renderHidden && matcher.test(getSemanticKind(feature))
  )) || null;
}

function visualFrameThickness(width, height) {
  return clamp(Math.min(width, height) * 0.023, 1.15, 2.5);
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
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(
    toSceneLength(centerInches[0]),
    toSceneLength(centerInches[1]),
    toSceneLength(centerInches[2])
  );
  mesh.castShadow = options.castShadow !== false;
  mesh.receiveShadow = options.receiveShadow !== false;
  mesh.userData.scenePurpose = options.scenePurpose || CONCEPT_SCENE_PURPOSE;
  parent.add(mesh);

  if (options.edgeMaterial) {
    const edgeGeometry = new THREE.EdgesGeometry(geometry, 30);
    const edges = new THREE.LineSegments(edgeGeometry, options.edgeMaterial);
    edges.position.copy(mesh.position);
    edges.userData.nonPhysicalHelper = true;
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
  textures.forEach((texture) => texture.dispose?.());
  materials.forEach((material) => material.dispose?.());
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
