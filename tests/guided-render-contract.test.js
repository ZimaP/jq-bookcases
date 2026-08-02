import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  auditGuidedAcceptedSpecification,
  createGuidedSceneDescriptors,
  transformGuidedBoundsToWorld,
  transformGuidedPointToWorld,
  validateGuidedRenderedManifest
} from "../guided-render-contract.js";
import { evaluateGuidedProjectCandidate } from "../guided-project-engine.js";

const goldenProjects = JSON.parse(readFileSync(
  new URL("../config/golden-projects.json", import.meta.url),
  "utf8"
)).projects;

const box = (minX, maxX, minY, maxY, minZ, maxZ) => ({
  min: { x: minX, y: minY, z: minZ },
  max: { x: maxX, y: maxY, z: maxZ }
});

const fitTreatmentMetadata = ({ id, position, kind, value, axis, localBounds, worldBounds }) => ({
  physical: true,
  installationTreatment: {
    schemaVersion: 1,
    source: "accepted-installation-fit",
    id,
    position,
    kind,
    selection: position === "base" ? "flush-base" : position === "top" ? "small-crown" : null,
    boundaryKind: ["left", "right"].includes(position) ? "wall" : null,
    primary: true,
    solvedDimension: { axis, value },
    solvedLocalBounds: localBounds,
    solvedWorldBounds: worldBounds
  }
});

const leftFillerLocal = box(-48, -46.5, 0, 96, 0, 14);
const rightFillerLocal = box(46.5, 48, 0, 96, 0, 14);
const baseLocal = box(-46.5, 46.5, 0, 4, 0, 14);
const topLocal = box(-46.5, 46.5, 95.25, 96, 0, 14);
const toWorld = (bounds) => box(
  bounds.min.x,
  bounds.max.x,
  bounds.min.y,
  bounds.max.y,
  bounds.min.z - 14,
  bounds.max.z - 14
);

const accepted = {
  accepted: true,
  fit: {
    accepted: true,
    installations: [{
      id: "installation-main",
      zoneId: "main",
      mode: "fitted",
      zoneBounds: { left: -48, right: 48, bottom: 0, top: 96, back: 0, front: -14 },
      casework: { width: 93, bodyHeight: 91.25, overallHeight: 96, depth: 14 },
      treatments: {
        left: {
          id: "installation-main-left-treatment",
          kind: "filler",
          width: 1.5,
          bounds: toWorld(leftFillerLocal)
        },
        right: {
          id: "installation-main-right-treatment",
          kind: "filler",
          width: 1.5,
          bounds: toWorld(rightFillerLocal)
        },
        base: {
          id: "installation-main-base-treatment",
          kind: "built-in-base",
          height: 4,
          bounds: toWorld(baseLocal)
        },
        top: {
          id: "installation-main-top-treatment",
          kind: "scribe-or-crown",
          height: 0.75,
          bounds: toWorld(topLocal)
        }
      },
      anchors: { floorY: 0, bottomY: 0, backZ: 0, frontZ: -14, centerX: 0 },
      orientation: {
        origin: { x: 0, y: 0, z: 0 },
        widthAxis: [1, 0, 0],
        heightAxis: [0, 1, 0],
        depthAxis: [0, 0, -1]
      },
      invariants: { rootScale: [1, 1, 1] }
    }]
  },
  product: {
    pricingStatus: "available",
    descriptorSets: [{
      id: "set-main",
      installationId: "installation-main",
      zoneId: "main",
      rootScale: [1, 1, 1],
      nominalDepth: 14,
      transform: { translation: [0, 0, -14], basis: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] },
      bounds: { min: { x: -48, y: 0, z: 0 }, max: { x: 48, y: 96, z: 14 } },
      components: [{
        id: "set-main-door-01",
        role: "door",
        bounds: { min: { x: -20, y: 4, z: 0 }, max: { x: 0, y: 34, z: 0.75 } }
      }, {
        id: "set-main-left-filler",
        role: "filler",
        bounds: leftFillerLocal,
        metadata: fitTreatmentMetadata({
          id: "installation-main-left-treatment",
          position: "left",
          kind: "filler",
          value: 1.5,
          axis: "x",
          localBounds: leftFillerLocal,
          worldBounds: toWorld(leftFillerLocal)
        })
      }, {
        id: "set-main-right-filler",
        role: "filler",
        bounds: rightFillerLocal,
        metadata: fitTreatmentMetadata({
          id: "installation-main-right-treatment",
          position: "right",
          kind: "filler",
          value: 1.5,
          axis: "x",
          localBounds: rightFillerLocal,
          worldBounds: toWorld(rightFillerLocal)
        })
      }, {
        id: "set-main-base",
        role: "base",
        bounds: baseLocal,
        metadata: fitTreatmentMetadata({
          id: "installation-main-base-treatment",
          position: "base",
          kind: "built-in-base",
          value: 4,
          axis: "y",
          localBounds: baseLocal,
          worldBounds: toWorld(baseLocal)
        })
      }, {
        id: "set-main-crown",
        role: "crown",
        bounds: topLocal,
        metadata: fitTreatmentMetadata({
          id: "installation-main-top-treatment",
          position: "top",
          kind: "scribe-or-crown",
          value: 0.75,
          axis: "y",
          localBounds: topLocal,
          worldBounds: toWorld(topLocal)
        })
      }]
    }]
  }
};

test("accepted descriptor graph passes boundary and unit-scale audit", () => {
  const audit = auditGuidedAcceptedSpecification(accepted);
  assert.equal(audit.valid, true, JSON.stringify(audit.errors));
  assert.equal(audit.physicalComponentCount, 5);
  assert.equal(createGuidedSceneDescriptors(accepted)[0].materialSlot, "front");
});

test("fireplace, window, door, and radiator goldens pass runtime topology exclusion auditing", () => {
  const ids = ["G05-fireplace", "G06-window-storage", "G07-door-wall", "G11-radiator"];
  for (const id of ids) {
    const project = goldenProjects.find((candidate) => candidate.id === id);
    const specification = evaluateGuidedProjectCandidate(project);
    assert.equal(
      specification.accepted,
      true,
      `${id}: ${specification.stage || "unknown"} ${JSON.stringify(specification.errors || [])}`
    );
    const boundaryIssues = specification.audit.errors.filter((error) => (
      error.code === "DESCRIPTOR_OUTSIDE_INSTALLATION_ZONE"
      || error.code === "DESCRIPTOR_INTERSECTS_EXCLUSION_VOLUME"
    ));
    assert.deepEqual(boundaryIssues, [], `${id} failed runtime topology auditing`);
  }
});

test("runtime topology audit rejects synthetic exclusion overlap and out-of-zone descriptors", () => {
  const overlapping = structuredClone(accepted);
  overlapping.room = {
    accepted: true,
    installationZones: [{
      id: "main",
      leftPlaneX: -48,
      rightPlaneX: 48,
      bottomPlaneY: 0,
      topPlaneY: 96,
      backPlaneZ: 0,
      orientation: {
        origin: { x: -48, y: 0, z: 0 },
        widthAxis: [1, 0, 0],
        heightAxis: [0, 1, 0],
        depthAxis: [0, 0, -1],
        widthCoordinateAtOrigin: -48
      }
    }],
    exclusionVolumes: [{
      id: "synthetic-door-swing-exclusion",
      featureId: "synthetic-door",
      kind: "service",
      bounds: box(-10, -2, 6, 30, -14, -13.5)
    }]
  };

  const overlapAudit = auditGuidedAcceptedSpecification(overlapping);
  assert.equal(overlapAudit.valid, false);
  assert.ok(overlapAudit.errors.some((error) => (
    error.code === "DESCRIPTOR_INTERSECTS_EXCLUSION_VOLUME"
    && error.componentId === "set-main-door-01"
    && error.exclusionVolumeId === "synthetic-door-swing-exclusion"
    && error.featureId === "synthetic-door"
  )));

  const escaped = structuredClone(overlapping);
  escaped.room.exclusionVolumes = [];
  escaped.room.installationZones[0].leftPlaneX = -40;
  escaped.room.installationZones[0].rightPlaneX = 40;
  escaped.room.installationZones[0].orientation.origin.x = -40;
  escaped.room.installationZones[0].orientation.widthCoordinateAtOrigin = -40;
  const zoneAudit = auditGuidedAcceptedSpecification(escaped);
  assert.equal(zoneAudit.valid, false);
  assert.ok(zoneAudit.errors.some((error) => (
    error.code === "DESCRIPTOR_OUTSIDE_INSTALLATION_ZONE"
    && error.zoneId === "main"
  )));
});

test("straight-wall local front and rear land on the solved depth and wall planes", () => {
  const transform = accepted.product.descriptorSets[0].transform;
  assert.deepEqual(
    transformGuidedPointToWorld({ x: 0, y: 0, z: 0 }, transform),
    { x: 0, y: 0, z: -14 }
  );
  assert.deepEqual(
    transformGuidedPointToWorld({ x: 0, y: 0, z: 14 }, transform),
    { x: 0, y: 0, z: 0 }
  );
  assert.deepEqual(
    transformGuidedBoundsToWorld(accepted.product.descriptorSets[0].bounds, transform),
    { min: { x: -48, y: 0, z: -14 }, max: { x: 48, y: 96, z: 0 } }
  );
});

test("world-space floor auditing rejects a descriptor root lifted above the fitted floor", () => {
  const lifted = structuredClone(accepted);
  lifted.product.descriptorSets[0].transform.translation[1] = 2;
  const audit = auditGuidedAcceptedSpecification(lifted);
  assert.equal(audit.valid, false);
  assert.deepEqual(audit.errors.map((error) => error.code), ["BASE_NOT_ON_FLOOR"]);
});

test("feature-supported fitted work anchors to its accepted bottom instead of the room floor", () => {
  const supported = structuredClone(accepted);
  const installation = supported.fit.installations[0];
  installation.zoneBounds.bottom = 48;
  installation.zoneBounds.top = 144;
  installation.anchors.bottomY = 48;
  supported.product.descriptorSets[0].transform.translation[1] = 48;

  const audit = auditGuidedAcceptedSpecification(supported);
  assert.equal(audit.valid, true, JSON.stringify(audit.errors));

  supported.product.descriptorSets[0].transform.translation[1] = 46;
  const detached = auditGuidedAcceptedSpecification(supported);
  assert.equal(detached.valid, false);
  assert.ok(detached.errors.some((error) => error.code === "BASE_NOT_ON_ACCEPTED_SUPPORT"));
});

test("exact fit-envelope contracts audit both physical and visible descriptor bounds", () => {
  const radiator = structuredClone(accepted);
  const installation = radiator.fit.installations[0];
  installation.casework.width = 96;
  installation.treatments = {
    left: { kind: "none", width: 0 },
    right: { kind: "none", width: 0 },
    base: { kind: "none", height: 0 },
    top: { kind: "none", height: 0 }
  };
  const set = radiator.product.descriptorSets[0];
  set.physicalBounds = box(-48, 48, 0, 96, 0, 14);
  set.components = [{
    id: "set-main-radiator-cover",
    role: "assembly",
    bounds: box(-48, 48, 0, 96, 0, 14),
    metadata: {
      renderable: false,
      physical: false,
      fitEnvelopeContract: "accepted-fit-exact"
    }
  }, {
    id: "set-main-radiator-left-end",
    role: "end_panel",
    bounds: box(-48, -47.25, 0, 96, 0, 14)
  }, {
    id: "set-main-radiator-right-end",
    role: "end_panel",
    bounds: box(47.25, 48, 0, 96, 0, 14)
  }, {
    id: "set-main-radiator-service-envelope",
    role: "service_zone",
    bounds: box(-26, 26, 0, 28, 3, 14),
    metadata: { renderable: false, physical: false }
  }];

  assert.equal(auditGuidedAcceptedSpecification(radiator).valid, true);

  const physicalMismatch = structuredClone(radiator);
  physicalMismatch.product.descriptorSets[0].physicalBounds.max.x = 47;
  assert.ok(auditGuidedAcceptedSpecification(physicalMismatch).errors.some((error) => (
    error.code === "PHYSICAL_DESCRIPTOR_FIT_DIMENSION_MISMATCH"
  )));

  const visibleMismatch = structuredClone(radiator);
  visibleMismatch.product.descriptorSets[0].components[2].bounds.max.x = 47;
  assert.ok(auditGuidedAcceptedSpecification(visibleMismatch).errors.some((error) => (
    error.code === "VISIBLE_DESCRIPTOR_FIT_DIMENSION_MISMATCH"
  )));

  const escapedService = structuredClone(radiator);
  escapedService.product.descriptorSets[0].components[3].bounds.max.x = 49;
  assert.ok(auditGuidedAcceptedSpecification(escapedService).errors.some((error) => (
    error.code === "DESCRIPTOR_COMPONENT_OUTSIDE_FIT_ENVELOPE"
  )));
});

test("a rotated Corner Wall return maps descriptor width along the return and depth back to its wall", () => {
  const corner = structuredClone(accepted);
  corner.fit.installations[0] = {
    id: "installation-return-run",
    zoneId: "return-run",
    mode: "fitted",
    zoneBounds: { left: 0, right: 40, bottom: 0, top: 96, back: 0, front: -13 },
    casework: { width: 40, bodyHeight: 91.25, overallHeight: 96, depth: 13 },
    treatments: { left: { width: 0 }, right: { width: 0 } },
    anchors: { floorY: 0, bottomY: 0, backZ: 0, frontZ: -13, centerX: 20 },
    orientation: {
      origin: { x: 60, y: 0, z: 0 },
      widthAxis: [0, 0, -1],
      heightAxis: [0, 1, 0],
      depthAxis: [-1, 0, 0]
    },
    invariants: { rootScale: [1, 1, 1] }
  };
  corner.product.descriptorSets[0] = {
    id: "set-return-run",
    installationId: "installation-return-run",
    zoneId: "return-run",
    rootScale: [1, 1, 1],
    nominalDepth: 13,
    // Translation is local front-center-bottom. Topology depthAxis points out
    // from the wall, so local rearward Z is its negation.
    transform: {
      translation: { x: 47, y: 0, z: -36 },
      basis: {
        x: { x: 0, y: 0, z: -1 },
        y: { x: 0, y: 1, z: 0 },
        z: { x: 1, y: 0, z: 0 }
      }
    },
    bounds: { min: { x: -20, y: 0, z: 0 }, max: { x: 20, y: 96, z: 13 } },
    components: [{
      id: "set-return-run-door-01",
      role: "door",
      bounds: { min: { x: -20, y: 4, z: 0 }, max: { x: 20, y: 34, z: 0.75 } }
    }]
  };

  const audit = auditGuidedAcceptedSpecification(corner);
  assert.equal(audit.valid, true, JSON.stringify(audit.errors));
  const transform = corner.product.descriptorSets[0].transform;
  assert.deepEqual(
    transformGuidedPointToWorld({ x: 0, y: 0, z: 0 }, transform),
    { x: 47, y: 0, z: -36 },
    "front stays 13 inches out from the x=60 return wall"
  );
  assert.deepEqual(
    transformGuidedPointToWorld({ x: 0, y: 0, z: 13 }, transform),
    { x: 60, y: 0, z: -36 },
    "local rear lands on the rotated return wall"
  );
  assert.deepEqual(
    transformGuidedBoundsToWorld(corner.product.descriptorSets[0].bounds, transform),
    { min: { x: 47, y: 0, z: -56 }, max: { x: 60, y: 96, z: -16 } }
  );

  const localWidthEndpoints = [
    transformGuidedPointToWorld({ x: -20, y: 0, z: 0 }, transform),
    transformGuidedPointToWorld({ x: 20, y: 0, z: 0 }, transform)
  ];
  assert.equal(Math.hypot(
    localWidthEndpoints[1].x - localWidthEndpoints[0].x,
    localWidthEndpoints[1].y - localWidthEndpoints[0].y,
    localWidthEndpoints[1].z - localWidthEndpoints[0].z
  ), 40, "the rigid transform preserves the 40-inch descriptor width");
});

test("wall anchoring rejects a rigid Corner Wall transform translated off its return plane", () => {
  const invalid = structuredClone(accepted);
  invalid.fit.installations[0].orientation = {
    origin: { x: 60, y: 0, z: 0 },
    widthAxis: [0, 0, -1],
    heightAxis: [0, 1, 0],
    depthAxis: [-1, 0, 0]
  };
  invalid.product.descriptorSets[0].transform = {
    translation: [36, 0, -13],
    basis: [[0, 0, -1], [0, 1, 0], [1, 0, 0]]
  };
  const audit = auditGuidedAcceptedSpecification(invalid);
  assert.equal(audit.valid, false);
  assert.deepEqual(
    audit.errors.map((error) => error.code),
    ["FRONT_PLANE_ANCHOR_MISMATCH", "BACK_NOT_ON_WALL"]
  );
});

test("descriptor transforms cannot hide dimensional changes in a scaled or skewed basis", () => {
  const scaled = structuredClone(accepted);
  scaled.product.descriptorSets[0].transform.basis[0] = [1.25, 0, 0];
  const scaledAudit = auditGuidedAcceptedSpecification(scaled);
  assert.equal(scaledAudit.valid, false);
  assert.equal(scaledAudit.errors[0].code, "INVALID_DESCRIPTOR_TRANSFORM");

  const skewed = structuredClone(accepted);
  skewed.product.descriptorSets[0].transform.basis[2] = [0.1, 0, 1];
  const skewedAudit = auditGuidedAcceptedSpecification(skewed);
  assert.equal(skewedAudit.valid, false);
  assert.equal(skewedAudit.errors[0].code, "INVALID_DESCRIPTOR_TRANSFORM");
});

test("root scaling and detached components fail closed with named diagnostics", () => {
  const invalid = structuredClone(accepted);
  invalid.product.descriptorSets[0].rootScale = [0.8, 1, 1];
  invalid.product.descriptorSets[0].components[0].bounds.max.x = 60;
  const audit = auditGuidedAcceptedSpecification(invalid);
  assert.equal(audit.valid, false);
  assert.deepEqual(
    audit.errors.map((error) => error.code),
    ["ROOT_SCALE_MUTATION", "COMPONENT_OUTSIDE_DESCRIPTOR_SET"]
  );
});

test("render manifest parity rejects missing or duplicated accepted components", () => {
  const complete = createGuidedSceneDescriptors(accepted).map(({ componentId }) => ({ componentId, meshCount: 1 }));
  assert.equal(validateGuidedRenderedManifest(accepted, complete).valid, true);
  const missing = validateGuidedRenderedManifest(accepted, []);
  assert.equal(missing.valid, false);
  assert.equal(missing.issues[0].code, "MISSING_RENDER_COMPONENT");
});

test("installation treatment audit rejects fit metadata without a rendered filler descriptor", () => {
  const missingFiller = structuredClone(accepted);
  missingFiller.product.descriptorSets[0].components = missingFiller.product.descriptorSets[0].components
    .filter((component) => component.id !== "set-main-left-filler");
  const audit = auditGuidedAcceptedSpecification(missingFiller);
  assert.equal(audit.valid, false);
  assert.ok(audit.errors.some((error) => (
    error.code === "MISSING_INSTALLATION_TREATMENT_DESCRIPTOR"
    && error.treatmentPosition === "left"
  )));
});

test("installation treatment audit rejects a finished end that consumes its open-edge clearance", () => {
  const openEdge = structuredClone(accepted);
  const installation = openEdge.fit.installations[0];
  installation.treatments.left = {
    id: "installation-main-left-treatment",
    kind: "finished-end",
    width: 1.25,
    endPanelThickness: 0.75,
    designClearance: 0.5,
    bounds: toWorld(box(-47.75, -46.5, 0, 96, 0, 14))
  };
  const left = openEdge.product.descriptorSets[0].components.find((component) => component.id === "set-main-left-filler");
  left.role = "end_panel";
  left.bounds = box(-47.75, -46.5, 0, 96, 0, 14);
  left.metadata.installationTreatment.kind = "finished-end";
  left.metadata.installationTreatment.solvedDimension.value = 0.75;
  left.metadata.installationTreatment.solvedLocalBounds = box(-47.25, -46.5, 0, 96, 0, 14);
  left.metadata.installationTreatment.solvedWorldBounds = installation.treatments.left.bounds;

  const audit = auditGuidedAcceptedSpecification(openEdge);
  assert.equal(audit.valid, false);
  assert.ok(audit.errors.some((error) => error.code === "INSTALLATION_TREATMENT_PHYSICAL_BOUNDS_MISMATCH"));
});
