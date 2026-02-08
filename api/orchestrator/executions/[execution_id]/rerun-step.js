import { methodNotAllowed, sendJson } from "../../../../workers/orchestrator/http.js";
import { rerunStep } from "../../../../workers/orchestrator/engine.js";

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

  try {
    const result = await rerunStep(executionId, stepId);

    if (!result || !result.ok) {
      return sendJson(res, 400, {
        ok: false,
        ...result,
        method_seen: methodSeen,
      });
    }

    return sendJson(res, 200, {
      ...result,
      method_seen: methodSeen,
    });
  } catch (err) {
    console.error("ORCHESTRATOR_RERUN_STEP_ERROR", err);
    return sendJson(res, 500, {
      ok: false,
      error: "RERUN_STEP_FAILED",
      message: err?.message ? String(err.message) : String(err),
      method_seen: methodSeen,
    });
  }
}
