/* ============================================================
   DIRECTOR ⇄ ENAVIA BRIDGE (READ-ONLY)
   Responsável APENAS por:
   - Enviar consultas cognitivas do Director à ENAVIA
   - Receber respostas técnicas (read-only)
   - Registrar histórico da conversa cognitiva
   - Devolver texto técnico ao Director

   ❌ NÃO executa deploy
   ❌ NÃO altera estado
   ❌ NÃO chama botões
============================================================ */

import { setApprovedBrowserPlan } from "./panel-state.js";

/* ============================================================
   ESTADO INTERNO (Cognitivo)
============================================================ */
const cognitiveLog = [];

/*
 Estrutura canônica do registro cognitivo:
 {
   id: string,
   role: "director" | "enavia",
   content: string,
   timestamp: number
 }
*/

/* ============================================================
   API PÚBLICA DO BRIDGE
============================================================ */

/**
 * Envia uma consulta cognitiva do Director para a ENAVIA.
 */
export async function askEnaviaFromDirector(directorText, context = {}) {
  if (!directorText || typeof directorText !== "string") {
    throw new Error("[director-enavia-bridge] Texto inválido do Director.");
  }

  // 1️⃣ Log cognitivo
  logCognitiveMessage("director", directorText);

  // 2️⃣ APROVAÇÃO EXPLÍCITA DE PLANO (CHAT CONTROLA)
  if (detectPlanApproval(directorText)) {
    const pending = window.__PENDING_BROWSER_PLAN__;

    if (pending) {
      setApprovedBrowserPlan(pending);

      document.dispatchEvent(
        new CustomEvent("browser:plan-approved", {
          detail: pending,
        })
      );

      console.log("[BRIDGE] Plano aprovado e botão liberado no chat:", pending);
    } else {
      console.warn(
        "[BRIDGE] Diretor aprovou, mas não há plano pendente para aprovar."
      );
    }
  }

  // 3️⃣ Payload READ-ONLY
  const payload = {
    source: "NV-CONTROL",
    mode: "cognitive-readonly",
    role: "director",
    text: directorText,
    context,
  };

  if (!window.api) {
    throw new Error("API ENAVIA não inicializada (window.api ausente).");
  }

  const response = await window.api.audit(payload);

  const enaviaText =
    response?.message ||
    response?.analysis ||
    "A ENAVIA retornou uma resposta sem conteúdo textual.";

  // 4️⃣ Log cognitivo da resposta
  logCognitiveMessage("enavia", enaviaText);

  return enaviaText;
}

/* ============================================================
   LOG COGNITIVO
============================================================ */

export function getCognitiveLog() {
  return [...cognitiveLog];
}

export function clearCognitiveLog() {
  cognitiveLog.length = 0;
}

/* ============================================================
   UTILITÁRIOS INTERNOS
============================================================ */

function logCognitiveMessage(role, content) {
  cognitiveLog.push({
    id: crypto.randomUUID(),
    role,
    content,
    timestamp: Date.now(),
  });
}

/**
 * Detecta aprovação explícita do Diretor
 * NÃO executa nada
 */
function detectPlanApproval(text) {
  const normalized = text.toLowerCase().trim();

  return (
    normalized === "executar" ||
    normalized === "pode executar" ||
    normalized === "aprovar" ||
    normalized === "pode prosseguir" ||
    normalized === "confirmo execução"
  );
}


