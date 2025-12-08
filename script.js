// =======================================
// CONFIGURAÇÃO
// =======================================

const NV_WORKER_URL = "https://nv-enavia.brunovasque.workers.dev";

// Seletores
const chatLogEl = document.getElementById("chat-log");
const jsonLogEl = document.getElementById("json-log");
const inputEl = document.getElementById("input");
const sendBtn = document.getElementById("send-btn");
const engineerBtn = document.getElementById("engineer-btn");
const deployBtn = document.getElementById("deploy-btn");
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

// Dropdown de deploy
const deployDropdownContainer = document.querySelector(".deploy-dropdown");
const deployDropdownToggle    = document.getElementById("deploy-toggle");

// Estado interno
let currentMode = "chat"; // "chat" ou "engineer"
let lastEngineeringResult = null; // guarda último resultado de engenharia
let lastDeploySessionId = null;

// Base de payload para telemetria
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
  } catch (e) {
    pre.textContent = String(obj);
  }

  if (color) {
    header.style.color = color;
  }

  wrapper.appendChild(header);
  wrapper.appendChild(pre);

  jsonLogEl.insertBefore(wrapper, jsonLogEl.firstChild);

  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(pre.textContent).catch(() => {});
  });
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
  } else {
    modeBadgeEl.textContent = "Modo: ENGENHARIA (patch/telemetria)";
    modeBadgeEl.className = "mode-badge mode-engineer";
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
    if (!enabled) {
      b.classList.add("btn-disabled");
    } else {
      b.classList.remove("btn-disabled");
    }
  });
}

// =======================================
// FUNÇÃO GENÉRICA DE CHAMADA
// =======================================

async function callNvFirst(path, payload) {
  const fullPayload = {
    ...BASE_PAYLOAD,
    ...payload,
  };

  appendJsonLog("REQUEST /" + (path || ""), fullPayload, "#60a5fa");

  setStatusText("Enviando requisição para ENAVIA...", "#facc15");
  setDeployButtonsEnabled(false);

  try {
    const res = await fetch(NV_WORKER_URL + (path || "/"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(fullPayload),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      appendJsonLog("ERRO HTTP " + res.status, data || {}, "#f87171");
      setStatusText("Erro HTTP na chamada. Veja painel técnico.", "#f87171");
      return {
        ok: false,
        error: "HTTP " + res.status,
        raw: data,
      };
    }

    appendJsonLog("RESPONSE /" + (path || ""), data, "#34d399");

    if (!data) {
      setStatusText("Resposta vazia do Worker.", "#f97316");
      return {
        ok: false,
        error: "Resposta vazia",
      };
    }

    setStatusText("Resposta recebida da ENAVIA.", "#4ade80");
    return data;
  } catch (err) {
    appendJsonLog("EXCEÇÃO FETCH", { message: err.message }, "#f87171");
    setStatusText("Falha de conexão com o Worker.", "#f87171");
    return {
      ok: false,
      error: "Falha de conexão: " + err.message,
    };
  } finally {
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

  const payload = {
    mode: "chat",
    message: text,
    debug: true,
  };

  const result = await callNvFirst("/", payload);

  if (!result) {
    appendChatMessage("Sistema", "Resposta vazia.", { color: "#f87171" });
    return;
  }

  if (result.output) {
    appendChatMessage("ENAVIA", result.output, {
      color: result.ok ? "#4ade80" : "#f97316",
    });
  } else if (result.result && result.result.message) {
    appendChatMessage("ENAVIA", result.result.message, {
      color: result.ok ? "#4ade80" : "#f97316",
    });
  } else {
    appendChatMessage("ENAVIA", "[sem output textual]", {
      color: "#e5e7eb",
    });
  }
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
  if (result && result.deploy && result.deploy.session_id) {
    lastDeploySessionId = result.deploy.session_id;
  }

  if (!result) {
    appendChatMessage("Sistema", "Resposta de engenharia vazia.", {
      color: "#f87171",
    });
    return;
  }

  let resumo = "ENGINEER MODE executado.";
  if (result.result && result.result.plan && result.result.plan.summary) {
    resumo = result.result.plan.summary;
  } else if (result.message) {
    resumo = result.message;
  }

  appendChatMessage("ENAVIA (ENG)", resumo, {
    color: result.ok ? "#4ade80" : "#f97316",
  });
}

// =======================================
// FUNÇÕES DE DEPLOY
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

  if (result && result.deploy && result.deploy.session_id) {
    lastDeploySessionId = result.deploy.session_id;
  }

  if (!result) {
    appendChatMessage("Sistema", `[${action}] → resposta vazia.`, {
      color: "#f87171",
    });
    return;
  }

  const msgBase =
    result.result && result.result.message
      ? result.result.message
      : result.message || "Ação de deploy processada.";

  appendChatMessage("ENAVIA (Deploy)", `[${action}] ${msgBase}`, {
    color: result.ok ? "#4ade80" : "#f97316",
  });
}

// Navegação principal (topo)
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
// EVENTOS
// =======================================

sendBtn.addEventListener("click", () => {
  if (currentMode === "chat") {
    handleChatSend();
  } else {
    handleEngineerSend();
  }
});

inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (currentMode === "chat") {
      handleChatSend();
    } else {
      handleEngineerSend();
    }
  }
});

engineerBtn.addEventListener("click", () => {
  if (currentMode === "chat") {
    setMode("engineer");
    appendChatMessage(
      "Sistema",
      "Modo ENGENHARIA ativado. Use frases como: 'Gerar patch do executor core_v2'.",
      { color: "#facc15" }
    );
  } else {
    setMode("chat");
    appendChatMessage("Sistema", "Modo CHAT normal ativado novamente.", {
      color: "#60a5fa",
    });
  }
});

// Botões de deploy no topo
navListar.addEventListener("click", handleListarStaging);
navPatch.addEventListener("click", handleMostrarPatch);
navDiff.addEventListener("click", handleGerarDiff);
navSimular.addEventListener("click", handleSimularDeploy);
navDescartar.addEventListener("click", handleDescartarStaging);

// Botões de deploy dentro do dropdown (redundantes, mas mantemos)
btnListar.addEventListener("click", handleListarStaging);
btnMostrarPatch.addEventListener("click", handleMostrarPatch);
btnGerarDiff.addEventListener("click", handleGerarDiff);
btnSimular.addEventListener("click", handleSimularDeploy);
btnAplicar.addEventListener("click", handleAplicarDeploy);
btnDescartar.addEventListener("click", handleDescartarStaging);

// Dropdown de deploy
deployDropdownToggle.addEventListener("click", () => {
  deployDropdownContainer.classList.toggle("open");
});

// Fecha dropdown clicando fora
document.addEventListener("click", (e) => {
  if (!deployDropdownContainer.contains(e.target) && e.target !== deployDropdownToggle) {
    deployDropdownContainer.classList.remove("open");
  }
});

// =======================================
// INICIALIZAÇÃO
// =======================================

setMode("chat");
setStatusText("Painel pronto — use CHAT normal ou MODO ENGENHARIA.", "#4ade80");

appendChatMessage(
  "Sistema",
  "Console iniciado. Use CHAT normal ou MODO ENGENHARIA. Painel ULTRA de deploy ativado.",
  { color: "#4ade80" }
);

appendJsonLog(
  "STATUS",
  { message: "NV-Control pronto", worker: NV_WORKER_URL, source: BASE_PAYLOAD.source },
  "#a5b4fc"
);
