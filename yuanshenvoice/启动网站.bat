@echo off
chcp 65001 >nul
title 原神全息声之殿堂 - 本地服务
cd /d "%~dp0"
echo 正在启动【原神全息声之殿堂】本地服务...
start http://localhost:8080
node server.js
pause
