/* ============================================================
   script.js — NV-Control / ENAVIA Panel (CANÔNICO)
   Objetivo:
   - Bootstrap do painel (liga tudo)
   - Persistência (não perder URLs/token no F5)
   - Adapter: monta payloads corretos (sem “mágica”)
   - Tradução humana no chat (Director) + telemetria intacta
============================================================ */

import { initPanelState, getPanelState, updatePanelState } from "./panel-state.js";
import { initButtonsController } from "./buttons-controller.js";
import { initFlowOrchestrator } from "./flow-orchestrator.js";
import { createApiClient } from "./api-client.js";
import { addChatMessage } from "./chat-renderer.js";

/* ============================================================
   STORAGE KEYS (não perder no F5)
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
};

/* ============================================================
   DEFAULTS
============================================================ */
const DEFAULTS = {
  debug: false,
  env: "test",
  approved_by: "VASQUES",
};

/* ============================================================
   DOM HELPERS
============================================================ */
function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }

function valOf(...selectors) {
  for (const s of selectors) {
    const el = qs(s);
    if (el && typeof el.value === "string") return el.value;
  }
  return "";
}

function setVal(value, ...selectors) {
  for (const s of selectors) {
    const el = qs(s);
    if (el) { el.value = value; return true; }
  }
  return false;
}

function on(el, evt, fn) {
  if (!el) return;
  el.addEventListener(evt, fn);
}

/* ============================================================
   UI: onde o painel guarda inputs (tolerante a IDs)
   (Se seu HTML tiver IDs diferentes, este arquivo NÃO quebra.)
============================================================ */
function ui() {
  return {
    enaviaUrlInput: qs("#enaviaUrlInput") || qs("#workerUrlInput") || qs("[data-field='enavia-url']"),
    deployUrlInput: qs("#deployUrlInput") || qs("#deployWorkerUrlInput") || qs("[data-field='deploy-url']"),
    tokenInput: qs("#internalTokenInput") || qs("#tokenInput") || qs("[data-field='internal-token']"),
    debugToggle: qs("#debugToggle") || qs("[data-field='debug']"),
    envSelect: qs("#envSelect") || qs("[data-field='env']"),

    executionIdInput: qs("#executionIdInput") || qs("#execution_id") || qs("[data-field='execution-id']"),
    targetWorkerIdInput: qs("#targetWorkerIdInput") || qs("#workerIdInput") || qs("[data-field='target-workerid']"),

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

    // opcional: área de telemetria / advanced
    telemetryBox: qs("#telemetryBox") || qs("[data-panel='telemetry']"),
  };
}

/* ============================================================
   INIT BOOTSTRAP
============================================================ */
// DOM-safe bootstrap (evita bind antes do HTML existir)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

function boot() {
  initPanelState();
  initButtonsController();

  hydrateFromLocalStorage();
  bindPersistence();

  // cria api base
  const api = createApiClient({
    enaviaBaseUrl: mustGetEnaviaUrl(),
    deployBaseUrl: mustGetDeployUrl(),
    internalToken: getTokenOrNull(),
    timeoutMs: 20000,
    debug: getDebug(),
  });

  // cria adapter (payloads corretos + tradução humana)
  const apiAdapter = buildApiAdapter(api);

  // liga orquestrador (botões -> fluxo -> api -> estado)
  initFlowOrchestrator(apiAdapter);

  // liga envio do chat “humano” (opcional, não interfere nos botões)
  bindChatSend();

  // estado inicial (execution_id / target / approved_by)
  seedRuntimeState();

  addChatMessage({
    role: "director",
    text: "Painel carregado. Pronto para seguir a ordem canônica: Audit → Propose → Apply Test → Deploy Teste → Fix Loop → Approve → Promote Real.",
    typing: true,
  });
}

/* ============================================================
   PERSISTÊNCIA (F5 não apaga nada)
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

  // approved_by é “interno” — não precisa estar visível, mas pode
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
   PAYLOAD BUILDERS (sem inventar schema)
============================================================ */
function getExecutionIdRequired() {
  const u = ui();
  const execution_id = (u.executionIdInput?.value || "").trim();
  if (!execution_id) throw new Error("execution_id obrigatório (preencha no painel).");
  updatePanelState({ execution_id });
  localStorage.setItem(LS.LAST_EXECUTION_ID, execution_id);
  return execution_id;
}

function getTargetRequired() {
  const u = ui();
  const workerId = (u.targetWorkerIdInput?.value || "").trim();
  if (!workerId) throw new Error("target.workerId obrigatório (preencha no painel).");
  updatePanelState({ target: { system: "TARGET_WORKER", workerId } });
  localStorage.setItem(LS.LAST_TARGET_WORKERID, workerId);
  return { system: "TARGET_WORKER", workerId };
}

function getPatchRequired() {
  const u = ui();
  const content = String(u.patchTextarea?.value || "").trim();
  if (!content) throw new Error("patch.content obrigatório (cole o patch no painel).");
  return { type: "patch_text", content };
}

function getApprovedBy() {
  const st = getPanelState();
  const approved_by = String(st?.approved_by || localStorage.getItem(LS.APPROVED_BY) || DEFAULTS.approved_by).trim();
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
   API ADAPTER (payloads corretos + relatórios humanos)
============================================================ */
function buildApiAdapter(api) {
  return {
    async audit(opts = {}) {
      // v1.1: AUDIT (read-only) aponta para ENAVIA
      const execution_id = getExecutionIdRequired();
      const target = getTargetRequired();
      const patch = getPatchRequired();

      const payload = {
        execution_id,
        mode: "enavia_audit",
        source: "NV-CONTROL",
        target,
        patch,
        constraints: {
          read_only: true,
          no_auto_apply: true,
        },
      };

      // PROPOSE (opcional) via mesmo endpoint, mas sinalizamos intenção
      if (opts.propose === true) {
        payload.ask_suggestions = true;
      }

      const r = await api.audit(payload);
      directorReportApi(opts.propose ? "PROPOSE (ENAVIA)" : "AUDIT (ENAVIA)", r);

      // Opcional: se veio audit.verdict, deixa no estado (não decide)
      try {
        const verdict = r?.data?.audit?.verdict;
        const risk = r?.data?.audit?.risk_level;
        if (verdict || risk) updatePanelState({ last_audit: { verdict, risk, ts: Date.now() } });
      } catch (_) {}

      return r;
    },

    async applyTest() {
      // v1.1: APPLY TEST grava STAGING, NÃO executa
      const execution_id = getExecutionIdRequired();
      const target = getTargetRequired();
      const patch = getPatchRequired();

      const payload = {
        execution_id,
        approved: true,
        approved_by: getApprovedBy(),
        target,
        patch: { content: patch.content }, // Deploy Worker espera patch.content
      };

      const r = await api.applyTest(payload);
      directorReportApi("APPLY TEST (STAGING)", r);
      return r;
    },

    async deployTest() {
      // v1.1: DEPLOY TESTE executa no TEST (gate técnico está no Deploy Worker)
      const execution_id = getExecutionIdRequired();
      const r = await api.deployTest({ execution_id });
      directorReportApi("DEPLOY TESTE (TEST)", r);
      return r;
    },

    async promoteReal() {
      // v1.1: PROMOTE REAL executa no PROD (somente após APPROVE humano)
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
      if (id.includes("chat") || id.includes("message") || df === "chat-input") return ae;
    }
    return null;
  };

  const safePrevent = (e) => {
    try { e.preventDefault(); } catch (_) {}
    try { e.stopPropagation(); } catch (_) {}
  };

  const send = () => {
    const el = pickChatEl();
    if (!el) return;

    const text = String(el.value || "").trim();
    if (!text) return;

    // mostra no chat como usuário
    addChatMessage({ role: "user", text });

    // limpa input (pedido)
    el.value = "";

    // Resposta padrão do Director (sem acionar execução por comando)
    // (Execução permanece por botões — contrato)
    directorSay(
      "Entendi. Se isso for uma ação do ciclo, use os botões na ordem canônica. Se quiser, me diga qual etapa você quer executar agora (Audit / Propose / Apply Test / Deploy Teste / Approve / Promote Real)."
    );
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
    u.sendBtn.addEventListener("click", (e) => {
      safePrevent(e);
      send();
    }, true);
  }

  if (u.chatInput) {
    u.chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        safePrevent(e);
        send();
      }
    }, true);
  }

  // 3) Delegação global (fallback) — cobre casos em que o HTML usa IDs diferentes
  document.addEventListener("keydown", (e) => {
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
  }, true);

  document.addEventListener("click", (e) => {
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
  }, true);
}
