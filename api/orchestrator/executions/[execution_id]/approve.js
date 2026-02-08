import { sendJson } from "../../../../workers/orchestrator/http.js";
import { approveExecution } from "../../../../workers/orchestrator/engine.js";

export default async function handler(req, res) {
  const { execution_id: executionId } = req.query || {};
  const methodSeen = req.method || "UNKNOWN";

  if (!executionId || typeof executionId !== "string") {
    return sendJson(res, 400, {
      ok: false,
      error: "execution_id é obrigatório (string).",
      method_seen: methodSeen,
    });
  }

  const result = await approveExecution(executionId);

  if (!result.ok) {
    return sendJson(res, 400, {
      ...result,
      method_seen: methodSeen,
    });
  }

  return sendJson(res, 200, {
    ...result,
    method_seen: methodSeen,
  });
}
