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
- `guided-configurator-data.js` owns the internal product catalog, the single
  active public product policy, disabled Coming soon references, and the room,
  measurement, finish, and detail catalogs.
- `guided-configurator-state.js` owns guided project normalization, approximate
  measurement validation, summaries, and local persistence.
- `guided-scene-plan.js` translates guided project state into an inch-based,
  renderer-neutral room and concept-product scene plan.
- `guided-configurator.js` owns the four-step public workflow (Choose Product,
  Choose Layout, Customization, Review & Details) and keeps one guided scene
  controller across steps 3–4.
- `guided-configurator-3d.js` owns the code-native Three.js concept scene,
  shared room/product rendering, world-space callouts, camera, and interaction.
- `configurator-experience.js`, `configurator-3d.js`, and the associated
  configurator styles own the separate accepted-design workspace.
- `bookcase-config.js`, `bookcase-layout.js`, `bookcase-billable.js`, and
  `bookcase-pricing.js` remain the shared product-data, geometry,
  generated-quantity, and estimate sources of truth.

The guided concept scene contract and its separation from physical design,
BOM, and pricing are documented in `GUIDED-3D-SCENE.md`.

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

The public guided configurator exposes Cabinets + Shelves as its only active
product. Only layouts permitted by the checked-in compatibility matrix are
selectable. Other catalog products are disabled Coming soon references; an
older saved project that uses one remains intact, is marked unavailable, and is
routed to Choose Product rather than silently coerced.

Customization contains the layout-specific measurements, finish, and detail
controls. Customization and Review & Details use one persistent accepted
concept scene. Guided drafts remain approximate project briefs; rendering them
does not promote them to accepted physical designs or create manufacturing,
BOM, or pricing authority. Schema-v4 state explicitly maps legacy five-step
positions 1→1, 2→2, 3/4→3, and 5→4 while preserving the last accepted snapshot
and capping reachable progress to the normalized selection.

## Local-preview limitation

The quote form is a non-transmitting UX preview until a production form endpoint
is configured. It validates fields locally, does not store contact details or
uploads, and keeps submission disabled when JavaScript is unavailable. The
interface discloses this limitation before data entry and after validation.
