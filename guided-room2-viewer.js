import * as THREE from "./assets/vendor/three.module.js";
import { GLTFLoader } from "./assets/vendor/three-addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "./assets/vendor/three-addons/environments/RoomEnvironment.js";
import { ROOM2_APPEARANCE_PROFILE } from "./guided-room2-appearance.js?v=room2-studio-neutral-v1-20260817a";
import {
  createDeferredModelSnapshot,
  createEmbeddedImagePayloadSnapshot,
  createRawMaterialDigest,
  createRuntimeMaterialAppearanceCanonical,
  createRuntimeMaterialAppearanceSnapshot,
  createRuntimeMaterialCanonical,
  createRuntimeMaterialSnapshot,
  inspectRoom2Glb,
  sha256Bytes
} from "./guided-room2-integrity.js?v=room2-studio-neutral-v1-20260817a";

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

    this.state = "idle";
    this.disposed = false;
    this.failed = false;
    this.lastError = null;
    this.mountTarget = null;
    this.ownerWindow = null;
    this.runtime = null;
    this.canvas = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.environmentRenderTarget = null;
    this.directLights = new Map();
    this.shadowCaster = null;
    this.modelRoot = null;
    this.gltf = null;
    this.glbInspection = null;
    this.runtimeMaterialSnapshot = null;
    this.runtimeMaterialAppearanceSnapshot = null;
    this.embeddedImagePayloadSnapshot = null;
    this.deferredModelSnapshot = null;
    this.rawMaterialDigest = null;
    this.assetSha256 = null;
    this.assetBuffer = null;
    this.loadPromise = null;
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
    this.parseCount = 0;
    this.renderCount = 0;
    this.shadowRefreshCount = 0;
    this.shadowRefreshPending = false;
    this.pmremGenerationCount = 0;
    this.pmremGenerationMilliseconds = 0;
    this.compileMilliseconds = 0;
    this.shadowTier = null;
    this.userAdjustedCamera = false;
    this.cameraFitInitialized = false;
    this.theta = ROOM2_APPEARANCE_PROFILE.camera.theta;
    this.phi = ROOM2_APPEARANCE_PROFILE.camera.phi;
    this.radius = ROOM2_APPEARANCE_PROFILE.camera.minimumFitRadius;
    this.baseRadius = this.radius;
    this.cameraTarget = new THREE.Vector3(...ROOM2_APPEARANCE_PROFILE.camera.target);
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
      this.observeTarget();
      this.resize();
      if (this.failed) {
        this.runtime.hidden = true;
        this.notifyState("fallback", {
          code: this.lastError?.code || "ROOM2_VIEWER_FAILED",
          message: "The fixed Room 2 reference model could not be displayed. No substitute model or image was loaded."
        });
      } else if (!this.loadPromise && !this.modelRoot) this.startLoading();
      else if (this.modelRoot) {
        this.notifyState("ready");
        this.requestRender();
      } else {
        this.notifyState("loading", { message: "Loading the fixed Room 2 reference model…" });
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
      const error = new Error("The fixed Room 2 model is available only for Cabinets + Shelves / Fireplace Wall.");
      error.code = "ROOM2_SELECTION_NOT_SUPPORTED";
      return this.fail(error);
    }
    if (!this.gltf || !this.deferredModelSnapshot) return true;

    const cameraBefore = this.cameraStateCanonical();
    const snapshot = createDeferredModelSnapshot(this.gltf);
    if (snapshot.canonical !== this.deferredModelSnapshot.canonical) {
      const error = new Error("A deferred customer control changed the fixed Room 2 model.");
      error.code = "ROOM2_DEFERRED_MODEL_MUTATION";
      return this.fail(error);
    }
    const materialCanonical = this.createRuntimeMaterialCanonical();
    if (materialCanonical !== this.runtimeMaterialSnapshot.canonical) {
      const error = new Error("A deferred customer control changed an embedded Room 2 material.");
      error.code = "ROOM2_RUNTIME_MATERIAL_MUTATION";
      return this.fail(error);
    }
    const materialAppearanceCanonical = this.createRuntimeMaterialAppearanceCanonical();
    if (materialAppearanceCanonical !== this.runtimeMaterialAppearanceSnapshot.canonical) {
      const error = new Error("A deferred customer control changed a public Room 2 material appearance property.");
      error.code = "ROOM2_RUNTIME_MATERIAL_APPEARANCE_MUTATION";
      return this.fail(error);
    }
    if (this.cameraStateCanonical() !== cameraBefore) {
      const error = new Error("A deferred customer control reset the Room 2 camera.");
      error.code = "ROOM2_DEFERRED_CAMERA_MUTATION";
      return this.fail(error);
    }
    this.syncDiagnostics();
    this.requestRender();
    return true;
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
    this.radius = this.baseRadius;
    this.cameraTarget.set(...ROOM2_APPEARANCE_PROFILE.camera.target);
    this.userAdjustedCamera = false;
    this.updateCamera();
    return true;
  }

  getDiagnostics() {
    return Object.freeze({
      state: this.state,
      viewerIdentity: this.viewerIdentity,
      controllerIdentity: this.controllerIdentity,
      parsedRootIdentity: this.modelRoot ? this.rootIdentity : null,
      modelPurpose: MODEL_PURPOSE,
      appearanceProfile: ROOM2_APPEARANCE_PROFILE.schema,
      appearanceStatus: ROOM2_APPEARANCE_PROFILE.status,
      assetUrl: ROOM2_APPEARANCE_PROFILE.asset.url,
      assetBytes: this.assetBuffer?.byteLength || 0,
      assetSha256: this.assetSha256,
      geometryFingerprint: this.modelRoot ? ROOM2_APPEARANCE_PROFILE.asset.geometryFingerprint : null,
      rawMaterialDigest: this.rawMaterialDigest,
      embeddedImagePayloadDigest: this.embeddedImagePayloadSnapshot?.aggregateSha256 || null,
      embeddedImagePayloadSnapshot: this.embeddedImagePayloadSnapshot,
      runtimeMaterialDigest: this.runtimeMaterialSnapshot?.aggregateSha256 || null,
      runtimeMaterialAppearanceDigest: this.runtimeMaterialAppearanceSnapshot?.aggregateSha256 || null,
      runtimeModelFingerprint: this.deferredModelSnapshot?.fingerprint || null,
      runtimeMaterialSnapshot: this.runtimeMaterialSnapshot ? Object.freeze({
        schema: this.runtimeMaterialSnapshot.schema,
        threeRevision: this.runtimeMaterialSnapshot.threeRevision,
        materialCount: this.runtimeMaterialSnapshot.materialCount,
        aggregateSha256: this.runtimeMaterialSnapshot.aggregateSha256,
        records: this.runtimeMaterialSnapshot.records
      }) : null,
      runtimeMaterialAppearanceSnapshot: this.runtimeMaterialAppearanceSnapshot ? Object.freeze({
        schema: this.runtimeMaterialAppearanceSnapshot.schema,
        threeRevision: this.runtimeMaterialAppearanceSnapshot.threeRevision,
        materialCount: this.runtimeMaterialAppearanceSnapshot.materialCount,
        aggregateSha256: this.runtimeMaterialAppearanceSnapshot.aggregateSha256,
        records: this.runtimeMaterialAppearanceSnapshot.records
      }) : null,
      deferredModelSnapshot: this.deferredModelSnapshot ? Object.freeze({
        schema: this.deferredModelSnapshot.schema,
        nodeCount: this.deferredModelSnapshot.nodeCount,
        meshCount: this.deferredModelSnapshot.meshCount,
        fingerprint: this.deferredModelSnapshot.fingerprint,
        canonical: this.deferredModelSnapshot.canonical
      }) : null,
      requestCount: this.requestCount,
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
        type: ROOM2_APPEARANCE_PROFILE.lighting.environment.type,
        intensity: ROOM2_APPEARANCE_PROFILE.lighting.environment.intensity,
        rotationRadians: ROOM2_APPEARANCE_PROFILE.lighting.environment.rotationRadians,
        generationCount: this.pmremGenerationCount,
        generationMilliseconds: roundDiagnostic(this.pmremGenerationMilliseconds),
        retainedRenderTargets: this.environmentRenderTarget ? 1 : 0
      }),
      shadows: Object.freeze({
        casterCount: this.shadowCaster ? 1 : 0,
        casterRole: this.shadowCaster ? "key" : null,
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
      compileMilliseconds: roundDiagnostic(this.compileMilliseconds),
      ownership: Object.freeze({
        canvases: this.canvas ? 1 : 0,
        renderers: this.renderer ? 1 : 0,
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
    if (this.modelRoot) disposeObject3D(this.modelRoot);
    this.scene?.traverse((object) => {
      if (object.userData?.room2Ground === true) {
        object.geometry?.dispose?.();
        object.material?.dispose?.();
      }
    });
    if (this.scene) this.scene.environment = null;
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
    const renderer = new THREE.WebGLRenderer({
      antialias: ROOM2_APPEARANCE_PROFILE.renderer.antialias,
      alpha: false,
      powerPreference: "high-performance"
    });
    renderer.outputColorSpace = resolveOutputColorSpace(ROOM2_APPEARANCE_PROFILE.renderer.outputColorSpace);
    renderer.toneMapping = resolveToneMapping(ROOM2_APPEARANCE_PROFILE.renderer.toneMapping);
    renderer.toneMappingExposure = ROOM2_APPEARANCE_PROFILE.renderer.exposure;
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
    canvas.setAttribute("aria-label", "Fixed Room 2 fireplace bookcase reference model");
    canvas.setAttribute("aria-describedby", instructions.id);
    canvas.dataset.guided3dInstance = String(this.instanceId);

    runtime.append(canvas, hint, instructions);
    this.runtime = runtime;
    this.canvas = canvas;
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.setupAppearance();
    this.bindControls();
    this.updateCamera();
  }

  setupAppearance() {
    const { lighting, ground } = ROOM2_APPEARANCE_PROFILE;
    this.setupStudioEnvironment();

    for (const role of ["key", "fill", "rim"]) {
      const definition = lighting[role];
      const light = new THREE.DirectionalLight(definition.sourceSrgb, definition.intensity);
      light.name = `room2-studio-${role}`;
      light.position.set(...resolveBoundsDiagonalPosition(definition.positionBoundsDiagonal));
      light.target.position.set(...ROOM2_APPEARANCE_PROFILE.bounds.center);
      light.castShadow = definition.castShadow;
      assertLinearLightColor(light.color, definition.runtimeLinearSrgb, role);
      this.scene.add(light, light.target);
      this.directLights.set(role, light);
    }

    const key = this.directLights.get("key");
    key.shadow.bias = lighting.shadows.bias;
    key.shadow.normalBias = lighting.shadows.normalBias;
    this.shadowCaster = key;
    this.configureShadowTier(Number.POSITIVE_INFINITY);
    fitDirectionalShadowCamera(key, ROOM2_APPEARANCE_PROFILE.bounds, lighting.shadows);

    if (ground.enabled) {
      const geometry = new THREE.PlaneGeometry(ground.size, ground.size);
      const material = new THREE.MeshStandardMaterial({
        color: ground.color,
        roughness: ground.roughness,
        metalness: ground.metalness
      });
      const plane = new THREE.Mesh(geometry, material);
      plane.name = "room2-public-non-repeating-ground";
      plane.rotation.x = -Math.PI / 2;
      plane.position.y = ground.y;
      plane.receiveShadow = true;
      plane.userData.room2Ground = true;
      this.scene.add(plane);
    }
  }

  setupStudioEnvironment() {
    const definition = ROOM2_APPEARANCE_PROFILE.lighting.environment;
    const startedAt = performance.now();
    const generator = new THREE.PMREMGenerator(this.renderer);
    const environment = new RoomEnvironment(this.renderer);
    try {
      generator.compileCubemapShader();
      this.environmentRenderTarget = generator.fromScene(
        environment,
        definition.blurSigma,
        definition.near,
        definition.far
      );
      this.pmremGenerationCount += 1;
      if (this.pmremGenerationCount > definition.maximumGenerationsPerViewer) {
        throw codedError("ROOM2_PMREM_GENERATION_LIMIT", "The Room 2 studio environment was generated more than once.");
      }
      this.scene.environment = this.environmentRenderTarget.texture;
      this.scene.environmentIntensity = definition.intensity;
      this.scene.environmentRotation.set(0, definition.rotationRadians, 0);
    } finally {
      environment.dispose();
      generator.dispose();
      this.pmremGenerationMilliseconds = performance.now() - startedAt;
    }
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
    this.notifyState("loading", { message: "Loading the fixed Room 2 reference model…", progress: 0 });
    this.loadPromise = this.loadModel(this.fetchAbortController.signal)
      .catch((error) => this.fail(error));
  }

  async loadModel(signal) {
    const buffer = await this.fetchAsset(signal);
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

    const loader = new GLTFLoader();
    this.parseCount += 1;
    const gltf = await loader.parseAsync(buffer, new URL("./assets/models/room2/", document.baseURI).href);
    if (signal.aborted || this.disposed) {
      disposeObject3D(gltf.scene);
      return;
    }
    this.validateParsedScene(gltf);
    this.gltf = gltf;
    this.modelRoot = gltf.scene;
    this.modelRoot.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
    });
    this.scene.add(this.modelRoot);
    this.modelRoot.updateMatrixWorld(true);
    this.runtimeMaterialSnapshot = await createRuntimeMaterialSnapshot(gltf, this.glbInspection.json);
    this.runtimeMaterialAppearanceSnapshot = await createRuntimeMaterialAppearanceSnapshot(gltf, this.glbInspection.json);
    this.deferredModelSnapshot = createDeferredModelSnapshot(gltf);
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
    const finalUrl = new URL(response.url, document.baseURI);
    if (finalUrl.origin !== window.location.origin) {
      throw codedError("ROOM2_ASSET_CROSS_ORIGIN", "The Room 2 model did not resolve to this site origin.");
    }
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
          message: `Loading the fixed Room 2 reference model… ${Math.min(100, bucket * 10)}%`,
          progress: Math.min(100, bucket * 10)
        });
      }
    }
    const bytes = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes.buffer;
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
    const expected = ROOM2_APPEARANCE_PROFILE.bounds;
    const actual = { min: bounds.min.toArray(), max: bounds.max.toArray() };
    for (const side of ["min", "max"]) {
      actual[side].forEach((value, index) => {
        if (Math.abs(value - expected[side][index]) > 1e-5) {
          throw codedError("ROOM2_WORLD_BOUNDS_MISMATCH", "The parsed Room 2 bounds differ from authority.");
        }
      });
    }
  }

  createRuntimeMaterialCanonical() {
    if (!this.gltf || !this.runtimeMaterialSnapshot) return "";
    return createRuntimeMaterialCanonical(this.gltf, this.glbInspection.json);
  }

  createRuntimeMaterialAppearanceCanonical() {
    if (!this.gltf || !this.glbInspection) return null;
    return createRuntimeMaterialAppearanceCanonical(this.gltf, this.glbInspection.json);
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
    this.configureShadowTier(width);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    if (!this.userAdjustedCamera) this.fitCameraForViewport();
    this.requestRender();
  }

  fitCameraForViewport() {
    if (!this.camera || this.cameraFitInitialized) return;
    const bounds = ROOM2_APPEARANCE_PROFILE.bounds;
    const halfWidth = (bounds.max[0] - bounds.min[0]) / 2;
    const halfHeight = (bounds.max[1] - bounds.min[1]) / 2;
    const halfDepth = (bounds.max[2] - bounds.min[2]) / 2;
    const verticalFov = THREE.MathUtils.degToRad(this.camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(0.1, this.camera.aspect));
    const fit = Math.max(
      halfHeight / Math.tan(verticalFov / 2),
      halfWidth / Math.tan(horizontalFov / 2)
    ) * ROOM2_APPEARANCE_PROFILE.camera.fitPadding + halfDepth;
    this.baseRadius = clamp(
      Math.max(ROOM2_APPEARANCE_PROFILE.camera.minimumFitRadius, fit),
      ROOM2_APPEARANCE_PROFILE.camera.minimumRadius,
      ROOM2_APPEARANCE_PROFILE.camera.maximumRadius
    );
    this.radius = this.baseRadius;
    this.cameraFitInitialized = true;
    this.updateCamera();
  }

  updateCamera() {
    if (!this.camera) return;
    const horizontal = Math.cos(this.phi) * this.radius;
    this.camera.position.set(
      this.cameraTarget.x + Math.sin(this.theta) * horizontal,
      this.cameraTarget.y + Math.sin(this.phi) * this.radius,
      this.cameraTarget.z + Math.cos(this.theta) * horizontal
    );
    this.camera.lookAt(this.cameraTarget);
    this.camera.updateMatrixWorld();
    this.syncDiagnostics();
    this.requestRender();
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
        this.renderer.render(this.scene, this.camera);
        if (refreshingShadowMap) {
          this.shadowRefreshCount += 1;
          this.shadowRefreshPending = false;
        }
        this.renderCount += 1;
        this.canvas.dataset.rendered = "true";
        this.runtime.dataset.rendered = "true";
        if (!this.firstUsableAt) this.firstUsableAt = performance.now();
        if (this.state !== "ready") this.notifyState("ready", { message: "Fixed Room 2 reference model ready." });
        this.syncDiagnostics();
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
    this.cancelRender();
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
      fov: roundDiagnostic(this.camera.fov)
    }) : null;
  }

  readProjectionState() {
    return this.camera ? Object.freeze({
      aspect: roundDiagnostic(this.camera.aspect),
      near: roundDiagnostic(this.camera.near),
      far: roundDiagnostic(this.camera.far)
    }) : null;
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
      colorManagementEnabled: THREE.ColorManagement.enabled,
      workingColorSpace: THREE.ColorManagement.workingColorSpace,
      outputColorSpace: this.renderer.outputColorSpace,
      outputTransformCount: ROOM2_APPEARANCE_PROFILE.renderer.colorManagement.outputTransformCount,
      toneMapping: toneMappingName(this.renderer.toneMapping),
      exposure: roundDiagnostic(this.renderer.toneMappingExposure),
      shadowType: shadowMapTypeName(this.renderer.shadowMap.type)
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
    const roles = {};
    for (const role of ["key", "fill", "rim"]) {
      const definition = ROOM2_APPEARANCE_PROFILE.lighting[role];
      const light = this.directLights.get(role);
      roles[role] = Object.freeze({
        type: definition.type,
        sourceSrgb: definition.sourceSrgb,
        runtimeLinearSrgb: light?.color?.toArray?.().map(roundDiagnostic) || definition.runtimeLinearSrgb,
        intensity: light?.intensity ?? definition.intensity,
        nativeIntensityRatio: definition.nativeIntensityRatio,
        measuredContributionRatio: definition.measuredContributionRatio,
        positionBoundsDiagonal: definition.positionBoundsDiagonal,
        position: light?.position?.toArray?.().map(roundDiagnostic) || null,
        target: light?.target?.position?.toArray?.().map(roundDiagnostic) || null,
        size: definition.size,
        castShadow: Boolean(light?.castShadow)
      });
    }
    return Object.freeze({
      coordinateBasis: ROOM2_APPEARANCE_PROFILE.lighting.coordinateBasis,
      contributionMeasurement: ROOM2_APPEARANCE_PROFILE.lighting.contributionMeasurement,
      directLightCount: this.directLights.size,
      semanticRoleCount: Object.keys(roles).length,
      roles: Object.freeze(roles)
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
      room2RuntimeMaterialDigest: diagnostics.runtimeMaterialDigest || "",
      room2RuntimeMaterialAppearanceDigest: diagnostics.runtimeMaterialAppearanceDigest || "",
      room2RuntimeModelFingerprint: diagnostics.runtimeModelFingerprint || "",
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
      room2AppearanceProfile: ROOM2_APPEARANCE_PROFILE.schema,
      room2AppearanceStatus: ROOM2_APPEARANCE_PROFILE.status,
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

function publishDiagnostics(diagnostics) {
  globalThis.__JQ_ROOM2_VIEWER_DIAGNOSTICS__ = diagnostics;
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

function resolveBoundsDiagonalPosition(normalized) {
  const { min, max, center } = ROOM2_APPEARANCE_PROFILE.bounds;
  const diagonal = Math.hypot(...max.map((value, index) => value - min[index]));
  return normalized.map((value, index) => center[index] + value * diagonal);
}

function assertLinearLightColor(color, expected, role) {
  color.toArray().forEach((value, index) => {
    if (Math.abs(value - expected[index]) > 1e-6) {
      throw codedError("ROOM2_LIGHT_COLOR_CONVERSION_MISMATCH", `The ${role} light did not resolve to the pinned Linear-sRGB color.`);
    }
  });
}

function fitDirectionalShadowCamera(light, bounds, definition) {
  light.updateMatrixWorld(true);
  light.target.updateMatrixWorld(true);
  light.shadow.updateMatrices(light);
  const camera = light.shadow.camera;
  const corners = [];
  for (const x of [bounds.min[0], bounds.max[0]]) {
    for (const y of [bounds.min[1], bounds.max[1]]) {
      for (const z of [bounds.min[2], bounds.max[2]]) {
        corners.push(new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse));
      }
    }
  }
  const diagonal = Math.hypot(...bounds.max.map((value, index) => value - bounds.min[index]));
  const lateralPadding = diagonal * definition.fitPaddingBoundsDiagonal;
  const depthPadding = diagonal * definition.depthPaddingBoundsDiagonal;
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  const zs = corners.map((point) => point.z);
  camera.left = Math.min(...xs) - lateralPadding;
  camera.right = Math.max(...xs) + lateralPadding;
  camera.bottom = Math.min(...ys) - lateralPadding;
  camera.top = Math.max(...ys) + lateralPadding;
  camera.near = Math.max(0.05, -Math.max(...zs) - depthPadding);
  camera.far = Math.max(camera.near + 0.1, -Math.min(...zs) + depthPadding);
  camera.updateProjectionMatrix();
  light.shadow.updateMatrices(light);
}

function roundDiagnostic(value) {
  return Number(Number(value).toFixed(9));
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
