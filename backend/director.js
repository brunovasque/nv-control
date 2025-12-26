// ============================================================================
//  NV-DIRECTOR v1 — Director 5.2 THINKING
//  Diretor-Geral Cognitivo do ecossistema NV-IA / ENAVIA / ENOVA
//  Papel: Pensar melhor que o CEO, estruturar decisões e traduzir estratégia.
// ============================================================================

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Use POST" });
  }

  const OPENAI_KEY = process.env.OPENAI_API_KEY_DIRECTOR;
  const MODEL = process.env.DIRECTOR_MODEL || "gpt-5.2";

  if (!OPENAI_KEY) {
    return res.status(500).json({
      ok: false,
      error: "OPENAI_API_KEY_DIRECTOR não configurada no Vercel."
    });
  }

  const { message, context } = req.body || {};

  console.log("[DIRECTOR RAW MESSAGE]", message);

  if (!message) {
    return res.status(400).json({
      ok: false,
      error: "Campo 'message' é obrigatório."
    });
  }

  import { browserRun } from "../lib/browserExecutorClient.js";

// ============================================================================
// 🔗 GATILHO EXPLÍCITO — CHAT → BROWSER (APENAS open_url)
// ============================================================================
if (message.startsWith("browser: abrir ")) {
  const url = message.replace("browser: abrir ", "").trim();

  if (!/^https?:\/\//i.test(url)) {
    return res.status(400).json({
      ok: false,
      error: "URL inválida. Use http(s)://"
    });
  }

  try {
    const result = await browserRun({
      action: "open_url",
      url,
      source: "nv-control-chat",
      dryRun: false
    });

    return res.status(200).json({
      ok: true,
      role: "browser",
      output: `Browser abriu a URL: ${url}`,
      executor_result: result
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "Falha ao executar ação no browser",
      detail: String(err)
    });
  }
}

  // ============================================================================
  // 🎯 Inferência de INTENT (não executável, apenas cognitiva)
  // ============================================================================
  function inferIntent(message = "") {
    const m = message.toLowerCase();

    if (m.includes("erro") || m.includes("falha")) return "incident_analysis";
    if (m.includes("arquitetura") || m.includes("estrutura")) return "architecture_reasoning";
    if (m.includes("plano") || m.includes("estratégia")) return "strategic_planning";
    if (m.includes("decisão") || m.includes("caminho")) return "decision_support";
    if (m.includes("executor") || m.includes("browser")) return "execution_design";

    return "generic_thinking";
  }

  const intent = inferIntent(message);

  // ============================================================================
  // 🎛️ Estilo cognitivo por INTENT
  // ============================================================================
  const intentStyleMap = {
    incident_analysis: {
      verbosity: "low",
      tone: "direto, técnico e preventivo"
    },
    architecture_reasoning: {
      verbosity: "high",
      tone: "estratégico, profundo e comparativo"
    },
    strategic_planning: {
      verbosity: "high",
      tone: "visionário, estruturado e pragmático"
    },
    decision_support: {
      verbosity: "medium",
      tone: "claro, honesto e orientado a consequências"
    },
    execution_design: {
      verbosity: "medium",
      tone: "técnico, organizado e traduzível"
    },
    generic_thinking: {
      verbosity: "medium",
      tone: "equilibrado e analítico"
    }
  };

  const intentStyle = intentStyleMap[intent];

  // ============================================================================
  // 🧠 CÉREBRO CANÔNICO — DIRECTOR (ENAVIA)
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
          intent,
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
  // 🧠 SYSTEM PROMPT — DIRECTOR 5.2 THINKING
  // ============================================================================
  const systemPrompt = `
Você é o DIRECTOR-GERAL NV-IA — versão 5.2 THINKING.

Você NÃO é um executor.
Você NÃO é um assistente operacional.
Você NÃO é um chatbot genérico.

Você é a camada cognitiva mais alta do ecossistema NV.
Seu papel é pensar melhor que o CEO quando necessário.

======================================================================
CÉREBRO CANÔNICO ATIVO — DIRECTOR
======================================================================

${directorBrain}

======================================================================
MISSÃO DO DIRECTOR
======================================================================

- Refinar ideias brutas do CEO.
- Questionar premissas frágeis.
- Antecipar riscos invisíveis.
- Comparar caminhos possíveis.
- Explicar impactos reais de cada decisão.
- Traduzir estratégia em instruções compreensíveis para humanos e IAs.
- Preparar planos que o Executor possa seguir depois.

Você melhora o pensamento.
Você organiza o caos.
Você NÃO executa nada.

======================================================================
COMPORTAMENTO ESPERADO
======================================================================

- Pense antes de responder.
- Se algo estiver mal definido, diga isso claramente.
- Se o CEO estiver pulando etapas, aponte.
- Se houver risco futuro, explique o porquê.
- Sugira alternativas quando fizer sentido.
- Não seja submisso. Seja parceiro estratégico.

======================================================================
ESTILO DE RESPOSTA
======================================================================

1. Comece sempre com análise conversada (raciocínio em voz alta).
2. Mostre o quadro completo, não só o detalhe técnico.
3. Quando aplicável, organize em blocos claros:
   - Cenário
   - Opções
   - Impactos
   - Recomendação

NUNCA:
- Dê respostas genéricas.
- Dê respostas vagas.
- Execute ações.
- Proponha código direto.

======================================================================
CONTEXTO ATUAL
======================================================================

- Intent identificado: ${intent}
- Verbosidade esperada: ${intentStyle.verbosity}
- Tom: ${intentStyle.tone}

======================================================================
REGRAS ABSOLUTAS
======================================================================

- Você NÃO chama executores.
- Você NÃO dispara browser.
- Você NÃO faz deploy.
- Você NÃO altera arquitetura sozinho.

Você prepara o terreno.
A decisão final é sempre humana.

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
      error: "Erro ao consultar o Director.",
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
      intent
    }
  });
}
