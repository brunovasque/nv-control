export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const response = await fetch(process.env.BROWSER_EXECUTOR_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(req.body)
    });

    const result = await response.json();

    return res.status(200).json({
      ok: true,
      executor: result
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || "Browser executor call failed"
    });
  }
}
