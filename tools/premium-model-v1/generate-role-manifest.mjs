import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(toolDir, "../..");
const sourcePath = "config/immersive-layout-material-zones-v1.json";
const outputPath = "config/premium-model-v1-roles.json";
const checkOnly = process.argv.includes("--check");

const OPENING_DETAIL_STABLE_IDS = new Set([
  "scene:0/nodes:0/1/291/292/298/299/mesh:119/primitive:0",
  "scene:0/nodes:0/1/421/422/427/428/mesh:176/primitive:0"
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return Object.is(value, -0) ? 0 : value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function serialized(value) {
  return `${JSON.stringify(stable(value), null, 2)}\n`;
}

function classify(record) {
  const names = record.observedNamePath.filter(Boolean).join(" / ");
  const zone = record.zone;
  if (["wall-room-shell", "ceiling-room-shell"].includes(zone)) return ["room-shell", "audited room-shell material zone"];
  if (["floor", "floor-room-shell"].includes(zone)) return ["floor", "audited floor material zone"];
  if (zone === "fire-emissive-surface") return ["fireplace", "audited fire surface"];
  if (zone === "fireplace-appliance-frame") return ["architectural-opening", "audited fireplace frame"];
  if (["architectural-interior-door", "architectural-window-frame"].includes(zone)) {
    return OPENING_DETAIL_STABLE_IDS.has(record.stablePrimitiveId)
      ? ["architectural-opening-detail", "audited inner architectural opening primitive"]
      : ["architectural-opening", "audited architectural opening primitive"];
  }
  if (zone === "architectural-door-hardware") return ["architectural-hardware", "audited architectural hardware"];
  if (zone === "architectural-glazing") return ["architectural-glazing", "audited architectural glazing"];
  if (["support-hardware", "adjustable-support-hardware"].includes(zone)) return ["support-hardware", "audited construction support hardware"];
  if (["knob-hardware", "pull-hardware"].includes(zone)) return ["hardware", "audited visible cabinet hardware"];
  if (/Toe\s*Kick|ToeSkins|Front Toe/i.test(names) || zone === "toe-skin-millwork") return ["toe-base", "stable path identifies toe/base geometry"];
  if (/Wood Top/i.test(names)) return ["countertop", "stable path identifies separate wood top geometry"];
  if (/Wall Filler|\/ BF1 \/|\/ Stile \/.*Geom3D_Stile/i.test(names)) return ["filler-end", "stable path identifies filler/end geometry"];
  if (/Adjustable Shelf/i.test(names)) return ["shelf", "stable path identifies shelf geometry"];
  if (/UBack|Nailer|Drw Back/i.test(names)) return ["back", "stable path identifies back/nailer geometry"];
  if (/Door_H|Door Panel|Door [LRTB][R ]|Drw (Panel|TR|BR|L Stile|R Stile)/i.test(names)) return ["door-detail", "stable path identifies cabinet door/drawer geometry"];
  if (/Wall (Hutch|Open Cabinet).*\/ TR \/|Top Rail/i.test(names)) return ["top-rail", "stable path identifies top rail geometry"];
  if (["cabinet-interior-millwork", "drawer-box-millwork"].includes(zone)) return ["interior", "audited cabinet interior/drawer box zone"];
  if (["millwork", "painted-millwork"].includes(zone)) return ["frame-stile", "remaining audited exterior millwork"];
  return ["protected-unclassified", "no premium model mapping; source surface remains unchanged"];
}

async function build() {
  const audit = JSON.parse(await readFile(path.join(root, sourcePath), "utf8"));
  const layouts = audit.layouts.map((layout) => {
    const records = layout.records.map((record) => {
      const [role, reason] = classify(record);
      return {
        stablePrimitiveId: record.stablePrimitiveId,
        nodeIndex: record.nodeIndex,
        meshIndex: record.meshIndex,
        primitiveIndex: record.primitiveIndex,
        sourceMaterialIndex: record.sourceMaterialIndex,
        positionAccessorSha256: record.sourceAccessors.attributes.POSITION.dataSha256,
        originalZone: record.zone,
        worldBounds: record.worldBounds,
        role,
        reason
      };
    });
    const stableIds = records.map(({ stablePrimitiveId }) => stablePrimitiveId);
    assert(new Set(stableIds).size === records.length, `${layout.layoutId} has duplicate primitive IDs.`);
    assert(records.length === layout.summary.primitiveRecords, `${layout.layoutId} role coverage is incomplete.`);
    const roles = [...new Set(records.map(({ role }) => role))].sort();
    return {
      layoutId: layout.layoutId,
      source: layout.source,
      primitiveCount: records.length,
      roleCounts: Object.fromEntries(roles.map((role) => [role, records.filter((record) => record.role === role).length])),
      records
    };
  });
  assert(layouts.map(({ layoutId }) => layoutId).join("|") === "fireplace-wall|door-wall|window-wall", "Exactly three registered layouts are required.");
  assert(layouts.reduce((sum, layout) => sum + layout.primitiveCount, 0) === 494, "Expected 494 audited primitives.");
  return {
    schema: "jq-premium-model-v1-role-manifest-v1",
    status: "ISOLATED VISUAL PREVIEW — OWNER ACCEPTANCE OPEN",
    sourceAudit: sourcePath,
    derivation: "exact audited stable primitive ID, source material zone, full observed hierarchy path, POSITION accessor hash, and world bounds",
    sourceAssetsModified: false,
    layouts
  };
}

const next = serialized(await build());
if (checkOnly) {
  let current = "";
  try {
    current = await readFile(path.join(root, outputPath), "utf8");
  } catch {
    // A missing generated manifest is a mismatch.
  }
  if (current !== next) throw new Error(`${outputPath} is stale.`);
  process.stdout.write(`checked ${outputPath}\n`);
} else {
  await writeFile(path.join(root, outputPath), next);
  process.stdout.write(`generated ${outputPath}\n`);
}
