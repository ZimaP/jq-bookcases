# JQ Bookcases Blender render foundation

Status: Drawing 4 geometry v1, circular puck-light primitive v1, and the Small
Crown diagnostic/correction gate implemented for the internal **TV Unit + Clear
Wall + fitted installation** prototype. It remains a clay-render boundary, not
a customer-approved beauty-render path.

## Decision

The deterministic JQ engine remains the only source of product geometry. Blender
is a renderer, not a design generator. The browser sends a compact accepted
project; the server regenerates it with the same JavaScript engine, verifies the
geometry and selection fingerprints, audits the descriptor graph, and only then
creates renderer-neutral primitives for a Blender worker.

This prevents Blender, Codex, or an image model from inventing bay counts,
fillers, depths, openings, shelves, fronts, or TV clearances.

## Boundary

1. `createGuidedBlenderRenderJob()` accepts only an audited project that can be
   persisted and regenerated exactly.
2. The compact job omits customer notes, uploads, accepted descriptor graphs,
   quotes, prices, URLs, and hardware catalog snapshots. The contract caps the
   serialized job at 16 KiB and rejects malformed or unbounded accepted-snapshot
   fingerprints; the HTTP gateway must enforce the same body limit before JSON
   parsing.
3. `regenerateGuidedBlenderRenderPackage()` runs the production JQ engine again,
   rejects stale or tampered identities, and emits exact component/submesh
   bounds plus material IDs.
4. `guided-render-primitives.js` is shared by the current Three.js view and the
   Blender package, so doors, fields, rails, stiles, slabs, and crown profiles
   cannot acquire two different geometric interpretations.
5. Blender coordinates are explicit and tested:
   `(JQ x, y, z inches) -> (Blender x, -z, y meters) * 0.0254`.

Static GitHub Pages cannot execute Blender. Phase 2 proves the private Blender
Python worker locally; a future service layer still needs a small Node render
gateway and object storage. The current Three.js view remains the
immediate/loading/failure fallback if that service is later connected to Step 4.

`guided-blender-render-contract.js` is intentionally repository/server-only in
foundation v1 and is excluded from the public Pages artifact. Only the shared
renderer-neutral primitive module is shipped because the current Three.js view
imports it.

## Cache identity

The SHA-256 render key includes geometry, selection, full descriptor, material,
and camera fingerprints plus the engine, accepted-render, primitive, pipeline,
material-library, scene, camera, and output-profile versions. The authoritative
package key additionally covers the exact scene, camera, geometry, materials,
constraints, request key, audit, and approval-readiness envelope. Pricing is
intentionally excluded, so a quote change cannot invalidate an identical image.
Finish-only and light-warmth-only changes retain the geometry fingerprint but
still produce a different render key.

## Drawing 4 internal prototype contract

The committed `TV01-clear-wall-foundation` fixture now resolves:

- 120 × 96 × 14 in room input;
- 117 × 96 × 14 in fitted casework;
- 1.5 in fillers on each side;
- 56 × 33 in TV body and 60 × 37 in service opening;
- four clear module widths of 27, 29.625, 29.625, and 27 in, derived from the
  exact service opening and five 0.75 in structural panel widths;
- four paired lower openings with eight authored Shaker door leaves and eight
  descriptor-hosted Black Pulls;
- one continuous 117 × 1.25 × 14 in countertop;
- eight outer shelves governed by the 1 in/27 in rule and two center display
  shelves governed by the 1.25 in/31 in rule;
- a split center divider below the countertop and above the service opening,
  with no divider through the TV, soundbar, or ventilation volumes;
- 44 renderable components, 78 renderer-neutral/Blender submesh objects, and
  seven non-renderable opening/clearance constraints.

The authoritative shelf schedule is fail-closed: 1 in MDF supports a maximum
27 in clear span, 1.25 in supports 31 in, and 1.5 in supports 36 in. A wider
span is rejected instead of receiving an undersized shelf. The Drawing 4
module solver likewise rejects casework that cannot preserve the service span,
paired-door leaves, usable side bays, and shelf rules; it never falls back to
the former three-section elevation.

John approval is not required for this internal prototype phase. This encoding
does not approve production shop geometry or a customer beauty render;
`customerBeautyRenderApproved` remains `false`.

## Circular puck-light primitive v1

Primitive contract version 2 replaces each accepted puck's former box proxy
with two package-driven `cylinder` submeshes while leaving its authoritative
component descriptor unchanged. Each of the two existing pucks retains its
stable component ID, top-panel host, center, mirrored placement, 2.25 in
diameter envelope, 0.375 in physical depth, and underside Y-axis attachment.

The `housing-rim` is a 32-segment annular cylinder with a 1.125 in outer radius
and 0.9 in inner radius using the dark hardware clay. The `emissive-lens` is a
32-segment closed cylinder with a 0.81 in radius and 0.1875 in depth, recessed
0.0625 in behind the housing face and resolved explicitly to the warm LED clay.
The radial clearance and axial recess prevent overlap and z-fighting. Blender
receives the converted center, Z-axis orientation, radii, depth, tessellation,
bounds, surface role, and material binding from package schema 3; it does not
infer or substitute any of those values. The pipeline identity is
`2026.08-tv-puck-light-clay-worker-v1`.

## Small Crown geometry audit and diagnostic capture v1

Phase 5 adds a renderer-neutral diagnostic path outside the authoritative
product graph. It does not replace the customer camera, mutate the verified
package, or use Blender to derive camera values or product geometry. The
accepted primary package and `beauty.webp` remain the customer-camera result;
the dedicated capture writes `crown-detail.webp` and a versioned
`crown-diagnostic.json` report under the same ignored local artifact directory.

The authoritative Small Crown source chain is explicit:

1. The fixture selects `small-crown`.
2. `guided-product-adapter.js` maps that option to `slim_cap`.
3. `CONSTRUCTION_RULES.slimCapProfileDrop` defines a 1.2 in drop, while
   `CONSTRUCTION_RULES.crownProfiles.slim_cap` defines 0.25 in side, 0.375 in
   front, and 0 in rear overhangs.
4. `CROWN_PROFILE_CATALOG.slim_cap.parts.slim_cap` supplies the
   `slim_beveled_cap` / `beveled_cap` renderer-neutral outline, with normalized
   height/projection coordinates of `(0, 0)`, `(1, 0)`, `(1, 1)`,
   `(0.82, 0.9)`, `(0.4, 0.55)`, and `(0, 0.3)`.

That chain produces one 117.5 × 1.2 × 0.375 in front run and two nominal
0.25 × 1.2 × 13.75 in side returns. The authored profile, total height,
projection, physical depth, renderer-neutral bounds, world-space Blender mesh,
and applied unit transforms agree. The straight-on customer camera does
compress the apparent projection, but the audit classification is
`GEOMETRY_DEFECT` because it also found a separate, measurable construction
defect: each complete return solid is contained by the corresponding solid
fitted filler. Each overlap is 2.6626875 in³ (0.00004363363 m³) using the exact
profile solid, with an enclosing AABB overlap of 4.125 in³
(0.000067596639 m³). This violates the construction standard's exposed-end
return rule, the `COMPONENT_COLLISION` invariant, and the guided-render rule
that a fitted filler is a full-volume solid rather than a visual surface.

That exact evidence authorized a source/composition-layer correction. For the
fitted TV01 composition only, a Small Crown return is now omitted when its full
authored solid is contained by the accepted full-height filler on the same side.
The unchanged 117.5 × 1.2 × 0.375 in front run remains authoritative. Standalone
Small Crown construction still emits the front run and both exposed-end returns;
a one-sided fitted composition retains the exposed return, and a partial
return/filler collision fails closed instead of clipping, resizing, rehosting,
or replacing the crown in Blender.

The corrected fitted graph has 57 total descriptors, 44 renderable components,
78 renderer-neutral/Blender submesh objects, 40 physical BOM components, and 43
accepted pricing-graph components. The eight Shaker doors, eight Black Pulls,
two 2.25 × 0.375 in pucks, continuous 117 × 1.25 × 14 in countertop, and seven
constraints remain unchanged. Pricing rates and the $15,050 accepted total also
remain unchanged.

The layer-specific identity change is explicit:

- geometry fingerprint:
  `jq-guided-geometry-v1-2J95JPTIW69O4` →
  `jq-guided-geometry-v1-028YPJG43EJF6`;
- specification fingerprint: `jq-guided-spec-v1-0qpej5s`;
- descriptor fingerprint: `jq-guided-snapshot-descriptors-v1-04xxijj`;
- Blender request key:
  `jq-blender-v1-93be24a7f4d9031edef36401f38c2168907688f19065d1d04e2b466f914f2272`
  →
  `jq-blender-v1-5f4d9e42925a4a9bd0593e1007523cbeed66d57112f5c5b1e65ddecb3704ead7`;
- primary package/render key:
  `jq-blender-package-v1-5af4ea52a32b54f80541e61d305e1ce1e4ce671c845cfce33a4980e080e6ad99`
  →
  `jq-blender-package-v1-f80f6b84cb804623613e3ecb55aa61461e71e7a4dc70816e37bae38bd5e5be15`.

The selection fingerprint remains `jq-guided-selection-v1-0mnaift`, the
material fingerprint remains `jq-guided-snapshot-materials-v1-1fs7psz`, and the
customer-camera fingerprint remains `jq-guided-snapshot-camera-v1-1kj9fv5`.
The customer camera, clay materials, exposure, world lighting, render settings,
pricing rates, and renderer-neutral crown profile are unchanged.

The capture contract has stable ID `crown-detail-qa-v1` and independent key
`jq-crown-detail-qa-v1-d57183ac1df8d49db962e9532e24e1f0c6ed9173963b46f62c8e5e258386a35b`
for the corrected fitted topology. Mandatory diagnostic Commit 1 used the
pre-correction key
`jq-crown-detail-qa-v1-7c79dd65dcbdf941301eee6fde8f56e05679caede2102a96e91db2e2683a7ba6`;
that immutable gate evidence remains cited in the version-2 diagnostic report.
Its camera ID is `crown-detail-qa-camera-v1`, with position
`(1.672575203881, 0.895637907763, 2.068209796119)`, target
`(1.317625, 0.1857375, 2.42316)`, up vector `(0, 0, 1)`, 50 mm lens, 36 mm
sensor width, 0.05 m / 25 m clipping planes, 1.2 framing margin, and 960 × 640
resolution. Framing is derived deterministically from the verified front-run
and fitted-filler termination bounds before Blender translation. The capture inherits the primary clay scene's
render settings, materials, exposure, room, and world lighting unchanged.

The mandatory diagnostic-only commit preserved the then-current geometry
fingerprint, primary package/render key, customer camera contract, primary
beauty bytes, component and billable quantities, BOM, and pricing. Its capture
key is deliberately separate so diagnostic cache identity cannot replace or
perturb the primary result. The subsequent correction changed only identities
that legitimately cover the corrected authoritative descriptor topology; it did
not change the customer-camera, material, pricing-rate, or render-setting
identities.

## Deterministic PBR materials v1

Phase 6 adds an offline, renderer-neutral material sidecar over the unchanged
Phase 5 geometry package. The sidecar never enters or rekeys the accepted clay
package. It resolves stable component, primitive, submesh, surface-group, and
source-slot identities before Blender starts; Blender may create material and
shader-node datablocks only. It may not create or alter meshes, modifiers,
transforms, cameras, lights, collections, constraints, room/world state, or
render settings. `materials-preview.webp` therefore remains a material QA
capture, not a customer beauty render or a production finish specification.

The material authority classification is `PREVIEW_ONLY_AUTHORIZED`.
`TV01-clear-wall-foundation.json#project.finish` selects `natural-oak`, while
`config/provisional-decisions.json#FINISH-AVAIL-001` explicitly describes the
wood/paint families as visualization-supported and manufacturing-unconfirmed.
`config/materials.json#natural-oak` and
`guided-materials.js#GUIDED_MATERIAL_MANIFEST.woods.natural-oak` provide the
Natural Oak identity, 24 × 48 in physical repeat, 0.58 roughness, and semantic
grain-orientation precedent, but describe the repository materials as
procedural visualization starters. No approved manufacturer swatch, physical
sample calibration, or complete production PBR specification exists. Phase 6
therefore uses the instruction-authorized `natural-oak-visualization-v1`
profile; `materialColorReferenceStatus` is `UNVERIFIED`,
`customerMaterialApproved` is `false`, and
`customerBeautyRenderApproved` is `false`.

### Sidecar identity and coverage

The package kind is `jq-render-material-package`, schema
`jq-render-material-package-v1`, schema version `1`, and descriptor schema
version `1`. Its independent version chain is:

- material library: `jq-pbr-material-library-v1`;
- procedural oak algorithm: `jq-procedural-natural-oak-v1`;
- material frame: `jq-material-frame-v1`;
- piece seed rule: `jq-material-piece-seed-sha256-v1`;
- shader topology: `jq-blender-pbr-node-topology-v1`;
- Blender translator: `jq-blender-material-translator-v1`;
- Blender translation policy: `jq-blender-material-translation-policy-v1`;
- material pipeline: `2026.08-deterministic-pbr-materials-v1`;
- capture ID: `materials-preview-v1`;
- result kind/schema: `jq-render-material-preview-result` / version `1`;
- material package key:
  `jq-render-material-package-v1-6d180ecff47487de4692620d5387b7bde3b827a5a0a5f6b4ad438cb6335d2794`;
- material preview capture key:
  `jq-materials-preview-v1-ea08c048092d14f80da06924ec82126c8edae36a388b785313bac02e763b91ea`.

The canonical material-package key covers the accepted base-geometry identity
and canonical package-content SHA-256
`f16e1e1ebc190090a3303ed13df6a6be6353760447fd692f30f1e04d25022a9b`,
all seven recipes, all bindings, and all material frames, seeds, offsets, and
mapping digests. Canonical object-key ordering is used;
timestamps, absolute paths, hostnames, process IDs, runtime ordering, and
documentation do not enter that key. The separate capture key additionally
covers the unchanged camera, room/world/light identities, inherited render
settings, exact Blender/GPU runtime, material pipeline, and WebP contract.

All 78 product submeshes and both room surfaces resolve exactly once, for 80
bindings total. The accepted counts are:

| Material ID | Bindings | Authorized targets |
| --- | ---: | --- |
| `natural-oak-visualization-v1` | 64 | Accepted visible wooden casework submeshes |
| `natural-oak-countertop-visualization-v1` | 1 | Continuous 117 in countertop |
| `matte-black-hardware-v1` | 10 | Eight Black Pulls and two puck housings |
| `tv-black-glass-v1` | 1 | Existing TV screen surface |
| `warm-opal-puck-lens-v1` | 2 | Existing circular puck-lens submeshes |
| `inherited-room-wall-clay-v1` | 1 | Existing rear-wall surface |
| `inherited-room-floor-clay-v1` | 1 | Existing floor surface |

The 65 wood bindings each have one independently keyed frame. Missing,
duplicate, conflicting, or unresolved bindings fail closed; room materials are
explicit and cannot be converted to oak by a generic material name.

### Exact material recipes

Every recipe declares `Linear Rec.709`, Blender `5.2`, no external resources,
and `trueDisplacement: false`. The two oak materials use shader topology
`jq-blender-pbr-node-topology-v1/procedural-oak`, package-world material-frame
coordinates, `baseColor: null`, metallic `0`, IOR `1.5`, alpha `1`, diffuse
roughness `0.2`, specular-IOR level `0.5`, anisotropy `0.05`, anisotropy
rotation `0`, coat IOR `1.5`, transmission `0`, `thinWall: false`, emission
color `(0, 0, 0, 1)`, and emission strength `0`. Their shared linear RGB ramp
is clamped with RGB/`NEAR` hue interpolation:

| Position | Linear RGBA |
| ---: | --- |
| 0 | `(0.40, 0.29, 0.18, 1)` |
| 0.34 | `(0.47, 0.36, 0.235, 1)` |
| 0.68 | `(0.55, 0.45, 0.31, 1)` |
| 1 | `(0.64, 0.55, 0.41, 1)` |

The complete oak variant tuning is:

| Material ID / recipe version | Roughness | Coat weight | Coat roughness | Grain scale | Grain mix | Tone range | Bump strength | Bump distance |
| --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| `natural-oak-visualization-v1` | 0.58 | 0.08 | 0.34 | 10 | 0.666666666667 | 0.49–0.65 | 0.12 | 0.00018 m |
| `natural-oak-countertop-visualization-v1` | 0.54 | 0.12 | 0.30 | 9 | 0.65 | 0.51–0.65 | 0.10 | 0.00016 m |

Both bumps are enabled, non-inverted, and driven only by
`fiber-noise-factor`. The shared procedural values are algorithm
`jq-procedural-natural-oak-v1`, coordinate space `PACKAGE_WORLD_METERS`, basis
order `CROSS_GRAIN_NORMAL`, and physical scales 0.6096 m cross-grain, 1.2192 m
along grain, and 0.0254 m normal. Coarse 4D noise is non-normalized with scale
2.2, detail 2, roughness 0.42, lacunarity 2, and distortion 0.05. Grain uses
`BANDS`/`X`/`SIN`, distortion 2.2, detail 3, detail scale 1.5, and detail
roughness 0.42. Fiber 4D noise is non-normalized with scale 72, detail 2,
roughness 0.48, lacunarity 2, and distortion 0. The mix is `MIX`, uses the
variant factor above, and clamps factors and colors. A package-defined linear
Map Range then maps input 0–1 into the variant tone range above, with clamp
enabled and explicit step value 4. This weighted tone field keeps directional
grain twice as influential as the coarse field while preventing either field
from producing black lobes or bright camouflage patches.

The other five materials use
`jq-blender-pbr-node-topology-v1/principled-flat`, coordinate policy `none`,
diffuse roughness `0`, specular-IOR level `0.5`, anisotropy `0`, anisotropy
rotation `0`, no procedural input, and a disabled non-inverted bump with
strength `0`, distance `0`, and source `none`:

| Material ID | Recipe / family | Base RGBA | Metallic | Roughness | IOR | Alpha | Coat weight / roughness / IOR | Transmission | Thin | Emission RGBA / strength | Color temperature |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- | ---: | --- | --- | ---: |
| `matte-black-hardware-v1` | `matte-black-coated-dielectric-v1` / coated hardware | `(0.014, 0.016, 0.018, 1)` | 0 | 0.47 | 1.5 | 1 | 0.16 / 0.40 / 1.5 | 0 | false | `(0, 0, 0, 1)` / 0 | null |
| `tv-black-glass-v1` | `tv-black-glass-v1` / dark glass | `(0.0035, 0.0045, 0.006, 1)` | 0 | 0.16 | 1.52 | 1 | 0.34 / 0.12 / 1.52 | 0.06 | true | `(0, 0, 0, 1)` / 0 | null |
| `warm-opal-puck-lens-v1` | `warm-opal-puck-lens-v1` / opal emissive | `(0.78, 0.56, 0.30, 1)` | 0 | 0.34 | 1.46 | 1 | 0.04 / 0.30 / 1.46 | 0.22 | false | `(1, 0.896269353374, 0.737910408773, 1)` / 6 | 2700 K |
| `inherited-room-wall-clay-v1` | `inherited-room-clay-v1` / inherited room clay | `(0.62, 0.58, 0.53, 1)` | 0 | 0.82 | 1.5 | 1 | 0 / 0 / 1.5 | 0 | false | `(0, 0, 0, 1)` / 0 | null |
| `inherited-room-floor-clay-v1` | `inherited-room-clay-v1` / inherited room clay | `(0.24, 0.21, 0.19, 1)` | 0 | 0.76 | 1.5 | 1 | 0 / 0 / 1.5 | 0 | false | `(0, 0, 0, 1)` / 0 | null |

The puck emission is not a discretionary preview value. It is derived from
`guided-blender-render-contract.js#warm-led`: sRGB `#fff3df`, strength `6`,
and `component.metadata.warmth` at 2700 K for both accepted puck components.
The sRGB source is converted with the standard piecewise transfer function to
the explicit Linear Rec.709 value in the table. A missing, duplicated, or
changed source recipe or puck warmth fails before sidecar generation.

### Blender translation policy

Worker-owned pixel-affecting constants are serialized under
`jq-blender-material-translation-policy-v1` and participate in the material
package and capture keys. Materials use nodes, `DITHERED` surface rendering,
and transparency overlap. Principled uses `MULTI_GGX`, weight 1, normal input
`(0,0,0)`, subsurface weight 0, radius `(1,0.2,0.1)`, scale 0.05, IOR 1.4,
anisotropy 0, white specular/coat/sheen tints, tangent and coat-normal inputs
`(0,0,0)`, sheen weight 0, sheen roughness 0.5, thin-film thickness 0, and
thin-film IOR 1.33. Procedural mapping uses the `Object` coordinate output
with no override object and `fromInstancer: false`; because every mesh is
authored in package-world meters with an identity transform, these are the
package-world coordinates required by each material frame.

Vector operations are explicitly `SUBTRACT`, `DOT_PRODUCT`, `DIVIDE`, and
`ADD`. Noise offset/gain are 0/1, Mix alpha is disabled, Map Range data type is
`FLOAT`, and the shader-only bump uses filter width 0.1 and normal input
`(0,0,0)`. Only the material output's Surface input may be linked. The worker
reads every created material, relevant property, unlinked socket, material
frame, and topology back from Blender before and after rendering. Both audits
produce SHA-256
`54ba4a5444fe595a05118146e33987fdffe0136ba8316a131ea821592d0ea36a`;
any mismatch fails closed.

### Material frames and grain semantics

Frames are authored before Blender translation from canonical construction
roles, never from Blender object names, object order, longest dimensions,
camera coordinates, generated coordinates, or randomized runtime state. Four
semantic right-handed bases prevent front members from receiving a shelf-style
mapping and side panels from receiving a front-style mapping:

- horizontal X: grain/cross/normal `(1,0,0)`, `(0,1,0)`, `(0,0,1)`;
- front X: `(1,0,0)`, `(0,0,1)`, `(0,-1,0)`;
- front Z: `(0,0,1)`, `(1,0,0)`, `(0,1,0)`;
- side Z: `(0,0,1)`, `(0,1,0)`, `(-1,0,0)`.

Each basis is finite, normalized, orthogonal, and right-handed. The origin is
the package `blenderWorldBounds.min`; physical scale is the
0.6096/1.2192/0.0254 m triple above. Mirrored parts keep separate right-handed
frames and scale `(1,1,1)`.

| Semantic role | Accepted `grainRole` | Package axis | Basis class |
| --- | --- | --- | --- |
| Shaker rails | `front_rail` | ±X | front X |
| Shaker stiles | `front_stile` | ±Z | front Z |
| Shaker fields | `front_field` | ±Z | front Z |
| Shelves | `shelf`, `fixed_shelf` | ±X | horizontal X |
| Countertop | `fixed_shelf` | ±X | horizontal X |
| Top/bottom horizontal panels | `top_panel`, `bottom_panel` | ±X | horizontal X |
| Horizontal toe/base | `base` | ±X | front X |
| Side/end panels | `side_panel` | ±Z | side Z |
| Dividers | `divider` | ±Z | side Z |
| Fitted fillers | `filler` | ±Z | front Z |
| Visible back panels | `back_panel`, `backing_panel` | ±Z | front Z |
| Front crown run | `crown` | ±X | front X |

Per-piece variation is
`SHA-256(jq-pbr-material-library-v1 NUL componentId NUL primitiveId NUL submeshId NUL surfaceGroupId)`.
The full digest is the mapping ID; its first eight hex digits are the unsigned
32-bit seed. Hex groups 8–15, 16–23, and 24–31 become the three phase offsets
after division by `0xffffffff` and 12-decimal rounding. Hex group 32–39 becomes
a deterministic color variation in [-0.012, 0.012], quantized to four decimal
places so JavaScript and Python canonical number serialization remain
identical. The mapping digest is the canonical SHA-256 of the complete frame
excluding only that digest itself. Reordering objects cannot change any seed,
frame, offset, or mapping digest.

### Capture, runtime, and output separation

The capture deep-copies the accepted `hero-front-v1` camera: position
`(0, 6.1722, 1.2192)` m, target `(0, 0.1905, 1.2192)` m, up `(0,0,1)`, 50 mm
lens, 36 mm horizontal sensor, 0.05/25 m clipping planes, 1.14 fit margin, and
960 × 640 resolution. It inherits `clear-wall-v1`, the unchanged warm-interior
HDR (`49db5b6e13c5b5239d8aca84c055c586dfc71aeaf1e1db64487f5bf8bab66db2`,
strength 0.65), an empty explicit light manifest, and the primary render
contract unchanged: `BLENDER_EEVEE_NEXT` / Blender RNA `BLENDER_EEVEE`, Eevee
internal device, 128 samples, shadows on, ray tracing and fast GI off, TAA
reprojection on, opaque film, sRGB/AgX/`AgX - Medium High Contrast`, exposure
0, gamma 1, and no curve mapping. Sampling seed, animated seed, and adaptive
sampling are explicitly not applicable to Eevee 5.2; the compositor and
denoiser are disabled. WebP is RGB, 8-bit, quality 90, `FOLLOW_SCENE`, at
960 × 640 with a 32 MiB cap. Resolution percentage is 100; pixel aspect is
1:1; file extension is enabled; compositing, sequencing, stamps, borders, and
crop-to-border are disabled; dither intensity is 1.

The runtime contract pins Blender `5.2.0 LTS`, build `fbe6228777e7`, Metal
backend, vendor `Apple M4`, `Metal API` renderer, and device version `1.2`.
Those strings are probed, serialized, validated, and included in the capture
key. Each run uses a fresh isolated temporary directory before publishing
verified outputs.

The final scene uses 70 bound materials: 68 newly created package-driven PBR
datablocks plus the two validated inherited room-clay datablocks. Blender has
74 material datablocks immediately before save because the four source product
clay materials remain unmodified and unused; those zero-user datablocks are
not retained when the material-preview blend is reopened, whose exact material
count is therefore 70. There are zero node groups, 1,115 material nodes, and
1,305 links. The material path creates no mesh, modifier, camera, light,
collection, or constraint.

The material path preserves, rather than overwrites:

- geometry fingerprint `jq-guided-geometry-v1-028YPJG43EJF6`;
- primary package/render key
  `jq-blender-package-v1-f80f6b84cb804623613e3ecb55aa61461e71e7a4dc70816e37bae38bd5e5be15`;
- clay pipeline `2026.08-tv-puck-light-clay-worker-v1`;
- `beauty.webp`, 960 × 640, 7,400 bytes, SHA-256
  `ae544cc51ed2a06377fd7cc7d433fe27309c0eb97cccffecfc5ad2c7f4af0d5b`;
- crown QA key
  `jq-crown-detail-qa-v1-d57183ac1df8d49db962e9532e24e1f0c6ed9173963b46f62c8e5e258386a35b`;
- `crown-detail.webp`, 960 × 640, 9,032 bytes, SHA-256
  `c30b1de091024e330448eced13ab09887e994f7bf41ee7355a95e62748ab3429`.

New ignored local outputs are `materials-package.json`,
`materials-preview.webp`, `materials-preview-result.json`,
`materials-preview-report.json`, and `TV01-materials-preview.blend` under
`artifacts/blender-clay-worker/TV01/`. The preview is 960 × 640,
10,692 bytes, SHA-256
`61504a822032c55d0f478746c80e5e6e76f13d03fc776db67935a5b63aa935ae`.
It is generated with `npm run blender:materials-preview`; it does not overwrite
`beauty.webp`, `result.json`, or `TV01-clay.blend`. At the accepted straight-on
customer camera, large vertical fields show restrained vertical grain. The
thin rails, shelf edges, countertop top, and crown face do not expose enough
pixel area to judge every horizontal mapping visually; their X-grain semantic
frames and package-to-Blender parity are therefore verified numerically. The
result is a material-validation preview, not an approved Natural Oak sample or
the deferred final presentation render.

Manufacturer-approved Natural Oak matching, external scanned PBR texture sets,
Clear-UV maple separation, room PBR materials, a new HDRI/environment,
presentation lighting, presentation camera, interior styling, a final
photoreal customer render, TV Unit + Left/Right Niche compatibility, customer
approval, publication, and deployment all remain deferred.

## Remaining non-geometry blockers

- Clear-UV prefinished maple is fixed for hidden cabinet interiors, but the
  current descriptor graph does not distinguish those surfaces reliably from
  exposed oak backing. The Blender package therefore records both semantic
  mapping and scanned-PBR authoring as blockers instead of recoloring exposed
  surfaces or pretending the assignment is solved.
- Existing wood and paint textures remain procedural starters until calibrated
  against physical John Quinn samples.
- Camera, HDRI/room shell, color pipeline, and Blender version must be locked by
  a reviewed reference render before the worker is production-ready.
- The Small Crown return/fitted-filler collision is corrected at the
  source/composition layer. Customer-camera readability remains a separate
  visual limitation because the straight-on view compresses the 0.375 in crown
  projection; Phase 5 does not move that camera.
- TV Unit + Left/Right Niche compatibility remains deferred to a separate
  phase.

Production finish approval remains blocked by those semantic and
reference-review requirements. Phase 6 authorizes only the deterministic
Natural Oak visualization profile documented above; it does not authorize a
manufacturer color match, paint, clear-UV-maple production materials, or a
customer beauty render. `customerMaterialApproved` and
`customerBeautyRenderApproved` remain `false`.

## Local clay worker

The local-only Blender 5.2 clay translator renders the committed TV01 fixture,
including the package-defined circular puck housings and lenses. Run it from
the repository root:

```sh
npm run blender:clay
```

`BLENDER_BIN` may point to another Blender executable; otherwise the runner uses
`/Applications/Blender.app/Contents/MacOS/Blender`. The command always rebuilds
the compact job and authoritative package through the JQ JavaScript engine,
validates the package, starts Blender with `--background --factory-startup`, and
then validates both `result.json` and the actual WebP bytes. Generated files live
under the ignored `artifacts/blender-clay-worker/TV01/` directory.

The package keeps the semantic engine name `BLENDER_EEVEE_NEXT`. Blender 5.2
exposes that engine through the RNA identifier `BLENDER_EEVEE`, so both values
are explicit in the cache-bound render settings and the worker accepts only
that exact mapping. Clay recipes, room surfaces, floor extent, HDR color space
and orientation, WebP settings, transparency, sampling, and AgX settings are
also versioned package data rather than worker defaults.

This command does not connect Blender to Steps 1–5, approve a customer beauty
render, or assign production wood, paint, or clear-UV-maple materials.

## Next implementation slice

The next presentation phase may add a separately versioned environment,
presentation lighting, presentation camera, interior styling, and final-render
capture without changing the accepted product geometry or this material
sidecar. Manufacturer sample matching, clear-UV-maple surface separation, a
gateway, browser integration, customer approval, and production publication
remain separate deferred work.

Mozaik remains the production/CNC authority. This render pipeline is for exact,
high-quality customer visualization and does not replace shop validation.
