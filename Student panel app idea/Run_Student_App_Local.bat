@echo off
color 0a
title SmartAttend Student Mobile App Runner
echo ========================================================
echo   SmartAttend Student Mobile App
echo ========================================================
echo.
echo Starting local preview server on port 8080...
echo.
echo To test on your mobile phone on the same Wi-Fi:
echo   Open browser and go to: http://%COMPUTERNAME%:8080 or your local IP:8080
echo.
start "" "http://localhost:8080/index.html"
npx --yes serve "APK_Student_Panel" -l 8080
pause
