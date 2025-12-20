/* ============================================================
   PANEL STATE — ENAVIA CONTROL PANEL
   Fonte ÚNICA da verdade do painel.
   Nenhum botão, chat ou fluxo decide fora daqui.
============================================================ */

/*
  Estados canônicos de PATCH_STATUS (Contrato v1.1):

  - idle
  - audited
  - proposed
  - staged
  - tested
  - test_failed
  - fix_ready
  - approved
  - applied
  - prod_failed
*/

const PATCH_STATUSES = {
  IDLE: "idle",
  AUDITED: "audited",
  PROPOSED: "proposed",
  STAGED: "staged",
  TESTED: "tested",
  TEST_FAILED: "test_failed",
  FIX_READY: "fix_ready",
  APPROVED: "approved",
  APPLIED: "applied",
  PROD_FAILED: "prod_failed",
};

/* ============================================================
   UTIL — EXECUTION ID
============================================================ */
function generateExecutionId() {
  return `exec-${Date.now()}`;
}

/* ============================================================
   ESTADO INTERNO
============================================================ */
let state = {
  execution_id: generateExecutionId(),
  patch_status: PATCH_STATUSES.IDLE,
  current_step: null,
  target: null,
  last_error: null,
  updated_at: Date.now(),
};

/* ============================================================
   API PÚBLICA
============================================================ */

export function initPanelState() {
  resetPanelState();
}

export function getPanelState() {
  return Object.freeze({ ...state });
}

export function updatePanelState(patch) {
  if (typeof patch !== "object") {
    console.warn("[panel-state] Patch inválido.");
    return;
  }

  state = {
    ...state,
    ...patch,
    updated_at: Date.now(),
  };

  notifyStateChange();
}

export function resetPanelState() {
  state = {
    execution_id: generateExecutionId(),
    patch_status: PATCH_STATUSES.IDLE,
    current_step: null,
    target: null,
    last_error: null,
    updated_at: Date.now(),
  };

  notifyStateChange();
}

/* ============================================================
   VALIDADORES DE FLUXO (CONTRATO v1.0)
============================================================ */

export function canTransitionTo(nextStatus) {
  const allowedTransitions = {
    idle: ["audited", "proposed"],

    audited: ["proposed", "staged"],

    // 🔥 LIBERADO: propose pode avançar
    proposed: ["staged"],

    staged: ["tested", "test_failed"],

    test_failed: ["fix_ready"],

    fix_ready: ["audited"],

    tested: ["approved"],

    approved: ["applied"],

    applied: [],
    prod_failed: [],
  };

  const current = state.patch_status;
  return allowedTransitions[current]?.includes(nextStatus) || false;
}

export function setPatchStatus(nextStatus) {
  if (!canTransitionTo(nextStatus)) {
    console.warn(
      `[panel-state] Transição inválida: ${state.patch_status} → ${nextStatus}`
    );
    return false;
  }

  updatePanelState({
    patch_status: nextStatus,
    current_step: nextStatus,
  });

  return true;
}

/* ============================================================
   UTILITÁRIOS DE CONSULTA
============================================================ */

export function getPatchStatus() {
  return state.patch_status;
}

export function getExecutionId() {
  return state.execution_id;
}

export function hasExecution() {
  return Boolean(state.execution_id);
}

/* ============================================================
   EVENTOS
============================================================ */

function notifyStateChange() {
  const event = new CustomEvent("panel:state-changed", {
    detail: getPanelState(),
  });
  document.dispatchEvent(event);
}

/* ============================================================
   EXPORTS CANÔNICOS
============================================================ */
export { PATCH_STATUSES };
