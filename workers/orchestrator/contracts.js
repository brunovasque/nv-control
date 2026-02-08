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

      if (!["stop", "retry_simple", "continue"].includes(step?.on_error)) {
        errors.push(`steps[${index}].on_error deve ser 'stop', 'continue' ou 'retry_simple'.`);
      }

      if (step?.type === "enavia.deploy_step") {
        validateEnaviaDeployStep(step, index, errors);
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

function validateEnaviaDeployStep(step, index, errors) {
  const params = step.params || {};

  if (!isNonEmptyString(params.url)) {
    errors.push(`steps[${index}].params.url é obrigatório para enavia.deploy_step (string).`);
  }

  if (params.method !== undefined && !isNonEmptyString(params.method)) {
    errors.push(`steps[${index}].params.method deve ser string quando informado.`);
  }

  if (params.headers !== undefined && !isPlainObject(params.headers)) {
    errors.push(`steps[${index}].params.headers deve ser objeto quando informado.`);
  }

  if (params.timeout_ms !== undefined && (!Number.isFinite(Number(params.timeout_ms)) || Number(params.timeout_ms) <= 0)) {
    errors.push(`steps[${index}].params.timeout_ms deve ser número positivo quando informado.`);
  }

  if (params.retry !== undefined) {
    if (!isPlainObject(params.retry)) {
      errors.push(`steps[${index}].params.retry deve ser objeto quando informado.`);
      return;
    }

    if (params.retry.max_attempts !== undefined) {
      const maxAttempts = Number(params.retry.max_attempts);
      if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
        errors.push(`steps[${index}].params.retry.max_attempts deve ser inteiro >= 1.`);
      }
    }

    if (params.retry.backoff_ms !== undefined) {
      const backoffMs = Number(params.retry.backoff_ms);
      if (!Number.isFinite(backoffMs) || backoffMs < 0) {
        errors.push(`steps[${index}].params.retry.backoff_ms deve ser número >= 0.`);
      }
    }
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
