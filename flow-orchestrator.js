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

import * as api from "./api-client.js";
import { addChatMessage } from "./chat-renderer.js";

/* ============================================================
   BLOQUEIO CANÔNICO DE AÇÃO
============================================================ */

function explainBlockedAction(action) {
  const messages = {
    audit: "Não é possível auditar neste estado.",
    propose:
      "Você pode pedir sugestões agora, mas para Apply Test o patch precisa estar AUDITADO.",
    apply_test:
      "Para aplicar em teste, o patch precisa estar AUDITADO.",
    approve:
      "A aprovação só é possível após o patch ter sido testado.",
    promote:
      "A promoção só é permitida após aprovação explícita.",
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
  const state = getPanelState();

  switch (action) {
    /* =========================
       AUDIT
    ========================== */
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
        const res = await api.audit();

        if (res && res.ok === false) {
          updatePanelState({
            last_error: res.error || "Falha na auditoria (audit).",
          });
          return;
        }

        updatePanelState({
          patch_status: PATCH_STATUSES.AUDITED,
          last_error: null,
        });
      } catch (err) {
        updatePanelState({
          last_error:
            err && err.message
              ? err.message
              : "Erro inesperado durante a auditoria.",
        });
      }

      break;
    }

    /* =========================
       PROPOSE
    ========================== */
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
        const res = await api.propose();

        if (res && res.ok === false) {
          updatePanelState({
            last_error:
              res.error || "Falha ao solicitar proposta técnica (propose).",
          });
          return;
        }

        updatePanelState({
          patch_status: PATCH_STATUSES.PROPOSED,
          last_error: null,
        });
      } catch (err) {
        updatePanelState({
          last_error:
            err && err.message
              ? err.message
              : "Erro inesperado durante o propose.",
        });
      }

      break;
    }

    /* =========================
       APPLY TEST (STAGING)
    ========================== */
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
            last_error:
              res.error || "Falha ao aplicar patch em staging (apply_test).",
          });
          return;
        }

        setPatchStatus(PATCH_STATUSES.STAGED);
        updatePanelState({ last_error: null });
      } catch (err) {
        updatePanelState({
          last_error:
            err && err.message
              ? err.message
              : "Erro inesperado durante apply_test.",
        });
      }

      break;
    }

    /* =========================
       APPROVE
    ========================== */
    case "approve": {
      if (!canTransitionTo(PATCH_STATUSES.APPROVED)) {
        return explainBlockedAction(action);
      }

      addChatMessage({
        role: "director",
        text: "Aprovando patch para produção.",
        typing: true,
      });

      updatePanelState({
        patch_status: PATCH_STATUSES.APPROVED,
        last_error: null,
      });

      break;
    }

    /* =========================
       PROMOTE REAL
    ========================== */
    case "promote": {
      if (!canTransitionTo(PATCH_STATUSES.APPLIED)) {
        return explainBlockedAction(action);
      }

      addChatMessage({
        role: "director",
        text: "Promovendo patch para produção real.",
        typing: true,
      });

      try {
        const res = await api.promoteReal();

        if (res && res.ok === false) {
          updatePanelState({
            last_error:
              res.error || "Falha ao promover patch para produção.",
          });
          return;
        }

        setPatchStatus(PATCH_STATUSES.APPLIED);
        updatePanelState({ last_error: null });
      } catch (err) {
        updatePanelState({
          last_error:
            err && err.message
              ? err.message
              : "Erro inesperado durante promote.",
        });
      }

      break;
    }

    /* =========================
       FALLBACK
    ========================== */
    default:
      console.warn("Ação desconhecida:", action);
  }
}
