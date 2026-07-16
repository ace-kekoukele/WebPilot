# 常见问题 (FAQ)

> 15 个最高频问题。问题找不到答案?看 [./ARCHITECTURE.md](./ARCHITECTURE.md) 或 [../HANDOFF.md](../HANDOFF.md)。

---

## 1. 双击 .exe 后窗口打不开 / 闪退

**大概率是 GPU 兼容问题**。在桌面 `WebPilot` 快捷方式上右键 → 属性 → 在"目标"末尾加 `--disable-gpu` 后保存。

例:`"C:\Users\...\WebPilot.exe" --disable-gpu`

如果还不行,看 `%LOCALAPPDATA%\WebPilot\logs\webpilot-YYYY-MM-DD.log` 里的报错。

---

## 2. 端口被占用 (9222 / 9223 / 9224 / 9225)

WebPilot 启动时会**自动 +1 迁移**,GUI 顶部会弹 toast 提示「端口已自动迁移」,点「改回默认」能跳到设置。

如果所有相关端口都被占(连续 10 个都撞),WebPilot 会启动失败。检查:
- 旧 WebPilot 进程没退干净 → 任务管理器杀 `node.exe`
- Chrome 已经在用某个端口 → 改 Chrome `--remote-debugging-port`

---

## 3. Chrome 没启 / 找不到 Chrome

启动 WebPilot 后,Chrome 必须**手动开启**(WebPilot 故意不自动启 Chrome,因为要复用你已登录的浏览器)。

如果系统没装 Chrome:WebPilot 会弹「Chrome 未检测到」提示,给到 Chrome 下载链接。装了之后重启 WebPilot 即可。

Chrome 启动时必须带 `--remote-debugging-port=9222`,桌面快捷方式「Chrome (WebPilot)」已自动加好。

---

## 4. AI 助手连不上 WebPilot

检查顺序:
1. WebPilot 窗口右下角托盘图标在不在(没退)
2. AI 助手的 MCP 配置 JSON 里 URL 是不是 `http://127.0.0.1:9223/mcp`(`9223` 是 MCP 端口,`9224` 是 HTTP,**不一样**)
3. WebPilot 启动日志里 `mcp-started` 一行有没有报"port: 9223"

Claude Desktop 配置示例:
```json
{
  "mcpServers": {
    "webpilot": {
      "url": "http://127.0.0.1:9223/mcp"
    }
  }
}
```

---

## 5. 「daemon 没起 — 右键托盘 → 修复」错误

daemon 子进程挂了。自动重启逻辑会尝试 3 次拉起(每次间隔 3 秒),3 次都失败就需要手动修复:

1. 托盘图标右键 → 「修复」
2. 修复会跑 4 阶段自检(health / chrome / ports / tools),告诉你哪一步挂了
3. 常见原因:Chrome 没启 / 端口被占 / 配置文件损坏

---

## 6. 监控面板 Console 一直是空的

1. Chrome 启了吗?
2. Chrome 是否在 `--remote-debugging-port=9222` 模式?(任务管理器看 chrome.exe 命令行)
3. WebPilot 是否 attach 成功?托盘「状态」应该显示「已连接」
4. Console tab 上方应该有绿色「LIVE」脉冲点,没有说明 SSE 断了 → 重启 WebPilot

---

## 7. 浏览器面板截图按钮没反应

1. Chrome 必须连上(托盘状态显示「已连接」)
2. 当前选中的 tab 必须是 WebPilot 自己开的(看 tab 标题栏有没有 ✕ 关闭按钮)
3. 截图后会弹 toast,点击查看 → 在新 tab 打开

---

## 8. 录制器录下来是空的 / 报错

录制器接 Chrome DevTools `Page.startScreencast` + `Input.dispatchKeyEvent` / `dispatchMouseEvent`,所以:

1. 当前 tab 必须是 WebPilot 自己开的
2. 录制中请**不要切换 tab**(只录当前 tab 的事件)
3. 录制文件存到 `%LOCALAPPDATA%\WebPilot\recordings\`

---

## 9. 工作流编辑器加载失败

如果你之前用的是旧版 (v3 / v4.0.1 之前) 保存的 `.wf.json` 工作流文件,新版编辑器不兼容。

解决方法:用「工作流 → 导入」菜单,从 JSON 重建。模板 (v4.0.4+ 保存的格式) 都能加载。

---

## 10. 主题跟系统不匹配

v4.0.4 加了「system」模式。在设置 (Ctrl+,) → 主题 → 选「跟随系统」,WebPilot 会监听 Windows 深浅色变化自动切。

如果切得不及时,重启 WebPilot。

---

## 11. 聊天历史不持久化 / 刷新归零

检查 `localStorage.webpilot-chat-history` 是不是被清掉了:
- 浏览器隐身模式 → 不持久化(本项目用 Web Storage,隐身模式会清)
- 用了「清除浏览数据」勾了 Web Storage → 历史会被清
- WebPilot 重装且没勾「保留配置」 → 历史会清

正常的 WebPilot 窗口刷新 / 关闭 → 重开,历史都还在,上次会话自动恢复。

---

## 12. 高级设置里改了没生效

- **日志级别** → 立刻生效,但只影响后续输出
- **CDP 超时** → 下次工具调用生效
- **端口范围** → **必须重启** WebPilot 才生效
- **AI 厂商切换** → 必须刷新当前 session(发新一条消息)

---

## 13. 系统通知不弹

Windows 10/11 默认允许 WebPilot 通知。如果不弹:
1. 设置 → 系统 → 通知 → 找到 WebPilot → 打开
2. 托盘 WebPilot 图标右键 → 「通知设置」
3. 不要开启「专注助手」(会把通知静音)

---

## 14. 卸载不干净

`uninstall.ps1` 会清:
- `%LOCALAPPDATA%\WebPilot\`(配置 + 日志 + 录制文件)
- `%APPDATA%\Microsoft\Windows\Start Menu\Programs\WebPilot\`(开始菜单快捷方式)
- 桌面 `WebPilot` 快捷方式
- 注册表 `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` 里的开自启项

但 **不会**清:
- Chrome 装的 WebPilot 桌面快捷方式(那个指向 Chrome.exe,留着没害)
- 你自己保存的工作流文件 (放 `%USERPROFILE%\Documents\WebPilot Workflows\`)

如果想彻底清,手动删 `%LOCALAPPDATA%\WebPilot\`。

---

## 15. macOS / Linux 何时支持?

目前**只支持 Windows 10/11**。计划 v4.4 之后(预计 2026 年底)评估 macOS 支持(主要坑:Chrome 远程调试在 macOS 上的安全策略差异 + 系统托盘 API 差异)。

Linux 不在路线图上 — WebPilot 用 nsis 打包、PowerShell 安装脚本,跨 Linux 桌面环境(gnome / kde / xfce)维护成本太高。

---

## 找不到答案?

提 issue 时附:
- WebPilot 版本(主屏右上角「关于」)
- Chrome 版本(`chrome://version`)
- Node 版本(开发模式下 `node --version`)
- 完整报错信息 + `%LOCALAPPDATA%\WebPilot\logs\` 最新日志
