// ============================================================================
// DIRECTOR PLAN BUILDER — v1 (CANÔNICO)
// Responsável por:
// - Converter respostas do Director em PLANO EXECUTÁVEL
// - NÃO executar
// - NÃO alterar estado
// - NÃO chamar botões
// - NÃO falar com Executor
//
// Este arquivo é PURAMENTE determinístico.
// ============================================================================

/*
  Estrutura de retorno possível:

  - null → não é execução
  - plan → execução de browser proposta
*/

/**
 * Decide se a resposta do Director deve virar um plano de execução.
 * @param {object} params
 * @param {string} params.message - mensagem original do humano
 * @param {string} params.directorOutput - resposta textual do Director
 * @param {string} params.executionId - execution_id atual do painel
 * @returns {object|null}
 */
export function buildDirectorPlan({
  message,
  directorOutput,
  executionId,
}) {
  if (!directorOutput || typeof directorOutput !== "string") {
    return null;
  }

  const text = directorOutput.toLowerCase();

  // ============================================================
  // FILTRO 1 — PALAVRAS QUE INDICAM EXECUÇÃO DE BROWSER
  // ============================================================
  const browserSignals = [
    "abrir site",
    "acessar site",
    "entrar no site",
    "verificar site",
    "checar site",
    "extrair",
    "coletar",
    "capturar",
    "pegar informação",
    "ver se existe",
    "print",
    "screenshot",
    "visualizar página",
  ];

  const isBrowserIntent = browserSignals.some((s) => text.includes(s));

  if (!isBrowserIntent) {
    return null;
  }

  // ============================================================
  // FILTRO 2 — BLOQUEIO DE COISAS QUE NÃO SÃO BROWSER
  // ============================================================
  const forbiddenSignals = [
    "deploy",
    "worker",
    "cloudflare",
    "vercel",
    "supabase",
    "meta",
    "api",
    "patch",
    "commit",
    "merge",
    "produção",
  ];

  const hasForbidden = forbiddenSignals.some((s) => text.includes(s));

  if (hasForbidden) {
    return null;
  }

  // ============================================================
  // CONSTRUÇÃO DO PLANO CANÔNICO
  // ============================================================
  const plan = {
    execution_id: executionId || `exec-${Date.now()}`,
    type: "browser",

    objective: extractObjective(directorOutput),

    steps: extractSteps(directorOutput),

    stop_conditions: [
      "Erro ao carregar página",
      "Elemento esperado não encontrado",
      "Timeout de navegação",
    ],

    report_expectation:
      "Relatar resultado encontrado ou erro ocorrido. Não continuar após concluir.",
  };

  // Segurança mínima
  if (!plan.steps.length) {
    return null;
  }

  return plan;
}

// ============================================================================
// UTILITÁRIOS INTERNOS (DETERMINÍSTICOS)
// ============================================================================

function extractObjective(text) {
  const lines = text.split("\n").map((l) => l.trim());

  const objLine =
    lines.find((l) =>
      l.toLowerCase().startsWith("objetivo")
    ) || lines[0];

  return sanitize(objLine);
}

function extractSteps(text) {
  const steps = [];

  const lines = text.split("\n");

  for (const line of lines) {
    const l = line.trim();

    if (!l) continue;

    if (
      l.startsWith("-") ||
      l.match(/^\d+\./)
    ) {
      steps.push(sanitize(l.replace(/^[-\d.]+/, "")));
    }
  }

  // fallback simples
  if (!steps.length) {
    steps.push("Executar a navegação conforme descrito e parar.");
  }

  // regra canônica: sempre parar
  if (!steps.some((s) => s.toLowerCase().includes("parar"))) {
    steps.push("Parar execução.");
  }

  return steps;
}

function sanitize(str) {
  return str
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .trim();
}
