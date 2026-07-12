# Configurator visual QA

Run `npm run serve`, open `http://127.0.0.1:5173/configurator.html`, and keep the
browser console visible while testing. The release viewports are 1440 × 900,
1024 × 900, and 390 × 844 at 1× scale.

## Two-mode regression matrix

1. A new visitor defaults to Guided Setup.
2. Guided forward navigation validates and advances one step.
3. Guided Back returns without losing selections.
4. Selections persist across all six Guided steps.
5. Switching to All Controls does not reload the page.
6. Switching back restores the mapped or remembered Guided step.
7. Physical configuration is unchanged by mode switching.
8. Camera orbit is unchanged by mode switching.
9. Zoom is unchanged by mode switching.
10. The selected 3D, Front, 3/4, or Side view is unchanged.
11. The renderer, scene, canvas, and render loop are not remounted.
12. A Guided edit appears immediately in All Controls.
13. An All Controls edit appears immediately in Guided Setup.
14. Both modes display the same price for the same configuration.
15. Both modes create the same schema-3 saved physical payload.
16. Both modes use the same saved design for quote navigation.
17. Guided steps and All Controls categories use the documented mapping.
18. A valid preferred mode restores on reload.
19. Invalid stored preferences fall back safely.
20. Hardware is hidden and inert without generated fronts.
21. Lighting warmth is hidden and inert when lighting is off.
22. Cabinet controls are hidden and inert when lower storage is off.
23. Door controls are hidden and inert for open-shelf designs.
24. Numeric drafts preserve their text and connected validation messages.
25. Layout changes reconcile structure while retaining compatible selections.
26. Every collapsed accordion shows a current-value summary.
27. Guided and dialog reviews use one shared summary.
28. Review Edit actions return to and focus the correct Guided step.
29. Invalid drafts survive a mode switch and mark the mapped category.
30. Presentation changes do not calculate price.
31. Rapid Save actions produce one guarded action.
32. Rapid Request Quote actions produce one guarded navigation.
33. The mode tabs support arrow, Home, and End keyboard behavior.
34. The mode selector remains visible and usable at all release widths.
35. One `BookcaseConfigurator.state` is the physical source of truth.

Automated coverage for this matrix lives in
`tests/configurator-experience.test.js` and
`tests/configurator-contract.test.js`. Renderer/camera invariants, responsive
placement, actual keyboard behavior, and browser navigation are also checked
interactively against the running page.

## Completed browser verification — 2026-07-11

- Desktop 1440 × 900: completed the six Guided steps, edited representative
  All Controls categories, opened the shared review, and switched modes ten
  times. One canvas and one viewer instance remained mounted; camera, zoom,
  selected view, configuration, price-call count, and rebuild count were
  unchanged during presentation-only changes.
- Tablet 1024 × 900: preview stacks above controls, the action footer remains
  non-obstructive, the Guided navigation is reachable, and no horizontal
  overflow occurs.
- Mobile 390 × 844: mode selector is above the preview, preview is above
  controls, cards and accordions are one column, essential targets are at
  least 44 px, touch scrolling uses `pan-y`, and neither mode overflows.
- Invalid width text was retained across modes, announced through connected
  validation, and blocked Save/Quote without changing the model or price. A
  subsequent valid width committed exactly once.
- Open Shelves hid cabinet, door, drawer, and hardware controls. No Lights hid
  and inerted warmth. Drawer storage exposed its applicable count and
  hardware controls.
- Finish, same-shape hardware, and lighting-warmth changes used partial viewer
  updates; structural changes used one deterministic rebuild while retaining
  the camera.
- Save created one design ID and Request Quote navigated once to the encoded
  design URL. The quote page restored dimensions, price, finish, and the
  customized structural layout (`Media Wall · Customized`).
- The final browser console log was empty.

Final screenshots:

- `artifacts/configurator-qa/guided-layout-desktop.jpg`
- `artifacts/configurator-qa/guided-dimensions-desktop.jpg`
- `artifacts/configurator-qa/guided-storage-desktop.jpg`
- `artifacts/configurator-qa/guided-appearance-desktop.jpg`
- `artifacts/configurator-qa/guided-review-desktop.jpg`
- `artifacts/configurator-qa/all-controls-desktop.jpg`
- `artifacts/configurator-qa/guided-mobile.jpg`
- `artifacts/configurator-qa/all-controls-mobile.jpg`

## Geometry scenarios

For each scenario, inspect Front, 3/4, Side, and free-rotate views. Confirm that shelves remain inside their section, fronts keep even reveals, handles remain on their parent face, lights touch their host surface, and no panel penetrates an unrelated component.

1. Narrow two-section open bookcase: 36 × 72 × 10 in, two sections, two shelves, lower cabinets off.
2. Wide library wall: 144 × 108 × 15 in, six sections, six shelves.
3. Default lower cabinets: 96 × 96 × 15 in, four sections, four shelves, eight doors.
4. Mixed drawer/door preset: switch to Display Wall or Asymmetrical Modern and inspect every front.
5. Adjustable shelves: move between two and eight shelves repeatedly.
6. Integrated lighting: test pucks, shelf LEDs, side LEDs, and the full package at all three color temperatures.
7. Media center, desk center, fireplace, glass-door, and asymmetrical presets.
8. Minimum and maximum global dimensions.
9. Rapidly switch through all ten presets twice, then reset.
10. Add/remove lower cabinets repeatedly while changing section and shelf counts.

## Required visual checks

- Shelves are empty: no books, plants, vases, bowls, frames, or ornaments.
- No visible floor, floor pattern, room wall, baseboard, or staged environment.
- The selected finish color is shared by the frame, shelves, back, fronts,
  crown, base, and trim; only lighting and physical shadows change appearance.
- No floating lights, handles, shelves, or fronts.
- No shelf/divider, shelf/front, front/front, or trim/frame penetration.
- No duplicate or flickering surfaces and no visible z-fighting.
- Section contents never leak into a neighboring bay.
- Door and drawer reveals remain even after every dimension change.
- Crown, base, back, frame, and dividers remain aligned to the outer case.
- The same saved configuration restores the same geometry and price.
- Drawer-only designs are invariant to hidden door style, tall doors and their
  handles are billed from generated descriptors, and selected lighting is
  non-billable when the generated graph contains zero compatible lights.
- Guided Setup, All Controls, both Review surfaces, Save Design, and local
  quote prefill show or persist the same component-derived total.
- Every preset thumbnail is a unique projection of the same descriptor data
  used by the main model.
- Search by `Hale Navy`, `HC-154`, and `hc154`; apply the result, save, reload,
  and confirm the name, code, approximate hex, and full-model finish persist.
- Search a nonexistent color and confirm a clear no-result message appears
  without inventing or applying a color.
- No new console errors, warnings, or WebGL resource failures.

## Responsive checks

- Desktop reference: 1440 × 900 (also spot-check 1536 × 1024).
- Compact desktop/tablet: 1180 × 820 and 1024 × 900.
- Mobile: 390 × 844 and 360 × 800.
- Controls remain reachable by keyboard, visible focus states are present, side panels scroll instead of clipping, and the layout rail scrolls horizontally.

## Release commands

```sh
npm run build
npm test
git diff --check
```

All three commands must pass before release. This repository has no separate
lint, formatter, or type-check script. Record any remaining console errors,
geometry validation errors, or visual deviations in the handoff.
