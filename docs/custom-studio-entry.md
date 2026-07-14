# Custom-first studio entry contract

The configurator has two explicit lifecycle states.

1. `presentation`: a new visitor has no accepted physical design. The welcome and its engine-derived SVG scaffold may present capabilities, but they do not create canonical configuration state, geometry, BOM, price, saved ID, AR state, or a WebGL canvas.
2. `accepted`: a valid saved design, share configuration, explicit `?preset=`, custom-space commit, or selected idea owns one synchronized configuration, layout, BOM, pricing result, and persistent Three.js viewer.

The explicit source priority is shared configuration, requested preset, saved accepted snapshot, then new-visitor welcome. An invalid source never falls through to a finished default product.

Marketing start/design calls to action use `?start=welcome` to express a new design journey. That explicit journey displays the welcome even when the browser contains a saved accepted snapshot, preserves that saved snapshot, and consumes the temporary query flag after entry. Plain `configurator.html` links labeled Design Your Bookcase continue saved work when an accepted snapshot exists; valid shared configurations and explicit presets retain priority over the welcome request.

## Guided label mapping

Stable internal IDs remain in place to avoid saved-preference and control-registry migration risk. Customer-facing order is:

| Visible step | Internal ID | Primary responsibility |
| --- | --- | --- |
| Space | `dimensions` | wall width, available height, depth |
| Structure | `layout` | section count and section geometry |
| Storage | `storage` | shelf count, cabinets, fronts, per-section storage types |
| Construction | `construction` | shelf thickness, base, crown/top |
| Appearance | `appearance` | finish, hardware, lighting |
| Review | `review` | physical summary and project service |

## Custom start

The custom-space route validates width, height, and depth without silently clamping. “I’m not sure yet” uses a clearly labeled 96 × 96 × 15 inch provisional boundary. The first accepted custom configuration is a neutral `classic` structure with equal-width open sections, two shelves per section, no lower cabinets, no lighting, a slim cap, a recessed toe kick, and White Dove. Pricing is evaluated only as part of that first accepted transaction.

## Inspiration library

The library exposes the ten configurations currently supported by the production engine. Six appear initially, with a progressive “View all 10 editable ideas” action and All, Library, Storage, Media, Work, and Feature filters. The UI intentionally does not claim twenty ideas: no placeholder or non-engine-backed configuration is advertised.

Each idea supplies `{id, name, description, category, tags, fullyEditable, config}`. Media, desk, and fireplace ideas are labeled with feature constraints because their structural opening zones remain protected by the Section Designer. The “Fully editable” badge is reserved for ideas without those zones.

## Presentation preview and disposal

The intro scaffold uses the same descriptor generator as accepted product thumbnails, projected into presentation-only SVG. It cycles among Open Shelves, Display Wall, and Tall Storage + Shelves only when reduced motion is not requested. Any manual preview or route interaction stops the cycle. The interval and presentation helper are disposed before the physical viewer is created and on lifecycle reset.

## Action and persistence boundary

Before acceptance, Save, Quote, Review, and AR controls are absent or disabled, and the estimate reads “Your estimate will appear as you build.” The diagnostic contract reports `acceptedDesign=false`, configuration and pricing as `null`, and zero canvas, pricing, update, save, and quote counts. Start over removes the stored accepted snapshot, destroys the viewer and AR controller, clears all accepted artifacts, and returns to the two-route welcome.

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
