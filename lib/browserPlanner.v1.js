/**
 * BrowserPlanner v1
 * Responsabilidade:
 * - Receber uma INTENÇÃO interpretada pelo Director
 * - Gerar um PLANO EXECUTÁVEL para o Browser Executor
 *
 * NÃO executa.
 * NÃO diagnostica sozinho.
 * NÃO fala humano.
 */

export function buildBrowserPlanFromIntent(intent) {
  /**
   * intent esperado (vem do Director):
   * {
   *   goal: string,        // objetivo claro (ex: "Diagnosticar erro de telefone na Meta")
   *   context?: string,    // contexto adicional
   *   strategy?: "diagnostico" | "acao",
   * }
   */

  const { goal = "", context = "", strategy = "acao" } = intent;

  const text = `${goal} ${context}`.toLowerCase();
  const steps = [];

  /* ===============================
     ESTRATÉGIA: DIAGNÓSTICO
     (somente ações seguras)
  =============================== */
  if (strategy === "diagnostico") {
    if (text.includes("meta") || text.includes("facebook")) {
      steps.push(
        { type: "open", url: "https://business.facebook.com" },
        { type: "wait", ms: 5000 }
      );
    }

    // Fallback seguro de diagnóstico: abrir e aguardar
    if (steps.length === 0) {
      steps.push(
        { type: "open", url: "about:blank" },
        { type: "wait", ms: 3000 }
      );
    }

    return finalizePlan(steps, intent);
  }

  /* ===============================
     ESTRATÉGIA: AÇÃO DIRETA
  =============================== */

  // Google search
  if (text.includes("google")) {
    steps.push({ type: "open", url: "https://www.google.com" });

    const query = extractSearchQuery(text);
    if (query) {
      steps.push(
        { type: "wait", ms: 2000 },
        { type: "type", selector: "input[name='q']", text: query },
        { type: "press", key: "Enter" },
        { type: "wait", ms: 3000 }
      );
    } else {
      // Se não houver query, apenas aguarda
      steps.push({ type: "wait", ms: 3000 });
    }

    return finalizePlan(steps, intent);
  }

  // URL explícita
  const url = extractUrl(text);
  if (url) {
    steps.push(
      { type: "open", url },
      { type: "wait", ms: 3000 }
    );
    return finalizePlan(steps, intent);
  }

  /* ===============================
     FALLBACK CONTROLADO (SEGURO)
  =============================== */
  steps.push(
    { type: "open", url: "about:blank" },
    { type: "wait", ms: 3000 }
  );

  return finalizePlan(steps, intent);
}

/* ===============================
   HELPERS
================================ */

function extractSearchQuery(text) {
  const match =
    text.match(/pesquisar por ([^,]+)/) ||
    text.match(/buscar ([^,]+)/) ||
    text.match(/search for ([^,]+)/);

  return match ? match[1].trim() : null;
}

function extractUrl(text) {
  const match = text.match(/https?:\/\/[^\s]+/);
  return match ? match[0] : null;
}

function finalizePlan(steps, intent) {
  return {
    ok: true,
    plan: {
      steps,
      meta: {
        generatedAt: Date.now(),
        goal: intent.goal || null,
        strategy: intent.strategy || "acao",
      },
    },
  };
}
