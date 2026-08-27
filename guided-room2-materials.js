import {
  ROOM2_APPEARANCE_PROFILE,
  resolveRoom2Finish,
  resolveRoom2SemanticZone
} from "./guided-room2-appearance.js?v=room2-commercial-pbr-v1-20260817g";

const TEXTURE_SLOTS = Object.freeze([
  "map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap",
  "alphaMap", "bumpMap", "displacementMap", "lightMap"
]);

export function createRoom2MaterialSystem(options) {
  return new Room2MaterialSystem(options);
}

export function classifyRoom2MillworkRole(namePath) {
  const names = (namePath || []).filter(Boolean);
  const leaf = names.at(-1) || "";
  if (/Door_H/i.test(leaf)) return "cabinet-door";
  if (/Adjustable Shelf/i.test(leaf)) return "shelf";
  if (/Stile/i.test(leaf)) return "stile";
  if (/UEnd/i.test(leaf)) return "end-panel";
  if (/UBack/i.test(leaf)) return "back-panel";
  if (/Nose/i.test(leaf)) return "trim";
  if (/Bottom/i.test(leaf)) return "bottom-panel";
  if (/Nailer/i.test(leaf)) return "nailer";
  if (/(?:^|_)Skin$/i.test(leaf)) return "toe-skin";
  if (/(?:^|_)Top$/i.test(leaf)) return "top-panel";
  if (/(?:^|_)(?:LS|RS)$/i.test(leaf)) return "side-member";
  if (/(?:^|_)TR$/i.test(leaf)) return "top-rail";
  return "millwork-other";
}

export function resolveRoom2MillworkRole(meshIndex, namePath) {
  for (const [role, meshIndices] of Object.entries(ROOM2_APPEARANCE_PROFILE.semanticMapping.millworkRoleMeshIndices)) {
    if (meshIndices.includes(meshIndex)) return role;
  }
  return classifyRoom2MillworkRole(namePath);
}

class Room2MaterialSystem {
  constructor(options = {}) {
    if (!options.THREE?.MeshStandardMaterial || !options.renderer) {
      throw new TypeError("Room 2 materials require the pinned Three namespace and initialized renderer.");
    }
    this.THREE = options.THREE;
    this.renderer = options.renderer;
    this.notifyState = typeof options.notifyState === "function" ? options.notifyState : () => {};
    this.requestRender = typeof options.requestRender === "function" ? options.requestRender : () => {};
    this.disposed = false;
    this.gltf = null;
    this.json = null;
    this.meshRecords = [];
    this.familyRecords = new Map();
    this.textureCache = new Map();
    this.textureRequestCounts = new Map();
    this.textureSuccessfulRequestCounts = new Map();
    this.staticMaterials = new Map();
    this.sourceMaterials = new Set();
    this.sourceTextures = new Set();
    this.staticTextureClones = new Set();
    this.activeFinishMaterials = new Set();
    this.activeTextureClones = new Set();
    this.activeFinishId = null;
    this.pendingFinishId = null;
    this.finishSelectionSequence = 0;
    this.finishApplicationCount = 0;
    this.failedTextureRequestCount = 0;
    this.appearanceCanonical = "";
    this.appearanceFingerprint = null;
    this.appearanceFingerprintPromise = null;
    this.geometryLedger = [];
    this.maximumAnisotropy = this.resolveMaximumAnisotropy(options.viewportWidth);
    this.anisotropyUpdateCount = 0;
  }

  resolveMaximumAnisotropy(viewportWidth) {
    const capability = Math.max(1, Number(
      this.renderer.capabilities?.getMaxAnisotropy?.()
      ?? this.renderer.backend?.getMaxAnisotropy?.()
      ?? this.renderer.getMaxAnisotropy?.()
    ) || 1);
    const width = Number(viewportWidth) || Number(globalThis.innerWidth) || 1280;
    const configured = width < 600
      ? ROOM2_APPEARANCE_PROFILE.materials.texturePipeline.anisotropy.phoneMaximum
      : ROOM2_APPEARANCE_PROFILE.materials.texturePipeline.anisotropy.desktopTabletMaximum;
    return Math.max(1, Math.min(configured, capability));
  }

  updateViewportWidth(viewportWidth) {
    if (this.disposed) return false;
    const nextMaximum = this.resolveMaximumAnisotropy(viewportWidth);
    if (nextMaximum === this.maximumAnisotropy) return false;
    this.maximumAnisotropy = nextMaximum;
    this.anisotropyUpdateCount += 1;

    const highAnisotropyTextures = new Set([
      ...[...this.familyRecords.values()].flatMap((record) => Object.values(record.textures || {})),
      ...this.activeTextureClones,
      ...this.staticTextureClones
    ]);
    for (const texture of highAnisotropyTextures) {
      if (!texture?.isTexture || texture.anisotropy === nextMaximum) continue;
      texture.anisotropy = nextMaximum;
      texture.needsUpdate = true;
    }
    for (const texture of this.sourceTextures) {
      if (!texture?.isTexture || texture.anisotropy <= nextMaximum) continue;
      texture.anisotropy = nextMaximum;
      texture.needsUpdate = true;
    }

    this.refreshAppearanceFingerprint()
      .then(() => {
        if (!this.disposed) this.requestRender();
      })
      .catch(() => {});
    this.requestRender();
    return true;
  }

  async prepareInitialFinish(finishId) {
    const finish = resolveRoom2Finish(finishId);
    this.pendingFinishId = finish.id;
    await this.ensureFamily(finish.family, { initial: true });
    return finish;
  }

  async bindModel(gltf, json, finishId) {
    if (this.disposed) throw codedError("ROOM2_MATERIAL_SYSTEM_DISPOSED", "The Room 2 material system was disposed.");
    if (!gltf?.scene || !(gltf.parser?.associations instanceof Map) || !json?.meshes) {
      throw codedError("ROOM2_MATERIAL_BINDING_INVALID", "Parsed GLB associations are required for semantic material binding.");
    }
    const sequence = ++this.finishSelectionSequence;
    this.gltf = gltf;
    this.json = json;
    this.meshRecords = collectMeshRecords(gltf, json);
    validateSemanticCoverage(this.meshRecords);
    this.captureSourceOwnership();
    this.buildStaticMaterials();
    this.applyStaticMaterials();
    const finish = resolveRoom2Finish(finishId);
    this.pendingFinishId = finish.id;
    await this.ensureFamily(finish.family, { initial: true });
    if (this.disposed) throw codedError("ROOM2_MATERIAL_SYSTEM_DISPOSED", "The Room 2 material system was disposed.");
    if (sequence === this.finishSelectionSequence) {
      this.applyLoadedFinish(finish);
      this.pendingFinishId = null;
    }
    this.geometryLedger = this.meshRecords.map((record) => geometryIdentityRecord(record));
    await this.refreshAppearanceFingerprint();
    return this.getDiagnostics();
  }

  selectFinish(finishId) {
    if (this.disposed) return Promise.resolve(false);
    const finish = resolveRoom2Finish(finishId);
    if (this.activeFinishId === finish.id && this.pendingFinishId == null) {
      this.notifyState("ready", {
        finishId: finish.id,
        finishLabel: finish.label,
        message: `${finish.label} provisional digital material is ready.`
      });
      return Promise.resolve(true);
    }
    const sequence = ++this.finishSelectionSequence;
    this.pendingFinishId = finish.id;
    const familyRecord = this.familyRecords.get(finish.family);
    if (familyRecord?.state === "ready") {
      this.applyLoadedFinish(finish);
      this.pendingFinishId = null;
      const fingerprintPromise = this.refreshAppearanceFingerprint();
      this.requestRender();
      this.notifyState("ready", {
        finishId: finish.id,
        finishLabel: finish.label,
        message: `${finish.label} provisional digital material applied.`
      });
      return fingerprintPromise.then(() => {
        this.requestRender();
        return true;
      });
    }

    this.notifyState("finish-loading", {
      finishId: finish.id,
      finishLabel: finish.label,
      message: `Loading the ${finish.label} provisional digital material…`
    });
    return this.ensureFamily(finish.family, { explicitRetry: familyRecord?.state === "failed" })
      .then(() => {
        if (this.disposed || sequence !== this.finishSelectionSequence) return false;
        this.applyLoadedFinish(finish);
        this.pendingFinishId = null;
        this.requestRender();
        this.notifyState("ready", {
          finishId: finish.id,
          finishLabel: finish.label,
          message: `${finish.label} provisional digital material applied.`
        });
        return this.refreshAppearanceFingerprint().then(() => true);
      })
      .catch((error) => {
        if (sequence === this.finishSelectionSequence) {
          this.pendingFinishId = null;
          this.notifyState("finish-error", {
            finishId: finish.id,
            finishLabel: finish.label,
            code: error.code || "ROOM2_FINISH_LOAD_FAILED",
            message: `${finish.label} could not be loaded. No substitute material is shown; select it again to retry only the failed resource.`
          });
          this.requestRender();
        }
        return false;
      });
  }

  ensureFamily(familyId, options = {}) {
    if (this.disposed) return Promise.reject(codedError("ROOM2_MATERIAL_SYSTEM_DISPOSED", "The Room 2 material system was disposed."));
    const existing = this.familyRecords.get(familyId);
    if (existing?.state === "ready") return Promise.resolve(existing);
    if (existing?.state === "loading") return existing.promise;
    if (existing?.state === "failed" && !options.explicitRetry && !options.initial) return Promise.reject(existing.error);

    const definition = ROOM2_APPEARANCE_PROFILE.materials.families[familyId];
    if (!definition) return Promise.reject(codedError("ROOM2_FINISH_FAMILY_UNKNOWN", `Unknown Room 2 finish family ${familyId}.`));
    const attempts = (existing?.attempts || 0) + 1;
    const record = {
      id: familyId,
      state: "loading",
      attempts,
      textures: null,
      error: null,
      promise: null,
      loadedAt: null
    };
    record.promise = Promise.all(Object.entries(definition.maps).map(async ([slot, url]) => {
      const texture = await this.ensureTexture(url, slot, definition, familyId, {
        explicitRetry: Boolean(options.explicitRetry)
      });
      return [slot, texture];
    }))
      .then((pairs) => {
        record.state = "ready";
        record.textures = Object.fromEntries(pairs);
        record.loadedAt = globalThis.performance?.now?.() || 0;
        return record;
      })
      .catch((error) => {
        record.state = "failed";
        record.error = error;
        throw error;
      });
    this.familyRecords.set(familyId, record);
    return record.promise;
  }

  ensureTexture(url, slot, family, familyId, options = {}) {
    const existing = this.textureCache.get(url);
    if (existing?.state === "ready") return Promise.resolve(existing.texture);
    if (existing?.state === "loading") return existing.promise;
    if (existing?.state === "failed" && !options.explicitRetry) return Promise.reject(existing.error);

    const entry = {
      state: "loading",
      attempts: (existing?.attempts || 0) + 1,
      texture: null,
      error: null,
      promise: null
    };
    entry.promise = this.loadTexture(url, slot, family, familyId)
      .then((texture) => {
        entry.state = "ready";
        entry.texture = texture;
        this.textureSuccessfulRequestCounts.set(url, (this.textureSuccessfulRequestCounts.get(url) || 0) + 1);
        return texture;
      })
      .catch((error) => {
        entry.state = "failed";
        entry.error = error;
        this.failedTextureRequestCount += 1;
        throw error;
      });
    this.textureCache.set(url, entry);
    return entry.promise;
  }

  async loadTexture(url, slot, family, familyId) {
    this.textureRequestCounts.set(url, (this.textureRequestCounts.get(url) || 0) + 1);
    const loader = new this.THREE.TextureLoader();
    let texture;
    try {
      texture = await loader.loadAsync(url);
    } catch (cause) {
      const error = codedError("ROOM2_TEXTURE_REQUEST_FAILED", `Room 2 texture request failed: ${url}`);
      error.cause = cause;
      throw error;
    }
    if (this.disposed) {
      texture.dispose();
      throw codedError("ROOM2_MATERIAL_SYSTEM_DISPOSED", "The Room 2 material system was disposed while a texture loaded.");
    }
    texture.name = `room2-commercial-pbr-v1:${slot}:${url}`;
    texture.userData ||= {};
    texture.userData.room2Owned = true;
    texture.userData.room2SourceUrl = url;
    texture.userData.room2Family = familyId;
    texture.colorSpace = slot === "map" ? this.THREE.SRGBColorSpace : this.THREE.NoColorSpace;
    texture.flipY = false;
    texture.wrapS = this.THREE.RepeatWrapping;
    texture.wrapT = this.THREE.RepeatWrapping;
    texture.magFilter = this.THREE.LinearFilter;
    texture.minFilter = this.THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = this.maximumAnisotropy;
    texture.needsUpdate = true;
    return texture;
  }

  captureSourceOwnership() {
    for (const record of this.meshRecords) {
      const materials = Array.isArray(record.object.material) ? record.object.material : [record.object.material];
      if (materials.length !== 1 || !materials[0]) {
        throw codedError("ROOM2_SOURCE_MATERIAL_CARDINALITY", `Primitive ${record.stablePrimitiveId} does not have exactly one source material.`);
      }
      const material = materials[0];
      const materialAssociation = this.gltf.parser.associations.get(material);
      if (materialAssociation?.materials !== record.originalMaterialIndex) {
        throw codedError("ROOM2_SOURCE_MATERIAL_ASSOCIATION", `Primitive ${record.stablePrimitiveId} lost its original material association.`);
      }
      record.sourceMaterial = material;
      this.sourceMaterials.add(material);
      for (const texture of texturesInMaterial(material)) this.sourceTextures.add(texture);
      record.object.userData ||= {};
      record.object.userData.room2StablePrimitiveId = record.stablePrimitiveId;
      record.object.userData.room2OriginalMaterialIndex = record.originalMaterialIndex;
      record.object.userData.room2SemanticZone = record.zone.zone;
      record.object.userData.room2SemanticStatus = record.zone.status;
    }
  }

  buildStaticMaterials() {
    for (const record of this.meshRecords) {
      if (record.originalMaterialIndex === ROOM2_APPEARANCE_PROFILE.semanticMapping.publishedFinishMaterialIndex) continue;
      // The immersive material-zone audit grants automatic web appearance only
      // to exact PROVEN bindings. Every PROVISIONAL/BLOCKED primitive must keep
      // the material parsed from the authoritative GLB byte-for-byte.
      if (record.zone.status !== "PROVEN") continue;
      if (this.staticMaterials.has(record.originalMaterialIndex)) continue;
      const recipe = ROOM2_APPEARANCE_PROFILE.materials.surfaceRecipes[record.zone.zone];
      if (!recipe) throw codedError("ROOM2_SURFACE_RECIPE_MISSING", `No recipe exists for ${record.zone.zone}.`);
      const material = cloneStandardMaterial(this.THREE, record.sourceMaterial);
      applyRecipe(this.THREE, material, recipe);
      material.name = `room2-commercial-pbr-v1:${record.zone.zone}`;
      material.userData = {
        ...material.userData,
        room2Owned: true,
        room2Profile: ROOM2_APPEARANCE_PROFILE.schema,
        room2Zone: record.zone.zone,
        room2SemanticStatus: record.zone.status,
        room2OriginalMaterialIndex: record.originalMaterialIndex
      };
      if (record.zone.zone === "floor" && material.map) {
        material.map = clonePreservedTexture(material.map, this.maximumAnisotropy, "room2-floor-preserved-map");
        this.staticTextureClones.add(material.map);
      }
      this.staticMaterials.set(record.originalMaterialIndex, material);
    }
  }

  applyStaticMaterials() {
    for (const record of this.meshRecords) {
      if (record.originalMaterialIndex === ROOM2_APPEARANCE_PROFILE.semanticMapping.publishedFinishMaterialIndex) continue;
      if (record.zone.status !== "PROVEN") {
        record.object.material = record.sourceMaterial;
        continue;
      }
      const material = this.staticMaterials.get(record.originalMaterialIndex);
      record.object.material = material;
      const recipe = ROOM2_APPEARANCE_PROFILE.materials.surfaceRecipes[record.zone.zone];
      record.object.castShadow = recipe.castShadow;
      record.object.receiveShadow = recipe.receiveShadow;
    }
  }

  applyLoadedFinish(finish) {
    const familyRecord = this.familyRecords.get(finish.family);
    if (familyRecord?.state !== "ready") throw codedError("ROOM2_FINISH_FAMILY_NOT_READY", `Finish family ${finish.family} is not ready.`);
    const nextMaterials = new Set();
    const nextTextureClones = new Set();
    const assignments = [];
    for (const record of this.meshRecords) {
      if (!record.zone.finishTarget) continue;
      const material = cloneStandardMaterial(this.THREE, record.sourceMaterial);
      const role = resolveRoom2MillworkRole(record.meshIndex, record.namePath);
      const grain = ROOM2_APPEARANCE_PROFILE.materials.grain.roles[role]
        || ROOM2_APPEARANCE_PROFILE.materials.grain.roles.default;
      const cutSeedRole = classifyRoom2MillworkRole(record.namePath);
      const cutHash = stableStringHash(`${record.stablePrimitiveId}:${cutSeedRole}`);
      const phaseBucket = cutHash % ROOM2_APPEARANCE_PROFILE.materials.grain.stablePhaseBuckets;
      const halfTurn = Math.floor(cutHash / ROOM2_APPEARANCE_PROFILE.materials.grain.stablePhaseBuckets) % 2;
      const textureRepeat = ROOM2_APPEARANCE_PROFILE.materials.families[finish.family].authoredUvRepeat || [1, 1];
      clearSurfaceMaps(material);
      for (const [slot, sourceTexture] of Object.entries(familyRecord.textures)) {
        const texture = cloneFinishTexture(sourceTexture, {
          THREE: this.THREE,
          role,
          grain,
          phaseBucket,
          halfTurn,
          repeat: textureRepeat,
          phaseStep: ROOM2_APPEARANCE_PROFILE.materials.grain.phaseStep
        });
        material[slot] = texture;
        nextTextureClones.add(texture);
      }
      material.color.set(finish.calibratedMultiplier);
      material.metalness = 0;
      material.roughness = finish.roughnessFactor;
      const normalScale = ROOM2_APPEARANCE_PROFILE.materials.families[finish.family].normalScale;
      material.normalScale.set(...normalScale);
      material.emissive?.setHex?.(0x000000);
      if ("emissiveIntensity" in material) material.emissiveIntensity = 0;
      material.name = `room2-commercial-pbr-v1:${finish.id}:${role}:phase-${phaseBucket}`;
      material.userData = {
        ...material.userData,
        room2Owned: true,
        room2Profile: ROOM2_APPEARANCE_PROFILE.schema,
        room2Zone: "millwork",
        room2SemanticStatus: "PROVEN",
        room2FinishId: finish.id,
        room2FinishFamily: finish.family,
        room2Role: role,
        room2CutSeedRole: cutSeedRole,
        room2GrainAxis: grain.axis,
        room2PhaseBucket: phaseBucket,
        room2HalfTurn: halfTurn,
        room2OriginalMaterialIndex: record.originalMaterialIndex
      };
      nextMaterials.add(material);
      assignments.push([record, material]);
    }
    if (assignments.length !== ROOM2_APPEARANCE_PROFILE.semanticMapping.publishedFinishPrimitiveCount) {
      disposeSet(nextTextureClones);
      disposeSet(nextMaterials);
      throw codedError("ROOM2_FINISH_COVERAGE_MISMATCH", `Finish assignment covered ${assignments.length} primitives instead of 118.`);
    }

    for (const [record, material] of assignments) {
      record.object.material = material;
      record.object.castShadow = true;
      record.object.receiveShadow = true;
      record.object.userData.room2FinishId = finish.id;
      record.object.userData.room2FinishFamily = finish.family;
    }
    disposeSet(this.activeTextureClones);
    disposeSet(this.activeFinishMaterials);
    this.activeTextureClones = nextTextureClones;
    this.activeFinishMaterials = nextMaterials;
    this.activeFinishId = finish.id;
    this.finishApplicationCount += 1;
    this.assertGeometryIdentity();
  }

  assertGeometryIdentity() {
    if (!this.geometryLedger.length) return true;
    for (let index = 0; index < this.meshRecords.length; index += 1) {
      const record = this.meshRecords[index];
      const expected = this.geometryLedger[index];
      const actual = geometryIdentityRecord(record);
      if (actual.geometry !== expected.geometry || actual.index !== expected.index) {
        throw codedError("ROOM2_RUNTIME_GEOMETRY_MUTATION", `Geometry identity changed at ${record.stablePrimitiveId}.`);
      }
      if (actual.attributes.length !== expected.attributes.length) {
        throw codedError("ROOM2_RUNTIME_ATTRIBUTE_MUTATION", `Attribute cardinality changed at ${record.stablePrimitiveId}.`);
      }
      for (let attributeIndex = 0; attributeIndex < actual.attributes.length; attributeIndex += 1) {
        const current = actual.attributes[attributeIndex];
        const source = expected.attributes[attributeIndex];
        if (current.name !== source.name || current.attribute !== source.attribute || current.array !== source.array || current.count !== source.count) {
          throw codedError("ROOM2_RUNTIME_ATTRIBUTE_MUTATION", `Attribute identity/count changed at ${record.stablePrimitiveId}/${current.name}.`);
        }
      }
    }
    return true;
  }

  refreshAppearanceFingerprint() {
    const canonical = JSON.stringify(this.meshRecords.map((record) => appearanceRecord(record)));
    this.appearanceCanonical = canonical;
    this.appearanceFingerprintPromise = sha256Text(canonical).then((digest) => {
      if (!this.disposed && this.appearanceCanonical === canonical) this.appearanceFingerprint = digest;
      return digest;
    });
    return this.appearanceFingerprintPromise;
  }

  getDiagnostics() {
    const finish = resolveRoom2Finish(this.activeFinishId || this.pendingFinishId);
    const familyStates = Object.fromEntries([...this.familyRecords].map(([id, record]) => [id, {
      state: record.state,
      attempts: record.attempts,
      textureCount: record.textures ? Object.keys(record.textures).length : 0
    }]));
    const highAnisotropyTextures = new Set([
      ...[...this.familyRecords.values()].flatMap((record) => Object.values(record.textures || {})),
      ...this.activeTextureClones,
      ...this.staticTextureClones
    ]);
    return Object.freeze({
      schema: "jq-room2-runtime-commercial-appearance-diagnostics-v1",
      profile: ROOM2_APPEARANCE_PROFILE.schema,
      selectedFinishId: this.activeFinishId,
      pendingFinishId: this.pendingFinishId,
      finishFamily: finish.family,
      finishApplicationCount: this.finishApplicationCount,
      appearanceFingerprintVersion: "jq-room2-runtime-appearance-v1",
      appearanceFingerprint: this.appearanceFingerprint,
      appearanceRecordCount: this.meshRecords.length,
      cutMapping: summarizeCutMapping(this.meshRecords),
      semanticCoverage: {
        primitiveCount: this.meshRecords.length,
        proven: this.meshRecords.filter(({ zone }) => zone.status === "PROVEN").length,
        provisional: this.meshRecords.filter(({ zone }) => zone.status === "PROVISIONAL").length,
        unmapped: this.meshRecords.filter(({ zone }) => !zone).length,
        finishTargets: this.meshRecords.filter(({ zone }) => zone.finishTarget).length,
        provisionalEmbeddedMaterialsRetained: this.meshRecords.filter(
          ({ zone, object, sourceMaterial }) => zone.status === "PROVISIONAL" && object.material === sourceMaterial
        ).length,
        blockedEmbeddedMaterialsRetained: this.meshRecords.filter(
          ({ zone, object, sourceMaterial }) => zone.status === "BLOCKED" && object.material === sourceMaterial
        ).length
      },
      geometryMutation: {
        checked: this.geometryLedger.length > 0,
        uvReplacements: 0,
        tangentAppends: 0,
        deindexed: false,
        vertexDuplication: false,
        indexRewrite: false
      },
      families: familyStates,
      textureRequests: Object.fromEntries(this.textureRequestCounts),
      textureSuccessfulRequests: Object.fromEntries(this.textureSuccessfulRequestCounts),
      textureCache: Object.fromEntries([...this.textureCache].map(([url, entry]) => [url, {
        state: entry.state,
        attempts: entry.attempts,
        successfulRequests: this.textureSuccessfulRequestCounts.get(url) || 0
      }])),
      successfulTextureRequestCount: [...this.textureSuccessfulRequestCounts.values()].reduce((sum, count) => sum + count, 0),
      failedTextureRequestCount: this.failedTextureRequestCount,
      maximumAnisotropy: this.maximumAnisotropy,
      anisotropyUpdateCount: this.anisotropyUpdateCount,
      highAnisotropyTextureCount: highAnisotropyTextures.size,
      highAnisotropyValues: [...new Set([...highAnisotropyTextures].map((texture) => texture.anisotropy))].sort((left, right) => left - right),
      residentFamilyCount: [...this.familyRecords.values()].filter(({ state }) => state === "ready").length,
      textureCacheEntryCount: this.textureCache.size,
      ownedSourceMaterialCount: this.sourceMaterials.size,
      ownedSourceTextureCount: this.sourceTextures.size,
      ownedStaticMaterialCount: this.staticMaterials.size,
      ownedStaticTextureCloneCount: this.staticTextureClones.size,
      ownedActiveFinishMaterialCount: this.activeFinishMaterials.size,
      ownedActiveTextureCloneCount: this.activeTextureClones.size
    });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    disposeSet(this.activeTextureClones);
    disposeSet(this.activeFinishMaterials);
    disposeSet(this.staticTextureClones);
    disposeSet(new Set(this.staticMaterials.values()));
    disposeSet(new Set([...this.textureCache.values()].flatMap((entry) => entry.texture ? [entry.texture] : [])));
    disposeSet(this.sourceTextures);
    disposeSet(this.sourceMaterials);
    this.familyRecords.clear();
    this.textureCache.clear();
    this.staticMaterials.clear();
    this.meshRecords = [];
    this.geometryLedger = [];
    this.gltf = null;
    this.json = null;
    this.appearanceCanonical = "";
  }
}

function summarizeCutMapping(records) {
  const finishRecords = records.filter(({ zone }) => zone.finishTarget);
  const roleCounts = {};
  const phaseBuckets = new Set();
  const halfTurnCounts = { 0: 0, 1: 0 };
  let alignedTextureTransforms = true;
  for (const record of finishRecords) {
    const material = record.object.material;
    const role = material?.userData?.room2Role || "unassigned";
    const phaseBucket = Number(material?.userData?.room2PhaseBucket);
    const halfTurn = Number(material?.userData?.room2HalfTurn);
    roleCounts[role] = (roleCounts[role] || 0) + 1;
    if (Number.isInteger(phaseBucket)) phaseBuckets.add(phaseBucket);
    if (halfTurn === 0 || halfTurn === 1) halfTurnCounts[halfTurn] += 1;
    const transforms = [material?.map, material?.normalMap, material?.roughnessMap]
      .filter(Boolean)
      .map((texture) => JSON.stringify({
        offset: texture.offset.toArray(),
        repeat: texture.repeat.toArray(),
        rotation: texture.rotation
      }));
    if (new Set(transforms).size > 1) alignedTextureTransforms = false;
  }
  return Object.freeze({
    stableIdentityAlgorithm: "fnv1a-stable-primitive-plus-supporting-runtime-role-v1",
    roleCounts: Object.freeze(Object.fromEntries(Object.entries(roleCounts).sort(([left], [right]) => left.localeCompare(right)))),
    uniquePhaseBucketCount: phaseBuckets.size,
    halfTurnCounts: Object.freeze(halfTurnCounts),
    runtimeUvMirroring: false,
    alignedTextureTransforms
  });
}

function collectMeshRecords(gltf, json) {
  const records = [];
  gltf.scene.traverse((object) => {
    if (!object.isMesh) return;
    const association = gltf.parser.associations.get(object) || {};
    if (!Number.isInteger(association.meshes) || !Number.isInteger(association.primitives)) {
      throw codedError("ROOM2_STABLE_ASSOCIATION_MISSING", `Runtime mesh ${object.name || "unnamed"} lacks mesh/primitive associations.`);
    }
    const sourcePrimitive = json.meshes?.[association.meshes]?.primitives?.[association.primitives];
    if (!sourcePrimitive || !Number.isInteger(sourcePrimitive.material)) {
      throw codedError("ROOM2_SOURCE_PRIMITIVE_MISSING", `Source primitive ${association.meshes}/${association.primitives} is unavailable.`);
    }
    const nodePath = runtimeNodePath(object, gltf.parser.associations);
    const stablePrimitiveId = `scene:0/nodes:${nodePath.join("/")}/mesh:${association.meshes}/primitive:${association.primitives}`;
    const zone = resolveRoom2SemanticZone(sourcePrimitive.material);
    if (!zone) throw codedError("ROOM2_SEMANTIC_ZONE_UNMAPPED", `Original material ${sourcePrimitive.material} is unmapped.`);
    records.push({
      object,
      meshIndex: association.meshes,
      primitiveIndex: association.primitives,
      originalMaterialIndex: sourcePrimitive.material,
      nodePath,
      namePath: runtimeNamePath(object),
      stablePrimitiveId,
      zone,
      sourceMaterial: null
    });
  });
  records.sort((left, right) => left.meshIndex - right.meshIndex || left.primitiveIndex - right.primitiveIndex);
  return records;
}

function validateSemanticCoverage(records) {
  if (records.length !== 185) throw codedError("ROOM2_SEMANTIC_PRIMITIVE_COUNT", `Semantic binding found ${records.length} primitives instead of 185.`);
  if (new Set(records.map(({ stablePrimitiveId }) => stablePrimitiveId)).size !== 185) {
    throw codedError("ROOM2_SEMANTIC_DUPLICATE_STABLE_ID", "Semantic binding produced duplicate stable primitive IDs.");
  }
  const finishTargets = records.filter(({ zone }) => zone.finishTarget);
  if (finishTargets.length !== 118 || finishTargets.some(({ originalMaterialIndex }) => originalMaterialIndex !== 3)) {
    throw codedError("ROOM2_SEMANTIC_FINISH_AUTHORITY", "Published Finish coverage differs from the exact material-3 authority.");
  }
  const expectedCounts = new Map([[0, 7], [1, 48], [2, 8], [3, 118], [4, 1], [5, 1], [6, 1], [7, 1]]);
  for (const [materialIndex, count] of expectedCounts) {
    if (records.filter((record) => record.originalMaterialIndex === materialIndex).length !== count) {
      throw codedError("ROOM2_SEMANTIC_MATERIAL_COUNT", `Original material ${materialIndex} consumer count changed.`);
    }
  }
}

function cloneStandardMaterial(THREE, source) {
  const material = source?.isMeshStandardMaterial ? source.clone() : new THREE.MeshStandardMaterial();
  if (!source) return material;
  for (const field of [
    "transparent", "opacity", "alphaTest", "alphaHash", "side", "shadowSide",
    "depthTest", "depthWrite", "colorWrite", "blending", "blendSrc", "blendDst",
    "blendEquation", "blendSrcAlpha", "blendDstAlpha", "blendEquationAlpha",
    "premultipliedAlpha", "dithering", "toneMapped", "fog", "visible",
    "vertexColors", "flatShading", "forceSinglePass"
  ]) {
    if (field in source) material[field] = source[field];
  }
  for (const slot of TEXTURE_SLOTS) if (slot in source) material[slot] = source[slot];
  return material;
}

function applyRecipe(THREE, material, recipe) {
  material.color.set(recipe.color);
  material.metalness = recipe.metalness;
  material.roughness = recipe.roughness;
  if (!recipe.preserveSourceMap) {
    material.map = null;
    material.normalMap = null;
    material.roughnessMap = null;
    material.metalnessMap = null;
    material.aoMap = null;
  }
  material.emissive?.set?.(recipe.emissive || "#000000");
  if ("emissiveIntensity" in material) material.emissiveIntensity = recipe.emissiveIntensity || 0;
  if (recipe.emissiveUsesBaseMap) material.emissiveMap = material.map;
  material.normalMapType = THREE.TangentSpaceNormalMap;
  material.needsUpdate = true;
}

function clearSurfaceMaps(material) {
  material.map = null;
  material.normalMap = null;
  material.roughnessMap = null;
  material.metalnessMap = null;
  material.aoMap = null;
  material.emissiveMap = null;
  material.bumpMap = null;
  material.displacementMap = null;
}

function cloneFinishTexture(source, options) {
  const texture = source.clone();
  const { grain, halfTurn, phaseBucket, repeat, phaseStep, role } = options;
  texture.name = `${source.name}:${role}:phase-${phaseBucket}`;
  texture.userData = {
    ...source.userData,
    room2OwnedClone: true,
    room2Role: role,
    room2GrainAxis: grain.axis,
    room2PhaseBucket: phaseBucket,
    room2HalfTurn: halfTurn
  };
  texture.center.set(0.5, 0.5);
  texture.rotation = grain.rotationRadians + halfTurn * Math.PI;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.offset.set((phaseBucket * phaseStep[0]) % 1, (phaseBucket * phaseStep[1]) % 1);
  texture.needsUpdate = true;
  return texture;
}

function stableStringHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  }
  return hash >>> 0;
}

function clonePreservedTexture(source, anisotropy, name) {
  const texture = source.clone();
  texture.name = name;
  texture.anisotropy = anisotropy;
  texture.userData = { ...source.userData, room2OwnedClone: true, room2PreservedSource: true };
  texture.needsUpdate = true;
  return texture;
}

function runtimeNodePath(object, associations) {
  const path = [];
  let cursor = object;
  while (cursor) {
    const nodeIndex = associations.get(cursor)?.nodes;
    if (Number.isInteger(nodeIndex)) path.push(nodeIndex);
    cursor = cursor.parent;
  }
  return path.reverse();
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

function geometryIdentityRecord(record) {
  const geometry = record.object.geometry;
  return {
    geometry,
    index: geometry.index,
    attributes: Object.entries(geometry.attributes).sort(([left], [right]) => left.localeCompare(right)).map(([name, attribute]) => ({
      name,
      attribute,
      array: attribute.array,
      count: attribute.count
    }))
  };
}

function appearanceRecord(record) {
  const material = record.object.material;
  return {
    stablePrimitiveId: record.stablePrimitiveId,
    meshIndex: record.meshIndex,
    primitiveIndex: record.primitiveIndex,
    originalMaterialIndex: record.originalMaterialIndex,
    semanticStatus: record.zone.status,
    semanticZone: record.zone.zone,
    material: {
      type: material?.type || null,
      name: material?.name || "",
      color: material?.color?.getHexString?.() || null,
      emissive: material?.emissive?.getHexString?.() || null,
      emissiveIntensity: finite(material?.emissiveIntensity),
      metalness: finite(material?.metalness),
      roughness: finite(material?.roughness),
      transparent: Boolean(material?.transparent),
      opacity: finite(material?.opacity),
      alphaTest: finite(material?.alphaTest),
      alphaHash: Boolean(material?.alphaHash),
      side: finite(material?.side),
      shadowSide: finite(material?.shadowSide),
      depthTest: Boolean(material?.depthTest),
      depthWrite: Boolean(material?.depthWrite),
      visible: Boolean(material?.visible),
      maps: Object.fromEntries(TEXTURE_SLOTS.map((slot) => [slot, textureRecord(material?.[slot])]))
    },
    castShadow: Boolean(record.object.castShadow),
    receiveShadow: Boolean(record.object.receiveShadow)
  };
}

function textureRecord(texture) {
  if (!texture) return null;
  return {
    source: texture.userData?.room2SourceUrl || null,
    colorSpace: texture.colorSpace,
    flipY: texture.flipY,
    wrapS: texture.wrapS,
    wrapT: texture.wrapT,
    minFilter: texture.minFilter,
    magFilter: texture.magFilter,
    generateMipmaps: texture.generateMipmaps,
    anisotropy: texture.anisotropy,
    offset: texture.offset?.toArray?.() || null,
    repeat: texture.repeat?.toArray?.() || null,
    rotation: finite(texture.rotation)
  };
}

function texturesInMaterial(material) {
  return TEXTURE_SLOTS.flatMap((slot) => material?.[slot]?.isTexture ? [material[slot]] : []);
}

function disposeSet(values) {
  for (const value of values || []) {
    try {
      value?.dispose?.();
    } catch {
      // WebGPU can fail mid-frame with partially initialized disposal
      // listeners. Continue releasing the remaining owned resources.
    }
  }
  values?.clear?.();
}

function finite(value) {
  return Number.isFinite(value) ? value : null;
}

async function sha256Text(value) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((entry) => entry.toString(16).padStart(2, "0")).join("");
}

function codedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
