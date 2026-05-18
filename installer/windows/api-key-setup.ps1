param(
  [int]$Port = 45678,
  [string]$Provider = "",
  [string]$ApiKey = "",
  [string]$Model = "",
  [switch]$Skip
)

Add-Type -AssemblyName Microsoft.VisualBasic
Add-Type -AssemblyName System.Windows.Forms

if ($Skip) { exit 0 }

if (-not $Provider) {
  $Provider = [Microsoft.VisualBasic.Interaction]::InputBox("Provider (anthropic/openai/openrouter)", "StudioLink API Key Setup", "anthropic")
}
if (-not $Model) {
  $defaultModel = if ($Provider -eq "openai") { "gpt-4o" } elseif ($Provider -eq "openrouter") { "anthropic/claude-sonnet-4" } else { "claude-sonnet-4-20250514" }
  $Model = [Microsoft.VisualBasic.Interaction]::InputBox("Model", "StudioLink API Key Setup", $defaultModel)
}
if (-not $ApiKey) {
  $ApiKey = [Microsoft.VisualBasic.Interaction]::InputBox("API key (input is masked after saving by keychain storage)", "StudioLink API Key Setup", "")
}
if (-not $Provider -or -not $Model -or -not $ApiKey) { exit 0 }

$body = @{ provider = $Provider; apiKey = $ApiKey; model = $Model } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:$Port/config/api-key" -ContentType "application/json" -Body $body | Out-Null
