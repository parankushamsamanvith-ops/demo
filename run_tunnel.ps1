# ==============================================================================
# Cybotic Zero-Trust Cloudflare Tunnel Launcher
# Exposes Cybotic securely to the web while keeping your local ChromaDB, 
# SQLite database, and AES-256 encrypted vault strictly on your local PC.
# ==============================================================================

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " [Cybotic] Starting Zero-Trust Cloudflare Tunnel" -ForegroundColor Cyan
Write-Host " Local Database & Vector Store remain 100% on your machine" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

# Set project paths
$projectRoot = "D:\project\Cybotic"
$backendDir = "$projectRoot\backend"
$cloudflaredPath = "$projectRoot\cloudflared.exe"

# 1. Start the Cybotic Backend in background process if not already running
Write-Host "`n[*] Checking if backend is running on port 8000..." -ForegroundColor Yellow
$portInUse = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue

if (-not $portInUse) {
    Write-Host "[+] Launching Cybotic Backend on http://127.0.0.1:8000..." -ForegroundColor Green
    Start-Process -FilePath "$backendDir\venv\Scripts\uvicorn.exe" -ArgumentList "app.main:app --host 127.0.0.1 --port 8000" -WorkingDirectory $backendDir -WindowStyle Hidden
    Start-Sleep -Seconds 3
} else {
    Write-Host "[✓] Backend is already running on port 8000." -ForegroundColor Green
}

# 2. Start Cloudflare Tunnel
Write-Host "`n[+] Connecting encrypted outbound tunnel to Cloudflare Edge..." -ForegroundColor Cyan
Write-Host "[*] Look for the public URL ending with: .trycloudflare.com`n" -ForegroundColor Yellow

& $cloudflaredPath tunnel --url http://127.0.0.1:8000
