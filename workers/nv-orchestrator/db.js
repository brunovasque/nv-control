function requireEnv(env, key) {
  const direct = env?.[key];
  if (direct) return direct;

  if (key === "ORCH_DB_URL") {
    return env?.SUPABASE_URL || null;
  }

  if (key === "ORCH_DB_KEY") {
    return env?.SUPABASE_SERVICE_ROLE_KEY || env?.SUPABASE_KEY || env?.SUPABASE_ANON_KEY || null;
  }

  return null;
}

async function supabaseRequest(env, method, path, { body = null, prefer = null } = {}) {
  const baseUrl = requireEnv(env, "ORCH_DB_URL");
  const key = requireEnv(env, "ORCH_DB_KEY");

  if (!baseUrl || !key) {
    throw new Error("Missing env: ORCH_DB_URL/ORCH_DB_KEY");
  }

  const url = `${String(baseUrl).replace(/\/$/, "")}${path}`;
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json"
  };

  if (prefer) headers.Prefer = prefer;

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null
    });

    const rawText = await response.text();
    const text = (rawText ?? "").trim();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      throw new Error(`Supabase request failed: ${response.status} ${response.statusText} ${JSON.stringify(data || rawText)}`);
    }

    console.log("DB OK:", data);
    return data;
  } catch (e) {
    console.error("DB ERROR:", e);
    throw e;
  }
}

export async function saveWorkflow(env, workflow) {
  const row = {
    workflow_id: workflow.workflow_id,
    payload: workflow
  };

  return supabaseRequest(env, "POST", "/rest/v1/orchestrator_workflows?on_conflict=workflow_id", {
    body: [row],
    prefer: "resolution=merge-duplicates,return=minimal"
  });
}

export async function getWorkflow(env, workflowId) {
  const q = `?workflow_id=eq.${encodeURIComponent(workflowId)}&select=payload&limit=1`;
  const rows = await supabaseRequest(env, "GET", `/rest/v1/orchestrator_workflows${q}`);
  return rows?.[0]?.payload || null;
}

export async function saveExecution(env, execution) {
  const row = {
    execution_id: execution.execution_id,
    payload: execution
  };

  return supabaseRequest(env, "POST", "/rest/v1/orchestrator_executions?on_conflict=execution_id", {
    body: [row],
    prefer: "resolution=merge-duplicates,return=minimal"
  });
}

export async function getExecution(env, executionId) {
  const q = `?execution_id=eq.${encodeURIComponent(executionId)}&select=payload&limit=1`;
  const rows = await supabaseRequest(env, "GET", `/rest/v1/orchestrator_executions${q}`);
  return rows?.[0]?.payload || null;
}

export async function setFlag(env, key, value) {
  const row = { key, payload: value };
  return supabaseRequest(
    env,
    "POST",
    "/rest/v1/orchestrator_flags?on_conflict=key",
    {
      body: [row],
      prefer: "resolution=merge-duplicates,return=minimal",
    }
  );
}

export async function getFlag(env, key) {
  const q = `?key=eq.${encodeURIComponent(key)}&select=payload&limit=1`;
  const rows = await supabaseRequest(env, "GET", `/rest/v1/orchestrator_flags${q}`);
  return rows?.[0]?.payload ?? null;
}
