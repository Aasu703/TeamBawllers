@echo off
echo ==========================================
echo   Team Ballers - Team Setup
echo ==========================================
echo.

:: Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js not found!
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
)
echo [OK] Node.js found

:: Check Python
where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python not found!
    echo Download from: https://python.org/
    echo IMPORTANT: Check "Add to PATH" during install!
    pause
    exit /b 1
)
echo [OK] Python found

echo.
echo ==========================================
echo   Setting up Frontend
echo ==========================================
cd client
call npm install
call npx prisma generate
call npx prisma db push

echo.
echo ==========================================
echo   Setting up Backend  
echo ==========================================
cd ..\server

if not exist .venv (
    echo Creating Python virtual environment...
    python -m venv .venv
)

call .venv\Scripts\activate.bat
pip install -r requirements.txt

echo.
echo ==========================================
echo   Setup Complete!
echo ==========================================
echo.
echo To run the app:
echo.
echo   Terminal 1: cd server ^&^& run.bat
echo   Terminal 2: cd client ^&^& npm run dev
echo.
echo Then open: http://localhost:3000
echo.
pause
