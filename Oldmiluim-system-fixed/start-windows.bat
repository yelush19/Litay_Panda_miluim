@echo off
echo.
echo ============================================
echo    Miluim Management System - Litay
echo    Automated Installation
echo ============================================
echo.

REM Check Node.js
echo [1/3] Checking if Node.js is installed...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Node.js is not installed!
    echo.
    echo Please download and install from: https://nodejs.org
    echo Choose the LTS version (green button)
    echo.
    pause
    exit /b 1
)

echo OK: Node.js is installed
node -v
echo.

REM Install packages
echo [2/3] Installing required packages...
echo (This may take 1-2 minutes...)
call npm install
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Failed to install packages
    pause
    exit /b 1
)

echo.
echo OK: All packages installed successfully!
echo.

REM Start server
echo [3/3] Starting server...
echo.
echo ============================================
echo    System is ready!
echo    Open your browser and go to:
echo    http://localhost:3000
echo ============================================
echo.
echo To stop the server - press Ctrl+C
echo.

node server/index.js
