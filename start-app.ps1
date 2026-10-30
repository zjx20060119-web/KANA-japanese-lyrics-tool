$ErrorActionPreference = "Stop"

$projectRoot = $PSScriptRoot
$backendDir = Join-Path $projectRoot "backend"
$frontendDir = Join-Path $projectRoot "frontend"
$runtimeDir = Join-Path $projectRoot ".runtime"

New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null

function Test-AppPort {
    param([int]$Port)
    return [bool](
        Get-NetTCPConnection -State Listen -LocalPort $Port `
            -ErrorAction SilentlyContinue |
            Select-Object -First 1
    )
}

Write-Host "Checking lyrics tool services..."

if (-not (Test-AppPort 8000)) {
    $pythonPath = Join-Path $backendDir ".venv\Scripts\python.exe"
    if (-not (Test-Path -LiteralPath $pythonPath)) {
        Write-Host "Backend Python environment was not found: $pythonPath"
        exit 1
    }

    Write-Host "Starting backend on port 8000..."
    Start-Process `
        -FilePath $pythonPath `
        -ArgumentList "-m", "uvicorn", "app.main:app", "--env-file", ".env", "--host", "0.0.0.0", "--port", "8000" `
        -WorkingDirectory $backendDir `
        -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $runtimeDir "backend.out.log") `
        -RedirectStandardError (Join-Path $runtimeDir "backend.err.log")
} else {
    Write-Host "Backend is already running on port 8000."
}

if (-not (Test-AppPort 3000)) {
    $npmCommand = Get-Command "npm.cmd" -ErrorAction SilentlyContinue
    if (-not $npmCommand) {
        Write-Host "npm.cmd was not found. Please install Node.js."
        exit 1
    }

    Write-Host "Starting frontend on port 3000..."
    Start-Process `
        -FilePath $npmCommand.Source `
        -ArgumentList "run", "dev" `
        -WorkingDirectory $frontendDir `
        -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $runtimeDir "frontend.out.log") `
        -RedirectStandardError (Join-Path $runtimeDir "frontend.err.log")
} else {
    Write-Host "Frontend is already running on port 3000."
}

$deadline = (Get-Date).AddSeconds(60)
do {
    Start-Sleep -Milliseconds 700
    $frontendReady = Test-AppPort 3000
    $backendReady = Test-AppPort 8000
} until (($frontendReady -and $backendReady) -or (Get-Date) -gt $deadline)

if (-not $frontendReady -or -not $backendReady) {
    Write-Host "Services did not start within 60 seconds."
    Write-Host "Backend log: $(Join-Path $runtimeDir "backend.err.log")"
    Write-Host "Frontend log: $(Join-Path $runtimeDir "frontend.err.log")"
    exit 1
}

try {
    $health = Invoke-RestMethod `
        -Uri "http://127.0.0.1:8000/api/health" `
        -TimeoutSec 10
    if ($health.status -ne "ok") {
        throw "Health check returned an unexpected status."
    }
} catch {
    Write-Host "Backend health check failed: $($_.Exception.Message)"
    Write-Host "Backend log: $(Join-Path $runtimeDir "backend.err.log")"
    exit 1
}

Start-Process "http://localhost:3000"
Write-Host ""
Write-Host "Lyrics tool is ready: http://localhost:3000"
Write-Host "Use the stop batch file to stop both services."
