import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(toolDir, "../..");
const schema = JSON.parse(await readFile(path.join(root, "config/configurator-authority-v4-four-step.schema.json"), "utf8"));
const document = JSON.parse(await readFile(path.join(root, "config/configurator-authority-v4-four-step.json"), "utf8"));
const coverage = JSON.parse(await readFile(path.join(root, "config/configurator-authority-v4-four-step-coverage.json"), "utf8"));
const feasibility = JSON.parse(await readFile(path.join(root, "config/configurator-authority-v4-four-step-control-feasibility.json"), "utf8"));
const visualRoles = JSON.parse(await readFile(path.join(root, "config/configurator-authority-v4-visual-roles.json"), "utf8"));

const errors = [];

function resolveReference(reference) {
  if (!reference.startsWith("#/$defs/")) throw new Error(`Unsupported schema reference ${reference}`);
  return schema.$defs[reference.slice("#/$defs/".length)];
}

function valueType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isInteger(value)) return "integer";
  if (typeof value === "number") return "number";
  return typeof value;
}

function validate(value, rule, location = "$") {
  if (!rule) return;
  if (rule.$ref) return validate(value, resolveReference(rule.$ref), location);
  if (rule.oneOf) {
    let matches = 0;
    const branchFailures = [];
    for (const option of rule.oneOf) {
      const start = errors.length;
      validate(value, option, location);
      const branchErrors = errors.splice(start);
      if (branchErrors.length === 0) matches += 1;
      else branchFailures.push(branchErrors);
    }
    if (matches !== 1) errors.push(`${location}: expected exactly one schema branch, matched ${matches}; ${branchFailures[0]?.[0] || "no branch detail"}`);
    return;
  }
  const allowedTypes = rule.type == null ? null : Array.isArray(rule.type) ? rule.type : [rule.type];
  if (allowedTypes) {
    const actual = valueType(value);
    const accepted = allowedTypes.includes(actual) || (actual === "integer" && allowedTypes.includes("number"));
    if (!accepted) { errors.push(`${location}: expected ${allowedTypes.join("|")}, received ${actual}`); return; }
  }
  if (Object.hasOwn(rule, "const") && JSON.stringify(value) !== JSON.stringify(rule.const)) errors.push(`${location}: differs from const`);
  if (rule.enum && !rule.enum.some((candidate) => JSON.stringify(candidate) === JSON.stringify(value))) errors.push(`${location}: not in enum`);
  if (typeof value === "string") {
    if (rule.minLength != null && value.length < rule.minLength) errors.push(`${location}: shorter than ${rule.minLength}`);
    if (rule.pattern && !(new RegExp(rule.pattern)).test(value)) errors.push(`${location}: does not match ${rule.pattern}`);
  }
  if (typeof value === "number") {
    if (rule.minimum != null && value < rule.minimum) errors.push(`${location}: below ${rule.minimum}`);
    if (rule.maximum != null && value > rule.maximum) errors.push(`${location}: above ${rule.maximum}`);
  }
  if (Array.isArray(value)) {
    if (rule.minItems != null && value.length < rule.minItems) errors.push(`${location}: fewer than ${rule.minItems} items`);
    if (rule.maxItems != null && value.length > rule.maxItems) errors.push(`${location}: more than ${rule.maxItems} items`);
    if (rule.items) value.forEach((entry, index) => validate(entry, rule.items, `${location}[${index}]`));
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const required of rule.required || []) if (!Object.hasOwn(value, required)) errors.push(`${location}: missing ${required}`);
    if (rule.additionalProperties === false && rule.properties) {
      for (const key of Object.keys(value)) if (!Object.hasOwn(rule.properties, key)) errors.push(`${location}: unexpected ${key}`);
    }
    for (const [key, childRule] of Object.entries(rule.properties || {})) {
      if (Object.hasOwn(value, key)) validate(value[key], childRule, `${location}.${key}`);
    }
  }
}

validate(document, schema);

if (document.steps.map(({ label }) => label).join("|") !== "Choose Product|Choose Layout|Customization|Review & Details") {
  errors.push("journey: expected exact accepted four-step labels/order");
}
if (document.fields.some(({ stepId }) => stepId !== "customization")) errors.push("journey: a V4 field leaked outside Step 3 Customization");
if (document.fields.length !== 6) errors.push("journey: expected exactly six authority-backed Step 3 fields");

const itemIds = new Set(document.items.map(({ id }) => id));
const fieldIds = new Set(document.fields.map(({ id }) => id));
const layoutIds = new Set(document.layouts.map(({ id }) => id));
for (const field of document.fields) {
  if (!itemIds.has(field.authorityId)) errors.push(`field ${field.id}: missing authority ${field.authorityId}`);
  if (field.layouts.some((layoutId) => !layoutIds.has(layoutId))) errors.push(`field ${field.id}: unknown layout`);
  if (field.type === "number") {
    if (!(field.min < field.max)) errors.push(`field ${field.id}: min must be below max`);
    if (field.defaultValue !== null && (field.defaultValue < field.min || field.defaultValue > field.max)) errors.push(`field ${field.id}: default outside range`);
    if (field.defaultValue !== null && Math.abs((field.defaultValue - field.min) / field.step - Math.round((field.defaultValue - field.min) / field.step)) > 1e-8) errors.push(`field ${field.id}: default is not step-aligned`);
  } else if (!field.values.some(({ value }) => value === field.defaultValue)) errors.push(`field ${field.id}: radio default is not an allowed value`);
}
if (!coverage.assertions.everyVisibleElementHasAuthority) errors.push("coverage: visible orphan authority");
if (!coverage.assertions.everyRegisteredCopyHasSelector) errors.push("coverage: registered copy lacks selector");
if (!coverage.assertions.registeredCopyIdsUnique) errors.push("coverage: duplicate registered copy ID");
if (!coverage.assertions.everyAuthorityItemDisposed) errors.push("coverage: undisposed authority item");
if (!coverage.assertions.noInteractivePendingAuthority) errors.push("coverage: pending item is interactive");
if (!coverage.assertions.noCustomerShelfSpacingField) errors.push("coverage: customer shelf spacing field present");
if (!coverage.assertions.noUnapprovedFinishOption) errors.push("coverage: unapproved finish option present");
if (feasibility.controls.some((entry) => entry.safeTransformOrDerivation !== "none" && entry.authorityId !== "JQ-STYLE-LAYOUT-001")) errors.push("feasibility: unauthorized live transform");
if (feasibility.controls.length !== 28 || new Set(feasibility.controls.map(({ authorityId }) => authorityId)).size !== 28) errors.push("feasibility: incomplete or duplicate control inventory");
if (feasibility.layoutGeometryInventory?.length !== 3) errors.push("feasibility: incomplete GLB inventory");
if (feasibility.layoutGeometryInventory?.reduce((sum, layout) => sum + layout.completePrimitiveMaterialInventory.length, 0) !== 494) errors.push("feasibility: incomplete primitive/material inventory");
for (const entry of feasibility.controls) {
  if (typeof entry.geometryExists !== "boolean" || !entry.geometryClassification || !entry.geometryEvidence) errors.push(`feasibility: ${entry.authorityId} lacks explicit geometry evidence`);
}
for (const authorityId of ["JQ-CONFIG-TV-OPENING-001", "JQ-CONFIG-TOP-FASCIA-HEIGHT-001", "JQ-CONFIG-RECESSED-BASE-HEIGHT-001", "JQ-DYKES-CROWN-CATALOG-001", "JQ-LIGHTING-SYSTEM-001"]) {
  if (feasibility.controls.find((entry) => entry.authorityId === authorityId)?.geometryExists !== false) errors.push(`feasibility: ${authorityId} falsely claims geometry`);
}
for (const layout of visualRoles.layouts) {
  if (!layoutIds.has(layout.layoutId) || !layout.exactStableIdentityCoverage) errors.push(`visual roles: invalid coverage for ${layout.layoutId}`);
  if (new Set(layout.records.map(({ stablePrimitiveId }) => stablePrimitiveId)).size !== layout.records.length) errors.push(`visual roles: duplicate ID for ${layout.layoutId}`);
}
if (fieldIds.size !== document.fields.length || itemIds.size !== document.items.length) errors.push("authority IDs or field IDs are not unique");

if (errors.length) {
  process.stderr.write(`${errors.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`schema PASS: ${document.items.length} authority items, ${document.fields.length} fields, ${coverage.renderedInventory.length} visible inventory records, ${visualRoles.layouts.reduce((sum, layout) => sum + layout.records.length, 0)} exact primitive roles\n`);
}
