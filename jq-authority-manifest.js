import { AUTHORITY_STATUS, createAuthorityRegistry } from "./jq-authority-registry.js";

export const JQ_AUTHORITY_SOURCE_IDS = Object.freeze({
  bookcasesJuly5: "BOOKCASES-7-5-26.pdf",
  fireplaceJuly17: "Fireplace Bookcases 7-17-26.pdf"
});

const drawingSource = (ref, page, note) => Object.freeze({
  type: "authoritative-jq-drawing",
  ref,
  page,
  note
});

const bookcaseDrawing = (page, note) => drawingSource(
  JQ_AUTHORITY_SOURCE_IDS.bookcasesJuly5,
  page,
  note
);

const fireplaceDrawing = (note) => drawingSource(
  JQ_AUTHORITY_SOURCE_IDS.fireplaceJuly17,
  1,
  note
);

/**
 * Authority records backed by the supplied JQ drawing packages.
 *
 * Important: the manifest does not inherit "support" from an old UI or from a
 * renderer. Product, layout and combination records are explicit so a product
 * and a room condition cannot become orderable merely because each exists in
 * isolation. Missing combinations are denied by the registry.
 */
export const JQ_AUTHORITY_RECORDS_V1 = Object.freeze([
  // Drawing-backed construction rules.
  Object.freeze({
    id: "rule:shelf-span:mdf-1in-27in",
    kind: "construction-rule",
    status: AUTHORITY_STATUS.approved,
    sources: [
      bookcaseDrawing(1, '1" MDF shelf max width = 27"'),
      fireplaceDrawing('1" MDF shelf max width = 27"')
    ],
    constraints: { material: "MDF", thicknessIn: 1, maximumClearSpanIn: 27 }
  }),
  Object.freeze({
    id: "rule:shelf-span:mdf-1.25in-31in",
    kind: "construction-rule",
    status: AUTHORITY_STATUS.approved,
    sources: [
      bookcaseDrawing(1, '1 1/4" MDF shelf max width = 31"'),
      fireplaceDrawing('1 1/4" MDF shelf max width = 31"')
    ],
    constraints: { material: "MDF", thicknessIn: 1.25, maximumClearSpanIn: 31 }
  }),
  Object.freeze({
    id: "rule:shelf-span:mdf-1.5in-36in",
    kind: "construction-rule",
    status: AUTHORITY_STATUS.approved,
    sources: [
      bookcaseDrawing(1, '1 1/2" MDF shelf max width = 36"'),
      fireplaceDrawing('1 1/2" MDF shelf max width = 36"')
    ],
    constraints: { material: "MDF", thicknessIn: 1.5, maximumClearSpanIn: 36 }
  }),
  Object.freeze({
    id: "rule:countertop-thickness:1.25in",
    kind: "construction-rule",
    status: AUTHORITY_STATUS.approved,
    sources: [
      bookcaseDrawing(3, 'All countertops we will show at 1 1/4"'),
      fireplaceDrawing('1 1/4" fixed countertop shown at lower cabinet top')
    ],
    constraints: { thicknessIn: 1.25 }
  }),
  Object.freeze({
    id: "rule:shelf-pin-diameter:5mm",
    kind: "construction-rule",
    status: AUTHORITY_STATUS.approved,
    sources: [fireplaceDrawing("Typical 5 mm standard pin; finishes can vary")],
    constraints: { diameterMm: 5 }
  }),
  Object.freeze({
    id: "rule:shelf-adjustment:two-up-two-down",
    kind: "construction-rule",
    status: AUTHORITY_STATUS.approved,
    sources: [fireplaceDrawing("2 up 2 down adjustment typical")],
    constraints: { positionsUp: 2, positionsDown: 2 }
  }),
  Object.freeze({
    id: "rule:filler-minimum:0.75in",
    kind: "construction-rule",
    status: AUTHORITY_STATUS.conditional,
    sources: [fireplaceDrawing('3/4" minimum filler width')],
    constraints: { minimumIn: 0.75 },
    notes: "Drawing is explicit, but global applicability across every JQ product still requires confirmation."
  }),

  // Base / installation choices stated by the bookcase drawing set.
  Object.freeze({
    id: "base:built-in-flush-room-base",
    kind: "base-option",
    status: AUTHORITY_STATUS.approved,
    sources: [bookcaseDrawing(1, "Built in option with flush room base")]
  }),
  Object.freeze({
    id: "base:built-in-recessed-toe-kick",
    kind: "base-option",
    status: AUTHORITY_STATUS.approved,
    sources: [bookcaseDrawing(2, "Built in option with recessed toekick")]
  }),
  Object.freeze({
    id: "installation:freestanding-no-fillers-recessed-toe-kick",
    kind: "installation-option",
    status: AUTHORITY_STATUS.approved,
    sources: [bookcaseDrawing(2, "Free standing no fillers option with recessed toekick")]
  }),

  // Drawing templates / layout families.
  Object.freeze({
    id: "layout:alcove-built-ins",
    kind: "layout-family",
    status: AUTHORITY_STATUS.approved,
    sources: [bookcaseDrawing(3, "Additional options for Alcove built ins")]
  }),
  Object.freeze({
    id: "template:living-room-elevation-a",
    kind: "drawing-template",
    status: AUTHORITY_STATUS.approved,
    sources: [bookcaseDrawing(4, "Living Room Elevation A / Section S2")]
  }),
  Object.freeze({
    id: "template:bedroom-4-elevation-e",
    kind: "drawing-template",
    status: AUTHORITY_STATUS.approved,
    sources: [bookcaseDrawing(5, "Bedroom 4 Elevation E / Section S4")]
  }),
  Object.freeze({
    id: "template:bedroom-3-elevation-c",
    kind: "drawing-template",
    status: AUTHORITY_STATUS.approved,
    sources: [bookcaseDrawing(6, "Bedroom 3 Elevation C / Section S3")]
  }),
  Object.freeze({
    id: "template:lower-doors-open-shelves",
    kind: "drawing-template",
    status: AUTHORITY_STATUS.approved,
    sources: [bookcaseDrawing(7, "Lower paired doors with open shelving above")]
  }),
  Object.freeze({
    id: "template:fireplace-paired-bookcases",
    kind: "drawing-template",
    status: AUTHORITY_STATUS.approved,
    sources: [fireplaceDrawing("Paired lower-door/open-shelf bookcases flanking fireplace")]
  }),

  // Customer-facing product families. Only directly depicted families are
  // approved; old UI concepts without an authoritative drawing remain pending.
  Object.freeze({
    id: "product:cabinet-shelves",
    kind: "product",
    status: AUTHORITY_STATUS.approved,
    sources: [bookcaseDrawing(7, "Lower paired doors with open shelving above")]
  }),
  Object.freeze({
    id: "product:drawer-shelves",
    kind: "product",
    status: AUTHORITY_STATUS.approved,
    sources: [
      bookcaseDrawing(5, "Bedroom 4 lower drawers with open shelving above"),
      bookcaseDrawing(6, "Bedroom 3 lower drawers with open shelving above")
    ]
  }),
  Object.freeze({
    id: "product:tv-unit",
    kind: "product",
    status: AUTHORITY_STATUS.approved,
    sources: [bookcaseDrawing(4, "Living Room elevation with central TV opening")]
  }),
  Object.freeze({
    id: "product:open-shelving",
    kind: "product",
    status: AUTHORITY_STATUS.pending,
    notes: "Present in the existing guided catalog, but no dedicated authoritative product drawing has been locked yet."
  }),
  Object.freeze({
    id: "product:floating-storage",
    kind: "product",
    status: AUTHORITY_STATUS.pending,
    notes: "Existing guided concept; no authoritative JQ drawing in the current Task 1 source set."
  }),
  Object.freeze({
    id: "product:window-storage",
    kind: "product",
    status: AUTHORITY_STATUS.pending,
    notes: "Existing guided concept; no authoritative JQ drawing in the current Task 1 source set."
  }),
  Object.freeze({
    id: "product:radiator-cover",
    kind: "product",
    status: AUTHORITY_STATUS.pending,
    notes: "Existing guided concept; no authoritative JQ drawing in the current Task 1 source set."
  }),

  // Customer-facing room layouts. Clear wall and alcove are drawing-backed.
  // Fireplace is review-only until its clearance contract is approved.
  Object.freeze({
    id: "layout:clear-wall",
    kind: "room-layout",
    status: AUTHORITY_STATUS.approved,
    sources: [bookcaseDrawing(4, "Living Room full wall elevation without an alcove condition")]
  }),
  Object.freeze({
    id: "layout:niche-layout",
    kind: "room-layout",
    status: AUTHORITY_STATUS.approved,
    sources: [bookcaseDrawing(3, "Additional options for Alcove built ins")]
  }),
  Object.freeze({
    id: "layout:left-niche",
    kind: "room-layout",
    status: AUTHORITY_STATUS.pending,
    notes: "One-sided alcove behavior exists in legacy work, but this exact public layout ID has not been tied to a locked drawing contract."
  }),
  Object.freeze({
    id: "layout:right-niche",
    kind: "room-layout",
    status: AUTHORITY_STATUS.pending,
    notes: "One-sided alcove behavior exists in legacy work, but this exact public layout ID has not been tied to a locked drawing contract."
  }),
  Object.freeze({
    id: "layout:fireplace-wall",
    kind: "room-layout",
    status: AUTHORITY_STATUS.conditional,
    sources: [fireplaceDrawing("Paired bookcases flanking fireplace")],
    notes: "The layout family is documented, but exact fireplace safety/clearance rules remain a required review gate."
  }),
  Object.freeze({ id: "layout:center-recess", kind: "room-layout", status: AUTHORITY_STATUS.pending }),
  Object.freeze({ id: "layout:window-wall", kind: "room-layout", status: AUTHORITY_STATUS.pending }),
  Object.freeze({ id: "layout:door-wall", kind: "room-layout", status: AUTHORITY_STATUS.pending }),
  Object.freeze({ id: "layout:corner-wall", kind: "room-layout", status: AUTHORITY_STATUS.pending }),
  Object.freeze({ id: "layout:double-opening", kind: "room-layout", status: AUTHORITY_STATUS.pending }),

  // Product + layout combinations are independently authorized. This prevents
  // two individually known choices from becoming a silently invented product.
  Object.freeze({
    id: "combination:cabinet-shelves+clear-wall",
    kind: "product-layout-combination",
    status: AUTHORITY_STATUS.approved,
    sources: [bookcaseDrawing(7, "Lower paired doors with open shelving above")]
  }),
  Object.freeze({
    id: "combination:cabinet-shelves+niche-layout",
    kind: "product-layout-combination",
    status: AUTHORITY_STATUS.approved,
    sources: [bookcaseDrawing(3, "Alcove built-in option with lower doors and open shelving")]
  }),
  Object.freeze({
    id: "combination:drawer-shelves+clear-wall",
    kind: "product-layout-combination",
    status: AUTHORITY_STATUS.approved,
    sources: [bookcaseDrawing(5, "Bedroom 4 drawer-base/open-shelf elevation")]
  }),
  Object.freeze({
    id: "combination:tv-unit+clear-wall",
    kind: "product-layout-combination",
    status: AUTHORITY_STATUS.approved,
    sources: [bookcaseDrawing(4, "Living Room TV unit elevation")]
  }),
  Object.freeze({
    id: "combination:cabinet-shelves+fireplace-wall",
    kind: "product-layout-combination",
    status: AUTHORITY_STATUS.conditional,
    sources: [fireplaceDrawing("Paired cabinet/open-shelf bookcases flanking fireplace")],
    notes: "Requires the fireplace clearance contract before customer acceptance."
  })
]);

export const JQ_AUTHORITY_REGISTRY_V1 = createAuthorityRegistry(JQ_AUTHORITY_RECORDS_V1);
