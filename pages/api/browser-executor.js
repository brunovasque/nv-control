// api/browser-executor.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed",
    });
  }

  try {
    const body = req.body;

    const executorResponse = await fetch(
      "http://167.71.116.105:3100/run",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const data = await executorResponse.json();

    return res.status(200).json({
      ok: true,
      executor: data,
    });
  } catch (error) {
    console.error("[browser-executor] error:", error);

    return res.status(500).json({
      ok: false,
      error: "Failed to call browser executor",
      details: String(error),
    });
  }
}
