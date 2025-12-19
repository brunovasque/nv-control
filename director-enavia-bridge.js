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

/* ============================================================
   DEPENDÊNCIAS
============================================================ */
import { api } from "./api-client.js";

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
 * @param {string} directorText - Texto já aprovado pelo humano.
 * @param {object} context - Contexto opcional (status, execução, etc.)
 * @returns {Promise<string>} resposta técnica da ENAVIA (texto)
 */
export async function askEnaviaFromDirector(directorText, context = {}) {
  if (!directorText || typeof directorText !== "string") {
    throw new Error("[director-enavia-bridge] Texto inválido do Director.");
  }

  // 1️⃣ Registra mensagem do Director
  logCognitiveMessage("director", directorText);

  // 2️⃣ Monta payload READ-ONLY
  const payload = {
    source: "NV-CONTROL",
    mode: "cognitive-readonly",
    role: "director",
    text: directorText,
    context,
  };

  // 3️⃣ Chamada à ENAVIA (AUDIT / modo cognitivo)
  const response = await api.audit(payload);

  const enaviaText =
    response?.message ||
    response?.analysis ||
    "A ENAVIA retornou uma resposta sem conteúdo textual.";

  // 4️⃣ Registra resposta da ENAVIA
  logCognitiveMessage("enavia", enaviaText);

  // 5️⃣ Retorna SOMENTE o texto técnico (Director traduz depois)
  return enaviaText;
}

/**
 * Retorna o histórico completo da conversa cognitiva.
 * Usado apenas para visualização (somente leitura).
 */
export function getCognitiveLog() {
  return [...cognitiveLog];
}

/**
 * Limpa o histórico cognitivo (opcional, controlado pela UI).
 */
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
