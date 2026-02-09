// workers/orchestrator/http.js

export function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

/**
 * sendJson:
 * - Next/Vercel: sendJson(res, status, payload)
 * - Worker: fallback => retorna Response via json()
 */
export function sendJson(resOrPayload, statusOrUndefined = 200, payloadOrUndefined = null) {
  // Next/Vercel (res.status().json())
  if (resOrPayload && typeof resOrPayload.status === "function") {
    const res = resOrPayload;
    const status = statusOrUndefined;
    const payload = payloadOrUndefined;
    return res.status(status).json(payload);
  }

  // Worker fallback: sendJson(payload, status)
  const payload = resOrPayload;
  const status = statusOrUndefined;
  return json(payload, status);
}

/**
 * methodNotAllowed:
 * - Worker: methodNotAllowed(["POST","GET"])
 * - Next/Vercel: methodNotAllowed(req, res, ["POST"])
 */
export function methodNotAllowed(a, b, c) {
  // Worker mode: methodNotAllowed(allowedArray)
  if (Array.isArray(a) && b === undefined && c === undefined) {
    const allowed = a;
    return new Response(JSON.stringify({ ok: false, error: "Método não permitido." }), {
      status: 405,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Allow: allowed.join(", "),
      },
    });
  }

  // Next/Vercel mode: methodNotAllowed(req, res, allowedArray)
  const req = a;
  const res = b;
  const allowed = Array.isArray(c) ? c : [];

  if (res && typeof res.setHeader === "function") {
    res.setHeader("Allow", allowed.join(", "));
  }

  return sendJson(res, 405, {
    ok: false,
    error: "METHOD_NOT_ALLOWED",
    allow: allowed,
    method_seen: req?.method || "UNKNOWN",
  });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
