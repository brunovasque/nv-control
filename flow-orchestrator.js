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

let api = null; // ← única fonte de verdade

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
    apply_test:
      "Para aplicar em teste, o patch precisa estar AUDITADO.",
    approve:
      "A aprovação só é possível após o patch ter sido testado.",
    promote:
      "A promoção só é permitida após aprovação explícita.",
    api_not_ready:
      "A API ainda não está conectada. Verifique as URLs no painel.",
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
        const res = await api.audit({ propose: false });
        if (res && res.ok === false) {
          updatePanelState({
            last_error: res.error || "Falha na auditoria.",
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
            err?.message || "Erro inesperado durante auditoria.",
        });
      }
      break;
    }

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
          last_error:
            err?.message || "Erro inesperado durante propose.",
        });
      }
      break;
    }

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
          last_error:
            err?.message || "Erro inesperado no apply_test.",
        });
      }
      break;
    }

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

    case "promote": {
      if (!canTransitionTo(PATCH_STATUSES.APPLIED)) {
        return explainBlockedAction(action);
      }

      try {
        const res = await api.promoteReal();
        if (res && res.ok === false) {
          updatePanelState({
            last_error: res.error || "Falha ao promover.",
          });
          return;
        }

        setPatchStatus(PATCH_STATUSES.APPLIED);
        updatePanelState({ last_error: null });
      } catch (err) {
        updatePanelState({
          last_error:
            err?.message || "Erro inesperado no promote.",
        });
      }
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

  api = apiAdapter; // ✅ INJEÇÃO CANÔNICA

  document.addEventListener("panel:action", async (e) => {
    const action = e.detail?.action;
    if (!action) return;
    await handlePanelAction(action);
  });

  document.addEventListener("panel:action-blocked", (e) => {
    const action = e.detail?.action || e.detail?.reason;
    explainBlockedAction(action);
  });
}
