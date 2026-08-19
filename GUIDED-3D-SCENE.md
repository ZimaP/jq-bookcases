# Guided Immersive Layout Scene

## Release boundary

The public journey is Choose Product, Choose Layout, Customization, and Review
& Details. Cabinets + Shelves is the only active product. Fireplace Wall, Door
Wall, and Window Wall are its three active layouts. Each layout displays one
exact authoritative GLB and exposes one PROVEN preview-only smart dimension.

These models are interactive references, not shop drawings, site verification,
finish samples, structural approvals, manufacturing authorization, BOMs, or
prices. The current web appearance is provisional. It does not claim calibrated
finish accuracy, owner approval, or parity with the excluded Blender/Cycles
lookdev derivative.

## Exact authoritative assets

| Layout | Authoritative/runtime path | Bytes | SHA-256 | Nodes / primitives / triangles |
| --- | --- | ---: | --- | ---: |
| Fireplace Wall | `assets/models/room2/Room2-Fireplace-bookcases-source-v1.glb` | 6,712,076 | `251af4f7cb669976dec9dcaa46905982f9ae085b7bfb30e27e1bf9900a01a8d5` | 455 / 185 / 18,306 |
| Door Wall | `assets/models/room2/jq-door-wall-bookcase-room2-authoritative-v01.glb` | 6,755,128 | `4969169cb29bcf51a72a2db6c4cd83631cd94c7d78154bc37558ee9adaba98cb` | 317 / 127 / 15,017 |
| Window Wall | `assets/models/room4/jq-window-wall-bookcases-cabinets-room4-authoritative-v01.glb` | 6,993,036 | `631005c025324c5162de6e414267101d6260d58c6198d561e6799568cef1fd24` | 442 / 182 / 19,244 |

All three files are direct, self-contained SimLab glTF 2.0 sources. They retain
`KHR_materials_pbrSpecularGlossiness` and load without conversion. There is no
runtime derivative, external buffer/image URI, optimization, decimation,
quantization, compression, re-export, or source mutation. The generated model
audit records complete hierarchy, native transforms, bounds, accessors,
materials, images, textures, UVs, normals, topology, and uncertainty.

The accepted existing-tool source-contract fingerprints are:

- Fireplace:
  `8762fe4326e22e46a163343e5fde410e231d651b48d1b1c9be8391febec8f6ff`
- Door:
  `302ad57c1f7360966fb42714b2fd8c519f64856586eba632bf2f89427f2bc4d8`
- Window:
  `0f339076140a88e3942b220fcb217bbf3133876717149cba0522bc1e0b539e9c`

`config/immersive-layout-model-audit-v1.json` and
`guided-layout-registry.js` are generated/checked against those exact bytes.

## Registry, loading, and ownership

`guided-layout-registry.js` is the shared authority for each layout's product
ID, exact source/runtime identity, source metadata, native and hero bounds,
camera, orbit target, thumbnail, semantic anchors, appearance manifest,
geometry-control manifest, backend support, and dimension support matrix.
Layout selection is registry-driven rather than scattered layout conditionals.

`guided-layout-viewer.js` is the only public viewer controller. It lazy-loads
only the selected model, enforces same-origin final URLs, MIME type, maximum
stream length, byte length, SHA-256, self-contained glTF structure, source
bounds, and stable semantic identity before reveal. It parses the selected
asset with the pinned local Three.js r166 loader.

Customization and Review reuse the same controller, renderer, canvas, camera,
scene, and currently parsed root. Finish/tab/project rerenders reparent the
existing runtime instead of creating a second canvas. A layout change aborts
stale requests and renders, remembers camera state under the old layout,
disposes the prior model's geometry/material/texture ownership, and parses only
the new exact asset. A document teardown also aborts HDR/model work, cancels
frames, disconnects listeners/observers, disposes render targets and renderer,
removes the canvas, and clears pointer state.

Loading, integrity, parse, Finish, and renderer failures are visible and
recoverable. Generation and sequence guards prevent stale model, Finish,
environment, or render work from changing a newer selection. Failure never
substitutes a photograph, the old generated scene, or another layout.

## Renderer and camera contract

The viewer prefers WebGPU only after a real adapter/backend is proven. Forced
WebGL2 and automatic WebGL2 fallback are supported release paths. Initialization
and render failures demote atomically, preserve the full journey timer, dispose
the failed backend, reload the latest selected layout once, and retain one
controller/canvas/model owner. Diagnostics report the actual backend, fallback
reason, first-usable time, render-failure count, draw/triangle totals, retained
geometry/material/texture/render-target resources, requests/parses, and
lifecycle ownership.

Camera interaction includes pointer orbit, native touch orbit, two-pointer pinch,
wheel/button zoom, keyboard controls, Fit, Reset, Front, Left, and Right views.
Bounds differ by layout, so pose is remembered separately per layout. The
semantic hero bounds, not the architectural shell, drive fitting. Desktop gives
the model at least 70% of content width; tablet and mobile use an adaptive sheet
that reserves visible model context. On-model dimension interaction cannot
orbit the camera, and camera interaction cannot change the dimension.

## PROVEN smart-dimension authority

Each layout provides the same customer-facing control,
`adjustable-shelf-clearance`, but each record names its own exact anchors and
target node. The control is a rigid local-Z translation of one unique
`Adjustable Shelf` group between two fixed adjacent shelves.

| Layout | Lower / target / upper node | Minimum | Native | Maximum |
| --- | --- | ---: | ---: | ---: |
| Fireplace Wall | 401 / 429 / 405 | 0 mm | 265.500022 mm | 531.000043 mm |
| Door Wall | 130 / 138 / 140 | 0 mm | 304.800045 mm | 609.599993 mm |
| Window Wall | 247 / 249 / 251 | 0 mm | 304.800045 mm | 609.599993 mm |

The common finite formula is:

```text
target.translation.z =
  nativeTranslationZ +
  (clearanceMm - nativeClearanceMm) /
  (1000 * 0.02539999969303608)
```

Zero is the lower anchor's top face. Maximum is the fixed upper anchor's bottom
face minus lower top and target thickness. At endpoints the shelf faces may
touch but never volumetrically penetrate. Range values are derived from the
source geometry; no percentage range or manufacturing clearance is inferred.

Only the target node's local `translation.z` changes. Source buffers, topology,
indices, accessors, thickness, scale, quaternion, non-Z translation, X/Z world
bounds, hardware, anchor transforms, and every nonparticipating transform
remain native. Every update starts from its recorded native value, so fifty
min/native/max/reset cycles cannot accumulate drift. The on-model line, label,
handle, panel input, keyboard steps, and Review value all share one canonical
state. They display:

> Preview only — final dimensions require design confirmation.

Overall span, openings, overall height, built-in depth, repeat/remove, and local
stretch-band controls lack sufficient authority in these sources. They are
BLOCKED, disabled or absent, and never draggable.

## Appearance-zone authority

Every node begins with its embedded material. The exhaustive generated zone
matrix uses source SHA plus index-qualified node path as stable identity:

| Layout | PROVEN | PROVISIONAL | BLOCKED | PROVEN Finish targets |
| --- | ---: | ---: | ---: | ---: |
| Fireplace Wall | 118 | 67 | 0 | 118 |
| Door Wall | 0 | 78 | 49 | 0 |
| Window Wall | 0 | 120 | 62 | 0 |

Only the exact Fireplace PROVEN mesh-index allowlist may receive the existing
web Finish profile. Its selected-family preload and lazy family changes are
atomic; a failed Finish keeps the previously applied materials and retries only
the failed family. Door and Window have no accepted automatic Finish mapping,
so all their primitives retain embedded source materials and the Finish choices
are disabled. No bulk mapping is inferred for walls, floors, ceilings,
architectural doors/windows, fireplace, fire, glass, hardware, or ambiguous
cabinetry.

False-color zone proof is restricted to loopback hosts. Customer UI always uses
normal beauty appearance and the exact disclaimer:

> Digital preview only. Final dimensions and finishes require design confirmation.

The Fireplace presentation keeps the provisional
`room2-commercial-pbr-v1` local texture recipes, neutral local HDR
environment, RectArea key/fill roles, bounded directional shadow proxy,
Linear-sRGB working space, sRGB output, Neutral tone mapping, and semantic
camera fit. The accepted appearance profile is provisional and must not be
described as Blender-equivalent or physically approved.

## Project state and migration

Schema v5 stores ordinary and smart dimension state independently beneath:

```text
layoutStates[layoutId].measurements
layoutStates[layoutId].smartDimensions
```

Switching Fireplace → Door → Window → Fireplace restores each layout's own
values and camera. Legacy supported Fireplace schemas migrate idempotently to
the four-step flow without clearing storage, deleting unsupported projects, or
coercing their product/layout. Accepted snapshots, Save Project, My Projects,
Review, URL/hash history, Finish, and Details remain part of the public flow.

## Production, network, and dependency boundary

The static artifact explicitly allowlists:

- `guided-immersive-configurator.css`, registry, generated zone lookup, viewer,
  configurator data/state/UI, and retained appearance/material/integrity support;
- the three exact GLBs and three renderer-generated actual-model thumbnails;
- the model, material-zone, and payload-baseline JSON audits;
- local Three r166 core/add-ons, the pinned WebGPU bundle, and Three MIT license;
- local texture, HDR, provenance, and notice assets used by the accepted profile.

The artifact explicitly rejects the removed fixed-Room-2 viewer, parametric
guided renderer modules, legacy CAD workspace, tests/tools, and the excluded
Blender derivative. Model, material, HDR, and runtime requests are same-origin.
There is no CDN, hotlink, remote model host, analytics request, external glTF
payload, Vivid request, or second Three runtime in this path.

`three@0.166.1` is an exact MIT dev dependency used to build the WebGPU module
against the existing r166 runtime; its license ships. `esbuild@0.28.2` is an
exact MIT build-only dependency. The generated bundle externalizes `three`,
and `configurator.html` maps that import to the existing local
`assets/vendor/three.module.js`.

The locked payload method uses Node `22.23.2`, zlib
`1.3.1-e00f703`, gzip level 9, and the exact production JavaScript/CSS
allowlist. Base SHA
`7d961711dfc0b39f6d708699bcf145c8bb7eebd1` is 732,539 bytes across 47
files; this release may add no more than 150,000 bytes.

## Legacy status and release gate

The deprecated `guided-room2-viewer.js` has been removed, and production
packaging asserts that it is absent. The old parametric guided scene and the
accepted-design CAD workspace are not imported by this public path.

No merge or live claim is permitted unless all three smart controls are PROVEN;
generated audits are current; unit, browser/backend, accessibility, responsive,
resource, network, payload, and advisory gates pass; the protected source
worktree remains unchanged; and the exact existing Render
service/environment/trigger/deployed-SHA/cache/rollback identity is known.
GitHub Pages is not Render evidence or a fallback publication path.
