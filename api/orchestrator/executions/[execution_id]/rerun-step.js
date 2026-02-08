import { methodNotAllowed, sendJson } from "../../../workers/orchestrator/http.js";
import { rerunStep } from "../../../workers/orchestrator/engine.js";

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

  const stepId =
    body.step_id ||
    body.stepId ||
    query.step_id ||
    query.stepId ||
    null;

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

  if (!result || !result.ok) {
    const msg = String(result?.error || result?.message || "RERUN_FAILED");
    const status = msg.includes("não encontrado") ? 404 : 400;

    return sendJson(res, status, {
      ok: false,
      ...result,
      method_seen: methodSeen,
    });
  }

  return sendJson(res, 200, {
    ...result,
    method_seen: methodSeen,
  });
}
