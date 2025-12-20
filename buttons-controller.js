/* ============================================================
   BUTTONS CONTROLLER — ENAVIA PANEL
   Responsável APENAS por:
   - Habilitar/desabilitar botões
   - Explicar bloqueios
   - Emitir eventos de intenção
============================================================ */

import {
  getPatchStatus,
  canTransitionTo,
  PATCH_STATUSES,
} from "./panel-state.js";

/* ============================================================
   MAPA DE BOTÕES (DOM)
   Estratégia tolerante:
   1) data-action
   2) fallback por ordem (legado)
============================================================ */

function qsAction(action, fallbackIndex = null) {
  return (
    document.querySelector(`.action-btn[data-action="${action}"]`) ||
    (fallbackIndex !== null
      ? document.querySelector(`.action-btn:nth-child(${fallbackIndex})`)
      : null)
  );
}

const buttons = {
  audit: qsAction("audit", 2),
  propose: qsAction("propose", 3),
  applyTest: qsAction("apply_test", 4),
  deployTest: qsAction("deploy_test", 5),
  approve: qsAction("approve", 6),
  promote: qsAction("promote_real", 7),
  rollback: document.querySelector(".action-btn.danger"),
  cancel: document.querySelector(".action-btn.secondary"),
};

/* ============================================================
   API PÚBLICA
============================================================ */

export function initButtonsController() {
  bindButtonEvents();
  updateButtonsState();

  document.addEventListener("panel:state-changed", updateButtonsState);
}

/* ============================================================
   HABILITA / DESABILITA
============================================================ */

function updateButtonsState() {
  const status = getPatchStatus();

  // AUDIT: permitido no idle e após fix
  toggle(
    buttons.audit,
    status === PATCH_STATUSES.IDLE ||
    status === PATCH_STATUSES.FIX_READY
  );

  // PROPOSE: permitido no idle ou após audit
  toggle(
    buttons.propose,
    status === PATCH_STATUSES.IDLE ||
    status === PATCH_STATUSES.AUDITED
  );

  // APPLY TEST: permitido após audit ou propose
  toggle(
    buttons.applyTest,
    status === PATCH_STATUSES.AUDITED ||
    status === PATCH_STATUSES.PROPOSED
  );

  // DEPLOY TEST: permitido após staging
  toggle(
    buttons.deployTest,
    status === PATCH_STATUSES.STAGED
  );

  // APPROVE: permitido após tested
  toggle(
    buttons.approve,
    status === PATCH_STATUSES.TESTED
  );

  // PROMOTE REAL: permitido após approved
  toggle(
    buttons.promote,
    status === PATCH_STATUSES.APPROVED
  );

  // ROLLBACK: só após aplicado em produção
  toggle(
    buttons.rollback,
    status === PATCH_STATUSES.APPLIED
  );

  // CANCELAR: qualquer estado diferente de idle
  toggle(
    buttons.cancel,
    status !== PATCH_STATUSES.IDLE
  );
}

/* ============================================================
   CLIQUES → EVENTOS (INTENÇÃO)
============================================================ */

function bindButtonEvents() {
  bind(buttons.audit, "audit");
  bind(buttons.propose, "propose");
  bind(buttons.applyTest, "apply_test");
  bind(buttons.deployTest, "deploy_test");
  bind(buttons.approve, "approve");
  bind(buttons.promote, "promote_real");
  bind(buttons.rollback, "rollback");
  bind(buttons.cancel, "cancel");
}

function bind(button, action) {
  if (!button) return;

  button.addEventListener("click", () => {
    if (button.classList.contains("disabled")) {
      notifyBlocked(action);
      return;
    }

    emitAction(action);
  });
}

/* ============================================================
   EVENTOS
============================================================ */

function emitAction(action) {
  const event = new CustomEvent("panel:action", {
    detail: { action },
  });
  document.dispatchEvent(event);
}

function notifyBlocked(action) {
  const event = new CustomEvent("panel:action-blocked", {
    detail: { action },
  });
  document.dispatchEvent(event);
}
