# Photoreal lighting and presentation baseline

Status: Phase 7 local-only baseline for the accepted **TV01 + Clear Wall +
fitted installation** scene. This is an additive Blender presentation path over
the deterministic Phase 6 material preview. It is not connected to the website,
is not published, and does not grant either material or beauty-render approval.

## Boundary and authority

The JQ JavaScript engine remains the only product-geometry authority. Phase 6
remains the only material-binding and material-frame authority. Phase 7 consumes
their verified outputs and may change only presentation state inside a separate
beauty-render copy:

1. `render-package.json` supplies the accepted product geometry and stable
   component/submesh identities.
2. `materials-package.json` supplies the accepted deterministic PBR recipes,
   bindings, grain directions, material frames, and per-piece variation.
3. `TV01-materials-preview.blend` supplies the already translated and audited
   Phase 6 Blender scene.
4. `presentation-package.json` supplies a separate, versioned camera, world,
   light rig, room-material overrides, Cycles policy, and output contract.
5. `photoreal_presentation_worker.py` verifies all three packages and the
   source scene before it mutates presentation state, renders one Cycles frame,
   saves the high-quality master, derives the WebP from the same Render Result,
   and writes a result and diagnostic report.

The reproducible local command is:

```sh
npm run blender:photoreal
```

It uses `BLENDER_BIN` when supplied and otherwise resolves
`/Applications/Blender.app/Contents/MacOS/Blender`. It writes only ignored local
artifacts under `artifacts/blender-clay-worker/TV01/`:

- `presentation-package.json`;
- `photoreal-beauty-master.png`;
- `photoreal-beauty.webp`;
- `photoreal-beauty-result.json`;
- `photoreal-beauty-report.json`;
- `TV01-photoreal-beauty.blend`.

It does not overwrite `beauty.webp`, `materials-preview.webp`, their manifests,
`TV01-clay.blend`, or `TV01-materials-preview.blend`.

## Immutable Phase 6 source

The Phase 7 branch starts from Phase 6 commit
`6479dd22b60b84450bf26f1ddf27c755b1f71524`. The source package and capture
identities are fixed:

| Identity | Accepted value |
| --- | --- |
| Geometry fingerprint | `jq-guided-geometry-v1-028YPJG43EJF6` |
| Customer-camera fingerprint | `jq-guided-snapshot-camera-v1-1kj9fv5` |
| Primary package/render key | `jq-blender-package-v1-f80f6b84cb804623613e3ecb55aa61461e71e7a4dc70816e37bae38bd5e5be15` |
| Canonical primary-package SHA-256 | `f16e1e1ebc190090a3303ed13df6a6be6353760447fd692f30f1e04d25022a9b` |
| Object-manifest SHA-256 | `4a1f11e676b7203a40a03b8058653b630289a4d6e3c4f56b7747ef34f80bd22f` |
| Material package key | `jq-render-material-package-v1-6d180ecff47487de4692620d5387b7bde3b827a5a0a5f6b4ad438cb6335d2794` |
| Material-package file SHA-256 | `290ce873984977396ae8fabc37572e22b8d51f110ae3db7051b6daa69be66cf5` |
| Materials-preview capture key | `jq-materials-preview-v1-ea08c048092d14f80da06924ec82126c8edae36a388b785313bac02e763b91ea` |
| Materials-preview result key | `jq-materials-preview-result-v1-367133ae6a20e4a562159a67d38b993396a3d94ec7ac8a3710fac395e857314e` |
| Materials-preview result file SHA-256 | `30bf1bf1198f32555a1b1e7649fa07047cacd6e19640a606dde609e0cdab98d5` |
| Materials-preview report file SHA-256 | `56d1c2eea24884f61d496442fcdc31588687a0865163255f98bd19dc3c5cc126` |
| Crown QA capture key | `jq-crown-detail-qa-v1-d57183ac1df8d49db962e9532e24e1f0c6ed9173963b46f62c8e5e258386a35b` |

The accepted source images remain:

| Capture | Dimensions | Bytes | SHA-256 |
| --- | ---: | ---: | --- |
| Clay `beauty.webp` | 960 × 640 | 7,400 | `ae544cc51ed2a06377fd7cc7d433fe27309c0eb97cccffec5ad2c7f4af0d5b` |
| `crown-detail.webp` | 960 × 640 | 9,032 | `c30b1de091024e330448eced13ab09887e994f7bf41ee7355a95e62748ab3429` |
| `materials-preview.webp` | 960 × 640 | 10,692 | `61504a822032c55d0f478746c80e5e6e76f13d03fc776db67935a5b63aa935ae` |

The Phase 6 scene audit must match before Phase 7 can add presentation state:

| Audit | Accepted count |
| --- | ---: |
| Descriptor components | 57 |
| Renderable components | 44 |
| Product mesh objects | 78 |
| Room mesh objects | 2 |
| Constraint/debug mesh objects | 7 |
| Mesh objects / mesh datablocks | 87 |
| Total objects | 88 |
| Persistent cameras | 1 |
| Lights | 0 |
| Collections | 4 |
| Modifiers | 0 |
| Bound materials | 70 |
| Material bindings | 80 |
| Wood material frames | 65 |
| Node groups | 0 |
| Material nodes | 1,115 |
| Material links | 1,305 |

The source scene is also pinned by its Phase 6 report digests:

| Audited state | SHA-256 |
| --- | --- |
| Geometry | `0e34d05fac3b3ac025dbbce3104d24c97b704ae168884d97713c3e7978159c72` |
| Topology | `1bf523568c6fbd240543b5f0a25bed34881a66f5ba5e3dad43ff8878c1cebb63` |
| Bounds | `3b621a2266378944888bde6efde033bf92eb7d208160fa1987dbb78766ec2d6c` |
| Transforms | `81254f454170b20f074e7da09a62590796bc58aac3fd81d74033a8c028f5c0cf` |
| Camera | `1f27768d5c672576eb7bfa093b5be44125135c35c9b6494cd06eb54f20574de0` |
| World | `5ea7c02b7db8d70edcf86c4138691cc3c0f01f562153a299995ea8619f6953b1` |
| Render settings | `04c600a9d0dc859e9f42c2b8891d807ec6ee0cfaf8b01fe3c891bbc455318d53` |
| Material definitions | `520be8b532c79c17c50d2a73e31d4f4094df81a4d71192877bcbc316d6bbf7f6` |
| Shader parameters | `54ba4a5444fe595a05118146e33987fdffe0136ba8316a131ea821592d0ea36a` |
| Slot assignments | `1ebac1ccbc11474416ae1c6510e819916cb689ee1e4943e2d25e0b3f2d5f0540` |
| Node order/properties | `95f4c09daa27ec6b7bb25bea15d814359e362c4360fe63e33c8295a2d8ba867a` |
| Link order/endpoints | `1b83b7addb95360954e05f4ca1c0b19925430f6c37184e5b7059437a940b721f` |

The Phase 6 material versions remain unchanged:
`jq-pbr-material-library-v1`, `jq-procedural-natural-oak-v1`,
`jq-material-frame-v1`, `jq-material-piece-seed-sha256-v1`,
`jq-blender-pbr-node-topology-v1`, `jq-blender-material-translator-v1`,
`jq-blender-material-translation-policy-v1`, and
`2026.08-deterministic-pbr-materials-v1`. Phase 7 does not edit any Phase 6
product material or binding.

## Phase 7 presentation identity

The sidecar kind/schema is `jq-photoreal-presentation-package` /
`jq-photoreal-presentation-package-v1`, schema version `1`. Its independent
version chain is:

- package version `jq-photoreal-presentation-package-v1`;
- camera version `jq-photoreal-presentation-camera-v1`;
- lighting version `jq-photoreal-presentation-lighting-v1`;
- room-material version `jq-photoreal-room-materials-v1`;
- world version `jq-photoreal-presentation-world-v1`;
- render version `jq-photoreal-cycles-render-v1`;
- pipeline version `2026.08-photoreal-presentation-baseline-v1`;
- capture ID `photoreal-beauty-v1`;
- result kind/schema `jq-photoreal-presentation-result` / version `1`.

Final render-derived identities are recorded after the accepted local render:

- package key:
  `jq-photoreal-presentation-package-v1-57a146b6b1e7cad8c319ef8a64903069e2c68e62b7b3c3a5a77ef4b8bbf7b964`;
- capture key:
  `jq-photoreal-beauty-v1-e26c546f2752f7f65e980a8f744770ea344d60902b848027cf4a4c9f23977f26`;
- current result key:
  `jq-photoreal-beauty-result-v1-bf600f89f03c3f59787ca970aa7de5fc0177d7a6d7b717517d499923de37f345`.

Canonical identities cover the immutable Phase 6 base identities, the complete
camera, four-light rig, room recipes, world, Cycles policy, Blender runtime,
master/output encoding, and output names. Timestamps, durations, absolute paths,
temporary directories, hostnames, process IDs, and documentation do not enter
the keys.

## Architectural beauty camera

The original `hero-front-v1` camera remains unchanged and available for Phase 6
QA. Phase 7 adds exactly one camera named `JQ_PHOTOREAL_BEAUTY_CAMERA` in the
new `JQ_PRESENTATION_CAMERAS` collection. It becomes active only in the isolated
beauty blend.

| Property | Contracted value |
| --- | --- |
| ID | `beauty-camera-v1` |
| Type | `PERSP` |
| Position, m | `(-0.85, 5.75, 1.56)` |
| Target, m | `(0.05, 0.19, 1.22)` |
| Up | `(0, 0, 1)` |
| Lens | 52 mm |
| Sensor width / fit | 36 mm / `HORIZONTAL` |
| Clip start / end | 0.05 m / 25 m |
| Depth of field | disabled |
| Output | 1920 × 1280 at 100% with 1:1 pixels |

The restrained left-offset perspective reveals product depth without changing
or reframing the product itself. Blender uses camera-local `-Z` to view the
target and local `Y` as up. The package authors the position and orientation;
the worker may not derive or hand-adjust them.

## Four-light residential rig

Phase 7 adds exactly four lights in `JQ_PRESENTATION_LIGHTS`. Every light casts
shadows and uses normalized power. The two area lights use `RECTANGLE` shape
and a spread of π radians.

| Light | Type | Position → target, m | Linear RGB | Power | Shape settings |
| --- | --- | --- | --- | ---: | --- |
| Soft daylight key | Area | `(-2.3, 3, 2.45)` → `(-0.25, 0.2, 1.2)` | `(1, 0.93, 0.84)` | 420 W | 2.2 × 1.6 m rectangle |
| Cool-neutral fill | Area | `(2.2, 2.4, 1.75)` → `(0.35, 0.18, 1.1)` | `(0.84, 0.91, 1)` | 110 W | 2.5 × 1.8 m rectangle |
| Left puck pool | Spot | `(-1.12395, 0.28575, 2.405)` → `(-1.12395, 0.28575, 1.4)` | `(1, 0.896269353374, 0.737910408773)` | 18 W | 1.2217304764 rad cone, 0.65 blend, 0.025 m soft radius |
| Right puck pool | Spot | `(1.12395, 0.28575, 2.405)` → `(1.12395, 0.28575, 1.4)` | `(1, 0.896269353374, 0.737910408773)` | 18 W | 1.2217304764 rad cone, 0.65 blend, 0.025 m soft radius |

The spots are not decorative or freehand. Their X/Y coordinates must match the
verified `emissive-lens` centers for components
`guided-installation-main/section-01-light-puck` and
`guided-installation-main/section-04-light-puck`; their color matches the
accepted 2700 K lens recipe. A missing, duplicated, moved, noncircular, or
wrongly bound puck fails before any light is created.

## World and room presentation

The beauty world reuses the repository-owned
`assets/environments/jq-warm-interior.hdr` and its exact SHA-256
`49db5b6e13c5b5239d8aca84c055c586dfc71aeaf1e1db64487f5bf8bab66db2`.
It remains equirectangular, linearly interpolated, and interpreted as Linear
Rec.709. The presentation copy uses strength `0.32` and a Z rotation of `0.35`
radians. The Phase 6 world remains unchanged in its source blend.

No room mesh is created, deleted, moved, scaled, or reshaped. The existing
`room-rear-wall` and `room-floor` meshes are rebound only in the isolated beauty
blend to two package-defined materials:

| Property | Warm off-white wall | Warm natural floor |
| --- | --- | --- |
| Blender name | `JQ_PRESENTATION_ROOM_WALL` | `JQ_PRESENTATION_ROOM_FLOOR` |
| Base linear RGBA | `(0.78, 0.72, 0.64, 1)` | `(0.28, 0.22, 0.16, 1)` |
| Metallic | 0 | 0 |
| Roughness | 0.78 | 0.55 |
| IOR | 1.45 | 1.5 |
| Coat weight / roughness | 0 / 0 | 0.04 / 0.35 |
| Noise | 4D; scale 70, detail 2, roughness 0.45, W 0.37 | 4D; scale 3.5, detail 2, roughness 0.45, W 0.61 |
| Color variation | none | 0.035 |
| Bump strength / distance | 0.08 / 0.0001 m | 0.12 / 0.0004 m |

Both recipes are procedural, deterministic, non-emissive, and use shader-only
bump. They have no image, network, frame, camera, or random dependency and no
true displacement. The room stays deliberately sparse; Phase 7 adds no props,
windows, furniture, décor, side walls, ceiling mesh, or styling geometry.

## Cycles, color, and encoding contract

The renderer is Cycles on the verified Apple Metal GPU. The runtime remains
Blender `5.2.0 LTS`, build `fbe6228777e7`, backend `METAL`, vendor `Apple M4`,
renderer `Metal API`, and device version `1.2`. If that contracted device is not
available, the worker fails rather than silently switching to Eevee or a CPU.

| Setting | Contracted value |
| --- | --- |
| Samples | 256 |
| Adaptive sampling | enabled; threshold 0.01; minimum 32 samples |
| Sampling seed | 170219; animated seed disabled |
| Light tree / path guiding | enabled / disabled |
| Max / diffuse / glossy bounces | 8 / 4 / 4 |
| Transmission / transparent / volume bounces | 6 / 4 / 0 |
| Reflective / refractive caustics | disabled / disabled |
| Direct / indirect clamp | 0 / 5 |
| Pixel-filter width | 1.5 px |
| Denoiser | OpenImageDenoise (`OPENIMAGEDENOISE`) |
| Denoiser passes | RGB + albedo + normal |
| Denoiser prefilter / quality | `ACCURATE` / `HIGH` |
| Denoiser GPU use | disabled |
| Film | opaque |

Color management is sRGB display, AgX view transform,
`AgX - Medium High Contrast`, exposure `0`, gamma `1`, and curve mapping off.
Compositing, sequencing, stamps, borders, and crop-to-border are disabled;
dither intensity is `1`.

One 1920 × 1280 Cycles render is performed. The worker saves the untouched
Render Result first as RGB 16-bit PNG with compression `15`, then switches only
the file-encoding contract and derives RGB 8-bit WebP at quality `92` with
`FOLLOW_SCENE` color management. It does not launch a second render for the
WebP. The final output digests are:

- `photoreal-beauty-master.png` SHA-256:
  `8d8ee27385968d65ac0ea38b7769f780daed1c47d5de2678e0887f8c5de03d88`
  (8,675,112 bytes);
- `photoreal-beauty.webp` SHA-256:
  `796469301d3abac8badccb7b3df8df4bacdd14a18154f3bb80d072eb95822ba9`
  (63,940 bytes).

Fresh isolated Metal renders retained the exact package and capture keys,
scene manifests, camera/light/room values, object counts, and 1920 × 1280
output structure. GPU path tracing was not byte-deterministic: earlier runs
produced master SHA-256 values
`31a7f5b556f201394625db879f762ba846f6d29875aae4773327ede3facc54ed`
and `a5874d26788ad88512e4a1fdbfb4d8168bc3c89ed86729a26afd556b28a93f12`,
with WebP SHA-256 values
`58677c03bb63f219f38b54c4e005d08501f81a4d0803f637f7cfa65641f1f912`
and `b35560ccab5c027b20a12decbc1f484f93200c75b9fd55e72d4daca3ef635682`.
The runner therefore validates every run's actual bytes against its own result
manifest without falsely treating Metal pixel hashes as cache identities.

## Additive scene policy

The Phase 7 beauty blend has exactly two new collections, one new camera, and
four new lights. The source four collections and technical camera remain. The
expected post-mutation totals are six collections, two cameras, four lights,
93 objects, and 87 mesh datablocks. Product and room mesh count, vertex/index
topology, object names/order, origins, transforms, bounds, scale `(1,1,1)`,
material frames, product material assignments, and seven constraints remain
unchanged.

Phase 7 v1 deliberately uses zero modifiers and no shader bevel. Edge
readability comes from Cycles global illumination, controlled reflection,
contact shadowing, the existing Phase 6 shader-only oak bump, and the explicit
lighting rig. No canonical or evaluated product geometry is softened, beveled,
subdivided, displaced, repaired, or substituted.

## Fail-closed validation

Validation finishes before scene mutation and rejects:

- unknown or missing schema properties, versions, IDs, outputs, or recipes;
- non-finite values, malformed vectors/colors, invalid ranges, duplicate IDs,
  degenerate camera/light direction, or unsupported engine/device settings;
- a stale geometry fingerprint, primary package key/SHA, material package key,
  material capture key, object manifest, or Phase 6 semantic scene digest;
- any missing, extra, renamed, reordered, transformed, hidden, or re-materialed
  product object;
- any topology, bounds, transform, scale, Phase 6 node topology, material-frame,
  product-slot, technical-camera, constraint, or base-collection drift;
- a puck light not anchored to its exact accepted component, `emissive-lens`
  submesh, center, warm-lens material, or circular primitive;
- an attempt to create a mesh/modifier, edit product materials, replace the QA
  camera, add an uncontracted light, or alter the source `.blend`;
- an external texture/network dependency, random/time/frame/camera-driven
  shader, true displacement, or an implicit Blender fallback;
- an output path outside the isolated directory or colliding with a Phase 2–6
  filename;
- missing, empty, stale, incorrectly dimensioned, oversized, or hash-mismatched
  PNG, WebP, result, or report output.

The worker audits immutable scene state before presentation mutation, after
mutation, after render, and after reopening the saved beauty blend. The runner
independently validates canonical package/result identities and actual file
bytes before publishing the isolated temporary run into the ignored artifact
directory.

## Approval and deferred work

Phase 7 is a local presentation baseline. Natural Oak remains the Phase 6
`PREVIEW_ONLY_AUTHORIZED` visualization, with
`materialColorReferenceStatus: UNVERIFIED`. Both
`customerMaterialApproved` and `customerBeautyRenderApproved` remain `false`.
The Phase 7 result is not a manufacturer swatch, fabrication finish sample,
production-ready shop model, or customer-approved image.

Still deferred:

- manufacturer-approved Natural Oak color matching and physical-sample
  calibration;
- Clear UV Maple surface separation and external scanned PBR texture sets;
- alternate room environments, reviewed reference lighting, presentation
  styling, and customer-directed camera variants;
- TV Unit + Left/Right Niche compatibility;
- a render gateway, queue, API, object storage, or website integration;
- customer approval and every production release permission;
- push, merge, deployment, publication, and live-site verification.

The UI, configurator behavior, BOM, pricing rates and accepted $15,050 total,
geometry/topology/transforms, TV compatibility, niche compatibility, and
approval gates are outside this local-only phase and remain untouched.
