import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  CATEGORY_DEFINITIONS,
  DETAIL_OPTIONS,
  FINISH_OPTIONS,
  getCompatibleDetails,
  getMeasurementFields
} from "../guided-configurator-data.js";
import {
  GUIDED_DRAFT_STORAGE_KEY,
  GUIDED_PROJECTS_STORAGE_KEY,
  buildProjectSummary,
  createProject,
  createProjectStore,
  formatInches,
  normalizeProject,
  parseInches,
  validateMeasurements
} from "../guided-configurator-state.js";

class MemoryStorage {
  #records = new Map();

  getItem(key) {
    return this.#records.has(key) ? this.#records.get(key) : null;
  }

  setItem(key, value) {
    this.#records.set(key, String(value));
  }

  removeItem(key) {
    this.#records.delete(key);
  }
}

class ToggleStorage extends MemoryStorage {
  blocked = false;

  setItem(key, value) {
    if (this.blocked) throw new DOMException("Storage blocked", "QuotaExceededError");
    super.setItem(key, value);
  }
}

const categoryById = (id) => CATEGORY_DEFINITIONS.find((category) => category.id === id);

test("all five customer categories expose intentional category-specific layouts", () => {
  assert.deepEqual(
    CATEGORY_DEFINITIONS.map((category) => category.id),
    ["bookcase", "tv-unit", "floating-storage", "window-storage", "radiator-cover"]
  );
  assert.deepEqual(
    categoryById("bookcase").layouts.map((layout) => layout.label),
    ["Niche Layout", "Left Niche", "Right Niche", "Fireplace Wall", "Clear Wall", "Center Recess", "Window Wall", "Door Wall"]
  );
  assert.deepEqual(
    categoryById("tv-unit").layouts.map((layout) => layout.label),
    ["Clear TV Wall", "TV Niche", "Fireplace + TV", "Window-Side TV Wall", "Corner TV Wall"]
  );
  assert.equal(categoryById("floating-storage").layouts.length, 5);
  assert.equal(categoryById("window-storage").layouts.length, 5);
  assert.equal(categoryById("radiator-cover").layouts.length, 5);
  assert.ok(categoryById("radiator-cover").layouts.every((layout) => layout.label.toLowerCase().includes("radiator") || layout.label === "Wall-to-Wall Cover"));
});

test("measurement schemas are derived from category and layout conditions", () => {
  const windowFields = getMeasurementFields("bookcase", "window-wall").map((field) => field.id);
  const doorFields = getMeasurementFields("bookcase", "door-wall").map((field) => field.id);
  const fireplaceFields = getMeasurementFields("bookcase", "fireplace-wall").map((field) => field.id);
  const tvFields = getMeasurementFields("tv-unit", "clear-tv-wall").map((field) => field.id);
  const radiatorFields = getMeasurementFields("radiator-cover", "standalone-radiator").map((field) => field.id);

  assert.deepEqual(windowFields.slice(0, 3), ["wallWidth", "ceilingHeight", "desiredDepth"]);
  assert.ok(windowFields.includes("windowWidth"));
  assert.ok(windowFields.includes("radiatorBelowWindow"));
  assert.ok(!windowFields.includes("doorSwing"));
  assert.ok(doorFields.includes("doorWidth"));
  assert.ok(doorFields.includes("doorSwing"));
  assert.ok(fireplaceFields.includes("mantelHeight"));
  assert.ok(fireplaceFields.includes("tvAboveFireplace"));
  assert.ok(tvFields.includes("tvScreenSize"));
  assert.ok(tvFields.includes("outletLocation"));
  assert.ok(radiatorFields.includes("radiatorDepth"));
  assert.ok(radiatorFields.includes("valveLocation"));
});

test("inch parsing accepts decimals, mixed fractions, hyphenated fractions, and unicode fractions", () => {
  assert.equal(parseInches(42.5), 42.5);
  assert.equal(parseInches("42.5 in"), 42.5);
  assert.equal(parseInches("42 1/2"), 42.5);
  assert.equal(parseInches("42-1/2"), 42.5);
  assert.equal(parseInches("7/8"), 0.875);
  assert.equal(parseInches("42½"), 42.5);
  assert.equal(parseInches(""), null);
  assert.equal(parseInches("-2"), null);
  assert.equal(parseInches("twelve"), null);
  assert.equal(formatInches(42.5), "42 1/2");
  assert.equal(formatInches(0.875), "7/8");
  assert.equal(formatInches(42.5, { decimal: true }), "42.5");
});

test("core measurements are required while unusual values remain non-blocking warnings", () => {
  const incomplete = createProject({ now: 1, random: 0.1 });
  let result = validateMeasurements(incomplete);
  assert.equal(result.valid, false);
  assert.equal(result.errors[0].field, "layout");

  const warningProject = normalizeProject({
    ...incomplete,
    layout: "clear-wall",
    measurements: {
      wallWidth: 200,
      ceilingHeight: 60,
      desiredDepth: 30
    }
  }, { now: 2 });
  result = validateMeasurements(warningProject);
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.warnings.length, 3);
  assert.ok(result.warnings.every((warning) => warning.message.includes("You can continue")));

  warningProject.measurements.wallWidth = null;
  result = validateMeasurements(warningProject);
  assert.equal(result.valid, false);
  assert.match(result.errors[0].message, /approximate wall width/i);
});

test("normalization removes incompatible detail choices without disturbing project identity", () => {
  const project = normalizeProject({
    ...createProject({ now: 10, random: 0.2 }),
    layout: "clear-wall",
    style: "open-shelving",
    hardware: "black-pull",
    doorStyle: "glass",
    lighting: "integrated-led"
  }, { now: 11 });
  const compatible = getCompatibleDetails(project.category, project.style);

  assert.equal(project.style, "open-shelving");
  assert.equal(project.hardware, null);
  assert.equal(project.doorStyle, null);
  assert.equal(project.lighting, "integrated-led");
  assert.equal(compatible.hardware.length, 0);
  assert.equal(compatible.doorStyle.length, 0);
  assert.equal(project.projectId, "JQ-0000A-7777");
});

test("project summaries reflect normalized measurements and curated selections", () => {
  const project = normalizeProject({
    ...createProject({ now: 20, random: 0.3 }),
    category: "bookcase",
    layout: "window-wall",
    measurements: {
      wallWidth: "121 1/2",
      ceilingHeight: 96,
      desiredDepth: 14,
      windowWidth: 48,
      windowHeight: 42,
      sillHeight: 30,
      windowLeftDistance: 30,
      windowRightDistance: 43.5,
      radiatorBelowWindow: "yes"
    },
    style: "lower-cabinets-shelves",
    finish: "charcoal",
    accentFinish: "ink-blue",
    hardware: "brass-pull",
    lighting: "warm-led",
    notes: "Preserve the existing crown."
  }, { now: 21 });
  const summary = Object.fromEntries(buildProjectSummary(project).map((row) => [row.key, row.value]));

  assert.equal(summary.layout, "Window Wall");
  assert.equal(summary.wallWidth, "121 1/2 in");
  assert.equal(summary.windowRightDistance, "43 1/2 in");
  assert.equal(summary.radiatorBelowWindow, "Yes");
  assert.equal(summary.style, "Lower Cabinets + Shelves");
  assert.equal(summary.finish, "Charcoal");
  assert.equal(summary.accentFinish, "Ink Blue");
  assert.equal(summary.hardware, "Brass Pull");
  assert.equal(summary.notes, "Preserve the existing crown.");
});

test("project store supports drafts, multiple saves, rename, duplicate, resume, and delete", () => {
  const storage = new MemoryStorage();
  const projects = createProjectStore(storage);
  const original = normalizeProject({
    ...createProject({ now: 100, random: 0.1 }),
    layout: "clear-wall",
    projectName: "Library"
  }, { now: 101 });

  assert.equal(projects.saveDraft(original), true);
  assert.equal(projects.loadDraft().projectName, "Library");
  assert.ok(storage.getItem(GUIDED_DRAFT_STORAGE_KEY));

  projects.saveProject(original);
  assert.equal(projects.listProjects().length, 1);
  assert.equal(projects.getProject(original.projectId).status, "saved");

  const renamed = projects.renameProject(original.projectId, "Front Library");
  assert.equal(renamed.projectName, "Front Library");

  const duplicate = projects.duplicateProject(original.projectId, { now: 200, random: 0.2 });
  assert.notEqual(duplicate.projectId, original.projectId);
  assert.equal(duplicate.projectName, "Front Library Copy");
  assert.equal(projects.listProjects().length, 2);
  assert.ok(storage.getItem(GUIDED_PROJECTS_STORAGE_KEY));

  assert.equal(projects.deleteProject(original.projectId), true);
  assert.equal(projects.listProjects().length, 1);
  assert.equal(projects.deleteProject("missing"), false);
  assert.equal(projects.clearDraft(), true);
  assert.equal(projects.loadDraft(), null);
});

test("catalog provides the complete curated finish and detail collections", () => {
  assert.deepEqual(FINISH_OPTIONS.wood.map((finish) => finish.label), ["White Oak", "Natural Oak", "Light Walnut", "Medium Walnut", "Dark Walnut"]);
  assert.deepEqual(FINISH_OPTIONS.paint.map((finish) => finish.label), ["Warm White", "Soft Ivory", "Light Greige", "Sage Gray", "Charcoal"]);
  assert.deepEqual(DETAIL_OPTIONS.hardware.map((option) => option.label), ["Knob", "Brass Pull", "Black Pull", "No Visible Hardware"]);
  assert.deepEqual(DETAIL_OPTIONS.lighting.map((option) => option.label), ["No Lighting", "Warm LED", "Integrated LED"]);
  assert.equal(getCompatibleDetails("floating-storage", "floating-cabinets").baseStyle.length, 0);
});

test("project store reports blocked writes instead of fabricating save success", () => {
  const storage = new ToggleStorage();
  const projects = createProjectStore(storage);
  const project = normalizeProject({
    ...createProject({ now: 300, random: 0.4 }),
    layout: "clear-wall",
    projectName: "Blocked Save"
  }, { now: 301 });

  assert.ok(projects.saveProject(project));
  storage.blocked = true;
  assert.equal(projects.saveDraft(project), false);
  assert.equal(projects.saveProject({ ...project, projectName: "Changed" }), null);
  assert.equal(projects.renameProject(project.projectId, "Renamed"), null);
  assert.equal(projects.duplicateProject(project.projectId), null);
  assert.equal(projects.deleteProject(project.projectId), false);
});

test("the public configurator route and deployment exclude the legacy 3D runtime", async () => {
  const [html, guidedUi, guidedState, workflow] = await Promise.all([
    readFile(new URL("../configurator.html", import.meta.url), "utf8"),
    readFile(new URL("../guided-configurator.js", import.meta.url), "utf8"),
    readFile(new URL("../guided-configurator-state.js", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/deploy-pages-production.yml", import.meta.url), "utf8")
  ]);

  assert.match(html, /guided-configurator\.js/);
  assert.doesNotMatch(html, /configurator-3d|three\.module|cabinet-ar|direct-hardware/);
  assert.doesNotMatch(`${guidedUi}\n${guidedState}`, /configurator-3d|three\.module|bookcase-engine|cabinet-ar/);
  assert.match(workflow, /test ! -e _site\/configurator-3d\.js/);
  assert.match(workflow, /test ! -e _site\/assets\/vendor\/three\.module\.js/);
  assert.doesNotMatch(workflow, /test -f _site\/assets\/vendor\/three\.module\.js/);
});
