// electron/preload.cjs — preload 脚本 (CJS)
// 暴露给 renderer:
//   - 5 个 invoke (走 ipcMain.handle):openSettings / openRepair / openHelp / openPalette / getInfo
//   - 1 个 on():监听 tray + menu 的事件 (renderer 收到后弹对应 overlay)
//   - 系统信息 (platform / versions)
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 主进程主动调用 (tray/menu 点击 → 主进程 webContents.send → renderer 监听)
  onMenuCommand: (cb) => {
    const handler = (_e, cmd) => cb(cmd);
    ipcRenderer.on('menu:command', handler);
    return () => ipcRenderer.removeListener('menu:command', handler);
  },

  // renderer 主动 invoke (目前没用,留扩展)
  quit: () => ipcRenderer.invoke('app:quit'),
  getInfo: () => ipcRenderer.invoke('app:getInfo'),

  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
});
