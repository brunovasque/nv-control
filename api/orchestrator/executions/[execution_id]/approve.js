import { methodNotAllowed, sendJson } from "../../../workers/orchestrator/http.js";
import { approveExecution } from "../../../workers/orchestrator/engine.js";

export default async function handler(req, res) {
  const methodSeen = req.method || "UNKNOWN";

  if (methodSeen !== "POST") {
    return methodNotAllowed(req, res, ["POST"], { method_seen: methodSeen });
  }

  try {
    const execution_id = req.query?.execution_id;

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
