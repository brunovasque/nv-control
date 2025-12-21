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

         // garante patch no state (compatível com worker atual)
      if (!state.patch && typeof state.last_message === "string") {
      updatePanelState({ patch: state.last_message });
      }

        const payload = {
  execution_id: state.execution_id,
  mode: "audit",
  source: "nv-control",
  target: {
    workerId: "enavia-worker-teste",
  },
  patch: {
    type: "patch_text",
    content: state.patch || "// noop patch — test handshake",
  },
  constraints: {
    read_only: true,
    no_auto_apply: true,
  },
};

        // ✅ PROVA OBJETIVA (DevTools + Network)
        const baseUrl =
          api?.enaviaBaseUrl ||
          api?.baseUrl ||
          api?.config?.baseUrl ||
          api?.cfg?.baseUrl ||
          null;

        console.log("[CALLING ENAVIA AUDIT]", payload);
        console.log("[API BASE URL]", baseUrl);
        console.log("[API ADAPTER]", api);

        const res = await api.audit(payload);

        console.log("[ENAVIA AUDIT RESPONSE]", res);

        if (!res || res.ok === false) {
          updatePanelState({
            last_error: res?.error || "Falha na auditoria.",
          });
          return;
        }

        updatePanelState({
          patch_status: PATCH_STATUSES.AUDITED,
          last_error: null,
        });

        addChatMessage({
          role: "enavia",
          text: "Auditoria recebida. Análise em andamento.",
        });
      } catch (err) {
        console.error("[AUDIT ERROR]", err);
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
        // Mantido como estava, mas agora dentro do switch e com API real
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
  if (!apiAdapter) {
    console.warn("[FlowOrchestrator] apiAdapter ausente");
    return;
  }

  // ✅ INJEÇÃO CANÔNICA REAL (corrige a causa raiz)
  api = apiAdapter;

  // ✅ Ajuda DevTools (opcional e seguro): evidencia se a API existe
  if (typeof window !== "undefined") {
    window.api = apiAdapter;
  }

  document.addEventListener("panel:action", async (e) => {
    const action = e.detail?.action;
    if (!action) return;

    await handlePanelAction(action);
  });

  document.addEventListener("panel:action-blocked", (e) => {
    const action = e.detail?.action;
    explainBlockedAction(action);
  });
}
