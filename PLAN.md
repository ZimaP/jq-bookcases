# Configurator Guided Setup / All Controls Plan

Status: completed locally on 2026-07-11. No deployment was performed.

## Baseline

- The site is static HTML/CSS with native ES modules and a vendored Three.js renderer.
- `BookcaseConfigurator` owns one normalized physical configuration in `this.state`.
- `BookcaseViewer3D` owns one scene, camera, canvas, model group, and render loop.
- Pricing, saved-design persistence, and quote navigation are local synchronous flows.
- At audit time, existing tests covered configuration normalization, geometry,
  colors, icons, and static site contracts but not configurator workflow
  behavior. Dedicated experience and shell-contract suites were added.

## Non-negotiable implementation contract

1. Keep one `BookcaseConfigurator`, one canonical physical state, and one continuously mounted viewer/canvas.
2. Treat mode, guided step, expanded category, appearance tab, input drafts, and scroll position as presentation state only.
3. Never replace the viewer subtree when switching modes or steps.
4. Route both modes through the same field-commit, validation, pricing, save, quote, and review functions.
5. Preserve the existing saved-design schema and quote URL contract.
6. Expose only values supported by `bookcase-config.js`; do not invent frame, glass, cabinet-height, measurement-unit, or shelf-profile products.
7. Do not deploy this work.

## Milestone 1 — Pure workflow contract

- Add a small testable configurator-experience module.
- Define six Guided steps and the All Controls categories.
- Add mode/step/category preference sanitizers and mappings.
- Add contextual applicability, validation, category summaries, and shared review-summary helpers.
- Add shared saved-design/quote payload helpers and in-flight action guards without changing existing contracts.

Validation: Node tests for modes, steps, mappings, visibility, summaries, validation, payload parity, and one-source-of-truth invariants.

## Milestone 2 — Stable shared shell

- Refactor the builder markup into a persistent shell with:
  - accessible segmented mode selector;
  - one shared preview and camera toolbar;
  - one active control surface;
  - one shared price/action footer;
  - one status region.
- Keep the viewer node and canvas mounted while control content changes.
- Remember the last valid mode in local storage; default invalid/missing preference to Guided Setup.
- Split camera reset from physical-design reset.
- Add accessible selected state to camera controls.

Validation: one viewer/canvas before and after repeated mode changes; no configuration, camera, zoom, or view reset.

## Milestone 3 — Guided Setup

- Implement Layout, Dimensions, Shelves & Cabinets, Construction, Appearance, and Review & Quote.
- Render one decision group at a time with Back/Continue and inline validation.
- Preserve shared draft strings for incomplete dimension entries during mode changes.
- Use real presets and real option registries only.
- Add recommended guidance and a deferred Benjamin Moore search.
- Add Edit actions from the shared review back to the mapped Guided step.

Validation: complete the six-step flow in both directions and verify all selections persist.

## Milestone 4 — Organized All Controls

- Implement accessible accordions for Layout, Dimensions, Shelves & Cabinets, Construction, Doors & Storage, Finish, Hardware, Lighting, and Project Service.
- Show compact current-value summaries in collapsed headers.
- Render only applicable controls:
  - hardware and door controls only when generated fronts exist;
  - drawer count only when drawers exist;
  - warmth only when lighting is enabled;
  - cabinet controls only when lower storage is enabled.
- Preserve every current schema-backed customer adjustment, while keeping preset-derived openings and tall-door structure tied to their supported layouts.
- Provide direct Review Design, Save Design, and Request Quote access.

Validation: edit representative fields in each category and confirm the Guided presentation reads the same canonical values.

## Milestone 5 — Renderer and action invariants

- Deduplicate `input`/`change` commits and skip no-op physical updates.
- Ensure mode, step, category, accordion, review, and camera changes never recalculate price or rebuild the model.
- Add a viewer lifecycle/debug seam and preserve camera/view state across physical updates.
- Add a partial appearance update path where safe; retain full deterministic rebuilds for geometry changes.
- Gate Guided Continue, Save Design, and Request Quote when the generated layout is invalid.
- Prevent duplicate Save and Quote actions.
- Clear stale validation/status state after a valid correction.

Validation: call-count tests plus browser instrumentation for one renderer, stable canvas, stable view, stable camera/zoom, and no duplicate actions.

## Milestone 6 — Responsive, accessible, and visual polish

- Desktop: 360–420 px control panel with preview receiving the remaining space.
- Tablet/mobile: mode selector above preview; preview above controls; single-column accordions/cards; sticky but non-obstructive actions.
- Add keyboard behavior for tabs, steps, accordions, camera views, and focus return.
- Add visible focus, connected validation messages, live status text, touch targets, and reduced-motion handling.
- Keep the premium warm-charcoal, ivory, and restrained brass visual direction.

Validation: interactive browser checks at approximately 1440, 1024, and 390 px with console/network inspection and no horizontal overflow.

## Milestone 7 — Final verification

- Capture final screenshots for Guided Layout, Dimensions/Storage, Appearance, Review, All Controls desktop, Guided mobile, and All Controls mobile.
- Run all repository tests and the production syntax build.
- Inspect the complete diff for duplicated business logic, unused legacy UI, missing options, contract changes, and renderer regressions.
- Update architecture and QA documentation with the delivered behavior and known limitations.

## Completion record

- Milestones 1–7 are implemented.
- Guided Setup exposes Layout, Dimensions, Shelves & Cabinets, Construction,
  Appearance, and Review & Quote.
- All Controls exposes nine contextual accordion categories over the same
  physical state and handlers.
- The persistent viewer/canvas, camera, zoom, view selection, price pipeline,
  saved schema, and quote URL were preserved.
- Browser QA completed at 1440 × 900, 1024 × 900, and 390 × 844 with no final
  console messages or horizontal overflow.
- The complete build and 135-test suite pass; `git diff --check` is clean.
- Final screenshots are stored under `artifacts/configurator-qa/`.

## Pricing release blockers — focused correction

Status: completed locally on 2026-07-12 under explicit owner authorization.

- Preserve the existing shared configurator state, renderer, interface modes,
  saved-design schema, quote URL, and all non-target pricing formulas.
- Derive door leaves, drawer fronts, attached hardware, and compatible lighting
  quantities from the pure `generateBookcaseLayout()` descriptor graph used by
  the renderer, rather than from hidden selections or control visibility.
- Normalize the established door, hardware, and lighting premiums to generated
  component quantities using the repository's prior BOM-pricing calibration;
  preserve the established default-design premium totals and bundle discount.
- Reuse one pricing context for the live estimate, both review surfaces, saved
  designs, and quote prefill; stale preferences remain stored but are described
  as non-billable when the generated layout has no compatible components.
- Add deterministic golden tests for drawer-only, tall-door, zero-compatible
  lighting, valid lighting, layout reconciliation, mode/save/quote parity, and
  duplicate-action invariants, then rerun the complete build/test/diff/browser
  verification sequence.

Completion evidence: `npm test` passed 155/155, the focused pricing suite passed
9/9, `npm run build` passed, `git diff --check` passed, and live browser QA at
1440 × 900, 1024 × 900, and 390 × 844 completed with one stable viewer/canvas,
no overflow, and an empty console. No deployment, real quote, commit, or schema
change was performed.

## Benjamin Moore Color Lookup Integration

Status: implementation and verification in progress on 2026-07-12.

- Replace the prior 30-color hand-curated approximation with a deterministic
  import of every Adobe ASE palette currently linked from Benjamin Moore's
  official professional palette-download page.
- Keep the binary maintenance inputs under `data/vendor/benjamin-moore/source/`,
  generate one versioned JSON catalog plus provenance manifest, and lazy-load
  the searchable catalog only after the customer begins a Benjamin Moore search.
- Route Guided Setup and All Controls through one `ColorCatalogProvider`, one
  shared `paintSelection` object, and the existing single configurator/viewer.
- Preserve legacy custom-paint fields as normalized compatibility mirrors while
  saving brand, catalog ID, code, name, collection, preview RGB/hex, version, and
  source provenance in the canonical configuration.
- Apply the ASE sRGB preview through Three.js r166's existing sRGB-to-linear
  `Color.setHex` path without replacing painted materials, textures, maps,
  roughness, hardware, glass, scene, camera, or renderer.
- Preserve the repository's established `custom_bm: 1.0` pricing multiplier,
  expose a single custom-paint classification in pricing and quote data, and do
  not invent a new owner rate.
- Verify importer conflicts, search ranking, state migration, renderer lifecycle,
  save/reopen, quote prefill, pricing parity, accessibility, production build,
  catalog performance, and desktop/tablet/mobile browser behavior.

## Website Visual Consistency and Design System

Status: completed locally on 2026-07-12. No deployment was performed.

1. Inventory every customer-facing route and capture desktop/mobile visual baselines.
2. Keep `styles.css` as the only token source and add one final shared component-normalization layer for route-specific compositions.
3. Normalize typography roles, gutters, section rhythm, surfaces, buttons, form controls, focus states, shared navigation, and footer treatment without changing product behavior.
4. Rework the FAQ into a compact, scannable support page with accessible category filters, search, result feedback, and the existing single-open accordion behavior; preserve all answer copy.
5. Preserve the configurator's renderer, state, pricing, save, quote, and Benjamin Moore architecture while aligning only its shared shell primitives.
6. Verify every route at desktop, tablet, and mobile widths; inspect console, overflow, keyboard-visible states, and representative interactions.
7. Run the complete test suite, production build, and diff checks; document the final system in `DESIGN_SYSTEM.md` and append completion evidence to the supervisor report.

Completion evidence: all ten canonical routes were verified in the in-app
Browser; 30 additional route/viewport sweeps at 1024, 768, and 320 pixels had
zero overflow failures; the 390px mobile sweep had zero failures and retained
16px body copy; FAQ search/filter interactions passed; `npm test` passed
153/153; `npm run build` and `git diff --check` passed. Final screenshots are
stored under `artifacts/visual-consistency/final/`.
