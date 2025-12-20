/* ============================================================
   script.js — NV-Control / ENAVIA Panel (CANÔNICO)
============================================================ */

import { initPanelState, getPanelState, updatePanelState } from "./panel-state.js";
import { initButtonsController } from "./buttons-controller.js";
import { initFlowOrchestrator } from "./flow-orchestrator.js";
import { createApiClient } from "./api-client.js";
import { addChatMessage } from "./chat-renderer.js";
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
};

const DEFAULTS = {
  debug: false,
  env: "test",
  approved_by: "VASQUES",
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
   PAYLOAD BUILDERS (sem inventar schema)
============================================================ */
import { getExecutionId, getPanelState, updatePanelState } from "./panel-state.js";

/* ============================================================
   EXECUTION ID (CANÔNICO)
============================================================ */
function getExecutionIdRequired() {
  const execution_id = getExecutionId();

  if (!execution_id) {
    throw new Error("execution_id obrigatório.");
  }

  // compatibilidade legada (sync state + storage)
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
  const content = String(u.patchTextarea?.value || "").trim();

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

  addChatMessage({ role: "user", text });
  el.value = "";

  // Director cognitivo
  handleDirectorMessage(text);
}; // ← FECHA send AQUI

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
}   // ← fecha send()

/* ============================================================
   DIRECTOR — ROTEADOR COGNITIVO (FASE 1)
   - Conversa humana
   - Identificação de intenção
   - Nenhuma execução automática
============================================================ */
function handleDirectorMessage(text) {
  const t = String(text || "").toLowerCase().trim();

  // =========================
  // 1) CONVERSA HUMANA
  // =========================
  if (
    t === "oi" ||
    t === "olá" ||
    t.startsWith("oi ") ||
    t.startsWith("olá") ||
    t.includes("tá on") ||
    t.includes("esta on") ||
    t.includes("está on")
  ) {
    directorSay("Estou sim. O que você quer analisar ou executar agora?");
    return;
  }

  // =========================
  // 2) DÚVIDA / EXPLORAÇÃO
  // =========================
  if (
    t.includes("o que você faz") ||
    t.includes("como funciona") ||
    t.includes("me ajuda") ||
    t.includes("ajuda")
  ) {
    directorSay(
      "Posso te ajudar a analisar patches, avaliar riscos e executar o ciclo com segurança. O que você quer fazer agora?"
    );
    return;
  }

// =========================
// 3.1) CONFIRMAÇÃO DE CONSULTA À ENAVIA
// =========================
if (
  pendingEnaviaIntent &&
  (
    t === "sim" ||
    t === "ok" ||
    t === "pode" ||
    t === "confirmo" ||
    t.includes("pode analisar") ||
    t.includes("analisa") ||
    t.includes("analisar")
  )
) {
  const intent = pendingEnaviaIntent;
  pendingEnaviaIntent = null;

  directorSay("Perfeito. Consultando a ENAVIA agora, em modo seguro (read-only).");
  askEnaviaAnalysis(intent);
  return;
}

// =========================
// 3) INTENÇÃO TÉCNICA (SEM EXECUTAR)
// =========================
if (
  t.includes("audit") ||
  t.includes("analisar") ||
  t.includes("analisa") ||
  t.includes("deploy") ||
  t.includes("patch") ||
  t.includes("segurança") ||
  t.includes("risco")
) {
  pendingEnaviaIntent = text;

  directorSay(
    "Entendi sua intenção técnica. Quer que eu consulte a ENAVIA para analisar isso com segurança antes de qualquer ação? (responda: sim / analisar)"
  );
  return;
}

  // =========================
  // 4) FALLBACK INTELIGENTE
  // =========================
  directorSay(
    "Entendi. Pode detalhar um pouco melhor o que você quer fazer?"
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


