# nv-control

## Arquitetura de Workers (canônico)

### Worker canônico: `workers/orchestrator/`

O worker de orquestramento canônico e em produção está em:

```
workers/orchestrator/
  index.js      — entrypoint (roteamento HTTP)
  engine.js     — lógica de execução de workflows
  db.js         — persistência via Supabase REST
  http.js       — utilitários HTTP (sendJson, methodNotAllowed)
  contracts.js  — validação de contratos workflow.v1
```

`wrangler.toml` na raiz aponta explicitamente para este diretório:

```toml
main = "workers/orchestrator/index.js"
```

O workflow de CI (`.github/workflows/deploy-nv-orchestrator.yml`) deploya **este** worker no Cloudflare via `wrangler deploy`.

> **Nota:** O diretório `workers/nv-orchestrator/` era um fork legado/experimental do mesmo engine,
> nunca deployado em produção. Foi removido nesta revisão P0 para eliminar a ambiguidade.
> Qualquer futuro patch no engine deve ser feito em `workers/orchestrator/`.

---

## Orchestrator Engine Worker

Este repositório agora separa o engine do orquestrador em um Worker dedicado:

- **Worker**: `nv-orchestrator-engine`
- **Base URL final**: `https://nv-orchestrator-engine.workers.dev`

### Rotas publicadas no Worker

- `POST /orchestrator/workflows/save`
- `POST /orchestrator/run`
- `GET /orchestrator/executions/:execution_id`
- `POST /orchestrator/executions/:execution_id/approve`
- `POST /orchestrator/executions/:execution_id/rerun-step`

### Variáveis de ambiente do Worker

O engine usa Supabase REST com prioridade para variáveis `ORCH_*` e fallback para variáveis Supabase já existentes:

1. `ORCH_DB_URL` (fallback: `SUPABASE_URL`)
2. `ORCH_DB_KEY` (fallback: `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_KEY`, `SUPABASE_ANON_KEY`)

### Vercel (proxy `/api/orchestrator/*`)

Após criar/publicar o Worker novo, configure no projeto Vercel:

- `ORCH_WORKER_BASE=https://nv-orchestrator-engine.workers.dev`

As rotas em `api/orchestrator/*` fazem relay para essa base.

### GitHub Actions Secrets (deploy)

Para o workflow `Deploy nv-orchestrator-engine` funcionar, configure estes secrets no repositório GitHub:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Sem eles, o passo do `cloudflare/wrangler-action@v3` falha na autenticação do deploy.
