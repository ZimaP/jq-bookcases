# Guided Room 2 Fixed-Reference Scene

## Purpose and release boundary

The public guided configurator keeps the accepted four-step journey: Choose
Product, Choose Layout, Customization, and Review & Details. This release makes
Cabinets + Shelves / Fireplace Wall the only active public product-layout pair
and displays the exact, self-contained SketchUp-derived Room 2 GLB for that
pair. No other product, layout, preset, draft, query, hash, or injected state
may enter this viewer path.

The model is a fixed reference design. Measurements, Finish, hardware,
lighting, and detail values continue to validate, save, reload, and appear in
the project summary. Finish alone replaces runtime material properties on the
118 primitives proven by the checked-in material-3 authority. It never changes
the GLB bytes, source accessors, geometry, indices, transforms, hierarchy,
bounds, or dimensions. Dimensions, hardware, lighting, and Details remain saved
project data and do not deform, scale, regenerate, relight, or replace the GLB.
Customer-visible disclosures name this boundary. The digital appearance is
provisional, is not a calibrated or approved physical sample, and owner
appearance acceptance remains open.

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
| Accessors / vertices / triangles | `556 / 33,934 / 18,306` |
| Materials / textures / images | `8 / 6 / 6` |
| Embedded-image aggregate digest | `6c737d2ff899087b3227f9202dcf95c874474d65dfbc6ec83c778748feced153` |

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
public legacy-compatible runtime-material snapshot plus an exhaustive v2
public-appearance snapshot and requires both to remain stable across clean
loads and all deferred-control edits. It also hashes each embedded image
bufferView and the texture-to-image assignments; no network image may replace
those six payloads.

## Viewer session and loading contract

A viewer session lasts for the mounted configurator in one document. On first
Customization entry, `guided-configurator.js` lazily imports
`guided-room2-viewer.js`, which creates exactly one controller, renderer,
canvas, camera, scene, resize owner, control-listener set, and parsed GLB root.
It issues one same-origin model request and parses once. The same canvas moves
between Customization and Review & Details; tab changes, browser history, and
saved-project restoration within that document do not remount or reparse it.

The viewer preloads only the selected/saved Finish family and the local neutral
HDR environment before reveal, reports bounded loading progress, validates byte
length and SHA-256, audits the self-contained GLB schema and raw materials,
parses with the pinned local Three.js r166 `GLTFLoader`, and validates source
bounds and identity transforms before display. Other finish families load once
on first selection, apply atomically, and stay cached for that viewer session;
a failed family may retry only after an explicit re-selection. A failure stays
visible and fail-closed. The viewer never shows a wrong named Finish, the old
generated scene, a photograph, or another model.

Orbit, zoom, keyboard operation, and Reset affect only the camera. Camera pose
persists across controls, tabs, Review, Back/Forward, and deferred project edits;
only Reset restores the configured fit view. Responsive host changes update the
projection aspect and may increase the fit distance before user interaction,
without transforming the model.

A full document reload, explicit configurator teardown, or navigation away ends
the session. Teardown aborts abort-capable GLB and HDR requests, cancels pending frames,
disconnects resize and input ownership, disposes source and owned cloned
materials/textures, the retained PMREM target, model GPU resources, and the
renderer, removes the canvas, and loses the WebGL context. TextureLoader results
that complete after teardown are disposed and never bound. A later document mount
begins a new session.

## Geometry immutability and runtime material ownership

The parsed `gltf.scene` is attached directly to the presentation scene. The
viewer does not set a wrapper scale, rotate the root, alter local/world node
matrices, replace geometry, change any source accessor, de-index a primitive,
split or duplicate vertices, append tangents, or replace UVs. Runtime identity
checks retain each geometry, index, attribute array/count, transform, bounds,
triangle winding, and topology.

`config/room2-commercial-pbr-v1-semantic-audit.json` deterministically records
all 185 primitives by scene/node-index path, mesh/primitive ordinal, original
material index, accessors and hashes, transforms, and bounds. Exactly 118
material-3 primitives are `PROVEN` Finish targets; the other 67 stable slots are
`PROVISIONAL`, and none is unmapped. There is no separate authoritative
surround/hearth slot, so the combined fireplace body remains one material zone.

`guided-room2-materials.js` clones only runtime materials. It preserves alpha,
sidedness, depth, visibility, and original slot cardinality; forces wood,
paint, room shell, floor, fireplace, and fire to metalness zero; and isolates
metalness to the deterministically mapped, `PROVISIONAL` hardware-only slots.
Authored UV0 is retained on every
Finish target. Shared texture sources receive deterministic role-specific
rotation and stable cut phase transforms, with no mirroring or duplicate
network payload. The r166 derivative tangent basis is used; no tangent attribute
is appended.

`guided-room2-integrity.js` records the immutable source material/container
contracts and deferred-model snapshot. `guided-room2-materials.js` separately
records the exhaustive versioned runtime appearance fingerprint expected to
change across Finish selections while the source and runtime geometry
fingerprints remain equal. Browser tests compare those contracts, the parsed
root and viewer/controller identities, asset URL, camera pose, request counts,
and lifecycle ownership before and after Finish, deferred edits, history, and
reload.

## Project transaction and persistence boundary

The existing room-topology, installation-fit, product, and project engines
continue to validate project data and preserve the last accepted specification.
A rejected candidate reports its named diagnostic and cannot replace that saved
snapshot. For this fixed-reference phase, only the normalized Finish ID is sent
to the viewer, where it is constrained to proven material-3 coverage. Accepted
descriptor geometry, dimensions, hardware, customer lighting selections, and
Details are deliberately not sent to scene construction.

Schema-v4 normalization continues to migrate legacy five-step positions as
1→1, 2→2, 3/4→3, and 5→4. Current and maximum visited steps remain bounded by
the active selection. Unsupported saved products and layouts remain stored,
are marked unavailable, and route to Choose Product or Choose Layout; they are
never deleted, coerced, or shown with the Room 2 model.

## Provisional appearance ownership

`guided-room2-appearance.js` is the single versioned production configuration
for the presentation around the immutable GLB. The active profile is
`room2-commercial-pbr-v1`. It owns the deterministic semantic material map,
Finish-family recipes and physical texture scales, renderer/output settings,
local environment and light rig, static shadow contract, semantic hero bounds,
and bounded camera fit/orbit behavior. It does not own product geometry,
dimensions, construction, price, hardware selection, or customer lighting
choices. Evidence-only presentation and material-zone mask overrides are
restricted to loopback hosts and are not a customer control. Its status is
`PROVISIONAL DIGITAL APPEARANCE — OWNER ACCEPTANCE OPEN`; it must not be
described as final, calibrated, finish-accurate, VividWorks-equivalent, or owner
approved.

Oak, walnut, and paint families use local 512 × 512 WebP sidecars recorded in
`config/room2-commercial-pbr-v1-assets.json`. Base color is sRGB; normal and
roughness maps use `NoColorSpace`; full mip chains are generated locally; and
anisotropy is capability-clamped to 8 for desktop/tablet and 4 for phone. Oak
uses aligned base-color, OpenGL normal, and roughness maps at 2.4384 m per
repeat. Walnut uses aligned base color and roughness at 2.4384 m per repeat and
no normal map. Paint uses only restrained normal/roughness microtexture at
0.0762 m per repeat and can never receive a wood map. KTX2 is disabled because
the repository has no pinned encoder; the measured local WebP path is the
explicit fallback. Asset source, license, author, source and derivative hashes,
commands, dimensions, roles, and attribution are checked in with the assets.

The active public backend is the pinned Three.js r166 `WebGLRenderer` on
WebGL2; this repository does not define a WebGPU/fallback pair for this viewer.
Color management is explicitly enabled with Linear-sRGB as the working space
and exactly one sRGB canvas output transform. Matched ACES Filmic and Neutral
sweeps were compiled and captured after material binding; the selected profile
uses Three.js Neutral tone mapping at exposure `1.02`. Post-processing and GTAO
remain disabled, so the one beauty pass owns the output transform.

Indirect light is generated locally once per viewer from the byte-locked
`assets/environments/jq-neutral-studio.hdr` through `RGBELoader` and one
`PMREMGenerator` pass. The source texture and generator are disposed after
generation; the retained target is owned by the viewer and disposed at
teardown. It is assigned to `scene.environment`, never the visible background.

The same-version `RectAreaLightUniformsLib.init()` runs exactly once before
material compilation. Two scene-space semantic roles create three direct light
objects: a `5.2` broad key RectAreaLight with a compensated `0.42`
DirectionalLight shadow proxy, and a `2.15` broad fill RectAreaLight. Area
lights never cast shadows. Only the proxy casts; its frustum is fitted to the
full authoritative scene bounds, map size is `2048` for desktop/tablet and `1024` for the
constrained-phone tier, and the static map refreshes once after model load (or
after a genuine tier change), never on camera orbit. Rendering remains on
demand with no permanent animation loop.

The semantic hero bounds exclude wall/floor/ceiling extents and retain
millwork, hardware, fireplace, and fire. The perspective camera uses a 35 mm
film gauge, 39° field of view (`49.418475` mm focal length), deterministic reset,
and projected width targets of `0.83`, `0.87`, and `0.92` for desktop, tablet,
and phone respectively. Phone preview controls occupy a separate rail below the
canvas instead of covering the hero.

## Production artifact and network boundary

The static artifact allowlist includes the Room 2 appearance, integrity,
material, and viewer modules; the semantic and provenance manifests; local
licensed texture/HDR assets and notices; the existing Three.js core; matching
r166 `GLTFLoader`, `RGBELoader`, `RectAreaLightUniformsLib`, and license; and the
exact GLB. Pre-upload assertions byte-lock new production assets and check the
model path, regular-file status, byte length, SHA-256, and non-LFS header. The
old guided parametric scene plan and renderer are intentionally absent from the
public artifact.

All model, material, HDR, and runtime requests are same-origin. There is no CDN,
hotlink, remote model host, analytics endpoint, fallback image request, second
Three.js runtime, or external GLB buffer/texture request in this path.

## File ownership

- `guided-configurator-data.js` — strict active product/layout policy and the
  retained project catalogs.
- `guided-configurator-state.js` — normalization, validation, unavailable-state
  preservation, accepted snapshots, persistence, and summaries.
- `guided-configurator.js` — four-step orchestration, deferred disclosures, and
  movement of one viewer session between steps 3–4.
- `guided-room2-appearance.js` — provisional semantic/material/presentation
  profile and immutable hero/camera contract.
- `guided-room2-materials.js` — Finish-family loading, runtime material binding,
  texture transforms, fingerprints, and resource disposal.
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
- `config/room2-commercial-pbr-v1-semantic-audit.json` — exhaustive stable
  primitive/material/UV/edge inventory.
- `config/room2-commercial-pbr-v1-assets.json` and
  `assets/room2-commercial-pbr-v1/ASSET-LICENSES.md` — source, license,
  attribution, transform, role, byte, and hash provenance.
