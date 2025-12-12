// ============================================================================
//  NV-DIRECTOR v1 — Rota oficial do Diretor-Geral do ecossistema NV-IA
//  Responsável por interpretar comandos do CEO e gerar instruções técnicas
//  para a ENAVIA, seguindo padrões de segurança e arquitetura NV-FIRST.
// ============================================================================

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Use POST" });
  }

  const OPENAI_KEY = process.env.OPENAI_API_KEY_DIRECTOR;
  const MODEL = process.env.DIRECTOR_MODEL || "gpt-4.1";

  if (!OPENAI_KEY) {
    return res.status(500).json({
      ok: false,
      error: "OPENAI_API_KEY_DIRECTOR não configurada no Vercel."
    });
  }

  const { message, context } = req.body || {};

  if (!message) {
    return res.status(400).json({
      ok: false,
      error: "Campo 'message' é obrigatório."
    });
  }

  // ============================================================================
// 🧠 CÉREBRO CANÔNICO DO DIRECTOR (via ENAVIA Worker)
// ============================================================================
let directorBrain = "";

try {
  const brainRes = await fetch(
    "https://nv-enavia.brunovasque.workers.dev/brain/director-query",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: "director",
        intent: "generic",
        context
      })
    }
  );

  const brainData = await brainRes.json();

  if (!brainData.ok || !brainData.brain?.content) {
    throw new Error("DIRECTOR_BRAIN_INVALID");
  }

  directorBrain = brainData.brain.content;

} catch (err) {
  return res.status(500).json({
    ok: false,
    error: "DIRECTOR_BRAIN_LOAD_FAILED",
    detail: String(err)
  });
}

  // ============================================================================
  // SISTEMA DO DIRETOR — É LITERALMENTE O "CLONE GPT" COM MENTALIDADE DE CTO
  // ============================================================================
  const systemPrompt = `
Você é o DIRETOR-GERAL NV-IA.

======================================================================
CÉREBRO CANÔNICO ATIVO — DIRECTOR
======================================================================

${directorBrain}

======================================================================
REGRAS ABSOLUTAS
- Você NÃO executa código.
- Você NÃO faz deploy.
- Você SEMPRE gera INSTRUÇÕES_TÉCNICAS estruturadas.
- Segurança, rollback e prevenção de loops são obrigatórios.
- Em conflitos:
  • D02 (Segurança) prevalece.
  • D06 (Estabilidade) prevalece sobre evolução.
======================================================================
`.trim();

  // ============================================================================
  // CALL OPENAI
  // ============================================================================
  const completion = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
        ...(context ? [{ role: "user", content: `Contexto adicional: ${context}` }] : [])
      ],
      temperature: 0.3
    })
  });

  const data = await completion.json();

  if (!data.choices) {
    return res.status(500).json({
      ok: false,
      error: "Erro ao consultar o diretor.",
      detail: data
    });
  }

  const output = data.choices[0].message.content;

  // ============================================================================
  // RESPOSTA PADRÃO PARA O PAINEL NV-CONTROL
  // ============================================================================
  return res.status(200).json({
    ok: true,
    role: "director",
    model_used: MODEL,
    output,
    telemetry: {
      timestamp: new Date().toISOString(),
      tokens: data.usage || null,
    }
  });
}
