import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../cabinet-ar-placement.js", import.meta.url), "utf8");

test("AR placement enhancement keeps true size as the default and offers adjustable placement", () => {
  assert.match(source, /True Size/);
  assert.match(source, /Easy Placement/);
  assert.match(source, /arScale: "fixed"/);
  assert.match(source, /arScale: "auto"/);
  assert.match(source, /Pinch to resize/);
  assert.match(source, /not measurement-accurate/);
});

test("AR placement enhancement includes tracking stability guidance", () => {
  assert.match(source, /bright, evenly lit room/);
  assert.match(source, /floor and wall edge visible/);
  assert.match(source, /5–10 seconds/);
  assert.match(source, /rescan from a lower angle/);
  assert.match(source, /Tracking was lost/);
});
