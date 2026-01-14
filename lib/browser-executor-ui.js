/* ============================================================
   Browser Executor UI — CANAL ISOLADO (CANÔNICO)
   - NÃO conhece panel-state
   - NÃO conhece deploy / audit
   - NÃO despacha eventos globais
============================================================ */

(function () {
  // ------------------------------
  // DOM
  // ------------------------------
  const btn = document.getElementById("browser-execute-btn");
  const textarea =
    document.getElementById("humanBrowserPlan") ||
    document.querySelector("textarea[data-field='human-browser-plan']");

  if (!btn || !textarea) {
    console.warn("[BROWSER-UI] Botão ou textarea não encontrado.");
    return;
  }

  // ------------------------------
  // Estado local (isolado)
  // ------------------------------
  let enabled = false;

  function setEnabled(v) {
    enabled = !!v;
    btn.disabled = !enabled;
    btn.classList.toggle("disabled", !enabled);
  }

  // ------------------------------
  // Validação mínima (contrato)
  // ------------------------------
  function parsePlan(raw) {
    if (!raw) throw new Error("Plano vazio.");
    let plan;
    try {
      plan = JSON.parse(raw);
    } catch {
      throw new Error("JSON inválido.");
    }
    if (
      plan.version !== "plan.v1" ||
      !Array.isArray(plan.steps) ||
      !plan.steps.length
    ) {
      throw new Error("Estrutura inválida (plan.v1 esperado).");
    }
    return plan;
  }

  // ------------------------------
  // Ações
  // ------------------------------
  btn.addEventListener("click", async () => {
    if (!enabled) return;

    try {
      const plan = parsePlan(String(textarea.value || "").trim());
      console.log("[BROWSER-UI] Plano válido:", plan);

      const res = await fetch("https://run.nv-imoveis.com/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: "plan.v1",
          steps: plan.steps,
        }),
      });

      const txt = await res.text();
      let data = null;
      try { data = JSON.parse(txt); } catch (_) {}

      if (!res.ok) {
        throw new Error(data?.error || data?.message || txt || "Falha ao executar.");
      }

      console.log("[BROWSER-UI] Execução OK:", data);


    } catch (err) {
      console.error("[BROWSER-UI] Erro:", err.message || err);
      alert(err.message || "Erro ao executar o browser.");
    }
  });

  // ------------------------------
  // Habilitação simples (local)
  // ------------------------------
  textarea.addEventListener("input", () => {
    const hasText = String(textarea.value || "").trim().length > 0;
    setEnabled(hasText);
  });

  // estado inicial
  setEnabled(String(textarea.value || "").trim().length > 0);
})();
