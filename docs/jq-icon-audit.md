# JQ Bookcases icon audit

Audit date: 2026-07-13
Reference use: visual weight and architectural character only; no reference pixels, raster traces, crops, or paths were used.
Baseline: `npm run build` passed; `npm test` passed 180/180 before the icon migration.

## Repository inventory

The site is a static, framework-free ES-module application. `site.js` owns the shared header, footer, FAQ interaction, and static icon mounting. `configurator-3d.js` owns generated configurator controls. The original shared SVG fragment registry was `icon-system.js`.

Icon-source inspection covered every root HTML, JavaScript, and CSS file plus `assets/`:

- Inline semantic SVG: centralized in `icon-system.js`; no production HTML contained duplicated full inline semantic SVG markup.
- Generated product SVG: one dynamic mini-bookcase drawing in `configurator-3d.js`; retained as a product thumbnail, not an icon.
- External SVG: `assets/favicon.svg`; retained as the JQ brand favicon, not a UI icon.
- Raster icons: none. Product and inspiration JPG/PNG files are photography/content, not icon assets.
- CSS background icons or encoded SVG: none.
- Pseudo-elements: structural separators, switches, measurement drawings, and a currency prefix; none load icon artwork.
- Icon fonts: none.
- Third-party icon components or libraries: none.
- Base64 or embedded raster data: none.
- Character controls: raw close/expand/collapse glyphs existed in generated configurator and AR dialogs; replaced with registry SVGs.

## Usage audit and decisions

“Current source” records the source found before implementation. Repeated utility uses are consolidated only where the label, meaning, problem, and final action are identical.

| Page or component | Visible label | Current icon source | Current meaning | Problem identified | Proposed JQ icon | Final action |
|---|---|---|---|---|---|---|
| Shared header | Save Design | `heart` | Favorite/love | A heart communicates favorite, not persistence; same control appears as link and button | `save` | Replace |
| Shared header | Mobile menu | `menu` | Open navigation | Geometry acceptable but old 1.5 stroke diverged from brief | `menu` | Replace geometry/rules |
| Shared header | Close mobile menu | `close` | Close navigation | Geometry acceptable; normalize stroke and footprint | `close` | Replace geometry/rules |
| All breadcrumbs | Current page separator | `chevron-right` | Hierarchy separator | Utility icon was visually heavier on some pages due CSS overrides | `chevron-right` | Replace geometry/rules |
| Shared footer | Open the 3D Configurator | `configurator-3d` | 3D configuration | Page-derived name and cube duplicated the 3D control concept | `camera-orbit` | Replace |
| Shared footer | Standard Delivery | `delivery-standard` | Standard truck delivery | Old truck included side marks that read as speed/priority | `standard-delivery` | Replace |
| Shared footer | Professional Installation | `installation-professional` | Professional install | Old building/wrench combination was dense at 16–20 px | `professional-installation` | Replace |
| Shared footer | Warranty Lifetime | `warranty` | Warranty coverage | Semantically correct; normalize construction | `warranty` | Replace geometry/rules |
| Shared/footer links | Continue/open | `arrow-right` | Directional continuation | Several page CSS rules changed its optical size | `arrow-right` | Replace geometry/rules |
| Shared footer | Instagram | `instagram` | Platform link | Retain as a platform mark but normalize stroke with the family | `instagram` | Replace geometry/rules |
| Shared footer | Pinterest | `pinterest` | Platform link | Retain as a platform mark but normalize stroke with the family | `pinterest` | Replace geometry/rules |
| Shared footer | Houzz | `houzz` | Platform link | Retain as a platform mark but normalize stroke with the family | `houzz` | Replace geometry/rules |
| Home hero | Five-star rating | `star` repeated five times | Customer review rating | Page-specific name; old star footprint was larger than adjacent review text | `reviews` | Replace |
| Home benefits | Custom Made | `craftsmanship` | Custom cabinetmaking | Semantically accurate; geometry needed optical cleanup | `craftsmanship` | Replace geometry/rules |
| Home benefits | Premium Materials | `materials` | Layered construction | Generic plural name and layers too tightly stacked at small sizes | `material-layers` | Replace |
| Home benefits | White-Glove Delivery | `delivery-white-glove` | Careful delivery | Old icon combined a package with one malformed hand; detail collapsed at 20 px | `white-glove-delivery` | Replace |
| Home benefits | Professional Installation | `installation-professional` | Professional install | Dense building/wrench cue; inconsistent with delivery family | `professional-installation` | Replace |
| Home feature card | Ten proven layouts | `layouts` | Layout selection | Noncanonical plural name; dot details were too small | `layout` | Replace |
| Home feature card | Materials that work together | `materials` | Construction materials | Same generic source used in trust strip and configurator | `material-layers` | Replace |
| Home feature card | Transparent planning | `transparent-pricing` | Estimate document | Page-specific name; concept is pricing, not transparency artwork | `pricing` | Replace |
| Home checklist | Checklist items | `check` | Confirmation | Correct utility meaning | `check` | Replace geometry/rules |
| Home inspiration cards | Project title links | `arrow-right` | Open project/configurator | Photography is primary; no room icon needed | `arrow-right` | Retain as utility only |
| How It Works, step 1 | Choose your bookcase style | `layouts` | Layout selection | Noncanonical plural name | `layout` | Replace |
| How It Works, step 1 selected card | Selected | `check` | Selected state | Correct and redundant spoken label avoided with `aria-hidden` child | `check` | Replace geometry/rules |
| How It Works, step 2 | Enter your dimensions | `ruler` | Measurement | Generic ruler did not communicate overall dimensions as clearly as the category icon | `dimensions` | Replace |
| How It Works, illustrative steppers | Decrease/increase | `minus`, `plus` | Stepper direction | Correct utility concepts; illustrative, noninteractive | `minus`, `plus` | Replace geometry/rules |
| How It Works, step 3 | Select finish and options | `finish-options` | Overlapping finish choices | Three circles looked like a color picker and lacked cabinetry character | `paint-finish` | Replace |
| How It Works, step 3 | Paint choices | CSS color circles | Finish comparison | Correct decision hierarchy | Color swatches | Use swatch |
| How It Works, step 3 | Hardware and door samples | CSS product samples | Physical product form | Correct decision hierarchy | Profile/thumbnail | Use thumbnail |
| How It Works, step 4 | See instant pricing | `price-tag` | Price | Correct core idea but noncanonical name | `pricing` | Replace |
| How It Works, step 5 | Confirm measurements and schedule | `schedule-install` | Calendar plus check | Combined cue hid the field-visit requirement | `measurement-visit` | Replace |
| How It Works flow | Measure & Confirm | `ruler` | Field measurement | Generic tool lacked home/visit context | `measurement-visit` | Replace |
| How It Works flow | Build with Care | `shop-build` | Shop fabrication | Old geometry resembled a bench machine and was too detailed | `craftsmanship` | Replace |
| How It Works flow | Professional Installation | `installation-professional` | Professional install | Dense/undersized | `professional-installation` | Replace |
| How It Works benefits | Custom Quality | `medal` | Quality | Old medal had a tiny decorative star and heavy overlap | `quality` | Replace |
| How It Works benefits | Fit for Your Space | `dimensions` | Exact fit | Correct meaning; normalize geometry | `dimensions` | Replace geometry/rules |
| How It Works benefits | Transparent Pricing | `price-tag` | Pricing | Rename to stable semantic concept | `pricing` | Replace |
| How It Works benefits | Professional Installation | `installation-professional` | Professional install | Dense/undersized | `professional-installation` | Replace |
| How It Works support | Have questions? | `headset` | Support | Page-specific/physical name | `support` | Replace |
| Materials | Paint-grade plywood | `plywood` | Layered plywood | Grain detail was too dense below 24 px | `material-layers` | Replace; photography stays primary |
| Materials | Benjamin Moore paint finishes | `paint-finish` | Paint finish | Correct category; normalize geometry | `paint-finish` | Replace geometry/rules |
| Materials | Cabinet door styles | `cabinet-door` | One door profile | Rename to customer-facing category | `door-style` | Replace; photography stays primary |
| Materials | Durable hardware | `hardware` | Mixed hardware | Old ellipses overlapped into dark blobs and did not read as a knob/pull | `hardware-knob` | Replace; photography stays primary |
| Materials | Adjustable shelving | `adjustable-shelves` | Adjustable shelves | Excess tiny shelf-pin dots made the icon noisy at 16 px | `shelves` | Replace |
| Materials | Integrated lighting | `lighting` | Cabinet lighting | Correct meaning; normalize geometry | `lighting` | Replace geometry/rules |
| Materials | Professional finishing | `professional-finishing` | Spray/finish service | Truck-like silhouette was semantically unclear | `craftsmanship` | Replace |
| Materials benefit | Low-VOC finishes | `low-voc` | Sustainable finish | Page-specific name; leaf shape had an uneven curve | `sustainability` | Replace |
| Materials benefit | Built to last | `warranty` | Durability | Warranty was incorrectly reused for quality/durability | `quality` | Replace |
| Materials benefit | Shop-built craftsmanship | `shop-build` | Fabrication | Over-detailed and smaller than neighboring icons | `craftsmanship` | Replace |
| Materials benefit | Made for professional installation | `installation-professional` | Professional install | Dense/undersized | `professional-installation` | Replace |
| Inspiration gallery | Six project cards | Photography + `arrow-right` | Physical room/project comparison | Correct hierarchy; room icons would add clutter over photography | `arrow-right` only | Retain photography; no room icons |
| Inspiration CTA | Start custom design | `design-plan` | Plan/configuration | Page-specific name; document/pencil was too detailed | `layout` | Replace |
| Inspiration benefits | Premium Materials | `materials` | Material quality | Generic plural name | `material-layers` | Replace |
| Inspiration benefits | Custom to Your Space | `dimensions` | Exact fit | Correct meaning | `dimensions` | Replace geometry/rules |
| Inspiration benefits | Transparent Pricing | `price-tag` | Pricing | Noncanonical | `pricing` | Replace |
| Inspiration benefits | Expert Installation | `installation-professional` | Professional install | Dense/undersized | `professional-installation` | Replace |
| About values | Proudly Made in USA | `made-in-usa` | US manufacturing | Flag detail sat inside a circle and became too dense | `made-in-usa` | Replace geometry |
| About values | Local Team, Local Service | `local-service` | Local service | Generic location pin omitted service assurance | `local-service` | Replace geometry |
| About values | Custom-quality craftsmanship | `craftsmanship` | Craftsmanship | Correct meaning | `craftsmanship` | Replace geometry/rules |
| About values | Transparent Pricing | `price-tag` | Pricing | Noncanonical | `pricing` | Replace |
| About values | Professional Installation | `installation-professional` | Professional install | Dense/undersized | `professional-installation` | Replace |
| About values | Designed Around You | `client-centered` | Customer-centered design | Many small arrows/segments made a busy, AI-like silhouette | `project-coordination` | Replace |
| About process | Choose Your Style | `layouts` | Layout choice | Noncanonical plural name | `layout` | Replace |
| About process | Enter Your Dimensions | `dimensions` | Dimensions | Correct meaning | `dimensions` | Replace geometry/rules |
| About process | See Instant Pricing | `transparent-pricing` | Pricing | Page-specific name | `pricing` | Replace |
| About process | We Build It | `shop-build` | Fabrication | Over-detailed/unclear silhouette | `craftsmanship` | Replace |
| About process | We Install It | `installation-professional` | Professional install | Dense/undersized | `professional-installation` | Replace |
| FAQ search | Search questions | `search` | Search | Correct functional utility icon | `search` | Replace geometry/rules |
| FAQ accordions | Expand/collapse | `plus`, `minus` | Accordion state | Correct functional-only use; old page started all hosts as plus then corrected them in JS | `plus`, `minus` | Replace geometry/rules and preserve state sync |
| FAQ support | Still have questions? | `support-faq` | Help | Chat bubble/question became hard to read at small size | `help-center` | Replace |
| Quote form | Project Information | `project-information` | Customer/project details | Decorative folder/person icon did not improve comprehension | none | Text-only |
| Quote form | Project Details | `field-measurement` | Site measurements/details | Geometry mixed two measuring directions and was visually unbalanced | `measurement-visit` | Replace |
| Quote form | Paint Finish | `paint-finish` | Finish selection | Correct meaning | `paint-finish` | Replace geometry/rules |
| Quote form | Options | `hardware` | Mixed product options | Hardware icon mislabeled a fieldset that also includes lighting/service options | none | Text-only |
| Quote form | Timeline / Notes | `timeline-notes` | Schedule and notes | Excess list dots and lines were too detailed | `schedule` | Replace |
| Quote form | Project photos | `project-photos` | Photo upload | Duplicated gallery concept under a page-specific name | `inspiration` | Replace |
| Quote form | What happens next | `quote-review` | Quote review | Clipboard checklist diverged from the estimate-document language | `quote` | Replace |
| Configurator categories | Layout | `layouts` | Layout category | Noncanonical plural name | `layout` | Replace |
| Configurator categories | Dimensions | `dimensions` | Size category | Correct meaning | `dimensions` | Replace geometry/rules |
| Configurator categories | Structure | `materials` | Construction category | Generic plural name | `material-layers` | Replace |
| Configurator categories | Finish | `paint-finish` | Finish category | Correct meaning | `paint-finish` | Replace geometry/rules |
| Configurator categories | Hardware | `hardware` | Knobs and pulls | Old overlapping ellipse construction formed dark blobs | `hardware` | Replace with combined knob/pull category icon |
| Configurator categories | Lighting | `lighting` | Lighting category | Correct meaning | `lighting` | Replace geometry/rules |
| Configurator layout cards | Ten layout presets | Generated inline mini-bookcase SVG | Physical layout comparison | Correct hierarchy; this is a product drawing, not an icon | Generated product thumbnail | Use thumbnail |
| Configurator door cards | Shaker, Flat, Slim Shaker, Glass | Four 64 × 36 diagrams | Door profile comparison | Correct hierarchy; old names retained page styling but drawings needed registry documentation | Door profile drawings | Use thumbnail |
| Configurator crown cards | Flat, Step, Classic, Built-up | Four 64 × 36 diagrams | Crown profile comparison | Correct hierarchy; old `none/slim/soffit` names were implementation-oriented | Crown profile drawings | Use thumbnail |
| Configurator base cards | Toe kick, Plinth, Furniture base | Three 64 × 36 diagrams | Base profile comparison | Correct hierarchy | Base profile drawings | Use thumbnail |
| Configurator hardware cards | Brass/black knobs and pulls, nickel pull | Five finish-specific duplicated diagrams | Physical shape plus metal finish | Three pull diagrams and two knob diagrams had identical geometry without a visible finish cue | Knob/pull profile + metal swatch | Use thumbnail and swatch |
| Configurator finish cards | Benjamin Moore finishes | CSS swatch and label | Paint color comparison | Correct hierarchy; accessible text remains visible | Finish swatch | Use swatch |
| Configurator lighting warmth | 2700K, 3000K, 3500K | Labeled controls | Color temperature | Correct hierarchy; avoids three near-identical sun icons | Labeled temperature control | Text/labeled control |
| Configurator lighting | No Lights | `lighting-none` | Lighting disabled | Cross treatment resembled an error and lacked canonical name | `lighting-off` | Replace |
| Configurator lighting | Top Puck Lights | `lighting-pucks` | Puck lighting | Uneven tiny rays; plural implementation name | `puck-light` | Replace |
| Configurator lighting | Shelf LED Strips | `lighting-shelf` | Under-shelf lighting | Generic shelf line, visually close to other lighting choices | `under-shelf-light` | Replace |
| Configurator lighting | Side Vertical Lights | `lighting-vertical` | Vertical LED strips | Looked like cabinet sections rather than emitted light | `led-strip` | Replace |
| Configurator lighting | Full Lighting Package | `lighting-package` | Combined lighting scenes/package | Top two tiny marks were fragile at 20 px | `light-scenes` | Replace |
| Configurator delivery | Pickup / Shop Coordination | `pickup-shop` | Storefront pickup | Old implementation merged shop pickup and coordination in one label; icon itself should remain shop-specific | `shop-pickup` | Replace; label remains product data |
| Configurator delivery | Standard Delivery | `delivery-standard` | Standard delivery | Speed-like marks incorrectly implied priority | `standard-delivery` | Replace |
| Configurator delivery | Priority Delivery Review | `delivery-priority` | Priority delivery | Lightning cue felt like power/electricity, not controlled urgency | `priority-delivery` | Replace |
| Configurator installation | No Installation | `installation-diy`; label was “DIY Installation” | Excluded installation service | Critical semantic error: value `no_installation` was shown as DIY and shared the DIY tool concept | `no-installation` | Replace and correct label only; keep option value/logic |
| Configurator installation | Professional Installation | `installation-professional` | Professional install | Dense building/wrench cue | `professional-installation` | Replace |
| Configurator Save Design | Save Design | `bookmark` | Save | Bookmark is not the same action as saving a configured project; header used a heart for the same action | `save` | Replace |
| Configurator preview | Zoom in / Zoom out | `plus`, `minus` | Zoom | Generic math/stepper icons did not communicate magnification | `zoom-in`, `zoom-out` | Replace |
| Configurator preview | Rotate to default view | `reset` | Reset view | Correct utility concept | `reset` | Replace geometry/rules |
| Configurator preview | 3D | `view-3d` | Orbitable 3D view | Cube geometry was reused by AR, obscuring the difference | `camera-orbit` | Replace |
| Configurator preview | Front | `view-front` | Front camera | Implementation name | `camera-front` | Replace |
| Configurator preview | 3/4 | `view-three-quarter` | Three-quarter camera | Implementation name | `camera-three-quarter` | Replace |
| Configurator preview | Side | `view-side` | Side camera | Implementation name | `camera-side` | Replace |
| Configurator preview | View in Your Room | `view-3d` | Augmented reality | Same cube was used for generic 3D and AR | `augmented-reality` | Replace |
| Configurator accordion | Expand/collapse category | raw `+` / `−` characters | Disclosure state | Violated the no-Unicode-symbol rule and bypassed the registry | `plus`, `minus` | Replace |
| Configurator review dialog | Close | raw `×` character | Close dialog | Violated the no-Unicode-symbol rule and differed from navigation close | `close` | Replace |
| AR dialog | Close | raw `×` character | Close room view | Violated the no-Unicode-symbol rule | `close` | Replace |
| Configurator trust row | Premium Materials | `materials` | Material quality | Generic plural name | `material-layers` | Replace |
| Configurator trust row | Expert Craftsmanship | `craftsmanship` | Craftsmanship | Correct meaning | `craftsmanship` | Replace geometry/rules |
| Configurator trust row | Custom Fit | `dimensions` | Exact fit | Correct meaning | `dimensions` | Replace geometry/rules |

## Explicit debt findings

- Unrelated or misleading reuse: `view-3d` served both an orbitable 3D camera and augmented reality; `warranty` served “Built to last”; `installation-diy` served the `no_installation` product value; generic `hardware` labeled a mixed quote fieldset.
- Duplicated physical diagrams: brass/black knobs and brass/black/nickel pulls repeated identical geometry without a finish swatch. They are now intentionally shared by physical shape and paired with a separate metal-finish swatch.
- Inconsistent stroke: the renderer, shared CSS, configurator CSS, and configurator-experience CSS each set 1.5 independently. The reference brief requires a single 1.75 global rule.
- Malformed or low-quality geometry: the old `hardware` ellipses overlapped into dark blobs; white-glove delivery included a fragile one-hand path; `shop-build` and `client-centered` used over-detailed paths; several lighting icons contained sub-pixel-looking isolated marks.
- Missing/fragile lines: old lighting package and small detail dots depended on extremely short path segments that disappeared at 16–20 px.
- Uneven visual size: circular/location icons, dense service icons, and the simple plus/minus utilities did not share an optical footprint despite identical CSS boxes.
- Excess detail: plywood grain, medal star, support bubble details, project-information folder/person, and timeline list marks were too detailed at the smallest supported sizes.
- Decorative clutter removed: Project Information and Options quote legends are now text-only; inspiration photography remains free of room-icon overlays.

## Obsolete source-name mapping

| Old name/source | Final name/action |
|---|---|
| `layouts` | `layout` |
| `configurator-3d`, `view-3d` | `camera-orbit` for 3D; `augmented-reality` for AR |
| `materials`, `plywood` | `material-layers` |
| `transparent-pricing`, `price-tag`, `monitor-pricing` | `pricing` |
| `quote-review` | `quote` |
| `field-measurement`, `ruler` | `measurement-visit` or `dimensions`, according to meaning |
| `shop-build` | `craftsmanship` |
| `inspiration-gallery`, `project-photos` | `inspiration` |
| `support-faq`, `headset` | `help-center` or `support` |
| `cabinet-door` | `door-style` |
| `adjustable-shelves` | `shelves` |
| `low-voc` | `sustainability` |
| `client-centered` | `project-coordination` |
| `delivery-standard` | `standard-delivery` |
| `delivery-priority` | `priority-delivery` |
| `delivery-white-glove` | `white-glove-delivery` |
| `pickup-shop` | `shop-pickup` |
| `installation-diy` on `no_installation` | `no-installation` |
| `installation-professional` | `professional-installation` |
| `professional-finishing` | `craftsmanship` |
| `timeline-notes` | `schedule` |
| `design-plan` | `layout` |
| `finish-options` | `paint-finish` |
| `schedule-install` | `measurement-visit` |
| `medal` | `quality` |
| `heart`, `bookmark` for Save Design | `save` |
| `star` | `reviews` |
| `view-front`, `view-side`, `view-three-quarter` | `camera-front`, `camera-side`, `camera-three-quarter` |
| `lighting-none`, `lighting-pucks`, `lighting-shelf`, `lighting-vertical`, `lighting-package` | `lighting-off`, `puck-light`, `under-shelf-light`, `led-strip`, `light-scenes` |
| raw `×`, `+`, `−` controls | `close`, `plus`, `minus` |

No old standalone UI icon assets existed to delete. The JQ favicon and all product/inspiration photography are intentionally retained.

## Final geometry review — 2026-07-13

- Rebalanced all 100 registry icons against the supplied JQ reference at 16, 20, 24, 32, and 40 px.
- Removed fragile dot-sized marks and unnecessary interior strokes that produced dark blobs below 24 px.
- Redrew configuration, molding, lighting, delivery, installation, trust, room, and camera families with the same architectural line language and optical footprint.
- Preserved unique silhouettes for pickup/shop pickup, standard/priority/white-glove delivery, no/DIY/professional installation, quote/pricing, and warranty/quality/guarantee.
- Increased product-profile contrast on light configurator cards while keeping selected profiles in the established accent state.
- Confirmed the development gallery exposes every icon on light/dark grounds and in default, hover, selected, and disabled states.
