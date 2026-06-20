# Run this script ONCE in an Administrator PowerShell:
#   Right-click PowerShell → "Run as Administrator"
#   cd F:\Tech2025\Claude-AI\projects\asset-management
#   .\db\setup-mysql-windows.ps1

Write-Host "=== MySQL Setup for Asset Management ===" -ForegroundColor Cyan

# 1. Install MySQL via Chocolatey
Write-Host "`n[1/4] Installing MySQL..." -ForegroundColor Yellow
choco install mysql -y
if ($LASTEXITCODE -ne 0) {
    Write-Host "Chocolatey install failed. Trying winget..." -ForegroundColor Yellow
    winget install Oracle.MySQL --silent --accept-package-agreements --accept-source-agreements
}

# 2. Ensure MySQL service is running
Write-Host "`n[2/4] Starting MySQL service..." -ForegroundColor Yellow
$svcName = Get-Service -Name "MySQL*" | Select-Object -First 1 -ExpandProperty Name
if ($svcName) {
    Start-Service -Name $svcName -ErrorAction SilentlyContinue
    Write-Host "Service '$svcName' started." -ForegroundColor Green
} else {
    Write-Host "MySQL service not found. It may need a system restart." -ForegroundColor Red
    exit 1
}

Start-Sleep -Seconds 3

# 3. Find the temporary root password from MySQL error log
Write-Host "`n[3/4] Looking for temporary root password..." -ForegroundColor Yellow
$dataDir = "C:\ProgramData\MySQL\MySQL Server 9.6\Data"
if (-not (Test-Path $dataDir)) {
    $dataDir = "C:\ProgramData\MySQL\MySQL Server 8.0\Data"
}
$errLog = Get-ChildItem -Path $dataDir -Filter "*.err" -ErrorAction SilentlyContinue | Select-Object -First 1
$tempPass = ""
if ($errLog) {
    $line = Select-String -Path $errLog.FullName -Pattern "temporary password" | Select-Object -Last 1
    if ($line) {
        $tempPass = ($line.Line -split "root@localhost: ")[-1].Trim()
        Write-Host "Temp password found." -ForegroundColor Green
    }
}

# 4. Print next steps
Write-Host "`n[4/4] MySQL installed. Next steps:" -ForegroundColor Cyan
if ($tempPass) {
    Write-Host ""
    Write-Host "  A temporary root password was generated:" -ForegroundColor White
    Write-Host "  $tempPass" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Run this to reset it to 'root' (for local dev only):" -ForegroundColor White
    Write-Host "  mysql -u root -p`"$tempPass`" --connect-expired-password -e `"ALTER USER 'root'@'localhost' IDENTIFIED BY 'root';`"" -ForegroundColor Gray
} else {
    Write-Host ""
    Write-Host "  No temp password found — root may have no password." -ForegroundColor White
    Write-Host "  Try: mysql -u root" -ForegroundColor Gray
}

Write-Host ""
Write-Host "  Then run migrations (back in your normal terminal):" -ForegroundColor White
Write-Host "  mysql -u root -proot < db\migrations\001_create_users.sql" -ForegroundColor Gray
Write-Host "  mysql -u root -proot < db\migrations\002_create_assets_base.sql" -ForegroundColor Gray
Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Cyan
