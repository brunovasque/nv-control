import { methodNotAllowed, sendJson } from "../../../../workers/orchestrator/http.js";
import { approveExecution } from "../../../../workers/orchestrator/engine.js";

export default async function handler(req, res) {
  const methodSeen = req.method || "UNKNOWN";
  if (methodSeen !== "POST") return methodNotAllowed(req, res, ["POST"]);

  const q = req.query || {};
  const executionId = q.execution_id || q.executionId || null;

  if (!executionId || typeof executionId !== "string") {
    return sendJson(res, 400, {
      ok: false,
      error: "execution_id é obrigatório (path param).",
      method_seen: methodSeen,
    });
  }

  try {
    const result = await approveExecution(executionId);
    const msg = String(result?.error || result?.message || "");
    const status = result?.ok ? 200 : (msg.toLowerCase().includes("não encontrado") ? 404 : 400);
    return sendJson(res, status, { ...result, method_seen: methodSeen });
  } catch (err) {
    console.error("ORCH_APPROVE_ERROR", err);
    return sendJson(res, 500, {
      ok: false,
      error: "APPROVE_FAILED",
      message: err?.message ? err.message : String(err),
      method_seen: methodSeen,
    });
  }
}
