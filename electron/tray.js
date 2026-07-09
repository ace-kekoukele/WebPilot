// electron/tray.js — 系统托盘
// 右键菜单: 打开 / 修复 / 设置 / 关于 / 退出
// 单击托盘: 显示/隐藏窗口
import { Tray, Menu, nativeImage, app } from 'electron';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

let tray = null;

function trayIconPath() {
  // electron-builder 打包后: process.resourcesPath/build/icon-16.png
  // 开发模式: <project>/build/icon-16.png
  const devPath = join(__dirname, '..', 'build', 'icon-16.png');
  if (existsSync(devPath)) return devPath;
  return join(process.resourcesPath, 'build', 'icon-16.png');
}

export function initTray({ onOpenWindow, onQuit, getWindow }) {
  const iconPath = trayIconPath();
  if (!existsSync(iconPath)) {
    console.warn('[tray] 图标不存在:', iconPath, '— 托盘不初始化');
    return null;
  }

  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);
  tray.setToolTip('WebPilot — 让 AI 助手操作你的浏览器');

  rebuildMenu({ onOpenWindow, onQuit, getWindow });

  // 单击切换窗口可见性 (Windows)
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

  // 右键菜单重建 (窗口可见性变化时)
  if (getWindow) {
    setInterval(() => {
      const win = getWindow();
      if (!tray) return;
      const visible = win && win.isVisible() && !win.isMinimized();
      tray.setToolTip(`WebPilot — ${visible ? '运行中' : '已最小化到托盘'}`);
    }, 2000);
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
      click: () => {
        const w = getWindow?.();
        if (w) {
          w.webContents.send('app:openSettings');
          if (!w.isVisible()) w.show();
        }
      },
    },
    {
      label: '修复',
      click: () => {
        const w = getWindow?.();
        if (w) {
          w.webContents.send('app:openRepair');
          if (!w.isVisible()) w.show();
        }
      },
    },
    { type: 'separator' },
    {
      label: '关于 WebPilot',
      click: async () => {
        const { dialog } = await import('electron');
        dialog.showMessageBox({
          type: 'info',
          title: '关于 WebPilot',
          message: 'WebPilot',
          detail: '让 AI 助手操作你的浏览器\nv4.0.3 · Mac 级工业设计 · shadcn/ui',
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

export function destroyTray() {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}