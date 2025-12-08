// =======================================
// CONFIGURAÇÃO
// =======================================

const NV_WORKER_URL = "https://nv-enavia.brunovasque.workers.dev";

const BASE_PAYLOAD = {
  source: "NV-CONTROL",
  env_mode: "supervised",
};

// =======================================
// SELETORES
// =======================================

// Chat
const chatLogEl = document.getElementById("chat-log");
const inputEl = document.getElementById("input");
const sendBtn = document.getElementById("send-btn");
const engineerBtn = document.getElementById("engineer-btn");
const brainBtn = document.getElementById("brain-btn");

// Top nav / status
const modeBadgeEl = document.getElementById("mode-badge");
const statusTextEl = document.getElementById("status-text");

// Deploy dropdown
const deployDropdown = document.querySelector(".deploy-dropdown");
const deployToggle = document.getElementById("deploy-toggle");
const btnListar = document.getElementById("deploy-list-btn");
const btnMostrarPatch = document.getElementById("deploy-show-btn");
const btnGerarDiff = document.getElementById("deploy-diff-btn");
const btnSimular = document.getElementById("deploy-dryrun-btn");
const btnAplicar = document.getElementById("deploy-apply-btn");
const btnDescartar = document.getElementById("deploy-discard-btn");

// Top nav ações rápidas
const navListar = document.getElementById("btn-listar");
const navPatch = document.getElementById("btn-patch");
const navDiff = document.getElementById("btn-diff");
const navSimular = document.getElementById("btn-simular");
const navNavDescartar = document.getElementById("btn-descartar");

// Tabs + painéis
const tabTelemetria = document.getElementById("tab-telemetria");
const tabHistorico = document.getElementById("tab-historico");
const tabAvancado = document.getElementById("tab-avancado");

const telemetryLogEl = document.getElementById("telemetry-log");
const historyLogEl = document.getElementById("history-log");
const advancedLogEl = document.getElementById("advanced-log");

// =======================================
// ESTADO INTERNO
// =======================================

let currentMode = "chat"; // chat | engineer | brain
let lastDeploySessionId = null;

// =======================================
// HELPERS DE UI
// =======================================

function setStatus(text, level = "ok") {
  statusTextEl.textContent = text;
  statusTextEl.classList.remove("status-ok", "status-warn", "status-error");
  if (level === "ok") statusTextEl.classList.add("status-ok");
  else if (level === "warn") statusTextEl.classList.add("status-warn");
  else statusTextEl.classList.add("status-error");
}

function setMode(mode) {
  currentMode = mode;
  modeBadgeEl.classList.remove("mode-chat", "mode-engineer", "mode-brain");

  engineerBtn.classList.remove("active");
  brainBtn.classList.remove("active");

  if (mode === "chat") {
    modeBadgeEl.textContent = "Modo: CHAT normal";
    modeBadgeEl.classList.add("mode-chat");
  } else if (mode === "engineer") {
    modeBadgeEl.textContent = "Modo: ENGENHARIA (patch / deploy)";
    modeBadgeEl.classList.add("mode-engineer");
    engineerBtn.classList.add("active");
  } else if (mode === "brain") {
    modeBadgeEl.textContent = "Modo: BRAIN (treinamento)";
    modeBadgeEl.classList.add("mode-brain");
    brainBtn.classList.add("active");
  }
}

function appendChatMessage(from, text, kind = "system") {
  const line = document.createElement("div");
  line.className = "chat-line";

  const senderSpan = document.createElement("span");
  senderSpan.className = "chat-sender";
  senderSpan.textContent = from + ":";

  const textSpan = document.createElement("span");
  textSpan.className = "chat-text";

  switch (kind) {
    case "user":
      line.classList.add("chat-user");
      break;
    case "eng":
      line.classList.add("chat-eng");
      break;
    case "brain":
      line.classList.add("chat-brain");
      break;
    case "enavia":
      line.classList.add("chat-enavia");
      break;
    case "error":
      line.classList.add("chat-error");
      break;
    default:
      line.classList.add("chat-system");
  }

  textSpan.textContent = text;

  line.appendChild(senderSpan);
  line.appendChild(textSpan);
  chatLogEl.appendChild(line);
  chatLogEl.scrollTop = chatLogEl.scrollHeight;
}

// Cards de log

function createLogCard(targetEl, title, obj, options = {}) {
  const { tag = null, tagType = "info" } = options;

  const card = document.createElement("div");
  card.className = "log-card";

  const header = document.createElement("div");
  header.className = "log-card-header";

  const left = document.createElement("div");
  const titleSpan = document.createElement("span");
  titleSpan.className = "log-title";
  titleSpan.textContent = title;
  left.appendChild(titleSpan);

  if (tag) {
    const tagSpan = document.createElement("span");
    tagSpan.className = `log-tag ${tagType}`;
    tagSpan.textContent = tag;
    left.appendChild(tagSpan);
  }

  const copyBtn = document.createElement("button");
  copyBtn.className = "copy-btn";
  copyBtn.textContent = "Copiar";

  header.appendChild(left);
  header.appendChild(copyBtn);

  const body = document.createElement("pre");
  body.className = "log-body";

  try {
    body.textContent =
      typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
  } catch {
    body.textContent = String(obj);
  }

  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(body.textContent).catch(() => {});
  });

  card.appendChild(header);
  card.appendChild(body);

  // último no topo
  targetEl.insertBefore(card, targetEl.firstChild || null);
}

// Tabs

function activateTab(tabName) {
  [tabTelemetria, tabHistorico, tabAvancado].forEach((b) =>
    b.classList.remove("active")
  );
  [telemetryLogEl, historyLogEl, advancedLogEl].forEach((p) =>
    p.classList.remove("active-log")
  );

  if (tabName === "telemetria") {
    tabTelemetria.classList.add("active");
    telemetryLogEl.classList.add("active-log");
  } else if (tabName === "historico") {
    tabHistorico.classList.add("active");
    historyLogEl.classList.add("active-log");
  } else {
    tabAvancado.classList.add("active");
    advancedLogEl.classList.add("active-log");
  }
}

// Habilita/desabilita botões de deploy enquanto requisita

function setDeployButtonsEnabled(enabled) {
  const btns = [
    btnListar,
    btnMostrarPatch,
    btnGerarDiff,
    btnSimular,
    btnAplicar,
    btnDescartar,
    navListar,
    navPatch,
    navDiff,
    navSimular,
    navNavDescartar,
  ];
  btns.forEach((b) => {
    if (!b) return;
    b.disabled = !enabled;
    b.classList.toggle("btn-disabled", !enabled);
  });
}

// =======================================
// CHAMADA GENÉRICA AO WORKER
// =======================================

async function callNvFirst(path, payload, opts = {}) {
  const { label = null } = opts;

  const fullPayload = {
    ...BASE_PAYLOAD,
    ...payload,
  };

  const route = path || "/";

  // Logs
  createLogCard(
    historyLogEl,
    `REQUEST ${route}`,
    fullPayload,
    { tag: "request", tagType: "info" }
  );

  setStatus("Enviando requisição para ENAVIA…", "warn");
  setDeployButtonsEnabled(false);

  try {
    const res = await fetch(NV_WORKER_URL + route, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fullPayload),
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok) {
      createLogCard(
        advancedLogEl,
        `HTTP ERROR ${res.status}`,
        data || {},
        { tag: "erro", tagType: "error" }
      );
      setStatus("Erro HTTP na chamada. Veja o painel técnico.", "error");
      return { ok: false, httpStatus: res.status, raw: data };
    }

    // Logs organizados
    createLogCard(
      historyLogEl,
      `RESPONSE ${route}`,
      data,
      { tag: "response", tagType: data?.ok ? "success" : "error" }
    );

    createLogCard(
      telemetryLogEl,
      label || "STATUS",
      {
        ok: data.ok,
        mode: data.mode || payload.mode,
        stage: data.telemetry?.stage,
        system: data.system,
      },
      { tag: "telemetria", tagType: data.ok ? "success" : "error" }
    );

    createLogCard(
      advancedLogEl,
      `DETAIL ${route}`,
      data,
      { tag: "detalhe", tagType: "info" }
    );

    setStatus(
      data.ok
        ? "Resposta recebida da ENAVIA."
        : "Resposta recebida com erro lógico. Veja telemetria.",
      data.ok ? "ok" : "error"
    );

    return data;
  } catch (err) {
    createLogCard(
      advancedLogEl,
      "EXCEÇÃO FETCH",
      { message: err.message },
      { tag: "erro", tagType: "error" }
    );
    setStatus("Falha de conexão com o Worker.", "error");
    return { ok: false, error: String(err) };
  } finally {
    setDeployButtonsEnabled(true);
  }
}

// =======================================
// HANDLERS DE ENVIO
// =======================================

async function handleChatSend() {
  const text = inputEl.value.trim();
  if (!text) return;

  appendChatMessage("Você", text, "user");
  inputEl.value = "";

  const payload = {
    mode: "chat",
    message: text,
    debug: true,
  };

  const result = await callNvFirst("/", payload, { label: "CHAT" });

  if (!result) {
    appendChatMessage("Sistema", "Resposta vazia.", "error");
    return;
  }

  if (result.output) {
    appendChatMessage("ENAVIA", result.output, result.ok ? "enavia" : "error");
  } else if (result.result && result.result.message) {
    appendChatMessage(
      "ENAVIA",
      result.result.message,
      result.ok ? "enavia" : "error"
    );
  } else {
    appendChatMessage("ENAVIA", "[sem output textual]", "enavia");
  }
}

async function handleEngineerSend() {
  const text = inputEl.value.trim();
  if (!text) return;

  appendChatMessage("Você (ENG)", text, "eng");
  inputEl.value = "";

  const payload = {
    mode: "engineer",
    intent: text,
    askSuggestions: true,
    riskReport: true,
    preventForbidden: true,
  };

  const result = await callNvFirst("/engineer", payload, {
    label: "ENGINEER",
  });

  if (result?.deploy?.session_id) {
    lastDeploySessionId = result.deploy.session_id;
  }

  if (!result) {
    appendChatMessage(
      "Sistema",
      "Resposta de engenharia vazia.",
      "error"
    );
    return;
  }

  let resumo = "ENGINEER executado.";
  if (result.result?.plan?.summary) {
    resumo = result.result.plan.summary;
  } else if (result.message) {
    resumo = result.message;
  }

  appendChatMessage(
    "ENAVIA (ENG)",
    resumo,
    result.ok ? "enavia" : "error"
  );
}

async function handleBrainSend() {
  const text = inputEl.value.trim();
  if (!text) return;

  appendChatMessage("Você (BRAIN)", text, "brain");
  inputEl.value = "";

  const payload = {
    mode: "brain",
    content: text,
    training: true,
  };

  const result = await callNvFirst("/", payload, { label: "BRAIN" });

  if (!result) {
    appendChatMessage(
      "Sistema",
      "Resposta de treinamento vazia.",
      "error"
    );
    return;
  }

  const msg =
    result.message ||
    "Treinamento recebido pela ENAVIA.";
  appendChatMessage(
    "ENAVIA (BRAIN)",
    msg,
    result.ok ? "enavia" : "error"
  );
}

// =======================================
// FUNÇÕES DE DEPLOY (ENGINEERING)
// =======================================

async function engineerAction(actionText) {
  const payload = {
    mode: "engineer",
    intent: actionText,
    askSuggestions: false,
    riskReport: true,
    preventForbidden: true,
  };

  if (lastDeploySessionId) {
    payload.deploySessionId = lastDeploySessionId;
  }

  const result = await callNvFirst("/engineer", payload, {
    label: "DEPLOY",
  });

  if (result?.deploy?.session_id) {
    lastDeploySessionId = result.deploy.session_id;
  }

  const baseMsg =
    result?.result?.message ||
    result?.message ||
    "Ação de deploy processada.";

  appendChatMessage(
    "ENAVIA (Deploy)",
    `[${actionText}] ${baseMsg}`,
    result?.ok ? "enavia" : "error"
  );
}

function handleListarStaging() {
  engineerAction("APROVAR DEPLOY: listar staging");
}
function handleMostrarPatch() {
  engineerAction("APROVAR DEPLOY: mostrar patch");
}
function handleGerarDiff() {
  engineerAction("APROVAR DEPLOY: gerar diff");
}
function handleSimularDeploy() {
  engineerAction("APROVAR DEPLOY: simular deploy (dry-run)");
}
function handleAplicarDeploy() {
  engineerAction("APROVAR DEPLOY: aplicar deploy");
}
function handleDescartarStaging() {
  engineerAction("APROVAR DEPLOY: descartar staging");
}

// =======================================
// EVENTOS
// =======================================

// Enviar
sendBtn.addEventListener("click", () => {
  if (currentMode === "chat") return handleChatSend();
  if (currentMode === "engineer") return handleEngineerSend();
  if (currentMode === "brain") return handleBrainSend();
});

inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (currentMode === "chat") return handleChatSend();
    if (currentMode === "engineer") return handleEngineerSend();
    if (currentMode === "brain") return handleBrainSend();
  }
});

// Toggles de modo
engineerBtn.addEventListener("click", () => {
  if (currentMode === "engineer") {
    setMode("chat");
    appendChatMessage(
      "Sistema",
      "Modo CHAT normal reativado.",
      "system"
    );
  } else {
    setMode("engineer");
    appendChatMessage(
      "Sistema",
      "Modo ENGENHARIA ativado. Use para planos, patches e deploy assistido.",
      "system"
    );
  }
});

brainBtn.addEventListener("click", () => {
  if (currentMode === "brain") {
    setMode("chat");
    appendChatMessage(
      "Sistema",
      "Modo CHAT normal reativado.",
      "system"
    );
  } else {
    setMode("brain");
    appendChatMessage(
      "Sistema",
      "Modo BRAIN ativado. Tudo que você enviar agora será tratado como TREINAMENTO / CONHECIMENTO.",
      "system"
    );
  }
});

// Tabs
tabTelemetria.addEventListener("click", () => activateTab("telemetria"));
tabHistorico.addEventListener("click", () => activateTab("historico"));
tabAvancado.addEventListener("click", () => activateTab("avancado"));

// Deploy dropdown
deployToggle.addEventListener("click", () => {
  deployDropdown.classList.toggle("open");
});

document.addEventListener("click", (e) => {
  if (!deployDropdown.contains(e.target) && e.target !== deployToggle) {
    deployDropdown.classList.remove("open");
  }
});

// Navegação topo
navListar.addEventListener("click", handleListarStaging);
navPatch.addEventListener("click", handleMostrarPatch);
navDiff.addEventListener("click", handleGerarDiff);
navSimular.addEventListener("click", handleSimularDeploy);
navNavDescartar.addEventListener("click", handleDescartarStaging);

// Botões dentro do dropdown
btnListar.addEventListener("click", handleListarStaging);
btnMostrarPatch.addEventListener("click", handleMostrarPatch);
btnGerarDiff.addEventListener("click", handleGerarDiff);
btnSimular.addEventListener("click", handleSimularDeploy);
btnAplicar.addEventListener("click", handleAplicarDeploy);
btnDescartar.addEventListener("click", handleDescartarStaging);

// =======================================
// INICIALIZAÇÃO
// =======================================

setMode("chat");
setStatus(
  "Console NV-Control iniciado. Você pode conversar em modo normal, pedir patches em ENGENHARIA ou treinar a ENAVIA em modo BRAIN.",
  "ok"
);

appendChatMessage(
  "Sistema",
  "Console NV-Control iniciado. Você pode conversar em modo normal, pedir patches em ENGENHARIA ou treinar a ENAVIA em modo BRAIN.",
  "system"
);

createLogCard(
  telemetryLogEl,
  "STATUS",
  {
    message: "NV-Control pronto",
    worker: NV_WORKER_URL,
    source: BASE_PAYLOAD.source,
  },
  { tag: "status", tagType: "info" }
);
