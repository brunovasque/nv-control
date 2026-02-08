import { methodNotAllowed, sendJson } from "../../../../workers/orchestrator/http.js";
import { rerunStep } from "../../../../workers/orchestrator/engine.js";

const HANDLER_VERSION = "rerun-path-fix-v2-2026-02-08";

export default async function handler(req, res) {
  const methodSeen = req.method || "UNKNOWN";

  if (methodSeen !== "POST") {
    return methodNotAllowed(req, res, ["POST"]);
  }

  try {
    const execution_id = String(req.query?.execution_id || "").trim();
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const step_id = String(body.step_id || body.stepId || "").trim();

    if (!execution_id) {
      return sendJson(res, 400, {
        ok: false,
        error: "MISSING_EXECUTION_ID",
        message: "execution_id é obrigatório (path).",
        method_seen: methodSeen,
        handler_version: HANDLER_VERSION,
      });
    }

    if (!step_id) {
      return sendJson(res, 400, {
        ok: false,
        error: "MISSING_STEP_ID",
        message: "body.step_id é obrigatório.",
        execution_id,
        method_seen: methodSeen,
        handler_version: HANDLER_VERSION,
      });
    }

    // compat: engine canônico atual é rerunStep(env, executionId, stepId)
    // (mantém fallback se alguém tiver engine antigo por algum motivo)
    const result =
      typeof rerunStep === "function" && rerunStep.length >= 3
        ? await rerunStep(process.env, execution_id, step_id)
        : await rerunStep(execution_id, step_id);

    if (!result?.ok) {
      return sendJson(res, 404, {
        ok: false,
        execution_id,
        step_id,
        error: result?.error || "RERUN_FAILED",
        method_seen: methodSeen,
        handler_version: HANDLER_VERSION,
      });
    }

    return sendJson(res, 200, {
      ok: true,
      execution_id,
      step_id,
      ...result,
      method_seen: methodSeen,
      handler_version: HANDLER_VERSION,
    });
  } catch (e) {
    return sendJson(res, 500, {
      ok: false,
      error: "RERUN_STEP_FAILED",
      message: e?.message || String(e),
      method_seen: methodSeen,
      handler_version: HANDLER_VERSION,
    });
  }
}
