function nowIso() {
  return new Date().toISOString();
}

function resolveEnv(maybeEnv) {
  // se já veio um env "de verdade"
  if (
    maybeEnv &&
    typeof maybeEnv === "object" &&
    ("ORCH_DB_URL" in maybeEnv ||
      "ORCH_DB_KEY" in maybeEnv ||
      "SUPABASE_URL" in maybeEnv ||
      "SUPABASE_SERVICE_ROLE_KEY" in maybeEnv)
  ) {
    return maybeEnv;
  }

  // Vercel/Node
  if (typeof process !== "undefined" && process.env) return process.env;

  return {};
}

function requireEnv(env, key) {
  const e = env || {};
  const direct = e[key];
  if (direct) return direct;

  // ✅ fallback seguro (não quebra quem já tem ORCH_*)
  if (key === "ORCH_DB_URL") {
    const fb = e.SUPABASE_URL;
    if (fb) return fb;
  }
  if (key === "ORCH_DB_KEY") {
    const fb = e.SUPABASE_SERVICE_ROLE_KEY || e.SUPABASE_KEY || e.SUPABASE_ANON_KEY;
    if (fb) return fb;
  }

  throw new Error(`Missing env: ${key}`);
}

async function supabaseRequest(envIn, method, path, { body = null, prefer = null } = {}) {
  const env = resolveEnv(envIn);

  const baseUrl = requireEnv(env, "ORCH_DB_URL");
  const key = requireEnv(env, "ORCH_DB_KEY");

  const url = `${String(baseUrl).replace(/\/$/, "")}${path}`;

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
  const text = (rawText ?? "").trim();

  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error(
        `[orchestrator/db] invalid JSON (${response.status}) ${method} ${path}: ${e.message}`
      );
    }
  }

  if (!response.ok) {
    const err = data || { message: rawText || "Supabase request failed" };
    throw new Error(
      `Supabase request failed: ${response.status} ${response.statusText} ${JSON.stringify(err)}`
    );
  }

  return data;
}

// -------------------------
// WORKFLOWS
// -------------------------
export async function saveWorkflow(a, b) {
  const env = resolveEnv(b ? a : null);
  const workflow = b ? b : a;

  // ✅ tabela não tem coluna version
  const row = {
    workflow_id: workflow.workflow_id,
    payload: workflow,
  };

  return supabaseRequest(env, "POST", `/rest/v1/orchestrator_workflows?on_conflict=workflow_id`, {
    body: [row],
    prefer: "resolution=merge-duplicates,return=minimal",
  });
}

export async function getWorkflow(a, b) {
  const env = resolveEnv(b ? a : null);
  const workflow_id = b ? b : a;

  const q = `?workflow_id=eq.${encodeURIComponent(workflow_id)}&select=payload&limit=1`;
  const rows = await supabaseRequest(env, "GET", `/rest/v1/orchestrator_workflows${q}`);
  return rows?.[0]?.payload || null;
}

// -------------------------
// EXECUTIONS
// -------------------------
export async function saveExecution(a, b) {
  const env = resolveEnv(b ? a : null);
  const execution = b ? b : a;

  // ✅ não usa updated_at (tabela não tem essa coluna)
  const row = {
    execution_id: execution.execution_id,
    payload: execution,
  };

  return supabaseRequest(env, "POST", `/rest/v1/orchestrator_executions?on_conflict=execution_id`, {
    body: [row],
    prefer: "resolution=merge-duplicates,return=minimal",
  });
}

export async function getExecution(a, b) {
  const env = resolveEnv(b ? a : null);
  const execution_id = b ? b : a;

  const q = `?execution_id=eq.${encodeURIComponent(execution_id)}&select=payload&limit=1`;
  const rows = await supabaseRequest(env, "GET", `/rest/v1/orchestrator_executions${q}`);
  return rows?.[0]?.payload || null;
}
