import { methodNotAllowed, sendJson } from "././././workers/orchestrator/http.js";
import { rerunStep } from "././././workers/orchestrator/engine.js";

const HANDLER_VERSION = "rerun-path-fix-v2-2026-02-08";

export default async function handler(req, res) {
  const methodSeen = req.method || "UNKNOWN";

  if (methodSeen !== "POST") {
    return methodNotAllowed(req, res, ["POST"]);
  }

  try {
    // execution_id vem do path (Next injeta em req.query.execution_id)
    const execution_id_path = String(req.query?.execution_id || "").trim();

    // compat: se quiser chamar por body também, aceita
    const execution_id_body = String(req.body?.execution_id || "").trim();

    const execution_id = String(execution_id_path || execution_id_body || "").trim();
    const step_id = String(req.body?.step_id || "").trim();

    if (!execution_id) {
      return sendJson(res, 400, {
        ok: false,
        error: "MISSING_EXECUTION_ID",
        handler_version: HANDLER_VERSION,
      });
    }

    if (!step_id) {
      return sendJson(res, 400, {
        ok: false,
        error: "MISSING_STEP_ID",
        handler_version: HANDLER_VERSION,
      });
    }

    // ✅ engine canônico: rerunStep(env, executionId, stepId)
    const result = await rerunStep(process.env, execution_id, step_id);

    if (!result?.ok) {
      return sendJson(res, 400, {
        ok: false,
        execution_id,
        step_id,
        ...(result || {}),
        handler_version: HANDLER_VERSION,
      });
    }

    return sendJson(res, 200, {
      ok: true,
      execution_id,
      step_id,
      ...(result || {}),
      handler_version: HANDLER_VERSION,
    });
  } catch (e) {
    return sendJson(res, 500, {
      ok: false,
      error: "RERUN_STEP_FAILED",
      message: e?.message || String(e),
      handler_version: HANDLER_VERSION,
    });
  }
}
