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
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error("Falha ao reportar ao Diretor:", err);
  }
}
