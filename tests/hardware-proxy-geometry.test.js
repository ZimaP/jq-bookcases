import test from "node:test";
import assert from "node:assert/strict";

import { createCabinetLatchProxyParts } from "../hardware-proxy-geometry.js";

test("cabinet latch body and catch swap handed sides when mirrored", () => {
  const normal = createCabinetLatchProxyParts([10, 4, 2], [20, 30, 40], false);
  const mirrored = createCabinetLatchProxyParts([10, 4, 2], [20, 30, 40], true);

  assert.ok(normal.body.position[0] < 20);
  assert.ok(normal.catch.position[0] > 20);
  assert.ok(mirrored.body.position[0] > 20);
  assert.ok(mirrored.catch.position[0] < 20);
  assert.equal(mirrored.body.position[0] - 20, 20 - normal.body.position[0]);
  assert.equal(20 - mirrored.catch.position[0], normal.catch.position[0] - 20);
  assert.deepEqual(mirrored.body.size, normal.body.size);
  assert.deepEqual(mirrored.catch.size, normal.catch.size);
});

test("cabinet latch recipe rejects malformed vectors", () => {
  assert.throws(() => createCabinetLatchProxyParts([1, 2], [0, 0, 0]), /size/);
  assert.throws(() => createCabinetLatchProxyParts([1, 2, 3], [0, Number.NaN, 0]), /position/);
});
