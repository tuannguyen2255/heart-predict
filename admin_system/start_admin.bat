@echo off
chcp 65001 >nul
title HeartGuard Admin Control Center (127.0.0.1:8090)
echo =====================================================================
echo   HEARTGUARD ADMIN CONTROL CENTER — LOCALHOST ONLY (127.0.0.1:8090)
echo   Mo trinh duyet tai: http://127.0.0.1:8090
echo =====================================================================
cd /d "%~dp0\.."
start "" http://127.0.0.1:8090
".venv\Scripts\python.exe" "admin_system\admin_server.py"
pause
