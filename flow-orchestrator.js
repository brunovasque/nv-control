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

/* ============================================================
   API INJETADO (CANÔNICO — VIA initFlowOrchestrator)
============================================================ */

let api = null; // ← única fonte de verdade (injeção real no init)

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

    // ✅🔥 ESTE É O PONTO CRÍTICO (RESTAURADO)
    updatePanelState({
      patch_status: PATCH_STATUSES.AUDITED,
      audit: audit,
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
        const res = await api.audit({ propose: true });

        if (res && res.ok === false) {
          updatePanelState({
            last_error: res.error || "Falha no propose.",
          });
          return;
        }

        updatePanelState({
          patch_status: PATCH_STATUSES.PROPOSED,
          last_error: null,
        });
      } catch (err) {
        updatePanelState({
          last_error: err?.message || "Erro inesperado durante propose.",
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

  // ✅ Ajuda DevTools (opcional e seguro)
  if (typeof window !== "undefined") {
    window.api = apiAdapter;
    window.__NV_FLOW_BOUND__ = true;
  }

  console.log("[FlowOrchestrator] bound. hasApi:", !!api);

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
}
