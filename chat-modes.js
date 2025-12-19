/* ============================================================
   CHAT MODES — ENAVIA PANEL (EXTENDIDO)
   - Mantém 100% da funcionalidade existente
   - Adiciona roteamento cognitivo (FASE 2.3)
   - Nenhuma execução permitida
============================================================ */

import { askEnaviaFromDirector } from "./director-enavia-bridge.js";

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
   API PÚBLICA — EXISTENTE (MANTIDA)
============================================================ */

export function initChatModes() {
  setChatMode(CHAT_MODES.DIRECTOR);
}

export function getChatMode() {
  return currentMode;
}

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

export function getAvailableChatModes() {
  return [
    CHAT_MODES.DIRECTOR,
    CHAT_MODES.EXECUTION,
  ];
}

/* ============================================================
   🔥 NOVO — ROTEAMENTO COGNITIVO DO CHAT (FASE 2.3)
============================================================ */

/**
 * Roteia mensagem humana conforme o modo ativo.
 * NÃO executa ações.
 * NÃO chama deploy.
 */
export async function routeChatMessage(text, context = {}) {
  switch (currentMode) {
    case CHAT_MODES.DIRECTOR:
      return handleDirector(text, context);

    case CHAT_MODES.ENAVIA:
      return handleEnavia(text, context);

    case CHAT_MODES.EXECUTION:
      return {
        role: "system",
        text: "Modo execução é somente leitura.",
      };

    default:
      return {
        role: "system",
        text: "Modo desconhecido. Retornando ao Director.",
      };
  }
}

/* ============================================================
   HANDLERS INTERNOS (READ-ONLY)
============================================================ */

async function handleDirector(text, context) {
  const response = await api.directorQuery({
    text,
    context,
  });

  return {
    role: "director",
    text:
      response?.message ||
      "Não consegui formular uma resposta no modo Director.",
  };
}

async function handleEnavia(text, context) {
  // Director consulta ENAVIA via bridge cognitivo
  const enaviaText = await askEnaviaFromDirector(text, context);

  return {
    role: "enavia",
    text: enaviaText,
  };
}

/* ============================================================
   EVENTOS — EXISTENTE (MANTIDO)
============================================================ */

function notifyModeChange(mode) {
  const event = new CustomEvent("chat:mode-changed", {
    detail: { mode },
  });
  document.dispatchEvent(event);
}

/* ============================================================
   UTILITÁRIOS — EXISTENTE (MANTIDO)
============================================================ */

export function isDirectorMode() {
  return currentMode === CHAT_MODES.DIRECTOR;
}

export function isEnaviaMode() {
  return currentMode === CHAT_MODES.ENAVIA;
}

export function isExecutionMode() {
  return currentMode === CHAT_MODES.EXECUTION;
}

/* ============================================================
   EXPORT CANÔNICO
============================================================ */
export { CHAT_MODES };
