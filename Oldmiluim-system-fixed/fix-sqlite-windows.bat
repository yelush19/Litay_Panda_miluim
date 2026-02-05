@echo off
echo.
echo ============================================
echo    Fixing SQLite for Windows
echo ============================================
echo.

echo Removing old installation...
if exist node_modules\better-sqlite3 (
    rmdir /s /q node_modules\better-sqlite3
)

echo.
echo Reinstalling better-sqlite3 for Windows...
call npm install better-sqlite3 --build-from-source

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Failed to rebuild better-sqlite3
    echo.
    echo Alternative solution: Installing without SQLite...
    call npm uninstall better-sqlite3
    echo.
    echo SQLite removed. System will use alternative storage.
    pause
    exit /b 1
)

echo.
echo ============================================
echo    SUCCESS! SQLite is now ready for Windows
echo ============================================
echo.
pause
