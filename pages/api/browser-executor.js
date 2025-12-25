// pages/api/browser-executor.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed",
    });
  }

  try {
    const EXECUTOR_URL = process.env.BROWSER_EXECUTOR_URL;

    if (!EXECUTOR_URL) {
      return res.status(500).json({
        ok: false,
        error: "EXECUTOR_URL not configured",
      });
    }

    const r = await fetch(`${EXECUTOR_URL}/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body),
    });

    const data = await r.json();

    return res.status(r.status).json(data);
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: String(e),
    });
  }
}
