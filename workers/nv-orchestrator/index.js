import { approveExecution, getExecutionState, rerunStep, runWorkflow, saveWorkflowDefinition } from "./engine.js";
import { json, methodNotAllowed, readJson } from "./http.js";

const ORCHESTRATOR_PREFIX = "/orchestrator";

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;

      if (!path.startsWith(ORCHESTRATOR_PREFIX)) {
        return json({ ok: false, error: "not_found" }, 404);
      }

      if (path === "/orchestrator/workflows/save") {
        return handleSaveWorkflow(request, env);
      }

      if (path === "/orchestrator/run") {
        return handleRun(request, env);
      }

      const executionMatch = path.match(/^\/orchestrator\/executions\/([^/]+)$/);
      if (executionMatch) {
        return handleGetExecution(request, env, decodeURIComponent(executionMatch[1]));
      }

      const approveMatch = path.match(/^\/orchestrator\/executions\/([^/]+)\/approve$/);
      if (approveMatch) {
        return handleApprove(request, env, decodeURIComponent(approveMatch[1]));
      }

      const rerunMatch = path.match(/^\/orchestrator\/executions\/([^/]+)\/rerun-step$/);
      if (rerunMatch) {
        return handleRerunStep(request, env, decodeURIComponent(rerunMatch[1]));
      }

      return json({ ok: false, error: "not_found" }, 404);
    } catch (error) {
      return json({ ok: false, error: "internal_error", message: error?.message || String(error) }, 500);
    }
  }
};

async function handleSaveWorkflow(request, env) {
  if (request.method !== "POST") return methodNotAllowed(["POST"]);

  const payload = await readJson(request);
  const result = await saveWorkflowDefinition(env, payload);
  if (!result.ok) return json({ ok: false, errors: result.errors }, 400);

  return json(result, 200);
}

async function handleRun(request, env) {
  if (request.method !== "POST") return methodNotAllowed(["POST"]);

  const payload = await readJson(request);
  const result = await runWorkflow(env, payload);
  if (!result.ok) return json({ ok: false, errors: result.errors }, 400);

  return json({ ok: true, execution: result.execution }, 200);
}

async function handleGetExecution(request, env, executionId) {
  if (request.method !== "GET") return methodNotAllowed(["GET"]);

  const execution = await getExecutionState(env, executionId);
  if (!execution) return json({ ok: false, error: "execution_id não encontrado." }, 404);

  return json({ ok: true, execution }, 200);
}

async function handleApprove(request, env, executionId) {
  if (request.method !== "POST") return methodNotAllowed(["POST"]);

  const result = await approveExecution(env, executionId);
  if (!result.ok) return json({ ok: false, error: result.error }, 400);

  return json(result, 200);
}

async function handleRerunStep(request, env, executionId) {
  if (request.method !== "POST") return methodNotAllowed(["POST"]);

  const body = await readJson(request);
  const stepId = String(body?.step_id || "").trim();
  if (!stepId) return json({ ok: false, error: "MISSING_STEP_ID" }, 400);

  const result = await rerunStep(env, executionId, stepId);
  if (!result.ok) return json({ ok: false, error: result.error }, 400);

  return json(result, 200);
}
