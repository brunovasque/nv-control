/**
 * Browser Executor Client
 * Frontend-only (NV-CONTROL)
 */

console.log("BROWSER EXECUTOR CARREGADO");

window.callBrowserExecutor = async function (payload) {
  // 🔴 RESOLUÇÃO CANÔNICA DA URL DO EXECUTOR (HTTPS)
  const EXECUTOR_URL =
  window.RUN_ADAPTER_URL ||
  localStorage.getItem("nv_run_adapter_url");

if (!EXECUTOR_URL) {
  throw new Error("RUN_ADAPTER_URL não definida");
}

  try {
    const r = await fetch(`${EXECUTOR_URL}/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const text = await r.text();

      // 🔁 LOOP — erro reportado ao Diretor
      await reportToDirector({
        execution_id: payload.execution_id,
        status: "error",
        message: text,
      });

      throw new Error(`Executor error (${r.status}): ${text}`);
    }

    const result = await r.json();

    // 🔁 LOOP — finalização reportada ao Diretor
    await reportToDirector({
      execution_id: payload.execution_id,
      status: "finished",
      message: "Execução finalizada",
      evidence: result,
    });

    return result;

  } catch (err) {
    // 🔁 LOOP — erro inesperado / exceção
    await reportToDirector({
      execution_id: payload.execution_id,
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
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("Falha ao reportar ao Diretor:", err);
  }
}

// =======================================================
// CANONICAL DIRECTOR → BROWSER EXECUTOR BRIDGE
// =======================================================
window.__NV_DIRECTOR_CHAT_EXECUTE__ = async function (prompt) {
  if (typeof window.callBrowserExecutor !== "function") {
    throw new Error("Browser executor not initialized");
  }
  return window.callBrowserExecutor(prompt);
};
