# Guided Accepted-Specification Scene

## Purpose

The public guided configurator is driven by one accepted, immutable physical
specification. The UI proposes a complete project candidate; pure room,
installation, and product engines either accept it or return named diagnostics.
The Three.js renderer displays the accepted product descriptors and never
invents cabinetry from UI labels, scales a stock model to fit, or substitutes a
photograph for rejected geometry.

“Accepted” means internally consistent under this guided engine contract. It is
not a shop drawing, structural approval, site verification, or authorization to
manufacture. Field dimensions, attachment conditions, service clearances, and
the provisional decisions listed in `config/provisional-decisions.json` still
require JQ Bookcases review.

## One transaction from input to output

| Phase | Owner | Result |
| --- | --- | --- |
| Guided state | `guided-configurator.js` and `guided-configurator-state.js` | Product, layout, measurements, finish, hardware, and lighting intent |
| Room topology | `guided-room-topology.js` | Physical planes, returns, features, exclusions, installation zones, and camera intent |
| Installation fit | `guided-installation-solver.js` | Casework envelope, separate treatments, anchors, and fit invariants |
| Product geometry | `guided-product-adapter.js` and `guided-product-engine.js` | Audited physical descriptor sets, render manifest, geometry fingerprint, and supported pricing |
| Accepted specification | `guided-project-engine.js` | Atomic room + fit + product result with selection and specification fingerprints |
| Display | `guided-render-contract.js`, `guided-materials.js`, and `guided-configurator-3d.js` | A persistent renderer that displays only accepted product descriptors |
| Downstream state | `guided-configurator-state.js` | The same accepted snapshot used by review, save/reload, and quote summaries |

`transactGuidedProject` commits a candidate only after every phase succeeds. A
rejected edit exposes its stage and diagnostic codes while keeping the last
accepted specification available. The same normalized input produces the same
geometry and specification fingerprints.

## Room topology contract

Room topology is geometry rather than a card label. The engine resolves all ten
public conditions:

- center niche;
- left niche and right niche with physically distinct one-sided returns;
- clear wall;
- fireplace wall;
- center projection;
- window wall;
- door wall;
- two-run corner wall;
- the wall zone between two openings.

Every accepted topology uses inches and explicit X/Y/Z planes. Features such as
windows, doors, fireplaces, projections, radiators, open edges, and returns
produce exclusion volumes and bounded installation zones. A multi-zone layout
remains multi-zone downstream; it is not collapsed into one centered image.
Invalid or intersecting feature dimensions reject with named errors.

`guided-scene-plan.js` remains the renderer-neutral source for room
presentation, architecture, dimension lines, and camera framing. It is not the
source of product geometry. Product target bounds and placement come from the
accepted topology and fit contracts.

## Installation fit contract

The installation solver supports fitted, freestanding, and floating modes. It
never uses a global scale transform: every accepted descriptor set has root
scale `[1, 1, 1]` and physical inch dimensions.

For fitted work, the room boundaries determine the generated casework width,
base, top scribe, fillers, end panels, and back/floor/ceiling anchors. Fillers
and end panels are separate auditable treatments. Equivalent boundaries must
balance within the policy tolerance; an open edge receives a finished end
condition instead of a fictional wall filler. Floor-mounted work meets the
finished floor, fitted work meets its top boundary, and floating work retains
its explicit mounting height and floor clearance.

If the requested product cannot fit after the permitted treatment and section
reductions, the solver rejects it. The renderer does not shrink the accepted
model or display a near-enough visual approximation.

## Product geometry and public availability

The engine package retains seven physical archetypes for compatibility,
persistence, and future product work. The v1 public flow exposes only Cabinets
+ Shelves as an active product and evaluates each layout against the checked-in
compatibility matrix before product generation. Other archetypes are disabled
Coming soon references and cannot be selected through UI, keyboard, query,
preset, or restored draft injection. Legacy saved projects that name one remain
stored but are marked unavailable and routed safely to Choose Product.

Supported bookcase and media variants inside the engine pass through the
canonical bookcase engine and render contract. Floating storage, window
storage, radiator covers, and corner transitions use product-specific
descriptor builders while obeying the same fit references, IDs, bounds,
validation, and fingerprint rules. Keeping those internal contracts does not
make those products available in the public v1 flow.

TV geometry is derived from the entered diagonal and aspect ratio, or from
explicit body dimensions when supplied. The black TV body is a separate
descriptor. The surrounding opening is generated from that body plus the
centralized side, top, bottom, soundbar, equipment, and ventilation clearances.
Towers and shelves occupy the remaining accepted envelope. An impossible media
fit rejects instead of drawing a decorative frame unrelated to the TV data.

Canonical-engine products retain canonical pricing and layout fingerprints.
Product-specific descriptor builders currently report pricing as unavailable;
the UI and saved specification must preserve that status rather than fabricate
an estimate.

## Persistent rendering contract

Steps 3–4 share one lazily created scene controller, WebGL renderer, canvas,
camera, and scene. The canvas may move between step hosts, but a second viewer
is not created. The room and product share camera, lighting, depth, occlusion,
and shadows.

The accepted scene mounts immediately when Customization opens. Dimensions,
Finish, and Details share the same controller; the compact measurement guide is
static contextual imagery and never creates another renderer. Browser QA
diagnostics expose mount/unmount counts plus render-frame, resize-frame,
ResizeObserver-or-resize-listener, control-listener, and host debounce-timer
ownership.

Before display, `guided-render-contract.js` audits the accepted specification,
including root scale, installation references, component bounds, floor/floating
anchors, and width reconciliation. It converts the accepted descriptor graph
to scene records and verifies the rendered manifest. The renderer creates one
mesh per renderable accepted descriptor; no product-layout calculation belongs
in `guided-configurator-3d.js`.

Geometry and appearance have separate identities. A changed geometry
fingerprint rebuilds descriptor-driven scene content. A finish, hardware, or
lighting-only change updates materials on the existing product meshes without
changing their fitted dimensions. The renderer exposes its accepted
fingerprints and rebuild counters as diagnostic data attributes for browser QA.

The normal path fails closed. A missing, rejected, or unauditable accepted
specification leaves the renderer in a named error state and does not hydrate an
integrated room/product photograph as a substitute. Static imagery remains
appropriate for product and layout-selection cards, but it is not
Customization or Review & Details geometry.

## PBR material contract

`guided-materials.js` provides five wood families and four sprayed-paint
families. Wood uses separate albedo, normal, roughness, and ambient-occlusion
maps. Paint uses shared sprayed normal and roughness maps plus its selected base
color. The assets are under `assets/textures/`.

UV repeats are computed from the physical descriptor dimensions. Grain follows
the part: side panels, doors, drawer fronts, and backs are vertical; shelves and
tops follow their long axis; crown and trim follow the extrusion axis. Room,
screen, glass, hardware, and light materials remain independent of the selected
millwork finish.

Warm customer and neutral material-QA environment sources are under
`assets/environments/`. The manifest retains the HDR sources and browser-ready
preview images. Shared textures and environment maps are cached across material
updates and are not disposed when only product geometry is refreshed.

## State, save, and review integrity

The accepted specification contains the room, fit, product descriptor graph,
material state, pricing or explicit pricing status, diagnostics, and three
identities: geometry, selection, and complete specification fingerprints.
`guided-configurator-state.js` stores an accepted snapshot with the project.
Reload restores and revalidates that snapshot against current state before it
can become the displayed result.

Schema-v4 normalization migrates legacy five-step positions as 1→1, 2→2,
3/4→3, and 5→4. `currentStep` and `maxVisitedStep` remain bounded by the active
product/layout guards. Unsupported saved products are retained verbatim as
unavailable records and never coerced into Cabinets + Shelves.

Review and quote summaries receive the accepted specification rather than
reconstructing dimensions from labels. A rejected edit never mutates the last
accepted snapshot. Price, when available, comes from the same canonical product
evaluation that produced the rendered geometry.

## Shipped policy and evidence

`config/` contains the engine package's room, fit, compatibility, archetype,
material, provisional-decision, golden-project, and asset-manifest contracts.
The production Pages artifact deliberately allowlists this directory together
with the guided engine modules, canonical render contract, textures, and
environments. The release workflow verifies every required module, config, and
material/environment file before upload.

## File ownership

- `guided-configurator-data.js` — public catalog, measurement, and selection definitions.
- `guided-configurator-state.js` — normalization, warnings, accepted snapshots, persistence, and summaries.
- `guided-room-topology.js` — ten physical room topologies, features, exclusions, zones, and camera intent.
- `guided-installation-solver.js` — fitted, freestanding, and floating installation contracts.
- `guided-product-adapter.js` — product archetypes, compatibility, TV derivation, and canonical inputs.
- `guided-product-engine.js` — product descriptors, validation, pricing status, manifests, and geometry fingerprints.
- `guided-project-engine.js` — atomic accepted-specification transactions and snapshot restoration.
- `guided-render-contract.js` — descriptor conversion and pre/post-render audits.
- `guided-materials.js` — PBR assets, physical UVs, part-aware grain, and environments.
- `guided-scene-plan.js` — room presentation, dimensions, and camera planning only.
- `guided-configurator-3d.js` — persistent display of accepted descriptors.
- `guided-configurator.js` — public flow orchestration and last-valid transaction handling.
