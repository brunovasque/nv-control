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
  browser_run_url: "https://browser.nv-imoveis.com/run",
};

function qs(sel) { return document.querySelector(sel); }
function on(el, evt, fn) { if (el) el.addEventListener(evt, fn); }

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

    patchTextarea:
      qs("#patchTextarea") ||
      qs("#patchInput") ||
      qs("textarea[data-field='patch']"),

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

  const target = {
    system: "TARGET_WORKER",
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

  // 1️⃣ tenta campo técnico (se existir)
  let content = String(u.patchTextarea?.value || "").trim();

  // 2️⃣ fallback: usa input do chat (SEM afetar a conversa)
  if (!content) {
    content = String(u.chatInput?.value || "").trim();
  }

  if (!content) {
    throw new Error("patch.content obrigatório (cole o patch no painel).");
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

/* ============================================================
   BROWSER EXECUTOR — FIO DO BOTÃO (CANAL SEPARADO)
============================================================ */
function getBrowserRunUrl() {
  const raw = (localStorage.getItem(LS.BROWSER_RUN_URL) || DEFAULTS.browser_run_url || "").trim();
  return raw;
}

async function runBrowserPlan(plan) {
  const runUrl = getBrowserRunUrl();
  if (!runUrl) throw new Error("browser_run_url ausente (LS nv_browser_run_url).");

  // mínimo necessário para /run
  const payload = {
    execution_id: getExecutionId() || `browser-${Date.now()}`,
    plan: {
      steps: Array.isArray(plan?.steps) ? plan.steps : [],
    },
    meta: {
      source: "NV-CONTROL",
      channel: "BROWSER",
      ts: Date.now(),
    },
  };

  // log técnico
  addChatMessage({
    role: "director_enavia",
    text: "[DIRECTOR → BROWSER_ADAPTER] POST " + runUrl + "\n" + JSON.stringify(payload, null, 2),
  });

  const res = await fetch(runUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const txt = await res.text();
  let data = null;
  try { data = JSON.parse(txt); } catch (_) {}

  if (!res.ok) {
    const msg = data?.error || data?.message || txt || `HTTP_${res.status}`;
    throw new Error(msg);
  }

  return data || { ok: true, raw: txt };
}

// ============================================================
// 🔧 DIRECTOR OPERACIONAL — EXECUTOR DO BROWSER (CANÔNICO)
// ============================================================
window.__NV_DIRECTOR_CHAT_EXECUTE__ = async function (payload) {
  try {
    if (!payload || !payload.plan) {
      console.warn("EXECUTOR: payload inválido", payload);
      return;
    }

    addChatMessage({
      role: "director",
      text: "Executando no browser conforme combinado.",
      typing: true,
    });

    const result = await runBrowserPlan(payload.plan);

    addChatMessage({
      role: "director_enavia",
      text:
        "[BROWSER EXECUTOR RESULT]\n" +
        JSON.stringify(result, null, 2),
    });
  } catch (err) {
    console.error("EXECUTOR ERROR:", err);
    addChatMessage({
      role: "director",
      text:
        "Tive um erro ao tentar executar no browser. Veja os detalhes técnicos.",
      typing: true,
    });
  }
};

// ============================================================
// 🌐 BROWSER EXECUTOR — BOTÃO EXCLUSIVO (VIA ISOLADA)
// ============================================================

function renderBrowserExecuteButton() {
  const existing = document.getElementById("browser-execute-btn");
  if (existing) return;

  const container =
    document.querySelector(".chat-input-container") ||
    document.querySelector(".chat-input") ||
    document.body;

  const btn = document.createElement("button");
  btn.id = "browser-execute-btn";
  btn.textContent = "Executar Browser";
  btn.style.marginLeft = "8px";
  btn.style.padding = "8px 12px";
  btn.style.cursor = "pointer";

  btn.onclick = () => {
  const st = getPanelState();
  const plan = st?.browser_plan;

  if (!plan) {
    console.warn("Browser Execute: plano inexistente no state");
    return;
  }

  window.__NV_DIRECTOR_CHAT_EXECUTE__({ plan });

  // limpeza canônica
  updatePanelState({
    browser_plan: null,
    browser_plan_approved: false,
  });

  btn.remove();
};

  container.appendChild(btn);
}

function removeBrowserExecuteButton() {
  const btn = document.getElementById("browser-execute-btn");
  if (btn) btn.remove();
}

/* ============================================================
   API ADAPTER (payloads corretos + relatórios humanos)
============================================================ */
function buildApiAdapter(api) {
  return {
    async audit(opts = {}) {
      const isPropose = opts.propose === true;
      const execution_id = isPropose ? (`preview-${Date.now()}`) : getExecutionIdRequired();

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
        // PROPOSE: não exige patch nem target
        r = await api.propose({
          ...payload,
          ask_suggestions: true,
        });

        directorReportApi("PROPOSE (ENAVIA)", r);
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

    // 🔑 LINHA CRÍTICA — PATCH ENTRA NO STATE CANÔNICO
    updatePanelState({ patch: text });

    el.value = "";

    // Director — roteamento (cognitivo vs operacional)
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

/* ============================================================
   DIRECTOR — ROTEAMENTO (CANÔNICO)
   - Switch cognitivo vs operacional
   - Cognitivo: Worker externo (mock por enquanto)
   - Operacional: hook local (__NV_DIRECTOR_CHAT_EXECUTE__) / fallback handleDirectorMessage
============================================================ */
async function routeDirector(text) {
  const USE_COGNITIVE_DIRECTOR = true;

// ============================================================
// Confirmação explícita → LIBERA BOTÃO EXECUTAR (CANÔNICO)
// ============================================================
const st = getPanelState();

if (
  st?.browser_plan &&
  window.__AWAITING_CONFIRMATION__ === true
) {
  const normalized = text.toLowerCase().trim();

  if (normalized === "ok" || normalized === "executar") {
    // 🔒 limpa estado de confirmação
    window.__AWAITING_CONFIRMATION__ = false;

    // ✅ estado canônico: plano aprovado
    updatePanelState({
      browser_plan: st.browser_plan,
      browser_plan_approved: true,
    });

     renderBrowserExecuteButton();

    // ❌ NÃO executa
    // ❌ NÃO responde
    // ❌ NÃO chama executor aqui

    return;
  }
}

  if (USE_COGNITIVE_DIRECTOR) {
    try {
      const res = await fetch(
        "https://run.nv-imoveis.com/director/cognitive",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            context: {
              last_director_reply: window.__LAST_DIRECTOR_REPLY__ || null,
              pending_plan: window.__PENDING_BROWSER_PLAN__ || null,
              awaiting_confirmation: window.__AWAITING_CONFIRMATION__ || false,
              conversation_summary: window.__CONVERSATION_SUMMARY__ || "",
            },
          }),
        }
      );

      const data = await res.json();

      if (typeof directorSay === "function" && data?.reply) {
        directorSay(data.reply);
        window.__LAST_DIRECTOR_REPLY__ = data.reply;
      }

      // armazena plano sugerido (NÃO executa)
      if (data?.suggested_plan) {
        window.__PENDING_BROWSER_PLAN__ = data.suggested_plan;
        window.__AWAITING_CONFIRMATION__ = !!data.needs_confirmation;
      }
          
      return;
    } catch (e) {
      console.error("Erro Director Cognitivo:", e);
      if (typeof directorSay === "function") {
        directorSay("Tive um problema técnico agora. Tenta novamente.");
      }
      return;
    }
  }

  // Operacional (ATUAL)
if (typeof window.__NV_DIRECTOR_CHAT_EXECUTE__ === "function") {
  window.__NV_DIRECTOR_CHAT_EXECUTE__(text);
  return;
}

// fallback antigo removido de propósito
console.warn(
  "Director operacional indisponível — aguardando cognitivo"
);
}

/* ============================================================
   DIRECTOR ⇄ ENAVIA — ESTADO DA CONSULTA (READ-ONLY)
============================================================ */
let pendingEnaviaIntent = null; // guarda intenção aguardando confirmação

/* ============================================================
   ENAVIA — CONSULTA READ-ONLY (AUDIT)
============================================================ */
async function askEnaviaAnalysis(intentText) {
  if (!window.api) {
    directorSay(
      "A ENAVIA ainda não está conectada. Configure as URLs para que eu possa consultar a análise técnica."
    );
    return;
  }

  // Log técnico (canal Director ⇄ ENAVIA)
  addChatMessage({
    role: "director_enavia",
    text: "[DIRECTOR → ENAVIA] Solicitação de análise técnica (read-only).",
  });

  try {
    // ✅ BYPASS CANÔNICO: read-only SEM execution_id/target/patch
    // Isso precisa bater com o /audit do worker (ask_suggestions + constraints)
    const payload = {
      mode: "enavia_audit",
      source: "NV-CONTROL",
      ask_suggestions: true,
      constraints: {
        read_only: true,
        no_auto_apply: true,
      },
      context: {
        director_intent: String(intentText || ""),
      },
    };

    const result = await window.api.audit(payload);

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
      text: "[ENAVIA → DIRECTOR] ERRO: " + err.message,
    });

    directorSay(
      "Tentei consultar a ENAVIA, mas ocorreu um erro técnico. Veja os detalhes no painel de conversa técnica."
    );
  }
}

/* ============================================================
   AO VIVO — noVNC (VISUALIZAÇÃO DO BROWSER)
   - NÃO executa
   - NÃO dispara plano
   - Apenas entra na sala
============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  const liveBtn = document.getElementById("liveViewBtn");
  if (!liveBtn) return;

  liveBtn.addEventListener("click", () => {
    const liveUrl = "https://browser.nv-imoveis.com/novnc";

    window.open(
      liveUrl,
      "_blank",
      "noopener,noreferrer"
    );
  });
});

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



