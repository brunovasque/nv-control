/* ==========================================================================
   NV-Control — ENAVIA
   script.js — FINAL DEFINITIVO (ENGINEER + ACTION)
   ========================================================================== */

const state = {
  mode: "engineer",
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

function setStatus(text) {
  qs("status-badge").textContent = text;
}

function currentWorkerId() {
  return state.env === "test" ? state.workerIdTest : state.workerIdReal;
}

/* ============================ INIT ============================ */

(function init() {
  const url = localStorage.getItem("nv_worker_url");
  const testId = localStorage.getItem("nv_worker_test");
  const realId = localStorage.getItem("nv_worker_real");

  if (url) {
    state.workerUrl = url.replace(/\/$/, "");
    qs("workerUrlInput").value = state.workerUrl;
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

/* ============================ PAYLOAD ============================ */

function buildPayload(action) {
  return {
    source: "NV-CONTROL",
    env_mode: "supervised",
    mode: state.mode,
    debug: state.debug,
    timestamp: nowISO(),
    action: {
      workerId: currentWorkerId(),
      ...action,
    },
  };
}

/* ============================ NETWORK ============================ */

async function sendAction(action) {
  if (!state.workerUrl) {
    setStatus("Defina o Worker URL");
    return;
  }

  const payload = buildPayload(action);
  state.lastRequest = payload;
  updateTelemetry();
  setStatus("Enviando…");

  try {
    const res = await fetch(`${state.workerUrl}/engineer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    state.lastResponse = json;

    if (json?.executor?.result?.execution_id) {
      state.executionId = json.executor.result.execution_id;
    }

    setStatus("OK");
    updateTelemetry();
    appendHistory(action.executor_action || "message");
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

function appendHistory(action) {
  const el = document.createElement("div");
  el.className = "history-item";
  el.textContent = `[ENGINEER] ${action}`;
  qs("history-list").appendChild(el);
}

/* ============================ INPUTS ============================ */

qs("workerUrlInput").oninput = (e) => {
  state.workerUrl = e.target.value.replace(/\/$/, "");
  localStorage.setItem("nv_worker_url", state.workerUrl);
  setStatus("Conectado");
};

qs("workerIdTestInput").oninput = (e) => {
  state.workerIdTest = e.target.value;
  localStorage.setItem("nv_worker_test", state.workerIdTest);
};

qs("workerIdRealInput").oninput = (e) => {
  state.workerIdReal = e.target.value;
  localStorage.setItem("nv_worker_real", state.workerIdReal);
};

qs("envSelect").onchange = (e) => (state.env = e.target.value);
qs("debugToggle").onchange = (e) => (state.debug = e.target.checked);

/* ============================ PIPELINE CANÔNICO ============================ */

qs("canonAuditBtn").onclick = () =>
  sendAction({ executor_action: "audit" });

qs("canonProposeBtn").onclick = () =>
  sendAction({ executor_action: "propose" });

qs("canonApplyTestBtn").onclick = () =>
  state.executionId &&
  sendAction({
    executor_action: "apply_test",
    execution_id: state.executionId,
  });

qs("canonDeployTestBtn").onclick = () =>
  state.executionId &&
  sendAction({
    executor_action: "deploy_test",
    execution_id: state.executionId,
  });

qs("canonApproveBtn").onclick = () =>
  state.executionId &&
  sendAction({
    executor_action: "deploy_approve",
    execution_id: state.executionId,
    approve: true,
  });

qs("canonPromoteRealBtn").onclick = () =>
  state.executionId &&
  sendAction({
    executor_action: "promote_real",
    execution_id: state.executionId,
  });

qs("canonCancelBtn").onclick = () =>
  state.executionId &&
  sendAction({
    executor_action: "deploy_cancel",
    execution_id: state.executionId,
  });

qs("canonRollbackBtn").onclick = () =>
  sendAction({ executor_action: "rollback" });

/* ============================ LIMPAR ============================ */

qs("clearAllBtn").onclick = () => {
  qs("messages").innerHTML = "";
  qs("history-list").innerHTML = "";
  qs("telemetry-request").textContent = "";
  qs("telemetry-response").textContent = "";
  qs("advanced-raw").textContent = "";
  state.executionId = null;
};
