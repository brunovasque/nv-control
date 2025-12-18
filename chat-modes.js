/* ============================================================
   CHAT MODES — ENAVIA PANEL
   Responsável APENAS por:
   - Definir modo ativo do chat
   - Garantir hierarquia Humano → Director → Enavia
   - Bloquear modos proibidos
   - Expor estado atual para outros módulos
============================================================ */

/*
  Modos canônicos:
  - director   → Humano conversa com Director (DEFAULT)
  - enavia     → Director consulta Enavia (nunca humano direto)
  - execution  → Feedback de execução (somente leitura)
*/

const CHAT_MODES = {
  DIRECTOR: "director",
  ENAVIA: "enavia",
  EXECUTION: "execution",
};

let currentMode = CHAT_MODES.DIRECTOR;

/* ============================================================
   API PÚBLICA
============================================================ */

/**
 * Inicializa modos do chat
 */
export function initChatModes() {
  setChatMode(CHAT_MODES.DIRECTOR);
}

/**
 * Retorna modo atual
 */
export function getChatMode() {
  return currentMode;
}

/**
 * Define modo do chat
 * @param {string} mode
 */
export function setChatMode(mode) {
  if (!Object.values(CHAT_MODES).includes(mode)) {
    console.warn(`[chat-modes] Modo inválido: ${mode}`);
    return;
  }

  // 🔒 REGRA ABSOLUTA:
  // Humano nunca fala direto com ENAVIA
  if (mode === CHAT_MODES.ENAVIA && currentMode !== CHAT_MODES.DIRECTOR) {
    console.warn("[chat-modes] Transição para ENAVIA bloqueada.");
    return;
  }

  currentMode = mode;
  notifyModeChange(mode);
}

/**
 * Modos disponíveis (para UI)
 */
export function getAvailableChatModes() {
  return [
    CHAT_MODES.DIRECTOR,
    CHAT_MODES.EXECUTION,
  ];
}

/* ============================================================
   EVENTOS
============================================================ */

function notifyModeChange(mode) {
  const event = new CustomEvent("chat:mode-changed", {
    detail: { mode },
  });
  document.dispatchEvent(event);
}

/* ============================================================
   UTILITÁRIOS DE VERIFICAÇÃO
============================================================ */

/**
 * Verifica se o chat atual é com Director
 */
export function isDirectorMode() {
  return currentMode === CHAT_MODES.DIRECTOR;
}

/**
 * Verifica se é modo ENAVIA (uso interno)
 */
export function isEnaviaMode() {
  return currentMode === CHAT_MODES.ENAVIA;
}

/**
 * Verifica se é modo execução
 */
export function isExecutionMode() {
  return currentMode === CHAT_MODES.EXECUTION;
}

/* ============================================================
   EXPORTS CANÔNICOS
============================================================ */
export { CHAT_MODES };
