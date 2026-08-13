import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateAuthorityCatalogCombination,
  getAuthorizedLayoutsForProduct,
  getAuthorizedProductChoices,
  getAuthorityCatalogSummary
} from "../guided-authority-catalog.js";

test("Step 1 exposes only products with at least one exact approved geometry combination", () => {
  const products = getAuthorizedProductChoices();
  assert.deepEqual(products.map(({ id }) => id), [
    "cabinet-shelves",
    "drawer-shelves",
    "open-shelving",
    "tv-unit"
  ]);
  assert.ok(products.every(({ authoritySelectable }) => authoritySelectable));
  assert.ok(products.every(({ authorizedLayoutIds }) => authorizedLayoutIds.length > 0));
});

test("cabinet layouts expose approved rooms and keep fireplace as a non-selectable review card", () => {
  const layouts = getAuthorizedLayoutsForProduct("cabinet-shelves");
  assert.deepEqual(layouts.map(({ id }) => id), [
    "niche-layout",
    "clear-wall",
    "fireplace-wall"
  ]);
  assert.equal(layouts.find(({ id }) => id === "niche-layout").authoritySelectable, true);
  assert.equal(layouts.find(({ id }) => id === "clear-wall").authoritySelectable, true);
  assert.equal(layouts.find(({ id }) => id === "fireplace-wall").authoritySelectable, false);
  assert.equal(layouts.find(({ id }) => id === "fireplace-wall").authorityReviewOnly, true);
});

test("drawer, open-shelving and TV layouts do not inherit unsupported room combinations", () => {
  assert.deepEqual(
    getAuthorizedLayoutsForProduct("drawer-shelves").map(({ id }) => id),
    ["niche-layout", "clear-wall"]
  );
  assert.deepEqual(
    getAuthorizedLayoutsForProduct("open-shelving").map(({ id }) => id),
    ["clear-wall"]
  );
  assert.deepEqual(
    getAuthorizedLayoutsForProduct("tv-unit").map(({ id }) => id),
    ["clear-wall"]
  );
});

test("legacy product concepts with no approved geometry combination disappear from the configurable catalog", () => {
  const ids = new Set(getAuthorizedProductChoices().map(({ id }) => id));
  for (const id of ["floating-storage", "window-storage", "radiator-cover"]) {
    assert.equal(ids.has(id), false, id);
  }
});

test("review-only combinations are visible only when requested and can never report selectable", () => {
  const withReview = getAuthorizedLayoutsForProduct("cabinet-shelves");
  const withoutReview = getAuthorizedLayoutsForProduct("cabinet-shelves", { includeReview: false });
  assert.ok(withReview.some(({ id }) => id === "fireplace-wall"));
  assert.equal(withoutReview.some(({ id }) => id === "fireplace-wall"), false);

  const fireplace = evaluateAuthorityCatalogCombination("cabinet-shelves", "fireplace-wall");
  assert.equal(fireplace.decision, "review");
  assert.equal(fireplace.visible, true);
  assert.equal(fireplace.selectable, false);
  assert.equal(fireplace.reviewOnly, true);
});

test("browser category/style project state can project layouts without a productId field", () => {
  const layouts = getAuthorizedLayoutsForProduct({
    category: "bookcase",
    style: "drawer-base-shelves"
  });
  assert.deepEqual(layouts.map(({ id }) => id), ["niche-layout", "clear-wall"]);
});

test("catalog summary is deterministic and contains only exact authorized/review combinations", () => {
  const first = getAuthorityCatalogSummary();
  const repeated = getAuthorityCatalogSummary();
  assert.deepEqual(repeated, first);
  assert.deepEqual(first.selectableProductIds, [
    "cabinet-shelves",
    "drawer-shelves",
    "open-shelving",
    "tv-unit"
  ]);
  assert.deepEqual(first.reviewOnlyProductIds, []);
  assert.deepEqual(first.selectableCombinations, [
    "cabinet-shelves+niche-layout",
    "cabinet-shelves+clear-wall",
    "drawer-shelves+niche-layout",
    "drawer-shelves+clear-wall",
    "open-shelving+clear-wall",
    "tv-unit+clear-wall"
  ]);
  assert.deepEqual(first.reviewCombinations, [
    "cabinet-shelves+fireplace-wall"
  ]);
});
