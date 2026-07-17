// electron/tray.cjs — 系统托盘 (CJS)
// 菜单项点击 → 统一 send('menu:command', 'openSettings' | 'openRepair' | ...) 给 renderer
const { Tray, Menu, nativeImage, app } = require('electron');
const { join } = require('node:path');
const { existsSync } = require('node:fs');

let tray = null;

function trayIconPath() {
  // extraResources 把 build/ 复制到 resources/build/ (packaged) 或 build/ (dev)
  const isDev = !app.isPackaged;
  const devPath = join(__dirname, '..', 'build', 'icon-16.png');
  if (isDev) return devPath;
  return join(process.resourcesPath, 'build', 'icon-16.png');
}

function sendCommand(win, cmd) {
  if (!win) return;
  win.webContents.send('menu:command', cmd);
  if (!win.isVisible()) win.show();
}

function initTray({ onOpenWindow, onQuit, getWindow }) {
  const iconPath = trayIconPath();
  if (!existsSync(iconPath)) {
    console.warn('[tray] 图标不存在:', iconPath, '— 托盘不初始化');
    return null;
  }

  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);
  tray.setToolTip('WebPilot — 让 AI 助手操作你的浏览器');

  rebuildMenu({ onOpenWindow, onQuit, getWindow });

  tray.on('click', () => {
    const win = getWindow?.();
    if (!win) return onOpenWindow?.();
    if (win.isVisible() && !win.isMinimized()) win.hide();
    else {
      win.show();
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  if (getWindow) {
    setInterval(() => {
      const win = getWindow();
      if (!tray || !win) return;
      const visible = win && win.isVisible() && !win.isMinimized();
      // 尝试从 renderer 获取健康状态来显示更丰富的 tooltip
      if (visible && !win.isDestroyed()) {
        win.webContents.executeJavaScript('JSON.stringify(window.__webpilotHealth || null)').then((json) => {
          if (!json || !tray) return;
          try {
            const h = JSON.parse(json);
            const cdp = h.cdpConnected ? 'Chrome✓' : 'Chrome✗';
            const agents = (h.agentCount || 0) > 0 ? `${h.agentCount} Agent` : '';
            const parts = [cdp, agents].filter(Boolean);
            const status = parts.length > 0 ? parts.join(' · ') : '运行中';
            tray.setToolTip(`WebPilot — ${status}`);
          } catch { tray.setToolTip(`WebPilot — ${visible ? '运行中' : '已最小化到托盘'}`); }
        }).catch(() => {
          tray.setToolTip(`WebPilot — ${visible ? '运行中' : '已最小化到托盘'}`);
        });
      } else {
        tray.setToolTip('WebPilot — 后台运行中 (Ctrl+Shift+Space 呼出)');
      }
    }, 3000);
  }

  return tray;
}

function rebuildMenu({ onOpenWindow, onQuit, getWindow }) {
  if (!tray) return;
  const win = getWindow?.();
  const visible = win && win.isVisible() && !win.isMinimized();

  const menu = Menu.buildFromTemplate([
    {
      label: visible ? '隐藏窗口' : '打开 WebPilot',
      click: () => {
        const w = getWindow?.();
        if (!w) return onOpenWindow?.();
        if (visible) w.hide();
        else onOpenWindow?.();
      },
    },
    { type: 'separator' },
    {
      label: '设置',
      click: () => sendCommand(getWindow?.(), 'openSettings'),
    },
    {
      label: '修复',
      click: () => sendCommand(getWindow?.(), 'openRepair'),
    },
    {
      label: '帮助',
      click: () => sendCommand(getWindow?.(), 'openHelp'),
    },
    {
      label: '命令面板',
      click: () => sendCommand(getWindow?.(), 'openPalette'),
    },
    { type: 'separator' },
    {
      label: '关于 WebPilot',
      click: () => {
        const { dialog } = require('electron');
        dialog.showMessageBox({
          type: 'info',
          title: '关于 WebPilot',
          message: 'WebPilot',
          detail: '让 AI 助手操作你的浏览器\nv4.0.4 · 大而全版本',
          buttons: ['好'],
        });
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => onQuit?.(),
    },
  ]);
  tray.setContextMenu(menu);
}

function destroyTray() {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

module.exports = { initTray, destroyTray };
