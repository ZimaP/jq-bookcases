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
  FAQ behavior, saved-design quote prefill, and local quote-draft behavior.
- `styles.css` owns brand tokens and all shared marketing/interior components.
- `configurator.css` owns only the dense configurator application layout.
- `configurator-3d.js` owns parametric UI rendering and 3D interaction.
- `bookcase-config.js`, `bookcase-layout.js`, and `bookcase-pricing.js` remain
  the shared product-data, geometry, and estimate sources of truth.

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

## Local-preview limitation

The quote project brief is stored in the current browser for UX validation.
It does not transmit personal information until a production form endpoint is
configured. The interface states this explicitly after submission.
