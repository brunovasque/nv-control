/* ============================================================
   script.js — NV-Control / ENAVIA Panel (CANÔNICO)
============================================================ */

import {
  initPanelState,
  getPanelState,
  getExecutionId,
  updatePanelState
} from "./panel-state.js";
import { initButtonsController } from "./buttons-controller.js";
import { initFlowOrchestrator } from "./flow-orchestrator.js";
import { createApiClient } from "./api-client.js";
import { addChatMessage, initChatRenderer } from "./chat-renderer.js";
import { setChatMode, CHAT_MODES } from "./chat-modes.js";

const __DISABLE_LEGACY_BROWSER__ = true;

/* ============================================================
   DIRECTOR ⇄ ENAVIA (API CANÔNICA — READ ONLY)
============================================================ */
let directorApiAdapter = null;

/* ============================================================
   STORAGE KEYS
============================================================ */
const LS = {
  ENAVIA_URL: "nv_enavia_url",
  DEPLOY_URL: "nv_deploy_url",
  INTERNAL_TOKEN: "nv_internal_token",
  DEBUG: "nv_debug",
  ENV: "nv_env",
  LAST_TARGET_WORKERID: "nv_target_workerid",
  LAST_EXECUTION_ID: "nv_execution_id",
  APPROVED_BY: "nv_approved_by",

  // ✅ Browser Adapter (canal separado)
  BROWSER_RUN_URL: "nv_browser_run_url",
};

const DEFAULTS = {
  debug: false,
  env: "test",
  approved_by: "VASQUES",

  // ✅ default do fio do botão (pode sobrescrever via localStorage)
  browser_run_url: "https://run.nv-imoveis.com/execute",
};

function qs(sel) { return document.querySelector(sel); }
function on(el, evt, fn) { if (el) el.addEventListener(evt, fn); }

/* ============================================================
   BROWSER EXECUTOR — CANAL ISOLADO (CANÔNICO)
   ⚠️ DEVE FICAR ANTES DE QUALQUER USO
============================================================ */

async function runBrowserPlan(plan) {
  const runUrl =
  localStorage.getItem("nv_browser_run_url") ||
  "https://run.nv-imoveis.com/browser/run";

  console.debug("[BROWSER EXECUTOR] usando URL:", runUrl);

  // validação mínima e objetiva (contrato)
  if (
    !plan ||
    plan.version !== "plan.v1" ||
    !Array.isArray(plan.steps) ||
    !plan.steps.length
  ) {
    throw new Error("Plano inválido para execução no browser.");
  }

    // ⚠️ PAYLOAD CANÔNICO
  // - /execute  => body = { version, steps }  (igual ao curl)
  // - /browser/run (legado) => body = { plan: { version, steps } }
  const isExecute = /\/execute(\?|$)/.test(runUrl);

  const payload = isExecute
    ? { version: "plan.v1", steps: plan.steps }
    : { plan: { version: "plan.v1", steps: plan.steps } };

  console.debug("[BROWSER → WORKER PAYLOAD]", payload);

  const res = await fetch(runUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const txt = await res.text();
  let data = null;

  try {
    data = JSON.parse(txt);
  } catch (_) {}

  if (!res.ok) {
    throw new Error(data?.error || data?.message || txt);
  }

  return data || { ok: true };
}

window.runBrowserPlan = runBrowserPlan;

/* ============================================================
   UI MAP — CANÔNICO (FALTAVA)
============================================================ */
function ui() {
  return {
    enaviaUrlInput:
      qs("#enaviaUrlInput") ||
      qs("#workerUrlInput") ||
      qs("[data-field='enavia-url']"),

    deployUrlInput:
      qs("#deployUrlInput") ||
      qs("#deployWorkerUrlInput") ||
      qs("[data-field='deploy-url']"),

    tokenInput:
      qs("#internalTokenInput") ||
      qs("#tokenInput") ||
      qs("[data-field='internal-token']"),

    debugToggle:
      qs("#debugToggle") ||
      qs("[data-field='debug']"),

    envSelect:
      qs("#envSelect") ||
      qs("[data-field='env']"),

    executionIdInput:
      qs("#executionIdInput") ||
      qs("#execution_id") ||
      qs("[data-field='execution-id']"),

    targetWorkerIdInput:
      qs("#targetWorkerIdInput") ||
      qs("#workerIdInput") ||
      qs("[data-field='target-workerid']"),

    // 👇 AQUI É O PONTO QUE VAMOS AJUSTAR
    patchTextarea:
      qs("#patchTextarea") ||
      qs("#patchInput") ||
      qs("textarea[data-field='patch']") ||
      qs("textarea[data-field='patch-textarea']"),

    sendBtn:
      qs("#sendBtn") ||
      qs("#sendButton") ||
      qs("[data-action='send']"),

    chatInput:
      qs("#chatInput") ||
      qs("#messageInput") ||
      qs("textarea[data-field='chat-input']"),

    telemetryBox:
      qs("#telemetryBox") ||
      qs("[data-panel='telemetry']"),
  };
}

/* ============================================================
   🧠 PLANO BROWSER — INPUT HUMANO (CANÔNICO)
   - JSON puro
   - Nenhuma interpretação
   - Nenhuma heurística
============================================================ */

function getHumanBrowserPlan() {
  const textarea =
    document.querySelector("#humanBrowserPlan") ||
    document.querySelector("textarea[data-field='human-browser-plan']");

  if (!textarea) return null;

  const raw = String(textarea.value || "").trim();
  if (!raw) return null;

  let plan;
  try {
    plan = JSON.parse(raw);
  } catch (err) {
    throw new Error("Plano Browser inválido: JSON malformado.");
  }

  // validação mínima (contrato)
  if (
    plan.version !== "plan.v1" ||
    !Array.isArray(plan.steps) ||
    !plan.steps.length
  ) {
    throw new Error("Plano Browser inválido: estrutura incompatível com plan.v1.");
  }

  return plan;
}

/* ============================================================
   INIT BOOTSTRAP
============================================================ */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

function boot() {
  initPanelState();
  initButtonsController();
  initChatRenderer(); // 👈 ADICIONE ESTA LINHA AQUI

  hydrateFromLocalStorage();
  bindPersistence();

  const enaviaBaseUrl = mustGetEnaviaUrl();
  const deployBaseUrl = mustGetDeployUrl();

  if (enaviaBaseUrl && deployBaseUrl) {
    const api = createApiClient({
      enaviaBaseUrl,
      deployBaseUrl,
      internalToken: getTokenOrNull(),
      timeoutMs: 20000,
      debug: getDebug(),
    });

    const apiAdapter = buildApiAdapter(api);
    directorApiAdapter = apiAdapter; // 👈 ponte canônica para o Director
    initFlowOrchestrator(apiAdapter);
  }

  seedRuntimeState();

  addChatMessage({
    role: "director",
    text:
      "Painel carregado. Pronto para seguir a ordem canônica: " +
      "Audit → Propose → Apply Test → Deploy Teste → Fix Loop → Approve → Promote Real.",
    typing: true,
  });

  bindSidebarModes();
  bindChatSend();
}

/* ============================================================
   SIDEBAR MODES — LIGAÇÃO CANÔNICA
============================================================ */
function bindSidebarModes() {
  const buttons = document.querySelectorAll(".sidebar-btn[data-mode]");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.getAttribute("data-mode");

      switch (mode) {
        case "director":
          setChatMode(CHAT_MODES.DIRECTOR);
          break;
        case "telemetry":
        case "history":
        case "advanced":
          setChatMode(CHAT_MODES.EXECUTION);
          break;
        default:
          console.warn("[sidebar] Modo desconhecido:", mode);
      }
    });
  });
}

/* ============================================================
   PERSISTÊNCIA
============================================================ */
function hydrateFromLocalStorage() {
  const u = ui();

  const enaviaUrl = localStorage.getItem(LS.ENAVIA_URL) || "";
  const deployUrl = localStorage.getItem(LS.DEPLOY_URL) || "";
  const token = localStorage.getItem(LS.INTERNAL_TOKEN) || "";
  const debug = (localStorage.getItem(LS.DEBUG) || String(DEFAULTS.debug)) === "true";
  const env = localStorage.getItem(LS.ENV) || DEFAULTS.env;

  const execId = localStorage.getItem(LS.LAST_EXECUTION_ID) || "";
  const targetWorkerId = localStorage.getItem(LS.LAST_TARGET_WORKERID) || "";
  const approvedBy = localStorage.getItem(LS.APPROVED_BY) || DEFAULTS.approved_by;

  if (u.enaviaUrlInput) u.enaviaUrlInput.value = enaviaUrl;
  if (u.deployUrlInput) u.deployUrlInput.value = deployUrl;
  if (u.tokenInput) u.tokenInput.value = token;
  if (u.debugToggle) u.debugToggle.checked = debug;
  if (u.envSelect) u.envSelect.value = env;
  if (u.executionIdInput) u.executionIdInput.value = execId;
  if (u.targetWorkerIdInput) u.targetWorkerIdInput.value = targetWorkerId;

  updatePanelState({ approved_by: approvedBy });
}

function bindPersistence() {
  const u = ui();
  on(u.enaviaUrlInput, "input", (e) => localStorage.setItem(LS.ENAVIA_URL, (e.target.value || "").replace(/\/$/, "")));
  on(u.deployUrlInput, "input", (e) => localStorage.setItem(LS.DEPLOY_URL, (e.target.value || "").replace(/\/$/, "")));
  on(u.tokenInput, "input", (e) => localStorage.setItem(LS.INTERNAL_TOKEN, e.target.value || ""));
  on(u.debugToggle, "change", (e) => localStorage.setItem(LS.DEBUG, e.target.checked ? "true" : "false"));
  on(u.envSelect, "change", (e) => localStorage.setItem(LS.ENV, e.target.value || DEFAULTS.env));
  on(u.executionIdInput, "input", (e) => localStorage.setItem(LS.LAST_EXECUTION_ID, e.target.value || ""));
  on(u.targetWorkerIdInput, "input", (e) => localStorage.setItem(LS.LAST_TARGET_WORKERID, e.target.value || ""));
}

function getDebug() {
  return (localStorage.getItem(LS.DEBUG) || "false") === "true";
}
function getTokenOrNull() {
  const t = localStorage.getItem(LS.INTERNAL_TOKEN);
  return typeof t === "string" && t.trim() ? t.trim() : null;
}
function mustGetEnaviaUrl() {
  const v = (localStorage.getItem(LS.ENAVIA_URL) || "").trim();
  return v.replace(/\/$/, "");
}
function mustGetDeployUrl() {
  const v = (localStorage.getItem(LS.DEPLOY_URL) || "").trim();
  return v.replace(/\/$/, "");
}

/* ============================================================
   RUNTIME STATE SEED
============================================================ */
function seedRuntimeState() {
  const u = ui();
  const execution_id = (u.executionIdInput?.value || "").trim() || null;
  const workerId = (u.targetWorkerIdInput?.value || "").trim() || null;

  if (execution_id) updatePanelState({ execution_id });
  if (workerId) updatePanelState({ target: { system: "TARGET_WORKER", workerId } });

  const approved_by = (localStorage.getItem(LS.APPROVED_BY) || DEFAULTS.approved_by).trim();
  updatePanelState({ approved_by });
}

/* ============================================================
   EXECUTION ID (CANÔNICO)
============================================================ */
function getExecutionIdRequired() {
  const execution_id = getExecutionId();

  if (!execution_id) {
    throw new Error("execution_id obrigatório.");
  }

  updatePanelState({ execution_id });
  localStorage.setItem(LS.LAST_EXECUTION_ID, execution_id);

  return execution_id;
}

/* ============================================================
   TARGET WORKER (CANÔNICO)
============================================================ */
function getTargetRequired() {
  const st = getPanelState();

  const workerId =
    st?.target?.workerId ||
    localStorage.getItem("nv_worker_test") ||
    localStorage.getItem("nv_worker_real") ||
    localStorage.getItem(LS.LAST_TARGET_WORKERID);

  if (!workerId) {
    throw new Error("target.workerId obrigatório.");
  }

  // default canônico: mantém o que já funciona
  // opcional: override via localStorage "nv_target_system"
  const system =
    String(localStorage.getItem("nv_target_system") || "TARGET_WORKER").trim() ||
    "TARGET_WORKER";

  const target = {
    system,
    workerId,
  };

  // mantém compatibilidade legada
  updatePanelState({ target });
  localStorage.setItem(LS.LAST_TARGET_WORKERID, workerId);

  return target;
}

/* ============================================================
   PATCH (OBRIGATÓRIO — INPUT HUMANO)
============================================================ */
function getPatchRequired() {
  const u = ui();

  // ✅ SOMENTE campo técnico de patch (nunca usar chatInput)
  const content = String(u.patchTextarea?.value || "").trim();

  if (!content) {
    throw new Error("patch.content obrigatório (cole o patch no campo de PATCH do painel).");
  }

  return {
    type: "patch_text",
    content,
  };
}

/* ============================================================
   APROVAÇÃO (PRODUÇÃO)
============================================================ */
function getApprovedBy() {
  const st = getPanelState();

  const approved_by = String(
    st?.approved_by ||
      localStorage.getItem(LS.APPROVED_BY) ||
      DEFAULTS.approved_by
  ).trim();

  localStorage.setItem(LS.APPROVED_BY, approved_by);

  return approved_by;
}

/* ============================================================
   HUMAN TRANSLATION (Director)
   - Mantém telemetria, mas também fala no chat
============================================================ */
function directorSay(text) {
  addChatMessage({ role: "director", text: String(text || ""), typing: true });
}

function directorReportApi(label, result) {
  // Mensagem humana + curta. Detalhe fica na telemetria.
  if (!result) {
    return directorSay(`${label}: não recebi resposta válida.`);
  }
  if (result.ok) {
    return directorSay(`✅ ${label}: concluído com sucesso.`);
  }
  const err = result.error || "Erro desconhecido";
  return directorSay(`⚠️ ${label}: falhou (${err}). Veja detalhes na telemetria.`);
}

if (!__DISABLE_LEGACY_BROWSER__) {
/*/ ============================================================
// 🌐 BROWSER EXECUTOR — BOTÃO EXCLUSIVO (VIA ISOLADA)
// ============================================================

function renderBrowserExecuteButton() {
  const existing = document.getElementById("browser-execute-btn");
  if (existing) return;

  console.group("🖱️ RENDER BROWSER EXECUTE BUTTON");
  console.log("Já existe botão?", !!existing);
  console.log("Plano disponível:", window.__APPROVED_BROWSER_PLAN__);
  console.trace("Stack render");
  console.groupEnd();

  const container =
  document.querySelector(".executor-actions.executor-actions-secondary") ||
  document.querySelector(".executor-actions") ||
  document.querySelector("#codeExecutorCard");

  if (!container) {
  console.warn("Browser Execute: container de ações não encontrado");
  return;
}

  const btn = document.createElement("button");
  btn.id = "browser-execute-btn";
  btn.textContent = "Executar Browser";
  btn.style.marginLeft = "8px";
  btn.style.padding = "8px 12px";
  btn.style.cursor = "pointer";

    // 🔘 CLICK = EXECUÇÃO
  btn.onclick = async () => {
  console.group("🚀 CLICK EXECUTAR BROWSER");

  const plan = window.__APPROVED_BROWSER_PLAN__;
  console.log("Plano bruto:", plan);

  if (!plan) {
    console.error("❌ Browser Execute: plano inexistente no state");
    console.trace("Click sem plano");
    console.groupEnd();
    return;
  }

  if (typeof runBrowserPlan !== "function") {
    console.error("❌ Browser Execute: runBrowserPlan não está disponível");
    console.groupEnd();
    return;
  }

  const { version, steps } = plan;

  if (version !== "plan.v1" || !Array.isArray(steps) || !steps.length) {
    console.error("❌ Plano inválido para execução no browser:", plan);
    console.groupEnd();
    return;
  }

  console.log("Plano enviado ao Browser:", plan);

  try {
    openLiveOverlay(); // 👁️ ABRE VISUAL AO VIVO (CANÔNICO)

    await runBrowserPlan({
      version,
      steps,
    });

    console.log("✅ Execução enviada com sucesso");
  } catch (err) {
    console.error("❌ Browser execution failed:", err);

    if (typeof directorSay === "function") {
      directorSay(
        "⚠️ A execução do Browser falhou. Vou deixar rearmado pra você tentar de novo / refazer o pedido."
      );
    }
  } finally {
    // 🧹 REARME SOMENTE DO BOTÃO (estado do plano é responsabilidade do executor)
    try {
      btn.remove();
    } catch (_) {}

    console.log("🧹 Botão removido. Plano mantido até execução real.");
    console.groupEnd();
  }
};

container.appendChild(btn);
}

// 👇 ADICIONE IMEDIATAMENTE APÓS A FUNÇÃO
window.__renderBrowserExecuteButton = renderBrowserExecuteButton;

/* ============================================================
   🧠 DIRETOR HUMANO — BOTÃO ISOLADO (MODO B)
   - NÃO usa chat
   - NÃO envia message
   - NÃO envia histórico
   - Apenas sinaliza decisão humana explícita
============================================================ */

function renderHumanDirectorButton() {
  const existing = document.getElementById("human-director-btn");
  if (existing) return;

  const container =
  document.querySelector("#codeExecutorCard") || // 🎯 MODO MANUAL (VISÍVEL)
  document.querySelector(".chat-input-container") ||
  document.querySelector(".chat-input") ||
  document.body;

  if (!container) {
    console.warn("Human Director: container não encontrado");
    return;
  }

  const btn = document.createElement("button");
  btn.id = "human-director-btn";
  btn.textContent = "🧠 Diretor Humano — Aceitar Plano";
  btn.style.marginLeft = "8px";
  btn.style.padding = "8px 12px";
  btn.style.cursor = "pointer";
  btn.style.background = "#2c2c2c";
  btn.style.color = "#fff";
  btn.style.border = "1px solid #555";

  btn.onclick = async () => {
  console.group("🧠 CLICK DIRETOR HUMANO");

  let humanPlan = null;

  try {
    if (typeof getHumanBrowserPlan === "function") {
      humanPlan = getHumanBrowserPlan();
    }
  } catch (err) {
    console.error("❌ Plano humano inválido:", err);
    if (typeof directorSay === "function") {
      directorSay("❌ Plano Browser inválido. Corrija o JSON antes de prosseguir.");
    }
    console.groupEnd();
    return;
  }

  if (!humanPlan) {
    if (typeof directorSay === "function") {
      directorSay("⚠️ Nenhum plano browser encontrado. Cole o plano no campo correto.");
    }
    console.groupEnd();
    return;
  }

  // 🔒 FONTE ÚNICA DO PLANO
  window.__APPROVED_BROWSER_PLAN__ = humanPlan;

  const payload = {
    action: "accept_plan",
    source: "human",
    intent: {
      objective:
        humanPlan?.steps?.[0]?.url ||
        window.__LAST_DIRECTOR_OBJECTIVE__ ||
        "decisão humana explícita",
      notes: "plano browser humano injetado via painel",
    },
  };

  console.log("Payload enviado ao Director:", payload);

  try {
    const res = await fetch("https://run.nv-imoveis.com/director/cognitive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    console.log("Resposta do Director:", data);

    if (data?.decision?.type === "browser_execute_ready") {
      console.log("✅ Diretor humano aceito. Browser pronto.");

       // 🔒 Fonte única do plano (FIX)
  window.__APPROVED_BROWSER_PLAN__ = humanPlan;

// 🔁 garante próximo tick (estado já propagado)
setTimeout(() => {
  if (typeof window.__renderBrowserExecuteButton === "function") {
    window.__renderBrowserExecuteButton();
  }
}, 0);

    } else {
      console.warn("Resposta inesperada do Director:", data);
    }
  } catch (err) {
    console.error("❌ Erro no Diretor Humano:", err);
    if (typeof directorSay === "function") {
      directorSay("⚠️ Falha ao sinalizar decisão humana. Veja o console.");
    }
  } finally {
    console.groupEnd();
  }
};

  container.appendChild(btn);
}

// 🔓 Exposição canônica
window.__renderHumanDirectorButton = renderHumanDirectorButton;

// Render imediato (UX)
try {
  window.__renderHumanDirectorButton();
} catch (_) {}

} // ⬅️⬅️⬅️ FECHA AQUI O if (!__DISABLE_LEGACY_BROWSER__)

/* ============================================================
   FASE V — CODE EXECUTOR (APPLY / ROLLBACK)
   - Usa UI já existente
   - Não interfere em Worker / Browser
============================================================ */

const __CODE_EXECUTOR_STATE__ = {
  lastDryRunId: null,
  lastSnapshotId: null,
};

const codeDiagnoseBtn = document.getElementById("codeDiagnoseBtn");
const codeDryRunBtn = document.getElementById("codeDryRunBtn");
const codeApplyBtn = document.getElementById("codeApplyBtn");
const codeRollbackBtn = document.getElementById("codeRollbackBtn");
const codeExecutorOutput = document.getElementById("codeExecutorOutput");

function renderCodeExecutorState() {
  if (codeApplyBtn)
    codeApplyBtn.disabled = !__CODE_EXECUTOR_STATE__.lastDryRunId;

  if (codeRollbackBtn)
    codeRollbackBtn.disabled = !__CODE_EXECUTOR_STATE__.lastSnapshotId;
}

// 🔒 Persistência canônica — Fase V
(function hydrateCodeExecutorState() {
  try {
    const dryRunId = localStorage.getItem("nv_code_last_dry_run");
    const snapshotId = localStorage.getItem("nv_code_last_snapshot");

    if (dryRunId) __CODE_EXECUTOR_STATE__.lastDryRunId = dryRunId;
    if (snapshotId) __CODE_EXECUTOR_STATE__.lastSnapshotId = snapshotId;
  } catch (_) {}

  renderCodeExecutorState();
})();

// ============================================================
// 📜 HISTÓRICO — CODE EXECUTOR (FASE VI)
// ============================================================

const CODE_HISTORY_KEY = "nv_code_executor_history";
const CODE_HISTORY_LIMIT = 50;

function loadCodeHistory() {
  try {
    return JSON.parse(localStorage.getItem(CODE_HISTORY_KEY)) || [];
  } catch (_) {
    return [];
  }
}

function saveCodeHistory(list) {
  try {
    localStorage.setItem(
      CODE_HISTORY_KEY,
      JSON.stringify(list.slice(0, CODE_HISTORY_LIMIT))
    );
  } catch (_) {}
}

function addCodeHistory(entry) {
  const history = loadCodeHistory();
  history.unshift(entry);
  saveCodeHistory(history);
  renderCodeHistory();
}

function renderCodeHistory() {
  const box = document.getElementById("codeHistoryBox");
  if (!box) return;

  const history = loadCodeHistory();
  if (!history.length) {
    box.textContent = "Sem histórico ainda.";
    return;
  }

  box.innerHTML = history
    .map((h) => {
      const status = h.ok ? "OK" : "FAIL";
      const err = h.error ? ` — ${h.error}` : "";
      const rid = h.run_id ? ` | run: ${h.run_id}` : "";
      return `[${new Date(h.ts).toLocaleString()}] ${h.action} — ${status}${rid}${err}`;
    })
    .join("<br>");
}

// ============================================================
// 📡 TELEMETRIA — CODE EXECUTOR (FASE VI)
// ============================================================

const CODE_TELEMETRY_KEY = "nv_code_executor_telemetry";
const CODE_TELEMETRY_LIMIT = 200;

function loadCodeTelemetry() {
  try {
    return JSON.parse(localStorage.getItem(CODE_TELEMETRY_KEY)) || [];
  } catch (_) {
    return [];
  }
}

function saveCodeTelemetry(list) {
  try {
    localStorage.setItem(
      CODE_TELEMETRY_KEY,
      JSON.stringify(list.slice(0, CODE_TELEMETRY_LIMIT))
    );
  } catch (_) {}
}

function addCodeTelemetry(event) {
  const telemetry = loadCodeTelemetry();
  telemetry.unshift(event);
  saveCodeTelemetry(telemetry);
}

async function callCodeExecutor(action, extra = {}) {
  try {
    const res = await fetch("https://run.nv-imoveis.com/code-executor/v1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });

    const raw = await res.text();
    let data = null;

    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (_) {
      data = { raw };
    }

    if (codeExecutorOutput) {
      codeExecutorOutput.textContent = JSON.stringify(data, null, 2);
    }

    if (!res.ok) {
      throw new Error(data?.error || "Erro no Code Executor");
    }

    addCodeTelemetry({
      ts: Date.now(),
      action,
      ok: true,
      run_id: data?.run_id,
      snapshot_id: data?.snapshot_id,
      http_status: res.status,
    });

    return data;

  } catch (err) {
    addCodeTelemetry({
      ts: Date.now(),
      action,
      ok: false,
      error: err?.message || String(err),
    });
    throw err;
  }
}

if (codeDiagnoseBtn) {
  codeDiagnoseBtn.onclick = async () => {
    await callCodeExecutor("diagnose");
  };
}

if (codeDryRunBtn) {
  codeDryRunBtn.onclick = async () => {
    const r = await callCodeExecutor("dry_run");

    if (r?.run_id) {
      __CODE_EXECUTOR_STATE__.lastDryRunId = r.run_id;
      renderCodeExecutorState();
    }
  };
}

if (codeApplyBtn) {
  codeApplyBtn.onclick = async () => {
    if (!__CODE_EXECUTOR_STATE__.lastDryRunId) return;

    const r = await callCodeExecutor("apply", {
      run_id: __CODE_EXECUTOR_STATE__.lastDryRunId,
      confirm: "YES_APPLY", // confirmação humana via clique
    });

    if (r?.snapshot_id) {
      __CODE_EXECUTOR_STATE__.lastSnapshotId = r.snapshot_id;
      localStorage.setItem("nv_code_last_snapshot", r.snapshot_id);
      renderCodeExecutorState();
    }
  };
}

if (codeRollbackBtn) {
  codeRollbackBtn.onclick = async () => {
    if (!__CODE_EXECUTOR_STATE__.lastSnapshotId) return;

    await callCodeExecutor("rollback", {
      snapshot_id: __CODE_EXECUTOR_STATE__.lastSnapshotId,
    });
  };
}

/* ============================================================
   API ADAPTER (payloads corretos + relatórios humanos)
============================================================ */
function buildApiAdapter(api) {
  return {
    async audit(opts = {}) {
      const isPropose = opts.propose === true;

      // PROPOSE REAL: se não tiver execution_id, gera um exec-... e persiste no painel
      let execution_id = isPropose ? getExecutionId() : getExecutionIdRequired();

      if (isPropose && !execution_id) {
        execution_id = `exec-${Date.now()}`;

        updatePanelState({ execution_id });
        localStorage.setItem(LS.LAST_EXECUTION_ID, execution_id);

        const u = ui();
        if (u.executionIdInput) u.executionIdInput.value = execution_id;
      }

      const payload = {
        execution_id,
        source: "NV-CONTROL",
        constraints: {
          read_only: true,
          no_auto_apply: true,
        },
      };

      let r;

      if (isPropose) {
        // PROPOSE: ENGINEER MODE REAL (chama /propose de verdade)
        payload.target = getTargetRequired();

        // 🔒 Só sugere se houver um pedido explícito seu (do chat ou opts)
        const objectiveRaw =
          (opts && (opts.objective || opts.prompt)) ||
          window.__LAST_DIRECTOR_OBJECTIVE__ ||
          "";

        let objective = String(objectiveRaw || "").trim();

        // ✅ fallback: se o chat falhar (CORS), aceite objetivo vindo do PATCH
        if (!objective) {
          try {
            const st =
              typeof getPanelState === "function" ? (getPanelState() || {}) : {};
            const p = typeof st.patch === "string" ? st.patch.trim() : "";
            if (p) {
              objective = /^OBJ\s*:/i.test(p)
                ? p.replace(/^OBJ\s*:/i, "").trim()
                : p;
            }
          } catch (_) {}
        }

        if (!objective) {
          const msg =
            "Antes do PROPOSE, escreva no chat o que você quer (objetivo) OU cole o objetivo no PATCH e clique PROPOSE de novo.";
          if (typeof directorSay === "function") directorSay(msg);

          r = {
            ok: false,
            http_status: 400,
            error: "objective_required",
            data: { ok: false, error: "objective_required", message: msg },
          };

          directorReportApi("PROPOSE (ENAVIA)", r);
          return r;
        }

        const enaviaBaseUrl = mustGetEnaviaUrl();
        const token = getTokenOrNull();

        const res = await fetch(`${enaviaBaseUrl}/propose`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            ...payload,
            ask_suggestions: true,
            // redundância intencional (compat)
            message: objective,
            intent: { objective },
          }),
        });

        const raw = await res.text();
        let data = null;
        try { data = raw ? JSON.parse(raw) : {}; } catch (_) { data = { raw }; }

        r = {
          ok: res.ok,
          http_status: res.status,
          data,
          error: res.ok ? null : (data?.error || data?.message || raw),
        };

        directorReportApi("PROPOSE (ENAVIA)", r);

        // Autofill do PATCH com o patch_text sugerido
        try {
          const d = r?.data?.data ? r.data.data : r?.data;

          const patchText =
            d?.patch_text ||
            d?.patchText ||
            d?.patch?.content ||
            d?.patch?.patch_text ||
            null;

          if (patchText) {
            if (u?.patchTextarea) {
              u.patchTextarea.value = String(patchText).trim();
              u.patchTextarea.dispatchEvent(new Event("input", { bubbles: true }));
              u.patchTextarea.dispatchEvent(new Event("change", { bubbles: true }));
            }

            if (typeof directorSay === "function") {
              directorSay(
                "Patch sugerido preenchido no campo PATCH. Agora rode AUDIT com o MESMO execution_id para carimbar no Deploy Worker."
              );
            }
          } else {
            if (typeof directorSay === "function") {
              directorSay(
                "PROPOSE executado, mas não detectei patch_text no retorno. Veja a telemetria e copie o patch manualmente."
              );
            }
          }
        } catch (_) {}
      } else {
         
        // AUDIT: exige patch e target
        payload.target = getTargetRequired();
        payload.patch = getPatchRequired();

        r = await api.audit(payload);
        directorReportApi("AUDIT (ENAVIA)", r);

        // Opcional: registrar resultado de auditoria
        try {
          const verdict = r?.data?.audit?.verdict;
          const risk = r?.data?.audit?.risk_level;
          if (verdict || risk) {
            updatePanelState({
              last_audit: { verdict, risk, ts: Date.now() },
            });
          }
        } catch (_) {}
      }

      return r;
    },

    async applyTest() {
      const execution_id = getExecutionIdRequired();
      const target = getTargetRequired();
      const patch = getPatchRequired();

      const payload = {
        execution_id,
        approved: true,
        approved_by: getApprovedBy(),
        target,
        patch: { content: patch.content },
      };

      const r = await api.applyTest(payload);
      directorReportApi("APPLY TEST (STAGING)", r);
      return r;
    },

    async deployTest() {
      const execution_id = getExecutionIdRequired();
      const r = await api.deployTest({ execution_id });
      directorReportApi("DEPLOY TESTE (TEST)", r);
      return r;
    },

    async promoteReal() {
      const execution_id = getExecutionIdRequired();
      const target = getTargetRequired();
      const patch = getPatchRequired();

      const payload = {
        execution_id,
        approved: true,
        approved_by: getApprovedBy(),
        target,
        patch: { content: patch.content },
      };

      const r = await api.promoteReal(payload);
      directorReportApi("PROMOTE REAL (PROD)", r);
      return r;
    },

    async rollback() {
      const execution_id = getExecutionIdRequired();
      const r = await api.rollback({ execution_id });
      directorReportApi("ROLLBACK (MANUAL)", r);
      return r;
    },

    async cancel() {
      const execution_id = getExecutionIdRequired();
      const r = await api.cancel({ execution_id, cleanup: true });
      directorReportApi("CANCELAR CICLO", r);
      return r;
    },

    async status() {
      const execution_id = getExecutionIdRequired();
      const r = await api.status(execution_id);
      directorReportApi("STATUS", r);
      return r;
    },
  };
}

/* ============================================================
   CHAT SEND (opcional — não interfere nos botões)
   - Limpa input após enviar
   - Mantém experiência “GPT-like”
============================================================ */
function bindChatSend() {
  // ✅ Fix real: garantir bind mesmo se o DOM carregar depois do script
  // ✅ Enter envia / Shift+Enter quebra linha
  // ✅ Botão Enviar envia (mesmo se estiver dentro de <form>)
  // ✅ Fallback robusto por delegação (se IDs divergirem no HTML)

  // Evita bind duplicado em hot reload / múltiplos boots
  if (window.__NV_CHAT_SEND_BOUND__ === true) return;
  window.__NV_CHAT_SEND_BOUND__ = true;

  const pickChatEl = () => {
    const u = ui();
    // Primeiro: o seletor canônico
    if (u.chatInput) return u.chatInput;

    // Fallback: se o usuário estiver com foco num textarea “parecido com chat”, usa ele
    const ae = document.activeElement;
    if (ae && ae.tagName === "TEXTAREA") {
      const id = (ae.id || "").toLowerCase();
      const df = (ae.getAttribute("data-field") || "").toLowerCase();
      if (id.includes("chat") || id.includes("message") || df === "chat-input")
        return ae;
    }
    return null;
  };

  const safePrevent = (e) => {
    try {
      e.preventDefault();
    } catch (_) {}
    try {
      e.stopPropagation();
    } catch (_) {}
  };

  const send = () => {
  const el = pickChatEl();
  if (!el) return;

  const text = String(el.value || "").trim();
  if (!text) return;

  addChatMessage({ role: "user", text });

  // ✅ NÃO encostar em patch state aqui (chat não é deploy)
  // updatePanelState({ patch: text });

  el.value = "";

  // 🔒 confirmação humana explícita antes de qualquer execução
window.__HUMAN_EXECUTION_CONFIRMED__ = true;

routeDirector(text);
};

  // 1) Blindagem contra submit em qualquer form que contenha o chatInput real
  const u0 = ui();
  const chat0 = u0.chatInput;
  if (chat0) {
    const form = chat0.closest("form");
    if (form) {
      form.addEventListener("submit", (e) => {
        safePrevent(e);
        return false;
      });
    }
  }

  // 2) Binding direto (se elementos existirem)
  const u = ui();

  if (u.sendBtn && typeof u.sendBtn.type === "string") {
    // garante que o botão não seja submit
    u.sendBtn.type = "button";
  }

  if (u.sendBtn) {
    u.sendBtn.addEventListener(
      "click",
      (e) => {
        safePrevent(e);
        send();
      },
      true
    );
  }

  if (u.chatInput) {
    u.chatInput.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          safePrevent(e);
          send();
        }
      },
      true
    );
  }

  // 3) Delegação global (fallback) — cobre casos em que o HTML usa IDs diferentes
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Enter") return;
      if (e.shiftKey) return;

      const ae = document.activeElement;
      if (!ae || ae.tagName !== "TEXTAREA") return;

      // só intercepta se for o textarea do chat (heurística segura)
      const id = (ae.id || "").toLowerCase();
      const df = (ae.getAttribute("data-field") || "").toLowerCase();
      if (id.includes("chat") || id.includes("message") || df === "chat-input") {
        safePrevent(e);
        send();
      }
    },
    true
  );

  document.addEventListener(
    "click",
    (e) => {
      const t = e.target;
      if (!t) return;

      // tenta localizar um botão “enviar” pelos seletores já usados no painel
      const btn =
        t.closest?.("#sendBtn") ||
        t.closest?.("#sendButton") ||
        t.closest?.("[data-action='send']");

      if (btn) {
        safePrevent(e);
        send();
      }
    },
    true
  );
}

// ============================================================
// ✍️ API PÚBLICA — ESCRITA HUMANA NO CHAT (CANÔNICA)
// ============================================================
window.__NV_CHAT_WRITE__ = function (text) {
  try {
    if (!text || typeof text !== "string") return false;

    const u = ui();
    if (!u || !u.chatInput) {
      console.warn("CHAT_INPUT não encontrado");
      return false;
    }

    // escreve como humano
    u.chatInput.value = text;

    // dispara eventos nativos (igual digitação real)
    u.chatInput.dispatchEvent(new Event("input", { bubbles: true }));
    u.chatInput.dispatchEvent(new Event("change", { bubbles: true }));

    // foco no input (UX real)
    u.chatInput.focus();

    return true;
  } catch (err) {
    console.error("NV_CHAT_WRITE_ERROR:", err);
    return false;
  }
};

// ============================================================
// DIRECTOR — ROTEAMENTO (ALINHADO AO CONTRATO CANÔNICO)
// Painel NÃO pensa, NÃO confirma, NÃO reavalia.
// Painel apenas OBSERVA estado do Director.
// ============================================================

// Estado informativo apenas (não decisório)
window.__LAST_DIRECTOR_OBJECTIVE__ =
  window.__LAST_DIRECTOR_OBJECTIVE__ || null;

async function routeDirector(text) {
  const USE_COGNITIVE_DIRECTOR = true;

  const hasApprovedPlan = !!window.__APPROVED_BROWSER_PLAN__;

  // guarda último objetivo humano (apenas informativo)
  if (text && typeof text === "string") {
    window.__LAST_DIRECTOR_OBJECTIVE__ = text;
  }

  if (!USE_COGNITIVE_DIRECTOR) return;

  try {
    const res = await fetch("https://run.nv-imoveis.com/director/cognitive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        context: {
          has_approved_plan: hasApprovedPlan,
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`Director cognitivo HTTP ${res.status}`);
    }

    const data = await res.json();

// ==============================
// PROMOÇÃO CANÔNICA DO PLANO
// ==============================
if (
  data?.decision?.type === "browser_execute_ready" &&
  (data?.plan || data?.suggested_plan)
) {
  const approvedPlan = data.plan || data.suggested_plan;

  console.group("🧠 PLANO DE BROWSER APROVADO (DIRECTOR)");
  console.log("Plano recebido:", approvedPlan);
  console.groupEnd();

 // 🔒 Fonte ÚNICA da execução
window.__APPROVED_BROWSER_PLAN__ = approvedPlan;

// 🔁 FORÇA MODO MANUAL (FIX CANÔNICO)
if (typeof setMode === "function") {
  setMode("manual");
}

// 🖱️ Render no próximo tick visual
requestAnimationFrame(() => {
  if (typeof window.__renderBrowserExecuteButton === "function") {
    window.__renderBrowserExecuteButton();
  }
});

  // ⚠️ NÃO retornar aqui — ainda pode haver reply textual
}

    // ==============================
    // Persistência CANÔNICA do retorno
    // ==============================
    window.__LAST_DIRECTOR_REPLY__ = data;

    // 🧠 Fala do Director (conversa livre)
    if (typeof directorSay === "function" && data?.reply) {
      directorSay(data.reply);
    }

    // ==============================
    // 🔑 FASE 4 — READY TO EXECUTE
    // Fonte ÚNICA:
    // decision === browser_execute_ready
    // suggested_plan presente
    // ==============================
    if (
      data?.decision?.type === "browser_execute_ready" &&
      data?.suggested_plan
    ) {
      const plan = data.suggested_plan;
      const firstStep = plan?.steps?.[0];
      const url = firstStep?.url;

      // 🚨 Validação mínima e objetiva
      if (
        !firstStep ||
        firstStep.type !== "open" ||
        typeof url !== "string" ||
        !url.startsWith("http")
      ) {
        console.error("❌ Plano inválido recebido do Director", plan);
        return;
      }

      // ✅ Persistência FINAL (fonte única observada pelo painel)
      window.__APPROVED_BROWSER_PLAN__ = plan;

      // 🖱️ Render do botão (reação do painel)
      if (typeof window.__renderBrowserExecuteButton === "function") {
        window.__renderBrowserExecuteButton();
      } else if (typeof renderBrowserExecuteButton === "function") {
        renderBrowserExecuteButton();
      }

      return;
    }

    // Conversa normal — nenhum efeito colateral
    return;

  } catch (e) {
    console.error("Erro Director Cognitivo:", e);
    if (typeof directorSay === "function") {
      directorSay("Tive um problema técnico agora. Tenta novamente.");
    }
    return;
  }
}

/* ============================================================
   DIRECTOR ⇄ ENAVIA — ESTADO DA CONSULTA (READ-ONLY)
============================================================ */
let pendingEnaviaIntent = null; // guarda intenção aguardando confirmação

/* ============================================================
   ENAVIA — CONSULTA READ-ONLY (AUDIT)
============================================================ */
async function askEnaviaAnalysis(intentText) {
  // Log técnico (canal Director ⇄ ENAVIA)
  addChatMessage({
    role: "director_enavia",
    text: "[DIRECTOR → ENAVIA] Solicitação de análise técnica (read-only).",
  });

  try {
    // ✅ IMPORTANTE:
    // - o api-client exige patch (buildAuditPayload), então este "bypass" NÃO pode usar window.api.audit()
    // - fazemos fetch direto no /audit da ENAVIA (read-only), com patch mínimo e target resolvido

    const baseUrlRaw = String(localStorage.getItem("nv_enavia_url") || "").trim();
    const baseUrl = baseUrlRaw.replace(/\/$/, "");

    if (!baseUrl) {
      directorSay(
        "A URL da ENAVIA não está configurada (nv_enavia_url). Configure para eu consultar a análise técnica."
      );
      return;
    }

    // resolve workerId (mesma lógica: nv_worker_test/nv_worker_real ou input)
    const envMode = String(localStorage.getItem("nv_env") || "test").trim().toLowerCase();
    const lsTest = String(localStorage.getItem("nv_worker_test") || "").trim();
    const lsProd = String(localStorage.getItem("nv_worker_real") || "").trim();
    const inputVal = String(document.getElementById("targetWorkerIdInput")?.value || "").trim();

    const rawWorker = envMode === "prod" ? (lsProd || inputVal) : (lsTest || inputVal);

    const normalizeWorkerId = (v) => {
      let s = String(v || "").trim();
      if (!s) return "";
      s = s.replace(/^https?:\/\//i, "");
      s = s.split("/")[0].split("?")[0].split("#")[0];
      if (s.includes(".")) s = s.split(".")[0];
      return s.trim();
    };

    const resolvedWorkerId = normalizeWorkerId(rawWorker);

    if (!resolvedWorkerId) {
      directorSay(
        "Não consegui definir o worker alvo. Configure nv_worker_test/nv_worker_real ou preencha o campo Target."
      );
      return;
    }

    const execution_id = `exec-${Date.now()}`;

    const payload = {
      mode: "enavia_audit",
      source: "nv-control",
      execution_id,
      target: { system: "enavia", workerId: resolvedWorkerId },

      // patch mínimo só para satisfazer o contrato do /audit
      patch: {
        type: "patch_text",
        content: `// director_intent:\n// ${String(intentText || "").trim() || "(vazio)"}\n`,
      },

      // read-only canônico
      constraints: { read_only: true, no_auto_apply: true },

      // sem aplicar nada: apenas pedir sugestões/insights
      ask_suggestions: true,
      propose: true,

      timestamp: Date.now(),
    };

    const res = await fetch(`${baseUrl}/audit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await res.text().catch(() => "");
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    const result = { ok: res.ok, http_status: res.status, data };

    addChatMessage({
      role: "director_enavia",
      text: "[ENAVIA → DIRECTOR]\n" + JSON.stringify(result, null, 2),
    });

    directorSay(
      "A ENAVIA analisou sua solicitação. Quer que eu te explique os riscos/pontos críticos ou seguimos pro próximo passo?"
    );
  } catch (err) {
    addChatMessage({
      role: "director_enavia",
      text: "[ENAVIA → DIRECTOR] ERRO: " + (err?.message || String(err)),
    });

    directorSay(
      "Tentei consultar a ENAVIA, mas ocorreu um erro técnico. Veja os detalhes no painel de conversa técnica."
    );
  }
}

/* ============================================================
   AO VIVO — OVERLAY noVNC (CANÔNICO)
   - Apenas visualização
   - Não executa plano
   - Não altera estado
============================================================ */

function openLiveOverlay() {
  // evita duplicação
  if (document.getElementById("nv-live-overlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "nv-live-overlay";
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100vw";
  overlay.style.height = "100vh";
  overlay.style.background = "rgba(0,0,0,0.85)";
  overlay.style.zIndex = "99999";
  overlay.style.display = "flex";
  overlay.style.flexDirection = "column";

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "center";
  header.style.padding = "8px 12px";
  header.style.background = "#111";
  header.style.color = "#fff";
  header.style.fontSize = "14px";

  header.textContent = "AO VIVO — Browser Executor";

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "✖ Fechar";
  closeBtn.style.cursor = "pointer";
  closeBtn.style.background = "#222";
  closeBtn.style.color = "#fff";
  closeBtn.style.border = "1px solid #444";
  closeBtn.style.padding = "4px 8px";

  closeBtn.onclick = () => {
    try { overlay.remove(); } catch (_) {}
  };

  header.appendChild(closeBtn);

  const iframe = document.createElement("iframe");
  iframe.src = "https://browser.nv-imoveis.com/novnc/vnc.html?autoconnect=1";
  iframe.style.border = "0";
  iframe.style.width = "100%";
  iframe.style.flex = "1";

  overlay.appendChild(header);
  overlay.appendChild(iframe);

  document.body.appendChild(overlay);
}

// ============================================================
// AO VIVO — BOTÃO (VISUALIZAÇÃO APENAS, CANAL ISOLADO)
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  const liveBtn =
    document.getElementById("liveViewBtn") ||
    document.querySelector("[data-action='live-view']");

  if (!liveBtn) {
    console.warn("[AO VIVO] Botão não encontrado");
    return;
  }

  liveBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      openLiveOverlay(); // 👁️ apenas visualização
    } catch (err) {
      console.warn("AO VIVO falhou, abrindo em nova aba:", err);
      window.open(
        "https://browser.nv-imoveis.com/novnc/vnc.html?autoconnect=1",
        "_blank",
        "noopener,noreferrer"
      );
    }
  });
});

/* ============================================================
   COCKPIT — BROWSER EXECUTOR (READ ONLY)
   - Status
   - Heartbeat
   - Nenhuma ação
============================================================ */

let __BROWSER_STATUS__ = {
  online: null,
  lastSeen: null,
};

function renderBrowserStatusPill() {
  let pill = document.getElementById("browser-status-pill");
  if (!pill) {
    pill = document.createElement("div");
    pill.id = "browser-status-pill";
    pill.style.position = "fixed";
    pill.style.bottom = "12px";
    pill.style.right = "12px";
    pill.style.padding = "6px 10px";
    pill.style.borderRadius = "12px";
    pill.style.fontSize = "12px";
    pill.style.fontFamily = "monospace";
    pill.style.zIndex = "99999";
    pill.style.background = "#333";
    pill.style.color = "#fff";
    document.body.appendChild(pill);
  }

  if (__BROWSER_STATUS__.online === true) {
    pill.textContent = "🟢 Browser ONLINE";
    pill.style.background = "#1f7a1f";
  } else if (__BROWSER_STATUS__.online === false) {
    pill.textContent = "🔴 Browser OFFLINE";
    pill.style.background = "#7a1f1f";
  } else {
    pill.textContent = "⚪ Browser desconhecido";
    pill.style.background = "#555";
  }
}

async function pollBrowserHealth() {
  const url = "https://browser.nv-imoveis.com/health";

  try {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) throw new Error("health_not_ok");

    const data = await res.json();
    if (data?.ok === true) {
      __BROWSER_STATUS__.online = true;
      __BROWSER_STATUS__.lastSeen = Date.now();
    } else {
      throw new Error("health_invalid");
    }
  } catch (_) {
    __BROWSER_STATUS__.online = false;
  }

  renderBrowserStatusPill();
}

// start polling leve (read-only)
setInterval(pollBrowserHealth, 5000);
setTimeout(pollBrowserHealth, 1000);

/* ============================================================
   AO VIVO — noVNC (VISUALIZAÇÃO DO BROWSER)
   - NÃO executa
   - NÃO dispara plano
   - Apenas entra na sala
============================================================ */

//document.addEventListener("DOMContentLoaded", () => {
  //const liveBtn = document.getElementById("liveViewBtn");
  //if (liveBtn) {
    //liveBtn.addEventListener("click", () => {
      //try {
        //openLiveOverlay();
      //} catch (err) {
        //console.warn("Overlay falhou, abrindo em nova aba:", err);
        //const liveUrl = "https://browser.nv-imoveis.com/novnc/vnc.html?autoconnect=1";
        //window.open(liveUrl, "_blank", "noopener,noreferrer");
      //}
    //});
  //}

  // ============================================================
  // EXECUTAR BROWSER — botão fixo (A1)
  // ============================================================
  //const browserExecuteBtn = document.getElementById("browser-execute-btn");

  //if (browserExecuteBtn) {
    //browserExecuteBtn.addEventListener("click", () => {
  //const raw = document.querySelector("textarea")?.value;

  //let plan;
  //try {
    //plan = raw ? JSON.parse(raw) : null;
  //} catch (e) {
    //alert("Plano inválido (JSON).");
    //return;
  //}

  //if (!plan || !Array.isArray(plan)) {
    //alert("Nenhum plano válido para executar no Browser.");
    //return;
  //}

  //runBrowserPlan({ steps: plan });
//});
  //}
//});

if (!__DISABLE_LEGACY_BROWSER__) {
// ============================================================
// CHAT MODE TOGGLE — CANÔNICO (Director ↔ Manual)
// ============================================================

(function initChatModeToggle() {
  const chatContainer = document.querySelector(".chat-container");
  const manualPlan = document.getElementById("humanBrowserPlan");
  const modeButtons = document.querySelectorAll("[data-chat-mode]");

  if (!chatContainer || !manualPlan || !modeButtons.length) return;

     // 1) Desativa o botão legado (não faz mais sentido com modos)
  const legacyHumanBtn = document.getElementById("human-director-btn");
  if (legacyHumanBtn) legacyHumanBtn.style.display = "none";

  // 2) Reusa EXATAMENTE o caminho já implantado: accept_plan → /director/cognitive
  async function acceptHumanPlanViaExistingFlow() {
    console.group("✍️ ENTER MODO MANUAL → ACCEPT_PLAN (reuso canônico)");

    let humanPlan = null;
    try {
      if (typeof getHumanBrowserPlan === "function") {
        humanPlan = getHumanBrowserPlan();
      }
    } catch (err) {
      console.error("❌ Plano humano inválido:", err);
      if (typeof directorSay === "function") {
        directorSay("❌ Plano Browser inválido. Corrija o JSON antes de prosseguir.");
      }
      console.groupEnd();
      return;
    }

    if (!humanPlan) {
      if (typeof directorSay === "function") {
        directorSay("⚠️ Nenhum plano browser encontrado. Cole o plano no campo correto.");
      }
      console.groupEnd();
      return;
    }

    const payload = {
      action: "accept_plan",
      source: "human",
      intent: {
        objective:
          humanPlan?.steps?.[0]?.url ||
          window.__LAST_DIRECTOR_OBJECTIVE__ ||
          "decisão humana explícita",
        notes: "plano browser humano enviado via Modo Manual (Enter)",
      },
    };

    try {
      const res = await fetch("https://run.nv-imoveis.com/director/cognitive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      console.log("Resposta do Director:", data);

      if (data?.decision?.type === "browser_execute_ready") {
        console.log("✅ Plano humano aceito. Browser pronto.");

         // 🔒 FONTE ÚNICA DO PLANO (CANÔNICO)
        window.__APPROVED_BROWSER_PLAN__ = humanPlan;

        // 🔓 HABILITA BOTÃO FIXO "EXECUTAR BROWSER"
        const browserBtn = document.getElementById("browser-execute-btn");
        if (browserBtn) {
          browserBtn.disabled = false;
        }
      } else {
        console.warn("Resposta inesperada do Director:", data);
      }
    } catch (err) {
      console.error("❌ Erro no envio manual:", err);
      if (typeof directorSay === "function") {
        directorSay("⚠️ Falha ao sinalizar decisão humana. Veja o console.");
      }
    } finally {
      console.groupEnd();
    }
  }

  // 3) Enter envia / Shift+Enter quebra linha (somente no Modo Manual)
  manualPlan.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      acceptHumanPlanViaExistingFlow();
    }
  });


  function setMode(mode) {
  modeButtons.forEach(btn =>
    btn.classList.toggle("active", btn.dataset.chatMode === mode)
  );

  const executorCard = document.getElementById("codeExecutorCard");

  if (mode === "director") {
    chatContainer.style.display = "flex";
    manualPlan.style.display = "none";
    if (executorCard) executorCard.style.display = "none";
  }

  if (mode === "manual") {
    chatContainer.style.display = "none";
    manualPlan.style.display = "block";
    if (executorCard) executorCard.style.display = "block";

     // 📜 Histórico — Code Executor (FASE VI)
  let historyBox = document.getElementById("codeHistoryBox");
  if (!historyBox) {
    historyBox = document.createElement("pre");
    historyBox.id = "codeHistoryBox";
    historyBox.style.marginTop = "12px";
    historyBox.style.padding = "10px";
    historyBox.style.background = "#111";
    historyBox.style.color = "#0f0";
    historyBox.style.fontSize = "12px";
    historyBox.style.maxHeight = "200px";
    historyBox.style.overflow = "auto";
    historyBox.textContent = "Sem histórico ainda.";

    executorCard?.appendChild(historyBox);
  }
  renderCodeHistory();
  }
}

modeButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    setMode(btn.dataset.chatMode);
  });
});

// modo inicial
setMode("director");
})();

}

// ============================================================
// 🔁 FIX TEMPORÁRIO — ATIVA MODO MANUAL (ISOLADO)
// NÃO interfere em Browser nem Director
// ============================================================
document.querySelectorAll(".mode-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const mode = btn.dataset.chatMode;

    document.querySelectorAll(".mode-btn").forEach(b =>
      b.classList.remove("active")
    );
    btn.classList.add("active");

    const codeCard = document.getElementById("codeExecutorCard");
    const chat = document.querySelector(".chat-container");

    if (mode === "manual") {
      if (chat) chat.style.display = "none";
      if (codeCard) codeCard.style.display = "block";
    } else {
      if (chat) chat.style.display = "block";
      if (codeCard) codeCard.style.display = "none";
    }

    console.log("[MODE FIX] Modo ativado:", mode);
  });
});
   
// ============================================
// LISTENER CANÔNICO — PLANO DE BROWSER APROVADO
// ============================================
// document.addEventListener("browser-plan-approved", (e) => {
  // const plan = e.detail;

// console.group("🧠 BROWSER PLAN APPROVED EVENT");
// console.log("Event detail:", e.detail);
// console.log("Steps:", e.detail?.steps);
// console.trace("Origem do evento");
// console.groupEnd();

  // if (!plan || !Array.isArray(plan.steps)) {
    // console.warn("Plano aprovado inválido", plan);
   // return;
 // }

  // ✅ FONTE ÚNICA DO BOTÃO
 // window.__APPROVED_BROWSER_PLAN__ = plan;

 // console.log("✅ Plano aprovado armazenado:", plan);

 // if (typeof window.__renderBrowserExecuteButton === "function") {
  //  window.__renderBrowserExecuteButton();
 // }
// });

/* ============================================================
   STATUS DO BROWSER — READ ONLY (SAFE)
   (DESATIVADO — fase futura)
============================================================

(function initBrowserStatusMonitor() {
  const STATUS_URL = "https://browser.nv-imoveis.com/health";
  const POLL_INTERVAL = 5000;

  const statusPill = document.getElementById("statusPill");
  if (!statusPill) return;

  async function checkBrowserStatus() {
    try {
      const res = await fetch(STATUS_URL, { method: "GET" });
      if (!res.ok) throw new Error("health_not_ok");

      const data = await res.json();

      if (data?.ok === true) {
        statusPill.textContent = "Browser Online";
        statusPill.className = "status-pill success";
      } else {
        throw new Error("health_invalid");
      }
    } catch (err) {
      statusPill.textContent = "Browser Offline";
      statusPill.className = "status-pill danger";
    }
  }

  checkBrowserStatus();
  setInterval(checkBrowserStatus, POLL_INTERVAL);
})();
*/

// 🔗 Expor handler do Director para o Browser Executor (bridge canônica)
// window.handleDirectorMessage = handleDirectorMessage;


