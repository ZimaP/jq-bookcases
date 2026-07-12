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

The configurator provides synchronized Guided Setup and All Controls modes
over one physical configuration and one persistent 3D viewer. Workflow rules
live in `configurator-experience.js`; the controller and renderer integration
remain in `configurator-3d.js`.

## Run Locally

Serve the folder, then open `http://127.0.0.1:5173/index.html`:

```sh
npm run serve
```

## Verify

```sh
npm run build
npm test
```

The parametric model architecture is documented in
`CONFIGURATOR-ARCHITECTURE.md`. Repeatable desktop, mobile, preset, and
geometry checks are listed in `CONFIGURATOR-QA.md`.

The feature-flagged “View in Your Room” MVP, platform matrix, model-provider
contract, deployment requirements, and known limitations are documented in
`CABINET-AR-ARCHITECTURE.md`. Physical-device checks are in
`CABINET-AR-QA.md`.

The public route map, shared-shell ownership, and canonical customer journeys
are documented in `SITE-ARCHITECTURE.md`.

## Benjamin Moore lookup

`benjamin-moore-colors.js` implements the shared lazy-loaded catalog-provider
contract used by both configurator modes. The generated local catalog contains
4,056 unique codes imported from the 11 Adobe ASE palettes linked by Benjamin
Moore's official professional palette-download page on 2026-07-12. Run
`npm run catalog:benjamin-moore` to regenerate the catalog and provenance
manifest deterministically from the checked-in official source palettes.

Customer runtime search never contacts Benjamin Moore. Saved selections retain
brand, code, name, catalog ID, collection, preview RGB/hex, source type, and
catalog version. These official-palette RGB values are digital previews only;
final manufacturing color must be confirmed with an official physical paint
sample. JQ Bookcases does not claim an official Benjamin Moore partnership.
