import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ICON_STROKE_WIDTH,
  diagramManifest,
  diagramRegistry,
  diagramSvg,
  iconManifest,
  iconRegistry,
  iconSvg
} from "../icon-system.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const allowedElement = /<(?:path|rect|circle|line|polyline|ellipse)\b(?:\s+[a-z][\w-]*="[^"]*")*\s*\/>/g;
const unsafeMarkup = /<\/?(?:svg|script|style|foreignObject|iframe|image)\b|\bon[a-z]+\s*=|\b(?:href|src|id|class|style|fill|stroke|filter|mask)\s*=/i;
const hardCodedColor = /#[\da-f]{3,8}\b|\b(?:rgb|hsl)a?\s*\(/i;
const pathToken = /[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/g;
const pathArity = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

function numberAttribute(markup, name) {
  const value = markup.match(new RegExp(`\\b${name}="([-.\\d]+)"`))?.[1];
  return value === undefined ? undefined : Number(value);
}

function include(bounds, x, y) {
  assert.ok(Number.isFinite(x) && Number.isFinite(y), "SVG geometry must contain finite coordinates");
  bounds.minX = Math.min(bounds.minX, x);
  bounds.minY = Math.min(bounds.minY, y);
  bounds.maxX = Math.max(bounds.maxX, x);
  bounds.maxY = Math.max(bounds.maxY, y);
}

function pathBounds(data) {
  const tokens = data.match(pathToken) || [];
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  let index = 0;
  let command = "";
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;

  while (index < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[index])) command = tokens[index++];
    assert.ok(command, `Path data is missing a command: ${data}`);
    const upper = command.toUpperCase();
    const arity = pathArity[upper];
    assert.notEqual(arity, undefined, `Unsupported SVG path command ${command}`);
    if (upper === "Z") {
      x = startX;
      y = startY;
      include(bounds, x, y);
      command = "";
      continue;
    }
    assert.ok(index + arity <= tokens.length, `Incomplete ${command} command in ${data}`);
    const values = tokens.slice(index, index + arity).map(Number);
    assert.ok(values.every(Number.isFinite), `Invalid number in ${data}`);
    index += arity;
    const relative = command === command.toLowerCase();
    const absolutePoint = (px, py) => [relative ? x + px : px, relative ? y + py : py];

    if (upper === "M" || upper === "L" || upper === "T") {
      [x, y] = absolutePoint(values[0], values[1]);
      include(bounds, x, y);
      if (upper === "M") {
        startX = x;
        startY = y;
        command = relative ? "l" : "L";
      }
    } else if (upper === "H") {
      x = relative ? x + values[0] : values[0];
      include(bounds, x, y);
    } else if (upper === "V") {
      y = relative ? y + values[0] : values[0];
      include(bounds, x, y);
    } else if (upper === "C") {
      const originX = x;
      const originY = y;
      include(bounds, relative ? originX + values[0] : values[0], relative ? originY + values[1] : values[1]);
      include(bounds, relative ? originX + values[2] : values[2], relative ? originY + values[3] : values[3]);
      x = relative ? originX + values[4] : values[4];
      y = relative ? originY + values[5] : values[5];
      include(bounds, x, y);
    } else if (upper === "S" || upper === "Q") {
      const originX = x;
      const originY = y;
      include(bounds, relative ? originX + values[0] : values[0], relative ? originY + values[1] : values[1]);
      x = relative ? originX + values[2] : values[2];
      y = relative ? originY + values[3] : values[3];
      include(bounds, x, y);
    } else if (upper === "A") {
      assert.ok(values[0] > 0 && values[1] > 0, `Arc radii must be positive in ${data}`);
      [x, y] = absolutePoint(values[5], values[6]);
      include(bounds, x, y);
    }
  }
  return bounds;
}

function geometryBounds(fragment) {
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const element of fragment.matchAll(/<(path|rect|circle|ellipse|line|polyline)\b([^>]*)\/>/g)) {
    const [markup, tag] = element;
    if (tag === "path") {
      const child = pathBounds(markup.match(/\bd="([^"]+)"/)?.[1] || "");
      include(bounds, child.minX, child.minY);
      include(bounds, child.maxX, child.maxY);
    } else if (tag === "rect") {
      const x = numberAttribute(markup, "x") || 0;
      const y = numberAttribute(markup, "y") || 0;
      include(bounds, x, y);
      include(bounds, x + numberAttribute(markup, "width"), y + numberAttribute(markup, "height"));
    } else if (tag === "circle") {
      const cx = numberAttribute(markup, "cx");
      const cy = numberAttribute(markup, "cy");
      const radius = numberAttribute(markup, "r");
      include(bounds, cx - radius, cy - radius);
      include(bounds, cx + radius, cy + radius);
    } else if (tag === "ellipse") {
      const cx = numberAttribute(markup, "cx");
      const cy = numberAttribute(markup, "cy");
      const rx = numberAttribute(markup, "rx");
      const ry = numberAttribute(markup, "ry");
      include(bounds, cx - rx, cy - ry);
      include(bounds, cx + rx, cy + ry);
    } else if (tag === "line") {
      include(bounds, numberAttribute(markup, "x1"), numberAttribute(markup, "y1"));
      include(bounds, numberAttribute(markup, "x2"), numberAttribute(markup, "y2"));
    } else if (tag === "polyline") {
      const pointSource = markup.match(/\bpoints="([^"]+)"/)?.[1] || "";
      const points = (pointSource.match(/[-.\d]+/g) || []).map(Number);
      assert.equal(points.length % 2, 0, `Polyline needs coordinate pairs: ${markup}`);
      for (let point = 0; point < points.length; point += 2) include(bounds, points[point], points[point + 1]);
    }
  }
  return bounds;
}

assert.equal(ICON_STROKE_WIDTH, 1.75, "The family must use one 1.75 stroke");
assert.deepEqual(Object.keys(iconManifest), Object.keys(iconRegistry));
assert.deepEqual(Object.keys(diagramManifest), Object.keys(diagramRegistry));

const geometryOwners = new Map();
for (const [name, fragment] of Object.entries(iconRegistry)) {
  assert.ok(fragment.length > 0, `${name} has no geometry`);
  assert.doesNotMatch(fragment, unsafeMarkup, `${name} contains presentation or unsafe markup`);
  assert.doesNotMatch(fragment, hardCodedColor, `${name} contains a hard-coded color`);
  assert.equal(fragment.replace(allowedElement, "").trim(), "", `${name} contains unsupported SVG markup`);
  assert.equal(geometryOwners.has(fragment), false, `${name} duplicates ${geometryOwners.get(fragment)}`);
  geometryOwners.set(fragment, name);

  const rendered = iconSvg(name);
  assert.match(rendered, /^<svg\b[^>]*viewBox="0 0 24 24"/);
  assert.match(rendered, /fill="none"/);
  assert.match(rendered, /stroke="currentColor"/);
  assert.match(rendered, /stroke-width="1\.75"/);
  assert.match(rendered, /stroke-linecap="round"/);
  assert.match(rendered, /stroke-linejoin="round"/);
  assert.doesNotMatch(rendered, /<image\b|data:image|\bid="/i);

  const bounds = geometryBounds(fragment);
  assert.ok(bounds.minX >= 1.5, `${name} extends left of the safety boundary (${bounds.minX})`);
  assert.ok(bounds.minY >= 1.5, `${name} extends above the safety boundary (${bounds.minY})`);
  assert.ok(bounds.maxX <= 22.5, `${name} extends right of the safety boundary (${bounds.maxX})`);
  assert.ok(bounds.maxY <= 22.5, `${name} extends below the safety boundary (${bounds.maxY})`);
}

for (const [name, fragment] of Object.entries(diagramRegistry)) {
  assert.doesNotMatch(fragment, unsafeMarkup, `${name} contains presentation or unsafe markup`);
  assert.doesNotMatch(fragment, hardCodedColor, `${name} contains a hard-coded color`);
  assert.equal(fragment.replace(allowedElement, "").trim(), "", `${name} contains unsupported SVG markup`);
  assert.match(diagramSvg(name), /viewBox="0 0 64 36"[^>]*stroke-width="1\.75"/);
}

const sourceFiles = [
  ...readdirSync(rootDir).filter((file) => file.endsWith(".html")),
  "site.js",
  "configurator-3d.js",
  "cabinet-ar-ui.js"
];
for (const file of sourceFiles) {
  const source = readFileSync(path.join(rootDir, file), "utf8");
  const iconNames = [...source.matchAll(/data-icon="([^"]+)"|iconSvg\("([^"]+)"/g)].map((match) => match[1] || match[2]);
  const diagramNames = [...source.matchAll(/diagramSvg\("([^"]+)"/g)].map((match) => match[1]);
  for (const name of iconNames) assert.ok(iconRegistry[name], `${file} references missing icon ${name}`);
  for (const name of diagramNames) assert.ok(diagramRegistry[name], `${file} references missing diagram ${name}`);
}

const publicSources = sourceFiles.map((file) => readFileSync(path.join(rootDir, file), "utf8")).join("\n");
assert.doesNotMatch(publicSources, /data:image\/svg\+xml|<image\b[^>]*href=|&(?:rarr|rsaquo|minus);|&#10003;/i);
assert.doesNotMatch(readFileSync(path.join(rootDir, "configurator-3d.js"), "utf8"), />\s*[×+−]\s*</);
assert.doesNotMatch(readFileSync(path.join(rootDir, "cabinet-ar-ui.js"), "utf8"), />\s*×\s*</);

console.log(`Validated ${Object.keys(iconRegistry).length} JQ icons and ${Object.keys(diagramRegistry).length} product profile drawings.`);
