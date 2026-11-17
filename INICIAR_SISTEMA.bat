@echo off
title IN SIDE LOGISTIC - Gestion de Cotizaciones (MVP V1.0)
echo ============================================================================
echo   IN SIDE LOGISTIC S.A. DE C.V. ^| GESTION DE COTIZACIONES (MVP V1.0)
echo ============================================================================
echo Iniciando servidor en http://localhost:3080 ...
start "" "http://localhost:3080"
call npm.cmd run dev
pause
