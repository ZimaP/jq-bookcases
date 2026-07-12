import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  DIAGRAM_REGISTRY,
  ICON_REGISTRY,
  diagramRegistry,
  diagramSvg,
  iconRegistry,
  iconSvg,
  mountIcons,
  setIcon
} from "../icon-system.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const requiredIcons = [
  "layouts",
  "configurator-3d",
  "dimensions",
  "materials",
  "paint-finish",
  "hardware",
  "lighting",
  "transparent-pricing",
  "quote-review",
  "field-measurement",
  "shop-build",
  "installation",
  "inspiration-gallery",
  "made-in-usa",
  "local-service",
  "support-faq",
  "cabinet-door",
  "adjustable-shelves",
  "craftsmanship",
  "low-voc",
  "client-centered",
  "delivery",
  "warranty",
  "project-photos",
  "design-plan",
  "ruler",
  "finish-options",
  "price-tag",
  "schedule-install",
  "medal",
  "hard-hat",
  "hammer",
  "home-install",
  "headset",
  "flag",
  "wrench",
  "monitor-pricing",
  "drill",
  "tools",
  "instagram",
  "pinterest",
  "houzz",
  "heart",
  "star",
  "check",
  "plus",
  "minus",
  "arrow-right",
  "chevron-left",
  "chevron-right",
  "menu",
  "close",
  "bookmark",
  "search",
  "reset",
  "view-3d",
  "view-front",
  "view-three-quarter",
  "view-side",
  "lighting-none",
  "lighting-pucks",
  "lighting-shelf",
  "lighting-vertical",
  "lighting-package"
];

const requiredDiagrams = [
  "base-toe-kick",
  "base-plinth",
  "base-furniture",
  "crown-none",
  "crown-slim",
  "crown-classic",
  "crown-soffit",
  "door-shaker",
  "door-flat",
  "door-slim-shaker",
  "door-glass",
  "hardware-brass-knob",
  "hardware-black-knob",
  "hardware-brass-pull",
  "hardware-black-pull",
  "hardware-nickel-pull"
];

test("the frozen registries expose the complete canonical name sets", () => {
  assert.equal(iconRegistry, ICON_REGISTRY);
  assert.equal(diagramRegistry, DIAGRAM_REGISTRY);
  assert.equal(Object.isFrozen(iconRegistry), true);
  assert.equal(Object.isFrozen(diagramRegistry), true);
  assert.deepEqual(Object.keys(iconRegistry), requiredIcons);
  assert.deepEqual(Object.keys(diagramRegistry), requiredDiagrams);
});

test("iconSvg emits the unified 24x24 rendering contract", () => {
  const markup = iconSvg("layouts", {
    className: "line-icon process-icon",
    size: "1em"
  });

  assert.match(markup, /^<svg\b/);
  assert.match(markup, /class="jq-icon line-icon process-icon"/);
  assert.match(markup, /data-icon-name="layouts"/);
  assert.match(markup, /viewBox="0 0 24 24"/);
  assert.match(markup, /width="1em" height="1em"/);
  assert.match(markup, /fill="none"/);
  assert.match(markup, /stroke="currentColor"/);
  assert.match(markup, /stroke-width="1\.5"/);
  assert.match(markup, /stroke-linecap="round"/);
  assert.match(markup, /stroke-linejoin="round"/);
  assert.match(markup, /aria-hidden="true"/);
  assert.match(markup, /focusable="false"/);
  assert.equal((markup.match(/<svg\b/g) || []).length, 1);
});

test("diagramSvg emits the unified 64x36 rendering contract", () => {
  const markup = diagramSvg("crown-classic", { class: "style-diagram" });

  assert.match(markup, /^<svg\b/);
  assert.match(markup, /class="jq-diagram style-diagram"/);
  assert.match(markup, /data-diagram-name="crown-classic"/);
  assert.match(markup, /viewBox="0 0 64 36"/);
  assert.match(markup, /width="64" height="36"/);
  assert.match(markup, /stroke="currentColor"/);
  assert.match(markup, /stroke-width="1\.5"/);
  assert.match(markup, /stroke-linecap="round"/);
  assert.match(markup, /stroke-linejoin="round"/);
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
  assert.match(warnings[0], /Unknown icon name: not-a-real-icon/);
  assert.match(warnings[1], /Unknown diagram name: not-a-real-diagram/);
  assert.match(warnings[2], /Unknown icon name: still-not-real/);
});

test("setIcon and mountIcons work with caller-supplied DOM-like hosts", () => {
  const first = {
    innerHTML: "",
    getAttribute: (name) => name === "data-icon" ? "materials" : null
  };
  const second = {
    innerHTML: "",
    dataset: { icon: "lighting" }
  };
  const root = {
    querySelectorAll: (selector) => selector === "[data-icon]" ? [first, second] : []
  };

  assert.equal(setIcon(first, "layouts"), true);
  assert.match(first.innerHTML, /data-icon-name="layouts"/);
  assert.equal(mountIcons(root), 2);
  assert.match(first.innerHTML, /data-icon-name="materials"/);
  assert.match(second.innerHTML, /data-icon-name="lighting"/);
});

test("registry fragments are inert, presentation-free SVG geometry", () => {
  const allowedElement = /<(?:path|rect|circle|line|polyline|ellipse)\b(?:\s+[a-z][\w-]*="[^"]*")*\s*\/>/g;
  const unsafeMarkup = /<\/?(?:svg|script|style|foreignObject|iframe)\b|\bon[a-z]+\s*=|\b(?:href|src|id|class|style|fill|stroke)\s*=/i;

  for (const [name, fragment] of [
    ...Object.entries(iconRegistry),
    ...Object.entries(diagramRegistry)
  ]) {
    assert.equal(typeof fragment, "string", `${name} must be SVG markup`);
    assert.ok(fragment.length > 0, `${name} must not be empty`);
    assert.doesNotMatch(fragment, unsafeMarkup, `${name} contains unsafe or presentation markup`);
    assert.equal(
      fragment.replace(allowedElement, "").trim(),
      "",
      `${name} contains unsupported SVG markup`
    );
  }
});

test("every page and generated interface references a registered icon", () => {
  const sourceFiles = [
    ...readdirSync(rootDir).filter((file) => file.endsWith(".html")),
    "site.js",
    "configurator-3d.js"
  ];

  for (const file of sourceFiles) {
    const source = readFileSync(path.join(rootDir, file), "utf8");
    const iconNames = [
      ...source.matchAll(/data-icon="([^"]+)"/g),
      ...source.matchAll(/iconSvg\("([^"]+)"/g)
    ].map((match) => match[1]);
    const diagramNames = [...source.matchAll(/diagramSvg\("([^"]+)"/g)]
      .map((match) => match[1]);

    for (const name of iconNames) {
      assert.ok(iconRegistry[name], `${file} references unknown icon: ${name}`);
    }
    for (const name of diagramNames) {
      assert.ok(diagramRegistry[name], `${file} references unknown diagram: ${name}`);
    }
  }
});

test("public sources contain no retired icon registries or character glyph controls", () => {
  const sources = [
    ...readdirSync(rootDir)
      .filter((file) => file.endsWith(".html"))
      .map((file) => readFileSync(path.join(rootDir, file), "utf8")),
    readFileSync(path.join(rootDir, "site.js"), "utf8"),
    readFileSync(path.join(rootDir, "configurator-3d.js"), "utf8"),
    readFileSync(path.join(rootDir, "configurator.css"), "utf8")
  ].join("\n");

  assert.doesNotMatch(sources, /\b(?:iconMap|lineIconSvg|productPreviewSvg)\b/);
  assert.doesNotMatch(sources, /--cfg-section-icon|data:image\/svg\+xml/);
  assert.doesNotMatch(sources, /&(?:rarr|rsaquo|minus);|&#10003;/);
  assert.doesNotMatch(sources, /class="accordion-icon"[^>]*>\s*\+/);
});
