/* ==========================================================================
   NV-Control — ENAVIA
   script.js (CANÔNICO)
   Painel limpo • Zero duplicação • Payloads corretos
   ========================================================================== */

/* ============================ ESTADO GLOBAL ============================ */

const state = {
  mode: "director",
  debug: true,
  env: "test", // test | real
  workerUrl: "",
  workerIdTest: "",
  workerIdReal: "",
  executionId: null,
  lastRequest: null,
  lastResponse: null,
};

/* ============================ HELPERS ============================ */

function qs(id) {
  return document.getElementById(id);
}

function nowISO() {
  return new Date().toISOString();
}

function logMessage(text, type = "info") {
  const el = document.createElement("div");
  el.className = `msg msg-${type}`;
  el.textContent = text;
  qs("messages").appendChild(el);
  qs("messages").scrollTop = qs("messages").scrollHeight;
}

function setStatus(text, variant = "neutral") {
  const badge = qs("status-badge");
  badge.textContent = text;
  badge.className = `badge badge-${variant}`;
}

function currentWorkerId() {
  return state.env === "test" ? state.workerIdTest : state.workerIdReal;
}

/* ============================ PAYLOAD BASE ============================ */

function basePayload(extra = {}) {
  return {
    source: "NV-CONTROL",
    env_mode: "supervised",
    mode: state.mode,
    debug: state.debug,
    timestamp: nowISO(),
    workerId: currentWorkerId(),
    ...extra,
  };
}

/* ============================ NETWORK ============================ */

async function sendToWorker(payload) {
  if (!state.workerUrl) {
    alert("Worker URL não definido.");
    return;
  }

  state.lastRequest = payload;
  updateTelemetry();

  setStatus("Enviando…");

  try {
    const res = await fetch(state.workerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    state.lastResponse = json;

    if (json.execution_id) {
      state.executionId = json.execution_id;
    }

    setStatus("OK", "neutral");
    logMessage("✔ Resposta recebida", "ok");

    updateTelemetry();
    appendHistory(payload, json);
  } catch (err) {
    setStatus("Erro", "error");
    logMessage(`✖ Erro: ${err.message}`, "error");
    showError(err);
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
  const card = qs("telemetry-error-card");
  qs("telemetry-error").textContent = String(err);
  card.style.display = "block";
}

/* ============================ HISTÓRICO ============================ */

function appendHistory(req, res) {
  const item = document.createElement("div");
  item.className = "history-item";
  item.textContent = `[${req.mode}] ${req.executor_action || "message"}`;
  qs("history-list").appendChild(item);
}

/* ============================ MODOS ============================ */

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

/* ============================ TABS ============================ */

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document
      .querySelectorAll(".tab, .tab-panel")
      .forEach((el) => el.classList.remove("active"));

    tab.classList.add("active");
    qs(`panel-${tab.dataset.tab}`).classList.add("active");
  });
});

/* ============================ ENV ============================ */

qs("envSelect").addEventListener("change", (e) => {
  state.env = e.target.value;
  logMessage(`Ambiente selecionado: ${state.env.toUpperCase()}`);
});

/* ============================ INPUTS ============================ */

qs("workerUrlInput").addEventListener(
  "input",
  (e) => (state.workerUrl = e.target.value)
);

qs("workerIdTestInput").addEventListener(
  "input",
  (e) => (state.workerIdTest = e.target.value)
);

qs("workerIdRealInput").addEventListener(
  "input",
  (e) => (state.workerIdReal = e.target.value)
);

qs("debugToggle").addEventListener(
  "change",
  (e) => (state.debug = e.target.checked)
);

/* ============================ SEND ============================ */

qs("sendBtn").addEventListener("click", () => {
  const text = qs("userInput").value.trim();
  if (!text) return;

  sendToWorker(
    basePayload({
      message: text,
    })
  );

  qs("userInput").value = "";
});

/* ============================ PIPELINE CANÔNICO ============================ */

// AUDIT
qs("canonAuditBtn").addEventListener("click", () => {
  sendToWorker(
    basePayload({
      executor_action: "audit",
    })
  );
});

// PROPOSE
qs("canonProposeBtn").addEventListener("click", () => {
  sendToWorker(
    basePayload({
      executor_action: "propose",
    })
  );
});

// APPLY TEST
qs("canonApplyTestBtn").addEventListener("click", () => {
  if (!state.executionId) {
    alert("Nenhum execution_id ativo.");
    return;
  }

  sendToWorker(
    basePayload({
      executor_action: "apply_test",
      execution_id: state.executionId,
    })
  );
});

// DEPLOY TESTE
qs("canonDeployTestBtn").addEventListener("click", () => {
  if (!state.executionId) {
    alert("Nenhum execution_id ativo.");
    return;
  }

  sendToWorker(
    basePayload({
      executor_action: "deploy_test",
      execution_id: state.executionId,
    })
  );
});

// APPROVE
qs("canonApproveBtn").addEventListener("click", () => {
  if (!state.executionId) {
    alert("Nenhum execution_id ativo.");
    return;
  }

  sendToWorker(
    basePayload({
      executor_action: "deploy_approve",
      execution_id: state.executionId,
      approve: true,
    })
  );
});

// PROMOTE REAL
qs("canonPromoteRealBtn").addEventListener("click", () => {
  if (!state.executionId) {
    alert("Nenhum execution_id ativo.");
    return;
  }

  if (!confirm("Confirmar PROMOÇÃO PARA PRODUÇÃO?")) return;

  sendToWorker(
    basePayload({
      executor_action: "promote_real",
      execution_id: state.executionId,
    })
  );
});

// CANCELAR
qs("canonCancelBtn").addEventListener("click", () => {
  if (!state.executionId) {
    alert("Nenhum execution_id ativo.");
    return;
  }

  sendToWorker(
    basePayload({
      executor_action: "deploy_cancel",
      execution_id: state.executionId,
    })
  );
});

// ROLLBACK
qs("canonRollbackBtn").addEventListener("click", () => {
  if (!confirm("Rollback emergencial?")) return;

  sendToWorker(
    basePayload({
      executor_action: "rollback",
    })
  );
});

/* ============================ LIMPEZA ============================ */

qs("clearAllBtn").addEventListener("click", () => {
  qs("messages").innerHTML = "";
  qs("history-list").innerHTML = "";
  qs("telemetry-request").textContent = "";
  qs("telemetry-response").textContent = "";
  qs("advanced-raw").textContent = "";
  state.executionId = null;
  logMessage("Console limpo");
});

/* ============================ MODES BUTTONS ============================ */

qs("modeDirectorBtn").onclick = () => setMode("director");
qs("modeEnaviaBtn").onclick = () => setMode("enavia");
qs("modeEngineerBtn").onclick = () => setMode("engineer");
qs("modeBrainBtn").onclick = () => setMode("brain");
