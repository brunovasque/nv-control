export default async function handler(req, res) {
  res.status(200).json({
    ok: true,
    probe: "rerun-step boot ok",
    method: req.method || "UNKNOWN",
    ts: new Date().toISOString(),
  });
}
