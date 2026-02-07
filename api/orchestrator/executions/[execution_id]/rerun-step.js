import { methodNotAllowed, sendJson } from "../../../../workers/orchestrator/http.js";
import { rerunStep } from "../../../../workers/orchestrator/engine.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(req, res, ["POST"]);
  }

  const { execution_id: executionId } = req.query;
  const { step_id: stepId } = req.body || {};

  if (!stepId || typeof stepId !== "string") {
    return sendJson(res, 400, {
      ok: false,
      error: "step_id é obrigatório (string)."
    });
  }

  const result = await rerunStep(executionId, stepId);
  if (!result.ok) {
    return sendJson(res, 400, result);
  }

  return sendJson(res, 200, result);
}
