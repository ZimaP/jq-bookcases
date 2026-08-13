import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateJqProjectAuthority,
  resolveJqAuthorityProductId
} from "../jq-project-authority.js";

test("browser category/style state resolves to the same JQ authority product IDs as engine fixtures", () => {
  const cases = [
    [{ category: "bookcase", style: "cabinet-base-shelves" }, "cabinet-shelves"],
    [{ category: "bookcase", style: "drawer-base-shelves" }, "drawer-shelves"],
    [{ category: "bookcase", style: "full-open-shelving" }, "open-shelving"],
    [{ category: "tv-unit", style: "framed-tv-wall" }, "tv-unit"],
    [{ category: "tv-unit", style: "library-media" }, "tv-unit"],
    [{ category: "floating-storage", style: "floating-drawer-bank" }, "floating-storage"],
    [{ category: "window-storage", style: "window-seat-storage" }, "window-storage"],
    [{ category: "radiator-cover", style: "clean-slat-cover" }, "radiator-cover"]
  ];

  for (const [project, expected] of cases) {
    assert.equal(resolveJqAuthorityProductId(project), expected, JSON.stringify(project));
  }
});

test("direct product identity wins over presentation category/style metadata", () => {
  assert.equal(
    resolveJqAuthorityProductId({
      productId: "drawer-shelves",
      category: "bookcase",
      style: "cabinet-base-shelves"
    }),
    "drawer-shelves"
  );
});

test("real browser-style cabinet alcove state passes geometry authority", () => {
  const result = evaluateJqProjectAuthority({
    category: "bookcase",
    style: "cabinet-base-shelves",
    layout: "niche-layout"
  });
  assert.equal(result.accepted, true, JSON.stringify(result.failures));
  assert.ok(result.authorityIds.includes("product:cabinet-shelves"));
  assert.ok(result.authorityIds.includes("combination:cabinet-shelves+niche-layout"));
});

test("real browser-style TV/right-niche state is rejected by exact combination authority", () => {
  const result = evaluateJqProjectAuthority({
    category: "tv-unit",
    style: "framed-tv-wall",
    layout: "right-niche"
  });
  assert.equal(result.accepted, false);
  assert.equal(result.decision, "reject");
  assert.ok(result.failures.some(({ id }) => id === "layout:right-niche"));
  assert.ok(result.failures.some(({ id }) => id === "combination:tv-unit+right-niche"));
});
