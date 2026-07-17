// electron/main.cjs — WebPilot 桌面应用主进程 (CJS, Electron 主进程默认支持)
// 职责:
//   1. 单实例锁 (第二次双击 .exe 唤起已有窗口)
//   2. 拉起 daemon 子进程 (node daemon/main.js) — daemon 必须从 asar 解包,否则 spawn 跑不了
//   3. 创建 BrowserWindow 加载 electron/renderer/dist/index.html (走 extraResources)
//   4. 注册托盘 + 系统菜单
//   5. 关窗口 ≠ 退出 daemon
//   6. 托盘"退出"才杀子进程 + 退出应用
const { app, BrowserWindow, shell, Notification, ipcMain, globalShortcut } = require('electron');
const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const { join, dirname } = require('node:path');

// 必须在 app.whenReady() 之前调用
// Windows 双击 .exe 时 GPU 进程会反复崩溃 (exit_code=-1073741790 = 0xC0000005 ACCESS_VIOLATION),
// 通常是 GPU 驱动 / 远程桌面 / VM / 沙箱环境下 Chromium GPU 加速不兼容
// 禁用硬件加速 + 禁用 GPU 进程 — 牺牲一点渲染性能,换取兼容性
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('no-sandbox');

let mainWindow = null;
let daemonProc = null;
let isQuitting = false;
let daemonRestartCount = 0;
const DAEMON_MAX_RESTART = 3;
const DAEMON_RESTART_DELAY_MS = 3000;
let daemonRestartTimer = null;

// 路径解析 (CJS 下 __dirname 直接是 electron/ 目录)
// - 开发模式: __dirname = <repo>/electron/, dist 在 ../electron/renderer/dist/
// - 打包模式: app.getAppPath() = <install>/resources/app.asar, dist 在 extraResources 即 <install>/resources/electron/renderer/dist/
//             daemon 在 app.asar 内 — 需要 asarUnpack 或从 unpacked 路径读
const isDev = !app.isPackaged;
const RES = process.resourcesPath;  // <install>/resources
const APP = app.getAppPath();        // <install>/resources/app.asar (CJS .asar 内可读)

const DIST_PATH = isDev
  ? join(__dirname, 'renderer', 'dist', 'index.html')
  : join(RES, 'electron', 'renderer', 'dist', 'index.html');

const DAEMON_ENTRY = isDev
  ? join(__dirname, '..', 'daemon', 'main.js')
  : join(RES, 'app.asar.unpacked', 'daemon', 'main.js');  // asarUnpack 后路径

console.log(`[electron] 启动模式: ${isDev ? 'dev' : 'packaged'}`);
console.log(`[electron] DIST_PATH = ${DIST_PATH}`);
console.log(`[electron] DAEMON_ENTRY = ${DAEMON_ENTRY}`);

// 单实例锁
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  console.log('[electron] 已有实例在跑,退出本进程');
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
  }
});

function spawnDaemon() {
  if (daemonProc) return daemonProc;
  if (!existsSync(DAEMON_ENTRY)) {
    console.error('[electron] daemon 入口不存在:', DAEMON_ENTRY);
    return null;
  }

  console.log(`[electron] 启动 daemon: ${DAEMON_ENTRY} (重启计数 ${daemonRestartCount})`);
  // Electron 32 在 Windows 下 process.execPath 是 WebPilot.exe,它是 Electron 而非 Node。
  // 必须用 ELECTRON_RUN_AS_NODE=1 把它当 Node 用,才能跑 daemon 脚本。
  daemonProc = spawn(process.execPath, [DAEMON_ENTRY], {
    cwd: dirname(DAEMON_ENTRY),
    env: { ...process.env, WEBPILOT_EMBEDDED: '1', ELECTRON_RUN_AS_NODE: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  // daemon 成功 spawn — 重置重启计数 (上面 on('exit') 会处理退出)
  // 注意: 只有当进程真的 spawn 成功, exit 才会触发; error 兜底路径另算
  setImmediate(() => {
    if (daemonProc && daemonProc.pid) {
      daemonRestartCount = 0;
    }
  });

  daemonProc.stdout.on('data', (b) => {
    const line = b.toString();
    // B2-21: 拦截 [NOTIFY] 行 → 弹 Electron Notification
    const notifyMatch = line.match(/^\[NOTIFY\](.+)/);
    if (notifyMatch) {
      try {
        const { title, body } = JSON.parse(notifyMatch[1]);
        new Notification({ title, body }).show();
      } catch {}
    }
    process.stdout.write(`[daemon] ${line}`);
  });
  daemonProc.stderr.on('data', (b) => process.stderr.write(`[daemon] ${b}`));

  // spawn 失败兜底 (ENOENT 等)
  daemonProc.on('error', (err) => {
    console.error(`[electron] daemon spawn error: ${err.message}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      new Notification({
        title: 'WebPilot',
        body: `daemon 启动失败 (${err.message})。右键托盘 → 修复`,
      }).show();
    }
  });

  daemonProc.on('exit', (code, signal) => {
    console.log(`[electron] daemon 退出 (code=${code}, signal=${signal})`);
    daemonProc = null;

    if (isQuitting) return;  // 用户主动退出, 不重启

    if (code !== 0 && code !== null) {
      // 异常退出 — 尝试自动重启
      if (daemonRestartCount < DAEMON_MAX_RESTART) {
        daemonRestartCount++;
        const next = DAEMON_RESTART_DELAY_MS;
        new Notification({
          title: 'WebPilot',
          body: `daemon 异常退出 (code=${code})。${next / 1000} 秒后自动重启 (${daemonRestartCount}/${DAEMON_MAX_RESTART})`,
        }).show();
        if (daemonRestartTimer) clearTimeout(daemonRestartTimer);
        daemonRestartTimer = setTimeout(() => {
          daemonRestartTimer = null;
          if (!isQuitting) {
            console.log(`[electron] 自动重启 daemon (${daemonRestartCount}/${DAEMON_MAX_RESTART})`);
            spawnDaemon();
          }
        }, next);
      } else {
        new Notification({
          title: 'WebPilot',
          body: `daemon 反复退出, 已停止自动重启。右键托盘 → 修复`,
        }).show();
      }
    } else {
      // 正常退出 (code 0 / signal) — 重置计数
      daemonRestartCount = 0;
    }
  });

  return daemonProc;
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#0A0A0B',
    title: 'WebPilot',
    show: false,
    autoHideMenuBar: false,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
      if (process.platform === 'win32') {
        new Notification({
          title: 'WebPilot',
          body: '窗口已最小化到托盘。daemon 仍在后台运行。',
        }).show();
      }
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  // 开发模式下也直接加载已构建的 dist/index.html，避免 Vite dev server 连接失败导致黑屏
  console.log('[electron] loadFile:', DIST_PATH);
  mainWindow.loadFile(DIST_PATH);
}

app.whenReady().then(() => {
  // B2-22: 注册全局快捷键 Ctrl+Shift+Space → 呼出/隐藏窗口
  const registered = globalShortcut.register('CommandOrControl+Shift+Space', () => {
    const win = mainWindow;
    if (!win) return;
    if (win.isVisible() && !win.isMinimized()) win.hide();
    else { win.show(); if (win.isMinimized()) win.restore(); win.focus(); }
  });
  if (!registered) console.warn('[electron] Ctrl+Shift+Space 全局快捷键注册失败');

  spawnDaemon();
  const { buildAppMenu } = require('./menu.cjs');
  buildAppMenu();
  createMainWindow();
  const { initTray } = require('./tray.cjs');
  initTray({
    onOpenWindow: () => {
      if (mainWindow) {
        if (!mainWindow.isVisible()) mainWindow.show();
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      } else {
        createMainWindow();
      }
    },
    onQuit: () => {
      isQuitting = true;
      quit();
    },
    getWindow: () => mainWindow,
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // 保持 daemon 跑,窗口隐藏到托盘
  }
});

function quit() {
  isQuitting = true;
  globalShortcut.unregisterAll();
  const { destroyTray } = require('./tray.cjs');
  destroyTray();
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy();
  if (daemonProc) {
    try { daemonProc.kill(); } catch {}
  }
  app.quit();
}

app.on('before-quit', () => {
  isQuitting = true;
  if (daemonProc) {
    try { daemonProc.kill(); } catch {}
  }
});

// ──── IPC handlers (preload 调用) ─────────────────────────────────
// renderer 通过 window.electronAPI.quit() / .getInfo() invoke 进来
ipcMain.handle('app:quit', () => {
  isQuitting = true;
  quit();
  return { ok: true };
});

ipcMain.handle('app:getInfo', () => ({
  version: app.getVersion(),
  platform: process.platform,
  electron: process.versions.electron,
  chrome: process.versions.chrome,
  node: process.versions.node,
  pid: process.pid,
  daemonPid: daemonProc?.pid ?? null,
}));

module.exports = { spawnDaemon, quit };