# JQ Bookcases Site Architecture

## Canonical journeys

1. `index.html` is the marketing entry point.
2. Every design CTA opens `configurator.html`.
3. Inspiration cards may add a supported `?preset=<preset-id>` query.
4. Saving in the configurator stores one `jqBookcasesDesign` record locally.
5. Every quote CTA opens `request-quote.html`; a saved design is carried into
   the project brief automatically.

There is no second homepage builder, duplicate contact form, fake newsletter,
or separate quote drawer.

## Public routes

- Home: `index.html`
- 3D Configurator: `configurator.html`
- How It Works: `how-it-works.html`
- Materials: `materials.html`
- Inspiration: `inspiration.html`
- About: `about.html`
- FAQ: `faq.html`
- Request Quote: `request-quote.html`
- Privacy: `privacy.html`
- Terms: `terms.html`

## Shared ownership

- `site.js` owns the global header, footer, navigation, icons, mobile menu,
  FAQ behavior, validated saved-design quote prefill, and local quote-preview
  feedback. Contact fields are never persisted by the preview.
- `styles.css` owns brand tokens and all shared marketing/interior components.
- `configurator.css` owns only the dense configurator application layout.
- `configurator-experience.css` owns the two-mode configurator presentation and
  responsive overrides.
- `configurator-experience.js` owns the pure Guided/All workflow, mappings,
  applicability, validation, summaries, preset transitions, and action
  contracts.
- `configurator-3d.js` owns the single configurator controller, shared shell,
  browser events, persistent viewer, and 3D interaction.
- `bookcase-config.js`, `bookcase-layout.js`, `bookcase-billable.js`, and
  `bookcase-pricing.js` remain the shared product-data, geometry,
  generated-quantity, and estimate sources of truth.

## Visual system

The public site and configurator share the same warm taupe, ivory, and brass
brand language. Shared primitives include the header, footer, buttons, page
hero, cards, forms, typography, focus states, and icons. Responsive behavior is
consolidated around 1120px, 900px, and 680px content breakpoints.

## Adding a page

Every public page must include:

- one unique `body[data-page]` value;
- the skip link, `main#main`, header host, and footer host;
- one `h1`;
- the shared versioned `styles.css` and `site.js` references;
- the canonical interior hero and section structure;
- local links that resolve to a public route.

Run `npm test` after changing navigation, routes, cache tokens, or page shell
markup. `tests/site-integrity.test.js` enforces these contracts.

The configurator has one permanent preview subtree outside both presentation
modes. Guided/All mode preferences are local UI preferences; physical saved
designs remain normalized schema-4 accepted snapshots. Customized designs are mapped back
to their structural layout when prefilled into the quote page.

## Local-preview limitation

The quote form is a non-transmitting UX preview until a production form endpoint
is configured. It validates fields locally, does not store contact details or
uploads, and keeps submission disabled when JavaScript is unavailable. The
interface discloses this limitation before data entry and after validation.
