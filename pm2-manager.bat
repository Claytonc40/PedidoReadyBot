@echo off
chcp 65001 >nul
title PedidoReadyBot PM2 Manager

echo.
echo ========================================
echo    PedidoReadyBot PM2 Manager
echo ========================================
echo.

:menu
echo Escolha uma opção:
echo.
echo 1. Iniciar aplicação
echo 2. Parar aplicação
echo 3. Reiniciar aplicação
echo 4. Ver status
echo 5. Ver logs
echo 6. Ver logs de erro
echo 7. Ver logs de saída
echo 8. Monitorar em tempo real
echo 9. Parar e remover do PM2
echo 0. Sair
echo.
set /p choice="Digite sua escolha (0-9): "

if "%choice%"=="1" goto start
if "%choice%"=="2" goto stop
if "%choice%"=="3" goto restart
if "%choice%"=="4" goto status
if "%choice%"=="5" goto logs
if "%choice%"=="6" goto error_logs
if "%choice%"=="7" goto output_logs
if "%choice%"=="8" goto monitor
if "%choice%"=="9" goto delete
if "%choice%"=="0" goto exit
goto invalid

:start
echo.
echo 🚀 Iniciando PedidoReadyBot...
pm2 start ecosystem.config.js --env production
echo.
echo ✅ Aplicação iniciada! Verifique o status com a opção 4.
pause
goto menu

:stop
echo.
echo ⏹️ Parando PedidoReadyBot...
pm2 stop PedidoReadyBot
echo.
echo ✅ Aplicação parada!
pause
goto menu

:restart
echo.
echo 🔄 Reiniciando PedidoReadyBot...
pm2 restart PedidoReadyBot
echo.
echo ✅ Aplicação reiniciada!
pause
goto menu

:status
echo.
echo 📊 Status da aplicação:
pm2 status
echo.
pause
goto menu

:logs
echo.
echo 📋 Logs combinados (últimas 100 linhas):
pm2 logs PedidoReadyBot --lines 100
echo.
pause
goto menu

:error_logs
echo.
echo ❌ Logs de erro (últimas 100 linhas):
pm2 logs PedidoReadyBot --err --lines 100
echo.
pause
goto menu

:output_logs
echo.
echo ✅ Logs de saída (últimas 100 linhas):
pm2 logs PedidoReadyBot --out --lines 100
echo.
pause
goto menu

:monitor
echo.
echo 📺 Monitoramento em tempo real:
echo Pressione Ctrl+C para sair do monitoramento
pm2 monit
goto menu

:delete
echo.
echo 🗑️ Parando e removendo PedidoReadyBot do PM2...
pm2 delete PedidoReadyBot
echo.
echo ✅ Aplicação removida do PM2!
pause
goto menu

:invalid
echo.
echo ❌ Opção inválida! Tente novamente.
pause
goto menu

:exit
echo.
echo 👋 Até logo!
pause
exit
