function sendJsonFallback(res, status, body) {
  try {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(body, null, 2));
  } catch (e) {
    try { res.end(); } catch {}
  }
}

export default async function handler(req, res) {
  const methodSeen = req.method || "UNKNOWN";

  // Importa tudo dentro do handler (evita crash "mudo" no load)
  let sendJson, methodNotAllowed, approveExecution;
  try {
    const http = await import("../../../../workers/orchestrator/http.js");
    const eng = await import("../../../../workers/orchestrator/engine.js");
    sendJson = http.sendJson;
    methodNotAllowed = http.methodNotAllowed;
    approveExecution = eng.approveExecution;
  } catch (err) {
    return sendJsonFallback(res, 500, {
      ok: false,
      error: "APPROVE_IMPORT_FAILED",
      message: err?.message ? err.message : String(err),
      method_seen: methodSeen,
    });
  }

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
    return sendJson(res, result?.ok ? 200 : 400, { ...result, method_seen: methodSeen });
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
