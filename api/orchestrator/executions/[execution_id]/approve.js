import { methodNotAllowed, sendJson } from "../../../workers/orchestrator/http.js";
import { approveExecution } from "../../../workers/orchestrator/engine.js";

export default async function handler(req, res) {
  const methodSeen = req.method || "UNKNOWN";

  if (methodSeen !== "POST") {
    return methodNotAllowed(req, res, ["POST"], { method_seen: methodSeen });
  }

  try {
    const execution_id = req.body?.execution_id;

    if (!execution_id || typeof execution_id !== "string") {
      return sendJson(res, 400, {
        ok: false,
        error: "MISSING_EXECUTION_ID",
        message: "body.execution_id é obrigatório (string).",
        method_seen: methodSeen,
      });
    }

    const result = await approveExecution(process.env, execution_id);

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
    });
  }
}
