# JQ Bookcases

Premium static website and parametric 3D configurator for JQ Bookcases — Built-Ins & Millwork.

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

The accepted configurator is one bright, CAD-like reference workspace: seven
directly reachable stages (Space, Layout, Storage, Finish, Hardware, Lighting,
and Preview), one persistent selectable 3D model, one fixed contextual
Properties inspector, a section organizer with exact total-width status, a
global history/display/tool toolbar, and a shared estimate footer. The seven
stages project the existing nine canonical control groups; they are
organizational, non-linear, and never create a second product engine. Model or
organizer selection routes the same accepted transaction into Properties—no
second floating editor is mounted. Pure configuration, stage, tab, selection,
organizer, and history rules live in `configurator-experience.js`; controller
and renderer integration remain in `configurator-3d.js`.

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

Pull requests and pushes to `main` validate without publishing. The manual-only
production procedure and its exact confirmation contract are documented in
`RELEASE.md`.

The parametric model architecture is documented in
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
