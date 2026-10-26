@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 王者回响将在 http://localhost:8081 启动
echo 关闭此窗口即可停止网站。
node server.js
pause
