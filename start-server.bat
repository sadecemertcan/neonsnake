@echo off
title Neon Snake Server
:start
echo Sunucu baslatiliyor...
node server.js
echo Sunucu kapandi, yeniden baslatiliyor...
timeout /t 5
goto start