import { methodNotAllowed, sendJson } from "../../../../workers/orchestrator/http.js";
import { rerunStep } from "../../../../workers/orchestrator/engine.js";

export default async function handler(req, res) {
  const method = req.method || "GET";

  // aceita POST e GET; qualquer outra coisa 405
  if (method !== "POST" && method !== "GET") {
    return methodNotAllowed(req, res, ["POST", "GET"]);
  }

  const { execution_id: executionId } = req.query || {};
  const { step_id: stepIdFromBody } = req.body || {};
  const { step_id: stepIdFromQuery } = req.query || {};
  const stepId = stepIdFromBody || stepIdFromQuery;

  if (!executionId || typeof executionId !== "string") {
    return sendJson(res, 400, {
      ok: false,
      error: "execution_id é obrigatório (string)."
    });
  }

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
