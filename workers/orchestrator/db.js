const ORCH_DB_URL = process.env.ORCH_DB_URL || process.env.SUPABASE_URL || "";
const ORCH_DB_KEY =
  process.env.ORCH_DB_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "";

const WORKFLOWS_TABLE =
  process.env.ORCH_DB_WORKFLOWS_TABLE || "orchestrator_workflows";
const EXECUTIONS_TABLE =
  process.env.ORCH_DB_EXECUTIONS_TABLE || "orchestrator_executions";
const FLAGS_TABLE = process.env.ORCH_DB_FLAGS_TABLE || "orchestrator_flags";

const hasRemoteDbConfig = Boolean(ORCH_DB_URL && ORCH_DB_KEY);

let hasWarnedMemoryFallback = false;

const memoryDb = {
  workflows: {},
  executions: {},
  flags: {},
};

function warnMemoryFallback() {
  if (hasWarnedMemoryFallback) return;
  hasWarnedMemoryFallback = true;
  console.warn(
    "[orchestrator] DB remoto não configurado. Usando memory fallback."
  );
}

async function supabaseRequest(table, { method = "GET", query = "", body = null }) {
  const url = `${ORCH_DB_URL}/rest/v1/${table}${query || ""}`;
  const headers = {
    apikey: ORCH_DB_KEY,
    Authorization: `Bearer ${ORCH_DB_KEY}`,
    "Content-Type": "application/json",
  };

  const resp = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(
      `Supabase request failed: ${resp.status} ${resp.statusText} ${text}`
    );
  }

  if (resp.status === 204) return null;
  return resp.json();
}

async function getPayloadById(table, idColumn, idValue) {
  const query = `?${idColumn}=eq.${encodeURIComponent(
    idValue
  )}&select=payload&limit=1`;
  const rows = await supabaseRequest(table, { query });

  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0]?.payload ?? null;
}

async function upsertRow(table, idColumn, idValue, payload) {
  const row = { [idColumn]: idValue, payload };
  await supabaseRequest(table, {
    method: "POST",
    query: "?on_conflict=" + encodeURIComponent(idColumn),
    body: row,
  });
}

function saveWorkflowMemory(workflow) {
  memoryDb.workflows[workflow.workflow_id] = workflow;
  return workflow;
}

function saveExecutionMemory(execution) {
  memoryDb.executions[execution.execution_id] = execution;
  return execution;
}

function setFlagMemory(key, value) {
  memoryDb.flags[key] = value;
  return value;
}

export function getDbMeta() {
  return {
    mode: hasRemoteDbConfig ? "remote" : "memory",
    hasRemoteDbConfig,
    url_present: Boolean(ORCH_DB_URL),
    key_present: Boolean(ORCH_DB_KEY),
    tables: {
      workflows: WORKFLOWS_TABLE,
      executions: EXECUTIONS_TABLE,
      flags: FLAGS_TABLE,
    },
  };
}

export function peekMemoryExecution(executionId) {
  return memoryDb.executions[executionId] || null;
}

export async function getWorkflow(workflowId) {
  if (!hasRemoteDbConfig) {
    warnMemoryFallback();
    return memoryDb.workflows[workflowId] || null;
  }
  return getPayloadById(WORKFLOWS_TABLE, "workflow_id", workflowId);
}

export async function saveWorkflow(workflow) {
  if (!hasRemoteDbConfig) {
    warnMemoryFallback();
    return saveWorkflowMemory(workflow);
  }
  await upsertRow(WORKFLOWS_TABLE, "workflow_id", workflow.workflow_id, workflow);
  return workflow;
}

export async function getExecution(executionId) {
  if (!hasRemoteDbConfig) {
    warnMemoryFallback();
    return memoryDb.executions[executionId] || null;
  }
  return getPayloadById(EXECUTIONS_TABLE, "execution_id", executionId);
}

export async function saveExecution(execution) {
  if (!hasRemoteDbConfig) {
    warnMemoryFallback();
    return saveExecutionMemory(execution);
  }
  await upsertRow(
    EXECUTIONS_TABLE,
    "execution_id",
    execution.execution_id,
    execution
  );
  return execution;
}

export async function setFlag(key, value) {
  if (!hasRemoteDbConfig) {
    warnMemoryFallback();
    return setFlagMemory(key, value);
  }
  await upsertRow(FLAGS_TABLE, "key", key, value);
  return value;
}

export async function getFlag(key) {
  if (!hasRemoteDbConfig) {
    warnMemoryFallback();
    return memoryDb.flags[key];
  }
  return getPayloadById(FLAGS_TABLE, "key", key);
}
