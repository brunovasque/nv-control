const ORCH_DB_URL = process.env.ORCH_DB_URL || process.env.SUPABASE_URL || "";
const ORCH_DB_KEY =
  process.env.ORCH_DB_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "";

const WORKFLOWS_TABLE = process.env.ORCH_DB_WORKFLOWS_TABLE || "orchestrator_workflows";
const EXECUTIONS_TABLE = process.env.ORCH_DB_EXECUTIONS_TABLE || "orchestrator_executions";
const FLAGS_TABLE = process.env.ORCH_DB_FLAGS_TABLE || "orchestrator_flags";

const hasRemoteDbConfig = Boolean(ORCH_DB_URL && ORCH_DB_KEY);

let hasWarnedMemoryFallback = false;
const memoryDb = {
  workflows: {},
  executions: {},
  flags: {}
};

function warnMemoryFallback() {
  if (hasWarnedMemoryFallback) {
    return;
  }

  hasWarnedMemoryFallback = true;
  console.warn(
    "[orchestrator/db] ORCH_DB_URL/ORCH_DB_KEY not configured; using in-memory fallback (non-persistent)."
  );
}

function buildRestUrl(path, query = "") {
  const base = ORCH_DB_URL.replace(/\/+$/, "");
  return `${base}/rest/v1/${path}${query}`;
}

async function supabaseRequest(path, { method = "GET", query = "", body, prefer } = {}) {
  const headers = {
    apikey: ORCH_DB_KEY,
    Authorization: `Bearer ${ORCH_DB_KEY}`
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (prefer) {
    headers.Prefer = prefer;
  }

  const response = await fetch(buildRestUrl(path, query), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const errorMessage = data?.message || data?.hint || text || `HTTP ${response.status}`;
    throw new Error(`[orchestrator/db] ${method} ${path} failed: ${errorMessage}`);
  }

  return data;
}

async function upsertRow(table, idColumn, idValue, payload) {
  await supabaseRequest(table, {
    method: "POST",
    query: `?on_conflict=${encodeURIComponent(idColumn)}`,
    prefer: "resolution=merge-duplicates",
    body: [{ [idColumn]: idValue, payload }]
  });
}

async function getPayloadById(table, idColumn, idValue) {
  const query = `?${idColumn}=eq.${encodeURIComponent(idValue)}&select=payload&limit=1`;
  const rows = await supabaseRequest(table, { query });

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  return rows[0]?.payload ?? null;
}

function saveWorkflowMemory(workflow) {
  memoryDb.workflows[workflow.workflow_id] = workflow;
  return memoryDb;
}

function saveExecutionMemory(execution) {
  memoryDb.executions[execution.execution_id] = execution;
  return memoryDb;
}

function setFlagMemory(key, value) {
  memoryDb.flags[key] = value;
  return memoryDb;
}

export async function saveWorkflow(workflow) {
  if (!hasRemoteDbConfig) {
    warnMemoryFallback();
    return saveWorkflowMemory(workflow);
  }

  await upsertRow(WORKFLOWS_TABLE, "workflow_id", workflow.workflow_id, workflow);
  return workflow;
}

export async function getWorkflow(workflowId) {
  if (!hasRemoteDbConfig) {
    warnMemoryFallback();
    return memoryDb.workflows[workflowId] || null;
  }

  return getPayloadById(WORKFLOWS_TABLE, "workflow_id", workflowId);
}

export async function saveExecution(execution) {
  if (!hasRemoteDbConfig) {
    warnMemoryFallback();
    return saveExecutionMemory(execution);
  }

  await upsertRow(EXECUTIONS_TABLE, "execution_id", execution.execution_id, execution);
  return execution;
}

export async function getExecution(executionId) {
  if (!hasRemoteDbConfig) {
    warnMemoryFallback();
    return memoryDb.executions[executionId] || null;
  }

  return getPayloadById(EXECUTIONS_TABLE, "execution_id", executionId);
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

  const payload = await getPayloadById(FLAGS_TABLE, "key", key);
  return payload;
}
