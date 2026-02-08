import { methodNotAllowed, sendJson } from "../../../workers/orchestrator/http.js";
import { approveExecution } from "../../../workers/orchestrator/engine.js";

const HANDLER_VERSION = "approve-fix-v1-2026-02-08";

export default async function handler(req, res) {
  const methodSeen = req.method || "UNKNOWN";

  if (methodSeen !== "POST") {
    return methodNotAllowed(req, res, ["POST"], { method_seen: methodSeen });
  }

  try {
    // ✅ aceita BODY ou QUERY (compat)
    const execution_id = String(
      (req.body && req.body.execution_id) || (req.query && req.query.execution_id) || ""
    ).trim();

    if (!execution_id) {
      return sendJson(res, 400, {
        ok: false,
        error: "MISSING_EXECUTION_ID",
        message: "Informe execution_id no body OU na query.",
        method_seen: methodSeen,
        handler_version: HANDLER_VERSION,
      });
    }

    // ✅ engine canônico: 1 argumento
    const result = await approveExecution(execution_id);

    if (!result?.ok) {
      return sendJson(res, 404, {
        ok: false,
        error: result?.error || "execution_id não encontrado.",
        execution_id,
        method_seen: methodSeen,
        handler_version: HANDLER_VERSION,
      });
    }

    return sendJson(res, 200, {
      ok: true,
      execution_id,
      ...result,
      method_seen: methodSeen,
      handler_version: HANDLER_VERSION,
    });
  } catch (e) {
    return sendJson(res, 500, {
      ok: false,
      error: "APPROVE_FAILED",
      message: e?.message || String(e),
      method_seen: methodSeen,
      handler_version: HANDLER_VERSION,
    });
  }
}
