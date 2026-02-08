import { methodNotAllowed, sendJson } from "../../../../workers/orchestrator/http.js";
import { approveExecution } from "../../../../workers/orchestrator/engine.js";

export default async function handler(req, res) {
  const method = req.method || "GET";

  // aceita POST (que é o que usamos) e GET, qualquer outra coisa 405
  if (method !== "POST" && method !== "GET") {
    return methodNotAllowed(req, res, ["POST", "GET"]);
  }

  const { execution_id: executionId } = req.query || {};

  if (!executionId || typeof executionId !== "string") {
    return sendJson(res, 400, {
      ok: false,
      error: "execution_id é obrigatório (string)."
    });
  }

  const result = await approveExecution(executionId);

  if (!result.ok) {
    return sendJson(res, 400, result);
  }

  return sendJson(res, 200, result);
}
