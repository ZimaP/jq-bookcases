import { AUTHORITY_STATUS } from "./jq-authority-registry.js";
import { JQ_AUTHORITY_SOURCE_IDS } from "./jq-authority-manifest.js";

const bookcaseDrawing = (page, note) => Object.freeze({
  type: "authoritative-jq-drawing",
  ref: JQ_AUTHORITY_SOURCE_IDS.bookcasesJuly5,
  page,
  note
});

/**
 * Drawing-audit addendum for facts that were under-classified in the first
 * conservative seed pass. These records are still backed by the same July 5
 * source; the addendum makes the later visual/page audit explicit and reviewable.
 */
export const JQ_DRAWING_AUTHORITY_OVERRIDE_IDS_V1 = Object.freeze([
  "product:open-shelving"
]);

export const JQ_DRAWING_AUTHORITY_ADDENDUM_RECORDS_V1 = Object.freeze([
  Object.freeze({
    id: "product:open-shelving",
    kind: "product",
    status: AUTHORITY_STATUS.approved,
    sources: [
      bookcaseDrawing(1, "Full-height open shelving shown as a built-in with flush room base"),
      bookcaseDrawing(2, "Full-height open shelving shown with recessed-toe-kick and freestanding variants")
    ]
  }),
  Object.freeze({
    id: "combination:open-shelving+clear-wall",
    kind: "product-layout-combination",
    status: AUTHORITY_STATUS.approved,
    sources: [
      bookcaseDrawing(1, "Open shelving straight-wall built-in condition"),
      bookcaseDrawing(2, "Open shelving straight-wall base/install variants")
    ]
  }),
  Object.freeze({
    id: "combination:drawer-shelves+niche-layout",
    kind: "product-layout-combination",
    status: AUTHORITY_STATUS.approved,
    sources: [
      bookcaseDrawing(3, "Alcove built-in options include lower drawers with open shelving above")
    ]
  })
]);
