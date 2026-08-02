# JQ Bookcases Blender render foundation

Status: foundation v1 implemented for **TV Unit + Clear Wall + fitted installation**.
It is a prototype render boundary, not yet a customer-approved beauty-render path.

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

## First prototype contract

The committed `TV01-clear-wall-foundation` fixture currently resolves:

- 120 × 96 × 14 in room input;
- 117 × 96 × 14 in fitted casework;
- 1.5 in fillers on each side;
- 56 × 33 in TV body and 60 × 37 in service opening;
- 39 renderable components and seven non-renderable opening/clearance constraints.

These figures prove transport and coordinate integrity only. They do **not**
approve the current TV elevation as John Quinn's production template.

## Explicit approval blockers

- The current engine creates three upper sections and seven flat lower doors.
  John's Drawing 4 reference appears closer to four upper bays, a TV spanning
  the middle bays, eight framed lower doors, and a continuous countertop. John
  must approve the elevation/clay render before a customer beauty image is
  enabled.
- Clear-UV prefinished maple is fixed for hidden cabinet interiors, but the
  current descriptor graph does not distinguish those surfaces reliably from
  exposed oak backing. The Blender package therefore records both semantic
  mapping and scanned-PBR authoring as blockers instead of recoloring exposed
  surfaces or pretending the assignment is solved.
- Existing wood and paint textures remain procedural starters until calibrated
  against physical John Quinn samples.
- Camera, HDRI/room shell, color pipeline, and Blender version must be locked by
  a reviewed reference render before the worker is production-ready.

## Local clay worker

Phase 2 adds a local-only Blender 5.2 clay translator for the committed TV01
fixture. Run it from the repository root:

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

1. Confirm the TV elevation rules with John and encode them in the JQ product
   adapter/engine, not in Blender Python.
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
