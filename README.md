# JQ Bookcases

Premium static website and parametric 3D configurator for JQ Bookcases -- Built-Ins & Millwork.

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

The public route map, shared-shell ownership, and canonical customer journeys
are documented in `SITE-ARCHITECTURE.md`.

## Benjamin Moore lookup

`benjamin-moore-colors.js` is a curated local catalog subset used for the
configurator search. It supports normalized color-name and color-code lookup
without runtime scraping or a remote API claim. The stored `approximateHex`
values are screen-preview approximations only; final manufacturing color must
be verified with a physical paint sample. The data layer is isolated so an
authorized official provider can replace it later without changing the UI or
saved configuration schema.

The current local subset was reviewed against Benjamin Moore's public color
catalog. It is not an official API connection, a complete catalog, or a color
accuracy guarantee.
