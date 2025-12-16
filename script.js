/* ==========================================================================
   NV-Control — ENAVIA
   script.js — FINAL ABSOLUTO
   ========================================================================== */

const state = {
  mode: localStorage.getItem("nv_mode") || "director", // director | enavia | engineer | brain
  debug: localStorage.getItem("nv_debug") === "true" ? true : true,
  env: localStorage.getItem("nv_env") || "test",

  workerUrl: localStorage.getItem("nv_worker_url") || "",

  workerIdTest:
    localStorage.getItem("nv_worker_id_test") || "enavia-worker-teste",

  workerIdReal:
    localStorage.getItem("nv_worker_id_real") || "nv-enavia",
   pipelineLocked: false, // 🔒 trava executionId após APPLY TEST

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
    workerId: currentWorkerId(),

    // 🔥 action FLATTENED — contrato canônico
    ...action,
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

/* ============================ CONFIG / INPUTS ============================ */

// Worker URL
qs("workerUrlInput").oninput = (e) => {
  state.workerUrl = e.target.value.replace(/\/$/, "");
  localStorage.setItem("nv_worker_url", state.workerUrl);
  setStatus("Conectado");
};

// Worker ID TEST
qs("workerIdTestInput").oninput = (e) => {
  state.workerIdTest = e.target.value.trim();
  localStorage.setItem("nv_worker_id_test", state.workerIdTest);
};

// Worker ID REAL
qs("workerIdRealInput").oninput = (e) => {
  state.workerIdReal = e.target.value.trim();
  localStorage.setItem("nv_worker_id_real", state.workerIdReal);
};

// Ambiente (TEST / REAL)
qs("envSelect").onchange = (e) => {
  state.env = e.target.value;
  localStorage.setItem("nv_env", state.env);
};

// Debug
qs("debugToggle").onchange = (e) => {
  state.debug = e.target.checked;
  localStorage.setItem("nv_debug", String(state.debug));
};

/* ============================ RESTORE STATE ============================ */

// restaura valores persistidos no carregamento
document.addEventListener("DOMContentLoaded", () => {
  qs("workerUrlInput").value = state.workerUrl;
  qs("workerIdTestInput").value = state.workerIdTest;
  qs("workerIdRealInput").value = state.workerIdReal;
  qs("envSelect").value = state.env;
  qs("debugToggle").checked = state.debug;
});

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

/* ============================ SENDENGINEER ============================ */

async function sendEngineer(action) {
  if (!state.workerUrl) {
    setStatus("Defina o Worker URL");
    return;
  }

  const payload = engineerPayload(action);
  state.lastRequest = payload;
  updateTelemetry();

  try {
    const res = await fetch(`${state.workerUrl}/engineer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    state.lastResponse = json;

// ============================================================
// 🔐 CAPTURA CANÔNICA DO execution_id (STATEFUL)
// ============================================================
const newExecutionId =
  json.execution_id ||
  json?.result?.execution_id ||
  json?.executor?.execution_id ||
  json?.executor?.result?.execution_id ||
  json?.requestId ||
  json?.result?.requestId ||
  json?.executor?.requestId ||
  json?.executor?.result?.requestId ||
  null;

/*
 Regras:
 - audit: só gera executionId se NÃO existir pipeline ativo
 - apply_test: fixa executionId
 - demais ações: nunca sobrescrevem
*/
if (!state.executionId) {
  if (newExecutionId) {
    state.executionId = newExecutionId;
  }
} else if (action.executor_action === "audit") {
  // audit NÃO pode quebrar pipeline ativo
  // só cria novo executionId se o usuário tiver limpado/resetado antes
}
     pipelineLocked: false,

    updateTelemetry();

    // feedback humano no chat
    if (json?.message) {
      logMessage(json.message, "engineer");
    } else if (json?.result) {
      logMessage("Ação executada. Veja detalhes na telemetria.", "engineer");
    }

     // ✅ RETORNO OBRIGATÓRIO PARA await FUNCIONAR
    return json;
     
  } catch (err) {
    showError(err);
    logMessage("Erro ao executar ação técnica.", "system");
  }
}

/* ============================ PIPELINE ============================ */

document.addEventListener("DOMContentLoaded", () => {

  // AUDIT
  qs("canonAuditBtn").onclick = () =>
    sendEngineer({ executor_action: "audit" });

  // PROPOSE
  qs("canonProposeBtn").onclick = () =>
    sendEngineer({ executor_action: "propose" });

  // APPLY TEST (injeta patch fixo de teste)
qs("canonApplyTestBtn").onclick = async () => {
  if (!state.executionId) {
    logMessage("Nenhuma execução ativa.", "system");
    return;
  }

  const testPatch = `
/* ===========================
   ENAVIA TEST PATCH
   =========================== */
const __ENAVIA_BUILD__ = {
  version: "2025.12.16-test",
  build_note: "deploy real test via ENAVIA panel",
};
`;

  // 1️⃣ STAGE PATCH — salva no staging
  await sendEngineer({
    executor_action: "stage_patch",
    execution_id: state.executionId,
    patch: testPatch,
  });

  // 2️⃣ APPLY TEST — consome do staging
  await sendEngineer({
    executor_action: "apply_test",
    execution_id: state.executionId,
    reason: "TEST PATCH — validar deploy real",
  });
};

  // DEPLOY TEST
  qs("canonDeployTestBtn").onclick = () =>
    state.executionId
      ? sendEngineer({
          executor_action: "deploy_test",
          execution_id: state.executionId,
        })
      : logMessage("Nenhuma execução ativa.", "system");

  // APPROVE
  qs("canonApproveBtn").onclick = () =>
    state.executionId
      ? sendEngineer({
          executor_action: "deploy_approve",
          execution_id: state.executionId,
          approve: true,
        })
      : logMessage("Nenhuma execução ativa.", "system");

  // PROMOTE REAL
  qs("canonPromoteRealBtn").onclick = () =>
    state.executionId
      ? sendEngineer({
          executor_action: "promote_real",
          execution_id: state.executionId,
        })
      : logMessage("Nenhuma execução ativa.", "system");

  // CANCEL
  qs("canonCancelBtn").onclick = () =>
    state.executionId
      ? sendEngineer({
          executor_action: "deploy_cancel",
          execution_id: state.executionId,
        })
      : logMessage("Nenhuma execução ativa.", "system");

  // ROLLBACK
  qs("canonRollbackBtn").onclick = () =>
    sendEngineer({ executor_action: "rollback" });

});

/* ============================ LIMPAR ============================ */

qs("clearAllBtn").onclick = () => {
  qs("messages").innerHTML = "";
  qs("history-list").innerHTML = "";
  qs("telemetry-request").textContent = "";
  qs("telemetry-response").textContent = "";
  qs("advanced-raw").textContent = "";
  state.executionId = null;
};

/* ============================ PATCH CANÔNICO — vNEXT (SEM REMOVER LINHAS) ============================ */
/* Objetivos:
   1) Capturar executionId corretamente (requestId / result.requestId etc.)
   2) Evitar sobrescrita acidental via Enter/Enviar durante ações do pipeline
   3) Ativar abas: Telemetria / Execução / Histórico / Avançado
*/

let pipelineLock = false;

function extractExecutionId(json) {
  return (
    json?.execution_id ||
    json?.requestId ||
    json?.result?.execution_id ||
    json?.result?.requestId ||
    json?.executor?.execution_id ||
    json?.executor?.requestId ||
    json?.executor?.result?.execution_id ||
    json?.executor?.result?.requestId ||
    null
  );
}

/* Re-declara sendEngineer (override canônico) — mantém contrato e adiciona captura robusta */
async function sendEngineer(action) {
  if (!state.workerUrl) {
    setStatus("Defina o Worker URL");
    return;
  }

  const payload = engineerPayload(action);
  state.lastRequest = payload;
  updateTelemetry();

  try {
    const res = await fetch(`${state.workerUrl}/engineer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    state.lastResponse = json;

    // captura robusta do execution_id (inclui requestId)
    const ex = extractExecutionId(json);
    if (ex) state.executionId = ex;

    updateTelemetry();

    // feedback humano no chat
    if (json?.message) {
      logMessage(json.message, "engineer");
    } else if (json?.result) {
      logMessage("Ação executada. Veja detalhes na telemetria.", "engineer");
    } else {
      logMessage("Resposta recebida. Veja detalhes na telemetria.", "engineer");
    }
  } catch (err) {
    showError(err);
    logMessage("Erro ao executar ação técnica.", "system");
  }
}

/* Re-binda botão Enviar com lock (override canônico) */
(function bindSendWithLock() {
  const btn = qs("sendBtn");
  if (!btn) return;

  btn.onclick = () => {
    if (pipelineLock) return;

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
})();

/* Tabs: Telemetria / Execução / Histórico / Avançado */
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabKey = btn.dataset.tab; // telemetry | run | history | advanced
      if (!tabKey) return;

      document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));

      btn.classList.add("active");
      const panel = qs(`panel-${tabKey}`);
      if (panel) panel.classList.add("active");
    });
  });
});

/* Pipeline: lock curto para evitar duplicidade e garantir ação determinística */
document.addEventListener("DOMContentLoaded", () => {
  const lock = () => (pipelineLock = true);
  const unlock = () => setTimeout(() => (pipelineLock = false), 250);

  const safe = async (fn) => {
    lock();
    try { await fn(); } finally { unlock(); }
  };

  const auditBtn = qs("canonAuditBtn");
  if (auditBtn) auditBtn.onclick = () => safe(() => sendEngineer({ executor_action: "audit" }));

  const proposeBtn = qs("canonProposeBtn");
  if (proposeBtn) proposeBtn.onclick = () => safe(() => sendEngineer({ executor_action: "propose" }));

  const applyBtn = qs("canonApplyTestBtn");
  if (applyBtn) applyBtn.onclick = () => safe(() => {
    if (!state.executionId) {
      logMessage("Nenhuma execução ativa.", "system");
      return;
    }

    const testPatch = `
/* ===========================
   ENAVIA TEST PATCH
   =========================== */
const __ENAVIA_BUILD__ = {
  version: "2025.12.16-test",
  build_note: "deploy real test via ENAVIA panel",
};
`;

    return sendEngineer({
      executor_action: "apply_test",
      execution_id: state.executionId,
      patch: testPatch,
      reason: "TEST PATCH — validar deploy real",
    });
  });

  const deployTestBtn = qs("canonDeployTestBtn");
  if (deployTestBtn) deployTestBtn.onclick = () => safe(() => {
    return state.executionId
      ? sendEngineer({ executor_action: "deploy_test", execution_id: state.executionId })
      : logMessage("Nenhuma execução ativa.", "system");
  });

  const approveBtn = qs("canonApproveBtn");
  if (approveBtn) approveBtn.onclick = () => safe(() => {
    return state.executionId
      ? sendEngineer({ executor_action: "deploy_approve", execution_id: state.executionId, approve: true })
      : logMessage("Nenhuma execução ativa.", "system");
  });

  const promoteBtn = qs("canonPromoteRealBtn");
  if (promoteBtn) promoteBtn.onclick = () => safe(() => {
    return state.executionId
      ? sendEngineer({ executor_action: "promote_real", execution_id: state.executionId })
      : logMessage("Nenhuma execução ativa.", "system");
  });

  const cancelBtn = qs("canonCancelBtn");
  if (cancelBtn) cancelBtn.onclick = () => safe(() => {
    return state.executionId
      ? sendEngineer({ executor_action: "deploy_cancel", execution_id: state.executionId })
      : logMessage("Nenhuma execução ativa.", "system");
  });

  const rollbackBtn = qs("canonRollbackBtn");
  if (rollbackBtn) rollbackBtn.onclick = () => safe(() => sendEngineer({ executor_action: "rollback" }));
});

/* ============================ FIM PATCH CANÔNICO — vNEXT ============================ */


/* ============================ PATCH CANÔNICO — MODE BADGE + PERSISTÊNCIA ============================ */
/* Re-declara setMode (override canônico) para:
   - Persistir nv_mode
   - Atualizar badge visual (#mode-badge) e classe de cor
*/
function setMode(mode) {
  state.mode = mode;
  localStorage.setItem("nv_mode", mode);

  document.querySelectorAll(".btn-mode").forEach((b) =>
    b.classList.remove("active")
  );

  const btn = qs(`mode${mode[0].toUpperCase()}${mode.slice(1)}Btn`);
  if (btn) btn.classList.add("active");

  const badge = qs("mode-badge");
  if (badge) {
    badge.textContent = mode.toUpperCase();
    badge.classList.remove(
      "badge-mode-director",
      "badge-mode-enavia",
      "badge-mode-engineer",
      "badge-mode-brain"
    );
    badge.classList.add(`badge-mode-${mode}`);
  }

  logMessage(`Modo alterado para ${mode.toUpperCase()}`);
}

/* Restaura modo no carregamento sem depender do HTML default */
document.addEventListener("DOMContentLoaded", () => {
  try { setMode(state.mode || "director"); } catch (_) {}
});
/* ============================ FIM PATCH MODE ============================ */






