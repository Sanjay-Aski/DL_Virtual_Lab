@echo off
setlocal

set "ROOT=%~dp0"

echo Starting FastAPI backend on http://localhost:8000 ...
start "DL Lab Backend" cmd /k "cd /d "%ROOT%backend" && python -m uvicorn app:app --host 0.0.0.0 --port 8000"

echo Starting merged dashboard frontend on http://localhost:3000 ...
start "DL Lab Frontend" cmd /k "cd /d "%ROOT%frontend" && npm start"

echo.
echo Merged lab is launching in separate terminals.
echo Frontend: http://localhost:3000
echo Backend:  http://localhost:8000

timeout /t 2 >nul
start "" http://localhost:3000

endlocal
