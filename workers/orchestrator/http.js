export function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

export function methodNotAllowed(req, res, allowed) {
  res.setHeader("Allow", allowed.join(", "));
  return sendJson(res, 405, {
    ok: false,
    error: "Método não permitido."
  });
}
