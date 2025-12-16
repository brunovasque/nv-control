// ============================================================
// NV-CONTROL — PAINEL (CANÔNICO)
// ============================================================

const DEFAULT_WORKER_URL = "https://nv-enavia.brunovasque.workers.dev";

// ============================================================
// DOM
// ============================================================

const workerUrlInputEl = document.getElementById("workerUrlInput");
const debugToggleEl = document.getElementById("debugToggle");
const sendBtn = document.getElementById("sendBtn");
const userInputEl = document.getElementById("userInput");
const messagesEl = document.getElementById("messages");

const statusBadgeEl = document.getElementById("status-badge");
const modeBadgeEl = document.getElementById("mode-badge");

const modeDirectorBtn = document.getElementById("modeDirectorBtn");
const modeEnaviaBtn = document.getElementById("modeEnaviaBtn");
const modeEngineerBtn = document.getElementById("modeEngineerBtn");
const modeBrainBtn = document.getElementById("modeBrainBtn");

const tabTelemetryBtn = document.getElementById("tab-telemetry");
const tabRunBtn = document.getElementById("tab-run");
const tabHistoryBtn = document.getElementById("tab-history");
const tabAdvancedBtn = document.getElementById("tab-advanced");

const panelTelemetryEl = document.getElementById("panel-telemetry");
const panelRunEl = document.getElementById("panel-run");
const panelHistoryEl = document.getElementById("panel-history");
const panelAdvancedEl = document.getElementById("panel-advanced");

const telemetrySummaryEl = document.getElementById("telemetry-summary");
const telemetrySummaryBadgeEl = document.getElementById("telemetry-summary-badge");
const telemetryRequestEl = document.getElementById("telemetry-request");
const telemetryResponseEl = document.getElementById("telemetry-response");
const telemetryErrorCardEl = document.getElementById("telemetry-error-card");
const telemetryErrorEl = document.getElementById("telemetry-error");

const runLogEl = document.getElementById("run-log");
const historyListEl = document.getElementById("history-list");
const advancedRawEl = document.getElementById("advanced-raw");

const clearRunLogBtn = document.getElementById("clearRunLogBtn");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const exportHistoryBtn = document.getElementById("exportHistoryBtn");
const historyModeFilterEl = document.getElementById("historyModeFilter");
const clearAllBtn = document.getElementById("clearAllBtn");

const envSelectEl = document.getElementById("envSelect");
const workerIdTestInputEl = document.getElementById("workerIdTestInput");
const workerIdRealInputEl = document.getElementById("workerIdRealInput");

const canonAuditBtn = document.getElementById("canonAuditBtn");
const canonProposeBtn = document.getElementById("canonProposeBtn");
const canonApplyTestBtn = document.getElementById("canonApplyTestBtn");
const canonPromoteRealBtn = document.getElementById("canonPromoteRealBtn");
const canonRollbackBtn = document.getElementById("canonRollbackBtn");
const canonDeployTestBtn = document.getElementById("canonDeployTestBtn");
const canonCancelBtn = document.getElementById("canonCancelBtn");

// ============================================================
// STATE
// ============================================================

const MODE_DIRECTOR = "director";
const MODE_ENAVIA = "enavia";
const MODE_ENGINEER = "engineer";
const MODE_BRAIN = "brain";

let currentMode = MODE_DIRECTOR;
let activeTab = "telemetry";

let historyEntries = []; // [{ ts, mode, payload, response, ok, latencyMs, url, status }]

// Worker environment (TESTE/REAL)
window.workerIdTest = "enavia-worker-teste";
window.workerIdReal = "enavia-worker-real";
window.currentEnv = "test";
window.currentWorkerId = window.workerIdTest;

// ============================================================
// INIT
// ============================================================

function init() {
  if (workerUrlInputEl && !workerUrlInputEl.value) {
    workerUrlInputEl.value = DEFAULT_WORKER_URL;
  }

  // Mode buttons
  if (modeDirectorBtn)
    modeDirectorBtn.addEventListener("click", () => setMode(MODE_DIRECTOR));
  if (modeEnaviaBtn)
    modeEnaviaBtn.addEventListener("click", () => setMode(MODE_ENAVIA));
  if (modeEngineerBtn)
    modeEngineerBtn.addEventListener("click", () => setMode(MODE_ENGINEER));
  if (modeBrainBtn)
    modeBrainBtn.addEventListener("click", () => setMode(MODE_BRAIN));

  // Tabs
  if (tabTelemetryBtn)
    tabTelemetryBtn.addEventListener("click", () => setActiveTab("telemetry"));
  if (tabRunBtn) tabRunBtn.addEventListener("click", () => setActiveTab("run"));
  if (tabHistoryBtn)
    tabHistoryBtn.addEventListener("click", () => setActiveTab("history"));
  if (tabAdvancedBtn)
    tabAdvancedBtn.addEventListener("click", () => setActiveTab("advanced"));

  // Send
  if (sendBtn) sendBtn.addEventListener("click", handleSend);
  if (userInputEl) {
    userInputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        // Newline
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        handleSend();
      }
    });
  }

  // Copy buttons (telemetry + advanced)
  bindCopyButtons();

  // Run log / history controls
  if (clearRunLogBtn)
    clearRunLogBtn.addEventListener("click", () => {
      if (runLogEl) runLogEl.innerHTML = "";
      appendSystemMessage("Log de execução limpo.");
    });

  if (clearHistoryBtn)
    clearHistoryBtn.addEventListener("click", () => {
      historyEntries = [];
      renderHistory();
      appendSystemMessage("Histórico limpo.");
    });

  if (exportHistoryBtn)
    exportHistoryBtn.addEventListener("click", () => exportHistory());

  if (historyModeFilterEl)
    historyModeFilterEl.addEventListener("change", () => renderHistory());

  if (clearAllBtn)
    clearAllBtn.addEventListener("click", () => {
      if (messagesEl) messagesEl.innerHTML = "";
      if (runLogEl) runLogEl.innerHTML = "";
      historyEntries = [];
      renderHistory();
      clearTelemetry();
      appendSystemMessage("Console + logs + histórico limpos.");
    });

  // ENV select + workerId inputs
  if (envSelectEl) {
    envSelectEl.addEventListener("change", () => {
      setActiveEnv(envSelectEl.value);
      appendSystemMessage(`Ambiente ativo: ${envSelectEl.value.toUpperCase()}.`);
    });
  }

  if (workerIdTestInputEl) {
    workerIdTestInputEl.value = window.workerIdTest || "";
    workerIdTestInputEl.addEventListener("change", () => {
      window.workerIdTest = workerIdTestInputEl.value.trim();
      if (window.currentEnv === "test") window.currentWorkerId = window.workerIdTest;
      appendSystemMessage(`workerId TEST atualizado: ${window.workerIdTest || "-"}`);
    });
  }

  if (workerIdRealInputEl) {
    workerIdRealInputEl.value = window.workerIdReal || "";
    workerIdRealInputEl.addEventListener("change", () => {
      window.workerIdReal = workerIdRealInputEl.value.trim();
      if (window.currentEnv === "real") window.currentWorkerId = window.workerIdReal;
      appendSystemMessage(`workerId REAL atualizado: ${window.workerIdReal || "-"}`);
    });
  }

  // CANONICAL DEPLOY BUTTONS
  if (canonAuditBtn) {
    canonAuditBtn.addEventListener("click", () => {
      // Read-only: usa o action existente de simulação, mas sinaliza fase no extra
      handleDeployAction("deploy_simulate", {
        message: "AUDIT + simulação (read-only)",
        extra: { phase: "audit_simulate" },
        workerId: getActiveWorkerId(),
      });
    });
  }

  if (canonProposeBtn) {
    canonProposeBtn.addEventListener("click", async () => {
      // PROPOSE: não aplica, apenas solicita patch + plano + impactos
      // Mantém compatibilidade com executor: vai como JSON string no payload
      const manual_block = (userInputEl && userInputEl.value ? userInputEl.value.trim() : "") || null;

      const proposeEnvelope = {
        mode: "engineer",
        intent: "ENAVIA, gerar proposta de patch + plano de testes + impactos. NÃO aplicar.",
        manual_block,
        require: [
          "Gerar patchText + testPlan + impactAnalysis + riskReport",
          "Se manual_block existir, use-o como base (validar encaixe/impacto)",
          "Ambiente de alteração SEMPRE é TESTE (propor promoção só após TESTE OK)"
        ],
      };

      // Envia como JSON para cair no caminho já existente do buildPayload (preserva workerId)
      appendSystemMessage("PROPOSE: solicitando patch + plano + impactos (sem aplicar).");
      appendRunLog("ENAVIA/ENGINEER", "PROPOSE disparado (sem apply).");
      await sendToWorker(buildPayload(MODE_ENGINEER, JSON.stringify(proposeEnvelope)));
    });
  }

  if (canonApplyTestBtn) {
    canonApplyTestBtn.addEventListener("click", () => {
      // Força TESTE, confirmação obrigatória
      const ok = confirm("APPLY TEST: aplicar a última proposta ... TESTE? (isso cria snapshot e pode exigir rollback se falhar)");
      if (!ok) return;

      setActiveEnv("test");
      handleDeployAction("deploy_accept_suggestion", {
        message: "APPLY TEST (somente TESTE)",
        extra: { userApproval: true, target_env: "test", require_env: "test" },
        workerId: window.workerIdTest || getActiveWorkerId(),
      });
    });
  }

  // ✅ FASE 2 — DEPLOY TESTE (aplica deploy REAL no ambiente TESTE)
  if (canonDeployTestBtn) {
    canonDeployTestBtn.addEventListener("click", () => {
      // Força TESTE, confirmação obrigatória
      const ok = confirm(
        "DEPLOY TESTE: aplicar deploy REAL no ambiente TESTE?\n\nIsso gera a prova obrigatória para liberar PRODUÇÃO."
      );
      if (!ok) return;

      setActiveEnv("test");
      handleDeployAction("deploy_execute_test", {
        message: "DEPLOY TESTE (real aplicado no ambiente TESTE)",
        extra: {
          userApproval: true,
          target_env: "test",
          require_env: "test",
          generate_proof: true,
        },
        workerId: window.workerIdTest || getActiveWorkerId(),
      });
    });
  }

  if (canonPromoteRealBtn) {
    canonPromoteRealBtn.addEventListener("click", () => {
      // Força REAL, confirmação obrigatória
      const ok = confirm("PROMOTE REAL: promover para REAL o patch JÁ testado? (NUNCA promove sem TESTE OK)");
      if (!ok) return;

      setActiveEnv("real");
      handleDeployAction("deploy_safe", {
        message: "PROMOTE REAL (apenas após TESTE OK)",
        extra: {
          userApproval: true,
          target_env: "real",
          promote: true,
          require_test_success: true,
          explain_impacts: true,
        },
        workerId: window.workerIdReal || getActiveWorkerId(),
      });
    });
  }

  // ✅ FASE 2 — CANCELAR (encerra ciclo atual)
  if (canonCancelBtn) {
    canonCancelBtn.addEventListener("click", () => {
      const ok = confirm("CANCELAR: abandonar o ciclo atual?\n\nNenhum deploy será aplicado.");
      if (!ok) return;

      handleDeployAction("deploy_cancel", {
        message: "CANCELAR ciclo atual",
      });
    });
  }

  if (canonRollbackBtn) {
    canonRollbackBtn.addEventListener("click", () => {
      const ok = confirm("ROLLBACK: voltar para o último estado estável do worker ativo?");
      if (!ok) return;

      handleDeployAction("deploy_rollback", {
        message: "ROLLBACK (emergência)",
        workerId: getActiveWorkerId(),
      });
    });
  }


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
    else if (mode === MODE_BRAIN) modeBadgeEl.classList.add("badge-mode-brain");
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
  if (mode === MODE_DIRECTOR) return "decisão/controle";
  if (mode === MODE_ENAVIA) return "execução supervisionada";
  if (mode === MODE_ENGINEER) return "planejamento/patch";
  if (mode === MODE_BRAIN) return "treinamento/módulos";
  return "desconhecido";
}

function setStatus(kind, text) {
  if (!statusBadgeEl) return;

  statusBadgeEl.textContent = text || "-";
  statusBadgeEl.classList.remove("badge-neutral", "badge-ok", "badge-error", "badge-pending");

  if (kind === "ok") statusBadgeEl.classList.add("badge-ok");
  else if (kind === "error") statusBadgeEl.classList.add("badge-error");
  else if (kind === "pending") statusBadgeEl.classList.add("badge-pending");
  else statusBadgeEl.classList.add("badge-neutral");
}

// ============================================================
// TAB UI
// ============================================================

function setActiveTab(tab) {
  activeTab = tab;

  [tabTelemetryBtn, tabRunBtn, tabHistoryBtn, tabAdvancedBtn].forEach((btn) => {
    if (!btn) return;
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });

  [panelTelemetryEl, panelRunEl, panelHistoryEl, panelAdvancedEl].forEach((panel) => {
    if (!panel) return;
    panel.classList.toggle("active", panel.id === `panel-${tab}`);
  });
}

// ============================================================
// ENV / WORKERID
// ============================================================

function setActiveEnv(env) {
  window.currentEnv = env;
  if (env === "real") window.currentWorkerId = window.workerIdReal;
  else window.currentWorkerId = window.workerIdTest;
  if (envSelectEl) envSelectEl.value = env;
}

function getActiveWorkerId() {
  // prioridade: estado global > inputs > fallback
  const fromState = window.currentWorkerId || null;
  if (fromState) return fromState;

  if (window.currentEnv === "real") {
    return (workerIdRealInputEl && workerIdRealInputEl.value.trim()) || window.workerIdReal || null;
  }
  return (workerIdTestInputEl && workerIdTestInputEl.value.trim()) || window.workerIdTest || null;
}

// ============================================================
// CONSOLE SEND (DIRECTOR / ENAVIA / ENGINEER / BRAIN)
// ============================================================

function getWorkerUrl() {
  const url = (workerUrlInputEl && workerUrlInputEl.value.trim()) || DEFAULT_WORKER_URL;
  return url;
}

function buildPayload(mode, message) {
  return {
    source: "NV-CONTROL",
    env_mode: "supervised",
    mode,
    debug: !!(debugToggleEl && debugToggleEl.checked),
    timestamp: new Date().toISOString(),
    message,
  };
}

async function handleSend() {
  if (!userInputEl) return;
  const message = userInputEl.value.trim();
  if (!message) return;

  appendUserMessage(message);
  userInputEl.value = "";

  const payload = buildPayload(currentMode, message);

  if (currentMode === MODE_DIRECTOR) {
    await sendToDirector(payload);
  } else if (currentMode === MODE_ENAVIA) {
    await sendToWorker(payload);
  } else if (currentMode === MODE_ENGINEER) {
    // Engineer mode goes to /engineer for executor
    await sendToWorker(payload);
  } else if (currentMode === MODE_BRAIN) {
    await sendToWorker(payload);
  } else {
    await sendToWorker(payload);
  }
}

// ============================================================
// DIRECTOR FLOW — OPENAI (ou proxy local, conforme infra)
// ============================================================

async function sendToDirector(payload) {
  clearTelemetry();
  appendRunLog("DIRECTOR", "Enviando request para o DIRECTOR...");

  // Aqui o painel está preparado para um endpoint local/proxy de director.
  // Mantemos o comportamento existente: se não houver, apenas loga.
  // (Não inventar nova lógica aqui.)
  const url = getWorkerUrl();
  const endpoint = url.replace(/\/$/, "") + "/";

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
    mode: payload.mode,
    url: endpoint,
    ok: !error && responseStatus >= 200 && responseStatus < 300,
  };

  const rawLog = {
    request: payload,
    responseStatus,
    responseText,
    responseJson,
    error: error ? String(error) : null,
    telemetry,
  };

  renderTelemetry(payload, responseText, responseJson, error, telemetry);

  historyEntries.unshift({
    ts: telemetry.timestamp,
    mode: "director",
    rawPayload: payload,
    responseText,
    responseJson,
    ok: telemetry.ok,
    latencyMs: telemetry.latencyMs,
    url: telemetry.url,
    status: telemetry.status,
  });
  renderHistory();

  if (advancedRawEl) advancedRawEl.textContent = JSON.stringify(rawLog, null, 2);

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

  // ✅ CORREÇÃO CIRÚRGICA AQUI:
  // - runSource não existe nesse escopo
  // - a função sendToDirector estava sem fechamento "}"
  const assistantText = extractAssistantMessage(responseJson, responseText);
  appendAssistantMessage(assistantText);
  appendRunLog("DIRECTOR", assistantText);
} // ✅ FECHAMENTO QUE FALTAVA (causa do Unexpected end of input)

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

    // 🔑 workerId agora é preservado corretamente
    // prioridade:
    // 1) options.workerId (quando passado explicitamente)
    // 2) window.currentWorkerId (estado global do painel)
    // 3) null (executor vai bloquear, como proteção)
    workerId:
      options.workerId ??
      getActiveWorkerId() ??
      null,

    askSuggestions: true,
    riskReport: true,
    preventForbidden: true,
  };

  if (options.patch !== undefined) {
    base.patch = options.patch;
  }

  if (options.extra !== undefined) {
    base.extra = options.extra;
  }

  if (options.message !== undefined) {
    base.message = options.message;
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
    message: "patch manual enviado pelo usuário",
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
    mode: payload.mode,
    url: endpoint,
    ok: !error && responseStatus >= 200 && responseStatus < 300,
  };

  const rawLog = {
    request: payload,
    responseStatus,
    responseText,
    responseJson,
    error: error ? String(error) : null,
    telemetry,
  };

  renderTelemetry(payload, responseText, responseJson, error, telemetry);

  historyEntries.unshift({
    ts: telemetry.timestamp,
    mode: payload.mode === MODE_ENGINEER ? "executor" : payload.mode,
    rawPayload: payload,
    responseText,
    responseJson,
    ok: telemetry.ok,
    latencyMs: telemetry.latencyMs,
    url: telemetry.url,
    status: telemetry.status,
  });
  renderHistory();

  if (advancedRawEl) advancedRawEl.textContent = JSON.stringify(rawLog, null, 2);

  if (telemetry.ok) {
    setStatus("ok", `OK • ${latencyMs} ms • ${responseStatus}`);
    appendRunLog(
      payload.mode === MODE_ENGINEER ? "EXECUTOR" : payload.mode.toUpperCase(),
      `Resposta concluída em ${latencyMs} ms (HTTP ${responseStatus}).`
    );
  } else {
    setStatus("error", `HTTP ${responseStatus || "-"} • ver Telemetria`);
    appendRunLog(
      payload.mode === MODE_ENGINEER ? "EXECUTOR" : payload.mode.toUpperCase(),
      `Resposta com falha (HTTP ${responseStatus || "-"}) – ver Telemetria.`
    );
  }

  const assistantText = extractAssistantMessage(responseJson, responseText);

  if (payload.mode === MODE_ENGINEER) {
    // executor responses go to run log + console
    appendAssistantMessage(assistantText);
    appendRunLog("EXECUTOR", assistantText);
  } else if (payload.mode === MODE_ENAVIA) {
    appendAssistantMessage(assistantText);
    appendRunLog("ENAVIA", assistantText);
  } else if (payload.mode === MODE_BRAIN) {
    appendAssistantMessage(assistantText);
    appendRunLog("BRAIN", assistantText);
  } else {
    appendAssistantMessage(assistantText);
    appendRunLog("SYSTEM", assistantText);
  }
}

// ============================================================
// UI MESSAGES
// ============================================================

function appendSystemMessage(text) {
  appendMessage("system", text);
}

function appendUserMessage(text) {
  appendMessage("user", text);
}

function appendAssistantMessage(text) {
  appendMessage("assistant", text);
}

function appendMessage(kind, text) {
  if (!messagesEl) return;

  const item = document.createElement("div");
  item.className = `msg msg-${kind}`;

  const head = document.createElement("div");
  head.className = "msg-head";
  head.textContent =
    kind === "user"
      ? "Você"
      : kind === "assistant"
      ? "Assistente"
      : "Sistema";

  const body = document.createElement("div");
  body.className = "msg-body";
  body.textContent = text || "";

  item.appendChild(head);
  item.appendChild(body);

  messagesEl.appendChild(item);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function appendRunLog(source, text) {
  if (!runLogEl) return;

  const line = document.createElement("div");
  line.className = "run-line";

  const ts = new Date().toLocaleTimeString();
  line.textContent = `[${ts}] ${source}: ${text}`;

  runLogEl.appendChild(line);
  runLogEl.scrollTop = runLogEl.scrollHeight;
}

// ============================================================
// TELEMETRY
// ============================================================

function clearTelemetry() {
  if (telemetrySummaryEl) telemetrySummaryEl.innerHTML = "";
  if (telemetryRequestEl) telemetryRequestEl.textContent = "";
  if (telemetryResponseEl) telemetryResponseEl.textContent = "";
  if (telemetryErrorEl) telemetryErrorEl.textContent = "";
  if (telemetryErrorCardEl) telemetryErrorCardEl.style.display = "none";
  if (telemetrySummaryBadgeEl) telemetrySummaryBadgeEl.textContent = "-";
}

function renderTelemetry(payload, responseText, responseJson, error, telemetry) {
  clearTelemetry();

  if (telemetrySummaryBadgeEl) {
    telemetrySummaryBadgeEl.textContent = telemetry.ok ? "OK" : "FAIL";
  }

  if (telemetrySummaryEl) {
    telemetrySummaryEl.innerHTML = `
      <div><strong>Status</strong><div>${telemetry.status ?? "-"}</div></div>
      <div><strong>Latência</strong><div>${telemetry.latencyMs ?? "-"} ms</div></div>
      <div><strong>Modo</strong><div>${telemetry.mode ?? "-"}</div></div>
      <div><strong>URL</strong><div style="word-break:break-all;">${telemetry.url ?? "-"}</div></div>
      <div><strong>OK</strong><div>${telemetry.ok ? "true" : "false"}</div></div>
      <div><strong>Timestamp</strong><div>${telemetry.timestamp ?? "-"}</div></div>
    `;
  }

  if (telemetryRequestEl) {
    telemetryRequestEl.textContent = JSON.stringify(payload, null, 2);
  }

  if (telemetryResponseEl) {
    if (responseJson) telemetryResponseEl.textContent = JSON.stringify(responseJson, null, 2);
    else telemetryResponseEl.textContent = responseText || "";
  }

  if (error) {
    if (telemetryErrorCardEl) telemetryErrorCardEl.style.display = "block";
    if (telemetryErrorEl) telemetryErrorEl.textContent = String(error);
  }
}

// ============================================================
// HISTORY
// ============================================================

function renderHistory() {
  if (!historyListEl) return;

  const filter = (historyModeFilterEl && historyModeFilterEl.value) || "all";
  const list = historyEntries.filter((e) => (filter === "all" ? true : e.mode === filter));

  historyListEl.innerHTML = "";
  if (list.length === 0) {
    const empty = document.createElement("div");
    empty.className = "history-empty";
    empty.textContent = "Sem histórico.";
    historyListEl.appendChild(empty);
    return;
  }

  list.forEach((entry) => {
    const item = document.createElement("div");
    item.className = "history-item";

    const meta = document.createElement("div");
    meta.className = "history-meta";
    meta.textContent = `${entry.ts} • ${entry.mode.toUpperCase()} • ${entry.ok ? "OK" : "FAIL"} • ${entry.latencyMs} ms`;

    const detail = document.createElement("pre");
    detail.className = "history-detail";
    detail.textContent = safeStringify(entry.responseJson || entry.responseText || entry.rawPayload, 2);

    const actions = document.createElement("div");
    actions.className = "history-actions";

    const resendBtn = document.createElement("button");
    resendBtn.classList.add("resend-btn");
    resendBtn.textContent = "Reenviar";
    resendBtn.onclick = () => {
      try {
        userInputEl.value =
          entry.rawPayload.message || JSON.stringify(entry.rawPayload);
      } catch (_) {}
    };

    const copyBtn = document.createElement("button");
    copyBtn.classList.add("resend-btn");
    copyBtn.textContent = "Copiar";
    copyBtn.onclick = async () => {
      const toCopy = safeStringify(entry.rawPayload, 2);
      await navigator.clipboard.writeText(toCopy);
      appendSystemMessage("Payload copiado para a área de transferência.");
    };

    actions.appendChild(resendBtn);
    actions.appendChild(copyBtn);

    item.appendChild(meta);
    item.appendChild(actions);
    item.appendChild(detail);

    historyListEl.appendChild(item);
  });
}

function exportHistory() {
  const blob = new Blob([JSON.stringify(historyEntries, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `nv-control-history-${Date.now()}.json`;
  a.click();

  URL.revokeObjectURL(url);
  appendSystemMessage("Histórico exportado.");
}

// ============================================================
// COPY BUTTONS
// ============================================================

function bindCopyButtons() {
  const btns = document.querySelectorAll(".copy-btn");
  btns.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const targetId = btn.getAttribute("data-copy-target");
      if (!targetId) return;
      const el = document.getElementById(targetId);
      if (!el) return;
      const text = el.textContent || "";
      try {
        await navigator.clipboard.writeText(text);
        appendSystemMessage("Copiado para a área de transferência.");
      } catch (err) {
        appendSystemMessage("Falha ao copiar.");
        console.error(err);
      }
    });
  });
}

// ============================================================
// UTIL
// ============================================================

function safeStringify(obj, spaces = 2) {
  try {
    if (typeof obj === "string") return obj;
    return JSON.stringify(obj, null, spaces);
  } catch (e) {
    return String(obj);
  }
}

function extractAssistantMessage(responseJson, responseText) {
  // tenta pegar mensagens comuns da resposta do worker/executor
  if (responseJson) {
    if (typeof responseJson === "string") return responseJson;
    if (responseJson.message) return String(responseJson.message);
    if (responseJson.result && typeof responseJson.result === "string") return responseJson.result;
    if (responseJson.result && responseJson.result.message) return String(responseJson.result.message);
    if (responseJson.executor && responseJson.executor.message) return String(responseJson.executor.message);
    if (responseJson.executor && responseJson.executor.result && responseJson.executor.result.message) {
      return String(responseJson.executor.result.message);
    }
    // fallback: stringify curto
    return JSON.stringify(responseJson, null, 2);
  }
  return responseText || "(sem resposta)";
}
