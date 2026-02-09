import {
  approveExecution,
  getExecutionState,
  rerunStep,
  runWorkflow,
  saveWorkflowDefinition,
} from "./engine.js";
import { methodNotAllowed, readJson, sendJson } from "./http.js";

function isMethod(method, expected) {
  return String(method || "GET").toUpperCase() === expected;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    try {
      if (pathname === "/orchestrator/workflows/save") {
        if (!isMethod(request.method, "POST")) return methodNotAllowed(["POST"]);
        const payload = await readJson(request);
        const result = await saveWorkflowDefinition(env, payload);
        return sendJson(result?.ok === false ? 400 : 200, result);
      }

      if (pathname === "/orchestrator/run") {
        if (!isMethod(request.method, "POST")) return methodNotAllowed(["POST"]);
        const payload = await readJson(request);
        const result = await runWorkflow(env, payload);
        return sendJson(result?.ok === false ? 400 : 200, result);
      }

      const executionMatch = pathname.match(/^\/orchestrator\/executions\/([^/]+)$/);
      if (executionMatch) {
        if (!isMethod(request.method, "GET")) return methodNotAllowed(["GET"]);
        const executionId = decodeURIComponent(executionMatch[1]);
        const execution = await getExecutionState(env, executionId);

        if (!execution) {
          return sendJson(404, { ok: false, error: "EXECUTION_NOT_FOUND", execution_id: executionId });
        }

        return sendJson(200, { ok: true, execution_id: executionId, execution });
      }

      const approveMatch = pathname.match(/^\/orchestrator\/executions\/([^/]+)\/approve$/);
      if (approveMatch) {
        if (!isMethod(request.method, "POST")) return methodNotAllowed(["POST"]);
        const executionId = decodeURIComponent(approveMatch[1]);
        const result = await approveExecution(env, executionId);
        return sendJson(result?.ok === false ? 400 : 200, { execution_id: executionId, ...result });
      }

      const rerunMatch = pathname.match(/^\/orchestrator\/executions\/([^/]+)\/rerun-step$/);
      if (rerunMatch) {
        if (!isMethod(request.method, "POST")) return methodNotAllowed(["POST"]);
        const executionId = decodeURIComponent(rerunMatch[1]);
        const payload = await readJson(request);
        const stepId = payload?.step_id;
        const result = await rerunStep(env, executionId, stepId);
        return sendJson(result?.ok === false ? 400 : 200, {
          execution_id: executionId,
          step_id: stepId,
          ...result,
        });
      }

      return sendJson(404, {
        ok: false,
        error: "ROUTE_NOT_FOUND",
        pathname,
      });
    } catch (error) {
      return sendJson(500, {
        ok: false,
        error: "INTERNAL_ERROR",
        message: error?.message || String(error),
      });
    }
  },
};
