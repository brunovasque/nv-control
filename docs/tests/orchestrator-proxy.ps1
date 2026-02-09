param(
  [Parameter(Mandatory = $false)]
  [string]$BaseUrl = "https://nv-control.vercel.app"
)

$ErrorActionPreference = "Stop"

if (-not $env:ORCH_WORKER_BASE) {
  throw "ORCH_WORKER_BASE_NOT_SET (set this env var before running this script)."
}

$base = $BaseUrl.TrimEnd('/')

Write-Host "Using Vercel base URL: $base"
Write-Host "Using ORCH_WORKER_BASE env: $($env:ORCH_WORKER_BASE)"

$workflowId = "proxy-test-$(Get-Date -Format 'yyyyMMddHHmmss')"

$saveBody = @{
  workflow_id = $workflowId
  definition  = @{
    workflow_id = $workflowId
    steps       = @(
      @{
        id   = "step-1"
        kind = "manual_approval"
      }
    )
  }
} | ConvertTo-Json -Depth 20

$saveResp = Invoke-RestMethod -Method POST -Uri "$base/api/orchestrator/workflows/save" -ContentType "application/json" -Body $saveBody
Write-Host "save =>" ($saveResp | ConvertTo-Json -Depth 20)

$runBody = @{
  workflow_id  = $workflowId
  requested_by = "orchestrator-proxy.ps1"
  inputs       = @{}
} | ConvertTo-Json -Depth 20

$runResp = Invoke-RestMethod -Method POST -Uri "$base/api/orchestrator/run" -ContentType "application/json" -Body $runBody
Write-Host "run =>" ($runResp | ConvertTo-Json -Depth 20)

$executionId = $runResp.execution_id
if (-not $executionId) {
  throw "execution_id missing in run response"
}

$get1 = Invoke-RestMethod -Method GET -Uri "$base/api/orchestrator/executions/$executionId"
Write-Host "get #1 =>" ($get1 | ConvertTo-Json -Depth 20)

$approveBody = @{ approved_by = "orchestrator-proxy.ps1" } | ConvertTo-Json -Depth 20
$approveResp = Invoke-RestMethod -Method POST -Uri "$base/api/orchestrator/executions/$executionId/approve" -ContentType "application/json" -Body $approveBody
Write-Host "approve =>" ($approveResp | ConvertTo-Json -Depth 20)

$rerunBody = @{ step_id = "step-1" } | ConvertTo-Json -Depth 20
$rerunResp = Invoke-RestMethod -Method POST -Uri "$base/api/orchestrator/executions/$executionId/rerun-step" -ContentType "application/json" -Body $rerunBody
Write-Host "rerun-step =>" ($rerunResp | ConvertTo-Json -Depth 20)

$get2 = Invoke-RestMethod -Method GET -Uri "$base/api/orchestrator/executions/$executionId"
Write-Host "get #2 =>" ($get2 | ConvertTo-Json -Depth 20)

Write-Host "Flow completed successfully for execution_id=$executionId"
