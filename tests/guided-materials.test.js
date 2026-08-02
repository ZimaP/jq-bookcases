import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";

import {
  GUIDED_MATERIAL_MANIFEST,
  computePhysicalUvScales,
  createGuidedMaterialLibrary,
  applyPhysicalExtrusionUvs,
  getGuidedGrainOrientation,
  resolveGuidedMaterial
} from "../guided-materials.js";

class FakeColor {
  constructor(value) {
    this.value = value instanceof FakeColor ? value.value : value;
  }

  lerp() {
    return this;
  }
}

class FakeMaterial {
  constructor(parameters = {}) {
    Object.assign(this, parameters);
    this.color = parameters.color instanceof FakeColor
      ? new FakeColor(parameters.color)
      : new FakeColor(parameters.color);
    this.isMaterial = true;
    this.userData = {};
  }

  clone() {
    return new this.constructor({ ...this, color: new FakeColor(this.color) });
  }
}

const FakeThree = {
  Color: FakeColor,
  MeshStandardMaterial: FakeMaterial,
  MeshPhysicalMaterial: FakeMaterial,
  LineBasicMaterial: FakeMaterial,
  TextureLoader: class {
    load(source) {
      return { source, userData: {} };
    }
  },
  Vector2: class {
    constructor(x, y) {
      this.x = x;
      this.y = y;
    }
  },
  RepeatWrapping: "repeat",
  SRGBColorSpace: "srgb"
};

test("the shipped runtime package assets retain their manifest bytes and hashes", () => {
  const manifest = JSON.parse(readFileSync(
    new URL("../config/asset-manifest.json", import.meta.url),
    "utf8"
  ));
  const runtimeEntries = manifest.assets.filter(({ path }) => (
    path.startsWith("assets/environments/")
    || path.startsWith("assets/textures/")
    || path.startsWith("config/")
  ));

  assert.ok(runtimeEntries.length >= 30);
  for (const entry of runtimeEntries) {
    const url = new URL(`../${entry.path}`, import.meta.url);
    const bytes = readFileSync(url);
    assert.equal(statSync(url).size, entry.bytes, `${entry.path} byte count`);
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      entry.sha256,
      `${entry.path} hash`
    );
  }
});

test("material manifest exposes the supplied five wood systems and four package paint systems", () => {
  assert.equal(Object.keys(GUIDED_MATERIAL_MANIFEST.woods).length, 5);
  assert.equal(
    Object.values(GUIDED_MATERIAL_MANIFEST.paints).filter((entry) => !entry.legacy).length,
    4
  );
  for (const wood of Object.values(GUIDED_MATERIAL_MANIFEST.woods)) {
    assert.match(wood.maps.map, /albedo\.jpg$/);
    assert.match(wood.maps.normalMap, /normal\.png$/);
    assert.match(wood.maps.roughnessMap, /roughness\.png$/);
    assert.match(wood.maps.aoMap, /ao\.png$/);
  }
  assert.deepEqual(
    Object.keys(GUIDED_MATERIAL_MANIFEST.accentPaints).sort(),
    ["deep-olive", "ink-blue", "warm-linen"]
  );
  for (const accent of Object.values(GUIDED_MATERIAL_MANIFEST.accentPaints)) {
    assert.match(accent.maps.normalMap, /sprayed-normal\.png$/);
    assert.match(accent.maps.roughnessMap, /sprayed-roughness\.png$/);
  }
});

test("unknown finish resolution is deterministic and preserves legacy greige explicitly", () => {
  assert.equal(resolveGuidedMaterial("not-a-finish").id, "natural-oak");
  assert.equal(resolveGuidedMaterial("light-greige").legacy, true);
});

test("physical UV scales follow inches rather than object scale", () => {
  const first = computePhysicalUvScales([24, 48, 12], [24, 48], "door");
  const wider = computePhysicalUvScales([48, 48, 12], [24, 48], "door");
  assert.deepEqual(first.zFaces, [1, 1]);
  assert.deepEqual(wider.zFaces, [2, 1]);
  assert.equal(first.orientation, "vertical");
});

test("shelves and crown use their long or extrusion axis for grain", () => {
  assert.equal(getGuidedGrainOrientation("shelf"), "long-axis");
  assert.equal(getGuidedGrainOrientation("crown"), "extrusion-axis");
  assert.equal(getGuidedGrainOrientation("front_stile"), "vertical");
  assert.equal(getGuidedGrainOrientation("front_rail"), "long-axis");
  assert.equal(getGuidedGrainOrientation("front_field"), "vertical");
  assert.equal(computePhysicalUvScales([48, 1.25, 14], [24, 48], "shelf").rotateFront, true);
});

test("extrusion UVs preserve physical repeat length and produce matching uv2 data", () => {
  class Attribute {
    constructor(values) {
      this.values = values.map((value) => [...value]);
      this.count = values.length;
      this.needsUpdate = false;
    }
    getX(index) { return this.values[index][0]; }
    getY(index) { return this.values[index][1]; }
    getZ(index) { return this.values[index][2]; }
    setXY(index, x, y) { this.values[index][0] = x; this.values[index][1] = y; }
    clone() { return new Attribute(this.values); }
  }
  const geometryForLength = (lengthInches) => ({
    attributes: {
      position: new Attribute([[0, 0, 0], [lengthInches / 12, 1 / 12, 0]]),
      uv: new Attribute([[0, 0], [0, 0]])
    },
    userData: {},
    setAttribute(name, attribute) { this.attributes[name] = attribute; }
  });
  const short = geometryForLength(48);
  const long = geometryForLength(96);

  assert.equal(applyPhysicalExtrusionUvs(short, [24, 48], "x", { unitsPerInch: 1 / 12 }), true);
  assert.equal(applyPhysicalExtrusionUvs(long, [24, 48], "x", { unitsPerInch: 1 / 12 }), true);
  assert.equal(short.attributes.uv.getY(1) - short.attributes.uv.getY(0), 1);
  assert.equal(long.attributes.uv.getY(1) - long.attributes.uv.getY(0), 2);
  assert.deepEqual(short.attributes.uv2.values, short.attributes.uv.values);
  assert.equal(short.userData.guidedPhysicalUvs.orientation, "extrusion-axis");
  assert.equal(short.userData.guidedPhysicalUvs.units, "inches");
});

test("no-accent finish clones the selected exterior PBR surface instead of flattening it", () => {
  const library = createGuidedMaterialLibrary(FakeThree, {
    finish: { id: "natural-oak" },
    accentFinish: { id: "no-accent" }
  });

  assert.notEqual(library.accent, library.case);
  for (const slot of ["map", "normalMap", "roughnessMap", "aoMap"]) {
    assert.equal(library.accent[slot], library.case[slot], `${slot} remains on the cloned exterior surface`);
  }
  assert.equal(library.accent.roughness, library.case.roughness);
  assert.equal(library.accent.metalness, library.case.metalness);
});

test("colored accent paints reuse the sprayed-paint texture cache", () => {
  const first = createGuidedMaterialLibrary(FakeThree, {
    finish: { id: "warm-white" },
    accentFinish: { id: "ink-blue", color: "#384b59" }
  });
  const second = createGuidedMaterialLibrary(FakeThree, {
    finish: { id: "natural-oak" },
    accentFinish: { id: "deep-olive", color: "#5d6250" }
  });

  assert.equal(first.accent.normalMap, first.case.normalMap);
  assert.equal(first.accent.roughnessMap, first.case.roughnessMap);
  assert.equal(second.accent.normalMap, first.accent.normalMap);
  assert.equal(second.accent.roughnessMap, first.accent.roughnessMap);
  assert.equal(first.accent.userData.guidedFinishId, "ink-blue");
  assert.equal(second.accent.userData.guidedFinishId, "deep-olive");
  assert.equal(first.accentFinishId, "ink-blue");
  assert.equal(first.accentMatchesExterior, false);
});
