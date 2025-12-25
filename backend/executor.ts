export const config = {
  runtime: "edge",
};

const NV_FIRST_URL = "https://nv-first.brunovasque.workers.dev/engineer";

// ✅ CANÔNICO: Vercel NÃO executa nada real (apenas simulação)
const ALLOW_REAL_EXECUTION = false;

export default async function handler(req: Request) {
  try {
    // CORS
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    if (req.method !== "POST") {
      return json({ ok: false, error: "Método não permitido" }, 405);
    }

    const body = await req.json().catch(() => ({}));

    // ✅ Simulação permitida
    if (body.simulate === true) {
      return json({
        ok: true,
        mode: "simulate",
        executor: "vercel-executor-v1",
        message: "Simulação executada com sucesso.",
        received: body,
        result: {
          mock: true,
          notes: "Executor Vercel V1 (bloqueado para execução real).",
          steps: [
            "Recebi o comando do painel (simulate: true).",
            "Validei a estrutura básica do payload.",
            "Simulei a análise do patch/código.",
            "Preparei este resultado para o painel exibir na tela.",
          ],
        },
        telemetry: {
          source: "Vercel",
          stage: "simulate",
          timestamp: Date.now(),
        },
      });
    }

    // ❌ Execução real bloqueada (canônico)
    if (!ALLOW_REAL_EXECUTION) {
      return json(
        {
          ok: false,
          blocked: true,
          executor: "vercel-executor-v1",
          message:
            "Execução real no Vercel está DESABILITADA por contrato. " +
            "Use o Browser Executor (noVNC) via chat do Diretor para executar planos.",
          received: body,
          telemetry: {
            source: "Vercel",
            stage: "blocked",
            timestamp: Date.now(),
          },
        },
        403
      );
    }

    // (Mantido por compatibilidade, mas não deve rodar enquanto ALLOW_REAL_EXECUTION=false)
    const forward = await fetch(NV_FIRST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await forward.json();

    return json(
      {
        ok: true,
        mode: "forward",
        executor: "vercel-executor-v1",
        received: body,
        result: data,
        telemetry: {
          source: "Vercel",
          stage: "forward",
          timestamp: Date.now(),
        },
      },
      200
    );
  } catch (err: any) {
    return json(
      {
        ok: false,
        error: String(err),
        executor: "vercel-executor-v1",
        telemetry: {
          source: "Vercel",
          stage: "error",
          timestamp: Date.now(),
        },
      },
      500
    );
  }
}

function json(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
    },
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
