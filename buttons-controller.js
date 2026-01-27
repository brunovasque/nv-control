import {
  getPatchStatus,
  getPanelState,
  canTransitionTo,
  PATCH_STATUSES,
} from "./panel-state.js";

/* ============================================================
   MAPA DE BOTÕES (DOM)
============================================================ */

function qsAction(action) {
  return document.querySelector(`.action-btn[data-action="${action}"]`);
}

const buttons = {
  audit: qsAction("audit"),
  propose: qsAction("propose"),
  applyTest: qsAction("apply-test"),
  deployTest: qsAction("deploy-test"),
  approve: qsAction("approve"),
  promote: qsAction("promote-real"),
  rollback: qsAction("rollback"),
  cancel: qsAction("cancel"),
};

/* ============================================================
   INIT
============================================================ */

export function initButtonsController() {
  bindButtonEvents();
  updateButtonsState();
  document.addEventListener("panel:state-changed", updateButtonsState);
}

/* ============================================================
   ENABLE / DISABLE
============================================================ */

function updateButtonsState() {
  const state = getPanelState();

  console.log(
    "[BUTTONS STATE CHECK]",
    "status:", state.patch_status,
    "audit:", state.audit
  );

  const status = state.patch_status;
  const audit = state.audit;

  toggle(buttons.audit, canTransitionTo(PATCH_STATUSES.AUDITED));
  toggle(buttons.propose, canTransitionTo(PATCH_STATUSES.PROPOSED));

  // 🧠 APPLY TEST — REGRA CANÔNICA
  const normalizedRisk =
  typeof audit?.risk_level === "string"
    ? audit.risk_level.toLowerCase()
    : null;

const hasFindings =
  Array.isArray(audit?.findings) && audit.findings.length > 0;

const hasRecommendations =
  Array.isArray(audit?.recommended_changes) &&
  audit.recommended_changes.length > 0;

const normalizedStatus =
  typeof status === "string"
    ? status.toLowerCase()
    : null;

const canApplyTest =
  normalizedStatus === PATCH_STATUSES.AUDITED.toLowerCase() &&
  audit &&
  audit.verdict === "approve";

  toggle(buttons.applyTest, canApplyTest);

  toggle(buttons.deployTest, canTransitionTo(PATCH_STATUSES.TESTED));
  toggle(buttons.approve, canTransitionTo(PATCH_STATUSES.APPROVED));
  toggle(buttons.promote, canTransitionTo(PATCH_STATUSES.APPLIED));

  toggle(buttons.rollback, status === PATCH_STATUSES.APPLIED);
  toggle(buttons.cancel, status !== PATCH_STATUSES.IDLE);
}

function toggle(button, enabled) {
  if (!button) return;
  button.disabled = !enabled;
  button.classList.toggle("disabled", !enabled);
}

/* ============================================================
   EVENTS
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
    if (button.disabled) return;

    document.dispatchEvent(
      new CustomEvent("panel:action", {
        detail: { action },
      })
    );
  });
}
