@echo off
setlocal enabledelayedexpansion
title Installation e-depot API (on-premise MEDLOG)

REM ============================================================
REM  Script d'installation cle en main de l'API e-depot
REM  sur un serveur Windows interne MEDLOG.
REM  Voir DEPLOY-ONPREM.md pour le detail (IIS, front, DB).
REM  -> Executer en tant qu'ADMINISTRATEUR (clic droit).
REM  -> Re-executer ce script = met a jour (git pull + rebuild).
REM ============================================================

REM ================== PARAMETRES (modifiables) ==================
set "INSTALL_DIR=C:\apps\e-depot"
set "REPO_URL=https://github.com/ptiwazo/e-depot.git"
set "API_PORT=3001"
set "SERVICE_NAME=e-depot-api"
set "CORS_ORIGIN=https://ci-apps.medlog.com"
REM =============================================================

echo(
echo ============================================================
echo   Installation e-depot API - serveur interne MEDLOG
echo   Dossier : %INSTALL_DIR%   Port : %API_PORT%
echo ============================================================
echo(

REM --- Droits administrateur ---
net session >nul 2>&1
if errorlevel 1 (
  echo [X] Lancez ce script en tant qu'ADMINISTRATEUR (clic droit -^> Executer en tant qu'administrateur^).
  pause & exit /b 1
)

REM --- Node.js ---
where node >nul 2>&1
if errorlevel 1 (
  echo [X] Node.js introuvable. Installez Node.js 20 LTS depuis https://nodejs.org puis relancez.
  pause & exit /b 1
)
for /f "delims=" %%v in ('node -v') do set "NODEV=%%v"
echo [OK] Node.js !NODEV!

REM --- Git ---
where git >nul 2>&1
if errorlevel 1 (
  echo [X] Git introuvable. Installez Git depuis https://git-scm.com puis relancez.
  pause & exit /b 1
)
echo [OK] Git present

REM --- Code : clone (1ere fois) ou mise a jour ---
if exist "%INSTALL_DIR%\apps\api\package.json" (
  echo [..] Mise a jour du code (git pull^)...
  pushd "%INSTALL_DIR%" & git pull & popd
) else (
  echo [..] Recuperation du code (git clone^)...
  git clone "%REPO_URL%" "%INSTALL_DIR%"
  if errorlevel 1 ( echo [X] Echec du git clone. & pause & exit /b 1 )
)

set "API_DIR=%INSTALL_DIR%\apps\api"
pushd "%API_DIR%"

REM --- Dependances ---
echo [..] Installation des dependances (npm install^)...
call npm install --include=dev
if errorlevel 1 ( echo [X] npm install a echoue. & popd & pause & exit /b 1 )

REM --- Fichier .env ---
if not exist ".env" (
  echo(
  echo --- Configuration .env ---
  set "DBURL="
  set /p "DBURL=Collez l'URL PostgreSQL ^(DATABASE_URL^) : "
  if "!DBURL!"=="" ( echo [X] DATABASE_URL vide, abandon. & popd & pause & exit /b 1 )
  > "%TEMP%\edepot-secret.js" echo console.log(require('crypto').randomBytes(32).toString('hex'));
  for /f "delims=" %%s in ('node "%TEMP%\edepot-secret.js"') do set "JWTSEC=%%s"
  del "%TEMP%\edepot-secret.js" >nul 2>&1
  (
    echo DATABASE_URL=!DBURL!
    echo JWT_SECRET=!JWTSEC!
    echo JWT_EXPIRES_IN=12h
    echo NODE_ENV=production
    echo PORT=%API_PORT%
    echo CORS_ORIGIN=%CORS_ORIGIN%
    echo BODY_LIMIT=25mb
  ) > ".env"
  echo [OK] .env cree (JWT_SECRET genere automatiquement^).
) else (
  echo [OK] .env existant conserve.
)

REM --- Build ---
echo [..] Compilation (npm run build^)...
call npm run build
if errorlevel 1 ( echo [X] Build echoue. & popd & pause & exit /b 1 )

REM --- Migrations base ---
echo [..] Application des migrations (prisma migrate deploy^)...
call npx prisma migrate deploy
if errorlevel 1 ( echo [X] Migrations echouees - verifiez DATABASE_URL dans .env. & popd & pause & exit /b 1 )

REM --- Initialisation des donnees (optionnel, 1ere fois) ---
set "DOSEED="
set /p "DOSEED=Initialiser les donnees de base ^(admin, off-docks, shifts^) ? [o/N] : "
if /i "!DOSEED!"=="o" (
  echo [..] Seed...
  call npm run db:seed
)

popd

REM --- NSSM : service Windows (detection puis telechargement si absent) ---
set "NSSM="
where nssm >nul 2>&1 && for /f "delims=" %%n in ('where nssm') do set "NSSM=%%n"
if not defined NSSM if exist "%INSTALL_DIR%\nssm.exe" set "NSSM=%INSTALL_DIR%\nssm.exe"
if not defined NSSM (
  echo [..] Telechargement de NSSM (gestion du service^)...
  curl -L -s -o "%TEMP%\nssm.zip" https://nssm.cc/release/nssm-2.24.zip
  if exist "%TEMP%\nssm.zip" (
    tar -xf "%TEMP%\nssm.zip" -C "%INSTALL_DIR%" >nul 2>&1
    if exist "%INSTALL_DIR%\nssm-2.24\win64\nssm.exe" (
      copy /y "%INSTALL_DIR%\nssm-2.24\win64\nssm.exe" "%INSTALL_DIR%\nssm.exe" >nul
      set "NSSM=%INSTALL_DIR%\nssm.exe"
    )
    del "%TEMP%\nssm.zip" >nul 2>&1
  )
)

for /f "delims=" %%p in ('where node') do set "NODEEXE=%%p"
if not exist "%INSTALL_DIR%\logs" mkdir "%INSTALL_DIR%\logs"

if defined NSSM (
  echo [..] Installation du service Windows "%SERVICE_NAME%"...
  "!NSSM!" stop %SERVICE_NAME% >nul 2>&1
  "!NSSM!" remove %SERVICE_NAME% confirm >nul 2>&1
  "!NSSM!" install %SERVICE_NAME% "!NODEEXE!" "%API_DIR%\dist\main.js" >nul
  "!NSSM!" set %SERVICE_NAME% AppDirectory "%API_DIR%" >nul
  "!NSSM!" set %SERVICE_NAME% AppStdout "%INSTALL_DIR%\logs\api.out.log" >nul
  "!NSSM!" set %SERVICE_NAME% AppStderr "%INSTALL_DIR%\logs\api.err.log" >nul
  "!NSSM!" set %SERVICE_NAME% Start SERVICE_AUTO_START >nul
  "!NSSM!" start %SERVICE_NAME% >nul 2>&1
  echo [OK] Service "%SERVICE_NAME%" installe et demarre (auto au boot^).
) else (
  echo [!] NSSM indisponible : lancement direct dans une fenetre (a laisser ouverte^).
  start "e-depot-api" cmd /k "cd /d "%API_DIR%" && node dist\main.js"
)

REM --- Verification sante ---
echo [..] Verification de l'API...
timeout /t 7 /nobreak >nul
curl -s http://localhost:%API_PORT%/api/health
echo(
echo(

echo ============================================================
echo   TERMINE
echo ============================================================
echo   API locale  : http://localhost:%API_PORT%/api/health
echo(
echo   Etapes restantes (voir DEPLOY-ONPREM.md^) :
echo   1^) IIS : deposer deploy\iis\web.onprem.config comme web.config
echo      du site ci-apps.medlog.com (proxy /e-depot/api -^> localhost:%API_PORT%^).
echo   2^) Front : VITE_API_URL=https://ci-apps.medlog.com/e-depot puis rebuild/redeploy.
echo   3^) Parametres -^> Notifications SMS : renseigner le mot de passe Gmail, tester l'envoi.
echo ============================================================
echo(
echo   Commandes service : nssm start^|stop^|restart %SERVICE_NAME%
echo   Logs             : %INSTALL_DIR%\logs\
echo(
pause
endlocal
