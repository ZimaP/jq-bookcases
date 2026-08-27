# JQ Bookcases Authority Audit — 2026-08-13

## Purpose

This audit separates **engineering regression coverage** from **customer product authority**.

A project may remain useful as a deterministic engine fixture without being authorized for customer configuration. A historical `golden` label proves repeatability of old engine behavior; it does **not** prove that JQ approved the product, room condition, finish, hardware, pricing, or exact product/layout combination.

The customer path is deny-by-default.

## Authority layers

### Geometry authority

A project may reach room fit and parametric geometry only when all of these are approved:

1. exact product family;
2. exact room layout;
3. exact Product + Layout combination; and
4. fixed JQ interior material rule.

Current fixed interior rule: clear maple UV-coated prefinished maple, based on John Quinn's July 17 standardization email.

### Final authority

Save, restore as a final design, quote, and final review require geometry authority plus exact approved commercial selections, including:

- exterior finish;
- selected hardware when present;
- selected lighting system when present;
- selected crown/top treatment when present; and
- an approved JQ pricing schedule.

Missing authority rejects. A `conditional` authority record routes to review and does not silently accept.

## Current drawing-backed geometry audit

| Golden project | Product + layout | Geometry disposition | Reason |
| --- | --- | --- | --- |
| G01-right-niche-tv | TV Unit + Right Niche | Reject | TV Unit exists, but `right-niche` and this exact combination are not locked by the current drawing contract. |
| G02-center-niche-cabinets | Cabinet + Shelves + Niche | **Allow** | July 5 drawing set depicts alcove cabinet/open-shelf construction. |
| G03-clear-drawers-wide | Drawers + Shelves + Clear Wall | **Allow** | Bedroom elevations depict drawer-base/open-shelf straight-wall construction. |
| G04-clear-open | Open Shelving + Clear Wall | **Allow** | Pages 1–2 depict full-height open shelving with straight-wall base/install variants. |
| G05-fireplace | Cabinet + Shelves + Fireplace Wall | Review | Fireplace bookcases are explicitly drawn, but the full fireplace clearance/safety contract is not yet locked. |
| G06-window-storage | Window Storage + Window Wall | Reject | Legacy guided concept; no locked product/layout construction contract in the current authority set. |
| G07-door-wall | Cabinet + Shelves + Door Wall | Reject | Potential room condition exists historically, but exact customer product/layout authority is not locked. |
| G08-between-openings | Cabinet + Shelves + Between Openings | Reject | Existing engine condition; no exact locked JQ combination authority. |
| G09-corner | Open Shelving + Corner Wall | Reject | Existing engine condition; no exact locked JQ combination authority. |
| G10-floating | Floating Storage + Clear Wall | Reject | No authoritative JQ product construction contract in the current Task 1 source set. |
| G11-radiator | Radiator Cover + Window Wall | Reject | No authoritative JQ product construction contract in the current Task 1 source set. |
| G12-round-trip | Drawers + Shelves + Niche | **Allow** | Page 3 alcove options visibly include lower drawers with open shelving above. |

Current geometry result: **4 allow / 1 review / 7 reject**.

## Drawing facts currently encoded

The July 5 bookcase drawing set explicitly supports, among other recorded facts:

- 1 in MDF shelf: maximum clear span 27 in;
- 1 1/4 in MDF shelf: maximum clear span 31 in;
- 1 1/2 in MDF shelf: maximum clear span 36 in;
- flush room base built-in option;
- recessed-toe-kick built-in option;
- freestanding/no-filler recessed-toe-kick option;
- alcove built-in family;
- countertops shown at 1 1/4 in;
- Living Room TV elevation;
- drawer-base/open-shelf Bedroom 3 and Bedroom 4 elevations;
- lower paired-door/open-shelf elevation; and
- full-height open-shelf straight-wall variants visible on pages 1–2.

The fireplace drawing also supports the paired fireplace bookcase template, 5 mm shelf pins, and typical two-up/two-down shelf adjustment. Fireplace acceptance remains review-only until its clearance contract is complete.

## Owner-authored material authority

John Quinn's July 17 standardization email explicitly states that all interior cabinetry will use clear maple UV-coated, standard prefinished maple. That rule is approved.

The same email/thread leaves the following unresolved or exploratory and therefore not final-authority-approved:

- exact exterior Sherwin-Williams products/colors;
- prefinished white-oak offering;
- prefinished walnut offering;
- shop-primed offering;
- exact Dykes crown profiles;
- exact lighting system; and
- exact limited door-option set.

## Pricing

The existing repository contains a deterministic pricing engine, but its current rate constants are not automatically promoted to business authority.

Final authority therefore requires `pricing:jq-schedule-v1`. Until a JQ-approved pricing schedule is explicitly recorded, save/quote/final commercial output remains blocked by the authorized customer entrypoint.

## Runtime boundary

`guided-project-engine.js` remains an internal deterministic engineering core so legacy fixtures can continue testing geometry and regression behavior.

`guided-authorized-project-engine.js` is the guarded customer-facing entrypoint. It checks geometry authority before the existing engine can generate a customer-accepted specification and checks final authority before save, restore, or quote.

The next migration step is to make the customer catalog authority-aware so the UI does not advertise combinations that the guarded engine will reject.
