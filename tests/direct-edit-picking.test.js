import test from "node:test";
import assert from "node:assert/strict";

import { resolveDirectEditIntersection } from "../direct-edit-picking.js";

const components = new Map([
  ["section-01", { id: "section-01", role: "section" }],
  ["section-01-shelf-01", { id: "section-01-shelf-01", role: "shelf" }]
]);
const getComponent = (id) => components.get(id) || null;
const isEditable = (component) => ["section", "shelf"].includes(component.role);

test("a section volume remains a fallback behind a visible recessed component", () => {
  const root = {};
  const sectionProxy = { userData: { componentId: "section-01" }, parent: root };
  const shelfMesh = { userData: {}, parent: { userData: { componentId: "section-01-shelf-01" }, parent: root } };

  const resolved = resolveDirectEditIntersection([
    { distance: 1, object: sectionProxy },
    { distance: 2, object: shelfMesh }
  ], { root, getComponent, isEditable });

  assert.equal(resolved?.id, "section-01-shelf-01");
});

test("an otherwise empty section resolves through its semantic volume", () => {
  const root = {};
  const sectionProxy = { userData: { componentId: "section-01" }, parent: root };
  const resolved = resolveDirectEditIntersection(
    [{ distance: 1, object: sectionProxy }],
    { root, getComponent, isEditable }
  );
  assert.equal(resolved?.id, "section-01");
});
