// electron/preload.js — 暴露 window.electronAPI 给 renderer
// 用 contextBridge 安全桥接主进程能力
// Renderer 端可用: window.electronAPI.{quit, openDevTools, getVersion, onUpdateAvailable}
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // 主动调用主进程
  quit: () => ipcRenderer.invoke('app:quit'),
  openDevTools: () => ipcRenderer.invoke('app:openDevTools'),
  getVersion: () => ipcRenderer.invoke('app:getVersion'),

  // 主进程推事件 (renderer 监听)
  onUpdateAvailable: (cb) => {
    ipcRenderer.on('app:updateAvailable', (_e, info) => cb(info));
  },

  // 元信息
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
});