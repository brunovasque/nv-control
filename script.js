/* ============================================================
   NV-FIRST UI v4 — Painel Técnico
   CEO: Vasques
   ============================================================ */

/* -----------------------------
   ELEMENTOS DE INTERFACE
------------------------------*/

const chatOutput = document.getElementById("chat-output");
const techTelemetryEl = document.getElementById("tech-telemetry");
const techHistoryEl = document.getElementById("tech-history");

const chatInput = document.getElementById("chat-input");
const chatSendBtn = document.getElementById("chat-send");

const btnListar = document.getElementById("btn-listar");
const btnPatch = document.getElementById("btn-patch");
const btnDiff = document.getElementById("btn-diff");
const btnSimular = document.getElementById("btn-simular");
const btnDescartar = document.getElementById("btn-descartar");

const deployUserBtn = document.getElementById("deploy-user");
const deployMinimalBtn = document.getElementById("deploy-minimal");
const deployOptimizedBtn = document.getElementById("deploy-optimized");

/* Abas */
const tabTelemetry = document.getElementById("tab-telemetry");
const tabHistory = document.getElementById("tab-history");

/* Config */
const NV_FIRST_ENDPOINT = "https://nv-first.brunovasque.workers.dev"; // ajuste se precisar

/* Histórico em memória (sessões) */
const historySessions = []; // { id, status, label, events: [...], ts }

/* ============================================================
   FUNÇÕES DE UI BÁSICAS
============================================================ */

function scrollChatToBottom() {
  chatOutput.scrollTop = chatOutput.scrollHeight;
}

function autoScrollTelemetryOnNewBlock() {
  // Se já está no topo, mantemos o topo como foco no novo bloco
  // Se o user rolou pra baixo, não mexemos
  if (techTelemetryEl.scrollTop <= 5) {
    techTelemetryEl.scrollTop = 0;
  }
}

/* Render mensagem no chat */
function renderChatMessage(text, sender = "user") {
  const container = document.createElement("div");
  container.className = sender === "user" ? "chat-user" : "chat-ai";

  const pre = document.createElement("pre");
  pre.textContent = text;

  container.appendChild(pre);
  chatOutput.appendChild(container);
  scrollChatToBottom();
}

/* ============================================================
   HIGHLIGHT DE ERRO / WARNING DENTRO DE <pre>
============================================================ */

function highlightJsonLines(jsonString) {
  const lines = jsonString.split("\n");

  const keywordsError = ["error", "erro", "exception", "fail", "fatal"];
  const keywordsWarning = ["warning", "risco", "warning", "deprecated", "atenção", "atencao"];

  const highlighted = lines
    .map((line) => {
      const lower = line.toLowerCase();

      const isError = keywordsError.some((k) => lower.includes(k));
      const isWarn = keywordsWarning.some((k) => lower.includes(k));

      if (isError) {
        return `<div class="line-error">${escapeHtml(line)}</div>`;
      }
      if (isWarn) {
        return `<div class="line-warning">${escapeHtml(line)}</div>`;
      }

      return `<div>${escapeHtml(line)}</div>`;
    })
    .join("");

  return highlighted;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* ============================================================
   RENDERIZAÇÃO NO PAINEL TÉCNICO (TELEMETRIA)
============================================================ */

function renderTechBlock(obj) {
  const container = document.createElement("div");
  container.className = "unread-block";

  const pre = document.createElement("pre");
  const jsonString = JSON.stringify(obj, null, 2);

  pre.innerHTML = highlightJsonLines(jsonString);

  container.appendChild(pre);

  techTelemetryEl.prepend(container);
  autoScrollTelemetryOnNewBlock();

  // marcar como lido ao interagir
  container.addEventListener("mouseenter", () => {
    container.className = "read-block";
  });
}

/* ============================================================
   HISTÓRICO AGRUPADO POR SESSÃO
============================================================ */

function getOrCreateSession(sessionId, statusGuess = "ok") {
  let session = historySessions.find((s) => s.id === sessionId);
  if (!session) {
    session = {
      id: sessionId,
      status: statusGuess, // 'ok' | 'attention' | 'error'
      label: `Sessão ${sessionId}`,
      events: [],
      ts: Date.now(),
    };
    historySessions.unshift(session); // sessões mais novas em cima
  }
  return session;
}

function updateSessionStatus(session, newStatus) {
  const order = { ok: 1, attention: 2, error: 3 };
  if (order[newStatus] > order[session.status]) {
    session.status = newStatus;
  }
}

/* Adiciona um evento ao histórico */
function pushHistoryEvent(payload, response) {
  // Achar um sessionId
  const telemetry = response && response.telemetry;
  const deploySessionId =
    (telemetry && telemetry.deploy_session_id) ||
    payload.deploySessionId ||
    payload.deploy_session_id ||
    "GENERAL";

  const session = getOrCreateSession(deploySessionId, "ok");

  // Determinar status desse evento
  let status = "ok";

  const hasError =
    response && (response.error || response.ok === false || (response.result && response.result.error));
  const riskLevel =
    (response &&
      response.result &&
      response.result.riskReport &&
      response.result.riskReport.level) ||
    null;

  if (hasError || riskLevel === "high" || riskLevel === "critical") {
    status = "error";
  } else if (riskLevel === "medium") {
    status = "attention";
  }

  updateSessionStatus(session, status);

  session.events.push({
    type: payload.mode || payload.intent || "op",
    payload,
    response,
    status,
    ts: Date.now(),
  });

  renderHistory();
}

/* Renderizar histórico completo no painel da aba “Histórico” */
function renderHistory() {
  techHistoryEl.innerHTML = "";

  historySessions.forEach((session) => {
    const card = document.createElement("div");
    card.className = "session-card";

    if (session.status === "error") {
      card.classList.add("session-error");
    } else if (session.status === "attention") {
      card.classList.add("session-attention");
    } else {
      card.classList.add("session-ok");
    }

    const header = document.createElement("div");
    header.className = "session-header";

    // Ícone
    const icon = document.createElement("span");
    if (session.status === "error") icon.textContent = "✖";
    else if (session.status === "attention") icon.textContent = "⚠";
    else icon.textContent = "✔";

    const badge = document.createElement("span");
    badge.className = "session-badge";
    badge.textContent =
      session.status === "error"
        ? "ERRO"
        : session.status === "attention"
        ? "ATENÇÃO"
        : "OK";

    const title = document.createElement("span");
    title.className = "session-title";
    title.textContent = `Sessão ${session.id}`;

    const meta = document.createElement("span");
    meta.className = "session-meta";
    const date = new Date(session.ts);
    meta.textContent = ` • ${date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;

    header.appendChild(icon);
    header.appendChild(badge);
    header.appendChild(title);
    header.appendChild(meta);

    const body = document.createElement("div");
    body.className = "session-body";

    session.events.forEach((ev) => {
      const line = document.createElement("div");
      const labelTime = new Date(ev.ts).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      const modeLabel = ev.type;
      let statusLabel = "";
      if (ev.status === "error") statusLabel = " [ERRO]";
      else if (ev.status === "attention") statusLabel = " [ATENÇÃO]";
      else statusLabel = " [OK]";

      line.textContent = `${labelTime} • ${modeLabel}${statusLabel}`;
      body.appendChild(line);
    });

    card.appendChild(header);
    card.appendChild(body);

    techHistoryEl.appendChild(card);
  });
}

/* ============================================================
   ENVIO PARA BACKEND (NV-FIRST)
============================================================ */

async function nvSend(payload, _target = "tech") {
  try {
    const res = await fetch(NV_FIRST_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    renderTechBlock(data);
    pushHistoryEvent(payload, data);

    return data;
  } catch (err) {
    const errorObj = {
      error: "Falha de conexão com NV-FIRST",
      detail: err.toString(),
    };
    renderTechBlock(errorObj);
    pushHistoryEvent(payload, errorObj);
  }
}

/* ============================================================
   CHAT
============================================================ */

chatSendBtn.addEventListener("click", () => {
  const text = chatInput.value.trim();
  if (!text) return;

  renderChatMessage(text, "user");
  nvSend({ message: text, mode: "chat" }, "chat");

  chatInput.value = "";
});

chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    chatSendBtn.click();
  }
});

/* ============================================================
   BOTÕES DE AÇÃO
============================================================ */

btnListar.addEventListener("click", () => {
  nvSend({ mode: "list_staging" });
});

btnPatch.addEventListener("click", () => {
  nvSend({ mode: "show_patch" });
});

btnDiff.addEventListener("click", () => {
  nvSend({ mode: "generate_diff" });
});

btnSimular.addEventListener("click", () => {
  nvSend({ mode: "simulate_again" });
});

btnDescartar.addEventListener("click", () => {
  nvSend({ mode: "discard_staging" });
});

/* DEPLOY — MEU CÓDIGO (soberano do Vasques) */
deployUserBtn.addEventListener("click", () => {
  nvSend({
    mode: "apply_user_patch",
    dryRun: false,
    intent: "DEPLOY DO VASQUES",
  });
});

/* DEPLOY — SUGESTÃO ENAVIA → PATCH MINIMALISTA */
deployMinimalBtn.addEventListener("click", () => {
  nvSend({
    mode: "apply_optimized_patch",
    patchType: "minimal",
    dryRun: false,
    intent: "DEPLOY SUGESTÃO (MINIMALISTA)",
  });
});

/* DEPLOY — SUGESTÃO ENAVIA → PATCH OTIMIZADO */
deployOptimizedBtn.addEventListener("click", () => {
  nvSend({
    mode: "apply_optimized_patch",
    patchType: "optimized",
    dryRun: false,
    intent: "DEPLOY SUGESTÃO (OTIMIZADO)",
  });
});

/* ============================================================
   ABAS: TELEMETRIA / HISTÓRICO
============================================================ */

function setActiveTab(tabName) {
  if (tabName === "telemetry") {
    tabTelemetry.classList.add("active");
    tabHistory.classList.remove("active");
    techTelemetryEl.classList.add("active");
    techHistoryEl.classList.remove("active");
  } else {
    tabTelemetry.classList.remove("active");
    tabHistory.classList.add("active");
    techTelemetryEl.classList.remove("active");
    techHistoryEl.classList.add("active");
  }
}

tabTelemetry.addEventListener("click", () => setActiveTab("telemetry"));
tabHistory.addEventListener("click", () => setActiveTab("history"));
