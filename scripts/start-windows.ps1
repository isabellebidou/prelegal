# Build the Prelegal image and run it at http://localhost:8000.
# Docker failures are caught via $LASTEXITCODE. $ErrorActionPreference = "Stop"
# is avoided: in Windows PowerShell 5.1 it makes the expected "No such
# container" message from `docker rm` on a first run abort the script.
Set-Location (Join-Path $PSScriptRoot "..")
# Set PRELEGAL_PORT to use another port, e.g. $env:PRELEGAL_PORT = 8080
$port = if ($env:PRELEGAL_PORT) { $env:PRELEGAL_PORT } else { "8000" }

docker build -t prelegal .
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
docker rm -f prelegal 2>$null | Out-Null

$envArgs = @()
if (Test-Path ".env") { $envArgs = @("--env-file", ".env") }
docker run -d --name prelegal -p "${port}:8000" @envArgs prelegal | Out-Null
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Prelegal is running at http://localhost:${port}"
