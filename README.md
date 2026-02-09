# nv-control

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
