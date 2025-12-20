/* ============================================================
   API CLIENT — ENAVIA PANEL (DEFINITIVO)
   - Chamadas explícitas
   - Payloads completos
   - Nenhuma suposição
============================================================ */

function normalizeBaseUrl(url) {
  if (!url) return null;
  return String(url).replace(/\/$/, "");
}

function buildUrl(base, path) {
  return `${normalizeBaseUrl(base)}${path}`;
}

/* ============================================================
   FACTORY
============================================================ */

export function createApiClient(config) {
  const cfg = validateConfig(config);

  return {
    /* ---------------- ENAVIA ---------------- */

    audit(payload) {
      return callJson(cfg.enaviaBaseUrl, "/audit", payload, cfg);
    },

    propose(payload) {
      // PROPOSE: apenas sugestão técnica, sem executar nada
      return callJson(cfg.enaviaBaseUrl, "/propose", payload, cfg);
    },

    /* ---------------- DEPLOY WORKER ---------------- */

    applyTest(payload) {
      assertExecutionId(payload);
      return callJson(cfg.deployBaseUrl, "/apply-test", payload, cfg);
    },

    deployTest(payload) {
      assertExecutionId(payload);
      return callJson(cfg.deployBaseUrl, "/deploy-test", payload, cfg);
    },

    promoteReal(payload) {
      assertExecutionId(payload);
      assertApproved(payload);
      return callJson(cfg.deployBaseUrl, "/apply", payload, cfg);
    },

    rollback(payload) {
      assertExecutionId(payload);
      return callJson(cfg.deployBaseUrl, "/rollback", payload, cfg);
    },

    cancel(payload) {
      assertExecutionId(payload);
      return callJson(cfg.deployBaseUrl, "/cancel", payload, cfg);
    },

    status(execution_id) {
      if (!execution_id) {
        return Promise.resolve({
          ok: false,
          error: "execution_id obrigatório",
        });
      }
      return callJson(
        cfg.deployBaseUrl,
        `/status/${encodeURIComponent(execution_id)}`,
        null,
        cfg,
        "GET"
      );
    },
  };
}

/* ============================================================
   CONFIG VALIDATION
============================================================ */

function validateConfig(config) {
  const enaviaBaseUrl = normalizeBaseUrl(config?.enaviaBaseUrl);
  const deployBaseUrl = normalizeBaseUrl(config?.deployBaseUrl);

  if (!enaviaBaseUrl) {
    throw new Error("API_CLIENT_CONFIG_ERROR: enaviaBaseUrl ausente.");
  }
  if (!deployBaseUrl) {
    throw new Error("API_CLIENT_CONFIG_ERROR: deployBaseUrl ausente.");
  }

  return {
    enaviaBaseUrl,
    deployBaseUrl,
    internalToken:
      typeof config?.internalToken === "string"
        ? config.internalToken
        : null,
    timeoutMs:
      Number.isFinite(config?.timeoutMs) ? config.timeoutMs : 20000,
    debug: config?.debug === true,
  };
}

/* ============================================================
   CORE REQUEST
============================================================ */

async function callJson(baseUrl, path, body, cfg, method = "POST") {
  const url = buildUrl(baseUrl, path);

  const headers = {
    "Content-Type": "application/json",
  };

  if (cfg.internalToken) {
    headers["Authorization"] = `Bearer ${cfg.internalToken}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs);

  try {
    const init = {
      method,
      headers,
      signal: controller.signal,
    };

    if (method !== "GET") {
      init.body = JSON.stringify(body ?? {});
    }

    const res = await fetch(url, init);
    const text = await res.text().catch(() => "");

    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    if (!res.ok || data?.ok === false) {
      return {
        ok: false,
        http_status: res.status,
        error: data?.error || `HTTP_${res.status}`,
        data,
      };
    }

    return {
      ok: true,
      http_status: res.status,
      data,
    };
  } catch (err) {
    return {
      ok: false,
      http_status: 0,
      error:
        err?.name === "AbortError"
          ? "TIMEOUT"
          : "NETWORK_ERROR",
      data: { detail: String(err?.message || err) },
    };
  } finally {
    clearTimeout(timeout);
  }
}

/* ============================================================
   ASSERTS (FAIL FAST — PAINEL NÃO ERRA)
============================================================ */

function assertExecutionId(payload) {
  if (!payload || !payload.execution_id) {
    throw new Error("API_CLIENT_ERROR: execution_id obrigatório.");
  }
}

function assertApproved(payload) {
  if (payload.approved !== true || !payload.approved_by) {
    throw new Error(
      "API_CLIENT_ERROR: approved=true e approved_by obrigatórios para PRODUÇÃO."
    );
  }
}
