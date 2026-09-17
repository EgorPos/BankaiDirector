@echo off
setlocal
cd /d "%~dp0"
echo.
echo ==============================================
echo   Director v0.5 - build and install
echo ==============================================
echo.
call npm.cmd install
if errorlevel 1 goto :fail
call npm.cmd audit --audit-level=high
if errorlevel 1 goto :fail
call npm.cmd run dist:win
if errorlevel 1 goto :fail
set "SETUP=%~dp0release\Director Setup 0.5.0.exe"
if exist "%SETUP%" (
  echo.
  echo Build complete. Starting installer...
  start "" "%SETUP%"
) else (
  echo.
  echo Build completed, but the expected installer was not found.
  start "" "%~dp0release"
)
echo.
echo You can close this window after the installer opens.
pause
exit /b 0
:fail
echo.
echo BUILD FAILED. Leave this window open and send the error to ChatGPT.
pause
exit /b 1
