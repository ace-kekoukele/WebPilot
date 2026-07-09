# WebPilot v4.0 — 发布说明

> **2026-07-09 文档整理:** 13 个过时文档(描述 v1.7.0 的 45 工具时代)已删除,新增 `HANDOFF.md` + `docs/ARCHITECTURE.md` + `docs/CODE_STATUS.md`,重写 `CONTRIBUTING.md`。

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
