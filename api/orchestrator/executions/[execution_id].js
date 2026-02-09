export default async function handler(req, res) {
  const base = process.env.ORCH_WORKER_BASE;
  if (!base) {
    return res.status(500).json({ ok: false, error: "ORCH_WORKER_BASE_NOT_SET" });
  }

  if ((req.method || "GET") !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  const executionId = String(req.query?.execution_id || "").trim();
  if (!executionId) {
    return res.status(400).json({ ok: false, error: "MISSING_EXECUTION_ID" });
  }

  const url = `${base}/orchestrator/executions/${encodeURIComponent(executionId)}`;
  const r = await fetch(url, { method: "GET" });

  const text = await r.text();
  res.status(r.status);

  try {
    return res.json(JSON.parse(text || "{}"));
  } catch {
    return res.send(text);
  }
}
