// =======================================
// CONFIGURAÇÃO
// =======================================

const NV_WORKER_URL = "https://nv-enavia.brunovasque.workers.dev";

// Seletores
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
const btnListar       = document.getElementById("deploy-list-btn");
const btnMostrarPatch = document.getElementById("deploy-show-btn");
const btnGerarDiff    = document.getElementById("deploy-diff-btn");
const btnSimular      = document.getElementById("deploy-dryrun-btn");
const btnAplicar      = document.getElementById("deploy-apply-btn");
const btnDescartar    = document.getElementById("deploy-discard-btn");

// Botões principais do topo
const navListar   = document.getElementById("btn-listar");
const navPatch    = document.getElementById("btn-patch");
const navDiff     = document.getElementById("btn-diff");
const navSimular  = document.getElementById("btn-simular");
const navDescartar = document.getElementById("btn-descartar");

// Tabs
const tabTelemetria = document.getElementById("tab-telemetria");
const tabHistorico  = document.getElementById("tab-historico");

// Dropdown deploy
const deployDropdownContainer = document.querySelector(".deploy-dropdown");
const deployDropdownToggle    = document.getElementById("deploy-toggle");

// Estado interno
let currentMode = "chat"; 
let lastEngineeringResult = null;
let lastDeploySessionId = null;

// Base telemetria
const BASE_PAYLOAD = {
  source: "NV-CONTROL",
  env_mode: "supervised",
};
// =======================================
// FUNÇÕES DE UI
// =======================================

function appendChatMessage(from, text, options = {}) {
  const line = document.createElement("div");
  line.className = "chat-line";

  const senderSpan = document.createElement("span");
  senderSpan.className = "chat-sender";
  senderSpan.textContent = from + ":";

  const textSpan = document.createElement("span");
  textSpan.className = "chat-text";
  textSpan.textContent = text;

  if (options.color) {
    textSpan.style.color = options.color;
  }

  line.appendChild(senderSpan);
  line.appendChild(textSpan);

  chatLogEl.appendChild(line);
  chatLogEl.scrollTop = chatLogEl.scrollHeight;
}

function appendJsonLog(label, obj, color = null) {
  const wrapper = document.createElement("div");
  wrapper.className = "json-block";

  const header = document.createElement("div");
  header.className = "json-header";
  header.textContent = label;

  const copyBtn = document.createElement("button");
  copyBtn.textContent = "Copiar";
  copyBtn.className = "copy-btn";

  header.appendChild(copyBtn);

  const pre = document.createElement("pre");
  pre.className = "json-body";

  try {
    pre.textContent = JSON.stringify(obj, null, 2);
  } catch {
    pre.textContent = String(obj);
  }

  if (color) header.style.color = color;

  wrapper.appendChild(header);
  wrapper.appendChild(pre);

  jsonLogEl.insertBefore(wrapper, jsonLogEl.firstChild);

  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(pre.textContent).catch(() => {});
  });
}

function appendHistory(label, text, color = "#e5e7eb") {
  const block = document.createElement("div");
  block.style.marginBottom = "12px";

  const title = document.createElement("div");
  title.style.fontWeight = "600";
  title.style.color = color;
  title.textContent = label;

  const body = document.createElement("div");
  body.textContent = text;

  block.appendChild(title);
  block.appendChild(body);

  historyLogEl.insertBefore(block, historyLogEl.firstChild);
}

function setStatusText(text, color = null) {
  statusTextEl.textContent = text;
  statusTextEl.style.color = color || "#e5e7eb";
}

function setMode(mode) {
  currentMode = mode;

  if (mode === "chat") {
    modeBadgeEl.textContent = "Modo: CHAT normal";
    modeBadgeEl.className = "mode-badge mode-chat";
  }

  if (mode === "engineer") {
    modeBadgeEl.textContent = "Modo: ENGENHARIA";
    modeBadgeEl.className = "mode-badge mode-engineer";
  }

  if (mode === "brain") {
    modeBadgeEl.textContent = "Modo: BRAIN (treinamento)";
    modeBadgeEl.className = "mode-badge mode-brain";
  }
}

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
    navDescartar,
  ];

  btns.forEach((b) => {
    if (!b) return;
    b.disabled = !enabled;

    if (!enabled) b.classList.add("btn-disabled");
    else b.classList.remove("btn-disabled");
  });
}

// =======================================
// FUNÇÃO GENÉRICA DE CHAMADA
// =======================================

async function callNvFirst(path, payload) {
  const fullPayload = { ...BASE_PAYLOAD, ...payload };

  appendJsonLog("REQUEST /" + (path || ""), fullPayload, "#60a5fa");
  appendHistory("REQUEST", JSON.stringify(fullPayload), "#60a5fa");

  setStatusText("Enviando requisição para ENAVIA...", "#facc15");
  setDeployButtonsEnabled(false);

  try {
    const res = await fetch(NV_WORKER_URL + (path || "/"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fullPayload),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      appendJsonLog("ERRO HTTP " + res.status, data || {}, "#f87171");
      appendHistory("HTTP ERROR", res.status, "#f87171");

      setStatusText("Erro HTTP na chamada.", "#f87171");

      return { ok: false, error: "HTTP " + res.status, raw: data };
    }

    appendJsonLog("RESPONSE /" + (path || ""), data, "#34d399");
    appendHistory("RESPONSE", JSON.stringify(data), "#34d399");

    setStatusText("Resposta recebida da ENAVIA.", "#4ade80");
    return data;

  } catch (err) {
    appendJsonLog("EXCEÇÃO FETCH", { message: err.message }, "#f87171");
    appendHistory("EXCEÇÃO", err.message, "#f87171");

    setStatusText("Falha de conexão com o Worker.", "#f87171");

    return { ok: false, error: err.message };
  }

  finally {
    setDeployButtonsEnabled(true);
  }
}

// =======================================
// CHAT NORMAL
// =======================================

async function handleChatSend() {
  const text = inputEl.value.trim();
  if (!text) return;

  appendChatMessage("Você", text, { color: "#60a5fa" });
  inputEl.value = "";

  const payload = { mode: "chat", message: text, debug: true };

  const result = await callNvFirst("/", payload);

  if (!result) {
    appendChatMessage("Sistema", "Resposta vazia.", { color: "#f87171" });
    return;
  }

  const msg =
    result.output ||
    result?.result?.message ||
    "[sem output textual]";

  appendChatMessage("ENAVIA", msg, {
    color: result.ok ? "#4ade80" : "#f97316",
  });
}

// =======================================
// MODO ENGENHARIA
// =======================================

async function handleEngineerSend() {
  const text = inputEl.value.trim();
  if (!text) return;

  appendChatMessage("Você (ENG)", text, { color: "#facc15" });
  inputEl.value = "";

  const payload = {
    mode: "engineer",
    intent: text,
    askSuggestions: true,
    riskReport: true,
    preventForbidden: true,
  };

  const result = await callNvFirst("/engineer", payload);

  lastEngineeringResult = result || null;

  if (result?.deploy?.session_id) {
    lastDeploySessionId = result.deploy.session_id;
  }

  const resumo =
    result?.result?.plan?.summary ||
    result?.message ||
    "ENGINEER executado.";

  appendChatMessage("ENAVIA (ENG)", resumo, {
    color: result.ok ? "#4ade80" : "#f97316",
  });
}
// =======================================
// MODO BRAIN (TREINAMENTO)
// =======================================

async function handleBrainSend() {
  const text = inputEl.value.trim();
  if (!text) return;

  appendChatMessage("Você (BRAIN)", text, { color: "#a78bfa" });
  inputEl.value = "";

  const payload = {
    mode: "brain",
    content: text,
    training: true,
    debug: true,
    source: BASE_PAYLOAD.source,
  };

  const result = await callNvFirst("/", payload);

  const msg =
    result?.message ||
    result?.result?.message ||
    "Treinamento recebido pela ENAVIA.";

  appendChatMessage("ENAVIA (BRAIN)", msg, {
    color: result?.ok ? "#4ade80" : "#f97316",
  });
}

// =======================================
// FUNÇÕES DE DEPLOY / ENGENHARIA ASSISTIDA
// =======================================

async function engineerAction(action) {
  const payload = {
    mode: "engineer",
    intent: action,
    askSuggestions: false,
    riskReport: true,
    preventForbidden: true,
  };

  if (lastDeploySessionId) {
    payload.deploySessionId = lastDeploySessionId;
  }

  const result = await callNvFirst("/engineer", payload);

  if (result?.deploy?.session_id) {
    lastDeploySessionId = result.deploy.session_id;
  }

  const msgBase =
    result?.result?.message ||
    result?.message ||
    "Ação de deploy processada.";

  appendChatMessage("ENAVIA (Deploy)", `[${action}] ${msgBase}`, {
    color: result?.ok ? "#4ade80" : "#f97316",
  });
}

async function handleListarStaging() {
  await engineerAction("APROVAR DEPLOY: listar staging");
}

async function handleMostrarPatch() {
  await engineerAction("APROVAR DEPLOY: mostrar patch");
}

async function handleGerarDiff() {
  await engineerAction("APROVAR DEPLOY: gerar diff");
}

async function handleSimularDeploy() {
  await engineerAction("APROVAR DEPLOY: simular deploy (dry-run)");
}

async function handleAplicarDeploy() {
  await engineerAction("APROVAR DEPLOY: aplicar deploy");
}

async function handleDescartarStaging() {
  await engineerAction("APROVAR DEPLOY: descartar staging");
}

// =======================================
// TABS: TELEMETRIA / HISTÓRICO / AVANÇADO
// =======================================

const tabAvancado   = document.getElementById("tab-avancado");
const advancedLogEl = document.getElementById("advanced-log");

function activateTab(target) {
  // tabs
  [tabTelemetria, tabHistorico, tabAvancado].forEach((t) => {
    if (!t) return;
    t.classList.remove("active");
  });

  // panels
  jsonLogEl.classList.add("hidden");
  historyLogEl.classList.add("hidden");
  advancedLogEl.classList.add("hidden");

  if (target === "telemetria") {
    tabTelemetria.classList.add("active");
    jsonLogEl.classList.remove("hidden");
  }

  if (target === "historico") {
    tabHistorico.classList.add("active");
    historyLogEl.classList.remove("hidden");
  }

  if (target === "avancado") {
    tabAvancado.classList.add("active");
    advancedLogEl.classList.remove("hidden");
  }
}

tabTelemetria.addEventListener("click", () => activateTab("telemetria"));
tabHistorico.addEventListener("click", () => activateTab("historico"));
tabAvancado.addEventListener("click", () => activateTab("avancado"));

// =======================================
// TELEMETRIA AVANÇADA (A1–A8, DEBUG, ETC.)
// =======================================

// Observa o HISTÓRICO e replica para o painel AVANÇADO
// (filtrando o que for mais relevante)
const historyObserver = new MutationObserver((mutations) => {
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (!(node instanceof HTMLElement)) continue;

      // Estrutura esperada:
      // <div>
      //   <div>LABEL</div>
      //   <div>JSON / texto</div>
      // </div>
      const titleEl = node.firstChild;
      const bodyEl  = node.lastChild;

      if (!titleEl || !bodyEl) continue;

      const label = (titleEl.textContent || "").toUpperCase();
      const bodyText = bodyEl.textContent || "";

      // Só joga para o AVANÇADO o que for:
      // - RESPONSE (resposta do Worker)
      // - ou tiver "telemetry", "debug", "A1", "A2"... no JSON
      const isResponse = label.includes("RESPONSE");
      const isTelemetryLike =
        bodyText.includes("telemetry") ||
        bodyText.includes("debug") ||
        bodyText.includes('"A1"') ||
        bodyText.includes('"A2"') ||
        bodyText.includes('"A3"') ||
        bodyText.includes('"A4"') ||
        bodyText.includes('"A5"') ||
        bodyText.includes('"A6"') ||
        bodyText.includes('"A7"') ||
        bodyText.includes('"A8"');

      if (!isResponse && !isTelemetryLike) continue;

      const clone = node.cloneNode(true);
      clone.classList.add("advanced-block");

      const titleClone = clone.firstChild;
      if (titleClone) {
        titleClone.classList.add("advanced-title");
      }

      advancedLogEl.insertBefore(clone, advancedLogEl.firstChild);
    }
  }
});

historyObserver.observe(historyLogEl, { childList: true });

// =======================================
// DROPDOWN DEPLOY
// =======================================

deployDropdownToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  deployDropdownContainer.classList.toggle("open");
});

// Fecha dropdown clicando fora
document.addEventListener("click", (e) => {
  if (!deployDropdownContainer.contains(e.target)) {
    deployDropdownContainer.classList.remove("open");
  }
});

// =======================================
// EVENTOS PRINCIPAIS
// =======================================

sendBtn.addEventListener("click", () => {
  if (currentMode === "chat") {
    handleChatSend();
  } else if (currentMode === "engineer") {
    handleEngineerSend();
  } else if (currentMode === "brain") {
    handleBrainSend();
  }
});

inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (currentMode === "chat") {
      handleChatSend();
    } else if (currentMode === "engineer") {
      handleEngineerSend();
    } else if (currentMode === "brain") {
      handleBrainSend();
    }
  }
});

// Toggle Engineer
engineerBtn.addEventListener("click", () => {
  if (currentMode !== "engineer") {
    setMode("engineer");
    appendChatMessage(
      "Sistema",
      "Modo ENGENHARIA ativado. Use para planos, patches e deploy assistido.",
      { color: "#facc15" }
    );
  } else {
    setMode("chat");
    appendChatMessage(
      "Sistema",
      "Modo CHAT normal reativado.",
      { color: "#60a5fa" }
    );
  }
});

// Toggle Brain
brainBtn.addEventListener("click", () => {
  if (currentMode !== "brain") {
    setMode("brain");
    appendChatMessage(
      "Sistema",
      "Modo BRAIN ativado. Tudo que você enviar agora será tratado como TREINAMENTO / CONHECIMENTO.",
      { color: "#a78bfa" }
    );
  } else {
    setMode("chat");
    appendChatMessage(
      "Sistema",
      "Modo CHAT normal reativado (saindo do BRAIN).",
      { color: "#60a5fa" }
    );
  }
});

// Botões de deploy no topo
navListar.addEventListener("click", handleListarStaging);
navPatch.addEventListener("click", handleMostrarPatch);
navDiff.addEventListener("click", handleGerarDiff);
navSimular.addEventListener("click", handleSimularDeploy);
navDescartar.addEventListener("click", handleDescartarStaging);

// Botões de deploy dentro do dropdown
btnListar.addEventListener("click", handleListarStaging);
btnMostrarPatch.addEventListener("click", handleMostrarPatch);
btnGerarDiff.addEventListener("click", handleGerarDiff);
btnSimular.addEventListener("click", handleSimularDeploy);
btnAplicar.addEventListener("click", handleAplicarDeploy);
btnDescartar.addEventListener("click", handleDescartarStaging);

// =======================================
// INICIALIZAÇÃO DO PAINEL
// =======================================

setMode("chat");
setStatusText(
  "NV-Control pronto — use CHAT normal, ENGENHARIA ou BRAIN.",
  "#4ade80"
);

appendChatMessage(
  "Sistema",
  "Console NV-Control iniciado. Você pode conversar em modo normal, pedir patches em ENGENHARIA ou treinar a ENAVIA em modo BRAIN.",
  { color: "#4ade80" }
);

appendJsonLog(
  "STATUS",
  {
    message: "NV-Control pronto",
    worker: NV_WORKER_URL,
    source: BASE_PAYLOAD.source,
  },
  "#a5b4fc"
);

appendHistory(
  "STATUS",
  `Painel NV-Control conectado em ${NV_WORKER_URL}`,
  "#a5b4fc"
);

