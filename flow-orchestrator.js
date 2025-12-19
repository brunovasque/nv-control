/* ============================================================
   FLOW ORCHESTRATOR — ENAVIA PANEL
   Coordena intenções → valida estado → chama API → atualiza estado
============================================================ */

import {
  getPanelState,
  setPatchStatus,
  canTransitionTo,
  PATCH_STATUSES,
  updatePanelState,
  resetPanelState,
} from "./panel-state.js";

import {
  addChatMessage,
} from "./chat-renderer.js";

/* ============================================================
   INIT
============================================================ */

export function initFlowOrchestrator(apiClient) {
  if (!apiClient) {
    console.error("[flow-orchestrator] apiClient não fornecido.");
    return;
  }

  document.addEventListener("panel:action", (e) => {
    handleAction(e.detail.action, apiClient);
  });

  document.addEventListener("panel:action-blocked", (e) => {
    explainBlockedAction(e.detail.action);
  });
}

/* ============================================================
   ACTION HANDLER
============================================================ */

async function handleAction(action, api) {
  const state = getPanelState();

  switch (action) {

    /* ---------------- AUDIT ---------------- */
    case "audit":
  if (!canTransitionTo(PATCH_STATUSES.AUDITED)) {
    return explainBlockedAction(action);
  }

  addChatMessage({
    role: "director",
    text: "Vou enviar o patch para auditoria da ENAVIA.",
    typing: true,
  });

  await api.audit();

  updatePanelState({ patch_status: PATCH_STATUSES.AUDITED });
  break;

    /* ---------------- PROPOSE ---------------- */
    case "propose":
  if (!canTransitionTo(PATCH_STATUSES.PROPOSED)) {
    return explainBlockedAction(action);
  }

  addChatMessage({
    role: "director",
    text:
      "Vou pedir à ENAVIA uma sugestão de melhoria técnica, sem executar nada.",
    typing: true,
  });

  await api.propose();

  updatePanelState({ patch_status: PATCH_STATUSES.PROPOSED });
  break;

    /* ---------------- APPLY TEST ---------------- */
    case "apply_test":
      if (!canTransitionTo(PATCH_STATUSES.STAGED)) {
        return explainBlockedAction(action);
      }

      addChatMessage({
        role: "director",
        text:
          "Patch aprovado. Vou gerar o staging para teste, sem executar código.",
        typing: true,
      });

      await api.applyTest();

      setPatchStatus(PATCH_STATUSES.STAGED);
      break;

    /* ---------------- DEPLOY TEST ---------------- */
    case "deploy_test":
      if (!canTransitionTo(PATCH_STATUSES.TESTED)) {
        return explainBlockedAction(action);
      }

      addChatMessage({
        role: "director",
        text:
          "Vou executar o deploy em ambiente de TESTE para validar o patch.",
        typing: true,
      });

      const testResult = await api.deployTest();

      if (testResult.ok) {
        setPatchStatus(PATCH_STATUSES.TESTED);
      } else {
        updatePanelState({
          patch_status: PATCH_STATUSES.TEST_FAILED,
          last_error: testResult.error || "Falha no deploy de teste.",
        });
      }
      break;

    /* ---------------- APPROVE ---------------- */
    case "approve":
      if (!canTransitionTo(PATCH_STATUSES.APPROVED)) {
        return explainBlockedAction(action);
      }

      addChatMessage({
        role: "director",
        text:
          "Teste validado. Vou registrar sua aprovação para produção.",
        typing: true,
      });

      setPatchStatus(PATCH_STATUSES.APPROVED);
      break;

    /* ---------------- PROMOTE REAL ---------------- */
    case "promote_real":
      if (!canTransitionTo(PATCH_STATUSES.APPLIED)) {
        return explainBlockedAction(action);
      }

      addChatMessage({
        role: "director",
        text:
          "Vou aplicar o patch em PRODUÇÃO agora, com rollback automático em caso de falha.",
        typing: true,
      });

      const prodResult = await api.promoteReal();

      if (prodResult.ok) {
        setPatchStatus(PATCH_STATUSES.APPLIED);
      } else {
        updatePanelState({
          patch_status: PATCH_STATUSES.PROD_FAILED,
          last_error: prodResult.error || "Falha no deploy em produção.",
        });
      }
      break;

    /* ---------------- ROLLBACK ---------------- */
    case "rollback":
      addChatMessage({
        role: "director",
        text:
          "Vou executar o rollback manual conforme solicitado.",
        typing: true,
      });

      await api.rollback();
      break;

    /* ---------------- CANCEL ---------------- */
    case "cancel":
      addChatMessage({
        role: "director",
        text:
          "Ciclo cancelado. O painel foi resetado com segurança.",
        typing: true,
      });

      resetPanelState();
      break;

    default:
      console.warn("[flow-orchestrator] Ação desconhecida:", action);
  }
}

/* ============================================================
   BLOQUEIOS EXPLICADOS (LINGUAGEM HUMANA)
============================================================ */

function explainBlockedAction(action) {
  const messages = {
    audit: "Ainda não é possível auditar neste momento.",
    propose: "Você só pode pedir sugestões após uma auditoria.",
    apply_test: "O patch ainda não está aprovado para staging.",
    deploy_test: "O patch ainda não passou pelo staging.",
    approve: "Você só pode aprovar após um teste bem-sucedido.",
    promote_real: "Produção só é permitida após aprovação.",
    rollback: "Rollback só é permitido após aplicação.",
    cancel: "Nada para cancelar no momento.",
  };

  addChatMessage({
    role: "director",
    text: messages[action] || "Essa ação não é permitida agora.",
    typing: true,
  });
}
