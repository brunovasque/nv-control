/**
 * Browser Executor Client
 * Frontend-only (NV-CONTROL)
 * Responsável por enviar comandos direto ao executor remoto
 */

export async function callBrowserExecutor(payload) {
  const EXECUTOR_URL = window.EXECUTOR_URL || process.env.EXECUTOR_URL;

  if (!EXECUTOR_URL) {
    throw new Error("EXECUTOR_URL not set");
  }

  const r = await fetch(`${EXECUTOR_URL}/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Executor error (${r.status}): ${text}`);
  }

  return await r.json();
}
