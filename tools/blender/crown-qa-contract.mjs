import { createHash } from "node:crypto";

import { validateGuidedBlenderRenderPackage } from "../../guided-blender-render-contract.js";

export const CROWN_DETAIL_QA_CAPTURE_ID = "crown-detail-qa-v1";
export const CROWN_DETAIL_QA_CAPTURE_SCHEMA_VERSION = 1;
export const CROWN_DETAIL_QA_REPORT_SCHEMA_VERSION = 1;
export const CROWN_DETAIL_QA_OUTPUT_FILENAME = "crown-detail.webp";
export const CROWN_DETAIL_QA_CAMERA_ID = "crown-detail-qa-camera-v1";
export const CROWN_DETAIL_QA_CAMERA_NAME = CROWN_DETAIL_QA_CAMERA_ID;
export const CROWN_DETAIL_QA_FIT_MARGIN = 1.2;
export const CROWN_DETAIL_QA_VIEW_OFFSET = Object.freeze([1, 2, -1]);
export const CROWN_DETAIL_QA_RULE_IDS = deepFreeze({
  exactTopology: "jq-crown-exact-three-components-v1",
  crownProfile: "CONSTRUCTION_RULES.crownProfiles.slim_cap",
  crownProfileCatalog: "CROWN_PROFILE_CATALOG.slim_cap.parts.slim_cap",
  exposedEndReturns: "JQ-CONSTRUCTION-STANDARD.md#crown-overhang-and-side-returns",
  unexpectedSolidIntersection: "JQ-CONSTRUCTION-STANDARD.md#COMPONENT_COLLISION",
  fittedFillerVolume: "guided-render-contract.js#auditInstallationTreatments"
});

const CAPTURE_KIND = "jq-local-crown-detail-qa-capture";
const REPORT_KIND = "jq-local-crown-detail-qa-report";
const CAPTURE_KEY_PREFIX = "jq-crown-detail-qa-v1-";
const MAX_OUTPUT_BYTES = 32 * 1024 * 1024;
const AXES = Object.freeze(["x", "y", "z"]);
const EXPECTED_COMPONENT_IDS = deepFreeze({
  main: "guided-installation-main/crown-slim-cap",
  leftReturn: "guided-installation-main/crown-slim-cap-left-return",
  rightReturn: "guided-installation-main/crown-slim-cap-right-return",
  leftFiller: "guided-installation-main/installation-treatment-left-filler",
  rightFiller: "guided-installation-main/installation-treatment-right-filler"
});
const EXPECTED_CROWN_IDS = Object.freeze([
  EXPECTED_COMPONENT_IDS.main,
  EXPECTED_COMPONENT_IDS.leftReturn,
  EXPECTED_COMPONENT_IDS.rightReturn
]);
const TARGET_CROWN_IDS = Object.freeze([
  EXPECTED_COMPONENT_IDS.main,
  EXPECTED_COMPONENT_IDS.rightReturn
]);
const EXPECTED_RENDER_PINS = deepFreeze({
  profileId: "preview",
  engine: "BLENDER_EEVEE_NEXT",
  width: 960,
  height: 640,
  resolutionPercentage: 100,
  samples: 128
});

export class CrownQaContractError extends Error {
  constructor(code, message, details = []) {
    super(message);
    this.name = "CrownQaContractError";
    this.code = code;
    this.details = clone(details);
  }
}

/**
 * Derive a local, renderer-neutral crown close-up from an already authoritative
 * package. The package camera and render key are read-only inputs and are never
 * replaced or mutated by this diagnostic contract.
 */
export async function createCrownDetailQaCapture(renderPackage) {
  await assertVerifiedPackage(renderPackage);
  assertSupportedRenderSlice(renderPackage);

  const primaryCameraSnapshot = stableStringify(renderPackage.camera);
  const primaryRenderKey = renderPackage.renderKey;
  const components = resolveCrownQaComponents(renderPackage);
  const framingBounds = createRightFrontFramingBounds(
    components.main.blenderWorldBounds,
    components.rightReturn.blenderWorldBounds
  );
  const camera = createDetailCamera(renderPackage.camera, framingBounds);
  const componentIds = [...EXPECTED_CROWN_IDS].sort();
  const submeshObjectNames = componentIds
    .map((componentId) => `${componentId}::profile-extrusion`)
    .sort();
  const crownBounds = unionBounds([
    components.main.blenderWorldBounds,
    components.leftReturn.blenderWorldBounds,
    components.rightReturn.blenderWorldBounds
  ]);

  const captureCore = {
    kind: CAPTURE_KIND,
    schemaVersion: CROWN_DETAIL_QA_CAPTURE_SCHEMA_VERSION,
    captureId: CROWN_DETAIL_QA_CAPTURE_ID,
    primaryRenderKey: renderPackage.renderKey,
    pipelineVersion: renderPackage.pipelineVersion,
    target: {
      componentIds,
      submeshObjectNames,
      focusComponentIds: [...TARGET_CROWN_IDS],
      crownBounds,
      framingBounds
    },
    camera,
    render: createInheritedRenderContract(renderPackage.render)
  };
  const capture = deepFreeze({
    ...captureCore,
    captureKey: createCaptureKey(captureCore)
  });

  assertUnchanged(
    renderPackage.camera,
    primaryCameraSnapshot,
    "PRIMARY_CAMERA_MUTATED",
    "Deriving the crown diagnostic changed the authoritative package camera."
  );
  if (renderPackage.renderKey !== primaryRenderKey) {
    fail(
      "PRIMARY_RENDER_KEY_MUTATED",
      "Deriving the crown diagnostic changed the authoritative package render key."
    );
  }
  return capture;
}

/** Strictly validate every capture field by reproducing it from the package. */
export async function validateCrownDetailQaCapture(renderPackage, capture) {
  const errors = [];
  if (!hasExactKeys(capture, [
    "kind",
    "schemaVersion",
    "captureId",
    "primaryRenderKey",
    "pipelineVersion",
    "target",
    "camera",
    "render",
    "captureKey"
  ])) {
    errors.push(issue("INVALID_CROWN_QA_CAPTURE_SHAPE", "The crown QA capture has unknown or missing fields."));
  }
  try {
    const expected = await createCrownDetailQaCapture(renderPackage);
    if (stableStringify(capture) !== stableStringify(expected)) {
      errors.push(issue("CROWN_QA_CAPTURE_MISMATCH", "The crown QA capture does not match the verified package."));
    }
  } catch (error) {
    errors.push(issue(error?.code || "INVALID_CROWN_QA_CAPTURE", error?.message || "The crown QA capture is invalid."));
  }
  return deepFreeze({
    valid: errors.length === 0,
    schemaVersion: CROWN_DETAIL_QA_CAPTURE_SCHEMA_VERSION,
    errors
  });
}

/**
 * Classify the authoritative package geometry without consulting pixels or
 * Blender. Positive-volume crown-return/filler intersections are geometry
 * defects; face contact alone would not be.
 */
export async function classifyCrownGeometry(renderPackage) {
  await assertVerifiedPackage(renderPackage);
  return classifyResolvedCrownGeometry(resolveCrownQaComponents(renderPackage));
}

/**
 * Return normalized pinhole projections for all eight diagnostic framing
 * corners. A fitted capture has abs(x/y) <= 1 / camera.fitMargin.
 */
export function projectCrownDetailFramingCorners(camera) {
  assertDetailCameraShape(camera);
  const forward = normalize(subtract(camera.target, camera.position), "camera forward");
  const right = normalize(cross(forward, camera.up), "camera right");
  const cameraUp = normalize(cross(right, forward), "camera up");
  const tanHorizontal = camera.sensorWidthMm / (2 * camera.lensMm);
  const tanVertical = tanHorizontal / (camera.resolution.width / camera.resolution.height);

  return deepFreeze(boundsCorners(camera.framingBounds).map((point) => {
    const relative = subtract(point, camera.position);
    const depthM = dot(relative, forward);
    if (!(depthM > camera.clipStartM && depthM < camera.clipEndM)) {
      fail("CROWN_QA_CORNER_OUTSIDE_CLIP", "A crown framing corner is outside the package clipping planes.");
    }
    return {
      point: clone(point),
      normalizedX: roundMetric(dot(relative, right) / (depthM * tanHorizontal)),
      normalizedY: roundMetric(dot(relative, cameraUp) / (depthM * tanVertical)),
      depthM: roundMetric(depthM)
    };
  }));
}

/** Create a strict local diagnostic report from measured output metadata. */
export async function createCrownDetailQaReport(renderPackage, capture, inputs) {
  const captureValidation = await validateCrownDetailQaCapture(renderPackage, capture);
  if (!captureValidation.valid) {
    fail("INVALID_CROWN_QA_CAPTURE", "The report requires the exact capture for its verified package.", captureValidation.errors);
  }
  assertCaptureShape(capture);
  if (!hasExactKeys(inputs, ["output", "blenderParity"])) {
    fail(
      "INVALID_CROWN_QA_REPORT_INPUT",
      "Report inputs must contain exactly output and blenderParity."
    );
  }
  const output = normalizeReportOutput(capture, inputs.output);
  const blenderParity = inputs.blenderParity === null
    ? null
    : normalizeBlenderParity(capture, inputs.blenderParity);
  return deepFreeze({
    kind: REPORT_KIND,
    schemaVersion: CROWN_DETAIL_QA_REPORT_SCHEMA_VERSION,
    captureId: capture.captureId,
    captureKey: capture.captureKey,
    primaryRenderKey: capture.primaryRenderKey,
    pipelineVersion: capture.pipelineVersion,
    status: "completed",
    classification: classifyResolvedCrownGeometry(resolveCrownQaComponents(renderPackage)),
    output,
    blenderParity
  });
}

/** Strictly validate a diagnostic report against its immutable capture. */
export async function validateCrownDetailQaReport(renderPackage, capture, report) {
  const errors = [];
  if (!hasExactKeys(report, [
    "kind",
    "schemaVersion",
    "captureId",
    "captureKey",
    "primaryRenderKey",
    "pipelineVersion",
    "status",
    "classification",
    "output",
    "blenderParity"
  ])) {
    errors.push(issue("INVALID_CROWN_QA_REPORT_SHAPE", "The crown QA report has unknown or missing fields."));
  }
  try {
    const expected = await createCrownDetailQaReport(renderPackage, capture, {
      output: report?.output,
      blenderParity: report?.blenderParity
    });
    if (stableStringify(report) !== stableStringify(expected)) {
      errors.push(issue("CROWN_QA_REPORT_MISMATCH", "The crown QA report does not match its capture."));
    }
  } catch (error) {
    errors.push(issue(error?.code || "INVALID_CROWN_QA_REPORT", error?.message || "The crown QA report is invalid."));
  }
  return deepFreeze({
    valid: errors.length === 0,
    schemaVersion: CROWN_DETAIL_QA_REPORT_SCHEMA_VERSION,
    errors
  });
}

/** Verify a detail WebP against the report's byte, digest, and dimension record. */
export async function verifyCrownDetailWebpIntegrity(renderPackage, capture, report, fileBytes) {
  const validation = await validateCrownDetailQaReport(renderPackage, capture, report);
  if (!validation.valid) {
    fail("INVALID_CROWN_QA_REPORT", "The crown QA report must validate before its image can be verified.", validation.errors);
  }
  const bytes = Buffer.isBuffer(fileBytes) ? fileBytes : Buffer.from(fileBytes || []);
  const dimensions = readWebpDimensions(bytes);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (
    bytes.length !== report.output.bytes
    || sha256 !== report.output.sha256
    || dimensions.width !== report.output.width
    || dimensions.height !== report.output.height
  ) {
    fail(
      "CROWN_QA_OUTPUT_INTEGRITY_MISMATCH",
      "crown-detail.webp does not match its diagnostic report."
    );
  }
  return deepFreeze({
    valid: true,
    filename: CROWN_DETAIL_QA_OUTPUT_FILENAME,
    width: dimensions.width,
    height: dimensions.height,
    bytes: bytes.length,
    sha256
  });
}

/** Read dimensions from a bounded RIFF VP8X, VP8L, or VP8 WebP. */
export function readWebpDimensions(fileBytes) {
  const bytes = Buffer.isBuffer(fileBytes) ? fileBytes : Buffer.from(fileBytes || []);
  if (
    bytes.length < 20
    || bytes.toString("ascii", 0, 4) !== "RIFF"
    || bytes.toString("ascii", 8, 12) !== "WEBP"
  ) {
    fail("INVALID_CROWN_QA_WEBP", "crown-detail.webp is not a RIFF WebP file.");
  }
  if (bytes.readUInt32LE(4) + 8 !== bytes.length) {
    fail("INVALID_CROWN_QA_WEBP_LENGTH", "crown-detail.webp has an invalid RIFF byte length.");
  }

  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const kind = bytes.toString("ascii", offset, offset + 4);
    const chunkLength = bytes.readUInt32LE(offset + 4);
    const payload = offset + 8;
    const end = payload + chunkLength;
    if (end > bytes.length) {
      fail("INVALID_CROWN_QA_WEBP_CHUNK", `crown-detail.webp contains a truncated ${kind} chunk.`);
    }
    if (kind === "VP8X") {
      if (chunkLength < 10) fail("INVALID_CROWN_QA_WEBP", "The VP8X header is malformed.");
      return dimensions(
        1 + bytes.readUIntLE(payload + 4, 3),
        1 + bytes.readUIntLE(payload + 7, 3)
      );
    }
    if (kind === "VP8L") {
      if (chunkLength < 5 || bytes[payload] !== 0x2f) {
        fail("INVALID_CROWN_QA_WEBP", "The VP8L header is malformed.");
      }
      return dimensions(
        1 + bytes[payload + 1] + ((bytes[payload + 2] & 0x3f) << 8),
        1 + (bytes[payload + 2] >> 6) + (bytes[payload + 3] << 2) + ((bytes[payload + 4] & 0x0f) << 10)
      );
    }
    if (kind === "VP8 ") {
      if (
        chunkLength < 10
        || bytes[payload + 3] !== 0x9d
        || bytes[payload + 4] !== 0x01
        || bytes[payload + 5] !== 0x2a
      ) {
        fail("INVALID_CROWN_QA_WEBP", "The VP8 header is malformed.");
      }
      return dimensions(
        bytes.readUInt16LE(payload + 6) & 0x3fff,
        bytes.readUInt16LE(payload + 8) & 0x3fff
      );
    }
    offset = end + (chunkLength % 2);
  }
  fail("CROWN_QA_WEBP_DIMENSIONS_UNAVAILABLE", "crown-detail.webp has no supported image chunk.");
}

async function assertVerifiedPackage(renderPackage) {
  const validation = await validateGuidedBlenderRenderPackage(renderPackage);
  if (!validation.valid) {
    fail(
      "UNVERIFIED_CROWN_QA_PACKAGE",
      "A current verified Blender package is required for crown QA.",
      validation.errors
    );
  }
}

function assertSupportedRenderSlice(renderPackage) {
  const render = renderPackage.render;
  for (const [key, expected] of Object.entries(EXPECTED_RENDER_PINS)) {
    if (render?.[key] !== expected) {
      fail(
        "UNSUPPORTED_CROWN_QA_RENDER_SLICE",
        `Crown QA requires ${key}=${JSON.stringify(expected)}.`
      );
    }
  }
  if (
    renderPackage.identity?.productId !== "tv-unit"
    || renderPackage.identity?.layoutId !== "clear-wall"
    || renderPackage.identity?.installationMode !== "fitted"
    || renderPackage.camera?.type !== "PERSP"
    || renderPackage.camera?.sensorFit !== "HORIZONTAL"
    || renderPackage.camera?.depthOfField !== false
  ) {
    fail(
      "UNSUPPORTED_CROWN_QA_RENDER_SLICE",
      "Crown QA supports only the current fitted TV Unit + Clear Wall perspective package."
    );
  }
}

function resolveCrownQaComponents(renderPackage) {
  const components = renderPackage.components;
  const crownComponents = components.filter((component) => component.role === "crown");
  if (crownComponents.length !== 3) {
    fail("INVALID_CROWN_COMPONENT_COUNT", "Crown QA requires exactly three authored crown components.");
  }
  const crownIds = crownComponents.map((component) => component.componentId).sort();
  if (stableStringify(crownIds) !== stableStringify([...EXPECTED_CROWN_IDS].sort())) {
    fail("UNSUPPORTED_CROWN_COMPONENT_SET", "The authored crown component set is unsupported.");
  }

  const byId = new Map(components.map((component) => [component.componentId, component]));
  if (byId.size !== components.length) {
    fail("DUPLICATE_CROWN_QA_COMPONENT_ID", "The package repeats a component ID.");
  }
  const resolved = {
    main: byId.get(EXPECTED_COMPONENT_IDS.main),
    leftReturn: byId.get(EXPECTED_COMPONENT_IDS.leftReturn),
    rightReturn: byId.get(EXPECTED_COMPONENT_IDS.rightReturn),
    leftFiller: byId.get(EXPECTED_COMPONENT_IDS.leftFiller),
    rightFiller: byId.get(EXPECTED_COMPONENT_IDS.rightFiller)
  };
  if (Object.values(resolved).some((component) => !component)) {
    fail("MISSING_CROWN_QA_COMPONENT", "A required crown or fitted filler component is missing.");
  }
  if (resolved.leftFiller.role !== "filler" || resolved.rightFiller.role !== "filler") {
    fail("UNSUPPORTED_CROWN_QA_FILLER", "Crown QA requires the two authoritative fitted filler components.");
  }
  for (const crown of [resolved.main, resolved.leftReturn, resolved.rightReturn]) {
    if (
      crown.submeshes.length !== 1
      || crown.submeshes[0].submeshId !== "profile-extrusion"
      || crown.submeshes[0].geometry !== "crown_profile_extrusion"
    ) {
      fail("UNSUPPORTED_CROWN_QA_GEOMETRY", `${crown.componentId} is not the authored crown profile extrusion.`);
    }
  }
  return resolved;
}

function createRightFrontFramingBounds(mainBounds, rightReturnBounds) {
  assertFiniteOrderedBounds(mainBounds, "main crown bounds");
  assertFiniteOrderedBounds(rightReturnBounds, "right crown return bounds");
  const returnDepthM = rightReturnBounds.max.y - rightReturnBounds.min.y;
  const bounds = {
    min: {
      x: mainBounds.max.x - returnDepthM,
      y: Math.min(mainBounds.min.y, rightReturnBounds.min.y),
      z: Math.min(mainBounds.min.z, rightReturnBounds.min.z)
    },
    max: {
      x: Math.max(mainBounds.max.x, rightReturnBounds.max.x),
      y: Math.max(mainBounds.max.y, rightReturnBounds.max.y),
      z: Math.max(mainBounds.max.z, rightReturnBounds.max.z)
    }
  };
  return normalizeBounds(bounds, "crown framing bounds");
}

function unionBounds(boundsList) {
  if (!Array.isArray(boundsList) || boundsList.length === 0) {
    fail("INVALID_CROWN_QA_BOUNDS", "At least one crown bound is required.");
  }
  boundsList.forEach((bounds, index) => assertFiniteOrderedBounds(bounds, `crown bounds ${index}`));
  return normalizeBounds({
    min: {
      x: Math.min(...boundsList.map((bounds) => bounds.min.x)),
      y: Math.min(...boundsList.map((bounds) => bounds.min.y)),
      z: Math.min(...boundsList.map((bounds) => bounds.min.z))
    },
    max: {
      x: Math.max(...boundsList.map((bounds) => bounds.max.x)),
      y: Math.max(...boundsList.map((bounds) => bounds.max.y)),
      z: Math.max(...boundsList.map((bounds) => bounds.max.z))
    }
  }, "crown union bounds");
}

function createDetailCamera(primaryCamera, framingBounds) {
  assertFiniteOrderedBounds(framingBounds, "crown framing bounds");
  const target = boundsCenter(framingBounds);
  const viewOffset = normalize(vectorFromArray(CROWN_DETAIL_QA_VIEW_OFFSET), "crown camera view offset");
  const forward = scale(viewOffset, -1);
  const right = normalize(cross(forward, primaryCamera.up), "crown camera right");
  const cameraUp = normalize(cross(right, forward), "crown camera up");
  const aspect = EXPECTED_RENDER_PINS.width / EXPECTED_RENDER_PINS.height;
  const tanHorizontal = primaryCamera.sensorWidthMm / (2 * primaryCamera.lensMm);
  const tanVertical = tanHorizontal / aspect;
  let distanceM = 0;
  for (const corner of boundsCorners(framingBounds)) {
    const relative = subtract(corner, target);
    distanceM = Math.max(
      distanceM,
      CROWN_DETAIL_QA_FIT_MARGIN * Math.abs(dot(relative, right)) / tanHorizontal - dot(relative, forward),
      CROWN_DETAIL_QA_FIT_MARGIN * Math.abs(dot(relative, cameraUp)) / tanVertical - dot(relative, forward)
    );
  }
  if (!Number.isFinite(distanceM) || distanceM <= primaryCamera.clipStartM) {
    fail("INVALID_CROWN_QA_CAMERA_DISTANCE", "The crown close-up camera distance is invalid.");
  }
  const position = pointAdd(target, scale(viewOffset, distanceM));
  if (!(position.z < target.z)) {
    fail("INVALID_CROWN_QA_CAMERA_ELEVATION", "The crown close-up camera must sit below its target centerline.");
  }

  return deepFreeze({
    cameraId: CROWN_DETAIL_QA_CAMERA_ID,
    type: "PERSP",
    lensMm: primaryCamera.lensMm,
    sensorWidthMm: primaryCamera.sensorWidthMm,
    sensorFit: primaryCamera.sensorFit,
    depthOfField: primaryCamera.depthOfField,
    fitMargin: CROWN_DETAIL_QA_FIT_MARGIN,
    position: roundPoint(position),
    target: roundPoint(target),
    up: clone(primaryCamera.up),
    clipStartM: primaryCamera.clipStartM,
    clipEndM: primaryCamera.clipEndM,
    resolution: {
      width: EXPECTED_RENDER_PINS.width,
      height: EXPECTED_RENDER_PINS.height,
      pixelAspectX: 1,
      pixelAspectY: 1
    },
    framingBounds: clone(framingBounds)
  });
}

function createInheritedRenderContract(render) {
  return deepFreeze({
    inheritPackageRender: true,
    sourceRenderSettings: clone(render),
    output: {
      filename: CROWN_DETAIL_QA_OUTPUT_FILENAME,
      mimeType: "image/webp",
      maxBytes: MAX_OUTPUT_BYTES
    }
  });
}

function classifyResolvedCrownGeometry(components) {
  const pairs = [
    ["left", components.leftReturn, components.leftFiller],
    ["right", components.rightReturn, components.rightFiller]
  ];
  const findings = pairs.map(([side, crown, filler]) => {
    const overlap = intersectBounds(crown.blenderWorldBounds, filler.blenderWorldBounds);
    if (!overlap) {
      return null;
    }
    const extentsM = {
      x: roundMetric(overlap.max.x - overlap.min.x),
      y: roundMetric(overlap.max.y - overlap.min.y),
      z: roundMetric(overlap.max.z - overlap.min.z)
    };
    const overlapAabbVolumeM3 = roundMetric(extentsM.x * extentsM.y * extentsM.z);
    if (!(overlapAabbVolumeM3 > 0)) return null;
    const crownBounds = crown.blenderWorldBounds;
    const fillerBounds = filler.blenderWorldBounds;
    const crownFullyContainedByFiller = containsBounds(fillerBounds, crownBounds);
    if (!crownFullyContainedByFiller) {
      fail(
        "INDETERMINATE_CROWN_FILLER_INTERSECTION",
        `${crown.componentId} intersects ${filler.componentId}, but exact profile clipping is not authored by this diagnostic.`
      );
    }
    const normalizedProfileArea = profileOutlineArea(crown.submeshes[0].profileGeometry);
    const crownVolumeM3 = roundMetric(boundsVolume(crownBounds) * normalizedProfileArea);
    if (!(crownVolumeM3 > 0)) {
      fail("DEGENERATE_CROWN_PROFILE_VOLUME", `${crown.componentId} has no positive solid volume.`);
    }
    return {
      findingId: `${side}-crown-return-fitted-filler-overlap`,
      ruleId: CROWN_DETAIL_QA_RULE_IDS.unexpectedSolidIntersection,
      side,
      classification: "GEOMETRY_DEFECT",
      crownComponentId: crown.componentId,
      fillerComponentId: filler.componentId,
      expected: {
        relation: "no-positive-volume-overlap",
        overlapVolumeM3: 0
      },
      actual: {
        relation: "crown-return-fully-contained-by-solid-fitted-filler",
        overlapBounds: overlap,
        overlapExtentsM: extentsM,
        overlapAabbVolumeM3,
        normalizedProfileArea,
        overlapVolumeM3: crownVolumeM3
      }
    };
  }).filter(Boolean);

  return deepFreeze({
    classification: findings.length ? "GEOMETRY_DEFECT" : "NO_GEOMETRY_DEFECT",
    ruleSetVersion: CROWN_DETAIL_QA_CAPTURE_ID,
    authoritativeRuleIds: [
      CROWN_DETAIL_QA_RULE_IDS.exactTopology,
      CROWN_DETAIL_QA_RULE_IDS.crownProfile,
      CROWN_DETAIL_QA_RULE_IDS.crownProfileCatalog,
      CROWN_DETAIL_QA_RULE_IDS.exposedEndReturns,
      CROWN_DETAIL_QA_RULE_IDS.unexpectedSolidIntersection,
      CROWN_DETAIL_QA_RULE_IDS.fittedFillerVolume
    ],
    rules: [
      {
        ruleId: CROWN_DETAIL_QA_RULE_IDS.exactTopology,
        status: "PASS",
        expected: { crownComponentCount: 3, componentIds: [...EXPECTED_CROWN_IDS] },
        actual: { crownComponentCount: 3, componentIds: [...EXPECTED_CROWN_IDS] }
      },
      {
        ruleId: CROWN_DETAIL_QA_RULE_IDS.unexpectedSolidIntersection,
        status: findings.length ? "FAIL" : "PASS",
        expected: { relation: "no-positive-volume-overlap", violationCount: 0 },
        actual: {
          relation: findings.length
            ? "crown-return-fully-contained-by-solid-fitted-filler"
            : "no-positive-volume-overlap",
          violationCount: findings.length
        }
      }
    ],
    findings
  });
}

function profileOutlineArea(profileGeometry) {
  const outline = profileGeometry?.outline;
  if (!Array.isArray(outline) || outline.length < 3) {
    fail("MALFORMED_CROWN_PROFILE", "Crown profile area requires at least three authored outline points.");
  }
  const doubledArea = outline.reduce((sum, point, index) => {
    const next = outline[(index + 1) % outline.length];
    const x = Number(point?.projection);
    const y = Number(point?.height);
    const nextX = Number(next?.projection);
    const nextY = Number(next?.height);
    if (![x, y, nextX, nextY].every(Number.isFinite)) {
      fail("MALFORMED_CROWN_PROFILE", "Crown profile outline values must be finite.");
    }
    return sum + x * nextY - nextX * y;
  }, 0);
  const area = roundMetric(Math.abs(doubledArea) / 2);
  if (!(area > 0 && area <= 1)) {
    fail("DEGENERATE_CROWN_PROFILE", "Crown profile outline must have positive normalized area.");
  }
  return area;
}

function boundsVolume(value) {
  assertFiniteOrderedBounds(value, "volume bounds");
  return AXES.reduce((volume, axis) => volume * (value.max[axis] - value.min[axis]), 1);
}

function containsBounds(outer, inner) {
  assertFiniteOrderedBounds(outer, "outer containment bounds");
  assertFiniteOrderedBounds(inner, "inner containment bounds");
  return AXES.every((axis) => outer.min[axis] <= inner.min[axis] && outer.max[axis] >= inner.max[axis]);
}

function normalizeReportOutput(capture, output) {
  if (!hasExactKeys(output, ["objectKey", "filename", "mimeType", "width", "height", "bytes", "sha256"])) {
    fail("INVALID_CROWN_QA_OUTPUT", "The crown QA output record has unknown or missing fields.");
  }
  const expectedObjectKey = `${capture.captureKey}/${CROWN_DETAIL_QA_OUTPUT_FILENAME}`;
  if (
    output.objectKey !== expectedObjectKey
    || output.filename !== CROWN_DETAIL_QA_OUTPUT_FILENAME
    || output.mimeType !== "image/webp"
    || output.width !== capture.render.sourceRenderSettings.width
    || output.height !== capture.render.sourceRenderSettings.height
    || !Number.isSafeInteger(output.bytes)
    || output.bytes <= 0
    || output.bytes > capture.render.output.maxBytes
    || !/^[a-f0-9]{64}$/.test(String(output.sha256 || ""))
  ) {
    fail("INVALID_CROWN_QA_OUTPUT", "The crown QA output record violates its capture contract.");
  }
  return clone(output);
}

function normalizeBlenderParity(capture, parity) {
  if (!hasExactKeys(parity, [
    "cameraObjectName",
    "camera",
    "targetObjectNames",
    "primaryCameraUnchanged",
    "projectedCornersWithinFrame"
  ])) {
    fail("INVALID_CROWN_QA_BLENDER_PARITY", "Blender parity has unknown or missing fields.");
  }
  if (
    parity.cameraObjectName !== capture.camera.cameraId
    || parity.primaryCameraUnchanged !== true
    || parity.projectedCornersWithinFrame !== true
    || stableStringify(parity.camera) !== stableStringify(capture.camera)
  ) {
    fail("CROWN_QA_BLENDER_PARITY_MISMATCH", "Blender camera parity does not match the diagnostic capture.");
  }
  const expectedNames = capture.target.submeshObjectNames;
  if (
    !Array.isArray(parity.targetObjectNames)
    || new Set(parity.targetObjectNames).size !== parity.targetObjectNames.length
    || stableStringify(parity.targetObjectNames) !== stableStringify(expectedNames)
  ) {
    fail("CROWN_QA_BLENDER_OBJECT_PARITY_MISMATCH", "Blender target object names do not match the capture.");
  }
  return clone(parity);
}

function assertCaptureShape(capture) {
  if (
    !hasExactKeys(capture, [
      "kind",
      "schemaVersion",
      "captureId",
      "primaryRenderKey",
      "pipelineVersion",
      "target",
      "camera",
      "render",
      "captureKey"
    ])
    || capture.kind !== CAPTURE_KIND
    || capture.schemaVersion !== CROWN_DETAIL_QA_CAPTURE_SCHEMA_VERSION
    || capture.captureId !== CROWN_DETAIL_QA_CAPTURE_ID
    || !new RegExp(`^${CAPTURE_KEY_PREFIX}[a-f0-9]{64}$`).test(String(capture.captureKey || ""))
  ) {
    fail("INVALID_CROWN_QA_CAPTURE", "A current strict crown QA capture is required.");
  }
  const core = clone(capture);
  delete core.captureKey;
  if (capture.captureKey !== createCaptureKey(core)) {
    fail("CROWN_QA_CAPTURE_KEY_MISMATCH", "The crown QA capture key does not match its content.");
  }
  assertDetailCameraShape(capture.camera);
}

function assertDetailCameraShape(camera) {
  if (!hasExactKeys(camera, [
    "cameraId",
    "type",
    "lensMm",
    "sensorWidthMm",
    "sensorFit",
    "depthOfField",
    "fitMargin",
    "position",
    "target",
    "up",
    "clipStartM",
    "clipEndM",
    "resolution",
    "framingBounds"
  ])) {
    fail("INVALID_CROWN_QA_CAMERA", "The crown QA camera has unknown or missing fields.");
  }
  assertPoint(camera.position, "camera position");
  assertPoint(camera.target, "camera target");
  assertFiniteOrderedBounds(camera.framingBounds, "camera framing bounds");
  if (
    camera.type !== "PERSP"
    || camera.sensorFit !== "HORIZONTAL"
    || camera.depthOfField !== false
    || camera.fitMargin !== CROWN_DETAIL_QA_FIT_MARGIN
    || camera.cameraId !== CROWN_DETAIL_QA_CAMERA_ID
    || !finitePositive(camera.lensMm)
    || !finitePositive(camera.sensorWidthMm)
    || !finitePositive(camera.clipStartM)
    || !finitePositive(camera.clipEndM)
    || camera.clipEndM <= camera.clipStartM
    || !Array.isArray(camera.up)
    || camera.up.length !== 3
    || camera.up.some((value) => !Number.isFinite(value))
    || !hasExactKeys(camera.resolution, ["width", "height", "pixelAspectX", "pixelAspectY"])
    || camera.resolution.width !== 960
    || camera.resolution.height !== 640
    || camera.resolution.pixelAspectX !== 1
    || camera.resolution.pixelAspectY !== 1
    || !(camera.position.z < camera.target.z)
  ) {
    fail("INVALID_CROWN_QA_CAMERA", "The crown QA camera violates its perspective contract.");
  }
}

function intersectBounds(left, right) {
  assertFiniteOrderedBounds(left, "left intersection bounds");
  assertFiniteOrderedBounds(right, "right intersection bounds");
  const intersection = {
    min: {
      x: Math.max(left.min.x, right.min.x),
      y: Math.max(left.min.y, right.min.y),
      z: Math.max(left.min.z, right.min.z)
    },
    max: {
      x: Math.min(left.max.x, right.max.x),
      y: Math.min(left.max.y, right.max.y),
      z: Math.min(left.max.z, right.max.z)
    }
  };
  if (AXES.some((axis) => intersection.max[axis] <= intersection.min[axis])) return null;
  return normalizeBounds(intersection, "intersection bounds");
}

function normalizeBounds(bounds, label) {
  assertFiniteOrderedBounds(bounds, label);
  return deepFreeze({
    min: roundPoint(bounds.min),
    max: roundPoint(bounds.max)
  });
}

function assertFiniteOrderedBounds(bounds, label) {
  if (!hasExactKeys(bounds, ["min", "max"])) fail("INVALID_CROWN_QA_BOUNDS", `${label} has an invalid shape.`);
  assertPoint(bounds.min, `${label}.min`);
  assertPoint(bounds.max, `${label}.max`);
  if (AXES.some((axis) => bounds.max[axis] <= bounds.min[axis])) {
    fail("INVALID_CROWN_QA_BOUNDS", `${label} must be finite and strictly ordered.`);
  }
}

function assertPoint(point, label) {
  if (!hasExactKeys(point, AXES) || AXES.some((axis) => !Number.isFinite(point[axis]))) {
    fail("INVALID_CROWN_QA_POINT", `${label} must contain exactly finite x, y, and z values.`);
  }
}

function boundsCenter(bounds) {
  return roundPoint({
    x: (bounds.min.x + bounds.max.x) / 2,
    y: (bounds.min.y + bounds.max.y) / 2,
    z: (bounds.min.z + bounds.max.z) / 2
  });
}

function boundsCorners(bounds) {
  return [bounds.min.x, bounds.max.x].flatMap((x) => (
    [bounds.min.y, bounds.max.y].flatMap((y) => (
      [bounds.min.z, bounds.max.z].map((z) => ({ x, y, z }))
    ))
  ));
}

function createCaptureKey(captureCore) {
  return `${CAPTURE_KEY_PREFIX}${createHash("sha256").update(stableStringify(captureCore)).digest("hex")}`;
}

function vectorFromArray(value) {
  if (!Array.isArray(value) || value.length !== 3 || value.some((entry) => !Number.isFinite(entry))) {
    fail("INVALID_CROWN_QA_VECTOR", "The crown camera view vector is invalid.");
  }
  return { x: value[0], y: value[1], z: value[2] };
}

function subtract(left, right) {
  return { x: left.x - right.x, y: left.y - right.y, z: left.z - right.z };
}

function pointAdd(left, right) {
  return { x: left.x + right.x, y: left.y + right.y, z: left.z + right.z };
}

function scale(value, scalar) {
  return { x: value.x * scalar, y: value.y * scalar, z: value.z * scalar };
}

function dot(left, right) {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function cross(left, right) {
  const rightVector = Array.isArray(right) ? vectorFromArray(right) : right;
  return {
    x: left.y * rightVector.z - left.z * rightVector.y,
    y: left.z * rightVector.x - left.x * rightVector.z,
    z: left.x * rightVector.y - left.y * rightVector.x
  };
}

function normalize(value, label) {
  const magnitude = Math.hypot(value.x, value.y, value.z);
  if (!Number.isFinite(magnitude) || magnitude <= 1e-12) {
    fail("INVALID_CROWN_QA_VECTOR", `${label} is degenerate.`);
  }
  return scale(value, 1 / magnitude);
}

function roundPoint(point) {
  return {
    x: roundMetric(point.x),
    y: roundMetric(point.y),
    z: roundMetric(point.z)
  };
}

function roundMetric(value) {
  const rounded = Math.round(value * 1e12) / 1e12;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function dimensions(width, height) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) {
    fail("INVALID_CROWN_QA_WEBP_DIMENSIONS", "crown-detail.webp dimensions are invalid.");
  }
  return deepFreeze({ width, height });
}

function finitePositive(value) {
  return Number.isFinite(value) && value > 0;
}

function assertUnchanged(value, serialized, code, message) {
  if (stableStringify(value) !== serialized) fail(code, message);
}

function hasExactKeys(value, expectedKeys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  const serialized = JSON.stringify(value);
  if (serialized === undefined) fail("INVALID_CROWN_QA_JSON", "Crown QA values must be finite JSON.");
  return serialized;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function issue(code, message) {
  return Object.freeze({ code, severity: "error", message });
}

function fail(code, message, details = []) {
  throw new CrownQaContractError(code, message, details);
}
