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

  // monta payload compatível com o engine
  const payload = {
    workflow_id,
    // se vier execution_id/string, usa; senão o engine gera um novo
    execution_id: typeof execution_id === "string" ? execution_id : undefined,
    workflow_version:
      typeof workflow_version === "string" ? workflow_version : "1.0.0",
    env_mode: typeof env_mode === "string" ? env_mode : "TEST",
    inputs: inputs && typeof inputs === "object" ? inputs : {},
    requested_by:
      typeof requested_by === "string" ? requested_by : "unknown (run api)",
  };

  try {
    const result = await runWorkflow(payload);
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
