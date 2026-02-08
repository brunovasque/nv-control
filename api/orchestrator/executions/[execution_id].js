import { sendJson } from "../../../workers/orchestrator/http.js";
import { getExecutionState } from "../../../workers/orchestrator/engine.js";

export default async function handler(req, res) {
  const methodSeen = req.method || "UNKNOWN";
  const { execution_id: executionId } = req.query || {};

  if (!executionId || typeof executionId !== "string") {
    return sendJson(res, 400, {
      ok: false,
      error: "execution_id é obrigatório (string).",
      method_seen: methodSeen,
    });
  }

  const state = await getExecutionState(executionId);

  if (!state) {
    return sendJson(res, 404, {
      ok: false,
      error: "execution_id não encontrado.",
      method_seen: methodSeen,
    });
  }

  return sendJson(res, 200, {
    ok: true,
    execution: state,
    method_seen: methodSeen,
  });
}
