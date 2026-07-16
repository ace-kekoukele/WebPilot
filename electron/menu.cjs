// electron/menu.cjs — 原生应用菜单 (CJS)
// 菜单项点击 → 统一 send('menu:command', 'openXxx') 给 renderer
const { Menu, app, shell } = require('electron');

function sendCommand(win, cmd) {
  if (win) win.webContents.send('menu:command', cmd);
}

function buildAppMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }] : []),
    {
      label: '文件',
      submenu: [
        isMac ? { role: 'close' } : { role: 'quit', label: '退出' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'forceReload', label: '强制重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
      ],
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'zoom', label: '最大化' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front', label: '全部置顶' },
        ] : [
          { role: 'close', label: '关闭' },
        ]),
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '快捷键速查',
          accelerator: 'F1',
          click: (_m, win) => sendCommand(win, 'openHelp'),
        },
        {
          label: '命令面板',
          accelerator: 'CmdOrCtrl+K',
          click: (_m, win) => sendCommand(win, 'openPalette'),
        },
        {
          label: '设置',
          accelerator: 'CmdOrCtrl+,',
          click: (_m, win) => sendCommand(win, 'openSettings'),
        },
        {
          label: '修复',
          click: (_m, win) => sendCommand(win, 'openRepair'),
        },
        { type: 'separator' },
        {
          label: 'GitHub 主页',
          click: () => shell.openExternal('https://github.com/webpilot/webpilot'),
        },
        {
          label: '问题反馈',
          click: () => shell.openExternal('https://github.com/webpilot/webpilot/issues'),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

module.exports = { buildAppMenu };
