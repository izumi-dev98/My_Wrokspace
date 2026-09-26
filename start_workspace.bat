@echo off
REM ============================================
REM My_Workspace Control Panel Launcher
REM ============================================
REM Starts both the Express API server (port 3001) and Vite dev server (port 5173)

echo.
echo ============================================
echo   My_Workspace Control Panel
echo ============================================
echo.

REM Check if node_modules exists
if not exist node_modules (
    echo Installing dependencies...
    npm install
    if errorlevel 1 (
        echo Failed to install dependencies
        pause
        exit /b 1
    )
)

echo Starting servers...
echo.
echo   API Server:  http://localhost:3001
echo   Web UI:      http://localhost:5173
echo.
echo Press Ctrl+C to stop both servers
echo.

npm run start