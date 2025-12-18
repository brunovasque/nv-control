/* ============================================================
   CHAT RENDERER — ENAVIA PANEL
   Responsável APENAS por:
   - Renderizar mensagens
   - Escrita progressiva (estilo GPT)
   - Scroll automático
   - Limpar input
============================================================ */

const chatMessagesEl = document.getElementById("chatMessages");
const chatInputEl = document.getElementById("chatInput");

/* ============================================================
   API PÚBLICA DO MÓDULO
============================================================ */
export function initChatRenderer() {
  if (!chatMessagesEl || !chatInputEl) {
    console.warn("[chat-renderer] Elementos do chat não encontrados.");
    return;
  }

  autoResizeInput(chatInputEl);

  chatInputEl.addEventListener("keydown", handleInputKeydown);
}

/* ============================================================
   ADICIONAR MENSAGEM AO CHAT
============================================================ */
export function addChatMessage({
  role = "director", // director | enavia | human
  text = "",
  typing = false,    // efeito GPT
}) {
  const messageEl = document.createElement("div");
  messageEl.className = `chat-message role-${role}`;

  const roleEl = document.createElement("div");
  roleEl.className = "chat-role";
  roleEl.textContent = roleLabel(role);

  const textEl = document.createElement("div");
  textEl.className = "chat-text";

  messageEl.appendChild(roleEl);
  messageEl.appendChild(textEl);
  chatMessagesEl.appendChild(messageEl);

  scrollToBottom();

  if (typing) {
    typeWriter(textEl, text);
  } else {
    textEl.textContent = text;
  }
}

/* ============================================================
   LIMPAR INPUT (APÓS ENVIO)
============================================================ */
export function clearChatInput() {
  chatInputEl.value = "";
  chatInputEl.style.height = "auto";
}

/* ============================================================
   HANDLERS
============================================================ */
function handleInputKeydown(e) {
  // ENTER envia | SHIFT+ENTER quebra linha
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();

    const value = chatInputEl.value.trim();
    if (!value) return;

    // Renderiza mensagem humana
    addChatMessage({
      role: "human",
      text: value,
      typing: false,
    });

    clearChatInput();

    // ⚠️ A partir daqui, outro módulo decide o que fazer
    // (Director / fluxo / API)
    dispatchChatEvent(value);
  }
}

/* ============================================================
   EVENTO PARA O ORQUESTRADOR
============================================================ */
function dispatchChatEvent(text) {
  const event = new CustomEvent("chat:message", {
    detail: { text },
  });
  document.dispatchEvent(event);
}

/* ============================================================
   UTILITÁRIOS VISUAIS
============================================================ */
function scrollToBottom() {
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

function roleLabel(role) {
  switch (role) {
    case "human":
      return "Você";
    case "enavia":
      return "Enavia";
    case "director":
    default:
      return "Director";
  }
}

/* ============================================================
   ESCRITA PROGRESSIVA (ESTILO GPT)
============================================================ */
function typeWriter(element, text, speed = 14) {
  let i = 0;
  element.textContent = "";

  const interval = setInterval(() => {
    element.textContent += text.charAt(i);
    i++;

    scrollToBottom();

    if (i >= text.length) {
      clearInterval(interval);
    }
  }, speed);
}

/* ============================================================
   AUTO-RESIZE DO INPUT
============================================================ */
function autoResizeInput(textarea) {
  textarea.addEventListener("input", () => {
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 140) + "px";
  });
}
