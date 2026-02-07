import { methodNotAllowed, sendJson } from "../../../workers/orchestrator/http.js";
import { getExecutionState } from "../../../workers/orchestrator/engine.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(req, res, ["GET"]);
  }

  const { execution_id: executionId } = req.query;
  const state = await getExecutionState(executionId);

  if (!state) {
    return sendJson(res, 404, {
      ok: false,
      error: "execution_id não encontrado."
    });
  }

  return sendJson(res, 200, {
    ok: true,
    execution: state
  });
}
