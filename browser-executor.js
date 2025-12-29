/**
 * Browser Executor Client
 * Frontend-only (NV-CONTROL)
 */

console.log("BROWSER EXECUTOR CARREGADO");

window.callBrowserExecutor = async function (payload) {
  const RAW_EXECUTOR_URL =
    window.RUN_ADAPTER_URL ||
    window.BROWSER_EXECUTOR_URL ||
    localStorage.getItem("nv_run_adapter_url");

  if (!RAW_EXECUTOR_URL) {
    throw new Error("RUN_ADAPTER_URL não definida");
  }

  // ✅ Normaliza base: remove trailing "/" e evita base já vir com "/run"
  const base = String(RAW_EXECUTOR_URL).trim().replace(/\/+$/, "");
  const EXECUTOR_BASE = base.endsWith("/run") ? base.slice(0, -4) : base;

  // =======================================================
  // 🔧 NORMALIZAÇÃO CANÔNICA
  // =======================================================
  const plan = payload && payload.plan ? payload.plan : payload;

  if (!plan || !plan.execution_id || !Array.isArray(plan.steps)) {
    throw new Error("Payload inválido para Browser Executor");
  }

  const requestBody = {
    plan: {
      execution_id: plan.execution_id,
      version: plan.version || "plan.v1",
      source: plan.source || "nv-control",
      steps: plan.steps,
    },
  };

  try {
    const r = await fetch(`${EXECUTOR_BASE}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!r.ok) {
      const text = await r.text();

      await reportToDirector({
        execution_id: plan.execution_id,
        status: "error",
        message: text,
      });

      throw new Error(`Executor error (${r.status}): ${text}`);
    }

    const result = await r.json();

    await reportToDirector({
      execution_id: plan.execution_id,
      status: "finished",
      message: "Execução finalizada",
      evidence: result,
    });

    return result;

  } catch (err) {
    await reportToDirector({
      execution_id: plan.execution_id,
      status: "exception",
      message: err.message || String(err),
    });

    throw err;
  }
};

async function reportToDirector(payload) {
  const DIRECTOR_REPORT_URL = window.DIRECTOR_REPORT_URL;

  if (!DIRECTOR_REPORT_URL) {
    console.warn("DIRECTOR_REPORT_URL não definido, relatório não enviado");
    return;
  }

  try {
    await fetch(DIRECTOR_REPORT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        payload.plan ? payload : { plan: payload }
      ),
    });
  } catch (err) {
    console.error("Falha ao reportar ao Diretor:", err);
  }
}

// =======================================================
// CANONICAL DIRECTOR → BROWSER EXECUTOR BRIDGE
// =======================================================
window.__NV_DIRECTOR_CHAT_EXECUTE__ = async function (input) {
  if (typeof window.callBrowserExecutor !== "function") {
    throw new Error("Browser executor not initialized");
  }

  // Se já vier payload/plan pronto, só repassa
  if (input && typeof input === "object") {
    return window.callBrowserExecutor(input);
  }

  const text = String(input || "").trim();

  // Comando mínimo suportado: "abrir https://..."
  const urlMatch = text.match(/https?:\/\/[^\s]+/i);
  if (!urlMatch) {
    throw new Error(
      "Comando inválido: envie 'abrir https://...' (preciso de uma URL)."
    );
  }

  const plan = {
    execution_id: `exec-${Date.now()}`,
    steps: [{ type: "open", url: urlMatch[0] }],
    source: "nv-control",
    version: "plan.v1",
  };

  return window.callBrowserExecutor({ plan });
};

