/**
 * Browser Executor Client
 * Frontend-only (NV-CONTROL)
 */

console.log("BROWSER EXECUTOR CARREGADO");

window.callBrowserExecutor = async function (payload) {
  const EXECUTOR_URL = window.EXECUTOR_URL;

  if (!EXECUTOR_URL) {
    throw new Error("EXECUTOR_URL not defined on window");
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
};
