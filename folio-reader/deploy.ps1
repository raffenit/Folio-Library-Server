#!/usr/bin/env pwsh
# Folio Deployment Script for Windows/Docker
# Run this after pulling latest changes from git

param(
    [string]$Port = "3002",
    [string]$Network = "media-network",
    [switch]$UpdateCaddy = $false
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Folio Deployment Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Build the image
Write-Host "`n[1/4] Building Docker image..." -ForegroundColor Yellow
docker build -t folio:latest .
if ($LASTEXITCODE -ne 0) {
    Write-Error "Docker build failed!"
    exit 1
}

# 2. Stop and remove old container
Write-Host "`n[2/4] Stopping old container..." -ForegroundColor Yellow
$containerExists = docker ps -aq -f name=folio
if ($containerExists) {
    docker stop folio
    docker rm folio
    Write-Host "Old container removed." -ForegroundColor Green
} else {
    Write-Host "No existing container found." -ForegroundColor Gray
}

# 3. Start new container
Write-Host "`n[3/4] Starting new container on port $Port..." -ForegroundColor Yellow
docker run -d --name folio --network $Network -p "${Port}:80" folio:latest
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to start container!"
    exit 1
}

# 4. Health check
Write-Host "`n[4/4] Health check..." -ForegroundColor Yellow
Start-Sleep -Seconds 2
$health = docker ps -f name=folio --format "{{.Status}}"
Write-Host "Container status: $health" -ForegroundColor Green

# Test proxy endpoint
Write-Host "Testing /dynamic-proxy endpoint..." -ForegroundColor Gray
try {
    $test = Invoke-WebRequest -Uri "http://localhost:$Port/dynamic-proxy?url=http://example.com" -Method GET -TimeoutSec 5 -ErrorAction SilentlyContinue
    Write-Host "Proxy endpoint responding: $($test.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "Proxy test: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host "Folio running at: http://localhost:$Port" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if ($UpdateCaddy) {
    Write-Host "`nNote: Remember to update Caddyfile if you changed ports!" -ForegroundColor Yellow
}
