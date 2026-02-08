import { sendJson, methodNotAllowed } from "../../../workers/orchestrator/http.js";
import { rerunStep } from "../../../workers/orchestrator/engine.js";

export default async function handler(req, res) {
  const methodSeen = req.method || "UNKNOWN";
  if (methodSeen !== "POST") return methodNotAllowed(req, res, ["POST"]);

  const query = req.query || {};

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  if (!body || typeof body !== "object") body = {};

  const executionId =
    query.execution_id ||
    query.executionId ||
    body.execution_id ||
    body.executionId ||
    null;

  const stepId =
    body.step_id ||
    body.stepId ||
    query.step_id ||
    query.stepId ||
    null;

  if (!executionId || typeof executionId !== "string") {
    return sendJson(res, 400, { ok: false, error: "execution_id é obrigatório (string).", method_seen: methodSeen });
  }
  if (!stepId || typeof stepId !== "string") {
    return sendJson(res, 400, { ok: false, error: "step_id é obrigatório (string).", method_seen: methodSeen });
  }

  const result = await rerunStep(executionId, stepId);
  const msg = String(result?.error || result?.message || "");
  const status = result?.ok ? 200 : (msg.includes("não encontrado") ? 404 : 400);

  return sendJson(res, status, { ...result, method_seen: methodSeen });
}
