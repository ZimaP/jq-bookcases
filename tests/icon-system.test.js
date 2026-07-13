import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  ICON_STROKE_WIDTH,
  diagramManifest,
  diagramRegistry,
  diagramSvg,
  iconManifest,
  iconRegistry,
  iconSvg,
  mountIcons,
  setIcon
} from "../icon-system.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const requiredIcons = [
  "layout", "dimensions", "width", "height", "depth", "sections", "doors", "shelves", "drawers", "cabinets", "back-panel", "side-panel", "storage", "base-cabinets",
  "door-style", "crown-molding", "base-molding", "trim-molding", "hardware-knob", "handle-pull", "hardware", "glass-door", "paint-finish", "wood-finish", "material-layers", "panel-style", "accent-detail",
  "lighting", "lighting-off", "led-strip", "puck-light", "adjustable-light", "dimmable", "light-scenes", "under-shelf-light", "toe-kick-light", "interior-light",
  "pickup", "shop-pickup", "project-coordination", "standard-delivery", "priority-delivery", "white-glove-delivery", "no-installation", "diy-installation", "professional-installation", "measurement-visit", "schedule", "installation-complete",
  "warranty", "quality", "made-in-usa", "craftsmanship", "sustainability", "local-service", "support", "help-center", "quote", "pricing", "secure", "reviews", "guarantee",
  "living-room", "library", "home-office", "media-wall", "bedroom", "dining-room", "entryway", "kitchen", "closet", "bathroom", "fireplace-wall", "inspiration",
  "search", "menu", "close", "chevron-down", "chevron-left", "chevron-right", "arrow-right", "check", "plus", "minus", "information", "save", "favorite", "reset", "undo", "zoom-in", "zoom-out", "camera-front", "camera-side", "camera-three-quarter", "camera-orbit", "augmented-reality", "share",
  "instagram", "pinterest", "houzz"
];

const requiredDiagrams = [
  "base-toe-kick", "base-plinth", "base-furniture",
  "crown-flat-top", "crown-step", "crown-classic", "crown-built-up",
  "door-shaker", "door-flat", "door-slim-shaker", "door-glass",
  "hardware-knob", "handle-pull"
];

test("the frozen manifests and registries expose the canonical JQ name sets", () => {
  assert.equal(ICON_STROKE_WIDTH, 1.75);
  for (const value of [iconManifest, iconRegistry, diagramManifest, diagramRegistry]) {
    assert.equal(Object.isFrozen(value), true);
  }
  assert.deepEqual(Object.keys(iconRegistry), requiredIcons);
  assert.deepEqual(Object.keys(diagramRegistry), requiredDiagrams);
  assert.deepEqual(Object.keys(iconManifest), requiredIcons);
  assert.deepEqual(Object.keys(diagramManifest), requiredDiagrams);
  for (const definition of [...Object.values(iconManifest), ...Object.values(diagramManifest)]) {
    assert.equal(Object.isFrozen(definition), true);
    assert.ok(definition.category && definition.label && definition.meaning && definition.geometry);
  }
});

test("iconSvg emits the unified accessible 24 by 24 rendering contract", () => {
  const decorative = iconSvg("layout", { className: "line-icon process-icon", size: "1em" });
  assert.match(decorative, /^<svg\b/);
  assert.match(decorative, /class="jq-icon line-icon process-icon"/);
  assert.match(decorative, /data-icon-name="layout"/);
  assert.match(decorative, /viewBox="0 0 24 24"/);
  assert.match(decorative, /width="1em" height="1em"/);
  assert.match(decorative, /fill="none"/);
  assert.match(decorative, /stroke="currentColor"/);
  assert.match(decorative, /stroke-width="1\.75"/);
  assert.match(decorative, /stroke-linecap="round"/);
  assert.match(decorative, /stroke-linejoin="round"/);
  assert.match(decorative, /aria-hidden="true"/);
  assert.match(decorative, /focusable="false"/);
  assert.equal((decorative.match(/<svg\b/g) || []).length, 1);

  const named = iconSvg("information", { label: 'More about "pricing"' });
  assert.match(named, /role="img"/);
  assert.match(named, /aria-label="More about &quot;pricing&quot;"/);
  assert.doesNotMatch(named, /aria-hidden=/);
});

test("diagramSvg emits the unified product-profile contract", () => {
  const markup = diagramSvg("crown-classic", { class: "style-diagram" });
  assert.match(markup, /^<svg\b/);
  assert.match(markup, /class="jq-diagram style-diagram"/);
  assert.match(markup, /data-diagram-name="crown-classic"/);
  assert.match(markup, /viewBox="0 0 64 36"/);
  assert.match(markup, /width="64" height="36"/);
  assert.match(markup, /stroke="currentColor"/);
  assert.match(markup, /stroke-width="1\.75"/);
  assert.match(markup, /aria-hidden="true"/);
  assert.match(markup, /focusable="false"/);
});

test("unknown names warn and never fall back to another glyph", () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (message) => warnings.push(String(message));
  try {
    assert.equal(iconSvg("not-a-real-icon"), "");
    assert.equal(diagramSvg("not-a-real-diagram"), "");
    const host = { innerHTML: "stale icon" };
    assert.equal(setIcon(host, "still-not-real"), false);
    assert.equal(host.innerHTML, "");
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(warnings.length, 3);
});

test("setIcon and mountIcons work with caller-supplied DOM-like hosts", () => {
  const first = { innerHTML: "", getAttribute: (name) => name === "data-icon" ? "material-layers" : null };
  const second = { innerHTML: "", dataset: { icon: "lighting" } };
  const root = { querySelectorAll: (selector) => selector === "[data-icon]" ? [first, second] : [] };
  assert.equal(setIcon(first, "layout"), true);
  assert.match(first.innerHTML, /data-icon-name="layout"/);
  assert.equal(mountIcons(root), 2);
  assert.match(first.innerHTML, /data-icon-name="material-layers"/);
  assert.match(second.innerHTML, /data-icon-name="lighting"/);
});

test("registry fragments are inert, presentation-free SVG geometry", () => {
  const allowedElement = /<(?:path|rect|circle|line|polyline|ellipse)\b(?:\s+[a-z][\w-]*="[^"]*")*\s*\/>/g;
  const unsafeMarkup = /<\/?(?:svg|script|style|foreignObject|iframe|image)\b|\bon[a-z]+\s*=|\b(?:href|src|id|class|style|fill|stroke|filter|mask)\s*=/i;
  for (const [name, fragment] of [...Object.entries(iconRegistry), ...Object.entries(diagramRegistry)]) {
    assert.doesNotMatch(fragment, unsafeMarkup, `${name} contains unsafe or presentation markup`);
    assert.equal(fragment.replace(allowedElement, "").trim(), "", `${name} contains unsupported markup`);
  }
});

test("every named semantic icon has distinct geometry", () => {
  const owners = new Map();
  for (const [name, fragment] of Object.entries(iconRegistry)) {
    assert.equal(owners.has(fragment), false, `${name} duplicates ${owners.get(fragment)}`);
    owners.set(fragment, name);
  }
  for (const pair of [
    ["pickup", "shop-pickup"], ["standard-delivery", "priority-delivery"],
    ["standard-delivery", "white-glove-delivery"], ["no-installation", "diy-installation"],
    ["diy-installation", "professional-installation"], ["quote", "pricing"],
    ["warranty", "quality"], ["warranty", "guarantee"], ["hardware-knob", "handle-pull"],
    ["doors", "door-style"], ["camera-orbit", "augmented-reality"]
  ]) assert.notEqual(iconRegistry[pair[0]], iconRegistry[pair[1]], pair.join(" and "));
});

test("delivery and installation choices use exact concept-specific icons", () => {
  const source = readFileSync(path.join(rootDir, "configurator-3d.js"), "utf8");
  for (const contract of [
    /pickup:\s*iconSvg\("shop-pickup"\)/,
    /standard:\s*iconSvg\("standard-delivery"\)/,
    /priority:\s*iconSvg\("priority-delivery"\)/,
    /no_installation:\s*iconSvg\("no-installation"\)/,
    /professional:\s*iconSvg\("professional-installation"\)/
  ]) assert.match(source, contract);
  assert.match(readFileSync(path.join(rootDir, "bookcase-config.js"), "utf8"), /value: "no_installation", label: "No Installation"/);
});

test("physical options use drawings and finishes use swatches or labels", () => {
  const source = readFileSync(path.join(rootDir, "configurator-3d.js"), "utf8");
  assert.match(source, /doorPreviewIcons/);
  assert.match(source, /crownPreviewIcons/);
  assert.match(source, /basePreviewIcons/);
  assert.match(source, /hardwarePreviewIcons/);
  assert.match(source, /hardwareFinishSwatches/);
  assert.match(source, /class="hardware-choice-icon" style="--hardware-finish:/);
  assert.doesNotMatch(source, /class="hardware-finish-swatch"/);
  assert.match(source, /finish-choice-dot/);
  assert.match(source, /lightingWarmthOptions\.map/);
});

test("every public source references a registered icon or product diagram", () => {
  const sourceFiles = [...readdirSync(rootDir).filter((file) => file.endsWith(".html")), "site.js", "configurator-3d.js", "cabinet-ar-ui.js"];
  for (const file of sourceFiles) {
    const source = readFileSync(path.join(rootDir, file), "utf8");
    const iconNames = [...source.matchAll(/data-icon="([^"]+)"|iconSvg\("([^"]+)"/g)].map((match) => match[1] || match[2]);
    const diagramNames = [...source.matchAll(/diagramSvg\("([^"]+)"/g)].map((match) => match[1]);
    for (const name of iconNames) assert.ok(iconRegistry[name], `${file} references unknown icon ${name}`);
    for (const name of diagramNames) assert.ok(diagramRegistry[name], `${file} references unknown diagram ${name}`);
  }
});

test("public sources contain no retired icon debt or character glyph controls", () => {
  const files = [...readdirSync(rootDir).filter((file) => file.endsWith(".html")), "site.js", "configurator-3d.js", "cabinet-ar-ui.js", "configurator.css"];
  const sources = files.map((file) => readFileSync(path.join(rootDir, file), "utf8")).join("\n");
  assert.doesNotMatch(sources, /\b(?:iconMap|lineIconSvg|productPreviewSvg|ICON_REGISTRY|DIAGRAM_REGISTRY)\b/);
  assert.doesNotMatch(sources, /data:image\/svg\+xml|--cfg-section-icon/);
  assert.doesNotMatch(sources, /&(?:rarr|rsaquo|minus);|&#10003;/);
  assert.doesNotMatch(readFileSync(path.join(rootDir, "configurator-3d.js"), "utf8"), />\s*[×+−]\s*</);
  assert.doesNotMatch(readFileSync(path.join(rootDir, "cabinet-ar-ui.js"), "utf8"), />\s*×\s*</);
});

test("the development gallery covers every icon, size, ground, and state", () => {
  const html = readFileSync(path.join(rootDir, "docs/icon-library.html"), "utf8");
  const source = readFileSync(path.join(rootDir, "docs/icon-library.js"), "utf8");
  assert.match(html, /noindex, nofollow/);
  assert.match(source, /Object\.entries\(iconManifest\)/);
  assert.match(source, /\[16, 20, 24, 32, 40\]/);
  assert.match(source, /ground-light/);
  assert.match(source, /ground-dark/);
  for (const state of ["is-hover", "is-selected", "is-disabled"]) assert.match(source, new RegExp(state));
});

test("all canonical pages load the centralized icon stylesheet", () => {
  const pages = readdirSync(rootDir).filter((file) => file.endsWith(".html"));
  for (const page of pages) {
    assert.match(readFileSync(path.join(rootDir, page), "utf8"), /styles\/icons\.css\?v=jq-icons-20260713i/);
  }
  const stylesheet = readFileSync(path.join(rootDir, "styles/icons.css"), "utf8");
  assert.match(stylesheet, /--icon-stroke-width:\s*1\.75/);
  assert.match(stylesheet, /--icon-size-utility:\s*16px/);
  assert.match(stylesheet, /--icon-size-control:\s*20px/);
  assert.match(stylesheet, /--icon-size-default:\s*24px/);
  assert.match(stylesheet, /--icon-size-feature:\s*32px/);
  assert.match(stylesheet, /--icon-size-prominent:\s*40px/);
});
