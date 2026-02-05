@echo off
chcp 65001 > nul
cls

echo.
echo ========================================
echo   מערכת ניהול תשלומי מילואים
echo   ליטאי ניהול שירותים
echo ========================================
echo.

echo [1/3] בודק אם Node.js מותקן...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js לא מותקן!
    echo.
    echo אנא הורד והתקן Node.js מ:
    echo https://nodejs.org
    echo.
    pause
    exit /b 1
)
echo ✅ Node.js מותקן
echo.

echo [2/3] בודק אם צריך להתקין חבילות...
if not exist "node_modules" (
    echo מתקין חבילות... (זה יכול לקחת דקה)
    call npm install
    echo.
)
echo ✅ החבילות מותקנות
echo.

echo [3/3] מפעיל שרת...
echo.
call npm start
