# CONTRATO ORQUESTRADOR ENAVIA – v1

Objetivo: transformar o NV-CONTROL em um painel orquestrador (estilo n8n),
onde fluxos (workflows) são executados de ponta a ponta, com estado, histórico
e reexecução, usando como “braços” os Workers já existentes (nv-enavia,
enavia-executor, deploy-worker, browser executor etc.).

Regra de ouro: **não quebrar nada que já funciona**. Tudo novo deve ser
adicionado de forma isolada e controlada.

---

## FASE 0 – Estado atual (base que não pode ser quebrada)

1. Diretor Cognitivo já existe e está integrado ao fluxo de deploy.
2. NV-FIRST é o gateway principal (rota /engineer, /director/cognitive,
/browser/run, etc.).
3. Executor processa planos (deploy.plan.v1, plan.v1) e grava estado.
4. Deploy Worker gerencia STAGING, PATCH_STATUS, AUDIT etc.
5. Browser Executor já executa planos plan.v1.

Nada nesta fase pode ser alterado sem motivo grave. O orquestrador deve usar
essas peças como “atores” externos.

---

## FASE 1 – Contratos do Orquestrador (definições simples)

**Meta:** definir formatos simples que todo o orquestrador vai usar.

### 1.1. Definição de Workflow (workflow.v1)

Um workflow é um “roteiro” de passos:

- `workflow_id` (string)
- `name` (string)
- `version` (string)
- `steps[]` (lista ordenada, MVP é sequência simples)
  - `id` (string única dentro do workflow)
  - `type` (tipo do passo, ver Fase 3)
  - `params` (objeto com os parâmetros do passo)
  - `on_error` (comportamento em erro: "stop" ou "retry_simple")

### 1.2. Pedido de execução (workflow.run.v1)

- `execution_id` (string)
- `workflow_id` (string)
- `workflow_version` (string)
- `env_mode` ("TEST" ou "PROD")
- `inputs` (objeto com variáveis iniciais)
- `requested_by` (identificação de quem disparou)

### 1.3. Estado de execução (execution.state.v1)

- `execution_id`
- `workflow_id`
- `status`:
  - "running" | "paused" | "failed" | "done" | "canceled"
- `current_step_id`
- `steps[]`:
  - `step_id`
  - `status`: "pending" | "running" | "ok" | "error" | "blocked" | "skipped"
  - `attempt`
  - `started_at`
  - `ended_at`
  - `result_resumo` (string curta)
- `needs_approval` (bool)
- `approved_at` (datetime ou null)

**Regra:** estado deve ser salvo em KV/DB de forma que:
- seja possível listar execuções,
- ver histórico,
- reexecutar uma etapa,
- retomar um fluxo pausado.

---

## FASE 2 – Worker do Orquestrador (Engine)

**Meta:** criar um Worker novo para ser o “motor” do orquestrador, sem
misturar com deploy-worker nem executor.

### 2.1. Rotas mínimas do Orquestrador

1. `POST /orchestrator/workflows/save`
   - Salva ou atualiza um workflow (workflow.v1).
   - Valida estrutura.

2. `POST /orchestrator/run`
   - Recebe workflow.run.v1.
   - Cria `execution.state.v1` inicial.
   - Começa a executar os passos em background (ou síncrono, no MVP).

3. `GET /orchestrator/executions/:execution_id`
   - Retorna estado completo da execução.

4. `POST /orchestrator/executions/:execution_id/rerun-step`
   - Reexecuta um step específico (MVP simples: apenas steps já marcados
     como "error" ou "ok").

5. `POST /orchestrator/executions/:execution_id/approve`
   - Marca `needs_approval = false`, `approved_at = now`, permitindo que o
     fluxo continue a partir do próximo passo.

### 2.2. Execução dos passos

MVP: passos são executados **em sequência** (1 → 2 → 3...).

Para cada step:
- Atualiza estado para "running".
- Executa o tipo correspondente (ver Fase 3).
- Grava resultado e status.
- Se `on_error = "stop"` e der erro → marca execução como "failed".
- Se `on_error = "retry_simple"` → tentar novamente 1 vez (MVP).

---

## FASE 3 – Tipos de passos (nodes) ENAVIA – MVP

**Meta:** ter poucos tipos de passos, mas muito úteis.

### 3.1. Tipo: `enavia.deploy_step`

- Chama NV-FIRST/Executor com um step do deploy (ex.: audit, apply_test,
  deploy_test, promote_real).
- Params mínimos:
  - `action` (ex.: "audit" | "apply_test" | "deploy_test" | "promote_real")
  - `execution_id` alvo do deploy (se aplicável)
- Registra no estado se deu certo ou não.

### 3.2. Tipo: `enavia.browser_plan`

- Chama `/browser/run` via NV-FIRST com um plan.v1 já definido.
- Params:
  - `plan` (objeto plan.v1)
- Registra evidências/resumo (ex.: "URL ok", "texto encontrado", etc.).

### 3.3. Tipo: `http.request`

- Chamada HTTP genérica (GET/POST) para integrações.
- Params:
  - URL, método, headers, body (básico)
- Resultado vai para `result_resumo` (ex.: status code, parte da resposta).

### 3.4. Tipo: `wait.until_flag`

- Fica checando uma condição simples em KV/estado externo.
- Params:
  - chave/condição (por exemplo, aguardar `staging.ready = true` no deploy)
  - timeout simples (MVP).

### 3.5. Tipo: `human.approval`

- Pausa o fluxo até alguém aprovar.
- Ao chegar neste passo, o orquestrador:
  - marca `needs_approval = true`,
  - status do step = "blocked",
  - status da execução = "paused".
- Quando a rota `/approve` é chamada:
  - marca aprovação,
  - retoma execução do próximo step.

---

## FASE 4 – Integração com NV-CONTROL (UI Orquestrador MVP)

**Meta:** sem canvas ainda. Só telas simples e funcionais.

### 4.1. Aba “Orquestrador”

Criar no painel NV-CONTROL:

1. Lista de Workflows
   - Nome, ID, versão.
   - Botão “Executar em TEST” / “Executar em PROD”.

2. Tela de Execução
   - Mostra:
     - status geral (running, failed, done),
     - lista de steps com status e timestamps,
     - resumo de resultado de cada step.
   - Botões:
     - “Reexecutar step” (chama `/rerun-step`)
     - “Aprovar” (se `needs_approval = true` → chama `/approve`)

### 4.2. Fluxo padrão: “Deploy Seguro v1”

Definir um workflow padrão chamado “Deploy Seguro v1”:

1. `enavia.deploy_step` (action: "audit")
2. `wait.until_flag` (aguardar audit carimbado)
3. `enavia.deploy_step` (action: "apply_test")
4. `enavia.deploy_step` (action: "deploy_test")
5. `human.approval`
6. `enavia.deploy_step` (action: "promote_real")

Este fluxo deve ser o primeiro a ser implementado e testado.

---

## FASE 5 – Canvas visual (opcional, depois do MVP)

**Só depois** que o motor e a aba Orquestrador MVP estiverem estáveis.

- Implementar editor visual (drag-and-drop) que monta `workflow.v1`.
- Cada bloco visual representa um step.
- Conexões determinam a ordem (no começo, sequência simples).

---

## Regras Gerais para qualquer mudança

1. Toda tarefa para Codex deve ser uma Issue no GitHub, referenciando
   este contrato por nome e seção.

2. Nenhuma rota existente (nv-enavia, executor, deploy-worker, browser)
   deve ser alterada sem motivo claro e justificado na Issue.

3. Qualquer nova rota ou tipo de step deve:
   - ser documentado neste arquivo,
   - ter testes mínimos (no CI),
   - respeitar o padrão de estado (execution.state.v1).

4. Produção só recebe código após:
   - teste em ambiente TEST,
   - fluxo “Deploy Seguro v1” rodando completo sem erro,
   - aprovação manual.
