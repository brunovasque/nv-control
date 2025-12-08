// ===============================
// NV-Control Panel Script
// ===============================

// URL DO WORKER NV-ENAVIA
const NV_WORKER_URL = "https://nv-enavia.brunovasque.workers.dev";

// ===============================
// SELETORES (DOM)
// ===============================
const chatLogEl = document.getElementById("chat-log");
const jsonLogEl = document.getElementById("json-log");
const historyLogEl = document.getElementById("history-log");

const inputEl = document.getElementById("input");
const sendBtn = document.getElementById("send-btn");
const engineerBtn = document.getElementById("engineer-btn");
const brainBtn = document.getElementById("brain-btn");

const modeBadgeEl = document.getElementById("mode-badge");
const statusTextEl = document.getElementById("status-text");

// Botões de deploy
const btnListar = document.getElementById("deploy-list-btn");
const btnMostrarPatch = document.getElementById("deploy-show-btn");
const btnGerarDiff = document.getElementById("deploy-diff-btn");
const btnSimular = document.getElementById("deploy-dryrun-btn");
const btnAplicar = document.getElementById("deploy-apply-btn");
const btnDescartar = document.getElementById("deploy-discard-btn");

// Botões principais do topo
const navListar = document.getElementById("btn-listar");
const navPatch = document.getElementById("btn-patch");
const navDiff = document.getElementById("btn-diff");
const navSimular = document.getElementById("btn-simular");
const navDescartar = document.getElementById("btn-descartar");

// Tabs
const tabTelemetryBtn = document.getElementById("tab-telemetry");
const tabHistoryBtn = document.getElementById("tab-history");
const tabAdvancedBtn = document.getElementById("tab-advanced");

const telemetryPanel = document.getElementById("telemetry-panel");
const historyPanel = document.getElementById("history-panel");
const advancedPanel = document.getElementById("advanced-panel");

// Containers dos cards
const telemetryCardsEl = document.getElementById("telemetry-cards");
const historyCardsEl = document.getElementById("history-cards");
const advancedCardsEl = document.getElementById("advanced-cards");

// Badge de modo no topo direito
const headerModeBadge = document.getElementById("header-mode-badge");

// ===============================
// ESTADO GLOBAL
// ===============================
let currentMode = "chat"; // "chat" | "engineer" | "brain"
let lastRequestInfo = null;

// ===============================
// UTILITÁRIOS
// ===============================
function timeNow() {
  return new Date().toISOString().replace("T", " ").replace("Z", "");
}

function appendChatLine(prefix, text, colorClass = "text-slate-100") {
  const line = document.createElement("div");
  line.className = "mb-1 text-sm";
  line.innerHTML = `<span class="font-semibold ${colorClass}">${prefix}</span><span class="text-slate-200"> ${text}</span>`;
  chatLogEl.appendChild(line);
  chatLogEl.scrollTop = chatLogEl.scrollHeight;
}

function setStatus(text, type = "info") {
  statusTextEl.textContent = text;
  statusTextEl.className =
    "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium";

  if (type === "ok") {
    statusTextEl.classList.add("bg-emerald-900/60", "text-emerald-300");
  } else if (type === "error") {
    statusTextEl.classList.add("bg-red-900/60", "text-red-300");
  } else if (type === "warn") {
    statusTextEl.classList.add("bg-amber-900/60", "text-amber-300");
  } else {
    statusTextEl.classList.add("bg-slate-800/80", "text-slate-200");
  }
}

function setModeBadge() {
  headerModeBadge.className =
    "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-800/70 backdrop-blur border border-slate-700/60";

  if (currentMode === "chat") {
    headerModeBadge.textContent = "Modo: CHAT normal";
    headerModeBadge.classList.add("text-emerald-300");
  } else if (currentMode === "engineer") {
    headerModeBadge.textContent = "Modo: ENGENHARIA (patch / deploy)";
    headerModeBadge.classList.add("text-amber-300");
  } else if (currentMode === "brain") {
    headerModeBadge.textContent = "Modo: BRAIN (treinamento)";
    headerModeBadge.classList.add("text-purple-300");
  }
}

// Cria um "card" JSON
function createJsonCard(title, badge, obj, type = "telemetry") {
  const card = document.createElement("div");
  card.className =
    "bg-slate-900/60 border border-slate-800 rounded-xl p-3 mb-3 shadow-sm";

  const header = document.createElement("div");
  header.className = "flex items-center justify-between mb-2";

  const titleSpan = document.createElement("span");
  titleSpan.className = "text-xs font-semibold text-slate-300";
  titleSpan.textContent = title;

  const badgeSpan = document.createElement("span");
  badgeSpan.className =
    "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold";

  if (type === "error") {
    badgeSpan.classList.add("bg-red-900/70", "text-red-200");
  } else if (type === "status") {
    badgeSpan.classList.add("bg-sky-900/70", "text-sky-200");
  } else if (type === "detail") {
    badgeSpan.classList.add("bg-amber-900/70", "text-amber-200");
  } else {
    badgeSpan.classList.add("bg-slate-800/80", "text-slate-200");
  }

  badgeSpan.textContent = badge;

  const copyBtn = document.createElement("button");
  copyBtn.className =
    "text-[10px] px-2 py-0.5 rounded-full border border-slate-700/70 text-slate-300 hover:bg-slate-800/80";
  copyBtn.textContent = "Copiar";
  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
  });

  header.appendChild(titleSpan);
  const rightGroup = document.createElement("div");
  rightGroup.className = "flex items-center gap-2";
  rightGroup.appendChild(badgeSpan);
  rightGroup.appendChild(copyBtn);
  header.appendChild(rightGroup);

  const pre = document.createElement("pre");
  pre.className =
    "text-[11px] leading-[1.25rem] text-slate-200 bg-slate-950/60 rounded-lg p-2 overflow-auto max-h-60";
  pre.textContent = JSON.stringify(obj, null, 2);

  card.appendChild(header);
  card.appendChild(pre);

  return card;
}

function pushTelemetry(obj) {
  if (!obj) return;
  const card = createJsonCard("CHAT", "telemetria", obj, "telemetry");
  telemetryCardsEl.prepend(card);
}

function pushHistoryEntry(title, obj) {
  if (!obj) return;
  const card = createJsonCard(title, "Resposta", obj, "detail");
  historyCardsEl.prepend(card);
}

function pushAdvancedDetail(title, obj) {
  if (!obj) return;
  const card = createJsonCard(title, "detalhe", obj, "detail");
  advancedCardsEl.prepend(card);
}

// ===============================
// CHAMADA AO WORKER
// ===============================
async function sendToWorker(payload, options = {}) {
  const { label = "CHAT" } = options;
  const url = NV_WORKER_URL + "/";

  const reqInfo = {
    url,
    payload,
    mode: currentMode,
    label,
    timestamp: timeNow(),
  };
  lastRequestInfo = reqInfo;

  try {
    setStatus("Enviando requisição ao NV-ENAVIA...", "info");

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const status = resp.status;
    let data = null;
    try {
      data = await resp.json();
    } catch {
      data = null;
    }

    const baseLog = {
      httpStatus: status,
      timestamp: timeNow(),
      mode: currentMode,
      label,
    };

    if (!resp.ok) {
      const errorObj = {
        ...baseLog,
        error: "HTTP ERROR " + status,
        request: payload,
        response: data,
      };

      const errorCard = createJsonCard(
        "HTTP ERROR " + status,
        "erro",
        errorObj,
        "error",
      );
      telemetryCardsEl.prepend(errorCard);

      advancedCardsEl.prepend(
        createJsonCard("DETAIL / erro", "detalhe", errorObj, "error"),
      );

      setStatus("Erro HTTP na chamada. Veja o painel técnico.", "error");
      return { ok: false, error: errorObj };
    }

    const okObj = {
      ...baseLog,
      request: payload,
      response: data,
    };

    const respCard = createJsonCard("CHAT", "telemetria", okObj, "telemetry");
    telemetryCardsEl.prepend(respCard);

    pushHistoryEntry("RESPONSE", data || {});

    if (data && data.telemetry) {
      pushAdvancedDetail("DETAIL / telemetria", data.telemetry);
    }

    setStatus("Resposta recebida da ENAVIA.", "ok");
    return { ok: true, data };
  } catch (err) {
    const errorObj = {
      timestamp: timeNow(),
      mode: currentMode,
      label,
      error: String(err),
      request: payload,
    };

    const card = createJsonCard("HTTP ERROR", "erro", errorObj, "error");
    telemetryCardsEl.prepend(card);
    setStatus("Falha de rede ou erro na chamada ao worker.", "error");
    return { ok: false, error: errorObj };
  }
}

// Wrapper que já injeta alguns metadados
async function callNvFirst(path, payload, options = {}) {
  const fullPayload = {
    ...payload,
    source: "NV-CONTROL",
    env_mode: "supervised",
  };

  // Hoje, sempre enviaremos para "/" (rota única)
  return sendToWorker(fullPayload, options);
}

// ===============================
// MODO CHAT NORMAL
// ===============================
async function handleChatSend() {
  const text = inputEl.value.trim();
  if (!text) return;

  appendChatLine("Você:", text, "text-cyan-300");

  const payload = {
    mode: "chat",
    message: text,
    debug: true,
  };

  const result = await callNvFirst("/", payload, {
    label: "CHAT",
  });

  if (result.ok && result.data) {
    const out = result.data.output || "[sem output textual]";
    appendChatLine("ENAVIA:", out, "text-emerald-300");

    pushTelemetry({
      ok: true,
      mode: "chat",
      stage: "chat",
      system: result.data.system || "ENAVIA-NV-FIRST",
    });

    const statusObj = {
      message: "NV-Control pronto",
      worker: NV_WORKER_URL,
      source: "NV-CONTROL",
    };
    const statusCard = createJsonCard("STATUS", "status", statusObj, "status");
    telemetryCardsEl.appendChild(statusCard);
  }
}

// ===============================
// MODO ENGENHARIA
// ===============================
async function handleEngineerSend() {
  const text = inputEl.value.trim();
  if (!text) return;

  appendChatLine("Você (ENG):", text, "text-amber-300");

  const payload = {
    mode: "engineer",
    intent: text,
    askSuggestions: true,
    riskReport: true,
    preventForbidden: true,
  };

  // 🔁 Agora também vai pela rota "/" (rota única)
  const result = await callNvFirst("/", payload, {
    label: "ENGINEER",
  });

  if (result.ok && result.data) {
    appendChatLine("ENAVIA (ENG):", "ENGINEER executado.", "text-red-400");

    if (result.data) {
      pushHistoryEntry("RESPONSE /engineer", result.data);

      const detailObj = {
        ok: result.data.ok,
        bypass: result.data.bypass,
        mode: result.data.mode,
        result: result.data.result,
        telemetry: result.data.telemetry,
      };
      pushAdvancedDetail("DETAIL /", detailObj);
    }
  }
}

// Fluxo auxiliar para ações de deploy (listar, diff, dryrun, apply, discard)
async function engineerAction(action, extra = {}) {
  const baseIntent = {
    mode: "deploy",
    action,
    ...extra,
  };

  const payload = {
    mode: "engineer",
    intent: JSON.stringify(baseIntent),
    askSuggestions: false,
    riskReport: true,
    preventForbidden: true,
  };

  // 🔁 Também usando rota "/"
  const result = await callNvFirst("/", payload, {
    label: "DEPLOY",
  });

  if (result.ok && result.data) {
    appendChatLine(
      "ENAVIA (ENG):",
      `Ação de deploy "${action}" executada.`,
      "text-red-400",
    );

    pushHistoryEntry(`RESPONSE /deploy (${action})`, result.data);

    const detailObj = {
      ok: result.data.ok,
      bypass: result.data.bypass,
      mode: result.data.mode,
      result: result.data.result,
      telemetry: result.data.telemetry,
    };
    pushAdvancedDetail(`DETAIL /deploy (${action})`, detailObj);
  }
}

// ===============================
// MODO BRAIN (TREINAMENTO)
// ===============================
async function handleBrainSend() {
  const text = inputEl.value.trim();
  if (!text) return;

  appendChatLine("Você (BRAIN):", text, "text-purple-300");

  const payload = {
    mode: "brain",
    content: text,
    training: true,
  };

  const result = await callNvFirst("/", payload, {
    label: "BRAIN",
  });

  if (result.ok && result.data) {
    appendChatLine(
      "ENAVIA (BRAIN):",
      "Treinamento recebido pela ENAVIA.",
      "text-orange-300",
    );

    pushHistoryEntry("RESPONSE /brain", result.data);

    const detailObj = {
      ok: result.data.ok,
      mode: result.data.mode,
      training: true,
      telemetry: result.data.telemetry,
    };
    pushAdvancedDetail("DETAIL /brain", detailObj);
  }
}

// ===============================
// HANDLERS DE BOTÃO / MODO
// ===============================
function setMode(newMode) {
  currentMode = newMode;
  setModeBadge();

  engineerBtn.classList.remove("bg-amber-500", "text-slate-900");
  brainBtn.classList.remove("bg-purple-500", "text-slate-900");
  sendBtn.textContent = "Enviar";

  if (newMode === "chat") {
    appendChatLine(
      "Sistema:",
      "Modo CHAT normal reativado.",
      "text-emerald-300",
    );
  } else if (newMode === "engineer") {
    engineerBtn.classList.add("bg-amber-500", "text-slate-900");
    appendChatLine(
      "Sistema:",
      "Modo ENGENHARIA ativado. Use para planos, patches e deploy assistido.",
      "text-amber-300",
    );
  } else if (newMode === "brain") {
    brainBtn.classList.add("bg-purple-500", "text-slate-900");
    appendChatLine(
      "Sistema:",
      "Modo BRAIN ativado. Tudo que você enviar agora será tratado como TREINAMENTO / CONHECIMENTO.",
      "text-purple-300",
    );
  }
}

// ===============================
// BOTÕES DE DEPLOY (TOPO)
// ===============================
function setDeployButtonsEnabled(enabled) {
  const buttons = [
    btnListar,
    btnMostrarPatch,
    btnGerarDiff,
    btnSimular,
    btnAplicar,
    btnDescartar,
  ];
  buttons.forEach((btn) => {
    if (!btn) return;
    btn.disabled = !enabled;
    if (!enabled) {
      btn.classList.add("opacity-50", "cursor-not-allowed");
    } else {
      btn.classList.remove("opacity-50", "cursor-not-allowed");
    }
  });
}

navListar?.addEventListener("click", () => {
  setMode("engineer");
  engineerAction("list");
});

navPatch?.addEventListener("click", () => {
  setMode("engineer");
  engineerAction("patch");
});

navDiff?.addEventListener("click", () => {
  setMode("engineer");
  engineerAction("diff");
});

navSimular?.addEventListener("click", () => {
  setMode("engineer");
  engineerAction("dryrun");
});

navDescartar?.addEventListener("click", () => {
  setMode("engineer");
  engineerAction("discard");
});

// Botões da seção Deploy (lado direito)
btnListar?.addEventListener("click", () => engineerAction("list"));
btnMostrarPatch?.addEventListener("click", () => engineerAction("patch"));
btnGerarDiff?.addEventListener("click", () => engineerAction("diff"));
btnSimular?.addEventListener("click", () => engineerAction("dryrun"));
btnAplicar?.addEventListener("click", () => engineerAction("apply"));
btnDescartar?.addEventListener("click", () => engineerAction("discard"));

// ===============================
// TABS (TELEMETRIA / HISTÓRICO / AVANÇADO)
// ===============================
function showTab(tab) {
  telemetryPanel.classList.add("hidden");
  historyPanel.classList.add("hidden");
  advancedPanel.classList.add("hidden");

  tabTelemetryBtn.classList.remove(
    "bg-slate-800",
    "text-slate-100",
    "border-slate-700",
  );
  tabHistoryBtn.classList.remove(
    "bg-slate-800",
    "text-slate-100",
    "border-slate-700",
  );
  tabAdvancedBtn.classList.remove(
    "bg-slate-800",
    "text-slate-100",
    "border-slate-700",
  );

  if (tab === "telemetry") {
    telemetryPanel.classList.remove("hidden");
    tabTelemetryBtn.classList.add(
      "bg-slate-800",
      "text-slate-100",
      "border-slate-700",
    );
  } else if (tab === "history") {
    historyPanel.classList.remove("hidden");
    tabHistoryBtn.classList.add(
      "bg-slate-800",
      "text-slate-100",
      "border-slate-700",
    );
  } else if (tab === "advanced") {
    advancedPanel.classList.remove("hidden");
    tabAdvancedBtn.classList.add(
      "bg-slate-800",
      "text-slate-100",
      "border-slate-700",
    );
  }
}

tabTelemetryBtn?.addEventListener("click", () => showTab("telemetry"));
tabHistoryBtn?.addEventListener("click", () => showTab("history"));
tabAdvancedBtn?.addEventListener("click", () => showTab("advanced"));

// ===============================
// EVENTOS PRINCIPAIS
// ===============================
sendBtn?.addEventListener("click", () => {
  if (currentMode === "chat") {
    handleChatSend();
  } else if (currentMode === "engineer") {
    handleEngineerSend();
  } else if (currentMode === "brain") {
    handleBrainSend();
  }
});

inputEl?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendBtn.click();
  }
});

engineerBtn?.addEventListener("click", () => {
  if (currentMode === "engineer") {
    setMode("chat");
  } else {
    setMode("engineer");
  }
});

brainBtn?.addEventListener("click", () => {
  if (currentMode === "brain") {
    setMode("chat");
  } else {
    setMode("brain");
  }
});

// ===============================
// INICIALIZAÇÃO
// ===============================
(function init() {
  setMode("chat");
  showTab("telemetry");

  appendChatLine(
    "Sistema:",
    "Console NV-Control iniciado. Você pode conversar em modo normal, pedir patches em ENGENHARIA ou treinar a ENAVIA em modo BRAIN.",
    "text-emerald-300",
  );

  const statusObj = {
    message: "NV-Control pronto",
    worker: NV_WORKER_URL,
    source: "NV-CONTROL",
  };
  const statusCard = createJsonCard("STATUS", "status", statusObj, "status");
  telemetryCardsEl.appendChild(statusCard);
})();
