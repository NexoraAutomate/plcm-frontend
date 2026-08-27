@echo off
title PLCM Stop
setlocal

echo ===========================================
echo   Stopping PLCM backend and frontend
echo ===========================================
echo.

echo [1/2] Stopping uvicorn (port 8000)...
taskkill /FI "WINDOWTITLE eq PLCM Backend*" /T /F >nul 2>&1
powershell -NoProfile -Command ^
  "Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'uvicorn app\.main:app' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
echo       Done.
echo.

echo [2/2] Stopping npm / Next.js (port 3000)...
taskkill /FI "WINDOWTITLE eq PLCM Frontend*" /T /F >nul 2>&1
powershell -NoProfile -Command ^
  "Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'next( |\.)dev' -or $_.CommandLine -match 'next-server' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
echo       Done.
echo.

echo Backend (8000) and frontend (3000) have been stopped.
echo.
timeout /t 3 /nobreak >nul
