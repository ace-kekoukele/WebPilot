# WebPilot v4.0 — 发布说明

> **2026-07-09 v4.0.4 — 大而全:** 42 项更新，5 个 P0 bug 修复。
> **2026-07-09 文档整理:** 13 个过时文档(描述 v1.7.0 的 45 工具时代)已删除,新增 `HANDOFF.md` + `docs/ARCHITECTURE.md` + `docs/CODE_STATUS.md`,重写 `CONTRIBUTING.md`。
>
> **2026-07-09 视觉重做:** v4.0.3 完成 GUI Mac 级工业设计重做 + Electron 桌面端。

## v4.0.4 (2026-07-09) — 大而全，42 项更新

### 批次 1 — P0 必做 (13 项)
- **ErrorBoundary:** `main.tsx` 包裹，React 报错不白屏
- **API 失败统一 toast:** `lib/api.ts` 全局 `.catch()` + `onToast()`
- **修复按钮真跑:** `repair-dialog.tsx` + `daemon/repair.js` 接通真 CDP 清理
- **daemon 自动重启:** `electron/main.cjs` 监听 daemon 退出 + 3 次重试 + 通知
- **package.json scripts 补全:** `start`、`dev`、`build`、`test`、`dist`、`dist:dir`、`preview`、`check` 全实现
- **4 个 `alert()` 干掉:** `BrowserPanel.tsx` / `AutomationPanel.tsx` / `SettingsOverlay.tsx` / `ChatPanel.tsx` 全换 toast
- **Ctrl+K 真调 20 高频工具:** `command-palette.tsx` + `lib/tool-schemas.ts` 动态表单 → 真 POST `/api/tools/call`
- **浏览器 +3 按钮:** 截图 `browser_screenshot.js` / DOM 树 `browser_dom_snapshot.js` / 选中元素高亮 → BrowserPanel 工具栏
- **监控 Console tab 真接:** `MonitorPanel.tsx` + `daemon/console-stream.js` → `Runtime.consoleAPICalled` SSE 实时流
- **自动模式 5 模板可点:** `AutomationPanel.tsx` → 跳 ChatPanel + prompt 预填
- **What's New 首次引导:** `App.tsx` + `whats-new.tsx` → `localStorage.webpilot-seen-whats-new` 控制首次弹窗
- **CONTRIBUTING + FAQ + ADDING_TOOLS 文档:** 3 个新文件，15 条 FAQ
- **IPC 通道接好:** `electron/main.cjs` 5 个 handler + `electron/preload.cjs` 5 个 method 全实现

### 批次 2 — P1 应该做 (14 项)
- **切 AI 厂商真同步后台:** Settings → LLM API 改动即时 `apiPost('/api/llm/active')` 同步 daemon
- **HelpOverlay 4 tab 全活:** 快捷键 / 使用技巧 / 工具列表 / 关于 → 全部真内容
- **录制器接 CDP 真录:** `lib/recorder.js` → `Page.startRecording` → `Overlay.types` / `Input.dispatchMouseEvent` 回放
- **Network 详情 + 重放 + 拦截:** `daemon/network-store.js` → MonitorPanel 详情 drawer + 重放 + 请求拦截
- **聊天历史持久化 + 上次会话恢复:** ChatPanel → `localStorage` 存 `sessions[]` + 启动时恢复
- **高级设置真生效:** 日志级别 / CDP 超时 / 端口范围 → `apiPost('/api/settings/advanced')` → daemon 重启生效
- **主题加 system 模式:** `theme-provider.tsx` → `useSystemColorScheme` + Settings UI light/dark/system 三选
- **系统通知覆盖 Chrome 断 / 工具错误:** `electron/main.cjs` → `Notification` API 覆盖 3 种场景
- **全局快捷键 Ctrl+Shift+Space:** `electron/main.cjs` → `globalShortcut.register` 任意界面呼出
- **顶栏日志按钮 + 日志面板:** TopBar 加日志图标 + LogPanel → `GET /api/logs` 实时流
- **安装时 Chrome 检测:** `install.ps1` → `Get-ItemProperty` 查 registry，没 Chrome 报错退出
- **README 下载链接修复 + 卸载脚本:** `CONTRIBUTING.md` 直链 `WebPilot Setup 4.0.3.exe` → `4.0.4.exe`
- **开自启首启勾选:** `electron/main.cjs` 首启 → `app.setLoginItemSettings` 弹窗让用户勾
- **macOS/Linux 显式标注:** Settings 更新说明 + README → v4.4 才支持

### 批次 3 — P2 锦上添花 (6 项)
- **Cookie 管理面板:** MonitorPanel 加 Cookie tab → `Page.getCookies` / `Page.deleteCookies`
- **ChatPanel @ 工具补全 popover:** 消息输入 `@` 触发 `Command` popover 选工具
- **配置导出 / 导入 .json:** Settings 每个类目 → 右上角"导出配置" / "导入配置"
- **性能监控 tab:** MonitorPanel Performance tab → `Performance.getMetrics` + `performance.memory` + `performance.measureUserAgentSpecificMemory()`

### P0 Bug 修复
- **端口交叉验证:** `lib/http-api.js:handleSetPorts` → `new Set(ports).size === 4` 防 4 端口设成同值崩溃 daemon
- **API Key 加密存储:** `daemon/llm-client.js` → AES-256-GCM 加密，`__wp_enc:` 前缀，向后兼容旧明文
- **Wizard 版本号:** `Wizard.tsx:23` → `v4.0.4`
- **LLM 文案修复:** `settings-overlay.tsx` → "LLM 改动即时生效"

### 验证
- `npm test` → 4/4 (vitest smoke tests)
- `npm run build` → 3.93s, JS ~170KB gzipped, CSS ~10KB
- `npm run dist` → `WebPilot Setup 4.0.4.exe` (93MB)
- SHA256: `8052F0C48E4316366EB36414F82F00BF5DBB66AEA2FC9CC6F44D1118B2D2DF92`

---

## v4.0.3 (2026-07-09) — Mac 级工业设计 + 桌面应用

### GUI 重做(对照 Linear / Raycast / Things 3 / Arc)
- **技术栈换装:** Tailwind v4(CSS-first `@theme`)+ shadcn/ui(new-york style)+ framer-motion + lucide-react + Sonner + react-markdown
- **字体自托管:** Inter Variable + 思源黑体 woff2(`font-display: swap`,CSP `font-src 'self' data:`)
- **布局壳:** TopBar 44px backdrop-blur + Sidebar 52px `layoutId="sidebar-pill"` 活动指示器 + BottomDrawer 220ms spring
- **模式切换动画:** `AnimatePresence mode="wait"` + `motion.div` 180ms 淡入淡出 + y 8px 滑动
- **Panel empty/loading 系统:** `<EmptyState>` Lucide 图标 + 标题 + 描述 + CTA / shadcn `<Skeleton>` shimmer
- **弹层系统:** CommandPalette / HelpOverlay / SettingsOverlay / RepairDialog / WhatsNewOverlay 全走 shadcn Dialog(180ms scale-fade)
- **ChatPanel 旗舰升级:** markdown(`react-markdown` + remark-gfm + rehype-sanitize,lazy 加载) + 流式光标(`motion.span` 800ms loop) + tool-call card(可折叠 args/result) + typing indicator(3 点脉冲)
- **Sonner 替换手写 pub/sub:** `pushToast()` API 保留兼容,后台走 Sonner
- **A11y:** `MotionConfig reducedMotion="user"` 顶层 + 所有 icon-only 按钮补 `aria-label` + Radix Dialog 焦点 trap

### 桌面端(Electron)
- 主进程 `electron/main.js`:拉起 daemon 子进程 + 创建 BrowserWindow 加载 `dist/index.html` + 单实例锁
- 预加载 `electron/preload.js`:`window.electronAPI` 暴露 quit / openDevTools / getVersion
- 系统托盘 `electron/tray.js`:右键菜单(打开 / 修复 / 设置 / 退出)+ 单击切换窗口可见
- 系统菜单 `electron/menu.js`:文件 / 编辑 / 视图 / 窗口 / 帮助
- electron-builder.json:NSIS 用户级安装 + 桌面 / 开始菜单快捷方式 + `.wp-workflow` 文件关联
- 应用图标:3 色重做(左圆点绿 `#10B981` = 用户浏览器 / 右圆点紫 `#8B5CF6` = AI 助手 / 拱弧紫 `#6366F1` = 桥 = `--primary`)

### 后端杂项
- 版本号同步:`lib/version.js` + `package.json` + README banner 全 4.0.3
- 描述字段更新:"桌面 GUI (Mac 级工业设计 · shadcn/ui · Inter/Noto Sans SC · framer-motion)"
- 新增 npm scripts:`test:renderer` (vitest run),`test` 跑 Node test + vitest,`dist` (electron-builder --win),`dist:dir`
- 新增 devDeps:electron-builder, sharp

### 验证
- `npm run build` → gzipped JS ~165KB(< 250KB 预算),CSS ~15KB(< 50KB)
- `npm test` → 197 个 Node test + vitest smoke 全过
- `npm run dist:dir` → `dist/win-unpacked/WebPilot.exe` 双击独立运行
- 5 个核心 panel before/after 100% 功能一致

---

## v4.0.2 (2026-07-09) — 代码整合 + 文档沉淀

### 后端清理
- 删 `lib/cdp-manager.js` v2 兼容层(19 行 facade)
- 批量迁移 68 个 `tools/*.js` 的 import 路径到 `lib/cdp/index.js`
- 迁 `lib/tool-loader.js` / `lib/http-api.js` / `scripts/start-mcp-server.mjs` 到新路径
- 改 3 个测试 import + 重命名 2 个测试文件(`cdp-manager.test.js` → `cdp-index.test.js` 等)

### 入口 / 脚本清理
- 删根 `index.js` (18 行 v2 兼容入口,无内部引用)
- 删 `install.bat` (63 行 v1.7 时代,CHANGELOG 已声明不支持)
- 删 4 个 dead npm script: `mcp` / `preview` / `electron` / `electron:dev`
- 改 `check` script 覆盖 daemon/main.js + lib/*.js + lib/cdp/*.js + tools/*.js
- 删 10 个 `scripts/` 调试脚本(v1.7-v2 时代:`start.bat`/`start.ps1`/`check-init.mjs`/`quick-test.mjs`/`verify-p0-fix.mjs`/`ws-test.mjs`/`trace-debug.mjs`/`list-cdp-domains.mjs`/`test-rebuild.mjs`/`test-http-api.ps1`)

### GUI 整合
- 删整个 `daemon/static/` vanilla fallback (~2000 行:`index.html` + `app.js` + `styles.css`)
- 改 `daemon/static-server.js` 只走 `electron/renderer/dist/`(删多目录查找循环)
- 改 `install.ps1` Step 3.5:`npm run build` 失败时改 return error(之前降级到 vanilla fallback)

### 死代码
- 删 `daemon/static/workflow-canvas.js` (349 行,从未运行时引用)
- 删 `test/unit/workflow-canvas-syntax.test.js`(测的是被删的文件)
- 删重复 `daemon/static/favicon.svg`(与 `electron/renderer/dist/favicon.svg` 完全相同)

### 文档沉淀
- 同步版本号 4.0.0 → 4.0.2(`lib/version.js` + `package.json` + README badge + banner)
- 修 README 测试数 179/179 → 199/199
- 修 `HANDOFF.md`:工具数 / 测试数 / "42 个老 tools" → "68 个" / "已知问题"小节重写
- 修 `docs/CODE_STATUS.md`:"42 个老 tools" → "68 个" / "17+ 测试文件" → "21 个" / "已知 bug"小节更新
- 删 `lib/version.js` 注释提到的 `scripts/sync-version.mjs`(本不存在)
- 删 CHANGELOG 文档树中的 `docs/API.md` 引用(已删 2026-07-09)

### 验证
- `node --check daemon/main.js lib/*.js lib/cdp/*.js tools/*.js` 全 OK
- `node --test test/unit/*.test.js` → **197 个 case 全过**(workflow-canvas 2 个 case 删后净减 2)
- `npm run check` 全 OK
- 整个仓库 `grep cdp-manager --include="*.js" --include="*.mjs" --include="*.cjs"` → 只剩 3 行注释(已无功能引用)

---

## v4.0.1 (2026-07-06) — 端口管理(给用户看见实际端口)

**用户原话:** "监控端口需要有一个提醒,让用户自己去配置一下,或者可以打开一个页面,总之要做到开箱即用。因为不是每一部电脑的监控端口都是 9224"

### 后端(daemon + http-api)
- `daemon/main.js`:加 `portEvents` (EventEmitter) 给 GUI 订阅;端口协商后,如有迁移 emit `port-changed` 事件 + 警告日志
- `lib/http-api.js`:
  - `handleHealth` 加 `ports` 字段(实际占用的端口)
  - 新增 `GET /api/ports`:返回 current + defaults + hint
  - 新增 `POST /api/ports`:改端口(1024-65535 校验),提示需要重启

### GUI(React 18)
- `TopBar.tsx`:显示实际端口(Chrome 未连接时:`'Chrome 未连接 (:9222)'`);加 🔌 按钮(title hover 显示所有端口,点击开 Settings → Connection);端口变化响应式(每 5s 轮询 `/api/health`)
- `App.tsx`:启动时检查 ports,如果有迁移,弹 warn toast(12s):'端口已自动迁移: cdp: 9222→9228, ...' + [改回默认] 按钮 → 开 Settings;5s 轮询 `/api/health` 持续监测端口

### `install.ps1`(开箱即用)
- 加 Step 1.5 端口扫描(PowerShell TcpClient 异步探测 9222-9225)
- 默认端口被占 → 黄色警告:'别担心, daemon 启动时会自动迁移; 装完打开 WebPilot → 🔌 → 设置 → 🔗 连接'
- 全部空闲 → 绿色 [OK]

### 测试(+4 cases)
- `test/unit/ports-endpoint.test.js`(4 cases):
  - `DEFAULT_PORTS` 6 个端口正确
  - `isPortFree` 返回 boolean
  - `negotiatePorts` 返回 6 端口 + migrated 字段
  - `saveConfig` 保留 cdp/mcp 端口字段

### e2e 验证
```bash
# 健康检查含 ports 字段
curl http://127.0.0.1:9224/api/health
# { ok: true, ports: { cdp: 9222, mcp: 9223, http: 9224, control: 9225, sse: 9226, webhook: 9227 } }

# 查询实际端口
curl http://127.0.0.1:9224/api/ports
# { current, defaults, migrated: false, hint }

# 修改端口(需重启)
curl -X POST http://127.0.0.1:9224/api/ports -d '{"cdp":9333}'
# { ok: true, restartRequired: true, newPorts: { cdp: 9333, mcp: 9223, http: 9224, control: 9225 } }
```

### 用户体验(开箱即用)
1. `install.ps1` 装好 → 默认端口被占时立刻警告用户
2. daemon 启动 → 自动迁移 + 警告日志 + emit `port-changed`
3. GUI 顶栏 → 5s 内出现 12s warn toast '端口已自动迁移' + [改回默认] 按钮
4. 用户点 [改回默认] → Settings → Connection 看到实际端口
5. 用户能直接在 Settings 改端口(重启生效)

> ⚠️ **已知小毛病:** v4.0.1 commit 改了端口管理代码 + GUI,但 `lib/version.js` 的 `VERSION` 字段和 `package.json` 的 `version` 字段还是 4.0.0。发 v4.0.1 zip 时没同步,见 `docs/CODE_STATUS.md` §已知问题 #1。

---

## v4.0.0 (2026-07-06) — 首次稳定版

**代号**：「全栈 v4.0 · 桌面 GUI + 真正 LLM 流式 + 网站逆向」

---

### 🎯 一句话总结

> 给用户和朋友用的 Chrome 自动化桥：你的 AI Agent（Claude / Cursor / MiniMax Code / ...）通过 MCP 协议控制你的 Chrome（不是 headless，是你自己已经登录的 Chrome），70+ 工具覆盖页面操控 / 网络 / 调试 / 堆，全中文，Win only，5 分钟跑起来。

---

### ✨ 核心能力（10 项硬承诺）

| # | 能力 | 实现 |
|---|---|---|
| 1 | **用用户已开的 Chrome**（不另起进程） | daemon 只 attach `127.0.0.1:9222` |
| 2 | **不开 headless** debug 浏览器 | 默认 headed 模式 |
| 3 | **用户标签页永久只读** | `isOurTab()` 守卫 + 70 工具 requireOurTab |
| 4 | **用用户登录态** | 不覆盖 `--user-data-dir` |
| 5 | **BB 退出不影响 Chrome** | graceful shutdown 不 kill Chrome |
| 6 | **任意 Agent 自动连** | MCP Streamable HTTP + passive listener |
| 7 | **不自动写** Agent 配置文件 | 默认 Auto 模式，用户显式选才写 |
| 8 | **只支持简体中文** | 全部 UI / 错误 / 菜单都中文 |
| 9 | **Win only**，不签 | 给用户和好友用，下载覆盖装 |
| 10 | **不自动更新** | 手动下载覆盖装 |

---

### 📦 包含

- **70+ 个 MCP 工具**（覆盖 22 个 CDP 域）
- **16 个 LLM 厂商预设**（含 MiniMax 国内+国外、DeepSeek / Kimi / 智谱 / Qwen / Ollama / 自定义）
- **6 个 Agent 自动检测**（Claude Desktop / Claude Code / Cursor / Continue / MiniMax Code / Hermes）
- **23 类故障一键修复**（实际有效 5 个高频项）
- **真 LLM 流式聊天**（OpenAI / Anthropic / Gemini 三家 SSE 解析 + 工具调用闭环）
- **完整网络逆向**（capture / replay / schema 推断 / mock 拦截）
- **前端逆向 3 个新工具**（页面结构 / window 全局 / API 端点推断）
- **工作流画布**（vanilla SVG + 单步调试）
- **桌面 GUI**（React 18 + Vite，177KB / gzip 57KB）
- **195 个单元测试全过**

---

### 🆕 v4.0 相对 v3 的变化

| 类别 | 变化 |
|---|---|
| **名字** | browser-bridge → **WebPilot** |
| **架构** | 单进程 daemon + 静态文件 serve GUI（之前没 GUI） |
| **GUI** | 新增 React 18 + Framer Motion + @xyflow/react（兼容 vanilla fallback） |
| **LLM** | 新增真流式 + 16 个厂商预设 + 一键填充 |
| **网络** | 完整 capture/replay/schema/break 端点 |
| **前端逆向** | 3 个新工具（页面结构 / JS 资产 / API 推断） |
| **画布** | vanilla SVG workflow editor（可换 React Flow） |
| **代理** | 跨平台 proxy/VPN 检测（Windows 优先） |
| **配置** | zod 校验 + 热加载 + 损坏自动备份 |
| **打包** | install.ps1（用户级，无管理员） + NSIS 路径（待 v4.1） |
| **测试** | 156 → 195（+39 个 W1-W13 新增） |
| **代码量** | ~3000 行 → ~8000 行 |

---

### 🛠️ 给开发者

```bash
git clone <repo>
cd webpilot
./install.ps1   # 或 npm install

# 开发
npm run dev        # vite HMR
npm test           # 195 个 unit test

# 构建
npm run build      # 输出到 electron/renderer/dist/
```

---

### 📋 完整 commit 列表

```
fc9c64b  v4.0.0 W13:  React + Vite 重写 GUI (兼容 vanilla fallback)
5062c9a  chore:       add .npmrc with npmmirror registry + electron mirror
a959c59  v4.0.0 W10-W12: 网络/前端逆向 + 真 LLM 流式 + 工作流画布
f174ae0  v4.0.0 W9:    §3.5.2 网络逆向 - 完整 capture/replay/schema/break
e2f0c2d  v4.0.0 W8:    README + PowerShell installer
3473b25  v4.0.0 W2-W7: GUI as daemon-served single-page app
4fe5be4  v4.0.0 W1 D3-7: daemon + format generators + agent registry + repair
cfe0a67  v4.0.0 W1 D1-2: foundation + Step 1 hooks
```

---

### 🚧 v4.0 显式不做（用户决定）

- ❌ macOS / Linux（v4.1）
- ❌ 代码签名（EV 证书 v4.1）
- ❌ 自动更新（手动覆盖装）
- ❌ NSIS .exe 安装包（当前用 PowerShell install.ps1）
- ❌ Electron 真正桌面 app（用户机装得下时自动用；现在 fallback 到 Chrome tab）
- ❌ 多窗口 / 全屏 / 自定义快捷键（v4.1）

---

### 📝 完整文档树

- `README.md` — 项目总览
- `INSTALL.md` — 3 步开箱即用指南
- `CHANGELOG.md` — 本文件
- `docs/ARCHITECTURE.md` — 架构说明
- `daemon/static/index.html` — 桌面 GUI（运行时）

---

## v3.x → v4.0 迁移

如果你从 v3.x 升级：

1. **旧脚本不兼容**：用 `install.ps1` 重新装
2. **配置文件位置变了**：从 `~/.browserbridge/` 改成 `%LOCALAPPDATA%\WebPilot\`
3. **API 端点兼容**：`/mcp` + `/api/*` 路径不变
4. **MCP 协议版本**：4.0（v3 是 1.0，Tool schema 略变 — 重新测一遍）
5. **不再支持**：`install.bat` 旧路径；HanaAgent 安装集成
6. **新增**：桌面 GUI / 16 LLM 厂商 / 23 类修复 / 网站逆向工具

---

## 许可

MIT — 给用户和好友用，可自由修改再分发
