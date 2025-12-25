export async function POST(request) {
  try {
    const body = await request.json();

    const EXECUTOR_URL = process.env.BROWSER_EXECUTOR_URL;
    if (!EXECUTOR_URL) {
      return new Response(
        JSON.stringify({ ok: false, error: "EXECUTOR_URL not set" }),
        { status: 500 }
      );
    }

    const r = await fetch(`${EXECUTOR_URL}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await r.json();

    return new Response(JSON.stringify(data), { status: 200 });
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }),
      { status: 500 }
    );
  }
}
