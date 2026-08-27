# OWNER CLAY REVIEW — corrected evidence audit

> PREVIEW ONLY · OWNER APPROVAL NOT GRANTED · NO PRODUCTION OR FABRICATION AUTHORITY

All requested visible-geometry defects were investigated. Two real lower-construction defect families totaling 42 overlap pairs were corrected in the isolated Phase 1D-J copy; shelf doubling was a shadow/setback/thickness artifact or intentional transition. No remaining visible geometry defect is unresolved.

The evidence package is decision-grade for owner review, but this report does not and cannot grant owner approval. Drawing 4 is used at actual-inch diagnostic scale only; no scaled linework is promoted to production authority.

## Vertical-proportion finding

The generated layout materially departs from the Drawing 4 silhouette while retaining every locked Phase 1D-J value. The change is most visible above the TV opening: the target has 23 in from opening top to overall top, compared with the larger Drawing 4 source zone. Upper shelf cadence is correspondingly compressed. This is disclosed as an authorized preview variant pending owner judgment—not as a drawing error and not as permission to change 96 in total, 36 in counter AFF, or the 60 × 37 in opening.

- Total height: source 112.140191 in → target 96.0000 in; delta -16.140191 in (-14.393%).
- Countertop top AFF: source 34.746962 in → target 36.0000 in; delta +1.253038 in (+3.606%).
- Central opening height: source 42.199653 in → locked target 37.0000 in; delta -5.199653 in (-12.322%).
- Opening top to overall top: source 35.193576 in → target 23.0000 in; delta -12.193576 in (-34.647%).
- Outer shelf center deltas (target minus Drawing 4 actual-inch source): -0.476780 in, -2.233507 in, -3.990234 in, -7.874349 in.

## Issue-by-issue findings

### P1DJ-VIS-001 — Front view crop and camera square-up

Status: **corrected-and-proven**

The corrected front is a straight-on orthographic elevation with the complete installed assembly, both fillers, countertop ends, plinth, and slim cap inside the computational frame.

Evidence: `neutral-front-full-orthographic.png`, `camera-bounds-report.json`.

### P1DJ-VIS-002 — TV opening visibility and named physical bounds

Status: **corrected-and-proven**

Only TV_PROXY and SOUNDBAR_REFERENCE are hidden in the empty-opening evidence. The physical TV opening is 60 x 37 in, from X=-30 to 30 and AFF=36 to 73; the normal clay scene retains both props.

Evidence: `neutral-front-empty-tv-opening.png`, `target-versus-actual-dimensions.json`, `scene-integrity.json`.

### P1DJ-VIS-003 — Front registered reconciliation overlay

Status: **corrected-and-proven**

Drawing 4 source contours and generated contours share actual-inch orientation and floor/centerline datums, while the generated 117-in casework and 120-in installed-width anchors are explicit. Source and generated colors remain distinct; a separately labelled similarity diagnostic exposes residuals without treating drawing scale as production authority.

Evidence: `front-registered-overlay.png`, `overlay-registration-report.json`.

### P1DJ-VIS-004 — Vertical-proportion relationship to Drawing 4

Status: **material-authorized-preview-departure-disclosed**

The locked 96-in total, 36-in counter AFF, 60 x 37-in TV opening, 23-in remaining bridge/top zone, and compressed upper shelf spacing materially depart from the Drawing 4 silhouette. This is an authorized preview variant, not owner approval, and locked values were not changed to force a match.

Evidence: `front-registered-overlay.png`, `visual-issue-audit.md`, `overlay-registration-report.json`.

### P1DJ-VIS-005 — Actual S2 section and matched orientation

Status: **corrected-and-proven**

S2 is a Boolean intersection of evaluated physical meshes, not an analytic replica. It is full-height with wall/rear on screen left and cabinet front on screen right, and separates case, face frame, shelf, door/front, countertop, cap, base, and hardware reference roles.

Evidence: `neutral-s2-actual-section.png`, `s2-registered-overlay.png`, `depth-plane-evidence.png`, `camera-bounds-report.json`.

### P1DJ-VIS-006 — Duplicate shelf meshes and stepped outer edges

Status: **artifact-and-intentional-transition-proven**

There are no duplicate shelf bounds. The apparent doubled/stepped edges are the documented 1-in outer shelf, 1.25-in bridge member, 1.5-in visible header, and intentional 0.125-in upper shelf front setback; isolated categorical evidence removes shadow/cavity ambiguity.

Evidence: `component-separation-front.png`, `intersection-audit.json`.

### P1DJ-VIS-007 — Coplanar overlap, intersection, and Z-fighting audit

Status: **corrected-and-proven**

The Phase 1D-I lower-core/face-frame and rail/stile positive-volume defects were real. Phase 1D-J removes all 42 cabinetry overlap pairs. Remaining coplanar pairs are zero-thickness butt contacts, not Z-fighting; only 48 within-pull A104 proxy constituent joins remain allowlisted.

Evidence: `geometry-delta.json`, `intersection-audit.json`, `component-separation-front.png`.

### P1DJ-VIS-008 — Shelf penetration, floating gaps, offsets, and setbacks

Status: **proven-clear**

No shelf penetrates a face frame and no unintended floating shelf gap exists. Outer/bridge shelves use a consistent 0.125-in front setback and lower shelves use a consistent 0.75-in setback to the visible frame plane; vertical steps follow declared thickness rules.

Evidence: `component-separation-front.png`, `intersection-audit.json`.

### P1DJ-VIS-009 — Carcass and 1.5-in visible face-frame separation

Status: **corrected-and-proven**

The lower carcass core now ends at depth 17.75 and the separate face-frame layer occupies 17.75 to 18.5. The visible member rule remains 1.5 in total; it is not a 0.75 + 1.5 side-by-side duplicate.

Evidence: `depth-plane-evidence.png`, `component-separation-front.png`, `geometry-delta.json`.

### P1DJ-VIS-010 — Counter support and upper-vertical contact

Status: **proven-clean**

The lower top ends at AFF 34.75, the countertop spans AFF 34.75 to 36, and upper verticals start at AFF 36. These are boundary contacts without a positive-volume intersection or floating gap.

Evidence: `neutral-s2-actual-section.png`, `depth-plane-evidence.png`, `intersection-audit.json`.

### P1DJ-VIS-011 — Flush plinth continuity

Status: **proven-deliberate-canonical-deviation**

One continuous 4-in flush plinth spans all four lower bays from X=-58.5 to 58.5. Its difference from the Drawing 4 recessed base is intentionally masked as a canonical option difference, not a geometry error.

Evidence: `front-registered-overlay.png`, `neutral-front-full-orthographic.png`.

### P1DJ-VIS-012 — Slim cap continuity

Status: **proven-deliberate-canonical-deviation**

The selected slim cap is continuous from X=-58.75 to 58.75 and AFF 94.8 to 96. Its difference from the Drawing 4 built-up crown is intentional and visibly annotated.

Evidence: `front-registered-overlay.png`, `neutral-three-quarter-eye-level.png`.

### P1DJ-VIS-013 — Filler separation and intended boundaries

Status: **proven-clean**

Left and right fillers remain separate physical members at X=-60..-58.5 and 58.5..60, reaching the installed-width boundaries and remaining visible in the complete front evidence.

Evidence: `neutral-front-full-orthographic.png`, `component-separation-front.png`.

### P1DJ-VIS-014 — Evidence-mesh isolation from clay renders

Status: **proven-clear**

Actual-section evidence meshes are hidden in every normal clay render and hidden in the saved default scene; the default product and normal TV/soundbar props remain visible.

Evidence: `scene-integrity.json`, `camera-bounds-report.json`, `intersection-audit.json`.

### P1DJ-VIS-015 — Three-quarter eye-level review framing

Status: **corrected-and-proven**

The three-quarter evidence contains the complete assembly with computational margins from an approximately eye-level camera and without excessive downward perspective.

Evidence: `neutral-three-quarter-eye-level.png`, `camera-bounds-report.json`.

## Intersection and duplicate-geometry result

The audit uses strict positive-interval AABB broad phase, an axis-aligned triangle/BVH-equivalent narrow-phase proof, and a separate coplanar face-area classification. It checks duplicate shelf meshes, duplicated carcass and face-frame members, overlap/intersection pairs, floating shelf gaps, shelf/rail offsets, shelf penetration, inconsistent setback, and Z-fighting. Phase 1D-J has zero remaining or unresolved visible geometry defects. Forty-eight internal A104 proxy constituent joins remain explicitly allowlisted and are not cabinetry defects.

## Evidence index

- completeFront: `neutral-front-full-orthographic.png`, `camera-bounds-report.json`
- emptyTvOpening: `neutral-front-empty-tv-opening.png`, `target-versus-actual-dimensions.json`
- threeQuarter: `neutral-three-quarter-eye-level.png`, `camera-bounds-report.json`
- actualS2: `neutral-s2-actual-section.png`, `depth-plane-evidence.png`
- frontRegisteredOverlay: `front-registered-overlay.png`, `overlay-registration-report.json`
- s2RegisteredOverlay: `s2-registered-overlay.png`, `overlay-registration-report.json`
- componentSeparation: `component-separation-front.png`, `intersection-audit.json`
- exactGeometryDelta: `geometry-delta.json`
- determinism: `deterministic-regeneration-report.json`

## Decision boundary

The final status of this audit is evidence readiness only. Owner approval remains false. The owner must review the corrected full front, empty TV opening, three-quarter, actual S2, registered overlays, component-separation proof, and disclosed material vertical-proportion departure before any later phase may proceed.
