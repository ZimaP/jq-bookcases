import assert from "node:assert/strict";
import test from "node:test";

import { auditWorkflowSources } from "../scripts/validate-workflow-policy.mjs";

const safePullRequest = `
name: Pull request validation
on:
  pull_request:
    branches: [main]
permissions:
  contents: read
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - run: npm test
`;

const safeMain = `
name: Main validation
on:
  push:
    branches:
      - main
permissions: { contents: read }
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - run: npm run build
`;

const exactProductionGuard = "github.event_name == 'workflow_dispatch' && inputs.confirm_production == 'DEPLOY' && startsWith(github.ref, 'refs/tags/production-')";

function manualDeployment(
  condition = exactProductionGuard,
  deployCondition = `${condition} && needs.release.result == 'success'`,
  deployRef = "${{ inputs.production_sha }}",
) {
  return `
name: Deploy GitHub Pages — Manual Production Release
on:
  workflow_dispatch:
    inputs:
      confirm_production:
        required: true
        type: string
      production_sha:
        required: true
        type: string
permissions:
  contents: read
concurrency:
  group: pages-production
  cancel-in-progress: false
jobs:
  release:
    if: \${{ ${condition} }}
    permissions:
      contents: read
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          ref: \${{ inputs.production_sha }}
          fetch-depth: 0
      - name: Verify selected production commit
        env:
          DISPATCH_SHA: \${{ github.sha }}
          PRODUCTION_SHA: \${{ inputs.production_sha }}
        run: |
          test "$DISPATCH_SHA" = "$PRODUCTION_SHA"
          test "$(git rev-parse HEAD)" = "$PRODUCTION_SHA"
          git fetch --no-tags origin main
          git merge-base --is-ancestor "$PRODUCTION_SHA" FETCH_HEAD
      - run: npm run build
      - run: npm test
      - run: npm run test:browser -- --project=chromium
  deploy:
    if: \${{ ${deployCondition} }}
    needs: release
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          ref: ${deployRef}
          fetch-depth: 0
      - name: Reverify selected production commit
        env:
          DISPATCH_SHA: \${{ github.sha }}
          PRODUCTION_SHA: \${{ inputs.production_sha }}
        run: |
          test "$DISPATCH_SHA" = "$PRODUCTION_SHA"
          test "$(git rev-parse HEAD)" = "$PRODUCTION_SHA"
          git fetch --no-tags origin main
          git merge-base --is-ancestor "$PRODUCTION_SHA" FETCH_HEAD
      - uses: actions/upload-pages-artifact@v5
        with:
          path: _site
      - id: deployment
        uses: actions/deploy-pages@v5
`;
}

function codes(result) {
  return new Set(result.violations.map((violation) => violation.code));
}

test("safe pull-request validation has no production capability", () => {
  assert.deepEqual(auditWorkflowSources({ ".github/workflows/pr.yml": safePullRequest }).violations, []);
});

test("safe main validation has no production capability", () => {
  assert.deepEqual(auditWorkflowSources({ ".github/workflows/main.yml": safeMain }).violations, []);
});

test("safe manual deployment binds an exact production tag SHA and isolates permissions", () => {
  const result = auditWorkflowSources({ ".github/workflows/deploy.yml": manualDeployment() }, { requireManualDeployment: true });
  assert.deepEqual(result.violations, []);
});

test("push deployment is prohibited", () => {
  const source = manualDeployment().replace("workflow_dispatch:\n    inputs:", "push:\n    branches: [main]\n  workflow_dispatch:\n    inputs:");
  const result = auditWorkflowSources({ ".github/workflows/deploy.yml": source });
  assert.ok(codes(result).has("AUTOMATIC_PRODUCTION_PATH"));
  assert.ok(codes(result).has("DEPLOYMENT_NOT_MANUAL_ONLY"));
});

test("pull-request deployment is prohibited", () => {
  const source = manualDeployment().replace("workflow_dispatch:\n    inputs:", "pull_request:\n    branches: [main]\n  workflow_dispatch:\n    inputs:");
  const result = auditWorkflowSources({ ".github/workflows/deploy.yml": source });
  assert.ok(codes(result).has("AUTOMATIC_PRODUCTION_PATH"));
  assert.ok(codes(result).has("DEPLOYMENT_NOT_MANUAL_ONLY"));
});

test("workflow-run deployment is prohibited", () => {
  const source = manualDeployment().replace("workflow_dispatch:\n    inputs:", "workflow_run:\n    workflows: [Main validation]\n    types: [completed]\n  workflow_dispatch:\n    inputs:");
  const result = auditWorkflowSources({ ".github/workflows/deploy.yml": source });
  assert.ok(codes(result).has("AUTOMATIC_PRODUCTION_PATH"));
});

test("deployment permissions in automatic validation are prohibited", () => {
  const source = safeMain.replace("permissions: { contents: read }", "permissions: { contents: read, pages: write }");
  const result = auditWorkflowSources({ ".github/workflows/main.yml": source });
  assert.ok(codes(result).has("WORKFLOW_DEPLOY_PERMISSION"));
});

test("permissions write-all is prohibited in automatic validation", () => {
  const source = safeMain.replace("permissions: { contents: read }", "permissions: write-all");
  const result = auditWorkflowSources({ ".github/workflows/main.yml": source });
  assert.ok(codes(result).has("WORKFLOW_DEPLOY_PERMISSION"));
});

test("automatic local reusable deployment calls are prohibited", () => {
  const caller = `
name: Main validation
on: push
permissions: { contents: read }
jobs:
  release:
    uses: ./.github/workflows/reusable-deploy.yml
`;
  const reusable = manualDeployment().replace("workflow_dispatch:\n    inputs:", "workflow_call:\n  workflow_dispatch:\n    inputs:");
  const result = auditWorkflowSources({
    ".github/workflows/main.yml": caller,
    ".github/workflows/reusable-deploy.yml": reusable,
  });
  assert.ok(codes(result).has("AUTOMATIC_REUSABLE_DEPLOYMENT"));
});

test("root flow mappings cannot hide jobs", () => {
  const source = `
name: Hidden root deployment
on: push
permissions: { contents: read }
jobs: { release: { runs-on: ubuntu-latest, steps: [{ uses: actions/deploy-pages@v5 }] } }
`;
  const fullDocument = "{ name: Hidden root deployment, on: push, jobs: { release: { steps: [{ uses: actions/deploy-pages@v5 }] } } }";
  for (const candidate of [source, fullDocument]) {
    const result = auditWorkflowSources({ ".github/workflows/hidden.yml": candidate });
    assert.ok(codes(result).has("UNSUPPORTED_FLOW_STRUCTURE"));
  }
});

test("flow-style step mappings and sequences fail closed", () => {
  const sequenceItem = `
name: Hidden step deployment
on: push
permissions: { contents: read }
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - { uses: actions/deploy-pages@v5 }
`;
  const inlineSteps = sequenceItem.replace(
    "steps:\n      - { uses: actions/deploy-pages@v5 }",
    "steps: [{ uses: actions/deploy-pages@v5 }]",
  );
  for (const source of [sequenceItem, inlineSteps]) {
    const result = auditWorkflowSources({ ".github/workflows/hidden.yml": source });
    assert.ok(codes(result).has("UNSUPPORTED_FLOW_STRUCTURE"));
  }
});

test("YAML anchors and aliases cannot hide deployment structure", () => {
  const source = `
name: Anchored deployment
on: push
permissions: { contents: read }
hidden-step: &deployment { uses: actions/deploy-pages@v5 }
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - *deployment
`;
  const result = auditWorkflowSources({ ".github/workflows/anchored.yml": source });
  assert.ok(codes(result).has("YAML_INDIRECTION"));
  assert.ok(result.violations.filter((violation) => violation.code === "YAML_INDIRECTION").length >= 2);
});

test("YAML-only double-quoted escapes cannot hide a push deployment", () => {
  const hiddenScalars = String.raw`
name: Escaped deployment
on: push
permissions: { contents: read }
jobs:
  deploy:
    permissions:
      pages: "wr\x69te"
      id-token: "wr\x69te"
    environment: "github\x2dpages"
    runs-on: ubuntu-latest
    steps:
      - uses: "actions/deploy\x2dpages@v5"
`;
  const hiddenKey = String.raw`
name: Escaped permission key
on: push
jobs:
  deploy:
    permissions:
      "pa\x67es": write
    runs-on: ubuntu-latest
    steps: []
`;
  for (const source of [hiddenScalars, hiddenKey]) {
    const result = auditWorkflowSources({ ".github/workflows/escaped.yml": source });
    assert.ok(codes(result).has("UNSUPPORTED_DOUBLE_QUOTED_SCALAR"));
  }
});

test("explicit YAML tags and directives cannot hide a push deployment", () => {
  const tagged = `
name: Tagged deployment
on: push
permissions: { contents: read }
jobs:
  deploy:
    permissions:
      pages: !!str write
      id-token: !!str write
    environment: !!str github-pages
    runs-on: ubuntu-latest
    steps:
      - uses: !!str actions/deploy-pages@v5
`;
  const directed = `%YAML 1.2
---
name: Directed workflow
on: push
jobs: {}
`;
  const taggedResult = auditWorkflowSources({ ".github/workflows/tagged.yml": tagged });
  const directedResult = auditWorkflowSources({ ".github/workflows/directed.yml": directed });
  assert.ok(codes(taggedResult).has("UNSUPPORTED_YAML_TAG"));
  assert.ok(codes(directedResult).has("UNSUPPORTED_YAML_DIRECTIVE"));
});

for (const [label, confirmation] of [
  ["blank", ""],
  ["lowercase", "deploy"],
  ["title case", "Deploy"],
  ["yes", "YES"],
  ["boolean-like", "true"],
]) {
  test(`manual deployment rejects ${label} confirmation`, () => {
    const condition = `github.event_name == 'workflow_dispatch' && inputs.confirm_production == '${confirmation}' && startsWith(github.ref, 'refs/tags/production-')`;
    const result = auditWorkflowSources({ ".github/workflows/deploy.yml": manualDeployment(condition) });
    assert.ok(codes(result).has("UNSAFE_PRODUCTION_GUARD"));
  });
}

test("automatic Pages artifact upload is prohibited without a deploy step", () => {
  const source = `${safeMain}\n`.replace("      - run: npm run build", "      - uses: actions/upload-pages-artifact@v5");
  const result = auditWorkflowSources({ ".github/workflows/main.yml": source });
  assert.ok(codes(result).has("AUTOMATIC_PRODUCTION_PATH"));
});

test("automatic production environment is prohibited without a deploy action", () => {
  const source = safeMain.replace("    runs-on: ubuntu-latest", "    environment: github-pages\n    runs-on: ubuntu-latest");
  const result = auditWorkflowSources({ ".github/workflows/main.yml": source });
  assert.ok(codes(result).has("AUTOMATIC_PRODUCTION_PATH"));
});

test("workflow-level deployment permissions are prohibited even for manual release", () => {
  const source = manualDeployment().replace("permissions:\n  contents: read", "permissions:\n  contents: read\n  pages: write\n  id-token: write");
  const result = auditWorkflowSources({ ".github/workflows/deploy.yml": source });
  assert.ok(codes(result).has("WORKFLOW_DEPLOY_PERMISSION"));
});

test("confirmation input may not default to DEPLOY", () => {
  const source = manualDeployment().replace("confirm_production:\n        required: true", "confirm_production:\n        required: true\n        default: DEPLOY");
  const result = auditWorkflowSources({ ".github/workflows/deploy.yml": source });
  assert.ok(codes(result).has("UNSAFE_CONFIRMATION_INPUT"));
});

test("manual deployment requires a production-tag ref guard", () => {
  const condition = "github.event_name == 'workflow_dispatch' && inputs.confirm_production == 'DEPLOY'";
  const result = auditWorkflowSources({ ".github/workflows/deploy.yml": manualDeployment(condition) });
  assert.ok(codes(result).has("UNSAFE_PRODUCTION_GUARD"));
});

test("manual deployment guard rejects extra and negated clauses", () => {
  const extra = auditWorkflowSources({
    ".github/workflows/deploy.yml": manualDeployment(`${exactProductionGuard} && true`),
  });
  const negated = auditWorkflowSources({
    ".github/workflows/deploy.yml": manualDeployment(
      "github.event_name == 'workflow_dispatch' && !(inputs.confirm_production != 'DEPLOY') && startsWith(github.ref, 'refs/tags/production-')",
    ),
  });
  assert.ok(codes(extra).has("UNSAFE_PRODUCTION_GUARD"));
  assert.ok(codes(negated).has("UNSAFE_PRODUCTION_GUARD"));
});

test("manual deployment guard permits only an additional successful need", () => {
  const result = auditWorkflowSources({
    ".github/workflows/deploy.yml": manualDeployment(
      exactProductionGuard,
      `${exactProductionGuard} && needs.release.result == 'success'`,
    ),
  });
  assert.deepEqual(result.violations, []);
});

test("manual deployment binds production_sha to github.sha and main ancestry", () => {
  const source = manualDeployment()
    .replaceAll('test "$DISPATCH_SHA" = "$PRODUCTION_SHA"', 'test -n "$PRODUCTION_SHA"')
    .replaceAll('git merge-base --is-ancestor "$PRODUCTION_SHA" FETCH_HEAD', 'git rev-parse "$PRODUCTION_SHA"');
  const result = auditWorkflowSources({ ".github/workflows/deploy.yml": source });
  assert.ok(codes(result).has("UNBOUND_PRODUCTION_SHA"));
});

test("an inequality does not satisfy the production SHA equality contract", () => {
  const source = manualDeployment().replaceAll(
    'test "$DISPATCH_SHA" = "$PRODUCTION_SHA"',
    'test "$DISPATCH_SHA" != "$PRODUCTION_SHA"',
  );
  const result = auditWorkflowSources({ ".github/workflows/deploy.yml": source });
  assert.ok(codes(result).has("UNBOUND_PRODUCTION_SHA"));
});

test("every publisher job must checkout the selected production SHA", () => {
  const source = manualDeployment(exactProductionGuard, undefined, "main");
  const result = auditWorkflowSources({ ".github/workflows/deploy.yml": source });
  assert.ok(codes(result).has("UNBOUND_PRODUCTION_SHA"));
  assert.match(
    result.violations.find((violation) => violation.code === "UNBOUND_PRODUCTION_SHA")?.message ?? "",
    /publisher job deploy/,
  );
});

test("publisher checkout rejects expressions that merely mention production_sha", () => {
  const source = manualDeployment(
    exactProductionGuard,
    undefined,
    "${{ inputs.production_sha && 'main' }}",
  );
  const result = auditWorkflowSources({ ".github/workflows/deploy.yml": source });
  assert.ok(codes(result).has("UNBOUND_PRODUCTION_SHA"));
});

test("publisher environment bindings must be canonical expressions", () => {
  const productionBinding = manualDeployment().replaceAll(
    "PRODUCTION_SHA: ${{ inputs.production_sha }}",
    "PRODUCTION_SHA: ${{ inputs.production_sha && 'main' }}",
  );
  const dispatchBinding = manualDeployment().replaceAll(
    "DISPATCH_SHA: ${{ github.sha }}",
    "DISPATCH_SHA: ${{ github.sha || 'main' }}",
  );
  for (const source of [productionBinding, dispatchBinding]) {
    const result = auditWorkflowSources({ ".github/workflows/deploy.yml": source });
    assert.ok(codes(result).has("UNBOUND_PRODUCTION_SHA"));
  }
});

test("negated equality cannot prove the selected production SHA", () => {
  const source = manualDeployment().replaceAll(
    'test "$DISPATCH_SHA" = "$PRODUCTION_SHA"',
    '! test "$DISPATCH_SHA" = "$PRODUCTION_SHA"',
  );
  const result = auditWorkflowSources({ ".github/workflows/deploy.yml": source });
  assert.ok(codes(result).has("UNBOUND_PRODUCTION_SHA"));
});

test("publisher must prove the runtime checkout HEAD", () => {
  const source = manualDeployment().replaceAll(
    'test "$(git rev-parse HEAD)" = "$PRODUCTION_SHA"',
    'echo "unchecked HEAD"',
  );
  const result = auditWorkflowSources({ ".github/workflows/deploy.yml": source });
  assert.ok(codes(result).has("UNBOUND_PRODUCTION_SHA"));
});

test("publisher ancestry requires a fresh main fetch and FETCH_HEAD", () => {
  const selfAncestry = manualDeployment().replaceAll(
    'git merge-base --is-ancestor "$PRODUCTION_SHA" FETCH_HEAD',
    'git merge-base --is-ancestor "$PRODUCTION_SHA" "$PRODUCTION_SHA"',
  );
  const staleRemote = manualDeployment().replaceAll(
    'git merge-base --is-ancestor "$PRODUCTION_SHA" FETCH_HEAD',
    'git merge-base --is-ancestor "$PRODUCTION_SHA" origin/main',
  );
  const noFetch = manualDeployment().replaceAll("          git fetch --no-tags origin main\n", "");
  const overwrittenFetchHead = manualDeployment().replaceAll(
    "          git fetch --no-tags origin main\n          git merge-base",
    "          git fetch --no-tags origin main\n          git fetch --no-tags origin \"$GITHUB_REF\"\n          git merge-base",
  );
  for (const source of [selfAncestry, staleRemote, noFetch, overwrittenFetchHead]) {
    const result = auditWorkflowSources({ ".github/workflows/deploy.yml": source });
    assert.ok(codes(result).has("UNBOUND_PRODUCTION_SHA"));
  }
});

test("deploy-pages must depend on the successful distinct validation job", () => {
  const noDependency = manualDeployment()
    .replace("    needs: release\n", "")
    .replace(" && needs.release.result == 'success'", "");
  const noSuccessGuard = manualDeployment(exactProductionGuard, exactProductionGuard);
  const noReleaseChecks = manualDeployment()
    .replace("      - run: npm run build\n", "")
    .replace("      - run: npm test\n", "")
    .replace("      - run: npm run test:browser -- --project=chromium\n", "");
  for (const source of [noDependency, noSuccessGuard, noReleaseChecks]) {
    const result = auditWorkflowSources({ ".github/workflows/deploy.yml": source });
    assert.ok(codes(result).has("MISSING_RELEASE_VALIDATION"));
  }
});

test("automatic actions-write workflow cannot bridge into manual deployment", () => {
  const source = `
name: Push bridge
on: push
permissions:
  contents: read
  actions: write
jobs:
  bridge:
    runs-on: ubuntu-latest
    steps:
      - run: |
          gh workflow run \\
            deploy-pages-production.yml \\
            --ref production-candidate
`;
  const result = auditWorkflowSources({ ".github/workflows/bridge.yml": source });
  assert.ok(codes(result).has("WORKFLOW_ACTIONS_PERMISSION"));
  assert.ok(codes(result).has("WORKFLOW_DISPATCH_BRIDGE"));
  assert.ok(codes(result).has("AUTOMATIC_PRODUCTION_PATH"));
  assert.ok(codes(result).has("DEPLOYMENT_NOT_MANUAL_ONLY"));
});

test("workflow-dispatch REST APIs and common dispatch actions are prohibited", () => {
  const apiBridge = `
name: API bridge
on: push
permissions: { contents: read }
jobs:
  bridge:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl --request POST \\
            "$GITHUB_API_URL/repos/example/repository/actions/workflows/deploy.yml/dispatches"
`;
  const actionBridge = `
name: Action bridge
on: push
permissions: { contents: read }
jobs:
  bridge:
    runs-on: ubuntu-latest
    steps:
      - uses: benc-uk/workflow-dispatch@v1
`;
  for (const source of [apiBridge, actionBridge]) {
    const result = auditWorkflowSources({ ".github/workflows/bridge.yml": source });
    assert.ok(codes(result).has("WORKFLOW_DISPATCH_BRIDGE"));
    assert.ok(codes(result).has("AUTOMATIC_PRODUCTION_PATH"));
  }
});

test("workflow and job rerun bridges are prohibited without relying on token permissions", () => {
  const commands = [
    "gh run rerun 12345",
    'curl --request POST "$GITHUB_API_URL/repos/example/repository/actions/runs/12345/rerun"',
    'curl --request POST "$GITHUB_API_URL/repos/example/repository/actions/runs/12345/rerun-failed-jobs"',
    'curl --request POST "$GITHUB_API_URL/repos/example/repository/actions/jobs/67890/rerun"',
    "github.rest.actions.reRunWorkflow({ owner, repo, run_id })",
    "github.rest.actions.reRunWorkflowFailedJobs({ owner, repo, run_id })",
    "github.rest.actions.reRunJob({ owner, repo, job_id })",
  ];
  for (const command of commands) {
    const source = `
name: Rerun bridge
on: push
permissions: { contents: read }
jobs:
  bridge:
    runs-on: ubuntu-latest
    steps:
      - run: |
          ${command}
`;
    const result = auditWorkflowSources({ ".github/workflows/rerun.yml": source });
    assert.ok(codes(result).has("WORKFLOW_DISPATCH_BRIDGE"), command);
    assert.ok(codes(result).has("AUTOMATIC_PRODUCTION_PATH"), command);
  }
});

test("multiline automatic deployment API calls are prohibited and treated as deployments", () => {
  const source = `
name: API deployment
on: push
permissions: { contents: read }
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - run: |
          gh api \\
            --method POST \\
            /repos/example/repository/deployments
`;
  const result = auditWorkflowSources({ ".github/workflows/api.yml": source });
  assert.ok(codes(result).has("DIRECT_DEPLOYMENT_API"));
  assert.ok(codes(result).has("AUTOMATIC_PRODUCTION_PATH"));
  assert.ok(codes(result).has("UNSAFE_PRODUCTION_GUARD"));
  assert.ok(codes(result).has("DEPLOYMENT_NOT_MANUAL_ONLY"));
});

test("a direct deployment API workflow counts as a second production path", () => {
  const directApi = manualDeployment().replace(
    "      - id: deployment\n        uses: actions/deploy-pages@v5",
    `      - name: Direct deployment API
        run: |
          gh api \\
            --method POST \\
            /repos/example/repository/deployments`,
  );
  const result = auditWorkflowSources(
    {
      ".github/workflows/deploy.yml": manualDeployment(),
      ".github/workflows/direct-api.yml": directApi,
    },
    { requireManualDeployment: true },
  );
  assert.ok(codes(result).has("DIRECT_DEPLOYMENT_API"));
  assert.ok(codes(result).has("MANUAL_DEPLOYMENT_COUNT"));
  assert.equal(result.deploymentWorkflows.length, 2);
});
