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
  browser_run_url: "https://run.nv-imoveis.com/browser/run",
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

  if (!plan || !Array.isArray(plan.steps)) {
    throw new Error("Plano inválido para execução no browser.");
  }

  const execId = plan.execution_id || getExecutionId() || `browser-${Date.now()}`;

  const payload = {
    executor_action: "run_browser_plan",
    execution_id: execId,
    plan: {
      execution_id: execId,
      version: plan.version || "plan.v1",
      source: plan.source || "director",
      type: plan.type || "approved",
      steps: plan.steps,
    },
    meta: {
      source: "NV-CONTROL",
      channel: "BROWSER",
      ts: Date.now(),
    },
  };

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

// ============================================================
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
    document.querySelector(".chat-input-container") ||
    document.querySelector(".chat-input") ||
    document.body;

  if (!container) {
    console.warn("Browser Execute: container não encontrado");
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

    const { execution_id, version, source, steps } = plan;

    if (!execution_id || !Array.isArray(steps) || !steps.length) {
      console.error("❌ Plano inválido para execução no browser:", plan);
      console.groupEnd();
      return;
    }

    console.log("Plano enviado ao Browser:", plan);

    try {
      await runBrowserPlan({
        execution_id,
        version,
        source,
        steps,
      });

      console.log("✅ Execução enviada com sucesso");
    } catch (err) {
      console.error("❌ Browser execution failed:", err);

      if (typeof directorSay === "function") {
        directorSay("⚠️ A execução do Browser falhou. Vou deixar rearmado pra você tentar de novo / refazer o pedido.");
      }
    } finally {
      // 🧹 REARME CANÔNICO — sempre limpa (sucesso OU falha)
      window.__APPROVED_BROWSER_PLAN__ = null;

      try {
        btn.remove();
      } catch (_) {}

      console.log("🧹 Estado limpo e botão removido (rearmado)");

      console.groupEnd();
    }
  };

  container.appendChild(btn);
}

// 👇 ADICIONE IMEDIATAMENTE APÓS A FUNÇÃO
window.__renderBrowserExecuteButton = renderBrowserExecuteButton;

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
  data?.suggested_plan
) {
  console.group("🧠 PLANO DE BROWSER APROVADO (DIRECTOR)");
  console.log("Plano recebido:", data.suggested_plan);
  console.groupEnd();

  // 🔒 Fonte ÚNICA da execução
  window.__APPROVED_BROWSER_PLAN__ = data.suggested_plan;

  // 🖱️ Painel reage (não decide)
  if (typeof window.__renderBrowserExecuteButton === "function") {
    window.__renderBrowserExecuteButton();
  }

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



