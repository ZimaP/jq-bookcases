# JQ Bookcases Authority Gate V1

## Purpose

JQ Bookcases must never manufacture, price, render, save, or present a product configuration that is based on guessed geometry or an unsupported option.

The authority gate is the boundary between customer intent and accepted product state. It is deliberately independent from the UI, geometry builder, materials, pricing, rendering, save/share, and final-review layers.

## Status model

Every meaningful product choice must resolve to exactly one authority status:

- `approved` — may enter accepted product state and must cite explicit source evidence.
- `conditional` — requires a separate resolved condition/review and may not silently enter accepted state.
- `pending` — known option, but not currently authorized for customer configuration.
- `unavailable` — intentionally unsupported.

Unknown records are rejected by default.

## Source evidence

An `approved` authority record must cite at least one explicit source. Typical source types include:

- JQ owner approval;
- authoritative JQ drawing / drawing page;
- approved finish sample or finish photo;
- approved hardware schedule / manufacturer part;
- approved pricing schedule;
- approved shop construction standard.

The registry records provenance; it does not infer approval from a similar product, industry convention, or a renderer that happens to look correct.

## Required integration order

The authority gate should be evaluated before a candidate configuration becomes accepted state.

1. Customer chooses Product, Layout, Dimensions, Options, and Finish.
2. Candidate selections resolve to authority record IDs.
3. Authority registry evaluates the complete candidate.
4. Any missing, pending, unavailable, or unresolved conditional record rejects the candidate.
5. Only an authority-approved candidate may continue to product rules / parametric geometry.
6. Geometry validation must pass.
7. The same accepted transaction feeds BOM, pricing, materials, renderer, save/share, quote, and final review.

No downstream subsystem may bypass this gate by reconstructing its own product assumptions.

## Task 1 acceptance criteria

- Authority registry is a pure module with no DOM, renderer, pricing, or geometry dependencies.
- Unknown authority IDs reject by default.
- Pending and unavailable statuses reject.
- Conditional status requires review and does not silently accept.
- Approved records require explicit source evidence.
- Duplicate authority IDs reject at registry construction time.
- A complete candidate fails when any required authority record fails.
- Unit tests cover the above behavior.

## Next integration step

Populate an authoritative JQ manifest from the current drawings, owner-approved finishes, hardware, layouts, dimensional ranges, and pricing schedule. Then wire the manifest into the one accepted engine-evaluation path so the UI can display only legal choices and the engine still rejects illegal programmatic or restored state.
