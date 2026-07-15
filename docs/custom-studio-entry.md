# Custom-first studio entry contract

The configurator has two explicit lifecycle states.

1. `presentation`: a new visitor has no accepted physical design. The welcome and its engine-derived SVG scaffold may present capabilities, but they do not create canonical configuration state, geometry, BOM, price, saved ID, AR state, or a WebGL canvas.
2. `accepted`: a valid saved design, share configuration, explicit `?preset=`, custom-space commit, or selected idea owns one synchronized configuration, layout, BOM, pricing result, and persistent Three.js viewer.

The explicit source priority is a valid shared configuration, a valid requested
preset, an explicit new-design welcome request, then a valid saved accepted
snapshot. An invalid source never falls through to a finished default product.

Every accepted entry has one of two explicit intents:

- `new`: valid shared configurations, explicit presets, My Space commits, and
  selected ideas enter the same reference workspace at Layout / General.
  `?start=welcome` remains presentation-only until My Space or an idea is
  accepted. Obsolete mode and step preferences are ignored. Active stage/tab,
  Properties and organizer scroll, selection, Select/Pan tool, Dimensions/Wall
  display, fullscreen, and global history start fresh.
- `resume`: a valid browser-local accepted snapshot restores its sanitized
  physical configuration in that same reference workspace. Presentation state
  is never restored: Layout / General, Select, Dimensions and Wall on,
  fullscreen off, empty global history, and cleared selection are the defaults.
  Bare
  `configurator.html` and `?start=resume` both use this path when the snapshot
  verifies; the explicit resume parameter is consumed after startup.

Marketing start/design calls to action use `?start=welcome` to express a new
design journey. That request displays the welcome even when the browser
contains a saved accepted snapshot, preserves that snapshot, and consumes the
temporary query flag after entry. Plain links labeled Design Your Bookcase
continue valid saved work. Valid shared configurations and explicit presets
retain priority over either temporary start parameter.

## Reference workspace

Accepted designs expose one non-linear seven-stage rail around one persistent
model and one fixed contextual Properties inspector. Every stage is always
directly reachable; stages organize the nine canonical control groups but do
not gate progress:

| Stage | Canonical controls |
| --- | --- |
| Space | Overall Size |
| Layout | Sections & Layout; Base & Crown |
| Storage | Shelves; Storage & Fronts |
| Finish | Finish |
| Hardware | Hardware |
| Lighting | Lighting |
| Preview | Project Service and Review |

The model toolbar owns global Undo/Redo, Dimensions/Wall visibility, mutually
exclusive Select/Pan tools, and fullscreen. A persistent section organizer
owns Add, selection, Duplicate, Delete, and exact clear-width cards; its total-
width card stays synchronized with the accepted configuration. Descriptor-
backed model selection and organizer selection route into the same Properties
panel and accepted transaction. No second anchored or floating editor is
mounted. Stage, tab, selection, organizer menus, tools, display helpers,
fullscreen, scroll, and history are presentation-only.

## Custom start

The custom-space route validates width, height, and depth without silently
clamping. “I’m not sure yet” uses a clearly labeled 96 × 96 × 15 inch
provisional boundary. The first accepted custom configuration is a neutral
`classic` structure with equal-width open sections, two shelves per section,
no lower cabinets, no lighting, a slim cap, a recessed toe kick, and White
Dove. My Space enters Layout / General after the dimensions are accepted.
Space owns overall width, height, and depth; Layout and its organizer own
section count, section editing, base, and crown. Choosing a section count
explicitly regenerates equal clear widths for that count.
Pricing is evaluated only as part of that first accepted transaction.

## Inspiration library

The library exposes the ten configurations currently supported by the production engine. Six appear initially, with a progressive “View all 10 editable ideas” action and All, Library, Storage, Media, Work, and Feature filters. The UI intentionally does not claim twenty ideas: no placeholder or non-engine-backed configuration is advertised.

Each idea supplies `{id, name, description, category, tags, fullyEditable, config}`. Media, desk, and fireplace ideas are labeled with feature constraints because their structural opening zones remain protected in the Layout stage and section organizer. The “Fully editable” badge is reserved for ideas without those zones.

## Presentation preview and disposal

The intro scaffold uses the same descriptor generator as accepted product thumbnails, projected into presentation-only SVG. It cycles among Open Shelves, Display Wall, and Tall Storage + Shelves only when reduced motion is not requested. Any manual preview or route interaction stops the cycle. The interval and presentation helper are disposed before the physical viewer is created and on lifecycle reset.

## Action and persistence boundary

Before acceptance, Save, Quote, Review, and AR controls are absent or disabled,
and the estimate reads “Your estimate will appear as you build.” After
acceptance, Review launches from Preview, Save and Quote remain shared footer/
header delegates, and AR is the rail card. The diagnostic contract reports
`acceptedDesign=false`, configuration and pricing as `null`, and zero canvas,
pricing, update, save, and quote counts. Start over removes the stored accepted
snapshot, destroys the viewer and AR controller, clears all accepted artifacts,
and returns to the two-route welcome.

## Privacy-conscious measurement events

The host dispatches bubbling `jq:studio` custom events with a stable `name` and non-sensitive metadata. Exact wall dimensions and personal data are not included. Current names are:

- `studio_welcome_viewed`
- `studio_entry_bypassed`
- `studio_custom_route_opened`
- `studio_ideas_opened`
- `studio_provisional_dimensions_used`
- `studio_custom_dimensions_accepted`
- `studio_ideas_filtered`
- `studio_ideas_expanded`
- `studio_idea_selected`
- `studio_intro_preview_changed`
- `studio_design_accepted`
- `studio_start_over`

The in-memory diagnostics copy exists for automated verification only; no external analytics backend is introduced.
