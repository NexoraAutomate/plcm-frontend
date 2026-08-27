@echo off
title PLCM Start
setlocal

set "BACKEND_DIR=C:\Project files\Jul-2026\plcm-backend"
set "FRONTEND_DIR=C:\Project files\Jul-2026\plcm-frontend"

echo ===========================================
echo   Starting PLCM backend and frontend
echo ===========================================
echo.

echo [1/2] Backend: activate .venv and run uvicorn...
start "PLCM Backend" cmd /k "cd /d "%BACKEND_DIR%" && call .venv\Scripts\activate.bat && uvicorn app.main:app --reload"
echo       Window opened.
echo.

echo [2/2] Frontend: npm run dev...
start "PLCM Frontend" cmd /k "cd /d "%FRONTEND_DIR%" && npm run dev"
echo       Window opened.
echo.

echo Backend:  http://127.0.0.1:8000
echo Docs:     http://127.0.0.1:8000/docs
echo Frontend: http://localhost:3000
echo.
echo Close the Backend / Frontend windows to stop those services.
echo.
timeout /t 5 /nobreak >nul
