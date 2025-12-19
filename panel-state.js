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

let state = {
  execution_id: null,
  patch_status: PATCH_STATUSES.IDLE,
  current_step: null,
  target: null,
  last_error: null,
  updated_at: null,
};

/* ============================================================
   API PÚBLICA
============================================================ */

/**
 * Inicializa estado do painel
 */
export function initPanelState() {
  resetPanelState();
}

/**
 * Retorna snapshot imutável do estado
 */
export function getPanelState() {
  return Object.freeze({ ...state });
}

/**
 * Atualiza estado do painel (via fluxo autorizado)
 */
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

/**
 * Reset completo (ex: CANCELAR)
 */
export function resetPanelState() {
  state = {
    execution_id: null,
    patch_status: PATCH_STATUSES.IDLE,
    current_step: null,
    target: null,
    last_error: null,
    updated_at: Date.now(),
  };

  notifyStateChange();
}

/* ============================================================
   VALIDADORES DE FLUXO
============================================================ */

/**
 * Verifica se uma transição é permitida
 */
export function canTransitionTo(nextStatus) {
  const allowedTransitions = {
  idle: ["audited"],

  // AUDIT apenas carimba — não executa
  audited: ["proposed", "staged"],

  // PROPOSE invalida auditoria e exige novo AUDIT
  proposed: ["audited"],

  // APPLY TEST só ocorre após AUDIT
  staged: ["tested"],

  tested: ["approved"],
  test_failed: ["fix_ready"],

  // após correção, precisa de novo AUDIT
  fix_ready: ["audited"],

  approved: ["applied"],
  applied: [],
  prod_failed: [],
};
   
  const current = state.patch_status;
  return allowedTransitions[current]?.includes(nextStatus) || false;
}

/**
 * Atualiza PATCH_STATUS com validação
 */
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
