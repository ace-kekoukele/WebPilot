# 代码状态 — 给下一个人接手时看

> 配合 [../HANDOFF.md](../HANDOFF.md) 看,这份专门讲"哪些能动、哪些别动、哪些是死的"。

---

## 🟢 在用(放心改)

### `daemon/` — 守护进程编排
v4.0 时代全部在用。**入口是 `daemon/main.js`**,被 `npm start` 调用。

| 文件 | 状态 | 备注 |
|---|---|---|
| `main.js` | ✅ v4.0 | 启停 + 端口协商 + 信号处理 |
| `config.js` | ✅ v4.0 | 加载 + 热重载 + 损坏自动备份 |
| `port-finder.js` | ✅ v4.0 | 6 端口自动迁移(9222-9227) |
| `browser-picker.js` | ✅ v4.0 | Chrome 多版本探测 |
| `browser-launcher.js` | ✅ v4.0 | 桌面 / 开始菜单快捷方式 |
| `cdp-watchdog.js` | ✅ v4.0 | WS 断线状态机重连 |
| `repair.js` | ✅ v4.0 | 5 个真有效的修复项 |
| `activity-log.js` | ✅ v4.0 | 10000 条 ring buffer |
| `agent-registry.js` | ✅ v4.0 | 6 Agent 跟踪 |
| `llm-client.js` | ✅ v4.0 | OpenAI/Anthropic/Gemini 真流式 |
| `network-proxy.js` | ✅ v4.0 | 系统代理 + VPN 检测 |
| `network-store.js` | ✅ v4.0 | 网络拦截/逆向 |
| `memory-guard.js` | ✅ v4.0 | 内存监控 |
| `static-server.js` | ✅ v4.0 | GUI 静态文件 |
| `static-mime.js` | ✅ v4.0 | MIME |
| `logger.js` | ✅ v4.0 | 日志 |
| `static/` | ✅ v4.0 | GUI 运行时(被 static-server serve) |
| `discovery/agent-detect.js` | ✅ v4.0 | Agent 配置探测 |
| `discovery/agent-config-writer.js` | ✅ v4.0 | Agent 配置写入 |
| `format-generators/` | ✅ v4.0 | OpenAI/Anthropic/Gemini/OpenAPI 格式 |

### `lib/cdp/` — CDP 拆分模块
v4.0 时代核心,已替代老的 `lib/cdp-manager.js` 单体(322 行)。

| 文件 | 状态 | 备注 |
|---|---|---|
| `index.js` | ✅ facade | 统一对外 |
| `transport.js` | ✅ | ws + bucket routing |
| `connection.js` | ✅ | ensureBridge / disconnect |
| `send.js` | ✅ | sendCommand / sendPageCommand / evaluate |
| `target.js` | ✅ | listTabs / newTab / closeTab |
| `module-cleanup.js` | ✅ | isOurTab + 70-tools 8 步清理 hooks |

### `lib/*.js`(非 cdp 子目录)
| 文件 | 状态 | 备注 |
|---|---|---|
| `mcp-server.js` | ✅ v4.0 | MCP Streamable HTTP server |
| `http-api.js` | ✅ v4.0 | HTTP REST + OpenAPI 3.0(30KB,最大单文件) |
| `tool-loader.js` | ✅ v4.0 | 工具加载器 |
| `version.js` | ✅ v4.0.2 | **单一版本源**(VERSION = '4.0.2') |
| `zod-helper.js` | ✅ v4.0 | zod schema 辅助 |

### `tools/`
**79 个 MCP 工具(实际 73 个 .js 工具文件 + 多个独立 name export,薄壳模式),全部 v4.0 时代。** 薄壳模式,大部分逻辑在 `lib/cdp/`。

### `electron/renderer/`
React 18 + Vite 桌面 GUI。**`src/` 是源码,`dist/` 是预编译产物**。GUI 运行时只走 `dist/`(被 `daemon/static-server.js` serve,daemon/static/ vanilla fallback 已删)。

### `test/`
- `unit/` — 21 个测试文件,199 个 cases,全部通过
- `integration/` — 1 个 `cdp-direct.test.js`(需 Chrome 9222)
- `_helpers.js` — MockWs 工具

### 根目录
- `package.json` — v4.0 配置 ✅
- `install.ps1` / `uninstall.ps1` — Windows 用户级安装/卸载 ✅
- `vite.config.js` — Vite 配置 ✅
- `.npmrc` — 国内镜像配置 ✅
- `.github/workflows/` — CI ✅

---

## 🟡 兼容层(已清,v4.0.2)

### `lib/cdp-manager.js`(已删)
v2 兼容层,19 行 facade 重导出 `lib/cdp/index.js`。**v4.0.2 已删**——68 个 tools + `lib/tool-loader.js` + `lib/http-api.js` + `scripts/start-mcp-server.mjs` + 3 个测试全部迁到 `lib/cdp/index.js`。无外部依赖。

### `index.js`(已删)
18 行 v2 兼容入口。**v4.0.2 已删**——`git grep` 确认 0 内部引用,`package.json` `main` 字段是 `daemon/main.js`。

---

## 🟠 Legacy(已清,v4.0.2)

### `scripts/`
v4.0.2 删了 10 个 v1.7-v2 调试脚本(`start.bat`/`start.ps1`/`check-init.mjs`/`quick-test.mjs`/`verify-p0-fix.mjs`/`ws-test.mjs`/`trace-debug.mjs`/`list-cdp-domains.mjs`/`test-rebuild.mjs`/`test-http-api.ps1`)。现在只剩 `start-mcp-server.mjs`(无 daemon 模式 fallback,`package.json` `mcp` script 已删,可直接 `node scripts/start-mcp-server.mjs` 跑)。

### `daemon/static/`
**v4.0.2 整个删掉** (~2000 行 vanilla GUI)。`daemon/static-server.js` 现在只走 `electron/renderer/dist/`。`install.ps1` build 失败时改 return error(不再降级到 vanilla)。

---

## 🟢 显式不做(用户决定,别再问)

- ❌ macOS / Linux(留 v4.1)
- ❌ 代码签名 EV 证书(留 v4.1)
- ❌ 自动更新(手动覆盖装)
- ❌ NSIS .exe 安装包(PowerShell install.ps1 够用)
- ❌ Electron 真正桌面 app 替代 Chrome tab(fallback 已有,先用 Chrome tab)
- ❌ 多窗口 / 全屏 / 自定义快捷键(留 v4.1)
- ❌ npm publish(个人使用,不需要)

---

## 🟢 显式保留(用户决定,别破坏)

10 条 v4.0 承诺,最关键:
- ✅ 用用户**已开**的 Chrome(不另起进程)
- ✅ 不开 headless debug 浏览器
- ✅ 用户标签页**永久只读**(`isOurTab()` 守卫)
- ✅ 用用户**登录态**(不覆盖 `--user-data-dir`)
- ✅ **BB 退出不影响 Chrome**(graceful shutdown)
- ✅ **只支持简体中文**
- ✅ **Win only**,不签
- ✅ **不自动更新**
- ✅ **不自动写** Agent 配置文件(默认 Auto 模式)
- ✅ 70+ 个工具 + 16 个 LLM 厂商 + 6 个 Agent

---

## 🔴 已知 bug / 待修(下个人可挑)

**v4.0.2 整合后状态:**

1. ✅ **VERSION 同步** — 已同步到 4.0.2
2. ✅ **CHANGELOG** — v4.0.2 条目已写
3. ✅ **react-bundle 同步** — `daemon/static/` 已删,只走 `electron/renderer/dist/`,无同步问题
4. ✅ **`lib/cdp-manager.js` 兼容层** — 已删,68 个 tools 迁完
5. 🟡 **集成测试覆盖率低** — 仍只有 1 个 cdp-direct.test.js,`daemon/*.js` 0 覆盖,`http-api.js` 大部分 endpoint 没集成测试
6. ✅ **electron 实际没用** — `electron/main.cjs` 文件本不存在,`package.json` electron script 已删
7. 🟡 **`tools/browser_network_get.js` 是 alias** — 多个 name 导出,可能造成工具 list 重复;v4.1 整理时合并

---

## 🔍 怎么确认某段代码在不在用

```bash
# 看谁 import 这个文件
grep -r "from.*<path>" --include="*.js" --include="*.mjs" --include="*.cjs" --include="*.ts" --include="*.tsx" .

# 看 package.json 引用
grep "<name>" package.json
```

具体想知道:
- **`<某段代码>在不在用?** — `grep -r "from.*<某段代码>" .` (排除 node_modules)
- **`<某段代码>谁在 import?** — `grep -rl "from.*<某段代码>" . | grep -v node_modules`
- **`<某模块>被哪些 npm script 引用?** — `cat package.json | grep <某模块>`

---

**最后提醒:** 项目还在 active 开发(v4.0.1 之后就是 v4.1),**不是归档**。`ARCHIVED.md`(2026-07-09 已删)写过 v3.0 归档声明,但实际后来从 v3 → v4 重写了,所以那个声明是错的。
