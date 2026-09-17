@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\repair-and-publish-v052.ps1"
if errorlevel 1 (
  echo.
  echo REPAIR FAILED. Leave this window open and send the error to ChatGPT.
  pause
  exit /b 1
)
echo.
pause
