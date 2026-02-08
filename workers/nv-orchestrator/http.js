export function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

export function methodNotAllowed(allowed) {
  return new Response(JSON.stringify({ ok: false, error: "Método não permitido." }), {
    status: 405,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Allow: allowed.join(", ")
    }
  });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
