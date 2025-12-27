/* ============================================================
   BROWSER RUN CLIENT — NV-CONTROL
   Bridge explícito e isolado para o run-adapter (porta 3200)
   - NÃO contém lógica cognitiva
   - NÃO mantém estado
   - NÃO interfere no Emergency
============================================================ */

function normalizeBaseUrl(url) {
  if (!url) return null;
  return String(url).replace(/\/$/, "");
}

function buildUrl(base, path) {
  return `${normalizeBaseUrl(base)}${path}`;
}

/* ============================================================
   CONFIG
============================================================ */

function getRunAdapterBaseUrl() {
  // prioridade: variável global (painel)
  if (typeof window !== "undefined" && window.RUN_ADAPTER_URL) {
    return normalizeBaseUrl(window.RUN_ADAPTER_URL);
  }

  // fallback: localStorage (opcional)
  if (typeof localStorage !== "undefined") {
    const v = localStorage.getItem("nv_run_adapter_url");
    if (v) return normalizeBaseUrl(v);
  }

  throw new Error("RUN_ADAPTER_URL não configurada.");
}

/* ============================================================
   CORE CALL
============================================================ */

export async function callBrowserRunAdapter(plan) {
  if (!plan || typeof plan !== "object") {
    throw new Error("Plano inválido para execução.");
  }

  const baseUrl = getRunAdapterBaseUrl();
  const url = buildUrl(baseUrl, "/run");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(plan),
      signal: controller.signal,
    });

    const text = await res.text().catch(() => "");
    let data = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      throw new Error(
        data?.error || `RUN_ADAPTER_HTTP_${res.status}`
      );
    }

    return {
      ok: true,
      data,
    };
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error("RUN_ADAPTER_TIMEOUT");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
