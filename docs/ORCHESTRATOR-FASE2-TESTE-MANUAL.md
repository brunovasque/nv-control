# Teste manual — Orchestrator (FASE 2)

Base URL do Worker (produção): `https://nv-orchestrator-engine.workers.dev`

Base URL local (Vercel dev/proxy): `http://localhost:3000`

## 1) Salvar workflow

```bash
curl -X POST http://localhost:3000/orchestrator/workflows/save \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_id": "deploy-seguro-v1",
    "name": "Deploy Seguro v1",
    "version": "1.0.0",
    "steps": [
      {"id":"s1","type":"enavia.deploy_step","params":{"action":"audit"},"on_error":"stop"},
      {"id":"s2","type":"wait.until_flag","params":{"key":"audit.carimbado","equals":true,"timeout_ms":1000,"interval_ms":200},"on_error":"stop"},
      {"id":"s3","type":"enavia.deploy_step","params":{"action":"apply_test"},"on_error":"stop"},
      {"id":"s4","type":"human.approval","params":{},"on_error":"stop"},
      {"id":"s5","type":"enavia.deploy_step","params":{"action":"promote_real"},"on_error":"stop"}
    ]
  }'
```

## 2) Disparar execução

```bash
curl -X POST http://localhost:3000/orchestrator/run \
  -H "Content-Type: application/json" \
  -d '{
    "execution_id": "exec-001",
    "workflow_id": "deploy-seguro-v1",
    "workflow_version": "1.0.0",
    "env_mode": "TEST",
    "inputs": {"flags": {"audit.carimbado": true}},
    "requested_by": "manual-test"
  }'
```

## 3) Consultar estado

```bash
curl http://localhost:3000/orchestrator/executions/exec-001
```

## 4) Reexecutar step (ok/error)

```bash
curl -X POST http://localhost:3000/orchestrator/executions/exec-001/rerun-step \
  -H "Content-Type: application/json" \
  -d '{"step_id":"s1"}'
```

## 5) Aprovar execução pausada

```bash
curl -X POST http://localhost:3000/orchestrator/executions/exec-001/approve
```

## PowerShell (alternativa)

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/orchestrator/workflows/save" -ContentType "application/json" -Body '{"workflow_id":"deploy-seguro-v1","name":"Deploy Seguro v1","version":"1.0.0","steps":[{"id":"s1","type":"enavia.deploy_step","params":{"action":"audit"},"on_error":"stop"}]}'
```


## Variáveis de ambiente

- Worker: `ORCH_DB_URL` e `ORCH_DB_KEY` (com fallback para `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_KEY` / `SUPABASE_ANON_KEY`).
- Vercel proxy: `ORCH_WORKER_BASE=https://nv-orchestrator-engine.workers.dev`.
