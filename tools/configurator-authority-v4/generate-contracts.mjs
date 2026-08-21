import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  AUTHORITY_ITEMS,
  AUTHORITY_STATUSES,
  FIELDS,
  LAYOUTS,
  PENDING_ITEMS,
  STEPS,
  UI_COPY,
  V4_PROOF,
  authorityItem
} from "./authority-contract.js";
import { V4_VISUAL_CONTRACT } from "./visual-contract.js";

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(toolDir, "../..");
const checkOnly = process.argv.includes("--check");

const outputPaths = Object.freeze({
  authority: "config/configurator-authority-v4-four-step.json",
  coverage: "config/configurator-authority-v4-four-step-coverage.json",
  feasibility: "config/configurator-authority-v4-four-step-control-feasibility.json",
  visualRoles: "config/configurator-authority-v4-visual-roles.json",
  presentation: "config/configurator-authority-v4-presentation.json",
  modifiedEdges: "config/configurator-authority-v4-modified-edges.json",
  protectedEdges: "config/configurator-authority-v4-protected-edges.json",
  interaction: "config/configurator-authority-v4-four-step-interaction.json",
  provenance: "config/configurator-authority-v4-four-step-provenance.json"
});

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return Object.is(value, -0) ? 0 : value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function serialized(value) {
  return `${JSON.stringify(stable(value), null, 2)}\n`;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function fileIdentity(relativePath) {
  const bytes = await readFile(path.join(root, relativePath));
  return { path: relativePath, bytes: bytes.length, sha256: sha256(bytes) };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validateAuthority() {
  assert(AUTHORITY_STATUSES.length === 6, "Authority status registry is incomplete.");
  assert(new Set(AUTHORITY_ITEMS.map(({ id }) => id)).size === AUTHORITY_ITEMS.length, "Authority IDs must be unique.");
  assert(new Set(FIELDS.map(({ id }) => id)).size === FIELDS.length, "Field IDs must be unique.");
  assert(LAYOUTS.map(({ id }) => id).join("|") === "fireplace-wall|door-wall|window-wall", "Exactly three approved layouts are required.");
  assert(STEPS.map(({ label }) => label).join("|") === "Choose Product|Choose Layout|Customization|Review & Details", "Journey order differs from the current owner correction.");
  for (const entry of AUTHORITY_ITEMS) {
    assert(AUTHORITY_STATUSES.includes(entry.authorityStatus), `${entry.id} has an invalid authority status.`);
    assert(entry.source?.type && entry.source?.date && entry.source?.reference && entry.testId, `${entry.id} lacks source/date/test traceability.`);
    assert(entry.customerVisibility && entry.liveModelFeasibility && entry.persistence, `${entry.id} lacks required contract fields.`);
    if (entry.customerVisibility.interactive) {
      assert(["customer-live", "conditional", "review-only"].includes(entry.authorityStatus), `${entry.id} is interactive without authority.`);
    }
    if (entry.authorityStatus === "pending-authority") {
      assert(!entry.customerVisibility.interactive && entry.pendingDecision, `${entry.id} pending state must be noninteractive and explicit.`);
    }
  }
  for (const field of FIELDS) {
    const authority = authorityItem(field.authorityId);
    assert(authority, `${field.id} references missing ${field.authorityId}.`);
    assert(authority.customerVisibility.interactive, `${field.id} references noninteractive authority.`);
    assert(field.layouts.every((layoutId) => LAYOUTS.some(({ id }) => id === layoutId)), `${field.id} has an unknown layout.`);
    if (field.type === "number") {
      assert(Number.isFinite(field.min) && Number.isFinite(field.max) && field.min <= field.max, `${field.id} has no safe range.`);
      assert(Number.isFinite(field.step) && field.step > 0, `${field.id} has no positive step.`);
      assert(field.defaultValue === null || Math.abs((field.defaultValue - field.min) / field.step - Math.round((field.defaultValue - field.min) / field.step)) <= 1e-8, `${field.id} default is not step-aligned.`);
      assert(authority.authoritativeDefaultSource && authority.authoritativeRangeSource, `${field.id} lacks default/range sources.`);
    } else {
      assert(field.values.some(({ value }) => value === field.defaultValue), `${field.id} radio default is outside its approved values.`);
    }
  }
  const tv = authorityItem("JQ-CONFIG-TV-OPENING-001");
  assert(tv.applicableLayouts.length === 0 && tv.applicableStyles.length === 0, "TV opening must not claim applicability to a registered non-TV layout/style.");
  assert(new Set(UI_COPY.map(({ id }) => id)).size === UI_COPY.length, "UI copy IDs must be unique.");
  assert(UI_COPY.every((entry) => authorityItem(entry.authorityId) && entry.selector), "UI copy must have exact authority and selector linkage.");
  assert(!FIELDS.some(({ id, label }) => /shelf.*(space|spacing|clearance)/i.test(`${id} ${label}`)), "Customer shelf spacing leaked into V4 fields.");
  assert(!AUTHORITY_ITEMS.some((entry) => entry.customerVisibility.interactive && /finish|lighting|crown|hardware|door choices/i.test(entry.label)), "Pending catalog decision became interactive.");
  assert(PENDING_ITEMS.every((id) => authorityItem(id)?.authorityStatus === "pending-authority"), "Pending registry contains a non-pending item.");
}

const OPENING_DETAIL_STABLE_IDS = new Set([
  "scene:0/nodes:0/1/291/292/298/299/mesh:119/primitive:0",
  "scene:0/nodes:0/1/421/422/427/428/mesh:176/primitive:0"
]);

function classifyRecord(record) {
  const names = record.observedNamePath.filter(Boolean).join(" / ");
  const zone = record.zone;
  if (["wall-room-shell", "ceiling-room-shell"].includes(zone)) return { role: "room-shell", reason: "Exact audited room-shell zone; protected material/geometry." };
  if (["floor", "floor-room-shell"].includes(zone)) return { role: "floor", reason: "Exact audited floor zone; protected material/geometry, shadow receiver only." };
  if (zone === "fire-emissive-surface") return { role: "fireplace", reason: "Exact audited fire surface; protected source material and geometry." };
  if (zone === "fireplace-appliance-frame") return { role: "architectural-opening", reason: "Exact audited fireplace frame; shared proof-only neutral context response while geometry stays protected." };
  if (["architectural-interior-door", "architectural-window-frame"].includes(zone)) {
    const detail = OPENING_DETAIL_STABLE_IDS.has(record.stablePrimitiveId);
    return {
      role: detail ? "architectural-opening-detail" : "architectural-opening",
      reason: detail
        ? "Exact audited inner door/window primitive; shared proof-only neutral detail response while geometry stays protected."
        : "Exact audited outer door/window primitive; shared proof-only neutral context response corrects source-normal lighting artifacts while geometry stays protected."
    };
  }
  if (zone === "architectural-door-hardware") return { role: "architectural-hardware", reason: "Exact audited architectural door hardware; protected source surface." };
  if (zone === "architectural-glazing") return { role: "architectural-glazing", reason: "Exact audited glazing zone; protected transparency/source surface." };
  if (["support-hardware", "adjustable-support-hardware"].includes(zone)) return { role: "support-hardware", reason: "Exact audited construction-hardware zone; not customer hardware." };
  if (["knob-hardware", "pull-hardware"].includes(zone)) return { role: "hardware", reason: "Exact audited visible cabinet hardware zone." };
  if (/Toe\s*Kick|ToeSkins|Front Toe/i.test(names) || zone === "toe-skin-millwork") return { role: "toe-base", reason: "Exact stable path names the toe/base assembly." };
  if (/Wood Top/i.test(names)) return { role: "countertop", reason: "Exact stable path names the separate Wood Top assembly." };
  if (/Wall Filler|\/ BF1 \/|\/ Stile \/.*Geom3D_Stile/i.test(names)) return { role: "filler-end", reason: "Exact stable path names Wall Filler/BF1 stile geometry." };
  if (/Adjustable Shelf/i.test(names)) return { role: "shelf", reason: "Exact stable path names shelf geometry; visual role only, never a customer spacing control." };
  if (/UBack|Nailer|Drw Back/i.test(names)) return { role: "back", reason: "Exact stable path names a back/nailer surface." };
  if (/Door_H|Door Panel|Door [LRTB][R ]|Drw (Panel|TR|BR|L Stile|R Stile)/i.test(names)) return { role: "door-detail", reason: "Exact stable path names cabinet door/drawer face components." };
  if (/Wall (Hutch|Open Cabinet).*\/ TR \//i.test(names)) return { role: "top-rail", reason: "Exact stable path names an upper rail; it is not relabeled as crown/fascia." };
  if (["cabinet-interior-millwork", "drawer-box-millwork"].includes(zone)) return { role: "interior", reason: "Exact audited cabinet-interior/drawer-box zone." };
  if (["millwork", "painted-millwork"].includes(zone)) return { role: "frame-stile", reason: "Remaining exact audited exterior millwork role." };
  return { role: "protected-unclassified", reason: "No V4-authorized diagnostic mapping; source material and geometry remain protected." };
}

async function buildRoleMap() {
  const audit = JSON.parse(await readFile(path.join(root, "config/immersive-layout-material-zones-v1.json"), "utf8"));
  const layouts = audit.layouts.map((layout) => {
    const records = layout.records.map((record) => ({
      stablePrimitiveId: record.stablePrimitiveId,
      nodeIndex: record.nodeIndex,
      meshIndex: record.meshIndex,
      primitiveIndex: record.primitiveIndex,
      sourceMaterialIndex: record.sourceMaterialIndex,
      sourceAccessors: record.sourceAccessors,
      worldBounds: record.worldBounds,
      originalZone: record.zone,
      ...classifyRecord(record)
    }));
    const roleCounts = Object.fromEntries([...new Set(records.map(({ role }) => role))].sort().map((role) => [role, records.filter((entry) => entry.role === role).length]));
    return {
      layoutId: layout.layoutId,
      source: layout.source,
      primitiveCount: records.length,
      roleCounts,
      exactStableIdentityCoverage: records.length === layout.summary.primitiveRecords,
      records
    };
  });
  return {
    schema: "jq-configurator-authority-v4-visual-roles-v1",
    derivation: "accepted material-zone stable primitive ID plus exact audited path/zone classifier; names never identify a primitive without the stable ID/accessor proof",
    authority: "proof-only visual QA; not customer finish authority",
    layouts
  };
}

function coverageRecord(elementType, id, label, authorityId, details = {}) {
  const authority = authorityItem(authorityId);
  return {
    elementType, id, label, authorityId,
    source: authority?.source || null,
    status: authority?.authorityStatus || "orphan",
    defaultSource: authority?.authoritativeDefaultSource || null,
    rangeSource: authority?.authoritativeRangeSource || null,
    ...details
  };
}

function buildCoverage() {
  const visible = [
    ...UI_COPY.map((entry) => coverageRecord("registered-copy", entry.id, entry.label, entry.authorityId, { selector: entry.selector, match: entry.match })),
    ...STEPS.map((step) => coverageRecord("step", step.id, step.label, step.authorityId, {
      route: `#step-${step.number}`,
      acceptedBaseline: step.number !== 3,
      v4Owned: step.number === 3,
      summary: step.summary
    })),
    ...LAYOUTS.map((layout) => coverageRecord("layout-choice", layout.id, layout.label, layout.authorityId, { value: layout.id, description: layout.description, statusLabel: "Live model" })),
    ...FIELDS.map((field) => coverageRecord("field", field.id, field.label, field.authorityId, {
      stepId: field.stepId, type: field.type, unit: field.unit || null, defaultValue: field.defaultValue,
      range: field.type === "number" ? { min: field.min, max: field.max, step: field.step } : null,
      options: field.values || null, layouts: field.layouts,
      renderedCopy: field.type === "number" ? {
        unitLabel: "in",
        resetLabel: "Reset",
        resetAccessibleName: `Reset ${field.label} to approved default`,
        help: `${field.min}–${field.max} in · approved default ${field.defaultValue ?? "not set"}${field.defaultValue === null ? "" : " in"} · model unchanged`,
        validation: `Enter ${field.min}–${field.max} in, in ${field.step}-in increments.`
      } : {
        note: "Saved for design review; the fixed proof model does not switch base construction.",
        resetLabel: `Reset to ${field.values.find(({ value }) => value === field.defaultValue)?.label || field.defaultValue}`,
        resetAccessibleName: `Reset ${field.label} to approved default`
      }
    })),
    ...FIELDS.filter(({ type }) => type === "radio").flatMap((field) => field.values.map((option) => coverageRecord("option", `${field.id}:${option.value}`, option.label, field.authorityId, { value: option.value }))),
    ...PENDING_ITEMS.map((id) => {
      const authority = authorityItem(id);
      return coverageRecord("pending-row", id, authority.label, id, { interactive: false, pendingDecision: authority.pendingDecision, statusLabel: "Pending" });
    }),
    coverageRecord("dynamic-copy", "viewer-authority-instructions", "Accepted viewer keyboard/orbit instructions and source-authority status", "JQ-UX-MODEL-NAV-001", { sourceRenderer: "guided-layout-viewer.js", runtimeAudit: true }),
    coverageRecord("dynamic-copy", "saved-project-resume", "Customer project name · approved layout · accepted four-step route", "JQ-UX-LOCAL-PROJECT-001", { runtimeAudit: true })
  ];
  const inventoryKeys = visible.map(({ elementType, id }) => `${elementType}:${id}`);
  const orphans = visible.filter(({ source, status }) => !source || status === "orphan");
  const dispositions = AUTHORITY_ITEMS.map((entry) => ({
    authorityId: entry.id,
    authorityStatus: entry.authorityStatus,
    implementationStatus: entry.implementationStatus,
    customerVisibility: entry.customerVisibility,
    uiReferences: visible.filter(({ authorityId }) => authorityId === entry.id).map(({ elementType, id }) => ({ elementType, id })),
    blocker: entry.blocker,
    pendingDecision: entry.pendingDecision
  }));
  return {
    schema: "jq-configurator-authority-v4-four-step-coverage-v1",
    scope: "The accepted four-step application route: Steps 1, 2 and 4 remain accepted-baseline UI/state behavior; V4 owns only Step 3 Customization labels, fields/options/defaults/ranges/errors, model controls/status and pending review states. The accepted site header/menu and local save/resume dialogs remain baseline behavior.",
    method: {
      registry: "The correction contract inventories baseline Step 1/2/4 routes and the V4-owned Step 3 surface. V4 fields, options and pending rows are generated from the authority-contract exports.",
      runtimeAudit: "Focused Chromium traverses every route/layout and verifies exact baseline behavior outside Step 3, then checks every V4-owned visible semantic element against its cited authority item.",
      testId: "V4-AUTH-VISIBLE-DOM-001"
    },
    renderedInventory: visible,
    authorityDispositions: dispositions,
    assertions: {
      everyVisibleElementHasAuthority: orphans.length === 0,
      orphanVisibleElements: orphans,
      everyRegisteredCopyHasSelector: UI_COPY.every(({ selector }) => Boolean(selector)),
      registeredCopyIdsUnique: new Set(UI_COPY.map(({ id }) => id)).size === UI_COPY.length,
      generatedInventoryKeysUnique: new Set(inventoryKeys).size === inventoryKeys.length,
      registeredCopyCount: UI_COPY.length,
      everyAuthorityItemDisposed: dispositions.length === AUTHORITY_ITEMS.length,
      noInteractivePendingAuthority: !AUTHORITY_ITEMS.some((entry) => entry.authorityStatus === "pending-authority" && entry.customerVisibility.interactive),
      noCustomerShelfSpacingField: !FIELDS.some(({ id, label }) => /shelf.*(space|spacing|clearance)/i.test(`${id} ${label}`)),
      noUnapprovedFinishOption: !visible.some(({ elementType, label }) => elementType === "option" && /oak|white|ivory|sage|charcoal|walnut|primed/i.test(label)),
      requiredAuthorityWasNotSubstituted: AUTHORITY_ITEMS.every((entry) => entry.implementationStatus !== "implemented" || entry.authorityStatus !== "blocked-by-asset")
    }
  };
}

const LAYOUT_RELEVANT_NODE_GROUPS = Object.freeze({
  "fireplace-wall": Object.freeze({
    "room-shell": Object.freeze([8, 11, 14, 17, 20, 23, 26, 454]),
    "lower-cabinet": Object.freeze([27, 84, 158, 232]),
    "overhead-bookcase": Object.freeze([289, 322, 364, 400]),
    fillers: Object.freeze([141, 144, 215, 218, 355, 358, 361, 397, 433, 436]),
    countertop: Object.freeze([147, 221]),
    "fireplace-opening": Object.freeze([439, 442]),
    "toe-base": Object.freeze([444]),
    floor: Object.freeze([451])
  }),
  "door-wall": Object.freeze({
    "room-shell": Object.freeze([8, 10, 12, 316]),
    "lower-cabinet": Object.freeze([30, 174]),
    "overhead-bookcase": Object.freeze([121, 149]),
    fillers: Object.freeze([27, 282, 285, 288]),
    countertop: Object.freeze([98]),
    "architectural-opening": Object.freeze([291, 295, 297, 299, 301]),
    "toe-base": Object.freeze([146, 148, 265, 267, 304, 306, 308, 310]),
    floor: Object.freeze([313])
  }),
  "window-wall": Object.freeze({
    "room-shell": Object.freeze([8, 10, 12, 441]),
    "lower-cabinet": Object.freeze([13, 82, 151, 275]),
    "overhead-bookcase": Object.freeze([238, 359, 398]),
    fillers: Object.freeze([263, 266, 269]),
    countertop: Object.freeze([]),
    "architectural-opening": Object.freeze([421, 426, 428, 430]),
    "toe-base": Object.freeze([395, 397, 433, 435]),
    floor: Object.freeze([438])
  })
});

const allLayoutGroups = (...groups) => Object.freeze(Object.fromEntries(LAYOUTS.map(({ id }) => [id, Object.freeze(groups)])));
const geometryEvidence = (geometryExists, classification, evidence, nodeGroups = {}, primitiveRoles = []) => Object.freeze({
  geometryExists,
  classification,
  evidence,
  nodeGroups: Object.freeze(nodeGroups),
  primitiveRoles: Object.freeze(primitiveRoles)
});

// This is deliberately exhaustive and explicit. Never infer geometry existence from
// prose such as an affected-region label: "unmapped" and "not represented" are
// evidence of absence, not geometry.
const CONTROL_GEOMETRY_EVIDENCE = Object.freeze({
  "JQ-UX-JOURNEY-001": geometryEvidence(false, "not-applicable", "Journey navigation is UI architecture; it requests no product geometry."),
  "JQ-UX-MODEL-NAV-001": geometryEvidence(false, "not-applicable", "Camera controls operate the viewer camera, not product geometry."),
  "JQ-UX-LOCAL-PROJECT-001": geometryEvidence(false, "not-applicable", "Local serialization requests no product geometry."),
  "JQ-UX-SITE-NAV-001": geometryEvidence(false, "not-applicable", "Accepted site navigation requests no product geometry."),
  "JQ-STYLE-LAYOUT-001": geometryEvidence(true, "registered-assets-exist", "Three exact SHA-registered immutable GLBs exist; switching loads one complete asset."),
  "JQ-ROOM-WIDTH-001": geometryEvidence(true, "fixed-source-geometry-exists", "Room-shell geometry exists in every asset, but has no audited width transform contract.", allLayoutGroups("room-shell"), ["room-shell"]),
  "JQ-ROOM-HEIGHT-001": geometryEvidence(true, "fixed-source-geometry-exists", "Room-shell and ceiling geometry exists in every asset, but has no audited height transform contract.", allLayoutGroups("room-shell"), ["room-shell"]),
  "JQ-ROOM-DEPTH-001": geometryEvidence(true, "fixed-source-geometry-exists", "Room shell and cabinet depth planes exist, but no protected front/back transform contract exists.", allLayoutGroups("room-shell", "lower-cabinet", "overhead-bookcase"), ["room-shell", "frame-stile", "shelf", "back"]),
  "JQ-ROOM-FIREPLACE-OPENING-001": geometryEvidence(true, "fixed-source-geometry-exists", "The fireplace assembly/frame exists only in the Fireplace GLB and is protected from resizing.", { "fireplace-wall": ["fireplace-opening"] }, ["architectural-opening", "fireplace"]),
  "JQ-ROOM-FIREPLACE-SIDE-WIDTHS-001": geometryEvidence(true, "fixed-source-geometry-exists", "Left/right cabinetry, fillers, fireplace and room spans exist, but no audited span/repetition contract exists.", { "fireplace-wall": ["room-shell", "lower-cabinet", "overhead-bookcase", "fillers", "fireplace-opening"] }, ["frame-stile", "filler-end", "shelf", "back"]),
  "JQ-ROOM-DOOR-OPENING-001": geometryEvidence(true, "fixed-source-geometry-exists", "The architectural door/frame/hardware exists only in the Door GLB and is protected from resizing or offset transforms.", { "door-wall": ["architectural-opening"] }, ["architectural-opening", "architectural-opening-detail", "architectural-hardware"]),
  "JQ-ROOM-WINDOW-OPENING-001": geometryEvidence(true, "fixed-source-geometry-exists", "The architectural window/frame/glazing exists only in the Window GLB and is protected from resizing or offset transforms.", { "window-wall": ["architectural-opening"] }, ["architectural-opening", "architectural-opening-detail", "architectural-glazing"]),
  "JQ-CONFIG-TV-OPENING-001": geometryEvidence(false, "authorized-region-missing", "No approved TV-containing style or TV-opening node exists in any registered Cabinets + Shelves GLB."),
  "JQ-CONFIG-LOWER-HEIGHT-001": geometryEvidence(true, "fixed-source-geometry-exists", "Fixed lower-cabinet assemblies exist in every GLB; coordinated doors/rails/backs/ends/tops/hardware transforms are unaudited.", allLayoutGroups("lower-cabinet", "countertop", "toe-base"), ["door-detail", "frame-stile", "back", "countertop", "toe-base", "hardware"]),
  "JQ-CONFIG-LOWER-DEPTH-001": geometryEvidence(true, "fixed-source-geometry-exists", "Fixed lower front/back/shelf/top planes exist in every GLB; no protected-plane depth contract exists.", allLayoutGroups("lower-cabinet", "countertop"), ["door-detail", "frame-stile", "back", "shelf", "countertop"]),
  "JQ-CONFIG-OVERHEAD-DEPTH-001": geometryEvidence(true, "fixed-source-geometry-exists", "Fixed overhead shelves/supports/backs/ends exist in every GLB; no coordinated depth transform exists.", allLayoutGroups("overhead-bookcase"), ["shelf", "back", "frame-stile", "top-rail"]),
  "JQ-CONFIG-TOE-KICK-HEIGHT-001": geometryEvidence(true, "fixed-source-geometry-exists", "Fixed toe-kick/skin geometry exists in every GLB; no coordinated carcass-elevation contract exists.", allLayoutGroups("toe-base"), ["toe-base"]),
  "JQ-CONFIG-TOP-FASCIA-HEIGHT-001": geometryEvidence(false, "authorized-region-missing", "No semantically authorized Fascia node exists; top rails cannot be relabeled as fascia."),
  "JQ-CONFIG-BASE-TYPE-001": geometryEvidence(true, "fixed-source-geometry-exists", "Each GLB contains one fixed toe/base construction, but no flush/recessed variant group or visibility contract.", allLayoutGroups("toe-base"), ["toe-base"]),
  "JQ-CONFIG-RECESSED-BASE-HEIGHT-001": geometryEvidence(false, "independent-region-missing", "Recessed-base height is not independently represented by an audited node or primitive group."),
  "JQ-FINISH-PAINT-001": geometryEvidence(true, "fixed-source-geometry-exists", "Cabinet surfaces exist, but exact approved paint colors/SKUs and all-layout customer material ownership do not.", allLayoutGroups("lower-cabinet", "overhead-bookcase", "fillers", "countertop", "toe-base"), ["door-detail", "frame-stile", "filler-end", "shelf", "back", "countertop", "top-rail", "toe-base"]),
  "JQ-FINISH-WHITE-OAK-001": geometryEvidence(true, "fixed-source-geometry-exists", "Cabinet surfaces exist, but no approved white-oak product/appearance or all-layout customer material ownership exists.", allLayoutGroups("lower-cabinet", "overhead-bookcase", "fillers", "countertop", "toe-base"), ["door-detail", "frame-stile", "filler-end", "shelf", "back", "countertop", "top-rail", "toe-base"]),
  "JQ-FINISH-WALNUT-001": geometryEvidence(true, "fixed-source-geometry-exists", "Cabinet surfaces exist, but no approved walnut product/appearance or all-layout customer material ownership exists.", allLayoutGroups("lower-cabinet", "overhead-bookcase", "fillers", "countertop", "toe-base"), ["door-detail", "frame-stile", "filler-end", "shelf", "back", "countertop", "top-rail", "toe-base"]),
  "JQ-FINISH-SHOP-PRIMED-001": geometryEvidence(true, "fixed-source-geometry-exists", "Cabinet surfaces exist, but the offering/specification and all-layout customer material ownership are unapproved.", allLayoutGroups("lower-cabinet", "overhead-bookcase", "fillers", "countertop", "toe-base"), ["door-detail", "frame-stile", "filler-end", "shelf", "back", "countertop", "top-rail", "toe-base"]),
  "JQ-DOOR-CATALOG-001": geometryEvidence(true, "fixed-source-geometry-exists", "Fixed cabinet-door geometry exists; no approved variant groups or exact limited catalog exists.", allLayoutGroups("lower-cabinet"), ["door-detail"]),
  "JQ-DYKES-CROWN-CATALOG-001": geometryEvidence(false, "authorized-region-missing", "No approved Dykes profile geometry or authorized crown mapping exists in the three GLBs."),
  "JQ-HARDWARE-CATALOG-001": geometryEvidence(true, "fixed-source-geometry-exists", "Fixed cabinet hardware primitives exist, but no approved selectable catalog or variant visibility contract exists.", {}, ["hardware"]),
  "JQ-LIGHTING-SYSTEM-001": geometryEvidence(false, "authorized-system-missing", "No selected cabinet-lighting system or authorized lighting nodes exist in the three GLBs.")
});

async function buildFeasibility(visualRoles) {
  const candidates = AUTHORITY_ITEMS.filter((entry) => entry.customerVisibility.visible || entry.liveModelFeasibility.status === "blocked");
  assert(Object.keys(CONTROL_GEOMETRY_EVIDENCE).length === candidates.length, "Control geometry evidence registry size differs from feasibility controls.");
  assert(candidates.every(({ id }) => CONTROL_GEOMETRY_EVIDENCE[id]), "A feasibility control lacks explicit geometry evidence.");
  assert(Object.keys(CONTROL_GEOMETRY_EVIDENCE).every((id) => candidates.some((entry) => entry.id === id)), "Geometry evidence contains an unreported control.");

  const modelAudit = JSON.parse(await readFile(path.join(root, "config/immersive-layout-model-audit-v1.json"), "utf8"));
  const materialAudit = JSON.parse(await readFile(path.join(root, "config/immersive-layout-material-zones-v1.json"), "utf8"));
  const layoutGeometryInventory = modelAudit.layouts.map((layout) => {
    const layoutContract = LAYOUTS.find(({ id }) => id === layout.layoutId);
    const roleLayout = visualRoles.layouts.find(({ layoutId }) => layoutId === layout.layoutId);
    const materialLayout = materialAudit.layouts.find(({ layoutId }) => layoutId === layout.layoutId);
    const nodeByIndex = new Map(layout.nodeHierarchy.map((node) => [node.nodeIndex, node]));
    const relevantNodeGroups = Object.entries(LAYOUT_RELEVANT_NODE_GROUPS[layout.layoutId]).map(([groupId, nodeIndices]) => ({
      groupId,
      nodes: nodeIndices.map((nodeIndex) => {
        const node = nodeByIndex.get(nodeIndex);
        assert(node, `${layout.layoutId}/${groupId} references absent node ${nodeIndex}.`);
        return {
          nodeIndex,
          name: node.name,
          meshIndex: node.meshIndex,
          nodeIndexPath: node.nodeIndexPath,
          observedNamePath: node.observedNamePath,
          authoredTransform: node.authoredTransform
        };
      })
    }));
    return {
      layoutId: layout.layoutId,
      authoritativeAsset: layout.authoritativeSource,
      registeredIdentity: {
        bytes: layoutContract.bytes,
        sha256: layoutContract.sha256,
        sourceContractFingerprint: layoutContract.sourceContractFingerprint,
        geometryFingerprint: layoutContract.geometryFingerprint,
        nativeBounds: layoutContract.nativeBounds,
        nativeDegenerateTriangles: layoutContract.nativeDegenerateTriangles
      },
      completeCounts: layout.gltf.counts,
      materialAuthority: materialLayout.summary,
      relevantNodeGroups,
      completePrimitiveMaterialInventory: roleLayout.records.map((record) => ({
        stablePrimitiveId: record.stablePrimitiveId,
        nodeIndex: record.nodeIndex,
        meshIndex: record.meshIndex,
        primitiveIndex: record.primitiveIndex,
        sourceMaterialIndex: record.sourceMaterialIndex,
        sourceAccessors: record.sourceAccessors,
        originalZone: record.originalZone,
        v4ProofRole: record.role,
        worldBounds: record.worldBounds
      }))
    };
  });

  for (const [authorityId, evidence] of Object.entries(CONTROL_GEOMETRY_EVIDENCE)) {
    for (const [layoutId, groupIds] of Object.entries(evidence.nodeGroups)) {
      const groups = LAYOUT_RELEVANT_NODE_GROUPS[layoutId];
      assert(groups, `${authorityId} references unknown layout inventory ${layoutId}.`);
      assert(groupIds.every((groupId) => Object.hasOwn(groups, groupId)), `${authorityId} references an unknown node group for ${layoutId}.`);
    }
  }
  for (const authorityId of ["JQ-CONFIG-TV-OPENING-001", "JQ-CONFIG-TOP-FASCIA-HEIGHT-001", "JQ-CONFIG-RECESSED-BASE-HEIGHT-001", "JQ-DYKES-CROWN-CATALOG-001", "JQ-LIGHTING-SYSTEM-001"]) {
    assert(CONTROL_GEOMETRY_EVIDENCE[authorityId].geometryExists === false, `${authorityId} must not claim nonexistent or unauthorized geometry.`);
  }

  return {
    schema: "jq-configurator-authority-v4-control-feasibility-v1",
    source: "accepted registry, model audit, material-zone audit and two independent read-only V4 audits",
    conclusion: "Only exact registered layout selection is customer-live. Numeric customer inputs persist for design review and do not deform the immutable GLBs.",
    inventorySources: [
      "config/immersive-layout-model-audit-v1.json",
      "config/immersive-layout-material-zones-v1.json",
      "config/configurator-authority-v4-visual-roles.json",
      "guided-layout-registry.js"
    ],
    layoutGeometryInventory,
    controls: candidates.map((entry) => {
      const geometry = CONTROL_GEOMETRY_EVIDENCE[entry.id];
      return ({
      authorityId: entry.id,
      label: entry.label,
      status: entry.authorityStatus,
      applicableLayouts: entry.applicableLayouts,
      geometryExists: geometry.geometryExists,
      geometryClassification: geometry.classification,
      geometryEvidence: geometry.evidence,
      relevantNodeGroups: geometry.nodeGroups,
      relevantPrimitiveRoles: geometry.primitiveRoles,
      completeInventoryLocation: "layoutGeometryInventory[].completePrimitiveMaterialInventory",
      ownership: entry.modelRegion,
      safeTransformOrDerivation: entry.id === "JQ-STYLE-LAYOUT-001" ? "load exact SHA-registered immutable GLB" : "none",
      defaultSource: entry.authoritativeDefaultSource,
      rangeSource: entry.authoritativeRangeSource,
      protectedReferences: ["native world bounds", "root pivots/transforms", "opening geometry", "room shell", "floor", "fireplace/architectural door/window", "accepted stable accessor bindings"],
      expectedVisiblePixelRegion: entry.id === "JQ-STYLE-LAYOUT-001" ? "whole model changes to selected registered layout" : "none; review-only input intentionally does not claim a live model result",
      deterministicTest: entry.id === "JQ-STYLE-LAYOUT-001" ? "asset SHA/layout diagnostics change exactly once" : "model SHA, transforms and bounds remain unchanged while state persists",
      liveModelFeasibility: entry.liveModelFeasibility,
      blocker: entry.blocker || (entry.liveModelFeasibility.status === "blocked" ? entry.liveModelFeasibility.reason : null)
      });
    })
  };
}

function buildInteraction() {
  return {
    schema: "jq-configurator-authority-v4-four-step-interaction-v1",
    architecture: {
      acceptedStepCount: 4,
      exactStepOrder: STEPS.map(({ label }) => label),
      acceptedBaselineSteps: [1, 2, 4],
      v4OwnedSteps: [3],
      navigationModels: 1,
      customizationComponents: 1,
      layouts: 3,
      legacyModeSelectors: 0,
      tabs: 0,
      drawers: 0,
      modalChains: 0
    },
    desktop: { stepNavigation: "accepted native buttons", layoutSelection: "accepted one click", numericEdit: "focus then type", baseType: "one click", reset: "one click per field", pendingRows: "zero actions (noninteractive)" },
    mobile: { stepNavigation: "accepted native buttons", layoutSelection: "accepted one tap", numericEdit: "focus then type", baseType: "one tap", reset: "one tap per field", modelOverlay: false },
    keyboard: { stepNavigation: "accepted native buttons", layoutSelection: "accepted layout buttons", fields: "native number input with labeled unit/error", baseType: "native radio group", camera: "focusable application with arrows, plus/minus, Home and 0" },
    customerLiveControls: [{ id: "layout", authorityId: "JQ-STYLE-LAYOUT-001", modelAssertion: "whole registered asset SHA" }],
    reviewOnlyControls: FIELDS.map(({ id, authorityId, layouts }) => ({ id, authorityId, layouts, persistence: "layout-scoped", modelEffect: "none" })),
    intentionallyAbsent: ["customer shelf spacing", "finish swatches", "door choices", "hardware choices", "crown profiles", "lighting control", "pricing", "Apply button"]
  };
}

async function build() {
  validateAuthority();
  const visualRoles = await buildRoleMap();
  const sources = [
    { type: "John Quinn email", date: "2026-07-17/2026-07-18", reference: "Gmail thread ‘Some stuff’, thread 19f6cf838a5ad0dc", authority: "confirmed Step 3 parameters, standardized construction and pending decisions only" },
    { type: "John Quinn construction drawing", date: "2026-07-17", reference: "sources/configurator-authority-v4/Fireplace-Bookcases-7-17-26.pdf", sha256: "c0261a6a728da2a6fec69da79e16b7e56e8ddb9801f8ca0724efa35e7f6c2600" },
    { type: "accepted repository configuration", date: "2026-08-20", reference: "numeric defaults/ranges, registered assets, geometry/applicability and unchanged infrastructure", commit: V4_PROOF.acceptedCommit }
  ];
  const authority = { schema: "jq-configurator-authority-v4-four-step", proof: V4_PROOF, sources, items: AUTHORITY_ITEMS, fields: FIELDS, layouts: LAYOUTS, steps: STEPS };
  const coverage = buildCoverage();
  const feasibility = await buildFeasibility(visualRoles);
  const protectedRecords = visualRoles.layouts.flatMap((layout) => layout.records.map((record) => ({
    layoutId: layout.layoutId, stablePrimitiveId: record.stablePrimitiveId, nodeIndex: record.nodeIndex, meshIndex: record.meshIndex,
    primitiveIndex: record.primitiveIndex, sourceAccessors: record.sourceAccessors, worldBounds: record.worldBounds,
    role: record.role, protection: "geometry/accessors/transforms/material source binding protected; V4 changes runtime proof material/shadow flags only for audited visual roles"
  })));
  const presentation = {
    schema: "jq-configurator-authority-v4-presentation-v1",
    proofOnly: true,
    customerFinishAuthority: false,
    contract: V4_VISUAL_CONTRACT,
    roleManifest: outputPaths.visualRoles,
    modifiedGeometry: false,
    floorPolicy: "source geometry, UVs, material and texture bindings remain unchanged; exact V4 shadow receiver response may alter proof pixels and is measured/disclosed",
    roomShellPolicy: "source geometry/material bindings unchanged; shared lighting/shadow receiver response only",
    openingContextPolicy: "The exact fireplace-frame, architectural-door and architectural-window-frame primitives use one shared proof-only unlit neutral outer/detail response. This isolates cabinetry QA from severe source-normal lighting lobes without changing source bytes, geometry, transforms, opening bounds, glass, fire or architectural hardware. It is not a customer material or production treatment.",
    perLayoutExceptions: [],
    roleCounts: Object.fromEntries(visualRoles.layouts.map(({ layoutId, roleCounts }) => [layoutId, roleCounts]))
  };
  const modifiedEdges = {
    schema: "jq-configurator-authority-v4-modified-edges-v1",
    sourceAssetsModified: false, edgeTreatmentApplied: false, records: [],
    reason: "Role materials plus authentic shared shadows are evaluated first; no accepted all-layout edge whitelist exists."
  };
  const protectedEdges = {
    schema: "jq-configurator-authority-v4-protected-edges-v1",
    policy: "Every source primitive and every source edge is protected because V4 authorizes no geometry surgery.",
    protectedPrimitiveCount: protectedRecords.length,
    protectedReferences: ["all source accessors/bufferViews", "root pivots/transforms", "world bounds", "room shell", "floor", "fireplace", "architectural door", "architectural window/glazing", "smart-dimension references retained only inside accepted viewer implementation"],
    records: protectedRecords
  };
  const interaction = buildInteraction();
  const toolFiles = [
    "configurator.html",
    "package.json",
    "package-lock.json",
    "playwright.config.js",
    "guided-configurator-data.js",
    "guided-layout-registry.js",
    "config/immersive-layout-model-audit-v1.json",
    "config/immersive-layout-material-zones-v1.json",
    "config/configurator-authority-v4-four-step.schema.json",
    "guided-configurator.js",
    "tools/configurator-authority-v4/authority-contract.js",
    "tools/configurator-authority-v4/app.js",
    "tools/configurator-authority-v4/state.js",
    "tools/configurator-authority-v4/visual-contract.js",
    "tools/configurator-authority-v4/viewer-v4.js",
    "tools/configurator-authority-v4/v4.css",
    "tools/configurator-authority-v4/generate-contracts.mjs",
    "tools/configurator-authority-v4/validate-contracts.mjs",
    "tools/configurator-authority-v4/verify-source-identity.mjs",
    "tools/configurator-authority-v4/capture-evidence.mjs",
    "tools/configurator-authority-v4/analyze-evidence.mjs",
    "tools/configurator-authority-v4/measure-performance.mjs",
    "tools/configurator-authority-v4/compose-evidence.mjs",
    "tools/configurator-authority-v4/prepare-blind-packets.mjs",
    "tools/configurator-authority-v4/record-payload.mjs",
    "tools/configurator-authority-v4/record-protected-fingerprints.mjs",
    "tools/configurator-authority-v4/record-project-identity.mjs",
    "tools/configurator-authority-v4/finalize-handoff.mjs",
    "tools/configurator-authority-v4/verify-v4.mjs",
    "tests/configurator-authority-v4.test.js",
    "e2e/configurator-authority-v4.spec.js"
  ];
  const provenance = {
    schema: "jq-configurator-authority-v4-four-step-provenance-v1",
    accepted: { commit: V4_PROOF.acceptedCommit, tree: V4_PROOF.acceptedTree },
    sourceAssets: await Promise.all(LAYOUTS.map(({ asset }) => fileIdentity(asset))),
    authoritySources: { emailThreadId: "19f6cf838a5ad0dc", pdf: await fileIdentity("sources/configurator-authority-v4/Fireplace-Bookcases-7-17-26.pdf") },
    deterministicIdentityDerivation: {
      method: "read each accepted source twice into independent buffers and compare exact bytes; no derived runtime asset is emitted",
      correctionScope: "accepted Steps 1, 2 and 4 are restored through guided-configurator.js; V4 owns only the Step 3 bridge and its local design-review state",
      geometryChanges: 0,
      modifiedEdges: 0,
      expectedNativeDegenerateTriangles: Object.fromEntries(LAYOUTS.map(({ id, nativeDegenerateTriangles }) => [id, nativeDegenerateTriangles])),
      acceptance: "repeat hashes equal registered source hashes; bounds/openings/pivots/reference planes remain source-identical"
    },
    tools: await Promise.all(toolFiles.map(fileIdentity)),
    generated: [outputPaths.authority, outputPaths.coverage, outputPaths.feasibility, outputPaths.interaction]
  };
  return { authority, coverage, feasibility, visualRoles, presentation, modifiedEdges, protectedEdges, interaction, provenance };
}

async function main() {
  const generated = await build();
  const mapping = {
    authority: outputPaths.authority,
    coverage: outputPaths.coverage,
    feasibility: outputPaths.feasibility,
    interaction: outputPaths.interaction,
    provenance: outputPaths.provenance
  };
  const mismatches = [];
  for (const [key, relativePath] of Object.entries(mapping)) {
    const next = serialized(generated[key]);
    if (checkOnly) {
      let current = "";
      try { current = await readFile(path.join(root, relativePath), "utf8"); } catch { /* missing is a mismatch */ }
      if (current !== next) mismatches.push(relativePath);
    } else {
      await writeFile(path.join(root, relativePath), next);
    }
  }
  if (mismatches.length) throw new Error(`Generated V4 contracts are stale: ${mismatches.join(", ")}`);
  process.stdout.write(`${checkOnly ? "checked" : "generated"} ${Object.keys(mapping).length} V4 four-step correction contracts\n`);
}

await main();
