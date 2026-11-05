@echo off
rem MASSH demo: double-click to start (Windows)
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py serve.py
) else (
  python serve.py
)
pause
