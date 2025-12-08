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
