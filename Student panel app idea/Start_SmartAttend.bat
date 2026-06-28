@echo off
color 0b
title SmartAttend System Launcher

echo ==================================================
echo   Starting SmartAttend Local Bridge...
echo ==================================================
start "SmartAttend Bridge" cmd /k "cd ""python files"" && python local_bridge.py"

echo.
echo Waiting for server to start...
timeout /t 2 /nobreak >nul

echo.
echo ==================================================
echo   Opening Dashboard...
echo ==================================================
start "" "html\dashboard1.html"

exit
