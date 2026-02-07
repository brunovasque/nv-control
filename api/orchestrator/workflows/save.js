import { saveWorkflowDefinition } from "../../../workers/orchestrator/engine.js";
import { methodNotAllowed, sendJson } from "../../../workers/orchestrator/http.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(req, res, ["POST"]);
  }

  const result = await saveWorkflowDefinition(req.body || {});
  if (!result.ok) {
    return sendJson(res, 400, {
      ok: false,
      errors: result.errors
    });
  }

  return sendJson(res, 200, result);
}
