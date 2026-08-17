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
is the only active public product, and Fireplace Wall is the only active public
layout; the remaining catalog entries are compact, disabled Coming soon
references. Customization combines dimensions, finish, hardware, lighting, and
details around the fixed SketchUp-derived Room 2 reference model.

The public flow resolves each complete edit through room-topology,
installation-fit, and product engines before it may replace the last accepted
specification used by persistence and summaries. In this fixed-reference phase,
that project data deliberately does not deform, recolor, relight, regenerate,
or replace the GLB. Steps 3–4 share one persistent viewer session and parsed GLB
root. A load or integrity failure remains fail-closed; the public path never
falls back to the prior generated scene or to a photograph. Schema-v4
persistence migrates older five-step drafts without deleting unsupported saved
projects or coercing them into Cabinets + Shelves.

The fixed model is presented by the provisional `room2-studio-neutral-v1`
lighting profile: a local r166 RoomEnvironment/PMREM indirect base, three
scene-space key/fill/rim DirectionalLights, one on-demand shadow caster,
Linear-sRGB lighting, one sRGB output transform, ACES Filmic tone mapping, and a
fixed exposure. This release changes lighting only. Embedded GLB materials and
textures remain untouched; owner visual acceptance is still open and the
texture/material quality phase has not started.

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
main-driven Render publication path and the separate SHA-locked GitHub Pages
procedure are documented in `RELEASE.md`.

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
