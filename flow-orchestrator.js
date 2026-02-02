/* ============================================================
   FLOW ORCHESTRATOR — NV-CONTROL
   Interpreta ações do painel e coordena chamadas à API
============================================================ */

import {
  getPanelState,
  updatePanelState,
  setPatchStatus,
  canTransitionTo,
  PATCH_STATUSES,
} from "./panel-state.js";

import { addChatMessage } from "./chat-renderer.js";
import { buildPlanFromDirectorChat } from "./directorPlanBuilder.js";

// ✅ NOVO (BRIDGE): chama run-adapter via /run (porta 3200)
import { callBrowserRunAdapter } from "../lib/browser-run-client.js";

/* ============================================================
   API INJETADO (CANÔNICO — VIA initFlowOrchestrator)
============================================================ */

let api = null; // ← única fonte de verdade (injeção real no init)

// Máximo de ciclos automáticos PROPOSE ← AUDIT por execução
const MAX_AUTO_REFINE_LOOPS = 4;

/* ============================================================
   EXECUTION LOCK — BROWSER (CANÔNICO / GLOBAL)
   - NÃO interfere no fluxo Cloudflare
   - execução única por vez
============================================================ */

let activeBrowserExecutionId = null;

function isBrowserExecutionLocked() {
  return typeof activeBrowserExecutionId === "string" && activeBrowserExecutionId.length > 0;
}

function tryLockBrowserExecution(executionId) {
  if (isBrowserExecutionLocked()) return false;
  activeBrowserExecutionId = executionId || "unknown_execution";
  return true;
}

function unlockBrowserExecution(executionId) {
  // libera somente se for o mesmo ID (protege contra race)
  if (!isBrowserExecutionLocked()) return;

  if (!executionId || activeBrowserExecutionId === executionId) {
    activeBrowserExecutionId = null;
  }
}

/* ============================================================
   GUARDA — API
============================================================ */

function ensureApiOrBlock(action) {
  if (api) return true;

  console.error("[FlowOrchestrator] API não injetada");
  document.dispatchEvent(
    new CustomEvent("panel:action-blocked", {
      detail: { action, reason: "api_not_ready" },
    })
  );
  return false;
}

/* ============================================================
   BLOQUEIO CANÔNICO DE AÇÃO
============================================================ */

function explainBlockedAction(action) {
  const messages = {
    audit: "Não é possível auditar neste estado.",
    propose:
      "Você pode pedir sugestões agora, mas para Apply Test o patch precisa estar AUDITADO.",
    apply_test: "Para aplicar em teste, o patch precisa estar AUDITADO.",
    deploy_test: "Para executar em teste, o patch precisa estar STAGED/TESTÁVEL.",
    approve: "A aprovação só é possível após o patch ter sido testado.",
    promote_real: "A promoção só é permitida após aprovação explícita.",
    rollback: "Rollback indisponível no estado atual.",
    cancel: "Cancelamento indisponível no estado atual.",
    api_not_ready: "A API ainda não está conectada. Verifique as URLs no painel.",
  };

  addChatMessage({
    role: "director",
    text: messages[action] || "Ação bloqueada pelo estado atual.",
  });
}

/* ============================================================
   LOOP COGNITIVO AUTOMÁTICO (AUDIT ⇄ PROPOSE)
   - Tenta refinar o patch algumas vezes com base no último audit
   - NÃO aplica nem faz deploy, só gera novo patch + re-audita
============================================================ */
async function maybeRunAutoRefineFromAudit() {
  try {
    if (!api || typeof api.propose !== "function") {
      return;
    }

    if (typeof getPanelState !== "function") {
      return;
    }

    const state = getPanelState() || {};

    // Respeita a máquina de estados: só sai de AUDITED → PROPOSED
    if (!canTransitionTo(PATCH_STATUSES.PROPOSED)) {
      return;
    }

    const summary =
      state && typeof state.loop_last_audit_summary === "object"
        ? state.loop_last_audit_summary
        : null;

    if (!summary) {
      return;
    }

    const currentCount =
      typeof state.loop_auto_refine_count === "number" &&
      Number.isFinite(state.loop_auto_refine_count)
        ? state.loop_auto_refine_count
        : 0;

    if (currentCount >= MAX_AUTO_REFINE_LOOPS) {
      addChatMessage({
        role: "director",
        text:
          "A ENAVIA já tentou refinar automaticamente o patch algumas vezes. " +
          "Agora é melhor ajustar manualmente o patch ou pedir um PROPOSE direto.",
      });
      return;
    }

    const verdict =
      typeof summary.verdict === "string"
        ? summary.verdict.toLowerCase()
        : null;
    const risk =
      typeof summary.risk_level === "string"
        ? summary.risk_level.toLowerCase()
        : null;

    const findings = Array.isArray(summary.findings)
      ? summary.findings
      : [];
    const recommended = Array.isArray(summary.recommended_changes)
      ? summary.recommended_changes
      : [];
    const blockers = Array.isArray(summary.blockers)
      ? summary.blockers
      : [];
    const issues = Array.isArray(summary.issues)
      ? summary.issues
      : [];
    const nextActions = Array.isArray(summary.next_actions)
      ? summary.next_actions
      : [];

    const hasProblems =
      blockers.length > 0 ||
      issues.length > 0 ||
      findings.length > 0 ||
      recommended.length > 0 ||
      (verdict && verdict !== "approve");

    const wantsPropose =
      nextActions.includes("propose_safe_patch") ||
      nextActions.includes("auto_refine");

    // Se auditoria está limpa e não pediu propose, não faz nada
    if (!hasProblems && !wantsPropose) {
      return;
    }

    const rootObjective =
      typeof state.loop_objective_root === "string" &&
      state.loop_objective_root.trim().length > 0
        ? state.loop_objective_root.trim()
        : typeof state.last_message === "string" &&
          state.last_message.trim().length > 0
        ? state.last_message.trim()
        : "";

    const objectiveParts = [];

    if (rootObjective) {
      objectiveParts.push(rootObjective);
    }

    const summaryChunks = [];

    const safeJson = (value) => {
      try {
        return JSON.stringify(value).slice(0, 400);
      } catch (_e) {
        return String(value);
      }
    };

    if (blockers.length) {
      summaryChunks.push(
        "Blockers: " + safeJson(blockers.slice(0, 3))
      );
    }
    if (issues.length) {
      summaryChunks.push("Issues: " + safeJson(issues.slice(0, 3)));
    }
    if (findings.length) {
      summaryChunks.push(
        "Findings: " + safeJson(findings.slice(0, 3))
      );
    }
    if (recommended.length) {
      summaryChunks.push(
        "Recomendações: " + safeJson(recommended.slice(0, 3))
      );
    }

    objectiveParts.push(
      "Refine o patch atual para resolver os problemas apontados na última auditoria, " +
        "sem aplicar nem fazer deploy. Foque em um patch LOW-RISK alinhado ao objetivo original."
    );

    if (summaryChunks.length) {
      objectiveParts.push(
        "Resumo da última auditoria:\n" + summaryChunks.join("\n")
      );
    }

    const objective = objectiveParts.join("\n\n");

    const patchText =
      typeof state.patch === "string" && state.patch.trim().length > 0
        ? state.patch.trim()
        : null;

    addChatMessage({
      role: "director",
      text:
        "A ENAVIA vai tentar refinar automaticamente o patch com base na última auditoria.",
    });

    const res = await api.propose({
      objective,
      ...(patchText ? { patch: patchText } : {}),
    });

    console.log("[ENAVIA AUTO-REFINE PROPOSE RESPONSE]", res);

    if (typeof window !== "undefined") {
      window.__LAST_PROPOSE_RESPONSE__ = res;
    }

    const data = res?.data || null;
    const proposePayload = data?.propose || null;
    const proposeResult = proposePayload?.result || null;

    const patchObj =
      (proposeResult && proposeResult.patch) || proposePayload?.patch || null;

    let patchFromPropose = null;
    if (patchObj) {
      try {
        patchFromPropose = JSON.stringify(patchObj, null, 2);
      } catch (jsonErr) {
        console.warn(
          "[AUTO-REFINE PROPOSE] Falha ao serializar patch:",
          jsonErr
        );
      }
    }

    const rootForState =
      state.loop_objective_root && state.loop_objective_root.trim().length > 0
        ? state.loop_objective_root.trim()
        : rootObjective || objective || "auto_refine_from_audit";

    const patchUpdate = {
      patch_status: PATCH_STATUSES.PROPOSED,
      last_error: null,
      loop_objective_root: rootForState,
      loop_auto_refine_count: currentCount + 1,
      loop_last_propose: proposePayload || null,
    };

    if (patchFromPropose) {
      patchUpdate.patch = patchFromPropose;
    }

    updatePanelState(patchUpdate);

    addChatMessage({
      role: "enavia",
      text:
        "[AUTO PROPOSE RESULT]\n" + JSON.stringify(res, null, 2),
    });

    // 🔁 Re-audita automaticamente o patch refinado
    await handlePanelAction("audit");
  } catch (err) {
    console.error("[AUTO-REFINE PROPOSE ERROR]", err);
    updatePanelState({
      last_error:
        err?.message ||
        "Erro inesperado durante refinamento automático (propose).",
    });
    addChatMessage({
      role: "enavia",
      text:
        "Erro no refinamento automático (PROPOSE a partir do AUDIT): " +
        (err?.message || "erro inesperado"),
    });
  }
}

/* ============================================================
   ORQUESTRADOR PRINCIPAL
============================================================ */

export async function handlePanelAction(action) {
  // 🔎 DIAGNÓSTICO REAL (antes de qualquer guarda/switch)
  console.log("[handlePanelAction] called:", {
    action,
    hasApi: !!api,
    patch_status: getPanelState?.()?.patch_status,
  });

  if (!ensureApiOrBlock(action)) return;

  switch (action) {
    // ============================================================
    // AUDIT
    // ============================================================
    case "audit": {
      if (!canTransitionTo(PATCH_STATUSES.AUDITED)) {
        return explainBlockedAction(action);
      }

      addChatMessage({
        role: "director",
        text: "Vou enviar o patch para auditoria da ENAVIA.",
        typing: true,
      });

      try {
        const state = getPanelState();

        // 🔒 Garante patch como STRING (flow NÃO encapsula)
        const patchText =
          typeof state.patch === "string"
            ? state.patch
            : typeof state.last_message === "string"
            ? state.last_message
            : "// noop patch — test handshake";

        const res = await api.audit({ patch: patchText });

         // salva o último audit response pra inspeção no DevTools
         if (typeof window !== "undefined") {
           window.__LAST_AUDIT_RESPONSE__ = res;
         }

        console.log("[ENAVIA AUDIT RESPONSE]", res);

        if (!res || res.ok === false) {
          updatePanelState({
            last_error: res?.error || "Falha na auditoria.",
          });
          return;
        }

        const audit = res?.data?.audit;

        if (!audit) {
          addChatMessage({
            role: "director",
            text:
              "A auditoria retornou sem um veredito válido. " +
              "Não é possível avançar com segurança.",
          });
          return;
        }

        // 🧠 Resumo estruturado do último audit (pra loop cognitivo)
        const auditSummary = {
          verdict: audit.verdict,
          risk_level: audit.risk_level,
          findings: Array.isArray(audit.findings) ? audit.findings : [],
          recommended_changes: Array.isArray(audit.recommended_changes)
            ? audit.recommended_changes
            : [],
          blockers: Array.isArray(audit.blockers) ? audit.blockers : [],
          issues: Array.isArray(audit?.details?.patch_syntax?.issues)
            ? audit.details.patch_syntax.issues
            : [],
          next_actions: Array.isArray(audit.next_actions)
            ? audit.next_actions
            : Array.isArray(audit?.dm_stamp?.next_actions)
            ? audit.dm_stamp.next_actions
            : [],
        };

        // ✅ Mantém comportamento atual + grava memória do audit
        updatePanelState({
          patch_status: PATCH_STATUSES.AUDITED,
          audit,
          loop_last_audit_summary: auditSummary,
          last_error: null,
        });

        const normalizedRisk =
          typeof audit.risk_level === "string"
            ? audit.risk_level.toLowerCase()
            : null;

        const hasFindings =
          Array.isArray(audit.findings) && audit.findings.length > 0;

        const hasRecommendations =
          Array.isArray(audit.recommended_changes) &&
          audit.recommended_changes.length > 0;

        // ============================================================
        // 🧠 DIRECTOR — ORIENTAÇÃO HUMANA (DECISÃO)
        // ============================================================
        if (
          audit.verdict === "approve" &&
          normalizedRisk === "low" &&
          !hasFindings &&
          !hasRecommendations
        ) {
          addChatMessage({
            role: "director",
            text:
              "A ENAVIA analisou o patch, não encontrou bloqueadores e " +
              "classificou o risco como baixo. Você já pode seguir para o Apply Test.",
          });
        } else if (audit.verdict === "approve") {
          addChatMessage({
            role: "director",
            text:
              "O patch é funcional, mas a ENAVIA identificou pontos de melhoria técnica. " +
              "Recomendo utilizar o Propose antes de avançar para testes.",
          });
        } else {
          addChatMessage({
            role: "director",
            text:
              "A ENAVIA identificou bloqueadores técnicos no patch. " +
              "Não é seguro avançar para testes neste estado.",
          });
        }

        // ⏳ pausa humana de leitura
        await new Promise((r) => setTimeout(r, 1200));

        // ============================================================
        // 🤖 ENAVIA — RESPOSTA CONTEXTUAL (ASSÍNCRONA)
        // ============================================================
        if (
          audit.verdict === "approve" &&
          normalizedRisk === "low" &&
          !hasFindings &&
          !hasRecommendations
        ) {
          addChatMessage({
            role: "enavia",
            text: "Analisando resultado da auditoria…",
            typing: true,
          });

          setTimeout(() => {
            addChatMessage({
              role: "enavia",
              text:
                "Auditoria concluída. Patch aprovado com risco baixo. " +
                "Pronto para Apply Test quando você decidir.",
            });
          }, 1500);
        } else if (audit.verdict === "approve") {
          addChatMessage({
            role: "enavia",
            text: "Avaliando recomendações técnicas…",
            typing: true,
          });

          setTimeout(() => {
            addChatMessage({
              role: "enavia",
              text:
                "Auditoria concluída. O patch é válido, mas recomenda-se refinamento " +
                "antes da execução em teste.",
            });
          }, 1500);
        } else {
          addChatMessage({
            role: "enavia",
            text: "Identificando bloqueadores técnicos…",
            typing: true,
          });

          setTimeout(() => {
            addChatMessage({
              role: "enavia",
              text:
                "Auditoria concluída com bloqueadores técnicos. " +
                "É necessário ajustar o patch antes de qualquer teste.",
            });
          }, 1500);
        }
      } catch (err) {
        console.error("[AUDIT FLOW ERROR]", err);

        updatePanelState({
          last_error: err?.message || "Erro inesperado durante auditoria.",
        });
      }

      // 🔁 LOOP COGNITIVO: se a última auditoria apontar problemas,
      // dispara um PROPOSE automático de refinamento (sem apply/deploy).
      await maybeRunAutoRefineFromAudit();

      break;
    }

    // ============================================================
    // PROPOSE
    // ============================================================
    case "propose": {
      if (!canTransitionTo(PATCH_STATUSES.PROPOSED)) {
        return explainBlockedAction(action);
      }

      addChatMessage({
        role: "director",
        text:
          "Vou pedir à ENAVIA uma sugestão de melhoria técnica, sem executar nada.",
        typing: true,
      });

      try {
        const state = getPanelState();

        // 🔒 PROPOSE só roda com pedido explícito (objetivo) — NÃO inventa patch
let objective =
  typeof state.last_message === "string" ? String(state.last_message).trim() : "";

const patchRaw = typeof state.patch === "string" ? String(state.patch).trim() : "";

let objectiveCameFromPatch = false;

// ✅ fallback: permitir objetivo vindo do PATCH (sem depender do chat)
// - se vier com "OBJ:", remove o prefixo
// - se vier sem prefixo, assume que é objetivo (e NÃO trata como patch)
if (!objective && patchRaw) {
  objective = /^OBJ\s*:/i.test(patchRaw)
    ? patchRaw.replace(/^OBJ\s*:/i, "").trim()
    : patchRaw;

  objectiveCameFromPatch = true;
}

if (!objective) {
  addChatMessage({
    role: "director",
    text:
      "Antes do PROPOSE, escreva no chat exatamente o que você quer que eu proponha " +
      "OU cole o objetivo no PATCH (ex: melhorias low-risk de logs) e clique PROPOSE de novo.",
  });
  return;
}

// Patch é opcional: só manda se você colou algo de verdade no campo PATCH
// ⚠️ Se o objetivo veio do PATCH, NÃO envie patch (senão vira patch fake)
const patchText =
  !objectiveCameFromPatch && patchRaw ? patchRaw : null;

// ✅ PROPOSE: envia objetivo; patch só se existir
const res = await api.propose({
  objective,
  ...(patchText ? { patch: patchText } : {}),
});

        console.log("[ENAVIA PROPOSE RESPONSE]", res);

        // opcional: expõe pra debug
        if (typeof window !== "undefined") {
          window.__LAST_PROPOSE_RESPONSE__ = res;
        }

        if (res && res.ok === false) {
          updatePanelState({
            last_error: res.error || "Falha no propose.",
          });
          addChatMessage({
            role: "enavia",
            text: "Falha no PROPOSE: " + (res.error || "erro desconhecido"),
          });
          return;
        }

       // 🧠 Extrai patch sugerido (se houver) do retorno da ENAVIA
        const data = res?.data || null;
        const proposePayload = data?.propose || null;
        const proposeResult = proposePayload?.result || null;

        const patchObj =
          proposeResult?.patch ||
          proposePayload?.patch ||
          null;

        let patchFromPropose = null;

        if (patchObj) {
          try {
            patchFromPropose = JSON.stringify(patchObj, null, 2);
          } catch (jsonErr) {
            console.warn("[PROPOSE] Falha ao serializar patch:", jsonErr);
          }
        }

        // 🧠 Atualiza memória do loop (objetivo raiz + última proposta)
        const currentState = getPanelState?.() || {};
        const rootObjective =
          typeof currentState.loop_objective_root === "string" &&
          currentState.loop_objective_root.trim().length > 0
            ? currentState.loop_objective_root
            : objective;

        const patchUpdate = {
          patch_status: PATCH_STATUSES.PROPOSED,
          last_error: null,
          loop_objective_root: rootObjective,
          loop_auto_refine_count: 0,
          loop_last_propose: proposePayload || null,
        };

        // Se veio patch real do PROPOSE, joga no campo PATCH
        if (patchFromPropose) {
          patchUpdate.patch = patchFromPropose;
        }

        updatePanelState(patchUpdate);

        // ✅ mostra retorno no chat (continua igual, mas agora com estado atualizado)
        addChatMessage({
          role: "enavia",
          text: "[PROPOSE RESULT]\n" + JSON.stringify(res, null, 2),
        });
      } catch (err) {
        console.error("[PROPOSE FLOW ERROR]", err);

        updatePanelState({
          last_error: err?.message || "Erro inesperado durante propose.",
        });

        addChatMessage({
          role: "enavia",
          text: "Erro no PROPOSE: " + (err?.message || "erro inesperado"),
        });
      }
      break;
    }

    // ============================================================
    // APPLY TEST (gera staging)
    // ============================================================
    case "apply_test": {
      if (!canTransitionTo(PATCH_STATUSES.STAGED)) {
        return explainBlockedAction(action);
      }

      addChatMessage({
        role: "director",
        text:
          "Patch aprovado. Vou gerar o staging para teste, sem executar código.",
        typing: true,
      });

      try {
        const res = await api.applyTest();

        if (res && res.ok === false) {
          updatePanelState({
            last_error: res.error || "Falha no apply_test.",
          });
          return;
        }

        setPatchStatus(PATCH_STATUSES.STAGED);
        updatePanelState({ last_error: null });
      } catch (err) {
        updatePanelState({
          last_error: err?.message || "Erro inesperado no apply_test.",
        });
      }
      break;
    }

    // ============================================================
    // DEPLOY TESTE (EXECUÇÃO EM TEST)
    // ============================================================
    case "deploy_test": {
      if (!canTransitionTo(PATCH_STATUSES.TESTED)) {
        return explainBlockedAction(action);
      }

      addChatMessage({
        role: "director",
        text: "Vou executar o deploy no ambiente de TESTE com segurança.",
        typing: true,
      });

      try {
        const res = await api.deployTest();

        if (res && res.ok === false) {
          updatePanelState({
            patch_status: PATCH_STATUSES.TEST_FAILED,
            last_error: res.error || "Falha no deploy de teste.",
          });
          return;
        }

        updatePanelState({
          patch_status: PATCH_STATUSES.TESTED,
          last_error: null,
        });
      } catch (err) {
        updatePanelState({
          patch_status: PATCH_STATUSES.TEST_FAILED,
          last_error: err?.message || "Erro inesperado no deploy_test.",
        });
      }
      break;
    }

    // ============================================================
    // APPROVE (HUMANO)
    // ============================================================
    case "approve": {
      if (!canTransitionTo(PATCH_STATUSES.APPROVED)) {
        return explainBlockedAction(action);
      }

      updatePanelState({
        patch_status: PATCH_STATUSES.APPROVED,
        last_error: null,
      });
      break;
    }

    // ============================================================
    // PROMOTE REAL (PRODUÇÃO)
    // ============================================================
    case "promote_real": {
      if (!canTransitionTo(PATCH_STATUSES.APPLIED)) {
        return explainBlockedAction(action);
      }

      addChatMessage({
        role: "director",
        text: "Promovendo patch para PRODUÇÃO.",
        typing: true,
      });

      try {
        const res = await api.promoteReal();

        if (res && res.ok === false) {
          updatePanelState({
            last_error: res.error || "Falha ao promover para produção.",
          });
          return;
        }

        setPatchStatus(PATCH_STATUSES.APPLIED);
        updatePanelState({ last_error: null });
      } catch (err) {
        updatePanelState({
          last_error: err?.message || "Erro inesperado no promote_real.",
        });
      }
      break;
    }

    // ============================================================
    // ROLLBACK
    // ============================================================
    case "rollback": {
      addChatMessage({
        role: "director",
        text: "Executando rollback do patch.",
        typing: true,
      });

      try {
        const res = await api.rollback();

        if (res && res.ok === false) {
          updatePanelState({
            last_error: res.error || "Falha no rollback.",
          });
          return;
        }

        updatePanelState({
          patch_status: PATCH_STATUSES.IDLE,
          last_error: null,
        });
      } catch (err) {
        updatePanelState({
          last_error: err?.message || "Erro inesperado no rollback.",
        });
      }
      break;
    }

    // ============================================================
    // CANCELAR CICLO
    // ============================================================
    case "cancel": {
      addChatMessage({
        role: "director",
        text: "Cancelando ciclo atual e limpando estado.",
        typing: true,
      });

      try {
        const res = await api.cancel();

        if (res && res.ok === false) {
          updatePanelState({
            last_error: res.error || "Falha ao cancelar ciclo.",
          });
          return;
        }

        updatePanelState({
          patch_status: PATCH_STATUSES.IDLE,
          last_error: null,
        });
      } catch (err) {
        updatePanelState({
          last_error: err?.message || "Erro inesperado no cancel.",
        });
      }
      break;
    }

    // ============================================================
    // DEFAULT
    // ============================================================
    default: {
      console.warn("[handlePanelAction] Ação desconhecida:", action);
      break;
    }
  }
}

/* ============================================================
   EXECUÇÃO BROWSER (FORA DO FLUXO DE BOTÕES)
   - NÃO altera estado
   - NÃO usa PATCH_STATUSES
   - NÃO interfere no Cloudflare
============================================================ */

async function executeBrowserPlan(plan) {
  const execId = plan?.execution_id || "unknown_execution";

  // 🔒 trava global (execução única)
  if (!tryLockBrowserExecution(execId)) {
    addChatMessage({
      role: "director",
      text:
        "Existe uma execução em andamento. Aguarde finalizar antes de iniciar outra.",
    });
    return;
  }

  try {
    addChatMessage({
      role: "director",
      text: "Plano aprovado. Enviando execução ao Browser Executor.",
      typing: true,
    });

    if (typeof window.callBrowserExecutor !== "function") {
      throw new Error("Browser Executor não disponível no window.");
    }

    const result = await window.callBrowserExecutor(plan);

    // 🔁 LOOP DE RETORNO AO DIRETOR
    addChatMessage({
      role: "executor",
      text: JSON.stringify(result, null, 2),
    });

    // opcional: reporta também para endpoint do diretor
    if (typeof window.reportToDirector === "function") {
      await window.reportToDirector({
        type: "browser_execution_result",
        execution_id: execId,
        result,
      });
    }
  } catch (err) {
    console.error("[BrowserExecutionError]", err);

    addChatMessage({
      role: "director",
      text:
        "Erro durante execução no browser:\n" +
        (err?.message || "Erro desconhecido"),
    });

    if (typeof window.reportToDirector === "function") {
      await window.reportToDirector({
        type: "browser_execution_error",
        execution_id: execId,
        error: err?.message || String(err),
      });
    }
  } finally {
    // ✅ garante liberação do lock sempre
    unlockBrowserExecution(execId);
  }
}

/* ============================================================
   CHAT → PLAN → DISPATCH (CANÔNICO / SIMPLES)
   - O chat do Diretor é a autoridade
   - Só dispara se tiver "executar"
============================================================ */

function dispatchBrowserExecute(plan) {
  document.dispatchEvent(
    new CustomEvent("browser:execute", { detail: { plan } })
  );
}

// Exposto no window para o chat do painel chamar (ou via DevTools).
// Exemplo de teste manual:
//   window.__NV_DIRECTOR_CHAT_EXECUTE__("executar abrir https://example.com");
function bindDirectorChatExecuteHook() {
  if (typeof window === "undefined") return;

  // evita rebind
  if (window.__NV_DIRECTOR_CHAT_EXECUTE_BOUND__ === true) return;
  window.__NV_DIRECTOR_CHAT_EXECUTE_BOUND__ = true;

  window.__NV_DIRECTOR_CHAT_EXECUTE__ = async function (messageText) {
    // trava: execução única global
    if (isBrowserExecutionLocked()) {
      addChatMessage({
        role: "director",
        text:
          "Existe uma execução em andamento. Aguarde finalizar antes de pedir outra.",
      });
      return { ok: false, reason: "execution_locked" };
    }

    const built = buildPlanFromDirectorChat(messageText);

    if (!built?.ok) {
      addChatMessage({
        role: "director",
        text: built?.error || "Não foi possível montar o plano.",
      });
      return built;
    }

    // ✅ dispatch canônico
    dispatchBrowserExecute(built.plan);
    return { ok: true, dispatched: true, execution_id: built.plan.execution_id };
  };

  // Ajuda debug: estado do lock
  window.__NV_GET_BROWSER_EXEC_LOCK__ = () => activeBrowserExecutionId;
}

/* ============================================================
   BIND DE EVENTOS DO PAINEL (CANÔNICO)
============================================================ */

export function initFlowOrchestrator(apiAdapter) {
  // ✅ bind único (evita duplicar listeners)
  if (typeof window !== "undefined" && window.__NV_FLOW_BOUND__ === true) {
    console.log("[FlowOrchestrator] init ignorado (já bound)");
    // mesmo assim atualiza a injeção, se vier nova
    api = apiAdapter || api;
    return;
  }

  if (!apiAdapter) {
    // ⚠️ NÃO retorna: precisamos bindar para enxergar o bloqueio
    console.warn("[FlowOrchestrator] apiAdapter ausente (bind será feito mesmo assim)");
  }

  // ✅ INJEÇÃO CANÔNICA REAL (se vier null, api fica null e a guarda bloqueia)
  api = apiAdapter || null;

 // ✅ HOTFIX: se o apiAdapter vier sem propose, injeta implementação mínima (somente ENAVIA)
  // - NÃO toca Deploy Worker
  // - NÃO toca Browser Executor
  if (api && typeof api.propose !== "function") {
    api = {
      ...api,
      propose: async function ({ objective, patch } = {}) {
  // ✅ CONTRATO: PROPOSE -> POST /propose (NÃO /audit)
  const enaviaBaseUrl = String(localStorage.getItem("nv_enavia_url") || "").replace(/\/$/, "");
  if (!enaviaBaseUrl) {
    throw new Error("PROPOSE_ERROR: nv_enavia_url ausente no localStorage.");
  }

  const objectiveText = String(objective || "").trim();
  if (!objectiveText) {
    throw new Error("PROPOSE_ERROR: objective ausente. Escreva o pedido no chat antes de clicar PROPOSE.");
  }

  const state = getPanelState?.() || {};
  const execution_id = state.execution_id || null;

  const envMode = String(localStorage.getItem("nv_env") || "test").trim().toLowerCase();
  const lsTest = String(localStorage.getItem("nv_worker_test") || "").trim();
  const lsProd = String(localStorage.getItem("nv_worker_real") || "").trim();
  const inputVal = String(document.getElementById("targetWorkerIdInput")?.value || "").trim();

  // PRIORIDADE: sempre o que está no input; LS só entra como fallback
const rawWorker =
  inputVal ||
  (envMode === "prod" ? lsProd : lsTest);

// DEBUG temporário pra ver o que está indo pro PROPOSE
console.log("[NV DEBUG PROPOSE WORKER RESOLVE]", {
  envMode,
  lsTest,
  lsProd,
  inputVal,
  rawWorker,
});

  const normalizeWorkerId = (v) => {
    let s = String(v || "").trim();
    if (!s) return "";
    s = s.replace(/^https?:\/\//i, "");
    s = s.split("/")[0].split("?")[0].split("#")[0];
    if (s.includes(".")) s = s.split(".")[0];
    return s.trim();
  };

  const workerId = normalizeWorkerId(rawWorker);
  if (!workerId) {
    throw new Error(
      "PROPOSE_ERROR: target.workerId ausente. Defina nv_worker_test/nv_worker_real ou preencha o targetWorkerIdInput."
    );
  }

  const payload = {
    ...(execution_id ? { execution_id } : {}),
    source: "nv-control",
    mode: "enavia_propose",
    target: { system: "cloudflare_worker", workerId },
    ask_suggestions: true,
    prompt: objectiveText,
    intent: { objective: objectiveText },
    constraints: { read_only: true, no_auto_apply: true },
    timestamp: Date.now(),
    ...(typeof patch === "string" && patch.trim()
      ? { patch: { type: "patch_text", content: String(patch).trim() } }
      : {}),
  };

  const res = await fetch(`${enaviaBaseUrl}/propose`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const text = await res.text().catch(() => "");
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

  if (!res.ok || data?.ok === false) {
    return { ok: false, http_status: res.status, error: data?.error || `HTTP_${res.status}`, data };
  }

  return { ok: true, http_status: res.status, data };
      },
    };
  }

  // ✅ Ajuda DevTools (opcional e seguro)
  if (typeof window !== "undefined") {
    window.api = api; // <-- importante: expõe a API FINAL (com propose, se foi injetado)
    window.__NV_FLOW_BOUND__ = true;

    // ✅ NOVO: garante Browser Executor no window (bridge para run-adapter)
    // - não sobrescreve se outra parte já tiver definido
    if (typeof window.callBrowserExecutor !== "function") {
      window.callBrowserExecutor = async function (plan) {
        // transporte puro: plan -> POST /run
        return await callBrowserRunAdapter(plan);
      };
    }
  }

  console.log("[FlowOrchestrator] bound. hasApi:", !!api);

  // ✅ hook canônico (chat → execução)
  bindDirectorChatExecuteHook();

  document.addEventListener("panel:action", async (e) => {
    const action = e.detail?.action;
    console.log("[FlowOrchestrator] event panel:action:", e?.detail);
    if (!action) return;

    await handlePanelAction(action);
  });

  document.addEventListener("panel:action-blocked", (e) => {
    console.log("[FlowOrchestrator] event panel:action-blocked:", e?.detail);
    const action = e.detail?.action;
    explainBlockedAction(action);
  });

  // 🔹 EXECUÇÃO BROWSER VIA PROMPT (ISOLADO)
  document.addEventListener("browser:execute", async (e) => {
    const plan = e.detail?.plan;
    if (!plan) return;

    console.log("[FlowOrchestrator] event browser:execute", plan);
    await executeBrowserPlan(plan);
  });
}
