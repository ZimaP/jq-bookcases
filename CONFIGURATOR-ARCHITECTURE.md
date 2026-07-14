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

The renderer must not recalculate section widths, door gaps, shelf positions,
handle offsets, or light positions. Those are layout responsibilities.

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

Adding drawer-profile metadata changes current descriptor fingerprints.
Schema-4 records whose canonical config predates `drawerFrontStyle` are restored
through a bounded compatibility path: regeneration must match the exact legacy
fingerprint computed with only that new drawer metadata omitted, and any stored
accepted-design ID must match that verified legacy fingerprint. The migration
does not bypass integrity checks. Schema-2 and schema-3 config-only restoration
continues through normal canonical regeneration.

## Coordinate and unit system

All layout values use inches.

- X is width, increasing from left to right.
- Y is height, increasing from bottom to top.
- Z is depth, increasing from the front plane toward the back.
- The origin is the bottom-center of the nominal cabinet front plane.
- The carcass occupies non-negative Z.
- Door and drawer fronts project into negative Z.
- Hardware projects farther into negative Z from its host face.

The root bookcase descriptor represents the exact nominal width, height, and
depth. Explicit decorative overhangs such as crown and plinth trim are marked
with metadata.allowOverhang.

Three.js conversion should happen once in the renderer. With the existing
scene convention, one possible conversion is inches / 12 for scene feet. Do
not apply visual width, height, or depth multipliers in layout code.

## Public API

The main call is:

    const layout = generateBookcaseLayout(config);

The module exports:

- generateBookcaseLayout(config, options)
- normalizeLayoutConfig(config, options)
- validateBookcaseLayout(layout)
- findComponent(layout, id)
- containsBounds(containerBounds, childBounds)
- containsOnAxes(containerBounds, childBounds, axes)
- boundsIntersect(leftBounds, rightBounds)
- CONSTRUCTION_RULES
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

## Component hierarchy

The generated graph follows this structure:

    bookcase (assembly)
      base
        base trim
      left side panel
      right side panel
      bottom panel
      top panel
        crown
      back panel
      vertical dividers
      section 01
        lower opening
          left door
            handle
          right door
            handle
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
Current assumptions are:

| Rule | Value |
| --- | ---: |
| Side, top, bottom, and divider thickness | 0.75 in |
| Back panel thickness | 0.25 in |
| Default shelf thickness | 1.25 in |
| Door and drawer front thickness | 0.75 in |
| Door and drawer edge reveal | 0.125 in |
| Double-door center gap | 0.125 in |
| Drawer-to-drawer gap | 0.125 in |
| Minimum clear section width | 15 in |
| Minimum vertical shelf clearance | 4 in |
| Maximum unsupported shelf span | 36 in |
| Nominal lower cabinet clear height | 30 in |
| Shelf front setback | 0.75 in |
| Handle projection | 1 in |

Supported shelf thicknesses are 0.75, 1, 1.25, 1.5, 1.75, and 2 inches.

Supported lighting warmth values are 2700K, 3000K, and 3500K.

The full_package lighting mode combines hosted puck, vertical LED, and shelf
LED descriptors. Legacy shelf_wash and full-lighting aliases are normalized.

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
- Shelf depth respects the back and front setback.
- Shelf thickness is included in vertical distribution.
- Shelf count is reduced if minimum clear spacing cannot be maintained.
- A span over the unsupported limit is a validation error.
- Asymmetric layouts use a bounded deterministic vertical offset; they still
  preserve containment and clearance.

Lower storage creates a fixed separator. Adjustable shelves begin above that
separator. Tall-door, media, desk, and feature zones suppress shelves only
where their structured opening requires it.

## Doors, drawers, and hardware

Lower double doors are calculated from each section opening:

- Both edge reveals use the centralized reveal.
- Both leaves have equal width.
- The center gap uses the centralized double-door gap.
- Each door attaches to exactly one opening.
- Default four-section lower storage emits exactly eight doors.

Tall storage uses one fitted door in each configured end section. Glass
library layouts add one hosted upper glass door per section while retaining
the shared lower-door rules.

Drawer-oriented layouts are supported before a customer drawer toggle exists.
They can be requested with lowerStorage set to drawers, a layoutType containing
drawer, or layoutMetadata.drawerSections containing selected zero-based
section indices. Drawer fronts divide the valid opening height after edge
reveals and inter-drawer gaps are deducted.

`doorStyle` and `drawerFrontStyle` are independent physical selections. Doors
support Shaker, Flat Panel, Slim Shaker, and Glass Frame; drawers support only
Shaker, Flat Panel, and Slim Shaker. A legacy config without
`drawerFrontStyle` inherits a drawer-compatible `doorStyle`; an inferred glass
door style, explicit drawer glass, or any invalid drawer value falls back
deterministically to Shaker. Door and drawer descriptors carry their profile in
`metadata.style`, and the BOM, billable summary, review/quote data, saved
configuration, and AR configuration preserve the distinction. Drawer profile
currently has no pricing multiplier, so changing it does not change the total.

Handles derive from the parent face bounds. Edge placement is constrained to
the usable face area. Pull orientation is vertical on doors and horizontal on
drawers. Push-latch configurations emit no handle geometry.

Hardware type and finish are presentation projections over one canonical
`hardware` variant ID. The only valid combinations are `brass_knob`,
`brass_pull`, `matte_black_knob`, `matte_black_pull`, and
`polished_nickel_pull`; there is no polished-nickel knob. Type changes preserve
the finish when that combination exists and otherwise use the deterministic
Brushed Brass fallback for that type. Type and finish are not separately
persisted, priced, fingerprinted, or sent to AR. A finish-only change within
the same shape can update the existing hardware material, while a knob/pull
shape change regenerates descriptor geometry.

doorCount remains accepted as a customer/configuration field. Physical door
generation follows valid section openings. If the requested count conflicts
with the section structure, the engine emits a
DOOR_COUNT_ALIGNED_TO_SECTIONS correction rather than creating detached or
cross-section doors.

## Lighting

Every light has a physical host:

- Puck lights attach to the underside of the top panel.
- Shelf LEDs attach to the underside of their shelf.
- Vertical LEDs attach to the interior face of a side panel or divider.

Lights are also bounded by their owning section. Sections consumed by tall
doors or feature openings do not receive incompatible lighting. Removing a
host makes validation fail with MISSING_HOST; moving the light off its
declared surface fails with ATTACHMENT_MISMATCH.

## Base and crown

Base descriptors are style-specific:

- toe_kick emits a recessed base and toe-shadow trim.
- plinth emits the base and an overhanging plinth cap.
- furniture_base emits the base, two feet, and a furniture rail.

Crown descriptors are also style-specific:

- none emits no crown.
- slim_cap emits one cap.
- classic_crown emits a rail and cap.
- modern_soffit emits a broad band.

Overhang is explicit metadata, so decorative extensions are distinguishable
from accidental out-of-bounds structural geometry.

## Validation

validateBookcaseLayout returns:

    {
      valid,
      errors,
      warnings,
      issues
    }

Each issue includes code, severity, componentId, relatedId, and message.

The current validator checks:

- Required descriptor schema
- Unique component ids
- Finite and positive dimensions
- Consistency between bounds, size, and position
- Existing parent and host references
- Parent hierarchy cycles
- Structural containment in nominal bookcase bounds
- Section minimum clear width
- Child containment in sections and openings
- Door and drawer fit
- Centralized reveal use
- Handle X and Y bounds on its face
- Door, drawer, handle, and light attachment surfaces
- Light containment in its section
- Shelf minimum vertical clearance
- Unsupported shelf spans
- Solid AABB intersections
- Explicit normalization corrections

Logical volumes are excluded from collision pairs because they contain their
children by design. Hardware and lights use attachment checks rather than
generic collision checks. Decorative overhang is allowed only when explicitly
marked.

Invalid layouts should not replace a valid rendered scene. The UI may either
show the validator messages or retain the last valid layout.

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
current preset passes programmatic validation.

Future preset metadata can use:

    layoutMetadata: {
      specialSpan: 2,
      sectionRatios: [0.8, 1.2, 1.2, 0.8],
      drawerSections: [1, 2],
      sectionTypes: ["open", "drawers", "drawers", "tall_doors"]
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

The same descriptor id should map to the same scene object across updates.
Objects whose ids disappear should be disposed. New ids should be created.
This makes preset switches and repeated add/remove operations deterministic.

## Automated tests

The focused command is:

    node --test tests/bookcase-layout.test.js

The package-level command is:

    npm test

Coverage includes canonical dimensions, frame math, section accumulation,
minimum-width correction, every shelf thickness, shelf spacing, lower doors,
reveals, center gaps, drawers, handles, all lighting modes, crown and base
styles, all ten presets, boundaries, sequential changes, serialization,
missing hosts, out-of-bounds components, duplicate ids, and collision
detection.

Focused model coverage also verifies equal count transitions and deterministic
remainders, adjacent-pair clamping and drift resistance, independent door and
drawer profile normalization/descriptors, profile-neutral pricing, hardware
variant round trips, legacy schema-4 fingerprint restoration, positional AR
share compatibility, and quote metadata propagation.

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
- Drawer fronts are modeled, but internal drawer boxes and runners are not.
- Feature, media, and desk openings are structural volumes. The renderer may
  add a restrained screen, worktop, or firebox indicator, but never shelf
  decoration or a staged room environment.
- Section widths may use validated positive `sectionRatios`; invalid ratio
  arrays fall back to equal bays and the normal minimum-width rules still
  apply.
- Shelf support construction is limited to a maximum-span rule; material- and
  load-specific engineering is outside this model.
- Crown and trim use conservative box envelopes. Profile meshes may replace
  their visuals without changing descriptor placement.
- Door, drawer-hardware, door-hardware, and lighting quantities are derived
  from generated components. Other established pricing categories retain their
  existing formulas and remain selection/dimension based.
- Inches are the only supported product unit. No measurement-unit selector is
  shown because the physical schema has no alternate unit contract.
- Cabinet height, shelf profile, frame/overlay construction, selectable glass,
  and arbitrary per-section widths are not exposed because no corresponding
  customer-adjustable product values exist in the current source of truth.
- Dimension and topology changes still require deterministic model
  regeneration; the safe in-place path currently covers finish, light warmth,
  and same-shape hardware appearance.
- Save Design and the quote project brief remain browser-local preview flows.
  There is no production account, server persistence, or submission endpoint
  in this repository.
