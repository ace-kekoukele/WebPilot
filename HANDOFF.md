# WebPilot — 项目交接说明

> 写给下一个人看。先读这份,再去看代码。
>
> **生成时间:** 2026-07-09
> **交接状态:** v4.0.1 已发 release zip(2026-07-06),代码可工作,有些小毛病已列在文末"已知问题"。

---

## 一句话定位

**WebPilot = Chrome DevTools Protocol 桥。** 用户的 AI Agent(Claude Desktop / Cursor / MiniMax Code 等)通过 MCP 协议(9223 端口)控制用户**自己已开**的 Chrome(9222 端口),WebPilot 在中间做转译 + 桌面 GUI(9224 端口)。

不是 headless 浏览器,不是新进程,**只用用户自己的 Chrome + 用户自己的登录态**。

---

## 当前版本(2026-07-06)

| 项 | 值 |
|---|---|
| 版本 | v4.0.2(integrated, working tree) |
| 工具数 | 79 个 MCP 工具(22 个 CDP 域覆盖) |
| LLM 厂商 | 16 个预设(OpenAI/Anthropic/DeepSeek/Kimi/智谱/Qwen/MiniMax/Ollama...) |
| 协议 | MCP Streamable HTTP(MCP 2025-03-26) |
| 桌面 GUI | React 18 + Vite,177KB / gzip 57KB |
| 测试 | 199 个 unit + 集成,本整合后全过 |
| 平台 | **仅 Windows**(v4.1 才考虑 macOS/Linux) |

**注意:** v4.0.1 的 commit `d299932` 改了端口管理 + GUI 显示,代码已经合并;但 **`lib/version.js` 的 `VERSION` 字段和 `package.json` 的 `version` 字段还是 4.0.0**。需要发新版本时手动改这俩(看文末"已知问题")。

---

## 5 分钟跑起来

```powershell
# 1. 装 Node 22+ 和 Chrome(用 LTSC 的 Node LTS 即可)
node --version     # >= v22

# 2. 装依赖(用了国内镜像,.npmrc 已配)
npm install

# 3. 启 Chrome with debug port
Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  -ArgumentList "--remote-debugging-port=9222"

# 4. 启 WebPilot daemon
npm start
# 或: node daemon/main.js

# 5. 开 GUI
# Chrome 地址栏 → http://127.0.0.1:9224

# 6. 测试
npm test          # 单元
npm run test:all  # 单元 + 集成(需 Chrome 已开)
```

> 看到 4 行 banner 出来 + Chrome 顶栏变绿 = 成了。

---

## 目录结构(你真正要看的就这几个)

```
browser-bridge-main/
├── package.json            ← scripts: start/test/build/dev/electron
├── README.md               ← 用户总览
├── INSTALL.md              ← 用户安装
├── CHANGELOG.md            ← 版本变更
├── HANDOFF.md              ← 你正在看的
├── CONTRIBUTING.md         ← 开发贡献(已重写为 v4.0 时代)
│
├── daemon/                 ← ★ 守护进程 + 业务编排
│   ├── main.js             ← 入口:启停 + 端口协商 + 信号处理
│   ├── config.js           ← 配置加载 + 热重载 + 损坏自动备份
│   ├── port-finder.js      ← 6 端口自动迁移(9222-9227)
│   ├── browser-picker.js   ← Chrome 多版本探测
│   ├── browser-launcher.js ← 桌面 / 开始菜单快捷方式
│   ├── cdp-watchdog.js     ← WS 断线状态机重连
│   ├── repair.js           ← 5 个真有效的修复项
│   ├── activity-log.js     ← 10000 条 ring buffer
│   ├── agent-registry.js   ← 6 Agent 跟踪
│   ├── llm-client.js       ← OpenAI/Anthropic/Gemini 真流式
│   ├── network-proxy.js    ← 系统代理 + VPN 检测
│   ├── network-store.js    ← 网络拦截/逆向
│   ├── memory-guard.js     ← 内存监控
│   ├── static-server.js    ← GUI 静态文件
│   ├── static-mime.js      ← MIME
│   ├── logger.js           ← 日志
│   ├── static/             ← GUI 运行时(运行时 serve)
│   ├── discovery/          ← Agent 配置探测 / 写入
│   └── format-generators/  ← OpenAI/Anthropic/Gemini/OpenAPI 格式
│
├── lib/                    ← ★ 核心库
│   ├── cdp/                ← CDP 拆分模块(在用)
│   │   ├── index.js        ← facade
│   │   ├── transport.js    ← ws + bucket routing
│   │   ├── connection.js   ← ensureBridge / disconnect
│   │   ├── send.js         ← sendCommand / sendPageCommand / evaluate
│   │   ├── target.js       ← listTabs / newTab / closeTab
│   │   └── module-cleanup.js ← isOurTab + 70-tools 8 步清理 hooks
│   ├── mcp-server.js       ← MCP Streamable HTTP server(在用)
│   ├── http-api.js         ← HTTP REST + OpenAPI 3.0(在用)
│   ├── tool-loader.js      ← 工具加载器(在用)
│   ├── version.js          ← 单一版本源(VERSION = '4.0.0',需同步)
│   ├── zod-helper.js       ← zod schema 辅助
│   └── cdp-manager.js      ← ⚠️ v2 兼容层,别动(42 个 tools 在用)
│
├── tools/                  ← ★ 79 个 MCP 工具
│   └── browser_*.js        ← 每个工具独立文件
│
├── electron/renderer/      ← ★ React 18 桌面 GUI
│   ├── src/                ← App + 9 components + 4 panels
│   ├── dist/               ← 预编译产物(运行时优先用)
│   ├── public/
│   └── tsconfig.json
│
├── test/                   ← ★ 测试
│   ├── unit/               ← 21 个测试文件,199 个 cases
│   └── integration/        ← 1 个 cdp-direct.test.js
│
├── scripts/                ← 启动/调试/验证脚本(v4.0.2 整理后只剩 start-mcp-server.mjs)
│
├── install.ps1             ← ★ Windows 用户级安装
├── uninstall.ps1
├── vite.config.js
└── .npmrc                  ← 国内镜像
```

---

## 关键模块说明(5 分钟上手)

### 启动流程(看 `daemon/main.js` 151-232 行)

```
1. loadConfig + startWatching       # 加载配置,热重载
2. installModuleCleanup             # 70-tools 8 步清理 hooks
3. startMemoryGuard                 # 内存监控
4. detectNetwork                    # 系统代理 + VPN
5. negotiatePorts                   # 6 端口自动迁移
6. startWatchdog → ensureBridge     # WS 断线重连状态机
7. detectBrowser + installChromeShortcutIfNeeded  # 创建桌面 .lnk
8. startServers (MCP + HTTP)        # 按配置启 server
9. emit('ready')                    # GUI 顶栏变绿
```

### 端口分配(看 `lib/version.js` 33-41 行)

| 端口 | 用途 | 可改 |
|---|---|---|
| 9222 | CDP — attach 用户 Chrome 用 | 否(由 Chrome 决定) |
| 9223 | MCP Streamable HTTP — Agent 接入 | 可(配置 + 重启) |
| 9224 | HTTP REST API + GUI 静态 | 可 |
| 9225 | bb CLI TCP control(暂未用) | 可 |
| 9226 | SSE 实时事件(暂未用) | 可 |
| 9227 | webhook 推送(暂未用) | 可 |

被占时自动 +1 直到 +10 找空位,通过 `port-finder.js` 的 `negotiatePorts()`。

### 守护进程 vs 旧 MCP server 入口

- **现在用:** `npm start` → `node daemon/main.js` → 完整 daemon + GUI serve + 端口协商
- **legacy 还在但别用:** `npm run mcp` → `node scripts/start-mcp-server.mjs` → 只启 MCP+HTTP,没 daemon 那层(没端口协商、没 watchdog、没 config 热重载、没 GUI serve)
- 老的 `index.js`(18 行)是 v2 兼容入口,不要 import 新的代码

### 工具怎么加

1. 在 `tools/` 新建 `browser_mything.js`:
   ```js
   import { sendPageCommand } from '../lib/cdp/index.js';

   export const name = 'browser_mything';
   export const description = '...';
   export const parameters = { ... };

   export async function execute(args) {
     try {
       if (!args.requiredField) return { ok: false, error: '...' };
       const r = await sendPageCommand(args.targetId, 'CDP.Domain.method', { ... });
       return { ok: true, data: r.someField };
     } catch (err) {
       return { ok: false, error: err.message };
     }
   }
   ```
2. **必须**用 `import '.../lib/cdp/index.js'`,不要 `lib/cdp-manager.js`(后者是 v2 兼容层)
3. 危险操作(关非自有 tab / 清 cookies / 伪造响应):加 `confirm: true` 参数 + manifest 标 `risk: 'high'`
4. 加单元测试到 `test/unit/tools-args-validation.test.js`

---

## 怎么打包发版

**当前手动流程**(没 CI 自动):

```bash
# 1. 同步版本号
# 改 lib/version.js VERSION 字段
# 改 package.json version 字段
# 改 install.ps1 里的 zip 文件名(如果改了主版本)

# 2. 跑测试
npm run test:all

# 3. 编译 React GUI
npm run build

# 4. 打包 zip(在项目根目录跑 PowerShell)
Compress-Archive -Path `
  "package.json","package-lock.json",".npmrc",".gitignore",".github",`
  "README.md","INSTALL.md","CHANGELOG.md","CONTRIBUTING.md",`
  "install.ps1","uninstall.ps1",`
  "lib","daemon","tools","electron","test","scripts","docs",`
  "vite.config.js" `
  -DestinationPath "WebPilot-v4.0.X.zip" -Force

# 5. 测试 zip:解压到临时目录,跑 install.ps1
```

`WebPilot-v4.0.0.zip` / `WebPilot-v4.0.1.zip` 已存在可参考。

---

## 端口管理(v4.0.1 新增)

**用户原话:** "监控端口需要有一个提醒,让用户自己去配置一下,或者可以打开一个页面,总之要做到开箱即用。因为不是每一部电脑的监控端口都是 9224"

**实现:**
- 后端 `port-finder.js`:`negotiatePorts()` 启动时自动迁移 + 写回 config
- daemon 端口变化时 emit `port-changed` 事件
- GUI `App.tsx` 启动时检查,弹 12s 警告 toast + [改回默认] 按钮 → 跳到 Settings
- GUI `TopBar.tsx` 加 🔌 按钮(hover 显示所有端口,点击开 Settings)
- `install.ps1` 加 Step 1.5 端口扫描,默认端口被占时黄色警告
- 新增 `GET /api/ports` / `POST /api/ports`(1024-65535 校验)

---

## 6 Agent 自动接入(默认 Auto 模式)

wizard 配:Claude Desktop / Claude Code / Cursor / Continue / MiniMax Code / Hermes,加自研 Agent。**默认不写用户配置文件**——Agent 一连,daemon 通过 `clientInfo` 自识别,顶栏显示。

用户配置:
```json
{ "mcpServers": { "webpilot": { "url": "http://127.0.0.1:9223/mcp" } } }
```

---

## 文档地图

| 文档 | 用途 |
|---|---|
| `README.md` | 用户总览 — 5 分钟跑起来 |
| `INSTALL.md` | 3 步开箱即用 + 16 Agent 接入手册 |
| `CHANGELOG.md` | 版本变更 |
| `HANDOFF.md` | 你正在看的 — 开发者接手 |
| `CONTRIBUTING.md` | 加新工具 / 跑测试 / 提 PR 流程 |
| `docs/ARCHITECTURE.md` | v4.0 架构(daemon/lib/tools/electron) |
| `docs/CODE_STATUS.md` | 哪些代码在用 / 兼容层 / legacy / 待续 |

**API 参考:** 直接调运行时:
- `GET http://127.0.0.1:9224/api/openapi.json` — OpenAPI 3.0 完整规范
- `GET http://127.0.0.1:9224/api/formats/openai` / `anthropic` / `gemini` / `a2a` — 多家 LLM 格式
- `GET http://127.0.0.1:9224/api/health` — 简单健康检查(带 ports)
- `GET http://127.0.0.1:9224/api/ports` / `POST /api/ports` — 端口查询/修改

**绝对不要看:** `ARCHIVED.md` / `docs/API.md` / `docs/QUICKSTART.md` / `docs/HANA_INTEGRATION.md` 等老文档(2026-07-09 已删,描述的是 v1.7.0 的 browser-bridge 45 工具时代,跟现在完全对不上)。

---

## 已知问题(下一个人要解决的)

### 🟡 小毛病(不影响功能)

**v4.0.2 整合后全部已解决**,作为变更记录保留:

1. ✅ **VERSION 同步** — `lib/version.js` 和 `package.json` 已同步到 4.0.2。
2. ✅ **CHANGELOG v4.0.2 条目** — 见 CHANGELOG.md 顶部。
3. ✅ **`scripts/` 目录清理** — 删了 10 个 v1.7-v2 调试脚本,只保留 `start-mcp-server.mjs`(无 daemon 模式 fallback)。
4. ✅ **删根 `index.js`** — 18 行 v2 兼容入口,无引用,已删。
5. ✅ **`lib/cdp-manager.js` 拆掉** — 19 行 facade 已删,68 个 tools + lib/ 全部迁到 `lib/cdp/index.js`。
6. ✅ **`daemon/static/` vanilla fallback 删掉** — ~2000 行,daemon 只走 React dist。
7. ✅ **workflow-canvas.js + favicon 重复** — 已删。
8. ✅ **4 个 dead npm script**(`mcp`/`preview`/`electron`/`electron:dev`)— 已删。
9. ✅ **install.bat v1.7 时代** — 已删。
10. ✅ **同步脚本注释 sync-version.mjs** — 文件本不存在,注释已删。

### 🟡 新增的小毛病(v4.0.2 之后)

1. **集成测试覆盖率低** — 只有 1 个 cdp-direct.test.js,`daemon/*.js` 0 覆盖,`http-api.js` 大部分 endpoint 没集成测试。
2. **Electron 实际没用** — `package.json` 已删 electron script(文件不存在);用户都用 Chrome tab 打开 GUI。
3. **`tools/browser_network_get.js` 是 `browser_network.js` 的 alias** — 多个 name,可能造成工具 list 重复;v4.1 整理时合并成一个 tool。

### 🟢 已决定不做(v4.0)

- macOS / Linux — 留 v4.1
- 代码签名(EV 证书)— 留 v4.1
- 自动更新 — 手动覆盖装
- NSIS .exe 安装包 — 当前 PowerShell install.ps1 够用
- Electron 真正桌面 app 替代 Chrome tab — fallback 已有,先用 Chrome tab

### 🟢 显式保留的承诺(用户决定)

10 条 v4.0 用户承诺(README.md §"用户承诺"有完整列表),最关键的:
- 用用户**已开**的 Chrome(不另起进程)
- 不开 headless debug 浏览器
- 用户标签页**永久只读**(`isOurTab()` 守卫)
- 用用户**登录态**(不覆盖 `--user-data-dir`)
- **BB 退出不影响 Chrome**(graceful shutdown)
- **只支持简体中文**
- **Win only**,不签
- **不自动更新**
- **不自动写** Agent 配置文件

---

## 紧急情况

### daemon 跑不起来
```powershell
# 看日志
Get-Content "$env:LOCALAPPDATA\WebPilot\logs\daemon-$(Get-Date -Format 'yyyyMMdd').log"

# 检查端口被占
Get-NetTCPConnection -LocalPort 9222,9223,9224 -State Listen -ErrorAction SilentlyContinue

# 测试 Chrome CDP 通不通
curl http://127.0.0.1:9222/json/version
```

### 测试挂了
```powershell
npm test 2>&1 | Tee-Object test-output.txt
```

### 完全回滚到上个版本
```bash
git log --oneline -10
git checkout <上一个 stable commit>
# 重新装依赖
npm install
npm start
```

### 找原 MCP 时代的资料
v1.7.0 / v2.0 / v3.0 时代的所有文档(已删)在 git 历史里:
```bash
git log --all --diff-filter=D --name-only --pretty=format: -- '*.md' | Sort-Object -Unique
```
关键 commit:`cfe0a67`(v4.0.0 W1 Day 1-2 基础)→ `4fe5be4`(W1 Day 3-7 daemon)→ `fc9c64b`(W13 React 重写 GUI)。

---

## 关键决策(下个人别再问)

- **"为什么用 Node http 不上 Express?"** — 0 依赖,部署简单,MCP SDK 集成
- **"为什么 attach 用户 Chrome 不自己开?"** — 用户要登录态 + 隐私 + 顺手用现有窗口
- **"为什么 React 18 + Vite 而不是 Next.js?"** — 单页应用够用,产物小,启动快
- **"为什么 zod passthrough 不完整 schema?"** — v1.7 决策,SDK 1.29 兼容性;v4.0 已加 zod-helper.js 改善
- **"为什么 6 个端口?"** — 9222 CDP, 9223 MCP, 9224 HTTP, 9225 control (留 bb CLI), 9226 SSE, 9227 webhook

---

**别犹豫,直接改。** 项目还在 active 开发(v4.0.1 之后就是 v4.1),不是归档。
