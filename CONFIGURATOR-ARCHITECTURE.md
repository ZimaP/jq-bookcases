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
4. The renderer consumes valid physical descriptors.

The renderer must not recalculate section widths, door gaps, shelf positions,
handle offsets, or light positions. Those are layout responsibilities.

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

Handles derive from the parent face bounds. Edge placement is constrained to
the usable face area. Pull orientation is vertical on doors and horizontal on
drawers. Push-latch configurations emit no handle geometry.

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
- Pricing still consumes customer configuration rather than calculated
  component quantities. The component graph provides hooks for future
  quantity-based pricing.
