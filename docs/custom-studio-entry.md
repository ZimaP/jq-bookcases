# Single-page studio entry contract

The configurator has two explicit lifecycle states.

1. `presentation`: a new visitor has no accepted physical design. The welcome and its engine-derived SVG scaffold may present capabilities, but they do not create canonical configuration state, geometry, BOM, price, saved ID, AR state, or a WebGL canvas.
2. `accepted`: a valid saved design, share configuration, explicit `?preset=`, or one-click Start Building Your Bookcase commit owns one synchronized configuration, layout, BOM, pricing result, and persistent Three.js viewer.

The explicit source priority is a valid shared configuration, a valid requested
preset, an explicit new-design welcome request, then a valid saved accepted
snapshot. An invalid source never falls through to a finished default product.

Every accepted entry has one of two explicit intents:

- `new`: valid shared configurations, explicit presets, and the Start Building Your Bookcase
  commit enter the same reference workspace at Layout / General.
  `?start=welcome` remains presentation-only until the entry action is activated
  and the neutral framework is accepted. Obsolete mode and step preferences are
  ignored. Active stage/tab,
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
owns Add, selection, Duplicate, Delete, and clear-width cards presented at most
two decimal places; exact canonical widths remain in accepted state and engine
math. Its total-width card stays synchronized with the accepted configuration.
Descriptor-backed model selection and organizer selection route into the same
Properties panel and accepted transaction. No second anchored or floating
editor is mounted. Stage, tab, selection, organizer menus, tools, display
helpers, fullscreen, scroll, and history are presentation-only.

## Single-page start

The welcome exposes one Start Building Your Bookcase button. It has no custom-dimensions
subview, alternate starting route, or editable-idea library. Activating the
button creates and accepts one neutral 96 × 96 × 15 inch `classic` framework
with four equal-width open sections, two shelves per section, no lower
cabinets, no lighting, a slim cap, a recessed toe kick, and White Dove. The
accepted design opens at Layout / General. Space owns width, height, and depth;
Layout and its organizer own section count and width editing; Storage owns
section types and interiors; Base & Top owns the construction profiles.
Pricing is evaluated only as part of this first accepted transaction.

Supported explicit `?preset=` links remain valid new-design sources. They
bypass the welcome as described above; they are not exposed as a library or
alternate route on the studio entry surface.

## Presentation preview and disposal

The intro scaffold uses the same descriptor generator as accepted product
thumbnails. It presents three buildable arrangements—Open framework, Mixed
storage, and Tall zones—in the same preview card. Their SVG, dimensions,
section count, caption, and two arrangement-specific action callouts stay
synchronized. Open framework presents Add shelves and Resize sections; Mixed
storage presents Add drawers and Add doors; Tall zones presents Add tall doors
and Mix storage. The callouts occupy the preview's clear side rails on roomy
layouts and its open top gutter at constrained widths, so they never cover the
bookcase drawing. The presentation advances every
3.6 seconds when motion is allowed; choosing an arrangement stops the rotation
for that visit, and reduced-motion preferences disable automatic movement.
These controls change presentation only: they never create configuration,
pricing, geometry, or a canvas, and they never change the neutral design
created by Start Building Your Bookcase. No carousel dots are rendered. The
timer is disposed before the physical viewer is created, on reset, and when the
configurator is destroyed.

## Action and persistence boundary

Before acceptance, Save, Quote, Review, and AR controls are absent or disabled,
and the estimate reads “Your project estimate will appear as you build.” After
acceptance, Review launches from Preview, Save and Quote remain shared footer/
header delegates, and AR is the rail card. The diagnostic contract reports
`acceptedDesign=false`, configuration and pricing as `null`, and zero canvas,
pricing, update, save, and quote counts. Start over removes the stored accepted
snapshot, destroys the viewer and AR controller, clears all accepted artifacts,
and returns to the single-page welcome with Start Building Your Bookcase as its sole entry
action.

## Privacy-conscious measurement events

The host dispatches bubbling `jq:studio` custom events with a stable `name` and
non-sensitive metadata. Exact wall dimensions and personal data are not
included. Activating the sole entry CTA emits `studio_build_started` before the
neutral design is accepted; it replaces route, dimension, and idea-library
events. Current names are:

- `studio_welcome_viewed`
- `studio_entry_bypassed`
- `studio_build_started`
- `studio_design_accepted`
- `studio_start_over`

The preview selector also emits `studio_intro_preview_changed` with only its
zero-based presentation index. The in-memory diagnostics copy exists for
automated verification only; no external analytics backend is introduced.
