const BASE_URL = process.env.BROWSER_EXECUTOR_BASE_URL || "https://browser.nv-imoveis.com";

export async function browserHealth() {
  const res = await fetch(`${BASE_URL}/health`);
  if (!res.ok) {
    throw new Error(`Browser health failed: ${res.status}`);
  }
  return res.json();
}

export async function browserRun(payload: any) {
  const res = await fetch(`${BASE_URL}/run`, {
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
