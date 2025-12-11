export const config = {
  runtime: "edge",
};

const NV_FIRST_URL = "https://nv-first.brunovasque.workers.dev/engineer";

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

    // Se o painel pedir simulação → devolvemos MOCK
    if (body.simulate === true) {
  return json({
    ok: true,
    mode: "simulate",
    executor: "vercel-executor-v1",
    message: "Simulação executada com sucesso.",
    received: body,
    result: {
      mock: true,
      notes:
        "Este é o executor Vercel V1. A ENAVIA poderá evoluir esta função.",
      steps: [
        "Recebi o comando do painel (simulate: true).",
        "Validei a estrutura básica do payload.",
        "Simulei a análise do patch/código.",
        "Preparei este resultado para o painel exibir na tela."
      ]
    },
    telemetry: {
      source: "Vercel",
      stage: "simulate",
      timestamp: Date.now(),
    },
  });
}

    // Caso contrário → encaminha ao NV-FIRST (executor real)
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
