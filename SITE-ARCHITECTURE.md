# JQ Bookcases Site Architecture

## Canonical journeys

1. `index.html` is the marketing entry point.
2. Every design CTA opens `configurator.html`.
3. Inspiration cards may add a supported `?preset=<preset-id>` query.
4. The guided flow saves its working draft under
   `jqGuidedConfiguratorDraftV1` and its project list under
   `jqGuidedConfiguratorProjectsV1`.
5. Every quote CTA opens `request-quote.html`; the separate accepted-design
   workspace may carry its legacy `jqBookcasesDesign` record into the brief.

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
  FAQ behavior, validated accepted-design quote prefill, and local quote-preview
  feedback. Contact fields are never persisted by the preview.
- `styles.css` owns brand tokens and shared marketing/interior components.
- `guided-configurator-data.js` owns the seven Step 1 product choices, the one
  active-product policy, the three-layout public policy, and the retained room,
  measurement, finish, and detail catalogs.
- `guided-configurator-state.js` owns schema-v5 migration, accepted snapshots,
  approximate measurement validation, per-layout state isolation, summaries,
  and the guided draft/project storage keys.
- `guided-configurator.js` and `guided-immersive-configurator.css` own the
  four-step journey and its adaptive desktop panel, tablet overlay, and mobile
  customization sheet.
- `guided-layout-registry.js` owns exact source assets, hashes and bounds;
  camera and appearance authority; semantic shelf anchors; smart-control
  formulas and ranges; backend support; and layout thumbnails.
- `guided-layout-material-zones.generated.js` and
  `config/immersive-layout-material-zones-v1.json` own the exhaustive runtime
  primitive-zone lookup and its PROVEN/PROVISIONAL/BLOCKED authority.
- `guided-layout-viewer.js` is the active shared viewer. It owns verified model
  fetch/parse, genuine WebGPU selection and WebGL2 fallback, camera/touch/named
  views, smart-dimension translation, layout switching, disposal, and runtime
  diagnostics.
- `guided-room2-appearance.js`, `guided-room2-materials.js`, and
  `guided-room2-integrity.js` remain shared appearance/integrity support. The
  full Finish material system applies only to the exact Fireplace allowlist.
- The deprecated `guided-room2-viewer.js` fixed-Room-2 implementation has been
  removed. Production packaging also rejects that path explicitly.
- `guided-scene-plan.js` and `guided-configurator-3d.js` retain internal
  parametric contracts for other repository work; they are not imported by the
  public immersive-layout path.
- `configurator-experience.js`, `configurator-3d.js`, and associated styles own
  the separate accepted-design workspace.
- `bookcase-config.js`, `bookcase-layout.js`, `bookcase-billable.js`, and
  `bookcase-pricing.js` remain shared product-data, geometry,
  generated-quantity, and estimate sources of truth.

The guided preview's separation from physical design, BOM, price, and
manufacturing authority is documented in `GUIDED-3D-SCENE.md`.

## Public guided release boundary

Cabinets + Shelves is the sole active Step 1 product. The other six full-image
cards are focusable, disabled Coming Soon references. Fireplace Wall, Door
Wall, and Window Wall are all active under Cabinets + Shelves. Unsupported
saved products/layouts remain stored, are marked unavailable, and route back to
the applicable selection step instead of being deleted or silently coerced.

Ordinary measurements, Details, hardware, and customer lighting choices
validate, persist, and appear in summaries. Each layout has one PROVEN
Adjustable shelf clearance control that rigidly translates one audited shelf
node. Span, opening, overall-height, and depth changes are BLOCKED. Fireplace
has 118 PROVEN Finish targets; Door and Window have none and therefore retain
embedded materials with Finish preview disabled.

Customization and Review & Details reuse one controller/canvas/current parsed
root. Camera state is remembered per layout so incompatible bounds never share
a pose. Switching layouts aborts stale work and disposes prior model resources.
Schema-v5 state isolates `measurements` and `smartDimensions` beneath each
`layoutStates[layoutId]` record while preserving legacy migrations and accepted
project snapshots.

Every guided result remains an interactive project preview. It is not site
verification, a shop drawing, manufacturing authorization, structural review,
a calibrated finish sample, a BOM, or a price.

## Visual system and page contract

The public site and configurator share the same warm taupe, ivory, and brass
brand language. Shared primitives include the header, footer, buttons, page
hero, cards, forms, typography, focus states, and icons.

Every public page must include one unique `body[data-page]` value; the skip
link, `main#main`, header host, and footer host; one `h1`; versioned shared
styles and `site.js`; and local links that resolve to a public route.
`tests/site-integrity.test.js` enforces these contracts.

## Local-preview limitation

The quote form is a non-transmitting UX preview until a production form endpoint
is configured. It validates fields locally, does not store contact details or
uploads, and keeps submission disabled when JavaScript is unavailable. The
interface discloses this limitation before data entry and after validation.
