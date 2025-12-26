// ============================================================================
//  NV-DIRECTOR v1 — Rota oficial do Diretor-Geral do ecossistema NV-IA
//  Responsável por interpretar comandos do CEO e gerar instruções técnicas
//  para a ENAVIA, seguindo padrões de segurança e arquitetura NV-FIRST.
// ============================================================================

import { browserHealth } from "../lib/browserExecutorClient.js";

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
  // 🩺 ETAPA 1 — HEALTH CHECK DO BROWSER EXECUTOR (CANÔNICO)
  // ============================================================================
  try {
    const health = await browserHealth();
    console.log("[BROWSER_EXECUTOR_HEALTH_OK]", health);
  } catch (err) {
    console.error("[BROWSER_EXECUTOR_HEALTH_ERROR]", err);
    // NÃO bloqueia o Director ainda — apenas evidencia o problema
  }

  // ============================================================================
  // 🎯 Inferência de INTENT do Director
  // ============================================================================
  function inferIntent(message = "") {
    const m = message.toLowerCase();

    if (m.includes("deploy") && m.includes("erro")) return "deploy_incident";
    if (m.includes("acelerar") && m.includes("deploy")) return "deploy_planning";
    if (m.includes("futuro") || m.includes("visão") || m.includes("roadmap")) return "strategy_vision";
    if (m.includes("produto") || m.includes("feature")) return "product_decision";
    if (m.includes("processo") || m.includes("fluxo")) return "process_improvement";

    return "generic";
  }

  const intent = inferIntent(message);

  // ============================================================================
  // 🎛️ Mapa de estilo por INTENT
  // ============================================================================
  const intentStyleMap = {
    deploy_incident: {
      verbosity: "low",
      tone: "firme e direto",
    },
    deploy_planning: {
      verbosity: "medium",
      tone: "conversacional com alerta",
    },
    strategy_vision: {
      verbosity: "high",
      tone: "reflexivo e estratégico",
    },
    product_decision: {
      verbosity: "medium",
      tone: "objetivo e comparativo",
    },
    process_improvement: {
      verbosity: "medium",
      tone: "prático",
    },
    generic: {
      verbosity: "medium",
      tone: "equilibrado",
    }
  };

  const intentStyle = intentStyleMap[intent];

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
  // SISTEMA DO DIRETOR — CLONE GPT COM MENTALIDADE DE CTO
  // ============================================================================
  const systemPrompt = `
Você é o DIRETOR-GERAL NV-IA.

======================================================================
CÉREBRO CANÔNICO ATIVO — DIRECTOR
======================================================================

${directorBrain}

======================================================================
MODO DE ATUAÇÃO DO DIRETOR
======================================================================

Você atua como um CTO sênior conversando diretamente com o CEO.
Explique riscos, cenários e consequências reais.
Seja firme quando necessário, mas humano.

======================================================================
CONTEXTO ATUAL
======================================================================

- Intent identificado: ${intent}
- Nível de verbosidade esperado: ${intentStyle.verbosity}
- Tom de comunicação: ${intentStyle.tone}

======================================================================
REGRAS ABSOLUTAS
======================================================================

- Você NÃO executa código.
- Você NÃO faz deploy.
- Segurança e estabilidade prevalecem sempre.
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
