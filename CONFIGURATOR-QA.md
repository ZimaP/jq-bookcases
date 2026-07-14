# Configurator visual QA

Run `npm run serve`, open `http://127.0.0.1:5173/configurator.html`, and keep
the browser console visible. Start each new-design scenario with controlled
local-storage fixtures so resume preferences cannot accidentally influence it.

## Guided and All Controls regression matrix

1. A new My Space design, inspiration idea, valid shared configuration, or
   explicit preset opens Guided Setup at Space regardless of stale mode, step,
   category, or scroll preferences.
2. A valid saved design loaded from the bare configurator URL or
   `?start=resume` restores its sanitized mode, Guided step, All Controls
   category, accepted configuration, and the preview focus associated with that
   restored workflow context.
3. `?start=welcome` presents a new journey without deleting a valid saved
   design. Temporary `start` parameters are consumed after startup.
4. Guided order and visible labels are exactly Space, Structure, Storage,
   Build, Style, and Review.
5. Continue validates the active step and unlocks only the next Guided step;
   Back retains accepted selections. A future locked step cannot be entered
   directly.
6. Space contains width, height, and depth. Structure contains the section
   count and full inline section editor. Storage contains shelving, lower
   storage, and front profiles. Build contains shelf thickness, base, and
   crown/top. Style contains finish, hardware, and lighting.
7. Switching between Guided Setup and All Controls does not reload the page,
   change physical configuration, recalculate price, remount the viewer, or
   create a second canvas, scene, camera, or render loop.
8. The mapped category opens when switching to All Controls, and switching
   back opens the mapped or independently remembered Guided step.
9. A physical edit in either presentation appears immediately in the other.
   Both presentations show the same price, schema-4 save payload, review, and
   quote handoff for the same accepted configuration.
10. Incomplete numeric drafts retain their text and connected validation
    message across presentation changes. They leave model, BOM, price, review,
    save identity, and quote data at the last accepted transaction.
11. Every collapsed All Controls category exposes a current-value summary and
    applicability is derived from generated components rather than only from
    raw selections.
12. Review Edit actions return to and focus the owning Guided step. Save Design
    and Request Quote remain guarded against duplicate rapid actions.
13. Mode tabs support Arrow Left/Right, Home, and End. The mode selector and
    Guided progress remain visible, readable, and keyboard-operable at every
    release viewport.

## Structure acceptance matrix

1. The Structure step shows all section cards in a wrapping overview grid with
   no nested horizontal scrolling.
2. Each overview card shows section number, exact clear width, section type,
   selected state, and locked state when applicable. Selection supports click,
   Arrow Left/Right, Home, and End.
3. An explicit global count selection always starts that count at equal clear
   widths, even when the count is unchanged and stale ratios exist. At 96 in
   overall width, three sections read exactly `31, 31, 31` in clear and the
   overall overlay remains 96 in.
4. A saved or preset asymmetric ratio remains unchanged on ordinary restore and
   dimension regeneration until the customer explicitly selects a section
   count.
5. Exact-width steppers, numeric commit, keyboard divider resize, and pointer
   drag change only the selected adjacent pair and preserve exact total clear
   width. Overshoot clamps at the 15 in minimum instead of rejecting the whole
   gesture.
6. Pointer drag presents transient overlay/model feedback without recalculating
   price and commits no more than one canonical accepted transaction on
   release. The captured handle remains the same DOM node throughout the
   gesture.
7. Split and merge account for the 0.75 in divider and round-trip to the
   original total and deterministic fingerprint. Equalize is global; split and
   merge remain local.
8. Split, merge, and equalize live under the Section actions disclosure.
   Impossible or locked operations are disabled and have an associated reason.
9. Undo and redo affect accepted section changes only and are not serialized.
   Reset to Preset restores the preset's canonical structure.
10. Media, desk, and fireplace feature zones show a locked state. Invalid width
    drafts and edits to locked zones leave every accepted artifact unchanged.
11. Selection volumes, guides, labels, and hit targets stay in the
    `nonPhysicalHelper` layer and never enter physical render counts, BOM,
    pricing, design identity, or saved data.
12. The overlay is projected from descriptor bounds through the active camera.
    Clear-width labels occupy the first row below the cabinet; the overall
    width occupies a separate lower row.
13. Divider handles remain present on desktop, tablet, and mobile with a large
    pointer target and keyboard support. The exact numeric field remains the
    non-drag alternative.
14. At sufficiently oblique side views, projected dimensions fade and direct
    divider handles disable rather than displaying misleading measurements.

## Storage, profiles, and hardware matrix

1. Storage groups controls into Shelving, Lower storage, Front profiles, and a
   clear route back to Structure for per-section customization.
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
7. Hardware remains hidden and inert when no generated front can host it.
   Lighting warmth remains hidden and inert when lighting is off.

## Data-model and unit verification — 2026-07-14

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

This is model verification only. It does not claim browser, responsive,
accessibility, or visual completion.

## Completed refinement browser matrix — 2026-07-14

`e2e/configurator-viewport-matrix.spec.js` exercised one accepted three-section
Structure design at every required viewport. Each row passed page, Guided-step,
Structure-editor, and overview overflow checks; one complete valid canvas;
three visible section cards and clear-width labels; two visible enabled 44 px+
divider targets; the overall-width label; and application console monitoring.

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
compact inch-mark presentation; the cards and numeric field retain the exact
value. The capture audit independently reported 3840 px client and scroll
widths, one canvas, a valid render, and zero horizontal Structure scrollers.

Completed browser scenarios:

1. Stale All Controls/Storage preferences cannot override a new My Space or
   editable-idea start: both open Guided Space with prefilled data. A bare URL
   and `?start=resume` restore verified saved context.
2. A 96 × 96 × 15 in design changes to `31, 31, 31`; direct resize produces
   `33, 29, 31` while overall remains 96 in. Pointer preview avoids pricing,
   release commits once, numeric/stepper/keyboard paths use the same adjacent
   transition, blank drafts preserve accepted state, and overshoot clamps.
3. All Controls exposes the same section count/editor, global storage rewrites
   compatible explicit section types, count reduction clamps card and preview
   selection together, and Merge Left selects the resulting merged bay.
4. Door-only, drawer-only, and mixed designs expose the applicable independent
   profile groups. Drawer options are Shaker, Flat Panel, and Slim Shaker only;
   Glass Frame remains door-only. Model, Review, BOM, save/restore, quote, and
   AR tests preserve both selections without a new price distinction.
5. Hardware Type and Finish expose only the five supported combinations.
   Finish-only changes keep geometry and the exact camera; type changes rebuild
   handle geometry while preserving camera, selected view, focus, viewer, and
   canvas.
6. Guided/All Controls switching, rail navigation, Front/3/4/Side/free camera,
   save, reload, Review, quote handoff, and room-view/AR entry keep one accepted
   state, one controller, one persistent viewer, one canvas, and one price.

Release automation on the completed tree:

- `npm run build`: pass; 100 icons and 13 profile drawings validated.
- `npm test`: 312 passed, 0 failed.
- `npm run test:browser`: 59 passed, 0 failed in Chromium plus Firefox and
  WebKit smoke coverage.
- `git diff --check`: pass.

The in-app Browser replay reported zero application warnings or errors, one
canvas, a valid descriptor render, no page overflow, and Space as the active
new-design step. Headless screenshot capture emitted only Chromium's known
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

## Geometry scenarios

For each scenario, inspect Front, 3/4, Side, and free-rotate views. Confirm that
shelves remain inside their section, fronts keep even reveals, handles remain
on their parent face, lights touch their host surface, and no panel penetrates
an unrelated component.

1. Narrow two-section open bookcase: 36 × 72 × 10 in, two sections, two
   shelves, lower cabinets off.
2. Wide library wall: 144 × 108 × 15 in, six sections, six shelves.
3. Default lower cabinets: 96 × 96 × 15 in, four sections, four shelves, eight
   doors.
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
- No visible floor, floor pattern, room wall, baseboard, or staged environment.
- The selected finish is shared by frame, shelves, back, fronts, crown, base,
  and trim; only lighting and physical shadows change appearance.
- No floating lights, handles, shelves, or fronts; no duplicate or flickering
  surfaces; and no visible z-fighting.
- Section contents stay inside their bay. Door and drawer reveals remain even
  after every dimension or structure change.
- Crown, base, back, frame, and dividers remain aligned to the outer case.
- The same accepted configuration restores the same geometry and price.
- Guided Setup, All Controls, both Review surfaces, Save Design, local quote
  prefill, and AR normalization agree on component-derived selections.
- Benjamin Moore search works by name and code, persists the selected catalog
  record, and returns a clear no-result state without inventing a color.
- No new console errors, warnings, geometry-validation errors, or WebGL resource
  failures appear.

## Release commands

```sh
npm run build
npm test
npm run test:browser
git diff --check
```

All commands must pass before release. This repository has no separate lint,
formatter, or type-check script. Record exact automated counts, browser
scenarios, screenshot paths, console findings, and any remaining deviation in
the final handoff.
