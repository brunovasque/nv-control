import { methodNotAllowed, sendJson } from "../../../workers/orchestrator/http.js";
import {
  getExecutionState,
  approveExecution,
  rerunStep,
} from "../../../workers/orchestrator/engine.js";

export default async function handler(req, res) {
  const method = req.method || "GET";

  // ✅ só aceitamos GET nessa rota (evita o 400/405 estranho do POST)
  if (method !== "GET") {
    return methodNotAllowed(req, res, ["GET"]);
  }

  const { execution_id: executionId, action: actionRaw, step_id: stepIdRaw } =
    req.query || {};

  if (!executionId || typeof executionId !== "string") {
    return sendJson(res, 400, {
      ok: false,
      error: "execution_id é obrigatório (string).",
    });
  }

  const action =
    typeof actionRaw === "string" ? actionRaw.trim() : String(actionRaw || "").trim();

  // =========================
  // 1) Sem action → só retorna estado (comportamento antigo)
  // =========================
  if (!action) {
    const state = await getExecutionState(executionId);

    if (!state) {
      return sendJson(res, 404, {
        ok: false,
        error: "execution_id não encontrado.",
      });
    }

    return sendJson(res, 200, {
      ok: true,
      execution: state,
    });
  }

  // =========================
  // 2) action=approve → aprova execução
  // =========================
  if (action === "approve") {
    const result = await approveExecution(executionId);
    const statusCode = result && result.ok ? 200 : 400;

    return sendJson(res, statusCode, {
      ...result,
      action: "approve",
      method_seen: method,
    });
  }

  // =========================
  // 3) action=rerun_step → rerun de step
  // =========================
  if (action === "rerun_step") {
    const stepId =
      typeof stepIdRaw === "string" ? stepIdRaw.trim() : String(stepIdRaw || "").trim();

    if (!stepId) {
      return sendJson(res, 400, {
        ok: false,
        error: "step_id é obrigatório (string) para action=rerun_step.",
        action: "rerun_step",
        method_seen: method,
      });
    }

    const result = await rerunStep(executionId, stepId);
    const statusCode = result && result.ok ? 200 : 400;

    return sendJson(res, statusCode, {
      ...result,
      action: "rerun_step",
      step_id: stepId,
      method_seen: method,
    });
  }

  // =========================
  // 4) action inválido
  // =========================
  return sendJson(res, 400, {
    ok: false,
    error: `action inválido: ${action}. Use 'approve' ou 'rerun_step'.`,
    method_seen: method,
  });
}
