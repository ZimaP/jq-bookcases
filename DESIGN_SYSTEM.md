# JQ Bookcases Website Design System

`styles.css` is the canonical source for all design tokens and shared primitives. `visual-consistency.css` is the final route-normalization layer: it consumes those tokens and reconciles legacy page compositions without defining another visual language. Page-specific stylesheets may control composition, imagery, and specialized diagrams only.

## Brand direction

The site uses a premium, residential millwork vocabulary: warm charcoal and taupe backgrounds, ivory text, restrained brass accents, soft architectural borders, and editorial serif headings. The visual hierarchy should feel calm and considered rather than ornamental or app-like.

Official product and action names:

- Brand: **JQ Bookcases**
- Product: **3D Bookcase Configurator**
- Primary design action: **Design Your Bookcase**
- Quote action/page: **Request a Quote**
- Submitted form: **quote request**
- Follow-up stage: **project review**

## Color roles

Use semantic roles, never page-specific brand hex values.

| Role | Token | Use |
| --- | --- | --- |
| Page background | `--color-bg` | Primary warm-taupe canvas |
| Deep background | `--color-bg-deep` | Header, footer, high-contrast panels |
| Soft background | `--color-bg-soft` | Tonal bands and selected regions |
| Surface | `--color-surface` | Cards and substantial panels |
| Raised surface | `--color-surface-raised` | Nested or emphasized cards |
| Soft surface | `--color-surface-soft` | Subtle groupings and quiet controls |
| Primary text | `--color-text` | Headings and high-priority copy |
| Soft text | `--color-text-soft` | Body copy |
| Muted text | `--color-text-muted` | Metadata and helper text |
| Accent | `--color-accent` | Brass icons, counters, and small emphasis |
| Strong accent | `--color-accent-strong` | Kicker text and active emphasis |
| Accent depth | `--color-accent-deep` | Dark brass gradient stops |
| Border | `--color-border` | Default separators and card outlines |
| Strong border | `--color-border-strong` | Hover, selection, and featured outlines |
| Focus | `--focus-ring` | All keyboard focus indicators |

The brass accent is not a general text color. Reserve it for small labels, icons, selection states, and primary-action borders so it retains meaning.

## Typography

Headings use `--serif`; body copy, labels, controls, and navigation use `--sans`. Do not introduce a route-specific font family or type scale.

| Role | Token | Intended range |
| --- | --- | --- |
| Display / marketing hero | `--type-display` | 42–56px desktop; 32–40px mobile |
| Page title | `--type-page-title` | 36–48px desktop; 28–36px mobile |
| Section heading | `--type-section-title` | 28–36px desktop; 24–30px mobile |
| Subheading | `--type-subheading` | 20–26px |
| Card title | `--type-card-title` | 18–22px |
| Body | `--type-body` | 16px |
| Lead | `--type-lead` | 16–18px |
| Button | `--type-button` | 15px |
| Label | `--type-label` | 14px |
| Caption | `--type-caption` | 13px |
| Small/helper | `--type-small` | 12px minimum |

Use `--leading-heading` for headings, `--leading-body` for reading copy, and `--leading-ui` for compact controls. Body copy should not exceed `--measure-reading` (approximately 68 characters). Headings should generally remain within `--measure-heading`.

## Spacing and geometry

The base spacing scale is `4, 8, 12, 16, 24, 32, 48, 64, 96px`, exposed as `--space-1` through `--space-9`.

Use the semantic layout roles where available:

- `--gutter`: responsive page gutter
- `--section-space`: standard section padding
- `--section-space-compact`: compact hero or related-section padding
- `--card-padding`: card/panel interior spacing
- `--field-gap`: form-grid gap
- `--control-height`: normal control height, 46px
- `--touch-target`: minimum interactive target, 44px

Radius roles are `--radius-control` for controls, `--radius-card` for normal cards, `--radius-large` for prominent media/panels, and `--radius-pill` for filters and status chips. Use `--shadow-soft`, `--shadow-card`, and `--shadow-float` only to express real elevation.

## Layout system

- `.container` supplies the shared `--content-max` width and responsive gutters.
- `.narrow` or `.container.narrow` constrains reading-heavy content.
- `.site-section` is the standard marketing section.
- `.interior-section` is the standard internal-page section.
- `.section-tone` adds a quiet tonal band without changing the token palette.
- `.section-heading` provides consistent kicker, title, lead, and trailing-space behavior.
- Desktop grids normally use two or three columns; tablet moves to two or one; mobile uses one.

Avoid fixed page heights for text-bearing sections. Fixed dimensions are acceptable for hero imagery, 3D viewports, thumbnails, and diagrams when responsive fallbacks exist.

## Components

### Header and navigation

All routes use the header injected by `site.js`. The logo, navigation order, current-page state, Save Design action, Request Quote action, mobile menu, header height, and focus treatment must remain shared. The homepage may use a transparent-over-image header; other routes use the standard surface.

### Buttons and links

- `.button.button-primary`: principal action for the current section.
- `.button.button-secondary`: lower-emphasis bordered action.
- `.button-link` or `.text-link`: contextual navigation, not a competing CTA.
- Page-specific CTA classes must visually resolve to these same roles through `visual-consistency.css`.

Keep one primary action per compact decision area. Button labels use sentence/title wording already established by the product vocabulary; avoid all caps.

### Surfaces and cards

Use `.glass-panel`, `.panel`, or `.surface` for shared card treatment. Cards need a border, enough padding for the type role, and predictable heading/body spacing. Do not shrink body copy to force content into a fixed reference-art height.

### Forms

Labels remain visible above controls. Inputs, selects, and textareas share `--control-height`, `--radius-control`, `--color-border`, and `--color-control`. Placeholder text is supplementary, never a replacement for a label. Validation and status messages use a bordered surface and remain connected to the field/action that produced them.

### FAQ

The FAQ uses a compact internal hero, search, topic filters, result feedback, one shared accordion, and a support CTA. Search matches both question and answer text. Category buttons use `aria-pressed`; filtering never removes answer copy from the document. The accordion remains single-open and keyboard-native.

### Footer

All marketing and policy routes use the same footer injected by `site.js`, including the same Explore, Plan Your Project, project CTA, assurance, copyright, privacy, and terms structure. The configurator intentionally omits the footer while its full-page application shell is active.

## Route templates

The current customer-facing route inventory is:

- Homepage: `index.html`
- Process: `how-it-works.html`
- Materials: `materials.html`
- Inspiration: `inspiration.html`
- About: `about.html`
- FAQ: `faq.html`
- Quote/contact flow: `request-quote.html`
- 3D application: `configurator.html`
- Policies: `privacy.html`, `terms.html`

There are no login, registration, password-reset, dashboard/account, standalone contact, or dedicated 404 routes in this static site. Do not create or imply those flows unless product scope changes.

## Configurator exception

The 3D Bookcase Configurator is intentionally denser and full-screen on desktop. It may use specialized panel sizing, sticky action areas, canvas controls, and compact diagram labels, but it inherits the same brand lockup, semantic color roles, focus ring, accessible target sizes, heading/body roles, and responsive readability. Visual-system work must not replace or duplicate its renderer, physical state, pricing, save, quote, or Benjamin Moore data flow.

## Responsive and accessibility contract

- No horizontal page scrolling at 320 CSS pixels.
- Body copy remains 16px on mobile; visible helper text remains at least 12px.
- Every route has exactly one H1 with a logical heading hierarchy below it.
- Custom controls have a visible `:focus-visible` state.
- Buttons and links have at least a 44px interactive target where they act as controls.
- Content remains usable at a 200%-zoom-equivalent viewport.
- Meaning is never conveyed only by color.
- Images retain useful `alt` text; decorative line art is hidden from assistive technology.
- Motion honors the existing reduced-motion rules.

## Implementation checklist

Before adding or changing a page:

1. Load `styles.css`, then any composition stylesheet, then `visual-consistency.css` last.
2. Use the shared header and footer hosts.
3. Map every text element to a documented type role.
4. Use semantic tokens for every branded color, radius, surface, and shadow.
5. Use the shared button, form, card, and section behaviors.
6. Check 1440px, 1024px, 768px, 390px, and 320px widths.
7. Check keyboard navigation, visible focus, heading order, overflow, console output, and all customer actions.

