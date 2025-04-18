# Cleanup script for ICCT QuizBee project (PowerShell version)
# This script removes unused files and optimizes the project

Write-Host "Starting cleanup process..." -ForegroundColor Cyan

# Remove any temporary files
Write-Host "Removing temporary files..." -ForegroundColor Yellow
Get-ChildItem -Path . -Include *.tmp, *.bak -File -Recurse | Remove-Item -Force

# Remove unused assets
if (Test-Path "./public/icon.svg") {
    Write-Host "Removing unused icon.svg..." -ForegroundColor Yellow
    Remove-Item "./public/icon.svg" -Force
}

# Check for node_modules and clean if needed
if (Test-Path "node_modules") {
    Write-Host "Cleaning node_modules..." -ForegroundColor Yellow
    npm prune
}

# Optimize images if imagemin is available
if (Get-Command npx -ErrorAction SilentlyContinue) {
    if (Test-Path "./public") {
        Write-Host "Optimizing images..." -ForegroundColor Yellow
        npx imagemin-cli "./public/*.png" --out-dir="./public/optimized"
        
        # Replace original files with optimized ones
        if (Test-Path "./public/optimized") {
            Get-ChildItem -Path "./public/optimized" | ForEach-Object {
                Move-Item $_.FullName -Destination "./public/" -Force
            }
            Remove-Item "./public/optimized" -Force
        }
    }
}

Write-Host "Cleanup complete!" -ForegroundColor Green 