export default async function handler(req, res) {
  const base = process.env.ORCH_WORKER_BASE;
  if (!base) {
    return res.status(500).json({ ok: false, error: "ORCH_WORKER_BASE_NOT_SET" });
  }

  if ((req.method || "GET") !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  let body = {};
  if (typeof req.body === "string") {
    try {
      body = req.body ? JSON.parse(req.body) : {};
    } catch {
      return res.status(400).json({ ok: false, error: "INVALID_JSON_BODY" });
    }
  } else {
    body = req.body || {};
  }

  const url = `${base}/orchestrator/run`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await r.text();
  res.status(r.status);

  try {
    return res.json(JSON.parse(text || "{}"));
  } catch {
    return res.send(text);
  }
}
