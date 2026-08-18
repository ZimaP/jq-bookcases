import * as THREE from "./assets/vendor/three.module.js";
import { GLTFLoader } from "./assets/vendor/three-addons/loaders/GLTFLoader.js";
import { RGBELoader } from "./assets/vendor/three-addons/loaders/RGBELoader.js";
import { RectAreaLightUniformsLib } from "./assets/vendor/three-addons/lights/RectAreaLightUniformsLib.js";
import {
  ROOM2_APPEARANCE_PROFILE,
  resolveRoom2Finish,
  resolveRoom2Presentation
} from "./guided-room2-appearance.js?v=room2-commercial-pbr-v1-20260817g";
import { createRoom2MaterialSystem } from "./guided-room2-materials.js?v=room2-commercial-pbr-v1-20260817g";
import {
  createDeferredModelSnapshot,
  createEmbeddedImagePayloadSnapshot,
  createRawMaterialDigest,
  createRuntimeMaterialAppearanceSnapshot,
  createRuntimeMaterialSnapshot,
  inspectRoom2Glb,
  sha256Bytes
} from "./guided-room2-integrity.js?v=room2-commercial-pbr-v1-20260817g";

const SUPPORTED_SELECTION = Object.freeze({
  category: "bookcase",
  style: "cabinet-base-shelves",
  layout: "fireplace-wall"
});
const EXPECTED_COUNTS = Object.freeze({
  scenes: 1,
  nodes: 455,
  meshes: 185,
  primitives: 185,
  accessors: 556,
  vertices: 33934,
  triangles: 18306,
  materials: 8,
  textures: 6,
  images: 6,
  animations: 0,
  cameras: 0
});
const MODEL_PURPOSE = "fixed-room2-reference-glb";
let viewerSequence = 0;
let rectAreaUniformsInitialized = false;
let rectAreaUniformsInitializationCount = 0;

globalThis.__JQ_THREE_REVISION__ = THREE.REVISION;
THREE.ColorManagement.enabled = ROOM2_APPEARANCE_PROFILE.renderer.colorManagement.enabled;

export function createGuidedRoom2ViewerController(options = {}) {
  return new GuidedRoom2ViewerController(options);
}

export class GuidedRoom2ViewerController {
  constructor(options = {}) {
    this.instanceId = ++viewerSequence;
    this.viewerIdentity = `room2-viewer-${this.instanceId}`;
    this.controllerIdentity = `room2-controller-${this.instanceId}`;
    this.rootIdentity = `room2-root-${this.instanceId}`;
    this.onStateChange = typeof options.onStateChange === "function" ? options.onStateChange : () => {};
    this.onError = typeof options.onError === "function" ? options.onError : () => {};
    this.presentation = resolveRoom2Presentation();
    this.selectedFinishId = resolveRoom2Finish(options.finishId).id;

    this.state = "idle";
    this.disposed = false;
    this.failed = false;
    this.lastError = null;
    this.rendererResourcesReleased = false;
    this.mountTarget = null;
    this.ownerWindow = null;
    this.runtime = null;
    this.canvas = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.materialSystem = null;
    this.lastMaterialDiagnostics = null;
    this.environmentSourceTexture = null;
    this.environmentRenderTarget = null;
    this.environmentSha256 = null;
    this.environmentRequestCount = 0;
    this.environmentSuccessfulRequestCount = 0;
    this.directLights = new Map();
    this.shadowCaster = null;
    this.modelRoot = null;
    this.gltf = null;
    this.glbInspection = null;
    this.sourceRuntimeMaterialSnapshot = null;
    this.sourceRuntimeMaterialAppearanceSnapshot = null;
    this.embeddedImagePayloadSnapshot = null;
    this.deferredModelSnapshot = null;
    this.rawMaterialDigest = null;
    this.assetSha256 = null;
    this.assetBuffer = null;
    this.loadPromise = null;
    this.finishPromise = null;
    this.fetchAbortController = null;
    this.resizeObserver = null;
    this.resizeFallbackController = null;
    this.controlAbortController = null;
    this.renderFrame = null;
    this.resizeFrame = null;
    this.activePointers = new Map();
    this.progressBucket = -1;
    this.loadStartedAt = 0;
    this.firstUsableAt = 0;
    this.mountCount = 0;
    this.unmountCount = 0;
    this.requestCount = 0;
    this.successfulRequestCount = 0;
    this.parseCount = 0;
    this.renderCount = 0;
    this.shadowRefreshCount = 0;
    this.shadowRefreshPending = false;
    this.pmremGenerationCount = 0;
    this.pmremGenerationMilliseconds = 0;
    this.compileMilliseconds = 0;
    this.shadowTier = null;
    this.userAdjustedCamera = false;
    this.lastFittedViewportKey = null;
    this.theta = ROOM2_APPEARANCE_PROFILE.camera.theta;
    this.phi = ROOM2_APPEARANCE_PROFILE.camera.phi;
    this.radius = ROOM2_APPEARANCE_PROFILE.camera.minimumFitRadius;
    this.baseRadius = this.radius;
    this.cameraTarget = new THREE.Vector3(...ROOM2_APPEARANCE_PROFILE.camera.target);
    this.lastFrameMilliseconds = null;
    this.lastBeautyPassDrawCalls = null;
    this.lastShadowRefreshDrawCalls = null;
    this.lastFrameTriangles = null;
    this.evidenceMaskMode = null;
    this.evidenceMaskMaterials = new Set();
  }

  mount(target) {
    if (this.disposed) return false;
    if (!target?.ownerDocument || typeof target.append !== "function") {
      return this.fail(new TypeError("A valid Room 2 viewer mount is required."));
    }
    try {
      this.ensureRuntime(target.ownerDocument);
      if (this.mountTarget !== target) this.mountCount += 1;
      this.mountTarget = target;
      this.ownerWindow = target.ownerDocument.defaultView || globalThis.window;
      if (this.runtime.parentNode !== target) target.append(this.runtime);
      this.runtime.hidden = false;
      if (this.failed) {
        this.runtime.hidden = true;
        this.notifyState("fallback", {
          code: this.lastError?.code || "ROOM2_VIEWER_FAILED",
          message: "The fixed Room 2 reference model could not be displayed. No substitute model or image was loaded."
        });
      } else {
        this.observeTarget();
        this.resize();
        if (!this.loadPromise && !this.modelRoot) {
          this.startLoading();
        } else if (this.modelRoot) {
          if (this.state !== "finish-loading" && this.state !== "finish-error") this.notifyState("ready");
          this.requestRender();
        } else {
          this.notifyState("loading", { message: "Loading the fixed Room 2 reference model and selected finish…" });
        }
      }
      this.syncDiagnostics();
      return true;
    } catch (error) {
      return this.fail(error);
    }
  }

  unmount() {
    if (this.disposed) return;
    this.cancelRender();
    this.cancelResize();
    this.resizeObserver?.disconnect();
    this.resizeFallbackController?.abort();
    this.resizeFallbackController = null;
    if (this.mountTarget) this.unmountCount += 1;
    this.runtime?.remove();
    this.mountTarget = null;
    this.syncDiagnostics();
  }

  update(project) {
    if (this.disposed) return false;
    if (!isSupportedSelection(project)) {
      return this.fail(codedError(
        "ROOM2_SELECTION_NOT_SUPPORTED",
        "The fixed Room 2 model is available only for Cabinets + Shelves / Fireplace Wall."
      ));
    }
    const nextFinishId = resolveRoom2Finish(project?.finish).id;
    this.selectedFinishId = nextFinishId;
    if (!this.gltf || !this.deferredModelSnapshot || !this.materialSystem) return true;

    try {
      const cameraBefore = this.cameraStateCanonical();
      this.assertDeferredGeometry();
      this.materialSystem.assertGeometryIdentity();
      if (this.cameraStateCanonical() !== cameraBefore) {
        throw codedError("ROOM2_DEFERRED_CAMERA_MUTATION", "A customer control reset the Room 2 camera.");
      }
      this.finishPromise = this.materialSystem.selectFinish(nextFinishId)
        .then((applied) => {
          if (this.disposed || !applied) return applied;
          this.assertDeferredGeometry();
          this.materialSystem.assertGeometryIdentity();
          this.lastMaterialDiagnostics = this.materialSystem.getDiagnostics();
          this.syncDiagnostics();
          return true;
        })
        .catch((error) => this.fail(error));
      this.syncDiagnostics();
      return true;
    } catch (error) {
      return this.fail(error);
    }
  }

  zoom(action) {
    if (this.disposed || !this.camera) return false;
    if (action === "reset") return this.resetCamera();
    if (action !== "in" && action !== "out") return false;
    this.radius = clamp(
      this.radius * (action === "in" ? 0.86 : 1.16),
      ROOM2_APPEARANCE_PROFILE.camera.minimumRadius,
      ROOM2_APPEARANCE_PROFILE.camera.maximumRadius
    );
    this.userAdjustedCamera = true;
    this.updateCamera();
    return true;
  }

  resetCamera() {
    if (this.disposed || !this.camera) return false;
    this.theta = ROOM2_APPEARANCE_PROFILE.camera.theta;
    this.phi = ROOM2_APPEARANCE_PROFILE.camera.phi;
    this.cameraTarget.set(...ROOM2_APPEARANCE_PROFILE.camera.target);
    this.userAdjustedCamera = false;
    this.fitCameraForViewport();
    return true;
  }

  getDiagnostics() {
    const materialDiagnostics = this.materialSystem?.getDiagnostics() || this.lastMaterialDiagnostics;
    return Object.freeze({
      state: this.state,
      viewerIdentity: this.viewerIdentity,
      controllerIdentity: this.controllerIdentity,
      parsedRootIdentity: this.modelRoot ? this.rootIdentity : null,
      modelPurpose: MODEL_PURPOSE,
      appearanceProfile: ROOM2_APPEARANCE_PROFILE.schema,
      appearanceStatus: ROOM2_APPEARANCE_PROFILE.status,
      presentation: this.presentation,
      selectedFinishId: this.selectedFinishId,
      assetUrl: ROOM2_APPEARANCE_PROFILE.asset.url,
      assetBytes: this.assetBuffer?.byteLength || 0,
      assetSha256: this.assetSha256,
      geometryFingerprint: this.modelRoot ? ROOM2_APPEARANCE_PROFILE.asset.geometryFingerprint : null,
      rawMaterialDigest: this.rawMaterialDigest,
      embeddedImagePayloadDigest: this.embeddedImagePayloadSnapshot?.aggregateSha256 || null,
      embeddedImagePayloadSnapshot: this.embeddedImagePayloadSnapshot,
      sourceRuntimeMaterialDigest: this.sourceRuntimeMaterialSnapshot?.aggregateSha256 || null,
      sourceRuntimeMaterialAppearanceDigest: this.sourceRuntimeMaterialAppearanceSnapshot?.aggregateSha256 || null,
      runtimeAppearanceFingerprint: materialDiagnostics?.appearanceFingerprint || null,
      runtimeAppearanceFingerprintVersion: materialDiagnostics?.appearanceFingerprintVersion || null,
      runtimeModelFingerprint: this.deferredModelSnapshot?.fingerprint || null,
      sourceRuntimeMaterialSnapshot: this.sourceRuntimeMaterialSnapshot,
      sourceRuntimeMaterialAppearanceSnapshot: this.sourceRuntimeMaterialAppearanceSnapshot,
      materialSystem: materialDiagnostics,
      deferredModelSnapshot: this.deferredModelSnapshot ? Object.freeze({
        schema: this.deferredModelSnapshot.schema,
        nodeCount: this.deferredModelSnapshot.nodeCount,
        meshCount: this.deferredModelSnapshot.meshCount,
        fingerprint: this.deferredModelSnapshot.fingerprint,
        canonical: this.deferredModelSnapshot.canonical
      }) : null,
      requestCount: this.requestCount,
      successfulRequestCount: this.successfulRequestCount,
      parseCount: this.parseCount,
      renderCount: this.renderCount,
      mountCount: this.mountCount,
      unmountCount: this.unmountCount,
      firstUsableMilliseconds: this.firstUsableAt && this.loadStartedAt
        ? Number((this.firstUsableAt - this.loadStartedAt).toFixed(1))
        : null,
      nodeCount: this.glbInspection?.counts.nodes || 0,
      meshCount: this.glbInspection?.counts.meshes || 0,
      primitiveCount: this.glbInspection?.counts.primitives || 0,
      vertexCount: this.glbInspection?.counts.vertices || 0,
      triangleCount: this.glbInspection?.counts.triangles || 0,
      camera: this.readCameraState(),
      projection: this.readProjectionState(),
      renderer: this.readRendererState(),
      rendererInfo: this.readRendererInfo(),
      lighting: this.readLightingState(),
      environment: Object.freeze({
        type: ROOM2_APPEARANCE_PROFILE.environment.type,
        url: ROOM2_APPEARANCE_PROFILE.environment.url,
        expectedBytes: ROOM2_APPEARANCE_PROFILE.environment.bytes,
        sha256: this.environmentSha256,
        requestCount: this.environmentRequestCount,
        successfulRequestCount: this.environmentSuccessfulRequestCount,
        intensity: this.presentation.environmentIntensity,
        rotationRadians: this.presentation.environmentRotationRadians,
        visibleBackground: false,
        generationCount: this.pmremGenerationCount,
        generationMilliseconds: roundDiagnostic(this.pmremGenerationMilliseconds),
        retainedRenderTargets: this.environmentRenderTarget ? 1 : 0
      }),
      shadows: Object.freeze({
        casterCount: this.shadowCaster ? 1 : 0,
        casterRole: this.shadowCaster ? "key.shadowProxy" : null,
        tier: this.shadowTier?.id || null,
        mapSize: this.shadowCaster?.shadow?.mapSize?.x || 0,
        camera: this.shadowCaster ? Object.freeze({
          left: roundDiagnostic(this.shadowCaster.shadow.camera.left),
          right: roundDiagnostic(this.shadowCaster.shadow.camera.right),
          top: roundDiagnostic(this.shadowCaster.shadow.camera.top),
          bottom: roundDiagnostic(this.shadowCaster.shadow.camera.bottom),
          near: roundDiagnostic(this.shadowCaster.shadow.camera.near),
          far: roundDiagnostic(this.shadowCaster.shadow.camera.far)
        }) : null,
        bias: this.shadowCaster ? roundDiagnostic(this.shadowCaster.shadow.bias) : null,
        normalBias: this.shadowCaster ? roundDiagnostic(this.shadowCaster.shadow.normalBias) : null,
        refreshCount: this.shadowRefreshCount,
        refreshPending: this.shadowRefreshPending,
        autoUpdate: Boolean(this.renderer?.shadowMap?.autoUpdate)
      }),
      performance: Object.freeze({
        compileMilliseconds: roundDiagnostic(this.compileMilliseconds),
        lastFrameMilliseconds: roundDiagnostic(this.lastFrameMilliseconds),
        beautyPassDrawCalls: this.lastBeautyPassDrawCalls,
        shadowRefreshTotalDrawCalls: this.lastShadowRefreshDrawCalls,
        beautyPassTriangles: this.lastFrameTriangles,
        postProcessingFullscreenPasses: 0,
        gtaoPasses: 0,
        denoisePasses: 0
      }),
      evidenceMaskMode: this.evidenceMaskMode,
      ownership: Object.freeze({
        canvases: this.canvas ? 1 : 0,
        renderers: this.renderer && !this.rendererResourcesReleased ? 1 : 0,
        materialSystems: this.materialSystem ? 1 : 0,
        controllers: this.disposed ? 0 : 1,
        parsedRoots: this.modelRoot ? 1 : 0,
        animationLoops: 0,
        renderFrames: this.renderFrame === null ? 0 : 1,
        resizeObservers: this.resizeObserver && this.mountTarget ? 1 : 0,
        resizeListeners: this.resizeFallbackController?.signal.aborted === false ? 1 : 0,
        controlListenerSets: this.controlAbortController?.signal.aborted === false ? 1 : 0
      })
    });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.fetchAbortController?.abort();
    this.cancelRender();
    this.cancelResize();
    this.resizeObserver?.disconnect();
    this.resizeFallbackController?.abort();
    this.controlAbortController?.abort();
    this.activePointers.clear();
    this.lastMaterialDiagnostics = this.materialSystem?.getDiagnostics() || this.lastMaterialDiagnostics;
    this.materialSystem?.dispose();
    this.materialSystem = null;
    disposeGeometryOnly(this.modelRoot);
    disposeSet(this.evidenceMaskMaterials);
    this.evidenceMaskMode = null;
    if (this.scene) this.scene.environment = null;
    this.environmentSourceTexture?.dispose?.();
    this.environmentSourceTexture = null;
    this.environmentRenderTarget?.dispose?.();
    this.environmentRenderTarget = null;
    this.directLights.clear();
    this.shadowCaster = null;
    this.scene?.clear();
    this.renderer?.renderLists?.dispose();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss?.();
    this.runtime?.remove();
    this.mountTarget = null;
    this.runtime = null;
    this.canvas = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.modelRoot = null;
    this.gltf = null;
    this.assetBuffer = null;
    this.state = "disposed";
    if (globalThis.__JQ_ROOM2_EVIDENCE_CONTROLLER__ === this) delete globalThis.__JQ_ROOM2_EVIDENCE_CONTROLLER__;
    publishDiagnostics(this.getDiagnostics());
  }

  ensureRuntime(documentRef) {
    if (this.runtime && this.renderer) return;
    const runtime = documentRef.createElement("div");
    runtime.className = "guided-3d-runtime guided-room2-runtime";
    runtime.dataset.guided3dInstance = String(this.instanceId);
    runtime.dataset.scenePurpose = MODEL_PURPOSE;

    const instructions = documentRef.createElement("p");
    instructions.id = `room2-viewer-instructions-${this.instanceId}`;
    instructions.className = "visually-hidden";
    instructions.textContent = "Fixed Room 2 reference model. Drag or use arrow keys to orbit, use plus and minus to zoom, and press 0 or Home to reset.";

    const hint = documentRef.createElement("div");
    hint.className = "guided-3d-hint";
    hint.setAttribute("aria-hidden", "true");
    for (const label of ["Drag to orbit", "Focus + scroll or + / −", "0 resets"]) {
      const item = documentRef.createElement("span");
      item.textContent = label;
      hint.append(item);
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(ROOM2_APPEARANCE_PROFILE.renderer.clearColor);
    if (THREE.ColorManagement.workingColorSpace !== THREE.LinearSRGBColorSpace) {
      throw codedError("ROOM2_COLOR_PIPELINE_MISMATCH", "The Room 2 renderer working color space is not Linear-sRGB.");
    }
    const camera = new THREE.PerspectiveCamera(
      ROOM2_APPEARANCE_PROFILE.camera.fov,
      1,
      ROOM2_APPEARANCE_PROFILE.camera.near,
      ROOM2_APPEARANCE_PROFILE.camera.far
    );
    camera.filmGauge = ROOM2_APPEARANCE_PROFILE.camera.filmGauge;
    const renderer = new THREE.WebGLRenderer({
      antialias: ROOM2_APPEARANCE_PROFILE.renderer.antialias,
      alpha: false,
      powerPreference: "high-performance"
    });
    renderer.outputColorSpace = resolveOutputColorSpace(ROOM2_APPEARANCE_PROFILE.renderer.outputColorSpace);
    renderer.toneMapping = resolveToneMapping(this.presentation.toneMapping);
    renderer.toneMappingExposure = this.presentation.exposure;
    renderer.shadowMap.enabled = ROOM2_APPEARANCE_PROFILE.renderer.shadows.enabled;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = false;
    renderer.setClearColor(ROOM2_APPEARANCE_PROFILE.renderer.clearColor, 1);

    const canvas = renderer.domElement;
    canvas.className = "guided-3d-canvas guided-room2-canvas";
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "application");
    canvas.setAttribute("aria-roledescription", "interactive 3D viewer");
    canvas.setAttribute("aria-label", "Fixed Room 2 fireplace bookcase reference model with provisional digital finish");
    canvas.setAttribute("aria-describedby", instructions.id);
    canvas.dataset.guided3dInstance = String(this.instanceId);

    runtime.append(canvas, hint, instructions);
    this.runtime = runtime;
    this.canvas = canvas;
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.materialSystem = createRoom2MaterialSystem({
      THREE,
      renderer,
      viewportWidth: documentRef.defaultView?.innerWidth,
      notifyState: (state, details) => this.notifyState(state, details),
      requestRender: () => this.requestRender()
    });
    this.setupAppearance();
    this.bindControls();
    this.positionCamera();
    if (isEvidenceRuntimeAllowed()) globalThis.__JQ_ROOM2_EVIDENCE_CONTROLLER__ = this;
  }

  setupAppearance() {
    ensureRectAreaUniformsInitialized();
    const target = new THREE.Vector3(...ROOM2_APPEARANCE_PROFILE.bounds.hero.center);
    const keyDefinition = ROOM2_APPEARANCE_PROFILE.lighting.key;
    const fillDefinition = ROOM2_APPEARANCE_PROFILE.lighting.fill;

    const keyArea = new THREE.RectAreaLight(
      keyDefinition.area.color,
      keyDefinition.area.intensity * this.presentation.areaKeyScale,
      keyDefinition.area.width,
      keyDefinition.area.height
    );
    keyArea.name = "room2-commercial-key-area";
    keyArea.position.set(...keyDefinition.area.position);
    keyArea.lookAt(target);
    keyArea.castShadow = false;
    this.scene.add(keyArea);
    this.directLights.set("key-area", keyArea);

    const proxyDefinition = keyDefinition.shadowProxy;
    const shadowProxy = new THREE.DirectionalLight(
      proxyDefinition.color,
      proxyDefinition.intensity * this.presentation.shadowProxyScale
    );
    shadowProxy.name = "room2-commercial-key-shadow-proxy";
    shadowProxy.position.set(...proxyDefinition.position);
    shadowProxy.target.position.copy(target);
    shadowProxy.castShadow = true;
    shadowProxy.shadow.bias = ROOM2_APPEARANCE_PROFILE.lighting.shadows.bias;
    shadowProxy.shadow.normalBias = ROOM2_APPEARANCE_PROFILE.lighting.shadows.normalBias;
    this.scene.add(shadowProxy, shadowProxy.target);
    this.directLights.set("key-shadow-proxy", shadowProxy);
    this.shadowCaster = shadowProxy;

    const fillArea = new THREE.RectAreaLight(
      fillDefinition.area.color,
      fillDefinition.area.intensity * this.presentation.areaFillScale,
      fillDefinition.area.width,
      fillDefinition.area.height
    );
    fillArea.name = "room2-commercial-fill-area";
    fillArea.position.set(...fillDefinition.area.position);
    fillArea.lookAt(target);
    fillArea.castShadow = false;
    this.scene.add(fillArea);
    this.directLights.set("fill-area", fillArea);

    this.configureShadowTier(Number.POSITIVE_INFINITY);
    fitDirectionalShadowCamera(
      shadowProxy,
      ROOM2_APPEARANCE_PROFILE.bounds.full,
      ROOM2_APPEARANCE_PROFILE.lighting.shadows
    );
  }

  configureShadowTier(cssWidth) {
    if (!this.shadowCaster) return;
    const tiers = ROOM2_APPEARANCE_PROFILE.lighting.shadows.tiers;
    const tier = tiers.find((candidate) => candidate.maximumCssWidth == null || cssWidth <= candidate.maximumCssWidth) || tiers.at(-1);
    if (!tier || this.shadowTier?.id === tier.id) return;
    this.shadowTier = tier;
    this.shadowCaster.shadow.map?.dispose?.();
    this.shadowCaster.shadow.map = null;
    this.shadowCaster.shadow.mapSize.set(tier.mapSize, tier.mapSize);
    this.requestShadowRefresh();
  }

  requestShadowRefresh() {
    if (!this.renderer?.shadowMap?.enabled || !this.shadowCaster) return;
    this.renderer.shadowMap.needsUpdate = true;
    this.shadowRefreshPending = true;
  }

  startLoading() {
    this.loadStartedAt = performance.now();
    this.fetchAbortController = new AbortController();
    this.notifyState("loading", {
      finishId: this.selectedFinishId,
      message: "Loading the fixed Room 2 reference model and selected provisional finish…",
      progress: 0
    });
    this.loadPromise = this.loadModel(this.fetchAbortController.signal)
      .catch((error) => this.fail(error));
  }

  async loadModel(signal) {
    const selectedAtStart = this.selectedFinishId;
    const [buffer] = await Promise.all([
      this.fetchAsset(signal),
      this.materialSystem.prepareInitialFinish(selectedAtStart),
      this.loadStudioEnvironment(signal)
    ]);
    if (signal.aborted || this.disposed) return;
    this.assetBuffer = buffer;
    if (buffer.byteLength !== ROOM2_APPEARANCE_PROFILE.asset.bytes) {
      throw codedError("ROOM2_ASSET_SIZE_MISMATCH", `Room 2 asset size ${buffer.byteLength} does not match the published authority.`);
    }
    this.assetSha256 = await sha256Bytes(buffer);
    if (this.assetSha256 !== ROOM2_APPEARANCE_PROFILE.asset.sha256) {
      throw codedError("ROOM2_ASSET_HASH_MISMATCH", "Room 2 asset bytes do not match the published authority.");
    }

    this.glbInspection = inspectRoom2Glb(buffer);
    for (const [key, expected] of Object.entries(EXPECTED_COUNTS)) {
      if (this.glbInspection.counts[key] !== expected) {
        throw codedError("ROOM2_ASSET_SCHEMA_MISMATCH", `Room 2 ${key} count differs from the published authority.`);
      }
    }
    this.rawMaterialDigest = await createRawMaterialDigest(this.glbInspection.json);
    if (this.rawMaterialDigest !== ROOM2_APPEARANCE_PROFILE.asset.rawMaterialDigest) {
      throw codedError("ROOM2_RAW_MATERIAL_DIGEST_MISMATCH", "Room 2 raw material assignments differ from the published authority.");
    }
    this.embeddedImagePayloadSnapshot = await createEmbeddedImagePayloadSnapshot(this.glbInspection);
    if (this.embeddedImagePayloadSnapshot.aggregateSha256 !== ROOM2_APPEARANCE_PROFILE.asset.embeddedImageAggregate) {
      throw codedError("ROOM2_EMBEDDED_IMAGE_DIGEST_MISMATCH", "Room 2 embedded image payloads differ from the published authority.");
    }

    const loader = new GLTFLoader();
    this.parseCount += 1;
    const gltf = await loader.parseAsync(buffer, new URL("./assets/models/room2/", document.baseURI).href);
    if (signal.aborted || this.disposed) {
      disposeObject3D(gltf.scene);
      return;
    }
    // Claim the parsed scene before any validation or material work that can throw.
    // The fatal path can therefore always release GLTF-owned GPU resources.
    this.gltf = gltf;
    this.modelRoot = gltf.scene;
    this.validateParsedScene(gltf);
    this.sourceRuntimeMaterialSnapshot = await createRuntimeMaterialSnapshot(gltf, this.glbInspection.json);
    this.sourceRuntimeMaterialAppearanceSnapshot = await createRuntimeMaterialAppearanceSnapshot(gltf, this.glbInspection.json);
    await this.materialSystem.bindModel(gltf, this.glbInspection.json, this.selectedFinishId);
    this.modelRoot.updateMatrixWorld(true);
    this.deferredModelSnapshot = createDeferredModelSnapshot(gltf);
    this.materialSystem.assertGeometryIdentity();
    this.applyEvidenceMaskFromLocation();
    this.scene.add(this.modelRoot);
    this.failed = false;
    this.lastError = null;
    this.fitCameraForViewport();
    this.requestShadowRefresh();
    if (typeof this.renderer.compileAsync === "function") {
      const compileStartedAt = performance.now();
      await this.renderer.compileAsync(this.scene, this.camera);
      this.compileMilliseconds = performance.now() - compileStartedAt;
      if (signal.aborted || this.disposed) return;
    }
    this.lastMaterialDiagnostics = this.materialSystem.getDiagnostics();
    this.requestRender();
    this.syncDiagnostics();
  }

  async fetchAsset(signal) {
    this.requestCount += 1;
    const response = await fetch(ROOM2_APPEARANCE_PROFILE.asset.url, {
      method: "GET",
      credentials: "same-origin",
      cache: "default",
      signal
    });
    if (!response.ok || response.type === "opaque") {
      throw codedError("ROOM2_ASSET_REQUEST_FAILED", `Room 2 model request failed with status ${response.status || "unknown"}.`);
    }
    requireSameOrigin(response.url, "ROOM2_ASSET_CROSS_ORIGIN", "The Room 2 model did not resolve to this site origin.");
    this.successfulRequestCount += 1;
    const total = Number(response.headers.get("content-length")) || ROOM2_APPEARANCE_PROFILE.asset.bytes;
    if (!response.body?.getReader) return response.arrayBuffer();

    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
      const bucket = Math.min(10, Math.floor((received / total) * 10));
      if (bucket !== this.progressBucket) {
        this.progressBucket = bucket;
        this.notifyState("loading", {
          finishId: this.selectedFinishId,
          message: `Loading Room 2 and the selected provisional finish… ${Math.min(100, bucket * 10)}%`,
          progress: Math.min(100, bucket * 10)
        });
      }
    }
    return concatenateChunks(chunks, received);
  }

  async loadStudioEnvironment(signal) {
    const definition = ROOM2_APPEARANCE_PROFILE.environment;
    this.environmentRequestCount += 1;
    const response = await fetch(definition.url, {
      method: "GET",
      credentials: "same-origin",
      cache: "default",
      signal
    });
    if (!response.ok || response.type === "opaque") {
      throw codedError("ROOM2_ENVIRONMENT_REQUEST_FAILED", `Room 2 environment request failed with status ${response.status || "unknown"}.`);
    }
    requireSameOrigin(response.url, "ROOM2_ENVIRONMENT_CROSS_ORIGIN", "The Room 2 environment did not resolve to this site origin.");
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength !== definition.bytes) {
      throw codedError("ROOM2_ENVIRONMENT_SIZE_MISMATCH", `Room 2 environment size ${buffer.byteLength} differs from its manifest.`);
    }
    this.environmentSha256 = await sha256Bytes(buffer);
    if (this.environmentSha256 !== definition.sha256) {
      throw codedError("ROOM2_ENVIRONMENT_HASH_MISMATCH", "Room 2 environment bytes differ from their manifest.");
    }
    this.environmentSuccessfulRequestCount += 1;
    if (signal.aborted || this.disposed) return;

    const decoded = new RGBELoader().parse(buffer);
    const texture = new THREE.DataTexture(decoded.data, decoded.width, decoded.height, THREE.RGBAFormat, decoded.type);
    texture.name = "room2-commercial-neutral-studio-source";
    texture.colorSpace = THREE.LinearSRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.flipY = true;
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.needsUpdate = true;
    const startedAt = performance.now();
    const generator = new THREE.PMREMGenerator(this.renderer);
    try {
      generator.compileEquirectangularShader();
      this.environmentRenderTarget = generator.fromEquirectangular(texture);
      this.pmremGenerationCount += 1;
      if (this.pmremGenerationCount > definition.maximumGenerationsPerViewer) {
        throw codedError("ROOM2_PMREM_GENERATION_LIMIT", "The Room 2 studio environment was generated more than once.");
      }
      this.scene.environment = this.environmentRenderTarget.texture;
      this.scene.environmentIntensity = this.presentation.environmentIntensity;
      this.scene.environmentRotation.set(0, this.presentation.environmentRotationRadians, 0);
      texture.dispose();
      this.environmentSourceTexture = null;
    } catch (error) {
      texture.dispose();
      throw error;
    } finally {
      generator.dispose();
      this.pmremGenerationMilliseconds = performance.now() - startedAt;
    }
  }

  validateParsedScene(gltf) {
    if (!gltf?.scene || !Array.isArray(gltf.scenes) || gltf.scenes.length !== 1) {
      throw codedError("ROOM2_PARSE_CONTRACT_FAILED", "The Room 2 GLB did not parse to one scene.");
    }
    if (gltf.scene.parent !== null) throw codedError("ROOM2_ROOT_ALREADY_ATTACHED", "The parsed Room 2 root already has a parent.");
    const identity = {
      position: gltf.scene.position.toArray(),
      quaternion: gltf.scene.quaternion.toArray(),
      scale: gltf.scene.scale.toArray()
    };
    if (
      JSON.stringify(identity.position) !== JSON.stringify([0, 0, 0])
      || JSON.stringify(identity.quaternion) !== JSON.stringify([0, 0, 0, 1])
      || JSON.stringify(identity.scale) !== JSON.stringify([1, 1, 1])
    ) throw codedError("ROOM2_ROOT_TRANSFORM_MISMATCH", "The parsed Room 2 root transform differs from authority.");

    gltf.scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(gltf.scene);
    const expected = ROOM2_APPEARANCE_PROFILE.bounds.full;
    const actual = { min: bounds.min.toArray(), max: bounds.max.toArray() };
    for (const side of ["min", "max"]) {
      actual[side].forEach((value, index) => {
        if (Math.abs(value - expected[side][index]) > 1e-5) {
          throw codedError("ROOM2_WORLD_BOUNDS_MISMATCH", "The parsed Room 2 bounds differ from authority.");
        }
      });
    }
  }

  assertDeferredGeometry() {
    const snapshot = createDeferredModelSnapshot(this.gltf);
    if (snapshot.canonical !== this.deferredModelSnapshot.canonical) {
      throw codedError("ROOM2_DEFERRED_MODEL_MUTATION", "A customer control changed the fixed Room 2 model.");
    }
    return true;
  }

  applyEvidenceMaskFromLocation() {
    if (!isEvidenceRuntimeAllowed()) return;
    const mode = new URLSearchParams(globalThis.location?.search || "").get("room2Mask");
    if (mode !== "finish-target") return;
    const target = new THREE.MeshBasicMaterial({ color: 0xff2bd6, toneMapped: false });
    const context = new THREE.MeshBasicMaterial({ color: 0x18212a, toneMapped: false });
    target.name = "room2-evidence-finish-target";
    context.name = "room2-evidence-context";
    this.evidenceMaskMaterials.add(target);
    this.evidenceMaskMaterials.add(context);
    this.modelRoot.traverse((object) => {
      if (!object.isMesh) return;
      object.material = object.userData?.room2OriginalMaterialIndex === 3 ? target : context;
    });
    this.evidenceMaskMode = mode;
  }

  bindControls() {
    this.controlAbortController?.abort();
    this.controlAbortController = new AbortController();
    const signal = this.controlAbortController.signal;
    const canvas = this.canvas;
    const finishPointer = (event) => {
      this.activePointers.delete(event.pointerId);
      if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      if (!this.activePointers.size) delete canvas.dataset.interacting;
    };
    canvas.addEventListener("pointerdown", (event) => {
      if (event.button != null && event.button !== 0) return;
      event.preventDefault();
      canvas.focus({ preventScroll: true });
      canvas.setPointerCapture?.(event.pointerId);
      this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      canvas.dataset.interacting = "true";
      this.userAdjustedCamera = true;
    }, { signal });
    canvas.addEventListener("pointermove", (event) => {
      const previous = this.activePointers.get(event.pointerId);
      if (!previous) return;
      event.preventDefault();
      this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      this.theta = clamp(
        this.theta - (event.clientX - previous.x) * 0.006,
        ROOM2_APPEARANCE_PROFILE.camera.minimumTheta,
        ROOM2_APPEARANCE_PROFILE.camera.maximumTheta
      );
      this.phi = clamp(
        this.phi + (event.clientY - previous.y) * 0.0045,
        ROOM2_APPEARANCE_PROFILE.camera.minimumPhi,
        ROOM2_APPEARANCE_PROFILE.camera.maximumPhi
      );
      this.updateCamera();
    }, { signal });
    canvas.addEventListener("pointerup", finishPointer, { signal });
    canvas.addEventListener("pointercancel", finishPointer, { signal });
    canvas.addEventListener("lostpointercapture", finishPointer, { signal });
    canvas.addEventListener("wheel", (event) => {
      const active = canvas.ownerDocument.activeElement;
      if (active !== canvas && !this.runtime.contains(active)) return;
      if (event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      this.zoom(event.deltaY < 0 ? "in" : "out");
    }, { passive: false, signal });
    canvas.addEventListener("keydown", (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "0" || event.key === "Home") {
        event.preventDefault();
        this.resetCamera();
        return;
      }
      if (["+", "="].includes(event.key)) {
        event.preventDefault();
        this.zoom("in");
        return;
      }
      if (["-", "_"].includes(event.key)) {
        event.preventDefault();
        this.zoom("out");
        return;
      }
      if (event.key === "ArrowLeft") this.theta += 0.1;
      else if (event.key === "ArrowRight") this.theta -= 0.1;
      else if (event.key === "ArrowUp") this.phi += 0.075;
      else if (event.key === "ArrowDown") this.phi -= 0.075;
      else return;
      event.preventDefault();
      this.theta = clamp(this.theta, ROOM2_APPEARANCE_PROFILE.camera.minimumTheta, ROOM2_APPEARANCE_PROFILE.camera.maximumTheta);
      this.phi = clamp(this.phi, ROOM2_APPEARANCE_PROFILE.camera.minimumPhi, ROOM2_APPEARANCE_PROFILE.camera.maximumPhi);
      this.userAdjustedCamera = true;
      this.updateCamera();
    }, { signal });
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      this.fail(codedError("ROOM2_WEBGL_CONTEXT_LOST", "The Room 2 viewer lost its graphics context."));
    }, { signal });
  }

  observeTarget() {
    this.resizeObserver?.disconnect();
    this.resizeFallbackController?.abort();
    this.resizeFallbackController = null;
    const ResizeObserverClass = this.ownerWindow?.ResizeObserver || globalThis.ResizeObserver;
    if (typeof ResizeObserverClass === "function") {
      this.resizeObserver ||= new ResizeObserverClass(() => this.scheduleResize());
      this.resizeObserver.observe(this.mountTarget);
      return;
    }
    this.resizeFallbackController = new AbortController();
    this.ownerWindow?.addEventListener("resize", () => this.resize(), { signal: this.resizeFallbackController.signal });
  }

  resize() {
    if (this.disposed || !this.renderer || !this.camera || !this.runtime?.isConnected) return;
    const rect = this.runtime.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width || this.mountTarget?.clientWidth || 1));
    const height = Math.max(1, Math.round(rect.height || this.mountTarget?.clientHeight || 1));
    const dpr = Math.min(
      ROOM2_APPEARANCE_PROFILE.renderer.maximumDevicePixelRatio,
      Math.max(1, Number(this.ownerWindow?.devicePixelRatio) || 1)
    );
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    const viewportWidth = Number(this.ownerWindow?.innerWidth) || width;
    this.configureShadowTier(viewportWidth);
    this.materialSystem?.updateViewportWidth(viewportWidth);
    this.camera.aspect = width / height;
    this.camera.filmGauge = ROOM2_APPEARANCE_PROFILE.camera.filmGauge;
    this.camera.setFocalLength(ROOM2_APPEARANCE_PROFILE.camera.expectedFocalLengthMillimeters);
    this.camera.updateProjectionMatrix();
    const viewportKey = this.currentViewportKey();
    if (!this.userAdjustedCamera && (!this.modelRoot || this.lastFittedViewportKey !== viewportKey)) {
      this.fitCameraForViewport();
    }
    this.lastMaterialDiagnostics = this.materialSystem?.getDiagnostics() || this.lastMaterialDiagnostics;
    this.syncDiagnostics();
    this.requestRender();
  }

  fitCameraForViewport() {
    if (!this.camera) return;
    const tier = this.resolveOccupancyTier();
    let nearRadius = ROOM2_APPEARANCE_PROFILE.camera.minimumFitRadius;
    let farRadius = ROOM2_APPEARANCE_PROFILE.camera.maximumRadius;
    for (let index = 0; index < 42; index += 1) {
      const radius = (nearRadius + farRadius) / 2;
      this.positionCamera(radius);
      const projected = this.projectSemanticBounds(ROOM2_APPEARANCE_PROFILE.bounds.hero);
      if (projected.width > tier.targetWidth) nearRadius = radius;
      else farRadius = radius;
    }
    this.baseRadius = clamp(
      (nearRadius + farRadius) / 2,
      ROOM2_APPEARANCE_PROFILE.camera.minimumFitRadius,
      ROOM2_APPEARANCE_PROFILE.camera.maximumRadius
    );
    this.radius = this.baseRadius;
    this.lastFittedViewportKey = this.currentViewportKey();
    this.updateCamera();
  }

  currentViewportKey() {
    const width = Number(this.ownerWindow?.innerWidth) || 0;
    const height = Number(this.ownerWindow?.innerHeight) || 0;
    return `${width}x${height}`;
  }

  resolveOccupancyTier() {
    const viewportWidth = Number(this.ownerWindow?.innerWidth) || Number(this.runtime?.getBoundingClientRect?.().width) || 1280;
    return ROOM2_APPEARANCE_PROFILE.camera.occupancyTiers.find(
      (candidate) => candidate.maximumViewportWidth == null || viewportWidth <= candidate.maximumViewportWidth
    ) || ROOM2_APPEARANCE_PROFILE.camera.occupancyTiers.at(-1);
  }

  positionCamera(radius = this.radius) {
    if (!this.camera) return;
    const horizontal = Math.cos(this.phi) * radius;
    this.camera.position.set(
      this.cameraTarget.x + Math.sin(this.theta) * horizontal,
      this.cameraTarget.y + Math.sin(this.phi) * radius,
      this.cameraTarget.z + Math.cos(this.theta) * horizontal
    );
    this.camera.lookAt(this.cameraTarget);
    this.camera.updateMatrixWorld();
    this.camera.updateProjectionMatrix();
  }

  updateCamera() {
    if (!this.camera) return;
    this.positionCamera();
    this.syncDiagnostics();
    this.requestRender();
  }

  projectSemanticBounds(bounds) {
    if (!this.camera) return null;
    const projected = boundsCorners(bounds).map((point) => point.project(this.camera));
    const xs = projected.map(({ x }) => x);
    const ys = projected.map(({ y }) => y);
    const zs = projected.map(({ z }) => z);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return Object.freeze({
      ndc: Object.freeze({
        min: [roundDiagnostic(minX), roundDiagnostic(minY), roundDiagnostic(Math.min(...zs))],
        max: [roundDiagnostic(maxX), roundDiagnostic(maxY), roundDiagnostic(Math.max(...zs))]
      }),
      width: roundDiagnostic((maxX - minX) / 2),
      height: roundDiagnostic((maxY - minY) / 2),
      area: roundDiagnostic(((maxX - minX) * (maxY - minY)) / 4),
      withinViewport: minX >= -1 && maxX <= 1 && minY >= -1 && maxY <= 1 && Math.min(...zs) >= -1 && Math.max(...zs) <= 1
    });
  }

  requestRender() {
    if (this.disposed || this.failed || !this.renderer || !this.modelRoot || !this.runtime?.isConnected || this.renderFrame !== null) return;
    const request = this.ownerWindow?.requestAnimationFrame?.bind(this.ownerWindow) || globalThis.requestAnimationFrame?.bind(globalThis);
    if (!request) return;
    this.renderFrame = request(() => {
      this.renderFrame = null;
      if (this.disposed || this.failed || !this.runtime?.isConnected || !this.modelRoot) return;
      try {
        const refreshingShadowMap = this.shadowRefreshPending && this.renderer.shadowMap.needsUpdate;
        const startedAt = performance.now();
        this.renderer.render(this.scene, this.camera);
        this.lastFrameMilliseconds = performance.now() - startedAt;
        this.lastFrameTriangles = this.renderer.info.render.triangles;
        if (refreshingShadowMap) {
          this.shadowRefreshCount += 1;
          this.shadowRefreshPending = false;
          this.lastShadowRefreshDrawCalls = this.renderer.info.render.calls;
        } else {
          this.lastBeautyPassDrawCalls = this.renderer.info.render.calls;
        }
        this.renderCount += 1;
        this.canvas.dataset.rendered = "true";
        this.runtime.dataset.rendered = "true";
        if (!this.firstUsableAt) this.firstUsableAt = performance.now();
        if (!["ready", "finish-loading", "finish-error"].includes(this.state)) {
          this.notifyState("ready", {
            finishId: this.selectedFinishId,
            message: "Room 2 commercial PBR review candidate ready."
          });
        }
        this.lastMaterialDiagnostics = this.materialSystem?.getDiagnostics() || this.lastMaterialDiagnostics;
        this.syncDiagnostics();
        if (refreshingShadowMap && this.lastBeautyPassDrawCalls == null) this.requestRender();
      } catch (error) {
        this.fail(error);
      }
    });
  }

  scheduleResize() {
    if (this.resizeFrame !== null) return;
    const request = this.ownerWindow?.requestAnimationFrame?.bind(this.ownerWindow) || globalThis.requestAnimationFrame?.bind(globalThis);
    if (!request) return this.resize();
    this.resizeFrame = request(() => {
      this.resizeFrame = null;
      this.resize();
    });
  }

  cancelRender() {
    if (this.renderFrame === null) return;
    const cancel = this.ownerWindow?.cancelAnimationFrame?.bind(this.ownerWindow) || globalThis.cancelAnimationFrame?.bind(globalThis);
    cancel?.(this.renderFrame);
    this.renderFrame = null;
  }

  cancelResize() {
    if (this.resizeFrame === null) return;
    const cancel = this.ownerWindow?.cancelAnimationFrame?.bind(this.ownerWindow) || globalThis.cancelAnimationFrame?.bind(globalThis);
    cancel?.(this.resizeFrame);
    this.resizeFrame = null;
  }

  notifyState(state, details = {}) {
    this.state = state;
    if (this.runtime) this.runtime.dataset.state = state;
    try {
      this.onStateChange(state, details);
    } catch {
      // Host status copy must never own the viewer lifecycle.
    }
  }

  fail(error) {
    if (this.disposed) return false;
    this.failed = true;
    this.lastError = error;
    this.fetchAbortController?.abort();
    this.cancelRender();
    this.cancelResize();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.resizeFallbackController?.abort();
    this.resizeFallbackController = null;
    this.controlAbortController?.abort();
    this.controlAbortController = null;
    this.activePointers.clear();
    const materialSystem = this.materialSystem;
    this.lastMaterialDiagnostics = materialSystem?.getDiagnostics() || this.lastMaterialDiagnostics;
    materialSystem?.dispose();
    this.lastMaterialDiagnostics = materialSystem?.getDiagnostics() || this.lastMaterialDiagnostics;
    this.materialSystem = null;
    disposeObject3D(this.modelRoot);
    this.modelRoot = null;
    this.gltf = null;
    this.assetBuffer = null;
    disposeSet(this.evidenceMaskMaterials);
    this.evidenceMaskMode = null;
    if (this.scene) this.scene.environment = null;
    this.environmentSourceTexture?.dispose?.();
    this.environmentSourceTexture = null;
    this.environmentRenderTarget?.dispose?.();
    this.environmentRenderTarget = null;
    this.shadowCaster?.shadow?.map?.dispose?.();
    if (this.shadowCaster?.shadow) this.shadowCaster.shadow.map = null;
    this.directLights.clear();
    this.shadowCaster = null;
    this.scene?.clear();
    if (!this.rendererResourcesReleased) {
      this.renderer?.renderLists?.dispose?.();
      this.renderer?.dispose?.();
      this.rendererResourcesReleased = true;
    }
    if (this.runtime) {
      this.runtime.dataset.state = "fallback";
      this.runtime.hidden = true;
    }
    try {
      this.onError(error);
    } catch {
      // Preserve the original fail-closed state if reporting fails.
    }
    this.notifyState("fallback", {
      code: error?.code || "ROOM2_VIEWER_FAILED",
      message: "The fixed Room 2 reference model could not be displayed. No substitute model or image was loaded."
    });
    this.syncDiagnostics(error);
    return false;
  }

  readCameraState() {
    return this.camera ? Object.freeze({
      position: this.camera.position.toArray().map(roundDiagnostic),
      target: this.cameraTarget.toArray().map(roundDiagnostic),
      theta: roundDiagnostic(this.theta),
      phi: roundDiagnostic(this.phi),
      radius: roundDiagnostic(this.radius),
      filmGauge: roundDiagnostic(this.camera.filmGauge),
      focalLengthMillimeters: roundDiagnostic(this.camera.getFocalLength())
    }) : null;
  }

  readProjectionState() {
    if (!this.camera) return null;
    const tier = this.resolveOccupancyTier();
    const canvasRect = this.runtime?.getBoundingClientRect?.();
    const hero = this.projectSemanticBounds(ROOM2_APPEARANCE_PROFILE.bounds.hero);
    const full = this.projectSemanticBounds(ROOM2_APPEARANCE_PROFILE.bounds.full);
    return Object.freeze({
      aspect: roundDiagnostic(this.camera.aspect),
      verticalFovDegrees: roundDiagnostic(this.camera.fov),
      near: roundDiagnostic(this.camera.near),
      far: roundDiagnostic(this.camera.far),
      viewport: Object.freeze({
        pageCssWidth: Number(this.ownerWindow?.innerWidth) || null,
        pageCssHeight: Number(this.ownerWindow?.innerHeight) || null,
        canvasCssWidth: canvasRect ? roundDiagnostic(canvasRect.width) : null,
        canvasCssHeight: canvasRect ? roundDiagnostic(canvasRect.height) : null,
        devicePixelRatio: roundDiagnostic(this.renderer?.getPixelRatio?.())
      }),
      heroBounds: ROOM2_APPEARANCE_PROFILE.bounds.hero,
      hero,
      full,
      occupancyTier: Object.freeze({
        id: tier.id,
        targetWidth: tier.targetWidth,
        acceptedWidth: tier.acceptedWidth,
        widthPass: hero ? hero.width >= tier.acceptedWidth[0] && hero.width <= tier.acceptedWidth[1] : false
      })
    });
  }

  readRendererState() {
    if (!this.renderer) return null;
    const context = this.renderer.getContext?.();
    const extension = context?.getExtension?.("WEBGL_debug_renderer_info");
    return Object.freeze({
      className: this.renderer.constructor?.name || "WebGLRenderer",
      backend: "webgl2",
      threeRevision: String(THREE.REVISION),
      contextVersion: context?.getParameter?.(context.VERSION) || null,
      vendor: extension ? context.getParameter(extension.UNMASKED_VENDOR_WEBGL) : context?.getParameter?.(context?.VENDOR) || null,
      device: extension ? context.getParameter(extension.UNMASKED_RENDERER_WEBGL) : context?.getParameter?.(context?.RENDERER) || null,
      browserUserAgent: String(this.ownerWindow?.navigator?.userAgent || ""),
      browserPlatform: String(this.ownerWindow?.navigator?.platform || ""),
      colorManagementEnabled: THREE.ColorManagement.enabled,
      workingColorSpace: THREE.ColorManagement.workingColorSpace,
      outputColorSpace: this.renderer.outputColorSpace,
      outputTransformCount: ROOM2_APPEARANCE_PROFILE.renderer.colorManagement.outputTransformCount,
      toneMapping: toneMappingName(this.renderer.toneMapping),
      exposure: roundDiagnostic(this.renderer.toneMappingExposure),
      shadowType: shadowMapTypeName(this.renderer.shadowMap.type),
      postProcessingEnabled: false,
      gtaoEnabled: false
    });
  }

  readRendererInfo() {
    if (!this.renderer?.info) return null;
    const { memory, render, programs } = this.renderer.info;
    return Object.freeze({
      calls: render.calls,
      triangles: render.triangles,
      points: render.points,
      lines: render.lines,
      geometries: memory.geometries,
      textures: memory.textures,
      programs: Array.isArray(programs) ? programs.length : null,
      autoReset: Boolean(this.renderer.info.autoReset)
    });
  }

  readLightingState() {
    const floatLtc = Boolean(this.renderer?.extensions?.has?.("OES_texture_float_linear"));
    const readLight = (key, definition) => {
      const light = this.directLights.get(key);
      return Object.freeze({
        type: light?.type || definition.type,
        sourceSrgb: definition.color,
        runtimeLinearSrgb: light?.color?.toArray?.().map(roundDiagnostic) || null,
        intensity: roundDiagnostic(light?.intensity),
        position: light?.position?.toArray?.().map(roundDiagnostic) || null,
        width: roundDiagnostic(light?.width),
        height: roundDiagnostic(light?.height),
        castShadow: Boolean(light?.castShadow)
      });
    };
    return Object.freeze({
      coordinateBasis: ROOM2_APPEARANCE_PROFILE.lighting.coordinateBasis,
      directLightCount: this.directLights.size,
      semanticRoleCount: ROOM2_APPEARANCE_PROFILE.lighting.semanticRoleCount,
      rectAreaUniformsInitializationCount,
      rectAreaLtcLookup: Object.freeze({
        selectedPair: floatLtc ? "LTC_FLOAT_1/LTC_FLOAT_2" : "LTC_HALF_1/LTC_HALF_2",
        gpuFormat: floatLtc ? "RGBA32F" : "RGBA16F",
        dimensions: Object.freeze([64, 64]),
        textureCount: 2,
        estimatedBytes: floatLtc ? 131072 : 65536
      }),
      roles: Object.freeze({
        key: Object.freeze({
          semanticRole: ROOM2_APPEARANCE_PROFILE.lighting.key.semanticRole,
          area: readLight("key-area", ROOM2_APPEARANCE_PROFILE.lighting.key.area),
          shadowProxy: readLight("key-shadow-proxy", ROOM2_APPEARANCE_PROFILE.lighting.key.shadowProxy)
        }),
        fill: Object.freeze({
          semanticRole: ROOM2_APPEARANCE_PROFILE.lighting.fill.semanticRole,
          area: readLight("fill-area", ROOM2_APPEARANCE_PROFILE.lighting.fill.area)
        })
      })
    });
  }

  cameraStateCanonical() {
    return JSON.stringify(this.readCameraState());
  }

  syncDiagnostics(error = null) {
    const diagnostics = this.getDiagnostics();
    const values = {
      guided3dInstance: String(this.instanceId),
      room2ViewerIdentity: diagnostics.viewerIdentity,
      room2ControllerIdentity: diagnostics.controllerIdentity,
      room2ParsedRootIdentity: diagnostics.parsedRootIdentity || "",
      room2ScenePurpose: MODEL_PURPOSE,
      room2ModelIdentity: "Room2-Fireplace-bookcases-source-v1.glb",
      room2AssetUrl: diagnostics.assetUrl,
      room2AssetBytes: String(diagnostics.assetBytes),
      room2AssetSha256: diagnostics.assetSha256 || "",
      room2GeometryFingerprint: diagnostics.geometryFingerprint || "",
      room2RawMaterialDigest: diagnostics.rawMaterialDigest || "",
      room2EmbeddedImagePayloadDigest: diagnostics.embeddedImagePayloadDigest || "",
      room2RuntimeMaterialDigest: diagnostics.sourceRuntimeMaterialDigest || "",
      room2RuntimeMaterialAppearanceDigest: diagnostics.sourceRuntimeMaterialAppearanceDigest || "",
      room2RuntimeAppearanceFingerprint: diagnostics.runtimeAppearanceFingerprint || "",
      room2RuntimeAppearanceFingerprintVersion: diagnostics.runtimeAppearanceFingerprintVersion || "",
      room2RuntimeModelFingerprint: diagnostics.runtimeModelFingerprint || "",
      room2SelectedFinish: diagnostics.selectedFinishId,
      room2MaterialSystemState: JSON.stringify(diagnostics.materialSystem),
      room2RequestCount: String(diagnostics.requestCount),
      room2ParseCount: String(diagnostics.parseCount),
      room2RenderCount: String(diagnostics.renderCount),
      room2MountCount: String(diagnostics.mountCount),
      room2UnmountCount: String(diagnostics.unmountCount),
      room2CanvasOwnership: String(diagnostics.ownership.canvases),
      room2RendererOwnership: String(diagnostics.ownership.renderers),
      room2ControllerOwnership: String(diagnostics.ownership.controllers),
      room2ParsedRootOwnership: String(diagnostics.ownership.parsedRoots),
      room2AnimationLoopOwnership: String(diagnostics.ownership.animationLoops),
      room2RenderFrameOwnership: String(diagnostics.ownership.renderFrames),
      room2ResizeObserverOwnership: String(diagnostics.ownership.resizeObservers),
      room2ResizeListenerOwnership: String(diagnostics.ownership.resizeListeners),
      room2ControlListenerOwnership: String(diagnostics.ownership.controlListenerSets),
      room2CameraState: JSON.stringify(diagnostics.camera),
      room2ProjectionState: JSON.stringify(diagnostics.projection),
      room2RendererState: JSON.stringify(diagnostics.renderer),
      room2RendererInfo: JSON.stringify(diagnostics.rendererInfo),
      room2LightingState: JSON.stringify(diagnostics.lighting),
      room2EnvironmentState: JSON.stringify(diagnostics.environment),
      room2ShadowState: JSON.stringify(diagnostics.shadows),
      room2PerformanceState: JSON.stringify(diagnostics.performance),
      room2AppearanceProfile: ROOM2_APPEARANCE_PROFILE.schema,
      room2AppearanceStatus: ROOM2_APPEARANCE_PROFILE.status,
      room2Presentation: this.presentation.id,
      room2EvidenceMaskMode: this.evidenceMaskMode || "",
      room2FailureCode: error?.code || ""
    };
    for (const element of [this.runtime, this.canvas].filter(Boolean)) Object.assign(element.dataset, values);
    publishDiagnostics(diagnostics);
  }
}

function isSupportedSelection(project) {
  return project?.category === SUPPORTED_SELECTION.category
    && project?.style === SUPPORTED_SELECTION.style
    && project?.layout === SUPPORTED_SELECTION.layout
    && project?.productAvailability === "available"
    && project?.layoutAvailability !== "unavailable";
}

function ensureRectAreaUniformsInitialized() {
  if (rectAreaUniformsInitialized) return;
  RectAreaLightUniformsLib.init();
  rectAreaUniformsInitialized = true;
  rectAreaUniformsInitializationCount += 1;
}

function isEvidenceRuntimeAllowed() {
  const hostname = String(globalThis.location?.hostname || "");
  const query = new URLSearchParams(String(globalThis.location?.search || ""));
  return ROOM2_APPEARANCE_PROFILE.presentation.evidenceOnlyHostnames.includes(hostname)
    && query.get("room2Evidence") === "1";
}

function publishDiagnostics(diagnostics) {
  globalThis.__JQ_ROOM2_VIEWER_DIAGNOSTICS__ = diagnostics;
}

function requireSameOrigin(url, code, message) {
  const finalUrl = new URL(url, document.baseURI);
  if (finalUrl.origin !== globalThis.location.origin) throw codedError(code, message);
}

function concatenateChunks(chunks, byteLength) {
  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes.buffer;
}

function codedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function disposeObject3D(root) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  root?.traverse?.((object) => {
    if (object.geometry) geometries.add(object.geometry);
    const list = object.material ? Array.isArray(object.material) ? object.material : [object.material] : [];
    for (const material of list) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  geometries.forEach((geometry) => geometry.dispose?.());
  textures.forEach((texture) => texture.dispose?.());
  materials.forEach((material) => material.dispose?.());
}

function disposeGeometryOnly(root) {
  const geometries = new Set();
  root?.traverse?.((object) => {
    if (object.geometry) geometries.add(object.geometry);
  });
  geometries.forEach((geometry) => geometry.dispose?.());
}

function disposeSet(values) {
  for (const value of values || []) value?.dispose?.();
  values?.clear?.();
}

function resolveOutputColorSpace(name) {
  if (name === "srgb") return THREE.SRGBColorSpace;
  throw codedError("ROOM2_OUTPUT_COLOR_SPACE_UNSUPPORTED", `Unsupported Room 2 output color space: ${name}.`);
}

function resolveToneMapping(name) {
  if (name === "neutral" && Number.isFinite(THREE.NeutralToneMapping)) return THREE.NeutralToneMapping;
  if (name === "aces-filmic") return THREE.ACESFilmicToneMapping;
  throw codedError("ROOM2_TONE_MAPPING_UNSUPPORTED", `Unsupported Room 2 tone mapping: ${name}.`);
}

function toneMappingName(value) {
  if (value === THREE.NeutralToneMapping) return "neutral";
  if (value === THREE.ACESFilmicToneMapping) return "aces-filmic";
  if (value === THREE.NoToneMapping) return "none";
  return `three-constant-${value}`;
}

function shadowMapTypeName(value) {
  if (value === THREE.PCFSoftShadowMap) return "pcf-soft";
  if (value === THREE.PCFShadowMap) return "pcf";
  if (value === THREE.BasicShadowMap) return "basic";
  if (value === THREE.VSMShadowMap) return "vsm";
  return `three-constant-${value}`;
}

function boundsCorners(bounds) {
  const corners = [];
  for (const x of [bounds.min[0], bounds.max[0]]) {
    for (const y of [bounds.min[1], bounds.max[1]]) {
      for (const z of [bounds.min[2], bounds.max[2]]) corners.push(new THREE.Vector3(x, y, z));
    }
  }
  return corners;
}

function fitDirectionalShadowCamera(light, bounds, definition) {
  light.updateMatrixWorld(true);
  light.target.updateMatrixWorld(true);
  light.shadow.updateMatrices(light);
  const camera = light.shadow.camera;
  const corners = boundsCorners(bounds).map((point) => point.applyMatrix4(camera.matrixWorldInverse));
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  const zs = corners.map((point) => point.z);
  camera.left = Math.min(...xs) - definition.fitPaddingMeters;
  camera.right = Math.max(...xs) + definition.fitPaddingMeters;
  camera.bottom = Math.min(...ys) - definition.fitPaddingMeters;
  camera.top = Math.max(...ys) + definition.fitPaddingMeters;
  camera.near = Math.max(0.05, -Math.max(...zs) - definition.depthPaddingMeters);
  camera.far = Math.max(camera.near + 0.1, -Math.min(...zs) + definition.depthPaddingMeters);
  camera.updateProjectionMatrix();
  light.shadow.updateMatrices(light);
}

function roundDiagnostic(value) {
  return Number.isFinite(value) ? Number(Number(value).toFixed(9)) : null;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
