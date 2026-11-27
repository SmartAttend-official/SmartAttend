@echo off
echo Organizing SmartAttend Files...

:: Create directories
mkdir html 2>nul
mkdir images 2>nul

:: Move image files
move "*.png" images\ >nul
move "*.jpg" images\ >nul

:: Move html files
move "*.html" html\ >nul

:: Move python files
mkdir "python files" 2>nul
move "*.py" "python files\" >nul

echo.
echo Files have been successfully organized into 'html' and 'images' folders!
echo The image references have already been updated by AI.
echo Please open the 'html' folder and double-click Login.html to start the app.
echo.
pause
