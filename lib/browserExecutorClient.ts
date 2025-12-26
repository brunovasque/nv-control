const BASE_URL =
  process.env.BROWSER_EXECUTOR_BASE_URL || "https://browser.nv-imoveis.com";

const RUN_URL =
  process.env.BROWSER_EXECUTOR_URL || null;

// ----------------------------------------------------------------------------
// HEALTH CHECK (sempre via BASE_URL)
// ----------------------------------------------------------------------------
export async function browserHealth() {
  const res = await fetch(`${BASE_URL}/health`);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Browser health failed: ${res.status} - ${text}`);
  }

  return res.json();
}

// ----------------------------------------------------------------------------
// RUN (EXECUÇÃO REAL — SEMPRE VIA URL DIRETA)
// ----------------------------------------------------------------------------
export async function browserRun(payload: any) {
  if (!RUN_URL) {
    throw new Error(
      "BROWSER_EXECUTOR_URL não configurada no ambiente. Execução bloqueada."
    );
  }

  const res = await fetch(RUN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Browser run failed: ${res.status} - ${text}`);
  }

  return res.json();
}
