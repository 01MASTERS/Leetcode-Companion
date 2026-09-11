@echo off
title LC Tracker Backend - Dev Server
echo ===================================================
echo   Starting LC Company Tracker dev server...
echo   Path: %~dp0webapp
echo ===================================================
cd /d "%~dp0webapp"
call npm run dev
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Next.js dev server failed to start or crashed.
    pause
)
