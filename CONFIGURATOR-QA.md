# Configurator visual QA

Run `npm run serve`, open `http://127.0.0.1:5173/configurator.html`, and keep the browser console visible while testing. The reference-comparison viewport is 1536 × 1024 at 1× scale.

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
- Every preset thumbnail is a unique projection of the same descriptor data
  used by the main model.
- Search by `Hale Navy`, `HC-154`, and `hc154`; apply the result, save, reload,
  and confirm the name, code, approximate hex, and full-model finish persist.
- Search a nonexistent color and confirm a clear no-result message appears
  without inventing or applying a color.
- No new console errors, warnings, or WebGL resource failures.

## Responsive checks

- Desktop reference: 1536 × 1024.
- Compact desktop/tablet: 1180 × 820 and 900 × 1024.
- Mobile: 390 × 844 and 360 × 800.
- Controls remain reachable by keyboard, visible focus states are present, side panels scroll instead of clipping, and the layout rail scrolls horizontally.

## Release commands

```sh
npm run build
npm test
```

Both commands must pass before release. Record any remaining console errors, geometry validation errors, or visual deviations in the handoff.
