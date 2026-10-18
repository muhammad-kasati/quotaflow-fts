# QuotaFlow k6 Runner Script
param (
  [string]$Scenario = "normal-consumption.js",
  [string]$ApiUrl = "http://host.docker.internal:4000"
)

Write-Host "Running k6 scenario: $Scenario against $ApiUrl..." -ForegroundColor Cyan

docker run --rm -i `
  --network="host" `
  -v "${PSScriptRoot}/scenarios:/scripts" `
  -e "API_URL=$ApiUrl" `
  -e "API_KEY=qf_live_demo_acme_production_key_2026" `
  grafana/k6 run "/scripts/$Scenario"
