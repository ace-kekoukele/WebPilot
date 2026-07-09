# Architecture — WebPilot v4.0

> v4.0 单进程 daemon + 静态 GUI + 多 Agent 接入架构。
>
> 配合 [../HANDOFF.md](../HANDOFF.md) 看。

---

## 设计原则

1. **不另起 Chrome 进程** — attach 用户已开的 Chrome(9222)
2. **不开 headless** — 默认 headed 模式
3. **用户标签页永久只读** — `isOurTab()` 守卫,所有 79 工具 require own tab
4. **用用户登录态** — 不覆盖 `--user-data-dir`
5. **BB 退出不影响 Chrome** — graceful shutdown 不 kill Chrome
6. **零状态可迁移** — 不持久化,关掉就清空
7. **只支持 Windows** — v4.0 决定
8. **只支持简体中文** — v4.0 决定
9. **薄壳工具** — `tools/*.js` ≤ 80 行,复杂逻辑在 `lib/`
10. **不自动写** — 默认 Auto 模式,Agent 配置由用户显式选才写

---

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│  用户机器 (Windows)                                          │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Google Chrome (用户已开)                              │   │
│  │  --remote-debugging-port=9222                         │   │
│  │  --user-data-dir=用户原配置                           │   │
│  └──────────────────────────────────────────────────────┘   │
│         ↑ CDP WebSocket                                      │
│         │                                                    │
│  ┌──────┴───────────────────────────────────────────────┐   │
│  │  WebPilot daemon (单进程 Node.js)                     │   │
│  │                                                       │   │
│  │  daemon/main.js                                       │   │
│  │   ├─ config.js          ← 配置加载 + 热重载          │   │
│  │   ├─ port-finder.js     ← 6 端口自动迁移              │   │
│  │   ├─ browser-picker.js  ← Chrome 多版本探测          │   │
│  │   ├─ browser-launcher.js ← 桌面/开始菜单 .lnk        │   │
│  │   ├─ cdp-watchdog.js    ← WS 断线状态机              │   │
│  │   ├─ repair.js          ← 5 个真有效的修复           │   │
│  │   ├─ agent-registry.js  ← 6 Agent 跟踪                │   │
│  │   ├─ activity-log.js    ← 10000 条 ring buffer       │   │
│  │   ├─ llm-client.js      ← OpenAI/Anthropic/Gemini    │   │
│  │   ├─ network-proxy.js   ← 系统代理 + VPN 检测         │   │
│  │   ├─ network-store.js   ← 网络拦截/逆向               │   │
│  │   ├─ memory-guard.js    ← 内存监控                    │   │
│  │   ├─ static-server.js   ← GUI 静态 serve              │   │
│  │   └─ discovery/         ← Agent 配置探测/写入        │   │
│  │                                                       │   │
│  │  lib/                                                 │   │
│  │   ├─ cdp/transport.js   ← ws + bucket routing       │   │
│  │   ├─ cdp/connection.js ← ensureBridge                │   │
│  │   ├─ cdp/send.js        ← sendCommand / evaluate     │   │
│  │   ├─ cdp/target.js      ← listTabs / newTab          │   │
│  │   ├─ cdp/module-cleanup.js ← isOurTab 守卫           │   │
│  │   ├─ mcp-server.js      ← MCP Streamable HTTP        │   │
│  │   ├─ http-api.js        ← HTTP REST + OpenAPI 3.0    │   │
│  │   ├─ tool-loader.js     ← 工具加载器                 │   │
│  │   ├─ version.js         ← 单一版本源                 │   │
│  │   └─ zod-helper.js      ← zod schema 辅助            │   │
│  │                                                       │   │
│  │  tools/ (79 个 MCP 工具)                              │   │
│  │   └─ browser_*.js       ← 薄壳,导入 lib/cdp/        │   │
│  │                                                       │   │
│  │  daemon/static/        ← GUI 运行时 (被 serve)        │   │
│  │   └─ index.html + app.js + workflow-canvas.js        │   │
│  │                                                       │   │
│  │  format-generators/    ← 5 厂商格式                  │   │
│  │   ├─ openai.js                                           │   │
│  │   ├─ anthropic.js                                        │   │
│  │   ├─ gemini.js                                           │   │
│  │   ├─ openapi.js                                          │   │
│  │   └─ presets.js + presets.json  ← 16 个 LLM 厂商       │   │
│  └──────────────────────────────────────────────────────┘   │
│         │                                                    │
│         ├── MCP (9223)  ← AI Agent 接入                      │
│         ├── HTTP (9224) ← REST + OpenAPI 3.0 + GUI 静态     │
│         ├── control (9225) ← bb CLI TCP(暂未用)            │
│         ├── sse (9226) ← SSE 实时事件(暂未用)              │
│         └── webhook (9227) ← webhook 推送(暂未用)          │
│                                                              │
│  AI Agents (Claude Desktop / Claude Code / Cursor /         │
│   Continue / MiniMax Code / Hermes)                          │
│   通过 MCP URL: http://127.0.0.1:9223/mcp                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 数据流

### 1. Agent 调用工具(MCP)

```
Agent (Claude Code)
  ↓ POST /mcp { method: 'tools/call', name: 'browser_navigate', args: {...} }
MCP Streamable HTTP transport (lib/mcp-server.js)
  ↓ JSON-RPC 解析
McpServer.route → registered tool handler
  ↓
tools/browser_navigate.js#execute(args, ctx)
  ↓ sendPageCommand(targetId, 'Page.navigate', { url })
lib/cdp/send.js → _send(ws, sessionKey, method, params)
  ↓
Chrome CDP response → _pending bucket resolve
  ↓
{ ok: true, data: {...} }
  ↓
MCP response (SSE)
  ↓
Agent 收到结果
```

### 2. GUI 调 REST

```
React GUI (daemon/static/app.js)
  ↓ fetch /api/tools/call
HTTP API (lib/http-api.js)
  ↓
tools/*.js#execute(args, ctx)
  ↓ ...(同上)
  ↓
JSON response
```

### 3. Agent 自动识别

```
Agent 连接 → POST /mcp (initialize)
  ↓ 解析 clientInfo.name (e.g. "claude-code", "MiniMax-code")
daemon/agent-registry.js
  ↓ 注册到 in-memory map
  ↓ emit 'agent-connected' 事件
daemon/activity-log.js
  ↓ 记录连接
GUI 顶栏
  ↓ 监听 agent-registry
  ↓ 显示 "✅ Claude Code" 绿色 chip
```

### 4. WS 断线重连

```
CDP ws 断开
  ↓
cdp-watchdog.js 检测到 close 事件
  ↓ 启动 backoff 重连 (1s → 2s → 4s → ... 最多 30s)
  ↓
ensureBridge() 重连 Browser Target
  ↓
自动 re-attach 所有 own tabs
  ↓
继续接收 Agent 调用
```

---

## 关键设计决策

### 端口分配(6 个)

| 端口 | 用途 | 谁占用 |
|---|---|---|
| 9222 | CDP — attach 用户 Chrome | 用户 Chrome |
| 9223 | MCP Streamable HTTP | WebPilot daemon |
| 9224 | HTTP REST + GUI 静态 | WebPilot daemon |
| 9225 | bb CLI TCP control | WebPilot daemon(暂未用) |
| 9226 | SSE 实时事件 | WebPilot daemon(暂未用) |
| 9227 | webhook 推送 | WebPilot daemon(暂未用) |

**自动迁移:** `port-finder.js` 的 `negotiatePorts()` 启动时检测,被占则 +1 直到 +10 找空位,写回 config,emit `port-changed` 事件给 GUI 弹 toast。

### isOurTab 守卫

`lib/cdp/module-cleanup.js` 维护 `Map<targetId, 'user' | 'ours'>` 标记 tab 来源:
- 用户手动开的 → 标 `user`,**所有 79 工具拒绝操作**
- WebPilot 用 `browser_tabs { action: 'open' }` 开的 → 标 `ours`,允许操作

70-tools 8 步 refactor 的 `installModuleCleanup()` 在 daemon 启动时挂上 hooks,Tab 关闭时自动清理。

### Bucket Routing

`lib/cdp/transport.js`:
```js
_pending = Map<sessionKey, Map<id, { resolve, reject, timer }>>;
// sessionKey = '_browser' / `page:${targetId}` / sessionId
```

**关键:** `_send` 的 `bucketKey` 必须等于 `_wireUpEvents` 的 `sessionKey`,否则响应路由失败。

### zod Schema

`lib/zod-helper.js` 提供统一转换。早期 v1.7 用 `z.object({}).passthrough()` 简化,v4.0 通过 zod-helper 改善了字段自动补全 + 错误信息精度。

---

## v4.0 vs v3.x 关键变化

| 维度 | v3.x | v4.0 |
|---|---|---|
| 名字 | browser-bridge | **WebPilot** |
| 架构 | 单文件 + 散落 lib/ | 单进程 daemon + 静态 GUI |
| GUI | 无 | React 18 + Vite,177KB / gzip 57KB |
| LLM | 无 | 16 个厂商 + 真流式(SSE 解析) |
| 网络 | 基础 capture | capture/replay/schema/break 完整 |
| 前端逆向 | 无 | 3 个新工具(页面结构/window 全局/API 推断) |
| 画布 | 无 | vanilla SVG workflow editor |
| 代理 | 无 | 系统代理 + VPN 检测 |
| 配置 | JSON 散落 | zod 校验 + 热加载 + 损坏自动备份 |
| 工具数 | 70 | **79**(原 70 + 网络/前端 9 个新) |
| 测试 | 156 | **193+** |
| 代码量 | ~3000 行 | **~8000 行** |

---

## 数据存储

- **配置:** `%LOCALAPPDATA%\WebPilot\config.json` — 端口、Chrome 路径、LLM key 等
- **日志:** `%LOCALAPPDATA%\WebPilot\logs\daemon-YYYYMMDD.log`
- **崩溃备份:** `%LOCALAPPDATA%\WebPilot\config.json.bak-*`(损坏时自动)
- **网络捕获:** 内存中(10000 条 ring buffer)
- **活动日志:** 内存中(10000 条 ring buffer)
- **工作流:** 内存中(未持久化)

**零状态原则:** 关掉 daemon 就清空所有运行时状态,配置除外。

---

## 与 7 Agent 的协作

`daemon/discovery/agent-detect.js` 扫描常见安装路径:
- Claude Desktop:`%APPDATA%\Claude\`
- Claude Code:`~/.claude/`
- Cursor:`%APPDATA%\Cursor/`
- Continue:`~/.continue/`
- MiniMax Code:本地配置
- Hermes:本地配置
- 自研 Agent:任意 MCP client

`agent-config-writer.js` 只在用户**显式选择**时才写配置文件(默认 Auto 模式不写)。

---

## 性能考虑

- **WS 复用:** Browser Target 单 ws,Page session 各自 ws,bucket routing 防止串扰
- **Lazy enable:** CDP 域按需 enable,不预 enable
- **ring buffer:** activity-log / network-store 限 10000 条,环形覆盖
- **自动重连:** WS 断线 backoff 1-30s,避免频繁重试
- **端口协商:** 启动时一次,运行中不重协商(改端口需重启)
- **GUI bundle:** 177KB / gzip 57KB,一次加载

---

## 关键约束(下个人别破坏)

1. **isOurTab 守卫不可绕** — 用户标签页永久只读,79 工具必须 require own tab
2. **bucketKey 严格匹配** — `_send` 的 `bucketKey` = `_wireUpEvents` 的 `sessionKey`,否则响应路由失败
3. **WS graceful shutdown** — BB 退出时不能 kill Chrome
4. **不覆盖 --user-data-dir** — 用户登录态
5. **零状态** — 不持久化到磁盘(除 config)
6. **薄壳工具** — `tools/*.js` ≤ 80 行,逻辑在 `lib/`
7. **Windows-only** — 别加跨平台代码

---

**看更多:** [../HANDOFF.md](../HANDOFF.md) / [./CODE_STATUS.md](./CODE_STATUS.md) / [../CHANGELOG.md](../CHANGELOG.md)
