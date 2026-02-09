export function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

// ✅ Compat: Next/Vercel (res.status().json()) e Cloudflare (Response)
// Cloudflare padrão esperado neste projeto: sendJson(status, payload)
export function sendJson(resOrStatus, statusOrPayload, payloadMaybe) {
  // Next/Vercel: sendJson(res, status, payload)
  if (
    resOrStatus &&
    typeof resOrStatus.status === "function" &&
    typeof resOrStatus.json === "function"
  ) {
    const res = resOrStatus;
    const status = typeof statusOrPayload === "number" ? statusOrPayload : 200;
    const payload = typeof statusOrPayload === "number" ? payloadMaybe ?? {} : statusOrPayload ?? {};
    return res.status(status).json(payload);
  }

  // Cloudflare: sendJson(status, payload)
  if (typeof resOrStatus === "number") {
    return json(statusOrPayload ?? {}, resOrStatus);
  }

  // Fallback compatível: sendJson(payload)
  return json(resOrStatus ?? {}, 200);
}

// ✅ Compat:
// - Cloudflare: methodNotAllowed(["POST"])
// - Next/Vercel: methodNotAllowed(req, res, ["POST"])
export function methodNotAllowed(a, b, c) {
  // Next/Vercel signature
  if (
    b &&
    typeof b.status === "function" &&
    typeof b.json === "function" &&
    Array.isArray(c)
  ) {
    const req = a || {};
    const res = b;
    const allow = c;
    return sendJson(res, 405, {
      ok: false,
      error: "METHOD_NOT_ALLOWED",
      allow,
      method_seen: req.method || "UNKNOWN",
    });
  }

  // Cloudflare signature
  const allowed = Array.isArray(a) ? a : [];
  return new Response(
    JSON.stringify({ ok: false, error: "Método não permitido." }),
    {
      status: 405,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Allow: allowed.join(", "),
      },
    }
  );
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
