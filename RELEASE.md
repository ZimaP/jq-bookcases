# Production release contract

Merging code and publishing the website are separate actions. Pull requests and
pushes to `main` run validation only; neither event may upload a GitHub Pages
artifact, target the production environment, or request a deployment.

## Validation

The following workflows run without deployment permissions:

- `Engine quality gate` runs the build and complete unit, contract, matrix, and
  hostile-input suite on supported Node.js versions.
- `Browser configurator quality gate` runs the complete Chromium, Firefox, and
  WebKit suite.
- `Pages release validation` runs the build, tests, and Chromium release gate.

All checks for the intended commit must be green before creating a production
release tag.

## Manual production release

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

Codex coding tasks must never dispatch the production workflow unless the user
explicitly authorizes deployment in that task. A request to commit, push, open
or merge a pull request is not deployment authorization.
