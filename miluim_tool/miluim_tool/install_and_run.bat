@echo off
chcp 65001 > nul

echo.
echo ========================================
echo   Miluim System - Litay
echo ========================================
echo.

python --version > nul 2>&1
if %errorlevel% neq 0 (
    echo Python is not installed
    echo Download from: https://www.python.org/downloads/
    pause
    exit /b
)

echo Installing required packages...
pip install pandas openpyxl --quiet

echo Starting application...
python miluim_manager.py

pause
