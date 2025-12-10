// ============================================================
// NV-Control Panel Script
// ============================================================

const DEFAULT_WORKER_URL = "https://nv-enavia.brunovasque.workers.dev";

// DOM ELEMENTS
const messagesEl = document.getElementById("messages");
const userInputEl = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const chatBtn = document.getElementById("chatBtn");
const engineerBtn = document.getElementById("engineerBtn");
const brainBtn = document.getElementById("brainBtn");
const statusBadgeEl = document.getElementById("status-badge");
const modeBadgeEl = document.getElementById("mode-badge");
const workerUrlInputEl = document.getElementById("workerUrlInput");
const debugToggleEl = document.getElementById("debugToggle");

// Tabs
const tabTelemetryBtn = document.getElementById("tab-telemetry");
const tabHistoryBtn = document.getElementById("tab-history");
const tabAdvancedBtn = document.getElementById("tab-advanced");

const panelTelemetryEl = document.getElementById("panel-telemetry");
const panelHistoryEl = document.getElementById("panel-history");
const panelAdvancedEl = document.getElementById("panel-advanced");

// Telemetry elements
const telemetrySummaryEl = document.getElementById("telemetry-summary");
const telemetrySummaryBadgeEl = document.getElementById(
  "telemetry-summary-badge"
);
const telemetryRequestEl = document.getElementById("telemetry-request");
const telemetryResponseEl = document.getElementById("telemetry-response");
const telemetryErrorCardEl = document.getElementById("telemetry-error-card");
const telemetryErrorEl = document.getElementById("telemetry-error");

// History
const historyListEl = document.getElementById("history-list");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");

// Advanced
const advancedRawEl = document.getElementById("advanced-raw");

// Deploy buttons
const deploySimulateBtn = document.getElementById("deploySimulateBtn");
const deployApplyUserPatchBtn = document.getElementById(
  "deployApplyUserPatchBtn"
);
const deployAcceptSuggestionBtn = document.getElementById(
  "deployAcceptSuggestionBtn"
);
const deployWorkerBtn = document.getElementById("deployWorkerBtn");
const deploySafeBtn = document.getElementById("deploySafeBtn");
const deployRollbackBtn = document.getElementById("deployRollbackBtn");
const deploySessionCloseBtn = document.getElementById("deploySessionCloseBtn");

// Global state
let currentMode = "chat"; // "chat" | "engineer" | "brain"
let history = [];

// ============================================================
// INIT
// ============================================================

function init() {
  // Worker URL fallback
  if (!workerUrlInputEl) {
    console.warn("workerUrlInput element not found; using default URL only.");
  } else if (!workerUrlInputEl.value) {
    workerUrlInputEl.value = DEFAULT_WORKER_URL;
  }

  // Mode buttons
  if (chatBtn) chatBtn.addEventListener("click", () => setMode("chat"));
  if (engineerBtn)
    engineerBtn.addEventListener("click", () => setMode("engineer"));
  if (brainBtn) brainBtn.addEventListener("click", () => setMode("brain"));

  // Send
  if (sendBtn) sendBtn.addEventListener("click", handleSend);

  // Enter / Ctrl+Enter behavior
  if (userInputEl) {
    userInputEl.addEventListener("keydown", (e) => {
      // Ctrl+Enter ou Shift+Enter → quebra linha
      if (e.key === "Enter" && (e.ctrlKey || e.shiftKey)) {
        return; // deixa inserir normalmente a quebra de linha
      }

      // Enter "seco" → enviar
      if (e.key === "Enter") {
        e.preventDefault();
        handleSend();
      }
    });
  }

  // Tabs
  if (tabTelemetryBtn)
    tabTelemetryBtn.addEventListener("click", () =>
      setActiveTab("telemetry")
    );
  if (tabHistoryBtn)
    tabHistoryBtn.addEventListener("click", () => setActiveTab("history"));
  if (tabAdvancedBtn)
    tabAdvancedBtn.addEventListener("click", () => setActiveTab("advanced"));

  // Copy buttons
  const copyButtons = document.querySelectorAll(".copy-btn");
  copyButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-copy-target");
      if (!targetId) return;
      const targetEl = document.getElementById(targetId);
      if (!targetEl) return;
      copyToClipboard(targetEl.innerText || targetEl.textContent || "");
    });
  });

  // Clear history
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener("click", () => {
      history = [];
      if (historyListEl) historyListEl.innerHTML = "";
    });
  }

  // ============================================================
  // DEPLOY BUTTONS – HANDLERS (TODOS OS 7)
  // ============================================================

  if (deploySimulateBtn)
  deploySimulateBtn.addEventListener("click", () =>
    handleDeployAction("deploy_simulate", {
      message: "simular deploy",
    })
  );

if (deployApplyUserPatchBtn)
  deployApplyUserPatchBtn.addEventListener("click", handleApplyUserPatch);

if (deployAcceptSuggestionBtn)
  deployAcceptSuggestionBtn.addEventListener("click", () =>
    handleDeployAction("deploy_accept_suggestion", {
      extra: { use_last_suggestion: true, userApproval: true },
      message: "aprovar deploy",
    })
  );

if (deployWorkerBtn)
  deployWorkerBtn.addEventListener("click", () =>
    handleDeployAction("deploy_worker", {
      message: "publicar worker",
    })
  );

if (deploySafeBtn)
  deploySafeBtn.addEventListener("click", () =>
    handleDeployAction("deploy_safe", {
      message: "aprovar deploy",
    })
  );

if (deployRollbackBtn)
  deployRollbackBtn.addEventListener("click", () =>
    handleDeployAction("deploy_rollback", {
      message: "rollback para versão anterior",
    })
  );

if (deploySessionCloseBtn)
  deploySessionCloseBtn.addEventListener("click", () =>
    handleDeployAction("deploy_session_close", {
      message: "encerrar sessão de deploy",
    })
  );

  // Finalize init
  setMode("chat", { silent: true });
  setStatus("neutral", "Pronto");
  appendSystemMessage(
    "NV-Control inicializado. Conectando à ENAVIA via rota / (supervised)."
  );
}

document.addEventListener("DOMContentLoaded", init);

// ============================================================
// MODE & STATUS
// ============================================================

function setMode(mode, options = {}) {
  currentMode = mode;

  // Update badge
  if (modeBadgeEl) {
    modeBadgeEl.textContent = mode.toUpperCase();
    modeBadgeEl.classList.remove(
      "badge-mode-chat",
      "badge-mode-engineer",
      "badge-mode-brain"
    );
    if (mode === "chat") modeBadgeEl.classList.add("badge-mode-chat");
    if (mode === "engineer") modeBadgeEl.classList.add("badge-mode-engineer");
    if (mode === "brain") modeBadgeEl.classList.add("badge-mode-brain");
  }

  // Mode buttons visual
  const modes = [
    { btn: chatBtn, id: "chat" },
    { btn: engineerBtn, id: "engineer" },
    { btn: brainBtn, id: "brain" },
  ];
  modes.forEach(({ btn, id }) => {
    if (!btn) return;
    if (id === mode) btn.classList.add("active");
    else btn.classList.remove("active");
  });

  if (!options.silent) {
    appendSystemMessage(
      `Modo alterado para ${mode.toUpperCase()} (${modeDescription(mode)}).`
    );
  }
}

function modeDescription(mode) {
  if (mode === "chat") return "conversa normal";
  if (mode === "engineer")
    return "plano técnico, patch e fluxo supervisionado de deploy";
  if (mode === "brain") return "treinamento (conteúdo será aprendido)";
  return "";
}

function setStatus(type, text) {
  if (!statusBadgeEl) return;
  statusBadgeEl.textContent = text || "";

  statusBadgeEl.classList.remove(
    "badge-neutral",
    "badge-ok",
    "badge-error",
    "badge-pending"
  );

  if (type === "ok") statusBadgeEl.classList.add("badge-ok");
  else if (type === "error") statusBadgeEl.classList.add("badge-error");
  else if (type === "pending") statusBadgeEl.classList.add("badge-pending");
  else statusBadgeEl.classList.add("badge-neutral");
}

// ============================================================
// TABS
// ============================================================

function setActiveTab(tabId) {
  const tabs = [
    { btn: tabTelemetryBtn, panel: panelTelemetryEl, id: "telemetry" },
    { btn: tabHistoryBtn, panel: panelHistoryEl, id: "history" },
    { btn: tabAdvancedBtn, panel: panelAdvancedEl, id: "advanced" },
  ];

  tabs.forEach(({ btn, panel, id }) => {
    if (btn) btn.classList.toggle("active", id === tabId);
    if (panel) panel.classList.toggle("active", id === tabId);
  });
}

// ============================================================
// CHAT UI
// ============================================================

function appendMessage(role, mode, text) {
  if (!messagesEl) return;
  const wrapper = document.createElement("div");
  wrapper.classList.add("message", role);
  if (role === "user" && mode) {
    wrapper.classList.add(`mode-${mode}`);
  }

  const avatar = document.createElement("div");
  avatar.classList.add("avatar");

  const bubble = document.createElement("div");
  bubble.classList.add("bubble");

  const meta = document.createElement("div");
  meta.classList.add("meta");

  const content = document.createElement("div");
  content.classList.add("content");

  const when = new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (role === "user") {
    avatar.textContent = "VC";
    meta.textContent = `Você (${mode.toUpperCase()}) • ${when}`;
  } else if (role === "assistant") {
    avatar.textContent = "NV";
    meta.textContent = `ENAVIA • ${when}`;
  } else {
    avatar.textContent = "⚙";
    meta.textContent = `Sistema • ${when}`;
  }

  content.textContent = text;

  bubble.appendChild(meta);
  bubble.appendChild(content);

  // === BOTÃO DE COPIAR ===
  const copyBtn = document.createElement("button");
  copyBtn.classList.add("copy-btn");
  copyBtn.textContent = "Copiar";
  copyBtn.onclick = () => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        copyBtn.textContent = "Copiado!";
        setTimeout(() => (copyBtn.textContent = "Copiar"), 1500);
      })
      .catch((err) => console.error("Erro ao copiar:", err));
  };
  bubble.appendChild(copyBtn);

  wrapper.appendChild(avatar);
  wrapper.appendChild(bubble);

  messagesEl.appendChild(wrapper);
  scrollMessagesToBottom();
}

function appendUserMessage(text, mode) {
  appendMessage("user", mode, text);
}

function appendAssistantMessage(text) {
  appendMessage("assistant", currentMode, text);
}

function appendSystemMessage(text) {
  appendMessage("system", null, text);
}

function scrollMessagesToBottom() {
  if (!messagesEl) return;
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ============================================================
// SEND FLOW
// ============================================================

function getWorkerUrl() {
  const raw = workerUrlInputEl ? workerUrlInputEl.value.trim() : "";
  if (!raw) return DEFAULT_WORKER_URL;
  return raw;
}

function buildPayload(mode, content) {
  const base = {
    source: "NV-CONTROL",
    env_mode: "supervised",
    mode,
    debug: !!(debugToggleEl && debugToggleEl.checked),
    timestamp: new Date().toISOString(),
  };

  if (mode === "engineer") {
    let parsed = null;
    try {
      parsed = JSON.parse(content);
    } catch (_) {}

    // Se houver executor_action → enviar direto para o executor
    if (parsed && typeof parsed === "object" && parsed.executor_action) {
      return {
        ...base,
        executor_action: parsed.executor_action,
        patch: parsed.patch || null,
        message: `[ENGINEER/DEPLOY] ${parsed.executor_action}`,
        askSuggestions: true,
        riskReport: true,
        preventForbidden: true,
      };
    }

    // Caso contrário → ENGINEER normal
    return {
      ...base,
      intent: content,
      message: `[ENGINEER] ${content}`,
      askSuggestions: true,
      riskReport: true,
      preventForbidden: true,
    };
  }

  if (mode === "brain") {
    return {
      ...base,
      content,
      message: `[BRAIN] ${truncate(content, 200)}`,
    };
  }

  return {
    ...base,
    message: content,
  };
}

async function handleSend() {
  if (!userInputEl) return;
  const raw = userInputEl.value.trim();
  if (!raw) return;

  appendUserMessage(raw, currentMode);
  userInputEl.value = "";

  const payload = buildPayload(currentMode, raw);
  await sendToWorker(payload);
}

// ============================================================
// DEPLOY HELPERS
// ============================================================

function buildDeployPayload(executorAction, options = {}) {
  const base = {
    source: "NV-CONTROL",
    env_mode: "supervised",
    mode: "engineer",
    debug: !!(debugToggleEl && debugToggleEl.checked),
    timestamp: new Date().toISOString(),

    // 🔥 IMPORTANTE: enviar o executor_action correto
    executor_action: executorAction,

    askSuggestions: true,
    riskReport: true,
    preventForbidden: true,
  };

  // Se veio patch no options → aplica
  if (options.patch !== undefined) {
    base.patch = options.patch; // ← aqui agora receberá string, não objeto
  }

  return base;
}

async function handleDeployAction(executorAction, options = {}) {
  const payload = buildDeployPayload(executorAction, options);
  appendSystemMessage(`Disparando ${executorAction} via NV-Control.`);
  await sendToWorker(payload);
}

async function handleApplyUserPatch() {
  if (!userInputEl) {
    appendSystemMessage(
      "Não foi possível ler o campo de entrada para aplicar patch."
    );
    return;
  }

  const raw = userInputEl.value.trim();
  if (!raw) {
    appendSystemMessage("Nenhum patch encontrado. Escreva o PATCH no campo de mensagem.");
    return;
  }

  // 🧠 Agora tentamos interpretar o conteúdo como JSON.
  // Se for JSON válido → vira objeto real.
  // Se não for → mantemos como string (fallback seguro).
  let patchPayload = raw;
  try {
    patchPayload = JSON.parse(raw);
  } catch (_) {
    console.warn("PATCH enviado como string — não é JSON válido (fallback mantido).");
  }

  const payload = buildDeployPayload("deploy_apply_user_patch", {
    patch: patchPayload,
    message: "[DEPLOY] Apply user patch (conteúdo do textarea corrigido)",
  });

  appendSystemMessage(
    "Enviando deploy_apply_user_patch com patch interpretado corretamente."
  );
  await sendToWorker(payload);
}

async function sendToWorker(payload) {
  const url = getWorkerUrl();

  if (!url.startsWith("http")) {
    setStatus("error", "URL do worker inválida.");
    appendSystemMessage("URL do worker inválida. Ajuste no topo do painel.");
    return;
  }

// ============================================================
// DEFINIÇÃO DA ROTA CORRETA (chat → "/", engineer → "/engineer")
// ============================================================
let endpoint;

if (payload.mode === "engineer") {
  // envia para /engineer SEMPRE no modo ENGINEER
  endpoint = url.replace(/\/$/, "") + "/engineer";
} else if (payload.mode === "brain") {
  // futuro: rota exclusiva do brain
  endpoint = url.replace(/\/$/, "") + "/brain";
} else {
  // chat normal → manda pra raiz "/"
  endpoint = url.replace(/\/$/, "") + "/";
}

  const startedAt = performance.now();
  setStatus("pending", "Enviando...");

  let responseStatus = null;
  let responseJson = null;
  let responseText = null;
  let error = null;

  try {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    responseStatus = resp.status;
    responseText = await resp.text();

    try {
      responseJson = responseText ? JSON.parse(responseText) : null;
    } catch (parseErr) {
      // keep as text only
      responseJson = null;
    }
  } catch (err) {
    error = err;
  }

  const latencyMs = Math.round(performance.now() - startedAt);

  const telemetry = {
    timestamp: new Date().toISOString(),
    latencyMs,
    status: responseStatus,
    mode: payload.mode,
    url: endpoint,
    ok: !error && responseStatus >= 200 && responseStatus < 300,
  };

  // Build a compact envelope for advanced log
  const advancedEnvelope = {
    request: payload,
    responseStatus,
    responseJson,
    responseText,
    error: error ? String(error) : null,
    telemetry,
  };

  // Render telemetry + history + advanced
  renderTelemetry(telemetry, payload, responseJson, error, responseText);
  addToHistory(telemetry, payload);
  renderAdvanced(advancedEnvelope);

  // Chat console output
  if (error) {
    setStatus("error", "Erro na requisição.");
    appendSystemMessage(`Erro ao falar com o worker: ${String(error)}`);
    return;
  }

  if (telemetry.ok) {
    setStatus("ok", `OK • ${latencyMs} ms • ${responseStatus}`);
  } else {
    setStatus("error", `HTTP ${responseStatus || "-"} • ver Telemetria`);
  }

  const assistantText = extractAssistantMessage(responseJson, responseText);
  appendAssistantMessage(assistantText);
}

// ============================================================
// TELEMETRIA / HISTÓRICO / AVANÇADO
// ============================================================

function renderTelemetry(telemetry, payload, responseJson, error, responseText) {
  if (!telemetrySummaryEl) return;

  // Summary grid
  telemetrySummaryEl.innerHTML = "";

  const items = [
    { label: "Status", value: telemetry.status || "-" },
    { label: "OK", value: telemetry.ok ? "true" : "false" },
    { label: "Modo", value: telemetry.mode || "-" },
    { label: "URL", value: telemetry.url || "-" },
    { label: "Latência", value: `${telemetry.latencyMs} ms` },
    { label: "Hora", value: formatTime(telemetry.timestamp) },
  ];

  items.forEach((item) => {
    const labelEl = document.createElement("div");
    labelEl.classList.add("card-grid-item-label");
    labelEl.textContent = item.label;

    const valueEl = document.createElement("div");
    valueEl.classList.add("card-grid-item-value");
    valueEl.textContent = item.value;

    telemetrySummaryEl.appendChild(labelEl);
    telemetrySummaryEl.appendChild(valueEl);
  });

  if (telemetrySummaryBadgeEl) {
    telemetrySummaryBadgeEl.textContent = telemetry.ok ? "SUCESSO" : "FALHA";
  }

  // Request
  if (telemetryRequestEl) {
    telemetryRequestEl.textContent = JSON.stringify(payload, null, 2);
  }

  // Response
  if (telemetryResponseEl) {
    if (responseJson) {
      telemetryResponseEl.textContent = JSON.stringify(responseJson, null, 2);
    } else if (responseText) {
      telemetryResponseEl.textContent = responseText;
    } else {
      telemetryResponseEl.textContent = "<sem conteúdo>";
    }
  }

  // Error
  if (telemetryErrorCardEl && telemetryErrorEl) {
    if (error || !telemetry.ok) {
      telemetryErrorCardEl.style.display = "flex";
      const details = {
        error: error ? String(error) : null,
        status: telemetry.status,
        raw: responseText || null,
      };
      telemetryErrorEl.textContent = JSON.stringify(details, null, 2);
    } else {
      telemetryErrorCardEl.style.display = "none";
      telemetryErrorEl.textContent = "";
    }
  }
}

function addToHistory(telemetry, payload) {
  const now = telemetry.timestamp || Date.now();

  history.unshift({
    at: now,
    mode: telemetry.mode,
    status: telemetry.status,
    ok: telemetry.ok,
    latencyMs: telemetry.latencyMs,
    message: payload.message || payload.intent || payload.content || "",
    rawPayload: payload,
  });

  // ordenação garantida por timestamp
  history.sort((a, b) => b.at - a.at);

  if (!historyListEl) return;
  historyListEl.innerHTML = "";

  history.forEach((entry) => {
    const item = document.createElement("div");
    item.classList.add("history-item");

    // timestamp formatado
    const date = new Date(entry.at);
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();

    const formattedTime = `${hh}:${mm}:${ss} • ${day}/${month}/${year}`;

    const metaRow = document.createElement("div");
    metaRow.classList.add("history-meta");

    const left = document.createElement("div");
    left.innerHTML = `
      <span class="history-mode">${(entry.mode || "-").toUpperCase()}</span>
      • HTTP ${entry.status || "-"} 
      • <span class="history-time">${formattedTime}</span>
    `;

    const right = document.createElement("div");
    right.textContent = `${entry.ok ? "OK" : "ERRO"} • ${entry.latencyMs} ms`;

    metaRow.appendChild(left);
    metaRow.appendChild(right);

    const msg = document.createElement("div");
    msg.textContent = truncate(entry.message || "", 220);

    // (❗ CORREÇÃO CIRÚRGICA — APENAS ESTA LINHA ALTERADA)
    const resendBtn = document.createElement("button");
    resendBtn.classList.add("resend-btn");
    resendBtn.textContent = "Reenviar";
    resendBtn.onclick = () => {
      try {
        userInputEl.value =
          entry.rawPayload.message || JSON.stringify(entry.rawPayload);
      } catch (_) {}
    };

    item.appendChild(metaRow);
    item.appendChild(msg);
    item.appendChild(resendBtn);

    historyListEl.appendChild(item);
  });
}

function renderAdvanced(envelope) {
  if (!advancedRawEl) return;
  const headerTime = formatTime(
    envelope &&
      envelope.telemetry &&
      (envelope.telemetry.timestamp || new Date().toISOString())
  );
  advancedRawEl.textContent =
    `// ${headerTime}\n` + JSON.stringify(envelope, null, 2);
}

// ============================================================
// HELPERS
// ============================================================

function truncate(str, max) {
  if (!str) return "";
  if (str.length <= max) return str;
  return str.slice(0, max) + "…";
}

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function extractAssistantMessage(json, textFallback) {
  if (!json && !textFallback) return "<sem conteúdo>";

  // Prioridade para formatos esperados da ENAVIA
  if (json) {
    if (typeof json.output === "string") return json.output;
    if (typeof json.message === "string") return json.message;
    if (json.result) {
      const r = json.result;
      if (typeof r.output === "string") return r.output;
      if (typeof r.message === "string") return r.message;
      if (typeof r.summary === "string") return r.summary;
      if (typeof r.plan === "string") return r.plan;
    }
    // fallback: JSON completo
    return JSON.stringify(json, null, 2);
  }

  return textFallback || "<sem conteúdo>";
}

async function copyToClipboard(text) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    setStatus("ok", "Copiado para a área de transferência.");
    setTimeout(() => setStatus("neutral", "Pronto"), 1500);
  } catch (err) {
    console.warn("Falha ao copiar:", err);
    setStatus("error", "Não foi possível copiar.");
  }
}

// ===============================
// EXPORTAR HISTÓRICO
// ===============================
const exportHistoryBtn = document.getElementById("exportHistoryBtn");

if (exportHistoryBtn) {
  exportHistoryBtn.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(history, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `nv-control-history-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    a.click();

    URL.revokeObjectURL(url);
  });
}







