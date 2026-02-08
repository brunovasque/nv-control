// api/orchestrator/run.js

import { methodNotAllowed, sendJson } from "../../workers/orchestrator/http.js";
import { runWorkflow } from "../../workers/orchestrator/engine.js";

export default async function handler(req, res) {
  const methodSeen = req.method || "UNKNOWN";

  // por contrato: RUN é sempre POST
  if (methodSeen !== "POST") {
    return methodNotAllowed(req, res, ["POST"]);
  }

  const body = req.body || {};
  const {
    workflow_id,
    execution_id,
    workflow_version,
    env_mode,
    inputs,
    requested_by,
  } = body;

  if (!workflow_id || typeof workflow_id !== "string") {
    return sendJson(res, 400, {
      ok: false,
      error: "workflow_id é obrigatório (string).",
      method_seen: methodSeen,
    });
  }

  const payload = {
    execution_id,
    workflow_id,
    workflow_version,
    env_mode,
    inputs,
    requested_by,
  };

  try {
    const result = await runWorkflow(process.env, payload);

    if (!result.ok) {
      return sendJson(res, 400, {
        ok: false,
        errors: result.errors,
        method_seen: methodSeen,
      });
    }

    const execution = result.execution;

    return sendJson(res, 200, {
      ok: true,
      workflow_id: execution.workflow_id,
      execution_id: execution.execution_id,
      execution,
      method_seen: methodSeen,
    });
  } catch (err) {
    console.error("ORCHESTRATOR_RUN_ERROR", err);

    return sendJson(res, 500, {
      ok: false,
      error: "RUN_WORKFLOW_FAILED",
      message: err && err.message ? err.message : String(err),
      method_seen: methodSeen,
    });
  }
}
