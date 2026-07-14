import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const AUTOMATIC_EVENTS = new Set([
  "branch_protection_rule",
  "check_run",
  "check_suite",
  "create",
  "delete",
  "deployment",
  "deployment_status",
  "discussion",
  "discussion_comment",
  "fork",
  "gollum",
  "issue_comment",
  "issues",
  "label",
  "merge_group",
  "milestone",
  "page_build",
  "project",
  "project_card",
  "project_column",
  "public",
  "pull_request",
  "pull_request_review",
  "pull_request_review_comment",
  "pull_request_target",
  "push",
  "registry_package",
  "release",
  "repository_dispatch",
  "schedule",
  "status",
  "watch",
  "workflow_call",
  "workflow_run",
]);

const DEPLOYMENT_API_PATTERN = /(?:(?:api\.github\.com|\bgh\s+api\b|\bcurl\b)[^\n]*(?:\/deployments?\b|\/pages\/(?:builds?|deployments?)\b)|\b(?:createDeployment|createPagesDeployment|requestPagesBuild)\b)/i;
const WORKFLOW_DISPATCH_PATTERN = /(?:\bgh\s+(?:workflow\s+run|run\s+rerun)\b|\/actions\/workflows\/[^/\s"']+\/dispatches\b|\/actions\/runs\/[^/\s"']+\/(?:rerun|rerun-failed-jobs)\b|\/actions\/jobs\/[^/\s"']+\/rerun\b|\bcreateWorkflowDispatch\b|\breRun(?:Workflow(?:FailedJobs)?|Job)\b)/i;
const WORKFLOW_DISPATCH_ACTION_PATTERN = /^[^/@]+\/[^/@]*(?:workflow-dispatch|dispatch-workflow|trigger-workflow)[^/@]*@/i;
const PRODUCTION_REF_CLAUSE = /^startsWith\s*\(\s*github\.ref\s*,\s*(['"])refs\/tags\/production-\1\s*\)$/;
const EVENT_GUARD_CLAUSE = /^github\.event_name\s*==\s*(['"])workflow_dispatch\1$/;
const CONFIRMATION_GUARD_CLAUSE = /^inputs\.confirm_production\s*==\s*(['"])DEPLOY\1$/;
const NEEDS_SUCCESS_CLAUSE = /^needs\.([A-Za-z0-9_-]+)\.result\s*==\s*(['"])success\2$/;
const FLOW_INDIRECTION_PATTERN = /(?:^|[,[{:])\s*[&*][^\s,[\]{}]+(?:\s|[,}\]]|$)/;

function stripComment(value) {
  let single = false;
  let double = false;
  let escaped = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (double && character === "\\" && !escaped) {
      escaped = true;
      continue;
    }
    if (!double && character === "'" && !escaped) single = !single;
    else if (!single && character === '"' && !escaped) double = !double;
    else if (character === "#" && !single && !double && (index === 0 || /\s/.test(value[index - 1]))) {
      return value.slice(0, index).trimEnd();
    }
    escaped = false;
  }
  return value.trimEnd();
}

function findMappingColon(value) {
  let single = false;
  let double = false;
  let escaped = false;
  let square = 0;
  let curly = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (double && character === "\\" && !escaped) {
      escaped = true;
      continue;
    }
    if (!double && character === "'" && !escaped) single = !single;
    else if (!single && character === '"' && !escaped) double = !double;
    else if (!single && !double) {
      if (character === "[") square += 1;
      else if (character === "]") square -= 1;
      else if (character === "{") curly += 1;
      else if (character === "}") curly -= 1;
      else if (character === ":" && square === 0 && curly === 0) return index;
    }
    escaped = false;
  }
  return -1;
}

function unquote(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith("!")) {
    const error = new Error(`explicit YAML tags are unsupported: ${trimmed}`);
    error.code = "UNSUPPORTED_YAML_TAG";
    throw error;
  }
  if (trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replaceAll("''", "'");
  }
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      const error = new Error(`double-quoted YAML scalar is outside the supported JSON escape subset: ${trimmed}`);
      error.code = "UNSUPPORTED_DOUBLE_QUOTED_SCALAR";
      throw error;
    }
  }
  return trimmed;
}

function splitFlow(value) {
  const result = [];
  let start = 0;
  let single = false;
  let double = false;
  let escaped = false;
  let square = 0;
  let curly = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (double && character === "\\" && !escaped) {
      escaped = true;
      continue;
    }
    if (!double && character === "'" && !escaped) single = !single;
    else if (!single && character === '"' && !escaped) double = !double;
    else if (!single && !double) {
      if (character === "[") square += 1;
      else if (character === "]") square -= 1;
      else if (character === "{") curly += 1;
      else if (character === "}") curly -= 1;
      else if (character === "," && square === 0 && curly === 0) {
        result.push(value.slice(start, index).trim());
        start = index + 1;
      }
    }
    escaped = false;
  }
  result.push(value.slice(start).trim());
  return result.filter(Boolean);
}

function parseFlowList(value) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return null;
  return splitFlow(trimmed.slice(1, -1)).map(unquote);
}

function parseFlowMap(value) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;
  const entries = new Map();
  for (const item of splitFlow(trimmed.slice(1, -1))) {
    const colon = findMappingColon(item);
    if (colon === -1) throw new Error(`Invalid inline mapping entry: ${item}`);
    entries.set(unquote(item.slice(0, colon)), unquote(item.slice(colon + 1)));
  }
  return entries;
}

function beginsYamlIndirection(value) {
  return /^[&*][^\s,[\]{}]+(?:\s|$)/.test(value.trim());
}

function normalizeExecutableSource(value) {
  return value.replace(/\\\s*\n\s*/g, " ").replace(/\s*\n\s*/g, " ");
}

function exactProductionShaExpression(value) {
  return /^\$\{\{\s*inputs\.production_sha\s*\}\}$/.test(value.trim());
}

function exactGithubShaExpression(value) {
  return /^\$\{\{\s*github\.sha\s*\}\}$/.test(value.trim());
}

function pathKey(segments) {
  return segments.join("\u001f");
}

function isSynthetic(segment) {
  return segment?.startsWith("#");
}

function semanticPath(segments) {
  return segments.filter((segment) => !isSynthetic(segment));
}

/**
 * Parse the indentation and scalar structure needed by GitHub Actions policy.
 * It intentionally rejects YAML indirection instead of trying to resolve it.
 */
export function scanWorkflow(source, file = "workflow.yml") {
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  const records = [];
  const errors = [];
  const stack = [];
  const seen = new Map();
  let sequence = 0;
  let block = null;

  function addRecord(pathSegments, value, line, indent) {
    const normalizedPath = semanticPath(pathSegments);
    const key = pathKey(pathSegments);
    if (seen.has(key)) {
      errors.push({
        file,
        line,
        code: "DUPLICATE_KEY",
        message: `duplicate mapping key ${normalizedPath.join(".")}`,
      });
    } else {
      seen.set(key, line);
    }
    const record = { file, line, indent, path: pathSegments, semanticPath: normalizedPath, value };
    records.push(record);
    return record;
  }

  function finishBlock() {
    if (!block) return;
    const meaningful = block.lines.filter((line) => line.trim()).map((line) => line.match(/^\s*/)[0].length);
    const margin = meaningful.length ? Math.min(...meaningful) : 0;
    block.record.value = block.lines.map((line) => line.slice(Math.min(margin, line.length))).join("\n");
    block = null;
  }

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const line = index + 1;
    if (/^\s*\t/.test(raw) || /^ +\t/.test(raw)) {
      errors.push({ file, line, code: "TAB_INDENT", message: "tabs are not allowed in workflow indentation" });
      continue;
    }
    const indent = raw.match(/^ */)[0].length;

    if (block) {
      if (!raw.trim() || indent > block.indent) {
        block.lines.push(raw);
        continue;
      }
      finishBlock();
    }

    const withoutComment = stripComment(raw.slice(indent));
    if (!withoutComment.trim() || withoutComment.trim() === "---" || withoutComment.trim() === "...") continue;
    while (stack.length && stack.at(-1).indent >= indent) stack.pop();

    let content = withoutComment.trim();
    let parentPath = stack.map((entry) => entry.key);
    if (content.startsWith("%")) {
      errors.push({ file, line, code: "UNSUPPORTED_YAML_DIRECTIVE", message: "explicit YAML directives are unsupported in workflows" });
      continue;
    }
    let sequenceItem = false;
    if (content === "-" || content.startsWith("- ")) {
      sequenceItem = true;
      const marker = `#${sequence += 1}`;
      stack.push({ indent, key: marker });
      parentPath = [...parentPath, marker];
      content = content.slice(1).trim();
      if (!content) continue;
    }

    const sequenceContext = semanticPath(parentPath);
    if (beginsYamlIndirection(content)) {
      errors.push({ file, line, code: "YAML_INDIRECTION", message: "YAML anchors and aliases are not allowed in workflows" });
    }
    if (!parentPath.length && /^[{[]/.test(content)) {
      errors.push({ file, line, code: "UNSUPPORTED_FLOW_STRUCTURE", message: "a flow-style root mapping may not hide workflow jobs or triggers" });
    }
    if (sequenceItem && sequenceContext.includes("steps") && /^[{[]/.test(content)) {
      errors.push({ file, line, code: "UNSUPPORTED_FLOW_STRUCTURE", message: "flow-style step mappings and sequences are not allowed" });
    }

    const colon = findMappingColon(content);
    if (colon === -1) {
      if (parentPath.some(isSynthetic)) {
        addRecord([...parentPath, "$value"], unquote(content), line, indent);
      } else {
        errors.push({ file, line, code: "UNSUPPORTED_YAML", message: `expected a mapping entry, found: ${content}` });
      }
      continue;
    }

    const key = unquote(content.slice(0, colon));
    const value = stripComment(content.slice(colon + 1)).trim();
    if (!key) {
      errors.push({ file, line, code: "EMPTY_KEY", message: "workflow mapping keys may not be empty" });
      continue;
    }
    if (key === "<<" || beginsYamlIndirection(key) || beginsYamlIndirection(value) || FLOW_INDIRECTION_PATTERN.test(value)) {
      errors.push({ file, line, code: "YAML_INDIRECTION", message: "YAML anchors, aliases, and merge keys are not allowed in workflows" });
    }
    const recordPath = [...parentPath, key];
    const normalizedPath = semanticPath(recordPath);
    if (
      (/^[{[]/.test(value) && normalizedPath[0] === "jobs" && normalizedPath.length <= 2)
      || (/^[{[]/.test(value) && normalizedPath.at(-1) === "steps")
    ) {
      errors.push({ file, line, code: "UNSUPPORTED_FLOW_STRUCTURE", message: "flow-style jobs and steps may not hide workflow policy structure" });
    }
    const record = addRecord(recordPath, unquote(value), line, indent);
    if (/^[|>][-+]?\d*$/.test(value)) {
      block = { record, indent, lines: [] };
    } else if (!value) {
      stack.push({ indent, key });
    }
  }
  finishBlock();
  return { file, source, records, errors };
}

function scalarBoolean(value) {
  if (String(value).toLowerCase() === "true") return true;
  if (String(value).toLowerCase() === "false") return false;
  return null;
}

function workflowFacts(parsed) {
  const events = new Set();
  const jobs = new Map();
  const workflowPermissions = new Map();
  const dispatchInputs = new Map();
  const concurrency = {};

  function job(id) {
    if (!jobs.has(id)) {
      jobs.set(id, {
        id,
        line: null,
        condition: "",
        reusable: null,
        needs: new Set(),
        permissions: new Map(),
        environment: "",
        actions: [],
        runs: [],
        env: new Map(),
        jobEnv: new Map(),
        steps: new Map(),
      });
    }
    return jobs.get(id);
  }

  for (const record of parsed.records) {
    const pathSegments = record.semanticPath;
    if (pathSegments.length === 1 && pathSegments[0] === "on") {
      const list = parseFlowList(record.value);
      if (list) list.forEach((event) => events.add(event));
      else {
        const inline = parseFlowMap(record.value);
        if (inline) [...inline.keys()].forEach((event) => events.add(event));
        else if (record.value) events.add(record.value);
      }
    } else if (pathSegments[0] === "on" && pathSegments.length === 2 && pathSegments[1] !== "$value") {
      events.add(pathSegments[1]);
    } else if (pathSegments[0] === "on" && pathSegments.length === 2 && pathSegments.at(-1) === "$value") {
      events.add(record.value);
    }

    if (pathSegments[0] === "permissions") {
      if (pathSegments.length === 1) {
        const inline = parseFlowMap(record.value);
        if (inline) for (const [key, value] of inline) workflowPermissions.set(key, { value, line: record.line });
        else if (record.value) workflowPermissions.set("*", { value: record.value, line: record.line });
      } else if (pathSegments.length === 2) {
        workflowPermissions.set(pathSegments[1], { value: record.value, line: record.line });
      }
    }

    if (pathSegments[0] === "concurrency") {
      if (pathSegments.length === 1) concurrency.value = record.value;
      else if (pathSegments.length === 2) concurrency[pathSegments[1]] = record.value;
    }

    if (pathSegments.slice(0, 3).join(".") === "on.workflow_dispatch.inputs" && pathSegments.length >= 4) {
      const inputName = pathSegments[3];
      if (!dispatchInputs.has(inputName)) dispatchInputs.set(inputName, { line: record.line });
      if (pathSegments.length === 5) dispatchInputs.get(inputName)[pathSegments[4]] = record.value;
    }

    if (pathSegments[0] !== "jobs" || pathSegments.length < 2) continue;
    const currentJob = job(pathSegments[1]);
    currentJob.line ??= record.line;
    if (pathSegments.length === 3 && pathSegments[2] === "if") currentJob.condition = record.value;
    if (pathSegments.length === 3 && pathSegments[2] === "uses") {
      currentJob.reusable = { value: record.value, line: record.line };
    }
    if (pathSegments.length === 3 && pathSegments[2] === "needs") {
      const needs = parseFlowList(record.value);
      if (needs) needs.forEach((need) => currentJob.needs.add(need));
      else if (record.value) currentJob.needs.add(record.value);
    }
    if (pathSegments.length === 4 && pathSegments[2] === "needs" && pathSegments[3] === "$value") {
      currentJob.needs.add(record.value);
    }
    if (pathSegments.length === 3 && pathSegments[2] === "environment") {
      const inline = parseFlowMap(record.value);
      currentJob.environment = inline?.get("name") ?? record.value;
    }
    if (pathSegments.length === 4 && pathSegments[2] === "environment" && pathSegments[3] === "name") {
      currentJob.environment = record.value;
    }
    if (pathSegments.length === 3 && pathSegments[2] === "permissions") {
      const inline = parseFlowMap(record.value);
      if (inline) for (const [key, value] of inline) currentJob.permissions.set(key, { value, line: record.line });
      else if (record.value) currentJob.permissions.set("*", { value: record.value, line: record.line });
    }
    if (pathSegments.length === 4 && pathSegments[2] === "permissions") {
      currentJob.permissions.set(pathSegments[3], { value: record.value, line: record.line });
    }

    const stepIndex = record.path.findIndex(isSynthetic);
    if (pathSegments.includes("steps") && stepIndex !== -1) {
      const marker = record.path[stepIndex];
      if (!currentJob.steps.has(marker)) currentJob.steps.set(marker, { actions: [], with: new Map(), env: new Map(), runs: [] });
      const step = currentJob.steps.get(marker);
      const key = pathSegments.at(-1);
      if (key === "uses") {
        step.actions.push({ value: record.value, line: record.line });
        currentJob.actions.push({ value: record.value, line: record.line });
      }
      if (key === "run") {
        step.runs.push({ value: record.value, line: record.line });
        currentJob.runs.push({ value: record.value, line: record.line });
      }
      const withIndex = pathSegments.indexOf("with");
      if (withIndex !== -1 && pathSegments.length === withIndex + 2) step.with.set(pathSegments.at(-1), record.value);
      const envIndex = pathSegments.indexOf("env");
      if (envIndex !== -1 && pathSegments.length === envIndex + 2) {
        step.env.set(pathSegments.at(-1), record.value);
        currentJob.env.set(pathSegments.at(-1), record.value);
      }
    } else {
      const envIndex = pathSegments.indexOf("env");
      if (envIndex !== -1 && pathSegments.length === envIndex + 2) {
        currentJob.env.set(pathSegments.at(-1), record.value);
        currentJob.jobEnv.set(pathSegments.at(-1), record.value);
      }
    }
  }

  return { ...parsed, events, jobs, workflowPermissions, dispatchInputs, concurrency };
}

function splitConjunction(value) {
  const clauses = [];
  let start = 0;
  let depth = 0;
  let quote = "";
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quote) {
      if (character === quote && value[index - 1] !== "\\") quote = "";
      continue;
    }
    if (character === "'" || character === '"') quote = character;
    else if (character === "(") depth += 1;
    else if (character === ")") {
      depth -= 1;
      if (depth < 0) return null;
    } else if (character === "&" && value[index + 1] === "&" && depth === 0) {
      clauses.push(value.slice(start, index).trim());
      start = index + 2;
      index += 1;
    }
  }
  if (quote || depth !== 0) return null;
  clauses.push(value.slice(start).trim());
  return clauses.every(Boolean) ? clauses : null;
}

function stripOuterParentheses(value) {
  let result = value.trim();
  while (result.startsWith("(") && result.endsWith(")")) {
    const clauses = splitConjunction(result.slice(1, -1));
    if (!clauses) break;
    result = result.slice(1, -1).trim();
  }
  return result;
}

function analyzeProductionGuard(condition) {
  let normalized = condition.trim();
  const opensExpression = normalized.startsWith("${{");
  const closesExpression = normalized.endsWith("}}");
  if (opensExpression !== closesExpression) return { valid: false, needs: new Set() };
  if (opensExpression) normalized = normalized.slice(3, -2).trim();
  normalized = stripOuterParentheses(normalized);
  const clauses = splitConjunction(normalized)?.map(stripOuterParentheses);
  if (!clauses) return { valid: false, needs: new Set() };

  let event = 0;
  let confirmation = 0;
  let productionRef = 0;
  const needs = new Set();
  for (const clause of clauses) {
    if (EVENT_GUARD_CLAUSE.test(clause)) event += 1;
    else if (CONFIRMATION_GUARD_CLAUSE.test(clause)) confirmation += 1;
    else if (PRODUCTION_REF_CLAUSE.test(clause)) productionRef += 1;
    else {
      const need = clause.match(NEEDS_SUCCESS_CLAUSE)?.[1];
      if (need) needs.add(need);
      else return { valid: false, needs: new Set() };
    }
  }
  return {
    valid: event === 1 && confirmation === 1 && productionRef === 1
      && clauses.length === 3 + needs.size,
    needs,
  };
}

function exactProductionGuard(condition) {
  return analyzeProductionGuard(condition).valid;
}

function localWorkflowReference(value) {
  const withoutRef = value.split("@", 1)[0].replace(/^\.\//, "");
  return withoutRef.startsWith(".github/workflows/") ? withoutRef : null;
}

function actionMatches(action, name) {
  return action.value.toLowerCase().startsWith(`${name.toLowerCase()}@`);
}

function actionDispatchesWorkflow(action) {
  return WORKFLOW_DISPATCH_ACTION_PATTERN.test(action.value);
}

function stepHasDeploymentApi(step) {
  const sources = [...step.runs.map((run) => run.value), ...step.with.values()];
  return sources.some((source) => DEPLOYMENT_API_PATTERN.test(normalizeExecutableSource(source)));
}

function jobCapabilities(currentJob) {
  const writeAll = currentJob.permissions.get("*")?.value.toLowerCase() === "write-all";
  const executableSources = [
    ...currentJob.runs.map((run) => run.value),
    ...[...currentJob.steps.values()].flatMap((step) => [...step.with.values()]),
  ];
  return {
    deploy: currentJob.actions.some((action) => actionMatches(action, "actions/deploy-pages")),
    artifact: currentJob.actions.some((action) => actionMatches(action, "actions/upload-pages-artifact")),
    configure: currentJob.actions.some((action) => actionMatches(action, "actions/configure-pages")),
    pagesWrite: writeAll || currentJob.permissions.get("pages")?.value.toLowerCase() === "write",
    idTokenWrite: writeAll || currentJob.permissions.get("id-token")?.value.toLowerCase() === "write",
    actionsWrite: writeAll || currentJob.permissions.get("actions")?.value.toLowerCase() === "write",
    contentsWrite: writeAll || currentJob.permissions.get("contents")?.value.toLowerCase() === "write",
    productionEnvironment: currentJob.environment === "github-pages" || currentJob.environment.includes("${{"),
    deploymentApi: executableSources.some((source) => DEPLOYMENT_API_PATTERN.test(normalizeExecutableSource(source))),
    workflowDispatch: currentJob.actions.some(actionDispatchesWorkflow)
      || executableSources.some((source) => WORKFLOW_DISPATCH_PATTERN.test(normalizeExecutableSource(source))),
  };
}

function jobRunsReleaseValidation(currentJob) {
  const commands = currentJob.runs.flatMap((run) => run.value.split("\n").map((line) => line.trim()).filter(Boolean));
  return commands.includes("npm run build")
    && commands.includes("npm test")
    && commands.some((command) => /^npm run test:browser(?:\s+--(?:\s+.+)?)?$/.test(command));
}

function jobShaBindingAndVerification(currentJob) {
  const steps = [...currentJob.steps.values()];
  let lastCheckoutBound = false;
  let publishers = 0;
  let checkoutBound = true;
  let firstPublisher = steps.length;
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    if (step.actions.some((action) => actionMatches(action, "actions/checkout"))) {
      lastCheckoutBound = exactProductionShaExpression(step.with.get("ref") ?? "");
    }
    const publishes = step.actions.some((action) => (
      actionMatches(action, "actions/deploy-pages")
      || actionMatches(action, "actions/upload-pages-artifact")
    )) || stepHasDeploymentApi(step);
    if (publishes) {
      publishers += 1;
      firstPublisher = Math.min(firstPublisher, index);
      checkoutBound &&= lastCheckoutBound;
    }
  }

  const envSources = [currentJob.jobEnv, ...steps.slice(0, firstPublisher).map((step) => step.env)];
  const effectiveEnv = new Map();
  for (const env of envSources) {
    for (const [name, value] of env) effectiveEnv.set(name, value);
  }
  const canonicalEnv = exactProductionShaExpression(effectiveEnv.get("PRODUCTION_SHA") ?? "")
    && exactGithubShaExpression(effectiveEnv.get("DISPATCH_SHA") ?? "");
  const runs = steps.slice(0, firstPublisher).flatMap((step) => step.runs.map((run) => run.value));
  const commandLines = runs.flatMap((run) => run.split("\n").map((line) => line.trim()).filter(Boolean));
  const comparison = commandLines.includes('test "$DISPATCH_SHA" = "$PRODUCTION_SHA"');
  const headMatchesCheckout = commandLines.includes('test "$(git rev-parse HEAD)" = "$PRODUCTION_SHA"');
  let freshMainFetch = false;
  let ancestry = false;
  for (let index = 0; index < commandLines.length - 1; index += 1) {
    if (
      commandLines[index] === "git fetch --no-tags origin main"
      && commandLines[index + 1] === 'git merge-base --is-ancestor "$PRODUCTION_SHA" FETCH_HEAD'
    ) {
      freshMainFetch = true;
      ancestry = true;
    }
  }
  return {
    checkoutBound: publishers > 0 && checkoutBound,
    canonicalEnv,
    comparison,
    headMatchesCheckout,
    freshMainFetch,
    ancestry,
  };
}

function normalizeSources(sources) {
  if (sources instanceof Map) return sources;
  return new Map(Object.entries(sources));
}

function violation(list, workflow, line, code, message) {
  list.push({ file: workflow.file, line: line ?? 1, code, message });
}

export function auditWorkflowSources(sources, { requireManualDeployment = false } = {}) {
  const workflows = new Map();
  const violations = [];
  for (const [file, source] of normalizeSources(sources)) {
    let parsed;
    let facts;
    try {
      parsed = scanWorkflow(source, file);
      facts = workflowFacts(parsed);
    } catch (error) {
      violations.push({
        file,
        line: 1,
        code: error?.code ?? "UNSUPPORTED_YAML",
        message: error instanceof Error ? error.message : String(error),
      });
      if (parsed) violations.push(...parsed.errors);
      continue;
    }
    workflows.set(file.replace(/^\.\//, ""), facts);
    violations.push(...parsed.errors);
  }

  const deploymentWorkflows = [];
  const edges = [];
  for (const workflow of workflows.values()) {
    if (workflow.events.size === 0) violation(violations, workflow, 1, "MISSING_TRIGGER", "workflow must declare an explicit trigger");
    const automatic = [...workflow.events].some((event) => event !== "workflow_dispatch");
    const unknownEvents = [...workflow.events].filter((event) => event !== "workflow_dispatch" && !AUTOMATIC_EVENTS.has(event));
    for (const event of unknownEvents) {
      violation(violations, workflow, 1, "UNKNOWN_TRIGGER", `unrecognized trigger ${event} is treated as automatic`);
    }

    for (const permission of ["pages", "id-token", "*"]) {
      if (workflow.workflowPermissions.get(permission)?.value.toLowerCase() === "write") {
        violation(violations, workflow, workflow.workflowPermissions.get(permission).line, "WORKFLOW_DEPLOY_PERMISSION", `${permission}: write must be isolated to the manual deploy job`);
      }
      if (permission === "*" && workflow.workflowPermissions.get(permission)?.value.toLowerCase() === "write-all") {
        violation(violations, workflow, workflow.workflowPermissions.get(permission).line, "WORKFLOW_DEPLOY_PERMISSION", "permissions: write-all exposes deployment permissions to ordinary jobs");
      }
    }
    if (workflow.workflowPermissions.get("actions")?.value.toLowerCase() === "write") {
      violation(violations, workflow, workflow.workflowPermissions.get("actions").line, "WORKFLOW_ACTIONS_PERMISSION", "actions: write may not be granted at workflow scope");
      if (automatic) {
        violation(violations, workflow, workflow.workflowPermissions.get("actions").line, "AUTOMATIC_PRODUCTION_PATH", "automatic workflow receives actions: write and could dispatch another workflow");
      }
    }

    let workflowPublishes = false;
    for (const currentJob of workflow.jobs.values()) {
      const capabilities = jobCapabilities(currentJob);
      workflowPublishes ||= capabilities.deploy || capabilities.deploymentApi || capabilities.workflowDispatch;
      const dangerous = capabilities.deploy || capabilities.artifact || capabilities.configure
        || capabilities.pagesWrite || capabilities.idTokenWrite || capabilities.actionsWrite
        || capabilities.productionEnvironment || capabilities.deploymentApi || capabilities.workflowDispatch;

      if (automatic && dangerous) {
        const names = Object.entries(capabilities).filter(([, enabled]) => enabled).map(([name]) => name).join(", ");
        violation(violations, workflow, currentJob.line, "AUTOMATIC_PRODUCTION_PATH", `automatic triggers can reach production capability in job ${currentJob.id}: ${names}`);
      }
      if (capabilities.deploymentApi) {
        violation(violations, workflow, currentJob.line, "DIRECT_DEPLOYMENT_API", `job ${currentJob.id} must use the reviewed actions/deploy-pages path instead of calling a deployment API directly`);
      }
      if (capabilities.workflowDispatch) {
        violation(violations, workflow, currentJob.line, "WORKFLOW_DISPATCH_BRIDGE", `job ${currentJob.id} may not dispatch another workflow from repository automation`);
      }
      if (capabilities.actionsWrite) {
        violation(violations, workflow, currentJob.permissions.get("actions")?.line ?? currentJob.line, "UNNEEDED_ACTIONS_WRITE", `job ${currentJob.id} may not receive actions: write`);
      }
      if (capabilities.contentsWrite && dangerous) {
        violation(violations, workflow, currentJob.permissions.get("contents")?.line, "UNNEEDED_CONTENTS_WRITE", `production job ${currentJob.id} must not receive contents: write`);
      }
      if ((capabilities.pagesWrite || capabilities.idTokenWrite) && !capabilities.deploy) {
        violation(violations, workflow, currentJob.line, "MISPLACED_DEPLOY_PERMISSION", `deployment permissions may exist only on the job that runs actions/deploy-pages`);
      }
      if (capabilities.deploy && (!capabilities.pagesWrite || !capabilities.idTokenWrite)) {
        violation(violations, workflow, currentJob.line, "INCOMPLETE_DEPLOY_PERMISSION", `deploy job ${currentJob.id} must explicitly receive pages: write and id-token: write`);
      }
      if (capabilities.deploy && !capabilities.productionEnvironment) {
        violation(violations, workflow, currentJob.line, "MISSING_PRODUCTION_ENVIRONMENT", `deploy job ${currentJob.id} must target github-pages`);
      }
      if ((capabilities.deploy || capabilities.artifact || capabilities.configure || capabilities.deploymentApi || capabilities.workflowDispatch) && !exactProductionGuard(currentJob.condition)) {
        violation(violations, workflow, currentJob.line, "UNSAFE_PRODUCTION_GUARD", `job ${currentJob.id} must conjunctively require workflow_dispatch, exact DEPLOY, and refs/tags/production-*`);
      }
      if (capabilities.deploy) {
        const guardedNeeds = analyzeProductionGuard(currentJob.condition).needs;
        const dependency = currentJob.needs.size === 1 ? [...currentJob.needs][0] : null;
        const validationJob = dependency ? workflow.jobs.get(dependency) : null;
        const validationCapabilities = validationJob ? jobCapabilities(validationJob) : null;
        const distinctValidation = dependency && dependency !== currentJob.id && validationJob
          && !validationCapabilities.deploy && !validationCapabilities.artifact
          && !validationCapabilities.deploymentApi && !validationCapabilities.workflowDispatch
          && jobRunsReleaseValidation(validationJob);
        if (!distinctValidation || !guardedNeeds.has(dependency)) {
          violation(violations, workflow, currentJob.line, "MISSING_RELEASE_VALIDATION", `deploy job ${currentJob.id} must need one distinct build/unit/browser validation job and require needs.<job>.result == 'success'`);
        }
      }
      if (capabilities.deploy || capabilities.artifact || capabilities.deploymentApi) {
        const shaSafety = jobShaBindingAndVerification(currentJob);
        if (Object.values(shaSafety).some((present) => !present)) {
          const missing = Object.entries(shaSafety).filter(([, present]) => !present).map(([name]) => name).join(", ");
          violation(violations, workflow, currentJob.line, "UNBOUND_PRODUCTION_SHA", `publisher job ${currentJob.id} must use canonical SHA env/checkout/HEAD proofs and an adjacent fresh-main FETCH_HEAD ancestry check before publishing; missing: ${missing}`);
        }
      }

      if (currentJob.reusable) {
        const local = localWorkflowReference(currentJob.reusable.value);
        if (local) edges.push({ from: workflow.file.replace(/^\.\//, ""), to: local, job: currentJob });
        else if (automatic && /\.github\/workflows\/.*(?:deploy|pages|publish|release)/i.test(currentJob.reusable.value)) {
          violation(violations, workflow, currentJob.reusable.line, "AUTOMATIC_REMOTE_RELEASE_CALL", `automatic workflow calls uninspectable release workflow ${currentJob.reusable.value}`);
        }
      }
    }

    if (workflowPublishes) {
      deploymentWorkflows.push(workflow);
      if (workflow.events.size !== 1 || !workflow.events.has("workflow_dispatch")) {
        violation(violations, workflow, 1, "DEPLOYMENT_NOT_MANUAL_ONLY", "production deployment workflow must be triggered only by workflow_dispatch");
      }
      const confirmation = workflow.dispatchInputs.get("confirm_production") ?? {};
      if (scalarBoolean(confirmation.required) !== true || confirmation.type !== "string" || confirmation.default === "DEPLOY") {
        violation(violations, workflow, confirmation.line, "UNSAFE_CONFIRMATION_INPUT", "confirm_production must be a required string and must not default to DEPLOY");
      }
      const productionSha = workflow.dispatchInputs.get("production_sha") ?? {};
      if (scalarBoolean(productionSha.required) !== true || productionSha.type !== "string") {
        violation(violations, workflow, productionSha.line, "UNSAFE_SHA_INPUT", "production_sha must be a required string input");
      }
      const concurrencyGroup = workflow.concurrency.group ?? "";
      if (!/production/i.test(concurrencyGroup) || concurrencyGroup.includes("${{") || scalarBoolean(workflow.concurrency["cancel-in-progress"]) !== false) {
        violation(violations, workflow, 1, "UNSAFE_PRODUCTION_CONCURRENCY", "manual deployment requires a static production concurrency group with cancel-in-progress: false");
      }
    }
  }

  const dangerByFile = new Map([...workflows].map(([file, workflow]) => [file, [...workflow.jobs.values()].some((item) => {
    const capabilities = jobCapabilities(item);
    return capabilities.deploy || capabilities.artifact || capabilities.configure || capabilities.pagesWrite
      || capabilities.idTokenWrite || capabilities.actionsWrite || capabilities.productionEnvironment
      || capabilities.deploymentApi || capabilities.workflowDispatch;
  })]));
  const adjacency = new Map();
  for (const edge of edges) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    adjacency.get(edge.from).push(edge);
    if (!workflows.has(edge.to)) {
      const source = workflows.get(edge.from);
      violation(violations, source, edge.job.reusable.line, "MISSING_REUSABLE_WORKFLOW", `cannot inspect local reusable workflow ${edge.to}`);
    }
  }

  for (const [file, workflow] of workflows) {
    if (![...workflow.events].some((event) => event !== "workflow_dispatch")) continue;
    const visited = new Set();
    const queue = (adjacency.get(file) ?? []).map((edge) => ({ ...edge, rootLine: edge.job.reusable.line }));
    while (queue.length) {
      const edge = queue.shift();
      if (visited.has(edge.to)) continue;
      visited.add(edge.to);
      if (dangerByFile.get(edge.to)) {
        violation(violations, workflow, edge.rootLine, "AUTOMATIC_REUSABLE_DEPLOYMENT", `automatic workflow can reach production through ${edge.to}`);
      }
      queue.push(...(adjacency.get(edge.to) ?? []).map((next) => ({ ...next, rootLine: edge.rootLine })));
    }
  }

  if (requireManualDeployment && deploymentWorkflows.length !== 1) {
    violations.push({
      file: ".github/workflows",
      line: 1,
      code: "MANUAL_DEPLOYMENT_COUNT",
      message: `expected exactly one manual production deployment workflow, found ${deploymentWorkflows.length}`,
    });
  }

  violations.sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line || left.code.localeCompare(right.code));
  return { workflows, violations, deploymentWorkflows };
}

export function readWorkflowSources(directory) {
  return new Map(
    readdirSync(directory)
      .filter((file) => /\.ya?ml$/i.test(file))
      .sort()
      .map((file) => [path.posix.join(".github/workflows", file), readFileSync(path.join(directory, file), "utf8")]),
  );
}

export function formatViolations(violations) {
  return violations.map((item) => `${item.file}:${item.line} [${item.code}] ${item.message}`).join("\n");
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const rootDir = path.resolve(path.dirname(scriptPath), "..");
  const sources = readWorkflowSources(path.join(rootDir, ".github", "workflows"));
  const result = auditWorkflowSources(sources, { requireManualDeployment: true });
  if (result.violations.length) {
    console.error(formatViolations(result.violations));
    process.exitCode = 1;
  } else {
    console.log(`Validated ${result.workflows.size} workflows: automatic events cannot reach production and manual release requires DEPLOY plus an exact production tag SHA.`);
  }
}
