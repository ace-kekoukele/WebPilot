# uninstall.ps1 — v4.0 卸载
$ErrorActionPreference = 'SilentlyContinue'

$ProductName = 'WebPilot'
$InstallDir = Join-Path $env:LOCALAPPDATA $ProductName
$StartMenuDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\' + $ProductName

Write-Host "[*] 停止 WebPilot daemon..."
Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object {
  $_.MainModule.FileName -like '*node.exe' -and $_.CommandLine -like '*daemon/main.js*'
} | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "[*] 删除桌面快捷..."
Remove-Item -Path (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Chrome (WebPilot).lnk') -Force -ErrorAction SilentlyContinue
Remove-Item -Path (Join-Path ([Environment]::GetFolderPath('Desktop')) '启动 WebPilot.lnk') -Force -ErrorAction SilentlyContinue
Remove-Item -Path (Join-Path ([Environment]::GetFolderPath('Desktop')) 'WebPilot 控制台.url') -Force -ErrorAction SilentlyContinue

Write-Host "[*] 删除开始菜单..."
if (Test-Path $StartMenuDir) { Remove-Item -Path $StartMenuDir -Recurse -Force }

Write-Host "[*] 删除安装目录 $InstallDir..."
if (Test-Path $InstallDir) { Remove-Item -Path $InstallDir -Recurse -Force }

Write-Host "[OK] 卸载完成" -ForegroundColor Green
Write-Host ""
Write-Host "注意: 用户数据 (config.json, 日志) 在 $InstallDir, 已经一起删"
Write-Host "Chrome 桌面 .lnk 也可能还有 (由 daemon 创建)"
