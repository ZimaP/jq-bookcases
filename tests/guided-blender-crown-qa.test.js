import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  CROWN_DETAIL_QA_CAMERA_ID,
  CROWN_DETAIL_QA_CAPTURE_ID,
  CROWN_DETAIL_QA_FIT_MARGIN,
  CROWN_DETAIL_QA_OUTPUT_FILENAME,
  CROWN_DETAIL_QA_RULE_IDS,
  CrownQaContractError,
  classifyCrownGeometry,
  createCrownDetailQaCapture,
  createCrownDetailQaReport,
  projectCrownDetailFramingCorners,
  validateCrownDetailQaCapture,
  validateCrownDetailQaReport,
  verifyCrownDetailWebpIntegrity
} from "../tools/blender/crown-qa-contract.mjs";
import {
  EXPECTED_DRAWING_4_RENDER_KEY,
  createVerifiedClayRenderPackage
} from "../tools/blender/run-clay-worker.mjs";

const EXPECTED_CAPTURE_KEY = "jq-crown-detail-qa-v1-7c79dd65dcbdf941301eee6fde8f56e05679caede2102a96e91db2e2683a7ba6";
const EXPECTED_CROWN_IDS = [
  "guided-installation-main/crown-slim-cap",
  "guided-installation-main/crown-slim-cap-left-return",
  "guided-installation-main/crown-slim-cap-right-return"
];
const EXPECTED_FOCUS_IDS = [
  "guided-installation-main/crown-slim-cap",
  "guided-installation-main/crown-slim-cap-right-return"
];
const EXPECTED_OBJECT_NAMES = [
  "guided-installation-main/crown-slim-cap-left-return::profile-extrusion",
  "guided-installation-main/crown-slim-cap-right-return::profile-extrusion",
  "guided-installation-main/crown-slim-cap::profile-extrusion"
];

let generatedPackagePromise;

function getGeneratedPackage() {
  generatedPackagePromise ||= createVerifiedClayRenderPackage();
  return generatedPackagePromise;
}

test("crown detail capture is deterministic, content-addressed, and independent of the primary key", async () => {
  const firstPackage = await getGeneratedPackage();
  const repeatedPackage = await createVerifiedClayRenderPackage();
  const first = await createCrownDetailQaCapture(firstPackage.renderPackage);
  const repeated = await createCrownDetailQaCapture(repeatedPackage.renderPackage);

  assert.deepEqual(repeated, first);
  assert.equal(first.captureId, CROWN_DETAIL_QA_CAPTURE_ID);
  assert.equal(first.captureKey, EXPECTED_CAPTURE_KEY);
  assert.match(first.captureKey, /^jq-crown-detail-qa-v1-[a-f0-9]{64}$/);
  assert.equal(first.primaryRenderKey, EXPECTED_DRAWING_4_RENDER_KEY);
  assert.notEqual(first.captureKey, first.primaryRenderKey);
  assert.deepEqual(first.target.componentIds, EXPECTED_CROWN_IDS);
  assert.deepEqual(first.target.submeshObjectNames, EXPECTED_OBJECT_NAMES);
  assert.deepEqual(first.target.focusComponentIds, EXPECTED_FOCUS_IDS);
  assert.equal(first.render.output.filename, CROWN_DETAIL_QA_OUTPUT_FILENAME);
});

test("crown detail capture frames the deterministic right-front corner from below", async () => {
  const { renderPackage } = await getGeneratedPackage();
  const capture = await createCrownDetailQaCapture(renderPackage);

  assert.deepEqual(capture.target.crownBounds, {
    min: { x: -1.49225, y: 0.00635, z: 2.40792 },
    max: { x: 1.49225, y: 0.365125, z: 2.4384 }
  });
  assert.deepEqual(capture.target.framingBounds, {
    min: { x: 1.143, y: 0.00635, z: 2.40792 },
    max: { x: 1.49225, y: 0.365125, z: 2.4384 }
  });
  assert.equal(capture.camera.cameraId, CROWN_DETAIL_QA_CAMERA_ID);
  assert.equal(capture.camera.position.z < capture.camera.target.z, true);
  assert.deepEqual(capture.camera.position, {
    x: 1.672575203881,
    y: 0.895637907763,
    z: 2.068209796119
  });
  assert.deepEqual(capture.camera.target, {
    x: 1.317625,
    y: 0.1857375,
    z: 2.42316
  });
  assert.equal(capture.camera.lensMm, renderPackage.camera.lensMm);
  assert.equal(capture.camera.sensorWidthMm, renderPackage.camera.sensorWidthMm);
  assert.equal(capture.camera.clipStartM, renderPackage.camera.clipStartM);
  assert.equal(capture.camera.clipEndM, renderPackage.camera.clipEndM);
  assert.deepEqual(capture.camera.resolution, {
    width: 960,
    height: 640,
    pixelAspectX: 1,
    pixelAspectY: 1
  });
});

test("all right-corner framing corners project inside the 1.2 fit margin", async () => {
  const { renderPackage } = await getGeneratedPackage();
  const capture = await createCrownDetailQaCapture(renderPackage);
  const projections = projectCrownDetailFramingCorners(capture.camera);
  const normalizedLimit = 1 / CROWN_DETAIL_QA_FIT_MARGIN;

  assert.equal(projections.length, 8);
  assert.ok(projections.some((corner) => Math.abs(corner.normalizedX) > 0.8));
  for (const corner of projections) {
    assert.ok(Math.abs(corner.normalizedX) <= normalizedLimit + 1e-12, corner.normalizedX);
    assert.ok(Math.abs(corner.normalizedY) <= normalizedLimit + 1e-12, corner.normalizedY);
    assert.ok(corner.depthM > capture.camera.clipStartM);
    assert.ok(corner.depthM < capture.camera.clipEndM);
  }
});

test("capture derivation preserves the authoritative primary camera and render key byte-for-byte", async () => {
  const { renderPackage } = await getGeneratedPackage();
  const primaryCamera = structuredClone(renderPackage.camera);
  const primaryRenderKey = renderPackage.renderKey;
  const packageJson = JSON.stringify(renderPackage);

  const capture = await createCrownDetailQaCapture(renderPackage);

  assert.deepEqual(renderPackage.camera, primaryCamera);
  assert.equal(renderPackage.renderKey, primaryRenderKey);
  assert.equal(JSON.stringify(renderPackage), packageJson);
  assert.deepEqual(capture.render.sourceRenderSettings, renderPackage.render);
  assert.notStrictEqual(capture.render.sourceRenderSettings, renderPackage.render);
  assert.equal(capture.render.inheritPackageRender, true);
});

test("the accepted customer camera remains the exact Drawing 4 baseline", async () => {
  const { renderPackage } = await getGeneratedPackage();
  assert.deepEqual(renderPackage.camera, {
    cameraVersion: "hero-front-v1",
    type: "PERSP",
    lensMm: 50,
    sensorWidthMm: 36,
    sensorFit: "HORIZONTAL",
    depthOfField: false,
    fitMargin: 1.14,
    position: { x: 0, y: 6.1722, z: 1.2192 },
    target: { x: 0, y: 0.1905, z: 1.2192 },
    up: [0, 0, 1],
    clipStartM: 0.05,
    clipEndM: 25,
    framingBounds: {
      min: { x: -1.524, y: 0, z: 0 },
      max: { x: 1.524, y: 0.381, z: 2.4383999999999997 }
    }
  });
  const capture = await createCrownDetailQaCapture(renderPackage);
  assert.notEqual(capture.camera.cameraId, renderPackage.camera.cameraVersion);
  assert.equal(Object.hasOwn(capture, "primaryCamera"), false);
  assert.equal(capture.primaryRenderKey, renderPackage.renderKey);
});

test("Small Crown front run and returns retain exact identities, profile, hosts, and measurements", async () => {
  const { renderPackage } = await getGeneratedPackage();
  const crowns = renderPackage.components.filter((component) => component.role === "crown");
  assert.deepEqual(crowns.map((component) => component.componentId), EXPECTED_CROWN_IDS);
  assert.deepEqual(crowns.map((component) => component.parentId), [
    "guided-installation-main/bookcase",
    "guided-installation-main/bookcase",
    "guided-installation-main/bookcase"
  ]);
  assert.deepEqual(crowns.map((component) => component.hostId), [
    "guided-installation-main/top-panel",
    "guided-installation-main/left-side-panel",
    "guided-installation-main/right-side-panel"
  ]);
  assert.deepEqual(crowns.map((component) => component.submeshes[0].submeshId), [
    "profile-extrusion",
    "profile-extrusion",
    "profile-extrusion"
  ]);
  for (const crown of crowns) {
    assert.equal(crown.geometryVariant, "crown_profile_extrusion");
    assert.equal(crown.submeshes[0].geometry, "crown_profile_extrusion");
    assert.equal(crown.submeshes[0].profileGeometry.profileId, "slim_beveled_cap");
    assert.equal(crown.submeshes[0].profileGeometry.contour, "beveled_cap");
    assert.deepEqual(crown.submeshes[0].profileGeometry.outline, [
      { height: 0, projection: 0 },
      { height: 1, projection: 0 },
      { height: 1, projection: 1 },
      { height: 0.82, projection: 0.9 },
      { height: 0.4, projection: 0.55 },
      { height: 0, projection: 0.3 }
    ]);
  }
  assert.deepEqual(sourceDimensions(crowns[0].sourceWorldBounds), {
    width: 117.5,
    height: 1.2,
    depth: 0.375
  });
  assert.deepEqual(sourceDimensions(crowns[1].sourceWorldBounds), {
    width: 0.25,
    height: 1.2,
    depth: 13.75
  });
  assert.deepEqual(sourceDimensions(crowns[2].sourceWorldBounds), {
    width: 0.25,
    height: 1.2,
    depth: 13.75
  });
});

test("Small Crown returns are mirrored, inside the fitted envelope, and contact their authored hosts and ceiling", async () => {
  const { renderPackage } = await getGeneratedPackage();
  const byId = new Map(renderPackage.components.map((component) => [component.componentId, component]));
  const front = byId.get(EXPECTED_CROWN_IDS[0]);
  const left = byId.get(EXPECTED_CROWN_IDS[1]);
  const right = byId.get(EXPECTED_CROWN_IDS[2]);
  const leftFiller = byId.get("guided-installation-main/installation-treatment-left-filler");
  const rightFiller = byId.get("guided-installation-main/installation-treatment-right-filler");
  assert.ok(front && left && right && leftFiller && rightFiller);

  assert.deepEqual(left.sourceWorldBounds, {
    min: { x: -58.75, y: 94.8, z: -14 },
    max: { x: -58.5, y: 96, z: -0.25 }
  });
  assert.deepEqual(right.sourceWorldBounds, {
    min: { x: 58.5, y: 94.8, z: -14 },
    max: { x: 58.75, y: 96, z: -0.25 }
  });
  assert.equal(left.sourceWorldBounds.min.x, -right.sourceWorldBounds.max.x);
  assert.equal(left.sourceWorldBounds.max.x, -right.sourceWorldBounds.min.x);
  assert.deepEqual(
    { minY: left.sourceWorldBounds.min.y, maxY: left.sourceWorldBounds.max.y, minZ: left.sourceWorldBounds.min.z, maxZ: left.sourceWorldBounds.max.z },
    { minY: right.sourceWorldBounds.min.y, maxY: right.sourceWorldBounds.max.y, minZ: right.sourceWorldBounds.min.z, maxZ: right.sourceWorldBounds.max.z }
  );
  assert.equal(left.submeshes[0].profileGeometry.crossSection.projectionDirection, -1);
  assert.equal(right.submeshes[0].profileGeometry.crossSection.projectionDirection, 1);
  assert.equal(left.sourceWorldBounds.max.x, -58.5);
  assert.equal(right.sourceWorldBounds.min.x, 58.5);
  assert.equal(front.sourceWorldBounds.max.z, -14);
  assert.equal(front.sourceWorldBounds.max.y, renderPackage.room.ceilingHeightIn);
  assert.equal(left.sourceWorldBounds.max.y, renderPackage.room.ceilingHeightIn);
  assert.equal(right.sourceWorldBounds.max.y, renderPackage.room.ceilingHeightIn);

  for (const crown of [front, left, right]) {
    assert.equal(contains(renderPackage.camera.framingBounds, crown.blenderWorldBounds), true);
  }
  assert.equal(contains(leftFiller.sourceWorldBounds, left.sourceWorldBounds), true);
  assert.equal(contains(rightFiller.sourceWorldBounds, right.sourceWorldBounds), true);
});

test("strict crown capture validation rejects unknown fields and key drift", async (t) => {
  const { renderPackage } = await getGeneratedPackage();
  const capture = await createCrownDetailQaCapture(renderPackage);
  assert.equal((await validateCrownDetailQaCapture(renderPackage, capture)).valid, true);

  await t.test("unknown target key", async () => {
    const candidate = structuredClone(capture);
    candidate.target.reframe = true;
    const validation = await validateCrownDetailQaCapture(renderPackage, candidate);
    assert.equal(validation.valid, false);
    assert.ok(validation.errors.some((error) => error.code === "CROWN_QA_CAPTURE_MISMATCH"));
  });

  await t.test("capture key drift", async () => {
    const candidate = structuredClone(capture);
    candidate.captureKey = candidate.captureKey.replace(/.$/, "0");
    const validation = await validateCrownDetailQaCapture(renderPackage, candidate);
    assert.equal(validation.valid, false);
    assert.ok(validation.errors.some((error) => error.code === "CROWN_QA_CAPTURE_MISMATCH"));
  });
});

test("crown QA fails closed on malformed, duplicate, and unsupported source geometry", async (t) => {
  const { renderPackage } = await getGeneratedPackage();
  const cases = [
    ["malformed crown profile", (candidate) => {
      const crown = candidate.components.find((component) => component.role === "crown");
      crown.submeshes[0].profileGeometry.outline = [{ height: 0, projection: 0 }];
    }],
    ["duplicate component ID", (candidate) => {
      candidate.components[1].componentId = candidate.components[0].componentId;
    }],
    ["unsupported primitive", (candidate) => {
      const crown = candidate.components.find((component) => component.role === "crown");
      crown.submeshes[0].geometry = "invented_crown";
    }]
  ];

  for (const [label, mutate] of cases) {
    await t.test(label, async () => {
      const candidate = structuredClone(renderPackage);
      mutate(candidate);
      await assert.rejects(
        createCrownDetailQaCapture(candidate),
        (error) => error instanceof CrownQaContractError && error.code === "UNVERIFIED_CROWN_QA_PACKAGE"
      );
    });
  }
});

test("baseline return/filler intersections are classified as an authoritative GEOMETRY_DEFECT", async () => {
  const { renderPackage } = await getGeneratedPackage();
  const classification = await classifyCrownGeometry(renderPackage);

  assert.equal(classification.classification, "GEOMETRY_DEFECT");
  assert.deepEqual(classification.authoritativeRuleIds, [
    CROWN_DETAIL_QA_RULE_IDS.exactTopology,
    CROWN_DETAIL_QA_RULE_IDS.crownProfile,
    CROWN_DETAIL_QA_RULE_IDS.crownProfileCatalog,
    CROWN_DETAIL_QA_RULE_IDS.exposedEndReturns,
    CROWN_DETAIL_QA_RULE_IDS.unexpectedSolidIntersection,
    CROWN_DETAIL_QA_RULE_IDS.fittedFillerVolume
  ]);
  assert.equal(classification.findings.length, 2);
  for (const finding of classification.findings) {
    assert.equal(finding.ruleId, CROWN_DETAIL_QA_RULE_IDS.unexpectedSolidIntersection);
    assert.deepEqual(finding.expected, {
      relation: "no-positive-volume-overlap",
      overlapVolumeM3: 0
    });
    assert.equal(finding.actual.relation, "crown-return-fully-contained-by-solid-fitted-filler");
    assert.deepEqual(finding.actual.overlapExtentsM, {
      x: 0.00635,
      y: 0.34925,
      z: 0.03048
    });
    assert.equal(finding.actual.overlapAabbVolumeM3, 0.000067596639);
    assert.equal(finding.actual.normalizedProfileArea, 0.6455);
    assert.equal(finding.actual.overlapVolumeM3, 0.00004363363);
  }
});

test("diagnostic reports accept strict Blender parity and verify detail WebP integrity", async (t) => {
  const { renderPackage } = await getGeneratedPackage();
  const capture = await createCrownDetailQaCapture(renderPackage);
  const webp = createVp8xWebp(960, 640);
  const output = {
    objectKey: `${capture.captureKey}/${CROWN_DETAIL_QA_OUTPUT_FILENAME}`,
    filename: CROWN_DETAIL_QA_OUTPUT_FILENAME,
    mimeType: "image/webp",
    width: 960,
    height: 640,
    bytes: webp.length,
    sha256: createHash("sha256").update(webp).digest("hex")
  };
  const blenderParity = {
    cameraObjectName: capture.camera.cameraId,
    camera: structuredClone(capture.camera),
    targetObjectNames: [...capture.target.submeshObjectNames],
    primaryCameraUnchanged: true,
    projectedCornersWithinFrame: true
  };
  const report = await createCrownDetailQaReport(renderPackage, capture, {
    output,
    blenderParity
  });

  assert.equal(report.classification.classification, "GEOMETRY_DEFECT");
  assert.equal((await validateCrownDetailQaReport(renderPackage, capture, report)).valid, true);
  assert.deepEqual(
    await verifyCrownDetailWebpIntegrity(renderPackage, capture, report, webp),
    { valid: true, filename: CROWN_DETAIL_QA_OUTPUT_FILENAME, width: 960, height: 640, bytes: webp.length, sha256: output.sha256 }
  );

  await t.test("unknown report field", async () => {
    const candidate = structuredClone(report);
    candidate.notes = "not contracted";
    const validation = await validateCrownDetailQaReport(renderPackage, capture, candidate);
    assert.equal(validation.valid, false);
    assert.ok(validation.errors.some((error) => error.code === "INVALID_CROWN_QA_REPORT_SHAPE"));
  });

  await t.test("byte/hash mismatch", async () => {
    const changed = Buffer.from(webp);
    changed[20] = 1;
    await assert.rejects(
      verifyCrownDetailWebpIntegrity(renderPackage, capture, report, changed),
      (error) => error instanceof CrownQaContractError && error.code === "CROWN_QA_OUTPUT_INTEGRITY_MISMATCH"
    );
  });
});

function createVp8xWebp(width, height) {
  const bytes = Buffer.alloc(30);
  bytes.write("RIFF", 0, "ascii");
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write("WEBP", 8, "ascii");
  bytes.write("VP8X", 12, "ascii");
  bytes.writeUInt32LE(10, 16);
  bytes.writeUIntLE(width - 1, 24, 3);
  bytes.writeUIntLE(height - 1, 27, 3);
  return bytes;
}

function sourceDimensions(bounds) {
  return {
    width: rounded(bounds.max.x - bounds.min.x),
    height: rounded(bounds.max.y - bounds.min.y),
    depth: rounded(bounds.max.z - bounds.min.z)
  };
}

function contains(outer, inner) {
  return ["x", "y", "z"].every((axis) => (
    outer.min[axis] <= inner.min[axis] && outer.max[axis] >= inner.max[axis]
  ));
}

function rounded(value) {
  return Math.round(value * 1e9) / 1e9;
}
