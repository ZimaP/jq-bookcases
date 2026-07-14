# Cabinet “View in Your Room” MVP

## Repository fit

This repository is a static, framework-free ES-module site. It has no backend,
API framework, authentication layer, deployment-time environment substitution,
or analytics SDK. The configurator is one `BookcaseConfigurator` controller and
one persistent Three.js r166 preview. `BookcaseConfigurator.state` is the single
normalized product state, `bookcase-layout.js` produces the validated physical
descriptor graph in inches, and schema-v4 accepted-design snapshots are stored
in `localStorage` under `jqBookcasesDesign` (with schema-v2/v3 restore support).
Schema-v4 snapshots created before drawer profiles are accepted only when their
regenerated descriptor graph matches the exact legacy layout fingerprint and
accepted-design ID; the compatibility path omits only the newly introduced
drawer-profile descriptor metadata during verification.

The AR feature integrates at those boundaries; it does not create a second
configurator or change pricing, manufacturing dimensions, quote behavior, or
saved-design records.

## Architecture

- `cabinet-ar.js` owns the AR configuration contract, unit conversion,
  deterministic canonical hashing, compact configuration share tokens,
  capability detection, analytics payload allowlisting, request sequencing,
  provider caching, and the optional remote-provider contract.
- `cabinet-ar-model.js` converts the existing validated layout descriptors into
  a procedural GLB 2.0 model. It emits meter coordinates directly and keeps the
  origin at the bottom-center of the nominal front plane. The model is Y-up and
  faces positive Z.
- `cabinet-ar-ui.js` owns the reusable dialog, loading/error/compatibility
  states, `<model-viewer>` integration, mobile instructions, desktop QR handoff,
  and launch analytics. The module does not ask for camera permission; AR starts
  only from the customer’s `Start AR` gesture inside `<model-viewer>`.
- `configurator-3d.js` exposes the launch point next to the persistent preview,
  passes the current state/layout/price to the AR controller, invalidates stale
  requests when the configuration changes, and reloads shared `arConfig` URLs
  into the real configurator.

The configured model is resolved through this logical interface:

```js
resolveArModel(configuration, context) => {
  configurationHash,
  glbUrl,
  usdzUrl,
  posterUrl,
  status,
  source
}
```

Identical normalized configurations use the same deterministic hash and share a
page-session cache entry. The cache is an eight-entry LRU and revokes owned blob
URLs on duplicate resolution, eviction, failure, and explicit clearing. Remote
model requests have a 10-second deadline and fall back to the procedural model;
caller cancellation still aborts the full operation. An incrementing request
coordinator marks older async results stale so a slow response cannot replace a
newer design.

## AR configuration and units

The manufacturing/configurator source remains inches. Conversion happens at the
AR boundary only:

```text
meters = inches × 0.0254
```

The normalized AR object includes explicit meter dimensions, product and local
configuration IDs, sections, each generated shelf position, shelf thickness,
layout type/metadata, cabinet/door/drawer options, base and crown styles, finish
and preview color, the one canonical hardware variant, and lighting. Door and
drawer profiles are separate IDs. `drawerFrontStyleId` supports Shaker, Flat
Panel, and Slim Shaker; legacy configs infer it from a compatible
`doorStyleId` and otherwise fall back to Shaker. Invalid raw dimensions or an
invalid layout are rejected before model preparation.

The procedural exporter consumes component bounds from
`generateBookcaseLayout`; it does not independently calculate section widths,
shelf positions, openings, door placement, or trim. Structural panels and
trim use envelope-based procedural primitives with role-appropriate materials.
This is deliberately less detailed than the normal Three.js preview, but it
maintains physical dimensions and the major configuration geometry. The AR
configuration, hash, and procedural GLB preserve the independent door and
drawer profiles. Flat fronts export as slabs; Shaker and Slim Shaker fronts
export with distinct frame-and-panel geometry; glass remains door-only and
exports as a finished frame around a translucent panel. Profile rails are
clamped inside the front envelope so short drawer fronts remain valid.

## Model formats and platform behavior

The viewer is pinned to Google `<model-viewer>` 4.3.1 and configured with:

- `camera-controls`
- `ar`
- `ar-placement="floor"`
- `ar-scale="fixed"`
- `webxr`, `scene-viewer`, and `quick-look` modes where the resolved asset can
  support them
- a fixed-scale configured GLB
- `ios-src` when the remote provider returns a USDZ

Current static-provider behavior:

| Platform | Expected MVP behavior |
| --- | --- |
| Current AR-capable Android Chrome with WebXR | In-browser floor placement using the generated GLB |
| Current iPhone/iPad Safari | Quick Look using `<model-viewer>`’s on-device USDZ conversion; a provider-supplied USDZ takes precedence when available |
| Android without WebXR | Interactive 3D and a clear fallback; Scene Viewer requires the production public model URL described below |
| Desktop Chrome/Safari/Firefox | Interactive 3D plus QR and a normal phone link preserving the exact configuration |
| Unsupported mobile or restricted in-app browser | Interactive 3D plus a human-readable compatibility message |

Scene Viewer is a separate Android application and cannot reliably fetch a
page-local `blob:` GLB. For that reason it is enabled only when the model
provider returns a public model URL. The UI does not claim Scene Viewer support
for the in-browser procedural provider.

## Feature flag and model endpoint

This static repository uses an explicit markup feature flag:

```html
<div data-bookcase-builder data-enable-cabinet-ar="true"></div>
```

Set it to `false` or remove it to hide the button and prevent AR module/model
viewer/model requests. A production deployment template should map its
`CABINET_AR_ENABLED` or equivalent environment value to this attribute.

The optional remote provider is configured by:

```html
<meta name="jq-ar-model-endpoint" content="https://example.com/api/ar/models">
```

An empty value uses the in-browser procedural provider. The endpoint request is:

```json
{
  "configuration": { "schemaVersion": 1, "units": "meters" }
}
```

The expected response is:

```json
{
  "configurationHash": "ar-…",
  "glbUrl": "https://cdn.example.com/ar/ar-….glb",
  "usdzUrl": "https://cdn.example.com/ar/ar-….usdz",
  "posterUrl": "https://cdn.example.com/ar/ar-….webp",
  "status": "ready"
}
```

The client requires JSON, `status: "ready"`, a matching deterministic hash, and
HTTP(S) or safe local blob URLs. A production service must independently map
trusted product IDs to allowed dimensions/options, validate the entire schema,
rate-limit requests, apply the site’s CSRF/auth conventions if introduced,
generate safe hash-based filenames, and never accept client-provided paths.
Generated GLB/USDZ/poster assets should be immutable, CORS-enabled, served with
correct content types from a CDN/object store, and cached by configuration hash.

## Share links and privacy

Desktop QR links use a compact versioned Base64URL array under `arConfig`. The
token contains product configuration only—no customer, room, account, or quote
data—and is capped at 4 KB before parsing. On load it is decoded, validated,
normalized, and passed into the same configurator state. The token is not a
security credential and must never be trusted by a future model service.

Schema-v1 share values are positional. Its original field order is now an
explicit immutable list, and `drawerFrontStyle` is appended as the final
optional value. Tokens created before that append therefore keep every legacy
position and decode with drawer-profile inference; new tokens preserve the
independent drawer selection without a schema-v1 reinterpretation.

The camera feed is handled by the browser/operating-system AR implementation.
This site does not upload, store, or analyze camera frames and requests no camera
permission during page load or dialog preparation.

## Analytics

There was no existing analytics SDK. AR events are emitted through the smallest
site-neutral adapter:

- push an allowlisted payload to `window.dataLayer` when it already exists;
- dispatch a `jq:analytics` `CustomEvent` on `document` for a future analytics
  integration.

Payloads allow only product ID, configuration ID, device category, operating
system, AR mode, configuration hash, and a bounded failure reason. Camera data,
room imagery, customer data, and raw configurations are never emitted.

Events: `ar_button_viewed`, `ar_button_clicked`, `ar_model_requested`,
`ar_model_ready`, `ar_launch_started`, `ar_launch_succeeded`,
`ar_launch_failed`, `ar_unsupported_device`, `ar_qr_displayed`, and
`ar_qr_opened`.

## Runtime dependencies and deployment

No npm dependency was added. Two pinned browser dependencies are lazy-loaded
only after the AR feature is enabled and used:

- Google `<model-viewer>` 4.3.1 for accessible 3D display and cross-platform AR
  launching;
- `qrcode` 1.5.4 from jsDelivr for local desktop QR rendering. If it cannot
  load, the normal configuration link remains available.

Production Content Security Policy must allow the pinned Google and jsDelivr
origins, or these files should be self-hosted with their licenses and integrity
controls. WebXR requires HTTPS (localhost is suitable for basic desktop
development but does not verify physical AR).

Local development:

```sh
npm run serve
npm run build
npm test
```

## Adding a cabinet family or production asset

1. Add the family and its physical options to `bookcase-config.js` and descriptor
   mapping to `bookcase-layout.js` first.
2. Ensure `normalizeCabinetArConfiguration` includes every new geometry- or
   appearance-affecting value so the hash changes correctly.
3. Add unit tests proving the new choice changes normalized output and the hash.
4. For CAD-derived assets, have the provider map the normalized product ID and
   allowed options to source CAD, export Y-up meter-based GLB and USDZ, and put
   the floor-contact origin at Y=0.
5. Validate GLB/USDZ bounds against the nominal dimensions and return immutable
   CDN URLs. Do not expose CAD paths or use browser-provided filenames.

The provider boundary allows CAD-derived production models to replace the
procedural GLB without changing the dialog or configurator integration.

## Known limitations

- Physical AR placement has not been verified on a real device in this
  repository session.
- The procedural GLB represents descriptor bounds and major materials, not
  photorealistic joinery, bevels, lighting fixtures, or exact hardware profiles.
- Android Scene Viewer needs the production public model service; the local
  provider supports WebXR instead.
- iOS currently relies on `<model-viewer>`’s on-device USDZ conversion unless a
  remote USDZ URL is returned. Production should pre-generate and validate USDZ.
- QR and model-viewer runtime files currently require their pinned CDNs.
- Share tokens are compact and validated but not signed. They contain no
  sensitive data; a future server endpoint must treat them as untrusted input.
