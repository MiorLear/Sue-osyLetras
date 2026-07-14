@echo off
REM Doble clic en este archivo - configura el firewall de Windows para que tu
REM telefono pueda conectarse al backend en Docker corriendo en esta PC.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-windows-firewall.ps1"
