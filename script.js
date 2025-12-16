/* ==========================================================================
   NV-Control — ENAVIA
   script.js (FINAL • OPERACIONAL • CANÔNICO)
   ========================================================================== */

/* ============================ ESTADO GLOBAL ============================ */

const state = {
  mode: "director",
  debug: true,
  env: "test",
  workerUrl: "",
  workerIdTest: "",
  workerIdReal: "",
  executionId: null,
  lastRequest: null,
  lastResponse: null,
};

/* ============================ HELPERS ============================ */

const qs = (id) => document.getElementById(id);
const nowISO = () => new Date().toISOString();

function logMessage(text) {
  const el = document.createElement("div");
  el.className = "msg";
  el.textContent = text;
  qs("messages").appendChild(el);
  qs("messages").scrollTop = qs("messages").scrollHeight;
}

function setStatus(text) {
  qs("status-badge").textContent = text;
}

function currentWorkerId() {
  return state.env === "test" ? state.workerIdTest : state.workerIdReal;
}

/* ============================ INIT (AUTO-CONFIG) ============================ */

(function init() {
  const url = localStorage.getItem("nv_worker_url");
  const testId = localStorage.getItem("nv_worker_test");
  const realId = localStorage.getItem("nv_worker_real");

  if (url) {
    state.workerUrl = url;
    qs("workerUrlInput").value = url;
  }

  if (testId) {
    state.workerIdTest = testId;
    qs("workerIdTestInput").value = testId;
  }

  if (realId) {
    state.workerIdReal = realId;
    qs("workerIdRealInput").value = realId;
  }

  setStatus(state.workerUrl ? "Conectado" : "Sem Worker");
})();

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
    setStatus("Defina o Worker URL");
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

    setStatus("OK");
    updateTelemetry();
    appendHistory(payload);
  } catch (err) {
    setStatus("Erro");
    qs("telemetry-error").textContent = String(err);
    qs("telemetry-error-card").style.display = "block";
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

/* ============================ HISTÓRICO ============================ */

function appendHistory(req) {
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
  qs(`mode${mode[0].toUpperCase()}${mode.slice(1)}Btn`).classList.add("active");
}

/* ============================ TABS ============================ */

document.querySelectorAll(".tab").forEach((tab) => {
  tab.onclick = () => {
    document
      .querySelectorAll(".tab, .tab-panel")
      .forEach((el) => el.classList.remove("active"));
    tab.classList.add("active");
    qs(`panel-${tab.dataset.tab}`).classList.add("active");
  };
});

/* ============================ INPUTS ============================ */

qs("workerUrlInput").oninput = (e) => {
  state.workerUrl = e.target.value.trim();
  localStorage.setItem("nv_worker_url", state.workerUrl);
  setStatus(state.workerUrl ? "Conectado" : "Sem Worker");
};

qs("workerIdTestInput").oninput = (e) => {
  state.workerIdTest = e.target.value.trim();
  localStorage.setItem("nv_worker_test", state.workerIdTest);
};

qs("workerIdRealInput").oninput = (e) => {
  state.workerIdReal = e.target.value.trim();
  localStorage.setItem("nv_worker_real", state.workerIdReal);
};

qs("envSelect").onchange = (e) => (state.env = e.target.value);
qs("debugToggle").onchange = (e) => (state.debug = e.target.checked);

/* ============================ SEND ============================ */

qs("sendBtn").onclick = () => {
  const text = qs("userInput").value.trim();
  if (!text) return;

  sendToWorker(basePayload({ message: text }));
  qs("userInput").value = "";
};

/* ============================ PIPELINE ============================ */

qs("canonAuditBtn").onclick = () =>
  sendToWorker(basePayload({ executor_action: "audit" }));

qs("canonProposeBtn").onclick = () =>
  sendToWorker(basePayload({ executor_action: "propose" }));

qs("canonApplyTestBtn").onclick = () =>
  state.executionId &&
  sendToWorker(
    basePayload({
      executor_action: "apply_test",
      execution_id: state.executionId,
    })
  );

qs("canonDeployTestBtn").onclick = () =>
  state.executionId &&
  sendToWorker(
    basePayload({
      executor_action: "deploy_test",
      execution_id: state.executionId,
    })
  );

qs("canonApproveBtn").onclick = () =>
  state.executionId &&
  sendToWorker(
    basePayload({
      executor_action: "deploy_approve",
      execution_id: state.executionId,
      approve: true,
    })
  );

qs("canonPromoteRealBtn").onclick = () =>
  state.executionId &&
  sendToWorker(
    basePayload({
      executor_action: "promote_real",
      execution_id: state.executionId,
    })
  );

qs("canonCancelBtn").onclick = () =>
  state.executionId &&
  sendToWorker(
    basePayload({
      executor_action: "deploy_cancel",
      execution_id: state.executionId,
    })
  );

qs("canonRollbackBtn").onclick = () =>
  sendToWorker(basePayload({ executor_action: "rollback" }));

/* ============================ LIMPAR ============================ */

qs("clearAllBtn").onclick = () => {
  qs("messages").innerHTML = "";
  qs("history-list").innerHTML = "";
  qs("telemetry-request").textContent = "";
  qs("telemetry-response").textContent = "";
  qs("advanced-raw").textContent = "";
  state.executionId = null;
};
