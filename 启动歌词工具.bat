@echo off
chcp 65001 >nul
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-app.ps1"
if errorlevel 1 (
  echo.
  echo Failed to start. Check the .runtime logs.
  pause
  exit /b 1
)
ping 127.0.0.1 -n 3 >nul
