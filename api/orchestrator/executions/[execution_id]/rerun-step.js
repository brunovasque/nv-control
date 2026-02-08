import { methodNotAllowed, sendJson } from "../../../workers/orchestrator/http.js";
import { rerunStep } from "../../../workers/orchestrator/engine.js";

export default async function handler(req, res) {
  const methodSeen = req.method || "UNKNOWN";

  if (methodSeen !== "POST") {
    return methodNotAllowed(req, res, ["POST"], { method_seen: methodSeen });
  }

  try {
    const body = req.body || {};
    const execution_id = String(body.execution_id || (req.query && req.query.execution_id) || "").trim();
    const step_id = String(body.step_id || "").trim();

    if (!execution_id) {
      return sendJson(res, 400, {
        ok: false,
        error: "MISSING_EXECUTION_ID",
        message: "Informe execution_id no body OU na query.",
        method_seen: methodSeen,
      });
    }

    if (!step_id) {
      return sendJson(res, 400, {
        ok: false,
        error: "MISSING_STEP_ID",
        message: "body.step_id é obrigatório.",
        method_seen: methodSeen,
      });
    }

    // ✅ engine atual: rerunStep(executionId, stepId)
    const result = await rerunStep(execution_id, step_id);

    return sendJson(res, 200, {
      ok: true,
      execution_id,
      step_id,
      ...result,
      method_seen: methodSeen,
    });
  } catch (e) {
    return sendJson(res, 500, {
      ok: false,
      error: "RERUN_STEP_FAILED",
      message: e?.message || String(e),
      method_seen: methodSeen,
    });
  }
}
