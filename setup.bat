@echo off
chcp 65001
echo Creating directory structure...

mkdir public 2>nul
mkdir public\css 2>nul
mkdir public\js 2>nul
mkdir uploads 2>nul

echo Installing dependencies...
call npm install

echo Setup complete!
pause
