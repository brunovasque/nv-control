import { methodNotAllowed, sendJson } from "../../../../workers/orchestrator/http.js";
import { rerunStep } from "../../../../workers/orchestrator/engine.js";

export default async function handler(req, res) {
  const methodSeen = req.method || "UNKNOWN";
  if (methodSeen !== "POST") return methodNotAllowed(req, res, ["POST"]);

  const q = req.query || {};
  const executionId = q.execution_id || q.executionId || null;

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  if (!body || typeof body !== "object") body = {};

  const stepId = body.step_id || body.stepId || null;

  if (!executionId || typeof executionId !== "string") {
    return sendJson(res, 400, { ok: false, error: "execution_id é obrigatório (path param).", method_seen: methodSeen });
  }
  if (!stepId || typeof stepId !== "string") {
    return sendJson(res, 400, { ok: false, error: "step_id é obrigatório (string).", method_seen: methodSeen });
  }

  try {
    const result = await rerunStep(executionId, stepId);
    const msg = String(result?.error || result?.message || "");
    const status = result?.ok ? 200 : (msg.toLowerCase().includes("não encontrado") ? 404 : 400);
    return sendJson(res, status, { ...result, method_seen: methodSeen });
  } catch (err) {
    console.error("ORCH_RERUN_ERROR", err);
    return sendJson(res, 500, {
      ok: false,
      error: "RERUN_FAILED",
      message: err?.message ? err.message : String(err),
      method_seen: methodSeen,
    });
  }
}
