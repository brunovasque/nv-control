/* ============================================================
   DIRECTOR PLAN BUILDER — NV-CONTROL (CANÔNICO)
   - NÃO executa nada
   - Apenas valida autorização explícita
   - Monta plano COMPATÍVEL com o Browser Executor
============================================================ */

export function hasExplicitAuthorization(text) {
  if (typeof text !== "string") return false;

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

  // ============================================================
  // COMANDO EXPLÍCITO: "executar abrir <url>"
  // ============================================================
 const openUrlMatch = text.match(
  /\babrir\s+(https?:\/\/[^\s]+)/i
);

const execId =
  opts?.execution_id ||
  `exec_${Date.now()}_${Math.random().toString(16).slice(2)}`;

if (openUrlMatch) {
  const url = openUrlMatch[1];

  return {
    ok: true,
    plan: {
      execution_id: execId,
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
// FALLBACK CONTROLADO (SEM ENGESSAR, SEM MASCARAR ERRO)
// ============================================================
return {
  ok: false,
  error: "Não consegui extrair uma URL válida para abrir no browser.",
};

