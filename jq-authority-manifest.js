import { AUTHORITY_STATUS, createAuthorityRegistry } from "./jq-authority-registry.js";

export const JQ_AUTHORITY_SOURCE_IDS = Object.freeze({
  bookcasesJuly5: "BOOKCASES-7-5-26.pdf"
});

const drawingSource = (page, note) => Object.freeze({
  type: "authoritative-jq-drawing",
  ref: JQ_AUTHORITY_SOURCE_IDS.bookcasesJuly5,
  page,
  note
});

/**
 * Seed authority records that are stated or directly depicted in the July 5
 * JQ drawing set. This manifest intentionally contains only claims that can be
 * tied to an explicit drawing page. It does not promote other repository
 * defaults to approved product rules.
 */
export const JQ_AUTHORITY_RECORDS_V1 = Object.freeze([
  Object.freeze({
    id: "rule:shelf-span:mdf-1in-27in",
    kind: "construction-rule",
    status: AUTHORITY_STATUS.approved,
    sources: [drawingSource(1, '1" MDF shelf max width = 27"')],
    constraints: { material: "MDF", thicknessIn: 1, maximumClearSpanIn: 27 }
  }),
  Object.freeze({
    id: "rule:shelf-span:mdf-1.25in-31in",
    kind: "construction-rule",
    status: AUTHORITY_STATUS.approved,
    sources: [drawingSource(1, '1 1/4" MDF shelf max width = 31"')],
    constraints: { material: "MDF", thicknessIn: 1.25, maximumClearSpanIn: 31 }
  }),
  Object.freeze({
    id: "rule:shelf-span:mdf-1.5in-36in",
    kind: "construction-rule",
    status: AUTHORITY_STATUS.approved,
    sources: [drawingSource(1, '1 1/2" MDF shelf max width = 36"')],
    constraints: { material: "MDF", thicknessIn: 1.5, maximumClearSpanIn: 36 }
  }),
  Object.freeze({
    id: "base:built-in-flush-room-base",
    kind: "base-option",
    status: AUTHORITY_STATUS.approved,
    sources: [drawingSource(1, "Built in option with flush room base")]
  }),
  Object.freeze({
    id: "base:built-in-recessed-toe-kick",
    kind: "base-option",
    status: AUTHORITY_STATUS.approved,
    sources: [drawingSource(2, "Built in option with recessed toekick")]
  }),
  Object.freeze({
    id: "installation:freestanding-no-fillers-recessed-toe-kick",
    kind: "installation-option",
    status: AUTHORITY_STATUS.approved,
    sources: [drawingSource(2, "Free standing no fillers option with recessed toekick")]
  }),
  Object.freeze({
    id: "layout:alcove-built-ins",
    kind: "layout-family",
    status: AUTHORITY_STATUS.approved,
    sources: [drawingSource(3, "Additional options for Alcove built ins")]
  }),
  Object.freeze({
    id: "rule:countertop-thickness:1.25in",
    kind: "construction-rule",
    status: AUTHORITY_STATUS.approved,
    sources: [drawingSource(3, 'All countertops we will show at 1 1/4"')],
    constraints: { thicknessIn: 1.25 }
  }),
  Object.freeze({
    id: "template:living-room-elevation-a",
    kind: "drawing-template",
    status: AUTHORITY_STATUS.approved,
    sources: [drawingSource(4, "Living Room Elevation A / Section S2")]
  }),
  Object.freeze({
    id: "template:bedroom-4-elevation-e",
    kind: "drawing-template",
    status: AUTHORITY_STATUS.approved,
    sources: [drawingSource(5, "Bedroom 4 Elevation E / Section S4")]
  }),
  Object.freeze({
    id: "template:bedroom-3-elevation-c",
    kind: "drawing-template",
    status: AUTHORITY_STATUS.approved,
    sources: [drawingSource(6, "Bedroom 3 Elevation C / Section S3")]
  }),
  Object.freeze({
    id: "template:lower-doors-open-shelves",
    kind: "drawing-template",
    status: AUTHORITY_STATUS.approved,
    sources: [drawingSource(7, "Lower paired doors with open shelving above")]
  })
]);

export const JQ_AUTHORITY_REGISTRY_V1 = createAuthorityRegistry(JQ_AUTHORITY_RECORDS_V1);
