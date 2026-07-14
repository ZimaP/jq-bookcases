# JQ Bookcases Overnight Full-System QA Report

Audit date: July 14, 2026

Repository: `ZimaP/jq-bookcases`

Final status: **Partially verified; safe for code review**

The implementation, static-site build, automated regression suite, local browser
workflows, and visual matrix are green. The status is not “fully verified”
because the repository has no quote-submission backend and real-device AR/camera
behavior could not be validated on physical iOS or Android hardware.

## 1. Executive summary

This pass inspected the entire static website, configuration engine, generated
geometry, BOM/pricing transaction, persistence, quote handoff, AR model path,
Three.js lifecycle, responsive UI, accessibility, CI, and Pages packaging.

The baseline already built and passed its existing tests, but it had meaningful
state-integrity, resilience, performance, privacy, responsive, and deployment
gaps. The most important repaired defects were:

- explicit per-section storage types could disagree with global state and UI;
- Section Designer could attempt a seventh section and its undo history could
  roll back unrelated dimensions, finish, lighting, or service selections;
- vertical LEDs used a stale global lower-storage flag instead of each section;
- the Three.js viewer rendered continuously while idle;
- AR requests, object URLs, retries, cache ownership, and dependency loading
  were insufficiently bounded;
- a forged quote design ID could fabricate an estimate-like preview, and the
  quote preview retained personal data locally despite having no transport;
- mobile navigation could leave the rest of the page inert after a failed quote
  handoff;
- tablet viewer controls collapsed and overlapped; the sticky tablet header was
  transparent; selected icons fell below 3:1 non-text contrast; and wide phone
  landscape viewports hid controls and workflow steps;
- public pages lacked useful no-JavaScript navigation, some image dimensions,
  and several small semantic/content clarifications;
- development serving exposed the repository on all interfaces, and Pages used
  broad root-copy packaging rather than an explicit runtime allowlist.

Final automated result: **282/282 unit/contract tests and 52/52 browser cases
passed (334/334 total)**. The browser total comprises 46 Chromium cases plus
three Firefox and three WebKit cross-browser cases. All ten route-level Axe
WCAG A/AA scans passed. The build and dependency audit passed.

## 2. Branch name

`codex/full-system-overnight-qa`

The branch was created for this work. It was not merged and nothing was
deployed to production.

## 3. Starting commit

`454cf757a1027d84191c5dcc8dcaf59ac0fcb59f`

Subject: `Stabilize studio route transitions`

## 4. Final commit

Final tested implementation commit:

`6b28bee9d82ccb36a74630e5ee72d668e29d1d11`

Checkpoint history:

- `c2e93d3` — Checkpoint validated custom studio entry
- `b245ba7` — Harden configurator state AR and render lifecycle
- `6b28bee` — Expand full-site accessibility and browser QA

The report/PR metadata commit follows the tested implementation commit. The
exact final branch HEAD is also recorded in the Codex handoff and draft PR.

## 5. Environment used

- macOS 26.5.2 (build 25F84), Apple silicon `arm64`
- Node.js 26.0.0
- npm 11.12.1
- Python 3.9.6
- Git 2.50.1 (Apple Git-155)
- Playwright 1.61.1
- Axe Playwright 4.10.2
- Chromium, Firefox, and WebKit supplied by Playwright
- Local server bound to `127.0.0.1:5173`
- Time zone: America/New_York

The Browser and Chrome plugin wrappers could not bootstrap in this environment
(`Cannot redefine property: process`). Computer Use first encountered ambiguous
Chrome instances and then an `unknown variant ultra` configuration error.
Playwright provided real browser rendering and automation as the fallback.

## 6. Commands run

Key commands and equivalent focused variants included:

```text
git status --short
git log --oneline --decorate
git diff --check
rg --files
rg -n 'TODO|FIXME|HACK|TEMP|temporary|placeholder|mock|hardcoded|console\.log|console\.error|ts-ignore|eslint-disable|disabled|not implemented|coming soon'
npm ci
npm run build
npm test
npm run test:browser
npx playwright test --list
npx playwright test e2e/site-quality.spec.js --project=chromium
npx playwright test e2e/configurator-options.spec.js --project=chromium
npx playwright test e2e/configurator-render-scheduling.spec.js --project=chromium --repeat-each=10
npx playwright test e2e/cross-browser-smoke.spec.js
npm audit --audit-level=low
npm outdated
python3 -m http.server 5173 --bind 127.0.0.1
ruby -e "require 'yaml'; YAML.load_file(...)"
gh repo view ZimaP/jq-bookcases ...
gh api repos/ZimaP/jq-bookcases/...
```

Additional Playwright scripts measured element rectangles, intersection areas,
computed contrast, scroll behavior, WebGL diagnostics, and screenshot states.
The Pages packaging commands were run locally against a generated `_site`.

No lint, formatter, or TypeScript command exists in this JavaScript-only
repository. `node --check`, icon validation, static contracts, YAML parsing, and
`git diff --check` were used where those commands would ordinarily apply.

## 7. Pages tested

All ten canonical routes were loaded directly and through navigation:

1. `index.html`
2. `configurator.html`
3. `how-it-works.html`
4. `materials.html`
5. `inspiration.html`
6. `about.html`
7. `faq.html`
8. `request-quote.html`
9. `privacy.html`
10. `terms.html`

For every route, the browser suite checked HTTP status, one `main`, one `h1`,
header/footer injection, skip link, duplicate IDs, broken images, document
language/title, horizontal overflow, browser errors, and failed responses.

Header/footer navigation, direct-route loading, browser refresh, saved-state
resume, forced welcome entry, mobile navigation, FAQ filtering/deep links, and
no-JavaScript fallback navigation were also exercised.

## 8. Viewports tested

The structured visual matrix covered:

- 1440 × 900
- 1024 × 768
- 820 × 1180
- 430 × 932
- 390 × 844
- 375 × 812
- 320 × 568

Supplemental landscape coverage:

- 932 × 430
- 844 × 390
- 812 × 375
- 568 × 320

Additional automated or measured sizes included 2011 × 1198, 1440 × 900,
1024 × 900, 820 × 1180, 768 × 1024, 1024 × 768, 390 × 844, and 360 × 800.

The nine non-configurator routes were rendered across the seven-size visual
matrix (63 page renders). Configurator welcome, custom start, accepted design,
all-controls, selected-option, scrolled, and landscape states added more than
twenty primary renders plus targeted states.

## 9. Browsers and browser engines tested

- Chromium: full 46-case suite, full visual matrix, Axe, console/network checks,
  WebGL, responsive and keyboard workflows.
- Firefox: public-route, dimension/save/restore, and procedural-GLB AR smoke.
- WebKit: public-route, dimension/save/restore, and procedural-GLB AR smoke.

Safari and Chrome were represented by WebKit and Chromium automation, not by
manual control of installed desktop applications. No claim is made for a
physical mobile browser or camera session.

## 10. Configurator workflows tested

The browser and unit suites covered:

- welcome, custom-space, inspiration idea, direct preset, refresh, resume, and
  start-over entry paths;
- all ten commercial presets: Lower Cabinets, Classic Open, Media Wall, Library
  Wall, Display Wall, Glass Library, Desk Niche, Feature Wall, Asymmetric Modern,
  and Tall Storage;
- width, height, depth, invalid drafts, minimum/maximum boundaries, narrow/wide,
  tall/low, shallow/deep, and decimal/hostile values;
- section count, per-section width, split, merge, equalize, type changes,
  lower-door/drawer/tall-door/open mixtures, and the six-section limit;
- Section Designer undo/redo and preservation of unrelated later choices;
- shelf count and thickness, generated door count, drawer count, door styles,
  hardware, base styles, crown/top styles, finishes, custom Benjamin Moore
  identity, lighting packages/warmth, installation, and delivery;
- Guided Setup and All Controls sharing one accepted state and one viewer;
- disabled/invalid states, review, Save, restore, Start Over, quote handoff, and
  blocked-storage recovery;
- mobile keyboard activation, mode tabs, camera controls, modal focus restore,
  navigation focus containment, and responsive overflow;
- rapid preset cycling, one hundred successive section edits, and stable
  WebGL/resource diagnostics.

Whole-design duplication, a multi-design library, end-user model export, and a
global configurator undo stack are not present features. “Duplicate / Split”
is a Section Designer operation, and its scoped undo/redo was tested.

## 11. 3D engine areas tested

- initial scene/canvas creation and validated render manifest;
- one persistent viewer across presentation modes;
- camera front, side, three-quarter, orbit, zoom, reset, semantic feature focus,
  transition cancellation, and responsive safe framing;
- exact descriptor dimensions, panel/divider accumulation, shelves, backs,
  doors, drawers, handles, toe kicks/bases, crowns, special openings, and lights;
- component containment, parent/host attachment, collision detection, positive
  geometry, unique IDs, deterministic serialization, and stable fingerprints;
- extreme dimensions and all ten preset families;
- stale geometry removal after changes and preset transitions;
- finish, hardware, lighting, highlight, overlay, and restored-camera visual
  mutations requesting a frame;
- on-demand rendering returning to stable idle rather than running a perpetual
  animation loop;
- disposal of replaced geometry, material, interaction meshes, and the final
  canvas; bounded geometry/texture counts after repeated operations.

No generated preset produced a validation collision, floating attachment,
missing host, non-positive size, NaN, or Infinity in the final suite.

## 12. AR areas tested

Verified in unit/integration/browser automation:

- state/layout normalization and exact inch-to-meter conversion;
- deterministic AR hashes and compact share configuration;
- procedural binary GLB 2.0 generation from the validated descriptor graph;
- meter scale, Y-up orientation, bottom-center origin, and positive-Z front;
- desktop/mobile capability messaging and unsupported fallback contracts;
- real procedural GLB preparation in Chromium, Firefox, and WebKit smoke tests;
- request sequencing, caller cancellation, stale-result rejection, remote
  deadline and procedural fallback;
- eight-entry LRU model cache, duplicate concurrent result ownership, object URL
  revocation on error/eviction/clear, and controller teardown;
- external `<model-viewer>` load failure, retry, and a ten-second definition
  deadline rather than indefinite loading;
- dialog loading/error/ready contracts, return focus, fixed scale, and floor
  placement attributes.

Not verified on physical hardware:

- iOS Quick Look/USDZ handoff;
- Android Scene Viewer/WebXR camera placement;
- camera permission denial/retry;
- true room tracking, occlusion, floor detection, and physical scale comparison.

The cross-browser AR smoke replaces external dependency loading while exercising
the repository's actual procedural GLB. It is not a real camera test.

## 13. Automated tests added or modified

Added:

- `e2e/configurator-options.spec.js` — boundaries, section/storage parity, all
  construction/finish/service options, save/restore, mobile keyboard/camera.
- `e2e/configurator-render-scheduling.spec.js` — sustained idle, transition
  frames, and return to idle after Section Designer teardown.
- `e2e/cross-browser-smoke.spec.js` — routes, physical edit persistence, and
  procedural GLB/AR dialog across three engines.
- `e2e/site-quality.spec.js` — route integrity, Axe, navigation, FAQ, quote
  privacy/resilience, forged IDs, storage failure, tablet/landscape geometry,
  and selected-icon contrast.

Expanded:

- `e2e/bookcase-configurator.spec.js`
- `tests/bookcase-layout.test.js`
- `tests/bookcase-sections.test.js`
- `tests/cabinet-ar.test.js`
- `tests/configurator-contract.test.js`
- `tests/quote-prefill.test.js`
- `tests/site-integrity.test.js`

The renderer-idle test initially exposed a flaky fixed delay (one failure in five
repeats). It was changed to require a sustained 600 ms stable idle window; the
revised test passed ten consecutive repetitions.

## 14. Baseline results

Before mission fixes:

- dependency install: passed;
- production validation build: passed;
- unit/contract tests: **258/258 passed**;
- Chromium E2E: **16/16 passed**;
- dependency audit: zero known vulnerabilities;
- lint: no script configured;
- TypeScript: not used/no script configured;
- formatting: no script configured;
- browser plugins: unavailable due wrapper/environment failures;
- local Python server listened on all interfaces and could serve repository
  internals such as `.git/config`;
- no full-route Axe suite, cross-browser suite, site-integrity matrix, or deep
  options/resilience E2E existed.

The baseline passing state is important: most findings were synchronization,
resilience, visual-breakpoint, privacy, performance, or missing-regression issues
rather than a basic build failure.

## 15. Final results

- unit/contract: **282/282 passed**;
- browser E2E: **52/52 passed** in 3.2 minutes;
- combined automated cases: **334/334 passed**;
- build: passed;
- dependency audit: zero known vulnerabilities;
- route Axe: ten of ten routes with zero WCAG A/AA findings;
- final visual matrix: no document horizontal overflow, broken primary controls,
  console errors, failed local assets, or failed route responses;
- Pages allowlist simulation: 85 runtime files, approximately 5.9 MB;
- `git diff --check`: passed;
- workflow YAML parse: passed.

## 16. Build result

**Pass.** `npm run build` validated 100 semantic icons and 13 product profile
drawings, then syntax-checked all runtime modules and supporting scripts.

This repository is a static site; its “production build” is validation plus
Pages artifact assembly rather than transpilation/bundling.

## 17. Lint result

**Not configured.** There is no lint script or ESLint configuration. Static
contract tests, `node --check`, source searches, and browser console checks were
used. Adding a deliberately configured linter is recommended, but introducing
one and mechanically rewriting the code was outside the safe scope of this pass.

## 18. Type-check result

**Not applicable/not configured.** The application is browser JavaScript and
contains no TypeScript project. All runtime JavaScript passed `node --check`.

## 19. Unit-test result

**282/282 passed, zero skipped, zero failed.**

Coverage includes deterministic geometry, collision/host validation, BOM,
pricing, saved snapshots, product presets, section operations/history,
accessibility/static contracts, icons, camera framing, quote prefill, AR model
and cache behavior, and deployment integrity.

## 20. Integration-test result

There is no separately named integration-test command. Integration behavior is
covered by the Node transaction tests and Playwright browser suite:

```text
UI -> normalized state -> layout -> render manifest -> 3D scene
   -> BOM -> price -> saved schema-v4 snapshot -> restore -> quote prefill
```

Those paths passed. A real quote service integration cannot be tested because
the repository has no backend or submission endpoint.

## 21. End-to-end-test result

**52/52 passed.**

- Chromium: 46/46
- Firefox: 3/3
- WebKit: 3/3

The full Chromium suite covers all critical workflows; Firefox/WebKit cover the
highest-value transaction and procedural-AR smoke paths. Deep option-pairwise
coverage remains Chromium-only to keep CI practical.

## 22. Accessibility result

- Axe WCAG 2 A/AA and 2.1 A/AA: zero findings on all ten routes.
- One `h1`, language, landmarks, skip link, unique IDs, header/footer, and
  public-route contracts verified.
- Mobile navigation has a contained tab loop, correct inert background, Escape
  dismissal, resize cleanup, restored focus, and readable CTA contrast.
- FAQ keyboard behavior, filtering, deep links, and expanded-state wiring pass.
- Required quote fields are explicitly identified; status and upload messages
  are live/associated; no-JavaScript fields cannot submit or receive focus.
- Selected style icons now measure approximately 3.98:1 against their selected
  background (up from approximately 2.91:1).
- Reduced-motion behavior and focus-visible states are present.

Automated Axe does not replace VoiceOver, TalkBack, or NVDA testing. No physical
screen-reader session was available, and the 3D canvas remains intrinsically
visual despite its surrounding instructions and accessible controls.

## 23. Performance observations

Improvements made:

- replaced the viewer's perpetual `requestAnimationFrame` loop with one guarded
  on-demand scheduler;
- verified no additional frames during sustained idle and animation only while
  a camera transition is active;
- verified 100 successive section edits and rapid preset cycling remain
  geometry/texture bounded;
- consolidated browser import cache identities so a module is not evaluated
  under several query strings;
- stopped marketing pages from eagerly importing the quote/configuration graph;
- bounded AR models to an eight-entry LRU and released blob URLs;
- added image intrinsic dimensions, below-fold lazy loading, and async decode;
- made the Pages artifact exclude QA/test/development material.

Static artifact observations:

- simulated runtime artifact: approximately 5.9 MB / 85 files;
- generated Benjamin Moore catalog: approximately 2.11 MB, loaded lazily;
- vendored Three.js module: approximately 1.29 MB, configurator-only;
- root HTML/CSS/JS runtime files: approximately 1.07 MB uncompressed.

No throttled Lighthouse/WebPageTest run, physical-device CPU profile, or long
heap recording was available. The catalog and Three.js remain the clearest
future payload targets; changing them requires careful product/runtime work.

## 24. Browser-console result

**Pass.** Final route, configurator, resilience, and cross-browser tests reported
no unexpected `pageerror` or console error. No React or hydration layer exists.
No WebGL warning or duplicate-canvas regression appeared in the final suite.

## 25. Network-error result

**Pass for local assets and tested mocked failure paths.**

- all canonical routes returned below 400;
- no broken public image or failed local request occurred in the final suite;
- malformed and forged design URLs recovered without an exception;
- remote AR timeout/failure falls back to the procedural model unless the caller
  intentionally aborts;
- external model-viewer load failure and non-registration produce recoverable
  errors and can be retried;
- the quote page performs no network submission because no endpoint exists.

The external model-viewer and QR libraries were not availability-tested against
every production network condition; automated AR smoke isolates those services.

## 26. Issues discovered, grouped by priority

### P0

None. The baseline built and core paths opened.

### P1

- **Remaining:** the “Request a Quote” experience has no backend transport. The
  form is now explicitly and safely labeled as a local project-brief preview,
  but it cannot deliver a customer request.
- Fixed as high-impact responsive failures: short-landscape controls/steps were
  inaccessible; quote handoff could leave mobile content inert; stale section
  state could disagree with generated geometry/BOM/quote output.

### P2

- explicit section types versus global storage/tall-door flags drifted;
- vertical LED placement used stale global state;
- seventh-section split could be normalized away after an invalid operation;
- section undo/redo captured unrelated customer choices;
- idle Three.js rendering consumed continuous frames;
- AR requests/cache/object URLs had incomplete cancellation and ownership;
- AR dependency loading could retry after a load error but could still wait
  forever after a loaded script failed to define the element;
- forged quote IDs could display an invented saved-design-like estimate;
- quote preview stored personal data locally despite transmitting nothing;
- no-JavaScript quote/file controls could remain actionable or focusable;
- upload selection status searched the wrong subtree and never updated;
- tablet portrait viewer control groups flexed into overlapping 64 px buttons;
- configurator sticky header referenced a descendant-scoped variable and became
  transparent over scrolling content;
- 844×390 and 932×430 used tablet desktop framing and hid controls/steps;
- selected option icons dropped below the 3:1 graphical contrast threshold;
- mobile nav storage-failure closure bypassed its inert-state controller;
- marketing routes eagerly imported configurator/pricing modules;
- development server bound to all interfaces;
- Pages artifact assembly used a broad root denylist and deployment did not wait
  for a browser regression gate.

### P3

- no-JavaScript public navigation was absent;
- image dimensions/lazy-loading opportunities caused avoidable layout work;
- FAQ fragments did not reveal their target answer;
- required quote labels and local-preview behavior were insufficiently clear;
- configurator entry/header wording suggested “Save” before a design existed;
- a How It Works example price could be read as live pricing;
- construction copy referenced a wood-tone choice the current UI does not offer;
- schema and lifecycle architecture documentation needed updating;
- browser screenshots were written to tracked artifact paths by an existing E2E.

## 27. Issues fixed

All listed P2/P3 findings were repaired and regression-covered where practical.
Key implementation changes:

- canonicalized per-section physical state back into all legacy/global fields;
- made BOM the source for quote shelf/storage answers;
- enforced section limits before normalization and scoped history snapshots;
- made lighting placement section-aware;
- added guarded on-demand render diagnostics and complete visual mutation frames;
- added AR LRU ownership, cancellation, deadlines, fallback, retry, cleanup, and
  dependency-registration timeout;
- validated schema-v2/v3/v4 local snapshots before quote prefill and required an
  exact local ID match;
- removed local retention of contact details and prevented no-JavaScript GET
  leakage while accurately labeling the local-only form;
- repaired mobile navigation inert/focus behavior and upload announcements;
- repaired tablet/landscape layout, sticky header background, and selected icon
  contrast;
- added responsive/no-JS/content/image/accessibility polish across every page;
- standardized module identities, lazy-loaded quote dependencies, and bound
  development/test servers to loopback;
- added cross-browser/Axe/deep configurator regression coverage;
- restricted Pages deployment to main, added a Chromium deployment gate, and
  assembled the public site from an explicit runtime allowlist.

## 28. Files changed

Relative to the starting commit: **61 files changed, 2,923 insertions, 504
deletions**. The set is:

```text
.github/workflows/browser-quality.yml
.github/workflows/pages.yml
CABINET-AR-ARCHITECTURE.md
SITE-ARCHITECTURE.md
about.html
artifacts/custom-studio-qa/* (10 validated studio-entry screenshots)
artifacts/full-system-qa-20260714/* (6 final focused screenshots)
bookcase-engine.js
bookcase-layout.js
bookcase-pricing.js
bookcase-sections.js
bright-theme.css
cabinet-ar-model.js
cabinet-ar-ui.js
cabinet-ar.js
configurator-3d.js
configurator-experience.css
configurator-experience.js
configurator-precision.css
configurator-studio.js
configurator.html
docs/custom-studio-entry.md
e2e/bookcase-configurator.spec.js
e2e/configurator-options.spec.js
e2e/configurator-render-scheduling.spec.js
e2e/cross-browser-smoke.spec.js
e2e/site-quality.spec.js
faq.html
how-it-works.html
index.html
inspiration.html
materials.html
package-lock.json
package.json
playwright.config.js
privacy.html
quote-prefill.js
request-quote.html
site.js
styles.css
terms.html
tests/bookcase-layout.test.js
tests/bookcase-sections.test.js
tests/cabinet-ar.test.js
tests/configurator-contract.test.js
tests/quote-prefill.test.js
tests/site-integrity.test.js
```

## 29. Important architectural observations

- The strongest existing boundary is the accepted transaction in
  `bookcase-engine.js`: normalized state, validated descriptor graph, BOM,
  pricing, fingerprint, and saved snapshot should continue to commit together.
- `layoutMetadata.sectionTypes` is the authoritative physical per-section state.
  Legacy global fields still exist for UI/backward compatibility and must be
  derived from that source whenever the complete list is present.
- Generated descriptors—not UI counts—are the reliable source for BOM, quote
  options, and physical price quantities.
- One persistent Three.js viewer and one on-demand scheduler now serve both
  Guided and All Controls modes.
- Saved designs are schema-v4 accepted snapshots. Schema-v2/v3 recovery remains
  supported, but serialized geometry is never trusted; it is regenerated.
- The AR model is derived from the same validated descriptor graph and emits
  meters directly. It does not own a second configuration state.
- The quote page is currently a local preview, not an integration. Treating it
  as a production submission form without a server would be misleading.
- This is a static Pages application. Browser-side validation improves UX but
  cannot replace server-side quote validation, rate limiting, abuse prevention,
  secure storage, or operational delivery.

## 30. Remaining risks

1. No quote backend, delivery confirmation, spam/rate protection, or secure
   server-side validation exists.
2. Real-device AR scale, tracking, permission, Quick Look, and WebXR behavior is
   unverified.
3. Deep pairwise configurator coverage is Chromium-only; Firefox/WebKit receive
   the highest-value smoke workflows.
4. Three.js is vendored at r166 while the current ecosystem is newer. A direct
   upgrade could change rendering and should be a separate visual/AR project.
5. The 2.11 MB color catalog and 1.29 MB Three.js module dominate payload size.
6. External model-viewer/QR dependencies remain network availability and supply
   chain dependencies; versions are pinned, but assets are not self-hosted.
7. GitHub `main` is not branch-protected. Dependabot security updates, secret
   scanning, push protection, and validity checks are disabled. The Pages
   environment still has an old `codex/cabinet-ar-mvp` deployment branch policy,
   although the workflow itself is now main-only.
8. There is no configured linter, formatter, coverage threshold, or TypeScript
   check.
9. Marketing warranty/trust/delivery claims and legal/privacy language were not
   independently substantiated by business or counsel.
10. Existing asset notes identify temporary/low-resolution imagery that should
    be reviewed before a final commercial launch.

## 31. Items that could not be tested and exact reason

- **Real quote delivery:** no endpoint, credentials, backend, CRM, or email
  transport exists in the repository.
- **Real-device AR:** no physical iOS/Android device or camera session was
  available to the execution environment.
- **Camera denial/retry and room tracking:** owned by the external model-viewer
  flow on a physical supported device; browser simulation is not equivalent.
- **iOS USDZ/Quick Look:** requires compatible Safari/iOS hardware.
- **Production GitHub Pages runtime:** no deployment was authorized; the local
  artifact and workflows were validated instead.
- **Screen readers:** no VoiceOver/TalkBack/NVDA manual session was available;
  semantics, keyboard behavior, and Axe were checked.
- **Physical touch/trackpad and mobile keyboard opening:** Playwright touch-sized
  layouts and keyboard input were used, not physical hardware.
- **Browser zoom at every 80/100/125/150/200 setting:** responsive and text-flow
  states were checked, but no exhaustive OS/browser zoom matrix was available.
- **Long-duration heap profile/context-loss recovery:** resource counters,
  disposal contracts, rapid loops, and teardown were tested; forced real WebGL
  context loss and hours-long profiling were not.
- **Multiple-tab conflict resolution:** there is one local saved snapshot and no
  collaboration protocol; no formal multi-tab merge behavior exists to verify.
- **Business formula correctness:** internal state/BOM/price parity is tested,
  but manufacturing rates and commercial rules were not externally supplied.

## 32. Recommendations requiring human product decisions

1. Select and implement the quote transport/CRM/email architecture, including
   server-side validation, consent, retention policy, abuse protection, success
   receipts, and operational ownership.
2. Decide whether the current local project-brief page should remain visible
   until that backend exists or be presented as a planning worksheet.
3. Schedule physical iOS and Android AR acceptance with measured reference
   objects and a documented device/browser support matrix.
4. Review and substantiate delivery, warranty, five-star/trust, and “no
   surprises” claims; obtain legal review of Privacy and Terms.
5. Decide whether to self-host model-viewer/QR dependencies and whether to plan
   a separately tested Three.js upgrade.
6. Enable branch protection, required checks, Dependabot security updates,
   secret scanning, and push protection in GitHub repository settings; remove
   the retired Pages environment branch policy if no longer needed.
7. Choose final production photography for the temporary/low-resolution slots.
8. Decide whether customers need multiple saved designs, whole-design duplicate,
   export, or a global undo/redo history; those are product features, not safe
   assumptions for this repair pass.

## 33. Screenshots and artifact locations

Final focused evidence (approximately 512 KB total):

- `artifacts/full-system-qa-20260714/home-desktop-1440x900.jpg`
- `artifacts/full-system-qa-20260714/configurator-desktop-1440x900.jpg`
- `artifacts/full-system-qa-20260714/configurator-tablet-820x1180.jpg`
- `artifacts/full-system-qa-20260714/configurator-landscape-844x390.jpg`
- `artifacts/full-system-qa-20260714/selected-options-mobile-390.jpg`
- `artifacts/full-system-qa-20260714/quote-mobile-430x932.jpg`

Additional existing focused evidence remains under:

- `artifacts/custom-studio-qa/`
- `artifacts/configurator-qa/`
- `artifacts/section-designer-qa/`
- `artifacts/guided-builder-repair/`
- `artifacts/supervisor-qa/`

Transient Playwright reports and failure traces are intentionally ignored and
excluded from Pages.

## 34. Draft PR link

[Draft PR #4: Full-system configurator QA, resilience, and visual polish](https://github.com/ZimaP/jq-bookcases/pull/4)

The working tree began at `454cf75` on an existing, unmerged custom-studio
lineage that was already 58 commits ahead of `main`. This audit adds four
commits from that explicit starting point; the main-targeted draft PR therefore
shows the inherited lineage as well as this audit (62 commits total at PR
creation). No history was rewritten to conceal or flatten that context.

## 35. Clear final status

**Partially verified; safe for review.**

The implementation is coherent, committed on a dedicated branch, builds, and
passes all final automated and local browser checks. It is ready for engineering
and product review. It is not ready to be represented as a complete production
quote workflow or as fully real-device-validated AR until the remaining human
decisions and physical testing above are completed.
