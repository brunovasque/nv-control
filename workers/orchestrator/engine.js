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

export async function rerunStep(env, executionId, stepId) {
  const execution = await getExecution(env, executionId);
  if (!execution) {
    return { ok: false, error: "execution_id não encontrado." };
  }

  const idx = execution.steps.findIndex((step) => step.step_id === stepId);
  if (idx < 0) {
    return { ok: false, error: "step_id não encontrado na execução." };
  }

  const current = execution.steps[idx];
  if (![STEP_STATUS.OK, STEP_STATUS.ERROR].includes(current.status)) {
    return { ok: false, error: "Somente steps com status 'ok' ou 'error' podem ser reexecutados." };
  }

  execution.status = EXEC_STATUS.RUNNING;
  execution.current_step_id = stepId;
  execution.needs_approval = false;
  execution.updated_at = nowIso();
  await saveExecution(env, execution);

  const afterRerun = await executeSingleStep(env, executionId, idx);
  if (afterRerun.status === EXEC_STATUS.RUNNING) {
    return {
      ok: true,
      execution: await executeFromStep(env, executionId, idx + 1)
    };
  }

  return { ok: true, execution: afterRerun };
}

export async function approveExecution(env, executionId) {
  const execution = await getExecution(env, executionId);
  if (!execution) {
    return { ok: false, error: "execution_id não encontrado." };
  }

  if (!execution.needs_approval || execution.status !== EXEC_STATUS.PAUSED) {
    return {
      ok: false,
      error: "Execução não está aguardando aprovação."
    };
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

    execution =
