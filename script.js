/* ==========================================================================
   NV-Control — ENAVIA
   script.js — FINAL ABSOLUTO
   ========================================================================== */

const state = {
  mode: "director", // director | enavia | engineer | brain
  debug: true,
  env: "test",
  workerUrl: "",
  workerIdTest: "enavia-worker-teste",
  workerIdReal: "nv-enavia",
  executionId: null,
  lastRequest: null,
  lastResponse: null,
};

/* ============================ HELPERS ============================ */

const qs = (id) => document.getElementById(id);
const nowISO = () => new Date().toISOString();

/* ============================ CHAT MESSAGE ============================ */

function logMessage(text, from = "system") {
  const wrapper = document.createElement("div");
  wrapper.className = `msg msg-${from}`;

  const content = document.createElement("div");
  content.className = "msg-content";
  content.textContent = text;

  const copyBtn = document.createElement("button");
  copyBtn.className = "copy-btn copy-chat-btn";
  copyBtn.textContent = "Copiar";
  copyBtn.dataset.copyText = text;

  copyBtn.onclick = () => {
    const copyText = copyBtn.dataset.copyText || "";

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(copyText).catch(() =>
        fallbackCopy(copyText)
      );
    } else {
      fallbackCopy(copyText);
    }
  };

  wrapper.appendChild(content);
  wrapper.appendChild(copyBtn);

  const messages = qs("messages");
  messages.appendChild(wrapper);
  messages.scrollTop = messages.scrollHeight;
}

/* ============================ STATUS ============================ */

function setStatus(text) {
  qs("status-badge").textContent = text;
}

/* ============================ WORKER ID ============================ */

function currentWorkerId() {
  return state.env === "test" ? state.workerIdTest : state.workerIdReal;
}

/* ============================ COPY FALLBACK ============================ */

function fallbackCopy(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    document.execCommand("copy");
  } catch (_) {
    alert("Não foi possível copiar o conteúdo.");
  }

  document.body.removeChild(textarea);
}

/* ============================ INIT ============================ */

(function init() {
  const url = localStorage.getItem("nv_worker_url");
  if (url) {
    state.workerUrl = url.replace(/\/$/, "");
    qs("workerUrlInput").value = state.workerUrl;
  }
  setStatus(state.workerUrl ? "Conectado" : "Defina o Worker URL");
})();

/* ============================ PAYLOAD BUILDERS ============================ */

function chatPayload(message) {
  return {
    source: "NV-CONTROL",
    mode: state.mode,
    debug: state.debug,
    timestamp: nowISO(),
    message,
  };
}

function engineerPayload(action) {
  return {
    source: "NV-CONTROL",
    env_mode: "supervised",
    mode: "engineer",
    debug: state.debug,
    timestamp: nowISO(),
    action: {
      workerId: currentWorkerId(),
      ...action,
    },
  };
}

/* ============================ NETWORK ============================ */

async function sendChat(message) {
  if (!state.workerUrl) return setStatus("Defina o Worker URL");

  // mensagem do usuário
  logMessage(message, state.mode);

  const payload = chatPayload(message);
  state.lastRequest = payload;
  updateTelemetry();

  try {
    const res = await fetch(state.workerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    state.lastResponse = json;
    updateTelemetry();

    // resposta no chat (humanizada)
    if (json?.output) {
      logMessage(json.output, state.mode);
    } else if (json?.message) {
      logMessage(json.message, state.mode);
    } else {
      logMessage(
        "Resposta recebida. Veja detalhes na telemetria.",
        "system"
      );
    }
  } catch (err) {
    showError(err);
    logMessage("Erro ao comunicar com o sistema.", "system");
  }
}

/* ============================ TELEMETRIA ============================ */

function updateTelemetry() {
  qs("telemetry-request").textContent = state.lastRequest
    ? JSON.stringify(state.lastRequest, null, 2)
    : "";
  qs("telemetry-response").textContent = state.lastResponse
    ? JSON.stringify(state.lastResponse, null, 2)
    : "";
  qs("advanced-raw").textContent = state.lastResponse
    ? JSON.stringify(state.lastResponse, null, 2)
    : "";
}

function showError(err) {
  qs("telemetry-error").textContent = String(err);
  qs("telemetry-error-card").style.display = "block";
}

/* ============================ COPY (TELEMETRIA / AVANÇADO + FALLBACK) ============================ */

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".copy-btn");
  if (!btn) return;

  const targetId = btn.dataset.copyTarget;
  if (!targetId) return;

  const targetEl = document.getElementById(targetId);
  if (!targetEl) return;

  const text = targetEl.textContent || "";

  // Tentativa moderna (HTTPS / localhost)
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
});

function fallbackCopy(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    document.execCommand("copy");
  } catch (_) {
    alert("Não foi possível copiar o conteúdo.");
  }

  document.body.removeChild(textarea);
}

/* ============================ MODES ============================ */

function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll(".btn-mode").forEach((b) =>
    b.classList.remove("active")
  );
  qs(`mode${mode[0].toUpperCase()}${mode.slice(1)}Btn`).classList.add(
    "active"
  );
  logMessage(`Modo alterado para ${mode.toUpperCase()}`);
}

qs("modeDirectorBtn").onclick = () => setMode("director");
qs("modeEnaviaBtn").onclick = () => setMode("enavia");
qs("modeEngineerBtn").onclick = () => setMode("engineer");
qs("modeBrainBtn").onclick = () => setMode("brain");

/* ============================ INPUTS ============================ */

qs("workerUrlInput").oninput = (e) => {
  state.workerUrl = e.target.value.replace(/\/$/, "");
  localStorage.setItem("nv_worker_url", state.workerUrl);
  setStatus("Conectado");
};

qs("envSelect").onchange = (e) => (state.env = e.target.value);
qs("debugToggle").onchange = (e) => (state.debug = e.target.checked);

/* ============================ SEND ============================ */

// Clique no botão Enviar
qs("sendBtn").onclick = () => {
  const text = qs("userInput").value.trim();
  if (!text) return;

  if (state.mode === "engineer") {
    // Engineer envia execução
    sendEngineer({ executor_action: text });
  } else {
    // Director / Enavia / Brain usam chat consultivo
    sendChat(text);
  }

  qs("userInput").value = "";
};

// Teclado do chat
// Enter envia | Shift + Enter quebra linha
qs("userInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    qs("sendBtn").click();
  }
  // Shift + Enter: comportamento padrão do textarea (quebra linha)
});

/* ============================ PIPELINE ============================ */

qs("canonAuditBtn").onclick = () =>
  sendEngineer({ executor_action: "audit" });

qs("canonProposeBtn").onclick = () =>
  sendEngineer({ executor_action: "propose" });

qs("canonApplyTestBtn").onclick = () =>
  state.executionId
    ? sendEngineer({
        executor_action: "apply_test",
        execution_id: state.executionId,
      })
    : logMessage("Nenhuma execução ativa.", "system");

qs("canonDeployTestBtn").onclick = () =>
  state.executionId
    ? sendEngineer({
        executor_action: "deploy_test",
        execution_id: state.executionId,
      })
    : logMessage("Nenhuma execução ativa.", "system");

qs("canonApproveBtn").onclick = () =>
  state.executionId
    ? sendEngineer({
        executor_action: "deploy_approve",
        execution_id: state.executionId,
        approve: true,
      })
    : logMessage("Nenhuma execução ativa.", "system");

qs("canonPromoteRealBtn").onclick = () =>
  state.executionId
    ? sendEngineer({
        executor_action: "promote_real",
        execution_id: state.executionId,
      })
    : logMessage("Nenhuma execução ativa.", "system");

qs("canonCancelBtn").onclick = () =>
  state.executionId
    ? sendEngineer({
        executor_action: "deploy_cancel",
        execution_id: state.executionId,
      })
    : logMessage("Nenhuma execução ativa.", "system");

qs("canonRollbackBtn").onclick = () =>
  sendEngineer({ executor_action: "rollback" });

/* ============================ LIMPAR ============================ */

qs("clearAllBtn").onclick = () => {
  qs("messages").innerHTML = "";
  qs("history-list").innerHTML = "";
  qs("telemetry-request").textContent = "";
  qs("telemetry-response").textContent = "";
  qs("advanced-raw").textContent = "";
  state.executionId = null;
};





