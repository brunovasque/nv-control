export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const EXECUTOR_URL = process.env.BROWSER_EXECUTOR_URL;

  if (!EXECUTOR_URL) {
    return res.status(500).json({
      ok: false,
      error: "BROWSER_EXECUTOR_URL not set",
    });
  }

  try {
    const r = await fetch(`${EXECUTOR_URL}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    const data = await r.json();
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
