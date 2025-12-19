/* ============================================================
   COGNITIVE LOG — VISUALIZAÇÃO READ-ONLY
   Responsável APENAS por:
   - Renderizar histórico cognitivo Director ⇄ ENAVIA
   - Não permitir input
   - Não executar nada
   - Não alterar estado

   ❌ NÃO chama endpoints
   ❌ NÃO interfere no chat principal
============================================================ */

import { getCognitiveLog } from "./director-enavia-bridge.js";

/* ============================================================
   API PÚBLICA
============================================================ */

/**
 * Renderiza o histórico cognitivo dentro de um container.
 * @param {HTMLElement} containerEl - Elemento onde o log será exibido
 */
export function renderCognitiveLog(containerEl) {
  if (!containerEl) {
    console.warn("[cognitive-log] Container não encontrado.");
    return;
  }

  containerEl.innerHTML = "";

  const log = getCognitiveLog();

  if (!log.length) {
    containerEl.appendChild(renderEmptyState());
    return;
  }

  log.forEach((entry) => {
    containerEl.appendChild(renderEntry(entry));
  });

  containerEl.scrollTop = containerEl.scrollHeight;
}

/* ============================================================
   RENDERIZAÇÃO
============================================================ */

function renderEntry(entry) {
  const wrapper = document.createElement("div");
  wrapper.className = `cognitive-message role-${entry.role}`;

  const roleEl = document.createElement("div");
  roleEl.className = "cognitive-role";
  roleEl.textContent = roleLabel(entry.role);

  const textEl = document.createElement("div");
  textEl.className = "cognitive-text";
  textEl.textContent = entry.content;

  const timeEl = document.createElement("div");
  timeEl.className = "cognitive-timestamp";
  timeEl.textContent = formatTime(entry.timestamp);

  wrapper.appendChild(roleEl);
  wrapper.appendChild(textEl);
  wrapper.appendChild(timeEl);

  return wrapper;
}

function renderEmptyState() {
  const el = document.createElement("div");
  el.className = "cognitive-empty";
  el.textContent =
    "Ainda não há conversa cognitiva entre o Director e a ENAVIA.";
  return el;
}

/* ============================================================
   UTILITÁRIOS
============================================================ */

function roleLabel(role) {
  switch (role) {
    case "director":
      return "Director";
    case "enavia":
      return "ENAVIA";
    default:
      return role;
  }
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString();
}
