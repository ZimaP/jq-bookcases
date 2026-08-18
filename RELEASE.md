# Publication and production release contracts

Render and GitHub Pages are distinct publication paths. They are never
interchangeable, and one cannot prove that the other contains a revision.

## Customer production: mandatory Render identity gate

Expected customer URL: <https://jq-bookcases.onrender.com/>

Before any merge intended for production, the release operator must populate
and authenticate this record:

| Required identity | Verified value |
| --- | --- |
| Render account/team and environment | **UNKNOWN** |
| Exact service name | `jq-bookcases` (Static Site) |
| Immutable Render service ID | `srv-d95p0cok1i2s73aemegg` |
| Connected repository | **UNKNOWN** |
| Production branch | **UNAUTHENTICATED INFERENCE:** `main` |
| Auto-deploy/trigger rule | **UNAUTHENTICATED INFERENCE:** On Commit; dashboard setting unavailable |
| Exact deployed-SHA evidence mechanism | Byte-compare cache-busted live bodies with the selected Git commit blobs |
| Build command and publish directory | **UNKNOWN** |
| Cache headers, invalidation, and cache-bust behavior | `public, max-age=0, s-maxage=300`; query-keyed CDN cache; ETag/Last-Modified revalidation; GLB byte ranges |
| Rollback mechanism and restored-SHA verification | Normal revert through `main` plus byte verification is safe for this task; Render artifact-rollback availability is **UNKNOWN** |
| Last authenticated verification timestamp | **NONE — dashboard is signed out and API access returns 401** |

**STOP — deployment identity is not proven.** Read-only evidence identifies the
service and proves that the current live assets are byte-identical to
`main` SHA `7d961711dfc0b39f6d708699bcf145c8bb7eebd1`, but it does not prove the
environment, configured repository/branch/trigger, build/publish settings, or
rollback availability. Do not merge a production change, claim it live, or
substitute GitHub Pages while any required field remains unknown.

Do not create, reconfigure, transfer, rename, or directly trigger a Render
service to fill this gap. Evidence must come from the already configured
service/integration through an authenticated deployment record, an immutable
build marker, or byte-identical post-merge runtime assets tied to the exact
merge SHA. If access would require dashboard, credential, billing,
environment, or deploy-hook mutation, stop and request the missing authority.

Once the identity record is complete, an accepted merge must be allowed to flow
through that exact existing trigger. Verify the final redirected Render URL,
deployed SHA, runtime and model bytes, cache behavior, responsive browser
journeys, and error recovery in a fresh context. Visual similarity is not proof.

## Validation gates

Before a production merge or release:

1. Confirm the branch is based on the intended immutable release-base SHA and
   the protected source worktree fingerprint is unchanged.
2. Run `npm ci`, `npm run build`, `npm test`, the complete Chromium,
   Firefox, and WebKit release suites, and `git diff --check`.
3. Regenerate the immersive model/material audits and require a clean diff.
4. Prove all three exact GLBs and all three min/native/max/50-cycle smart
   controls, source-buffer immutability, collision bounds, and deterministic
   reset.
5. Prove WebGPU on genuine support plus forced/automatic WebGL2, initialization
   and render fallback, layout supersession, touch/pinch, accessibility,
   responsive sheet states, request ownership, and resource stability.
6. Run the exact production payload gate and advisory check described below.
7. Store large screenshots/traces only in the ignored local proof directory and
   verify no proof artifact is staged.
8. Populate and authenticate the Render identity record above.

Pull-request and push workflows are validation only unless their documented
permissions and target explicitly say otherwise.

## Immersive-layout production artifact contract

The static artifact is an explicit allowlist, not a repository-root copy. In
addition to public HTML, shared shell, catalog data, and photography, it must
contain:

- `guided-immersive-configurator.css`;
- `guided-layout-registry.js`,
  `guided-layout-material-zones.generated.js`, and
  `guided-layout-viewer.js`;
- guided configurator data, schema-v5 state, UI, and accepted project-engine
  dependencies;
- `guided-room2-appearance.js`, `guided-room2-materials.js`, and
  `guided-room2-integrity.js`;
- `assets/models/room2/Room2-Fireplace-bookcases-source-v1.glb`;
- `assets/models/room2/jq-door-wall-bookcase-room2-authoritative-v01.glb`;
- `assets/models/room4/jq-window-wall-bookcases-cabinets-room4-authoritative-v01.glb`;
- the three files under
  `assets/photos/configurator/layout-model-thumbnails/`;
- `config/immersive-layout-model-audit-v1.json`,
  `config/immersive-layout-material-zones-v1.json`, and
  `config/immersive-layout-payload-baseline-v1.json`;
- the local Three r166 core/add-ons,
  `assets/vendor/three-webgpu-renderer-r166.bundle.js`, and
  `assets/vendor/licenses/three-0.166.1-LICENSE.txt`;
- every allowlisted local texture, HDR environment, provenance file, and notice
  required by the Fireplace profile.

The packaging workflow must copy every listed customer runtime file and assert
its existence before upload. It must also verify the exact GLB regular-file
status, byte size, SHA-256, and non-LFS header and reject any unlisted
JavaScript/CSS in the prepared artifact.

The artifact must exclude:

- the removed `guided-room2-viewer.js`;
- the old parametric guided scene/renderer and legacy CAD workspace;
- tests, tools, source-only scripts, package metadata, and local proof files;
- the forbidden Blender/Cycles derivative;
- any remote model, texture, HDR, Vivid, analytics, or second-Three runtime.

Any new customer runtime dependency must enter the copy allowlist, existence
and hash/size assertions where applicable, payload measurement, license review,
and absence checks in the same change.

## Locked payload and dependency gate

`config/immersive-layout-payload-baseline-v1.json` records the immutable
release base:

- release-base SHA:
  `7d961711dfc0b39f6d708699bcf145c8bb7eebd1`;
- Node `22.23.2`;
- zlib `1.3.1-e00f703`;
- independent gzip level 9;
- exact production JavaScript/CSS allowlist;
- 47 files totaling 732,539 bytes.

`scripts/prepare-immersive-payload-artifact.mjs` must prepare the same
allowlist used by production. `scripts/check-immersive-payload.mjs` locks the
manifest schema, method, base SHA/count/total, exact runtime versions, file
ordering and contents, and rejects a regression above 150,000 gzip bytes. Run
the same commands in pull-request validation and in final packaging; do not
maintain a second hand-written allowlist.

`three@0.166.1` (MIT) and `esbuild@0.28.2` (MIT) are exact dev
dependencies in the lockfile. Three supplies the matching WebGPU renderer
source and ships its license. Esbuild deterministically creates the bundle and
is not shipped. The bundle externalizes `three`; the configurator import map
resolves it to the existing local r166 core.

Run the repository's package advisory check immediately before release and
record its command, lockfile, runtime, timestamp, and result in the PR/release
evidence. Do not claim dependency security clearance from a stale or absent
audit. A material high/critical production-runtime advisory is a STOP unless an
explicit reviewed disposition applies.

Candidate record, 2026-08-18: `npm audit --audit-level=high` against the current
lockfile reported `found 0 vulnerabilities`. This record must be refreshed if
the lockfile changes or before a later release attempt.

## Local proof boundary

Screenshots, traces, geometry masks, manifests, and large runtime evidence belong
only under:

```text
.local-proof/immersive-layout-configurator-v1/run-<UTC timestamp>/
```

That tree is ignored and must remain untracked. Its run manifest records
revision, UTC timestamp, browser/backend, viewport, URL, exact selected layout
and control value, runtime diagnostics, network failures, and artifact hashes.
No `test-results`, `playwright-report`, ad-hoc screenshot, Blender file, or
proof directory may enter the production artifact.

## Manual GitHub Pages publication — separately authorized only

Merging code and publishing GitHub Pages are separate actions. Pull requests
and pushes to `main` run validation only; neither may upload a Pages artifact,
target its production environment, or request a Pages deployment.

The manual workflow accepts only `workflow_dispatch` from a
`production-*` tag. Its `production_sha` must be the same full lowercase
40-character SHA, contained in `origin/main`, and
`confirm_production` must be exactly `DEPLOY`. It revalidates and packages
that exact commit, reconfirms the tag/SHA/ancestry, and serializes production
deployments. Only its final job receives Pages write and deployment OIDC
permissions.

Codex tasks must not dispatch that workflow unless the user explicitly
authorizes the Pages path for the exact revision. Standing authorization to
publish the customer website or verify Render is not authorization to use Pages
as a substitute.

## Verification, failure, and rollback

For either authorized path, record the service/environment, trigger, merge SHA,
deployed SHA, final URL, build/artifact identity, cache evidence, direct Step
1/2/3/Review URLs, browser/backend checks, and UTC verification time.

If a post-merge Render smoke failure is conclusively caused by that merge, use
only the already documented rollback mechanism for the authenticated service.
Verify the restored deployed SHA and byte identity after rollback. Do not
blindly rerun, retag, force-push, change service configuration, or claim
recovery from UI similarity. If the rollback mechanism or restored-SHA proof is
not already established in the identity record, stop rather than improvising.
