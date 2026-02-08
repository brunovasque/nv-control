const HANDLER_VERSION = "rerun-path-fix-v5-2026-02-08";

export default async function handler(req, res) {
  const methodSeen = req.method || "UNKNOWN";

  try {
    // imports tardios (impede crash no boot)
    const httpMod = await import("../../../../workers/orchestrator/http.js");
    const engineMod = await import("../../../../workers/orchestrator/engine.js");

    const methodNotAllowed = httpMod.methodNotAllowed || httpMod.methodNotAllowed;
    const sendJson = httpMod.sendJson;
    const rerunStep = engineMod.rerunStep;

    if (!sendJson || !rerunStep) {
      return res.status(500).json({
        ok: false,
        error: "IMPORTS_INVALID",
        handler_version: HANDLER_VERSION,
        found: {
          has_sendJson: !!sendJson,
          has_rerunStep: !!rerunStep,
          http_keys: Object.keys(httpMod || {}),
          engine_keys: Object.keys(engineMod || {}),
        },
      });
    }

    if (methodSeen !== "POST") {
      if (methodNotAllowed) return methodNotAllowed(req, res, ["POST"]);
      return sendJson(res, 405, { ok: false, error: "METHOD_NOT_ALLOWED", allow: ["POST"] });
    }

    const execution_id_path = String(req.query?.execution_id || "").trim();
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const execution_id = String(execution_id_path || body.execution_id || "").trim();
    const step_id = String(body.step_id || body.stepId || "").trim();

    if (!execution_id) return sendJson(res, 400, { ok: false, error: "MISSING_EXECUTION_ID", handler_version: HANDLER_VERSION });
    if (!step_id) return sendJson(res, 400, { ok: false, error: "MISSING_STEP_ID", handler_version: HANDLER_VERSION });

    const result = await rerunStep(process.env, execution_id, step_id);

    if (!result?.ok) {
      return sendJson(res, 400, {
        ok: false,
        execution_id,
        step_id,
        error: result?.error || "RERUN_FAILED",
        handler_version: HANDLER_VERSION,
      });
    }

    return sendJson(res, 200, {
      ok: true,
      execution_id,
      step_id,
      ...result,
      handler_version: HANDLER_VERSION,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "RERUN_STEP_FAILED",
      message: e?.message || String(e),
      handler_version: HANDLER_VERSION,
      method_seen: methodSeen,
    });
  }
}
