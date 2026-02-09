export default async function handler(req, res) {
  try {
    const base = process.env.ORCH_WORKER_BASE;
    if (!base) {
      return res.status(500).json({ ok: false, error: "ORCH_WORKER_BASE_NOT_SET" });
    }

    const execution_id = String(req.query?.execution_id || "").trim();
    if (!execution_id) {
      return res.status(400).json({ ok: false, error: "MISSING_EXECUTION_ID" });
    }

    if ((req.method || "GET") !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
    }

    // body já vem parseado em Next na maioria dos casos; mas pra garantir:
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

    const url = `${base}/orchestrator/executions/${encodeURIComponent(execution_id)}/rerun-step`;

    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    const text = await r.text();
    res.status(r.status);

    // devolve JSON se vier JSON
    try {
      return res.json(JSON.parse(text || "{}"));
    } catch {
      return res.send(text);
    }
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "RERUN_PROXY_FAILED",
      message: e?.message || String(e),
    });
  }
}
