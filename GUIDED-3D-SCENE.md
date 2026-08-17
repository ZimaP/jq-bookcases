# Guided Room 2 Fixed-Reference Scene

## Purpose and release boundary

The public guided configurator keeps the accepted four-step journey: Choose
Product, Choose Layout, Customization, and Review & Details. This release makes
Cabinets + Shelves / Fireplace Wall the only active public product-layout pair
and displays the exact, self-contained SketchUp-derived Room 2 GLB for that
pair. No other product, layout, preset, draft, query, hash, or injected state
may enter this viewer path.

The model is a fixed reference design. Measurements, finish, hardware,
lighting, and detail values continue to validate, save, reload, and appear in
the project summary, but they do not deform, scale, regenerate, recolor,
relight, or replace the GLB. Customer-visible disclosures state that these
connections are deferred. The presentation is provisional and owner appearance
acceptance remains open.

The reference view is not a shop drawing, site verification, finish sample,
structural approval, manufacturing authorization, BOM, or price. Final field
conditions and all project decisions still require JQ Bookcases review.

## Exact asset contract

The public asset is
`assets/models/room2/Room2-Fireplace-bookcases-source-v1.glb`.

| Property | Required value |
| --- | --- |
| Bytes | `6,712,076` |
| SHA-256 | `251af4f7cb669976dec9dcaa46905982f9ae085b7bfb30e27e1bf9900a01a8d5` |
| Geometry fingerprint | `8762fe4326e22e46a163343e5fde410e231d651b48d1b1c9be8391febec8f6ff` |
| Raw material digest | `b31d96b3a248fb8d33af236e6e03f414481c907553cbcfbf482ca58a0109676d` |
| Scenes / nodes / meshes / primitives | `1 / 455 / 185 / 185` |
| Materials / textures / images | `8 / 6 / 6` |

It is a regular, non-symlink GLB, not a Git LFS pointer. Its one buffer and all
six images are embedded; the container declares no external URI. Source,
committed, prepared-artifact, and freshly downloaded live bytes must remain
byte-identical. The GLB must never be optimized, converted, re-exported,
embedded in JavaScript, or modified in place.

The source-branch fingerprint implementation is `room2-glb-integrity.js`
(SHA-256
`a9a5f2cb758872d9913104d3b256f4e31becf1156749cd15c446c45c10537d19`).
The source-branch raw/runtime material authority implementation is
`renderer-v1/material-authority.js` (SHA-256
`659f79b763685acae2cf969127c385e49624d03960d28369db1b3f57eb2d7aaf`).
Release evidence records the exact commands used against each byte source.

The preserved source branch has its own Three.js r185 runtime-material digest.
That value remains preservation evidence, not an equality gate for this public
Three.js r166 runtime. `guided-room2-integrity.js` independently records the
public runtime-material snapshot and requires it to remain stable across clean
loads and all deferred-control edits.

## Viewer session and loading contract

A viewer session lasts for the mounted configurator in one document. On first
Customization entry, `guided-configurator.js` lazily imports
`guided-room2-viewer.js`, which creates exactly one controller, renderer,
canvas, camera, scene, resize owner, control-listener set, and parsed GLB root.
It issues one same-origin model request and parses once. The same canvas moves
between Customization and Review & Details; tab changes, browser history, and
saved-project restoration within that document do not remount or reparse it.

The viewer reports bounded loading progress, validates byte length and SHA-256,
audits the self-contained GLB schema and raw materials, parses with the pinned
local Three.js r166 `GLTFLoader`, and validates the source bounds and identity
root transform before display. A failure stays visible and fail-closed. It does
not import or display the old generated scene, a photograph, or another model.

Orbit, zoom, keyboard operation, and Reset affect only the camera. Camera pose
persists across controls, tabs, Review, Back/Forward, and deferred project edits;
only Reset restores the configured fit view. Responsive host changes update the
projection aspect and may increase the fit distance before user interaction,
without transforming the model.

A full document reload, explicit configurator teardown, or navigation away ends
the session. Teardown aborts an in-flight request, cancels pending frames,
disconnects resize and input ownership, disposes model/ground GPU resources and
the renderer, removes the canvas, and loses the WebGL context. A later document
mount begins a new session.

## Model and material immutability

The parsed `gltf.scene` is attached directly to the presentation scene. The
viewer does not set a wrapper scale, rotate the root, alter local/world node
matrices, replace geometry, or change material/texture properties or slots.
Mesh `castShadow` and `receiveShadow` flags are presentation metadata only; the
embedded geometry and material assignments remain untouched.

`guided-room2-integrity.js` creates two deterministic runtime contracts:

- the runtime-material snapshot records every material property and texture
  association produced by the pinned loader;
- the deferred-model snapshot records object identity locators, node and mesh
  counts, geometry associations and attributes, local/world matrices, and
  material slots.

Browser tests compare these contracts, the parsed root identity, asset URL,
viewer/controller identity, and camera pose before and after every class of
deferred edit. Project edits may change saved data and summaries only.

## Project transaction and persistence boundary

The existing room-topology, installation-fit, product, and project engines
continue to validate project data and preserve the last accepted specification.
A rejected candidate reports its named diagnostic and cannot replace that saved
snapshot. For this fixed-reference phase, accepted descriptor geometry and
material choices are deliberately not sent to the viewer.

Schema-v4 normalization continues to migrate legacy five-step positions as
1→1, 2→2, 3/4→3, and 5→4. Current and maximum visited steps remain bounded by
the active selection. Unsupported saved products and layouts remain stored,
are marked unavailable, and route to Choose Product or Choose Layout; they are
never deleted, coerced, or shown with the Room 2 model.

## Provisional appearance ownership

`guided-room2-appearance.js` is the single versioned production configuration
for the presentation around the immutable GLB. It may own only:

- background and a flat, non-repeating ground;
- renderer output color space, tone mapping, exposure, and shadow mode;
- a small deterministic local light rig; and
- the default fit camera and bounded orbit/zoom limits.

It does not own or mutate runtime materials, texture assignments, product
geometry, or customer finish/lighting values. It exposes no customer debug
panel. Its status is `PROVISIONAL — OWNER ACCEPTANCE OPEN`; it must not be
described as final, photorealistic, finish-accurate, or owner approved.

## Production artifact and network boundary

The static artifact allowlist includes the three Room 2 runtime modules, the
existing local Three.js core, matching r166 `GLTFLoader` and
`BufferGeometryUtils`, and the exact GLB. Pre-upload assertions check the model
path, regular-file status, byte length, SHA-256, and non-LFS header. The old
guided parametric scene plan and renderer are intentionally absent from the
public artifact.

All model and runtime requests are same-origin. There is no CDN, remote model
host, analytics endpoint, fallback image request, second Three.js runtime, or
external GLB buffer/texture request in this path.

## File ownership

- `guided-configurator-data.js` — strict active product/layout policy and the
  retained project catalogs.
- `guided-configurator-state.js` — normalization, validation, unavailable-state
  preservation, accepted snapshots, persistence, and summaries.
- `guided-configurator.js` — four-step orchestration, deferred disclosures, and
  movement of one viewer session between steps 3–4.
- `guided-room2-appearance.js` — provisional presentation-only configuration.
- `guided-room2-integrity.js` — GLB and deterministic runtime snapshot checks.
- `guided-room2-viewer.js` — exact asset load, pinned GLTF parse, camera,
  interaction, one-session ownership, diagnostics, and disposal.
- `guided-room-topology.js`, `guided-installation-solver.js`,
  `guided-product-adapter.js`, `guided-product-engine.js`, and
  `guided-project-engine.js` — project-data validation and transaction state;
  not public GLB geometry generation in this phase.
- `guided-scene-plan.js`, `guided-configurator-3d.js`, and
  `guided-materials.js` — retained internal parametric contracts; excluded from
  the active public Room 2 runtime path.
