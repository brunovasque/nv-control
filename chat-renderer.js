/* ============================================================
   CHAT RENDERER — ENAVIA PANEL
   Responsável APENAS por:
   - Renderizar mensagens
   - Escrita progressiva (estilo GPT)
   - Scroll automático
   - Limpar input
   - Reagir a eventos externos (Browser Executor)
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

  // 🟢 Listener canônico — aprovação de plano vem do bridge
  document.addEventListener("browser:plan-approved", handlePlanApproved);
}

/* ============================================================
   ADICIONAR MENSAGEM AO CHAT
============================================================ */
export function addChatMessage({
  role = "director", // director | enavia | human
  text = "",
  typing = false,
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
   EVENTO — PLANO APROVADO (REAGE, NÃO DECIDE)
============================================================ */
function handlePlanApproved(e) {
  const plan = e.detail;

  if (!plan) {
    console.warn("[chat-renderer] Plano aprovado sem payload.");
    return;
  }

  renderBrowserExecutorButton(plan);
}

/* ============================================================
   BOTÃO — BROWSER EXECUTOR
============================================================ */
function renderBrowserExecutorButton(plan) {
  // Evita duplicação
  if (document.querySelector(".browser-executor-btn")) return;

  const container = document.createElement("div");
  container.className = "chat-message role-system";

  const textEl = document.createElement("div");
  textEl.className = "chat-text";
  textEl.textContent = "Plano aprovado. Execução manual disponível:";

  const btn = document.createElement("button");
  btn.className = "browser-executor-btn";
  btn.textContent = "▶️ Browser Executor";

  btn.addEventListener("click", async () => {
    if (typeof window.callBrowserExecutor !== "function") {
      alert("Browser Executor não disponível.");
      return;
    }

    try {
      btn.disabled = true;
      btn.textContent = "Executando...";

      await window.callBrowserExecutor(plan);

      btn.textContent = "Executado ✔";
    } catch (err) {
      console.error("[Browser Executor]", err);
      btn.textContent = "Erro ❌";
      btn.disabled = false;
    }
  });

  container.appendChild(textEl);
  container.appendChild(btn);
  chatMessagesEl.appendChild(container);

  scrollToBottom();
}

/* ============================================================
   LIMPAR INPUT
============================================================ */
export function clearChatInput() {
  chatInputEl.value = "";
  chatInputEl.style.height = "auto";
}

/* ============================================================
   HANDLERS
============================================================ */
function handleInputKeydown(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();

    const value = chatInputEl.value.trim();
    if (!value) return;

    addChatMessage({
      role: "human",
      text: value,
      typing: false,
    });

    clearChatInput();
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
   ESCRITA PROGRESSIVA
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
   AUTO-RESIZE INPUT
============================================================ */
function autoResizeInput(textarea) {
  textarea.addEventListener("input", () => {
    textarea.style.height = "auto";
    textarea.style.height =
      Math.min(textarea.scrollHeight, 140) + "px";
  });
}
