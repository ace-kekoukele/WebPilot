// electron/main.js — WebPilot 桌面应用主进程
// 职责:
//   1. 单实例锁 (第二次双击 .exe 唤起已有窗口)
//   2. 拉起 daemon 子进程 (node daemon/main.js)
//   3. 创建 BrowserWindow 加载 electron/renderer/dist/index.html
//   4. 注册托盘 + 系统菜单
//   5. 关窗口 ≠ 退出 daemon (用户可关窗,daemon 持续后台)
//   6. 托盘"退出"才杀子进程 + 退出应用
//
// 用法: electron electron/main.js (开发) 或 electron-builder 打包后 WebPilot.exe (生产)
import { app, BrowserWindow, shell, Notification } from 'electron';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initTray, destroyTray } from './tray.js';
import { buildAppMenu } from './menu.js';
import { VERSION_STRING } from '../lib/version.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;
const DIST_PATH = isDev
  ? join(__dirname, '..', 'electron', 'renderer', 'dist', 'index.html')
  : join(process.resourcesPath, 'app', 'electron', 'renderer', 'dist', 'index.html');

let mainWindow = null;
let daemonProc = null;
let isQuitting = false;

// 单实例锁
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  // 用户双击 .exe 第二次 → 唤起已有窗口
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
  }
});

// 启动 daemon 子进程
function spawnDaemon() {
  if (daemonProc) return daemonProc;

  const daemonEntry = isDev
    ? join(__dirname, '..', 'daemon', 'main.js')
    : join(process.resourcesPath, 'app', 'daemon', 'main.js');

  if (!existsSync(daemonEntry)) {
    console.error('[electron] daemon 入口不存在:', daemonEntry);
    return null;
  }

  console.log('[electron] 启动 daemon:', daemonEntry);
  daemonProc = spawn(process.execPath, [daemonEntry], {
    cwd: dirname(daemonEntry),
    env: { ...process.env, WEBPILOT_EMBEDDED: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  daemonProc.stdout.on('data', (b) => process.stdout.write(`[daemon] ${b}`));
  daemonProc.stderr.on('data', (b) => process.stderr.write(`[daemon] ${b}`));
  daemonProc.on('exit', (code, signal) => {
    console.log(`[electron] daemon 退出 (code=${code}, signal=${signal})`);
    daemonProc = null;
    if (code !== 0 && code !== null && mainWindow && !isQuitting) {
      new Notification({
        title: 'WebPilot',
        body: `daemon 异常退出 (code=${code})。右键托盘 → 修复`,
      }).show();
    }
  });

  return daemonProc;
}

// 创建主窗口
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#0A0A0B',  // 默认深色背景,避免启动闪白
    title: 'WebPilot',
    show: false,                  // 先不显示,等 ready-to-show 再显示(避免白屏闪烁)
    autoHideMenuBar: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
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

  // 拦截外链:浏览器外链走默认浏览器
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // 关窗口 ≠ 退出 (daemon 仍在)
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
      // 首次隐藏时通知用户
      if (process.platform === 'win32') {
        new Notification({
          title: 'WebPilot',
          body: '窗口已最小化到托盘。daemon 仍在后台运行。',
        }).show();
      }
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  // 加载 renderer
  if (isDev) {
    // 开发模式走 vite dev server (热重载)
    mainWindow.loadURL('http://127.0.0.1:5173/');
  } else {
    mainWindow.loadFile(DIST_PATH);
  }
}

// App 生命周期
app.whenReady().then(() => {
  spawnDaemon();
  buildAppMenu();
  createMainWindow();
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

// macOS / Linux: 关所有窗口 ≠ 退出 (保持 daemon)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Windows/Linux: 保持 daemon 跑,窗口隐藏到托盘
    // 不调用 app.quit()
  }
});

function quit() {
  isQuitting = true;
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

// 导出给测试用
export { spawnDaemon, quit };
console.log(`[electron] WebPilot ${VERSION_STRING} 启动 (${isDev ? 'dev' : 'packaged'})`);