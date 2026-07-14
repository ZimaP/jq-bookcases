# JQ Bookcases Parametric Configurator Architecture

## Purpose

The configurator now has a pure layout and validation layer in
bookcase-layout.js. Its job is to convert customer configuration into a
deterministic graph of component descriptors before any Three.js object is
created.

The important boundary is:

1. Customer configuration describes intent.
2. The layout engine normalizes supported values and calculates construction.
3. The validator checks the complete descriptor graph.
4. `bookcase-billable.js` derives billable quantities from valid physical
   descriptors without consulting UI visibility.
5. `bookcase-pricing.js` applies preserved rates to those quantities.
6. The renderer consumes the same valid physical descriptors.
7. `bookcase-render-contract.js` audits descriptor-to-scene parity before the
   viewer swaps the last valid model.

The renderer must not recalculate section widths, door arrangements, front
mounting, reveals, base construction, shelf positions, hardware drill centers,
profile rail widths, or light positions. Those are layout responsibilities.

## Customer experience architecture

The configurator is a static ES-module application with one
`BookcaseConfigurator` controller and one `BookcaseViewer3D` instance. The
customer can choose Guided Setup or All Controls, but these are presentation
modes over the same physical design.

`BookcaseConfigurator.state` is the single normalized physical configuration.
It contains the schema-backed layout, dimensions, storage, construction,
finish, hardware, lighting, delivery, and installation values. The following
values are presentation state only and never enter a saved design or price:

- active mode;
- active Guided step;
- expanded All Controls category;
- the most recently used Style category when switching presentations;
- incomplete input drafts;
- per-mode scroll position;
- review/focus state and action locks.

`configurator-experience.js` owns the pure workflow contract: six Guided
steps, ten All Controls categories, mode/category mappings, applicability,
validation, summaries, preset reconciliation, saved-record creation, quote
URLs, and action-lock rules. `configurator-3d.js` renders those definitions and
owns the browser event pipeline. `configurator-experience.css` owns the workflow
and control presentation; `configurator-precision.css` owns the persistent
preview, projected measurements, enlarged divider targets, and high-resolution
refinements over the existing shared site tokens.

The accepted-design shell is mounted once in this DOM order:

    Guided step rail
    controls panel (Guided or All Controls)
    persistent preview pane, mode selector, and canvas
    shared estimate, review, save, and quote actions
    shared review dialog and status region

Only the controls panel is rerendered when mode, step, tab, or accordion state
changes. The preview subtree remains outside both mode panels. Switching modes
therefore cannot create a second canvas, renderer, scene, camera, render loop,
price pipeline, or configuration store.

### Mode synchronization

Both presentations call the same field-commit function. A valid physical
change is normalized once, validated once, priced once, and sent once to the
viewer. An identical value is a no-op. Incomplete numeric strings remain in a
shared draft map, are surfaced in the corresponding view, and block only the
actions that require a valid physical design.

The customer-facing Guided order and its All Controls projection are:

| Guided step | Internal step ID | Primary All Controls category | Related categories |
| --- | --- | --- | --- |
| Space | `dimensions` | Space & Dimensions | — |
| Structure | `layout` | Structure & Sections | Foundation Idea |
| Storage | `storage` | Shelves & Cabinets | Fronts |
| Build | `construction` | Construction | — |
| Style | `appearance` | most recently used Finish, Hardware, or Lighting | the other two Style categories |
| Review | `review` | Project Service | shared review dialog |

Switching to All Controls opens the mapped category. Switching back opens the
mapped Guided step while retaining the independently remembered Guided step
when no newer category context exists. The preferred mode, Guided step, and
All Controls category are sanitized local preferences, not product data.

Customized saved designs keep their structural preset ancestry by matching
the normalized `layoutType`. This preserves the correct selected layout card,
summary label, and quote-form layout after a reload without adding a field to
the saved-design schema.

### New-design and resume intent

Studio entry resolves an explicit presentation intent independently from the
physical source. A valid share, explicit preset, My Space commit, or selected
idea is a new-design entry: the controller resets to Guided Setup at Space,
unlocks only Space, moves the controls to the top, and persists the sanitized
mode/step/category preferences while retaining all prefilled physical values.
The customer must use Continue to advance in strict Guided order; prefilled
fields do not silently complete Space.

A verified schema-2/3/4 browser-local accepted snapshot is a resume entry. Both
the bare configurator URL and `?start=resume` restore the sanitized presentation
context, while `?start=welcome` deliberately keeps the customer in the
presentation-only studio without deleting that snapshot. Temporary `start`
parameters are removed from the URL after initialization. Shared configurations
and valid explicit presets retain source priority over those temporary flags.

### Inline Structure editor

Section Designer is a presentation over the same accepted physical state, not
a second model. Guided Setup exposes the complete editor inline in Structure;
All Controls exposes the same editor through Structure & Sections immediately
after Foundation Idea. Storage owns shelving, lower-storage choices, and the
separate door/drawer front profiles, and includes a direct route back to
Structure for per-section width or storage-type edits. The editor's local-only
presentation state consists of the selected section, an uncommitted numeric
width draft, disclosure state for advanced section actions, a bounded 30-entry
undo/redo history, and the camera snapshot used when entering the editor. None
of those values affect design identity, BOM, or price.

The Structure overview is a wrapping grid without nested horizontal scrolling.
Every section card remains visible in the control flow and communicates its
number, exact clear width, generated type, selected state, and locked feature
state. The selected section's exact-width stepper, numeric field, section type,
generated-component summary, warnings, and history actions follow the grid.
Split, merge, and equalize are grouped under the Section actions disclosure;
impossible actions are disabled with an associated explanation.

`bookcase-sections.js` owns the pure, non-mutating section operations:

- convert accepted clear widths to deterministic ratios;
- resize one divider or one section while preserving total clear width;
- split and merge with the 0.75 in divider accounted for exactly;
- equalize, reset, and reconcile global section-count changes;
- apply the editable `open`, `lower_doors`, `drawers`, and `tall_doors` types;
- reconcile the section-aligned `layoutMetadata.sectionDoorLayouts` entries;
- reject minimum-width violations and edits to generated media, desk, or
  fireplace feature zones.

An explicit global section-count selection always starts that count with equal
clear widths, including when the selected count is unchanged but stale ratios
exist. The transition computes the exact available clear total from the overall
width and panel count, allocates equal widths at fixed precision, and assigns
the deterministic remainder to the final bay. Saved and preset
`layoutMetadata.sectionRatios` remain authoritative during ordinary load,
restore, and dimension regeneration until the customer explicitly selects a
section count. Split and merge remain local operations and do not invoke the
global equalizer.

Divider resizing affects only its adjacent pair. An overshoot clamps at the
15 in minimum clear width rather than rejecting the drag, and the returned
`appliedDelta` drives preview and commit. Every accepted width operation is
converted back to the single canonical `layoutMetadata.sectionRatios` array;
there is no second persisted width store. Numeric drafts that cannot produce a
valid accepted configuration still leave the accepted transaction unchanged.

Explicit `layoutMetadata.sectionTypes` remain the physical source of truth once
per-section editing has been used. The global Lower cabinets and Doors/Drawers
controls therefore pass through `applyGlobalStorageSelection()` instead of
writing legacy summary fields that normalization would immediately overwrite.
That helper rewrites only compatible open/lower-storage sections, preserves
protected feature zones, and commits the resulting config through the same
accepted transaction as section-card edits. Guided Storage and All Controls
render the same single Fronts control set from the resulting generated door and
drawer applicability.

Door-capable section cards also expose one physical arrangement choice:
`auto`, `single_hinge_left`, `single_hinge_right`, or `pair`. The layout
engine returns buildability and a concise reason for every choice; the UI only
presents that result. Non-door and protected sections store `null`. Changing a
non-door section into a door section starts at Auto, while split, merge, and
section-count topology changes reset affected door sections to Auto because the
finished leaf widths changed. Invalid manual arrangements are rejected and
cannot replace the accepted transaction.

Every successful operation is sent to `evaluateBookcaseCandidate()`. Layout,
validation, render audit, BOM, price, design fingerprint, review, save, and
quote therefore advance as one accepted transaction. A rejected draft leaves
all accepted artifacts unchanged.

The viewer derives hit targets, selection boxes, divider guides, and dimension
labels from accepted section descriptors. These helpers live in a separate
`nonPhysicalHelper` scene layer outside the descriptor-backed model, so they
cannot enter the renderer audit, BOM, price, or saved component graph. The
dimension overlay projects the real descriptor bounds through the active camera
and positions the individual clear-width row and overall-width row below the
cabinet when the view is legible. It fades and disables direct divider editing
for sufficiently oblique views instead of presenting misleading screen-space
measurements. Narrow five- and six-bay mobile projections switch to a compact
inch-mark label and run a per-segment collision audit while the exact clear
value remains available in the synchronized Structure card and numeric field.

Divider handles remain available on desktop, tablet, and mobile, with enlarged
pointer targets and the exact numeric editor as a non-drag alternative. Their
DOM identity is stable throughout a pointer gesture so pointer capture is not
lost. Pointer drag previews update the overlay and a throttled transient model
without evaluating price; release commits at most one canonical accepted
transaction. Keyboard divider steps are 0.5 in, or 1 in with Shift.
The viewer camera handler ignores interactive overlay descendants, so a
divider Arrow key cannot also rotate the camera. Blank or non-finite exact-width
drafts retain the last accepted transaction and expose connected inline
validation.

### Renderer update lifecycle

The viewer is created once after the persistent shell is mounted. It exposes a
small lifecycle/diagnostic seam and a `destroy()` path, but normal mode and
control navigation never invoke either initialization or destruction.

Physical changes use the smallest safe path currently supported:

- finish and lighting warmth update existing materials/lights in place;
- same-shape hardware finish changes update existing hardware materials;
- camera view, orbit, and zoom never rebuild physical geometry;
- geometry, topology, opening, dimension, or hardware-shape changes regenerate
  the deterministic descriptor model while preserving camera and selected
  view state.

An invalid generated layout never replaces the last valid rendered model.
Lifecycle counters are exposed as inert `data-diagnostic-*` attributes on the
configurator host for browser assertions. No controller is published on
`window`.

### Price, save, review, and quote contracts

There is one accepted engine-evaluation call site and one physical render
update call site. Presentation changes do not invoke either. The accepted
transaction contains the canonical state, descriptor graph, BOM, pricing
breakdown, and layout fingerprint. Guided Review and the All Controls review
dialog are generated by the same review-summary helper.

Both Save Design entry points delegate to one guarded handler. The persisted
record is schema version 4 and stores canonical config plus verified BOM,
pricing, and fingerprint artifacts without serializing render geometry. Both
Request Quote entry points use that same saved record and the existing encoded
`request-quote.html?design=<id>` URL. The quote page resolves customized
structural layouts so its selected layout, dimensions, finish, estimate, and
saved design ID stay aligned.

New saves explicitly persist `constructionProfile: "jq_inset_v1"` and the
section-aligned `layoutMetadata.sectionDoorLayouts`. Generated door descriptors,
not the historical global `doorCount`, are the canonical leaf quantity. One
single leaf contributes one door billable and normally one visible hardware
unit; a pair contributes two of each. Push latch produces no visible handle
descriptor. Existing rates are reused: the construction profile and visual
profile geometry do not invent surcharges or SKUs.

Saved records restored through a known legacy contract and lacking an explicit
construction profile are migrated to `legacy_overlay_v1` before ordinary
normalization. Legacy lower-door sections restore as pairs; legacy tall-door
sections restore their prior balanced single-leaf behavior. Schema-2 and
schema-3 config-only records regenerate through that explicit migration.
Pre-profile schema-4 snapshots pass only through the bounded integrity path:
the saved ID, selection fingerprint, BOM compatibility signature, pricing
version, serialized price breakdown, and total must all verify. The older
drawer-profile fingerprint compatibility remains bounded in the same way.
Migration never trusts serialized geometry or a stored total independently.

Quote prefill is rebuilt from `buildPricingContext()` and carries the internal
construction profile plus a clone of `layoutMetadata`, including door
arrangements. Customer-visible quote fields need not expose the technical
profile name. AR normalization receives the same accepted config and layout,
checks that every generated front agrees with the profile, and sets
`doorLeafCount` from actual generated door descriptors.

## Coordinate and unit system

All layout values use inches.

- X is width, increasing from left to right.
- Y is height, increasing from bottom to top.
- Z is depth, increasing from the front plane toward the back.
- The origin is the bottom-center of the nominal cabinet front plane.
- The carcass occupies non-negative Z.
- New inset door and drawer bodies extend inward in positive Z from their
  finished face.
- Handles project outward in negative Z from their host's finished face.

`getConstructionReferencePlanes(config, rules)` is the only physical reference
plane calculation. It returns:

| Plane | Meaning |
| --- | --- |
| `floorPlaneY` | Finished floor, always 0 |
| `outerLeftPlaneX`, `outerRightPlaneX` | Nominal carcass side planes |
| `outerTopPlaneY` | Nominal overall height |
| `carcassFrontPlaneZ` | Nominal carcass/opening front, always 0 |
| `finishedFrontPlaneZ` | 0 for `jq_inset_v1`; `-doorThickness` for `legacy_overlay_v1` |
| `shelfFrontPlaneZ` | Centralized front-clearance reference for the active construction profile |
| `backInteriorPlaneZ`, `outerBackPlaneZ` | Back-panel interior face and nominal rear face |
| `baseFrontPlaneZ` | Style-specific visible/structural base reference |
| `toeKickPlatePlaneZ` | Back of the three-inch usable toe recess |

The normalized physical config carries one explicit construction profile:

- `jq_inset_v1` is the default for new designs and active presets. A fitted
  front's visible face is at Z=0 and its 0.75-inch body occupies positive Z.
- `legacy_overlay_v1` is an internal restoration profile. Its visible face is
  at Z=-0.75 and its rear face attaches at the opening plane Z=0. It is not a
  customer-selectable style.

Mounting is explicit descriptor metadata (`inset` or `overlay`); no consumer
infers it from the sign of a bound. The root descriptor represents exact
nominal width, height, and depth. Layout metrics separately report
`nominalBounds`, `decorativeBounds`, `finishedFrontPlaneZ`,
`maximumFrontProjection`, `maximumSideOverhang`, and `maximumTopOverhang`.
Only crown descriptors carry deliberate `allowOverhang`; fronts and flush base
parts do not inherit that permission.

Three.js conversion happens once in the renderer at `1 / 12` scene unit per
inch. Layout Z is inverted once around the nominal depth center for the current
camera convention. Do not apply visual width, height, or depth multipliers in
layout code.

## Public API

The main call is:

    const layout = generateBookcaseLayout(config);

The module exports:

- generateBookcaseLayout(config, options)
- normalizeLayoutConfig(config, options)
- validateBookcaseLayout(layout)
- getConstructionReferencePlanes(config, rules)
- getFrontBounds(options)
- resolveDoorArrangement(options)
- getFrontProfileDefinition(style)
- resolveFrontProfileGeometry(face, definition)
- resolveHardwarePlacement(options)
- buildBaseAssembly(context)
- findComponent(layout, id)
- containsBounds(containerBounds, childBounds)
- containsOnAxes(containerBounds, childBounds, axes)
- boundsIntersect(leftBounds, rightBounds)
- CONSTRUCTION_RULES
- CONSTRUCTION_PROFILE_IDS
- DOOR_ARRANGEMENTS
- FRONT_PROFILE_CATALOG
- HARDWARE_GEOMETRY_CATALOG
- LAYOUT_DEFAULTS
- SHELF_THICKNESS_OPTIONS
- LIGHTING_WARMTH_OPTIONS
- LIGHTING_OPTIONS

generateBookcaseLayout returns:

    {
      schemaVersion,
      coordinateSystem,
      config,
      rules,
      metrics,
      corrections,
      components,
      componentOrder,
      sectionIds,
      validation
    }

The default behavior automatically reduces an excessive section count to
preserve the minimum clear section width. Diagnostic tools can request the
uncorrected state:

    generateBookcaseLayout(config, { autoCorrectSections: false })

That mode returns an invalid layout with MIN_SECTION_CLEAR_WIDTH errors, which
is useful for explaining why the requested state cannot be built.

## Descriptor contract

Every component has the same required shape:

    {
      id: "section-01-shelf-01",
      role: "shelf",
      parentId: "section-01",
      hostId: "section-01",
      bounds: {
        min: { x, y, z },
        max: { x, y, z }
      },
      size: { x, y, z },
      position: { x, y, z },
      metadata: { ... }
    }

Bounds are axis-aligned. Position is the bounds center. Size is the bounds
extent. These three representations are checked against one another.

parentId defines logical ownership and scene hierarchy. hostId defines the
physical attachment target. They are deliberately separate:

- A shelf is owned and hosted by its section.
- A lower door is owned and hosted by its cabinet opening.
- A handle is owned and hosted by its door or drawer front.
- A puck light is owned by a section and hosted by the top panel.
- A shelf LED is owned by a section and hosted by a shelf.
- A vertical LED is owned by a section and hosted by a side panel or divider.
- Crown is owned by the bookcase and hosted by the top panel.
- Base trim is owned by the bookcase and hosted by the base.

Attached descriptors include metadata.attachment with the attachment axis,
host face, and component face. Validation requires the declared faces to
touch.

Construction semantics live on the descriptors rather than in renderer
heuristics:

- door and drawer fronts carry `mounting`, `frontPlaneZ`, `backPlaneZ`,
  `reveal`, `style`, resolved `profileGeometry`, `tier`, and
  `constructionProfile`;
- door leaves additionally carry `requestedArrangement`, resolved
  `arrangement`, buildability/availability data, `leafCount`, `leafIndex`,
  `leafWidth`, `meetingGap`, `hingeSide`, and the opposite `latchSide`;
- handles carry one or more `mountingCenters`, orientation, explicit visual
  dimensions/projection, latch side, `placementRuleId`, and the supporting
  resolved solid-region ID;
- base descriptors carry `style`, `purpose`, visibility/structural flags,
  `frontPlane`, `floorContact`, `recessDepth`, optional `side`, and explicit
  decorative-overhang permission;
- the toe-kick void is a logical `opening`, not a rendered physical part.

Terms are unambiguous: `hinge_left` and `hinge_right` identify the hinge edge;
`latch_left` and `latch_right` identify the opposite hardware edge; `pair`
identifies two equal leaves rather than an ambiguous swing direction.

## Component hierarchy

The generated graph follows this structure:

    bookcase (assembly)
      base assembly (one style)
        recessed toe kick: hidden structural platform, kick plate,
          left/right end returns, logical toe-kick void
        flush plinth: one floor-contact plinth
        furniture base: hidden rear support, two front feet, front apron
      left side panel
      right side panel
      bottom panel
      top panel
        crown
      back panel
      vertical dividers
      section 01
        lower opening
          one fitted door or two equal fitted leaves
            one latch-side handle per handled leaf
        lower separator
        adjustable shelves
          shelf LEDs
        upper opening where applicable
          glass door
            handle
        puck or vertical lights
      remaining sections
      feature zone where applicable
        media, desk, or feature opening
        desk worktop where applicable

Logical volume roles are:

- assembly
- section
- section_group
- opening

Physical renderer roles are:

- base
- trim
- crown
- side_panel
- bottom_panel
- top_panel
- back_panel
- divider
- fixed_shelf
- shelf
- door
- drawer_front
- handle
- light

## Centralized construction rules

CONSTRUCTION_RULES is the source of truth for shared construction values.
The engineering basis, source references, and shop-approval status are recorded
in `docs/JQ-CONSTRUCTION-STANDARD.md`. Current code values are:

| Rule | Value |
| --- | ---: |
| Side, top, bottom, and divider thickness | 0.75 in |
| Back panel thickness | 0.25 in |
| Default shelf thickness | 1.25 in |
| Door and drawer front thickness | 0.75 in |
| Door and drawer edge reveal | 0.125 in |
| Double-door center gap | 0.125 in |
| Drawer-to-drawer gap | 0.125 in |
| Closed/glass-front shelf setback | 0.75 in |
| Intentional open-shelf setback | 0.125 in |
| Minimum clear section width | 15 in |
| Minimum vertical shelf clearance | 4 in |
| Maximum unsupported shelf span | 36 in |
| Nominal lower cabinet clear height | 30 in |
| Recessed toe-kick height / clear depth | 4 / 3 in |
| Flush plinth height | 4 in |
| Furniture base height | 4.5 in |
| Furniture front foot width / depth / outside inset | 3 / 3 / 3 in |
| Furniture apron height / depth | 2 / 0.75 in |
| Furniture rear support depth / side inset | 0.75 / 0.75 in |
| Supported finished door-leaf width | 9.5–24 in |
| Ordinary door-height / aspect review threshold | 84 in / 4.5:1 |
| Door corner hardware reference | 2 × 2 in |
| Tall-door hardware center | 40 in above finished floor |
| Handle projection | 1 in |
| Shaker / Slim Shaker / glass frame width | 2.25 / 1.25 / 2.25 in |
| Panel recess / minimum center field | 0.125 / 1.5 in |
| Minimum reduced short-drawer frame | 0.75 in |

Supported shelf thicknesses are 0.75, 1, 1.25, 1.5, 1.75, and 2 inches.

The hardware geometry catalog defines a one-inch nominal knob with one-inch
projection and pull visual lengths of 3, 4, 5, 6, 8, 10, and 12 inches with a
0.5-inch cross-section and one-inch projection. These are deterministic visual
geometry values, not new billable SKUs or an approved fabrication catalog.

Supported lighting warmth values are 2700K, 3000K, and 3500K.

The full_package lighting mode combines hosted puck, vertical LED, and shelf
LED descriptors. Vertical channels are 0.125 inch wide so they occupy the
reserved shelf-side clearance rather than intersecting shelves. Legacy
shelf_wash and full-lighting aliases are normalized.

## Frame and sections

The frame uses a between-sides construction convention:

- Side panels run from the top of the base to overall height.
- Top and bottom panels fit between the side panels.
- The back fits between the sides, top, and bottom.
- Dividers fit inside the clear frame opening.
- Section widths divide the remaining interior width after divider thickness
  is subtracted.

For N equal sections:

    interior width = overall width - 2 * panel thickness
    clear section width =
      (interior width - (N - 1) * divider thickness) / N

Section count is reduced when this would produce a section below the minimum
clear width. With auto-correction disabled, the same condition is an error.

Positive saved or preset ratios preserve asymmetric bays. Selecting a global
section count is the deliberate reset boundary: the engine recomputes the exact
clear total for that count and creates equal bays with a deterministic final
remainder. Subsequent divider, split, and merge edits are local and serialize
back into the same ratio array.

Media and desk layouts use a centered two-section zone when an even layout has
four or more sections. Odd layouts use one true center section by default.
layoutMetadata.specialSpan can override the span. Internal dividers inside a
multi-section feature zone are omitted.

## Shelves

Every adjustable shelf belongs to one section. Its width, vertical range, and
depth are derived from that section.

- Shelf side clearance is subtracted from clear section width.
- Shelf depth respects the back and a context-specific centralized front
  setback. Closed/glass-front interiors reserve the inset-front body depth;
  ordinary open shelving uses the intentional shallow open-front setback.
- Shelf thickness is included in vertical distribution.
- Shelf count is reduced if minimum clear spacing cannot be maintained.
- A span over the unsupported limit is a `SHELF_SUPPORT_REVIEW` warning, not a
  fabricated load-capacity claim.
- Asymmetric layouts use a bounded deterministic vertical offset; they still
  preserve containment and clearance.

Lower storage creates a fixed separator. Adjustable shelves begin above that
separator. Tall-door, media, desk, and feature zones suppress shelves only
where their structured opening requires it.

## Doors, drawers, and hardware

`getFrontBounds()` owns fitted door and drawer-front bounds. For
`jq_inset_v1`, the complete X/Y face stays within its host opening, its visible
face is at the finished front plane, and its body extends inward. For a pair,
both leaves are equal and the clear 0.125-inch meeting gap is centered exactly.
`legacy_overlay_v1` uses the same explicit helper with its visible face at
-0.75 and rear face attached at the opening plane.

Each door-capable section has an aligned metadata entry:

    layoutMetadata: {
      sectionTypes: ["lower_doors", "lower_doors", "drawers"],
      sectionDoorLayouts: [
        { arrangement: "auto" },
        { arrangement: "single_hinge_right" },
        null
      ]
    }

`resolveDoorArrangement()` calculates finished single and paired leaf widths
after perimeter reveals and meeting gap. For new inset designs, Auto selects
one leaf when the finished leaf is 9.5–24 inches; otherwise it selects a pair
when both finished leaves are 9.5–24 inches. If neither arrangement is valid,
or a manual single/pair choice violates those limits, validation rejects the
candidate with the resolver's actionable reason. Tall and upper-glass openings
use the same resolver rather than separate renderer logic.

Single leaves always have an explicit `hinge_left`/`latch_right` or
`hinge_right`/`latch_left` pairing. Default Auto directions balance the
elevation: sections left of center hinge left, sections right of center hinge
right, and a true center uses a deterministic index tie-break. A pair uses a
left-hinged left leaf and right-hinged right leaf, with mirrored latch-side
hardware around the meeting line.

Drawer sections may be selected explicitly per section and remain compatible
with the legacy `lowerStorage` and `layoutMetadata.drawerSections` inputs.
Drawer fronts divide the valid opening height after edge reveals and inter-
drawer gaps are deducted.

`doorStyle` and `drawerFrontStyle` are independent physical selections. Doors
support Shaker, Flat Panel, Slim Shaker, and Glass Frame; drawers support only
Shaker, Flat Panel, and Slim Shaker. A legacy config without
`drawerFrontStyle` inherits a drawer-compatible `doorStyle`; an inferred glass
door style, explicit drawer glass, or any invalid drawer value falls back
deterministically to Shaker. Door and drawer descriptors carry their profile in
`metadata.style`, and the BOM, billable summary, review/quote data, saved
configuration, and AR configuration preserve the distinction. Drawer profile
currently has no pricing multiplier, so changing it does not change the total.

`FRONT_PROFILE_CATALOG` expresses profiles primarily in inches: Flat is a
solid slab; Shaker uses 2.25-inch rails/stiles; Slim Shaker uses 1.25-inch
rails/stiles; glass uses a 2.25-inch solid frame around a glass field. Framed
profiles use a 0.125-inch panel recess and retain at least a 1.5-inch center
field. Short drawer frames may reduce only within the bounded 0.75-inch minimum.
`resolveFrontProfileGeometry()` puts the resolved frame, panel/glass field, and
solid drill regions on the descriptor; the renderer and AR consume those
values and do not derive percentage rails independently.

`resolveHardwarePlacement()` returns drill/mounting centers, orientation,
projection, visual dimensions, latch side, rule ID, and supporting solid
region. Lower doors start at the upper latch corner; upper doors use the lower
latch corner; tall doors start at 40 inches above finished floor. Framed and
glass fronts move the reference to valid rail/stile material, never the center
panel or glass field. The complete hardware envelope also stays outside that
field. Drawer hardware is horizontally centered; slab fronts use the vertical
center and framed fronts use the nearest safe rail centerline.
Pulls are vertical on doors and horizontal on drawers; knobs are neutral.
Hardware attaches to `frontPlaneZ` and projects outward. Push-latch
configurations emit no visible handle descriptor.

Hardware type and finish are presentation projections over one canonical
`hardware` variant ID. The only valid combinations are `brass_knob`,
`brass_pull`, `matte_black_knob`, `matte_black_pull`, and
`polished_nickel_pull`; there is no polished-nickel knob. `push_latch` is an
internal canonical compatibility value that emits no visible handle but is not
shown as a normal customer option pending hardware-system approval. Type changes preserve
the finish when that combination exists and otherwise use the deterministic
Brushed Brass fallback for that type. Type and finish are not separately
persisted, priced, fingerprinted, or sent to AR. A finish-only change within
the same shape can update the existing hardware material, while a knob/pull
shape change regenerates descriptor geometry.

`doorCount` remains only as a compatibility/configuration summary field.
Physical door generation follows valid opening leaves, and normalization aligns
the field to the generated primary leaf count rather than creating detached or
cross-section doors. BOM, pricing, Review, save, quote, and AR quantities use
generated door and handle descriptors.
Quote prefill groups generated door leaves by descriptor style; forced glass
and selected wood fronts in one assembly are reported with separate counts.

## Lighting

Every light has a physical host:

- Puck lights attach to the underside of the top panel.
- Shelf LEDs attach to the underside of their shelf.
- Vertical LEDs attach to the interior face of a side panel or divider.

Lights are also bounded by their owning section. Sections consumed by tall
doors or feature openings do not receive incompatible lighting. Removing a
host makes validation fail with MISSING_HOST; moving the light off its
declared coordinate fails with ATTACHMENT_MISMATCH, and a coincident coordinate
without surface-area overlap fails with ATTACHMENT_SURFACE_DISCONNECTED. Pucks
remain top-panel hosted for every crown style; crown fronts are never used as
remote hosts for interior fixtures.

## Base and crown

`buildBaseAssembly()` dispatches to three physically different descriptor
builders—`buildRecessedToeKickBase()`, `buildFlushPlinthBase()`, and
`buildFurnitureBase()`; there is no generic visible base box followed by
contradictory trim:

- `toe_kick` uses a four-inch base height and a real three-inch-deep central
  void. It emits a hidden structural platform behind the recess, a recessed
  kick plate, 0.75-inch left/right end returns, and a logical
  `base-toe-kick-void` opening. No `base-toe-shadow` physical box exists.
- `plinth` emits one four-inch floor-contact structural plinth. Its front is
  exactly the finished-front reference and its sides equal the outer carcass
  planes. It has no cap or front/side overhang.
- `furniture_base` emits a 0.75-inch-deep rear support rail inset 0.75 inch
  from both side planes, two mirrored 3 × 3
  inch front feet whose outside edges begin three inches inboard, and a
  connected two-inch-high by 0.75-inch-deep front apron. The feet never extend
  through cabinet depth.

All styles derive bottom-panel elevation from the base height while retaining
the exact nominal overall height. Base metadata distinguishes visible from
hidden, structural from decorative, floor contact, front plane, purpose,
recess depth, and side. The validator checks the declared toe void and the
style-specific floor, flushness, containment, mirroring, and joint invariants.

Crown descriptors are also style-specific:

- none emits no crown.
- slim_cap emits one front cap and its left/right side returns.
- classic_crown emits a front rail and front cap, each with left/right side
  returns.
- modern_soffit emits one front band and its left/right side returns.

Each front member attaches to the top-panel surface. Each side return attaches
to its corresponding side panel and runs continuously from
`carcassFrontPlaneZ` to `backInteriorPlaneZ`, so side views show one intentional
profile instead of a front-only strip. Style envelopes are centralized in
`CONSTRUCTION_RULES.crownProfiles`: Slim Cap allows 0.25-inch side and
0.375-inch front overhang; Classic allows 0.5-inch side and 0.625-inch front;
Modern Soffit allows 0.125-inch side and 0.5-inch front. All V1 profiles have
zero rear and top overhang.

Overhang is explicit crown metadata, so decorative extensions are
distinguishable from accidental out-of-bounds structural geometry.
`CROWN_OVERHANG_EXCEEDED` rejects geometry or metadata outside the selected
style envelope, and `CROWN_SIDE_RETURN_INVALID` rejects a discontinuous return.
Flush plinths, doors, drawers, and furniture feet never receive crown overhang
permission. Nominal and decorative bounds are reported separately.

## Validation

validateBookcaseLayout returns:

    {
      valid,
      errors,
      warnings,
      issues
    }

Each issue includes code, severity, componentId, relatedId, and message.

Construction-specific error codes are stable, actionable invariants:

| Area | Codes |
| --- | --- |
| Front mounting and fit | `FRONT_OUTSIDE_OPENING_XY`, `FRONT_MOUNTING_INVALID`, `FRONT_PLANE_MISMATCH`, `FRONT_DEPTH_DIRECTION_INVALID`, `FRONT_REVEAL_INCONSISTENT` |
| Door leaves and semantics | `PAIR_LEAF_WIDTH_MISMATCH`, `PAIR_MEETING_GAP_MISMATCH`, `DOOR_LEAF_TOO_WIDE`, `DOOR_LEAF_TOO_NARROW`, `INVALID_HINGE_SIDE`, `INVALID_LATCH_SIDE`, `HINGE_LATCH_CONFLICT` |
| Hardware | `HARDWARE_OUTSIDE_FRONT`, `HARDWARE_NOT_ON_SOLID_REGION`, `HARDWARE_ON_GLASS`, `HARDWARE_TOO_CLOSE_TO_EDGE`, `HARDWARE_TOO_CLOSE_TO_MEETING_GAP`, `HARDWARE_ATTACHMENT_MISMATCH`, `HARDWARE_ORIENTATION_INVALID`, `HARDWARE_LATCH_SIDE_MISMATCH`, `HARDWARE_COUNT_MISMATCH`, `PAIRED_HARDWARE_NOT_MIRRORED` |
| Base | `BASE_NOT_ON_FLOOR`, `TOE_KICK_RECESS_MISMATCH`, `TOE_KICK_VOID_OCCUPIED`, `TOE_KICK_PLATE_POSITION_INVALID`, `PLINTH_NOT_FLUSH`, `FURNITURE_FOOT_OUTSIDE_WIDTH`, `FURNITURE_FOOT_FULL_DEPTH`, `FURNITURE_FEET_NOT_MIRRORED`, `FURNITURE_SUPPORT_NOT_HIDDEN`, `BASE_CARCASS_GAP`, `BASE_COMPONENT_COLLISION` |
| Attachments | `ATTACHMENT_MISMATCH`, `ATTACHMENT_SURFACE_DISCONNECTED` |
| Crown | `CROWN_OVERHANG_EXCEEDED`, `CROWN_SIDE_RETURN_INVALID` |
| Front profiles | `PROFILE_CENTER_FIELD_NON_POSITIVE`, `PROFILE_FRAME_TOO_LARGE`, `PROFILE_SUBGEOMETRY_OUTSIDE_FRONT`, `DRAWER_GLASS_UNSUPPORTED` |

`DOOR_ASPECT_REVIEW` and `SHELF_SUPPORT_REVIEW` are warnings requiring
engineering/shop review rather than silent acceptance as ordinary supported
construction. Deterministic normalizations remain reported corrections, such
as section/shelf count reduction and bounded short-front frame reduction.

The retained graph checks cover required schema, stable unique IDs, finite and
positive dimensions, bounds/size/position consistency, resolvable parents and
hosts, acyclic hierarchy, nominal containment, section and shelf clearances,
light hosting, attachments, and unexpected solid AABB intersections. Each
impossible or contradictory condition is an error; warning status does not
hide geometry.

Logical volumes are excluded from collision pairs because they contain their
children by design. Hardware and lights use attachment checks rather than
generic collision checks. Decorative overhang is allowed only when explicitly
marked.

Invalid layouts do not replace the last valid rendered scene. The engine
returns the rejection issues without committable BOM/pricing artifacts, and
the viewer also rejects a model whose rendered-manifest audit fails.

## Preset behavior

All ten current presets use the same layout engine:

1. lower-cabinets (Full Bookcase)
2. classic-open (Open Shelves)
3. media-wall
4. library-wall
5. display-wall
6. glass-library
7. desk-niche
8. feature-wall (Fireplace Surround)
9. asymmetric-modern
10. tall-storage

There are no preset-specific geometry builders. Presets select section types,
special openings, storage, finish metadata, and lighting behavior. Every
active preset normalizes to `jq_inset_v1`; legacy overlay is never exposed as a
preset or customer control.

Future preset metadata can use:

    layoutMetadata: {
      specialSpan: 2,
      sectionRatios: [0.8, 1.2, 1.2, 0.8],
      drawerSections: [1, 2],
      sectionTypes: ["lower_doors", "drawers", "drawers", "tall_doors"],
      sectionDoorLayouts: [
        { arrangement: "single_hinge_left" },
        null,
        null,
        { arrangement: "auto" }
      ]
    }

Explicit sectionTypes take precedence over inferred section behavior.

## Renderer integration

The renderer integration should follow this sequence:

    const layout = generateBookcaseLayout(currentConfig);
    if (!layout.validation.valid) {
      showLayoutErrors(layout.validation.errors);
      return;
    }

    const physical = layout.components.filter(
      (component) =>
        !["assembly", "section", "section_group", "opening"].includes(component.role)
    );

    replaceSceneFromDescriptors(physical);

For each physical descriptor:

1. Convert size and position from inches to scene units.
2. Select geometry and material from role and metadata.
3. Create or update an Object3D named with descriptor.id.
4. Parent it according to parentId when that parent has a scene object;
   otherwise parent it to the nearest physical ancestor or model root.
5. Do not apply any additional placement offsets.

Simple panels, shelves, doors, drawer fronts, trim, and LED channels can use
box geometry. Puck, knob, and pull visuals can use specialized geometry while
retaining descriptor bounds and attachment location. metadata.style,
metadata.hardware, metadata.lightType, and metadata.warmth select appearance;
they must not change layout.

Front rendering consumes the descriptor's semantic mounting and resolved
`profileGeometry`. Flat fronts use the descriptor slab. Shaker, Slim Shaker,
and glass create rails/stiles plus a recessed panel or glass field inside the
same front envelope. Hardware uses its resolved orientation, projection, and
visual dimensions. Neither renderer infers inset/overlay from negative Z or
recalculates rail percentages, door gaps, handle positions, or base parts.

`createExpectedRenderManifest()` converts every physical descriptor into the
scene coordinate convention. `validateRenderedManifest()` requires exactly one
render record per physical component, at least one mesh for that record, no
invented physical component, and aggregate mesh bounds inside the descriptor
envelope. Visual submeshes may be smaller but never detached or larger. The
viewer validates the candidate layout and manifest before swapping the current
model, so a bad layout or render audit preserves the last valid scene.

The same descriptor id should map to the same scene object across updates.
Objects whose ids disappear should be disposed. New ids should be created.
This makes preset switches and repeated add/remove operations deterministic.

## Developer construction inspector

The inspector is opt-in developer tooling activated only by:

    configurator.html?constructionDebug=1

It is not shown in normal customer sessions and does not publish the controller
on `window`. The inspector can isolate All, Base, Fronts, or Hardware; toggle
reference planes, descriptor bounds, rendered bounds, and the toe-kick void; and color collision
components. Its report includes the construction profile, finished front plane,
base height, nominal/decorative bounds, render-manifest counts and discrepancies,
validation codes, collision pairs, every component role/host, base purposes/
recess depths, front leaf widths/mounting/reveals/gaps/hinge-latch semantics,
and hardware mounting centers/rule IDs.

All inspector geometry lives in the `construction-debug-helpers` group with
`nonPhysicalHelper` metadata. It is excluded from descriptors, render-manifest
counts, BOM, price, save, quote, AR, and collision tests. `getDiagnostics()`
exposes the current debug toggles, profile, reference planes, validation issues,
and render audit through the existing bounded diagnostic seam.

## Automated tests

The focused construction/model command is:

    node --test \
      tests/bookcase-config.test.js \
      tests/bookcase-layout.test.js \
      tests/bookcase-sections.test.js \
      tests/bookcase-bom-pricing.test.js \
      tests/bookcase-engine-transaction.test.js \
      tests/bookcase-engine-fuzz.test.js \
      tests/bookcase-render-contract.test.js \
      tests/configurator-renderer-integration.test.js \
      tests/cabinet-ar.test.js \
      tests/quote-prefill.test.js

The package-level command remains `npm test`.

Construction coverage verifies shared reference planes, inset and legacy
front depth semantics, actual toe-kick void/plate/returns, true flush plinth,
front-only furniture feet and apron, Auto/manual door arrangements, equal pair
leaves and meeting gaps, hinge/latch sides, profile-aware hardware, fixed-inch
front profiles, render-envelope containment, generated-leaf billables/pricing,
save migration, quote metadata, and AR parity. Section tests cover aligned
door-layout metadata across type, split, merge, and count changes.

`tests/bookcase-engine-fuzz.test.js` uses fixed seeds so failures are
reproducible. Its supported matrix uses seed `0x4A51424B`; hostile normalization
uses `0xC0FFEE`. Each case checks deterministic serialization, non-mutation,
finite positive physical geometry, hierarchy/hosts, generated counts, JSON
round-trip validation, and stable rejection issues. The release QA document
owns the required browser views, viewports, and screenshot evidence; model
tests alone never imply visual completion.

Workflow and shell contracts are additionally covered by:

    node --test tests/configurator-experience.test.js tests/configurator-contract.test.js

Those tests cover the two-mode registry, mappings, draft validation,
applicability, preset reconciliation, summaries, payload parity, duplicate
action locks, one-viewer markup, shared handlers, accessibility wiring,
responsive contracts, diagnostics, and removal of the legacy dual-sidebar
paths.

## Current limitations

- Validation uses axis-aligned boxes, not triangle-level collision detection.
- The engine describes closed doors and drawers; hinge swing and drawer travel
  envelopes are not yet modeled.
- Door descriptors store hinge/latch edges but do not yet select an exact hinge
  family, bore pattern, or hinge count. Drawer fronts are modeled, but internal
  drawer boxes and runners are not.
- Feature, media, and desk openings are structural volumes. The renderer may
  visualize only descriptor-backed physical parts; explanatory helpers must be
  explicitly nonphysical and excluded from render/BOM/AR contracts.
- Section widths may use validated positive `sectionRatios`; invalid ratio
  arrays fall back to equal bays and the normal minimum-width rules still
  apply.
- Shelf support construction is limited to a maximum-span rule; material- and
  load-specific engineering is outside this model.
- Crown and trim use conservative box envelopes. Profile meshes may replace
  their visuals only inside the declared descriptor envelope.
- Door leaves, drawer fronts, visible hardware, and lighting quantities are
  derived from generated components. Other established pricing categories
  retain their existing formulas and remain selection/dimension based.
- Inches are the only supported product unit. No measurement-unit selector is
  shown because the physical schema has no alternate unit contract.
- Legacy overlay construction is intentionally restoration-only. The normal UI
  exposes no construction-profile switch. Exact hinge/runner products and
  arbitrary fabrication dimensions remain shop decisions rather than drawable
  customer options.
- Dimension and topology changes still require deterministic model
  regeneration; the safe in-place path currently covers finish, light warmth,
  and same-shape hardware appearance.
- Save Design and the quote project brief remain browser-local preview flows.
  There is no production account, server persistence, or submission endpoint
  in this repository.
- The dimensions in `docs/JQ-CONSTRUCTION-STANDARD.md` marked for shop approval
  remain JQ product decisions, not universal industry standards or fabrication
  authorization.
