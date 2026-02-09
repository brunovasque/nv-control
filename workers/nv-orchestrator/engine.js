import { getExecution, getFlag, getWorkflow, saveExecution, saveWorkflow, setFlag } from "./db.js";
import { validateRunV1, validateWorkflowV1 } from "./contracts.js";

const STEP_STATUS = {
  PENDING: "pending",
  RUNNING: "running",
  OK: "ok",
  ERROR: "error",
  BLOCKED: "blocked",
  SKIPPED: "skipped"
};

const EXEC_STATUS = {
  RUNNING: "running",
  PAUSED: "paused",
  FAILED: "failed",
  DONE: "done",
  CANCELED: "canceled"
};

export async function saveWorkflowDefinition(env, payload) {
  const input = payload;
  console.log("[saveWorkflowDefinition] input:", JSON.stringify(input || {}, null, 2));
  const errors = validateWorkflowV1(payload);
  if (errors.length > 0) return { ok: false, errors };
  await saveWorkflow(env, payload);
  return { ok: true, workflow: payload };
}

export async function runWorkflow(env, payload) {
  const input = payload;
  console.log("[runWorkflow] input:", JSON.stringify(input || {}, null, 2));
  const errors = validateRunV1(payload);
  if (errors.length > 0) return { ok: false, errors };

  const workflow = await getWorkflow(env, payload.workflow_id);
  if (!workflow) return { ok: false, errors: ["workflow_id não encontrado."] };
  if (workflow.version !== payload.workflow_version) {
    return { ok: false, errors: ["workflow_version divergente da versão salva."] };
  }

  const execution = {
    execution_id: payload.execution_id,
    workflow_id: workflow.workflow_id,
    status: EXEC_STATUS.RUNNING,
    current_step_id: workflow.steps[0]?.id || null,
    steps: workflow.steps.map((step) => ({
      step_id: step.id,
      status: STEP_STATUS.PENDING,
      attempt: 0,
      started_at: null,
      ended_at: null,
      result_resumo: ""
    })),
    needs_approval: false,
    approved_at: null,
    env_mode: payload.env_mode,
    requested_by: payload.requested_by,
    inputs: payload.inputs,
    workflow_version: payload.workflow_version,
    created_at: nowIso(),
    updated_at: nowIso()
  };

  await saveExecution(env, execution);

  if (payload.inputs?.flags && typeof payload.inputs.flags === "object") {
    for (const [key, value] of Object.entries(payload.inputs.flags)) {
      await setFlag(env, key, value);
    }
  }

  return {
    ok: true,
    execution: await executeFromStep(env, execution.execution_id, 0)
  };
}

export async function getExecutionState(env, executionId) {
  const input = { execution_id: executionId };
  console.log("[getExecutionState] input:", JSON.stringify(input || {}, null, 2));
  return getExecution(env, executionId);
}

export async function approveExecution(env, executionId) {
  const input = { execution_id: executionId };
  console.log("[approveExecution] input:", JSON.stringify(input || {}, null, 2));
  const execution = await getExecution(env, executionId);
  if (!execution) return { ok: false, error: "execution_id não encontrado." };

  if (!execution.needs_approval) {
    if (execution.status === EXEC_STATUS.RUNNING) {
      const workflow = await getWorkflow(env, execution.workflow_id);
      if (!workflow) {
        execution.status = EXEC_STATUS.FAILED;
        execution.updated_at = nowIso();
        await saveExecution(env, execution);
        return { ok: false, error: "workflow_id não encontrado na execução." };
      }

      const idx = workflow.steps.findIndex((step) => step.id === execution.current_step_id);
      return {
        ok: true,
        already_approved: true,
        resumed: true,
        execution: await executeFromStep(env, executionId, idx >= 0 ? idx + 1 : 0)
      };
    }

    return { ok: true, already_approved: true, execution };
  }

  if (execution.status !== EXEC_STATUS.PAUSED) {
    return { ok: false, error: "Execução não está aguardando aprovação." };
  }

  execution.needs_approval = false;
  execution.approved_at = nowIso();
  execution.status = EXEC_STATUS.RUNNING;

  const blockedIdx = execution.steps.findIndex((step) => step.status === STEP_STATUS.BLOCKED);
  if (blockedIdx >= 0) {
    execution.steps[blockedIdx].status = STEP_STATUS.OK;
    execution.steps[blockedIdx].ended_at = nowIso();
    execution.steps[blockedIdx].result_resumo = "Aprovado manualmente.";
  }

  execution.updated_at = nowIso();
  await saveExecution(env, execution);

  return {
    ok: true,
    execution: await executeFromStep(env, executionId, blockedIdx + 1)
  };
}

export async function rerunStep(env, executionId, stepId) {
  const input = { execution_id: executionId, step_id: stepId };
  console.log("[rerunStep] input:", JSON.stringify(input || {}, null, 2));
  const execution = await getExecution(env, executionId);
  if (!execution) return { ok: false, error: "execution_id não encontrado." };

  const workflow = await getWorkflow(env, execution.workflow_id);
  if (!workflow) return { ok: false, error: "workflow_id não encontrado na execução." };

  const index = workflow.steps.findIndex((step) => step.id === stepId);
  if (index < 0) return { ok: false, error: "step_id não encontrado no workflow." };

  const current = execution.steps[index];
  if (!current || ![STEP_STATUS.ERROR, STEP_STATUS.OK].includes(current.status)) {
    return { ok: false, error: "step só pode ser reexecutado quando status for 'error' ou 'ok'." };
  }

  execution.status = EXEC_STATUS.RUNNING;
  execution.needs_approval = false;
  execution.current_step_id = stepId;
  execution.updated_at = nowIso();
  await saveExecution(env, execution);

  return {
    ok: true,
    execution: await executeFromStep(env, executionId, index)
  };
}

async function executeFromStep(env, executionId, startIndex) {
  let execution = await getExecution(env, executionId);
  if (!execution) return null;

  const workflow = await getWorkflow(env, execution.workflow_id);
  if (!workflow) {
    execution.status = EXEC_STATUS.FAILED;
    execution.updated_at = nowIso();
    await saveExecution(env, execution);
    return execution;
  }

  for (let i = startIndex; i < workflow.steps.length; i += 1) {
    execution.current_step_id = workflow.steps[i].id;
    execution.updated_at = nowIso();
    await saveExecution(env, execution);

    execution = await executeSingleStep(env, executionId, i);

    if (execution.status === EXEC_STATUS.PAUSED || execution.status === EXEC_STATUS.FAILED) {
      return execution;
    }
  }

  execution.status = EXEC_STATUS.DONE;
  execution.current_step_id = null;
  execution.updated_at = nowIso();
  await saveExecution(env, execution);

  return execution;
}

async function executeSingleStep(env, executionId, index) {
  const execution = await getExecution(env, executionId);
  const workflow = await getWorkflow(env, execution.workflow_id);

  const stepDef = workflow.steps[index];
  const stepState = execution.steps[index];

  stepState.status = STEP_STATUS.RUNNING;
  stepState.attempt += 1;
  stepState.started_at = nowIso();
  stepState.ended_at = null;
  stepState.result_resumo = "";
  execution.updated_at = nowIso();
  await saveExecution(env, execution);

  const retryConfig = resolveRetryConfig(stepDef);

  for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt += 1) {
    try {
      const result = await executeStepType(env, stepDef);

      if (result.pauseForApproval) {
        stepState.status = STEP_STATUS.BLOCKED;
        stepState.result_resumo = "Aguardando aprovação humana.";
        execution.status = EXEC_STATUS.PAUSED;
        execution.needs_approval = true;
        execution.updated_at = nowIso();
        await saveExecution(env, execution);
        return execution;
      }

      stepState.status = STEP_STATUS.OK;
      stepState.ended_at = nowIso();
      stepState.result_resumo = result.resultResumo || "ok";
      execution.status = EXEC_STATUS.RUNNING;
      execution.updated_at = nowIso();
      await saveExecution(env, execution);
      return execution;
    } catch (err) {
      stepState.status = STEP_STATUS.ERROR;
      stepState.ended_at = nowIso();
      stepState.result_resumo = shortError(err);
      execution.updated_at = nowIso();
      await saveExecution(env, execution);

      if (attempt < retryConfig.maxAttempts) {
        if (retryConfig.backoffMs > 0) await sleep(retryConfig.backoffMs);

        stepState.status = STEP_STATUS.RUNNING;
        stepState.attempt += 1;
        stepState.started_at = nowIso();
        stepState.ended_at = null;
        stepState.result_resumo = "Retry em andamento.";
        execution.updated_at = nowIso();
        await saveExecution(env, execution);
        continue;
      }

      execution.status = EXEC_STATUS.FAILED;
      execution.updated_at = nowIso();
      await saveExecution(env, execution);
      return execution;
    }
  }

  return execution;
}

async function executeStepType(env, stepDef) {
  switch (stepDef.type) {
    case "human.approval":
      return { pauseForApproval: true };
    case "http.request":
      return runHttpRequest(stepDef.params);
    case "wait.until_flag":
      return waitUntilFlag(env, stepDef.params);
    case "enavia.deploy_step":
      return runEnaviaDeployStep(stepDef.params);
    case "enavia.browser_plan":
      return { resultResumo: "Plano de browser recebido e registrado (MVP)." };
    default:
      return { resultResumo: `Step tipo '${stepDef.type}' executado em modo pass-through (MVP).` };
  }
}

async function runHttpRequest(params = {}) {
  const method = (params.method || "GET").toUpperCase();
  const response = await fetch(params.url, {
    method,
    headers: params.headers || {},
    body: method === "GET" || method === "HEAD" ? undefined : JSON.stringify(params.body || {})
  });

  const text = await response.text();
  if (!response.ok) throw new Error(`http.request ${response.status}: ${text.slice(0, 180)}`);

  return { resultResumo: `http.request ${response.status} ${method} ${params.url}` };
}

async function runEnaviaDeployStep(params = {}) {
  const method = (params.method || "POST").toUpperCase();
  const headers = normalizeHeaders(params.headers || {});
  const timeoutMs = Number(params.timeout_ms || 10000);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(params.url, {
      method,
      headers,
      body: method === "GET" || method === "HEAD" ? undefined : JSON.stringify(params.body || {}),
      signal: controller.signal
    });

    const text = await response.text();
    if (!response.ok) throw new Error(`enavia.deploy_step ${response.status}: ${text.slice(0, 180)}`);

    return { resultResumo: `enavia.deploy_step ${response.status} ${method} ${params.url}` };
  } catch (err) {
    if (err?.name === "AbortError") throw new Error(`enavia.deploy_step timeout após ${timeoutMs}ms`);
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function waitUntilFlag(env, params = {}) {
  const started = Date.now();
  const timeoutMs = Number(params.timeout_ms || 30000);
  const intervalMs = Number(params.interval_ms || 1000);

  while (Date.now() - started <= timeoutMs) {
    const value = await getFlag(env, params.key);
    if (value === params.expected) return { resultResumo: `Flag '${params.key}' atingiu valor esperado.` };
    await sleep(intervalMs);
  }

  throw new Error(`wait.until_flag timeout: '${params.key}' não atingiu '${params.expected}'`);
}

function resolveRetryConfig(stepDef) {
  if (stepDef.on_error !== "retry_simple") return { maxAttempts: 1, backoffMs: 0 };

  const retry = stepDef.params?.retry || {};
  return {
    maxAttempts: Math.max(1, Number.isInteger(Number(retry.max_attempts)) ? Number(retry.max_attempts) : 2),
    backoffMs: Math.max(0, Number.isFinite(Number(retry.backoff_ms)) ? Number(retry.backoff_ms) : 250)
  };
}

function normalizeHeaders(headers) {
  const out = {};
  for (const [k, v] of Object.entries(headers)) out[String(k)] = String(v);
  if (!out["Content-Type"]) out["Content-Type"] = "application/json";
  return out;
}

function nowIso() {
  return new Date().toISOString();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shortError(err) {
  const msg = err && err.message ? err.message : String(err);
  return msg.length > 180 ? `${msg.slice(0, 177)}...` : msg;
}
