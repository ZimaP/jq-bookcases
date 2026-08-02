import {
  GUIDED_PROJECT_ENGINE_VERSION,
  prepareGuidedProjectPersistence,
  restoreGuidedAcceptedSnapshot
} from "./guided-project-engine.js?v=luxury-configurator-engine-v1";
import {
  GUIDED_RENDER_CONTRACT_VERSION,
  auditGuidedAcceptedSpecification,
  createGuidedSceneDescriptors,
  transformGuidedBoundsToWorld,
  validateGuidedRenderedManifest
} from "./guided-render-contract.js?v=luxury-configurator-engine-v1";
import {
  GUIDED_RENDER_PRIMITIVE_CONTRACT_VERSION,
  createGuidedAcceptedComponentRenderPlan
} from "./guided-render-primitives.js?v=blender-render-foundation-v1";
import {
  GUIDED_MATERIAL_CONTRACT_VERSION,
  GUIDED_MATERIAL_MANIFEST
} from "./guided-materials.js?v=luxury-configurator-engine-v1";

export const GUIDED_BLENDER_RENDER_JOB_SCHEMA_VERSION = 1;
export const GUIDED_BLENDER_RENDER_PACKAGE_SCHEMA_VERSION = 1;
export const GUIDED_BLENDER_RENDER_RESULT_SCHEMA_VERSION = 1;
export const GUIDED_BLENDER_RENDER_PIPELINE_VERSION = "2026.08-tv-clear-wall-foundation-v1";
export const GUIDED_BLENDER_MATERIAL_LIBRARY_VERSION = "jq-materials-v1";
export const GUIDED_BLENDER_SCENE_VERSION = "clear-wall-v1";
export const GUIDED_BLENDER_CAMERA_VERSION = "hero-front-v1";
export const GUIDED_BLENDER_RENDER_JOB_MAX_BYTES = 16_384;
export const GUIDED_BLENDER_ASSET_MANIFEST_SHA256 = "156874a63c03ebbaf89f2409c82312777588461e1051bfeee5311437bf38ca24";
export const GUIDED_BLENDER_MATERIAL_SOURCE_SHA256 = "299b321424bf7665f413c2740c5238bcd7f7e1b0d412ab5c1db16339e4d772cd";

const INCHES_TO_METERS = 0.0254;
const GUIDED_MATERIALS_BY_ID = new Map([
  ...Object.values(GUIDED_MATERIAL_MANIFEST.woods),
  ...Object.values(GUIDED_MATERIAL_MANIFEST.paints),
  ...Object.values(GUIDED_MATERIAL_MANIFEST.accentPaints)
].map((material) => [material.id, material]));
const SUPPORTED_SELECTIONS = Object.freeze({
  productId: new Set(["tv-unit"]),
  layoutId: new Set(["clear-wall"]),
  finish: new Set([
    ...Object.keys(GUIDED_MATERIAL_MANIFEST.woods),
    ...Object.keys(GUIDED_MATERIAL_MANIFEST.paints)
  ]),
  accentFinish: new Set(["no-accent", ...Object.keys(GUIDED_MATERIAL_MANIFEST.accentPaints)]),
  doorStyle: new Set(["flat-panel", "shaker", "glass"]),
  hardware: new Set(["knob", "brass-pull", "black-pull", "none"]),
  lighting: new Set(["no-lighting", "warm-led", "integrated-led"]),
  baseStyle: new Set(["flush-base", "recessed-toe-kick", "furniture-base"]),
  topTreatment: new Set(["simple-finished-top", "small-crown", "traditional-crown"]),
  installation: new Set(["no_installation", "professional"]),
  delivery: new Set(["pickup", "standard", "priority"])
});
const SUPPORTED_RENDER_SLICE = Object.freeze({
  productId: "tv-unit",
  layoutId: "clear-wall",
  installationMode: "fitted"
});
const PROJECT_FIELDS = Object.freeze([
  "productId",
  "layoutId",
  "finish",
  "accentFinish",
  "doorStyle",
  "hardware",
  "lighting",
  "lightingWarmth",
  "shelves",
  "baseStyle",
  "topTreatment",
  "installation",
  "delivery"
]);
const REQUIRED_PROJECT_FIELDS = new Set([
  "productId",
  "layoutId",
  "finish",
  "accentFinish",
  "doorStyle",
  "hardware",
  "lighting",
  "baseStyle",
  "topTreatment"
]);
const TV_CLEAR_WALL_MEASUREMENTS = Object.freeze({
  wallWidth: Object.freeze({ kind: "number", min: 24, max: 144 }),
  ceilingHeight: Object.freeze({ kind: "number", min: 72, max: 120 }),
  desiredDepth: Object.freeze({ kind: "number", min: 10, max: 24 }),
  tvScreenSize: Object.freeze({ kind: "number", min: 24, max: 100 }),
  tvHeight: Object.freeze({ kind: "number", min: 16, max: 60 }),
  tvMounting: Object.freeze({
    kind: "enum",
    values: Object.freeze(["wall-mounted", "recessed", "on-console", "not-sure"])
  }),
  outletLocation: Object.freeze({
    kind: "enum",
    values: Object.freeze(["behind-tv", "near-floor", "side-wall", "unknown"])
  }),
  soundbarRequired: Object.freeze({
    kind: "enum",
    values: Object.freeze(["yes", "no"])
  })
});
const SAFE_COMPONENT_METADATA = Object.freeze([
  "attachment",
  "backPlaneZ",
  "catalogVersion",
  "category",
  "derivation",
  "diagonal",
  "fieldKind",
  "finishIndependent",
  "frontPlaneZ",
  "hardware",
  "hardwareType",
  "latchSide",
  "lightType",
  "mountingCenter",
  "mountingCenters",
  "mountingMode",
  "nominalLength",
  "orientation",
  "outletLocation",
  "placement",
  "profileGeometry",
  "projection",
  "proxyMode",
  "quantityIndex",
  "quantityPerFront",
  "sectionId",
  "variantId",
  "visualDimensions",
  "warmth"
]);
const SNAPSHOT_REGENERATION_KEYS = Object.freeze([
  "topologyFingerprint",
  "fitFingerprint",
  "descriptorFingerprint",
  "materialFingerprint",
  "cameraFingerprint"
]);
const RENDER_IDENTITY_KEYS = Object.freeze([
  "productId",
  "layoutId",
  "installationMode",
  "engineVersion",
  "geometryFingerprint",
  "selectionFingerprint",
  "descriptorFingerprint",
  "materialFingerprint",
  "cameraFingerprint",
  "jobSchemaVersion",
  "packageSchemaVersion",
  "renderContractVersion",
  "primitiveContractVersion",
  "materialContractVersion",
  "pipelineVersion",
  "materialLibraryVersion",
  "sceneVersion",
  "cameraVersion",
  "assetManifestSha256",
  "materialSourceSha256",
  "outputProfile"
]);
const OUTPUT_PROFILES = Object.freeze({
  preview: Object.freeze({
    id: "preview",
    width: 960,
    height: 640,
    samples: 128,
    passes: Object.freeze(["beauty"])
  }),
  final: Object.freeze({
    id: "final",
    width: 1800,
    height: 1200,
    samples: 512,
    passes: Object.freeze(["beauty", "depth", "normal", "object-id"])
  })
});
const OUTPUT_PASS_CONTRACTS = Object.freeze({
  beauty: Object.freeze({
    filename: "beauty.webp",
    mimeType: "image/webp",
    maxBytes: 32 * 1024 * 1024
  }),
  depth: Object.freeze({
    filename: "depth.exr",
    mimeType: "image/x-exr",
    maxBytes: 256 * 1024 * 1024
  }),
  normal: Object.freeze({
    filename: "normal.exr",
    mimeType: "image/x-exr",
    maxBytes: 256 * 1024 * 1024
  }),
  "object-id": Object.freeze({
    filename: "object-id.png",
    mimeType: "image/png",
    maxBytes: 64 * 1024 * 1024
  })
});

/**
 * Build the compact request that may cross the browser/server boundary.
 * It contains no accepted descriptor graph, quote, price, customer notes,
 * uploads, hardware catalog snapshots, or external URLs.
 */
export async function createGuidedBlenderRenderJob(
  project,
  previousAccepted = null,
  options = {}
) {
  const persistence = prepareGuidedProjectPersistence(
    project,
    previousAccepted,
    options.engineOptions
  );
  if (!persistence.accepted || !persistence.persistable) {
    throw blenderContractError(
      "BLENDER_JOB_REQUIRES_ACCEPTED_PROJECT",
      "A Blender render job requires an accepted project that regenerates exactly.",
      persistence.errors
    );
  }
  const specification = persistence.specification;
  assertSupportedRenderSlice(specification);
  const profile = resolveOutputProfile(options.profileId);
  const design = sanitizeAcceptedProject(persistence.project, persistence.snapshot);
  const compactRegeneration = restoreGuidedAcceptedSnapshot(
    design,
    design.acceptedSnapshot,
    options.engineOptions
  );
  if (!compactRegeneration.accepted) {
    throw blenderContractError(
      "BLENDER_JOB_SANITIZATION_LOST_INPUT",
      "The compact Blender allowlist omitted an input required for exact regeneration.",
      compactRegeneration.errors
    );
  }
  const identity = createRenderIdentity(specification, profile, persistence.snapshot);
  const core = {
    kind: "jq-guided-blender-render-job",
    schemaVersion: GUIDED_BLENDER_RENDER_JOB_SCHEMA_VERSION,
    contractVersion: GUIDED_RENDER_CONTRACT_VERSION,
    primitiveContractVersion: GUIDED_RENDER_PRIMITIVE_CONTRACT_VERSION,
    pipelineVersion: GUIDED_BLENDER_RENDER_PIPELINE_VERSION,
    identity,
    design,
    render: createRenderSettings(profile)
  };
  const renderKey = await createRenderKey(identity, core.render);
  const job = { ...core, renderKey };
  assertNoUnsafePayload(job);
  return deepFreeze(job);
}

/**
 * Server-side boundary: regenerate the accepted design with the same JS engine,
 * verify every identity, and only then emit exact primitives for Blender.
 */
export async function regenerateGuidedBlenderRenderPackage(job, options = {}) {
  assertGuidedBlenderJob(job);
  assertNoUnsafePayload(job);
  const expectedRenderSettings = createRenderSettings(
    resolveOutputProfile(job.identity.outputProfile)
  );
  if (stableStringify(job.render) !== stableStringify(expectedRenderSettings)) {
    throw blenderContractError(
      "BLENDER_RENDER_SETTINGS_MISMATCH",
      "The Blender render settings do not match the versioned output profile."
    );
  }
  const expectedRenderKey = await createRenderKey(job.identity, expectedRenderSettings);
  if (job.renderKey !== expectedRenderKey) {
    throw blenderContractError(
      "BLENDER_RENDER_KEY_MISMATCH",
      "The Blender render request identity was modified after it was accepted."
    );
  }

  const specification = restoreGuidedAcceptedSnapshot(
    job.design,
    job.design.acceptedSnapshot,
    options.engineOptions
  );
  if (!specification.accepted) {
    throw blenderContractError(
      "BLENDER_REGENERATION_FAILED",
      "The Blender worker refused a project that no longer regenerates exactly.",
      specification.errors
    );
  }
  assertSupportedRenderSlice(specification);
  assertIdentityMatchesSpecification(
    job.identity,
    specification,
    job.design.acceptedSnapshot
  );
  const audit = auditGuidedAcceptedSpecification(specification);
  if (!audit.valid) {
    throw blenderContractError(
      "BLENDER_RENDER_AUDIT_FAILED",
      "The regenerated descriptor graph failed the accepted render audit.",
      audit.errors
    );
  }

  const componentIndex = createAcceptedComponentIndex(specification);
  const manifestIndex = new Map(
    (specification.product?.renderManifest?.entries || []).map((entry) => [
      String(entry.componentId),
      entry
    ])
  );
  const descriptors = [...createGuidedSceneDescriptors(specification)]
    .sort((left, right) => left.componentId.localeCompare(right.componentId));
  if (manifestIndex.size !== descriptors.length) {
    throw blenderContractError(
      "BLENDER_COMPONENT_PARITY_FAILED",
      "The accepted descriptor graph and render manifest do not contain the same components."
    );
  }
  const primitivePlans = new Map(descriptors.map((descriptor) => [
    descriptor.componentId,
    createGuidedAcceptedComponentRenderPlan(descriptor)
  ]));
  const primitiveAudit = validateGuidedRenderedManifest(
    specification,
    [...primitivePlans.values()].map(createPrimitiveAuditRecord)
  );
  if (!primitiveAudit.valid) {
    throw blenderContractError(
      "BLENDER_PRIMITIVE_AUDIT_FAILED",
      "The renderer-neutral primitive plan failed accepted-manifest validation.",
      primitiveAudit.issues
    );
  }

  const components = descriptors.map((descriptor) => {
    const sourceComponent = componentIndex.get(descriptor.componentId);
    const manifestEntry = manifestIndex.get(descriptor.componentId);
    if (!sourceComponent || !manifestEntry) {
      throw blenderContractError(
        "BLENDER_COMPONENT_PARITY_FAILED",
        `Accepted component ${descriptor.componentId} is missing from a source contract.`
      );
    }
    return createBlenderComponent(
      descriptor,
      sourceComponent,
      manifestEntry,
      specification.materialState,
      primitivePlans.get(descriptor.componentId)
    );
  });
  const constraints = createBlenderConstraints(specification);
  const materials = createMaterialBindings(components);
  const readiness = createRenderReadiness(specification, materials);
  const renderPayload = {
    kind: "jq-guided-blender-render-package",
    schemaVersion: GUIDED_BLENDER_RENDER_PACKAGE_SCHEMA_VERSION,
    contractVersion: GUIDED_RENDER_CONTRACT_VERSION,
    primitiveContractVersion: GUIDED_RENDER_PRIMITIVE_CONTRACT_VERSION,
    pipelineVersion: GUIDED_BLENDER_RENDER_PIPELINE_VERSION,
    identity: clone(job.identity),
    sourceUnits: "inches",
    targetUnits: "meters",
    coordinateSystem: createCoordinateContract(),
    render: expectedRenderSettings,
    scene: createBlenderScene(specification),
    camera: createBlenderCamera(components, expectedRenderSettings),
    room: createBlenderRoom(specification),
    installation: createBlenderInstallation(specification),
    constraints,
    components,
    materials
  };
  const packagePayload = {
    ...renderPayload,
    requestKey: job.renderKey,
    readiness,
    audit: {
      valid: true,
      descriptorSetCount: audit.descriptorSetCount,
      physicalComponentCount: audit.physicalComponentCount,
      renderedComponentCount: components.length,
      constraintCount: constraints.length,
      primitiveRecordCount: primitiveAudit.records.length
    }
  };
  const renderKey = await createPackageRenderKey(packagePayload);
  const packageCore = { ...packagePayload, renderKey };
  assertNoUnsafePayload(packageCore);
  return deepFreeze(packageCore);
}

export async function validateGuidedBlenderRenderPackage(renderPackage) {
  const errors = [];
  if (!hasExactKeys(renderPackage, [
    "kind",
    "schemaVersion",
    "contractVersion",
    "primitiveContractVersion",
    "pipelineVersion",
    "identity",
    "sourceUnits",
    "targetUnits",
    "coordinateSystem",
    "render",
    "scene",
    "camera",
    "room",
    "installation",
    "constraints",
    "components",
    "materials",
    "requestKey",
    "renderKey",
    "readiness",
    "audit"
  ])) {
    errors.push(issue("INVALID_RENDER_PACKAGE_SHAPE", "The Blender package has unknown or missing fields."));
  }
  if (
    renderPackage?.kind !== "jq-guided-blender-render-package"
    || Number(renderPackage?.schemaVersion) !== GUIDED_BLENDER_RENDER_PACKAGE_SCHEMA_VERSION
    || Number(renderPackage?.contractVersion) !== GUIDED_RENDER_CONTRACT_VERSION
    || Number(renderPackage?.primitiveContractVersion) !== GUIDED_RENDER_PRIMITIVE_CONTRACT_VERSION
    || renderPackage?.pipelineVersion !== GUIDED_BLENDER_RENDER_PIPELINE_VERSION
  ) {
    errors.push(issue("INVALID_RENDER_PACKAGE", "A current verified Blender render package is required."));
  }
  if (!hasExactKeys(renderPackage?.identity, RENDER_IDENTITY_KEYS)) {
    errors.push(issue("INVALID_RENDER_PACKAGE_IDENTITY", "The Blender package identity shape is invalid."));
  }
  try {
    const expectedSettings = createRenderSettings(
      resolveOutputProfile(renderPackage?.identity?.outputProfile)
    );
    if (stableStringify(renderPackage?.render) !== stableStringify(expectedSettings)) {
      errors.push(issue("INVALID_RENDER_PACKAGE_SETTINGS", "The Blender package render settings drifted."));
    }
    const expectedKey = await createPackageRenderKey(createPackageRenderPayload(renderPackage));
    if (renderPackage?.renderKey !== expectedKey) {
      errors.push(issue("RENDER_PACKAGE_KEY_MISMATCH", "The Blender package content hash does not match its payload."));
    }
    assertNoUnsafePayload(renderPackage);
  } catch (error) {
    errors.push(issue(error?.code || "INVALID_RENDER_PACKAGE", error?.message || "The Blender package could not be verified."));
  }
  return deepFreeze({
    valid: errors.length === 0,
    schemaVersion: GUIDED_BLENDER_RENDER_PACKAGE_SCHEMA_VERSION,
    errors
  });
}

export async function validateGuidedBlenderRenderResult(renderPackage, result) {
  const packageValidation = await validateGuidedBlenderRenderPackage(renderPackage);
  const errors = [...packageValidation.errors];
  if (result?.kind !== "jq-guided-blender-render-result") {
    errors.push(issue("INVALID_RENDER_RESULT", "The worker result kind is invalid."));
  }
  if (Number(result?.schemaVersion) !== GUIDED_BLENDER_RENDER_RESULT_SCHEMA_VERSION) {
    errors.push(issue("UNSUPPORTED_RENDER_RESULT", "The worker result schema is unsupported."));
  }
  if (result?.renderKey !== renderPackage?.renderKey) {
    errors.push(issue("RENDER_RESULT_KEY_MISMATCH", "The render result does not match this design."));
  }
  if (result?.pipelineVersion !== renderPackage?.pipelineVersion) {
    errors.push(issue("RENDER_RESULT_PIPELINE_MISMATCH", "The render result used a different pipeline."));
  }
  if (result?.status !== "succeeded") {
    errors.push(issue("RENDER_RESULT_NOT_SUCCEEDED", "Only a succeeded Blender result can be displayed."));
  }
  if (!hasExactKeys(result, [
    "kind",
    "schemaVersion",
    "renderKey",
    "pipelineVersion",
    "status",
    "outputs"
  ])) {
    errors.push(issue("INVALID_RENDER_RESULT_SHAPE", "The worker result contains unknown or missing fields."));
  }
  const expectedPasses = new Set(renderPackage?.render?.passes || []);
  const outputs = Array.isArray(result?.outputs) ? result.outputs : [];
  const outputPasses = new Set();
  for (const output of outputs) {
    if (outputPasses.has(output?.pass)) {
      errors.push(issue("DUPLICATE_RENDER_PASS", `The Blender result repeats the ${output?.pass || "unknown"} pass.`));
    }
    outputPasses.add(output?.pass);
  }
  for (const pass of expectedPasses) {
    if (!outputPasses.has(pass)) {
      errors.push(issue("MISSING_RENDER_PASS", `The Blender result is missing the ${pass} pass.`));
    }
  }
  for (const output of outputs) {
    const passContract = OUTPUT_PASS_CONTRACTS[output?.pass];
    const safeObjectKey = typeof output?.objectKey === "string"
      && output.objectKey === `${renderPackage?.renderKey}/${passContract?.filename || "invalid"}`;
    if (
      !hasExactKeys(output, ["pass", "objectKey", "mimeType", "width", "height", "bytes", "sha256"])
      || !expectedPasses.has(output?.pass)
      || !safeObjectKey
      || output?.mimeType !== passContract?.mimeType
      || typeof output?.width !== "number"
      || typeof output?.height !== "number"
      || !Number.isInteger(output.width)
      || !Number.isInteger(output.height)
      || output.width !== Number(renderPackage?.render?.width)
      || output.height !== Number(renderPackage?.render?.height)
      || typeof output?.bytes !== "number"
      || !Number.isSafeInteger(output.bytes)
      || output.bytes <= 0
      || output.bytes > Number(passContract?.maxBytes)
      || !/^[a-f0-9]{64}$/.test(String(output?.sha256 || ""))
    ) {
      errors.push(issue("INVALID_RENDER_OUTPUT", "A Blender output record is incomplete."));
    }
  }
  return deepFreeze({
    valid: errors.length === 0,
    schemaVersion: GUIDED_BLENDER_RENDER_RESULT_SCHEMA_VERSION,
    errors
  });
}

function createPackageRenderPayload(renderPackage) {
  return {
    kind: renderPackage?.kind,
    schemaVersion: renderPackage?.schemaVersion,
    contractVersion: renderPackage?.contractVersion,
    primitiveContractVersion: renderPackage?.primitiveContractVersion,
    pipelineVersion: renderPackage?.pipelineVersion,
    identity: clone(renderPackage?.identity),
    sourceUnits: renderPackage?.sourceUnits,
    targetUnits: renderPackage?.targetUnits,
    coordinateSystem: clone(renderPackage?.coordinateSystem),
    render: clone(renderPackage?.render),
    scene: clone(renderPackage?.scene),
    camera: clone(renderPackage?.camera),
    room: clone(renderPackage?.room),
    installation: clone(renderPackage?.installation),
    constraints: clone(renderPackage?.constraints),
    components: clone(renderPackage?.components),
    materials: clone(renderPackage?.materials),
    requestKey: renderPackage?.requestKey,
    readiness: clone(renderPackage?.readiness),
    audit: clone(renderPackage?.audit)
  };
}

export function convertGuidedPointToBlender(point) {
  if (!finitePoint(point)) {
    throw new TypeError("A finite JQ world-space point is required.");
  }
  return Object.freeze({
    x: canonicalNumber(Number(point.x) * INCHES_TO_METERS),
    y: canonicalNumber(-Number(point.z) * INCHES_TO_METERS),
    z: canonicalNumber(Number(point.y) * INCHES_TO_METERS)
  });
}

export function convertGuidedBoundsToBlender(bounds) {
  if (!finiteBounds(bounds)) {
    throw new TypeError("Finite ordered JQ world-space bounds are required.");
  }
  const corners = [];
  for (const x of [Number(bounds.min.x), Number(bounds.max.x)]) {
    for (const y of [Number(bounds.min.y), Number(bounds.max.y)]) {
      for (const z of [Number(bounds.min.z), Number(bounds.max.z)]) {
        corners.push(convertGuidedPointToBlender({ x, y, z }));
      }
    }
  }
  return freezeBounds({
    min: {
      x: Math.min(...corners.map((point) => point.x)),
      y: Math.min(...corners.map((point) => point.y)),
      z: Math.min(...corners.map((point) => point.z))
    },
    max: {
      x: Math.max(...corners.map((point) => point.x)),
      y: Math.max(...corners.map((point) => point.y)),
      z: Math.max(...corners.map((point) => point.z))
    }
  });
}

function createRenderIdentity(specification, profile, snapshot) {
  return {
    productId: specification.productId,
    layoutId: specification.layoutId,
    installationMode: specification.fit?.mode,
    engineVersion: specification.engineVersion,
    geometryFingerprint: specification.geometryFingerprint,
    selectionFingerprint: specification.selectionFingerprint,
    descriptorFingerprint: snapshot?.regeneration?.descriptorFingerprint,
    materialFingerprint: snapshot?.regeneration?.materialFingerprint,
    cameraFingerprint: snapshot?.regeneration?.cameraFingerprint,
    jobSchemaVersion: GUIDED_BLENDER_RENDER_JOB_SCHEMA_VERSION,
    packageSchemaVersion: GUIDED_BLENDER_RENDER_PACKAGE_SCHEMA_VERSION,
    renderContractVersion: GUIDED_RENDER_CONTRACT_VERSION,
    primitiveContractVersion: GUIDED_RENDER_PRIMITIVE_CONTRACT_VERSION,
    materialContractVersion: GUIDED_MATERIAL_CONTRACT_VERSION,
    pipelineVersion: GUIDED_BLENDER_RENDER_PIPELINE_VERSION,
    materialLibraryVersion: GUIDED_BLENDER_MATERIAL_LIBRARY_VERSION,
    sceneVersion: GUIDED_BLENDER_SCENE_VERSION,
    cameraVersion: GUIDED_BLENDER_CAMERA_VERSION,
    assetManifestSha256: GUIDED_BLENDER_ASSET_MANIFEST_SHA256,
    materialSourceSha256: GUIDED_BLENDER_MATERIAL_SOURCE_SHA256,
    outputProfile: profile.id
  };
}

function createRenderSettings(profile) {
  return {
    profileId: profile.id,
    engine: profile.id === "final" ? "CYCLES" : "BLENDER_EEVEE_NEXT",
    colorManagement: "AgX",
    look: "AgX Medium High Contrast",
    width: profile.width,
    height: profile.height,
    samples: profile.samples,
    passes: [...profile.passes],
    outputContracts: profile.passes.map((pass) => ({
      pass,
      ...OUTPUT_PASS_CONTRACTS[pass]
    })),
    sceneVersion: GUIDED_BLENDER_SCENE_VERSION,
    cameraVersion: GUIDED_BLENDER_CAMERA_VERSION,
    materialCatalog: "guided-materials.js#GUIDED_MATERIAL_MANIFEST",
    materialLibraryVersion: GUIDED_BLENDER_MATERIAL_LIBRARY_VERSION,
    materialContractVersion: GUIDED_MATERIAL_CONTRACT_VERSION,
    assetManifest: {
      path: "config/asset-manifest.json",
      sha256: GUIDED_BLENDER_ASSET_MANIFEST_SHA256
    },
    materialSourceSha256: GUIDED_BLENDER_MATERIAL_SOURCE_SHA256
  };
}

function sanitizeAcceptedProject(project, snapshot) {
  const sanitized = {};
  for (const key of PROJECT_FIELDS) {
    if (!Object.hasOwn(project || {}, key)) {
      if (REQUIRED_PROJECT_FIELDS.has(key)) {
        throw blenderContractError(
          "MISSING_BLENDER_SELECTION",
          `Selection ${key} is required by Blender foundation v1.`
        );
      }
      continue;
    }
    if (!isSafeScalar(project[key])) {
      throw blenderContractError(
        "UNSUPPORTED_BLENDER_SELECTION",
        `Selection ${key} must be a finite scalar from the renderer contract.`
      );
    }
    assertSafeSelectionValue(key, project[key]);
    assertSupportedProjectSelection(key, project[key]);
    sanitized[key] = project[key];
  }
  sanitized.productId = "tv-unit";
  sanitized.layoutId = "clear-wall";
  sanitized.measurements = {};
  for (const [key, schema] of Object.entries(TV_CLEAR_WALL_MEASUREMENTS)) {
    const value = project?.measurements?.[key];
    assertSupportedMeasurement(key, value, schema);
    sanitized.measurements[key] = value;
  }
  sanitized.acceptedSnapshot = sanitizeSnapshot(snapshot);
  return sanitized;
}

function sanitizeSnapshot(snapshot) {
  return {
    schemaVersion: snapshot?.schemaVersion,
    engineVersion: snapshot?.engineVersion,
    specificationSchemaVersion: snapshot?.specificationSchemaVersion,
    projectId: null,
    productId: snapshot?.productId,
    layoutId: snapshot?.layoutId,
    geometryFingerprint: snapshot?.geometryFingerprint,
    selectionFingerprint: snapshot?.selectionFingerprint,
    specificationFingerprint: snapshot?.specificationFingerprint,
    regeneration: Object.fromEntries(SNAPSHOT_REGENERATION_KEYS.map((key) => [
      key,
      snapshot?.regeneration?.[key]
    ]))
  };
}

function assertSupportedRenderSlice(specification) {
  const mismatches = [];
  for (const [key, expected] of Object.entries(SUPPORTED_RENDER_SLICE)) {
    const actual = key === "installationMode" ? specification?.fit?.mode : specification?.[key];
    if (actual !== expected) mismatches.push({ key, expected, actual: actual ?? null });
  }
  if (mismatches.length) {
    throw blenderContractError(
      "UNSUPPORTED_BLENDER_RENDER_SLICE",
      "Foundation v1 only accepts a fitted TV Unit on a Clear Wall.",
      mismatches
    );
  }
}

function assertGuidedBlenderJob(job) {
  assertSerializedByteLimit(
    job,
    GUIDED_BLENDER_RENDER_JOB_MAX_BYTES,
    "BLENDER_RENDER_JOB_TOO_LARGE"
  );
  if (
    job?.kind !== "jq-guided-blender-render-job"
    || Number(job?.schemaVersion) !== GUIDED_BLENDER_RENDER_JOB_SCHEMA_VERSION
    || Number(job?.contractVersion) !== GUIDED_RENDER_CONTRACT_VERSION
    || Number(job?.primitiveContractVersion) !== GUIDED_RENDER_PRIMITIVE_CONTRACT_VERSION
    || job?.pipelineVersion !== GUIDED_BLENDER_RENDER_PIPELINE_VERSION
    || job?.identity?.engineVersion !== GUIDED_PROJECT_ENGINE_VERSION
    || !job?.design?.acceptedSnapshot
  ) {
    throw blenderContractError(
      "INVALID_BLENDER_RENDER_JOB",
      "The Blender render job is missing a supported accepted contract."
    );
  }
  if (!hasExactKeys(job, [
    "kind",
    "schemaVersion",
    "contractVersion",
    "primitiveContractVersion",
    "pipelineVersion",
    "identity",
    "design",
    "render",
    "renderKey"
  ]) || !hasExactKeys(job.identity, RENDER_IDENTITY_KEYS)) {
    throw blenderContractError(
      "INVALID_BLENDER_RENDER_JOB_SHAPE",
      "The Blender render job contains unknown or missing contract fields."
    );
  }
  const canonicalDesign = sanitizeAcceptedProject(
    job.design,
    job.design.acceptedSnapshot
  );
  if (stableStringify(job.design) !== stableStringify(canonicalDesign)) {
    throw blenderContractError(
      "INVALID_BLENDER_RENDER_DESIGN_SHAPE",
      "The Blender design payload contains fields outside the exact allowlist."
    );
  }
  assertAcceptedSnapshotFingerprints(job.design.acceptedSnapshot);
}

function assertAcceptedSnapshotFingerprints(snapshot) {
  const values = [
    snapshot?.geometryFingerprint,
    snapshot?.selectionFingerprint,
    snapshot?.specificationFingerprint,
    ...SNAPSHOT_REGENERATION_KEYS.map((key) => snapshot?.regeneration?.[key])
  ];
  if (values.some((value) => (
    typeof value !== "string"
    || value.length > 160
    || !/^jq-guided-[a-z0-9-]+-v[0-9]+-[a-z0-9]+$/i.test(value)
  ))) {
    throw blenderContractError(
      "INVALID_BLENDER_SNAPSHOT_FINGERPRINT",
      "Accepted snapshot fingerprints must be bounded versioned JQ identifiers."
    );
  }
}

function assertIdentityMatchesSpecification(identity, specification, snapshot) {
  const expected = createRenderIdentity(
    specification,
    resolveOutputProfile(identity?.outputProfile),
    snapshot
  );
  const mismatches = Object.keys(expected).filter((key) => identity?.[key] !== expected[key]);
  if (mismatches.length) {
    throw blenderContractError(
      "BLENDER_ACCEPTED_IDENTITY_MISMATCH",
      "The regenerated design identity does not match the requested render.",
      mismatches
    );
  }
}

function createAcceptedComponentIndex(specification) {
  const index = new Map();
  for (const set of specification.product?.descriptorSets || []) {
    for (const component of set.components || []) {
      index.set(String(component.id), {
        ...component,
        descriptorSetId: set.id,
        transform: set.transform
      });
    }
  }
  return index;
}

function createBlenderComponent(
  descriptor,
  sourceComponent,
  manifestEntry,
  materialState,
  plan
) {
  const sourceMaterialSlot = String(manifestEntry.materialSlot || descriptor.materialSlot || "case");
  return {
    componentId: descriptor.componentId,
    descriptorSetId: descriptor.descriptorSetId,
    installationId: descriptor.installationId,
    zoneId: descriptor.zoneId,
    parentId: sourceComponent.parentId || null,
    hostId: sourceComponent.hostId || null,
    role: descriptor.role,
    geometryVariant: plan.geometryVariant,
    sourceMaterialSlot,
    materialId: resolveMaterialId(sourceMaterialSlot, materialState),
    sourceTransform: clone(descriptor.transform),
    sourceWorldBounds: clone(plan.worldBounds),
    blenderWorldBounds: convertGuidedBoundsToBlender(plan.worldBounds),
    metadata: sanitizeComponentMetadata(sourceComponent.metadata),
    submeshes: plan.submeshes.map((submesh) => {
      const submeshSlot = submesh.materialSlot === "glass"
        ? "glass"
        : sourceMaterialSlot;
      return {
        submeshId: submesh.submeshId,
        geometry: submesh.geometry,
        grainRole: submesh.grainRole,
        edgeVisible: submesh.edgeVisible,
        sourceMaterialSlot: submeshSlot,
        materialId: resolveMaterialId(submeshSlot, materialState),
        sourceLocalBounds: clone(submesh.bounds),
        sourceWorldBounds: clone(submesh.worldBounds),
        blenderWorldBounds: convertGuidedBoundsToBlender(submesh.worldBounds),
        profileGeometry: sanitizeProfileGeometry(submesh.profileGeometry)
      };
    })
  };
}

function createPrimitiveAuditRecord(plan) {
  return {
    componentId: plan.componentId,
    meshCount: plan.submeshes.length,
    materialSlots: [...plan.materialSlots],
    worldBounds: clone(plan.worldBounds),
    submeshes: plan.submeshes.map((submesh) => ({
      submeshId: submesh.submeshId,
      geometry: submesh.geometry,
      materialSlot: submesh.materialSlot,
      worldBounds: clone(submesh.worldBounds)
    }))
  };
}

function createBlenderConstraints(specification) {
  const constraints = [];
  for (const set of specification.product?.descriptorSets || []) {
    for (const component of set.components || []) {
      const kind = component.metadata?.kind || "opening";
      if (component.role !== "opening" || !finiteBounds(component.bounds)) continue;
      const sourceWorldBounds = transformGuidedBoundsToWorld(component.bounds, set.transform);
      constraints.push({
        constraintId: String(component.id),
        kind,
        sourceWorldBounds: clone(sourceWorldBounds),
        blenderWorldBounds: convertGuidedBoundsToBlender(sourceWorldBounds),
        clearance: compactConstraintMetadata(component.metadata)
      });
    }
  }
  return constraints.sort((left, right) => left.constraintId.localeCompare(right.constraintId));
}

function createBlenderRoom(specification) {
  const room = specification.room || {};
  return {
    layoutId: room.layoutId,
    wallWidthIn: finiteOrNull(room.wallWidth),
    ceilingHeightIn: finiteOrNull(room.ceilingHeight),
    desiredDepthIn: finiteOrNull(room.desiredDepth),
    floorPlaneYIn: finiteOrNull(room.floorPlaneY),
    rearWallPlaneZIn: finiteOrNull(room.rearWallPlaneZ),
    cameraIntent: room.cameraIntent || "front",
    planes: compactFiniteGeometry(room.planes),
    features: compactFiniteGeometry(room.features),
    exclusionVolumes: compactFiniteGeometry(room.exclusionVolumes)
  };
}

function createBlenderInstallation(specification) {
  return {
    mode: specification.fit?.mode,
    casework: compactFiniteGeometry(specification.fit?.casework),
    treatments: compactFiniteGeometry(specification.fit?.treatments),
    anchors: compactFiniteGeometry(specification.fit?.anchors),
    invariants: {
      noGlobalScaling: specification.fit?.invariants?.noGlobalScaling === true,
      rootScale: clone(specification.fit?.invariants?.rootScale || [1, 1, 1])
    }
  };
}

function createCoordinateContract() {
  return {
    source: {
      name: "JQ accepted world",
      handedness: "right",
      axes: { x: "right", y: "up", z: "toward-rear-wall" },
      units: "inches"
    },
    target: {
      name: "Blender world",
      handedness: "right",
      axes: { x: "right", y: "away-from-rear-wall", z: "up" },
      units: "meters"
    },
    pointMapping: "(x, y, z) -> (x, -z, y) * 0.0254",
    matrix4RowMajor: [
      INCHES_TO_METERS, 0, 0, 0,
      0, 0, -INCHES_TO_METERS, 0,
      0, INCHES_TO_METERS, 0, 0,
      0, 0, 0, 1
    ]
  };
}

function createBlenderScene(specification) {
  return {
    sceneVersion: GUIDED_BLENDER_SCENE_VERSION,
    shell: {
      kind: "procedural-clear-wall-room",
      wallWidthIn: finiteOrNull(specification.room?.wallWidth),
      ceilingHeightIn: finiteOrNull(specification.room?.ceilingHeight),
      rearWallPlaneZIn: finiteOrNull(specification.room?.rearWallPlaneZ),
      floorPlaneYIn: finiteOrNull(specification.room?.floorPlaneY)
    },
    environment: {
      path: "assets/environments/jq-warm-interior.hdr",
      sha256: "49db5b6e13c5b5239d8aca84c055c586dfc71aeaf1e1db64487f5bf8bab66db2",
      strength: 0.65
    },
    assetManifest: {
      path: "config/asset-manifest.json",
      sha256: GUIDED_BLENDER_ASSET_MANIFEST_SHA256
    },
    decorPolicy: "none-in-foundation-v1"
  };
}

function createBlenderCamera(components, renderSettings) {
  const bounds = unionBlenderComponentBounds(components);
  const width = bounds.max.x - bounds.min.x;
  const height = bounds.max.z - bounds.min.z;
  const aspect = Number(renderSettings.width) / Number(renderSettings.height);
  const sensorWidthMm = 36;
  const sensorHeightMm = sensorWidthMm / aspect;
  const lensMm = 50;
  const horizontalFov = 2 * Math.atan(sensorWidthMm / (2 * lensMm));
  const verticalFov = 2 * Math.atan(sensorHeightMm / (2 * lensMm));
  const margin = 1.14;
  const distance = Math.max(
    (width * margin / 2) / Math.tan(horizontalFov / 2),
    (height * margin / 2) / Math.tan(verticalFov / 2)
  );
  const target = {
    x: roundMetric((bounds.min.x + bounds.max.x) / 2),
    y: roundMetric((bounds.min.y + bounds.max.y) / 2),
    z: roundMetric((bounds.min.z + bounds.max.z) / 2)
  };
  return {
    cameraVersion: GUIDED_BLENDER_CAMERA_VERSION,
    type: "PERSP",
    lensMm,
    sensorWidthMm,
    fitMargin: margin,
    position: {
      x: target.x,
      y: roundMetric(bounds.max.y + distance),
      z: target.z
    },
    target,
    up: [0, 0, 1],
    clipStartM: 0.05,
    clipEndM: roundMetric(Math.max(25, distance * 3)),
    framingBounds: clone(bounds)
  };
}

function unionBlenderComponentBounds(components) {
  const bounds = components.map((component) => component.blenderWorldBounds);
  if (!bounds.length || bounds.some((entry) => !finiteBounds(entry))) {
    throw blenderContractError(
      "BLENDER_CAMERA_BOUNDS_UNAVAILABLE",
      "A finite component envelope is required to derive the Blender camera."
    );
  }
  return freezeBounds({
    min: {
      x: Math.min(...bounds.map((entry) => entry.min.x)),
      y: Math.min(...bounds.map((entry) => entry.min.y)),
      z: Math.min(...bounds.map((entry) => entry.min.z))
    },
    max: {
      x: Math.max(...bounds.map((entry) => entry.max.x)),
      y: Math.max(...bounds.map((entry) => entry.max.y)),
      z: Math.max(...bounds.map((entry) => entry.max.z))
    }
  });
}

function createMaterialBindings(components) {
  const bySlot = new Map();
  for (const component of components) {
    for (const submesh of component.submeshes) {
      bySlot.set(
        submesh.sourceMaterialSlot,
        createPortableMaterialBinding(submesh.sourceMaterialSlot, submesh.materialId)
      );
    }
  }
  return [...bySlot.values()].sort((left, right) => (
    left.sourceMaterialSlot.localeCompare(right.sourceMaterialSlot)
  ));
}

function createPortableMaterialBinding(sourceMaterialSlot, materialId) {
  const guided = GUIDED_MATERIALS_BY_ID.get(materialId);
  if (guided) {
    return {
      sourceMaterialSlot,
      materialId,
      resolver: "embedded-guided-material-definition",
      status: "procedural-starter",
      materialContractVersion: GUIDED_MATERIAL_CONTRACT_VERSION,
      sourceSha256: GUIDED_BLENDER_MATERIAL_SOURCE_SHA256,
      definition: clone(guided)
    };
  }
  const recipes = {
    "black-pull": {
      family: "metal",
      baseColor: "#202224",
      roughness: 0.46,
      metallic: 0.62
    },
    "brass-pull": {
      family: "metal",
      baseColor: "#b48a42",
      roughness: 0.3,
      metallic: 0.86
    },
    knob: {
      family: "metal",
      baseColor: "#393633",
      roughness: 0.38,
      metallic: 0.72
    },
    "warm-led": {
      family: "emissive",
      baseColor: "#fff3df",
      strength: 6,
      colorTemperatureSource: "component.metadata.warmth"
    },
    "integrated-led": {
      family: "emissive",
      baseColor: "#fff3df",
      strength: 6,
      colorTemperatureSource: "component.metadata.warmth"
    },
    "tv-screen-neutral": {
      family: "screen",
      baseColor: "#111315",
      roughness: 0.28,
      metallic: 0.08
    },
    "glass-clear": {
      family: "glass",
      baseColor: "#f5f7f7",
      roughness: 0.08,
      transmission: 1,
      ior: 1.52
    }
  };
  const definition = recipes[materialId];
  if (!definition) {
    throw blenderContractError(
      "UNSUPPORTED_RENDER_MATERIAL",
      `Material ${materialId} has no portable Blender resolver.`
    );
  }
  return {
    sourceMaterialSlot,
    materialId,
    resolver: "embedded-portable-recipe",
    status: "procedural-starter",
    materialContractVersion: GUIDED_MATERIAL_CONTRACT_VERSION,
    sourceSha256: GUIDED_BLENDER_MATERIAL_SOURCE_SHA256,
    definition
  };
}

function createRenderReadiness(specification, materials) {
  const blockers = [
    {
      code: "TV_TEMPLATE_APPROVAL_REQUIRED",
      message: "John's Drawing 4 bay, front, and countertop rules are not yet encoded as the approved TV template."
    },
    {
      code: "SCENE_CAMERA_APPROVAL_REQUIRED",
      message: "The procedural room shell and deterministic hero camera require a reviewed reference render."
    }
  ];
  blockers.push({
    code: "CLEAR_UV_MAPLE_SURFACE_CONTRACT_REQUIRED",
    message: "Hidden cabinet-interior surfaces must be tagged separately from exposed backing before clear-UV maple can be assigned."
  });
  blockers.push({
    code: "CLEAR_UV_MAPLE_PBR_REQUIRED",
    message: "The fixed clear-UV maple interior needs an approved scanned PBR material."
  });
  blockers.push({
    code: "PHYSICAL_SAMPLE_CALIBRATION_REQUIRED",
    message: `Finish ${specification.materialState?.finish || "unknown"} is still a procedural visualization starter.`
  });
  const unresolvedMaterials = materials.filter((material) => material.status === "unresolved");
  if (unresolvedMaterials.length) {
    blockers.push({
      code: "UNRESOLVED_BLENDER_MATERIAL",
      message: `Unresolved material bindings: ${unresolvedMaterials.map((item) => item.materialId).join(", ")}.`
    });
  }
  return {
    prototypeRenderAllowed: unresolvedMaterials.length === 0,
    customerBeautyRenderApproved: false,
    geometryApproval: "pending-john-tv-template",
    materialApproval: "pending-physical-samples",
    requiredAssets: [{
      materialId: "clear-uv-maple",
      status: "authoring-and-semantic-mapping-required"
    }],
    blockers
  };
}

function resolveMaterialId(slot, materialState) {
  if (slot === "glass") return "glass-clear";
  if (slot === "screen") return "tv-screen-neutral";
  const materialId = materialState?.assignments?.[slot]
    || (slot === "cabinet_finish" ? materialState?.finish : null)
    || materialState?.finish
    || slot;
  return materialId === "no-accent" ? materialState?.finish || "natural-oak" : materialId;
}

function sanitizeComponentMetadata(metadata) {
  const safe = {};
  for (const key of SAFE_COMPONENT_METADATA) {
    if (metadata?.[key] === undefined) continue;
    safe[key] = compactFiniteGeometry(metadata[key]);
  }
  return safe;
}

function sanitizeProfileGeometry(profile) {
  if (!profile || typeof profile !== "object") return null;
  return compactFiniteGeometry(profile);
}

function compactConstraintMetadata(metadata) {
  return compactFiniteGeometry({
    serviceClearance: metadata?.serviceClearance,
    ventilationClearance: metadata?.ventilationClearance,
    noDecorativeFrame: metadata?.noDecorativeFrame === true
  });
}

function compactFiniteGeometry(value, depth = 0) {
  if (depth > 8 || value === undefined) return null;
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map((entry) => compactFiniteGeometry(entry, depth + 1));
  if (typeof value !== "object") return null;
  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    if (/price|cost|url|source|warning|message/i.test(key)) continue;
    const compacted = compactFiniteGeometry(entry, depth + 1);
    if (compacted !== null && compacted !== undefined) result[key] = compacted;
  }
  return result;
}

function resolveOutputProfile(profileId = "preview") {
  const profile = OUTPUT_PROFILES[profileId];
  if (!profile) {
    throw blenderContractError(
      "UNSUPPORTED_BLENDER_OUTPUT_PROFILE",
      `Unknown Blender output profile ${profileId}.`
    );
  }
  return profile;
}

async function createRenderKey(identity, renderSettings) {
  return createSha256Key("jq-blender-v1", { identity, renderSettings });
}

async function createPackageRenderKey(renderPayload) {
  return createSha256Key("jq-blender-package-v1", renderPayload);
}

async function createSha256Key(prefix, value) {
  const source = stableStringify(value);
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle || typeof TextEncoder === "undefined") {
    throw blenderContractError(
      "SHA256_UNAVAILABLE",
      "A Web Crypto SHA-256 implementation is required for Blender render identity."
    );
  }
  const digest = await cryptoApi.subtle.digest("SHA-256", new TextEncoder().encode(source));
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `${prefix}-${hex}`;
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => (
    `${JSON.stringify(key)}:${stableStringify(value[key])}`
  )).join(",")}}`;
}

function finitePoint(point) {
  return Boolean(point && ["x", "y", "z"].every((axis) => Number.isFinite(Number(point[axis]))));
}

function finiteBounds(bounds) {
  return Boolean(bounds?.min && bounds?.max && ["x", "y", "z"].every((axis) => (
    Number.isFinite(Number(bounds.min[axis]))
    && Number.isFinite(Number(bounds.max[axis]))
    && Number(bounds.max[axis]) > Number(bounds.min[axis])
  )));
}

function freezeBounds(bounds) {
  return Object.freeze({
    min: Object.freeze({ ...bounds.min }),
    max: Object.freeze({ ...bounds.max })
  });
}

function isSafeScalar(value) {
  return value === null
    || typeof value === "string"
    || typeof value === "boolean"
    || (typeof value === "number" && Number.isFinite(value));
}

function assertSafeSelectionValue(key, value) {
  if (
    typeof value === "string"
    && !/^[a-z0-9][a-z0-9._-]{0,79}$/i.test(value)
  ) {
    throw blenderContractError(
      "UNSAFE_BLENDER_SELECTION",
      `Selection ${key} is outside the renderer identifier contract.`
    );
  }
}

function assertSupportedProjectSelection(key, value) {
  const allowed = SUPPORTED_SELECTIONS[key];
  if (allowed && (typeof value !== "string" || !allowed.has(value))) {
    throw blenderContractError(
      "UNSUPPORTED_BLENDER_SELECTION",
      `Selection ${key}=${value} is not available in Blender foundation v1.`
    );
  }
  if (
    key === "lightingWarmth"
    && (
      typeof value !== "number"
      || ![2700, 3000, 3500].includes(value)
    )
  ) {
    throw blenderContractError(
      "UNSUPPORTED_BLENDER_SELECTION",
      "Lighting warmth must be one of 2700K, 3000K, or 3500K."
    );
  }
  if (
    key === "shelves"
    && (
      typeof value !== "number"
      || !Number.isInteger(value)
      || value < 2
      || value > 8
    )
  ) {
    throw blenderContractError(
      "UNSUPPORTED_BLENDER_SELECTION",
      "Shelf count must be an integer from 2 through 8."
    );
  }
}

function assertSupportedMeasurement(key, value, schema) {
  const validNumber = schema.kind === "number"
    && typeof value === "number"
    && Number.isFinite(value)
    && value >= schema.min
    && value <= schema.max;
  const validEnum = schema.kind === "enum"
    && typeof value === "string"
    && schema.values.includes(value);
  if (!validNumber && !validEnum) {
    throw blenderContractError(
      "UNSUPPORTED_BLENDER_MEASUREMENT",
      `Measurement ${key} is outside the exact TV Unit + Clear Wall UI contract.`
    );
  }
}

function finiteOrNull(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function canonicalNumber(value) {
  return Object.is(value, -0) ? 0 : value;
}

function roundMetric(value) {
  return canonicalNumber(Math.round(Number(value) * 1e9) / 1e9);
}

function assertNoUnsafePayload(value) {
  const serialized = JSON.stringify(value);
  if (/https?:\/\/|"pricing"|"hardwareSnapshot"|"variantSnapshot"|"acceptedSpecification"/i.test(serialized)) {
    throw blenderContractError(
      "UNSAFE_BLENDER_PAYLOAD",
      "The Blender payload contains data outside the renderer allowlist."
    );
  }
}

function assertSerializedByteLimit(value, maxBytes, code) {
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw blenderContractError(code, "The Blender payload must be finite JSON.");
  }
  const bytes = new TextEncoder().encode(serialized).byteLength;
  if (bytes > maxBytes) {
    throw blenderContractError(
      code,
      `The Blender render job exceeds the ${maxBytes}-byte contract limit.`
    );
  }
}

function hasExactKeys(value, expectedKeys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function blenderContractError(code, message, details = []) {
  const error = new Error(message);
  error.name = "GuidedBlenderRenderContractError";
  error.code = code;
  error.details = clone(details || []);
  return error;
}

function issue(code, message) {
  return Object.freeze({ code, severity: "error", message });
}

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
