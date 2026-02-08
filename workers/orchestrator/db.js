function nowIso() {
  return new Date().toISOString();
}

function requireEnv(env, key) {
  const v = env[key];
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
}

async function supabaseRequest(env, method, path, { body = null, prefer = null } = {}) {
  const baseUrl = requireEnv(env, "ORCH_DB_URL");
  const key = requireEnv(env, "ORCH_DB_KEY");

  const url = `${baseUrl.replace(/\/$/, "")}${path}`;

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };

  if (prefer) headers.Prefer = prefer;

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });

  const rawText = await response.text();
  const text = (rawText ?? "").trim(); // ✅ blindagem: evita JSON.parse("\n")

  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (e) {
      // ✅ erro explícito e rastreável
      throw new Error(
        `[orchestrator/db] invalid JSON from Supabase (${response.status}) ${method} ${path}: ${e.message} | body_preview="${text.slice(
          0,
          200
        )}"`
      );
    }
  }

  if (!response.ok) {
    const err = data || { message: rawText || "Supabase request failed" };
    throw new Error(
      `Supabase request failed: ${response.status} ${response.statusText} ${JSON.stringify(
        err
      )}`
    );
  }

  return data;
}

// Tabela workflows
export async function saveWorkflow(env, workflow) {
  const payload = {
    workflow_id: workflow.workflow_id,
    version: workflow.version,
    payload: workflow,
    updated_at: nowIso(),
  };

  return supabaseRequest(env, "POST", `/rest/v1/orchestrator_workflows?on_conflict=workflow_id,version`, {
    body: [payload],
    // ✅ return=minimal reduz chance de body "estranho"
    prefer: "resolution=merge-duplicates,return=minimal",
  });
}

export async function getWorkflow(env, workflow_id, version) {
  const q = `?workflow_id=eq.${encodeURIComponent(workflow_id)}&version=eq.${encodeURIComponent(
    version
  )}&select=payload&limit=1`;
  const rows = await supabaseRequest(env, "GET", `/rest/v1/orchestrator_workflows${q}`);
  return rows?.[0]?.payload || null;
}

// Tabela executions
export async function saveExecution(env, execution) {
  const payload = {
    execution_id: execution.execution_id,
    payload: execution,
    updated_at: nowIso(),
  };

  return supabaseRequest(env, "POST", `/rest/v1/orchestrator_executions?on_conflict=execution_id`, {
    body: [payload],
    prefer: "resolution=merge-duplicates,return=minimal",
  });
}

export async function getExecution(env, execution_id) {
  const q = `?execution_id=eq.${encodeURIComponent(execution_id)}&select=payload&limit=1`;
  const rows = await supabaseRequest(env, "GET", `/rest/v1/orchestrator_executions${q}`);
  return rows?.[0]?.payload || null;
}
