import { sendJson, methodNotAllowed } from "../../../workers/orchestrator/http.js";
import { approveExecution } from "../../../workers/orchestrator/engine.js";
import { getDbMeta, peekMemoryExecution } from "../../../workers/orchestrator/db.js";

export default async function handler(req, res) {
  const methodSeen = req.method || "UNKNOWN";

  if (methodSeen !== "POST") {
    return methodNotAllowed(req, res, ["POST"]);
  }

  const query = req.query || {};
  const body = req.body && typeof req.body === "object" ? req.body : {};

  const executionId =
    body.execution_id ||
    body.executionId ||
    query.execution_id ||
    query.executionId ||
    null;

  if (!executionId || typeof executionId !== "string") {
    return sendJson(res, 400, {
      ok: false,
      error: "execution_id é obrigatório (string).",
      method_seen: methodSeen,
      db_meta: getDbMeta(),
    });
  }

  const result = await approveExecution(executionId);

  if (!result || !result.ok) {
    return sendJson(res, 404, {
      ok: false,
      ...result,
      method_seen: methodSeen,
      db_meta: getDbMeta(),
      memory_has_execution: Boolean(peekMemoryExecution(executionId)),
    });
  }

  return sendJson(res, 200, {
    ...result,
    method_seen: methodSeen,
    db_meta: getDbMeta(),
  });
}
