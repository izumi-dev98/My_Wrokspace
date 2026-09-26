@echo off
REM ============================================
REM Git Push Script for My_Workspace
REM ============================================
REM This script stages all changes, commits, and pushes to GitHub
REM Make sure you have configured the remote with your PAT:
REM   git remote set-url origin https://YOUR_TOKEN@github.com/izumi-dev98/My_Wrokspace.git

echo.
echo ============================================
echo   My_Workspace - Git Push to GitHub
echo ============================================
echo.

REM Check if we're in a git repository
git rev-parse --git-dir >nul 2>&1
if errorlevel 1 (
    echo ERROR: Not a git repository!
    echo Run this script from the My_Workspace folder.
    pause
    exit /b 1
)

REM Check if remote origin exists
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo ERROR: No remote 'origin' configured!
    echo Run this command first (replace YOUR_TOKEN with your PAT):
    echo   git remote add origin https://YOUR_TOKEN@github.com/izumi-dev98/My_Wrokspace.git
    pause
    exit /b 1
)

echo [1/4] Checking git status...
git status --short

echo.
echo [2/4] Staging all changes...
git add -A

echo.
echo [3/4] Committing changes...
set /p commit_msg="Enter commit message (or press Enter for default): "
if "%commit_msg%"=="" (
    set commit_msg=Update workspace: %date% %time%
)
git commit -m "%commit_msg%"
if errorlevel 1 (
    echo No changes to commit (working tree clean).
    goto :push
)

echo.
echo [4/4] Pushing to GitHub...
git push origin main
if errorlevel 1 (
    echo.
    echo Push failed! Common issues:
    echo 1. Wrong PAT or expired token
    echo 2. No internet connection
    echo 3. Branch name mismatch (try 'git push origin master')
    echo.
    pause
    exit /b 1
)

:push
echo.
echo ============================================
echo   Success! Changes pushed to GitHub
echo ============================================
echo.
pause