import { AUTHORITY_STATUS } from "./jq-authority-registry.js";

export const JQ_OWNER_AUTHORITY_SOURCE_IDS = Object.freeze({
  standardizationEmail: "John Quinn email — Re: Some stuff — 2026-07-17 16:32 ET"
});

const ownerEmailSource = (note) => Object.freeze({
  type: "jq-owner-email",
  ref: JQ_OWNER_AUTHORITY_SOURCE_IDS.standardizationEmail,
  note
});

/**
 * Owner-authored authority that is explicit in John's July 17 standardization
 * email. Exploratory ideas remain pending until John locks a final selection.
 */
export const JQ_OWNER_AUTHORITY_RECORDS_V1 = Object.freeze([
  Object.freeze({
    id: "material:interior-clear-maple-uv",
    kind: "material-rule",
    status: AUTHORITY_STATUS.approved,
    sources: [ownerEmailSource("All interior cabinetry will have a clear maple UV-coated finish; standard prefinished maple.")],
    constraints: {
      scope: "interior-cabinetry",
      substrate: "maple",
      finish: "clear-uv-coated",
      prefabricatedFinish: true
    }
  }),
  Object.freeze({
    id: "finish-family:sherwin-williams-cabinet-grade",
    kind: "finish-family",
    status: AUTHORITY_STATUS.pending,
    sources: [ownerEmailSource("Sherwin-Williams cabinet-grade finishes were under consideration, not yet locked.")],
    notes: "Do not expose as an approved customer finish family until exact products/colors are selected."
  }),
  Object.freeze({
    id: "finish-family:white-oak-prefinished-plywood",
    kind: "finish-family",
    status: AUTHORITY_STATUS.pending,
    sources: [ownerEmailSource("White oak prefinished plywood was being tested for viability.")]
  }),
  Object.freeze({
    id: "finish-family:walnut-prefinished-plywood",
    kind: "finish-family",
    status: AUTHORITY_STATUS.pending,
    sources: [ownerEmailSource("Walnut prefinished plywood was being tested for viability.")]
  }),
  Object.freeze({
    id: "finish-family:shop-primed",
    kind: "finish-family",
    status: AUTHORITY_STATUS.pending,
    sources: [ownerEmailSource("Shop primed was described as a possible offering for contractor-painted work.")]
  }),
  Object.freeze({
    id: "crown-family:dykes",
    kind: "crown-family",
    status: AUTHORITY_STATUS.pending,
    sources: [ownerEmailSource("Dykes molding was identified as the source, but exact crown choices were still to be selected.")]
  }),
  Object.freeze({
    id: "lighting-system:customer-option",
    kind: "lighting-system",
    status: AUTHORITY_STATUS.pending,
    sources: [ownerEmailSource("Lighting was desired, but the actual system still needed to be selected.")]
  }),
  Object.freeze({
    id: "door-options:limited-set",
    kind: "door-option-policy",
    status: AUTHORITY_STATUS.conditional,
    sources: [ownerEmailSource("A few door options may be shown, but the exact approved set was not yet selected.")],
    notes: "Exact door profiles/SKUs must be authorized individually before customer acceptance."
  })
]);
