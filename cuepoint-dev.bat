@echo off
setlocal EnableExtensions
cd /d "%~dp0"

if /i "%~1"=="help" goto :help
if "%~1"=="/?" goto :help
if /i "%~1"=="setup" goto :setup
goto :daily

:help
echo.
echo  cuepoint-dev.bat       Start Docker ^(Postgres+Redis^) then pnpm dev
echo  cuepoint-dev.bat setup  First-time: Docker, pnpm install, db:generate, db:migrate
echo.
echo  Prisma EPERM: stop all "pnpm dev" / Node first. Or: pnpm db:generate:noclean
echo.
exit /b 0

:daily

echo [cuepoint] Starting Postgres + Redis (Docker)...
docker compose up -d postgres redis
if errorlevel 1 (
  echo [cuepoint] ERROR: Docker failed. Is Docker Desktop running?
  pause
  exit /b 1
)

echo [cuepoint] Waiting a few seconds for Postgres to accept connections...
timeout /t 4 /nobreak >nul

echo [cuepoint] Starting API + Web - open http://localhost:5173  (Ctrl+C to stop)
call pnpm dev
exit /b %errorlevel%

:: --- First-time / refresh: install, generate, migrate, then same as daily ---
:setup
echo [cuepoint] SETUP mode - Docker, install, Prisma, migrations
echo.

echo [cuepoint] Starting Postgres + Redis...
docker compose up -d postgres redis
if errorlevel 1 (
  echo [cuepoint] ERROR: Docker failed. Is Docker Desktop running?
  pause
  exit /b 1
)
echo [cuepoint] Waiting for Postgres...
timeout /t 4 /nobreak >nul

echo [cuepoint] pnpm install...
call pnpm install
if errorlevel 1 goto :bad

echo [cuepoint] pnpm db:generate... ^(stop other "pnpm dev" windows if you see EPERM^)
call pnpm db:generate
if errorlevel 1 goto :bad

echo [cuepoint] pnpm db:migrate...
call pnpm db:migrate
if errorlevel 1 goto :bad

echo.
echo [cuepoint] Setup finished. Ensure .env exists ^(copy from .env.example^) with AUTH_SECRET set.
echo [cuepoint] Optional: pnpm db:seed  ^(demo user / room^)
echo [cuepoint] Run cuepoint-dev.bat without arguments to start dev only.
echo.
pause
exit /b 0

:bad
echo [cuepoint] A command failed.
pause
exit /b 1
