import { methodNotAllowed, sendJson } from "../../../../workers/orchestrator/http.js";
import { approveExecution } from "../../../../workers/orchestrator/engine.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(req, res, ["POST"]);
  }

  const { execution_id: executionId } = req.query;
  const result = await approveExecution(executionId);

  if (!result.ok) {
    return sendJson(res, 400, result);
  }

  return sendJson(res, 200, result);
}
