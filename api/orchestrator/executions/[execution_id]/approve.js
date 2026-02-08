import { methodNotAllowed, sendJson } from "../../../workers/orchestrator/http.js";
import { approveExecution } from "../../../workers/orchestrator/engine.js";

const APPROVE_HANDLER_VERSION = "approve-v2-stamp-2026-02-08";

export default async function handler(req, res) {
  const methodSeen = req.method || "UNKNOWN";

  if (methodSeen !== "POST") {
    return methodNotAllowed(req, res, ["POST"], { method_seen: methodSeen });
  }

  try {
    const execution_id = String(
  (req.body && req.body.execution_id) || (req.query && req.query.execution_id) || ""
).trim();

const result = await approveExecution(execution_id);

if (!result?.ok) {
  return sendJson(res, 404, {
    ok: false,
    error: result?.error || "execution_id não encontrado.",
    execution_id,
    method_seen: methodSeen,
  });
}

return sendJson(res, 200, {
  ok: true,
  execution_id,
  ...result,
  method_seen: methodSeen,
});
  } catch (e) {
    return sendJson(res, 500, {
      ok: false,
      error: "APPROVE_FAILED",
      message: e?.message || String(e),
      method_seen: methodSeen,
      handler_version: APPROVE_HANDLER_VERSION,
    });
  }
}
