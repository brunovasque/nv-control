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
============================================================ */

const buttons = {
  audit: document.querySelector(".action-btn:nth-child(2)"),
  propose: document.querySelector(".action-btn:nth-child(3)"),
  applyTest: document.querySelector(".action-btn:nth-child(4)"),
  deployTest: document.querySelector(".action-btn:nth-child(5)"),
  approve: document.querySelector(".action-btn:nth-child(6)"),
  promote: document.querySelector(".action-btn:nth-child(7)"),
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

  toggle(buttons.audit, canTransitionTo(PATCH_STATUSES.AUDITED));
  toggle(buttons.propose, canTransitionTo(PATCH_STATUSES.PROPOSED));
  toggle(buttons.applyTest, canTransitionTo(PATCH_STATUSES.STAGED));
  toggle(buttons.deployTest, canTransitionTo(PATCH_STATUSES.TESTED));
  toggle(buttons.approve, canTransitionTo(PATCH_STATUSES.APPROVED));
  toggle(buttons.promote, canTransitionTo(PATCH_STATUSES.APPLIED));

  toggle(buttons.rollback, status === PATCH_STATUSES.APPLIED);
  toggle(buttons.cancel, status !== PATCH_STATUSES.IDLE);
}

function toggle(button, enabled) {
  if (!button) return;
  button.classList.toggle("disabled", !enabled);
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
