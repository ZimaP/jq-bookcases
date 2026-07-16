# Configurator visual QA

Run `npm run serve`, open `http://127.0.0.1:5173/configurator.html`, and keep
the browser console visible. Start each new-design scenario with controlled
local-storage fixtures so resume preferences cannot accidentally influence it.

Evidence status is explicit in this document. Sections labeled **Completed**
record executed work and existing artifacts. Construction V1 was executed on
2026-07-14 against the candidate branch; exact command results and evidence are
recorded below. The reference-workspace matrix is a release requirement until a
new dated run records its exact results and artifacts; older evidence is not a
substitute for that run.

## Reference workspace and direct-selection regression matrix

1. A new My Space design, inspiration idea, valid share, or explicit preset
   enters one accepted shell with one seven-stage rail, one model workspace,
   one fixed Properties panel, one section organizer, one total-width card, one
   estimate footer, and exactly one canvas. Retired presentation preferences
   cannot alter physical start state.
2. A verified saved design loaded from the bare URL or `?start=resume` restores
   only its accepted physical configuration. New and resumed designs both start
   at Layout / General with Select active, Dimensions and Wall on, fullscreen
   off, empty global history, and no semantic selection. `?start=welcome`
   preserves the saved record while showing presentation entry.
3. The rail exposes exactly seven directly reachable, non-gating stages in
   this order: Space, Layout, Storage, Finish, Hardware, Lighting, Preview.
   Their canonical projections are respectively Overall Size; Sections &
   Layout + Base & Crown; Shelves + Storage & Fronts; Finish; Hardware;
   Lighting; and Project Service/Review.
4. Changing stage or selected-section tab is presentation-only. It must not
   price, rebuild geometry, reset the camera, replace canvas, add history, or
   change the accepted fingerprint.
5. Hover identifies a selectable generated component without selecting or
   changing physical state. Leaving it removes the transient label.
6. Selecting a section, shelf, door, drawer front, handle, divider, base,
   crown, light, or cabinet body creates one semantic selection, highlights
   accepted geometry, synchronizes the organizer, and routes the appropriate
   stage and Properties tab.
7. Selected-section tabs are General, Shelves, conditional Doors or Drawers,
   Back, and Lighting. Doors and Drawers follow section type; Back is read-only;
   hidden/inapplicable tabs do not leave stale controls or values.
8. Model, organizer, stage, and Properties controls all call the same accepted
   commit path. One valid physical edit causes one normalization, validation,
   price calculation, history entry, and viewer update.
9. Clicking model blank space, pressing Escape, or using Properties close
   clears the same selection. Keyboard selection moves focus predictably and
   close restores it when a connected invoker exists.
10. Stage, tab, selection, hover, tool, display, fullscreen, focus, scroll,
    organizer menu, history, and incomplete drafts never enter save, quote,
    BOM, price, layout fingerprint, or AR normalization.
11. Incomplete or invalid numeric drafts retain their text and connected error
    while model, BOM, price, Review, saved identity, quote, and AR remain on the
    last accepted transaction.
12. Preview launches the shared Review dialog. Review Edit routes to the owning
    stage/tab. Save Design, Request a Quote, and AR use their single shared
    handlers and remain protected from duplicate rapid actions.
13. Undo and Redo are a single bounded 50-entry accepted-configuration history.
    The visible buttons and platform keyboard shortcuts share that authority;
    replay uses the normal commit/viewer path; new edits clear redo; history is
    never serialized.
14. Rejected candidates, no-ops, drag previews, stage/tab/selection changes,
    organizer scroll, Select/Pan, Dimensions/Wall, and fullscreen add no history
    entry and invoke no price change.
15. Dimensions and Wall are explicitly nonphysical display helpers. Their
    pressed states match visibility and never affect descriptor audit, BOM,
    price, identity, save, quote, or AR. Wall disappears when off.
16. Select and Pan are mutually exclusive and expose correct pressed state.
    Native fullscreen or fallback fullscreen resizes the existing viewer and
    exit restores the shell without a second canvas or render loop.
17. The persistent model remains the visual center. Properties/organizer
    scrolling must not orbit the model or move a divider; divider interaction
    must not also rotate the camera.
18. Reduced-motion mode removes ornamental stage, sheet, highlight, and helper
    transitions without hiding state. Accessible names, selected/pressed
    states, dialog names, announcements, focus indicators, and logical keyboard
    order remain available.
19. Total width, section count/cards, estimate, Review, save payload, quote
    prefill, and AR data synchronize after every accepted change.
20. Exactly one controller, viewer, renderer, scene, camera, canvas, render
    loop, accepted state, history authority, and pricing pipeline survive all
    stage/tab navigation, section operations, responsive resize, fullscreen,
    Review, Save, Quote, and AR entry.

### Required responsive evidence

Capture native, unprocessed application screenshots in
`artifacts/configurator-reference-workspace-qa/`. Do not overwrite older
refinement or construction evidence. Verify these minimum viewports:

| Viewport | Required checks |
| --- | --- |
| 1440 × 900 (and, when available, 1920 × 1080) | fixed 230 px rail, centered model, ~310 px Properties, organizer/width row, light footer |
| 1024 × 768 | compact horizontal stages, bounded Properties sheet, usable model, organizer and width status |
| 768 × 1024 | tablet reflow, contained scrolling, all tools and actions reachable |
| 390 × 844 | phone stage rail, toolbar, organizer, Properties, price, Save, and Quote reachable |
| 360 × 800 | narrow-phone no-overflow and 44 px coarse-pointer targets |
| 844 × 390 | short-landscape model remains usable and Properties/organizer are scroll-contained |

At every viewport assert no page-width overflow, clipped controls, or surface
overlap; all seven stages and global tools are reachable; the model retains a
usable area; Properties and organizer own their scrolling; total width,
estimate, and actions stay reachable; and resize/fullscreen never duplicates
the canvas. Required captures include:

- `reference-desktop-shell.png`
- `reference-desktop-selected-section-tabs.png`
- `reference-desktop-storage.png`
- `reference-desktop-history-display-toolbar.png`
- `reference-tablet-1024x768.png`
- `reference-tablet-768x1024.png`
- `reference-phone-organizer-390x844.png`
- `reference-phone-narrow-360x800.png`
- `reference-landscape-844x390.png`

## Layout stage and section-organizer acceptance matrix

1. The organizer always shows `Sections (N)`, exact total width, Add Section,
   and horizontally scroll-contained cards. Each card shows a descriptor-
   derived thumbnail, section number, customer-facing clear width rounded to
   at most two decimal places, selection, and a Duplicate/Delete menu. The
   accepted configuration retains the full-precision canonical width.
2. Model and organizer selection stay synchronized and route to Layout /
   General Properties. Keyboard and pointer use retain visible focus and
   pressed/selected state.
3. Add and Duplicate split a deterministic buildable source section; Delete
   absorbs the removed width and one 0.75 in divider allowance into a
   deterministic neighbor. Total clear width plus dividers remains exact.
4. Impossible max/min-count, minimum-width, or locked-feature operations are
   disabled or rejected with an engine-owned reason, leaving all accepted
   artifacts unchanged.
5. Each successful Add, Duplicate, or Delete is one global history entry. Undo
   and Redo restore section structure, total width, estimate, selection-safe
   Properties, and viewer output through the normal transaction path.
6. An explicit global count selection starts that count at equal clear widths,
   even when the count is unchanged and stale ratios exist. At 96 in overall
   width, three sections read exactly `31, 31, 31` in clear and overall remains
   96 in.
7. A saved or preset asymmetric ratio remains unchanged on ordinary restore and
   dimension regeneration until the customer explicitly selects a count.
8. Width steppers, numeric commit, keyboard divider resize, and pointer drag
   change only the adjacent pair and preserve exact total width. Overshoot
   clamps at the 15 in minimum.
9. Pointer drag provides transient valid overlay/model feedback without price
   or history and commits at most one accepted transaction on release. The
   captured handle remains the same DOM node throughout the gesture.
10. Media, desk, and fireplace feature zones show a locked state. Invalid
    drafts and edits to locked zones leave every accepted artifact unchanged.
11. Selection volumes, guides, labels, wall/environment, and hit targets stay
    `nonPhysicalHelper` output and never enter physical render counts, BOM,
    pricing, design identity, or saved data.
12. Projected clear-width labels and overall dimensions derive from accepted
    descriptor bounds. At sufficiently oblique views they fade and divider
    handles disable rather than implying false measurements.
13. Divider handles remain available on desktop, tablet, and mobile with a
    large pointer target and keyboard support. The numeric field shows the same
    at-most-two-decimal customer value and remains the non-drag alternative;
    accepted edits and total-width validation use full-precision canonical
    values. Organizer scrolling remains contained.
14. A selected lower-door or tall-door section exposes Door arrangement in its
    Doors tab: Auto, Single/hinge left, Single/hinge right, and Pair. The tab is
    absent for open, drawer, media, desk, and feature sections.
15. Split, merge, type, and count changes keep `sectionDoorLayouts` aligned and
    reset changed-width doors to Auto without stale metadata. Unsupported
    choices expose the engine-provided reason.

## Storage, profiles, and hardware matrix

1. Storage groups controls into Shelving, Lower storage, Front profiles, and a
   clear route to Layout / General and the organizer for per-section work.
2. Door front profile and drawer front profile are independent controls.
   Shaker, Flat Panel, and Slim Shaker are available for both; Glass Frame is
   door-only and never appears as a drawer choice or drawer descriptor.
3. Mixed door/drawer designs preserve both profile selections through model,
   BOM/billable summaries, Review, save/reload, quote prefill, and AR share
   normalization.
4. Hardware is presented as Type and Finish rather than five combined product
   cards. Only canonical combinations are selectable: Brushed Brass knob/pull,
   Matte Black knob/pull, and Polished Nickel pull.
5. A type change preserves the finish when the combination is valid and uses
   the deterministic fallback otherwise. No Polished Nickel knob is exposed.
6. A finish-only hardware change updates materials in place. A knob/pull shape
   change rebuilds required geometry while restoring the exact camera pose,
   active view, canvas, and viewer instance.
7. When no generated front can host hardware, Type and Finish controls remain
   hidden and inert while Properties shows an explanatory empty state with a
   direct route to Storage to add doors or drawers. Lighting warmth remains
   hidden and inert when lighting is off.
8. New designs use the internal `jq_inset_v1` profile without exposing a
   construction-profile selector. A door-arrangement change immediately updates
   generated leaf/handle counts, estimate, Review, save payload, quote prefill,
   and AR data while preserving camera pose, selected view, selected section,
   active stage/tab, Properties selection, and semantic highlight.
9. Single hinge-left places hardware on the right latch edge; single hinge-right
   places it on the left. A pair has equal leaves, one exact meeting gap, and
   mirrored hardware. Glass hardware stays on the resolved frame, never the
   glass field.

## Completed prior-refinement data-model verification — 2026-07-14

The focused canonical-model command completed with 139 tests passed and zero
failed:

```sh
node --test tests/bookcase-config.test.js tests/bookcase-layout.test.js tests/bookcase-sections.test.js tests/bookcase-bom-pricing.test.js tests/bookcase-pricing.test.js tests/bookcase-engine-transaction.test.js tests/cabinet-ar.test.js tests/quote-prefill.test.js
```

This run verifies:

- explicit 96 in / three-section equalization to `31, 31, 31`, including a
  same-count reset from stale `1:1:2` ratios;
- adjacent-pair resize clamping, exact totals, and repeated-cycle drift
  resistance;
- preservation of asymmetric saved/preset ratios until a global count action;
- independent door/drawer profile normalization, descriptors, billable data,
  save/restore, quote metadata, and profile-neutral pricing;
- canonical hardware type/finish resolution for all five supported variants;
- bounded schema-4 legacy fingerprint verification for configurations that
  predate `drawerFrontStyle`; and
- `drawerFrontStyleId` in current AR payloads while pre-profile positional
  schema-v1 tokens decode without shifted fields.

This run predates the Construction V1 implementation. It is retained as
historical evidence for the structure/storage refinement only and does not
claim Construction V1 model, browser, responsive, accessibility, or visual
completion.

## Completed prior-refinement browser matrix — 2026-07-14

`e2e/configurator-viewport-matrix.spec.js` exercised one accepted three-section
structure design at every required viewport. Each row passed the historical
page, structure-editor, and overview overflow checks; one complete valid canvas;
three visible section cards and clear-width labels; two visible enabled 44 px+
divider targets; the overall-width label; and application console monitoring.

This matrix and the following eight screenshots predate Construction V1. They
remain valid evidence for their stated structure/profile UI scope but are not
evidence that inset fronts, rebuilt bases, door arrangements, or profile-aware
hardware have passed the new construction release matrix.

| Class | Viewport | Result |
| --- | --- | --- |
| Desktop reference | 1440 × 900 | Pass |
| Desktop | 1536 × 1024 | Pass |
| Desktop | 1920 × 1080 | Pass |
| 4K desktop | 3840 × 2160 | Pass |
| Compact desktop | 1180 × 820 | Pass |
| Tablet landscape/compact | 1024 × 900 | Pass |
| Tablet portrait | 768 × 1024 | Pass |
| Mobile | 390 × 844 | Pass |
| Narrow mobile | 360 × 800 | Pass |

The same spec also verified that all six clear-width labels remain visible and
non-overlapping at 390 × 844 and 360 × 800. Narrow five/six-bay labels use the
compact inch-mark presentation; cards and the numeric field show at most two
decimal places while accepted configuration math retains full precision. The
capture audit independently reported 3840 px client and scroll widths, one
canvas, a valid render, and zero horizontal Structure scrollers.

Completed browser scenarios:

1. Stale presentation preferences could not override the physical source for a
   new My Space or editable-idea start. A bare URL and `?start=resume` restored
   the verified saved configuration.
2. A 96 × 96 × 15 in design changes to `31, 31, 31`; direct resize produces
   `33, 29, 31` while overall remains 96 in. Pointer preview avoids pricing,
   release commits once, numeric/stepper/keyboard paths use the same adjacent
   transition, blank drafts preserve accepted state, and overshoot clamps.
3. The section count/editor and global storage controls used the same accepted
   section transaction; count reduction clamped card and preview selection
   together, and Merge Left selected the resulting merged bay.
4. Door-only, drawer-only, and mixed designs expose the applicable independent
   profile groups. Drawer options are Shaker, Flat Panel, and Slim Shaker only;
   Glass Frame remains door-only. Model, Review, BOM, save/restore, quote, and
   AR tests preserve both selections without a new price distinction.
5. Hardware Type and Finish expose only the five supported combinations.
   Finish-only changes keep geometry and the exact camera; type changes rebuild
   handle geometry while preserving camera, selected view, focus, viewer, and
   canvas.
6. Control navigation, Front/3/4/Side/free camera, save, reload, Review, quote
   handoff, and room-view/AR entry kept one accepted state, one controller, one
   persistent viewer, one canvas, and one price.

Release automation on the completed tree:

- `npm run build`: pass; 100 icons and 13 profile drawings validated.
- `npm test`: 312 passed, 0 failed.
- `npm run test:browser`: 59 passed, 0 failed in Chromium plus Firefox and
  WebKit smoke coverage.
- `git diff --check`: pass.

The in-app Browser replay reported zero application warnings or errors, one
canvas, a valid descriptor render, no page overflow, and the dimension controls
as the active new-design surface. Headless screenshot capture emitted only Chromium's known
`ReadPixels` driver-performance message; it was isolated as capture-driver
noise, not an application/WebGL validation error. Computer Use opened the 4K
artifact in Preview and confirmed the full 3840 × 2160 composition was intact.

Captured evidence:

- `artifacts/configurator-refinement-qa/new-space-step-desktop.png`
- `artifacts/configurator-refinement-qa/structure-three-equal-sections-desktop.png`
- `artifacts/configurator-refinement-qa/structure-resized-sections-desktop.png`
- `artifacts/configurator-refinement-qa/storage-drawer-profile-desktop.png`
- `artifacts/configurator-refinement-qa/hardware-type-and-finish-desktop.png`
- `artifacts/configurator-refinement-qa/structure-mobile.png`
- `artifacts/configurator-refinement-qa/storage-mobile.png`
- `artifacts/configurator-refinement-qa/configurator-4k.png`

## Construction V1 release QA — Completed 2026-07-14

The complete repository release suite passed against the same candidate tree:

- `npm run build`: pass in 1.66 seconds; 100 icons and 13 drawings validated.
- `npm test`: 353 passed, 0 failed, 0 skipped.
- `npm run test:browser`: 60 passed, 0 failed in 5.6 minutes (337.90 seconds
  wall time), including 54 Chromium tests plus Firefox and WebKit smoke
  coverage.
- Focused Construction V1 capture after the final release fixes: 1 passed in
  1.1 minutes (65.98 seconds wall time).
- `git diff --check`: pass.

The release-blocker pass fixed legacy tall/glass front-to-crown collisions,
strict schema-4 artifact verification without breaking recognized early-v4
saves, schema-4 toe-void and drawer-signature compatibility, structured
correction of unsupported saved door arrangements, runtime product-light
tagging, the release cache token, and the duplicate single-door evidence image.
Current tests cover every fix directly.

The dedicated Construction V1 browser test used the debug descriptor graph,
asserted valid physical and rendered manifests for each scenario, kept one
viewer and one canvas, exercised free-rotation camera preservation during a
hinge-direction rebuild, validated all crown and drawer profiles, verified
lighting focus restoration and 2700K-to-3500K point-light color changes, and
restored real legacy glass-library and tall-storage geometry. It reported no
application errors or WebGL/resource/geometry warnings.

In-app Browser then exercised the customer controls without controller
injection. Lower-door Auto produced one door and one handle at 18 inches and two
doors and two handles at 31 inches; the deterministic suite covers the 23-inch
and 46.5-inch boundaries. Forced hinge-left and hinge-right moved hardware to
the opposite latch edge, and unsupported choices exposed the engine-provided
reason. Review, schema-4 save/reload (`JQ-1MXJTUV`), quote prefill, and procedural
AR/QR handoff stayed synchronized at $14,700. Tall Storage + Shelves produced
one tall door and one handle at 23 inches, then an Auto pair with two handles at
28.856 inches; both unsupported single choices were disabled with the exact
too-wide reason, and Review tracked 7 versus 8 generated fronts and $16,900
versus $16,800.

Real schema-4 snapshots generated from baseline `c2537e52` and early-v4 commit
`02197de` restored for lower cabinets, glass library, and tall storage with
unchanged totals of $14,800, $16,050, and $16,750. All 16 required PNG artifacts
are valid, visually reviewed, and SHA-256 unique. Computer Use opened the
corrected 862 x 552 single-door PNG in macOS Preview at original resolution.
The AR dialog emitted one third-party model-viewer warning about its bundled
Three.js instance; no application console error or WebGL error was present.

### Automated construction gates

Run the focused model/contract suite:

```sh
node --test \
  tests/bookcase-config.test.js \
  tests/bookcase-layout.test.js \
  tests/bookcase-sections.test.js \
  tests/bookcase-bom-pricing.test.js \
  tests/bookcase-engine-transaction.test.js \
  tests/bookcase-engine-fuzz.test.js \
  tests/bookcase-render-contract.test.js \
  tests/configurator-renderer-integration.test.js \
  tests/cabinet-ar.test.js \
  tests/quote-prefill.test.js
```

Then run every repository-defined release command in the Release commands
section. Record actual counts only after completion.

The deterministic sweep must remain fixed-seed and reproducible. The supported
matrix uses seed `0x4A51424B`; hostile normalization uses `0xC0FFEE`. Coverage
must include all base/front styles, one through six valid sections, Auto and
manual door arrangements, knobs/pulls/push latch, lighting/crown combinations,
symmetrical/asymmetrical ratios, finite positive descriptors, hierarchy/hosts,
front planes, toe void, hardware regions, render envelopes, stable generation,
and JSON round-trip validation. A failing case must report its seed and case
index.

### Browser setup and viewports

Use a clean new-design fixture for current inset scenarios. Use a real schema-2
or schema-3 pre-profile fixture for the legacy scenario; do not manufacture
legacy behavior by exposing an unsupported customer control. Open a second
diagnostic pass with `?constructionDebug=1` to inspect planes, descriptor bounds,
toe void, isolated Base/Fronts/Hardware, render counts, and validation codes.
The construction-debug overlay is evidence only and must remain absent from
customer captures unless the artifact is explicitly named as a debug capture.

Every required scenario must be checked at the most relevant desktop viewport,
and the complete responsive shell must pass all of these viewports:

| Class | Viewport | Required status |
| --- | --- | --- |
| Desktop reference | 1440 × 900 | Pass |
| Desktop | 1536 × 1024 | Pass |
| Desktop | 1920 × 1080 | Pass |
| 4K desktop | 3840 × 2160 | Pass |
| Compact desktop | 1180 × 820 | Pass |
| Tablet landscape/compact | 1024 × 900 | Pass |
| Tablet portrait | 768 × 1024 | Pass |
| Short landscape | 844 × 390 | Pass |
| Mobile | 390 × 844 | Pass |
| Narrow mobile | 360 × 800 | Pass |

For every geometry scenario, inspect Front, 3/4, Side from both directions when
asymmetry matters, free rotation, a hardware close-up, a base close-up, and a
front close-up. Preserve the camera while switching arrangements or hardware.

### Required construction scenarios

1. Recessed toe kick, 96 × 96 × 15: verify a true 4-inch-high by 3-inch-deep
   central void, recessed plate at Z=3, finished end returns, structural support
   behind the plate, intentional floor contact, and no shadow solid filling the
   recess.
2. Flush plinth: verify the front equals the finished-front plane, both sides
   equal the outer carcass planes, floor contact is continuous, and there is no
   front or side cap overhang.
3. Furniture base: verify mirrored 3 × 3 front feet whose outside edges are
   three inches inboard, a connected front apron, contained hidden support, and
   no full-depth foot slab in either side view.
4. Narrow lower-door openings: check Auto at approximately 18 and 23 inches
   clear. Each must create one inset leaf with logical balanced hinge/latch
   semantics and one latch-side hardware item.
5. Wide lower-door openings: check Auto at approximately 31 and 46.5 inches
   clear. Each must create two equal inset leaves with an exact 0.125-inch
   meeting gap and mirrored hardware.
6. Forced direction: switch one buildable section between Single/hinge left and
   Single/hinge right. The hardware must move to the opposite latch edge while
   generated door/hardware quantities, price, Review, save, quote, and AR remain
   synchronized. Unsupported manual choices must be disabled or rejected with
   the engine-provided reason.
7. Tall storage: inspect one valid single tall leaf and a width that requires a
   pair or review. Confirm inset side depth, explicit hinge/latch sides, pull
   envelope, and the 40-inch finished-floor hardware reference.
8. Glass frame: confirm fixed-inch frame proportions, contained glass field,
   hardware drill center and complete envelope on solid frame material, and no
   z-fighting.
9. Drawer stack: confirm inset faces at the shared finished plane, exact equal
   gaps, horizontal centered pulls, and valid Shaker/Slim Shaker geometry on
   short fronts without a glass option.
10. Crown and lighting: confirm deliberate style-specific front/side overhang,
    zero rear/top overhang, continuous left/right returns from the front plane
    to the back-interior plane, hosted/visible lights, no crown/light collision,
    and no crown overhang permission inherited by fronts. Tampering with a
    style envelope or shortening a return must report
    `CROWN_OVERHANG_EXCEEDED` or `CROWN_SIDE_RETURN_INVALID`, respectively.
11. Legacy saved design: restore a pre-profile overlay/paired lower-door design;
    verify explicit `legacy_overlay_v1`, historical leaf count, overlay depth,
    stable regenerated price/integrity checks, quote metadata, and the same AR
    construction profile.

### Artifact convention

New evidence belongs under `artifacts/configurator-construction-qa/`. Do not
overwrite or relabel prior refinement artifacts. Use PNG at the tested native
viewport, capture the actual application without post-processing, and preserve
the exact scenario names below so the final handoff can link them directly.
All listed files exist from the completed native-viewport capture run.

- `artifacts/configurator-construction-qa/engine-toe-kick-front.png`
- `artifacts/configurator-construction-qa/engine-toe-kick-three-quarter.png`
- `artifacts/configurator-construction-qa/engine-toe-kick-side.png`
- `artifacts/configurator-construction-qa/engine-flush-plinth.png`
- `artifacts/configurator-construction-qa/engine-furniture-base-front.png`
- `artifacts/configurator-construction-qa/engine-furniture-base-side.png`
- `artifacts/configurator-construction-qa/engine-single-door-inset.png`
- `artifacts/configurator-construction-qa/engine-paired-door-inset.png`
- `artifacts/configurator-construction-qa/engine-single-hinge-left.png`
- `artifacts/configurator-construction-qa/engine-single-hinge-right.png`
- `artifacts/configurator-construction-qa/engine-tall-door.png`
- `artifacts/configurator-construction-qa/engine-glass-hardware.png`
- `artifacts/configurator-construction-qa/engine-drawer-fronts.png`
- `artifacts/configurator-construction-qa/engine-mobile-fronts.png`
- `artifacts/configurator-construction-qa/engine-4k-overview.png`
- `artifacts/configurator-construction-qa/engine-legacy-overlay.png`

An optional developer-only capture may use
`artifacts/configurator-construction-qa/engine-construction-inspector.png`; it
does not replace any customer-view artifact.

### Construction browser acceptance

- Exactly one controller, viewer, canvas, scene, camera, and accepted pricing
  pipeline remain mounted through all control and arrangement changes.
- Every accepted model has valid layout and render-manifest audits; no
  renderer-only physical part exists. A rejected candidate leaves the prior
  valid scene, price, Review, save identity, quote data, and AR entry unchanged.
- The browser console has no application errors, validation leaks, uncaught
  promise rejections, or WebGL warnings. Record any browser/driver-only message
  separately with reproduction details rather than silently ignoring it.
- Front, 3/4, both side views, free rotation, and close-ups show no floating
  parts, penetrations, z-fighting, filled toe void, full-depth furniture feet,
  plinth overhang, hardware outside a face/on glass, invisible hardware, camera
  clipping, or unexpected camera reset.
- Stage and Properties controls, organizer operations, Review, saved schema-4 payload,
  quote prefill, AR normalization/model, generated billables, and displayed
  estimate all agree on profile, section arrangements, door leaves, drawer
  fronts, and visible hardware quantities.

## General regression scenarios — Completed 2026-07-14

For each scenario, inspect Front, 3/4, Side, and free-rotate views. Confirm that
shelves remain inside their section, fronts keep even reveals, handles remain
on their parent face, lights touch their host surface, and no panel penetrates
an unrelated component.

1. Narrow two-section open bookcase: 36 × 72 × 10 in, two sections, two
   shelves, lower cabinets off.
2. Wide library wall: 144 × 108 × 15 in, six sections, six shelves.
3. Default lower cabinets: 96 × 96 × 15 in, four sections, four shelves; Auto
   must derive the current physical leaf count from the finished openings
   (ordinary approximately 23-inch bays produce one leaf each).
4. Mixed drawer/door preset: Display Wall or Asymmetrical Modern with distinct
   compatible door and drawer profiles.
5. Adjustable shelves: move between two and eight shelves repeatedly.
6. Integrated lighting: pucks, shelf LEDs, side LEDs, and the full package at
   all three color temperatures.
7. Media center, desk center, fireplace, glass-door, and asymmetrical presets.
8. Minimum and maximum global dimensions.
9. Rapidly switch through all ten presets twice, then reset.
10. Add/remove lower cabinets repeatedly while changing section and shelf
    counts.

## Required visual checks

- Shelves are empty: no books, plants, vases, bowls, frames, or ornaments.
- Wall/environment is an explicitly nonphysical display helper. It appears only
  while the global Wall button is pressed, disappears when off, and never
  enters descriptors, render audit, BOM, price, save, quote, or AR. Any floor
  plane, grid, or baseboard used for orientation follows the same helper rule.
- The selected finish is shared by frame, shelves, back, fronts, crown, base,
  and trim; only lighting and physical shadows change appearance.
- No floating lights, handles, shelves, or fronts; no duplicate or flickering
  surfaces; and no visible z-fighting.
- Section contents stay inside their bay. Door and drawer reveals remain even
  after every dimension or structure change.
- New door/drawer finished faces align at Z=0, bodies extend inward, hardware
  projects outward, and shelves/separators reserve the intended clearance.
- Toe-kick void remains empty, flush plinth remains flush, furniture feet remain
  front-only, and crown, back, frame, and dividers remain intentionally aligned.
  Crown returns read continuously in both side views and no crown extends beyond
  the outer-back plane.
- Every door has an opposite hinge/latch pair. Hardware stays on the latch side
  and resolved solid material; no glass or recessed field is drilled.
- The same accepted configuration restores the same geometry and price.
- Stage/Properties controls, the organizer, Review Design, Save Design, local
  quote prefill, and AR normalization agree on construction profile,
  per-section door arrangements, and component-derived leaf/hardware
  quantities.
- Benjamin Moore search works by name and code, persists the selected catalog
  record, and returns a clear no-result state without inventing a color.
- No new console errors, warnings, geometry-validation errors, or WebGL resource
  failures appear.

## Release commands

```sh
npm ci
npm run build
npm test
npm run test:browser
git diff --check
```

All commands must pass before release. This repository has no separate lint,
formatter, or type-check script. Record exact automated counts, browser
scenarios, screenshot paths, console findings, and any remaining deviation in
the final handoff.
