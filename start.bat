@echo off
chcp 65001
echo 正在启动选课系统...
echo 请确保已安装Node.js并添加到环境变量中

REM 检查Node.js是否已安装
node --version > nul 2>&1
if errorlevel 1 (
    echo Node.js未安装！
    echo 请访问 https://nodejs.org/ 下载并安装Node.js
    pause
    exit /b
)

REM 创建目录（如果不存在）
mkdir public\css 2>nul
mkdir public\js 2>nul
mkdir uploads 2>nul

REM 安装依赖
echo 正在安装依赖...
call npm install

REM 启动应用
echo 正在启动应用...
echo 请在浏览器中访问 http://localhost:3000
node server.js

pause
