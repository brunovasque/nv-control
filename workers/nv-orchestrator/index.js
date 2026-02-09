import {
  saveWorkflowDefinition,
  runWorkflow,
  getExecutionState,
  rerunStep,
  approveExecution,
} from "./engine.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method.toUpperCase();

    async function json(data, status = 200) {
      return new Response(JSON.stringify(data, null, 2), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      if (method === "POST" && pathname === "/orchestrator/workflows/save") {
        const body = await request.json();
        const result = await saveWorkflowDefinition(env, body);
        const status = result?.ok === false ? 400 : 200;
        return json({ ok: true, ...result, method_seen: method }, status);
      }

      if (method === "POST" && pathname === "/orchestrator/run") {
        const body = await request.json();
        const result = await runWorkflow(env, body);
        const status = result?.ok === false ? 400 : 200;
        return json({ ok: true, ...result, method_seen: method }, status);
      }

      const execMatch = pathname.match(/^\/orchestrator\/executions\/([^\/]+)$/);
      if (execMatch && method === "GET") {
        const executionId = execMatch[1];
        const state = await getExecutionState(env, executionId);
        if (!state) {
          return json({ ok: false, error: "execution_id não encontrado.", method_seen: method }, 404);
        }
        return json({ ok: true, execution: state, method_seen: method });
      }

      const approveMatch = pathname.match(/^\/orchestrator\/executions\/([^\/]+)\/approve$/);
      if (approveMatch && method === "POST") {
        const executionId = approveMatch[1];
        const result = await approveExecution(env, executionId);
        const status = result?.ok === false ? 400 : 200;
        return json({ ok: true, execution_id: executionId, ...result, method_seen: method }, status);
      }

      const rerunMatch = pathname.match(/^\/orchestrator\/executions\/([^\/]+)\/rerun-step$/);
      if (rerunMatch && method === "POST") {
        const executionId = rerunMatch[1];
        const body = await request.json();
        const stepId = String(body?.step_id || "").trim();
        if (!stepId) {
          return json({ ok: false, error: "step_id é obrigatório.", method_seen: method }, 400);
        }
        const result = await rerunStep(env, executionId, stepId);
        const status = result?.ok === false ? 400 : 200;
        return json({ ok: true, execution_id: executionId, step_id: stepId, ...result, method_seen: method }, status);
      }

      return json({ ok: false, error: "ROUTE_NOT_FOUND", path: pathname, method_seen: method }, 404);
    } catch (err) {
      return json(
        {
          ok: false,
          error: "ORCHESTRATOR_WORKER_ERROR",
          message: err?.message || String(err),
          method_seen: method,
        },
        500,
      );
    }
  },
};
