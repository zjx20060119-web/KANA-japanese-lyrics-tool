$ErrorActionPreference = "Continue"

$stopped = 0
$skipped = 0

foreach ($port in 3000, 8000) {
    $listeners = Get-NetTCPConnection -State Listen -LocalPort $port `
        -ErrorAction SilentlyContinue

    foreach ($listener in $listeners) {
        $processId = $listener.OwningProcess
        $processInfo = Get-CimInstance Win32_Process `
            -Filter "ProcessId=$processId" `
            -ErrorAction SilentlyContinue
        $commandLine = $processInfo.CommandLine

        $isAppProcess = $false
        if ($port -eq 8000) {
            $isAppProcess = $commandLine -match "uvicorn\s+app\.main:app"
        } else {
            $isAppProcess = (
                $commandLine -like "*japanese-lyrics-tool\frontend*"
            ) -or (
                $commandLine -match "next-server|start-server\.js"
            )
        }

        if ($isAppProcess) {
            Stop-Process -Id $processId -Force
            Write-Host "Stopped lyrics tool process on port $port (PID $processId)."
            $stopped += 1
        } else {
            Write-Host "Port $port belongs to another program and was skipped: $commandLine"
            $skipped += 1
        }
    }
}

if ($stopped -eq 0 -and $skipped -eq 0) {
    Write-Host "Lyrics tool is not running."
} elseif ($stopped -gt 0) {
    Write-Host "Lyrics tool stopped."
}
