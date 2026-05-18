param(
  [int]$Port = 45678
)

$ErrorActionPreference = "Stop"
$uri = "http://127.0.0.1:$Port/health"
$health = Invoke-RestMethod -Uri $uri -TimeoutSec 8
if (-not $health) {
  throw "StudioLink daemon did not return health data"
}
Write-Output "StudioLink health check passed"
Write-Output ("Daemon version: " + $health.version)
