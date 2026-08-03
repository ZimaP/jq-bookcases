# JQ Bookcases Blender render foundation

Status: Drawing 4 geometry v1, circular puck-light primitive v1, and the Small
Crown diagnostic capture implemented for the internal **TV Unit + Clear Wall +
fitted installation** prototype. It remains a clay-render boundary, not a
customer-approved beauty-render path.

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
- 46 renderable components, 80 renderer-neutral/Blender submesh objects, and
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

The evidence authorizes a later correction at the canonical source/composition
layer. No crown dimensions, profile points, Blender transforms, customer camera,
or product identities are changed by this diagnostic commit. The correction
must remove the proved source-layer contradiction without resizing, clipping,
or replacing the crown in Blender.

The capture contract has stable ID `crown-detail-qa-v1` and independent key
`jq-crown-detail-qa-v1-7c79dd65dcbdf941301eee6fde8f56e05679caede2102a96e91db2e2683a7ba6`.
Its camera ID is `crown-detail-qa-camera-v1`, with position
`(1.672575203881, 0.895637907763, 2.068209796119)`, target
`(1.317625, 0.1857375, 2.42316)`, up vector `(0, 0, 1)`, 50 mm lens, 36 mm
sensor width, 0.05 m / 25 m clipping planes, 1.2 framing margin, and 960 × 640
resolution. Framing is derived deterministically from the verified crown bounds
before Blender translation. The capture inherits the primary clay scene's
render settings, materials, exposure, room, and world lighting unchanged.

Diagnostic-only execution preserves the geometry fingerprint, primary package
and render key, customer camera contract, primary beauty bytes, component and
billable quantities, BOM, and pricing. The capture key is deliberately separate
so diagnostic cache identity cannot replace or perturb the primary result.

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
- The Small Crown audit proves a source-layer return/fitted-filler collision.
  Its exact correction remains a later commit, separate from the diagnostic
  capture. Customer-camera readability remains a separate visual limitation;
  Phase 5 does not move that camera.
- TV Unit + Left/Right Niche compatibility remains deferred to a separate
  phase.

Production PBR/material authoring remains blocked by those semantic and
reference-review requirements. Phase 5 does not authorize natural-oak, paint,
or clear-UV-maple production materials, and
`customerBeautyRenderApproved` remains `false`.

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

1. Correct the proved Small Crown return/fitted-filler contradiction at its
   canonical source/composition layer, preserving the accepted profile and
   customer camera.
2. Author the clear-UV maple material and the versioned Clear Wall room/camera
   scene.
3. Implement the Node gateway against the committed package schema. The gateway
   must enforce the 16 KiB job-body limit, apply
   per-pass object-size limits, and verify object-storage `HEAD` metadata,
   content type, byte count, and SHA-256 before returning a succeeded result.
4. Generate and review a neutral clay render first; only after geometry approval
   produce the natural-oak beauty render.
5. Add the asynchronous Step 4 image state with render-key stale-response checks
   and the existing Three.js fallback.

Mozaik remains the production/CNC authority. This render pipeline is for exact,
high-quality customer visualization and does not replace shop validation.
