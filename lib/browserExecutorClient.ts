const BASE_URL =
  process.env.BROWSER_EXECUTOR_BASE_URL || "https://browser.nv-imoveis.com";

const DIRECT_RUN_URL = process.env.BROWSER_EXECUTOR_URL || null;

// ----------------------------------------------------------------------------
// HEALTH CHECK
// ----------------------------------------------------------------------------
export async function browserHealth() {
  const healthUrl = DIRECT_RUN_URL
    ? `${BASE_URL}/health`
    : `${BASE_URL}/health`;

  const res = await fetch(healthUrl);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Browser health failed: ${res.status} - ${text}`);
  }

  return res.json();
}

// ----------------------------------------------------------------------------
// RUN (EXECUÇÃO REAL)
// ----------------------------------------------------------------------------
export async function browserRun(payload: any) {
  const runUrl = DIRECT_RUN_URL
    ? DIRECT_RUN_URL
    : `${BASE_URL}/run`;

  const res = await fetch(runUrl, {
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
