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
  const errors = validateWorkflowV1(payload);
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  await saveWorkflow(env, payload);

  return {
    ok: true,
    workflow: payload
  };
}

export async function runWorkflow(env, payload) {
  const errors = validateRunV1(payload);
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const workflow = await getWorkflow(env, payload.workflow_id);
  if (!workflow) {
    return { ok: false, errors: ["workflow_id não encontrado."] };
  }

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
    const keys = Object.keys(payload.inputs.flags);
    for (const key of keys) {
      await setFlag(env, key, payload.inputs.flags[key]);
    }
  }

  const finalExecution = await executeFromStep(env, execution.execution_id, 0);

  return {
    ok: true,
    execution: finalExecution
  };
}

export async function getExecutionState(env, executionId) {
  return getExecution(env, executionId);
}

export async function approveExecution(a, b) {
  const env = b ? a : process.env;
  const executionId = b ? b : a;

  const execution = await getExecution(env, executionId);
  if (!execution) {
    return { ok: false, error: "execution_id não encontrado." };
  }

  // RESUME: se já foi aprovada e está RUNNING, tenta continuar do próximo step
  if (!execution.needs_approval) {
    if (execution.status === EXEC_STATUS.RUNNING) {
      const workflow = await getWorkflow(env, execution.workflow_id);
      if (!workflow) {
        execution.status = EXEC_STATUS.FAILED;
        execution.updated_at = nowIso();
        await saveExecution(env, execution);
        return { ok: false, error: "workflow_id não encontrado na execução." };
      }

      const idx = workflow.steps.findIndex((s) => s.id === execution.current_step_id);
      const startIndex = idx >= 0 ? idx + 1 : 0;

      return {
        ok: true,
        already_approved: true,
        resumed: true,
        execution: await executeFromStep(env, executionId, startIndex),
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
    execution: await executeFromStep(env, executionId, blockedIdx + 1),
  };
}

export async function approveExecution(executionId) {
  const execution = await getExecution(executionId);
  if (!execution) {
    return { ok: false, error: "execution_id não encontrado." };
  }

  // ✅ RESUME: se já foi aprovada e está RUNNING, tenta continuar do próximo step
  if (!execution.needs_approval) {
    if (execution.status === EXEC_STATUS.RUNNING) {
      const workflow = await getWorkflow(execution.workflow_id);
      if (!workflow) {
        execution.status = EXEC_STATUS.FAILED;
        execution.updated_at = nowIso();
        await saveExecution(execution);
        return { ok: false, error: "workflow_id não encontrado na execução." };
      }

      const idx = workflow.steps.findIndex((s) => s.id === execution.current_step_id);
      const startIndex = idx >= 0 ? idx + 1 : 0;

      return {
        ok: true,
        already_approved: true,
        resumed: true,
        execution: await executeFromStep(executionId, startIndex),
      };
    }

    // já aprovado e não está rodando: só responde ok
    return { ok: true, already_approved: true, execution };
  }

  // aqui: ainda precisa de aprovação
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
  await saveExecution(execution);

  return {
    ok: true,
    execution: await executeFromStep(executionId, blockedIdx + 1),
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
      const result = await executeStepType(env, stepDef, execution);

      if (result.pauseForApproval) {
        stepState.status = STEP_STATUS.BLOCKED;
        stepState.ended_at = null;
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
        if (retryConfig.backoffMs > 0) {
          await sleep(retryConfig.backoffMs);
        }

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

async function executeStepType(env, stepDef, execution) {
  switch (stepDef.type) {
    case "human.approval":
      return { pauseForApproval: true };

    case "http.request":
      return runHttpRequest(stepDef.params);

    case "wait.until_flag":
      return waitUntilFlag(env, stepDef.params);

    case "enavia.deploy_step":
      return runEnaviaDeployStep(env, stepDef.params);

    case "enavia.browser_plan":
      return {
        resultResumo: "Plano de browser recebido e registrado (MVP)."
      };

    default:
      return {
        resultResumo: `Step tipo '${stepDef.type}' executado em modo pass-through (MVP).`
      };
  }
}

async function runHttpRequest(params = {}) {
  const method = (params.method || "GET").toUpperCase();
  const headers = params.headers || {};
  const hasBody = method !== "GET" && method !== "HEAD";

  const response = await fetch(params.url, {
    method,
    headers,
    body: hasBody ? JSON.stringify(params.body || {}) : undefined
  });

  const text = await response.text();
  const summaryBody = text.length > 120 ? `${text.slice(0, 117)}...` : text;

  if (!response.ok) {
    throw new Error(`http.request ${response.status}: ${summaryBody}`);
  }

  return {
    resultResumo: `http.request ${response.status} ${method} ${params.url}`
  };
}

async function runEnaviaDeployStep(env, params = {}) {
  const url = params.url;
  const method = (params.method || "POST").toUpperCase();
  const headers = normalizeHeaders(params.headers || {});
  const hasBody = method !== "GET" && method !== "HEAD";
  const timeoutMs = Number(params.timeout_ms || 10000);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: hasBody ? JSON.stringify(params.body || {}) : undefined,
      signal: controller.signal
    });

    const responseText = await response.text();
    const preview = responseText.length > 180 ? `${responseText.slice(0, 177)}...` : responseText;

    if (!response.ok) {
      throw new Error(`enavia.deploy_step ${response.status}: ${preview}`);
    }

    return {
      resultResumo: `enavia.deploy_step ${response.status} ${method} ${url}`
    };
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error(`enavia.deploy_step timeout após ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeHeaders(headers) {
  const out = {};
  for (const [k, v] of Object.entries(headers || {})) {
    out[String(k)] = String(v);
  }
  if (!out["Content-Type"]) out["Content-Type"] = "application/json";
  return out;
}

async function waitUntilFlag(env, params = {}) {
  const key = params.key;
  const expected = params.expected;
  const timeoutMs = Number(params.timeout_ms || 30000);
  const intervalMs = Number(params.interval_ms || 1000);

  const started = Date.now();

  while (Date.now() - started <= timeoutMs) {
    const value = await getFlag(env, key);

    if (value === expected) {
      return { resultResumo: `Flag '${key}' atingiu valor esperado.` };
    }

    await sleep(intervalMs);
  }

  throw new Error(`wait.until_flag timeout: '${key}' não atingiu '${expected}'`);
}

function resolveRetryConfig(stepDef) {
  if (stepDef.on_error !== "retry_simple") {
    return { maxAttempts: 1, backoffMs: 0 };
  }

  const retry = stepDef.params?.retry || {};
  const maxAttempts = Number.isInteger(Number(retry.max_attempts)) ? Number(retry.max_attempts) : 2;
  const backoffMs = Number.isFinite(Number(retry.backoff_ms)) ? Number(retry.backoff_ms) : 250;

  return {
    maxAttempts: Math.max(1, maxAttempts),
    backoffMs: Math.max(0, backoffMs)
  };
}

function nowIso() {
  return new Date().toISOString();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function shortError(err) {
  const msg = err && err.message ? err.message : String(err);
  return msg.length > 180 ? `${msg.slice(0, 177)}...` : msg;
}
