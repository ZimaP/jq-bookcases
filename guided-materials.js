export const GUIDED_MATERIAL_CONTRACT_VERSION = 1;

const WOODS = Object.freeze({
  "white-oak": wood("white-oak", "White Oak", [24, 48], 0.62),
  "natural-oak": wood("natural-oak", "Natural Oak", [24, 48], 0.58),
  "light-walnut": wood("light-walnut", "Light Walnut", [22, 44], 0.57),
  "medium-walnut": wood("medium-walnut", "Medium Walnut", [22, 44], 0.55),
  "dark-walnut": wood("dark-walnut", "Dark Walnut", [22, 44], 0.54)
});

const PAINTS = Object.freeze({
  "warm-white": paint("warm-white", "Warm White", "#f3f0e9", 0.62),
  "soft-ivory": paint("soft-ivory", "Soft Ivory", "#e8dfd0", 0.63),
  "sage-gray": paint("sage-gray", "Sage Gray", "#89918a", 0.65),
  charcoal: paint("charcoal", "Charcoal", "#343638", 0.58),
  // Existing saved projects may contain this pre-v1 finish. It uses the same
  // sprayed-paint surface maps without masquerading as one of the package IDs.
  "light-greige": paint("light-greige", "Light Greige", "#b9b6ad", 0.64, true)
});

const ACCENT_PAINTS = Object.freeze({
  "warm-linen": paint("warm-linen", "Warm Linen", "#d8cec0", 0.62),
  "deep-olive": paint("deep-olive", "Deep Olive", "#5d6250", 0.62),
  "ink-blue": paint("ink-blue", "Ink Blue", "#384b59", 0.6)
});

export const GUIDED_MATERIAL_MANIFEST = Object.freeze({
  woods: WOODS,
  paints: PAINTS,
  accentPaints: ACCENT_PAINTS,
  environments: Object.freeze({
    warm: Object.freeze({
      id: "customer-warm",
      source: "assets/environments/jq-warm-interior.hdr",
      browserPreview: "assets/environments/jq-warm-interior.jpg"
    }),
    neutral: Object.freeze({
      id: "material-qa-neutral",
      source: "assets/environments/jq-neutral-studio.hdr",
      browserPreview: "assets/environments/jq-neutral-studio.jpg"
    })
  })
});

export const GUIDED_GRAIN_ORIENTATION = Object.freeze({
  side_panel: "vertical",
  divider: "vertical",
  door: "vertical",
  drawer_front: "vertical",
  front_stile: "vertical",
  front_rail: "long-axis",
  front_field: "vertical",
  shelf: "long-axis",
  fixed_shelf: "long-axis",
  top_panel: "long-axis",
  trim: "extrusion-axis",
  crown: "extrusion-axis",
  back_panel: "vertical"
});

const sharedTextureCaches = new WeakMap();
const sharedEnvironmentCaches = new WeakMap();

function wood(id, label, repeatInches, roughness) {
  const folder = `assets/textures/wood/${id}`;
  return Object.freeze({
    id,
    label,
    family: "wood",
    repeatInches: Object.freeze(repeatInches),
    roughness,
    maps: Object.freeze({
      map: `${folder}/albedo.jpg`,
      normalMap: `${folder}/normal.png`,
      roughnessMap: `${folder}/roughness.png`,
      aoMap: `${folder}/ao.png`
    })
  });
}

function paint(id, label, baseColor, roughness, legacy = false) {
  return Object.freeze({
    id,
    label,
    family: "paint",
    baseColor,
    roughness,
    legacy,
    repeatInches: Object.freeze([12, 12]),
    maps: Object.freeze({
      normalMap: "assets/textures/paint/sprayed-normal.png",
      roughnessMap: "assets/textures/paint/sprayed-roughness.png"
    })
  });
}

export function resolveGuidedMaterial(finishId) {
  return WOODS[finishId] || PAINTS[finishId] || WOODS["natural-oak"];
}

export function getGuidedGrainOrientation(role) {
  return GUIDED_GRAIN_ORIENTATION[String(role || "").replaceAll("-", "_")]
    || "long-axis";
}

export function computePhysicalUvScales(sizeInches, repeatInches, role) {
  const [width, height, depth] = normalizeDimensions(sizeInches);
  const [repeatWidth, repeatLength] = normalizeRepeat(repeatInches);
  const orientation = getGuidedGrainOrientation(role);
  const vertical = orientation === "vertical";
  return Object.freeze({
    orientation,
    xFaces: Object.freeze([depth / repeatWidth, height / repeatLength]),
    yFaces: Object.freeze([
      (vertical ? depth : width) / repeatWidth,
      (vertical ? width : depth) / repeatLength
    ]),
    zFaces: Object.freeze([
      (vertical ? width : height) / repeatWidth,
      (vertical ? height : width) / repeatLength
    ]),
    rotateFront: !vertical
  });
}

/**
 * BoxGeometry has four UV vertices for each ±X, ±Y, and ±Z face. Replacing
 * their unit-square values with physical repeats keeps grain size stable when
 * dimensions change; no mesh or root scale participates in sizing.
 */
export function applyPhysicalBoxUvs(geometry, sizeInches, repeatInches, role) {
  const uv = geometry?.attributes?.uv;
  if (!uv || uv.count < 24) return false;
  const scales = computePhysicalUvScales(sizeInches, repeatInches, role);
  const faces = [
    { offset: 0, scale: scales.xFaces, rotate: false },
    { offset: 4, scale: scales.xFaces, rotate: false },
    { offset: 8, scale: scales.yFaces, rotate: !scales.rotateFront },
    { offset: 12, scale: scales.yFaces, rotate: !scales.rotateFront },
    { offset: 16, scale: scales.zFaces, rotate: scales.rotateFront },
    { offset: 20, scale: scales.zFaces, rotate: scales.rotateFront }
  ];
  const unit = [[0, 1], [1, 1], [0, 0], [1, 0]];
  for (const face of faces) {
    for (let index = 0; index < 4; index += 1) {
      const [sourceU, sourceV] = unit[index];
      const u = (face.rotate ? sourceV : sourceU) * face.scale[0];
      const v = (face.rotate ? sourceU : sourceV) * face.scale[1];
      uv.setXY(face.offset + index, u, v);
    }
  }
  uv.needsUpdate = true;
  if (!geometry.attributes.uv2 && typeof geometry.setAttribute === "function") {
    geometry.setAttribute("uv2", uv.clone());
  }
  geometry.userData ||= {};
  geometry.userData.guidedPhysicalUvs = {
    units: "inches",
    role,
    repeatInches: [...normalizeRepeat(repeatInches)]
  };
  return true;
}

/**
 * Map an authored extrusion in physical inches. V always follows the grain's
 * extrusion axis, so length changes add repeats instead of stretching a
 * normalized texture over the new part. U follows the two-axis cross-section.
 */
export function applyPhysicalExtrusionUvs(
  geometry,
  repeatInches,
  extrusionAxis,
  options = {}
) {
  const position = geometry?.attributes?.position;
  const uv = geometry?.attributes?.uv;
  if (!position || !uv || position.count !== uv.count || !["x", "y", "z"].includes(extrusionAxis)) {
    return false;
  }
  const unitsPerInch = Number(options.unitsPerInch);
  const sceneUnitsPerInch = Number.isFinite(unitsPerInch) && unitsPerInch > 0 ? unitsPerInch : 1;
  const [, repeatLength] = normalizeRepeat(repeatInches);
  const [repeatWidth] = normalizeRepeat(repeatInches);
  const crossSectionAxes = Array.isArray(options.crossSectionAxes)
    ? options.crossSectionAxes.filter((axis) => ["x", "y", "z"].includes(axis) && axis !== extrusionAxis).slice(0, 2)
    : ["x", "y", "z"].filter((axis) => axis !== extrusionAxis);
  const read = (attribute, axis, index) => attribute[`get${axis.toUpperCase()}`](index);

  for (let index = 0; index < position.count; index += 1) {
    const extrusionInches = read(position, extrusionAxis, index) / sceneUnitsPerInch;
    const crossSectionInches = crossSectionAxes.reduce((sum, axis) => (
      sum + read(position, axis, index) / sceneUnitsPerInch
    ), 0);
    uv.setXY(index, crossSectionInches / repeatWidth, extrusionInches / repeatLength);
  }
  uv.needsUpdate = true;
  if (typeof geometry.setAttribute === "function") {
    geometry.setAttribute("uv2", uv.clone());
  }
  geometry.userData ||= {};
  geometry.userData.guidedPhysicalUvs = {
    units: "inches",
    role: options.role || "crown",
    orientation: "extrusion-axis",
    extrusionAxis,
    crossSectionAxes,
    repeatInches: [...normalizeRepeat(repeatInches)],
    unitsPerInch: sceneUnitsPerInch
  };
  return true;
}

export function createGuidedMaterialLibrary(THREE, selection = {}, options = {}) {
  if (!THREE?.MeshStandardMaterial || !THREE?.TextureLoader) {
    throw new TypeError("A compatible Three.js namespace is required.");
  }
  const finish = resolveGuidedMaterial(selection?.finish?.id || selection?.finishId || selection?.finish);
  const accentHex = normalizeColor(
    selection?.accentFinish?.color || selection?.accentColor,
    finish.baseColor || "#b88e5e"
  );
  const accentId = selection?.accentFinish?.id || selection?.accentFinishId || selection?.accentFinish;
  const accentMatchesExterior = !accentId || accentId === "no-accent";
  const surface = createSurfaceMaterial(THREE, finish, options);
  const accentDefinition = ACCENT_PAINTS[accentId] || paint(
    String(accentId || "custom-accent"),
    "Custom Accent",
    accentHex,
    0.62
  );
  const accentSurface = accentMatchesExterior
    ? surface.clone()
    : createSurfaceMaterial(THREE, accentDefinition, options);
  const hardwareAppearance = resolveHardwareAppearance(selection?.details?.hardware || selection?.hardware);
  const darkEdge = new THREE.Color(surface.color).lerp(new THREE.Color(0x1d1915), 0.52);
  const insetColor = new THREE.Color(surface.color).lerp(new THREE.Color(0xf8f4ed), finish.family === "wood" ? 0.08 : 0.04);
  const lightingId = selection?.details?.lighting || selection?.lighting;
  const lightingColor = lightingId === "integrated-led" ? 0xffe8be : 0xffcf91;

  const library = {
    case: surface,
    side: surface.clone(),
    back: surface.clone(),
    front: surface.clone(),
    inset: new THREE.MeshStandardMaterial({ color: insetColor, roughness: 0.68, metalness: 0 }),
    // "Match exterior" must retain the selected wood/paint map system and
    // physical grain scale; a flat fallback color would break material parity.
    // Colored accents are sprayed paints and share the same cached normal and
    // roughness maps as the exterior paint system.
    accent: accentSurface,
    reveal: new THREE.MeshStandardMaterial({ color: darkEdge, roughness: 0.88, metalness: 0 }),
    toe: new THREE.MeshStandardMaterial({ color: 0x292621, roughness: 0.9, metalness: 0 }),
    hardware: new THREE.MeshStandardMaterial(hardwareAppearance),
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
    edge: new THREE.LineBasicMaterial({ color: darkEdge, transparent: true, opacity: 0.2 }),
    screenEdge: new THREE.LineBasicMaterial({ color: 0x4c5052, transparent: true, opacity: 0.34 })
  };
  library.side.roughness = Math.min(1, finish.roughness + 0.02);
  library.back.roughness = Math.min(1, finish.roughness + 0.1);
  Object.entries(library).forEach(([slot, material]) => {
    if (!material?.isMaterial) return;
    material.userData ||= {};
    material.userData.guidedMaterialContractVersion = GUIDED_MATERIAL_CONTRACT_VERSION;
    material.userData.guidedFinishId = slot === "accent" && !accentMatchesExterior
      ? accentDefinition.id
      : finish.id;
  });
  library.repeatInches = finish.repeatInches;
  library.finishId = finish.id;
  library.finishFamily = finish.family;
  library.accentFinishId = accentMatchesExterior ? "no-accent" : accentDefinition.id;
  library.accentMatchesExterior = accentMatchesExterior;
  return library;
}

export function applyGuidedEnvironment(THREE, scene, renderer, mode = "warm", options = {}) {
  if (!scene || !THREE?.TextureLoader) return null;
  const definition = GUIDED_MATERIAL_MANIFEST.environments[mode]
    || GUIDED_MATERIAL_MANIFEST.environments.warm;
  let cache = sharedEnvironmentCaches.get(THREE);
  if (!cache) {
    cache = new Map();
    sharedEnvironmentCaches.set(THREE, cache);
  }
  const record = getSharedAssetRecord(
    cache,
    definition.id,
    THREE,
    definition.browserPreview,
    options,
    (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      texture.colorSpace = THREE.SRGBColorSpace;
    }
  );
  const texture = record.texture;
  scene.environment = texture;
  scene.userData ||= {};
  scene.userData.environmentSource = definition.source;
  scene.userData.environmentPreview = definition.browserPreview;
  if (renderer) renderer.toneMappingExposure = mode === "neutral" ? 0.95 : 0.88;
  return texture;
}

export function isGuidedSharedTexture(texture) {
  return texture?.userData?.guidedSharedTexture === true;
}

function createSurfaceMaterial(THREE, finish, options) {
  const parameters = {
    color: finish.family === "paint" ? finish.baseColor : 0xffffff,
    roughness: finish.roughness,
    metalness: 0
  };
  for (const [slot, path] of Object.entries(finish.maps)) {
    parameters[slot] = getSharedTexture(THREE, path, {
      color: slot === "map",
      onLoad: options.onLoad,
      onError: options.onError
    });
  }
  if (parameters.normalMap) parameters.normalScale = new THREE.Vector2(0.38, 0.38);
  return new THREE.MeshStandardMaterial(parameters);
}

function getSharedTexture(THREE, path, options = {}) {
  let cache = sharedTextureCaches.get(THREE);
  if (!cache) {
    cache = new Map();
    sharedTextureCaches.set(THREE, cache);
  }
  const key = `${path}|${options.color ? "srgb" : "linear"}`;
  const record = getSharedAssetRecord(
    cache,
    key,
    THREE,
    path,
    options,
    (texture) => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      if (options.color) texture.colorSpace = THREE.SRGBColorSpace;
    }
  );
  return record.texture;
}

function getSharedAssetRecord(cache, key, THREE, source, options, configureTexture) {
  let record = cache.get(key);
  if (record) {
    subscribeToSharedAsset(record, options);
    return record;
  }

  record = {
    source,
    state: "loading",
    error: null,
    texture: null,
    loadCallbacks: new Set(),
    errorCallbacks: new Set()
  };
  cache.set(key, record);
  subscribeToSharedAsset(record, options);
  try {
    record.texture = new THREE.TextureLoader().load(
      source,
      () => settleSharedAsset(record, "ready"),
      undefined,
      (error) => settleSharedAsset(record, "failed", error)
    );
    configureTexture?.(record.texture);
    markSharedTexture(record.texture, source);
    syncSharedAssetTextureState(record);
  } catch (error) {
    cache.delete(key);
    settleSharedAsset(record, "failed", error);
    throw error;
  }
  return record;
}

function subscribeToSharedAsset(record, options = {}) {
  if (record.state === "loading") {
    if (typeof options.onLoad === "function") record.loadCallbacks.add(options.onLoad);
    if (typeof options.onError === "function") record.errorCallbacks.add(options.onError);
    return;
  }
  if (record.state === "ready" && typeof options.onLoad === "function") {
    scheduleSharedAssetCallback(() => options.onLoad());
    return;
  }
  if (record.state === "failed" && typeof options.onError === "function") {
    scheduleSharedAssetCallback(() => options.onError(record.error, record.source));
  }
}

function settleSharedAsset(record, state, error = null) {
  if (!record || record.state !== "loading") return;
  record.state = state;
  record.error = error;
  syncSharedAssetTextureState(record);
  const callbacks = state === "ready"
    ? [...record.loadCallbacks]
    : [...record.errorCallbacks];
  record.loadCallbacks.clear();
  record.errorCallbacks.clear();
  callbacks.forEach((callback) => {
    try {
      if (state === "ready") callback();
      else callback(error, record.source);
    } catch (callbackError) {
      // One consumer must not prevent other mounted previews from settling.
    }
  });
}

function syncSharedAssetTextureState(record) {
  if (!record?.texture) return;
  record.texture.userData ||= {};
  record.texture.userData.guidedAssetStatus = record.state;
}

function scheduleSharedAssetCallback(callback) {
  if (typeof queueMicrotask === "function") {
    queueMicrotask(() => {
      try {
        callback();
      } catch (error) {
        // Match asynchronous loader callbacks without destabilizing the caller.
      }
    });
    return;
  }
  Promise.resolve().then(callback).catch(() => {});
}

function markSharedTexture(texture, source) {
  texture.userData ||= {};
  texture.userData.guidedSharedTexture = true;
  texture.userData.source = source;
}

function resolveHardwareAppearance(hardwareId) {
  if (hardwareId === "black-pull") return { color: 0x202224, roughness: 0.46, metalness: 0.62 };
  if (hardwareId === "brass-pull") return { color: 0xb48a42, roughness: 0.3, metalness: 0.86 };
  return { color: 0x393633, roughness: 0.38, metalness: 0.72 };
}

function normalizeDimensions(candidate) {
  const source = Array.isArray(candidate) ? candidate : [];
  return [0, 1, 2].map((index) => {
    const value = Number(source[index]);
    return Number.isFinite(value) && value > 0 ? value : 0.001;
  });
}

function normalizeRepeat(candidate) {
  const source = Array.isArray(candidate) ? candidate : [];
  return [0, 1].map((index) => {
    const value = Number(source[index]);
    return Number.isFinite(value) && value > 0 ? value : 24;
  });
}

function normalizeColor(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value || "").trim()) ? String(value).trim() : fallback;
}
