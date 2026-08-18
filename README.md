# JQ Bookcases

Premium static website and guided 3D configurator for JQ Bookcases — Built-Ins & Millwork.

## Pages

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

`index.html` is the canonical marketing entry point. All design actions route to
`configurator.html`, and all site-wide quote actions route to
`request-quote.html`. The shared header, footer, navigation, icons, tokens, and
responsive primitives are owned by `site.js` and `styles.css`.

`configurator.html` hosts the four-step public guided project flow: Choose
Product, Choose Layout, Customization, and Review & Details. Cabinets + Shelves
is the only active public product. Step 1 nevertheless renders the complete
image-card catalog in this order: Cabinets + Shelves, Drawers + Shelves, Full
Open Shelving, TV Unit, Floating Storage, Window Storage, and Radiator Cover.
The latter six cards are focusable, disabled Coming Soon references. Fireplace
Wall, Door Wall, and Window Wall are the three active layouts.

The public flow resolves each complete edit through room-topology,
installation-fit, and product engines before it may replace the last accepted
specification used by persistence and summaries. `guided-layout-registry.js`
selects one of three byte- and SHA-locked authoritative GLBs and loads it only
when that layout enters Customization. Ordinary room measurements, hardware,
lighting, and Details remain saved project data. Each layout has exactly one
PROVEN smart control, Adjustable shelf clearance, implemented as the audited
rigid translation of one named shelf node; span, opening, height, and depth
controls remain BLOCKED. Only Fireplace has accepted Finish authority (118
PROVEN primitive targets). Door and Window keep their embedded materials and
disable Finish preview because they have zero PROVEN Finish targets.

Steps 3–4 reuse one controller, renderer, canvas, and currently parsed root.
Changing layout aborts stale work, disposes the prior model resources, and
parses only the newly selected exact asset. The renderer prefers a genuine
WebGPU adapter and has supported forced and automatic WebGL2 paths. Any model,
integrity, or renderer failure stays visible and recoverable without showing a
wrong layout, the old generated scene, or a photograph. Schema-v5 persistence
stores independent `layoutStates[layoutId].measurements` and
`layoutStates[layoutId].smartDimensions`, migrates legacy drafts idempotently,
and preserves unsupported saved projects without coercion.

The Fireplace appearance uses the provisional `room2-commercial-pbr-v1`
profile with local licensed texture sidecars, a local HDR environment, bounded
lights and shadows, one output transform, and semantic camera fitting. Door and
Window start from their embedded source materials. All appearance is a digital
preview, not a calibrated or approved physical finish sample; owner visual
acceptance and Blender-lookdev parity remain deferred.

The guided engine architecture, installation invariants, PBR material contract,
save/reload behavior, and shop-review boundary are documented in
`GUIDED-3D-SCENE.md`. The separate CAD-like workspace remains documented in
`CONFIGURATOR-ARCHITECTURE.md`.

## Run Locally

Serve the folder, then open `http://127.0.0.1:5173/index.html`:

```sh
npm run serve
```

## Verify

```sh
npm ci
npm run build
npm test
npm run test:browser
git diff --check
```

Pull requests and pushes validate the repository's GitHub checks. The verified
Render identity gate and the separately authorized SHA-locked GitHub Pages
procedure are documented in `RELEASE.md`. Pages is never evidence that Render
updated.

The production payload check uses the exact static allowlist under Node
`22.23.2`, zlib `1.3.1-e00f703`, and independent gzip level 9. Its locked base
is `732,539` bytes across 47 JavaScript/CSS files at release-base SHA
`7d961711dfc0b39f6d708699bcf145c8bb7eebd1`; this change may add no more than
`150,000` gzip bytes. `three@0.166.1` (MIT) is the exact WebGPU-renderer source
matching the existing r166 runtime, with its shipped license at
`assets/vendor/licenses/three-0.166.1-LICENSE.txt`. `esbuild@0.28.2` (MIT) is a
build-only deterministic bundler. Both are exact dev dependencies in the
lockfile; the bundle externalizes `three` and the import map resolves it to the
existing local `three.module.js`, so no second Three runtime is shipped. An
advisory check must be run and recorded before release; this document does not
claim security clearance in advance.

The accepted parametric model architecture is documented in
`CONFIGURATOR-ARCHITECTURE.md`. Repeatable desktop, tablet, phone, short-
landscape, preset, and geometry checks are listed in `CONFIGURATOR-QA.md`.

The feature-flagged “View in Your Room” MVP, platform matrix, model-provider
contract, deployment requirements, and known limitations are documented in
`CABINET-AR-ARCHITECTURE.md`. Physical-device checks are in
`CABINET-AR-QA.md`.

The public route map, shared-shell ownership, and canonical customer journeys
are documented in `SITE-ARCHITECTURE.md`.

## Benjamin Moore lookup

`benjamin-moore-colors.js` implements the shared lazy-loaded catalog-provider
contract used by the Finish stage and selected-object Properties panel. The generated local catalog contains
4,056 unique codes imported from the 11 Adobe ASE palettes linked by Benjamin
Moore's official professional palette-download page on 2026-07-12. Run
`npm run catalog:benjamin-moore` to regenerate the catalog and provenance
manifest deterministically from the checked-in official source palettes.

Customer runtime search never contacts Benjamin Moore. Saved selections retain
brand, code, name, catalog ID, collection, preview RGB/hex, source type, and
catalog version. These official-palette RGB values are digital previews only;
final manufacturing color must be confirmed with an official physical paint
sample. JQ Bookcases does not claim an official Benjamin Moore partnership.
