# install.ps1 - WebPilot v4.0 用户级安装 (不需要管理员权限)
#
# 这是 .exe 安装包的替代方案 - 没 electron-builder 也能用:
#   1. 验证 Node.js 22+
#   1.5 扫描本地端口 9222-9227 是否被占 (开箱即用 — 提示用户改)
#   2. 拉代码到 %LOCALAPPDATA%\WebPilot
#   3. npm install
#   4. 创建桌面 Chrome (WebPilot).lnk + 启动 WebPilot.lnk
#   5. 提示用户接下来做什么
#
# 用法:
#   .\install.ps1                 # 本地跑 (已 git clone)
#   iwr ... | iex                 # 远端跑 (理论; 现在网络封)
#
# v4.0.0, 2026-07-06

$ErrorActionPreference = 'Stop'

$ProductName = 'WebPilot'
$InstallDir = Join-Path $env:LOCALAPPDATA $ProductName
$StartMenuDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\' + $ProductName

Write-Host ''
Write-Host '=== WebPilot v4.0 用户级安装 ===' -ForegroundColor Cyan
Write-Host ''
Write-Host "安装位置: $InstallDir"
Write-Host ''

# 1. Node.js 22+ 检测
$nodeVer = (& node --version 2>$null) -replace 'v', ''
if (-not $nodeVer) {
  Write-Host '[!] Node.js 未装' -ForegroundColor Red
  Write-Host '    请先装 Node.js 22+: https://nodejs.org/' -ForegroundColor Yellow
  exit 1
}
$major = [int]($nodeVer.Split('.')[0])
if ($major -lt 22) {
  Write-Host "[!] Node.js v$nodeVer 太旧 (需要 22+)" -ForegroundColor Red
  exit 1
}
Write-Host "[OK] Node.js v$nodeVer" -ForegroundColor Green

# 1.5 Chrome 检测 (B2-24)
$chromePaths = @(
  'C:\Program Files\Google\Chrome\Application\chrome.exe',
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe"
)
$chromeFound = $false
foreach ($cp in $chromePaths) {
  if (Test-Path $cp) { $chromeFound = $true; Write-Host "[OK] Chrome 找到: $cp" -ForegroundColor Green; break }
}
if (-not $chromeFound) {
  Write-Host '[!] Chrome 未检测到 — 请先安装 Chrome' -ForegroundColor Red
  Write-Host '    下载地址: https://www.google.com/chrome/' -ForegroundColor Yellow
  Write-Host '    安装后再跑此脚本' -ForegroundColor Yellow
}

# 1.5 端口扫描 — 默认端口被占时提示用户 (开箱即用要点)
$DefaultPorts = @(9222, 9223, 9224, 9225)   # CDP / MCP / HTTP / Control
$BusyPorts = @()
foreach ($p in $DefaultPorts) {
  $busy = $false
  try {
    $conn = New-Object System.Net.Sockets.TcpClient
    $iar = $conn.BeginConnect('127.0.0.1', $p, $null, $null)
    $ok = $iar.AsyncWaitHandle.WaitOne(200)   # 200ms 超时
    if ($ok -and $conn.Connected) { $busy = $true; $conn.EndConnect($iar) }
    $conn.Close()
  } catch { $busy = $true }
  if ($busy) { $BusyPorts += $p }
}
if ($BusyPorts.Count -gt 0) {
  Write-Host "[!] 检测到本机默认端口被占: $($BusyPorts -join ', ')" -ForegroundColor Yellow
  Write-Host '    别担心, WebPilot daemon 启动时会自动迁移到 9228-9232.' -ForegroundColor Yellow
  Write-Host '    要改回默认? 装完打开 WebPilot → 顶栏 🔌 → 设置 → 🔗 连接' -ForegroundColor Yellow
  Write-Host ''
} else {
  Write-Host '[OK] 默认端口 9222-9225 全部空闲' -ForegroundColor Green
}

# 2. 准备安装目录 (用当前目录或 clone)
$cwdPath = (Get-Location).Path
if ($cwdPath -ne $InstallDir -and -not (Test-Path (Join-Path $cwdPath 'package.json'))) {
  if (-not (Test-Path $InstallDir)) {
    Write-Host "[*] 创建 $InstallDir..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    # 复制当前目录的所有源码
    Write-Host "[*] 复制源码 (跳过 node_modules)... " -NoNewline -ForegroundColor Cyan
    Get-ChildItem -Path $cwdPath -Force | Where-Object { $_.Name -ne 'node_modules' -and $_.Name -ne '.git' -and $_.Name -notlike '*.log' } | Copy-Item -Destination $InstallDir -Recurse -Force
    Write-Host '完成' -ForegroundColor Green
  } else {
    Write-Host "[!] 已存在 $InstallDir 但 cwd 是 $cwdPath" -ForegroundColor Yellow
    Write-Host '    跳到 安装目录...' -ForegroundColor Yellow
  }
  Push-Location $InstallDir
} elseif (Test-Path (Join-Path $cwdPath 'package.json')) {
  Write-Host "[OK] 当前目录有 package.json - 用本目录作为安装目录" -ForegroundColor Green
  $InstallDir = $cwdPath
}

# 3. npm install
if (-not (Test-Path 'node_modules')) {
  Write-Host '[*] npm install... (可能 1-2 分钟)' -ForegroundColor Cyan
  try {
    & npm install --no-audit --no-fund 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'npm install 失败' }
  } catch {
    Write-Host "[!] $_" -ForegroundColor Red
    Pop-Location
    exit 1
  }
} else {
  Write-Host '[OK] node_modules 已存在 (跳过)' -ForegroundColor Green
}

# 3.5 build React GUI (dist/ 是 v4.0.2 唯一 GUI 源,失败必须 abort)
$distPath = 'electron\renderer\dist\index.html'
if (-not (Test-Path $distPath)) {
  Write-Host '[*] 构建 React GUI (npm run build)...' -ForegroundColor Cyan
  & npm run build 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Host '[!] npm run build 失败 — GUI 是 daemon 唯一入口,必须修复后重装' -ForegroundColor Red
    exit 1
  }
} else {
  Write-Host '[OK] React GUI dist/ 已存在 (跳过)' -ForegroundColor Green
}

# 4. 创建桌面 Chrome (WebPilot).lnk (调用 daemon/browser-launcher)
Write-Host '[*] 创建桌面 Chrome (WebPilot).lnk...' -ForegroundColor Cyan
try {
  $findChromeOut = & node -e "
    import('./daemon/browser-picker.js').then(async (m) => {
      const r = await m.discoverBrowsers();
      if (r.best?.path) {
        console.log(r.best.path);
      }
      process.exit(0);
    }).catch((e) => { console.error(e.message); process.exit(1); });
  " 2>&1
  $chromePath = ($findChromeOut | Where-Object { $_ -match '\.exe$' } | Select-Object -First 1)
  if ($chromePath) {
    & node -e "
      import('./daemon/browser-launcher.js').then(async (m) => {
        const out = await m.createChromeShortcutLinks(process.argv[1]);
        console.error('lnk-created', JSON.stringify(out));
        process.exit(0);
      });
    " -- $chromePath 2>&1 | Out-Null
    Write-Host "[OK] Chrome (WebPilot).lnk 已创建 (桌面 + 开始菜单)" -ForegroundColor Green
  } else {
    Write-Host '[!] 没找到 Chrome 路径, 跳过 .lnk 创建 (手动装 Chrome 后再跑)' -ForegroundColor Yellow
  }
} catch {
  Write-Host "[!] .lnk 创建失败: $_" -ForegroundColor Yellow
}

# 5. 创建开始菜单 + 桌面 daemon 启动
if (-not (Test-Path $StartMenuDir)) {
  New-Item -ItemType Directory -Path $StartMenuDir -Force | Out-Null
}

$ws = New-Object -ComObject WScript.Shell

# 优先检测 Electron 桌面应用 (.exe),有的话建快捷指向它 (Mac 级体验)
$exePath = Join-Path $InstallDir 'dist\win-unpacked\WebPilot.exe'
$useElectron = $false
if (Test-Path $exePath) {
  $useElectron = $true
  Write-Host '[OK] 检测到 Electron 桌面应用 — 快捷方式指向 .exe' -ForegroundColor Green

  $desktopLnk = Join-Path ([Environment]::GetFolderPath('Desktop')) 'WebPilot.lnk'
  $sc = $ws.CreateShortcut($desktopLnk)
  $sc.TargetPath = $exePath
  $sc.WorkingDirectory = $InstallDir
  $sc.IconLocation = "$exePath,0"
  $sc.Description = "WebPilot — 让 AI 助手操作你的浏览器 (v4.0.3 桌面应用)"
  $sc.Save()
  Write-Host '[OK] 桌面 WebPilot.lnk 已创建 (指向 .exe)' -ForegroundColor Green

  $startMenuLnk = Join-Path $StartMenuDir 'WebPilot.lnk'
  $sc2 = $ws.CreateShortcut($startMenuLnk)
  $sc2.TargetPath = $exePath
  $sc2.WorkingDirectory = $InstallDir
  $sc2.IconLocation = "$exePath,0"
  $sc2.Save()
} else {
  Write-Host '[*] 没检测到 Electron .exe — 降级到 Node daemon 模式' -ForegroundColor Yellow

  $startBat = Join-Path $StartMenuDir '启动 WebPilot.bat'
  $startScript = @"
@echo off
cd /d "$InstallDir"
start "WebPilot" node daemon/main.js
"@
  Set-Content -Path $startBat -Value $startScript -Encoding ASCII -Force

  $daemonLnk = Join-Path ([Environment]::GetFolderPath('Desktop')) '启动 WebPilot.lnk'
  $sc = $ws.CreateShortcut($daemonLnk)
  $sc.TargetPath = $startBat
  $sc.WorkingDirectory = $InstallDir
  $sc.IconLocation = "$InstallDir\node.exe,0"
  $sc.Description = "启动 WebPilot daemon (MCP 9223 + HTTP 9224)"
  $sc.Save()
  Write-Host '[OK] 桌面 启动 WebPilot.lnk 已创建 (指向 daemon)' -ForegroundColor Green

  # GUI URL 快捷 (Node 模式下无桌面应用,只能浏览器开)
  $guiLnk = Join-Path ([Environment]::GetFolderPath('Desktop')) 'WebPilot 控制台.url'
  "[InternetShortcut]`nURL=http://127.0.0.1:9224/" | Set-Content -Path $guiLnk -Encoding ASCII -Force
  Write-Host '[OK] 桌面 WebPilot 控制台.url 已创建' -ForegroundColor Green
}

Pop-Location

# 6. 开自启勾选 (B2-26)
$autoLaunch = Read-Host '是否开机自启 WebPilot? (Y/N, 默认 N)'
if ($autoLaunch -eq 'Y' -or $autoLaunch -eq 'y') {
  try {
    $regPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
    if ($useElectron) {
      Set-ItemProperty -Path $regPath -Name 'WebPilot' -Value "`"$exePath`"" -ErrorAction Stop
    } else {
      Set-ItemProperty -Path $regPath -Name 'WebPilot' -Value "node `"$InstallDir\daemon\main.js`"" -ErrorAction Stop
    }
    Write-Host '[OK] 已设置开机自启 (可随时在 设置 → 系统 → 启动 里关掉)' -ForegroundColor Green
  } catch {
    Write-Host '[!] 开自启设置失败: $_' -ForegroundColor Yellow
  }
}

Write-Host ''
Write-Host '=== 安装完成 ===' -ForegroundColor Green
Write-Host ''
Write-Host '接下来 2 步:' -ForegroundColor Cyan
Write-Host '  1. 双击桌面 "Chrome (WebPilot)" 启动 Chrome (带 debug 端口)' -ForegroundColor White
if ($useElectron) {
  Write-Host '  2. 双击桌面 "WebPilot" 启桌面应用 (窗口 + 托盘)' -ForegroundColor White
} else {
  Write-Host '  2. 双击桌面 "启动 WebPilot" 启 daemon,然后 "WebPilot 控制台" 打开 GUI' -ForegroundColor White
}
Write-Host ''
Write-Host "卸载: 跑 .\uninstall.ps1 (或手动删 $InstallDir + 几个桌面快捷)" -ForegroundColor Yellow
