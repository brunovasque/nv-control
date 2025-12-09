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
const telemetrySummaryBadgeEl = document.getElementById("telemetry-summary-badge");
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
const deployApplyUserPatchBtn = document.getElementById("deployApplyUserPatchBtn");
const deployAcceptSuggestionBtn = document.getElementById("deployAcceptSuggestionBtn");
const deployWorkerBtn = document.getElementById("deployWorkerBtn");
const deploySafeBtn = document.getElementById("deploySafeBtn");
const deployRollbackBtn = document.getElementById("deployRollbackBtn");
const deploySessionCloseBtn = document.getElementById("deploySessionCloseBtn");

// Global state
let currentMode = "chat";
let history = [];

// ============================================================
// INITIALIZATION
// ============================================================

function init() {
  if (!workerUrlInputEl) {
    console.warn("workerUrlInput element not found; using default URL only.");
  } else if (!workerUrlInputEl.value) {
    workerUrlInputEl.value = DEFAULT_WORKER_URL;
  }

  // Mode buttons
  if (chatBtn) chatBtn.addEventListener("click", () => setMode("chat"));
  if (engineerBtn) engineerBtn.addEventListener("click", () => setMode("engineer"));
  if (brainBtn) brainBtn.addEventListener("click", () => setMode("brain"));

  // Send
  if (sendBtn) sendBtn.addEventListener("click", handleSend);

  // ENTER / CTRL+ENTER
  if (userInputEl) {
    userInputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.shiftKey)) return;
      if (e.key === "Enter") {
        e.preventDefault();
        handleSend();
      }
    });
  }

  // Tabs
  if (tabTelemetryBtn)
    tabTelemetryBtn.addEventListener("click", () => setActiveTab("telemetry"));
  if (tabHistoryBtn)
    tabHistoryBtn.addEventListener("click", () => setActiveTab("history"));
  if (tabAdvancedBtn)
    tabAdvancedBtn.addEventListener("click", () => setActiveTab("advanced"));

  // Copy buttons
  const copyButtons = document.querySelectorAll(".copy-btn");
  copyButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-copy-target");
      const targetEl = document.getElementById(targetId);
      if (targetEl) copyToClipboard(targetEl.innerText || targetEl.textContent || "");
    });
  });

  // Clear History
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener("click", () => {
      history = [];
      if (historyListEl) historyListEl.innerHTML = "";
    });
  }

  // ============================================================
  // DEPLOY BUTTONS – FINAL WORKING VERSION
  // ============================================================

  if (deploySimulateBtn)
    deploySimulateBtn.addEventListener("click", () =>
      handleDeployAction("deploy_simulate")
    );

  if (deployApplyUserPatchBtn)
    deployApplyUserPatchBtn.addEventListener("click", handleApplyUserPatch);

  if (deployAcceptSuggestionBtn)
    deployAcceptSuggestionBtn.addEventListener("click", () =>
      handleDeployAction("deploy_accept_suggestion", {
        extra: { use_last_suggestion: true, userApproval: true },
        message: "[DEPLOY] Aceitar sugestão da ENAVIA",
      })
    );

  if (deployWorkerBtn)
    deployWorkerBtn.addEventListener("click", () =>
      handleDeployAction("deploy_worker", {
        message: "[DEPLOY] Publicar mudanças no Worker",
      })
    );

  if (deploySafeBtn)
    deploySafeBtn.addEventListener("click", () =>
      handleDeployAction("deploy_safe", {
        message: "[DEPLOY] Safe deploy",
      })
    );

  if (deployRollbackBtn)
    deployRollbackBtn.addEventListener("click", () =>
      handleDeployAction("deploy_rollback", {
        message: "[DEPLOY] Rollback para estado estável",
      })
    );

  if (deploySessionCloseBtn)
    deploySessionCloseBtn.addEventListener("click", () =>
      handleDeployAction("deploy_session_close", {
        message: "[DEPLOY] Sessão de deploy encerrada",
      })
    );

  // Final init
  setMode("chat", { silent: true });
  setStatus("neutral", "Pronto");
  appendSystemMessage("NV-Control inicializado.");
}

document.addEventListener("DOMContentLoaded", init);

// ============================================================
// MODE / STATUS
// ============================================================

function setMode(mode, options = {}) {
  currentMode = mode;

  if (modeBadgeEl) {
    modeBadgeEl.textContent = mode.toUpperCase();
    modeBadgeEl.classList.remove("badge-mode-chat", "badge-mode-engineer", "badge-mode-brain");

    if (mode === "chat") modeBadgeEl.classList.add("badge-mode-chat");
    if (mode === "engineer") modeBadgeEl.classList.add("badge-mode-engineer");
    if (mode === "brain") modeBadgeEl.classList.add("badge-mode-brain");
  }

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
    appendSystemMessage(`Modo alterado para ${mode.toUpperCase()}.`);
  }
}

function setStatus(type, text) {
  if (!statusBadgeEl) return;

  statusBadgeEl.textContent = text || "";
  statusBadgeEl.className = "";
  statusBadgeEl.classList.add("badge");

  if (type === "ok") statusBadgeEl.classList.add("badge-ok");
  else if (type === "error") statusBadgeEl.classList.add("badge-error");
  else if (type === "pending") statusBadgeEl.classList.add("badge-pending");
  else statusBadgeEl.classList.add("badge-neutral");
}

// ============================================================
// SEND FLOW
// ============================================================

function getWorkerUrl() {
  const raw = workerUrlInputEl ? workerUrlInputEl.value.trim() : "";
  return raw || DEFAULT_WORKER_URL;
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

    if (parsed && parsed.executor_action) {
      return {
        ...base,
        executor_action: parsed.executor_action,
        patch: parsed.patch || null,
        askSuggestions: true,
        riskReport: true,
      };
    }

    return {
      ...base,
      intent: content,
      askSuggestions: true,
      riskReport: true,
    };
  }

  if (mode === "brain") {
    return {
      ...base,
      content,
      message: `[BRAIN] ${truncate(content, 200)}`,
    };
  }

  return { ...base, message: content };
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

function buildDeployPayload(action, options = {}) {
  return {
    source: "NV-CONTROL",
    env_mode: "supervised",
    mode: "engineer",
    executor_action: action,
    patch: options.patch || null,
    askSuggestions: true,
    riskReport: true,
    preventForbidden: true,
    debug: !!(debugToggleEl && debugToggleEl.checked),
    timestamp: new Date().toISOString(),
    ...(options.extra || {}),
    message: options.message || `[DEPLOY] ${action.toUpperCase()}`,
  };
}

async function handleDeployAction(action, options = {}) {
  const payload = buildDeployPayload(action, options);
  appendSystemMessage(`Disparando ${action}...`);
  await sendToWorker(payload);
}

async function handleApplyUserPatch() {
  const raw = userInputEl.value.trim();

  if (!raw) {
    appendSystemMessage("Nenhum patch encontrado no textarea.");
    return;
  }

  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    appendSystemMessage("Patch inválido. Insira JSON válido.");
    return;
  }

  const payload = buildDeployPayload("deploy_apply_user_patch", {
    patch: parsed,
    message: "[DEPLOY] Apply user patch (textarea)",
  });

  appendSystemMessage("Enviando patch do usuário...");
  await sendToWorker(payload);
}

// ============================================================
// SEND TO WORKER
// ============================================================

async function sendToWorker(payload) {
  const url = getWorkerUrl();
  const endpoint = url.endsWith("/") ? url : url + "/";
  const started = performance.now();

  setStatus("pending", "Enviando…");

  let responseStatus = null;
  let responseJson = null;
  let responseText = null;
  let error = null;

  try {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    responseStatus = resp.status;
    responseText = await resp.text();
    try {
      responseJson = JSON.parse(responseText);
    } catch {
      responseJson = null;
    }
  } catch (err) {
    error = err;
  }

  const latencyMs = Math.round(performance.now() - started);
  const telemetry = {
    timestamp: new Date().toISOString(),
    latencyMs,
    status: responseStatus,
    ok: !error && responseStatus >= 200 && responseStatus < 300,
    mode: payload.mode,
    url: endpoint,
  };

  renderTelemetry(telemetry, payload, responseJson, error, responseText);
  addToHistory(telemetry, payload);
  renderAdvanced({
    request: payload,
    responseStatus,
    responseJson,
    responseText,
    error,
    telemetry,
  });

  if (error) {
    setStatus("error", "Erro na requisição.");
    appendSystemMessage(`Erro: ${String(error)}`);
    return;
  }

  if (telemetry.ok) setStatus("ok", `OK • ${latencyMs} ms`);
  else setStatus("error", `HTTP ${responseStatus}`);

  appendAssistantMessage(extractAssistantMessage(responseJson, responseText));
}

// ============================================================
// TELEMETRY / HISTORY / ADVANCED
// ============================================================

function renderTelemetry(t, payload, responseJson, error, rawText) {
  if (!telemetrySummaryEl) return;

  telemetrySummaryEl.innerHTML = "";

  const items = [
    { label: "Status", value: t.status ?? "-" },
    { label: "OK", value: t.ok },
    { label: "Modo", value: t.mode },
    { label: "URL", value: t.url },
    { label: "Latência", value: `${t.latencyMs} ms` },
    { label: "Hora", value: formatTime(t.timestamp) },
  ];

  items.forEach((item) => {
    const label = document.createElement("div");
    label.classList.add("card-grid-item-label");
    label.textContent = item.label;

    const value = document.createElement("div");
    value.classList.add("card-grid-item-value");
    value.textContent = item.value;

    telemetrySummaryEl.appendChild(label);
    telemetrySummaryEl.appendChild(value);
  });

  if (telemetrySummaryBadgeEl)
    telemetrySummaryBadgeEl.textContent = t.ok ? "SUCESSO" : "FALHA";

  if (telemetryRequestEl)
    telemetryRequestEl.textContent = JSON.stringify(payload, null, 2);

  if (telemetryResponseEl) {
    telemetryResponseEl.textContent =
      responseJson
        ? JSON.stringify(responseJson, null, 2)
        : rawText ?? "<sem conteúdo>";
  }

  if (telemetryErrorCardEl) {
    if (!t.ok || error) {
      telemetryErrorCardEl.style.display = "flex";
      telemetryErrorEl.textContent = JSON.stringify(
        {
          error: error ? String(error) : null,
          status: t.status,
          raw: rawText,
        },
        null,
        2
      );
    } else {
      telemetryErrorCardEl.style.display = "none";
      telemetryErrorEl.textContent = "";
    }
  }
}

function addToHistory(t, payload) {
  const entry = {
    at: t.timestamp,
    mode: t.mode,
    ok: t.ok,
    status: t.status,
    latencyMs: t.latencyMs,
    message: payload.message || payload.intent || "",
    rawPayload: payload,
  };

  history.unshift(entry);

  if (!historyListEl) return;

  historyListEl.innerHTML = "";

  history.forEach((e) => {
    const item = document.createElement("div");
    item.classList.add("history-item");

    const date = new Date(e.at);
    const time = `${String(date.getHours()).padStart(2, "0")}:${String(
      date.getMinutes()
    ).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
    const d = `${String(date.getDate()).padStart(2, "0")}/${String(
      date.getMonth() + 1
    ).padStart(2, "0")}/${date.getFullYear()}`;

    const meta = document.createElement("div");
    meta.classList.add("history-meta");
    meta.innerHTML = `
      <span class="history-mode">${e.mode.toUpperCase()}</span>
      • HTTP ${e.status}
      • <span class="history-time">${time} • ${d}</span>
    `;

    const msg = document.createElement("div");
    msg.textContent = truncate(e.message, 200);

    const resend = document.createElement("button");
    resend.classList.add("resend-btn");
    resend.textContent = "Reenviar";
    resend.onclick = () => {
      try {
        userInputEl.value =
          e.rawPayload.message || JSON.stringify(e.rawPayload);
      } catch {}
    };

    item.appendChild(meta);
    item.appendChild(msg);
    item.appendChild(resend);

    historyListEl.appendChild(item);
  });
}

function renderAdvanced(env) {
  if (!advancedRawEl) return;
  advancedRawEl.textContent =
    `// ${formatTime(env.telemetry.timestamp)}\n` +
    JSON.stringify(env, null, 2);
}

// ============================================================
// HELPERS
// ============================================================

function truncate(str, max) {
  if (!str) return "";
  return str.length <= max ? str : str.slice(0, max) + "…";
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

function extractAssistantMessage(json, fallback) {
  if (!json) return fallback ?? "<sem conteúdo>";

  if (json.output) return json.output;
  if (json.message) return json.message;

  if (json.result) {
    const r = json.result;
    return (
      r.output ||
      r.message ||
      r.summary ||
      r.plan ||
      JSON.stringify(json, null, 2)
    );
  }

  return JSON.stringify(json, null, 2);
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    setStatus("ok", "Copiado.");
    setTimeout(() => setStatus("neutral", "Pronto"), 1200);
  } catch {
    setStatus("error", "Falha ao copiar.");
  }
}

// ============================================================
// EXPORT HISTORY
// ============================================================

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
