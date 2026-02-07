export function validateWorkflowV1(payload) {
  const errors = [];

  if (!payload || typeof payload !== "object") {
    errors.push("payload deve ser um objeto.");
    return errors;
  }

  if (!isNonEmptyString(payload.workflow_id)) {
    errors.push("workflow_id é obrigatório (string).");
  }

  if (!isNonEmptyString(payload.name)) {
    errors.push("name é obrigatório (string).");
  }

  if (!isNonEmptyString(payload.version)) {
    errors.push("version é obrigatório (string).");
  }

  if (!Array.isArray(payload.steps) || payload.steps.length === 0) {
    errors.push("steps deve ser uma lista não vazia.");
  } else {
    const ids = new Set();

    payload.steps.forEach((step, index) => {
      if (!isNonEmptyString(step?.id)) {
        errors.push(`steps[${index}].id é obrigatório (string).`);
      } else if (ids.has(step.id)) {
        errors.push(`steps[${index}].id duplicado: ${step.id}.`);
      } else {
        ids.add(step.id);
      }

      if (!isNonEmptyString(step?.type)) {
        errors.push(`steps[${index}].type é obrigatório (string).`);
      }

      if (!step || typeof step.params !== "object") {
        errors.push(`steps[${index}].params é obrigatório (objeto).`);
      }

      if (!["stop", "retry_simple"].includes(step?.on_error)) {
        errors.push(`steps[${index}].on_error deve ser 'stop' ou 'retry_simple'.`);
      }
    });
  }

  return errors;
}

export function validateRunV1(payload) {
  const errors = [];

  if (!isNonEmptyString(payload?.execution_id)) {
    errors.push("execution_id é obrigatório (string).");
  }

  if (!isNonEmptyString(payload?.workflow_id)) {
    errors.push("workflow_id é obrigatório (string).");
  }

  if (!isNonEmptyString(payload?.workflow_version)) {
    errors.push("workflow_version é obrigatório (string).");
  }

  if (!["TEST", "PROD"].includes(payload?.env_mode)) {
    errors.push("env_mode deve ser TEST ou PROD.");
  }

  if (!payload || typeof payload.inputs !== "object") {
    errors.push("inputs é obrigatório (objeto).");
  }

  if (!isNonEmptyString(payload?.requested_by)) {
    errors.push("requested_by é obrigatório (string).");
  }

  return errors;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}
