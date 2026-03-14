@echo off
setlocal
title AVL Telecom Dashboard - Iniciar

echo ===================================================
echo   AVL Telecom Dashboard - Iniciador Sistema
echo ===================================================
echo.

:: Verifica se o node_modules existe
if not exist node_modules (
    echo [1/3] Instalando dependencias (isso pode demorar na primeira vez)...
    call npm install
) else (
    echo [1/3] Dependencias ja instaladas.
)

:: Build do Frontend
echo [2/3] Gerando versao otimizada (Build)...
call npm run build

:: Iniciar Servidor
echo [3/3] Iniciando Servidor Backend e Frontend...
echo.
echo O dashboard estara disponivel em: http://localhost:3001
echo Para outros computadores: http://[SEU-IP]:3001
echo.
npm run server

pause
