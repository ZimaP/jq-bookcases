# JQ Bookcases Configurator — Independent Supervisor Report

Audit date: 2026-07-12  
Final decision: **Approved**  
Reason: the owner subsequently authorized the focused pricing correction. The two release-blocking price/model mismatches are resolved, regression-tested, and independently verified in the live configurator. Section 16 records the resolution evidence and supersedes the earlier open pricing status.

## 1. Executive summary

The Guided Setup and All Controls experiences use one normalized physical configuration, one price pipeline, one persistent Three.js viewer, one Save handler, and one Quote handler. Independent browser work confirmed bidirectional synchronization, stable renderer/camera state through mode switches, contextual controls, inline validation, responsive stacking, and an empty final console.

The audit found and corrected these customer-facing or technical defects:

- incomplete saved-design prefill on the quote form;
- unsafe HTML rendering of restored custom paint text;
- incomplete Three.js viewer cleanup;
- the preview intercepting standard Ctrl/Cmd browser zoom;
- inaccessible fallback focus for generic validation errors;
- misleading access to Review while a numeric draft is invalid;
- low-contrast configurator helper text and a 42 px color-result target.

The original audit also reproduced two pricing defects: hidden door choices affected drawer-only prices while generated tall doors/hardware could be ignored, and a lighting package could be charged when the generated layout contained no compatible lighting components. The owner has now authorized and completed the focused component-derived correction documented in Section 16.

No deployment, production-data mutation, real quote submission, package installation, commit, or push was performed.

## 2. Git range or diff reviewed

- Repository: `JQ bookcases`
- Branch: `main`
- Base and current committed HEAD: `03e7bf2` (`fix: unify brand and restore hero readability`)
- Remote baseline: `origin/main` at the same commit
- Reviewed range: committed `03e7bf2` versus the complete uncommitted working tree, including all new configurator experience files and tests
- The implementation was not committed, so there is no later commit SHA to name.
- Unrelated pre-existing worktree changes were preserved.

The audit read `PLAN.md`, architecture/QA notes, the full tracked diff, all new workflow and test modules, the generated layout rules, pricing, saved-design persistence, quote prefill, and the Three.js renderer lifecycle.

## 3. Architecture findings

Evidence-backed passes:

- `BookcaseConfigurator.this.state` is the sole permanent physical configuration.
- Mode, step, accordion, tab, scroll position, and numeric draft strings are presentation state only.
- The mode-specific panels are replaced, but the viewer node is outside those branches and remains mounted.
- Exactly one `BookcaseViewer3D` is constructed for the one configurator host.
- Both interfaces route edits through the same delegated input handler, normalizer, layout generator, price function, viewer update, review builder, Save handler, and Quote handler.
- Saved designs remain schema 3: `{schemaVersion, id, price, config, savedAt}`; schema 2/3 restore remains supported.
- The quote URL remains `request-quote.html?design=<encoded id>`.
- No active legacy dual sidebar, alternate physical state, DOM-scanned configuration, or second pricing pipeline was found.

The remaining inert legacy renderer helpers are maintenance debt but have no current call path.

## 4. Functional findings

Guided Setup exposes and successfully exercises the required six steps:

1. Layout
2. Dimensions
3. Shelves & Cabinets
4. Construction
5. Appearance
6. Review & Quote

Back/Continue behavior, step validation, progress state, review Edit actions, service selections, and selection persistence were exercised in the live app. An invalid width draft (`10`) remained visible across a mode switch, retained the last committed model value, received `aria-invalid` and a connected error, and prevented Review, Save, and Quote until corrected.

All Controls exposes nine organized accordion categories: Layout, Dimensions, Shelves & Cabinets, Construction, Doors & Storage, Finish, Hardware, Lighting, and Project Service. Collapsed summaries update from the canonical configuration. Sequential Back/Continue controls are absent in this mode.

Contextual behavior passed for open shelves, lower cabinets, drawers, doors, hardware, lighting warmth, custom paint, and layout-derived openings. Ten canonical product layouts remain available; no invented product categories were found.

## 5. Renderer-lifecycle findings

Live evidence:

- Four repeated Guided → All → Guided → All cycles retained viewer instance `1`, canvas count `1`, renderer update count `1`, rebuild count `1`, price-call count `1`, and the identical camera/zoom diagnostic string.
- Geometry edits caused one canonical viewer update and one price calculation per committed edit.
- Finish, same-shape hardware, and light-temperature changes used the partial update path where applicable.
- Camera view, zoom ratio, and active view survived presentation-only mode changes.

Correction made: viewer controls now use an `AbortController`; `destroy()` aborts listeners, disconnects resize observation, removes/disposes the model and scene resources, disposes renderer lists/context resources, and removes the canvas.

## 6. State-synchronization findings

Browser proof after correction:

- Initial width: `116`.
- All Controls committed width `118`: exactly one physical update, one price calculation, and one viewer update.
- Guided Dimensions immediately showed `118`.
- Guided committed width `120`; All Controls immediately showed `120` and reopened Dimensions.
- Final state still had one viewer/canvas and one canonical configuration.
- Open Shelves preserved dimensions, custom Hale Navy finish, shelf construction, crown, lighting, and service choices while hiding non-applicable door/hardware controls.
- Invalid numeric draft text was not silently discarded on mode change.

No state-synchronization loop or race was observed during rapid mode changes.

## 7. Pricing findings

The implementation has one shared price function, and presentation-only actions do not recalculate it. Identical canonical state produces the same number in both modes.

The original shared formula did not consistently follow generated applicability:

- A drawer-only design generates 12 drawer fronts and zero doors, yet changing the hidden door style changes the estimate from `$14,850` to `$15,550`.
- A two-section tall-storage design with lower cabinets disabled generates two doors and two handles, yet brass and polished-nickel hardware produce the same `$14,500` estimate.
- That tall-storage design can generate zero light descriptors while `full_package` changes the estimate from `$14,500` to `$16,150`.

The cause was visible in `bookcase-pricing.js`: door and hardware premiums were keyed only to `lowerCabinets`, and lighting was keyed only to the selected package. The generated layout made different applicability decisions.

Status: **resolved under explicit owner authorization.** Pricing now uses one normalized physical-component context derived from the same generated descriptor graph as the renderer. See Section 16.

## 8. Save and quote findings

Save and Quote use shared delegated handlers, action locks, one physical configuration, and the existing schema/URL contracts. The live non-destructive flow saved local design `JQ-I5UEAI` and navigated to its local quote page; no form was submitted.

The original handoff omitted custom Benjamin Moore text, lower-cabinet state, and selected project options. This was corrected with a pure centralized mapper. Live post-fix evidence for the saved Open Shelves design:

- layout: `classic-open` / Open Shelves;
- lower cabinets: `No`;
- paint finish: `custom_bm`;
- custom color: `Hale Navy HC-154`;
- selected options: integrated lighting, crown molding, adjustable shelves;
- no horizontal overflow.

The quote form uses its existing field names and local-preview behavior; no quote API or database contract was added or changed.

## 9. Responsive findings

Measured live after corrections:

| Viewport | Preview | Controls | Result |
| --- | --- | --- | --- |
| 1440 × 900 | 1022 × 630 | 394 px wide | One canvas, no overflow, mode selector visible |
| 1024 × 900 | 1013 × 549, above controls | 981 px wide below preview | One canvas, no overflow |
| 390 × 844 | 379 × 350, below mode selector | 359 px wide below preview | One canvas, `touch-action: pan-y`, no overflow |

At 390 px, the only sub-36 px elements detected were visually hidden 1 × 1 radio inputs whose visible labels are the interaction targets. A blocking validation hint occupied its own row without intersecting price/actions and produced no mobile overflow.

## 10. Accessibility findings

Verified or corrected:

- mode selector uses tab semantics, roving `tabindex`, arrow/Home/End keyboard behavior, and visible selection;
- appearance tabs and accordions have connected controls/panels and expanded state;
- fields have labels; numeric errors use `aria-invalid` and `aria-describedby`;
- generic validation now focuses a `tabindex="-1"` error summary;
- Review, Save, and Quote disable together for a blocking draft and reference visible completion guidance;
- icon-only actions have accessible names;
- the 3D preview no longer consumes Ctrl/Cmd wheel or Ctrl/Cmd `+`/`−`, preserving browser zoom;
- mobile viewer scrolling remains `pan-y` and zoom is available through 44 px buttons;
- low-opacity helper, summary, review-term, and preview text was raised to a stronger neutral contrast; preview help gained a translucent backing;
- Benjamin Moore result targets were raised from 42 px to 44 px;
- reduced-motion rules remain present.

No interaction depends only on hover. A formal colorimeter audit was not available; practical contrast was reviewed against the live charcoal surfaces.

## 11. Automated-test results

Final commands:

- `npm run build` — passed. This repository's build is syntax validation via `node --check`, not a bundling pipeline.
- `npm test` — passed: **155/155** after pricing regression additions.
- `node --test tests/bookcase-pricing.test.js` — passed: **9/9** focused pricing goldens.
- `git diff --check` — passed.

Added or strengthened coverage for component-derived pricing quantities, drawer-only hidden-state invariance, tall doors and hardware, zero- and positive-component lighting, mixed doors/drawers, forced glass doors, layout reconciliation, shared Save/Quote totals, quote mapping, HTML escaping, viewer teardown, browser-zoom guards, blocking-action guidance, independent control-registry completeness, cache-token integrity, and saved customized layout handoff.

The repository has no dependency lockfile and exposes no lint, formatter, typecheck, or automated browser command. Several architecture tests are source-contract assertions; live browser verification was therefore performed independently rather than treating those tests as sufficient evidence.

## 12. Browser-verification results

The actual local site was exercised with the in-app browser at 1440 × 900, 1024 × 900, and 390 × 844.

Scenarios covered:

- all six Guided steps and review Edit links;
- all nine All Controls categories;
- bidirectional width synchronization;
- section, shelf, cabinet/drawer, construction, finish, hardware, lighting, warmth, and service changes;
- preset transition to Open Shelves with contextual controls;
- unresolved custom paint validation and successful Hale Navy selection;
- invalid numeric draft persistence across mode change;
- repeated mode switching with stable camera/viewer/price counters;
- Save once and local Quote navigation once;
- corrected quote prefill without submission;
- responsive stacking and overflow;
- visible blocking-action guidance and focus/error wiring;
- final console check: `[]` (no runtime errors or warnings).

Screenshots:

- `artifacts/supervisor-qa/before-desktop.jpg`
- `artifacts/supervisor-qa/after-quote.jpg`
- `artifacts/supervisor-qa/after-quote-fields.jpg`
- `artifacts/pricing-release-qa/desktop-zero-light-review.jpg`
- `artifacts/pricing-release-qa/tablet-zero-light.jpg`
- `artifacts/pricing-release-qa/mobile-zero-light.jpg`

The original audit's WebGL full-page capture timed out in the browser capture layer. The focused pricing-resolution pass subsequently captured the desktop, tablet, and mobile viewport images above successfully; live DOM/layout metrics, interaction counters, and console output were also verified.

## 13. Issues discovered

| ID | Severity | Description and evidence | Impact | Relevant file/component | Resolution |
| --- | --- | --- | --- | --- | --- |
| PR-01 | High | Hidden door style priced drawer-only layouts; generated tall doors/hardware were not priced when `lowerCabinets` was false. | Estimate could depend on an invisible option or omit a visible premium. | `bookcase-billable.js`, `bookcase-pricing.js`, `bookcase-layout.js` | **Fixed and regression-tested** |
| PR-02 | High | A lighting package could be charged when layout rules generated zero light descriptors. | Customer could pay for an option not represented in the design. | `bookcase-billable.js`, `bookcase-pricing.js`, `bookcase-layout.js` | **Fixed and regression-tested** |
| A11Y-01 | High | Viewer consumed Ctrl/Cmd browser zoom gestures/keys. | Users could not reliably enlarge the page over the dominant preview. | `configurator-3d.js` viewer controls | Fixed and regression-tested |
| SQ-01 | Medium | Saved quote handoff lost lower-cabinet state, custom BM color, and options. | Quote form contradicted or incompletely represented the saved design. | `site.js`, `quote-prefill.js` | Fixed; live handoff verified |
| SEC-01 | Medium | Restored custom paint text was inserted into review/category HTML without escaping. | Crafted legacy/local records could inject markup/script into the review. | `configurator-3d.js`, `configurator-experience.js` | Fixed and unit-tested |
| A11Y-02 | Medium | Generic layout validation focused a non-focusable content wrapper. | Keyboard/screen-reader users could lose error context. | Guided validation focus | Fixed |
| UX-01 | Medium | Review remained available while an invalid draft showed older committed values; disabled completion actions lacked shared guidance. | Misleading review and dead-end action state. | Action availability/review flow | Fixed; desktop/mobile live proof |
| A11Y-03 | Medium | Several 10–11 px helper/summary labels used 50–58% ivory opacity over dark/dynamic surfaces. | Practical readability and AA reliability were weak. | `configurator-experience.css` | Fixed with stronger neutral values/backing |
| REN-01 | Medium | Viewer teardown left listeners, canvas, and scene-owned resources. | Future remounts could leak resources/listeners. | `BookcaseViewer3D.destroy()` | Fixed and contract-tested |
| TEST-01 | Medium | No repo-native browser suite; several workflow tests inspect source structure instead of behavior. | Future regressions could pass unit tests. | Test infrastructure | Open limitation; independent live QA completed |
| LEG-01 | Low | Old renderer helper branches remain uncalled. | Maintenance/bundle surface only; no current customer effect. | Lower renderer helper block | Open; defer to a dedicated cleanup |
| UX-02 | Low | Preview copy advertised scroll zoom on tablet where scrolling intentionally moves the page. | Instruction mismatch. | Preview heading copy | Fixed |
| A11Y-04 | Low | BM search-result target was 42 px. | Slightly undersized touch target. | `configurator.css` | Fixed to 44 px |

## 14. Corrections made

- Added `quote-prefill.js` as the centralized, testable saved-design → existing quote-form mapper.
- Prefilled room, dimensions, lower-cabinet state, structural layout, finish, custom BM name/code, and applicable existing option checkboxes.
- Escaped customer/restored text before review/category/error HTML interpolation.
- Completed viewer listener, scene, renderer, and canvas teardown.
- Preserved Ctrl/Cmd browser zoom and clarified preview instructions.
- Made generic error summaries programmatically focusable.
- Disabled Review with Save/Quote for blocking drafts and linked all actions to visible guidance.
- Strengthened secondary text contrast and preview-copy backing.
- Raised BM result targets to 44 px.
- Added regression tests and bumped cache tokens for all changed public assets.
- Repeated browser and console checks after the corrections.

## 15. Remaining limitations

1. The repository has no automated browser-test harness. Current confidence combines pure tests, source contracts, and detailed live-browser verification. A future suite should cover mode synchronization, one renderer, counters, invalid drafts, Save/reload/Quote, v2/v3 records, keyboard behavior, console/network failures, and 1440/1024/390 overflow.
2. The quote page is an intentional local preview rather than a production transport, so real network loading/error behavior and customer-record creation were not exercised.
3. The repository exposes no lint or typecheck command; the available production gate is syntax validation through `npm run build`.
4. Uncalled legacy renderer helpers remain and should be removed only in a focused cleanup with model screenshot comparison.

PR-01 and PR-02 are resolved. No remaining release-blocking issue was found in the authorized pricing scope.

## 16. Pricing Release Blockers — Resolution

### Root causes

1. **Hidden door-style pricing:** `bookcase-pricing.js` used `lowerCabinets` as proof that doors existed, so a drawer-only design with a stale premium `doorStyle` received the premium despite generating zero door leaves.
2. **Omitted tall-door pricing:** the same `lowerCabinets` gate ignored tall-door descriptors generated independently by `tallDoors` and section layout rules.
3. **Omitted tall-door hardware:** hardware used the same gate instead of counting the actual handle descriptors attached to generated tall doors.
4. **Zero-component lighting charges:** lighting used only the selected package and never checked whether `generateBookcaseLayout()` emitted compatible `light` descriptors.

### Corrected architecture

- `bookcase-billable.js` derives drawer fronts, lower cabinet doors, tall doors, glass doors, hinged door leaves, drawer hardware, door hardware, and puck/shelf/vertical light quantities from the pure generated descriptor graph.
- `buildPricingContext()` separates normalized selections, the generated physical layout, billable quantities, preserved rates, component charges, and the final rounded total.
- The configurator passes its already-generated `this.layout` into the pricing context, so the renderer and pricing consume the exact same graph without a second UI-specific store or duplicated layout algorithm.
- One cached `this.price` still feeds the visible estimate, Guided Review, All Controls Review, Save Design, and Request Quote.
- Quote prefill reconstructs the same pure context from the saved configuration, recalculates the corrected estimate, and marks lighting or hardware only when matching generated components exist.
- Review and collapsed summaries explicitly distinguish a stored selection from generated billable lighting, including “No compatible locations” when appropriate.

### Unit rates preserved

No established reference premium was changed and no unrelated price formula was rewritten. The repository's prior BOM-pricing calibration on `origin/engine-hardening-supervisor` supplies the per-component normalization:

- Slim Shaker and glass: `$250 / 8 = $31.25` and `$700 / 8 = $87.50` per generated door.
- Hardware: each existing `$125`–`$225` reference amount divided by eight default handles.
- Puck, shelf LED, and vertical LED: `$450 / 4 = $112.50`, `$850 / 16 = $53.125`, and `$650 / 8 = $81.25` per generated light component.
- Full-package lighting retains the established `$1,550` reference total through the existing `1550 / 1950` bundle multiplier.

All 100 default door-style × hardware × lighting combinations retain their previous rounded totals. Sections, shelves, lower-cabinet frontage, crown, base, finish, installation, delivery, depth, minimum, and rounding formulas remain unchanged.

### Focused files modified

- Pricing/model: `bookcase-billable.js`, `bookcase-pricing.js`, `configurator-3d.js`, `configurator-experience.js`.
- Save/quote consumers: `quote-prefill.js`, `site.js`.
- Validation/cache wiring: `package.json`, the ten canonical HTML entry points.
- Regression coverage: `tests/bookcase-pricing.test.js`, `tests/configurator-contract.test.js`, `tests/configurator-experience.test.js`, `tests/quote-prefill.test.js`, `tests/site-integrity.test.js`.
- Documentation/evidence: `PLAN.md`, `SUPERVISOR_REPORT.md`, `artifacts/pricing-release-qa/`.

No public API payload, saved-design schema, quote URL, database schema, unit label, product option, renderer contract, or network submission path changed.

### Regression tests added

The test count increased from **142 to 155**. New deterministic coverage includes:

- drawer-only glass-vs-shaker hidden-state parity with 12 generated drawer fronts and 12 drawer hardware units;
- two generated tall doors, two attached hardware units, and zero-compatible-light behavior;
- valid puck and full-package lighting, including positive quantity changes;
- layout changes removing obsolete door, hardware, and light charges while stale selections remain harmless;
- forced upper glass doors and mixed door/drawer component categories;
- all ten presets matching priced quantities to generated descriptor counts;
- preserved reference premium totals;
- one representative drawer/tall/zero-light/valid-light matrix proving displayed calculation = saved price = quote-prefill price;
- one shared cached total and one delegated Save/Quote action path.

### Exact final validation

- `npm test` — **155/155 passed**.
- `node --test tests/bookcase-pricing.test.js` — **9/9 passed**.
- `npm run build` — passed (`node --check` for every runtime module, including `bookcase-billable.js`).
- `git diff --check` — passed.
- No lint or typecheck script exists in `package.json`.
- Independent read-only review also sampled 8,000 generated configurations with zero descriptor-count, hidden-door, zero-light, precomputed-layout, or quote-price parity failures.

### Browser verification

The real local configurator passed the required non-destructive scenarios:

- Drawer-only: hidden `glass` and `shaker` door styles both displayed `$14,950`; each generated zero doors, 12 drawer fronts, 12 drawer handles, `$0` door premium, `$225` hardware, and `$450` valid puck lighting.
- Tall doors: lower cabinets off generated two tall Slim Shaker doors and two polished-nickel handles; charges were `$62.50` and `$56.25` respectively.
- Zero-compatible lighting: the two-section all-tall design stored `full_package` but generated zero lights, displayed the same `$14,600` as `no_lighting`, showed “No compatible locations” in category and Review, and left quote-prefill Integrated lighting unchecked.
- Valid lighting: Open Shelves with five shelves per section generated 32 full-package light components and `$1,718.91` lighting; reducing sections from four to three generated 24 and `$1,289.19`, with the visible total updating from `$14,200` to `$12,950`.
- Door removal: Full Bookcase with eight glass doors and eight handles had `$700` door and `$150` hardware charges; changing to Open Shelves reduced both quantities and charges to zero.
- Guided Setup and All Controls showed the identical `$14,950` drawer-only total. Viewer instance `1`, canvas count `1`, camera angles, and zoom ratio remained unchanged through the mode switch.
- Guided Review and the All Controls dialog showed the same corrected totals and generated quantities.
- Save Design created only local test record `JQ-T2DXMM`; Request Quote navigated once to the local quote page. The prefill displayed `$14,600`, two generated hardware units, and no installed-lighting implication. No quote was submitted.
- Viewports `1440 × 900`, `1024 × 900`, and `390 × 844` had no horizontal overflow. The one viewer/canvas remained stable; mobile retained `touch-action: pan-y`.
- Final browser console: `[]`.

Screenshots:

- `artifacts/pricing-release-qa/desktop-zero-light-review.jpg`
- `artifacts/pricing-release-qa/tablet-zero-light.jpg`
- `artifacts/pricing-release-qa/mobile-zero-light.jpg`

### Remaining limitations and final release status

The remaining limitations are infrastructure-only: there is no repo-native automated browser harness, no lint/typecheck command, the quote page is a local preview, and inert legacy renderer helpers remain out of scope. No production record was created, no real quote was submitted, no deployment occurred, and no commit was made.

Final pricing release status: **Approved**.

## Benjamin Moore Color Lookup Integration

### 1. Overall implementation status

The complete local integration is implemented and verified. Customers can
search the real official-palette catalog by name or formatting-tolerant code,
deliberately apply a result, see the existing painted 3D materials update, move
between Guided Setup and All Controls, review the exact paint identity, save and
reopen it, and carry it into quote prefill. No deployment, commit, database
change, real quote submission, logo use, partnership claim, HTML scraping, or
runtime Benjamin Moore request was performed.

### 2. Architecture used

- `ColorCatalogProvider` defines the shared search/code/ID/normalization,
  metadata, and official-reference contract.
- `BenjaminMooreColorCatalogProvider` is one lazy singleton used by the one
  shared Finish control rendered in both interface modes.
- The generated catalog is fetched from a local versioned JSON asset only after
  search begins (or when a restored Benjamin Moore selection must be checked).
- One canonical `paintSelection` object lives in the existing shared physical
  configuration. Legacy `customPaintColor`, `customPaintCode`, and
  `customPaintHex` remain normalized compatibility mirrors.
- The existing configurator, renderer, scene, canvas, price context, Save
  Design action, and Request Quote action remain singular.

### 3. Official palettes and collections imported

Downloaded on 2026-07-12 from Benjamin Moore's official professional palette
download page: Affinity Color Collection, Benjamin Moore Classics, Color Trends
2026 Palette, Color Stories, Color Preview, Historical Colors, Off White
Collection, Williamsburg Color Collection, America's Colors, Designer
Classics, and Colors for Vinyl. All 11 sources are Adobe ASE files; their exact
official URLs, byte sizes, record counts, and SHA-256 hashes are in
`data/generated/benjamin-moore-catalog-manifest.json`.

### 4. Catalog counts and integrity

- Source palette files: **11**
- Unique codes / unique colors: **4,056 / 4,056**
- Collections: **11**
- Source aliases: **0**
- Duplicate records merged: **83**
- Minor official one-channel RGB variants merged deterministically: **40**
- Material conflicts: **0**
- Required records verified from imported values: White Dove OC-17 `#F0EFE6`,
  Hale Navy HC-154 `#434B56`, October Mist 1495 `#B6B8A5`, and Evening Dove
  2128-30 `#525B68`.

The importer accepts official RGB blocks only, records provenance, rejects
unsupported color spaces, fails on naming or material RGB conflicts, merges
collection membership, assigns stable IDs, and emits deterministic sorted JSON.
Regeneration produced identical SHA-256 hashes before and after the run.

### 5. Catalog size and performance

- Generated catalog: **2,111,917 bytes**
- Gzip transfer equivalent: **140,891 bytes**
- Generated manifest: **5,279 bytes**
- Always-loaded provider module: **7,905 bytes**, only **150 bytes larger** than
  the prior 7,755-byte curated lookup module.
- Initial-load browser inventory with a standard preset: catalog request
  **absent**; the catalog adds no initial transfer.
- Desktop first code search including lazy fetch, parsing, indexing, UI update,
  and the 160 ms debounce: **238 ms**.
- Desktop common-name search through the loaded catalog: **222 ms** including
  debounce and UI update.
- Direct provider measurement: **11.75 ms** to build the index and complete the
  first exact-code search; **0.61 ms** for a subsequent common-name search.

### 6. Search normalization and customer UI

The provider ranks exact canonical code, exact normalized code, exact name,
name prefix, code prefix, word-prefix, and name substring in that order. Tests
and browser QA cover `OC-17`, `oc17`, `OC 17`, `HC-154`, `hc154`, `1495`,
`2128 30`, `AF655`, White Dove, Hale Navy, October Mist, and Evening Dove.
Duplicate-name results remain distinct by code and collection. A failed search
preserves the applied finish. Results are capped at 12, escaped as text, and
require an explicit Apply action (Enter on an exact query is also a deliberate
apply action).

The shared UI retains Popular JQ Colors, exposes Benjamin Moore Search, shows
swatch/name/code/collection, provides a selected-color card, links to the
verified official paint-color explorer in a protected new tab, and displays the
full digital-preview disclaimer. Search labeling, `aria-describedby`, live
result counts, applied announcements, native button keyboard behavior, visible
focus, text-plus-swatch labeling, white-swatch borders, and practical touch
targets were verified.

### 7. Shared state, persistence, and backward compatibility

Saved official selections include source, brand, catalog ID, code, name,
collections, preview RGB/hex, catalog version, and source type. Schema 3 remains
additive and compatible. Schema 2/3 legacy records still load; earlier custom
Benjamin Moore name/code/hex values are normalized into a non-destructive
`saved-preview` selection. Standard finishes clear the Benjamin Moore object.
A missing current record preserves the saved identity and preview and produces
a calm warning. Browser Save Design created local test record `JQ-AFCV1Y`; a
reload restored Hale Navy HC-154, its collection, version, and digital value.

### 8. 3D material and color-management integration

Three.js remains r166 with `SRGBColorSpace` renderer output, ACES filmic tone
mapping, and exposure 1.08. ASE RGB values are stored as sRGB preview hex/RGB;
`Color.setHex` converts them into Three.js's linear working space. The feature
does not apply a second gamma transform, alter exposure, use emissive paint, or
replace materials.

The existing partial finish path updates only `case`, `side`, `back`, `inset`,
and `edgeBlock` colors plus derived reveal/edge colors. Roughness, metalness,
paint textures/bump maps, lighting, geometry, hardware, glass, and other
materials remain untouched. White Dove and Hale Navy each incremented only the
partial-update counter; renderer rebuilds stayed at 1, canvas count at 1, viewer
instance at 1, and the chosen 0.90 zoom ratio and camera angles survived color
and mode changes.

### 9. Pricing integration

Benjamin Moore maps once to the existing `custom_bm` classification. One shared
pricing context feeds live estimate, both reviews, Save, and Quote. Changing
between Benjamin Moore colors does not add another charge, and switching to a
standard finish clears the classification. Door, hardware, and lighting
component pricing tests remain green.

Repository history confirms the established `custom_bm` multiplier has always
been **1.0**, so the existing custom-paint premium amount is `$0`. The work did
not invent or change an owner rate. This is the only business-rule limitation
against the brief's expectation of a non-zero premium.

### 10. Review, Save Design, and Request Quote

Review Design shows Benjamin Moore, exact name and code, collection, “Digital
preview only,” and the full accessible disclaimer. Save contains the complete
paint object rather than a result index. Quote prefill exposes `customPaint`,
`paintBrand`, `paintCode`, `paintName`, `paintCollection`, `paintPreviewHex`, and
`paintCatalogVersion`, populates matching hidden form fields, and keeps the
human-readable `customBmColor` field. Browser QA confirmed Hale Navy HC-154 and
the disclaimer on the quote page; no quote was submitted.

### 11. Files created

- `scripts/import-benjamin-moore-colors.js`
- `data/vendor/benjamin-moore/README.md`
- 11 official ASE files under `data/vendor/benjamin-moore/source/`
- `data/generated/benjamin-moore-colors.json`
- `data/generated/benjamin-moore-catalog-manifest.json`
- Eight screenshots under `artifacts/benjamin-moore-qa/`

### 12. Feature files modified

- Provider/catalog: `benjamin-moore-colors.js`, `package.json`
- State/business flow: `bookcase-config.js`, `configurator-experience.js`,
  `bookcase-pricing.js`, `quote-prefill.js`
- UI/renderer: `configurator-3d.js`, `configurator.css`,
  `configurator-experience.css`, `styles.css`, `site.js`, `request-quote.html`
- Cache wiring: the ten canonical HTML entry points
- Tests: `tests/benjamin-moore-colors.test.js`,
  `tests/bookcase-config.test.js`, `tests/bookcase-pricing.test.js`,
  `tests/configurator-contract.test.js`, `tests/quote-prefill.test.js`
- Documentation: `README.md`, `PLAN.md`, `SUPERVISOR_REPORT.md`

The worktree was already dirty with the larger configurator/pricing release;
all unrelated edits and artifacts were preserved. Nothing was staged.

### 13. Exact validation commands and result

- `npm run catalog:benjamin-moore` — passed; deterministic catalog regenerated.
- `shasum -a 256 data/generated/benjamin-moore-colors.json data/generated/benjamin-moore-catalog-manifest.json` before/after — identical.
- `node --test --test-reporter=dot tests/*.test.js` — **153/153 passed**.
- `npm test` — **153/153 passed** in the final suite.
- `npm run build` — passed all runtime/importer syntax checks.
- `git diff --check` — passed.
- `gzip -c data/generated/benjamin-moore-colors.json | wc -c` — 140,891.

### 14. Browser scenarios verified

- Desktop 1440 × 900: Guided Appearance/Finish, code and name search,
  formatting tolerance, White Dove and Hale Navy apply, camera/zoom retention,
  Guided ↔ All Controls synchronization, Review, Save/reload, and quote prefill.
- Tablet 1024 × 900: search and apply October Mist 1495, distinguish duplicate
  October Mist codes, search/apply Evening Dove using `2128 30`, usable preview,
  and no horizontal overflow.
- Mobile 390 × 844: Guided search, `OC 17` result, readable result card, 262 px
  input, 307 px results container, reachable Apply action/footer, one canvas,
  and no horizontal overflow.
- Failure state: an invalid search retained Evening Dove 2128-30.
- Runtime assets: the only color-data request was the local generated JSON;
  there were no runtime Benjamin Moore resources.
- Local application console filter: `[]`.

### 15. Screenshot paths

1. `artifacts/benjamin-moore-qa/01-guided-search-desktop.png`
2. `artifacts/benjamin-moore-qa/02-code-search-results.png`
3. `artifacts/benjamin-moore-qa/03-white-dove-applied.png`
4. `artifacts/benjamin-moore-qa/04-hale-navy-applied.png`
5. `artifacts/benjamin-moore-qa/05-all-controls-same-color.png`
6. `artifacts/benjamin-moore-qa/06-review-design.png`
7. `artifacts/benjamin-moore-qa/07-tablet-evening-dove.png`
8. `artifacts/benjamin-moore-qa/08-mobile-benjamin-moore-search.png`

### 16. Remaining limitations and legal/brand review

- An owner-approved non-zero custom-paint rate does not exist in the repository;
  the established 1.0 rate was preserved.
- The repository has no native automated browser runner; browser verification
  was completed interactively against the real local app and backed by unit and
  contract tests.
- Screen preview is not a physical paint match and must remain accompanied by
  the sample-confirmation disclaimer.
- Production counsel/brand review should confirm continued redistribution of
  the officially downloadable ASE source files and generated catalog. No logo,
  room imagery, partnership claim, or private API is used.
- The quote page remains the repository's local non-transmitting preview.

Final status: **Approved with limitations**.

## Website Visual Consistency and Design System

Status: **completed locally on 2026-07-12; no deployment, commit, quote submission, or external write was performed.**

### 1. Scope and route inventory

The audit covered every customer-facing route in the repository:

- `index.html`
- `configurator.html`
- `how-it-works.html`
- `materials.html`
- `inspiration.html`
- `about.html`
- `faq.html`
- `request-quote.html`
- `privacy.html`
- `terms.html`

There are no login, registration, password-reset, dashboard/account, standalone
contact, or dedicated 404 routes in this static site, so no authentication or
account screenshots were invented. The existing Request a Quote page remains
the contact/project-intake flow.

### 2. Baseline findings

The repository already had a strong semantic token foundation in `styles.css`,
but five marketing routes loaded composition-specific reference stylesheets
after it. Those sheets reintroduced independent heading sizes, 9–13px reading
copy, fixed text-bearing section heights, page-specific buttons/radii, and a
compressed alternate footer. FAQ and quote pages used the shared system but had
overly tall introductory regions. The configurator already had an appropriate
dense application exception and needed preservation rather than redesign.

Baseline screenshots were recorded under
`artifacts/visual-consistency/baseline/` before implementation.

### 3. System architecture

- `styles.css` remains the single source of semantic color, type, spacing,
  radius, shadow, layout, control, and focus tokens.
- `visual-consistency.css` is loaded last on all ten routes. It introduces no
  competing brand tokens; it maps legacy route compositions back to the roles
  in `styles.css`.
- `DESIGN_SYSTEM.md` documents the canonical implementation contract, route
  templates, component roles, responsive rules, accessibility requirements,
  and configurator exception.
- `DESIGN-SYSTEM.md` remains as a compatibility summary and now points to the
  canonical underscore filename requested for this pass.
- Shared cache tokens were updated consistently for `styles.css` and `site.js`
  on every route.

### 4. Site-wide visual normalization

- Page titles now resolve to one page-title role; About/Home retain the shared
  display role only where their image-led hero hierarchy warrants it.
- Body reading copy is 16px, leads use the shared 16–18px role, visible helper
  text is at least 12px, and route-specific tiny body copy was removed.
- Containers and gutters resolve to the same content width and responsive page
  gutter rather than one-off measured-art widths.
- Text-bearing About, Materials, Inspiration, and How It Works sections use
  content-driven heights, shared section rhythm, shared surface/border/radius
  roles, and responsive grid collapse.
- Legacy gold/outline/start-design buttons map to the primary/secondary button
  system with the same height, radius, weight, focus, and brass treatment.
- About, Materials, and Inspiration now use the same production footer as the
  rest of the marketing site; How It Works no longer suppresses it.
- Privacy and Terms use the same compact interior hero and readable content-card
  rhythm as other internal routes.
- Request a Quote keeps all existing fields, uploads, hidden paint metadata,
  saved-design prefill, and submission behavior while using the compact hero
  and shared form/surface hierarchy.

### 5. FAQ redesign

The FAQ now has a compact internal-page hero, visible search, six topic choices,
live result feedback, a single shared accordion, a no-results state, and a
simplified support CTA. All ten existing questions and every answer were
preserved verbatim.

Search matches both question and answer text. Topic controls use native buttons
and `aria-pressed`; the result count is a status region. The existing accessible
single-open accordion remains intact. Mobile filters use a two-column rhythm
with the All Questions and Measurement & Installation controls spanning the
full row, allowing the first answer to enter the initial 844px viewport.

Browser verification confirmed that `paint color` returns the Benjamin Moore
and online-price questions, and that the Measurement & Installation filter
returns exactly the measurement and installation questions.

### 6. Configurator preservation

The 3D Bookcase Configurator remains the intentional full-screen, denser product
shell. This pass did not alter the renderer, scene, camera, viewer lifecycle,
physical state, Guided/All Controls architecture, pricing, saved-design schema,
quote URL/prefill, or Benjamin Moore catalog/provider/material paths. The final
shared layer reinforces only the common focus color and inherits the global
token source. Desktop and mobile screenshots confirm the same one-viewer
composition and action shell.

### 7. Responsive and accessibility verification

The in-app Browser was used against the real local site at 1440 × 900, 1024 ×
900, 768 × 900, 390 × 844, and 320 × 900. Every route was checked at desktop
and mobile; all ten routes were additionally swept at 1024, 768, and 320 pixels.

- 30 route/viewport overflow checks at 1024, 768, and 320: **0 failures**.
- Ten-route mobile check at 390: **0 failures**, 16px body copy on every route.
- Desktop route sweep: consistent title roles, shared footers on marketing
  routes, and no horizontal overflow.
- FAQ search/filter state, `aria-pressed`, result feedback, and empty-state
  behavior were exercised in the browser.
- Exactly one H1 and all shared metadata/static-reference contracts remain
  protected by the complete test suite.

### 8. Validation evidence

- `npm test` — **153/153 passed**.
- `npm run build` — passed every syntax check.
- `git diff --check` — passed.
- Final browser route sweeps — passed at desktop, tablet, mobile, and 320px.
- Final screenshot route console/page-error/request-failure/HTTP-error audit — `[]`.
- No deployment, staging, commit, quote submission, or configurator schema
  mutation occurred.

### 9. Final screenshot set

Final screenshots are stored under `artifacts/visual-consistency/final/`:

1. `home-desktop.png`
2. `home-mobile.png`
3. `faq-desktop.png`
4. `faq-mobile.png`
5. `configurator-desktop.png`
6. `configurator-mobile.png`
7. `request-quote-desktop.png`
8. `about-desktop.png`
9. `shared-footer-desktop.png`

The homepage screenshots include the shared navigation state; the About/footer
capture records the representative internal-page CTA and complete shared footer.

### 10. Files added or modified for this pass

Added:

- `visual-consistency.css`
- `DESIGN_SYSTEM.md`
- baseline/final assets under `artifacts/visual-consistency/`

Modified:

- all ten canonical HTML routes (shared layer/cache wiring; shared footer hosts
  on the three former reference-footer routes)
- `faq.html`
- `site.js`
- `DESIGN-SYSTEM.md`
- `PLAN.md`
- `SUPERVISOR_REPORT.md`

Final status: **Approved for local handoff; no deployment performed.**
