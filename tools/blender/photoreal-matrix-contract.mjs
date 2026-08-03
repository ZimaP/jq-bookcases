import { createHash } from "node:crypto";

import {
  PRODUCT_CHOICES,
  SHARED_ROOM_LAYOUTS
} from "../../guided-configurator-data.js";
import {
  createProject,
  normalizeProject,
  prepareMeasurementsForLayout
} from "../../guided-configurator-state.js";
import {
  GUIDED_PRODUCT_LAYOUT_COMPATIBILITY
} from "../../guided-product-adapter.js";
import {
  prepareGuidedProjectPersistence
} from "../../guided-project-engine.js";
import {
  createGuidedSceneDescriptors,
  transformGuidedBoundsToWorld
} from "../../guided-render-contract.js";
import {
  createGuidedAcceptedComponentRenderPlan
} from "../../guided-render-primitives.js";
import {
  convertGuidedBoundsToBlender,
  convertGuidedPointToBlender
} from "../../guided-blender-render-contract.js";

export const PHOTOREAL_MATRIX_KIND = "jq-photoreal-preview-matrix-render-package";
export const PHOTOREAL_MATRIX_SCHEMA_VERSION = 1;
export const PHOTOREAL_MATRIX_PIPELINE_VERSION = "2026.08-universal-photoreal-preview-matrix-v2";
export const PHOTOREAL_MATRIX_PRESENTATION_VERSION = "phase7-warm-residential-matrix-v2";
export const PHOTOREAL_MATRIX_CAPTURE_VERSION = "cycles-1920x1280-256-v1";
export const PHOTOREAL_MATRIX_MANIFEST_KIND = "jq-photoreal-preview-matrix-provenance";
export const PHOTOREAL_MATRIX_MANIFEST_SCHEMA_VERSION = 1;

export const PHOTOREAL_MATRIX_WIDTH = 1920;
export const PHOTOREAL_MATRIX_HEIGHT = 1280;
export const PHOTOREAL_MATRIX_SAMPLES = 256;
export const PHOTOREAL_MATRIX_WEBP_QUALITY = 92;
export const PHOTOREAL_MATRIX_MASTER_COLOR_DEPTH = 16;
export const PHOTOREAL_MATRIX_VALID_COUNT = 50;
export const PHOTOREAL_MATRIX_INVALID_COUNT = 20;
export const PHOTOREAL_MATRIX_WARM_HDR_SHA256 = "49db5b6e13c5b5239d8aca84c055c586dfc71aeaf1e1db64487f5bf8bab66db2";

export const PHOTOREAL_MATRIX_PUBLIC_ROOT = "assets/photos/configurator/photoreal-matrix";
export const PHOTOREAL_MATRIX_MASTER_ROOT = "artifacts/blender-photoreal-matrix";
export const PHOTOREAL_MATRIX_PROVENANCE_PATH = "config/photoreal-preview-matrix-provenance.json";

const SAFE_ID_RE = /^[a-z0-9][a-z0-9-]*$/;
const SHA40_RE = /^[a-f0-9]{40}$/;
const PACKAGE_KEY_RE = /^jq-photoreal-preview-matrix-v1-[a-f0-9]{64}$/;
const VALID_COMPATIBILITY_STATUSES = new Set(["supported", "conditional", "review-only"]);
const OUTPUT_FILENAMES = Object.freeze({
  master: "preview-v1-master.png",
  webp: "preview-v1.webp",
  package: "render-package.json",
  result: "render-result.json",
  blend: "preview-v1.blend"
});

const BASE_SELECTION = Object.freeze({
  finish: "natural-oak",
  accentFinish: "no-accent",
  doorStyle: "shaker",
  hardware: "black-pull",
  lighting: "warm-led",
  baseStyle: "flush-base",
  topTreatment: "small-crown"
});

/*
 * Drawing 4 has a deliberately strict paired-door and shelf-span contract.
 * These overrides use the same customer measurement/state path as the UI and
 * keep every compatible room topology inside that accepted template. They do
 * not alter or bypass product geometry.
 */
const TV_MEASUREMENT_OVERRIDES = Object.freeze({
  "niche-layout": Object.freeze({
    wallWidth: 132,
    ceilingHeight: 108,
    nicheWidth: 108,
    nicheHeight: 108,
    nicheDepth: 14,
    leftReturn: 12,
    rightReturn: 12
  }),
  "left-niche": Object.freeze({
    wallWidth: 132,
    ceilingHeight: 108,
    nicheWidth: 108,
    nicheHeight: 108,
    nicheDepth: 14,
    leftReturn: 24
  }),
  "right-niche": Object.freeze({
    wallWidth: 132,
    ceilingHeight: 108,
    nicheWidth: 108,
    nicheHeight: 108,
    nicheDepth: 14,
    rightReturn: 24
  }),
  "fireplace-wall": Object.freeze({
    wallWidth: 144,
    ceilingHeight: 120,
    fireplaceWidth: 42,
    fireplaceHeight: 24,
    fireplaceDepth: 8,
    mantelWidth: 96,
    mantelHeight: 36,
    tvAboveFireplace: "yes"
  }),
  "door-wall": Object.freeze({
    wallWidth: 144,
    ceilingHeight: 108,
    doorWidth: 36,
    doorLeftDistance: 104
  }),
  "double-opening": Object.freeze({
    wallWidth: 144,
    ceilingHeight: 108,
    openingLeftDistance: 30,
    openingRightDistance: 12
  })
});

const PHASE7_MATERIAL_RECIPES = deepFreeze({
  authority: {
    classification: "PREVIEW_ONLY_AUTHORIZED",
    visualizationProfileId: "natural-oak-visualization-v1",
    materialColorReferenceStatus: "UNVERIFIED",
    customerMaterialApproved: false,
    customerBeautyRenderApproved: false,
    sourceRuleIds: [
      "config/provisional-decisions.json#FINISH-AVAIL-001",
      "config/materials.json#natural-oak",
      "guided-materials.js#GUIDED_MATERIAL_MANIFEST.woods.natural-oak",
      "guided-blender-render-contract.js#warm-led"
    ]
  },
  slotBindings: {
    back: "natural-oak-visualization-v1",
    case: "natural-oak-visualization-v1",
    front: "natural-oak-visualization-v1",
    side: "natural-oak-visualization-v1",
    hardware: "matte-black-coated-dielectric-v1",
    led: "warm-opal-puck-lens-v1",
    screen: "tv-black-glass-v1",
    toe: "deep-shadow-reveal-v1"
  },
  recipes: {
    "natural-oak-visualization-v1": {
      family: "procedural-wood",
      baseColorRamp: [
        [0, [0.4, 0.29, 0.18, 1]],
        [0.34, [0.47, 0.36, 0.235, 1]],
        [0.68, [0.55, 0.45, 0.31, 1]],
        [1, [0.64, 0.55, 0.41, 1]]
      ],
      metallic: 0,
      roughness: 0.58,
      ior: 1.5,
      coatWeight: 0.08,
      coatRoughness: 0.34,
      bumpStrength: 0.12,
      bumpDistanceM: 0.00018,
      grainScale: 10
    },
    "matte-black-coated-dielectric-v1": {
      family: "principled",
      baseColor: [0.014, 0.016, 0.018, 1],
      metallic: 0,
      roughness: 0.47,
      ior: 1.5,
      coatWeight: 0.16,
      coatRoughness: 0.4,
      transmissionWeight: 0,
      emissionColor: [0, 0, 0, 1],
      emissionStrength: 0
    },
    "tv-black-glass-v1": {
      family: "principled",
      baseColor: [0.0035, 0.0045, 0.006, 1],
      metallic: 0,
      roughness: 0.16,
      ior: 1.52,
      coatWeight: 0.34,
      coatRoughness: 0.12,
      transmissionWeight: 0.06,
      emissionColor: [0, 0, 0, 1],
      emissionStrength: 0
    },
    "warm-opal-puck-lens-v1": {
      family: "principled",
      baseColor: [0.78, 0.56, 0.3, 1],
      metallic: 0,
      roughness: 0.34,
      ior: 1.46,
      coatWeight: 0.04,
      coatRoughness: 0.3,
      transmissionWeight: 0.22,
      emissionColor: [1, 0.896269353374, 0.737910408773, 1],
      emissionStrength: 4,
      colorTemperatureK: 2700
    },
    "deep-shadow-reveal-v1": {
      family: "principled",
      baseColor: [0.025, 0.022, 0.019, 1],
      metallic: 0,
      roughness: 0.86,
      ior: 1.5,
      coatWeight: 0,
      coatRoughness: 0,
      transmissionWeight: 0,
      emissionColor: [0, 0, 0, 1],
      emissionStrength: 0
    }
  }
});

export class PhotorealMatrixContractError extends Error {
  constructor(code, message, details = []) {
    super(message);
    this.name = "PhotorealMatrixContractError";
    this.code = code;
    this.details = details;
  }
}

export function discoverPhotorealMatrix() {
  assert(PRODUCT_CHOICES.length === 7, "PRODUCT_COUNT_DRIFT", "The guided catalog must expose exactly seven Step 1 products.");
  assert(SHARED_ROOM_LAYOUTS.length === 10, "LAYOUT_COUNT_DRIFT", "The guided catalog must expose exactly ten Step 2 layouts.");

  const combinations = [];
  for (const product of PRODUCT_CHOICES) {
    const statuses = GUIDED_PRODUCT_LAYOUT_COMPATIBILITY[product.id];
    assert(statuses && typeof statuses === "object", "MISSING_PRODUCT_COMPATIBILITY", `Missing compatibility row for ${product.id}.`);
    for (const layout of SHARED_ROOM_LAYOUTS) {
      const status = statuses[layout.id];
      assert(
        status === "unavailable" || VALID_COMPATIBILITY_STATUSES.has(status),
        "MISSING_LAYOUT_COMPATIBILITY",
        `Missing or unknown compatibility status for ${product.id}:${layout.id}.`
      );
      combinations.push(Object.freeze({
        key: matrixKey(product.id, layout.id),
        productId: product.id,
        productLabel: product.label,
        categoryId: product.categoryId,
        styleId: product.styleId,
        layoutId: layout.id,
        layoutLabel: layout.label,
        compatibilityStatus: status,
        valid: status !== "unavailable",
        publishedPath: publishedPathFor(product.id, layout.id),
        masterPath: masterPathFor(product.id, layout.id)
      }));
    }
  }

  const valid = combinations.filter((entry) => entry.valid);
  const invalid = combinations.filter((entry) => !entry.valid);
  assert(combinations.length === 70, "MATRIX_SIZE_DRIFT", "The guided product/layout matrix must contain 70 pairs.");
  assert(valid.length === PHOTOREAL_MATRIX_VALID_COUNT, "VALID_MATRIX_COUNT_DRIFT", "The guided matrix must contain 50 valid pairs.");
  assert(invalid.length === PHOTOREAL_MATRIX_INVALID_COUNT, "INVALID_MATRIX_COUNT_DRIFT", "The guided matrix must contain 20 unavailable pairs.");
  assert(new Set(combinations.map((entry) => entry.key)).size === combinations.length, "DUPLICATE_MATRIX_KEY", "The guided matrix contains duplicate keys.");

  return deepFreeze({
    products: PRODUCT_CHOICES.map(({ id, label, categoryId, styleId }) => ({ id, label, categoryId, styleId })),
    layouts: SHARED_ROOM_LAYOUTS.map(({ id, label }) => ({ id, label })),
    combinations,
    valid,
    invalid,
    totalCount: combinations.length,
    validCount: valid.length,
    invalidCount: invalid.length
  });
}

export function createCanonicalMatrixFixture(productId, layoutId, options = {}) {
  const matrix = discoverPhotorealMatrix();
  const entry = matrix.combinations.find((candidate) => (
    candidate.productId === productId && candidate.layoutId === layoutId
  ));
  assert(entry, "UNKNOWN_MATRIX_PAIR", `Unknown matrix pair ${productId}:${layoutId}.`);
  assert(entry.valid, "UNAVAILABLE_MATRIX_PAIR", `${entry.key} is explicitly unavailable and must not be rendered.`);

  const product = PRODUCT_CHOICES.find((choice) => choice.id === productId);
  const initial = createProject({
    category: product.categoryId,
    now: 1,
    projectId: `JQ-MATRIX-${productId}-${layoutId}`.toUpperCase()
  });
  const measurements = prepareMeasurementsForLayout(initial, layoutId);
  if (layoutId === "center-recess") measurements.projectionDepth = 14;
  if (productId === "tv-unit") {
    Object.assign(measurements, TV_MEASUREMENT_OVERRIDES[layoutId] || {}, {
      tvScreenSize: 55,
      tvHeight: 28,
      soundbarRequired: "no"
    });
  }

  const project = normalizeProject({
    ...initial,
    productSelected: true,
    currentStep: 5,
    maxVisitedStep: 5,
    category: product.categoryId,
    style: product.styleId,
    layout: layoutId,
    measurements,
    ...BASE_SELECTION
  }, { now: 1 });
  const persistence = prepareGuidedProjectPersistence(project, null, options.engineOptions);
  assert(
    persistence.accepted === true && persistence.persistable === true,
    "CANONICAL_FIXTURE_REJECTED",
    `The canonical matrix fixture ${entry.key} was rejected by the guided engine.`,
    persistence.errors || []
  );
  assert(persistence.specification?.audit?.valid === true, "CANONICAL_FIXTURE_AUDIT_FAILED", `${entry.key} failed its accepted render audit.`);
  assert(persistence.specification.productId === productId, "CANONICAL_PRODUCT_ID_MISMATCH", `${entry.key} resolved another product.`);
  assert(persistence.specification.layoutId === layoutId, "CANONICAL_LAYOUT_ID_MISMATCH", `${entry.key} resolved another layout.`);

  return deepFreeze({
    key: entry.key,
    matrixEntry: entry,
    project: persistence.project,
    acceptedSnapshot: persistence.snapshot,
    specification: persistence.specification
  });
}

export function createPhotorealMatrixRenderPackage(productId, layoutId, options = {}) {
  const sourceCommit = normalizeSourceCommit(options.sourceCommit);
  const fixture = createCanonicalMatrixFixture(productId, layoutId, options);
  const descriptors = [...createGuidedSceneDescriptors(fixture.specification)]
    .sort((left, right) => left.componentId.localeCompare(right.componentId));
  const renderPlans = descriptors.map((descriptor) => createGuidedAcceptedComponentRenderPlan(descriptor));
  const productBounds = unionBounds(renderPlans.map((plan) => convertGuidedBoundsToBlender(plan.worldBounds)));
  const presentation = createPresentation(fixture, descriptors, renderPlans, productBounds);
  const output = createOutputContract(productId, layoutId);
  const packageWithoutKey = {
    kind: PHOTOREAL_MATRIX_KIND,
    schemaVersion: PHOTOREAL_MATRIX_SCHEMA_VERSION,
    pipelineVersion: PHOTOREAL_MATRIX_PIPELINE_VERSION,
    authority: {
      matrixAuthority: "guided-configurator-data.js#PRODUCT_CHOICES×SHARED_ROOM_LAYOUTS",
      compatibilityAuthority: "guided-product-adapter.js#GUIDED_PRODUCT_LAYOUT_COMPATIBILITY",
      geometryAuthority: "guided-render-contract.js#createGuidedSceneDescriptors",
      primitiveAuthority: "guided-render-primitives.js#createGuidedAcceptedComponentRenderPlan",
      presentationBaseline: "PHOTOREAL-PRESENTATION-BASELINE.md",
      materialColorReferenceStatus: "UNVERIFIED",
      customerMaterialApproved: false,
      customerBeautyRenderApproved: false
    },
    identity: {
      key: fixture.key,
      productId,
      productLabel: fixture.matrixEntry.productLabel,
      categoryId: fixture.matrixEntry.categoryId,
      styleId: fixture.matrixEntry.styleId,
      layoutId,
      layoutLabel: fixture.matrixEntry.layoutLabel,
      compatibilityStatus: fixture.matrixEntry.compatibilityStatus,
      sourceCommit,
      engineVersion: fixture.specification.engineVersion,
      geometryFingerprint: fixture.specification.geometryFingerprint,
      selectionFingerprint: fixture.specification.selectionFingerprint,
      specificationFingerprint: fixture.specification.specificationFingerprint
    },
    canonicalFixture: {
      projectId: fixture.project.projectId,
      measurements: clone(fixture.project.measurements),
      selection: {
        finish: fixture.project.finish,
        accentFinish: fixture.project.accentFinish,
        doorStyle: fixture.project.doorStyle,
        hardware: fixture.project.hardware,
        lighting: fixture.project.lighting,
        baseStyle: fixture.project.baseStyle,
        topTreatment: fixture.project.topTreatment
      },
      acceptedSnapshot: clone(fixture.acceptedSnapshot)
    },
    geometry: {
      units: "inches",
      targetUnits: "meters",
      coordinateSystem: {
        source: "JQ right-handed X width, Y height, Z front-to-back",
        blender: "right-handed X width, Y camera-depth, Z height",
        conversion: "x=x*0.0254, y=-z*0.0254, z=y*0.0254"
      },
      productBounds,
      descriptors: clone(descriptors),
      renderPlans: clone(renderPlans)
    },
    topology: compactTopology(fixture.specification.room),
    materials: clone(PHASE7_MATERIAL_RECIPES),
    presentation,
    capture: createCapture(),
    output
  };
  const renderPackage = {
    ...packageWithoutKey,
    packageKey: `jq-photoreal-preview-matrix-v1-${hashCanonical(packageWithoutKey)}`
  };
  const validation = validatePhotorealMatrixRenderPackage(renderPackage, { regenerate: false });
  assert(validation.valid, "GENERATED_MATRIX_PACKAGE_INVALID", `Generated package ${fixture.key} failed validation.`, validation.errors);
  return deepFreeze(renderPackage);
}

export function validatePhotorealMatrixRenderPackage(renderPackage, options = {}) {
  try {
    validatePackageOrThrow(renderPackage, options);
    return Object.freeze({
      valid: true,
      key: renderPackage.identity.key,
      packageKey: renderPackage.packageKey,
      errors: Object.freeze([])
    });
  } catch (error) {
    return Object.freeze({
      valid: false,
      key: renderPackage?.identity?.key || null,
      packageKey: renderPackage?.packageKey || null,
      errors: Object.freeze([normalizeError(error)])
    });
  }
}

export function createPhotorealMatrixProvenanceManifest(options = {}) {
  const matrix = discoverPhotorealMatrix();
  const records = Array.isArray(options.records) ? options.records.map(clone) : [];
  const failures = Array.isArray(options.failures) ? options.failures.map(clone) : [];
  const recordsByKey = new Map();
  for (const record of records) {
    assert(matrix.valid.some((entry) => entry.key === record?.key), "INVALID_PROVENANCE_KEY", `Provenance record ${record?.key || "(missing)"} is not a valid matrix pair.`);
    assert(!recordsByKey.has(record.key), "DUPLICATE_PROVENANCE_KEY", `Duplicate provenance record ${record.key}.`);
    recordsByKey.set(record.key, record);
  }
  const failuresByKey = new Map();
  for (const failure of failures) {
    assert(matrix.valid.some((entry) => entry.key === failure?.key), "INVALID_FAILURE_KEY", `Render failure ${failure?.key || "(missing)"} is not a valid matrix pair.`);
    assert(!recordsByKey.has(failure.key), "PUBLISHED_FAILURE_CONFLICT", `${failure.key} cannot be both published and failed.`);
    assert(!failuresByKey.has(failure.key), "DUPLICATE_FAILURE_KEY", `Duplicate render failure ${failure.key}.`);
    failuresByKey.set(failure.key, failure);
  }
  const entries = matrix.combinations.map((entry) => ({
    ...clone(entry),
    renderStatus: entry.valid ? (recordsByKey.has(entry.key) ? "published" : "pending") : "unavailable",
    provenance: recordsByKey.get(entry.key) || null,
    lastFailure: failuresByKey.get(entry.key) || null
  }));
  const manifest = {
    kind: PHOTOREAL_MATRIX_MANIFEST_KIND,
    schemaVersion: PHOTOREAL_MATRIX_MANIFEST_SCHEMA_VERSION,
    pipelineVersion: PHOTOREAL_MATRIX_PIPELINE_VERSION,
    generatedAt: options.generatedAt || null,
    sourceCommit: options.sourceCommit ? normalizeSourceCommit(options.sourceCommit) : null,
    authoritativeSources: [
      "guided-configurator-data.js#PRODUCT_CHOICES",
      "guided-configurator-data.js#SHARED_ROOM_LAYOUTS",
      "guided-product-adapter.js#GUIDED_PRODUCT_LAYOUT_COMPATIBILITY",
      "config/product-layout-compatibility.json"
    ],
    counts: {
      products: matrix.products.length,
      layouts: matrix.layouts.length,
      total: matrix.totalCount,
      valid: matrix.validCount,
      unavailable: matrix.invalidCount,
      published: records.length,
      pending: matrix.validCount - records.length,
      failed: failures.length
    },
    entries,
    failures
  };
  return deepFreeze({
    ...manifest,
    manifestSha256: hashCanonical(manifest)
  });
}

export function matrixKey(productId, layoutId) {
  assert(SAFE_ID_RE.test(String(productId || "")), "INVALID_PRODUCT_ID", `Invalid product ID ${productId}.`);
  assert(SAFE_ID_RE.test(String(layoutId || "")), "INVALID_LAYOUT_ID", `Invalid layout ID ${layoutId}.`);
  return `${productId}:${layoutId}`;
}

export function publishedPathFor(productId, layoutId) {
  matrixKey(productId, layoutId);
  return `${PHOTOREAL_MATRIX_PUBLIC_ROOT}/${productId}/${layoutId}/${OUTPUT_FILENAMES.webp}`;
}

export function masterPathFor(productId, layoutId) {
  matrixKey(productId, layoutId);
  return `${PHOTOREAL_MATRIX_MASTER_ROOT}/${productId}/${layoutId}/${OUTPUT_FILENAMES.master}`;
}

export function artifactPathsFor(productId, layoutId) {
  matrixKey(productId, layoutId);
  const root = `${PHOTOREAL_MATRIX_MASTER_ROOT}/${productId}/${layoutId}`;
  return Object.freeze({
    root,
    master: `${root}/${OUTPUT_FILENAMES.master}`,
    webp: `${root}/${OUTPUT_FILENAMES.webp}`,
    package: `${root}/${OUTPUT_FILENAMES.package}`,
    result: `${root}/${OUTPUT_FILENAMES.result}`,
    blend: `${root}/${OUTPUT_FILENAMES.blend}`,
    published: publishedPathFor(productId, layoutId)
  });
}

export function deterministicJson(value) {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

export function canonicalize(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    assert(Number.isFinite(value), "NON_FINITE_JSON_NUMBER", "Canonical JSON cannot contain NaN or infinity.");
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  assert(value && typeof value === "object", "UNSUPPORTED_JSON_VALUE", "Canonical JSON contains an unsupported value.");
  return Object.fromEntries(Object.keys(value).sort().map((key) => {
    assert(value[key] !== undefined, "UNDEFINED_JSON_VALUE", `Canonical JSON cannot contain undefined at ${key}.`);
    return [key, canonicalize(value[key])];
  }));
}

export function hashCanonical(value) {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

function createOutputContract(productId, layoutId) {
  const paths = artifactPathsFor(productId, layoutId);
  return {
    publicWebp: {
      path: paths.published,
      mimeType: "image/webp",
      width: PHOTOREAL_MATRIX_WIDTH,
      height: PHOTOREAL_MATRIX_HEIGHT,
      colorMode: "RGB",
      colorDepth: 8,
      quality: PHOTOREAL_MATRIX_WEBP_QUALITY,
      maxBytes: 64 * 1024 * 1024
    },
    masterPng: {
      path: paths.master,
      mimeType: "image/png",
      width: PHOTOREAL_MATRIX_WIDTH,
      height: PHOTOREAL_MATRIX_HEIGHT,
      colorMode: "RGB",
      colorDepth: PHOTOREAL_MATRIX_MASTER_COLOR_DEPTH,
      compression: 15,
      maxBytes: 256 * 1024 * 1024
    },
    artifactWebpPath: paths.webp,
    packagePath: paths.package,
    resultPath: paths.result,
    blendPath: paths.blend
  };
}

function createCapture() {
  return {
    captureVersion: PHOTOREAL_MATRIX_CAPTURE_VERSION,
    engine: "CYCLES",
    blenderEngine: "CYCLES",
    width: PHOTOREAL_MATRIX_WIDTH,
    height: PHOTOREAL_MATRIX_HEIGHT,
    resolutionPercentage: 100,
    pixelAspectX: 1,
    pixelAspectY: 1,
    samples: PHOTOREAL_MATRIX_SAMPLES,
    adaptiveSampling: true,
    adaptiveThreshold: 0.01,
    adaptiveMinSamples: 32,
    samplingSeed: 170219,
    animatedSeed: false,
    useLightTree: true,
    useGuiding: false,
    maxBounces: 8,
    diffuseBounces: 4,
    glossyBounces: 4,
    transmissionBounces: 6,
    transparentBounces: 4,
    volumeBounces: 0,
    reflectiveCaustics: false,
    refractiveCaustics: false,
    directClamp: 0,
    indirectClamp: 5,
    filterWidth: 1.5,
    denoising: {
      enabled: true,
      denoiser: "OPENIMAGEDENOISE",
      inputPasses: "RGB_ALBEDO_NORMAL",
      prefilter: "ACCURATE",
      quality: "HIGH",
      useGpu: false
    },
    colorManagement: {
      displayDevice: "sRGB",
      viewTransform: "AgX",
      look: "AgX - Medium High Contrast",
      exposure: 0,
      gamma: 1
    }
  };
}

function createPresentation(fixture, descriptors, renderPlans, productBounds) {
  const camera = createDynamicCamera(fixture.specification.room, productBounds);
  const puckLights = [];
  for (const [index, plan] of renderPlans.entries()) {
    const descriptor = descriptors[index];
    for (const submesh of plan.submeshes) {
      if (submesh.materialSlot !== "led" || submesh.geometry !== "cylinder") continue;
      const sourceCenter = centerOfBounds(submesh.worldBounds);
      const center = convertGuidedPointToBlender(sourceCenter);
      puckLights.push({
        lightId: `matrix-puck-${String(puckLights.length + 1).padStart(3, "0")}`,
        role: "warm-puck-pool",
        blenderType: "SPOT",
        componentId: descriptor.componentId,
        submeshId: submesh.submeshId,
        position: { x: center.x, y: center.y, z: center.z - 0.006 },
        target: { x: center.x, y: center.y, z: Math.max(productBounds.min.z + 0.2, center.z - 0.95) },
        color: [1, 0.896269353374, 0.737910408773],
        energyW: 18,
        spotSizeRadians: 1.2217304764,
        spotBlend: 0.65,
        shadowSoftSizeM: 0.025
      });
    }
  }
  const width = productBounds.max.x - productBounds.min.x;
  const height = productBounds.max.z - productBounds.min.z;
  const center = centerOfBounds(productBounds);
  return {
    presentationVersion: PHOTOREAL_MATRIX_PRESENTATION_VERSION,
    camera,
    lights: [
      {
        lightId: "matrix-key-daylight-v1",
        role: "soft-daylight-key",
        blenderType: "AREA",
        position: { x: center.x - width * 0.58, y: center.y + Math.max(2.4, width * 0.6), z: center.z + height * 0.48 },
        target: { x: center.x - width * 0.08, y: center.y, z: center.z },
        color: [1, 0.93, 0.84],
        energyW: 420,
        sizeM: 2.2,
        sizeYM: 1.6
      },
      {
        lightId: "matrix-fill-daylight-v1",
        role: "cool-neutral-fill",
        blenderType: "AREA",
        position: { x: center.x + width * 0.56, y: center.y + Math.max(2.1, width * 0.5), z: center.z + height * 0.28 },
        target: { x: center.x + width * 0.08, y: center.y, z: center.z - height * 0.08 },
        color: [0.84, 0.91, 1],
        energyW: 110,
        sizeM: 2.5,
        sizeYM: 1.8
      },
      ...puckLights
    ],
    dynamicPuckLightCount: puckLights.length,
    roomMaterials: {
      wall: {
        materialId: "warm-off-white-wall-v1",
        baseColor: [0.78, 0.72, 0.64, 1],
        roughness: 0.78,
        noiseScale: 70,
        bumpStrength: 0.08,
        bumpDistanceM: 0.0001
      },
      floor: {
        materialId: "warm-natural-floor-v1",
        baseColor: [0.28, 0.22, 0.16, 1],
        roughness: 0.55,
        noiseScale: 3.5,
        bumpStrength: 0.12,
        bumpDistanceM: 0.0004
      },
      opening: {
        materialId: "architectural-opening-shadow-v1",
        baseColor: [0.035, 0.032, 0.03, 1],
        roughness: 0.82
      },
      glass: {
        materialId: "architectural-window-glass-v1",
        baseColor: [0.31, 0.46, 0.55, 1],
        roughness: 0.12,
        transmissionWeight: 0.2,
        coatWeight: 0.28
      }
    },
    world: {
      environmentAssetPath: "assets/environments/jq-warm-interior.hdr",
      environmentSha256: PHOTOREAL_MATRIX_WARM_HDR_SHA256,
      projection: "EQUIRECTANGULAR",
      interpolation: "Linear",
      colorSpace: "Linear Rec.709",
      strength: 0.32,
      rotationEuler: [0, 0, 0.35]
    },
    roomContext: {
      layoutId: fixture.specification.layoutId,
      layoutKind: fixture.specification.room.layoutKind,
      cameraIntent: fixture.specification.room.cameraIntent,
      featureIds: Object.values(fixture.specification.room.features || {}).map((feature) => feature.id),
      topologyFeatureCount: Object.keys(fixture.specification.room.features || {}).length
    }
  };
}

function createDynamicCamera(room, bounds) {
  const framingBounds = createPresentationFramingBounds(room, bounds);
  const width = framingBounds.max.x - framingBounds.min.x;
  const height = framingBounds.max.z - framingBounds.min.z;
  const depth = framingBounds.max.y - framingBounds.min.y;
  const center = centerOfBounds(framingBounds);
  const lensMm = 50;
  const sensorWidthMm = 36;
  const aspect = PHOTOREAL_MATRIX_WIDTH / PHOTOREAL_MATRIX_HEIGHT;
  const horizontalFov = 2 * Math.atan(sensorWidthMm / (2 * lensMm));
  const verticalFov = 2 * Math.atan(Math.tan(horizontalFov / 2) / aspect);
  const framingDistance = Math.max(
    width * 0.5 / Math.tan(horizontalFov / 2),
    height * 0.5 / Math.tan(verticalFov / 2)
  ) * 1.18 + depth;
  const isCorner = room.layoutId === "corner-wall" || room.cameraIntent === "corner-oblique";
  /*
   * Keep the restrained three-quarter point of view established by the Phase 7
   * beauty camera.  The earlier matrix prototype used only a ten-percent
   * lateral offset, which read as a flat product elevation on wider units.
   * Capping the offset keeps compact products from becoming over-oblique while
   * still revealing real cabinet depth across the library.
   */
  const lateralOffset = isCorner
    ? -Math.min(width * 0.36, 1.25)
    : -Math.min(width * 0.28, 1.05);
  const targetOffset = isCorner
    ? Math.min(width * 0.08, 0.24)
    : Math.min(width * 0.025, 0.08);
  return {
    cameraId: "matrix-beauty-camera-v1",
    type: "PERSP",
    position: {
      x: center.x + lateralOffset,
      y: center.y + framingDistance * (isCorner ? 0.94 : 1),
      z: center.z + height * 0.075
    },
    target: {
      x: center.x + targetOffset,
      y: center.y,
      z: center.z
    },
    up: [0, 0, 1],
    lensMm,
    sensorWidthMm,
    sensorFit: "HORIZONTAL",
    clipStartM: 0.05,
    clipEndM: Math.max(30, framingDistance * 4),
    depthOfField: { enabled: false },
    framingMargin: 0.18,
    framingBounds
  };
}

function createPresentationFramingBounds(room, productBounds) {
  const candidates = [productBounds];
  for (const feature of Object.values(room.features || {})) {
    for (const key of ["bounds", "mantelBounds", "trimBounds"]) {
      const sourceBounds = feature?.[key];
      if (!sourceBounds?.min || !sourceBounds?.max) continue;
      candidates.push(convertGuidedBoundsToBlender(sourceBounds));
    }
  }
  return unionBounds(candidates);
}

function compactTopology(room) {
  return {
    accepted: room.accepted,
    schemaVersion: room.schemaVersion,
    units: room.units,
    layoutId: room.layoutId,
    layoutKind: room.layoutKind,
    wallWidth: room.wallWidth,
    ceilingHeight: room.ceilingHeight,
    desiredDepth: room.desiredDepth,
    floorPlaneY: room.floorPlaneY,
    rearWallPlaneZ: room.rearWallPlaneZ,
    planes: clone(room.planes),
    features: clone(room.features),
    exclusionVolumes: clone(room.exclusionVolumes),
    installationZones: clone(room.installationZones),
    cameraIntent: room.cameraIntent
  };
}

function validatePackageOrThrow(renderPackage, options) {
  assert(renderPackage?.kind === PHOTOREAL_MATRIX_KIND, "INVALID_PACKAGE_KIND", "Unknown photoreal matrix package kind.");
  assert(renderPackage.schemaVersion === PHOTOREAL_MATRIX_SCHEMA_VERSION, "INVALID_PACKAGE_SCHEMA", "Unknown photoreal matrix package schema.");
  assert(renderPackage.pipelineVersion === PHOTOREAL_MATRIX_PIPELINE_VERSION, "INVALID_PIPELINE_VERSION", "Photoreal matrix pipeline version drifted.");
  assert(renderPackage.authority?.customerMaterialApproved === false, "CUSTOMER_MATERIAL_APPROVAL_FORBIDDEN", "Customer material approval must remain false.");
  assert(renderPackage.authority?.customerBeautyRenderApproved === false, "CUSTOMER_BEAUTY_APPROVAL_FORBIDDEN", "Customer beauty approval must remain false.");
  assert(renderPackage.materials?.authority?.customerMaterialApproved === false, "CUSTOMER_MATERIAL_APPROVAL_FORBIDDEN", "Material authority approval must remain false.");
  assert(renderPackage.materials?.authority?.customerBeautyRenderApproved === false, "CUSTOMER_BEAUTY_APPROVAL_FORBIDDEN", "Material beauty approval must remain false.");
  assert(renderPackage.materials?.authority?.materialColorReferenceStatus === "UNVERIFIED", "MATERIAL_STATUS_DRIFT", "Natural Oak must remain an unverified visualization profile.");
  assert(renderPackage.identity?.key === matrixKey(renderPackage.identity?.productId, renderPackage.identity?.layoutId), "PACKAGE_IDENTITY_MISMATCH", "Package matrix key is stale.");
  assert(renderPackage.identity?.sourceCommit === "WORKTREE" || SHA40_RE.test(renderPackage.identity?.sourceCommit || ""), "INVALID_SOURCE_COMMIT", "Package source commit is not resolvable.");
  const matrix = discoverPhotorealMatrix();
  const entry = matrix.valid.find((candidate) => candidate.key === renderPackage.identity.key);
  assert(entry, "UNAVAILABLE_PACKAGE_PAIR", `${renderPackage.identity.key} is not a valid matrix pair.`);
  assert(entry.compatibilityStatus === renderPackage.identity.compatibilityStatus, "COMPATIBILITY_STATUS_DRIFT", "Package compatibility status differs from the authoritative matrix.");

  const descriptors = renderPackage.geometry?.descriptors;
  const plans = renderPackage.geometry?.renderPlans;
  assert(Array.isArray(descriptors) && descriptors.length > 0, "MISSING_DESCRIPTORS", "Package contains no accepted scene descriptors.");
  assert(Array.isArray(plans) && plans.length === descriptors.length, "RENDER_PLAN_PARITY_FAILED", "Every accepted descriptor requires one render plan.");
  assert(new Set(descriptors.map((descriptor) => descriptor.componentId)).size === descriptors.length, "DUPLICATE_DESCRIPTOR_ID", "Package descriptors contain duplicate IDs.");
  descriptors.forEach((descriptor, index) => {
    const plan = plans[index];
    assert(plan.componentId === descriptor.componentId, "RENDER_PLAN_ORDER_MISMATCH", `Render plan ${index} does not match its descriptor.`);
    assert(Array.isArray(plan.submeshes) && plan.submeshes.length > 0, "EMPTY_RENDER_PLAN", `${plan.componentId} has no renderer-neutral primitive.`);
    finiteBounds(plan.worldBounds, `${plan.componentId}.worldBounds`);
    const expectedWorldBounds = transformGuidedBoundsToWorld(descriptor.bounds, descriptor.transform);
    finiteBounds(expectedWorldBounds, `${descriptor.componentId}.descriptorWorldBounds`);
    assert(
      sameBounds(expectedWorldBounds, plan.worldBounds),
      "DESCRIPTOR_PLAN_BOUNDS_MISMATCH",
      `${descriptor.componentId} render-plan bounds differ from its transformed authoritative descriptor.`
    );
    plan.submeshes.forEach((submesh) => {
      assert(["box", "crown_profile_extrusion", "cylinder"].includes(submesh.geometry), "UNSUPPORTED_PRIMITIVE", `${plan.componentId}:${submesh.submeshId} uses unsupported geometry.`);
      finiteBounds(submesh.bounds, `${plan.componentId}:${submesh.submeshId}.bounds`);
      finiteBounds(submesh.worldBounds, `${plan.componentId}:${submesh.submeshId}.worldBounds`);
    });
  });
  finiteBounds(renderPackage.geometry.productBounds, "geometry.productBounds");
  assert(renderPackage.topology?.accepted === true && renderPackage.topology.layoutId === renderPackage.identity.layoutId, "TOPOLOGY_IDENTITY_MISMATCH", "Package topology does not match its layout.");
  validatePresentation(renderPackage.presentation, renderPackage.geometry.productBounds, renderPackage.topology);
  validateCapture(renderPackage.capture);
  validateOutput(renderPackage.output, entry);

  const withoutKey = Object.fromEntries(Object.entries(renderPackage).filter(([key]) => key !== "packageKey"));
  const expectedKey = `jq-photoreal-preview-matrix-v1-${hashCanonical(withoutKey)}`;
  assert(PACKAGE_KEY_RE.test(renderPackage.packageKey || "") && renderPackage.packageKey === expectedKey, "STALE_PACKAGE_KEY", "Photoreal matrix package key is stale.");

  if (options.regenerate !== false) {
    const regenerated = createPhotorealMatrixRenderPackage(
      renderPackage.identity.productId,
      renderPackage.identity.layoutId,
      { sourceCommit: renderPackage.identity.sourceCommit }
    );
    assert(deterministicJson(regenerated) === deterministicJson(renderPackage), "AUTHORITATIVE_REGENERATION_DRIFT", "Package differs from fresh authoritative matrix regeneration.");
  }
}

function validatePresentation(presentation, productBounds, room) {
  assert(presentation?.presentationVersion === PHOTOREAL_MATRIX_PRESENTATION_VERSION, "PRESENTATION_VERSION_DRIFT", "Presentation version drifted.");
  const camera = presentation.camera;
  point(camera?.position, "presentation.camera.position");
  point(camera?.target, "presentation.camera.target");
  assert(camera?.type === "PERSP" && camera?.depthOfField?.enabled === false, "INVALID_CAMERA", "Matrix camera must be a perspective beauty camera.");
  assert(Number(camera.lensMm) > 0 && Number(camera.clipEndM) > Number(camera.clipStartM), "INVALID_CAMERA", "Matrix camera optics are invalid.");
  assert(presentation.roomContext?.topologyFeatureCount === presentation.roomContext?.featureIds?.length, "ROOM_FEATURE_COUNT_MISMATCH", "Room feature manifest is inconsistent.");
  assert(Array.isArray(presentation.lights) && presentation.lights.length >= 2, "MISSING_PRESENTATION_LIGHTS", "Presentation requires key and fill lights.");
  assert(presentation.lights[0].role === "soft-daylight-key" && presentation.lights[1].role === "cool-neutral-fill", "PRESENTATION_LIGHT_DRIFT", "Phase 7 key/fill roles drifted.");
  const pucks = presentation.lights.filter((light) => light.role === "warm-puck-pool");
  assert(pucks.length === presentation.dynamicPuckLightCount, "PUCK_LIGHT_COUNT_MISMATCH", "Dynamic puck light count is stale.");
  assert(pucks.every((light) => light.componentId && light.submeshId === "emissive-lens"), "INVALID_PUCK_ANCHOR", "Dynamic puck lights must anchor to accepted emissive lenses.");
  finiteBounds(camera.framingBounds, "presentation.camera.framingBounds");
  const expectedFramingBounds = createPresentationFramingBounds(room, productBounds);
  assert(
    sameBounds(camera.framingBounds, expectedFramingBounds),
    "CAMERA_BOUNDS_DRIFT",
    "Dynamic camera does not frame the exact union of product and authoritative architectural features."
  );
}

function validateCapture(capture) {
  assert(capture?.captureVersion === PHOTOREAL_MATRIX_CAPTURE_VERSION, "CAPTURE_VERSION_DRIFT", "Matrix capture version drifted.");
  assert(capture.engine === "CYCLES" && capture.blenderEngine === "CYCLES", "RENDER_ENGINE_DRIFT", "Photoreal matrix must render in Cycles.");
  assert(capture.width === PHOTOREAL_MATRIX_WIDTH && capture.height === PHOTOREAL_MATRIX_HEIGHT, "RENDER_DIMENSIONS_DRIFT", "Photoreal matrix must render at 1920×1280.");
  assert(capture.samples === PHOTOREAL_MATRIX_SAMPLES, "RENDER_SAMPLES_DRIFT", "Photoreal matrix must use 256 samples.");
  assert(capture.denoising?.enabled === true && capture.denoising?.denoiser === "OPENIMAGEDENOISE", "DENOISER_DRIFT", "Phase 7 denoising must remain enabled.");
}

function validateOutput(output, entry) {
  assert(output?.publicWebp?.path === entry.publishedPath, "PUBLIC_OUTPUT_PATH_MISMATCH", "Published WebP path does not match its matrix key.");
  assert(output?.masterPng?.path === entry.masterPath, "MASTER_OUTPUT_PATH_MISMATCH", "Master PNG path does not match its matrix key.");
  assert(output.publicWebp.width === PHOTOREAL_MATRIX_WIDTH && output.publicWebp.height === PHOTOREAL_MATRIX_HEIGHT, "WEBP_DIMENSIONS_DRIFT", "Published WebP dimensions drifted.");
  assert(output.publicWebp.quality === PHOTOREAL_MATRIX_WEBP_QUALITY, "WEBP_QUALITY_DRIFT", "Published WebP quality must be 92.");
  assert(output.masterPng.colorDepth === PHOTOREAL_MATRIX_MASTER_COLOR_DEPTH, "MASTER_COLOR_DEPTH_DRIFT", "Master PNG must be 16-bit RGB.");
}

function normalizeSourceCommit(value) {
  if (value === undefined || value === null || value === "") return "WORKTREE";
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "worktree") return "WORKTREE";
  assert(SHA40_RE.test(normalized), "INVALID_SOURCE_COMMIT", "sourceCommit must be a full 40-character Git SHA.");
  return normalized;
}

function unionBounds(boundsList) {
  assert(Array.isArray(boundsList) && boundsList.length > 0, "EMPTY_BOUNDS_SET", "Cannot union an empty bounds set.");
  const combined = {
    min: { x: Infinity, y: Infinity, z: Infinity },
    max: { x: -Infinity, y: -Infinity, z: -Infinity }
  };
  for (const item of boundsList) {
    finiteBounds(item, "bounds");
    for (const axis of "xyz") {
      combined.min[axis] = Math.min(combined.min[axis], item.min[axis]);
      combined.max[axis] = Math.max(combined.max[axis], item.max[axis]);
    }
  }
  return combined;
}

function centerOfBounds(bounds) {
  finiteBounds(bounds, "bounds");
  return Object.fromEntries([..."xyz"].map((axis) => [axis, (bounds.min[axis] + bounds.max[axis]) / 2]));
}

function finiteBounds(value, label) {
  assert(value?.min && value?.max && [..."xyz"].every((axis) => (
    typeof value.min[axis] === "number"
    && Number.isFinite(value.min[axis])
    && typeof value.max[axis] === "number"
    && Number.isFinite(value.max[axis])
    && value.max[axis] > value.min[axis]
  )), "INVALID_BOUNDS", `${label} must contain finite ordered XYZ bounds.`);
  return value;
}

function sameBounds(left, right, tolerance = 1e-9) {
  return finiteBounds(left, "leftBounds")
    && finiteBounds(right, "rightBounds")
    && [..."xyz"].every((axis) => (
      Math.abs(left.min[axis] - right.min[axis]) <= tolerance
      && Math.abs(left.max[axis] - right.max[axis]) <= tolerance
    ));
}

function point(value, label) {
  assert(value && [..."xyz"].every((axis) => typeof value[axis] === "number" && Number.isFinite(value[axis])), "INVALID_POINT", `${label} must be a finite XYZ point.`);
  return value;
}

function clone(value) {
  return structuredClone(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const entry of Object.values(value)) deepFreeze(entry);
  return value;
}

function assert(condition, code, message, details = []) {
  if (!condition) throw new PhotorealMatrixContractError(code, message, details);
}

function normalizeError(error) {
  return Object.freeze({
    code: error?.code || "PHOTOREAL_MATRIX_CONTRACT_ERROR",
    message: error instanceof Error ? error.message : String(error),
    details: Array.isArray(error?.details) ? clone(error.details) : []
  });
}
