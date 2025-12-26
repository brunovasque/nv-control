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
  return {
    debug: true,
    usingRunUrl: process.env.BROWSER_EXECUTOR_URL || null,
    baseUrl: process.env.BROWSER_EXECUTOR_BASE_URL || null,
  };
}

