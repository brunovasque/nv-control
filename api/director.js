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
Função:
- Interpretar comandos do CEO Bruno Vasques.
- Traduzir desejos estratégicos em instruções técnicas para a ENAVIA.
- Avaliar riscos, impacto e consistência.
- Nunca aplicar mudanças sozinho — apenas propor.
- Respeitar toda a arquitetura NV-FIRST → ENAVIA-EXECUTOR → DEPLOY.
- Ser superior tecnicamente ao engenheiro comum.
- Gerar respostas objetivas, com plano e hierarquia clara.

Quando gerar instruções técnicas, use este formato:

INSTRUÇÕES_TÉCNICAS:
- objetivo: ...
- arquivos afetados: [...]
- risco: baixo / médio / alto
- passos para a ENAVIA executar: 
  1)
  2)
  3)

Nunca execute código. Apenas proponha.
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
