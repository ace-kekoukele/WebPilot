// daemon/browser-launcher.js — 用户 Chrome 启动辅助 + .lnk 快捷方式创建
//
// v4.0 (§27.1): BB 不启 Chrome 进程本身; 这里做 2 件事:
//   1. 为用户的 Chrome 创建桌面 / 开始菜单 的 "Chrome (WebPilot).lnk"
//      (target = 用户 Chrome 路径 + --remote-debugging-port flag)
//   2. 用户双击 .lnk 启动 Chrome → daemon 的 ensureBridge() 自动连上
//
// 全部跨 Windows / Mac / Linux 用 PowerShell/VBScript 外的 native 方法:
//   Windows: WScript.Shell COM (PowerShell 会创建)
//   Linux: .desktop 文件
//   Mac: .command 文件 (v4.1)

import { existsSync, writeFileSync, promises as fs, mkdirSync } from 'node:fs';
import { execFile } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { DEFAULT_PORTS, PRODUCT_NAME } from '../lib/version.js';

// ──── Windows .lnk 创建（用 PowerShell + WScript.Shell） ─────────
// 这是最可靠的方法, 不需要 ps1exe 之类的第三方包
// 用临时 .ps1 文件 + EncodedCommand 兼容路径里有空格的情况
function powershellEscape(s) {
  return `'${String(s).replace(/'/g, `''`).replace(/`/g, '``')}'`;
}

export async function createWindowsShortcut(opts) {
  const {
    targetPath,          // C:\...\chrome.exe
    shortcutPath,        // 桌面上的 .lnk 完整路径
    description = PRODUCT_NAME + ' 控制入口',
    extraArgs: extraArgs = '',      // 启动参数 (含 --remote-debugging-port)
    iconPath = null,     // 图标 (可选)
    workingDir = null,
  } = opts;

  const wd = workingDir || path.dirname(targetPath);
  const icon = iconPath || targetPath;

  const script = `
$ErrorActionPreference = 'Stop'
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut(${powershellEscape(shortcutPath)})
$Shortcut.TargetPath = ${powershellEscape(targetPath)}
$Shortcut.WorkingDirectory = ${powershellEscape(wd)}
$Shortcut.Description = ${powershellEscape(description)}
$Shortcut.IconLocation = ${powershellEscape(icon + ',0')}
${extraArgs ? `$Shortcut.Arguments = ${powershellEscape(extraArgs)}` : ''}
$Shortcut.Save()
Write-Output 'OK'
`;

  // encode 成 UTF-16LE base64 解决编码问题
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  return new Promise((resolve, reject) => {
    execFile('powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
       '-EncodedCommand', encoded],
      { windowsHide: true, timeout: 15000 },
      (err, stdout, stderr) => {
        if (err) reject(new Error(`PowerShell failed: ${stderr || err.message}`));
        else resolve({ ok: stdout.includes('OK'), stdout, stderr });
      },
    );
  });
}

// ──── 一次性创建两个 .lnk — 桌面 + 开始菜单 ──────────────────────
export async function createChromeShortcutLinks(chromeExePath) {
  if (!existsSync(chromeExePath)) {
    throw new Error(`Chrome 不存在: ${chromeExePath}`);
  }

  const port = process.env.BB_CDP_PORT || String(DEFAULT_PORTS.cdp);
  const extraArgs = `--remote-debugging-port=${port} --remote-debugging-address=127.0.0.1`;

  const desktop = path.join(os.homedir(), 'Desktop');
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const startMenu = path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', PRODUCT_NAME);

  const labelShort = `Chrome (${PRODUCT_NAME})`;
  const desktopLnk = path.join(desktop, `${labelShort}.lnk`);
  const startMenuDir = startMenu;
  const startMenuLnk = path.join(startMenuDir, `${labelShort}.lnk`);

  // 确保开始菜单目录存在
  try { mkdirSync(startMenuDir, { recursive: true }); } catch {}

  const results = [];
  for (const [lnkPath, location] of [[desktopLnk, 'desktop'], [startMenuLnk, 'start-menu']]) {
    try {
      const r = await createWindowsShortcut({
        targetPath: chromeExePath,
        shortcutPath: lnkPath,
        extraArgs,
        description: `${PRODUCT_NAME} 控制入口. 启动 Chrome 并打开 9222 debug 端口. 关闭浏览器不会影响 ${PRODUCT_NAME}.`,
      });
      results.push({ location, ok: r.ok, path: lnkPath });
    } catch (e) {
      results.push({ location, ok: false, error: e.message, path: lnkPath });
    }
  }
  return results;
}

// ──── 清理（卸载时用） ───────────────────────────────────────────
export async function removeChromeShortcutLinks() {
  if (process.platform !== 'win32') return [];
  const desktop = path.join(os.homedir(), 'Desktop');
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const startMenu = path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', PRODUCT_NAME);
  const labelShort = `Chrome (${PRODUCT_NAME})`;
  const removed = [];
  for (const dir of [desktop, startMenu]) {
    try {
      await fs.unlink(path.join(dir, `${labelShort}.lnk`));
      removed.push(dir);
    } catch {}
  }
  return removed;
}

// ──── attach 友好错误 — 用户没启 Chrome 时的引导 ─────────────────
export function attachFailureGuidance(error, port = DEFAULT_PORTS.cdp) {
  return {
    ok: false,
    code: 'CHROME_NOT_ATTACHED',
    message: `未找到用户浏览器 (127.0.0.1:${port}).`,
    detail: [
      `可能原因:`,
      `  1. 用户的 Chrome 没在运行`,
      `  2. 用户的 Chrome 启动时没加 --remote-debugging-port=${port}`,
      ``,
      `解决方法 (二选一):`,
      `  · 双击桌面 "Chrome (${PRODUCT_NAME})" 快捷方式`,
      `    (target 已含 debug flag, 一键启动)`,
      `  · 或手动启动 Chrome:`,
      `    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" \\`,
      `      --remote-debugging-port=${port}`,
      ``,
      `启动后 ${PRODUCT_NAME} 会自动连接 (顶栏变绿).`,
    ].join('\n'),
    debugHint: error?.message,
  };
}
