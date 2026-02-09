import { methodNotAllowed, sendJson } from "././././workers/orchestrator/http.js";
import { approveExecution } from "././././workers/orchestrator/engine.js";

const HANDLER_VERSION = "approve-path-fix-v2-2026-02-08";

export default async function handler(req, res) {
  const methodSeen = req.method || "UNKNOWN";

  if (methodSeen !== "POST") {
    return methodNotAllowed(req, res, ["POST"]);
  }

  try {
    // execution_id vem do path (Next injeta em req.query.execution_id)
    const execution_id = String(req.query?.execution_id || "").trim();

    // compat: se quiser chamar por body também, aceita
    const executionIdFinal = String(
      execution_id || (req.body && req.body.execution_id) || ""
    ).trim();

    if (!executionIdFinal) {
      return sendJson(res, 400, {
        ok: false,
        error: "MISSING_EXECUTION_ID",
        handler_version: HANDLER_VERSION,
      });
    }

    // ✅ engine canônico: approveExecution(env, executionId)
    const result = await approveExecution(process.env, executionIdFinal);

    if (!result?.ok) {
      return sendJson(res, 404, {
        ok: false,
        error: result?.error || "execution_id não encontrado.",
        execution_id: executionIdFinal,
        handler_version: HANDLER_VERSION,
      });
    }

    return sendJson(res, 200, {
      ok: true,
      execution_id: executionIdFinal,
      ...result,
      handler_version: HANDLER_VERSION,
    });
  } catch (e) {
    return sendJson(res, 500, {
      ok: false,
      error: "APPROVE_FAILED",
      message: e?.message || String(e),
      handler_version: HANDLER_VERSION,
    });
  }
}
