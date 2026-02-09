// workers/nv-orchestrator/index.js

import {
  saveWorkflowDefinition,
  runWorkflow,
  getExecutionState,
  rerunStep,
  approveExecution,
} from "./engine.js";

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method.toUpperCase();

    try {
      // ------------------------------------------------------------------
      // 1) SAVE WORKFLOW DEFINITION
      // POST /orchestrator/workflows/save
      // ------------------------------------------------------------------
      if (method === "POST" && pathname === "/orchestrator/workflows/save") {
        const body = await request.json();
        const result = await saveWorkflowDefinition(env, body);
        const status = result?.ok === false ? 400 : 200;

        return jsonResponse(
          {
            ok: result?.ok !== false,
            route: "workflows/save",
            method,
            ...result,
          },
          status
        );
      }

      // ------------------------------------------------------------------
      // 2) RUN WORKFLOW
      // POST /orchestrator/run
      // ------------------------------------------------------------------
      if (method === "POST" && pathname === "/orchestrator/run") {
        const body = await request.json();
        const result = await runWorkflow(env, body);
        const status = result?.ok === false ? 400 : 200;

        return jsonResponse(
          {
            ok: result?.ok !== false,
            route: "run",
            method,
            ...result,
          },
          status
        );
      }

      // ------------------------------------------------------------------
      // 3) GET EXECUTION STATE
      // GET /orchestrator/executions/:execution_id
      // ------------------------------------------------------------------
      const execMatch = pathname.match(
        /^\/orchestrator\/executions\/([^/]+)$/
      );
      if (execMatch && method === "GET") {
        const executionId = execMatch[1];
        const state = await getExecutionState(env, executionId);

        if (!state) {
          return jsonResponse(
            {
              ok: false,
              route: "get-execution",
              method,
              execution_id: executionId,
              error: "EXECUTION_NOT_FOUND",
            },
            404
          );
        }

        return jsonResponse(
          {
            ok: true,
            route: "get-execution",
            method,
            execution_id: executionId,
            execution: state,
          },
          200
        );
      }

      // ------------------------------------------------------------------
      // 4) APPROVE EXECUTION
      // POST /orchestrator/executions/:execution_id/approve
      // ------------------------------------------------------------------
      const approveMatch = pathname.match(
        /^\/orchestrator\/executions\/([^/]+)\/approve$/
      );
      if (approveMatch && method === "POST") {
        const executionId = approveMatch[1];
        const result = await approveExecution(env, executionId);
        const status = result?.ok === false ? 400 : 200;

        return jsonResponse(
          {
            ok: result?.ok !== false,
            route: "approve",
            method,
            execution_id: executionId,
            ...result,
          },
          status
        );
      }

      // ------------------------------------------------------------------
      // 5) RERUN STEP
      // POST /orchestrator/executions/:execution_id/rerun-step
      // body: { step_id: "s3" }
      // ------------------------------------------------------------------
      const rerunMatch = pathname.match(
        /^\/orchestrator\/executions\/([^/]+)\/rerun-step$/
      );
      if (rerunMatch && method === "POST") {
        const executionId = rerunMatch[1];
        const body = (await request.json().catch(() => ({}))) || {};
        const stepId = body.step_id;

        const result = await rerunStep(env, executionId, stepId);
        const status = result?.ok === false ? 400 : 200;

        return jsonResponse(
          {
            ok: result?.ok !== false,
            route: "rerun-step",
            method,
            execution_id: executionId,
            step_id: stepId,
            ...result,
          },
          status
        );
      }

      // ------------------------------------------------------------------
      // 6) HEALTHCHECK SIMPLES
      // GET /orchestrator/health
      // ------------------------------------------------------------------
      if (method === "GET" && pathname === "/orchestrator/health") {
        return jsonResponse(
          {
            ok: true,
            route: "health",
            method,
            message: "nv-orchestrator online",
          },
          200
        );
      }

      // ------------------------------------------------------------------
      // FALLBACK: ROUTE NOT FOUND
      // ------------------------------------------------------------------
      return jsonResponse(
        {
          ok: false,
          error: "ROUTE_NOT_FOUND",
          method,
          pathname,
        },
        404
      );
    } catch (err) {
      // Erro interno para qualquer rota
      return jsonResponse(
        {
          ok: false,
          error: "INTERNAL_ERROR",
          message: err?.message || String(err),
        },
        500
      );
    }
  },
};
