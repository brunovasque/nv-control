/* ============================================================
   DIRECTOR PLAN BUILDER — NV-CONTROL (SIMPLES / CANÔNICO)
   - NÃO executa nada
   - Apenas valida autorização ("executar") e monta um plan mínimo
============================================================ */

export function hasExplicitAuthorization(text) {
  if (typeof text !== "string") return false;

  // gatilhos simples e explícitos (sem improviso)
  // mantém o contrato: humano autoriza no chat
  const normalized = text.toLowerCase();

  return (
    /\bexecutar\b/.test(normalized) ||
    /\bpode executar\b/.test(normalized) ||
    /\bexecute\b/.test(normalized) ||
    /\bprossiga\b/.test(normalized) ||
    /\bprosseguir\b/.test(normalized)
  );
}

export function buildPlanFromDirectorChat(rawText, opts = {}) {
  const text = typeof rawText === "string" ? rawText.trim() : "";

  if (!text) {
    return {
      ok: false,
      reason: "empty_message",
      error: "Mensagem vazia. Não é possível montar um plano.",
    };
  }

  if (!hasExplicitAuthorization(text)) {
    return {
      ok: false,
      reason: "missing_authorization",
      error:
        'Falta autorização explícita no chat. Use a palavra "executar" para liberar.',
    };
  }

  // ============================================================
  // 🔑 execution_id — gerado UMA vez por fluxo
  // ============================================================

  const execution_id =
    opts.execution_id ||
    `exec_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  // ============================================================
  // ✅ COMANDO EXPLÍCITO: "executar abrir <url>"
  // ============================================================

  const openUrlMatch = text.match(
    /\bexecutar\s+abrir\s+(https?:\/\/[^\s]+)/i
  );

  if (openUrlMatch) {
    const url = openUrlMatch[1];

    return {
      ok: true,
      plan: {
        execution_id,
        steps: [
          {
            type: "open",
            url,
          },
        ],
      },
    };
  }

  // ============================================================
  // 🔁 FALLBACK CANÔNICO (PLANO ABSTRATO)
  // ============================================================

  // remove só a palavra "executar" do objetivo (sem tentar interpretar)
  const objective = text
    .replace(/\bexecutar\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  const plan = {
    version: "plan.v1.simple",
    source: "director-chat",
    execution_id,
    objective: objective || "Executar comando autorizado pelo Diretor.",
    steps: [
      {
        id: "S1",
        type: "do",
        text: objective || "Executar comando autorizado pelo Diretor.",
      },
    ],
    stop_conditions: [
      {
        id: "STOP_ANY_ERROR",
        when: "any_error",
        action: "report_and_wait",
      },
      {
        id: "STOP_ANY_AMBIGUITY",
        when: "any_ambiguity",
        action: "report_and_wait",
      },
    ],
    report_schema: {
      channel: "director_chat",
      must_report: ["error", "ambiguity", "done"],
      statuses: ["running", "blocked_by_ambiguity", "error", "done"],
    },
  };

  return { ok: true, plan };
}
