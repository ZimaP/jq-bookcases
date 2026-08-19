# Publication and production release contracts

The repository has two distinct public publication paths. They are not
interchangeable, and one must never be used as proof that the other updated.

## Existing Render publication path

`https://jq-bookcases.onrender.com/` is the customer-inspection target for the
Room 2 fixed-reference release. The existing service publishes from accepted
`main` history through its already established GitHub-to-Render integration.
That relationship must be proved for a release by an authenticated deployment
record, an exact build marker, or byte-identical post-merge runtime assets; UI
similarity alone is not proof.

Do not create, reconfigure, transfer, rename, or directly trigger a Render
service from this repository. After a reviewed pull request is merged, wait for
the existing publication path and verify the final redirected Render URL,
post-merge runtime bytes, model bytes, cache headers, and browser behavior in a
fresh context. If the build cannot be tied to the exact merge commit, or if
updating it requires a dashboard, credential, environment, billing, or deploy-
hook mutation, stop. A GitHub Pages deployment is not a substitute.

## GitHub Pages release contract

Merging code and publishing GitHub Pages are separate actions. Pull requests and
pushes to `main` run validation only; neither event may upload a GitHub Pages
artifact, target its production environment, or request a Pages deployment.

## Validation

The following workflows run without deployment permissions:

- `Engine quality gate` runs the build and complete unit, contract, matrix, and
  hostile-input suite on supported Node.js versions.
- `Browser configurator quality gate` runs the complete Chromium, Firefox, and
  WebKit suite.
- `Pages release validation` runs the build, tests, and Chromium release gate.

All checks for the intended commit must be green before creating a production
release tag.

## Production artifact contract

The Pages artifact is an explicit allowlist, not a copy of the repository. In
addition to the public HTML, shell, generated color data, and photography, the
guided configurator release must include:

- the room-topology, installation-fit, product adapter/product engine, project
  transaction, accepted render-contract, renderer-neutral primitive, material,
  scene-plan, renderer, state, data, and UI modules;
- the canonical bookcase engine dependencies used by guided products, including
  `bookcase-render-contract.js`;
- `config/` with the v1 fit, topology, compatibility, archetype, material,
  provisional-decision, golden-project, and asset-manifest contracts;
- all allowlisted assets under `assets/textures/` and `assets/environments/`;
- the public Room 2 appearance, integrity, and viewer modules, the pinned local
  Three.js GLTF loader utilities, and the exact allowlisted Room 2 GLB.

The production workflow checks each required runtime module, config file,
texture map, and environment file before it uploads the artifact. Developer
tools, tests, package metadata, and the legacy configurator workspace remain
excluded. Any new customer-facing runtime dependency must be added to both the
copy allowlist and the pre-upload assertions in the same change.

## Manual GitHub Pages production release

Production is published only by `Deploy GitHub Pages — Manual Production
Release`. The workflow accepts only an explicit `workflow_dispatch` from a tag
whose name begins with `production-`. Creating or pushing the tag does not
deploy by itself.

1. Fetch `main` and select a green commit that is contained in `origin/main`.
2. Create and push a clearly dated `production-*` tag pointing to that exact
   commit.
3. In GitHub Actions, select the manual production workflow and choose that tag
   as the workflow ref.
4. Enter the same full lowercase 40-character commit SHA in `production_sha`.
5. Enter the exact uppercase value `DEPLOY` in `confirm_production` and dispatch
   the workflow.

The workflow rejects a branch ref, a non-production tag, a different dispatch
SHA, a commit outside `origin/main`, and confirmation values such as `deploy`,
`Deploy`, `YES`, or `true`. It validates and packages the exact selected commit,
then reconfirms the ref and ancestry immediately before publication. Production
deployments are serialized and never cancel one another.

Only the final production job receives `pages: write` and deployment-specific
`id-token: write`. It targets the existing `github-pages` environment, whose
deployment policy accepts only `production-*` tags. The environment currently
adds no required-reviewer or wait-timer approval gate, so no such approval is
implied by this contract.

## Verification and failure handling

After a release, verify that the workflow summary and GitHub deployment record
both report the selected SHA before checking the production URL. If validation
or deployment fails, inspect the failed job and correct the problem through a
normal pull request. Do not blindly rerun, change the tag, roll back code, or
dispatch another production release without confirming the intended SHA and
the current production state.

Codex coding tasks must never dispatch the Pages production workflow unless the
user explicitly authorizes that exact publication path in the task and the
current release contract requires it. A request to commit, push, open or merge
a pull request—or authorization to verify Render—is not authorization to use
GitHub Pages as a substitute.
