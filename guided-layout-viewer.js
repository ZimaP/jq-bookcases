import * as THREE from "three";
import { GLTFLoader } from "./assets/vendor/three-addons/loaders/GLTFLoader.js";
import { RGBELoader } from "./assets/vendor/three-addons/loaders/RGBELoader.js";
import { RectAreaLightUniformsLib } from "./assets/vendor/three-addons/lights/RectAreaLightUniformsLib.js";
import {
  ROOM2_APPEARANCE_PROFILE,
  resolveRoom2Finish,
  resolveRoom2Presentation
} from "./guided-room2-appearance.js?v=room2-commercial-pbr-v1-20260817g";
import { createRoom2MaterialSystem } from "./guided-room2-materials.js?v=room2-commercial-pbr-v1-20260817g";
import { inspectRoom2Glb, sha256Bytes } from "./guided-room2-integrity.js?v=room2-commercial-pbr-v1-20260817g";
import {
  getImmersiveLayout,
  getSmartDimensionDefaults,
  millimetersToInches,
  normalizeSmartDimension
} from "./guided-layout-registry.js?v=immersive-layout-configurator-v1";
import { getImmersiveMaterialZone } from "./guided-layout-material-zones.generated.js?v=immersive-layout-configurator-v1";

const CONTROL_ID = "adjustable-shelf-clearance";
const MAX_PIXEL_RATIO = 2;
const MAX_DRAW_CALLS = 250;
const DRAW_CALL_HEADROOM = 5;
const ROOM_SHELL_CAMERA_CLEARANCE_METERS = 0.1;
const WEBGPU_DIRECTIONAL_SHADOWS_DISABLED = "WebGPU directional shadows disabled pending renderer fix.";
const CAMERA_LIMITS = Object.freeze({
  minimumTheta: -0.52,
  maximumTheta: 0.52,
  minimumPhi: -0.05,
  maximumPhi: 0.72,
  minimumRadius: 2.8,
  maximumRadius: 24
});
const TEXTURE_SLOTS = Object.freeze([
  "map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap",
  "alphaMap", "bumpMap", "displacementMap", "lightMap"
]);

let instanceSequence = 0;
let rectAreaUniformsInitialized = false;

export function createGuidedLayoutViewerController(options = {}) {
  return new GuidedLayoutViewerController(options);
}

export class GuidedLayoutViewerController {
  constructor(options = {}) {
    this.instanceId = ++instanceSequence;
    this.onStateChange = typeof options.onStateChange === "function" ? options.onStateChange : () => {};
    this.onDimensionChange = typeof options.onDimensionChange === "function" ? options.onDimensionChange : () => {};
    this.onDimensionEditRequest = typeof options.onDimensionEditRequest === "function"
      ? options.onDimensionEditRequest
      : () => {};
    this.disposed = false;
    this.state = "idle";
    this.mountTarget = null;
    this.runtime = null;
    this.canvas = null;
    this.status = null;
    this.statusProgress = null;
    this.retryButton = null;
    this.dimensionSvg = null;
    this.dimensionLine = null;
    this.dimensionExtensionLower = null;
    this.dimensionExtensionUpper = null;
    this.dimensionLabel = null;
    this.dimensionHandle = null;
    this.renderer = null;
    this.rendererInitializationPromise = null;
    this.rendererInitializationSequence = 0;
    this.rendererBackend = null;
    this.rendererFallbackReason = null;
    this.forceWebGL2AfterFailure = false;
    this.rendererRenderFailureCount = 0;
    this.presentation = resolveRoom2Presentation();
    this.scene = null;
    this.camera = null;
    this.modelRoot = null;
    this.gltf = null;
    this.glbInspection = null;
    this.materialSystem = null;
    this.directLights = new Map();
    this.shadowCaster = null;
    this.shadowTier = null;
    this.shadowRenderingEnabled = false;
    this.environmentTexture = null;
    this.environmentLoadPromise = null;
    this.environmentAbortController = null;
    this.environmentSequence = 0;
    this.environmentSha256 = null;
    this.environmentRequestCount = 0;
    this.environmentSuccessfulRequestCount = 0;
    this.environmentAssignmentCount = 0;
    this.environmentPmremMode = null;
    this.layout = null;
    this.layoutId = null;
    this.finishId = null;
    this.requestedFinishId = null;
    this.appliedFinishId = null;
    this.showDimensions = true;
    this.smartDimensions = {};
    this.targetNode = null;
    this.lowerAnchorNode = null;
    this.upperAnchorNode = null;
    this.nativeTargetTransform = null;
    this.nativeNodeTransforms = new Map();
    this.nativeNodeWorldMatrices = new Map();
    this.targetDescendantNodeIndices = new Set();
    this.hardwareNodeIndices = new Set();
    this.nativeTargetCollisionDepths = new Map();
    this.nativeDegenerateTriangleCount = null;
    this.currentDegenerateTriangleCount = null;
    this.nativeModelBounds = null;
    this.nativeTargetBounds = null;
    this.nativeLowerAnchorBounds = null;
    this.nativeUpperAnchorBounds = null;
    this.geometryContentImmutable = true;
    this.meshRecords = [];
    this.zoneStatusCounts = {};
    this.shadowPrimitiveBudget = null;
    this.geometryLedger = [];
    this.premiumOwnedGeometries = new Set();
    this.ownedMaterials = new Set();
    this.ownedTextures = new Set();
    this.sourceMaterials = new Set();
    this.sourceTextures = new Set();
    this.finishTextureCache = new Map();
    this.activePointers = new Map();
    this.pointerOrbit = null;
    this.pinchState = null;
    this.dimensionDrag = null;
    this.suppressDimensionClick = false;
    this.cameraTarget = new THREE.Vector3();
    this.theta = 0;
    this.phi = 0.115;
    this.radius = 6;
    this.userAdjustedCamera = false;
    this.cameraStateByLayout = new Map();
    this.resizeObserver = null;
    this.resizeFallbackController = null;
    this.controlAbortController = null;
    this.fetchAbortController = null;
    this.loadSequence = 0;
    this.activeLoadPromise = null;
    this.loadingLayoutId = null;
    this.finishSequence = 0;
    this.renderFrame = null;
    this.renderPromise = null;
    this.renderPending = false;
    this.renderGeneration = 0;
    this.cameraAnimationFrame = null;
    this.animationStartedAt = 0;
    this.animationFrom = null;
    this.animationTo = null;
    this.loadStartedAt = null;
    this.firstUsableAt = null;
    this.requestCount = 0;
    this.successfulRequestCount = 0;
    this.parseCount = 0;
    this.renderCount = 0;
    this.lastDrawCalls = 0;
    this.lastTriangleCount = 0;
    this.dimensionApplyCount = 0;
    this.dimensionResetCount = 0;
    this.cameraRefitCount = 0;
    this.layoutSwitchCount = 0;
    this.geometryMutationCount = 0;
    this.resourceDisposalCount = 0;
    this.lastFrameMilliseconds = null;
    this.lastError = null;
    this.assetSha256 = null;
    this.assetBytes = 0;
    const proofHost = globalThis.location?.hostname || "";
    const proofQuery = new URLSearchParams(globalThis.location?.search || "");
    this.zoneProofMode = ["localhost", "127.0.0.1", "::1"].includes(proofHost)
      && proofQuery.get("zoneProof") === "1";
    this.premiumModelV1Enabled = !this.zoneProofMode
      && proofQuery.get("modelQuality") === "premium-v1";
    this.premiumModelV1ModulePromise = null;
    this.premiumModelV1Diagnostics = null;
    const localTestHooks = ["localhost", "127.0.0.1", "::1"].includes(proofHost)
      ? globalThis.__JQ_IMMERSIVE_VIEWER_TEST_HOOKS__
      : null;
    this.testRenderFailureMode = ["first", "late"].includes(localTestHooks?.renderFailureMode)
      ? localTestHooks.renderFailureMode
      : null;
    this.testRenderFailureInjected = false;
    this.prefersReducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
  }

  mount(target) {
    if (this.disposed || !target) return false;
    if (this.mountTarget === target && this.runtime?.isConnected) return true;
    if (this.runtime) {
      this.resizeObserver?.disconnect();
      this.resizeObserver = null;
      this.resizeFallbackController?.abort();
      this.resizeFallbackController = null;
      target.replaceChildren(this.runtime);
      this.mountTarget = target;
      this.observeResize();
      this.resize();
      return true;
    }
    this.mountTarget = target;
    this.createRuntime();
    this.observeResize();
    this.bindControls();
    return true;
  }

  unmount() {
    this.rememberCameraState();
    const teardownSequence = ++this.loadSequence;
    this.renderGeneration += 1;
    this.finishSequence += 1;
    this.cancelCameraAnimation();
    this.cancelRender();
    this.fetchAbortController?.abort();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.resizeFallbackController?.abort();
    this.resizeFallbackController = null;
    this.activePointers.clear();
    this.pointerOrbit = null;
    this.pinchState = null;
    this.dimensionDrag = null;
    this.suppressDimensionClick = false;
    this.dimensionHandle?.classList.remove("is-active");
    this.runtime?.remove();
    this.mountTarget = null;
    void this.waitForRenderIdle().then(() => {
      if (this.disposed || this.mountTarget || teardownSequence !== this.loadSequence) return;
      this.disposeModel();
    });
  }

  async update(project, options = {}) {
    if (this.disposed) return false;
    const nextShowDimensions = options.showDimensions !== false;
    const dimensionVisibilityChanged = nextShowDimensions !== this.showDimensions;
    this.showDimensions = nextShowDimensions;
    if (!this.showDimensions) {
      this.dimensionDrag = null;
      this.suppressDimensionClick = false;
      this.dimensionHandle?.classList.remove("is-active");
    }
    const layoutId = project?.layout;
    const layoutRecord = getImmersiveLayout(layoutId);
    if (!layoutRecord) {
      this.fail(codedError("LAYOUT_NOT_REGISTERED", "The selected layout has no audited model registry record."));
      return false;
    }
    const layoutState = project?.layoutStates?.[layoutId] || {};
    const defaults = getSmartDimensionDefaults(layoutId);
    const nextDimensions = {
      ...defaults,
      ...(layoutState.smartDimensions || {})
    };
    const nextFinishId = resolveRoom2Finish(project.finish).id;
    const layoutChanged = layoutId !== this.layoutId;
    const finishPreviewAvailable = this.premiumModelV1Enabled
      || (layoutRecord.appearanceManifest?.provenMeshIndices?.length || 0) > 0;
    const finishChanged = finishPreviewAvailable && nextFinishId !== this.appliedFinishId;
    const dimensionsChanged = Object.entries(nextDimensions).some(([key, value]) => this.smartDimensions[key] !== value);
    this.requestedFinishId = nextFinishId;
    this.finishId = nextFinishId;
    this.smartDimensions = nextDimensions;
    if (layoutChanged) {
      this.rememberCameraState();
      this.layoutSwitchCount += this.layoutId ? 1 : 0;
      this.layoutId = layoutId;
      this.layout = layoutRecord;
      return this.runtime ? this.loadLayout(layoutId) : false;
    }
    if (!this.modelRoot) {
      if (this.runtime) await this.loadLayout(layoutId);
      return Boolean(this.modelRoot);
    }
    if (dimensionsChanged) {
      this.applySmartDimensions();
      this.fitCamera({ preserveOrientation: true, animate: options.animate !== false });
    }
    if (finishChanged) {
      const finishRequestId = this.requestedFinishId;
      const expectedFinishSequence = this.finishSequence + 1;
      try {
        const applied = await this.applyFinish(finishRequestId);
        const superseded = this.finishSequence !== expectedFinishSequence
          || this.requestedFinishId !== finishRequestId
          || this.layoutId !== layoutId;
        if (!applied && !superseded) {
          throw codedError("FINISH_LOAD_FAILED", "The selected Finish was not applied; select it again to retry.");
        }
      } catch (error) {
        const superseded = this.finishSequence !== expectedFinishSequence
          || this.requestedFinishId !== finishRequestId
          || this.layoutId !== layoutId;
        if (!superseded) {
          this.lastError = error;
          this.notify("finish-error", { layoutId, code: error.code || "FINISH_LOAD_FAILED", message: error.message });
        }
      }
    }
    if (dimensionVisibilityChanged) this.updateDimensionOverlay();
    this.scheduleRender();
    this.syncDiagnostics();
    return true;
  }

  async retry() {
    if (!this.layoutId || this.disposed) return false;
    this.status?.focus({ preventScroll: true });
    return this.loadLayout(this.layoutId, { force: true });
  }

  loadLayout(layoutId, options = {}) {
    if (!options.force && this.activeLoadPromise && this.loadingLayoutId === layoutId) {
      return this.activeLoadPromise;
    }
    const promise = this.performLayoutLoad(layoutId, options);
    this.activeLoadPromise = promise;
    this.loadingLayoutId = layoutId;
    void promise.finally(() => {
      if (this.activeLoadPromise !== promise) return;
      this.activeLoadPromise = null;
      this.loadingLayoutId = null;
    });
    return promise;
  }

  async performLayoutLoad(layoutId, options = {}) {
    const layoutRecord = getImmersiveLayout(layoutId);
    if (!layoutRecord || this.disposed || !this.runtime) return false;
    const sequence = ++this.loadSequence;
    this.renderGeneration += 1;
    this.finishSequence += 1;
    this.cancelCameraAnimation();
    this.cancelRender();
    this.state = "loading";
    this.lastError = null;
    if (!options.preserveJourneyStart || !Number.isFinite(this.loadStartedAt)) {
      this.loadStartedAt = performance.now();
    }
    this.firstUsableAt = null;
    this.assetSha256 = null;
    this.assetBytes = 0;
    this.showStatus("Loading model", `Preparing ${layoutRecord.label}…`, { progress: 0 });
    this.notify("loading", { layoutId, label: layoutRecord.label, progress: 0 });
    await this.waitForRenderIdle();
    if (sequence !== this.loadSequence || this.disposed) return false;
    this.disposeModel();
    this.fetchAbortController = new AbortController();

    let pendingMaterialSystem = null;
    let preparedFinishId = null;
    let initialFinishError = null;
    try {
      const rendererReady = await this.ensureRenderer();
      if (sequence !== this.loadSequence || this.disposed) return false;
      if (!rendererReady || !this.renderer || !this.scene || !this.camera) {
        throw codedError("RENDERER_INITIALIZATION_FAILED", "No supported renderer could be initialized.");
      }
      this.configureAppearanceForLayout();
      const [bytes, environmentReady] = await Promise.all([
        this.fetchVerifiedAsset(layoutRecord, this.fetchAbortController.signal, (progress) => {
          if (sequence !== this.loadSequence || this.disposed) return;
          this.showStatus("Loading model", `${layoutRecord.label} · ${Math.round(progress * 100)}%`, { progress });
          this.notify("loading", { layoutId, label: layoutRecord.label, progress });
        }),
        this.ensureStudioEnvironment()
      ]);
      if (!environmentReady) throw codedError("ENVIRONMENT_NOT_READY", "The verified studio environment did not become ready.");
      if (sequence !== this.loadSequence || this.disposed) return false;
      this.showStatus("Building scene", `Parsing ${layoutRecord.label}…`, { progress: 0.94 });
      const glbInspection = inspectRoom2Glb(bytes);
      this.glbInspection = glbInspection;
      this.validateSourceInspection();
      if (layoutId === "fireplace-wall") {
        pendingMaterialSystem = createRoom2MaterialSystem({
          THREE,
          renderer: this.renderer,
          viewportWidth: this.runtime.getBoundingClientRect().width,
          notifyState: (state, details) => {
            if (sequence !== this.loadSequence || this.disposed) return;
            if (this.state === "loading" && state === "ready") return;
            this.notify(state, details);
          },
          requestRender: () => {
            if (sequence === this.loadSequence && !this.disposed) this.scheduleRender();
          }
        });
        while (sequence === this.loadSequence && !this.disposed) {
          preparedFinishId = this.requestedFinishId;
          try {
            await pendingMaterialSystem.prepareInitialFinish(preparedFinishId);
          } catch (error) {
            if (preparedFinishId !== this.requestedFinishId) continue;
            throw error;
          }
          break;
        }
        if (sequence !== this.loadSequence || this.disposed) {
          pendingMaterialSystem.dispose();
          pendingMaterialSystem = null;
          return false;
        }
      }
      const basePath = new URL(layoutRecord.runtimeAsset.path, document.baseURI).href.replace(/[^/]+$/, "");
      const gltf = await new GLTFLoader().parseAsync(bytes, basePath);
      this.parseCount += 1;
      if (sequence !== this.loadSequence || this.disposed) {
        pendingMaterialSystem?.dispose?.();
        pendingMaterialSystem = null;
        disposeObjectGraph(gltf?.scene);
        return false;
      }
      this.gltf = gltf;
      this.materialSystem = pendingMaterialSystem;
      pendingMaterialSystem = null;
      this.modelRoot = this.gltf.scene;
      this.scene.add(this.modelRoot);
      this.captureRuntimeRecords();
      this.applySmartDimensions();
      if (this.materialSystem) {
        const preparedFinishId = this.materialSystem.pendingFinishId || this.requestedFinishId;
        const materialDiagnostics = await this.materialSystem.bindModel(gltf, glbInspection.json, preparedFinishId);
        if (sequence !== this.loadSequence || this.disposed) return false;
        this.appliedFinishId = materialDiagnostics.selectedFinishId || null;
        const reconciliation = await this.reconcileRequestedFinishForLoad(layoutId, sequence, preparedFinishId);
        if (!reconciliation.completed) return false;
        initialFinishError = reconciliation.error;
      } else if ((layoutRecord.appearanceManifest?.provenMeshIndices?.length || 0) > 0) {
        const reconciliation = await this.reconcileRequestedFinishForLoad(layoutId, sequence);
        if (!reconciliation.completed) return false;
        initialFinishError = reconciliation.error;
      } else {
        this.appliedFinishId = this.requestedFinishId;
      }
      if (sequence !== this.loadSequence || this.disposed) return false;
      if (this.zoneProofMode) this.applyZoneProofMaterials();
      this.enforceShadowDrawCallBudget();
      if (this.premiumModelV1Enabled) {
        await this.applyPremiumModelV1Presentation();
        if (sequence !== this.loadSequence || this.disposed) return false;
      }
      this.restoreOrResetCamera();
      let rendered;
      try {
        rendered = await this.renderNow();
      } catch (error) {
        if (this.rendererBackend === "webgpu" && !this.forceWebGL2AfterFailure) {
          return this.fallbackFromWebGpuRenderFailure(error);
        }
        throw error;
      }
      if (!rendered || sequence !== this.loadSequence || this.disposed) return false;
      this.state = "ready";
      this.hideStatus();
      this.firstUsableAt = performance.now();
      this.updateDimensionOverlay();
      this.notify("ready", {
        layoutId,
        label: layoutRecord.label,
        backend: this.rendererBackend,
        firstUsableMilliseconds: this.firstUsableAt - this.loadStartedAt
      });
      if (initialFinishError) {
        this.notify("finish-error", {
          layoutId,
          code: initialFinishError.code || "FINISH_LOAD_FAILED",
          message: initialFinishError.message
        });
      }
      this.syncDiagnostics();
      return true;
    } catch (error) {
      pendingMaterialSystem?.dispose?.();
      if (error?.name === "AbortError" || sequence !== this.loadSequence || this.disposed) return false;
      this.fail(error);
      return false;
    }
  }

  async ensureRenderer() {
    if (this.renderer) return true;
    if (this.rendererInitializationPromise) return this.rendererInitializationPromise;
    const sequence = ++this.rendererInitializationSequence;
    const promise = this.initializeRenderer(sequence);
    this.rendererInitializationPromise = promise;
    try {
      return await promise;
    } finally {
      if (this.rendererInitializationPromise === promise) this.rendererInitializationPromise = null;
    }
  }

  async initializeRenderer(sequence) {
    if (this.disposed || !this.canvas) return false;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(ROOM2_APPEARANCE_PROFILE.renderer.clearColor);
    const camera = new THREE.PerspectiveCamera(39, 1, 0.05, 80);

    const preference = new URLSearchParams(location.search).get("renderer");
    const explicitlyForcedWebGL2 = preference === "webgl2";
    const forceWebGL2 = explicitlyForcedWebGL2 || this.forceWebGL2AfterFailure;
    let selectedRenderer = null;
    let selectedBackend = null;
    if (!forceWebGL2 && navigator.gpu) {
      let attemptedRenderer = null;
      try {
        const { default: WebGPURenderer } = await import("./assets/vendor/three-webgpu-renderer-r166.bundle.js?v=immersive-v1");
        if (this.disposed || sequence !== this.rendererInitializationSequence || !this.canvas) return false;
        const renderer = new WebGPURenderer({ canvas: this.canvas, antialias: true, alpha: false });
        attemptedRenderer = renderer;
        await renderer.init();
        if (renderer.backend?.isWebGPUBackend !== true) {
          throw codedError("WEBGPU_ADAPTER_UNAVAILABLE", "WebGPU did not initialize a real WebGPU backend.");
        }
        renderer.setPixelRatio(Math.min(devicePixelRatio || 1, MAX_PIXEL_RATIO));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        configureRendererAppearance(renderer, this.presentation, { shadowsEnabled: false });
        if (this.disposed || sequence !== this.rendererInitializationSequence) {
          safeDisposeRenderer(renderer);
          return false;
        }
        selectedRenderer = renderer;
        selectedBackend = "webgpu";
      } catch (error) {
        safeDisposeRenderer(attemptedRenderer);
        if (this.disposed || sequence !== this.rendererInitializationSequence || !this.canvas) return false;
        this.rendererFallbackReason = `WebGPU initialization failed: ${error?.message || "unknown error"}`;
        const replacement = this.canvas.cloneNode(false);
        this.canvas.replaceWith(replacement);
        this.canvas = replacement;
        this.bindControls();
      }
    }
    if (!selectedRenderer) {
      if (this.disposed || sequence !== this.rendererInitializationSequence || !this.canvas) return false;
      const renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, MAX_PIXEL_RATIO));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      configureRendererAppearance(renderer, this.presentation, {
        shadowsEnabled: ROOM2_APPEARANCE_PROFILE.renderer.shadows.enabled
      });
      selectedRenderer = renderer;
      selectedBackend = "webgl2";
      if (!forceWebGL2 && !navigator.gpu) this.rendererFallbackReason = "WebGPU unavailable; using supported WebGL2 fallback.";
      if (explicitlyForcedWebGL2) this.rendererFallbackReason = "WebGL2 explicitly forced for backend validation.";
    }
    if (this.disposed || sequence !== this.rendererInitializationSequence) {
      safeDisposeRenderer(selectedRenderer);
      return false;
    }
    this.scene = scene;
    this.camera = camera;
    this.renderer = selectedRenderer;
    this.rendererBackend = selectedBackend;
    this.shadowRenderingEnabled = selectedBackend !== "webgpu"
      && ROOM2_APPEARANCE_PROFILE.renderer.shadows.enabled;
    this.setupAppearance();
    this.resize();
    return true;
  }

  setupAppearance() {
    if (!rectAreaUniformsInitialized) {
      RectAreaLightUniformsLib.init();
      rectAreaUniformsInitialized = true;
    }
    const profile = ROOM2_APPEARANCE_PROFILE.lighting;
    const keyArea = new THREE.RectAreaLight(
      profile.key.area.color,
      profile.key.area.intensity * this.presentation.areaKeyScale,
      profile.key.area.width,
      profile.key.area.height
    );
    keyArea.name = "immersive-commercial-key-area";
    const shadowProxy = new THREE.DirectionalLight(
      profile.key.shadowProxy.color,
      profile.key.shadowProxy.intensity * this.presentation.shadowProxyScale
    );
    shadowProxy.name = "immersive-commercial-key-shadow-proxy";
    shadowProxy.castShadow = this.shadowRenderingEnabled;
    shadowProxy.shadow.bias = profile.shadows.bias;
    shadowProxy.shadow.normalBias = profile.shadows.normalBias;
    const fillArea = new THREE.RectAreaLight(
      profile.fill.area.color,
      profile.fill.area.intensity * this.presentation.areaFillScale,
      profile.fill.area.width,
      profile.fill.area.height
    );
    fillArea.name = "immersive-commercial-fill-area";
    const separationArea = new THREE.RectAreaLight(
      profile.separation.area.color,
      profile.separation.area.intensity * this.presentation.areaSeparationScale,
      profile.separation.area.width,
      profile.separation.area.height
    );
    separationArea.name = "immersive-commercial-separation-area";
    this.scene.add(keyArea, shadowProxy, shadowProxy.target, fillArea, separationArea);
    this.directLights.set("key-area", keyArea);
    this.directLights.set("key-shadow-proxy", shadowProxy);
    this.directLights.set("fill-area", fillArea);
    this.directLights.set("separation-area", separationArea);
    this.shadowCaster = shadowProxy;
    this.configureAppearanceForLayout();
  }

  configureAppearanceForLayout() {
    if (!this.layout || !this.directLights.size) return;
    const target = new THREE.Vector3(...this.layout.orbitTarget);
    const profileTarget = new THREE.Vector3(...ROOM2_APPEARANCE_PROFILE.bounds.hero.center);
    const offset = target.clone().sub(profileTarget);
    const definitions = ROOM2_APPEARANCE_PROFILE.lighting;
    const position = (light, values) => {
      light.position.fromArray(values).add(offset);
      if (light.isRectAreaLight) light.lookAt(target);
    };
    position(this.directLights.get("key-area"), definitions.key.area.position);
    position(this.shadowCaster, definitions.key.shadowProxy.position);
    this.shadowCaster.target.position.copy(target);
    position(this.directLights.get("fill-area"), definitions.fill.area.position);
    position(this.directLights.get("separation-area"), definitions.separation.area.position);
    if (this.shadowRenderingEnabled) {
      this.configureShadowTier(this.runtime?.getBoundingClientRect?.().width || globalThis.innerWidth || 1280);
      fitDirectionalShadowCamera(this.shadowCaster, this.layout.nativeBounds, definitions.shadows);
      this.requestShadowRefresh();
    }
  }

  configureShadowTier(cssWidth) {
    if (!this.shadowRenderingEnabled || !this.shadowCaster) return;
    const tiers = ROOM2_APPEARANCE_PROFILE.lighting.shadows.tiers;
    const tier = tiers.find((entry) => entry.maximumCssWidth == null || cssWidth <= entry.maximumCssWidth) || tiers.at(-1);
    if (!tier || this.shadowTier?.id === tier.id) return;
    this.shadowTier = tier;
    this.shadowCaster.shadow.map?.dispose?.();
    this.shadowCaster.shadow.map = null;
    this.shadowCaster.shadow.mapSize.set(tier.mapSize, tier.mapSize);
    this.requestShadowRefresh();
  }

  requestShadowRefresh() {
    if (this.shadowRenderingEnabled && this.renderer?.shadowMap?.enabled) this.renderer.shadowMap.needsUpdate = true;
  }

  ensureStudioEnvironment() {
    if (this.environmentTexture) {
      this.scene.environment = this.environmentTexture;
      this.scene.environmentIntensity = this.presentation.environmentIntensity;
      this.scene.environmentRotation.set(0, this.presentation.environmentRotationRadians, 0);
      this.environmentAssignmentCount += 1;
      this.environmentPmremMode = this.rendererBackend === "webgpu"
        ? "webgpu-equirectangular-environment-node"
        : "webgl-automatic-pmrem";
      return Promise.resolve(true);
    }
    if (this.environmentLoadPromise) return this.environmentLoadPromise;
    const sequence = ++this.environmentSequence;
    const abortController = new AbortController();
    this.environmentAbortController = abortController;
    const promise = this.loadStudioEnvironment(sequence, abortController.signal);
    this.environmentLoadPromise = promise;
    return promise.finally(() => {
      if (this.environmentLoadPromise === promise) this.environmentLoadPromise = null;
      if (this.environmentAbortController === abortController) this.environmentAbortController = null;
    });
  }

  async loadStudioEnvironment(sequence, signal) {
    const definition = ROOM2_APPEARANCE_PROFILE.environment;
    const requestedUrl = new URL(definition.url, document.baseURI);
    if (requestedUrl.origin !== location.origin) throw codedError("ENVIRONMENT_CROSS_ORIGIN", "The studio environment is not same-origin.");
    this.environmentRequestCount += 1;
    const response = await fetch(requestedUrl.href, {
      signal,
      cache: "default",
      credentials: "same-origin",
      redirect: "error"
    });
    if (!response.ok || !response.url || new URL(response.url).href !== requestedUrl.href) {
      throw codedError("ENVIRONMENT_HTTP_ERROR", "The verified studio environment could not be loaded from its registered URL.");
    }
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > 0 && declaredLength !== definition.bytes) {
      throw codedError("ENVIRONMENT_CONTENT_LENGTH_MISMATCH", "The studio environment Content-Length differs from its manifest.");
    }
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength !== definition.bytes) throw codedError("ENVIRONMENT_SIZE_MISMATCH", "The studio environment size differs from its manifest.");
    const sha256 = await sha256Bytes(buffer);
    if (sha256 !== definition.sha256) throw codedError("ENVIRONMENT_HASH_MISMATCH", "The studio environment bytes differ from their manifest.");
    if (signal.aborted || this.disposed || sequence !== this.environmentSequence) return false;
    const decoded = new RGBELoader().parse(buffer);
    const texture = new THREE.DataTexture(decoded.data, decoded.width, decoded.height, THREE.RGBAFormat, decoded.type);
    texture.name = "immersive-commercial-neutral-studio-source";
    texture.colorSpace = THREE.LinearSRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.flipY = true;
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.needsUpdate = true;
    if (signal.aborted || this.disposed || sequence !== this.environmentSequence) {
      texture.dispose();
      return false;
    }
    this.environmentTexture = texture;
    this.environmentSha256 = sha256;
    this.environmentSuccessfulRequestCount += 1;
    this.environmentAssignmentCount += 1;
    this.environmentPmremMode = this.rendererBackend === "webgpu"
      ? "webgpu-equirectangular-environment-node"
      : "webgl-automatic-pmrem";
    this.scene.environment = texture;
    this.scene.environmentIntensity = this.presentation.environmentIntensity;
    this.scene.environmentRotation.set(0, this.presentation.environmentRotationRadians, 0);
    return true;
  }

  async fetchVerifiedAsset(layoutRecord, signal, onProgress) {
    this.requestCount += 1;
    const requestedUrl = new URL(layoutRecord.runtimeAsset.path, document.baseURI);
    if (requestedUrl.origin !== location.origin) {
      throw codedError("MODEL_CROSS_ORIGIN", `${layoutRecord.label} is not a same-origin asset.`);
    }
    const response = await fetch(requestedUrl.href, {
      signal,
      cache: "no-store",
      credentials: "same-origin",
      redirect: "error"
    });
    if (!response.ok) throw codedError("MODEL_HTTP_ERROR", `${layoutRecord.label} returned HTTP ${response.status}.`);
    if (!response.url || new URL(response.url).href !== requestedUrl.href) {
      throw codedError("MODEL_REDIRECTED", `${layoutRecord.label} did not resolve to its exact registered URL.`);
    }
    const expectedLength = layoutRecord.runtimeAsset.bytes;
    const declaredLengthHeader = response.headers.get("content-length");
    const declaredLength = declaredLengthHeader == null ? null : Number(declaredLengthHeader);
    if (declaredLength !== null && Number.isFinite(declaredLength) && declaredLength !== expectedLength) {
      throw codedError("MODEL_CONTENT_LENGTH_MISMATCH", `${layoutRecord.label} Content-Length differs from the authoritative registry.`);
    }
    const contentType = (response.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
    if (contentType && !["model/gltf-binary", "application/octet-stream", "binary/octet-stream"].includes(contentType)) {
      throw codedError("MODEL_MIME_MISMATCH", `${layoutRecord.label} returned unexpected MIME type ${contentType}.`);
    }
    const reader = response.body?.getReader?.();
    let bytes;
    if (!reader) {
      bytes = new Uint8Array(await response.arrayBuffer());
      onProgress(0.9);
    } else {
      const chunks = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.byteLength;
        if (received > expectedLength) {
          await reader.cancel("authoritative byte length exceeded");
          throw codedError("MODEL_BYTE_LENGTH_MISMATCH", `${layoutRecord.label} exceeded its authoritative byte length.`);
        }
        onProgress(Math.min(0.9, received / expectedLength * 0.9));
      }
      bytes = new Uint8Array(received);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
    }
    if (bytes.byteLength !== expectedLength) {
      throw codedError("MODEL_BYTE_LENGTH_MISMATCH", `${layoutRecord.label} bytes did not match the authoritative registry.`);
    }
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const sha256 = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
    if (sha256 !== layoutRecord.runtimeAsset.sha256) {
      throw codedError("MODEL_SHA256_MISMATCH", `${layoutRecord.label} SHA-256 did not match the authoritative registry.`);
    }
    this.successfulRequestCount += 1;
    this.assetSha256 = sha256;
    this.assetBytes = bytes.byteLength;
    onProgress(0.92);
    return bytes.buffer;
  }

  validateSourceInspection() {
    const inspection = this.glbInspection;
    const expected = this.layout.sourceMetadata;
    if (!inspection?.json) throw codedError("MODEL_INSPECTION_MISSING", "The authoritative GLB could not be structurally inspected.");
    if (inspection.json.asset?.version !== expected.gltfVersion || inspection.json.asset?.generator !== expected.generator) {
      throw codedError("MODEL_ASSET_METADATA_MISMATCH", `${this.layout.label} generator or glTF version differs from the registry.`);
    }
    for (const key of ["nodes", "meshes", "primitives", "materials", "textures", "images", "accessors", "vertices", "triangles"]) {
      if (inspection.counts[key] !== expected[key]) {
        throw codedError("MODEL_SOURCE_COUNT_MISMATCH", `${this.layout.label} ${key} count differs from the authoritative registry.`);
      }
    }
    const usedExtensions = [...(inspection.json.extensionsUsed || [])].sort();
    const expectedExtensions = [...(expected.legacyExtensionsUsed || [])].sort();
    if (usedExtensions.join("\n") !== expectedExtensions.join("\n") || (inspection.json.extensionsRequired || []).length) {
      throw codedError("MODEL_EXTENSION_CONTRACT_MISMATCH", `${this.layout.label} extension contract differs from the authoritative registry.`);
    }
    const semantic = this.layout.semanticManifest;
    const primitive = inspection.json.meshes?.[semantic.targetMeshIndex]?.primitives?.[semantic.targetPrimitiveIndex];
    if (!primitive || primitive.material !== semantic.targetMaterialIndex || primitive.indices !== semantic.targetAccessors.indices) {
      throw codedError("SMART_DIMENSION_PRIMITIVE_MISMATCH", `${this.layout.label} target primitive binding differs from the audited manifest.`);
    }
    for (const [attribute, accessorIndex] of Object.entries(semantic.targetAccessors)) {
      if (attribute === "indices") continue;
      if (primitive.attributes?.[attribute] !== accessorIndex) {
        throw codedError("SMART_DIMENSION_ACCESSOR_MISMATCH", `${this.layout.label} ${attribute} accessor differs from the audited manifest.`);
      }
    }
    let matchingBindings = 0;
    for (const mesh of inspection.json.meshes || []) {
      for (const candidate of mesh.primitives || []) {
        if (candidate.indices === primitive.indices
          && Object.entries(primitive.attributes || {}).every(([key, accessor]) => candidate.attributes?.[key] === accessor)) {
          matchingBindings += 1;
        }
      }
    }
    if (matchingBindings !== 1) {
      throw codedError("SMART_DIMENSION_ACCESSOR_NOT_UNIQUE", `${this.layout.label} target accessors are not uniquely owned.`);
    }
  }

  captureRuntimeRecords() {
    const associations = this.gltf.parser.associations;
    this.modelRoot.updateMatrixWorld(true);
    this.nativeNodeTransforms.clear();
    this.nativeNodeWorldMatrices.clear();
    this.targetDescendantNodeIndices.clear();
    this.hardwareNodeIndices.clear();
    this.nativeTargetCollisionDepths.clear();
    this.nativeDegenerateTriangleCount = null;
    this.currentDegenerateTriangleCount = null;
    this.meshRecords = [];
    this.zoneStatusCounts = {};
    this.shadowPrimitiveBudget = null;
    this.geometryLedger = [];
    this.geometryContentImmutable = true;
    this.sourceMaterials.clear();
    this.sourceTextures.clear();
    this.targetNode = null;
    this.lowerAnchorNode = null;
    this.upperAnchorNode = null;
    this.modelRoot.traverse((object) => {
      const nodeIndex = associations.get(object)?.nodes;
      if (Number.isInteger(nodeIndex)) {
        this.nativeNodeTransforms.set(nodeIndex, snapshotTransform(object));
        this.nativeNodeWorldMatrices.set(nodeIndex, object.matrixWorld.elements.slice());
        if (nodeIndex === this.layout.semanticManifest.targetNodeIndex) this.targetNode = object;
        if (nodeIndex === this.layout.semanticManifest.lowerAnchorNodeIndex) this.lowerAnchorNode = object;
        if (nodeIndex === this.layout.semanticManifest.upperAnchorNodeIndex) this.upperAnchorNode = object;
      }
      if (!object.isMesh) return;
      const association = associations.get(object) || {};
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        this.sourceMaterials.add(material);
        for (const slot of TEXTURE_SLOTS) if (material?.[slot]?.isTexture) this.sourceTextures.add(material[slot]);
      }
      this.meshRecords.push({
        object,
        meshIndex: association.meshes,
        primitiveIndex: association.primitives,
        nodeIndex,
        namePath: runtimeNamePath(object),
        sourceMaterial: object.material,
        zoneRecord: null,
        nativeWorldBounds: new THREE.Box3().setFromObject(object)
      });
      const geometry = object.geometry;
      this.geometryLedger.push({
        geometry,
        index: geometry.index,
        indexArray: geometry.index?.array || null,
        indexBytes: geometry.index?.array ? copyTypedArrayBytes(geometry.index.array) : null,
        groups: geometry.groups.map((group) => ({ ...group })),
        drawRange: { ...geometry.drawRange },
        attributes: Object.fromEntries(Object.entries(geometry.attributes).map(([name, attribute]) => [name, {
          attribute,
          array: attribute.array,
          bytes: copyTypedArrayBytes(attribute.array),
          count: attribute.count,
          itemSize: attribute.itemSize,
          version: attribute.version
        }])),
        morphAttributes: Object.fromEntries(Object.entries(geometry.morphAttributes || {}).map(([name, attributes]) => [
          name,
          attributes.map((attribute) => ({
            attribute,
            array: attribute.array,
            bytes: copyTypedArrayBytes(attribute.array),
            count: attribute.count,
            itemSize: attribute.itemSize,
            version: attribute.version
          }))
        ]))
      });
    });
    if (!this.targetNode || !this.lowerAnchorNode || !this.upperAnchorNode) {
      throw codedError("SEMANTIC_NODE_MISSING", `${this.layout.label} is missing an audited smart-dimension node.`);
    }
    const seenZoneRecords = new Set();
    for (const record of this.meshRecords) {
      const zoneRecord = getImmersiveMaterialZone(
        this.layoutId,
        record.nodeIndex,
        record.meshIndex,
        record.primitiveIndex
      );
      const sourceMaterialIndex = this.glbInspection.json.meshes?.[record.meshIndex]
        ?.primitives?.[record.primitiveIndex]?.material;
      if (!zoneRecord || zoneRecord.sourceMaterialIndex !== sourceMaterialIndex) {
        throw codedError("MATERIAL_ZONE_BINDING_MISMATCH", `${this.layout.label} material-zone audit does not exactly cover runtime node ${record.nodeIndex}, mesh ${record.meshIndex}, primitive ${record.primitiveIndex}.`);
      }
      if (seenZoneRecords.has(zoneRecord.stablePrimitiveId)) {
        throw codedError("MATERIAL_ZONE_DUPLICATE", `${this.layout.label} material-zone audit contains a duplicate runtime binding.`);
      }
      seenZoneRecords.add(zoneRecord.stablePrimitiveId);
      record.zoneRecord = zoneRecord;
      this.zoneStatusCounts[zoneRecord.status] = (this.zoneStatusCounts[zoneRecord.status] || 0) + 1;
      if (/(hardware|support)/i.test(zoneRecord.zone)) this.hardwareNodeIndices.add(record.nodeIndex);
    }
    if (seenZoneRecords.size !== this.layout.sourceMetadata.primitives) {
      throw codedError("MATERIAL_ZONE_COVERAGE_MISMATCH", `${this.layout.label} material-zone audit is not exhaustive.`);
    }
    this.nativeTargetTransform = snapshotTransform(this.targetNode);
    const semantic = this.layout.semanticManifest;
    for (const [object, expectedPath] of [
      [this.lowerAnchorNode, semantic.lowerAnchorPath],
      [this.targetNode, semantic.targetPath],
      [this.upperAnchorNode, semantic.upperAnchorPath]
    ]) {
      const actualPath = runtimeStableNodePath(object, associations, this.glbInspection.json.nodes);
      if (actualPath !== expectedPath) {
        throw codedError("SEMANTIC_NODE_PATH_MISMATCH", `${this.layout.label} smart-dimension path ${actualPath} differs from ${expectedPath}.`);
      }
    }
    const targetMeshRecord = this.meshRecords.find((record) => record.nodeIndex === semantic.targetMeshNodeIndex);
    if (!targetMeshRecord
      || targetMeshRecord.meshIndex !== semantic.targetMeshIndex
      || targetMeshRecord.primitiveIndex !== semantic.targetPrimitiveIndex) {
      throw codedError("SEMANTIC_TARGET_MESH_MISMATCH", `${this.layout.label} smart-dimension mesh binding differs from the audited manifest.`);
    }
    this.targetNode.traverse((object) => {
      const nodeIndex = associations.get(object)?.nodes;
      if (Number.isInteger(nodeIndex)) this.targetDescendantNodeIndices.add(nodeIndex);
    });
    this.nativeModelBounds = new THREE.Box3().setFromObject(this.modelRoot);
    this.nativeTargetBounds = new THREE.Box3().setFromObject(this.targetNode);
    this.nativeLowerAnchorBounds = new THREE.Box3().setFromObject(this.lowerAnchorNode);
    this.nativeUpperAnchorBounds = new THREE.Box3().setFromObject(this.upperAnchorNode);
    for (const record of this.meshRecords) {
      if (this.targetDescendantNodeIndices.has(record.nodeIndex)) continue;
      this.nativeTargetCollisionDepths.set(
        record.zoneRecord.stablePrimitiveId,
        intersectionDepthsMillimeters(this.nativeTargetBounds, record.nativeWorldBounds)
      );
    }
    this.nativeDegenerateTriangleCount = countLocalDegenerateTriangles(this.meshRecords);
    this.currentDegenerateTriangleCount = this.nativeDegenerateTriangleCount;
    if (this.nativeDegenerateTriangleCount !== this.layout.sourceMetadata.nativeDegenerateTriangles) {
      throw codedError("NATIVE_DEGENERATE_TRIANGLE_MISMATCH", `${this.layout.label} runtime degenerate-triangle count ${this.nativeDegenerateTriangleCount} differs from authoritative ${this.layout.sourceMetadata.nativeDegenerateTriangles}.`);
    }
    if (maximumBoxDeltaMillimeters(this.nativeModelBounds, boxFromRecord(this.layout.nativeBounds)) > 0.5
      || maximumBoxDeltaMillimeters(this.nativeTargetBounds, boxFromRecord(semantic.nativeTargetWorldBounds)) > 0.25) {
      throw codedError("NATIVE_BOUNDS_MISMATCH", `${this.layout.label} runtime bounds differ from the audited native bounds.`);
    }
  }

  applySmartDimensions() {
    if (!this.targetNode || !this.layout) return false;
    const definition = this.layout.geometryControlManifest[CONTROL_ID];
    const requested = this.smartDimensions[CONTROL_ID] ?? definition.nativeMillimeters;
    const millimeters = normalizeSmartDimension(this.layoutId, CONTROL_ID, requested);
    this.smartDimensions[CONTROL_ID] = millimeters;
    restoreTransform(this.targetNode, this.nativeTargetTransform);
    const deltaMeters = (millimeters - definition.nativeMillimeters) / 1000;
    this.targetNode.position.z = this.nativeTargetTransform.position[2]
      + deltaMeters / definition.sourceScaleMetersPerLocalUnit;
    this.targetNode.updateMatrix();
    this.modelRoot.updateMatrixWorld(true);
    this.dimensionApplyCount += 1;
    this.geometryContentImmutable = this.verifyGeometryImmutable();
    this.currentDegenerateTriangleCount = countLocalDegenerateTriangles(this.meshRecords);
    if (this.currentDegenerateTriangleCount !== this.nativeDegenerateTriangleCount) this.geometryContentImmutable = false;
    if (!this.geometryContentImmutable) this.geometryMutationCount += 1;
    this.syncDimensionDom();
    this.updateDimensionOverlay();
    this.requestShadowRefresh();
    return true;
  }

  resetSmartDimension() {
    const definition = this.layout?.geometryControlManifest?.[CONTROL_ID];
    if (!definition) return false;
    this.dimensionResetCount += 1;
    this.commitDimension(definition.nativeMillimeters, "reset");
    return true;
  }

  commitDimension(value, source = "unknown") {
    const normalized = normalizeSmartDimension(this.layoutId, CONTROL_ID, value);
    if (normalized === null) return false;
    this.smartDimensions[CONTROL_ID] = normalized;
    this.applySmartDimensions();
    this.cameraRefitCount += 1;
    this.fitCamera({ preserveOrientation: true, animate: source !== "load" });
    this.scheduleRender();
    this.onDimensionChange({ layoutId: this.layoutId, controlId: CONTROL_ID, value: normalized, source });
    this.syncDiagnostics();
    return true;
  }

  async applyFinish(finishId) {
    if (!this.modelRoot || !this.layout) return false;
    if (this.zoneProofMode) {
      this.applyZoneProofMaterials();
      this.appliedFinishId = resolveRoom2Finish(finishId).id;
      this.lastError = null;
      return true;
    }
    if (this.premiumModelV1Enabled) {
      const sequence = ++this.finishSequence;
      const layoutId = this.layoutId;
      await this.applyPremiumModelV1Presentation();
      if (sequence !== this.finishSequence || this.disposed || layoutId !== this.layoutId) return false;
      this.appliedFinishId = resolveRoom2Finish(finishId).id;
      this.lastError = null;
      this.scheduleRender();
      return true;
    }
    if (this.materialSystem) {
      const sequence = ++this.finishSequence;
      const applied = await this.materialSystem.selectFinish(finishId);
      if (sequence !== this.finishSequence || this.disposed || this.layoutId !== "fireplace-wall") return false;
      if (!applied) return false;
      this.appliedFinishId = resolveRoom2Finish(finishId).id;
      this.lastError = null;
      this.enforceShadowDrawCallBudget();
      this.scheduleRender();
      return true;
    }
    const proven = new Set(this.layout.appearanceManifest.provenMeshIndices || []);
    if (!proven.size) {
      this.disposeActiveFinishMaterials();
      for (const record of this.meshRecords) record.object.material = record.sourceMaterial;
      this.appliedFinishId = finishId;
      this.lastError = null;
      this.scheduleRender();
      return true;
    }
    const sequence = ++this.finishSequence;
    const layoutId = this.layoutId;
    const finish = resolveRoom2Finish(finishId);
    const family = ROOM2_APPEARANCE_PROFILE.materials.families[finish.family];
    const textures = await this.loadFinishTextures(family);
    if (sequence !== this.finishSequence || this.disposed || layoutId !== this.layoutId) return false;
    this.disposeActiveFinishMaterials();
    for (const record of this.meshRecords) {
      if (!proven.has(record.meshIndex)) {
        record.object.material = record.sourceMaterial;
        continue;
      }
      const source = Array.isArray(record.sourceMaterial) ? record.sourceMaterial[0] : record.sourceMaterial;
      const material = source?.clone?.() || new THREE.MeshStandardMaterial();
      material.name = `${source?.name || "material"}:jq-provisional-${finish.id}`;
      material.color.set(finish.swatch);
      material.metalness = 0;
      material.roughness = finish.roughnessFactor;
      material.map = textures.map || null;
      material.normalMap = textures.normalMap || null;
      material.roughnessMap = textures.roughnessMap || null;
      material.normalScale?.set?.(...(family.normalScale || [0, 0]));
      material.needsUpdate = true;
      record.object.material = material;
      this.ownedMaterials.add(material);
    }
    this.appliedFinishId = finish.id;
    this.lastError = null;
    this.enforceShadowDrawCallBudget();
    this.scheduleRender();
    return true;
  }

  async applyPremiumModelV1Presentation() {
    if (!this.premiumModelV1Enabled || this.zoneProofMode || !this.modelRoot) return null;
    if (!this.premiumModelV1ModulePromise) {
      this.premiumModelV1ModulePromise = import("./guided-premium-model-v1.js?v=premium-model-v1-20260823za");
    }
    const premiumModule = await this.premiumModelV1ModulePromise;
    const diagnostics = await premiumModule.applyPremiumModelV1(this);
    if (this.disposed || !this.modelRoot) return null;
    this.premiumModelV1Diagnostics = diagnostics;
    return diagnostics;
  }

  async reconcileRequestedFinishForLoad(layoutId, loadSequence, fallbackFinishId = null) {
    while (!this.disposed && this.layoutId === layoutId && this.loadSequence === loadSequence) {
      const finishRequestId = this.requestedFinishId;
      if (this.appliedFinishId === finishRequestId) return { completed: true, error: null };
      const expectedFinishSequence = this.finishSequence + 1;
      const applied = await this.applyFinish(finishRequestId);
      if (this.disposed || this.layoutId !== layoutId || this.loadSequence !== loadSequence) {
        return { completed: false, error: null };
      }
      const superseded = this.finishSequence !== expectedFinishSequence
        || this.requestedFinishId !== finishRequestId;
      if (superseded) continue;
      if (applied && this.appliedFinishId === finishRequestId) return { completed: true, error: null };

      const error = codedError("FINISH_LOAD_FAILED", "The latest selected Finish could not be applied. The last verified appearance remains visible; use Retry to try only that Finish again.");
      if (!this.appliedFinishId && fallbackFinishId && fallbackFinishId !== finishRequestId) {
        const expectedFallbackSequence = this.finishSequence + 1;
        const fallbackApplied = await this.applyFinish(fallbackFinishId);
        if (this.disposed || this.layoutId !== layoutId || this.loadSequence !== loadSequence) {
          return { completed: false, error: null };
        }
        if (this.requestedFinishId !== finishRequestId || this.finishSequence !== expectedFallbackSequence) continue;
        if (!fallbackApplied || this.appliedFinishId !== fallbackFinishId) {
          throw codedError("INITIAL_FINISH_FALLBACK_FAILED", "Neither the selected Finish nor the prepared embedded appearance could be displayed safely.");
        }
      }
      this.lastError = error;
      return { completed: true, error };
    }
    return { completed: false, error: null };
  }

  async loadFinishTextures(family) {
    const result = {};
    if (!family?.maps) return result;
    const loader = new THREE.TextureLoader();
    for (const [slot, path] of Object.entries(family.maps)) {
      let texture = this.finishTextureCache.get(path);
      if (!texture) {
        texture = await loader.loadAsync(path);
        texture.name = `jq-provisional:${path}`;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = true;
        texture.colorSpace = slot === "map" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        texture.repeat.set(...(family.authoredUvRepeat || [1, 1]));
        texture.needsUpdate = true;
        this.finishTextureCache.set(path, texture);
        this.ownedTextures.add(texture);
      }
      result[slot] = texture;
    }
    return result;
  }

  applyZoneProofMaterials() {
    this.disposeActiveFinishMaterials();
    for (const record of this.meshRecords) {
      const status = record.zoneRecord?.status;
      if (!["PROVEN", "PROVISIONAL", "BLOCKED"].includes(status)) {
        throw codedError("MATERIAL_ZONE_STATUS_INVALID", `${this.layout.label} has an invalid audited material-zone status.`);
      }
      const material = new THREE.MeshBasicMaterial({
        color: status === "PROVEN" ? 0x2fa36b : status === "BLOCKED" ? 0xc74c4c : 0xe3a93c,
        side: THREE.DoubleSide,
        transparent: false
      });
      material.name = `zone-proof:${status}`;
      record.object.material = material;
      this.ownedMaterials.add(material);
    }
  }

  enforceShadowDrawCallBudget() {
    if (!this.meshRecords.length) {
      this.shadowPrimitiveBudget = null;
      return;
    }
    const visiblePrimitiveCount = this.meshRecords.filter(({ object }) => object.visible).length;
    if (!this.shadowRenderingEnabled) {
      for (const record of this.meshRecords) record.object.castShadow = false;
      this.shadowPrimitiveBudget = Object.freeze({
        drawCallLimit: MAX_DRAW_CALLS,
        reservedHeadroom: DRAW_CALL_HEADROOM,
        visiblePrimitiveCount,
        eligibleProvenPrimitiveCount: 0,
        selectedShadowPrimitiveCount: 0,
        projectedMaximumDrawCalls: visiblePrimitiveCount,
        selection: "disabled",
        onlyProvenBindingsSelected: true
      });
      return;
    }
    const maximumShadowPrimitives = Math.max(
      0,
      MAX_DRAW_CALLS - DRAW_CALL_HEADROOM - visiblePrimitiveCount,
    );
    const candidates = this.meshRecords
      .filter(({ object, zoneRecord }) => object.visible && zoneRecord?.status === "PROVEN")
      .map((record) => {
        const size = record.nativeWorldBounds.getSize(new THREE.Vector3());
        const boxSurfaceArea = 2 * (size.x * size.y + size.x * size.z + size.y * size.z);
        const geometryCount = record.object.geometry?.index?.count
          || record.object.geometry?.getAttribute?.("position")?.count
          || 0;
        return {
          record,
          targetPriority: this.targetDescendantNodeIndices.has(record.nodeIndex) ? 1 : 0,
          boxSurfaceArea,
          triangles: Math.floor(geometryCount / 3),
        };
      })
      .sort((left, right) => (
        right.targetPriority - left.targetPriority
        || right.boxSurfaceArea - left.boxSurfaceArea
        || right.triangles - left.triangles
        || left.record.zoneRecord.stablePrimitiveId.localeCompare(right.record.zoneRecord.stablePrimitiveId)
      ));
    const selected = new Set(
      candidates
        .slice(0, maximumShadowPrimitives)
        .map(({ record }) => record.zoneRecord.stablePrimitiveId),
    );
    for (const record of this.meshRecords) {
      record.object.castShadow = selected.has(record.zoneRecord.stablePrimitiveId);
      record.object.receiveShadow = record.zoneRecord?.status === "PROVEN";
    }
    this.shadowPrimitiveBudget = Object.freeze({
      drawCallLimit: MAX_DRAW_CALLS,
      reservedHeadroom: DRAW_CALL_HEADROOM,
      visiblePrimitiveCount,
      eligibleProvenPrimitiveCount: candidates.length,
      selectedShadowPrimitiveCount: selected.size,
      projectedMaximumDrawCalls: visiblePrimitiveCount + selected.size,
      selection: "target-first, then descending audited world-bound surface area and triangle count",
      onlyProvenBindingsSelected: this.meshRecords.every(
        (record) => !record.object.castShadow || record.zoneRecord?.status === "PROVEN",
      ),
    });
    this.requestShadowRefresh();
  }

  restoreOrResetCamera() {
    const saved = this.cameraStateByLayout.get(this.layoutId);
    this.cameraTarget.set(...this.layout.orbitTarget);
    if (saved) {
      this.theta = saved.theta;
      this.phi = saved.phi;
      this.radius = saved.radius;
      this.userAdjustedCamera = true;
      this.updateCamera();
    } else {
      this.resetCamera({ animate: false });
    }
  }

  rememberCameraState() {
    if (!this.layoutId || !this.camera || !this.modelRoot) return;
    this.cameraStateByLayout.set(this.layoutId, { theta: this.theta, phi: this.phi, radius: this.radius });
  }

  resetCamera(options = {}) {
    if (!this.layout || !this.camera) return false;
    const fit = this.resolveFitRadius(this.layout.initialCamera.theta, this.layout.initialCamera.phi);
    const target = {
      theta: this.layout.initialCamera.theta,
      phi: this.layout.initialCamera.phi,
      radius: fit,
      target: [...this.layout.orbitTarget]
    };
    this.userAdjustedCamera = false;
    this.moveCamera(target, options.animate !== false);
    return true;
  }

  fitCamera(options = {}) {
    if (!this.layout || !this.camera) return false;
    const theta = options.preserveOrientation ? this.theta : this.layout.initialCamera.theta;
    const phi = options.preserveOrientation ? this.phi : this.layout.initialCamera.phi;
    const target = {
      theta,
      phi,
      radius: this.resolveFitRadius(theta, phi),
      target: [...this.layout.orbitTarget]
    };
    this.moveCamera(target, options.animate !== false);
    return true;
  }

  setView(view) {
    if (!this.layout || !this.camera) return false;
    const views = {
      front: { theta: 0, phi: 0.08 },
      left: { theta: -0.52, phi: 0.16 },
      right: { theta: 0.52, phi: 0.16 }
    };
    const selected = views[view];
    if (!selected) return false;
    this.userAdjustedCamera = true;
    this.moveCamera({
      ...selected,
      radius: this.resolveFitRadius(selected.theta, selected.phi),
      target: [...this.layout.orbitTarget]
    }, true);
    return true;
  }

  zoom(action) {
    if (!this.camera) return false;
    if (action === "reset") return this.resetCamera({ animate: true });
    if (action === "fit") return this.fitCamera({ preserveOrientation: true, animate: true });
    const multiplier = action === "in" ? 0.86 : action === "out" ? 1.16 : 1;
    this.radius = clamp(this.radius * multiplier, CAMERA_LIMITS.minimumRadius, CAMERA_LIMITS.maximumRadius);
    this.userAdjustedCamera = true;
    this.updateCamera();
    this.scheduleRender();
    return true;
  }

  resolveFitRadius(theta = this.theta, phi = this.phi) {
    const rect = this.runtime?.getBoundingClientRect?.();
    const width = Math.max(1, rect?.width || 800);
    const height = Math.max(1, rect?.height || 600);
    const bounds = this.layout.heroBounds;
    const verticalFov = THREE.MathUtils.degToRad(this.camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * width / height);
    const margin = width < 600 ? 1.11 : width < 1200 ? 1.13 : 1.17;
    const target = new THREE.Vector3(...this.layout.orbitTarget);
    const cameraOffsetDirection = new THREE.Vector3(
      Math.sin(theta) * Math.cos(phi),
      Math.sin(phi),
      Math.cos(theta) * Math.cos(phi)
    ).normalize();
    const forward = cameraOffsetDirection.clone().negate();
    const right = forward.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
    const up = right.clone().cross(forward).normalize();
    let requiredRadius = CAMERA_LIMITS.minimumRadius;
    for (const x of [bounds.min[0], bounds.max[0]]) {
      for (const y of [bounds.min[1], bounds.max[1]]) {
        for (const z of [bounds.min[2], bounds.max[2]]) {
          const relative = new THREE.Vector3(x, y, z).sub(target);
          const towardCamera = relative.dot(cameraOffsetDirection);
          const widthDistance = Math.abs(relative.dot(right)) / Math.tan(horizontalFov / 2);
          const heightDistance = Math.abs(relative.dot(up)) / Math.tan(verticalFov / 2);
          requiredRadius = Math.max(requiredRadius, towardCamera + Math.max(widthDistance, heightDistance) * margin);
        }
      }
    }
    return clamp(requiredRadius, CAMERA_LIMITS.minimumRadius, CAMERA_LIMITS.maximumRadius);
  }

  getCameraContainmentLimits(radius = this.radius, target = this.cameraTarget.toArray()) {
    const nextRadius = clamp(radius, CAMERA_LIMITS.minimumRadius, CAMERA_LIMITS.maximumRadius);
    let minimumPhi = CAMERA_LIMITS.minimumPhi;
    let maximumPhi = CAMERA_LIMITS.maximumPhi;
    const bounds = this.layout?.nativeBounds;
    const targetY = Array.isArray(target) ? target[1] : this.cameraTarget.y;
    if (bounds
      && Number.isFinite(targetY)
      && Number.isFinite(bounds.min?.[1])
      && Number.isFinite(bounds.max?.[1])) {
      const floorPhi = Math.asin(clamp(
        (bounds.min[1] + ROOM_SHELL_CAMERA_CLEARANCE_METERS - targetY) / nextRadius,
        -1,
        1
      ));
      const ceilingPhi = Math.asin(clamp(
        (bounds.max[1] - ROOM_SHELL_CAMERA_CLEARANCE_METERS - targetY) / nextRadius,
        -1,
        1
      ));
      minimumPhi = Math.max(minimumPhi, floorPhi);
      maximumPhi = Math.min(maximumPhi, ceilingPhi);
    }
    if (maximumPhi < minimumPhi) maximumPhi = minimumPhi;
    return {
      minimumTheta: CAMERA_LIMITS.minimumTheta,
      maximumTheta: CAMERA_LIMITS.maximumTheta,
      minimumPhi,
      maximumPhi
    };
  }

  constrainCameraState(state = {}) {
    const radius = clamp(
      Number.isFinite(state.radius) ? state.radius : this.radius,
      CAMERA_LIMITS.minimumRadius,
      CAMERA_LIMITS.maximumRadius
    );
    const target = Array.isArray(state.target) ? state.target : this.cameraTarget.toArray();
    const limits = this.getCameraContainmentLimits(radius, target);
    return {
      ...state,
      theta: clamp(
        Number.isFinite(state.theta) ? state.theta : this.theta,
        limits.minimumTheta,
        limits.maximumTheta
      ),
      phi: clamp(
        Number.isFinite(state.phi) ? state.phi : this.phi,
        limits.minimumPhi,
        limits.maximumPhi
      ),
      radius,
      target
    };
  }

  moveCamera(target, animate) {
    const next = this.constrainCameraState(target);
    if (!animate || this.prefersReducedMotion) {
      this.cancelCameraAnimation();
      this.theta = next.theta;
      this.phi = next.phi;
      this.radius = next.radius;
      this.cameraTarget.set(...next.target);
      this.updateCamera();
      this.scheduleRender();
      return;
    }
    this.cancelCameraAnimation();
    this.cancelRender();
    this.animationFrom = {
      theta: this.theta,
      phi: this.phi,
      radius: this.radius,
      target: this.cameraTarget.toArray()
    };
    this.animationTo = next;
    this.animationStartedAt = performance.now();
    const tick = (now) => {
      if (this.disposed || !this.camera || !this.animationTo) return;
      const progress = clamp((now - this.animationStartedAt) / 220, 0, 1);
      const eased = 1 - (1 - progress) ** 3;
      this.theta = lerp(this.animationFrom.theta, this.animationTo.theta, eased);
      this.phi = lerp(this.animationFrom.phi, this.animationTo.phi, eased);
      this.radius = lerp(this.animationFrom.radius, this.animationTo.radius, eased);
      this.cameraTarget.fromArray(this.animationFrom.target).lerp(new THREE.Vector3().fromArray(this.animationTo.target), eased);
      this.updateCamera();
      const generation = this.renderGeneration;
      void this.renderNow().catch((error) => this.handleRenderFailure(error, generation));
      if (progress < 1) this.cameraAnimationFrame = requestAnimationFrame(tick);
      else {
        this.cameraAnimationFrame = null;
        this.animationFrom = null;
        this.animationTo = null;
        this.rememberCameraState();
        this.syncDiagnostics();
      }
    };
    this.cameraAnimationFrame = requestAnimationFrame(tick);
  }

  updateCamera() {
    if (!this.camera) return;
    const contained = this.constrainCameraState({
      theta: this.theta,
      phi: this.phi,
      radius: this.radius,
      target: this.cameraTarget.toArray()
    });
    this.theta = contained.theta;
    this.phi = contained.phi;
    this.radius = contained.radius;
    const horizontal = Math.cos(this.phi) * this.radius;
    this.camera.position.set(
      this.cameraTarget.x + Math.sin(this.theta) * horizontal,
      this.cameraTarget.y + Math.sin(this.phi) * this.radius,
      this.cameraTarget.z + Math.cos(this.theta) * horizontal
    );
    this.camera.lookAt(this.cameraTarget);
    this.camera.updateMatrixWorld();
    this.updateDimensionOverlay();
  }

  createRuntime() {
    const runtime = document.createElement("div");
    runtime.className = "immersive-viewer-runtime";
    runtime.dataset.layoutViewer = "true";
    runtime.dataset.state = "idle";

    const canvas = document.createElement("canvas");
    canvas.className = "immersive-viewer-canvas";
    canvas.tabIndex = -1;
    canvas.setAttribute("role", "application");
    canvas.setAttribute("aria-describedby", `immersive-viewer-instructions-${this.instanceId}`);
    canvas.setAttribute("aria-label", "Interactive JQ layout model");
    runtime.append(canvas);

    const instructions = document.createElement("p");
    instructions.id = `immersive-viewer-instructions-${this.instanceId}`;
    instructions.className = "sr-only";
    instructions.textContent = "Drag or use arrow keys to orbit. Pinch, wheel, or plus and minus keys zoom. Press Home to fit and 0 to reset.";
    runtime.append(instructions);

    const authority = document.createElement("p");
    authority.id = `immersive-viewer-authority-${this.instanceId}`;
    authority.className = "immersive-viewer-authority";
    authority.textContent = "Preview only — final dimensions require design confirmation.";
    runtime.append(authority);
    canvas.setAttribute("aria-describedby", `${instructions.id} ${authority.id}`);

    const status = document.createElement("div");
    status.className = "immersive-viewer-status";
    status.dataset.viewerStatus = "true";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.tabIndex = -1;
    status.innerHTML = `
      <span class="immersive-viewer-spinner" aria-hidden="true"></span>
      <strong data-viewer-status-title>Preparing model</strong>
      <span data-viewer-status-copy>Verifying the selected authoritative asset…</span>
      <progress data-viewer-progress aria-label="Model loading progress" max="100" value="0"><span>0%</span></progress>
      <button type="button" data-viewer-retry hidden>Retry model</button>
    `;
    runtime.append(status);

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("immersive-dimension-overlay");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = `
      <line data-dimension-extension-lower></line>
      <line data-dimension-extension-upper></line>
      <line data-dimension-line></line>
      <text data-dimension-label></text>
    `;
    runtime.append(svg);

    const handle = document.createElement("button");
    handle.className = "immersive-dimension-handle";
    handle.type = "button";
    handle.setAttribute("role", "slider");
    handle.setAttribute("aria-orientation", "vertical");
    handle.setAttribute("aria-describedby", `${instructions.id} ${authority.id}`);
    handle.dataset.dimensionHandle = CONTROL_ID;
    handle.innerHTML = '<span aria-hidden="true"></span>';
    runtime.append(handle);

    const hint = document.createElement("div");
    hint.className = "immersive-interaction-hint";
    hint.setAttribute("aria-hidden", "true");
    hint.textContent = "Drag to orbit · Pinch or scroll to zoom";
    runtime.append(hint);

    this.mountTarget.replaceChildren(runtime);
    this.runtime = runtime;
    this.canvas = canvas;
    this.status = status;
    this.statusProgress = status.querySelector("[data-viewer-progress]");
    this.retryButton = status.querySelector("[data-viewer-retry]");
    this.dimensionSvg = svg;
    this.dimensionLine = svg.querySelector("[data-dimension-line]");
    this.dimensionExtensionLower = svg.querySelector("[data-dimension-extension-lower]");
    this.dimensionExtensionUpper = svg.querySelector("[data-dimension-extension-upper]");
    this.dimensionLabel = svg.querySelector("[data-dimension-label]");
    this.dimensionHandle = handle;
    this.retryButton.addEventListener("click", () => this.retry());
  }

  bindControls() {
    if (!this.canvas || !this.dimensionHandle) return;
    this.controlAbortController?.abort();
    this.controlAbortController = new AbortController();
    const { signal } = this.controlAbortController;

    this.canvas.addEventListener("pointerdown", (event) => this.onPointerDown(event), { signal });
    this.canvas.addEventListener("pointermove", (event) => this.onPointerMove(event), { signal });
    this.canvas.addEventListener("pointerup", (event) => this.onPointerUp(event), { signal });
    this.canvas.addEventListener("pointercancel", (event) => this.onPointerUp(event), { signal });
    this.canvas.addEventListener("lostpointercapture", (event) => this.onPointerUp(event), { signal });
    this.canvas.addEventListener("wheel", (event) => {
      if (this.state !== "ready") return;
      event.preventDefault();
      this.cancelCameraAnimation();
      this.radius = clamp(this.radius * Math.exp(event.deltaY * 0.0011), CAMERA_LIMITS.minimumRadius, CAMERA_LIMITS.maximumRadius);
      this.userAdjustedCamera = true;
      this.updateCamera();
      this.scheduleRender();
    }, { signal, passive: false });
    this.canvas.addEventListener("keydown", (event) => this.onCanvasKeyDown(event), { signal });

    this.dimensionHandle.addEventListener("pointerdown", (event) => this.onDimensionPointerDown(event), { signal });
    this.dimensionHandle.addEventListener("pointermove", (event) => this.onDimensionPointerMove(event), { signal });
    this.dimensionHandle.addEventListener("pointerup", (event) => this.onDimensionPointerUp(event), { signal });
    this.dimensionHandle.addEventListener("pointercancel", (event) => this.onDimensionPointerUp(event), { signal });
    this.dimensionHandle.addEventListener("lostpointercapture", (event) => this.onDimensionPointerUp(event), { signal });
    this.dimensionHandle.addEventListener("keydown", (event) => this.onDimensionKeyDown(event), { signal });
    this.dimensionHandle.addEventListener("click", () => {
      if (!this.showDimensions || this.state !== "ready") return;
      if (this.suppressDimensionClick) {
        this.suppressDimensionClick = false;
        return;
      }
      this.onDimensionEditRequest({
        layoutId: this.layoutId,
        controlId: CONTROL_ID,
        value: this.smartDimensions[CONTROL_ID]
      });
    }, { signal });
  }

  onPointerDown(event) {
    if (this.state !== "ready") return;
    this.cancelCameraAnimation();
    this.canvas.setPointerCapture?.(event.pointerId);
    this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.activePointers.size === 1) {
      this.pointerOrbit = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
      this.pinchState = null;
    } else if (this.activePointers.size === 2) {
      const points = [...this.activePointers.values()];
      this.pinchState = { distance: distance(points[0], points[1]), radius: this.radius };
      this.pointerOrbit = null;
    }
  }

  onPointerMove(event) {
    if (!this.activePointers.has(event.pointerId) || this.state !== "ready") return;
    this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.activePointers.size === 2 && this.pinchState) {
      const points = [...this.activePointers.values()];
      const nextDistance = Math.max(1, distance(points[0], points[1]));
      this.radius = clamp(this.pinchState.radius * this.pinchState.distance / nextDistance, CAMERA_LIMITS.minimumRadius, CAMERA_LIMITS.maximumRadius);
      this.userAdjustedCamera = true;
      this.updateCamera();
      this.scheduleRender();
      return;
    }
    if (!this.pointerOrbit || this.pointerOrbit.pointerId !== event.pointerId) return;
    const dx = event.clientX - this.pointerOrbit.x;
    const dy = event.clientY - this.pointerOrbit.y;
    this.pointerOrbit.x = event.clientX;
    this.pointerOrbit.y = event.clientY;
    this.theta = clamp(this.theta - dx * 0.006, CAMERA_LIMITS.minimumTheta, CAMERA_LIMITS.maximumTheta);
    this.phi = clamp(this.phi + dy * 0.0045, CAMERA_LIMITS.minimumPhi, CAMERA_LIMITS.maximumPhi);
    this.userAdjustedCamera = true;
    this.updateCamera();
    this.scheduleRender();
  }

  onPointerUp(event) {
    this.activePointers.delete(event.pointerId);
    if (this.activePointers.size === 1) {
      const [pointerId, point] = [...this.activePointers.entries()][0];
      this.pointerOrbit = { pointerId, ...point };
      this.pinchState = null;
    } else {
      this.pointerOrbit = null;
      this.pinchState = null;
    }
    this.rememberCameraState();
  }

  onCanvasKeyDown(event) {
    if (this.state !== "ready") return;
    const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "=", "-", "_", "0", "Home"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    this.cancelCameraAnimation();
    if (event.key === "ArrowLeft") this.theta += 0.07;
    if (event.key === "ArrowRight") this.theta -= 0.07;
    if (event.key === "ArrowUp") this.phi += 0.055;
    if (event.key === "ArrowDown") this.phi -= 0.055;
    this.theta = clamp(this.theta, CAMERA_LIMITS.minimumTheta, CAMERA_LIMITS.maximumTheta);
    this.phi = clamp(this.phi, CAMERA_LIMITS.minimumPhi, CAMERA_LIMITS.maximumPhi);
    if (["+", "="].includes(event.key)) this.radius *= 0.86;
    if (["-", "_"].includes(event.key)) this.radius *= 1.16;
    this.radius = clamp(this.radius, CAMERA_LIMITS.minimumRadius, CAMERA_LIMITS.maximumRadius);
    if (event.key === "0") return void this.resetCamera({ animate: true });
    if (event.key === "Home") return void this.fitCamera({ preserveOrientation: true, animate: true });
    this.userAdjustedCamera = true;
    this.updateCamera();
    this.scheduleRender();
  }

  onDimensionPointerDown(event) {
    if (this.state !== "ready" || !this.showDimensions) return;
    event.preventDefault();
    event.stopPropagation();
    this.dimensionHandle.setPointerCapture?.(event.pointerId);
    this.dimensionDrag = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startValue: this.smartDimensions[CONTROL_ID],
      moved: false
    };
    this.dimensionHandle.classList.add("is-active");
  }

  onDimensionPointerMove(event) {
    if (!this.showDimensions || !this.dimensionDrag || this.dimensionDrag.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const definition = this.layout.geometryControlManifest[CONTROL_ID];
    if (Math.abs(event.clientY - this.dimensionDrag.startY) > 4) this.dimensionDrag.moved = true;
    const range = definition.maxMillimeters - definition.minMillimeters;
    const raw = this.dimensionDrag.startValue - (event.clientY - this.dimensionDrag.startY) / 190 * range;
    const snapped = snapDimension(raw, definition);
    this.commitDimension(snapped, "handle");
  }

  onDimensionPointerUp(event) {
    if (!this.dimensionDrag || this.dimensionDrag.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    this.suppressDimensionClick = this.dimensionDrag.moved;
    this.dimensionDrag = null;
    this.dimensionHandle.classList.remove("is-active");
    this.dimensionHandle.focus();
  }

  onDimensionKeyDown(event) {
    if (!this.showDimensions || this.state !== "ready") return;
    const definition = this.layout?.geometryControlManifest?.[CONTROL_ID];
    if (!definition) return;
    const current = this.smartDimensions[CONTROL_ID];
    let next = current;
    if (["ArrowUp", "ArrowRight"].includes(event.key)) next += definition.stepMillimeters;
    else if (["ArrowDown", "ArrowLeft"].includes(event.key)) next -= definition.stepMillimeters;
    else if (event.key === "PageUp") next += definition.stepMillimeters * 4;
    else if (event.key === "PageDown") next -= definition.stepMillimeters * 4;
    else if (event.key === "Home") next = definition.minMillimeters;
    else if (event.key === "End") next = definition.maxMillimeters;
    else if (event.key.toLowerCase() === "r" || event.key === "0") next = definition.nativeMillimeters;
    else return;
    event.preventDefault();
    event.stopPropagation();
    this.commitDimension(snapDimension(next, definition), "keyboard");
  }

  syncDimensionDom() {
    if (!this.dimensionHandle || !this.layout) return;
    const definition = this.layout.geometryControlManifest[CONTROL_ID];
    const value = this.smartDimensions[CONTROL_ID];
    const inches = millimetersToInches(value);
    this.dimensionHandle.setAttribute("aria-label", `${definition.label} for ${this.layout.label}`);
    this.dimensionHandle.setAttribute("aria-valuemin", String(definition.minMillimeters));
    this.dimensionHandle.setAttribute("aria-valuemax", String(definition.maxMillimeters));
    this.dimensionHandle.setAttribute("aria-valuenow", String(value));
    this.dimensionHandle.setAttribute("aria-valuetext", `${inches.toFixed(2)} inches, ${value.toFixed(1)} millimeters`);
    if (this.dimensionLabel) this.dimensionLabel.textContent = `${inches.toFixed(2)} in`;
  }

  updateDimensionOverlay() {
    if (!this.dimensionSvg || !this.dimensionHandle) return;
    if (!this.showDimensions || !this.camera || !this.targetNode || this.state !== "ready") {
      this.dimensionSvg.hidden = true;
      this.dimensionHandle.hidden = true;
      this.dimensionHandle.disabled = true;
      return;
    }
    this.dimensionHandle.disabled = false;
    const rect = this.runtime.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const targetBox = new THREE.Box3().setFromObject(this.targetNode);
    const lowerBox = new THREE.Box3().setFromObject(this.lowerAnchorNode);
    const x = Math.max(targetBox.max.x, lowerBox.max.x) + 0.08;
    const z = targetBox.min.z;
    const lowerWorld = new THREE.Vector3(x, lowerBox.max.y, z);
    const upperWorld = new THREE.Vector3(x, targetBox.min.y, z);
    const lowerShelfWorld = new THREE.Vector3(lowerBox.max.x, lowerBox.max.y, z);
    const targetShelfWorld = new THREE.Vector3(targetBox.max.x, targetBox.min.y, z);
    const lower = projectPoint(lowerWorld, this.camera, rect);
    const upper = projectPoint(upperWorld, this.camera, rect);
    const lowerShelf = projectPoint(lowerShelfWorld, this.camera, rect);
    const targetShelf = projectPoint(targetShelfWorld, this.camera, rect);
    if (![lower, upper, lowerShelf, targetShelf].every((point) => point.visible)) {
      this.dimensionSvg.hidden = true;
      this.dimensionHandle.hidden = true;
      return;
    }
    this.dimensionSvg.hidden = false;
    this.dimensionHandle.hidden = false;
    setLine(this.dimensionLine, lower.x, lower.y, upper.x, upper.y);
    setLine(this.dimensionExtensionLower, lowerShelf.x, lowerShelf.y, lower.x + 8, lower.y);
    setLine(this.dimensionExtensionUpper, targetShelf.x, targetShelf.y, upper.x + 8, upper.y);
    const labelX = upper.x + 13;
    const labelY = (lower.y + upper.y) / 2;
    this.dimensionLabel.setAttribute("x", labelX);
    this.dimensionLabel.setAttribute("y", labelY);
    this.dimensionHandle.style.left = `${upper.x}px`;
    this.dimensionHandle.style.top = `${upper.y}px`;
    this.syncDimensionDom();
  }

  observeResize() {
    if (!this.runtime) return;
    if (globalThis.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.runtime);
    } else {
      this.resizeFallbackController = new AbortController();
      addEventListener("resize", () => this.resize(), { signal: this.resizeFallbackController.signal });
    }
    this.resize();
  }

  resize() {
    if (!this.runtime || !this.camera) return;
    const rect = this.runtime.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    this.renderer?.setPixelRatio?.(Math.min(devicePixelRatio || 1, MAX_PIXEL_RATIO));
    this.renderer?.setSize?.(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.configureShadowTier(width);
    this.materialSystem?.updateViewportWidth?.(width);
    if (this.modelRoot && !this.userAdjustedCamera) this.fitCamera({ preserveOrientation: false, animate: false });
    else this.updateCamera();
    this.scheduleRender();
  }

  scheduleRender() {
    if (this.disposed || !this.renderer || !this.scene || !this.camera || this.renderFrame !== null || this.cameraAnimationFrame !== null) return;
    const generation = this.renderGeneration;
    this.renderFrame = requestAnimationFrame(() => {
      this.renderFrame = null;
      void this.renderNow().catch((error) => this.handleRenderFailure(error, generation));
    });
  }

  async renderNow() {
    if (this.disposed || !this.renderer || !this.scene || !this.camera) return false;
    if (this.renderPromise) {
      this.renderPending = true;
      return this.renderPromise;
    }
    const generation = this.renderGeneration;
    const renderer = this.renderer;
    const scene = this.scene;
    const camera = this.camera;
    const promise = (async () => {
      const started = performance.now();
      const injectFirstFailure = this.testRenderFailureMode === "first"
        && this.modelRoot
        && this.state === "loading";
      const injectLateFailure = this.testRenderFailureMode === "late" && this.state === "ready";
      if (this.rendererBackend === "webgpu"
        && !this.testRenderFailureInjected
        && (injectFirstFailure || injectLateFailure)) {
        this.testRenderFailureInjected = true;
        throw codedError("LOCAL_TEST_WEBGPU_RENDER_FAILURE", `Injected ${this.testRenderFailureMode} WebGPU render failure.`);
      }
      if (typeof renderer.renderAsync === "function") await renderer.renderAsync(scene, camera);
      else renderer.render(scene, camera);
      if (this.disposed || generation !== this.renderGeneration || renderer !== this.renderer) return false;
      this.renderCount += 1;
      const renderInfo = renderer.info?.render || {};
      this.lastDrawCalls = Number(renderInfo.drawCalls ?? renderInfo.calls ?? 0);
      this.lastTriangleCount = Number(renderInfo.triangles ?? this.layout?.sourceMetadata?.triangles ?? 0);
      this.lastFrameMilliseconds = performance.now() - started;
      this.updateDimensionOverlay();
      this.syncDiagnostics();
      return true;
    })();
    this.renderPromise = promise;
    try {
      return await promise;
    } finally {
      if (this.renderPromise === promise) this.renderPromise = null;
      if (this.renderPending) {
        this.renderPending = false;
        this.scheduleRender();
      }
    }
  }

  async waitForRenderIdle() {
    const pending = this.renderPromise;
    if (!pending) return;
    try {
      await pending;
    } catch {}
  }

  handleRenderFailure(error, generation) {
    if (this.disposed || generation !== this.renderGeneration) return;
    if (this.rendererBackend === "webgpu" && !this.forceWebGL2AfterFailure) {
      void this.fallbackFromWebGpuRenderFailure(error);
      return;
    }
    this.fail(error);
  }

  async fallbackFromWebGpuRenderFailure(error) {
    if (this.disposed || this.rendererBackend !== "webgpu" || this.forceWebGL2AfterFailure || !this.layoutId) {
      return false;
    }
    const failedLayoutId = this.layoutId;
    const restoreViewerFocus = Boolean(this.runtime?.contains(document.activeElement));
    this.forceWebGL2AfterFailure = true;
    this.rendererRenderFailureCount += 1;
    this.rendererFallbackReason = `WebGPU rendering failed; supported WebGL2 fallback activated: ${error?.message || "unknown render error"}`;
    this.rendererInitializationSequence += 1;
    this.renderGeneration += 1;
    this.finishSequence += 1;
    this.cancelCameraAnimation();
    this.cancelRender();
    await this.waitForRenderIdle();
    if (this.disposed) return false;
    this.loadSequence += 1;
    this.fetchAbortController?.abort();
    const layoutId = this.layoutId;
    this.disposeModel();
    if (this.scene) {
      this.scene.environment = null;
      this.scene.clear();
    }
    this.shadowCaster?.shadow?.map?.dispose?.();
    if (this.shadowCaster?.shadow) this.shadowCaster.shadow.map = null;
    this.shadowCaster = null;
    this.shadowTier = null;
    this.directLights.clear();
    safeDisposeRenderer(this.renderer);
    this.renderer = null;
    this.rendererBackend = null;
    this.scene = null;
    this.camera = null;
    if (this.canvas?.isConnected) {
      const replacement = this.canvas.cloneNode(false);
      this.canvas.replaceWith(replacement);
      this.canvas = replacement;
      this.bindControls();
    }
    this.activePointers.clear();
    this.pointerOrbit = null;
    this.pinchState = null;
    this.dimensionDrag = null;
    this.suppressDimensionClick = false;
    this.dimensionHandle?.classList.remove("is-active");
    if (!layoutId || !this.runtime?.isConnected || !this.mountTarget) return false;
    this.state = "loading";
    this.showStatus("Switching renderer", "WebGPU could not complete the frame. Retrying the exact model with supported WebGL2…", { progress: 0 });
    this.notify("loading", {
      layoutId,
      label: this.layout?.label,
      backendFallback: "webgl2",
      failedLayoutId,
      message: "WebGPU could not complete the frame; supported WebGL2 fallback is starting."
    });
    if (restoreViewerFocus) this.status?.focus({ preventScroll: true });
    return this.loadLayout(layoutId, { force: true, preserveJourneyStart: true });
  }

  cancelRender() {
    if (this.renderFrame !== null) cancelAnimationFrame(this.renderFrame);
    this.renderFrame = null;
    this.renderPending = false;
  }

  cancelCameraAnimation() {
    if (this.cameraAnimationFrame !== null) cancelAnimationFrame(this.cameraAnimationFrame);
    this.cameraAnimationFrame = null;
    this.animationFrom = null;
    this.animationTo = null;
  }

  verifyGeometryImmutable() {
    return this.geometryLedger.every((entry) => {
      if (entry.geometry.index !== entry.index
        || entry.geometry.index?.array !== entry.indexArray
        || !typedArrayBytesEqual(entry.geometry.index?.array, entry.indexBytes)
        || JSON.stringify(entry.geometry.groups) !== JSON.stringify(entry.groups)
        || entry.geometry.drawRange.start !== entry.drawRange.start
        || entry.geometry.drawRange.count !== entry.drawRange.count) return false;
      const attributesImmutable = Object.entries(entry.attributes).every(([name, source]) => {
        const current = entry.geometry.attributes[name];
        return current === source.attribute
          && current.array === source.array
          && typedArrayBytesEqual(current.array, source.bytes)
          && current.count === source.count
          && current.itemSize === source.itemSize
          && current.version === source.version;
      });
      if (!attributesImmutable) return false;
      return Object.entries(entry.morphAttributes).every(([name, sources]) => {
        const current = entry.geometry.morphAttributes?.[name] || [];
        return current.length === sources.length && sources.every((source, index) => (
          current[index] === source.attribute
          && current[index].array === source.array
          && typedArrayBytesEqual(current[index].array, source.bytes)
          && current[index].count === source.count
          && current[index].itemSize === source.itemSize
          && current[index].version === source.version
        ));
      });
    });
  }

  readTransformProof() {
    if (!this.modelRoot || !this.layout || !this.targetNode || !this.nativeTargetBounds || !this.nativeTargetTransform) return null;
    const associations = this.gltf.parser.associations;
    this.modelRoot.updateMatrixWorld(true);
    let fixedWorldTranslationMaximumMillimeters = 0;
    let fixedWorldLinearMaximumDelta = 0;
    let fixedLocalPositionMaximumDelta = 0;
    let fixedLocalScaleMaximumDelta = 0;
    let fixedLocalQuaternionMaximumAngleRadians = 0;
    let hardwareWorldTranslationMaximumMillimeters = 0;
    let hardwareWorldLinearMaximumDelta = 0;
    let invalidValues = 0;
    this.modelRoot.traverse((object) => {
      const nodeIndex = associations.get(object)?.nodes;
      if (!Number.isInteger(nodeIndex)) return;
      const native = this.nativeNodeTransforms.get(nodeIndex);
      const current = snapshotTransform(object);
      if (![...current.position, ...current.quaternion, ...current.scale].every(Number.isFinite)) invalidValues += 1;
      if (nodeIndex === this.layout.semanticManifest.targetNodeIndex) return;
      fixedLocalPositionMaximumDelta = Math.max(fixedLocalPositionMaximumDelta, maximumDelta(current.position, native.position));
      fixedLocalScaleMaximumDelta = Math.max(fixedLocalScaleMaximumDelta, maximumDelta(current.scale, native.scale));
      fixedLocalQuaternionMaximumAngleRadians = Math.max(
        fixedLocalQuaternionMaximumAngleRadians,
        quaternionAngle(current.quaternion, native.quaternion)
      );
      if (this.targetDescendantNodeIndices.has(nodeIndex)) return;
      const nativeWorld = this.nativeNodeWorldMatrices.get(nodeIndex);
      const currentWorld = object.matrixWorld.elements;
      fixedWorldTranslationMaximumMillimeters = Math.max(
        fixedWorldTranslationMaximumMillimeters,
        ...[12, 13, 14].map((index) => Math.abs(currentWorld[index] - nativeWorld[index]) * 1000)
      );
      fixedWorldLinearMaximumDelta = Math.max(
        fixedWorldLinearMaximumDelta,
        ...currentWorld.slice(0, 12).map((value, index) => Math.abs(value - nativeWorld[index]))
      );
      if (this.hardwareNodeIndices.has(nodeIndex)) {
        hardwareWorldTranslationMaximumMillimeters = Math.max(
          hardwareWorldTranslationMaximumMillimeters,
          ...[12, 13, 14].map((index) => Math.abs(currentWorld[index] - nativeWorld[index]) * 1000)
        );
        hardwareWorldLinearMaximumDelta = Math.max(
          hardwareWorldLinearMaximumDelta,
          ...currentWorld.slice(0, 12).map((value, index) => Math.abs(value - nativeWorld[index]))
        );
      }
    });
    const definition = this.layout.geometryControlManifest[CONTROL_ID];
    const target = snapshotTransform(this.targetNode);
    const expectedLocalZ = this.nativeTargetTransform.position[2]
      + ((this.smartDimensions[CONTROL_ID] - definition.nativeMillimeters) / 1000) / definition.sourceScaleMetersPerLocalUnit;
    const targetBounds = new THREE.Box3().setFromObject(this.targetNode);
    const lowerBounds = new THREE.Box3().setFromObject(this.lowerAnchorNode);
    const upperBounds = new THREE.Box3().setFromObject(this.upperAnchorNode);
    const modelBounds = new THREE.Box3().setFromObject(this.modelRoot);
    const clearanceMillimeters = (targetBounds.min.y - lowerBounds.max.y) * 1000;
    const upperGapMillimeters = (upperBounds.min.y - targetBounds.max.y) * 1000;
    const thicknessMillimeters = (targetBounds.max.y - targetBounds.min.y) * 1000;
    const collision = this.readCollisionProof(targetBounds);
    return {
      fixedWorldTranslationMaximumMillimeters,
      fixedWorldLinearMaximumDelta,
      fixedLocalPositionMaximumDelta,
      fixedLocalScaleMaximumDelta,
      fixedLocalQuaternionMaximumAngleRadians,
      hardwareWorldTranslationMaximumMillimeters,
      hardwareWorldLinearMaximumDelta,
      targetExpectedLocalZ: expectedLocalZ,
      targetActualLocalZ: target.position[2],
      targetLocalZFormulaDelta: Math.abs(target.position[2] - expectedLocalZ),
      targetNonZPositionMaximumDelta: maximumDelta(target.position.slice(0, 2), this.nativeTargetTransform.position.slice(0, 2)),
      targetScaleMaximumDelta: maximumDelta(target.scale, this.nativeTargetTransform.scale),
      targetQuaternionMaximumAngleRadians: quaternionAngle(target.quaternion, this.nativeTargetTransform.quaternion),
      actualClearanceMillimeters: clearanceMillimeters,
      requestedClearanceMillimeters: this.smartDimensions[CONTROL_ID],
      clearanceDeltaMillimeters: Math.abs(clearanceMillimeters - this.smartDimensions[CONTROL_ID]),
      targetThicknessMillimeters: thicknessMillimeters,
      targetThicknessDeltaMillimeters: Math.abs(thicknessMillimeters - definition.targetThicknessMillimeters),
      upperGapMillimeters,
      targetXZBoundsMaximumDeltaMillimeters: Math.max(
        Math.abs(targetBounds.min.x - this.nativeTargetBounds.min.x),
        Math.abs(targetBounds.max.x - this.nativeTargetBounds.max.x),
        Math.abs(targetBounds.min.z - this.nativeTargetBounds.min.z),
        Math.abs(targetBounds.max.z - this.nativeTargetBounds.max.z)
      ) * 1000,
      modelBoundsDeltaMillimeters: maximumBoxDeltaMillimeters(modelBounds, this.nativeModelBounds),
      invalidValueCount: invalidValues,
      sourceBuffersImmutable: this.geometryContentImmutable,
      nativeDegenerateTriangles: this.nativeDegenerateTriangleCount,
      currentDegenerateTriangles: this.currentDegenerateTriangleCount,
      degenerateTriangleDelta: this.currentDegenerateTriangleCount - this.nativeDegenerateTriangleCount,
      degenerateTriangleMeasurement: {
        coordinateSpace: "primitive-local POSITION accessor",
        metric: "cross-product magnitude (twice triangle area)",
        threshold: 1e-12,
        thresholdUnits: "source-local-unit-squared",
        inclusive: true
      },
      collision,
      endpointCollisionFree: clearanceMillimeters >= -0.25
        && upperGapMillimeters >= -0.25
        && collision.unintendedIntersectionCount === 0,
      geometryMutationCount: this.geometryMutationCount
    };
  }

  readCollisionProof(targetBounds) {
    let fixedPrimitiveCount = 0;
    let nativeIntersectingFixedMeshCount = 0;
    let currentIntersectingFixedMeshCount = 0;
    let unintendedIntersectionCount = 0;
    let maximumPenetrationIncreaseMillimeters = 0;
    const unintendedStablePrimitiveIds = [];
    for (const record of this.meshRecords) {
      if (this.targetDescendantNodeIndices.has(record.nodeIndex)) continue;
      fixedPrimitiveCount += 1;
      const native = this.nativeTargetCollisionDepths.get(record.zoneRecord.stablePrimitiveId) || [0, 0, 0];
      const current = intersectionDepthsMillimeters(targetBounds, new THREE.Box3().setFromObject(record.object));
      const nativeIntersects = native.every((depth) => depth > 0.25);
      const currentIntersects = current.every((depth) => depth > 0.25);
      if (nativeIntersects) nativeIntersectingFixedMeshCount += 1;
      if (currentIntersects) currentIntersectingFixedMeshCount += 1;
      const increase = Math.max(...current.map((depth, index) => depth - native[index]));
      if (currentIntersects) maximumPenetrationIncreaseMillimeters = Math.max(maximumPenetrationIncreaseMillimeters, increase);
      if (currentIntersects && (!nativeIntersects || increase > 0.25)) {
        unintendedIntersectionCount += 1;
        unintendedStablePrimitiveIds.push(record.zoneRecord.stablePrimitiveId);
      }
    }
    return {
      method: "target AABB versus every fixed primitive AABB, bounded by native-overlap profile",
      toleranceMillimeters: 0.25,
      fixedPrimitiveCount,
      nativeIntersectingFixedMeshCount,
      currentIntersectingFixedMeshCount,
      unintendedIntersectionCount,
      maximumPenetrationIncreaseMillimeters,
      unintendedStablePrimitiveIds
    };
  }

  getDiagnostics() {
    const memoryInfo = this.renderer?.info?.memory || {};
    const calls = this.lastDrawCalls;
    const triangles = this.lastTriangleCount || this.layout?.sourceMetadata?.triangles || 0;
    const definition = this.layout?.geometryControlManifest?.[CONTROL_ID];
    const activeMaterials = new Set();
    this.modelRoot?.traverse?.((object) => {
      if (!object.isMesh) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (material) activeMaterials.add(material);
      }
    });
    const environmentRenderTargets = Number(Boolean(this.environmentTexture && this.rendererBackend === "webgl2"));
    const shadowRenderTargets = Number(Boolean(this.shadowRenderingEnabled && this.shadowCaster?.shadow?.map));
    return Object.freeze({
      state: this.state,
      instanceId: this.instanceId,
      layoutId: this.layoutId,
      layoutLabel: this.layout?.label || null,
      backend: this.rendererBackend,
      rendererFallbackReason: this.rendererFallbackReason,
      rendererRenderFailureCount: this.rendererRenderFailureCount,
      threeRevision: THREE.REVISION,
      assetPath: this.layout?.runtimeAsset?.path || null,
      authoritativePath: this.layout?.authoritativeSource?.path || null,
      authoritativeSha256: this.layout?.authoritativeSource?.sha256 || null,
      sourceContractFingerprint: this.layout?.authoritativeSource?.sourceContractFingerprint || null,
      geometryTopologyTransformFingerprintNoMaterial: this.layout?.authoritativeSource?.geometryTopologyTransformFingerprintNoMaterial || null,
      assetSha256: this.assetSha256,
      assetBytes: this.assetBytes,
      requestCount: this.requestCount,
      successfulRequestCount: this.successfulRequestCount,
      parseCount: this.parseCount,
      renderCount: this.renderCount,
      firstUsableMilliseconds: this.firstUsableAt && this.loadStartedAt ? Number((this.firstUsableAt - this.loadStartedAt).toFixed(1)) : null,
      source: this.layout?.sourceMetadata || null,
      smartDimension: definition ? {
        id: CONTROL_ID,
        status: definition.status,
        valueMillimeters: this.smartDimensions[CONTROL_ID],
        valueInches: millimetersToInches(this.smartDimensions[CONTROL_ID]),
        minMillimeters: definition.minMillimeters,
        nativeMillimeters: definition.nativeMillimeters,
        maxMillimeters: definition.maxMillimeters,
        dimensionApplyCount: this.dimensionApplyCount,
        dimensionResetCount: this.dimensionResetCount,
        formula: definition.formula
      } : null,
      camera: this.camera ? {
        position: this.camera.position.toArray(),
        target: this.cameraTarget.toArray(),
        theta: this.theta,
        phi: this.phi,
        radius: this.radius,
        refitCount: this.cameraRefitCount,
        animationActive: this.cameraAnimationFrame !== null
      } : null,
      rendererInfo: {
        calls,
        triangles,
        geometries: Number(memoryInfo.geometries || this.geometryLedger.length),
        materials: activeMaterials.size,
        textures: Number(memoryInfo.textures || this.sourceTextures.size + this.ownedTextures.size),
        renderTargets: environmentRenderTargets + shadowRenderTargets,
        resourceLedgerMethod: "active unique scene materials; renderer memory geometry/texture counters",
        lastFrameMilliseconds: this.lastFrameMilliseconds
      },
      transformProof: this.readTransformProof(),
      appearance: {
        zoneProofMode: this.zoneProofMode,
        premiumModelV1: this.premiumModelV1Diagnostics,
        materialZoneAudit: {
          schema: "jq-immersive-layout-material-zones-v1",
          primitiveCoverage: this.meshRecords.filter(({ zoneRecord }) => Boolean(zoneRecord)).length,
          sourcePrimitiveCount: this.layout?.sourceMetadata?.primitives || 0,
          statusCounts: { ...this.zoneStatusCounts },
          exhaustive: this.meshRecords.length > 0
            && this.meshRecords.every(({ zoneRecord }) => Boolean(zoneRecord))
            && this.meshRecords.length === this.layout?.sourceMetadata?.primitives
        },
        automaticFinishMapping: this.layout?.appearanceManifest?.automaticFinishMapping || null,
        provenPrimitiveCount: this.layout?.appearanceManifest?.provenMeshIndices?.length || 0,
        requestedFinishId: this.requestedFinishId,
        appliedFinishId: this.appliedFinishId,
        environment: {
          profile: ROOM2_APPEARANCE_PROFILE.environment.type,
          url: ROOM2_APPEARANCE_PROFILE.environment.url,
          expectedBytes: ROOM2_APPEARANCE_PROFILE.environment.bytes,
          sha256: this.environmentSha256,
          requestCount: this.environmentRequestCount,
          successfulRequestCount: this.environmentSuccessfulRequestCount,
          assignmentCount: this.environmentAssignmentCount,
          pmremMode: this.environmentPmremMode,
          intensity: this.presentation.environmentIntensity,
          rotationRadians: this.presentation.environmentRotationRadians
        },
        lighting: {
          profile: ROOM2_APPEARANCE_PROFILE.schema,
          directLightCount: this.directLights.size,
          rectAreaLightCount: [...this.directLights.values()].filter((light) => light.isRectAreaLight).length,
          shadowRenderingEnabled: this.shadowRenderingEnabled,
          shadowDisabledReason: this.shadowRenderingEnabled ? null : WEBGPU_DIRECTIONAL_SHADOWS_DISABLED,
          shadowCasterCount: this.shadowRenderingEnabled && this.shadowCaster ? 1 : 0,
          shadowTier: this.shadowRenderingEnabled ? this.shadowTier?.id || null : null,
          shadowMapSize: this.shadowRenderingEnabled ? this.shadowCaster?.shadow?.mapSize?.x || 0 : 0,
          staticShadowUpdates: this.shadowRenderingEnabled && this.renderer?.shadowMap?.autoUpdate === false,
          primitiveDrawCallBudget: this.shadowPrimitiveBudget
        },
        acceptedRoom2MaterialSystem: this.materialSystem?.getDiagnostics?.() || null
      },
      ownership: {
        canvases: this.canvas ? 1 : 0,
        renderers: this.renderer ? 1 : 0,
        parsedRoots: this.modelRoot ? 1 : 0,
        animationLoops: this.rendererBackend === "webgpu" ? 1 : 0,
        activeRafCallbacks: Number(this.renderFrame !== null) + Number(this.cameraAnimationFrame !== null),
        resizeObservers: this.resizeObserver ? 1 : 0,
        resizeListeners: this.resizeFallbackController?.signal.aborted === false ? 1 : 0,
        controlListenerSets: this.controlAbortController?.signal.aborted === false ? 1 : 0
      },
      layoutSwitchCount: this.layoutSwitchCount,
      resourceDisposalCount: this.resourceDisposalCount,
      lastError: this.lastError ? { code: this.lastError.code || "LAYOUT_VIEWER_FAILED", message: this.lastError.message } : null
    });
  }

  syncDiagnostics() {
    const diagnostics = this.getDiagnostics();
    globalThis.__JQ_LAYOUT_VIEWER_DIAGNOSTICS__ = diagnostics;
    globalThis.__JQ_ROOM2_VIEWER_DIAGNOSTICS__ = diagnostics;
    if (this.runtime) {
      this.runtime.dataset.state = this.state;
      this.runtime.dataset.layoutId = this.layoutId || "";
      this.runtime.dataset.rendererBackend = this.rendererBackend || "";
      this.runtime.dataset.rendererRenderFailureCount = String(this.rendererRenderFailureCount);
      this.runtime.dataset.assetSha256 = this.assetSha256 || "";
      this.runtime.dataset.geometryImmutable = String(diagnostics.transformProof?.sourceBuffersImmutable === true);
      this.runtime.dataset.dimensionsVisible = String(this.showDimensions);
      this.runtime.dataset.premiumModelV1 = String(this.premiumModelV1Enabled);
      this.runtime.dataset.premiumModelV1Ready = String(Boolean(this.premiumModelV1Diagnostics));
      this.runtime.dataset.drawCalls = String(diagnostics.rendererInfo.calls);
      this.runtime.dataset.triangles = String(diagnostics.rendererInfo.triangles);
    }
  }

  showStatus(title, message, options = {}) {
    if (!this.status) return;
    this.status.hidden = false;
    this.status.querySelector("[data-viewer-status-title]").textContent = title;
    this.status.querySelector("[data-viewer-status-copy]").textContent = message;
    if (this.statusProgress) {
      const value = clamp(Number(options.progress) || 0, 0, 1) * 100;
      this.statusProgress.hidden = false;
      this.statusProgress.value = value;
      this.statusProgress.textContent = `${Math.round(value)}%`;
    }
    if (this.retryButton) this.retryButton.hidden = true;
    if (this.canvas) this.canvas.tabIndex = -1;
    if (this.dimensionSvg) this.dimensionSvg.hidden = true;
    if (this.dimensionHandle) {
      this.dimensionHandle.hidden = true;
      this.dimensionHandle.disabled = true;
    }
  }

  hideStatus() {
    const restoreCanvasFocus = this.status?.contains(document.activeElement) || document.activeElement === this.status;
    if (this.status) this.status.hidden = true;
    if (this.canvas) this.canvas.tabIndex = 0;
    if (this.dimensionHandle) this.dimensionHandle.disabled = !this.showDimensions;
    if (restoreCanvasFocus) requestAnimationFrame(() => this.canvas?.focus({ preventScroll: true }));
  }

  fail(error) {
    const shouldFocusRetry = document.activeElement === document.body
      || Boolean(this.runtime?.contains(document.activeElement));
    this.cancelCameraAnimation();
    this.cancelRender();
    this.activePointers.clear();
    this.pointerOrbit = null;
    this.pinchState = null;
    this.dimensionDrag = null;
    this.suppressDimensionClick = false;
    this.dimensionHandle?.classList.remove("is-active");
    this.disposeModel();
    this.state = "error";
    this.lastError = error instanceof Error ? error : new Error(String(error));
    if (this.status) {
      this.status.hidden = false;
      this.status.querySelector("[data-viewer-status-title]").textContent = `${this.layout?.label || "Model"} unavailable`;
      this.status.querySelector("[data-viewer-status-copy]").textContent = "The model could not be verified or displayed. No substitute image or geometry was loaded.";
      if (this.statusProgress) this.statusProgress.hidden = true;
      if (this.retryButton) this.retryButton.hidden = false;
    }
    if (this.dimensionSvg) this.dimensionSvg.hidden = true;
    if (this.dimensionHandle) {
      this.dimensionHandle.hidden = true;
      this.dimensionHandle.disabled = true;
    }
    if (this.canvas) this.canvas.tabIndex = -1;
    this.notify("error", { layoutId: this.layoutId, code: this.lastError.code || "LAYOUT_VIEWER_FAILED", message: this.lastError.message });
    this.syncDiagnostics();
    if (this.retryButton && shouldFocusRetry) {
      requestAnimationFrame(() => this.retryButton?.focus({ preventScroll: true }));
    }
  }

  notify(state, details = {}) {
    try {
      this.onStateChange(state, details);
    } catch {}
  }

  disposeActiveFinishMaterials() {
    for (const material of this.ownedMaterials) material.dispose?.();
    this.ownedMaterials.clear();
  }

  disposeModel() {
    this.fetchAbortController?.abort();
    this.fetchAbortController = null;
    this.finishSequence += 1;
    this.disposeActiveFinishMaterials();
    for (const geometry of this.premiumOwnedGeometries) geometry.dispose?.();
    this.premiumOwnedGeometries.clear();
    this.premiumModelV1Diagnostics = null;
    const ownedByMaterialSystem = Boolean(this.materialSystem);
    this.materialSystem?.dispose?.();
    this.materialSystem = null;
    if (!ownedByMaterialSystem) {
      for (const material of this.sourceMaterials) material?.dispose?.();
      for (const texture of this.sourceTextures) texture?.dispose?.();
    }
    for (const texture of this.ownedTextures) texture?.dispose?.();
    this.sourceMaterials.clear();
    this.sourceTextures.clear();
    this.ownedTextures.clear();
    this.finishTextureCache.clear();
    for (const entry of this.geometryLedger) entry.geometry?.dispose?.();
    if (this.modelRoot) this.scene?.remove(this.modelRoot);
    if (this.modelRoot) this.resourceDisposalCount += 1;
    this.modelRoot = null;
    this.gltf = null;
    this.glbInspection = null;
    this.targetNode = null;
    this.lowerAnchorNode = null;
    this.upperAnchorNode = null;
    this.nativeTargetTransform = null;
    this.nativeNodeTransforms.clear();
    this.nativeNodeWorldMatrices.clear();
    this.targetDescendantNodeIndices.clear();
    this.hardwareNodeIndices.clear();
    this.nativeTargetCollisionDepths.clear();
    this.nativeDegenerateTriangleCount = null;
    this.currentDegenerateTriangleCount = null;
    this.nativeModelBounds = null;
    this.nativeTargetBounds = null;
    this.nativeLowerAnchorBounds = null;
    this.nativeUpperAnchorBounds = null;
    this.meshRecords = [];
    this.zoneStatusCounts = {};
    this.shadowPrimitiveBudget = null;
    this.geometryLedger = [];
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.loadSequence += 1;
    this.rendererInitializationSequence += 1;
    this.renderGeneration += 1;
    this.finishSequence += 1;
    this.environmentSequence += 1;
    this.cancelCameraAnimation();
    this.cancelRender();
    this.fetchAbortController?.abort();
    this.environmentAbortController?.abort();
    this.environmentAbortController = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.resizeFallbackController?.abort();
    this.resizeFallbackController = null;
    this.controlAbortController?.abort();
    this.controlAbortController = null;
    this.runtime?.remove();
    this.mountTarget = null;
    const release = () => {
      this.disposeModel();
      if (this.scene) this.scene.environment = null;
      this.environmentTexture?.dispose?.();
      this.environmentTexture = null;
      this.shadowCaster?.shadow?.map?.dispose?.();
      if (this.shadowCaster?.shadow) this.shadowCaster.shadow.map = null;
      this.shadowCaster = null;
      this.shadowTier = null;
      this.directLights.clear();
      this.scene?.clear();
      safeDisposeRenderer(this.renderer);
      this.renderer = null;
      this.scene = null;
      this.camera = null;
      this.runtime = null;
      this.canvas = null;
      this.status = null;
      this.statusProgress = null;
      this.retryButton = null;
      this.dimensionSvg = null;
      this.dimensionLine = null;
      this.dimensionExtensionLower = null;
      this.dimensionExtensionUpper = null;
      this.dimensionLabel = null;
      this.dimensionHandle = null;
      this.state = "disposed";
      this.syncDiagnostics();
    };
    const pendingRender = this.renderPromise;
    if (pendingRender) void pendingRender.catch(() => {}).then(release);
    else release();
  }
}

function snapshotTransform(object) {
  return {
    position: object.position.toArray(),
    quaternion: object.quaternion.toArray(),
    scale: object.scale.toArray()
  };
}

function restoreTransform(object, snapshot) {
  object.position.fromArray(snapshot.position);
  object.quaternion.fromArray(snapshot.quaternion);
  object.scale.fromArray(snapshot.scale);
}

function runtimeNamePath(object) {
  const path = [];
  let cursor = object;
  while (cursor) {
    if (cursor.name) path.push(cursor.name);
    cursor = cursor.parent;
  }
  return path.reverse();
}

function runtimeStableNodePath(object, associations, sourceNodes = []) {
  const parts = [];
  let cursor = object;
  while (cursor) {
    const nodeIndex = associations.get(cursor)?.nodes;
    if (Number.isInteger(nodeIndex)) parts.push(`${nodeIndex}:${sourceNodes[nodeIndex]?.name || "<unnamed>"}`);
    cursor = cursor.parent;
  }
  return `/${parts.reverse().join("/")}`;
}

function copyTypedArrayBytes(array) {
  if (!array?.buffer) return null;
  return new Uint8Array(array.buffer, array.byteOffset, array.byteLength).slice();
}

function typedArrayBytesEqual(array, snapshot) {
  if (!array && !snapshot) return true;
  if (!array?.buffer || !(snapshot instanceof Uint8Array) || array.byteLength !== snapshot.byteLength) return false;
  const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
  for (let index = 0; index < bytes.length; index += 1) {
    if (bytes[index] !== snapshot[index]) return false;
  }
  return true;
}

function countLocalDegenerateTriangles(meshRecords) {
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const edge1 = new THREE.Vector3();
  const edge2 = new THREE.Vector3();
  const cross = new THREE.Vector3();
  let count = 0;
  for (const { object } of meshRecords) {
    const geometry = object.geometry;
    const position = geometry?.attributes?.position;
    if (!position) continue;
    const index = geometry.index;
    const elementCount = index ? index.count : position.count;
    for (let offset = 0; offset + 2 < elementCount; offset += 3) {
      const ai = index ? index.getX(offset) : offset;
      const bi = index ? index.getX(offset + 1) : offset + 1;
      const ci = index ? index.getX(offset + 2) : offset + 2;
      a.fromBufferAttribute(position, ai);
      b.fromBufferAttribute(position, bi);
      c.fromBufferAttribute(position, ci);
      edge1.subVectors(b, a);
      edge2.subVectors(c, a);
      cross.crossVectors(edge1, edge2);
      if (cross.length() <= 1e-12) count += 1;
    }
  }
  return count;
}

function intersectionDepthsMillimeters(left, right) {
  if (!left || !right || left.isEmpty() || right.isEmpty()) return [0, 0, 0];
  return [
    Math.min(left.max.x, right.max.x) - Math.max(left.min.x, right.min.x),
    Math.min(left.max.y, right.max.y) - Math.max(left.min.y, right.min.y),
    Math.min(left.max.z, right.max.z) - Math.max(left.min.z, right.min.z)
  ].map((depth) => depth * 1000);
}

function boxFromRecord(record) {
  return new THREE.Box3(
    new THREE.Vector3(...record.min),
    new THREE.Vector3(...record.max)
  );
}

function maximumBoxDeltaMillimeters(left, right) {
  if (!left || !right) return Number.POSITIVE_INFINITY;
  return Math.max(
    ...left.min.toArray().map((value, index) => Math.abs(value - right.min.toArray()[index]) * 1000),
    ...left.max.toArray().map((value, index) => Math.abs(value - right.max.toArray()[index]) * 1000)
  );
}

function quaternionAngle(left, right) {
  const dot = Math.abs(left.reduce((sum, value, index) => sum + value * right[index], 0));
  const leftMagnitude = Math.hypot(...left);
  const rightMagnitude = Math.hypot(...right);
  if (!Number.isFinite(dot) || leftMagnitude === 0 || rightMagnitude === 0) {
    return Number.POSITIVE_INFINITY;
  }
  return 2 * Math.acos(clamp(dot / (leftMagnitude * rightMagnitude), -1, 1));
}

function disposeObjectGraph(root) {
  root?.traverse?.((object) => {
    object.geometry?.dispose?.();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material) continue;
      for (const slot of TEXTURE_SLOTS) material[slot]?.dispose?.();
      material.dispose?.();
    }
  });
}

function configureRendererAppearance(renderer, presentation, options = {}) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = presentation.toneMapping === "aces-filmic"
    ? THREE.ACESFilmicToneMapping
    : THREE.NeutralToneMapping;
  renderer.toneMappingExposure = presentation.exposure;
  const shadowsEnabled = options.shadowsEnabled ?? ROOM2_APPEARANCE_PROFILE.renderer.shadows.enabled;
  renderer.shadowMap.enabled = shadowsEnabled;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = shadowsEnabled;
  renderer.setClearColor?.(ROOM2_APPEARANCE_PROFILE.renderer.clearColor, 1);
}

function fitDirectionalShadowCamera(light, bounds, definition) {
  if (!light || !bounds) return;
  light.updateMatrixWorld(true);
  light.target.updateMatrixWorld(true);
  light.shadow.updateMatrices(light);
  const camera = light.shadow.camera;
  const corners = [];
  for (const x of [bounds.min[0], bounds.max[0]]) {
    for (const y of [bounds.min[1], bounds.max[1]]) {
      for (const z of [bounds.min[2], bounds.max[2]]) corners.push(new THREE.Vector3(x, y, z));
    }
  }
  const projected = corners.map((point) => point.applyMatrix4(camera.matrixWorldInverse));
  const xs = projected.map((point) => point.x);
  const ys = projected.map((point) => point.y);
  const zs = projected.map((point) => point.z);
  camera.left = Math.min(...xs) - definition.fitPaddingMeters;
  camera.right = Math.max(...xs) + definition.fitPaddingMeters;
  camera.bottom = Math.min(...ys) - definition.fitPaddingMeters;
  camera.top = Math.max(...ys) + definition.fitPaddingMeters;
  camera.near = Math.max(0.05, -Math.max(...zs) - definition.depthPaddingMeters);
  camera.far = Math.max(camera.near + 0.1, -Math.min(...zs) + definition.depthPaddingMeters);
  camera.updateProjectionMatrix();
  light.shadow.updateMatrices(light);
}

function safeDisposeRenderer(renderer) {
  if (!renderer) return;
  try {
    renderer.setAnimationLoop?.(null);
  } catch {}
  try {
    renderer.renderLists?.dispose?.();
  } catch {}
  try {
    renderer.dispose?.();
  } catch {}
  try {
    renderer.forceContextLoss?.();
  } catch {}
}

function projectPoint(point, camera, rect) {
  const projected = point.clone().project(camera);
  return {
    x: (projected.x * 0.5 + 0.5) * rect.width,
    y: (-projected.y * 0.5 + 0.5) * rect.height,
    visible: projected.x >= -1 && projected.x <= 1
      && projected.y >= -1 && projected.y <= 1
      && projected.z >= -1 && projected.z <= 1
  };
}

function setLine(line, x1, y1, x2, y2) {
  line?.setAttribute("x1", x1);
  line?.setAttribute("y1", y1);
  line?.setAttribute("x2", x2);
  line?.setAttribute("y2", y2);
}

function snapDimension(value, definition) {
  const clamped = clamp(value, definition.minMillimeters, definition.maxMillimeters);
  if (Math.abs(clamped - definition.minMillimeters) < definition.stepMillimeters / 2) return definition.minMillimeters;
  if (Math.abs(clamped - definition.maxMillimeters) < definition.stepMillimeters / 2) return definition.maxMillimeters;
  if (Math.abs(clamped - definition.nativeMillimeters) < definition.stepMillimeters / 2) return definition.nativeMillimeters;
  const snapped = definition.nativeMillimeters
    + Math.round((clamped - definition.nativeMillimeters) / definition.stepMillimeters) * definition.stepMillimeters;
  return Number(clamp(snapped, definition.minMillimeters, definition.maxMillimeters).toFixed(6));
}

function distance(left, right) {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

function maximumDelta(left, right) {
  return Math.max(0, ...left.map((value, index) => Math.abs(value - right[index])));
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value)));
}

function codedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
