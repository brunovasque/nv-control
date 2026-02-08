import { methodNotAllowed, sendJson } from "../../../workers/orchestrator/http.js";
import {
  getExecutionState,
  approveExecution,
  rerunStep
} from "../../../workers/orchestrator/engine.js";

export default async function handler(req, res) {
  const method = req.method || "GET";

  const { execution_id: executionId } = req.query || {};

  if (!executionId || typeof executionId !== "string") {
    return sendJson(res, 400, {
      ok: false,
      error: "execution_id é obrigatório (string)."
    });
  }

  // =========================
  // GET → mantém comportamento atual
  // =========================
  if (method === "GET") {
    const state = await getExecutionState(executionId);

    if (!state) {
      return sendJson(res, 404, {
        ok: false,
        error: "execution_id não encontrado."
      });
    }

    return sendJson(res, 200, {
      ok: true,
      execution: state
    });
  }

  // =========================
  // POST → ações sobre a execução
  // =========================
  if (method === "POST") {
    const actionRaw =
      (req.query && req.query.action) ||
      (req.body && req.body.action) ||
      "";

    const action =
      typeof actionRaw === "string" ? actionRaw.trim() : String(actionRaw || "").trim();

    if (!action) {
      return sendJson(res, 400, {
        ok: false,
        error: "action é obrigatório para POST.",
        method_seen: method
      });
    }

    // ---- APPROVE ----
    if (action === "approve") {
      const result = await approveExecution(executionId);

      const statusCode = result && result.ok ? 200 : 400;

      return sendJson(res, statusCode, {
        ...result,
        method_seen: method,
        action: "approve"
      });
    }

    // ---- RERUN STEP ----
    if (action === "rerun_step") {
      const stepIdRaw =
        (req.body && req.body.step_id) ||
        (req.query && req.query.step_id) ||
        "";

      const stepId =
        typeof stepIdRaw === "string" ? stepIdRaw.trim() : String(stepIdRaw || "").trim();

      if (!stepId) {
        return sendJson(res, 400, {
          ok: false,
          error: "step_id é obrigatório (string) para ação 'rerun_step'.",
          method_seen: method,
          action: "rerun_step"
        });
      }

      const result = await rerunStep(executionId, stepId);
      const statusCode = result && result.ok ? 200 : 400;

      return sendJson(res, statusCode, {
        ...result,
        method_seen: method,
        action: "rerun_step",
        step_id: stepId
      });
    }

    // action inválida
    return sendJson(res, 400, {
      ok: false,
      error: `action inválido: ${action}. Use 'approve' ou 'rerun_step'.`,
      method_seen: method
    });
  }

  // Demais métodos ainda retornam 405
  return methodNotAllowed(req, res, ["GET", "POST"]);
}
