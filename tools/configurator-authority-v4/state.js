import { FIELDS, LAYOUTS, V4_PROOF, fieldsFor, layoutById } from "./authority-contract.js";

export const V4_STATE_SCHEMA = 2;

function randomId() {
  const bytes = new Uint32Array(2);
  globalThis.crypto?.getRandomValues?.(bytes);
  return `customization-${Date.now().toString(36)}-${[...bytes].map((value) => value.toString(36)).join("")}`;
}

function fieldsForLayout(layoutId) {
  return fieldsFor(layoutId, "customization");
}

function defaultValues(layoutId) {
  return Object.fromEntries(fieldsForLayout(layoutId).map((field) => [field.id, field.defaultValue]));
}

function isStepAligned(field, value) {
  if (field.type !== "number" || !Number.isFinite(value)) return false;
  const quotient = (value - field.min) / field.step;
  return Math.abs(quotient - Math.round(quotient)) <= 1e-8;
}

function numericFieldError(field) {
  return `Enter ${field.min}–${field.max} in, in ${field.step}-in increments.`;
}

export function createV4Project() {
  return {
    schema: V4_STATE_SCHEMA,
    proof: V4_PROOF.id,
    id: randomId(),
    layout: "fireplace-wall",
    layoutStates: Object.fromEntries(LAYOUTS.map(({ id }) => [id, { values: defaultValues(id) }])),
    migration: { rejectedKeys: [], resetValues: [] }
  };
}

function normalizeFieldValue(field, candidate, migration) {
  if (field.type === "radio") {
    if (field.values.some(({ value }) => value === candidate)) return candidate;
    if (candidate !== undefined) migration.resetValues.push(field.id);
    return field.defaultValue;
  }
  const numeric = Number(candidate);
  if (Number.isFinite(numeric) && numeric >= field.min && numeric <= field.max && isStepAligned(field, numeric)) {
    return Math.round(numeric * 1000) / 1000;
  }
  if (candidate !== undefined) migration.resetValues.push(field.id);
  return field.defaultValue;
}

export function normalizeV4Project(candidate) {
  const base = createV4Project();
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const migration = { rejectedKeys: [], resetValues: [] };
  if (Array.isArray(source.migration?.rejectedKeys)) migration.rejectedKeys.push(...source.migration.rejectedKeys.filter((entry) => typeof entry === "string"));
  if (Array.isArray(source.migration?.resetValues)) migration.resetValues.push(...source.migration.resetValues.filter((entry) => typeof entry === "string"));
  const allowedProjectKeys = new Set(["schema", "proof", "id", "layout", "layoutStates", "migration"]);
  for (const key of Object.keys(source)) if (!allowedProjectKeys.has(key)) migration.rejectedKeys.push(`project.${key}`);
  base.id = typeof source.id === "string" && source.id ? source.id.slice(0, 120) : base.id;
  base.layout = layoutById(source.layout)?.id || base.layout;
  for (const layout of LAYOUTS) {
    const state = source.layoutStates?.[layout.id];
    const values = state?.values && typeof state.values === "object" ? state.values : {};
    const allowed = new Set(fieldsForLayout(layout.id).map(({ id }) => id));
    for (const key of Object.keys(state || {})) if (key !== "values") migration.rejectedKeys.push(`layoutStates.${layout.id}.${key}`);
    for (const key of Object.keys(values)) if (!allowed.has(key)) migration.rejectedKeys.push(`layoutStates.${layout.id}.values.${key}`);
    for (const field of fieldsForLayout(layout.id)) {
      base.layoutStates[layout.id].values[field.id] = normalizeFieldValue(field, values[field.id], migration);
    }
  }
  base.migration = {
    rejectedKeys: [...new Set(migration.rejectedKeys)].sort(),
    resetValues: [...new Set(migration.resetValues)].sort()
  };
  return base;
}

export function readV4Draft(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.(V4_PROOF.storage.draft);
    return raw ? normalizeV4Project(JSON.parse(raw)) : createV4Project();
  } catch {
    return createV4Project();
  }
}

export function writeV4Draft(project, storage = globalThis.localStorage) {
  const normalized = normalizeV4Project(project);
  storage?.setItem?.(V4_PROOF.storage.draft, JSON.stringify(normalized));
  return normalized;
}

export function setV4Layout(project, layoutId) {
  if (!layoutById(layoutId)) return normalizeV4Project(project);
  return normalizeV4Project({ ...project, layout: layoutId });
}

export function setV4Field(project, fieldId, value) {
  const field = fieldsForLayout(project.layout).find((entry) => entry.id === fieldId);
  if (!field) return { project, error: "This field does not apply to the selected layout." };
  let normalized;
  if (field.type === "radio") {
    if (!field.values.some((entry) => entry.value === value)) return { project, error: "Choose an approved value." };
    normalized = value;
  } else {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < field.min || numeric > field.max || !isStepAligned(field, numeric)) {
      return { project, error: numericFieldError(field) };
    }
    normalized = Math.round(numeric * 1000) / 1000;
  }
  const next = structuredClone(project);
  next.layoutStates[next.layout].values[field.id] = normalized;
  next.migration = { rejectedKeys: [], resetValues: [] };
  return { project: normalizeV4Project(next), error: null };
}

export function resetV4Field(project, fieldId) {
  const field = fieldsForLayout(project.layout).find((entry) => entry.id === fieldId);
  return field ? setV4Field(project, fieldId, field.defaultValue) : { project, error: "This field does not apply to the selected layout." };
}

export function validateV4Customization(project) {
  return fieldsForLayout(project.layout).flatMap((field) => {
    const value = project.layoutStates[project.layout].values[field.id];
    if (field.type === "radio") return field.values.some(({ value: option }) => option === value) ? [] : [{ fieldId: field.id, message: "Choose an approved value." }];
    return Number.isFinite(value) && value >= field.min && value <= field.max && isStepAligned(field, value)
      ? []
      : [{ fieldId: field.id, message: numericFieldError(field) }];
  });
}

export function serializedCustomerKeys(project) {
  const normalized = normalizeV4Project(project);
  return {
    topLevel: Object.keys(normalized).sort(),
    layoutState: Object.keys(normalized.layoutStates[normalized.layout]).sort(),
    values: Object.keys(normalized.layoutStates[normalized.layout].values).sort()
  };
}
