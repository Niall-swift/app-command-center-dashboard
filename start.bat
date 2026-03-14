@echo off
setlocal
title AVL Telecom Dashboard - Iniciar

echo ===================================================
echo   AVL Telecom Dashboard - Iniciador Sistema
echo ===================================================
echo.

:: Verifica se a pasta node_modules existe sem usar blocos IF com parênteses
if exist node_modules\nul goto :skip_install

echo [1/3] Instalando dependencias (isso pode demorar)...
call npm install
goto :do_build

:skip_install
echo [1/3] Dependencias ja instaladas.

:do_build
echo [2/3] Gerando versao otimizada (Build)...
call npm run build

echo [3/3] Iniciando Servidor Backend e Frontend...
echo.

:: Detectar IP Local
for /f "tokens=14" %%a in ('ipconfig ^| findstr /c:"IPv4"') do set IP=%%a
echo O dashboard estara disponivel em:
echo - Local:   http://localhost:3001
if not "%IP%"=="" echo - Na rede: http://%IP%:3001
echo.
npm run server

pause
