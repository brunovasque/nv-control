// ============================================================
// NV-Control Panel Script
// ============================================================

const DEFAULT_WORKER_URL = "https://nv-enavia.brunovasque.workers.dev";

// MODOS
const MODE_DIRECTOR = "director";
const MODE_ENAVIA = "enavia";
const MODE_ENGINEER = "engineer";
const MODE_BRAIN = "brain";

// DOM ELEMENTS
const messagesEl = document.getElementById("messages");
const userInputEl = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");

// mode buttons
const modeDirectorBtn = document.getElementById("modeDirectorBtn");
const modeEnaviaBtn = document.getElementById("modeEnaviaBtn");
const modeEngineerBtn = document.getElementById("modeEngineerBtn");
const modeBrainBtn = document.getElementById("modeBrainBtn");

const statusBadgeEl = document.getElementById("status-badge");
const modeBadgeEl = document.getElementById("mode-badge");
const workerUrlInputEl = document.getElementById("workerUrlInput");
const debugToggleEl = document.getElementById("debugToggle");

// Tabs
const tabTelemetryBtn = document.getElementById("tab-telemetry");
const tabRunBtn = document.getElementById("tab-run");
const tabHistoryBtn = document.getElementById("tab-history");
const tabAdvancedBtn = document.getElementById("tab-advanced");

const panelTelemetryEl = document.getElementById("panel-telemetry");
const panelRunEl = document.getElementById("panel-run");
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
const exportHistoryBtn = document.getElementById("exportHistoryBtn");
const historyModeFilterEl = document.getElementById("historyModeFilter");

// Advanced
const advancedRawEl = document.getElementById("advanced-raw");

// Run log (Execução)
const runLogEl = document.getElementById("run-log");
const clearRunLogBtn = document.getElementById("clearRunLogBtn");

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
let currentMode = MODE_DIRECTOR;
let history = [];
let historyFilterMode = "all";

// ============================================================
// INIT
// ============================================================

function init() {
  if (workerUrlInputEl && !workerUrlInputEl.value) {
    workerUrlInputEl.value = DEFAULT_WORKER_URL;
  }

  // Mode buttons
  if (modeDirectorBtn)
    modeDirectorBtn.addEventListener("click", () =>
      setMode(MODE_DIRECTOR)
    );
  if (modeEnaviaBtn)
    modeEnaviaBtn.addEventListener("click", () => setMode(MODE_ENAVIA));
  if (modeEngineerBtn)
    modeEngineerBtn.addEventListener("click", () =>
      setMode(MODE_ENGINEER)
    );
  if (modeBrainBtn)
    modeBrainBtn.addEventListener("click", () => setMode(MODE_BRAIN));

  // Send
  if (sendBtn) sendBtn.addEventListener("click", handleSend);

  // Enter / Ctrl+Enter
  if (userInputEl) {
    userInputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.shiftKey)) {
        return; // quebra linha normal
      }
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
  if (tabRunBtn)
    tabRunBtn.addEventListener("click", () => setActiveTab("run"));
  if (tabHistoryBtn)
    tabHistoryBtn.addEventListener("click", () => setActiveTab("history"));
  if (tabAdvancedBtn)
    tabAdvancedBtn.addEventListener("click", () => setActiveTab("advanced"));

  // Copy buttons
  document.querySelectorAll(".copy-btn").forEach((btn) => {
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

  // Export history
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

  // Filter history
  if (historyModeFilterEl) {
    historyModeFilterEl.addEventListener("change", (e) => {
      historyFilterMode = e.target.value || "all";
      renderHistory();
    });
  }

  // Clear run log
  if (clearRunLogBtn) {
    clearRunLogBtn.addEventListener("click", () => {
      if (runLogEl) runLogEl.innerHTML = "";
    });
  }

  // Deploy buttons
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

  setMode(MODE_DIRECTOR, { silent: true });
  setStatus("neutral", "Pronto");
  appendSystemMessage(
    "NV-Control inicializado. DIRECTOR definido como modo padrão."
  );
}

document.addEventListener("DOMContentLoaded", init);

// ============================================================
// MODE / STATUS
// ============================================================

function setMode(mode, options = {}) {
  currentMode = mode;

  if (modeBadgeEl) {
    modeBadgeEl.textContent = mode.toUpperCase();
    modeBadgeEl.classList.remove(
      "badge-mode-director",
      "badge-mode-enavia",
      "badge-mode-engineer",
      "badge-mode-brain"
    );
    if (mode === MODE_DIRECTOR) modeBadgeEl.classList.add("badge-mode-director");
    else if (mode === MODE_ENAVIA)
      modeBadgeEl.classList.add("badge-mode-enavia");
    else if (mode === MODE_ENGINEER)
      modeBadgeEl.classList.add("badge-mode-engineer");
    else if (mode === MODE_BRAIN)
      modeBadgeEl.classList.add("badge-mode-brain");
  }

  const modes = [
    { btn: modeDirectorBtn, id: MODE_DIRECTOR },
    { btn: modeEnaviaBtn, id: MODE_ENAVIA },
    { btn: modeEngineerBtn, id: MODE_ENGINEER },
    { btn: modeBrainBtn, id: MODE_BRAIN },
  ];
  modes.forEach(({ btn, id }) => {
    if (!btn) return;
    const isActive = id === mode;
    btn.classList.toggle("active", isActive);
    btn.classList.toggle("mode-active", isActive);
  });

  if (!options.silent) {
    appendSystemMessage(
      `Modo alterado para ${mode.toUpperCase()} (${modeDescription(mode)}).`
    );
  }
}

function modeDescription(mode) {
  if (mode === MODE_DIRECTOR)
    return "decisão estratégica (DIRECTOR coordena a ENAVIA)";
  if (mode === MODE_ENAVIA) return "execução direta com a engenheira ENAVIA";
  if (mode === MODE_ENGINEER)
    return "plano técnico, patch e fluxo supervisionado de deploy";
  if (mode === MODE_BRAIN) return "treinamento (conteúdo será aprendido)";
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
    { btn: tabRunBtn, panel: panelRunEl, id: "run" },
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
    meta.textContent = `Você (${(mode || "").toUpperCase()}) • ${when}`;
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
// RUN LOG (Execução cinematográfica)
// ============================================================

function appendRunLog(source, message) {
  if (!runLogEl || !message) return;

  const item = document.createElement("div");
  item.classList.add("run-log-item");
  item.dataset.source = source;

  const meta = document.createElement("div");
  meta.classList.add("run-log-meta");
  const when = new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  meta.textContent = `[${source}] • ${when}`;

  const textEl = document.createElement("div");
  textEl.classList.add("run-log-text");
  textEl.textContent = message;

  item.appendChild(meta);
  item.appendChild(textEl);

  runLogEl.appendChild(item);
  runLogEl.scrollTop = runLogEl.scrollHeight;
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

  if (mode === MODE_ENGINEER) {
    let parsed = null;
    try {
      parsed = JSON.parse(content);
    } catch (_) {}

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

    return {
      ...base,
      intent: content,
      message: `[ENGINEER] ${content}`,
      askSuggestions: true,
      riskReport: true,
      preventForbidden: true,
    };
  }

  if (mode === MODE_BRAIN) {
    return {
      ...base,
      content,
      message: `[BRAIN] ${truncate(content, 200)}`,
    };
  }

  if (mode === MODE_ENAVIA) {
    return {
      ...base,
      message: content,
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

  if (currentMode === MODE_DIRECTOR) {
    appendRunLog("DIRECTOR", `Intenção recebida: "${truncate(raw, 80)}"`);
    await sendToDirector(raw);
    return;
  }

  let payloadMode = MODE_ENAVIA;
  if (currentMode === MODE_ENAVIA) payloadMode = MODE_ENAVIA;
  else if (currentMode === MODE_ENGINEER) payloadMode = MODE_ENGINEER;
  else if (currentMode === MODE_BRAIN) payloadMode = MODE_BRAIN;

  const payload = buildPayload(payloadMode, raw);

  if (payloadMode === MODE_ENGINEER && payload.executor_action) {
    appendRunLog(
      "ENAVIA/ENGINEER",
      `Recebido pedido de ${payload.executor_action} a partir do console.`
    );
  } else if (payloadMode === MODE_ENAVIA) {
    appendRunLog("ENAVIA", `Chamando ENAVIA com mensagem técnica.`);
  } else if (payloadMode === MODE_BRAIN) {
    appendRunLog("ENAVIA/BRAIN", `Enviando conteúdo de treinamento para o cérebro.`);
  }

  await sendToWorker(payload);
}

// ============================================================
// DIRECTOR FLOW – /api/director
// ============================================================

async function sendToDirector(message) {
  const endpoint = "/api/director";

  const payload = {
    source: "NV-CONTROL",
    role: "ceo",
    env_mode: "supervised",
    mode: MODE_DIRECTOR,
    debug: !!(debugToggleEl && debugToggleEl.checked),
    timestamp: new Date().toISOString(),
    message,
    context: {
      from: "NV-Control",
      workerUrl: getWorkerUrl(),
    },
  };

  const startedAt = performance.now();
  setStatus("pending", "Enviando para DIRECTOR...");
  appendRunLog("DIRECTOR", "Analisando intenção e preparando resposta...");

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
    } catch (_) {
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
    mode: MODE_DIRECTOR,
    url: endpoint,
    ok: !error && responseStatus >= 200 && responseStatus < 300,
  };

  const advancedEnvelope = {
    request: payload,
    responseStatus,
    responseJson,
    responseText,
    error: error ? String(error) : null,
    telemetry,
  };

  renderTelemetry(telemetry, payload, responseJson, error, responseText);
  addToHistory(telemetry, payload);
  renderAdvanced(advancedEnvelope);

  if (error) {
    setStatus("error", "Erro na requisição.");
    appendSystemMessage(`Erro ao falar com o DIRECTOR: ${String(error)}`);
    appendRunLog(
      "DIRECTOR",
      `Falha de comunicação com /api/director: ${String(error)}`
    );
    return;
  }

  if (telemetry.ok) {
    setStatus("ok", `OK • ${latencyMs} ms • ${responseStatus}`);
    appendRunLog(
      "DIRECTOR",
      `Resposta concluída em ${latencyMs} ms (HTTP ${responseStatus}).`
    );
  } else {
    setStatus("error", `HTTP ${responseStatus || "-"} • ver Telemetria`);
    appendRunLog(
      "DIRECTOR",
      `Resposta com falha (HTTP ${responseStatus || "-"}) – ver Telemetria.`
    );
  }

const assistantText = extractAssistantMessage(responseJson, responseText);
appendAssistantMessage(assistantText);
appendRunLog(runSource, assistantText);

// ============================================================
// PASSO 6.1 — detectar sugestão de memória (sem salvar)
// ============================================================
if (responseJson && responseJson.memory_proposal) {
  try {
    window.pendingMemoryProposal = responseJson.memory_proposal;
    renderMemoryProposal(responseJson.memory_proposal);
    appendRunLog(
      "SYSTEM",
      "🧠 Sugestão de memória estratégica detectada (aguardando aprovação)."
    );
  } catch (err) {
    console.warn("Falha ao renderizar memory_proposal:", err);
  }
}

// ============================================================
// DEPLOY HELPERS
// ============================================================

function buildDeployPayload(executorAction, options = {}) {
  const base = {
    source: "NV-CONTROL",
    env_mode: "supervised",
    mode: MODE_ENGINEER,
    debug: !!(debugToggleEl && debugToggleEl.checked),
    timestamp: new Date().toISOString(),
    executor_action: executorAction,
    askSuggestions: true,
    riskReport: true,
    preventForbidden: true,
  };

  if (options.patch !== undefined) {
    base.patch = options.patch;
  }

  return base;
}

async function handleDeployAction(executorAction, options = {}) {
  const payload = buildDeployPayload(executorAction, options);

  appendSystemMessage(`Disparando ${executorAction} via NV-Control.`);
  appendRunLog(
    "EXECUTOR",
    `Iniciando fluxo ${executorAction} solicitado pelo console.`
  );

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
    appendSystemMessage(
      "Nenhum patch encontrado. Escreva o PATCH no campo de mensagem."
    );
    return;
  }

  let patchPayload = raw;
  try {
    patchPayload = JSON.parse(raw);
  } catch (_) {
    console.warn(
      "PATCH enviado como string — não é JSON válido (fallback mantido)."
    );
  }

  const payload = buildDeployPayload("deploy_apply_user_patch", {
    patch: patchPayload,
  });

  appendSystemMessage(
    "Enviando deploy_apply_user_patch com patch interpretado corretamente."
  );
  appendRunLog(
    "EXECUTOR",
    "Recebendo patch manual do NV-Control para deploy_apply_user_patch."
  );

  await sendToWorker(payload);
}

// ============================================================
// WORKER FLOW – NV-ENAVIA
// ============================================================

async function sendToWorker(payload) {
  const url = getWorkerUrl();

  if (!url.startsWith("http")) {
    setStatus("error", "URL do worker inválida.");
    appendSystemMessage("URL do worker inválida. Ajuste no topo do painel.");
    appendRunLog("EXECUTOR", "Abortado: URL do worker inválida.");
    return;
  }

  let endpoint;
  if (payload.mode === MODE_ENGINEER) {
    endpoint = url.replace(/\/$/, "") + "/engineer";
  } else {
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

  const advancedEnvelope = {
    request: payload,
    responseStatus,
    responseJson,
    responseText,
    error: error ? String(error) : null,
    telemetry,
  };

  renderTelemetry(telemetry, payload, responseJson, error, responseText);
  addToHistory(telemetry, payload);
  renderAdvanced(advancedEnvelope);

  const runSource =
    payload.mode === MODE_ENGINEER
      ? payload.executor_action
        ? "EXECUTOR"
        : "ENAVIA/ENGINEER"
      : payload.mode === MODE_ENAVIA
      ? "ENAVIA"
      : payload.mode === MODE_BRAIN
      ? "ENAVIA/BRAIN"
      : "ENAVIA";

  if (error) {
    setStatus("error", "Erro na requisição.");
    appendSystemMessage(`Erro ao falar com o worker: ${String(error)}`);
    appendRunLog(
      runSource,
      `Erro de comunicação com worker (${endpoint}): ${String(error)}`
    );
    return;
  }

  if (telemetry.ok) {
    setStatus("ok", `OK • ${latencyMs} ms • ${responseStatus}`);
    appendRunLog(
      runSource,
      `Resposta concluída em ${latencyMs} ms (HTTP ${responseStatus}).`
    );
  } else {
    setStatus("error", `HTTP ${responseStatus || "-"} • ver Telemetria`);
    appendRunLog(
      runSource,
      `Resposta com falha (HTTP ${responseStatus || "-"}) – ver Telemetria.`
    );
  }

  const assistantText = extractAssistantMessage(responseJson, responseText);
  appendAssistantMessage(assistantText);
  appendRunLog(runSource, assistantText);
}

// ============================================================
// TELEMETRIA / HISTÓRICO / AVANÇADO
// ============================================================

function renderTelemetry(
  telemetry,
  payload,
  responseJson,
  error,
  responseText
) {
  if (!telemetrySummaryEl) return;

  let pipeline = "[CEO]";
  if (payload.mode === MODE_DIRECTOR) {
    pipeline += " → [DIRECTOR] → [ENAVIA] → [EXECUTOR] → [NV-FIRST]";
  } else if (payload.mode === MODE_ENGINEER) {
    pipeline += " → [DIRECTOR] → [ENAVIA] → [EXECUTOR] → [NV-FIRST]";
  } else if (payload.mode === MODE_BRAIN) {
    pipeline += " → [ENAVIA/BRAIN] → [EXECUTOR] → [NV-FIRST]";
  } else if (payload.mode === MODE_ENAVIA) {
    pipeline += " → [ENAVIA] → [EXECUTOR] → [NV-FIRST]";
  } else {
    pipeline += " → [ENAVIA] → [EXECUTOR]";
  }

  telemetrySummaryEl.innerHTML = "";

  const items = [
    { label: "Status", value: telemetry.status || "-" },
    { label: "OK", value: telemetry.ok ? "true" : "false" },
    { label: "Modo", value: telemetry.mode || "-" },
    { label: "URL", value: telemetry.url || "-" },
    { label: "Latência", value: `${telemetry.latencyMs} ms` },
    { label: "Hora", value: formatTime(telemetry.timestamp) },
    { label: "Pipeline", value: pipeline },
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

  if (telemetryRequestEl) {
    telemetryRequestEl.textContent = JSON.stringify(payload, null, 2);
  }

  if (telemetryResponseEl) {
    if (responseJson) {
      telemetryResponseEl.textContent = JSON.stringify(responseJson, null, 2);
    } else if (responseText) {
      telemetryResponseEl.textContent = responseText;
    } else {
      telemetryResponseEl.textContent = "<sem conteúdo>";
    }
  }

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

  history.sort((a, b) => {
    const aTime = typeof a.at === "string" ? new Date(a.at).getTime() : a.at;
    const bTime = typeof b.at === "string" ? new Date(b.at).getTime() : b.at;
    return bTime - aTime;
  });

  renderHistory();
}

function renderHistory() {
  if (!historyListEl) return;
  historyListEl.innerHTML = "";

  const filtered = history.filter((entry) => {
    if (historyFilterMode === "all") return true;
    if (historyFilterMode === "executor") {
      return entry.mode === "executor";
    }
    return (entry.mode || "").toLowerCase() === historyFilterMode;
  });

  filtered.forEach((entry) => {
    const item = document.createElement("div");
    item.classList.add("history-item");

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
    right.textContent = `${entry.ok ? "OK" : "ERRO"} • ${
      entry.latencyMs
    } ms`;

    metaRow.appendChild(left);
    metaRow.appendChild(right);

    const msg = document.createElement("div");
    msg.textContent = truncate(entry.message || "", 220);

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

  const mode = envelope.telemetry && envelope.telemetry.mode;
  let headerLine = `// [LOG] ${headerTime}`;
  if (mode === MODE_DIRECTOR) {
    headerLine +=
      " • Pipeline: [CEO] → [DIRECTOR] → [ENAVIA] → [EXECUTOR] → [NV-FIRST]";
  } else if (mode === MODE_ENGINEER) {
    headerLine +=
      " • Pipeline: [CEO] → [DIRECTOR] → [ENAVIA] → [EXECUTOR] → [NV-FIRST]";
  } else if (mode === MODE_ENAVIA) {
    headerLine +=
      " • Pipeline: [CEO] → [ENAVIA] → [EXECUTOR] → [NV-FIRST]";
  } else if (mode === MODE_BRAIN) {
    headerLine +=
      " • Pipeline: [CEO] → [ENAVIA/BRAIN] → [EXECUTOR] → [NV-FIRST]";
  }

  advancedRawEl.textContent =
    `${headerLine}\n` + JSON.stringify(envelope, null, 2);
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

