@echo off
setlocal
cd /d "%~dp0"
PowerShell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\connect-github-and-publish.ps1"
if errorlevel 1 (
  echo.
  echo SETUP FAILED. Leave this window open and send the error to ChatGPT.
  pause
)
