@echo off
title Cybotic Cloudflare Tunnel Launcher
echo ==========================================================
echo  [Cybotic] Starting Zero-Trust Cloudflare Tunnel
echo  Local Database, ChromaDB, and Vault remain 100%% on your PC
echo ==========================================================
powershell -ExecutionPolicy Bypass -File "%~dp0run_tunnel.ps1"
pause
