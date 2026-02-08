import { methodNotAllowed, sendJson } from "../../../workers/orchestrator/http.js";
import {
  getExecutionState,
  approveExecution,
  rerunStep,
} from "../../../workers/orchestrator/engine.js";

export default async function handler(req, res) {
  const methodSeen = req.method || "UNKNOWN";

  // Só vamos trabalhar com GET por enquanto
  if (methodSeen !== "GET") {
    return methodNotAllowed(req, res, ["GET"]);
  }

  const { execution_id, action, step_id } = req.query || {};
  const executionId = execution_id;

  if (!executionId || typeof executionId !== "string") {
    return sendJson(res, 400, {
      ok: false,
      error: "execution_id é obrigatório (string).",
      method_seen: methodSeen,
    });
  }

  try {
    // 1) Sem action => só consulta estado
    if (!action) {
      const execution = await getExecutionState(executionId);

      if (!execution) {
        return sendJson(res, 404, {
          ok: false,
          error: "execution_id não encontrado.",
          method_seen: methodSeen,
        });
      }

      return sendJson(res, 200, {
        ok: true,
        execution,
        method_seen: methodSeen,
      });
    }

    // 2) action=approve => chama approveExecution
    if (action === "approve") {
      const result = await approveExecution(executionId);
      const statusCode = result.ok ? 200 : 400;

      return sendJson(res, statusCode, {
        ...result,
        method_seen: methodSeen,
      });
    }

    // 3) action=rerun_step => chama rerunStep(executionId, step_id)
    if (action === "rerun_step") {
      if (!step_id || typeof step_id !== "string") {
        return sendJson(res, 400, {
          ok: false,
          error: "step_id é obrigatório (string).",
          method_seen: methodSeen,
        });
      }

      const result = await rerunStep(executionId, step_id);
      const statusCode = result.ok ? 200 : 400;

      return sendJson(res, statusCode, {
        ...result,
        method_seen: methodSeen,
      });
    }

    // 4) action desconhecida
    return sendJson(res, 400, {
      ok: false,
      error: `action desconhecida: ${String(action)}`,
      method_seen: methodSeen,
    });
  } catch (err) {
    return sendJson(res, 500, {
      ok: false,
      error: "Erro interno ao processar execução.",
      details: err instanceof Error ? err.message : String(err),
      method_seen: methodSeen,
    });
  }
}
