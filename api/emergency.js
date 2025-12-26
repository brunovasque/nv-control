// ============================================================================
//  NV-EMERGENCY v1 — CHAT EMERGENCIAL CANÔNICO
//  Canal redundante, independente do painel NV-CONTROL
//  Função: Planejar com Director + Executar somente com autorização humana
// ============================================================================

import { browserRun, browserHealth } from "../lib/browserExecutorClient.js";

const EMERGENCY_KEY = process.env.EMERGENCY_KEY;

// Estado em memória (escopo serverless por instância)
// Seguro o suficiente para uso emergencial
let pendingPlan = null;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Use POST" });
  }

  // --------------------------------------------------------------------------
  // 🔐 AUTENTICAÇÃO EMERGENCIAL
  // --------------------------------------------------------------------------
  const emergencyKey = req.headers["x-emergency-key"];

  if (!EMERGENCY_KEY || emergencyKey !== EMERGENCY_KEY) {
    return res.status(403).json({
      ok: false,
      error: "EMERGENCY_ACCESS_DENIED"
    });
  }

  const { message } = req.body || {};

  if (!message || typeof message !== "string") {
    return res.status(400).json({
      ok: false,
      error: "Campo 'message' (string) é obrigatório."
    });
  }

  const trimmed = message.trim();

  // --------------------------------------------------------------------------
  // ✅ GATILHO FINAL — AUTORIZAÇÃO HUMANA
  // --------------------------------------------------------------------------
  if (trimmed === "SIM") {
    if (!pendingPlan) {
      return res.status(400).json({
        ok: false,
        error: "Nenhum plano pendente para executar."
      });
    }

    if (pendingPlan.status !== "awaiting_confirmation") {
      return res.status(400).json({
        ok: false,
        error: "Plano pendente em estado inválido."
      });
    }

    try {
      // Verifica saúde do executor antes de executar
      await browserHealth();

      const execResult = await browserRun({
        ...pendingPlan.plan,
        source: "nv-emergency",
        dryRun: false
      });

      pendingPlan.status = "executed";

      const executedPlan = pendingPlan;
      pendingPlan = null;

      return res.status(200).json({
        ok: true,
        executed: true,
        message: "Plano executado com sucesso.",
        result: execResult,
        plan: executedPlan.plan
      });
    } catch (err) {
      return res.status(500).json({
        ok: false,
        error: "EXECUTION_FAILED",
        detail: String(err)
      });
    }
  }

  // --------------------------------------------------------------------------
  // ❌ CANCELAMENTO HUMANO
  // --------------------------------------------------------------------------
  if (trimmed === "NÃO") {
    pendingPlan = null;

    return res.status(200).json({
      ok: true,
      cancelled: true,
      message: "Plano descartado com sucesso."
    });
  }

  // --------------------------------------------------------------------------
  // 🧠 FASE DE PLANEJAMENTO (DIRECTOR)
  // --------------------------------------------------------------------------
  // Regras:
  // - Aqui NÃO executa nada
  // - Apenas interpreta e propõe plano
  // - A execução só acontece após "SIM"

  // Planejamento simples e determinístico (extensível depois)
  let plan = null;

  // Exemplo inicial: abrir URL
  if (trimmed.toLowerCase().startsWith("abrir ")) {
    const url = trimmed.replace(/^abrir\s+/i, "").trim();

    if (!/^https?:\/\//i.test(url)) {
      return res.status(400).json({
        ok: false,
        error: "URL inválida. Use http(s)://"
      });
    }

    plan = {
      action: "open_url",
      url
    };
  }

  if (!plan) {
    return res.status(400).json({
      ok: false,
      error: "Não foi possível montar um plano a partir da mensagem."
    });
  }

  // Armazena plano pendente
  pendingPlan = {
    plan,
    created_at: Date.now(),
    status: "awaiting_confirmation"
  };

  return res.status(200).json({
    ok: true,
    planned: true,
    plan,
    message:
      "Plano gerado. Deseja executar agora? Responda exatamente com: SIM ou NÃO"
  });
}
