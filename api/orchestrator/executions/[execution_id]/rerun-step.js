import { sendJson } from "../../../../workers/orchestrator/http.js";
import { rerunStep } from "../../../../workers/orchestrator/engine.js";

export default async function handler(req, res) {
  const methodSeen = req.method || "UNKNOWN";

  const { execution_id: executionId, step_id: stepIdFromQuery } = req.query || {};
  const { step_id: stepIdFromBody } = req.body || {};
  const stepId = stepIdFromBody || stepIdFromQuery;

  if (!executionId || typeof executionId !== "string") {
    return sendJson(res, 400, {
      ok: false,
      error: "execution_id é obrigatório (string).",
      method_seen: methodSeen,
    });
  }

  if (!stepId || typeof stepId !== "string") {
    return sendJson(res, 400, {
      ok: false,
      error: "step_id é obrigatório (string).",
      method_seen: methodSeen,
    });
  }

  const result = await rerunStep(executionId, stepId);

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
